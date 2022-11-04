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
                sassWorkerPool !== null && sassWorkerPool !== void 0 ? sassWorkerPool : (sassWorkerPool = new sass_service_1.SassWorkerImplementation());
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc2Fzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBR0gsK0NBQTRDO0FBQzVDLHlDQUFvRDtBQUNwRCx1Q0FBd0Q7QUFFeEQsMERBR2lDO0FBRWpDLElBQUksY0FBb0QsQ0FBQztBQUV6RCxTQUFTLGVBQWUsQ0FBQyxLQUFjO0lBQ3JDLE9BQU8sQ0FBQyxDQUFDLEtBQUssSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksYUFBYSxJQUFJLEtBQUssQ0FBQztBQUN4RSxDQUFDO0FBRUQsU0FBZ0Isc0JBQXNCO0lBQ3BDLGNBQWMsYUFBZCxjQUFjLHVCQUFkLGNBQWMsQ0FBRSxLQUFLLEVBQUUsQ0FBQztJQUN4QixjQUFjLEdBQUcsU0FBUyxDQUFDO0FBQzdCLENBQUM7QUFIRCx3REFHQztBQUVELFNBQWdCLGdCQUFnQixDQUFDLE9BQXFEO0lBQ3BGLE9BQU87UUFDTCxJQUFJLEVBQUUsY0FBYztRQUNwQixLQUFLLENBQUMsS0FBa0I7WUFDdEIsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7Z0JBQ3BELDZDQUE2QztnQkFDN0MsY0FBYyxhQUFkLGNBQWMsY0FBZCxjQUFjLElBQWQsY0FBYyxHQUFLLElBQUksdUNBQXdCLEVBQUUsRUFBQztnQkFFbEQsTUFBTSxRQUFRLEdBQXFCLEVBQUUsQ0FBQztnQkFDdEMsSUFBSTtvQkFDRixNQUFNLElBQUksR0FBRyxNQUFNLElBQUEsbUJBQVEsRUFBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO29CQUNoRCxNQUFN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LElBQUEsd0JBQWEsRUFBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7d0JBRXhFLE9BQU87NEJBQ0wsTUFBTSxFQUFFLEtBQUs7NEJBQ2IsTUFBTSxFQUFFO2dDQUNOO29DQUNFLElBQUksRUFBRSxLQUFLLENBQUMsT0FBTztpQ0FDcEI7NkJBQ0Y7NEJBQ0QsUUFBUTs0QkFDUixVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO3lCQUN0QyxDQUFDO3FCQUNIO29CQUVELE1BQU0sS0FBSyxDQUFDO2lCQUNiO1lBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUF2SEQsNENBdUhDO0FBRUQsU0FBUyxxQkFBcUIsQ0FDNUIsU0FBeUQsRUFDekQsSUFBWTtJQUVaLGlHQUFpRztJQUNqRyxzREFBc0Q7SUFDdEQsU0FBUyxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsSUFBQSxvQkFBUSxFQUFDLElBQUksRUFBRSxJQUFBLHdCQUFhLEVBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTdGLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFeEYsT0FBTyxtRUFBbUUsWUFBWSxLQUFLLENBQUM7QUFDOUYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IFBhcnRpYWxNZXNzYWdlLCBQbHVnaW4sIFBsdWdpbkJ1aWxkIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgZGlybmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0eXBlIHsgQ29tcGlsZVJlc3VsdCwgRXhjZXB0aW9uIH0gZnJvbSAnc2Fzcyc7XG5pbXBvcnQge1xuICBGaWxlSW1wb3J0ZXJXaXRoUmVxdWVzdENvbnRleHRPcHRpb25zLFxuICBTYXNzV29ya2VySW1wbGVtZW50YXRpb24sXG59IGZyb20gJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlJztcblxubGV0IHNhc3NXb3JrZXJQb29sOiBTYXNzV29ya2VySW1wbGVtZW50YXRpb24gfCB1bmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzU2Fzc0V4Y2VwdGlvbihlcnJvcjogdW5rbm93bik6IGVycm9yIGlzIEV4Y2VwdGlvbiB7XG4gIHJldHVybiAhIWVycm9yICYmIHR5cGVvZiBlcnJvciA9PT0gJ29iamVjdCcgJiYgJ3Nhc3NNZXNzYWdlJyBpbiBlcnJvcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNodXRkb3duU2Fzc1dvcmtlclBvb2woKTogdm9pZCB7XG4gIHNhc3NXb3JrZXJQb29sPy5jbG9zZSgpO1xuICBzYXNzV29ya2VyUG9vbCA9IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNhc3NQbHVnaW4ob3B0aW9uczogeyBzb3VyY2VtYXA6IGJvb2xlYW47IGxvYWRQYXRocz86IHN0cmluZ1tdIH0pOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLXNhc3MnLFxuICAgIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IHZvaWQge1xuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuc1thY11zcyQvIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgIC8vIExhemlseSBsb2FkIFNhc3Mgd2hlbiBhIFNhc3MgZmlsZSBpcyBmb3VuZFxuICAgICAgICBzYXNzV29ya2VyUG9vbCA/Pz0gbmV3IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbigpO1xuXG4gICAgICAgIGNvbnN0IHdhcm5pbmdzOiBQYXJ0aWFsTWVzc2FnZVtdID0gW107XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlYWRGaWxlKGFyZ3MucGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgICAgY29uc3QgeyBjc3MsIHNvdXJjZU1hcCwgbG9hZGVkVXJscyB9ID0gYXdhaXQgc2Fzc1dvcmtlclBvb2wuY29tcGlsZVN0cmluZ0FzeW5jKGRhdGEsIHtcbiAgICAgICAgICAgIHVybDogcGF0aFRvRmlsZVVSTChhcmdzLnBhdGgpLFxuICAgICAgICAgICAgc3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICAgICAgICBsb2FkUGF0aHM6IG9wdGlvbnMubG9hZFBhdGhzLFxuICAgICAgICAgICAgc291cmNlTWFwOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIHNvdXJjZU1hcEluY2x1ZGVTb3VyY2VzOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIHF1aWV0RGVwczogdHJ1ZSxcbiAgICAgICAgICAgIGltcG9ydGVyczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZmluZEZpbGVVcmw6IGFzeW5jIChcbiAgICAgICAgICAgICAgICAgIHVybCxcbiAgICAgICAgICAgICAgICAgIHsgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXMgfTogRmlsZUltcG9ydGVyV2l0aFJlcXVlc3RDb250ZXh0T3B0aW9ucyxcbiAgICAgICAgICAgICAgICApOiBQcm9taXNlPFVSTCB8IG51bGw+ID0+IHtcbiAgICAgICAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCBidWlsZC5yZXNvbHZlKHVybCwge1xuICAgICAgICAgICAgICAgICAgICBraW5kOiAnaW1wb3J0LXJ1bGUnLFxuICAgICAgICAgICAgICAgICAgICAvLyBUaGlzIHNob3VsZCBpZGVhbGx5IGJlIHRoZSBkaXJlY3Rvcnkgb2YgdGhlIGltcG9ydGVyIGZpbGUgZnJvbSBTYXNzXG4gICAgICAgICAgICAgICAgICAgIC8vIGJ1dCB0aGF0IGlzIG5vdCBjdXJyZW50bHkgYXZhaWxhYmxlIGZyb20gdGhlIFNhc3MgaW1wb3J0ZXIgQVBJLlxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlRGlyOiBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyLFxuICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgIC8vIFdvcmthcm91bmQgdG8gc3VwcG9ydCBZYXJuIFBuUCB3aXRob3V0IGFjY2VzcyB0byB0aGUgaW1wb3J0ZXIgZmlsZSBmcm9tIFNhc3NcbiAgICAgICAgICAgICAgICAgIGlmICghcmVzdWx0LnBhdGggJiYgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXM/LnNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBwcmV2aW91cyBvZiBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcykge1xuICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGJ1aWxkLnJlc29sdmUodXJsLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBraW5kOiAnaW1wb3J0LXJ1bGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZURpcjogcHJldmlvdXMsXG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIHBhY2thZ2UgZGVlcCBpbXBvcnRzXG4gICAgICAgICAgICAgICAgICBpZiAoIXJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gdXJsLnNwbGl0KCcvJyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhhc1Njb3BlID0gcGFydHMubGVuZ3RoID4gMiAmJiBwYXJ0c1swXS5zdGFydHNXaXRoKCdAJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChoYXNTY29wZSB8fCBwYXJ0cy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgW25hbWVPclNjb3BlLCBuYW1lT3JGaXJzdFBhdGgsIC4uLnBhdGhQYXJ0XSA9IHBhcnRzO1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhY2thZ2VOYW1lID0gaGFzU2NvcGVcbiAgICAgICAgICAgICAgICAgICAgICAgID8gYCR7bmFtZU9yU2NvcGV9LyR7bmFtZU9yRmlyc3RQYXRofWBcbiAgICAgICAgICAgICAgICAgICAgICAgIDogbmFtZU9yU2NvcGU7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFja2FnZVJlc3VsdCA9IGF3YWl0IGJ1aWxkLnJlc29sdmUocGFja2FnZU5hbWUgKyAnL3BhY2thZ2UuanNvbicsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGtpbmQ6ICdpbXBvcnQtcnVsZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGlzIHNob3VsZCBpZGVhbGx5IGJlIHRoZSBkaXJlY3Rvcnkgb2YgdGhlIGltcG9ydGVyIGZpbGUgZnJvbSBTYXNzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBidXQgdGhhdCBpcyBub3QgY3VycmVudGx5IGF2YWlsYWJsZSBmcm9tIHRoZSBTYXNzIGltcG9ydGVyIEFQSS5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmVEaXI6IGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIsXG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICBpZiAocGFja2FnZVJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGF0aFRvRmlsZVVSTChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgam9pbihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXJuYW1lKHBhY2thZ2VSZXN1bHQucGF0aCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIWhhc1Njb3BlID8gbmFtZU9yRmlyc3RQYXRoIDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLi4ucGF0aFBhcnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0LnBhdGggPyBwYXRoVG9GaWxlVVJMKHJlc3VsdC5wYXRoKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBsb2dnZXI6IHtcbiAgICAgICAgICAgICAgd2FybjogKHRleHQsIHsgZGVwcmVjYXRpb24sIHNwYW4gfSkgPT4ge1xuICAgICAgICAgICAgICAgIHdhcm5pbmdzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgdGV4dDogZGVwcmVjYXRpb24gPyAnRGVwcmVjYXRpb24nIDogdGV4dCxcbiAgICAgICAgICAgICAgICAgIGxvY2F0aW9uOiBzcGFuICYmIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsZTogc3Bhbi51cmwgJiYgZmlsZVVSTFRvUGF0aChzcGFuLnVybCksXG4gICAgICAgICAgICAgICAgICAgIGxpbmVUZXh0OiBzcGFuLmNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgIC8vIFNhc3MgbGluZSBudW1iZXJzIGFyZSAwLWJhc2VkIHdoaWxlIGVzYnVpbGQncyBhcmUgMS1iYXNlZFxuICAgICAgICAgICAgICAgICAgICBsaW5lOiBzcGFuLnN0YXJ0LmxpbmUgKyAxLFxuICAgICAgICAgICAgICAgICAgICBjb2x1bW46IHNwYW4uc3RhcnQuY29sdW1uLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIG5vdGVzOiBkZXByZWNhdGlvbiA/IFt7IHRleHQgfV0gOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICAgICAgICBjb250ZW50czogc291cmNlTWFwXG4gICAgICAgICAgICAgID8gYCR7Y3NzfVxcbiR7c291cmNlTWFwVG9VcmxDb21tZW50KHNvdXJjZU1hcCwgZGlybmFtZShhcmdzLnBhdGgpKX1gXG4gICAgICAgICAgICAgIDogY3NzLFxuICAgICAgICAgICAgd2F0Y2hGaWxlczogbG9hZGVkVXJscy5tYXAoKHVybCkgPT4gZmlsZVVSTFRvUGF0aCh1cmwpKSxcbiAgICAgICAgICAgIHdhcm5pbmdzLFxuICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgaWYgKGlzU2Fzc0V4Y2VwdGlvbihlcnJvcikpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGUgPSBlcnJvci5zcGFuLnVybCA/IGZpbGVVUkxUb1BhdGgoZXJyb3Iuc3Bhbi51cmwpIDogdW5kZWZpbmVkO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB0ZXh0OiBlcnJvci5tZXNzYWdlLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHdhcm5pbmdzLFxuICAgICAgICAgICAgICB3YXRjaEZpbGVzOiBmaWxlID8gW2ZpbGVdIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gc291cmNlTWFwVG9VcmxDb21tZW50KFxuICBzb3VyY2VNYXA6IEV4Y2x1ZGU8Q29tcGlsZVJlc3VsdFsnc291cmNlTWFwJ10sIHVuZGVmaW5lZD4sXG4gIHJvb3Q6IHN0cmluZyxcbik6IHN0cmluZyB7XG4gIC8vIFJlbW92ZSBgZmlsZWAgcHJvdG9jb2wgZnJvbSBhbGwgc291cmNlbWFwIHNvdXJjZXMgYW5kIGFkanVzdCB0byBiZSByZWxhdGl2ZSB0byB0aGUgaW5wdXQgZmlsZS5cbiAgLy8gVGhpcyBhbGxvd3MgZXNidWlsZCB0byBjb3JyZWN0bHkgcHJvY2VzcyB0aGUgcGF0aHMuXG4gIHNvdXJjZU1hcC5zb3VyY2VzID0gc291cmNlTWFwLnNvdXJjZXMubWFwKChzb3VyY2UpID0+IHJlbGF0aXZlKHJvb3QsIGZpbGVVUkxUb1BhdGgoc291cmNlKSkpO1xuXG4gIGNvbnN0IHVybFNvdXJjZU1hcCA9IEJ1ZmZlci5mcm9tKEpTT04uc3RyaW5naWZ5KHNvdXJjZU1hcCksICd1dGYtOCcpLnRvU3RyaW5nKCdiYXNlNjQnKTtcblxuICByZXR1cm4gYC8qIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zi04O2Jhc2U2NCwke3VybFNvdXJjZU1hcH0gKi9gO1xufVxuIl19