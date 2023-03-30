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
                postcssProcessor.use(tailwind.default({ config: options.tailwindConfiguration.file }));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3NzLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9jc3MtcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsZ0VBQW9EO0FBRXBELDhEQUFpQztBQUNqQywrQ0FBNEM7QUFFNUM7OztHQUdHO0FBQ0gsSUFBSSxPQUF3RCxDQUFDO0FBMEI3RDs7OztHQUlHO0FBQ0gsU0FBZ0IsZUFBZSxDQUFDLE9BQXlCO0lBQ3ZELE9BQU87UUFDTCxJQUFJLEVBQUUsYUFBYTtRQUNuQixLQUFLLENBQUMsS0FBSyxDQUFDLEtBQWtCO1lBQzVCLE1BQU0sWUFBWSxHQUFHLElBQUEsc0JBQXdCLEVBQUM7Z0JBQzVDLG9CQUFvQixFQUFFLE9BQU8sQ0FBQyxRQUFRO2dCQUN0QyxxQkFBcUIsRUFBRSxJQUFJO2FBQzVCLENBQUMsQ0FBQztZQUVILHdGQUF3RjtZQUN4Rix5RkFBeUY7WUFDekYsNEZBQTRGO1lBQzVGLHNEQUFzRDtZQUN0RCw4R0FBOEc7WUFDOUcsTUFBTSxnQkFBZ0IsR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxjQUFjLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQztZQUN6RixNQUFNLGdCQUFnQixHQUFHLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUUvRCxJQUFJLGdCQUFnQixJQUFJLENBQUMsT0FBTyxDQUFDLHFCQUFxQixFQUFFO2dCQUN0RCxPQUFPO2FBQ1I7WUFFRCxPQUFPLEtBQVAsT0FBTyxHQUFLLENBQUMsd0RBQWEsU0FBUyxHQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUM7WUFDOUMsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLEVBQUUsQ0FBQztZQUNuQyxJQUFJLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRTtnQkFDakMsTUFBTSxRQUFRLEdBQUcseUJBQWEsT0FBTyxDQUFDLHFCQUFxQixDQUFDLE9BQU8sdUNBQUMsQ0FBQztnQkFDckUsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQzthQUN4RjtZQUNELElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtnQkFDckIsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO2FBQ3BDO1lBRUQseURBQXlEO1lBQ3pELEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSwwQkFBMEIsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtnQkFDdEYsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN0RCxJQUFBLHFCQUFNLEVBQUMsSUFBSSxFQUFFLGdEQUFnRCxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztnQkFFM0UsTUFBTSxDQUFDLEVBQUUsQUFBRCxFQUFHLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFFL0MsT0FBTyxhQUFhLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxnQkFBZ0IsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUNsRSxDQUFDLENBQUMsQ0FBQztZQUVILGlEQUFpRDtZQUNqRCxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtnQkFDaEQsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFBLG1CQUFRLEVBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFFaEQsT0FBTyxhQUFhLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDbkUsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFqREQsMENBaURDO0FBRUQ7Ozs7Ozs7O0dBUUc7QUFDSCxLQUFLLFVBQVUsYUFBYSxDQUMxQixJQUFZLEVBQ1osUUFBZ0IsRUFDaEIsZ0JBQTZDLEVBQzdDLE9BQXlCO0lBRXpCLElBQUk7UUFDRixNQUFNLE1BQU0sR0FBRyxNQUFNLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7WUFDbEQsSUFBSSxFQUFFLFFBQVE7WUFDZCxFQUFFLEVBQUUsUUFBUTtZQUNaLEdBQUcsRUFBRSxPQUFPLENBQUMsU0FBUyxJQUFJO2dCQUN4QixNQUFNLEVBQUUsSUFBSTtnQkFDWixjQUFjLEVBQUUsSUFBSTthQUNyQjtTQUNGLENBQUMsQ0FBQztRQUVILE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUN0QyxJQUFJLFFBQVEsQ0FBQztRQUNiLElBQUksV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDMUIsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQTJCLENBQUM7WUFDeEQsUUFBUSxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTtnQkFDckMsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQztnQkFDN0MsSUFBSSxJQUFJLEtBQUssU0FBUyxFQUFFO29CQUN0QixPQUFPLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQztpQkFDL0I7Z0JBRUQsSUFBSSxLQUFLLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbkMsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO29CQUN2QixLQUFLLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQ3RELFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQztpQkFDdkM7Z0JBRUQsT0FBTztvQkFDTCxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7b0JBQ2xCLFFBQVEsRUFBRTt3QkFDUixJQUFJO3dCQUNKLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTt3QkFDbEIsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQzt3QkFDMUIsUUFBUSxFQUFFLEtBQUssRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO3FCQUNwQztpQkFDRixDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7U0FDSjtRQUVELE9BQU87WUFDTCxRQUFRLEVBQUUsTUFBTSxDQUFDLEdBQUc7WUFDcEIsTUFBTSxFQUFFLEtBQUs7WUFDYixRQUFRO1NBQ1QsQ0FBQztLQUNIO0lBQUMsT0FBTyxLQUFLLEVBQUU7UUFDZCxPQUFPLEtBQVAsT0FBTyxHQUFLLENBQUMsd0RBQWEsU0FBUyxHQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUM7UUFDOUMsSUFBSSxLQUFLLFlBQVksT0FBTyxDQUFDLGNBQWMsRUFBRTtZQUMzQyxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUUzQyxPQUFPO2dCQUNMLE1BQU0sRUFBRTtvQkFDTjt3QkFDRSxJQUFJLEVBQUUsS0FBSyxDQUFDLE1BQU07d0JBQ2xCLFFBQVEsRUFBRTs0QkFDUixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7NEJBQ2hCLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTs0QkFDaEIsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDOzRCQUN4QyxRQUFRLEVBQUUsS0FBSyxDQUFDLElBQUksS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7eUJBQ3pFO3FCQUNGO2lCQUNGO2FBQ0YsQ0FBQztTQUNIO1FBRUQsTUFBTSxLQUFLLENBQUM7S0FDYjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IGNyZWF0ZUF1dG9QcmVmaXhlclBsdWdpbiBmcm9tICdhdXRvcHJlZml4ZXInO1xuaW1wb3J0IHR5cGUgeyBPbkxvYWRSZXN1bHQsIFBsdWdpbiwgUGx1Z2luQnVpbGQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcblxuLyoqXG4gKiBUaGUgbGF6eS1sb2FkZWQgaW5zdGFuY2Ugb2YgdGhlIHBvc3Rjc3Mgc3R5bGVzaGVldCBwb3N0cHJvY2Vzc29yLlxuICogSXQgaXMgb25seSBpbXBvcnRlZCBhbmQgaW5pdGlhbGl6ZWQgaWYgcG9zdGNzcyBpcyBuZWVkZWQuXG4gKi9cbmxldCBwb3N0Y3NzOiB0eXBlb2YgaW1wb3J0KCdwb3N0Y3NzJylbJ2RlZmF1bHQnXSB8IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgcGx1Z2luIG9wdGlvbnMgdG8gdXNlIHdoZW4gcHJvY2Vzc2luZyBDU1Mgc3R5bGVzaGVldHMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ3NzUGx1Z2luT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBDb250cm9scyB0aGUgdXNlIGFuZCBjcmVhdGlvbiBvZiBzb3VyY2VtYXBzIHdoZW4gcHJvY2Vzc2luZyB0aGUgc3R5bGVzaGVldHMuXG4gICAqIElmIHRydWUsIHNvdXJjZW1hcCBwcm9jZXNzaW5nIGlzIGVuYWJsZWQ7IGlmIGZhbHNlLCBkaXNhYmxlZC5cbiAgICovXG4gIHNvdXJjZW1hcDogYm9vbGVhbjtcbiAgLyoqXG4gICAqIE9wdGlvbmFsIGNvbXBvbmVudCBkYXRhIGZvciBhbnkgaW5saW5lIHN0eWxlcyBmcm9tIENvbXBvbmVudCBkZWNvcmF0b3IgYHN0eWxlc2AgZmllbGRzLlxuICAgKiBUaGUga2V5IGlzIGFuIGludGVybmFsIGFuZ3VsYXIgcmVzb3VyY2UgVVJJIGFuZCB0aGUgdmFsdWUgaXMgdGhlIHN0eWxlc2hlZXQgY29udGVudC5cbiAgICovXG4gIGlubGluZUNvbXBvbmVudERhdGE/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICAvKipcbiAgICogVGhlIGJyb3dzZXJzIHRvIHN1cHBvcnQgaW4gYnJvd3NlcnNsaXN0IGZvcm1hdCB3aGVuIHByb2Nlc3Npbmcgc3R5bGVzaGVldHMuXG4gICAqIFNvbWUgcG9zdGNzcyBwbHVnaW5zIHN1Y2ggYXMgYXV0b3ByZWZpeGVyIHJlcXVpcmUgdGhlIHJhdyBicm93c2Vyc2xpc3QgaW5mb3JtYXRpb24gaW5zdGVhZFxuICAgKiBvZiB0aGUgZXNidWlsZCBmb3JtYXR0ZWQgdGFyZ2V0LlxuICAgKi9cbiAgYnJvd3NlcnM6IHN0cmluZ1tdO1xuXG4gIHRhaWx3aW5kQ29uZmlndXJhdGlvbj86IHsgZmlsZTogc3RyaW5nOyBwYWNrYWdlOiBzdHJpbmcgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGVzYnVpbGQgcGx1Z2luIHRvIHByb2Nlc3MgQ1NTIHN0eWxlc2hlZXRzLlxuICogQHBhcmFtIG9wdGlvbnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHBsdWdpbiBvcHRpb25zLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBQbHVnaW4gaW5zdGFuY2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDc3NQbHVnaW4ob3B0aW9uczogQ3NzUGx1Z2luT3B0aW9ucyk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItY3NzJyxcbiAgICBhc3luYyBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgIGNvbnN0IGF1dG9wcmVmaXhlciA9IGNyZWF0ZUF1dG9QcmVmaXhlclBsdWdpbih7XG4gICAgICAgIG92ZXJyaWRlQnJvd3NlcnNsaXN0OiBvcHRpb25zLmJyb3dzZXJzLFxuICAgICAgICBpZ25vcmVVbmtub3duVmVyc2lvbnM6IHRydWUsXG4gICAgICB9KTtcblxuICAgICAgLy8gQXV0b3ByZWZpeGVyIGN1cnJlbnRseSBkb2VzIG5vdCBjb250YWluIGEgbWV0aG9kIHRvIGNoZWNrIGlmIGF1dG9wcmVmaXhlciBpcyByZXF1aXJlZFxuICAgICAgLy8gYmFzZWQgb24gdGhlIHByb3ZpZGVkIGxpc3Qgb2YgYnJvd3NlcnMuIEhvd2V2ZXIsIGl0IGRvZXMgY29udGFpbiBhIG1ldGhvZCB0aGF0IHJldHVybnNcbiAgICAgIC8vIGluZm9ybWF0aW9uYWwgdGV4dCB0aGF0IGNhbiBiZSB1c2VkIGFzIGEgcmVwbGFjZW1lbnQuIFRoZSB0ZXh0IFwiQXdlc29tZSFcIiB3aWxsIGJlIHByZXNlbnRcbiAgICAgIC8vIHdoZW4gYXV0b3ByZWZpeGVyIGRldGVybWluZXMgbm8gYWN0aW9ucyBhcmUgbmVlZGVkLlxuICAgICAgLy8gcmVmOiBodHRwczovL2dpdGh1Yi5jb20vcG9zdGNzcy9hdXRvcHJlZml4ZXIvYmxvYi9lMmY1YzI2ZmYxZjNlYWNhOTVhMjE4NzM3MjNjZTFjZGY2ZTU5ZjBlL2xpYi9pbmZvLmpzI0wxMThcbiAgICAgIGNvbnN0IGF1dG9wcmVmaXhlckluZm8gPSBhdXRvcHJlZml4ZXIuaW5mbyh7IGZyb206IGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIgfSk7XG4gICAgICBjb25zdCBza2lwQXV0b3ByZWZpeGVyID0gYXV0b3ByZWZpeGVySW5mby5pbmNsdWRlcygnQXdlc29tZSEnKTtcblxuICAgICAgaWYgKHNraXBBdXRvcHJlZml4ZXIgJiYgIW9wdGlvbnMudGFpbHdpbmRDb25maWd1cmF0aW9uKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgcG9zdGNzcyA/Pz0gKGF3YWl0IGltcG9ydCgncG9zdGNzcycpKS5kZWZhdWx0O1xuICAgICAgY29uc3QgcG9zdGNzc1Byb2Nlc3NvciA9IHBvc3Rjc3MoKTtcbiAgICAgIGlmIChvcHRpb25zLnRhaWx3aW5kQ29uZmlndXJhdGlvbikge1xuICAgICAgICBjb25zdCB0YWlsd2luZCA9IGF3YWl0IGltcG9ydChvcHRpb25zLnRhaWx3aW5kQ29uZmlndXJhdGlvbi5wYWNrYWdlKTtcbiAgICAgICAgcG9zdGNzc1Byb2Nlc3Nvci51c2UodGFpbHdpbmQuZGVmYXVsdCh7IGNvbmZpZzogb3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24uZmlsZSB9KSk7XG4gICAgICB9XG4gICAgICBpZiAoIXNraXBBdXRvcHJlZml4ZXIpIHtcbiAgICAgICAgcG9zdGNzc1Byb2Nlc3Nvci51c2UoYXV0b3ByZWZpeGVyKTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIGEgbG9hZCBjYWxsYmFjayB0byBzdXBwb3J0IGlubGluZSBDb21wb25lbnQgc3R5bGVzXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9eY3NzOy8sIG5hbWVzcGFjZTogJ2FuZ3VsYXI6c3R5bGVzL2NvbXBvbmVudCcgfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgZGF0YSA9IG9wdGlvbnMuaW5saW5lQ29tcG9uZW50RGF0YT8uW2FyZ3MucGF0aF07XG4gICAgICAgIGFzc2VydChkYXRhLCBgY29tcG9uZW50IHN0eWxlIG5hbWUgc2hvdWxkIGFsd2F5cyBiZSBmb3VuZCBbJHthcmdzLnBhdGh9XWApO1xuXG4gICAgICAgIGNvbnN0IFssICwgZmlsZVBhdGhdID0gYXJncy5wYXRoLnNwbGl0KCc7JywgMyk7XG5cbiAgICAgICAgcmV0dXJuIGNvbXBpbGVTdHJpbmcoZGF0YSwgZmlsZVBhdGgsIHBvc3Rjc3NQcm9jZXNzb3IsIG9wdGlvbnMpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEFkZCBhIGxvYWQgY2FsbGJhY2sgdG8gc3VwcG9ydCBmaWxlcyBmcm9tIGRpc2tcbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLmNzcyQvIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZWFkRmlsZShhcmdzLnBhdGgsICd1dGYtOCcpO1xuXG4gICAgICAgIHJldHVybiBjb21waWxlU3RyaW5nKGRhdGEsIGFyZ3MucGF0aCwgcG9zdGNzc1Byb2Nlc3Nvciwgb3B0aW9ucyk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG4vKipcbiAqIENvbXBpbGVzIHRoZSBwcm92aWRlZCBDU1Mgc3R5bGVzaGVldCBkYXRhIHVzaW5nIGEgcHJvdmlkZWQgcG9zdGNzcyBwcm9jZXNzb3IgYW5kIHByb3ZpZGVzIGFuXG4gKiBlc2J1aWxkIGxvYWQgcmVzdWx0IHRoYXQgY2FuIGJlIHVzZWQgZGlyZWN0bHkgYnkgYW4gZXNidWlsZCBQbHVnaW4uXG4gKiBAcGFyYW0gZGF0YSBUaGUgc3R5bGVzaGVldCBjb250ZW50IHRvIHByb2Nlc3MuXG4gKiBAcGFyYW0gZmlsZW5hbWUgVGhlIG5hbWUgb2YgdGhlIGZpbGUgdGhhdCBjb250YWlucyB0aGUgZGF0YS5cbiAqIEBwYXJhbSBwb3N0Y3NzUHJvY2Vzc29yIEEgcG9zdGNzcyBwcm9jZXNzb3IgaW5zdGFuY2UgdG8gdXNlLlxuICogQHBhcmFtIG9wdGlvbnMgVGhlIHBsdWdpbiBvcHRpb25zIHRvIGNvbnRyb2wgdGhlIHByb2Nlc3NpbmcuXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIE9uTG9hZGVyUmVzdWx0IG9iamVjdCB3aXRoIHRoZSBwcm9jZXNzZWQgY29udGVudCwgd2FybmluZ3MsIGFuZC9vciBlcnJvcnMuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGNvbXBpbGVTdHJpbmcoXG4gIGRhdGE6IHN0cmluZyxcbiAgZmlsZW5hbWU6IHN0cmluZyxcbiAgcG9zdGNzc1Byb2Nlc3NvcjogaW1wb3J0KCdwb3N0Y3NzJykuUHJvY2Vzc29yLFxuICBvcHRpb25zOiBDc3NQbHVnaW5PcHRpb25zLFxuKTogUHJvbWlzZTxPbkxvYWRSZXN1bHQ+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwb3N0Y3NzUHJvY2Vzc29yLnByb2Nlc3MoZGF0YSwge1xuICAgICAgZnJvbTogZmlsZW5hbWUsXG4gICAgICB0bzogZmlsZW5hbWUsXG4gICAgICBtYXA6IG9wdGlvbnMuc291cmNlbWFwICYmIHtcbiAgICAgICAgaW5saW5lOiB0cnVlLFxuICAgICAgICBzb3VyY2VzQ29udGVudDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCByYXdXYXJuaW5ncyA9IHJlc3VsdC53YXJuaW5ncygpO1xuICAgIGxldCB3YXJuaW5ncztcbiAgICBpZiAocmF3V2FybmluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgbGluZU1hcHBpbmdzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZ1tdIHwgbnVsbD4oKTtcbiAgICAgIHdhcm5pbmdzID0gcmF3V2FybmluZ3MubWFwKCh3YXJuaW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSB3YXJuaW5nLm5vZGUuc291cmNlPy5pbnB1dC5maWxlO1xuICAgICAgICBpZiAoZmlsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcmV0dXJuIHsgdGV4dDogd2FybmluZy50ZXh0IH07XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgbGluZXMgPSBsaW5lTWFwcGluZ3MuZ2V0KGZpbGUpO1xuICAgICAgICBpZiAobGluZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGxpbmVzID0gd2FybmluZy5ub2RlLnNvdXJjZT8uaW5wdXQuY3NzLnNwbGl0KC9cXHI/XFxuLyk7XG4gICAgICAgICAgbGluZU1hcHBpbmdzLnNldChmaWxlLCBsaW5lcyA/PyBudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdGV4dDogd2FybmluZy50ZXh0LFxuICAgICAgICAgIGxvY2F0aW9uOiB7XG4gICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgbGluZTogd2FybmluZy5saW5lLFxuICAgICAgICAgICAgY29sdW1uOiB3YXJuaW5nLmNvbHVtbiAtIDEsXG4gICAgICAgICAgICBsaW5lVGV4dDogbGluZXM/Llt3YXJuaW5nLmxpbmUgLSAxXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRlbnRzOiByZXN1bHQuY3NzLFxuICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgIHdhcm5pbmdzLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcG9zdGNzcyA/Pz0gKGF3YWl0IGltcG9ydCgncG9zdGNzcycpKS5kZWZhdWx0O1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIHBvc3Rjc3MuQ3NzU3ludGF4RXJyb3IpIHtcbiAgICAgIGNvbnN0IGxpbmVzID0gZXJyb3Iuc291cmNlPy5zcGxpdCgvXFxyP1xcbi8pO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0ZXh0OiBlcnJvci5yZWFzb24sXG4gICAgICAgICAgICBsb2NhdGlvbjoge1xuICAgICAgICAgICAgICBmaWxlOiBlcnJvci5maWxlLFxuICAgICAgICAgICAgICBsaW5lOiBlcnJvci5saW5lLFxuICAgICAgICAgICAgICBjb2x1bW46IGVycm9yLmNvbHVtbiAmJiBlcnJvci5jb2x1bW4gLSAxLFxuICAgICAgICAgICAgICBsaW5lVGV4dDogZXJyb3IubGluZSA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogbGluZXM/LltlcnJvci5saW5lIC0gMV0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9O1xuICAgIH1cblxuICAgIHRocm93IGVycm9yO1xuICB9XG59XG4iXX0=