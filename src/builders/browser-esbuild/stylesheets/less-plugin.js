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
exports.createLessPlugin = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const promises_1 = require("node:fs/promises");
const load_result_cache_1 = require("../load-result-cache");
/**
 * The lazy-loaded instance of the less stylesheet preprocessor.
 * It is only imported and initialized if a less stylesheet is used.
 */
let lessPreprocessor;
function isLessException(error) {
    return !!error && typeof error === 'object' && 'column' in error;
}
function createLessPlugin(options, cache) {
    return {
        name: 'angular-less',
        setup(build) {
            // Add a load callback to support inline Component styles
            build.onLoad({ filter: /^less;/, namespace: 'angular:styles/component' }, (0, load_result_cache_1.createCachedLoad)(cache, async (args) => {
                const data = options.inlineComponentData?.[args.path];
                (0, node_assert_1.default)(typeof data === 'string', `component style name should always be found [${args.path}]`);
                const [, , filePath] = args.path.split(';', 3);
                return compileString(data, filePath, options, build.resolve.bind(build));
            }));
            // Add a load callback to support files from disk
            build.onLoad({ filter: /\.less$/ }, (0, load_result_cache_1.createCachedLoad)(cache, async (args) => {
                const data = await (0, promises_1.readFile)(args.path, 'utf-8');
                return compileString(data, args.path, options, build.resolve.bind(build));
            }));
        },
    };
}
exports.createLessPlugin = createLessPlugin;
async function compileString(data, filename, options, resolver) {
    const less = (lessPreprocessor ?? (lessPreprocessor = (await Promise.resolve().then(() => __importStar(require('less')))).default));
    const resolverPlugin = {
        install({ FileManager }, pluginManager) {
            const resolverFileManager = new (class extends FileManager {
                supportsSync() {
                    return false;
                }
                supports() {
                    return true;
                }
                async loadFile(filename, currentDirectory, options, environment) {
                    // Attempt direct loading as a relative path to avoid resolution overhead
                    try {
                        return await super.loadFile(filename, currentDirectory, options, environment);
                    }
                    catch (error) {
                        // Attempt a full resolution if not found
                        const fullResult = await resolver(filename, {
                            kind: 'import-rule',
                            resolveDir: currentDirectory,
                        });
                        if (fullResult.path) {
                            return {
                                filename: fullResult.path,
                                contents: await (0, promises_1.readFile)(fullResult.path, 'utf-8'),
                            };
                        }
                        // Otherwise error by throwing the failing direct result
                        throw error;
                    }
                }
            })();
            pluginManager.addFileManager(resolverFileManager);
        },
    };
    try {
        const result = await less.render(data, {
            filename,
            paths: options.includePaths,
            plugins: [resolverPlugin],
            rewriteUrls: 'all',
            sourceMap: options.sourcemap
                ? {
                    sourceMapFileInline: true,
                    outputSourceFiles: true,
                }
                : undefined,
        });
        return {
            contents: result.css,
            loader: 'css',
            watchFiles: [filename, ...result.imports],
        };
    }
    catch (error) {
        if (isLessException(error)) {
            return {
                errors: [
                    {
                        text: error.message,
                        location: {
                            file: error.filename,
                            line: error.line,
                            column: error.column,
                            // Middle element represents the line containing the error
                            lineText: error.extract && error.extract[Math.trunc(error.extract.length / 2)],
                        },
                    },
                ],
                loader: 'css',
            };
        }
        throw error;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGVzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc3R5bGVzaGVldHMvbGVzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCw4REFBaUM7QUFDakMsK0NBQTRDO0FBQzVDLDREQUF5RTtBQUV6RTs7O0dBR0c7QUFDSCxJQUFJLGdCQUFtRCxDQUFDO0FBZXhELFNBQVMsZUFBZSxDQUFDLEtBQWM7SUFDckMsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxRQUFRLElBQUksS0FBSyxDQUFDO0FBQ25FLENBQUM7QUFFRCxTQUFnQixnQkFBZ0IsQ0FBQyxPQUEwQixFQUFFLEtBQXVCO0lBQ2xGLE9BQU87UUFDTCxJQUFJLEVBQUUsY0FBYztRQUNwQixLQUFLLENBQUMsS0FBa0I7WUFDdEIseURBQXlEO1lBQ3pELEtBQUssQ0FBQyxNQUFNLENBQ1YsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSwwQkFBMEIsRUFBRSxFQUMzRCxJQUFBLG9DQUFnQixFQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7Z0JBQ3JDLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDdEQsSUFBQSxxQkFBTSxFQUNKLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFDeEIsZ0RBQWdELElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FDN0QsQ0FBQztnQkFFRixNQUFNLENBQUMsRUFBRSxBQUFELEVBQUcsUUFBUSxDQUFDLEdBQUcsSUFBSSxDQUFDLElB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QUNILENBQUMsQ0FBQyxTQUFTO1NBQ0UsQ0FBQyxDQUFDO1FBRW5CLE9BQU87WUFDTCxRQUFRLEVBQUUsTUFBTSxDQUFDLEdBQUc7WUFDcEIsTUFBTSxFQUFFLEtBQUs7WUFDYixVQUFVLEVBQUUsQ0FBQyxRQUFRLEVBQUUsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDO1NBQzFDLENBQUM7S0FDSDtJQUFDLE9BQU8sS0FBSyxFQUFFO1FBQ2QsSUFBSSxlQUFlLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDMUIsT0FBTztnQkFDTCxNQUFNLEVBQUU7b0JBQ047d0JBQ0UsSUFBSSxFQUFFLEtBQUssQ0FBQyxPQUFPO3dCQUNuQixRQUFRLEVBQUU7NEJBQ1IsSUFBSSxFQUFFLEtBQUssQ0FBQyxRQUFROzRCQUNwQixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7NEJBQ2hCLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTTs0QkFDcEIsMERBQTBEOzRCQUMxRCxRQUFRLEVBQUUsS0FBSyxDQUFDLE9BQU8sSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7eUJBQy9FO3FCQUNGO2lCQUNGO2dCQUNELE1BQU0sRUFBRSxLQUFLO2FBQ2QsQ0FBQztTQUNIO1FBRUQsTUFBTSxLQUFLLENBQUM7S0FDYjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBPbkxvYWRSZXN1bHQsIFBsdWdpbiwgUGx1Z2luQnVpbGQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IExvYWRSZXN1bHRDYWNoZSwgY3JlYXRlQ2FjaGVkTG9hZCB9IGZyb20gJy4uL2xvYWQtcmVzdWx0LWNhY2hlJztcblxuLyoqXG4gKiBUaGUgbGF6eS1sb2FkZWQgaW5zdGFuY2Ugb2YgdGhlIGxlc3Mgc3R5bGVzaGVldCBwcmVwcm9jZXNzb3IuXG4gKiBJdCBpcyBvbmx5IGltcG9ydGVkIGFuZCBpbml0aWFsaXplZCBpZiBhIGxlc3Mgc3R5bGVzaGVldCBpcyB1c2VkLlxuICovXG5sZXQgbGVzc1ByZXByb2Nlc3NvcjogdHlwZW9mIGltcG9ydCgnbGVzcycpIHwgdW5kZWZpbmVkO1xuXG5leHBvcnQgaW50ZXJmYWNlIExlc3NQbHVnaW5PcHRpb25zIHtcbiAgc291cmNlbWFwOiBib29sZWFuO1xuICBpbmNsdWRlUGF0aHM/OiBzdHJpbmdbXTtcbiAgaW5saW5lQ29tcG9uZW50RGF0YT86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG59XG5cbmludGVyZmFjZSBMZXNzRXhjZXB0aW9uIGV4dGVuZHMgRXJyb3Ige1xuICBmaWxlbmFtZTogc3RyaW5nO1xuICBsaW5lOiBudW1iZXI7XG4gIGNvbHVtbjogbnVtYmVyO1xuICBleHRyYWN0Pzogc3RyaW5nW107XG59XG5cbmZ1bmN0aW9uIGlzTGVzc0V4Y2VwdGlvbihlcnJvcjogdW5rbm93bik6IGVycm9yIGlzIExlc3NFeGNlcHRpb24ge1xuICByZXR1cm4gISFlcnJvciAmJiB0eXBlb2YgZXJyb3IgPT09ICdvYmplY3QnICYmICdjb2x1bW4nIGluIGVycm9yO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTGVzc1BsdWdpbihvcHRpb25zOiBMZXNzUGx1Z2luT3B0aW9ucywgY2FjaGU/OiBMb2FkUmVzdWx0Q2FjaGUpOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLWxlc3MnLFxuICAgIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IHZvaWQge1xuICAgICAgLy8gQWRkIGEgbG9hZCBjYWxsYmFjayB0byBzdXBwb3J0IGlubGluZSBDb21wb25lbnQgc3R5bGVzXG4gICAgICBidWlsZC5vbkxvYWQoXG4gICAgICAgIHsgZmlsdGVyOiAvXmxlc3M7LywgbmFtZXNwYWNlOiAnYW5ndWxhcjpzdHlsZXMvY29tcG9uZW50JyB9LFxuICAgICAgICBjcmVhdGVDYWNoZWRMb2FkKGNhY2hlLCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAgIGNvbnN0IGRhdGEgPSBvcHRpb25zLmlubGluZUNvbXBvbmVudERhdGE/LlthcmdzLnBhdGhdO1xuICAgICAgICAgIGFzc2VydChcbiAgICAgICAgICAgIHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJyxcbiAgICAgICAgICAgIGBjb21wb25lbnQgc3R5bGUgbmFtZSBzaG91bGQgYWx3YXlzIGJlIGZvdW5kIFske2FyZ3MucGF0aH1dYCxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgY29uc3QgWywgLCBmaWxlUGF0aF0gPSBhcmdzLnBhdGguc3BsaXQoJzsnLCAzKTtcblxuICAgICAgICAgIHJldHVybiBjb21waWxlU3RyaW5nKGRhdGEsIGZpbGVQYXRoLCBvcHRpb25zLCBidWlsZC5yZXNvbHZlLmJpbmQoYnVpbGQpKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgICAvLyBBZGQgYSBsb2FkIGNhbGxiYWNrIHRvIHN1cHBvcnQgZmlsZXMgZnJvbSBkaXNrXG4gICAgICBidWlsZC5vbkxvYWQoXG4gICAgICAgIHsgZmlsdGVyOiAvXFwubGVzcyQvIH0sXG4gICAgICAgIGNyZWF0ZUNhY2hlZExvYWQoY2FjaGUsIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlYWRGaWxlKGFyZ3MucGF0aCwgJ3V0Zi04Jyk7XG5cbiAgICAgICAgICByZXR1cm4gY29tcGlsZVN0cmluZyhkYXRhLCBhcmdzLnBhdGgsIG9wdGlvbnMsIGJ1aWxkLnJlc29sdmUuYmluZChidWlsZCkpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfSxcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gY29tcGlsZVN0cmluZyhcbiAgZGF0YTogc3RyaW5nLFxuICBmaWxlbmFtZTogc3RyaW5nLFxuICBvcHRpb25zOiBMZXNzUGx1Z2luT3B0aW9ucyxcbiAgcmVzb2x2ZXI6IFBsdWdpbkJ1aWxkWydyZXNvbHZlJ10sXG4pOiBQcm9taXNlPE9uTG9hZFJlc3VsdD4ge1xuICBjb25zdCBsZXNzID0gKGxlc3NQcmVwcm9jZXNzb3IgPz89IChhd2FpdCBpbXBvcnQoJ2xlc3MnKSkuZGVmYXVsdCk7XG5cbiAgY29uc3QgcmVzb2x2ZXJQbHVnaW46IExlc3MuUGx1Z2luID0ge1xuICAgIGluc3RhbGwoeyBGaWxlTWFuYWdlciB9LCBwbHVnaW5NYW5hZ2VyKTogdm9pZCB7XG4gICAgICBjb25zdCByZXNvbHZlckZpbGVNYW5hZ2VyID0gbmV3IChjbGFzcyBleHRlbmRzIEZpbGVNYW5hZ2VyIHtcbiAgICAgICAgb3ZlcnJpZGUgc3VwcG9ydHNTeW5jKCk6IGJvb2xlYW4ge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIG92ZXJyaWRlIHN1cHBvcnRzKCk6IGJvb2xlYW4ge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgb3ZlcnJpZGUgYXN5bmMgbG9hZEZpbGUoXG4gICAgICAgICAgZmlsZW5hbWU6IHN0cmluZyxcbiAgICAgICAgICBjdXJyZW50RGlyZWN0b3J5OiBzdHJpbmcsXG4gICAgICAgICAgb3B0aW9uczogTGVzcy5Mb2FkRmlsZU9wdGlvbnMsXG4gICAgICAgICAgZW52aXJvbm1lbnQ6IExlc3MuRW52aXJvbm1lbnQsXG4gICAgICAgICk6IFByb21pc2U8TGVzcy5GaWxlTG9hZFJlc3VsdD4ge1xuICAgICAgICAgIC8vIEF0dGVtcHQgZGlyZWN0IGxvYWRpbmcgYXMgYSByZWxhdGl2ZSBwYXRoIHRvIGF2b2lkIHJlc29sdXRpb24gb3ZlcmhlYWRcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHN1cGVyLmxvYWRGaWxlKGZpbGVuYW1lLCBjdXJyZW50RGlyZWN0b3J5LCBvcHRpb25zLCBlbnZpcm9ubWVudCk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIC8vIEF0dGVtcHQgYSBmdWxsIHJlc29sdXRpb24gaWYgbm90IGZvdW5kXG4gICAgICAgICAgICBjb25zdCBmdWxsUmVzdWx0ID0gYXdhaXQgcmVzb2x2ZXIoZmlsZW5hbWUsIHtcbiAgICAgICAgICAgICAga2luZDogJ2ltcG9ydC1ydWxlJyxcbiAgICAgICAgICAgICAgcmVzb2x2ZURpcjogY3VycmVudERpcmVjdG9yeSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKGZ1bGxSZXN1bHQucGF0aCkge1xuICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGZpbGVuYW1lOiBmdWxsUmVzdWx0LnBhdGgsXG4gICAgICAgICAgICAgICAgY29udGVudHM6IGF3YWl0IHJlYWRGaWxlKGZ1bGxSZXN1bHQucGF0aCwgJ3V0Zi04JyksXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBPdGhlcndpc2UgZXJyb3IgYnkgdGhyb3dpbmcgdGhlIGZhaWxpbmcgZGlyZWN0IHJlc3VsdFxuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KSgpO1xuXG4gICAgICBwbHVnaW5NYW5hZ2VyLmFkZEZpbGVNYW5hZ2VyKHJlc29sdmVyRmlsZU1hbmFnZXIpO1xuICAgIH0sXG4gIH07XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBsZXNzLnJlbmRlcihkYXRhLCB7XG4gICAgICBmaWxlbmFtZSxcbiAgICAgIHBhdGhzOiBvcHRpb25zLmluY2x1ZGVQYXRocyxcbiAgICAgIHBsdWdpbnM6IFtyZXNvbHZlclBsdWdpbl0sXG4gICAgICByZXdyaXRlVXJsczogJ2FsbCcsXG4gICAgICBzb3VyY2VNYXA6IG9wdGlvbnMuc291cmNlbWFwXG4gICAgICAgID8ge1xuICAgICAgICAgICAgc291cmNlTWFwRmlsZUlubGluZTogdHJ1ZSxcbiAgICAgICAgICAgIG91dHB1dFNvdXJjZUZpbGVzOiB0cnVlLFxuICAgICAgICAgIH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgfSBhcyBMZXNzLk9wdGlvbnMpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRlbnRzOiByZXN1bHQuY3NzLFxuICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgIHdhdGNoRmlsZXM6IFtmaWxlbmFtZSwgLi4ucmVzdWx0LmltcG9ydHNdLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGlzTGVzc0V4Y2VwdGlvbihlcnJvcikpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVycm9yczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRleHQ6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgICAgICBsb2NhdGlvbjoge1xuICAgICAgICAgICAgICBmaWxlOiBlcnJvci5maWxlbmFtZSxcbiAgICAgICAgICAgICAgbGluZTogZXJyb3IubGluZSxcbiAgICAgICAgICAgICAgY29sdW1uOiBlcnJvci5jb2x1bW4sXG4gICAgICAgICAgICAgIC8vIE1pZGRsZSBlbGVtZW50IHJlcHJlc2VudHMgdGhlIGxpbmUgY29udGFpbmluZyB0aGUgZXJyb3JcbiAgICAgICAgICAgICAgbGluZVRleHQ6IGVycm9yLmV4dHJhY3QgJiYgZXJyb3IuZXh0cmFjdFtNYXRoLnRydW5jKGVycm9yLmV4dHJhY3QubGVuZ3RoIC8gMildLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuIl19