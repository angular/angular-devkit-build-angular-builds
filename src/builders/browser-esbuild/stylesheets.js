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
    let metafile;
    if (!result.errors) {
        metafile = result.metafile;
        // Remove entryPoint fields from outputs to prevent the internal component styles from being
        // treated as initial files. Also mark the entry as a component resource for stat reporting.
        Object.values(metafile.outputs).forEach((output) => {
            delete output.entryPoint;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            output['ng-component'] = true;
        });
    }
    return {
        errors: result.errors,
        warnings: result.warnings,
        contents,
        map,
        path: outputPath,
        resourceFiles,
        metafile,
    };
}
exports.bundleComponentStylesheet = bundleComponentStylesheet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc3R5bGVzaGVldHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsMERBQTZCO0FBQzdCLDZDQUErQztBQUMvQywrREFBZ0U7QUFDaEUsdUNBQTJDO0FBQzNDLCtDQUFpRDtBQUNqRCwrQ0FBaUQ7QUFFakQ7O0dBRUc7QUFDSCxJQUFJLHFCQUFxQixHQUFHLENBQUMsQ0FBQztBQWU5QixTQUFnQiw2QkFBNkIsQ0FDM0MsT0FBZ0MsRUFDaEMsbUJBQTRDO0lBRTVDLDZFQUE2RTtJQUM3RSxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsWUFBWSxFQUFFLEdBQUcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQzdELG1CQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsV0FBVyxDQUFDLENBQ2pELENBQUM7SUFFRixPQUFPO1FBQ0wsYUFBYSxFQUFFLE9BQU8sQ0FBQyxhQUFhO1FBQ3BDLE1BQU0sRUFBRSxJQUFJO1FBQ1osVUFBVSxFQUFFLE9BQU8sQ0FBQyxXQUFXLEVBQUUsT0FBTztRQUN4QyxVQUFVLEVBQUUsT0FBTyxDQUFDLFdBQVcsRUFBRSxLQUFLO1FBQ3RDLFFBQVEsRUFBRSxRQUFRO1FBQ2xCLE1BQU0sRUFBRSxPQUFPLENBQUMsWUFBWTtRQUM1QixRQUFRLEVBQUUsSUFBSTtRQUNkLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUztRQUM1QixNQUFNLEVBQUUsT0FBTyxDQUFDLGFBQWE7UUFDN0IsS0FBSyxFQUFFLEtBQUs7UUFDWixRQUFRLEVBQUUsU0FBUztRQUNuQixNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU07UUFDdEIsZ0JBQWdCLEVB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UUFDaEIsYUFBYTtRQUNiLFFBQVE7S0FDVCxDQUFDO0FBQ0osQ0FBQztBQXRGRCw4REFzRkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZE9wdGlvbnMsIE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBjcmVhdGVDc3NQbHVnaW4gfSBmcm9tICcuL2Nzcy1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlQ3NzUmVzb3VyY2VQbHVnaW4gfSBmcm9tICcuL2Nzcy1yZXNvdXJjZS1wbHVnaW4nO1xuaW1wb3J0IHsgQnVuZGxlckNvbnRleHQgfSBmcm9tICcuL2VzYnVpbGQnO1xuaW1wb3J0IHsgY3JlYXRlTGVzc1BsdWdpbiB9IGZyb20gJy4vbGVzcy1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlU2Fzc1BsdWdpbiB9IGZyb20gJy4vc2Fzcy1wbHVnaW4nO1xuXG4vKipcbiAqIEEgY291bnRlciBmb3IgY29tcG9uZW50IHN0eWxlcyB1c2VkIHRvIGdlbmVyYXRlIHVuaXF1ZSBidWlsZC10aW1lIGlkZW50aWZpZXJzIGZvciBlYWNoIHN0eWxlc2hlZXQuXG4gKi9cbmxldCBjb21wb25lbnRTdHlsZUNvdW50ZXIgPSAwO1xuXG5leHBvcnQgaW50ZXJmYWNlIEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zIHtcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nO1xuICBvcHRpbWl6YXRpb246IGJvb2xlYW47XG4gIHByZXNlcnZlU3ltbGlua3M/OiBib29sZWFuO1xuICBzb3VyY2VtYXA6IGJvb2xlYW4gfCAnZXh0ZXJuYWwnIHwgJ2lubGluZSc7XG4gIG91dHB1dE5hbWVzPzogeyBidW5kbGVzPzogc3RyaW5nOyBtZWRpYT86IHN0cmluZyB9O1xuICBpbmNsdWRlUGF0aHM/OiBzdHJpbmdbXTtcbiAgZXh0ZXJuYWxEZXBlbmRlbmNpZXM/OiBzdHJpbmdbXTtcbiAgdGFyZ2V0OiBzdHJpbmdbXTtcbiAgYnJvd3NlcnM6IHN0cmluZ1tdO1xuICB0YWlsd2luZENvbmZpZ3VyYXRpb24/OiB7IGZpbGU6IHN0cmluZzsgcGFja2FnZTogc3RyaW5nIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsXG4gIGlubGluZUNvbXBvbmVudERhdGE/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+LFxuKTogQnVpbGRPcHRpb25zICYgeyBwbHVnaW5zOiBOb25OdWxsYWJsZTxCdWlsZE9wdGlvbnNbJ3BsdWdpbnMnXT4gfSB7XG4gIC8vIEVuc3VyZSBwcmVwcm9jZXNzb3IgaW5jbHVkZSBwYXRocyBhcmUgYWJzb2x1dGUgYmFzZWQgb24gdGhlIHdvcmtzcGFjZSByb290XG4gIGNvbnN0IGluY2x1ZGVQYXRocyA9IG9wdGlvbnMuaW5jbHVkZVBhdGhzPy5tYXAoKGluY2x1ZGVQYXRoKSA9PlxuICAgIHBhdGgucmVzb2x2ZShvcHRpb25zLndvcmtzcGFjZVJvb3QsIGluY2x1ZGVQYXRoKSxcbiAgKTtcblxuICByZXR1cm4ge1xuICAgIGFic1dvcmtpbmdEaXI6IG9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IHRydWUsXG4gICAgZW50cnlOYW1lczogb3B0aW9ucy5vdXRwdXROYW1lcz8uYnVuZGxlcyxcbiAgICBhc3NldE5hbWVzOiBvcHRpb25zLm91dHB1dE5hbWVzPy5tZWRpYSxcbiAgICBsb2dMZXZlbDogJ3NpbGVudCcsXG4gICAgbWluaWZ5OiBvcHRpb25zLm9wdGltaXphdGlvbixcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBzb3VyY2VtYXA6IG9wdGlvbnMuc291cmNlbWFwLFxuICAgIG91dGRpcjogb3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIHRhcmdldDogb3B0aW9ucy50YXJnZXQsXG4gICAgcHJlc2VydmVTeW1saW5rczogb3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIGV4dGVybmFsOiBvcHRpb25zLmV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIGNvbmRpdGlvbnM6IFsnc3R5bGUnLCAnc2FzcyddLFxuICAgIG1haW5GaWVsZHM6IFsnc3R5bGUnLCAnc2FzcyddLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNhc3NQbHVnaW4oe1xuICAgICAgICBzb3VyY2VtYXA6ICEhb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgIGxvYWRQYXRoczogaW5jbHVkZVBhdGhzLFxuICAgICAgICBpbmxpbmVDb21wb25lbnREYXRhLFxuICAgICAgfSksXG4gICAgICBjcmVhdGVMZXNzUGx1Z2luKHtcbiAgICAgICAgc291cmNlbWFwOiAhIW9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICBpbmNsdWRlUGF0aHMsXG4gICAgICAgIGlubGluZUNvbXBvbmVudERhdGEsXG4gICAgICB9KSxcbiAgICAgIGNyZWF0ZUNzc1BsdWdpbih7XG4gICAgICAgIHNvdXJjZW1hcDogISFvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgaW5saW5lQ29tcG9uZW50RGF0YSxcbiAgICAgICAgYnJvd3NlcnM6IG9wdGlvbnMuYnJvd3NlcnMsXG4gICAgICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbjogb3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gICAgICB9KSxcbiAgICAgIGNyZWF0ZUNzc1Jlc291cmNlUGx1Z2luKCksXG4gICAgXSxcbiAgfTtcbn1cblxuLyoqXG4gKiBCdW5kbGVzIGEgY29tcG9uZW50IHN0eWxlc2hlZXQuIFRoZSBzdHlsZXNoZWV0IGNhbiBiZSBlaXRoZXIgYW4gaW5saW5lIHN0eWxlc2hlZXQgdGhhdFxuICogaXMgY29udGFpbmVkIHdpdGhpbiB0aGUgQ29tcG9uZW50J3MgbWV0YWRhdGEgZGVmaW5pdGlvbiBvciBhbiBleHRlcm5hbCBmaWxlIHJlZmVyZW5jZWRcbiAqIGZyb20gdGhlIENvbXBvbmVudCdzIG1ldGFkYXRhIGRlZmluaXRpb24uXG4gKlxuICogQHBhcmFtIGlkZW50aWZpZXIgQSB1bmlxdWUgc3RyaW5nIGlkZW50aWZpZXIgZm9yIHRoZSBjb21wb25lbnQgc3R5bGVzaGVldC5cbiAqIEBwYXJhbSBsYW5ndWFnZSBUaGUgbGFuZ3VhZ2Ugb2YgdGhlIHN0eWxlc2hlZXQgc3VjaCBhcyBgY3NzYCBvciBgc2Nzc2AuXG4gKiBAcGFyYW0gZGF0YSBUaGUgc3RyaW5nIGNvbnRlbnQgb2YgdGhlIHN0eWxlc2hlZXQuXG4gKiBAcGFyYW0gZmlsZW5hbWUgVGhlIGZpbGVuYW1lIHJlcHJlc2VudGluZyB0aGUgc291cmNlIG9mIHRoZSBzdHlsZXNoZWV0IGNvbnRlbnQuXG4gKiBAcGFyYW0gaW5saW5lIElmIHRydWUsIHRoZSBzdHlsZXNoZWV0IHNvdXJjZSBpcyB3aXRoaW4gdGhlIGNvbXBvbmVudCBtZXRhZGF0YTtcbiAqIGlmIGZhbHNlLCB0aGUgc291cmNlIGlzIGEgc3R5bGVzaGVldCBmaWxlLlxuICogQHBhcmFtIG9wdGlvbnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHN0eWxlc2hlZXQgYnVuZGxpbmcgb3B0aW9ucy5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBvdXRwdXQgb2YgdGhlIGJ1bmRsaW5nIG9wZXJhdGlvbi5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGJ1bmRsZUNvbXBvbmVudFN0eWxlc2hlZXQoXG4gIGxhbmd1YWdlOiBzdHJpbmcsXG4gIGRhdGE6IHN0cmluZyxcbiAgZmlsZW5hbWU6IHN0cmluZyxcbiAgaW5saW5lOiBib29sZWFuLFxuICBvcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbikge1xuICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpzdHlsZXMvY29tcG9uZW50JztcbiAgY29uc3QgZW50cnkgPSBbbGFuZ3VhZ2UsIGNvbXBvbmVudFN0eWxlQ291bnRlcisrLCBmaWxlbmFtZV0uam9pbignOycpO1xuXG4gIGNvbnN0IGJ1aWxkT3B0aW9ucyA9IGNyZWF0ZVN0eWxlc2hlZXRCdW5kbGVPcHRpb25zKG9wdGlvbnMsIHsgW2VudHJ5XTogZGF0YSB9KTtcbiAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0gW2Ake25hbWVzcGFjZX07JHtlbnRyeX1gXTtcbiAgYnVpbGRPcHRpb25zLnBsdWdpbnMucHVzaCh7XG4gICAgbmFtZTogJ2FuZ3VsYXItY29tcG9uZW50LXN0eWxlcycsXG4gICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgIGJ1aWxkLm9uUmVzb2x2ZSh7IGZpbHRlcjogL15hbmd1bGFyOnN0eWxlc1xcL2NvbXBvbmVudDsvIH0sIChhcmdzKSA9PiB7XG4gICAgICAgIGlmIChhcmdzLmtpbmQgIT09ICdlbnRyeS1wb2ludCcpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbmxpbmUpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGF0aDogZW50cnksXG4gICAgICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGF0aDogZmlsZW5hbWUsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9eY3NzOy8sIG5hbWVzcGFjZSB9LCBhc3luYyAoKSA9PiB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgY29udGVudHM6IGRhdGEsXG4gICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICByZXNvbHZlRGlyOiBwYXRoLmRpcm5hbWUoZmlsZW5hbWUpLFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gRXhlY3V0ZSBlc2J1aWxkXG4gIGNvbnN0IGNvbnRleHQgPSBuZXcgQnVuZGxlckNvbnRleHQob3B0aW9ucy53b3Jrc3BhY2VSb290LCBmYWxzZSwgYnVpbGRPcHRpb25zKTtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29udGV4dC5idW5kbGUoKTtcblxuICAvLyBFeHRyYWN0IHRoZSByZXN1bHQgb2YgdGhlIGJ1bmRsaW5nIGZyb20gdGhlIG91dHB1dCBmaWxlc1xuICBsZXQgY29udGVudHMgPSAnJztcbiAgbGV0IG1hcDtcbiAgbGV0IG91dHB1dFBhdGg7XG4gIGNvbnN0IHJlc291cmNlRmlsZXM6IE91dHB1dEZpbGVbXSA9IFtdO1xuICBpZiAoIXJlc3VsdC5lcnJvcnMpIHtcbiAgICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2YgcmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgICBjb25zdCBmaWxlbmFtZSA9IHBhdGguYmFzZW5hbWUob3V0cHV0RmlsZS5wYXRoKTtcbiAgICAgIGlmIChmaWxlbmFtZS5lbmRzV2l0aCgnLmNzcycpKSB7XG4gICAgICAgIG91dHB1dFBhdGggPSBvdXRwdXRGaWxlLnBhdGg7XG4gICAgICAgIGNvbnRlbnRzID0gb3V0cHV0RmlsZS50ZXh0O1xuICAgICAgfSBlbHNlIGlmIChmaWxlbmFtZS5lbmRzV2l0aCgnLmNzcy5tYXAnKSkge1xuICAgICAgICBtYXAgPSBvdXRwdXRGaWxlLnRleHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGUgb3V0cHV0IGZpbGVzIGNvdWxkIGFsc28gY29udGFpbiByZXNvdXJjZXMgKGltYWdlcy9mb250cy9ldGMuKSB0aGF0IHdlcmUgcmVmZXJlbmNlZFxuICAgICAgICByZXNvdXJjZUZpbGVzLnB1c2gob3V0cHV0RmlsZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgbGV0IG1ldGFmaWxlO1xuICBpZiAoIXJlc3VsdC5lcnJvcnMpIHtcbiAgICBtZXRhZmlsZSA9IHJlc3VsdC5tZXRhZmlsZTtcbiAgICAvLyBSZW1vdmUgZW50cnlQb2ludCBmaWVsZHMgZnJvbSBvdXRwdXRzIHRvIHByZXZlbnQgdGhlIGludGVybmFsIGNvbXBvbmVudCBzdHlsZXMgZnJvbSBiZWluZ1xuICAgIC8vIHRyZWF0ZWQgYXMgaW5pdGlhbCBmaWxlcy4gQWxzbyBtYXJrIHRoZSBlbnRyeSBhcyBhIGNvbXBvbmVudCByZXNvdXJjZSBmb3Igc3RhdCByZXBvcnRpbmcuXG4gICAgT2JqZWN0LnZhbHVlcyhtZXRhZmlsZS5vdXRwdXRzKS5mb3JFYWNoKChvdXRwdXQpID0+IHtcbiAgICAgIGRlbGV0ZSBvdXRwdXQuZW50cnlQb2ludDtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAob3V0cHV0IGFzIGFueSlbJ25nLWNvbXBvbmVudCddID0gdHJ1ZTtcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZXJyb3JzOiByZXN1bHQuZXJyb3JzLFxuICAgIHdhcm5pbmdzOiByZXN1bHQud2FybmluZ3MsXG4gICAgY29udGVudHMsXG4gICAgbWFwLFxuICAgIHBhdGg6IG91dHB1dFBhdGgsXG4gICAgcmVzb3VyY2VGaWxlcyxcbiAgICBtZXRhZmlsZSxcbiAgfTtcbn1cbiJdfQ==