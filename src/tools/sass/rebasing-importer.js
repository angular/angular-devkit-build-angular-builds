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
 * A prefix that is added to import and use directive specifiers that should be resolved
 * as modules and that will contain added resolve directory information.
 *
 * This functionality is used to workaround the Sass limitation that it does not provide the
 * importer file to custom resolution plugins.
 */
const MODULE_RESOLUTION_PREFIX = '__NG_PACKAGE__';
function packModuleSpecifier(specifier, resolveDir) {
    const packed = MODULE_RESOLUTION_PREFIX + ';' + resolveDir + ';' + specifier;
    // Normalize path separators and escape characters
    // https://developer.mozilla.org/en-US/docs/Web/CSS/url#syntax
    const normalizedPacked = packed.replace(/\\/g, '/').replace(/[()\s'"]/g, '\\$&');
    return normalizedPacked;
}
function unpackModuleSpecifier(specifier) {
    if (!specifier.startsWith(`${MODULE_RESOLUTION_PREFIX};`)) {
        return { specifier };
    }
    const values = specifier.split(';', 3);
    return {
        specifier: values[2],
        resolveDir: values[1],
    };
}
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
            updatedContents ?? (updatedContents = new magic_string_1.default(contents));
            updatedContents.update(start, end, rebasedUrl);
        }
        // Add resolution directory information to module specifiers to facilitate resolution
        for (const { start, end, specifier } of (0, lexer_1.findImports)(contents)) {
            // Currently only provide directory information for known/common packages:
            // * `@material/`
            // * `@angular/`
            //
            // Comprehensive pre-resolution support may be added in the future. This is complicated by CSS/Sass not
            // requiring a `./` or `../` prefix to signify relative paths. A bare specifier could be either relative
            // or a module specifier. To differentiate, a relative resolution would need to be attempted first.
            if (!specifier.startsWith('@angular/') && !specifier.startsWith('@material/')) {
                continue;
            }
            updatedContents ?? (updatedContents = new magic_string_1.default(contents));
            updatedContents.update(start, end, `"${packModuleSpecifier(specifier, stylesheetDirectory)}"`);
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
        const { specifier, resolveDir } = unpackModuleSpecifier(url);
        let result = this.finder(specifier, { ...options, resolveDir });
        result && (result = super.canonicalize(result.href, options));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmViYXNpbmctaW1wb3J0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9zYXNzL3JlYmFzaW5nLWltcG9ydGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILGdFQUF1QztBQUN2QyxxQ0FBb0Q7QUFDcEQseUNBQXVFO0FBQ3ZFLHVDQUF3RDtBQUV4RCxtQ0FBZ0Q7QUFXaEQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSx3QkFBd0IsR0FBRyxnQkFBZ0IsQ0FBQztBQUVsRCxTQUFTLG1CQUFtQixDQUFDLFNBQWlCLEVBQUUsVUFBa0I7SUFDaEUsTUFBTSxNQUFNLEdBQUcsd0JBQXdCLEdBQUcsR0FBRyxHQUFHLFVBQVUsR0FBRyxHQUFHLEdBQUcsU0FBUyxDQUFDO0lBRTdFLGtEQUFrRDtJQUNsRCw4REFBOEQ7SUFDOUQsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBRWpGLE9BQU8sZ0JBQWdCLENBQUM7QUFDMUIsQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQUMsU0FBaUI7SUFDOUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsR0FBRyx3QkFBd0IsR0FBRyxDQUFDLEVBQUU7UUFDekQsT0FBTyxFQUFFLFNBQVMsRUFBRSxDQUFDO0tBQ3RCO0lBRUQsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFdkMsT0FBTztRQUNMLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ3BCLFVBQVUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0tBQ3RCLENBQUM7QUFDSixD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c0IsRUFDdEIsY0FBMkMsRUFDM0MsZ0JBQXVELEVBQy9DLFNBQTJCO1FBRW5DLEtBQUssQ0FBQyxjQUFjLEVBQUUsY0FBYyxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFGaEQsY0FBUyxHQUFULFNBQVMsQ0FBa0I7SUFHckMsQ0FBQztJQUVRLFlBQVksQ0FBQyxHQUFXLEVBQUUsT0FBZ0M7UUFDakUsSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQzdCLE9BQU8sS0FBSyxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7U0FDekM7UUFFRCxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUM7UUFDbEIsS0FBSyxNQUFNLFFBQVEsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO1lBQ3JDLE1BQU0sR0FBRyxLQUFLLENBQUMsWUFBWSxDQUFDLElBQUEsd0JBQWEsRUFBQyxJQUFBLGdCQUFJLEVBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzlFLElBQUksTUFBTSxLQUFLLElBQUksRUFBRTtnQkFDbkIsTUFBTTthQUNQO1NBQ0Y7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0NBQ0Y7QUF6QkQsb0VBeUJDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxTQUFnQixrQkFBa0IsQ0FBcUIsUUFBVztJQUNoRSxRQUFRLENBQUMsWUFBWSxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzdELFFBQVEsQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFN0MsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQztBQUxELGdEQUtDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IFJhd1NvdXJjZU1hcCB9IGZyb20gJ0BhbXBwcm9qZWN0L3JlbWFwcGluZyc7XG5pbXBvcnQgTWFnaWNTdHJpbmcgZnJvbSAnbWFnaWMtc3RyaW5nJztcbmltcG9ydCB7IHJlYWRGaWxlU3luYywgcmVhZGRpclN5bmMgfSBmcm9tICdub2RlOmZzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBkaXJuYW1lLCBleHRuYW1lLCBqb2luLCByZWxhdGl2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBwYXRoVG9GaWxlVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IHR5cGUgeyBJbXBvcnRlciwgSW1wb3J0ZXJSZXN1bHQsIFN5bnRheCB9IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHsgZmluZEltcG9ydHMsIGZpbmRVcmxzIH0gZnJvbSAnLi9sZXhlcic7XG5cbi8qKlxuICogQSBwcmVwcm9jZXNzZWQgY2FjaGUgZW50cnkgZm9yIHRoZSBmaWxlcyBhbmQgZGlyZWN0b3JpZXMgd2l0aGluIGEgcHJldmlvdXNseSBzZWFyY2hlZFxuICogZGlyZWN0b3J5IHdoZW4gcGVyZm9ybWluZyBTYXNzIGltcG9ydCByZXNvbHV0aW9uLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIERpcmVjdG9yeUVudHJ5IHtcbiAgZmlsZXM6IFNldDxzdHJpbmc+O1xuICBkaXJlY3RvcmllczogU2V0PHN0cmluZz47XG59XG5cbi8qKlxuICogQSBwcmVmaXggdGhhdCBpcyBhZGRlZCB0byBpbXBvcnQgYW5kIHVzZSBkaXJlY3RpdmUgc3BlY2lmaWVycyB0aGF0IHNob3VsZCBiZSByZXNvbHZlZFxuICogYXMgbW9kdWxlcyBhbmQgdGhhdCB3aWxsIGNvbnRhaW4gYWRkZWQgcmVzb2x2ZSBkaXJlY3RvcnkgaW5mb3JtYXRpb24uXG4gKlxuICogVGhpcyBmdW5jdGlvbmFsaXR5IGlzIHVzZWQgdG8gd29ya2Fyb3VuZCB0aGUgU2FzcyBsaW1pdGF0aW9uIHRoYXQgaXQgZG9lcyBub3QgcHJvdmlkZSB0aGVcbiAqIGltcG9ydGVyIGZpbGUgdG8gY3VzdG9tIHJlc29sdXRpb24gcGx1Z2lucy5cbiAqL1xuY29uc3QgTU9EVUxFX1JFU09MVVRJT05fUFJFRklYID0gJ19fTkdfUEFDS0FHRV9fJztcblxuZnVuY3Rpb24gcGFja01vZHVsZVNwZWNpZmllcihzcGVjaWZpZXI6IHN0cmluZywgcmVzb2x2ZURpcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgcGFja2VkID0gTU9EVUxFX1JFU09MVVRJT05fUFJFRklYICsgJzsnICsgcmVzb2x2ZURpciArICc7JyArIHNwZWNpZmllcjtcblxuICAvLyBOb3JtYWxpemUgcGF0aCBzZXBhcmF0b3JzIGFuZCBlc2NhcGUgY2hhcmFjdGVyc1xuICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9DU1MvdXJsI3N5bnRheFxuICBjb25zdCBub3JtYWxpemVkUGFja2VkID0gcGFja2VkLnJlcGxhY2UoL1xcXFwvZywgJy8nKS5yZXBsYWNlKC9bKClcXHMnXCJdL2csICdcXFxcJCYnKTtcblxuICByZXR1cm4gbm9ybWFsaXplZFBhY2tlZDtcbn1cblxuZnVuY3Rpb24gdW5wYWNrTW9kdWxlU3BlY2lmaWVyKHNwZWNpZmllcjogc3RyaW5nKTogeyBzcGVjaWZpZXI6IHN0cmluZzsgcmVzb2x2ZURpcj86IHN0cmluZyB9IHtcbiAgaWYgKCFzcGVjaWZpZXIuc3RhcnRzV2l0aChgJHtNT0RVTEVfUkVTT0xVVElPTl9QUkVGSVh9O2ApKSB7XG4gICAgcmV0dXJuIHsgc3BlY2lmaWVyIH07XG4gIH1cblxuICBjb25zdCB2YWx1ZXMgPSBzcGVjaWZpZXIuc3BsaXQoJzsnLCAzKTtcblxuICByZXR1cm4ge1xuICAgIHNwZWNpZmllcjogdmFsdWVzWzJdLFxuICAgIHJlc29sdmVEaXI6IHZhbHVlc1sxXSxcbiAgfTtcbn1cblxuLyoqXG4gKiBBIFNhc3MgSW1wb3J0ZXIgYmFzZSBjbGFzcyB0aGF0IHByb3ZpZGVzIHRoZSBsb2FkIGxvZ2ljIHRvIHJlYmFzZSBhbGwgYHVybCgpYCBmdW5jdGlvbnNcbiAqIHdpdGhpbiBhIHN0eWxlc2hlZXQuIFRoZSByZWJhc2luZyB3aWxsIGVuc3VyZSB0aGF0IHRoZSBVUkxzIGluIHRoZSBvdXRwdXQgb2YgdGhlIFNhc3MgY29tcGlsZXJcbiAqIHJlZmxlY3QgdGhlIGZpbmFsIGZpbGVzeXN0ZW0gbG9jYXRpb24gb2YgdGhlIG91dHB1dCBDU1MgZmlsZS5cbiAqXG4gKiBUaGlzIGNsYXNzIHByb3ZpZGVzIHRoZSBjb3JlIG9mIHRoZSByZWJhc2luZyBmdW5jdGlvbmFsaXR5LiBUbyBlbnN1cmUgdGhhdCBlYWNoIGZpbGUgaXMgcHJvY2Vzc2VkXG4gKiBieSB0aGlzIGltcG9ydGVyJ3MgbG9hZCBpbXBsZW1lbnRhdGlvbiwgdGhlIFNhc3MgY29tcGlsZXIgcmVxdWlyZXMgdGhlIGltcG9ydGVyJ3MgY2Fub25pY2FsaXplXG4gKiBmdW5jdGlvbiB0byByZXR1cm4gYSBub24tbnVsbCB2YWx1ZSB3aXRoIHRoZSByZXNvbHZlZCBsb2NhdGlvbiBvZiB0aGUgcmVxdWVzdGVkIHN0eWxlc2hlZXQuXG4gKiBDb25jcmV0ZSBpbXBsZW1lbnRhdGlvbnMgb2YgdGhpcyBjbGFzcyBtdXN0IHByb3ZpZGUgdGhpcyBjYW5vbmljYWxpemUgZnVuY3Rpb25hbGl0eSBmb3IgcmViYXNpbmdcbiAqIHRvIGJlIGVmZmVjdGl2ZS5cbiAqL1xuYWJzdHJhY3QgY2xhc3MgVXJsUmViYXNpbmdJbXBvcnRlciBpbXBsZW1lbnRzIEltcG9ydGVyPCdzeW5jJz4ge1xuICAvKipcbiAgICogQHBhcmFtIGVudHJ5RGlyZWN0b3J5IFRoZSBkaXJlY3Rvcnkgb2YgdGhlIGVudHJ5IHN0eWxlc2hlZXQgdGhhdCB3YXMgcGFzc2VkIHRvIHRoZSBTYXNzIGNvbXBpbGVyLlxuICAgKiBAcGFyYW0gcmViYXNlU291cmNlTWFwcyBXaGVuIHByb3ZpZGVkLCByZWJhc2VkIGZpbGVzIHdpbGwgaGF2ZSBhbiBpbnRlcm1lZGlhdGUgc291cmNlbWFwIGFkZGVkIHRvIHRoZSBNYXBcbiAgICogd2hpY2ggY2FuIGJlIHVzZWQgdG8gZ2VuZXJhdGUgYSBmaW5hbCBzb3VyY2VtYXAgdGhhdCBjb250YWlucyBvcmlnaW5hbCBzb3VyY2VzLlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBlbnRyeURpcmVjdG9yeTogc3RyaW5nLFxuICAgIHByaXZhdGUgcmViYXNlU291cmNlTWFwcz86IE1hcDxzdHJpbmcsIFJhd1NvdXJjZU1hcD4sXG4gICkge31cblxuICBhYnN0cmFjdCBjYW5vbmljYWxpemUodXJsOiBzdHJpbmcsIG9wdGlvbnM6IHsgZnJvbUltcG9ydDogYm9vbGVhbiB9KTogVVJMIHwgbnVsbDtcblxuICBsb2FkKGNhbm9uaWNhbFVybDogVVJMKTogSW1wb3J0ZXJSZXN1bHQgfCBudWxsIHtcbiAgICBjb25zdCBzdHlsZXNoZWV0UGF0aCA9IGZpbGVVUkxUb1BhdGgoY2Fub25pY2FsVXJsKTtcbiAgICBjb25zdCBzdHlsZXNoZWV0RGlyZWN0b3J5ID0gZGlybmFtZShzdHlsZXNoZWV0UGF0aCk7XG4gICAgbGV0IGNvbnRlbnRzID0gcmVhZEZpbGVTeW5jKHN0eWxlc2hlZXRQYXRoLCAndXRmLTgnKTtcblxuICAgIC8vIFJlYmFzZSBhbnkgVVJMcyB0aGF0IGFyZSBmb3VuZFxuICAgIGxldCB1cGRhdGVkQ29udGVudHM7XG4gICAgZm9yIChjb25zdCB7IHN0YXJ0LCBlbmQsIHZhbHVlIH0gb2YgZmluZFVybHMoY29udGVudHMpKSB7XG4gICAgICAvLyBTa2lwIGlmIHZhbHVlIGlzIGVtcHR5IG9yIGEgU2FzcyB2YXJpYWJsZVxuICAgICAgaWYgKHZhbHVlLmxlbmd0aCA9PT0gMCB8fCB2YWx1ZS5zdGFydHNXaXRoKCckJykpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIFNraXAgaWYgcm9vdC1yZWxhdGl2ZSwgYWJzb2x1dGUgb3IgcHJvdG9jb2wgcmVsYXRpdmUgdXJsXG4gICAgICBpZiAoL14oKD86XFx3KzopP1xcL1xcL3xkYXRhOnxjaHJvbWU6fCN8XFwvKS8udGVzdCh2YWx1ZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlYmFzZWRQYXRoID0gcmVsYXRpdmUodGhpcy5lbnRyeURpcmVjdG9yeSwgam9pbihzdHlsZXNoZWV0RGlyZWN0b3J5LCB2YWx1ZSkpO1xuXG4gICAgICAvLyBOb3JtYWxpemUgcGF0aCBzZXBhcmF0b3JzIGFuZCBlc2NhcGUgY2hhcmFjdGVyc1xuICAgICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQ1NTL3VybCNzeW50YXhcbiAgICAgIGNvbnN0IHJlYmFzZWRVcmwgPSAnLi8nICsgcmViYXNlZFBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpLnJlcGxhY2UoL1soKVxccydcIl0vZywgJ1xcXFwkJicpO1xuXG4gICAgICB1cGRhdGVkQ29udGVudHMgPz89IG5ldyBNYWdpY1N0cmluZyhjb250ZW50cyk7XG4gICAgICB1cGRhdGVkQ29udGVudHMudXBkYXRlKHN0YXJ0LCBlbmQsIHJlYmFzZWRVcmwpO1xuICAgIH1cblxuICAgIC8vIEFkZCByZXNvbHV0aW9uIGRpcmVjdG9yeSBpbmZvcm1hdGlvbiB0byBtb2R1bGUgc3BlY2lmaWVycyB0byBmYWNpbGl0YXRlIHJlc29sdXRpb25cbiAgICBmb3IgKGNvbnN0IHsgc3RhcnQsIGVuZCwgc3BlY2lmaWVyIH0gb2YgZmluZEltcG9ydHMoY29udGVudHMpKSB7XG4gICAgICAvLyBDdXJyZW50bHkgb25seSBwcm92aWRlIGRpcmVjdG9yeSBpbmZvcm1hdGlvbiBmb3Iga25vd24vY29tbW9uIHBhY2thZ2VzOlxuICAgICAgLy8gKiBgQG1hdGVyaWFsL2BcbiAgICAgIC8vICogYEBhbmd1bGFyL2BcbiAgICAgIC8vXG4gICAgICAvLyBDb21wcmVoZW5zaXZlIHByZS1yZXNvbHV0aW9uIHN1cHBvcnQgbWF5IGJlIGFkZGVkIGluIHRoZSBmdXR1cmUuIFRoaXMgaXMgY29tcGxpY2F0ZWQgYnkgQ1NTL1Nhc3Mgbm90XG4gICAgICAvLyByZXF1aXJpbmcgYSBgLi9gIG9yIGAuLi9gIHByZWZpeCB0byBzaWduaWZ5IHJlbGF0aXZlIHBhdGhzLiBBIGJhcmUgc3BlY2lmaWVyIGNvdWxkIGJlIGVpdGhlciByZWxhdGl2ZVxuICAgICAgLy8gb3IgYSBtb2R1bGUgc3BlY2lmaWVyLiBUbyBkaWZmZXJlbnRpYXRlLCBhIHJlbGF0aXZlIHJlc29sdXRpb24gd291bGQgbmVlZCB0byBiZSBhdHRlbXB0ZWQgZmlyc3QuXG4gICAgICBpZiAoIXNwZWNpZmllci5zdGFydHNXaXRoKCdAYW5ndWxhci8nKSAmJiAhc3BlY2lmaWVyLnN0YXJ0c1dpdGgoJ0BtYXRlcmlhbC8nKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgdXBkYXRlZENvbnRlbnRzID8/PSBuZXcgTWFnaWNTdHJpbmcoY29udGVudHMpO1xuICAgICAgdXBkYXRlZENvbnRlbnRzLnVwZGF0ZShcbiAgICAgICAgc3RhcnQsXG4gICAgICAgIGVuZCxcbiAgICAgICAgYFwiJHtwYWNrTW9kdWxlU3BlY2lmaWVyKHNwZWNpZmllciwgc3R5bGVzaGVldERpcmVjdG9yeSl9XCJgLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAodXBkYXRlZENvbnRlbnRzKSB7XG4gICAgICBjb250ZW50cyA9IHVwZGF0ZWRDb250ZW50cy50b1N0cmluZygpO1xuICAgICAgaWYgKHRoaXMucmViYXNlU291cmNlTWFwcykge1xuICAgICAgICAvLyBHZW5lcmF0ZSBhbiBpbnRlcm1lZGlhdGUgc291cmNlIG1hcCBmb3IgdGhlIHJlYmFzaW5nIGNoYW5nZXNcbiAgICAgICAgY29uc3QgbWFwID0gdXBkYXRlZENvbnRlbnRzLmdlbmVyYXRlTWFwKHtcbiAgICAgICAgICBoaXJlczogJ2JvdW5kYXJ5JyxcbiAgICAgICAgICBpbmNsdWRlQ29udGVudDogdHJ1ZSxcbiAgICAgICAgICBzb3VyY2U6IGNhbm9uaWNhbFVybC5ocmVmLFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5yZWJhc2VTb3VyY2VNYXBzLnNldChjYW5vbmljYWxVcmwuaHJlZiwgbWFwIGFzIFJhd1NvdXJjZU1hcCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGV0IHN5bnRheDogU3ludGF4IHwgdW5kZWZpbmVkO1xuICAgIHN3aXRjaCAoZXh0bmFtZShzdHlsZXNoZWV0UGF0aCkudG9Mb3dlckNhc2UoKSkge1xuICAgICAgY2FzZSAnLmNzcyc6XG4gICAgICAgIHN5bnRheCA9ICdjc3MnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJy5zYXNzJzpcbiAgICAgICAgc3ludGF4ID0gJ2luZGVudGVkJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBzeW50YXggPSAnc2Nzcyc7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBjb250ZW50cyxcbiAgICAgIHN5bnRheCxcbiAgICAgIHNvdXJjZU1hcFVybDogY2Fub25pY2FsVXJsLFxuICAgIH07XG4gIH1cbn1cblxuLyoqXG4gKiBQcm92aWRlcyB0aGUgU2FzcyBpbXBvcnRlciBsb2dpYyB0byByZXNvbHZlIHJlbGF0aXZlIHN0eWxlc2hlZXQgaW1wb3J0cyB2aWEgYm90aCBpbXBvcnQgYW5kIHVzZSBydWxlc1xuICogYW5kIGFsc28gcmViYXNlIGFueSBgdXJsKClgIGZ1bmN0aW9uIHVzYWdlIHdpdGhpbiB0aG9zZSBzdHlsZXNoZWV0cy4gVGhlIHJlYmFzaW5nIHdpbGwgZW5zdXJlIHRoYXRcbiAqIHRoZSBVUkxzIGluIHRoZSBvdXRwdXQgb2YgdGhlIFNhc3MgY29tcGlsZXIgcmVmbGVjdCB0aGUgZmluYWwgZmlsZXN5c3RlbSBsb2NhdGlvbiBvZiB0aGUgb3V0cHV0IENTUyBmaWxlLlxuICovXG5leHBvcnQgY2xhc3MgUmVsYXRpdmVVcmxSZWJhc2luZ0ltcG9ydGVyIGV4dGVuZHMgVXJsUmViYXNpbmdJbXBvcnRlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGVudHJ5RGlyZWN0b3J5OiBzdHJpbmcsXG4gICAgcHJpdmF0ZSBkaXJlY3RvcnlDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBEaXJlY3RvcnlFbnRyeT4oKSxcbiAgICByZWJhc2VTb3VyY2VNYXBzPzogTWFwPHN0cmluZywgUmF3U291cmNlTWFwPixcbiAgKSB7XG4gICAgc3VwZXIoZW50cnlEaXJlY3RvcnksIHJlYmFzZVNvdXJjZU1hcHMpO1xuICB9XG5cbiAgY2Fub25pY2FsaXplKHVybDogc3RyaW5nLCBvcHRpb25zOiB7IGZyb21JbXBvcnQ6IGJvb2xlYW4gfSk6IFVSTCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLnJlc29sdmVJbXBvcnQodXJsLCBvcHRpb25zLmZyb21JbXBvcnQsIHRydWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEF0dGVtcHRzIHRvIHJlc29sdmUgYSBwcm92aWRlZCBVUkwgdG8gYSBzdHlsZXNoZWV0IGZpbGUgdXNpbmcgdGhlIFNhc3MgY29tcGlsZXIncyByZXNvbHV0aW9uIGFsZ29yaXRobS5cbiAgICogQmFzZWQgb24gaHR0cHM6Ly9naXRodWIuY29tL3Nhc3MvZGFydC1zYXNzL2Jsb2IvNDRkNmJiNmFjNzJmZTZiOTNmNWJmZWMzNzFhMWZmZmIxOGU2Yjc2ZC9saWIvc3JjL2ltcG9ydGVyL3V0aWxzLmRhcnRcbiAgICogQHBhcmFtIHVybCBUaGUgZmlsZSBwcm90b2NvbCBVUkwgdG8gcmVzb2x2ZS5cbiAgICogQHBhcmFtIGZyb21JbXBvcnQgSWYgdHJ1ZSwgVVJMIHdhcyBmcm9tIGFuIGltcG9ydCBydWxlOyBvdGhlcndpc2UgZnJvbSBhIHVzZSBydWxlLlxuICAgKiBAcGFyYW0gY2hlY2tEaXJlY3RvcnkgSWYgdHJ1ZSwgdHJ5IGNoZWNraW5nIGZvciBhIGRpcmVjdG9yeSB3aXRoIHRoZSBiYXNlIG5hbWUgY29udGFpbmluZyBhbiBpbmRleCBmaWxlLlxuICAgKiBAcmV0dXJucyBBIGZ1bGwgcmVzb2x2ZWQgVVJMIG9mIHRoZSBzdHlsZXNoZWV0IGZpbGUgb3IgYG51bGxgIGlmIG5vdCBmb3VuZC5cbiAgICovXG4gIHByaXZhdGUgcmVzb2x2ZUltcG9ydCh1cmw6IHN0cmluZywgZnJvbUltcG9ydDogYm9vbGVhbiwgY2hlY2tEaXJlY3Rvcnk6IGJvb2xlYW4pOiBVUkwgfCBudWxsIHtcbiAgICBsZXQgc3R5bGVzaGVldFBhdGg7XG4gICAgdHJ5IHtcbiAgICAgIHN0eWxlc2hlZXRQYXRoID0gZmlsZVVSTFRvUGF0aCh1cmwpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gT25seSBmaWxlIHByb3RvY29sIFVSTHMgYXJlIHN1cHBvcnRlZCBieSB0aGlzIGltcG9ydGVyXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBkaXJlY3RvcnkgPSBkaXJuYW1lKHN0eWxlc2hlZXRQYXRoKTtcbiAgICBjb25zdCBleHRlbnNpb24gPSBleHRuYW1lKHN0eWxlc2hlZXRQYXRoKTtcbiAgICBjb25zdCBoYXNTdHlsZUV4dGVuc2lvbiA9XG4gICAgICBleHRlbnNpb24gPT09ICcuc2NzcycgfHwgZXh0ZW5zaW9uID09PSAnLnNhc3MnIHx8IGV4dGVuc2lvbiA9PT0gJy5jc3MnO1xuICAgIC8vIFJlbW92ZSB0aGUgc3R5bGUgZXh0ZW5zaW9uIGlmIHByZXNlbnQgdG8gYWxsb3cgYWRkaW5nIHRoZSBgLmltcG9ydGAgc3VmZml4XG4gICAgY29uc3QgZmlsZW5hbWUgPSBiYXNlbmFtZShzdHlsZXNoZWV0UGF0aCwgaGFzU3R5bGVFeHRlbnNpb24gPyBleHRlbnNpb24gOiB1bmRlZmluZWQpO1xuXG4gICAgY29uc3QgaW1wb3J0UG90ZW50aWFscyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IGRlZmF1bHRQb3RlbnRpYWxzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgICBpZiAoaGFzU3R5bGVFeHRlbnNpb24pIHtcbiAgICAgIGlmIChmcm9tSW1wb3J0KSB7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5pbXBvcnQnICsgZXh0ZW5zaW9uKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLmltcG9ydCcgKyBleHRlbnNpb24pO1xuICAgICAgfVxuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgZXh0ZW5zaW9uKTtcbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArIGV4dGVuc2lvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChmcm9tSW1wb3J0KSB7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5pbXBvcnQuc2NzcycpO1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuaW1wb3J0LnNhc3MnKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLmltcG9ydC5jc3MnKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLmltcG9ydC5zY3NzJyk7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5pbXBvcnQuc2FzcycpO1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuaW1wb3J0LmNzcycpO1xuICAgICAgfVxuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5zY3NzJyk7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLnNhc3MnKTtcbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuY3NzJyk7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLnNjc3MnKTtcbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuc2FzcycpO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5jc3MnKTtcbiAgICB9XG5cbiAgICBsZXQgZm91bmREZWZhdWx0cztcbiAgICBsZXQgZm91bmRJbXBvcnRzO1xuICAgIGxldCBoYXNQb3RlbnRpYWxJbmRleCA9IGZhbHNlO1xuXG4gICAgbGV0IGNhY2hlZEVudHJpZXMgPSB0aGlzLmRpcmVjdG9yeUNhY2hlLmdldChkaXJlY3RvcnkpO1xuICAgIGlmIChjYWNoZWRFbnRyaWVzKSB7XG4gICAgICAvLyBJZiB0aGVyZSBpcyBhIHByZXByb2Nlc3NlZCBjYWNoZSBvZiB0aGUgZGlyZWN0b3J5LCBwZXJmb3JtIGFuIGludGVyc2VjdGlvbiBvZiB0aGUgcG90ZW50aWFsc1xuICAgICAgLy8gYW5kIHRoZSBkaXJlY3RvcnkgZmlsZXMuXG4gICAgICBjb25zdCB7IGZpbGVzLCBkaXJlY3RvcmllcyB9ID0gY2FjaGVkRW50cmllcztcbiAgICAgIGZvdW5kRGVmYXVsdHMgPSBbLi4uZGVmYXVsdFBvdGVudGlhbHNdLmZpbHRlcigocG90ZW50aWFsKSA9PiBmaWxlcy5oYXMocG90ZW50aWFsKSk7XG4gICAgICBmb3VuZEltcG9ydHMgPSBbLi4uaW1wb3J0UG90ZW50aWFsc10uZmlsdGVyKChwb3RlbnRpYWwpID0+IGZpbGVzLmhhcyhwb3RlbnRpYWwpKTtcbiAgICAgIGhhc1BvdGVudGlhbEluZGV4ID0gY2hlY2tEaXJlY3RvcnkgJiYgIWhhc1N0eWxlRXh0ZW5zaW9uICYmIGRpcmVjdG9yaWVzLmhhcyhmaWxlbmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElmIG5vIHByZXByb2Nlc3NlZCBjYWNoZSBleGlzdHMsIGdldCB0aGUgZW50cmllcyBmcm9tIHRoZSBmaWxlIHN5c3RlbSBhbmQsIHdoaWxlIHNlYXJjaGluZyxcbiAgICAgIC8vIGdlbmVyYXRlIHRoZSBjYWNoZSBmb3IgbGF0ZXIgcmVxdWVzdHMuXG4gICAgICBsZXQgZW50cmllcztcbiAgICAgIHRyeSB7XG4gICAgICAgIGVudHJpZXMgPSByZWFkZGlyU3luYyhkaXJlY3RvcnksIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgZm91bmREZWZhdWx0cyA9IFtdO1xuICAgICAgZm91bmRJbXBvcnRzID0gW107XG4gICAgICBjYWNoZWRFbnRyaWVzID0geyBmaWxlczogbmV3IFNldDxzdHJpbmc+KCksIGRpcmVjdG9yaWVzOiBuZXcgU2V0PHN0cmluZz4oKSB9O1xuICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgICAgIGNvbnN0IGlzRGlyZWN0b3J5ID0gZW50cnkuaXNEaXJlY3RvcnkoKTtcbiAgICAgICAgaWYgKGlzRGlyZWN0b3J5KSB7XG4gICAgICAgICAgY2FjaGVkRW50cmllcy5kaXJlY3Rvcmllcy5hZGQoZW50cnkubmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWNvcmQgaWYgdGhlIG5hbWUgc2hvdWxkIGJlIGNoZWNrZWQgYXMgYSBkaXJlY3Rvcnkgd2l0aCBhbiBpbmRleCBmaWxlXG4gICAgICAgIGlmIChjaGVja0RpcmVjdG9yeSAmJiAhaGFzU3R5bGVFeHRlbnNpb24gJiYgZW50cnkubmFtZSA9PT0gZmlsZW5hbWUgJiYgaXNEaXJlY3RvcnkpIHtcbiAgICAgICAgICBoYXNQb3RlbnRpYWxJbmRleCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWVudHJ5LmlzRmlsZSgpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjYWNoZWRFbnRyaWVzLmZpbGVzLmFkZChlbnRyeS5uYW1lKTtcblxuICAgICAgICBpZiAoaW1wb3J0UG90ZW50aWFscy5oYXMoZW50cnkubmFtZSkpIHtcbiAgICAgICAgICBmb3VuZEltcG9ydHMucHVzaChlbnRyeS5uYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkZWZhdWx0UG90ZW50aWFscy5oYXMoZW50cnkubmFtZSkpIHtcbiAgICAgICAgICBmb3VuZERlZmF1bHRzLnB1c2goZW50cnkubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5kaXJlY3RvcnlDYWNoZS5zZXQoZGlyZWN0b3J5LCBjYWNoZWRFbnRyaWVzKTtcbiAgICB9XG5cbiAgICAvLyBgZm91bmRJbXBvcnRzYCB3aWxsIG9ubHkgY29udGFpbiBlbGVtZW50cyBpZiBgb3B0aW9ucy5mcm9tSW1wb3J0YCBpcyB0cnVlXG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5jaGVja0ZvdW5kKGZvdW5kSW1wb3J0cykgPz8gdGhpcy5jaGVja0ZvdW5kKGZvdW5kRGVmYXVsdHMpO1xuICAgIGlmIChyZXN1bHQgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKGpvaW4oZGlyZWN0b3J5LCByZXN1bHQpKTtcbiAgICB9XG5cbiAgICBpZiAoaGFzUG90ZW50aWFsSW5kZXgpIHtcbiAgICAgIC8vIENoZWNrIGZvciBpbmRleCBmaWxlcyB1c2luZyBmaWxlbmFtZSBhcyBhIGRpcmVjdG9yeVxuICAgICAgcmV0dXJuIHRoaXMucmVzb2x2ZUltcG9ydCh1cmwgKyAnL2luZGV4JywgZnJvbUltcG9ydCwgZmFsc2UpO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBhbiBhcnJheSBvZiBwb3RlbnRpYWwgc3R5bGVzaGVldCBmaWxlcyB0byBkZXRlcm1pbmUgaWYgdGhlcmUgaXMgYSB2YWxpZFxuICAgKiBzdHlsZXNoZWV0IGZpbGUuIE1vcmUgdGhhbiBvbmUgZGlzY292ZXJlZCBmaWxlIG1heSBpbmRpY2F0ZSBhbiBlcnJvci5cbiAgICogQHBhcmFtIGZvdW5kIEFuIGFycmF5IG9mIGRpc2NvdmVyZWQgc3R5bGVzaGVldCBmaWxlcy5cbiAgICogQHJldHVybnMgQSBmdWxseSByZXNvbHZlZCBwYXRoIGZvciBhIHN0eWxlc2hlZXQgZmlsZSBvciBgbnVsbGAgaWYgbm90IGZvdW5kLlxuICAgKiBAdGhyb3dzIElmIHRoZXJlIGFyZSBhbWJpZ3VvdXMgZmlsZXMgZGlzY292ZXJlZC5cbiAgICovXG4gIHByaXZhdGUgY2hlY2tGb3VuZChmb3VuZDogc3RyaW5nW10pOiBzdHJpbmcgfCBudWxsIHtcbiAgICBpZiAoZm91bmQubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBOb3QgZm91bmRcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIE1vcmUgdGhhbiBvbmUgZm91bmQgZmlsZSBtYXkgYmUgYW4gZXJyb3JcbiAgICBpZiAoZm91bmQubGVuZ3RoID4gMSkge1xuICAgICAgLy8gUHJlc2VuY2Ugb2YgQ1NTIGZpbGVzIGFsb25nc2lkZSBhIFNhc3MgZmlsZSBkb2VzIG5vdCBjYXVzZSBhbiBlcnJvclxuICAgICAgY29uc3QgZm91bmRXaXRob3V0Q3NzID0gZm91bmQuZmlsdGVyKChlbGVtZW50KSA9PiBleHRuYW1lKGVsZW1lbnQpICE9PSAnLmNzcycpO1xuICAgICAgLy8gSWYgdGhlIGxlbmd0aCBpcyB6ZXJvIHRoZW4gdGhlcmUgYXJlIHR3byBvciBtb3JlIGNzcyBmaWxlc1xuICAgICAgLy8gSWYgdGhlIGxlbmd0aCBpcyBtb3JlIHRoYW4gb25lIHRoYW4gdGhlcmUgYXJlIHR3byBvciBtb3JlIHNhc3Mvc2NzcyBmaWxlc1xuICAgICAgaWYgKGZvdW5kV2l0aG91dENzcy5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbWJpZ3VvdXMgaW1wb3J0IGRldGVjdGVkLicpO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXR1cm4gdGhlIG5vbi1DU1MgZmlsZSAoc2Fzcy9zY3NzIGZpbGVzIGhhdmUgcHJpb3JpdHkpXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vc2Fzcy9kYXJ0LXNhc3MvYmxvYi80NGQ2YmI2YWM3MmZlNmI5M2Y1YmZlYzM3MWExZmZmYjE4ZTZiNzZkL2xpYi9zcmMvaW1wb3J0ZXIvdXRpbHMuZGFydCNMNDQtTDQ3XG4gICAgICByZXR1cm4gZm91bmRXaXRob3V0Q3NzWzBdO1xuICAgIH1cblxuICAgIHJldHVybiBmb3VuZFswXTtcbiAgfVxufVxuXG4vKipcbiAqIFByb3ZpZGVzIHRoZSBTYXNzIGltcG9ydGVyIGxvZ2ljIHRvIHJlc29sdmUgbW9kdWxlIChucG0gcGFja2FnZSkgc3R5bGVzaGVldCBpbXBvcnRzIHZpYSBib3RoIGltcG9ydCBhbmRcbiAqIHVzZSBydWxlcyBhbmQgYWxzbyByZWJhc2UgYW55IGB1cmwoKWAgZnVuY3Rpb24gdXNhZ2Ugd2l0aGluIHRob3NlIHN0eWxlc2hlZXRzLiBUaGUgcmViYXNpbmcgd2lsbCBlbnN1cmUgdGhhdFxuICogdGhlIFVSTHMgaW4gdGhlIG91dHB1dCBvZiB0aGUgU2FzcyBjb21waWxlciByZWZsZWN0IHRoZSBmaW5hbCBmaWxlc3lzdGVtIGxvY2F0aW9uIG9mIHRoZSBvdXRwdXQgQ1NTIGZpbGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBNb2R1bGVVcmxSZWJhc2luZ0ltcG9ydGVyIGV4dGVuZHMgUmVsYXRpdmVVcmxSZWJhc2luZ0ltcG9ydGVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgZW50cnlEaXJlY3Rvcnk6IHN0cmluZyxcbiAgICBkaXJlY3RvcnlDYWNoZTogTWFwPHN0cmluZywgRGlyZWN0b3J5RW50cnk+LFxuICAgIHJlYmFzZVNvdXJjZU1hcHM6IE1hcDxzdHJpbmcsIFJhd1NvdXJjZU1hcD4gfCB1bmRlZmluZWQsXG4gICAgcHJpdmF0ZSBmaW5kZXI6IChcbiAgICAgIHNwZWNpZmllcjogc3RyaW5nLFxuICAgICAgb3B0aW9uczogeyBmcm9tSW1wb3J0OiBib29sZWFuOyByZXNvbHZlRGlyPzogc3RyaW5nIH0sXG4gICAgKSA9PiBVUkwgfCBudWxsLFxuICApIHtcbiAgICBzdXBlcihlbnRyeURpcmVjdG9yeSwgZGlyZWN0b3J5Q2FjaGUsIHJlYmFzZVNvdXJjZU1hcHMpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY2Fub25pY2FsaXplKHVybDogc3RyaW5nLCBvcHRpb25zOiB7IGZyb21JbXBvcnQ6IGJvb2xlYW4gfSk6IFVSTCB8IG51bGwge1xuICAgIGlmICh1cmwuc3RhcnRzV2l0aCgnZmlsZTovLycpKSB7XG4gICAgICByZXR1cm4gc3VwZXIuY2Fub25pY2FsaXplKHVybCwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBzcGVjaWZpZXIsIHJlc29sdmVEaXIgfSA9IHVucGFja01vZHVsZVNwZWNpZmllcih1cmwpO1xuXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMuZmluZGVyKHNwZWNpZmllciwgeyAuLi5vcHRpb25zLCByZXNvbHZlRGlyIH0pO1xuICAgIHJlc3VsdCAmJj0gc3VwZXIuY2Fub25pY2FsaXplKHJlc3VsdC5ocmVmLCBvcHRpb25zKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuLyoqXG4gKiBQcm92aWRlcyB0aGUgU2FzcyBpbXBvcnRlciBsb2dpYyB0byByZXNvbHZlIGxvYWQgcGF0aHMgbG9jYXRlZCBzdHlsZXNoZWV0IGltcG9ydHMgdmlhIGJvdGggaW1wb3J0IGFuZFxuICogdXNlIHJ1bGVzIGFuZCBhbHNvIHJlYmFzZSBhbnkgYHVybCgpYCBmdW5jdGlvbiB1c2FnZSB3aXRoaW4gdGhvc2Ugc3R5bGVzaGVldHMuIFRoZSByZWJhc2luZyB3aWxsIGVuc3VyZSB0aGF0XG4gKiB0aGUgVVJMcyBpbiB0aGUgb3V0cHV0IG9mIHRoZSBTYXNzIGNvbXBpbGVyIHJlZmxlY3QgdGhlIGZpbmFsIGZpbGVzeXN0ZW0gbG9jYXRpb24gb2YgdGhlIG91dHB1dCBDU1MgZmlsZS5cbiAqL1xuZXhwb3J0IGNsYXNzIExvYWRQYXRoc1VybFJlYmFzaW5nSW1wb3J0ZXIgZXh0ZW5kcyBSZWxhdGl2ZVVybFJlYmFzaW5nSW1wb3J0ZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICBlbnRyeURpcmVjdG9yeTogc3RyaW5nLFxuICAgIGRpcmVjdG9yeUNhY2hlOiBNYXA8c3RyaW5nLCBEaXJlY3RvcnlFbnRyeT4sXG4gICAgcmViYXNlU291cmNlTWFwczogTWFwPHN0cmluZywgUmF3U291cmNlTWFwPiB8IHVuZGVmaW5lZCxcbiAgICBwcml2YXRlIGxvYWRQYXRoczogSXRlcmFibGU8c3RyaW5nPixcbiAgKSB7XG4gICAgc3VwZXIoZW50cnlEaXJlY3RvcnksIGRpcmVjdG9yeUNhY2hlLCByZWJhc2VTb3VyY2VNYXBzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNhbm9uaWNhbGl6ZSh1cmw6IHN0cmluZywgb3B0aW9uczogeyBmcm9tSW1wb3J0OiBib29sZWFuIH0pOiBVUkwgfCBudWxsIHtcbiAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJ2ZpbGU6Ly8nKSkge1xuICAgICAgcmV0dXJuIHN1cGVyLmNhbm9uaWNhbGl6ZSh1cmwsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIGxldCByZXN1bHQgPSBudWxsO1xuICAgIGZvciAoY29uc3QgbG9hZFBhdGggb2YgdGhpcy5sb2FkUGF0aHMpIHtcbiAgICAgIHJlc3VsdCA9IHN1cGVyLmNhbm9uaWNhbGl6ZShwYXRoVG9GaWxlVVJMKGpvaW4obG9hZFBhdGgsIHVybCkpLmhyZWYsIG9wdGlvbnMpO1xuICAgICAgaWYgKHJlc3VsdCAhPT0gbnVsbCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cbi8qKlxuICogV29ya2Fyb3VuZCBmb3IgU2FzcyBub3QgY2FsbGluZyBpbnN0YW5jZSBtZXRob2RzIHdpdGggYHRoaXNgLlxuICogVGhlIGBjYW5vbmljYWxpemVgIGFuZCBgbG9hZGAgbWV0aG9kcyB3aWxsIGJlIGJvdW5kIHRvIHRoZSBjbGFzcyBpbnN0YW5jZS5cbiAqIEBwYXJhbSBpbXBvcnRlciBBIFNhc3MgaW1wb3J0ZXIgdG8gYmluZC5cbiAqIEByZXR1cm5zIFRoZSBib3VuZCBTYXNzIGltcG9ydGVyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2Fzc0JpbmRXb3JrYXJvdW5kPFQgZXh0ZW5kcyBJbXBvcnRlcj4oaW1wb3J0ZXI6IFQpOiBUIHtcbiAgaW1wb3J0ZXIuY2Fub25pY2FsaXplID0gaW1wb3J0ZXIuY2Fub25pY2FsaXplLmJpbmQoaW1wb3J0ZXIpO1xuICBpbXBvcnRlci5sb2FkID0gaW1wb3J0ZXIubG9hZC5iaW5kKGltcG9ydGVyKTtcblxuICByZXR1cm4gaW1wb3J0ZXI7XG59XG4iXX0=