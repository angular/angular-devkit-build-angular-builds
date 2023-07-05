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
exports.StylesheetPluginFactory = void 0;
const fast_glob_1 = __importDefault(require("fast-glob"));
const node_assert_1 = __importDefault(require("node:assert"));
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const load_result_cache_1 = require("../load-result-cache");
/**
 * The lazy-loaded instance of the postcss stylesheet postprocessor.
 * It is only imported and initialized if postcss is needed.
 */
let postcss;
class StylesheetPluginFactory {
    constructor(options, cache) {
        this.options = options;
        this.cache = cache;
    }
    create(language) {
        // Return a noop plugin if no load actions are required
        if (!language.process && !this.options.tailwindConfiguration) {
            return {
                name: 'angular-' + language.name,
                setup() { },
            };
        }
        const { cache, options } = this;
        return {
            name: 'angular-' + language.name,
            async setup(build) {
                // Setup postcss if needed by tailwind
                // TODO: Move this into the plugin factory to avoid repeat setup per created plugin
                let postcssProcessor;
                if (options.tailwindConfiguration) {
                    postcss ?? (postcss = (await Promise.resolve().then(() => __importStar(require('postcss')))).default);
                    postcssProcessor = postcss();
                    if (options.tailwindConfiguration) {
                        const tailwind = await Promise.resolve(`${options.tailwindConfiguration.package}`).then(s => __importStar(require(s)));
                        postcssProcessor.use(tailwind.default({ config: options.tailwindConfiguration.file }));
                    }
                }
                // Add a load callback to support inline Component styles
                build.onLoad({ filter: language.componentFilter, namespace: 'angular:styles/component' }, (0, load_result_cache_1.createCachedLoad)(cache, (args) => {
                    const data = options.inlineComponentData?.[args.path];
                    (0, node_assert_1.default)(typeof data === 'string', `component style name should always be found [${args.path}]`);
                    const [format, , filename] = args.path.split(';', 3);
                    return processStylesheet(language, data, filename, format, options, build, postcssProcessor);
                }));
                // Add a load callback to support files from disk
                build.onLoad({ filter: language.fileFilter }, (0, load_result_cache_1.createCachedLoad)(cache, async (args) => {
                    const data = await (0, promises_1.readFile)(args.path, 'utf-8');
                    return processStylesheet(language, data, args.path, (0, node_path_1.extname)(args.path).toLowerCase().slice(1), options, build, postcssProcessor);
                }));
            },
        };
    }
}
exports.StylesheetPluginFactory = StylesheetPluginFactory;
async function processStylesheet(language, data, filename, format, options, build, postcssProcessor) {
    let result;
    // Process the input data if the language requires preprocessing
    if (language.process) {
        result = await language.process(data, filename, format, options, build);
    }
    else {
        result = {
            contents: data,
            loader: 'css',
            watchFiles: [filename],
        };
    }
    // Transform with postcss if needed and there are no errors
    if (postcssProcessor && result.contents && !result.errors?.length) {
        const postcssResult = await compileString(typeof result.contents === 'string'
            ? result.contents
            : Buffer.from(result.contents).toString('utf-8'), filename, postcssProcessor, options);
        // Merge results
        if (postcssResult.errors?.length) {
            delete result.contents;
        }
        if (result.warnings && postcssResult.warnings) {
            postcssResult.warnings.unshift(...result.warnings);
        }
        if (result.watchFiles && postcssResult.watchFiles) {
            postcssResult.watchFiles.unshift(...result.watchFiles);
        }
        if (result.watchDirs && postcssResult.watchDirs) {
            postcssResult.watchDirs.unshift(...result.watchDirs);
        }
        result = {
            ...result,
            ...postcssResult,
        };
    }
    return result;
}
/**
 * Compiles the provided CSS stylesheet data using a provided postcss processor and provides an
 * esbuild load result that can be used directly by an esbuild Plugin.
 * @param data The stylesheet content to process.
 * @param filename The name of the file that contains the data.
 * @param postcssProcessor A postcss processor instance to use.
 * @param options The plugin options to control the processing.
 * @returns An esbuild OnLoaderResult object with the processed content, warnings, and/or errors.
 */
