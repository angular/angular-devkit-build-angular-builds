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
const load_result_cache_1 = require("../load-result-cache");
let sassWorkerPool;
function isSassException(error) {
    return !!error && typeof error === 'object' && 'sassMessage' in error;
}
function shutdownSassWorkerPool() {
    sassWorkerPool?.close();
    sassWorkerPool = undefined;
}
exports.shutdownSassWorkerPool = shutdownSassWorkerPool;
function createSassPlugin(options, cache) {
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
            // Load inline component stylesheets
            build.onLoad({ filter: /^s[ac]ss;/, namespace: 'angular:styles/component' }, (0, load_result_cache_1.createCachedLoad)(cache, async (args) => {
                const data = options.inlineComponentData?.[args.path];
                (0, node_assert_1.default)(typeof data === 'string', `component style name should always be found [${args.path}]`);
                const [language, , filePath] = args.path.split(';', 3);
                const syntax = language === 'sass' ? 'indented' : 'scss';
                return compileString(data, filePath, syntax, options, resolveUrl);
            }));
            // Load file stylesheets
            build.onLoad({ filter: /\.s[ac]ss$/ }, (0, load_result_cache_1.createCachedLoad)(cache, async (args) => {
                const data = await (0, promises_1.readFile)(args.path, 'utf-8');
                const syntax = (0, node_path_1.extname)(args.path).toLowerCase() === '.sass' ? 'indented' : 'scss';
                return compileString(data, args.path, syntax, options, resolveUrl);
            }));
        },
    };
}
exports.createSassPlugin = createSassPlugin;
async function compileString(data, filePath, syntax, options, resolveUrl) {
    // Lazily load Sass when a Sass file is found
    if (sassWorkerPool === undefined) {
        const sassService = await Promise.resolve().then(() => __importStar(require('../../../sass/sass-service')));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc3R5bGVzaGVldHMvc2Fzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCw4REFBaUM7QUFDakMsK0NBQTRDO0FBQzVDLHlDQUE2RDtBQUM3RCx1Q0FBd0Q7QUFNeEQsNERBQXlFO0FBUXpFLElBQUksY0FBb0QsQ0FBQztBQUV6RCxTQUFTLGVBQWUsQ0FBQyxLQUFjO0lBQ3JDLE9BQU8sQ0FBQyxDQUFDLEtBQUssSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksYUFBYSxJQUFJLEtBQUssQ0FBQztBQUN4RSxDQUFDO0FBRUQsU0FBZ0Isc0JBQXNCO0lBQ3BDLGNBQWMsRUFBRSxLQUFLLEVBQUUsQ0FBQztJQUN4QixjQUFjLEdBQUcsU0FBUyxDQUFDO0FBQzdCLENBQUM7QUFIRCx3REFHQztBQUVELFNBQWdCLGdCQUFnQixDQUFDLE9BQTBCLEVBQUUsS0FBdUI7SUFDbEYsT0FBTztRQUNMLElBQUksRUFBRSxjQUFjO1FBQ3BCLEtBQUssQ0FBQyxLQUFrQjtZQUN0QixNQUFNLFVBQVUsR0FBRyxLQUFLLEVBQUUsR0FBVyxFQUFFLHVCQUFxQyxFQUFFLEVBQUU7Z0JBQzlFLElBQUksTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUU7b0JBQ3BDLElBQUksRUFBRSxhQUFhO29CQUNuQixzRUFBc0U7b0JBQ3RFLGtFQUFrRTtvQkFDbEUsVUFBVSxFQUFFLEtBQUssQ0FBQyxjQUFjLENBQUMsYUFBYTtpQkFDL0MsQ0FBQyxDQUFDO2dCQUVILCtFQUErRTtnQkFDL0UsSUFBSSxDQUFD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O0FBQ0gsQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQzVCLFNBQXlELEVBQ3pELElBQVk7SUFFWixpR0FBaUc7SUFDakcsc0RBQXNEO0lBQ3RELFNBQVMsQ0FBQyxPQUFPLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLElBQUEsb0JBQVEsRUFBQyxJQUFJLEVBQUUsSUFBQSx3QkFBYSxFQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUU3RixNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRXhGLE9BQU8sbUVBQW1FLFlBQVksS0FBSyxDQUFDO0FBQzlGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBPbkxvYWRSZXN1bHQsIFBhcnRpYWxNZXNzYWdlLCBQbHVnaW4sIFBsdWdpbkJ1aWxkLCBSZXNvbHZlUmVzdWx0IH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBkaXJuYW1lLCBleHRuYW1lLCBqb2luLCByZWxhdGl2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBwYXRoVG9GaWxlVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IHR5cGUgeyBDb21waWxlUmVzdWx0LCBFeGNlcHRpb24sIFN5bnRheCB9IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHR5cGUge1xuICBGaWxlSW1wb3J0ZXJXaXRoUmVxdWVzdENvbnRleHRPcHRpb25zLFxuICBTYXNzV29ya2VySW1wbGVtZW50YXRpb24sXG59IGZyb20gJy4uLy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlJztcbmltcG9ydCB7IExvYWRSZXN1bHRDYWNoZSwgY3JlYXRlQ2FjaGVkTG9hZCB9IGZyb20gJy4uL2xvYWQtcmVzdWx0LWNhY2hlJztcblxuZXhwb3J0IGludGVyZmFjZSBTYXNzUGx1Z2luT3B0aW9ucyB7XG4gIHNvdXJjZW1hcDogYm9vbGVhbjtcbiAgbG9hZFBhdGhzPzogc3RyaW5nW107XG4gIGlubGluZUNvbXBvbmVudERhdGE/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xufVxuXG5sZXQgc2Fzc1dvcmtlclBvb2w6IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbiB8IHVuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNTYXNzRXhjZXB0aW9uKGVycm9yOiB1bmtub3duKTogZXJyb3IgaXMgRXhjZXB0aW9uIHtcbiAgcmV0dXJuICEhZXJyb3IgJiYgdHlwZW9mIGVycm9yID09PSAnb2JqZWN0JyAmJiAnc2Fzc01lc3NhZ2UnIGluIGVycm9yO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2h1dGRvd25TYXNzV29ya2VyUG9vbCgpOiB2b2lkIHtcbiAgc2Fzc1dvcmtlclBvb2w/LmNsb3NlKCk7XG4gIHNhc3NXb3JrZXJQb29sID0gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2Fzc1BsdWdpbihvcHRpb25zOiBTYXNzUGx1Z2luT3B0aW9ucywgY2FjaGU/OiBMb2FkUmVzdWx0Q2FjaGUpOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLXNhc3MnLFxuICAgIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IHZvaWQge1xuICAgICAgY29uc3QgcmVzb2x2ZVVybCA9IGFzeW5jICh1cmw6IHN0cmluZywgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXM/OiBTZXQ8c3RyaW5nPikgPT4ge1xuICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZSh1cmwsIHtcbiAgICAgICAgICBraW5kOiAnaW1wb3J0LXJ1bGUnLFxuICAgICAgICAgIC8vIFRoaXMgc2hvdWxkIGlkZWFsbHkgYmUgdGhlIGRpcmVjdG9yeSBvZiB0aGUgaW1wb3J0ZXIgZmlsZSBmcm9tIFNhc3NcbiAgICAgICAgICAvLyBidXQgdGhhdCBpcyBub3QgY3VycmVudGx5IGF2YWlsYWJsZSBmcm9tIHRoZSBTYXNzIGltcG9ydGVyIEFQSS5cbiAgICAgICAgICByZXNvbHZlRGlyOiBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBXb3JrYXJvdW5kIHRvIHN1cHBvcnQgWWFybiBQblAgd2l0aG91dCBhY2Nlc3MgdG8gdGhlIGltcG9ydGVyIGZpbGUgZnJvbSBTYXNzXG4gICAgICAgIGlmICghcmVzdWx0LnBhdGggJiYgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXM/LnNpemUpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHByZXZpb3VzIG9mIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBidWlsZC5yZXNvbHZlKHVybCwge1xuICAgICAgICAgICAgICBraW5kOiAnaW1wb3J0LXJ1bGUnLFxuICAgICAgICAgICAgICByZXNvbHZlRGlyOiBwcmV2aW91cyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKHJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9O1xuXG4gICAgICAvLyBMb2FkIGlubGluZSBjb21wb25lbnQgc3R5bGVzaGVldHNcbiAgICAgIGJ1aWxkLm9uTG9hZChcbiAgICAgICAgeyBmaWx0ZXI6IC9ec1thY11zczsvLCBuYW1lc3BhY2U6ICdhbmd1bGFyOnN0eWxlcy9jb21wb25lbnQnIH0sXG4gICAgICAgIGNyZWF0ZUNhY2hlZExvYWQoY2FjaGUsIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgICAgY29uc3QgZGF0YSA9IG9wdGlvbnMuaW5saW5lQ29tcG9uZW50RGF0YT8uW2FyZ3MucGF0aF07XG4gICAgICAgICAgYXNzZXJ0KFxuICAgICAgICAgICAgdHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnLFxuICAgICAgICAgICAgYGNvbXBvbmVudCBzdHlsZSBuYW1lIHNob3VsZCBhbHdheXMgYmUgZm91bmQgWyR7YXJncy5wYXRofV1gLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICBjb25zdCBbbGFuZ3VhZ2UsICwgZmlsZVBhdGhdID0gYXJncy5wYXRoLnNwbGl0KCc7JywgMyk7XG4gICAgICAgICAgY29uc3Qgc3ludGF4ID0gbGFuZ3VhZ2UgPT09ICdzYXNzJyA/ICdpbmRlbnRlZCcgOiAnc2Nzcyc7XG5cbiAgICAgICAgICByZXR1cm4gY29tcGlsZVN0cmluZyhkYXRhLCBmaWxlUGF0aCwgc3ludGF4LCBvcHRpb25zLCByZXNvbHZlVXJsKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgICAvLyBMb2FkIGZpbGUgc3R5bGVzaGVldHNcbiAgICAgIGJ1aWxkLm9uTG9hZChcbiAgICAgICAgeyBmaWx0ZXI6IC9cXC5zW2FjXXNzJC8gfSxcbiAgICAgICAgY3JlYXRlQ2FjaGVkTG9hZChjYWNoZSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVhZEZpbGUoYXJncy5wYXRoLCAndXRmLTgnKTtcbiAgICAgICAgICBjb25zdCBzeW50YXggPSBleHRuYW1lKGFyZ3MucGF0aCkudG9Mb3dlckNhc2UoKSA9PT0gJy5zYXNzJyA/ICdpbmRlbnRlZCcgOiAnc2Nzcyc7XG5cbiAgICAgICAgICByZXR1cm4gY29tcGlsZVN0cmluZyhkYXRhLCBhcmdzLnBhdGgsIHN5bnRheCwgb3B0aW9ucywgcmVzb2x2ZVVybCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9LFxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBjb21waWxlU3RyaW5nKFxuICBkYXRhOiBzdHJpbmcsXG4gIGZpbGVQYXRoOiBzdHJpbmcsXG4gIHN5bnRheDogU3ludGF4LFxuICBvcHRpb25zOiBTYXNzUGx1Z2luT3B0aW9ucyxcbiAgcmVzb2x2ZVVybDogKHVybDogc3RyaW5nLCBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcz86IFNldDxzdHJpbmc+KSA9PiBQcm9taXNlPFJlc29sdmVSZXN1bHQ+LFxuKTogUHJvbWlzZTxPbkxvYWRSZXN1bHQ+IHtcbiAgLy8gTGF6aWx5IGxvYWQgU2FzcyB3aGVuIGEgU2FzcyBmaWxlIGlzIGZvdW5kXG4gIGlmIChzYXNzV29ya2VyUG9vbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3Qgc2Fzc1NlcnZpY2UgPSBhd2FpdCBpbXBvcnQoJy4uLy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlJyk7XG4gICAgc2Fzc1dvcmtlclBvb2wgPSBuZXcgc2Fzc1NlcnZpY2UuU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uKHRydWUpO1xuICB9XG5cbiAgY29uc3Qgd2FybmluZ3M6IFBhcnRpYWxNZXNzYWdlW10gPSBbXTtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IGNzcywgc291cmNlTWFwLCBsb2FkZWRVcmxzIH0gPSBhd2FpdCBzYXNzV29ya2VyUG9vbC5jb21waWxlU3RyaW5nQXN5bmMoZGF0YSwge1xuICAgICAgdXJsOiBwYXRoVG9GaWxlVVJMKGZpbGVQYXRoKSxcbiAgICAgIHN0eWxlOiAnZXhwYW5kZWQnLFxuICAgICAgc3ludGF4LFxuICAgICAgbG9hZFBhdGhzOiBvcHRpb25zLmxvYWRQYXRocyxcbiAgICAgIHNvdXJjZU1hcDogb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICBzb3VyY2VNYXBJbmNsdWRlU291cmNlczogb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICBxdWlldERlcHM6IHRydWUsXG4gICAgICBpbXBvcnRlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGZpbmRGaWxlVXJsOiBhc3luYyAoXG4gICAgICAgICAgICB1cmwsXG4gICAgICAgICAgICB7IHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzIH06IEZpbGVJbXBvcnRlcldpdGhSZXF1ZXN0Q29udGV4dE9wdGlvbnMsXG4gICAgICAgICAgKTogUHJvbWlzZTxVUkwgfCBudWxsPiA9PiB7XG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgcmVzb2x2ZVVybCh1cmwpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKHJlc3VsdC5wYXRoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIHBhY2thZ2UgZGVlcCBpbXBvcnRzXG4gICAgICAgICAgICBjb25zdCBwYXJ0cyA9IHVybC5zcGxpdCgnLycpO1xuICAgICAgICAgICAgY29uc3QgaGFzU2NvcGUgPSBwYXJ0cy5sZW5ndGggPj0gMiAmJiBwYXJ0c1swXS5zdGFydHNXaXRoKCdAJyk7XG4gICAgICAgICAgICBjb25zdCBbbmFtZU9yU2NvcGUsIG5hbWVPckZpcnN0UGF0aCwgLi4ucGF0aFBhcnRdID0gcGFydHM7XG4gICAgICAgICAgICBjb25zdCBwYWNrYWdlTmFtZSA9IGhhc1Njb3BlID8gYCR7bmFtZU9yU2NvcGV9LyR7bmFtZU9yRmlyc3RQYXRofWAgOiBuYW1lT3JTY29wZTtcblxuICAgICAgICAgICAgbGV0IHBhY2thZ2VSZXN1bHQgPSBhd2FpdCByZXNvbHZlVXJsKHBhY2thZ2VOYW1lICsgJy9wYWNrYWdlLmpzb24nKTtcblxuICAgICAgICAgICAgaWYgKHBhY2thZ2VSZXN1bHQucGF0aCkge1xuICAgICAgICAgICAgICByZXR1cm4gcGF0aFRvRmlsZVVSTChcbiAgICAgICAgICAgICAgICBqb2luKFxuICAgICAgICAgICAgICAgICAgZGlybmFtZShwYWNrYWdlUmVzdWx0LnBhdGgpLFxuICAgICAgICAgICAgICAgICAgIWhhc1Njb3BlICYmIG5hbWVPckZpcnN0UGF0aCA/IG5hbWVPckZpcnN0UGF0aCA6ICcnLFxuICAgICAgICAgICAgICAgICAgLi4ucGF0aFBhcnQsXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2hlY2sgd2l0aCBZYXJuIFBuUCB3b3JrYXJvdW5kIHVzaW5nIHByZXZpb3VzIHJlc29sdmVkIG1vZHVsZXMuXG4gICAgICAgICAgICAvLyBUaGlzIGlzIGRvbmUgbGFzdCB0byBhdm9pZCBhIHBlcmZvcm1hbmNlIHBlbmFsdHkgZm9yIGNvbW1vbiBjYXNlcy5cblxuICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgcmVzb2x2ZVVybCh1cmwsIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQucGF0aCkge1xuICAgICAgICAgICAgICByZXR1cm4gcGF0aFRvRmlsZVVSTChyZXN1bHQucGF0aCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHBhY2thZ2VSZXN1bHQgPSBhd2FpdCByZXNvbHZlVXJsKFxuICAgICAgICAgICAgICBwYWNrYWdlTmFtZSArICcvcGFja2FnZS5qc29uJyxcbiAgICAgICAgICAgICAgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXMsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBpZiAocGFja2FnZVJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKFxuICAgICAgICAgICAgICAgIGpvaW4oXG4gICAgICAgICAgICAgICAgICBkaXJuYW1lKHBhY2thZ2VSZXN1bHQucGF0aCksXG4gICAgICAgICAgICAgICAgICAhaGFzU2NvcGUgJiYgbmFtZU9yRmlyc3RQYXRoID8gbmFtZU9yRmlyc3RQYXRoIDogJycsXG4gICAgICAgICAgICAgICAgICAuLi5wYXRoUGFydCxcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBOb3QgZm91bmRcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgbG9nZ2VyOiB7XG4gICAgICAgIHdhcm46ICh0ZXh0LCB7IGRlcHJlY2F0aW9uLCBzcGFuIH0pID0+IHtcbiAgICAgICAgICB3YXJuaW5ncy5wdXNoKHtcbiAgICAgICAgICAgIHRleHQ6IGRlcHJlY2F0aW9uID8gJ0RlcHJlY2F0aW9uJyA6IHRleHQsXG4gICAgICAgICAgICBsb2NhdGlvbjogc3BhbiAmJiB7XG4gICAgICAgICAgICAgIGZpbGU6IHNwYW4udXJsICYmIGZpbGVVUkxUb1BhdGgoc3Bhbi51cmwpLFxuICAgICAgICAgICAgICBsaW5lVGV4dDogc3Bhbi5jb250ZXh0LFxuICAgICAgICAgICAgICAvLyBTYXNzIGxpbmUgbnVtYmVycyBhcmUgMC1iYXNlZCB3aGlsZSBlc2J1aWxkJ3MgYXJlIDEtYmFzZWRcbiAgICAgICAgICAgICAgbGluZTogc3Bhbi5zdGFydC5saW5lICsgMSxcbiAgICAgICAgICAgICAgY29sdW1uOiBzcGFuLnN0YXJ0LmNvbHVtbixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub3RlczogZGVwcmVjYXRpb24gPyBbeyB0ZXh0IH1dIDogdW5kZWZpbmVkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgY29udGVudHM6IHNvdXJjZU1hcCA/IGAke2Nzc31cXG4ke3NvdXJjZU1hcFRvVXJsQ29tbWVudChzb3VyY2VNYXAsIGRpcm5hbWUoZmlsZVBhdGgpKX1gIDogY3NzLFxuICAgICAgd2F0Y2hGaWxlczogbG9hZGVkVXJscy5tYXAoKHVybCkgPT4gZmlsZVVSTFRvUGF0aCh1cmwpKSxcbiAgICAgIHdhcm5pbmdzLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGlzU2Fzc0V4Y2VwdGlvbihlcnJvcikpIHtcbiAgICAgIGNvbnN0IGZpbGUgPSBlcnJvci5zcGFuLnVybCA/IGZpbGVVUkxUb1BhdGgoZXJyb3Iuc3Bhbi51cmwpIDogdW5kZWZpbmVkO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0ZXh0OiBlcnJvci5tZXNzYWdlLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHdhcm5pbmdzLFxuICAgICAgICB3YXRjaEZpbGVzOiBmaWxlID8gW2ZpbGVdIDogdW5kZWZpbmVkLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5mdW5jdGlvbiBzb3VyY2VNYXBUb1VybENvbW1lbnQoXG4gIHNvdXJjZU1hcDogRXhjbHVkZTxDb21waWxlUmVzdWx0Wydzb3VyY2VNYXAnXSwgdW5kZWZpbmVkPixcbiAgcm9vdDogc3RyaW5nLFxuKTogc3RyaW5nIHtcbiAgLy8gUmVtb3ZlIGBmaWxlYCBwcm90b2NvbCBmcm9tIGFsbCBzb3VyY2VtYXAgc291cmNlcyBhbmQgYWRqdXN0IHRvIGJlIHJlbGF0aXZlIHRvIHRoZSBpbnB1dCBmaWxlLlxuICAvLyBUaGlzIGFsbG93cyBlc2J1aWxkIHRvIGNvcnJlY3RseSBwcm9jZXNzIHRoZSBwYXRocy5cbiAgc291cmNlTWFwLnNvdXJjZXMgPSBzb3VyY2VNYXAuc291cmNlcy5tYXAoKHNvdXJjZSkgPT4gcmVsYXRpdmUocm9vdCwgZmlsZVVSTFRvUGF0aChzb3VyY2UpKSk7XG5cbiAgY29uc3QgdXJsU291cmNlTWFwID0gQnVmZmVyLmZyb20oSlNPTi5zdHJpbmdpZnkoc291cmNlTWFwKSwgJ3V0Zi04JykudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuXG4gIHJldHVybiBgLyojIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTg7YmFzZTY0LCR7dXJsU291cmNlTWFwfSAqL2A7XG59XG4iXX0=