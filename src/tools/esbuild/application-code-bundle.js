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
exports.createServerPolyfillBundleOptions = exports.createServerCodeBundleOptions = exports.createBrowserPolyfillBundleOptions = exports.createBrowserCodeBundleOptions = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const environment_options_1 = require("../../utils/environment-options");
const compiler_plugin_1 = require("./angular/compiler-plugin");
const compiler_plugin_options_1 = require("./compiler-plugin-options");
const i18n_locale_plugin_1 = require("./i18n-locale-plugin");
const javascript_transfomer_plugin_1 = require("./javascript-transfomer-plugin");
const rxjs_esm_resolution_plugin_1 = require("./rxjs-esm-resolution-plugin");
const sourcemap_ignorelist_plugin_1 = require("./sourcemap-ignorelist-plugin");
const utils_1 = require("./utils");
const virtual_module_plugin_1 = require("./virtual-module-plugin");
function createBrowserCodeBundleOptions(options, target, sourceFileCache) {
    const { entryPoints, outputNames } = options;
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
    if (options.plugins) {
        buildOptions.plugins?.push(...options.plugins);
    }
    return buildOptions;
}
exports.createBrowserCodeBundleOptions = createBrowserCodeBundleOptions;
function createBrowserPolyfillBundleOptions(options, target, sourceFileCache) {
    const namespace = 'angular:polyfills';
    const polyfillBundleOptions = getEsBuildCommonPolyfillsOptions(options, namespace, true, sourceFileCache);
    if (!polyfillBundleOptions) {
        return;
    }
    const { outputNames } = options;
    const { pluginOptions, styleOptions } = (0, compiler_plugin_options_1.createCompilerPluginOptions)(options, target, sourceFileCache);
    const buildOptions = {
        ...polyfillBundleOptions,
        platform: 'browser',
        // Note: `es2015` is needed for RxJS v6. If not specified, `module` would
        // match and the ES5 distribution would be bundled and ends up breaking at
        // runtime with the RxJS testing library.
        // More details: https://github.com/angular/angular-cli/issues/25405.
        mainFields: ['es2020', 'es2015', 'browser', 'module', 'main'],
        entryNames: outputNames.bundles,
        target,
        entryPoints: {
            'polyfills': namespace,
        },
    };
    buildOptions.plugins ??= [];
    buildOptions.plugins.push((0, compiler_plugin_1.createCompilerPlugin)(
    // JS/TS options
    { ...pluginOptions, noopTypeScriptCompilation: true }, 
    // Component stylesheet options are unused for polyfills but required by the plugin
    styleOptions));
    return buildOptions;
}
exports.createBrowserPolyfillBundleOptions = createBrowserPolyfillBundleOptions;
/**
 * Create an esbuild 'build' options object for the server bundle.
 * @param options The builder's user-provider normalized options.
 * @returns An esbuild BuildOptions object.
 */
