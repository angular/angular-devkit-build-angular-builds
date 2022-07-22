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
exports.bundleStylesheetText = exports.bundleStylesheetFile = void 0;
const path = __importStar(require("path"));
const esbuild_1 = require("./esbuild");
const sass_plugin_1 = require("./sass-plugin");
async function bundleStylesheet(entry, options) {
    var _a, _b;
    // Execute esbuild
    const result = await (0, esbuild_1.bundle)({
        ...entry,
        absWorkingDir: options.workspaceRoot,
        bundle: true,
        entryNames: (_a = options.outputNames) === null || _a === void 0 ? void 0 : _a.bundles,
        assetNames: (_b = options.outputNames) === null || _b === void 0 ? void 0 : _b.media,
        logLevel: 'silent',
        minify: options.optimization,
        sourcemap: options.sourcemap,
        outdir: options.workspaceRoot,
        write: false,
        platform: 'browser',
        preserveSymlinks: options.preserveSymlinks,
        conditions: ['style', 'sass'],
        mainFields: ['style', 'sass'],
        plugins: [
            (0, sass_plugin_1.createSassPlugin)({ sourcemap: !!options.sourcemap, includePaths: options.includePaths }),
        ],
    });
    // Extract the result of the bundling from the output files
    let contents = '';
    let map;
    let outputPath;
    const resourceFiles = [];
    if (result.outputFiles) {
        for (const outputFile of result.outputFiles) {
            outputFile.path = path.relative(options.workspaceRoot, outputFile.path);
            const filename = path.basename(outputFile.path);
            if (filename.endsWith('.css')) {
                outputPath = outputFile.path;
                contents = outputFile.text;
            }
            else if (filename.endsWith('.css.map')) {
                map = outputFile.text;
            }
            else {
                // The output files could also contain resources (images/fonts/etc.) that were referenced
                resourceFiles.push(outputFile);
            }
        }
    }
    return {
        errors: result.errors,
        warnings: result.warnings,
        contents,
        map,
        path: outputPath,
        resourceFiles,
    };
}
/**
 * Bundle a stylesheet that exists as a file on the filesystem.
 *
 * @param filename The path to the file to bundle.
 * @param options The stylesheet bundling options to use.
 * @returns The bundle result object.
 */
async function bundleStylesheetFile(filename, options) {
    return bundleStylesheet({ entryPoints: [filename] }, options);
}
exports.bundleStylesheetFile = bundleStylesheetFile;
/**
 * Bundle stylesheet text data from a string.
 *
 * @param data The string content of a stylesheet to bundle.
 * @param dataOptions The options to use to resolve references and name output of the stylesheet data.
 * @param bundleOptions  The stylesheet bundling options to use.
 * @returns The bundle result object.
 */
