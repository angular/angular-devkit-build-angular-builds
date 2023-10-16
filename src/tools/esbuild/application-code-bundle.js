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
    // Add Angular's global locale data if i18n options are present.
    let needLocaleDataPlugin = false;
    if (options.i18nOptions.shouldInline) {
        // Add locale data for all active locales
        for (const locale of options.i18nOptions.inlineLocales) {
            polyfills.unshift(`import 'angular:locale/data:${locale}';`);
        }
        needLocaleDataPlugin = true;
    }
    else if (options.i18nOptions.hasDefinedSourceLocale) {
        // When not inlining and a source local is present, use the source locale data directly
        polyfills.unshift(`import 'angular:locale/data:${options.i18nOptions.sourceLocale}';`);
        needLocaleDataPlugin = true;
    }
    if (needLocaleDataPlugin) {
        buildOptions.plugins.push((0, i18n_locale_plugin_1.createAngularLocaleDataPlugin)());
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24tY29kZS1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FwcGxpY2F0aW9uLWNvZGUtYnVuZGxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw2Q0FBeUM7QUFDekMsK0NBQTRDO0FBQzVDLDZDQUE0QztBQUM1Qyx5Q0FBb0Q7QUFFcEQseUVBQThEO0FBQzlELCtEQUFpRTtBQUVqRSx1RUFBd0U7QUFDeEUsNkRBQXFFO0FBQ3JFLDZFQUE2RTtBQUM3RSwrRUFBZ0Y7QUFDaEYsbUNBQTRDO0FBQzVDLG1FQUFvRTtBQUVwRSxTQUFnQiw4QkFBOEIsQ0FDNUMsT0FBMEMsRUFDMUMsTUFBZ0IsRUFDaEIsZUFBaUM7SUFFakMsTUFBTSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsR0FBRyxPQUFPLENBQUM7SUFFN0MsTUFBTSxFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQUUsR0FBRyxJQUFBLHFEQUEyQixFQUNqRSxPQUFPLEVBQ1AsTUFBTSxFQUNOLGVBQWUsQ0FDaEIsQ0FBQztJQUVGLE1BQU0sWUFBWSxHQUFpQjtRQUNqQyxHQUFHLHVCQUF1QixDQUFDLE9BQU8sQ0FBQztRQUNuQyxRQUFRLEVBQUUsU0FBUztRQUNuQix5RUFBeUU7UUFDekUsMEVBQTBFO1FBQzFFLHlDQUF5QztRQUN6QyxxRUFBcUU7UUFDckUsVUFBVSxFQUFFLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQztRQUM3RCxVQUFVLEVBQUUsV0FBVyxDQUFDLE9BQU87UUFDL0IsV0FBVztRQUNYLE1BQU07UUFDTixTQUFTLEVBQUUsSUFBQSx5QkFBaUIsRUFBQyxNQUFNLENBQUM7UUFDcEMs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QWdCLENBQUMsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUNwRixTQUFTLEVBQUUsSUFBSTtRQUNmLFVBQVUsRUFBRSxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLGNBQWM7UUFDbEUsUUFBUTtRQUNSLFFBQVEsRUFBRSxvQkFBb0I7UUFDOUIsS0FBSyxFQUFFLEtBQUs7UUFDWixnQkFBZ0I7UUFDaEIsTUFBTSxFQUFFO1lBQ04sZ0dBQWdHO1lBQ2hHLCtGQUErRjtZQUMvRiwyQ0FBMkM7WUFDM0MsR0FBRyxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUN2RSxXQUFXLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU87U0FDcEM7UUFDRCxNQUFNO1FBQ04sVUFBVSxFQUFFLE9BQU8sQ0FBQyxVQUFVO0tBQy9CLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdub2RlOmNyeXB0byc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJztcbmltcG9ydCB7IGV4dG5hbWUsIGpvaW4sIHJlbGF0aXZlIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB0eXBlIHsgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zIH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYXBwbGljYXRpb24vb3B0aW9ucyc7XG5pbXBvcnQgeyBhbGxvd01hbmdsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgY3JlYXRlQ29tcGlsZXJQbHVnaW4gfSBmcm9tICcuL2FuZ3VsYXIvY29tcGlsZXItcGx1Z2luJztcbmltcG9ydCB7IFNvdXJjZUZpbGVDYWNoZSB9IGZyb20gJy4vYW5ndWxhci9zb3VyY2UtZmlsZS1jYWNoZSc7XG5pbXBvcnQgeyBjcmVhdGVDb21waWxlclBsdWdpbk9wdGlvbnMgfSBmcm9tICcuL2NvbXBpbGVyLXBsdWdpbi1vcHRpb25zJztcbmltcG9ydCB7IGNyZWF0ZUFuZ3VsYXJMb2NhbGVEYXRhUGx1Z2luIH0gZnJvbSAnLi9pMThuLWxvY2FsZS1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlUnhqc0VzbVJlc29sdXRpb25QbHVnaW4gfSBmcm9tICcuL3J4anMtZXNtLXJlc29sdXRpb24tcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZVNvdXJjZW1hcElnbm9yZWxpc3RQbHVnaW4gfSBmcm9tICcuL3NvdXJjZW1hcC1pZ25vcmVsaXN0LXBsdWdpbic7XG5pbXBvcnQgeyBnZXRGZWF0dXJlU3VwcG9ydCB9IGZyb20gJy4vdXRpbHMnO1xuaW1wb3J0IHsgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbiB9IGZyb20gJy4vdmlydHVhbC1tb2R1bGUtcGx1Z2luJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUJyb3dzZXJDb2RlQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7IGVudHJ5UG9pbnRzLCBvdXRwdXROYW1lcyB9ID0gb3B0aW9ucztcblxuICBjb25zdCB7IHBsdWdpbk9wdGlvbnMsIHN0eWxlT3B0aW9ucyB9ID0gY3JlYXRlQ29tcGlsZXJQbHVnaW5PcHRpb25zKFxuICAgIG9wdGlvbnMsXG4gICAgdGFyZ2V0LFxuICAgIHNvdXJjZUZpbGVDYWNoZSxcbiAgKTtcblxuICBjb25zdCBidWlsZE9wdGlvbnM6IEJ1aWxkT3B0aW9ucyA9IHtcbiAgICAuLi5nZXRFc0J1aWxkQ29tbW9uT3B0aW9ucyhvcHRpb25zKSxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIC8vIE5vdGU6IGBlczIwMTVgIGlzIG5lZWRlZCBmb3IgUnhKUyB2Ni4gSWYgbm90IHNwZWNpZmllZCwgYG1vZHVsZWAgd291bGRcbiAgICAvLyBtYXRjaCBhbmQgdGhlIEVTNSBkaXN0cmlidXRpb24gd291bGQgYmUgYnVuZGxlZCBhbmQgZW5kcyB1cCBicmVha2luZyBhdFxuICAgIC8vIHJ1bnRpbWUgd2l0aCB0aGUgUnhKUyB0ZXN0aW5nIGxpYnJhcnkuXG4gICAgLy8gTW9yZSBkZXRhaWxzOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMjU0MDUuXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnZXMyMDE1JywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICBlbnRyeU5hbWVzOiBvdXRwdXROYW1lcy5idW5kbGVzLFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIHRhcmdldCxcbiAgICBzdXBwb3J0ZWQ6IGdldEZlYXR1cmVTdXBwb3J0KHRhcmdldCksXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlU291cmNlbWFwSWdub3JlbGlzdFBsdWdpbigpLFxuICAgICAgY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gICAgICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICAgICAgcGx1Z2luT3B0aW9ucyxcbiAgICAgICAgLy8gQ29tcG9uZW50IHN0eWxlc2hlZXQgb3B0aW9uc1xuICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICApLFxuICAgIF0sXG4gIH07XG5cbiAgaWYgKG9wdGlvbnMuZXh0ZXJuYWxQYWNrYWdlcykge1xuICAgIGJ1aWxkT3B0aW9ucy5wYWNrYWdlcyA9ICdleHRlcm5hbCc7XG4gIH1cblxuICBpZiAob3B0aW9ucy5wbHVnaW5zKSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnM/LnB1c2goLi4ub3B0aW9ucy5wbHVnaW5zKTtcbiAgfVxuXG4gIHJldHVybiBidWlsZE9wdGlvbnM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVCcm93c2VyUG9seWZpbGxCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZSxcbik6IEJ1aWxkT3B0aW9ucyB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IHsgd29ya3NwYWNlUm9vdCwgb3V0cHV0TmFtZXMsIGppdCB9ID0gb3B0aW9ucztcblxuICBjb25zdCB7IHBsdWdpbk9wdGlvbnMsIHN0eWxlT3B0aW9ucyB9ID0gY3JlYXRlQ29tcGlsZXJQbHVnaW5PcHRpb25zKFxuICAgIG9wdGlvbnMsXG4gICAgdGFyZ2V0LFxuICAgIHNvdXJjZUZpbGVDYWNoZSxcbiAgKTtcblxuICBjb25zdCBidWlsZE9wdGlvbnM6IEJ1aWxkT3B0aW9ucyA9IHtcbiAgICAuLi5nZXRFc0J1aWxkQ29tbW9uT3B0aW9ucyhvcHRpb25zKSxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIC8vIE5vdGU6IGBlczIwMTVgIGlzIG5lZWRlZCBmb3IgUnhKUyB2Ni4gSWYgbm90IHNwZWNpZmllZCwgYG1vZHVsZWAgd291bGRcbiAgICAvLyBtYXRjaCBhbmQgdGhlIEVTNSBkaXN0cmlidXRpb24gd291bGQgYmUgYnVuZGxlZCBhbmQgZW5kcyB1cCBicmVha2luZyBhdFxuICAgIC8vIHJ1bnRpbWUgd2l0aCB0aGUgUnhKUyB0ZXN0aW5nIGxpYnJhcnkuXG4gICAgLy8gTW9yZSBkZXRhaWxzOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMjU0MDUuXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnZXMyMDE1JywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICBlbnRyeU5hbWVzOiBvdXRwdXROYW1lcy5idW5kbGVzLFxuICAgIHRhcmdldCxcbiAgICBzcGxpdHRpbmc6IGZhbHNlLFxuICAgIHN1cHBvcnRlZDogZ2V0RmVhdHVyZVN1cHBvcnQodGFyZ2V0KSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVTb3VyY2VtYXBJZ25vcmVsaXN0UGx1Z2luKCksXG4gICAgICBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgICAgICAgLy8gSlMvVFMgb3B0aW9uc1xuICAgICAgICB7IC4uLnBsdWdpbk9wdGlvbnMsIG5vb3BUeXBlU2NyaXB0Q29tcGlsYXRpb246IHRydWUgfSxcbiAgICAgICAgLy8gQ29tcG9uZW50IHN0eWxlc2hlZXQgb3B0aW9ucyBhcmUgdW51c2VkIGZvciBwb2x5ZmlsbHMgYnV0IHJlcXVpcmVkIGJ5IHRoZSBwbHVnaW5cbiAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgKSxcbiAgICBdLFxuICB9O1xuICBidWlsZE9wdGlvbnMucGx1Z2lucyA/Pz0gW107XG5cbiAgY29uc3QgcG9seWZpbGxzID0gb3B0aW9ucy5wb2x5ZmlsbHMgPyBbLi4ub3B0aW9ucy5wb2x5ZmlsbHNdIDogW107XG5cbiAgLy8gQW5ndWxhciBKSVQgbW9kZSByZXF1aXJlcyB0aGUgcnVudGltZSBjb21waWxlclxuICBpZiAoaml0KSB7XG4gICAgcG9seWZpbGxzLnB1c2goJ0Bhbmd1bGFyL2NvbXBpbGVyJyk7XG4gIH1cblxuICAvLyBBZGQgQW5ndWxhcidzIGdsb2JhbCBsb2NhbGUgZGF0YSBpZiBpMThuIG9wdGlvbnMgYXJlIHByZXNlbnQuXG4gIC8vIExvY2FsZSBkYXRhIHNob3VsZCBnbyBmaXJzdCBzbyB0aGF0IHByb2plY3QgcHJvdmlkZWQgcG9seWZpbGwgY29kZSBjYW4gYXVnbWVudCBpZiBuZWVkZWQuXG4gIGxldCBuZWVkTG9jYWxlRGF0YVBsdWdpbiA9IGZhbHNlO1xuICBpZiAob3B0aW9ucy5pMThuT3B0aW9ucy5zaG91bGRJbmxpbmUpIHtcbiAgICAvLyBXaGVuIGlubGluaW5nLCBhIHBsYWNlaG9sZGVyIGlzIHVzZWQgdG8gYWxsb3cgdGhlIHBvc3QtcHJvY2Vzc2luZyBzdGVwIHRvIGluamVjdCB0aGUgJGxvY2FsaXplIGxvY2FsZSBpZGVudGlmaWVyXG4gICAgcG9seWZpbGxzLnVuc2hpZnQoJ2FuZ3VsYXI6bG9jYWxlL3BsYWNlaG9sZGVyJyk7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnM/LnVuc2hpZnQoXG4gICAgICBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnYW5ndWxhcjpsb2NhbGUvcGxhY2Vob2xkZXInLFxuICAgICAgICBlbnRyeVBvaW50T25seTogZmFsc2UsXG4gICAgICAgIGxvYWRDb250ZW50OiAoKSA9PiAoe1xuICAgICAgICAgIGNvbnRlbnRzOiBgKGdsb2JhbFRoaXMuJGxvY2FsaXplID8/PSB7fSkubG9jYWxlID0gXCJfX19OR19MT0NBTEVfSU5TRVJUX19fXCI7XFxuYCxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgfSksXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgLy8gQWRkIGxvY2FsZSBkYXRhIGZvciBhbGwgYWN0aXZlIGxvY2FsZXNcbiAgICAvLyBUT0RPOiBJbmplY3QgZWFjaCBpbmRpdmlkdWFsbHkgd2l0aGluIHRoZSBpbmxpbmluZyBwcm9jZXNzIGl0c2VsZlxuICAgIGZvciAoY29uc3QgbG9jYWxlIG9mIG9wdGlvbnMuaTE4bk9wdGlvbnMuaW5saW5lTG9jYWxlcykge1xuICAgICAgcG9seWZpbGxzLnVuc2hpZnQoYGFuZ3VsYXI6bG9jYWxlL2RhdGE6JHtsb2NhbGV9YCk7XG4gICAgfVxuICAgIG5lZWRMb2NhbGVEYXRhUGx1Z2luID0gdHJ1ZTtcbiAgfSBlbHNlIGlmIChvcHRpb25zLmkxOG5PcHRpb25zLmhhc0RlZmluZWRTb3VyY2VMb2NhbGUpIHtcbiAgICAvLyBXaGVuIG5vdCBpbmxpbmluZyBhbmQgYSBzb3VyY2UgbG9jYWwgaXMgcHJlc2VudCwgdXNlIHRoZSBzb3VyY2UgbG9jYWxlIGRhdGEgZGlyZWN0bHlcbiAgICBwb2x5ZmlsbHMudW5zaGlmdChgYW5ndWxhcjpsb2NhbGUvZGF0YToke29wdGlvbnMuaTE4bk9wdGlvbnMuc291cmNlTG9jYWxlfWApO1xuICAgIG5lZWRMb2NhbGVEYXRhUGx1Z2luID0gdHJ1ZTtcbiAgfVxuICBpZiAobmVlZExvY2FsZURhdGFQbHVnaW4pIHtcbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucz8ucHVzaChjcmVhdGVBbmd1bGFyTG9jYWxlRGF0YVBsdWdpbigpKTtcbiAgfVxuXG4gIGlmIChwb2x5ZmlsbHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gQWRkIHBvbHlmaWxsIGVudHJ5IHBvaW50IGlmIHBvbHlmaWxscyBhcmUgcHJlc2VudFxuICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpwb2x5ZmlsbHMnO1xuICBidWlsZE9wdGlvbnMuZW50cnlQb2ludHMgPSB7XG4gICAgJ3BvbHlmaWxscyc6IG5hbWVzcGFjZSxcbiAgfTtcblxuICBidWlsZE9wdGlvbnMucGx1Z2lucz8udW5zaGlmdChcbiAgICBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luKHtcbiAgICAgIG5hbWVzcGFjZSxcbiAgICAgIGxvYWRDb250ZW50OiBhc3luYyAoXywgYnVpbGQpID0+IHtcbiAgICAgICAgbGV0IGhhc0xvY2FsaXplUG9seWZpbGwgPSBmYWxzZTtcbiAgICAgICAgY29uc3QgcG9seWZpbGxQYXRocyA9IGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgIHBvbHlmaWxscy5tYXAoYXN5bmMgKHBhdGgpID0+IHtcbiAgICAgICAgICAgIGhhc0xvY2FsaXplUG9seWZpbGwgfHw9IHBhdGguc3RhcnRzV2l0aCgnQGFuZ3VsYXIvbG9jYWxpemUnKTtcblxuICAgICAgICAgICAgaWYgKHBhdGguc3RhcnRzV2l0aCgnem9uZS5qcycpIHx8ICFleHRuYW1lKHBhdGgpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwb3RlbnRpYWxQYXRoUmVsYXRpdmUgPSAnLi8nICsgcGF0aDtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJ1aWxkLnJlc29sdmUocG90ZW50aWFsUGF0aFJlbGF0aXZlLCB7XG4gICAgICAgICAgICAgIGtpbmQ6ICdpbXBvcnQtc3RhdGVtZW50JyxcbiAgICAgICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0LnBhdGggPyBwb3RlbnRpYWxQYXRoUmVsYXRpdmUgOiBwYXRoO1xuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuXG4gICAgICAgIGlmICghb3B0aW9ucy5pMThuT3B0aW9ucy5zaG91bGRJbmxpbmUgJiYgIWhhc0xvY2FsaXplUG9seWZpbGwpIHtcbiAgICAgICAgICAvLyBDYW5ub3QgdXNlIGBidWlsZC5yZXNvbHZlYCBoZXJlIHNpbmNlIGl0IGRvZXMgbm90IGFsbG93IG92ZXJyaWRpbmcgdGhlIGV4dGVybmFsIG9wdGlvbnNcbiAgICAgICAgICAvLyBhbmQgdGhlIGFjdHVhbCBwcmVzZW5jZSBvZiB0aGUgYEBhbmd1bGFyL2xvY2FsaXplYCBwYWNrYWdlIG5lZWRzIHRvIGJlIGNoZWNrZWQgaGVyZS5cbiAgICAgICAgICBjb25zdCB3b3Jrc3BhY2VSZXF1aXJlID0gY3JlYXRlUmVxdWlyZSh3b3Jrc3BhY2VSb290ICsgJy8nKTtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgd29ya3NwYWNlUmVxdWlyZS5yZXNvbHZlKCdAYW5ndWxhci9sb2NhbGl6ZScpO1xuICAgICAgICAgICAgLy8gVGhlIHJlc29sdmUgY2FsbCBhYm92ZSB3aWxsIHRocm93IGlmIG5vdCBmb3VuZFxuICAgICAgICAgICAgcG9seWZpbGxQYXRocy5wdXNoKCdAYW5ndWxhci9sb2NhbGl6ZS9pbml0Jyk7XG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgbW9kdWxlIGNvbnRlbnRzIHdpdGggYW4gaW1wb3J0IHN0YXRlbWVudCBwZXIgZGVmaW5lZCBwb2x5ZmlsbFxuICAgICAgICBsZXQgY29udGVudHMgPSBwb2x5ZmlsbFBhdGhzXG4gICAgICAgICAgLm1hcCgoZmlsZSkgPT4gYGltcG9ydCAnJHtmaWxlLnJlcGxhY2UoL1xcXFwvZywgJy8nKX0nO2ApXG4gICAgICAgICAgLmpvaW4oJ1xcbicpO1xuXG4gICAgICAgIC8vIElmIG5vdCBpbmxpbmluZyB0cmFuc2xhdGlvbnMgYW5kIHNvdXJjZSBsb2NhbGUgaXMgZGVmaW5lZCwgaW5qZWN0IHRoZSBsb2NhbGUgc3BlY2lmaWVyXG4gICAgICAgIGlmICghb3B0aW9ucy5pMThuT3B0aW9ucy5zaG91bGRJbmxpbmUgJiYgb3B0aW9ucy5pMThuT3B0aW9ucy5oYXNEZWZpbmVkU291cmNlTG9jYWxlKSB7XG4gICAgICAgICAgY29udGVudHMgKz0gYChnbG9iYWxUaGlzLiRsb2NhbGl6ZSA/Pz0ge30pLmxvY2FsZSA9IFwiJHtvcHRpb25zLmkxOG5PcHRpb25zLnNvdXJjZUxvY2FsZX1cIjtcXG5gO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgfSksXG4gICk7XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gZXNidWlsZCAnYnVpbGQnIG9wdGlvbnMgb2JqZWN0IGZvciB0aGUgc2VydmVyIGJ1bmRsZS5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBidWlsZGVyJ3MgdXNlci1wcm92aWRlciBub3JtYWxpemVkIG9wdGlvbnMuXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIEJ1aWxkT3B0aW9ucyBvYmplY3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTZXJ2ZXJDb2RlQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU6IFNvdXJjZUZpbGVDYWNoZSxcbik6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHtcbiAgICBqaXQsXG4gICAgc2VydmVyRW50cnlQb2ludCxcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIHNzck9wdGlvbnMsXG4gICAgd2F0Y2gsXG4gICAgZXh0ZXJuYWxQYWNrYWdlcyxcbiAgICBwcmVyZW5kZXJPcHRpb25zLFxuICB9ID0gb3B0aW9ucztcblxuICBhc3NlcnQoXG4gICAgc2VydmVyRW50cnlQb2ludCxcbiAgICAnY3JlYXRlU2VydmVyQ29kZUJ1bmRsZU9wdGlvbnMgc2hvdWxkIG5vdCBiZSBjYWxsZWQgd2l0aG91dCBhIGRlZmluZWQgc2VydmVyRW50cnlQb2ludC4nLFxuICApO1xuXG4gIGNvbnN0IHsgcGx1Z2luT3B0aW9ucywgc3R5bGVPcHRpb25zIH0gPSBjcmVhdGVDb21waWxlclBsdWdpbk9wdGlvbnMoXG4gICAgb3B0aW9ucyxcbiAgICB0YXJnZXQsXG4gICAgc291cmNlRmlsZUNhY2hlLFxuICApO1xuXG4gIGNvbnN0IG1haW5TZXJ2ZXJOYW1lc3BhY2UgPSAnYW5ndWxhcjptYWluLXNlcnZlcic7XG4gIGNvbnN0IHNzckVudHJ5TmFtZXNwYWNlID0gJ2FuZ3VsYXI6c3NyLWVudHJ5JztcblxuICBjb25zdCBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAnbWFpbi5zZXJ2ZXInOiBtYWluU2VydmVyTmFtZXNwYWNlLFxuICB9O1xuXG4gIGNvbnN0IHNzckVudHJ5UG9pbnQgPSBzc3JPcHRpb25zPy5lbnRyeTtcbiAgaWYgKHNzckVudHJ5UG9pbnQpIHtcbiAgICBlbnRyeVBvaW50c1snc2VydmVyJ10gPSBzc3JFbnRyeU5hbWVzcGFjZTtcbiAgfVxuXG4gIGNvbnN0IGJ1aWxkT3B0aW9uczogQnVpbGRPcHRpb25zID0ge1xuICAgIC4uLmdldEVzQnVpbGRDb21tb25PcHRpb25zKG9wdGlvbnMpLFxuICAgIHBsYXRmb3JtOiAnbm9kZScsXG4gICAgLy8gVE9ETzogSW52ZXNpZ2F0ZSB3aHkgZW5hYmxpbmcgYHNwbGl0dGluZ2AgaW4gSklUIG1vZGUgY2F1c2VzIGFuIFwiJ0Bhbmd1bGFyL2NvbXBpbGVyJyBpcyBub3QgYXZhaWxhYmxlXCIgZXJyb3IuXG4gICAgc3BsaXR0aW5nOiAhaml0LFxuICAgIG91dEV4dGVuc2lvbjogeyAnLmpzJzogJy5tanMnIH0sXG4gICAgLy8gTm90ZTogYGVzMjAxNWAgaXMgbmVlZGVkIGZvciBSeEpTIHY2LiBJZiBub3Qgc3BlY2lmaWVkLCBgbW9kdWxlYCB3b3VsZFxuICAgIC8vIG1hdGNoIGFuZCB0aGUgRVM1IGRpc3RyaWJ1dGlvbiB3b3VsZCBiZSBidW5kbGVkIGFuZCBlbmRzIHVwIGJyZWFraW5nIGF0XG4gICAgLy8gcnVudGltZSB3aXRoIHRoZSBSeEpTIHRlc3RpbmcgbGlicmFyeS5cbiAgICAvLyBNb3JlIGRldGFpbHM6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNTQwNS5cbiAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICBlbnRyeU5hbWVzOiAnW25hbWVdJyxcbiAgICB0YXJnZXQsXG4gICAgYmFubmVyOiB7XG4gICAgICAvLyBOb3RlOiBOZWVkZWQgYXMgZXNidWlsZCBkb2VzIG5vdCBwcm92aWRlIHJlcXVpcmUgc2hpbXMgLyBwcm94eSBmcm9tIEVTTW9kdWxlcy5cbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2V2YW53L2VzYnVpbGQvaXNzdWVzLzE5MjEuXG4gICAgICBqczogW1xuICAgICAgICBgaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJztgLFxuICAgICAgICBgZ2xvYmFsVGhpc1sncmVxdWlyZSddID8/PSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybCk7YCxcbiAgICAgIF0uam9pbignXFxuJyksXG4gICAgfSxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBzdXBwb3J0ZWQ6IGdldEZlYXR1cmVTdXBwb3J0KHRhcmdldCksXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlU291cmNlbWFwSWdub3JlbGlzdFBsdWdpbigpLFxuICAgICAgY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gICAgICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICAgICAgeyAuLi5wbHVnaW5PcHRpb25zLCBub29wVHlwZVNjcmlwdENvbXBpbGF0aW9uOiB0cnVlIH0sXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgKSxcbiAgICBdLFxuICB9O1xuXG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zID8/PSBbXTtcbiAgaWYgKGV4dGVybmFsUGFja2FnZXMpIHtcbiAgICBidWlsZE9wdGlvbnMucGFja2FnZXMgPSAnZXh0ZXJuYWwnO1xuICB9IGVsc2Uge1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goY3JlYXRlUnhqc0VzbVJlc29sdXRpb25QbHVnaW4oKSk7XG4gIH1cblxuICBjb25zdCBwb2x5ZmlsbHM6IHN0cmluZ1tdID0gW107XG4gIGlmIChvcHRpb25zLnBvbHlmaWxscz8uaW5jbHVkZXMoJ3pvbmUuanMnKSkge1xuICAgIHBvbHlmaWxscy5wdXNoKGBpbXBvcnQgJ3pvbmUuanMvbm9kZSc7YCk7XG4gIH1cblxuICBpZiAoaml0KSB7XG4gICAgcG9seWZpbGxzLnB1c2goYGltcG9ydCAnQGFuZ3VsYXIvY29tcGlsZXInO2ApO1xuICB9XG5cbiAgcG9seWZpbGxzLnB1c2goYGltcG9ydCAnQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyL2luaXQnO2ApO1xuXG4gIC8vIEFkZCBBbmd1bGFyJ3MgZ2xvYmFsIGxvY2FsZSBkYXRhIGlmIGkxOG4gb3B0aW9ucyBhcmUgcHJlc2VudC5cbiAgbGV0IG5lZWRMb2NhbGVEYXRhUGx1Z2luID0gZmFsc2U7XG4gIGlmIChvcHRpb25zLmkxOG5PcHRpb25zLnNob3VsZElubGluZSkge1xuICAgIC8vIEFkZCBsb2NhbGUgZGF0YSBmb3IgYWxsIGFjdGl2ZSBsb2NhbGVzXG4gICAgZm9yIChjb25zdCBsb2NhbGUgb2Ygb3B0aW9ucy5pMThuT3B0aW9ucy5pbmxpbmVMb2NhbGVzKSB7XG4gICAgICBwb2x5ZmlsbHMudW5zaGlmdChgaW1wb3J0ICdhbmd1bGFyOmxvY2FsZS9kYXRhOiR7bG9jYWxlfSc7YCk7XG4gICAgfVxuICAgIG5lZWRMb2NhbGVEYXRhUGx1Z2luID0gdHJ1ZTtcbiAgfSBlbHNlIGlmIChvcHRpb25zLmkxOG5PcHRpb25zLmhhc0RlZmluZWRTb3VyY2VMb2NhbGUpIHtcbiAgICAvLyBXaGVuIG5vdCBpbmxpbmluZyBhbmQgYSBzb3VyY2UgbG9jYWwgaXMgcHJlc2VudCwgdXNlIHRoZSBzb3VyY2UgbG9jYWxlIGRhdGEgZGlyZWN0bHlcbiAgICBwb2x5ZmlsbHMudW5zaGlmdChgaW1wb3J0ICdhbmd1bGFyOmxvY2FsZS9kYXRhOiR7b3B0aW9ucy5pMThuT3B0aW9ucy5zb3VyY2VMb2NhbGV9JztgKTtcbiAgICBuZWVkTG9jYWxlRGF0YVBsdWdpbiA9IHRydWU7XG4gIH1cbiAgaWYgKG5lZWRMb2NhbGVEYXRhUGx1Z2luKSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnMucHVzaChjcmVhdGVBbmd1bGFyTG9jYWxlRGF0YVBsdWdpbigpKTtcbiAgfVxuXG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goXG4gICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICBuYW1lc3BhY2U6IG1haW5TZXJ2ZXJOYW1lc3BhY2UsXG4gICAgICBsb2FkQ29udGVudDogYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBtYWluU2VydmVyRW50cnlQb2ludCA9IHJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIHNlcnZlckVudHJ5UG9pbnQpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcblxuICAgICAgICBjb25zdCBjb250ZW50cyA9IFtcbiAgICAgICAgICAuLi5wb2x5ZmlsbHMsXG4gICAgICAgICAgYGltcG9ydCBtb2R1bGVPckJvb3RzdHJhcEZuIGZyb20gJy4vJHttYWluU2VydmVyRW50cnlQb2ludH0nO2AsXG4gICAgICAgICAgYGV4cG9ydCBkZWZhdWx0IG1vZHVsZU9yQm9vdHN0cmFwRm47YCxcbiAgICAgICAgICBgZXhwb3J0ICogZnJvbSAnLi8ke21haW5TZXJ2ZXJFbnRyeVBvaW50fSc7YCxcbiAgICAgICAgICBgZXhwb3J0IHsgybVDb25zb2xlIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7YCxcbiAgICAgICAgICBgZXhwb3J0IHsgcmVuZGVyQXBwbGljYXRpb24sIHJlbmRlck1vZHVsZSwgybVTRVJWRVJfQ09OVEVYVCB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcic7YCxcbiAgICAgICAgXTtcblxuICAgICAgICBpZiAod2F0Y2gpIHtcbiAgICAgICAgICBjb250ZW50cy5wdXNoKGBleHBvcnQgeyDJtXJlc2V0Q29tcGlsZWRDb21wb25lbnRzIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7YCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgICAgICAgLy8gQ2Fubm90IHVzZSBgYnVpbGQucmVzb2x2ZWAgaGVyZSBzaW5jZSBpdCBkb2VzIG5vdCBhbGxvdyBvdmVycmlkaW5nIHRoZSBleHRlcm5hbCBvcHRpb25zXG4gICAgICAgICAgLy8gYW5kIHRoZSBhY3R1YWwgcHJlc2VuY2Ugb2YgdGhlIGBAYW5ndWxhci9sb2NhbGl6ZWAgcGFja2FnZSBuZWVkcyB0byBiZSBjaGVja2VkIGhlcmUuXG4gICAgICAgICAgY29uc3Qgd29ya3NwYWNlUmVxdWlyZSA9IGNyZWF0ZVJlcXVpcmUod29ya3NwYWNlUm9vdCArICcvJyk7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHdvcmtzcGFjZVJlcXVpcmUucmVzb2x2ZSgnQGFuZ3VsYXIvbG9jYWxpemUnKTtcbiAgICAgICAgICAgIC8vIFRoZSByZXNvbHZlIGNhbGwgYWJvdmUgd2lsbCB0aHJvdyBpZiBub3QgZm91bmRcbiAgICAgICAgICAgIGNvbnRlbnRzLnB1c2goYGltcG9ydCAnQGFuZ3VsYXIvbG9jYWxpemUvaW5pdCc7YCk7XG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgICAgICAgLy8gV2hlbiBpbmxpbmluZywgYSBwbGFjZWhvbGRlciBpcyB1c2VkIHRvIGFsbG93IHRoZSBwb3N0LXByb2Nlc3Npbmcgc3RlcCB0byBpbmplY3QgdGhlICRsb2NhbGl6ZSBsb2NhbGUgaWRlbnRpZmllclxuICAgICAgICAgIGNvbnRlbnRzLnB1c2goJyhnbG9iYWxUaGlzLiRsb2NhbGl6ZSA/Pz0ge30pLmxvY2FsZSA9IFwiX19fTkdfTE9DQUxFX0lOU0VSVF9fX1wiOycpO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuaTE4bk9wdGlvbnMuaGFzRGVmaW5lZFNvdXJjZUxvY2FsZSkge1xuICAgICAgICAgIC8vIElmIG5vdCBpbmxpbmluZyB0cmFuc2xhdGlvbnMgYW5kIHNvdXJjZSBsb2NhbGUgaXMgZGVmaW5lZCwgaW5qZWN0IHRoZSBsb2NhbGUgc3BlY2lmaWVyXG4gICAgICAgICAgY29udGVudHMucHVzaChcbiAgICAgICAgICAgIGAoZ2xvYmFsVGhpcy4kbG9jYWxpemUgPz89IHt9KS5sb2NhbGUgPSBcIiR7b3B0aW9ucy5pMThuT3B0aW9ucy5zb3VyY2VMb2NhbGV9XCI7YCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHByZXJlbmRlck9wdGlvbnM/LmRpc2NvdmVyUm91dGVzKSB7XG4gICAgICAgICAgLy8gV2UgZG8gbm90IGltcG9ydCBpdCBkaXJlY3RseSBzbyB0aGF0IG5vZGUuanMgbW9kdWxlcyBhcmUgcmVzb2x2ZWQgdXNpbmcgdGhlIGNvcnJlY3QgY29udGV4dC5cbiAgICAgICAgICBjb25zdCByb3V0ZXNFeHRyYWN0b3JDb2RlID0gYXdhaXQgcmVhZEZpbGUoXG4gICAgICAgICAgICBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3V0aWxzL3JvdXRlcy1leHRyYWN0b3IvZXh0cmFjdG9yLmpzJyksXG4gICAgICAgICAgICAndXRmLTgnLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICAvLyBSZW1vdmUgc291cmNlIG1hcCBVUkwgY29tbWVudHMgZnJvbSB0aGUgY29kZSBpZiBhIHNvdXJjZW1hcCBpcyBwcmVzZW50IGFzIHRoaXMgd2lsbCBub3QgbWF0Y2ggdGhlIGZpbGUuXG4gICAgICAgICAgY29udGVudHMucHVzaChyb3V0ZXNFeHRyYWN0b3JDb2RlLnJlcGxhY2UoL15cXC9cXC8jIHNvdXJjZU1hcHBpbmdVUkw9W15cXHJcXG5dKi9nbSwgJycpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgY29udGVudHM6IGNvbnRlbnRzLmpvaW4oJ1xcbicpLFxuICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICB9KSxcbiAgKTtcblxuICBpZiAoc3NyRW50cnlQb2ludCkge1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goXG4gICAgICBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luKHtcbiAgICAgICAgbmFtZXNwYWNlOiBzc3JFbnRyeU5hbWVzcGFjZSxcbiAgICAgICAgbG9hZENvbnRlbnQ6ICgpID0+IHtcbiAgICAgICAgICBjb25zdCBzZXJ2ZXJFbnRyeVBvaW50ID0gcmVsYXRpdmUod29ya3NwYWNlUm9vdCwgc3NyRW50cnlQb2ludCkucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNvbnRlbnRzOiBbXG4gICAgICAgICAgICAgIC4uLnBvbHlmaWxscyxcbiAgICAgICAgICAgICAgYGltcG9ydCAnLi8ke3NlcnZlckVudHJ5UG9pbnR9JztgLFxuICAgICAgICAgICAgICBgZXhwb3J0ICogZnJvbSAnLi8ke3NlcnZlckVudHJ5UG9pbnR9JztgLFxuICAgICAgICAgICAgXS5qb2luKCdcXG4nKSxcbiAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5wbHVnaW5zKSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnMucHVzaCguLi5vcHRpb25zLnBsdWdpbnMpO1xuICB9XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cblxuZnVuY3Rpb24gZ2V0RXNCdWlsZENvbW1vbk9wdGlvbnMob3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zKTogQnVpbGRPcHRpb25zIHtcbiAgY29uc3Qge1xuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgb3V0RXh0ZW5zaW9uLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB0c2NvbmZpZyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIGppdCxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgLy8gRW5zdXJlIHVuaXF1ZSBoYXNoZXMgZm9yIGkxOG4gdHJhbnNsYXRpb24gY2hhbmdlcyB3aGVuIHVzaW5nIHBvc3QtcHJvY2VzcyBpbmxpbmluZy5cbiAgLy8gVGhpcyBoYXNoIHZhbHVlIGlzIGFkZGVkIGFzIGEgZm9vdGVyIHRvIGVhY2ggZmlsZSBhbmQgZW5zdXJlcyB0aGF0IHRoZSBvdXRwdXQgZmlsZSBuYW1lcyAod2l0aCBoYXNoZXMpXG4gIC8vIGNoYW5nZSB3aGVuIHRyYW5zbGF0aW9uIGZpbGVzIGhhdmUgY2hhbmdlZC4gSWYgdGhpcyBpcyBub3QgZG9uZSB0aGUgcG9zdCBwcm9jZXNzZWQgZmlsZXMgbWF5IGhhdmVcbiAgLy8gZGlmZmVyZW50IGNvbnRlbnQgYnV0IHdvdWxkIHJldGFpbiBpZGVudGljYWwgcHJvZHVjdGlvbiBmaWxlIG5hbWVzIHdoaWNoIHdvdWxkIGxlYWQgdG8gYnJvd3NlciBjYWNoaW5nIHByb2JsZW1zLlxuICBsZXQgZm9vdGVyO1xuICBpZiAob3B0aW9ucy5pMThuT3B0aW9ucy5zaG91bGRJbmxpbmUpIHtcbiAgICAvLyBVcGRhdGUgZmlsZSBoYXNoZXMgdG8gaW5jbHVkZSB0cmFuc2xhdGlvbiBmaWxlIGNvbnRlbnRcbiAgICBjb25zdCBpMThuSGFzaCA9IE9iamVjdC52YWx1ZXMob3B0aW9ucy5pMThuT3B0aW9ucy5sb2NhbGVzKS5yZWR1Y2UoXG4gICAgICAoZGF0YSwgbG9jYWxlKSA9PiBkYXRhICsgbG9jYWxlLmZpbGVzLm1hcCgoZmlsZSkgPT4gZmlsZS5pbnRlZ3JpdHkgfHwgJycpLmpvaW4oJ3wnKSxcbiAgICAgICcnLFxuICAgICk7XG5cbiAgICBmb290ZXIgPSB7IGpzOiBgLyoqaTE4bjoke2NyZWF0ZUhhc2goJ3NoYTI1NicpLnVwZGF0ZShpMThuSGFzaCkuZGlnZXN0KCdoZXgnKX0qL2AgfTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgYWJzV29ya2luZ0Rpcjogd29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IHRydWUsXG4gICAgZm9ybWF0OiAnZXNtJyxcbiAgICBhc3NldE5hbWVzOiBvdXRwdXROYW1lcy5tZWRpYSxcbiAgICBjb25kaXRpb25zOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnbW9kdWxlJ10sXG4gICAgcmVzb2x2ZUV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBsZWdhbENvbW1lbnRzOiBvcHRpb25zLmV4dHJhY3RMaWNlbnNlcyA/ICdub25lJyA6ICdlb2YnLFxuICAgIGxvZ0xldmVsOiBvcHRpb25zLnZlcmJvc2UgPyAnZGVidWcnIDogJ3NpbGVudCcsXG4gICAgbWluaWZ5SWRlbnRpZmllcnM6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyAmJiBhbGxvd01hbmdsZSxcbiAgICBtaW5pZnlTeW50YXg6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBtaW5pZnlXaGl0ZXNwYWNlOiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgcHVyZTogWydmb3J3YXJkUmVmJ10sXG4gICAgb3V0ZGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIG91dEV4dGVuc2lvbjogb3V0RXh0ZW5zaW9uID8geyAnLmpzJzogYC4ke291dEV4dGVuc2lvbn1gIH0gOiB1bmRlZmluZWQsXG4gICAgc291cmNlbWFwOiBzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gJ2V4dGVybmFsJyA6IHRydWUpLFxuICAgIHNwbGl0dGluZzogdHJ1ZSxcbiAgICBjaHVua05hbWVzOiBvcHRpb25zLm5hbWVkQ2h1bmtzID8gJ1tuYW1lXS1baGFzaF0nIDogJ2NodW5rLVtoYXNoXScsXG4gICAgdHNjb25maWcsXG4gICAgZXh0ZXJuYWw6IGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIGRlZmluZToge1xuICAgICAgLy8gT25seSBzZXQgdG8gZmFsc2Ugd2hlbiBzY3JpcHQgb3B0aW1pemF0aW9ucyBhcmUgZW5hYmxlZC4gSXQgc2hvdWxkIG5vdCBiZSBzZXQgdG8gdHJ1ZSBiZWNhdXNlXG4gICAgICAvLyBBbmd1bGFyIHR1cm5zIGBuZ0Rldk1vZGVgIGludG8gYW4gb2JqZWN0IGZvciBkZXZlbG9wbWVudCBkZWJ1Z2dpbmcgcHVycG9zZXMgd2hlbiBub3QgZGVmaW5lZFxuICAgICAgLy8gd2hpY2ggYSBjb25zdGFudCB0cnVlIHZhbHVlIHdvdWxkIGJyZWFrLlxuICAgICAgLi4uKG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyA/IHsgJ25nRGV2TW9kZSc6ICdmYWxzZScgfSA6IHVuZGVmaW5lZCksXG4gICAgICAnbmdKaXRNb2RlJzogaml0ID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICB9LFxuICAgIGZvb3RlcixcbiAgICBwdWJsaWNQYXRoOiBvcHRpb25zLnB1YmxpY1BhdGgsXG4gIH07XG59XG4iXX0=