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
const bundler_context_1 = require("../bundler-context");
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
    const context = new bundler_context_1.BundlerContext(options.workspaceRoot, false, buildOptions);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLW9wdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL3N0eWxlc2hlZXRzL2J1bmRsZS1vcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDZDQUF5QztBQUN6QywwREFBNkI7QUFDN0Isd0RBQW9EO0FBRXBELGlEQUF1RDtBQUN2RCwrREFBZ0U7QUFDaEUsbURBQXlEO0FBQ3pELG1EQUF5RDtBQUN6RCwyRUFBc0U7QUFFdEU7O0dBRUc7QUFDSCxJQUFJLHFCQUFxQixHQUFHLENBQUMsQ0FBQztBQWU5QixTQUFnQiw2QkFBNkIsQ0FDM0MsT0FBZ0MsRUFDaEMsS0FBdUIsRUFDdkIsbUJBQTRDO0lBRTVDLDZFQUE2RTtJQUM3RSxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsWUFBWSxFQUFFLEdBQUcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQzdELG1CQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsV0FBVyxDQUFDLENBQ2pELENBQUM7SUFFRixNQUFNLGFBQWEsR0FBRyxJQUFJLG1EQUF1QixDQUMvQztRQUNFLFNBQVMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVM7UUFDOUIsWUFBWTtRQUNaLG1CQUFtQjtRQUNuQixRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7UUFDMUIscUJBQXFCLEVBQUUsT0FBTyxDQUFDLHFCQUFxQjtLQUNyRCxFQUNELEtBQUssQ0FDTixDQUFDO0lBRUYsT0FBTztRQUNMLGFBQWEsRUFBRSxPQUFPLENBQUMsYUFBYTtRQUNwQyxNQUFNLEVBQUUsSUFBSTtRQUNaLFVBQVUsRUFBRSxPQUFPLENBQUMsV0FBVyxFQUFFLE9BQU87UUFDeEMsVUFBVSxFQUFFLE9BQU8s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QyxVQUFVLENBQUM7WUFDekIsOERBQThEO1lBQzdELE1BQWMsQ0FBQyxjQUFjLENBQUMsR0FBRyxJQUFJLENBQUM7UUFDekMsQ0FBQyxDQUFDLENBQUM7S0FDSjtJQUVELE9BQU87UUFDTCxNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU07UUFDckIsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRO1FBQ3pCLFFBQVE7UUFDUixHQUFHO1FBQ0gsSUFBSSxFQUFFLFVBQVU7UUFDaEIsYUFBYTtRQUNiLFFBQVE7S0FDVCxDQUFDO0FBQ0osQ0FBQztBQTNGRCw4REEyRkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZE9wdGlvbnMsIE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdub2RlOmNyeXB0byc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgQnVuZGxlckNvbnRleHQgfSBmcm9tICcuLi9idW5kbGVyLWNvbnRleHQnO1xuaW1wb3J0IHsgTG9hZFJlc3VsdENhY2hlIH0gZnJvbSAnLi4vbG9hZC1yZXN1bHQtY2FjaGUnO1xuaW1wb3J0IHsgQ3NzU3R5bGVzaGVldExhbmd1YWdlIH0gZnJvbSAnLi9jc3MtbGFuZ3VhZ2UnO1xuaW1wb3J0IHsgY3JlYXRlQ3NzUmVzb3VyY2VQbHVnaW4gfSBmcm9tICcuL2Nzcy1yZXNvdXJjZS1wbHVnaW4nO1xuaW1wb3J0IHsgTGVzc1N0eWxlc2hlZXRMYW5ndWFnZSB9IGZyb20gJy4vbGVzcy1sYW5ndWFnZSc7XG5pbXBvcnQgeyBTYXNzU3R5bGVzaGVldExhbmd1YWdlIH0gZnJvbSAnLi9zYXNzLWxhbmd1YWdlJztcbmltcG9ydCB7IFN0eWxlc2hlZXRQbHVnaW5GYWN0b3J5IH0gZnJvbSAnLi9zdHlsZXNoZWV0LXBsdWdpbi1mYWN0b3J5JztcblxuLyoqXG4gKiBBIGNvdW50ZXIgZm9yIGNvbXBvbmVudCBzdHlsZXMgdXNlZCB0byBnZW5lcmF0ZSB1bmlxdWUgYnVpbGQtdGltZSBpZGVudGlmaWVycyBmb3IgZWFjaCBzdHlsZXNoZWV0LlxuICovXG5sZXQgY29tcG9uZW50U3R5bGVDb3VudGVyID0gMDtcblxuZXhwb3J0IGludGVyZmFjZSBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyB7XG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZztcbiAgb3B0aW1pemF0aW9uOiBib29sZWFuO1xuICBwcmVzZXJ2ZVN5bWxpbmtzPzogYm9vbGVhbjtcbiAgc291cmNlbWFwOiBib29sZWFuIHwgJ2V4dGVybmFsJyB8ICdpbmxpbmUnO1xuICBvdXRwdXROYW1lcz86IHsgYnVuZGxlcz86IHN0cmluZzsgbWVkaWE/OiBzdHJpbmcgfTtcbiAgaW5jbHVkZVBhdGhzPzogc3RyaW5nW107XG4gIGV4dGVybmFsRGVwZW5kZW5jaWVzPzogc3RyaW5nW107XG4gIHRhcmdldDogc3RyaW5nW107XG4gIGJyb3dzZXJzOiBzdHJpbmdbXTtcbiAgdGFpbHdpbmRDb25maWd1cmF0aW9uPzogeyBmaWxlOiBzdHJpbmc7IHBhY2thZ2U6IHN0cmluZyB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLFxuICBjYWNoZT86IExvYWRSZXN1bHRDYWNoZSxcbiAgaW5saW5lQ29tcG9uZW50RGF0YT86IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4pOiBCdWlsZE9wdGlvbnMgJiB7IHBsdWdpbnM6IE5vbk51bGxhYmxlPEJ1aWxkT3B0aW9uc1sncGx1Z2lucyddPiB9IHtcbiAgLy8gRW5zdXJlIHByZXByb2Nlc3NvciBpbmNsdWRlIHBhdGhzIGFyZSBhYnNvbHV0ZSBiYXNlZCBvbiB0aGUgd29ya3NwYWNlIHJvb3RcbiAgY29uc3QgaW5jbHVkZVBhdGhzID0gb3B0aW9ucy5pbmNsdWRlUGF0aHM/Lm1hcCgoaW5jbHVkZVBhdGgpID0+XG4gICAgcGF0aC5yZXNvbHZlKG9wdGlvbnMud29ya3NwYWNlUm9vdCwgaW5jbHVkZVBhdGgpLFxuICApO1xuXG4gIGNvbnN0IHBsdWdpbkZhY3RvcnkgPSBuZXcgU3R5bGVzaGVldFBsdWdpbkZhY3RvcnkoXG4gICAge1xuICAgICAgc291cmNlbWFwOiAhIW9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgaW5saW5lQ29tcG9uZW50RGF0YSxcbiAgICAgIGJyb3dzZXJzOiBvcHRpb25zLmJyb3dzZXJzLFxuICAgICAgdGFpbHdpbmRDb25maWd1cmF0aW9uOiBvcHRpb25zLnRhaWx3aW5kQ29uZmlndXJhdGlvbixcbiAgICB9LFxuICAgIGNhY2hlLFxuICApO1xuXG4gIHJldHVybiB7XG4gICAgYWJzV29ya2luZ0Rpcjogb3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICBlbnRyeU5hbWVzOiBvcHRpb25zLm91dHB1dE5hbWVzPy5idW5kbGVzLFxuICAgIGFzc2V0TmFtZXM6IG9wdGlvbnMub3V0cHV0TmFtZXM/Lm1lZGlhLFxuICAgIGxvZ0xldmVsOiAnc2lsZW50JyxcbiAgICBtaW5pZnk6IG9wdGlvbnMub3B0aW1pemF0aW9uLFxuICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgIHNvdXJjZW1hcDogb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgb3V0ZGlyOiBvcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgdGFyZ2V0OiBvcHRpb25zLnRhcmdldCxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzOiBvcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgZXh0ZXJuYWw6IG9wdGlvbnMuZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgY29uZGl0aW9uczogWydzdHlsZScsICdzYXNzJ10sXG4gICAgbWFpbkZpZWxkczogWydzdHlsZScsICdzYXNzJ10sXG4gICAgcGx1Z2luczogW1xuICAgICAgcGx1Z2luRmFjdG9yeS5jcmVhdGUoU2Fzc1N0eWxlc2hlZXRMYW5ndWFnZSksXG4gICAgICBwbHVnaW5GYWN0b3J5LmNyZWF0ZShMZXNzU3R5bGVzaGVldExhbmd1YWdlKSxcbiAgICAgIHBsdWdpbkZhY3RvcnkuY3JlYXRlKENzc1N0eWxlc2hlZXRMYW5ndWFnZSksXG4gICAgICBjcmVhdGVDc3NSZXNvdXJjZVBsdWdpbihjYWNoZSksXG4gICAgXSxcbiAgfTtcbn1cblxuLyoqXG4gKiBCdW5kbGVzIGEgY29tcG9uZW50IHN0eWxlc2hlZXQuIFRoZSBzdHlsZXNoZWV0IGNhbiBiZSBlaXRoZXIgYW4gaW5saW5lIHN0eWxlc2hlZXQgdGhhdFxuICogaXMgY29udGFpbmVkIHdpdGhpbiB0aGUgQ29tcG9uZW50J3MgbWV0YWRhdGEgZGVmaW5pdGlvbiBvciBhbiBleHRlcm5hbCBmaWxlIHJlZmVyZW5jZWRcbiAqIGZyb20gdGhlIENvbXBvbmVudCdzIG1ldGFkYXRhIGRlZmluaXRpb24uXG4gKlxuICogQHBhcmFtIGlkZW50aWZpZXIgQSB1bmlxdWUgc3RyaW5nIGlkZW50aWZpZXIgZm9yIHRoZSBjb21wb25lbnQgc3R5bGVzaGVldC5cbiAqIEBwYXJhbSBsYW5ndWFnZSBUaGUgbGFuZ3VhZ2Ugb2YgdGhlIHN0eWxlc2hlZXQgc3VjaCBhcyBgY3NzYCBvciBgc2Nzc2AuXG4gKiBAcGFyYW0gZGF0YSBUaGUgc3RyaW5nIGNvbnRlbnQgb2YgdGhlIHN0eWxlc2hlZXQuXG4gKiBAcGFyYW0gZmlsZW5hbWUgVGhlIGZpbGVuYW1lIHJlcHJlc2VudGluZyB0aGUgc291cmNlIG9mIHRoZSBzdHlsZXNoZWV0IGNvbnRlbnQuXG4gKiBAcGFyYW0gaW5saW5lIElmIHRydWUsIHRoZSBzdHlsZXNoZWV0IHNvdXJjZSBpcyB3aXRoaW4gdGhlIGNvbXBvbmVudCBtZXRhZGF0YTtcbiAqIGlmIGZhbHNlLCB0aGUgc291cmNlIGlzIGEgc3R5bGVzaGVldCBmaWxlLlxuICogQHBhcmFtIG9wdGlvbnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHN0eWxlc2hlZXQgYnVuZGxpbmcgb3B0aW9ucy5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBvdXRwdXQgb2YgdGhlIGJ1bmRsaW5nIG9wZXJhdGlvbi5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGJ1bmRsZUNvbXBvbmVudFN0eWxlc2hlZXQoXG4gIGxhbmd1YWdlOiBzdHJpbmcsXG4gIGRhdGE6IHN0cmluZyxcbiAgZmlsZW5hbWU6IHN0cmluZyxcbiAgaW5saW5lOiBib29sZWFuLFxuICBvcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbiAgY2FjaGU/OiBMb2FkUmVzdWx0Q2FjaGUsXG4pIHtcbiAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6c3R5bGVzL2NvbXBvbmVudCc7XG4gIC8vIFVzZSBhIGhhc2ggb2YgdGhlIGlubGluZSBzdHlsZXNoZWV0IGNvbnRlbnQgdG8gZW5zdXJlIGEgY29uc2lzdGVudCBpZGVudGlmaWVyLiBFeHRlcm5hbCBzdHlsZXNoZWV0cyB3aWxsIHJlc29sdmVcbiAgLy8gdG8gdGhlIGFjdHVhbCBzdHlsZXNoZWV0IGZpbGUgcGF0aC5cbiAgLy8gVE9ETzogQ29uc2lkZXIgeHhoYXNoIGluc3RlYWQgZm9yIGhhc2hpbmdcbiAgY29uc3QgaWQgPSBpbmxpbmUgPyBjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoZGF0YSkuZGlnZXN0KCdoZXgnKSA6IGNvbXBvbmVudFN0eWxlQ291bnRlcisrO1xuICBjb25zdCBlbnRyeSA9IFtsYW5ndWFnZSwgaWQsIGZpbGVuYW1lXS5qb2luKCc7Jyk7XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zID0gY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnMob3B0aW9ucywgY2FjaGUsIHsgW2VudHJ5XTogZGF0YSB9KTtcbiAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0gW2Ake25hbWVzcGFjZX07JHtlbnRyeX1gXTtcbiAgYnVpbGRPcHRpb25zLnBsdWdpbnMucHVzaCh7XG4gICAgbmFtZTogJ2FuZ3VsYXItY29tcG9uZW50LXN0eWxlcycsXG4gICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgIGJ1aWxkLm9uUmVzb2x2ZSh7IGZpbHRlcjogL15hbmd1bGFyOnN0eWxlc1xcL2NvbXBvbmVudDsvIH0sIChhcmdzKSA9PiB7XG4gICAgICAgIGlmIChhcmdzLmtpbmQgIT09ICdlbnRyeS1wb2ludCcpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbmxpbmUpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGF0aDogZW50cnksXG4gICAgICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGF0aDogZmlsZW5hbWUsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9eY3NzOy8sIG5hbWVzcGFjZSB9LCBhc3luYyAoKSA9PiB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgY29udGVudHM6IGRhdGEsXG4gICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICByZXNvbHZlRGlyOiBwYXRoLmRpcm5hbWUoZmlsZW5hbWUpLFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gRXhlY3V0ZSBlc2J1aWxkXG4gIGNvbnN0IGNvbnRleHQgPSBuZXcgQnVuZGxlckNvbnRleHQob3B0aW9ucy53b3Jrc3BhY2VSb290LCBmYWxzZSwgYnVpbGRPcHRpb25zKTtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29udGV4dC5idW5kbGUoKTtcblxuICAvLyBFeHRyYWN0IHRoZSByZXN1bHQgb2YgdGhlIGJ1bmRsaW5nIGZyb20gdGhlIG91dHB1dCBmaWxlc1xuICBsZXQgY29udGVudHMgPSAnJztcbiAgbGV0IG1hcDtcbiAgbGV0IG91dHB1dFBhdGg7XG4gIGNvbnN0IHJlc291cmNlRmlsZXM6IE91dHB1dEZpbGVbXSA9IFtdO1xuICBpZiAoIXJlc3VsdC5lcnJvcnMpIHtcbiAgICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2YgcmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgICBjb25zdCBmaWxlbmFtZSA9IHBhdGguYmFzZW5hbWUob3V0cHV0RmlsZS5wYXRoKTtcbiAgICAgIGlmIChmaWxlbmFtZS5lbmRzV2l0aCgnLmNzcycpKSB7XG4gICAgICAgIG91dHB1dFBhdGggPSBvdXRwdXRGaWxlLnBhdGg7XG4gICAgICAgIGNvbnRlbnRzID0gb3V0cHV0RmlsZS50ZXh0O1xuICAgICAgfSBlbHNlIGlmIChmaWxlbmFtZS5lbmRzV2l0aCgnLmNzcy5tYXAnKSkge1xuICAgICAgICBtYXAgPSBvdXRwdXRGaWxlLnRleHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGUgb3V0cHV0IGZpbGVzIGNvdWxkIGFsc28gY29udGFpbiByZXNvdXJjZXMgKGltYWdlcy9mb250cy9ldGMuKSB0aGF0IHdlcmUgcmVmZXJlbmNlZFxuICAgICAgICByZXNvdXJjZUZpbGVzLnB1c2gob3V0cHV0RmlsZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgbGV0IG1ldGFmaWxlO1xuICBpZiAoIXJlc3VsdC5lcnJvcnMpIHtcbiAgICBtZXRhZmlsZSA9IHJlc3VsdC5tZXRhZmlsZTtcbiAgICAvLyBSZW1vdmUgZW50cnlQb2ludCBmaWVsZHMgZnJvbSBvdXRwdXRzIHRvIHByZXZlbnQgdGhlIGludGVybmFsIGNvbXBvbmVudCBzdHlsZXMgZnJvbSBiZWluZ1xuICAgIC8vIHRyZWF0ZWQgYXMgaW5pdGlhbCBmaWxlcy4gQWxzbyBtYXJrIHRoZSBlbnRyeSBhcyBhIGNvbXBvbmVudCByZXNvdXJjZSBmb3Igc3RhdCByZXBvcnRpbmcuXG4gICAgT2JqZWN0LnZhbHVlcyhtZXRhZmlsZS5vdXRwdXRzKS5mb3JFYWNoKChvdXRwdXQpID0+IHtcbiAgICAgIGRlbGV0ZSBvdXRwdXQuZW50cnlQb2ludDtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAob3V0cHV0IGFzIGFueSlbJ25nLWNvbXBvbmVudCddID0gdHJ1ZTtcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZXJyb3JzOiByZXN1bHQuZXJyb3JzLFxuICAgIHdhcm5pbmdzOiByZXN1bHQud2FybmluZ3MsXG4gICAgY29udGVudHMsXG4gICAgbWFwLFxuICAgIHBhdGg6IG91dHB1dFBhdGgsXG4gICAgcmVzb3VyY2VGaWxlcyxcbiAgICBtZXRhZmlsZSxcbiAgfTtcbn1cbiJdfQ==