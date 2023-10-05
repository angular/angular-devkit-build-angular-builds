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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24tY29kZS1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FwcGxpY2F0aW9uLWNvZGUtYnVuZGxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw2Q0FBeUM7QUFDekMsK0NBQTRDO0FBQzVDLHlDQUFvRDtBQUVwRCx5RUFBOEQ7QUFDOUQsK0RBQWtGO0FBQ2xGLHVFQUF3RTtBQUN4RSw2REFBcUU7QUFDckUsNkVBQTZFO0FBQzdFLCtFQUFnRjtBQUNoRixtQ0FBNEM7QUFDNUMsbUVBQW9FO0FBRXBFLFNBQWdCLDhCQUE4QixDQUM1QyxPQUEwQyxFQUMxQyxNQUFnQixFQUNoQixlQUFpQztJQUVqQyxNQUFNLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLEdBQUcsT0FBTyxDQUFDO0lBRWpFLE1BQU0sRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLEdBQUcsSUFBQSxxREFBMkIsRUFDakUsT0FBTyxFQUNQLE1BQU0sRUFDTixlQUFlLENBQ2hCLENBQUM7SUFFRixNQUFNLFlBQVksR0FBaUI7UUFDakMsR0FBRyx1QkFBdUIsQ0FBQyxPQUFPLENBQUM7UUFDbkMsUUFBUSxFQUFFLFNBQVM7UUFDbkIseUVBQXlFO1FBQ3pFLDBFQUEwRTtRQUMxRSx5Q0FBeUM7UUFDekMscUVBQXFFO1FBQ3JFLFVBQVUsRUFBRSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUM7UUFDN0QsVUFBVSxFQUFFLFdBQVcsQ0FBQyxPQUFPO1FBQy9CLFdBQVc7UUFDWCxNQUFNO1FBQ04sU0FBUyxFQUFFLElBQUEseUJBQWlCLEVBQUMsTUFBTSxDQUFDO1FBQ3BDLE9BQU8sRUFBRTtZQUNQLElBQUEsNkRBQStCLEdBQUU7WUFDakMsSUFBQSxzQ0FBb0I7WUFDbEIsZ0JBQWdCO1lBQ2hCLGFBQWE7WUFDYiwrQkFBK0I7WUFDL0IsWUFBWSxDQUNiO1NBQ0Y7S0FDRixDQUFDO0lBRUYsSUFBSSxPQUFPLENBQUMsZ0JBQWdCLEVBQUU7UUFDNUIsWUFBWSxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUM7S0FDcEM7SUFFRCxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFFbEUsaURBQWlEO0lBQ2pELElBQUksR0FBRyxFQUFFO1FBQ1AsU0FBUyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0tBQ3JDO0lBRUQsZ0VBQWdFO0lBQ2hFLDRGQUE0RjtJQUM1RixJQUFJLG9CQUFvQixHQUFHLEtBQUssQ0FBQztJQUNqQyxJQUFJLE9BQU8sQ0FBQyxXQUFXLENBQUMsWUFBWSxFQUFFO1FBQ3BDLG1IQUFtSDtRQUNuSCxTQUFTLENBQUMsT0FBTyxDQUFDLDRCQUE0QixDQUFDLENBQUM7UUFDaEQsWUFBWSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQzNCLElBQUEsaURBQXlCLEVBQUM7WUFDeEIsU0FBUyxFQUFFLDRCQUE0QjtZQUN2QyxjQUFjLEVBQUUsS0FBSztZQUNyQixXQUFXLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztnQkFDbEIsUUFBUSxFQUFFLG9FQUFvRTtnQkFDOUUsTUFBTSxFQUFFLElBQUk7Z0JBQ1osVUFBVSxFQUFFLGFBQWE7YUFDMUIsQ0FBQztTQUNILENBQUMsQ0FDSCxDQUFDO1FBRUYseUNBQXlDO1FBQ3pDLG9FQUFvRTtRQUNwRSxLQUFLLE1BQU0sTUFBTSxJQUFJLE9BQU8sQ0FBQyxXQUFXLENBQUMsYUFBYSxFQUFFO1lBQ3RELFNBQVMsQ0FBQyxPQUFPLENBQUMsdUJBQXVCLE1BQU0sRUFBRSxDQUFDLENBQUM7U0FDcEQ7UUFDRCxvQkFBb0IsR0FBRyxJQUFJLENBQUM7S0FDN0I7U0FBTSxJQUFJLE9BQU8sQ0FBQyxXQUFXLENBQUMsc0JBQXNCLEVBQUU7UUFDckQsdUZBQXVGO1FBQ3ZGLFNBQVMsQ0FBQyxPQUFPLENBQUMsdUJBQXVCLE9BQU8sQ0FBQyxXQUFXLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztRQUM3RSxvQkFBb0IsR0FBRyxJQUFJLENBQUM7S0FDN0I7SUFDRCxJQUFJLG9CQUFvQixFQUFFO1FBQ3hCLFlBQVksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLElBQUEsa0RBQTZCLEdBQUUsQ0FBQyxDQUFDO0tBQzdEO0lBRUQsb0RBQW9EO0lBQ3BELElBQUksU0FBUyxDQUFDLE1BQU0sRUFBRTtRQUNwQixNQUFNLFNBQVMsR0FBRyxtQkFBbUIsQ0FBQztRQUN0QyxZQUFZLENBQUMsV0FBVyxHQUFHO1lBQ3pCLEdBQUcsWUFBWSxDQUFDLFdBQVc7WUFDM0IsV0FBVyxFQUFFLFNBQVM7U0FDdkIsQ0FBQztRQUVGLFlBQVksQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUMzQixJQUFBLGlEQUF5QixFQUFDO1lBQ3hCLFNBQVM7WUFDVCxXQUFXLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsRUFBRTtnQkFDOUIsTUFBTSxhQUFhLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUNyQyxTQUFTLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtvQkFDM0IsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBQSxtQkFBTyxFQUFDLElBQUksQ0FBQyxFQUFFO3dCQUNoRCxPQUFPLElBQUksQ0FBQztxQkFDYjtvQkFFRCxNQUFNLHFCQUFxQixHQUFHLElBQUksR0FBRyxJQUFJLENBQUM7b0JBQzFDLE1BQU0sTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRTt3QkFDeEQsSUFBSSxFQUFFLGtCQUFrQjt3QkFDeEIsVUFBVSxFQUFFLGFBQWE7cUJBQzFCLENBQUMsQ0FBQztvQkFFSCxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7Z0JBQ3BELENBQUMsQ0FBQyxDQUNILENBQUM7Z0JBRUYsT0FBTztvQkFDTCxRQUFRLEVBQUUsYUFBYTt5QkFDcEIsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxXQUFXLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUM7eUJBQ3RELElBQUksQ0FBQyxJQUFJLENBQUM7b0JBQ2IsTUFBTSxFQUFFLElBQUk7b0JBQ1osVUFBVSxFQUFFLGFBQWE7aUJBQzFCLENBQUM7WUFDSixDQUFDO1NBQ0YsQ0FBQyxDQUNILENBQUM7S0FDSDtJQUVELE9BQU8sWUFBWSxDQUFDO0FBQ3RCLENBQUM7QUF6SEQsd0VBeUhDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQWdCLDZCQUE2QixDQUMzQyxPQUEwQyxFQUMxQyxNQUFnQixFQUNoQixlQUFnQztJQUVoQyxNQUFNLEVBQ0osR0FBRyxFQUNILGdCQUFnQixFQUNoQixhQUFhLEVBQ2IsVUFBVSxFQUNWLEtBQUssRUFDTCxnQkFBZ0IsRUFDaEIsZ0JBQWdCLEdBQ2pCLEdBQUcsT0FBTyxDQUFDO0lBRVosSUFBQSxxQkFBTSxFQUNKLGdCQUFnQixFQUNoQix3RkFBd0YsQ0FDekYsQ0FBQztJQUVGLE1BQU0sRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLEdBQUcsSUFBQSxxREFBMkIsRUFDakUsT0FBTyxFQUNQLE1BQU0sRUFDTixlQUFlLENBQ2hCLENBQUM7SUFFRixNQUFNLG1CQUFtQixHQUFHLHFCQUFxQixDQUFDO0lBQ2xELE1BQU0saUJBQWlCLEdBQUcsbUJBQW1CLENBQUM7SUFFOUMsTUFBTSxXQUFXLEdBQTJCO1FBQzFDLGFBQWEsRUFBRSxtQkFBbUI7S0FDbkMsQ0FBQztJQUVGLE1BQU0sYUFBYSxHQUFHLFVBQVUsRUFBRSxLQUFLLENBQUM7SUFDeEMsSUFBSSxhQUFhLEVBQUU7UUFDakIsV0FBVyxDQUFDLFFBQVEsQ0FBQyxHQUFHLGlCQUFpQixDQUFDO0tBQzNDO0lBRUQsTUFBTSxZQUFZLEdBQWlCO1FBQ2pDLEdBQUcsdUJBQXVCLENBQUMsT0FBTyxDQUFDO1FBQ25DLFFBQVEsRUFBRSxNQUFNO1FBQ2hCLGdIQUFnSDtRQUNoSCxTQUFTLEVBQUUsQ0FBQyxHQUFHO1FBQ2YsWUFBWSxFQUFFLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRTtRQUMvQix5RUFBeUU7UUFDekUsMEVBQTBFO1FBQzFFLHlDQUF5QztRQUN6QyxxRUFBcUU7UUFDckUsVUFBVSxFQUFFLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDO1FBQ2xELFVBQVUsRUFBRSxRQUFRO1FBQ3BCLE1BQU07UUFDTixNQUFNLEVBQUU7WUFDTixpRkFBaUY7WUFDakYscURBQXFEO1lBQ3JELEVBQUUsRUFBRTtnQkFDRiw4Q0FBOEM7Z0JBQzlDLDJEQUEyRDthQUM1RCxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7U0FDYjtRQUNELFdBQVc7UUFDWCxTQUFTLEVBQUUsSUFBQSx5QkFBaUIsRUFBQyxNQUFNLENBQUM7UUFDcEMsT0FBTyxFQUFFO1lBQ1AsSUFBQSw2REFBK0IsR0FBRTtZQUNqQyxJQUFBLHNDQUFvQjtZQUNsQixnQkFBZ0I7WUFDaEIsRUFBRSxHQUFHLGFBQWEsRUFBRSx5QkFBeUIsRUFBRSxJQUFJLEVBQUU7WUFDckQsK0JBQStCO1lBQy9CLFlBQVksQ0FDYjtTQUNGO0tBQ0YsQ0FBQztJQUVGLFlBQVksQ0FBQyxPQUFPLEtBQUssRUFBRSxDQUFDO0lBQzVCLElBQUksZ0JBQWdCLEVBQUU7UUFDcEIsWUFBWSxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUM7S0FDcEM7U0FBTTtRQUNMLFlBQVksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUEsMERBQTZCLEdBQUUsQ0FBQyxDQUFDO0tBQzVEO0lBRUQsTUFBTSxTQUFTLEdBQWEsRUFBRSxDQUFDO0lBQy9CLElBQUksT0FBTyxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsU0FBUyxDQUFDLEVBQUU7UUFDMUMsU0FBUyxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0tBQzFDO0lBRUQsSUFBSSxHQUFHLEVBQUU7UUFDUCxTQUFTLENBQUMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLENBQUM7S0FDL0M7SUFFRCxTQUFTLENBQUMsSUFBSSxDQUFDLHlDQUF5QyxDQUFDLENBQUM7SUFFMUQsWUFBWSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQ3ZCLElBQUEsaURBQXlCLEVBQUM7UUFDeEIsU0FBUyxFQUFFLG1CQUFtQjtRQUM5QixXQUFXLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDdEIsTUFBTSxvQkFBb0IsR0FBRyxJQUFBLG9CQUFRLEVBQUMsYUFBYSxFQUFFLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztZQUUzRixNQUFNLFFBQVEsR0FBRztnQkFDZixHQUFHLFNBQVM7Z0JBQ1osc0NBQXNDLG9CQUFvQixJQUFJO2dCQUM5RCxxQ0FBcUM7Z0JBQ3JDLG9CQUFvQixvQkFBb0IsSUFBSTtnQkFDNUMsOEZBQThGO2FBQy9GLENBQUM7WUFFRixJQUFJLEtBQUssRUFBRTtnQkFDVCxRQUFRLENBQUMsSUFBSSxDQUFDLDJEQUEyRCxDQUFDLENBQUM7YUFDNUU7WUFFRCxJQUFJLGdCQUFnQixFQUFFLGNBQWMsRUFBRTtnQkFDcEMsK0ZBQStGO2dCQUMvRixNQUFNLG1CQUFtQixHQUFHLE1BQU0sSUFBQSxtQkFBUSxFQUN4QyxJQUFBLGdCQUFJLEVBQUMsU0FBUyxFQUFFLDJDQUEyQyxDQUFDLEVBQzVELE9BQU8sQ0FDUixDQUFDO2dCQUVGLDBHQUEwRztnQkFDMUcsUUFBUSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsb0NBQW9DLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQzthQUN0RjtZQUVELE9BQU87Z0JBQ0wsUUFBUSxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO2dCQUM3QixNQUFNLEVBQUUsSUFBSTtnQkFDWixVQUFVLEVBQUUsYUFBYTthQUMxQixDQUFDO1FBQ0osQ0FBQztLQUNGLENBQUMsQ0FDSCxDQUFDO0lBRUYsSUFBSSxhQUFhLEVBQUU7UUFDakIsWUFBWSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQ3ZCLElBQUEsaURBQXlCLEVBQUM7WUFDeEIsU0FBUyxFQUFFLGlCQUFpQjtZQUM1QixXQUFXLEVBQUUsR0FBRyxFQUFFO2dCQUNoQixNQUFNLGdCQUFnQixHQUFHLElBQUEsb0JBQVEsRUFBQyxhQUFhLEVBQUUsYUFBYSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFFcEYsT0FBTztvQkFDTCxRQUFRLEVBQUU7d0JBQ1IsR0FBRyxTQUFTO3dCQUNaLGFBQWEsZ0JBQWdCLElBQUk7d0JBQ2pDLG9CQUFvQixnQkFBZ0IsSUFBSTtxQkFDekMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO29CQUNaLE1BQU0sRUFBRSxJQUFJO29CQUNaLFVBQVUsRUFBRSxhQUFhO2lCQUMxQixDQUFDO1lBQ0osQ0FBQztTQUNGLENBQUMsQ0FDSCxDQUFDO0tBQ0g7SUFFRCxPQUFPLFlBQVksQ0FBQztBQUN0QixDQUFDO0FBdEpELHNFQXNKQztBQUVELFNBQVMsdUJBQXVCLENBQUMsT0FBMEM7SUFDekUsTUFBTSxFQUNKLGFBQWEsRUFDYixZQUFZLEVBQ1osbUJBQW1CLEVBQ25CLGdCQUFnQixFQUNoQixRQUFRLEVBQ1Isb0JBQW9CLEVBQ3BCLFdBQVcsRUFDWCxnQkFBZ0IsRUFDaEIsR0FBRyxHQUNKLEdBQUcsT0FBTyxDQUFDO0lBRVosc0ZBQXNGO0lBQ3RGLHlHQUF5RztJQUN6RyxvR0FBb0c7SUFDcEcsbUhBQW1IO0lBQ25ILElBQUksTUFBTSxDQUFDO0lBQ1gsSUFBSSxPQUFPLENBQUMsV0FBVyxDQUFDLFlBQVksRUFBRTtRQUNwQyx5REFBeUQ7UUFDekQsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FDaEUsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUNuRixFQUFFLENBQ0gsQ0FBQztRQUVGLE1BQU0sR0FBRyxFQUFFLEVBQUUsRUFBRSxXQUFXLElBQUEsd0JBQVUsRUFBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztLQUNyRjtJQUVELE9BQU87UUFDTCxhQUFhLEVBQUUsYUFBYTtRQUM1QixNQUFNLEVBQUUsSUFBSTtRQUNaLE1BQU0sRUFBRSxLQUFLO1FBQ2IsVUFBVSxFQUFFLFdBQVcsQ0FBQyxLQUFLO1FBQzdCLFVBQVUsRUFBRSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDO1FBQzFDLGlCQUFpQixFQUFFLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDO1FBQ2pELFFBQVEsRUFBRSxJQUFJO1FBQ2QsYUFBYSxFQUFFLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSztRQUN2RCxRQUFRLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxRQUFRO1FBQzlDLGlCQUFpQixFQUFFLG1CQUFtQixDQUFDLE9BQU8sSUFBSSxpQ0FBVztRQUM3RCxZQUFZLEVBQUUsbUJBQW1CLENBQUMsT0FBTztRQUN6QyxnQkFBZ0IsRUFBRSxtQkFBbUIsQ0FBQyxPQUFPO1FBQzdDLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQztRQUNwQixNQUFNLEVBQUUsYUFBYTtRQUNyQixZQUFZLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVM7UUFDdEUsU0FBUyxFQUFFLGdCQUFnQixDQUFDLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDcEYsU0FBUyxFQUFFLElBQUk7UUFDZixVQUFVLEVBQUUsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxjQUFjO1FBQ2xFLFFBQVE7UUFDUixRQUFRLEVBQUUsb0JBQW9CO1FBQzlCLEtBQUssRUFBRSxLQUFLO1FBQ1osZ0JBQWdCO1FBQ2hCLE1BQU0sRUFBRTtZQUNOLGdHQUFnRztZQUNoRywrRkFBK0Y7WUFDL0YsMkNBQTJDO1lBQzNDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDdkUsV0FBVyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPO1NBQ3BDO1FBQ0QsTUFBTTtLQUNQLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdub2RlOmNyeXB0byc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHR5cGUgeyBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMgfSBmcm9tICcuLi8uLi9idWlsZGVycy9hcHBsaWNhdGlvbi9vcHRpb25zJztcbmltcG9ydCB7IGFsbG93TWFuZ2xlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBTb3VyY2VGaWxlQ2FjaGUsIGNyZWF0ZUNvbXBpbGVyUGx1Z2luIH0gZnJvbSAnLi9hbmd1bGFyL2NvbXBpbGVyLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVDb21waWxlclBsdWdpbk9wdGlvbnMgfSBmcm9tICcuL2NvbXBpbGVyLXBsdWdpbi1vcHRpb25zJztcbmltcG9ydCB7IGNyZWF0ZUFuZ3VsYXJMb2NhbGVEYXRhUGx1Z2luIH0gZnJvbSAnLi9pMThuLWxvY2FsZS1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlUnhqc0VzbVJlc29sdXRpb25QbHVnaW4gfSBmcm9tICcuL3J4anMtZXNtLXJlc29sdXRpb24tcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZVNvdXJjZW1hcElnbm9yZWxpc3RQbHVnaW4gfSBmcm9tICcuL3NvdXJjZW1hcC1pZ25vcmVsaXN0LXBsdWdpbic7XG5pbXBvcnQgeyBnZXRGZWF0dXJlU3VwcG9ydCB9IGZyb20gJy4vdXRpbHMnO1xuaW1wb3J0IHsgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbiB9IGZyb20gJy4vdmlydHVhbC1tb2R1bGUtcGx1Z2luJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUJyb3dzZXJDb2RlQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7IHdvcmtzcGFjZVJvb3QsIGVudHJ5UG9pbnRzLCBvdXRwdXROYW1lcywgaml0IH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IHsgcGx1Z2luT3B0aW9ucywgc3R5bGVPcHRpb25zIH0gPSBjcmVhdGVDb21waWxlclBsdWdpbk9wdGlvbnMoXG4gICAgb3B0aW9ucyxcbiAgICB0YXJnZXQsXG4gICAgc291cmNlRmlsZUNhY2hlLFxuICApO1xuXG4gIGNvbnN0IGJ1aWxkT3B0aW9uczogQnVpbGRPcHRpb25zID0ge1xuICAgIC4uLmdldEVzQnVpbGRDb21tb25PcHRpb25zKG9wdGlvbnMpLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgLy8gTm90ZTogYGVzMjAxNWAgaXMgbmVlZGVkIGZvciBSeEpTIHY2LiBJZiBub3Qgc3BlY2lmaWVkLCBgbW9kdWxlYCB3b3VsZFxuICAgIC8vIG1hdGNoIGFuZCB0aGUgRVM1IGRpc3RyaWJ1dGlvbiB3b3VsZCBiZSBidW5kbGVkIGFuZCBlbmRzIHVwIGJyZWFraW5nIGF0XG4gICAgLy8gcnVudGltZSB3aXRoIHRoZSBSeEpTIHRlc3RpbmcgbGlicmFyeS5cbiAgICAvLyBNb3JlIGRldGFpbHM6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNTQwNS5cbiAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgIGVudHJ5TmFtZXM6IG91dHB1dE5hbWVzLmJ1bmRsZXMsXG4gICAgZW50cnlQb2ludHMsXG4gICAgdGFyZ2V0LFxuICAgIHN1cHBvcnRlZDogZ2V0RmVhdHVyZVN1cHBvcnQodGFyZ2V0KSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVTb3VyY2VtYXBJZ25vcmVsaXN0UGx1Z2luKCksXG4gICAgICBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgICAgICAgLy8gSlMvVFMgb3B0aW9uc1xuICAgICAgICBwbHVnaW5PcHRpb25zLFxuICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzaGVldCBvcHRpb25zXG4gICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICksXG4gICAgXSxcbiAgfTtcblxuICBpZiAob3B0aW9ucy5leHRlcm5hbFBhY2thZ2VzKSB7XG4gICAgYnVpbGRPcHRpb25zLnBhY2thZ2VzID0gJ2V4dGVybmFsJztcbiAgfVxuXG4gIGNvbnN0IHBvbHlmaWxscyA9IG9wdGlvbnMucG9seWZpbGxzID8gWy4uLm9wdGlvbnMucG9seWZpbGxzXSA6IFtdO1xuXG4gIC8vIEFuZ3VsYXIgSklUIG1vZGUgcmVxdWlyZXMgdGhlIHJ1bnRpbWUgY29tcGlsZXJcbiAgaWYgKGppdCkge1xuICAgIHBvbHlmaWxscy5wdXNoKCdAYW5ndWxhci9jb21waWxlcicpO1xuICB9XG5cbiAgLy8gQWRkIEFuZ3VsYXIncyBnbG9iYWwgbG9jYWxlIGRhdGEgaWYgaTE4biBvcHRpb25zIGFyZSBwcmVzZW50LlxuICAvLyBMb2NhbGUgZGF0YSBzaG91bGQgZ28gZmlyc3Qgc28gdGhhdCBwcm9qZWN0IHByb3ZpZGVkIHBvbHlmaWxsIGNvZGUgY2FuIGF1Z21lbnQgaWYgbmVlZGVkLlxuICBsZXQgbmVlZExvY2FsZURhdGFQbHVnaW4gPSBmYWxzZTtcbiAgaWYgKG9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgLy8gV2hlbiBpbmxpbmluZywgYSBwbGFjZWhvbGRlciBpcyB1c2VkIHRvIGFsbG93IHRoZSBwb3N0LXByb2Nlc3Npbmcgc3RlcCB0byBpbmplY3QgdGhlICRsb2NhbGl6ZSBsb2NhbGUgaWRlbnRpZmllclxuICAgIHBvbHlmaWxscy51bnNoaWZ0KCdhbmd1bGFyOmxvY2FsZS9wbGFjZWhvbGRlcicpO1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zPy51bnNoaWZ0KFxuICAgICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICAgIG5hbWVzcGFjZTogJ2FuZ3VsYXI6bG9jYWxlL3BsYWNlaG9sZGVyJyxcbiAgICAgICAgZW50cnlQb2ludE9ubHk6IGZhbHNlLFxuICAgICAgICBsb2FkQ29udGVudDogKCkgPT4gKHtcbiAgICAgICAgICBjb250ZW50czogYChnbG9iYWxUaGlzLiRsb2NhbGl6ZSA/Pz0ge30pLmxvY2FsZSA9IFwiX19fTkdfTE9DQUxFX0lOU0VSVF9fX1wiO1xcbmAsXG4gICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIH0pLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIC8vIEFkZCBsb2NhbGUgZGF0YSBmb3IgYWxsIGFjdGl2ZSBsb2NhbGVzXG4gICAgLy8gVE9ETzogSW5qZWN0IGVhY2ggaW5kaXZpZHVhbGx5IHdpdGhpbiB0aGUgaW5saW5pbmcgcHJvY2VzcyBpdHNlbGZcbiAgICBmb3IgKGNvbnN0IGxvY2FsZSBvZiBvcHRpb25zLmkxOG5PcHRpb25zLmlubGluZUxvY2FsZXMpIHtcbiAgICAgIHBvbHlmaWxscy51bnNoaWZ0KGBhbmd1bGFyOmxvY2FsZS9kYXRhOiR7bG9jYWxlfWApO1xuICAgIH1cbiAgICBuZWVkTG9jYWxlRGF0YVBsdWdpbiA9IHRydWU7XG4gIH0gZWxzZSBpZiAob3B0aW9ucy5pMThuT3B0aW9ucy5oYXNEZWZpbmVkU291cmNlTG9jYWxlKSB7XG4gICAgLy8gV2hlbiBub3QgaW5saW5pbmcgYW5kIGEgc291cmNlIGxvY2FsIGlzIHByZXNlbnQsIHVzZSB0aGUgc291cmNlIGxvY2FsZSBkYXRhIGRpcmVjdGx5XG4gICAgcG9seWZpbGxzLnVuc2hpZnQoYGFuZ3VsYXI6bG9jYWxlL2RhdGE6JHtvcHRpb25zLmkxOG5PcHRpb25zLnNvdXJjZUxvY2FsZX1gKTtcbiAgICBuZWVkTG9jYWxlRGF0YVBsdWdpbiA9IHRydWU7XG4gIH1cbiAgaWYgKG5lZWRMb2NhbGVEYXRhUGx1Z2luKSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnM/LnB1c2goY3JlYXRlQW5ndWxhckxvY2FsZURhdGFQbHVnaW4oKSk7XG4gIH1cblxuICAvLyBBZGQgcG9seWZpbGwgZW50cnkgcG9pbnQgaWYgcG9seWZpbGxzIGFyZSBwcmVzZW50XG4gIGlmIChwb2x5ZmlsbHMubGVuZ3RoKSB7XG4gICAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6cG9seWZpbGxzJztcbiAgICBidWlsZE9wdGlvbnMuZW50cnlQb2ludHMgPSB7XG4gICAgICAuLi5idWlsZE9wdGlvbnMuZW50cnlQb2ludHMsXG4gICAgICAncG9seWZpbGxzJzogbmFtZXNwYWNlLFxuICAgIH07XG5cbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucz8udW5zaGlmdChcbiAgICAgIGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW4oe1xuICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgIGxvYWRDb250ZW50OiBhc3luYyAoXywgYnVpbGQpID0+IHtcbiAgICAgICAgICBjb25zdCBwb2x5ZmlsbFBhdGhzID0gYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgICBwb2x5ZmlsbHMubWFwKGFzeW5jIChwYXRoKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChwYXRoLnN0YXJ0c1dpdGgoJ3pvbmUuanMnKSB8fCAhZXh0bmFtZShwYXRoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgcG90ZW50aWFsUGF0aFJlbGF0aXZlID0gJy4vJyArIHBhdGg7XG4gICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJ1aWxkLnJlc29sdmUocG90ZW50aWFsUGF0aFJlbGF0aXZlLCB7XG4gICAgICAgICAgICAgICAga2luZDogJ2ltcG9ydC1zdGF0ZW1lbnQnLFxuICAgICAgICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIHJldHVybiByZXN1bHQucGF0aCA/IHBvdGVudGlhbFBhdGhSZWxhdGl2ZSA6IHBhdGg7XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNvbnRlbnRzOiBwb2x5ZmlsbFBhdGhzXG4gICAgICAgICAgICAgIC5tYXAoKGZpbGUpID0+IGBpbXBvcnQgJyR7ZmlsZS5yZXBsYWNlKC9cXFxcL2csICcvJyl9JztgKVxuICAgICAgICAgICAgICAuam9pbignXFxuJyksXG4gICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gZXNidWlsZCAnYnVpbGQnIG9wdGlvbnMgb2JqZWN0IGZvciB0aGUgc2VydmVyIGJ1bmRsZS5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBidWlsZGVyJ3MgdXNlci1wcm92aWRlciBub3JtYWxpemVkIG9wdGlvbnMuXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIEJ1aWxkT3B0aW9ucyBvYmplY3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTZXJ2ZXJDb2RlQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU6IFNvdXJjZUZpbGVDYWNoZSxcbik6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHtcbiAgICBqaXQsXG4gICAgc2VydmVyRW50cnlQb2ludCxcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIHNzck9wdGlvbnMsXG4gICAgd2F0Y2gsXG4gICAgZXh0ZXJuYWxQYWNrYWdlcyxcbiAgICBwcmVyZW5kZXJPcHRpb25zLFxuICB9ID0gb3B0aW9ucztcblxuICBhc3NlcnQoXG4gICAgc2VydmVyRW50cnlQb2ludCxcbiAgICAnY3JlYXRlU2VydmVyQ29kZUJ1bmRsZU9wdGlvbnMgc2hvdWxkIG5vdCBiZSBjYWxsZWQgd2l0aG91dCBhIGRlZmluZWQgc2VydmVyRW50cnlQb2ludC4nLFxuICApO1xuXG4gIGNvbnN0IHsgcGx1Z2luT3B0aW9ucywgc3R5bGVPcHRpb25zIH0gPSBjcmVhdGVDb21waWxlclBsdWdpbk9wdGlvbnMoXG4gICAgb3B0aW9ucyxcbiAgICB0YXJnZXQsXG4gICAgc291cmNlRmlsZUNhY2hlLFxuICApO1xuXG4gIGNvbnN0IG1haW5TZXJ2ZXJOYW1lc3BhY2UgPSAnYW5ndWxhcjptYWluLXNlcnZlcic7XG4gIGNvbnN0IHNzckVudHJ5TmFtZXNwYWNlID0gJ2FuZ3VsYXI6c3NyLWVudHJ5JztcblxuICBjb25zdCBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAnbWFpbi5zZXJ2ZXInOiBtYWluU2VydmVyTmFtZXNwYWNlLFxuICB9O1xuXG4gIGNvbnN0IHNzckVudHJ5UG9pbnQgPSBzc3JPcHRpb25zPy5lbnRyeTtcbiAgaWYgKHNzckVudHJ5UG9pbnQpIHtcbiAgICBlbnRyeVBvaW50c1snc2VydmVyJ10gPSBzc3JFbnRyeU5hbWVzcGFjZTtcbiAgfVxuXG4gIGNvbnN0IGJ1aWxkT3B0aW9uczogQnVpbGRPcHRpb25zID0ge1xuICAgIC4uLmdldEVzQnVpbGRDb21tb25PcHRpb25zKG9wdGlvbnMpLFxuICAgIHBsYXRmb3JtOiAnbm9kZScsXG4gICAgLy8gVE9ETzogSW52ZXNpZ2F0ZSB3aHkgZW5hYmxpbmcgYHNwbGl0dGluZ2AgaW4gSklUIG1vZGUgY2F1c2VzIGFuIFwiJ0Bhbmd1bGFyL2NvbXBpbGVyJyBpcyBub3QgYXZhaWxhYmxlXCIgZXJyb3IuXG4gICAgc3BsaXR0aW5nOiAhaml0LFxuICAgIG91dEV4dGVuc2lvbjogeyAnLmpzJzogJy5tanMnIH0sXG4gICAgLy8gTm90ZTogYGVzMjAxNWAgaXMgbmVlZGVkIGZvciBSeEpTIHY2LiBJZiBub3Qgc3BlY2lmaWVkLCBgbW9kdWxlYCB3b3VsZFxuICAgIC8vIG1hdGNoIGFuZCB0aGUgRVM1IGRpc3RyaWJ1dGlvbiB3b3VsZCBiZSBidW5kbGVkIGFuZCBlbmRzIHVwIGJyZWFraW5nIGF0XG4gICAgLy8gcnVudGltZSB3aXRoIHRoZSBSeEpTIHRlc3RpbmcgbGlicmFyeS5cbiAgICAvLyBNb3JlIGRldGFpbHM6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNTQwNS5cbiAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICBlbnRyeU5hbWVzOiAnW25hbWVdJyxcbiAgICB0YXJnZXQsXG4gICAgYmFubmVyOiB7XG4gICAgICAvLyBOb3RlOiBOZWVkZWQgYXMgZXNidWlsZCBkb2VzIG5vdCBwcm92aWRlIHJlcXVpcmUgc2hpbXMgLyBwcm94eSBmcm9tIEVTTW9kdWxlcy5cbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2V2YW53L2VzYnVpbGQvaXNzdWVzLzE5MjEuXG4gICAgICBqczogW1xuICAgICAgICBgaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJztgLFxuICAgICAgICBgZ2xvYmFsVGhpc1sncmVxdWlyZSddID8/PSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybCk7YCxcbiAgICAgIF0uam9pbignXFxuJyksXG4gICAgfSxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBzdXBwb3J0ZWQ6IGdldEZlYXR1cmVTdXBwb3J0KHRhcmdldCksXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlU291cmNlbWFwSWdub3JlbGlzdFBsdWdpbigpLFxuICAgICAgY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gICAgICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICAgICAgeyAuLi5wbHVnaW5PcHRpb25zLCBub29wVHlwZVNjcmlwdENvbXBpbGF0aW9uOiB0cnVlIH0sXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgKSxcbiAgICBdLFxuICB9O1xuXG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zID8/PSBbXTtcbiAgaWYgKGV4dGVybmFsUGFja2FnZXMpIHtcbiAgICBidWlsZE9wdGlvbnMucGFja2FnZXMgPSAnZXh0ZXJuYWwnO1xuICB9IGVsc2Uge1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goY3JlYXRlUnhqc0VzbVJlc29sdXRpb25QbHVnaW4oKSk7XG4gIH1cblxuICBjb25zdCBwb2x5ZmlsbHM6IHN0cmluZ1tdID0gW107XG4gIGlmIChvcHRpb25zLnBvbHlmaWxscz8uaW5jbHVkZXMoJ3pvbmUuanMnKSkge1xuICAgIHBvbHlmaWxscy5wdXNoKGBpbXBvcnQgJ3pvbmUuanMvbm9kZSc7YCk7XG4gIH1cblxuICBpZiAoaml0KSB7XG4gICAgcG9seWZpbGxzLnB1c2goYGltcG9ydCAnQGFuZ3VsYXIvY29tcGlsZXInO2ApO1xuICB9XG5cbiAgcG9seWZpbGxzLnB1c2goYGltcG9ydCAnQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyL2luaXQnO2ApO1xuXG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goXG4gICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICBuYW1lc3BhY2U6IG1haW5TZXJ2ZXJOYW1lc3BhY2UsXG4gICAgICBsb2FkQ29udGVudDogYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBtYWluU2VydmVyRW50cnlQb2ludCA9IHJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIHNlcnZlckVudHJ5UG9pbnQpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcblxuICAgICAgICBjb25zdCBjb250ZW50cyA9IFtcbiAgICAgICAgICAuLi5wb2x5ZmlsbHMsXG4gICAgICAgICAgYGltcG9ydCBtb2R1bGVPckJvb3RzdHJhcEZuIGZyb20gJy4vJHttYWluU2VydmVyRW50cnlQb2ludH0nO2AsXG4gICAgICAgICAgYGV4cG9ydCBkZWZhdWx0IG1vZHVsZU9yQm9vdHN0cmFwRm47YCxcbiAgICAgICAgICBgZXhwb3J0ICogZnJvbSAnLi8ke21haW5TZXJ2ZXJFbnRyeVBvaW50fSc7YCxcbiAgICAgICAgICBgZXhwb3J0IHsgcmVuZGVyQXBwbGljYXRpb24sIHJlbmRlck1vZHVsZSwgybVTRVJWRVJfQ09OVEVYVCB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcic7YCxcbiAgICAgICAgXTtcblxuICAgICAgICBpZiAod2F0Y2gpIHtcbiAgICAgICAgICBjb250ZW50cy5wdXNoKGBleHBvcnQgeyDJtXJlc2V0Q29tcGlsZWRDb21wb25lbnRzIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7YCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocHJlcmVuZGVyT3B0aW9ucz8uZGlzY292ZXJSb3V0ZXMpIHtcbiAgICAgICAgICAvLyBXZSBkbyBub3QgaW1wb3J0IGl0IGRpcmVjdGx5IHNvIHRoYXQgbm9kZS5qcyBtb2R1bGVzIGFyZSByZXNvbHZlZCB1c2luZyB0aGUgY29ycmVjdCBjb250ZXh0LlxuICAgICAgICAgIGNvbnN0IHJvdXRlc0V4dHJhY3RvckNvZGUgPSBhd2FpdCByZWFkRmlsZShcbiAgICAgICAgICAgIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vdXRpbHMvcm91dGVzLWV4dHJhY3Rvci9leHRyYWN0b3IuanMnKSxcbiAgICAgICAgICAgICd1dGYtOCcsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIC8vIFJlbW92ZSBzb3VyY2UgbWFwIFVSTCBjb21tZW50cyBmcm9tIHRoZSBjb2RlIGlmIGEgc291cmNlbWFwIGlzIHByZXNlbnQgYXMgdGhpcyB3aWxsIG5vdCBtYXRjaCB0aGUgZmlsZS5cbiAgICAgICAgICBjb250ZW50cy5wdXNoKHJvdXRlc0V4dHJhY3RvckNvZGUucmVwbGFjZSgvXlxcL1xcLyMgc291cmNlTWFwcGluZ1VSTD1bXlxcclxcbl0qL2dtLCAnJykpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50czogY29udGVudHMuam9pbignXFxuJyksXG4gICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgIH0pLFxuICApO1xuXG4gIGlmIChzc3JFbnRyeVBvaW50KSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnMucHVzaChcbiAgICAgIGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW4oe1xuICAgICAgICBuYW1lc3BhY2U6IHNzckVudHJ5TmFtZXNwYWNlLFxuICAgICAgICBsb2FkQ29udGVudDogKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHNlcnZlckVudHJ5UG9pbnQgPSByZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCBzc3JFbnRyeVBvaW50KS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29udGVudHM6IFtcbiAgICAgICAgICAgICAgLi4ucG9seWZpbGxzLFxuICAgICAgICAgICAgICBgaW1wb3J0ICcuLyR7c2VydmVyRW50cnlQb2ludH0nO2AsXG4gICAgICAgICAgICAgIGBleHBvcnQgKiBmcm9tICcuLyR7c2VydmVyRW50cnlQb2ludH0nO2AsXG4gICAgICAgICAgICBdLmpvaW4oJ1xcbicpLFxuICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBidWlsZE9wdGlvbnM7XG59XG5cbmZ1bmN0aW9uIGdldEVzQnVpbGRDb21tb25PcHRpb25zKG9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyk6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHtcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG91dEV4dGVuc2lvbixcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBqaXQsXG4gIH0gPSBvcHRpb25zO1xuXG4gIC8vIEVuc3VyZSB1bmlxdWUgaGFzaGVzIGZvciBpMThuIHRyYW5zbGF0aW9uIGNoYW5nZXMgd2hlbiB1c2luZyBwb3N0LXByb2Nlc3MgaW5saW5pbmcuXG4gIC8vIFRoaXMgaGFzaCB2YWx1ZSBpcyBhZGRlZCBhcyBhIGZvb3RlciB0byBlYWNoIGZpbGUgYW5kIGVuc3VyZXMgdGhhdCB0aGUgb3V0cHV0IGZpbGUgbmFtZXMgKHdpdGggaGFzaGVzKVxuICAvLyBjaGFuZ2Ugd2hlbiB0cmFuc2xhdGlvbiBmaWxlcyBoYXZlIGNoYW5nZWQuIElmIHRoaXMgaXMgbm90IGRvbmUgdGhlIHBvc3QgcHJvY2Vzc2VkIGZpbGVzIG1heSBoYXZlXG4gIC8vIGRpZmZlcmVudCBjb250ZW50IGJ1dCB3b3VsZCByZXRhaW4gaWRlbnRpY2FsIHByb2R1Y3Rpb24gZmlsZSBuYW1lcyB3aGljaCB3b3VsZCBsZWFkIHRvIGJyb3dzZXIgY2FjaGluZyBwcm9ibGVtcy5cbiAgbGV0IGZvb3RlcjtcbiAgaWYgKG9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgLy8gVXBkYXRlIGZpbGUgaGFzaGVzIHRvIGluY2x1ZGUgdHJhbnNsYXRpb24gZmlsZSBjb250ZW50XG4gICAgY29uc3QgaTE4bkhhc2ggPSBPYmplY3QudmFsdWVzKG9wdGlvbnMuaTE4bk9wdGlvbnMubG9jYWxlcykucmVkdWNlKFxuICAgICAgKGRhdGEsIGxvY2FsZSkgPT4gZGF0YSArIGxvY2FsZS5maWxlcy5tYXAoKGZpbGUpID0+IGZpbGUuaW50ZWdyaXR5IHx8ICcnKS5qb2luKCd8JyksXG4gICAgICAnJyxcbiAgICApO1xuXG4gICAgZm9vdGVyID0geyBqczogYC8qKmkxOG46JHtjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoaTE4bkhhc2gpLmRpZ2VzdCgnaGV4Jyl9Ki9gIH07XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGFic1dvcmtpbmdEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgYnVuZGxlOiB0cnVlLFxuICAgIGZvcm1hdDogJ2VzbScsXG4gICAgYXNzZXROYW1lczogb3V0cHV0TmFtZXMubWVkaWEsXG4gICAgY29uZGl0aW9uczogWydlczIwMjAnLCAnZXMyMDE1JywgJ21vZHVsZSddLFxuICAgIHJlc29sdmVFeHRlbnNpb25zOiBbJy50cycsICcudHN4JywgJy5tanMnLCAnLmpzJ10sXG4gICAgbWV0YWZpbGU6IHRydWUsXG4gICAgbGVnYWxDb21tZW50czogb3B0aW9ucy5leHRyYWN0TGljZW5zZXMgPyAnbm9uZScgOiAnZW9mJyxcbiAgICBsb2dMZXZlbDogb3B0aW9ucy52ZXJib3NlID8gJ2RlYnVnJyA6ICdzaWxlbnQnLFxuICAgIG1pbmlmeUlkZW50aWZpZXJzOiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgJiYgYWxsb3dNYW5nbGUsXG4gICAgbWluaWZ5U3ludGF4OiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgbWluaWZ5V2hpdGVzcGFjZTogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzLFxuICAgIHB1cmU6IFsnZm9yd2FyZFJlZiddLFxuICAgIG91dGRpcjogd29ya3NwYWNlUm9vdCxcbiAgICBvdXRFeHRlbnNpb246IG91dEV4dGVuc2lvbiA/IHsgJy5qcyc6IGAuJHtvdXRFeHRlbnNpb259YCB9IDogdW5kZWZpbmVkLFxuICAgIHNvdXJjZW1hcDogc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICBzcGxpdHRpbmc6IHRydWUsXG4gICAgY2h1bmtOYW1lczogb3B0aW9ucy5uYW1lZENodW5rcyA/ICdbbmFtZV0tW2hhc2hdJyA6ICdjaHVuay1baGFzaF0nLFxuICAgIHRzY29uZmlnLFxuICAgIGV4dGVybmFsOiBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICB3cml0ZTogZmFsc2UsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBkZWZpbmU6IHtcbiAgICAgIC8vIE9ubHkgc2V0IHRvIGZhbHNlIHdoZW4gc2NyaXB0IG9wdGltaXphdGlvbnMgYXJlIGVuYWJsZWQuIEl0IHNob3VsZCBub3QgYmUgc2V0IHRvIHRydWUgYmVjYXVzZVxuICAgICAgLy8gQW5ndWxhciB0dXJucyBgbmdEZXZNb2RlYCBpbnRvIGFuIG9iamVjdCBmb3IgZGV2ZWxvcG1lbnQgZGVidWdnaW5nIHB1cnBvc2VzIHdoZW4gbm90IGRlZmluZWRcbiAgICAgIC8vIHdoaWNoIGEgY29uc3RhbnQgdHJ1ZSB2YWx1ZSB3b3VsZCBicmVhay5cbiAgICAgIC4uLihvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgPyB7ICduZ0Rldk1vZGUnOiAnZmFsc2UnIH0gOiB1bmRlZmluZWQpLFxuICAgICAgJ25nSml0TW9kZSc6IGppdCA/ICd0cnVlJyA6ICdmYWxzZScsXG4gICAgfSxcbiAgICBmb290ZXIsXG4gIH07XG59XG4iXX0=