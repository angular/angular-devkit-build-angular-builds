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
        return compileString(data, file, options, build.resolve.bind(build), 
        /* unsafeInlineJavaScript */ false);
    },
});
async function compileString(data, filename, options, resolver, unsafeInlineJavaScript) {
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
            javascriptEnabled: unsafeInlineJavaScript,
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
            // Retry with a warning for less files requiring the deprecated inline JavaScript option
            if (error.message.includes('Inline JavaScript is not enabled.')) {
                const withJsResult = await compileString(data, filename, options, resolver, 
                /* unsafeInlineJavaScript */ true);
                withJsResult.warnings = [
                    {
                        text: 'Deprecated inline execution of JavaScript has been enabled ("javascriptEnabled")',
                        location: convertExceptionLocation(error),
                        notes: [
                            {
                                location: null,
                                text: 'JavaScript found within less stylesheets may be executed at build time. [https://lesscss.org/usage/#less-options]',
                            },
                            {
                                location: null,
                                text: 'Support for "javascriptEnabled" may be removed from the Angular CLI starting with Angular v19.',
                            },
                        ],
                    },
                ];
                return withJsResult;
            }
            return {
                errors: [
                    {
                        text: error.message,
                        location: convertExceptionLocation(error),
                    },
                ],
                loader: 'css',
            };
        }
        throw error;
    }
}
function convertExceptionLocation(exception) {
    return {
        file: exception.filename,
        line: exception.line,
        column: exception.column,
        // Middle element represents the line containing the exception
        lineText: exception.extract && exception.extract[Math.trunc(exception.extract.length / 2)],
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGVzcy1sYW5ndWFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvc3R5bGVzaGVldHMvbGVzcy1sYW5ndWFnZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILCtDQUE0QztBQUc1Qzs7O0dBR0c7QUFDSCxJQUFJLGdCQUFtRCxDQUFDO0FBU3hELFNBQVMsZUFBZSxDQUFDLEtBQWM7SUFDckMsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxRQUFRLElBQUksS0FBSyxDQUFDO0FBQ25FLENBQUM7QUFFWSxRQUFBLHNCQUFzQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQXFCO0lBQ3RFLElBQUksRUFBRSxNQUFNO0lBQ1osZUFBZSxFQUFFLFFBQVE7SUFDekIsVUFBVSxFQUFFLFNBQVM7SUFDckIsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLO1FBQ25DLE9BQU8sYUFBYSxDQUNsQixJQUFJLEVBQ0osSUFBSSxFQUNKLE9BQU8sRUFDUCxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDekIsNEJBQTRCLENBQUMsS0FBSyxDQUNuQyxDQUFDO0lBQ0osQ0FBQztDQUNGLENBQUMsQ0FBQztBQUVILEtBQUssVUFBVSxhQUFhLENBQzFCLElBQVksRUFDWixRQUFnQixFQUNoQixPQUFnQyxFQUNoQyxRQUFnQyxFQUNoQyxzQkFBK0I7SUFFL0IsTUFBTSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsS0FBSyxDQUFDLHdEQUFhLE1BQU0sR0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7SUFFbkUsTUFBTSxj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O29CQUNOO3dCQUNFLElBQUksRUFBRSxLQUFLLENBQUMsT0FBTzt3QkFDbkIsUUFBUSxFQUFFLHdCQUF3QixDQUFDLEtBQUssQ0FBQztxQkFDMUM7aUJBQ0Y7Z0JBQ0QsTUFBTSxFQUFFLEtBQUs7YUFDZCxDQUFDO1NBQ0g7UUFFRCxNQUFNLEtBQUssQ0FBQztLQUNiO0FBQ0gsQ0FBQztBQUVELFNBQVMsd0JBQXdCLENBQUMsU0FBd0I7SUFDeEQsT0FBTztRQUNMLElBQUksRUFBRSxTQUFTLENBQUMsUUFBUTtRQUN4QixJQUFJLEVBQUUsU0FBUyxDQUFDLElBQUk7UUFDcEIsTUFBTSxFQUFFLFNBQVMsQ0FBQyxNQUFNO1FBQ3hCLDhEQUE4RDtRQUM5RCxRQUFRLEVBQUUsU0FBUyxDQUFDLE9BQU8sSUFBSSxTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7S0FDM0YsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBMb2NhdGlvbiwgT25Mb2FkUmVzdWx0LCBQbHVnaW5CdWlsZCB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IFN0eWxlc2hlZXRMYW5ndWFnZSwgU3R5bGVzaGVldFBsdWdpbk9wdGlvbnMgfSBmcm9tICcuL3N0eWxlc2hlZXQtcGx1Z2luLWZhY3RvcnknO1xuXG4vKipcbiAqIFRoZSBsYXp5LWxvYWRlZCBpbnN0YW5jZSBvZiB0aGUgbGVzcyBzdHlsZXNoZWV0IHByZXByb2Nlc3Nvci5cbiAqIEl0IGlzIG9ubHkgaW1wb3J0ZWQgYW5kIGluaXRpYWxpemVkIGlmIGEgbGVzcyBzdHlsZXNoZWV0IGlzIHVzZWQuXG4gKi9cbmxldCBsZXNzUHJlcHJvY2Vzc29yOiB0eXBlb2YgaW1wb3J0KCdsZXNzJykgfCB1bmRlZmluZWQ7XG5cbmludGVyZmFjZSBMZXNzRXhjZXB0aW9uIGV4dGVuZHMgRXJyb3Ige1xuICBmaWxlbmFtZTogc3RyaW5nO1xuICBsaW5lOiBudW1iZXI7XG4gIGNvbHVtbjogbnVtYmVyO1xuICBleHRyYWN0Pzogc3RyaW5nW107XG59XG5cbmZ1bmN0aW9uIGlzTGVzc0V4Y2VwdGlvbihlcnJvcjogdW5rbm93bik6IGVycm9yIGlzIExlc3NFeGNlcHRpb24ge1xuICByZXR1cm4gISFlcnJvciAmJiB0eXBlb2YgZXJyb3IgPT09ICdvYmplY3QnICYmICdjb2x1bW4nIGluIGVycm9yO1xufVxuXG5leHBvcnQgY29uc3QgTGVzc1N0eWxlc2hlZXRMYW5ndWFnZSA9IE9iamVjdC5mcmVlemU8U3R5bGVzaGVldExhbmd1YWdlPih7XG4gIG5hbWU6ICdsZXNzJyxcbiAgY29tcG9uZW50RmlsdGVyOiAvXmxlc3M7LyxcbiAgZmlsZUZpbHRlcjogL1xcLmxlc3MkLyxcbiAgcHJvY2VzcyhkYXRhLCBmaWxlLCBfLCBvcHRpb25zLCBidWlsZCkge1xuICAgIHJldHVybiBjb21waWxlU3RyaW5nKFxuICAgICAgZGF0YSxcbiAgICAgIGZpbGUsXG4gICAgICBvcHRpb25zLFxuICAgICAgYnVpbGQucmVzb2x2ZS5iaW5kKGJ1aWxkKSxcbiAgICAgIC8qIHVuc2FmZUlubGluZUphdmFTY3JpcHQgKi8gZmFsc2UsXG4gICAgKTtcbiAgfSxcbn0pO1xuXG5hc3luYyBmdW5jdGlvbiBjb21waWxlU3RyaW5nKFxuICBkYXRhOiBzdHJpbmcsXG4gIGZpbGVuYW1lOiBzdHJpbmcsXG4gIG9wdGlvbnM6IFN0eWxlc2hlZXRQbHVnaW5PcHRpb25zLFxuICByZXNvbHZlcjogUGx1Z2luQnVpbGRbJ3Jlc29sdmUnXSxcbiAgdW5zYWZlSW5saW5lSmF2YVNjcmlwdDogYm9vbGVhbixcbik6IFByb21pc2U8T25Mb2FkUmVzdWx0PiB7XG4gIGNvbnN0IGxlc3MgPSAobGVzc1ByZXByb2Nlc3NvciA/Pz0gKGF3YWl0IGltcG9ydCgnbGVzcycpKS5kZWZhdWx0KTtcblxuICBjb25zdCByZXNvbHZlclBsdWdpbjogTGVzcy5QbHVnaW4gPSB7XG4gICAgaW5zdGFsbCh7IEZpbGVNYW5hZ2VyIH0sIHBsdWdpbk1hbmFnZXIpOiB2b2lkIHtcbiAgICAgIGNvbnN0IHJlc29sdmVyRmlsZU1hbmFnZXIgPSBuZXcgKGNsYXNzIGV4dGVuZHMgRmlsZU1hbmFnZXIge1xuICAgICAgICBvdmVycmlkZSBzdXBwb3J0c1N5bmMoKTogYm9vbGVhbiB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgb3ZlcnJpZGUgc3VwcG9ydHMoKTogYm9vbGVhbiB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBvdmVycmlkZSBhc3luYyBsb2FkRmlsZShcbiAgICAgICAgICBmaWxlbmFtZTogc3RyaW5nLFxuICAgICAgICAgIGN1cnJlbnREaXJlY3Rvcnk6IHN0cmluZyxcbiAgICAgICAgICBvcHRpb25zOiBMZXNzLkxvYWRGaWxlT3B0aW9ucyxcbiAgICAgICAgICBlbnZpcm9ubWVudDogTGVzcy5FbnZpcm9ubWVudCxcbiAgICAgICAgKTogUHJvbWlzZTxMZXNzLkZpbGVMb2FkUmVzdWx0PiB7XG4gICAgICAgICAgLy8gQXR0ZW1wdCBkaXJlY3QgbG9hZGluZyBhcyBhIHJlbGF0aXZlIHBhdGggdG8gYXZvaWQgcmVzb2x1dGlvbiBvdmVyaGVhZFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgc3VwZXIubG9hZEZpbGUoZmlsZW5hbWUsIGN1cnJlbnREaXJlY3RvcnksIG9wdGlvbnMsIGVudmlyb25tZW50KTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgLy8gQXR0ZW1wdCBhIGZ1bGwgcmVzb2x1dGlvbiBpZiBub3QgZm91bmRcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxSZXN1bHQgPSBhd2FpdCByZXNvbHZlcihmaWxlbmFtZSwge1xuICAgICAgICAgICAgICBraW5kOiAnaW1wb3J0LXJ1bGUnLFxuICAgICAgICAgICAgICByZXNvbHZlRGlyOiBjdXJyZW50RGlyZWN0b3J5LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoZnVsbFJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgZmlsZW5hbWU6IGZ1bGxSZXN1bHQucGF0aCxcbiAgICAgICAgICAgICAgICBjb250ZW50czogYXdhaXQgcmVhZEZpbGUoZnVsbFJlc3VsdC5wYXRoLCAndXRmLTgnKSxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSBlcnJvciBieSB0aHJvd2luZyB0aGUgZmFpbGluZyBkaXJlY3QgcmVzdWx0XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pKCk7XG5cbiAgICAgIHBsdWdpbk1hbmFnZXIuYWRkRmlsZU1hbmFnZXIocmVzb2x2ZXJGaWxlTWFuYWdlcik7XG4gICAgfSxcbiAgfTtcblxuICB0cnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGxlc3MucmVuZGVyKGRhdGEsIHtcbiAgICAgIGZpbGVuYW1lLFxuICAgICAgcGF0aHM6IG9wdGlvbnMuaW5jbHVkZVBhdGhzLFxuICAgICAgcGx1Z2luczogW3Jlc29sdmVyUGx1Z2luXSxcbiAgICAgIHJld3JpdGVVcmxzOiAnYWxsJyxcbiAgICAgIGphdmFzY3JpcHRFbmFibGVkOiB1bnNhZmVJbmxpbmVKYXZhU2NyaXB0LFxuICAgICAgc291cmNlTWFwOiBvcHRpb25zLnNvdXJjZW1hcFxuICAgICAgICA/IHtcbiAgICAgICAgICAgIHNvdXJjZU1hcEZpbGVJbmxpbmU6IHRydWUsXG4gICAgICAgICAgICBvdXRwdXRTb3VyY2VGaWxlczogdHJ1ZSxcbiAgICAgICAgICB9XG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgIH0gYXMgTGVzcy5PcHRpb25zKTtcblxuICAgIHJldHVybiB7XG4gICAgICBjb250ZW50czogcmVzdWx0LmNzcyxcbiAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICB3YXRjaEZpbGVzOiBbZmlsZW5hbWUsIC4uLnJlc3VsdC5pbXBvcnRzXSxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChpc0xlc3NFeGNlcHRpb24oZXJyb3IpKSB7XG4gICAgICAvLyBSZXRyeSB3aXRoIGEgd2FybmluZyBmb3IgbGVzcyBmaWxlcyByZXF1aXJpbmcgdGhlIGRlcHJlY2F0ZWQgaW5saW5lIEphdmFTY3JpcHQgb3B0aW9uXG4gICAgICBpZiAoZXJyb3IubWVzc2FnZS5pbmNsdWRlcygnSW5saW5lIEphdmFTY3JpcHQgaXMgbm90IGVuYWJsZWQuJykpIHtcbiAgICAgICAgY29uc3Qgd2l0aEpzUmVzdWx0ID0gYXdhaXQgY29tcGlsZVN0cmluZyhcbiAgICAgICAgICBkYXRhLFxuICAgICAgICAgIGZpbGVuYW1lLFxuICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgcmVzb2x2ZXIsXG4gICAgICAgICAgLyogdW5zYWZlSW5saW5lSmF2YVNjcmlwdCAqLyB0cnVlLFxuICAgICAgICApO1xuICAgICAgICB3aXRoSnNSZXN1bHQud2FybmluZ3MgPSBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdGV4dDogJ0RlcHJlY2F0ZWQgaW5saW5lIGV4ZWN1dGlvbiBvZiBKYXZhU2NyaXB0IGhhcyBiZWVuIGVuYWJsZWQgKFwiamF2YXNjcmlwdEVuYWJsZWRcIiknLFxuICAgICAgICAgICAgbG9jYXRpb246IGNvbnZlcnRFeGNlcHRpb25Mb2NhdGlvbihlcnJvciksXG4gICAgICAgICAgICBub3RlczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbG9jYXRpb246IG51bGwsXG4gICAgICAgICAgICAgICAgdGV4dDogJ0phdmFTY3JpcHQgZm91bmQgd2l0aGluIGxlc3Mgc3R5bGVzaGVldHMgbWF5IGJlIGV4ZWN1dGVkIGF0IGJ1aWxkIHRpbWUuIFtodHRwczovL2xlc3Njc3Mub3JnL3VzYWdlLyNsZXNzLW9wdGlvbnNdJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGxvY2F0aW9uOiBudWxsLFxuICAgICAgICAgICAgICAgIHRleHQ6ICdTdXBwb3J0IGZvciBcImphdmFzY3JpcHRFbmFibGVkXCIgbWF5IGJlIHJlbW92ZWQgZnJvbSB0aGUgQW5ndWxhciBDTEkgc3RhcnRpbmcgd2l0aCBBbmd1bGFyIHYxOS4nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICBdO1xuXG4gICAgICAgIHJldHVybiB3aXRoSnNSZXN1bHQ7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVycm9yczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRleHQ6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgICAgICBsb2NhdGlvbjogY29udmVydEV4Y2VwdGlvbkxvY2F0aW9uKGVycm9yKSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb252ZXJ0RXhjZXB0aW9uTG9jYXRpb24oZXhjZXB0aW9uOiBMZXNzRXhjZXB0aW9uKTogUGFydGlhbDxMb2NhdGlvbj4ge1xuICByZXR1cm4ge1xuICAgIGZpbGU6IGV4Y2VwdGlvbi5maWxlbmFtZSxcbiAgICBsaW5lOiBleGNlcHRpb24ubGluZSxcbiAgICBjb2x1bW46IGV4Y2VwdGlvbi5jb2x1bW4sXG4gICAgLy8gTWlkZGxlIGVsZW1lbnQgcmVwcmVzZW50cyB0aGUgbGluZSBjb250YWluaW5nIHRoZSBleGNlcHRpb25cbiAgICBsaW5lVGV4dDogZXhjZXB0aW9uLmV4dHJhY3QgJiYgZXhjZXB0aW9uLmV4dHJhY3RbTWF0aC50cnVuYyhleGNlcHRpb24uZXh0cmFjdC5sZW5ndGggLyAyKV0sXG4gIH07XG59XG4iXX0=