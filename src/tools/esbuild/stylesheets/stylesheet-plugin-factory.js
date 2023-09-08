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
/**
 * An array of keywords that indicate Tailwind CSS processing is required for a stylesheet.
 *
 * Based on https://tailwindcss.com/docs/functions-and-directives
 */
const TAILWIND_KEYWORDS = ['@tailwind', '@layer', '@apply', '@config', 'theme(', 'screen('];
class StylesheetPluginFactory {
    options;
    cache;
    postcssProcessor;
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
        const setupPostcss = async () => {
            // Return already created processor if present
            if (this.postcssProcessor) {
                return this.postcssProcessor;
            }
            if (options.tailwindConfiguration) {
                postcss ??= (await Promise.resolve().then(() => __importStar(require('postcss')))).default;
                const tailwind = await Promise.resolve(`${options.tailwindConfiguration.package}`).then(s => __importStar(require(s)));
                this.postcssProcessor = postcss().use(tailwind.default({ config: options.tailwindConfiguration.file }));
            }
            return this.postcssProcessor;
        };
        return {
            name: 'angular-' + language.name,
            async setup(build) {
                // Setup postcss if needed
                const postcssProcessor = await setupPostcss();
                // Add a load callback to support inline Component styles
                build.onLoad({ filter: language.componentFilter, namespace: 'angular:styles/component' }, (0, load_result_cache_1.createCachedLoad)(cache, (args) => {
                    const data = options.inlineComponentData?.[args.path];
                    (0, node_assert_1.default)(typeof data === 'string', `component style name should always be found [${args.path}]`);
                    const [format, , filename] = args.path.split(';', 3);
                    // Only use postcss if Tailwind processing is required.
                    // NOTE: If postcss is used for more than just Tailwind in the future this check MUST
                    // be updated to account for the additional use.
                    // TODO: use better search algorithm for keywords
                    const needsPostcss = !!postcssProcessor && TAILWIND_KEYWORDS.some((keyword) => data.includes(keyword));
                    return processStylesheet(language, data, filename, format, options, build, needsPostcss ? postcssProcessor : undefined);
                }));
                // Add a load callback to support files from disk
                build.onLoad({ filter: language.fileFilter }, (0, load_result_cache_1.createCachedLoad)(cache, async (args) => {
                    const data = await (0, promises_1.readFile)(args.path, 'utf-8');
                    const needsPostcss = !!postcssProcessor && TAILWIND_KEYWORDS.some((keyword) => data.includes(keyword));
                    return processStylesheet(language, data, args.path, (0, node_path_1.extname)(args.path).toLowerCase().slice(1), options, build, needsPostcss ? postcssProcessor : undefined);
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
                loadResult.watchFiles ??= [];
                loadResult.watchFiles.push(resultMessage['file']);
            }
            else if (resultMessage.type === 'dir-dependency' &&
                typeof resultMessage['dir'] === 'string' &&
                typeof resultMessage['glob'] === 'string') {
                loadResult.watchFiles ??= [];
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
        postcss ??= (await Promise.resolve().then(() => __importStar(require('postcss')))).default;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldC1wbHVnaW4tZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvc3R5bGVzaGVldHMvc3R5bGVzaGVldC1wbHVnaW4tZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILDBEQUE2QjtBQUM3Qiw4REFBaUM7QUFDakMsK0NBQTRDO0FBQzVDLHlDQUFvQztBQUNwQyw0REFBeUU7QUFFekU7OztHQUdHO0FBQ0gsSUFBSSxPQUF3RCxDQUFDO0FBZ0M3RDs7OztHQUlHO0FBQ0gsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFlNUYsTUFBYSx1QkFBdUI7SUFJZjtJQUNBO0lBSlgsZ0JBQWdCLENBQStCO0lBRXZELFlBQ21CLE9BQWdDLEVBQ2hDLEtBQXVCO1FBRHZCLFlBQU8sR0FBUCxPQUFPLENBQXlCO1FBQ2hDLFVBQUssR0FBTCxLQUFLLENBQWtCO0lBQ3ZDLENBQUM7SUFFSixNQUFNLENBQUMsUUFBc0M7UUFDM0MsdURBQXVEO1FBQ3ZELElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRTtZQUM1RCxPQUFPO2dCQUNMLElBQUksRUFBRSxVQUFVLEdBQUcsUUFBUSxDQUFDLElBQUk7Z0JBQ2hDLEtBQUssS0FBSSxDQUFDO2FBQ1gsQ0FBQztTQUNIO1FBRUQsTUFBTSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDaEMsTUFBTSxZQUFZLEdBQUcsS0FBSyxJQUFJLEVBQUU7WUFDOUIsOENBQThDO1lBQzlDLElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFO2dCQUN6QixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQzthQUM5QjtZQUVELElBQUksT0FBTyxDQUFDLHFCQUFxQixFQUFFO2dCQUNqQyxPQUFPLEtBQUssQ0FBQyx3REFBYSxTQUFTLEdBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztnQkFDOUMsTUFBTSxRQUFRLEdBQUcseUJBQWEsT0FBTyxDQUFDLHFCQUFxQixDQUFDLE9BQU8sdUNBQUMsQ0FBQztnQkFDckUsSUFBSSxDQUFDLGdCQUFnQixHQUFHLE9BQU8sRUFBRSxDQUFDLEdBQUcsQ0FDbkMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FDakUsQ0FBQzthQUNIO1lBRUQsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUM7UUFDL0IsQ0FBQyxDQUFDO1FBRUYsT0FBTztZQUNMLElBQUksRUFBRSxVQUFVLEdBQUcsUUFBUSxDQUFDLElBQUk7WUFDaEMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLO2dCQUNmLDBCQUEwQjtnQkFDMUIsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLFlBQVksRUFBRSxDQUFDO2dCQUU5Qyx5REFBeUQ7Z0JBQ3pELEtBQUssQ0FBQyxNQUFNLENBQ1YsRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLGVBQWUsRUFBRSxTQUFTLEVBQUUsMEJBQTBCLEVBQUUsRUFDM0UsSUFBQSxvQ0FBZ0IsRUFBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTtvQkFDL0IsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUN0RCxJQUFBLHFCQUFNLEVBQ0osT0FBTyxJQUFJLEtBQUssUUFBUSxFQUN4QixnREFBZ0QsSUFBSSxDQUFDLElBQUksR0FBRyxDQUM3RCxDQUFDO29CQUVGLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQUFBRCxFQUFHLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDckQsdURBQXVEO29CQUN2RCxxRkFBcUY7b0JBQ3JGLGdEQUFnRDtvQkFDaEQsaURBQWlEO29CQUNqRCxNQUFNLFlBQVksR0FDaEIsQ0FBQyxDQUFDLGdCQUFnQixJQUFJLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUVwRixPQUFPLGlCQUFpQixDQUN0QixRQUFRLEVBQ1IsSUFBSSxFQUNKLFFBQVEsRUFDUixNQUFNLEVBQ04sT0FBTyxFQUNQLEtBQUssRUFDTCxZQUFZLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxTQUFTLENBQzVDLENBQUM7Z0JBQ0osQ0FBQyxDQUFDLENBQ0gsQ0FBQztnQkFFRixpREFBaUQ7Z0JBQ2pELEtBQUssQ0FBQyxNQUFNLENBQ1YsRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLFVBQVUsRUFBRSxFQUMvQixJQUFBLG9DQUFnQixFQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7b0JBQ3JDLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBQSxtQkFBUSxFQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7b0JBQ2hELE1BQU0sWUFBWSxHQUNoQixDQUFDLENBQUMsZ0JBQWdCLElBQUksaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7b0JBRXBGLE9BQU8saUJBQWlCLENBQ3RCLFFBQVEsRUFDUixJQUFJLEVBQ0osSUFBSSxDQUFDLElBQUksRUFDVCxJQUFBLG1CQUFPLEVBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFDekMsT0FBTyxFQUNQLEtBQUssRUFDTCxZQUFZLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxTQUFTLENBQzVDLENBQUM7Z0JBQ0osQ0FBQyxDQUFDLENBQ0gsQ0FBQztZQUNKLENBQUM7U0FDRixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBN0ZELDBEQTZGQztBQUVELEtBQUssVUFBVSxpQkFBaUIsQ0FDOUIsUUFBc0MsRUFDdEMsSUFBWSxFQUNaLFFBQWdCLEVBQ2hCLE1BQWMsRUFDZCxPQUFnQyxFQUNoQyxLQUFrQixFQUNsQixnQkFBeUQ7SUFFekQsSUFBSSxNQUFvQixDQUFDO0lBRXpCLGdFQUFnRTtJQUNoRSxJQUFJLFFBQVEsQ0FBQyxPQUFPLEVBQUU7UUFDcEIsTUFBTSxHQUFHLE1BQU0sUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7S0FDekU7U0FBTTtRQUNMLE1BQU0sR0FBRztZQUNQLFFBQVEsRUFBRSxJQUFJO1lBQ2QsTUFBTSxFQUFFLEtBQUs7WUFDYixVQUFVLEVBQUUsQ0FBQyxRQUFRLENBQUM7U0FDdkIsQ0FBQztLQUNIO0lBRUQsMkRBQTJEO0lBQzNELElBQUksZ0JBQWdCLElBQUksTUFBTSxDQUFDLFFBQVEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFO1FBQ2pFLE1BQU0sYUFBYSxHQUFHLE1BQU0sYUFBYSxDQUN2QyxPQUFPLE1BQU0sQ0FBQyxRQUFRLEtBQUssUUFBUTtZQUNqQyxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVE7WUFDakIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFDbEQsUUFBUSxFQUNSLGdCQUFnQixFQUNoQixPQUFPLENBQ1IsQ0FBQztRQUVGLGdCQUFnQjtRQUNoQixJQUFJLGFBQWEsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFO1lBQ2hDLE9BQU8sTUFBTSxDQUFDLFFBQVEsQ0FBQztTQUN4QjtRQUNELElBQUksTUFBTSxDQUFDLFFBQVEsSUFBSSxhQUFhLENBQUMsUUFBUSxFQUFFO1lBQzdDLGFBQWEsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ3BEO1FBQ0QsSUFBSSxNQUFNLENBQUMsVUFBVSxJQUFJLGFBQWEsQ0FBQyxVQUFVLEVBQUU7WUFDakQsYUFBYSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7U0FDeEQ7UUFDRCxJQUFJLE1BQU0sQ0FBQyxTQUFTLElBQUksYUFBYSxDQUFDLFNBQVMsRUFBRTtZQUMvQyxhQUFhLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUN0RDtRQUNELE1BQU0sR0FBRztZQUNQLEdBQUcsTUFBTTtZQUNULEdBQUcsYUFBYTtTQUNqQixDQUFDO0tBQ0g7SUFFRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBRUQ7Ozs7Ozs7O0dBUUc7QUFDSCxLQUFLLFVBQVUsYUFBYSxDQUMxQixJQUFZLEVBQ1osUUFBZ0IsRUFDaEIsZ0JBQTZDLEVBQzdDLE9BQWdDO0lBRWhDLElBQUk7UUFDRixNQUFNLGFBQWEsR0FBRyxNQUFNLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7WUFDekQsSUFBSSxFQUFFLFFBQVE7WUFDZCxFQUFFLEVBQUUsUUFBUTtZQUNaLEdBQUcsRUFBRSxPQUFPLENBQUMsU0FBUyxJQUFJO2dCQUN4QixNQUFNLEVBQUUsSUFBSTtnQkFDWixjQUFjLEVBQUUsSUFBSTthQUNyQjtTQUNGLENBQUMsQ0FBQztRQUVILE1BQU0sVUFBVSxHQUFpQjtZQUMvQixRQUFRLEVBQUUsYUFBYSxDQUFDLEdBQUc7WUFDM0IsTUFBTSxFQUFFLEtBQUs7U0FDZCxDQUFDO1FBRUYsTUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQzdDLElBQUksV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDMUIsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQTJCLENBQUM7WUFDeEQsVUFBVSxDQUFDLFFBQVEsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7Z0JBQ2hELE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUM7Z0JBQzdDLElBQUksSUFBSSxLQUFLLFNBQVMsRUFBRTtvQkFDdEIsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7aUJBQy9CO2dCQUVELElBQUksS0FBSyxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ25DLElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRTtvQkFDdkIsS0FBSyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUN0RCxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxLQUFLLElBQUksSUFBSSxDQUFDLENBQUM7aUJBQ3ZDO2dCQUVELE9BQU87b0JBQ0wsSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJO29CQUNsQixRQUFRLEVBQUU7d0JBQ1IsSUFBSTt3QkFDSixJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7d0JBQ2xCLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUM7d0JBQzFCLFFBQVEsRUFBRSxLQUFLLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztxQkFDcEM7aUJBQ0YsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDO1NBQ0o7UUFFRCxLQUFLLE1BQU0sYUFBYSxJQUFJLGFBQWEsQ0FBQyxRQUFRLEVBQUU7WUFDbEQsSUFBSSxhQUFhLENBQUMsSUFBSSxLQUFLLFlBQVksSUFBSSxPQUFPLGFBQWEsQ0FBQyxNQUFNLENBQUMsS0FBSyxRQUFRLEVBQUU7Z0JBQ3BGLFVBQVUsQ0FBQyxVQUFVLEtBQUssRUFBRSxDQUFDO2dCQUM3QixVQUFVLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQzthQUNuRDtpQkFBTSxJQUNMLGFBQWEsQ0FBQyxJQUFJLEtBQUssZ0JBQWdCO2dCQUN2QyxPQUFPLGFBQWEsQ0FBQyxLQUFLLENBQUMsS0FBSyxRQUFRO2dCQUN4QyxPQUFPLGFBQWEsQ0FBQyxNQUFNLENBQUMsS0FBSyxRQUFRLEVBQ3pDO2dCQUNBLFVBQVUsQ0FBQyxVQUFVLEtBQUssRUFBRSxDQUFDO2dCQUM3QixNQUFNLFlBQVksR0FBRyxNQUFNLElBQUEsbUJBQUksRUFBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEVBQUU7b0JBQ3JELFFBQVEsRUFBRSxJQUFJO29CQUNkLEdBQUcsRUFBRSxhQUFhLENBQUMsS0FBSyxDQUFDO2lCQUMxQixDQUFDLENBQUM7Z0JBQ0gsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQzthQUM3QztTQUNGO1FBRUQsT0FBTyxVQUFVLENBQUM7S0FDbkI7SUFBQyxPQUFPLEtBQUssRUFBRTtRQUNkLE9BQU8sS0FBSyxDQUFDLHdEQUFhLFNBQVMsR0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO1FBQzlDLElBQUksS0FBSyxZQUFZLE9BQU8sQ0FBQyxjQUFjLEVBQUU7WUFDM0MsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7WUFFM0MsT0FBTztnQkFDTCxNQUFNLEVBQUU7b0JBQ047d0JBQ0UsSUFBSSxFQUFFLEtBQUssQ0FBQyxNQUFNO3dCQUNsQixRQUFRLEVBQUU7NEJBQ1IsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJOzRCQUNoQixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7NEJBQ2hCLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQzs0QkFDeEMsUUFBUSxFQUFFLEtBQUssQ0FBQyxJQUFJLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO3lCQUN6RTtxQkFDRjtpQkFDRjthQUNGLENBQUM7U0FDSDtRQUVELE1BQU0sS0FBSyxDQUFDO0tBQ2I7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgT25Mb2FkUmVzdWx0LCBQbHVnaW4sIFBsdWdpbkJ1aWxkIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgZ2xvYiBmcm9tICdmYXN0LWdsb2InO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgZXh0bmFtZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBMb2FkUmVzdWx0Q2FjaGUsIGNyZWF0ZUNhY2hlZExvYWQgfSBmcm9tICcuLi9sb2FkLXJlc3VsdC1jYWNoZSc7XG5cbi8qKlxuICogVGhlIGxhenktbG9hZGVkIGluc3RhbmNlIG9mIHRoZSBwb3N0Y3NzIHN0eWxlc2hlZXQgcG9zdHByb2Nlc3Nvci5cbiAqIEl0IGlzIG9ubHkgaW1wb3J0ZWQgYW5kIGluaXRpYWxpemVkIGlmIHBvc3Rjc3MgaXMgbmVlZGVkLlxuICovXG5sZXQgcG9zdGNzczogdHlwZW9mIGltcG9ydCgncG9zdGNzcycpWydkZWZhdWx0J10gfCB1bmRlZmluZWQ7XG5cbi8qKlxuICogQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHBsdWdpbiBvcHRpb25zIHRvIHVzZSB3aGVuIHByb2Nlc3Npbmcgc3R5bGVzaGVldHMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMge1xuICAvKipcbiAgICogQ29udHJvbHMgdGhlIHVzZSBhbmQgY3JlYXRpb24gb2Ygc291cmNlbWFwcyB3aGVuIHByb2Nlc3NpbmcgdGhlIHN0eWxlc2hlZXRzLlxuICAgKiBJZiB0cnVlLCBzb3VyY2VtYXAgcHJvY2Vzc2luZyBpcyBlbmFibGVkOyBpZiBmYWxzZSwgZGlzYWJsZWQuXG4gICAqL1xuICBzb3VyY2VtYXA6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEFuIG9wdGlvbmFsIGFycmF5IG9mIHBhdGhzIHRoYXQgd2lsbCBiZSBzZWFyY2hlZCBmb3Igc3R5bGVzaGVldHMgaWYgdGhlIGRlZmF1bHRcbiAgICogcmVzb2x1dGlvbiBwcm9jZXNzIGZvciB0aGUgc3R5bGVzaGVldCBsYW5ndWFnZSBkb2VzIG5vdCBzdWNjZWVkLlxuICAgKi9cbiAgaW5jbHVkZVBhdGhzPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIE9wdGlvbmFsIGNvbXBvbmVudCBkYXRhIGZvciBhbnkgaW5saW5lIHN0eWxlcyBmcm9tIENvbXBvbmVudCBkZWNvcmF0b3IgYHN0eWxlc2AgZmllbGRzLlxuICAgKiBUaGUga2V5IGlzIGFuIGludGVybmFsIGFuZ3VsYXIgcmVzb3VyY2UgVVJJIGFuZCB0aGUgdmFsdWUgaXMgdGhlIHN0eWxlc2hlZXQgY29udGVudC5cbiAgICovXG4gIGlubGluZUNvbXBvbmVudERhdGE/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuXG4gIC8qKlxuICAgKiBPcHRpb25hbCBpbmZvcm1hdGlvbiB1c2VkIHRvIGxvYWQgYW5kIGNvbmZpZ3VyZSBUYWlsd2luZCBDU1MuIElmIHByZXNlbnQsIHRoZSBwb3N0Y3NzXG4gICAqIHdpbGwgYmUgYWRkZWQgdG8gdGhlIHN0eWxlc2hlZXQgcHJvY2Vzc2luZyB3aXRoIHRoZSBUYWlsd2luZCBwbHVnaW4gc2V0dXAgYXMgcHJvdmlkZWRcbiAgICogYnkgdGhlIGNvbmZpZ3VyYXRpb24gZmlsZS5cbiAgICovXG4gIHRhaWx3aW5kQ29uZmlndXJhdGlvbj86IHsgZmlsZTogc3RyaW5nOyBwYWNrYWdlOiBzdHJpbmcgfTtcbn1cblxuLyoqXG4gKiBBbiBhcnJheSBvZiBrZXl3b3JkcyB0aGF0IGluZGljYXRlIFRhaWx3aW5kIENTUyBwcm9jZXNzaW5nIGlzIHJlcXVpcmVkIGZvciBhIHN0eWxlc2hlZXQuXG4gKlxuICogQmFzZWQgb24gaHR0cHM6Ly90YWlsd2luZGNzcy5jb20vZG9jcy9mdW5jdGlvbnMtYW5kLWRpcmVjdGl2ZXNcbiAqL1xuY29uc3QgVEFJTFdJTkRfS0VZV09SRFMgPSBbJ0B0YWlsd2luZCcsICdAbGF5ZXInLCAnQGFwcGx5JywgJ0Bjb25maWcnLCAndGhlbWUoJywgJ3NjcmVlbignXTtcblxuZXhwb3J0IGludGVyZmFjZSBTdHlsZXNoZWV0TGFuZ3VhZ2Uge1xuICBuYW1lOiBzdHJpbmc7XG4gIGNvbXBvbmVudEZpbHRlcjogUmVnRXhwO1xuICBmaWxlRmlsdGVyOiBSZWdFeHA7XG4gIHByb2Nlc3M/KFxuICAgIGRhdGE6IHN0cmluZyxcbiAgICBmaWxlOiBzdHJpbmcsXG4gICAgZm9ybWF0OiBzdHJpbmcsXG4gICAgb3B0aW9uczogU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMsXG4gICAgYnVpbGQ6IFBsdWdpbkJ1aWxkLFxuICApOiBPbkxvYWRSZXN1bHQgfCBQcm9taXNlPE9uTG9hZFJlc3VsdD47XG59XG5cbmV4cG9ydCBjbGFzcyBTdHlsZXNoZWV0UGx1Z2luRmFjdG9yeSB7XG4gIHByaXZhdGUgcG9zdGNzc1Byb2Nlc3Nvcj86IGltcG9ydCgncG9zdGNzcycpLlByb2Nlc3NvcjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM6IFN0eWxlc2hlZXRQbHVnaW5PcHRpb25zLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY2FjaGU/OiBMb2FkUmVzdWx0Q2FjaGUsXG4gICkge31cblxuICBjcmVhdGUobGFuZ3VhZ2U6IFJlYWRvbmx5PFN0eWxlc2hlZXRMYW5ndWFnZT4pOiBQbHVnaW4ge1xuICAgIC8vIFJldHVybiBhIG5vb3AgcGx1Z2luIGlmIG5vIGxvYWQgYWN0aW9ucyBhcmUgcmVxdWlyZWRcbiAgICBpZiAoIWxhbmd1YWdlLnByb2Nlc3MgJiYgIXRoaXMub3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24pIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6ICdhbmd1bGFyLScgKyBsYW5ndWFnZS5uYW1lLFxuICAgICAgICBzZXR1cCgpIHt9LFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGNhY2hlLCBvcHRpb25zIH0gPSB0aGlzO1xuICAgIGNvbnN0IHNldHVwUG9zdGNzcyA9IGFzeW5jICgpID0+IHtcbiAgICAgIC8vIFJldHVybiBhbHJlYWR5IGNyZWF0ZWQgcHJvY2Vzc29yIGlmIHByZXNlbnRcbiAgICAgIGlmICh0aGlzLnBvc3Rjc3NQcm9jZXNzb3IpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucG9zdGNzc1Byb2Nlc3NvcjtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMudGFpbHdpbmRDb25maWd1cmF0aW9uKSB7XG4gICAgICAgIHBvc3Rjc3MgPz89IChhd2FpdCBpbXBvcnQoJ3Bvc3Rjc3MnKSkuZGVmYXVsdDtcbiAgICAgICAgY29uc3QgdGFpbHdpbmQgPSBhd2FpdCBpbXBvcnQob3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24ucGFja2FnZSk7XG4gICAgICAgIHRoaXMucG9zdGNzc1Byb2Nlc3NvciA9IHBvc3Rjc3MoKS51c2UoXG4gICAgICAgICAgdGFpbHdpbmQuZGVmYXVsdCh7IGNvbmZpZzogb3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24uZmlsZSB9KSxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMucG9zdGNzc1Byb2Nlc3NvcjtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIG5hbWU6ICdhbmd1bGFyLScgKyBsYW5ndWFnZS5uYW1lLFxuICAgICAgYXN5bmMgc2V0dXAoYnVpbGQpIHtcbiAgICAgICAgLy8gU2V0dXAgcG9zdGNzcyBpZiBuZWVkZWRcbiAgICAgICAgY29uc3QgcG9zdGNzc1Byb2Nlc3NvciA9IGF3YWl0IHNldHVwUG9zdGNzcygpO1xuXG4gICAgICAgIC8vIEFkZCBhIGxvYWQgY2FsbGJhY2sgdG8gc3VwcG9ydCBpbmxpbmUgQ29tcG9uZW50IHN0eWxlc1xuICAgICAgICBidWlsZC5vbkxvYWQoXG4gICAgICAgICAgeyBmaWx0ZXI6IGxhbmd1YWdlLmNvbXBvbmVudEZpbHRlciwgbmFtZXNwYWNlOiAnYW5ndWxhcjpzdHlsZXMvY29tcG9uZW50JyB9LFxuICAgICAgICAgIGNyZWF0ZUNhY2hlZExvYWQoY2FjaGUsIChhcmdzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gb3B0aW9ucy5pbmxpbmVDb21wb25lbnREYXRhPy5bYXJncy5wYXRoXTtcbiAgICAgICAgICAgIGFzc2VydChcbiAgICAgICAgICAgICAgdHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnLFxuICAgICAgICAgICAgICBgY29tcG9uZW50IHN0eWxlIG5hbWUgc2hvdWxkIGFsd2F5cyBiZSBmb3VuZCBbJHthcmdzLnBhdGh9XWAsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBjb25zdCBbZm9ybWF0LCAsIGZpbGVuYW1lXSA9IGFyZ3MucGF0aC5zcGxpdCgnOycsIDMpO1xuICAgICAgICAgICAgLy8gT25seSB1c2UgcG9zdGNzcyBpZiBUYWlsd2luZCBwcm9jZXNzaW5nIGlzIHJlcXVpcmVkLlxuICAgICAgICAgICAgLy8gTk9URTogSWYgcG9zdGNzcyBpcyB1c2VkIGZvciBtb3JlIHRoYW4ganVzdCBUYWlsd2luZCBpbiB0aGUgZnV0dXJlIHRoaXMgY2hlY2sgTVVTVFxuICAgICAgICAgICAgLy8gYmUgdXBkYXRlZCB0byBhY2NvdW50IGZvciB0aGUgYWRkaXRpb25hbCB1c2UuXG4gICAgICAgICAgICAvLyBUT0RPOiB1c2UgYmV0dGVyIHNlYXJjaCBhbGdvcml0aG0gZm9yIGtleXdvcmRzXG4gICAgICAgICAgICBjb25zdCBuZWVkc1Bvc3Rjc3MgPVxuICAgICAgICAgICAgICAhIXBvc3Rjc3NQcm9jZXNzb3IgJiYgVEFJTFdJTkRfS0VZV09SRFMuc29tZSgoa2V5d29yZCkgPT4gZGF0YS5pbmNsdWRlcyhrZXl3b3JkKSk7XG5cbiAgICAgICAgICAgIHJldHVybiBwcm9jZXNzU3R5bGVzaGVldChcbiAgICAgICAgICAgICAgbGFuZ3VhZ2UsXG4gICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgIGZpbGVuYW1lLFxuICAgICAgICAgICAgICBmb3JtYXQsXG4gICAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICAgIGJ1aWxkLFxuICAgICAgICAgICAgICBuZWVkc1Bvc3Rjc3MgPyBwb3N0Y3NzUHJvY2Vzc29yIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KSxcbiAgICAgICAgKTtcblxuICAgICAgICAvLyBBZGQgYSBsb2FkIGNhbGxiYWNrIHRvIHN1cHBvcnQgZmlsZXMgZnJvbSBkaXNrXG4gICAgICAgIGJ1aWxkLm9uTG9hZChcbiAgICAgICAgICB7IGZpbHRlcjogbGFuZ3VhZ2UuZmlsZUZpbHRlciB9LFxuICAgICAgICAgIGNyZWF0ZUNhY2hlZExvYWQoY2FjaGUsIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVhZEZpbGUoYXJncy5wYXRoLCAndXRmLTgnKTtcbiAgICAgICAgICAgIGNvbnN0IG5lZWRzUG9zdGNzcyA9XG4gICAgICAgICAgICAgICEhcG9zdGNzc1Byb2Nlc3NvciAmJiBUQUlMV0lORF9LRVlXT1JEUy5zb21lKChrZXl3b3JkKSA9PiBkYXRhLmluY2x1ZGVzKGtleXdvcmQpKTtcblxuICAgICAgICAgICAgcmV0dXJuIHByb2Nlc3NTdHlsZXNoZWV0KFxuICAgICAgICAgICAgICBsYW5ndWFnZSxcbiAgICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgICAgYXJncy5wYXRoLFxuICAgICAgICAgICAgICBleHRuYW1lKGFyZ3MucGF0aCkudG9Mb3dlckNhc2UoKS5zbGljZSgxKSxcbiAgICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgICAgYnVpbGQsXG4gICAgICAgICAgICAgIG5lZWRzUG9zdGNzcyA/IHBvc3Rjc3NQcm9jZXNzb3IgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgICAgfSxcbiAgICB9O1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NTdHlsZXNoZWV0KFxuICBsYW5ndWFnZTogUmVhZG9ubHk8U3R5bGVzaGVldExhbmd1YWdlPixcbiAgZGF0YTogc3RyaW5nLFxuICBmaWxlbmFtZTogc3RyaW5nLFxuICBmb3JtYXQ6IHN0cmluZyxcbiAgb3B0aW9uczogU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMsXG4gIGJ1aWxkOiBQbHVnaW5CdWlsZCxcbiAgcG9zdGNzc1Byb2Nlc3NvcjogaW1wb3J0KCdwb3N0Y3NzJykuUHJvY2Vzc29yIHwgdW5kZWZpbmVkLFxuKSB7XG4gIGxldCByZXN1bHQ6IE9uTG9hZFJlc3VsdDtcblxuICAvLyBQcm9jZXNzIHRoZSBpbnB1dCBkYXRhIGlmIHRoZSBsYW5ndWFnZSByZXF1aXJlcyBwcmVwcm9jZXNzaW5nXG4gIGlmIChsYW5ndWFnZS5wcm9jZXNzKSB7XG4gICAgcmVzdWx0ID0gYXdhaXQgbGFuZ3VhZ2UucHJvY2VzcyhkYXRhLCBmaWxlbmFtZSwgZm9ybWF0LCBvcHRpb25zLCBidWlsZCk7XG4gIH0gZWxzZSB7XG4gICAgcmVzdWx0ID0ge1xuICAgICAgY29udGVudHM6IGRhdGEsXG4gICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgd2F0Y2hGaWxlczogW2ZpbGVuYW1lXSxcbiAgICB9O1xuICB9XG5cbiAgLy8gVHJhbnNmb3JtIHdpdGggcG9zdGNzcyBpZiBuZWVkZWQgYW5kIHRoZXJlIGFyZSBubyBlcnJvcnNcbiAgaWYgKHBvc3Rjc3NQcm9jZXNzb3IgJiYgcmVzdWx0LmNvbnRlbnRzICYmICFyZXN1bHQuZXJyb3JzPy5sZW5ndGgpIHtcbiAgICBjb25zdCBwb3N0Y3NzUmVzdWx0ID0gYXdhaXQgY29tcGlsZVN0cmluZyhcbiAgICAgIHR5cGVvZiByZXN1bHQuY29udGVudHMgPT09ICdzdHJpbmcnXG4gICAgICAgID8gcmVzdWx0LmNvbnRlbnRzXG4gICAgICAgIDogQnVmZmVyLmZyb20ocmVzdWx0LmNvbnRlbnRzKS50b1N0cmluZygndXRmLTgnKSxcbiAgICAgIGZpbGVuYW1lLFxuICAgICAgcG9zdGNzc1Byb2Nlc3NvcixcbiAgICAgIG9wdGlvbnMsXG4gICAgKTtcblxuICAgIC8vIE1lcmdlIHJlc3VsdHNcbiAgICBpZiAocG9zdGNzc1Jlc3VsdC5lcnJvcnM/Lmxlbmd0aCkge1xuICAgICAgZGVsZXRlIHJlc3VsdC5jb250ZW50cztcbiAgICB9XG4gICAgaWYgKHJlc3VsdC53YXJuaW5ncyAmJiBwb3N0Y3NzUmVzdWx0Lndhcm5pbmdzKSB7XG4gICAgICBwb3N0Y3NzUmVzdWx0Lndhcm5pbmdzLnVuc2hpZnQoLi4ucmVzdWx0Lndhcm5pbmdzKTtcbiAgICB9XG4gICAgaWYgKHJlc3VsdC53YXRjaEZpbGVzICYmIHBvc3Rjc3NSZXN1bHQud2F0Y2hGaWxlcykge1xuICAgICAgcG9zdGNzc1Jlc3VsdC53YXRjaEZpbGVzLnVuc2hpZnQoLi4ucmVzdWx0LndhdGNoRmlsZXMpO1xuICAgIH1cbiAgICBpZiAocmVzdWx0LndhdGNoRGlycyAmJiBwb3N0Y3NzUmVzdWx0LndhdGNoRGlycykge1xuICAgICAgcG9zdGNzc1Jlc3VsdC53YXRjaERpcnMudW5zaGlmdCguLi5yZXN1bHQud2F0Y2hEaXJzKTtcbiAgICB9XG4gICAgcmVzdWx0ID0ge1xuICAgICAgLi4ucmVzdWx0LFxuICAgICAgLi4ucG9zdGNzc1Jlc3VsdCxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgcHJvdmlkZWQgQ1NTIHN0eWxlc2hlZXQgZGF0YSB1c2luZyBhIHByb3ZpZGVkIHBvc3Rjc3MgcHJvY2Vzc29yIGFuZCBwcm92aWRlcyBhblxuICogZXNidWlsZCBsb2FkIHJlc3VsdCB0aGF0IGNhbiBiZSB1c2VkIGRpcmVjdGx5IGJ5IGFuIGVzYnVpbGQgUGx1Z2luLlxuICogQHBhcmFtIGRhdGEgVGhlIHN0eWxlc2hlZXQgY29udGVudCB0byBwcm9jZXNzLlxuICogQHBhcmFtIGZpbGVuYW1lIFRoZSBuYW1lIG9mIHRoZSBmaWxlIHRoYXQgY29udGFpbnMgdGhlIGRhdGEuXG4gKiBAcGFyYW0gcG9zdGNzc1Byb2Nlc3NvciBBIHBvc3Rjc3MgcHJvY2Vzc29yIGluc3RhbmNlIHRvIHVzZS5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBwbHVnaW4gb3B0aW9ucyB0byBjb250cm9sIHRoZSBwcm9jZXNzaW5nLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBPbkxvYWRlclJlc3VsdCBvYmplY3Qgd2l0aCB0aGUgcHJvY2Vzc2VkIGNvbnRlbnQsIHdhcm5pbmdzLCBhbmQvb3IgZXJyb3JzLlxuICovXG5hc3luYyBmdW5jdGlvbiBjb21waWxlU3RyaW5nKFxuICBkYXRhOiBzdHJpbmcsXG4gIGZpbGVuYW1lOiBzdHJpbmcsXG4gIHBvc3Rjc3NQcm9jZXNzb3I6IGltcG9ydCgncG9zdGNzcycpLlByb2Nlc3NvcixcbiAgb3B0aW9uczogU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMsXG4pOiBQcm9taXNlPE9uTG9hZFJlc3VsdD4ge1xuICB0cnkge1xuICAgIGNvbnN0IHBvc3Rjc3NSZXN1bHQgPSBhd2FpdCBwb3N0Y3NzUHJvY2Vzc29yLnByb2Nlc3MoZGF0YSwge1xuICAgICAgZnJvbTogZmlsZW5hbWUsXG4gICAgICB0bzogZmlsZW5hbWUsXG4gICAgICBtYXA6IG9wdGlvbnMuc291cmNlbWFwICYmIHtcbiAgICAgICAgaW5saW5lOiB0cnVlLFxuICAgICAgICBzb3VyY2VzQ29udGVudDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBsb2FkUmVzdWx0OiBPbkxvYWRSZXN1bHQgPSB7XG4gICAgICBjb250ZW50czogcG9zdGNzc1Jlc3VsdC5jc3MsXG4gICAgICBsb2FkZXI6ICdjc3MnLFxuICAgIH07XG5cbiAgICBjb25zdCByYXdXYXJuaW5ncyA9IHBvc3Rjc3NSZXN1bHQud2FybmluZ3MoKTtcbiAgICBpZiAocmF3V2FybmluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgbGluZU1hcHBpbmdzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZ1tdIHwgbnVsbD4oKTtcbiAgICAgIGxvYWRSZXN1bHQud2FybmluZ3MgPSByYXdXYXJuaW5ncy5tYXAoKHdhcm5pbmcpID0+IHtcbiAgICAgICAgY29uc3QgZmlsZSA9IHdhcm5pbmcubm9kZS5zb3VyY2U/LmlucHV0LmZpbGU7XG4gICAgICAgIGlmIChmaWxlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZXR1cm4geyB0ZXh0OiB3YXJuaW5nLnRleHQgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBsaW5lcyA9IGxpbmVNYXBwaW5ncy5nZXQoZmlsZSk7XG4gICAgICAgIGlmIChsaW5lcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgbGluZXMgPSB3YXJuaW5nLm5vZGUuc291cmNlPy5pbnB1dC5jc3Muc3BsaXQoL1xccj9cXG4vKTtcbiAgICAgICAgICBsaW5lTWFwcGluZ3Muc2V0KGZpbGUsIGxpbmVzID8/IG51bGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0ZXh0OiB3YXJuaW5nLnRleHQsXG4gICAgICAgICAgbG9jYXRpb246IHtcbiAgICAgICAgICAgIGZpbGUsXG4gICAgICAgICAgICBsaW5lOiB3YXJuaW5nLmxpbmUsXG4gICAgICAgICAgICBjb2x1bW46IHdhcm5pbmcuY29sdW1uIC0gMSxcbiAgICAgICAgICAgIGxpbmVUZXh0OiBsaW5lcz8uW3dhcm5pbmcubGluZSAtIDFdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHJlc3VsdE1lc3NhZ2Ugb2YgcG9zdGNzc1Jlc3VsdC5tZXNzYWdlcykge1xuICAgICAgaWYgKHJlc3VsdE1lc3NhZ2UudHlwZSA9PT0gJ2RlcGVuZGVuY3knICYmIHR5cGVvZiByZXN1bHRNZXNzYWdlWydmaWxlJ10gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGxvYWRSZXN1bHQud2F0Y2hGaWxlcyA/Pz0gW107XG4gICAgICAgIGxvYWRSZXN1bHQud2F0Y2hGaWxlcy5wdXNoKHJlc3VsdE1lc3NhZ2VbJ2ZpbGUnXSk7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICByZXN1bHRNZXNzYWdlLnR5cGUgPT09ICdkaXItZGVwZW5kZW5jeScgJiZcbiAgICAgICAgdHlwZW9mIHJlc3VsdE1lc3NhZ2VbJ2RpciddID09PSAnc3RyaW5nJyAmJlxuICAgICAgICB0eXBlb2YgcmVzdWx0TWVzc2FnZVsnZ2xvYiddID09PSAnc3RyaW5nJ1xuICAgICAgKSB7XG4gICAgICAgIGxvYWRSZXN1bHQud2F0Y2hGaWxlcyA/Pz0gW107XG4gICAgICAgIGNvbnN0IGRlcGVuZGVuY2llcyA9IGF3YWl0IGdsb2IocmVzdWx0TWVzc2FnZVsnZ2xvYiddLCB7XG4gICAgICAgICAgYWJzb2x1dGU6IHRydWUsXG4gICAgICAgICAgY3dkOiByZXN1bHRNZXNzYWdlWydkaXInXSxcbiAgICAgICAgfSk7XG4gICAgICAgIGxvYWRSZXN1bHQud2F0Y2hGaWxlcy5wdXNoKC4uLmRlcGVuZGVuY2llcyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGxvYWRSZXN1bHQ7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcG9zdGNzcyA/Pz0gKGF3YWl0IGltcG9ydCgncG9zdGNzcycpKS5kZWZhdWx0O1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIHBvc3Rjc3MuQ3NzU3ludGF4RXJyb3IpIHtcbiAgICAgIGNvbnN0IGxpbmVzID0gZXJyb3Iuc291cmNlPy5zcGxpdCgvXFxyP1xcbi8pO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0ZXh0OiBlcnJvci5yZWFzb24sXG4gICAgICAgICAgICBsb2NhdGlvbjoge1xuICAgICAgICAgICAgICBmaWxlOiBlcnJvci5maWxlLFxuICAgICAgICAgICAgICBsaW5lOiBlcnJvci5saW5lLFxuICAgICAgICAgICAgICBjb2x1bW46IGVycm9yLmNvbHVtbiAmJiBlcnJvci5jb2x1bW4gLSAxLFxuICAgICAgICAgICAgICBsaW5lVGV4dDogZXJyb3IubGluZSA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogbGluZXM/LltlcnJvci5saW5lIC0gMV0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9O1xuICAgIH1cblxuICAgIHRocm93IGVycm9yO1xuICB9XG59XG4iXX0=