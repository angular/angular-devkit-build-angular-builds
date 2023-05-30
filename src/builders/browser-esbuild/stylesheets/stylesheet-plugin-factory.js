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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldC1wbHVnaW4tZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9zdHlsZXNoZWV0cy9zdHlsZXNoZWV0LXBsdWdpbi1mYWN0b3J5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsZ0VBQW9EO0FBRXBELDhEQUFpQztBQUNqQywrQ0FBNEM7QUFDNUMseUNBQW9DO0FBQ3BDLDREQUF5RTtBQUV6RTs7O0dBR0c7QUFDSCxJQUFJLE9BQXdELENBQUM7QUEyQzdELE1BQWEsdUJBQXVCO0lBR2xDLFlBQ21CLE9BQWdDLEVBQ2hDLEtBQXVCO1FBRHZCLFlBQU8sR0FBUCxPQUFPLENBQXlCO1FBQ2hDLFVBQUssR0FBTCxLQUFLLENBQWtCO1FBRXhDLE1BQU0sWUFBWSxHQUFHLElBQUEsc0JBQXdCLEVBQUM7WUFDNUMsb0JBQW9CLEVBQUUsT0FBTyxDQUFDLFFBQVE7WUFDdEMscUJBQXFCLEVBQUUsSUFBSTtTQUM1QixDQUFDLENBQUM7UUFFSCx3RkFBd0Y7UUFDeEYseUZBQXlGO1FBQ3pGLDRGQUE0RjtRQUM1RixzREFBc0Q7UUFDdEQsOEdBQThHO1FBQzlHLE1BQU0sZ0JBQWdCLEdBQUcsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQzdDLE1BQU0sZ0JBQWdCLEdBQUcsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRS9ELElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtZQUNyQixJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVksQ0FBQztTQUNsQztJQUNILENBQUM7SUFFRCxNQUFNLENBQUMsUUFBc0M7UUFDM0MsdURBQXVEO1FBQ3ZELElBQUksQ0FBQyxR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QUUzQyxPQUFPO2dCQUNMLE1BQU0sRUFBRTtvQkFDTjt3QkFDRSxJQUFJLEVBQUUsS0FBSyxDQUFDLE1BQU07d0JBQ2xCLFFBQVEsRUFBRTs0QkFDUixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7NEJBQ2hCLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTs0QkFDaEIsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDOzRCQUN4QyxRQUFRLEVBQUUsS0FBSyxDQUFDLElBQUksS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7eUJBQ3pFO3FCQUNGO2lCQUNGO2FBQ0YsQ0FBQztTQUNIO1FBRUQsTUFBTSxLQUFLLENBQUM7S0FDYjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IGNyZWF0ZUF1dG9QcmVmaXhlclBsdWdpbiBmcm9tICdhdXRvcHJlZml4ZXInO1xuaW1wb3J0IHR5cGUgeyBPbkxvYWRSZXN1bHQsIFBsdWdpbiwgUGx1Z2luQnVpbGQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IGV4dG5hbWUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgTG9hZFJlc3VsdENhY2hlLCBjcmVhdGVDYWNoZWRMb2FkIH0gZnJvbSAnLi4vbG9hZC1yZXN1bHQtY2FjaGUnO1xuXG4vKipcbiAqIFRoZSBsYXp5LWxvYWRlZCBpbnN0YW5jZSBvZiB0aGUgcG9zdGNzcyBzdHlsZXNoZWV0IHBvc3Rwcm9jZXNzb3IuXG4gKiBJdCBpcyBvbmx5IGltcG9ydGVkIGFuZCBpbml0aWFsaXplZCBpZiBwb3N0Y3NzIGlzIG5lZWRlZC5cbiAqL1xubGV0IHBvc3Rjc3M6IHR5cGVvZiBpbXBvcnQoJ3Bvc3Rjc3MnKVsnZGVmYXVsdCddIHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBwbHVnaW4gb3B0aW9ucyB0byB1c2Ugd2hlbiBwcm9jZXNzaW5nIHN0eWxlc2hlZXRzLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFN0eWxlc2hlZXRQbHVnaW5PcHRpb25zIHtcbiAgLyoqXG4gICAqIENvbnRyb2xzIHRoZSB1c2UgYW5kIGNyZWF0aW9uIG9mIHNvdXJjZW1hcHMgd2hlbiBwcm9jZXNzaW5nIHRoZSBzdHlsZXNoZWV0cy5cbiAgICogSWYgdHJ1ZSwgc291cmNlbWFwIHByb2Nlc3NpbmcgaXMgZW5hYmxlZDsgaWYgZmFsc2UsIGRpc2FibGVkLlxuICAgKi9cbiAgc291cmNlbWFwOiBib29sZWFuO1xuXG4gIGluY2x1ZGVQYXRocz86IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBPcHRpb25hbCBjb21wb25lbnQgZGF0YSBmb3IgYW55IGlubGluZSBzdHlsZXMgZnJvbSBDb21wb25lbnQgZGVjb3JhdG9yIGBzdHlsZXNgIGZpZWxkcy5cbiAgICogVGhlIGtleSBpcyBhbiBpbnRlcm5hbCBhbmd1bGFyIHJlc291cmNlIFVSSSBhbmQgdGhlIHZhbHVlIGlzIHRoZSBzdHlsZXNoZWV0IGNvbnRlbnQuXG4gICAqL1xuICBpbmxpbmVDb21wb25lbnREYXRhPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcblxuICAvKipcbiAgICogVGhlIGJyb3dzZXJzIHRvIHN1cHBvcnQgaW4gYnJvd3NlcnNsaXN0IGZvcm1hdCB3aGVuIHByb2Nlc3Npbmcgc3R5bGVzaGVldHMuXG4gICAqIFNvbWUgcG9zdGNzcyBwbHVnaW5zIHN1Y2ggYXMgYXV0b3ByZWZpeGVyIHJlcXVpcmUgdGhlIHJhdyBicm93c2Vyc2xpc3QgaW5mb3JtYXRpb24gaW5zdGVhZFxuICAgKiBvZiB0aGUgZXNidWlsZCBmb3JtYXR0ZWQgdGFyZ2V0LlxuICAgKi9cbiAgYnJvd3NlcnM6IHN0cmluZ1tdO1xuXG4gIHRhaWx3aW5kQ29uZmlndXJhdGlvbj86IHsgZmlsZTogc3RyaW5nOyBwYWNrYWdlOiBzdHJpbmcgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdHlsZXNoZWV0TGFuZ3VhZ2Uge1xuICBuYW1lOiBzdHJpbmc7XG4gIGNvbXBvbmVudEZpbHRlcjogUmVnRXhwO1xuICBmaWxlRmlsdGVyOiBSZWdFeHA7XG4gIHByb2Nlc3M/KFxuICAgIGRhdGE6IHN0cmluZyxcbiAgICBmaWxlOiBzdHJpbmcsXG4gICAgZm9ybWF0OiBzdHJpbmcsXG4gICAgb3B0aW9uczogU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMsXG4gICAgYnVpbGQ6IFBsdWdpbkJ1aWxkLFxuICApOiBPbkxvYWRSZXN1bHQgfCBQcm9taXNlPE9uTG9hZFJlc3VsdD47XG59XG5cbmV4cG9ydCBjbGFzcyBTdHlsZXNoZWV0UGx1Z2luRmFjdG9yeSB7XG4gIHByaXZhdGUgYXV0b3ByZWZpeGVyOiBpbXBvcnQoJ3Bvc3Rjc3MnKS5QbHVnaW4gfCB1bmRlZmluZWQ7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBvcHRpb25zOiBTdHlsZXNoZWV0UGx1Z2luT3B0aW9ucyxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGNhY2hlPzogTG9hZFJlc3VsdENhY2hlLFxuICApIHtcbiAgICBjb25zdCBhdXRvcHJlZml4ZXIgPSBjcmVhdGVBdXRvUHJlZml4ZXJQbHVnaW4oe1xuICAgICAgb3ZlcnJpZGVCcm93c2Vyc2xpc3Q6IG9wdGlvbnMuYnJvd3NlcnMsXG4gICAgICBpZ25vcmVVbmtub3duVmVyc2lvbnM6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBBdXRvcHJlZml4ZXIgY3VycmVudGx5IGRvZXMgbm90IGNvbnRhaW4gYSBtZXRob2QgdG8gY2hlY2sgaWYgYXV0b3ByZWZpeGVyIGlzIHJlcXVpcmVkXG4gICAgLy8gYmFzZWQgb24gdGhlIHByb3ZpZGVkIGxpc3Qgb2YgYnJvd3NlcnMuIEhvd2V2ZXIsIGl0IGRvZXMgY29udGFpbiBhIG1ldGhvZCB0aGF0IHJldHVybnNcbiAgICAvLyBpbmZvcm1hdGlvbmFsIHRleHQgdGhhdCBjYW4gYmUgdXNlZCBhcyBhIHJlcGxhY2VtZW50LiBUaGUgdGV4dCBcIkF3ZXNvbWUhXCIgd2lsbCBiZSBwcmVzZW50XG4gICAgLy8gd2hlbiBhdXRvcHJlZml4ZXIgZGV0ZXJtaW5lcyBubyBhY3Rpb25zIGFyZSBuZWVkZWQuXG4gICAgLy8gcmVmOiBodHRwczovL2dpdGh1Yi5jb20vcG9zdGNzcy9hdXRvcHJlZml4ZXIvYmxvYi9lMmY1YzI2ZmYxZjNlYWNhOTVhMjE4NzM3MjNjZTFjZGY2ZTU5ZjBlL2xpYi9pbmZvLmpzI0wxMThcbiAgICBjb25zdCBhdXRvcHJlZml4ZXJJbmZvID0gYXV0b3ByZWZpeGVyLmluZm8oKTtcbiAgICBjb25zdCBza2lwQXV0b3ByZWZpeGVyID0gYXV0b3ByZWZpeGVySW5mby5pbmNsdWRlcygnQXdlc29tZSEnKTtcblxuICAgIGlmICghc2tpcEF1dG9wcmVmaXhlcikge1xuICAgICAgdGhpcy5hdXRvcHJlZml4ZXIgPSBhdXRvcHJlZml4ZXI7XG4gICAgfVxuICB9XG5cbiAgY3JlYXRlKGxhbmd1YWdlOiBSZWFkb25seTxTdHlsZXNoZWV0TGFuZ3VhZ2U+KTogUGx1Z2luIHtcbiAgICAvLyBSZXR1cm4gYSBub29wIHBsdWdpbiBpZiBubyBsb2FkIGFjdGlvbnMgYXJlIHJlcXVpcmVkXG4gICAgaWYgKCFsYW5ndWFnZS5wcm9jZXNzICYmICF0aGlzLmF1dG9wcmVmaXhlciAmJiAhdGhpcy5vcHRpb25zLnRhaWx3aW5kQ29uZmlndXJhdGlvbikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogJ2FuZ3VsYXItJyArIGxhbmd1YWdlLm5hbWUsXG4gICAgICAgIHNldHVwKCkge30sXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IHsgYXV0b3ByZWZpeGVyLCBjYWNoZSwgb3B0aW9ucyB9ID0gdGhpcztcblxuICAgIHJldHVybiB7XG4gICAgICBuYW1lOiAnYW5ndWxhci0nICsgbGFuZ3VhZ2UubmFtZSxcbiAgICAgIGFzeW5jIHNldHVwKGJ1aWxkKSB7XG4gICAgICAgIC8vIFNldHVwIHBvc3Rjc3MgaWYgbmVlZGVkIGJ5IGVpdGhlciBhdXRvcHJlZml4ZXIgb3IgdGFpbHdpbmRcbiAgICAgICAgLy8gVE9ETzogTW92ZSB0aGlzIGludG8gdGhlIHBsdWdpbiBmYWN0b3J5IHRvIGF2b2lkIHJlcGVhdCBzZXR1cCBwZXIgY3JlYXRlZCBwbHVnaW5cbiAgICAgICAgbGV0IHBvc3Rjc3NQcm9jZXNzb3I6IGltcG9ydCgncG9zdGNzcycpLlByb2Nlc3NvciB8IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKGF1dG9wcmVmaXhlciB8fCBvcHRpb25zLnRhaWx3aW5kQ29uZmlndXJhdGlvbikge1xuICAgICAgICAgIHBvc3Rjc3MgPz89IChhd2FpdCBpbXBvcnQoJ3Bvc3Rjc3MnKSkuZGVmYXVsdDtcbiAgICAgICAgICBwb3N0Y3NzUHJvY2Vzc29yID0gcG9zdGNzcygpO1xuICAgICAgICAgIGlmIChvcHRpb25zLnRhaWx3aW5kQ29uZmlndXJhdGlvbikge1xuICAgICAgICAgICAgY29uc3QgdGFpbHdpbmQgPSBhd2FpdCBpbXBvcnQob3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24ucGFja2FnZSk7XG4gICAgICAgICAgICBwb3N0Y3NzUHJvY2Vzc29yLnVzZSh0YWlsd2luZC5kZWZhdWx0KHsgY29uZmlnOiBvcHRpb25zLnRhaWx3aW5kQ29uZmlndXJhdGlvbi5maWxlIH0pKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGF1dG9wcmVmaXhlcikge1xuICAgICAgICAgICAgcG9zdGNzc1Byb2Nlc3Nvci51c2UoYXV0b3ByZWZpeGVyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZGQgYSBsb2FkIGNhbGxiYWNrIHRvIHN1cHBvcnQgaW5saW5lIENvbXBvbmVudCBzdHlsZXNcbiAgICAgICAgYnVpbGQub25Mb2FkKFxuICAgICAgICAgIHsgZmlsdGVyOiBsYW5ndWFnZS5jb21wb25lbnRGaWx0ZXIsIG5hbWVzcGFjZTogJ2FuZ3VsYXI6c3R5bGVzL2NvbXBvbmVudCcgfSxcbiAgICAgICAgICBjcmVhdGVDYWNoZWRMb2FkKGNhY2hlLCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IG9wdGlvbnMuaW5saW5lQ29tcG9uZW50RGF0YT8uW2FyZ3MucGF0aF07XG4gICAgICAgICAgICBhc3NlcnQoXG4gICAgICAgICAgICAgIHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgYGNvbXBvbmVudCBzdHlsZSBuYW1lIHNob3VsZCBhbHdheXMgYmUgZm91bmQgWyR7YXJncy5wYXRofV1gLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgY29uc3QgW2Zvcm1hdCwgLCBmaWxlbmFtZV0gPSBhcmdzLnBhdGguc3BsaXQoJzsnLCAzKTtcblxuICAgICAgICAgICAgcmV0dXJuIHByb2Nlc3NTdHlsZXNoZWV0KFxuICAgICAgICAgICAgICBsYW5ndWFnZSxcbiAgICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgICAgZmlsZW5hbWUsXG4gICAgICAgICAgICAgIGZvcm1hdCxcbiAgICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgICAgYnVpbGQsXG4gICAgICAgICAgICAgIHBvc3Rjc3NQcm9jZXNzb3IsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuXG4gICAgICAgIC8vIEFkZCBhIGxvYWQgY2FsbGJhY2sgdG8gc3VwcG9ydCBmaWxlcyBmcm9tIGRpc2tcbiAgICAgICAgYnVpbGQub25Mb2FkKFxuICAgICAgICAgIHsgZmlsdGVyOiBsYW5ndWFnZS5maWxlRmlsdGVyIH0sXG4gICAgICAgICAgY3JlYXRlQ2FjaGVkTG9hZChjYWNoZSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZWFkRmlsZShhcmdzLnBhdGgsICd1dGYtOCcpO1xuXG4gICAgICAgICAgICByZXR1cm4gcHJvY2Vzc1N0eWxlc2hlZXQoXG4gICAgICAgICAgICAgIGxhbmd1YWdlLFxuICAgICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgICBhcmdzLnBhdGgsXG4gICAgICAgICAgICAgIGV4dG5hbWUoYXJncy5wYXRoKS50b0xvd2VyQ2FzZSgpLnNsaWNlKDEpLFxuICAgICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgICBidWlsZCxcbiAgICAgICAgICAgICAgcG9zdGNzc1Byb2Nlc3NvcixcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSksXG4gICAgICAgICk7XG4gICAgICB9LFxuICAgIH07XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gcHJvY2Vzc1N0eWxlc2hlZXQoXG4gIGxhbmd1YWdlOiBSZWFkb25seTxTdHlsZXNoZWV0TGFuZ3VhZ2U+LFxuICBkYXRhOiBzdHJpbmcsXG4gIGZpbGVuYW1lOiBzdHJpbmcsXG4gIGZvcm1hdDogc3RyaW5nLFxuICBvcHRpb25zOiBTdHlsZXNoZWV0UGx1Z2luT3B0aW9ucyxcbiAgYnVpbGQ6IFBsdWdpbkJ1aWxkLFxuICBwb3N0Y3NzUHJvY2Vzc29yOiBpbXBvcnQoJ3Bvc3Rjc3MnKS5Qcm9jZXNzb3IgfCB1bmRlZmluZWQsXG4pIHtcbiAgbGV0IHJlc3VsdDogT25Mb2FkUmVzdWx0O1xuXG4gIC8vIFByb2Nlc3MgdGhlIGlucHV0IGRhdGEgaWYgdGhlIGxhbmd1YWdlIHJlcXVpcmVzIHByZXByb2Nlc3NpbmdcbiAgaWYgKGxhbmd1YWdlLnByb2Nlc3MpIHtcbiAgICByZXN1bHQgPSBhd2FpdCBsYW5ndWFnZS5wcm9jZXNzKGRhdGEsIGZpbGVuYW1lLCBmb3JtYXQsIG9wdGlvbnMsIGJ1aWxkKTtcbiAgfSBlbHNlIHtcbiAgICByZXN1bHQgPSB7XG4gICAgICBjb250ZW50czogZGF0YSxcbiAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICB3YXRjaEZpbGVzOiBbZmlsZW5hbWVdLFxuICAgIH07XG4gIH1cblxuICAvLyBUcmFuc2Zvcm0gd2l0aCBwb3N0Y3NzIGlmIG5lZWRlZCBhbmQgdGhlcmUgYXJlIG5vIGVycm9yc1xuICBpZiAocG9zdGNzc1Byb2Nlc3NvciAmJiByZXN1bHQuY29udGVudHMgJiYgIXJlc3VsdC5lcnJvcnM/Lmxlbmd0aCkge1xuICAgIGNvbnN0IHBvc3Rjc3NSZXN1bHQgPSBhd2FpdCBjb21waWxlU3RyaW5nKFxuICAgICAgdHlwZW9mIHJlc3VsdC5jb250ZW50cyA9PT0gJ3N0cmluZydcbiAgICAgICAgPyByZXN1bHQuY29udGVudHNcbiAgICAgICAgOiBCdWZmZXIuZnJvbShyZXN1bHQuY29udGVudHMpLnRvU3RyaW5nKCd1dGYtOCcpLFxuICAgICAgZmlsZW5hbWUsXG4gICAgICBwb3N0Y3NzUHJvY2Vzc29yLFxuICAgICAgb3B0aW9ucyxcbiAgICApO1xuXG4gICAgLy8gTWVyZ2UgcmVzdWx0c1xuICAgIGlmIChwb3N0Y3NzUmVzdWx0LmVycm9ycz8ubGVuZ3RoKSB7XG4gICAgICBkZWxldGUgcmVzdWx0LmNvbnRlbnRzO1xuICAgIH1cbiAgICBpZiAocmVzdWx0Lndhcm5pbmdzICYmIHBvc3Rjc3NSZXN1bHQud2FybmluZ3MpIHtcbiAgICAgIHBvc3Rjc3NSZXN1bHQud2FybmluZ3MudW5zaGlmdCguLi5yZXN1bHQud2FybmluZ3MpO1xuICAgIH1cbiAgICBpZiAocmVzdWx0LndhdGNoRmlsZXMgJiYgcG9zdGNzc1Jlc3VsdC53YXRjaEZpbGVzKSB7XG4gICAgICBwb3N0Y3NzUmVzdWx0LndhdGNoRmlsZXMudW5zaGlmdCguLi5yZXN1bHQud2F0Y2hGaWxlcyk7XG4gICAgfVxuICAgIGlmIChyZXN1bHQud2F0Y2hEaXJzICYmIHBvc3Rjc3NSZXN1bHQud2F0Y2hEaXJzKSB7XG4gICAgICBwb3N0Y3NzUmVzdWx0LndhdGNoRGlycy51bnNoaWZ0KC4uLnJlc3VsdC53YXRjaERpcnMpO1xuICAgIH1cbiAgICByZXN1bHQgPSB7XG4gICAgICAuLi5yZXN1bHQsXG4gICAgICAuLi5wb3N0Y3NzUmVzdWx0LFxuICAgIH07XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBwcm92aWRlZCBDU1Mgc3R5bGVzaGVldCBkYXRhIHVzaW5nIGEgcHJvdmlkZWQgcG9zdGNzcyBwcm9jZXNzb3IgYW5kIHByb3ZpZGVzIGFuXG4gKiBlc2J1aWxkIGxvYWQgcmVzdWx0IHRoYXQgY2FuIGJlIHVzZWQgZGlyZWN0bHkgYnkgYW4gZXNidWlsZCBQbHVnaW4uXG4gKiBAcGFyYW0gZGF0YSBUaGUgc3R5bGVzaGVldCBjb250ZW50IHRvIHByb2Nlc3MuXG4gKiBAcGFyYW0gZmlsZW5hbWUgVGhlIG5hbWUgb2YgdGhlIGZpbGUgdGhhdCBjb250YWlucyB0aGUgZGF0YS5cbiAqIEBwYXJhbSBwb3N0Y3NzUHJvY2Vzc29yIEEgcG9zdGNzcyBwcm9jZXNzb3IgaW5zdGFuY2UgdG8gdXNlLlxuICogQHBhcmFtIG9wdGlvbnMgVGhlIHBsdWdpbiBvcHRpb25zIHRvIGNvbnRyb2wgdGhlIHByb2Nlc3NpbmcuXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIE9uTG9hZGVyUmVzdWx0IG9iamVjdCB3aXRoIHRoZSBwcm9jZXNzZWQgY29udGVudCwgd2FybmluZ3MsIGFuZC9vciBlcnJvcnMuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGNvbXBpbGVTdHJpbmcoXG4gIGRhdGE6IHN0cmluZyxcbiAgZmlsZW5hbWU6IHN0cmluZyxcbiAgcG9zdGNzc1Byb2Nlc3NvcjogaW1wb3J0KCdwb3N0Y3NzJykuUHJvY2Vzc29yLFxuICBvcHRpb25zOiBTdHlsZXNoZWV0UGx1Z2luT3B0aW9ucyxcbik6IFByb21pc2U8T25Mb2FkUmVzdWx0PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcG9zdGNzc1Byb2Nlc3Nvci5wcm9jZXNzKGRhdGEsIHtcbiAgICAgIGZyb206IGZpbGVuYW1lLFxuICAgICAgdG86IGZpbGVuYW1lLFxuICAgICAgbWFwOiBvcHRpb25zLnNvdXJjZW1hcCAmJiB7XG4gICAgICAgIGlubGluZTogdHJ1ZSxcbiAgICAgICAgc291cmNlc0NvbnRlbnQ6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgcmF3V2FybmluZ3MgPSByZXN1bHQud2FybmluZ3MoKTtcbiAgICBsZXQgd2FybmluZ3M7XG4gICAgaWYgKHJhd1dhcm5pbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGxpbmVNYXBwaW5ncyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXSB8IG51bGw+KCk7XG4gICAgICB3YXJuaW5ncyA9IHJhd1dhcm5pbmdzLm1hcCgod2FybmluZykgPT4ge1xuICAgICAgICBjb25zdCBmaWxlID0gd2FybmluZy5ub2RlLnNvdXJjZT8uaW5wdXQuZmlsZTtcbiAgICAgICAgaWYgKGZpbGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJldHVybiB7IHRleHQ6IHdhcm5pbmcudGV4dCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGxpbmVzID0gbGluZU1hcHBpbmdzLmdldChmaWxlKTtcbiAgICAgICAgaWYgKGxpbmVzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBsaW5lcyA9IHdhcm5pbmcubm9kZS5zb3VyY2U/LmlucHV0LmNzcy5zcGxpdCgvXFxyP1xcbi8pO1xuICAgICAgICAgIGxpbmVNYXBwaW5ncy5zZXQoZmlsZSwgbGluZXMgPz8gbnVsbCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHRleHQ6IHdhcm5pbmcudGV4dCxcbiAgICAgICAgICBsb2NhdGlvbjoge1xuICAgICAgICAgICAgZmlsZSxcbiAgICAgICAgICAgIGxpbmU6IHdhcm5pbmcubGluZSxcbiAgICAgICAgICAgIGNvbHVtbjogd2FybmluZy5jb2x1bW4gLSAxLFxuICAgICAgICAgICAgbGluZVRleHQ6IGxpbmVzPy5bd2FybmluZy5saW5lIC0gMV0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBjb250ZW50czogcmVzdWx0LmNzcyxcbiAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICB3YXJuaW5ncyxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHBvc3Rjc3MgPz89IChhd2FpdCBpbXBvcnQoJ3Bvc3Rjc3MnKSkuZGVmYXVsdDtcbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBwb3N0Y3NzLkNzc1N5bnRheEVycm9yKSB7XG4gICAgICBjb25zdCBsaW5lcyA9IGVycm9yLnNvdXJjZT8uc3BsaXQoL1xccj9cXG4vKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdGV4dDogZXJyb3IucmVhc29uLFxuICAgICAgICAgICAgbG9jYXRpb246IHtcbiAgICAgICAgICAgICAgZmlsZTogZXJyb3IuZmlsZSxcbiAgICAgICAgICAgICAgbGluZTogZXJyb3IubGluZSxcbiAgICAgICAgICAgICAgY29sdW1uOiBlcnJvci5jb2x1bW4gJiYgZXJyb3IuY29sdW1uIC0gMSxcbiAgICAgICAgICAgICAgbGluZVRleHQ6IGVycm9yLmxpbmUgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IGxpbmVzPy5bZXJyb3IubGluZSAtIDFdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuIl19