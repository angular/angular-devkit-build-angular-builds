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
const node_crypto_1 = require("node:crypto");
const node_path_1 = __importDefault(require("node:path"));
const esbuild_1 = require("../esbuild");
const css_language_1 = require("./css-language");
const css_resource_plugin_1 = require("./css-resource-plugin");
const less_language_1 = require("./less-language");
const sass_language_1 = require("./sass-language");
const stylesheet_plugin_factory_1 = require("./stylesheet-plugin-factory");
/**
 * A counter for component styles used to generate unique build-time identifiers for each stylesheet.
 */
let componentStyleCounter = 0;
function createStylesheetBundleOptions(options, cache, inlineComponentData) {
    // Ensure preprocessor include paths are absolute based on the workspace root
    const includePaths = options.includePaths?.map((includePath) => node_path_1.default.resolve(options.workspaceRoot, includePath));
    const pluginFactory = new stylesheet_plugin_factory_1.StylesheetPluginFactory({
        sourcemap: !!options.sourcemap,
        includePaths,
        inlineComponentData,
        browsers: options.browsers,
        tailwindConfiguration: options.tailwindConfiguration,
    }, cache);
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
            pluginFactory.create(sass_language_1.SassStylesheetLanguage),
            pluginFactory.create(less_language_1.LessStylesheetLanguage),
            pluginFactory.create(css_language_1.CssStylesheetLanguage),
            (0, css_resource_plugin_1.createCssResourcePlugin)(cache),
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
async function bundleComponentStylesheet(language, data, filename, inline, options, cache) {
    const namespace = 'angular:styles/component';
    // Use a hash of the inline stylesheet content to ensure a consistent identifier. External stylesheets will resolve
    // to the actual stylesheet file path.
    // TODO: Consider xxhash instead for hashing
    const id = inline ? (0, node_crypto_1.createHash)('sha256').update(data).digest('hex') : componentStyleCounter++;
    const entry = [language, id, filename].join(';');
    const buildOptions = createStylesheetBundleOptions(options, cache, { [entry]: data });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLW9wdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc3R5bGVzaGVldHMvYnVuZGxlLW9wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsNkNBQXlDO0FBQ3pDLDBEQUE2QjtBQUM3Qix3Q0FBNEM7QUFFNUMsaURBQXVEO0FBQ3ZELCtEQUFnRTtBQUNoRSxtREFBeUQ7QUFDekQsbURBQXlEO0FBQ3pELDJFQUFzRTtBQUV0RTs7R0FFRztBQUNILElBQUkscUJBQXFCLEdBQUcsQ0FBQyxDQUFDO0FBZTlCLFNBQWdCLDZCQUE2QixDQUMzQyxPQUFnQyxFQUNoQyxLQUF1QixFQUN2QixtQkFBNEM7SUFFNUMsNkVBQTZFO0lBQzdFLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLEVBQUUsR0FBRyxDQUFDLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FDN0QsbUJBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxXQUFXLENBQUMsQ0FDakQsQ0FBQztJQUVGLE1BQU0sYUFBYSxHQUFHLElBQUksbURBQXVCLENBQy9DO1FBQ0UsU0FBUyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUztRQUM5QixZQUFZO1FBQ1osbUJBQW1CO1FBQ25CLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUTtRQUMxQixxQkFBcUIsRUFBRSxPQUFPLENBQUMscUJBQXFCO0tBQ3JELEVBQ0QsS0FBSyxDQUNOLENBQUM7SUFFRixPQUFPO1FBQ0wsYUFBYSxFQUFFLE9BQU8sQ0FBQyxhQUFhO1FBQ3BDLE1BQU0sRUFBRSxJQUFJO1FBQ1osVUFBVSxFQUFFLE9BQU8sQ0FBQyxXQUFXLEVBQUUsT0FBTztRQUN4QyxVQUFV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QU8sTUFBTSxDQUFDLFVBQVUsQ0FBQztZQUN6Qiw4REFBOEQ7WUFDN0QsTUFBYyxDQUFDLGNBQWMsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUN6QyxDQUFDLENBQUMsQ0FBQztLQUNKO0lBRUQsT0FBTztRQUNMLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTTtRQUNyQixRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7UUFDekIsUUFBUTtRQUNSLEdBQUc7UUFDSCxJQUFJLEVBQUUsVUFBVTtRQUNoQixhQUFhO1FBQ2IsUUFBUTtLQUNULENBQUM7QUFDSixDQUFDO0FBM0ZELDhEQTJGQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkT3B0aW9ucywgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ25vZGU6Y3J5cHRvJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBCdW5kbGVyQ29udGV4dCB9IGZyb20gJy4uL2VzYnVpbGQnO1xuaW1wb3J0IHsgTG9hZFJlc3VsdENhY2hlIH0gZnJvbSAnLi4vbG9hZC1yZXN1bHQtY2FjaGUnO1xuaW1wb3J0IHsgQ3NzU3R5bGVzaGVldExhbmd1YWdlIH0gZnJvbSAnLi9jc3MtbGFuZ3VhZ2UnO1xuaW1wb3J0IHsgY3JlYXRlQ3NzUmVzb3VyY2VQbHVnaW4gfSBmcm9tICcuL2Nzcy1yZXNvdXJjZS1wbHVnaW4nO1xuaW1wb3J0IHsgTGVzc1N0eWxlc2hlZXRMYW5ndWFnZSB9IGZyb20gJy4vbGVzcy1sYW5ndWFnZSc7XG5pbXBvcnQgeyBTYXNzU3R5bGVzaGVldExhbmd1YWdlIH0gZnJvbSAnLi9zYXNzLWxhbmd1YWdlJztcbmltcG9ydCB7IFN0eWxlc2hlZXRQbHVnaW5GYWN0b3J5IH0gZnJvbSAnLi9zdHlsZXNoZWV0LXBsdWdpbi1mYWN0b3J5JztcblxuLyoqXG4gKiBBIGNvdW50ZXIgZm9yIGNvbXBvbmVudCBzdHlsZXMgdXNlZCB0byBnZW5lcmF0ZSB1bmlxdWUgYnVpbGQtdGltZSBpZGVudGlmaWVycyBmb3IgZWFjaCBzdHlsZXNoZWV0LlxuICovXG5sZXQgY29tcG9uZW50U3R5bGVDb3VudGVyID0gMDtcblxuZXhwb3J0IGludGVyZmFjZSBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyB7XG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZztcbiAgb3B0aW1pemF0aW9uOiBib29sZWFuO1xuICBwcmVzZXJ2ZVN5bWxpbmtzPzogYm9vbGVhbjtcbiAgc291cmNlbWFwOiBib29sZWFuIHwgJ2V4dGVybmFsJyB8ICdpbmxpbmUnO1xuICBvdXRwdXROYW1lcz86IHsgYnVuZGxlcz86IHN0cmluZzsgbWVkaWE/OiBzdHJpbmcgfTtcbiAgaW5jbHVkZVBhdGhzPzogc3RyaW5nW107XG4gIGV4dGVybmFsRGVwZW5kZW5jaWVzPzogc3RyaW5nW107XG4gIHRhcmdldDogc3RyaW5nW107XG4gIGJyb3dzZXJzOiBzdHJpbmdbXTtcbiAgdGFpbHdpbmRDb25maWd1cmF0aW9uPzogeyBmaWxlOiBzdHJpbmc7IHBhY2thZ2U6IHN0cmluZyB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLFxuICBjYWNoZT86IExvYWRSZXN1bHRDYWNoZSxcbiAgaW5saW5lQ29tcG9uZW50RGF0YT86IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4pOiBCdWlsZE9wdGlvbnMgJiB7IHBsdWdpbnM6IE5vbk51bGxhYmxlPEJ1aWxkT3B0aW9uc1sncGx1Z2lucyddPiB9IHtcbiAgLy8gRW5zdXJlIHByZXByb2Nlc3NvciBpbmNsdWRlIHBhdGhzIGFyZSBhYnNvbHV0ZSBiYXNlZCBvbiB0aGUgd29ya3NwYWNlIHJvb3RcbiAgY29uc3QgaW5jbHVkZVBhdGhzID0gb3B0aW9ucy5pbmNsdWRlUGF0aHM/Lm1hcCgoaW5jbHVkZVBhdGgpID0+XG4gICAgcGF0aC5yZXNvbHZlKG9wdGlvbnMud29ya3NwYWNlUm9vdCwgaW5jbHVkZVBhdGgpLFxuICApO1xuXG4gIGNvbnN0IHBsdWdpbkZhY3RvcnkgPSBuZXcgU3R5bGVzaGVldFBsdWdpbkZhY3RvcnkoXG4gICAge1xuICAgICAgc291cmNlbWFwOiAhIW9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgaW5saW5lQ29tcG9uZW50RGF0YSxcbiAgICAgIGJyb3dzZXJzOiBvcHRpb25zLmJyb3dzZXJzLFxuICAgICAgdGFpbHdpbmRDb25maWd1cmF0aW9uOiBvcHRpb25zLnRhaWx3aW5kQ29uZmlndXJhdGlvbixcbiAgICB9LFxuICAgIGNhY2hlLFxuICApO1xuXG4gIHJldHVybiB7XG4gICAgYWJzV29ya2luZ0Rpcjogb3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICBlbnRyeU5hbWVzOiBvcHRpb25zLm91dHB1dE5hbWVzPy5idW5kbGVzLFxuICAgIGFzc2V0TmFtZXM6IG9wdGlvbnMub3V0cHV0TmFtZXM/Lm1lZGlhLFxuICAgIGxvZ0xldmVsOiAnc2lsZW50JyxcbiAgICBtaW5pZnk6IG9wdGlvbnMub3B0aW1pemF0aW9uLFxuICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgIHNvdXJjZW1hcDogb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgb3V0ZGlyOiBvcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgdGFyZ2V0OiBvcHRpb25zLnRhcmdldCxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzOiBvcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgZXh0ZXJuYWw6IG9wdGlvbnMuZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgY29uZGl0aW9uczogWydzdHlsZScsICdzYXNzJ10sXG4gICAgbWFpbkZpZWxkczogWydzdHlsZScsICdzYXNzJ10sXG4gICAgcGx1Z2luczogW1xuICAgICAgcGx1Z2luRmFjdG9yeS5jcmVhdGUoU2Fzc1N0eWxlc2hlZXRMYW5ndWFnZSksXG4gICAgICBwbHVnaW5GYWN0b3J5LmNyZWF0ZShMZXNzU3R5bGVzaGVldExhbmd1YWdlKSxcbiAgICAgIHBsdWdpbkZhY3RvcnkuY3JlYXRlKENzc1N0eWxlc2hlZXRMYW5ndWFnZSksXG4gICAgICBjcmVhdGVDc3NSZXNvdXJjZVBsdWdpbihjYWNoZSksXG4gICAgXSxcbiAgfTtcbn1cblxuLyoqXG4gKiBCdW5kbGVzIGEgY29tcG9uZW50IHN0eWxlc2hlZXQuIFRoZSBzdHlsZXNoZWV0IGNhbiBiZSBlaXRoZXIgYW4gaW5saW5lIHN0eWxlc2hlZXQgdGhhdFxuICogaXMgY29udGFpbmVkIHdpdGhpbiB0aGUgQ29tcG9uZW50J3MgbWV0YWRhdGEgZGVmaW5pdGlvbiBvciBhbiBleHRlcm5hbCBmaWxlIHJlZmVyZW5jZWRcbiAqIGZyb20gdGhlIENvbXBvbmVudCdzIG1ldGFkYXRhIGRlZmluaXRpb24uXG4gKlxuICogQHBhcmFtIGlkZW50aWZpZXIgQSB1bmlxdWUgc3RyaW5nIGlkZW50aWZpZXIgZm9yIHRoZSBjb21wb25lbnQgc3R5bGVzaGVldC5cbiAqIEBwYXJhbSBsYW5ndWFnZSBUaGUgbGFuZ3VhZ2Ugb2YgdGhlIHN0eWxlc2hlZXQgc3VjaCBhcyBgY3NzYCBvciBgc2Nzc2AuXG4gKiBAcGFyYW0gZGF0YSBUaGUgc3RyaW5nIGNvbnRlbnQgb2YgdGhlIHN0eWxlc2hlZXQuXG4gKiBAcGFyYW0gZmlsZW5hbWUgVGhlIGZpbGVuYW1lIHJlcHJlc2VudGluZyB0aGUgc291cmNlIG9mIHRoZSBzdHlsZXNoZWV0IGNvbnRlbnQuXG4gKiBAcGFyYW0gaW5saW5lIElmIHRydWUsIHRoZSBzdHlsZXNoZWV0IHNvdXJjZSBpcyB3aXRoaW4gdGhlIGNvbXBvbmVudCBtZXRhZGF0YTtcbiAqIGlmIGZhbHNlLCB0aGUgc291cmNlIGlzIGEgc3R5bGVzaGVldCBmaWxlLlxuICogQHBhcmFtIG9wdGlvbnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHN0eWxlc2hlZXQgYnVuZGxpbmcgb3B0aW9ucy5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBvdXRwdXQgb2YgdGhlIGJ1bmRsaW5nIG9wZXJhdGlvbi5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGJ1bmRsZUNvbXBvbmVudFN0eWxlc2hlZXQoXG4gIGxhbmd1YWdlOiBzdHJpbmcsXG4gIGRhdGE6IHN0cmluZyxcbiAgZmlsZW5hbWU6IHN0cmluZyxcbiAgaW5saW5lOiBib29sZWFuLFxuICBvcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbiAgY2FjaGU/OiBMb2FkUmVzdWx0Q2FjaGUsXG4pIHtcbiAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6c3R5bGVzL2NvbXBvbmVudCc7XG4gIC8vIFVzZSBhIGhhc2ggb2YgdGhlIGlubGluZSBzdHlsZXNoZWV0IGNvbnRlbnQgdG8gZW5zdXJlIGEgY29uc2lzdGVudCBpZGVudGlmaWVyLiBFeHRlcm5hbCBzdHlsZXNoZWV0cyB3aWxsIHJlc29sdmVcbiAgLy8gdG8gdGhlIGFjdHVhbCBzdHlsZXNoZWV0IGZpbGUgcGF0aC5cbiAgLy8gVE9ETzogQ29uc2lkZXIgeHhoYXNoIGluc3RlYWQgZm9yIGhhc2hpbmdcbiAgY29uc3QgaWQgPSBpbmxpbmUgPyBjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoZGF0YSkuZGlnZXN0KCdoZXgnKSA6IGNvbXBvbmVudFN0eWxlQ291bnRlcisrO1xuICBjb25zdCBlbnRyeSA9IFtsYW5ndWFnZSwgaWQsIGZpbGVuYW1lXS5qb2luKCc7Jyk7XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zID0gY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnMob3B0aW9ucywgY2FjaGUsIHsgW2VudHJ5XTogZGF0YSB9KTtcbiAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0gW2Ake25hbWVzcGFjZX07JHtlbnRyeX1gXTtcbiAgYnVpbGRPcHRpb25zLnBsdWdpbnMucHVzaCh7XG4gICAgbmFtZTogJ2FuZ3VsYXItY29tcG9uZW50LXN0eWxlcycsXG4gICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgIGJ1aWxkLm9uUmVzb2x2ZSh7IGZpbHRlcjogL15hbmd1bGFyOnN0eWxlc1xcL2NvbXBvbmVudDsvIH0sIChhcmdzKSA9PiB7XG4gICAgICAgIGlmIChhcmdzLmtpbmQgIT09ICdlbnRyeS1wb2ludCcpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbmxpbmUpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGF0aDogZW50cnksXG4gICAgICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGF0aDogZmlsZW5hbWUsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9eY3NzOy8sIG5hbWVzcGFjZSB9LCBhc3luYyAoKSA9PiB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgY29udGVudHM6IGRhdGEsXG4gICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICByZXNvbHZlRGlyOiBwYXRoLmRpcm5hbWUoZmlsZW5hbWUpLFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gRXhlY3V0ZSBlc2J1aWxkXG4gIGNvbnN0IGNvbnRleHQgPSBuZXcgQnVuZGxlckNvbnRleHQob3B0aW9ucy53b3Jrc3BhY2VSb290LCBmYWxzZSwgYnVpbGRPcHRpb25zKTtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29udGV4dC5idW5kbGUoKTtcblxuICAvLyBFeHRyYWN0IHRoZSByZXN1bHQgb2YgdGhlIGJ1bmRsaW5nIGZyb20gdGhlIG91dHB1dCBmaWxlc1xuICBsZXQgY29udGVudHMgPSAnJztcbiAgbGV0IG1hcDtcbiAgbGV0IG91dHB1dFBhdGg7XG4gIGNvbnN0IHJlc291cmNlRmlsZXM6IE91dHB1dEZpbGVbXSA9IFtdO1xuICBpZiAoIXJlc3VsdC5lcnJvcnMpIHtcbiAgICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2YgcmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgICBjb25zdCBmaWxlbmFtZSA9IHBhdGguYmFzZW5hbWUob3V0cHV0RmlsZS5wYXRoKTtcbiAgICAgIGlmIChmaWxlbmFtZS5lbmRzV2l0aCgnLmNzcycpKSB7XG4gICAgICAgIG91dHB1dFBhdGggPSBvdXRwdXRGaWxlLnBhdGg7XG4gICAgICAgIGNvbnRlbnRzID0gb3V0cHV0RmlsZS50ZXh0O1xuICAgICAgfSBlbHNlIGlmIChmaWxlbmFtZS5lbmRzV2l0aCgnLmNzcy5tYXAnKSkge1xuICAgICAgICBtYXAgPSBvdXRwdXRGaWxlLnRleHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGUgb3V0cHV0IGZpbGVzIGNvdWxkIGFsc28gY29udGFpbiByZXNvdXJjZXMgKGltYWdlcy9mb250cy9ldGMuKSB0aGF0IHdlcmUgcmVmZXJlbmNlZFxuICAgICAgICByZXNvdXJjZUZpbGVzLnB1c2gob3V0cHV0RmlsZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgbGV0IG1ldGFmaWxlO1xuICBpZiAoIXJlc3VsdC5lcnJvcnMpIHtcbiAgICBtZXRhZmlsZSA9IHJlc3VsdC5tZXRhZmlsZTtcbiAgICAvLyBSZW1vdmUgZW50cnlQb2ludCBmaWVsZHMgZnJvbSBvdXRwdXRzIHRvIHByZXZlbnQgdGhlIGludGVybmFsIGNvbXBvbmVudCBzdHlsZXMgZnJvbSBiZWluZ1xuICAgIC8vIHRyZWF0ZWQgYXMgaW5pdGlhbCBmaWxlcy4gQWxzbyBtYXJrIHRoZSBlbnRyeSBhcyBhIGNvbXBvbmVudCByZXNvdXJjZSBmb3Igc3RhdCByZXBvcnRpbmcuXG4gICAgT2JqZWN0LnZhbHVlcyhtZXRhZmlsZS5vdXRwdXRzKS5mb3JFYWNoKChvdXRwdXQpID0+IHtcbiAgICAgIGRlbGV0ZSBvdXRwdXQuZW50cnlQb2ludDtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAob3V0cHV0IGFzIGFueSlbJ25nLWNvbXBvbmVudCddID0gdHJ1ZTtcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZXJyb3JzOiByZXN1bHQuZXJyb3JzLFxuICAgIHdhcm5pbmdzOiByZXN1bHQud2FybmluZ3MsXG4gICAgY29udGVudHMsXG4gICAgbWFwLFxuICAgIHBhdGg6IG91dHB1dFBhdGgsXG4gICAgcmVzb3VyY2VGaWxlcyxcbiAgICBtZXRhZmlsZSxcbiAgfTtcbn1cbiJdfQ==