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
                build.onLoad({ filter: language.componentFilter, namespace: 'angular:styles/component' }, (0, load_result_cache_1.createCachedLoad)(cache, async (args) => {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldC1wbHVnaW4tZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvc3R5bGVzaGVldHMvc3R5bGVzaGVldC1wbHVnaW4tZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILDBEQUE2QjtBQUM3Qiw4REFBaUM7QUFDakMsK0NBQTRDO0FBQzVDLHlDQUFvQztBQUNwQyw0REFBeUU7QUFFekU7OztHQUdHO0FBQ0gsSUFBSSxPQUF3RCxDQUFDO0FBMkM3RCxNQUFhLHVCQUF1QjtJQUNsQyxZQUNtQixPQUFnQyxFQUNoQyxLQUF1QjtRQUR2QixZQUFPLEdBQVAsT0FBTyxDQUF5QjtRQUNoQyxVQUFLLEdBQUwsS0FBSyxDQUFrQjtJQUN2QyxDQUFDO0lBRUosTUFBTSxDQUFDLFFBQXNDO1FBQzNDLHVEQUF1RDtRQUN2RCxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMscUJBQXFCLEVBQUU7WUFDNUQsT0FBTztnQkFDTCxJQUFJLEVBQUUsVUFBVSxHQUFHLFFBQVEsQ0FBQyxJQUFJO2dCQUNoQyxLQUFLLEtBQUksQ0FBQzthQUNYLENBQUM7U0FDSDtRQUVELE1BQU0sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBRWhDLE9BQU87WUFDTCxJQUFJLEVBQUUsVUFBVSxHQUFHLFFBQVEsQ0FBQyxJQUFJO1lBQ2hDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSztnQkFDZixzQ0FBc0M7Z0JBQ3RDLG1GQUFtRjtnQkFDbkYsSUFBSSxnQkFBeUQsQ0FBQztnQkFDOUQsSUFBSSxPQUFPLENBQUMscUJBQXFCLEVBQUU7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TyxLQUFLLEVBQUU7UUFDZCxPQUFPLEtBQVAsT0FBTyxHQUFLLENBQUMsd0RBQWEsU0FBUyxHQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUM7UUFDOUMsSUFBSSxLQUFLLFlBQVksT0FBTyxDQUFDLGNBQWMsRUFBRTtZQUMzQyxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUUzQyxPQUFPO2dCQUNMLE1BQU0sRUFBRTtvQkFDTjt3QkFDRSxJQUFJLEVBQUUsS0FBSyxDQUFDLE1BQU07d0JBQ2xCLFFBQVEsRUFBRTs0QkFDUixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7NEJBQ2hCLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTs0QkFDaEIsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDOzRCQUN4QyxRQUFRLEVBQUUsS0FBSyxDQUFDLElBQUksS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7eUJBQ3pFO3FCQUNGO2lCQUNGO2FBQ0YsQ0FBQztTQUNIO1FBRUQsTUFBTSxLQUFLLENBQUM7S0FDYjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBPbkxvYWRSZXN1bHQsIFBsdWdpbiwgUGx1Z2luQnVpbGQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBnbG9iIGZyb20gJ2Zhc3QtZ2xvYic7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBleHRuYW1lIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IExvYWRSZXN1bHRDYWNoZSwgY3JlYXRlQ2FjaGVkTG9hZCB9IGZyb20gJy4uL2xvYWQtcmVzdWx0LWNhY2hlJztcblxuLyoqXG4gKiBUaGUgbGF6eS1sb2FkZWQgaW5zdGFuY2Ugb2YgdGhlIHBvc3Rjc3Mgc3R5bGVzaGVldCBwb3N0cHJvY2Vzc29yLlxuICogSXQgaXMgb25seSBpbXBvcnRlZCBhbmQgaW5pdGlhbGl6ZWQgaWYgcG9zdGNzcyBpcyBuZWVkZWQuXG4gKi9cbmxldCBwb3N0Y3NzOiB0eXBlb2YgaW1wb3J0KCdwb3N0Y3NzJylbJ2RlZmF1bHQnXSB8IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgcGx1Z2luIG9wdGlvbnMgdG8gdXNlIHdoZW4gcHJvY2Vzc2luZyBzdHlsZXNoZWV0cy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTdHlsZXNoZWV0UGx1Z2luT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBDb250cm9scyB0aGUgdXNlIGFuZCBjcmVhdGlvbiBvZiBzb3VyY2VtYXBzIHdoZW4gcHJvY2Vzc2luZyB0aGUgc3R5bGVzaGVldHMuXG4gICAqIElmIHRydWUsIHNvdXJjZW1hcCBwcm9jZXNzaW5nIGlzIGVuYWJsZWQ7IGlmIGZhbHNlLCBkaXNhYmxlZC5cbiAgICovXG4gIHNvdXJjZW1hcDogYm9vbGVhbjtcblxuICBpbmNsdWRlUGF0aHM/OiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogT3B0aW9uYWwgY29tcG9uZW50IGRhdGEgZm9yIGFueSBpbmxpbmUgc3R5bGVzIGZyb20gQ29tcG9uZW50IGRlY29yYXRvciBgc3R5bGVzYCBmaWVsZHMuXG4gICAqIFRoZSBrZXkgaXMgYW4gaW50ZXJuYWwgYW5ndWxhciByZXNvdXJjZSBVUkkgYW5kIHRoZSB2YWx1ZSBpcyB0aGUgc3R5bGVzaGVldCBjb250ZW50LlxuICAgKi9cbiAgaW5saW5lQ29tcG9uZW50RGF0YT86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG5cbiAgLyoqXG4gICAqIFRoZSBicm93c2VycyB0byBzdXBwb3J0IGluIGJyb3dzZXJzbGlzdCBmb3JtYXQgd2hlbiBwcm9jZXNzaW5nIHN0eWxlc2hlZXRzLlxuICAgKiBTb21lIHBvc3Rjc3MgcGx1Z2lucyBzdWNoIGFzIGF1dG9wcmVmaXhlciByZXF1aXJlIHRoZSByYXcgYnJvd3NlcnNsaXN0IGluZm9ybWF0aW9uIGluc3RlYWRcbiAgICogb2YgdGhlIGVzYnVpbGQgZm9ybWF0dGVkIHRhcmdldC5cbiAgICovXG4gIGJyb3dzZXJzOiBzdHJpbmdbXTtcblxuICB0YWlsd2luZENvbmZpZ3VyYXRpb24/OiB7IGZpbGU6IHN0cmluZzsgcGFja2FnZTogc3RyaW5nIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3R5bGVzaGVldExhbmd1YWdlIHtcbiAgbmFtZTogc3RyaW5nO1xuICBjb21wb25lbnRGaWx0ZXI6IFJlZ0V4cDtcbiAgZmlsZUZpbHRlcjogUmVnRXhwO1xuICBwcm9jZXNzPyhcbiAgICBkYXRhOiBzdHJpbmcsXG4gICAgZmlsZTogc3RyaW5nLFxuICAgIGZvcm1hdDogc3RyaW5nLFxuICAgIG9wdGlvbnM6IFN0eWxlc2hlZXRQbHVnaW5PcHRpb25zLFxuICAgIGJ1aWxkOiBQbHVnaW5CdWlsZCxcbiAgKTogT25Mb2FkUmVzdWx0IHwgUHJvbWlzZTxPbkxvYWRSZXN1bHQ+O1xufVxuXG5leHBvcnQgY2xhc3MgU3R5bGVzaGVldFBsdWdpbkZhY3Rvcnkge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM6IFN0eWxlc2hlZXRQbHVnaW5PcHRpb25zLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY2FjaGU/OiBMb2FkUmVzdWx0Q2FjaGUsXG4gICkge31cblxuICBjcmVhdGUobGFuZ3VhZ2U6IFJlYWRvbmx5PFN0eWxlc2hlZXRMYW5ndWFnZT4pOiBQbHVnaW4ge1xuICAgIC8vIFJldHVybiBhIG5vb3AgcGx1Z2luIGlmIG5vIGxvYWQgYWN0aW9ucyBhcmUgcmVxdWlyZWRcbiAgICBpZiAoIWxhbmd1YWdlLnByb2Nlc3MgJiYgIXRoaXMub3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24pIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6ICdhbmd1bGFyLScgKyBsYW5ndWFnZS5uYW1lLFxuICAgICAgICBzZXR1cCgpIHt9LFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGNhY2hlLCBvcHRpb25zIH0gPSB0aGlzO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIG5hbWU6ICdhbmd1bGFyLScgKyBsYW5ndWFnZS5uYW1lLFxuICAgICAgYXN5bmMgc2V0dXAoYnVpbGQpIHtcbiAgICAgICAgLy8gU2V0dXAgcG9zdGNzcyBpZiBuZWVkZWQgYnkgdGFpbHdpbmRcbiAgICAgICAgLy8gVE9ETzogTW92ZSB0aGlzIGludG8gdGhlIHBsdWdpbiBmYWN0b3J5IHRvIGF2b2lkIHJlcGVhdCBzZXR1cCBwZXIgY3JlYXRlZCBwbHVnaW5cbiAgICAgICAgbGV0IHBvc3Rjc3NQcm9jZXNzb3I6IGltcG9ydCgncG9zdGNzcycpLlByb2Nlc3NvciB8IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKG9wdGlvbnMudGFpbHdpbmRDb25maWd1cmF0aW9uKSB7XG4gICAgICAgICAgcG9zdGNzcyA/Pz0gKGF3YWl0IGltcG9ydCgncG9zdGNzcycpKS5kZWZhdWx0O1xuICAgICAgICAgIHBvc3Rjc3NQcm9jZXNzb3IgPSBwb3N0Y3NzKCk7XG4gICAgICAgICAgaWYgKG9wdGlvbnMudGFpbHdpbmRDb25maWd1cmF0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCB0YWlsd2luZCA9IGF3YWl0IGltcG9ydChvcHRpb25zLnRhaWx3aW5kQ29uZmlndXJhdGlvbi5wYWNrYWdlKTtcbiAgICAgICAgICAgIHBvc3Rjc3NQcm9jZXNzb3IudXNlKHRhaWx3aW5kLmRlZmF1bHQoeyBjb25maWc6IG9wdGlvbnMudGFpbHdpbmRDb25maWd1cmF0aW9uLmZpbGUgfSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFkZCBhIGxvYWQgY2FsbGJhY2sgdG8gc3VwcG9ydCBpbmxpbmUgQ29tcG9uZW50IHN0eWxlc1xuICAgICAgICBidWlsZC5vbkxvYWQoXG4gICAgICAgICAgeyBmaWx0ZXI6IGxhbmd1YWdlLmNvbXBvbmVudEZpbHRlciwgbmFtZXNwYWNlOiAnYW5ndWxhcjpzdHlsZXMvY29tcG9uZW50JyB9LFxuICAgICAgICAgIGNyZWF0ZUNhY2hlZExvYWQoY2FjaGUsIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gb3B0aW9ucy5pbmxpbmVDb21wb25lbnREYXRhPy5bYXJncy5wYXRoXTtcbiAgICAgICAgICAgIGFzc2VydChcbiAgICAgICAgICAgICAgdHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnLFxuICAgICAgICAgICAgICBgY29tcG9uZW50IHN0eWxlIG5hbWUgc2hvdWxkIGFsd2F5cyBiZSBmb3VuZCBbJHthcmdzLnBhdGh9XWAsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBjb25zdCBbZm9ybWF0LCAsIGZpbGVuYW1lXSA9IGFyZ3MucGF0aC5zcGxpdCgnOycsIDMpO1xuXG4gICAgICAgICAgICByZXR1cm4gcHJvY2Vzc1N0eWxlc2hlZXQoXG4gICAgICAgICAgICAgIGxhbmd1YWdlLFxuICAgICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgICBmaWxlbmFtZSxcbiAgICAgICAgICAgICAgZm9ybWF0LFxuICAgICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgICBidWlsZCxcbiAgICAgICAgICAgICAgcG9zdGNzc1Byb2Nlc3NvcixcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSksXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gQWRkIGEgbG9hZCBjYWxsYmFjayB0byBzdXBwb3J0IGZpbGVzIGZyb20gZGlza1xuICAgICAgICBidWlsZC5vbkxvYWQoXG4gICAgICAgICAgeyBmaWx0ZXI6IGxhbmd1YWdlLmZpbGVGaWx0ZXIgfSxcbiAgICAgICAgICBjcmVhdGVDYWNoZWRMb2FkKGNhY2hlLCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlYWRGaWxlKGFyZ3MucGF0aCwgJ3V0Zi04Jyk7XG5cbiAgICAgICAgICAgIHJldHVybiBwcm9jZXNzU3R5bGVzaGVldChcbiAgICAgICAgICAgICAgbGFuZ3VhZ2UsXG4gICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgIGFyZ3MucGF0aCxcbiAgICAgICAgICAgICAgZXh0bmFtZShhcmdzLnBhdGgpLnRvTG93ZXJDYXNlKCkuc2xpY2UoMSksXG4gICAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICAgIGJ1aWxkLFxuICAgICAgICAgICAgICBwb3N0Y3NzUHJvY2Vzc29yLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KSxcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBwcm9jZXNzU3R5bGVzaGVldChcbiAgbGFuZ3VhZ2U6IFJlYWRvbmx5PFN0eWxlc2hlZXRMYW5ndWFnZT4sXG4gIGRhdGE6IHN0cmluZyxcbiAgZmlsZW5hbWU6IHN0cmluZyxcbiAgZm9ybWF0OiBzdHJpbmcsXG4gIG9wdGlvbnM6IFN0eWxlc2hlZXRQbHVnaW5PcHRpb25zLFxuICBidWlsZDogUGx1Z2luQnVpbGQsXG4gIHBvc3Rjc3NQcm9jZXNzb3I6IGltcG9ydCgncG9zdGNzcycpLlByb2Nlc3NvciB8IHVuZGVmaW5lZCxcbikge1xuICBsZXQgcmVzdWx0OiBPbkxvYWRSZXN1bHQ7XG5cbiAgLy8gUHJvY2VzcyB0aGUgaW5wdXQgZGF0YSBpZiB0aGUgbGFuZ3VhZ2UgcmVxdWlyZXMgcHJlcHJvY2Vzc2luZ1xuICBpZiAobGFuZ3VhZ2UucHJvY2Vzcykge1xuICAgIHJlc3VsdCA9IGF3YWl0IGxhbmd1YWdlLnByb2Nlc3MoZGF0YSwgZmlsZW5hbWUsIGZvcm1hdCwgb3B0aW9ucywgYnVpbGQpO1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdCA9IHtcbiAgICAgIGNvbnRlbnRzOiBkYXRhLFxuICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgIHdhdGNoRmlsZXM6IFtmaWxlbmFtZV0sXG4gICAgfTtcbiAgfVxuXG4gIC8vIFRyYW5zZm9ybSB3aXRoIHBvc3Rjc3MgaWYgbmVlZGVkIGFuZCB0aGVyZSBhcmUgbm8gZXJyb3JzXG4gIGlmIChwb3N0Y3NzUHJvY2Vzc29yICYmIHJlc3VsdC5jb250ZW50cyAmJiAhcmVzdWx0LmVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc3QgcG9zdGNzc1Jlc3VsdCA9IGF3YWl0IGNvbXBpbGVTdHJpbmcoXG4gICAgICB0eXBlb2YgcmVzdWx0LmNvbnRlbnRzID09PSAnc3RyaW5nJ1xuICAgICAgICA/IHJlc3VsdC5jb250ZW50c1xuICAgICAgICA6IEJ1ZmZlci5mcm9tKHJlc3VsdC5jb250ZW50cykudG9TdHJpbmcoJ3V0Zi04JyksXG4gICAgICBmaWxlbmFtZSxcbiAgICAgIHBvc3Rjc3NQcm9jZXNzb3IsXG4gICAgICBvcHRpb25zLFxuICAgICk7XG5cbiAgICAvLyBNZXJnZSByZXN1bHRzXG4gICAgaWYgKHBvc3Rjc3NSZXN1bHQuZXJyb3JzPy5sZW5ndGgpIHtcbiAgICAgIGRlbGV0ZSByZXN1bHQuY29udGVudHM7XG4gICAgfVxuICAgIGlmIChyZXN1bHQud2FybmluZ3MgJiYgcG9zdGNzc1Jlc3VsdC53YXJuaW5ncykge1xuICAgICAgcG9zdGNzc1Jlc3VsdC53YXJuaW5ncy51bnNoaWZ0KC4uLnJlc3VsdC53YXJuaW5ncyk7XG4gICAgfVxuICAgIGlmIChyZXN1bHQud2F0Y2hGaWxlcyAmJiBwb3N0Y3NzUmVzdWx0LndhdGNoRmlsZXMpIHtcbiAgICAgIHBvc3Rjc3NSZXN1bHQud2F0Y2hGaWxlcy51bnNoaWZ0KC4uLnJlc3VsdC53YXRjaEZpbGVzKTtcbiAgICB9XG4gICAgaWYgKHJlc3VsdC53YXRjaERpcnMgJiYgcG9zdGNzc1Jlc3VsdC53YXRjaERpcnMpIHtcbiAgICAgIHBvc3Rjc3NSZXN1bHQud2F0Y2hEaXJzLnVuc2hpZnQoLi4ucmVzdWx0LndhdGNoRGlycyk7XG4gICAgfVxuICAgIHJlc3VsdCA9IHtcbiAgICAgIC4uLnJlc3VsdCxcbiAgICAgIC4uLnBvc3Rjc3NSZXN1bHQsXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIHByb3ZpZGVkIENTUyBzdHlsZXNoZWV0IGRhdGEgdXNpbmcgYSBwcm92aWRlZCBwb3N0Y3NzIHByb2Nlc3NvciBhbmQgcHJvdmlkZXMgYW5cbiAqIGVzYnVpbGQgbG9hZCByZXN1bHQgdGhhdCBjYW4gYmUgdXNlZCBkaXJlY3RseSBieSBhbiBlc2J1aWxkIFBsdWdpbi5cbiAqIEBwYXJhbSBkYXRhIFRoZSBzdHlsZXNoZWV0IGNvbnRlbnQgdG8gcHJvY2Vzcy5cbiAqIEBwYXJhbSBmaWxlbmFtZSBUaGUgbmFtZSBvZiB0aGUgZmlsZSB0aGF0IGNvbnRhaW5zIHRoZSBkYXRhLlxuICogQHBhcmFtIHBvc3Rjc3NQcm9jZXNzb3IgQSBwb3N0Y3NzIHByb2Nlc3NvciBpbnN0YW5jZSB0byB1c2UuXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgcGx1Z2luIG9wdGlvbnMgdG8gY29udHJvbCB0aGUgcHJvY2Vzc2luZy5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgT25Mb2FkZXJSZXN1bHQgb2JqZWN0IHdpdGggdGhlIHByb2Nlc3NlZCBjb250ZW50LCB3YXJuaW5ncywgYW5kL29yIGVycm9ycy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gY29tcGlsZVN0cmluZyhcbiAgZGF0YTogc3RyaW5nLFxuICBmaWxlbmFtZTogc3RyaW5nLFxuICBwb3N0Y3NzUHJvY2Vzc29yOiBpbXBvcnQoJ3Bvc3Rjc3MnKS5Qcm9jZXNzb3IsXG4gIG9wdGlvbnM6IFN0eWxlc2hlZXRQbHVnaW5PcHRpb25zLFxuKTogUHJvbWlzZTxPbkxvYWRSZXN1bHQ+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBwb3N0Y3NzUmVzdWx0ID0gYXdhaXQgcG9zdGNzc1Byb2Nlc3Nvci5wcm9jZXNzKGRhdGEsIHtcbiAgICAgIGZyb206IGZpbGVuYW1lLFxuICAgICAgdG86IGZpbGVuYW1lLFxuICAgICAgbWFwOiBvcHRpb25zLnNvdXJjZW1hcCAmJiB7XG4gICAgICAgIGlubGluZTogdHJ1ZSxcbiAgICAgICAgc291cmNlc0NvbnRlbnQ6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgbG9hZFJlc3VsdDogT25Mb2FkUmVzdWx0ID0ge1xuICAgICAgY29udGVudHM6IHBvc3Rjc3NSZXN1bHQuY3NzLFxuICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICB9O1xuXG4gICAgY29uc3QgcmF3V2FybmluZ3MgPSBwb3N0Y3NzUmVzdWx0Lndhcm5pbmdzKCk7XG4gICAgaWYgKHJhd1dhcm5pbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGxpbmVNYXBwaW5ncyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXSB8IG51bGw+KCk7XG4gICAgICBsb2FkUmVzdWx0Lndhcm5pbmdzID0gcmF3V2FybmluZ3MubWFwKCh3YXJuaW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSB3YXJuaW5nLm5vZGUuc291cmNlPy5pbnB1dC5maWxlO1xuICAgICAgICBpZiAoZmlsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcmV0dXJuIHsgdGV4dDogd2FybmluZy50ZXh0IH07XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgbGluZXMgPSBsaW5lTWFwcGluZ3MuZ2V0KGZpbGUpO1xuICAgICAgICBpZiAobGluZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGxpbmVzID0gd2FybmluZy5ub2RlLnNvdXJjZT8uaW5wdXQuY3NzLnNwbGl0KC9cXHI/XFxuLyk7XG4gICAgICAgICAgbGluZU1hcHBpbmdzLnNldChmaWxlLCBsaW5lcyA/PyBudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdGV4dDogd2FybmluZy50ZXh0LFxuICAgICAgICAgIGxvY2F0aW9uOiB7XG4gICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgbGluZTogd2FybmluZy5saW5lLFxuICAgICAgICAgICAgY29sdW1uOiB3YXJuaW5nLmNvbHVtbiAtIDEsXG4gICAgICAgICAgICBsaW5lVGV4dDogbGluZXM/Llt3YXJuaW5nLmxpbmUgLSAxXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCByZXN1bHRNZXNzYWdlIG9mIHBvc3Rjc3NSZXN1bHQubWVzc2FnZXMpIHtcbiAgICAgIGlmIChyZXN1bHRNZXNzYWdlLnR5cGUgPT09ICdkZXBlbmRlbmN5JyAmJiB0eXBlb2YgcmVzdWx0TWVzc2FnZVsnZmlsZSddID09PSAnc3RyaW5nJykge1xuICAgICAgICBsb2FkUmVzdWx0LndhdGNoRmlsZXMgPz89IFtdO1xuICAgICAgICBsb2FkUmVzdWx0LndhdGNoRmlsZXMucHVzaChyZXN1bHRNZXNzYWdlWydmaWxlJ10pO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgcmVzdWx0TWVzc2FnZS50eXBlID09PSAnZGlyLWRlcGVuZGVuY3knICYmXG4gICAgICAgIHR5cGVvZiByZXN1bHRNZXNzYWdlWydkaXInXSA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgdHlwZW9mIHJlc3VsdE1lc3NhZ2VbJ2dsb2InXSA9PT0gJ3N0cmluZydcbiAgICAgICkge1xuICAgICAgICBsb2FkUmVzdWx0LndhdGNoRmlsZXMgPz89IFtdO1xuICAgICAgICBjb25zdCBkZXBlbmRlbmNpZXMgPSBhd2FpdCBnbG9iKHJlc3VsdE1lc3NhZ2VbJ2dsb2InXSwge1xuICAgICAgICAgIGFic29sdXRlOiB0cnVlLFxuICAgICAgICAgIGN3ZDogcmVzdWx0TWVzc2FnZVsnZGlyJ10sXG4gICAgICAgIH0pO1xuICAgICAgICBsb2FkUmVzdWx0LndhdGNoRmlsZXMucHVzaCguLi5kZXBlbmRlbmNpZXMpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBsb2FkUmVzdWx0O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHBvc3Rjc3MgPz89IChhd2FpdCBpbXBvcnQoJ3Bvc3Rjc3MnKSkuZGVmYXVsdDtcbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBwb3N0Y3NzLkNzc1N5bnRheEVycm9yKSB7XG4gICAgICBjb25zdCBsaW5lcyA9IGVycm9yLnNvdXJjZT8uc3BsaXQoL1xccj9cXG4vKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdGV4dDogZXJyb3IucmVhc29uLFxuICAgICAgICAgICAgbG9jYXRpb246IHtcbiAgICAgICAgICAgICAgZmlsZTogZXJyb3IuZmlsZSxcbiAgICAgICAgICAgICAgbGluZTogZXJyb3IubGluZSxcbiAgICAgICAgICAgICAgY29sdW1uOiBlcnJvci5jb2x1bW4gJiYgZXJyb3IuY29sdW1uIC0gMSxcbiAgICAgICAgICAgICAgbGluZVRleHQ6IGVycm9yLmxpbmUgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IGxpbmVzPy5bZXJyb3IubGluZSAtIDFdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuIl19