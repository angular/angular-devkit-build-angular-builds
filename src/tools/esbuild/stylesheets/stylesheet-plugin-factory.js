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
const autoprefixer_1 = __importDefault(require("autoprefixer"));
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
        const autoprefixer = (0, autoprefixer_1.default)({
            overrideBrowserslist: options.browsers,
            ignoreUnknownVersions: true,
        });
        // Autoprefixer currently does not contain a method to check if autoprefixer is required
        // based on the provided list of browsers. However, it does contain a method that returns
        // informational text that can be used as a replacement. The text "Awesome!" will be present
        // when autoprefixer determines no actions are needed.
        // ref: https://github.com/postcss/autoprefixer/blob/e2f5c26ff1f3eaca95a21873723ce1cdf6e59f0e/lib/info.js#L118
        const autoprefixerInfo = autoprefixer.info();
        const skipAutoprefixer = autoprefixerInfo.includes('Awesome!');
        if (!skipAutoprefixer) {
            this.autoprefixer = autoprefixer;
        }
    }
    create(language) {
        // Return a noop plugin if no load actions are required
        if (!language.process && !this.autoprefixer && !this.options.tailwindConfiguration) {
            return {
                name: 'angular-' + language.name,
                setup() { },
            };
        }
        const { autoprefixer, cache, options } = this;
        return {
            name: 'angular-' + language.name,
            async setup(build) {
                // Setup postcss if needed by either autoprefixer or tailwind
                // TODO: Move this into the plugin factory to avoid repeat setup per created plugin
                let postcssProcessor;
                if (autoprefixer || options.tailwindConfiguration) {
                    postcss ?? (postcss = (await Promise.resolve().then(() => __importStar(require('postcss')))).default);
                    postcssProcessor = postcss();
                    if (options.tailwindConfiguration) {
                        const tailwind = await Promise.resolve(`${options.tailwindConfiguration.package}`).then(s => __importStar(require(s)));
                        postcssProcessor.use(tailwind.default({ config: options.tailwindConfiguration.file }));
                    }
                    if (autoprefixer) {
                        postcssProcessor.use(autoprefixer);
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
        const result = await postcssProcessor.process(data, {
            from: filename,
            to: filename,
            map: options.sourcemap && {
                inline: true,
                sourcesContent: true,
            },
        });
        const rawWarnings = result.warnings();
        let warnings;
        if (rawWarnings.length > 0) {
            const lineMappings = new Map();
            warnings = rawWarnings.map((warning) => {
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
        return {
            contents: result.css,
            loader: 'css',
            warnings,
        };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldC1wbHVnaW4tZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvc3R5bGVzaGVldHMvc3R5bGVzaGVldC1wbHVnaW4tZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGdFQUFvRDtBQUVwRCw4REFBaUM7QUFDakMsK0NBQTRDO0FBQzVDLHlDQUFvQztBQUNwQyw0REFBeUU7QUFFekU7OztHQUdHO0FBQ0gsSUFBSSxPQUF3RCxDQUFDO0FBMkM3RCxNQUFhLHVCQUF1QjtJQUdsQyxZQUNtQixPQUFnQyxFQUNoQyxLQUF1QjtRQUR2QixZQUFPLEdBQVAsT0FBTyxDQUF5QjtRQUNoQyxVQUFLLEdBQUwsS0FBSyxDQUFrQjtRQUV4QyxNQUFNLFlBQVksR0FBRyxJQUFBLHNCQUF3QixFQUFDO1lBQzVDLG9CQUFvQixFQUFFLE9BQU8sQ0FBQyxRQUFRO1lBQ3RDLHFCQUFxQixFQUFFLElBQUk7U0FDNUIsQ0FBQyxDQUFDO1FBRUgsd0ZBQXdGO1FBQ3hGLHlGQUF5RjtRQUN6Riw0RkFBNEY7UUFDNUYsc0RBQXNEO1FBQ3RELDhHQUE4RztRQUM5RyxNQUFNLGdCQUFnQixHQUFHLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUM3QyxNQUFNLGdCQUFnQixHQUFHLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUUvRCxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7WUFDckIsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7U0FDbEM7SUFDSCxDQUFDO0lBRUQsTUFBTSxDQUFDLFFBQXNDO1FBQzNDLHVEQUF1RDtRQUN2RCxJQUFJLENBQUMsUUFBUSxDQUFDLE9B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QkFDTCxNQUFNLEVBQUU7b0JBQ047d0JBQ0UsSUFBSSxFQUFFLEtBQUssQ0FBQyxNQUFNO3dCQUNsQixRQUFRLEVBQUU7NEJBQ1IsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJOzRCQUNoQixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7NEJBQ2hCLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQzs0QkFDeEMsUUFBUSxFQUFFLEtBQUssQ0FBQyxJQUFJLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO3lCQUN6RTtxQkFDRjtpQkFDRjthQUNGLENBQUM7U0FDSDtRQUVELE1BQU0sS0FBSyxDQUFDO0tBQ2I7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBjcmVhdGVBdXRvUHJlZml4ZXJQbHVnaW4gZnJvbSAnYXV0b3ByZWZpeGVyJztcbmltcG9ydCB0eXBlIHsgT25Mb2FkUmVzdWx0LCBQbHVnaW4sIFBsdWdpbkJ1aWxkIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBleHRuYW1lIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IExvYWRSZXN1bHRDYWNoZSwgY3JlYXRlQ2FjaGVkTG9hZCB9IGZyb20gJy4uL2xvYWQtcmVzdWx0LWNhY2hlJztcblxuLyoqXG4gKiBUaGUgbGF6eS1sb2FkZWQgaW5zdGFuY2Ugb2YgdGhlIHBvc3Rjc3Mgc3R5bGVzaGVldCBwb3N0cHJvY2Vzc29yLlxuICogSXQgaXMgb25seSBpbXBvcnRlZCBhbmQgaW5pdGlhbGl6ZWQgaWYgcG9zdGNzcyBpcyBuZWVkZWQuXG4gKi9cbmxldCBwb3N0Y3NzOiB0eXBlb2YgaW1wb3J0KCdwb3N0Y3NzJylbJ2RlZmF1bHQnXSB8IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgcGx1Z2luIG9wdGlvbnMgdG8gdXNlIHdoZW4gcHJvY2Vzc2luZyBzdHlsZXNoZWV0cy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTdHlsZXNoZWV0UGx1Z2luT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBDb250cm9scyB0aGUgdXNlIGFuZCBjcmVhdGlvbiBvZiBzb3VyY2VtYXBzIHdoZW4gcHJvY2Vzc2luZyB0aGUgc3R5bGVzaGVldHMuXG4gICAqIElmIHRydWUsIHNvdXJjZW1hcCBwcm9jZXNzaW5nIGlzIGVuYWJsZWQ7IGlmIGZhbHNlLCBkaXNhYmxlZC5cbiAgICovXG4gIHNvdXJjZW1hcDogYm9vbGVhbjtcblxuICBpbmNsdWRlUGF0aHM/OiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogT3B0aW9uYWwgY29tcG9uZW50IGRhdGEgZm9yIGFueSBpbmxpbmUgc3R5bGVzIGZyb20gQ29tcG9uZW50IGRlY29yYXRvciBgc3R5bGVzYCBmaWVsZHMuXG4gICAqIFRoZSBrZXkgaXMgYW4gaW50ZXJuYWwgYW5ndWxhciByZXNvdXJjZSBVUkkgYW5kIHRoZSB2YWx1ZSBpcyB0aGUgc3R5bGVzaGVldCBjb250ZW50LlxuICAgKi9cbiAgaW5saW5lQ29tcG9uZW50RGF0YT86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG5cbiAgLyoqXG4gICAqIFRoZSBicm93c2VycyB0byBzdXBwb3J0IGluIGJyb3dzZXJzbGlzdCBmb3JtYXQgd2hlbiBwcm9jZXNzaW5nIHN0eWxlc2hlZXRzLlxuICAgKiBTb21lIHBvc3Rjc3MgcGx1Z2lucyBzdWNoIGFzIGF1dG9wcmVmaXhlciByZXF1aXJlIHRoZSByYXcgYnJvd3NlcnNsaXN0IGluZm9ybWF0aW9uIGluc3RlYWRcbiAgICogb2YgdGhlIGVzYnVpbGQgZm9ybWF0dGVkIHRhcmdldC5cbiAgICovXG4gIGJyb3dzZXJzOiBzdHJpbmdbXTtcblxuICB0YWlsd2luZENvbmZpZ3VyYXRpb24/OiB7IGZpbGU6IHN0cmluZzsgcGFja2FnZTogc3RyaW5nIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3R5bGVzaGVldExhbmd1YWdlIHtcbiAgbmFtZTogc3RyaW5nO1xuICBjb21wb25lbnRGaWx0ZXI6IFJlZ0V4cDtcbiAgZmlsZUZpbHRlcjogUmVnRXhwO1xuICBwcm9jZXNzPyhcbiAgICBkYXRhOiBzdHJpbmcsXG4gICAgZmlsZTogc3RyaW5nLFxuICAgIGZvcm1hdDogc3RyaW5nLFxuICAgIG9wdGlvbnM6IFN0eWxlc2hlZXRQbHVnaW5PcHRpb25zLFxuICAgIGJ1aWxkOiBQbHVnaW5CdWlsZCxcbiAgKTogT25Mb2FkUmVzdWx0IHwgUHJvbWlzZTxPbkxvYWRSZXN1bHQ+O1xufVxuXG5leHBvcnQgY2xhc3MgU3R5bGVzaGVldFBsdWdpbkZhY3Rvcnkge1xuICBwcml2YXRlIGF1dG9wcmVmaXhlcjogaW1wb3J0KCdwb3N0Y3NzJykuUGx1Z2luIHwgdW5kZWZpbmVkO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczogU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMsXG4gICAgcHJpdmF0ZSByZWFkb25seSBjYWNoZT86IExvYWRSZXN1bHRDYWNoZSxcbiAgKSB7XG4gICAgY29uc3QgYXV0b3ByZWZpeGVyID0gY3JlYXRlQXV0b1ByZWZpeGVyUGx1Z2luKHtcbiAgICAgIG92ZXJyaWRlQnJvd3NlcnNsaXN0OiBvcHRpb25zLmJyb3dzZXJzLFxuICAgICAgaWdub3JlVW5rbm93blZlcnNpb25zOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gQXV0b3ByZWZpeGVyIGN1cnJlbnRseSBkb2VzIG5vdCBjb250YWluIGEgbWV0aG9kIHRvIGNoZWNrIGlmIGF1dG9wcmVmaXhlciBpcyByZXF1aXJlZFxuICAgIC8vIGJhc2VkIG9uIHRoZSBwcm92aWRlZCBsaXN0IG9mIGJyb3dzZXJzLiBIb3dldmVyLCBpdCBkb2VzIGNvbnRhaW4gYSBtZXRob2QgdGhhdCByZXR1cm5zXG4gICAgLy8gaW5mb3JtYXRpb25hbCB0ZXh0IHRoYXQgY2FuIGJlIHVzZWQgYXMgYSByZXBsYWNlbWVudC4gVGhlIHRleHQgXCJBd2Vzb21lIVwiIHdpbGwgYmUgcHJlc2VudFxuICAgIC8vIHdoZW4gYXV0b3ByZWZpeGVyIGRldGVybWluZXMgbm8gYWN0aW9ucyBhcmUgbmVlZGVkLlxuICAgIC8vIHJlZjogaHR0cHM6Ly9naXRodWIuY29tL3Bvc3Rjc3MvYXV0b3ByZWZpeGVyL2Jsb2IvZTJmNWMyNmZmMWYzZWFjYTk1YTIxODczNzIzY2UxY2RmNmU1OWYwZS9saWIvaW5mby5qcyNMMTE4XG4gICAgY29uc3QgYXV0b3ByZWZpeGVySW5mbyA9IGF1dG9wcmVmaXhlci5pbmZvKCk7XG4gICAgY29uc3Qgc2tpcEF1dG9wcmVmaXhlciA9IGF1dG9wcmVmaXhlckluZm8uaW5jbHVkZXMoJ0F3ZXNvbWUhJyk7XG5cbiAgICBpZiAoIXNraXBBdXRvcHJlZml4ZXIpIHtcbiAgICAgIHRoaXMuYXV0b3ByZWZpeGVyID0gYXV0b3ByZWZpeGVyO1xuICAgIH1cbiAgfVxuXG4gIGNyZWF0ZShsYW5ndWFnZTogUmVhZG9ubHk8U3R5bGVzaGVldExhbmd1YWdlPik6IFBsdWdpbiB7XG4gICAgLy8gUmV0dXJuIGEgbm9vcCBwbHVnaW4gaWYgbm8gbG9hZCBhY3Rpb25zIGFyZSByZXF1aXJlZFxuICAgIGlmICghbGFuZ3VhZ2UucHJvY2VzcyAmJiAhdGhpcy5hdXRvcHJlZml4ZXIgJiYgIXRoaXMub3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24pIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6ICdhbmd1bGFyLScgKyBsYW5ndWFnZS5uYW1lLFxuICAgICAgICBzZXR1cCgpIHt9LFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGF1dG9wcmVmaXhlciwgY2FjaGUsIG9wdGlvbnMgfSA9IHRoaXM7XG5cbiAgICByZXR1cm4ge1xuICAgICAgbmFtZTogJ2FuZ3VsYXItJyArIGxhbmd1YWdlLm5hbWUsXG4gICAgICBhc3luYyBzZXR1cChidWlsZCkge1xuICAgICAgICAvLyBTZXR1cCBwb3N0Y3NzIGlmIG5lZWRlZCBieSBlaXRoZXIgYXV0b3ByZWZpeGVyIG9yIHRhaWx3aW5kXG4gICAgICAgIC8vIFRPRE86IE1vdmUgdGhpcyBpbnRvIHRoZSBwbHVnaW4gZmFjdG9yeSB0byBhdm9pZCByZXBlYXQgc2V0dXAgcGVyIGNyZWF0ZWQgcGx1Z2luXG4gICAgICAgIGxldCBwb3N0Y3NzUHJvY2Vzc29yOiBpbXBvcnQoJ3Bvc3Rjc3MnKS5Qcm9jZXNzb3IgfCB1bmRlZmluZWQ7XG4gICAgICAgIGlmIChhdXRvcHJlZml4ZXIgfHwgb3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24pIHtcbiAgICAgICAgICBwb3N0Y3NzID8/PSAoYXdhaXQgaW1wb3J0KCdwb3N0Y3NzJykpLmRlZmF1bHQ7XG4gICAgICAgICAgcG9zdGNzc1Byb2Nlc3NvciA9IHBvc3Rjc3MoKTtcbiAgICAgICAgICBpZiAob3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IHRhaWx3aW5kID0gYXdhaXQgaW1wb3J0KG9wdGlvbnMudGFpbHdpbmRDb25maWd1cmF0aW9uLnBhY2thZ2UpO1xuICAgICAgICAgICAgcG9zdGNzc1Byb2Nlc3Nvci51c2UodGFpbHdpbmQuZGVmYXVsdCh7IGNvbmZpZzogb3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24uZmlsZSB9KSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChhdXRvcHJlZml4ZXIpIHtcbiAgICAgICAgICAgIHBvc3Rjc3NQcm9jZXNzb3IudXNlKGF1dG9wcmVmaXhlcik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWRkIGEgbG9hZCBjYWxsYmFjayB0byBzdXBwb3J0IGlubGluZSBDb21wb25lbnQgc3R5bGVzXG4gICAgICAgIGJ1aWxkLm9uTG9hZChcbiAgICAgICAgICB7IGZpbHRlcjogbGFuZ3VhZ2UuY29tcG9uZW50RmlsdGVyLCBuYW1lc3BhY2U6ICdhbmd1bGFyOnN0eWxlcy9jb21wb25lbnQnIH0sXG4gICAgICAgICAgY3JlYXRlQ2FjaGVkTG9hZChjYWNoZSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBvcHRpb25zLmlubGluZUNvbXBvbmVudERhdGE/LlthcmdzLnBhdGhdO1xuICAgICAgICAgICAgYXNzZXJ0KFxuICAgICAgICAgICAgICB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycsXG4gICAgICAgICAgICAgIGBjb21wb25lbnQgc3R5bGUgbmFtZSBzaG91bGQgYWx3YXlzIGJlIGZvdW5kIFske2FyZ3MucGF0aH1dYCxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGNvbnN0IFtmb3JtYXQsICwgZmlsZW5hbWVdID0gYXJncy5wYXRoLnNwbGl0KCc7JywgMyk7XG5cbiAgICAgICAgICAgIHJldHVybiBwcm9jZXNzU3R5bGVzaGVldChcbiAgICAgICAgICAgICAgbGFuZ3VhZ2UsXG4gICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgIGZpbGVuYW1lLFxuICAgICAgICAgICAgICBmb3JtYXQsXG4gICAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICAgIGJ1aWxkLFxuICAgICAgICAgICAgICBwb3N0Y3NzUHJvY2Vzc29yLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KSxcbiAgICAgICAgKTtcblxuICAgICAgICAvLyBBZGQgYSBsb2FkIGNhbGxiYWNrIHRvIHN1cHBvcnQgZmlsZXMgZnJvbSBkaXNrXG4gICAgICAgIGJ1aWxkLm9uTG9hZChcbiAgICAgICAgICB7IGZpbHRlcjogbGFuZ3VhZ2UuZmlsZUZpbHRlciB9LFxuICAgICAgICAgIGNyZWF0ZUNhY2hlZExvYWQoY2FjaGUsIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVhZEZpbGUoYXJncy5wYXRoLCAndXRmLTgnKTtcblxuICAgICAgICAgICAgcmV0dXJuIHByb2Nlc3NTdHlsZXNoZWV0KFxuICAgICAgICAgICAgICBsYW5ndWFnZSxcbiAgICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgICAgYXJncy5wYXRoLFxuICAgICAgICAgICAgICBleHRuYW1lKGFyZ3MucGF0aCkudG9Mb3dlckNhc2UoKS5zbGljZSgxKSxcbiAgICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgICAgYnVpbGQsXG4gICAgICAgICAgICAgIHBvc3Rjc3NQcm9jZXNzb3IsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgICAgfSxcbiAgICB9O1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NTdHlsZXNoZWV0KFxuICBsYW5ndWFnZTogUmVhZG9ubHk8U3R5bGVzaGVldExhbmd1YWdlPixcbiAgZGF0YTogc3RyaW5nLFxuICBmaWxlbmFtZTogc3RyaW5nLFxuICBmb3JtYXQ6IHN0cmluZyxcbiAgb3B0aW9uczogU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMsXG4gIGJ1aWxkOiBQbHVnaW5CdWlsZCxcbiAgcG9zdGNzc1Byb2Nlc3NvcjogaW1wb3J0KCdwb3N0Y3NzJykuUHJvY2Vzc29yIHwgdW5kZWZpbmVkLFxuKSB7XG4gIGxldCByZXN1bHQ6IE9uTG9hZFJlc3VsdDtcblxuICAvLyBQcm9jZXNzIHRoZSBpbnB1dCBkYXRhIGlmIHRoZSBsYW5ndWFnZSByZXF1aXJlcyBwcmVwcm9jZXNzaW5nXG4gIGlmIChsYW5ndWFnZS5wcm9jZXNzKSB7XG4gICAgcmVzdWx0ID0gYXdhaXQgbGFuZ3VhZ2UucHJvY2VzcyhkYXRhLCBmaWxlbmFtZSwgZm9ybWF0LCBvcHRpb25zLCBidWlsZCk7XG4gIH0gZWxzZSB7XG4gICAgcmVzdWx0ID0ge1xuICAgICAgY29udGVudHM6IGRhdGEsXG4gICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgd2F0Y2hGaWxlczogW2ZpbGVuYW1lXSxcbiAgICB9O1xuICB9XG5cbiAgLy8gVHJhbnNmb3JtIHdpdGggcG9zdGNzcyBpZiBuZWVkZWQgYW5kIHRoZXJlIGFyZSBubyBlcnJvcnNcbiAgaWYgKHBvc3Rjc3NQcm9jZXNzb3IgJiYgcmVzdWx0LmNvbnRlbnRzICYmICFyZXN1bHQuZXJyb3JzPy5sZW5ndGgpIHtcbiAgICBjb25zdCBwb3N0Y3NzUmVzdWx0ID0gYXdhaXQgY29tcGlsZVN0cmluZyhcbiAgICAgIHR5cGVvZiByZXN1bHQuY29udGVudHMgPT09ICdzdHJpbmcnXG4gICAgICAgID8gcmVzdWx0LmNvbnRlbnRzXG4gICAgICAgIDogQnVmZmVyLmZyb20ocmVzdWx0LmNvbnRlbnRzKS50b1N0cmluZygndXRmLTgnKSxcbiAgICAgIGZpbGVuYW1lLFxuICAgICAgcG9zdGNzc1Byb2Nlc3NvcixcbiAgICAgIG9wdGlvbnMsXG4gICAgKTtcblxuICAgIC8vIE1lcmdlIHJlc3VsdHNcbiAgICBpZiAocG9zdGNzc1Jlc3VsdC5lcnJvcnM/Lmxlbmd0aCkge1xuICAgICAgZGVsZXRlIHJlc3VsdC5jb250ZW50cztcbiAgICB9XG4gICAgaWYgKHJlc3VsdC53YXJuaW5ncyAmJiBwb3N0Y3NzUmVzdWx0Lndhcm5pbmdzKSB7XG4gICAgICBwb3N0Y3NzUmVzdWx0Lndhcm5pbmdzLnVuc2hpZnQoLi4ucmVzdWx0Lndhcm5pbmdzKTtcbiAgICB9XG4gICAgaWYgKHJlc3VsdC53YXRjaEZpbGVzICYmIHBvc3Rjc3NSZXN1bHQud2F0Y2hGaWxlcykge1xuICAgICAgcG9zdGNzc1Jlc3VsdC53YXRjaEZpbGVzLnVuc2hpZnQoLi4ucmVzdWx0LndhdGNoRmlsZXMpO1xuICAgIH1cbiAgICBpZiAocmVzdWx0LndhdGNoRGlycyAmJiBwb3N0Y3NzUmVzdWx0LndhdGNoRGlycykge1xuICAgICAgcG9zdGNzc1Jlc3VsdC53YXRjaERpcnMudW5zaGlmdCguLi5yZXN1bHQud2F0Y2hEaXJzKTtcbiAgICB9XG4gICAgcmVzdWx0ID0ge1xuICAgICAgLi4ucmVzdWx0LFxuICAgICAgLi4ucG9zdGNzc1Jlc3VsdCxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgcHJvdmlkZWQgQ1NTIHN0eWxlc2hlZXQgZGF0YSB1c2luZyBhIHByb3ZpZGVkIHBvc3Rjc3MgcHJvY2Vzc29yIGFuZCBwcm92aWRlcyBhblxuICogZXNidWlsZCBsb2FkIHJlc3VsdCB0aGF0IGNhbiBiZSB1c2VkIGRpcmVjdGx5IGJ5IGFuIGVzYnVpbGQgUGx1Z2luLlxuICogQHBhcmFtIGRhdGEgVGhlIHN0eWxlc2hlZXQgY29udGVudCB0byBwcm9jZXNzLlxuICogQHBhcmFtIGZpbGVuYW1lIFRoZSBuYW1lIG9mIHRoZSBmaWxlIHRoYXQgY29udGFpbnMgdGhlIGRhdGEuXG4gKiBAcGFyYW0gcG9zdGNzc1Byb2Nlc3NvciBBIHBvc3Rjc3MgcHJvY2Vzc29yIGluc3RhbmNlIHRvIHVzZS5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBwbHVnaW4gb3B0aW9ucyB0byBjb250cm9sIHRoZSBwcm9jZXNzaW5nLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBPbkxvYWRlclJlc3VsdCBvYmplY3Qgd2l0aCB0aGUgcHJvY2Vzc2VkIGNvbnRlbnQsIHdhcm5pbmdzLCBhbmQvb3IgZXJyb3JzLlxuICovXG5hc3luYyBmdW5jdGlvbiBjb21waWxlU3RyaW5nKFxuICBkYXRhOiBzdHJpbmcsXG4gIGZpbGVuYW1lOiBzdHJpbmcsXG4gIHBvc3Rjc3NQcm9jZXNzb3I6IGltcG9ydCgncG9zdGNzcycpLlByb2Nlc3NvcixcbiAgb3B0aW9uczogU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMsXG4pOiBQcm9taXNlPE9uTG9hZFJlc3VsdD4ge1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBvc3Rjc3NQcm9jZXNzb3IucHJvY2VzcyhkYXRhLCB7XG4gICAgICBmcm9tOiBmaWxlbmFtZSxcbiAgICAgIHRvOiBmaWxlbmFtZSxcbiAgICAgIG1hcDogb3B0aW9ucy5zb3VyY2VtYXAgJiYge1xuICAgICAgICBpbmxpbmU6IHRydWUsXG4gICAgICAgIHNvdXJjZXNDb250ZW50OiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJhd1dhcm5pbmdzID0gcmVzdWx0Lndhcm5pbmdzKCk7XG4gICAgbGV0IHdhcm5pbmdzO1xuICAgIGlmIChyYXdXYXJuaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBsaW5lTWFwcGluZ3MgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nW10gfCBudWxsPigpO1xuICAgICAgd2FybmluZ3MgPSByYXdXYXJuaW5ncy5tYXAoKHdhcm5pbmcpID0+IHtcbiAgICAgICAgY29uc3QgZmlsZSA9IHdhcm5pbmcubm9kZS5zb3VyY2U/LmlucHV0LmZpbGU7XG4gICAgICAgIGlmIChmaWxlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZXR1cm4geyB0ZXh0OiB3YXJuaW5nLnRleHQgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBsaW5lcyA9IGxpbmVNYXBwaW5ncy5nZXQoZmlsZSk7XG4gICAgICAgIGlmIChsaW5lcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgbGluZXMgPSB3YXJuaW5nLm5vZGUuc291cmNlPy5pbnB1dC5jc3Muc3BsaXQoL1xccj9cXG4vKTtcbiAgICAgICAgICBsaW5lTWFwcGluZ3Muc2V0KGZpbGUsIGxpbmVzID8/IG51bGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0ZXh0OiB3YXJuaW5nLnRleHQsXG4gICAgICAgICAgbG9jYXRpb246IHtcbiAgICAgICAgICAgIGZpbGUsXG4gICAgICAgICAgICBsaW5lOiB3YXJuaW5nLmxpbmUsXG4gICAgICAgICAgICBjb2x1bW46IHdhcm5pbmcuY29sdW1uIC0gMSxcbiAgICAgICAgICAgIGxpbmVUZXh0OiBsaW5lcz8uW3dhcm5pbmcubGluZSAtIDFdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29udGVudHM6IHJlc3VsdC5jc3MsXG4gICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgd2FybmluZ3MsXG4gICAgfTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBwb3N0Y3NzID8/PSAoYXdhaXQgaW1wb3J0KCdwb3N0Y3NzJykpLmRlZmF1bHQ7XG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgcG9zdGNzcy5Dc3NTeW50YXhFcnJvcikge1xuICAgICAgY29uc3QgbGluZXMgPSBlcnJvci5zb3VyY2U/LnNwbGl0KC9cXHI/XFxuLyk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVycm9yczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRleHQ6IGVycm9yLnJlYXNvbixcbiAgICAgICAgICAgIGxvY2F0aW9uOiB7XG4gICAgICAgICAgICAgIGZpbGU6IGVycm9yLmZpbGUsXG4gICAgICAgICAgICAgIGxpbmU6IGVycm9yLmxpbmUsXG4gICAgICAgICAgICAgIGNvbHVtbjogZXJyb3IuY29sdW1uICYmIGVycm9yLmNvbHVtbiAtIDEsXG4gICAgICAgICAgICAgIGxpbmVUZXh0OiBlcnJvci5saW5lID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBsaW5lcz8uW2Vycm9yLmxpbmUgLSAxXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cbiJdfQ==