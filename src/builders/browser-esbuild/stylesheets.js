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
exports.bundleStylesheetText = exports.bundleStylesheetFile = exports.createStylesheetBundleOptions = void 0;
const path = __importStar(require("path"));
const css_resource_plugin_1 = require("./css-resource-plugin");
const esbuild_1 = require("./esbuild");
const sass_plugin_1 = require("./sass-plugin");
function createStylesheetBundleOptions(options) {
    var _a, _b;
    return {
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
        target: options.target,
        preserveSymlinks: options.preserveSymlinks,
        external: options.externalDependencies,
        conditions: ['style', 'sass'],
        mainFields: ['style', 'sass'],
        plugins: [
            (0, sass_plugin_1.createSassPlugin)({ sourcemap: !!options.sourcemap, loadPaths: options.includePaths }),
            (0, css_resource_plugin_1.createCssResourcePlugin)(),
        ],
    };
}
exports.createStylesheetBundleOptions = createStylesheetBundleOptions;
async function bundleStylesheet(entry, options) {
    // Execute esbuild
    const result = await (0, esbuild_1.bundle)(options.workspaceRoot, {
        ...createStylesheetBundleOptions(options),
        ...entry,
    });
    // Extract the result of the bundling from the output files
    let contents = '';
    let map;
    let outputPath;
    const resourceFiles = [];
    if (result.outputFiles) {
        for (const outputFile of result.outputFiles) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc3R5bGVzaGVldHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCwyQ0FBNkI7QUFDN0IsK0RBQWdFO0FBQ2hFLHVDQUFtQztBQUNuQywrQ0FBaUQ7QUFhakQsU0FBZ0IsNkJBQTZCLENBQzNDLE9BQWdDOztJQUVoQyxPQUFPO1FBQ0wsYUFBYSxFQUFFLE9BQU8sQ0FBQyxhQUFhO1FBQ3BDLE1BQU0sRUFBRSxJQUFJO1FBQ1osVUFBVSxFQUFFLE1BQUEsT0FBTyxDQUFDLFdBQVcsMENBQUUsT0FBTztRQUN4QyxVQUFVLEVBQUUsTUFBQSxPQUFPLENBQUMsV0FBVywwQ0FBRSxLQUFLO1FBQ3RDLFFBQVEsRUFBRSxRQUFRO1FBQ2xCLE1BQU0sRUFBRSxPQUFPLENBQUMsWUFBWTtRQUM1QixTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVM7UUFDNUIsTUFBTSxFQUFFLE9BQU8sQ0FBQyxhQUFhO1FBQzdCLEtBQUssRUFBRSxLQUFLO1FBQ1osUUFBUSxFQUFFLFNBQVM7UUFDbkIsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNO1FBQ3RCLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxnQkFBZ0I7UUFDMUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxvQkFBb0I7UUFDdEMsVUFBVSxFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQztRQUM3QixVQUFVLEVBQUUsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDO1FBQzdCLE9BQU8sRUFBRTtZQUNQLElBQUEsOEJBQWdCLEVBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNyRixJQUFBLDZDQUF1QixHQUFFO1NBQzFCO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUF4QkQsc0VBd0JDO0FBRUQsS0FBSyxVQUFVLGdCQUFnQixDQUM3QixLQUFnRixFQUNoRixPQUFnQztJQUVoQyxrQkFBa0I7SUFDbEIsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFBLGdCQUFNLEVBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRTtRQUNqRCxHQUFHLDZCQUE2QixDQUFDLE9BQU8sQ0FBQztRQUN6QyxHQUFHLEtBQUs7S0FDVCxDQUFDLENBQUM7SUFFSCwyREFBMkQ7SUFDM0QsSUFBSSxRQUFRLEdBQUcsRUFBRSxDQUFDO0lBQ2xCLElBQUksR0FBRyxDQUFDO0lBQ1IsSUFBSSxVQUFVLENBQUM7SUFDZixNQUFNLGFBQWEsR0FBaUIsRUFBRSxDQUFDO0lBQ3ZDLElBQUksTUFBTSxDQUFDLFdBQVcsRUFBRTtRQUN0QixLQUFLLE1BQU0sVUFBVSxJQUFJLE1BQU0sQ0FBQyxXQUFXLEVBQUU7WUFDM0MsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDaEQsSUFBSSxRQUFRLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUM3QixVQUFVLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQztnQkFDN0IsUUFBUSxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUM7YUFDNUI7aUJBQU0sSUFBSSxRQUFRLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxFQUFFO2dCQUN4QyxHQUFHLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQzthQUN2QjtpQkFBTTtnQkFDTCx5RkFBeUY7Z0JBQ3pGLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7YUFDaEM7U0FDRjtLQUNGO0lBRUQsT0FBTztRQUNMLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTTtRQUNyQixRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7UUFDekIsUUFBUTtRQUNSLEdBQUc7UUFDSCxJQUFJLEVBQUUsVUFBVTtRQUNoQixhQUFhO0tBQ2QsQ0FBQztBQUNKLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSSxLQUFLLFVBQVUsb0JBQW9CLENBQUMsUUFBZ0IsRUFBRSxPQUFnQztJQUMzRixPQUFPLGdCQUFnQixDQUFDLEVBQUUsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUNoRSxDQUFDO0FBRkQsb0RBRUM7QUFFRDs7Ozs7OztHQU9HO0FBQ0ksS0FBSyxVQUFVLG9CQUFvQixDQUN4QyxJQUFZLEVBQ1osV0FBMEQsRUFDMUQsYUFBc0M7SUFFdEMsTUFBTSxNQUFNLEdBQUcsZ0JBQWdCLENBQzdCO1FBQ0UsS0FBSyxFQUFFO1lBQ0wsUUFBUSxFQUFFLElBQUk7WUFDZCxVQUFVLEVBQUUsV0FBVyxDQUFDLFdBQVc7WUFDbkMsVUFBVSxFQUFFLFdBQVcsQ0FBQyxXQUFXO1lBQ25DLE1BQU0sRUFBRSxLQUFLO1NBQ2Q7S0FDRixFQUNELGFBQWEsQ0FDZCxDQUFDO0lBRUYsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQWxCRCxvREFrQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZE9wdGlvbnMsIE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBjcmVhdGVDc3NSZXNvdXJjZVBsdWdpbiB9IGZyb20gJy4vY3NzLXJlc291cmNlLXBsdWdpbic7XG5pbXBvcnQgeyBidW5kbGUgfSBmcm9tICcuL2VzYnVpbGQnO1xuaW1wb3J0IHsgY3JlYXRlU2Fzc1BsdWdpbiB9IGZyb20gJy4vc2Fzcy1wbHVnaW4nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zIHtcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nO1xuICBvcHRpbWl6YXRpb246IGJvb2xlYW47XG4gIHByZXNlcnZlU3ltbGlua3M/OiBib29sZWFuO1xuICBzb3VyY2VtYXA6IGJvb2xlYW4gfCAnZXh0ZXJuYWwnIHwgJ2lubGluZSc7XG4gIG91dHB1dE5hbWVzPzogeyBidW5kbGVzPzogc3RyaW5nOyBtZWRpYT86IHN0cmluZyB9O1xuICBpbmNsdWRlUGF0aHM/OiBzdHJpbmdbXTtcbiAgZXh0ZXJuYWxEZXBlbmRlbmNpZXM/OiBzdHJpbmdbXTtcbiAgdGFyZ2V0OiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVN0eWxlc2hlZXRCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbik6IEJ1aWxkT3B0aW9ucyAmIHsgcGx1Z2luczogTm9uTnVsbGFibGU8QnVpbGRPcHRpb25zWydwbHVnaW5zJ10+IH0ge1xuICByZXR1cm4ge1xuICAgIGFic1dvcmtpbmdEaXI6IG9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IHRydWUsXG4gICAgZW50cnlOYW1lczogb3B0aW9ucy5vdXRwdXROYW1lcz8uYnVuZGxlcyxcbiAgICBhc3NldE5hbWVzOiBvcHRpb25zLm91dHB1dE5hbWVzPy5tZWRpYSxcbiAgICBsb2dMZXZlbDogJ3NpbGVudCcsXG4gICAgbWluaWZ5OiBvcHRpb25zLm9wdGltaXphdGlvbixcbiAgICBzb3VyY2VtYXA6IG9wdGlvbnMuc291cmNlbWFwLFxuICAgIG91dGRpcjogb3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIHRhcmdldDogb3B0aW9ucy50YXJnZXQsXG4gICAgcHJlc2VydmVTeW1saW5rczogb3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIGV4dGVybmFsOiBvcHRpb25zLmV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIGNvbmRpdGlvbnM6IFsnc3R5bGUnLCAnc2FzcyddLFxuICAgIG1haW5GaWVsZHM6IFsnc3R5bGUnLCAnc2FzcyddLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNhc3NQbHVnaW4oeyBzb3VyY2VtYXA6ICEhb3B0aW9ucy5zb3VyY2VtYXAsIGxvYWRQYXRoczogb3B0aW9ucy5pbmNsdWRlUGF0aHMgfSksXG4gICAgICBjcmVhdGVDc3NSZXNvdXJjZVBsdWdpbigpLFxuICAgIF0sXG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGJ1bmRsZVN0eWxlc2hlZXQoXG4gIGVudHJ5OiBSZXF1aXJlZDxQaWNrPEJ1aWxkT3B0aW9ucywgJ3N0ZGluJz4gfCBQaWNrPEJ1aWxkT3B0aW9ucywgJ2VudHJ5UG9pbnRzJz4+LFxuICBvcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbikge1xuICAvLyBFeGVjdXRlIGVzYnVpbGRcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnVuZGxlKG9wdGlvbnMud29ya3NwYWNlUm9vdCwge1xuICAgIC4uLmNyZWF0ZVN0eWxlc2hlZXRCdW5kbGVPcHRpb25zKG9wdGlvbnMpLFxuICAgIC4uLmVudHJ5LFxuICB9KTtcblxuICAvLyBFeHRyYWN0IHRoZSByZXN1bHQgb2YgdGhlIGJ1bmRsaW5nIGZyb20gdGhlIG91dHB1dCBmaWxlc1xuICBsZXQgY29udGVudHMgPSAnJztcbiAgbGV0IG1hcDtcbiAgbGV0IG91dHB1dFBhdGg7XG4gIGNvbnN0IHJlc291cmNlRmlsZXM6IE91dHB1dEZpbGVbXSA9IFtdO1xuICBpZiAocmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgZm9yIChjb25zdCBvdXRwdXRGaWxlIG9mIHJlc3VsdC5vdXRwdXRGaWxlcykge1xuICAgICAgY29uc3QgZmlsZW5hbWUgPSBwYXRoLmJhc2VuYW1lKG91dHB1dEZpbGUucGF0aCk7XG4gICAgICBpZiAoZmlsZW5hbWUuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgICBvdXRwdXRQYXRoID0gb3V0cHV0RmlsZS5wYXRoO1xuICAgICAgICBjb250ZW50cyA9IG91dHB1dEZpbGUudGV4dDtcbiAgICAgIH0gZWxzZSBpZiAoZmlsZW5hbWUuZW5kc1dpdGgoJy5jc3MubWFwJykpIHtcbiAgICAgICAgbWFwID0gb3V0cHV0RmlsZS50ZXh0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhlIG91dHB1dCBmaWxlcyBjb3VsZCBhbHNvIGNvbnRhaW4gcmVzb3VyY2VzIChpbWFnZXMvZm9udHMvZXRjLikgdGhhdCB3ZXJlIHJlZmVyZW5jZWRcbiAgICAgICAgcmVzb3VyY2VGaWxlcy5wdXNoKG91dHB1dEZpbGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZXJyb3JzOiByZXN1bHQuZXJyb3JzLFxuICAgIHdhcm5pbmdzOiByZXN1bHQud2FybmluZ3MsXG4gICAgY29udGVudHMsXG4gICAgbWFwLFxuICAgIHBhdGg6IG91dHB1dFBhdGgsXG4gICAgcmVzb3VyY2VGaWxlcyxcbiAgfTtcbn1cblxuLyoqXG4gKiBCdW5kbGUgYSBzdHlsZXNoZWV0IHRoYXQgZXhpc3RzIGFzIGEgZmlsZSBvbiB0aGUgZmlsZXN5c3RlbS5cbiAqXG4gKiBAcGFyYW0gZmlsZW5hbWUgVGhlIHBhdGggdG8gdGhlIGZpbGUgdG8gYnVuZGxlLlxuICogQHBhcmFtIG9wdGlvbnMgVGhlIHN0eWxlc2hlZXQgYnVuZGxpbmcgb3B0aW9ucyB0byB1c2UuXG4gKiBAcmV0dXJucyBUaGUgYnVuZGxlIHJlc3VsdCBvYmplY3QuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidW5kbGVTdHlsZXNoZWV0RmlsZShmaWxlbmFtZTogc3RyaW5nLCBvcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucykge1xuICByZXR1cm4gYnVuZGxlU3R5bGVzaGVldCh7IGVudHJ5UG9pbnRzOiBbZmlsZW5hbWVdIH0sIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIEJ1bmRsZSBzdHlsZXNoZWV0IHRleHQgZGF0YSBmcm9tIGEgc3RyaW5nLlxuICpcbiAqIEBwYXJhbSBkYXRhIFRoZSBzdHJpbmcgY29udGVudCBvZiBhIHN0eWxlc2hlZXQgdG8gYnVuZGxlLlxuICogQHBhcmFtIGRhdGFPcHRpb25zIFRoZSBvcHRpb25zIHRvIHVzZSB0byByZXNvbHZlIHJlZmVyZW5jZXMgYW5kIG5hbWUgb3V0cHV0IG9mIHRoZSBzdHlsZXNoZWV0IGRhdGEuXG4gKiBAcGFyYW0gYnVuZGxlT3B0aW9ucyAgVGhlIHN0eWxlc2hlZXQgYnVuZGxpbmcgb3B0aW9ucyB0byB1c2UuXG4gKiBAcmV0dXJucyBUaGUgYnVuZGxlIHJlc3VsdCBvYmplY3QuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidW5kbGVTdHlsZXNoZWV0VGV4dChcbiAgZGF0YTogc3RyaW5nLFxuICBkYXRhT3B0aW9uczogeyByZXNvbHZlUGF0aDogc3RyaW5nOyB2aXJ0dWFsTmFtZT86IHN0cmluZyB9LFxuICBidW5kbGVPcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbikge1xuICBjb25zdCByZXN1bHQgPSBidW5kbGVTdHlsZXNoZWV0KFxuICAgIHtcbiAgICAgIHN0ZGluOiB7XG4gICAgICAgIGNvbnRlbnRzOiBkYXRhLFxuICAgICAgICBzb3VyY2VmaWxlOiBkYXRhT3B0aW9ucy52aXJ0dWFsTmFtZSxcbiAgICAgICAgcmVzb2x2ZURpcjogZGF0YU9wdGlvbnMucmVzb2x2ZVBhdGgsXG4gICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICB9LFxuICAgIH0sXG4gICAgYnVuZGxlT3B0aW9ucyxcbiAgKTtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuIl19