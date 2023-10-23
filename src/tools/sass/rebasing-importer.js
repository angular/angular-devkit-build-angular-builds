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
            // Skip if value is empty, a Sass variable, or Webpack-specific prefix
            if (value.length === 0 || value[0] === '$' || value[0] === '~' || value[0] === '^') {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmViYXNpbmctaW1wb3J0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9zYXNzL3JlYmFzaW5nLWltcG9ydGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILGdFQUF1QztBQUN2QyxxQ0FBb0Q7QUFDcEQseUNBQXVFO0FBQ3ZFLHVDQUF3RDtBQUV4RCxtQ0FBbUM7QUFXbkM7Ozs7Ozs7Ozs7R0FVRztBQUNILE1BQWUsbUJBQW1CO0lBT3RCO0lBQ0E7SUFQVjs7OztPQUlHO0lBQ0gsWUFDVSxjQUFzQixFQUN0QixnQkFBNEM7UUFENUMsbUJBQWMsR0FBZCxjQUFjLENBQVE7UUFDdEIscUJBQWdCLEdBQWhCLGdCQUFnQixDQUE0QjtJQUNuRCxDQUFDO0lBSUosSUFBSSxDQUFDLFlBQWlCO1FBQ3BCLE1BQU0sY0FBYyxHQUFHLElBQUEsd0JBQWEsRUFBQyxZQUFZLENBQUMsQ0FBQztRQUNuRCxNQUFNLG1CQUFtQixHQUFHLElBQUEsbUJBQU8sRUFBQyxjQUFjLENBQUMsQ0FBQztRQUNwRCxJQUFJLFFBQVEsR0FBRyxJQUFBLHNCQUFZLEVBQUMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRXJELGlDQUFpQztRQUNqQyxJQUFJLGVBQWUsQ0FBQztRQUNwQixLQUFLLE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLElBQUEsZ0JBQVEsRUFBQyxRQUFRLENBQUMsRUFBRTtZQUN0RCxzRUFBc0U7WUFDdEUsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFL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QUFTLENBQUMsRUFBRTtZQUM3QixPQUFPLEtBQUssQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1NBQ3pDO1FBRUQsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDO1FBQ2xCLEtBQUssTUFBTSxRQUFRLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRTtZQUNyQyxNQUFNLEdBQUcsS0FBSyxDQUFDLFlBQVksQ0FBQyxJQUFBLHdCQUFhLEVBQUMsSUFBQSxnQkFBSSxFQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUM5RSxJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUU7Z0JBQ25CLE1BQU07YUFDUDtTQUNGO1FBRUQsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztDQUNGO0FBekJELG9FQXlCQztBQUVEOzs7OztHQUtHO0FBQ0gsU0FBZ0Isa0JBQWtCLENBQXFCLFFBQVc7SUFDaEUsUUFBUSxDQUFDLFlBQVksR0FBRyxRQUFRLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUM3RCxRQUFRLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRTdDLE9BQU8sUUFBUSxDQUFDO0FBQ2xCLENBQUM7QUFMRCxnREFLQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBSYXdTb3VyY2VNYXAgfSBmcm9tICdAYW1wcHJvamVjdC9yZW1hcHBpbmcnO1xuaW1wb3J0IE1hZ2ljU3RyaW5nIGZyb20gJ21hZ2ljLXN0cmluZyc7XG5pbXBvcnQgeyByZWFkRmlsZVN5bmMsIHJlYWRkaXJTeW5jIH0gZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSwgZXh0bmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0eXBlIHsgQ2Fub25pY2FsaXplQ29udGV4dCwgSW1wb3J0ZXIsIEltcG9ydGVyUmVzdWx0LCBTeW50YXggfSBmcm9tICdzYXNzJztcbmltcG9ydCB7IGZpbmRVcmxzIH0gZnJvbSAnLi9sZXhlcic7XG5cbi8qKlxuICogQSBwcmVwcm9jZXNzZWQgY2FjaGUgZW50cnkgZm9yIHRoZSBmaWxlcyBhbmQgZGlyZWN0b3JpZXMgd2l0aGluIGEgcHJldmlvdXNseSBzZWFyY2hlZFxuICogZGlyZWN0b3J5IHdoZW4gcGVyZm9ybWluZyBTYXNzIGltcG9ydCByZXNvbHV0aW9uLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIERpcmVjdG9yeUVudHJ5IHtcbiAgZmlsZXM6IFNldDxzdHJpbmc+O1xuICBkaXJlY3RvcmllczogU2V0PHN0cmluZz47XG59XG5cbi8qKlxuICogQSBTYXNzIEltcG9ydGVyIGJhc2UgY2xhc3MgdGhhdCBwcm92aWRlcyB0aGUgbG9hZCBsb2dpYyB0byByZWJhc2UgYWxsIGB1cmwoKWAgZnVuY3Rpb25zXG4gKiB3aXRoaW4gYSBzdHlsZXNoZWV0LiBUaGUgcmViYXNpbmcgd2lsbCBlbnN1cmUgdGhhdCB0aGUgVVJMcyBpbiB0aGUgb3V0cHV0IG9mIHRoZSBTYXNzIGNvbXBpbGVyXG4gKiByZWZsZWN0IHRoZSBmaW5hbCBmaWxlc3lzdGVtIGxvY2F0aW9uIG9mIHRoZSBvdXRwdXQgQ1NTIGZpbGUuXG4gKlxuICogVGhpcyBjbGFzcyBwcm92aWRlcyB0aGUgY29yZSBvZiB0aGUgcmViYXNpbmcgZnVuY3Rpb25hbGl0eS4gVG8gZW5zdXJlIHRoYXQgZWFjaCBmaWxlIGlzIHByb2Nlc3NlZFxuICogYnkgdGhpcyBpbXBvcnRlcidzIGxvYWQgaW1wbGVtZW50YXRpb24sIHRoZSBTYXNzIGNvbXBpbGVyIHJlcXVpcmVzIHRoZSBpbXBvcnRlcidzIGNhbm9uaWNhbGl6ZVxuICogZnVuY3Rpb24gdG8gcmV0dXJuIGEgbm9uLW51bGwgdmFsdWUgd2l0aCB0aGUgcmVzb2x2ZWQgbG9jYXRpb24gb2YgdGhlIHJlcXVlc3RlZCBzdHlsZXNoZWV0LlxuICogQ29uY3JldGUgaW1wbGVtZW50YXRpb25zIG9mIHRoaXMgY2xhc3MgbXVzdCBwcm92aWRlIHRoaXMgY2Fub25pY2FsaXplIGZ1bmN0aW9uYWxpdHkgZm9yIHJlYmFzaW5nXG4gKiB0byBiZSBlZmZlY3RpdmUuXG4gKi9cbmFic3RyYWN0IGNsYXNzIFVybFJlYmFzaW5nSW1wb3J0ZXIgaW1wbGVtZW50cyBJbXBvcnRlcjwnc3luYyc+IHtcbiAgLyoqXG4gICAqIEBwYXJhbSBlbnRyeURpcmVjdG9yeSBUaGUgZGlyZWN0b3J5IG9mIHRoZSBlbnRyeSBzdHlsZXNoZWV0IHRoYXQgd2FzIHBhc3NlZCB0byB0aGUgU2FzcyBjb21waWxlci5cbiAgICogQHBhcmFtIHJlYmFzZVNvdXJjZU1hcHMgV2hlbiBwcm92aWRlZCwgcmViYXNlZCBmaWxlcyB3aWxsIGhhdmUgYW4gaW50ZXJtZWRpYXRlIHNvdXJjZW1hcCBhZGRlZCB0byB0aGUgTWFwXG4gICAqIHdoaWNoIGNhbiBiZSB1c2VkIHRvIGdlbmVyYXRlIGEgZmluYWwgc291cmNlbWFwIHRoYXQgY29udGFpbnMgb3JpZ2luYWwgc291cmNlcy5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgZW50cnlEaXJlY3Rvcnk6IHN0cmluZyxcbiAgICBwcml2YXRlIHJlYmFzZVNvdXJjZU1hcHM/OiBNYXA8c3RyaW5nLCBSYXdTb3VyY2VNYXA+LFxuICApIHt9XG5cbiAgYWJzdHJhY3QgY2Fub25pY2FsaXplKHVybDogc3RyaW5nLCBvcHRpb25zOiB7IGZyb21JbXBvcnQ6IGJvb2xlYW4gfSk6IFVSTCB8IG51bGw7XG5cbiAgbG9hZChjYW5vbmljYWxVcmw6IFVSTCk6IEltcG9ydGVyUmVzdWx0IHwgbnVsbCB7XG4gICAgY29uc3Qgc3R5bGVzaGVldFBhdGggPSBmaWxlVVJMVG9QYXRoKGNhbm9uaWNhbFVybCk7XG4gICAgY29uc3Qgc3R5bGVzaGVldERpcmVjdG9yeSA9IGRpcm5hbWUoc3R5bGVzaGVldFBhdGgpO1xuICAgIGxldCBjb250ZW50cyA9IHJlYWRGaWxlU3luYyhzdHlsZXNoZWV0UGF0aCwgJ3V0Zi04Jyk7XG5cbiAgICAvLyBSZWJhc2UgYW55IFVSTHMgdGhhdCBhcmUgZm91bmRcbiAgICBsZXQgdXBkYXRlZENvbnRlbnRzO1xuICAgIGZvciAoY29uc3QgeyBzdGFydCwgZW5kLCB2YWx1ZSB9IG9mIGZpbmRVcmxzKGNvbnRlbnRzKSkge1xuICAgICAgLy8gU2tpcCBpZiB2YWx1ZSBpcyBlbXB0eSwgYSBTYXNzIHZhcmlhYmxlLCBvciBXZWJwYWNrLXNwZWNpZmljIHByZWZpeFxuICAgICAgaWYgKHZhbHVlLmxlbmd0aCA9PT0gMCB8fCB2YWx1ZVswXSA9PT0gJyQnIHx8IHZhbHVlWzBdID09PSAnficgfHwgdmFsdWVbMF0gPT09ICdeJykge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gU2tpcCBpZiByb290LXJlbGF0aXZlLCBhYnNvbHV0ZSBvciBwcm90b2NvbCByZWxhdGl2ZSB1cmxcbiAgICAgIGlmICgvXigoPzpcXHcrOik/XFwvXFwvfGRhdGE6fGNocm9tZTp8I3xcXC8pLy50ZXN0KHZhbHVlKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmViYXNlZFBhdGggPSByZWxhdGl2ZSh0aGlzLmVudHJ5RGlyZWN0b3J5LCBqb2luKHN0eWxlc2hlZXREaXJlY3RvcnksIHZhbHVlKSk7XG5cbiAgICAgIC8vIE5vcm1hbGl6ZSBwYXRoIHNlcGFyYXRvcnMgYW5kIGVzY2FwZSBjaGFyYWN0ZXJzXG4gICAgICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9DU1MvdXJsI3N5bnRheFxuICAgICAgY29uc3QgcmViYXNlZFVybCA9ICcuLycgKyByZWJhc2VkUGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJykucmVwbGFjZSgvWygpXFxzJ1wiXS9nLCAnXFxcXCQmJyk7XG5cbiAgICAgIHVwZGF0ZWRDb250ZW50cyA/Pz0gbmV3IE1hZ2ljU3RyaW5nKGNvbnRlbnRzKTtcbiAgICAgIHVwZGF0ZWRDb250ZW50cy51cGRhdGUoc3RhcnQsIGVuZCwgcmViYXNlZFVybCk7XG4gICAgfVxuXG4gICAgaWYgKHVwZGF0ZWRDb250ZW50cykge1xuICAgICAgY29udGVudHMgPSB1cGRhdGVkQ29udGVudHMudG9TdHJpbmcoKTtcbiAgICAgIGlmICh0aGlzLnJlYmFzZVNvdXJjZU1hcHMpIHtcbiAgICAgICAgLy8gR2VuZXJhdGUgYW4gaW50ZXJtZWRpYXRlIHNvdXJjZSBtYXAgZm9yIHRoZSByZWJhc2luZyBjaGFuZ2VzXG4gICAgICAgIGNvbnN0IG1hcCA9IHVwZGF0ZWRDb250ZW50cy5nZW5lcmF0ZU1hcCh7XG4gICAgICAgICAgaGlyZXM6ICdib3VuZGFyeScsXG4gICAgICAgICAgaW5jbHVkZUNvbnRlbnQ6IHRydWUsXG4gICAgICAgICAgc291cmNlOiBjYW5vbmljYWxVcmwuaHJlZixcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucmViYXNlU291cmNlTWFwcy5zZXQoY2Fub25pY2FsVXJsLmhyZWYsIG1hcCBhcyBSYXdTb3VyY2VNYXApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxldCBzeW50YXg6IFN5bnRheCB8IHVuZGVmaW5lZDtcbiAgICBzd2l0Y2ggKGV4dG5hbWUoc3R5bGVzaGVldFBhdGgpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgIGNhc2UgJy5jc3MnOlxuICAgICAgICBzeW50YXggPSAnY3NzJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICcuc2Fzcyc6XG4gICAgICAgIHN5bnRheCA9ICdpbmRlbnRlZCc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgc3ludGF4ID0gJ3Njc3MnO1xuICAgICAgICBicmVhaztcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29udGVudHMsXG4gICAgICBzeW50YXgsXG4gICAgICBzb3VyY2VNYXBVcmw6IGNhbm9uaWNhbFVybCxcbiAgICB9O1xuICB9XG59XG5cbi8qKlxuICogUHJvdmlkZXMgdGhlIFNhc3MgaW1wb3J0ZXIgbG9naWMgdG8gcmVzb2x2ZSByZWxhdGl2ZSBzdHlsZXNoZWV0IGltcG9ydHMgdmlhIGJvdGggaW1wb3J0IGFuZCB1c2UgcnVsZXNcbiAqIGFuZCBhbHNvIHJlYmFzZSBhbnkgYHVybCgpYCBmdW5jdGlvbiB1c2FnZSB3aXRoaW4gdGhvc2Ugc3R5bGVzaGVldHMuIFRoZSByZWJhc2luZyB3aWxsIGVuc3VyZSB0aGF0XG4gKiB0aGUgVVJMcyBpbiB0aGUgb3V0cHV0IG9mIHRoZSBTYXNzIGNvbXBpbGVyIHJlZmxlY3QgdGhlIGZpbmFsIGZpbGVzeXN0ZW0gbG9jYXRpb24gb2YgdGhlIG91dHB1dCBDU1MgZmlsZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFJlbGF0aXZlVXJsUmViYXNpbmdJbXBvcnRlciBleHRlbmRzIFVybFJlYmFzaW5nSW1wb3J0ZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICBlbnRyeURpcmVjdG9yeTogc3RyaW5nLFxuICAgIHByaXZhdGUgZGlyZWN0b3J5Q2FjaGUgPSBuZXcgTWFwPHN0cmluZywgRGlyZWN0b3J5RW50cnk+KCksXG4gICAgcmViYXNlU291cmNlTWFwcz86IE1hcDxzdHJpbmcsIFJhd1NvdXJjZU1hcD4sXG4gICkge1xuICAgIHN1cGVyKGVudHJ5RGlyZWN0b3J5LCByZWJhc2VTb3VyY2VNYXBzKTtcbiAgfVxuXG4gIGNhbm9uaWNhbGl6ZSh1cmw6IHN0cmluZywgb3B0aW9uczogeyBmcm9tSW1wb3J0OiBib29sZWFuIH0pOiBVUkwgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5yZXNvbHZlSW1wb3J0KHVybCwgb3B0aW9ucy5mcm9tSW1wb3J0LCB0cnVlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBdHRlbXB0cyB0byByZXNvbHZlIGEgcHJvdmlkZWQgVVJMIHRvIGEgc3R5bGVzaGVldCBmaWxlIHVzaW5nIHRoZSBTYXNzIGNvbXBpbGVyJ3MgcmVzb2x1dGlvbiBhbGdvcml0aG0uXG4gICAqIEJhc2VkIG9uIGh0dHBzOi8vZ2l0aHViLmNvbS9zYXNzL2RhcnQtc2Fzcy9ibG9iLzQ0ZDZiYjZhYzcyZmU2YjkzZjViZmVjMzcxYTFmZmZiMThlNmI3NmQvbGliL3NyYy9pbXBvcnRlci91dGlscy5kYXJ0XG4gICAqIEBwYXJhbSB1cmwgVGhlIGZpbGUgcHJvdG9jb2wgVVJMIHRvIHJlc29sdmUuXG4gICAqIEBwYXJhbSBmcm9tSW1wb3J0IElmIHRydWUsIFVSTCB3YXMgZnJvbSBhbiBpbXBvcnQgcnVsZTsgb3RoZXJ3aXNlIGZyb20gYSB1c2UgcnVsZS5cbiAgICogQHBhcmFtIGNoZWNrRGlyZWN0b3J5IElmIHRydWUsIHRyeSBjaGVja2luZyBmb3IgYSBkaXJlY3Rvcnkgd2l0aCB0aGUgYmFzZSBuYW1lIGNvbnRhaW5pbmcgYW4gaW5kZXggZmlsZS5cbiAgICogQHJldHVybnMgQSBmdWxsIHJlc29sdmVkIFVSTCBvZiB0aGUgc3R5bGVzaGVldCBmaWxlIG9yIGBudWxsYCBpZiBub3QgZm91bmQuXG4gICAqL1xuICBwcml2YXRlIHJlc29sdmVJbXBvcnQodXJsOiBzdHJpbmcsIGZyb21JbXBvcnQ6IGJvb2xlYW4sIGNoZWNrRGlyZWN0b3J5OiBib29sZWFuKTogVVJMIHwgbnVsbCB7XG4gICAgbGV0IHN0eWxlc2hlZXRQYXRoO1xuICAgIHRyeSB7XG4gICAgICBzdHlsZXNoZWV0UGF0aCA9IGZpbGVVUkxUb1BhdGgodXJsKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIE9ubHkgZmlsZSBwcm90b2NvbCBVUkxzIGFyZSBzdXBwb3J0ZWQgYnkgdGhpcyBpbXBvcnRlclxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZGlyZWN0b3J5ID0gZGlybmFtZShzdHlsZXNoZWV0UGF0aCk7XG4gICAgY29uc3QgZXh0ZW5zaW9uID0gZXh0bmFtZShzdHlsZXNoZWV0UGF0aCk7XG4gICAgY29uc3QgaGFzU3R5bGVFeHRlbnNpb24gPVxuICAgICAgZXh0ZW5zaW9uID09PSAnLnNjc3MnIHx8IGV4dGVuc2lvbiA9PT0gJy5zYXNzJyB8fCBleHRlbnNpb24gPT09ICcuY3NzJztcbiAgICAvLyBSZW1vdmUgdGhlIHN0eWxlIGV4dGVuc2lvbiBpZiBwcmVzZW50IHRvIGFsbG93IGFkZGluZyB0aGUgYC5pbXBvcnRgIHN1ZmZpeFxuICAgIGNvbnN0IGZpbGVuYW1lID0gYmFzZW5hbWUoc3R5bGVzaGVldFBhdGgsIGhhc1N0eWxlRXh0ZW5zaW9uID8gZXh0ZW5zaW9uIDogdW5kZWZpbmVkKTtcblxuICAgIGNvbnN0IGltcG9ydFBvdGVudGlhbHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBkZWZhdWx0UG90ZW50aWFscyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgaWYgKGhhc1N0eWxlRXh0ZW5zaW9uKSB7XG4gICAgICBpZiAoZnJvbUltcG9ydCkge1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuaW1wb3J0JyArIGV4dGVuc2lvbik7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5pbXBvcnQnICsgZXh0ZW5zaW9uKTtcbiAgICAgIH1cbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArIGV4dGVuc2lvbik7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyBleHRlbnNpb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZnJvbUltcG9ydCkge1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuaW1wb3J0LnNjc3MnKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLmltcG9ydC5zYXNzJyk7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5pbXBvcnQuY3NzJyk7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5pbXBvcnQuc2NzcycpO1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuaW1wb3J0LnNhc3MnKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLmltcG9ydC5jc3MnKTtcbiAgICAgIH1cbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuc2NzcycpO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5zYXNzJyk7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLmNzcycpO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5zY3NzJyk7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLnNhc3MnKTtcbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuY3NzJyk7XG4gICAgfVxuXG4gICAgbGV0IGZvdW5kRGVmYXVsdHM7XG4gICAgbGV0IGZvdW5kSW1wb3J0cztcbiAgICBsZXQgaGFzUG90ZW50aWFsSW5kZXggPSBmYWxzZTtcblxuICAgIGxldCBjYWNoZWRFbnRyaWVzID0gdGhpcy5kaXJlY3RvcnlDYWNoZS5nZXQoZGlyZWN0b3J5KTtcbiAgICBpZiAoY2FjaGVkRW50cmllcykge1xuICAgICAgLy8gSWYgdGhlcmUgaXMgYSBwcmVwcm9jZXNzZWQgY2FjaGUgb2YgdGhlIGRpcmVjdG9yeSwgcGVyZm9ybSBhbiBpbnRlcnNlY3Rpb24gb2YgdGhlIHBvdGVudGlhbHNcbiAgICAgIC8vIGFuZCB0aGUgZGlyZWN0b3J5IGZpbGVzLlxuICAgICAgY29uc3QgeyBmaWxlcywgZGlyZWN0b3JpZXMgfSA9IGNhY2hlZEVudHJpZXM7XG4gICAgICBmb3VuZERlZmF1bHRzID0gWy4uLmRlZmF1bHRQb3RlbnRpYWxzXS5maWx0ZXIoKHBvdGVudGlhbCkgPT4gZmlsZXMuaGFzKHBvdGVudGlhbCkpO1xuICAgICAgZm91bmRJbXBvcnRzID0gWy4uLmltcG9ydFBvdGVudGlhbHNdLmZpbHRlcigocG90ZW50aWFsKSA9PiBmaWxlcy5oYXMocG90ZW50aWFsKSk7XG4gICAgICBoYXNQb3RlbnRpYWxJbmRleCA9IGNoZWNrRGlyZWN0b3J5ICYmICFoYXNTdHlsZUV4dGVuc2lvbiAmJiBkaXJlY3Rvcmllcy5oYXMoZmlsZW5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJZiBubyBwcmVwcm9jZXNzZWQgY2FjaGUgZXhpc3RzLCBnZXQgdGhlIGVudHJpZXMgZnJvbSB0aGUgZmlsZSBzeXN0ZW0gYW5kLCB3aGlsZSBzZWFyY2hpbmcsXG4gICAgICAvLyBnZW5lcmF0ZSB0aGUgY2FjaGUgZm9yIGxhdGVyIHJlcXVlc3RzLlxuICAgICAgbGV0IGVudHJpZXM7XG4gICAgICB0cnkge1xuICAgICAgICBlbnRyaWVzID0gcmVhZGRpclN5bmMoZGlyZWN0b3J5LCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGZvdW5kRGVmYXVsdHMgPSBbXTtcbiAgICAgIGZvdW5kSW1wb3J0cyA9IFtdO1xuICAgICAgY2FjaGVkRW50cmllcyA9IHsgZmlsZXM6IG5ldyBTZXQ8c3RyaW5nPigpLCBkaXJlY3RvcmllczogbmV3IFNldDxzdHJpbmc+KCkgfTtcbiAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuICAgICAgICBjb25zdCBpc0RpcmVjdG9yeSA9IGVudHJ5LmlzRGlyZWN0b3J5KCk7XG4gICAgICAgIGlmIChpc0RpcmVjdG9yeSkge1xuICAgICAgICAgIGNhY2hlZEVudHJpZXMuZGlyZWN0b3JpZXMuYWRkKGVudHJ5Lm5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVjb3JkIGlmIHRoZSBuYW1lIHNob3VsZCBiZSBjaGVja2VkIGFzIGEgZGlyZWN0b3J5IHdpdGggYW4gaW5kZXggZmlsZVxuICAgICAgICBpZiAoY2hlY2tEaXJlY3RvcnkgJiYgIWhhc1N0eWxlRXh0ZW5zaW9uICYmIGVudHJ5Lm5hbWUgPT09IGZpbGVuYW1lICYmIGlzRGlyZWN0b3J5KSB7XG4gICAgICAgICAgaGFzUG90ZW50aWFsSW5kZXggPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFlbnRyeS5pc0ZpbGUoKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY2FjaGVkRW50cmllcy5maWxlcy5hZGQoZW50cnkubmFtZSk7XG5cbiAgICAgICAgaWYgKGltcG9ydFBvdGVudGlhbHMuaGFzKGVudHJ5Lm5hbWUpKSB7XG4gICAgICAgICAgZm91bmRJbXBvcnRzLnB1c2goZW50cnkubmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGVmYXVsdFBvdGVudGlhbHMuaGFzKGVudHJ5Lm5hbWUpKSB7XG4gICAgICAgICAgZm91bmREZWZhdWx0cy5wdXNoKGVudHJ5Lm5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZGlyZWN0b3J5Q2FjaGUuc2V0KGRpcmVjdG9yeSwgY2FjaGVkRW50cmllcyk7XG4gICAgfVxuXG4gICAgLy8gYGZvdW5kSW1wb3J0c2Agd2lsbCBvbmx5IGNvbnRhaW4gZWxlbWVudHMgaWYgYG9wdGlvbnMuZnJvbUltcG9ydGAgaXMgdHJ1ZVxuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuY2hlY2tGb3VuZChmb3VuZEltcG9ydHMpID8/IHRoaXMuY2hlY2tGb3VuZChmb3VuZERlZmF1bHRzKTtcbiAgICBpZiAocmVzdWx0ICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gcGF0aFRvRmlsZVVSTChqb2luKGRpcmVjdG9yeSwgcmVzdWx0KSk7XG4gICAgfVxuXG4gICAgaWYgKGhhc1BvdGVudGlhbEluZGV4KSB7XG4gICAgICAvLyBDaGVjayBmb3IgaW5kZXggZmlsZXMgdXNpbmcgZmlsZW5hbWUgYXMgYSBkaXJlY3RvcnlcbiAgICAgIHJldHVybiB0aGlzLnJlc29sdmVJbXBvcnQodXJsICsgJy9pbmRleCcsIGZyb21JbXBvcnQsIGZhbHNlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgYW4gYXJyYXkgb2YgcG90ZW50aWFsIHN0eWxlc2hlZXQgZmlsZXMgdG8gZGV0ZXJtaW5lIGlmIHRoZXJlIGlzIGEgdmFsaWRcbiAgICogc3R5bGVzaGVldCBmaWxlLiBNb3JlIHRoYW4gb25lIGRpc2NvdmVyZWQgZmlsZSBtYXkgaW5kaWNhdGUgYW4gZXJyb3IuXG4gICAqIEBwYXJhbSBmb3VuZCBBbiBhcnJheSBvZiBkaXNjb3ZlcmVkIHN0eWxlc2hlZXQgZmlsZXMuXG4gICAqIEByZXR1cm5zIEEgZnVsbHkgcmVzb2x2ZWQgcGF0aCBmb3IgYSBzdHlsZXNoZWV0IGZpbGUgb3IgYG51bGxgIGlmIG5vdCBmb3VuZC5cbiAgICogQHRocm93cyBJZiB0aGVyZSBhcmUgYW1iaWd1b3VzIGZpbGVzIGRpc2NvdmVyZWQuXG4gICAqL1xuICBwcml2YXRlIGNoZWNrRm91bmQoZm91bmQ6IHN0cmluZ1tdKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgaWYgKGZvdW5kLmxlbmd0aCA9PT0gMCkge1xuICAgICAgLy8gTm90IGZvdW5kXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBNb3JlIHRoYW4gb25lIGZvdW5kIGZpbGUgbWF5IGJlIGFuIGVycm9yXG4gICAgaWYgKGZvdW5kLmxlbmd0aCA+IDEpIHtcbiAgICAgIC8vIFByZXNlbmNlIG9mIENTUyBmaWxlcyBhbG9uZ3NpZGUgYSBTYXNzIGZpbGUgZG9lcyBub3QgY2F1c2UgYW4gZXJyb3JcbiAgICAgIGNvbnN0IGZvdW5kV2l0aG91dENzcyA9IGZvdW5kLmZpbHRlcigoZWxlbWVudCkgPT4gZXh0bmFtZShlbGVtZW50KSAhPT0gJy5jc3MnKTtcbiAgICAgIC8vIElmIHRoZSBsZW5ndGggaXMgemVybyB0aGVuIHRoZXJlIGFyZSB0d28gb3IgbW9yZSBjc3MgZmlsZXNcbiAgICAgIC8vIElmIHRoZSBsZW5ndGggaXMgbW9yZSB0aGFuIG9uZSB0aGFuIHRoZXJlIGFyZSB0d28gb3IgbW9yZSBzYXNzL3Njc3MgZmlsZXNcbiAgICAgIGlmIChmb3VuZFdpdGhvdXRDc3MubGVuZ3RoICE9PSAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQW1iaWd1b3VzIGltcG9ydCBkZXRlY3RlZC4nKTtcbiAgICAgIH1cblxuICAgICAgLy8gUmV0dXJuIHRoZSBub24tQ1NTIGZpbGUgKHNhc3Mvc2NzcyBmaWxlcyBoYXZlIHByaW9yaXR5KVxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3Nhc3MvZGFydC1zYXNzL2Jsb2IvNDRkNmJiNmFjNzJmZTZiOTNmNWJmZWMzNzFhMWZmZmIxOGU2Yjc2ZC9saWIvc3JjL2ltcG9ydGVyL3V0aWxzLmRhcnQjTDQ0LUw0N1xuICAgICAgcmV0dXJuIGZvdW5kV2l0aG91dENzc1swXTtcbiAgICB9XG5cbiAgICByZXR1cm4gZm91bmRbMF07XG4gIH1cbn1cblxuLyoqXG4gKiBQcm92aWRlcyB0aGUgU2FzcyBpbXBvcnRlciBsb2dpYyB0byByZXNvbHZlIG1vZHVsZSAobnBtIHBhY2thZ2UpIHN0eWxlc2hlZXQgaW1wb3J0cyB2aWEgYm90aCBpbXBvcnQgYW5kXG4gKiB1c2UgcnVsZXMgYW5kIGFsc28gcmViYXNlIGFueSBgdXJsKClgIGZ1bmN0aW9uIHVzYWdlIHdpdGhpbiB0aG9zZSBzdHlsZXNoZWV0cy4gVGhlIHJlYmFzaW5nIHdpbGwgZW5zdXJlIHRoYXRcbiAqIHRoZSBVUkxzIGluIHRoZSBvdXRwdXQgb2YgdGhlIFNhc3MgY29tcGlsZXIgcmVmbGVjdCB0aGUgZmluYWwgZmlsZXN5c3RlbSBsb2NhdGlvbiBvZiB0aGUgb3V0cHV0IENTUyBmaWxlLlxuICovXG5leHBvcnQgY2xhc3MgTW9kdWxlVXJsUmViYXNpbmdJbXBvcnRlciBleHRlbmRzIFJlbGF0aXZlVXJsUmViYXNpbmdJbXBvcnRlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGVudHJ5RGlyZWN0b3J5OiBzdHJpbmcsXG4gICAgZGlyZWN0b3J5Q2FjaGU6IE1hcDxzdHJpbmcsIERpcmVjdG9yeUVudHJ5PixcbiAgICByZWJhc2VTb3VyY2VNYXBzOiBNYXA8c3RyaW5nLCBSYXdTb3VyY2VNYXA+IHwgdW5kZWZpbmVkLFxuICAgIHByaXZhdGUgZmluZGVyOiAoc3BlY2lmaWVyOiBzdHJpbmcsIG9wdGlvbnM6IENhbm9uaWNhbGl6ZUNvbnRleHQpID0+IFVSTCB8IG51bGwsXG4gICkge1xuICAgIHN1cGVyKGVudHJ5RGlyZWN0b3J5LCBkaXJlY3RvcnlDYWNoZSwgcmViYXNlU291cmNlTWFwcyk7XG4gIH1cblxuICBvdmVycmlkZSBjYW5vbmljYWxpemUodXJsOiBzdHJpbmcsIG9wdGlvbnM6IENhbm9uaWNhbGl6ZUNvbnRleHQpOiBVUkwgfCBudWxsIHtcbiAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJ2ZpbGU6Ly8nKSkge1xuICAgICAgcmV0dXJuIHN1cGVyLmNhbm9uaWNhbGl6ZSh1cmwsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIGxldCByZXN1bHQgPSB0aGlzLmZpbmRlcih1cmwsIG9wdGlvbnMpO1xuICAgIHJlc3VsdCAmJj0gc3VwZXIuY2Fub25pY2FsaXplKHJlc3VsdC5ocmVmLCBvcHRpb25zKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuLyoqXG4gKiBQcm92aWRlcyB0aGUgU2FzcyBpbXBvcnRlciBsb2dpYyB0byByZXNvbHZlIGxvYWQgcGF0aHMgbG9jYXRlZCBzdHlsZXNoZWV0IGltcG9ydHMgdmlhIGJvdGggaW1wb3J0IGFuZFxuICogdXNlIHJ1bGVzIGFuZCBhbHNvIHJlYmFzZSBhbnkgYHVybCgpYCBmdW5jdGlvbiB1c2FnZSB3aXRoaW4gdGhvc2Ugc3R5bGVzaGVldHMuIFRoZSByZWJhc2luZyB3aWxsIGVuc3VyZSB0aGF0XG4gKiB0aGUgVVJMcyBpbiB0aGUgb3V0cHV0IG9mIHRoZSBTYXNzIGNvbXBpbGVyIHJlZmxlY3QgdGhlIGZpbmFsIGZpbGVzeXN0ZW0gbG9jYXRpb24gb2YgdGhlIG91dHB1dCBDU1MgZmlsZS5cbiAqL1xuZXhwb3J0IGNsYXNzIExvYWRQYXRoc1VybFJlYmFzaW5nSW1wb3J0ZXIgZXh0ZW5kcyBSZWxhdGl2ZVVybFJlYmFzaW5nSW1wb3J0ZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICBlbnRyeURpcmVjdG9yeTogc3RyaW5nLFxuICAgIGRpcmVjdG9yeUNhY2hlOiBNYXA8c3RyaW5nLCBEaXJlY3RvcnlFbnRyeT4sXG4gICAgcmViYXNlU291cmNlTWFwczogTWFwPHN0cmluZywgUmF3U291cmNlTWFwPiB8IHVuZGVmaW5lZCxcbiAgICBwcml2YXRlIGxvYWRQYXRoczogSXRlcmFibGU8c3RyaW5nPixcbiAgKSB7XG4gICAgc3VwZXIoZW50cnlEaXJlY3RvcnksIGRpcmVjdG9yeUNhY2hlLCByZWJhc2VTb3VyY2VNYXBzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNhbm9uaWNhbGl6ZSh1cmw6IHN0cmluZywgb3B0aW9uczogeyBmcm9tSW1wb3J0OiBib29sZWFuIH0pOiBVUkwgfCBudWxsIHtcbiAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJ2ZpbGU6Ly8nKSkge1xuICAgICAgcmV0dXJuIHN1cGVyLmNhbm9uaWNhbGl6ZSh1cmwsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIGxldCByZXN1bHQgPSBudWxsO1xuICAgIGZvciAoY29uc3QgbG9hZFBhdGggb2YgdGhpcy5sb2FkUGF0aHMpIHtcbiAgICAgIHJlc3VsdCA9IHN1cGVyLmNhbm9uaWNhbGl6ZShwYXRoVG9GaWxlVVJMKGpvaW4obG9hZFBhdGgsIHVybCkpLmhyZWYsIG9wdGlvbnMpO1xuICAgICAgaWYgKHJlc3VsdCAhPT0gbnVsbCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cbi8qKlxuICogV29ya2Fyb3VuZCBmb3IgU2FzcyBub3QgY2FsbGluZyBpbnN0YW5jZSBtZXRob2RzIHdpdGggYHRoaXNgLlxuICogVGhlIGBjYW5vbmljYWxpemVgIGFuZCBgbG9hZGAgbWV0aG9kcyB3aWxsIGJlIGJvdW5kIHRvIHRoZSBjbGFzcyBpbnN0YW5jZS5cbiAqIEBwYXJhbSBpbXBvcnRlciBBIFNhc3MgaW1wb3J0ZXIgdG8gYmluZC5cbiAqIEByZXR1cm5zIFRoZSBib3VuZCBTYXNzIGltcG9ydGVyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2Fzc0JpbmRXb3JrYXJvdW5kPFQgZXh0ZW5kcyBJbXBvcnRlcj4oaW1wb3J0ZXI6IFQpOiBUIHtcbiAgaW1wb3J0ZXIuY2Fub25pY2FsaXplID0gaW1wb3J0ZXIuY2Fub25pY2FsaXplLmJpbmQoaW1wb3J0ZXIpO1xuICBpbXBvcnRlci5sb2FkID0gaW1wb3J0ZXIubG9hZC5iaW5kKGltcG9ydGVyKTtcblxuICByZXR1cm4gaW1wb3J0ZXI7XG59XG4iXX0=