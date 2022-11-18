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
            catch (_c) {
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
        const result = (_a = this.checkFound(foundImports)) !== null && _a !== void 0 ? _a : this.checkFound(foundDefaults);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmViYXNpbmctaW1wb3J0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9zYXNzL3JlYmFzaW5nLWltcG9ydGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILGdFQUF1QztBQUN2QyxxQ0FBb0Q7QUFDcEQseUNBQXVFO0FBQ3ZFLHVDQUF3RDtBQUd4RDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsR0FBRyxzQ0FBc0MsQ0FBQztBQVcxRDs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBZSxtQkFBbUI7SUFDaEM7Ozs7T0FJRztJQUNILFlBQ1UsY0FBc0IsRUFDdEIsZ0JBQTRDO1FBRDVDLG1CQUFjLEdBQWQsY0FBYyxDQUFRO1FBQ3RCLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBNEI7SUFDbkQsQ0FBQztJQUlKLElBQUksQ0FBQyxZQUFpQjtRQUNwQixNQUFNLGNBQWMsR0FBRyxJQUFBLHdCQUFhLEVBQUMsWUFBWSxDQUFDLENBQUM7UUFDbkQsSUFBSSxRQUFRLEdBQUcsSUFBQSxzQkFBWSxFQUFDLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUVyRCxpQ0FBaUM7UUFDakMsSUFBSSxRQUFRLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQzdCLE1BQU0sbUJBQW1CLEdBQUcsSUFBQSxtQkFBTyxFQUFDLGNBQWMsQ0FBQyxDQUFDO1lBRXBELElBQUksS0FBSyxDQUFDO1lBQ1YsVUFBVSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7WUFDekIsSUFBSSxlQUFlLENBQUM7WUFDcEIsT0FBTyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUU7Z0JBQzFDLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFFN0Is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QVMsQ0FBa0I7SUFHckMsQ0FBQztJQUVRLFlBQVksQ0FBQyxHQUFXLEVBQUUsT0FBZ0M7UUFDakUsSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQzdCLE9BQU8sS0FBSyxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7U0FDekM7UUFFRCxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUM7UUFDbEIsS0FBSyxNQUFNLFFBQVEsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO1lBQ3JDLE1BQU0sR0FBRyxLQUFLLENBQUMsWUFBWSxDQUFDLElBQUEsd0JBQWEsRUFBQyxJQUFBLGdCQUFJLEVBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzlFLElBQUksTUFBTSxLQUFLLElBQUksRUFBRTtnQkFDbkIsTUFBTTthQUNQO1NBQ0Y7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0NBQ0Y7QUF6QkQsb0VBeUJDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxTQUFnQixrQkFBa0IsQ0FBcUIsUUFBVztJQUNoRSxRQUFRLENBQUMsWUFBWSxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzdELFFBQVEsQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFN0MsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQztBQUxELGdEQUtDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IFJhd1NvdXJjZU1hcCB9IGZyb20gJ0BhbXBwcm9qZWN0L3JlbWFwcGluZyc7XG5pbXBvcnQgTWFnaWNTdHJpbmcgZnJvbSAnbWFnaWMtc3RyaW5nJztcbmltcG9ydCB7IHJlYWRGaWxlU3luYywgcmVhZGRpclN5bmMgfSBmcm9tICdub2RlOmZzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBkaXJuYW1lLCBleHRuYW1lLCBqb2luLCByZWxhdGl2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBwYXRoVG9GaWxlVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IHR5cGUgeyBGaWxlSW1wb3J0ZXIsIEltcG9ydGVyLCBJbXBvcnRlclJlc3VsdCwgU3ludGF4IH0gZnJvbSAnc2Fzcyc7XG5cbi8qKlxuICogQSBSZWd1bGFyIGV4cHJlc3Npb24gdXNlZCB0byBmaW5kIGFsbCBgdXJsKClgIGZ1bmN0aW9ucyB3aXRoaW4gYSBzdHlsZXNoZWV0LlxuICogRnJvbSBwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3BsdWdpbnMvcG9zdGNzcy1jbGktcmVzb3VyY2VzLnRzXG4gKi9cbmNvbnN0IFVSTF9SRUdFWFAgPSAvdXJsKD86XFwoXFxzKihbJ1wiXT8pKSguKj8pKD86XFwxXFxzKlxcKSkvZztcblxuLyoqXG4gKiBBIHByZXByb2Nlc3NlZCBjYWNoZSBlbnRyeSBmb3IgdGhlIGZpbGVzIGFuZCBkaXJlY3RvcmllcyB3aXRoaW4gYSBwcmV2aW91c2x5IHNlYXJjaGVkXG4gKiBkaXJlY3Rvcnkgd2hlbiBwZXJmb3JtaW5nIFNhc3MgaW1wb3J0IHJlc29sdXRpb24uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGlyZWN0b3J5RW50cnkge1xuICBmaWxlczogU2V0PHN0cmluZz47XG4gIGRpcmVjdG9yaWVzOiBTZXQ8c3RyaW5nPjtcbn1cblxuLyoqXG4gKiBBIFNhc3MgSW1wb3J0ZXIgYmFzZSBjbGFzcyB0aGF0IHByb3ZpZGVzIHRoZSBsb2FkIGxvZ2ljIHRvIHJlYmFzZSBhbGwgYHVybCgpYCBmdW5jdGlvbnNcbiAqIHdpdGhpbiBhIHN0eWxlc2hlZXQuIFRoZSByZWJhc2luZyB3aWxsIGVuc3VyZSB0aGF0IHRoZSBVUkxzIGluIHRoZSBvdXRwdXQgb2YgdGhlIFNhc3MgY29tcGlsZXJcbiAqIHJlZmxlY3QgdGhlIGZpbmFsIGZpbGVzeXN0ZW0gbG9jYXRpb24gb2YgdGhlIG91dHB1dCBDU1MgZmlsZS5cbiAqXG4gKiBUaGlzIGNsYXNzIHByb3ZpZGVzIHRoZSBjb3JlIG9mIHRoZSByZWJhc2luZyBmdW5jdGlvbmFsaXR5LiBUbyBlbnN1cmUgdGhhdCBlYWNoIGZpbGUgaXMgcHJvY2Vzc2VkXG4gKiBieSB0aGlzIGltcG9ydGVyJ3MgbG9hZCBpbXBsZW1lbnRhdGlvbiwgdGhlIFNhc3MgY29tcGlsZXIgcmVxdWlyZXMgdGhlIGltcG9ydGVyJ3MgY2Fub25pY2FsaXplXG4gKiBmdW5jdGlvbiB0byByZXR1cm4gYSBub24tbnVsbCB2YWx1ZSB3aXRoIHRoZSByZXNvbHZlZCBsb2NhdGlvbiBvZiB0aGUgcmVxdWVzdGVkIHN0eWxlc2hlZXQuXG4gKiBDb25jcmV0ZSBpbXBsZW1lbnRhdGlvbnMgb2YgdGhpcyBjbGFzcyBtdXN0IHByb3ZpZGUgdGhpcyBjYW5vbmljYWxpemUgZnVuY3Rpb25hbGl0eSBmb3IgcmViYXNpbmdcbiAqIHRvIGJlIGVmZmVjdGl2ZS5cbiAqL1xuYWJzdHJhY3QgY2xhc3MgVXJsUmViYXNpbmdJbXBvcnRlciBpbXBsZW1lbnRzIEltcG9ydGVyPCdzeW5jJz4ge1xuICAvKipcbiAgICogQHBhcmFtIGVudHJ5RGlyZWN0b3J5IFRoZSBkaXJlY3Rvcnkgb2YgdGhlIGVudHJ5IHN0eWxlc2hlZXQgdGhhdCB3YXMgcGFzc2VkIHRvIHRoZSBTYXNzIGNvbXBpbGVyLlxuICAgKiBAcGFyYW0gcmViYXNlU291cmNlTWFwcyBXaGVuIHByb3ZpZGVkLCByZWJhc2VkIGZpbGVzIHdpbGwgaGF2ZSBhbiBpbnRlcm1lZGlhdGUgc291cmNlbWFwIGFkZGVkIHRvIHRoZSBNYXBcbiAgICogd2hpY2ggY2FuIGJlIHVzZWQgdG8gZ2VuZXJhdGUgYSBmaW5hbCBzb3VyY2VtYXAgdGhhdCBjb250YWlucyBvcmlnaW5hbCBzb3VyY2VzLlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBlbnRyeURpcmVjdG9yeTogc3RyaW5nLFxuICAgIHByaXZhdGUgcmViYXNlU291cmNlTWFwcz86IE1hcDxzdHJpbmcsIFJhd1NvdXJjZU1hcD4sXG4gICkge31cblxuICBhYnN0cmFjdCBjYW5vbmljYWxpemUodXJsOiBzdHJpbmcsIG9wdGlvbnM6IHsgZnJvbUltcG9ydDogYm9vbGVhbiB9KTogVVJMIHwgbnVsbDtcblxuICBsb2FkKGNhbm9uaWNhbFVybDogVVJMKTogSW1wb3J0ZXJSZXN1bHQgfCBudWxsIHtcbiAgICBjb25zdCBzdHlsZXNoZWV0UGF0aCA9IGZpbGVVUkxUb1BhdGgoY2Fub25pY2FsVXJsKTtcbiAgICBsZXQgY29udGVudHMgPSByZWFkRmlsZVN5bmMoc3R5bGVzaGVldFBhdGgsICd1dGYtOCcpO1xuXG4gICAgLy8gUmViYXNlIGFueSBVUkxzIHRoYXQgYXJlIGZvdW5kXG4gICAgaWYgKGNvbnRlbnRzLmluY2x1ZGVzKCd1cmwoJykpIHtcbiAgICAgIGNvbnN0IHN0eWxlc2hlZXREaXJlY3RvcnkgPSBkaXJuYW1lKHN0eWxlc2hlZXRQYXRoKTtcblxuICAgICAgbGV0IG1hdGNoO1xuICAgICAgVVJMX1JFR0VYUC5sYXN0SW5kZXggPSAwO1xuICAgICAgbGV0IHVwZGF0ZWRDb250ZW50cztcbiAgICAgIHdoaWxlICgobWF0Y2ggPSBVUkxfUkVHRVhQLmV4ZWMoY29udGVudHMpKSkge1xuICAgICAgICBjb25zdCBvcmlnaW5hbFVybCA9IG1hdGNoWzJdO1xuXG4gICAgICAgIC8vIElmIHJvb3QtcmVsYXRpdmUsIGFic29sdXRlIG9yIHByb3RvY29sIHJlbGF0aXZlIHVybCwgbGVhdmUgYXMtaXNcbiAgICAgICAgaWYgKC9eKCg/Olxcdys6KT9cXC9cXC98ZGF0YTp8Y2hyb21lOnwjfFxcLykvLnRlc3Qob3JpZ2luYWxVcmwpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZWJhc2VkUGF0aCA9IHJlbGF0aXZlKHRoaXMuZW50cnlEaXJlY3RvcnksIGpvaW4oc3R5bGVzaGVldERpcmVjdG9yeSwgb3JpZ2luYWxVcmwpKTtcblxuICAgICAgICAvLyBOb3JtYWxpemUgcGF0aCBzZXBhcmF0b3JzIGFuZCBlc2NhcGUgY2hhcmFjdGVyc1xuICAgICAgICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9DU1MvdXJsI3N5bnRheFxuICAgICAgICBjb25zdCByZWJhc2VkVXJsID0gJy4vJyArIHJlYmFzZWRQYXRoLnJlcGxhY2UoL1xcXFwvZywgJy8nKS5yZXBsYWNlKC9bKClcXHMnXCJdL2csICdcXFxcJCYnKTtcblxuICAgICAgICB1cGRhdGVkQ29udGVudHMgPz89IG5ldyBNYWdpY1N0cmluZyhjb250ZW50cyk7XG4gICAgICAgIHVwZGF0ZWRDb250ZW50cy51cGRhdGUobWF0Y2guaW5kZXgsIG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoLCBgdXJsKCR7cmViYXNlZFVybH0pYCk7XG4gICAgICB9XG5cbiAgICAgIGlmICh1cGRhdGVkQ29udGVudHMpIHtcbiAgICAgICAgY29udGVudHMgPSB1cGRhdGVkQ29udGVudHMudG9TdHJpbmcoKTtcbiAgICAgICAgaWYgKHRoaXMucmViYXNlU291cmNlTWFwcykge1xuICAgICAgICAgIC8vIEdlbmVyYXRlIGFuIGludGVybWVkaWF0ZSBzb3VyY2UgbWFwIGZvciB0aGUgcmViYXNpbmcgY2hhbmdlc1xuICAgICAgICAgIGNvbnN0IG1hcCA9IHVwZGF0ZWRDb250ZW50cy5nZW5lcmF0ZU1hcCh7XG4gICAgICAgICAgICBoaXJlczogdHJ1ZSxcbiAgICAgICAgICAgIGluY2x1ZGVDb250ZW50OiB0cnVlLFxuICAgICAgICAgICAgc291cmNlOiBjYW5vbmljYWxVcmwuaHJlZixcbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0aGlzLnJlYmFzZVNvdXJjZU1hcHMuc2V0KGNhbm9uaWNhbFVybC5ocmVmLCBtYXAgYXMgUmF3U291cmNlTWFwKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGxldCBzeW50YXg6IFN5bnRheCB8IHVuZGVmaW5lZDtcbiAgICBzd2l0Y2ggKGV4dG5hbWUoc3R5bGVzaGVldFBhdGgpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgIGNhc2UgJ2Nzcyc6XG4gICAgICAgIHN5bnRheCA9ICdjc3MnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3Nhc3MnOlxuICAgICAgICBzeW50YXggPSAnaW5kZW50ZWQnO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHN5bnRheCA9ICdzY3NzJztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRlbnRzLFxuICAgICAgc3ludGF4LFxuICAgICAgc291cmNlTWFwVXJsOiBjYW5vbmljYWxVcmwsXG4gICAgfTtcbiAgfVxufVxuXG4vKipcbiAqIFByb3ZpZGVzIHRoZSBTYXNzIGltcG9ydGVyIGxvZ2ljIHRvIHJlc29sdmUgcmVsYXRpdmUgc3R5bGVzaGVldCBpbXBvcnRzIHZpYSBib3RoIGltcG9ydCBhbmQgdXNlIHJ1bGVzXG4gKiBhbmQgYWxzbyByZWJhc2UgYW55IGB1cmwoKWAgZnVuY3Rpb24gdXNhZ2Ugd2l0aGluIHRob3NlIHN0eWxlc2hlZXRzLiBUaGUgcmViYXNpbmcgd2lsbCBlbnN1cmUgdGhhdFxuICogdGhlIFVSTHMgaW4gdGhlIG91dHB1dCBvZiB0aGUgU2FzcyBjb21waWxlciByZWZsZWN0IHRoZSBmaW5hbCBmaWxlc3lzdGVtIGxvY2F0aW9uIG9mIHRoZSBvdXRwdXQgQ1NTIGZpbGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZWxhdGl2ZVVybFJlYmFzaW5nSW1wb3J0ZXIgZXh0ZW5kcyBVcmxSZWJhc2luZ0ltcG9ydGVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgZW50cnlEaXJlY3Rvcnk6IHN0cmluZyxcbiAgICBwcml2YXRlIGRpcmVjdG9yeUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIERpcmVjdG9yeUVudHJ5PigpLFxuICAgIHJlYmFzZVNvdXJjZU1hcHM/OiBNYXA8c3RyaW5nLCBSYXdTb3VyY2VNYXA+LFxuICApIHtcbiAgICBzdXBlcihlbnRyeURpcmVjdG9yeSwgcmViYXNlU291cmNlTWFwcyk7XG4gIH1cblxuICBjYW5vbmljYWxpemUodXJsOiBzdHJpbmcsIG9wdGlvbnM6IHsgZnJvbUltcG9ydDogYm9vbGVhbiB9KTogVVJMIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMucmVzb2x2ZUltcG9ydCh1cmwsIG9wdGlvbnMuZnJvbUltcG9ydCwgdHJ1ZSk7XG4gIH1cblxuICAvKipcbiAgICogQXR0ZW1wdHMgdG8gcmVzb2x2ZSBhIHByb3ZpZGVkIFVSTCB0byBhIHN0eWxlc2hlZXQgZmlsZSB1c2luZyB0aGUgU2FzcyBjb21waWxlcidzIHJlc29sdXRpb24gYWxnb3JpdGhtLlxuICAgKiBCYXNlZCBvbiBodHRwczovL2dpdGh1Yi5jb20vc2Fzcy9kYXJ0LXNhc3MvYmxvYi80NGQ2YmI2YWM3MmZlNmI5M2Y1YmZlYzM3MWExZmZmYjE4ZTZiNzZkL2xpYi9zcmMvaW1wb3J0ZXIvdXRpbHMuZGFydFxuICAgKiBAcGFyYW0gdXJsIFRoZSBmaWxlIHByb3RvY29sIFVSTCB0byByZXNvbHZlLlxuICAgKiBAcGFyYW0gZnJvbUltcG9ydCBJZiB0cnVlLCBVUkwgd2FzIGZyb20gYW4gaW1wb3J0IHJ1bGU7IG90aGVyd2lzZSBmcm9tIGEgdXNlIHJ1bGUuXG4gICAqIEBwYXJhbSBjaGVja0RpcmVjdG9yeSBJZiB0cnVlLCB0cnkgY2hlY2tpbmcgZm9yIGEgZGlyZWN0b3J5IHdpdGggdGhlIGJhc2UgbmFtZSBjb250YWluaW5nIGFuIGluZGV4IGZpbGUuXG4gICAqIEByZXR1cm5zIEEgZnVsbCByZXNvbHZlZCBVUkwgb2YgdGhlIHN0eWxlc2hlZXQgZmlsZSBvciBgbnVsbGAgaWYgbm90IGZvdW5kLlxuICAgKi9cbiAgcHJpdmF0ZSByZXNvbHZlSW1wb3J0KHVybDogc3RyaW5nLCBmcm9tSW1wb3J0OiBib29sZWFuLCBjaGVja0RpcmVjdG9yeTogYm9vbGVhbik6IFVSTCB8IG51bGwge1xuICAgIGxldCBzdHlsZXNoZWV0UGF0aDtcbiAgICB0cnkge1xuICAgICAgc3R5bGVzaGVldFBhdGggPSBmaWxlVVJMVG9QYXRoKHVybCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBPbmx5IGZpbGUgcHJvdG9jb2wgVVJMcyBhcmUgc3VwcG9ydGVkIGJ5IHRoaXMgaW1wb3J0ZXJcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGRpcmVjdG9yeSA9IGRpcm5hbWUoc3R5bGVzaGVldFBhdGgpO1xuICAgIGNvbnN0IGV4dGVuc2lvbiA9IGV4dG5hbWUoc3R5bGVzaGVldFBhdGgpO1xuICAgIGNvbnN0IGhhc1N0eWxlRXh0ZW5zaW9uID1cbiAgICAgIGV4dGVuc2lvbiA9PT0gJy5zY3NzJyB8fCBleHRlbnNpb24gPT09ICcuc2FzcycgfHwgZXh0ZW5zaW9uID09PSAnLmNzcyc7XG4gICAgLy8gUmVtb3ZlIHRoZSBzdHlsZSBleHRlbnNpb24gaWYgcHJlc2VudCB0byBhbGxvdyBhZGRpbmcgdGhlIGAuaW1wb3J0YCBzdWZmaXhcbiAgICBjb25zdCBmaWxlbmFtZSA9IGJhc2VuYW1lKHN0eWxlc2hlZXRQYXRoLCBoYXNTdHlsZUV4dGVuc2lvbiA/IGV4dGVuc2lvbiA6IHVuZGVmaW5lZCk7XG5cbiAgICBjb25zdCBpbXBvcnRQb3RlbnRpYWxzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgZGVmYXVsdFBvdGVudGlhbHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAgIGlmIChoYXNTdHlsZUV4dGVuc2lvbikge1xuICAgICAgaWYgKGZyb21JbXBvcnQpIHtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLmltcG9ydCcgKyBleHRlbnNpb24pO1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuaW1wb3J0JyArIGV4dGVuc2lvbik7XG4gICAgICB9XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyBleHRlbnNpb24pO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgZXh0ZW5zaW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGZyb21JbXBvcnQpIHtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLmltcG9ydC5zY3NzJyk7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5pbXBvcnQuc2FzcycpO1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuaW1wb3J0LmNzcycpO1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuaW1wb3J0LnNjc3MnKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLmltcG9ydC5zYXNzJyk7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5pbXBvcnQuY3NzJyk7XG4gICAgICB9XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLnNjc3MnKTtcbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuc2FzcycpO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5jc3MnKTtcbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuc2NzcycpO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5zYXNzJyk7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLmNzcycpO1xuICAgIH1cblxuICAgIGxldCBmb3VuZERlZmF1bHRzO1xuICAgIGxldCBmb3VuZEltcG9ydHM7XG4gICAgbGV0IGhhc1BvdGVudGlhbEluZGV4ID0gZmFsc2U7XG5cbiAgICBsZXQgY2FjaGVkRW50cmllcyA9IHRoaXMuZGlyZWN0b3J5Q2FjaGUuZ2V0KGRpcmVjdG9yeSk7XG4gICAgaWYgKGNhY2hlZEVudHJpZXMpIHtcbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgcHJlcHJvY2Vzc2VkIGNhY2hlIG9mIHRoZSBkaXJlY3RvcnksIHBlcmZvcm0gYW4gaW50ZXJzZWN0aW9uIG9mIHRoZSBwb3RlbnRpYWxzXG4gICAgICAvLyBhbmQgdGhlIGRpcmVjdG9yeSBmaWxlcy5cbiAgICAgIGNvbnN0IHsgZmlsZXMsIGRpcmVjdG9yaWVzIH0gPSBjYWNoZWRFbnRyaWVzO1xuICAgICAgZm91bmREZWZhdWx0cyA9IFsuLi5kZWZhdWx0UG90ZW50aWFsc10uZmlsdGVyKChwb3RlbnRpYWwpID0+IGZpbGVzLmhhcyhwb3RlbnRpYWwpKTtcbiAgICAgIGZvdW5kSW1wb3J0cyA9IFsuLi5pbXBvcnRQb3RlbnRpYWxzXS5maWx0ZXIoKHBvdGVudGlhbCkgPT4gZmlsZXMuaGFzKHBvdGVudGlhbCkpO1xuICAgICAgaGFzUG90ZW50aWFsSW5kZXggPSBjaGVja0RpcmVjdG9yeSAmJiAhaGFzU3R5bGVFeHRlbnNpb24gJiYgZGlyZWN0b3JpZXMuaGFzKGZpbGVuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSWYgbm8gcHJlcHJvY2Vzc2VkIGNhY2hlIGV4aXN0cywgZ2V0IHRoZSBlbnRyaWVzIGZyb20gdGhlIGZpbGUgc3lzdGVtIGFuZCwgd2hpbGUgc2VhcmNoaW5nLFxuICAgICAgLy8gZ2VuZXJhdGUgdGhlIGNhY2hlIGZvciBsYXRlciByZXF1ZXN0cy5cbiAgICAgIGxldCBlbnRyaWVzO1xuICAgICAgdHJ5IHtcbiAgICAgICAgZW50cmllcyA9IHJlYWRkaXJTeW5jKGRpcmVjdG9yeSwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBmb3VuZERlZmF1bHRzID0gW107XG4gICAgICBmb3VuZEltcG9ydHMgPSBbXTtcbiAgICAgIGNhY2hlZEVudHJpZXMgPSB7IGZpbGVzOiBuZXcgU2V0PHN0cmluZz4oKSwgZGlyZWN0b3JpZXM6IG5ldyBTZXQ8c3RyaW5nPigpIH07XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXMpIHtcbiAgICAgICAgY29uc3QgaXNEaXJlY3RvcnkgPSBlbnRyeS5pc0RpcmVjdG9yeSgpO1xuICAgICAgICBpZiAoaXNEaXJlY3RvcnkpIHtcbiAgICAgICAgICBjYWNoZWRFbnRyaWVzLmRpcmVjdG9yaWVzLmFkZChlbnRyeS5uYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlY29yZCBpZiB0aGUgbmFtZSBzaG91bGQgYmUgY2hlY2tlZCBhcyBhIGRpcmVjdG9yeSB3aXRoIGFuIGluZGV4IGZpbGVcbiAgICAgICAgaWYgKGNoZWNrRGlyZWN0b3J5ICYmICFoYXNTdHlsZUV4dGVuc2lvbiAmJiBlbnRyeS5uYW1lID09PSBmaWxlbmFtZSAmJiBpc0RpcmVjdG9yeSkge1xuICAgICAgICAgIGhhc1BvdGVudGlhbEluZGV4ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZW50cnkuaXNGaWxlKCkpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNhY2hlZEVudHJpZXMuZmlsZXMuYWRkKGVudHJ5Lm5hbWUpO1xuXG4gICAgICAgIGlmIChpbXBvcnRQb3RlbnRpYWxzLmhhcyhlbnRyeS5uYW1lKSkge1xuICAgICAgICAgIGZvdW5kSW1wb3J0cy5wdXNoKGVudHJ5Lm5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRlZmF1bHRQb3RlbnRpYWxzLmhhcyhlbnRyeS5uYW1lKSkge1xuICAgICAgICAgIGZvdW5kRGVmYXVsdHMucHVzaChlbnRyeS5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLmRpcmVjdG9yeUNhY2hlLnNldChkaXJlY3RvcnksIGNhY2hlZEVudHJpZXMpO1xuICAgIH1cblxuICAgIC8vIGBmb3VuZEltcG9ydHNgIHdpbGwgb25seSBjb250YWluIGVsZW1lbnRzIGlmIGBvcHRpb25zLmZyb21JbXBvcnRgIGlzIHRydWVcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLmNoZWNrRm91bmQoZm91bmRJbXBvcnRzKSA/PyB0aGlzLmNoZWNrRm91bmQoZm91bmREZWZhdWx0cyk7XG4gICAgaWYgKHJlc3VsdCAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHBhdGhUb0ZpbGVVUkwoam9pbihkaXJlY3RvcnksIHJlc3VsdCkpO1xuICAgIH1cblxuICAgIGlmIChoYXNQb3RlbnRpYWxJbmRleCkge1xuICAgICAgLy8gQ2hlY2sgZm9yIGluZGV4IGZpbGVzIHVzaW5nIGZpbGVuYW1lIGFzIGEgZGlyZWN0b3J5XG4gICAgICByZXR1cm4gdGhpcy5yZXNvbHZlSW1wb3J0KHVybCArICcvaW5kZXgnLCBmcm9tSW1wb3J0LCBmYWxzZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGFuIGFycmF5IG9mIHBvdGVudGlhbCBzdHlsZXNoZWV0IGZpbGVzIHRvIGRldGVybWluZSBpZiB0aGVyZSBpcyBhIHZhbGlkXG4gICAqIHN0eWxlc2hlZXQgZmlsZS4gTW9yZSB0aGFuIG9uZSBkaXNjb3ZlcmVkIGZpbGUgbWF5IGluZGljYXRlIGFuIGVycm9yLlxuICAgKiBAcGFyYW0gZm91bmQgQW4gYXJyYXkgb2YgZGlzY292ZXJlZCBzdHlsZXNoZWV0IGZpbGVzLlxuICAgKiBAcmV0dXJucyBBIGZ1bGx5IHJlc29sdmVkIHBhdGggZm9yIGEgc3R5bGVzaGVldCBmaWxlIG9yIGBudWxsYCBpZiBub3QgZm91bmQuXG4gICAqIEB0aHJvd3MgSWYgdGhlcmUgYXJlIGFtYmlndW91cyBmaWxlcyBkaXNjb3ZlcmVkLlxuICAgKi9cbiAgcHJpdmF0ZSBjaGVja0ZvdW5kKGZvdW5kOiBzdHJpbmdbXSk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmIChmb3VuZC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIE5vdCBmb3VuZFxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gTW9yZSB0aGFuIG9uZSBmb3VuZCBmaWxlIG1heSBiZSBhbiBlcnJvclxuICAgIGlmIChmb3VuZC5sZW5ndGggPiAxKSB7XG4gICAgICAvLyBQcmVzZW5jZSBvZiBDU1MgZmlsZXMgYWxvbmdzaWRlIGEgU2FzcyBmaWxlIGRvZXMgbm90IGNhdXNlIGFuIGVycm9yXG4gICAgICBjb25zdCBmb3VuZFdpdGhvdXRDc3MgPSBmb3VuZC5maWx0ZXIoKGVsZW1lbnQpID0+IGV4dG5hbWUoZWxlbWVudCkgIT09ICcuY3NzJyk7XG4gICAgICAvLyBJZiB0aGUgbGVuZ3RoIGlzIHplcm8gdGhlbiB0aGVyZSBhcmUgdHdvIG9yIG1vcmUgY3NzIGZpbGVzXG4gICAgICAvLyBJZiB0aGUgbGVuZ3RoIGlzIG1vcmUgdGhhbiBvbmUgdGhhbiB0aGVyZSBhcmUgdHdvIG9yIG1vcmUgc2Fzcy9zY3NzIGZpbGVzXG4gICAgICBpZiAoZm91bmRXaXRob3V0Q3NzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FtYmlndW91cyBpbXBvcnQgZGV0ZWN0ZWQuJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJldHVybiB0aGUgbm9uLUNTUyBmaWxlIChzYXNzL3Njc3MgZmlsZXMgaGF2ZSBwcmlvcml0eSlcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9zYXNzL2RhcnQtc2Fzcy9ibG9iLzQ0ZDZiYjZhYzcyZmU2YjkzZjViZmVjMzcxYTFmZmZiMThlNmI3NmQvbGliL3NyYy9pbXBvcnRlci91dGlscy5kYXJ0I0w0NC1MNDdcbiAgICAgIHJldHVybiBmb3VuZFdpdGhvdXRDc3NbMF07XG4gICAgfVxuXG4gICAgcmV0dXJuIGZvdW5kWzBdO1xuICB9XG59XG5cbi8qKlxuICogUHJvdmlkZXMgdGhlIFNhc3MgaW1wb3J0ZXIgbG9naWMgdG8gcmVzb2x2ZSBtb2R1bGUgKG5wbSBwYWNrYWdlKSBzdHlsZXNoZWV0IGltcG9ydHMgdmlhIGJvdGggaW1wb3J0IGFuZFxuICogdXNlIHJ1bGVzIGFuZCBhbHNvIHJlYmFzZSBhbnkgYHVybCgpYCBmdW5jdGlvbiB1c2FnZSB3aXRoaW4gdGhvc2Ugc3R5bGVzaGVldHMuIFRoZSByZWJhc2luZyB3aWxsIGVuc3VyZSB0aGF0XG4gKiB0aGUgVVJMcyBpbiB0aGUgb3V0cHV0IG9mIHRoZSBTYXNzIGNvbXBpbGVyIHJlZmxlY3QgdGhlIGZpbmFsIGZpbGVzeXN0ZW0gbG9jYXRpb24gb2YgdGhlIG91dHB1dCBDU1MgZmlsZS5cbiAqL1xuZXhwb3J0IGNsYXNzIE1vZHVsZVVybFJlYmFzaW5nSW1wb3J0ZXIgZXh0ZW5kcyBSZWxhdGl2ZVVybFJlYmFzaW5nSW1wb3J0ZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICBlbnRyeURpcmVjdG9yeTogc3RyaW5nLFxuICAgIGRpcmVjdG9yeUNhY2hlOiBNYXA8c3RyaW5nLCBEaXJlY3RvcnlFbnRyeT4sXG4gICAgcmViYXNlU291cmNlTWFwczogTWFwPHN0cmluZywgUmF3U291cmNlTWFwPiB8IHVuZGVmaW5lZCxcbiAgICBwcml2YXRlIGZpbmRlcjogRmlsZUltcG9ydGVyPCdzeW5jJz5bJ2ZpbmRGaWxlVXJsJ10sXG4gICkge1xuICAgIHN1cGVyKGVudHJ5RGlyZWN0b3J5LCBkaXJlY3RvcnlDYWNoZSwgcmViYXNlU291cmNlTWFwcyk7XG4gIH1cblxuICBvdmVycmlkZSBjYW5vbmljYWxpemUodXJsOiBzdHJpbmcsIG9wdGlvbnM6IHsgZnJvbUltcG9ydDogYm9vbGVhbiB9KTogVVJMIHwgbnVsbCB7XG4gICAgaWYgKHVybC5zdGFydHNXaXRoKCdmaWxlOi8vJykpIHtcbiAgICAgIHJldHVybiBzdXBlci5jYW5vbmljYWxpemUodXJsLCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLmZpbmRlcih1cmwsIG9wdGlvbnMpO1xuXG4gICAgcmV0dXJuIHJlc3VsdCA/IHN1cGVyLmNhbm9uaWNhbGl6ZShyZXN1bHQuaHJlZiwgb3B0aW9ucykgOiBudWxsO1xuICB9XG59XG5cbi8qKlxuICogUHJvdmlkZXMgdGhlIFNhc3MgaW1wb3J0ZXIgbG9naWMgdG8gcmVzb2x2ZSBsb2FkIHBhdGhzIGxvY2F0ZWQgc3R5bGVzaGVldCBpbXBvcnRzIHZpYSBib3RoIGltcG9ydCBhbmRcbiAqIHVzZSBydWxlcyBhbmQgYWxzbyByZWJhc2UgYW55IGB1cmwoKWAgZnVuY3Rpb24gdXNhZ2Ugd2l0aGluIHRob3NlIHN0eWxlc2hlZXRzLiBUaGUgcmViYXNpbmcgd2lsbCBlbnN1cmUgdGhhdFxuICogdGhlIFVSTHMgaW4gdGhlIG91dHB1dCBvZiB0aGUgU2FzcyBjb21waWxlciByZWZsZWN0IHRoZSBmaW5hbCBmaWxlc3lzdGVtIGxvY2F0aW9uIG9mIHRoZSBvdXRwdXQgQ1NTIGZpbGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBMb2FkUGF0aHNVcmxSZWJhc2luZ0ltcG9ydGVyIGV4dGVuZHMgUmVsYXRpdmVVcmxSZWJhc2luZ0ltcG9ydGVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgZW50cnlEaXJlY3Rvcnk6IHN0cmluZyxcbiAgICBkaXJlY3RvcnlDYWNoZTogTWFwPHN0cmluZywgRGlyZWN0b3J5RW50cnk+LFxuICAgIHJlYmFzZVNvdXJjZU1hcHM6IE1hcDxzdHJpbmcsIFJhd1NvdXJjZU1hcD4gfCB1bmRlZmluZWQsXG4gICAgcHJpdmF0ZSBsb2FkUGF0aHM6IEl0ZXJhYmxlPHN0cmluZz4sXG4gICkge1xuICAgIHN1cGVyKGVudHJ5RGlyZWN0b3J5LCBkaXJlY3RvcnlDYWNoZSwgcmViYXNlU291cmNlTWFwcyk7XG4gIH1cblxuICBvdmVycmlkZSBjYW5vbmljYWxpemUodXJsOiBzdHJpbmcsIG9wdGlvbnM6IHsgZnJvbUltcG9ydDogYm9vbGVhbiB9KTogVVJMIHwgbnVsbCB7XG4gICAgaWYgKHVybC5zdGFydHNXaXRoKCdmaWxlOi8vJykpIHtcbiAgICAgIHJldHVybiBzdXBlci5jYW5vbmljYWxpemUodXJsLCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICBsZXQgcmVzdWx0ID0gbnVsbDtcbiAgICBmb3IgKGNvbnN0IGxvYWRQYXRoIG9mIHRoaXMubG9hZFBhdGhzKSB7XG4gICAgICByZXN1bHQgPSBzdXBlci5jYW5vbmljYWxpemUocGF0aFRvRmlsZVVSTChqb2luKGxvYWRQYXRoLCB1cmwpKS5ocmVmLCBvcHRpb25zKTtcbiAgICAgIGlmIChyZXN1bHQgIT09IG51bGwpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuXG4vKipcbiAqIFdvcmthcm91bmQgZm9yIFNhc3Mgbm90IGNhbGxpbmcgaW5zdGFuY2UgbWV0aG9kcyB3aXRoIGB0aGlzYC5cbiAqIFRoZSBgY2Fub25pY2FsaXplYCBhbmQgYGxvYWRgIG1ldGhvZHMgd2lsbCBiZSBib3VuZCB0byB0aGUgY2xhc3MgaW5zdGFuY2UuXG4gKiBAcGFyYW0gaW1wb3J0ZXIgQSBTYXNzIGltcG9ydGVyIHRvIGJpbmQuXG4gKiBAcmV0dXJucyBUaGUgYm91bmQgU2FzcyBpbXBvcnRlci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNhc3NCaW5kV29ya2Fyb3VuZDxUIGV4dGVuZHMgSW1wb3J0ZXI+KGltcG9ydGVyOiBUKTogVCB7XG4gIGltcG9ydGVyLmNhbm9uaWNhbGl6ZSA9IGltcG9ydGVyLmNhbm9uaWNhbGl6ZS5iaW5kKGltcG9ydGVyKTtcbiAgaW1wb3J0ZXIubG9hZCA9IGltcG9ydGVyLmxvYWQuYmluZChpbXBvcnRlcik7XG5cbiAgcmV0dXJuIGltcG9ydGVyO1xufVxuIl19