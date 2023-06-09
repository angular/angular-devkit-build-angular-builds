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
            updatedContents ?? (updatedContents = new magic_string_1.default(contents));
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
            case '.css':
                syntax = 'css';
                break;
            case '.sass':
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
        pos += width;
        current = contents.codePointAt(pos) ?? -1;
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
        let stylesheetPath;
        try {
            stylesheetPath = (0, node_url_1.fileURLToPath)(url);
        }
        catch {
            // Only file protocol URLs are supported by this importer
            return null;
        }
        const directory = (0, node_path_1.dirname)(stylesheetPath);
        const extension = (0, node_path_1.extname)(stylesheetPath);
        const hasStyleExtension = extension === '.scss' || extension === '.sass' || extension === '.css';
        // Remove the style extension if present to allow adding the `.import` suffix
        const filename = (0, node_path_1.basename)(stylesheetPath, hasStyleExtension ? extension : undefined);
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
        let foundDefaults;
        let foundImports;
        let hasPotentialIndex = false;
        let cachedEntries = this.directoryCache.get(directory);
        if (cachedEntries) {
            // If there is a preprocessed cache of the directory, perform an intersection of the potentials
            // and the directory files.
            const { files, directories } = cachedEntries;
            foundDefaults = [...defaultPotentials].filter((potential) => files.has(potential));
            foundImports = [...importPotentials].filter((potential) => files.has(potential));
            hasPotentialIndex = checkDirectory && !hasStyleExtension && directories.has(filename);
        }
        else {
            // If no preprocessed cache exists, get the entries from the file system and, while searching,
            // generate the cache for later requests.
            let entries;
            try {
                entries = (0, node_fs_1.readdirSync)(directory, { withFileTypes: true });
            }
            catch {
                return null;
            }
            foundDefaults = [];
            foundImports = [];
            cachedEntries = { files: new Set(), directories: new Set() };
            for (const entry of entries) {
                const isDirectory = entry.isDirectory();
                if (isDirectory) {
                    cachedEntries.directories.add(entry.name);
                }
                // Record if the name should be checked as a directory with an index file
                if (checkDirectory && !hasStyleExtension && entry.name === filename && isDirectory) {
                    hasPotentialIndex = true;
                }
                if (!entry.isFile()) {
                    continue;
                }
                cachedEntries.files.add(entry.name);
                if (importPotentials.has(entry.name)) {
                    foundImports.push(entry.name);
                }
                if (defaultPotentials.has(entry.name)) {
                    foundDefaults.push(entry.name);
                }
            }
            this.directoryCache.set(directory, cachedEntries);
        }
        // `foundImports` will only contain elements if `options.fromImport` is true
        const result = this.checkFound(foundImports) ?? this.checkFound(foundDefaults);
        if (result !== null) {
            return (0, node_url_1.pathToFileURL)((0, node_path_1.join)(directory, result));
        }
        if (hasPotentialIndex) {
            // Check for index files using filename as a directory
            return this.resolveImport(url + '/index', fromImport, false);
        }
        return null;
    }
    /**
     * Checks an array of potential stylesheet files to determine if there is a valid
     * stylesheet file. More than one discovered file may indicate an error.
     * @param found An array of discovered stylesheet files.
     * @returns A fully resolved path for a stylesheet file or `null` if not found.
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
            return foundWithoutCss[0];
        }
        return found[0];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmViYXNpbmctaW1wb3J0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9zYXNzL3JlYmFzaW5nLWltcG9ydGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILGdFQUF1QztBQUN2QyxxQ0FBb0Q7QUFDcEQseUNBQXVFO0FBQ3ZFLHVDQUF3RDtBQVl4RDs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBZSxtQkFBbUI7SUFDaEM7Ozs7T0FJRztJQUNILFlBQ1UsY0FBc0IsRUFDdEIsZ0JBQTRDO1FBRDVDLG1CQUFjLEdBQWQsY0FBYyxDQUFRO1FBQ3RCLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBNEI7SUFDbkQsQ0FBQztJQUlKLElBQUksQ0FBQyxZQUFpQjtRQUNwQixNQUFNLGNBQWMsR0FBRyxJQUFBLHdCQUFhLEVBQUMsWUFBWSxDQUFDLENBQUM7UUFDbkQsTUFBTSxtQkFBbUIsR0FBRyxJQUFBLG1CQUFPLEVBQUMsY0FBYyxDQUFDLENBQUM7UUFDcEQsSUFBSSxRQUFRLEdBQUcsSUFBQSxzQkFBWSxFQUFDLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUVyRCxpQ0FBaUM7UUFDakMsSUFBSSxlQUFlLENBQUM7UUFDcEIsS0FBSyxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxRQUFRLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDdEQsNENBQTRDO1lBQzVDLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDL0MsU0FBUzthQUNWO1lBRUQsMkRBQTJEO1lBQzNELElBQUkscUNBQXFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUNyRCxTQUFT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LElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUU3QyxPQUFPLFFBQVEsQ0FBQztBQUNsQixDQUFDO0FBTEQsZ0RBS0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgUmF3U291cmNlTWFwIH0gZnJvbSAnQGFtcHByb2plY3QvcmVtYXBwaW5nJztcbmltcG9ydCBNYWdpY1N0cmluZyBmcm9tICdtYWdpYy1zdHJpbmcnO1xuaW1wb3J0IHsgcmVhZEZpbGVTeW5jLCByZWFkZGlyU3luYyB9IGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGRpcm5hbWUsIGV4dG5hbWUsIGpvaW4sIHJlbGF0aXZlIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgdHlwZSB7IEZpbGVJbXBvcnRlciwgSW1wb3J0ZXIsIEltcG9ydGVyUmVzdWx0LCBTeW50YXggfSBmcm9tICdzYXNzJztcblxuLyoqXG4gKiBBIHByZXByb2Nlc3NlZCBjYWNoZSBlbnRyeSBmb3IgdGhlIGZpbGVzIGFuZCBkaXJlY3RvcmllcyB3aXRoaW4gYSBwcmV2aW91c2x5IHNlYXJjaGVkXG4gKiBkaXJlY3Rvcnkgd2hlbiBwZXJmb3JtaW5nIFNhc3MgaW1wb3J0IHJlc29sdXRpb24uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGlyZWN0b3J5RW50cnkge1xuICBmaWxlczogU2V0PHN0cmluZz47XG4gIGRpcmVjdG9yaWVzOiBTZXQ8c3RyaW5nPjtcbn1cblxuLyoqXG4gKiBBIFNhc3MgSW1wb3J0ZXIgYmFzZSBjbGFzcyB0aGF0IHByb3ZpZGVzIHRoZSBsb2FkIGxvZ2ljIHRvIHJlYmFzZSBhbGwgYHVybCgpYCBmdW5jdGlvbnNcbiAqIHdpdGhpbiBhIHN0eWxlc2hlZXQuIFRoZSByZWJhc2luZyB3aWxsIGVuc3VyZSB0aGF0IHRoZSBVUkxzIGluIHRoZSBvdXRwdXQgb2YgdGhlIFNhc3MgY29tcGlsZXJcbiAqIHJlZmxlY3QgdGhlIGZpbmFsIGZpbGVzeXN0ZW0gbG9jYXRpb24gb2YgdGhlIG91dHB1dCBDU1MgZmlsZS5cbiAqXG4gKiBUaGlzIGNsYXNzIHByb3ZpZGVzIHRoZSBjb3JlIG9mIHRoZSByZWJhc2luZyBmdW5jdGlvbmFsaXR5LiBUbyBlbnN1cmUgdGhhdCBlYWNoIGZpbGUgaXMgcHJvY2Vzc2VkXG4gKiBieSB0aGlzIGltcG9ydGVyJ3MgbG9hZCBpbXBsZW1lbnRhdGlvbiwgdGhlIFNhc3MgY29tcGlsZXIgcmVxdWlyZXMgdGhlIGltcG9ydGVyJ3MgY2Fub25pY2FsaXplXG4gKiBmdW5jdGlvbiB0byByZXR1cm4gYSBub24tbnVsbCB2YWx1ZSB3aXRoIHRoZSByZXNvbHZlZCBsb2NhdGlvbiBvZiB0aGUgcmVxdWVzdGVkIHN0eWxlc2hlZXQuXG4gKiBDb25jcmV0ZSBpbXBsZW1lbnRhdGlvbnMgb2YgdGhpcyBjbGFzcyBtdXN0IHByb3ZpZGUgdGhpcyBjYW5vbmljYWxpemUgZnVuY3Rpb25hbGl0eSBmb3IgcmViYXNpbmdcbiAqIHRvIGJlIGVmZmVjdGl2ZS5cbiAqL1xuYWJzdHJhY3QgY2xhc3MgVXJsUmViYXNpbmdJbXBvcnRlciBpbXBsZW1lbnRzIEltcG9ydGVyPCdzeW5jJz4ge1xuICAvKipcbiAgICogQHBhcmFtIGVudHJ5RGlyZWN0b3J5IFRoZSBkaXJlY3Rvcnkgb2YgdGhlIGVudHJ5IHN0eWxlc2hlZXQgdGhhdCB3YXMgcGFzc2VkIHRvIHRoZSBTYXNzIGNvbXBpbGVyLlxuICAgKiBAcGFyYW0gcmViYXNlU291cmNlTWFwcyBXaGVuIHByb3ZpZGVkLCByZWJhc2VkIGZpbGVzIHdpbGwgaGF2ZSBhbiBpbnRlcm1lZGlhdGUgc291cmNlbWFwIGFkZGVkIHRvIHRoZSBNYXBcbiAgICogd2hpY2ggY2FuIGJlIHVzZWQgdG8gZ2VuZXJhdGUgYSBmaW5hbCBzb3VyY2VtYXAgdGhhdCBjb250YWlucyBvcmlnaW5hbCBzb3VyY2VzLlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBlbnRyeURpcmVjdG9yeTogc3RyaW5nLFxuICAgIHByaXZhdGUgcmViYXNlU291cmNlTWFwcz86IE1hcDxzdHJpbmcsIFJhd1NvdXJjZU1hcD4sXG4gICkge31cblxuICBhYnN0cmFjdCBjYW5vbmljYWxpemUodXJsOiBzdHJpbmcsIG9wdGlvbnM6IHsgZnJvbUltcG9ydDogYm9vbGVhbiB9KTogVVJMIHwgbnVsbDtcblxuICBsb2FkKGNhbm9uaWNhbFVybDogVVJMKTogSW1wb3J0ZXJSZXN1bHQgfCBudWxsIHtcbiAgICBjb25zdCBzdHlsZXNoZWV0UGF0aCA9IGZpbGVVUkxUb1BhdGgoY2Fub25pY2FsVXJsKTtcbiAgICBjb25zdCBzdHlsZXNoZWV0RGlyZWN0b3J5ID0gZGlybmFtZShzdHlsZXNoZWV0UGF0aCk7XG4gICAgbGV0IGNvbnRlbnRzID0gcmVhZEZpbGVTeW5jKHN0eWxlc2hlZXRQYXRoLCAndXRmLTgnKTtcblxuICAgIC8vIFJlYmFzZSBhbnkgVVJMcyB0aGF0IGFyZSBmb3VuZFxuICAgIGxldCB1cGRhdGVkQ29udGVudHM7XG4gICAgZm9yIChjb25zdCB7IHN0YXJ0LCBlbmQsIHZhbHVlIH0gb2YgZmluZFVybHMoY29udGVudHMpKSB7XG4gICAgICAvLyBTa2lwIGlmIHZhbHVlIGlzIGVtcHR5IG9yIGEgU2FzcyB2YXJpYWJsZVxuICAgICAgaWYgKHZhbHVlLmxlbmd0aCA9PT0gMCB8fCB2YWx1ZS5zdGFydHNXaXRoKCckJykpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIFNraXAgaWYgcm9vdC1yZWxhdGl2ZSwgYWJzb2x1dGUgb3IgcHJvdG9jb2wgcmVsYXRpdmUgdXJsXG4gICAgICBpZiAoL14oKD86XFx3KzopP1xcL1xcL3xkYXRhOnxjaHJvbWU6fCN8XFwvKS8udGVzdCh2YWx1ZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlYmFzZWRQYXRoID0gcmVsYXRpdmUodGhpcy5lbnRyeURpcmVjdG9yeSwgam9pbihzdHlsZXNoZWV0RGlyZWN0b3J5LCB2YWx1ZSkpO1xuXG4gICAgICAvLyBOb3JtYWxpemUgcGF0aCBzZXBhcmF0b3JzIGFuZCBlc2NhcGUgY2hhcmFjdGVyc1xuICAgICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQ1NTL3VybCNzeW50YXhcbiAgICAgIGNvbnN0IHJlYmFzZWRVcmwgPSAnLi8nICsgcmViYXNlZFBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpLnJlcGxhY2UoL1soKVxccydcIl0vZywgJ1xcXFwkJicpO1xuXG4gICAgICB1cGRhdGVkQ29udGVudHMgPz89IG5ldyBNYWdpY1N0cmluZyhjb250ZW50cyk7XG4gICAgICB1cGRhdGVkQ29udGVudHMudXBkYXRlKHN0YXJ0LCBlbmQsIHJlYmFzZWRVcmwpO1xuICAgIH1cblxuICAgIGlmICh1cGRhdGVkQ29udGVudHMpIHtcbiAgICAgIGNvbnRlbnRzID0gdXBkYXRlZENvbnRlbnRzLnRvU3RyaW5nKCk7XG4gICAgICBpZiAodGhpcy5yZWJhc2VTb3VyY2VNYXBzKSB7XG4gICAgICAgIC8vIEdlbmVyYXRlIGFuIGludGVybWVkaWF0ZSBzb3VyY2UgbWFwIGZvciB0aGUgcmViYXNpbmcgY2hhbmdlc1xuICAgICAgICBjb25zdCBtYXAgPSB1cGRhdGVkQ29udGVudHMuZ2VuZXJhdGVNYXAoe1xuICAgICAgICAgIGhpcmVzOiB0cnVlLFxuICAgICAgICAgIGluY2x1ZGVDb250ZW50OiB0cnVlLFxuICAgICAgICAgIHNvdXJjZTogY2Fub25pY2FsVXJsLmhyZWYsXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnJlYmFzZVNvdXJjZU1hcHMuc2V0KGNhbm9uaWNhbFVybC5ocmVmLCBtYXAgYXMgUmF3U291cmNlTWFwKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgc3ludGF4OiBTeW50YXggfCB1bmRlZmluZWQ7XG4gICAgc3dpdGNoIChleHRuYW1lKHN0eWxlc2hlZXRQYXRoKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICBjYXNlICcuY3NzJzpcbiAgICAgICAgc3ludGF4ID0gJ2Nzcyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnLnNhc3MnOlxuICAgICAgICBzeW50YXggPSAnaW5kZW50ZWQnO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHN5bnRheCA9ICdzY3NzJztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRlbnRzLFxuICAgICAgc3ludGF4LFxuICAgICAgc291cmNlTWFwVXJsOiBjYW5vbmljYWxVcmwsXG4gICAgfTtcbiAgfVxufVxuXG4vKipcbiAqIERldGVybWluZXMgaWYgYSB1bmljb2RlIGNvZGUgcG9pbnQgaXMgYSBDU1Mgd2hpdGVzcGFjZSBjaGFyYWN0ZXIuXG4gKiBAcGFyYW0gY29kZSBUaGUgdW5pY29kZSBjb2RlIHBvaW50IHRvIHRlc3QuXG4gKiBAcmV0dXJucyB0cnVlLCBpZiB0aGUgY29kZSBwb2ludCBpcyBDU1Mgd2hpdGVzcGFjZTsgZmFsc2UsIG90aGVyd2lzZS5cbiAqL1xuZnVuY3Rpb24gaXNXaGl0ZXNwYWNlKGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICAvLyBCYXNlZCBvbiBodHRwczovL3d3dy53My5vcmcvVFIvY3NzLXN5bnRheC0zLyN3aGl0ZXNwYWNlXG4gIHN3aXRjaCAoY29kZSkge1xuICAgIGNhc2UgMHgwMDA5OiAvLyB0YWJcbiAgICBjYXNlIDB4MDAyMDogLy8gc3BhY2VcbiAgICBjYXNlIDB4MDAwYTogLy8gbGluZSBmZWVkXG4gICAgY2FzZSAweDAwMGM6IC8vIGZvcm0gZmVlZFxuICAgIGNhc2UgMHgwMDBkOiAvLyBjYXJyaWFnZSByZXR1cm5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLyoqXG4gKiBTY2FucyBhIENTUyBvciBTYXNzIGZpbGUgYW5kIGxvY2F0ZXMgYWxsIHZhbGlkIHVybCBmdW5jdGlvbiB2YWx1ZXMgYXMgZGVmaW5lZCBieSB0aGUgQ1NTXG4gKiBzeW50YXggc3BlY2lmaWNhdGlvbi5cbiAqIEBwYXJhbSBjb250ZW50cyBBIHN0cmluZyBjb250YWluaW5nIGEgQ1NTIG9yIFNhc3MgZmlsZSB0byBzY2FuLlxuICogQHJldHVybnMgQW4gaXRlcmFibGUgdGhhdCB5aWVsZHMgZWFjaCBDU1MgdXJsIGZ1bmN0aW9uIHZhbHVlIGZvdW5kLlxuICovXG5mdW5jdGlvbiogZmluZFVybHMoY29udGVudHM6IHN0cmluZyk6IEl0ZXJhYmxlPHsgc3RhcnQ6IG51bWJlcjsgZW5kOiBudW1iZXI7IHZhbHVlOiBzdHJpbmcgfT4ge1xuICBsZXQgcG9zID0gMDtcbiAgbGV0IHdpZHRoID0gMTtcbiAgbGV0IGN1cnJlbnQgPSAtMTtcbiAgY29uc3QgbmV4dCA9ICgpID0+IHtcbiAgICBwb3MgKz0gd2lkdGg7XG4gICAgY3VycmVudCA9IGNvbnRlbnRzLmNvZGVQb2ludEF0KHBvcykgPz8gLTE7XG4gICAgd2lkdGggPSBjdXJyZW50ID4gMHhmZmZmID8gMiA6IDE7XG5cbiAgICByZXR1cm4gY3VycmVudDtcbiAgfTtcblxuICAvLyBCYXNlZCBvbiBodHRwczovL3d3dy53My5vcmcvVFIvY3NzLXN5bnRheC0zLyNjb25zdW1lLWlkZW50LWxpa2UtdG9rZW5cbiAgd2hpbGUgKChwb3MgPSBjb250ZW50cy5pbmRleE9mKCd1cmwoJywgcG9zKSkgIT09IC0xKSB7XG4gICAgLy8gU2V0IHRvIHBvc2l0aW9uIG9mIHRoZSAoXG4gICAgcG9zICs9IDM7XG4gICAgd2lkdGggPSAxO1xuXG4gICAgLy8gQ29uc3VtZSBhbGwgbGVhZGluZyB3aGl0ZXNwYWNlXG4gICAgd2hpbGUgKGlzV2hpdGVzcGFjZShuZXh0KCkpKSB7XG4gICAgICAvKiBlbXB0eSAqL1xuICAgIH1cblxuICAgIC8vIEluaXRpYWxpemUgVVJMIHN0YXRlXG4gICAgY29uc3QgdXJsID0geyBzdGFydDogcG9zLCBlbmQ6IC0xLCB2YWx1ZTogJycgfTtcbiAgICBsZXQgY29tcGxldGUgPSBmYWxzZTtcblxuICAgIC8vIElmIFwiIG9yICcsIHRoZW4gY29uc3VtZSB0aGUgdmFsdWUgYXMgYSBzdHJpbmdcbiAgICBpZiAoY3VycmVudCA9PT0gMHgwMDIyIHx8IGN1cnJlbnQgPT09IDB4MDAyNykge1xuICAgICAgY29uc3QgZW5kaW5nID0gY3VycmVudDtcbiAgICAgIC8vIEJhc2VkIG9uIGh0dHBzOi8vd3d3LnczLm9yZy9UUi9jc3Mtc3ludGF4LTMvI2NvbnN1bWUtc3RyaW5nLXRva2VuXG4gICAgICB3aGlsZSAoIWNvbXBsZXRlKSB7XG4gICAgICAgIHN3aXRjaCAobmV4dCgpKSB7XG4gICAgICAgICAgY2FzZSAtMTogLy8gRU9GXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgY2FzZSAweDAwMGE6IC8vIGxpbmUgZmVlZFxuICAgICAgICAgIGNhc2UgMHgwMDBjOiAvLyBmb3JtIGZlZWRcbiAgICAgICAgICBjYXNlIDB4MDAwZDogLy8gY2FycmlhZ2UgcmV0dXJuXG4gICAgICAgICAgICAvLyBJbnZhbGlkXG4gICAgICAgICAgICBjb21wbGV0ZSA9IHRydWU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDB4MDA1YzogLy8gXFwgLS0gY2hhcmFjdGVyIGVzY2FwZVxuICAgICAgICAgICAgLy8gSWYgbm90IEVPRiBvciBuZXdsaW5lLCBhZGQgdGhlIGNoYXJhY3RlciBhZnRlciB0aGUgZXNjYXBlXG4gICAgICAgICAgICBzd2l0Y2ggKG5leHQoKSkge1xuICAgICAgICAgICAgICBjYXNlIC0xOlxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgY2FzZSAweDAwMGE6IC8vIGxpbmUgZmVlZFxuICAgICAgICAgICAgICBjYXNlIDB4MDAwYzogLy8gZm9ybSBmZWVkXG4gICAgICAgICAgICAgIGNhc2UgMHgwMDBkOiAvLyBjYXJyaWFnZSByZXR1cm5cbiAgICAgICAgICAgICAgICAvLyBTa2lwIHdoZW4gaW5zaWRlIGEgc3RyaW5nXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgLy8gVE9ETzogSGFuZGxlIGhleCBlc2NhcGUgY29kZXNcbiAgICAgICAgICAgICAgICB1cmwudmFsdWUgKz0gU3RyaW5nLmZyb21Db2RlUG9pbnQoY3VycmVudCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIGVuZGluZzpcbiAgICAgICAgICAgIC8vIEZ1bGwgc3RyaW5nIHBvc2l0aW9uIHNob3VsZCBpbmNsdWRlIHRoZSBxdW90ZXMgZm9yIHJlcGxhY2VtZW50XG4gICAgICAgICAgICB1cmwuZW5kID0gcG9zICsgMTtcbiAgICAgICAgICAgIGNvbXBsZXRlID0gdHJ1ZTtcbiAgICAgICAgICAgIHlpZWxkIHVybDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB1cmwudmFsdWUgKz0gU3RyaW5nLmZyb21Db2RlUG9pbnQoY3VycmVudCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBuZXh0KCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBCYXNlZCBvbiBodHRwczovL3d3dy53My5vcmcvVFIvY3NzLXN5bnRheC0zLyNjb25zdW1lLXVybC10b2tlblxuICAgIHdoaWxlICghY29tcGxldGUpIHtcbiAgICAgIHN3aXRjaCAoY3VycmVudCkge1xuICAgICAgICBjYXNlIC0xOiAvLyBFT0ZcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNhc2UgMHgwMDIyOiAvLyBcIlxuICAgICAgICBjYXNlIDB4MDAyNzogLy8gJ1xuICAgICAgICBjYXNlIDB4MDAyODogLy8gKFxuICAgICAgICAgIC8vIEludmFsaWRcbiAgICAgICAgICBjb21wbGV0ZSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMHgwMDI5OiAvLyApXG4gICAgICAgICAgLy8gVVJMIGlzIHZhbGlkIGFuZCBjb21wbGV0ZVxuICAgICAgICAgIHVybC5lbmQgPSBwb3M7XG4gICAgICAgICAgY29tcGxldGUgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDB4MDA1YzogLy8gXFwgLS0gY2hhcmFjdGVyIGVzY2FwZVxuICAgICAgICAgIC8vIElmIG5vdCBFT0Ygb3IgbmV3bGluZSwgYWRkIHRoZSBjaGFyYWN0ZXIgYWZ0ZXIgdGhlIGVzY2FwZVxuICAgICAgICAgIHN3aXRjaCAobmV4dCgpKSB7XG4gICAgICAgICAgICBjYXNlIC0xOiAvLyBFT0ZcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgY2FzZSAweDAwMGE6IC8vIGxpbmUgZmVlZFxuICAgICAgICAgICAgY2FzZSAweDAwMGM6IC8vIGZvcm0gZmVlZFxuICAgICAgICAgICAgY2FzZSAweDAwMGQ6IC8vIGNhcnJpYWdlIHJldHVyblxuICAgICAgICAgICAgICAvLyBJbnZhbGlkXG4gICAgICAgICAgICAgIGNvbXBsZXRlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAvLyBUT0RPOiBIYW5kbGUgaGV4IGVzY2FwZSBjb2Rlc1xuICAgICAgICAgICAgICB1cmwudmFsdWUgKz0gU3RyaW5nLmZyb21Db2RlUG9pbnQoY3VycmVudCk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBpZiAoaXNXaGl0ZXNwYWNlKGN1cnJlbnQpKSB7XG4gICAgICAgICAgICB3aGlsZSAoaXNXaGl0ZXNwYWNlKG5leHQoKSkpIHtcbiAgICAgICAgICAgICAgLyogZW1wdHkgKi9cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFVuZXNjYXBlZCB3aGl0ZXNwYWNlIGlzIG9ubHkgdmFsaWQgYmVmb3JlIHRoZSBjbG9zaW5nIClcbiAgICAgICAgICAgIGlmIChjdXJyZW50ID09PSAweDAwMjkpIHtcbiAgICAgICAgICAgICAgLy8gVVJMIGlzIHZhbGlkXG4gICAgICAgICAgICAgIHVybC5lbmQgPSBwb3M7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb21wbGV0ZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEFkZCB0aGUgY2hhcmFjdGVyIHRvIHRoZSB1cmwgdmFsdWVcbiAgICAgICAgICAgIHVybC52YWx1ZSArPSBTdHJpbmcuZnJvbUNvZGVQb2ludChjdXJyZW50KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBuZXh0KCk7XG4gICAgfVxuXG4gICAgLy8gQW4gZW5kIHBvc2l0aW9uIGluZGljYXRlcyBhIFVSTCB3YXMgZm91bmRcbiAgICBpZiAodXJsLmVuZCAhPT0gLTEpIHtcbiAgICAgIHlpZWxkIHVybDtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBQcm92aWRlcyB0aGUgU2FzcyBpbXBvcnRlciBsb2dpYyB0byByZXNvbHZlIHJlbGF0aXZlIHN0eWxlc2hlZXQgaW1wb3J0cyB2aWEgYm90aCBpbXBvcnQgYW5kIHVzZSBydWxlc1xuICogYW5kIGFsc28gcmViYXNlIGFueSBgdXJsKClgIGZ1bmN0aW9uIHVzYWdlIHdpdGhpbiB0aG9zZSBzdHlsZXNoZWV0cy4gVGhlIHJlYmFzaW5nIHdpbGwgZW5zdXJlIHRoYXRcbiAqIHRoZSBVUkxzIGluIHRoZSBvdXRwdXQgb2YgdGhlIFNhc3MgY29tcGlsZXIgcmVmbGVjdCB0aGUgZmluYWwgZmlsZXN5c3RlbSBsb2NhdGlvbiBvZiB0aGUgb3V0cHV0IENTUyBmaWxlLlxuICovXG5leHBvcnQgY2xhc3MgUmVsYXRpdmVVcmxSZWJhc2luZ0ltcG9ydGVyIGV4dGVuZHMgVXJsUmViYXNpbmdJbXBvcnRlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGVudHJ5RGlyZWN0b3J5OiBzdHJpbmcsXG4gICAgcHJpdmF0ZSBkaXJlY3RvcnlDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBEaXJlY3RvcnlFbnRyeT4oKSxcbiAgICByZWJhc2VTb3VyY2VNYXBzPzogTWFwPHN0cmluZywgUmF3U291cmNlTWFwPixcbiAgKSB7XG4gICAgc3VwZXIoZW50cnlEaXJlY3RvcnksIHJlYmFzZVNvdXJjZU1hcHMpO1xuICB9XG5cbiAgY2Fub25pY2FsaXplKHVybDogc3RyaW5nLCBvcHRpb25zOiB7IGZyb21JbXBvcnQ6IGJvb2xlYW4gfSk6IFVSTCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLnJlc29sdmVJbXBvcnQodXJsLCBvcHRpb25zLmZyb21JbXBvcnQsIHRydWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEF0dGVtcHRzIHRvIHJlc29sdmUgYSBwcm92aWRlZCBVUkwgdG8gYSBzdHlsZXNoZWV0IGZpbGUgdXNpbmcgdGhlIFNhc3MgY29tcGlsZXIncyByZXNvbHV0aW9uIGFsZ29yaXRobS5cbiAgICogQmFzZWQgb24gaHR0cHM6Ly9naXRodWIuY29tL3Nhc3MvZGFydC1zYXNzL2Jsb2IvNDRkNmJiNmFjNzJmZTZiOTNmNWJmZWMzNzFhMWZmZmIxOGU2Yjc2ZC9saWIvc3JjL2ltcG9ydGVyL3V0aWxzLmRhcnRcbiAgICogQHBhcmFtIHVybCBUaGUgZmlsZSBwcm90b2NvbCBVUkwgdG8gcmVzb2x2ZS5cbiAgICogQHBhcmFtIGZyb21JbXBvcnQgSWYgdHJ1ZSwgVVJMIHdhcyBmcm9tIGFuIGltcG9ydCBydWxlOyBvdGhlcndpc2UgZnJvbSBhIHVzZSBydWxlLlxuICAgKiBAcGFyYW0gY2hlY2tEaXJlY3RvcnkgSWYgdHJ1ZSwgdHJ5IGNoZWNraW5nIGZvciBhIGRpcmVjdG9yeSB3aXRoIHRoZSBiYXNlIG5hbWUgY29udGFpbmluZyBhbiBpbmRleCBmaWxlLlxuICAgKiBAcmV0dXJucyBBIGZ1bGwgcmVzb2x2ZWQgVVJMIG9mIHRoZSBzdHlsZXNoZWV0IGZpbGUgb3IgYG51bGxgIGlmIG5vdCBmb3VuZC5cbiAgICovXG4gIHByaXZhdGUgcmVzb2x2ZUltcG9ydCh1cmw6IHN0cmluZywgZnJvbUltcG9ydDogYm9vbGVhbiwgY2hlY2tEaXJlY3Rvcnk6IGJvb2xlYW4pOiBVUkwgfCBudWxsIHtcbiAgICBsZXQgc3R5bGVzaGVldFBhdGg7XG4gICAgdHJ5IHtcbiAgICAgIHN0eWxlc2hlZXRQYXRoID0gZmlsZVVSTFRvUGF0aCh1cmwpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gT25seSBmaWxlIHByb3RvY29sIFVSTHMgYXJlIHN1cHBvcnRlZCBieSB0aGlzIGltcG9ydGVyXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBkaXJlY3RvcnkgPSBkaXJuYW1lKHN0eWxlc2hlZXRQYXRoKTtcbiAgICBjb25zdCBleHRlbnNpb24gPSBleHRuYW1lKHN0eWxlc2hlZXRQYXRoKTtcbiAgICBjb25zdCBoYXNTdHlsZUV4dGVuc2lvbiA9XG4gICAgICBleHRlbnNpb24gPT09ICcuc2NzcycgfHwgZXh0ZW5zaW9uID09PSAnLnNhc3MnIHx8IGV4dGVuc2lvbiA9PT0gJy5jc3MnO1xuICAgIC8vIFJlbW92ZSB0aGUgc3R5bGUgZXh0ZW5zaW9uIGlmIHByZXNlbnQgdG8gYWxsb3cgYWRkaW5nIHRoZSBgLmltcG9ydGAgc3VmZml4XG4gICAgY29uc3QgZmlsZW5hbWUgPSBiYXNlbmFtZShzdHlsZXNoZWV0UGF0aCwgaGFzU3R5bGVFeHRlbnNpb24gPyBleHRlbnNpb24gOiB1bmRlZmluZWQpO1xuXG4gICAgY29uc3QgaW1wb3J0UG90ZW50aWFscyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IGRlZmF1bHRQb3RlbnRpYWxzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgICBpZiAoaGFzU3R5bGVFeHRlbnNpb24pIHtcbiAgICAgIGlmIChmcm9tSW1wb3J0KSB7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5pbXBvcnQnICsgZXh0ZW5zaW9uKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLmltcG9ydCcgKyBleHRlbnNpb24pO1xuICAgICAgfVxuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgZXh0ZW5zaW9uKTtcbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArIGV4dGVuc2lvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChmcm9tSW1wb3J0KSB7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5pbXBvcnQuc2NzcycpO1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuaW1wb3J0LnNhc3MnKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLmltcG9ydC5jc3MnKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLmltcG9ydC5zY3NzJyk7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5pbXBvcnQuc2FzcycpO1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuaW1wb3J0LmNzcycpO1xuICAgICAgfVxuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5zY3NzJyk7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLnNhc3MnKTtcbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuY3NzJyk7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLnNjc3MnKTtcbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuc2FzcycpO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5jc3MnKTtcbiAgICB9XG5cbiAgICBsZXQgZm91bmREZWZhdWx0cztcbiAgICBsZXQgZm91bmRJbXBvcnRzO1xuICAgIGxldCBoYXNQb3RlbnRpYWxJbmRleCA9IGZhbHNlO1xuXG4gICAgbGV0IGNhY2hlZEVudHJpZXMgPSB0aGlzLmRpcmVjdG9yeUNhY2hlLmdldChkaXJlY3RvcnkpO1xuICAgIGlmIChjYWNoZWRFbnRyaWVzKSB7XG4gICAgICAvLyBJZiB0aGVyZSBpcyBhIHByZXByb2Nlc3NlZCBjYWNoZSBvZiB0aGUgZGlyZWN0b3J5LCBwZXJmb3JtIGFuIGludGVyc2VjdGlvbiBvZiB0aGUgcG90ZW50aWFsc1xuICAgICAgLy8gYW5kIHRoZSBkaXJlY3RvcnkgZmlsZXMuXG4gICAgICBjb25zdCB7IGZpbGVzLCBkaXJlY3RvcmllcyB9ID0gY2FjaGVkRW50cmllcztcbiAgICAgIGZvdW5kRGVmYXVsdHMgPSBbLi4uZGVmYXVsdFBvdGVudGlhbHNdLmZpbHRlcigocG90ZW50aWFsKSA9PiBmaWxlcy5oYXMocG90ZW50aWFsKSk7XG4gICAgICBmb3VuZEltcG9ydHMgPSBbLi4uaW1wb3J0UG90ZW50aWFsc10uZmlsdGVyKChwb3RlbnRpYWwpID0+IGZpbGVzLmhhcyhwb3RlbnRpYWwpKTtcbiAgICAgIGhhc1BvdGVudGlhbEluZGV4ID0gY2hlY2tEaXJlY3RvcnkgJiYgIWhhc1N0eWxlRXh0ZW5zaW9uICYmIGRpcmVjdG9yaWVzLmhhcyhmaWxlbmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElmIG5vIHByZXByb2Nlc3NlZCBjYWNoZSBleGlzdHMsIGdldCB0aGUgZW50cmllcyBmcm9tIHRoZSBmaWxlIHN5c3RlbSBhbmQsIHdoaWxlIHNlYXJjaGluZyxcbiAgICAgIC8vIGdlbmVyYXRlIHRoZSBjYWNoZSBmb3IgbGF0ZXIgcmVxdWVzdHMuXG4gICAgICBsZXQgZW50cmllcztcbiAgICAgIHRyeSB7XG4gICAgICAgIGVudHJpZXMgPSByZWFkZGlyU3luYyhkaXJlY3RvcnksIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgZm91bmREZWZhdWx0cyA9IFtdO1xuICAgICAgZm91bmRJbXBvcnRzID0gW107XG4gICAgICBjYWNoZWRFbnRyaWVzID0geyBmaWxlczogbmV3IFNldDxzdHJpbmc+KCksIGRpcmVjdG9yaWVzOiBuZXcgU2V0PHN0cmluZz4oKSB9O1xuICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgICAgIGNvbnN0IGlzRGlyZWN0b3J5ID0gZW50cnkuaXNEaXJlY3RvcnkoKTtcbiAgICAgICAgaWYgKGlzRGlyZWN0b3J5KSB7XG4gICAgICAgICAgY2FjaGVkRW50cmllcy5kaXJlY3Rvcmllcy5hZGQoZW50cnkubmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWNvcmQgaWYgdGhlIG5hbWUgc2hvdWxkIGJlIGNoZWNrZWQgYXMgYSBkaXJlY3Rvcnkgd2l0aCBhbiBpbmRleCBmaWxlXG4gICAgICAgIGlmIChjaGVja0RpcmVjdG9yeSAmJiAhaGFzU3R5bGVFeHRlbnNpb24gJiYgZW50cnkubmFtZSA9PT0gZmlsZW5hbWUgJiYgaXNEaXJlY3RvcnkpIHtcbiAgICAgICAgICBoYXNQb3RlbnRpYWxJbmRleCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWVudHJ5LmlzRmlsZSgpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjYWNoZWRFbnRyaWVzLmZpbGVzLmFkZChlbnRyeS5uYW1lKTtcblxuICAgICAgICBpZiAoaW1wb3J0UG90ZW50aWFscy5oYXMoZW50cnkubmFtZSkpIHtcbiAgICAgICAgICBmb3VuZEltcG9ydHMucHVzaChlbnRyeS5uYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkZWZhdWx0UG90ZW50aWFscy5oYXMoZW50cnkubmFtZSkpIHtcbiAgICAgICAgICBmb3VuZERlZmF1bHRzLnB1c2goZW50cnkubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5kaXJlY3RvcnlDYWNoZS5zZXQoZGlyZWN0b3J5LCBjYWNoZWRFbnRyaWVzKTtcbiAgICB9XG5cbiAgICAvLyBgZm91bmRJbXBvcnRzYCB3aWxsIG9ubHkgY29udGFpbiBlbGVtZW50cyBpZiBgb3B0aW9ucy5mcm9tSW1wb3J0YCBpcyB0cnVlXG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5jaGVja0ZvdW5kKGZvdW5kSW1wb3J0cykgPz8gdGhpcy5jaGVja0ZvdW5kKGZvdW5kRGVmYXVsdHMpO1xuICAgIGlmIChyZXN1bHQgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKGpvaW4oZGlyZWN0b3J5LCByZXN1bHQpKTtcbiAgICB9XG5cbiAgICBpZiAoaGFzUG90ZW50aWFsSW5kZXgpIHtcbiAgICAgIC8vIENoZWNrIGZvciBpbmRleCBmaWxlcyB1c2luZyBmaWxlbmFtZSBhcyBhIGRpcmVjdG9yeVxuICAgICAgcmV0dXJuIHRoaXMucmVzb2x2ZUltcG9ydCh1cmwgKyAnL2luZGV4JywgZnJvbUltcG9ydCwgZmFsc2UpO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBhbiBhcnJheSBvZiBwb3RlbnRpYWwgc3R5bGVzaGVldCBmaWxlcyB0byBkZXRlcm1pbmUgaWYgdGhlcmUgaXMgYSB2YWxpZFxuICAgKiBzdHlsZXNoZWV0IGZpbGUuIE1vcmUgdGhhbiBvbmUgZGlzY292ZXJlZCBmaWxlIG1heSBpbmRpY2F0ZSBhbiBlcnJvci5cbiAgICogQHBhcmFtIGZvdW5kIEFuIGFycmF5IG9mIGRpc2NvdmVyZWQgc3R5bGVzaGVldCBmaWxlcy5cbiAgICogQHJldHVybnMgQSBmdWxseSByZXNvbHZlZCBwYXRoIGZvciBhIHN0eWxlc2hlZXQgZmlsZSBvciBgbnVsbGAgaWYgbm90IGZvdW5kLlxuICAgKiBAdGhyb3dzIElmIHRoZXJlIGFyZSBhbWJpZ3VvdXMgZmlsZXMgZGlzY292ZXJlZC5cbiAgICovXG4gIHByaXZhdGUgY2hlY2tGb3VuZChmb3VuZDogc3RyaW5nW10pOiBzdHJpbmcgfCBudWxsIHtcbiAgICBpZiAoZm91bmQubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBOb3QgZm91bmRcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIE1vcmUgdGhhbiBvbmUgZm91bmQgZmlsZSBtYXkgYmUgYW4gZXJyb3JcbiAgICBpZiAoZm91bmQubGVuZ3RoID4gMSkge1xuICAgICAgLy8gUHJlc2VuY2Ugb2YgQ1NTIGZpbGVzIGFsb25nc2lkZSBhIFNhc3MgZmlsZSBkb2VzIG5vdCBjYXVzZSBhbiBlcnJvclxuICAgICAgY29uc3QgZm91bmRXaXRob3V0Q3NzID0gZm91bmQuZmlsdGVyKChlbGVtZW50KSA9PiBleHRuYW1lKGVsZW1lbnQpICE9PSAnLmNzcycpO1xuICAgICAgLy8gSWYgdGhlIGxlbmd0aCBpcyB6ZXJvIHRoZW4gdGhlcmUgYXJlIHR3byBvciBtb3JlIGNzcyBmaWxlc1xuICAgICAgLy8gSWYgdGhlIGxlbmd0aCBpcyBtb3JlIHRoYW4gb25lIHRoYW4gdGhlcmUgYXJlIHR3byBvciBtb3JlIHNhc3Mvc2NzcyBmaWxlc1xuICAgICAgaWYgKGZvdW5kV2l0aG91dENzcy5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbWJpZ3VvdXMgaW1wb3J0IGRldGVjdGVkLicpO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXR1cm4gdGhlIG5vbi1DU1MgZmlsZSAoc2Fzcy9zY3NzIGZpbGVzIGhhdmUgcHJpb3JpdHkpXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vc2Fzcy9kYXJ0LXNhc3MvYmxvYi80NGQ2YmI2YWM3MmZlNmI5M2Y1YmZlYzM3MWExZmZmYjE4ZTZiNzZkL2xpYi9zcmMvaW1wb3J0ZXIvdXRpbHMuZGFydCNMNDQtTDQ3XG4gICAgICByZXR1cm4gZm91bmRXaXRob3V0Q3NzWzBdO1xuICAgIH1cblxuICAgIHJldHVybiBmb3VuZFswXTtcbiAgfVxufVxuXG4vKipcbiAqIFByb3ZpZGVzIHRoZSBTYXNzIGltcG9ydGVyIGxvZ2ljIHRvIHJlc29sdmUgbW9kdWxlIChucG0gcGFja2FnZSkgc3R5bGVzaGVldCBpbXBvcnRzIHZpYSBib3RoIGltcG9ydCBhbmRcbiAqIHVzZSBydWxlcyBhbmQgYWxzbyByZWJhc2UgYW55IGB1cmwoKWAgZnVuY3Rpb24gdXNhZ2Ugd2l0aGluIHRob3NlIHN0eWxlc2hlZXRzLiBUaGUgcmViYXNpbmcgd2lsbCBlbnN1cmUgdGhhdFxuICogdGhlIFVSTHMgaW4gdGhlIG91dHB1dCBvZiB0aGUgU2FzcyBjb21waWxlciByZWZsZWN0IHRoZSBmaW5hbCBmaWxlc3lzdGVtIGxvY2F0aW9uIG9mIHRoZSBvdXRwdXQgQ1NTIGZpbGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBNb2R1bGVVcmxSZWJhc2luZ0ltcG9ydGVyIGV4dGVuZHMgUmVsYXRpdmVVcmxSZWJhc2luZ0ltcG9ydGVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgZW50cnlEaXJlY3Rvcnk6IHN0cmluZyxcbiAgICBkaXJlY3RvcnlDYWNoZTogTWFwPHN0cmluZywgRGlyZWN0b3J5RW50cnk+LFxuICAgIHJlYmFzZVNvdXJjZU1hcHM6IE1hcDxzdHJpbmcsIFJhd1NvdXJjZU1hcD4gfCB1bmRlZmluZWQsXG4gICAgcHJpdmF0ZSBmaW5kZXI6IEZpbGVJbXBvcnRlcjwnc3luYyc+WydmaW5kRmlsZVVybCddLFxuICApIHtcbiAgICBzdXBlcihlbnRyeURpcmVjdG9yeSwgZGlyZWN0b3J5Q2FjaGUsIHJlYmFzZVNvdXJjZU1hcHMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2Fub25pY2FsaXplKHVybDogc3RyaW5nLCBvcHRpb25zOiB7IGZyb21JbXBvcnQ6IGJvb2xlYW4gfSk6IFVSTCB8IG51bGwge1xuICAgIGlmICh1cmwuc3RhcnRzV2l0aCgnZmlsZTovLycpKSB7XG4gICAgICByZXR1cm4gc3VwZXIuY2Fub25pY2FsaXplKHVybCwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5maW5kZXIodXJsLCBvcHRpb25zKTtcblxuICAgIHJldHVybiByZXN1bHQgPyBzdXBlci5jYW5vbmljYWxpemUocmVzdWx0LmhyZWYsIG9wdGlvbnMpIDogbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIFByb3ZpZGVzIHRoZSBTYXNzIGltcG9ydGVyIGxvZ2ljIHRvIHJlc29sdmUgbG9hZCBwYXRocyBsb2NhdGVkIHN0eWxlc2hlZXQgaW1wb3J0cyB2aWEgYm90aCBpbXBvcnQgYW5kXG4gKiB1c2UgcnVsZXMgYW5kIGFsc28gcmViYXNlIGFueSBgdXJsKClgIGZ1bmN0aW9uIHVzYWdlIHdpdGhpbiB0aG9zZSBzdHlsZXNoZWV0cy4gVGhlIHJlYmFzaW5nIHdpbGwgZW5zdXJlIHRoYXRcbiAqIHRoZSBVUkxzIGluIHRoZSBvdXRwdXQgb2YgdGhlIFNhc3MgY29tcGlsZXIgcmVmbGVjdCB0aGUgZmluYWwgZmlsZXN5c3RlbSBsb2NhdGlvbiBvZiB0aGUgb3V0cHV0IENTUyBmaWxlLlxuICovXG5leHBvcnQgY2xhc3MgTG9hZFBhdGhzVXJsUmViYXNpbmdJbXBvcnRlciBleHRlbmRzIFJlbGF0aXZlVXJsUmViYXNpbmdJbXBvcnRlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGVudHJ5RGlyZWN0b3J5OiBzdHJpbmcsXG4gICAgZGlyZWN0b3J5Q2FjaGU6IE1hcDxzdHJpbmcsIERpcmVjdG9yeUVudHJ5PixcbiAgICByZWJhc2VTb3VyY2VNYXBzOiBNYXA8c3RyaW5nLCBSYXdTb3VyY2VNYXA+IHwgdW5kZWZpbmVkLFxuICAgIHByaXZhdGUgbG9hZFBhdGhzOiBJdGVyYWJsZTxzdHJpbmc+LFxuICApIHtcbiAgICBzdXBlcihlbnRyeURpcmVjdG9yeSwgZGlyZWN0b3J5Q2FjaGUsIHJlYmFzZVNvdXJjZU1hcHMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2Fub25pY2FsaXplKHVybDogc3RyaW5nLCBvcHRpb25zOiB7IGZyb21JbXBvcnQ6IGJvb2xlYW4gfSk6IFVSTCB8IG51bGwge1xuICAgIGlmICh1cmwuc3RhcnRzV2l0aCgnZmlsZTovLycpKSB7XG4gICAgICByZXR1cm4gc3VwZXIuY2Fub25pY2FsaXplKHVybCwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgbGV0IHJlc3VsdCA9IG51bGw7XG4gICAgZm9yIChjb25zdCBsb2FkUGF0aCBvZiB0aGlzLmxvYWRQYXRocykge1xuICAgICAgcmVzdWx0ID0gc3VwZXIuY2Fub25pY2FsaXplKHBhdGhUb0ZpbGVVUkwoam9pbihsb2FkUGF0aCwgdXJsKSkuaHJlZiwgb3B0aW9ucyk7XG4gICAgICBpZiAocmVzdWx0ICE9PSBudWxsKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuLyoqXG4gKiBXb3JrYXJvdW5kIGZvciBTYXNzIG5vdCBjYWxsaW5nIGluc3RhbmNlIG1ldGhvZHMgd2l0aCBgdGhpc2AuXG4gKiBUaGUgYGNhbm9uaWNhbGl6ZWAgYW5kIGBsb2FkYCBtZXRob2RzIHdpbGwgYmUgYm91bmQgdG8gdGhlIGNsYXNzIGluc3RhbmNlLlxuICogQHBhcmFtIGltcG9ydGVyIEEgU2FzcyBpbXBvcnRlciB0byBiaW5kLlxuICogQHJldHVybnMgVGhlIGJvdW5kIFNhc3MgaW1wb3J0ZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzYXNzQmluZFdvcmthcm91bmQ8VCBleHRlbmRzIEltcG9ydGVyPihpbXBvcnRlcjogVCk6IFQge1xuICBpbXBvcnRlci5jYW5vbmljYWxpemUgPSBpbXBvcnRlci5jYW5vbmljYWxpemUuYmluZChpbXBvcnRlcik7XG4gIGltcG9ydGVyLmxvYWQgPSBpbXBvcnRlci5sb2FkLmJpbmQoaW1wb3J0ZXIpO1xuXG4gIHJldHVybiBpbXBvcnRlcjtcbn1cbiJdfQ==