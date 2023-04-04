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
                        const result = await resolveUrl(url, previousResolvedModules);
                        // Check for package deep imports
                        if (!result.path) {
                            const parts = url.split('/');
                            const hasScope = parts.length >= 2 && parts[0].startsWith('@');
                            const [nameOrScope, nameOrFirstPath, ...pathPart] = parts;
                            const packageName = hasScope ? `${nameOrScope}/${nameOrFirstPath}` : nameOrScope;
                            const packageResult = await resolveUrl(packageName + '/package.json', previousResolvedModules);
                            if (packageResult.path) {
                                return (0, node_url_1.pathToFileURL)((0, node_path_1.join)((0, node_path_1.dirname)(packageResult.path), !hasScope && nameOrFirstPath ? nameOrFirstPath : '', ...pathPart));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc2Fzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCw4REFBaUM7QUFDakMsK0NBQTRDO0FBQzVDLHlDQUE2RDtBQUM3RCx1Q0FBd0Q7QUFheEQsSUFBSSxjQUFvRCxDQUFDO0FBRXpELFNBQVMsZUFBZSxDQUFDLEtBQWM7SUFDckMsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxhQUFhLElBQUksS0FBSyxDQUFDO0FBQ3hFLENBQUM7QUFFRCxTQUFnQixzQkFBc0I7SUFDcEMsY0FBYyxFQUFFLEtBQUssRUFBRSxDQUFDO0lBQ3hCLGNBQWMsR0FBRyxTQUFTLENBQUM7QUFDN0IsQ0FBQztBQUhELHdEQUdDO0FBRUQsU0FBZ0IsZ0JBQWdCLENBQUMsT0FBMEI7SUFDekQsT0FBTztRQUNMLElBQUksRUFBRSxjQUFjO1FBQ3BCLEtBQUssQ0FBQyxLQUFrQjtZQUN0QixNQUFNLFVBQVUsR0FBRyxLQUFLLEVBQUUsR0FBVyxFQUFFLHVCQUFxQyxFQUFFLEVBQUU7Z0JBQzlFLElBQUksTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUU7b0JBQ3BDLElBQUksRUFBRSxhQUFhO29CQUNuQixzRUFBc0U7b0JBQ3RFLGtFQUFrRTtvQkFDbEUsVUFBVSxFQUFFLEtBQUssQ0FBQyxjQUFjLENBQUMsYUFBYTtpQkFDL0MsQ0FBQyxDQUFDO2dCQUVILCtFQUErRTtnQkFDL0UsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksdUJBQXVCLEVBQUUsSUFBSSxF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QUFFO1lBQzFCLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFBLHdCQUFhLEVBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBRXhFLE9BQU87Z0JBQ0wsTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsTUFBTSxFQUFFO29CQUNOO3dCQUNFLElBQUksRUFBRSxLQUFLLENBQUMsT0FBTztxQkFDcEI7aUJBQ0Y7Z0JBQ0QsUUFBUTtnQkFDUixVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO2FBQ3RDLENBQUM7U0FDSDtRQUVELE1BQU0sS0FBSyxDQUFDO0tBQ2I7QUFDSCxDQUFDO0FBRUQsU0FBUyxxQkFBcUIsQ0FDNUIsU0FBeUQsRUFDekQsSUFBWTtJQUVaLGlHQUFpRztJQUNqRyxzREFBc0Q7SUFDdEQsU0FBUyxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsSUFBQSxvQkFBUSxFQUFDLElBQUksRUFBRSxJQUFBLHdCQUFhLEVBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTdGLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFeEYsT0FBTyxtRUFBbUUsWUFBWSxLQUFLLENBQUM7QUFDOUYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE9uTG9hZFJlc3VsdCwgUGFydGlhbE1lc3NhZ2UsIFBsdWdpbiwgUGx1Z2luQnVpbGQsIFJlc29sdmVSZXN1bHQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IGRpcm5hbWUsIGV4dG5hbWUsIGpvaW4sIHJlbGF0aXZlIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgdHlwZSB7IENvbXBpbGVSZXN1bHQsIEV4Y2VwdGlvbiwgU3ludGF4IH0gZnJvbSAnc2Fzcyc7XG5pbXBvcnQgdHlwZSB7XG4gIEZpbGVJbXBvcnRlcldpdGhSZXF1ZXN0Q29udGV4dE9wdGlvbnMsXG4gIFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbixcbn0gZnJvbSAnLi4vLi4vc2Fzcy9zYXNzLXNlcnZpY2UnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNhc3NQbHVnaW5PcHRpb25zIHtcbiAgc291cmNlbWFwOiBib29sZWFuO1xuICBsb2FkUGF0aHM/OiBzdHJpbmdbXTtcbiAgaW5saW5lQ29tcG9uZW50RGF0YT86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG59XG5cbmxldCBzYXNzV29ya2VyUG9vbDogU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uIHwgdW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc1Nhc3NFeGNlcHRpb24oZXJyb3I6IHVua25vd24pOiBlcnJvciBpcyBFeGNlcHRpb24ge1xuICByZXR1cm4gISFlcnJvciAmJiB0eXBlb2YgZXJyb3IgPT09ICdvYmplY3QnICYmICdzYXNzTWVzc2FnZScgaW4gZXJyb3I7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaHV0ZG93blNhc3NXb3JrZXJQb29sKCk6IHZvaWQge1xuICBzYXNzV29ya2VyUG9vbD8uY2xvc2UoKTtcbiAgc2Fzc1dvcmtlclBvb2wgPSB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTYXNzUGx1Z2luKG9wdGlvbnM6IFNhc3NQbHVnaW5PcHRpb25zKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1zYXNzJyxcbiAgICBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiB2b2lkIHtcbiAgICAgIGNvbnN0IHJlc29sdmVVcmwgPSBhc3luYyAodXJsOiBzdHJpbmcsIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzPzogU2V0PHN0cmluZz4pID0+IHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IGF3YWl0IGJ1aWxkLnJlc29sdmUodXJsLCB7XG4gICAgICAgICAga2luZDogJ2ltcG9ydC1ydWxlJyxcbiAgICAgICAgICAvLyBUaGlzIHNob3VsZCBpZGVhbGx5IGJlIHRoZSBkaXJlY3Rvcnkgb2YgdGhlIGltcG9ydGVyIGZpbGUgZnJvbSBTYXNzXG4gICAgICAgICAgLy8gYnV0IHRoYXQgaXMgbm90IGN1cnJlbnRseSBhdmFpbGFibGUgZnJvbSB0aGUgU2FzcyBpbXBvcnRlciBBUEkuXG4gICAgICAgICAgcmVzb2x2ZURpcjogYnVpbGQuaW5pdGlhbE9wdGlvbnMuYWJzV29ya2luZ0RpcixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gV29ya2Fyb3VuZCB0byBzdXBwb3J0IFlhcm4gUG5QIHdpdGhvdXQgYWNjZXNzIHRvIHRoZSBpbXBvcnRlciBmaWxlIGZyb20gU2Fzc1xuICAgICAgICBpZiAoIXJlc3VsdC5wYXRoICYmIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzPy5zaXplKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBwcmV2aW91cyBvZiBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcykge1xuICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZSh1cmwsIHtcbiAgICAgICAgICAgICAga2luZDogJ2ltcG9ydC1ydWxlJyxcbiAgICAgICAgICAgICAgcmVzb2x2ZURpcjogcHJldmlvdXMsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQucGF0aCkge1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXnNbYWNdc3M7LywgbmFtZXNwYWNlOiAnYW5ndWxhcjpzdHlsZXMvY29tcG9uZW50JyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICBjb25zdCBkYXRhID0gb3B0aW9ucy5pbmxpbmVDb21wb25lbnREYXRhPy5bYXJncy5wYXRoXTtcbiAgICAgICAgYXNzZXJ0KFxuICAgICAgICAgIHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJyxcbiAgICAgICAgICBgY29tcG9uZW50IHN0eWxlIG5hbWUgc2hvdWxkIGFsd2F5cyBiZSBmb3VuZCBbJHthcmdzLnBhdGh9XWAsXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgW2xhbmd1YWdlLCAsIGZpbGVQYXRoXSA9IGFyZ3MucGF0aC5zcGxpdCgnOycsIDMpO1xuICAgICAgICBjb25zdCBzeW50YXggPSBsYW5ndWFnZSA9PT0gJ3Nhc3MnID8gJ2luZGVudGVkJyA6ICdzY3NzJztcblxuICAgICAgICByZXR1cm4gY29tcGlsZVN0cmluZyhkYXRhLCBmaWxlUGF0aCwgc3ludGF4LCBvcHRpb25zLCByZXNvbHZlVXJsKTtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5zW2FjXXNzJC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlYWRGaWxlKGFyZ3MucGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgIGNvbnN0IHN5bnRheCA9IGV4dG5hbWUoYXJncy5wYXRoKS50b0xvd2VyQ2FzZSgpID09PSAnLnNhc3MnID8gJ2luZGVudGVkJyA6ICdzY3NzJztcblxuICAgICAgICByZXR1cm4gY29tcGlsZVN0cmluZyhkYXRhLCBhcmdzLnBhdGgsIHN5bnRheCwgb3B0aW9ucywgcmVzb2x2ZVVybCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBjb21waWxlU3RyaW5nKFxuICBkYXRhOiBzdHJpbmcsXG4gIGZpbGVQYXRoOiBzdHJpbmcsXG4gIHN5bnRheDogU3ludGF4LFxuICBvcHRpb25zOiBTYXNzUGx1Z2luT3B0aW9ucyxcbiAgcmVzb2x2ZVVybDogKHVybDogc3RyaW5nLCBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcz86IFNldDxzdHJpbmc+KSA9PiBQcm9taXNlPFJlc29sdmVSZXN1bHQ+LFxuKTogUHJvbWlzZTxPbkxvYWRSZXN1bHQ+IHtcbiAgLy8gTGF6aWx5IGxvYWQgU2FzcyB3aGVuIGEgU2FzcyBmaWxlIGlzIGZvdW5kXG4gIGlmIChzYXNzV29ya2VyUG9vbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3Qgc2Fzc1NlcnZpY2UgPSBhd2FpdCBpbXBvcnQoJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlJyk7XG4gICAgc2Fzc1dvcmtlclBvb2wgPSBuZXcgc2Fzc1NlcnZpY2UuU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uKHRydWUpO1xuICB9XG5cbiAgY29uc3Qgd2FybmluZ3M6IFBhcnRpYWxNZXNzYWdlW10gPSBbXTtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IGNzcywgc291cmNlTWFwLCBsb2FkZWRVcmxzIH0gPSBhd2FpdCBzYXNzV29ya2VyUG9vbC5jb21waWxlU3RyaW5nQXN5bmMoZGF0YSwge1xuICAgICAgdXJsOiBwYXRoVG9GaWxlVVJMKGZpbGVQYXRoKSxcbiAgICAgIHN0eWxlOiAnZXhwYW5kZWQnLFxuICAgICAgc3ludGF4LFxuICAgICAgbG9hZFBhdGhzOiBvcHRpb25zLmxvYWRQYXRocyxcbiAgICAgIHNvdXJjZU1hcDogb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICBzb3VyY2VNYXBJbmNsdWRlU291cmNlczogb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICBxdWlldERlcHM6IHRydWUsXG4gICAgICBpbXBvcnRlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGZpbmRGaWxlVXJsOiBhc3luYyAoXG4gICAgICAgICAgICB1cmwsXG4gICAgICAgICAgICB7IHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzIH06IEZpbGVJbXBvcnRlcldpdGhSZXF1ZXN0Q29udGV4dE9wdGlvbnMsXG4gICAgICAgICAgKTogUHJvbWlzZTxVUkwgfCBudWxsPiA9PiB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNvbHZlVXJsKHVybCwgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXMpO1xuXG4gICAgICAgICAgICAvLyBDaGVjayBmb3IgcGFja2FnZSBkZWVwIGltcG9ydHNcbiAgICAgICAgICAgIGlmICghcmVzdWx0LnBhdGgpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGFydHMgPSB1cmwuc3BsaXQoJy8nKTtcbiAgICAgICAgICAgICAgY29uc3QgaGFzU2NvcGUgPSBwYXJ0cy5sZW5ndGggPj0gMiAmJiBwYXJ0c1swXS5zdGFydHNXaXRoKCdAJyk7XG4gICAgICAgICAgICAgIGNvbnN0IFtuYW1lT3JTY29wZSwgbmFtZU9yRmlyc3RQYXRoLCAuLi5wYXRoUGFydF0gPSBwYXJ0cztcbiAgICAgICAgICAgICAgY29uc3QgcGFja2FnZU5hbWUgPSBoYXNTY29wZSA/IGAke25hbWVPclNjb3BlfS8ke25hbWVPckZpcnN0UGF0aH1gIDogbmFtZU9yU2NvcGU7XG5cbiAgICAgICAgICAgICAgY29uc3QgcGFja2FnZVJlc3VsdCA9IGF3YWl0IHJlc29sdmVVcmwoXG4gICAgICAgICAgICAgICAgcGFja2FnZU5hbWUgKyAnL3BhY2thZ2UuanNvbicsXG4gICAgICAgICAgICAgICAgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXMsXG4gICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgaWYgKHBhY2thZ2VSZXN1bHQucGF0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKFxuICAgICAgICAgICAgICAgICAgam9pbihcbiAgICAgICAgICAgICAgICAgICAgZGlybmFtZShwYWNrYWdlUmVzdWx0LnBhdGgpLFxuICAgICAgICAgICAgICAgICAgICAhaGFzU2NvcGUgJiYgbmFtZU9yRmlyc3RQYXRoID8gbmFtZU9yRmlyc3RQYXRoIDogJycsXG4gICAgICAgICAgICAgICAgICAgIC4uLnBhdGhQYXJ0LFxuICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQucGF0aCA/IHBhdGhUb0ZpbGVVUkwocmVzdWx0LnBhdGgpIDogbnVsbDtcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxvZ2dlcjoge1xuICAgICAgICB3YXJuOiAodGV4dCwgeyBkZXByZWNhdGlvbiwgc3BhbiB9KSA9PiB7XG4gICAgICAgICAgd2FybmluZ3MucHVzaCh7XG4gICAgICAgICAgICB0ZXh0OiBkZXByZWNhdGlvbiA/ICdEZXByZWNhdGlvbicgOiB0ZXh0LFxuICAgICAgICAgICAgbG9jYXRpb246IHNwYW4gJiYge1xuICAgICAgICAgICAgICBmaWxlOiBzcGFuLnVybCAmJiBmaWxlVVJMVG9QYXRoKHNwYW4udXJsKSxcbiAgICAgICAgICAgICAgbGluZVRleHQ6IHNwYW4uY29udGV4dCxcbiAgICAgICAgICAgICAgLy8gU2FzcyBsaW5lIG51bWJlcnMgYXJlIDAtYmFzZWQgd2hpbGUgZXNidWlsZCdzIGFyZSAxLWJhc2VkXG4gICAgICAgICAgICAgIGxpbmU6IHNwYW4uc3RhcnQubGluZSArIDEsXG4gICAgICAgICAgICAgIGNvbHVtbjogc3Bhbi5zdGFydC5jb2x1bW4sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbm90ZXM6IGRlcHJlY2F0aW9uID8gW3sgdGV4dCB9XSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgIGNvbnRlbnRzOiBzb3VyY2VNYXAgPyBgJHtjc3N9XFxuJHtzb3VyY2VNYXBUb1VybENvbW1lbnQoc291cmNlTWFwLCBkaXJuYW1lKGZpbGVQYXRoKSl9YCA6IGNzcyxcbiAgICAgIHdhdGNoRmlsZXM6IGxvYWRlZFVybHMubWFwKCh1cmwpID0+IGZpbGVVUkxUb1BhdGgodXJsKSksXG4gICAgICB3YXJuaW5ncyxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChpc1Nhc3NFeGNlcHRpb24oZXJyb3IpKSB7XG4gICAgICBjb25zdCBmaWxlID0gZXJyb3Iuc3Bhbi51cmwgPyBmaWxlVVJMVG9QYXRoKGVycm9yLnNwYW4udXJsKSA6IHVuZGVmaW5lZDtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdGV4dDogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICB3YXJuaW5ncyxcbiAgICAgICAgd2F0Y2hGaWxlczogZmlsZSA/IFtmaWxlXSA6IHVuZGVmaW5lZCxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cblxuZnVuY3Rpb24gc291cmNlTWFwVG9VcmxDb21tZW50KFxuICBzb3VyY2VNYXA6IEV4Y2x1ZGU8Q29tcGlsZVJlc3VsdFsnc291cmNlTWFwJ10sIHVuZGVmaW5lZD4sXG4gIHJvb3Q6IHN0cmluZyxcbik6IHN0cmluZyB7XG4gIC8vIFJlbW92ZSBgZmlsZWAgcHJvdG9jb2wgZnJvbSBhbGwgc291cmNlbWFwIHNvdXJjZXMgYW5kIGFkanVzdCB0byBiZSByZWxhdGl2ZSB0byB0aGUgaW5wdXQgZmlsZS5cbiAgLy8gVGhpcyBhbGxvd3MgZXNidWlsZCB0byBjb3JyZWN0bHkgcHJvY2VzcyB0aGUgcGF0aHMuXG4gIHNvdXJjZU1hcC5zb3VyY2VzID0gc291cmNlTWFwLnNvdXJjZXMubWFwKChzb3VyY2UpID0+IHJlbGF0aXZlKHJvb3QsIGZpbGVVUkxUb1BhdGgoc291cmNlKSkpO1xuXG4gIGNvbnN0IHVybFNvdXJjZU1hcCA9IEJ1ZmZlci5mcm9tKEpTT04uc3RyaW5naWZ5KHNvdXJjZU1hcCksICd1dGYtOCcpLnRvU3RyaW5nKCdiYXNlNjQnKTtcblxuICByZXR1cm4gYC8qIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zi04O2Jhc2U2NCwke3VybFNvdXJjZU1hcH0gKi9gO1xufVxuIl19