async function bundleStylesheetText(data, dataOptions, bundleOptions) {
    const result = bundleStylesheet({
        stdin: {
            contents: data,
            sourcefile: dataOptions.virtualName,
            resolveDir: dataOptions.resolvePath,
            loader: 'css',
        },
    }, bundleOptions);
    return result;
}
exports.bundleStylesheetText = bundleStylesheetText;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc3R5bGVzaGVldHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCwyQ0FBNkI7QUFDN0IsdUNBQW1DO0FBQ25DLCtDQUFpRDtBQVdqRCxLQUFLLFVBQVUsZ0JBQWdCLENBQzdCLEtBQWdGLEVBQ2hGLE9BQWdDOztJQUVoQyxrQkFBa0I7SUFDbEIsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFBLGdCQUFNLEVBQUM7UUFDMUIsR0FBRyxLQUFLO1FBQ1IsYUFBYSxFQUFFLE9BQU8sQ0FBQyxhQUFhO1FBQ3BDLE1BQU0sRUFBRSxJQUFJO1FBQ1osVUFBVSxFQUFFLE1BQUEsT0FBTyxDQUFDLFdBQVcsMENBQUUsT0FBTztRQUN4QyxVQUFVLEVBQUUsTUFBQSxPQUFPLENBQUMsV0FBVywwQ0FBRSxLQUFLO1FBQ3RDLFFBQVEsRUFBRSxRQUFRO1FBQ2xCLE1BQU0sRUFBRSxPQUFPLENBQUMsWUFBWTtRQUM1QixTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVM7UUFDNUIsTUFBTSxFQUFFLE9BQU8sQ0FBQyxhQUFhO1FBQzdCLEtBQUssRUFBRSxLQUFLO1FBQ1osUUFBUSxFQUFFLFNBQVM7UUFDbkIsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLGdCQUFnQjtRQUMxQyxVQUFVLEVBQUUsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDO1FBQzdCLFVBQVUsRUFBRSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUM7UUFDN0IsT0FBTyxFQUFFO1lBQ1AsSUFBQSw4QkFBZ0IsRUFBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxZQUFZLEVBQUUsT0FBTyxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ3pGO0tBQ0YsQ0FBQyxDQUFDO0lBRUgsMkRBQTJEO0lBQzNELElBQUksUUFBUSxHQUFHLEVBQUUsQ0FBQztJQUNsQixJQUFJLEdBQUcsQ0FBQztJQUNSLElBQUksVUFBVSxDQUFDO0lBQ2YsTUFBTSxhQUFhLEdBQWlCLEVBQUUsQ0FBQztJQUN2QyxJQUFJLE1BQU0sQ0FBQyxXQUFXLEVBQUU7UUFDdEIsS0FBSyxNQUFNLFVBQVUsSUFBSSxNQUFNLENBQUMsV0FBVyxFQUFFO1lBQzNDLFVBQVUsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN4RSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoRCxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQzdCLFVBQVUsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDO2dCQUM3QixRQUFRLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQzthQUM1QjtpQkFBTSxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUU7Z0JBQ3hDLEdBQUcsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDO2FBQ3ZCO2lCQUFNO2dCQUNMLHlGQUF5RjtnQkFDekYsYUFBYSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQzthQUNoQztTQUNGO0tBQ0Y7SUFFRCxPQUFPO1FBQ0wsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO1FBQ3JCLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtRQUN6QixRQUFRO1FBQ1IsR0FBRztRQUNILElBQUksRUFBRSxVQUFVO1FBQ2hCLGFBQWE7S0FDZCxDQUFDO0FBQ0osQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNJLEtBQUssVUFBVSxvQkFBb0IsQ0FBQyxRQUFnQixFQUFFLE9BQWdDO0lBQzNGLE9BQU8sZ0JBQWdCLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ2hFLENBQUM7QUFGRCxvREFFQztBQUVEOzs7Ozs7O0dBT0c7QUFDSSxLQUFLLFVBQVUsb0JBQW9CLENBQ3hDLElBQVksRUFDWixXQUEwRCxFQUMxRCxhQUFzQztJQUV0QyxNQUFNLE1BQU0sR0FBRyxnQkFBZ0IsQ0FDN0I7UUFDRSxLQUFLLEVBQUU7WUFDTCxRQUFRLEVBQUUsSUFBSTtZQUNkLFVBQVUsRUFBRSxXQUFXLENBQUMsV0FBVztZQUNuQyxVQUFVLEVBQUUsV0FBVyxDQUFDLFdBQVc7WUFDbkMsTUFBTSxFQUFFLEtBQUs7U0FDZDtLQUNGLEVBQ0QsYUFBYSxDQUNkLENBQUM7SUFFRixPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBbEJELG9EQWtCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkT3B0aW9ucywgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGJ1bmRsZSB9IGZyb20gJy4vZXNidWlsZCc7XG5pbXBvcnQgeyBjcmVhdGVTYXNzUGx1Z2luIH0gZnJvbSAnLi9zYXNzLXBsdWdpbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMge1xuICB3b3Jrc3BhY2VSb290OiBzdHJpbmc7XG4gIG9wdGltaXphdGlvbjogYm9vbGVhbjtcbiAgcHJlc2VydmVTeW1saW5rcz86IGJvb2xlYW47XG4gIHNvdXJjZW1hcDogYm9vbGVhbiB8ICdleHRlcm5hbCcgfCAnaW5saW5lJztcbiAgb3V0cHV0TmFtZXM/OiB7IGJ1bmRsZXM/OiBzdHJpbmc7IG1lZGlhPzogc3RyaW5nIH07XG4gIGluY2x1ZGVQYXRocz86IHN0cmluZ1tdO1xufVxuXG5hc3luYyBmdW5jdGlvbiBidW5kbGVTdHlsZXNoZWV0KFxuICBlbnRyeTogUmVxdWlyZWQ8UGljazxCdWlsZE9wdGlvbnMsICdzdGRpbic+IHwgUGljazxCdWlsZE9wdGlvbnMsICdlbnRyeVBvaW50cyc+PixcbiAgb3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsXG4pIHtcbiAgLy8gRXhlY3V0ZSBlc2J1aWxkXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJ1bmRsZSh7XG4gICAgLi4uZW50cnksXG4gICAgYWJzV29ya2luZ0Rpcjogb3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICBlbnRyeU5hbWVzOiBvcHRpb25zLm91dHB1dE5hbWVzPy5idW5kbGVzLFxuICAgIGFzc2V0TmFtZXM6IG9wdGlvbnMub3V0cHV0TmFtZXM/Lm1lZGlhLFxuICAgIGxvZ0xldmVsOiAnc2lsZW50JyxcbiAgICBtaW5pZnk6IG9wdGlvbnMub3B0aW1pemF0aW9uLFxuICAgIHNvdXJjZW1hcDogb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgb3V0ZGlyOiBvcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgcHJlc2VydmVTeW1saW5rczogb3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIGNvbmRpdGlvbnM6IFsnc3R5bGUnLCAnc2FzcyddLFxuICAgIG1haW5GaWVsZHM6IFsnc3R5bGUnLCAnc2FzcyddLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNhc3NQbHVnaW4oeyBzb3VyY2VtYXA6ICEhb3B0aW9ucy5zb3VyY2VtYXAsIGluY2x1ZGVQYXRoczogb3B0aW9ucy5pbmNsdWRlUGF0aHMgfSksXG4gICAgXSxcbiAgfSk7XG5cbiAgLy8gRXh0cmFjdCB0aGUgcmVzdWx0IG9mIHRoZSBidW5kbGluZyBmcm9tIHRoZSBvdXRwdXQgZmlsZXNcbiAgbGV0IGNvbnRlbnRzID0gJyc7XG4gIGxldCBtYXA7XG4gIGxldCBvdXRwdXRQYXRoO1xuICBjb25zdCByZXNvdXJjZUZpbGVzOiBPdXRwdXRGaWxlW10gPSBbXTtcbiAgaWYgKHJlc3VsdC5vdXRwdXRGaWxlcykge1xuICAgIGZvciAoY29uc3Qgb3V0cHV0RmlsZSBvZiByZXN1bHQub3V0cHV0RmlsZXMpIHtcbiAgICAgIG91dHB1dEZpbGUucGF0aCA9IHBhdGgucmVsYXRpdmUob3B0aW9ucy53b3Jrc3BhY2VSb290LCBvdXRwdXRGaWxlLnBhdGgpO1xuICAgICAgY29uc3QgZmlsZW5hbWUgPSBwYXRoLmJhc2VuYW1lKG91dHB1dEZpbGUucGF0aCk7XG4gICAgICBpZiAoZmlsZW5hbWUuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgICBvdXRwdXRQYXRoID0gb3V0cHV0RmlsZS5wYXRoO1xuICAgICAgICBjb250ZW50cyA9IG91dHB1dEZpbGUudGV4dDtcbiAgICAgIH0gZWxzZSBpZiAoZmlsZW5hbWUuZW5kc1dpdGgoJy5jc3MubWFwJykpIHtcbiAgICAgICAgbWFwID0gb3V0cHV0RmlsZS50ZXh0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhlIG91dHB1dCBmaWxlcyBjb3VsZCBhbHNvIGNvbnRhaW4gcmVzb3VyY2VzIChpbWFnZXMvZm9udHMvZXRjLikgdGhhdCB3ZXJlIHJlZmVyZW5jZWRcbiAgICAgICAgcmVzb3VyY2VGaWxlcy5wdXNoKG91dHB1dEZpbGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZXJyb3JzOiByZXN1bHQuZXJyb3JzLFxuICAgIHdhcm5pbmdzOiByZXN1bHQud2FybmluZ3MsXG4gICAgY29udGVudHMsXG4gICAgbWFwLFxuICAgIHBhdGg6IG91dHB1dFBhdGgsXG4gICAgcmVzb3VyY2VGaWxlcyxcbiAgfTtcbn1cblxuLyoqXG4gKiBCdW5kbGUgYSBzdHlsZXNoZWV0IHRoYXQgZXhpc3RzIGFzIGEgZmlsZSBvbiB0aGUgZmlsZXN5c3RlbS5cbiAqXG4gKiBAcGFyYW0gZmlsZW5hbWUgVGhlIHBhdGggdG8gdGhlIGZpbGUgdG8gYnVuZGxlLlxuICogQHBhcmFtIG9wdGlvbnMgVGhlIHN0eWxlc2hlZXQgYnVuZGxpbmcgb3B0aW9ucyB0byB1c2UuXG4gKiBAcmV0dXJucyBUaGUgYnVuZGxlIHJlc3VsdCBvYmplY3QuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidW5kbGVTdHlsZXNoZWV0RmlsZShmaWxlbmFtZTogc3RyaW5nLCBvcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucykge1xuICByZXR1cm4gYnVuZGxlU3R5bGVzaGVldCh7IGVudHJ5UG9pbnRzOiBbZmlsZW5hbWVdIH0sIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIEJ1bmRsZSBzdHlsZXNoZWV0IHRleHQgZGF0YSBmcm9tIGEgc3RyaW5nLlxuICpcbiAqIEBwYXJhbSBkYXRhIFRoZSBzdHJpbmcgY29udGVudCBvZiBhIHN0eWxlc2hlZXQgdG8gYnVuZGxlLlxuICogQHBhcmFtIGRhdGFPcHRpb25zIFRoZSBvcHRpb25zIHRvIHVzZSB0byByZXNvbHZlIHJlZmVyZW5jZXMgYW5kIG5hbWUgb3V0cHV0IG9mIHRoZSBzdHlsZXNoZWV0IGRhdGEuXG4gKiBAcGFyYW0gYnVuZGxlT3B0aW9ucyAgVGhlIHN0eWxlc2hlZXQgYnVuZGxpbmcgb3B0aW9ucyB0byB1c2UuXG4gKiBAcmV0dXJucyBUaGUgYnVuZGxlIHJlc3VsdCBvYmplY3QuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidW5kbGVTdHlsZXNoZWV0VGV4dChcbiAgZGF0YTogc3RyaW5nLFxuICBkYXRhT3B0aW9uczogeyByZXNvbHZlUGF0aDogc3RyaW5nOyB2aXJ0dWFsTmFtZT86IHN0cmluZyB9LFxuICBidW5kbGVPcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbikge1xuICBjb25zdCByZXN1bHQgPSBidW5kbGVTdHlsZXNoZWV0KFxuICAgIHtcbiAgICAgIHN0ZGluOiB7XG4gICAgICAgIGNvbnRlbnRzOiBkYXRhLFxuICAgICAgICBzb3VyY2VmaWxlOiBkYXRhT3B0aW9ucy52aXJ0dWFsTmFtZSxcbiAgICAgICAgcmVzb2x2ZURpcjogZGF0YU9wdGlvbnMucmVzb2x2ZVBhdGgsXG4gICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICB9LFxuICAgIH0sXG4gICAgYnVuZGxlT3B0aW9ucyxcbiAgKTtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuIl19