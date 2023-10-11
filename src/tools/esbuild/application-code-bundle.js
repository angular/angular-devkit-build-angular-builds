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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24tY29kZS1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FwcGxpY2F0aW9uLWNvZGUtYnVuZGxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw2Q0FBeUM7QUFDekMsK0NBQTRDO0FBQzVDLDZDQUE0QztBQUM1Qyx5Q0FBb0Q7QUFFcEQseUVBQThEO0FBQzlELCtEQUFpRTtBQUVqRSx1RUFBd0U7QUFDeEUsNkRBQXFFO0FBQ3JFLDZFQUE2RTtBQUM3RSwrRUFBZ0Y7QUFDaEYsbUNBQTRDO0FBQzVDLG1FQUFvRTtBQUVwRSxTQUFnQiw4QkFBOEIsQ0FDNUMsT0FBMEMsRUFDMUMsTUFBZ0IsRUFDaEIsZUFBaUM7SUFFakMsTUFBTSxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLEdBQUcsRUFBRSxHQUFHLE9BQU8sQ0FBQztJQUVqRSxNQUFNLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxHQUFHLElBQUEscURBQTJCLEVBQ2pFLE9BQU8sRUFDUCxNQUFNLEVBQ04sZUFBZSxDQUNoQixDQUFDO0lBRUYsTUFBTSxZQUFZLEdBQWlCO1FBQ2pDLEdBQUcsdUJBQXVCLENBQUMsT0FBTyxDQUFDO1FBQ25DLFFBQVEsRUFBRSxTQUFTO1FBQ25CLHlFQUF5RTtRQUN6RSwwRUFBMEU7UUFDMUUseUNBQXlDO1FBQ3pDLHFFQUFxRTtRQUNyRSxVQUFVLEVBQUUsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDO1FBQzdELFVBQVUsRUFBRSxXQUFXLENBQUMsT0FBTztRQUMvQixXQUFXO1FBQ1gsTUFBTTtRQUNOLFNBQVMsRUFBRSxJQUFBLHlCQUFpQixF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bnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdub2RlOmNyeXB0byc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJztcbmltcG9ydCB7IGV4dG5hbWUsIGpvaW4sIHJlbGF0aXZlIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB0eXBlIHsgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zIH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYXBwbGljYXRpb24vb3B0aW9ucyc7XG5pbXBvcnQgeyBhbGxvd01hbmdsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgY3JlYXRlQ29tcGlsZXJQbHVnaW4gfSBmcm9tICcuL2FuZ3VsYXIvY29tcGlsZXItcGx1Z2luJztcbmltcG9ydCB7IFNvdXJjZUZpbGVDYWNoZSB9IGZyb20gJy4vYW5ndWxhci9zb3VyY2UtZmlsZS1jYWNoZSc7XG5pbXBvcnQgeyBjcmVhdGVDb21waWxlclBsdWdpbk9wdGlvbnMgfSBmcm9tICcuL2NvbXBpbGVyLXBsdWdpbi1vcHRpb25zJztcbmltcG9ydCB7IGNyZWF0ZUFuZ3VsYXJMb2NhbGVEYXRhUGx1Z2luIH0gZnJvbSAnLi9pMThuLWxvY2FsZS1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlUnhqc0VzbVJlc29sdXRpb25QbHVnaW4gfSBmcm9tICcuL3J4anMtZXNtLXJlc29sdXRpb24tcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZVNvdXJjZW1hcElnbm9yZWxpc3RQbHVnaW4gfSBmcm9tICcuL3NvdXJjZW1hcC1pZ25vcmVsaXN0LXBsdWdpbic7XG5pbXBvcnQgeyBnZXRGZWF0dXJlU3VwcG9ydCB9IGZyb20gJy4vdXRpbHMnO1xuaW1wb3J0IHsgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbiB9IGZyb20gJy4vdmlydHVhbC1tb2R1bGUtcGx1Z2luJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUJyb3dzZXJDb2RlQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7IHdvcmtzcGFjZVJvb3QsIGVudHJ5UG9pbnRzLCBvdXRwdXROYW1lcywgaml0IH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IHsgcGx1Z2luT3B0aW9ucywgc3R5bGVPcHRpb25zIH0gPSBjcmVhdGVDb21waWxlclBsdWdpbk9wdGlvbnMoXG4gICAgb3B0aW9ucyxcbiAgICB0YXJnZXQsXG4gICAgc291cmNlRmlsZUNhY2hlLFxuICApO1xuXG4gIGNvbnN0IGJ1aWxkT3B0aW9uczogQnVpbGRPcHRpb25zID0ge1xuICAgIC4uLmdldEVzQnVpbGRDb21tb25PcHRpb25zKG9wdGlvbnMpLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgLy8gTm90ZTogYGVzMjAxNWAgaXMgbmVlZGVkIGZvciBSeEpTIHY2LiBJZiBub3Qgc3BlY2lmaWVkLCBgbW9kdWxlYCB3b3VsZFxuICAgIC8vIG1hdGNoIGFuZCB0aGUgRVM1IGRpc3RyaWJ1dGlvbiB3b3VsZCBiZSBidW5kbGVkIGFuZCBlbmRzIHVwIGJyZWFraW5nIGF0XG4gICAgLy8gcnVudGltZSB3aXRoIHRoZSBSeEpTIHRlc3RpbmcgbGlicmFyeS5cbiAgICAvLyBNb3JlIGRldGFpbHM6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNTQwNS5cbiAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgIGVudHJ5TmFtZXM6IG91dHB1dE5hbWVzLmJ1bmRsZXMsXG4gICAgZW50cnlQb2ludHMsXG4gICAgdGFyZ2V0LFxuICAgIHN1cHBvcnRlZDogZ2V0RmVhdHVyZVN1cHBvcnQodGFyZ2V0KSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVTb3VyY2VtYXBJZ25vcmVsaXN0UGx1Z2luKCksXG4gICAgICBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgICAgICAgLy8gSlMvVFMgb3B0aW9uc1xuICAgICAgICBwbHVnaW5PcHRpb25zLFxuICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzaGVldCBvcHRpb25zXG4gICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICksXG4gICAgXSxcbiAgfTtcblxuICBpZiAob3B0aW9ucy5leHRlcm5hbFBhY2thZ2VzKSB7XG4gICAgYnVpbGRPcHRpb25zLnBhY2thZ2VzID0gJ2V4dGVybmFsJztcbiAgfVxuXG4gIGNvbnN0IHBvbHlmaWxscyA9IG9wdGlvbnMucG9seWZpbGxzID8gWy4uLm9wdGlvbnMucG9seWZpbGxzXSA6IFtdO1xuXG4gIC8vIEFuZ3VsYXIgSklUIG1vZGUgcmVxdWlyZXMgdGhlIHJ1bnRpbWUgY29tcGlsZXJcbiAgaWYgKGppdCkge1xuICAgIHBvbHlmaWxscy5wdXNoKCdAYW5ndWxhci9jb21waWxlcicpO1xuICB9XG5cbiAgLy8gQWRkIEFuZ3VsYXIncyBnbG9iYWwgbG9jYWxlIGRhdGEgaWYgaTE4biBvcHRpb25zIGFyZSBwcmVzZW50LlxuICAvLyBMb2NhbGUgZGF0YSBzaG91bGQgZ28gZmlyc3Qgc28gdGhhdCBwcm9qZWN0IHByb3ZpZGVkIHBvbHlmaWxsIGNvZGUgY2FuIGF1Z21lbnQgaWYgbmVlZGVkLlxuICBsZXQgbmVlZExvY2FsZURhdGFQbHVnaW4gPSBmYWxzZTtcbiAgaWYgKG9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgLy8gV2hlbiBpbmxpbmluZywgYSBwbGFjZWhvbGRlciBpcyB1c2VkIHRvIGFsbG93IHRoZSBwb3N0LXByb2Nlc3Npbmcgc3RlcCB0byBpbmplY3QgdGhlICRsb2NhbGl6ZSBsb2NhbGUgaWRlbnRpZmllclxuICAgIHBvbHlmaWxscy51bnNoaWZ0KCdhbmd1bGFyOmxvY2FsZS9wbGFjZWhvbGRlcicpO1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zPy51bnNoaWZ0KFxuICAgICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICAgIG5hbWVzcGFjZTogJ2FuZ3VsYXI6bG9jYWxlL3BsYWNlaG9sZGVyJyxcbiAgICAgICAgZW50cnlQb2ludE9ubHk6IGZhbHNlLFxuICAgICAgICBsb2FkQ29udGVudDogKCkgPT4gKHtcbiAgICAgICAgICBjb250ZW50czogYChnbG9iYWxUaGlzLiRsb2NhbGl6ZSA/Pz0ge30pLmxvY2FsZSA9IFwiX19fTkdfTE9DQUxFX0lOU0VSVF9fX1wiO1xcbmAsXG4gICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIH0pLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIC8vIEFkZCBsb2NhbGUgZGF0YSBmb3IgYWxsIGFjdGl2ZSBsb2NhbGVzXG4gICAgLy8gVE9ETzogSW5qZWN0IGVhY2ggaW5kaXZpZHVhbGx5IHdpdGhpbiB0aGUgaW5saW5pbmcgcHJvY2VzcyBpdHNlbGZcbiAgICBmb3IgKGNvbnN0IGxvY2FsZSBvZiBvcHRpb25zLmkxOG5PcHRpb25zLmlubGluZUxvY2FsZXMpIHtcbiAgICAgIHBvbHlmaWxscy51bnNoaWZ0KGBhbmd1bGFyOmxvY2FsZS9kYXRhOiR7bG9jYWxlfWApO1xuICAgIH1cbiAgICBuZWVkTG9jYWxlRGF0YVBsdWdpbiA9IHRydWU7XG4gIH0gZWxzZSBpZiAob3B0aW9ucy5pMThuT3B0aW9ucy5oYXNEZWZpbmVkU291cmNlTG9jYWxlKSB7XG4gICAgLy8gV2hlbiBub3QgaW5saW5pbmcgYW5kIGEgc291cmNlIGxvY2FsIGlzIHByZXNlbnQsIHVzZSB0aGUgc291cmNlIGxvY2FsZSBkYXRhIGRpcmVjdGx5XG4gICAgcG9seWZpbGxzLnVuc2hpZnQoYGFuZ3VsYXI6bG9jYWxlL2RhdGE6JHtvcHRpb25zLmkxOG5PcHRpb25zLnNvdXJjZUxvY2FsZX1gKTtcbiAgICBuZWVkTG9jYWxlRGF0YVBsdWdpbiA9IHRydWU7XG4gIH1cbiAgaWYgKG5lZWRMb2NhbGVEYXRhUGx1Z2luKSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnM/LnB1c2goY3JlYXRlQW5ndWxhckxvY2FsZURhdGFQbHVnaW4oKSk7XG4gIH1cblxuICAvLyBBZGQgcG9seWZpbGwgZW50cnkgcG9pbnQgaWYgcG9seWZpbGxzIGFyZSBwcmVzZW50XG4gIGlmIChwb2x5ZmlsbHMubGVuZ3RoKSB7XG4gICAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6cG9seWZpbGxzJztcbiAgICBidWlsZE9wdGlvbnMuZW50cnlQb2ludHMgPSB7XG4gICAgICAuLi5idWlsZE9wdGlvbnMuZW50cnlQb2ludHMsXG4gICAgICAncG9seWZpbGxzJzogbmFtZXNwYWNlLFxuICAgIH07XG5cbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucz8udW5zaGlmdChcbiAgICAgIGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW4oe1xuICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgIGxvYWRDb250ZW50OiBhc3luYyAoXywgYnVpbGQpID0+IHtcbiAgICAgICAgICBsZXQgaGFzTG9jYWxpemVQb2x5ZmlsbCA9IGZhbHNlO1xuICAgICAgICAgIGNvbnN0IHBvbHlmaWxsUGF0aHMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICAgIHBvbHlmaWxscy5tYXAoYXN5bmMgKHBhdGgpID0+IHtcbiAgICAgICAgICAgICAgaGFzTG9jYWxpemVQb2x5ZmlsbCB8fD0gcGF0aC5zdGFydHNXaXRoKCdAYW5ndWxhci9sb2NhbGl6ZScpO1xuXG4gICAgICAgICAgICAgIGlmIChwYXRoLnN0YXJ0c1dpdGgoJ3pvbmUuanMnKSB8fCAhZXh0bmFtZShwYXRoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgcG90ZW50aWFsUGF0aFJlbGF0aXZlID0gJy4vJyArIHBhdGg7XG4gICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJ1aWxkLnJlc29sdmUocG90ZW50aWFsUGF0aFJlbGF0aXZlLCB7XG4gICAgICAgICAgICAgICAga2luZDogJ2ltcG9ydC1zdGF0ZW1lbnQnLFxuICAgICAgICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIHJldHVybiByZXN1bHQucGF0aCA/IHBvdGVudGlhbFBhdGhSZWxhdGl2ZSA6IHBhdGg7XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgaWYgKCFvcHRpb25zLmkxOG5PcHRpb25zLnNob3VsZElubGluZSAmJiAhaGFzTG9jYWxpemVQb2x5ZmlsbCkge1xuICAgICAgICAgICAgLy8gQ2Fubm90IHVzZSBgYnVpbGQucmVzb2x2ZWAgaGVyZSBzaW5jZSBpdCBkb2VzIG5vdCBhbGxvdyBvdmVycmlkaW5nIHRoZSBleHRlcm5hbCBvcHRpb25zXG4gICAgICAgICAgICAvLyBhbmQgdGhlIGFjdHVhbCBwcmVzZW5jZSBvZiB0aGUgYEBhbmd1bGFyL2xvY2FsaXplYCBwYWNrYWdlIG5lZWRzIHRvIGJlIGNoZWNrZWQgaGVyZS5cbiAgICAgICAgICAgIGNvbnN0IHdvcmtzcGFjZVJlcXVpcmUgPSBjcmVhdGVSZXF1aXJlKHdvcmtzcGFjZVJvb3QgKyAnLycpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgd29ya3NwYWNlUmVxdWlyZS5yZXNvbHZlKCdAYW5ndWxhci9sb2NhbGl6ZScpO1xuICAgICAgICAgICAgICAvLyBUaGUgcmVzb2x2ZSBjYWxsIGFib3ZlIHdpbGwgdGhyb3cgaWYgbm90IGZvdW5kXG4gICAgICAgICAgICAgIHBvbHlmaWxsUGF0aHMucHVzaCgnQGFuZ3VsYXIvbG9jYWxpemUvaW5pdCcpO1xuICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEdlbmVyYXRlIG1vZHVsZSBjb250ZW50cyB3aXRoIGFuIGltcG9ydCBzdGF0ZW1lbnQgcGVyIGRlZmluZWQgcG9seWZpbGxcbiAgICAgICAgICBsZXQgY29udGVudHMgPSBwb2x5ZmlsbFBhdGhzXG4gICAgICAgICAgICAubWFwKChmaWxlKSA9PiBgaW1wb3J0ICcke2ZpbGUucmVwbGFjZSgvXFxcXC9nLCAnLycpfSc7YClcbiAgICAgICAgICAgIC5qb2luKCdcXG4nKTtcblxuICAgICAgICAgIC8vIElmIG5vdCBpbmxpbmluZyB0cmFuc2xhdGlvbnMgYW5kIHNvdXJjZSBsb2NhbGUgaXMgZGVmaW5lZCwgaW5qZWN0IHRoZSBsb2NhbGUgc3BlY2lmaWVyXG4gICAgICAgICAgaWYgKCFvcHRpb25zLmkxOG5PcHRpb25zLnNob3VsZElubGluZSAmJiBvcHRpb25zLmkxOG5PcHRpb25zLmhhc0RlZmluZWRTb3VyY2VMb2NhbGUpIHtcbiAgICAgICAgICAgIGNvbnRlbnRzICs9IGAoZ2xvYmFsVGhpcy4kbG9jYWxpemUgPz89IHt9KS5sb2NhbGUgPSBcIiR7b3B0aW9ucy5pMThuT3B0aW9ucy5zb3VyY2VMb2NhbGV9XCI7XFxuYDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29udGVudHMsXG4gICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gZXNidWlsZCAnYnVpbGQnIG9wdGlvbnMgb2JqZWN0IGZvciB0aGUgc2VydmVyIGJ1bmRsZS5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBidWlsZGVyJ3MgdXNlci1wcm92aWRlciBub3JtYWxpemVkIG9wdGlvbnMuXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIEJ1aWxkT3B0aW9ucyBvYmplY3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTZXJ2ZXJDb2RlQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU6IFNvdXJjZUZpbGVDYWNoZSxcbik6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHtcbiAgICBqaXQsXG4gICAgc2VydmVyRW50cnlQb2ludCxcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIHNzck9wdGlvbnMsXG4gICAgd2F0Y2gsXG4gICAgZXh0ZXJuYWxQYWNrYWdlcyxcbiAgICBwcmVyZW5kZXJPcHRpb25zLFxuICB9ID0gb3B0aW9ucztcblxuICBhc3NlcnQoXG4gICAgc2VydmVyRW50cnlQb2ludCxcbiAgICAnY3JlYXRlU2VydmVyQ29kZUJ1bmRsZU9wdGlvbnMgc2hvdWxkIG5vdCBiZSBjYWxsZWQgd2l0aG91dCBhIGRlZmluZWQgc2VydmVyRW50cnlQb2ludC4nLFxuICApO1xuXG4gIGNvbnN0IHsgcGx1Z2luT3B0aW9ucywgc3R5bGVPcHRpb25zIH0gPSBjcmVhdGVDb21waWxlclBsdWdpbk9wdGlvbnMoXG4gICAgb3B0aW9ucyxcbiAgICB0YXJnZXQsXG4gICAgc291cmNlRmlsZUNhY2hlLFxuICApO1xuXG4gIGNvbnN0IG1haW5TZXJ2ZXJOYW1lc3BhY2UgPSAnYW5ndWxhcjptYWluLXNlcnZlcic7XG4gIGNvbnN0IHNzckVudHJ5TmFtZXNwYWNlID0gJ2FuZ3VsYXI6c3NyLWVudHJ5JztcblxuICBjb25zdCBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAnbWFpbi5zZXJ2ZXInOiBtYWluU2VydmVyTmFtZXNwYWNlLFxuICB9O1xuXG4gIGNvbnN0IHNzckVudHJ5UG9pbnQgPSBzc3JPcHRpb25zPy5lbnRyeTtcbiAgaWYgKHNzckVudHJ5UG9pbnQpIHtcbiAgICBlbnRyeVBvaW50c1snc2VydmVyJ10gPSBzc3JFbnRyeU5hbWVzcGFjZTtcbiAgfVxuXG4gIGNvbnN0IGJ1aWxkT3B0aW9uczogQnVpbGRPcHRpb25zID0ge1xuICAgIC4uLmdldEVzQnVpbGRDb21tb25PcHRpb25zKG9wdGlvbnMpLFxuICAgIHBsYXRmb3JtOiAnbm9kZScsXG4gICAgLy8gVE9ETzogSW52ZXNpZ2F0ZSB3aHkgZW5hYmxpbmcgYHNwbGl0dGluZ2AgaW4gSklUIG1vZGUgY2F1c2VzIGFuIFwiJ0Bhbmd1bGFyL2NvbXBpbGVyJyBpcyBub3QgYXZhaWxhYmxlXCIgZXJyb3IuXG4gICAgc3BsaXR0aW5nOiAhaml0LFxuICAgIG91dEV4dGVuc2lvbjogeyAnLmpzJzogJy5tanMnIH0sXG4gICAgLy8gTm90ZTogYGVzMjAxNWAgaXMgbmVlZGVkIGZvciBSeEpTIHY2LiBJZiBub3Qgc3BlY2lmaWVkLCBgbW9kdWxlYCB3b3VsZFxuICAgIC8vIG1hdGNoIGFuZCB0aGUgRVM1IGRpc3RyaWJ1dGlvbiB3b3VsZCBiZSBidW5kbGVkIGFuZCBlbmRzIHVwIGJyZWFraW5nIGF0XG4gICAgLy8gcnVudGltZSB3aXRoIHRoZSBSeEpTIHRlc3RpbmcgbGlicmFyeS5cbiAgICAvLyBNb3JlIGRldGFpbHM6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNTQwNS5cbiAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICBlbnRyeU5hbWVzOiAnW25hbWVdJyxcbiAgICB0YXJnZXQsXG4gICAgYmFubmVyOiB7XG4gICAgICAvLyBOb3RlOiBOZWVkZWQgYXMgZXNidWlsZCBkb2VzIG5vdCBwcm92aWRlIHJlcXVpcmUgc2hpbXMgLyBwcm94eSBmcm9tIEVTTW9kdWxlcy5cbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2V2YW53L2VzYnVpbGQvaXNzdWVzLzE5MjEuXG4gICAgICBqczogW1xuICAgICAgICBgaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJztgLFxuICAgICAgICBgZ2xvYmFsVGhpc1sncmVxdWlyZSddID8/PSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybCk7YCxcbiAgICAgIF0uam9pbignXFxuJyksXG4gICAgfSxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBzdXBwb3J0ZWQ6IGdldEZlYXR1cmVTdXBwb3J0KHRhcmdldCksXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlU291cmNlbWFwSWdub3JlbGlzdFBsdWdpbigpLFxuICAgICAgY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gICAgICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICAgICAgeyAuLi5wbHVnaW5PcHRpb25zLCBub29wVHlwZVNjcmlwdENvbXBpbGF0aW9uOiB0cnVlIH0sXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgKSxcbiAgICBdLFxuICB9O1xuXG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zID8/PSBbXTtcbiAgaWYgKGV4dGVybmFsUGFja2FnZXMpIHtcbiAgICBidWlsZE9wdGlvbnMucGFja2FnZXMgPSAnZXh0ZXJuYWwnO1xuICB9IGVsc2Uge1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goY3JlYXRlUnhqc0VzbVJlc29sdXRpb25QbHVnaW4oKSk7XG4gIH1cblxuICBjb25zdCBwb2x5ZmlsbHM6IHN0cmluZ1tdID0gW107XG4gIGlmIChvcHRpb25zLnBvbHlmaWxscz8uaW5jbHVkZXMoJ3pvbmUuanMnKSkge1xuICAgIHBvbHlmaWxscy5wdXNoKGBpbXBvcnQgJ3pvbmUuanMvbm9kZSc7YCk7XG4gIH1cblxuICBpZiAoaml0KSB7XG4gICAgcG9seWZpbGxzLnB1c2goYGltcG9ydCAnQGFuZ3VsYXIvY29tcGlsZXInO2ApO1xuICB9XG5cbiAgcG9seWZpbGxzLnB1c2goYGltcG9ydCAnQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyL2luaXQnO2ApO1xuXG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goXG4gICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICBuYW1lc3BhY2U6IG1haW5TZXJ2ZXJOYW1lc3BhY2UsXG4gICAgICBsb2FkQ29udGVudDogYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBtYWluU2VydmVyRW50cnlQb2ludCA9IHJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIHNlcnZlckVudHJ5UG9pbnQpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcblxuICAgICAgICBjb25zdCBjb250ZW50cyA9IFtcbiAgICAgICAgICAuLi5wb2x5ZmlsbHMsXG4gICAgICAgICAgYGltcG9ydCBtb2R1bGVPckJvb3RzdHJhcEZuIGZyb20gJy4vJHttYWluU2VydmVyRW50cnlQb2ludH0nO2AsXG4gICAgICAgICAgYGV4cG9ydCBkZWZhdWx0IG1vZHVsZU9yQm9vdHN0cmFwRm47YCxcbiAgICAgICAgICBgZXhwb3J0ICogZnJvbSAnLi8ke21haW5TZXJ2ZXJFbnRyeVBvaW50fSc7YCxcbiAgICAgICAgICBgZXhwb3J0IHsgcmVuZGVyQXBwbGljYXRpb24sIHJlbmRlck1vZHVsZSwgybVTRVJWRVJfQ09OVEVYVCB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcic7YCxcbiAgICAgICAgXTtcblxuICAgICAgICBpZiAod2F0Y2gpIHtcbiAgICAgICAgICBjb250ZW50cy5wdXNoKGBleHBvcnQgeyDJtXJlc2V0Q29tcGlsZWRDb21wb25lbnRzIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7YCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgICAgICAgLy8gQ2Fubm90IHVzZSBgYnVpbGQucmVzb2x2ZWAgaGVyZSBzaW5jZSBpdCBkb2VzIG5vdCBhbGxvdyBvdmVycmlkaW5nIHRoZSBleHRlcm5hbCBvcHRpb25zXG4gICAgICAgICAgLy8gYW5kIHRoZSBhY3R1YWwgcHJlc2VuY2Ugb2YgdGhlIGBAYW5ndWxhci9sb2NhbGl6ZWAgcGFja2FnZSBuZWVkcyB0byBiZSBjaGVja2VkIGhlcmUuXG4gICAgICAgICAgY29uc3Qgd29ya3NwYWNlUmVxdWlyZSA9IGNyZWF0ZVJlcXVpcmUod29ya3NwYWNlUm9vdCArICcvJyk7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHdvcmtzcGFjZVJlcXVpcmUucmVzb2x2ZSgnQGFuZ3VsYXIvbG9jYWxpemUnKTtcbiAgICAgICAgICAgIC8vIFRoZSByZXNvbHZlIGNhbGwgYWJvdmUgd2lsbCB0aHJvdyBpZiBub3QgZm91bmRcbiAgICAgICAgICAgIGNvbnRlbnRzLnB1c2goYGltcG9ydCAnQGFuZ3VsYXIvbG9jYWxpemUvaW5pdCc7YCk7XG4gICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgICAgICAgLy8gV2hlbiBpbmxpbmluZywgYSBwbGFjZWhvbGRlciBpcyB1c2VkIHRvIGFsbG93IHRoZSBwb3N0LXByb2Nlc3Npbmcgc3RlcCB0byBpbmplY3QgdGhlICRsb2NhbGl6ZSBsb2NhbGUgaWRlbnRpZmllclxuICAgICAgICAgIGNvbnRlbnRzLnB1c2goJyhnbG9iYWxUaGlzLiRsb2NhbGl6ZSA/Pz0ge30pLmxvY2FsZSA9IFwiX19fTkdfTE9DQUxFX0lOU0VSVF9fX1wiOycpO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuaTE4bk9wdGlvbnMuaGFzRGVmaW5lZFNvdXJjZUxvY2FsZSkge1xuICAgICAgICAgIC8vIElmIG5vdCBpbmxpbmluZyB0cmFuc2xhdGlvbnMgYW5kIHNvdXJjZSBsb2NhbGUgaXMgZGVmaW5lZCwgaW5qZWN0IHRoZSBsb2NhbGUgc3BlY2lmaWVyXG4gICAgICAgICAgY29udGVudHMucHVzaChcbiAgICAgICAgICAgIGAoZ2xvYmFsVGhpcy4kbG9jYWxpemUgPz89IHt9KS5sb2NhbGUgPSBcIiR7b3B0aW9ucy5pMThuT3B0aW9ucy5zb3VyY2VMb2NhbGV9XCI7YCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHByZXJlbmRlck9wdGlvbnM/LmRpc2NvdmVyUm91dGVzKSB7XG4gICAgICAgICAgLy8gV2UgZG8gbm90IGltcG9ydCBpdCBkaXJlY3RseSBzbyB0aGF0IG5vZGUuanMgbW9kdWxlcyBhcmUgcmVzb2x2ZWQgdXNpbmcgdGhlIGNvcnJlY3QgY29udGV4dC5cbiAgICAgICAgICBjb25zdCByb3V0ZXNFeHRyYWN0b3JDb2RlID0gYXdhaXQgcmVhZEZpbGUoXG4gICAgICAgICAgICBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3V0aWxzL3JvdXRlcy1leHRyYWN0b3IvZXh0cmFjdG9yLmpzJyksXG4gICAgICAgICAgICAndXRmLTgnLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICAvLyBSZW1vdmUgc291cmNlIG1hcCBVUkwgY29tbWVudHMgZnJvbSB0aGUgY29kZSBpZiBhIHNvdXJjZW1hcCBpcyBwcmVzZW50IGFzIHRoaXMgd2lsbCBub3QgbWF0Y2ggdGhlIGZpbGUuXG4gICAgICAgICAgY29udGVudHMucHVzaChyb3V0ZXNFeHRyYWN0b3JDb2RlLnJlcGxhY2UoL15cXC9cXC8jIHNvdXJjZU1hcHBpbmdVUkw9W15cXHJcXG5dKi9nbSwgJycpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgY29udGVudHM6IGNvbnRlbnRzLmpvaW4oJ1xcbicpLFxuICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICB9KSxcbiAgKTtcblxuICBpZiAoc3NyRW50cnlQb2ludCkge1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goXG4gICAgICBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luKHtcbiAgICAgICAgbmFtZXNwYWNlOiBzc3JFbnRyeU5hbWVzcGFjZSxcbiAgICAgICAgbG9hZENvbnRlbnQ6ICgpID0+IHtcbiAgICAgICAgICBjb25zdCBzZXJ2ZXJFbnRyeVBvaW50ID0gcmVsYXRpdmUod29ya3NwYWNlUm9vdCwgc3NyRW50cnlQb2ludCkucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNvbnRlbnRzOiBbXG4gICAgICAgICAgICAgIC4uLnBvbHlmaWxscyxcbiAgICAgICAgICAgICAgYGltcG9ydCAnLi8ke3NlcnZlckVudHJ5UG9pbnR9JztgLFxuICAgICAgICAgICAgICBgZXhwb3J0ICogZnJvbSAnLi8ke3NlcnZlckVudHJ5UG9pbnR9JztgLFxuICAgICAgICAgICAgXS5qb2luKCdcXG4nKSxcbiAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gYnVpbGRPcHRpb25zO1xufVxuXG5mdW5jdGlvbiBnZXRFc0J1aWxkQ29tbW9uT3B0aW9ucyhvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMpOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7XG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBvdXRFeHRlbnNpb24sXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgaml0LFxuICB9ID0gb3B0aW9ucztcblxuICAvLyBFbnN1cmUgdW5pcXVlIGhhc2hlcyBmb3IgaTE4biB0cmFuc2xhdGlvbiBjaGFuZ2VzIHdoZW4gdXNpbmcgcG9zdC1wcm9jZXNzIGlubGluaW5nLlxuICAvLyBUaGlzIGhhc2ggdmFsdWUgaXMgYWRkZWQgYXMgYSBmb290ZXIgdG8gZWFjaCBmaWxlIGFuZCBlbnN1cmVzIHRoYXQgdGhlIG91dHB1dCBmaWxlIG5hbWVzICh3aXRoIGhhc2hlcylcbiAgLy8gY2hhbmdlIHdoZW4gdHJhbnNsYXRpb24gZmlsZXMgaGF2ZSBjaGFuZ2VkLiBJZiB0aGlzIGlzIG5vdCBkb25lIHRoZSBwb3N0IHByb2Nlc3NlZCBmaWxlcyBtYXkgaGF2ZVxuICAvLyBkaWZmZXJlbnQgY29udGVudCBidXQgd291bGQgcmV0YWluIGlkZW50aWNhbCBwcm9kdWN0aW9uIGZpbGUgbmFtZXMgd2hpY2ggd291bGQgbGVhZCB0byBicm93c2VyIGNhY2hpbmcgcHJvYmxlbXMuXG4gIGxldCBmb290ZXI7XG4gIGlmIChvcHRpb25zLmkxOG5PcHRpb25zLnNob3VsZElubGluZSkge1xuICAgIC8vIFVwZGF0ZSBmaWxlIGhhc2hlcyB0byBpbmNsdWRlIHRyYW5zbGF0aW9uIGZpbGUgY29udGVudFxuICAgIGNvbnN0IGkxOG5IYXNoID0gT2JqZWN0LnZhbHVlcyhvcHRpb25zLmkxOG5PcHRpb25zLmxvY2FsZXMpLnJlZHVjZShcbiAgICAgIChkYXRhLCBsb2NhbGUpID0+IGRhdGEgKyBsb2NhbGUuZmlsZXMubWFwKChmaWxlKSA9PiBmaWxlLmludGVncml0eSB8fCAnJykuam9pbignfCcpLFxuICAgICAgJycsXG4gICAgKTtcblxuICAgIGZvb3RlciA9IHsganM6IGAvKippMThuOiR7Y3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGkxOG5IYXNoKS5kaWdlc3QoJ2hleCcpfSovYCB9O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBhYnNXb3JraW5nRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICBmb3JtYXQ6ICdlc20nLFxuICAgIGFzc2V0TmFtZXM6IG91dHB1dE5hbWVzLm1lZGlhLFxuICAgIGNvbmRpdGlvbnM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdtb2R1bGUnXSxcbiAgICByZXNvbHZlRXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgIGxlZ2FsQ29tbWVudHM6IG9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzID8gJ25vbmUnIDogJ2VvZicsXG4gICAgbG9nTGV2ZWw6IG9wdGlvbnMudmVyYm9zZSA/ICdkZWJ1ZycgOiAnc2lsZW50JyxcbiAgICBtaW5pZnlJZGVudGlmaWVyczogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzICYmIGFsbG93TWFuZ2xlLFxuICAgIG1pbmlmeVN5bnRheDogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzLFxuICAgIG1pbmlmeVdoaXRlc3BhY2U6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBwdXJlOiBbJ2ZvcndhcmRSZWYnXSxcbiAgICBvdXRkaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgb3V0RXh0ZW5zaW9uOiBvdXRFeHRlbnNpb24gPyB7ICcuanMnOiBgLiR7b3V0RXh0ZW5zaW9ufWAgfSA6IHVuZGVmaW5lZCxcbiAgICBzb3VyY2VtYXA6IHNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyAmJiAoc291cmNlbWFwT3B0aW9ucy5oaWRkZW4gPyAnZXh0ZXJuYWwnIDogdHJ1ZSksXG4gICAgc3BsaXR0aW5nOiB0cnVlLFxuICAgIGNodW5rTmFtZXM6IG9wdGlvbnMubmFtZWRDaHVua3MgPyAnW25hbWVdLVtoYXNoXScgOiAnY2h1bmstW2hhc2hdJyxcbiAgICB0c2NvbmZpZyxcbiAgICBleHRlcm5hbDogZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgZGVmaW5lOiB7XG4gICAgICAvLyBPbmx5IHNldCB0byBmYWxzZSB3aGVuIHNjcmlwdCBvcHRpbWl6YXRpb25zIGFyZSBlbmFibGVkLiBJdCBzaG91bGQgbm90IGJlIHNldCB0byB0cnVlIGJlY2F1c2VcbiAgICAgIC8vIEFuZ3VsYXIgdHVybnMgYG5nRGV2TW9kZWAgaW50byBhbiBvYmplY3QgZm9yIGRldmVsb3BtZW50IGRlYnVnZ2luZyBwdXJwb3NlcyB3aGVuIG5vdCBkZWZpbmVkXG4gICAgICAvLyB3aGljaCBhIGNvbnN0YW50IHRydWUgdmFsdWUgd291bGQgYnJlYWsuXG4gICAgICAuLi4ob3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzID8geyAnbmdEZXZNb2RlJzogJ2ZhbHNlJyB9IDogdW5kZWZpbmVkKSxcbiAgICAgICduZ0ppdE1vZGUnOiBqaXQgPyAndHJ1ZScgOiAnZmFsc2UnLFxuICAgIH0sXG4gICAgZm9vdGVyLFxuICAgIHB1YmxpY1BhdGg6IG9wdGlvbnMucHVibGljUGF0aCxcbiAgfTtcbn1cbiJdfQ==