async function compileString(data, filename, postcssProcessor, options) {
    try {
        const postcssResult = await postcssProcessor.process(data, {
            from: filename,
            to: filename,
            map: options.sourcemap && {
                inline: true,
                sourcesContent: true,
            },
        });
        const loadResult = {
            contents: postcssResult.css,
            loader: 'css',
        };
        const rawWarnings = postcssResult.warnings();
        if (rawWarnings.length > 0) {
            const lineMappings = new Map();
            loadResult.warnings = rawWarnings.map((warning) => {
                const file = warning.node.source?.input.file;
                if (file === undefined) {
                    return { text: warning.text };
                }
                let lines = lineMappings.get(file);
                if (lines === undefined) {
                    lines = warning.node.source?.input.css.split(/\r?\n/);
                    lineMappings.set(file, lines ?? null);
                }
                return {
                    text: warning.text,
                    location: {
                        file,
                        line: warning.line,
                        column: warning.column - 1,
                        lineText: lines?.[warning.line - 1],
                    },
                };
            });
        }
        for (const resultMessage of postcssResult.messages) {
            if (resultMessage.type === 'dependency' && typeof resultMessage['file'] === 'string') {
                loadResult.watchFiles ?? (loadResult.watchFiles = []);
                loadResult.watchFiles.push(resultMessage['file']);
            }
            else if (resultMessage.type === 'dir-dependency' &&
                typeof resultMessage['dir'] === 'string' &&
                typeof resultMessage['glob'] === 'string') {
                loadResult.watchFiles ?? (loadResult.watchFiles = []);
                const dependencies = await (0, fast_glob_1.default)(resultMessage['glob'], {
                    absolute: true,
                    cwd: resultMessage['dir'],
                });
                loadResult.watchFiles.push(...dependencies);
            }
        }
        return loadResult;
    }
    catch (error) {
        postcss ?? (postcss = (await Promise.resolve().then(() => __importStar(require('postcss')))).default);
        if (error instanceof postcss.CssSyntaxError) {
            const lines = error.source?.split(/\r?\n/);
            return {
                errors: [
                    {
                        text: error.reason,
                        location: {
                            file: error.file,
                            line: error.line,
                            column: error.column && error.column - 1,
                            lineText: error.line === undefined ? undefined : lines?.[error.line - 1],
                        },
                    },
                ],
            };
        }
        throw error;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldC1wbHVnaW4tZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvc3R5bGVzaGVldHMvc3R5bGVzaGVldC1wbHVnaW4tZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILDBEQUE2QjtBQUM3Qiw4REFBaUM7QUFDakMsK0NBQTRDO0FBQzVDLHlDQUFvQztBQUNwQyw0REFBeUU7QUFFekU7OztHQUdHO0FBQ0gsSUFBSSxPQUF3RCxDQUFDO0FBb0M3RCxNQUFhLHVCQUF1QjtJQUNsQyxZQUNtQixPQUFnQyxFQUNoQyxLQUF1QjtRQUR2QixZQUFPLEdBQVAsT0FBTyxDQUF5QjtRQUNoQyxVQUFLLEdBQUwsS0FBSyxDQUFrQjtJQUN2QyxDQUFDO0lBRUosTUFBTSxDQUFDLFFBQXNDO1FBQzNDLHVEQUF1RDtRQUN2RCxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMscUJBQXFCLEVBQUU7WUFDNUQsT0FBTztnQkFDTCxJQUFJLEVBQUUsVUFBVSxHQUFHLFFBQVEsQ0FBQyxJQUFJO2dCQUNoQyxLQUFLLEtBQUksQ0FBQzthQUNYLENBQUM7U0FDSDtRQUVELE1BQU0sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBRWhDLE9BQU87WUFDTCxJQUFJLEVBQUUsVUFBVSxHQUFHLFFBQVEsQ0FBQyxJQUFJO1lBQ2hDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSztnQkFDZixzQ0FBc0M7Z0JBQ3RDLG1GQUFtRjtnQkFDbkYsSUFBSSxnQkFBeUQsQ0FBQztnQkFDOUQsSUFBSSxPQUFPLENBQUMscUJBQXFCLEVBQUU7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SyxFQUFFO1FBQ2QsT0FBTyxLQUFQLE9BQU8sR0FBSyxDQUFDLHdEQUFhLFNBQVMsR0FBQyxDQUFDLENBQUMsT0FBTyxFQUFDO1FBQzlDLElBQUksS0FBSyxZQUFZLE9BQU8sQ0FBQyxjQUFjLEVBQUU7WUFDM0MsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7WUFFM0MsT0FBTztnQkFDTCxNQUFNLEVBQUU7b0JBQ047d0JBQ0UsSUFBSSxFQUFFLEtBQUssQ0FBQyxNQUFNO3dCQUNsQixRQUFRLEVBQUU7NEJBQ1IsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJOzRCQUNoQixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7NEJBQ2hCLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQzs0QkFDeEMsUUFBUSxFQUFFLEtBQUssQ0FBQyxJQUFJLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO3lCQUN6RTtxQkFDRjtpQkFDRjthQUNGLENBQUM7U0FDSDtRQUVELE1BQU0sS0FBSyxDQUFDO0tBQ2I7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgT25Mb2FkUmVzdWx0LCBQbHVnaW4sIFBsdWdpbkJ1aWxkIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgZ2xvYiBmcm9tICdmYXN0LWdsb2InO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgZXh0bmFtZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBMb2FkUmVzdWx0Q2FjaGUsIGNyZWF0ZUNhY2hlZExvYWQgfSBmcm9tICcuLi9sb2FkLXJlc3VsdC1jYWNoZSc7XG5cbi8qKlxuICogVGhlIGxhenktbG9hZGVkIGluc3RhbmNlIG9mIHRoZSBwb3N0Y3NzIHN0eWxlc2hlZXQgcG9zdHByb2Nlc3Nvci5cbiAqIEl0IGlzIG9ubHkgaW1wb3J0ZWQgYW5kIGluaXRpYWxpemVkIGlmIHBvc3Rjc3MgaXMgbmVlZGVkLlxuICovXG5sZXQgcG9zdGNzczogdHlwZW9mIGltcG9ydCgncG9zdGNzcycpWydkZWZhdWx0J10gfCB1bmRlZmluZWQ7XG5cbi8qKlxuICogQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHBsdWdpbiBvcHRpb25zIHRvIHVzZSB3aGVuIHByb2Nlc3Npbmcgc3R5bGVzaGVldHMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMge1xuICAvKipcbiAgICogQ29udHJvbHMgdGhlIHVzZSBhbmQgY3JlYXRpb24gb2Ygc291cmNlbWFwcyB3aGVuIHByb2Nlc3NpbmcgdGhlIHN0eWxlc2hlZXRzLlxuICAgKiBJZiB0cnVlLCBzb3VyY2VtYXAgcHJvY2Vzc2luZyBpcyBlbmFibGVkOyBpZiBmYWxzZSwgZGlzYWJsZWQuXG4gICAqL1xuICBzb3VyY2VtYXA6IGJvb2xlYW47XG5cbiAgaW5jbHVkZVBhdGhzPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIE9wdGlvbmFsIGNvbXBvbmVudCBkYXRhIGZvciBhbnkgaW5saW5lIHN0eWxlcyBmcm9tIENvbXBvbmVudCBkZWNvcmF0b3IgYHN0eWxlc2AgZmllbGRzLlxuICAgKiBUaGUga2V5IGlzIGFuIGludGVybmFsIGFuZ3VsYXIgcmVzb3VyY2UgVVJJIGFuZCB0aGUgdmFsdWUgaXMgdGhlIHN0eWxlc2hlZXQgY29udGVudC5cbiAgICovXG4gIGlubGluZUNvbXBvbmVudERhdGE/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuXG4gIHRhaWx3aW5kQ29uZmlndXJhdGlvbj86IHsgZmlsZTogc3RyaW5nOyBwYWNrYWdlOiBzdHJpbmcgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdHlsZXNoZWV0TGFuZ3VhZ2Uge1xuICBuYW1lOiBzdHJpbmc7XG4gIGNvbXBvbmVudEZpbHRlcjogUmVnRXhwO1xuICBmaWxlRmlsdGVyOiBSZWdFeHA7XG4gIHByb2Nlc3M/KFxuICAgIGRhdGE6IHN0cmluZyxcbiAgICBmaWxlOiBzdHJpbmcsXG4gICAgZm9ybWF0OiBzdHJpbmcsXG4gICAgb3B0aW9uczogU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMsXG4gICAgYnVpbGQ6IFBsdWdpbkJ1aWxkLFxuICApOiBPbkxvYWRSZXN1bHQgfCBQcm9taXNlPE9uTG9hZFJlc3VsdD47XG59XG5cbmV4cG9ydCBjbGFzcyBTdHlsZXNoZWV0UGx1Z2luRmFjdG9yeSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczogU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMsXG4gICAgcHJpdmF0ZSByZWFkb25seSBjYWNoZT86IExvYWRSZXN1bHRDYWNoZSxcbiAgKSB7fVxuXG4gIGNyZWF0ZShsYW5ndWFnZTogUmVhZG9ubHk8U3R5bGVzaGVldExhbmd1YWdlPik6IFBsdWdpbiB7XG4gICAgLy8gUmV0dXJuIGEgbm9vcCBwbHVnaW4gaWYgbm8gbG9hZCBhY3Rpb25zIGFyZSByZXF1aXJlZFxuICAgIGlmICghbGFuZ3VhZ2UucHJvY2VzcyAmJiAhdGhpcy5vcHRpb25zLnRhaWx3aW5kQ29uZmlndXJhdGlvbikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogJ2FuZ3VsYXItJyArIGxhbmd1YWdlLm5hbWUsXG4gICAgICAgIHNldHVwKCkge30sXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IHsgY2FjaGUsIG9wdGlvbnMgfSA9IHRoaXM7XG5cbiAgICByZXR1cm4ge1xuICAgICAgbmFtZTogJ2FuZ3VsYXItJyArIGxhbmd1YWdlLm5hbWUsXG4gICAgICBhc3luYyBzZXR1cChidWlsZCkge1xuICAgICAgICAvLyBTZXR1cCBwb3N0Y3NzIGlmIG5lZWRlZCBieSB0YWlsd2luZFxuICAgICAgICAvLyBUT0RPOiBNb3ZlIHRoaXMgaW50byB0aGUgcGx1Z2luIGZhY3RvcnkgdG8gYXZvaWQgcmVwZWF0IHNldHVwIHBlciBjcmVhdGVkIHBsdWdpblxuICAgICAgICBsZXQgcG9zdGNzc1Byb2Nlc3NvcjogaW1wb3J0KCdwb3N0Y3NzJykuUHJvY2Vzc29yIHwgdW5kZWZpbmVkO1xuICAgICAgICBpZiAob3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24pIHtcbiAgICAgICAgICBwb3N0Y3NzID8/PSAoYXdhaXQgaW1wb3J0KCdwb3N0Y3NzJykpLmRlZmF1bHQ7XG4gICAgICAgICAgcG9zdGNzc1Byb2Nlc3NvciA9IHBvc3Rjc3MoKTtcbiAgICAgICAgICBpZiAob3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IHRhaWx3aW5kID0gYXdhaXQgaW1wb3J0KG9wdGlvbnMudGFpbHdpbmRDb25maWd1cmF0aW9uLnBhY2thZ2UpO1xuICAgICAgICAgICAgcG9zdGNzc1Byb2Nlc3Nvci51c2UodGFpbHdpbmQuZGVmYXVsdCh7IGNvbmZpZzogb3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24uZmlsZSB9KSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWRkIGEgbG9hZCBjYWxsYmFjayB0byBzdXBwb3J0IGlubGluZSBDb21wb25lbnQgc3R5bGVzXG4gICAgICAgIGJ1aWxkLm9uTG9hZChcbiAgICAgICAgICB7IGZpbHRlcjogbGFuZ3VhZ2UuY29tcG9uZW50RmlsdGVyLCBuYW1lc3BhY2U6ICdhbmd1bGFyOnN0eWxlcy9jb21wb25lbnQnIH0sXG4gICAgICAgICAgY3JlYXRlQ2FjaGVkTG9hZChjYWNoZSwgKGFyZ3MpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBvcHRpb25zLmlubGluZUNvbXBvbmVudERhdGE/LlthcmdzLnBhdGhdO1xuICAgICAgICAgICAgYXNzZXJ0KFxuICAgICAgICAgICAgICB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycsXG4gICAgICAgICAgICAgIGBjb21wb25lbnQgc3R5bGUgbmFtZSBzaG91bGQgYWx3YXlzIGJlIGZvdW5kIFske2FyZ3MucGF0aH1dYCxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGNvbnN0IFtmb3JtYXQsICwgZmlsZW5hbWVdID0gYXJncy5wYXRoLnNwbGl0KCc7JywgMyk7XG5cbiAgICAgICAgICAgIHJldHVybiBwcm9jZXNzU3R5bGVzaGVldChcbiAgICAgICAgICAgICAgbGFuZ3VhZ2UsXG4gICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgIGZpbGVuYW1lLFxuICAgICAgICAgICAgICBmb3JtYXQsXG4gICAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICAgIGJ1aWxkLFxuICAgICAgICAgICAgICBwb3N0Y3NzUHJvY2Vzc29yLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KSxcbiAgICAgICAgKTtcblxuICAgICAgICAvLyBBZGQgYSBsb2FkIGNhbGxiYWNrIHRvIHN1cHBvcnQgZmlsZXMgZnJvbSBkaXNrXG4gICAgICAgIGJ1aWxkLm9uTG9hZChcbiAgICAgICAgICB7IGZpbHRlcjogbGFuZ3VhZ2UuZmlsZUZpbHRlciB9LFxuICAgICAgICAgIGNyZWF0ZUNhY2hlZExvYWQoY2FjaGUsIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVhZEZpbGUoYXJncy5wYXRoLCAndXRmLTgnKTtcblxuICAgICAgICAgICAgcmV0dXJuIHByb2Nlc3NTdHlsZXNoZWV0KFxuICAgICAgICAgICAgICBsYW5ndWFnZSxcbiAgICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgICAgYXJncy5wYXRoLFxuICAgICAgICAgICAgICBleHRuYW1lKGFyZ3MucGF0aCkudG9Mb3dlckNhc2UoKS5zbGljZSgxKSxcbiAgICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgICAgYnVpbGQsXG4gICAgICAgICAgICAgIHBvc3Rjc3NQcm9jZXNzb3IsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgICAgfSxcbiAgICB9O1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NTdHlsZXNoZWV0KFxuICBsYW5ndWFnZTogUmVhZG9ubHk8U3R5bGVzaGVldExhbmd1YWdlPixcbiAgZGF0YTogc3RyaW5nLFxuICBmaWxlbmFtZTogc3RyaW5nLFxuICBmb3JtYXQ6IHN0cmluZyxcbiAgb3B0aW9uczogU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMsXG4gIGJ1aWxkOiBQbHVnaW5CdWlsZCxcbiAgcG9zdGNzc1Byb2Nlc3NvcjogaW1wb3J0KCdwb3N0Y3NzJykuUHJvY2Vzc29yIHwgdW5kZWZpbmVkLFxuKSB7XG4gIGxldCByZXN1bHQ6IE9uTG9hZFJlc3VsdDtcblxuICAvLyBQcm9jZXNzIHRoZSBpbnB1dCBkYXRhIGlmIHRoZSBsYW5ndWFnZSByZXF1aXJlcyBwcmVwcm9jZXNzaW5nXG4gIGlmIChsYW5ndWFnZS5wcm9jZXNzKSB7XG4gICAgcmVzdWx0ID0gYXdhaXQgbGFuZ3VhZ2UucHJvY2VzcyhkYXRhLCBmaWxlbmFtZSwgZm9ybWF0LCBvcHRpb25zLCBidWlsZCk7XG4gIH0gZWxzZSB7XG4gICAgcmVzdWx0ID0ge1xuICAgICAgY29udGVudHM6IGRhdGEsXG4gICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgd2F0Y2hGaWxlczogW2ZpbGVuYW1lXSxcbiAgICB9O1xuICB9XG5cbiAgLy8gVHJhbnNmb3JtIHdpdGggcG9zdGNzcyBpZiBuZWVkZWQgYW5kIHRoZXJlIGFyZSBubyBlcnJvcnNcbiAgaWYgKHBvc3Rjc3NQcm9jZXNzb3IgJiYgcmVzdWx0LmNvbnRlbnRzICYmICFyZXN1bHQuZXJyb3JzPy5sZW5ndGgpIHtcbiAgICBjb25zdCBwb3N0Y3NzUmVzdWx0ID0gYXdhaXQgY29tcGlsZVN0cmluZyhcbiAgICAgIHR5cGVvZiByZXN1bHQuY29udGVudHMgPT09ICdzdHJpbmcnXG4gICAgICAgID8gcmVzdWx0LmNvbnRlbnRzXG4gICAgICAgIDogQnVmZmVyLmZyb20ocmVzdWx0LmNvbnRlbnRzKS50b1N0cmluZygndXRmLTgnKSxcbiAgICAgIGZpbGVuYW1lLFxuICAgICAgcG9zdGNzc1Byb2Nlc3NvcixcbiAgICAgIG9wdGlvbnMsXG4gICAgKTtcblxuICAgIC8vIE1lcmdlIHJlc3VsdHNcbiAgICBpZiAocG9zdGNzc1Jlc3VsdC5lcnJvcnM/Lmxlbmd0aCkge1xuICAgICAgZGVsZXRlIHJlc3VsdC5jb250ZW50cztcbiAgICB9XG4gICAgaWYgKHJlc3VsdC53YXJuaW5ncyAmJiBwb3N0Y3NzUmVzdWx0Lndhcm5pbmdzKSB7XG4gICAgICBwb3N0Y3NzUmVzdWx0Lndhcm5pbmdzLnVuc2hpZnQoLi4ucmVzdWx0Lndhcm5pbmdzKTtcbiAgICB9XG4gICAgaWYgKHJlc3VsdC53YXRjaEZpbGVzICYmIHBvc3Rjc3NSZXN1bHQud2F0Y2hGaWxlcykge1xuICAgICAgcG9zdGNzc1Jlc3VsdC53YXRjaEZpbGVzLnVuc2hpZnQoLi4ucmVzdWx0LndhdGNoRmlsZXMpO1xuICAgIH1cbiAgICBpZiAocmVzdWx0LndhdGNoRGlycyAmJiBwb3N0Y3NzUmVzdWx0LndhdGNoRGlycykge1xuICAgICAgcG9zdGNzc1Jlc3VsdC53YXRjaERpcnMudW5zaGlmdCguLi5yZXN1bHQud2F0Y2hEaXJzKTtcbiAgICB9XG4gICAgcmVzdWx0ID0ge1xuICAgICAgLi4ucmVzdWx0LFxuICAgICAgLi4ucG9zdGNzc1Jlc3VsdCxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgcHJvdmlkZWQgQ1NTIHN0eWxlc2hlZXQgZGF0YSB1c2luZyBhIHByb3ZpZGVkIHBvc3Rjc3MgcHJvY2Vzc29yIGFuZCBwcm92aWRlcyBhblxuICogZXNidWlsZCBsb2FkIHJlc3VsdCB0aGF0IGNhbiBiZSB1c2VkIGRpcmVjdGx5IGJ5IGFuIGVzYnVpbGQgUGx1Z2luLlxuICogQHBhcmFtIGRhdGEgVGhlIHN0eWxlc2hlZXQgY29udGVudCB0byBwcm9jZXNzLlxuICogQHBhcmFtIGZpbGVuYW1lIFRoZSBuYW1lIG9mIHRoZSBmaWxlIHRoYXQgY29udGFpbnMgdGhlIGRhdGEuXG4gKiBAcGFyYW0gcG9zdGNzc1Byb2Nlc3NvciBBIHBvc3Rjc3MgcHJvY2Vzc29yIGluc3RhbmNlIHRvIHVzZS5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBwbHVnaW4gb3B0aW9ucyB0byBjb250cm9sIHRoZSBwcm9jZXNzaW5nLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBPbkxvYWRlclJlc3VsdCBvYmplY3Qgd2l0aCB0aGUgcHJvY2Vzc2VkIGNvbnRlbnQsIHdhcm5pbmdzLCBhbmQvb3IgZXJyb3JzLlxuICovXG5hc3luYyBmdW5jdGlvbiBjb21waWxlU3RyaW5nKFxuICBkYXRhOiBzdHJpbmcsXG4gIGZpbGVuYW1lOiBzdHJpbmcsXG4gIHBvc3Rjc3NQcm9jZXNzb3I6IGltcG9ydCgncG9zdGNzcycpLlByb2Nlc3NvcixcbiAgb3B0aW9uczogU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMsXG4pOiBQcm9taXNlPE9uTG9hZFJlc3VsdD4ge1xuICB0cnkge1xuICAgIGNvbnN0IHBvc3Rjc3NSZXN1bHQgPSBhd2FpdCBwb3N0Y3NzUHJvY2Vzc29yLnByb2Nlc3MoZGF0YSwge1xuICAgICAgZnJvbTogZmlsZW5hbWUsXG4gICAgICB0bzogZmlsZW5hbWUsXG4gICAgICBtYXA6IG9wdGlvbnMuc291cmNlbWFwICYmIHtcbiAgICAgICAgaW5saW5lOiB0cnVlLFxuICAgICAgICBzb3VyY2VzQ29udGVudDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBsb2FkUmVzdWx0OiBPbkxvYWRSZXN1bHQgPSB7XG4gICAgICBjb250ZW50czogcG9zdGNzc1Jlc3VsdC5jc3MsXG4gICAgICBsb2FkZXI6ICdjc3MnLFxuICAgIH07XG5cbiAgICBjb25zdCByYXdXYXJuaW5ncyA9IHBvc3Rjc3NSZXN1bHQud2FybmluZ3MoKTtcbiAgICBpZiAocmF3V2FybmluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgbGluZU1hcHBpbmdzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZ1tdIHwgbnVsbD4oKTtcbiAgICAgIGxvYWRSZXN1bHQud2FybmluZ3MgPSByYXdXYXJuaW5ncy5tYXAoKHdhcm5pbmcpID0+IHtcbiAgICAgICAgY29uc3QgZmlsZSA9IHdhcm5pbmcubm9kZS5zb3VyY2U/LmlucHV0LmZpbGU7XG4gICAgICAgIGlmIChmaWxlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZXR1cm4geyB0ZXh0OiB3YXJuaW5nLnRleHQgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBsaW5lcyA9IGxpbmVNYXBwaW5ncy5nZXQoZmlsZSk7XG4gICAgICAgIGlmIChsaW5lcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgbGluZXMgPSB3YXJuaW5nLm5vZGUuc291cmNlPy5pbnB1dC5jc3Muc3BsaXQoL1xccj9cXG4vKTtcbiAgICAgICAgICBsaW5lTWFwcGluZ3Muc2V0KGZpbGUsIGxpbmVzID8/IG51bGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0ZXh0OiB3YXJuaW5nLnRleHQsXG4gICAgICAgICAgbG9jYXRpb246IHtcbiAgICAgICAgICAgIGZpbGUsXG4gICAgICAgICAgICBsaW5lOiB3YXJuaW5nLmxpbmUsXG4gICAgICAgICAgICBjb2x1bW46IHdhcm5pbmcuY29sdW1uIC0gMSxcbiAgICAgICAgICAgIGxpbmVUZXh0OiBsaW5lcz8uW3dhcm5pbmcubGluZSAtIDFdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHJlc3VsdE1lc3NhZ2Ugb2YgcG9zdGNzc1Jlc3VsdC5tZXNzYWdlcykge1xuICAgICAgaWYgKHJlc3VsdE1lc3NhZ2UudHlwZSA9PT0gJ2RlcGVuZGVuY3knICYmIHR5cGVvZiByZXN1bHRNZXNzYWdlWydmaWxlJ10gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGxvYWRSZXN1bHQud2F0Y2hGaWxlcyA/Pz0gW107XG4gICAgICAgIGxvYWRSZXN1bHQud2F0Y2hGaWxlcy5wdXNoKHJlc3VsdE1lc3NhZ2VbJ2ZpbGUnXSk7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICByZXN1bHRNZXNzYWdlLnR5cGUgPT09ICdkaXItZGVwZW5kZW5jeScgJiZcbiAgICAgICAgdHlwZW9mIHJlc3VsdE1lc3NhZ2VbJ2RpciddID09PSAnc3RyaW5nJyAmJlxuICAgICAgICB0eXBlb2YgcmVzdWx0TWVzc2FnZVsnZ2xvYiddID09PSAnc3RyaW5nJ1xuICAgICAgKSB7XG4gICAgICAgIGxvYWRSZXN1bHQud2F0Y2hGaWxlcyA/Pz0gW107XG4gICAgICAgIGNvbnN0IGRlcGVuZGVuY2llcyA9IGF3YWl0IGdsb2IocmVzdWx0TWVzc2FnZVsnZ2xvYiddLCB7XG4gICAgICAgICAgYWJzb2x1dGU6IHRydWUsXG4gICAgICAgICAgY3dkOiByZXN1bHRNZXNzYWdlWydkaXInXSxcbiAgICAgICAgfSk7XG4gICAgICAgIGxvYWRSZXN1bHQud2F0Y2hGaWxlcy5wdXNoKC4uLmRlcGVuZGVuY2llcyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGxvYWRSZXN1bHQ7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcG9zdGNzcyA/Pz0gKGF3YWl0IGltcG9ydCgncG9zdGNzcycpKS5kZWZhdWx0O1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIHBvc3Rjc3MuQ3NzU3ludGF4RXJyb3IpIHtcbiAgICAgIGNvbnN0IGxpbmVzID0gZXJyb3Iuc291cmNlPy5zcGxpdCgvXFxyP1xcbi8pO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0ZXh0OiBlcnJvci5yZWFzb24sXG4gICAgICAgICAgICBsb2NhdGlvbjoge1xuICAgICAgICAgICAgICBmaWxlOiBlcnJvci5maWxlLFxuICAgICAgICAgICAgICBsaW5lOiBlcnJvci5saW5lLFxuICAgICAgICAgICAgICBjb2x1bW46IGVycm9yLmNvbHVtbiAmJiBlcnJvci5jb2x1bW4gLSAxLFxuICAgICAgICAgICAgICBsaW5lVGV4dDogZXJyb3IubGluZSA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogbGluZXM/LltlcnJvci5saW5lIC0gMV0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9O1xuICAgIH1cblxuICAgIHRocm93IGVycm9yO1xuICB9XG59XG4iXX0=