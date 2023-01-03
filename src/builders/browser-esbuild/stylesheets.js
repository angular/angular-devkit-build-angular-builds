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
exports.bundleComponentStylesheet = exports.createStylesheetBundleOptions = void 0;
const path = __importStar(require("node:path"));
const css_resource_plugin_1 = require("./css-resource-plugin");
const esbuild_1 = require("./esbuild");
const sass_plugin_1 = require("./sass-plugin");
function createStylesheetBundleOptions(options, inlineComponentData) {
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
            (0, sass_plugin_1.createSassPlugin)({
                sourcemap: !!options.sourcemap,
                loadPaths: options.includePaths,
                inlineComponentData,
            }),
            (0, css_resource_plugin_1.createCssResourcePlugin)(),
        ],
    };
}
exports.createStylesheetBundleOptions = createStylesheetBundleOptions;
/**
 * Bundles a component stylesheet. The stylesheet can be either an inline stylesheet that
 * is contained within the Component's metadata definition or an external file referenced
 * from the Component's metadata definition.
 *
 * @param identifier A unique string identifier for the component stylesheet.
 * @param language The language of the stylesheet such as `css` or `scss`.
 * @param data The string content of the stylesheet.
 * @param filename The filename representing the source of the stylesheet content.
 * @param inline If true, the stylesheet source is within the component metadata;
 * if false, the source is a stylesheet file.
 * @param options An object containing the stylesheet bundling options.
 * @returns An object containing the output of the bundling operation.
 */
