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
    }
    if (options.plugins) {
        buildOptions.plugins?.push(...options.plugins);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24tY29kZS1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FwcGxpY2F0aW9uLWNvZGUtYnVuZGxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw2Q0FBeUM7QUFDekMsK0NBQTRDO0FBQzVDLDZDQUE0QztBQUM1Qyx5Q0FBb0Q7QUFFcEQseUVBQThEO0FBQzlELCtEQUFpRTtBQUVqRSx1RUFBd0U7QUFDeEUsNkRBQXFFO0FBQ3JFLDZFQUE2RTtBQUM3RSwrRUFBZ0Y7QUFDaEYsbUNBQTRDO0FBQzVDLG1FQUFvRTtBQUVwRSxTQUFnQiw4QkFBOEIsQ0FDNUMsT0FBMEMsRUFDMUMsTUFBZ0IsRUFDaEIsZUFBaUM7SUFFakMsTUFBTSxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLEdBQUcsRUFBRSxHQUFHLE9BQU8sQ0FBQztJQUVqRSxNQUFNLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxHQUFHLElBQUEscURBQTJCLEVBQ2pFLE9BQU8sRUFDUCxNQUFNLEVBQ04sZUFBZSxDQUNoQixDQUFDO0lBRUYsTUFBTSxZQUFZLEdBQWlCO1FBQ2pDLEdBQUcsdUJBQXVCLENBQUMsT0FBTyxDQUFDO1FBQ25DLFFBQVEsRUFBRSxTQUFTO1FBQ25CLHlFQUF5RTtRQUN6RSwwRUFBMEU7UUFDMUUseUNBQXlDO1FBQ3pDLHFFQUFxRTtRQUNyRSxVQUFVLEVBQUUsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDO1FBQzdELFVBQVUsRUFBRSxXQUFXLENBQUMsT0FBTztRQUMvQixXQUFXO1FBQ1gsTUFBTTtRQUNOLFNBQVMsRUFBRSxJQUFBLHlCQUFpQixF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QW1CLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQ3ZFLFdBQVcsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTztTQUNwQztRQUNELE1BQU07UUFDTixVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVU7S0FDL0IsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZE9wdGlvbnMgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ25vZGU6Y3J5cHRvJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBjcmVhdGVSZXF1aXJlIH0gZnJvbSAnbm9kZTptb2R1bGUnO1xuaW1wb3J0IHsgZXh0bmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHR5cGUgeyBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMgfSBmcm9tICcuLi8uLi9idWlsZGVycy9hcHBsaWNhdGlvbi9vcHRpb25zJztcbmltcG9ydCB7IGFsbG93TWFuZ2xlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBjcmVhdGVDb21waWxlclBsdWdpbiB9IGZyb20gJy4vYW5ndWxhci9jb21waWxlci1wbHVnaW4nO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlIH0gZnJvbSAnLi9hbmd1bGFyL3NvdXJjZS1maWxlLWNhY2hlJztcbmltcG9ydCB7IGNyZWF0ZUNvbXBpbGVyUGx1Z2luT3B0aW9ucyB9IGZyb20gJy4vY29tcGlsZXItcGx1Z2luLW9wdGlvbnMnO1xuaW1wb3J0IHsgY3JlYXRlQW5ndWxhckxvY2FsZURhdGFQbHVnaW4gfSBmcm9tICcuL2kxOG4tbG9jYWxlLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVSeGpzRXNtUmVzb2x1dGlvblBsdWdpbiB9IGZyb20gJy4vcnhqcy1lc20tcmVzb2x1dGlvbi1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlU291cmNlbWFwSWdub3JlbGlzdFBsdWdpbiB9IGZyb20gJy4vc291cmNlbWFwLWlnbm9yZWxpc3QtcGx1Z2luJztcbmltcG9ydCB7IGdldEZlYXR1cmVTdXBwb3J0IH0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQgeyBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luIH0gZnJvbSAnLi92aXJ0dWFsLW1vZHVsZS1wbHVnaW4nO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQnJvd3NlckNvZGVCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZSxcbik6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHsgd29ya3NwYWNlUm9vdCwgZW50cnlQb2ludHMsIG91dHB1dE5hbWVzLCBqaXQgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgeyBwbHVnaW5PcHRpb25zLCBzdHlsZU9wdGlvbnMgfSA9IGNyZWF0ZUNvbXBpbGVyUGx1Z2luT3B0aW9ucyhcbiAgICBvcHRpb25zLFxuICAgIHRhcmdldCxcbiAgICBzb3VyY2VGaWxlQ2FjaGUsXG4gICk7XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zOiBCdWlsZE9wdGlvbnMgPSB7XG4gICAgLi4uZ2V0RXNCdWlsZENvbW1vbk9wdGlvbnMob3B0aW9ucyksXG4gICAgcGxhdGZvcm06ICdicm93c2VyJyxcbiAgICAvLyBOb3RlOiBgZXMyMDE1YCBpcyBuZWVkZWQgZm9yIFJ4SlMgdjYuIElmIG5vdCBzcGVjaWZpZWQsIGBtb2R1bGVgIHdvdWxkXG4gICAgLy8gbWF0Y2ggYW5kIHRoZSBFUzUgZGlzdHJpYnV0aW9uIHdvdWxkIGJlIGJ1bmRsZWQgYW5kIGVuZHMgdXAgYnJlYWtpbmcgYXRcbiAgICAvLyBydW50aW1lIHdpdGggdGhlIFJ4SlMgdGVzdGluZyBsaWJyYXJ5LlxuICAgIC8vIE1vcmUgZGV0YWlsczogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzI1NDA1LlxuICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgZW50cnlOYW1lczogb3V0cHV0TmFtZXMuYnVuZGxlcyxcbiAgICBlbnRyeVBvaW50cyxcbiAgICB0YXJnZXQsXG4gICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNvdXJjZW1hcElnbm9yZWxpc3RQbHVnaW4oKSxcbiAgICAgIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICAgICAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgICAgIHBsdWdpbk9wdGlvbnMsXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgKSxcbiAgICBdLFxuICB9O1xuXG4gIGlmIChvcHRpb25zLmV4dGVybmFsUGFja2FnZXMpIHtcbiAgICBidWlsZE9wdGlvbnMucGFja2FnZXMgPSAnZXh0ZXJuYWwnO1xuICB9XG5cbiAgY29uc3QgcG9seWZpbGxzID0gb3B0aW9ucy5wb2x5ZmlsbHMgPyBbLi4ub3B0aW9ucy5wb2x5ZmlsbHNdIDogW107XG5cbiAgLy8gQW5ndWxhciBKSVQgbW9kZSByZXF1aXJlcyB0aGUgcnVudGltZSBjb21waWxlclxuICBpZiAoaml0KSB7XG4gICAgcG9seWZpbGxzLnB1c2goJ0Bhbmd1bGFyL2NvbXBpbGVyJyk7XG4gIH1cblxuICAvLyBBZGQgQW5ndWxhcidzIGdsb2JhbCBsb2NhbGUgZGF0YSBpZiBpMThuIG9wdGlvbnMgYXJlIHByZXNlbnQuXG4gIC8vIExvY2FsZSBkYXRhIHNob3VsZCBnbyBmaXJzdCBzbyB0aGF0IHByb2plY3QgcHJvdmlkZWQgcG9seWZpbGwgY29kZSBjYW4gYXVnbWVudCBpZiBuZWVkZWQuXG4gIGxldCBuZWVkTG9jYWxlRGF0YVBsdWdpbiA9IGZhbHNlO1xuICBpZiAob3B0aW9ucy5pMThuT3B0aW9ucy5zaG91bGRJbmxpbmUpIHtcbiAgICAvLyBXaGVuIGlubGluaW5nLCBhIHBsYWNlaG9sZGVyIGlzIHVzZWQgdG8gYWxsb3cgdGhlIHBvc3QtcHJvY2Vzc2luZyBzdGVwIHRvIGluamVjdCB0aGUgJGxvY2FsaXplIGxvY2FsZSBpZGVudGlmaWVyXG4gICAgcG9seWZpbGxzLnVuc2hpZnQoJ2FuZ3VsYXI6bG9jYWxlL3BsYWNlaG9sZGVyJyk7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnM/LnVuc2hpZnQoXG4gICAgICBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnYW5ndWxhcjpsb2NhbGUvcGxhY2Vob2xkZXInLFxuICAgICAgICBlbnRyeVBvaW50T25seTogZmFsc2UsXG4gICAgICAgIGxvYWRDb250ZW50OiAoKSA9PiAoe1xuICAgICAgICAgIGNvbnRlbnRzOiBgKGdsb2JhbFRoaXMuJGxvY2FsaXplID8/PSB7fSkubG9jYWxlID0gXCJfX19OR19MT0NBTEVfSU5TRVJUX19fXCI7XFxuYCxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgfSksXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgLy8gQWRkIGxvY2FsZSBkYXRhIGZvciBhbGwgYWN0aXZlIGxvY2FsZXNcbiAgICAvLyBUT0RPOiBJbmplY3QgZWFjaCBpbmRpdmlkdWFsbHkgd2l0aGluIHRoZSBpbmxpbmluZyBwcm9jZXNzIGl0c2VsZlxuICAgIGZvciAoY29uc3QgbG9jYWxlIG9mIG9wdGlvbnMuaTE4bk9wdGlvbnMuaW5saW5lTG9jYWxlcykge1xuICAgICAgcG9seWZpbGxzLnVuc2hpZnQoYGFuZ3VsYXI6bG9jYWxlL2RhdGE6JHtsb2NhbGV9YCk7XG4gICAgfVxuICAgIG5lZWRMb2NhbGVEYXRhUGx1Z2luID0gdHJ1ZTtcbiAgfSBlbHNlIGlmIChvcHRpb25zLmkxOG5PcHRpb25zLmhhc0RlZmluZWRTb3VyY2VMb2NhbGUpIHtcbiAgICAvLyBXaGVuIG5vdCBpbmxpbmluZyBhbmQgYSBzb3VyY2UgbG9jYWwgaXMgcHJlc2VudCwgdXNlIHRoZSBzb3VyY2UgbG9jYWxlIGRhdGEgZGlyZWN0bHlcbiAgICBwb2x5ZmlsbHMudW5zaGlmdChgYW5ndWxhcjpsb2NhbGUvZGF0YToke29wdGlvbnMuaTE4bk9wdGlvbnMuc291cmNlTG9jYWxlfWApO1xuICAgIG5lZWRMb2NhbGVEYXRhUGx1Z2luID0gdHJ1ZTtcbiAgfVxuICBpZiAobmVlZExvY2FsZURhdGFQbHVnaW4pIHtcbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucz8ucHVzaChjcmVhdGVBbmd1bGFyTG9jYWxlRGF0YVBsdWdpbigpKTtcbiAgfVxuXG4gIC8vIEFkZCBwb2x5ZmlsbCBlbnRyeSBwb2ludCBpZiBwb2x5ZmlsbHMgYXJlIHByZXNlbnRcbiAgaWYgKHBvbHlmaWxscy5sZW5ndGgpIHtcbiAgICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpwb2x5ZmlsbHMnO1xuICAgIGJ1aWxkT3B0aW9ucy5lbnRyeVBvaW50cyA9IHtcbiAgICAgIC4uLmJ1aWxkT3B0aW9ucy5lbnRyeVBvaW50cyxcbiAgICAgICdwb2x5ZmlsbHMnOiBuYW1lc3BhY2UsXG4gICAgfTtcblxuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zPy51bnNoaWZ0KFxuICAgICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgbG9hZENvbnRlbnQ6IGFzeW5jIChfLCBidWlsZCkgPT4ge1xuICAgICAgICAgIGxldCBoYXNMb2NhbGl6ZVBvbHlmaWxsID0gZmFsc2U7XG4gICAgICAgICAgY29uc3QgcG9seWZpbGxQYXRocyA9IGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgICAgcG9seWZpbGxzLm1hcChhc3luYyAocGF0aCkgPT4ge1xuICAgICAgICAgICAgICBoYXNMb2NhbGl6ZVBvbHlmaWxsIHx8PSBwYXRoLnN0YXJ0c1dpdGgoJ0Bhbmd1bGFyL2xvY2FsaXplJyk7XG5cbiAgICAgICAgICAgICAgaWYgKHBhdGguc3RhcnRzV2l0aCgnem9uZS5qcycpIHx8ICFleHRuYW1lKHBhdGgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBwb3RlbnRpYWxQYXRoUmVsYXRpdmUgPSAnLi8nICsgcGF0aDtcbiAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZShwb3RlbnRpYWxQYXRoUmVsYXRpdmUsIHtcbiAgICAgICAgICAgICAgICBraW5kOiAnaW1wb3J0LXN0YXRlbWVudCcsXG4gICAgICAgICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC5wYXRoID8gcG90ZW50aWFsUGF0aFJlbGF0aXZlIDogcGF0aDtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICBpZiAoIW9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lICYmICFoYXNMb2NhbGl6ZVBvbHlmaWxsKSB7XG4gICAgICAgICAgICAvLyBDYW5ub3QgdXNlIGBidWlsZC5yZXNvbHZlYCBoZXJlIHNpbmNlIGl0IGRvZXMgbm90IGFsbG93IG92ZXJyaWRpbmcgdGhlIGV4dGVybmFsIG9wdGlvbnNcbiAgICAgICAgICAgIC8vIGFuZCB0aGUgYWN0dWFsIHByZXNlbmNlIG9mIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemVgIHBhY2thZ2UgbmVlZHMgdG8gYmUgY2hlY2tlZCBoZXJlLlxuICAgICAgICAgICAgY29uc3Qgd29ya3NwYWNlUmVxdWlyZSA9IGNyZWF0ZVJlcXVpcmUod29ya3NwYWNlUm9vdCArICcvJyk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICB3b3Jrc3BhY2VSZXF1aXJlLnJlc29sdmUoJ0Bhbmd1bGFyL2xvY2FsaXplJyk7XG4gICAgICAgICAgICAgIC8vIFRoZSByZXNvbHZlIGNhbGwgYWJvdmUgd2lsbCB0aHJvdyBpZiBub3QgZm91bmRcbiAgICAgICAgICAgICAgcG9seWZpbGxQYXRocy5wdXNoKCdAYW5ndWxhci9sb2NhbGl6ZS9pbml0Jyk7XG4gICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gR2VuZXJhdGUgbW9kdWxlIGNvbnRlbnRzIHdpdGggYW4gaW1wb3J0IHN0YXRlbWVudCBwZXIgZGVmaW5lZCBwb2x5ZmlsbFxuICAgICAgICAgIGxldCBjb250ZW50cyA9IHBvbHlmaWxsUGF0aHNcbiAgICAgICAgICAgIC5tYXAoKGZpbGUpID0+IGBpbXBvcnQgJyR7ZmlsZS5yZXBsYWNlKC9cXFxcL2csICcvJyl9JztgKVxuICAgICAgICAgICAgLmpvaW4oJ1xcbicpO1xuXG4gICAgICAgICAgLy8gSWYgbm90IGlubGluaW5nIHRyYW5zbGF0aW9ucyBhbmQgc291cmNlIGxvY2FsZSBpcyBkZWZpbmVkLCBpbmplY3QgdGhlIGxvY2FsZSBzcGVjaWZpZXJcbiAgICAgICAgICBpZiAoIW9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lICYmIG9wdGlvbnMuaTE4bk9wdGlvbnMuaGFzRGVmaW5lZFNvdXJjZUxvY2FsZSkge1xuICAgICAgICAgICAgY29udGVudHMgKz0gYChnbG9iYWxUaGlzLiRsb2NhbGl6ZSA/Pz0ge30pLmxvY2FsZSA9IFwiJHtvcHRpb25zLmkxOG5PcHRpb25zLnNvdXJjZUxvY2FsZX1cIjtcXG5gO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5wbHVnaW5zKSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnM/LnB1c2goLi4ub3B0aW9ucy5wbHVnaW5zKTtcbiAgfVxuXG4gIHJldHVybiBidWlsZE9wdGlvbnM7XG59XG5cbi8qKlxuICogQ3JlYXRlIGFuIGVzYnVpbGQgJ2J1aWxkJyBvcHRpb25zIG9iamVjdCBmb3IgdGhlIHNlcnZlciBidW5kbGUuXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgYnVpbGRlcidzIHVzZXItcHJvdmlkZXIgbm9ybWFsaXplZCBvcHRpb25zLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBCdWlsZE9wdGlvbnMgb2JqZWN0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2VydmVyQ29kZUJ1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyxcbiAgdGFyZ2V0OiBzdHJpbmdbXSxcbiAgc291cmNlRmlsZUNhY2hlOiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7XG4gICAgaml0LFxuICAgIHNlcnZlckVudHJ5UG9pbnQsXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBzc3JPcHRpb25zLFxuICAgIHdhdGNoLFxuICAgIGV4dGVybmFsUGFja2FnZXMsXG4gICAgcHJlcmVuZGVyT3B0aW9ucyxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgYXNzZXJ0KFxuICAgIHNlcnZlckVudHJ5UG9pbnQsXG4gICAgJ2NyZWF0ZVNlcnZlckNvZGVCdW5kbGVPcHRpb25zIHNob3VsZCBub3QgYmUgY2FsbGVkIHdpdGhvdXQgYSBkZWZpbmVkIHNlcnZlckVudHJ5UG9pbnQuJyxcbiAgKTtcblxuICBjb25zdCB7IHBsdWdpbk9wdGlvbnMsIHN0eWxlT3B0aW9ucyB9ID0gY3JlYXRlQ29tcGlsZXJQbHVnaW5PcHRpb25zKFxuICAgIG9wdGlvbnMsXG4gICAgdGFyZ2V0LFxuICAgIHNvdXJjZUZpbGVDYWNoZSxcbiAgKTtcblxuICBjb25zdCBtYWluU2VydmVyTmFtZXNwYWNlID0gJ2FuZ3VsYXI6bWFpbi1zZXJ2ZXInO1xuICBjb25zdCBzc3JFbnRyeU5hbWVzcGFjZSA9ICdhbmd1bGFyOnNzci1lbnRyeSc7XG5cbiAgY29uc3QgZW50cnlQb2ludHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgJ21haW4uc2VydmVyJzogbWFpblNlcnZlck5hbWVzcGFjZSxcbiAgfTtcblxuICBjb25zdCBzc3JFbnRyeVBvaW50ID0gc3NyT3B0aW9ucz8uZW50cnk7XG4gIGlmIChzc3JFbnRyeVBvaW50KSB7XG4gICAgZW50cnlQb2ludHNbJ3NlcnZlciddID0gc3NyRW50cnlOYW1lc3BhY2U7XG4gIH1cblxuICBjb25zdCBidWlsZE9wdGlvbnM6IEJ1aWxkT3B0aW9ucyA9IHtcbiAgICAuLi5nZXRFc0J1aWxkQ29tbW9uT3B0aW9ucyhvcHRpb25zKSxcbiAgICBwbGF0Zm9ybTogJ25vZGUnLFxuICAgIC8vIFRPRE86IEludmVzaWdhdGUgd2h5IGVuYWJsaW5nIGBzcGxpdHRpbmdgIGluIEpJVCBtb2RlIGNhdXNlcyBhbiBcIidAYW5ndWxhci9jb21waWxlcicgaXMgbm90IGF2YWlsYWJsZVwiIGVycm9yLlxuICAgIHNwbGl0dGluZzogIWppdCxcbiAgICBvdXRFeHRlbnNpb246IHsgJy5qcyc6ICcubWpzJyB9LFxuICAgIC8vIE5vdGU6IGBlczIwMTVgIGlzIG5lZWRlZCBmb3IgUnhKUyB2Ni4gSWYgbm90IHNwZWNpZmllZCwgYG1vZHVsZWAgd291bGRcbiAgICAvLyBtYXRjaCBhbmQgdGhlIEVTNSBkaXN0cmlidXRpb24gd291bGQgYmUgYnVuZGxlZCBhbmQgZW5kcyB1cCBicmVha2luZyBhdFxuICAgIC8vIHJ1bnRpbWUgd2l0aCB0aGUgUnhKUyB0ZXN0aW5nIGxpYnJhcnkuXG4gICAgLy8gTW9yZSBkZXRhaWxzOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMjU0MDUuXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnZXMyMDE1JywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgZW50cnlOYW1lczogJ1tuYW1lXScsXG4gICAgdGFyZ2V0LFxuICAgIGJhbm5lcjoge1xuICAgICAgLy8gTm90ZTogTmVlZGVkIGFzIGVzYnVpbGQgZG9lcyBub3QgcHJvdmlkZSByZXF1aXJlIHNoaW1zIC8gcHJveHkgZnJvbSBFU01vZHVsZXMuXG4gICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9ldmFudy9lc2J1aWxkL2lzc3Vlcy8xOTIxLlxuICAgICAganM6IFtcbiAgICAgICAgYGltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdub2RlOm1vZHVsZSc7YCxcbiAgICAgICAgYGdsb2JhbFRoaXNbJ3JlcXVpcmUnXSA/Pz0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpO2AsXG4gICAgICBdLmpvaW4oJ1xcbicpLFxuICAgIH0sXG4gICAgZW50cnlQb2ludHMsXG4gICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNvdXJjZW1hcElnbm9yZWxpc3RQbHVnaW4oKSxcbiAgICAgIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICAgICAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgICAgIHsgLi4ucGx1Z2luT3B0aW9ucywgbm9vcFR5cGVTY3JpcHRDb21waWxhdGlvbjogdHJ1ZSB9LFxuICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzaGVldCBvcHRpb25zXG4gICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICksXG4gICAgXSxcbiAgfTtcblxuICBidWlsZE9wdGlvbnMucGx1Z2lucyA/Pz0gW107XG4gIGlmIChleHRlcm5hbFBhY2thZ2VzKSB7XG4gICAgYnVpbGRPcHRpb25zLnBhY2thZ2VzID0gJ2V4dGVybmFsJztcbiAgfSBlbHNlIHtcbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKGNyZWF0ZVJ4anNFc21SZXNvbHV0aW9uUGx1Z2luKCkpO1xuICB9XG5cbiAgY29uc3QgcG9seWZpbGxzOiBzdHJpbmdbXSA9IFtdO1xuICBpZiAob3B0aW9ucy5wb2x5ZmlsbHM/LmluY2x1ZGVzKCd6b25lLmpzJykpIHtcbiAgICBwb2x5ZmlsbHMucHVzaChgaW1wb3J0ICd6b25lLmpzL25vZGUnO2ApO1xuICB9XG5cbiAgaWYgKGppdCkge1xuICAgIHBvbHlmaWxscy5wdXNoKGBpbXBvcnQgJ0Bhbmd1bGFyL2NvbXBpbGVyJztgKTtcbiAgfVxuXG4gIHBvbHlmaWxscy5wdXNoKGBpbXBvcnQgJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlci9pbml0JztgKTtcblxuICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKFxuICAgIGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW4oe1xuICAgICAgbmFtZXNwYWNlOiBtYWluU2VydmVyTmFtZXNwYWNlLFxuICAgICAgbG9hZENvbnRlbnQ6IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgbWFpblNlcnZlckVudHJ5UG9pbnQgPSByZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCBzZXJ2ZXJFbnRyeVBvaW50KS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG5cbiAgICAgICAgY29uc3QgY29udGVudHMgPSBbXG4gICAgICAgICAgLi4ucG9seWZpbGxzLFxuICAgICAgICAgIGBpbXBvcnQgbW9kdWxlT3JCb290c3RyYXBGbiBmcm9tICcuLyR7bWFpblNlcnZlckVudHJ5UG9pbnR9JztgLFxuICAgICAgICAgIGBleHBvcnQgZGVmYXVsdCBtb2R1bGVPckJvb3RzdHJhcEZuO2AsXG4gICAgICAgICAgYGV4cG9ydCAqIGZyb20gJy4vJHttYWluU2VydmVyRW50cnlQb2ludH0nO2AsXG4gICAgICAgICAgYGV4cG9ydCB7IMm1Q29uc29sZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO2AsXG4gICAgICAgICAgYGV4cG9ydCB7IHJlbmRlckFwcGxpY2F0aW9uLCByZW5kZXJNb2R1bGUsIMm1U0VSVkVSX0NPTlRFWFQgfSBmcm9tICdAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXInO2AsXG4gICAgICAgIF07XG5cbiAgICAgICAgaWYgKHdhdGNoKSB7XG4gICAgICAgICAgY29udGVudHMucHVzaChgZXhwb3J0IHsgybVyZXNldENvbXBpbGVkQ29tcG9uZW50cyB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLmkxOG5PcHRpb25zLnNob3VsZElubGluZSkge1xuICAgICAgICAgIC8vIENhbm5vdCB1c2UgYGJ1aWxkLnJlc29sdmVgIGhlcmUgc2luY2UgaXQgZG9lcyBub3QgYWxsb3cgb3ZlcnJpZGluZyB0aGUgZXh0ZXJuYWwgb3B0aW9uc1xuICAgICAgICAgIC8vIGFuZCB0aGUgYWN0dWFsIHByZXNlbmNlIG9mIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemVgIHBhY2thZ2UgbmVlZHMgdG8gYmUgY2hlY2tlZCBoZXJlLlxuICAgICAgICAgIGNvbnN0IHdvcmtzcGFjZVJlcXVpcmUgPSBjcmVhdGVSZXF1aXJlKHdvcmtzcGFjZVJvb3QgKyAnLycpO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB3b3Jrc3BhY2VSZXF1aXJlLnJlc29sdmUoJ0Bhbmd1bGFyL2xvY2FsaXplJyk7XG4gICAgICAgICAgICAvLyBUaGUgcmVzb2x2ZSBjYWxsIGFib3ZlIHdpbGwgdGhyb3cgaWYgbm90IGZvdW5kXG4gICAgICAgICAgICBjb250ZW50cy5wdXNoKGBpbXBvcnQgJ0Bhbmd1bGFyL2xvY2FsaXplL2luaXQnO2ApO1xuICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmkxOG5PcHRpb25zLnNob3VsZElubGluZSkge1xuICAgICAgICAgIC8vIFdoZW4gaW5saW5pbmcsIGEgcGxhY2Vob2xkZXIgaXMgdXNlZCB0byBhbGxvdyB0aGUgcG9zdC1wcm9jZXNzaW5nIHN0ZXAgdG8gaW5qZWN0IHRoZSAkbG9jYWxpemUgbG9jYWxlIGlkZW50aWZpZXJcbiAgICAgICAgICBjb250ZW50cy5wdXNoKCcoZ2xvYmFsVGhpcy4kbG9jYWxpemUgPz89IHt9KS5sb2NhbGUgPSBcIl9fX05HX0xPQ0FMRV9JTlNFUlRfX19cIjsnKTtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmkxOG5PcHRpb25zLmhhc0RlZmluZWRTb3VyY2VMb2NhbGUpIHtcbiAgICAgICAgICAvLyBJZiBub3QgaW5saW5pbmcgdHJhbnNsYXRpb25zIGFuZCBzb3VyY2UgbG9jYWxlIGlzIGRlZmluZWQsIGluamVjdCB0aGUgbG9jYWxlIHNwZWNpZmllclxuICAgICAgICAgIGNvbnRlbnRzLnB1c2goXG4gICAgICAgICAgICBgKGdsb2JhbFRoaXMuJGxvY2FsaXplID8/PSB7fSkubG9jYWxlID0gXCIke29wdGlvbnMuaTE4bk9wdGlvbnMuc291cmNlTG9jYWxlfVwiO2AsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwcmVyZW5kZXJPcHRpb25zPy5kaXNjb3ZlclJvdXRlcykge1xuICAgICAgICAgIC8vIFdlIGRvIG5vdCBpbXBvcnQgaXQgZGlyZWN0bHkgc28gdGhhdCBub2RlLmpzIG1vZHVsZXMgYXJlIHJlc29sdmVkIHVzaW5nIHRoZSBjb3JyZWN0IGNvbnRleHQuXG4gICAgICAgICAgY29uc3Qgcm91dGVzRXh0cmFjdG9yQ29kZSA9IGF3YWl0IHJlYWRGaWxlKFxuICAgICAgICAgICAgam9pbihfX2Rpcm5hbWUsICcuLi8uLi91dGlscy9yb3V0ZXMtZXh0cmFjdG9yL2V4dHJhY3Rvci5qcycpLFxuICAgICAgICAgICAgJ3V0Zi04JyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgLy8gUmVtb3ZlIHNvdXJjZSBtYXAgVVJMIGNvbW1lbnRzIGZyb20gdGhlIGNvZGUgaWYgYSBzb3VyY2VtYXAgaXMgcHJlc2VudCBhcyB0aGlzIHdpbGwgbm90IG1hdGNoIHRoZSBmaWxlLlxuICAgICAgICAgIGNvbnRlbnRzLnB1c2gocm91dGVzRXh0cmFjdG9yQ29kZS5yZXBsYWNlKC9eXFwvXFwvIyBzb3VyY2VNYXBwaW5nVVJMPVteXFxyXFxuXSovZ20sICcnKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbnRlbnRzOiBjb250ZW50cy5qb2luKCdcXG4nKSxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgfSksXG4gICk7XG5cbiAgaWYgKHNzckVudHJ5UG9pbnQpIHtcbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKFxuICAgICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICAgIG5hbWVzcGFjZTogc3NyRW50cnlOYW1lc3BhY2UsXG4gICAgICAgIGxvYWRDb250ZW50OiAoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgc2VydmVyRW50cnlQb2ludCA9IHJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIHNzckVudHJ5UG9pbnQpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb250ZW50czogW1xuICAgICAgICAgICAgICAuLi5wb2x5ZmlsbHMsXG4gICAgICAgICAgICAgIGBpbXBvcnQgJy4vJHtzZXJ2ZXJFbnRyeVBvaW50fSc7YCxcbiAgICAgICAgICAgICAgYGV4cG9ydCAqIGZyb20gJy4vJHtzZXJ2ZXJFbnRyeVBvaW50fSc7YCxcbiAgICAgICAgICAgIF0uam9pbignXFxuJyksXG4gICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMucGx1Z2lucykge1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goLi4ub3B0aW9ucy5wbHVnaW5zKTtcbiAgfVxuXG4gIHJldHVybiBidWlsZE9wdGlvbnM7XG59XG5cbmZ1bmN0aW9uIGdldEVzQnVpbGRDb21tb25PcHRpb25zKG9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyk6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHtcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG91dEV4dGVuc2lvbixcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBqaXQsXG4gIH0gPSBvcHRpb25zO1xuXG4gIC8vIEVuc3VyZSB1bmlxdWUgaGFzaGVzIGZvciBpMThuIHRyYW5zbGF0aW9uIGNoYW5nZXMgd2hlbiB1c2luZyBwb3N0LXByb2Nlc3MgaW5saW5pbmcuXG4gIC8vIFRoaXMgaGFzaCB2YWx1ZSBpcyBhZGRlZCBhcyBhIGZvb3RlciB0byBlYWNoIGZpbGUgYW5kIGVuc3VyZXMgdGhhdCB0aGUgb3V0cHV0IGZpbGUgbmFtZXMgKHdpdGggaGFzaGVzKVxuICAvLyBjaGFuZ2Ugd2hlbiB0cmFuc2xhdGlvbiBmaWxlcyBoYXZlIGNoYW5nZWQuIElmIHRoaXMgaXMgbm90IGRvbmUgdGhlIHBvc3QgcHJvY2Vzc2VkIGZpbGVzIG1heSBoYXZlXG4gIC8vIGRpZmZlcmVudCBjb250ZW50IGJ1dCB3b3VsZCByZXRhaW4gaWRlbnRpY2FsIHByb2R1Y3Rpb24gZmlsZSBuYW1lcyB3aGljaCB3b3VsZCBsZWFkIHRvIGJyb3dzZXIgY2FjaGluZyBwcm9ibGVtcy5cbiAgbGV0IGZvb3RlcjtcbiAgaWYgKG9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgLy8gVXBkYXRlIGZpbGUgaGFzaGVzIHRvIGluY2x1ZGUgdHJhbnNsYXRpb24gZmlsZSBjb250ZW50XG4gICAgY29uc3QgaTE4bkhhc2ggPSBPYmplY3QudmFsdWVzKG9wdGlvbnMuaTE4bk9wdGlvbnMubG9jYWxlcykucmVkdWNlKFxuICAgICAgKGRhdGEsIGxvY2FsZSkgPT4gZGF0YSArIGxvY2FsZS5maWxlcy5tYXAoKGZpbGUpID0+IGZpbGUuaW50ZWdyaXR5IHx8ICcnKS5qb2luKCd8JyksXG4gICAgICAnJyxcbiAgICApO1xuXG4gICAgZm9vdGVyID0geyBqczogYC8qKmkxOG46JHtjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoaTE4bkhhc2gpLmRpZ2VzdCgnaGV4Jyl9Ki9gIH07XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGFic1dvcmtpbmdEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgYnVuZGxlOiB0cnVlLFxuICAgIGZvcm1hdDogJ2VzbScsXG4gICAgYXNzZXROYW1lczogb3V0cHV0TmFtZXMubWVkaWEsXG4gICAgY29uZGl0aW9uczogWydlczIwMjAnLCAnZXMyMDE1JywgJ21vZHVsZSddLFxuICAgIHJlc29sdmVFeHRlbnNpb25zOiBbJy50cycsICcudHN4JywgJy5tanMnLCAnLmpzJ10sXG4gICAgbWV0YWZpbGU6IHRydWUsXG4gICAgbGVnYWxDb21tZW50czogb3B0aW9ucy5leHRyYWN0TGljZW5zZXMgPyAnbm9uZScgOiAnZW9mJyxcbiAgICBsb2dMZXZlbDogb3B0aW9ucy52ZXJib3NlID8gJ2RlYnVnJyA6ICdzaWxlbnQnLFxuICAgIG1pbmlmeUlkZW50aWZpZXJzOiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgJiYgYWxsb3dNYW5nbGUsXG4gICAgbWluaWZ5U3ludGF4OiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgbWluaWZ5V2hpdGVzcGFjZTogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzLFxuICAgIHB1cmU6IFsnZm9yd2FyZFJlZiddLFxuICAgIG91dGRpcjogd29ya3NwYWNlUm9vdCxcbiAgICBvdXRFeHRlbnNpb246IG91dEV4dGVuc2lvbiA/IHsgJy5qcyc6IGAuJHtvdXRFeHRlbnNpb259YCB9IDogdW5kZWZpbmVkLFxuICAgIHNvdXJjZW1hcDogc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICBzcGxpdHRpbmc6IHRydWUsXG4gICAgY2h1bmtOYW1lczogb3B0aW9ucy5uYW1lZENodW5rcyA/ICdbbmFtZV0tW2hhc2hdJyA6ICdjaHVuay1baGFzaF0nLFxuICAgIHRzY29uZmlnLFxuICAgIGV4dGVybmFsOiBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICB3cml0ZTogZmFsc2UsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBkZWZpbmU6IHtcbiAgICAgIC8vIE9ubHkgc2V0IHRvIGZhbHNlIHdoZW4gc2NyaXB0IG9wdGltaXphdGlvbnMgYXJlIGVuYWJsZWQuIEl0IHNob3VsZCBub3QgYmUgc2V0IHRvIHRydWUgYmVjYXVzZVxuICAgICAgLy8gQW5ndWxhciB0dXJucyBgbmdEZXZNb2RlYCBpbnRvIGFuIG9iamVjdCBmb3IgZGV2ZWxvcG1lbnQgZGVidWdnaW5nIHB1cnBvc2VzIHdoZW4gbm90IGRlZmluZWRcbiAgICAgIC8vIHdoaWNoIGEgY29uc3RhbnQgdHJ1ZSB2YWx1ZSB3b3VsZCBicmVhay5cbiAgICAgIC4uLihvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgPyB7ICduZ0Rldk1vZGUnOiAnZmFsc2UnIH0gOiB1bmRlZmluZWQpLFxuICAgICAgJ25nSml0TW9kZSc6IGppdCA/ICd0cnVlJyA6ICdmYWxzZScsXG4gICAgfSxcbiAgICBmb290ZXIsXG4gICAgcHVibGljUGF0aDogb3B0aW9ucy5wdWJsaWNQYXRoLFxuICB9O1xufVxuIl19