function createServerCodeBundleOptions(options, target, sourceFileCache) {
    const { jit, serverEntryPoint, workspaceRoot, ssrOptions, watch, externalPackages, prerenderOptions, } = options;
    (0, node_assert_1.default)(serverEntryPoint, 'createServerCodeBundleOptions should not be called without a defined serverEntryPoint.');
    const { pluginOptions, styleOptions } = (0, compiler_plugin_options_1.createCompilerPluginOptions)(options, target, sourceFileCache);
    const mainServerNamespace = 'angular:server-render-utils';
    const entryPoints = {
        'render-utils.server': mainServerNamespace,
        'main.server': serverEntryPoint,
    };
    const ssrEntryPoint = ssrOptions?.entry;
    if (ssrEntryPoint) {
        entryPoints['server'] = ssrEntryPoint;
    }
    const buildOptions = {
        ...getEsBuildCommonOptions(options),
        platform: 'node',
        splitting: true,
        outExtension: { '.js': '.mjs' },
        // Note: `es2015` is needed for RxJS v6. If not specified, `module` would
        // match and the ES5 distribution would be bundled and ends up breaking at
        // runtime with the RxJS testing library.
        // More details: https://github.com/angular/angular-cli/issues/25405.
        mainFields: ['es2020', 'es2015', 'module', 'main'],
        entryNames: '[name]',
        target,
        banner: {
            js: `import './polyfills.server.mjs';`,
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
    buildOptions.plugins.push((0, virtual_module_plugin_1.createVirtualModulePlugin)({
        namespace: mainServerNamespace,
        cache: sourceFileCache?.loadResultCache,
        loadContent: async () => {
            const contents = [
                `export { ɵConsole } from '@angular/core';`,
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
    if (options.plugins) {
        buildOptions.plugins.push(...options.plugins);
    }
    return buildOptions;
}
exports.createServerCodeBundleOptions = createServerCodeBundleOptions;
function createServerPolyfillBundleOptions(options, target, sourceFileCache) {
    const polyfills = [];
    const zoneFlagsNamespace = 'angular:zone-flags/placeholder';
    const polyfillsFromConfig = new Set(options.polyfills);
    let hasZoneJs = false;
    if (polyfillsFromConfig.has('zone.js')) {
        hasZoneJs = true;
        polyfills.push(zoneFlagsNamespace, 'zone.js/node');
    }
    if (polyfillsFromConfig.has('@angular/localize') ||
        polyfillsFromConfig.has('@angular/localize/init')) {
        polyfills.push('@angular/localize/init');
    }
    polyfills.push('@angular/platform-server/init');
    const namespace = 'angular:polyfills-server';
    const polyfillBundleOptions = getEsBuildCommonPolyfillsOptions({
        ...options,
        polyfills,
    }, namespace, false, sourceFileCache);
    if (!polyfillBundleOptions) {
        return;
    }
    const { workspaceRoot, jit, sourcemapOptions, advancedOptimizations } = options;
    const buildOptions = {
        ...polyfillBundleOptions,
        platform: 'node',
        outExtension: { '.js': '.mjs' },
        // Note: `es2015` is needed for RxJS v6. If not specified, `module` would
        // match and the ES5 distribution would be bundled and ends up breaking at
        // runtime with the RxJS testing library.
        // More details: https://github.com/angular/angular-cli/issues/25405.
        mainFields: ['es2020', 'es2015', 'module', 'main'],
        entryNames: '[name]',
        banner: {
            js: [
                // Note: Needed as esbuild does not provide require shims / proxy from ESModules.
                // See: https://github.com/evanw/esbuild/issues/1921.
                `import { createRequire } from 'node:module';`,
                `globalThis['require'] ??= createRequire(import.meta.url);`,
            ].join('\n'),
        },
        target,
        entryPoints: {
            'polyfills.server': namespace,
        },
    };
    buildOptions.plugins ??= [];
    // Disable Zone.js uncaught promise rejections to provide cleaner stacktraces.
    if (hasZoneJs) {
        buildOptions.plugins.unshift((0, virtual_module_plugin_1.createVirtualModulePlugin)({
            namespace: zoneFlagsNamespace,
            entryPointOnly: false,
            loadContent: () => ({
                contents: `globalThis.__zone_symbol__DISABLE_WRAPPING_UNCAUGHT_PROMISE_REJECTION = true;`,
                loader: 'js',
                resolveDir: workspaceRoot,
            }),
        }));
    }
    buildOptions.plugins.push((0, rxjs_esm_resolution_plugin_1.createRxjsEsmResolutionPlugin)(), (0, javascript_transfomer_plugin_1.createJavaScriptTransformerPlugin)({
        jit,
        sourcemap: !!sourcemapOptions.scripts,
        babelFileCache: sourceFileCache?.babelFileCache,
        advancedOptimizations,
        maxWorkers: 1,
    }));
    return buildOptions;
}
exports.createServerPolyfillBundleOptions = createServerPolyfillBundleOptions;
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
        publicPath: options.publicPath,
    };
}
function getEsBuildCommonPolyfillsOptions(options, namespace, tryToResolvePolyfillsAsRelative, sourceFileCache) {
    const { jit, workspaceRoot, i18nOptions } = options;
    const buildOptions = {
        ...getEsBuildCommonOptions(options),
        splitting: false,
        plugins: [(0, sourcemap_ignorelist_plugin_1.createSourcemapIgnorelistPlugin)()],
    };
    const polyfills = options.polyfills ? [...options.polyfills] : [];
    // Angular JIT mode requires the runtime compiler
    if (jit) {
        polyfills.unshift('@angular/compiler');
    }
    // Add Angular's global locale data if i18n options are present.
    // Locale data should go first so that project provided polyfill code can augment if needed.
    let needLocaleDataPlugin = false;
    if (i18nOptions.shouldInline) {
        // When inlining, a placeholder is used to allow the post-processing step to inject the $localize locale identifier
        polyfills.unshift('angular:locale/placeholder');
        buildOptions.plugins?.push((0, virtual_module_plugin_1.createVirtualModulePlugin)({
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
        for (const locale of i18nOptions.inlineLocales) {
            polyfills.unshift(`angular:locale/data:${locale}`);
        }
        needLocaleDataPlugin = true;
    }
    else if (i18nOptions.hasDefinedSourceLocale) {
        // When not inlining and a source local is present, use the source locale data directly
        polyfills.unshift(`angular:locale/data:${i18nOptions.sourceLocale}`);
        needLocaleDataPlugin = true;
    }
    if (needLocaleDataPlugin) {
        buildOptions.plugins?.push((0, i18n_locale_plugin_1.createAngularLocaleDataPlugin)());
    }
    if (polyfills.length === 0) {
        return;
    }
    buildOptions.plugins?.push((0, virtual_module_plugin_1.createVirtualModulePlugin)({
        namespace,
        cache: sourceFileCache?.loadResultCache,
        loadContent: async (_, build) => {
            let hasLocalizePolyfill = false;
            let polyfillPaths = polyfills;
            if (tryToResolvePolyfillsAsRelative) {
                polyfillPaths = await Promise.all(polyfills.map(async (path) => {
                    hasLocalizePolyfill ||= path.startsWith('@angular/localize');
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
            }
            else {
                hasLocalizePolyfill = polyfills.some((p) => p.startsWith('@angular/localize'));
            }
            if (!i18nOptions.shouldInline && !hasLocalizePolyfill) {
                const result = await build.resolve('@angular/localize', {
                    kind: 'import-statement',
                    resolveDir: workspaceRoot,
                });
                if (result.path) {
                    polyfillPaths.push('@angular/localize/init');
                }
            }
            // Generate module contents with an import statement per defined polyfill
            let contents = polyfillPaths
                .map((file) => `import '${file.replace(/\\/g, '/')}';`)
                .join('\n');
            // If not inlining translations and source locale is defined, inject the locale specifier
            if (!i18nOptions.shouldInline && i18nOptions.hasDefinedSourceLocale) {
                contents += `(globalThis.$localize ??= {}).locale = "${i18nOptions.sourceLocale}";\n`;
            }
            return {
                contents,
                loader: 'js',
                resolveDir: workspaceRoot,
            };
        },
    }));
    return buildOptions;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24tY29kZS1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FwcGxpY2F0aW9uLWNvZGUtYnVuZGxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw2Q0FBeUM7QUFDekMsK0NBQTRDO0FBQzVDLHlDQUEwQztBQUUxQyx5RUFBOEQ7QUFDOUQsK0RBQWlFO0FBRWpFLHVFQUF3RTtBQUN4RSw2REFBcUU7QUFDckUsaUZBQW1GO0FBQ25GLDZFQUE2RTtBQUM3RSwrRUFBZ0Y7QUFDaEYsbUNBQTRDO0FBQzVDLG1FQUFvRTtBQUVwRSxTQUFnQiw4QkFBOEIsQ0FDNUMsT0FBMEMsRUFDMUMsTUFBZ0IsRUFDaEIsZUFBaUM7SUFFakMsTUFBTSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsR0FBRyxPQUFPLENBQUM7SUFFN0MsTUFBTSxFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQUUsR0FBRyxJQUFBLHFEQUEyQixFQUNqRSxPQUFPLEVBQ1AsTUFBTSxFQUNOLGVBQWUsQ0FDaEIsQ0FBQztJQUVGLE1BQU0sWUFBWSxHQUFpQjtRQUNqQyxHQUFHLHVCQUF1QixDQUFDLE9BQU8sQ0FBQztRQUNuQyxRQUFRLEVBQUUsU0FBUztRQUNuQix5RUFBeUU7UUFDekUsMEVBQTBFO1FBQzFFLHlDQUF5QztRQUN6QyxxRUFBcUU7UUFDckUsVUFBVSxFQUFFLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQztRQUM3RCxVQUFVLEVBQUUsV0FBVyxDQUFDLE9BQU87UUFDL0IsV0FBVztRQUNYLE1BQU07UUFDTixTQUFTLEVBQUUsSUFBQSx5QkFBaUIsRUFBQyxNQUFNLENBQUM7UUFDcEMs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QUFDLENBQUMsQ0FBQzthQUNoRjtZQUVELElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxJQUFJLENBQUMsbUJBQW1CLEVBQUU7Z0JBQ3JELE1BQU0sTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsRUFBRTtvQkFDdEQsSUFBSSxFQUFFLGtCQUFrQjtvQkFDeEIsVUFBVSxFQUFFLGFBQWE7aUJBQzFCLENBQUMsQ0FBQztnQkFFSCxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUU7b0JBQ2YsYUFBYSxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO2lCQUM5QzthQUNGO1lBRUQseUVBQXlFO1lBQ3pFLElBQUksUUFBUSxHQUFHLGFBQWE7aUJBQ3pCLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsV0FBVyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDO2lCQUN0RCxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFZCx5RkFBeUY7WUFDekYsSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLElBQUksV0FBVyxDQUFDLHNCQUFzQixFQUFFO2dCQUNuRSxRQUFRLElBQUksMkNBQTJDLFdBQVcsQ0FBQyxZQUFZLE1BQU0sQ0FBQzthQUN2RjtZQUVELE9BQU87Z0JBQ0wsUUFBUTtnQkFDUixNQUFNLEVBQUUsSUFBSTtnQkFDWixVQUFVLEVBQUUsYUFBYTthQUMxQixDQUFDO1FBQ0osQ0FBQztLQUNGLENBQUMsQ0FDSCxDQUFDO0lBRUYsT0FBTyxZQUFZLENBQUM7QUFDdEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkT3B0aW9ucyB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnbm9kZTpjcnlwdG8nO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IGV4dG5hbWUsIGpvaW4gfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHR5cGUgeyBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMgfSBmcm9tICcuLi8uLi9idWlsZGVycy9hcHBsaWNhdGlvbi9vcHRpb25zJztcbmltcG9ydCB7IGFsbG93TWFuZ2xlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBjcmVhdGVDb21waWxlclBsdWdpbiB9IGZyb20gJy4vYW5ndWxhci9jb21waWxlci1wbHVnaW4nO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlIH0gZnJvbSAnLi9hbmd1bGFyL3NvdXJjZS1maWxlLWNhY2hlJztcbmltcG9ydCB7IGNyZWF0ZUNvbXBpbGVyUGx1Z2luT3B0aW9ucyB9IGZyb20gJy4vY29tcGlsZXItcGx1Z2luLW9wdGlvbnMnO1xuaW1wb3J0IHsgY3JlYXRlQW5ndWxhckxvY2FsZURhdGFQbHVnaW4gfSBmcm9tICcuL2kxOG4tbG9jYWxlLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVKYXZhU2NyaXB0VHJhbnNmb3JtZXJQbHVnaW4gfSBmcm9tICcuL2phdmFzY3JpcHQtdHJhbnNmb21lci1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlUnhqc0VzbVJlc29sdXRpb25QbHVnaW4gfSBmcm9tICcuL3J4anMtZXNtLXJlc29sdXRpb24tcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZVNvdXJjZW1hcElnbm9yZWxpc3RQbHVnaW4gfSBmcm9tICcuL3NvdXJjZW1hcC1pZ25vcmVsaXN0LXBsdWdpbic7XG5pbXBvcnQgeyBnZXRGZWF0dXJlU3VwcG9ydCB9IGZyb20gJy4vdXRpbHMnO1xuaW1wb3J0IHsgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbiB9IGZyb20gJy4vdmlydHVhbC1tb2R1bGUtcGx1Z2luJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUJyb3dzZXJDb2RlQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7IGVudHJ5UG9pbnRzLCBvdXRwdXROYW1lcyB9ID0gb3B0aW9ucztcblxuICBjb25zdCB7IHBsdWdpbk9wdGlvbnMsIHN0eWxlT3B0aW9ucyB9ID0gY3JlYXRlQ29tcGlsZXJQbHVnaW5PcHRpb25zKFxuICAgIG9wdGlvbnMsXG4gICAgdGFyZ2V0LFxuICAgIHNvdXJjZUZpbGVDYWNoZSxcbiAgKTtcblxuICBjb25zdCBidWlsZE9wdGlvbnM6IEJ1aWxkT3B0aW9ucyA9IHtcbiAgICAuLi5nZXRFc0J1aWxkQ29tbW9uT3B0aW9ucyhvcHRpb25zKSxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIC8vIE5vdGU6IGBlczIwMTVgIGlzIG5lZWRlZCBmb3IgUnhKUyB2Ni4gSWYgbm90IHNwZWNpZmllZCwgYG1vZHVsZWAgd291bGRcbiAgICAvLyBtYXRjaCBhbmQgdGhlIEVTNSBkaXN0cmlidXRpb24gd291bGQgYmUgYnVuZGxlZCBhbmQgZW5kcyB1cCBicmVha2luZyBhdFxuICAgIC8vIHJ1bnRpbWUgd2l0aCB0aGUgUnhKUyB0ZXN0aW5nIGxpYnJhcnkuXG4gICAgLy8gTW9yZSBkZXRhaWxzOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMjU0MDUuXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnZXMyMDE1JywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICBlbnRyeU5hbWVzOiBvdXRwdXROYW1lcy5idW5kbGVzLFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIHRhcmdldCxcbiAgICBzdXBwb3J0ZWQ6IGdldEZlYXR1cmVTdXBwb3J0KHRhcmdldCksXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlU291cmNlbWFwSWdub3JlbGlzdFBsdWdpbigpLFxuICAgICAgY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gICAgICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICAgICAgcGx1Z2luT3B0aW9ucyxcbiAgICAgICAgLy8gQ29tcG9uZW50IHN0eWxlc2hlZXQgb3B0aW9uc1xuICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICApLFxuICAgIF0sXG4gIH07XG5cbiAgaWYgKG9wdGlvbnMuZXh0ZXJuYWxQYWNrYWdlcykge1xuICAgIGJ1aWxkT3B0aW9ucy5wYWNrYWdlcyA9ICdleHRlcm5hbCc7XG4gIH1cblxuICBpZiAob3B0aW9ucy5wbHVnaW5zKSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnM/LnB1c2goLi4ub3B0aW9ucy5wbHVnaW5zKTtcbiAgfVxuXG4gIHJldHVybiBidWlsZE9wdGlvbnM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVCcm93c2VyUG9seWZpbGxCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZSxcbik6IEJ1aWxkT3B0aW9ucyB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IG5hbWVzcGFjZSA9ICdhbmd1bGFyOnBvbHlmaWxscyc7XG4gIGNvbnN0IHBvbHlmaWxsQnVuZGxlT3B0aW9ucyA9IGdldEVzQnVpbGRDb21tb25Qb2x5ZmlsbHNPcHRpb25zKFxuICAgIG9wdGlvbnMsXG4gICAgbmFtZXNwYWNlLFxuICAgIHRydWUsXG4gICAgc291cmNlRmlsZUNhY2hlLFxuICApO1xuICBpZiAoIXBvbHlmaWxsQnVuZGxlT3B0aW9ucykge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHsgb3V0cHV0TmFtZXMgfSA9IG9wdGlvbnM7XG4gIGNvbnN0IHsgcGx1Z2luT3B0aW9ucywgc3R5bGVPcHRpb25zIH0gPSBjcmVhdGVDb21waWxlclBsdWdpbk9wdGlvbnMoXG4gICAgb3B0aW9ucyxcbiAgICB0YXJnZXQsXG4gICAgc291cmNlRmlsZUNhY2hlLFxuICApO1xuXG4gIGNvbnN0IGJ1aWxkT3B0aW9uczogQnVpbGRPcHRpb25zID0ge1xuICAgIC4uLnBvbHlmaWxsQnVuZGxlT3B0aW9ucyxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIC8vIE5vdGU6IGBlczIwMTVgIGlzIG5lZWRlZCBmb3IgUnhKUyB2Ni4gSWYgbm90IHNwZWNpZmllZCwgYG1vZHVsZWAgd291bGRcbiAgICAvLyBtYXRjaCBhbmQgdGhlIEVTNSBkaXN0cmlidXRpb24gd291bGQgYmUgYnVuZGxlZCBhbmQgZW5kcyB1cCBicmVha2luZyBhdFxuICAgIC8vIHJ1bnRpbWUgd2l0aCB0aGUgUnhKUyB0ZXN0aW5nIGxpYnJhcnkuXG4gICAgLy8gTW9yZSBkZXRhaWxzOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMjU0MDUuXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnZXMyMDE1JywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICBlbnRyeU5hbWVzOiBvdXRwdXROYW1lcy5idW5kbGVzLFxuICAgIHRhcmdldCxcbiAgICBlbnRyeVBvaW50czoge1xuICAgICAgJ3BvbHlmaWxscyc6IG5hbWVzcGFjZSxcbiAgICB9LFxuICB9O1xuXG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zID8/PSBbXTtcbiAgYnVpbGRPcHRpb25zLnBsdWdpbnMucHVzaChcbiAgICBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICAgIHsgLi4ucGx1Z2luT3B0aW9ucywgbm9vcFR5cGVTY3JpcHRDb21waWxhdGlvbjogdHJ1ZSB9LFxuICAgICAgLy8gQ29tcG9uZW50IHN0eWxlc2hlZXQgb3B0aW9ucyBhcmUgdW51c2VkIGZvciBwb2x5ZmlsbHMgYnV0IHJlcXVpcmVkIGJ5IHRoZSBwbHVnaW5cbiAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICApLFxuICApO1xuXG4gIHJldHVybiBidWlsZE9wdGlvbnM7XG59XG5cbi8qKlxuICogQ3JlYXRlIGFuIGVzYnVpbGQgJ2J1aWxkJyBvcHRpb25zIG9iamVjdCBmb3IgdGhlIHNlcnZlciBidW5kbGUuXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgYnVpbGRlcidzIHVzZXItcHJvdmlkZXIgbm9ybWFsaXplZCBvcHRpb25zLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBCdWlsZE9wdGlvbnMgb2JqZWN0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2VydmVyQ29kZUJ1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyxcbiAgdGFyZ2V0OiBzdHJpbmdbXSxcbiAgc291cmNlRmlsZUNhY2hlOiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7XG4gICAgaml0LFxuICAgIHNlcnZlckVudHJ5UG9pbnQsXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBzc3JPcHRpb25zLFxuICAgIHdhdGNoLFxuICAgIGV4dGVybmFsUGFja2FnZXMsXG4gICAgcHJlcmVuZGVyT3B0aW9ucyxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgYXNzZXJ0KFxuICAgIHNlcnZlckVudHJ5UG9pbnQsXG4gICAgJ2NyZWF0ZVNlcnZlckNvZGVCdW5kbGVPcHRpb25zIHNob3VsZCBub3QgYmUgY2FsbGVkIHdpdGhvdXQgYSBkZWZpbmVkIHNlcnZlckVudHJ5UG9pbnQuJyxcbiAgKTtcblxuICBjb25zdCB7IHBsdWdpbk9wdGlvbnMsIHN0eWxlT3B0aW9ucyB9ID0gY3JlYXRlQ29tcGlsZXJQbHVnaW5PcHRpb25zKFxuICAgIG9wdGlvbnMsXG4gICAgdGFyZ2V0LFxuICAgIHNvdXJjZUZpbGVDYWNoZSxcbiAgKTtcblxuICBjb25zdCBtYWluU2VydmVyTmFtZXNwYWNlID0gJ2FuZ3VsYXI6c2VydmVyLXJlbmRlci11dGlscyc7XG4gIGNvbnN0IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICdyZW5kZXItdXRpbHMuc2VydmVyJzogbWFpblNlcnZlck5hbWVzcGFjZSxcbiAgICAnbWFpbi5zZXJ2ZXInOiBzZXJ2ZXJFbnRyeVBvaW50LFxuICB9O1xuXG4gIGNvbnN0IHNzckVudHJ5UG9pbnQgPSBzc3JPcHRpb25zPy5lbnRyeTtcbiAgaWYgKHNzckVudHJ5UG9pbnQpIHtcbiAgICBlbnRyeVBvaW50c1snc2VydmVyJ10gPSBzc3JFbnRyeVBvaW50O1xuICB9XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zOiBCdWlsZE9wdGlvbnMgPSB7XG4gICAgLi4uZ2V0RXNCdWlsZENvbW1vbk9wdGlvbnMob3B0aW9ucyksXG4gICAgcGxhdGZvcm06ICdub2RlJyxcbiAgICBzcGxpdHRpbmc6IHRydWUsXG4gICAgb3V0RXh0ZW5zaW9uOiB7ICcuanMnOiAnLm1qcycgfSxcbiAgICAvLyBOb3RlOiBgZXMyMDE1YCBpcyBuZWVkZWQgZm9yIFJ4SlMgdjYuIElmIG5vdCBzcGVjaWZpZWQsIGBtb2R1bGVgIHdvdWxkXG4gICAgLy8gbWF0Y2ggYW5kIHRoZSBFUzUgZGlzdHJpYnV0aW9uIHdvdWxkIGJlIGJ1bmRsZWQgYW5kIGVuZHMgdXAgYnJlYWtpbmcgYXRcbiAgICAvLyBydW50aW1lIHdpdGggdGhlIFJ4SlMgdGVzdGluZyBsaWJyYXJ5LlxuICAgIC8vIE1vcmUgZGV0YWlsczogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzI1NDA1LlxuICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgIGVudHJ5TmFtZXM6ICdbbmFtZV0nLFxuICAgIHRhcmdldCxcbiAgICBiYW5uZXI6IHtcbiAgICAgIGpzOiBgaW1wb3J0ICcuL3BvbHlmaWxscy5zZXJ2ZXIubWpzJztgLFxuICAgIH0sXG4gICAgZW50cnlQb2ludHMsXG4gICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNvdXJjZW1hcElnbm9yZWxpc3RQbHVnaW4oKSxcbiAgICAgIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICAgICAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgICAgIHsgLi4ucGx1Z2luT3B0aW9ucywgbm9vcFR5cGVTY3JpcHRDb21waWxhdGlvbjogdHJ1ZSB9LFxuICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzaGVldCBvcHRpb25zXG4gICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICksXG4gICAgXSxcbiAgfTtcblxuICBidWlsZE9wdGlvbnMucGx1Z2lucyA/Pz0gW107XG4gIGlmIChleHRlcm5hbFBhY2thZ2VzKSB7XG4gICAgYnVpbGRPcHRpb25zLnBhY2thZ2VzID0gJ2V4dGVybmFsJztcbiAgfSBlbHNlIHtcbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKGNyZWF0ZVJ4anNFc21SZXNvbHV0aW9uUGx1Z2luKCkpO1xuICB9XG5cbiAgYnVpbGRPcHRpb25zLnBsdWdpbnMucHVzaChcbiAgICBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luKHtcbiAgICAgIG5hbWVzcGFjZTogbWFpblNlcnZlck5hbWVzcGFjZSxcbiAgICAgIGNhY2hlOiBzb3VyY2VGaWxlQ2FjaGU/LmxvYWRSZXN1bHRDYWNoZSxcbiAgICAgIGxvYWRDb250ZW50OiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnRzOiBzdHJpbmdbXSA9IFtcbiAgICAgICAgICBgZXhwb3J0IHsgybVDb25zb2xlIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7YCxcbiAgICAgICAgICBgZXhwb3J0IHsgcmVuZGVyQXBwbGljYXRpb24sIHJlbmRlck1vZHVsZSwgybVTRVJWRVJfQ09OVEVYVCB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcic7YCxcbiAgICAgICAgXTtcblxuICAgICAgICBpZiAod2F0Y2gpIHtcbiAgICAgICAgICBjb250ZW50cy5wdXNoKGBleHBvcnQgeyDJtXJlc2V0Q29tcGlsZWRDb21wb25lbnRzIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7YCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocHJlcmVuZGVyT3B0aW9ucz8uZGlzY292ZXJSb3V0ZXMpIHtcbiAgICAgICAgICAvLyBXZSBkbyBub3QgaW1wb3J0IGl0IGRpcmVjdGx5IHNvIHRoYXQgbm9kZS5qcyBtb2R1bGVzIGFyZSByZXNvbHZlZCB1c2luZyB0aGUgY29ycmVjdCBjb250ZXh0LlxuICAgICAgICAgIGNvbnN0IHJvdXRlc0V4dHJhY3RvckNvZGUgPSBhd2FpdCByZWFkRmlsZShcbiAgICAgICAgICAgIGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vdXRpbHMvcm91dGVzLWV4dHJhY3Rvci9leHRyYWN0b3IuanMnKSxcbiAgICAgICAgICAgICd1dGYtOCcsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIC8vIFJlbW92ZSBzb3VyY2UgbWFwIFVSTCBjb21tZW50cyBmcm9tIHRoZSBjb2RlIGlmIGEgc291cmNlbWFwIGlzIHByZXNlbnQgYXMgdGhpcyB3aWxsIG5vdCBtYXRjaCB0aGUgZmlsZS5cbiAgICAgICAgICBjb250ZW50cy5wdXNoKHJvdXRlc0V4dHJhY3RvckNvZGUucmVwbGFjZSgvXlxcL1xcLyMgc291cmNlTWFwcGluZ1VSTD1bXlxcclxcbl0qL2dtLCAnJykpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50czogY29udGVudHMuam9pbignXFxuJyksXG4gICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgIH0pLFxuICApO1xuXG4gIGlmIChvcHRpb25zLnBsdWdpbnMpIHtcbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKC4uLm9wdGlvbnMucGx1Z2lucyk7XG4gIH1cblxuICByZXR1cm4gYnVpbGRPcHRpb25zO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2VydmVyUG9seWZpbGxCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZSxcbik6IEJ1aWxkT3B0aW9ucyB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IHBvbHlmaWxsczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgem9uZUZsYWdzTmFtZXNwYWNlID0gJ2FuZ3VsYXI6em9uZS1mbGFncy9wbGFjZWhvbGRlcic7XG4gIGNvbnN0IHBvbHlmaWxsc0Zyb21Db25maWcgPSBuZXcgU2V0KG9wdGlvbnMucG9seWZpbGxzKTtcbiAgbGV0IGhhc1pvbmVKcyA9IGZhbHNlO1xuXG4gIGlmIChwb2x5ZmlsbHNGcm9tQ29uZmlnLmhhcygnem9uZS5qcycpKSB7XG4gICAgaGFzWm9uZUpzID0gdHJ1ZTtcbiAgICBwb2x5ZmlsbHMucHVzaCh6b25lRmxhZ3NOYW1lc3BhY2UsICd6b25lLmpzL25vZGUnKTtcbiAgfVxuXG4gIGlmIChcbiAgICBwb2x5ZmlsbHNGcm9tQ29uZmlnLmhhcygnQGFuZ3VsYXIvbG9jYWxpemUnKSB8fFxuICAgIHBvbHlmaWxsc0Zyb21Db25maWcuaGFzKCdAYW5ndWxhci9sb2NhbGl6ZS9pbml0JylcbiAgKSB7XG4gICAgcG9seWZpbGxzLnB1c2goJ0Bhbmd1bGFyL2xvY2FsaXplL2luaXQnKTtcbiAgfVxuXG4gIHBvbHlmaWxscy5wdXNoKCdAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXIvaW5pdCcpO1xuXG4gIGNvbnN0IG5hbWVzcGFjZSA9ICdhbmd1bGFyOnBvbHlmaWxscy1zZXJ2ZXInO1xuICBjb25zdCBwb2x5ZmlsbEJ1bmRsZU9wdGlvbnMgPSBnZXRFc0J1aWxkQ29tbW9uUG9seWZpbGxzT3B0aW9ucyhcbiAgICB7XG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgcG9seWZpbGxzLFxuICAgIH0sXG4gICAgbmFtZXNwYWNlLFxuICAgIGZhbHNlLFxuICAgIHNvdXJjZUZpbGVDYWNoZSxcbiAgKTtcblxuICBpZiAoIXBvbHlmaWxsQnVuZGxlT3B0aW9ucykge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHsgd29ya3NwYWNlUm9vdCwgaml0LCBzb3VyY2VtYXBPcHRpb25zLCBhZHZhbmNlZE9wdGltaXphdGlvbnMgfSA9IG9wdGlvbnM7XG4gIGNvbnN0IGJ1aWxkT3B0aW9uczogQnVpbGRPcHRpb25zID0ge1xuICAgIC4uLnBvbHlmaWxsQnVuZGxlT3B0aW9ucyxcbiAgICBwbGF0Zm9ybTogJ25vZGUnLFxuICAgIG91dEV4dGVuc2lvbjogeyAnLmpzJzogJy5tanMnIH0sXG4gICAgLy8gTm90ZTogYGVzMjAxNWAgaXMgbmVlZGVkIGZvciBSeEpTIHY2LiBJZiBub3Qgc3BlY2lmaWVkLCBgbW9kdWxlYCB3b3VsZFxuICAgIC8vIG1hdGNoIGFuZCB0aGUgRVM1IGRpc3RyaWJ1dGlvbiB3b3VsZCBiZSBidW5kbGVkIGFuZCBlbmRzIHVwIGJyZWFraW5nIGF0XG4gICAgLy8gcnVudGltZSB3aXRoIHRoZSBSeEpTIHRlc3RpbmcgbGlicmFyeS5cbiAgICAvLyBNb3JlIGRldGFpbHM6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNTQwNS5cbiAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICBlbnRyeU5hbWVzOiAnW25hbWVdJyxcbiAgICBiYW5uZXI6IHtcbiAgICAgIGpzOiBbXG4gICAgICAgIC8vIE5vdGU6IE5lZWRlZCBhcyBlc2J1aWxkIGRvZXMgbm90IHByb3ZpZGUgcmVxdWlyZSBzaGltcyAvIHByb3h5IGZyb20gRVNNb2R1bGVzLlxuICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9ldmFudy9lc2J1aWxkL2lzc3Vlcy8xOTIxLlxuICAgICAgICBgaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJztgLFxuICAgICAgICBgZ2xvYmFsVGhpc1sncmVxdWlyZSddID8/PSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybCk7YCxcbiAgICAgIF0uam9pbignXFxuJyksXG4gICAgfSxcbiAgICB0YXJnZXQsXG4gICAgZW50cnlQb2ludHM6IHtcbiAgICAgICdwb2x5ZmlsbHMuc2VydmVyJzogbmFtZXNwYWNlLFxuICAgIH0sXG4gIH07XG5cbiAgYnVpbGRPcHRpb25zLnBsdWdpbnMgPz89IFtdO1xuXG4gIC8vIERpc2FibGUgWm9uZS5qcyB1bmNhdWdodCBwcm9taXNlIHJlamVjdGlvbnMgdG8gcHJvdmlkZSBjbGVhbmVyIHN0YWNrdHJhY2VzLlxuICBpZiAoaGFzWm9uZUpzKSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnMudW5zaGlmdChcbiAgICAgIGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW4oe1xuICAgICAgICBuYW1lc3BhY2U6IHpvbmVGbGFnc05hbWVzcGFjZSxcbiAgICAgICAgZW50cnlQb2ludE9ubHk6IGZhbHNlLFxuICAgICAgICBsb2FkQ29udGVudDogKCkgPT4gKHtcbiAgICAgICAgICBjb250ZW50czogYGdsb2JhbFRoaXMuX196b25lX3N5bWJvbF9fRElTQUJMRV9XUkFQUElOR19VTkNBVUdIVF9QUk9NSVNFX1JFSkVDVElPTiA9IHRydWU7YCxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgfSksXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgYnVpbGRPcHRpb25zLnBsdWdpbnMucHVzaChcbiAgICBjcmVhdGVSeGpzRXNtUmVzb2x1dGlvblBsdWdpbigpLFxuICAgIGNyZWF0ZUphdmFTY3JpcHRUcmFuc2Zvcm1lclBsdWdpbih7XG4gICAgICBqaXQsXG4gICAgICBzb3VyY2VtYXA6ICEhc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzLFxuICAgICAgYmFiZWxGaWxlQ2FjaGU6IHNvdXJjZUZpbGVDYWNoZT8uYmFiZWxGaWxlQ2FjaGUsXG4gICAgICBhZHZhbmNlZE9wdGltaXphdGlvbnMsXG4gICAgICBtYXhXb3JrZXJzOiAxLFxuICAgIH0pLFxuICApO1xuXG4gIHJldHVybiBidWlsZE9wdGlvbnM7XG59XG5cbmZ1bmN0aW9uIGdldEVzQnVpbGRDb21tb25PcHRpb25zKG9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyk6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHtcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG91dEV4dGVuc2lvbixcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBqaXQsXG4gIH0gPSBvcHRpb25zO1xuXG4gIC8vIEVuc3VyZSB1bmlxdWUgaGFzaGVzIGZvciBpMThuIHRyYW5zbGF0aW9uIGNoYW5nZXMgd2hlbiB1c2luZyBwb3N0LXByb2Nlc3MgaW5saW5pbmcuXG4gIC8vIFRoaXMgaGFzaCB2YWx1ZSBpcyBhZGRlZCBhcyBhIGZvb3RlciB0byBlYWNoIGZpbGUgYW5kIGVuc3VyZXMgdGhhdCB0aGUgb3V0cHV0IGZpbGUgbmFtZXMgKHdpdGggaGFzaGVzKVxuICAvLyBjaGFuZ2Ugd2hlbiB0cmFuc2xhdGlvbiBmaWxlcyBoYXZlIGNoYW5nZWQuIElmIHRoaXMgaXMgbm90IGRvbmUgdGhlIHBvc3QgcHJvY2Vzc2VkIGZpbGVzIG1heSBoYXZlXG4gIC8vIGRpZmZlcmVudCBjb250ZW50IGJ1dCB3b3VsZCByZXRhaW4gaWRlbnRpY2FsIHByb2R1Y3Rpb24gZmlsZSBuYW1lcyB3aGljaCB3b3VsZCBsZWFkIHRvIGJyb3dzZXIgY2FjaGluZyBwcm9ibGVtcy5cbiAgbGV0IGZvb3RlcjtcbiAgaWYgKG9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgLy8gVXBkYXRlIGZpbGUgaGFzaGVzIHRvIGluY2x1ZGUgdHJhbnNsYXRpb24gZmlsZSBjb250ZW50XG4gICAgY29uc3QgaTE4bkhhc2ggPSBPYmplY3QudmFsdWVzKG9wdGlvbnMuaTE4bk9wdGlvbnMubG9jYWxlcykucmVkdWNlKFxuICAgICAgKGRhdGEsIGxvY2FsZSkgPT4gZGF0YSArIGxvY2FsZS5maWxlcy5tYXAoKGZpbGUpID0+IGZpbGUuaW50ZWdyaXR5IHx8ICcnKS5qb2luKCd8JyksXG4gICAgICAnJyxcbiAgICApO1xuXG4gICAgZm9vdGVyID0geyBqczogYC8qKmkxOG46JHtjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoaTE4bkhhc2gpLmRpZ2VzdCgnaGV4Jyl9Ki9gIH07XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGFic1dvcmtpbmdEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgYnVuZGxlOiB0cnVlLFxuICAgIGZvcm1hdDogJ2VzbScsXG4gICAgYXNzZXROYW1lczogb3V0cHV0TmFtZXMubWVkaWEsXG4gICAgY29uZGl0aW9uczogWydlczIwMjAnLCAnZXMyMDE1JywgJ21vZHVsZSddLFxuICAgIHJlc29sdmVFeHRlbnNpb25zOiBbJy50cycsICcudHN4JywgJy5tanMnLCAnLmpzJ10sXG4gICAgbWV0YWZpbGU6IHRydWUsXG4gICAgbGVnYWxDb21tZW50czogb3B0aW9ucy5leHRyYWN0TGljZW5zZXMgPyAnbm9uZScgOiAnZW9mJyxcbiAgICBsb2dMZXZlbDogb3B0aW9ucy52ZXJib3NlID8gJ2RlYnVnJyA6ICdzaWxlbnQnLFxuICAgIG1pbmlmeUlkZW50aWZpZXJzOiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgJiYgYWxsb3dNYW5nbGUsXG4gICAgbWluaWZ5U3ludGF4OiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgbWluaWZ5V2hpdGVzcGFjZTogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzLFxuICAgIHB1cmU6IFsnZm9yd2FyZFJlZiddLFxuICAgIG91dGRpcjogd29ya3NwYWNlUm9vdCxcbiAgICBvdXRFeHRlbnNpb246IG91dEV4dGVuc2lvbiA/IHsgJy5qcyc6IGAuJHtvdXRFeHRlbnNpb259YCB9IDogdW5kZWZpbmVkLFxuICAgIHNvdXJjZW1hcDogc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICBzcGxpdHRpbmc6IHRydWUsXG4gICAgY2h1bmtOYW1lczogb3B0aW9ucy5uYW1lZENodW5rcyA/ICdbbmFtZV0tW2hhc2hdJyA6ICdjaHVuay1baGFzaF0nLFxuICAgIHRzY29uZmlnLFxuICAgIGV4dGVybmFsOiBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICB3cml0ZTogZmFsc2UsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBkZWZpbmU6IHtcbiAgICAgIC8vIE9ubHkgc2V0IHRvIGZhbHNlIHdoZW4gc2NyaXB0IG9wdGltaXphdGlvbnMgYXJlIGVuYWJsZWQuIEl0IHNob3VsZCBub3QgYmUgc2V0IHRvIHRydWUgYmVjYXVzZVxuICAgICAgLy8gQW5ndWxhciB0dXJucyBgbmdEZXZNb2RlYCBpbnRvIGFuIG9iamVjdCBmb3IgZGV2ZWxvcG1lbnQgZGVidWdnaW5nIHB1cnBvc2VzIHdoZW4gbm90IGRlZmluZWRcbiAgICAgIC8vIHdoaWNoIGEgY29uc3RhbnQgdHJ1ZSB2YWx1ZSB3b3VsZCBicmVhay5cbiAgICAgIC4uLihvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgPyB7ICduZ0Rldk1vZGUnOiAnZmFsc2UnIH0gOiB1bmRlZmluZWQpLFxuICAgICAgJ25nSml0TW9kZSc6IGppdCA/ICd0cnVlJyA6ICdmYWxzZScsXG4gICAgfSxcbiAgICBmb290ZXIsXG4gICAgcHVibGljUGF0aDogb3B0aW9ucy5wdWJsaWNQYXRoLFxuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRFc0J1aWxkQ29tbW9uUG9seWZpbGxzT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zLFxuICBuYW1lc3BhY2U6IHN0cmluZyxcbiAgdHJ5VG9SZXNvbHZlUG9seWZpbGxzQXNSZWxhdGl2ZTogYm9vbGVhbixcbiAgc291cmNlRmlsZUNhY2hlOiBTb3VyY2VGaWxlQ2FjaGUgfCB1bmRlZmluZWQsXG4pOiBCdWlsZE9wdGlvbnMgfCB1bmRlZmluZWQge1xuICBjb25zdCB7IGppdCwgd29ya3NwYWNlUm9vdCwgaTE4bk9wdGlvbnMgfSA9IG9wdGlvbnM7XG4gIGNvbnN0IGJ1aWxkT3B0aW9uczogQnVpbGRPcHRpb25zID0ge1xuICAgIC4uLmdldEVzQnVpbGRDb21tb25PcHRpb25zKG9wdGlvbnMpLFxuICAgIHNwbGl0dGluZzogZmFsc2UsXG4gICAgcGx1Z2luczogW2NyZWF0ZVNvdXJjZW1hcElnbm9yZWxpc3RQbHVnaW4oKV0sXG4gIH07XG5cbiAgY29uc3QgcG9seWZpbGxzID0gb3B0aW9ucy5wb2x5ZmlsbHMgPyBbLi4ub3B0aW9ucy5wb2x5ZmlsbHNdIDogW107XG5cbiAgLy8gQW5ndWxhciBKSVQgbW9kZSByZXF1aXJlcyB0aGUgcnVudGltZSBjb21waWxlclxuICBpZiAoaml0KSB7XG4gICAgcG9seWZpbGxzLnVuc2hpZnQoJ0Bhbmd1bGFyL2NvbXBpbGVyJyk7XG4gIH1cblxuICAvLyBBZGQgQW5ndWxhcidzIGdsb2JhbCBsb2NhbGUgZGF0YSBpZiBpMThuIG9wdGlvbnMgYXJlIHByZXNlbnQuXG4gIC8vIExvY2FsZSBkYXRhIHNob3VsZCBnbyBmaXJzdCBzbyB0aGF0IHByb2plY3QgcHJvdmlkZWQgcG9seWZpbGwgY29kZSBjYW4gYXVnbWVudCBpZiBuZWVkZWQuXG4gIGxldCBuZWVkTG9jYWxlRGF0YVBsdWdpbiA9IGZhbHNlO1xuICBpZiAoaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgLy8gV2hlbiBpbmxpbmluZywgYSBwbGFjZWhvbGRlciBpcyB1c2VkIHRvIGFsbG93IHRoZSBwb3N0LXByb2Nlc3Npbmcgc3RlcCB0byBpbmplY3QgdGhlICRsb2NhbGl6ZSBsb2NhbGUgaWRlbnRpZmllclxuICAgIHBvbHlmaWxscy51bnNoaWZ0KCdhbmd1bGFyOmxvY2FsZS9wbGFjZWhvbGRlcicpO1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zPy5wdXNoKFxuICAgICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICAgIG5hbWVzcGFjZTogJ2FuZ3VsYXI6bG9jYWxlL3BsYWNlaG9sZGVyJyxcbiAgICAgICAgZW50cnlQb2ludE9ubHk6IGZhbHNlLFxuICAgICAgICBsb2FkQ29udGVudDogKCkgPT4gKHtcbiAgICAgICAgICBjb250ZW50czogYChnbG9iYWxUaGlzLiRsb2NhbGl6ZSA/Pz0ge30pLmxvY2FsZSA9IFwiX19fTkdfTE9DQUxFX0lOU0VSVF9fX1wiO1xcbmAsXG4gICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIH0pLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIC8vIEFkZCBsb2NhbGUgZGF0YSBmb3IgYWxsIGFjdGl2ZSBsb2NhbGVzXG4gICAgLy8gVE9ETzogSW5qZWN0IGVhY2ggaW5kaXZpZHVhbGx5IHdpdGhpbiB0aGUgaW5saW5pbmcgcHJvY2VzcyBpdHNlbGZcbiAgICBmb3IgKGNvbnN0IGxvY2FsZSBvZiBpMThuT3B0aW9ucy5pbmxpbmVMb2NhbGVzKSB7XG4gICAgICBwb2x5ZmlsbHMudW5zaGlmdChgYW5ndWxhcjpsb2NhbGUvZGF0YToke2xvY2FsZX1gKTtcbiAgICB9XG4gICAgbmVlZExvY2FsZURhdGFQbHVnaW4gPSB0cnVlO1xuICB9IGVsc2UgaWYgKGkxOG5PcHRpb25zLmhhc0RlZmluZWRTb3VyY2VMb2NhbGUpIHtcbiAgICAvLyBXaGVuIG5vdCBpbmxpbmluZyBhbmQgYSBzb3VyY2UgbG9jYWwgaXMgcHJlc2VudCwgdXNlIHRoZSBzb3VyY2UgbG9jYWxlIGRhdGEgZGlyZWN0bHlcbiAgICBwb2x5ZmlsbHMudW5zaGlmdChgYW5ndWxhcjpsb2NhbGUvZGF0YToke2kxOG5PcHRpb25zLnNvdXJjZUxvY2FsZX1gKTtcbiAgICBuZWVkTG9jYWxlRGF0YVBsdWdpbiA9IHRydWU7XG4gIH1cbiAgaWYgKG5lZWRMb2NhbGVEYXRhUGx1Z2luKSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnM/LnB1c2goY3JlYXRlQW5ndWxhckxvY2FsZURhdGFQbHVnaW4oKSk7XG4gIH1cblxuICBpZiAocG9seWZpbGxzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zPy5wdXNoKFxuICAgIGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW4oe1xuICAgICAgbmFtZXNwYWNlLFxuICAgICAgY2FjaGU6IHNvdXJjZUZpbGVDYWNoZT8ubG9hZFJlc3VsdENhY2hlLFxuICAgICAgbG9hZENvbnRlbnQ6IGFzeW5jIChfLCBidWlsZCkgPT4ge1xuICAgICAgICBsZXQgaGFzTG9jYWxpemVQb2x5ZmlsbCA9IGZhbHNlO1xuICAgICAgICBsZXQgcG9seWZpbGxQYXRocyA9IHBvbHlmaWxscztcblxuICAgICAgICBpZiAodHJ5VG9SZXNvbHZlUG9seWZpbGxzQXNSZWxhdGl2ZSkge1xuICAgICAgICAgIHBvbHlmaWxsUGF0aHMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICAgIHBvbHlmaWxscy5tYXAoYXN5bmMgKHBhdGgpID0+IHtcbiAgICAgICAgICAgICAgaGFzTG9jYWxpemVQb2x5ZmlsbCB8fD0gcGF0aC5zdGFydHNXaXRoKCdAYW5ndWxhci9sb2NhbGl6ZScpO1xuICAgICAgICAgICAgICBpZiAocGF0aC5zdGFydHNXaXRoKCd6b25lLmpzJykgfHwgIWV4dG5hbWUocGF0aCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGF0aDtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IHBvdGVudGlhbFBhdGhSZWxhdGl2ZSA9ICcuLycgKyBwYXRoO1xuICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBidWlsZC5yZXNvbHZlKHBvdGVudGlhbFBhdGhSZWxhdGl2ZSwge1xuICAgICAgICAgICAgICAgIGtpbmQ6ICdpbXBvcnQtc3RhdGVtZW50JyxcbiAgICAgICAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0LnBhdGggPyBwb3RlbnRpYWxQYXRoUmVsYXRpdmUgOiBwYXRoO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBoYXNMb2NhbGl6ZVBvbHlmaWxsID0gcG9seWZpbGxzLnNvbWUoKHApID0+IHAuc3RhcnRzV2l0aCgnQGFuZ3VsYXIvbG9jYWxpemUnKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWkxOG5PcHRpb25zLnNob3VsZElubGluZSAmJiAhaGFzTG9jYWxpemVQb2x5ZmlsbCkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJ1aWxkLnJlc29sdmUoJ0Bhbmd1bGFyL2xvY2FsaXplJywge1xuICAgICAgICAgICAga2luZDogJ2ltcG9ydC1zdGF0ZW1lbnQnLFxuICAgICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGlmIChyZXN1bHQucGF0aCkge1xuICAgICAgICAgICAgcG9seWZpbGxQYXRocy5wdXNoKCdAYW5ndWxhci9sb2NhbGl6ZS9pbml0Jyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgbW9kdWxlIGNvbnRlbnRzIHdpdGggYW4gaW1wb3J0IHN0YXRlbWVudCBwZXIgZGVmaW5lZCBwb2x5ZmlsbFxuICAgICAgICBsZXQgY29udGVudHMgPSBwb2x5ZmlsbFBhdGhzXG4gICAgICAgICAgLm1hcCgoZmlsZSkgPT4gYGltcG9ydCAnJHtmaWxlLnJlcGxhY2UoL1xcXFwvZywgJy8nKX0nO2ApXG4gICAgICAgICAgLmpvaW4oJ1xcbicpO1xuXG4gICAgICAgIC8vIElmIG5vdCBpbmxpbmluZyB0cmFuc2xhdGlvbnMgYW5kIHNvdXJjZSBsb2NhbGUgaXMgZGVmaW5lZCwgaW5qZWN0IHRoZSBsb2NhbGUgc3BlY2lmaWVyXG4gICAgICAgIGlmICghaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lICYmIGkxOG5PcHRpb25zLmhhc0RlZmluZWRTb3VyY2VMb2NhbGUpIHtcbiAgICAgICAgICBjb250ZW50cyArPSBgKGdsb2JhbFRoaXMuJGxvY2FsaXplID8/PSB7fSkubG9jYWxlID0gXCIke2kxOG5PcHRpb25zLnNvdXJjZUxvY2FsZX1cIjtcXG5gO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgfSksXG4gICk7XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cbiJdfQ==