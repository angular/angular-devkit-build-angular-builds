"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SassStylesheetLanguage = exports.shutdownSassWorkerPool = void 0;
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
let sassWorkerPool;
function isSassException(error) {
    return !!error && typeof error === 'object' && 'sassMessage' in error;
}
function shutdownSassWorkerPool() {
    sassWorkerPool?.close();
    sassWorkerPool = undefined;
}
exports.shutdownSassWorkerPool = shutdownSassWorkerPool;
exports.SassStylesheetLanguage = Object.freeze({
    name: 'sass',
    componentFilter: /^s[ac]ss;/,
    fileFilter: /\.s[ac]ss$/,
    process(data, file, format, options, build) {
        const syntax = format === 'sass' ? 'indented' : 'scss';
        const resolveUrl = async (url, options) => {
            let result = await build.resolve(url, {
                kind: 'import-rule',
                // Use the provided resolve directory from the custom Sass service if available
                resolveDir: options.resolveDir ?? build.initialOptions.absWorkingDir,
            });
            // If a resolve directory is provided, no additional speculative resolutions are required
            if (options.resolveDir) {
                return result;
            }
            // Workaround to support Yarn PnP and pnpm without access to the importer file from Sass
            if (!result.path && options.previousResolvedModules?.size) {
                for (const previous of options.previousResolvedModules) {
                    result = await build.resolve(url, {
                        kind: 'import-rule',
                        resolveDir: previous,
                    });
                    if (result.path) {
                        break;
                    }
                }
            }
            return result;
        };
        return compileString(data, file, syntax, options, resolveUrl);
    },
});
function parsePackageName(url) {
    const parts = url.split('/');
    const hasScope = parts.length >= 2 && parts[0].startsWith('@');
    const [nameOrScope, nameOrFirstPath, ...pathPart] = parts;
    const packageName = hasScope ? `${nameOrScope}/${nameOrFirstPath}` : nameOrScope;
    return {
        packageName,
        get pathSegments() {
            return !hasScope && nameOrFirstPath ? [nameOrFirstPath, ...pathPart] : pathPart;
        },
    };
}
class Cache extends Map {
    async getOrCreate(key, creator) {
        let value = this.get(key);
        if (value === undefined) {
            value = await creator();
            this.set(key, value);
        }
        return value;
    }
}
async function compileString(data, filePath, syntax, options, resolveUrl) {
    // Lazily load Sass when a Sass file is found
    if (sassWorkerPool === undefined) {
        const sassService = await Promise.resolve().then(() => __importStar(require('../../sass/sass-service')));
        sassWorkerPool = new sassService.SassWorkerImplementation(true);
    }
    // Cache is currently local to individual compile requests.
    // Caching follows Sass behavior where a given url will always resolve to the same value
    // regardless of its importer's path.
    // A null value indicates that the cached resolution attempt failed to find a location and
    // later stage resolution should be attempted. This avoids potentially expensive repeat
    // failing resolution attempts.
    const resolutionCache = new Cache();
    const packageRootCache = new Cache();
    const warnings = [];
    try {
        const { css, sourceMap, loadedUrls } = await sassWorkerPool.compileStringAsync(data, {
            url: (0, node_url_1.pathToFileURL)(filePath),
            style: 'expanded',
            syntax,
            loadPaths: options.includePaths,
            sourceMap: options.sourcemap,
            sourceMapIncludeSources: options.sourcemap,
            quietDeps: true,
            importers: [
                {
                    findFileUrl: (url, options) => resolutionCache.getOrCreate(url, async () => {
                        const result = await resolveUrl(url, options);
                        if (result.path) {
                            return (0, node_url_1.pathToFileURL)(result.path);
                        }
                        // Check for package deep imports
                        const { packageName, pathSegments } = parsePackageName(url);
                        // Caching package root locations is particularly beneficial for `@material/*` packages
                        // which extensively use deep imports.
                        const packageRoot = await packageRootCache.getOrCreate(packageName, async () => {
                            // Use the required presence of a package root `package.json` file to resolve the location
                            const packageResult = await resolveUrl(packageName + '/package.json', options);
                            return packageResult.path ? (0, node_path_1.dirname)(packageResult.path) : null;
                        });
                        // Package not found could be because of an error or the specifier is intended to be found
                        // via a later stage of the resolution process (`loadPaths`, etc.).
                        // Errors are reported after the full completion of the resolution process. Exceptions for
                        // not found packages should not be raised here.
                        if (packageRoot) {
                            return (0, node_url_1.pathToFileURL)((0, node_path_1.join)(packageRoot, ...pathSegments));
                        }
                        // Not found
                        return null;
                    }),
                },
            ],
            logger: {
                warn: (text, { deprecation, span }) => {
                    warnings.push({
                        text: deprecation ? 'Deprecation' : text,
                        location: span && {
                            file: span.url && (0, node_url_1.fileURLToPath)(span.url),
                            lineText: span.context,
                            // Sass line numbers are 0-based while esbuild's are 1-based
                            line: span.start.line + 1,
                            column: span.start.column,
                        },
                        notes: deprecation ? [{ text }] : undefined,
                    });
                },
            },
        });
        return {
            loader: 'css',
            contents: sourceMap ? `${css}\n${sourceMapToUrlComment(sourceMap, (0, node_path_1.dirname)(filePath))}` : css,
            watchFiles: loadedUrls.map((url) => (0, node_url_1.fileURLToPath)(url)),
            warnings,
        };
    }
    catch (error) {
        if (isSassException(error)) {
            const file = error.span.url ? (0, node_url_1.fileURLToPath)(error.span.url) : undefined;
            return {
                loader: 'css',
                errors: [
                    {
                        text: error.message,
                    },
                ],
                warnings,
                watchFiles: file ? [file] : undefined,
            };
        }
        throw error;
    }
}
function sourceMapToUrlComment(sourceMap, root) {
    // Remove `file` protocol from all sourcemap sources and adjust to be relative to the input file.
    // This allows esbuild to correctly process the paths.
    sourceMap.sources = sourceMap.sources.map((source) => (0, node_path_1.relative)(root, (0, node_url_1.fileURLToPath)(source)));
    const urlSourceMap = Buffer.from(JSON.stringify(sourceMap), 'utf-8').toString('base64');
    return `/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${urlSourceMap} */`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1sYW5ndWFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvc3R5bGVzaGVldHMvc2Fzcy1sYW5ndWFnZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILHlDQUFvRDtBQUNwRCx1Q0FBd0Q7QUFReEQsSUFBSSxjQUFvRCxDQUFDO0FBRXpELFNBQVMsZUFBZSxDQUFDLEtBQWM7SUFDckMsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxhQUFhLElBQUksS0FBSyxDQUFDO0FBQ3hFLENBQUM7QUFFRCxTQUFnQixzQkFBc0I7SUFDcEMsY0FBYyxFQUFFLEtBQUssRUFBRSxDQUFDO0lBQ3hCLGNBQWMsR0FBRyxTQUFTLENBQUM7QUFDN0IsQ0FBQztBQUhELHdEQUdDO0FBRVksUUFBQSxzQkFBc0IsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFxQjtJQUN0RSxJQUFJLEVBQUUsTUFBTTtJQUNaLGVBQWUsRUFBRSxXQUFXO0lBQzVCLFVBQVUsRUFBRSxZQUFZO0lBQ3hCLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsS0FBSztRQUN4QyxNQUFNLE1BQU0sR0FBRyxNQUFNLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUN2RCxNQUFNLFVBQVUsR0FBRyxLQUFLLEVBQUUsR0FBVyxFQUFFLE9BQThDLEVBQUUsRUFBRTtZQUN2RixJQUFJLE1BQU0sR0FBRyxNQUFNLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFO2dCQUNwQyxJQUFJLEVBQUUsYUFBYTtnQkFDbkIsK0VBQStF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QUUsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRXhGLE9BQU8sbUVBQW1FLFlBQVksS0FBSyxDQUFDO0FBQzlGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBPbkxvYWRSZXN1bHQsIFBhcnRpYWxNZXNzYWdlLCBSZXNvbHZlUmVzdWx0IH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBkaXJuYW1lLCBqb2luLCByZWxhdGl2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBwYXRoVG9GaWxlVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IHR5cGUgeyBDb21waWxlUmVzdWx0LCBFeGNlcHRpb24sIFN5bnRheCB9IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHR5cGUge1xuICBGaWxlSW1wb3J0ZXJXaXRoUmVxdWVzdENvbnRleHRPcHRpb25zLFxuICBTYXNzV29ya2VySW1wbGVtZW50YXRpb24sXG59IGZyb20gJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlJztcbmltcG9ydCB7IFN0eWxlc2hlZXRMYW5ndWFnZSwgU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMgfSBmcm9tICcuL3N0eWxlc2hlZXQtcGx1Z2luLWZhY3RvcnknO1xuXG5sZXQgc2Fzc1dvcmtlclBvb2w6IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbiB8IHVuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNTYXNzRXhjZXB0aW9uKGVycm9yOiB1bmtub3duKTogZXJyb3IgaXMgRXhjZXB0aW9uIHtcbiAgcmV0dXJuICEhZXJyb3IgJiYgdHlwZW9mIGVycm9yID09PSAnb2JqZWN0JyAmJiAnc2Fzc01lc3NhZ2UnIGluIGVycm9yO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2h1dGRvd25TYXNzV29ya2VyUG9vbCgpOiB2b2lkIHtcbiAgc2Fzc1dvcmtlclBvb2w/LmNsb3NlKCk7XG4gIHNhc3NXb3JrZXJQb29sID0gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgY29uc3QgU2Fzc1N0eWxlc2hlZXRMYW5ndWFnZSA9IE9iamVjdC5mcmVlemU8U3R5bGVzaGVldExhbmd1YWdlPih7XG4gIG5hbWU6ICdzYXNzJyxcbiAgY29tcG9uZW50RmlsdGVyOiAvXnNbYWNdc3M7LyxcbiAgZmlsZUZpbHRlcjogL1xcLnNbYWNdc3MkLyxcbiAgcHJvY2VzcyhkYXRhLCBmaWxlLCBmb3JtYXQsIG9wdGlvbnMsIGJ1aWxkKSB7XG4gICAgY29uc3Qgc3ludGF4ID0gZm9ybWF0ID09PSAnc2FzcycgPyAnaW5kZW50ZWQnIDogJ3Njc3MnO1xuICAgIGNvbnN0IHJlc29sdmVVcmwgPSBhc3luYyAodXJsOiBzdHJpbmcsIG9wdGlvbnM6IEZpbGVJbXBvcnRlcldpdGhSZXF1ZXN0Q29udGV4dE9wdGlvbnMpID0+IHtcbiAgICAgIGxldCByZXN1bHQgPSBhd2FpdCBidWlsZC5yZXNvbHZlKHVybCwge1xuICAgICAgICBraW5kOiAnaW1wb3J0LXJ1bGUnLFxuICAgICAgICAvLyBVc2UgdGhlIHByb3ZpZGVkIHJlc29sdmUgZGlyZWN0b3J5IGZyb20gdGhlIGN1c3RvbSBTYXNzIHNlcnZpY2UgaWYgYXZhaWxhYmxlXG4gICAgICAgIHJlc29sdmVEaXI6IG9wdGlvbnMucmVzb2x2ZURpciA/PyBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIElmIGEgcmVzb2x2ZSBkaXJlY3RvcnkgaXMgcHJvdmlkZWQsIG5vIGFkZGl0aW9uYWwgc3BlY3VsYXRpdmUgcmVzb2x1dGlvbnMgYXJlIHJlcXVpcmVkXG4gICAgICBpZiAob3B0aW9ucy5yZXNvbHZlRGlyKSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG5cbiAgICAgIC8vIFdvcmthcm91bmQgdG8gc3VwcG9ydCBZYXJuIFBuUCBhbmQgcG5wbSB3aXRob3V0IGFjY2VzcyB0byB0aGUgaW1wb3J0ZXIgZmlsZSBmcm9tIFNhc3NcbiAgICAgIGlmICghcmVzdWx0LnBhdGggJiYgb3B0aW9ucy5wcmV2aW91c1Jlc29sdmVkTW9kdWxlcz8uc2l6ZSkge1xuICAgICAgICBmb3IgKGNvbnN0IHByZXZpb3VzIG9mIG9wdGlvbnMucHJldmlvdXNSZXNvbHZlZE1vZHVsZXMpIHtcbiAgICAgICAgICByZXN1bHQgPSBhd2FpdCBidWlsZC5yZXNvbHZlKHVybCwge1xuICAgICAgICAgICAga2luZDogJ2ltcG9ydC1ydWxlJyxcbiAgICAgICAgICAgIHJlc29sdmVEaXI6IHByZXZpb3VzLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChyZXN1bHQucGF0aCkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIHJldHVybiBjb21waWxlU3RyaW5nKGRhdGEsIGZpbGUsIHN5bnRheCwgb3B0aW9ucywgcmVzb2x2ZVVybCk7XG4gIH0sXG59KTtcblxuZnVuY3Rpb24gcGFyc2VQYWNrYWdlTmFtZSh1cmw6IHN0cmluZyk6IHsgcGFja2FnZU5hbWU6IHN0cmluZzsgcmVhZG9ubHkgcGF0aFNlZ21lbnRzOiBzdHJpbmdbXSB9IHtcbiAgY29uc3QgcGFydHMgPSB1cmwuc3BsaXQoJy8nKTtcbiAgY29uc3QgaGFzU2NvcGUgPSBwYXJ0cy5sZW5ndGggPj0gMiAmJiBwYXJ0c1swXS5zdGFydHNXaXRoKCdAJyk7XG4gIGNvbnN0IFtuYW1lT3JTY29wZSwgbmFtZU9yRmlyc3RQYXRoLCAuLi5wYXRoUGFydF0gPSBwYXJ0cztcbiAgY29uc3QgcGFja2FnZU5hbWUgPSBoYXNTY29wZSA/IGAke25hbWVPclNjb3BlfS8ke25hbWVPckZpcnN0UGF0aH1gIDogbmFtZU9yU2NvcGU7XG5cbiAgcmV0dXJuIHtcbiAgICBwYWNrYWdlTmFtZSxcbiAgICBnZXQgcGF0aFNlZ21lbnRzKCkge1xuICAgICAgcmV0dXJuICFoYXNTY29wZSAmJiBuYW1lT3JGaXJzdFBhdGggPyBbbmFtZU9yRmlyc3RQYXRoLCAuLi5wYXRoUGFydF0gOiBwYXRoUGFydDtcbiAgICB9LFxuICB9O1xufVxuXG5jbGFzcyBDYWNoZTxLLCBWPiBleHRlbmRzIE1hcDxLLCBWPiB7XG4gIGFzeW5jIGdldE9yQ3JlYXRlKGtleTogSywgY3JlYXRvcjogKCkgPT4gViB8IFByb21pc2U8Vj4pOiBQcm9taXNlPFY+IHtcbiAgICBsZXQgdmFsdWUgPSB0aGlzLmdldChrZXkpO1xuXG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhbHVlID0gYXdhaXQgY3JlYXRvcigpO1xuICAgICAgdGhpcy5zZXQoa2V5LCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNvbXBpbGVTdHJpbmcoXG4gIGRhdGE6IHN0cmluZyxcbiAgZmlsZVBhdGg6IHN0cmluZyxcbiAgc3ludGF4OiBTeW50YXgsXG4gIG9wdGlvbnM6IFN0eWxlc2hlZXRQbHVnaW5PcHRpb25zLFxuICByZXNvbHZlVXJsOiAoXG4gICAgdXJsOiBzdHJpbmcsXG4gICAgb3B0aW9uczogRmlsZUltcG9ydGVyV2l0aFJlcXVlc3RDb250ZXh0T3B0aW9ucyxcbiAgKSA9PiBQcm9taXNlPFJlc29sdmVSZXN1bHQ+LFxuKTogUHJvbWlzZTxPbkxvYWRSZXN1bHQ+IHtcbiAgLy8gTGF6aWx5IGxvYWQgU2FzcyB3aGVuIGEgU2FzcyBmaWxlIGlzIGZvdW5kXG4gIGlmIChzYXNzV29ya2VyUG9vbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3Qgc2Fzc1NlcnZpY2UgPSBhd2FpdCBpbXBvcnQoJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlJyk7XG4gICAgc2Fzc1dvcmtlclBvb2wgPSBuZXcgc2Fzc1NlcnZpY2UuU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uKHRydWUpO1xuICB9XG5cbiAgLy8gQ2FjaGUgaXMgY3VycmVudGx5IGxvY2FsIHRvIGluZGl2aWR1YWwgY29tcGlsZSByZXF1ZXN0cy5cbiAgLy8gQ2FjaGluZyBmb2xsb3dzIFNhc3MgYmVoYXZpb3Igd2hlcmUgYSBnaXZlbiB1cmwgd2lsbCBhbHdheXMgcmVzb2x2ZSB0byB0aGUgc2FtZSB2YWx1ZVxuICAvLyByZWdhcmRsZXNzIG9mIGl0cyBpbXBvcnRlcidzIHBhdGguXG4gIC8vIEEgbnVsbCB2YWx1ZSBpbmRpY2F0ZXMgdGhhdCB0aGUgY2FjaGVkIHJlc29sdXRpb24gYXR0ZW1wdCBmYWlsZWQgdG8gZmluZCBhIGxvY2F0aW9uIGFuZFxuICAvLyBsYXRlciBzdGFnZSByZXNvbHV0aW9uIHNob3VsZCBiZSBhdHRlbXB0ZWQuIFRoaXMgYXZvaWRzIHBvdGVudGlhbGx5IGV4cGVuc2l2ZSByZXBlYXRcbiAgLy8gZmFpbGluZyByZXNvbHV0aW9uIGF0dGVtcHRzLlxuICBjb25zdCByZXNvbHV0aW9uQ2FjaGUgPSBuZXcgQ2FjaGU8c3RyaW5nLCBVUkwgfCBudWxsPigpO1xuICBjb25zdCBwYWNrYWdlUm9vdENhY2hlID0gbmV3IENhY2hlPHN0cmluZywgc3RyaW5nIHwgbnVsbD4oKTtcblxuICBjb25zdCB3YXJuaW5nczogUGFydGlhbE1lc3NhZ2VbXSA9IFtdO1xuICB0cnkge1xuICAgIGNvbnN0IHsgY3NzLCBzb3VyY2VNYXAsIGxvYWRlZFVybHMgfSA9IGF3YWl0IHNhc3NXb3JrZXJQb29sLmNvbXBpbGVTdHJpbmdBc3luYyhkYXRhLCB7XG4gICAgICB1cmw6IHBhdGhUb0ZpbGVVUkwoZmlsZVBhdGgpLFxuICAgICAgc3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICBzeW50YXgsXG4gICAgICBsb2FkUGF0aHM6IG9wdGlvbnMuaW5jbHVkZVBhdGhzLFxuICAgICAgc291cmNlTWFwOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgIHNvdXJjZU1hcEluY2x1ZGVTb3VyY2VzOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgIHF1aWV0RGVwczogdHJ1ZSxcbiAgICAgIGltcG9ydGVyczogW1xuICAgICAgICB7XG4gICAgICAgICAgZmluZEZpbGVVcmw6ICh1cmwsIG9wdGlvbnM6IEZpbGVJbXBvcnRlcldpdGhSZXF1ZXN0Q29udGV4dE9wdGlvbnMpID0+XG4gICAgICAgICAgICByZXNvbHV0aW9uQ2FjaGUuZ2V0T3JDcmVhdGUodXJsLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc29sdmVVcmwodXJsLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgaWYgKHJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhdGhUb0ZpbGVVUkwocmVzdWx0LnBhdGgpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIHBhY2thZ2UgZGVlcCBpbXBvcnRzXG4gICAgICAgICAgICAgIGNvbnN0IHsgcGFja2FnZU5hbWUsIHBhdGhTZWdtZW50cyB9ID0gcGFyc2VQYWNrYWdlTmFtZSh1cmwpO1xuXG4gICAgICAgICAgICAgIC8vIENhY2hpbmcgcGFja2FnZSByb290IGxvY2F0aW9ucyBpcyBwYXJ0aWN1bGFybHkgYmVuZWZpY2lhbCBmb3IgYEBtYXRlcmlhbC8qYCBwYWNrYWdlc1xuICAgICAgICAgICAgICAvLyB3aGljaCBleHRlbnNpdmVseSB1c2UgZGVlcCBpbXBvcnRzLlxuICAgICAgICAgICAgICBjb25zdCBwYWNrYWdlUm9vdCA9IGF3YWl0IHBhY2thZ2VSb290Q2FjaGUuZ2V0T3JDcmVhdGUocGFja2FnZU5hbWUsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBVc2UgdGhlIHJlcXVpcmVkIHByZXNlbmNlIG9mIGEgcGFja2FnZSByb290IGBwYWNrYWdlLmpzb25gIGZpbGUgdG8gcmVzb2x2ZSB0aGUgbG9jYXRpb25cbiAgICAgICAgICAgICAgICBjb25zdCBwYWNrYWdlUmVzdWx0ID0gYXdhaXQgcmVzb2x2ZVVybChwYWNrYWdlTmFtZSArICcvcGFja2FnZS5qc29uJywgb3B0aW9ucyk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcGFja2FnZVJlc3VsdC5wYXRoID8gZGlybmFtZShwYWNrYWdlUmVzdWx0LnBhdGgpIDogbnVsbDtcbiAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgLy8gUGFja2FnZSBub3QgZm91bmQgY291bGQgYmUgYmVjYXVzZSBvZiBhbiBlcnJvciBvciB0aGUgc3BlY2lmaWVyIGlzIGludGVuZGVkIHRvIGJlIGZvdW5kXG4gICAgICAgICAgICAgIC8vIHZpYSBhIGxhdGVyIHN0YWdlIG9mIHRoZSByZXNvbHV0aW9uIHByb2Nlc3MgKGBsb2FkUGF0aHNgLCBldGMuKS5cbiAgICAgICAgICAgICAgLy8gRXJyb3JzIGFyZSByZXBvcnRlZCBhZnRlciB0aGUgZnVsbCBjb21wbGV0aW9uIG9mIHRoZSByZXNvbHV0aW9uIHByb2Nlc3MuIEV4Y2VwdGlvbnMgZm9yXG4gICAgICAgICAgICAgIC8vIG5vdCBmb3VuZCBwYWNrYWdlcyBzaG91bGQgbm90IGJlIHJhaXNlZCBoZXJlLlxuICAgICAgICAgICAgICBpZiAocGFja2FnZVJvb3QpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGF0aFRvRmlsZVVSTChqb2luKHBhY2thZ2VSb290LCAuLi5wYXRoU2VnbWVudHMpKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIE5vdCBmb3VuZFxuICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxvZ2dlcjoge1xuICAgICAgICB3YXJuOiAodGV4dCwgeyBkZXByZWNhdGlvbiwgc3BhbiB9KSA9PiB7XG4gICAgICAgICAgd2FybmluZ3MucHVzaCh7XG4gICAgICAgICAgICB0ZXh0OiBkZXByZWNhdGlvbiA/ICdEZXByZWNhdGlvbicgOiB0ZXh0LFxuICAgICAgICAgICAgbG9jYXRpb246IHNwYW4gJiYge1xuICAgICAgICAgICAgICBmaWxlOiBzcGFuLnVybCAmJiBmaWxlVVJMVG9QYXRoKHNwYW4udXJsKSxcbiAgICAgICAgICAgICAgbGluZVRleHQ6IHNwYW4uY29udGV4dCxcbiAgICAgICAgICAgICAgLy8gU2FzcyBsaW5lIG51bWJlcnMgYXJlIDAtYmFzZWQgd2hpbGUgZXNidWlsZCdzIGFyZSAxLWJhc2VkXG4gICAgICAgICAgICAgIGxpbmU6IHNwYW4uc3RhcnQubGluZSArIDEsXG4gICAgICAgICAgICAgIGNvbHVtbjogc3Bhbi5zdGFydC5jb2x1bW4sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbm90ZXM6IGRlcHJlY2F0aW9uID8gW3sgdGV4dCB9XSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgIGNvbnRlbnRzOiBzb3VyY2VNYXAgPyBgJHtjc3N9XFxuJHtzb3VyY2VNYXBUb1VybENvbW1lbnQoc291cmNlTWFwLCBkaXJuYW1lKGZpbGVQYXRoKSl9YCA6IGNzcyxcbiAgICAgIHdhdGNoRmlsZXM6IGxvYWRlZFVybHMubWFwKCh1cmwpID0+IGZpbGVVUkxUb1BhdGgodXJsKSksXG4gICAgICB3YXJuaW5ncyxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChpc1Nhc3NFeGNlcHRpb24oZXJyb3IpKSB7XG4gICAgICBjb25zdCBmaWxlID0gZXJyb3Iuc3Bhbi51cmwgPyBmaWxlVVJMVG9QYXRoKGVycm9yLnNwYW4udXJsKSA6IHVuZGVmaW5lZDtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdGV4dDogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICB3YXJuaW5ncyxcbiAgICAgICAgd2F0Y2hGaWxlczogZmlsZSA/IFtmaWxlXSA6IHVuZGVmaW5lZCxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cblxuZnVuY3Rpb24gc291cmNlTWFwVG9VcmxDb21tZW50KFxuICBzb3VyY2VNYXA6IEV4Y2x1ZGU8Q29tcGlsZVJlc3VsdFsnc291cmNlTWFwJ10sIHVuZGVmaW5lZD4sXG4gIHJvb3Q6IHN0cmluZyxcbik6IHN0cmluZyB7XG4gIC8vIFJlbW92ZSBgZmlsZWAgcHJvdG9jb2wgZnJvbSBhbGwgc291cmNlbWFwIHNvdXJjZXMgYW5kIGFkanVzdCB0byBiZSByZWxhdGl2ZSB0byB0aGUgaW5wdXQgZmlsZS5cbiAgLy8gVGhpcyBhbGxvd3MgZXNidWlsZCB0byBjb3JyZWN0bHkgcHJvY2VzcyB0aGUgcGF0aHMuXG4gIHNvdXJjZU1hcC5zb3VyY2VzID0gc291cmNlTWFwLnNvdXJjZXMubWFwKChzb3VyY2UpID0+IHJlbGF0aXZlKHJvb3QsIGZpbGVVUkxUb1BhdGgoc291cmNlKSkpO1xuXG4gIGNvbnN0IHVybFNvdXJjZU1hcCA9IEJ1ZmZlci5mcm9tKEpTT04uc3RyaW5naWZ5KHNvdXJjZU1hcCksICd1dGYtOCcpLnRvU3RyaW5nKCdiYXNlNjQnKTtcblxuICByZXR1cm4gYC8qIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zi04O2Jhc2U2NCwke3VybFNvdXJjZU1hcH0gKi9gO1xufVxuIl19