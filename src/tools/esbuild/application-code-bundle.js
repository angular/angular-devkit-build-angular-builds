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
            loadContent: () => ({
                contents: polyfills.map((file) => `import '${file.replace(/\\/g, '/')}';`).join('\n'),
                loader: 'js',
                resolveDir: workspaceRoot,
            }),
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
        chunkNames: 'chunk-[hash]',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24tY29kZS1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FwcGxpY2F0aW9uLWNvZGUtYnVuZGxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw2Q0FBeUM7QUFDekMsK0NBQTRDO0FBQzVDLHlDQUEyQztBQUUzQyx5RUFBOEQ7QUFDOUQsK0RBQWtGO0FBQ2xGLHVFQUF3RTtBQUN4RSw2REFBcUU7QUFDckUsNkVBQTZFO0FBQzdFLCtFQUFnRjtBQUNoRixtQ0FBNEM7QUFDNUMsbUVBQW9FO0FBRXBFLFNBQWdCLDhCQUE4QixDQUM1QyxPQUEwQyxFQUMxQyxNQUFnQixFQUNoQixlQUFpQztJQUVqQyxNQUFNLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLEdBQUcsT0FBTyxDQUFDO0lBRWpFLE1BQU0sRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLEdBQUcsSUFBQSxxREFBMkIsRUFDakUsT0FBTyxFQUNQLE1BQU0sRUFDTixlQUFlLENBQ2hCLENBQUM7SUFFRixNQUFNLFlBQVksR0FBaUI7UUFDakMsR0FBRyx1QkFBdUIsQ0FBQyxPQUFPLENBQUM7UUFDbkMsUUFBUSxFQUFFLFNBQVM7UUFDbkIseUVBQXlFO1FBQ3pFLDBFQUEwRTtRQUMxRSx5Q0FBeUM7UUFDekMscUVBQXFFO1FBQ3JFLFVBQVUsRUFBRSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUM7UUFDN0QsVUFBVSxFQUFFLFdBQVcsQ0FBQyxPQUFPO1FBQy9CLFdBQVc7UUFDWCxNQUFNO1FBQ04sU0FBUyxFQUFFLElBQUEseUJBQWlCLEVBQUMsTUFBTSxDQUFD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LEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPO1NBQ3BDO1FBQ0QsTUFBTTtLQUNQLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdub2RlOmNyeXB0byc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHR5cGUgeyBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMgfSBmcm9tICcuLi8uLi9idWlsZGVycy9hcHBsaWNhdGlvbi9vcHRpb25zJztcbmltcG9ydCB7IGFsbG93TWFuZ2xlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBTb3VyY2VGaWxlQ2FjaGUsIGNyZWF0ZUNvbXBpbGVyUGx1Z2luIH0gZnJvbSAnLi9hbmd1bGFyL2NvbXBpbGVyLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVDb21waWxlclBsdWdpbk9wdGlvbnMgfSBmcm9tICcuL2NvbXBpbGVyLXBsdWdpbi1vcHRpb25zJztcbmltcG9ydCB7IGNyZWF0ZUFuZ3VsYXJMb2NhbGVEYXRhUGx1Z2luIH0gZnJvbSAnLi9pMThuLWxvY2FsZS1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlUnhqc0VzbVJlc29sdXRpb25QbHVnaW4gfSBmcm9tICcuL3J4anMtZXNtLXJlc29sdXRpb24tcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZVNvdXJjZW1hcElnbm9yZWxpc3RQbHVnaW4gfSBmcm9tICcuL3NvdXJjZW1hcC1pZ25vcmVsaXN0LXBsdWdpbic7XG5pbXBvcnQgeyBnZXRGZWF0dXJlU3VwcG9ydCB9IGZyb20gJy4vdXRpbHMnO1xuaW1wb3J0IHsgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbiB9IGZyb20gJy4vdmlydHVhbC1tb2R1bGUtcGx1Z2luJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUJyb3dzZXJDb2RlQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7IHdvcmtzcGFjZVJvb3QsIGVudHJ5UG9pbnRzLCBvdXRwdXROYW1lcywgaml0IH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IHsgcGx1Z2luT3B0aW9ucywgc3R5bGVPcHRpb25zIH0gPSBjcmVhdGVDb21waWxlclBsdWdpbk9wdGlvbnMoXG4gICAgb3B0aW9ucyxcbiAgICB0YXJnZXQsXG4gICAgc291cmNlRmlsZUNhY2hlLFxuICApO1xuXG4gIGNvbnN0IGJ1aWxkT3B0aW9uczogQnVpbGRPcHRpb25zID0ge1xuICAgIC4uLmdldEVzQnVpbGRDb21tb25PcHRpb25zKG9wdGlvbnMpLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgLy8gTm90ZTogYGVzMjAxNWAgaXMgbmVlZGVkIGZvciBSeEpTIHY2LiBJZiBub3Qgc3BlY2lmaWVkLCBgbW9kdWxlYCB3b3VsZFxuICAgIC8vIG1hdGNoIGFuZCB0aGUgRVM1IGRpc3RyaWJ1dGlvbiB3b3VsZCBiZSBidW5kbGVkIGFuZCBlbmRzIHVwIGJyZWFraW5nIGF0XG4gICAgLy8gcnVudGltZSB3aXRoIHRoZSBSeEpTIHRlc3RpbmcgbGlicmFyeS5cbiAgICAvLyBNb3JlIGRldGFpbHM6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNTQwNS5cbiAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgIGVudHJ5TmFtZXM6IG91dHB1dE5hbWVzLmJ1bmRsZXMsXG4gICAgZW50cnlQb2ludHMsXG4gICAgdGFyZ2V0LFxuICAgIHN1cHBvcnRlZDogZ2V0RmVhdHVyZVN1cHBvcnQodGFyZ2V0KSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVTb3VyY2VtYXBJZ25vcmVsaXN0UGx1Z2luKCksXG4gICAgICBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgICAgICAgLy8gSlMvVFMgb3B0aW9uc1xuICAgICAgICBwbHVnaW5PcHRpb25zLFxuICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzaGVldCBvcHRpb25zXG4gICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICksXG4gICAgXSxcbiAgfTtcblxuICBpZiAob3B0aW9ucy5leHRlcm5hbFBhY2thZ2VzKSB7XG4gICAgYnVpbGRPcHRpb25zLnBhY2thZ2VzID0gJ2V4dGVybmFsJztcbiAgfVxuXG4gIGNvbnN0IHBvbHlmaWxscyA9IG9wdGlvbnMucG9seWZpbGxzID8gWy4uLm9wdGlvbnMucG9seWZpbGxzXSA6IFtdO1xuXG4gIC8vIEFuZ3VsYXIgSklUIG1vZGUgcmVxdWlyZXMgdGhlIHJ1bnRpbWUgY29tcGlsZXJcbiAgaWYgKGppdCkge1xuICAgIHBvbHlmaWxscy5wdXNoKCdAYW5ndWxhci9jb21waWxlcicpO1xuICB9XG5cbiAgLy8gQWRkIEFuZ3VsYXIncyBnbG9iYWwgbG9jYWxlIGRhdGEgaWYgaTE4biBvcHRpb25zIGFyZSBwcmVzZW50LlxuICAvLyBMb2NhbGUgZGF0YSBzaG91bGQgZ28gZmlyc3Qgc28gdGhhdCBwcm9qZWN0IHByb3ZpZGVkIHBvbHlmaWxsIGNvZGUgY2FuIGF1Z21lbnQgaWYgbmVlZGVkLlxuICBsZXQgbmVlZExvY2FsZURhdGFQbHVnaW4gPSBmYWxzZTtcbiAgaWYgKG9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgLy8gV2hlbiBpbmxpbmluZywgYSBwbGFjZWhvbGRlciBpcyB1c2VkIHRvIGFsbG93IHRoZSBwb3N0LXByb2Nlc3Npbmcgc3RlcCB0byBpbmplY3QgdGhlICRsb2NhbGl6ZSBsb2NhbGUgaWRlbnRpZmllclxuICAgIHBvbHlmaWxscy51bnNoaWZ0KCdhbmd1bGFyOmxvY2FsZS9wbGFjZWhvbGRlcicpO1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zPy51bnNoaWZ0KFxuICAgICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICAgIG5hbWVzcGFjZTogJ2FuZ3VsYXI6bG9jYWxlL3BsYWNlaG9sZGVyJyxcbiAgICAgICAgZW50cnlQb2ludE9ubHk6IGZhbHNlLFxuICAgICAgICBsb2FkQ29udGVudDogKCkgPT4gKHtcbiAgICAgICAgICBjb250ZW50czogYChnbG9iYWxUaGlzLiRsb2NhbGl6ZSA/Pz0ge30pLmxvY2FsZSA9IFwiX19fTkdfTE9DQUxFX0lOU0VSVF9fX1wiO1xcbmAsXG4gICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIH0pLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIC8vIEFkZCBsb2NhbGUgZGF0YSBmb3IgYWxsIGFjdGl2ZSBsb2NhbGVzXG4gICAgLy8gVE9ETzogSW5qZWN0IGVhY2ggaW5kaXZpZHVhbGx5IHdpdGhpbiB0aGUgaW5saW5pbmcgcHJvY2VzcyBpdHNlbGZcbiAgICBmb3IgKGNvbnN0IGxvY2FsZSBvZiBvcHRpb25zLmkxOG5PcHRpb25zLmlubGluZUxvY2FsZXMpIHtcbiAgICAgIHBvbHlmaWxscy51bnNoaWZ0KGBhbmd1bGFyOmxvY2FsZS9kYXRhOiR7bG9jYWxlfWApO1xuICAgIH1cbiAgICBuZWVkTG9jYWxlRGF0YVBsdWdpbiA9IHRydWU7XG4gIH0gZWxzZSBpZiAob3B0aW9ucy5pMThuT3B0aW9ucy5oYXNEZWZpbmVkU291cmNlTG9jYWxlKSB7XG4gICAgLy8gV2hlbiBub3QgaW5saW5pbmcgYW5kIGEgc291cmNlIGxvY2FsIGlzIHByZXNlbnQsIHVzZSB0aGUgc291cmNlIGxvY2FsZSBkYXRhIGRpcmVjdGx5XG4gICAgcG9seWZpbGxzLnVuc2hpZnQoYGFuZ3VsYXI6bG9jYWxlL2RhdGE6JHtvcHRpb25zLmkxOG5PcHRpb25zLnNvdXJjZUxvY2FsZX1gKTtcbiAgICBuZWVkTG9jYWxlRGF0YVBsdWdpbiA9IHRydWU7XG4gIH1cbiAgaWYgKG5lZWRMb2NhbGVEYXRhUGx1Z2luKSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnM/LnB1c2goY3JlYXRlQW5ndWxhckxvY2FsZURhdGFQbHVnaW4oKSk7XG4gIH1cblxuICAvLyBBZGQgcG9seWZpbGwgZW50cnkgcG9pbnQgaWYgcG9seWZpbGxzIGFyZSBwcmVzZW50XG4gIGlmIChwb2x5ZmlsbHMubGVuZ3RoKSB7XG4gICAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6cG9seWZpbGxzJztcbiAgICBidWlsZE9wdGlvbnMuZW50cnlQb2ludHMgPSB7XG4gICAgICAuLi5idWlsZE9wdGlvbnMuZW50cnlQb2ludHMsXG4gICAgICAncG9seWZpbGxzJzogbmFtZXNwYWNlLFxuICAgIH07XG5cbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucz8udW5zaGlmdChcbiAgICAgIGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW4oe1xuICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgIGxvYWRDb250ZW50OiAoKSA9PiAoe1xuICAgICAgICAgIGNvbnRlbnRzOiBwb2x5ZmlsbHMubWFwKChmaWxlKSA9PiBgaW1wb3J0ICcke2ZpbGUucmVwbGFjZSgvXFxcXC9nLCAnLycpfSc7YCkuam9pbignXFxuJyksXG4gICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIH0pLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBidWlsZE9wdGlvbnM7XG59XG5cbi8qKlxuICogQ3JlYXRlIGFuIGVzYnVpbGQgJ2J1aWxkJyBvcHRpb25zIG9iamVjdCBmb3IgdGhlIHNlcnZlciBidW5kbGUuXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgYnVpbGRlcidzIHVzZXItcHJvdmlkZXIgbm9ybWFsaXplZCBvcHRpb25zLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBCdWlsZE9wdGlvbnMgb2JqZWN0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2VydmVyQ29kZUJ1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyxcbiAgdGFyZ2V0OiBzdHJpbmdbXSxcbiAgc291cmNlRmlsZUNhY2hlOiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7XG4gICAgaml0LFxuICAgIHNlcnZlckVudHJ5UG9pbnQsXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBzc3JPcHRpb25zLFxuICAgIHdhdGNoLFxuICAgIGV4dGVybmFsUGFja2FnZXMsXG4gICAgcHJlcmVuZGVyT3B0aW9ucyxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgYXNzZXJ0KFxuICAgIHNlcnZlckVudHJ5UG9pbnQsXG4gICAgJ2NyZWF0ZVNlcnZlckNvZGVCdW5kbGVPcHRpb25zIHNob3VsZCBub3QgYmUgY2FsbGVkIHdpdGhvdXQgYSBkZWZpbmVkIHNlcnZlckVudHJ5UG9pbnQuJyxcbiAgKTtcblxuICBjb25zdCB7IHBsdWdpbk9wdGlvbnMsIHN0eWxlT3B0aW9ucyB9ID0gY3JlYXRlQ29tcGlsZXJQbHVnaW5PcHRpb25zKFxuICAgIG9wdGlvbnMsXG4gICAgdGFyZ2V0LFxuICAgIHNvdXJjZUZpbGVDYWNoZSxcbiAgKTtcblxuICBjb25zdCBtYWluU2VydmVyTmFtZXNwYWNlID0gJ2FuZ3VsYXI6bWFpbi1zZXJ2ZXInO1xuICBjb25zdCBzc3JFbnRyeU5hbWVzcGFjZSA9ICdhbmd1bGFyOnNzci1lbnRyeSc7XG5cbiAgY29uc3QgZW50cnlQb2ludHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgJ21haW4uc2VydmVyJzogbWFpblNlcnZlck5hbWVzcGFjZSxcbiAgfTtcblxuICBjb25zdCBzc3JFbnRyeVBvaW50ID0gc3NyT3B0aW9ucz8uZW50cnk7XG4gIGlmIChzc3JFbnRyeVBvaW50KSB7XG4gICAgZW50cnlQb2ludHNbJ3NlcnZlciddID0gc3NyRW50cnlOYW1lc3BhY2U7XG4gIH1cblxuICBjb25zdCBidWlsZE9wdGlvbnM6IEJ1aWxkT3B0aW9ucyA9IHtcbiAgICAuLi5nZXRFc0J1aWxkQ29tbW9uT3B0aW9ucyhvcHRpb25zKSxcbiAgICBwbGF0Zm9ybTogJ25vZGUnLFxuICAgIC8vIFRPRE86IEludmVzaWdhdGUgd2h5IGVuYWJsaW5nIGBzcGxpdHRpbmdgIGluIEpJVCBtb2RlIGNhdXNlcyBhbiBcIidAYW5ndWxhci9jb21waWxlcicgaXMgbm90IGF2YWlsYWJsZVwiIGVycm9yLlxuICAgIHNwbGl0dGluZzogIWppdCxcbiAgICBvdXRFeHRlbnNpb246IHsgJy5qcyc6ICcubWpzJyB9LFxuICAgIC8vIE5vdGU6IGBlczIwMTVgIGlzIG5lZWRlZCBmb3IgUnhKUyB2Ni4gSWYgbm90IHNwZWNpZmllZCwgYG1vZHVsZWAgd291bGRcbiAgICAvLyBtYXRjaCBhbmQgdGhlIEVTNSBkaXN0cmlidXRpb24gd291bGQgYmUgYnVuZGxlZCBhbmQgZW5kcyB1cCBicmVha2luZyBhdFxuICAgIC8vIHJ1bnRpbWUgd2l0aCB0aGUgUnhKUyB0ZXN0aW5nIGxpYnJhcnkuXG4gICAgLy8gTW9yZSBkZXRhaWxzOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMjU0MDUuXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnZXMyMDE1JywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgZW50cnlOYW1lczogJ1tuYW1lXScsXG4gICAgdGFyZ2V0LFxuICAgIGJhbm5lcjoge1xuICAgICAgLy8gTm90ZTogTmVlZGVkIGFzIGVzYnVpbGQgZG9lcyBub3QgcHJvdmlkZSByZXF1aXJlIHNoaW1zIC8gcHJveHkgZnJvbSBFU01vZHVsZXMuXG4gICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9ldmFudy9lc2J1aWxkL2lzc3Vlcy8xOTIxLlxuICAgICAganM6IFtcbiAgICAgICAgYGltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdub2RlOm1vZHVsZSc7YCxcbiAgICAgICAgYGdsb2JhbFRoaXNbJ3JlcXVpcmUnXSA/Pz0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpO2AsXG4gICAgICBdLmpvaW4oJ1xcbicpLFxuICAgIH0sXG4gICAgZW50cnlQb2ludHMsXG4gICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNvdXJjZW1hcElnbm9yZWxpc3RQbHVnaW4oKSxcbiAgICAgIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICAgICAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgICAgIHsgLi4ucGx1Z2luT3B0aW9ucywgbm9vcFR5cGVTY3JpcHRDb21waWxhdGlvbjogdHJ1ZSB9LFxuICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzaGVldCBvcHRpb25zXG4gICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICksXG4gICAgXSxcbiAgfTtcblxuICBidWlsZE9wdGlvbnMucGx1Z2lucyA/Pz0gW107XG4gIGlmIChleHRlcm5hbFBhY2thZ2VzKSB7XG4gICAgYnVpbGRPcHRpb25zLnBhY2thZ2VzID0gJ2V4dGVybmFsJztcbiAgfSBlbHNlIHtcbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKGNyZWF0ZVJ4anNFc21SZXNvbHV0aW9uUGx1Z2luKCkpO1xuICB9XG5cbiAgY29uc3QgcG9seWZpbGxzOiBzdHJpbmdbXSA9IFtdO1xuICBpZiAob3B0aW9ucy5wb2x5ZmlsbHM/LmluY2x1ZGVzKCd6b25lLmpzJykpIHtcbiAgICBwb2x5ZmlsbHMucHVzaChgaW1wb3J0ICd6b25lLmpzL25vZGUnO2ApO1xuICB9XG5cbiAgaWYgKGppdCkge1xuICAgIHBvbHlmaWxscy5wdXNoKGBpbXBvcnQgJ0Bhbmd1bGFyL2NvbXBpbGVyJztgKTtcbiAgfVxuXG4gIHBvbHlmaWxscy5wdXNoKGBpbXBvcnQgJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlci9pbml0JztgKTtcblxuICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKFxuICAgIGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW4oe1xuICAgICAgbmFtZXNwYWNlOiBtYWluU2VydmVyTmFtZXNwYWNlLFxuICAgICAgbG9hZENvbnRlbnQ6IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgbWFpblNlcnZlckVudHJ5UG9pbnQgPSByZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCBzZXJ2ZXJFbnRyeVBvaW50KS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG5cbiAgICAgICAgY29uc3QgY29udGVudHMgPSBbXG4gICAgICAgICAgLi4ucG9seWZpbGxzLFxuICAgICAgICAgIGBpbXBvcnQgbW9kdWxlT3JCb290c3RyYXBGbiBmcm9tICcuLyR7bWFpblNlcnZlckVudHJ5UG9pbnR9JztgLFxuICAgICAgICAgIGBleHBvcnQgZGVmYXVsdCBtb2R1bGVPckJvb3RzdHJhcEZuO2AsXG4gICAgICAgICAgYGV4cG9ydCAqIGZyb20gJy4vJHttYWluU2VydmVyRW50cnlQb2ludH0nO2AsXG4gICAgICAgICAgYGV4cG9ydCB7IHJlbmRlckFwcGxpY2F0aW9uLCByZW5kZXJNb2R1bGUsIMm1U0VSVkVSX0NPTlRFWFQgfSBmcm9tICdAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXInO2AsXG4gICAgICAgIF07XG5cbiAgICAgICAgaWYgKHdhdGNoKSB7XG4gICAgICAgICAgY29udGVudHMucHVzaChgZXhwb3J0IHsgybVyZXNldENvbXBpbGVkQ29tcG9uZW50cyB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHByZXJlbmRlck9wdGlvbnM/LmRpc2NvdmVyUm91dGVzKSB7XG4gICAgICAgICAgLy8gV2UgZG8gbm90IGltcG9ydCBpdCBkaXJlY3RseSBzbyB0aGF0IG5vZGUuanMgbW9kdWxlcyBhcmUgcmVzb2x2ZWQgdXNpbmcgdGhlIGNvcnJlY3QgY29udGV4dC5cbiAgICAgICAgICBjb25zdCByb3V0ZXNFeHRyYWN0b3JDb2RlID0gYXdhaXQgcmVhZEZpbGUoXG4gICAgICAgICAgICBqb2luKF9fZGlybmFtZSwgJy4uLy4uL3V0aWxzL3JvdXRlcy1leHRyYWN0b3IvZXh0cmFjdG9yLmpzJyksXG4gICAgICAgICAgICAndXRmLTgnLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICAvLyBSZW1vdmUgc291cmNlIG1hcCBVUkwgY29tbWVudHMgZnJvbSB0aGUgY29kZSBpZiBhIHNvdXJjZW1hcCBpcyBwcmVzZW50IGFzIHRoaXMgd2lsbCBub3QgbWF0Y2ggdGhlIGZpbGUuXG4gICAgICAgICAgY29udGVudHMucHVzaChyb3V0ZXNFeHRyYWN0b3JDb2RlLnJlcGxhY2UoL15cXC9cXC8jIHNvdXJjZU1hcHBpbmdVUkw9W15cXHJcXG5dKi9nbSwgJycpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgY29udGVudHM6IGNvbnRlbnRzLmpvaW4oJ1xcbicpLFxuICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICB9KSxcbiAgKTtcblxuICBpZiAoc3NyRW50cnlQb2ludCkge1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goXG4gICAgICBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luKHtcbiAgICAgICAgbmFtZXNwYWNlOiBzc3JFbnRyeU5hbWVzcGFjZSxcbiAgICAgICAgbG9hZENvbnRlbnQ6ICgpID0+IHtcbiAgICAgICAgICBjb25zdCBzZXJ2ZXJFbnRyeVBvaW50ID0gcmVsYXRpdmUod29ya3NwYWNlUm9vdCwgc3NyRW50cnlQb2ludCkucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNvbnRlbnRzOiBbXG4gICAgICAgICAgICAgIC4uLnBvbHlmaWxscyxcbiAgICAgICAgICAgICAgYGltcG9ydCAnLi8ke3NlcnZlckVudHJ5UG9pbnR9JztgLFxuICAgICAgICAgICAgICBgZXhwb3J0ICogZnJvbSAnLi8ke3NlcnZlckVudHJ5UG9pbnR9JztgLFxuICAgICAgICAgICAgXS5qb2luKCdcXG4nKSxcbiAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gYnVpbGRPcHRpb25zO1xufVxuXG5mdW5jdGlvbiBnZXRFc0J1aWxkQ29tbW9uT3B0aW9ucyhvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMpOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7XG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBvdXRFeHRlbnNpb24sXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgaml0LFxuICB9ID0gb3B0aW9ucztcblxuICAvLyBFbnN1cmUgdW5pcXVlIGhhc2hlcyBmb3IgaTE4biB0cmFuc2xhdGlvbiBjaGFuZ2VzIHdoZW4gdXNpbmcgcG9zdC1wcm9jZXNzIGlubGluaW5nLlxuICAvLyBUaGlzIGhhc2ggdmFsdWUgaXMgYWRkZWQgYXMgYSBmb290ZXIgdG8gZWFjaCBmaWxlIGFuZCBlbnN1cmVzIHRoYXQgdGhlIG91dHB1dCBmaWxlIG5hbWVzICh3aXRoIGhhc2hlcylcbiAgLy8gY2hhbmdlIHdoZW4gdHJhbnNsYXRpb24gZmlsZXMgaGF2ZSBjaGFuZ2VkLiBJZiB0aGlzIGlzIG5vdCBkb25lIHRoZSBwb3N0IHByb2Nlc3NlZCBmaWxlcyBtYXkgaGF2ZVxuICAvLyBkaWZmZXJlbnQgY29udGVudCBidXQgd291bGQgcmV0YWluIGlkZW50aWNhbCBwcm9kdWN0aW9uIGZpbGUgbmFtZXMgd2hpY2ggd291bGQgbGVhZCB0byBicm93c2VyIGNhY2hpbmcgcHJvYmxlbXMuXG4gIGxldCBmb290ZXI7XG4gIGlmIChvcHRpb25zLmkxOG5PcHRpb25zLnNob3VsZElubGluZSkge1xuICAgIC8vIFVwZGF0ZSBmaWxlIGhhc2hlcyB0byBpbmNsdWRlIHRyYW5zbGF0aW9uIGZpbGUgY29udGVudFxuICAgIGNvbnN0IGkxOG5IYXNoID0gT2JqZWN0LnZhbHVlcyhvcHRpb25zLmkxOG5PcHRpb25zLmxvY2FsZXMpLnJlZHVjZShcbiAgICAgIChkYXRhLCBsb2NhbGUpID0+IGRhdGEgKyBsb2NhbGUuZmlsZXMubWFwKChmaWxlKSA9PiBmaWxlLmludGVncml0eSB8fCAnJykuam9pbignfCcpLFxuICAgICAgJycsXG4gICAgKTtcblxuICAgIGZvb3RlciA9IHsganM6IGAvKippMThuOiR7Y3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGkxOG5IYXNoKS5kaWdlc3QoJ2hleCcpfSovYCB9O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBhYnNXb3JraW5nRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICBmb3JtYXQ6ICdlc20nLFxuICAgIGFzc2V0TmFtZXM6IG91dHB1dE5hbWVzLm1lZGlhLFxuICAgIGNvbmRpdGlvbnM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdtb2R1bGUnXSxcbiAgICByZXNvbHZlRXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgIGxlZ2FsQ29tbWVudHM6IG9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzID8gJ25vbmUnIDogJ2VvZicsXG4gICAgbG9nTGV2ZWw6IG9wdGlvbnMudmVyYm9zZSA/ICdkZWJ1ZycgOiAnc2lsZW50JyxcbiAgICBtaW5pZnlJZGVudGlmaWVyczogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzICYmIGFsbG93TWFuZ2xlLFxuICAgIG1pbmlmeVN5bnRheDogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzLFxuICAgIG1pbmlmeVdoaXRlc3BhY2U6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBwdXJlOiBbJ2ZvcndhcmRSZWYnXSxcbiAgICBvdXRkaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgb3V0RXh0ZW5zaW9uOiBvdXRFeHRlbnNpb24gPyB7ICcuanMnOiBgLiR7b3V0RXh0ZW5zaW9ufWAgfSA6IHVuZGVmaW5lZCxcbiAgICBzb3VyY2VtYXA6IHNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyAmJiAoc291cmNlbWFwT3B0aW9ucy5oaWRkZW4gPyAnZXh0ZXJuYWwnIDogdHJ1ZSksXG4gICAgc3BsaXR0aW5nOiB0cnVlLFxuICAgIGNodW5rTmFtZXM6ICdjaHVuay1baGFzaF0nLFxuICAgIHRzY29uZmlnLFxuICAgIGV4dGVybmFsOiBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICB3cml0ZTogZmFsc2UsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBkZWZpbmU6IHtcbiAgICAgIC8vIE9ubHkgc2V0IHRvIGZhbHNlIHdoZW4gc2NyaXB0IG9wdGltaXphdGlvbnMgYXJlIGVuYWJsZWQuIEl0IHNob3VsZCBub3QgYmUgc2V0IHRvIHRydWUgYmVjYXVzZVxuICAgICAgLy8gQW5ndWxhciB0dXJucyBgbmdEZXZNb2RlYCBpbnRvIGFuIG9iamVjdCBmb3IgZGV2ZWxvcG1lbnQgZGVidWdnaW5nIHB1cnBvc2VzIHdoZW4gbm90IGRlZmluZWRcbiAgICAgIC8vIHdoaWNoIGEgY29uc3RhbnQgdHJ1ZSB2YWx1ZSB3b3VsZCBicmVhay5cbiAgICAgIC4uLihvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgPyB7ICduZ0Rldk1vZGUnOiAnZmFsc2UnIH0gOiB1bmRlZmluZWQpLFxuICAgICAgJ25nSml0TW9kZSc6IGppdCA/ICd0cnVlJyA6ICdmYWxzZScsXG4gICAgfSxcbiAgICBmb290ZXIsXG4gIH07XG59XG4iXX0=