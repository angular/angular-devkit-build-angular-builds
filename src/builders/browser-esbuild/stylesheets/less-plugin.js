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
/**
 * The lazy-loaded instance of the less stylesheet preprocessor.
 * It is only imported and initialized if a less stylesheet is used.
 */
let lessPreprocessor;
function isLessException(error) {
    return !!error && typeof error === 'object' && 'column' in error;
}
function createLessPlugin(options) {
    return {
        name: 'angular-less',
        setup(build) {
            // Add a load callback to support inline Component styles
            build.onLoad({ filter: /^less;/, namespace: 'angular:styles/component' }, async (args) => {
                const data = options.inlineComponentData?.[args.path];
                (0, node_assert_1.default)(typeof data === 'string', `component style name should always be found [${args.path}]`);
                const [, , filePath] = args.path.split(';', 3);
                return compileString(data, filePath, options, build.resolve.bind(build));
            });
            // Add a load callback to support files from disk
            build.onLoad({ filter: /\.less$/ }, async (args) => {
                const data = await (0, promises_1.readFile)(args.path, 'utf-8');
                return compileString(data, args.path, options, build.resolve.bind(build));
            });
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
                    const directResult = this.loadFileSync(filename, currentDirectory, options, environment);
                    if ('contents' in directResult) {
                        return directResult;
                    }
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
                    throw directResult.error;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGVzcy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc3R5bGVzaGVldHMvbGVzcy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCw4REFBaUM7QUFDakMsK0NBQTRDO0FBRTVDOzs7R0FHRztBQUNILElBQUksZ0JBQW1ELENBQUM7QUFleEQsU0FBUyxlQUFlLENBQUMsS0FBYztJQUNyQyxPQUFPLENBQUMsQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLFFBQVEsSUFBSSxLQUFLLENBQUM7QUFDbkUsQ0FBQztBQUVELFNBQWdCLGdCQUFnQixDQUFDLE9BQTBCO0lBQ3pELE9BQU87UUFDTCxJQUFJLEVBQUUsY0FBYztRQUNwQixLQUFLLENBQUMsS0FBa0I7WUFDdEIseURBQXlEO1lBQ3pELEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSwwQkFBMEIsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtnQkFDdkYsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN0RCxJQUFBLHFCQUFNLEVBQ0osT0FBTyxJQUFJLEtBQUssUUFBUSxFQUN4QixnREFBZ0QsSUFBSSxDQUFDLElBQUksR0FBRyxDQUM3RCxDQUFDO2dCQUVGLE1BQU0sQ0FBQyxFQUFFLEFBQUQsRUFBRyxRQUFRLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBRS9DLE9B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RSxNQUFNLENBQUMsR0FBRztZQUNwQixNQUFNLEVBQUUsS0FBSztTQUNkLENBQUM7S0FDSDtJQUFDLE9BQU8sS0FBSyxFQUFFO1FBQ2QsSUFBSSxlQUFlLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDMUIsT0FBTztnQkFDTCxNQUFNLEVBQUU7b0JBQ047d0JBQ0UsSUFBSSxFQUFFLEtBQUssQ0FBQyxPQUFPO3dCQUNuQixRQUFRLEVBQUU7NEJBQ1IsSUFBSSxFQUFFLEtBQUssQ0FBQyxRQUFROzRCQUNwQixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7NEJBQ2hCLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTTs0QkFDcEIsMERBQTBEOzRCQUMxRCxRQUFRLEVBQUUsS0FBSyxDQUFDLE9BQU8sSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7eUJBQy9FO3FCQUNGO2lCQUNGO2dCQUNELE1BQU0sRUFBRSxLQUFLO2FBQ2QsQ0FBQztTQUNIO1FBRUQsTUFBTSxLQUFLLENBQUM7S0FDYjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBPbkxvYWRSZXN1bHQsIFBsdWdpbiwgUGx1Z2luQnVpbGQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcblxuLyoqXG4gKiBUaGUgbGF6eS1sb2FkZWQgaW5zdGFuY2Ugb2YgdGhlIGxlc3Mgc3R5bGVzaGVldCBwcmVwcm9jZXNzb3IuXG4gKiBJdCBpcyBvbmx5IGltcG9ydGVkIGFuZCBpbml0aWFsaXplZCBpZiBhIGxlc3Mgc3R5bGVzaGVldCBpcyB1c2VkLlxuICovXG5sZXQgbGVzc1ByZXByb2Nlc3NvcjogdHlwZW9mIGltcG9ydCgnbGVzcycpIHwgdW5kZWZpbmVkO1xuXG5leHBvcnQgaW50ZXJmYWNlIExlc3NQbHVnaW5PcHRpb25zIHtcbiAgc291cmNlbWFwOiBib29sZWFuO1xuICBpbmNsdWRlUGF0aHM/OiBzdHJpbmdbXTtcbiAgaW5saW5lQ29tcG9uZW50RGF0YT86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG59XG5cbmludGVyZmFjZSBMZXNzRXhjZXB0aW9uIGV4dGVuZHMgRXJyb3Ige1xuICBmaWxlbmFtZTogc3RyaW5nO1xuICBsaW5lOiBudW1iZXI7XG4gIGNvbHVtbjogbnVtYmVyO1xuICBleHRyYWN0Pzogc3RyaW5nW107XG59XG5cbmZ1bmN0aW9uIGlzTGVzc0V4Y2VwdGlvbihlcnJvcjogdW5rbm93bik6IGVycm9yIGlzIExlc3NFeGNlcHRpb24ge1xuICByZXR1cm4gISFlcnJvciAmJiB0eXBlb2YgZXJyb3IgPT09ICdvYmplY3QnICYmICdjb2x1bW4nIGluIGVycm9yO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTGVzc1BsdWdpbihvcHRpb25zOiBMZXNzUGx1Z2luT3B0aW9ucyk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItbGVzcycsXG4gICAgc2V0dXAoYnVpbGQ6IFBsdWdpbkJ1aWxkKTogdm9pZCB7XG4gICAgICAvLyBBZGQgYSBsb2FkIGNhbGxiYWNrIHRvIHN1cHBvcnQgaW5saW5lIENvbXBvbmVudCBzdHlsZXNcbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL15sZXNzOy8sIG5hbWVzcGFjZTogJ2FuZ3VsYXI6c3R5bGVzL2NvbXBvbmVudCcgfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgZGF0YSA9IG9wdGlvbnMuaW5saW5lQ29tcG9uZW50RGF0YT8uW2FyZ3MucGF0aF07XG4gICAgICAgIGFzc2VydChcbiAgICAgICAgICB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycsXG4gICAgICAgICAgYGNvbXBvbmVudCBzdHlsZSBuYW1lIHNob3VsZCBhbHdheXMgYmUgZm91bmQgWyR7YXJncy5wYXRofV1gLFxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IFssICwgZmlsZVBhdGhdID0gYXJncy5wYXRoLnNwbGl0KCc7JywgMyk7XG5cbiAgICAgICAgcmV0dXJuIGNvbXBpbGVTdHJpbmcoZGF0YSwgZmlsZVBhdGgsIG9wdGlvbnMsIGJ1aWxkLnJlc29sdmUuYmluZChidWlsZCkpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEFkZCBhIGxvYWQgY2FsbGJhY2sgdG8gc3VwcG9ydCBmaWxlcyBmcm9tIGRpc2tcbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLmxlc3MkLyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVhZEZpbGUoYXJncy5wYXRoLCAndXRmLTgnKTtcblxuICAgICAgICByZXR1cm4gY29tcGlsZVN0cmluZyhkYXRhLCBhcmdzLnBhdGgsIG9wdGlvbnMsIGJ1aWxkLnJlc29sdmUuYmluZChidWlsZCkpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gY29tcGlsZVN0cmluZyhcbiAgZGF0YTogc3RyaW5nLFxuICBmaWxlbmFtZTogc3RyaW5nLFxuICBvcHRpb25zOiBMZXNzUGx1Z2luT3B0aW9ucyxcbiAgcmVzb2x2ZXI6IFBsdWdpbkJ1aWxkWydyZXNvbHZlJ10sXG4pOiBQcm9taXNlPE9uTG9hZFJlc3VsdD4ge1xuICBjb25zdCBsZXNzID0gKGxlc3NQcmVwcm9jZXNzb3IgPz89IChhd2FpdCBpbXBvcnQoJ2xlc3MnKSkuZGVmYXVsdCk7XG5cbiAgY29uc3QgcmVzb2x2ZXJQbHVnaW46IExlc3MuUGx1Z2luID0ge1xuICAgIGluc3RhbGwoeyBGaWxlTWFuYWdlciB9LCBwbHVnaW5NYW5hZ2VyKTogdm9pZCB7XG4gICAgICBjb25zdCByZXNvbHZlckZpbGVNYW5hZ2VyID0gbmV3IChjbGFzcyBleHRlbmRzIEZpbGVNYW5hZ2VyIHtcbiAgICAgICAgb3ZlcnJpZGUgc3VwcG9ydHNTeW5jKCk6IGJvb2xlYW4ge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIG92ZXJyaWRlIHN1cHBvcnRzKCk6IGJvb2xlYW4ge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgb3ZlcnJpZGUgYXN5bmMgbG9hZEZpbGUoXG4gICAgICAgICAgZmlsZW5hbWU6IHN0cmluZyxcbiAgICAgICAgICBjdXJyZW50RGlyZWN0b3J5OiBzdHJpbmcsXG4gICAgICAgICAgb3B0aW9uczogTGVzcy5Mb2FkRmlsZU9wdGlvbnMsXG4gICAgICAgICAgZW52aXJvbm1lbnQ6IExlc3MuRW52aXJvbm1lbnQsXG4gICAgICAgICk6IFByb21pc2U8TGVzcy5GaWxlTG9hZFJlc3VsdD4ge1xuICAgICAgICAgIC8vIEF0dGVtcHQgZGlyZWN0IGxvYWRpbmcgYXMgYSByZWxhdGl2ZSBwYXRoIHRvIGF2b2lkIHJlc29sdXRpb24gb3ZlcmhlYWRcbiAgICAgICAgICBjb25zdCBkaXJlY3RSZXN1bHQgPSB0aGlzLmxvYWRGaWxlU3luYyhmaWxlbmFtZSwgY3VycmVudERpcmVjdG9yeSwgb3B0aW9ucywgZW52aXJvbm1lbnQpO1xuICAgICAgICAgIGlmICgnY29udGVudHMnIGluIGRpcmVjdFJlc3VsdCkge1xuICAgICAgICAgICAgcmV0dXJuIGRpcmVjdFJlc3VsdDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBBdHRlbXB0IGEgZnVsbCByZXNvbHV0aW9uIGlmIG5vdCBmb3VuZFxuICAgICAgICAgIGNvbnN0IGZ1bGxSZXN1bHQgPSBhd2FpdCByZXNvbHZlcihmaWxlbmFtZSwge1xuICAgICAgICAgICAga2luZDogJ2ltcG9ydC1ydWxlJyxcbiAgICAgICAgICAgIHJlc29sdmVEaXI6IGN1cnJlbnREaXJlY3RvcnksXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKGZ1bGxSZXN1bHQucGF0aCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgZmlsZW5hbWU6IGZ1bGxSZXN1bHQucGF0aCxcbiAgICAgICAgICAgICAgY29udGVudHM6IGF3YWl0IHJlYWRGaWxlKGZ1bGxSZXN1bHQucGF0aCwgJ3V0Zi04JyksXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE90aGVyd2lzZSBlcnJvciBieSB0aHJvd2luZyB0aGUgZmFpbGluZyBkaXJlY3QgcmVzdWx0XG4gICAgICAgICAgdGhyb3cgZGlyZWN0UmVzdWx0LmVycm9yO1xuICAgICAgICB9XG4gICAgICB9KSgpO1xuXG4gICAgICBwbHVnaW5NYW5hZ2VyLmFkZEZpbGVNYW5hZ2VyKHJlc29sdmVyRmlsZU1hbmFnZXIpO1xuICAgIH0sXG4gIH07XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBsZXNzLnJlbmRlcihkYXRhLCB7XG4gICAgICBmaWxlbmFtZSxcbiAgICAgIHBhdGhzOiBvcHRpb25zLmluY2x1ZGVQYXRocyxcbiAgICAgIHBsdWdpbnM6IFtyZXNvbHZlclBsdWdpbl0sXG4gICAgICByZXdyaXRlVXJsczogJ2FsbCcsXG4gICAgICBzb3VyY2VNYXA6IG9wdGlvbnMuc291cmNlbWFwXG4gICAgICAgID8ge1xuICAgICAgICAgICAgc291cmNlTWFwRmlsZUlubGluZTogdHJ1ZSxcbiAgICAgICAgICAgIG91dHB1dFNvdXJjZUZpbGVzOiB0cnVlLFxuICAgICAgICAgIH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgfSBhcyBMZXNzLk9wdGlvbnMpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRlbnRzOiByZXN1bHQuY3NzLFxuICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChpc0xlc3NFeGNlcHRpb24oZXJyb3IpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0ZXh0OiBlcnJvci5tZXNzYWdlLFxuICAgICAgICAgICAgbG9jYXRpb246IHtcbiAgICAgICAgICAgICAgZmlsZTogZXJyb3IuZmlsZW5hbWUsXG4gICAgICAgICAgICAgIGxpbmU6IGVycm9yLmxpbmUsXG4gICAgICAgICAgICAgIGNvbHVtbjogZXJyb3IuY29sdW1uLFxuICAgICAgICAgICAgICAvLyBNaWRkbGUgZWxlbWVudCByZXByZXNlbnRzIHRoZSBsaW5lIGNvbnRhaW5pbmcgdGhlIGVycm9yXG4gICAgICAgICAgICAgIGxpbmVUZXh0OiBlcnJvci5leHRyYWN0ICYmIGVycm9yLmV4dHJhY3RbTWF0aC50cnVuYyhlcnJvci5leHRyYWN0Lmxlbmd0aCAvIDIpXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cbiJdfQ==