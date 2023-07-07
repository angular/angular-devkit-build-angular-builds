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
const node_path_1 = __importDefault(require("node:path"));
const environment_options_1 = require("../../utils/environment-options");
const compiler_plugin_1 = require("./angular/compiler-plugin");
const compiler_plugin_options_1 = require("./compiler-plugin-options");
const external_packages_plugin_1 = require("./external-packages-plugin");
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
            (0, sourcemap_ignorelist_plugin_1.createSourcemapIngorelistPlugin)(),
            (0, compiler_plugin_1.createCompilerPlugin)(
            // JS/TS options
            pluginOptions, 
            // Component stylesheet options
            styleOptions),
        ],
    };
    if (options.externalPackages) {
        buildOptions.plugins ?? (buildOptions.plugins = []);
        buildOptions.plugins.push((0, external_packages_plugin_1.createExternalPackagesPlugin)());
    }
    const polyfills = options.polyfills ? [...options.polyfills] : [];
    if (jit) {
        polyfills.push('@angular/compiler');
    }
    if (polyfills?.length) {
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
    const { jit, serverEntryPoint, workspaceRoot } = options;
    (0, node_assert_1.default)(serverEntryPoint, 'createServerCodeBundleOptions should not be called without a defined serverEntryPoint.');
    const { pluginOptions, styleOptions } = (0, compiler_plugin_options_1.createCompilerPluginOptions)(options, target, sourceFileCache);
    const namespace = 'angular:server-entry';
    const buildOptions = {
        ...getEsBuildCommonOptions(options),
        platform: 'node',
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
        entryPoints: {
            'server': namespace,
        },
        supported: (0, utils_1.getFeatureSupport)(target),
        plugins: [
            (0, sourcemap_ignorelist_plugin_1.createSourcemapIngorelistPlugin)(),
            (0, compiler_plugin_1.createCompilerPlugin)(
            // JS/TS options
            { ...pluginOptions, noopTypeScriptCompilation: true }, 
            // Component stylesheet options
            styleOptions),
            (0, virtual_module_plugin_1.createVirtualModulePlugin)({
                namespace,
                loadContent: () => {
                    const mainServerEntryPoint = node_path_1.default
                        .relative(workspaceRoot, serverEntryPoint)
                        .replace(/\\/g, '/');
                    const importAndExportDec = [
                        `import '@angular/platform-server/init';`,
                        `import moduleOrBootstrapFn from './${mainServerEntryPoint}';`,
                        `export default moduleOrBootstrapFn;`,
                        `export { renderApplication, renderModule, ɵSERVER_CONTEXT } from '@angular/platform-server';`,
                    ];
                    if (jit) {
                        importAndExportDec.unshift(`import '@angular/compiler';`);
                    }
                    return {
                        contents: importAndExportDec.join('\n'),
                        loader: 'js',
                        resolveDir: workspaceRoot,
                    };
                },
            }),
        ],
    };
    buildOptions.plugins ?? (buildOptions.plugins = []);
    if (options.externalPackages) {
        buildOptions.plugins.push((0, external_packages_plugin_1.createExternalPackagesPlugin)());
    }
    else {
        buildOptions.plugins.push((0, rxjs_esm_resolution_plugin_1.createRxjsEsmResolutionPlugin)());
    }
    return buildOptions;
}
exports.createServerCodeBundleOptions = createServerCodeBundleOptions;
function getEsBuildCommonOptions(options) {
    const { workspaceRoot, outExtension, optimizationOptions, sourcemapOptions, tsconfig, externalDependencies, outputNames, preserveSymlinks, jit, } = options;
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
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24tY29kZS1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FwcGxpY2F0aW9uLWNvZGUtYnVuZGxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDhEQUFpQztBQUNqQywwREFBNkI7QUFFN0IseUVBQThEO0FBQzlELCtEQUFrRjtBQUNsRix1RUFBd0U7QUFDeEUseUVBQTBFO0FBQzFFLDZFQUE2RTtBQUM3RSwrRUFBZ0Y7QUFDaEYsbUNBQTRDO0FBQzVDLG1FQUFvRTtBQUVwRSxTQUFnQiw4QkFBOEIsQ0FDNUMsT0FBMEMsRUFDMUMsTUFBZ0IsRUFDaEIsZUFBaUM7SUFFakMsTUFBTSxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLEdBQUcsRUFBRSxHQUFHLE9BQU8sQ0FBQztJQUVqRSxNQUFNLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxHQUFHLElBQUEscURBQTJCLEVBQ2pFLE9BQU8sRUFDUCxNQUFNLEVBQ04sZUFBZSxDQUNoQixDQUFDO0lBRUYsTUFBTSxZQUFZLEdBQWlCO1FBQ2pDLEdBQUcsdUJBQXVCLENBQUMsT0FBTyxDQUFDO1FBQ25DLFFBQVEsRUFBRSxTQUFTO1FBQ25CLHlFQUF5RTtRQUN6RSwwRUFBMEU7UUFDMUUseUNBQXlDO1FBQ3pDLHFFQUFxRTtRQUNyRSxVQUFVLEVBQUUsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDO1FBQzdELFVBQVUsRUFBRSxXQUFXLENBQUMsT0FBTztRQUMvQixXQUFXO1FBQ1gsTUFBTTtRQUNOLFNBQVMsRUFBRSxJQUFBLHlCQUFpQixFQUFDLE1BQU0sQ0FBQztRQUNwQyxPQUFPLEVBQUU7WUFDUCxJQUFB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RSxLQUFLO1FBQ1osZ0JBQWdCO1FBQ2hCLE1BQU0sRUFBRTtZQUNOLGdHQUFnRztZQUNoRywrRkFBK0Y7WUFDL0YsMkNBQTJDO1lBQzNDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDdkUsV0FBVyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPO1NBQ3BDO0tBQ0YsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZE9wdGlvbnMgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB0eXBlIHsgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zIH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYXBwbGljYXRpb24vb3B0aW9ucyc7XG5pbXBvcnQgeyBhbGxvd01hbmdsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlLCBjcmVhdGVDb21waWxlclBsdWdpbiB9IGZyb20gJy4vYW5ndWxhci9jb21waWxlci1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlQ29tcGlsZXJQbHVnaW5PcHRpb25zIH0gZnJvbSAnLi9jb21waWxlci1wbHVnaW4tb3B0aW9ucyc7XG5pbXBvcnQgeyBjcmVhdGVFeHRlcm5hbFBhY2thZ2VzUGx1Z2luIH0gZnJvbSAnLi9leHRlcm5hbC1wYWNrYWdlcy1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlUnhqc0VzbVJlc29sdXRpb25QbHVnaW4gfSBmcm9tICcuL3J4anMtZXNtLXJlc29sdXRpb24tcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZVNvdXJjZW1hcEluZ29yZWxpc3RQbHVnaW4gfSBmcm9tICcuL3NvdXJjZW1hcC1pZ25vcmVsaXN0LXBsdWdpbic7XG5pbXBvcnQgeyBnZXRGZWF0dXJlU3VwcG9ydCB9IGZyb20gJy4vdXRpbHMnO1xuaW1wb3J0IHsgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbiB9IGZyb20gJy4vdmlydHVhbC1tb2R1bGUtcGx1Z2luJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUJyb3dzZXJDb2RlQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7IHdvcmtzcGFjZVJvb3QsIGVudHJ5UG9pbnRzLCBvdXRwdXROYW1lcywgaml0IH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IHsgcGx1Z2luT3B0aW9ucywgc3R5bGVPcHRpb25zIH0gPSBjcmVhdGVDb21waWxlclBsdWdpbk9wdGlvbnMoXG4gICAgb3B0aW9ucyxcbiAgICB0YXJnZXQsXG4gICAgc291cmNlRmlsZUNhY2hlLFxuICApO1xuXG4gIGNvbnN0IGJ1aWxkT3B0aW9uczogQnVpbGRPcHRpb25zID0ge1xuICAgIC4uLmdldEVzQnVpbGRDb21tb25PcHRpb25zKG9wdGlvbnMpLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgLy8gTm90ZTogYGVzMjAxNWAgaXMgbmVlZGVkIGZvciBSeEpTIHY2LiBJZiBub3Qgc3BlY2lmaWVkLCBgbW9kdWxlYCB3b3VsZFxuICAgIC8vIG1hdGNoIGFuZCB0aGUgRVM1IGRpc3RyaWJ1dGlvbiB3b3VsZCBiZSBidW5kbGVkIGFuZCBlbmRzIHVwIGJyZWFraW5nIGF0XG4gICAgLy8gcnVudGltZSB3aXRoIHRoZSBSeEpTIHRlc3RpbmcgbGlicmFyeS5cbiAgICAvLyBNb3JlIGRldGFpbHM6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNTQwNS5cbiAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgIGVudHJ5TmFtZXM6IG91dHB1dE5hbWVzLmJ1bmRsZXMsXG4gICAgZW50cnlQb2ludHMsXG4gICAgdGFyZ2V0LFxuICAgIHN1cHBvcnRlZDogZ2V0RmVhdHVyZVN1cHBvcnQodGFyZ2V0KSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVTb3VyY2VtYXBJbmdvcmVsaXN0UGx1Z2luKCksXG4gICAgICBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgICAgICAgLy8gSlMvVFMgb3B0aW9uc1xuICAgICAgICBwbHVnaW5PcHRpb25zLFxuICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzaGVldCBvcHRpb25zXG4gICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICksXG4gICAgXSxcbiAgfTtcblxuICBpZiAob3B0aW9ucy5leHRlcm5hbFBhY2thZ2VzKSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnMgPz89IFtdO1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goY3JlYXRlRXh0ZXJuYWxQYWNrYWdlc1BsdWdpbigpKTtcbiAgfVxuXG4gIGNvbnN0IHBvbHlmaWxscyA9IG9wdGlvbnMucG9seWZpbGxzID8gWy4uLm9wdGlvbnMucG9seWZpbGxzXSA6IFtdO1xuICBpZiAoaml0KSB7XG4gICAgcG9seWZpbGxzLnB1c2goJ0Bhbmd1bGFyL2NvbXBpbGVyJyk7XG4gIH1cblxuICBpZiAocG9seWZpbGxzPy5sZW5ndGgpIHtcbiAgICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpwb2x5ZmlsbHMnO1xuICAgIGJ1aWxkT3B0aW9ucy5lbnRyeVBvaW50cyA9IHtcbiAgICAgIC4uLmJ1aWxkT3B0aW9ucy5lbnRyeVBvaW50cyxcbiAgICAgICdwb2x5ZmlsbHMnOiBuYW1lc3BhY2UsXG4gICAgfTtcblxuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zPy51bnNoaWZ0KFxuICAgICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgbG9hZENvbnRlbnQ6ICgpID0+ICh7XG4gICAgICAgICAgY29udGVudHM6IHBvbHlmaWxscy5tYXAoKGZpbGUpID0+IGBpbXBvcnQgJyR7ZmlsZS5yZXBsYWNlKC9cXFxcL2csICcvJyl9JztgKS5qb2luKCdcXG4nKSxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgfSksXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gZXNidWlsZCAnYnVpbGQnIG9wdGlvbnMgb2JqZWN0IGZvciB0aGUgc2VydmVyIGJ1bmRsZS5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBidWlsZGVyJ3MgdXNlci1wcm92aWRlciBub3JtYWxpemVkIG9wdGlvbnMuXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIEJ1aWxkT3B0aW9ucyBvYmplY3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTZXJ2ZXJDb2RlQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU6IFNvdXJjZUZpbGVDYWNoZSxcbik6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHsgaml0LCBzZXJ2ZXJFbnRyeVBvaW50LCB3b3Jrc3BhY2VSb290IH0gPSBvcHRpb25zO1xuXG4gIGFzc2VydChcbiAgICBzZXJ2ZXJFbnRyeVBvaW50LFxuICAgICdjcmVhdGVTZXJ2ZXJDb2RlQnVuZGxlT3B0aW9ucyBzaG91bGQgbm90IGJlIGNhbGxlZCB3aXRob3V0IGEgZGVmaW5lZCBzZXJ2ZXJFbnRyeVBvaW50LicsXG4gICk7XG5cbiAgY29uc3QgeyBwbHVnaW5PcHRpb25zLCBzdHlsZU9wdGlvbnMgfSA9IGNyZWF0ZUNvbXBpbGVyUGx1Z2luT3B0aW9ucyhcbiAgICBvcHRpb25zLFxuICAgIHRhcmdldCxcbiAgICBzb3VyY2VGaWxlQ2FjaGUsXG4gICk7XG5cbiAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6c2VydmVyLWVudHJ5JztcblxuICBjb25zdCBidWlsZE9wdGlvbnM6IEJ1aWxkT3B0aW9ucyA9IHtcbiAgICAuLi5nZXRFc0J1aWxkQ29tbW9uT3B0aW9ucyhvcHRpb25zKSxcbiAgICBwbGF0Zm9ybTogJ25vZGUnLFxuICAgIG91dEV4dGVuc2lvbjogeyAnLmpzJzogJy5tanMnIH0sXG4gICAgLy8gTm90ZTogYGVzMjAxNWAgaXMgbmVlZGVkIGZvciBSeEpTIHY2LiBJZiBub3Qgc3BlY2lmaWVkLCBgbW9kdWxlYCB3b3VsZFxuICAgIC8vIG1hdGNoIGFuZCB0aGUgRVM1IGRpc3RyaWJ1dGlvbiB3b3VsZCBiZSBidW5kbGVkIGFuZCBlbmRzIHVwIGJyZWFraW5nIGF0XG4gICAgLy8gcnVudGltZSB3aXRoIHRoZSBSeEpTIHRlc3RpbmcgbGlicmFyeS5cbiAgICAvLyBNb3JlIGRldGFpbHM6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNTQwNS5cbiAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICBlbnRyeU5hbWVzOiAnW25hbWVdJyxcbiAgICB0YXJnZXQsXG4gICAgYmFubmVyOiB7XG4gICAgICAvLyBOb3RlOiBOZWVkZWQgYXMgZXNidWlsZCBkb2VzIG5vdCBwcm92aWRlIHJlcXVpcmUgc2hpbXMgLyBwcm94eSBmcm9tIEVTTW9kdWxlcy5cbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2V2YW53L2VzYnVpbGQvaXNzdWVzLzE5MjEuXG4gICAgICBqczogW1xuICAgICAgICBgaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJztgLFxuICAgICAgICBgZ2xvYmFsVGhpc1sncmVxdWlyZSddID8/PSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybCk7YCxcbiAgICAgIF0uam9pbignXFxuJyksXG4gICAgfSxcbiAgICBlbnRyeVBvaW50czoge1xuICAgICAgJ3NlcnZlcic6IG5hbWVzcGFjZSxcbiAgICB9LFxuICAgIHN1cHBvcnRlZDogZ2V0RmVhdHVyZVN1cHBvcnQodGFyZ2V0KSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVTb3VyY2VtYXBJbmdvcmVsaXN0UGx1Z2luKCksXG4gICAgICBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgICAgICAgLy8gSlMvVFMgb3B0aW9uc1xuICAgICAgICB7IC4uLnBsdWdpbk9wdGlvbnMsIG5vb3BUeXBlU2NyaXB0Q29tcGlsYXRpb246IHRydWUgfSxcbiAgICAgICAgLy8gQ29tcG9uZW50IHN0eWxlc2hlZXQgb3B0aW9uc1xuICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICApLFxuICAgICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgbG9hZENvbnRlbnQ6ICgpID0+IHtcbiAgICAgICAgICBjb25zdCBtYWluU2VydmVyRW50cnlQb2ludCA9IHBhdGhcbiAgICAgICAgICAgIC5yZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCBzZXJ2ZXJFbnRyeVBvaW50KVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICAgICAgICBjb25zdCBpbXBvcnRBbmRFeHBvcnREZWM6IHN0cmluZ1tdID0gW1xuICAgICAgICAgICAgYGltcG9ydCAnQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyL2luaXQnO2AsXG4gICAgICAgICAgICBgaW1wb3J0IG1vZHVsZU9yQm9vdHN0cmFwRm4gZnJvbSAnLi8ke21haW5TZXJ2ZXJFbnRyeVBvaW50fSc7YCxcbiAgICAgICAgICAgIGBleHBvcnQgZGVmYXVsdCBtb2R1bGVPckJvb3RzdHJhcEZuO2AsXG4gICAgICAgICAgICBgZXhwb3J0IHsgcmVuZGVyQXBwbGljYXRpb24sIHJlbmRlck1vZHVsZSwgybVTRVJWRVJfQ09OVEVYVCB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcic7YCxcbiAgICAgICAgICBdO1xuXG4gICAgICAgICAgaWYgKGppdCkge1xuICAgICAgICAgICAgaW1wb3J0QW5kRXhwb3J0RGVjLnVuc2hpZnQoYGltcG9ydCAnQGFuZ3VsYXIvY29tcGlsZXInO2ApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb250ZW50czogaW1wb3J0QW5kRXhwb3J0RGVjLmpvaW4oJ1xcbicpLFxuICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgXSxcbiAgfTtcblxuICBidWlsZE9wdGlvbnMucGx1Z2lucyA/Pz0gW107XG4gIGlmIChvcHRpb25zLmV4dGVybmFsUGFja2FnZXMpIHtcbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKGNyZWF0ZUV4dGVybmFsUGFja2FnZXNQbHVnaW4oKSk7XG4gIH0gZWxzZSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnMucHVzaChjcmVhdGVSeGpzRXNtUmVzb2x1dGlvblBsdWdpbigpKTtcbiAgfVxuXG4gIHJldHVybiBidWlsZE9wdGlvbnM7XG59XG5cbmZ1bmN0aW9uIGdldEVzQnVpbGRDb21tb25PcHRpb25zKG9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyk6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHtcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG91dEV4dGVuc2lvbixcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBqaXQsXG4gIH0gPSBvcHRpb25zO1xuXG4gIHJldHVybiB7XG4gICAgYWJzV29ya2luZ0Rpcjogd29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IHRydWUsXG4gICAgZm9ybWF0OiAnZXNtJyxcbiAgICBhc3NldE5hbWVzOiBvdXRwdXROYW1lcy5tZWRpYSxcbiAgICBjb25kaXRpb25zOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnbW9kdWxlJ10sXG4gICAgcmVzb2x2ZUV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBsZWdhbENvbW1lbnRzOiBvcHRpb25zLmV4dHJhY3RMaWNlbnNlcyA/ICdub25lJyA6ICdlb2YnLFxuICAgIGxvZ0xldmVsOiBvcHRpb25zLnZlcmJvc2UgPyAnZGVidWcnIDogJ3NpbGVudCcsXG4gICAgbWluaWZ5SWRlbnRpZmllcnM6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyAmJiBhbGxvd01hbmdsZSxcbiAgICBtaW5pZnlTeW50YXg6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBtaW5pZnlXaGl0ZXNwYWNlOiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgcHVyZTogWydmb3J3YXJkUmVmJ10sXG4gICAgb3V0ZGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIG91dEV4dGVuc2lvbjogb3V0RXh0ZW5zaW9uID8geyAnLmpzJzogYC4ke291dEV4dGVuc2lvbn1gIH0gOiB1bmRlZmluZWQsXG4gICAgc291cmNlbWFwOiBzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gJ2V4dGVybmFsJyA6IHRydWUpLFxuICAgIHNwbGl0dGluZzogdHJ1ZSxcbiAgICB0c2NvbmZpZyxcbiAgICBleHRlcm5hbDogZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgZGVmaW5lOiB7XG4gICAgICAvLyBPbmx5IHNldCB0byBmYWxzZSB3aGVuIHNjcmlwdCBvcHRpbWl6YXRpb25zIGFyZSBlbmFibGVkLiBJdCBzaG91bGQgbm90IGJlIHNldCB0byB0cnVlIGJlY2F1c2VcbiAgICAgIC8vIEFuZ3VsYXIgdHVybnMgYG5nRGV2TW9kZWAgaW50byBhbiBvYmplY3QgZm9yIGRldmVsb3BtZW50IGRlYnVnZ2luZyBwdXJwb3NlcyB3aGVuIG5vdCBkZWZpbmVkXG4gICAgICAvLyB3aGljaCBhIGNvbnN0YW50IHRydWUgdmFsdWUgd291bGQgYnJlYWsuXG4gICAgICAuLi4ob3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzID8geyAnbmdEZXZNb2RlJzogJ2ZhbHNlJyB9IDogdW5kZWZpbmVkKSxcbiAgICAgICduZ0ppdE1vZGUnOiBqaXQgPyAndHJ1ZScgOiAnZmFsc2UnLFxuICAgIH0sXG4gIH07XG59XG4iXX0=