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
 * A Regular expression used to find all `url()` functions within a stylesheet.
 * From packages/angular_devkit/build_angular/src/webpack/plugins/postcss-cli-resources.ts
 */
const URL_REGEXP = /url(?:\(\s*(['"]?))(.*?)(?:\1\s*\))/g;
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
        let contents = (0, node_fs_1.readFileSync)(stylesheetPath, 'utf-8');
        // Rebase any URLs that are found
        if (contents.includes('url(')) {
            const stylesheetDirectory = (0, node_path_1.dirname)(stylesheetPath);
            let match;
            URL_REGEXP.lastIndex = 0;
            let updatedContents;
            while ((match = URL_REGEXP.exec(contents))) {
                const originalUrl = match[2];
                // If root-relative, absolute or protocol relative url, leave as-is
                if (/^((?:\w+:)?\/\/|data:|chrome:|#|\/)/.test(originalUrl)) {
                    continue;
                }
                const rebasedPath = (0, node_path_1.relative)(this.entryDirectory, (0, node_path_1.join)(stylesheetDirectory, originalUrl));
                // Normalize path separators and escape characters
                // https://developer.mozilla.org/en-US/docs/Web/CSS/url#syntax
                const rebasedUrl = './' + rebasedPath.replace(/\\/g, '/').replace(/[()\s'"]/g, '\\$&');
                updatedContents !== null && updatedContents !== void 0 ? updatedContents : (updatedContents = new magic_string_1.default(contents));
                updatedContents.update(match.index, match.index + match[0].length, `url(${rebasedUrl})`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmViYXNpbmctaW1wb3J0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9zYXNzL3JlYmFzaW5nLWltcG9ydGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILGdFQUF1QztBQUN2QyxxQ0FBNEQ7QUFDNUQseUNBQXVFO0FBQ3ZFLHVDQUF3RDtBQUd4RDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsR0FBRyxzQ0FBc0MsQ0FBQztBQUUxRDs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBZSxtQkFBbUI7SUFDaEM7Ozs7T0FJRztJQUNILFlBQ1UsY0FBc0IsRUFDdEIsZ0JBQTRDO1FBRDVDLG1CQUFjLEdBQWQsY0FBYyxDQUFRO1FBQ3RCLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBNEI7SUFDbkQsQ0FBQztJQUlKLElBQUksQ0FBQyxZQUFpQjtRQUNwQixNQUFNLGNBQWMsR0FBRyxJQUFBLHdCQUFhLEVBQUMsWUFBWSxDQUFDLENBQUM7UUFDbkQsSUFBSSxRQUFRLEdBQUcsSUFBQSxzQkFBWSxFQUFDLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUVyRCxpQ0FBaUM7UUFDakMsSUFBSSxRQUFRLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQzdCLE1BQU0sbUJBQW1CLEdBQUcsSUFBQSxtQkFBTyxFQUFDLGNBQWMsQ0FBQyxDQUFDO1lBRXBELElBQUksS0FBSyxDQUFDO1lBQ1YsVUFBVSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7WUFDekIsSUFBSSxlQUFlLENBQUM7WUFDcEIsT0FBTyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUU7Z0JBQzFDLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFFN0Is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XG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgUmF3U291cmNlTWFwIH0gZnJvbSAnQGFtcHByb2plY3QvcmVtYXBwaW5nJztcbmltcG9ydCBNYWdpY1N0cmluZyBmcm9tICdtYWdpYy1zdHJpbmcnO1xuaW1wb3J0IHsgRGlyZW50LCByZWFkRmlsZVN5bmMsIHJlYWRkaXJTeW5jIH0gZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSwgZXh0bmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0eXBlIHsgRmlsZUltcG9ydGVyLCBJbXBvcnRlciwgSW1wb3J0ZXJSZXN1bHQsIFN5bnRheCB9IGZyb20gJ3Nhc3MnO1xuXG4vKipcbiAqIEEgUmVndWxhciBleHByZXNzaW9uIHVzZWQgdG8gZmluZCBhbGwgYHVybCgpYCBmdW5jdGlvbnMgd2l0aGluIGEgc3R5bGVzaGVldC5cbiAqIEZyb20gcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9wbHVnaW5zL3Bvc3Rjc3MtY2xpLXJlc291cmNlcy50c1xuICovXG5jb25zdCBVUkxfUkVHRVhQID0gL3VybCg/OlxcKFxccyooWydcIl0/KSkoLio/KSg/OlxcMVxccypcXCkpL2c7XG5cbi8qKlxuICogQSBTYXNzIEltcG9ydGVyIGJhc2UgY2xhc3MgdGhhdCBwcm92aWRlcyB0aGUgbG9hZCBsb2dpYyB0byByZWJhc2UgYWxsIGB1cmwoKWAgZnVuY3Rpb25zXG4gKiB3aXRoaW4gYSBzdHlsZXNoZWV0LiBUaGUgcmViYXNpbmcgd2lsbCBlbnN1cmUgdGhhdCB0aGUgVVJMcyBpbiB0aGUgb3V0cHV0IG9mIHRoZSBTYXNzIGNvbXBpbGVyXG4gKiByZWZsZWN0IHRoZSBmaW5hbCBmaWxlc3lzdGVtIGxvY2F0aW9uIG9mIHRoZSBvdXRwdXQgQ1NTIGZpbGUuXG4gKlxuICogVGhpcyBjbGFzcyBwcm92aWRlcyB0aGUgY29yZSBvZiB0aGUgcmViYXNpbmcgZnVuY3Rpb25hbGl0eS4gVG8gZW5zdXJlIHRoYXQgZWFjaCBmaWxlIGlzIHByb2Nlc3NlZFxuICogYnkgdGhpcyBpbXBvcnRlcidzIGxvYWQgaW1wbGVtZW50YXRpb24sIHRoZSBTYXNzIGNvbXBpbGVyIHJlcXVpcmVzIHRoZSBpbXBvcnRlcidzIGNhbm9uaWNhbGl6ZVxuICogZnVuY3Rpb24gdG8gcmV0dXJuIGEgbm9uLW51bGwgdmFsdWUgd2l0aCB0aGUgcmVzb2x2ZWQgbG9jYXRpb24gb2YgdGhlIHJlcXVlc3RlZCBzdHlsZXNoZWV0LlxuICogQ29uY3JldGUgaW1wbGVtZW50YXRpb25zIG9mIHRoaXMgY2xhc3MgbXVzdCBwcm92aWRlIHRoaXMgY2Fub25pY2FsaXplIGZ1bmN0aW9uYWxpdHkgZm9yIHJlYmFzaW5nXG4gKiB0byBiZSBlZmZlY3RpdmUuXG4gKi9cbmFic3RyYWN0IGNsYXNzIFVybFJlYmFzaW5nSW1wb3J0ZXIgaW1wbGVtZW50cyBJbXBvcnRlcjwnc3luYyc+IHtcbiAgLyoqXG4gICAqIEBwYXJhbSBlbnRyeURpcmVjdG9yeSBUaGUgZGlyZWN0b3J5IG9mIHRoZSBlbnRyeSBzdHlsZXNoZWV0IHRoYXQgd2FzIHBhc3NlZCB0byB0aGUgU2FzcyBjb21waWxlci5cbiAgICogQHBhcmFtIHJlYmFzZVNvdXJjZU1hcHMgV2hlbiBwcm92aWRlZCwgcmViYXNlZCBmaWxlcyB3aWxsIGhhdmUgYW4gaW50ZXJtZWRpYXRlIHNvdXJjZW1hcCBhZGRlZCB0byB0aGUgTWFwXG4gICAqIHdoaWNoIGNhbiBiZSB1c2VkIHRvIGdlbmVyYXRlIGEgZmluYWwgc291cmNlbWFwIHRoYXQgY29udGFpbnMgb3JpZ2luYWwgc291cmNlcy5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgZW50cnlEaXJlY3Rvcnk6IHN0cmluZyxcbiAgICBwcml2YXRlIHJlYmFzZVNvdXJjZU1hcHM/OiBNYXA8c3RyaW5nLCBSYXdTb3VyY2VNYXA+LFxuICApIHt9XG5cbiAgYWJzdHJhY3QgY2Fub25pY2FsaXplKHVybDogc3RyaW5nLCBvcHRpb25zOiB7IGZyb21JbXBvcnQ6IGJvb2xlYW4gfSk6IFVSTCB8IG51bGw7XG5cbiAgbG9hZChjYW5vbmljYWxVcmw6IFVSTCk6IEltcG9ydGVyUmVzdWx0IHwgbnVsbCB7XG4gICAgY29uc3Qgc3R5bGVzaGVldFBhdGggPSBmaWxlVVJMVG9QYXRoKGNhbm9uaWNhbFVybCk7XG4gICAgbGV0IGNvbnRlbnRzID0gcmVhZEZpbGVTeW5jKHN0eWxlc2hlZXRQYXRoLCAndXRmLTgnKTtcblxuICAgIC8vIFJlYmFzZSBhbnkgVVJMcyB0aGF0IGFyZSBmb3VuZFxuICAgIGlmIChjb250ZW50cy5pbmNsdWRlcygndXJsKCcpKSB7XG4gICAgICBjb25zdCBzdHlsZXNoZWV0RGlyZWN0b3J5ID0gZGlybmFtZShzdHlsZXNoZWV0UGF0aCk7XG5cbiAgICAgIGxldCBtYXRjaDtcbiAgICAgIFVSTF9SRUdFWFAubGFzdEluZGV4ID0gMDtcbiAgICAgIGxldCB1cGRhdGVkQ29udGVudHM7XG4gICAgICB3aGlsZSAoKG1hdGNoID0gVVJMX1JFR0VYUC5leGVjKGNvbnRlbnRzKSkpIHtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxVcmwgPSBtYXRjaFsyXTtcblxuICAgICAgICAvLyBJZiByb290LXJlbGF0aXZlLCBhYnNvbHV0ZSBvciBwcm90b2NvbCByZWxhdGl2ZSB1cmwsIGxlYXZlIGFzLWlzXG4gICAgICAgIGlmICgvXigoPzpcXHcrOik/XFwvXFwvfGRhdGE6fGNocm9tZTp8I3xcXC8pLy50ZXN0KG9yaWdpbmFsVXJsKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmViYXNlZFBhdGggPSByZWxhdGl2ZSh0aGlzLmVudHJ5RGlyZWN0b3J5LCBqb2luKHN0eWxlc2hlZXREaXJlY3RvcnksIG9yaWdpbmFsVXJsKSk7XG5cbiAgICAgICAgLy8gTm9ybWFsaXplIHBhdGggc2VwYXJhdG9ycyBhbmQgZXNjYXBlIGNoYXJhY3RlcnNcbiAgICAgICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQ1NTL3VybCNzeW50YXhcbiAgICAgICAgY29uc3QgcmViYXNlZFVybCA9ICcuLycgKyByZWJhc2VkUGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJykucmVwbGFjZSgvWygpXFxzJ1wiXS9nLCAnXFxcXCQmJyk7XG5cbiAgICAgICAgdXBkYXRlZENvbnRlbnRzID8/PSBuZXcgTWFnaWNTdHJpbmcoY29udGVudHMpO1xuICAgICAgICB1cGRhdGVkQ29udGVudHMudXBkYXRlKG1hdGNoLmluZGV4LCBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCwgYHVybCgke3JlYmFzZWRVcmx9KWApO1xuICAgICAgfVxuXG4gICAgICBpZiAodXBkYXRlZENvbnRlbnRzKSB7XG4gICAgICAgIGNvbnRlbnRzID0gdXBkYXRlZENvbnRlbnRzLnRvU3RyaW5nKCk7XG4gICAgICAgIGlmICh0aGlzLnJlYmFzZVNvdXJjZU1hcHMpIHtcbiAgICAgICAgICAvLyBHZW5lcmF0ZSBhbiBpbnRlcm1lZGlhdGUgc291cmNlIG1hcCBmb3IgdGhlIHJlYmFzaW5nIGNoYW5nZXNcbiAgICAgICAgICBjb25zdCBtYXAgPSB1cGRhdGVkQ29udGVudHMuZ2VuZXJhdGVNYXAoe1xuICAgICAgICAgICAgaGlyZXM6IHRydWUsXG4gICAgICAgICAgICBpbmNsdWRlQ29udGVudDogdHJ1ZSxcbiAgICAgICAgICAgIHNvdXJjZTogY2Fub25pY2FsVXJsLmhyZWYsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGhpcy5yZWJhc2VTb3VyY2VNYXBzLnNldChjYW5vbmljYWxVcmwuaHJlZiwgbWFwIGFzIFJhd1NvdXJjZU1hcCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgc3ludGF4OiBTeW50YXggfCB1bmRlZmluZWQ7XG4gICAgc3dpdGNoIChleHRuYW1lKHN0eWxlc2hlZXRQYXRoKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICBjYXNlICdjc3MnOlxuICAgICAgICBzeW50YXggPSAnY3NzJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdzYXNzJzpcbiAgICAgICAgc3ludGF4ID0gJ2luZGVudGVkJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBzeW50YXggPSAnc2Nzcyc7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBjb250ZW50cyxcbiAgICAgIHN5bnRheCxcbiAgICAgIHNvdXJjZU1hcFVybDogY2Fub25pY2FsVXJsLFxuICAgIH07XG4gIH1cbn1cblxuLyoqXG4gKiBQcm92aWRlcyB0aGUgU2FzcyBpbXBvcnRlciBsb2dpYyB0byByZXNvbHZlIHJlbGF0aXZlIHN0eWxlc2hlZXQgaW1wb3J0cyB2aWEgYm90aCBpbXBvcnQgYW5kIHVzZSBydWxlc1xuICogYW5kIGFsc28gcmViYXNlIGFueSBgdXJsKClgIGZ1bmN0aW9uIHVzYWdlIHdpdGhpbiB0aG9zZSBzdHlsZXNoZWV0cy4gVGhlIHJlYmFzaW5nIHdpbGwgZW5zdXJlIHRoYXRcbiAqIHRoZSBVUkxzIGluIHRoZSBvdXRwdXQgb2YgdGhlIFNhc3MgY29tcGlsZXIgcmVmbGVjdCB0aGUgZmluYWwgZmlsZXN5c3RlbSBsb2NhdGlvbiBvZiB0aGUgb3V0cHV0IENTUyBmaWxlLlxuICovXG5leHBvcnQgY2xhc3MgUmVsYXRpdmVVcmxSZWJhc2luZ0ltcG9ydGVyIGV4dGVuZHMgVXJsUmViYXNpbmdJbXBvcnRlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGVudHJ5RGlyZWN0b3J5OiBzdHJpbmcsXG4gICAgcHJpdmF0ZSBkaXJlY3RvcnlDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBEaXJlbnRbXT4oKSxcbiAgICByZWJhc2VTb3VyY2VNYXBzPzogTWFwPHN0cmluZywgUmF3U291cmNlTWFwPixcbiAgKSB7XG4gICAgc3VwZXIoZW50cnlEaXJlY3RvcnksIHJlYmFzZVNvdXJjZU1hcHMpO1xuICB9XG5cbiAgY2Fub25pY2FsaXplKHVybDogc3RyaW5nLCBvcHRpb25zOiB7IGZyb21JbXBvcnQ6IGJvb2xlYW4gfSk6IFVSTCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLnJlc29sdmVJbXBvcnQodXJsLCBvcHRpb25zLmZyb21JbXBvcnQsIHRydWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEF0dGVtcHRzIHRvIHJlc29sdmUgYSBwcm92aWRlZCBVUkwgdG8gYSBzdHlsZXNoZWV0IGZpbGUgdXNpbmcgdGhlIFNhc3MgY29tcGlsZXIncyByZXNvbHV0aW9uIGFsZ29yaXRobS5cbiAgICogQmFzZWQgb24gaHR0cHM6Ly9naXRodWIuY29tL3Nhc3MvZGFydC1zYXNzL2Jsb2IvNDRkNmJiNmFjNzJmZTZiOTNmNWJmZWMzNzFhMWZmZmIxOGU2Yjc2ZC9saWIvc3JjL2ltcG9ydGVyL3V0aWxzLmRhcnRcbiAgICogQHBhcmFtIHVybCBUaGUgZmlsZSBwcm90b2NvbCBVUkwgdG8gcmVzb2x2ZS5cbiAgICogQHBhcmFtIGZyb21JbXBvcnQgSWYgdHJ1ZSwgVVJMIHdhcyBmcm9tIGFuIGltcG9ydCBydWxlOyBvdGhlcndpc2UgZnJvbSBhIHVzZSBydWxlLlxuICAgKiBAcGFyYW0gY2hlY2tEaXJlY3RvcnkgSWYgdHJ1ZSwgdHJ5IGNoZWNraW5nIGZvciBhIGRpcmVjdG9yeSB3aXRoIHRoZSBiYXNlIG5hbWUgY29udGFpbmluZyBhbiBpbmRleCBmaWxlLlxuICAgKiBAcmV0dXJucyBBIGZ1bGwgcmVzb2x2ZWQgVVJMIG9mIHRoZSBzdHlsZXNoZWV0IGZpbGUgb3IgYG51bGxgIGlmIG5vdCBmb3VuZC5cbiAgICovXG4gIHByaXZhdGUgcmVzb2x2ZUltcG9ydCh1cmw6IHN0cmluZywgZnJvbUltcG9ydDogYm9vbGVhbiwgY2hlY2tEaXJlY3Rvcnk6IGJvb2xlYW4pOiBVUkwgfCBudWxsIHtcbiAgICBsZXQgc3R5bGVzaGVldFBhdGg7XG4gICAgdHJ5IHtcbiAgICAgIHN0eWxlc2hlZXRQYXRoID0gZmlsZVVSTFRvUGF0aCh1cmwpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gT25seSBmaWxlIHByb3RvY29sIFVSTHMgYXJlIHN1cHBvcnRlZCBieSB0aGlzIGltcG9ydGVyXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBkaXJlY3RvcnkgPSBkaXJuYW1lKHN0eWxlc2hlZXRQYXRoKTtcbiAgICBjb25zdCBleHRlbnNpb24gPSBleHRuYW1lKHN0eWxlc2hlZXRQYXRoKTtcbiAgICBjb25zdCBoYXNTdHlsZUV4dGVuc2lvbiA9XG4gICAgICBleHRlbnNpb24gPT09ICcuc2NzcycgfHwgZXh0ZW5zaW9uID09PSAnLnNhc3MnIHx8IGV4dGVuc2lvbiA9PT0gJy5jc3MnO1xuICAgIC8vIFJlbW92ZSB0aGUgc3R5bGUgZXh0ZW5zaW9uIGlmIHByZXNlbnQgdG8gYWxsb3cgYWRkaW5nIHRoZSBgLmltcG9ydGAgc3VmZml4XG4gICAgY29uc3QgZmlsZW5hbWUgPSBiYXNlbmFtZShzdHlsZXNoZWV0UGF0aCwgaGFzU3R5bGVFeHRlbnNpb24gPyBleHRlbnNpb24gOiB1bmRlZmluZWQpO1xuXG4gICAgbGV0IGVudHJpZXM7XG4gICAgdHJ5IHtcbiAgICAgIGVudHJpZXMgPSB0aGlzLmRpcmVjdG9yeUNhY2hlLmdldChkaXJlY3RvcnkpO1xuICAgICAgaWYgKCFlbnRyaWVzKSB7XG4gICAgICAgIGVudHJpZXMgPSByZWFkZGlyU3luYyhkaXJlY3RvcnksIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcbiAgICAgICAgdGhpcy5kaXJlY3RvcnlDYWNoZS5zZXQoZGlyZWN0b3J5LCBlbnRyaWVzKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGltcG9ydFBvdGVudGlhbHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBkZWZhdWx0UG90ZW50aWFscyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgaWYgKGhhc1N0eWxlRXh0ZW5zaW9uKSB7XG4gICAgICBpZiAoZnJvbUltcG9ydCkge1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuaW1wb3J0JyArIGV4dGVuc2lvbik7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5pbXBvcnQnICsgZXh0ZW5zaW9uKTtcbiAgICAgIH1cbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArIGV4dGVuc2lvbik7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyBleHRlbnNpb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZnJvbUltcG9ydCkge1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuaW1wb3J0LnNjc3MnKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLmltcG9ydC5zYXNzJyk7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5pbXBvcnQuY3NzJyk7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5pbXBvcnQuc2NzcycpO1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuaW1wb3J0LnNhc3MnKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLmltcG9ydC5jc3MnKTtcbiAgICAgIH1cbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuc2NzcycpO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5zYXNzJyk7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLmNzcycpO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5zY3NzJyk7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLnNhc3MnKTtcbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuY3NzJyk7XG4gICAgfVxuXG4gICAgY29uc3QgZm91bmREZWZhdWx0czogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBmb3VuZEltcG9ydHM6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IGhhc1BvdGVudGlhbEluZGV4ID0gZmFsc2U7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgICAvLyBSZWNvcmQgaWYgdGhlIG5hbWUgc2hvdWxkIGJlIGNoZWNrZWQgYXMgYSBkaXJlY3Rvcnkgd2l0aCBhbiBpbmRleCBmaWxlXG4gICAgICBpZiAoY2hlY2tEaXJlY3RvcnkgJiYgIWhhc1N0eWxlRXh0ZW5zaW9uICYmIGVudHJ5Lm5hbWUgPT09IGZpbGVuYW1lICYmIGVudHJ5LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgaGFzUG90ZW50aWFsSW5kZXggPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWVudHJ5LmlzRmlsZSgpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoaW1wb3J0UG90ZW50aWFscy5oYXMoZW50cnkubmFtZSkpIHtcbiAgICAgICAgZm91bmRJbXBvcnRzLnB1c2goam9pbihkaXJlY3RvcnksIGVudHJ5Lm5hbWUpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGRlZmF1bHRQb3RlbnRpYWxzLmhhcyhlbnRyeS5uYW1lKSkge1xuICAgICAgICBmb3VuZERlZmF1bHRzLnB1c2goam9pbihkaXJlY3RvcnksIGVudHJ5Lm5hbWUpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBgZm91bmRJbXBvcnRzYCB3aWxsIG9ubHkgY29udGFpbiBlbGVtZW50cyBpZiBgb3B0aW9ucy5mcm9tSW1wb3J0YCBpcyB0cnVlXG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5jaGVja0ZvdW5kKGZvdW5kSW1wb3J0cykgPz8gdGhpcy5jaGVja0ZvdW5kKGZvdW5kRGVmYXVsdHMpO1xuXG4gICAgaWYgKHJlc3VsdCA9PT0gbnVsbCAmJiBoYXNQb3RlbnRpYWxJbmRleCkge1xuICAgICAgLy8gQ2hlY2sgZm9yIGluZGV4IGZpbGVzIHVzaW5nIGZpbGVuYW1lIGFzIGEgZGlyZWN0b3J5XG4gICAgICByZXR1cm4gdGhpcy5yZXNvbHZlSW1wb3J0KHVybCArICcvaW5kZXgnLCBmcm9tSW1wb3J0LCBmYWxzZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgYW4gYXJyYXkgb2YgcG90ZW50aWFsIHN0eWxlc2hlZXQgZmlsZXMgdG8gZGV0ZXJtaW5lIGlmIHRoZXJlIGlzIGEgdmFsaWRcbiAgICogc3R5bGVzaGVldCBmaWxlLiBNb3JlIHRoYW4gb25lIGRpc2NvdmVyZWQgZmlsZSBtYXkgaW5kaWNhdGUgYW4gZXJyb3IuXG4gICAqIEBwYXJhbSBmb3VuZCBBbiBhcnJheSBvZiBkaXNjb3ZlcmVkIHN0eWxlc2hlZXQgZmlsZXMuXG4gICAqIEByZXR1cm5zIEEgZnVsbHkgcmVzb2x2ZWQgVVJMIGZvciBhIHN0eWxlc2hlZXQgZmlsZSBvciBgbnVsbGAgaWYgbm90IGZvdW5kLlxuICAgKiBAdGhyb3dzIElmIHRoZXJlIGFyZSBhbWJpZ3VvdXMgZmlsZXMgZGlzY292ZXJlZC5cbiAgICovXG4gIHByaXZhdGUgY2hlY2tGb3VuZChmb3VuZDogc3RyaW5nW10pOiBVUkwgfCBudWxsIHtcbiAgICBpZiAoZm91bmQubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBOb3QgZm91bmRcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIE1vcmUgdGhhbiBvbmUgZm91bmQgZmlsZSBtYXkgYmUgYW4gZXJyb3JcbiAgICBpZiAoZm91bmQubGVuZ3RoID4gMSkge1xuICAgICAgLy8gUHJlc2VuY2Ugb2YgQ1NTIGZpbGVzIGFsb25nc2lkZSBhIFNhc3MgZmlsZSBkb2VzIG5vdCBjYXVzZSBhbiBlcnJvclxuICAgICAgY29uc3QgZm91bmRXaXRob3V0Q3NzID0gZm91bmQuZmlsdGVyKChlbGVtZW50KSA9PiBleHRuYW1lKGVsZW1lbnQpICE9PSAnLmNzcycpO1xuICAgICAgLy8gSWYgdGhlIGxlbmd0aCBpcyB6ZXJvIHRoZW4gdGhlcmUgYXJlIHR3byBvciBtb3JlIGNzcyBmaWxlc1xuICAgICAgLy8gSWYgdGhlIGxlbmd0aCBpcyBtb3JlIHRoYW4gb25lIHRoYW4gdGhlcmUgYXJlIHR3byBvciBtb3JlIHNhc3Mvc2NzcyBmaWxlc1xuICAgICAgaWYgKGZvdW5kV2l0aG91dENzcy5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbWJpZ3VvdXMgaW1wb3J0IGRldGVjdGVkLicpO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXR1cm4gdGhlIG5vbi1DU1MgZmlsZSAoc2Fzcy9zY3NzIGZpbGVzIGhhdmUgcHJpb3JpdHkpXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vc2Fzcy9kYXJ0LXNhc3MvYmxvYi80NGQ2YmI2YWM3MmZlNmI5M2Y1YmZlYzM3MWExZmZmYjE4ZTZiNzZkL2xpYi9zcmMvaW1wb3J0ZXIvdXRpbHMuZGFydCNMNDQtTDQ3XG4gICAgICByZXR1cm4gcGF0aFRvRmlsZVVSTChmb3VuZFdpdGhvdXRDc3NbMF0pO1xuICAgIH1cblxuICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKGZvdW5kWzBdKTtcbiAgfVxufVxuXG4vKipcbiAqIFByb3ZpZGVzIHRoZSBTYXNzIGltcG9ydGVyIGxvZ2ljIHRvIHJlc29sdmUgbW9kdWxlIChucG0gcGFja2FnZSkgc3R5bGVzaGVldCBpbXBvcnRzIHZpYSBib3RoIGltcG9ydCBhbmRcbiAqIHVzZSBydWxlcyBhbmQgYWxzbyByZWJhc2UgYW55IGB1cmwoKWAgZnVuY3Rpb24gdXNhZ2Ugd2l0aGluIHRob3NlIHN0eWxlc2hlZXRzLiBUaGUgcmViYXNpbmcgd2lsbCBlbnN1cmUgdGhhdFxuICogdGhlIFVSTHMgaW4gdGhlIG91dHB1dCBvZiB0aGUgU2FzcyBjb21waWxlciByZWZsZWN0IHRoZSBmaW5hbCBmaWxlc3lzdGVtIGxvY2F0aW9uIG9mIHRoZSBvdXRwdXQgQ1NTIGZpbGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBNb2R1bGVVcmxSZWJhc2luZ0ltcG9ydGVyIGV4dGVuZHMgUmVsYXRpdmVVcmxSZWJhc2luZ0ltcG9ydGVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgZW50cnlEaXJlY3Rvcnk6IHN0cmluZyxcbiAgICBkaXJlY3RvcnlDYWNoZTogTWFwPHN0cmluZywgRGlyZW50W10+LFxuICAgIHJlYmFzZVNvdXJjZU1hcHM6IE1hcDxzdHJpbmcsIFJhd1NvdXJjZU1hcD4gfCB1bmRlZmluZWQsXG4gICAgcHJpdmF0ZSBmaW5kZXI6IEZpbGVJbXBvcnRlcjwnc3luYyc+WydmaW5kRmlsZVVybCddLFxuICApIHtcbiAgICBzdXBlcihlbnRyeURpcmVjdG9yeSwgZGlyZWN0b3J5Q2FjaGUsIHJlYmFzZVNvdXJjZU1hcHMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2Fub25pY2FsaXplKHVybDogc3RyaW5nLCBvcHRpb25zOiB7IGZyb21JbXBvcnQ6IGJvb2xlYW4gfSk6IFVSTCB8IG51bGwge1xuICAgIGlmICh1cmwuc3RhcnRzV2l0aCgnZmlsZTovLycpKSB7XG4gICAgICByZXR1cm4gc3VwZXIuY2Fub25pY2FsaXplKHVybCwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5maW5kZXIodXJsLCBvcHRpb25zKTtcblxuICAgIHJldHVybiByZXN1bHQgPyBzdXBlci5jYW5vbmljYWxpemUocmVzdWx0LmhyZWYsIG9wdGlvbnMpIDogbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIFByb3ZpZGVzIHRoZSBTYXNzIGltcG9ydGVyIGxvZ2ljIHRvIHJlc29sdmUgbG9hZCBwYXRocyBsb2NhdGVkIHN0eWxlc2hlZXQgaW1wb3J0cyB2aWEgYm90aCBpbXBvcnQgYW5kXG4gKiB1c2UgcnVsZXMgYW5kIGFsc28gcmViYXNlIGFueSBgdXJsKClgIGZ1bmN0aW9uIHVzYWdlIHdpdGhpbiB0aG9zZSBzdHlsZXNoZWV0cy4gVGhlIHJlYmFzaW5nIHdpbGwgZW5zdXJlIHRoYXRcbiAqIHRoZSBVUkxzIGluIHRoZSBvdXRwdXQgb2YgdGhlIFNhc3MgY29tcGlsZXIgcmVmbGVjdCB0aGUgZmluYWwgZmlsZXN5c3RlbSBsb2NhdGlvbiBvZiB0aGUgb3V0cHV0IENTUyBmaWxlLlxuICovXG5leHBvcnQgY2xhc3MgTG9hZFBhdGhzVXJsUmViYXNpbmdJbXBvcnRlciBleHRlbmRzIFJlbGF0aXZlVXJsUmViYXNpbmdJbXBvcnRlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGVudHJ5RGlyZWN0b3J5OiBzdHJpbmcsXG4gICAgZGlyZWN0b3J5Q2FjaGU6IE1hcDxzdHJpbmcsIERpcmVudFtdPixcbiAgICByZWJhc2VTb3VyY2VNYXBzOiBNYXA8c3RyaW5nLCBSYXdTb3VyY2VNYXA+IHwgdW5kZWZpbmVkLFxuICAgIHByaXZhdGUgbG9hZFBhdGhzOiBJdGVyYWJsZTxzdHJpbmc+LFxuICApIHtcbiAgICBzdXBlcihlbnRyeURpcmVjdG9yeSwgZGlyZWN0b3J5Q2FjaGUsIHJlYmFzZVNvdXJjZU1hcHMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2Fub25pY2FsaXplKHVybDogc3RyaW5nLCBvcHRpb25zOiB7IGZyb21JbXBvcnQ6IGJvb2xlYW4gfSk6IFVSTCB8IG51bGwge1xuICAgIGlmICh1cmwuc3RhcnRzV2l0aCgnZmlsZTovLycpKSB7XG4gICAgICByZXR1cm4gc3VwZXIuY2Fub25pY2FsaXplKHVybCwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgbGV0IHJlc3VsdCA9IG51bGw7XG4gICAgZm9yIChjb25zdCBsb2FkUGF0aCBvZiB0aGlzLmxvYWRQYXRocykge1xuICAgICAgcmVzdWx0ID0gc3VwZXIuY2Fub25pY2FsaXplKHBhdGhUb0ZpbGVVUkwoam9pbihsb2FkUGF0aCwgdXJsKSkuaHJlZiwgb3B0aW9ucyk7XG4gICAgICBpZiAocmVzdWx0ICE9PSBudWxsKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuLyoqXG4gKiBXb3JrYXJvdW5kIGZvciBTYXNzIG5vdCBjYWxsaW5nIGluc3RhbmNlIG1ldGhvZHMgd2l0aCBgdGhpc2AuXG4gKiBUaGUgYGNhbm9uaWNhbGl6ZWAgYW5kIGBsb2FkYCBtZXRob2RzIHdpbGwgYmUgYm91bmQgdG8gdGhlIGNsYXNzIGluc3RhbmNlLlxuICogQHBhcmFtIGltcG9ydGVyIEEgU2FzcyBpbXBvcnRlciB0byBiaW5kLlxuICogQHJldHVybnMgVGhlIGJvdW5kIFNhc3MgaW1wb3J0ZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzYXNzQmluZFdvcmthcm91bmQ8VCBleHRlbmRzIEltcG9ydGVyPihpbXBvcnRlcjogVCk6IFQge1xuICBpbXBvcnRlci5jYW5vbmljYWxpemUgPSBpbXBvcnRlci5jYW5vbmljYWxpemUuYmluZChpbXBvcnRlcik7XG4gIGltcG9ydGVyLmxvYWQgPSBpbXBvcnRlci5sb2FkLmJpbmQoaW1wb3J0ZXIpO1xuXG4gIHJldHVybiBpbXBvcnRlcjtcbn1cbiJdfQ==