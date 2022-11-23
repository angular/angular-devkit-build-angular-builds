"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sassBindWorkaround = exports.LoadPathsUrlRebasingImporter = exports.ModuleUrlRebasingImporter = exports.RelativeUrlRebasingImporter = void 0;
const magic_string_1 = __importDefault(require("magic-string"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
/**
 * A Sass Importer base class that provides the load logic to rebase all `url()` functions
 * within a stylesheet. The rebasing will ensure that the URLs in the output of the Sass compiler
 * reflect the final filesystem location of the output CSS file.
 *
 * This class provides the core of the rebasing functionality. To ensure that each file is processed
 * by this importer's load implementation, the Sass compiler requires the importer's canonicalize
 * function to return a non-null value with the resolved location of the requested stylesheet.
 * Concrete implementations of this class must provide this canonicalize functionality for rebasing
 * to be effective.
 */
class UrlRebasingImporter {
    /**
     * @param entryDirectory The directory of the entry stylesheet that was passed to the Sass compiler.
     * @param rebaseSourceMaps When provided, rebased files will have an intermediate sourcemap added to the Map
     * which can be used to generate a final sourcemap that contains original sources.
     */
    constructor(entryDirectory, rebaseSourceMaps) {
        this.entryDirectory = entryDirectory;
        this.rebaseSourceMaps = rebaseSourceMaps;
    }
    load(canonicalUrl) {
        const stylesheetPath = (0, node_url_1.fileURLToPath)(canonicalUrl);
        const stylesheetDirectory = (0, node_path_1.dirname)(stylesheetPath);
        let contents = (0, node_fs_1.readFileSync)(stylesheetPath, 'utf-8');
        // Rebase any URLs that are found
        let updatedContents;
        for (const { start, end, value } of findUrls(contents)) {
            // Skip if value is empty or a Sass variable
            if (value.length === 0 || value.startsWith('$')) {
                continue;
            }
            // Skip if root-relative, absolute or protocol relative url
            if (/^((?:\w+:)?\/\/|data:|chrome:|#|\/)/.test(value)) {
                continue;
            }
            const rebasedPath = (0, node_path_1.relative)(this.entryDirectory, (0, node_path_1.join)(stylesheetDirectory, value));
            // Normalize path separators and escape characters
            // https://developer.mozilla.org/en-US/docs/Web/CSS/url#syntax
            const rebasedUrl = './' + rebasedPath.replace(/\\/g, '/').replace(/[()\s'"]/g, '\\$&');
            updatedContents !== null && updatedContents !== void 0 ? updatedContents : (updatedContents = new magic_string_1.default(contents));
            updatedContents.update(start, end, rebasedUrl);
        }
        if (updatedContents) {
            contents = updatedContents.toString();
            if (this.rebaseSourceMaps) {
                // Generate an intermediate source map for the rebasing changes
                const map = updatedContents.generateMap({
                    hires: true,
                    includeContent: true,
                    source: canonicalUrl.href,
                });
                this.rebaseSourceMaps.set(canonicalUrl.href, map);
            }
        }
        let syntax;
        switch ((0, node_path_1.extname)(stylesheetPath).toLowerCase()) {
            case 'css':
                syntax = 'css';
                break;
            case 'sass':
                syntax = 'indented';
                break;
            default:
                syntax = 'scss';
                break;
        }
        return {
            contents,
            syntax,
            sourceMapUrl: canonicalUrl,
        };
    }
}
/**
 * Determines if a unicode code point is a CSS whitespace character.
 * @param code The unicode code point to test.
 * @returns true, if the code point is CSS whitespace; false, otherwise.
 */
function isWhitespace(code) {
    // Based on https://www.w3.org/TR/css-syntax-3/#whitespace
    switch (code) {
        case 0x0009: // tab
        case 0x0020: // space
        case 0x000a: // line feed
        case 0x000c: // form feed
        case 0x000d: // carriage return
            return true;
        default:
            return false;
    }
}
/**
 * Scans a CSS or Sass file and locates all valid url function values as defined by the CSS
 * syntax specification.
 * @param contents A string containing a CSS or Sass file to scan.
 * @returns An iterable that yields each CSS url function value found.
 */
function* findUrls(contents) {
    let pos = 0;
    let width = 1;
    let current = -1;
    const next = () => {
        var _a;
        pos += width;
        current = (_a = contents.codePointAt(pos)) !== null && _a !== void 0 ? _a : -1;
        width = current > 0xffff ? 2 : 1;
        return current;
    };
    // Based on https://www.w3.org/TR/css-syntax-3/#consume-ident-like-token
    while ((pos = contents.indexOf('url(', pos)) !== -1) {
        // Set to position of the (
        pos += 3;
        width = 1;
        // Consume all leading whitespace
        while (isWhitespace(next())) {
            /* empty */
        }
        // Initialize URL state
        const url = { start: pos, end: -1, value: '' };
        let complete = false;
        // If " or ', then consume the value as a string
        if (current === 0x0022 || current === 0x0027) {
            const ending = current;
            // Based on https://www.w3.org/TR/css-syntax-3/#consume-string-token
            while (!complete) {
                switch (next()) {
                    case -1: // EOF
                        return;
                    case 0x000a: // line feed
                    case 0x000c: // form feed
                    case 0x000d: // carriage return
                        // Invalid
                        complete = true;
                        break;
                    case 0x005c: // \ -- character escape
                        // If not EOF or newline, add the character after the escape
                        switch (next()) {
                            case -1:
                                return;
                            case 0x000a: // line feed
                            case 0x000c: // form feed
                            case 0x000d: // carriage return
                                // Skip when inside a string
                                break;
                            default:
                                // TODO: Handle hex escape codes
                                url.value += String.fromCodePoint(current);
                                break;
                        }
                        break;
                    case ending:
                        // Full string position should include the quotes for replacement
                        url.end = pos + 1;
                        complete = true;
                        yield url;
                        break;
                    default:
                        url.value += String.fromCodePoint(current);
                        break;
                }
            }
            next();
            continue;
        }
        // Based on https://www.w3.org/TR/css-syntax-3/#consume-url-token
        while (!complete) {
            switch (current) {
                case -1: // EOF
                    return;
                case 0x0022: // "
                case 0x0027: // '
                case 0x0028: // (
                    // Invalid
                    complete = true;
                    break;
                case 0x0029: // )
                    // URL is valid and complete
                    url.end = pos;
                    complete = true;
                    break;
                case 0x005c: // \ -- character escape
                    // If not EOF or newline, add the character after the escape
                    switch (next()) {
                        case -1: // EOF
                            return;
                        case 0x000a: // line feed
                        case 0x000c: // form feed
                        case 0x000d: // carriage return
                            // Invalid
                            complete = true;
                            break;
                        default:
                            // TODO: Handle hex escape codes
                            url.value += String.fromCodePoint(current);
                            break;
                    }
                    break;
                default:
                    if (isWhitespace(current)) {
                        while (isWhitespace(next())) {
                            /* empty */
                        }
                        // Unescaped whitespace is only valid before the closing )
                        if (current === 0x0029) {
                            // URL is valid
                            url.end = pos;
                        }
                        complete = true;
                    }
                    else {
                        // Add the character to the url value
                        url.value += String.fromCodePoint(current);
                    }
                    break;
            }
            next();
        }
        // An end position indicates a URL was found
        if (url.end !== -1) {
            yield url;
        }
    }
}
/**
 * Provides the Sass importer logic to resolve relative stylesheet imports via both import and use rules
 * and also rebase any `url()` function usage within those stylesheets. The rebasing will ensure that
 * the URLs in the output of the Sass compiler reflect the final filesystem location of the output CSS file.
 */
class RelativeUrlRebasingImporter extends UrlRebasingImporter {
    constructor(entryDirectory, directoryCache = new Map(), rebaseSourceMaps) {
        super(entryDirectory, rebaseSourceMaps);
        this.directoryCache = directoryCache;
    }
    canonicalize(url, options) {
        return this.resolveImport(url, options.fromImport, true);
    }
    /**
     * Attempts to resolve a provided URL to a stylesheet file using the Sass compiler's resolution algorithm.
     * Based on https://github.com/sass/dart-sass/blob/44d6bb6ac72fe6b93f5bfec371a1fffb18e6b76d/lib/src/importer/utils.dart
     * @param url The file protocol URL to resolve.
     * @param fromImport If true, URL was from an import rule; otherwise from a use rule.
     * @param checkDirectory If true, try checking for a directory with the base name containing an index file.
     * @returns A full resolved URL of the stylesheet file or `null` if not found.
     */
    resolveImport(url, fromImport, checkDirectory) {
        var _a;
        let stylesheetPath;
        try {
            stylesheetPath = (0, node_url_1.fileURLToPath)(url);
        }
        catch (_b) {
            // Only file protocol URLs are supported by this importer
            return null;
        }
        const directory = (0, node_path_1.dirname)(stylesheetPath);
        const extension = (0, node_path_1.extname)(stylesheetPath);
        const hasStyleExtension = extension === '.scss' || extension === '.sass' || extension === '.css';
        // Remove the style extension if present to allow adding the `.import` suffix
        const filename = (0, node_path_1.basename)(stylesheetPath, hasStyleExtension ? extension : undefined);
        let entries;
        try {
            entries = this.directoryCache.get(directory);
            if (!entries) {
                entries = (0, node_fs_1.readdirSync)(directory, { withFileTypes: true });
                this.directoryCache.set(directory, entries);
            }
        }
        catch (_c) {
            return null;
        }
        const importPotentials = new Set();
        const defaultPotentials = new Set();
        if (hasStyleExtension) {
            if (fromImport) {
                importPotentials.add(filename + '.import' + extension);
                importPotentials.add('_' + filename + '.import' + extension);
            }
            defaultPotentials.add(filename + extension);
            defaultPotentials.add('_' + filename + extension);
        }
        else {
            if (fromImport) {
                importPotentials.add(filename + '.import.scss');
                importPotentials.add(filename + '.import.sass');
                importPotentials.add(filename + '.import.css');
                importPotentials.add('_' + filename + '.import.scss');
                importPotentials.add('_' + filename + '.import.sass');
                importPotentials.add('_' + filename + '.import.css');
            }
            defaultPotentials.add(filename + '.scss');
            defaultPotentials.add(filename + '.sass');
            defaultPotentials.add(filename + '.css');
            defaultPotentials.add('_' + filename + '.scss');
            defaultPotentials.add('_' + filename + '.sass');
            defaultPotentials.add('_' + filename + '.css');
        }
        const foundDefaults = [];
        const foundImports = [];
        let hasPotentialIndex = false;
        for (const entry of entries) {
            // Record if the name should be checked as a directory with an index file
            if (checkDirectory && !hasStyleExtension && entry.name === filename && entry.isDirectory()) {
                hasPotentialIndex = true;
            }
            if (!entry.isFile()) {
                continue;
            }
            if (importPotentials.has(entry.name)) {
                foundImports.push((0, node_path_1.join)(directory, entry.name));
            }
            if (defaultPotentials.has(entry.name)) {
                foundDefaults.push((0, node_path_1.join)(directory, entry.name));
            }
        }
        // `foundImports` will only contain elements if `options.fromImport` is true
        const result = (_a = this.checkFound(foundImports)) !== null && _a !== void 0 ? _a : this.checkFound(foundDefaults);
        if (result === null && hasPotentialIndex) {
            // Check for index files using filename as a directory
            return this.resolveImport(url + '/index', fromImport, false);
        }
        return result;
    }
    /**
     * Checks an array of potential stylesheet files to determine if there is a valid
     * stylesheet file. More than one discovered file may indicate an error.
     * @param found An array of discovered stylesheet files.
     * @returns A fully resolved URL for a stylesheet file or `null` if not found.
     * @throws If there are ambiguous files discovered.
     */
    checkFound(found) {
        if (found.length === 0) {
            // Not found
            return null;
        }
        // More than one found file may be an error
        if (found.length > 1) {
            // Presence of CSS files alongside a Sass file does not cause an error
            const foundWithoutCss = found.filter((element) => (0, node_path_1.extname)(element) !== '.css');
            // If the length is zero then there are two or more css files
            // If the length is more than one than there are two or more sass/scss files
            if (foundWithoutCss.length !== 1) {
                throw new Error('Ambiguous import detected.');
            }
            // Return the non-CSS file (sass/scss files have priority)
            // https://github.com/sass/dart-sass/blob/44d6bb6ac72fe6b93f5bfec371a1fffb18e6b76d/lib/src/importer/utils.dart#L44-L47
            return (0, node_url_1.pathToFileURL)(foundWithoutCss[0]);
        }
        return (0, node_url_1.pathToFileURL)(found[0]);
    }
}
exports.RelativeUrlRebasingImporter = RelativeUrlRebasingImporter;
/**
 * Provides the Sass importer logic to resolve module (npm package) stylesheet imports via both import and
 * use rules and also rebase any `url()` function usage within those stylesheets. The rebasing will ensure that
 * the URLs in the output of the Sass compiler reflect the final filesystem location of the output CSS file.
 */
class ModuleUrlRebasingImporter extends RelativeUrlRebasingImporter {
    constructor(entryDirectory, directoryCache, rebaseSourceMaps, finder) {
        super(entryDirectory, directoryCache, rebaseSourceMaps);
        this.finder = finder;
    }
    canonicalize(url, options) {
        if (url.startsWith('file://')) {
            return super.canonicalize(url, options);
        }
        const result = this.finder(url, options);
        return result ? super.canonicalize(result.href, options) : null;
    }
}
exports.ModuleUrlRebasingImporter = ModuleUrlRebasingImporter;
/**
 * Provides the Sass importer logic to resolve load paths located stylesheet imports via both import and
 * use rules and also rebase any `url()` function usage within those stylesheets. The rebasing will ensure that
 * the URLs in the output of the Sass compiler reflect the final filesystem location of the output CSS file.
 */
class LoadPathsUrlRebasingImporter extends RelativeUrlRebasingImporter {
    constructor(entryDirectory, directoryCache, rebaseSourceMaps, loadPaths) {
        super(entryDirectory, directoryCache, rebaseSourceMaps);
        this.loadPaths = loadPaths;
    }
    canonicalize(url, options) {
        if (url.startsWith('file://')) {
            return super.canonicalize(url, options);
        }
        let result = null;
        for (const loadPath of this.loadPaths) {
            result = super.canonicalize((0, node_url_1.pathToFileURL)((0, node_path_1.join)(loadPath, url)).href, options);
            if (result !== null) {
                break;
            }
        }
        return result;
    }
}
exports.LoadPathsUrlRebasingImporter = LoadPathsUrlRebasingImporter;
/**
 * Workaround for Sass not calling instance methods with `this`.
 * The `canonicalize` and `load` methods will be bound to the class instance.
 * @param importer A Sass importer to bind.
 * @returns The bound Sass importer.
 */
function sassBindWorkaround(importer) {
    importer.canonicalize = importer.canonicalize.bind(importer);
    importer.load = importer.load.bind(importer);
    return importer;
}
exports.sassBindWorkaround = sassBindWorkaround;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmViYXNpbmctaW1wb3J0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9zYXNzL3JlYmFzaW5nLWltcG9ydGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILGdFQUF1QztBQUN2QyxxQ0FBNEQ7QUFDNUQseUNBQXVFO0FBQ3ZFLHVDQUF3RDtBQUd4RDs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBZSxtQkFBbUI7SUFDaEM7Ozs7T0FJRztJQUNILFlBQ1UsY0FBc0IsRUFDdEIsZ0JBQTRDO1FBRDVDLG1CQUFjLEdBQWQsY0FBYyxDQUFRO1FBQ3RCLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBNEI7SUFDbkQsQ0FBQztJQUlKLElBQUksQ0FBQyxZQUFpQjtRQUNwQixNQUFNLGNBQWMsR0FBRyxJQUFBLHdCQUFhLEVBQUMsWUFBWSxDQUFDLENBQUM7UUFDbkQsTUFBTSxtQkFBbUIsR0FBRyxJQUFBLG1CQUFPLEVBQUMsY0FBYyxDQUFDLENBQUM7UUFDcEQsSUFBSSxRQUFRLEdBQUcsSUFBQSxzQkFBWSxFQUFDLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUVyRCxpQ0FBaUM7UUFDakMsSUFBSSxlQUFlLENBQUM7UUFDcEIsS0FBSyxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxRQUFRLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDdEQsNENBQTRDO1lBQzVDLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDL0MsU0FBUzthQUNWO1lBRUQsMkRBQTJEO1lBQzNELElBQUkscUNBQXFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUNyRCxTQUFTO2FBQ1Y7WUFF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QU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7Q0FDRjtBQXpCRCxvRUF5QkM7QUFFRDs7Ozs7R0FLRztBQUNILFNBQWdCLGtCQUFrQixDQUFxQixRQUFXO0lBQ2hFLFFBQVEsQ0FBQyxZQUFZLEdBQUcsUUFBUSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDN0QsUUFBUSxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUU3QyxPQUFPLFFBQVEsQ0FBQztBQUNsQixDQUFDO0FBTEQsZ0RBS0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgUmF3U291cmNlTWFwIH0gZnJvbSAnQGFtcHByb2plY3QvcmVtYXBwaW5nJztcbmltcG9ydCBNYWdpY1N0cmluZyBmcm9tICdtYWdpYy1zdHJpbmcnO1xuaW1wb3J0IHsgRGlyZW50LCByZWFkRmlsZVN5bmMsIHJlYWRkaXJTeW5jIH0gZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSwgZXh0bmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0eXBlIHsgRmlsZUltcG9ydGVyLCBJbXBvcnRlciwgSW1wb3J0ZXJSZXN1bHQsIFN5bnRheCB9IGZyb20gJ3Nhc3MnO1xuXG4vKipcbiAqIEEgU2FzcyBJbXBvcnRlciBiYXNlIGNsYXNzIHRoYXQgcHJvdmlkZXMgdGhlIGxvYWQgbG9naWMgdG8gcmViYXNlIGFsbCBgdXJsKClgIGZ1bmN0aW9uc1xuICogd2l0aGluIGEgc3R5bGVzaGVldC4gVGhlIHJlYmFzaW5nIHdpbGwgZW5zdXJlIHRoYXQgdGhlIFVSTHMgaW4gdGhlIG91dHB1dCBvZiB0aGUgU2FzcyBjb21waWxlclxuICogcmVmbGVjdCB0aGUgZmluYWwgZmlsZXN5c3RlbSBsb2NhdGlvbiBvZiB0aGUgb3V0cHV0IENTUyBmaWxlLlxuICpcbiAqIFRoaXMgY2xhc3MgcHJvdmlkZXMgdGhlIGNvcmUgb2YgdGhlIHJlYmFzaW5nIGZ1bmN0aW9uYWxpdHkuIFRvIGVuc3VyZSB0aGF0IGVhY2ggZmlsZSBpcyBwcm9jZXNzZWRcbiAqIGJ5IHRoaXMgaW1wb3J0ZXIncyBsb2FkIGltcGxlbWVudGF0aW9uLCB0aGUgU2FzcyBjb21waWxlciByZXF1aXJlcyB0aGUgaW1wb3J0ZXIncyBjYW5vbmljYWxpemVcbiAqIGZ1bmN0aW9uIHRvIHJldHVybiBhIG5vbi1udWxsIHZhbHVlIHdpdGggdGhlIHJlc29sdmVkIGxvY2F0aW9uIG9mIHRoZSByZXF1ZXN0ZWQgc3R5bGVzaGVldC5cbiAqIENvbmNyZXRlIGltcGxlbWVudGF0aW9ucyBvZiB0aGlzIGNsYXNzIG11c3QgcHJvdmlkZSB0aGlzIGNhbm9uaWNhbGl6ZSBmdW5jdGlvbmFsaXR5IGZvciByZWJhc2luZ1xuICogdG8gYmUgZWZmZWN0aXZlLlxuICovXG5hYnN0cmFjdCBjbGFzcyBVcmxSZWJhc2luZ0ltcG9ydGVyIGltcGxlbWVudHMgSW1wb3J0ZXI8J3N5bmMnPiB7XG4gIC8qKlxuICAgKiBAcGFyYW0gZW50cnlEaXJlY3RvcnkgVGhlIGRpcmVjdG9yeSBvZiB0aGUgZW50cnkgc3R5bGVzaGVldCB0aGF0IHdhcyBwYXNzZWQgdG8gdGhlIFNhc3MgY29tcGlsZXIuXG4gICAqIEBwYXJhbSByZWJhc2VTb3VyY2VNYXBzIFdoZW4gcHJvdmlkZWQsIHJlYmFzZWQgZmlsZXMgd2lsbCBoYXZlIGFuIGludGVybWVkaWF0ZSBzb3VyY2VtYXAgYWRkZWQgdG8gdGhlIE1hcFxuICAgKiB3aGljaCBjYW4gYmUgdXNlZCB0byBnZW5lcmF0ZSBhIGZpbmFsIHNvdXJjZW1hcCB0aGF0IGNvbnRhaW5zIG9yaWdpbmFsIHNvdXJjZXMuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGVudHJ5RGlyZWN0b3J5OiBzdHJpbmcsXG4gICAgcHJpdmF0ZSByZWJhc2VTb3VyY2VNYXBzPzogTWFwPHN0cmluZywgUmF3U291cmNlTWFwPixcbiAgKSB7fVxuXG4gIGFic3RyYWN0IGNhbm9uaWNhbGl6ZSh1cmw6IHN0cmluZywgb3B0aW9uczogeyBmcm9tSW1wb3J0OiBib29sZWFuIH0pOiBVUkwgfCBudWxsO1xuXG4gIGxvYWQoY2Fub25pY2FsVXJsOiBVUkwpOiBJbXBvcnRlclJlc3VsdCB8IG51bGwge1xuICAgIGNvbnN0IHN0eWxlc2hlZXRQYXRoID0gZmlsZVVSTFRvUGF0aChjYW5vbmljYWxVcmwpO1xuICAgIGNvbnN0IHN0eWxlc2hlZXREaXJlY3RvcnkgPSBkaXJuYW1lKHN0eWxlc2hlZXRQYXRoKTtcbiAgICBsZXQgY29udGVudHMgPSByZWFkRmlsZVN5bmMoc3R5bGVzaGVldFBhdGgsICd1dGYtOCcpO1xuXG4gICAgLy8gUmViYXNlIGFueSBVUkxzIHRoYXQgYXJlIGZvdW5kXG4gICAgbGV0IHVwZGF0ZWRDb250ZW50cztcbiAgICBmb3IgKGNvbnN0IHsgc3RhcnQsIGVuZCwgdmFsdWUgfSBvZiBmaW5kVXJscyhjb250ZW50cykpIHtcbiAgICAgIC8vIFNraXAgaWYgdmFsdWUgaXMgZW1wdHkgb3IgYSBTYXNzIHZhcmlhYmxlXG4gICAgICBpZiAodmFsdWUubGVuZ3RoID09PSAwIHx8IHZhbHVlLnN0YXJ0c1dpdGgoJyQnKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gU2tpcCBpZiByb290LXJlbGF0aXZlLCBhYnNvbHV0ZSBvciBwcm90b2NvbCByZWxhdGl2ZSB1cmxcbiAgICAgIGlmICgvXigoPzpcXHcrOik/XFwvXFwvfGRhdGE6fGNocm9tZTp8I3xcXC8pLy50ZXN0KHZhbHVlKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmViYXNlZFBhdGggPSByZWxhdGl2ZSh0aGlzLmVudHJ5RGlyZWN0b3J5LCBqb2luKHN0eWxlc2hlZXREaXJlY3RvcnksIHZhbHVlKSk7XG5cbiAgICAgIC8vIE5vcm1hbGl6ZSBwYXRoIHNlcGFyYXRvcnMgYW5kIGVzY2FwZSBjaGFyYWN0ZXJzXG4gICAgICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9DU1MvdXJsI3N5bnRheFxuICAgICAgY29uc3QgcmViYXNlZFVybCA9ICcuLycgKyByZWJhc2VkUGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJykucmVwbGFjZSgvWygpXFxzJ1wiXS9nLCAnXFxcXCQmJyk7XG5cbiAgICAgIHVwZGF0ZWRDb250ZW50cyA/Pz0gbmV3IE1hZ2ljU3RyaW5nKGNvbnRlbnRzKTtcbiAgICAgIHVwZGF0ZWRDb250ZW50cy51cGRhdGUoc3RhcnQsIGVuZCwgcmViYXNlZFVybCk7XG4gICAgfVxuXG4gICAgaWYgKHVwZGF0ZWRDb250ZW50cykge1xuICAgICAgY29udGVudHMgPSB1cGRhdGVkQ29udGVudHMudG9TdHJpbmcoKTtcbiAgICAgIGlmICh0aGlzLnJlYmFzZVNvdXJjZU1hcHMpIHtcbiAgICAgICAgLy8gR2VuZXJhdGUgYW4gaW50ZXJtZWRpYXRlIHNvdXJjZSBtYXAgZm9yIHRoZSByZWJhc2luZyBjaGFuZ2VzXG4gICAgICAgIGNvbnN0IG1hcCA9IHVwZGF0ZWRDb250ZW50cy5nZW5lcmF0ZU1hcCh7XG4gICAgICAgICAgaGlyZXM6IHRydWUsXG4gICAgICAgICAgaW5jbHVkZUNvbnRlbnQ6IHRydWUsXG4gICAgICAgICAgc291cmNlOiBjYW5vbmljYWxVcmwuaHJlZixcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucmViYXNlU291cmNlTWFwcy5zZXQoY2Fub25pY2FsVXJsLmhyZWYsIG1hcCBhcyBSYXdTb3VyY2VNYXApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxldCBzeW50YXg6IFN5bnRheCB8IHVuZGVmaW5lZDtcbiAgICBzd2l0Y2ggKGV4dG5hbWUoc3R5bGVzaGVldFBhdGgpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgIGNhc2UgJ2Nzcyc6XG4gICAgICAgIHN5bnRheCA9ICdjc3MnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3Nhc3MnOlxuICAgICAgICBzeW50YXggPSAnaW5kZW50ZWQnO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHN5bnRheCA9ICdzY3NzJztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRlbnRzLFxuICAgICAgc3ludGF4LFxuICAgICAgc291cmNlTWFwVXJsOiBjYW5vbmljYWxVcmwsXG4gICAgfTtcbiAgfVxufVxuXG4vKipcbiAqIERldGVybWluZXMgaWYgYSB1bmljb2RlIGNvZGUgcG9pbnQgaXMgYSBDU1Mgd2hpdGVzcGFjZSBjaGFyYWN0ZXIuXG4gKiBAcGFyYW0gY29kZSBUaGUgdW5pY29kZSBjb2RlIHBvaW50IHRvIHRlc3QuXG4gKiBAcmV0dXJucyB0cnVlLCBpZiB0aGUgY29kZSBwb2ludCBpcyBDU1Mgd2hpdGVzcGFjZTsgZmFsc2UsIG90aGVyd2lzZS5cbiAqL1xuZnVuY3Rpb24gaXNXaGl0ZXNwYWNlKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAvLyBCYXNlZCBvbiBodHRwczovL3d3dy53My5vcmcvVFIvY3NzLXN5bnRheC0zLyN3aGl0ZXNwYWNlXG4gIHN3aXRjaCAoY29kZSkge1xuICAgIGNhc2UgMHgwMDA5OiAvLyB0YWJcbiAgICBjYXNlIDB4MDAyMDogLy8gc3BhY2VcbiAgICBjYXNlIDB4MDAwYTogLy8gbGluZSBmZWVkXG4gICAgY2FzZSAweDAwMGM6IC8vIGZvcm0gZmVlZFxuICAgIGNhc2UgMHgwMDBkOiAvLyBjYXJyaWFnZSByZXR1cm5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLyoqXG4gKiBTY2FucyBhIENTUyBvciBTYXNzIGZpbGUgYW5kIGxvY2F0ZXMgYWxsIHZhbGlkIHVybCBmdW5jdGlvbiB2YWx1ZXMgYXMgZGVmaW5lZCBieSB0aGUgQ1NTXG4gKiBzeW50YXggc3BlY2lmaWNhdGlvbi5cbiAqIEBwYXJhbSBjb250ZW50cyBBIHN0cmluZyBjb250YWluaW5nIGEgQ1NTIG9yIFNhc3MgZmlsZSB0byBzY2FuLlxuICogQHJldHVybnMgQW4gaXRlcmFibGUgdGhhdCB5aWVsZHMgZWFjaCBDU1MgdXJsIGZ1bmN0aW9uIHZhbHVlIGZvdW5kLlxuICovXG5mdW5jdGlvbiogZmluZFVybHMoY29udGVudHM6IHN0cmluZyk6IEl0ZXJhYmxlPHsgc3RhcnQ6IG51bWJlcjsgZW5kOiBudW1iZXI7IHZhbHVlOiBzdHJpbmcgfT4ge1xuICBsZXQgcG9zID0gMDtcbiAgbGV0IHdpZHRoID0gMTtcbiAgbGV0IGN1cnJlbnQgPSAtMTtcbiAgY29uc3QgbmV4dCA9ICgpID0+IHtcbiAgICBwb3MgKz0gd2lkdGg7XG4gICAgY3VycmVudCA9IGNvbnRlbnRzLmNvZGVQb2ludEF0KHBvcykgPz8gLTE7XG4gICAgd2lkdGggPSBjdXJyZW50ID4gMHhmZmZmID8gMiA6IDE7XG5cbiAgICByZXR1cm4gY3VycmVudDtcbiAgfTtcblxuICAvLyBCYXNlZCBvbiBodHRwczovL3d3dy53My5vcmcvVFIvY3NzLXN5bnRheC0zLyNjb25zdW1lLWlkZW50LWxpa2UtdG9rZW5cbiAgd2hpbGUgKChwb3MgPSBjb250ZW50cy5pbmRleE9mKCd1cmwoJywgcG9zKSkgIT09IC0xKSB7XG4gICAgLy8gU2V0IHRvIHBvc2l0aW9uIG9mIHRoZSAoXG4gICAgcG9zICs9IDM7XG4gICAgd2lkdGggPSAxO1xuXG4gICAgLy8gQ29uc3VtZSBhbGwgbGVhZGluZyB3aGl0ZXNwYWNlXG4gICAgd2hpbGUgKGlzV2hpdGVzcGFjZShuZXh0KCkpKSB7XG4gICAgICAvKiBlbXB0eSAqL1xuICAgIH1cblxuICAgIC8vIEluaXRpYWxpemUgVVJMIHN0YXRlXG4gICAgY29uc3QgdXJsID0geyBzdGFydDogcG9zLCBlbmQ6IC0xLCB2YWx1ZTogJycgfTtcbiAgICBsZXQgY29tcGxldGUgPSBmYWxzZTtcblxuICAgIC8vIElmIFwiIG9yICcsIHRoZW4gY29uc3VtZSB0aGUgdmFsdWUgYXMgYSBzdHJpbmdcbiAgICBpZiAoY3VycmVudCA9PT0gMHgwMDIyIHx8IGN1cnJlbnQgPT09IDB4MDAyNykge1xuICAgICAgY29uc3QgZW5kaW5nID0gY3VycmVudDtcbiAgICAgIC8vIEJhc2VkIG9uIGh0dHBzOi8vd3d3LnczLm9yZy9UUi9jc3Mtc3ludGF4LTMvI2NvbnN1bWUtc3RyaW5nLXRva2VuXG4gICAgICB3aGlsZSAoIWNvbXBsZXRlKSB7XG4gICAgICAgIHN3aXRjaCAobmV4dCgpKSB7XG4gICAgICAgICAgY2FzZSAtMTogLy8gRU9GXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgY2FzZSAweDAwMGE6IC8vIGxpbmUgZmVlZFxuICAgICAgICAgIGNhc2UgMHgwMDBjOiAvLyBmb3JtIGZlZWRcbiAgICAgICAgICBjYXNlIDB4MDAwZDogLy8gY2FycmlhZ2UgcmV0dXJuXG4gICAgICAgICAgICAvLyBJbnZhbGlkXG4gICAgICAgICAgICBjb21wbGV0ZSA9IHRydWU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDB4MDA1YzogLy8gXFwgLS0gY2hhcmFjdGVyIGVzY2FwZVxuICAgICAgICAgICAgLy8gSWYgbm90IEVPRiBvciBuZXdsaW5lLCBhZGQgdGhlIGNoYXJhY3RlciBhZnRlciB0aGUgZXNjYXBlXG4gICAgICAgICAgICBzd2l0Y2ggKG5leHQoKSkge1xuICAgICAgICAgICAgICBjYXNlIC0xOlxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgY2FzZSAweDAwMGE6IC8vIGxpbmUgZmVlZFxuICAgICAgICAgICAgICBjYXNlIDB4MDAwYzogLy8gZm9ybSBmZWVkXG4gICAgICAgICAgICAgIGNhc2UgMHgwMDBkOiAvLyBjYXJyaWFnZSByZXR1cm5cbiAgICAgICAgICAgICAgICAvLyBTa2lwIHdoZW4gaW5zaWRlIGEgc3RyaW5nXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgLy8gVE9ETzogSGFuZGxlIGhleCBlc2NhcGUgY29kZXNcbiAgICAgICAgICAgICAgICB1cmwudmFsdWUgKz0gU3RyaW5nLmZyb21Db2RlUG9pbnQoY3VycmVudCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIGVuZGluZzpcbiAgICAgICAgICAgIC8vIEZ1bGwgc3RyaW5nIHBvc2l0aW9uIHNob3VsZCBpbmNsdWRlIHRoZSBxdW90ZXMgZm9yIHJlcGxhY2VtZW50XG4gICAgICAgICAgICB1cmwuZW5kID0gcG9zICsgMTtcbiAgICAgICAgICAgIGNvbXBsZXRlID0gdHJ1ZTtcbiAgICAgICAgICAgIHlpZWxkIHVybDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB1cmwudmFsdWUgKz0gU3RyaW5nLmZyb21Db2RlUG9pbnQoY3VycmVudCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBuZXh0KCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBCYXNlZCBvbiBodHRwczovL3d3dy53My5vcmcvVFIvY3NzLXN5bnRheC0zLyNjb25zdW1lLXVybC10b2tlblxuICAgIHdoaWxlICghY29tcGxldGUpIHtcbiAgICAgIHN3aXRjaCAoY3VycmVudCkge1xuICAgICAgICBjYXNlIC0xOiAvLyBFT0ZcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNhc2UgMHgwMDIyOiAvLyBcIlxuICAgICAgICBjYXNlIDB4MDAyNzogLy8gJ1xuICAgICAgICBjYXNlIDB4MDAyODogLy8gKFxuICAgICAgICAgIC8vIEludmFsaWRcbiAgICAgICAgICBjb21wbGV0ZSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMHgwMDI5OiAvLyApXG4gICAgICAgICAgLy8gVVJMIGlzIHZhbGlkIGFuZCBjb21wbGV0ZVxuICAgICAgICAgIHVybC5lbmQgPSBwb3M7XG4gICAgICAgICAgY29tcGxldGUgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDB4MDA1YzogLy8gXFwgLS0gY2hhcmFjdGVyIGVzY2FwZVxuICAgICAgICAgIC8vIElmIG5vdCBFT0Ygb3IgbmV3bGluZSwgYWRkIHRoZSBjaGFyYWN0ZXIgYWZ0ZXIgdGhlIGVzY2FwZVxuICAgICAgICAgIHN3aXRjaCAobmV4dCgpKSB7XG4gICAgICAgICAgICBjYXNlIC0xOiAvLyBFT0ZcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgY2FzZSAweDAwMGE6IC8vIGxpbmUgZmVlZFxuICAgICAgICAgICAgY2FzZSAweDAwMGM6IC8vIGZvcm0gZmVlZFxuICAgICAgICAgICAgY2FzZSAweDAwMGQ6IC8vIGNhcnJpYWdlIHJldHVyblxuICAgICAgICAgICAgICAvLyBJbnZhbGlkXG4gICAgICAgICAgICAgIGNvbXBsZXRlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAvLyBUT0RPOiBIYW5kbGUgaGV4IGVzY2FwZSBjb2Rlc1xuICAgICAgICAgICAgICB1cmwudmFsdWUgKz0gU3RyaW5nLmZyb21Db2RlUG9pbnQoY3VycmVudCk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBpZiAoaXNXaGl0ZXNwYWNlKGN1cnJlbnQpKSB7XG4gICAgICAgICAgICB3aGlsZSAoaXNXaGl0ZXNwYWNlKG5leHQoKSkpIHtcbiAgICAgICAgICAgICAgLyogZW1wdHkgKi9cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFVuZXNjYXBlZCB3aGl0ZXNwYWNlIGlzIG9ubHkgdmFsaWQgYmVmb3JlIHRoZSBjbG9zaW5nIClcbiAgICAgICAgICAgIGlmIChjdXJyZW50ID09PSAweDAwMjkpIHtcbiAgICAgICAgICAgICAgLy8gVVJMIGlzIHZhbGlkXG4gICAgICAgICAgICAgIHVybC5lbmQgPSBwb3M7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb21wbGV0ZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEFkZCB0aGUgY2hhcmFjdGVyIHRvIHRoZSB1cmwgdmFsdWVcbiAgICAgICAgICAgIHVybC52YWx1ZSArPSBTdHJpbmcuZnJvbUNvZGVQb2ludChjdXJyZW50KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBuZXh0KCk7XG4gICAgfVxuXG4gICAgLy8gQW4gZW5kIHBvc2l0aW9uIGluZGljYXRlcyBhIFVSTCB3YXMgZm91bmRcbiAgICBpZiAodXJsLmVuZCAhPT0gLTEpIHtcbiAgICAgIHlpZWxkIHVybDtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBQcm92aWRlcyB0aGUgU2FzcyBpbXBvcnRlciBsb2dpYyB0byByZXNvbHZlIHJlbGF0aXZlIHN0eWxlc2hlZXQgaW1wb3J0cyB2aWEgYm90aCBpbXBvcnQgYW5kIHVzZSBydWxlc1xuICogYW5kIGFsc28gcmViYXNlIGFueSBgdXJsKClgIGZ1bmN0aW9uIHVzYWdlIHdpdGhpbiB0aG9zZSBzdHlsZXNoZWV0cy4gVGhlIHJlYmFzaW5nIHdpbGwgZW5zdXJlIHRoYXRcbiAqIHRoZSBVUkxzIGluIHRoZSBvdXRwdXQgb2YgdGhlIFNhc3MgY29tcGlsZXIgcmVmbGVjdCB0aGUgZmluYWwgZmlsZXN5c3RlbSBsb2NhdGlvbiBvZiB0aGUgb3V0cHV0IENTUyBmaWxlLlxuICovXG5leHBvcnQgY2xhc3MgUmVsYXRpdmVVcmxSZWJhc2luZ0ltcG9ydGVyIGV4dGVuZHMgVXJsUmViYXNpbmdJbXBvcnRlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGVudHJ5RGlyZWN0b3J5OiBzdHJpbmcsXG4gICAgcHJpdmF0ZSBkaXJlY3RvcnlDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBEaXJlbnRbXT4oKSxcbiAgICByZWJhc2VTb3VyY2VNYXBzPzogTWFwPHN0cmluZywgUmF3U291cmNlTWFwPixcbiAgKSB7XG4gICAgc3VwZXIoZW50cnlEaXJlY3RvcnksIHJlYmFzZVNvdXJjZU1hcHMpO1xuICB9XG5cbiAgY2Fub25pY2FsaXplKHVybDogc3RyaW5nLCBvcHRpb25zOiB7IGZyb21JbXBvcnQ6IGJvb2xlYW4gfSk6IFVSTCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLnJlc29sdmVJbXBvcnQodXJsLCBvcHRpb25zLmZyb21JbXBvcnQsIHRydWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEF0dGVtcHRzIHRvIHJlc29sdmUgYSBwcm92aWRlZCBVUkwgdG8gYSBzdHlsZXNoZWV0IGZpbGUgdXNpbmcgdGhlIFNhc3MgY29tcGlsZXIncyByZXNvbHV0aW9uIGFsZ29yaXRobS5cbiAgICogQmFzZWQgb24gaHR0cHM6Ly9naXRodWIuY29tL3Nhc3MvZGFydC1zYXNzL2Jsb2IvNDRkNmJiNmFjNzJmZTZiOTNmNWJmZWMzNzFhMWZmZmIxOGU2Yjc2ZC9saWIvc3JjL2ltcG9ydGVyL3V0aWxzLmRhcnRcbiAgICogQHBhcmFtIHVybCBUaGUgZmlsZSBwcm90b2NvbCBVUkwgdG8gcmVzb2x2ZS5cbiAgICogQHBhcmFtIGZyb21JbXBvcnQgSWYgdHJ1ZSwgVVJMIHdhcyBmcm9tIGFuIGltcG9ydCBydWxlOyBvdGhlcndpc2UgZnJvbSBhIHVzZSBydWxlLlxuICAgKiBAcGFyYW0gY2hlY2tEaXJlY3RvcnkgSWYgdHJ1ZSwgdHJ5IGNoZWNraW5nIGZvciBhIGRpcmVjdG9yeSB3aXRoIHRoZSBiYXNlIG5hbWUgY29udGFpbmluZyBhbiBpbmRleCBmaWxlLlxuICAgKiBAcmV0dXJucyBBIGZ1bGwgcmVzb2x2ZWQgVVJMIG9mIHRoZSBzdHlsZXNoZWV0IGZpbGUgb3IgYG51bGxgIGlmIG5vdCBmb3VuZC5cbiAgICovXG4gIHByaXZhdGUgcmVzb2x2ZUltcG9ydCh1cmw6IHN0cmluZywgZnJvbUltcG9ydDogYm9vbGVhbiwgY2hlY2tEaXJlY3Rvcnk6IGJvb2xlYW4pOiBVUkwgfCBudWxsIHtcbiAgICBsZXQgc3R5bGVzaGVldFBhdGg7XG4gICAgdHJ5IHtcbiAgICAgIHN0eWxlc2hlZXRQYXRoID0gZmlsZVVSTFRvUGF0aCh1cmwpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gT25seSBmaWxlIHByb3RvY29sIFVSTHMgYXJlIHN1cHBvcnRlZCBieSB0aGlzIGltcG9ydGVyXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBkaXJlY3RvcnkgPSBkaXJuYW1lKHN0eWxlc2hlZXRQYXRoKTtcbiAgICBjb25zdCBleHRlbnNpb24gPSBleHRuYW1lKHN0eWxlc2hlZXRQYXRoKTtcbiAgICBjb25zdCBoYXNTdHlsZUV4dGVuc2lvbiA9XG4gICAgICBleHRlbnNpb24gPT09ICcuc2NzcycgfHwgZXh0ZW5zaW9uID09PSAnLnNhc3MnIHx8IGV4dGVuc2lvbiA9PT0gJy5jc3MnO1xuICAgIC8vIFJlbW92ZSB0aGUgc3R5bGUgZXh0ZW5zaW9uIGlmIHByZXNlbnQgdG8gYWxsb3cgYWRkaW5nIHRoZSBgLmltcG9ydGAgc3VmZml4XG4gICAgY29uc3QgZmlsZW5hbWUgPSBiYXNlbmFtZShzdHlsZXNoZWV0UGF0aCwgaGFzU3R5bGVFeHRlbnNpb24gPyBleHRlbnNpb24gOiB1bmRlZmluZWQpO1xuXG4gICAgbGV0IGVudHJpZXM7XG4gICAgdHJ5IHtcbiAgICAgIGVudHJpZXMgPSB0aGlzLmRpcmVjdG9yeUNhY2hlLmdldChkaXJlY3RvcnkpO1xuICAgICAgaWYgKCFlbnRyaWVzKSB7XG4gICAgICAgIGVudHJpZXMgPSByZWFkZGlyU3luYyhkaXJlY3RvcnksIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcbiAgICAgICAgdGhpcy5kaXJlY3RvcnlDYWNoZS5zZXQoZGlyZWN0b3J5LCBlbnRyaWVzKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGltcG9ydFBvdGVudGlhbHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBkZWZhdWx0UG90ZW50aWFscyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgaWYgKGhhc1N0eWxlRXh0ZW5zaW9uKSB7XG4gICAgICBpZiAoZnJvbUltcG9ydCkge1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuaW1wb3J0JyArIGV4dGVuc2lvbik7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5pbXBvcnQnICsgZXh0ZW5zaW9uKTtcbiAgICAgIH1cbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArIGV4dGVuc2lvbik7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyBleHRlbnNpb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZnJvbUltcG9ydCkge1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuaW1wb3J0LnNjc3MnKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLmltcG9ydC5zYXNzJyk7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5pbXBvcnQuY3NzJyk7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5pbXBvcnQuc2NzcycpO1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuaW1wb3J0LnNhc3MnKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLmltcG9ydC5jc3MnKTtcbiAgICAgIH1cbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuc2NzcycpO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5zYXNzJyk7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLmNzcycpO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5zY3NzJyk7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLnNhc3MnKTtcbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuY3NzJyk7XG4gICAgfVxuXG4gICAgY29uc3QgZm91bmREZWZhdWx0czogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBmb3VuZEltcG9ydHM6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IGhhc1BvdGVudGlhbEluZGV4ID0gZmFsc2U7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgICAvLyBSZWNvcmQgaWYgdGhlIG5hbWUgc2hvdWxkIGJlIGNoZWNrZWQgYXMgYSBkaXJlY3Rvcnkgd2l0aCBhbiBpbmRleCBmaWxlXG4gICAgICBpZiAoY2hlY2tEaXJlY3RvcnkgJiYgIWhhc1N0eWxlRXh0ZW5zaW9uICYmIGVudHJ5Lm5hbWUgPT09IGZpbGVuYW1lICYmIGVudHJ5LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgaGFzUG90ZW50aWFsSW5kZXggPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWVudHJ5LmlzRmlsZSgpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoaW1wb3J0UG90ZW50aWFscy5oYXMoZW50cnkubmFtZSkpIHtcbiAgICAgICAgZm91bmRJbXBvcnRzLnB1c2goam9pbihkaXJlY3RvcnksIGVudHJ5Lm5hbWUpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGRlZmF1bHRQb3RlbnRpYWxzLmhhcyhlbnRyeS5uYW1lKSkge1xuICAgICAgICBmb3VuZERlZmF1bHRzLnB1c2goam9pbihkaXJlY3RvcnksIGVudHJ5Lm5hbWUpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBgZm91bmRJbXBvcnRzYCB3aWxsIG9ubHkgY29udGFpbiBlbGVtZW50cyBpZiBgb3B0aW9ucy5mcm9tSW1wb3J0YCBpcyB0cnVlXG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5jaGVja0ZvdW5kKGZvdW5kSW1wb3J0cykgPz8gdGhpcy5jaGVja0ZvdW5kKGZvdW5kRGVmYXVsdHMpO1xuXG4gICAgaWYgKHJlc3VsdCA9PT0gbnVsbCAmJiBoYXNQb3RlbnRpYWxJbmRleCkge1xuICAgICAgLy8gQ2hlY2sgZm9yIGluZGV4IGZpbGVzIHVzaW5nIGZpbGVuYW1lIGFzIGEgZGlyZWN0b3J5XG4gICAgICByZXR1cm4gdGhpcy5yZXNvbHZlSW1wb3J0KHVybCArICcvaW5kZXgnLCBmcm9tSW1wb3J0LCBmYWxzZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgYW4gYXJyYXkgb2YgcG90ZW50aWFsIHN0eWxlc2hlZXQgZmlsZXMgdG8gZGV0ZXJtaW5lIGlmIHRoZXJlIGlzIGEgdmFsaWRcbiAgICogc3R5bGVzaGVldCBmaWxlLiBNb3JlIHRoYW4gb25lIGRpc2NvdmVyZWQgZmlsZSBtYXkgaW5kaWNhdGUgYW4gZXJyb3IuXG4gICAqIEBwYXJhbSBmb3VuZCBBbiBhcnJheSBvZiBkaXNjb3ZlcmVkIHN0eWxlc2hlZXQgZmlsZXMuXG4gICAqIEByZXR1cm5zIEEgZnVsbHkgcmVzb2x2ZWQgVVJMIGZvciBhIHN0eWxlc2hlZXQgZmlsZSBvciBgbnVsbGAgaWYgbm90IGZvdW5kLlxuICAgKiBAdGhyb3dzIElmIHRoZXJlIGFyZSBhbWJpZ3VvdXMgZmlsZXMgZGlzY292ZXJlZC5cbiAgICovXG4gIHByaXZhdGUgY2hlY2tGb3VuZChmb3VuZDogc3RyaW5nW10pOiBVUkwgfCBudWxsIHtcbiAgICBpZiAoZm91bmQubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBOb3QgZm91bmRcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIE1vcmUgdGhhbiBvbmUgZm91bmQgZmlsZSBtYXkgYmUgYW4gZXJyb3JcbiAgICBpZiAoZm91bmQubGVuZ3RoID4gMSkge1xuICAgICAgLy8gUHJlc2VuY2Ugb2YgQ1NTIGZpbGVzIGFsb25nc2lkZSBhIFNhc3MgZmlsZSBkb2VzIG5vdCBjYXVzZSBhbiBlcnJvclxuICAgICAgY29uc3QgZm91bmRXaXRob3V0Q3NzID0gZm91bmQuZmlsdGVyKChlbGVtZW50KSA9PiBleHRuYW1lKGVsZW1lbnQpICE9PSAnLmNzcycpO1xuICAgICAgLy8gSWYgdGhlIGxlbmd0aCBpcyB6ZXJvIHRoZW4gdGhlcmUgYXJlIHR3byBvciBtb3JlIGNzcyBmaWxlc1xuICAgICAgLy8gSWYgdGhlIGxlbmd0aCBpcyBtb3JlIHRoYW4gb25lIHRoYW4gdGhlcmUgYXJlIHR3byBvciBtb3JlIHNhc3Mvc2NzcyBmaWxlc1xuICAgICAgaWYgKGZvdW5kV2l0aG91dENzcy5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbWJpZ3VvdXMgaW1wb3J0IGRldGVjdGVkLicpO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXR1cm4gdGhlIG5vbi1DU1MgZmlsZSAoc2Fzcy9zY3NzIGZpbGVzIGhhdmUgcHJpb3JpdHkpXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vc2Fzcy9kYXJ0LXNhc3MvYmxvYi80NGQ2YmI2YWM3MmZlNmI5M2Y1YmZlYzM3MWExZmZmYjE4ZTZiNzZkL2xpYi9zcmMvaW1wb3J0ZXIvdXRpbHMuZGFydCNMNDQtTDQ3XG4gICAgICByZXR1cm4gcGF0aFRvRmlsZVVSTChmb3VuZFdpdGhvdXRDc3NbMF0pO1xuICAgIH1cblxuICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKGZvdW5kWzBdKTtcbiAgfVxufVxuXG4vKipcbiAqIFByb3ZpZGVzIHRoZSBTYXNzIGltcG9ydGVyIGxvZ2ljIHRvIHJlc29sdmUgbW9kdWxlIChucG0gcGFja2FnZSkgc3R5bGVzaGVldCBpbXBvcnRzIHZpYSBib3RoIGltcG9ydCBhbmRcbiAqIHVzZSBydWxlcyBhbmQgYWxzbyByZWJhc2UgYW55IGB1cmwoKWAgZnVuY3Rpb24gdXNhZ2Ugd2l0aGluIHRob3NlIHN0eWxlc2hlZXRzLiBUaGUgcmViYXNpbmcgd2lsbCBlbnN1cmUgdGhhdFxuICogdGhlIFVSTHMgaW4gdGhlIG91dHB1dCBvZiB0aGUgU2FzcyBjb21waWxlciByZWZsZWN0IHRoZSBmaW5hbCBmaWxlc3lzdGVtIGxvY2F0aW9uIG9mIHRoZSBvdXRwdXQgQ1NTIGZpbGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBNb2R1bGVVcmxSZWJhc2luZ0ltcG9ydGVyIGV4dGVuZHMgUmVsYXRpdmVVcmxSZWJhc2luZ0ltcG9ydGVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgZW50cnlEaXJlY3Rvcnk6IHN0cmluZyxcbiAgICBkaXJlY3RvcnlDYWNoZTogTWFwPHN0cmluZywgRGlyZW50W10+LFxuICAgIHJlYmFzZVNvdXJjZU1hcHM6IE1hcDxzdHJpbmcsIFJhd1NvdXJjZU1hcD4gfCB1bmRlZmluZWQsXG4gICAgcHJpdmF0ZSBmaW5kZXI6IEZpbGVJbXBvcnRlcjwnc3luYyc+WydmaW5kRmlsZVVybCddLFxuICApIHtcbiAgICBzdXBlcihlbnRyeURpcmVjdG9yeSwgZGlyZWN0b3J5Q2FjaGUsIHJlYmFzZVNvdXJjZU1hcHMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2Fub25pY2FsaXplKHVybDogc3RyaW5nLCBvcHRpb25zOiB7IGZyb21JbXBvcnQ6IGJvb2xlYW4gfSk6IFVSTCB8IG51bGwge1xuICAgIGlmICh1cmwuc3RhcnRzV2l0aCgnZmlsZTovLycpKSB7XG4gICAgICByZXR1cm4gc3VwZXIuY2Fub25pY2FsaXplKHVybCwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5maW5kZXIodXJsLCBvcHRpb25zKTtcblxuICAgIHJldHVybiByZXN1bHQgPyBzdXBlci5jYW5vbmljYWxpemUocmVzdWx0LmhyZWYsIG9wdGlvbnMpIDogbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIFByb3ZpZGVzIHRoZSBTYXNzIGltcG9ydGVyIGxvZ2ljIHRvIHJlc29sdmUgbG9hZCBwYXRocyBsb2NhdGVkIHN0eWxlc2hlZXQgaW1wb3J0cyB2aWEgYm90aCBpbXBvcnQgYW5kXG4gKiB1c2UgcnVsZXMgYW5kIGFsc28gcmViYXNlIGFueSBgdXJsKClgIGZ1bmN0aW9uIHVzYWdlIHdpdGhpbiB0aG9zZSBzdHlsZXNoZWV0cy4gVGhlIHJlYmFzaW5nIHdpbGwgZW5zdXJlIHRoYXRcbiAqIHRoZSBVUkxzIGluIHRoZSBvdXRwdXQgb2YgdGhlIFNhc3MgY29tcGlsZXIgcmVmbGVjdCB0aGUgZmluYWwgZmlsZXN5c3RlbSBsb2NhdGlvbiBvZiB0aGUgb3V0cHV0IENTUyBmaWxlLlxuICovXG5leHBvcnQgY2xhc3MgTG9hZFBhdGhzVXJsUmViYXNpbmdJbXBvcnRlciBleHRlbmRzIFJlbGF0aXZlVXJsUmViYXNpbmdJbXBvcnRlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGVudHJ5RGlyZWN0b3J5OiBzdHJpbmcsXG4gICAgZGlyZWN0b3J5Q2FjaGU6IE1hcDxzdHJpbmcsIERpcmVudFtdPixcbiAgICByZWJhc2VTb3VyY2VNYXBzOiBNYXA8c3RyaW5nLCBSYXdTb3VyY2VNYXA+IHwgdW5kZWZpbmVkLFxuICAgIHByaXZhdGUgbG9hZFBhdGhzOiBJdGVyYWJsZTxzdHJpbmc+LFxuICApIHtcbiAgICBzdXBlcihlbnRyeURpcmVjdG9yeSwgZGlyZWN0b3J5Q2FjaGUsIHJlYmFzZVNvdXJjZU1hcHMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2Fub25pY2FsaXplKHVybDogc3RyaW5nLCBvcHRpb25zOiB7IGZyb21JbXBvcnQ6IGJvb2xlYW4gfSk6IFVSTCB8IG51bGwge1xuICAgIGlmICh1cmwuc3RhcnRzV2l0aCgnZmlsZTovLycpKSB7XG4gICAgICByZXR1cm4gc3VwZXIuY2Fub25pY2FsaXplKHVybCwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgbGV0IHJlc3VsdCA9IG51bGw7XG4gICAgZm9yIChjb25zdCBsb2FkUGF0aCBvZiB0aGlzLmxvYWRQYXRocykge1xuICAgICAgcmVzdWx0ID0gc3VwZXIuY2Fub25pY2FsaXplKHBhdGhUb0ZpbGVVUkwoam9pbihsb2FkUGF0aCwgdXJsKSkuaHJlZiwgb3B0aW9ucyk7XG4gICAgICBpZiAocmVzdWx0ICE9PSBudWxsKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuLyoqXG4gKiBXb3JrYXJvdW5kIGZvciBTYXNzIG5vdCBjYWxsaW5nIGluc3RhbmNlIG1ldGhvZHMgd2l0aCBgdGhpc2AuXG4gKiBUaGUgYGNhbm9uaWNhbGl6ZWAgYW5kIGBsb2FkYCBtZXRob2RzIHdpbGwgYmUgYm91bmQgdG8gdGhlIGNsYXNzIGluc3RhbmNlLlxuICogQHBhcmFtIGltcG9ydGVyIEEgU2FzcyBpbXBvcnRlciB0byBiaW5kLlxuICogQHJldHVybnMgVGhlIGJvdW5kIFNhc3MgaW1wb3J0ZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzYXNzQmluZFdvcmthcm91bmQ8VCBleHRlbmRzIEltcG9ydGVyPihpbXBvcnRlcjogVCk6IFQge1xuICBpbXBvcnRlci5jYW5vbmljYWxpemUgPSBpbXBvcnRlci5jYW5vbmljYWxpemUuYmluZChpbXBvcnRlcik7XG4gIGltcG9ydGVyLmxvYWQgPSBpbXBvcnRlci5sb2FkLmJpbmQoaW1wb3J0ZXIpO1xuXG4gIHJldHVybiBpbXBvcnRlcjtcbn1cbiJdfQ==