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
exports.createServerCodeBundleOptions = exports.createBrowserCodeBundleOptions = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const environment_options_1 = require("../../utils/environment-options");
const compiler_plugin_1 = require("./angular/compiler-plugin");
const compiler_plugin_options_1 = require("./compiler-plugin-options");
const i18n_locale_plugin_1 = require("./i18n-locale-plugin");
const rxjs_esm_resolution_plugin_1 = require("./rxjs-esm-resolution-plugin");
const sourcemap_ignorelist_plugin_1 = require("./sourcemap-ignorelist-plugin");
const utils_1 = require("./utils");
const virtual_module_plugin_1 = require("./virtual-module-plugin");
function createBrowserCodeBundleOptions(options, target, sourceFileCache) {
    const { workspaceRoot, entryPoints, outputNames, jit } = options;
    const { pluginOptions, styleOptions } = (0, compiler_plugin_options_1.createCompilerPluginOptions)(options, target, sourceFileCache);
    const buildOptions = {
        ...getEsBuildCommonOptions(options),
        platform: 'browser',
        // Note: `es2015` is needed for RxJS v6. If not specified, `module` would
        // match and the ES5 distribution would be bundled and ends up breaking at
        // runtime with the RxJS testing library.
        // More details: https://github.com/angular/angular-cli/issues/25405.
        mainFields: ['es2020', 'es2015', 'browser', 'module', 'main'],
        entryNames: outputNames.bundles,
        entryPoints,
        target,
        supported: (0, utils_1.getFeatureSupport)(target),
        plugins: [
            (0, sourcemap_ignorelist_plugin_1.createSourcemapIgnorelistPlugin)(),
            (0, compiler_plugin_1.createCompilerPlugin)(
            // JS/TS options
            pluginOptions, 
            // Component stylesheet options
            styleOptions),
        ],
    };
    if (options.externalPackages) {
        buildOptions.packages = 'external';
    }
    const polyfills = options.polyfills ? [...options.polyfills] : [];
    // Angular JIT mode requires the runtime compiler
    if (jit) {
        polyfills.push('@angular/compiler');
    }
    // Add Angular's global locale data if i18n options are present.
    // Locale data should go first so that project provided polyfill code can augment if needed.
    let needLocaleDataPlugin = false;
    if (options.i18nOptions.shouldInline) {
        // When inlining, a placeholder is used to allow the post-processing step to inject the $localize locale identifier
        polyfills.unshift('angular:locale/placeholder');
        buildOptions.plugins?.unshift((0, virtual_module_plugin_1.createVirtualModulePlugin)({
            namespace: 'angular:locale/placeholder',
            entryPointOnly: false,
            loadContent: () => ({
                contents: `(globalThis.$localize ??= {}).locale = "___NG_LOCALE_INSERT___";\n`,
                loader: 'js',
                resolveDir: workspaceRoot,
            }),
        }));
        // Add locale data for all active locales
        // TODO: Inject each individually within the inlining process itself
        for (const locale of options.i18nOptions.inlineLocales) {
            polyfills.unshift(`angular:locale/data:${locale}`);
        }
        needLocaleDataPlugin = true;
    }
    else if (options.i18nOptions.hasDefinedSourceLocale) {
        // When not inlining and a source local is present, use the source locale data directly
        polyfills.unshift(`angular:locale/data:${options.i18nOptions.sourceLocale}`);
        needLocaleDataPlugin = true;
    }
    if (needLocaleDataPlugin) {
        buildOptions.plugins?.push((0, i18n_locale_plugin_1.createAngularLocaleDataPlugin)());
    }
    // Add polyfill entry point if polyfills are present
    if (polyfills.length) {
        const namespace = 'angular:polyfills';
        buildOptions.entryPoints = {
            ...buildOptions.entryPoints,
            'polyfills': namespace,
        };
        buildOptions.plugins?.unshift((0, virtual_module_plugin_1.createVirtualModulePlugin)({
            namespace,
            loadContent: async (_, build) => {
                const polyfillPaths = await Promise.all(polyfills.map(async (path) => {
                    if (path.startsWith('zone.js') || !(0, node_path_1.extname)(path)) {
                        return path;
                    }
                    const potentialPathRelative = './' + path;
                    const result = await build.resolve(potentialPathRelative, {
                        kind: 'import-statement',
                        resolveDir: workspaceRoot,
                    });
                    return result.path ? potentialPathRelative : path;
                }));
                return {
                    contents: polyfillPaths
                        .map((file) => `import '${file.replace(/\\/g, '/')}';`)
                        .join('\n'),
                    loader: 'js',
                    resolveDir: workspaceRoot,
                };
            },
        }));
    }
    return buildOptions;
}
exports.createBrowserCodeBundleOptions = createBrowserCodeBundleOptions;
/**
 * Create an esbuild 'build' options object for the server bundle.
 * @param options The builder's user-provider normalized options.
 * @returns An esbuild BuildOptions object.
 */
