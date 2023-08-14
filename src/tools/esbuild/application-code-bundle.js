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
        buildOptions.packages = 'external';
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
    const { jit, serverEntryPoint, workspaceRoot, ssrOptions } = options;
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
            (0, sourcemap_ignorelist_plugin_1.createSourcemapIngorelistPlugin)(),
            (0, compiler_plugin_1.createCompilerPlugin)(
            // JS/TS options
            { ...pluginOptions, noopTypeScriptCompilation: true }, 
            // Component stylesheet options
            styleOptions),
        ],
    };
    buildOptions.plugins ?? (buildOptions.plugins = []);
    if (options.externalPackages) {
        buildOptions.packages = 'external';
    }
    else {
        buildOptions.plugins.push((0, rxjs_esm_resolution_plugin_1.createRxjsEsmResolutionPlugin)());
    }
    const polyfills = [`import '@angular/platform-server/init';`];
    if (options.polyfills?.includes('zone.js')) {
        polyfills.push(`import 'zone.js/fesm2015/zone-node.js';`);
    }
    if (jit) {
        polyfills.push(`import '@angular/compiler';`);
    }
    buildOptions.plugins.push((0, virtual_module_plugin_1.createVirtualModulePlugin)({
        namespace: mainServerNamespace,
        loadContent: () => {
            const mainServerEntryPoint = node_path_1.default
                .relative(workspaceRoot, serverEntryPoint)
                .replace(/\\/g, '/');
            return {
                contents: [
                    ...polyfills,
                    `import moduleOrBootstrapFn from './${mainServerEntryPoint}';`,
                    `export default moduleOrBootstrapFn;`,
                    `export * from './${mainServerEntryPoint}';`,
                    `export { renderApplication, renderModule, ɵSERVER_CONTEXT } from '@angular/platform-server';`,
                ].join('\n'),
                loader: 'js',
                resolveDir: workspaceRoot,
            };
        },
    }));
    if (ssrEntryPoint) {
        buildOptions.plugins.push((0, virtual_module_plugin_1.createVirtualModulePlugin)({
            namespace: ssrEntryNamespace,
            loadContent: () => {
                const mainServerEntryPoint = node_path_1.default
                    .relative(workspaceRoot, ssrEntryPoint)
                    .replace(/\\/g, '/');
                return {
                    contents: [
                        ...polyfills,
                        `import './${mainServerEntryPoint}';`,
                        `export * from './${mainServerEntryPoint}';`,
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
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24tY29kZS1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FwcGxpY2F0aW9uLWNvZGUtYnVuZGxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDhEQUFpQztBQUNqQywwREFBNkI7QUFFN0IseUVBQThEO0FBQzlELCtEQUFrRjtBQUNsRix1RUFBd0U7QUFDeEUsNkVBQTZFO0FBQzdFLCtFQUFnRjtBQUNoRixtQ0FBNEM7QUFDNUMsbUVBQW9FO0FBRXBFLFNBQWdCLDhCQUE4QixDQUM1QyxPQUEwQyxFQUMxQyxNQUFnQixFQUNoQixlQUFpQztJQUVqQyxNQUFNLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLEdBQUcsT0FBTyxDQUFDO0lBRWpFLE1BQU0sRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLEdBQUcsSUFBQSxxREFBMkIsRUFDakUsT0FBTyxFQUNQLE1BQU0sRUFDTixlQUFlLENBQ2hCLENBQUM7SUFFRixNQUFNLFlBQVksR0FBaUI7UUFDakMsR0FBRyx1QkFBdUIsQ0FBQyxPQUFPLENBQUM7UUFDbkMsUUFBUSxFQUFFLFNBQVM7UUFDbkIseUVBQXlFO1FBQ3pFLDBFQUEwRTtRQUMxRSx5Q0FBeUM7UUFDekMscUVBQXFFO1FBQ3JFLFVBQVUsRUFBRSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUM7UUFDN0QsVUFBVSxFQUFFLFdBQVcsQ0FBQyxPQUFPO1FBQy9CLFdBQVc7UUFDWCxNQUFNO1FBQ04sU0FBUyxFQUFFLElBQUEseUJBQWlCLEVBQUMsTUFBTSxDQUFDO1FBQ3BDLE9BQU8sRUFBRTtZQUNQLElBQUEsNkRBQStCLEdBQUU7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QyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPO1NBQ3BDO0tBQ0YsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZE9wdGlvbnMgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB0eXBlIHsgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zIH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYXBwbGljYXRpb24vb3B0aW9ucyc7XG5pbXBvcnQgeyBhbGxvd01hbmdsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlLCBjcmVhdGVDb21waWxlclBsdWdpbiB9IGZyb20gJy4vYW5ndWxhci9jb21waWxlci1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlQ29tcGlsZXJQbHVnaW5PcHRpb25zIH0gZnJvbSAnLi9jb21waWxlci1wbHVnaW4tb3B0aW9ucyc7XG5pbXBvcnQgeyBjcmVhdGVSeGpzRXNtUmVzb2x1dGlvblBsdWdpbiB9IGZyb20gJy4vcnhqcy1lc20tcmVzb2x1dGlvbi1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlU291cmNlbWFwSW5nb3JlbGlzdFBsdWdpbiB9IGZyb20gJy4vc291cmNlbWFwLWlnbm9yZWxpc3QtcGx1Z2luJztcbmltcG9ydCB7IGdldEZlYXR1cmVTdXBwb3J0IH0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQgeyBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luIH0gZnJvbSAnLi92aXJ0dWFsLW1vZHVsZS1wbHVnaW4nO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQnJvd3NlckNvZGVCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZSxcbik6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHsgd29ya3NwYWNlUm9vdCwgZW50cnlQb2ludHMsIG91dHB1dE5hbWVzLCBqaXQgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgeyBwbHVnaW5PcHRpb25zLCBzdHlsZU9wdGlvbnMgfSA9IGNyZWF0ZUNvbXBpbGVyUGx1Z2luT3B0aW9ucyhcbiAgICBvcHRpb25zLFxuICAgIHRhcmdldCxcbiAgICBzb3VyY2VGaWxlQ2FjaGUsXG4gICk7XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zOiBCdWlsZE9wdGlvbnMgPSB7XG4gICAgLi4uZ2V0RXNCdWlsZENvbW1vbk9wdGlvbnMob3B0aW9ucyksXG4gICAgcGxhdGZvcm06ICdicm93c2VyJyxcbiAgICAvLyBOb3RlOiBgZXMyMDE1YCBpcyBuZWVkZWQgZm9yIFJ4SlMgdjYuIElmIG5vdCBzcGVjaWZpZWQsIGBtb2R1bGVgIHdvdWxkXG4gICAgLy8gbWF0Y2ggYW5kIHRoZSBFUzUgZGlzdHJpYnV0aW9uIHdvdWxkIGJlIGJ1bmRsZWQgYW5kIGVuZHMgdXAgYnJlYWtpbmcgYXRcbiAgICAvLyBydW50aW1lIHdpdGggdGhlIFJ4SlMgdGVzdGluZyBsaWJyYXJ5LlxuICAgIC8vIE1vcmUgZGV0YWlsczogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzI1NDA1LlxuICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgZW50cnlOYW1lczogb3V0cHV0TmFtZXMuYnVuZGxlcyxcbiAgICBlbnRyeVBvaW50cyxcbiAgICB0YXJnZXQsXG4gICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNvdXJjZW1hcEluZ29yZWxpc3RQbHVnaW4oKSxcbiAgICAgIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICAgICAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgICAgIHBsdWdpbk9wdGlvbnMsXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgKSxcbiAgICBdLFxuICB9O1xuXG4gIGlmIChvcHRpb25zLmV4dGVybmFsUGFja2FnZXMpIHtcbiAgICBidWlsZE9wdGlvbnMucGFja2FnZXMgPSAnZXh0ZXJuYWwnO1xuICB9XG5cbiAgY29uc3QgcG9seWZpbGxzID0gb3B0aW9ucy5wb2x5ZmlsbHMgPyBbLi4ub3B0aW9ucy5wb2x5ZmlsbHNdIDogW107XG4gIGlmIChqaXQpIHtcbiAgICBwb2x5ZmlsbHMucHVzaCgnQGFuZ3VsYXIvY29tcGlsZXInKTtcbiAgfVxuXG4gIGlmIChwb2x5ZmlsbHM/Lmxlbmd0aCkge1xuICAgIGNvbnN0IG5hbWVzcGFjZSA9ICdhbmd1bGFyOnBvbHlmaWxscyc7XG4gICAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0ge1xuICAgICAgLi4uYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzLFxuICAgICAgJ3BvbHlmaWxscyc6IG5hbWVzcGFjZSxcbiAgICB9O1xuXG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnM/LnVuc2hpZnQoXG4gICAgICBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luKHtcbiAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICBsb2FkQ29udGVudDogKCkgPT4gKHtcbiAgICAgICAgICBjb250ZW50czogcG9seWZpbGxzLm1hcCgoZmlsZSkgPT4gYGltcG9ydCAnJHtmaWxlLnJlcGxhY2UoL1xcXFwvZywgJy8nKX0nO2ApLmpvaW4oJ1xcbicpLFxuICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICB9KSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gYnVpbGRPcHRpb25zO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhbiBlc2J1aWxkICdidWlsZCcgb3B0aW9ucyBvYmplY3QgZm9yIHRoZSBzZXJ2ZXIgYnVuZGxlLlxuICogQHBhcmFtIG9wdGlvbnMgVGhlIGJ1aWxkZXIncyB1c2VyLXByb3ZpZGVyIG5vcm1hbGl6ZWQgb3B0aW9ucy5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgQnVpbGRPcHRpb25zIG9iamVjdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNlcnZlckNvZGVCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIHNvdXJjZUZpbGVDYWNoZTogU291cmNlRmlsZUNhY2hlLFxuKTogQnVpbGRPcHRpb25zIHtcbiAgY29uc3QgeyBqaXQsIHNlcnZlckVudHJ5UG9pbnQsIHdvcmtzcGFjZVJvb3QsIHNzck9wdGlvbnMgfSA9IG9wdGlvbnM7XG5cbiAgYXNzZXJ0KFxuICAgIHNlcnZlckVudHJ5UG9pbnQsXG4gICAgJ2NyZWF0ZVNlcnZlckNvZGVCdW5kbGVPcHRpb25zIHNob3VsZCBub3QgYmUgY2FsbGVkIHdpdGhvdXQgYSBkZWZpbmVkIHNlcnZlckVudHJ5UG9pbnQuJyxcbiAgKTtcblxuICBjb25zdCB7IHBsdWdpbk9wdGlvbnMsIHN0eWxlT3B0aW9ucyB9ID0gY3JlYXRlQ29tcGlsZXJQbHVnaW5PcHRpb25zKFxuICAgIG9wdGlvbnMsXG4gICAgdGFyZ2V0LFxuICAgIHNvdXJjZUZpbGVDYWNoZSxcbiAgKTtcblxuICBjb25zdCBtYWluU2VydmVyTmFtZXNwYWNlID0gJ2FuZ3VsYXI6bWFpbi1zZXJ2ZXInO1xuICBjb25zdCBzc3JFbnRyeU5hbWVzcGFjZSA9ICdhbmd1bGFyOnNzci1lbnRyeSc7XG5cbiAgY29uc3QgZW50cnlQb2ludHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgJ21haW4uc2VydmVyJzogbWFpblNlcnZlck5hbWVzcGFjZSxcbiAgfTtcblxuICBjb25zdCBzc3JFbnRyeVBvaW50ID0gc3NyT3B0aW9ucz8uZW50cnk7XG4gIGlmIChzc3JFbnRyeVBvaW50KSB7XG4gICAgZW50cnlQb2ludHNbJ3NlcnZlciddID0gc3NyRW50cnlOYW1lc3BhY2U7XG4gIH1cblxuICBjb25zdCBidWlsZE9wdGlvbnM6IEJ1aWxkT3B0aW9ucyA9IHtcbiAgICAuLi5nZXRFc0J1aWxkQ29tbW9uT3B0aW9ucyhvcHRpb25zKSxcbiAgICBwbGF0Zm9ybTogJ25vZGUnLFxuICAgIG91dEV4dGVuc2lvbjogeyAnLmpzJzogJy5tanMnIH0sXG4gICAgLy8gTm90ZTogYGVzMjAxNWAgaXMgbmVlZGVkIGZvciBSeEpTIHY2LiBJZiBub3Qgc3BlY2lmaWVkLCBgbW9kdWxlYCB3b3VsZFxuICAgIC8vIG1hdGNoIGFuZCB0aGUgRVM1IGRpc3RyaWJ1dGlvbiB3b3VsZCBiZSBidW5kbGVkIGFuZCBlbmRzIHVwIGJyZWFraW5nIGF0XG4gICAgLy8gcnVudGltZSB3aXRoIHRoZSBSeEpTIHRlc3RpbmcgbGlicmFyeS5cbiAgICAvLyBNb3JlIGRldGFpbHM6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNTQwNS5cbiAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICBlbnRyeU5hbWVzOiAnW25hbWVdJyxcbiAgICB0YXJnZXQsXG4gICAgYmFubmVyOiB7XG4gICAgICAvLyBOb3RlOiBOZWVkZWQgYXMgZXNidWlsZCBkb2VzIG5vdCBwcm92aWRlIHJlcXVpcmUgc2hpbXMgLyBwcm94eSBmcm9tIEVTTW9kdWxlcy5cbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2V2YW53L2VzYnVpbGQvaXNzdWVzLzE5MjEuXG4gICAgICBqczogW1xuICAgICAgICBgaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJztgLFxuICAgICAgICBgZ2xvYmFsVGhpc1sncmVxdWlyZSddID8/PSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybCk7YCxcbiAgICAgIF0uam9pbignXFxuJyksXG4gICAgfSxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBzdXBwb3J0ZWQ6IGdldEZlYXR1cmVTdXBwb3J0KHRhcmdldCksXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlU291cmNlbWFwSW5nb3JlbGlzdFBsdWdpbigpLFxuICAgICAgY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gICAgICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICAgICAgeyAuLi5wbHVnaW5PcHRpb25zLCBub29wVHlwZVNjcmlwdENvbXBpbGF0aW9uOiB0cnVlIH0sXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgKSxcbiAgICBdLFxuICB9O1xuXG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zID8/PSBbXTtcbiAgaWYgKG9wdGlvbnMuZXh0ZXJuYWxQYWNrYWdlcykge1xuICAgIGJ1aWxkT3B0aW9ucy5wYWNrYWdlcyA9ICdleHRlcm5hbCc7XG4gIH0gZWxzZSB7XG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnMucHVzaChjcmVhdGVSeGpzRXNtUmVzb2x1dGlvblBsdWdpbigpKTtcbiAgfVxuXG4gIGNvbnN0IHBvbHlmaWxscyA9IFtgaW1wb3J0ICdAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXIvaW5pdCc7YF07XG5cbiAgaWYgKG9wdGlvbnMucG9seWZpbGxzPy5pbmNsdWRlcygnem9uZS5qcycpKSB7XG4gICAgcG9seWZpbGxzLnB1c2goYGltcG9ydCAnem9uZS5qcy9mZXNtMjAxNS96b25lLW5vZGUuanMnO2ApO1xuICB9XG5cbiAgaWYgKGppdCkge1xuICAgIHBvbHlmaWxscy5wdXNoKGBpbXBvcnQgJ0Bhbmd1bGFyL2NvbXBpbGVyJztgKTtcbiAgfVxuXG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goXG4gICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICBuYW1lc3BhY2U6IG1haW5TZXJ2ZXJOYW1lc3BhY2UsXG4gICAgICBsb2FkQ29udGVudDogKCkgPT4ge1xuICAgICAgICBjb25zdCBtYWluU2VydmVyRW50cnlQb2ludCA9IHBhdGhcbiAgICAgICAgICAucmVsYXRpdmUod29ya3NwYWNlUm9vdCwgc2VydmVyRW50cnlQb2ludClcbiAgICAgICAgICAucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgY29udGVudHM6IFtcbiAgICAgICAgICAgIC4uLnBvbHlmaWxscyxcbiAgICAgICAgICAgIGBpbXBvcnQgbW9kdWxlT3JCb290c3RyYXBGbiBmcm9tICcuLyR7bWFpblNlcnZlckVudHJ5UG9pbnR9JztgLFxuICAgICAgICAgICAgYGV4cG9ydCBkZWZhdWx0IG1vZHVsZU9yQm9vdHN0cmFwRm47YCxcbiAgICAgICAgICAgIGBleHBvcnQgKiBmcm9tICcuLyR7bWFpblNlcnZlckVudHJ5UG9pbnR9JztgLFxuICAgICAgICAgICAgYGV4cG9ydCB7IHJlbmRlckFwcGxpY2F0aW9uLCByZW5kZXJNb2R1bGUsIMm1U0VSVkVSX0NPTlRFWFQgfSBmcm9tICdAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXInO2AsXG4gICAgICAgICAgXS5qb2luKCdcXG4nKSxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgfSksXG4gICk7XG5cbiAgaWYgKHNzckVudHJ5UG9pbnQpIHtcbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKFxuICAgICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICAgIG5hbWVzcGFjZTogc3NyRW50cnlOYW1lc3BhY2UsXG4gICAgICAgIGxvYWRDb250ZW50OiAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgbWFpblNlcnZlckVudHJ5UG9pbnQgPSBwYXRoXG4gICAgICAgICAgICAucmVsYXRpdmUod29ya3NwYWNlUm9vdCwgc3NyRW50cnlQb2ludClcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29udGVudHM6IFtcbiAgICAgICAgICAgICAgLi4ucG9seWZpbGxzLFxuICAgICAgICAgICAgICBgaW1wb3J0ICcuLyR7bWFpblNlcnZlckVudHJ5UG9pbnR9JztgLFxuICAgICAgICAgICAgICBgZXhwb3J0ICogZnJvbSAnLi8ke21haW5TZXJ2ZXJFbnRyeVBvaW50fSc7YCxcbiAgICAgICAgICAgIF0uam9pbignXFxuJyksXG4gICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cblxuZnVuY3Rpb24gZ2V0RXNCdWlsZENvbW1vbk9wdGlvbnMob3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zKTogQnVpbGRPcHRpb25zIHtcbiAgY29uc3Qge1xuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgb3V0RXh0ZW5zaW9uLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB0c2NvbmZpZyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIGppdCxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgcmV0dXJuIHtcbiAgICBhYnNXb3JraW5nRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICBmb3JtYXQ6ICdlc20nLFxuICAgIGFzc2V0TmFtZXM6IG91dHB1dE5hbWVzLm1lZGlhLFxuICAgIGNvbmRpdGlvbnM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdtb2R1bGUnXSxcbiAgICByZXNvbHZlRXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgIGxlZ2FsQ29tbWVudHM6IG9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzID8gJ25vbmUnIDogJ2VvZicsXG4gICAgbG9nTGV2ZWw6IG9wdGlvbnMudmVyYm9zZSA/ICdkZWJ1ZycgOiAnc2lsZW50JyxcbiAgICBtaW5pZnlJZGVudGlmaWVyczogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzICYmIGFsbG93TWFuZ2xlLFxuICAgIG1pbmlmeVN5bnRheDogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzLFxuICAgIG1pbmlmeVdoaXRlc3BhY2U6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBwdXJlOiBbJ2ZvcndhcmRSZWYnXSxcbiAgICBvdXRkaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgb3V0RXh0ZW5zaW9uOiBvdXRFeHRlbnNpb24gPyB7ICcuanMnOiBgLiR7b3V0RXh0ZW5zaW9ufWAgfSA6IHVuZGVmaW5lZCxcbiAgICBzb3VyY2VtYXA6IHNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyAmJiAoc291cmNlbWFwT3B0aW9ucy5oaWRkZW4gPyAnZXh0ZXJuYWwnIDogdHJ1ZSksXG4gICAgc3BsaXR0aW5nOiB0cnVlLFxuICAgIGNodW5rTmFtZXM6ICdjaHVuay1baGFzaF0nLFxuICAgIHRzY29uZmlnLFxuICAgIGV4dGVybmFsOiBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICB3cml0ZTogZmFsc2UsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBkZWZpbmU6IHtcbiAgICAgIC8vIE9ubHkgc2V0IHRvIGZhbHNlIHdoZW4gc2NyaXB0IG9wdGltaXphdGlvbnMgYXJlIGVuYWJsZWQuIEl0IHNob3VsZCBub3QgYmUgc2V0IHRvIHRydWUgYmVjYXVzZVxuICAgICAgLy8gQW5ndWxhciB0dXJucyBgbmdEZXZNb2RlYCBpbnRvIGFuIG9iamVjdCBmb3IgZGV2ZWxvcG1lbnQgZGVidWdnaW5nIHB1cnBvc2VzIHdoZW4gbm90IGRlZmluZWRcbiAgICAgIC8vIHdoaWNoIGEgY29uc3RhbnQgdHJ1ZSB2YWx1ZSB3b3VsZCBicmVhay5cbiAgICAgIC4uLihvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgPyB7ICduZ0Rldk1vZGUnOiAnZmFsc2UnIH0gOiB1bmRlZmluZWQpLFxuICAgICAgJ25nSml0TW9kZSc6IGppdCA/ICd0cnVlJyA6ICdmYWxzZScsXG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==