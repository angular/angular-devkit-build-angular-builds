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
const css_plugin_1 = require("./css-plugin");
const css_resource_plugin_1 = require("./css-resource-plugin");
const less_plugin_1 = require("./less-plugin");
const sass_plugin_1 = require("./sass-plugin");
/**
 * A counter for component styles used to generate unique build-time identifiers for each stylesheet.
 */
let componentStyleCounter = 0;
function createStylesheetBundleOptions(options, cache, inlineComponentData) {
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
            }, cache),
            (0, less_plugin_1.createLessPlugin)({
                sourcemap: !!options.sourcemap,
                includePaths,
                inlineComponentData,
            }, cache),
            (0, css_plugin_1.createCssPlugin)({
                sourcemap: !!options.sourcemap,
                inlineComponentData,
                browsers: options.browsers,
                tailwindConfiguration: options.tailwindConfiguration,
            }, cache),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLW9wdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc3R5bGVzaGVldHMvYnVuZGxlLW9wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsNkNBQXlDO0FBQ3pDLDBEQUE2QjtBQUM3Qix3Q0FBNEM7QUFFNUMsNkNBQStDO0FBQy9DLCtEQUFnRTtBQUNoRSwrQ0FBaUQ7QUFDakQsK0NBQWlEO0FBRWpEOztHQUVHO0FBQ0gsSUFBSSxxQkFBcUIsR0FBRyxDQUFDLENBQUM7QUFlOUIsU0FBZ0IsNkJBQTZCLENBQzNDLE9BQWdDLEVBQ2hDLEtBQXVCLEVBQ3ZCLG1CQUE0QztJQUU1Qyw2RUFBNkU7SUFDN0UsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksRUFBRSxHQUFHLENBQUMsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUM3RCxtQkFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxDQUNqRCxDQUFDO0lBRUYsT0FBTztRQUNMLGFBQWEsRUFBRSxPQUFPLENBQUMsYUFBYTtRQUNwQyxNQUFNLEVBQUUsSUFBSTtRQUNaLFVBQVUsRUFBRSxPQUFPLENBQUMsV0FBVyxFQUFFLE9BQU87UUFDeEMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxXQUFXLEVBQUUsS0FBSztRQUN0QyxRQUFRLEVBQUUsUUFBUTtRQUNsQixNQUFNLEVBQUUsT0FBTyxDQUFDLFlBQVk7UUFDNUIsUUFBUSxFQUFFLElBQUk7UUFDZCxTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVM7UUFDNUIsTUFBTSxFQUFFLE9BQU8sQ0FBQyxhQUFhO1FBQzdCLEtBQUssRUFBRSxLQUFLO1FBQ1osUUFBUSxFQUFFLFNBQVM7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LE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDakQsT0FBTyxNQUFNLENBQUMsVUFBVSxDQUFDO1lBQ3pCLDhEQUE4RDtZQUM3RCxNQUFjLENBQUMsY0FBYyxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQ3pDLENBQUMsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxPQUFPO1FBQ0wsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO1FBQ3JCLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtRQUN6QixRQUFRO1FBQ1IsR0FBRztRQUNILElBQUksRUFBRSxVQUFVO1FBQ2hCLGFBQWE7UUFDYixRQUFRO0tBQ1QsQ0FBQztBQUNKLENBQUM7QUEzRkQsOERBMkZDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zLCBPdXRwdXRGaWxlIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnbm9kZTpjcnlwdG8nO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IEJ1bmRsZXJDb250ZXh0IH0gZnJvbSAnLi4vZXNidWlsZCc7XG5pbXBvcnQgeyBMb2FkUmVzdWx0Q2FjaGUgfSBmcm9tICcuLi9sb2FkLXJlc3VsdC1jYWNoZSc7XG5pbXBvcnQgeyBjcmVhdGVDc3NQbHVnaW4gfSBmcm9tICcuL2Nzcy1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlQ3NzUmVzb3VyY2VQbHVnaW4gfSBmcm9tICcuL2Nzcy1yZXNvdXJjZS1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlTGVzc1BsdWdpbiB9IGZyb20gJy4vbGVzcy1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlU2Fzc1BsdWdpbiB9IGZyb20gJy4vc2Fzcy1wbHVnaW4nO1xuXG4vKipcbiAqIEEgY291bnRlciBmb3IgY29tcG9uZW50IHN0eWxlcyB1c2VkIHRvIGdlbmVyYXRlIHVuaXF1ZSBidWlsZC10aW1lIGlkZW50aWZpZXJzIGZvciBlYWNoIHN0eWxlc2hlZXQuXG4gKi9cbmxldCBjb21wb25lbnRTdHlsZUNvdW50ZXIgPSAwO1xuXG5leHBvcnQgaW50ZXJmYWNlIEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zIHtcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nO1xuICBvcHRpbWl6YXRpb246IGJvb2xlYW47XG4gIHByZXNlcnZlU3ltbGlua3M/OiBib29sZWFuO1xuICBzb3VyY2VtYXA6IGJvb2xlYW4gfCAnZXh0ZXJuYWwnIHwgJ2lubGluZSc7XG4gIG91dHB1dE5hbWVzPzogeyBidW5kbGVzPzogc3RyaW5nOyBtZWRpYT86IHN0cmluZyB9O1xuICBpbmNsdWRlUGF0aHM/OiBzdHJpbmdbXTtcbiAgZXh0ZXJuYWxEZXBlbmRlbmNpZXM/OiBzdHJpbmdbXTtcbiAgdGFyZ2V0OiBzdHJpbmdbXTtcbiAgYnJvd3NlcnM6IHN0cmluZ1tdO1xuICB0YWlsd2luZENvbmZpZ3VyYXRpb24/OiB7IGZpbGU6IHN0cmluZzsgcGFja2FnZTogc3RyaW5nIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsXG4gIGNhY2hlPzogTG9hZFJlc3VsdENhY2hlLFxuICBpbmxpbmVDb21wb25lbnREYXRhPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbik6IEJ1aWxkT3B0aW9ucyAmIHsgcGx1Z2luczogTm9uTnVsbGFibGU8QnVpbGRPcHRpb25zWydwbHVnaW5zJ10+IH0ge1xuICAvLyBFbnN1cmUgcHJlcHJvY2Vzc29yIGluY2x1ZGUgcGF0aHMgYXJlIGFic29sdXRlIGJhc2VkIG9uIHRoZSB3b3Jrc3BhY2Ugcm9vdFxuICBjb25zdCBpbmNsdWRlUGF0aHMgPSBvcHRpb25zLmluY2x1ZGVQYXRocz8ubWFwKChpbmNsdWRlUGF0aCkgPT5cbiAgICBwYXRoLnJlc29sdmUob3B0aW9ucy53b3Jrc3BhY2VSb290LCBpbmNsdWRlUGF0aCksXG4gICk7XG5cbiAgcmV0dXJuIHtcbiAgICBhYnNXb3JraW5nRGlyOiBvcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgYnVuZGxlOiB0cnVlLFxuICAgIGVudHJ5TmFtZXM6IG9wdGlvbnMub3V0cHV0TmFtZXM/LmJ1bmRsZXMsXG4gICAgYXNzZXROYW1lczogb3B0aW9ucy5vdXRwdXROYW1lcz8ubWVkaWEsXG4gICAgbG9nTGV2ZWw6ICdzaWxlbnQnLFxuICAgIG1pbmlmeTogb3B0aW9ucy5vcHRpbWl6YXRpb24sXG4gICAgbWV0YWZpbGU6IHRydWUsXG4gICAgc291cmNlbWFwOiBvcHRpb25zLnNvdXJjZW1hcCxcbiAgICBvdXRkaXI6IG9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICB3cml0ZTogZmFsc2UsXG4gICAgcGxhdGZvcm06ICdicm93c2VyJyxcbiAgICB0YXJnZXQ6IG9wdGlvbnMudGFyZ2V0LFxuICAgIHByZXNlcnZlU3ltbGlua3M6IG9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICBleHRlcm5hbDogb3B0aW9ucy5leHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBjb25kaXRpb25zOiBbJ3N0eWxlJywgJ3Nhc3MnXSxcbiAgICBtYWluRmllbGRzOiBbJ3N0eWxlJywgJ3Nhc3MnXSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVTYXNzUGx1Z2luKFxuICAgICAgICB7XG4gICAgICAgICAgc291cmNlbWFwOiAhIW9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgIGxvYWRQYXRoczogaW5jbHVkZVBhdGhzLFxuICAgICAgICAgIGlubGluZUNvbXBvbmVudERhdGEsXG4gICAgICAgIH0sXG4gICAgICAgIGNhY2hlLFxuICAgICAgKSxcbiAgICAgIGNyZWF0ZUxlc3NQbHVnaW4oXG4gICAgICAgIHtcbiAgICAgICAgICBzb3VyY2VtYXA6ICEhb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICAgIGlubGluZUNvbXBvbmVudERhdGEsXG4gICAgICAgIH0sXG4gICAgICAgIGNhY2hlLFxuICAgICAgKSxcbiAgICAgIGNyZWF0ZUNzc1BsdWdpbihcbiAgICAgICAge1xuICAgICAgICAgIHNvdXJjZW1hcDogISFvcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICBpbmxpbmVDb21wb25lbnREYXRhLFxuICAgICAgICAgIGJyb3dzZXJzOiBvcHRpb25zLmJyb3dzZXJzLFxuICAgICAgICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbjogb3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gICAgICAgIH0sXG4gICAgICAgIGNhY2hlLFxuICAgICAgKSxcbiAgICAgIGNyZWF0ZUNzc1Jlc291cmNlUGx1Z2luKGNhY2hlKSxcbiAgICBdLFxuICB9O1xufVxuXG4vKipcbiAqIEJ1bmRsZXMgYSBjb21wb25lbnQgc3R5bGVzaGVldC4gVGhlIHN0eWxlc2hlZXQgY2FuIGJlIGVpdGhlciBhbiBpbmxpbmUgc3R5bGVzaGVldCB0aGF0XG4gKiBpcyBjb250YWluZWQgd2l0aGluIHRoZSBDb21wb25lbnQncyBtZXRhZGF0YSBkZWZpbml0aW9uIG9yIGFuIGV4dGVybmFsIGZpbGUgcmVmZXJlbmNlZFxuICogZnJvbSB0aGUgQ29tcG9uZW50J3MgbWV0YWRhdGEgZGVmaW5pdGlvbi5cbiAqXG4gKiBAcGFyYW0gaWRlbnRpZmllciBBIHVuaXF1ZSBzdHJpbmcgaWRlbnRpZmllciBmb3IgdGhlIGNvbXBvbmVudCBzdHlsZXNoZWV0LlxuICogQHBhcmFtIGxhbmd1YWdlIFRoZSBsYW5ndWFnZSBvZiB0aGUgc3R5bGVzaGVldCBzdWNoIGFzIGBjc3NgIG9yIGBzY3NzYC5cbiAqIEBwYXJhbSBkYXRhIFRoZSBzdHJpbmcgY29udGVudCBvZiB0aGUgc3R5bGVzaGVldC5cbiAqIEBwYXJhbSBmaWxlbmFtZSBUaGUgZmlsZW5hbWUgcmVwcmVzZW50aW5nIHRoZSBzb3VyY2Ugb2YgdGhlIHN0eWxlc2hlZXQgY29udGVudC5cbiAqIEBwYXJhbSBpbmxpbmUgSWYgdHJ1ZSwgdGhlIHN0eWxlc2hlZXQgc291cmNlIGlzIHdpdGhpbiB0aGUgY29tcG9uZW50IG1ldGFkYXRhO1xuICogaWYgZmFsc2UsIHRoZSBzb3VyY2UgaXMgYSBzdHlsZXNoZWV0IGZpbGUuXG4gKiBAcGFyYW0gb3B0aW9ucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgc3R5bGVzaGVldCBidW5kbGluZyBvcHRpb25zLlxuICogQHJldHVybnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIG91dHB1dCBvZiB0aGUgYnVuZGxpbmcgb3BlcmF0aW9uLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYnVuZGxlQ29tcG9uZW50U3R5bGVzaGVldChcbiAgbGFuZ3VhZ2U6IHN0cmluZyxcbiAgZGF0YTogc3RyaW5nLFxuICBmaWxlbmFtZTogc3RyaW5nLFxuICBpbmxpbmU6IGJvb2xlYW4sXG4gIG9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLFxuICBjYWNoZT86IExvYWRSZXN1bHRDYWNoZSxcbikge1xuICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpzdHlsZXMvY29tcG9uZW50JztcbiAgLy8gVXNlIGEgaGFzaCBvZiB0aGUgaW5saW5lIHN0eWxlc2hlZXQgY29udGVudCB0byBlbnN1cmUgYSBjb25zaXN0ZW50IGlkZW50aWZpZXIuIEV4dGVybmFsIHN0eWxlc2hlZXRzIHdpbGwgcmVzb2x2ZVxuICAvLyB0byB0aGUgYWN0dWFsIHN0eWxlc2hlZXQgZmlsZSBwYXRoLlxuICAvLyBUT0RPOiBDb25zaWRlciB4eGhhc2ggaW5zdGVhZCBmb3IgaGFzaGluZ1xuICBjb25zdCBpZCA9IGlubGluZSA/IGNyZWF0ZUhhc2goJ3NoYTI1NicpLnVwZGF0ZShkYXRhKS5kaWdlc3QoJ2hleCcpIDogY29tcG9uZW50U3R5bGVDb3VudGVyKys7XG4gIGNvbnN0IGVudHJ5ID0gW2xhbmd1YWdlLCBpZCwgZmlsZW5hbWVdLmpvaW4oJzsnKTtcblxuICBjb25zdCBidWlsZE9wdGlvbnMgPSBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyhvcHRpb25zLCBjYWNoZSwgeyBbZW50cnldOiBkYXRhIH0pO1xuICBidWlsZE9wdGlvbnMuZW50cnlQb2ludHMgPSBbYCR7bmFtZXNwYWNlfTske2VudHJ5fWBdO1xuICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKHtcbiAgICBuYW1lOiAnYW5ndWxhci1jb21wb25lbnQtc3R5bGVzJyxcbiAgICBzZXR1cChidWlsZCkge1xuICAgICAgYnVpbGQub25SZXNvbHZlKHsgZmlsdGVyOiAvXmFuZ3VsYXI6c3R5bGVzXFwvY29tcG9uZW50Oy8gfSwgKGFyZ3MpID0+IHtcbiAgICAgICAgaWYgKGFyZ3Mua2luZCAhPT0gJ2VudHJ5LXBvaW50Jykge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlubGluZSkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwYXRoOiBlbnRyeSxcbiAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwYXRoOiBmaWxlbmFtZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL15jc3M7LywgbmFtZXNwYWNlIH0sIGFzeW5jICgpID0+IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50czogZGF0YSxcbiAgICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgICAgIHJlc29sdmVEaXI6IHBhdGguZGlybmFtZShmaWxlbmFtZSksXG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICB9LFxuICB9KTtcblxuICAvLyBFeGVjdXRlIGVzYnVpbGRcbiAgY29uc3QgY29udGV4dCA9IG5ldyBCdW5kbGVyQ29udGV4dChvcHRpb25zLndvcmtzcGFjZVJvb3QsIGZhbHNlLCBidWlsZE9wdGlvbnMpO1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBjb250ZXh0LmJ1bmRsZSgpO1xuXG4gIC8vIEV4dHJhY3QgdGhlIHJlc3VsdCBvZiB0aGUgYnVuZGxpbmcgZnJvbSB0aGUgb3V0cHV0IGZpbGVzXG4gIGxldCBjb250ZW50cyA9ICcnO1xuICBsZXQgbWFwO1xuICBsZXQgb3V0cHV0UGF0aDtcbiAgY29uc3QgcmVzb3VyY2VGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gIGlmICghcmVzdWx0LmVycm9ycykge1xuICAgIGZvciAoY29uc3Qgb3V0cHV0RmlsZSBvZiByZXN1bHQub3V0cHV0RmlsZXMpIHtcbiAgICAgIGNvbnN0IGZpbGVuYW1lID0gcGF0aC5iYXNlbmFtZShvdXRwdXRGaWxlLnBhdGgpO1xuICAgICAgaWYgKGZpbGVuYW1lLmVuZHNXaXRoKCcuY3NzJykpIHtcbiAgICAgICAgb3V0cHV0UGF0aCA9IG91dHB1dEZpbGUucGF0aDtcbiAgICAgICAgY29udGVudHMgPSBvdXRwdXRGaWxlLnRleHQ7XG4gICAgICB9IGVsc2UgaWYgKGZpbGVuYW1lLmVuZHNXaXRoKCcuY3NzLm1hcCcpKSB7XG4gICAgICAgIG1hcCA9IG91dHB1dEZpbGUudGV4dDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoZSBvdXRwdXQgZmlsZXMgY291bGQgYWxzbyBjb250YWluIHJlc291cmNlcyAoaW1hZ2VzL2ZvbnRzL2V0Yy4pIHRoYXQgd2VyZSByZWZlcmVuY2VkXG4gICAgICAgIHJlc291cmNlRmlsZXMucHVzaChvdXRwdXRGaWxlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsZXQgbWV0YWZpbGU7XG4gIGlmICghcmVzdWx0LmVycm9ycykge1xuICAgIG1ldGFmaWxlID0gcmVzdWx0Lm1ldGFmaWxlO1xuICAgIC8vIFJlbW92ZSBlbnRyeVBvaW50IGZpZWxkcyBmcm9tIG91dHB1dHMgdG8gcHJldmVudCB0aGUgaW50ZXJuYWwgY29tcG9uZW50IHN0eWxlcyBmcm9tIGJlaW5nXG4gICAgLy8gdHJlYXRlZCBhcyBpbml0aWFsIGZpbGVzLiBBbHNvIG1hcmsgdGhlIGVudHJ5IGFzIGEgY29tcG9uZW50IHJlc291cmNlIGZvciBzdGF0IHJlcG9ydGluZy5cbiAgICBPYmplY3QudmFsdWVzKG1ldGFmaWxlLm91dHB1dHMpLmZvckVhY2goKG91dHB1dCkgPT4ge1xuICAgICAgZGVsZXRlIG91dHB1dC5lbnRyeVBvaW50O1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIChvdXRwdXQgYXMgYW55KVsnbmctY29tcG9uZW50J10gPSB0cnVlO1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBlcnJvcnM6IHJlc3VsdC5lcnJvcnMsXG4gICAgd2FybmluZ3M6IHJlc3VsdC53YXJuaW5ncyxcbiAgICBjb250ZW50cyxcbiAgICBtYXAsXG4gICAgcGF0aDogb3V0cHV0UGF0aCxcbiAgICByZXNvdXJjZUZpbGVzLFxuICAgIG1ldGFmaWxlLFxuICB9O1xufVxuIl19