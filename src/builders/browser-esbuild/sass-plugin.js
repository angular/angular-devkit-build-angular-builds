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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSassPlugin = exports.shutdownSassWorkerPool = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const promises_1 = require("node:fs/promises");
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
                if (!result.path && previousResolvedModules?.size) {
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
            build.onLoad({ filter: /^s[ac]ss;/, namespace: 'angular:styles/component' }, async (args) => {
                const data = options.inlineComponentData?.[args.path];
                (0, node_assert_1.default)(typeof data === 'string', `component style name should always be found [${args.path}]`);
                const [language, , filePath] = args.path.split(';', 3);
                const syntax = language === 'sass' ? 'indented' : 'scss';
                return compileString(data, filePath, syntax, options, resolveUrl);
            });
            build.onLoad({ filter: /\.s[ac]ss$/ }, async (args) => {
                const data = await (0, promises_1.readFile)(args.path, 'utf-8');
                const syntax = (0, node_path_1.extname)(args.path).toLowerCase() === '.sass' ? 'indented' : 'scss';
                return compileString(data, args.path, syntax, options, resolveUrl);
            });
        },
    };
}
exports.createSassPlugin = createSassPlugin;
async function compileString(data, filePath, syntax, options, resolveUrl) {
    // Lazily load Sass when a Sass file is found
    if (sassWorkerPool === undefined) {
        const sassService = await Promise.resolve().then(() => __importStar(require('../../sass/sass-service')));
        sassWorkerPool = new sassService.SassWorkerImplementation(true);
    }
    const warnings = [];
    try {
        const { css, sourceMap, loadedUrls } = await sassWorkerPool.compileStringAsync(data, {
            url: (0, node_url_1.pathToFileURL)(filePath),
            style: 'expanded',
            syntax,
            loadPaths: options.loadPaths,
            sourceMap: options.sourcemap,
            sourceMapIncludeSources: options.sourcemap,
            quietDeps: true,
            importers: [
                {
                    findFileUrl: async (url, { previousResolvedModules }) => {
                        let result = await resolveUrl(url);
                        if (result.path) {
                            return (0, node_url_1.pathToFileURL)(result.path);
                        }
                        // Check for package deep imports
                        const parts = url.split('/');
                        const hasScope = parts.length >= 2 && parts[0].startsWith('@');
                        const [nameOrScope, nameOrFirstPath, ...pathPart] = parts;
                        const packageName = hasScope ? `${nameOrScope}/${nameOrFirstPath}` : nameOrScope;
                        let packageResult = await resolveUrl(packageName + '/package.json');
                        if (packageResult.path) {
                            return (0, node_url_1.pathToFileURL)((0, node_path_1.join)((0, node_path_1.dirname)(packageResult.path), !hasScope && nameOrFirstPath ? nameOrFirstPath : '', ...pathPart));
                        }
                        // Check with Yarn PnP workaround using previous resolved modules.
                        // This is done last to avoid a performance penalty for common cases.
                        result = await resolveUrl(url, previousResolvedModules);
                        if (result.path) {
                            return (0, node_url_1.pathToFileURL)(result.path);
                        }
                        packageResult = await resolveUrl(packageName + '/package.json', previousResolvedModules);
                        if (packageResult.path) {
                            return (0, node_url_1.pathToFileURL)((0, node_path_1.join)((0, node_path_1.dirname)(packageResult.path), !hasScope && nameOrFirstPath ? nameOrFirstPath : '', ...pathPart));
                        }
                        // Not found
                        return null;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc2Fzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCw4REFBaUM7QUFDakMsK0NBQTRDO0FBQzVDLHlDQUE2RDtBQUM3RCx1Q0FBd0Q7QUFheEQsSUFBSSxjQUFvRCxDQUFDO0FBRXpELFNBQVMsZUFBZSxDQUFDLEtBQWM7SUFDckMsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxhQUFhLElBQUksS0FBSyxDQUFDO0FBQ3hFLENBQUM7QUFFRCxTQUFnQixzQkFBc0I7SUFDcEMsY0FBYyxFQUFFLEtBQUssRUFBRSxDQUFDO0lBQ3hCLGNBQWMsR0FBRyxTQUFTLENBQUM7QUFDN0IsQ0FBQztBQUhELHdEQUdDO0FBRUQsU0FBZ0IsZ0JBQWdCLENBQUMsT0FBMEI7SUFDekQsT0FBTztRQUNMLElBQUksRUFBRSxjQUFjO1FBQ3BCLEtBQUssQ0FBQyxLQUFrQjtZQUN0QixNQUFNLFVBQVUsR0FBRyxLQUFLLEVBQUUsR0FBVyxFQUFFLHVCQUFxQyxFQUFFLEVBQUU7Z0JBQzlFLElBQUksTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUU7b0JBQ3BDLElBQUksRUFBRSxhQUFhO29CQUNuQixzRUFBc0U7b0JBQ3RFLGtFQUFrRTtvQkFDbEUsVUFBVSxFQUFFLEtBQUssQ0FBQyxjQUFjLENBQUMsYUFBYTtpQkFDL0MsQ0FBQyxDQUFDO2dCQUVILCtFQUErRTtnQkFDL0UsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksdUJBQXVCLEVBQUUsSUFBSSxF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LENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxJQUFBLG9CQUFRLEVBQUMsSUFBSSxFQUFFLElBQUEsd0JBQWEsRUFBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFN0YsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUV4RixPQUFPLG1FQUFtRSxZQUFZLEtBQUssQ0FBQztBQUM5RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgT25Mb2FkUmVzdWx0LCBQYXJ0aWFsTWVzc2FnZSwgUGx1Z2luLCBQbHVnaW5CdWlsZCwgUmVzb2x2ZVJlc3VsdCB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgZGlybmFtZSwgZXh0bmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0eXBlIHsgQ29tcGlsZVJlc3VsdCwgRXhjZXB0aW9uLCBTeW50YXggfSBmcm9tICdzYXNzJztcbmltcG9ydCB0eXBlIHtcbiAgRmlsZUltcG9ydGVyV2l0aFJlcXVlc3RDb250ZXh0T3B0aW9ucyxcbiAgU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uLFxufSBmcm9tICcuLi8uLi9zYXNzL3Nhc3Mtc2VydmljZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2Fzc1BsdWdpbk9wdGlvbnMge1xuICBzb3VyY2VtYXA6IGJvb2xlYW47XG4gIGxvYWRQYXRocz86IHN0cmluZ1tdO1xuICBpbmxpbmVDb21wb25lbnREYXRhPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbn1cblxubGV0IHNhc3NXb3JrZXJQb29sOiBTYXNzV29ya2VySW1wbGVtZW50YXRpb24gfCB1bmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzU2Fzc0V4Y2VwdGlvbihlcnJvcjogdW5rbm93bik6IGVycm9yIGlzIEV4Y2VwdGlvbiB7XG4gIHJldHVybiAhIWVycm9yICYmIHR5cGVvZiBlcnJvciA9PT0gJ29iamVjdCcgJiYgJ3Nhc3NNZXNzYWdlJyBpbiBlcnJvcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNodXRkb3duU2Fzc1dvcmtlclBvb2woKTogdm9pZCB7XG4gIHNhc3NXb3JrZXJQb29sPy5jbG9zZSgpO1xuICBzYXNzV29ya2VyUG9vbCA9IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNhc3NQbHVnaW4ob3B0aW9uczogU2Fzc1BsdWdpbk9wdGlvbnMpOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLXNhc3MnLFxuICAgIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IHZvaWQge1xuICAgICAgY29uc3QgcmVzb2x2ZVVybCA9IGFzeW5jICh1cmw6IHN0cmluZywgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXM/OiBTZXQ8c3RyaW5nPikgPT4ge1xuICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZSh1cmwsIHtcbiAgICAgICAgICBraW5kOiAnaW1wb3J0LXJ1bGUnLFxuICAgICAgICAgIC8vIFRoaXMgc2hvdWxkIGlkZWFsbHkgYmUgdGhlIGRpcmVjdG9yeSBvZiB0aGUgaW1wb3J0ZXIgZmlsZSBmcm9tIFNhc3NcbiAgICAgICAgICAvLyBidXQgdGhhdCBpcyBub3QgY3VycmVudGx5IGF2YWlsYWJsZSBmcm9tIHRoZSBTYXNzIGltcG9ydGVyIEFQSS5cbiAgICAgICAgICByZXNvbHZlRGlyOiBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBXb3JrYXJvdW5kIHRvIHN1cHBvcnQgWWFybiBQblAgd2l0aG91dCBhY2Nlc3MgdG8gdGhlIGltcG9ydGVyIGZpbGUgZnJvbSBTYXNzXG4gICAgICAgIGlmICghcmVzdWx0LnBhdGggJiYgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXM/LnNpemUpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHByZXZpb3VzIG9mIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBidWlsZC5yZXNvbHZlKHVybCwge1xuICAgICAgICAgICAgICBraW5kOiAnaW1wb3J0LXJ1bGUnLFxuICAgICAgICAgICAgICByZXNvbHZlRGlyOiBwcmV2aW91cyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKHJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9O1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9ec1thY11zczsvLCBuYW1lc3BhY2U6ICdhbmd1bGFyOnN0eWxlcy9jb21wb25lbnQnIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBvcHRpb25zLmlubGluZUNvbXBvbmVudERhdGE/LlthcmdzLnBhdGhdO1xuICAgICAgICBhc3NlcnQoXG4gICAgICAgICAgdHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnLFxuICAgICAgICAgIGBjb21wb25lbnQgc3R5bGUgbmFtZSBzaG91bGQgYWx3YXlzIGJlIGZvdW5kIFske2FyZ3MucGF0aH1dYCxcbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCBbbGFuZ3VhZ2UsICwgZmlsZVBhdGhdID0gYXJncy5wYXRoLnNwbGl0KCc7JywgMyk7XG4gICAgICAgIGNvbnN0IHN5bnRheCA9IGxhbmd1YWdlID09PSAnc2FzcycgPyAnaW5kZW50ZWQnIDogJ3Njc3MnO1xuXG4gICAgICAgIHJldHVybiBjb21waWxlU3RyaW5nKGRhdGEsIGZpbGVQYXRoLCBzeW50YXgsIG9wdGlvbnMsIHJlc29sdmVVcmwpO1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLnNbYWNdc3MkLyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVhZEZpbGUoYXJncy5wYXRoLCAndXRmLTgnKTtcbiAgICAgICAgY29uc3Qgc3ludGF4ID0gZXh0bmFtZShhcmdzLnBhdGgpLnRvTG93ZXJDYXNlKCkgPT09ICcuc2FzcycgPyAnaW5kZW50ZWQnIDogJ3Njc3MnO1xuXG4gICAgICAgIHJldHVybiBjb21waWxlU3RyaW5nKGRhdGEsIGFyZ3MucGF0aCwgc3ludGF4LCBvcHRpb25zLCByZXNvbHZlVXJsKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNvbXBpbGVTdHJpbmcoXG4gIGRhdGE6IHN0cmluZyxcbiAgZmlsZVBhdGg6IHN0cmluZyxcbiAgc3ludGF4OiBTeW50YXgsXG4gIG9wdGlvbnM6IFNhc3NQbHVnaW5PcHRpb25zLFxuICByZXNvbHZlVXJsOiAodXJsOiBzdHJpbmcsIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzPzogU2V0PHN0cmluZz4pID0+IFByb21pc2U8UmVzb2x2ZVJlc3VsdD4sXG4pOiBQcm9taXNlPE9uTG9hZFJlc3VsdD4ge1xuICAvLyBMYXppbHkgbG9hZCBTYXNzIHdoZW4gYSBTYXNzIGZpbGUgaXMgZm91bmRcbiAgaWYgKHNhc3NXb3JrZXJQb29sID09PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBzYXNzU2VydmljZSA9IGF3YWl0IGltcG9ydCgnLi4vLi4vc2Fzcy9zYXNzLXNlcnZpY2UnKTtcbiAgICBzYXNzV29ya2VyUG9vbCA9IG5ldyBzYXNzU2VydmljZS5TYXNzV29ya2VySW1wbGVtZW50YXRpb24odHJ1ZSk7XG4gIH1cblxuICBjb25zdCB3YXJuaW5nczogUGFydGlhbE1lc3NhZ2VbXSA9IFtdO1xuICB0cnkge1xuICAgIGNvbnN0IHsgY3NzLCBzb3VyY2VNYXAsIGxvYWRlZFVybHMgfSA9IGF3YWl0IHNhc3NXb3JrZXJQb29sLmNvbXBpbGVTdHJpbmdBc3luYyhkYXRhLCB7XG4gICAgICB1cmw6IHBhdGhUb0ZpbGVVUkwoZmlsZVBhdGgpLFxuICAgICAgc3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICBzeW50YXgsXG4gICAgICBsb2FkUGF0aHM6IG9wdGlvbnMubG9hZFBhdGhzLFxuICAgICAgc291cmNlTWFwOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgIHNvdXJjZU1hcEluY2x1ZGVTb3VyY2VzOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgIHF1aWV0RGVwczogdHJ1ZSxcbiAgICAgIGltcG9ydGVyczogW1xuICAgICAgICB7XG4gICAgICAgICAgZmluZEZpbGVVcmw6IGFzeW5jIChcbiAgICAgICAgICAgIHVybCxcbiAgICAgICAgICAgIHsgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXMgfTogRmlsZUltcG9ydGVyV2l0aFJlcXVlc3RDb250ZXh0T3B0aW9ucyxcbiAgICAgICAgICApOiBQcm9taXNlPFVSTCB8IG51bGw+ID0+IHtcbiAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCByZXNvbHZlVXJsKHVybCk7XG4gICAgICAgICAgICBpZiAocmVzdWx0LnBhdGgpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHBhdGhUb0ZpbGVVUkwocmVzdWx0LnBhdGgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDaGVjayBmb3IgcGFja2FnZSBkZWVwIGltcG9ydHNcbiAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gdXJsLnNwbGl0KCcvJyk7XG4gICAgICAgICAgICBjb25zdCBoYXNTY29wZSA9IHBhcnRzLmxlbmd0aCA+PSAyICYmIHBhcnRzWzBdLnN0YXJ0c1dpdGgoJ0AnKTtcbiAgICAgICAgICAgIGNvbnN0IFtuYW1lT3JTY29wZSwgbmFtZU9yRmlyc3RQYXRoLCAuLi5wYXRoUGFydF0gPSBwYXJ0cztcbiAgICAgICAgICAgIGNvbnN0IHBhY2thZ2VOYW1lID0gaGFzU2NvcGUgPyBgJHtuYW1lT3JTY29wZX0vJHtuYW1lT3JGaXJzdFBhdGh9YCA6IG5hbWVPclNjb3BlO1xuXG4gICAgICAgICAgICBsZXQgcGFja2FnZVJlc3VsdCA9IGF3YWl0IHJlc29sdmVVcmwocGFja2FnZU5hbWUgKyAnL3BhY2thZ2UuanNvbicpO1xuXG4gICAgICAgICAgICBpZiAocGFja2FnZVJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKFxuICAgICAgICAgICAgICAgIGpvaW4oXG4gICAgICAgICAgICAgICAgICBkaXJuYW1lKHBhY2thZ2VSZXN1bHQucGF0aCksXG4gICAgICAgICAgICAgICAgICAhaGFzU2NvcGUgJiYgbmFtZU9yRmlyc3RQYXRoID8gbmFtZU9yRmlyc3RQYXRoIDogJycsXG4gICAgICAgICAgICAgICAgICAuLi5wYXRoUGFydCxcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDaGVjayB3aXRoIFlhcm4gUG5QIHdvcmthcm91bmQgdXNpbmcgcHJldmlvdXMgcmVzb2x2ZWQgbW9kdWxlcy5cbiAgICAgICAgICAgIC8vIFRoaXMgaXMgZG9uZSBsYXN0IHRvIGF2b2lkIGEgcGVyZm9ybWFuY2UgcGVuYWx0eSBmb3IgY29tbW9uIGNhc2VzLlxuXG4gICAgICAgICAgICByZXN1bHQgPSBhd2FpdCByZXNvbHZlVXJsKHVybCwgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXMpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKHJlc3VsdC5wYXRoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcGFja2FnZVJlc3VsdCA9IGF3YWl0IHJlc29sdmVVcmwoXG4gICAgICAgICAgICAgIHBhY2thZ2VOYW1lICsgJy9wYWNrYWdlLmpzb24nLFxuICAgICAgICAgICAgICBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcyxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGlmIChwYWNrYWdlUmVzdWx0LnBhdGgpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHBhdGhUb0ZpbGVVUkwoXG4gICAgICAgICAgICAgICAgam9pbihcbiAgICAgICAgICAgICAgICAgIGRpcm5hbWUocGFja2FnZVJlc3VsdC5wYXRoKSxcbiAgICAgICAgICAgICAgICAgICFoYXNTY29wZSAmJiBuYW1lT3JGaXJzdFBhdGggPyBuYW1lT3JGaXJzdFBhdGggOiAnJyxcbiAgICAgICAgICAgICAgICAgIC4uLnBhdGhQYXJ0LFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE5vdCBmb3VuZFxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBsb2dnZXI6IHtcbiAgICAgICAgd2FybjogKHRleHQsIHsgZGVwcmVjYXRpb24sIHNwYW4gfSkgPT4ge1xuICAgICAgICAgIHdhcm5pbmdzLnB1c2goe1xuICAgICAgICAgICAgdGV4dDogZGVwcmVjYXRpb24gPyAnRGVwcmVjYXRpb24nIDogdGV4dCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiBzcGFuICYmIHtcbiAgICAgICAgICAgICAgZmlsZTogc3Bhbi51cmwgJiYgZmlsZVVSTFRvUGF0aChzcGFuLnVybCksXG4gICAgICAgICAgICAgIGxpbmVUZXh0OiBzcGFuLmNvbnRleHQsXG4gICAgICAgICAgICAgIC8vIFNhc3MgbGluZSBudW1iZXJzIGFyZSAwLWJhc2VkIHdoaWxlIGVzYnVpbGQncyBhcmUgMS1iYXNlZFxuICAgICAgICAgICAgICBsaW5lOiBzcGFuLnN0YXJ0LmxpbmUgKyAxLFxuICAgICAgICAgICAgICBjb2x1bW46IHNwYW4uc3RhcnQuY29sdW1uLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vdGVzOiBkZXByZWNhdGlvbiA/IFt7IHRleHQgfV0gOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICBjb250ZW50czogc291cmNlTWFwID8gYCR7Y3NzfVxcbiR7c291cmNlTWFwVG9VcmxDb21tZW50KHNvdXJjZU1hcCwgZGlybmFtZShmaWxlUGF0aCkpfWAgOiBjc3MsXG4gICAgICB3YXRjaEZpbGVzOiBsb2FkZWRVcmxzLm1hcCgodXJsKSA9PiBmaWxlVVJMVG9QYXRoKHVybCkpLFxuICAgICAgd2FybmluZ3MsXG4gICAgfTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoaXNTYXNzRXhjZXB0aW9uKGVycm9yKSkge1xuICAgICAgY29uc3QgZmlsZSA9IGVycm9yLnNwYW4udXJsID8gZmlsZVVSTFRvUGF0aChlcnJvci5zcGFuLnVybCkgOiB1bmRlZmluZWQ7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICAgIGVycm9yczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRleHQ6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgd2FybmluZ3MsXG4gICAgICAgIHdhdGNoRmlsZXM6IGZpbGUgPyBbZmlsZV0gOiB1bmRlZmluZWQsXG4gICAgICB9O1xuICAgIH1cblxuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNvdXJjZU1hcFRvVXJsQ29tbWVudChcbiAgc291cmNlTWFwOiBFeGNsdWRlPENvbXBpbGVSZXN1bHRbJ3NvdXJjZU1hcCddLCB1bmRlZmluZWQ+LFxuICByb290OiBzdHJpbmcsXG4pOiBzdHJpbmcge1xuICAvLyBSZW1vdmUgYGZpbGVgIHByb3RvY29sIGZyb20gYWxsIHNvdXJjZW1hcCBzb3VyY2VzIGFuZCBhZGp1c3QgdG8gYmUgcmVsYXRpdmUgdG8gdGhlIGlucHV0IGZpbGUuXG4gIC8vIFRoaXMgYWxsb3dzIGVzYnVpbGQgdG8gY29ycmVjdGx5IHByb2Nlc3MgdGhlIHBhdGhzLlxuICBzb3VyY2VNYXAuc291cmNlcyA9IHNvdXJjZU1hcC5zb3VyY2VzLm1hcCgoc291cmNlKSA9PiByZWxhdGl2ZShyb290LCBmaWxlVVJMVG9QYXRoKHNvdXJjZSkpKTtcblxuICBjb25zdCB1cmxTb3VyY2VNYXAgPSBCdWZmZXIuZnJvbShKU09OLnN0cmluZ2lmeShzb3VyY2VNYXApLCAndXRmLTgnKS50b1N0cmluZygnYmFzZTY0Jyk7XG5cbiAgcmV0dXJuIGAvKiMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD11dGYtODtiYXNlNjQsJHt1cmxTb3VyY2VNYXB9ICovYDtcbn1cbiJdfQ==