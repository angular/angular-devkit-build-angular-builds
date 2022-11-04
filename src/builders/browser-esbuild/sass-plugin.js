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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc2Fzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBR0gsK0NBQTRDO0FBQzVDLHlDQUE4QztBQUM5Qyx1Q0FBd0Q7QUFFeEQsMERBQW1FO0FBRW5FLElBQUksY0FBd0MsQ0FBQztBQUU3QyxTQUFTLGVBQWUsQ0FBQyxLQUFjO0lBQ3JDLE9BQU8sQ0FBQyxDQUFDLEtBQUssSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksYUFBYSxJQUFJLEtBQUssQ0FBQztBQUN4RSxDQUFDO0FBRUQsU0FBZ0Isc0JBQXNCO0lBQ3BDLGNBQWMsYUFBZCxjQUFjLHVCQUFkLGNBQWMsQ0FBRSxLQUFLLEVBQUUsQ0FBQztBQUMxQixDQUFDO0FBRkQsd0RBRUM7QUFFRCxTQUFnQixnQkFBZ0IsQ0FBQyxPQUFxRDtJQUNwRixPQUFPO1FBQ0wsSUFBSSxFQUFFLGNBQWM7UUFDcEIsS0FBSyxDQUFDLEtBQWtCO1lBQ3RCLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFO2dCQUNwRCw2Q0FBNkM7Z0JBQzdDLGNBQWMsYUFBZCxjQUFjLGNBQWQsY0FBYyxJQUFkLGNBQWMsR0FBSyxJQUFJLHVDQUF3QixFQUFFLEVBQUM7Z0JBRWxELE1BQU0sUUFBUSxHQUFxQixFQUFFLENBQUM7Z0JBQ3RDLElBQUk7b0JBQ0YsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFBLG1CQUFRLEVBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztvQkFDaEQsTUFBTSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUs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QUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFeEYsT0FBTyxtRUFBbUUsWUFBWSxLQUFLLENBQUM7QUFDOUYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IFBhcnRpYWxNZXNzYWdlLCBQbHVnaW4sIFBsdWdpbkJ1aWxkIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgZGlybmFtZSwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0eXBlIHsgQ29tcGlsZVJlc3VsdCwgRXhjZXB0aW9uIH0gZnJvbSAnc2Fzcyc7XG5pbXBvcnQgeyBTYXNzV29ya2VySW1wbGVtZW50YXRpb24gfSBmcm9tICcuLi8uLi9zYXNzL3Nhc3Mtc2VydmljZSc7XG5cbmxldCBzYXNzV29ya2VyUG9vbDogU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uO1xuXG5mdW5jdGlvbiBpc1Nhc3NFeGNlcHRpb24oZXJyb3I6IHVua25vd24pOiBlcnJvciBpcyBFeGNlcHRpb24ge1xuICByZXR1cm4gISFlcnJvciAmJiB0eXBlb2YgZXJyb3IgPT09ICdvYmplY3QnICYmICdzYXNzTWVzc2FnZScgaW4gZXJyb3I7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaHV0ZG93blNhc3NXb3JrZXJQb29sKCk6IHZvaWQge1xuICBzYXNzV29ya2VyUG9vbD8uY2xvc2UoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNhc3NQbHVnaW4ob3B0aW9uczogeyBzb3VyY2VtYXA6IGJvb2xlYW47IGxvYWRQYXRocz86IHN0cmluZ1tdIH0pOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLXNhc3MnLFxuICAgIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IHZvaWQge1xuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuc1thY11zcyQvIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgIC8vIExhemlseSBsb2FkIFNhc3Mgd2hlbiBhIFNhc3MgZmlsZSBpcyBmb3VuZFxuICAgICAgICBzYXNzV29ya2VyUG9vbCA/Pz0gbmV3IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbigpO1xuXG4gICAgICAgIGNvbnN0IHdhcm5pbmdzOiBQYXJ0aWFsTWVzc2FnZVtdID0gW107XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlYWRGaWxlKGFyZ3MucGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgICAgY29uc3QgeyBjc3MsIHNvdXJjZU1hcCwgbG9hZGVkVXJscyB9ID0gYXdhaXQgc2Fzc1dvcmtlclBvb2wuY29tcGlsZVN0cmluZ0FzeW5jKGRhdGEsIHtcbiAgICAgICAgICAgIHVybDogcGF0aFRvRmlsZVVSTChhcmdzLnBhdGgpLFxuICAgICAgICAgICAgc3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICAgICAgICBsb2FkUGF0aHM6IG9wdGlvbnMubG9hZFBhdGhzLFxuICAgICAgICAgICAgc291cmNlTWFwOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIHNvdXJjZU1hcEluY2x1ZGVTb3VyY2VzOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIHF1aWV0RGVwczogdHJ1ZSxcbiAgICAgICAgICAgIGxvZ2dlcjoge1xuICAgICAgICAgICAgICB3YXJuOiAodGV4dCwgeyBkZXByZWNhdGlvbiwgc3BhbiB9KSA9PiB7XG4gICAgICAgICAgICAgICAgd2FybmluZ3MucHVzaCh7XG4gICAgICAgICAgICAgICAgICB0ZXh0OiBkZXByZWNhdGlvbiA/ICdEZXByZWNhdGlvbicgOiB0ZXh0LFxuICAgICAgICAgICAgICAgICAgbG9jYXRpb246IHNwYW4gJiYge1xuICAgICAgICAgICAgICAgICAgICBmaWxlOiBzcGFuLnVybCAmJiBmaWxlVVJMVG9QYXRoKHNwYW4udXJsKSxcbiAgICAgICAgICAgICAgICAgICAgbGluZVRleHQ6IHNwYW4uY29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgLy8gU2FzcyBsaW5lIG51bWJlcnMgYXJlIDAtYmFzZWQgd2hpbGUgZXNidWlsZCdzIGFyZSAxLWJhc2VkXG4gICAgICAgICAgICAgICAgICAgIGxpbmU6IHNwYW4uc3RhcnQubGluZSArIDEsXG4gICAgICAgICAgICAgICAgICAgIGNvbHVtbjogc3Bhbi5zdGFydC5jb2x1bW4sXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgbm90ZXM6IGRlcHJlY2F0aW9uID8gW3sgdGV4dCB9XSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICAgIGNvbnRlbnRzOiBzb3VyY2VNYXBcbiAgICAgICAgICAgICAgPyBgJHtjc3N9XFxuJHtzb3VyY2VNYXBUb1VybENvbW1lbnQoc291cmNlTWFwLCBkaXJuYW1lKGFyZ3MucGF0aCkpfWBcbiAgICAgICAgICAgICAgOiBjc3MsXG4gICAgICAgICAgICB3YXRjaEZpbGVzOiBsb2FkZWRVcmxzLm1hcCgodXJsKSA9PiBmaWxlVVJMVG9QYXRoKHVybCkpLFxuICAgICAgICAgICAgd2FybmluZ3MsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBpZiAoaXNTYXNzRXhjZXB0aW9uKGVycm9yKSkge1xuICAgICAgICAgICAgY29uc3QgZmlsZSA9IGVycm9yLnNwYW4udXJsID8gZmlsZVVSTFRvUGF0aChlcnJvci5zcGFuLnVybCkgOiB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICAgICAgICAgIGVycm9yczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHRleHQ6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgd2FybmluZ3MsXG4gICAgICAgICAgICAgIHdhdGNoRmlsZXM6IGZpbGUgPyBbZmlsZV0gOiB1bmRlZmluZWQsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBzb3VyY2VNYXBUb1VybENvbW1lbnQoXG4gIHNvdXJjZU1hcDogRXhjbHVkZTxDb21waWxlUmVzdWx0Wydzb3VyY2VNYXAnXSwgdW5kZWZpbmVkPixcbiAgcm9vdDogc3RyaW5nLFxuKTogc3RyaW5nIHtcbiAgLy8gUmVtb3ZlIGBmaWxlYCBwcm90b2NvbCBmcm9tIGFsbCBzb3VyY2VtYXAgc291cmNlcyBhbmQgYWRqdXN0IHRvIGJlIHJlbGF0aXZlIHRvIHRoZSBpbnB1dCBmaWxlLlxuICAvLyBUaGlzIGFsbG93cyBlc2J1aWxkIHRvIGNvcnJlY3RseSBwcm9jZXNzIHRoZSBwYXRocy5cbiAgc291cmNlTWFwLnNvdXJjZXMgPSBzb3VyY2VNYXAuc291cmNlcy5tYXAoKHNvdXJjZSkgPT4gcmVsYXRpdmUocm9vdCwgZmlsZVVSTFRvUGF0aChzb3VyY2UpKSk7XG5cbiAgY29uc3QgdXJsU291cmNlTWFwID0gQnVmZmVyLmZyb20oSlNPTi5zdHJpbmdpZnkoc291cmNlTWFwKSwgJ3V0Zi04JykudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuXG4gIHJldHVybiBgLyojIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTg7YmFzZTY0LCR7dXJsU291cmNlTWFwfSAqL2A7XG59XG4iXX0=