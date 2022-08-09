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
const css_resource_plugin_1 = require("./css-resource-plugin");
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
        external: options.externalDependencies,
        conditions: ['style', 'sass'],
        mainFields: ['style', 'sass'],
        plugins: [
            (0, sass_plugin_1.createSassPlugin)({ sourcemap: !!options.sourcemap, includePaths: options.includePaths }),
            (0, css_resource_plugin_1.createCssResourcePlugin)(),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc3R5bGVzaGVldHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCwyQ0FBNkI7QUFDN0IsK0RBQWdFO0FBQ2hFLHVDQUFtQztBQUNuQywrQ0FBaUQ7QUFZakQsS0FBSyxVQUFVLGdCQUFnQixDQUM3QixLQUFnRixFQUNoRixPQUFnQzs7SUFFaEMsa0JBQWtCO0lBQ2xCLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBQSxnQkFBTSxFQUFDO1FBQzFCLEdBQUcsS0FBSztRQUNSLGFBQWEsRUFBRSxPQUFPLENBQUMsYUFBYTtRQUNwQyxNQUFNLEVBQUUsSUFBSTtRQUNaLFVBQVUsRUFBRSxNQUFBLE9BQU8sQ0FBQyxXQUFXLDBDQUFFLE9BQU87UUFDeEMsVUFBVSxFQUFFLE1BQUEsT0FBTyxDQUFDLFdBQVcsMENBQUUsS0FBSztRQUN0QyxRQUFRLEVBQUUsUUFBUTtRQUNsQixNQUFNLEVBQUUsT0FBTyxDQUFDLFlBQVk7UUFDNUIsU0FBUyxFQUFFLE9BQU8sQ0FBQyxTQUFTO1FBQzVCLE1BQU0sRUFBRSxPQUFPLENBQUMsYUFBYTtRQUM3QixLQUFLLEVBQUUsS0FBSztRQUNaLFFBQVEsRUFBRSxTQUFTO1FBQ25CLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxnQkFBZ0I7UUFDMUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxvQkFBb0I7UUFDdEMsVUFBVSxFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQztRQUM3QixVQUFVLEVBQUUsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDO1FBQzdCLE9BQU8sRUFBRTtZQUNQLElBQUEsOEJBQWdCLEVBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsWUFBWSxFQUFFLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUN4RixJQUFBLDZDQUF1QixHQUFFO1NBQzFCO0tBQ0YsQ0FBQyxDQUFDO0lBRUgsMkRBQTJEO0lBQzNELElBQUksUUFBUSxHQUFHLEVBQUUsQ0FBQztJQUNsQixJQUFJLEdBQUcsQ0FBQztJQUNSLElBQUksVUFBVSxDQUFDO0lBQ2YsTUFBTSxhQUFhLEdBQWlCLEVBQUUsQ0FBQztJQUN2QyxJQUFJLE1BQU0sQ0FBQyxXQUFXLEVBQUU7UUFDdEIsS0FBSyxNQUFNLFVBQVUsSUFBSSxNQUFNLENBQUMsV0FBVyxFQUFFO1lBQzNDLFVBQVUsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN4RSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoRCxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQzdCLFVBQVUsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDO2dCQUM3QixRQUFRLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQzthQUM1QjtpQkFBTSxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUU7Z0JBQ3hDLEdBQUcsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDO2FBQ3ZCO2lCQUFNO2dCQUNMLHlGQUF5RjtnQkFDekYsYUFBYSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQzthQUNoQztTQUNGO0tBQ0Y7SUFFRCxPQUFPO1FBQ0wsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO1FBQ3JCLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtRQUN6QixRQUFRO1FBQ1IsR0FBRztRQUNILElBQUksRUFBRSxVQUFVO1FBQ2hCLGFBQWE7S0FDZCxDQUFDO0FBQ0osQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNJLEtBQUssVUFBVSxvQkFBb0IsQ0FBQyxRQUFnQixFQUFFLE9BQWdDO0lBQzNGLE9BQU8sZ0JBQWdCLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ2hFLENBQUM7QUFGRCxvREFFQztBQUVEOzs7Ozs7O0dBT0c7QUFDSSxLQUFLLFVBQVUsb0JBQW9CLENBQ3hDLElBQVksRUFDWixXQUEwRCxFQUMxRCxhQUFzQztJQUV0QyxNQUFNLE1BQU0sR0FBRyxnQkFBZ0IsQ0FDN0I7UUFDRSxLQUFLLEVBQUU7WUFDTCxRQUFRLEVBQUUsSUFBSTtZQUNkLFVBQVUsRUFBRSxXQUFXLENBQUMsV0FBVztZQUNuQyxVQUFVLEVBQUUsV0FBVyxDQUFDLFdBQVc7WUFDbkMsTUFBTSxFQUFFLEtBQUs7U0FDZDtLQUNGLEVBQ0QsYUFBYSxDQUNkLENBQUM7SUFFRixPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBbEJELG9EQWtCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkT3B0aW9ucywgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGNyZWF0ZUNzc1Jlc291cmNlUGx1Z2luIH0gZnJvbSAnLi9jc3MtcmVzb3VyY2UtcGx1Z2luJztcbmltcG9ydCB7IGJ1bmRsZSB9IGZyb20gJy4vZXNidWlsZCc7XG5pbXBvcnQgeyBjcmVhdGVTYXNzUGx1Z2luIH0gZnJvbSAnLi9zYXNzLXBsdWdpbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMge1xuICB3b3Jrc3BhY2VSb290OiBzdHJpbmc7XG4gIG9wdGltaXphdGlvbjogYm9vbGVhbjtcbiAgcHJlc2VydmVTeW1saW5rcz86IGJvb2xlYW47XG4gIHNvdXJjZW1hcDogYm9vbGVhbiB8ICdleHRlcm5hbCcgfCAnaW5saW5lJztcbiAgb3V0cHV0TmFtZXM/OiB7IGJ1bmRsZXM/OiBzdHJpbmc7IG1lZGlhPzogc3RyaW5nIH07XG4gIGluY2x1ZGVQYXRocz86IHN0cmluZ1tdO1xuICBleHRlcm5hbERlcGVuZGVuY2llcz86IHN0cmluZ1tdO1xufVxuXG5hc3luYyBmdW5jdGlvbiBidW5kbGVTdHlsZXNoZWV0KFxuICBlbnRyeTogUmVxdWlyZWQ8UGljazxCdWlsZE9wdGlvbnMsICdzdGRpbic+IHwgUGljazxCdWlsZE9wdGlvbnMsICdlbnRyeVBvaW50cyc+PixcbiAgb3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsXG4pIHtcbiAgLy8gRXhlY3V0ZSBlc2J1aWxkXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJ1bmRsZSh7XG4gICAgLi4uZW50cnksXG4gICAgYWJzV29ya2luZ0Rpcjogb3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICBlbnRyeU5hbWVzOiBvcHRpb25zLm91dHB1dE5hbWVzPy5idW5kbGVzLFxuICAgIGFzc2V0TmFtZXM6IG9wdGlvbnMub3V0cHV0TmFtZXM/Lm1lZGlhLFxuICAgIGxvZ0xldmVsOiAnc2lsZW50JyxcbiAgICBtaW5pZnk6IG9wdGlvbnMub3B0aW1pemF0aW9uLFxuICAgIHNvdXJjZW1hcDogb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgb3V0ZGlyOiBvcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgcHJlc2VydmVTeW1saW5rczogb3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIGV4dGVybmFsOiBvcHRpb25zLmV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIGNvbmRpdGlvbnM6IFsnc3R5bGUnLCAnc2FzcyddLFxuICAgIG1haW5GaWVsZHM6IFsnc3R5bGUnLCAnc2FzcyddLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNhc3NQbHVnaW4oeyBzb3VyY2VtYXA6ICEhb3B0aW9ucy5zb3VyY2VtYXAsIGluY2x1ZGVQYXRoczogb3B0aW9ucy5pbmNsdWRlUGF0aHMgfSksXG4gICAgICBjcmVhdGVDc3NSZXNvdXJjZVBsdWdpbigpLFxuICAgIF0sXG4gIH0pO1xuXG4gIC8vIEV4dHJhY3QgdGhlIHJlc3VsdCBvZiB0aGUgYnVuZGxpbmcgZnJvbSB0aGUgb3V0cHV0IGZpbGVzXG4gIGxldCBjb250ZW50cyA9ICcnO1xuICBsZXQgbWFwO1xuICBsZXQgb3V0cHV0UGF0aDtcbiAgY29uc3QgcmVzb3VyY2VGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gIGlmIChyZXN1bHQub3V0cHV0RmlsZXMpIHtcbiAgICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2YgcmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgICBvdXRwdXRGaWxlLnBhdGggPSBwYXRoLnJlbGF0aXZlKG9wdGlvbnMud29ya3NwYWNlUm9vdCwgb3V0cHV0RmlsZS5wYXRoKTtcbiAgICAgIGNvbnN0IGZpbGVuYW1lID0gcGF0aC5iYXNlbmFtZShvdXRwdXRGaWxlLnBhdGgpO1xuICAgICAgaWYgKGZpbGVuYW1lLmVuZHNXaXRoKCcuY3NzJykpIHtcbiAgICAgICAgb3V0cHV0UGF0aCA9IG91dHB1dEZpbGUucGF0aDtcbiAgICAgICAgY29udGVudHMgPSBvdXRwdXRGaWxlLnRleHQ7XG4gICAgICB9IGVsc2UgaWYgKGZpbGVuYW1lLmVuZHNXaXRoKCcuY3NzLm1hcCcpKSB7XG4gICAgICAgIG1hcCA9IG91dHB1dEZpbGUudGV4dDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoZSBvdXRwdXQgZmlsZXMgY291bGQgYWxzbyBjb250YWluIHJlc291cmNlcyAoaW1hZ2VzL2ZvbnRzL2V0Yy4pIHRoYXQgd2VyZSByZWZlcmVuY2VkXG4gICAgICAgIHJlc291cmNlRmlsZXMucHVzaChvdXRwdXRGaWxlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGVycm9yczogcmVzdWx0LmVycm9ycyxcbiAgICB3YXJuaW5nczogcmVzdWx0Lndhcm5pbmdzLFxuICAgIGNvbnRlbnRzLFxuICAgIG1hcCxcbiAgICBwYXRoOiBvdXRwdXRQYXRoLFxuICAgIHJlc291cmNlRmlsZXMsXG4gIH07XG59XG5cbi8qKlxuICogQnVuZGxlIGEgc3R5bGVzaGVldCB0aGF0IGV4aXN0cyBhcyBhIGZpbGUgb24gdGhlIGZpbGVzeXN0ZW0uXG4gKlxuICogQHBhcmFtIGZpbGVuYW1lIFRoZSBwYXRoIHRvIHRoZSBmaWxlIHRvIGJ1bmRsZS5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBzdHlsZXNoZWV0IGJ1bmRsaW5nIG9wdGlvbnMgdG8gdXNlLlxuICogQHJldHVybnMgVGhlIGJ1bmRsZSByZXN1bHQgb2JqZWN0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYnVuZGxlU3R5bGVzaGVldEZpbGUoZmlsZW5hbWU6IHN0cmluZywgb3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMpIHtcbiAgcmV0dXJuIGJ1bmRsZVN0eWxlc2hlZXQoeyBlbnRyeVBvaW50czogW2ZpbGVuYW1lXSB9LCBvcHRpb25zKTtcbn1cblxuLyoqXG4gKiBCdW5kbGUgc3R5bGVzaGVldCB0ZXh0IGRhdGEgZnJvbSBhIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0gZGF0YSBUaGUgc3RyaW5nIGNvbnRlbnQgb2YgYSBzdHlsZXNoZWV0IHRvIGJ1bmRsZS5cbiAqIEBwYXJhbSBkYXRhT3B0aW9ucyBUaGUgb3B0aW9ucyB0byB1c2UgdG8gcmVzb2x2ZSByZWZlcmVuY2VzIGFuZCBuYW1lIG91dHB1dCBvZiB0aGUgc3R5bGVzaGVldCBkYXRhLlxuICogQHBhcmFtIGJ1bmRsZU9wdGlvbnMgIFRoZSBzdHlsZXNoZWV0IGJ1bmRsaW5nIG9wdGlvbnMgdG8gdXNlLlxuICogQHJldHVybnMgVGhlIGJ1bmRsZSByZXN1bHQgb2JqZWN0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYnVuZGxlU3R5bGVzaGVldFRleHQoXG4gIGRhdGE6IHN0cmluZyxcbiAgZGF0YU9wdGlvbnM6IHsgcmVzb2x2ZVBhdGg6IHN0cmluZzsgdmlydHVhbE5hbWU/OiBzdHJpbmcgfSxcbiAgYnVuZGxlT3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsXG4pIHtcbiAgY29uc3QgcmVzdWx0ID0gYnVuZGxlU3R5bGVzaGVldChcbiAgICB7XG4gICAgICBzdGRpbjoge1xuICAgICAgICBjb250ZW50czogZGF0YSxcbiAgICAgICAgc291cmNlZmlsZTogZGF0YU9wdGlvbnMudmlydHVhbE5hbWUsXG4gICAgICAgIHJlc29sdmVEaXI6IGRhdGFPcHRpb25zLnJlc29sdmVQYXRoLFxuICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgfSxcbiAgICB9LFxuICAgIGJ1bmRsZU9wdGlvbnMsXG4gICk7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdfQ==