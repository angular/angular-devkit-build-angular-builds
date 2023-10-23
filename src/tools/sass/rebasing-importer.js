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
const lexer_1 = require("./lexer");
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
    entryDirectory;
    rebaseSourceMaps;
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
        for (const { start, end, value } of (0, lexer_1.findUrls)(contents)) {
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
            updatedContents ??= new magic_string_1.default(contents);
            updatedContents.update(start, end, rebasedUrl);
        }
        if (updatedContents) {
            contents = updatedContents.toString();
            if (this.rebaseSourceMaps) {
                // Generate an intermediate source map for the rebasing changes
                const map = updatedContents.generateMap({
                    hires: 'boundary',
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
 * Provides the Sass importer logic to resolve relative stylesheet imports via both import and use rules
 * and also rebase any `url()` function usage within those stylesheets. The rebasing will ensure that
 * the URLs in the output of the Sass compiler reflect the final filesystem location of the output CSS file.
 */
class RelativeUrlRebasingImporter extends UrlRebasingImporter {
    directoryCache;
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
    finder;
    constructor(entryDirectory, directoryCache, rebaseSourceMaps, finder) {
        super(entryDirectory, directoryCache, rebaseSourceMaps);
        this.finder = finder;
    }
    canonicalize(url, options) {
        if (url.startsWith('file://')) {
            return super.canonicalize(url, options);
        }
        let result = this.finder(url, options);
        result &&= super.canonicalize(result.href, options);
        return result;
    }
}
exports.ModuleUrlRebasingImporter = ModuleUrlRebasingImporter;
/**
 * Provides the Sass importer logic to resolve load paths located stylesheet imports via both import and
 * use rules and also rebase any `url()` function usage within those stylesheets. The rebasing will ensure that
 * the URLs in the output of the Sass compiler reflect the final filesystem location of the output CSS file.
 */
class LoadPathsUrlRebasingImporter extends RelativeUrlRebasingImporter {
    loadPaths;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmViYXNpbmctaW1wb3J0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9zYXNzL3JlYmFzaW5nLWltcG9ydGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILGdFQUF1QztBQUN2QyxxQ0FBb0Q7QUFDcEQseUNBQXVFO0FBQ3ZFLHVDQUF3RDtBQUV4RCxtQ0FBbUM7QUFXbkM7Ozs7Ozs7Ozs7R0FVRztBQUNILE1BQWUsbUJBQW1CO0lBT3RCO0lBQ0E7SUFQVjs7OztPQUlHO0lBQ0gsWUFDVSxjQUFzQixFQUN0QixnQkFBNEM7UUFENUMsbUJBQWMsR0FBZCxjQUFjLENBQVE7UUFDdEIscUJBQWdCLEdBQWhCLGdCQUFnQixDQUE0QjtJQUNuRCxDQUFDO0lBSUosSUFBSSxDQUFDLFlBQWlCO1FBQ3BCLE1BQU0sY0FBYyxHQUFHLElBQUEsd0JBQWEsRUFBQyxZQUFZLENBQUMsQ0FBQztRQUNuRCxNQUFNLG1CQUFtQixHQUFHLElBQUEsbUJBQU8sRUFBQyxjQUFjLENBQUMsQ0FBQztRQUNwRCxJQUFJLFFBQVEsR0FBRyxJQUFBLHNCQUFZLEVBQUMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRXJELGlDQUFpQztRQUNqQyxJQUFJLGVBQWUsQ0FBQztRQUNwQixLQUFLLE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLElBQUEsZ0JBQVEsRUFBQyxRQUFRLENBQUMsRUFBRTtZQUN0RCw0Q0FBNEM7WUFDNUMsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUMvQyxTQUFTO2FBQ1Y7WUFFRCwyREFBMkQ7WUFDM0QsSUFBSSxxQ0FBcUMsQ0FBQyxJQUFJLENB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U0FDekM7UUFFRCxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUM7UUFDbEIsS0FBSyxNQUFNLFFBQVEsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO1lBQ3JDLE1BQU0sR0FBRyxLQUFLLENBQUMsWUFBWSxDQUFDLElBQUEsd0JBQWEsRUFBQyxJQUFBLGdCQUFJLEVBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzlFLElBQUksTUFBTSxLQUFLLElBQUksRUFBRTtnQkFDbkIsTUFBTTthQUNQO1NBQ0Y7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0NBQ0Y7QUF6QkQsb0VBeUJDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxTQUFnQixrQkFBa0IsQ0FBcUIsUUFBVztJQUNoRSxRQUFRLENBQUMsWUFBWSxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzdELFFBQVEsQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFN0MsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQztBQUxELGdEQUtDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IFJhd1NvdXJjZU1hcCB9IGZyb20gJ0BhbXBwcm9qZWN0L3JlbWFwcGluZyc7XG5pbXBvcnQgTWFnaWNTdHJpbmcgZnJvbSAnbWFnaWMtc3RyaW5nJztcbmltcG9ydCB7IHJlYWRGaWxlU3luYywgcmVhZGRpclN5bmMgfSBmcm9tICdub2RlOmZzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBkaXJuYW1lLCBleHRuYW1lLCBqb2luLCByZWxhdGl2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBwYXRoVG9GaWxlVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IHR5cGUgeyBDYW5vbmljYWxpemVDb250ZXh0LCBJbXBvcnRlciwgSW1wb3J0ZXJSZXN1bHQsIFN5bnRheCB9IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHsgZmluZFVybHMgfSBmcm9tICcuL2xleGVyJztcblxuLyoqXG4gKiBBIHByZXByb2Nlc3NlZCBjYWNoZSBlbnRyeSBmb3IgdGhlIGZpbGVzIGFuZCBkaXJlY3RvcmllcyB3aXRoaW4gYSBwcmV2aW91c2x5IHNlYXJjaGVkXG4gKiBkaXJlY3Rvcnkgd2hlbiBwZXJmb3JtaW5nIFNhc3MgaW1wb3J0IHJlc29sdXRpb24uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGlyZWN0b3J5RW50cnkge1xuICBmaWxlczogU2V0PHN0cmluZz47XG4gIGRpcmVjdG9yaWVzOiBTZXQ8c3RyaW5nPjtcbn1cblxuLyoqXG4gKiBBIFNhc3MgSW1wb3J0ZXIgYmFzZSBjbGFzcyB0aGF0IHByb3ZpZGVzIHRoZSBsb2FkIGxvZ2ljIHRvIHJlYmFzZSBhbGwgYHVybCgpYCBmdW5jdGlvbnNcbiAqIHdpdGhpbiBhIHN0eWxlc2hlZXQuIFRoZSByZWJhc2luZyB3aWxsIGVuc3VyZSB0aGF0IHRoZSBVUkxzIGluIHRoZSBvdXRwdXQgb2YgdGhlIFNhc3MgY29tcGlsZXJcbiAqIHJlZmxlY3QgdGhlIGZpbmFsIGZpbGVzeXN0ZW0gbG9jYXRpb24gb2YgdGhlIG91dHB1dCBDU1MgZmlsZS5cbiAqXG4gKiBUaGlzIGNsYXNzIHByb3ZpZGVzIHRoZSBjb3JlIG9mIHRoZSByZWJhc2luZyBmdW5jdGlvbmFsaXR5LiBUbyBlbnN1cmUgdGhhdCBlYWNoIGZpbGUgaXMgcHJvY2Vzc2VkXG4gKiBieSB0aGlzIGltcG9ydGVyJ3MgbG9hZCBpbXBsZW1lbnRhdGlvbiwgdGhlIFNhc3MgY29tcGlsZXIgcmVxdWlyZXMgdGhlIGltcG9ydGVyJ3MgY2Fub25pY2FsaXplXG4gKiBmdW5jdGlvbiB0byByZXR1cm4gYSBub24tbnVsbCB2YWx1ZSB3aXRoIHRoZSByZXNvbHZlZCBsb2NhdGlvbiBvZiB0aGUgcmVxdWVzdGVkIHN0eWxlc2hlZXQuXG4gKiBDb25jcmV0ZSBpbXBsZW1lbnRhdGlvbnMgb2YgdGhpcyBjbGFzcyBtdXN0IHByb3ZpZGUgdGhpcyBjYW5vbmljYWxpemUgZnVuY3Rpb25hbGl0eSBmb3IgcmViYXNpbmdcbiAqIHRvIGJlIGVmZmVjdGl2ZS5cbiAqL1xuYWJzdHJhY3QgY2xhc3MgVXJsUmViYXNpbmdJbXBvcnRlciBpbXBsZW1lbnRzIEltcG9ydGVyPCdzeW5jJz4ge1xuICAvKipcbiAgICogQHBhcmFtIGVudHJ5RGlyZWN0b3J5IFRoZSBkaXJlY3Rvcnkgb2YgdGhlIGVudHJ5IHN0eWxlc2hlZXQgdGhhdCB3YXMgcGFzc2VkIHRvIHRoZSBTYXNzIGNvbXBpbGVyLlxuICAgKiBAcGFyYW0gcmViYXNlU291cmNlTWFwcyBXaGVuIHByb3ZpZGVkLCByZWJhc2VkIGZpbGVzIHdpbGwgaGF2ZSBhbiBpbnRlcm1lZGlhdGUgc291cmNlbWFwIGFkZGVkIHRvIHRoZSBNYXBcbiAgICogd2hpY2ggY2FuIGJlIHVzZWQgdG8gZ2VuZXJhdGUgYSBmaW5hbCBzb3VyY2VtYXAgdGhhdCBjb250YWlucyBvcmlnaW5hbCBzb3VyY2VzLlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBlbnRyeURpcmVjdG9yeTogc3RyaW5nLFxuICAgIHByaXZhdGUgcmViYXNlU291cmNlTWFwcz86IE1hcDxzdHJpbmcsIFJhd1NvdXJjZU1hcD4sXG4gICkge31cblxuICBhYnN0cmFjdCBjYW5vbmljYWxpemUodXJsOiBzdHJpbmcsIG9wdGlvbnM6IHsgZnJvbUltcG9ydDogYm9vbGVhbiB9KTogVVJMIHwgbnVsbDtcblxuICBsb2FkKGNhbm9uaWNhbFVybDogVVJMKTogSW1wb3J0ZXJSZXN1bHQgfCBudWxsIHtcbiAgICBjb25zdCBzdHlsZXNoZWV0UGF0aCA9IGZpbGVVUkxUb1BhdGgoY2Fub25pY2FsVXJsKTtcbiAgICBjb25zdCBzdHlsZXNoZWV0RGlyZWN0b3J5ID0gZGlybmFtZShzdHlsZXNoZWV0UGF0aCk7XG4gICAgbGV0IGNvbnRlbnRzID0gcmVhZEZpbGVTeW5jKHN0eWxlc2hlZXRQYXRoLCAndXRmLTgnKTtcblxuICAgIC8vIFJlYmFzZSBhbnkgVVJMcyB0aGF0IGFyZSBmb3VuZFxuICAgIGxldCB1cGRhdGVkQ29udGVudHM7XG4gICAgZm9yIChjb25zdCB7IHN0YXJ0LCBlbmQsIHZhbHVlIH0gb2YgZmluZFVybHMoY29udGVudHMpKSB7XG4gICAgICAvLyBTa2lwIGlmIHZhbHVlIGlzIGVtcHR5IG9yIGEgU2FzcyB2YXJpYWJsZVxuICAgICAgaWYgKHZhbHVlLmxlbmd0aCA9PT0gMCB8fCB2YWx1ZS5zdGFydHNXaXRoKCckJykpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIFNraXAgaWYgcm9vdC1yZWxhdGl2ZSwgYWJzb2x1dGUgb3IgcHJvdG9jb2wgcmVsYXRpdmUgdXJsXG4gICAgICBpZiAoL14oKD86XFx3KzopP1xcL1xcL3xkYXRhOnxjaHJvbWU6fCN8XFwvKS8udGVzdCh2YWx1ZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlYmFzZWRQYXRoID0gcmVsYXRpdmUodGhpcy5lbnRyeURpcmVjdG9yeSwgam9pbihzdHlsZXNoZWV0RGlyZWN0b3J5LCB2YWx1ZSkpO1xuXG4gICAgICAvLyBOb3JtYWxpemUgcGF0aCBzZXBhcmF0b3JzIGFuZCBlc2NhcGUgY2hhcmFjdGVyc1xuICAgICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQ1NTL3VybCNzeW50YXhcbiAgICAgIGNvbnN0IHJlYmFzZWRVcmwgPSAnLi8nICsgcmViYXNlZFBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpLnJlcGxhY2UoL1soKVxccydcIl0vZywgJ1xcXFwkJicpO1xuXG4gICAgICB1cGRhdGVkQ29udGVudHMgPz89IG5ldyBNYWdpY1N0cmluZyhjb250ZW50cyk7XG4gICAgICB1cGRhdGVkQ29udGVudHMudXBkYXRlKHN0YXJ0LCBlbmQsIHJlYmFzZWRVcmwpO1xuICAgIH1cblxuICAgIGlmICh1cGRhdGVkQ29udGVudHMpIHtcbiAgICAgIGNvbnRlbnRzID0gdXBkYXRlZENvbnRlbnRzLnRvU3RyaW5nKCk7XG4gICAgICBpZiAodGhpcy5yZWJhc2VTb3VyY2VNYXBzKSB7XG4gICAgICAgIC8vIEdlbmVyYXRlIGFuIGludGVybWVkaWF0ZSBzb3VyY2UgbWFwIGZvciB0aGUgcmViYXNpbmcgY2hhbmdlc1xuICAgICAgICBjb25zdCBtYXAgPSB1cGRhdGVkQ29udGVudHMuZ2VuZXJhdGVNYXAoe1xuICAgICAgICAgIGhpcmVzOiAnYm91bmRhcnknLFxuICAgICAgICAgIGluY2x1ZGVDb250ZW50OiB0cnVlLFxuICAgICAgICAgIHNvdXJjZTogY2Fub25pY2FsVXJsLmhyZWYsXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnJlYmFzZVNvdXJjZU1hcHMuc2V0KGNhbm9uaWNhbFVybC5ocmVmLCBtYXAgYXMgUmF3U291cmNlTWFwKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgc3ludGF4OiBTeW50YXggfCB1bmRlZmluZWQ7XG4gICAgc3dpdGNoIChleHRuYW1lKHN0eWxlc2hlZXRQYXRoKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICBjYXNlICcuY3NzJzpcbiAgICAgICAgc3ludGF4ID0gJ2Nzcyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnLnNhc3MnOlxuICAgICAgICBzeW50YXggPSAnaW5kZW50ZWQnO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHN5bnRheCA9ICdzY3NzJztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRlbnRzLFxuICAgICAgc3ludGF4LFxuICAgICAgc291cmNlTWFwVXJsOiBjYW5vbmljYWxVcmwsXG4gICAgfTtcbiAgfVxufVxuXG4vKipcbiAqIFByb3ZpZGVzIHRoZSBTYXNzIGltcG9ydGVyIGxvZ2ljIHRvIHJlc29sdmUgcmVsYXRpdmUgc3R5bGVzaGVldCBpbXBvcnRzIHZpYSBib3RoIGltcG9ydCBhbmQgdXNlIHJ1bGVzXG4gKiBhbmQgYWxzbyByZWJhc2UgYW55IGB1cmwoKWAgZnVuY3Rpb24gdXNhZ2Ugd2l0aGluIHRob3NlIHN0eWxlc2hlZXRzLiBUaGUgcmViYXNpbmcgd2lsbCBlbnN1cmUgdGhhdFxuICogdGhlIFVSTHMgaW4gdGhlIG91dHB1dCBvZiB0aGUgU2FzcyBjb21waWxlciByZWZsZWN0IHRoZSBmaW5hbCBmaWxlc3lzdGVtIGxvY2F0aW9uIG9mIHRoZSBvdXRwdXQgQ1NTIGZpbGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZWxhdGl2ZVVybFJlYmFzaW5nSW1wb3J0ZXIgZXh0ZW5kcyBVcmxSZWJhc2luZ0ltcG9ydGVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgZW50cnlEaXJlY3Rvcnk6IHN0cmluZyxcbiAgICBwcml2YXRlIGRpcmVjdG9yeUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIERpcmVjdG9yeUVudHJ5PigpLFxuICAgIHJlYmFzZVNvdXJjZU1hcHM/OiBNYXA8c3RyaW5nLCBSYXdTb3VyY2VNYXA+LFxuICApIHtcbiAgICBzdXBlcihlbnRyeURpcmVjdG9yeSwgcmViYXNlU291cmNlTWFwcyk7XG4gIH1cblxuICBjYW5vbmljYWxpemUodXJsOiBzdHJpbmcsIG9wdGlvbnM6IHsgZnJvbUltcG9ydDogYm9vbGVhbiB9KTogVVJMIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMucmVzb2x2ZUltcG9ydCh1cmwsIG9wdGlvbnMuZnJvbUltcG9ydCwgdHJ1ZSk7XG4gIH1cblxuICAvKipcbiAgICogQXR0ZW1wdHMgdG8gcmVzb2x2ZSBhIHByb3ZpZGVkIFVSTCB0byBhIHN0eWxlc2hlZXQgZmlsZSB1c2luZyB0aGUgU2FzcyBjb21waWxlcidzIHJlc29sdXRpb24gYWxnb3JpdGhtLlxuICAgKiBCYXNlZCBvbiBodHRwczovL2dpdGh1Yi5jb20vc2Fzcy9kYXJ0LXNhc3MvYmxvYi80NGQ2YmI2YWM3MmZlNmI5M2Y1YmZlYzM3MWExZmZmYjE4ZTZiNzZkL2xpYi9zcmMvaW1wb3J0ZXIvdXRpbHMuZGFydFxuICAgKiBAcGFyYW0gdXJsIFRoZSBmaWxlIHByb3RvY29sIFVSTCB0byByZXNvbHZlLlxuICAgKiBAcGFyYW0gZnJvbUltcG9ydCBJZiB0cnVlLCBVUkwgd2FzIGZyb20gYW4gaW1wb3J0IHJ1bGU7IG90aGVyd2lzZSBmcm9tIGEgdXNlIHJ1bGUuXG4gICAqIEBwYXJhbSBjaGVja0RpcmVjdG9yeSBJZiB0cnVlLCB0cnkgY2hlY2tpbmcgZm9yIGEgZGlyZWN0b3J5IHdpdGggdGhlIGJhc2UgbmFtZSBjb250YWluaW5nIGFuIGluZGV4IGZpbGUuXG4gICAqIEByZXR1cm5zIEEgZnVsbCByZXNvbHZlZCBVUkwgb2YgdGhlIHN0eWxlc2hlZXQgZmlsZSBvciBgbnVsbGAgaWYgbm90IGZvdW5kLlxuICAgKi9cbiAgcHJpdmF0ZSByZXNvbHZlSW1wb3J0KHVybDogc3RyaW5nLCBmcm9tSW1wb3J0OiBib29sZWFuLCBjaGVja0RpcmVjdG9yeTogYm9vbGVhbik6IFVSTCB8IG51bGwge1xuICAgIGxldCBzdHlsZXNoZWV0UGF0aDtcbiAgICB0cnkge1xuICAgICAgc3R5bGVzaGVldFBhdGggPSBmaWxlVVJMVG9QYXRoKHVybCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBPbmx5IGZpbGUgcHJvdG9jb2wgVVJMcyBhcmUgc3VwcG9ydGVkIGJ5IHRoaXMgaW1wb3J0ZXJcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGRpcmVjdG9yeSA9IGRpcm5hbWUoc3R5bGVzaGVldFBhdGgpO1xuICAgIGNvbnN0IGV4dGVuc2lvbiA9IGV4dG5hbWUoc3R5bGVzaGVldFBhdGgpO1xuICAgIGNvbnN0IGhhc1N0eWxlRXh0ZW5zaW9uID1cbiAgICAgIGV4dGVuc2lvbiA9PT0gJy5zY3NzJyB8fCBleHRlbnNpb24gPT09ICcuc2FzcycgfHwgZXh0ZW5zaW9uID09PSAnLmNzcyc7XG4gICAgLy8gUmVtb3ZlIHRoZSBzdHlsZSBleHRlbnNpb24gaWYgcHJlc2VudCB0byBhbGxvdyBhZGRpbmcgdGhlIGAuaW1wb3J0YCBzdWZmaXhcbiAgICBjb25zdCBmaWxlbmFtZSA9IGJhc2VuYW1lKHN0eWxlc2hlZXRQYXRoLCBoYXNTdHlsZUV4dGVuc2lvbiA/IGV4dGVuc2lvbiA6IHVuZGVmaW5lZCk7XG5cbiAgICBjb25zdCBpbXBvcnRQb3RlbnRpYWxzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgZGVmYXVsdFBvdGVudGlhbHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAgIGlmIChoYXNTdHlsZUV4dGVuc2lvbikge1xuICAgICAgaWYgKGZyb21JbXBvcnQpIHtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLmltcG9ydCcgKyBleHRlbnNpb24pO1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuaW1wb3J0JyArIGV4dGVuc2lvbik7XG4gICAgICB9XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyBleHRlbnNpb24pO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgZXh0ZW5zaW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGZyb21JbXBvcnQpIHtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLmltcG9ydC5zY3NzJyk7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5pbXBvcnQuc2FzcycpO1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuaW1wb3J0LmNzcycpO1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuaW1wb3J0LnNjc3MnKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLmltcG9ydC5zYXNzJyk7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5pbXBvcnQuY3NzJyk7XG4gICAgICB9XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLnNjc3MnKTtcbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuc2FzcycpO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5jc3MnKTtcbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuc2NzcycpO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5zYXNzJyk7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLmNzcycpO1xuICAgIH1cblxuICAgIGxldCBmb3VuZERlZmF1bHRzO1xuICAgIGxldCBmb3VuZEltcG9ydHM7XG4gICAgbGV0IGhhc1BvdGVudGlhbEluZGV4ID0gZmFsc2U7XG5cbiAgICBsZXQgY2FjaGVkRW50cmllcyA9IHRoaXMuZGlyZWN0b3J5Q2FjaGUuZ2V0KGRpcmVjdG9yeSk7XG4gICAgaWYgKGNhY2hlZEVudHJpZXMpIHtcbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgcHJlcHJvY2Vzc2VkIGNhY2hlIG9mIHRoZSBkaXJlY3RvcnksIHBlcmZvcm0gYW4gaW50ZXJzZWN0aW9uIG9mIHRoZSBwb3RlbnRpYWxzXG4gICAgICAvLyBhbmQgdGhlIGRpcmVjdG9yeSBmaWxlcy5cbiAgICAgIGNvbnN0IHsgZmlsZXMsIGRpcmVjdG9yaWVzIH0gPSBjYWNoZWRFbnRyaWVzO1xuICAgICAgZm91bmREZWZhdWx0cyA9IFsuLi5kZWZhdWx0UG90ZW50aWFsc10uZmlsdGVyKChwb3RlbnRpYWwpID0+IGZpbGVzLmhhcyhwb3RlbnRpYWwpKTtcbiAgICAgIGZvdW5kSW1wb3J0cyA9IFsuLi5pbXBvcnRQb3RlbnRpYWxzXS5maWx0ZXIoKHBvdGVudGlhbCkgPT4gZmlsZXMuaGFzKHBvdGVudGlhbCkpO1xuICAgICAgaGFzUG90ZW50aWFsSW5kZXggPSBjaGVja0RpcmVjdG9yeSAmJiAhaGFzU3R5bGVFeHRlbnNpb24gJiYgZGlyZWN0b3JpZXMuaGFzKGZpbGVuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSWYgbm8gcHJlcHJvY2Vzc2VkIGNhY2hlIGV4aXN0cywgZ2V0IHRoZSBlbnRyaWVzIGZyb20gdGhlIGZpbGUgc3lzdGVtIGFuZCwgd2hpbGUgc2VhcmNoaW5nLFxuICAgICAgLy8gZ2VuZXJhdGUgdGhlIGNhY2hlIGZvciBsYXRlciByZXF1ZXN0cy5cbiAgICAgIGxldCBlbnRyaWVzO1xuICAgICAgdHJ5IHtcbiAgICAgICAgZW50cmllcyA9IHJlYWRkaXJTeW5jKGRpcmVjdG9yeSwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBmb3VuZERlZmF1bHRzID0gW107XG4gICAgICBmb3VuZEltcG9ydHMgPSBbXTtcbiAgICAgIGNhY2hlZEVudHJpZXMgPSB7IGZpbGVzOiBuZXcgU2V0PHN0cmluZz4oKSwgZGlyZWN0b3JpZXM6IG5ldyBTZXQ8c3RyaW5nPigpIH07XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXMpIHtcbiAgICAgICAgY29uc3QgaXNEaXJlY3RvcnkgPSBlbnRyeS5pc0RpcmVjdG9yeSgpO1xuICAgICAgICBpZiAoaXNEaXJlY3RvcnkpIHtcbiAgICAgICAgICBjYWNoZWRFbnRyaWVzLmRpcmVjdG9yaWVzLmFkZChlbnRyeS5uYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlY29yZCBpZiB0aGUgbmFtZSBzaG91bGQgYmUgY2hlY2tlZCBhcyBhIGRpcmVjdG9yeSB3aXRoIGFuIGluZGV4IGZpbGVcbiAgICAgICAgaWYgKGNoZWNrRGlyZWN0b3J5ICYmICFoYXNTdHlsZUV4dGVuc2lvbiAmJiBlbnRyeS5uYW1lID09PSBmaWxlbmFtZSAmJiBpc0RpcmVjdG9yeSkge1xuICAgICAgICAgIGhhc1BvdGVudGlhbEluZGV4ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZW50cnkuaXNGaWxlKCkpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNhY2hlZEVudHJpZXMuZmlsZXMuYWRkKGVudHJ5Lm5hbWUpO1xuXG4gICAgICAgIGlmIChpbXBvcnRQb3RlbnRpYWxzLmhhcyhlbnRyeS5uYW1lKSkge1xuICAgICAgICAgIGZvdW5kSW1wb3J0cy5wdXNoKGVudHJ5Lm5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRlZmF1bHRQb3RlbnRpYWxzLmhhcyhlbnRyeS5uYW1lKSkge1xuICAgICAgICAgIGZvdW5kRGVmYXVsdHMucHVzaChlbnRyeS5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLmRpcmVjdG9yeUNhY2hlLnNldChkaXJlY3RvcnksIGNhY2hlZEVudHJpZXMpO1xuICAgIH1cblxuICAgIC8vIGBmb3VuZEltcG9ydHNgIHdpbGwgb25seSBjb250YWluIGVsZW1lbnRzIGlmIGBvcHRpb25zLmZyb21JbXBvcnRgIGlzIHRydWVcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLmNoZWNrRm91bmQoZm91bmRJbXBvcnRzKSA/PyB0aGlzLmNoZWNrRm91bmQoZm91bmREZWZhdWx0cyk7XG4gICAgaWYgKHJlc3VsdCAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHBhdGhUb0ZpbGVVUkwoam9pbihkaXJlY3RvcnksIHJlc3VsdCkpO1xuICAgIH1cblxuICAgIGlmIChoYXNQb3RlbnRpYWxJbmRleCkge1xuICAgICAgLy8gQ2hlY2sgZm9yIGluZGV4IGZpbGVzIHVzaW5nIGZpbGVuYW1lIGFzIGEgZGlyZWN0b3J5XG4gICAgICByZXR1cm4gdGhpcy5yZXNvbHZlSW1wb3J0KHVybCArICcvaW5kZXgnLCBmcm9tSW1wb3J0LCBmYWxzZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGFuIGFycmF5IG9mIHBvdGVudGlhbCBzdHlsZXNoZWV0IGZpbGVzIHRvIGRldGVybWluZSBpZiB0aGVyZSBpcyBhIHZhbGlkXG4gICAqIHN0eWxlc2hlZXQgZmlsZS4gTW9yZSB0aGFuIG9uZSBkaXNjb3ZlcmVkIGZpbGUgbWF5IGluZGljYXRlIGFuIGVycm9yLlxuICAgKiBAcGFyYW0gZm91bmQgQW4gYXJyYXkgb2YgZGlzY292ZXJlZCBzdHlsZXNoZWV0IGZpbGVzLlxuICAgKiBAcmV0dXJucyBBIGZ1bGx5IHJlc29sdmVkIHBhdGggZm9yIGEgc3R5bGVzaGVldCBmaWxlIG9yIGBudWxsYCBpZiBub3QgZm91bmQuXG4gICAqIEB0aHJvd3MgSWYgdGhlcmUgYXJlIGFtYmlndW91cyBmaWxlcyBkaXNjb3ZlcmVkLlxuICAgKi9cbiAgcHJpdmF0ZSBjaGVja0ZvdW5kKGZvdW5kOiBzdHJpbmdbXSk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmIChmb3VuZC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIE5vdCBmb3VuZFxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gTW9yZSB0aGFuIG9uZSBmb3VuZCBmaWxlIG1heSBiZSBhbiBlcnJvclxuICAgIGlmIChmb3VuZC5sZW5ndGggPiAxKSB7XG4gICAgICAvLyBQcmVzZW5jZSBvZiBDU1MgZmlsZXMgYWxvbmdzaWRlIGEgU2FzcyBmaWxlIGRvZXMgbm90IGNhdXNlIGFuIGVycm9yXG4gICAgICBjb25zdCBmb3VuZFdpdGhvdXRDc3MgPSBmb3VuZC5maWx0ZXIoKGVsZW1lbnQpID0+IGV4dG5hbWUoZWxlbWVudCkgIT09ICcuY3NzJyk7XG4gICAgICAvLyBJZiB0aGUgbGVuZ3RoIGlzIHplcm8gdGhlbiB0aGVyZSBhcmUgdHdvIG9yIG1vcmUgY3NzIGZpbGVzXG4gICAgICAvLyBJZiB0aGUgbGVuZ3RoIGlzIG1vcmUgdGhhbiBvbmUgdGhhbiB0aGVyZSBhcmUgdHdvIG9yIG1vcmUgc2Fzcy9zY3NzIGZpbGVzXG4gICAgICBpZiAoZm91bmRXaXRob3V0Q3NzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FtYmlndW91cyBpbXBvcnQgZGV0ZWN0ZWQuJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJldHVybiB0aGUgbm9uLUNTUyBmaWxlIChzYXNzL3Njc3MgZmlsZXMgaGF2ZSBwcmlvcml0eSlcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9zYXNzL2RhcnQtc2Fzcy9ibG9iLzQ0ZDZiYjZhYzcyZmU2YjkzZjViZmVjMzcxYTFmZmZiMThlNmI3NmQvbGliL3NyYy9pbXBvcnRlci91dGlscy5kYXJ0I0w0NC1MNDdcbiAgICAgIHJldHVybiBmb3VuZFdpdGhvdXRDc3NbMF07XG4gICAgfVxuXG4gICAgcmV0dXJuIGZvdW5kWzBdO1xuICB9XG59XG5cbi8qKlxuICogUHJvdmlkZXMgdGhlIFNhc3MgaW1wb3J0ZXIgbG9naWMgdG8gcmVzb2x2ZSBtb2R1bGUgKG5wbSBwYWNrYWdlKSBzdHlsZXNoZWV0IGltcG9ydHMgdmlhIGJvdGggaW1wb3J0IGFuZFxuICogdXNlIHJ1bGVzIGFuZCBhbHNvIHJlYmFzZSBhbnkgYHVybCgpYCBmdW5jdGlvbiB1c2FnZSB3aXRoaW4gdGhvc2Ugc3R5bGVzaGVldHMuIFRoZSByZWJhc2luZyB3aWxsIGVuc3VyZSB0aGF0XG4gKiB0aGUgVVJMcyBpbiB0aGUgb3V0cHV0IG9mIHRoZSBTYXNzIGNvbXBpbGVyIHJlZmxlY3QgdGhlIGZpbmFsIGZpbGVzeXN0ZW0gbG9jYXRpb24gb2YgdGhlIG91dHB1dCBDU1MgZmlsZS5cbiAqL1xuZXhwb3J0IGNsYXNzIE1vZHVsZVVybFJlYmFzaW5nSW1wb3J0ZXIgZXh0ZW5kcyBSZWxhdGl2ZVVybFJlYmFzaW5nSW1wb3J0ZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICBlbnRyeURpcmVjdG9yeTogc3RyaW5nLFxuICAgIGRpcmVjdG9yeUNhY2hlOiBNYXA8c3RyaW5nLCBEaXJlY3RvcnlFbnRyeT4sXG4gICAgcmViYXNlU291cmNlTWFwczogTWFwPHN0cmluZywgUmF3U291cmNlTWFwPiB8IHVuZGVmaW5lZCxcbiAgICBwcml2YXRlIGZpbmRlcjogKHNwZWNpZmllcjogc3RyaW5nLCBvcHRpb25zOiBDYW5vbmljYWxpemVDb250ZXh0KSA9PiBVUkwgfCBudWxsLFxuICApIHtcbiAgICBzdXBlcihlbnRyeURpcmVjdG9yeSwgZGlyZWN0b3J5Q2FjaGUsIHJlYmFzZVNvdXJjZU1hcHMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2Fub25pY2FsaXplKHVybDogc3RyaW5nLCBvcHRpb25zOiBDYW5vbmljYWxpemVDb250ZXh0KTogVVJMIHwgbnVsbCB7XG4gICAgaWYgKHVybC5zdGFydHNXaXRoKCdmaWxlOi8vJykpIHtcbiAgICAgIHJldHVybiBzdXBlci5jYW5vbmljYWxpemUodXJsLCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5maW5kZXIodXJsLCBvcHRpb25zKTtcbiAgICByZXN1bHQgJiY9IHN1cGVyLmNhbm9uaWNhbGl6ZShyZXN1bHQuaHJlZiwgb3B0aW9ucyk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cbi8qKlxuICogUHJvdmlkZXMgdGhlIFNhc3MgaW1wb3J0ZXIgbG9naWMgdG8gcmVzb2x2ZSBsb2FkIHBhdGhzIGxvY2F0ZWQgc3R5bGVzaGVldCBpbXBvcnRzIHZpYSBib3RoIGltcG9ydCBhbmRcbiAqIHVzZSBydWxlcyBhbmQgYWxzbyByZWJhc2UgYW55IGB1cmwoKWAgZnVuY3Rpb24gdXNhZ2Ugd2l0aGluIHRob3NlIHN0eWxlc2hlZXRzLiBUaGUgcmViYXNpbmcgd2lsbCBlbnN1cmUgdGhhdFxuICogdGhlIFVSTHMgaW4gdGhlIG91dHB1dCBvZiB0aGUgU2FzcyBjb21waWxlciByZWZsZWN0IHRoZSBmaW5hbCBmaWxlc3lzdGVtIGxvY2F0aW9uIG9mIHRoZSBvdXRwdXQgQ1NTIGZpbGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBMb2FkUGF0aHNVcmxSZWJhc2luZ0ltcG9ydGVyIGV4dGVuZHMgUmVsYXRpdmVVcmxSZWJhc2luZ0ltcG9ydGVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgZW50cnlEaXJlY3Rvcnk6IHN0cmluZyxcbiAgICBkaXJlY3RvcnlDYWNoZTogTWFwPHN0cmluZywgRGlyZWN0b3J5RW50cnk+LFxuICAgIHJlYmFzZVNvdXJjZU1hcHM6IE1hcDxzdHJpbmcsIFJhd1NvdXJjZU1hcD4gfCB1bmRlZmluZWQsXG4gICAgcHJpdmF0ZSBsb2FkUGF0aHM6IEl0ZXJhYmxlPHN0cmluZz4sXG4gICkge1xuICAgIHN1cGVyKGVudHJ5RGlyZWN0b3J5LCBkaXJlY3RvcnlDYWNoZSwgcmViYXNlU291cmNlTWFwcyk7XG4gIH1cblxuICBvdmVycmlkZSBjYW5vbmljYWxpemUodXJsOiBzdHJpbmcsIG9wdGlvbnM6IHsgZnJvbUltcG9ydDogYm9vbGVhbiB9KTogVVJMIHwgbnVsbCB7XG4gICAgaWYgKHVybC5zdGFydHNXaXRoKCdmaWxlOi8vJykpIHtcbiAgICAgIHJldHVybiBzdXBlci5jYW5vbmljYWxpemUodXJsLCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICBsZXQgcmVzdWx0ID0gbnVsbDtcbiAgICBmb3IgKGNvbnN0IGxvYWRQYXRoIG9mIHRoaXMubG9hZFBhdGhzKSB7XG4gICAgICByZXN1bHQgPSBzdXBlci5jYW5vbmljYWxpemUocGF0aFRvRmlsZVVSTChqb2luKGxvYWRQYXRoLCB1cmwpKS5ocmVmLCBvcHRpb25zKTtcbiAgICAgIGlmIChyZXN1bHQgIT09IG51bGwpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuXG4vKipcbiAqIFdvcmthcm91bmQgZm9yIFNhc3Mgbm90IGNhbGxpbmcgaW5zdGFuY2UgbWV0aG9kcyB3aXRoIGB0aGlzYC5cbiAqIFRoZSBgY2Fub25pY2FsaXplYCBhbmQgYGxvYWRgIG1ldGhvZHMgd2lsbCBiZSBib3VuZCB0byB0aGUgY2xhc3MgaW5zdGFuY2UuXG4gKiBAcGFyYW0gaW1wb3J0ZXIgQSBTYXNzIGltcG9ydGVyIHRvIGJpbmQuXG4gKiBAcmV0dXJucyBUaGUgYm91bmQgU2FzcyBpbXBvcnRlci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNhc3NCaW5kV29ya2Fyb3VuZDxUIGV4dGVuZHMgSW1wb3J0ZXI+KGltcG9ydGVyOiBUKTogVCB7XG4gIGltcG9ydGVyLmNhbm9uaWNhbGl6ZSA9IGltcG9ydGVyLmNhbm9uaWNhbGl6ZS5iaW5kKGltcG9ydGVyKTtcbiAgaW1wb3J0ZXIubG9hZCA9IGltcG9ydGVyLmxvYWQuYmluZChpbXBvcnRlcik7XG5cbiAgcmV0dXJuIGltcG9ydGVyO1xufVxuIl19