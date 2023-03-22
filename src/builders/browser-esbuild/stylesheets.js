"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bundleComponentStylesheet = exports.createStylesheetBundleOptions = void 0;
const node_path_1 = __importDefault(require("node:path"));
const css_plugin_1 = require("./css-plugin");
const css_resource_plugin_1 = require("./css-resource-plugin");
const esbuild_1 = require("./esbuild");
const less_plugin_1 = require("./less-plugin");
const sass_plugin_1 = require("./sass-plugin");
/**
 * A counter for component styles used to generate unique build-time identifiers for each stylesheet.
 */
let componentStyleCounter = 0;
function createStylesheetBundleOptions(options, inlineComponentData) {
    // Ensure preprocessor include paths are absolute based on the workspace root
    const includePaths = options.includePaths?.map((includePath) => node_path_1.default.resolve(options.workspaceRoot, includePath));
    return {
        absWorkingDir: options.workspaceRoot,
        bundle: true,
        entryNames: options.outputNames?.bundles,
        assetNames: options.outputNames?.media,
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
                loadPaths: includePaths,
                inlineComponentData,
            }),
            (0, less_plugin_1.createLessPlugin)({
                sourcemap: !!options.sourcemap,
                includePaths,
                inlineComponentData,
            }),
            (0, css_plugin_1.createCssPlugin)({
                sourcemap: !!options.sourcemap,
                inlineComponentData,
                browsers: options.browsers,
                tailwindConfiguration: options.tailwindConfiguration,
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
async function bundleComponentStylesheet(language, data, filename, inline, options) {
    const namespace = 'angular:styles/component';
    const entry = [language, componentStyleCounter++, filename].join(';');
    const buildOptions = createStylesheetBundleOptions(options, { [entry]: data });
    buildOptions.entryPoints = [`${namespace};${entry}`];
    buildOptions.plugins.push({
        name: 'angular-component-styles',
        setup(build) {
            build.onResolve({ filter: /^angular:styles\/component;/ }, (args) => {
                if (args.kind !== 'entry-point') {
                    return null;
                }
                if (inline) {
                    return {
                        path: entry,
                        namespace,
                    };
                }
                else {
                    return {
                        path: filename,
                    };
                }
            });
            build.onLoad({ filter: /^css;/, namespace }, async () => {
                return {
                    contents: data,
                    loader: 'css',
                    resolveDir: node_path_1.default.dirname(filename),
                };
            });
        },
    });
    // Execute esbuild
    const context = new esbuild_1.BundlerContext(options.workspaceRoot, false, buildOptions);
    const result = await context.bundle();
    // Extract the result of the bundling from the output files
    let contents = '';
    let map;
    let outputPath;
    const resourceFiles = [];
    if (!result.errors) {
        for (const outputFile of result.outputFiles) {
            const filename = node_path_1.default.basename(outputFile.path);
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
        metafile: result.errors ? undefined : result.metafile,
    };
}
exports.bundleComponentStylesheet = bundleComponentStylesheet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc3R5bGVzaGVldHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsMERBQTZCO0FBQzdCLDZDQUErQztBQUMvQywrREFBZ0U7QUFDaEUsdUNBQTJDO0FBQzNDLCtDQUFpRDtBQUNqRCwrQ0FBaUQ7QUFFakQ7O0dBRUc7QUFDSCxJQUFJLHFCQUFxQixHQUFHLENBQUMsQ0FBQztBQWU5QixTQUFnQiw2QkFBNkIsQ0FDM0MsT0FBZ0MsRUFDaEMsbUJBQTRDO0lBRTVDLDZFQUE2RTtJQUM3RSxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsWUFBWSxFQUFFLEdBQUcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQzdELG1CQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsV0FBVyxDQUFDLENBQ2pELENBQUM7SUFFRixPQUFPO1FBQ0wsYUFBYSxFQUFFLE9BQU8sQ0FBQyxhQUFhO1FBQ3BDLE1BQU0sRUFBRSxJQUFJO1FBQ1osVUFBVSxFQUFFLE9BQU8sQ0FBQyxXQUFXLEVBQUUsT0FBTztRQUN4QyxVQUFVLEVBQUUsT0FBTyxDQUFDLFdBQVcsRUFBRSxLQUFLO1FBQ3RDLFFBQVEsRUFBRSxRQUFRO1FBQ2xCLE1BQU0sRUFBRSxPQUFPLENBQUMsWUFBWTtRQUM1QixRQUFRLEVBQUUsSUFBSTtRQUNkLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUztRQUM1QixNQUFNLEVBQUUsT0FBTyxDQUFDLGFBQWE7UUFDN0IsS0FBSyxFQUFFLEtBQUs7UUFDWixRQUFRLEVBQUUsU0FBUztRQUNuQixNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU07UUFDdEIsZ0JBQWdCLEVB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VSxDQUFDO0lBQ2YsTUFBTSxhQUFhLEdBQWlCLEVBQUUsQ0FBQztJQUN2QyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtRQUNsQixLQUFLLE1BQU0sVUFBVSxJQUFJLE1BQU0sQ0FBQyxXQUFXLEVBQUU7WUFDM0MsTUFBTSxRQUFRLEdBQUcsbUJBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2hELElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDN0IsVUFBVSxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUM7Z0JBQzdCLFFBQVEsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDO2FBQzVCO2lCQUFNLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDeEMsR0FBRyxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUM7YUFDdkI7aUJBQU07Z0JBQ0wseUZBQXlGO2dCQUN6RixhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2FBQ2hDO1NBQ0Y7S0FDRjtJQUVELE9BQU87UUFDTCxNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU07UUFDckIsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRO1FBQ3pCLFFBQVE7UUFDUixHQUFHO1FBQ0gsSUFBSSxFQUFFLFVBQVU7UUFDaEIsYUFBYTtRQUNiLFFBQVEsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRO0tBQ3RELENBQUM7QUFDSixDQUFDO0FBMUVELDhEQTBFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkT3B0aW9ucywgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGNyZWF0ZUNzc1BsdWdpbiB9IGZyb20gJy4vY3NzLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVDc3NSZXNvdXJjZVBsdWdpbiB9IGZyb20gJy4vY3NzLXJlc291cmNlLXBsdWdpbic7XG5pbXBvcnQgeyBCdW5kbGVyQ29udGV4dCB9IGZyb20gJy4vZXNidWlsZCc7XG5pbXBvcnQgeyBjcmVhdGVMZXNzUGx1Z2luIH0gZnJvbSAnLi9sZXNzLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVTYXNzUGx1Z2luIH0gZnJvbSAnLi9zYXNzLXBsdWdpbic7XG5cbi8qKlxuICogQSBjb3VudGVyIGZvciBjb21wb25lbnQgc3R5bGVzIHVzZWQgdG8gZ2VuZXJhdGUgdW5pcXVlIGJ1aWxkLXRpbWUgaWRlbnRpZmllcnMgZm9yIGVhY2ggc3R5bGVzaGVldC5cbiAqL1xubGV0IGNvbXBvbmVudFN0eWxlQ291bnRlciA9IDA7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMge1xuICB3b3Jrc3BhY2VSb290OiBzdHJpbmc7XG4gIG9wdGltaXphdGlvbjogYm9vbGVhbjtcbiAgcHJlc2VydmVTeW1saW5rcz86IGJvb2xlYW47XG4gIHNvdXJjZW1hcDogYm9vbGVhbiB8ICdleHRlcm5hbCcgfCAnaW5saW5lJztcbiAgb3V0cHV0TmFtZXM/OiB7IGJ1bmRsZXM/OiBzdHJpbmc7IG1lZGlhPzogc3RyaW5nIH07XG4gIGluY2x1ZGVQYXRocz86IHN0cmluZ1tdO1xuICBleHRlcm5hbERlcGVuZGVuY2llcz86IHN0cmluZ1tdO1xuICB0YXJnZXQ6IHN0cmluZ1tdO1xuICBicm93c2Vyczogc3RyaW5nW107XG4gIHRhaWx3aW5kQ29uZmlndXJhdGlvbj86IHsgZmlsZTogc3RyaW5nOyBwYWNrYWdlOiBzdHJpbmcgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVN0eWxlc2hlZXRCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbiAgaW5saW5lQ29tcG9uZW50RGF0YT86IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4pOiBCdWlsZE9wdGlvbnMgJiB7IHBsdWdpbnM6IE5vbk51bGxhYmxlPEJ1aWxkT3B0aW9uc1sncGx1Z2lucyddPiB9IHtcbiAgLy8gRW5zdXJlIHByZXByb2Nlc3NvciBpbmNsdWRlIHBhdGhzIGFyZSBhYnNvbHV0ZSBiYXNlZCBvbiB0aGUgd29ya3NwYWNlIHJvb3RcbiAgY29uc3QgaW5jbHVkZVBhdGhzID0gb3B0aW9ucy5pbmNsdWRlUGF0aHM/Lm1hcCgoaW5jbHVkZVBhdGgpID0+XG4gICAgcGF0aC5yZXNvbHZlKG9wdGlvbnMud29ya3NwYWNlUm9vdCwgaW5jbHVkZVBhdGgpLFxuICApO1xuXG4gIHJldHVybiB7XG4gICAgYWJzV29ya2luZ0Rpcjogb3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICBlbnRyeU5hbWVzOiBvcHRpb25zLm91dHB1dE5hbWVzPy5idW5kbGVzLFxuICAgIGFzc2V0TmFtZXM6IG9wdGlvbnMub3V0cHV0TmFtZXM/Lm1lZGlhLFxuICAgIGxvZ0xldmVsOiAnc2lsZW50JyxcbiAgICBtaW5pZnk6IG9wdGlvbnMub3B0aW1pemF0aW9uLFxuICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgIHNvdXJjZW1hcDogb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgb3V0ZGlyOiBvcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgdGFyZ2V0OiBvcHRpb25zLnRhcmdldCxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzOiBvcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgZXh0ZXJuYWw6IG9wdGlvbnMuZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgY29uZGl0aW9uczogWydzdHlsZScsICdzYXNzJ10sXG4gICAgbWFpbkZpZWxkczogWydzdHlsZScsICdzYXNzJ10sXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlU2Fzc1BsdWdpbih7XG4gICAgICAgIHNvdXJjZW1hcDogISFvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgbG9hZFBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgICAgIGlubGluZUNvbXBvbmVudERhdGEsXG4gICAgICB9KSxcbiAgICAgIGNyZWF0ZUxlc3NQbHVnaW4oe1xuICAgICAgICBzb3VyY2VtYXA6ICEhb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgIGluY2x1ZGVQYXRocyxcbiAgICAgICAgaW5saW5lQ29tcG9uZW50RGF0YSxcbiAgICAgIH0pLFxuICAgICAgY3JlYXRlQ3NzUGx1Z2luKHtcbiAgICAgICAgc291cmNlbWFwOiAhIW9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICBpbmxpbmVDb21wb25lbnREYXRhLFxuICAgICAgICBicm93c2Vyczogb3B0aW9ucy5icm93c2VycyxcbiAgICAgICAgdGFpbHdpbmRDb25maWd1cmF0aW9uOiBvcHRpb25zLnRhaWx3aW5kQ29uZmlndXJhdGlvbixcbiAgICAgIH0pLFxuICAgICAgY3JlYXRlQ3NzUmVzb3VyY2VQbHVnaW4oKSxcbiAgICBdLFxuICB9O1xufVxuXG4vKipcbiAqIEJ1bmRsZXMgYSBjb21wb25lbnQgc3R5bGVzaGVldC4gVGhlIHN0eWxlc2hlZXQgY2FuIGJlIGVpdGhlciBhbiBpbmxpbmUgc3R5bGVzaGVldCB0aGF0XG4gKiBpcyBjb250YWluZWQgd2l0aGluIHRoZSBDb21wb25lbnQncyBtZXRhZGF0YSBkZWZpbml0aW9uIG9yIGFuIGV4dGVybmFsIGZpbGUgcmVmZXJlbmNlZFxuICogZnJvbSB0aGUgQ29tcG9uZW50J3MgbWV0YWRhdGEgZGVmaW5pdGlvbi5cbiAqXG4gKiBAcGFyYW0gaWRlbnRpZmllciBBIHVuaXF1ZSBzdHJpbmcgaWRlbnRpZmllciBmb3IgdGhlIGNvbXBvbmVudCBzdHlsZXNoZWV0LlxuICogQHBhcmFtIGxhbmd1YWdlIFRoZSBsYW5ndWFnZSBvZiB0aGUgc3R5bGVzaGVldCBzdWNoIGFzIGBjc3NgIG9yIGBzY3NzYC5cbiAqIEBwYXJhbSBkYXRhIFRoZSBzdHJpbmcgY29udGVudCBvZiB0aGUgc3R5bGVzaGVldC5cbiAqIEBwYXJhbSBmaWxlbmFtZSBUaGUgZmlsZW5hbWUgcmVwcmVzZW50aW5nIHRoZSBzb3VyY2Ugb2YgdGhlIHN0eWxlc2hlZXQgY29udGVudC5cbiAqIEBwYXJhbSBpbmxpbmUgSWYgdHJ1ZSwgdGhlIHN0eWxlc2hlZXQgc291cmNlIGlzIHdpdGhpbiB0aGUgY29tcG9uZW50IG1ldGFkYXRhO1xuICogaWYgZmFsc2UsIHRoZSBzb3VyY2UgaXMgYSBzdHlsZXNoZWV0IGZpbGUuXG4gKiBAcGFyYW0gb3B0aW9ucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgc3R5bGVzaGVldCBidW5kbGluZyBvcHRpb25zLlxuICogQHJldHVybnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIG91dHB1dCBvZiB0aGUgYnVuZGxpbmcgb3BlcmF0aW9uLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYnVuZGxlQ29tcG9uZW50U3R5bGVzaGVldChcbiAgbGFuZ3VhZ2U6IHN0cmluZyxcbiAgZGF0YTogc3RyaW5nLFxuICBmaWxlbmFtZTogc3RyaW5nLFxuICBpbmxpbmU6IGJvb2xlYW4sXG4gIG9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLFxuKSB7XG4gIGNvbnN0IG5hbWVzcGFjZSA9ICdhbmd1bGFyOnN0eWxlcy9jb21wb25lbnQnO1xuICBjb25zdCBlbnRyeSA9IFtsYW5ndWFnZSwgY29tcG9uZW50U3R5bGVDb3VudGVyKyssIGZpbGVuYW1lXS5qb2luKCc7Jyk7XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zID0gY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnMob3B0aW9ucywgeyBbZW50cnldOiBkYXRhIH0pO1xuICBidWlsZE9wdGlvbnMuZW50cnlQb2ludHMgPSBbYCR7bmFtZXNwYWNlfTske2VudHJ5fWBdO1xuICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKHtcbiAgICBuYW1lOiAnYW5ndWxhci1jb21wb25lbnQtc3R5bGVzJyxcbiAgICBzZXR1cChidWlsZCkge1xuICAgICAgYnVpbGQub25SZXNvbHZlKHsgZmlsdGVyOiAvXmFuZ3VsYXI6c3R5bGVzXFwvY29tcG9uZW50Oy8gfSwgKGFyZ3MpID0+IHtcbiAgICAgICAgaWYgKGFyZ3Mua2luZCAhPT0gJ2VudHJ5LXBvaW50Jykge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlubGluZSkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwYXRoOiBlbnRyeSxcbiAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwYXRoOiBmaWxlbmFtZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL15jc3M7LywgbmFtZXNwYWNlIH0sIGFzeW5jICgpID0+IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50czogZGF0YSxcbiAgICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgICAgIHJlc29sdmVEaXI6IHBhdGguZGlybmFtZShmaWxlbmFtZSksXG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICB9LFxuICB9KTtcblxuICAvLyBFeGVjdXRlIGVzYnVpbGRcbiAgY29uc3QgY29udGV4dCA9IG5ldyBCdW5kbGVyQ29udGV4dChvcHRpb25zLndvcmtzcGFjZVJvb3QsIGZhbHNlLCBidWlsZE9wdGlvbnMpO1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBjb250ZXh0LmJ1bmRsZSgpO1xuXG4gIC8vIEV4dHJhY3QgdGhlIHJlc3VsdCBvZiB0aGUgYnVuZGxpbmcgZnJvbSB0aGUgb3V0cHV0IGZpbGVzXG4gIGxldCBjb250ZW50cyA9ICcnO1xuICBsZXQgbWFwO1xuICBsZXQgb3V0cHV0UGF0aDtcbiAgY29uc3QgcmVzb3VyY2VGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gIGlmICghcmVzdWx0LmVycm9ycykge1xuICAgIGZvciAoY29uc3Qgb3V0cHV0RmlsZSBvZiByZXN1bHQub3V0cHV0RmlsZXMpIHtcbiAgICAgIGNvbnN0IGZpbGVuYW1lID0gcGF0aC5iYXNlbmFtZShvdXRwdXRGaWxlLnBhdGgpO1xuICAgICAgaWYgKGZpbGVuYW1lLmVuZHNXaXRoKCcuY3NzJykpIHtcbiAgICAgICAgb3V0cHV0UGF0aCA9IG91dHB1dEZpbGUucGF0aDtcbiAgICAgICAgY29udGVudHMgPSBvdXRwdXRGaWxlLnRleHQ7XG4gICAgICB9IGVsc2UgaWYgKGZpbGVuYW1lLmVuZHNXaXRoKCcuY3NzLm1hcCcpKSB7XG4gICAgICAgIG1hcCA9IG91dHB1dEZpbGUudGV4dDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoZSBvdXRwdXQgZmlsZXMgY291bGQgYWxzbyBjb250YWluIHJlc291cmNlcyAoaW1hZ2VzL2ZvbnRzL2V0Yy4pIHRoYXQgd2VyZSByZWZlcmVuY2VkXG4gICAgICAgIHJlc291cmNlRmlsZXMucHVzaChvdXRwdXRGaWxlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGVycm9yczogcmVzdWx0LmVycm9ycyxcbiAgICB3YXJuaW5nczogcmVzdWx0Lndhcm5pbmdzLFxuICAgIGNvbnRlbnRzLFxuICAgIG1hcCxcbiAgICBwYXRoOiBvdXRwdXRQYXRoLFxuICAgIHJlc291cmNlRmlsZXMsXG4gICAgbWV0YWZpbGU6IHJlc3VsdC5lcnJvcnMgPyB1bmRlZmluZWQgOiByZXN1bHQubWV0YWZpbGUsXG4gIH07XG59XG4iXX0=