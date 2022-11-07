"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSassPlugin = exports.shutdownSassWorkerPool = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const sass_service_1 = require("../../sass/sass-service");
let sassWorkerPool;
function isSassException(error) {
    return !!error && typeof error === 'object' && 'sassMessage' in error;
}
function shutdownSassWorkerPool() {
    sassWorkerPool === null || sassWorkerPool === void 0 ? void 0 : sassWorkerPool.close();
    sassWorkerPool = undefined;
}
exports.shutdownSassWorkerPool = shutdownSassWorkerPool;
function createSassPlugin(options) {
    return {
        name: 'angular-sass',
        setup(build) {
            build.onLoad({ filter: /\.s[ac]ss$/ }, async (args) => {
                // Lazily load Sass when a Sass file is found
                sassWorkerPool !== null && sassWorkerPool !== void 0 ? sassWorkerPool : (sassWorkerPool = new sass_service_1.SassWorkerImplementation(true));
                const warnings = [];
                try {
                    const data = await (0, promises_1.readFile)(args.path, 'utf-8');
                    const { css, sourceMap, loadedUrls } = await sassWorkerPool.compileStringAsync(data, {
                        url: (0, node_url_1.pathToFileURL)(args.path),
                        style: 'expanded',
                        loadPaths: options.loadPaths,
                        sourceMap: options.sourcemap,
                        sourceMapIncludeSources: options.sourcemap,
                        quietDeps: true,
                        importers: [
                            {
                                findFileUrl: async (url, { previousResolvedModules }) => {
                                    let result = await build.resolve(url, {
                                        kind: 'import-rule',
                                        // This should ideally be the directory of the importer file from Sass
                                        // but that is not currently available from the Sass importer API.
                                        resolveDir: build.initialOptions.absWorkingDir,
                                    });
                                    // Workaround to support Yarn PnP without access to the importer file from Sass
                                    if (!result.path && (previousResolvedModules === null || previousResolvedModules === void 0 ? void 0 : previousResolvedModules.size)) {
                                        for (const previous of previousResolvedModules) {
                                            result = await build.resolve(url, {
                                                kind: 'import-rule',
                                                resolveDir: previous,
                                            });
                                        }
                                    }
                                    // Check for package deep imports
                                    if (!result.path) {
                                        const parts = url.split('/');
                                        const hasScope = parts.length > 2 && parts[0].startsWith('@');
                                        if (hasScope || parts.length > 1) {
                                            const [nameOrScope, nameOrFirstPath, ...pathPart] = parts;
                                            const packageName = hasScope
                                                ? `${nameOrScope}/${nameOrFirstPath}`
                                                : nameOrScope;
                                            const packageResult = await build.resolve(packageName + '/package.json', {
                                                kind: 'import-rule',
                                                // This should ideally be the directory of the importer file from Sass
                                                // but that is not currently available from the Sass importer API.
                                                resolveDir: build.initialOptions.absWorkingDir,
                                            });
                                            if (packageResult.path) {
                                                return (0, node_url_1.pathToFileURL)((0, node_path_1.join)((0, node_path_1.dirname)(packageResult.path), !hasScope ? nameOrFirstPath : '', ...pathPart));
                                            }
                                        }
                                    }
                                    return result.path ? (0, node_url_1.pathToFileURL)(result.path) : null;
                                },
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
                        contents: sourceMap
                            ? `${css}\n${sourceMapToUrlComment(sourceMap, (0, node_path_1.dirname)(args.path))}`
                            : css,
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
            });
        },
    };
}
exports.createSassPlugin = createSassPlugin;
function sourceMapToUrlComment(sourceMap, root) {
    // Remove `file` protocol from all sourcemap sources and adjust to be relative to the input file.
    // This allows esbuild to correctly process the paths.
    sourceMap.sources = sourceMap.sources.map((source) => (0, node_path_1.relative)(root, (0, node_url_1.fileURLToPath)(source)));
    const urlSourceMap = Buffer.from(JSON.stringify(sourceMap), 'utf-8').toString('base64');
    return `/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${urlSourceMap} */`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc2Fzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBR0gsK0NBQTRDO0FBQzVDLHlDQUFvRDtBQUNwRCx1Q0FBd0Q7QUFFeEQsMERBR2lDO0FBRWpDLElBQUksY0FBb0QsQ0FBQztBQUV6RCxTQUFTLGVBQWUsQ0FBQyxLQUFjO0lBQ3JDLE9BQU8sQ0FBQyxDQUFDLEtBQUssSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksYUFBYSxJQUFJLEtBQUssQ0FBQztBQUN4RSxDQUFDO0FBRUQsU0FBZ0Isc0JBQXNCO0lBQ3BDLGNBQWMsYUFBZCxjQUFjLHVCQUFkLGNBQWMsQ0FBRSxLQUFLLEVBQUUsQ0FBQztJQUN4QixjQUFjLEdBQUcsU0FBUyxDQUFDO0FBQzdCLENBQUM7QUFIRCx3REFHQztBQUVELFNBQWdCLGdCQUFnQixDQUFDLE9BQXFEO0lBQ3BGLE9BQU87UUFDTCxJQUFJLEVBQUUsY0FBYztRQUNwQixLQUFLLENBQUMsS0FBa0I7WUFDdEIsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7Z0JBQ3BELDZDQUE2QztnQkFDN0MsY0FBYyxhQUFkLGNBQWMsY0FBZCxjQUFjLElBQWQsY0FBYyxHQUFLLElBQUksdUNBQXdCLENBQUMsSUFBSSxDQUFDLEVBQUM7Z0JBRXRELE1BQU0sUUFBUSxHQUFxQixFQUFFLENBQUM7Z0JBQ3RDLElBQUk7b0JBQ0YsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFBLG1CQUFRLEVBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztv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LENBQUMsQ0FBQyxJQUFBLHdCQUFhLEVBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO3dCQUV4RSxPQUFPOzRCQUNMLE1BQU0sRUFBRSxLQUFLOzRCQUNiLE1BQU0sRUFBRTtnQ0FDTjtvQ0FDRSxJQUFJLEVBQUUsS0FBSyxDQUFDLE9BQU87aUNBQ3BCOzZCQUNGOzRCQUNELFFBQVE7NEJBQ1IsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUzt5QkFDdEMsQ0FBQztxQkFDSDtvQkFFRCxNQUFNLEtBQUssQ0FBQztpQkFDYjtZQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBdkhELDRDQXVIQztBQUVELFNBQVMscUJBQXFCLENBQzVCLFNBQXlELEVBQ3pELElBQVk7SUFFWixpR0FBaUc7SUFDakcsc0RBQXNEO0lBQ3RELFNBQVMsQ0FBQyxPQUFPLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLElBQUEsb0JBQVEsRUFBQyxJQUFJLEVBQUUsSUFBQSx3QkFBYSxFQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUU3RixNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRXhGLE9BQU8sbUVBQW1FLFlBQVksS0FBSyxDQUFDO0FBQzlGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBQYXJ0aWFsTWVzc2FnZSwgUGx1Z2luLCBQbHVnaW5CdWlsZCB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IGRpcm5hbWUsIGpvaW4sIHJlbGF0aXZlIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgdHlwZSB7IENvbXBpbGVSZXN1bHQsIEV4Y2VwdGlvbiB9IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHtcbiAgRmlsZUltcG9ydGVyV2l0aFJlcXVlc3RDb250ZXh0T3B0aW9ucyxcbiAgU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uLFxufSBmcm9tICcuLi8uLi9zYXNzL3Nhc3Mtc2VydmljZSc7XG5cbmxldCBzYXNzV29ya2VyUG9vbDogU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uIHwgdW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc1Nhc3NFeGNlcHRpb24oZXJyb3I6IHVua25vd24pOiBlcnJvciBpcyBFeGNlcHRpb24ge1xuICByZXR1cm4gISFlcnJvciAmJiB0eXBlb2YgZXJyb3IgPT09ICdvYmplY3QnICYmICdzYXNzTWVzc2FnZScgaW4gZXJyb3I7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaHV0ZG93blNhc3NXb3JrZXJQb29sKCk6IHZvaWQge1xuICBzYXNzV29ya2VyUG9vbD8uY2xvc2UoKTtcbiAgc2Fzc1dvcmtlclBvb2wgPSB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTYXNzUGx1Z2luKG9wdGlvbnM6IHsgc291cmNlbWFwOiBib29sZWFuOyBsb2FkUGF0aHM/OiBzdHJpbmdbXSB9KTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1zYXNzJyxcbiAgICBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiB2b2lkIHtcbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLnNbYWNdc3MkLyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAvLyBMYXppbHkgbG9hZCBTYXNzIHdoZW4gYSBTYXNzIGZpbGUgaXMgZm91bmRcbiAgICAgICAgc2Fzc1dvcmtlclBvb2wgPz89IG5ldyBTYXNzV29ya2VySW1wbGVtZW50YXRpb24odHJ1ZSk7XG5cbiAgICAgICAgY29uc3Qgd2FybmluZ3M6IFBhcnRpYWxNZXNzYWdlW10gPSBbXTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVhZEZpbGUoYXJncy5wYXRoLCAndXRmLTgnKTtcbiAgICAgICAgICBjb25zdCB7IGNzcywgc291cmNlTWFwLCBsb2FkZWRVcmxzIH0gPSBhd2FpdCBzYXNzV29ya2VyUG9vbC5jb21waWxlU3RyaW5nQXN5bmMoZGF0YSwge1xuICAgICAgICAgICAgdXJsOiBwYXRoVG9GaWxlVVJMKGFyZ3MucGF0aCksXG4gICAgICAgICAgICBzdHlsZTogJ2V4cGFuZGVkJyxcbiAgICAgICAgICAgIGxvYWRQYXRoczogb3B0aW9ucy5sb2FkUGF0aHMsXG4gICAgICAgICAgICBzb3VyY2VNYXA6IG9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgICAgc291cmNlTWFwSW5jbHVkZVNvdXJjZXM6IG9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgICAgcXVpZXREZXBzOiB0cnVlLFxuICAgICAgICAgICAgaW1wb3J0ZXJzOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBmaW5kRmlsZVVybDogYXN5bmMgKFxuICAgICAgICAgICAgICAgICAgdXJsLFxuICAgICAgICAgICAgICAgICAgeyBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcyB9OiBGaWxlSW1wb3J0ZXJXaXRoUmVxdWVzdENvbnRleHRPcHRpb25zLFxuICAgICAgICAgICAgICAgICk6IFByb21pc2U8VVJMIHwgbnVsbD4gPT4ge1xuICAgICAgICAgICAgICAgICAgbGV0IHJlc3VsdCA9IGF3YWl0IGJ1aWxkLnJlc29sdmUodXJsLCB7XG4gICAgICAgICAgICAgICAgICAgIGtpbmQ6ICdpbXBvcnQtcnVsZScsXG4gICAgICAgICAgICAgICAgICAgIC8vIFRoaXMgc2hvdWxkIGlkZWFsbHkgYmUgdGhlIGRpcmVjdG9yeSBvZiB0aGUgaW1wb3J0ZXIgZmlsZSBmcm9tIFNhc3NcbiAgICAgICAgICAgICAgICAgICAgLy8gYnV0IHRoYXQgaXMgbm90IGN1cnJlbnRseSBhdmFpbGFibGUgZnJvbSB0aGUgU2FzcyBpbXBvcnRlciBBUEkuXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmVEaXI6IGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIsXG4gICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgLy8gV29ya2Fyb3VuZCB0byBzdXBwb3J0IFlhcm4gUG5QIHdpdGhvdXQgYWNjZXNzIHRvIHRoZSBpbXBvcnRlciBmaWxlIGZyb20gU2Fzc1xuICAgICAgICAgICAgICAgICAgaWYgKCFyZXN1bHQucGF0aCAmJiBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcz8uc2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHByZXZpb3VzIG9mIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZSh1cmwsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGtpbmQ6ICdpbXBvcnQtcnVsZScsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlRGlyOiBwcmV2aW91cyxcbiAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAvLyBDaGVjayBmb3IgcGFja2FnZSBkZWVwIGltcG9ydHNcbiAgICAgICAgICAgICAgICAgIGlmICghcmVzdWx0LnBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFydHMgPSB1cmwuc3BsaXQoJy8nKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFzU2NvcGUgPSBwYXJ0cy5sZW5ndGggPiAyICYmIHBhcnRzWzBdLnN0YXJ0c1dpdGgoJ0AnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhhc1Njb3BlIHx8IHBhcnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBbbmFtZU9yU2NvcGUsIG5hbWVPckZpcnN0UGF0aCwgLi4ucGF0aFBhcnRdID0gcGFydHM7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFja2FnZU5hbWUgPSBoYXNTY29wZVxuICAgICAgICAgICAgICAgICAgICAgICAgPyBgJHtuYW1lT3JTY29wZX0vJHtuYW1lT3JGaXJzdFBhdGh9YFxuICAgICAgICAgICAgICAgICAgICAgICAgOiBuYW1lT3JTY29wZTtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYWNrYWdlUmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZShwYWNrYWdlTmFtZSArICcvcGFja2FnZS5qc29uJywge1xuICAgICAgICAgICAgICAgICAgICAgICAga2luZDogJ2ltcG9ydC1ydWxlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRoaXMgc2hvdWxkIGlkZWFsbHkgYmUgdGhlIGRpcmVjdG9yeSBvZiB0aGUgaW1wb3J0ZXIgZmlsZSBmcm9tIFNhc3NcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJ1dCB0aGF0IGlzIG5vdCBjdXJyZW50bHkgYXZhaWxhYmxlIGZyb20gdGhlIFNhc3MgaW1wb3J0ZXIgQVBJLlxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZURpcjogYnVpbGQuaW5pdGlhbE9wdGlvbnMuYWJzV29ya2luZ0RpcixcbiAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgIGlmIChwYWNrYWdlUmVzdWx0LnBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBqb2luKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpcm5hbWUocGFja2FnZVJlc3VsdC5wYXRoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAhaGFzU2NvcGUgPyBuYW1lT3JGaXJzdFBhdGggOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuLi5wYXRoUGFydCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQucGF0aCA/IHBhdGhUb0ZpbGVVUkwocmVzdWx0LnBhdGgpIDogbnVsbDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIGxvZ2dlcjoge1xuICAgICAgICAgICAgICB3YXJuOiAodGV4dCwgeyBkZXByZWNhdGlvbiwgc3BhbiB9KSA9PiB7XG4gICAgICAgICAgICAgICAgd2FybmluZ3MucHVzaCh7XG4gICAgICAgICAgICAgICAgICB0ZXh0OiBkZXByZWNhdGlvbiA/ICdEZXByZWNhdGlvbicgOiB0ZXh0LFxuICAgICAgICAgICAgICAgICAgbG9jYXRpb246IHNwYW4gJiYge1xuICAgICAgICAgICAgICAgICAgICBmaWxlOiBzcGFuLnVybCAmJiBmaWxlVVJMVG9QYXRoKHNwYW4udXJsKSxcbiAgICAgICAgICAgICAgICAgICAgbGluZVRleHQ6IHNwYW4uY29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgLy8gU2FzcyBsaW5lIG51bWJlcnMgYXJlIDAtYmFzZWQgd2hpbGUgZXNidWlsZCdzIGFyZSAxLWJhc2VkXG4gICAgICAgICAgICAgICAgICAgIGxpbmU6IHNwYW4uc3RhcnQubGluZSArIDEsXG4gICAgICAgICAgICAgICAgICAgIGNvbHVtbjogc3Bhbi5zdGFydC5jb2x1bW4sXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgbm90ZXM6IGRlcHJlY2F0aW9uID8gW3sgdGV4dCB9XSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICAgIGNvbnRlbnRzOiBzb3VyY2VNYXBcbiAgICAgICAgICAgICAgPyBgJHtjc3N9XFxuJHtzb3VyY2VNYXBUb1VybENvbW1lbnQoc291cmNlTWFwLCBkaXJuYW1lKGFyZ3MucGF0aCkpfWBcbiAgICAgICAgICAgICAgOiBjc3MsXG4gICAgICAgICAgICB3YXRjaEZpbGVzOiBsb2FkZWRVcmxzLm1hcCgodXJsKSA9PiBmaWxlVVJMVG9QYXRoKHVybCkpLFxuICAgICAgICAgICAgd2FybmluZ3MsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBpZiAoaXNTYXNzRXhjZXB0aW9uKGVycm9yKSkge1xuICAgICAgICAgICAgY29uc3QgZmlsZSA9IGVycm9yLnNwYW4udXJsID8gZmlsZVVSTFRvUGF0aChlcnJvci5zcGFuLnVybCkgOiB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICAgICAgICAgIGVycm9yczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHRleHQ6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgd2FybmluZ3MsXG4gICAgICAgICAgICAgIHdhdGNoRmlsZXM6IGZpbGUgPyBbZmlsZV0gOiB1bmRlZmluZWQsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBzb3VyY2VNYXBUb1VybENvbW1lbnQoXG4gIHNvdXJjZU1hcDogRXhjbHVkZTxDb21waWxlUmVzdWx0Wydzb3VyY2VNYXAnXSwgdW5kZWZpbmVkPixcbiAgcm9vdDogc3RyaW5nLFxuKTogc3RyaW5nIHtcbiAgLy8gUmVtb3ZlIGBmaWxlYCBwcm90b2NvbCBmcm9tIGFsbCBzb3VyY2VtYXAgc291cmNlcyBhbmQgYWRqdXN0IHRvIGJlIHJlbGF0aXZlIHRvIHRoZSBpbnB1dCBmaWxlLlxuICAvLyBUaGlzIGFsbG93cyBlc2J1aWxkIHRvIGNvcnJlY3RseSBwcm9jZXNzIHRoZSBwYXRocy5cbiAgc291cmNlTWFwLnNvdXJjZXMgPSBzb3VyY2VNYXAuc291cmNlcy5tYXAoKHNvdXJjZSkgPT4gcmVsYXRpdmUocm9vdCwgZmlsZVVSTFRvUGF0aChzb3VyY2UpKSk7XG5cbiAgY29uc3QgdXJsU291cmNlTWFwID0gQnVmZmVyLmZyb20oSlNPTi5zdHJpbmdpZnkoc291cmNlTWFwKSwgJ3V0Zi04JykudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuXG4gIHJldHVybiBgLyojIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTg7YmFzZTY0LCR7dXJsU291cmNlTWFwfSAqL2A7XG59XG4iXX0=