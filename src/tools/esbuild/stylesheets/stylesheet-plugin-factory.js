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
    // Return early if there are no contents to further process
    if (!result.contents) {
        return result;
    }
    // Only use postcss if Tailwind processing is required.
    // NOTE: If postcss is used for more than just Tailwind in the future this check MUST
    // be updated to account for the additional use.
    if (postcssProcessor && !result.errors?.length && hasTailwindKeywords(result.contents)) {
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
 * Searches the provided contents for keywords that indicate Tailwind is used
 * within a stylesheet.
 * @param contents A string or Uint8Array containing UTF-8 text.
 * @returns True, if the contents contains tailwind keywords; False, otherwise.
 */
function hasTailwindKeywords(contents) {
    // TODO: use better search algorithm for keywords
    if (typeof contents === 'string') {
        return TAILWIND_KEYWORDS.some((keyword) => contents.includes(keyword));
    }
    // Contents is a Uint8Array
    const data = contents instanceof Buffer ? contents : Buffer.from(contents);
    return TAILWIND_KEYWORDS.some((keyword) => data.includes(keyword));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldC1wbHVnaW4tZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvc3R5bGVzaGVldHMvc3R5bGVzaGVldC1wbHVnaW4tZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILDBEQUE2QjtBQUM3Qiw4REFBaUM7QUFDakMsK0NBQTRDO0FBQzVDLHlDQUFvQztBQUNwQyw0REFBeUU7QUFFekU7OztHQUdHO0FBQ0gsSUFBSSxPQUEwRCxDQUFDO0FBZ0MvRDs7OztHQUlHO0FBQ0gsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFlNUYsTUFBYSx1QkFBdUI7SUFJZjtJQUNBO0lBSlgsZ0JBQWdCLENBQStCO0lBRXZELFlBQ21CLE9BQWdDLEVBQ2hDLEtBQXVCO1FBRHZCLFlBQU8sR0FBUCxPQUFPLENBQXlCO1FBQ2hDLFVBQUssR0FBTCxLQUFLLENBQWtCO0lBQ3ZDLENBQUM7SUFFSixNQUFNLENBQUMsUUFBc0M7UUFDM0MsdURBQXVEO1FBQ3ZELElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRTtZQUM1RCxPQUFPO2dCQUNMLElBQUksRUFBRSxVQUFVLEdBQUcsUUFBUSxDQUFDLElBQUk7Z0JBQ2hDLEtBQUssS0FBSSxDQUFDO2FBQ1gsQ0FBQztTQUNIO1FBRUQsTUFBTSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDaEMsTUFBTSxZQUFZLEdBQUcsS0FBSyxJQUFJLEVBQUU7WUFDOUIsOENBQThDO1lBQzlDLElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFO2dCQUN6QixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQzthQUM5QjtZQUVELElBQUksT0FBTyxDQUFDLHFCQUFxQixFQUFFO2dCQUNqQyxPQUFPLEtBQUssQ0FBQyx3REFBYSxTQUFTLEdBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztnQkFDOUMsTUFBTSxRQUFRLEdBQUcseUJBQWEsT0FBTyxDQUFDLHFCQUFxQixDQUFDLE9BQU8sdUNBQUMsQ0FBQztnQkFDckUsSUFBSSxDQUFDLGdCQUFnQixHQUFHLE9BQU8sRUFBRSxDQUFDLEdBQUcsQ0FDbkMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FDakUsQ0FBQzthQUNIO1lBRUQsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUM7UUFDL0IsQ0FBQyxDQUFDO1FBRUYsT0FBTztZQUNMLElBQUksRUFBRSxVQUFVLEdBQUcsUUFBUSxDQUFDLElBQUk7WUFDaEMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLO2dCQUNmLDBCQUEwQjtnQkFDMUIsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLFlBQVksRUFBRSxDQUFDO2dCQUU5Qyx5REFBeUQ7Z0JBQ3pELEtBQUssQ0FBQyxNQUFNLENBQ1YsRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLGVBQWUsRUFBRSxTQUFTLEVBQUUsMEJBQTBCLEVBQUUsRUFDM0UsSUFBQSxvQ0FBZ0IsRUFBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTtvQkFDL0IsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUN0RCxJQUFBLHFCQUFNLEVBQ0osT0FBTyxJQUFJLEtBQUssUUFBUSxFQUN4QixnREFBZ0QsSUFBSSxDQUFDLElBQUksR0FBRyxDQUM3RCxDQUFDO29CQUVGLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQUFBRCxFQUFHLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFFckQsT0FBTyxpQkFBaUIsQ0FDdEIsUUFBUSxFQUNSLElBQUksRUFDSixRQUFRLEVBQ1IsTUFBTSxFQUNOLE9BQU8sRUFDUCxLQUFLLEVBQ0wsZ0JBQWdCLENBQ2pCLENBQUM7Z0JBQ0osQ0FBQyxDQUFDLENBQ0gsQ0FBQztnQkFFRixpREFBaUQ7Z0JBQ2pELEtBQUssQ0FBQyxNQUFNLENBQ1YsRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLFVBQVUsRUFBRSxFQUMvQixJQUFBLG9DQUFnQixFQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7b0JBQ3JDLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBQSxtQkFBUSxFQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7b0JBRWhELE9BQU8saUJBQWlCLENBQ3RCLFFBQVEsRUFDUixJQUFJLEVBQ0osSUFBSSxDQUFDLElBQUksRUFDVCxJQUFBLG1CQUFPLEVBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFDekMsT0FBTyxFQUNQLEtBQUssRUFDTCxnQkFBZ0IsQ0FDakIsQ0FBQztnQkFDSixDQUFDLENBQUMsQ0FDSCxDQUFDO1lBQ0osQ0FBQztTQUNGLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFyRkQsMERBcUZDO0FBRUQsS0FBSyxVQUFVLGlCQUFpQixDQUM5QixRQUFzQyxFQUN0QyxJQUFZLEVBQ1osUUFBZ0IsRUFDaEIsTUFBYyxFQUNkLE9BQWdDLEVBQ2hDLEtBQWtCLEVBQ2xCLGdCQUF5RDtJQUV6RCxJQUFJLE1BQW9CLENBQUM7SUFFekIsZ0VBQWdFO0lBQ2hFLElBQUksUUFBUSxDQUFDLE9BQU8sRUFBRTtRQUNwQixNQUFNLEdBQUcsTUFBTSxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztLQUN6RTtTQUFNO1FBQ0wsTUFBTSxHQUFHO1lBQ1AsUUFBUSxFQUFFLElBQUk7WUFDZCxNQUFNLEVBQUUsS0FBSztZQUNiLFVBQVUsRUFBRSxDQUFDLFFBQVEsQ0FBQztTQUN2QixDQUFDO0tBQ0g7SUFFRCwyREFBMkQ7SUFDM0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7UUFDcEIsT0FBTyxNQUFNLENBQUM7S0FDZjtJQUVELHVEQUF1RDtJQUN2RCxxRkFBcUY7SUFDckYsZ0RBQWdEO0lBQ2hELElBQUksZ0JBQWdCLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sSUFBSSxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUU7UUFDdEYsTUFBTSxhQUFhLEdBQUcsTUFBTSxhQUFhLENBQ3ZDLE9BQU8sTUFBTSxDQUFDLFFBQVEsS0FBSyxRQUFRO1lBQ2pDLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUTtZQUNqQixDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUNsRCxRQUFRLEVBQ1IsZ0JBQWdCLEVBQ2hCLE9BQU8sQ0FDUixDQUFDO1FBRUYsZ0JBQWdCO1FBQ2hCLElBQUksYUFBYSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUU7WUFDaEMsT0FBTyxNQUFNLENBQUMsUUFBUSxDQUFDO1NBQ3hCO1FBQ0QsSUFBSSxNQUFNLENBQUMsUUFBUSxJQUFJLGFBQWEsQ0FBQyxRQUFRLEVBQUU7WUFDN0MsYUFBYSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDcEQ7UUFDRCxJQUFJLE1BQU0sQ0FBQyxVQUFVLElBQUksYUFBYSxDQUFDLFVBQVUsRUFBRTtZQUNqRCxhQUFhLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUN4RDtRQUNELElBQUksTUFBTSxDQUFDLFNBQVMsSUFBSSxhQUFhLENBQUMsU0FBUyxFQUFFO1lBQy9DLGFBQWEsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQ3REO1FBQ0QsTUFBTSxHQUFHO1lBQ1AsR0FBRyxNQUFNO1lBQ1QsR0FBRyxhQUFhO1NBQ2pCLENBQUM7S0FDSDtJQUVELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILFNBQVMsbUJBQW1CLENBQUMsUUFBNkI7SUFDeEQsaURBQWlEO0lBQ2pELElBQUksT0FBTyxRQUFRLEtBQUssUUFBUSxFQUFFO1FBQ2hDLE9BQU8saUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7S0FDeEU7SUFFRCwyQkFBMkI7SUFDM0IsTUFBTSxJQUFJLEdBQUcsUUFBUSxZQUFZLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRTNFLE9BQU8saUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDckUsQ0FBQztBQUVEOzs7Ozs7OztHQVFHO0FBQ0gsS0FBSyxVQUFVLGFBQWEsQ0FDMUIsSUFBWSxFQUNaLFFBQWdCLEVBQ2hCLGdCQUE2QyxFQUM3QyxPQUFnQztJQUVoQyxJQUFJO1FBQ0YsTUFBTSxhQUFhLEdBQUcsTUFBTSxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFO1lBQ3pELElBQUksRUFBRSxRQUFRO1lBQ2QsRUFBRSxFQUFFLFFBQVE7WUFDWixHQUFHLEVBQUUsT0FBTyxDQUFDLFNBQVMsSUFBSTtnQkFDeEIsTUFBTSxFQUFFLElBQUk7Z0JBQ1osY0FBYyxFQUFFLElBQUk7YUFDckI7U0FDRixDQUFDLENBQUM7UUFFSCxNQUFNLFVBQVUsR0FBaUI7WUFDL0IsUUFBUSxFQUFFLGFBQWEsQ0FBQyxHQUFHO1lBQzNCLE1BQU0sRUFBRSxLQUFLO1NBQ2QsQ0FBQztRQUVGLE1BQU0sV0FBVyxHQUFHLGFBQWEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUM3QyxJQUFJLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQzFCLE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxFQUEyQixDQUFDO1lBQ3hELFVBQVUsQ0FBQyxRQUFRLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO2dCQUNoRCxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDO2dCQUM3QyxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUU7b0JBQ3RCLE9BQU8sRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDO2lCQUMvQjtnQkFFRCxJQUFJLEtBQUssR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNuQyxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUU7b0JBQ3ZCLEtBQUssR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztvQkFDdEQsWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxJQUFJLElBQUksQ0FBQyxDQUFDO2lCQUN2QztnQkFFRCxPQUFPO29CQUNMLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtvQkFDbEIsUUFBUSxFQUFFO3dCQUNSLElBQUk7d0JBQ0osSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJO3dCQUNsQixNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDO3dCQUMxQixRQUFRLEVBQUUsS0FBSyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7cUJBQ3BDO2lCQUNGLENBQUM7WUFDSixDQUFDLENBQUMsQ0FBQztTQUNKO1FBRUQsS0FBSyxNQUFNLGFBQWEsSUFBSSxhQUFhLENBQUMsUUFBUSxFQUFFO1lBQ2xELElBQUksYUFBYSxDQUFDLElBQUksS0FBSyxZQUFZLElBQUksT0FBTyxhQUFhLENBQUMsTUFBTSxDQUFDLEtBQUssUUFBUSxFQUFFO2dCQUNwRixVQUFVLENBQUMsVUFBVSxLQUFLLEVBQUUsQ0FBQztnQkFDN0IsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7YUFDbkQ7aUJBQU0sSUFDTCxhQUFhLENBQUMsSUFBSSxLQUFLLGdCQUFnQjtnQkFDdkMsT0FBTyxhQUFhLENBQUMsS0FBSyxDQUFDLEtBQUssUUFBUTtnQkFDeEMsT0FBTyxhQUFhLENBQUMsTUFBTSxDQUFDLEtBQUssUUFBUSxFQUN6QztnQkFDQSxVQUFVLENBQUMsVUFBVSxLQUFLLEVBQUUsQ0FBQztnQkFDN0IsTUFBTSxZQUFZLEdBQUcsTUFBTSxJQUFBLG1CQUFJLEVBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxFQUFFO29CQUNyRCxRQUFRLEVBQUUsSUFBSTtvQkFDZCxHQUFHLEVBQUUsYUFBYSxDQUFDLEtBQUssQ0FBQztpQkFDMUIsQ0FBQyxDQUFDO2dCQUNILFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUM7YUFDN0M7U0FDRjtRQUVELE9BQU8sVUFBVSxDQUFDO0tBQ25CO0lBQUMsT0FBTyxLQUFLLEVBQUU7UUFDZCxPQUFPLEtBQUssQ0FBQyx3REFBYSxTQUFTLEdBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztRQUM5QyxJQUFJLEtBQUssWUFBWSxPQUFPLENBQUMsY0FBYyxFQUFFO1lBQzNDLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBRTNDLE9BQU87Z0JBQ0wsTUFBTSxFQUFFO29CQUNOO3dCQUNFLElBQUksRUFBRSxLQUFLLENBQUMsTUFBTTt3QkFDbEIsUUFBUSxFQUFFOzRCQUNSLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTs0QkFDaEIsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJOzRCQUNoQixNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUM7NEJBQ3hDLFFBQVEsRUFBRSxLQUFLLENBQUMsSUFBSSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQzt5QkFDekU7cUJBQ0Y7aUJBQ0Y7YUFDRixDQUFDO1NBQ0g7UUFFRCxNQUFNLEtBQUssQ0FBQztLQUNiO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE9uTG9hZFJlc3VsdCwgUGx1Z2luLCBQbHVnaW5CdWlsZCB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IGdsb2IgZnJvbSAnZmFzdC1nbG9iJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IGV4dG5hbWUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgTG9hZFJlc3VsdENhY2hlLCBjcmVhdGVDYWNoZWRMb2FkIH0gZnJvbSAnLi4vbG9hZC1yZXN1bHQtY2FjaGUnO1xuXG4vKipcbiAqIFRoZSBsYXp5LWxvYWRlZCBpbnN0YW5jZSBvZiB0aGUgcG9zdGNzcyBzdHlsZXNoZWV0IHBvc3Rwcm9jZXNzb3IuXG4gKiBJdCBpcyBvbmx5IGltcG9ydGVkIGFuZCBpbml0aWFsaXplZCBpZiBwb3N0Y3NzIGlzIG5lZWRlZC5cbiAqL1xubGV0IHBvc3Rjc3M6ICh0eXBlb2YgaW1wb3J0KCdwb3N0Y3NzJykpWydkZWZhdWx0J10gfCB1bmRlZmluZWQ7XG5cbi8qKlxuICogQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHBsdWdpbiBvcHRpb25zIHRvIHVzZSB3aGVuIHByb2Nlc3Npbmcgc3R5bGVzaGVldHMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMge1xuICAvKipcbiAgICogQ29udHJvbHMgdGhlIHVzZSBhbmQgY3JlYXRpb24gb2Ygc291cmNlbWFwcyB3aGVuIHByb2Nlc3NpbmcgdGhlIHN0eWxlc2hlZXRzLlxuICAgKiBJZiB0cnVlLCBzb3VyY2VtYXAgcHJvY2Vzc2luZyBpcyBlbmFibGVkOyBpZiBmYWxzZSwgZGlzYWJsZWQuXG4gICAqL1xuICBzb3VyY2VtYXA6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEFuIG9wdGlvbmFsIGFycmF5IG9mIHBhdGhzIHRoYXQgd2lsbCBiZSBzZWFyY2hlZCBmb3Igc3R5bGVzaGVldHMgaWYgdGhlIGRlZmF1bHRcbiAgICogcmVzb2x1dGlvbiBwcm9jZXNzIGZvciB0aGUgc3R5bGVzaGVldCBsYW5ndWFnZSBkb2VzIG5vdCBzdWNjZWVkLlxuICAgKi9cbiAgaW5jbHVkZVBhdGhzPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIE9wdGlvbmFsIGNvbXBvbmVudCBkYXRhIGZvciBhbnkgaW5saW5lIHN0eWxlcyBmcm9tIENvbXBvbmVudCBkZWNvcmF0b3IgYHN0eWxlc2AgZmllbGRzLlxuICAgKiBUaGUga2V5IGlzIGFuIGludGVybmFsIGFuZ3VsYXIgcmVzb3VyY2UgVVJJIGFuZCB0aGUgdmFsdWUgaXMgdGhlIHN0eWxlc2hlZXQgY29udGVudC5cbiAgICovXG4gIGlubGluZUNvbXBvbmVudERhdGE/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuXG4gIC8qKlxuICAgKiBPcHRpb25hbCBpbmZvcm1hdGlvbiB1c2VkIHRvIGxvYWQgYW5kIGNvbmZpZ3VyZSBUYWlsd2luZCBDU1MuIElmIHByZXNlbnQsIHRoZSBwb3N0Y3NzXG4gICAqIHdpbGwgYmUgYWRkZWQgdG8gdGhlIHN0eWxlc2hlZXQgcHJvY2Vzc2luZyB3aXRoIHRoZSBUYWlsd2luZCBwbHVnaW4gc2V0dXAgYXMgcHJvdmlkZWRcbiAgICogYnkgdGhlIGNvbmZpZ3VyYXRpb24gZmlsZS5cbiAgICovXG4gIHRhaWx3aW5kQ29uZmlndXJhdGlvbj86IHsgZmlsZTogc3RyaW5nOyBwYWNrYWdlOiBzdHJpbmcgfTtcbn1cblxuLyoqXG4gKiBBbiBhcnJheSBvZiBrZXl3b3JkcyB0aGF0IGluZGljYXRlIFRhaWx3aW5kIENTUyBwcm9jZXNzaW5nIGlzIHJlcXVpcmVkIGZvciBhIHN0eWxlc2hlZXQuXG4gKlxuICogQmFzZWQgb24gaHR0cHM6Ly90YWlsd2luZGNzcy5jb20vZG9jcy9mdW5jdGlvbnMtYW5kLWRpcmVjdGl2ZXNcbiAqL1xuY29uc3QgVEFJTFdJTkRfS0VZV09SRFMgPSBbJ0B0YWlsd2luZCcsICdAbGF5ZXInLCAnQGFwcGx5JywgJ0Bjb25maWcnLCAndGhlbWUoJywgJ3NjcmVlbignXTtcblxuZXhwb3J0IGludGVyZmFjZSBTdHlsZXNoZWV0TGFuZ3VhZ2Uge1xuICBuYW1lOiBzdHJpbmc7XG4gIGNvbXBvbmVudEZpbHRlcjogUmVnRXhwO1xuICBmaWxlRmlsdGVyOiBSZWdFeHA7XG4gIHByb2Nlc3M/KFxuICAgIGRhdGE6IHN0cmluZyxcbiAgICBmaWxlOiBzdHJpbmcsXG4gICAgZm9ybWF0OiBzdHJpbmcsXG4gICAgb3B0aW9uczogU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMsXG4gICAgYnVpbGQ6IFBsdWdpbkJ1aWxkLFxuICApOiBPbkxvYWRSZXN1bHQgfCBQcm9taXNlPE9uTG9hZFJlc3VsdD47XG59XG5cbmV4cG9ydCBjbGFzcyBTdHlsZXNoZWV0UGx1Z2luRmFjdG9yeSB7XG4gIHByaXZhdGUgcG9zdGNzc1Byb2Nlc3Nvcj86IGltcG9ydCgncG9zdGNzcycpLlByb2Nlc3NvcjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM6IFN0eWxlc2hlZXRQbHVnaW5PcHRpb25zLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY2FjaGU/OiBMb2FkUmVzdWx0Q2FjaGUsXG4gICkge31cblxuICBjcmVhdGUobGFuZ3VhZ2U6IFJlYWRvbmx5PFN0eWxlc2hlZXRMYW5ndWFnZT4pOiBQbHVnaW4ge1xuICAgIC8vIFJldHVybiBhIG5vb3AgcGx1Z2luIGlmIG5vIGxvYWQgYWN0aW9ucyBhcmUgcmVxdWlyZWRcbiAgICBpZiAoIWxhbmd1YWdlLnByb2Nlc3MgJiYgIXRoaXMub3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24pIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6ICdhbmd1bGFyLScgKyBsYW5ndWFnZS5uYW1lLFxuICAgICAgICBzZXR1cCgpIHt9LFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGNhY2hlLCBvcHRpb25zIH0gPSB0aGlzO1xuICAgIGNvbnN0IHNldHVwUG9zdGNzcyA9IGFzeW5jICgpID0+IHtcbiAgICAgIC8vIFJldHVybiBhbHJlYWR5IGNyZWF0ZWQgcHJvY2Vzc29yIGlmIHByZXNlbnRcbiAgICAgIGlmICh0aGlzLnBvc3Rjc3NQcm9jZXNzb3IpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucG9zdGNzc1Byb2Nlc3NvcjtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMudGFpbHdpbmRDb25maWd1cmF0aW9uKSB7XG4gICAgICAgIHBvc3Rjc3MgPz89IChhd2FpdCBpbXBvcnQoJ3Bvc3Rjc3MnKSkuZGVmYXVsdDtcbiAgICAgICAgY29uc3QgdGFpbHdpbmQgPSBhd2FpdCBpbXBvcnQob3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24ucGFja2FnZSk7XG4gICAgICAgIHRoaXMucG9zdGNzc1Byb2Nlc3NvciA9IHBvc3Rjc3MoKS51c2UoXG4gICAgICAgICAgdGFpbHdpbmQuZGVmYXVsdCh7IGNvbmZpZzogb3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24uZmlsZSB9KSxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMucG9zdGNzc1Byb2Nlc3NvcjtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIG5hbWU6ICdhbmd1bGFyLScgKyBsYW5ndWFnZS5uYW1lLFxuICAgICAgYXN5bmMgc2V0dXAoYnVpbGQpIHtcbiAgICAgICAgLy8gU2V0dXAgcG9zdGNzcyBpZiBuZWVkZWRcbiAgICAgICAgY29uc3QgcG9zdGNzc1Byb2Nlc3NvciA9IGF3YWl0IHNldHVwUG9zdGNzcygpO1xuXG4gICAgICAgIC8vIEFkZCBhIGxvYWQgY2FsbGJhY2sgdG8gc3VwcG9ydCBpbmxpbmUgQ29tcG9uZW50IHN0eWxlc1xuICAgICAgICBidWlsZC5vbkxvYWQoXG4gICAgICAgICAgeyBmaWx0ZXI6IGxhbmd1YWdlLmNvbXBvbmVudEZpbHRlciwgbmFtZXNwYWNlOiAnYW5ndWxhcjpzdHlsZXMvY29tcG9uZW50JyB9LFxuICAgICAgICAgIGNyZWF0ZUNhY2hlZExvYWQoY2FjaGUsIChhcmdzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gb3B0aW9ucy5pbmxpbmVDb21wb25lbnREYXRhPy5bYXJncy5wYXRoXTtcbiAgICAgICAgICAgIGFzc2VydChcbiAgICAgICAgICAgICAgdHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnLFxuICAgICAgICAgICAgICBgY29tcG9uZW50IHN0eWxlIG5hbWUgc2hvdWxkIGFsd2F5cyBiZSBmb3VuZCBbJHthcmdzLnBhdGh9XWAsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBjb25zdCBbZm9ybWF0LCAsIGZpbGVuYW1lXSA9IGFyZ3MucGF0aC5zcGxpdCgnOycsIDMpO1xuXG4gICAgICAgICAgICByZXR1cm4gcHJvY2Vzc1N0eWxlc2hlZXQoXG4gICAgICAgICAgICAgIGxhbmd1YWdlLFxuICAgICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgICBmaWxlbmFtZSxcbiAgICAgICAgICAgICAgZm9ybWF0LFxuICAgICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgICBidWlsZCxcbiAgICAgICAgICAgICAgcG9zdGNzc1Byb2Nlc3NvcixcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSksXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gQWRkIGEgbG9hZCBjYWxsYmFjayB0byBzdXBwb3J0IGZpbGVzIGZyb20gZGlza1xuICAgICAgICBidWlsZC5vbkxvYWQoXG4gICAgICAgICAgeyBmaWx0ZXI6IGxhbmd1YWdlLmZpbGVGaWx0ZXIgfSxcbiAgICAgICAgICBjcmVhdGVDYWNoZWRMb2FkKGNhY2hlLCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlYWRGaWxlKGFyZ3MucGF0aCwgJ3V0Zi04Jyk7XG5cbiAgICAgICAgICAgIHJldHVybiBwcm9jZXNzU3R5bGVzaGVldChcbiAgICAgICAgICAgICAgbGFuZ3VhZ2UsXG4gICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgIGFyZ3MucGF0aCxcbiAgICAgICAgICAgICAgZXh0bmFtZShhcmdzLnBhdGgpLnRvTG93ZXJDYXNlKCkuc2xpY2UoMSksXG4gICAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICAgIGJ1aWxkLFxuICAgICAgICAgICAgICBwb3N0Y3NzUHJvY2Vzc29yLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KSxcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBwcm9jZXNzU3R5bGVzaGVldChcbiAgbGFuZ3VhZ2U6IFJlYWRvbmx5PFN0eWxlc2hlZXRMYW5ndWFnZT4sXG4gIGRhdGE6IHN0cmluZyxcbiAgZmlsZW5hbWU6IHN0cmluZyxcbiAgZm9ybWF0OiBzdHJpbmcsXG4gIG9wdGlvbnM6IFN0eWxlc2hlZXRQbHVnaW5PcHRpb25zLFxuICBidWlsZDogUGx1Z2luQnVpbGQsXG4gIHBvc3Rjc3NQcm9jZXNzb3I6IGltcG9ydCgncG9zdGNzcycpLlByb2Nlc3NvciB8IHVuZGVmaW5lZCxcbikge1xuICBsZXQgcmVzdWx0OiBPbkxvYWRSZXN1bHQ7XG5cbiAgLy8gUHJvY2VzcyB0aGUgaW5wdXQgZGF0YSBpZiB0aGUgbGFuZ3VhZ2UgcmVxdWlyZXMgcHJlcHJvY2Vzc2luZ1xuICBpZiAobGFuZ3VhZ2UucHJvY2Vzcykge1xuICAgIHJlc3VsdCA9IGF3YWl0IGxhbmd1YWdlLnByb2Nlc3MoZGF0YSwgZmlsZW5hbWUsIGZvcm1hdCwgb3B0aW9ucywgYnVpbGQpO1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdCA9IHtcbiAgICAgIGNvbnRlbnRzOiBkYXRhLFxuICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgIHdhdGNoRmlsZXM6IFtmaWxlbmFtZV0sXG4gICAgfTtcbiAgfVxuXG4gIC8vIFJldHVybiBlYXJseSBpZiB0aGVyZSBhcmUgbm8gY29udGVudHMgdG8gZnVydGhlciBwcm9jZXNzXG4gIGlmICghcmVzdWx0LmNvbnRlbnRzKSB7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIE9ubHkgdXNlIHBvc3Rjc3MgaWYgVGFpbHdpbmQgcHJvY2Vzc2luZyBpcyByZXF1aXJlZC5cbiAgLy8gTk9URTogSWYgcG9zdGNzcyBpcyB1c2VkIGZvciBtb3JlIHRoYW4ganVzdCBUYWlsd2luZCBpbiB0aGUgZnV0dXJlIHRoaXMgY2hlY2sgTVVTVFxuICAvLyBiZSB1cGRhdGVkIHRvIGFjY291bnQgZm9yIHRoZSBhZGRpdGlvbmFsIHVzZS5cbiAgaWYgKHBvc3Rjc3NQcm9jZXNzb3IgJiYgIXJlc3VsdC5lcnJvcnM/Lmxlbmd0aCAmJiBoYXNUYWlsd2luZEtleXdvcmRzKHJlc3VsdC5jb250ZW50cykpIHtcbiAgICBjb25zdCBwb3N0Y3NzUmVzdWx0ID0gYXdhaXQgY29tcGlsZVN0cmluZyhcbiAgICAgIHR5cGVvZiByZXN1bHQuY29udGVudHMgPT09ICdzdHJpbmcnXG4gICAgICAgID8gcmVzdWx0LmNvbnRlbnRzXG4gICAgICAgIDogQnVmZmVyLmZyb20ocmVzdWx0LmNvbnRlbnRzKS50b1N0cmluZygndXRmLTgnKSxcbiAgICAgIGZpbGVuYW1lLFxuICAgICAgcG9zdGNzc1Byb2Nlc3NvcixcbiAgICAgIG9wdGlvbnMsXG4gICAgKTtcblxuICAgIC8vIE1lcmdlIHJlc3VsdHNcbiAgICBpZiAocG9zdGNzc1Jlc3VsdC5lcnJvcnM/Lmxlbmd0aCkge1xuICAgICAgZGVsZXRlIHJlc3VsdC5jb250ZW50cztcbiAgICB9XG4gICAgaWYgKHJlc3VsdC53YXJuaW5ncyAmJiBwb3N0Y3NzUmVzdWx0Lndhcm5pbmdzKSB7XG4gICAgICBwb3N0Y3NzUmVzdWx0Lndhcm5pbmdzLnVuc2hpZnQoLi4ucmVzdWx0Lndhcm5pbmdzKTtcbiAgICB9XG4gICAgaWYgKHJlc3VsdC53YXRjaEZpbGVzICYmIHBvc3Rjc3NSZXN1bHQud2F0Y2hGaWxlcykge1xuICAgICAgcG9zdGNzc1Jlc3VsdC53YXRjaEZpbGVzLnVuc2hpZnQoLi4ucmVzdWx0LndhdGNoRmlsZXMpO1xuICAgIH1cbiAgICBpZiAocmVzdWx0LndhdGNoRGlycyAmJiBwb3N0Y3NzUmVzdWx0LndhdGNoRGlycykge1xuICAgICAgcG9zdGNzc1Jlc3VsdC53YXRjaERpcnMudW5zaGlmdCguLi5yZXN1bHQud2F0Y2hEaXJzKTtcbiAgICB9XG4gICAgcmVzdWx0ID0ge1xuICAgICAgLi4ucmVzdWx0LFxuICAgICAgLi4ucG9zdGNzc1Jlc3VsdCxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBTZWFyY2hlcyB0aGUgcHJvdmlkZWQgY29udGVudHMgZm9yIGtleXdvcmRzIHRoYXQgaW5kaWNhdGUgVGFpbHdpbmQgaXMgdXNlZFxuICogd2l0aGluIGEgc3R5bGVzaGVldC5cbiAqIEBwYXJhbSBjb250ZW50cyBBIHN0cmluZyBvciBVaW50OEFycmF5IGNvbnRhaW5pbmcgVVRGLTggdGV4dC5cbiAqIEByZXR1cm5zIFRydWUsIGlmIHRoZSBjb250ZW50cyBjb250YWlucyB0YWlsd2luZCBrZXl3b3JkczsgRmFsc2UsIG90aGVyd2lzZS5cbiAqL1xuZnVuY3Rpb24gaGFzVGFpbHdpbmRLZXl3b3Jkcyhjb250ZW50czogc3RyaW5nIHwgVWludDhBcnJheSk6IGJvb2xlYW4ge1xuICAvLyBUT0RPOiB1c2UgYmV0dGVyIHNlYXJjaCBhbGdvcml0aG0gZm9yIGtleXdvcmRzXG4gIGlmICh0eXBlb2YgY29udGVudHMgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIFRBSUxXSU5EX0tFWVdPUkRTLnNvbWUoKGtleXdvcmQpID0+IGNvbnRlbnRzLmluY2x1ZGVzKGtleXdvcmQpKTtcbiAgfVxuXG4gIC8vIENvbnRlbnRzIGlzIGEgVWludDhBcnJheVxuICBjb25zdCBkYXRhID0gY29udGVudHMgaW5zdGFuY2VvZiBCdWZmZXIgPyBjb250ZW50cyA6IEJ1ZmZlci5mcm9tKGNvbnRlbnRzKTtcblxuICByZXR1cm4gVEFJTFdJTkRfS0VZV09SRFMuc29tZSgoa2V5d29yZCkgPT4gZGF0YS5pbmNsdWRlcyhrZXl3b3JkKSk7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIHByb3ZpZGVkIENTUyBzdHlsZXNoZWV0IGRhdGEgdXNpbmcgYSBwcm92aWRlZCBwb3N0Y3NzIHByb2Nlc3NvciBhbmQgcHJvdmlkZXMgYW5cbiAqIGVzYnVpbGQgbG9hZCByZXN1bHQgdGhhdCBjYW4gYmUgdXNlZCBkaXJlY3RseSBieSBhbiBlc2J1aWxkIFBsdWdpbi5cbiAqIEBwYXJhbSBkYXRhIFRoZSBzdHlsZXNoZWV0IGNvbnRlbnQgdG8gcHJvY2Vzcy5cbiAqIEBwYXJhbSBmaWxlbmFtZSBUaGUgbmFtZSBvZiB0aGUgZmlsZSB0aGF0IGNvbnRhaW5zIHRoZSBkYXRhLlxuICogQHBhcmFtIHBvc3Rjc3NQcm9jZXNzb3IgQSBwb3N0Y3NzIHByb2Nlc3NvciBpbnN0YW5jZSB0byB1c2UuXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgcGx1Z2luIG9wdGlvbnMgdG8gY29udHJvbCB0aGUgcHJvY2Vzc2luZy5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgT25Mb2FkZXJSZXN1bHQgb2JqZWN0IHdpdGggdGhlIHByb2Nlc3NlZCBjb250ZW50LCB3YXJuaW5ncywgYW5kL29yIGVycm9ycy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gY29tcGlsZVN0cmluZyhcbiAgZGF0YTogc3RyaW5nLFxuICBmaWxlbmFtZTogc3RyaW5nLFxuICBwb3N0Y3NzUHJvY2Vzc29yOiBpbXBvcnQoJ3Bvc3Rjc3MnKS5Qcm9jZXNzb3IsXG4gIG9wdGlvbnM6IFN0eWxlc2hlZXRQbHVnaW5PcHRpb25zLFxuKTogUHJvbWlzZTxPbkxvYWRSZXN1bHQ+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBwb3N0Y3NzUmVzdWx0ID0gYXdhaXQgcG9zdGNzc1Byb2Nlc3Nvci5wcm9jZXNzKGRhdGEsIHtcbiAgICAgIGZyb206IGZpbGVuYW1lLFxuICAgICAgdG86IGZpbGVuYW1lLFxuICAgICAgbWFwOiBvcHRpb25zLnNvdXJjZW1hcCAmJiB7XG4gICAgICAgIGlubGluZTogdHJ1ZSxcbiAgICAgICAgc291cmNlc0NvbnRlbnQ6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgbG9hZFJlc3VsdDogT25Mb2FkUmVzdWx0ID0ge1xuICAgICAgY29udGVudHM6IHBvc3Rjc3NSZXN1bHQuY3NzLFxuICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICB9O1xuXG4gICAgY29uc3QgcmF3V2FybmluZ3MgPSBwb3N0Y3NzUmVzdWx0Lndhcm5pbmdzKCk7XG4gICAgaWYgKHJhd1dhcm5pbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGxpbmVNYXBwaW5ncyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXSB8IG51bGw+KCk7XG4gICAgICBsb2FkUmVzdWx0Lndhcm5pbmdzID0gcmF3V2FybmluZ3MubWFwKCh3YXJuaW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSB3YXJuaW5nLm5vZGUuc291cmNlPy5pbnB1dC5maWxlO1xuICAgICAgICBpZiAoZmlsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcmV0dXJuIHsgdGV4dDogd2FybmluZy50ZXh0IH07XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgbGluZXMgPSBsaW5lTWFwcGluZ3MuZ2V0KGZpbGUpO1xuICAgICAgICBpZiAobGluZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGxpbmVzID0gd2FybmluZy5ub2RlLnNvdXJjZT8uaW5wdXQuY3NzLnNwbGl0KC9cXHI/XFxuLyk7XG4gICAgICAgICAgbGluZU1hcHBpbmdzLnNldChmaWxlLCBsaW5lcyA/PyBudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdGV4dDogd2FybmluZy50ZXh0LFxuICAgICAgICAgIGxvY2F0aW9uOiB7XG4gICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgbGluZTogd2FybmluZy5saW5lLFxuICAgICAgICAgICAgY29sdW1uOiB3YXJuaW5nLmNvbHVtbiAtIDEsXG4gICAgICAgICAgICBsaW5lVGV4dDogbGluZXM/Llt3YXJuaW5nLmxpbmUgLSAxXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCByZXN1bHRNZXNzYWdlIG9mIHBvc3Rjc3NSZXN1bHQubWVzc2FnZXMpIHtcbiAgICAgIGlmIChyZXN1bHRNZXNzYWdlLnR5cGUgPT09ICdkZXBlbmRlbmN5JyAmJiB0eXBlb2YgcmVzdWx0TWVzc2FnZVsnZmlsZSddID09PSAnc3RyaW5nJykge1xuICAgICAgICBsb2FkUmVzdWx0LndhdGNoRmlsZXMgPz89IFtdO1xuICAgICAgICBsb2FkUmVzdWx0LndhdGNoRmlsZXMucHVzaChyZXN1bHRNZXNzYWdlWydmaWxlJ10pO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgcmVzdWx0TWVzc2FnZS50eXBlID09PSAnZGlyLWRlcGVuZGVuY3knICYmXG4gICAgICAgIHR5cGVvZiByZXN1bHRNZXNzYWdlWydkaXInXSA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgdHlwZW9mIHJlc3VsdE1lc3NhZ2VbJ2dsb2InXSA9PT0gJ3N0cmluZydcbiAgICAgICkge1xuICAgICAgICBsb2FkUmVzdWx0LndhdGNoRmlsZXMgPz89IFtdO1xuICAgICAgICBjb25zdCBkZXBlbmRlbmNpZXMgPSBhd2FpdCBnbG9iKHJlc3VsdE1lc3NhZ2VbJ2dsb2InXSwge1xuICAgICAgICAgIGFic29sdXRlOiB0cnVlLFxuICAgICAgICAgIGN3ZDogcmVzdWx0TWVzc2FnZVsnZGlyJ10sXG4gICAgICAgIH0pO1xuICAgICAgICBsb2FkUmVzdWx0LndhdGNoRmlsZXMucHVzaCguLi5kZXBlbmRlbmNpZXMpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBsb2FkUmVzdWx0O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHBvc3Rjc3MgPz89IChhd2FpdCBpbXBvcnQoJ3Bvc3Rjc3MnKSkuZGVmYXVsdDtcbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBwb3N0Y3NzLkNzc1N5bnRheEVycm9yKSB7XG4gICAgICBjb25zdCBsaW5lcyA9IGVycm9yLnNvdXJjZT8uc3BsaXQoL1xccj9cXG4vKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdGV4dDogZXJyb3IucmVhc29uLFxuICAgICAgICAgICAgbG9jYXRpb246IHtcbiAgICAgICAgICAgICAgZmlsZTogZXJyb3IuZmlsZSxcbiAgICAgICAgICAgICAgbGluZTogZXJyb3IubGluZSxcbiAgICAgICAgICAgICAgY29sdW1uOiBlcnJvci5jb2x1bW4gJiYgZXJyb3IuY29sdW1uIC0gMSxcbiAgICAgICAgICAgICAgbGluZVRleHQ6IGVycm9yLmxpbmUgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IGxpbmVzPy5bZXJyb3IubGluZSAtIDFdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuIl19