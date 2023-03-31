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
    sassWorkerPool ?? (sassWorkerPool = new sass_service_1.SassWorkerImplementation(true));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc2Fzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsOERBQWlDO0FBQ2pDLCtDQUE0QztBQUM1Qyx5Q0FBNkQ7QUFDN0QsdUNBQXdEO0FBRXhELDBEQUdpQztBQVFqQyxJQUFJLGNBQW9ELENBQUM7QUFFekQsU0FBUyxlQUFlLENBQUMsS0FBYztJQUNyQyxPQUFPLENBQUMsQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLGFBQWEsSUFBSSxLQUFLLENBQUM7QUFDeEUsQ0FBQztBQUVELFNBQWdCLHNCQUFzQjtJQUNwQyxjQUFjLEVBQUUsS0FBSyxFQUFFLENBQUM7SUFDeEIsY0FBYyxHQUFHLFNBQVMsQ0FBQztBQUM3QixDQUFDO0FBSEQsd0RBR0M7QUFFRCxTQUFnQixnQkFBZ0IsQ0FBQyxPQUEwQjtJQUN6RCxPQUFPO1FBQ0wsSUFBSSxFQUFFLGNBQWM7UUFDcEIsS0FBSyxDQUFDLEtBQWtCO1lBQ3RCLE1BQU0sVUFBVSxHQUFHLEtBQUssRUFBRSxHQUFXLEVBQUUsdUJBQXFDLEVBQUUsRUFBRTtnQkFDOUUsSUFBSSxNQUFNLEdBQUcsTUFBTSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtvQkFDcEMsSUFBSSxFQUFFLGFBQWE7b0JBQ25CLHNFQUFzRTtvQkFDdEUsa0VBQWtFO29CQUNsRSxVQUFVLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxhQUFhO2lCQUMvQyxDQUFDLENBQUM7Z0JBRUgsK0VBQStFO2dCQUMvRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSx1QkFBdUIsRUFBRSxJQUFJLEVBQUU7b0JBQ2pE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LElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBRXhFLE9BQU87Z0JBQ0wsTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsTUFBTSxFQUFFO29CQUNOO3dCQUNFLElBQUksRUFBRSxLQUFLLENBQUMsT0FBTztxQkFDcEI7aUJBQ0Y7Z0JBQ0QsUUFBUTtnQkFDUixVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO2FBQ3RDLENBQUM7U0FDSDtRQUVELE1BQU0sS0FBSyxDQUFDO0tBQ2I7QUFDSCxDQUFDO0FBRUQsU0FBUyxxQkFBcUIsQ0FDNUIsU0FBeUQsRUFDekQsSUFBWTtJQUVaLGlHQUFpRztJQUNqRyxzREFBc0Q7SUFDdEQsU0FBUyxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsSUFBQSxvQkFBUSxFQUFDLElBQUksRUFBRSxJQUFBLHdCQUFhLEVBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTdGLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFeEYsT0FBTyxtRUFBbUUsWUFBWSxLQUFLLENBQUM7QUFDOUYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE9uTG9hZFJlc3VsdCwgUGFydGlhbE1lc3NhZ2UsIFBsdWdpbiwgUGx1Z2luQnVpbGQsIFJlc29sdmVSZXN1bHQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IGRpcm5hbWUsIGV4dG5hbWUsIGpvaW4sIHJlbGF0aXZlIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgdHlwZSB7IENvbXBpbGVSZXN1bHQsIEV4Y2VwdGlvbiwgU3ludGF4IH0gZnJvbSAnc2Fzcyc7XG5pbXBvcnQge1xuICBGaWxlSW1wb3J0ZXJXaXRoUmVxdWVzdENvbnRleHRPcHRpb25zLFxuICBTYXNzV29ya2VySW1wbGVtZW50YXRpb24sXG59IGZyb20gJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlJztcblxuZXhwb3J0IGludGVyZmFjZSBTYXNzUGx1Z2luT3B0aW9ucyB7XG4gIHNvdXJjZW1hcDogYm9vbGVhbjtcbiAgbG9hZFBhdGhzPzogc3RyaW5nW107XG4gIGlubGluZUNvbXBvbmVudERhdGE/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xufVxuXG5sZXQgc2Fzc1dvcmtlclBvb2w6IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbiB8IHVuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNTYXNzRXhjZXB0aW9uKGVycm9yOiB1bmtub3duKTogZXJyb3IgaXMgRXhjZXB0aW9uIHtcbiAgcmV0dXJuICEhZXJyb3IgJiYgdHlwZW9mIGVycm9yID09PSAnb2JqZWN0JyAmJiAnc2Fzc01lc3NhZ2UnIGluIGVycm9yO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2h1dGRvd25TYXNzV29ya2VyUG9vbCgpOiB2b2lkIHtcbiAgc2Fzc1dvcmtlclBvb2w/LmNsb3NlKCk7XG4gIHNhc3NXb3JrZXJQb29sID0gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2Fzc1BsdWdpbihvcHRpb25zOiBTYXNzUGx1Z2luT3B0aW9ucyk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItc2FzcycsXG4gICAgc2V0dXAoYnVpbGQ6IFBsdWdpbkJ1aWxkKTogdm9pZCB7XG4gICAgICBjb25zdCByZXNvbHZlVXJsID0gYXN5bmMgKHVybDogc3RyaW5nLCBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcz86IFNldDxzdHJpbmc+KSA9PiB7XG4gICAgICAgIGxldCByZXN1bHQgPSBhd2FpdCBidWlsZC5yZXNvbHZlKHVybCwge1xuICAgICAgICAgIGtpbmQ6ICdpbXBvcnQtcnVsZScsXG4gICAgICAgICAgLy8gVGhpcyBzaG91bGQgaWRlYWxseSBiZSB0aGUgZGlyZWN0b3J5IG9mIHRoZSBpbXBvcnRlciBmaWxlIGZyb20gU2Fzc1xuICAgICAgICAgIC8vIGJ1dCB0aGF0IGlzIG5vdCBjdXJyZW50bHkgYXZhaWxhYmxlIGZyb20gdGhlIFNhc3MgaW1wb3J0ZXIgQVBJLlxuICAgICAgICAgIHJlc29sdmVEaXI6IGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFdvcmthcm91bmQgdG8gc3VwcG9ydCBZYXJuIFBuUCB3aXRob3V0IGFjY2VzcyB0byB0aGUgaW1wb3J0ZXIgZmlsZSBmcm9tIFNhc3NcbiAgICAgICAgaWYgKCFyZXN1bHQucGF0aCAmJiBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcz8uc2l6ZSkge1xuICAgICAgICAgIGZvciAoY29uc3QgcHJldmlvdXMgb2YgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXMpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGJ1aWxkLnJlc29sdmUodXJsLCB7XG4gICAgICAgICAgICAgIGtpbmQ6ICdpbXBvcnQtcnVsZScsXG4gICAgICAgICAgICAgIHJlc29sdmVEaXI6IHByZXZpb3VzLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAocmVzdWx0LnBhdGgpIHtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH07XG5cbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL15zW2FjXXNzOy8sIG5hbWVzcGFjZTogJ2FuZ3VsYXI6c3R5bGVzL2NvbXBvbmVudCcgfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgZGF0YSA9IG9wdGlvbnMuaW5saW5lQ29tcG9uZW50RGF0YT8uW2FyZ3MucGF0aF07XG4gICAgICAgIGFzc2VydChcbiAgICAgICAgICB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycsXG4gICAgICAgICAgYGNvbXBvbmVudCBzdHlsZSBuYW1lIHNob3VsZCBhbHdheXMgYmUgZm91bmQgWyR7YXJncy5wYXRofV1gLFxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IFtsYW5ndWFnZSwgLCBmaWxlUGF0aF0gPSBhcmdzLnBhdGguc3BsaXQoJzsnLCAzKTtcbiAgICAgICAgY29uc3Qgc3ludGF4ID0gbGFuZ3VhZ2UgPT09ICdzYXNzJyA/ICdpbmRlbnRlZCcgOiAnc2Nzcyc7XG5cbiAgICAgICAgcmV0dXJuIGNvbXBpbGVTdHJpbmcoZGF0YSwgZmlsZVBhdGgsIHN5bnRheCwgb3B0aW9ucywgcmVzb2x2ZVVybCk7XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuc1thY11zcyQvIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZWFkRmlsZShhcmdzLnBhdGgsICd1dGYtOCcpO1xuICAgICAgICBjb25zdCBzeW50YXggPSBleHRuYW1lKGFyZ3MucGF0aCkudG9Mb3dlckNhc2UoKSA9PT0gJy5zYXNzJyA/ICdpbmRlbnRlZCcgOiAnc2Nzcyc7XG5cbiAgICAgICAgcmV0dXJuIGNvbXBpbGVTdHJpbmcoZGF0YSwgYXJncy5wYXRoLCBzeW50YXgsIG9wdGlvbnMsIHJlc29sdmVVcmwpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gY29tcGlsZVN0cmluZyhcbiAgZGF0YTogc3RyaW5nLFxuICBmaWxlUGF0aDogc3RyaW5nLFxuICBzeW50YXg6IFN5bnRheCxcbiAgb3B0aW9uczogU2Fzc1BsdWdpbk9wdGlvbnMsXG4gIHJlc29sdmVVcmw6ICh1cmw6IHN0cmluZywgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXM/OiBTZXQ8c3RyaW5nPikgPT4gUHJvbWlzZTxSZXNvbHZlUmVzdWx0Pixcbik6IFByb21pc2U8T25Mb2FkUmVzdWx0PiB7XG4gIC8vIExhemlseSBsb2FkIFNhc3Mgd2hlbiBhIFNhc3MgZmlsZSBpcyBmb3VuZFxuICBzYXNzV29ya2VyUG9vbCA/Pz0gbmV3IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbih0cnVlKTtcblxuICBjb25zdCB3YXJuaW5nczogUGFydGlhbE1lc3NhZ2VbXSA9IFtdO1xuICB0cnkge1xuICAgIGNvbnN0IHsgY3NzLCBzb3VyY2VNYXAsIGxvYWRlZFVybHMgfSA9IGF3YWl0IHNhc3NXb3JrZXJQb29sLmNvbXBpbGVTdHJpbmdBc3luYyhkYXRhLCB7XG4gICAgICB1cmw6IHBhdGhUb0ZpbGVVUkwoZmlsZVBhdGgpLFxuICAgICAgc3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICBzeW50YXgsXG4gICAgICBsb2FkUGF0aHM6IG9wdGlvbnMubG9hZFBhdGhzLFxuICAgICAgc291cmNlTWFwOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgIHNvdXJjZU1hcEluY2x1ZGVTb3VyY2VzOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgIHF1aWV0RGVwczogdHJ1ZSxcbiAgICAgIGltcG9ydGVyczogW1xuICAgICAgICB7XG4gICAgICAgICAgZmluZEZpbGVVcmw6IGFzeW5jIChcbiAgICAgICAgICAgIHVybCxcbiAgICAgICAgICAgIHsgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXMgfTogRmlsZUltcG9ydGVyV2l0aFJlcXVlc3RDb250ZXh0T3B0aW9ucyxcbiAgICAgICAgICApOiBQcm9taXNlPFVSTCB8IG51bGw+ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc29sdmVVcmwodXJsLCBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcyk7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGZvciBwYWNrYWdlIGRlZXAgaW1wb3J0c1xuICAgICAgICAgICAgaWYgKCFyZXN1bHQucGF0aCkge1xuICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IHVybC5zcGxpdCgnLycpO1xuICAgICAgICAgICAgICBjb25zdCBoYXNTY29wZSA9IHBhcnRzLmxlbmd0aCA+PSAyICYmIHBhcnRzWzBdLnN0YXJ0c1dpdGgoJ0AnKTtcbiAgICAgICAgICAgICAgY29uc3QgW25hbWVPclNjb3BlLCBuYW1lT3JGaXJzdFBhdGgsIC4uLnBhdGhQYXJ0XSA9IHBhcnRzO1xuICAgICAgICAgICAgICBjb25zdCBwYWNrYWdlTmFtZSA9IGhhc1Njb3BlID8gYCR7bmFtZU9yU2NvcGV9LyR7bmFtZU9yRmlyc3RQYXRofWAgOiBuYW1lT3JTY29wZTtcblxuICAgICAgICAgICAgICBjb25zdCBwYWNrYWdlUmVzdWx0ID0gYXdhaXQgcmVzb2x2ZVVybChcbiAgICAgICAgICAgICAgICBwYWNrYWdlTmFtZSArICcvcGFja2FnZS5qc29uJyxcbiAgICAgICAgICAgICAgICBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcyxcbiAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICBpZiAocGFja2FnZVJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhdGhUb0ZpbGVVUkwoXG4gICAgICAgICAgICAgICAgICBqb2luKFxuICAgICAgICAgICAgICAgICAgICBkaXJuYW1lKHBhY2thZ2VSZXN1bHQucGF0aCksXG4gICAgICAgICAgICAgICAgICAgICFoYXNTY29wZSAmJiBuYW1lT3JGaXJzdFBhdGggPyBuYW1lT3JGaXJzdFBhdGggOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgLi4ucGF0aFBhcnQsXG4gICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC5wYXRoID8gcGF0aFRvRmlsZVVSTChyZXN1bHQucGF0aCkgOiBudWxsO1xuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgbG9nZ2VyOiB7XG4gICAgICAgIHdhcm46ICh0ZXh0LCB7IGRlcHJlY2F0aW9uLCBzcGFuIH0pID0+IHtcbiAgICAgICAgICB3YXJuaW5ncy5wdXNoKHtcbiAgICAgICAgICAgIHRleHQ6IGRlcHJlY2F0aW9uID8gJ0RlcHJlY2F0aW9uJyA6IHRleHQsXG4gICAgICAgICAgICBsb2NhdGlvbjogc3BhbiAmJiB7XG4gICAgICAgICAgICAgIGZpbGU6IHNwYW4udXJsICYmIGZpbGVVUkxUb1BhdGgoc3Bhbi51cmwpLFxuICAgICAgICAgICAgICBsaW5lVGV4dDogc3Bhbi5jb250ZXh0LFxuICAgICAgICAgICAgICAvLyBTYXNzIGxpbmUgbnVtYmVycyBhcmUgMC1iYXNlZCB3aGlsZSBlc2J1aWxkJ3MgYXJlIDEtYmFzZWRcbiAgICAgICAgICAgICAgbGluZTogc3Bhbi5zdGFydC5saW5lICsgMSxcbiAgICAgICAgICAgICAgY29sdW1uOiBzcGFuLnN0YXJ0LmNvbHVtbixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub3RlczogZGVwcmVjYXRpb24gPyBbeyB0ZXh0IH1dIDogdW5kZWZpbmVkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgY29udGVudHM6IHNvdXJjZU1hcCA/IGAke2Nzc31cXG4ke3NvdXJjZU1hcFRvVXJsQ29tbWVudChzb3VyY2VNYXAsIGRpcm5hbWUoZmlsZVBhdGgpKX1gIDogY3NzLFxuICAgICAgd2F0Y2hGaWxlczogbG9hZGVkVXJscy5tYXAoKHVybCkgPT4gZmlsZVVSTFRvUGF0aCh1cmwpKSxcbiAgICAgIHdhcm5pbmdzLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGlzU2Fzc0V4Y2VwdGlvbihlcnJvcikpIHtcbiAgICAgIGNvbnN0IGZpbGUgPSBlcnJvci5zcGFuLnVybCA/IGZpbGVVUkxUb1BhdGgoZXJyb3Iuc3Bhbi51cmwpIDogdW5kZWZpbmVkO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0ZXh0OiBlcnJvci5tZXNzYWdlLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHdhcm5pbmdzLFxuICAgICAgICB3YXRjaEZpbGVzOiBmaWxlID8gW2ZpbGVdIDogdW5kZWZpbmVkLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5mdW5jdGlvbiBzb3VyY2VNYXBUb1VybENvbW1lbnQoXG4gIHNvdXJjZU1hcDogRXhjbHVkZTxDb21waWxlUmVzdWx0Wydzb3VyY2VNYXAnXSwgdW5kZWZpbmVkPixcbiAgcm9vdDogc3RyaW5nLFxuKTogc3RyaW5nIHtcbiAgLy8gUmVtb3ZlIGBmaWxlYCBwcm90b2NvbCBmcm9tIGFsbCBzb3VyY2VtYXAgc291cmNlcyBhbmQgYWRqdXN0IHRvIGJlIHJlbGF0aXZlIHRvIHRoZSBpbnB1dCBmaWxlLlxuICAvLyBUaGlzIGFsbG93cyBlc2J1aWxkIHRvIGNvcnJlY3RseSBwcm9jZXNzIHRoZSBwYXRocy5cbiAgc291cmNlTWFwLnNvdXJjZXMgPSBzb3VyY2VNYXAuc291cmNlcy5tYXAoKHNvdXJjZSkgPT4gcmVsYXRpdmUocm9vdCwgZmlsZVVSTFRvUGF0aChzb3VyY2UpKSk7XG5cbiAgY29uc3QgdXJsU291cmNlTWFwID0gQnVmZmVyLmZyb20oSlNPTi5zdHJpbmdpZnkoc291cmNlTWFwKSwgJ3V0Zi04JykudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuXG4gIHJldHVybiBgLyojIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTg7YmFzZTY0LCR7dXJsU291cmNlTWFwfSAqL2A7XG59XG4iXX0=