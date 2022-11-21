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
            const resolveUrl = async (url, previousResolvedModules) => {
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
                        if (result.path) {
                            break;
                        }
                    }
                }
                return result;
            };
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
                                    const result = await resolveUrl(url, previousResolvedModules);
                                    // Check for package deep imports
                                    if (!result.path) {
                                        const parts = url.split('/');
                                        const hasScope = parts.length >= 2 && parts[0].startsWith('@');
                                        const [nameOrScope, nameOrFirstPath, ...pathPart] = parts;
                                        const packageName = hasScope
                                            ? `${nameOrScope}/${nameOrFirstPath}`
                                            : nameOrScope;
                                        const packageResult = await resolveUrl(packageName + '/package.json', previousResolvedModules);
                                        if (packageResult.path) {
                                            return (0, node_url_1.pathToFileURL)((0, node_path_1.join)((0, node_path_1.dirname)(packageResult.path), !hasScope ? nameOrFirstPath : '', ...pathPart));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc2Fzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBR0gsK0NBQTRDO0FBQzVDLHlDQUFvRDtBQUNwRCx1Q0FBd0Q7QUFFeEQsMERBR2lDO0FBRWpDLElBQUksY0FBb0QsQ0FBQztBQUV6RCxTQUFTLGVBQWUsQ0FBQyxLQUFjO0lBQ3JDLE9BQU8sQ0FBQyxDQUFDLEtBQUssSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksYUFBYSxJQUFJLEtBQUssQ0FBQztBQUN4RSxDQUFDO0FBRUQsU0FBZ0Isc0JBQXNCO0lBQ3BDLGNBQWMsYUFBZCxjQUFjLHVCQUFkLGNBQWMsQ0FBRSxLQUFLLEVBQUUsQ0FBQztJQUN4QixjQUFjLEdBQUcsU0FBUyxDQUFDO0FBQzdCLENBQUM7QUFIRCx3REFHQztBQUVELFNBQWdCLGdCQUFnQixDQUFDLE9BQXFEO0lBQ3BGLE9BQU87UUFDTCxJQUFJLEVBQUUsY0FBYztRQUNwQixLQUFLLENBQUMsS0FBa0I7WUFDdEIsTUFBTSxVQUFVLEdBQUcsS0FBSyxFQUFFLEdBQVcsRUFBRSx1QkFBcUMsRUFBRSxFQUFFO2dCQUM5RSxJQUFJLE1BQU0sR0FBRyxNQUFNLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFO29CQUNwQyxJQUFJLEVBQUUsYUFBYTtvQkFDbkIsc0VBQXNFO29CQUN0RSxrRUFBa0U7b0JBQ2xFLFVBQVUsRUFBRSxLQUFLLENBQUMsY0FBYyxDQUFDLGFBQWE7aUJBQy9DLENBQUMsQ0FBQztnQkFFSCwrRUFBK0U7Z0JBQy9FLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFJLHVCQUF1QixhQUF2Qix1QkFBdUIsdUJB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QkFDMUIsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUEsd0JBQWEsRUFBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7d0JBRXhFLE9BQU87NEJBQ0wsTUFBTSxFQUFFLEtBQUs7NEJBQ2IsTUFBTSxFQUFFO2dDQUNOO29DQUNFLElBQUksRUFBRSxLQUFLLENBQUMsT0FBTztpQ0FDcEI7NkJBQ0Y7NEJBQ0QsUUFBUTs0QkFDUixVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO3lCQUN0QyxDQUFDO3FCQUNIO29CQUVELE1BQU0sS0FBSyxDQUFDO2lCQUNiO1lBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUE3SEQsNENBNkhDO0FBRUQsU0FBUyxxQkFBcUIsQ0FDNUIsU0FBeUQsRUFDekQsSUFBWTtJQUVaLGlHQUFpRztJQUNqRyxzREFBc0Q7SUFDdEQsU0FBUyxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsSUFBQSxvQkFBUSxFQUFDLElBQUksRUFBRSxJQUFBLHdCQUFhLEVBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTdGLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFeEYsT0FBTyxtRUFBbUUsWUFBWSxLQUFLLENBQUM7QUFDOUYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IFBhcnRpYWxNZXNzYWdlLCBQbHVnaW4sIFBsdWdpbkJ1aWxkIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgZGlybmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0eXBlIHsgQ29tcGlsZVJlc3VsdCwgRXhjZXB0aW9uIH0gZnJvbSAnc2Fzcyc7XG5pbXBvcnQge1xuICBGaWxlSW1wb3J0ZXJXaXRoUmVxdWVzdENvbnRleHRPcHRpb25zLFxuICBTYXNzV29ya2VySW1wbGVtZW50YXRpb24sXG59IGZyb20gJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlJztcblxubGV0IHNhc3NXb3JrZXJQb29sOiBTYXNzV29ya2VySW1wbGVtZW50YXRpb24gfCB1bmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzU2Fzc0V4Y2VwdGlvbihlcnJvcjogdW5rbm93bik6IGVycm9yIGlzIEV4Y2VwdGlvbiB7XG4gIHJldHVybiAhIWVycm9yICYmIHR5cGVvZiBlcnJvciA9PT0gJ29iamVjdCcgJiYgJ3Nhc3NNZXNzYWdlJyBpbiBlcnJvcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNodXRkb3duU2Fzc1dvcmtlclBvb2woKTogdm9pZCB7XG4gIHNhc3NXb3JrZXJQb29sPy5jbG9zZSgpO1xuICBzYXNzV29ya2VyUG9vbCA9IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNhc3NQbHVnaW4ob3B0aW9uczogeyBzb3VyY2VtYXA6IGJvb2xlYW47IGxvYWRQYXRocz86IHN0cmluZ1tdIH0pOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLXNhc3MnLFxuICAgIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IHZvaWQge1xuICAgICAgY29uc3QgcmVzb2x2ZVVybCA9IGFzeW5jICh1cmw6IHN0cmluZywgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXM/OiBTZXQ8c3RyaW5nPikgPT4ge1xuICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZSh1cmwsIHtcbiAgICAgICAgICBraW5kOiAnaW1wb3J0LXJ1bGUnLFxuICAgICAgICAgIC8vIFRoaXMgc2hvdWxkIGlkZWFsbHkgYmUgdGhlIGRpcmVjdG9yeSBvZiB0aGUgaW1wb3J0ZXIgZmlsZSBmcm9tIFNhc3NcbiAgICAgICAgICAvLyBidXQgdGhhdCBpcyBub3QgY3VycmVudGx5IGF2YWlsYWJsZSBmcm9tIHRoZSBTYXNzIGltcG9ydGVyIEFQSS5cbiAgICAgICAgICByZXNvbHZlRGlyOiBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBXb3JrYXJvdW5kIHRvIHN1cHBvcnQgWWFybiBQblAgd2l0aG91dCBhY2Nlc3MgdG8gdGhlIGltcG9ydGVyIGZpbGUgZnJvbSBTYXNzXG4gICAgICAgIGlmICghcmVzdWx0LnBhdGggJiYgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXM/LnNpemUpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHByZXZpb3VzIG9mIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBidWlsZC5yZXNvbHZlKHVybCwge1xuICAgICAgICAgICAgICBraW5kOiAnaW1wb3J0LXJ1bGUnLFxuICAgICAgICAgICAgICByZXNvbHZlRGlyOiBwcmV2aW91cyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKHJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9O1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5zW2FjXXNzJC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgLy8gTGF6aWx5IGxvYWQgU2FzcyB3aGVuIGEgU2FzcyBmaWxlIGlzIGZvdW5kXG4gICAgICAgIHNhc3NXb3JrZXJQb29sID8/PSBuZXcgU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uKHRydWUpO1xuXG4gICAgICAgIGNvbnN0IHdhcm5pbmdzOiBQYXJ0aWFsTWVzc2FnZVtdID0gW107XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlYWRGaWxlKGFyZ3MucGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgICAgY29uc3QgeyBjc3MsIHNvdXJjZU1hcCwgbG9hZGVkVXJscyB9ID0gYXdhaXQgc2Fzc1dvcmtlclBvb2wuY29tcGlsZVN0cmluZ0FzeW5jKGRhdGEsIHtcbiAgICAgICAgICAgIHVybDogcGF0aFRvRmlsZVVSTChhcmdzLnBhdGgpLFxuICAgICAgICAgICAgc3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICAgICAgICBsb2FkUGF0aHM6IG9wdGlvbnMubG9hZFBhdGhzLFxuICAgICAgICAgICAgc291cmNlTWFwOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIHNvdXJjZU1hcEluY2x1ZGVTb3VyY2VzOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIHF1aWV0RGVwczogdHJ1ZSxcbiAgICAgICAgICAgIGltcG9ydGVyczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZmluZEZpbGVVcmw6IGFzeW5jIChcbiAgICAgICAgICAgICAgICAgIHVybCxcbiAgICAgICAgICAgICAgICAgIHsgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXMgfTogRmlsZUltcG9ydGVyV2l0aFJlcXVlc3RDb250ZXh0T3B0aW9ucyxcbiAgICAgICAgICAgICAgICApOiBQcm9taXNlPFVSTCB8IG51bGw+ID0+IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc29sdmVVcmwodXJsLCBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcyk7XG5cbiAgICAgICAgICAgICAgICAgIC8vIENoZWNrIGZvciBwYWNrYWdlIGRlZXAgaW1wb3J0c1xuICAgICAgICAgICAgICAgICAgaWYgKCFyZXN1bHQucGF0aCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IHVybC5zcGxpdCgnLycpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoYXNTY29wZSA9IHBhcnRzLmxlbmd0aCA+PSAyICYmIHBhcnRzWzBdLnN0YXJ0c1dpdGgoJ0AnKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgW25hbWVPclNjb3BlLCBuYW1lT3JGaXJzdFBhdGgsIC4uLnBhdGhQYXJ0XSA9IHBhcnRzO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYWNrYWdlTmFtZSA9IGhhc1Njb3BlXG4gICAgICAgICAgICAgICAgICAgICAgPyBgJHtuYW1lT3JTY29wZX0vJHtuYW1lT3JGaXJzdFBhdGh9YFxuICAgICAgICAgICAgICAgICAgICAgIDogbmFtZU9yU2NvcGU7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFja2FnZVJlc3VsdCA9IGF3YWl0IHJlc29sdmVVcmwoXG4gICAgICAgICAgICAgICAgICAgICAgcGFja2FnZU5hbWUgKyAnL3BhY2thZ2UuanNvbicsXG4gICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXMsXG4gICAgICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHBhY2thZ2VSZXN1bHQucGF0aCkge1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKFxuICAgICAgICAgICAgICAgICAgICAgICAgam9pbihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZGlybmFtZShwYWNrYWdlUmVzdWx0LnBhdGgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAhaGFzU2NvcGUgPyBuYW1lT3JGaXJzdFBhdGggOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLi4ucGF0aFBhcnQsXG4gICAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC5wYXRoID8gcGF0aFRvRmlsZVVSTChyZXN1bHQucGF0aCkgOiBudWxsO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgbG9nZ2VyOiB7XG4gICAgICAgICAgICAgIHdhcm46ICh0ZXh0LCB7IGRlcHJlY2F0aW9uLCBzcGFuIH0pID0+IHtcbiAgICAgICAgICAgICAgICB3YXJuaW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgIHRleHQ6IGRlcHJlY2F0aW9uID8gJ0RlcHJlY2F0aW9uJyA6IHRleHQsXG4gICAgICAgICAgICAgICAgICBsb2NhdGlvbjogc3BhbiAmJiB7XG4gICAgICAgICAgICAgICAgICAgIGZpbGU6IHNwYW4udXJsICYmIGZpbGVVUkxUb1BhdGgoc3Bhbi51cmwpLFxuICAgICAgICAgICAgICAgICAgICBsaW5lVGV4dDogc3Bhbi5jb250ZXh0LFxuICAgICAgICAgICAgICAgICAgICAvLyBTYXNzIGxpbmUgbnVtYmVycyBhcmUgMC1iYXNlZCB3aGlsZSBlc2J1aWxkJ3MgYXJlIDEtYmFzZWRcbiAgICAgICAgICAgICAgICAgICAgbGluZTogc3Bhbi5zdGFydC5saW5lICsgMSxcbiAgICAgICAgICAgICAgICAgICAgY29sdW1uOiBzcGFuLnN0YXJ0LmNvbHVtbixcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBub3RlczogZGVwcmVjYXRpb24gPyBbeyB0ZXh0IH1dIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgICAgICAgY29udGVudHM6IHNvdXJjZU1hcFxuICAgICAgICAgICAgICA/IGAke2Nzc31cXG4ke3NvdXJjZU1hcFRvVXJsQ29tbWVudChzb3VyY2VNYXAsIGRpcm5hbWUoYXJncy5wYXRoKSl9YFxuICAgICAgICAgICAgICA6IGNzcyxcbiAgICAgICAgICAgIHdhdGNoRmlsZXM6IGxvYWRlZFVybHMubWFwKCh1cmwpID0+IGZpbGVVUkxUb1BhdGgodXJsKSksXG4gICAgICAgICAgICB3YXJuaW5ncyxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGlmIChpc1Nhc3NFeGNlcHRpb24oZXJyb3IpKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlID0gZXJyb3Iuc3Bhbi51cmwgPyBmaWxlVVJMVG9QYXRoKGVycm9yLnNwYW4udXJsKSA6IHVuZGVmaW5lZDtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgdGV4dDogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB3YXJuaW5ncyxcbiAgICAgICAgICAgICAgd2F0Y2hGaWxlczogZmlsZSA/IFtmaWxlXSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIHNvdXJjZU1hcFRvVXJsQ29tbWVudChcbiAgc291cmNlTWFwOiBFeGNsdWRlPENvbXBpbGVSZXN1bHRbJ3NvdXJjZU1hcCddLCB1bmRlZmluZWQ+LFxuICByb290OiBzdHJpbmcsXG4pOiBzdHJpbmcge1xuICAvLyBSZW1vdmUgYGZpbGVgIHByb3RvY29sIGZyb20gYWxsIHNvdXJjZW1hcCBzb3VyY2VzIGFuZCBhZGp1c3QgdG8gYmUgcmVsYXRpdmUgdG8gdGhlIGlucHV0IGZpbGUuXG4gIC8vIFRoaXMgYWxsb3dzIGVzYnVpbGQgdG8gY29ycmVjdGx5IHByb2Nlc3MgdGhlIHBhdGhzLlxuICBzb3VyY2VNYXAuc291cmNlcyA9IHNvdXJjZU1hcC5zb3VyY2VzLm1hcCgoc291cmNlKSA9PiByZWxhdGl2ZShyb290LCBmaWxlVVJMVG9QYXRoKHNvdXJjZSkpKTtcblxuICBjb25zdCB1cmxTb3VyY2VNYXAgPSBCdWZmZXIuZnJvbShKU09OLnN0cmluZ2lmeShzb3VyY2VNYXApLCAndXRmLTgnKS50b1N0cmluZygnYmFzZTY0Jyk7XG5cbiAgcmV0dXJuIGAvKiMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD11dGYtODtiYXNlNjQsJHt1cmxTb3VyY2VNYXB9ICovYDtcbn1cbiJdfQ==