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
exports.createServerCodeBundleOptions = exports.createBrowserPolyfillBundleOptions = exports.createBrowserCodeBundleOptions = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_module_1 = require("node:module");
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
    const { workspaceRoot, outputNames, jit } = options;
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
        target,
        splitting: false,
        supported: (0, utils_1.getFeatureSupport)(target),
        plugins: [
            (0, sourcemap_ignorelist_plugin_1.createSourcemapIgnorelistPlugin)(),
            (0, compiler_plugin_1.createCompilerPlugin)(
            // JS/TS options
            { ...pluginOptions, noopTypeScriptCompilation: true }, 
            // Component stylesheet options are unused for polyfills but required by the plugin
            styleOptions),
        ],
    };
    buildOptions.plugins ??= [];
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
    if (polyfills.length === 0) {
        return;
    }
    // Add polyfill entry point if polyfills are present
    const namespace = 'angular:polyfills';
    buildOptions.entryPoints = {
        'polyfills': namespace,
    };
    buildOptions.plugins?.unshift((0, virtual_module_plugin_1.createVirtualModulePlugin)({
        namespace,
        loadContent: async (_, build) => {
            let hasLocalizePolyfill = false;
            const polyfillPaths = await Promise.all(polyfills.map(async (path) => {
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
            if (!options.i18nOptions.shouldInline && !hasLocalizePolyfill) {
                // Cannot use `build.resolve` here since it does not allow overriding the external options
                // and the actual presence of the `@angular/localize` package needs to be checked here.
                const workspaceRequire = (0, node_module_1.createRequire)(workspaceRoot + '/');
                try {
                    workspaceRequire.resolve('@angular/localize');
                    // The resolve call above will throw if not found
                    polyfillPaths.push('@angular/localize/init');
                }
                catch { }
            }
            // Generate module contents with an import statement per defined polyfill
            let contents = polyfillPaths
                .map((file) => `import '${file.replace(/\\/g, '/')}';`)
                .join('\n');
            // If not inlining translations and source locale is defined, inject the locale specifier
            if (!options.i18nOptions.shouldInline && options.i18nOptions.hasDefinedSourceLocale) {
                contents += `(globalThis.$localize ??= {}).locale = "${options.i18nOptions.sourceLocale}";\n`;
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
                `export { ɵConsole } from '@angular/core';`,
                `export { renderApplication, renderModule, ɵSERVER_CONTEXT } from '@angular/platform-server';`,
            ];
            if (watch) {
                contents.push(`export { ɵresetCompiledComponents } from '@angular/core';`);
            }
            if (!options.i18nOptions.shouldInline) {
                // Cannot use `build.resolve` here since it does not allow overriding the external options
                // and the actual presence of the `@angular/localize` package needs to be checked here.
                const workspaceRequire = (0, node_module_1.createRequire)(workspaceRoot + '/');
                try {
                    workspaceRequire.resolve('@angular/localize');
                    // The resolve call above will throw if not found
                    contents.push(`import '@angular/localize/init';`);
                }
                catch { }
            }
            if (options.i18nOptions.shouldInline) {
                // When inlining, a placeholder is used to allow the post-processing step to inject the $localize locale identifier
                contents.push('(globalThis.$localize ??= {}).locale = "___NG_LOCALE_INSERT___";');
            }
            else if (options.i18nOptions.hasDefinedSourceLocale) {
                // If not inlining translations and source locale is defined, inject the locale specifier
                contents.push(`(globalThis.$localize ??= {}).locale = "${options.i18nOptions.sourceLocale}";`);
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
    if (options.plugins) {
        buildOptions.plugins.push(...options.plugins);
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
        publicPath: options.publicPath,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24tY29kZS1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FwcGxpY2F0aW9uLWNvZGUtYnVuZGxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw2Q0FBeUM7QUFDekMsK0NBQTRDO0FBQzVDLDZDQUE0QztBQUM1Qyx5Q0FBb0Q7QUFFcEQseUVBQThEO0FBQzlELCtEQUFpRTtBQUVqRSx1RUFBd0U7QUFDeEUsNkRBQXFFO0FBQ3JFLDZFQUE2RTtBQUM3RSwrRUFBZ0Y7QUFDaEYsbUNBQTRDO0FBQzVDLG1FQUFvRTtBQUVwRSxTQUFnQiw4QkFBOEIsQ0FDNUMsT0FBMEMsRUFDMUMsTUFBZ0IsRUFDaEIsZUFBaUM7SUFFakMsTUFBTSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsR0FBRyxPQUFPLENBQUM7SUFFN0MsTUFBTSxFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQUUsR0FBRyxJQUFBLHFEQUEyQixFQUNqRSxPQUFPLEVBQ1AsTUFBTSxFQUNOLGVBQWUsQ0FDaEIsQ0FBQztJQUVGLE1BQU0sWUFBWSxHQUFpQjtRQUNqQyxHQUFHLHVCQUF1QixDQUFDLE9BQU8sQ0FBQztRQUNuQyxRQUFRLEVBQUUsU0FBUztRQUNuQix5RUFBeUU7UUFDekUsMEVBQTBFO1FBQzFFLHlDQUF5QztRQUN6QyxxRUFBcUU7UUFDckUsVUFBVSxFQUFFLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQztRQUM3RCxVQUFVLEVBQUUsV0FBVyxDQUFDLE9BQU87UUFDL0IsV0FBVztRQUNYLE1BQU07UUFDTixTQUFTLEVBQUUsSUFBQSx5QkFBaUIsRUFBQyxNQUFNLENBQUM7UUFDcEMs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VTtLQUMvQixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkT3B0aW9ucyB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnbm9kZTpjcnlwdG8nO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdub2RlOm1vZHVsZSc7XG5pbXBvcnQgeyBleHRuYW1lLCBqb2luLCByZWxhdGl2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgdHlwZSB7IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyB9IGZyb20gJy4uLy4uL2J1aWxkZXJzL2FwcGxpY2F0aW9uL29wdGlvbnMnO1xuaW1wb3J0IHsgYWxsb3dNYW5nbGUgfSBmcm9tICcuLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IGNyZWF0ZUNvbXBpbGVyUGx1Z2luIH0gZnJvbSAnLi9hbmd1bGFyL2NvbXBpbGVyLXBsdWdpbic7XG5pbXBvcnQgeyBTb3VyY2VGaWxlQ2FjaGUgfSBmcm9tICcuL2FuZ3VsYXIvc291cmNlLWZpbGUtY2FjaGUnO1xuaW1wb3J0IHsgY3JlYXRlQ29tcGlsZXJQbHVnaW5PcHRpb25zIH0gZnJvbSAnLi9jb21waWxlci1wbHVnaW4tb3B0aW9ucyc7XG5pbXBvcnQgeyBjcmVhdGVBbmd1bGFyTG9jYWxlRGF0YVBsdWdpbiB9IGZyb20gJy4vaTE4bi1sb2NhbGUtcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZVJ4anNFc21SZXNvbHV0aW9uUGx1Z2luIH0gZnJvbSAnLi9yeGpzLWVzbS1yZXNvbHV0aW9uLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVTb3VyY2VtYXBJZ25vcmVsaXN0UGx1Z2luIH0gZnJvbSAnLi9zb3VyY2VtYXAtaWdub3JlbGlzdC1wbHVnaW4nO1xuaW1wb3J0IHsgZ2V0RmVhdHVyZVN1cHBvcnQgfSBmcm9tICcuL3V0aWxzJztcbmltcG9ydCB7IGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW4gfSBmcm9tICcuL3ZpcnR1YWwtbW9kdWxlLXBsdWdpbic7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVCcm93c2VyQ29kZUJ1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyxcbiAgdGFyZ2V0OiBzdHJpbmdbXSxcbiAgc291cmNlRmlsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlLFxuKTogQnVpbGRPcHRpb25zIHtcbiAgY29uc3QgeyBlbnRyeVBvaW50cywgb3V0cHV0TmFtZXMgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgeyBwbHVnaW5PcHRpb25zLCBzdHlsZU9wdGlvbnMgfSA9IGNyZWF0ZUNvbXBpbGVyUGx1Z2luT3B0aW9ucyhcbiAgICBvcHRpb25zLFxuICAgIHRhcmdldCxcbiAgICBzb3VyY2VGaWxlQ2FjaGUsXG4gICk7XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zOiBCdWlsZE9wdGlvbnMgPSB7XG4gICAgLi4uZ2V0RXNCdWlsZENvbW1vbk9wdGlvbnMob3B0aW9ucyksXG4gICAgcGxhdGZvcm06ICdicm93c2VyJyxcbiAgICAvLyBOb3RlOiBgZXMyMDE1YCBpcyBuZWVkZWQgZm9yIFJ4SlMgdjYuIElmIG5vdCBzcGVjaWZpZWQsIGBtb2R1bGVgIHdvdWxkXG4gICAgLy8gbWF0Y2ggYW5kIHRoZSBFUzUgZGlzdHJpYnV0aW9uIHdvdWxkIGJlIGJ1bmRsZWQgYW5kIGVuZHMgdXAgYnJlYWtpbmcgYXRcbiAgICAvLyBydW50aW1lIHdpdGggdGhlIFJ4SlMgdGVzdGluZyBsaWJyYXJ5LlxuICAgIC8vIE1vcmUgZGV0YWlsczogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzI1NDA1LlxuICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgZW50cnlOYW1lczogb3V0cHV0TmFtZXMuYnVuZGxlcyxcbiAgICBlbnRyeVBvaW50cyxcbiAgICB0YXJnZXQsXG4gICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNvdXJjZW1hcElnbm9yZWxpc3RQbHVnaW4oKSxcbiAgICAgIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICAgICAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgICAgIHBsdWdpbk9wdGlvbnMsXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgKSxcbiAgICBdLFxuICB9O1xuXG4gIGlmIChvcHRpb25zLmV4dGVybmFsUGFja2FnZXMpIHtcbiAgICBidWlsZE9wdGlvbnMucGFja2FnZXMgPSAnZXh0ZXJuYWwnO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMucGx1Z2lucykge1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zPy5wdXNoKC4uLm9wdGlvbnMucGx1Z2lucyk7XG4gIH1cblxuICByZXR1cm4gYnVpbGRPcHRpb25zO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQnJvd3NlclBvbHlmaWxsQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMgfCB1bmRlZmluZWQge1xuICBjb25zdCB7IHdvcmtzcGFjZVJvb3QsIG91dHB1dE5hbWVzLCBqaXQgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgeyBwbHVnaW5PcHRpb25zLCBzdHlsZU9wdGlvbnMgfSA9IGNyZWF0ZUNvbXBpbGVyUGx1Z2luT3B0aW9ucyhcbiAgICBvcHRpb25zLFxuICAgIHRhcmdldCxcbiAgICBzb3VyY2VGaWxlQ2FjaGUsXG4gICk7XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zOiBCdWlsZE9wdGlvbnMgPSB7XG4gICAgLi4uZ2V0RXNCdWlsZENvbW1vbk9wdGlvbnMob3B0aW9ucyksXG4gICAgcGxhdGZvcm06ICdicm93c2VyJyxcbiAgICAvLyBOb3RlOiBgZXMyMDE1YCBpcyBuZWVkZWQgZm9yIFJ4SlMgdjYuIElmIG5vdCBzcGVjaWZpZWQsIGBtb2R1bGVgIHdvdWxkXG4gICAgLy8gbWF0Y2ggYW5kIHRoZSBFUzUgZGlzdHJpYnV0aW9uIHdvdWxkIGJlIGJ1bmRsZWQgYW5kIGVuZHMgdXAgYnJlYWtpbmcgYXRcbiAgICAvLyBydW50aW1lIHdpdGggdGhlIFJ4SlMgdGVzdGluZyBsaWJyYXJ5LlxuICAgIC8vIE1vcmUgZGV0YWlsczogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzI1NDA1LlxuICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgZW50cnlOYW1lczogb3V0cHV0TmFtZXMuYnVuZGxlcyxcbiAgICB0YXJnZXQsXG4gICAgc3BsaXR0aW5nOiBmYWxzZSxcbiAgICBzdXBwb3J0ZWQ6IGdldEZlYXR1cmVTdXBwb3J0KHRhcmdldCksXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlU291cmNlbWFwSWdub3JlbGlzdFBsdWdpbigpLFxuICAgICAgY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gICAgICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICAgICAgeyAuLi5wbHVnaW5PcHRpb25zLCBub29wVHlwZVNjcmlwdENvbXBpbGF0aW9uOiB0cnVlIH0sXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnMgYXJlIHVudXNlZCBmb3IgcG9seWZpbGxzIGJ1dCByZXF1aXJlZCBieSB0aGUgcGx1Z2luXG4gICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICksXG4gICAgXSxcbiAgfTtcbiAgYnVpbGRPcHRpb25zLnBsdWdpbnMgPz89IFtdO1xuXG4gIGNvbnN0IHBvbHlmaWxscyA9IG9wdGlvbnMucG9seWZpbGxzID8gWy4uLm9wdGlvbnMucG9seWZpbGxzXSA6IFtdO1xuXG4gIC8vIEFuZ3VsYXIgSklUIG1vZGUgcmVxdWlyZXMgdGhlIHJ1bnRpbWUgY29tcGlsZXJcbiAgaWYgKGppdCkge1xuICAgIHBvbHlmaWxscy5wdXNoKCdAYW5ndWxhci9jb21waWxlcicpO1xuICB9XG5cbiAgLy8gQWRkIEFuZ3VsYXIncyBnbG9iYWwgbG9jYWxlIGRhdGEgaWYgaTE4biBvcHRpb25zIGFyZSBwcmVzZW50LlxuICAvLyBMb2NhbGUgZGF0YSBzaG91bGQgZ28gZmlyc3Qgc28gdGhhdCBwcm9qZWN0IHByb3ZpZGVkIHBvbHlmaWxsIGNvZGUgY2FuIGF1Z21lbnQgaWYgbmVlZGVkLlxuICBsZXQgbmVlZExvY2FsZURhdGFQbHVnaW4gPSBmYWxzZTtcbiAgaWYgKG9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgLy8gV2hlbiBpbmxpbmluZywgYSBwbGFjZWhvbGRlciBpcyB1c2VkIHRvIGFsbG93IHRoZSBwb3N0LXByb2Nlc3Npbmcgc3RlcCB0byBpbmplY3QgdGhlICRsb2NhbGl6ZSBsb2NhbGUgaWRlbnRpZmllclxuICAgIHBvbHlmaWxscy51bnNoaWZ0KCdhbmd1bGFyOmxvY2FsZS9wbGFjZWhvbGRlcicpO1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zPy51bnNoaWZ0KFxuICAgICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICAgIG5hbWVzcGFjZTogJ2FuZ3VsYXI6bG9jYWxlL3BsYWNlaG9sZGVyJyxcbiAgICAgICAgZW50cnlQb2ludE9ubHk6IGZhbHNlLFxuICAgICAgICBsb2FkQ29udGVudDogKCkgPT4gKHtcbiAgICAgICAgICBjb250ZW50czogYChnbG9iYWxUaGlzLiRsb2NhbGl6ZSA/Pz0ge30pLmxvY2FsZSA9IFwiX19fTkdfTE9DQUxFX0lOU0VSVF9fX1wiO1xcbmAsXG4gICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIH0pLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIC8vIEFkZCBsb2NhbGUgZGF0YSBmb3IgYWxsIGFjdGl2ZSBsb2NhbGVzXG4gICAgLy8gVE9ETzogSW5qZWN0IGVhY2ggaW5kaXZpZHVhbGx5IHdpdGhpbiB0aGUgaW5saW5pbmcgcHJvY2VzcyBpdHNlbGZcbiAgICBmb3IgKGNvbnN0IGxvY2FsZSBvZiBvcHRpb25zLmkxOG5PcHRpb25zLmlubGluZUxvY2FsZXMpIHtcbiAgICAgIHBvbHlmaWxscy51bnNoaWZ0KGBhbmd1bGFyOmxvY2FsZS9kYXRhOiR7bG9jYWxlfWApO1xuICAgIH1cbiAgICBuZWVkTG9jYWxlRGF0YVBsdWdpbiA9IHRydWU7XG4gIH0gZWxzZSBpZiAob3B0aW9ucy5pMThuT3B0aW9ucy5oYXNEZWZpbmVkU291cmNlTG9jYWxlKSB7XG4gICAgLy8gV2hlbiBub3QgaW5saW5pbmcgYW5kIGEgc291cmNlIGxvY2FsIGlzIHByZXNlbnQsIHVzZSB0aGUgc291cmNlIGxvY2FsZSBkYXRhIGRpcmVjdGx5XG4gICAgcG9seWZpbGxzLnVuc2hpZnQoYGFuZ3VsYXI6bG9jYWxlL2RhdGE6JHtvcHRpb25zLmkxOG5PcHRpb25zLnNvdXJjZUxvY2FsZX1gKTtcbiAgICBuZWVkTG9jYWxlRGF0YVBsdWdpbiA9IHRydWU7XG4gIH1cbiAgaWYgKG5lZWRMb2NhbGVEYXRhUGx1Z2luKSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnM/LnB1c2goY3JlYXRlQW5ndWxhckxvY2FsZURhdGFQbHVnaW4oKSk7XG4gIH1cblxuICBpZiAocG9seWZpbGxzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEFkZCBwb2x5ZmlsbCBlbnRyeSBwb2ludCBpZiBwb2x5ZmlsbHMgYXJlIHByZXNlbnRcbiAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6cG9seWZpbGxzJztcbiAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0ge1xuICAgICdwb2x5ZmlsbHMnOiBuYW1lc3BhY2UsXG4gIH07XG5cbiAgYnVpbGRPcHRpb25zLnBsdWdpbnM/LnVuc2hpZnQoXG4gICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICBuYW1lc3BhY2UsXG4gICAgICBsb2FkQ29udGVudDogYXN5bmMgKF8sIGJ1aWxkKSA9PiB7XG4gICAgICAgIGxldCBoYXNMb2NhbGl6ZVBvbHlmaWxsID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IHBvbHlmaWxsUGF0aHMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICBwb2x5ZmlsbHMubWFwKGFzeW5jIChwYXRoKSA9PiB7XG4gICAgICAgICAgICBoYXNMb2NhbGl6ZVBvbHlmaWxsIHx8PSBwYXRoLnN0YXJ0c1dpdGgoJ0Bhbmd1bGFyL2xvY2FsaXplJyk7XG5cbiAgICAgICAgICAgIGlmIChwYXRoLnN0YXJ0c1dpdGgoJ3pvbmUuanMnKSB8fCAhZXh0bmFtZShwYXRoKSkge1xuICAgICAgICAgICAgICByZXR1cm4gcGF0aDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcG90ZW50aWFsUGF0aFJlbGF0aXZlID0gJy4vJyArIHBhdGg7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBidWlsZC5yZXNvbHZlKHBvdGVudGlhbFBhdGhSZWxhdGl2ZSwge1xuICAgICAgICAgICAgICBraW5kOiAnaW1wb3J0LXN0YXRlbWVudCcsXG4gICAgICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC5wYXRoID8gcG90ZW50aWFsUGF0aFJlbGF0aXZlIDogcGF0aDtcbiAgICAgICAgICB9KSxcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoIW9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lICYmICFoYXNMb2NhbGl6ZVBvbHlmaWxsKSB7XG4gICAgICAgICAgLy8gQ2Fubm90IHVzZSBgYnVpbGQucmVzb2x2ZWAgaGVyZSBzaW5jZSBpdCBkb2VzIG5vdCBhbGxvdyBvdmVycmlkaW5nIHRoZSBleHRlcm5hbCBvcHRpb25zXG4gICAgICAgICAgLy8gYW5kIHRoZSBhY3R1YWwgcHJlc2VuY2Ugb2YgdGhlIGBAYW5ndWxhci9sb2NhbGl6ZWAgcGFja2FnZSBuZWVkcyB0byBiZSBjaGVja2VkIGhlcmUuXG4gICAgICAgICAgY29uc3Qgd29ya3NwYWNlUmVxdWlyZSA9IGNyZWF0ZVJlcXVpcmUod29ya3NwYWNlUm9vdCArICcvJyk7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHdvcmtzcGFjZVJlcXVpcmUucmVzb2x2ZSgnQGFuZ3VsYXIvbG9jYWxpemUnKTtcbiAgICAgICAgICAgIC8vIFRoZSByZXNvbHZlIGNhbGwgYWJvdmUgd2lsbCB0aHJvdyBpZiBub3QgZm91bmRcbiAgICAgICAgICAgIHBvbHlmaWxsUGF0aHMucHVzaCgnQGFuZ3VsYXIvbG9jYWxpemUvaW5pdCcpO1xuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdlbmVyYXRlIG1vZHVsZSBjb250ZW50cyB3aXRoIGFuIGltcG9ydCBzdGF0ZW1lbnQgcGVyIGRlZmluZWQgcG9seWZpbGxcbiAgICAgICAgbGV0IGNvbnRlbnRzID0gcG9seWZpbGxQYXRoc1xuICAgICAgICAgIC5tYXAoKGZpbGUpID0+IGBpbXBvcnQgJyR7ZmlsZS5yZXBsYWNlKC9cXFxcL2csICcvJyl9JztgKVxuICAgICAgICAgIC5qb2luKCdcXG4nKTtcblxuICAgICAgICAvLyBJZiBub3QgaW5saW5pbmcgdHJhbnNsYXRpb25zIGFuZCBzb3VyY2UgbG9jYWxlIGlzIGRlZmluZWQsIGluamVjdCB0aGUgbG9jYWxlIHNwZWNpZmllclxuICAgICAgICBpZiAoIW9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lICYmIG9wdGlvbnMuaTE4bk9wdGlvbnMuaGFzRGVmaW5lZFNvdXJjZUxvY2FsZSkge1xuICAgICAgICAgIGNvbnRlbnRzICs9IGAoZ2xvYmFsVGhpcy4kbG9jYWxpemUgPz89IHt9KS5sb2NhbGUgPSBcIiR7b3B0aW9ucy5pMThuT3B0aW9ucy5zb3VyY2VMb2NhbGV9XCI7XFxuYDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgY29udGVudHMsXG4gICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgIH0pLFxuICApO1xuXG4gIHJldHVybiBidWlsZE9wdGlvbnM7XG59XG5cbi8qKlxuICogQ3JlYXRlIGFuIGVzYnVpbGQgJ2J1aWxkJyBvcHRpb25zIG9iamVjdCBmb3IgdGhlIHNlcnZlciBidW5kbGUuXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgYnVpbGRlcidzIHVzZXItcHJvdmlkZXIgbm9ybWFsaXplZCBvcHRpb25zLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBCdWlsZE9wdGlvbnMgb2JqZWN0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2VydmVyQ29kZUJ1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyxcbiAgdGFyZ2V0OiBzdHJpbmdbXSxcbiAgc291cmNlRmlsZUNhY2hlOiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7XG4gICAgaml0LFxuICAgIHNlcnZlckVudHJ5UG9pbnQsXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBzc3JPcHRpb25zLFxuICAgIHdhdGNoLFxuICAgIGV4dGVybmFsUGFja2FnZXMsXG4gICAgcHJlcmVuZGVyT3B0aW9ucyxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgYXNzZXJ0KFxuICAgIHNlcnZlckVudHJ5UG9pbnQsXG4gICAgJ2NyZWF0ZVNlcnZlckNvZGVCdW5kbGVPcHRpb25zIHNob3VsZCBub3QgYmUgY2FsbGVkIHdpdGhvdXQgYSBkZWZpbmVkIHNlcnZlckVudHJ5UG9pbnQuJyxcbiAgKTtcblxuICBjb25zdCB7IHBsdWdpbk9wdGlvbnMsIHN0eWxlT3B0aW9ucyB9ID0gY3JlYXRlQ29tcGlsZXJQbHVnaW5PcHRpb25zKFxuICAgIG9wdGlvbnMsXG4gICAgdGFyZ2V0LFxuICAgIHNvdXJjZUZpbGVDYWNoZSxcbiAgKTtcblxuICBjb25zdCBtYWluU2VydmVyTmFtZXNwYWNlID0gJ2FuZ3VsYXI6bWFpbi1zZXJ2ZXInO1xuICBjb25zdCBzc3JFbnRyeU5hbWVzcGFjZSA9ICdhbmd1bGFyOnNzci1lbnRyeSc7XG5cbiAgY29uc3QgZW50cnlQb2ludHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgJ21haW4uc2VydmVyJzogbWFpblNlcnZlck5hbWVzcGFjZSxcbiAgfTtcblxuICBjb25zdCBzc3JFbnRyeVBvaW50ID0gc3NyT3B0aW9ucz8uZW50cnk7XG4gIGlmIChzc3JFbnRyeVBvaW50KSB7XG4gICAgZW50cnlQb2ludHNbJ3NlcnZlciddID0gc3NyRW50cnlOYW1lc3BhY2U7XG4gIH1cblxuICBjb25zdCBidWlsZE9wdGlvbnM6IEJ1aWxkT3B0aW9ucyA9IHtcbiAgICAuLi5nZXRFc0J1aWxkQ29tbW9uT3B0aW9ucyhvcHRpb25zKSxcbiAgICBwbGF0Zm9ybTogJ25vZGUnLFxuICAgIC8vIFRPRE86IEludmVzaWdhdGUgd2h5IGVuYWJsaW5nIGBzcGxpdHRpbmdgIGluIEpJVCBtb2RlIGNhdXNlcyBhbiBcIidAYW5ndWxhci9jb21waWxlcicgaXMgbm90IGF2YWlsYWJsZVwiIGVycm9yLlxuICAgIHNwbGl0dGluZzogIWppdCxcbiAgICBvdXRFeHRlbnNpb246IHsgJy5qcyc6ICcubWpzJyB9LFxuICAgIC8vIE5vdGU6IGBlczIwMTVgIGlzIG5lZWRlZCBmb3IgUnhKUyB2Ni4gSWYgbm90IHNwZWNpZmllZCwgYG1vZHVsZWAgd291bGRcbiAgICAvLyBtYXRjaCBhbmQgdGhlIEVTNSBkaXN0cmlidXRpb24gd291bGQgYmUgYnVuZGxlZCBhbmQgZW5kcyB1cCBicmVha2luZyBhdFxuICAgIC8vIHJ1bnRpbWUgd2l0aCB0aGUgUnhKUyB0ZXN0aW5nIGxpYnJhcnkuXG4gICAgLy8gTW9yZSBkZXRhaWxzOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMjU0MDUuXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnZXMyMDE1JywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgZW50cnlOYW1lczogJ1tuYW1lXScsXG4gICAgdGFyZ2V0LFxuICAgIGJhbm5lcjoge1xuICAgICAgLy8gTm90ZTogTmVlZGVkIGFzIGVzYnVpbGQgZG9lcyBub3QgcHJvdmlkZSByZXF1aXJlIHNoaW1zIC8gcHJveHkgZnJvbSBFU01vZHVsZXMuXG4gICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9ldmFudy9lc2J1aWxkL2lzc3Vlcy8xOTIxLlxuICAgICAganM6IFtcbiAgICAgICAgYGltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdub2RlOm1vZHVsZSc7YCxcbiAgICAgICAgYGdsb2JhbFRoaXNbJ3JlcXVpcmUnXSA/Pz0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpO2AsXG4gICAgICBdLmpvaW4oJ1xcbicpLFxuICAgIH0sXG4gICAgZW50cnlQb2ludHMsXG4gICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNvdXJjZW1hcElnbm9yZWxpc3RQbHVnaW4oKSxcbiAgICAgIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICAgICAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgICAgIHsgLi4ucGx1Z2luT3B0aW9ucywgbm9vcFR5cGVTY3JpcHRDb21waWxhdGlvbjogdHJ1ZSB9LFxuICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzaGVldCBvcHRpb25zXG4gICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICksXG4gICAgXSxcbiAgfTtcblxuICBidWlsZE9wdGlvbnMucGx1Z2lucyA/Pz0gW107XG4gIGlmIChleHRlcm5hbFBhY2thZ2VzKSB7XG4gICAgYnVpbGRPcHRpb25zLnBhY2thZ2VzID0gJ2V4dGVybmFsJztcbiAgfSBlbHNlIHtcbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKGNyZWF0ZVJ4anNFc21SZXNvbHV0aW9uUGx1Z2luKCkpO1xuICB9XG5cbiAgY29uc3QgcG9seWZpbGxzOiBzdHJpbmdbXSA9IFtdO1xuICBpZiAob3B0aW9ucy5wb2x5ZmlsbHM/LmluY2x1ZGVzKCd6b25lLmpzJykpIHtcbiAgICBwb2x5ZmlsbHMucHVzaChgaW1wb3J0ICd6b25lLmpzL25vZGUnO2ApO1xuICB9XG5cbiAgaWYgKGppdCkge1xuICAgIHBvbHlmaWxscy5wdXNoKGBpbXBvcnQgJ0Bhbmd1bGFyL2NvbXBpbGVyJztgKTtcbiAgfVxuXG4gIHBvbHlmaWxscy5wdXNoKGBpbXBvcnQgJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlci9pbml0JztgKTtcblxuICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKFxuICAgIGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW4oe1xuICAgICAgbmFtZXNwYWNlOiBtYWluU2VydmVyTmFtZXNwYWNlLFxuICAgICAgbG9hZENvbnRlbnQ6IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgbWFpblNlcnZlckVudHJ5UG9pbnQgPSByZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCBzZXJ2ZXJFbnRyeVBvaW50KS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG5cbiAgICAgICAgY29uc3QgY29udGVudHMgPSBbXG4gICAgICAgICAgLi4ucG9seWZpbGxzLFxuICAgICAgICAgIGBpbXBvcnQgbW9kdWxlT3JCb290c3RyYXBGbiBmcm9tICcuLyR7bWFpblNlcnZlckVudHJ5UG9pbnR9JztgLFxuICAgICAgICAgIGBleHBvcnQgZGVmYXVsdCBtb2R1bGVPckJvb3RzdHJhcEZuO2AsXG4gICAgICAgICAgYGV4cG9ydCAqIGZyb20gJy4vJHttYWluU2VydmVyRW50cnlQb2ludH0nO2AsXG4gICAgICAgICAgYGV4cG9ydCB7IMm1Q29uc29sZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO2AsXG4gICAgICAgICAgYGV4cG9ydCB7IHJlbmRlckFwcGxpY2F0aW9uLCByZW5kZXJNb2R1bGUsIMm1U0VSVkVSX0NPTlRFWFQgfSBmcm9tICdAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXInO2AsXG4gICAgICAgIF07XG5cbiAgICAgICAgaWYgKHdhdGNoKSB7XG4gICAgICAgICAgY29udGVudHMucHVzaChgZXhwb3J0IHsgybVyZXNldENvbXBpbGVkQ29tcG9uZW50cyB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLmkxOG5PcHRpb25zLnNob3VsZElubGluZSkge1xuICAgICAgICAgIC8vIENhbm5vdCB1c2UgYGJ1aWxkLnJlc29sdmVgIGhlcmUgc2luY2UgaXQgZG9lcyBub3QgYWxsb3cgb3ZlcnJpZGluZyB0aGUgZXh0ZXJuYWwgb3B0aW9uc1xuICAgICAgICAgIC8vIGFuZCB0aGUgYWN0dWFsIHByZXNlbmNlIG9mIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemVgIHBhY2thZ2UgbmVlZHMgdG8gYmUgY2hlY2tlZCBoZXJlLlxuICAgICAgICAgIGNvbnN0IHdvcmtzcGFjZVJlcXVpcmUgPSBjcmVhdGVSZXF1aXJlKHdvcmtzcGFjZVJvb3QgKyAnLycpO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB3b3Jrc3BhY2VSZXF1aXJlLnJlc29sdmUoJ0Bhbmd1bGFyL2xvY2FsaXplJyk7XG4gICAgICAgICAgICAvLyBUaGUgcmVzb2x2ZSBjYWxsIGFib3ZlIHdpbGwgdGhyb3cgaWYgbm90IGZvdW5kXG4gICAgICAgICAgICBjb250ZW50cy5wdXNoKGBpbXBvcnQgJ0Bhbmd1bGFyL2xvY2FsaXplL2luaXQnO2ApO1xuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmkxOG5PcHRpb25zLnNob3VsZElubGluZSkge1xuICAgICAgICAgIC8vIFdoZW4gaW5saW5pbmcsIGEgcGxhY2Vob2xkZXIgaXMgdXNlZCB0byBhbGxvdyB0aGUgcG9zdC1wcm9jZXNzaW5nIHN0ZXAgdG8gaW5qZWN0IHRoZSAkbG9jYWxpemUgbG9jYWxlIGlkZW50aWZpZXJcbiAgICAgICAgICBjb250ZW50cy5wdXNoKCcoZ2xvYmFsVGhpcy4kbG9jYWxpemUgPz89IHt9KS5sb2NhbGUgPSBcIl9fX05HX0xPQ0FMRV9JTlNFUlRfX19cIjsnKTtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmkxOG5PcHRpb25zLmhhc0RlZmluZWRTb3VyY2VMb2NhbGUpIHtcbiAgICAgICAgICAvLyBJZiBub3QgaW5saW5pbmcgdHJhbnNsYXRpb25zIGFuZCBzb3VyY2UgbG9jYWxlIGlzIGRlZmluZWQsIGluamVjdCB0aGUgbG9jYWxlIHNwZWNpZmllclxuICAgICAgICAgIGNvbnRlbnRzLnB1c2goXG4gICAgICAgICAgICBgKGdsb2JhbFRoaXMuJGxvY2FsaXplID8/PSB7fSkubG9jYWxlID0gXCIke29wdGlvbnMuaTE4bk9wdGlvbnMuc291cmNlTG9jYWxlfVwiO2AsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwcmVyZW5kZXJPcHRpb25zPy5kaXNjb3ZlclJvdXRlcykge1xuICAgICAgICAgIC8vIFdlIGRvIG5vdCBpbXBvcnQgaXQgZGlyZWN0bHkgc28gdGhhdCBub2RlLmpzIG1vZHVsZXMgYXJlIHJlc29sdmVkIHVzaW5nIHRoZSBjb3JyZWN0IGNvbnRleHQuXG4gICAgICAgICAgY29uc3Qgcm91dGVzRXh0cmFjdG9yQ29kZSA9IGF3YWl0IHJlYWRGaWxlKFxuICAgICAgICAgICAgam9pbihfX2Rpcm5hbWUsICcuLi8uLi91dGlscy9yb3V0ZXMtZXh0cmFjdG9yL2V4dHJhY3Rvci5qcycpLFxuICAgICAgICAgICAgJ3V0Zi04JyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgLy8gUmVtb3ZlIHNvdXJjZSBtYXAgVVJMIGNvbW1lbnRzIGZyb20gdGhlIGNvZGUgaWYgYSBzb3VyY2VtYXAgaXMgcHJlc2VudCBhcyB0aGlzIHdpbGwgbm90IG1hdGNoIHRoZSBmaWxlLlxuICAgICAgICAgIGNvbnRlbnRzLnB1c2gocm91dGVzRXh0cmFjdG9yQ29kZS5yZXBsYWNlKC9eXFwvXFwvIyBzb3VyY2VNYXBwaW5nVVJMPVteXFxyXFxuXSovZ20sICcnKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbnRlbnRzOiBjb250ZW50cy5qb2luKCdcXG4nKSxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgfSksXG4gICk7XG5cbiAgaWYgKHNzckVudHJ5UG9pbnQpIHtcbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKFxuICAgICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICAgIG5hbWVzcGFjZTogc3NyRW50cnlOYW1lc3BhY2UsXG4gICAgICAgIGxvYWRDb250ZW50OiAoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgc2VydmVyRW50cnlQb2ludCA9IHJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIHNzckVudHJ5UG9pbnQpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb250ZW50czogW1xuICAgICAgICAgICAgICAuLi5wb2x5ZmlsbHMsXG4gICAgICAgICAgICAgIGBpbXBvcnQgJy4vJHtzZXJ2ZXJFbnRyeVBvaW50fSc7YCxcbiAgICAgICAgICAgICAgYGV4cG9ydCAqIGZyb20gJy4vJHtzZXJ2ZXJFbnRyeVBvaW50fSc7YCxcbiAgICAgICAgICAgIF0uam9pbignXFxuJyksXG4gICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMucGx1Z2lucykge1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goLi4ub3B0aW9ucy5wbHVnaW5zKTtcbiAgfVxuXG4gIHJldHVybiBidWlsZE9wdGlvbnM7XG59XG5cbmZ1bmN0aW9uIGdldEVzQnVpbGRDb21tb25PcHRpb25zKG9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyk6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHtcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG91dEV4dGVuc2lvbixcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBqaXQsXG4gIH0gPSBvcHRpb25zO1xuXG4gIC8vIEVuc3VyZSB1bmlxdWUgaGFzaGVzIGZvciBpMThuIHRyYW5zbGF0aW9uIGNoYW5nZXMgd2hlbiB1c2luZyBwb3N0LXByb2Nlc3MgaW5saW5pbmcuXG4gIC8vIFRoaXMgaGFzaCB2YWx1ZSBpcyBhZGRlZCBhcyBhIGZvb3RlciB0byBlYWNoIGZpbGUgYW5kIGVuc3VyZXMgdGhhdCB0aGUgb3V0cHV0IGZpbGUgbmFtZXMgKHdpdGggaGFzaGVzKVxuICAvLyBjaGFuZ2Ugd2hlbiB0cmFuc2xhdGlvbiBmaWxlcyBoYXZlIGNoYW5nZWQuIElmIHRoaXMgaXMgbm90IGRvbmUgdGhlIHBvc3QgcHJvY2Vzc2VkIGZpbGVzIG1heSBoYXZlXG4gIC8vIGRpZmZlcmVudCBjb250ZW50IGJ1dCB3b3VsZCByZXRhaW4gaWRlbnRpY2FsIHByb2R1Y3Rpb24gZmlsZSBuYW1lcyB3aGljaCB3b3VsZCBsZWFkIHRvIGJyb3dzZXIgY2FjaGluZyBwcm9ibGVtcy5cbiAgbGV0IGZvb3RlcjtcbiAgaWYgKG9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgLy8gVXBkYXRlIGZpbGUgaGFzaGVzIHRvIGluY2x1ZGUgdHJhbnNsYXRpb24gZmlsZSBjb250ZW50XG4gICAgY29uc3QgaTE4bkhhc2ggPSBPYmplY3QudmFsdWVzKG9wdGlvbnMuaTE4bk9wdGlvbnMubG9jYWxlcykucmVkdWNlKFxuICAgICAgKGRhdGEsIGxvY2FsZSkgPT4gZGF0YSArIGxvY2FsZS5maWxlcy5tYXAoKGZpbGUpID0+IGZpbGUuaW50ZWdyaXR5IHx8ICcnKS5qb2luKCd8JyksXG4gICAgICAnJyxcbiAgICApO1xuXG4gICAgZm9vdGVyID0geyBqczogYC8qKmkxOG46JHtjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoaTE4bkhhc2gpLmRpZ2VzdCgnaGV4Jyl9Ki9gIH07XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGFic1dvcmtpbmdEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgYnVuZGxlOiB0cnVlLFxuICAgIGZvcm1hdDogJ2VzbScsXG4gICAgYXNzZXROYW1lczogb3V0cHV0TmFtZXMubWVkaWEsXG4gICAgY29uZGl0aW9uczogWydlczIwMjAnLCAnZXMyMDE1JywgJ21vZHVsZSddLFxuICAgIHJlc29sdmVFeHRlbnNpb25zOiBbJy50cycsICcudHN4JywgJy5tanMnLCAnLmpzJ10sXG4gICAgbWV0YWZpbGU6IHRydWUsXG4gICAgbGVnYWxDb21tZW50czogb3B0aW9ucy5leHRyYWN0TGljZW5zZXMgPyAnbm9uZScgOiAnZW9mJyxcbiAgICBsb2dMZXZlbDogb3B0aW9ucy52ZXJib3NlID8gJ2RlYnVnJyA6ICdzaWxlbnQnLFxuICAgIG1pbmlmeUlkZW50aWZpZXJzOiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgJiYgYWxsb3dNYW5nbGUsXG4gICAgbWluaWZ5U3ludGF4OiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgbWluaWZ5V2hpdGVzcGFjZTogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzLFxuICAgIHB1cmU6IFsnZm9yd2FyZFJlZiddLFxuICAgIG91dGRpcjogd29ya3NwYWNlUm9vdCxcbiAgICBvdXRFeHRlbnNpb246IG91dEV4dGVuc2lvbiA/IHsgJy5qcyc6IGAuJHtvdXRFeHRlbnNpb259YCB9IDogdW5kZWZpbmVkLFxuICAgIHNvdXJjZW1hcDogc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICBzcGxpdHRpbmc6IHRydWUsXG4gICAgY2h1bmtOYW1lczogb3B0aW9ucy5uYW1lZENodW5rcyA/ICdbbmFtZV0tW2hhc2hdJyA6ICdjaHVuay1baGFzaF0nLFxuICAgIHRzY29uZmlnLFxuICAgIGV4dGVybmFsOiBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICB3cml0ZTogZmFsc2UsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBkZWZpbmU6IHtcbiAgICAgIC8vIE9ubHkgc2V0IHRvIGZhbHNlIHdoZW4gc2NyaXB0IG9wdGltaXphdGlvbnMgYXJlIGVuYWJsZWQuIEl0IHNob3VsZCBub3QgYmUgc2V0IHRvIHRydWUgYmVjYXVzZVxuICAgICAgLy8gQW5ndWxhciB0dXJucyBgbmdEZXZNb2RlYCBpbnRvIGFuIG9iamVjdCBmb3IgZGV2ZWxvcG1lbnQgZGVidWdnaW5nIHB1cnBvc2VzIHdoZW4gbm90IGRlZmluZWRcbiAgICAgIC8vIHdoaWNoIGEgY29uc3RhbnQgdHJ1ZSB2YWx1ZSB3b3VsZCBicmVhay5cbiAgICAgIC4uLihvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgPyB7ICduZ0Rldk1vZGUnOiAnZmFsc2UnIH0gOiB1bmRlZmluZWQpLFxuICAgICAgJ25nSml0TW9kZSc6IGppdCA/ICd0cnVlJyA6ICdmYWxzZScsXG4gICAgfSxcbiAgICBmb290ZXIsXG4gICAgcHVibGljUGF0aDogb3B0aW9ucy5wdWJsaWNQYXRoLFxuICB9O1xufVxuIl19