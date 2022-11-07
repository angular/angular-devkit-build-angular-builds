"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sassBindWorkaround = exports.LoadPathsUrlRebasingImporter = exports.ModuleUrlRebasingImporter = exports.RelativeUrlRebasingImporter = void 0;
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
     */
    constructor(entryDirectory) {
        this.entryDirectory = entryDirectory;
    }
    load(canonicalUrl) {
        const stylesheetPath = (0, node_url_1.fileURLToPath)(canonicalUrl);
        let contents = (0, node_fs_1.readFileSync)(stylesheetPath, 'utf-8');
        // Rebase any URLs that are found
        if (contents.includes('url(')) {
            const stylesheetDirectory = (0, node_path_1.dirname)(stylesheetPath);
            let match;
            URL_REGEXP.lastIndex = 0;
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
                contents =
                    contents.slice(0, match.index) +
                        `url(${rebasedUrl})` +
                        contents.slice(match.index + match[0].length);
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
    constructor(entryDirectory, directoryCache = new Map()) {
        super(entryDirectory);
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
    constructor(entryDirectory, directoryCache, finder) {
        super(entryDirectory, directoryCache);
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
    constructor(entryDirectory, directoryCache, loadPaths) {
        super(entryDirectory, directoryCache);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmViYXNpbmctaW1wb3J0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9zYXNzL3JlYmFzaW5nLWltcG9ydGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILHFDQUE0RDtBQUM1RCx5Q0FBdUU7QUFDdkUsdUNBQXdEO0FBR3hEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxHQUFHLHNDQUFzQyxDQUFDO0FBRTFEOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFlLG1CQUFtQjtJQUNoQzs7T0FFRztJQUNILFlBQW9CLGNBQXNCO1FBQXRCLG1CQUFjLEdBQWQsY0FBYyxDQUFRO0lBQUcsQ0FBQztJQUk5QyxJQUFJLENBQUMsWUFBaUI7UUFDcEIsTUFBTSxjQUFjLEdBQUcsSUFBQSx3QkFBYSxFQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ25ELElBQUksUUFBUSxHQUFHLElBQUEsc0JBQVksRUFBQyxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFckQsaUNBQWlDO1FBQ2pDLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUM3QixNQUFNLG1CQUFtQixHQUFHLElBQUEsbUJBQU8sRUFBQyxjQUFjLENBQUMsQ0FBQztZQUVwRCxJQUFJLEtBQUssQ0FBQztZQUNWLFVBQVUsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO1lBQ3pCLE9BQU8sQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFO2dCQUMxQyxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRTdCLG1FQUFtRTtnQkFDbkUsSUFBSSxxQ0FBcUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUU7b0JBQzNELFNBQVM7aUJBQ1Y7Z0JBRUQsTUFB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QUUsT0FBTyxDQUFDLENBQUM7WUFDOUUsSUFBSSxNQUFNLEtBQUssSUFBSSxFQUFFO2dCQUNuQixNQUFNO2FBQ1A7U0FDRjtRQUVELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7Q0FDRjtBQXhCRCxvRUF3QkM7QUFFRDs7Ozs7R0FLRztBQUNILFNBQWdCLGtCQUFrQixDQUFxQixRQUFXO0lBQ2hFLFFBQVEsQ0FBQyxZQUFZLEdBQUcsUUFBUSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDN0QsUUFBUSxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUU3QyxPQUFPLFFBQVEsQ0FBQztBQUNsQixDQUFDO0FBTEQsZ0RBS0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgRGlyZW50LCByZWFkRmlsZVN5bmMsIHJlYWRkaXJTeW5jIH0gZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSwgZXh0bmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0eXBlIHsgRmlsZUltcG9ydGVyLCBJbXBvcnRlciwgSW1wb3J0ZXJSZXN1bHQsIFN5bnRheCB9IGZyb20gJ3Nhc3MnO1xuXG4vKipcbiAqIEEgUmVndWxhciBleHByZXNzaW9uIHVzZWQgdG8gZmluZCBhbGwgYHVybCgpYCBmdW5jdGlvbnMgd2l0aGluIGEgc3R5bGVzaGVldC5cbiAqIEZyb20gcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9wbHVnaW5zL3Bvc3Rjc3MtY2xpLXJlc291cmNlcy50c1xuICovXG5jb25zdCBVUkxfUkVHRVhQID0gL3VybCg/OlxcKFxccyooWydcIl0/KSkoLio/KSg/OlxcMVxccypcXCkpL2c7XG5cbi8qKlxuICogQSBTYXNzIEltcG9ydGVyIGJhc2UgY2xhc3MgdGhhdCBwcm92aWRlcyB0aGUgbG9hZCBsb2dpYyB0byByZWJhc2UgYWxsIGB1cmwoKWAgZnVuY3Rpb25zXG4gKiB3aXRoaW4gYSBzdHlsZXNoZWV0LiBUaGUgcmViYXNpbmcgd2lsbCBlbnN1cmUgdGhhdCB0aGUgVVJMcyBpbiB0aGUgb3V0cHV0IG9mIHRoZSBTYXNzIGNvbXBpbGVyXG4gKiByZWZsZWN0IHRoZSBmaW5hbCBmaWxlc3lzdGVtIGxvY2F0aW9uIG9mIHRoZSBvdXRwdXQgQ1NTIGZpbGUuXG4gKlxuICogVGhpcyBjbGFzcyBwcm92aWRlcyB0aGUgY29yZSBvZiB0aGUgcmViYXNpbmcgZnVuY3Rpb25hbGl0eS4gVG8gZW5zdXJlIHRoYXQgZWFjaCBmaWxlIGlzIHByb2Nlc3NlZFxuICogYnkgdGhpcyBpbXBvcnRlcidzIGxvYWQgaW1wbGVtZW50YXRpb24sIHRoZSBTYXNzIGNvbXBpbGVyIHJlcXVpcmVzIHRoZSBpbXBvcnRlcidzIGNhbm9uaWNhbGl6ZVxuICogZnVuY3Rpb24gdG8gcmV0dXJuIGEgbm9uLW51bGwgdmFsdWUgd2l0aCB0aGUgcmVzb2x2ZWQgbG9jYXRpb24gb2YgdGhlIHJlcXVlc3RlZCBzdHlsZXNoZWV0LlxuICogQ29uY3JldGUgaW1wbGVtZW50YXRpb25zIG9mIHRoaXMgY2xhc3MgbXVzdCBwcm92aWRlIHRoaXMgY2Fub25pY2FsaXplIGZ1bmN0aW9uYWxpdHkgZm9yIHJlYmFzaW5nXG4gKiB0byBiZSBlZmZlY3RpdmUuXG4gKi9cbmFic3RyYWN0IGNsYXNzIFVybFJlYmFzaW5nSW1wb3J0ZXIgaW1wbGVtZW50cyBJbXBvcnRlcjwnc3luYyc+IHtcbiAgLyoqXG4gICAqIEBwYXJhbSBlbnRyeURpcmVjdG9yeSBUaGUgZGlyZWN0b3J5IG9mIHRoZSBlbnRyeSBzdHlsZXNoZWV0IHRoYXQgd2FzIHBhc3NlZCB0byB0aGUgU2FzcyBjb21waWxlci5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgZW50cnlEaXJlY3Rvcnk6IHN0cmluZykge31cblxuICBhYnN0cmFjdCBjYW5vbmljYWxpemUodXJsOiBzdHJpbmcsIG9wdGlvbnM6IHsgZnJvbUltcG9ydDogYm9vbGVhbiB9KTogVVJMIHwgbnVsbDtcblxuICBsb2FkKGNhbm9uaWNhbFVybDogVVJMKTogSW1wb3J0ZXJSZXN1bHQgfCBudWxsIHtcbiAgICBjb25zdCBzdHlsZXNoZWV0UGF0aCA9IGZpbGVVUkxUb1BhdGgoY2Fub25pY2FsVXJsKTtcbiAgICBsZXQgY29udGVudHMgPSByZWFkRmlsZVN5bmMoc3R5bGVzaGVldFBhdGgsICd1dGYtOCcpO1xuXG4gICAgLy8gUmViYXNlIGFueSBVUkxzIHRoYXQgYXJlIGZvdW5kXG4gICAgaWYgKGNvbnRlbnRzLmluY2x1ZGVzKCd1cmwoJykpIHtcbiAgICAgIGNvbnN0IHN0eWxlc2hlZXREaXJlY3RvcnkgPSBkaXJuYW1lKHN0eWxlc2hlZXRQYXRoKTtcblxuICAgICAgbGV0IG1hdGNoO1xuICAgICAgVVJMX1JFR0VYUC5sYXN0SW5kZXggPSAwO1xuICAgICAgd2hpbGUgKChtYXRjaCA9IFVSTF9SRUdFWFAuZXhlYyhjb250ZW50cykpKSB7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsVXJsID0gbWF0Y2hbMl07XG5cbiAgICAgICAgLy8gSWYgcm9vdC1yZWxhdGl2ZSwgYWJzb2x1dGUgb3IgcHJvdG9jb2wgcmVsYXRpdmUgdXJsLCBsZWF2ZSBhcy1pc1xuICAgICAgICBpZiAoL14oKD86XFx3KzopP1xcL1xcL3xkYXRhOnxjaHJvbWU6fCN8XFwvKS8udGVzdChvcmlnaW5hbFVybCkpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlYmFzZWRQYXRoID0gcmVsYXRpdmUodGhpcy5lbnRyeURpcmVjdG9yeSwgam9pbihzdHlsZXNoZWV0RGlyZWN0b3J5LCBvcmlnaW5hbFVybCkpO1xuXG4gICAgICAgIC8vIE5vcm1hbGl6ZSBwYXRoIHNlcGFyYXRvcnMgYW5kIGVzY2FwZSBjaGFyYWN0ZXJzXG4gICAgICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0NTUy91cmwjc3ludGF4XG4gICAgICAgIGNvbnN0IHJlYmFzZWRVcmwgPSAnLi8nICsgcmViYXNlZFBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpLnJlcGxhY2UoL1soKVxccydcIl0vZywgJ1xcXFwkJicpO1xuXG4gICAgICAgIGNvbnRlbnRzID1cbiAgICAgICAgICBjb250ZW50cy5zbGljZSgwLCBtYXRjaC5pbmRleCkgK1xuICAgICAgICAgIGB1cmwoJHtyZWJhc2VkVXJsfSlgICtcbiAgICAgICAgICBjb250ZW50cy5zbGljZShtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGV0IHN5bnRheDogU3ludGF4IHwgdW5kZWZpbmVkO1xuICAgIHN3aXRjaCAoZXh0bmFtZShzdHlsZXNoZWV0UGF0aCkudG9Mb3dlckNhc2UoKSkge1xuICAgICAgY2FzZSAnY3NzJzpcbiAgICAgICAgc3ludGF4ID0gJ2Nzcyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc2Fzcyc6XG4gICAgICAgIHN5bnRheCA9ICdpbmRlbnRlZCc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgc3ludGF4ID0gJ3Njc3MnO1xuICAgICAgICBicmVhaztcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29udGVudHMsXG4gICAgICBzeW50YXgsXG4gICAgICBzb3VyY2VNYXBVcmw6IGNhbm9uaWNhbFVybCxcbiAgICB9O1xuICB9XG59XG5cbi8qKlxuICogUHJvdmlkZXMgdGhlIFNhc3MgaW1wb3J0ZXIgbG9naWMgdG8gcmVzb2x2ZSByZWxhdGl2ZSBzdHlsZXNoZWV0IGltcG9ydHMgdmlhIGJvdGggaW1wb3J0IGFuZCB1c2UgcnVsZXNcbiAqIGFuZCBhbHNvIHJlYmFzZSBhbnkgYHVybCgpYCBmdW5jdGlvbiB1c2FnZSB3aXRoaW4gdGhvc2Ugc3R5bGVzaGVldHMuIFRoZSByZWJhc2luZyB3aWxsIGVuc3VyZSB0aGF0XG4gKiB0aGUgVVJMcyBpbiB0aGUgb3V0cHV0IG9mIHRoZSBTYXNzIGNvbXBpbGVyIHJlZmxlY3QgdGhlIGZpbmFsIGZpbGVzeXN0ZW0gbG9jYXRpb24gb2YgdGhlIG91dHB1dCBDU1MgZmlsZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFJlbGF0aXZlVXJsUmViYXNpbmdJbXBvcnRlciBleHRlbmRzIFVybFJlYmFzaW5nSW1wb3J0ZXIge1xuICBjb25zdHJ1Y3RvcihlbnRyeURpcmVjdG9yeTogc3RyaW5nLCBwcml2YXRlIGRpcmVjdG9yeUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIERpcmVudFtdPigpKSB7XG4gICAgc3VwZXIoZW50cnlEaXJlY3RvcnkpO1xuICB9XG5cbiAgY2Fub25pY2FsaXplKHVybDogc3RyaW5nLCBvcHRpb25zOiB7IGZyb21JbXBvcnQ6IGJvb2xlYW4gfSk6IFVSTCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLnJlc29sdmVJbXBvcnQodXJsLCBvcHRpb25zLmZyb21JbXBvcnQsIHRydWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEF0dGVtcHRzIHRvIHJlc29sdmUgYSBwcm92aWRlZCBVUkwgdG8gYSBzdHlsZXNoZWV0IGZpbGUgdXNpbmcgdGhlIFNhc3MgY29tcGlsZXIncyByZXNvbHV0aW9uIGFsZ29yaXRobS5cbiAgICogQmFzZWQgb24gaHR0cHM6Ly9naXRodWIuY29tL3Nhc3MvZGFydC1zYXNzL2Jsb2IvNDRkNmJiNmFjNzJmZTZiOTNmNWJmZWMzNzFhMWZmZmIxOGU2Yjc2ZC9saWIvc3JjL2ltcG9ydGVyL3V0aWxzLmRhcnRcbiAgICogQHBhcmFtIHVybCBUaGUgZmlsZSBwcm90b2NvbCBVUkwgdG8gcmVzb2x2ZS5cbiAgICogQHBhcmFtIGZyb21JbXBvcnQgSWYgdHJ1ZSwgVVJMIHdhcyBmcm9tIGFuIGltcG9ydCBydWxlOyBvdGhlcndpc2UgZnJvbSBhIHVzZSBydWxlLlxuICAgKiBAcGFyYW0gY2hlY2tEaXJlY3RvcnkgSWYgdHJ1ZSwgdHJ5IGNoZWNraW5nIGZvciBhIGRpcmVjdG9yeSB3aXRoIHRoZSBiYXNlIG5hbWUgY29udGFpbmluZyBhbiBpbmRleCBmaWxlLlxuICAgKiBAcmV0dXJucyBBIGZ1bGwgcmVzb2x2ZWQgVVJMIG9mIHRoZSBzdHlsZXNoZWV0IGZpbGUgb3IgYG51bGxgIGlmIG5vdCBmb3VuZC5cbiAgICovXG4gIHByaXZhdGUgcmVzb2x2ZUltcG9ydCh1cmw6IHN0cmluZywgZnJvbUltcG9ydDogYm9vbGVhbiwgY2hlY2tEaXJlY3Rvcnk6IGJvb2xlYW4pOiBVUkwgfCBudWxsIHtcbiAgICBsZXQgc3R5bGVzaGVldFBhdGg7XG4gICAgdHJ5IHtcbiAgICAgIHN0eWxlc2hlZXRQYXRoID0gZmlsZVVSTFRvUGF0aCh1cmwpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gT25seSBmaWxlIHByb3RvY29sIFVSTHMgYXJlIHN1cHBvcnRlZCBieSB0aGlzIGltcG9ydGVyXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBkaXJlY3RvcnkgPSBkaXJuYW1lKHN0eWxlc2hlZXRQYXRoKTtcbiAgICBjb25zdCBleHRlbnNpb24gPSBleHRuYW1lKHN0eWxlc2hlZXRQYXRoKTtcbiAgICBjb25zdCBoYXNTdHlsZUV4dGVuc2lvbiA9XG4gICAgICBleHRlbnNpb24gPT09ICcuc2NzcycgfHwgZXh0ZW5zaW9uID09PSAnLnNhc3MnIHx8IGV4dGVuc2lvbiA9PT0gJy5jc3MnO1xuICAgIC8vIFJlbW92ZSB0aGUgc3R5bGUgZXh0ZW5zaW9uIGlmIHByZXNlbnQgdG8gYWxsb3cgYWRkaW5nIHRoZSBgLmltcG9ydGAgc3VmZml4XG4gICAgY29uc3QgZmlsZW5hbWUgPSBiYXNlbmFtZShzdHlsZXNoZWV0UGF0aCwgaGFzU3R5bGVFeHRlbnNpb24gPyBleHRlbnNpb24gOiB1bmRlZmluZWQpO1xuXG4gICAgbGV0IGVudHJpZXM7XG4gICAgdHJ5IHtcbiAgICAgIGVudHJpZXMgPSB0aGlzLmRpcmVjdG9yeUNhY2hlLmdldChkaXJlY3RvcnkpO1xuICAgICAgaWYgKCFlbnRyaWVzKSB7XG4gICAgICAgIGVudHJpZXMgPSByZWFkZGlyU3luYyhkaXJlY3RvcnksIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcbiAgICAgICAgdGhpcy5kaXJlY3RvcnlDYWNoZS5zZXQoZGlyZWN0b3J5LCBlbnRyaWVzKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGltcG9ydFBvdGVudGlhbHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBkZWZhdWx0UG90ZW50aWFscyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgaWYgKGhhc1N0eWxlRXh0ZW5zaW9uKSB7XG4gICAgICBpZiAoZnJvbUltcG9ydCkge1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuaW1wb3J0JyArIGV4dGVuc2lvbik7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5pbXBvcnQnICsgZXh0ZW5zaW9uKTtcbiAgICAgIH1cbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArIGV4dGVuc2lvbik7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyBleHRlbnNpb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZnJvbUltcG9ydCkge1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuaW1wb3J0LnNjc3MnKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLmltcG9ydC5zYXNzJyk7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5pbXBvcnQuY3NzJyk7XG4gICAgICAgIGltcG9ydFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5pbXBvcnQuc2NzcycpO1xuICAgICAgICBpbXBvcnRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuaW1wb3J0LnNhc3MnKTtcbiAgICAgICAgaW1wb3J0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLmltcG9ydC5jc3MnKTtcbiAgICAgIH1cbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZChmaWxlbmFtZSArICcuc2NzcycpO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKGZpbGVuYW1lICsgJy5zYXNzJyk7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoZmlsZW5hbWUgKyAnLmNzcycpO1xuICAgICAgZGVmYXVsdFBvdGVudGlhbHMuYWRkKCdfJyArIGZpbGVuYW1lICsgJy5zY3NzJyk7XG4gICAgICBkZWZhdWx0UG90ZW50aWFscy5hZGQoJ18nICsgZmlsZW5hbWUgKyAnLnNhc3MnKTtcbiAgICAgIGRlZmF1bHRQb3RlbnRpYWxzLmFkZCgnXycgKyBmaWxlbmFtZSArICcuY3NzJyk7XG4gICAgfVxuXG4gICAgY29uc3QgZm91bmREZWZhdWx0czogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBmb3VuZEltcG9ydHM6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IGhhc1BvdGVudGlhbEluZGV4ID0gZmFsc2U7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgICAvLyBSZWNvcmQgaWYgdGhlIG5hbWUgc2hvdWxkIGJlIGNoZWNrZWQgYXMgYSBkaXJlY3Rvcnkgd2l0aCBhbiBpbmRleCBmaWxlXG4gICAgICBpZiAoY2hlY2tEaXJlY3RvcnkgJiYgIWhhc1N0eWxlRXh0ZW5zaW9uICYmIGVudHJ5Lm5hbWUgPT09IGZpbGVuYW1lICYmIGVudHJ5LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgaGFzUG90ZW50aWFsSW5kZXggPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWVudHJ5LmlzRmlsZSgpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoaW1wb3J0UG90ZW50aWFscy5oYXMoZW50cnkubmFtZSkpIHtcbiAgICAgICAgZm91bmRJbXBvcnRzLnB1c2goam9pbihkaXJlY3RvcnksIGVudHJ5Lm5hbWUpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGRlZmF1bHRQb3RlbnRpYWxzLmhhcyhlbnRyeS5uYW1lKSkge1xuICAgICAgICBmb3VuZERlZmF1bHRzLnB1c2goam9pbihkaXJlY3RvcnksIGVudHJ5Lm5hbWUpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBgZm91bmRJbXBvcnRzYCB3aWxsIG9ubHkgY29udGFpbiBlbGVtZW50cyBpZiBgb3B0aW9ucy5mcm9tSW1wb3J0YCBpcyB0cnVlXG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5jaGVja0ZvdW5kKGZvdW5kSW1wb3J0cykgPz8gdGhpcy5jaGVja0ZvdW5kKGZvdW5kRGVmYXVsdHMpO1xuXG4gICAgaWYgKHJlc3VsdCA9PT0gbnVsbCAmJiBoYXNQb3RlbnRpYWxJbmRleCkge1xuICAgICAgLy8gQ2hlY2sgZm9yIGluZGV4IGZpbGVzIHVzaW5nIGZpbGVuYW1lIGFzIGEgZGlyZWN0b3J5XG4gICAgICByZXR1cm4gdGhpcy5yZXNvbHZlSW1wb3J0KHVybCArICcvaW5kZXgnLCBmcm9tSW1wb3J0LCBmYWxzZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgYW4gYXJyYXkgb2YgcG90ZW50aWFsIHN0eWxlc2hlZXQgZmlsZXMgdG8gZGV0ZXJtaW5lIGlmIHRoZXJlIGlzIGEgdmFsaWRcbiAgICogc3R5bGVzaGVldCBmaWxlLiBNb3JlIHRoYW4gb25lIGRpc2NvdmVyZWQgZmlsZSBtYXkgaW5kaWNhdGUgYW4gZXJyb3IuXG4gICAqIEBwYXJhbSBmb3VuZCBBbiBhcnJheSBvZiBkaXNjb3ZlcmVkIHN0eWxlc2hlZXQgZmlsZXMuXG4gICAqIEByZXR1cm5zIEEgZnVsbHkgcmVzb2x2ZWQgVVJMIGZvciBhIHN0eWxlc2hlZXQgZmlsZSBvciBgbnVsbGAgaWYgbm90IGZvdW5kLlxuICAgKiBAdGhyb3dzIElmIHRoZXJlIGFyZSBhbWJpZ3VvdXMgZmlsZXMgZGlzY292ZXJlZC5cbiAgICovXG4gIHByaXZhdGUgY2hlY2tGb3VuZChmb3VuZDogc3RyaW5nW10pOiBVUkwgfCBudWxsIHtcbiAgICBpZiAoZm91bmQubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBOb3QgZm91bmRcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIE1vcmUgdGhhbiBvbmUgZm91bmQgZmlsZSBtYXkgYmUgYW4gZXJyb3JcbiAgICBpZiAoZm91bmQubGVuZ3RoID4gMSkge1xuICAgICAgLy8gUHJlc2VuY2Ugb2YgQ1NTIGZpbGVzIGFsb25nc2lkZSBhIFNhc3MgZmlsZSBkb2VzIG5vdCBjYXVzZSBhbiBlcnJvclxuICAgICAgY29uc3QgZm91bmRXaXRob3V0Q3NzID0gZm91bmQuZmlsdGVyKChlbGVtZW50KSA9PiBleHRuYW1lKGVsZW1lbnQpICE9PSAnLmNzcycpO1xuICAgICAgLy8gSWYgdGhlIGxlbmd0aCBpcyB6ZXJvIHRoZW4gdGhlcmUgYXJlIHR3byBvciBtb3JlIGNzcyBmaWxlc1xuICAgICAgLy8gSWYgdGhlIGxlbmd0aCBpcyBtb3JlIHRoYW4gb25lIHRoYW4gdGhlcmUgYXJlIHR3byBvciBtb3JlIHNhc3Mvc2NzcyBmaWxlc1xuICAgICAgaWYgKGZvdW5kV2l0aG91dENzcy5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbWJpZ3VvdXMgaW1wb3J0IGRldGVjdGVkLicpO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXR1cm4gdGhlIG5vbi1DU1MgZmlsZSAoc2Fzcy9zY3NzIGZpbGVzIGhhdmUgcHJpb3JpdHkpXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vc2Fzcy9kYXJ0LXNhc3MvYmxvYi80NGQ2YmI2YWM3MmZlNmI5M2Y1YmZlYzM3MWExZmZmYjE4ZTZiNzZkL2xpYi9zcmMvaW1wb3J0ZXIvdXRpbHMuZGFydCNMNDQtTDQ3XG4gICAgICByZXR1cm4gcGF0aFRvRmlsZVVSTChmb3VuZFdpdGhvdXRDc3NbMF0pO1xuICAgIH1cblxuICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKGZvdW5kWzBdKTtcbiAgfVxufVxuXG4vKipcbiAqIFByb3ZpZGVzIHRoZSBTYXNzIGltcG9ydGVyIGxvZ2ljIHRvIHJlc29sdmUgbW9kdWxlIChucG0gcGFja2FnZSkgc3R5bGVzaGVldCBpbXBvcnRzIHZpYSBib3RoIGltcG9ydCBhbmRcbiAqIHVzZSBydWxlcyBhbmQgYWxzbyByZWJhc2UgYW55IGB1cmwoKWAgZnVuY3Rpb24gdXNhZ2Ugd2l0aGluIHRob3NlIHN0eWxlc2hlZXRzLiBUaGUgcmViYXNpbmcgd2lsbCBlbnN1cmUgdGhhdFxuICogdGhlIFVSTHMgaW4gdGhlIG91dHB1dCBvZiB0aGUgU2FzcyBjb21waWxlciByZWZsZWN0IHRoZSBmaW5hbCBmaWxlc3lzdGVtIGxvY2F0aW9uIG9mIHRoZSBvdXRwdXQgQ1NTIGZpbGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBNb2R1bGVVcmxSZWJhc2luZ0ltcG9ydGVyIGV4dGVuZHMgUmVsYXRpdmVVcmxSZWJhc2luZ0ltcG9ydGVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgZW50cnlEaXJlY3Rvcnk6IHN0cmluZyxcbiAgICBkaXJlY3RvcnlDYWNoZTogTWFwPHN0cmluZywgRGlyZW50W10+LFxuICAgIHByaXZhdGUgZmluZGVyOiBGaWxlSW1wb3J0ZXI8J3N5bmMnPlsnZmluZEZpbGVVcmwnXSxcbiAgKSB7XG4gICAgc3VwZXIoZW50cnlEaXJlY3RvcnksIGRpcmVjdG9yeUNhY2hlKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGNhbm9uaWNhbGl6ZSh1cmw6IHN0cmluZywgb3B0aW9uczogeyBmcm9tSW1wb3J0OiBib29sZWFuIH0pOiBVUkwgfCBudWxsIHtcbiAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJ2ZpbGU6Ly8nKSkge1xuICAgICAgcmV0dXJuIHN1cGVyLmNhbm9uaWNhbGl6ZSh1cmwsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuZmluZGVyKHVybCwgb3B0aW9ucyk7XG5cbiAgICByZXR1cm4gcmVzdWx0ID8gc3VwZXIuY2Fub25pY2FsaXplKHJlc3VsdC5ocmVmLCBvcHRpb25zKSA6IG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBQcm92aWRlcyB0aGUgU2FzcyBpbXBvcnRlciBsb2dpYyB0byByZXNvbHZlIGxvYWQgcGF0aHMgbG9jYXRlZCBzdHlsZXNoZWV0IGltcG9ydHMgdmlhIGJvdGggaW1wb3J0IGFuZFxuICogdXNlIHJ1bGVzIGFuZCBhbHNvIHJlYmFzZSBhbnkgYHVybCgpYCBmdW5jdGlvbiB1c2FnZSB3aXRoaW4gdGhvc2Ugc3R5bGVzaGVldHMuIFRoZSByZWJhc2luZyB3aWxsIGVuc3VyZSB0aGF0XG4gKiB0aGUgVVJMcyBpbiB0aGUgb3V0cHV0IG9mIHRoZSBTYXNzIGNvbXBpbGVyIHJlZmxlY3QgdGhlIGZpbmFsIGZpbGVzeXN0ZW0gbG9jYXRpb24gb2YgdGhlIG91dHB1dCBDU1MgZmlsZS5cbiAqL1xuZXhwb3J0IGNsYXNzIExvYWRQYXRoc1VybFJlYmFzaW5nSW1wb3J0ZXIgZXh0ZW5kcyBSZWxhdGl2ZVVybFJlYmFzaW5nSW1wb3J0ZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICBlbnRyeURpcmVjdG9yeTogc3RyaW5nLFxuICAgIGRpcmVjdG9yeUNhY2hlOiBNYXA8c3RyaW5nLCBEaXJlbnRbXT4sXG4gICAgcHJpdmF0ZSBsb2FkUGF0aHM6IEl0ZXJhYmxlPHN0cmluZz4sXG4gICkge1xuICAgIHN1cGVyKGVudHJ5RGlyZWN0b3J5LCBkaXJlY3RvcnlDYWNoZSk7XG4gIH1cblxuICBvdmVycmlkZSBjYW5vbmljYWxpemUodXJsOiBzdHJpbmcsIG9wdGlvbnM6IHsgZnJvbUltcG9ydDogYm9vbGVhbiB9KTogVVJMIHwgbnVsbCB7XG4gICAgaWYgKHVybC5zdGFydHNXaXRoKCdmaWxlOi8vJykpIHtcbiAgICAgIHJldHVybiBzdXBlci5jYW5vbmljYWxpemUodXJsLCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICBsZXQgcmVzdWx0ID0gbnVsbDtcbiAgICBmb3IgKGNvbnN0IGxvYWRQYXRoIG9mIHRoaXMubG9hZFBhdGhzKSB7XG4gICAgICByZXN1bHQgPSBzdXBlci5jYW5vbmljYWxpemUocGF0aFRvRmlsZVVSTChqb2luKGxvYWRQYXRoLCB1cmwpKS5ocmVmLCBvcHRpb25zKTtcbiAgICAgIGlmIChyZXN1bHQgIT09IG51bGwpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuXG4vKipcbiAqIFdvcmthcm91bmQgZm9yIFNhc3Mgbm90IGNhbGxpbmcgaW5zdGFuY2UgbWV0aG9kcyB3aXRoIGB0aGlzYC5cbiAqIFRoZSBgY2Fub25pY2FsaXplYCBhbmQgYGxvYWRgIG1ldGhvZHMgd2lsbCBiZSBib3VuZCB0byB0aGUgY2xhc3MgaW5zdGFuY2UuXG4gKiBAcGFyYW0gaW1wb3J0ZXIgQSBTYXNzIGltcG9ydGVyIHRvIGJpbmQuXG4gKiBAcmV0dXJucyBUaGUgYm91bmQgU2FzcyBpbXBvcnRlci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNhc3NCaW5kV29ya2Fyb3VuZDxUIGV4dGVuZHMgSW1wb3J0ZXI+KGltcG9ydGVyOiBUKTogVCB7XG4gIGltcG9ydGVyLmNhbm9uaWNhbGl6ZSA9IGltcG9ydGVyLmNhbm9uaWNhbGl6ZS5iaW5kKGltcG9ydGVyKTtcbiAgaW1wb3J0ZXIubG9hZCA9IGltcG9ydGVyLmxvYWQuYmluZChpbXBvcnRlcik7XG5cbiAgcmV0dXJuIGltcG9ydGVyO1xufVxuIl19