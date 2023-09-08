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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LessStylesheetLanguage = void 0;
const promises_1 = require("node:fs/promises");
/**
 * The lazy-loaded instance of the less stylesheet preprocessor.
 * It is only imported and initialized if a less stylesheet is used.
 */
let lessPreprocessor;
function isLessException(error) {
    return !!error && typeof error === 'object' && 'column' in error;
}
exports.LessStylesheetLanguage = Object.freeze({
    name: 'less',
    componentFilter: /^less;/,
    fileFilter: /\.less$/,
    process(data, file, _, options, build) {
        return compileString(data, file, options, build.resolve.bind(build));
    },
});
async function compileString(data, filename, options, resolver) {
    const less = (lessPreprocessor ??= (await Promise.resolve().then(() => __importStar(require('less')))).default);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGVzcy1sYW5ndWFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvc3R5bGVzaGVldHMvbGVzcy1sYW5ndWFnZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILCtDQUE0QztBQUc1Qzs7O0dBR0c7QUFDSCxJQUFJLGdCQUFtRCxDQUFDO0FBU3hELFNBQVMsZUFBZSxDQUFDLEtBQWM7SUFDckMsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxRQUFRLElBQUksS0FBSyxDQUFDO0FBQ25FLENBQUM7QUFFWSxRQUFBLHNCQUFzQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQXFCO0lBQ3RFLElBQUksRUFBRSxNQUFNO0lBQ1osZUFBZSxFQUFFLFFBQVE7SUFDekIsVUFBVSxFQUFFLFNBQVM7SUFDckIsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLO1FBQ25DLE9BQU8sYUFBYSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDdkUsQ0FBQztDQUNGLENBQUMsQ0FBQztBQUVILEtBQUssVUFBVSxhQUFhLENBQzFCLElBQVksRUFDWixRQUFnQixFQUNoQixPQUFnQyxFQUNoQyxRQUFnQztJQUVoQyxNQUFNLElBQUksR0FBRyxDQUFDLGdCQUFnQixLQUFLLENBQUMsd0RBQWEsTUFBTSxHQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUVuRSxNQUFNLGNBQWMsR0FBZ0I7UUFDbEMsT0FBTyxDQUFDLEVBQUUsV0FBVyxFQUFFLEVBQUUsYUFBYTtZQUNwQyxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxLQUFNLFNBQVEsV0FBVztnQkFDL0MsWUFBWTtvQkFDbkIsT0FBTyxLQUFLLENBQUM7Z0JBQ2YsQ0FBQztnQkFFUSxRQUFRO29CQUNmLE9BQU8sSUFBSSxDQUFDO2dCQUNkLENBQUM7Z0JBRVEsS0FBSyxDQUFDLFFBQVEsQ0FDckIsUUFBZ0IsRUFDaEIsZ0JBQXdCLEVBQ3hCLE9BQTZCLEVBQzdCLFdBQTZCO29CQUU3Qix5RUFBeUU7b0JBQ3pFLElBQUk7d0JBQ0YsT0FBTyxNQUFNLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLGdCQUFnQixFQUFFLE9BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQztxQkFDL0U7b0JBQUMsT0FBTyxLQUFLLEVBQUU7d0JBQ2QseUNBQXlDO3dCQUN6QyxNQUFNLFVBQVUsR0FBRyxNQUFNLFFBQVEsQ0FBQyxRQUFRLEVBQUU7NEJBQzFDLElBQUksRUFBRSxhQUFhOzRCQUNuQixVQUFVLEVBQUUsZ0JBQWdCO3lCQUM3QixDQUFDLENBQUM7d0JBQ0gsSUFBSSxVQUFVLENBQUMsSUFBSSxFQUFFOzRCQUNuQixPQUFPO2dDQUNMLFFBQVEsRUFBRSxVQUFVLENBQUMsSUFBSTtnQ0FDekIsUUFBUSxFQUFFLE1BQU0sSUFBQSxtQkFBUSxFQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDOzZCQUNuRCxDQUFDO3lCQUNIO3dCQUNELHdEQUF3RDt3QkFDeEQsTUFBTSxLQUFLLENBQUM7cUJBQ2I7Z0JBQ0gsQ0FBQzthQUNGLENBQUMsRUFBRSxDQUFDO1lBRUwsYUFBYSxDQUFDLGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3BELENBQUM7S0FDRixDQUFDO0lBRUYsSUFBSTtRQUNGLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUU7WUFDckMsUUFBUTtZQUNSLEtBQUssRUFBRSxPQUFPLENBQUMsWUFBWTtZQUMzQixPQUFPLEVBQUUsQ0FBQyxjQUFjLENBQUM7WUFDekIsV0FBVyxFQUFFLEtBQUs7WUFDbEIsU0FBUyxFQUFFLE9BQU8sQ0FBQyxTQUFTO2dCQUMxQixDQUFDLENBQUM7b0JBQ0UsbUJBQW1CLEVBQUUsSUFBSTtvQkFDekIsaUJBQWlCLEVBQUUsSUFBSTtpQkFDeEI7Z0JBQ0gsQ0FBQyxDQUFDLFNBQVM7U0FDRSxDQUFDLENBQUM7UUFFbkIsT0FBTztZQUNMLFFBQVEsRUFBRSxNQUFNLENBQUMsR0FBRztZQUNwQixNQUFNLEVBQUUsS0FBSztZQUNiLFVBQVUsRUFBRSxDQUFDLFFBQVEsRUFBRSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUM7U0FDMUMsQ0FBQztLQUNIO0lBQUMsT0FBTyxLQUFLLEVBQUU7UUFDZCxJQUFJLGVBQWUsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUMxQixPQUFPO2dCQUNMLE1BQU0sRUFBRTtvQkFDTjt3QkFDRSxJQUFJLEVBQUUsS0FBSyxDQUFDLE9BQU87d0JBQ25CLFFBQVEsRUFBRTs0QkFDUixJQUFJLEVBQUUsS0FBSyxDQUFDLFFBQVE7NEJBQ3BCLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTs0QkFDaEIsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNOzRCQUNwQiwwREFBMEQ7NEJBQzFELFFBQVEsRUFBRSxLQUFLLENBQUMsT0FBTyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQzt5QkFDL0U7cUJBQ0Y7aUJBQ0Y7Z0JBQ0QsTUFBTSxFQUFFLEtBQUs7YUFDZCxDQUFDO1NBQ0g7UUFFRCxNQUFNLEtBQUssQ0FBQztLQUNiO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE9uTG9hZFJlc3VsdCwgUGx1Z2luQnVpbGQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBTdHlsZXNoZWV0TGFuZ3VhZ2UsIFN0eWxlc2hlZXRQbHVnaW5PcHRpb25zIH0gZnJvbSAnLi9zdHlsZXNoZWV0LXBsdWdpbi1mYWN0b3J5JztcblxuLyoqXG4gKiBUaGUgbGF6eS1sb2FkZWQgaW5zdGFuY2Ugb2YgdGhlIGxlc3Mgc3R5bGVzaGVldCBwcmVwcm9jZXNzb3IuXG4gKiBJdCBpcyBvbmx5IGltcG9ydGVkIGFuZCBpbml0aWFsaXplZCBpZiBhIGxlc3Mgc3R5bGVzaGVldCBpcyB1c2VkLlxuICovXG5sZXQgbGVzc1ByZXByb2Nlc3NvcjogdHlwZW9mIGltcG9ydCgnbGVzcycpIHwgdW5kZWZpbmVkO1xuXG5pbnRlcmZhY2UgTGVzc0V4Y2VwdGlvbiBleHRlbmRzIEVycm9yIHtcbiAgZmlsZW5hbWU6IHN0cmluZztcbiAgbGluZTogbnVtYmVyO1xuICBjb2x1bW46IG51bWJlcjtcbiAgZXh0cmFjdD86IHN0cmluZ1tdO1xufVxuXG5mdW5jdGlvbiBpc0xlc3NFeGNlcHRpb24oZXJyb3I6IHVua25vd24pOiBlcnJvciBpcyBMZXNzRXhjZXB0aW9uIHtcbiAgcmV0dXJuICEhZXJyb3IgJiYgdHlwZW9mIGVycm9yID09PSAnb2JqZWN0JyAmJiAnY29sdW1uJyBpbiBlcnJvcjtcbn1cblxuZXhwb3J0IGNvbnN0IExlc3NTdHlsZXNoZWV0TGFuZ3VhZ2UgPSBPYmplY3QuZnJlZXplPFN0eWxlc2hlZXRMYW5ndWFnZT4oe1xuICBuYW1lOiAnbGVzcycsXG4gIGNvbXBvbmVudEZpbHRlcjogL15sZXNzOy8sXG4gIGZpbGVGaWx0ZXI6IC9cXC5sZXNzJC8sXG4gIHByb2Nlc3MoZGF0YSwgZmlsZSwgXywgb3B0aW9ucywgYnVpbGQpIHtcbiAgICByZXR1cm4gY29tcGlsZVN0cmluZyhkYXRhLCBmaWxlLCBvcHRpb25zLCBidWlsZC5yZXNvbHZlLmJpbmQoYnVpbGQpKTtcbiAgfSxcbn0pO1xuXG5hc3luYyBmdW5jdGlvbiBjb21waWxlU3RyaW5nKFxuICBkYXRhOiBzdHJpbmcsXG4gIGZpbGVuYW1lOiBzdHJpbmcsXG4gIG9wdGlvbnM6IFN0eWxlc2hlZXRQbHVnaW5PcHRpb25zLFxuICByZXNvbHZlcjogUGx1Z2luQnVpbGRbJ3Jlc29sdmUnXSxcbik6IFByb21pc2U8T25Mb2FkUmVzdWx0PiB7XG4gIGNvbnN0IGxlc3MgPSAobGVzc1ByZXByb2Nlc3NvciA/Pz0gKGF3YWl0IGltcG9ydCgnbGVzcycpKS5kZWZhdWx0KTtcblxuICBjb25zdCByZXNvbHZlclBsdWdpbjogTGVzcy5QbHVnaW4gPSB7XG4gICAgaW5zdGFsbCh7IEZpbGVNYW5hZ2VyIH0sIHBsdWdpbk1hbmFnZXIpOiB2b2lkIHtcbiAgICAgIGNvbnN0IHJlc29sdmVyRmlsZU1hbmFnZXIgPSBuZXcgKGNsYXNzIGV4dGVuZHMgRmlsZU1hbmFnZXIge1xuICAgICAgICBvdmVycmlkZSBzdXBwb3J0c1N5bmMoKTogYm9vbGVhbiB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgb3ZlcnJpZGUgc3VwcG9ydHMoKTogYm9vbGVhbiB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBvdmVycmlkZSBhc3luYyBsb2FkRmlsZShcbiAgICAgICAgICBmaWxlbmFtZTogc3RyaW5nLFxuICAgICAgICAgIGN1cnJlbnREaXJlY3Rvcnk6IHN0cmluZyxcbiAgICAgICAgICBvcHRpb25zOiBMZXNzLkxvYWRGaWxlT3B0aW9ucyxcbiAgICAgICAgICBlbnZpcm9ubWVudDogTGVzcy5FbnZpcm9ubWVudCxcbiAgICAgICAgKTogUHJvbWlzZTxMZXNzLkZpbGVMb2FkUmVzdWx0PiB7XG4gICAgICAgICAgLy8gQXR0ZW1wdCBkaXJlY3QgbG9hZGluZyBhcyBhIHJlbGF0aXZlIHBhdGggdG8gYXZvaWQgcmVzb2x1dGlvbiBvdmVyaGVhZFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgc3VwZXIubG9hZEZpbGUoZmlsZW5hbWUsIGN1cnJlbnREaXJlY3RvcnksIG9wdGlvbnMsIGVudmlyb25tZW50KTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgLy8gQXR0ZW1wdCBhIGZ1bGwgcmVzb2x1dGlvbiBpZiBub3QgZm91bmRcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxSZXN1bHQgPSBhd2FpdCByZXNvbHZlcihmaWxlbmFtZSwge1xuICAgICAgICAgICAgICBraW5kOiAnaW1wb3J0LXJ1bGUnLFxuICAgICAgICAgICAgICByZXNvbHZlRGlyOiBjdXJyZW50RGlyZWN0b3J5LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoZnVsbFJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgZmlsZW5hbWU6IGZ1bGxSZXN1bHQucGF0aCxcbiAgICAgICAgICAgICAgICBjb250ZW50czogYXdhaXQgcmVhZEZpbGUoZnVsbFJlc3VsdC5wYXRoLCAndXRmLTgnKSxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSBlcnJvciBieSB0aHJvd2luZyB0aGUgZmFpbGluZyBkaXJlY3QgcmVzdWx0XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pKCk7XG5cbiAgICAgIHBsdWdpbk1hbmFnZXIuYWRkRmlsZU1hbmFnZXIocmVzb2x2ZXJGaWxlTWFuYWdlcik7XG4gICAgfSxcbiAgfTtcblxuICB0cnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGxlc3MucmVuZGVyKGRhdGEsIHtcbiAgICAgIGZpbGVuYW1lLFxuICAgICAgcGF0aHM6IG9wdGlvbnMuaW5jbHVkZVBhdGhzLFxuICAgICAgcGx1Z2luczogW3Jlc29sdmVyUGx1Z2luXSxcbiAgICAgIHJld3JpdGVVcmxzOiAnYWxsJyxcbiAgICAgIHNvdXJjZU1hcDogb3B0aW9ucy5zb3VyY2VtYXBcbiAgICAgICAgPyB7XG4gICAgICAgICAgICBzb3VyY2VNYXBGaWxlSW5saW5lOiB0cnVlLFxuICAgICAgICAgICAgb3V0cHV0U291cmNlRmlsZXM6IHRydWUsXG4gICAgICAgICAgfVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICB9IGFzIExlc3MuT3B0aW9ucyk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29udGVudHM6IHJlc3VsdC5jc3MsXG4gICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgd2F0Y2hGaWxlczogW2ZpbGVuYW1lLCAuLi5yZXN1bHQuaW1wb3J0c10sXG4gICAgfTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoaXNMZXNzRXhjZXB0aW9uKGVycm9yKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdGV4dDogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgICAgIGxvY2F0aW9uOiB7XG4gICAgICAgICAgICAgIGZpbGU6IGVycm9yLmZpbGVuYW1lLFxuICAgICAgICAgICAgICBsaW5lOiBlcnJvci5saW5lLFxuICAgICAgICAgICAgICBjb2x1bW46IGVycm9yLmNvbHVtbixcbiAgICAgICAgICAgICAgLy8gTWlkZGxlIGVsZW1lbnQgcmVwcmVzZW50cyB0aGUgbGluZSBjb250YWluaW5nIHRoZSBlcnJvclxuICAgICAgICAgICAgICBsaW5lVGV4dDogZXJyb3IuZXh0cmFjdCAmJiBlcnJvci5leHRyYWN0W01hdGgudHJ1bmMoZXJyb3IuZXh0cmFjdC5sZW5ndGggLyAyKV0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICB9O1xuICAgIH1cblxuICAgIHRocm93IGVycm9yO1xuICB9XG59XG4iXX0=