function createServerCodeBundleOptions(options, target, sourceFileCache) {
    const { jit, serverEntryPoint, workspaceRoot, ssrOptions, watch, externalPackages, prerenderOptions, } = options;
    (0, node_assert_1.default)(serverEntryPoint, 'createServerCodeBundleOptions should not be called without a defined serverEntryPoint.');
    const { pluginOptions, styleOptions } = (0, compiler_plugin_options_1.createCompilerPluginOptions)(options, target, sourceFileCache);
    const mainServerNamespace = 'angular:main-server';
    const ssrEntryNamespace = 'angular:ssr-entry';
    const entryPoints = {
        'main.server': mainServerNamespace,
    };
    const ssrEntryPoint = ssrOptions?.entry;
    if (ssrEntryPoint) {
        entryPoints['server'] = ssrEntryNamespace;
    }
    const buildOptions = {
        ...getEsBuildCommonOptions(options),
        platform: 'node',
        // TODO: Invesigate why enabling `splitting` in JIT mode causes an "'@angular/compiler' is not available" error.
        splitting: !jit,
        outExtension: { '.js': '.mjs' },
        // Note: `es2015` is needed for RxJS v6. If not specified, `module` would
        // match and the ES5 distribution would be bundled and ends up breaking at
        // runtime with the RxJS testing library.
        // More details: https://github.com/angular/angular-cli/issues/25405.
        mainFields: ['es2020', 'es2015', 'module', 'main'],
        entryNames: '[name]',
        target,
        banner: {
            // Note: Needed as esbuild does not provide require shims / proxy from ESModules.
            // See: https://github.com/evanw/esbuild/issues/1921.
            js: [
                `import { createRequire } from 'node:module';`,
                `globalThis['require'] ??= createRequire(import.meta.url);`,
            ].join('\n'),
        },
        entryPoints,
        supported: (0, utils_1.getFeatureSupport)(target),
        plugins: [
            (0, sourcemap_ignorelist_plugin_1.createSourcemapIgnorelistPlugin)(),
            (0, compiler_plugin_1.createCompilerPlugin)(
            // JS/TS options
            { ...pluginOptions, noopTypeScriptCompilation: true }, 
            // Component stylesheet options
            styleOptions),
        ],
    };
    buildOptions.plugins ??= [];
    if (externalPackages) {
        buildOptions.packages = 'external';
    }
    else {
        buildOptions.plugins.push((0, rxjs_esm_resolution_plugin_1.createRxjsEsmResolutionPlugin)());
    }
    const polyfills = [];
    if (options.polyfills?.includes('zone.js')) {
        polyfills.push(`import 'zone.js/node';`);
    }
    if (jit) {
        polyfills.push(`import '@angular/compiler';`);
    }
    polyfills.push(`import '@angular/platform-server/init';`);
    buildOptions.plugins.push((0, virtual_module_plugin_1.createVirtualModulePlugin)({
        namespace: mainServerNamespace,
        loadContent: async () => {
            const mainServerEntryPoint = (0, node_path_1.relative)(workspaceRoot, serverEntryPoint).replace(/\\/g, '/');
            const contents = [
                ...polyfills,
                `import moduleOrBootstrapFn from './${mainServerEntryPoint}';`,
                `export default moduleOrBootstrapFn;`,
                `export * from './${mainServerEntryPoint}';`,
                `export { renderApplication, renderModule, ɵSERVER_CONTEXT } from '@angular/platform-server';`,
            ];
            if (watch) {
                contents.push(`export { ɵresetCompiledComponents } from '@angular/core';`);
            }
            if (prerenderOptions?.discoverRoutes) {
                // We do not import it directly so that node.js modules are resolved using the correct context.
                const routesExtractorCode = await (0, promises_1.readFile)((0, node_path_1.join)(__dirname, '../../utils/routes-extractor/extractor.js'), 'utf-8');
                // Remove source map URL comments from the code if a sourcemap is present as this will not match the file.
                contents.push(routesExtractorCode.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, ''));
            }
            return {
                contents: contents.join('\n'),
                loader: 'js',
                resolveDir: workspaceRoot,
            };
        },
    }));
    if (ssrEntryPoint) {
        buildOptions.plugins.push((0, virtual_module_plugin_1.createVirtualModulePlugin)({
            namespace: ssrEntryNamespace,
            loadContent: () => {
                const serverEntryPoint = (0, node_path_1.relative)(workspaceRoot, ssrEntryPoint).replace(/\\/g, '/');
                return {
                    contents: [
                        ...polyfills,
                        `import './${serverEntryPoint}';`,
                        `export * from './${serverEntryPoint}';`,
                    ].join('\n'),
                    loader: 'js',
                    resolveDir: workspaceRoot,
                };
            },
        }));
    }
    return buildOptions;
}
exports.createServerCodeBundleOptions = createServerCodeBundleOptions;
function getEsBuildCommonOptions(options) {
    const { workspaceRoot, outExtension, optimizationOptions, sourcemapOptions, tsconfig, externalDependencies, outputNames, preserveSymlinks, jit, } = options;
    // Ensure unique hashes for i18n translation changes when using post-process inlining.
    // This hash value is added as a footer to each file and ensures that the output file names (with hashes)
    // change when translation files have changed. If this is not done the post processed files may have
    // different content but would retain identical production file names which would lead to browser caching problems.
    let footer;
    if (options.i18nOptions.shouldInline) {
        // Update file hashes to include translation file content
        const i18nHash = Object.values(options.i18nOptions.locales).reduce((data, locale) => data + locale.files.map((file) => file.integrity || '').join('|'), '');
        footer = { js: `/**i18n:${(0, node_crypto_1.createHash)('sha256').update(i18nHash).digest('hex')}*/` };
    }
    return {
        absWorkingDir: workspaceRoot,
        bundle: true,
        format: 'esm',
        assetNames: outputNames.media,
        conditions: ['es2020', 'es2015', 'module'],
        resolveExtensions: ['.ts', '.tsx', '.mjs', '.js'],
        metafile: true,
        legalComments: options.extractLicenses ? 'none' : 'eof',
        logLevel: options.verbose ? 'debug' : 'silent',
        minifyIdentifiers: optimizationOptions.scripts && environment_options_1.allowMangle,
        minifySyntax: optimizationOptions.scripts,
        minifyWhitespace: optimizationOptions.scripts,
        pure: ['forwardRef'],
        outdir: workspaceRoot,
        outExtension: outExtension ? { '.js': `.${outExtension}` } : undefined,
        sourcemap: sourcemapOptions.scripts && (sourcemapOptions.hidden ? 'external' : true),
        splitting: true,
        chunkNames: options.namedChunks ? '[name]-[hash]' : 'chunk-[hash]',
        tsconfig,
        external: externalDependencies,
        write: false,
        preserveSymlinks,
        define: {
            // Only set to false when script optimizations are enabled. It should not be set to true because
            // Angular turns `ngDevMode` into an object for development debugging purposes when not defined
            // which a constant true value would break.
            ...(optimizationOptions.scripts ? { 'ngDevMode': 'false' } : undefined),
            'ngJitMode': jit ? 'true' : 'false',
        },
        footer,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24tY29kZS1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FwcGxpY2F0aW9uLWNvZGUtYnVuZGxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw2Q0FBeUM7QUFDekMsK0NBQTRDO0FBQzVDLHlDQUFvRDtBQUVwRCx5RUFBOEQ7QUFDOUQsK0RBQWlFO0FBRWpFLHVFQUF3RTtBQUN4RSw2REFBcUU7QUFDckUsNkVBQTZFO0FBQzdFLCtFQUFnRjtBQUNoRixtQ0FBNEM7QUFDNUMsbUVBQW9FO0FBRXBFLFNBQWdCLDhCQUE4QixDQUM1QyxPQUEwQyxFQUMxQyxNQUFnQixFQUNoQixlQUFpQztJQUVqQyxNQUFNLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLEdBQUcsT0FBTyxDQUFDO0lBRWpFLE1BQU0sRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLEdBQUcsSUFBQSxxREFBMkIsRUFDakUsT0FBTyxFQUNQLE1BQU0sRUFDTixlQUFlLENBQ2hCLENBQUM7SUFFRixNQUFNLFlBQVksR0FBaUI7UUFDakMsR0FBRyx1QkFBdUIsQ0FBQyxPQUFPLENBQUM7UUFDbkMsUUFBUSxFQUFFLFNBQVM7UUFDbkIseUVBQXlFO1FBQ3pFLDBFQUEwRTtRQUMxRSx5Q0FBeUM7UUFDekMscUVBQXFFO1FBQ3JFLFVBQVUsRUFBRSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUM7UUFDN0QsVUFBVSxFQUFFLFdBQVcsQ0FBQyxPQUFPO1FBQy9CLFdBQVc7UUFDWCxNQUFNO1FBQ04sU0FBUyxFQUFFLElBQUEseUJBQWlCLEVBQUMsTUFBTSxDQUFD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RSxDQUFDLFlBQVksQ0FBQztRQUNwQixNQUFNLEVBQUUsYUFBYTtRQUNyQixZQUFZLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVM7UUFDdEUsU0FBUyxFQUFFLGdCQUFnQixDQUFDLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDcEYsU0FBUyxFQUFFLElBQUk7UUFDZixVQUFVLEVBQUUsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxjQUFjO1FBQ2xFLFFBQVE7UUFDUixRQUFRLEVBQUUsb0JBQW9CO1FBQzlCLEtBQUssRUFBRSxLQUFLO1FBQ1osZ0JBQWdCO1FBQ2hCLE1BQU0sRUFBRTtZQUNOLGdHQUFnRztZQUNoRywrRkFBK0Y7WUFDL0YsMkNBQTJDO1lBQzNDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDdkUsV0FBVyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPO1NBQ3BDO1FBQ0QsTUFBTTtLQUNQLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdub2RlOmNyeXB0byc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHR5cGUgeyBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMgfSBmcm9tICcuLi8uLi9idWlsZGVycy9hcHBsaWNhdGlvbi9vcHRpb25zJztcbmltcG9ydCB7IGFsbG93TWFuZ2xlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBjcmVhdGVDb21waWxlclBsdWdpbiB9IGZyb20gJy4vYW5ndWxhci9jb21waWxlci1wbHVnaW4nO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlIH0gZnJvbSAnLi9hbmd1bGFyL3NvdXJjZS1maWxlLWNhY2hlJztcbmltcG9ydCB7IGNyZWF0ZUNvbXBpbGVyUGx1Z2luT3B0aW9ucyB9IGZyb20gJy4vY29tcGlsZXItcGx1Z2luLW9wdGlvbnMnO1xuaW1wb3J0IHsgY3JlYXRlQW5ndWxhckxvY2FsZURhdGFQbHVnaW4gfSBmcm9tICcuL2kxOG4tbG9jYWxlLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVSeGpzRXNtUmVzb2x1dGlvblBsdWdpbiB9IGZyb20gJy4vcnhqcy1lc20tcmVzb2x1dGlvbi1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlU291cmNlbWFwSWdub3JlbGlzdFBsdWdpbiB9IGZyb20gJy4vc291cmNlbWFwLWlnbm9yZWxpc3QtcGx1Z2luJztcbmltcG9ydCB7IGdldEZlYXR1cmVTdXBwb3J0IH0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQgeyBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luIH0gZnJvbSAnLi92aXJ0dWFsLW1vZHVsZS1wbHVnaW4nO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQnJvd3NlckNvZGVCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZSxcbik6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHsgd29ya3NwYWNlUm9vdCwgZW50cnlQb2ludHMsIG91dHB1dE5hbWVzLCBqaXQgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgeyBwbHVnaW5PcHRpb25zLCBzdHlsZU9wdGlvbnMgfSA9IGNyZWF0ZUNvbXBpbGVyUGx1Z2luT3B0aW9ucyhcbiAgICBvcHRpb25zLFxuICAgIHRhcmdldCxcbiAgICBzb3VyY2VGaWxlQ2FjaGUsXG4gICk7XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zOiBCdWlsZE9wdGlvbnMgPSB7XG4gICAgLi4uZ2V0RXNCdWlsZENvbW1vbk9wdGlvbnMob3B0aW9ucyksXG4gICAgcGxhdGZvcm06ICdicm93c2VyJyxcbiAgICAvLyBOb3RlOiBgZXMyMDE1YCBpcyBuZWVkZWQgZm9yIFJ4SlMgdjYuIElmIG5vdCBzcGVjaWZpZWQsIGBtb2R1bGVgIHdvdWxkXG4gICAgLy8gbWF0Y2ggYW5kIHRoZSBFUzUgZGlzdHJpYnV0aW9uIHdvdWxkIGJlIGJ1bmRsZWQgYW5kIGVuZHMgdXAgYnJlYWtpbmcgYXRcbiAgICAvLyBydW50aW1lIHdpdGggdGhlIFJ4SlMgdGVzdGluZyBsaWJyYXJ5LlxuICAgIC8vIE1vcmUgZGV0YWlsczogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzI1NDA1LlxuICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgZW50cnlOYW1lczogb3V0cHV0TmFtZXMuYnVuZGxlcyxcbiAgICBlbnRyeVBvaW50cyxcbiAgICB0YXJnZXQsXG4gICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNvdXJjZW1hcElnbm9yZWxpc3RQbHVnaW4oKSxcbiAgICAgIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICAgICAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgICAgIHBsdWdpbk9wdGlvbnMsXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgKSxcbiAgICBdLFxuICB9O1xuXG4gIGlmIChvcHRpb25zLmV4dGVybmFsUGFja2FnZXMpIHtcbiAgICBidWlsZE9wdGlvbnMucGFja2FnZXMgPSAnZXh0ZXJuYWwnO1xuICB9XG5cbiAgY29uc3QgcG9seWZpbGxzID0gb3B0aW9ucy5wb2x5ZmlsbHMgPyBbLi4ub3B0aW9ucy5wb2x5ZmlsbHNdIDogW107XG5cbiAgLy8gQW5ndWxhciBKSVQgbW9kZSByZXF1aXJlcyB0aGUgcnVudGltZSBjb21waWxlclxuICBpZiAoaml0KSB7XG4gICAgcG9seWZpbGxzLnB1c2goJ0Bhbmd1bGFyL2NvbXBpbGVyJyk7XG4gIH1cblxuICAvLyBBZGQgQW5ndWxhcidzIGdsb2JhbCBsb2NhbGUgZGF0YSBpZiBpMThuIG9wdGlvbnMgYXJlIHByZXNlbnQuXG4gIC8vIExvY2FsZSBkYXRhIHNob3VsZCBnbyBmaXJzdCBzbyB0aGF0IHByb2plY3QgcHJvdmlkZWQgcG9seWZpbGwgY29kZSBjYW4gYXVnbWVudCBpZiBuZWVkZWQuXG4gIGxldCBuZWVkTG9jYWxlRGF0YVBsdWdpbiA9IGZhbHNlO1xuICBpZiAob3B0aW9ucy5pMThuT3B0aW9ucy5zaG91bGRJbmxpbmUpIHtcbiAgICAvLyBXaGVuIGlubGluaW5nLCBhIHBsYWNlaG9sZGVyIGlzIHVzZWQgdG8gYWxsb3cgdGhlIHBvc3QtcHJvY2Vzc2luZyBzdGVwIHRvIGluamVjdCB0aGUgJGxvY2FsaXplIGxvY2FsZSBpZGVudGlmaWVyXG4gICAgcG9seWZpbGxzLnVuc2hpZnQoJ2FuZ3VsYXI6bG9jYWxlL3BsYWNlaG9sZGVyJyk7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnM/LnVuc2hpZnQoXG4gICAgICBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnYW5ndWxhcjpsb2NhbGUvcGxhY2Vob2xkZXInLFxuICAgICAgICBlbnRyeVBvaW50T25seTogZmFsc2UsXG4gICAgICAgIGxvYWRDb250ZW50OiAoKSA9PiAoe1xuICAgICAgICAgIGNvbnRlbnRzOiBgKGdsb2JhbFRoaXMuJGxvY2FsaXplID8/PSB7fSkubG9jYWxlID0gXCJfX19OR19MT0NBTEVfSU5TRVJUX19fXCI7XFxuYCxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgfSksXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgLy8gQWRkIGxvY2FsZSBkYXRhIGZvciBhbGwgYWN0aXZlIGxvY2FsZXNcbiAgICAvLyBUT0RPOiBJbmplY3QgZWFjaCBpbmRpdmlkdWFsbHkgd2l0aGluIHRoZSBpbmxpbmluZyBwcm9jZXNzIGl0c2VsZlxuICAgIGZvciAoY29uc3QgbG9jYWxlIG9mIG9wdGlvbnMuaTE4bk9wdGlvbnMuaW5saW5lTG9jYWxlcykge1xuICAgICAgcG9seWZpbGxzLnVuc2hpZnQoYGFuZ3VsYXI6bG9jYWxlL2RhdGE6JHtsb2NhbGV9YCk7XG4gICAgfVxuICAgIG5lZWRMb2NhbGVEYXRhUGx1Z2luID0gdHJ1ZTtcbiAgfSBlbHNlIGlmIChvcHRpb25zLmkxOG5PcHRpb25zLmhhc0RlZmluZWRTb3VyY2VMb2NhbGUpIHtcbiAgICAvLyBXaGVuIG5vdCBpbmxpbmluZyBhbmQgYSBzb3VyY2UgbG9jYWwgaXMgcHJlc2VudCwgdXNlIHRoZSBzb3VyY2UgbG9jYWxlIGRhdGEgZGlyZWN0bHlcbiAgICBwb2x5ZmlsbHMudW5zaGlmdChgYW5ndWxhcjpsb2NhbGUvZGF0YToke29wdGlvbnMuaTE4bk9wdGlvbnMuc291cmNlTG9jYWxlfWApO1xuICAgIG5lZWRMb2NhbGVEYXRhUGx1Z2luID0gdHJ1ZTtcbiAgfVxuICBpZiAobmVlZExvY2FsZURhdGFQbHVnaW4pIHtcbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucz8ucHVzaChjcmVhdGVBbmd1bGFyTG9jYWxlRGF0YVBsdWdpbigpKTtcbiAgfVxuXG4gIC8vIEFkZCBwb2x5ZmlsbCBlbnRyeSBwb2ludCBpZiBwb2x5ZmlsbHMgYXJlIHByZXNlbnRcbiAgaWYgKHBvbHlmaWxscy5sZW5ndGgpIHtcbiAgICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpwb2x5ZmlsbHMnO1xuICAgIGJ1aWxkT3B0aW9ucy5lbnRyeVBvaW50cyA9IHtcbiAgICAgIC4uLmJ1aWxkT3B0aW9ucy5lbnRyeVBvaW50cyxcbiAgICAgICdwb2x5ZmlsbHMnOiBuYW1lc3BhY2UsXG4gICAgfTtcblxuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zPy51bnNoaWZ0KFxuICAgICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgbG9hZENvbnRlbnQ6IGFzeW5jIChfLCBidWlsZCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHBvbHlmaWxsUGF0aHMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICAgIHBvbHlmaWxscy5tYXAoYXN5bmMgKHBhdGgpID0+IHtcbiAgICAgICAgICAgICAgaWYgKHBhdGguc3RhcnRzV2l0aCgnem9uZS5qcycpIHx8ICFleHRuYW1lKHBhdGgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBwb3RlbnRpYWxQYXRoUmVsYXRpdmUgPSAnLi8nICsgcGF0aDtcbiAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZShwb3RlbnRpYWxQYXRoUmVsYXRpdmUsIHtcbiAgICAgICAgICAgICAgICBraW5kOiAnaW1wb3J0LXN0YXRlbWVudCcsXG4gICAgICAgICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC5wYXRoID8gcG90ZW50aWFsUGF0aFJlbGF0aXZlIDogcGF0aDtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29udGVudHM6IHBvbHlmaWxsUGF0aHNcbiAgICAgICAgICAgICAgLm1hcCgoZmlsZSkgPT4gYGltcG9ydCAnJHtmaWxlLnJlcGxhY2UoL1xcXFwvZywgJy8nKX0nO2ApXG4gICAgICAgICAgICAgIC5qb2luKCdcXG4nKSxcbiAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gYnVpbGRPcHRpb25zO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhbiBlc2J1aWxkICdidWlsZCcgb3B0aW9ucyBvYmplY3QgZm9yIHRoZSBzZXJ2ZXIgYnVuZGxlLlxuICogQHBhcmFtIG9wdGlvbnMgVGhlIGJ1aWxkZXIncyB1c2VyLXByb3ZpZGVyIG5vcm1hbGl6ZWQgb3B0aW9ucy5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgQnVpbGRPcHRpb25zIG9iamVjdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNlcnZlckNvZGVCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIHNvdXJjZUZpbGVDYWNoZTogU291cmNlRmlsZUNhY2hlLFxuKTogQnVpbGRPcHRpb25zIHtcbiAgY29uc3Qge1xuICAgIGppdCxcbiAgICBzZXJ2ZXJFbnRyeVBvaW50LFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgc3NyT3B0aW9ucyxcbiAgICB3YXRjaCxcbiAgICBleHRlcm5hbFBhY2thZ2VzLFxuICAgIHByZXJlbmRlck9wdGlvbnMsXG4gIH0gPSBvcHRpb25zO1xuXG4gIGFzc2VydChcbiAgICBzZXJ2ZXJFbnRyeVBvaW50LFxuICAgICdjcmVhdGVTZXJ2ZXJDb2RlQnVuZGxlT3B0aW9ucyBzaG91bGQgbm90IGJlIGNhbGxlZCB3aXRob3V0IGEgZGVmaW5lZCBzZXJ2ZXJFbnRyeVBvaW50LicsXG4gICk7XG5cbiAgY29uc3QgeyBwbHVnaW5PcHRpb25zLCBzdHlsZU9wdGlvbnMgfSA9IGNyZWF0ZUNvbXBpbGVyUGx1Z2luT3B0aW9ucyhcbiAgICBvcHRpb25zLFxuICAgIHRhcmdldCxcbiAgICBzb3VyY2VGaWxlQ2FjaGUsXG4gICk7XG5cbiAgY29uc3QgbWFpblNlcnZlck5hbWVzcGFjZSA9ICdhbmd1bGFyOm1haW4tc2VydmVyJztcbiAgY29uc3Qgc3NyRW50cnlOYW1lc3BhY2UgPSAnYW5ndWxhcjpzc3ItZW50cnknO1xuXG4gIGNvbnN0IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICdtYWluLnNlcnZlcic6IG1haW5TZXJ2ZXJOYW1lc3BhY2UsXG4gIH07XG5cbiAgY29uc3Qgc3NyRW50cnlQb2ludCA9IHNzck9wdGlvbnM/LmVudHJ5O1xuICBpZiAoc3NyRW50cnlQb2ludCkge1xuICAgIGVudHJ5UG9pbnRzWydzZXJ2ZXInXSA9IHNzckVudHJ5TmFtZXNwYWNlO1xuICB9XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zOiBCdWlsZE9wdGlvbnMgPSB7XG4gICAgLi4uZ2V0RXNCdWlsZENvbW1vbk9wdGlvbnMob3B0aW9ucyksXG4gICAgcGxhdGZvcm06ICdub2RlJyxcbiAgICAvLyBUT0RPOiBJbnZlc2lnYXRlIHdoeSBlbmFibGluZyBgc3BsaXR0aW5nYCBpbiBKSVQgbW9kZSBjYXVzZXMgYW4gXCInQGFuZ3VsYXIvY29tcGlsZXInIGlzIG5vdCBhdmFpbGFibGVcIiBlcnJvci5cbiAgICBzcGxpdHRpbmc6ICFqaXQsXG4gICAgb3V0RXh0ZW5zaW9uOiB7ICcuanMnOiAnLm1qcycgfSxcbiAgICAvLyBOb3RlOiBgZXMyMDE1YCBpcyBuZWVkZWQgZm9yIFJ4SlMgdjYuIElmIG5vdCBzcGVjaWZpZWQsIGBtb2R1bGVgIHdvdWxkXG4gICAgLy8gbWF0Y2ggYW5kIHRoZSBFUzUgZGlzdHJpYnV0aW9uIHdvdWxkIGJlIGJ1bmRsZWQgYW5kIGVuZHMgdXAgYnJlYWtpbmcgYXRcbiAgICAvLyBydW50aW1lIHdpdGggdGhlIFJ4SlMgdGVzdGluZyBsaWJyYXJ5LlxuICAgIC8vIE1vcmUgZGV0YWlsczogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzI1NDA1LlxuICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgIGVudHJ5TmFtZXM6ICdbbmFtZV0nLFxuICAgIHRhcmdldCxcbiAgICBiYW5uZXI6IHtcbiAgICAgIC8vIE5vdGU6IE5lZWRlZCBhcyBlc2J1aWxkIGRvZXMgbm90IHByb3ZpZGUgcmVxdWlyZSBzaGltcyAvIHByb3h5IGZyb20gRVNNb2R1bGVzLlxuICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZXZhbncvZXNidWlsZC9pc3N1ZXMvMTkyMS5cbiAgICAgIGpzOiBbXG4gICAgICAgIGBpbXBvcnQgeyBjcmVhdGVSZXF1aXJlIH0gZnJvbSAnbm9kZTptb2R1bGUnO2AsXG4gICAgICAgIGBnbG9iYWxUaGlzWydyZXF1aXJlJ10gPz89IGNyZWF0ZVJlcXVpcmUoaW1wb3J0Lm1ldGEudXJsKTtgLFxuICAgICAgXS5qb2luKCdcXG4nKSxcbiAgICB9LFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIHN1cHBvcnRlZDogZ2V0RmVhdHVyZVN1cHBvcnQodGFyZ2V0KSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVTb3VyY2VtYXBJZ25vcmVsaXN0UGx1Z2luKCksXG4gICAgICBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgICAgICAgLy8gSlMvVFMgb3B0aW9uc1xuICAgICAgICB7IC4uLnBsdWdpbk9wdGlvbnMsIG5vb3BUeXBlU2NyaXB0Q29tcGlsYXRpb246IHRydWUgfSxcbiAgICAgICAgLy8gQ29tcG9uZW50IHN0eWxlc2hlZXQgb3B0aW9uc1xuICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICApLFxuICAgIF0sXG4gIH07XG5cbiAgYnVpbGRPcHRpb25zLnBsdWdpbnMgPz89IFtdO1xuICBpZiAoZXh0ZXJuYWxQYWNrYWdlcykge1xuICAgIGJ1aWxkT3B0aW9ucy5wYWNrYWdlcyA9ICdleHRlcm5hbCc7XG4gIH0gZWxzZSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnMucHVzaChjcmVhdGVSeGpzRXNtUmVzb2x1dGlvblBsdWdpbigpKTtcbiAgfVxuXG4gIGNvbnN0IHBvbHlmaWxsczogc3RyaW5nW10gPSBbXTtcbiAgaWYgKG9wdGlvbnMucG9seWZpbGxzPy5pbmNsdWRlcygnem9uZS5qcycpKSB7XG4gICAgcG9seWZpbGxzLnB1c2goYGltcG9ydCAnem9uZS5qcy9ub2RlJztgKTtcbiAgfVxuXG4gIGlmIChqaXQpIHtcbiAgICBwb2x5ZmlsbHMucHVzaChgaW1wb3J0ICdAYW5ndWxhci9jb21waWxlcic7YCk7XG4gIH1cblxuICBwb2x5ZmlsbHMucHVzaChgaW1wb3J0ICdAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXIvaW5pdCc7YCk7XG5cbiAgYnVpbGRPcHRpb25zLnBsdWdpbnMucHVzaChcbiAgICBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luKHtcbiAgICAgIG5hbWVzcGFjZTogbWFpblNlcnZlck5hbWVzcGFjZSxcbiAgICAgIGxvYWRDb250ZW50OiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG1haW5TZXJ2ZXJFbnRyeVBvaW50ID0gcmVsYXRpdmUod29ya3NwYWNlUm9vdCwgc2VydmVyRW50cnlQb2ludCkucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuXG4gICAgICAgIGNvbnN0IGNvbnRlbnRzID0gW1xuICAgICAgICAgIC4uLnBvbHlmaWxscyxcbiAgICAgICAgICBgaW1wb3J0IG1vZHVsZU9yQm9vdHN0cmFwRm4gZnJvbSAnLi8ke21haW5TZXJ2ZXJFbnRyeVBvaW50fSc7YCxcbiAgICAgICAgICBgZXhwb3J0IGRlZmF1bHQgbW9kdWxlT3JCb290c3RyYXBGbjtgLFxuICAgICAgICAgIGBleHBvcnQgKiBmcm9tICcuLyR7bWFpblNlcnZlckVudHJ5UG9pbnR9JztgLFxuICAgICAgICAgIGBleHBvcnQgeyByZW5kZXJBcHBsaWNhdGlvbiwgcmVuZGVyTW9kdWxlLCDJtVNFUlZFUl9DT05URVhUIH0gZnJvbSAnQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyJztgLFxuICAgICAgICBdO1xuXG4gICAgICAgIGlmICh3YXRjaCkge1xuICAgICAgICAgIGNvbnRlbnRzLnB1c2goYGV4cG9ydCB7IMm1cmVzZXRDb21waWxlZENvbXBvbmVudHMgfSBmcm9tICdAYW5ndWxhci9jb3JlJztgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwcmVyZW5kZXJPcHRpb25zPy5kaXNjb3ZlclJvdXRlcykge1xuICAgICAgICAgIC8vIFdlIGRvIG5vdCBpbXBvcnQgaXQgZGlyZWN0bHkgc28gdGhhdCBub2RlLmpzIG1vZHVsZXMgYXJlIHJlc29sdmVkIHVzaW5nIHRoZSBjb3JyZWN0IGNvbnRleHQuXG4gICAgICAgICAgY29uc3Qgcm91dGVzRXh0cmFjdG9yQ29kZSA9IGF3YWl0IHJlYWRGaWxlKFxuICAgICAgICAgICAgam9pbihfX2Rpcm5hbWUsICcuLi8uLi91dGlscy9yb3V0ZXMtZXh0cmFjdG9yL2V4dHJhY3Rvci5qcycpLFxuICAgICAgICAgICAgJ3V0Zi04JyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgLy8gUmVtb3ZlIHNvdXJjZSBtYXAgVVJMIGNvbW1lbnRzIGZyb20gdGhlIGNvZGUgaWYgYSBzb3VyY2VtYXAgaXMgcHJlc2VudCBhcyB0aGlzIHdpbGwgbm90IG1hdGNoIHRoZSBmaWxlLlxuICAgICAgICAgIGNvbnRlbnRzLnB1c2gocm91dGVzRXh0cmFjdG9yQ29kZS5yZXBsYWNlKC9eXFwvXFwvIyBzb3VyY2VNYXBwaW5nVVJMPVteXFxyXFxuXSovZ20sICcnKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbnRlbnRzOiBjb250ZW50cy5qb2luKCdcXG4nKSxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgfSksXG4gICk7XG5cbiAgaWYgKHNzckVudHJ5UG9pbnQpIHtcbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKFxuICAgICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICAgIG5hbWVzcGFjZTogc3NyRW50cnlOYW1lc3BhY2UsXG4gICAgICAgIGxvYWRDb250ZW50OiAoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgc2VydmVyRW50cnlQb2ludCA9IHJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIHNzckVudHJ5UG9pbnQpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb250ZW50czogW1xuICAgICAgICAgICAgICAuLi5wb2x5ZmlsbHMsXG4gICAgICAgICAgICAgIGBpbXBvcnQgJy4vJHtzZXJ2ZXJFbnRyeVBvaW50fSc7YCxcbiAgICAgICAgICAgICAgYGV4cG9ydCAqIGZyb20gJy4vJHtzZXJ2ZXJFbnRyeVBvaW50fSc7YCxcbiAgICAgICAgICAgIF0uam9pbignXFxuJyksXG4gICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cblxuZnVuY3Rpb24gZ2V0RXNCdWlsZENvbW1vbk9wdGlvbnMob3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zKTogQnVpbGRPcHRpb25zIHtcbiAgY29uc3Qge1xuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgb3V0RXh0ZW5zaW9uLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB0c2NvbmZpZyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIGppdCxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgLy8gRW5zdXJlIHVuaXF1ZSBoYXNoZXMgZm9yIGkxOG4gdHJhbnNsYXRpb24gY2hhbmdlcyB3aGVuIHVzaW5nIHBvc3QtcHJvY2VzcyBpbmxpbmluZy5cbiAgLy8gVGhpcyBoYXNoIHZhbHVlIGlzIGFkZGVkIGFzIGEgZm9vdGVyIHRvIGVhY2ggZmlsZSBhbmQgZW5zdXJlcyB0aGF0IHRoZSBvdXRwdXQgZmlsZSBuYW1lcyAod2l0aCBoYXNoZXMpXG4gIC8vIGNoYW5nZSB3aGVuIHRyYW5zbGF0aW9uIGZpbGVzIGhhdmUgY2hhbmdlZC4gSWYgdGhpcyBpcyBub3QgZG9uZSB0aGUgcG9zdCBwcm9jZXNzZWQgZmlsZXMgbWF5IGhhdmVcbiAgLy8gZGlmZmVyZW50IGNvbnRlbnQgYnV0IHdvdWxkIHJldGFpbiBpZGVudGljYWwgcHJvZHVjdGlvbiBmaWxlIG5hbWVzIHdoaWNoIHdvdWxkIGxlYWQgdG8gYnJvd3NlciBjYWNoaW5nIHByb2JsZW1zLlxuICBsZXQgZm9vdGVyO1xuICBpZiAob3B0aW9ucy5pMThuT3B0aW9ucy5zaG91bGRJbmxpbmUpIHtcbiAgICAvLyBVcGRhdGUgZmlsZSBoYXNoZXMgdG8gaW5jbHVkZSB0cmFuc2xhdGlvbiBmaWxlIGNvbnRlbnRcbiAgICBjb25zdCBpMThuSGFzaCA9IE9iamVjdC52YWx1ZXMob3B0aW9ucy5pMThuT3B0aW9ucy5sb2NhbGVzKS5yZWR1Y2UoXG4gICAgICAoZGF0YSwgbG9jYWxlKSA9PiBkYXRhICsgbG9jYWxlLmZpbGVzLm1hcCgoZmlsZSkgPT4gZmlsZS5pbnRlZ3JpdHkgfHwgJycpLmpvaW4oJ3wnKSxcbiAgICAgICcnLFxuICAgICk7XG5cbiAgICBmb290ZXIgPSB7IGpzOiBgLyoqaTE4bjoke2NyZWF0ZUhhc2goJ3NoYTI1NicpLnVwZGF0ZShpMThuSGFzaCkuZGlnZXN0KCdoZXgnKX0qL2AgfTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgYWJzV29ya2luZ0Rpcjogd29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IHRydWUsXG4gICAgZm9ybWF0OiAnZXNtJyxcbiAgICBhc3NldE5hbWVzOiBvdXRwdXROYW1lcy5tZWRpYSxcbiAgICBjb25kaXRpb25zOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnbW9kdWxlJ10sXG4gICAgcmVzb2x2ZUV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBsZWdhbENvbW1lbnRzOiBvcHRpb25zLmV4dHJhY3RMaWNlbnNlcyA/ICdub25lJyA6ICdlb2YnLFxuICAgIGxvZ0xldmVsOiBvcHRpb25zLnZlcmJvc2UgPyAnZGVidWcnIDogJ3NpbGVudCcsXG4gICAgbWluaWZ5SWRlbnRpZmllcnM6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyAmJiBhbGxvd01hbmdsZSxcbiAgICBtaW5pZnlTeW50YXg6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBtaW5pZnlXaGl0ZXNwYWNlOiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgcHVyZTogWydmb3J3YXJkUmVmJ10sXG4gICAgb3V0ZGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIG91dEV4dGVuc2lvbjogb3V0RXh0ZW5zaW9uID8geyAnLmpzJzogYC4ke291dEV4dGVuc2lvbn1gIH0gOiB1bmRlZmluZWQsXG4gICAgc291cmNlbWFwOiBzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gJ2V4dGVybmFsJyA6IHRydWUpLFxuICAgIHNwbGl0dGluZzogdHJ1ZSxcbiAgICBjaHVua05hbWVzOiBvcHRpb25zLm5hbWVkQ2h1bmtzID8gJ1tuYW1lXS1baGFzaF0nIDogJ2NodW5rLVtoYXNoXScsXG4gICAgdHNjb25maWcsXG4gICAgZXh0ZXJuYWw6IGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIGRlZmluZToge1xuICAgICAgLy8gT25seSBzZXQgdG8gZmFsc2Ugd2hlbiBzY3JpcHQgb3B0aW1pemF0aW9ucyBhcmUgZW5hYmxlZC4gSXQgc2hvdWxkIG5vdCBiZSBzZXQgdG8gdHJ1ZSBiZWNhdXNlXG4gICAgICAvLyBBbmd1bGFyIHR1cm5zIGBuZ0Rldk1vZGVgIGludG8gYW4gb2JqZWN0IGZvciBkZXZlbG9wbWVudCBkZWJ1Z2dpbmcgcHVycG9zZXMgd2hlbiBub3QgZGVmaW5lZFxuICAgICAgLy8gd2hpY2ggYSBjb25zdGFudCB0cnVlIHZhbHVlIHdvdWxkIGJyZWFrLlxuICAgICAgLi4uKG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyA/IHsgJ25nRGV2TW9kZSc6ICdmYWxzZScgfSA6IHVuZGVmaW5lZCksXG4gICAgICAnbmdKaXRNb2RlJzogaml0ID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICB9LFxuICAgIGZvb3RlcixcbiAgfTtcbn1cbiJdfQ==