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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLW9wdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL3N0eWxlc2hlZXRzL2J1bmRsZS1vcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDZDQUF5QztBQUN6QywwREFBNkI7QUFDN0Isd0RBQW9EO0FBRXBELGlEQUF1RDtBQUN2RCwrREFBZ0U7QUFDaEUsbURBQXlEO0FBQ3pELG1EQUF5RDtBQUN6RCwyRUFBc0U7QUFFdEU7O0dBRUc7QUFDSCxJQUFJLHFCQUFxQixHQUFHLENBQUMsQ0FBQztBQWM5QixTQUFnQiw2QkFBNkIsQ0FDM0MsT0FBZ0MsRUFDaEMsS0FBdUIsRUFDdkIsbUJBQTRDO0lBRTVDLDZFQUE2RTtJQUM3RSxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsWUFBWSxFQUFFLEdBQUcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQzdELG1CQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsV0FBVyxDQUFDLENBQ2pELENBQUM7SUFFRixNQUFNLGFBQWEsR0FBRyxJQUFJLG1EQUF1QixDQUMvQztRQUNFLFNBQVMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVM7UUFDOUIsWUFBWTtRQUNaLG1CQUFtQjtRQUNuQixxQkFBcUIsRUFBRSxPQUFPLENBQUMscUJBQXFCO0tBQ3JELEVBQ0QsS0FBSyxDQUNOLENBQUM7SUFFRixPQUFPO1FBQ0wsYUFBYSxFQUFFLE9BQU8sQ0FBQyxhQUFhO1FBQ3BDLE1BQU0sRUFBRSxJQUFJO1FBQ1osVUFBVSxFQUFFLE9BQU8sQ0FBQyxXQUFXLEVBQUUsT0FBTztRQUN4QyxVQUFVLEVBQUUsT0FBTyxDQUFDLFdBQVcsRUFBRSxLQUFLO1FBQ3RDLFFBQVEs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TUFBYyxDQUFDLGNBQWMsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUN6QyxDQUFDLENBQUMsQ0FBQztLQUNKO0lBRUQsT0FBTztRQUNMLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTTtRQUNyQixRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7UUFDekIsUUFBUTtRQUNSLEdBQUc7UUFDSCxJQUFJLEVBQUUsVUFBVTtRQUNoQixhQUFhO1FBQ2IsUUFBUTtLQUNULENBQUM7QUFDSixDQUFDO0FBM0ZELDhEQTJGQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkT3B0aW9ucywgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ25vZGU6Y3J5cHRvJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBCdW5kbGVyQ29udGV4dCB9IGZyb20gJy4uL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgeyBMb2FkUmVzdWx0Q2FjaGUgfSBmcm9tICcuLi9sb2FkLXJlc3VsdC1jYWNoZSc7XG5pbXBvcnQgeyBDc3NTdHlsZXNoZWV0TGFuZ3VhZ2UgfSBmcm9tICcuL2Nzcy1sYW5ndWFnZSc7XG5pbXBvcnQgeyBjcmVhdGVDc3NSZXNvdXJjZVBsdWdpbiB9IGZyb20gJy4vY3NzLXJlc291cmNlLXBsdWdpbic7XG5pbXBvcnQgeyBMZXNzU3R5bGVzaGVldExhbmd1YWdlIH0gZnJvbSAnLi9sZXNzLWxhbmd1YWdlJztcbmltcG9ydCB7IFNhc3NTdHlsZXNoZWV0TGFuZ3VhZ2UgfSBmcm9tICcuL3Nhc3MtbGFuZ3VhZ2UnO1xuaW1wb3J0IHsgU3R5bGVzaGVldFBsdWdpbkZhY3RvcnkgfSBmcm9tICcuL3N0eWxlc2hlZXQtcGx1Z2luLWZhY3RvcnknO1xuXG4vKipcbiAqIEEgY291bnRlciBmb3IgY29tcG9uZW50IHN0eWxlcyB1c2VkIHRvIGdlbmVyYXRlIHVuaXF1ZSBidWlsZC10aW1lIGlkZW50aWZpZXJzIGZvciBlYWNoIHN0eWxlc2hlZXQuXG4gKi9cbmxldCBjb21wb25lbnRTdHlsZUNvdW50ZXIgPSAwO1xuXG5leHBvcnQgaW50ZXJmYWNlIEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zIHtcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nO1xuICBvcHRpbWl6YXRpb246IGJvb2xlYW47XG4gIHByZXNlcnZlU3ltbGlua3M/OiBib29sZWFuO1xuICBzb3VyY2VtYXA6IGJvb2xlYW4gfCAnZXh0ZXJuYWwnIHwgJ2lubGluZSc7XG4gIG91dHB1dE5hbWVzPzogeyBidW5kbGVzPzogc3RyaW5nOyBtZWRpYT86IHN0cmluZyB9O1xuICBpbmNsdWRlUGF0aHM/OiBzdHJpbmdbXTtcbiAgZXh0ZXJuYWxEZXBlbmRlbmNpZXM/OiBzdHJpbmdbXTtcbiAgdGFyZ2V0OiBzdHJpbmdbXTtcbiAgdGFpbHdpbmRDb25maWd1cmF0aW9uPzogeyBmaWxlOiBzdHJpbmc7IHBhY2thZ2U6IHN0cmluZyB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLFxuICBjYWNoZT86IExvYWRSZXN1bHRDYWNoZSxcbiAgaW5saW5lQ29tcG9uZW50RGF0YT86IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4pOiBCdWlsZE9wdGlvbnMgJiB7IHBsdWdpbnM6IE5vbk51bGxhYmxlPEJ1aWxkT3B0aW9uc1sncGx1Z2lucyddPiB9IHtcbiAgLy8gRW5zdXJlIHByZXByb2Nlc3NvciBpbmNsdWRlIHBhdGhzIGFyZSBhYnNvbHV0ZSBiYXNlZCBvbiB0aGUgd29ya3NwYWNlIHJvb3RcbiAgY29uc3QgaW5jbHVkZVBhdGhzID0gb3B0aW9ucy5pbmNsdWRlUGF0aHM/Lm1hcCgoaW5jbHVkZVBhdGgpID0+XG4gICAgcGF0aC5yZXNvbHZlKG9wdGlvbnMud29ya3NwYWNlUm9vdCwgaW5jbHVkZVBhdGgpLFxuICApO1xuXG4gIGNvbnN0IHBsdWdpbkZhY3RvcnkgPSBuZXcgU3R5bGVzaGVldFBsdWdpbkZhY3RvcnkoXG4gICAge1xuICAgICAgc291cmNlbWFwOiAhIW9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgaW5saW5lQ29tcG9uZW50RGF0YSxcbiAgICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbjogb3B0aW9ucy50YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gICAgfSxcbiAgICBjYWNoZSxcbiAgKTtcblxuICByZXR1cm4ge1xuICAgIGFic1dvcmtpbmdEaXI6IG9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IHRydWUsXG4gICAgZW50cnlOYW1lczogb3B0aW9ucy5vdXRwdXROYW1lcz8uYnVuZGxlcyxcbiAgICBhc3NldE5hbWVzOiBvcHRpb25zLm91dHB1dE5hbWVzPy5tZWRpYSxcbiAgICBsb2dMZXZlbDogJ3NpbGVudCcsXG4gICAgbWluaWZ5OiBvcHRpb25zLm9wdGltaXphdGlvbixcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBzb3VyY2VtYXA6IG9wdGlvbnMuc291cmNlbWFwLFxuICAgIG91dGRpcjogb3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIHRhcmdldDogb3B0aW9ucy50YXJnZXQsXG4gICAgcHJlc2VydmVTeW1saW5rczogb3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIGV4dGVybmFsOiBvcHRpb25zLmV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIGNvbmRpdGlvbnM6IFsnc3R5bGUnLCAnc2FzcyddLFxuICAgIG1haW5GaWVsZHM6IFsnc3R5bGUnLCAnc2FzcyddLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIHBsdWdpbkZhY3RvcnkuY3JlYXRlKFNhc3NTdHlsZXNoZWV0TGFuZ3VhZ2UpLFxuICAgICAgcGx1Z2luRmFjdG9yeS5jcmVhdGUoTGVzc1N0eWxlc2hlZXRMYW5ndWFnZSksXG4gICAgICBwbHVnaW5GYWN0b3J5LmNyZWF0ZShDc3NTdHlsZXNoZWV0TGFuZ3VhZ2UpLFxuICAgICAgY3JlYXRlQ3NzUmVzb3VyY2VQbHVnaW4oY2FjaGUpLFxuICAgIF0sXG4gIH07XG59XG5cbi8qKlxuICogQnVuZGxlcyBhIGNvbXBvbmVudCBzdHlsZXNoZWV0LiBUaGUgc3R5bGVzaGVldCBjYW4gYmUgZWl0aGVyIGFuIGlubGluZSBzdHlsZXNoZWV0IHRoYXRcbiAqIGlzIGNvbnRhaW5lZCB3aXRoaW4gdGhlIENvbXBvbmVudCdzIG1ldGFkYXRhIGRlZmluaXRpb24gb3IgYW4gZXh0ZXJuYWwgZmlsZSByZWZlcmVuY2VkXG4gKiBmcm9tIHRoZSBDb21wb25lbnQncyBtZXRhZGF0YSBkZWZpbml0aW9uLlxuICpcbiAqIEBwYXJhbSBpZGVudGlmaWVyIEEgdW5pcXVlIHN0cmluZyBpZGVudGlmaWVyIGZvciB0aGUgY29tcG9uZW50IHN0eWxlc2hlZXQuXG4gKiBAcGFyYW0gbGFuZ3VhZ2UgVGhlIGxhbmd1YWdlIG9mIHRoZSBzdHlsZXNoZWV0IHN1Y2ggYXMgYGNzc2Agb3IgYHNjc3NgLlxuICogQHBhcmFtIGRhdGEgVGhlIHN0cmluZyBjb250ZW50IG9mIHRoZSBzdHlsZXNoZWV0LlxuICogQHBhcmFtIGZpbGVuYW1lIFRoZSBmaWxlbmFtZSByZXByZXNlbnRpbmcgdGhlIHNvdXJjZSBvZiB0aGUgc3R5bGVzaGVldCBjb250ZW50LlxuICogQHBhcmFtIGlubGluZSBJZiB0cnVlLCB0aGUgc3R5bGVzaGVldCBzb3VyY2UgaXMgd2l0aGluIHRoZSBjb21wb25lbnQgbWV0YWRhdGE7XG4gKiBpZiBmYWxzZSwgdGhlIHNvdXJjZSBpcyBhIHN0eWxlc2hlZXQgZmlsZS5cbiAqIEBwYXJhbSBvcHRpb25zIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBzdHlsZXNoZWV0IGJ1bmRsaW5nIG9wdGlvbnMuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgb3V0cHV0IG9mIHRoZSBidW5kbGluZyBvcGVyYXRpb24uXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidW5kbGVDb21wb25lbnRTdHlsZXNoZWV0KFxuICBsYW5ndWFnZTogc3RyaW5nLFxuICBkYXRhOiBzdHJpbmcsXG4gIGZpbGVuYW1lOiBzdHJpbmcsXG4gIGlubGluZTogYm9vbGVhbixcbiAgb3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsXG4gIGNhY2hlPzogTG9hZFJlc3VsdENhY2hlLFxuKSB7XG4gIGNvbnN0IG5hbWVzcGFjZSA9ICdhbmd1bGFyOnN0eWxlcy9jb21wb25lbnQnO1xuICAvLyBVc2UgYSBoYXNoIG9mIHRoZSBpbmxpbmUgc3R5bGVzaGVldCBjb250ZW50IHRvIGVuc3VyZSBhIGNvbnNpc3RlbnQgaWRlbnRpZmllci4gRXh0ZXJuYWwgc3R5bGVzaGVldHMgd2lsbCByZXNvbHZlXG4gIC8vIHRvIHRoZSBhY3R1YWwgc3R5bGVzaGVldCBmaWxlIHBhdGguXG4gIC8vIFRPRE86IENvbnNpZGVyIHh4aGFzaCBpbnN0ZWFkIGZvciBoYXNoaW5nXG4gIGNvbnN0IGlkID0gaW5saW5lID8gY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGRhdGEpLmRpZ2VzdCgnaGV4JykgOiBjb21wb25lbnRTdHlsZUNvdW50ZXIrKztcbiAgY29uc3QgZW50cnkgPSBbbGFuZ3VhZ2UsIGlkLCBmaWxlbmFtZV0uam9pbignOycpO1xuXG4gIGNvbnN0IGJ1aWxkT3B0aW9ucyA9IGNyZWF0ZVN0eWxlc2hlZXRCdW5kbGVPcHRpb25zKG9wdGlvbnMsIGNhY2hlLCB7IFtlbnRyeV06IGRhdGEgfSk7XG4gIGJ1aWxkT3B0aW9ucy5lbnRyeVBvaW50cyA9IFtgJHtuYW1lc3BhY2V9OyR7ZW50cnl9YF07XG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goe1xuICAgIG5hbWU6ICdhbmd1bGFyLWNvbXBvbmVudC1zdHlsZXMnLFxuICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IC9eYW5ndWxhcjpzdHlsZXNcXC9jb21wb25lbnQ7LyB9LCAoYXJncykgPT4ge1xuICAgICAgICBpZiAoYXJncy5raW5kICE9PSAnZW50cnktcG9pbnQnKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5saW5lKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBhdGg6IGVudHJ5LFxuICAgICAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBhdGg6IGZpbGVuYW1lLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXmNzczsvLCBuYW1lc3BhY2UgfSwgYXN5bmMgKCkgPT4ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbnRlbnRzOiBkYXRhLFxuICAgICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogcGF0aC5kaXJuYW1lKGZpbGVuYW1lKSxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH0pO1xuXG4gIC8vIEV4ZWN1dGUgZXNidWlsZFxuICBjb25zdCBjb250ZXh0ID0gbmV3IEJ1bmRsZXJDb250ZXh0KG9wdGlvbnMud29ya3NwYWNlUm9vdCwgZmFsc2UsIGJ1aWxkT3B0aW9ucyk7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNvbnRleHQuYnVuZGxlKCk7XG5cbiAgLy8gRXh0cmFjdCB0aGUgcmVzdWx0IG9mIHRoZSBidW5kbGluZyBmcm9tIHRoZSBvdXRwdXQgZmlsZXNcbiAgbGV0IGNvbnRlbnRzID0gJyc7XG4gIGxldCBtYXA7XG4gIGxldCBvdXRwdXRQYXRoO1xuICBjb25zdCByZXNvdXJjZUZpbGVzOiBPdXRwdXRGaWxlW10gPSBbXTtcbiAgaWYgKCFyZXN1bHQuZXJyb3JzKSB7XG4gICAgZm9yIChjb25zdCBvdXRwdXRGaWxlIG9mIHJlc3VsdC5vdXRwdXRGaWxlcykge1xuICAgICAgY29uc3QgZmlsZW5hbWUgPSBwYXRoLmJhc2VuYW1lKG91dHB1dEZpbGUucGF0aCk7XG4gICAgICBpZiAoZmlsZW5hbWUuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgICBvdXRwdXRQYXRoID0gb3V0cHV0RmlsZS5wYXRoO1xuICAgICAgICBjb250ZW50cyA9IG91dHB1dEZpbGUudGV4dDtcbiAgICAgIH0gZWxzZSBpZiAoZmlsZW5hbWUuZW5kc1dpdGgoJy5jc3MubWFwJykpIHtcbiAgICAgICAgbWFwID0gb3V0cHV0RmlsZS50ZXh0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhlIG91dHB1dCBmaWxlcyBjb3VsZCBhbHNvIGNvbnRhaW4gcmVzb3VyY2VzIChpbWFnZXMvZm9udHMvZXRjLikgdGhhdCB3ZXJlIHJlZmVyZW5jZWRcbiAgICAgICAgcmVzb3VyY2VGaWxlcy5wdXNoKG91dHB1dEZpbGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGxldCBtZXRhZmlsZTtcbiAgaWYgKCFyZXN1bHQuZXJyb3JzKSB7XG4gICAgbWV0YWZpbGUgPSByZXN1bHQubWV0YWZpbGU7XG4gICAgLy8gUmVtb3ZlIGVudHJ5UG9pbnQgZmllbGRzIGZyb20gb3V0cHV0cyB0byBwcmV2ZW50IHRoZSBpbnRlcm5hbCBjb21wb25lbnQgc3R5bGVzIGZyb20gYmVpbmdcbiAgICAvLyB0cmVhdGVkIGFzIGluaXRpYWwgZmlsZXMuIEFsc28gbWFyayB0aGUgZW50cnkgYXMgYSBjb21wb25lbnQgcmVzb3VyY2UgZm9yIHN0YXQgcmVwb3J0aW5nLlxuICAgIE9iamVjdC52YWx1ZXMobWV0YWZpbGUub3V0cHV0cykuZm9yRWFjaCgob3V0cHV0KSA9PiB7XG4gICAgICBkZWxldGUgb3V0cHV0LmVudHJ5UG9pbnQ7XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgKG91dHB1dCBhcyBhbnkpWyduZy1jb21wb25lbnQnXSA9IHRydWU7XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGVycm9yczogcmVzdWx0LmVycm9ycyxcbiAgICB3YXJuaW5nczogcmVzdWx0Lndhcm5pbmdzLFxuICAgIGNvbnRlbnRzLFxuICAgIG1hcCxcbiAgICBwYXRoOiBvdXRwdXRQYXRoLFxuICAgIHJlc291cmNlRmlsZXMsXG4gICAgbWV0YWZpbGUsXG4gIH07XG59XG4iXX0=