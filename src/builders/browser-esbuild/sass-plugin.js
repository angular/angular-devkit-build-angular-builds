"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSassPlugin = exports.shutdownSassWorkerPool = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
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
            build.onLoad({ filter: /^angular:styles\/component;s[ac]ss;/, namespace: 'angular:styles/component' }, async (args) => {
                var _a;
                const data = (_a = options.inlineComponentData) === null || _a === void 0 ? void 0 : _a[args.path];
                (0, node_assert_1.default)(data, `component style name should always be found [${args.path}]`);
                const [, language, , filePath] = args.path.split(';', 4);
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
    sassWorkerPool !== null && sassWorkerPool !== void 0 ? sassWorkerPool : (sassWorkerPool = new sass_service_1.SassWorkerImplementation(true));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc2Fzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsOERBQWlDO0FBQ2pDLCtDQUE0QztBQUM1Qyx5Q0FBNkQ7QUFDN0QsdUNBQXdEO0FBRXhELDBEQUdpQztBQVFqQyxJQUFJLGNBQW9ELENBQUM7QUFFekQsU0FBUyxlQUFlLENBQUMsS0FBYztJQUNyQyxPQUFPLENBQUMsQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLGFBQWEsSUFBSSxLQUFLLENBQUM7QUFDeEUsQ0FBQztBQUVELFNBQWdCLHNCQUFzQjtJQUNwQyxjQUFjLGFBQWQsY0FBYyx1QkFBZCxjQUFjLENBQUUsS0FBSyxFQUFFLENBQUM7SUFDeEIsY0FBYyxHQUFHLFNBQVMsQ0FBQztBQUM3QixDQUFDO0FBSEQsd0RBR0M7QUFFRCxTQUFnQixnQkFBZ0IsQ0FBQyxPQUEwQjtJQUN6RCxPQUFPO1FBQ0wsSUFBSSxFQUFFLGNBQWM7UUFDcEIsS0FBSyxDQUFDLEtBQWtCO1lBQ3RCLE1BQU0sVUFBVSxHQUFHLEtBQUssRUFBRSxHQUFXLEVBQUUsdUJBQXFDLEVBQUUsRUFBRTtnQkFDOUUsSUFBSSxNQUFNLEdBQUcsTUFBTSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtvQkFDcEMsSUFBSSxFQUFFLGFBQWE7b0JBQ25CLHNFQUFzRTtvQkFDdEUsa0VBQWtFO29CQUNsRSxVQUFVLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxhQUFhO2lCQUMvQyxDQUFDLENBQUM7Z0JBRUgsK0VBQStFO2dCQUMvRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSSx1QkFBdUIs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SUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBQSx3QkFBYSxFQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUV4RSxPQUFPO2dCQUNMLE1BQU0sRUFBRSxLQUFLO2dCQUNiLE1BQU0sRUFBRTtvQkFDTjt3QkFDRSxJQUFJLEVBQUUsS0FBSyxDQUFDLE9BQU87cUJBQ3BCO2lCQUNGO2dCQUNELFFBQVE7Z0JBQ1IsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUzthQUN0QyxDQUFDO1NBQ0g7UUFFRCxNQUFNLEtBQUssQ0FBQztLQUNiO0FBQ0gsQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQzVCLFNBQXlELEVBQ3pELElBQVk7SUFFWixpR0FBaUc7SUFDakcsc0RBQXNEO0lBQ3RELFNBQVMsQ0FBQyxPQUFPLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLElBQUEsb0JBQVEsRUFBQyxJQUFJLEVBQUUsSUFBQSx3QkFBYSxFQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUU3RixNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRXhGLE9BQU8sbUVBQW1FLFlBQVksS0FBSyxDQUFDO0FBQzlGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBPbkxvYWRSZXN1bHQsIFBhcnRpYWxNZXNzYWdlLCBQbHVnaW4sIFBsdWdpbkJ1aWxkLCBSZXNvbHZlUmVzdWx0IH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBkaXJuYW1lLCBleHRuYW1lLCBqb2luLCByZWxhdGl2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBwYXRoVG9GaWxlVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IHR5cGUgeyBDb21waWxlUmVzdWx0LCBFeGNlcHRpb24sIFN5bnRheCB9IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHtcbiAgRmlsZUltcG9ydGVyV2l0aFJlcXVlc3RDb250ZXh0T3B0aW9ucyxcbiAgU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uLFxufSBmcm9tICcuLi8uLi9zYXNzL3Nhc3Mtc2VydmljZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2Fzc1BsdWdpbk9wdGlvbnMge1xuICBzb3VyY2VtYXA6IGJvb2xlYW47XG4gIGxvYWRQYXRocz86IHN0cmluZ1tdO1xuICBpbmxpbmVDb21wb25lbnREYXRhPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbn1cblxubGV0IHNhc3NXb3JrZXJQb29sOiBTYXNzV29ya2VySW1wbGVtZW50YXRpb24gfCB1bmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzU2Fzc0V4Y2VwdGlvbihlcnJvcjogdW5rbm93bik6IGVycm9yIGlzIEV4Y2VwdGlvbiB7XG4gIHJldHVybiAhIWVycm9yICYmIHR5cGVvZiBlcnJvciA9PT0gJ29iamVjdCcgJiYgJ3Nhc3NNZXNzYWdlJyBpbiBlcnJvcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNodXRkb3duU2Fzc1dvcmtlclBvb2woKTogdm9pZCB7XG4gIHNhc3NXb3JrZXJQb29sPy5jbG9zZSgpO1xuICBzYXNzV29ya2VyUG9vbCA9IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNhc3NQbHVnaW4ob3B0aW9uczogU2Fzc1BsdWdpbk9wdGlvbnMpOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLXNhc3MnLFxuICAgIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IHZvaWQge1xuICAgICAgY29uc3QgcmVzb2x2ZVVybCA9IGFzeW5jICh1cmw6IHN0cmluZywgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXM/OiBTZXQ8c3RyaW5nPikgPT4ge1xuICAgICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZSh1cmwsIHtcbiAgICAgICAgICBraW5kOiAnaW1wb3J0LXJ1bGUnLFxuICAgICAgICAgIC8vIFRoaXMgc2hvdWxkIGlkZWFsbHkgYmUgdGhlIGRpcmVjdG9yeSBvZiB0aGUgaW1wb3J0ZXIgZmlsZSBmcm9tIFNhc3NcbiAgICAgICAgICAvLyBidXQgdGhhdCBpcyBub3QgY3VycmVudGx5IGF2YWlsYWJsZSBmcm9tIHRoZSBTYXNzIGltcG9ydGVyIEFQSS5cbiAgICAgICAgICByZXNvbHZlRGlyOiBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBXb3JrYXJvdW5kIHRvIHN1cHBvcnQgWWFybiBQblAgd2l0aG91dCBhY2Nlc3MgdG8gdGhlIGltcG9ydGVyIGZpbGUgZnJvbSBTYXNzXG4gICAgICAgIGlmICghcmVzdWx0LnBhdGggJiYgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXM/LnNpemUpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHByZXZpb3VzIG9mIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBidWlsZC5yZXNvbHZlKHVybCwge1xuICAgICAgICAgICAgICBraW5kOiAnaW1wb3J0LXJ1bGUnLFxuICAgICAgICAgICAgICByZXNvbHZlRGlyOiBwcmV2aW91cyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKHJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9O1xuXG4gICAgICBidWlsZC5vbkxvYWQoXG4gICAgICAgIHsgZmlsdGVyOiAvXmFuZ3VsYXI6c3R5bGVzXFwvY29tcG9uZW50O3NbYWNdc3M7LywgbmFtZXNwYWNlOiAnYW5ndWxhcjpzdHlsZXMvY29tcG9uZW50JyB9LFxuICAgICAgICBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAgIGNvbnN0IGRhdGEgPSBvcHRpb25zLmlubGluZUNvbXBvbmVudERhdGE/LlthcmdzLnBhdGhdO1xuICAgICAgICAgIGFzc2VydChkYXRhLCBgY29tcG9uZW50IHN0eWxlIG5hbWUgc2hvdWxkIGFsd2F5cyBiZSBmb3VuZCBbJHthcmdzLnBhdGh9XWApO1xuXG4gICAgICAgICAgY29uc3QgWywgbGFuZ3VhZ2UsICwgZmlsZVBhdGhdID0gYXJncy5wYXRoLnNwbGl0KCc7JywgNCk7XG4gICAgICAgICAgY29uc3Qgc3ludGF4ID0gbGFuZ3VhZ2UgPT09ICdzYXNzJyA/ICdpbmRlbnRlZCcgOiAnc2Nzcyc7XG5cbiAgICAgICAgICByZXR1cm4gY29tcGlsZVN0cmluZyhkYXRhLCBmaWxlUGF0aCwgc3ludGF4LCBvcHRpb25zLCByZXNvbHZlVXJsKTtcbiAgICAgICAgfSxcbiAgICAgICk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLnNbYWNdc3MkLyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVhZEZpbGUoYXJncy5wYXRoLCAndXRmLTgnKTtcbiAgICAgICAgY29uc3Qgc3ludGF4ID0gZXh0bmFtZShhcmdzLnBhdGgpLnRvTG93ZXJDYXNlKCkgPT09ICcuc2FzcycgPyAnaW5kZW50ZWQnIDogJ3Njc3MnO1xuXG4gICAgICAgIHJldHVybiBjb21waWxlU3RyaW5nKGRhdGEsIGFyZ3MucGF0aCwgc3ludGF4LCBvcHRpb25zLCByZXNvbHZlVXJsKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNvbXBpbGVTdHJpbmcoXG4gIGRhdGE6IHN0cmluZyxcbiAgZmlsZVBhdGg6IHN0cmluZyxcbiAgc3ludGF4OiBTeW50YXgsXG4gIG9wdGlvbnM6IFNhc3NQbHVnaW5PcHRpb25zLFxuICByZXNvbHZlVXJsOiAodXJsOiBzdHJpbmcsIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzPzogU2V0PHN0cmluZz4pID0+IFByb21pc2U8UmVzb2x2ZVJlc3VsdD4sXG4pOiBQcm9taXNlPE9uTG9hZFJlc3VsdD4ge1xuICAvLyBMYXppbHkgbG9hZCBTYXNzIHdoZW4gYSBTYXNzIGZpbGUgaXMgZm91bmRcbiAgc2Fzc1dvcmtlclBvb2wgPz89IG5ldyBTYXNzV29ya2VySW1wbGVtZW50YXRpb24odHJ1ZSk7XG5cbiAgY29uc3Qgd2FybmluZ3M6IFBhcnRpYWxNZXNzYWdlW10gPSBbXTtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IGNzcywgc291cmNlTWFwLCBsb2FkZWRVcmxzIH0gPSBhd2FpdCBzYXNzV29ya2VyUG9vbC5jb21waWxlU3RyaW5nQXN5bmMoZGF0YSwge1xuICAgICAgdXJsOiBwYXRoVG9GaWxlVVJMKGZpbGVQYXRoKSxcbiAgICAgIHN0eWxlOiAnZXhwYW5kZWQnLFxuICAgICAgc3ludGF4LFxuICAgICAgbG9hZFBhdGhzOiBvcHRpb25zLmxvYWRQYXRocyxcbiAgICAgIHNvdXJjZU1hcDogb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICBzb3VyY2VNYXBJbmNsdWRlU291cmNlczogb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICBxdWlldERlcHM6IHRydWUsXG4gICAgICBpbXBvcnRlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGZpbmRGaWxlVXJsOiBhc3luYyAoXG4gICAgICAgICAgICB1cmwsXG4gICAgICAgICAgICB7IHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzIH06IEZpbGVJbXBvcnRlcldpdGhSZXF1ZXN0Q29udGV4dE9wdGlvbnMsXG4gICAgICAgICAgKTogUHJvbWlzZTxVUkwgfCBudWxsPiA9PiB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNvbHZlVXJsKHVybCwgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXMpO1xuXG4gICAgICAgICAgICAvLyBDaGVjayBmb3IgcGFja2FnZSBkZWVwIGltcG9ydHNcbiAgICAgICAgICAgIGlmICghcmVzdWx0LnBhdGgpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGFydHMgPSB1cmwuc3BsaXQoJy8nKTtcbiAgICAgICAgICAgICAgY29uc3QgaGFzU2NvcGUgPSBwYXJ0cy5sZW5ndGggPj0gMiAmJiBwYXJ0c1swXS5zdGFydHNXaXRoKCdAJyk7XG4gICAgICAgICAgICAgIGNvbnN0IFtuYW1lT3JTY29wZSwgbmFtZU9yRmlyc3RQYXRoLCAuLi5wYXRoUGFydF0gPSBwYXJ0cztcbiAgICAgICAgICAgICAgY29uc3QgcGFja2FnZU5hbWUgPSBoYXNTY29wZSA/IGAke25hbWVPclNjb3BlfS8ke25hbWVPckZpcnN0UGF0aH1gIDogbmFtZU9yU2NvcGU7XG5cbiAgICAgICAgICAgICAgY29uc3QgcGFja2FnZVJlc3VsdCA9IGF3YWl0IHJlc29sdmVVcmwoXG4gICAgICAgICAgICAgICAgcGFja2FnZU5hbWUgKyAnL3BhY2thZ2UuanNvbicsXG4gICAgICAgICAgICAgICAgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXMsXG4gICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgaWYgKHBhY2thZ2VSZXN1bHQucGF0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBwYXRoVG9GaWxlVVJMKFxuICAgICAgICAgICAgICAgICAgam9pbihkaXJuYW1lKHBhY2thZ2VSZXN1bHQucGF0aCksICFoYXNTY29wZSA/IG5hbWVPckZpcnN0UGF0aCA6ICcnLCAuLi5wYXRoUGFydCksXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0LnBhdGggPyBwYXRoVG9GaWxlVVJMKHJlc3VsdC5wYXRoKSA6IG51bGw7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBsb2dnZXI6IHtcbiAgICAgICAgd2FybjogKHRleHQsIHsgZGVwcmVjYXRpb24sIHNwYW4gfSkgPT4ge1xuICAgICAgICAgIHdhcm5pbmdzLnB1c2goe1xuICAgICAgICAgICAgdGV4dDogZGVwcmVjYXRpb24gPyAnRGVwcmVjYXRpb24nIDogdGV4dCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiBzcGFuICYmIHtcbiAgICAgICAgICAgICAgZmlsZTogc3Bhbi51cmwgJiYgZmlsZVVSTFRvUGF0aChzcGFuLnVybCksXG4gICAgICAgICAgICAgIGxpbmVUZXh0OiBzcGFuLmNvbnRleHQsXG4gICAgICAgICAgICAgIC8vIFNhc3MgbGluZSBudW1iZXJzIGFyZSAwLWJhc2VkIHdoaWxlIGVzYnVpbGQncyBhcmUgMS1iYXNlZFxuICAgICAgICAgICAgICBsaW5lOiBzcGFuLnN0YXJ0LmxpbmUgKyAxLFxuICAgICAgICAgICAgICBjb2x1bW46IHNwYW4uc3RhcnQuY29sdW1uLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vdGVzOiBkZXByZWNhdGlvbiA/IFt7IHRleHQgfV0gOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICBjb250ZW50czogc291cmNlTWFwID8gYCR7Y3NzfVxcbiR7c291cmNlTWFwVG9VcmxDb21tZW50KHNvdXJjZU1hcCwgZGlybmFtZShmaWxlUGF0aCkpfWAgOiBjc3MsXG4gICAgICB3YXRjaEZpbGVzOiBsb2FkZWRVcmxzLm1hcCgodXJsKSA9PiBmaWxlVVJMVG9QYXRoKHVybCkpLFxuICAgICAgd2FybmluZ3MsXG4gICAgfTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoaXNTYXNzRXhjZXB0aW9uKGVycm9yKSkge1xuICAgICAgY29uc3QgZmlsZSA9IGVycm9yLnNwYW4udXJsID8gZmlsZVVSTFRvUGF0aChlcnJvci5zcGFuLnVybCkgOiB1bmRlZmluZWQ7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICAgIGVycm9yczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRleHQ6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgd2FybmluZ3MsXG4gICAgICAgIHdhdGNoRmlsZXM6IGZpbGUgPyBbZmlsZV0gOiB1bmRlZmluZWQsXG4gICAgICB9O1xuICAgIH1cblxuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNvdXJjZU1hcFRvVXJsQ29tbWVudChcbiAgc291cmNlTWFwOiBFeGNsdWRlPENvbXBpbGVSZXN1bHRbJ3NvdXJjZU1hcCddLCB1bmRlZmluZWQ+LFxuICByb290OiBzdHJpbmcsXG4pOiBzdHJpbmcge1xuICAvLyBSZW1vdmUgYGZpbGVgIHByb3RvY29sIGZyb20gYWxsIHNvdXJjZW1hcCBzb3VyY2VzIGFuZCBhZGp1c3QgdG8gYmUgcmVsYXRpdmUgdG8gdGhlIGlucHV0IGZpbGUuXG4gIC8vIFRoaXMgYWxsb3dzIGVzYnVpbGQgdG8gY29ycmVjdGx5IHByb2Nlc3MgdGhlIHBhdGhzLlxuICBzb3VyY2VNYXAuc291cmNlcyA9IHNvdXJjZU1hcC5zb3VyY2VzLm1hcCgoc291cmNlKSA9PiByZWxhdGl2ZShyb290LCBmaWxlVVJMVG9QYXRoKHNvdXJjZSkpKTtcblxuICBjb25zdCB1cmxTb3VyY2VNYXAgPSBCdWZmZXIuZnJvbShKU09OLnN0cmluZ2lmeShzb3VyY2VNYXApLCAndXRmLTgnKS50b1N0cmluZygnYmFzZTY0Jyk7XG5cbiAgcmV0dXJuIGAvKiMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD11dGYtODtiYXNlNjQsJHt1cmxTb3VyY2VNYXB9ICovYDtcbn1cbiJdfQ==