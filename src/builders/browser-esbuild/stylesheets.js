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
    var _a, _b, _c;
    const loadPaths = (_a = options.includePaths) !== null && _a !== void 0 ? _a : [];
    // Needed to resolve node packages.
    loadPaths.push(path.join(options.workspaceRoot, 'node_modules'));
    // Execute esbuild
    const result = await (0, esbuild_1.bundle)({
        ...entry,
        absWorkingDir: options.workspaceRoot,
        bundle: true,
        entryNames: (_b = options.outputNames) === null || _b === void 0 ? void 0 : _b.bundles,
        assetNames: (_c = options.outputNames) === null || _c === void 0 ? void 0 : _c.media,
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
            (0, sass_plugin_1.createSassPlugin)({ sourcemap: !!options.sourcemap, loadPaths }),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc3R5bGVzaGVldHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCwyQ0FBNkI7QUFDN0IsK0RBQWdFO0FBQ2hFLHVDQUFtQztBQUNuQywrQ0FBaUQ7QUFZakQsS0FBSyxVQUFVLGdCQUFnQixDQUM3QixLQUFnRixFQUNoRixPQUFnQzs7SUFFaEMsTUFBTSxTQUFTLEdBQUcsTUFBQSxPQUFPLENBQUMsWUFBWSxtQ0FBSSxFQUFFLENBQUM7SUFDN0MsbUNBQW1DO0lBQ25DLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7SUFFakUsa0JBQWtCO0lBQ2xCLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBQSxnQkFBTSxFQUFDO1FBQzFCLEdBQUcsS0FBSztRQUNSLGFBQWEsRUFBRSxPQUFPLENBQUMsYUFBYTtRQUNwQyxNQUFNLEVBQUUsSUFBSTtRQUNaLFVBQVUsRUFBRSxNQUFBLE9BQU8sQ0FBQyxXQUFXLDBDQUFFLE9BQU87UUFDeEMsVUFBVSxFQUFFLE1BQUEsT0FBTyxDQUFDLFdBQVcsMENBQUUsS0FBSztRQUN0QyxRQUFRLEVBQUUsUUFBUTtRQUNsQixNQUFNLEVBQUUsT0FBTyxDQUFDLFlBQVk7UUFDNUIsU0FBUyxFQUFFLE9BQU8sQ0FBQyxTQUFTO1FBQzVCLE1BQU0sRUFBRSxPQUFPLENBQUMsYUFBYTtRQUM3QixLQUFLLEVBQUUsS0FBSztRQUNaLFFBQVEsRUFBRSxTQUFTO1FBQ25CLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxnQkFBZ0I7UUFDMUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxvQkFBb0I7UUFDdEMsVUFBVSxFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQztRQUM3QixVQUFVLEVBQUUsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDO1FBQzdCLE9BQU8sRUFBRTtZQUNQLElBQUEsOEJBQWdCLEVBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLENBQUM7WUFDL0QsSUFBQSw2Q0FBdUIsR0FBRTtTQUMxQjtLQUNGLENBQUMsQ0FBQztJQUVILDJEQUEyRDtJQUMzRCxJQUFJLFFBQVEsR0FBRyxFQUFFLENBQUM7SUFDbEIsSUFBSSxHQUFHLENBQUM7SUFDUixJQUFJLFVBQVUsQ0FBQztJQUNmLE1BQU0sYUFBYSxHQUFpQixFQUFFLENBQUM7SUFDdkMsSUFBSSxNQUFNLENBQUMsV0FBVyxFQUFFO1FBQ3RCLEtBQUssTUFBTSxVQUFVLElBQUksTUFBTSxDQUFDLFdBQVcsRUFBRTtZQUMzQyxVQUFVLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDeEUsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDaEQsSUFBSSxRQUFRLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUM3QixVQUFVLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQztnQkFDN0IsUUFBUSxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUM7YUFDNUI7aUJBQU0sSUFBSSxRQUFRLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxFQUFFO2dCQUN4QyxHQUFHLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQzthQUN2QjtpQkFBTTtnQkFDTCx5RkFBeUY7Z0JBQ3pGLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7YUFDaEM7U0FDRjtLQUNGO0lBRUQsT0FBTztRQUNMLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTTtRQUNyQixRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7UUFDekIsUUFBUTtRQUNSLEdBQUc7UUFDSCxJQUFJLEVBQUUsVUFBVTtRQUNoQixhQUFhO0tBQ2QsQ0FBQztBQUNKLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSSxLQUFLLFVBQVUsb0JBQW9CLENBQUMsUUFBZ0IsRUFBRSxPQUFnQztJQUMzRixPQUFPLGdCQUFnQixDQUFDLEVBQUUsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUNoRSxDQUFDO0FBRkQsb0RBRUM7QUFFRDs7Ozs7OztHQU9HO0FBQ0ksS0FBSyxVQUFVLG9CQUFvQixDQUN4QyxJQUFZLEVBQ1osV0FBMEQsRUFDMUQsYUFBc0M7SUFFdEMsTUFBTSxNQUFNLEdBQUcsZ0JBQWdCLENBQzdCO1FBQ0UsS0FBSyxFQUFFO1lBQ0wsUUFBUSxFQUFFLElBQUk7WUFDZCxVQUFVLEVBQUUsV0FBVyxDQUFDLFdBQVc7WUFDbkMsVUFBVSxFQUFFLFdBQVcsQ0FBQyxXQUFXO1lBQ25DLE1BQU0sRUFBRSxLQUFLO1NBQ2Q7S0FDRixFQUNELGFBQWEsQ0FDZCxDQUFDO0lBRUYsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQWxCRCxvREFrQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZE9wdGlvbnMsIE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBjcmVhdGVDc3NSZXNvdXJjZVBsdWdpbiB9IGZyb20gJy4vY3NzLXJlc291cmNlLXBsdWdpbic7XG5pbXBvcnQgeyBidW5kbGUgfSBmcm9tICcuL2VzYnVpbGQnO1xuaW1wb3J0IHsgY3JlYXRlU2Fzc1BsdWdpbiB9IGZyb20gJy4vc2Fzcy1wbHVnaW4nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zIHtcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nO1xuICBvcHRpbWl6YXRpb246IGJvb2xlYW47XG4gIHByZXNlcnZlU3ltbGlua3M/OiBib29sZWFuO1xuICBzb3VyY2VtYXA6IGJvb2xlYW4gfCAnZXh0ZXJuYWwnIHwgJ2lubGluZSc7XG4gIG91dHB1dE5hbWVzPzogeyBidW5kbGVzPzogc3RyaW5nOyBtZWRpYT86IHN0cmluZyB9O1xuICBpbmNsdWRlUGF0aHM/OiBzdHJpbmdbXTtcbiAgZXh0ZXJuYWxEZXBlbmRlbmNpZXM/OiBzdHJpbmdbXTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYnVuZGxlU3R5bGVzaGVldChcbiAgZW50cnk6IFJlcXVpcmVkPFBpY2s8QnVpbGRPcHRpb25zLCAnc3RkaW4nPiB8IFBpY2s8QnVpbGRPcHRpb25zLCAnZW50cnlQb2ludHMnPj4sXG4gIG9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLFxuKSB7XG4gIGNvbnN0IGxvYWRQYXRocyA9IG9wdGlvbnMuaW5jbHVkZVBhdGhzID8/IFtdO1xuICAvLyBOZWVkZWQgdG8gcmVzb2x2ZSBub2RlIHBhY2thZ2VzLlxuICBsb2FkUGF0aHMucHVzaChwYXRoLmpvaW4ob3B0aW9ucy53b3Jrc3BhY2VSb290LCAnbm9kZV9tb2R1bGVzJykpO1xuXG4gIC8vIEV4ZWN1dGUgZXNidWlsZFxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBidW5kbGUoe1xuICAgIC4uLmVudHJ5LFxuICAgIGFic1dvcmtpbmdEaXI6IG9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IHRydWUsXG4gICAgZW50cnlOYW1lczogb3B0aW9ucy5vdXRwdXROYW1lcz8uYnVuZGxlcyxcbiAgICBhc3NldE5hbWVzOiBvcHRpb25zLm91dHB1dE5hbWVzPy5tZWRpYSxcbiAgICBsb2dMZXZlbDogJ3NpbGVudCcsXG4gICAgbWluaWZ5OiBvcHRpb25zLm9wdGltaXphdGlvbixcbiAgICBzb3VyY2VtYXA6IG9wdGlvbnMuc291cmNlbWFwLFxuICAgIG91dGRpcjogb3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIHByZXNlcnZlU3ltbGlua3M6IG9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICBleHRlcm5hbDogb3B0aW9ucy5leHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBjb25kaXRpb25zOiBbJ3N0eWxlJywgJ3Nhc3MnXSxcbiAgICBtYWluRmllbGRzOiBbJ3N0eWxlJywgJ3Nhc3MnXSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVTYXNzUGx1Z2luKHsgc291cmNlbWFwOiAhIW9wdGlvbnMuc291cmNlbWFwLCBsb2FkUGF0aHMgfSksXG4gICAgICBjcmVhdGVDc3NSZXNvdXJjZVBsdWdpbigpLFxuICAgIF0sXG4gIH0pO1xuXG4gIC8vIEV4dHJhY3QgdGhlIHJlc3VsdCBvZiB0aGUgYnVuZGxpbmcgZnJvbSB0aGUgb3V0cHV0IGZpbGVzXG4gIGxldCBjb250ZW50cyA9ICcnO1xuICBsZXQgbWFwO1xuICBsZXQgb3V0cHV0UGF0aDtcbiAgY29uc3QgcmVzb3VyY2VGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gIGlmIChyZXN1bHQub3V0cHV0RmlsZXMpIHtcbiAgICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2YgcmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgICBvdXRwdXRGaWxlLnBhdGggPSBwYXRoLnJlbGF0aXZlKG9wdGlvbnMud29ya3NwYWNlUm9vdCwgb3V0cHV0RmlsZS5wYXRoKTtcbiAgICAgIGNvbnN0IGZpbGVuYW1lID0gcGF0aC5iYXNlbmFtZShvdXRwdXRGaWxlLnBhdGgpO1xuICAgICAgaWYgKGZpbGVuYW1lLmVuZHNXaXRoKCcuY3NzJykpIHtcbiAgICAgICAgb3V0cHV0UGF0aCA9IG91dHB1dEZpbGUucGF0aDtcbiAgICAgICAgY29udGVudHMgPSBvdXRwdXRGaWxlLnRleHQ7XG4gICAgICB9IGVsc2UgaWYgKGZpbGVuYW1lLmVuZHNXaXRoKCcuY3NzLm1hcCcpKSB7XG4gICAgICAgIG1hcCA9IG91dHB1dEZpbGUudGV4dDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoZSBvdXRwdXQgZmlsZXMgY291bGQgYWxzbyBjb250YWluIHJlc291cmNlcyAoaW1hZ2VzL2ZvbnRzL2V0Yy4pIHRoYXQgd2VyZSByZWZlcmVuY2VkXG4gICAgICAgIHJlc291cmNlRmlsZXMucHVzaChvdXRwdXRGaWxlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGVycm9yczogcmVzdWx0LmVycm9ycyxcbiAgICB3YXJuaW5nczogcmVzdWx0Lndhcm5pbmdzLFxuICAgIGNvbnRlbnRzLFxuICAgIG1hcCxcbiAgICBwYXRoOiBvdXRwdXRQYXRoLFxuICAgIHJlc291cmNlRmlsZXMsXG4gIH07XG59XG5cbi8qKlxuICogQnVuZGxlIGEgc3R5bGVzaGVldCB0aGF0IGV4aXN0cyBhcyBhIGZpbGUgb24gdGhlIGZpbGVzeXN0ZW0uXG4gKlxuICogQHBhcmFtIGZpbGVuYW1lIFRoZSBwYXRoIHRvIHRoZSBmaWxlIHRvIGJ1bmRsZS5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBzdHlsZXNoZWV0IGJ1bmRsaW5nIG9wdGlvbnMgdG8gdXNlLlxuICogQHJldHVybnMgVGhlIGJ1bmRsZSByZXN1bHQgb2JqZWN0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYnVuZGxlU3R5bGVzaGVldEZpbGUoZmlsZW5hbWU6IHN0cmluZywgb3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMpIHtcbiAgcmV0dXJuIGJ1bmRsZVN0eWxlc2hlZXQoeyBlbnRyeVBvaW50czogW2ZpbGVuYW1lXSB9LCBvcHRpb25zKTtcbn1cblxuLyoqXG4gKiBCdW5kbGUgc3R5bGVzaGVldCB0ZXh0IGRhdGEgZnJvbSBhIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0gZGF0YSBUaGUgc3RyaW5nIGNvbnRlbnQgb2YgYSBzdHlsZXNoZWV0IHRvIGJ1bmRsZS5cbiAqIEBwYXJhbSBkYXRhT3B0aW9ucyBUaGUgb3B0aW9ucyB0byB1c2UgdG8gcmVzb2x2ZSByZWZlcmVuY2VzIGFuZCBuYW1lIG91dHB1dCBvZiB0aGUgc3R5bGVzaGVldCBkYXRhLlxuICogQHBhcmFtIGJ1bmRsZU9wdGlvbnMgIFRoZSBzdHlsZXNoZWV0IGJ1bmRsaW5nIG9wdGlvbnMgdG8gdXNlLlxuICogQHJldHVybnMgVGhlIGJ1bmRsZSByZXN1bHQgb2JqZWN0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYnVuZGxlU3R5bGVzaGVldFRleHQoXG4gIGRhdGE6IHN0cmluZyxcbiAgZGF0YU9wdGlvbnM6IHsgcmVzb2x2ZVBhdGg6IHN0cmluZzsgdmlydHVhbE5hbWU/OiBzdHJpbmcgfSxcbiAgYnVuZGxlT3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsXG4pIHtcbiAgY29uc3QgcmVzdWx0ID0gYnVuZGxlU3R5bGVzaGVldChcbiAgICB7XG4gICAgICBzdGRpbjoge1xuICAgICAgICBjb250ZW50czogZGF0YSxcbiAgICAgICAgc291cmNlZmlsZTogZGF0YU9wdGlvbnMudmlydHVhbE5hbWUsXG4gICAgICAgIHJlc29sdmVEaXI6IGRhdGFPcHRpb25zLnJlc29sdmVQYXRoLFxuICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgfSxcbiAgICB9LFxuICAgIGJ1bmRsZU9wdGlvbnMsXG4gICk7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdfQ==