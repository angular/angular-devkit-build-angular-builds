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
function createCssPlugin(options) {
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
                postcssProcessor.use(tailwind({ config: options.tailwindConfiguration.file }));
            }
            if (!skipAutoprefixer) {
                postcssProcessor.use(autoprefixer);
            }
            // Add a load callback to support inline Component styles
            build.onLoad({ filter: /^css;/, namespace: 'angular:styles/component' }, async (args) => {
                const data = options.inlineComponentData?.[args.path];
                (0, node_assert_1.default)(data, `component style name should always be found [${args.path}]`);
                const [, , filePath] = args.path.split(';', 3);
                return compileString(data, filePath, postcssProcessor, options);
            });
            // Add a load callback to support files from disk
            build.onLoad({ filter: /\.css$/ }, async (args) => {
                const data = await (0, promises_1.readFile)(args.path, 'utf-8');
                return compileString(data, args.path, postcssProcessor, options);
            });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3NzLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9jc3MtcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsZ0VBQW9EO0FBRXBELDhEQUFpQztBQUNqQywrQ0FBNEM7QUFFNUM7OztHQUdHO0FBQ0gsSUFBSSxPQUF3RCxDQUFDO0FBMEI3RDs7OztHQUlHO0FBQ0gsU0FBZ0IsZUFBZSxDQUFDLE9BQXlCO0lBQ3ZELE9BQU87UUFDTCxJQUFJLEVBQUUsYUFBYTtRQUNuQixLQUFLLENBQUMsS0FBSyxDQUFDLEtBQWtCO1lBQzVCLE1BQU0sWUFBWSxHQUFHLElBQUEsc0JBQXdCLEVBQUM7Z0JBQzVDLG9CQUFvQixFQUFFLE9BQU8sQ0FBQyxRQUFRO2dCQUN0QyxxQkFBcUIsRUFBRSxJQUFJO2FBQzVCLENBQUMsQ0FBQztZQUVILHdGQUF3RjtZQUN4Rix5RkFBeUY7WUFDekYsNEZBQTRGO1lBQzVGLHNEQUFzRDtZQUN0RCw4R0FBOEc7WUFDOUcsTUFBTSxnQkFBZ0IsR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxjQUFjLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQztZQUN6RixNQUFNLGdCQUFnQixHQUFHLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUUvRCxJQUFJLGdCQUFnQixJQUFJLENBQUMsT0FBTyxDQUFDLHFCQUFxQixFQUFFO2dCQUN0RCxPQUFPO2FBQ1I7WUFFRCxPQUFPLEtBQVAsT0FBTyxHQUFLLENBQUMsd0RBQWEsU0FBUyxHQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUM7WUFDOUMsTUFBTSxnQkFB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TSxHQUFHLENBQUM7NEJBQ3hDLFFBQVEsRUFBRSxLQUFLLENBQUMsSUFBSSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQzt5QkFDekU7cUJBQ0Y7aUJBQ0Y7YUFDRixDQUFDO1NBQ0g7UUFFRCxNQUFNLEtBQUssQ0FBQztLQUNiO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgY3JlYXRlQXV0b1ByZWZpeGVyUGx1Z2luIGZyb20gJ2F1dG9wcmVmaXhlcic7XG5pbXBvcnQgdHlwZSB7IE9uTG9hZFJlc3VsdCwgUGx1Z2luLCBQbHVnaW5CdWlsZCB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuXG4vKipcbiAqIFRoZSBsYXp5LWxvYWRlZCBpbnN0YW5jZSBvZiB0aGUgcG9zdGNzcyBzdHlsZXNoZWV0IHBvc3Rwcm9jZXNzb3IuXG4gKiBJdCBpcyBvbmx5IGltcG9ydGVkIGFuZCBpbml0aWFsaXplZCBpZiBwb3N0Y3NzIGlzIG5lZWRlZC5cbiAqL1xubGV0IHBvc3Rjc3M6IHR5cGVvZiBpbXBvcnQoJ3Bvc3Rjc3MnKVsnZGVmYXVsdCddIHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBwbHVnaW4gb3B0aW9ucyB0byB1c2Ugd2hlbiBwcm9jZXNzaW5nIENTUyBzdHlsZXNoZWV0cy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDc3NQbHVnaW5PcHRpb25zIHtcbiAgLyoqXG4gICAqIENvbnRyb2xzIHRoZSB1c2UgYW5kIGNyZWF0aW9uIG9mIHNvdXJjZW1hcHMgd2hlbiBwcm9jZXNzaW5nIHRoZSBzdHlsZXNoZWV0cy5cbiAgICogSWYgdHJ1ZSwgc291cmNlbWFwIHByb2Nlc3NpbmcgaXMgZW5hYmxlZDsgaWYgZmFsc2UsIGRpc2FibGVkLlxuICAgKi9cbiAgc291cmNlbWFwOiBib29sZWFuO1xuICAvKipcbiAgICogT3B0aW9uYWwgY29tcG9uZW50IGRhdGEgZm9yIGFueSBpbmxpbmUgc3R5bGVzIGZyb20gQ29tcG9uZW50IGRlY29yYXRvciBgc3R5bGVzYCBmaWVsZHMuXG4gICAqIFRoZSBrZXkgaXMgYW4gaW50ZXJuYWwgYW5ndWxhciByZXNvdXJjZSBVUkkgYW5kIHRoZSB2YWx1ZSBpcyB0aGUgc3R5bGVzaGVldCBjb250ZW50LlxuICAgKi9cbiAgaW5saW5lQ29tcG9uZW50RGF0YT86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIC8qKlxuICAgKiBUaGUgYnJvd3NlcnMgdG8gc3VwcG9ydCBpbiBicm93c2Vyc2xpc3QgZm9ybWF0IHdoZW4gcHJvY2Vzc2luZyBzdHlsZXNoZWV0cy5cbiAgICogU29tZSBwb3N0Y3NzIHBsdWdpbnMgc3VjaCBhcyBhdXRvcHJlZml4ZXIgcmVxdWlyZSB0aGUgcmF3IGJyb3dzZXJzbGlzdCBpbmZvcm1hdGlvbiBpbnN0ZWFkXG4gICAqIG9mIHRoZSBlc2J1aWxkIGZvcm1hdHRlZCB0YXJnZXQuXG4gICAqL1xuICBicm93c2Vyczogc3RyaW5nW107XG5cbiAgdGFpbHdpbmRDb25maWd1cmF0aW9uPzogeyBmaWxlOiBzdHJpbmc7IHBhY2thZ2U6IHN0cmluZyB9O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gZXNidWlsZCBwbHVnaW4gdG8gcHJvY2VzcyBDU1Mgc3R5bGVzaGVldHMuXG4gKiBAcGFyYW0gb3B0aW9ucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgcGx1Z2luIG9wdGlvbnMuXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIFBsdWdpbiBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNzc1BsdWdpbihvcHRpb25zOiBDc3NQbHVnaW5PcHRpb25zKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1jc3MnLFxuICAgIGFzeW5jIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgY29uc3QgYXV0b3ByZWZpeGVyID0gY3JlYXRlQXV0b1ByZWZpeGVyUGx1Z2luKHtcbiAgICAgICAgb3ZlcnJpZGVCcm93c2Vyc2xpc3Q6IG9wdGlvbnMuYnJvd3NlcnMsXG4gICAgICAgIGlnbm9yZVVua25vd25WZXJzaW9uczogdHJ1ZSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBBdXRvcHJlZml4ZXIgY3VycmVudGx5IGRvZXMgbm90IGNvbnRhaW4gYSBtZXRob2QgdG8gY2hlY2sgaWYgYXV0b3ByZWZpeGVyIGlzIHJlcXVpcmVkXG4gICAgICAvLyBiYXNlZCBvbiB0aGUgcHJvdmlkZWQgbGlzdCBvZiBicm93c2Vycy4gSG93ZXZlciwgaXQgZG9lcyBjb250YWluIGEgbWV0aG9kIHRoYXQgcmV0dXJuc1xuICAgICAgLy8gaW5mb3JtYXRpb25hbCB0ZXh0IHRoYXQgY2FuIGJlIHVzZWQgYXMgYSByZXBsYWNlbWVudC4gVGhlIHRleHQgXCJBd2Vzb21lIVwiIHdpbGwgYmUgcHJlc2VudFxuICAgICAgLy8gd2hlbiBhdXRvcHJlZml4ZXIgZGV0ZXJtaW5lcyBubyBhY3Rpb25zIGFyZSBuZWVkZWQuXG4gICAgICAvLyByZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS9wb3N0Y3NzL2F1dG9wcmVmaXhlci9ibG9iL2UyZjVjMjZmZjFmM2VhY2E5NWEyMTg3MzcyM2NlMWNkZjZlNTlmMGUvbGliL2luZm8uanMjTDExOFxuICAgICAgY29uc3QgYXV0b3ByZWZpeGVySW5mbyA9IGF1dG9wcmVmaXhlci5pbmZvKHsgZnJvbTogYnVpbGQuaW5pdGlhbE9wdGlvbnMuYWJzV29ya2luZ0RpciB9KTtcbiAgICAgIGNvbnN0IHNraXBBdXRvcHJlZml4ZXIgPSBhdXRvcHJlZml4ZXJJbmZvLmluY2x1ZGVzKCdBd2Vzb21lIScpO1xuXG4gICAgICBpZiAoc2tpcEF1dG9wcmVmaXhlciAmJiAhb3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBwb3N0Y3NzID8/PSAoYXdhaXQgaW1wb3J0KCdwb3N0Y3NzJykpLmRlZmF1bHQ7XG4gICAgICBjb25zdCBwb3N0Y3NzUHJvY2Vzc29yID0gcG9zdGNzcygpO1xuICAgICAgaWYgKG9wdGlvbnMudGFpbHdpbmRDb25maWd1cmF0aW9uKSB7XG4gICAgICAgIGNvbnN0IHRhaWx3aW5kID0gYXdhaXQgaW1wb3J0KG9wdGlvbnMudGFpbHdpbmRDb25maWd1cmF0aW9uLnBhY2thZ2UpO1xuICAgICAgICBwb3N0Y3NzUHJvY2Vzc29yLnVzZSh0YWlsd2luZCh7IGNvbmZpZzogb3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24uZmlsZSB9KSk7XG4gICAgICB9XG4gICAgICBpZiAoIXNraXBBdXRvcHJlZml4ZXIpIHtcbiAgICAgICAgcG9zdGNzc1Byb2Nlc3Nvci51c2UoYXV0b3ByZWZpeGVyKTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIGEgbG9hZCBjYWxsYmFjayB0byBzdXBwb3J0IGlubGluZSBDb21wb25lbnQgc3R5bGVzXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9eY3NzOy8sIG5hbWVzcGFjZTogJ2FuZ3VsYXI6c3R5bGVzL2NvbXBvbmVudCcgfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgZGF0YSA9IG9wdGlvbnMuaW5saW5lQ29tcG9uZW50RGF0YT8uW2FyZ3MucGF0aF07XG4gICAgICAgIGFzc2VydChkYXRhLCBgY29tcG9uZW50IHN0eWxlIG5hbWUgc2hvdWxkIGFsd2F5cyBiZSBmb3VuZCBbJHthcmdzLnBhdGh9XWApO1xuXG4gICAgICAgIGNvbnN0IFssICwgZmlsZVBhdGhdID0gYXJncy5wYXRoLnNwbGl0KCc7JywgMyk7XG5cbiAgICAgICAgcmV0dXJuIGNvbXBpbGVTdHJpbmcoZGF0YSwgZmlsZVBhdGgsIHBvc3Rjc3NQcm9jZXNzb3IsIG9wdGlvbnMpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEFkZCBhIGxvYWQgY2FsbGJhY2sgdG8gc3VwcG9ydCBmaWxlcyBmcm9tIGRpc2tcbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLmNzcyQvIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZWFkRmlsZShhcmdzLnBhdGgsICd1dGYtOCcpO1xuXG4gICAgICAgIHJldHVybiBjb21waWxlU3RyaW5nKGRhdGEsIGFyZ3MucGF0aCwgcG9zdGNzc1Byb2Nlc3Nvciwgb3B0aW9ucyk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBwcm92aWRlZCBDU1Mgc3R5bGVzaGVldCBkYXRhIHVzaW5nIGEgcHJvdmlkZWQgcG9zdGNzcyBwcm9jZXNzb3IgYW5kIHByb3ZpZGVzIGFuXG4gKiBlc2J1aWxkIGxvYWQgcmVzdWx0IHRoYXQgY2FuIGJlIHVzZWQgZGlyZWN0bHkgYnkgYW4gZXNidWlsZCBQbHVnaW4uXG4gKiBAcGFyYW0gZGF0YSBUaGUgc3R5bGVzaGVldCBjb250ZW50IHRvIHByb2Nlc3MuXG4gKiBAcGFyYW0gZmlsZW5hbWUgVGhlIG5hbWUgb2YgdGhlIGZpbGUgdGhhdCBjb250YWlucyB0aGUgZGF0YS5cbiAqIEBwYXJhbSBwb3N0Y3NzUHJvY2Vzc29yIEEgcG9zdGNzcyBwcm9jZXNzb3IgaW5zdGFuY2UgdG8gdXNlLlxuICogQHBhcmFtIG9wdGlvbnMgVGhlIHBsdWdpbiBvcHRpb25zIHRvIGNvbnRyb2wgdGhlIHByb2Nlc3NpbmcuXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIE9uTG9hZGVyUmVzdWx0IG9iamVjdCB3aXRoIHRoZSBwcm9jZXNzZWQgY29udGVudCwgd2FybmluZ3MsIGFuZC9vciBlcnJvcnMuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGNvbXBpbGVTdHJpbmcoXG4gIGRhdGE6IHN0cmluZyxcbiAgZmlsZW5hbWU6IHN0cmluZyxcbiAgcG9zdGNzc1Byb2Nlc3NvcjogaW1wb3J0KCdwb3N0Y3NzJykuUHJvY2Vzc29yLFxuICBvcHRpb25zOiBDc3NQbHVnaW5PcHRpb25zLFxuKTogUHJvbWlzZTxPbkxvYWRSZXN1bHQ+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwb3N0Y3NzUHJvY2Vzc29yLnByb2Nlc3MoZGF0YSwge1xuICAgICAgZnJvbTogZmlsZW5hbWUsXG4gICAgICB0bzogZmlsZW5hbWUsXG4gICAgICBtYXA6IG9wdGlvbnMuc291cmNlbWFwICYmIHtcbiAgICAgICAgaW5saW5lOiB0cnVlLFxuICAgICAgICBzb3VyY2VzQ29udGVudDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCByYXdXYXJuaW5ncyA9IHJlc3VsdC53YXJuaW5ncygpO1xuICAgIGxldCB3YXJuaW5ncztcbiAgICBpZiAocmF3V2FybmluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgbGluZU1hcHBpbmdzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZ1tdIHwgbnVsbD4oKTtcbiAgICAgIHdhcm5pbmdzID0gcmF3V2FybmluZ3MubWFwKCh3YXJuaW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSB3YXJuaW5nLm5vZGUuc291cmNlPy5pbnB1dC5maWxlO1xuICAgICAgICBpZiAoZmlsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcmV0dXJuIHsgdGV4dDogd2FybmluZy50ZXh0IH07XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgbGluZXMgPSBsaW5lTWFwcGluZ3MuZ2V0KGZpbGUpO1xuICAgICAgICBpZiAobGluZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGxpbmVzID0gd2FybmluZy5ub2RlLnNvdXJjZT8uaW5wdXQuY3NzLnNwbGl0KC9cXHI/XFxuLyk7XG4gICAgICAgICAgbGluZU1hcHBpbmdzLnNldChmaWxlLCBsaW5lcyA/PyBudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdGV4dDogd2FybmluZy50ZXh0LFxuICAgICAgICAgIGxvY2F0aW9uOiB7XG4gICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgbGluZTogd2FybmluZy5saW5lLFxuICAgICAgICAgICAgY29sdW1uOiB3YXJuaW5nLmNvbHVtbiAtIDEsXG4gICAgICAgICAgICBsaW5lVGV4dDogbGluZXM/Llt3YXJuaW5nLmxpbmUgLSAxXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRlbnRzOiByZXN1bHQuY3NzLFxuICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgIHdhcm5pbmdzLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcG9zdGNzcyA/Pz0gKGF3YWl0IGltcG9ydCgncG9zdGNzcycpKS5kZWZhdWx0O1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIHBvc3Rjc3MuQ3NzU3ludGF4RXJyb3IpIHtcbiAgICAgIGNvbnN0IGxpbmVzID0gZXJyb3Iuc291cmNlPy5zcGxpdCgvXFxyP1xcbi8pO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0ZXh0OiBlcnJvci5yZWFzb24sXG4gICAgICAgICAgICBsb2NhdGlvbjoge1xuICAgICAgICAgICAgICBmaWxlOiBlcnJvci5maWxlLFxuICAgICAgICAgICAgICBsaW5lOiBlcnJvci5saW5lLFxuICAgICAgICAgICAgICBjb2x1bW46IGVycm9yLmNvbHVtbiAmJiBlcnJvci5jb2x1bW4gLSAxLFxuICAgICAgICAgICAgICBsaW5lVGV4dDogZXJyb3IubGluZSA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogbGluZXM/LltlcnJvci5saW5lIC0gMV0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9O1xuICAgIH1cblxuICAgIHRocm93IGVycm9yO1xuICB9XG59XG4iXX0=