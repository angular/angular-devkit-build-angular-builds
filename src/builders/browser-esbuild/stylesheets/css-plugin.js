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
exports.createCssPlugin = void 0;
const autoprefixer_1 = __importDefault(require("autoprefixer"));
const node_assert_1 = __importDefault(require("node:assert"));
const promises_1 = require("node:fs/promises");
const load_result_cache_1 = require("../load-result-cache");
/**
 * The lazy-loaded instance of the postcss stylesheet postprocessor.
 * It is only imported and initialized if postcss is needed.
 */
let postcss;
/**
 * Creates an esbuild plugin to process CSS stylesheets.
 * @param options An object containing the plugin options.
 * @returns An esbuild Plugin instance.
 */
function createCssPlugin(options, cache) {
    return {
        name: 'angular-css',
        async setup(build) {
            const autoprefixer = (0, autoprefixer_1.default)({
                overrideBrowserslist: options.browsers,
                ignoreUnknownVersions: true,
            });
            // Autoprefixer currently does not contain a method to check if autoprefixer is required
            // based on the provided list of browsers. However, it does contain a method that returns
            // informational text that can be used as a replacement. The text "Awesome!" will be present
            // when autoprefixer determines no actions are needed.
            // ref: https://github.com/postcss/autoprefixer/blob/e2f5c26ff1f3eaca95a21873723ce1cdf6e59f0e/lib/info.js#L118
            const autoprefixerInfo = autoprefixer.info({ from: build.initialOptions.absWorkingDir });
            const skipAutoprefixer = autoprefixerInfo.includes('Awesome!');
            if (skipAutoprefixer && !options.tailwindConfiguration) {
                return;
            }
            postcss ?? (postcss = (await Promise.resolve().then(() => __importStar(require('postcss')))).default);
            const postcssProcessor = postcss();
            if (options.tailwindConfiguration) {
                const tailwind = await Promise.resolve(`${options.tailwindConfiguration.package}`).then(s => __importStar(require(s)));
                postcssProcessor.use(tailwind.default({ config: options.tailwindConfiguration.file }));
            }
            if (!skipAutoprefixer) {
                postcssProcessor.use(autoprefixer);
            }
            // Add a load callback to support inline Component styles
            build.onLoad({ filter: /^css;/, namespace: 'angular:styles/component' }, (0, load_result_cache_1.createCachedLoad)(cache, async (args) => {
                const data = options.inlineComponentData?.[args.path];
                (0, node_assert_1.default)(typeof data === 'string', `component style name should always be found [${args.path}]`);
                const [, , filePath] = args.path.split(';', 3);
                return compileString(data, filePath, postcssProcessor, options);
            }));
            // Add a load callback to support files from disk
            build.onLoad({ filter: /\.css$/ }, (0, load_result_cache_1.createCachedLoad)(cache, async (args) => {
                const data = await (0, promises_1.readFile)(args.path, 'utf-8');
                return compileString(data, args.path, postcssProcessor, options);
            }));
        },
    };
}
exports.createCssPlugin = createCssPlugin;
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
            watchFiles: [filename],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3NzLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9zdHlsZXNoZWV0cy9jc3MtcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsZ0VBQW9EO0FBRXBELDhEQUFpQztBQUNqQywrQ0FBNEM7QUFDNUMsNERBQXlFO0FBRXpFOzs7R0FHRztBQUNILElBQUksT0FBd0QsQ0FBQztBQTBCN0Q7Ozs7R0FJRztBQUNILFNBQWdCLGVBQWUsQ0FBQyxPQUF5QixFQUFFLEtBQXVCO0lBQ2hGLE9BQU87UUFDTCxJQUFJLEVBQUUsYUFBYTtRQUNuQixLQUFLLENBQUMsS0FBSyxDQUFDLEtBQWtCO1lBQzVCLE1BQU0sWUFBWSxHQUFHLElBQUEsc0JBQXdCLEVBQUM7Z0JBQzVDLG9CQUFvQixFQUFFLE9BQU8sQ0FBQyxRQUFRO2dCQUN0QyxxQkFBcUIsRUFBRSxJQUFJO2FBQzVCLENBQUMsQ0FBQztZQUVILHdGQUF3RjtZQUN4Rix5RkFBeUY7WUFDekYsNEZBQTRGO1lBQzVGLHNEQUFzRDtZQUN0RCw4R0FBOEc7WUFDOUcsTUFBTSxnQkFBZ0IsR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxjQUFjLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQztZQUN6RixNQUFNLGdCQUFnQixHQUFHLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUUvRCxJQUFJLGdCQUFnQixJQUFJLENBQUMsT0FBTyxDQUFDLHFCQUFxQixFQUFFO2dCQUN0RCxPQUFPO2FBQ1I7WUFFRCxPQUFPLEtBQVAsT0FBTyxHQUFLLENBQUMsd0RBQWEsU0FBUyxH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O3dCQUNFLElBQUksRUFBRSxLQUFLLENBQUMsTUFBTTt3QkFDbEIsUUFBUSxFQUFFOzRCQUNSLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTs0QkFDaEIsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJOzRCQUNoQixNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUM7NEJBQ3hDLFFBQVEsRUFBRSxLQUFLLENBQUMsSUFBSSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQzt5QkFDekU7cUJBQ0Y7aUJBQ0Y7YUFDRixDQUFDO1NBQ0g7UUFFRCxNQUFNLEtBQUssQ0FBQztLQUNiO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgY3JlYXRlQXV0b1ByZWZpeGVyUGx1Z2luIGZyb20gJ2F1dG9wcmVmaXhlcic7XG5pbXBvcnQgdHlwZSB7IE9uTG9hZFJlc3VsdCwgUGx1Z2luLCBQbHVnaW5CdWlsZCB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgTG9hZFJlc3VsdENhY2hlLCBjcmVhdGVDYWNoZWRMb2FkIH0gZnJvbSAnLi4vbG9hZC1yZXN1bHQtY2FjaGUnO1xuXG4vKipcbiAqIFRoZSBsYXp5LWxvYWRlZCBpbnN0YW5jZSBvZiB0aGUgcG9zdGNzcyBzdHlsZXNoZWV0IHBvc3Rwcm9jZXNzb3IuXG4gKiBJdCBpcyBvbmx5IGltcG9ydGVkIGFuZCBpbml0aWFsaXplZCBpZiBwb3N0Y3NzIGlzIG5lZWRlZC5cbiAqL1xubGV0IHBvc3Rjc3M6IHR5cGVvZiBpbXBvcnQoJ3Bvc3Rjc3MnKVsnZGVmYXVsdCddIHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBwbHVnaW4gb3B0aW9ucyB0byB1c2Ugd2hlbiBwcm9jZXNzaW5nIENTUyBzdHlsZXNoZWV0cy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDc3NQbHVnaW5PcHRpb25zIHtcbiAgLyoqXG4gICAqIENvbnRyb2xzIHRoZSB1c2UgYW5kIGNyZWF0aW9uIG9mIHNvdXJjZW1hcHMgd2hlbiBwcm9jZXNzaW5nIHRoZSBzdHlsZXNoZWV0cy5cbiAgICogSWYgdHJ1ZSwgc291cmNlbWFwIHByb2Nlc3NpbmcgaXMgZW5hYmxlZDsgaWYgZmFsc2UsIGRpc2FibGVkLlxuICAgKi9cbiAgc291cmNlbWFwOiBib29sZWFuO1xuICAvKipcbiAgICogT3B0aW9uYWwgY29tcG9uZW50IGRhdGEgZm9yIGFueSBpbmxpbmUgc3R5bGVzIGZyb20gQ29tcG9uZW50IGRlY29yYXRvciBgc3R5bGVzYCBmaWVsZHMuXG4gICAqIFRoZSBrZXkgaXMgYW4gaW50ZXJuYWwgYW5ndWxhciByZXNvdXJjZSBVUkkgYW5kIHRoZSB2YWx1ZSBpcyB0aGUgc3R5bGVzaGVldCBjb250ZW50LlxuICAgKi9cbiAgaW5saW5lQ29tcG9uZW50RGF0YT86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIC8qKlxuICAgKiBUaGUgYnJvd3NlcnMgdG8gc3VwcG9ydCBpbiBicm93c2Vyc2xpc3QgZm9ybWF0IHdoZW4gcHJvY2Vzc2luZyBzdHlsZXNoZWV0cy5cbiAgICogU29tZSBwb3N0Y3NzIHBsdWdpbnMgc3VjaCBhcyBhdXRvcHJlZml4ZXIgcmVxdWlyZSB0aGUgcmF3IGJyb3dzZXJzbGlzdCBpbmZvcm1hdGlvbiBpbnN0ZWFkXG4gICAqIG9mIHRoZSBlc2J1aWxkIGZvcm1hdHRlZCB0YXJnZXQuXG4gICAqL1xuICBicm93c2Vyczogc3RyaW5nW107XG5cbiAgdGFpbHdpbmRDb25maWd1cmF0aW9uPzogeyBmaWxlOiBzdHJpbmc7IHBhY2thZ2U6IHN0cmluZyB9O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gZXNidWlsZCBwbHVnaW4gdG8gcHJvY2VzcyBDU1Mgc3R5bGVzaGVldHMuXG4gKiBAcGFyYW0gb3B0aW9ucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgcGx1Z2luIG9wdGlvbnMuXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIFBsdWdpbiBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNzc1BsdWdpbihvcHRpb25zOiBDc3NQbHVnaW5PcHRpb25zLCBjYWNoZT86IExvYWRSZXN1bHRDYWNoZSk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItY3NzJyxcbiAgICBhc3luYyBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgIGNvbnN0IGF1dG9wcmVmaXhlciA9IGNyZWF0ZUF1dG9QcmVmaXhlclBsdWdpbih7XG4gICAgICAgIG92ZXJyaWRlQnJvd3NlcnNsaXN0OiBvcHRpb25zLmJyb3dzZXJzLFxuICAgICAgICBpZ25vcmVVbmtub3duVmVyc2lvbnM6IHRydWUsXG4gICAgICB9KTtcblxuICAgICAgLy8gQXV0b3ByZWZpeGVyIGN1cnJlbnRseSBkb2VzIG5vdCBjb250YWluIGEgbWV0aG9kIHRvIGNoZWNrIGlmIGF1dG9wcmVmaXhlciBpcyByZXF1aXJlZFxuICAgICAgLy8gYmFzZWQgb24gdGhlIHByb3ZpZGVkIGxpc3Qgb2YgYnJvd3NlcnMuIEhvd2V2ZXIsIGl0IGRvZXMgY29udGFpbiBhIG1ldGhvZCB0aGF0IHJldHVybnNcbiAgICAgIC8vIGluZm9ybWF0aW9uYWwgdGV4dCB0aGF0IGNhbiBiZSB1c2VkIGFzIGEgcmVwbGFjZW1lbnQuIFRoZSB0ZXh0IFwiQXdlc29tZSFcIiB3aWxsIGJlIHByZXNlbnRcbiAgICAgIC8vIHdoZW4gYXV0b3ByZWZpeGVyIGRldGVybWluZXMgbm8gYWN0aW9ucyBhcmUgbmVlZGVkLlxuICAgICAgLy8gcmVmOiBodHRwczovL2dpdGh1Yi5jb20vcG9zdGNzcy9hdXRvcHJlZml4ZXIvYmxvYi9lMmY1YzI2ZmYxZjNlYWNhOTVhMjE4NzM3MjNjZTFjZGY2ZTU5ZjBlL2xpYi9pbmZvLmpzI0wxMThcbiAgICAgIGNvbnN0IGF1dG9wcmVmaXhlckluZm8gPSBhdXRvcHJlZml4ZXIuaW5mbyh7IGZyb206IGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIgfSk7XG4gICAgICBjb25zdCBza2lwQXV0b3ByZWZpeGVyID0gYXV0b3ByZWZpeGVySW5mby5pbmNsdWRlcygnQXdlc29tZSEnKTtcblxuICAgICAgaWYgKHNraXBBdXRvcHJlZml4ZXIgJiYgIW9wdGlvbnMudGFpbHdpbmRDb25maWd1cmF0aW9uKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgcG9zdGNzcyA/Pz0gKGF3YWl0IGltcG9ydCgncG9zdGNzcycpKS5kZWZhdWx0O1xuICAgICAgY29uc3QgcG9zdGNzc1Byb2Nlc3NvciA9IHBvc3Rjc3MoKTtcbiAgICAgIGlmIChvcHRpb25zLnRhaWx3aW5kQ29uZmlndXJhdGlvbikge1xuICAgICAgICBjb25zdCB0YWlsd2luZCA9IGF3YWl0IGltcG9ydChvcHRpb25zLnRhaWx3aW5kQ29uZmlndXJhdGlvbi5wYWNrYWdlKTtcbiAgICAgICAgcG9zdGNzc1Byb2Nlc3Nvci51c2UodGFpbHdpbmQuZGVmYXVsdCh7IGNvbmZpZzogb3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24uZmlsZSB9KSk7XG4gICAgICB9XG4gICAgICBpZiAoIXNraXBBdXRvcHJlZml4ZXIpIHtcbiAgICAgICAgcG9zdGNzc1Byb2Nlc3Nvci51c2UoYXV0b3ByZWZpeGVyKTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIGEgbG9hZCBjYWxsYmFjayB0byBzdXBwb3J0IGlubGluZSBDb21wb25lbnQgc3R5bGVzXG4gICAgICBidWlsZC5vbkxvYWQoXG4gICAgICAgIHsgZmlsdGVyOiAvXmNzczsvLCBuYW1lc3BhY2U6ICdhbmd1bGFyOnN0eWxlcy9jb21wb25lbnQnIH0sXG4gICAgICAgIGNyZWF0ZUNhY2hlZExvYWQoY2FjaGUsIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgICAgY29uc3QgZGF0YSA9IG9wdGlvbnMuaW5saW5lQ29tcG9uZW50RGF0YT8uW2FyZ3MucGF0aF07XG4gICAgICAgICAgYXNzZXJ0KFxuICAgICAgICAgICAgdHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnLFxuICAgICAgICAgICAgYGNvbXBvbmVudCBzdHlsZSBuYW1lIHNob3VsZCBhbHdheXMgYmUgZm91bmQgWyR7YXJncy5wYXRofV1gLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICBjb25zdCBbLCAsIGZpbGVQYXRoXSA9IGFyZ3MucGF0aC5zcGxpdCgnOycsIDMpO1xuXG4gICAgICAgICAgcmV0dXJuIGNvbXBpbGVTdHJpbmcoZGF0YSwgZmlsZVBhdGgsIHBvc3Rjc3NQcm9jZXNzb3IsIG9wdGlvbnMpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICAgIC8vIEFkZCBhIGxvYWQgY2FsbGJhY2sgdG8gc3VwcG9ydCBmaWxlcyBmcm9tIGRpc2tcbiAgICAgIGJ1aWxkLm9uTG9hZChcbiAgICAgICAgeyBmaWx0ZXI6IC9cXC5jc3MkLyB9LFxuICAgICAgICBjcmVhdGVDYWNoZWRMb2FkKGNhY2hlLCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZWFkRmlsZShhcmdzLnBhdGgsICd1dGYtOCcpO1xuXG4gICAgICAgICAgcmV0dXJuIGNvbXBpbGVTdHJpbmcoZGF0YSwgYXJncy5wYXRoLCBwb3N0Y3NzUHJvY2Vzc29yLCBvcHRpb25zKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH0sXG4gIH07XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIHByb3ZpZGVkIENTUyBzdHlsZXNoZWV0IGRhdGEgdXNpbmcgYSBwcm92aWRlZCBwb3N0Y3NzIHByb2Nlc3NvciBhbmQgcHJvdmlkZXMgYW5cbiAqIGVzYnVpbGQgbG9hZCByZXN1bHQgdGhhdCBjYW4gYmUgdXNlZCBkaXJlY3RseSBieSBhbiBlc2J1aWxkIFBsdWdpbi5cbiAqIEBwYXJhbSBkYXRhIFRoZSBzdHlsZXNoZWV0IGNvbnRlbnQgdG8gcHJvY2Vzcy5cbiAqIEBwYXJhbSBmaWxlbmFtZSBUaGUgbmFtZSBvZiB0aGUgZmlsZSB0aGF0IGNvbnRhaW5zIHRoZSBkYXRhLlxuICogQHBhcmFtIHBvc3Rjc3NQcm9jZXNzb3IgQSBwb3N0Y3NzIHByb2Nlc3NvciBpbnN0YW5jZSB0byB1c2UuXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgcGx1Z2luIG9wdGlvbnMgdG8gY29udHJvbCB0aGUgcHJvY2Vzc2luZy5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgT25Mb2FkZXJSZXN1bHQgb2JqZWN0IHdpdGggdGhlIHByb2Nlc3NlZCBjb250ZW50LCB3YXJuaW5ncywgYW5kL29yIGVycm9ycy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gY29tcGlsZVN0cmluZyhcbiAgZGF0YTogc3RyaW5nLFxuICBmaWxlbmFtZTogc3RyaW5nLFxuICBwb3N0Y3NzUHJvY2Vzc29yOiBpbXBvcnQoJ3Bvc3Rjc3MnKS5Qcm9jZXNzb3IsXG4gIG9wdGlvbnM6IENzc1BsdWdpbk9wdGlvbnMsXG4pOiBQcm9taXNlPE9uTG9hZFJlc3VsdD4ge1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBvc3Rjc3NQcm9jZXNzb3IucHJvY2VzcyhkYXRhLCB7XG4gICAgICBmcm9tOiBmaWxlbmFtZSxcbiAgICAgIHRvOiBmaWxlbmFtZSxcbiAgICAgIG1hcDogb3B0aW9ucy5zb3VyY2VtYXAgJiYge1xuICAgICAgICBpbmxpbmU6IHRydWUsXG4gICAgICAgIHNvdXJjZXNDb250ZW50OiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJhd1dhcm5pbmdzID0gcmVzdWx0Lndhcm5pbmdzKCk7XG4gICAgbGV0IHdhcm5pbmdzO1xuICAgIGlmIChyYXdXYXJuaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBsaW5lTWFwcGluZ3MgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nW10gfCBudWxsPigpO1xuICAgICAgd2FybmluZ3MgPSByYXdXYXJuaW5ncy5tYXAoKHdhcm5pbmcpID0+IHtcbiAgICAgICAgY29uc3QgZmlsZSA9IHdhcm5pbmcubm9kZS5zb3VyY2U/LmlucHV0LmZpbGU7XG4gICAgICAgIGlmIChmaWxlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZXR1cm4geyB0ZXh0OiB3YXJuaW5nLnRleHQgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBsaW5lcyA9IGxpbmVNYXBwaW5ncy5nZXQoZmlsZSk7XG4gICAgICAgIGlmIChsaW5lcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgbGluZXMgPSB3YXJuaW5nLm5vZGUuc291cmNlPy5pbnB1dC5jc3Muc3BsaXQoL1xccj9cXG4vKTtcbiAgICAgICAgICBsaW5lTWFwcGluZ3Muc2V0KGZpbGUsIGxpbmVzID8/IG51bGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0ZXh0OiB3YXJuaW5nLnRleHQsXG4gICAgICAgICAgbG9jYXRpb246IHtcbiAgICAgICAgICAgIGZpbGUsXG4gICAgICAgICAgICBsaW5lOiB3YXJuaW5nLmxpbmUsXG4gICAgICAgICAgICBjb2x1bW46IHdhcm5pbmcuY29sdW1uIC0gMSxcbiAgICAgICAgICAgIGxpbmVUZXh0OiBsaW5lcz8uW3dhcm5pbmcubGluZSAtIDFdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29udGVudHM6IHJlc3VsdC5jc3MsXG4gICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgd2FybmluZ3MsXG4gICAgICB3YXRjaEZpbGVzOiBbZmlsZW5hbWVdLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcG9zdGNzcyA/Pz0gKGF3YWl0IGltcG9ydCgncG9zdGNzcycpKS5kZWZhdWx0O1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIHBvc3Rjc3MuQ3NzU3ludGF4RXJyb3IpIHtcbiAgICAgIGNvbnN0IGxpbmVzID0gZXJyb3Iuc291cmNlPy5zcGxpdCgvXFxyP1xcbi8pO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0ZXh0OiBlcnJvci5yZWFzb24sXG4gICAgICAgICAgICBsb2NhdGlvbjoge1xuICAgICAgICAgICAgICBmaWxlOiBlcnJvci5maWxlLFxuICAgICAgICAgICAgICBsaW5lOiBlcnJvci5saW5lLFxuICAgICAgICAgICAgICBjb2x1bW46IGVycm9yLmNvbHVtbiAmJiBlcnJvci5jb2x1bW4gLSAxLFxuICAgICAgICAgICAgICBsaW5lVGV4dDogZXJyb3IubGluZSA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogbGluZXM/LltlcnJvci5saW5lIC0gMV0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9O1xuICAgIH1cblxuICAgIHRocm93IGVycm9yO1xuICB9XG59XG4iXX0=