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
        outdir: esbuild_1.DEFAULT_OUTDIR,
        write: false,
        platform: 'browser',
        preserveSymlinks: options.preserveSymlinks,
        conditions: ['style'],
        mainFields: ['style'],
        plugins: [
        // TODO: preprocessor plugins
        ],
    });
    // Extract the result of the bundling from the output files
    let contents = '';
    let map;
    let outputPath;
    const resourceFiles = [];
    if (result.outputFiles) {
        for (const outputFile of result.outputFiles) {
            outputFile.path = path.relative(esbuild_1.DEFAULT_OUTDIR, outputFile.path);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc3R5bGVzaGVldHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCwyQ0FBNkI7QUFDN0IsdUNBQW1EO0FBVW5ELEtBQUssVUFBVSxnQkFBZ0IsQ0FDN0IsS0FBZ0YsRUFDaEYsT0FBZ0M7O0lBRWhDLGtCQUFrQjtJQUNsQixNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUEsZ0JBQU0sRUFBQztRQUMxQixHQUFHLEtBQUs7UUFDUixhQUFhLEVBQUUsT0FBTyxDQUFDLGFBQWE7UUFDcEMsTUFBTSxFQUFFLElBQUk7UUFDWixVQUFVLEVBQUUsTUFBQSxPQUFPLENBQUMsV0FBVywwQ0FBRSxPQUFPO1FBQ3hDLFVBQVUsRUFBRSxNQUFBLE9BQU8sQ0FBQyxXQUFXLDBDQUFFLEtBQUs7UUFDdEMsUUFBUSxFQUFFLFFBQVE7UUFDbEIsTUFBTSxFQUFFLE9BQU8sQ0FBQyxZQUFZO1FBQzVCLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUztRQUM1QixNQUFNLEVBQUUsd0JBQWM7UUFDdEIsS0FBSyxFQUFFLEtBQUs7UUFDWixRQUFRLEVBQUUsU0FBUztRQUNuQixnQkFBZ0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCO1FBQzFDLFVBQVUsRUFBRSxDQUFDLE9BQU8sQ0FBQztRQUNyQixVQUFVLEVBQUUsQ0FBQyxPQUFPLENBQUM7UUFDckIsT0FBTyxFQUFFO1FBQ1AsNkJBQTZCO1NBQzlCO0tBQ0YsQ0FBQyxDQUFDO0lBRUgsMkRBQTJEO0lBQzNELElBQUksUUFBUSxHQUFHLEVBQUUsQ0FBQztJQUNsQixJQUFJLEdBQUcsQ0FBQztJQUNSLElBQUksVUFBVSxDQUFDO0lBQ2YsTUFBTSxhQUFhLEdBQWlCLEVBQUUsQ0FBQztJQUN2QyxJQUFJLE1BQU0sQ0FBQyxXQUFXLEVBQUU7UUFDdEIsS0FBSyxNQUFNLFVBQVUsSUFBSSxNQUFNLENBQUMsV0FBVyxFQUFFO1lBQzNDLFVBQVUsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyx3QkFBYyxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNqRSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoRCxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQzdCLFVBQVUsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDO2dCQUM3QixRQUFRLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQzthQUM1QjtpQkFBTSxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUU7Z0JBQ3hDLEdBQUcsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDO2FBQ3ZCO2lCQUFNO2dCQUNMLHlGQUF5RjtnQkFDekYsYUFBYSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQzthQUNoQztTQUNGO0tBQ0Y7SUFFRCxPQUFPO1FBQ0wsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO1FBQ3JCLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtRQUN6QixRQUFRO1FBQ1IsR0FBRztRQUNILElBQUksRUFBRSxVQUFVO1FBQ2hCLGFBQWE7S0FDZCxDQUFDO0FBQ0osQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNJLEtBQUssVUFBVSxvQkFBb0IsQ0FBQyxRQUFnQixFQUFFLE9BQWdDO0lBQzNGLE9BQU8sZ0JBQWdCLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ2hFLENBQUM7QUFGRCxvREFFQztBQUVEOzs7Ozs7O0dBT0c7QUFDSSxLQUFLLFVBQVUsb0JBQW9CLENBQ3hDLElBQVksRUFDWixXQUEwRCxFQUMxRCxhQUFzQztJQUV0QyxNQUFNLE1BQU0sR0FBRyxnQkFBZ0IsQ0FDN0I7UUFDRSxLQUFLLEVBQUU7WUFDTCxRQUFRLEVBQUUsSUFBSTtZQUNkLFVBQVUsRUFBRSxXQUFXLENBQUMsV0FBVztZQUNuQyxVQUFVLEVBQUUsV0FBVyxDQUFDLFdBQVc7WUFDbkMsTUFBTSxFQUFFLEtBQUs7U0FDZDtLQUNGLEVBQ0QsYUFBYSxDQUNkLENBQUM7SUFFRixPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBbEJELG9EQWtCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkT3B0aW9ucywgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IERFRkFVTFRfT1VURElSLCBidW5kbGUgfSBmcm9tICcuL2VzYnVpbGQnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zIHtcbiAgd29ya3NwYWNlUm9vdD86IHN0cmluZztcbiAgb3B0aW1pemF0aW9uOiBib29sZWFuO1xuICBwcmVzZXJ2ZVN5bWxpbmtzPzogYm9vbGVhbjtcbiAgc291cmNlbWFwOiBib29sZWFuIHwgJ2V4dGVybmFsJztcbiAgb3V0cHV0TmFtZXM/OiB7IGJ1bmRsZXM/OiBzdHJpbmc7IG1lZGlhPzogc3RyaW5nIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGJ1bmRsZVN0eWxlc2hlZXQoXG4gIGVudHJ5OiBSZXF1aXJlZDxQaWNrPEJ1aWxkT3B0aW9ucywgJ3N0ZGluJz4gfCBQaWNrPEJ1aWxkT3B0aW9ucywgJ2VudHJ5UG9pbnRzJz4+LFxuICBvcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbikge1xuICAvLyBFeGVjdXRlIGVzYnVpbGRcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnVuZGxlKHtcbiAgICAuLi5lbnRyeSxcbiAgICBhYnNXb3JraW5nRGlyOiBvcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgYnVuZGxlOiB0cnVlLFxuICAgIGVudHJ5TmFtZXM6IG9wdGlvbnMub3V0cHV0TmFtZXM/LmJ1bmRsZXMsXG4gICAgYXNzZXROYW1lczogb3B0aW9ucy5vdXRwdXROYW1lcz8ubWVkaWEsXG4gICAgbG9nTGV2ZWw6ICdzaWxlbnQnLFxuICAgIG1pbmlmeTogb3B0aW9ucy5vcHRpbWl6YXRpb24sXG4gICAgc291cmNlbWFwOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICBvdXRkaXI6IERFRkFVTFRfT1VURElSLFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIHByZXNlcnZlU3ltbGlua3M6IG9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICBjb25kaXRpb25zOiBbJ3N0eWxlJ10sXG4gICAgbWFpbkZpZWxkczogWydzdHlsZSddLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIC8vIFRPRE86IHByZXByb2Nlc3NvciBwbHVnaW5zXG4gICAgXSxcbiAgfSk7XG5cbiAgLy8gRXh0cmFjdCB0aGUgcmVzdWx0IG9mIHRoZSBidW5kbGluZyBmcm9tIHRoZSBvdXRwdXQgZmlsZXNcbiAgbGV0IGNvbnRlbnRzID0gJyc7XG4gIGxldCBtYXA7XG4gIGxldCBvdXRwdXRQYXRoO1xuICBjb25zdCByZXNvdXJjZUZpbGVzOiBPdXRwdXRGaWxlW10gPSBbXTtcbiAgaWYgKHJlc3VsdC5vdXRwdXRGaWxlcykge1xuICAgIGZvciAoY29uc3Qgb3V0cHV0RmlsZSBvZiByZXN1bHQub3V0cHV0RmlsZXMpIHtcbiAgICAgIG91dHB1dEZpbGUucGF0aCA9IHBhdGgucmVsYXRpdmUoREVGQVVMVF9PVVRESVIsIG91dHB1dEZpbGUucGF0aCk7XG4gICAgICBjb25zdCBmaWxlbmFtZSA9IHBhdGguYmFzZW5hbWUob3V0cHV0RmlsZS5wYXRoKTtcbiAgICAgIGlmIChmaWxlbmFtZS5lbmRzV2l0aCgnLmNzcycpKSB7XG4gICAgICAgIG91dHB1dFBhdGggPSBvdXRwdXRGaWxlLnBhdGg7XG4gICAgICAgIGNvbnRlbnRzID0gb3V0cHV0RmlsZS50ZXh0O1xuICAgICAgfSBlbHNlIGlmIChmaWxlbmFtZS5lbmRzV2l0aCgnLmNzcy5tYXAnKSkge1xuICAgICAgICBtYXAgPSBvdXRwdXRGaWxlLnRleHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGUgb3V0cHV0IGZpbGVzIGNvdWxkIGFsc28gY29udGFpbiByZXNvdXJjZXMgKGltYWdlcy9mb250cy9ldGMuKSB0aGF0IHdlcmUgcmVmZXJlbmNlZFxuICAgICAgICByZXNvdXJjZUZpbGVzLnB1c2gob3V0cHV0RmlsZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBlcnJvcnM6IHJlc3VsdC5lcnJvcnMsXG4gICAgd2FybmluZ3M6IHJlc3VsdC53YXJuaW5ncyxcbiAgICBjb250ZW50cyxcbiAgICBtYXAsXG4gICAgcGF0aDogb3V0cHV0UGF0aCxcbiAgICByZXNvdXJjZUZpbGVzLFxuICB9O1xufVxuXG4vKipcbiAqIEJ1bmRsZSBhIHN0eWxlc2hlZXQgdGhhdCBleGlzdHMgYXMgYSBmaWxlIG9uIHRoZSBmaWxlc3lzdGVtLlxuICpcbiAqIEBwYXJhbSBmaWxlbmFtZSBUaGUgcGF0aCB0byB0aGUgZmlsZSB0byBidW5kbGUuXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgc3R5bGVzaGVldCBidW5kbGluZyBvcHRpb25zIHRvIHVzZS5cbiAqIEByZXR1cm5zIFRoZSBidW5kbGUgcmVzdWx0IG9iamVjdC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGJ1bmRsZVN0eWxlc2hlZXRGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIG9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zKSB7XG4gIHJldHVybiBidW5kbGVTdHlsZXNoZWV0KHsgZW50cnlQb2ludHM6IFtmaWxlbmFtZV0gfSwgb3B0aW9ucyk7XG59XG5cbi8qKlxuICogQnVuZGxlIHN0eWxlc2hlZXQgdGV4dCBkYXRhIGZyb20gYSBzdHJpbmcuXG4gKlxuICogQHBhcmFtIGRhdGEgVGhlIHN0cmluZyBjb250ZW50IG9mIGEgc3R5bGVzaGVldCB0byBidW5kbGUuXG4gKiBAcGFyYW0gZGF0YU9wdGlvbnMgVGhlIG9wdGlvbnMgdG8gdXNlIHRvIHJlc29sdmUgcmVmZXJlbmNlcyBhbmQgbmFtZSBvdXRwdXQgb2YgdGhlIHN0eWxlc2hlZXQgZGF0YS5cbiAqIEBwYXJhbSBidW5kbGVPcHRpb25zICBUaGUgc3R5bGVzaGVldCBidW5kbGluZyBvcHRpb25zIHRvIHVzZS5cbiAqIEByZXR1cm5zIFRoZSBidW5kbGUgcmVzdWx0IG9iamVjdC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGJ1bmRsZVN0eWxlc2hlZXRUZXh0KFxuICBkYXRhOiBzdHJpbmcsXG4gIGRhdGFPcHRpb25zOiB7IHJlc29sdmVQYXRoOiBzdHJpbmc7IHZpcnR1YWxOYW1lPzogc3RyaW5nIH0sXG4gIGJ1bmRsZU9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLFxuKSB7XG4gIGNvbnN0IHJlc3VsdCA9IGJ1bmRsZVN0eWxlc2hlZXQoXG4gICAge1xuICAgICAgc3RkaW46IHtcbiAgICAgICAgY29udGVudHM6IGRhdGEsXG4gICAgICAgIHNvdXJjZWZpbGU6IGRhdGFPcHRpb25zLnZpcnR1YWxOYW1lLFxuICAgICAgICByZXNvbHZlRGlyOiBkYXRhT3B0aW9ucy5yZXNvbHZlUGF0aCxcbiAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBidW5kbGVPcHRpb25zLFxuICApO1xuXG4gIHJldHVybiByZXN1bHQ7XG59XG4iXX0=