async function bundleComponentStylesheet(identifier, language, data, filename, inline, options) {
    const namespace = 'angular:styles/component';
    const entry = [namespace, language, identifier, filename].join(';');
    const buildOptions = createStylesheetBundleOptions(options, { [entry]: data });
    buildOptions.entryPoints = [entry];
    buildOptions.plugins.push({
        name: 'angular-component-styles',
        setup(build) {
            build.onResolve({ filter: /^angular:styles\/component;/ }, (args) => {
                if (args.kind !== 'entry-point') {
                    return null;
                }
                if (inline) {
                    return {
                        path: args.path,
                        namespace,
                    };
                }
                else {
                    return {
                        path: filename,
                    };
                }
            });
            build.onLoad({ filter: /^angular:styles\/component;css;/, namespace }, async () => {
                return {
                    contents: data,
                    loader: 'css',
                    resolveDir: path.dirname(filename),
                };
            });
        },
    });
    // Execute esbuild
    const result = await (0, esbuild_1.bundle)(options.workspaceRoot, buildOptions);
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
exports.bundleComponentStylesheet = bundleComponentStylesheet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc3R5bGVzaGVldHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCxnREFBa0M7QUFDbEMsK0RBQWdFO0FBQ2hFLHVDQUFtQztBQUNuQywrQ0FBaUQ7QUFhakQsU0FBZ0IsNkJBQTZCLENBQzNDLE9BQWdDLEVBQ2hDLG1CQUE0Qzs7SUFFNUMsT0FBTztRQUNMLGFBQWEsRUFBRSxPQUFPLENBQUMsYUFBYTtRQUNwQyxNQUFNLEVBQUUsSUFBSTtRQUNaLFVBQVUsRUFBRSxNQUFBLE9BQU8sQ0FBQyxXQUFXLDBDQUFFLE9BQU87UUFDeEMsVUFBVSxFQUFFLE1BQUEsT0FBTyxDQUFDLFdBQVcsMENBQUUsS0FBSztRQUN0QyxRQUFRLEVBQUUsUUFBUTtRQUNsQixNQUFNLEVBQUUsT0FBTyxDQUFDLFlBQVk7UUFDNUIsU0FBUyxFQUFFLE9BQU8sQ0FBQyxTQUFTO1FBQzVCLE1BQU0sRUFBRSxPQUFPLENBQUMsYUFBYTtRQUM3QixLQUFLLEVBQUUsS0FBSztRQUNaLFFBQVEsRUFBRSxTQUFTO1FBQ25CLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTTtRQUN0QixnQkFBZ0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCO1FBQzFDLFFBQVEsRUFBRSxPQUFPLENBQUMsb0JBQW9CO1FBQ3RDLFVBQVUsRUFBRSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUM7UUFDN0IsVUFBVSxFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQztRQUM3QixPQUFPLEVBQUU7WUFDUCxJQUFBLDhCQUFnQixFQUFDO2dCQUNmLFNBQVMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFD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LENBQUMsTUFBTTtRQUNyQixRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7UUFDekIsUUFBUTtRQUNSLEdBQUc7UUFDSCxJQUFJLEVBQUUsVUFBVTtRQUNoQixhQUFhO0tBQ2QsQ0FBQztBQUNKLENBQUM7QUF6RUQsOERBeUVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zLCBPdXRwdXRGaWxlIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBjcmVhdGVDc3NSZXNvdXJjZVBsdWdpbiB9IGZyb20gJy4vY3NzLXJlc291cmNlLXBsdWdpbic7XG5pbXBvcnQgeyBidW5kbGUgfSBmcm9tICcuL2VzYnVpbGQnO1xuaW1wb3J0IHsgY3JlYXRlU2Fzc1BsdWdpbiB9IGZyb20gJy4vc2Fzcy1wbHVnaW4nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zIHtcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nO1xuICBvcHRpbWl6YXRpb246IGJvb2xlYW47XG4gIHByZXNlcnZlU3ltbGlua3M/OiBib29sZWFuO1xuICBzb3VyY2VtYXA6IGJvb2xlYW4gfCAnZXh0ZXJuYWwnIHwgJ2lubGluZSc7XG4gIG91dHB1dE5hbWVzPzogeyBidW5kbGVzPzogc3RyaW5nOyBtZWRpYT86IHN0cmluZyB9O1xuICBpbmNsdWRlUGF0aHM/OiBzdHJpbmdbXTtcbiAgZXh0ZXJuYWxEZXBlbmRlbmNpZXM/OiBzdHJpbmdbXTtcbiAgdGFyZ2V0OiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVN0eWxlc2hlZXRCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbiAgaW5saW5lQ29tcG9uZW50RGF0YT86IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4pOiBCdWlsZE9wdGlvbnMgJiB7IHBsdWdpbnM6IE5vbk51bGxhYmxlPEJ1aWxkT3B0aW9uc1sncGx1Z2lucyddPiB9IHtcbiAgcmV0dXJuIHtcbiAgICBhYnNXb3JraW5nRGlyOiBvcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgYnVuZGxlOiB0cnVlLFxuICAgIGVudHJ5TmFtZXM6IG9wdGlvbnMub3V0cHV0TmFtZXM/LmJ1bmRsZXMsXG4gICAgYXNzZXROYW1lczogb3B0aW9ucy5vdXRwdXROYW1lcz8ubWVkaWEsXG4gICAgbG9nTGV2ZWw6ICdzaWxlbnQnLFxuICAgIG1pbmlmeTogb3B0aW9ucy5vcHRpbWl6YXRpb24sXG4gICAgc291cmNlbWFwOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICBvdXRkaXI6IG9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICB3cml0ZTogZmFsc2UsXG4gICAgcGxhdGZvcm06ICdicm93c2VyJyxcbiAgICB0YXJnZXQ6IG9wdGlvbnMudGFyZ2V0LFxuICAgIHByZXNlcnZlU3ltbGlua3M6IG9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICBleHRlcm5hbDogb3B0aW9ucy5leHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBjb25kaXRpb25zOiBbJ3N0eWxlJywgJ3Nhc3MnXSxcbiAgICBtYWluRmllbGRzOiBbJ3N0eWxlJywgJ3Nhc3MnXSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVTYXNzUGx1Z2luKHtcbiAgICAgICAgc291cmNlbWFwOiAhIW9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICBsb2FkUGF0aHM6IG9wdGlvbnMuaW5jbHVkZVBhdGhzLFxuICAgICAgICBpbmxpbmVDb21wb25lbnREYXRhLFxuICAgICAgfSksXG4gICAgICBjcmVhdGVDc3NSZXNvdXJjZVBsdWdpbigpLFxuICAgIF0sXG4gIH07XG59XG5cbi8qKlxuICogQnVuZGxlcyBhIGNvbXBvbmVudCBzdHlsZXNoZWV0LiBUaGUgc3R5bGVzaGVldCBjYW4gYmUgZWl0aGVyIGFuIGlubGluZSBzdHlsZXNoZWV0IHRoYXRcbiAqIGlzIGNvbnRhaW5lZCB3aXRoaW4gdGhlIENvbXBvbmVudCdzIG1ldGFkYXRhIGRlZmluaXRpb24gb3IgYW4gZXh0ZXJuYWwgZmlsZSByZWZlcmVuY2VkXG4gKiBmcm9tIHRoZSBDb21wb25lbnQncyBtZXRhZGF0YSBkZWZpbml0aW9uLlxuICpcbiAqIEBwYXJhbSBpZGVudGlmaWVyIEEgdW5pcXVlIHN0cmluZyBpZGVudGlmaWVyIGZvciB0aGUgY29tcG9uZW50IHN0eWxlc2hlZXQuXG4gKiBAcGFyYW0gbGFuZ3VhZ2UgVGhlIGxhbmd1YWdlIG9mIHRoZSBzdHlsZXNoZWV0IHN1Y2ggYXMgYGNzc2Agb3IgYHNjc3NgLlxuICogQHBhcmFtIGRhdGEgVGhlIHN0cmluZyBjb250ZW50IG9mIHRoZSBzdHlsZXNoZWV0LlxuICogQHBhcmFtIGZpbGVuYW1lIFRoZSBmaWxlbmFtZSByZXByZXNlbnRpbmcgdGhlIHNvdXJjZSBvZiB0aGUgc3R5bGVzaGVldCBjb250ZW50LlxuICogQHBhcmFtIGlubGluZSBJZiB0cnVlLCB0aGUgc3R5bGVzaGVldCBzb3VyY2UgaXMgd2l0aGluIHRoZSBjb21wb25lbnQgbWV0YWRhdGE7XG4gKiBpZiBmYWxzZSwgdGhlIHNvdXJjZSBpcyBhIHN0eWxlc2hlZXQgZmlsZS5cbiAqIEBwYXJhbSBvcHRpb25zIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBzdHlsZXNoZWV0IGJ1bmRsaW5nIG9wdGlvbnMuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgb3V0cHV0IG9mIHRoZSBidW5kbGluZyBvcGVyYXRpb24uXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidW5kbGVDb21wb25lbnRTdHlsZXNoZWV0KFxuICBpZGVudGlmaWVyOiBzdHJpbmcsXG4gIGxhbmd1YWdlOiBzdHJpbmcsXG4gIGRhdGE6IHN0cmluZyxcbiAgZmlsZW5hbWU6IHN0cmluZyxcbiAgaW5saW5lOiBib29sZWFuLFxuICBvcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbikge1xuICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpzdHlsZXMvY29tcG9uZW50JztcbiAgY29uc3QgZW50cnkgPSBbbmFtZXNwYWNlLCBsYW5ndWFnZSwgaWRlbnRpZmllciwgZmlsZW5hbWVdLmpvaW4oJzsnKTtcblxuICBjb25zdCBidWlsZE9wdGlvbnMgPSBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyhvcHRpb25zLCB7IFtlbnRyeV06IGRhdGEgfSk7XG4gIGJ1aWxkT3B0aW9ucy5lbnRyeVBvaW50cyA9IFtlbnRyeV07XG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goe1xuICAgIG5hbWU6ICdhbmd1bGFyLWNvbXBvbmVudC1zdHlsZXMnLFxuICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IC9eYW5ndWxhcjpzdHlsZXNcXC9jb21wb25lbnQ7LyB9LCAoYXJncykgPT4ge1xuICAgICAgICBpZiAoYXJncy5raW5kICE9PSAnZW50cnktcG9pbnQnKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5saW5lKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBhdGg6IGFyZ3MucGF0aCxcbiAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwYXRoOiBmaWxlbmFtZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL15hbmd1bGFyOnN0eWxlc1xcL2NvbXBvbmVudDtjc3M7LywgbmFtZXNwYWNlIH0sIGFzeW5jICgpID0+IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50czogZGF0YSxcbiAgICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgICAgIHJlc29sdmVEaXI6IHBhdGguZGlybmFtZShmaWxlbmFtZSksXG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICB9LFxuICB9KTtcblxuICAvLyBFeGVjdXRlIGVzYnVpbGRcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnVuZGxlKG9wdGlvbnMud29ya3NwYWNlUm9vdCwgYnVpbGRPcHRpb25zKTtcblxuICAvLyBFeHRyYWN0IHRoZSByZXN1bHQgb2YgdGhlIGJ1bmRsaW5nIGZyb20gdGhlIG91dHB1dCBmaWxlc1xuICBsZXQgY29udGVudHMgPSAnJztcbiAgbGV0IG1hcDtcbiAgbGV0IG91dHB1dFBhdGg7XG4gIGNvbnN0IHJlc291cmNlRmlsZXM6IE91dHB1dEZpbGVbXSA9IFtdO1xuICBpZiAocmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgZm9yIChjb25zdCBvdXRwdXRGaWxlIG9mIHJlc3VsdC5vdXRwdXRGaWxlcykge1xuICAgICAgY29uc3QgZmlsZW5hbWUgPSBwYXRoLmJhc2VuYW1lKG91dHB1dEZpbGUucGF0aCk7XG4gICAgICBpZiAoZmlsZW5hbWUuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgICBvdXRwdXRQYXRoID0gb3V0cHV0RmlsZS5wYXRoO1xuICAgICAgICBjb250ZW50cyA9IG91dHB1dEZpbGUudGV4dDtcbiAgICAgIH0gZWxzZSBpZiAoZmlsZW5hbWUuZW5kc1dpdGgoJy5jc3MubWFwJykpIHtcbiAgICAgICAgbWFwID0gb3V0cHV0RmlsZS50ZXh0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhlIG91dHB1dCBmaWxlcyBjb3VsZCBhbHNvIGNvbnRhaW4gcmVzb3VyY2VzIChpbWFnZXMvZm9udHMvZXRjLikgdGhhdCB3ZXJlIHJlZmVyZW5jZWRcbiAgICAgICAgcmVzb3VyY2VGaWxlcy5wdXNoKG91dHB1dEZpbGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZXJyb3JzOiByZXN1bHQuZXJyb3JzLFxuICAgIHdhcm5pbmdzOiByZXN1bHQud2FybmluZ3MsXG4gICAgY29udGVudHMsXG4gICAgbWFwLFxuICAgIHBhdGg6IG91dHB1dFBhdGgsXG4gICAgcmVzb3VyY2VGaWxlcyxcbiAgfTtcbn1cbiJdfQ==