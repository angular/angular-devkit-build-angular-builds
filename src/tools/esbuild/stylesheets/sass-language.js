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
let sassWorkerPoolPromise;
function isSassException(error) {
    return !!error && typeof error === 'object' && 'sassMessage' in error;
}
function shutdownSassWorkerPool() {
    if (sassWorkerPool) {
        sassWorkerPool.close();
        sassWorkerPool = undefined;
    }
    else if (sassWorkerPoolPromise) {
        void sassWorkerPoolPromise.then(shutdownSassWorkerPool);
    }
    sassWorkerPoolPromise = undefined;
}
exports.shutdownSassWorkerPool = shutdownSassWorkerPool;
exports.SassStylesheetLanguage = Object.freeze({
    name: 'sass',
    componentFilter: /^s[ac]ss;/,
    fileFilter: /\.s[ac]ss$/,
    process(data, file, format, options, build) {
        const syntax = format === 'sass' ? 'indented' : 'scss';
        const resolveUrl = async (url, options) => {
            let resolveDir = build.initialOptions.absWorkingDir;
            if (options.containingUrl) {
                resolveDir = (0, node_path_1.dirname)((0, node_url_1.fileURLToPath)(options.containingUrl));
            }
            const result = await build.resolve(url, {
                kind: 'import-rule',
                resolveDir,
            });
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
        if (sassWorkerPoolPromise === undefined) {
            sassWorkerPoolPromise = Promise.resolve().then(() => __importStar(require('../../sass/sass-service'))).then((sassService) => new sassService.SassWorkerImplementation(true));
        }
        sassWorkerPool = await sassWorkerPoolPromise;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1sYW5ndWFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvc3R5bGVzaGVldHMvc2Fzcy1sYW5ndWFnZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILHlDQUFvRDtBQUNwRCx1Q0FBd0Q7QUFLeEQsSUFBSSxjQUFvRCxDQUFDO0FBQ3pELElBQUkscUJBQW9FLENBQUM7QUFFekUsU0FBUyxlQUFlLENBQUMsS0FBYztJQUNyQyxPQUFPLENBQUMsQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLGFBQWEsSUFBSSxLQUFLLENBQUM7QUFDeEUsQ0FBQztBQUVELFNBQWdCLHNCQUFzQjtJQUNwQyxJQUFJLGNBQWMsRUFBRTtRQUNsQixjQUFjLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDdkIsY0FBYyxHQUFHLFNBQVMsQ0FBQztLQUM1QjtTQUFNLElBQUkscUJBQXFCLEVBQUU7UUFDaEMsS0FBSyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsQ0FBQztLQUN6RDtJQUNELHFCQUFxQixHQUFHLFNBQVMsQ0FBQztBQUNwQyxDQUFDO0FBUkQsd0RBUUM7QUFFWSxRQUFBLHNCQUFzQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQXFCO0lBQ3RFLElBQUksRUFBRSxNQUFNO0lBQ1osZUFBZSxFQUFFLFdBQVc7SUFDNUIsVUFBVSxFQUFFLFlBQVk7SUFDeEIsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxLQUFLO1FBQ3hDLE1BQU0sTUFBTSxHQUFHLE1BQU0sS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsTUFB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UUFBUSxDQUFDLENBQUM7SUFFeEYsT0FBTyxtRUFBbUUsWUFBWSxLQUFLLENBQUM7QUFDOUYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE9uTG9hZFJlc3VsdCwgUGFydGlhbE1lc3NhZ2UsIFJlc29sdmVSZXN1bHQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IGRpcm5hbWUsIGpvaW4sIHJlbGF0aXZlIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgdHlwZSB7IENhbm9uaWNhbGl6ZUNvbnRleHQsIENvbXBpbGVSZXN1bHQsIEV4Y2VwdGlvbiwgU3ludGF4IH0gZnJvbSAnc2Fzcyc7XG5pbXBvcnQgdHlwZSB7IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbiB9IGZyb20gJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlJztcbmltcG9ydCB7IFN0eWxlc2hlZXRMYW5ndWFnZSwgU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMgfSBmcm9tICcuL3N0eWxlc2hlZXQtcGx1Z2luLWZhY3RvcnknO1xuXG5sZXQgc2Fzc1dvcmtlclBvb2w6IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbiB8IHVuZGVmaW5lZDtcbmxldCBzYXNzV29ya2VyUG9vbFByb21pc2U6IFByb21pc2U8U2Fzc1dvcmtlckltcGxlbWVudGF0aW9uPiB8IHVuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNTYXNzRXhjZXB0aW9uKGVycm9yOiB1bmtub3duKTogZXJyb3IgaXMgRXhjZXB0aW9uIHtcbiAgcmV0dXJuICEhZXJyb3IgJiYgdHlwZW9mIGVycm9yID09PSAnb2JqZWN0JyAmJiAnc2Fzc01lc3NhZ2UnIGluIGVycm9yO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2h1dGRvd25TYXNzV29ya2VyUG9vbCgpOiB2b2lkIHtcbiAgaWYgKHNhc3NXb3JrZXJQb29sKSB7XG4gICAgc2Fzc1dvcmtlclBvb2wuY2xvc2UoKTtcbiAgICBzYXNzV29ya2VyUG9vbCA9IHVuZGVmaW5lZDtcbiAgfSBlbHNlIGlmIChzYXNzV29ya2VyUG9vbFByb21pc2UpIHtcbiAgICB2b2lkIHNhc3NXb3JrZXJQb29sUHJvbWlzZS50aGVuKHNodXRkb3duU2Fzc1dvcmtlclBvb2wpO1xuICB9XG4gIHNhc3NXb3JrZXJQb29sUHJvbWlzZSA9IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGNvbnN0IFNhc3NTdHlsZXNoZWV0TGFuZ3VhZ2UgPSBPYmplY3QuZnJlZXplPFN0eWxlc2hlZXRMYW5ndWFnZT4oe1xuICBuYW1lOiAnc2FzcycsXG4gIGNvbXBvbmVudEZpbHRlcjogL15zW2FjXXNzOy8sXG4gIGZpbGVGaWx0ZXI6IC9cXC5zW2FjXXNzJC8sXG4gIHByb2Nlc3MoZGF0YSwgZmlsZSwgZm9ybWF0LCBvcHRpb25zLCBidWlsZCkge1xuICAgIGNvbnN0IHN5bnRheCA9IGZvcm1hdCA9PT0gJ3Nhc3MnID8gJ2luZGVudGVkJyA6ICdzY3NzJztcbiAgICBjb25zdCByZXNvbHZlVXJsID0gYXN5bmMgKHVybDogc3RyaW5nLCBvcHRpb25zOiBDYW5vbmljYWxpemVDb250ZXh0KSA9PiB7XG4gICAgICBsZXQgcmVzb2x2ZURpciA9IGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXI7XG4gICAgICBpZiAob3B0aW9ucy5jb250YWluaW5nVXJsKSB7XG4gICAgICAgIHJlc29sdmVEaXIgPSBkaXJuYW1lKGZpbGVVUkxUb1BhdGgob3B0aW9ucy5jb250YWluaW5nVXJsKSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJ1aWxkLnJlc29sdmUodXJsLCB7XG4gICAgICAgIGtpbmQ6ICdpbXBvcnQtcnVsZScsXG4gICAgICAgIHJlc29sdmVEaXIsXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGNvbXBpbGVTdHJpbmcoZGF0YSwgZmlsZSwgc3ludGF4LCBvcHRpb25zLCByZXNvbHZlVXJsKTtcbiAgfSxcbn0pO1xuXG5mdW5jdGlvbiBwYXJzZVBhY2thZ2VOYW1lKHVybDogc3RyaW5nKTogeyBwYWNrYWdlTmFtZTogc3RyaW5nOyByZWFkb25seSBwYXRoU2VnbWVudHM6IHN0cmluZ1tdIH0ge1xuICBjb25zdCBwYXJ0cyA9IHVybC5zcGxpdCgnLycpO1xuICBjb25zdCBoYXNTY29wZSA9IHBhcnRzLmxlbmd0aCA+PSAyICYmIHBhcnRzWzBdLnN0YXJ0c1dpdGgoJ0AnKTtcbiAgY29uc3QgW25hbWVPclNjb3BlLCBuYW1lT3JGaXJzdFBhdGgsIC4uLnBhdGhQYXJ0XSA9IHBhcnRzO1xuICBjb25zdCBwYWNrYWdlTmFtZSA9IGhhc1Njb3BlID8gYCR7bmFtZU9yU2NvcGV9LyR7bmFtZU9yRmlyc3RQYXRofWAgOiBuYW1lT3JTY29wZTtcblxuICByZXR1cm4ge1xuICAgIHBhY2thZ2VOYW1lLFxuICAgIGdldCBwYXRoU2VnbWVudHMoKSB7XG4gICAgICByZXR1cm4gIWhhc1Njb3BlICYmIG5hbWVPckZpcnN0UGF0aCA/IFtuYW1lT3JGaXJzdFBhdGgsIC4uLnBhdGhQYXJ0XSA6IHBhdGhQYXJ0O1xuICAgIH0sXG4gIH07XG59XG5cbmNsYXNzIENhY2hlPEssIFY+IGV4dGVuZHMgTWFwPEssIFY+IHtcbiAgYXN5bmMgZ2V0T3JDcmVhdGUoa2V5OiBLLCBjcmVhdG9yOiAoKSA9PiBWIHwgUHJvbWlzZTxWPik6IFByb21pc2U8Vj4ge1xuICAgIGxldCB2YWx1ZSA9IHRoaXMuZ2V0KGtleSk7XG5cbiAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFsdWUgPSBhd2FpdCBjcmVhdG9yKCk7XG4gICAgICB0aGlzLnNldChrZXksIHZhbHVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY29tcGlsZVN0cmluZyhcbiAgZGF0YTogc3RyaW5nLFxuICBmaWxlUGF0aDogc3RyaW5nLFxuICBzeW50YXg6IFN5bnRheCxcbiAgb3B0aW9uczogU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMsXG4gIHJlc29sdmVVcmw6ICh1cmw6IHN0cmluZywgb3B0aW9uczogQ2Fub25pY2FsaXplQ29udGV4dCkgPT4gUHJvbWlzZTxSZXNvbHZlUmVzdWx0Pixcbik6IFByb21pc2U8T25Mb2FkUmVzdWx0PiB7XG4gIC8vIExhemlseSBsb2FkIFNhc3Mgd2hlbiBhIFNhc3MgZmlsZSBpcyBmb3VuZFxuICBpZiAoc2Fzc1dvcmtlclBvb2wgPT09IHVuZGVmaW5lZCkge1xuICAgIGlmIChzYXNzV29ya2VyUG9vbFByb21pc2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgc2Fzc1dvcmtlclBvb2xQcm9taXNlID0gaW1wb3J0KCcuLi8uLi9zYXNzL3Nhc3Mtc2VydmljZScpLnRoZW4oXG4gICAgICAgIChzYXNzU2VydmljZSkgPT4gbmV3IHNhc3NTZXJ2aWNlLlNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbih0cnVlKSxcbiAgICAgICk7XG4gICAgfVxuICAgIHNhc3NXb3JrZXJQb29sID0gYXdhaXQgc2Fzc1dvcmtlclBvb2xQcm9taXNlO1xuICB9XG5cbiAgLy8gQ2FjaGUgaXMgY3VycmVudGx5IGxvY2FsIHRvIGluZGl2aWR1YWwgY29tcGlsZSByZXF1ZXN0cy5cbiAgLy8gQ2FjaGluZyBmb2xsb3dzIFNhc3MgYmVoYXZpb3Igd2hlcmUgYSBnaXZlbiB1cmwgd2lsbCBhbHdheXMgcmVzb2x2ZSB0byB0aGUgc2FtZSB2YWx1ZVxuICAvLyByZWdhcmRsZXNzIG9mIGl0cyBpbXBvcnRlcidzIHBhdGguXG4gIC8vIEEgbnVsbCB2YWx1ZSBpbmRpY2F0ZXMgdGhhdCB0aGUgY2FjaGVkIHJlc29sdXRpb24gYXR0ZW1wdCBmYWlsZWQgdG8gZmluZCBhIGxvY2F0aW9uIGFuZFxuICAvLyBsYXRlciBzdGFnZSByZXNvbHV0aW9uIHNob3VsZCBiZSBhdHRlbXB0ZWQuIFRoaXMgYXZvaWRzIHBvdGVudGlhbGx5IGV4cGVuc2l2ZSByZXBlYXRcbiAgLy8gZmFpbGluZyByZXNvbHV0aW9uIGF0dGVtcHRzLlxuICBjb25zdCByZXNvbHV0aW9uQ2FjaGUgPSBuZXcgQ2FjaGU8c3RyaW5nLCBVUkwgfCBudWxsPigpO1xuICBjb25zdCBwYWNrYWdlUm9vdENhY2hlID0gbmV3IENhY2hlPHN0cmluZywgc3RyaW5nIHwgbnVsbD4oKTtcblxuICBjb25zdCB3YXJuaW5nczogUGFydGlhbE1lc3NhZ2VbXSA9IFtdO1xuICB0cnkge1xuICAgIGNvbnN0IHsgY3NzLCBzb3VyY2VNYXAsIGxvYWRlZFVybHMgfSA9IGF3YWl0IHNhc3NXb3JrZXJQb29sLmNvbXBpbGVTdHJpbmdBc3luYyhkYXRhLCB7XG4gICAgICB1cmw6IHBhdGhUb0ZpbGVVUkwoZmlsZVBhdGgpLFxuICAgICAgc3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICBzeW50YXgsXG4gICAgICBsb2FkUGF0aHM6IG9wdGlvbnMuaW5jbHVkZVBhdGhzLFxuICAgICAgc291cmNlTWFwOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgIHNvdXJjZU1hcEluY2x1ZGVTb3VyY2VzOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgIHF1aWV0RGVwczogdHJ1ZSxcbiAgICAgIGltcG9ydGVyczogW1xuICAgICAgICB7XG4gICAgICAgICAgZmluZEZpbGVVcmw6ICh1cmwsIG9wdGlvbnMpID0+XG4gICAgICAgICAgICByZXNvbHV0aW9uQ2FjaGUuZ2V0T3JDcmVhdGUodXJsLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc29sdmVVcmwodXJsLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgaWYgKHJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhdGhUb0ZpbGVVUkwocmVzdWx0LnBhdGgpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIHBhY2thZ2UgZGVlcCBpbXBvcnRzXG4gICAgICAgICAgICAgIGNvbnN0IHsgcGFja2FnZU5hbWUsIHBhdGhTZWdtZW50cyB9ID0gcGFyc2VQYWNrYWdlTmFtZSh1cmwpO1xuXG4gICAgICAgICAgICAgIC8vIENhY2hpbmcgcGFja2FnZSByb290IGxvY2F0aW9ucyBpcyBwYXJ0aWN1bGFybHkgYmVuZWZpY2lhbCBmb3IgYEBtYXRlcmlhbC8qYCBwYWNrYWdlc1xuICAgICAgICAgICAgICAvLyB3aGljaCBleHRlbnNpdmVseSB1c2UgZGVlcCBpbXBvcnRzLlxuICAgICAgICAgICAgICBjb25zdCBwYWNrYWdlUm9vdCA9IGF3YWl0IHBhY2thZ2VSb290Q2FjaGUuZ2V0T3JDcmVhdGUocGFja2FnZU5hbWUsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBVc2UgdGhlIHJlcXVpcmVkIHByZXNlbmNlIG9mIGEgcGFja2FnZSByb290IGBwYWNrYWdlLmpzb25gIGZpbGUgdG8gcmVzb2x2ZSB0aGUgbG9jYXRpb25cbiAgICAgICAgICAgICAgICBjb25zdCBwYWNrYWdlUmVzdWx0ID0gYXdhaXQgcmVzb2x2ZVVybChwYWNrYWdlTmFtZSArICcvcGFja2FnZS5qc29uJywgb3B0aW9ucyk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcGFja2FnZVJlc3VsdC5wYXRoID8gZGlybmFtZShwYWNrYWdlUmVzdWx0LnBhdGgpIDogbnVsbDtcbiAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgLy8gUGFja2FnZSBub3QgZm91bmQgY291bGQgYmUgYmVjYXVzZSBvZiBhbiBlcnJvciBvciB0aGUgc3BlY2lmaWVyIGlzIGludGVuZGVkIHRvIGJlIGZvdW5kXG4gICAgICAgICAgICAgIC8vIHZpYSBhIGxhdGVyIHN0YWdlIG9mIHRoZSByZXNvbHV0aW9uIHByb2Nlc3MgKGBsb2FkUGF0aHNgLCBldGMuKS5cbiAgICAgICAgICAgICAgLy8gRXJyb3JzIGFyZSByZXBvcnRlZCBhZnRlciB0aGUgZnVsbCBjb21wbGV0aW9uIG9mIHRoZSByZXNvbHV0aW9uIHByb2Nlc3MuIEV4Y2VwdGlvbnMgZm9yXG4gICAgICAgICAgICAgIC8vIG5vdCBmb3VuZCBwYWNrYWdlcyBzaG91bGQgbm90IGJlIHJhaXNlZCBoZXJlLlxuICAgICAgICAgICAgICBpZiAocGFja2FnZVJvb3QpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGF0aFRvRmlsZVVSTChqb2luKHBhY2thZ2VSb290LCAuLi5wYXRoU2VnbWVudHMpKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIE5vdCBmb3VuZFxuICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxvZ2dlcjoge1xuICAgICAgICB3YXJuOiAodGV4dCwgeyBkZXByZWNhdGlvbiwgc3BhbiB9KSA9PiB7XG4gICAgICAgICAgd2FybmluZ3MucHVzaCh7XG4gICAgICAgICAgICB0ZXh0OiBkZXByZWNhdGlvbiA/ICdEZXByZWNhdGlvbicgOiB0ZXh0LFxuICAgICAgICAgICAgbG9jYXRpb246IHNwYW4gJiYge1xuICAgICAgICAgICAgICBmaWxlOiBzcGFuLnVybCAmJiBmaWxlVVJMVG9QYXRoKHNwYW4udXJsKSxcbiAgICAgICAgICAgICAgbGluZVRleHQ6IHNwYW4uY29udGV4dCxcbiAgICAgICAgICAgICAgLy8gU2FzcyBsaW5lIG51bWJlcnMgYXJlIDAtYmFzZWQgd2hpbGUgZXNidWlsZCdzIGFyZSAxLWJhc2VkXG4gICAgICAgICAgICAgIGxpbmU6IHNwYW4uc3RhcnQubGluZSArIDEsXG4gICAgICAgICAgICAgIGNvbHVtbjogc3Bhbi5zdGFydC5jb2x1bW4sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbm90ZXM6IGRlcHJlY2F0aW9uID8gW3sgdGV4dCB9XSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgIGNvbnRlbnRzOiBzb3VyY2VNYXAgPyBgJHtjc3N9XFxuJHtzb3VyY2VNYXBUb1VybENvbW1lbnQoc291cmNlTWFwLCBkaXJuYW1lKGZpbGVQYXRoKSl9YCA6IGNzcyxcbiAgICAgIHdhdGNoRmlsZXM6IGxvYWRlZFVybHMubWFwKCh1cmwpID0+IGZpbGVVUkxUb1BhdGgodXJsKSksXG4gICAgICB3YXJuaW5ncyxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChpc1Nhc3NFeGNlcHRpb24oZXJyb3IpKSB7XG4gICAgICBjb25zdCBmaWxlID0gZXJyb3Iuc3Bhbi51cmwgPyBmaWxlVVJMVG9QYXRoKGVycm9yLnNwYW4udXJsKSA6IHVuZGVmaW5lZDtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdGV4dDogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICB3YXJuaW5ncyxcbiAgICAgICAgd2F0Y2hGaWxlczogZmlsZSA/IFtmaWxlXSA6IHVuZGVmaW5lZCxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cblxuZnVuY3Rpb24gc291cmNlTWFwVG9VcmxDb21tZW50KFxuICBzb3VyY2VNYXA6IEV4Y2x1ZGU8Q29tcGlsZVJlc3VsdFsnc291cmNlTWFwJ10sIHVuZGVmaW5lZD4sXG4gIHJvb3Q6IHN0cmluZyxcbik6IHN0cmluZyB7XG4gIC8vIFJlbW92ZSBgZmlsZWAgcHJvdG9jb2wgZnJvbSBhbGwgc291cmNlbWFwIHNvdXJjZXMgYW5kIGFkanVzdCB0byBiZSByZWxhdGl2ZSB0byB0aGUgaW5wdXQgZmlsZS5cbiAgLy8gVGhpcyBhbGxvd3MgZXNidWlsZCB0byBjb3JyZWN0bHkgcHJvY2VzcyB0aGUgcGF0aHMuXG4gIHNvdXJjZU1hcC5zb3VyY2VzID0gc291cmNlTWFwLnNvdXJjZXMubWFwKChzb3VyY2UpID0+IHJlbGF0aXZlKHJvb3QsIGZpbGVVUkxUb1BhdGgoc291cmNlKSkpO1xuXG4gIGNvbnN0IHVybFNvdXJjZU1hcCA9IEJ1ZmZlci5mcm9tKEpTT04uc3RyaW5naWZ5KHNvdXJjZU1hcCksICd1dGYtOCcpLnRvU3RyaW5nKCdiYXNlNjQnKTtcblxuICByZXR1cm4gYC8qIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zi04O2Jhc2U2NCwke3VybFNvdXJjZU1hcH0gKi9gO1xufVxuIl19