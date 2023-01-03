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
    var _a, _b, _c;
    return {
        absWorkingDir: options.workspaceRoot,
        bundle: true,
        entryNames: (_a = options.outputNames) === null || _a === void 0 ? void 0 : _a.bundles,
        assetNames: (_b = options.outputNames) === null || _b === void 0 ? void 0 : _b.media,
        logLevel: 'silent',
        minify: options.optimization,
        metafile: true,
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
                // Ensure Sass load paths are absolute based on the workspace root
                loadPaths: (_c = options.includePaths) === null || _c === void 0 ? void 0 : _c.map((includePath) => path.resolve(options.workspaceRoot, includePath)),
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
        metafile: result.outputFiles && result.metafile,
    };
}
exports.bundleComponentStylesheet = bundleComponentStylesheet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc3R5bGVzaGVldHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCxnREFBa0M7QUFDbEMsK0RBQWdFO0FBQ2hFLHVDQUFtQztBQUNuQywrQ0FBaUQ7QUFhakQsU0FBZ0IsNkJBQTZCLENBQzNDLE9BQWdDLEVBQ2hDLG1CQUE0Qzs7SUFFNUMsT0FBTztRQUNMLGFBQWEsRUFBRSxPQUFPLENBQUMsYUFBYTtRQUNwQyxNQUFNLEVBQUUsSUFBSTtRQUNaLFVBQVUsRUFBRSxNQUFBLE9BQU8sQ0FBQyxXQUFXLDBDQUFFLE9BQU87UUFDeEMsVUFBVSxFQUFFLE1BQUEsT0FBTyxDQUFDLFdBQVcsMENBQUUsS0FBSztRQUN0QyxRQUFRLEVBQUUsUUFBUTtRQUNsQixNQUFNLEVBQUUsT0FBTyxDQUFDLFlBQVk7UUFDNUIsUUFBUSxFQUFFLElBQUk7UUFDZCxTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVM7UUFDNUIsTUFBTSxFQUFFLE9BQU8sQ0FBQyxhQUFhO1FBQzdCLEtBQUssRUFBRSxLQUFLO1FBQ1osUUFBUSxFQUFFLFNBQVM7UUFDbkIsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNO1FBQ3RCLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxnQkFBZ0I7UUFDMUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxvQkFBb0I7UUFDdEMsVUFBVSxFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQztRQUM3QixVQUFVLEVBQUUsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDO1FBQzdCLE9BQU8sRUFBRTtZQUNQLElBQUEsOEJBQWdCLEVBQUM7Z0JBQ2YsU0FBUyxFQUFF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QUFHLFVBQVUsQ0FBQyxJQUFJLENBQUM7YUFDdkI7aUJBQU07Z0JBQ0wseUZBQXlGO2dCQUN6RixhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2FBQ2hDO1NBQ0Y7S0FDRjtJQUVELE9BQU87UUFDTCxNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU07UUFDckIsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRO1FBQ3pCLFFBQVE7UUFDUixHQUFHO1FBQ0gsSUFBSSxFQUFFLFVBQVU7UUFDaEIsYUFBYTtRQUNiLFFBQVEsRUFBRSxNQUFNLENBQUMsV0FBVyxJQUFJLE1BQU0sQ0FBQyxRQUFRO0tBQ2hELENBQUM7QUFDSixDQUFDO0FBMUVELDhEQTBFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkT3B0aW9ucywgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgY3JlYXRlQ3NzUmVzb3VyY2VQbHVnaW4gfSBmcm9tICcuL2Nzcy1yZXNvdXJjZS1wbHVnaW4nO1xuaW1wb3J0IHsgYnVuZGxlIH0gZnJvbSAnLi9lc2J1aWxkJztcbmltcG9ydCB7IGNyZWF0ZVNhc3NQbHVnaW4gfSBmcm9tICcuL3Nhc3MtcGx1Z2luJztcblxuZXhwb3J0IGludGVyZmFjZSBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyB7XG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZztcbiAgb3B0aW1pemF0aW9uOiBib29sZWFuO1xuICBwcmVzZXJ2ZVN5bWxpbmtzPzogYm9vbGVhbjtcbiAgc291cmNlbWFwOiBib29sZWFuIHwgJ2V4dGVybmFsJyB8ICdpbmxpbmUnO1xuICBvdXRwdXROYW1lcz86IHsgYnVuZGxlcz86IHN0cmluZzsgbWVkaWE/OiBzdHJpbmcgfTtcbiAgaW5jbHVkZVBhdGhzPzogc3RyaW5nW107XG4gIGV4dGVybmFsRGVwZW5kZW5jaWVzPzogc3RyaW5nW107XG4gIHRhcmdldDogc3RyaW5nW107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsXG4gIGlubGluZUNvbXBvbmVudERhdGE/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+LFxuKTogQnVpbGRPcHRpb25zICYgeyBwbHVnaW5zOiBOb25OdWxsYWJsZTxCdWlsZE9wdGlvbnNbJ3BsdWdpbnMnXT4gfSB7XG4gIHJldHVybiB7XG4gICAgYWJzV29ya2luZ0Rpcjogb3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICBlbnRyeU5hbWVzOiBvcHRpb25zLm91dHB1dE5hbWVzPy5idW5kbGVzLFxuICAgIGFzc2V0TmFtZXM6IG9wdGlvbnMub3V0cHV0TmFtZXM/Lm1lZGlhLFxuICAgIGxvZ0xldmVsOiAnc2lsZW50JyxcbiAgICBtaW5pZnk6IG9wdGlvbnMub3B0aW1pemF0aW9uLFxuICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgIHNvdXJjZW1hcDogb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgb3V0ZGlyOiBvcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgdGFyZ2V0OiBvcHRpb25zLnRhcmdldCxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzOiBvcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgZXh0ZXJuYWw6IG9wdGlvbnMuZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgY29uZGl0aW9uczogWydzdHlsZScsICdzYXNzJ10sXG4gICAgbWFpbkZpZWxkczogWydzdHlsZScsICdzYXNzJ10sXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlU2Fzc1BsdWdpbih7XG4gICAgICAgIHNvdXJjZW1hcDogISFvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgLy8gRW5zdXJlIFNhc3MgbG9hZCBwYXRocyBhcmUgYWJzb2x1dGUgYmFzZWQgb24gdGhlIHdvcmtzcGFjZSByb290XG4gICAgICAgIGxvYWRQYXRoczogb3B0aW9ucy5pbmNsdWRlUGF0aHM/Lm1hcCgoaW5jbHVkZVBhdGgpID0+XG4gICAgICAgICAgcGF0aC5yZXNvbHZlKG9wdGlvbnMud29ya3NwYWNlUm9vdCwgaW5jbHVkZVBhdGgpLFxuICAgICAgICApLFxuICAgICAgICBpbmxpbmVDb21wb25lbnREYXRhLFxuICAgICAgfSksXG4gICAgICBjcmVhdGVDc3NSZXNvdXJjZVBsdWdpbigpLFxuICAgIF0sXG4gIH07XG59XG5cbi8qKlxuICogQnVuZGxlcyBhIGNvbXBvbmVudCBzdHlsZXNoZWV0LiBUaGUgc3R5bGVzaGVldCBjYW4gYmUgZWl0aGVyIGFuIGlubGluZSBzdHlsZXNoZWV0IHRoYXRcbiAqIGlzIGNvbnRhaW5lZCB3aXRoaW4gdGhlIENvbXBvbmVudCdzIG1ldGFkYXRhIGRlZmluaXRpb24gb3IgYW4gZXh0ZXJuYWwgZmlsZSByZWZlcmVuY2VkXG4gKiBmcm9tIHRoZSBDb21wb25lbnQncyBtZXRhZGF0YSBkZWZpbml0aW9uLlxuICpcbiAqIEBwYXJhbSBpZGVudGlmaWVyIEEgdW5pcXVlIHN0cmluZyBpZGVudGlmaWVyIGZvciB0aGUgY29tcG9uZW50IHN0eWxlc2hlZXQuXG4gKiBAcGFyYW0gbGFuZ3VhZ2UgVGhlIGxhbmd1YWdlIG9mIHRoZSBzdHlsZXNoZWV0IHN1Y2ggYXMgYGNzc2Agb3IgYHNjc3NgLlxuICogQHBhcmFtIGRhdGEgVGhlIHN0cmluZyBjb250ZW50IG9mIHRoZSBzdHlsZXNoZWV0LlxuICogQHBhcmFtIGZpbGVuYW1lIFRoZSBmaWxlbmFtZSByZXByZXNlbnRpbmcgdGhlIHNvdXJjZSBvZiB0aGUgc3R5bGVzaGVldCBjb250ZW50LlxuICogQHBhcmFtIGlubGluZSBJZiB0cnVlLCB0aGUgc3R5bGVzaGVldCBzb3VyY2UgaXMgd2l0aGluIHRoZSBjb21wb25lbnQgbWV0YWRhdGE7XG4gKiBpZiBmYWxzZSwgdGhlIHNvdXJjZSBpcyBhIHN0eWxlc2hlZXQgZmlsZS5cbiAqIEBwYXJhbSBvcHRpb25zIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBzdHlsZXNoZWV0IGJ1bmRsaW5nIG9wdGlvbnMuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgb3V0cHV0IG9mIHRoZSBidW5kbGluZyBvcGVyYXRpb24uXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidW5kbGVDb21wb25lbnRTdHlsZXNoZWV0KFxuICBpZGVudGlmaWVyOiBzdHJpbmcsXG4gIGxhbmd1YWdlOiBzdHJpbmcsXG4gIGRhdGE6IHN0cmluZyxcbiAgZmlsZW5hbWU6IHN0cmluZyxcbiAgaW5saW5lOiBib29sZWFuLFxuICBvcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbikge1xuICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpzdHlsZXMvY29tcG9uZW50JztcbiAgY29uc3QgZW50cnkgPSBbbmFtZXNwYWNlLCBsYW5ndWFnZSwgaWRlbnRpZmllciwgZmlsZW5hbWVdLmpvaW4oJzsnKTtcblxuICBjb25zdCBidWlsZE9wdGlvbnMgPSBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyhvcHRpb25zLCB7IFtlbnRyeV06IGRhdGEgfSk7XG4gIGJ1aWxkT3B0aW9ucy5lbnRyeVBvaW50cyA9IFtlbnRyeV07XG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goe1xuICAgIG5hbWU6ICdhbmd1bGFyLWNvbXBvbmVudC1zdHlsZXMnLFxuICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IC9eYW5ndWxhcjpzdHlsZXNcXC9jb21wb25lbnQ7LyB9LCAoYXJncykgPT4ge1xuICAgICAgICBpZiAoYXJncy5raW5kICE9PSAnZW50cnktcG9pbnQnKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5saW5lKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBhdGg6IGFyZ3MucGF0aCxcbiAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwYXRoOiBmaWxlbmFtZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL15hbmd1bGFyOnN0eWxlc1xcL2NvbXBvbmVudDtjc3M7LywgbmFtZXNwYWNlIH0sIGFzeW5jICgpID0+IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50czogZGF0YSxcbiAgICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgICAgIHJlc29sdmVEaXI6IHBhdGguZGlybmFtZShmaWxlbmFtZSksXG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICB9LFxuICB9KTtcblxuICAvLyBFeGVjdXRlIGVzYnVpbGRcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnVuZGxlKG9wdGlvbnMud29ya3NwYWNlUm9vdCwgYnVpbGRPcHRpb25zKTtcblxuICAvLyBFeHRyYWN0IHRoZSByZXN1bHQgb2YgdGhlIGJ1bmRsaW5nIGZyb20gdGhlIG91dHB1dCBmaWxlc1xuICBsZXQgY29udGVudHMgPSAnJztcbiAgbGV0IG1hcDtcbiAgbGV0IG91dHB1dFBhdGg7XG4gIGNvbnN0IHJlc291cmNlRmlsZXM6IE91dHB1dEZpbGVbXSA9IFtdO1xuICBpZiAocmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgZm9yIChjb25zdCBvdXRwdXRGaWxlIG9mIHJlc3VsdC5vdXRwdXRGaWxlcykge1xuICAgICAgY29uc3QgZmlsZW5hbWUgPSBwYXRoLmJhc2VuYW1lKG91dHB1dEZpbGUucGF0aCk7XG4gICAgICBpZiAoZmlsZW5hbWUuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgICBvdXRwdXRQYXRoID0gb3V0cHV0RmlsZS5wYXRoO1xuICAgICAgICBjb250ZW50cyA9IG91dHB1dEZpbGUudGV4dDtcbiAgICAgIH0gZWxzZSBpZiAoZmlsZW5hbWUuZW5kc1dpdGgoJy5jc3MubWFwJykpIHtcbiAgICAgICAgbWFwID0gb3V0cHV0RmlsZS50ZXh0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhlIG91dHB1dCBmaWxlcyBjb3VsZCBhbHNvIGNvbnRhaW4gcmVzb3VyY2VzIChpbWFnZXMvZm9udHMvZXRjLikgdGhhdCB3ZXJlIHJlZmVyZW5jZWRcbiAgICAgICAgcmVzb3VyY2VGaWxlcy5wdXNoKG91dHB1dEZpbGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZXJyb3JzOiByZXN1bHQuZXJyb3JzLFxuICAgIHdhcm5pbmdzOiByZXN1bHQud2FybmluZ3MsXG4gICAgY29udGVudHMsXG4gICAgbWFwLFxuICAgIHBhdGg6IG91dHB1dFBhdGgsXG4gICAgcmVzb3VyY2VGaWxlcyxcbiAgICBtZXRhZmlsZTogcmVzdWx0Lm91dHB1dEZpbGVzICYmIHJlc3VsdC5tZXRhZmlsZSxcbiAgfTtcbn1cbiJdfQ==