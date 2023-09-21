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
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
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
    if (options.externalPackages) {
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
            if (options.prerenderOptions?.discoverRoutes) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24tY29kZS1idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2FwcGxpY2F0aW9uLWNvZGUtYnVuZGxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDhEQUFpQztBQUNqQywrQ0FBNEM7QUFDNUMseUNBQTJDO0FBRTNDLHlFQUE4RDtBQUM5RCwrREFBa0Y7QUFDbEYsdUVBQXdFO0FBQ3hFLDZFQUE2RTtBQUM3RSwrRUFBZ0Y7QUFDaEYsbUNBQTRDO0FBQzVDLG1FQUFvRTtBQUVwRSxTQUFnQiw4QkFBOEIsQ0FDNUMsT0FBMEMsRUFDMUMsTUFBZ0IsRUFDaEIsZUFBaUM7SUFFakMsTUFBTSxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLEdBQUcsRUFBRSxHQUFHLE9BQU8sQ0FBQztJQUVqRSxNQUFNLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxHQUFHLElBQUEscURBQTJCLEVBQ2pFLE9BQU8sRUFDUCxNQUFNLEVBQ04sZUFBZSxDQUNoQixDQUFDO0lBRUYsTUFBTSxZQUFZLEdBQWlCO1FBQ2pDLEdBQUcsdUJBQXVCLENBQUMsT0FBTyxDQUFDO1FBQ25DLFFBQVEsRUFBRSxTQUFTO1FBQ25CLHlFQUF5RTtRQUN6RSwwRUFBMEU7UUFDMUUseUNBQXlDO1FBQ3pDLHFFQUFxRTtRQUNyRSxVQUFVLEVBQUUsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDO1FBQzdELFVBQVUsRUFBRSxXQUFXLENBQUMsT0FBTztRQUMvQixXQUFXO1FBQ1gsTUFBTTtRQUNOLFNBQVMsRUFBRSxJQUFBLHlCQUFpQixFQUFDLE1BQU0sQ0FBQztRQUNwQyxPQUFPLEVBQUU7WUFDUCxJQUFB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LENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUNwRixTQUFTLEVBQUUsSUFBSTtRQUNmLFVBQVUsRUFBRSxjQUFjO1FBQzFCLFFBQVE7UUFDUixRQUFRLEVBQUUsb0JBQW9CO1FBQzlCLEtBQUssRUFBRSxLQUFLO1FBQ1osZ0JBQWdCO1FBQ2hCLE1BQU0sRUFBRTtZQUNOLGdHQUFnRztZQUNoRywrRkFBK0Y7WUFDL0YsMkNBQTJDO1lBQzNDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDdkUsV0FBVyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPO1NBQ3BDO0tBQ0YsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZE9wdGlvbnMgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IGpvaW4sIHJlbGF0aXZlIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB0eXBlIHsgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zIH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYXBwbGljYXRpb24vb3B0aW9ucyc7XG5pbXBvcnQgeyBhbGxvd01hbmdsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlLCBjcmVhdGVDb21waWxlclBsdWdpbiB9IGZyb20gJy4vYW5ndWxhci9jb21waWxlci1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlQ29tcGlsZXJQbHVnaW5PcHRpb25zIH0gZnJvbSAnLi9jb21waWxlci1wbHVnaW4tb3B0aW9ucyc7XG5pbXBvcnQgeyBjcmVhdGVSeGpzRXNtUmVzb2x1dGlvblBsdWdpbiB9IGZyb20gJy4vcnhqcy1lc20tcmVzb2x1dGlvbi1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlU291cmNlbWFwSWdub3JlbGlzdFBsdWdpbiB9IGZyb20gJy4vc291cmNlbWFwLWlnbm9yZWxpc3QtcGx1Z2luJztcbmltcG9ydCB7IGdldEZlYXR1cmVTdXBwb3J0IH0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQgeyBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luIH0gZnJvbSAnLi92aXJ0dWFsLW1vZHVsZS1wbHVnaW4nO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQnJvd3NlckNvZGVCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZSxcbik6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHsgd29ya3NwYWNlUm9vdCwgZW50cnlQb2ludHMsIG91dHB1dE5hbWVzLCBqaXQgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgeyBwbHVnaW5PcHRpb25zLCBzdHlsZU9wdGlvbnMgfSA9IGNyZWF0ZUNvbXBpbGVyUGx1Z2luT3B0aW9ucyhcbiAgICBvcHRpb25zLFxuICAgIHRhcmdldCxcbiAgICBzb3VyY2VGaWxlQ2FjaGUsXG4gICk7XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zOiBCdWlsZE9wdGlvbnMgPSB7XG4gICAgLi4uZ2V0RXNCdWlsZENvbW1vbk9wdGlvbnMob3B0aW9ucyksXG4gICAgcGxhdGZvcm06ICdicm93c2VyJyxcbiAgICAvLyBOb3RlOiBgZXMyMDE1YCBpcyBuZWVkZWQgZm9yIFJ4SlMgdjYuIElmIG5vdCBzcGVjaWZpZWQsIGBtb2R1bGVgIHdvdWxkXG4gICAgLy8gbWF0Y2ggYW5kIHRoZSBFUzUgZGlzdHJpYnV0aW9uIHdvdWxkIGJlIGJ1bmRsZWQgYW5kIGVuZHMgdXAgYnJlYWtpbmcgYXRcbiAgICAvLyBydW50aW1lIHdpdGggdGhlIFJ4SlMgdGVzdGluZyBsaWJyYXJ5LlxuICAgIC8vIE1vcmUgZGV0YWlsczogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzI1NDA1LlxuICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgZW50cnlOYW1lczogb3V0cHV0TmFtZXMuYnVuZGxlcyxcbiAgICBlbnRyeVBvaW50cyxcbiAgICB0YXJnZXQsXG4gICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNvdXJjZW1hcElnbm9yZWxpc3RQbHVnaW4oKSxcbiAgICAgIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICAgICAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgICAgIHBsdWdpbk9wdGlvbnMsXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgKSxcbiAgICBdLFxuICB9O1xuXG4gIGlmIChvcHRpb25zLmV4dGVybmFsUGFja2FnZXMpIHtcbiAgICBidWlsZE9wdGlvbnMucGFja2FnZXMgPSAnZXh0ZXJuYWwnO1xuICB9XG5cbiAgY29uc3QgcG9seWZpbGxzID0gb3B0aW9ucy5wb2x5ZmlsbHMgPyBbLi4ub3B0aW9ucy5wb2x5ZmlsbHNdIDogW107XG4gIGlmIChqaXQpIHtcbiAgICBwb2x5ZmlsbHMucHVzaCgnQGFuZ3VsYXIvY29tcGlsZXInKTtcbiAgfVxuXG4gIGlmIChwb2x5ZmlsbHM/Lmxlbmd0aCkge1xuICAgIGNvbnN0IG5hbWVzcGFjZSA9ICdhbmd1bGFyOnBvbHlmaWxscyc7XG4gICAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0ge1xuICAgICAgLi4uYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzLFxuICAgICAgJ3BvbHlmaWxscyc6IG5hbWVzcGFjZSxcbiAgICB9O1xuXG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnM/LnVuc2hpZnQoXG4gICAgICBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luKHtcbiAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICBsb2FkQ29udGVudDogKCkgPT4gKHtcbiAgICAgICAgICBjb250ZW50czogcG9seWZpbGxzLm1hcCgoZmlsZSkgPT4gYGltcG9ydCAnJHtmaWxlLnJlcGxhY2UoL1xcXFwvZywgJy8nKX0nO2ApLmpvaW4oJ1xcbicpLFxuICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICB9KSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gYnVpbGRPcHRpb25zO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhbiBlc2J1aWxkICdidWlsZCcgb3B0aW9ucyBvYmplY3QgZm9yIHRoZSBzZXJ2ZXIgYnVuZGxlLlxuICogQHBhcmFtIG9wdGlvbnMgVGhlIGJ1aWxkZXIncyB1c2VyLXByb3ZpZGVyIG5vcm1hbGl6ZWQgb3B0aW9ucy5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgQnVpbGRPcHRpb25zIG9iamVjdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNlcnZlckNvZGVCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIHNvdXJjZUZpbGVDYWNoZTogU291cmNlRmlsZUNhY2hlLFxuKTogQnVpbGRPcHRpb25zIHtcbiAgY29uc3QgeyBqaXQsIHNlcnZlckVudHJ5UG9pbnQsIHdvcmtzcGFjZVJvb3QsIHNzck9wdGlvbnMgfSA9IG9wdGlvbnM7XG5cbiAgYXNzZXJ0KFxuICAgIHNlcnZlckVudHJ5UG9pbnQsXG4gICAgJ2NyZWF0ZVNlcnZlckNvZGVCdW5kbGVPcHRpb25zIHNob3VsZCBub3QgYmUgY2FsbGVkIHdpdGhvdXQgYSBkZWZpbmVkIHNlcnZlckVudHJ5UG9pbnQuJyxcbiAgKTtcblxuICBjb25zdCB7IHBsdWdpbk9wdGlvbnMsIHN0eWxlT3B0aW9ucyB9ID0gY3JlYXRlQ29tcGlsZXJQbHVnaW5PcHRpb25zKFxuICAgIG9wdGlvbnMsXG4gICAgdGFyZ2V0LFxuICAgIHNvdXJjZUZpbGVDYWNoZSxcbiAgKTtcblxuICBjb25zdCBtYWluU2VydmVyTmFtZXNwYWNlID0gJ2FuZ3VsYXI6bWFpbi1zZXJ2ZXInO1xuICBjb25zdCBzc3JFbnRyeU5hbWVzcGFjZSA9ICdhbmd1bGFyOnNzci1lbnRyeSc7XG5cbiAgY29uc3QgZW50cnlQb2ludHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgJ21haW4uc2VydmVyJzogbWFpblNlcnZlck5hbWVzcGFjZSxcbiAgfTtcblxuICBjb25zdCBzc3JFbnRyeVBvaW50ID0gc3NyT3B0aW9ucz8uZW50cnk7XG4gIGlmIChzc3JFbnRyeVBvaW50KSB7XG4gICAgZW50cnlQb2ludHNbJ3NlcnZlciddID0gc3NyRW50cnlOYW1lc3BhY2U7XG4gIH1cblxuICBjb25zdCBidWlsZE9wdGlvbnM6IEJ1aWxkT3B0aW9ucyA9IHtcbiAgICAuLi5nZXRFc0J1aWxkQ29tbW9uT3B0aW9ucyhvcHRpb25zKSxcbiAgICBwbGF0Zm9ybTogJ25vZGUnLFxuICAgIC8vIFRPRE86IEludmVzaWdhdGUgd2h5IGVuYWJsaW5nIGBzcGxpdHRpbmdgIGluIEpJVCBtb2RlIGNhdXNlcyBhbiBcIidAYW5ndWxhci9jb21waWxlcicgaXMgbm90IGF2YWlsYWJsZVwiIGVycm9yLlxuICAgIHNwbGl0dGluZzogIWppdCxcbiAgICBvdXRFeHRlbnNpb246IHsgJy5qcyc6ICcubWpzJyB9LFxuICAgIC8vIE5vdGU6IGBlczIwMTVgIGlzIG5lZWRlZCBmb3IgUnhKUyB2Ni4gSWYgbm90IHNwZWNpZmllZCwgYG1vZHVsZWAgd291bGRcbiAgICAvLyBtYXRjaCBhbmQgdGhlIEVTNSBkaXN0cmlidXRpb24gd291bGQgYmUgYnVuZGxlZCBhbmQgZW5kcyB1cCBicmVha2luZyBhdFxuICAgIC8vIHJ1bnRpbWUgd2l0aCB0aGUgUnhKUyB0ZXN0aW5nIGxpYnJhcnkuXG4gICAgLy8gTW9yZSBkZXRhaWxzOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMjU0MDUuXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnZXMyMDE1JywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgZW50cnlOYW1lczogJ1tuYW1lXScsXG4gICAgdGFyZ2V0LFxuICAgIGJhbm5lcjoge1xuICAgICAgLy8gTm90ZTogTmVlZGVkIGFzIGVzYnVpbGQgZG9lcyBub3QgcHJvdmlkZSByZXF1aXJlIHNoaW1zIC8gcHJveHkgZnJvbSBFU01vZHVsZXMuXG4gICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9ldmFudy9lc2J1aWxkL2lzc3Vlcy8xOTIxLlxuICAgICAganM6IFtcbiAgICAgICAgYGltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdub2RlOm1vZHVsZSc7YCxcbiAgICAgICAgYGdsb2JhbFRoaXNbJ3JlcXVpcmUnXSA/Pz0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpO2AsXG4gICAgICBdLmpvaW4oJ1xcbicpLFxuICAgIH0sXG4gICAgZW50cnlQb2ludHMsXG4gICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNvdXJjZW1hcElnbm9yZWxpc3RQbHVnaW4oKSxcbiAgICAgIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICAgICAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgICAgIHsgLi4ucGx1Z2luT3B0aW9ucywgbm9vcFR5cGVTY3JpcHRDb21waWxhdGlvbjogdHJ1ZSB9LFxuICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzaGVldCBvcHRpb25zXG4gICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICksXG4gICAgXSxcbiAgfTtcblxuICBidWlsZE9wdGlvbnMucGx1Z2lucyA/Pz0gW107XG4gIGlmIChvcHRpb25zLmV4dGVybmFsUGFja2FnZXMpIHtcbiAgICBidWlsZE9wdGlvbnMucGFja2FnZXMgPSAnZXh0ZXJuYWwnO1xuICB9IGVsc2Uge1xuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goY3JlYXRlUnhqc0VzbVJlc29sdXRpb25QbHVnaW4oKSk7XG4gIH1cblxuICBjb25zdCBwb2x5ZmlsbHM6IHN0cmluZ1tdID0gW107XG4gIGlmIChvcHRpb25zLnBvbHlmaWxscz8uaW5jbHVkZXMoJ3pvbmUuanMnKSkge1xuICAgIHBvbHlmaWxscy5wdXNoKGBpbXBvcnQgJ3pvbmUuanMvbm9kZSc7YCk7XG4gIH1cblxuICBpZiAoaml0KSB7XG4gICAgcG9seWZpbGxzLnB1c2goYGltcG9ydCAnQGFuZ3VsYXIvY29tcGlsZXInO2ApO1xuICB9XG5cbiAgcG9seWZpbGxzLnB1c2goYGltcG9ydCAnQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyL2luaXQnO2ApO1xuXG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnB1c2goXG4gICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICBuYW1lc3BhY2U6IG1haW5TZXJ2ZXJOYW1lc3BhY2UsXG4gICAgICBsb2FkQ29udGVudDogYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBtYWluU2VydmVyRW50cnlQb2ludCA9IHJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIHNlcnZlckVudHJ5UG9pbnQpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcblxuICAgICAgICBjb25zdCBjb250ZW50cyA9IFtcbiAgICAgICAgICAuLi5wb2x5ZmlsbHMsXG4gICAgICAgICAgYGltcG9ydCBtb2R1bGVPckJvb3RzdHJhcEZuIGZyb20gJy4vJHttYWluU2VydmVyRW50cnlQb2ludH0nO2AsXG4gICAgICAgICAgYGV4cG9ydCBkZWZhdWx0IG1vZHVsZU9yQm9vdHN0cmFwRm47YCxcbiAgICAgICAgICBgZXhwb3J0ICogZnJvbSAnLi8ke21haW5TZXJ2ZXJFbnRyeVBvaW50fSc7YCxcbiAgICAgICAgICBgZXhwb3J0IHsgcmVuZGVyQXBwbGljYXRpb24sIHJlbmRlck1vZHVsZSwgybVTRVJWRVJfQ09OVEVYVCB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcic7YCxcbiAgICAgICAgXTtcblxuICAgICAgICBpZiAob3B0aW9ucy5wcmVyZW5kZXJPcHRpb25zPy5kaXNjb3ZlclJvdXRlcykge1xuICAgICAgICAgIC8vIFdlIGRvIG5vdCBpbXBvcnQgaXQgZGlyZWN0bHkgc28gdGhhdCBub2RlLmpzIG1vZHVsZXMgYXJlIHJlc29sdmVkIHVzaW5nIHRoZSBjb3JyZWN0IGNvbnRleHQuXG4gICAgICAgICAgY29uc3Qgcm91dGVzRXh0cmFjdG9yQ29kZSA9IGF3YWl0IHJlYWRGaWxlKFxuICAgICAgICAgICAgam9pbihfX2Rpcm5hbWUsICcuLi8uLi91dGlscy9yb3V0ZXMtZXh0cmFjdG9yL2V4dHJhY3Rvci5qcycpLFxuICAgICAgICAgICAgJ3V0Zi04JyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgLy8gUmVtb3ZlIHNvdXJjZSBtYXAgVVJMIGNvbW1lbnRzIGZyb20gdGhlIGNvZGUgaWYgYSBzb3VyY2VtYXAgaXMgcHJlc2VudCBhcyB0aGlzIHdpbGwgbm90IG1hdGNoIHRoZSBmaWxlLlxuICAgICAgICAgIGNvbnRlbnRzLnB1c2gocm91dGVzRXh0cmFjdG9yQ29kZS5yZXBsYWNlKC9eXFwvXFwvIyBzb3VyY2VNYXBwaW5nVVJMPVteXFxyXFxuXSovZ20sICcnKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbnRlbnRzOiBjb250ZW50cy5qb2luKCdcXG4nKSxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgfSksXG4gICk7XG5cbiAgaWYgKHNzckVudHJ5UG9pbnQpIHtcbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucy5wdXNoKFxuICAgICAgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbih7XG4gICAgICAgIG5hbWVzcGFjZTogc3NyRW50cnlOYW1lc3BhY2UsXG4gICAgICAgIGxvYWRDb250ZW50OiAoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgc2VydmVyRW50cnlQb2ludCA9IHJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIHNzckVudHJ5UG9pbnQpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb250ZW50czogW1xuICAgICAgICAgICAgICAuLi5wb2x5ZmlsbHMsXG4gICAgICAgICAgICAgIGBpbXBvcnQgJy4vJHtzZXJ2ZXJFbnRyeVBvaW50fSc7YCxcbiAgICAgICAgICAgICAgYGV4cG9ydCAqIGZyb20gJy4vJHtzZXJ2ZXJFbnRyeVBvaW50fSc7YCxcbiAgICAgICAgICAgIF0uam9pbignXFxuJyksXG4gICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cblxuZnVuY3Rpb24gZ2V0RXNCdWlsZENvbW1vbk9wdGlvbnMob3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zKTogQnVpbGRPcHRpb25zIHtcbiAgY29uc3Qge1xuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgb3V0RXh0ZW5zaW9uLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB0c2NvbmZpZyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIGppdCxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgcmV0dXJuIHtcbiAgICBhYnNXb3JraW5nRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICBmb3JtYXQ6ICdlc20nLFxuICAgIGFzc2V0TmFtZXM6IG91dHB1dE5hbWVzLm1lZGlhLFxuICAgIGNvbmRpdGlvbnM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdtb2R1bGUnXSxcbiAgICByZXNvbHZlRXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgIGxlZ2FsQ29tbWVudHM6IG9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzID8gJ25vbmUnIDogJ2VvZicsXG4gICAgbG9nTGV2ZWw6IG9wdGlvbnMudmVyYm9zZSA/ICdkZWJ1ZycgOiAnc2lsZW50JyxcbiAgICBtaW5pZnlJZGVudGlmaWVyczogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzICYmIGFsbG93TWFuZ2xlLFxuICAgIG1pbmlmeVN5bnRheDogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzLFxuICAgIG1pbmlmeVdoaXRlc3BhY2U6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBwdXJlOiBbJ2ZvcndhcmRSZWYnXSxcbiAgICBvdXRkaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgb3V0RXh0ZW5zaW9uOiBvdXRFeHRlbnNpb24gPyB7ICcuanMnOiBgLiR7b3V0RXh0ZW5zaW9ufWAgfSA6IHVuZGVmaW5lZCxcbiAgICBzb3VyY2VtYXA6IHNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyAmJiAoc291cmNlbWFwT3B0aW9ucy5oaWRkZW4gPyAnZXh0ZXJuYWwnIDogdHJ1ZSksXG4gICAgc3BsaXR0aW5nOiB0cnVlLFxuICAgIGNodW5rTmFtZXM6ICdjaHVuay1baGFzaF0nLFxuICAgIHRzY29uZmlnLFxuICAgIGV4dGVybmFsOiBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICB3cml0ZTogZmFsc2UsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBkZWZpbmU6IHtcbiAgICAgIC8vIE9ubHkgc2V0IHRvIGZhbHNlIHdoZW4gc2NyaXB0IG9wdGltaXphdGlvbnMgYXJlIGVuYWJsZWQuIEl0IHNob3VsZCBub3QgYmUgc2V0IHRvIHRydWUgYmVjYXVzZVxuICAgICAgLy8gQW5ndWxhciB0dXJucyBgbmdEZXZNb2RlYCBpbnRvIGFuIG9iamVjdCBmb3IgZGV2ZWxvcG1lbnQgZGVidWdnaW5nIHB1cnBvc2VzIHdoZW4gbm90IGRlZmluZWRcbiAgICAgIC8vIHdoaWNoIGEgY29uc3RhbnQgdHJ1ZSB2YWx1ZSB3b3VsZCBicmVhay5cbiAgICAgIC4uLihvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgPyB7ICduZ0Rldk1vZGUnOiAnZmFsc2UnIH0gOiB1bmRlZmluZWQpLFxuICAgICAgJ25nSml0TW9kZSc6IGppdCA/ICd0cnVlJyA6ICdmYWxzZScsXG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==