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
            build.onLoad({ filter: /^s[ac]ss;/, namespace: 'angular:styles/component' }, async (args) => {
                const data = options.inlineComponentData?.[args.path];
                (0, node_assert_1.default)(typeof data === 'string', `component style name should always be found [${args.path}]`);
                let result = cache?.get(data);
                if (result === undefined) {
                    const [language, , filePath] = args.path.split(';', 3);
                    const syntax = language === 'sass' ? 'indented' : 'scss';
                    result = await compileString(data, filePath, syntax, options, resolveUrl);
                    if (result.errors === undefined) {
                        // Cache the result if there were no errors
                        await cache?.put(data, result);
                    }
                }
                return result;
            });
            build.onLoad({ filter: /\.s[ac]ss$/ }, async (args) => {
                let result = cache?.get(args.path);
                if (result === undefined) {
                    const data = await (0, promises_1.readFile)(args.path, 'utf-8');
                    const syntax = (0, node_path_1.extname)(args.path).toLowerCase() === '.sass' ? 'indented' : 'scss';
                    result = await compileString(data, args.path, syntax, options, resolveUrl);
                    if (result.errors === undefined) {
                        // Cache the result if there were no errors
                        await cache?.put(args.path, result);
                    }
                }
                return result;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc2Fzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCw4REFBaUM7QUFDakMsK0NBQTRDO0FBQzVDLHlDQUE2RDtBQUM3RCx1Q0FBd0Q7QUFjeEQsSUFBSSxjQUFvRCxDQUFDO0FBRXpELFNBQVMsZUFBZSxDQUFDLEtBQWM7SUFDckMsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxhQUFhLElBQUksS0FBSyxDQUFDO0FBQ3hFLENBQUM7QUFFRCxTQUFnQixzQkFBc0I7SUFDcEMsY0FBYyxFQUFFLEtBQUssRUFBRSxDQUFDO0lBQ3hCLGNBQWMsR0FBRyxTQUFTLENBQUM7QUFDN0IsQ0FBQztBQUhELHdEQUdDO0FBRUQsU0FBZ0IsZ0JBQWdCLENBQUMsT0FBMEIsRUFBRSxLQUF1QjtJQUNsRixPQUFPO1FBQ0wsSUFBSSxFQUFFLGNBQWM7UUFDcEIsS0FBSyxDQUFDLEtBQWtCO1lBQ3RCLE1BQU0sVUFBVSxHQUFHLEtBQUssRUFBRSxHQUFXLEVBQUUsdUJBQXFDLEVBQUUsRUFBRTtnQkFDOUUsSUFBSSxNQUFNLEdBQUcsTUFBTSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtvQkFDcEMsSUFBSSxFQUFFLGFBQWE7b0JBQ25CLHNFQUFzRTtvQkFDdEUsa0VBQWtFO29CQUNsRSxVQUFVLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxhQUFhO2lCQUMvQyxDQUFDLENBQUM7Z0JBRUgsK0VBQStFO2dCQUMvRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSx1QkFBdUIs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RUFBRTtRQUNkLElBQUksZUFBZSxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQzFCLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFBLHdCQUFhLEVBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBRXhFLE9BQU87Z0JBQ0wsTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsTUFBTSxFQUFFO29CQUNOO3dCQUNFLElBQUksRUFBRSxLQUFLLENBQUMsT0FBTztxQkFDcEI7aUJBQ0Y7Z0JBQ0QsUUFBUTtnQkFDUixVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO2FBQ3RDLENBQUM7U0FDSDtRQUVELE1BQU0sS0FBSyxDQUFDO0tBQ2I7QUFDSCxDQUFDO0FBRUQsU0FBUyxxQkFBcUIsQ0FDNUIsU0FBeUQsRUFDekQsSUFBWTtJQUVaLGlHQUFpRztJQUNqRyxzREFBc0Q7SUFDdEQsU0FBUyxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsSUFBQSxvQkFBUSxFQUFDLElBQUksRUFBRSxJQUFBLHdCQUFhLEVBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTdGLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFeEYsT0FBTyxtRUFBbUUsWUFBWSxLQUFLLENBQUM7QUFDOUYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE9uTG9hZFJlc3VsdCwgUGFydGlhbE1lc3NhZ2UsIFBsdWdpbiwgUGx1Z2luQnVpbGQsIFJlc29sdmVSZXN1bHQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IGRpcm5hbWUsIGV4dG5hbWUsIGpvaW4sIHJlbGF0aXZlIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgdHlwZSB7IENvbXBpbGVSZXN1bHQsIEV4Y2VwdGlvbiwgU3ludGF4IH0gZnJvbSAnc2Fzcyc7XG5pbXBvcnQgdHlwZSB7XG4gIEZpbGVJbXBvcnRlcldpdGhSZXF1ZXN0Q29udGV4dE9wdGlvbnMsXG4gIFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbixcbn0gZnJvbSAnLi4vLi4vc2Fzcy9zYXNzLXNlcnZpY2UnO1xuaW1wb3J0IHR5cGUgeyBMb2FkUmVzdWx0Q2FjaGUgfSBmcm9tICcuL2xvYWQtcmVzdWx0LWNhY2hlJztcblxuZXhwb3J0IGludGVyZmFjZSBTYXNzUGx1Z2luT3B0aW9ucyB7XG4gIHNvdXJjZW1hcDogYm9vbGVhbjtcbiAgbG9hZFBhdGhzPzogc3RyaW5nW107XG4gIGlubGluZUNvbXBvbmVudERhdGE/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xufVxuXG5sZXQgc2Fzc1dvcmtlclBvb2w6IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbiB8IHVuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNTYXNzRXhjZXB0aW9uKGVycm9yOiB1bmtub3duKTogZXJyb3IgaXMgRXhjZXB0aW9uIHtcbiAgcmV0dXJuICEhZXJyb3IgJiYgdHlwZW9mIGVycm9yID09PSAnb2JqZWN0JyAmJiAnc2Fzc01lc3NhZ2UnIGluIGVycm9yO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2h1dGRvd25TYXNzV29ya2VyUG9vbCgpOiB2b2lkIHtcbiAgc2Fzc1dvcmtlclBvb2w/LmNsb3NlKCk7XG4gIHNhc3NXb3JrZXJQb29sID0gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2Fzc1BsdWdpbihvcHRpb25zOiBTYXNzUGx1Z2luT3B0aW9ucywgY2FjaGU/OiBMb2FkUmVzdWx0Q2FjaGUpOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLXNhc3MnLFxuICAgIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IHZvaWQge1xuICAgICAgY29uc3QgcmVzb2x2ZVVybCA9IGFzeW5jICh1cmw6IHN0cmluZywgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXM/OiBTZXQ8c3RyaW5nPikgPT4ge1xuICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZSh1cmwsIHtcbiAgICAgICAgICBraW5kOiAnaW1wb3J0LXJ1bGUnLFxuICAgICAgICAgIC8vIFRoaXMgc2hvdWxkIGlkZWFsbHkgYmUgdGhlIGRpcmVjdG9yeSBvZiB0aGUgaW1wb3J0ZXIgZmlsZSBmcm9tIFNhc3NcbiAgICAgICAgICAvLyBidXQgdGhhdCBpcyBub3QgY3VycmVudGx5IGF2YWlsYWJsZSBmcm9tIHRoZSBTYXNzIGltcG9ydGVyIEFQSS5cbiAgICAgICAgICByZXNvbHZlRGlyOiBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBXb3JrYXJvdW5kIHRvIHN1cHBvcnQgWWFybiBQblAgd2l0aG91dCBhY2Nlc3MgdG8gdGhlIGltcG9ydGVyIGZpbGUgZnJvbSBTYXNzXG4gICAgICAgIGlmICghcmVzdWx0LnBhdGggJiYgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXM/LnNpemUpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHByZXZpb3VzIG9mIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBidWlsZC5yZXNvbHZlKHVybCwge1xuICAgICAgICAgICAgICBraW5kOiAnaW1wb3J0LXJ1bGUnLFxuICAgICAgICAgICAgICByZXNvbHZlRGlyOiBwcmV2aW91cyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKHJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9O1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9ec1thY11zczsvLCBuYW1lc3BhY2U6ICdhbmd1bGFyOnN0eWxlcy9jb21wb25lbnQnIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBvcHRpb25zLmlubGluZUNvbXBvbmVudERhdGE/LlthcmdzLnBhdGhdO1xuICAgICAgICBhc3NlcnQoXG4gICAgICAgICAgdHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnLFxuICAgICAgICAgIGBjb21wb25lbnQgc3R5bGUgbmFtZSBzaG91bGQgYWx3YXlzIGJlIGZvdW5kIFske2FyZ3MucGF0aH1dYCxcbiAgICAgICAgKTtcblxuICAgICAgICBsZXQgcmVzdWx0ID0gY2FjaGU/LmdldChkYXRhKTtcbiAgICAgICAgaWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc3QgW2xhbmd1YWdlLCAsIGZpbGVQYXRoXSA9IGFyZ3MucGF0aC5zcGxpdCgnOycsIDMpO1xuICAgICAgICAgIGNvbnN0IHN5bnRheCA9IGxhbmd1YWdlID09PSAnc2FzcycgPyAnaW5kZW50ZWQnIDogJ3Njc3MnO1xuXG4gICAgICAgICAgcmVzdWx0ID0gYXdhaXQgY29tcGlsZVN0cmluZyhkYXRhLCBmaWxlUGF0aCwgc3ludGF4LCBvcHRpb25zLCByZXNvbHZlVXJsKTtcbiAgICAgICAgICBpZiAocmVzdWx0LmVycm9ycyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBDYWNoZSB0aGUgcmVzdWx0IGlmIHRoZXJlIHdlcmUgbm8gZXJyb3JzXG4gICAgICAgICAgICBhd2FpdCBjYWNoZT8ucHV0KGRhdGEsIHJlc3VsdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5zW2FjXXNzJC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IGNhY2hlPy5nZXQoYXJncy5wYXRoKTtcbiAgICAgICAgaWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlYWRGaWxlKGFyZ3MucGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgICAgY29uc3Qgc3ludGF4ID0gZXh0bmFtZShhcmdzLnBhdGgpLnRvTG93ZXJDYXNlKCkgPT09ICcuc2FzcycgPyAnaW5kZW50ZWQnIDogJ3Njc3MnO1xuXG4gICAgICAgICAgcmVzdWx0ID0gYXdhaXQgY29tcGlsZVN0cmluZyhkYXRhLCBhcmdzLnBhdGgsIHN5bnRheCwgb3B0aW9ucywgcmVzb2x2ZVVybCk7XG4gICAgICAgICAgaWYgKHJlc3VsdC5lcnJvcnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gQ2FjaGUgdGhlIHJlc3VsdCBpZiB0aGVyZSB3ZXJlIG5vIGVycm9yc1xuICAgICAgICAgICAgYXdhaXQgY2FjaGU/LnB1dChhcmdzLnBhdGgsIHJlc3VsdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNvbXBpbGVTdHJpbmcoXG4gIGRhdGE6IHN0cmluZyxcbiAgZmlsZVBhdGg6IHN0cmluZyxcbiAgc3ludGF4OiBTeW50YXgsXG4gIG9wdGlvbnM6IFNhc3NQbHVnaW5PcHRpb25zLFxuICByZXNvbHZlVXJsOiAodXJsOiBzdHJpbmcsIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzPzogU2V0PHN0cmluZz4pID0+IFByb21pc2U8UmVzb2x2ZVJlc3VsdD4sXG4pOiBQcm9taXNlPE9uTG9hZFJlc3VsdD4ge1xuICAvLyBMYXppbHkgbG9hZCBTYXNzIHdoZW4gYSBTYXNzIGZpbGUgaXMgZm91bmRcbiAgaWYgKHNhc3NXb3JrZXJQb29sID09PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBzYXNzU2VydmljZSA9IGF3YWl0IGltcG9ydCgnLi4vLi4vc2Fzcy9zYXNzLXNlcnZpY2UnKTtcbiAgICBzYXNzV29ya2VyUG9vbCA9IG5ldyBzYXNzU2VydmljZS5TYXNzV29ya2VySW1wbGVtZW50YXRpb24odHJ1ZSk7XG4gIH1cblxuICBjb25zdCB3YXJuaW5nczogUGFydGlhbE1lc3NhZ2VbXSA9IFtdO1xuICB0cnkge1xuICAgIGNvbnN0IHsgY3NzLCBzb3VyY2VNYXAsIGxvYWRlZFVybHMgfSA9IGF3YWl0IHNhc3NXb3JrZXJQb29sLmNvbXBpbGVTdHJpbmdBc3luYyhkYXRhLCB7XG4gICAgICB1cmw6IHBhdGhUb0ZpbGVVUkwoZmlsZVBhdGgpLFxuICAgICAgc3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICBzeW50YXgsXG4gICAgICBsb2FkUGF0aHM6IG9wdGlvbnMubG9hZFBhdGhzLFxuICAgICAgc291cmNlTWFwOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgIHNvdXJjZU1hcEluY2x1ZGVTb3VyY2VzOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgIHF1aWV0RGVwczogdHJ1ZSxcbiAgICAgIGltcG9ydGVyczogW1xuICAgICAgICB7XG4gICAgICAgICAgZmluZEZpbGVVcmw6IGFzeW5jIChcbiAgICAgICAgICAgIHVybCxcbiAgICAgICAgICAgIHsgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXMgfTogRmlsZUltcG9ydGVyV2l0aFJlcXVlc3RDb250ZXh0T3B0aW9ucyxcbiAgICAgICAgICApOiBQcm9taXNlPFVSTCB8IG51bGw+ID0+IHtcbiAgICAgICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCByZXNvbHZlVXJsKHVybCk7XG4gICAgICAgICAgICBpZiAocmVzdWx0LnBhdGgpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHBhdGhUb0ZpbGVVUkwocmVzdWx0LnBhdGgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDaGVjayBmb3IgcGFja2FnZSBkZWVwIGltcG9ydHNcbiAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gdXJsLnNwbGl0KCcvJyk7XG4gICAgICAgICAgICBjb25zdCBoYXNTY29wZSA9IHBhcnRzLmxlbmd0aCA+PSAyICYmIHBhcnRzWzBdLnN0YXJ0c1dpdGgoJ0AnKTtcbiAgICAgICAgICAgIGNvbnN0IFtuYW1lT3JTY29wZSwgbmFtZU9yRmlyc3RQYXRoLCAuLi5wYXRoUGFydF0gPSBwYXJ0cztcbiAgICAgICAgICAgIGNvbnN0IHBhY2thZ2VOYW1lID0gaGFzU2NvcGUgPyBgJHtuYW1lT3JTY29wZX0vJHtuYW1lT3JGaXJzdFBhdGh9YCA6IG5hbWVPclNjb3BlO1xuXG4gICAgICAgICAgICBsZXQgcGFja2FnZVJlc3VsdCA9IGF3YWl0IHJlc29sdmVVcmwocGFja2FnZU5hbWUgKyAnL3BhY2thZ2UuanNvbicpO1xuXG4gICAgICAgICAgICBpZiAocGFja2FnZVJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKFxuICAgICAgICAgICAgICAgIGpvaW4oXG4gICAgICAgICAgICAgICAgICBkaXJuYW1lKHBhY2thZ2VSZXN1bHQucGF0aCksXG4gICAgICAgICAgICAgICAgICAhaGFzU2NvcGUgJiYgbmFtZU9yRmlyc3RQYXRoID8gbmFtZU9yRmlyc3RQYXRoIDogJycsXG4gICAgICAgICAgICAgICAgICAuLi5wYXRoUGFydCxcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDaGVjayB3aXRoIFlhcm4gUG5QIHdvcmthcm91bmQgdXNpbmcgcHJldmlvdXMgcmVzb2x2ZWQgbW9kdWxlcy5cbiAgICAgICAgICAgIC8vIFRoaXMgaXMgZG9uZSBsYXN0IHRvIGF2b2lkIGEgcGVyZm9ybWFuY2UgcGVuYWx0eSBmb3IgY29tbW9uIGNhc2VzLlxuXG4gICAgICAgICAgICByZXN1bHQgPSBhd2FpdCByZXNvbHZlVXJsKHVybCwgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXMpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKHJlc3VsdC5wYXRoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcGFja2FnZVJlc3VsdCA9IGF3YWl0IHJlc29sdmVVcmwoXG4gICAgICAgICAgICAgIHBhY2thZ2VOYW1lICsgJy9wYWNrYWdlLmpzb24nLFxuICAgICAgICAgICAgICBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcyxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGlmIChwYWNrYWdlUmVzdWx0LnBhdGgpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHBhdGhUb0ZpbGVVUkwoXG4gICAgICAgICAgICAgICAgam9pbihcbiAgICAgICAgICAgICAgICAgIGRpcm5hbWUocGFja2FnZVJlc3VsdC5wYXRoKSxcbiAgICAgICAgICAgICAgICAgICFoYXNTY29wZSAmJiBuYW1lT3JGaXJzdFBhdGggPyBuYW1lT3JGaXJzdFBhdGggOiAnJyxcbiAgICAgICAgICAgICAgICAgIC4uLnBhdGhQYXJ0LFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE5vdCBmb3VuZFxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBsb2dnZXI6IHtcbiAgICAgICAgd2FybjogKHRleHQsIHsgZGVwcmVjYXRpb24sIHNwYW4gfSkgPT4ge1xuICAgICAgICAgIHdhcm5pbmdzLnB1c2goe1xuICAgICAgICAgICAgdGV4dDogZGVwcmVjYXRpb24gPyAnRGVwcmVjYXRpb24nIDogdGV4dCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiBzcGFuICYmIHtcbiAgICAgICAgICAgICAgZmlsZTogc3Bhbi51cmwgJiYgZmlsZVVSTFRvUGF0aChzcGFuLnVybCksXG4gICAgICAgICAgICAgIGxpbmVUZXh0OiBzcGFuLmNvbnRleHQsXG4gICAgICAgICAgICAgIC8vIFNhc3MgbGluZSBudW1iZXJzIGFyZSAwLWJhc2VkIHdoaWxlIGVzYnVpbGQncyBhcmUgMS1iYXNlZFxuICAgICAgICAgICAgICBsaW5lOiBzcGFuLnN0YXJ0LmxpbmUgKyAxLFxuICAgICAgICAgICAgICBjb2x1bW46IHNwYW4uc3RhcnQuY29sdW1uLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vdGVzOiBkZXByZWNhdGlvbiA/IFt7IHRleHQgfV0gOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICBjb250ZW50czogc291cmNlTWFwID8gYCR7Y3NzfVxcbiR7c291cmNlTWFwVG9VcmxDb21tZW50KHNvdXJjZU1hcCwgZGlybmFtZShmaWxlUGF0aCkpfWAgOiBjc3MsXG4gICAgICB3YXRjaEZpbGVzOiBsb2FkZWRVcmxzLm1hcCgodXJsKSA9PiBmaWxlVVJMVG9QYXRoKHVybCkpLFxuICAgICAgd2FybmluZ3MsXG4gICAgfTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoaXNTYXNzRXhjZXB0aW9uKGVycm9yKSkge1xuICAgICAgY29uc3QgZmlsZSA9IGVycm9yLnNwYW4udXJsID8gZmlsZVVSTFRvUGF0aChlcnJvci5zcGFuLnVybCkgOiB1bmRlZmluZWQ7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICAgIGVycm9yczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRleHQ6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgd2FybmluZ3MsXG4gICAgICAgIHdhdGNoRmlsZXM6IGZpbGUgPyBbZmlsZV0gOiB1bmRlZmluZWQsXG4gICAgICB9O1xuICAgIH1cblxuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNvdXJjZU1hcFRvVXJsQ29tbWVudChcbiAgc291cmNlTWFwOiBFeGNsdWRlPENvbXBpbGVSZXN1bHRbJ3NvdXJjZU1hcCddLCB1bmRlZmluZWQ+LFxuICByb290OiBzdHJpbmcsXG4pOiBzdHJpbmcge1xuICAvLyBSZW1vdmUgYGZpbGVgIHByb3RvY29sIGZyb20gYWxsIHNvdXJjZW1hcCBzb3VyY2VzIGFuZCBhZGp1c3QgdG8gYmUgcmVsYXRpdmUgdG8gdGhlIGlucHV0IGZpbGUuXG4gIC8vIFRoaXMgYWxsb3dzIGVzYnVpbGQgdG8gY29ycmVjdGx5IHByb2Nlc3MgdGhlIHBhdGhzLlxuICBzb3VyY2VNYXAuc291cmNlcyA9IHNvdXJjZU1hcC5zb3VyY2VzLm1hcCgoc291cmNlKSA9PiByZWxhdGl2ZShyb290LCBmaWxlVVJMVG9QYXRoKHNvdXJjZSkpKTtcblxuICBjb25zdCB1cmxTb3VyY2VNYXAgPSBCdWZmZXIuZnJvbShKU09OLnN0cmluZ2lmeShzb3VyY2VNYXApLCAndXRmLTgnKS50b1N0cmluZygnYmFzZTY0Jyk7XG5cbiAgcmV0dXJuIGAvKiMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD11dGYtODtiYXNlNjQsJHt1cmxTb3VyY2VNYXB9ICovYDtcbn1cbiJdfQ==