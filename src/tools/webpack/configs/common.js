"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCommonConfig = void 0;
const webpack_1 = require("@ngtools/webpack");
const copy_webpack_plugin_1 = __importDefault(require("copy-webpack-plugin"));
const path = __importStar(require("path"));
const webpack_2 = require("webpack");
const webpack_subresource_integrity_1 = require("webpack-subresource-integrity");
const environment_options_1 = require("../../../utils/environment-options");
const load_esm_1 = require("../../../utils/load-esm");
const plugins_1 = require("../plugins");
const devtools_ignore_plugin_1 = require("../plugins/devtools-ignore-plugin");
const named_chunks_plugin_1 = require("../plugins/named-chunks-plugin");
const occurrences_plugin_1 = require("../plugins/occurrences-plugin");
const progress_plugin_1 = require("../plugins/progress-plugin");
const transfer_size_plugin_1 = require("../plugins/transfer-size-plugin");
const typescript_1 = require("../plugins/typescript");
const watch_files_logs_plugin_1 = require("../plugins/watch-files-logs-plugin");
const helpers_1 = require("../utils/helpers");
const VENDORS_TEST = /[\\/]node_modules[\\/]/;
// eslint-disable-next-line max-lines-per-function
async function getCommonConfig(wco) {
    const { root, projectRoot, buildOptions, tsConfig, projectName, sourceRoot, tsConfigPath } = wco;
    const { cache, codeCoverage, crossOrigin = 'none', platform = 'browser', aot = true, codeCoverageExclude = [], main, sourceMap: { styles: stylesSourceMap, scripts: scriptsSourceMap, vendor: vendorSourceMap, hidden: hiddenSourceMap, }, optimization: { styles: stylesOptimization, scripts: scriptsOptimization }, commonChunk, vendorChunk, subresourceIntegrity, verbose, poll, webWorkerTsConfig, externalDependencies = [], allowedCommonJsDependencies, } = buildOptions;
    const isPlatformServer = buildOptions.platform === 'server';
    const extraPlugins = [];
    const extraRules = [];
    const entryPoints = {};
    // Load ESM `@angular/compiler-cli` using the TypeScript dynamic import workaround.
    // Once TypeScript provides support for keeping the dynamic import this workaround can be
    // changed to a direct dynamic import.
    const { GLOBAL_DEFS_FOR_TERSER, GLOBAL_DEFS_FOR_TERSER_WITH_AOT, VERSION: NG_VERSION, } = await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli');
    // determine hashing format
    const hashFormat = (0, helpers_1.getOutputHashFormat)(buildOptions.outputHashing);
    if (buildOptions.progress) {
        extraPlugins.push(new progress_plugin_1.ProgressPlugin(platform));
    }
    const localizePackageInitEntryPoint = '@angular/localize/init';
    const hasLocalizeType = tsConfig.options.types?.some((t) => t === '@angular/localize' || t === localizePackageInitEntryPoint);
    if (hasLocalizeType) {
        entryPoints['main'] = [localizePackageInitEntryPoint];
    }
    if (buildOptions.main) {
        const mainPath = path.resolve(root, buildOptions.main);
        if (Array.isArray(entryPoints['main'])) {
            entryPoints['main'].push(mainPath);
        }
        else {
            entryPoints['main'] = [mainPath];
        }
    }
    if (isPlatformServer) {
        // Fixes Critical dependency: the request of a dependency is an expression
        extraPlugins.push(new webpack_2.ContextReplacementPlugin(/@?hapi|express[\\/]/));
        if ((0, helpers_1.isPlatformServerInstalled)(wco.root) && Array.isArray(entryPoints['main'])) {
            // This import must come before any imports (direct or transitive) that rely on DOM built-ins being
            // available, such as `@angular/elements`.
            entryPoints['main'].unshift('@angular/platform-server/init');
        }
    }
    const polyfills = [...buildOptions.polyfills];
    if (!aot) {
        polyfills.push('@angular/compiler');
    }
    if (polyfills.length) {
        // `zone.js/testing` is a **special** polyfill because when not imported in the main it fails with the below errors:
        // `Error: Expected to be running in 'ProxyZone', but it was not found.`
        // This was also the reason why previously it was imported in `test.ts` as the first module.
        // From Jia li:
        // This is because the jasmine functions such as beforeEach/it will not be patched by zone.js since
        // jasmine will not be loaded yet, so the ProxyZone will not be there. We have to load zone-testing.js after
        // jasmine is ready.
        // We could force loading 'zone.js/testing' prior to jasmine by changing the order of scripts in 'karma-context.html'.
        // But this has it's own problems as zone.js needs to be loaded prior to jasmine due to patching of timing functions
        // See: https://github.com/jasmine/jasmine/issues/1944
        // Thus the correct order is zone.js -> jasmine -> zone.js/testing.
        const zoneTestingEntryPoint = 'zone.js/testing';
        const polyfillsExludingZoneTesting = polyfills.filter((p) => p !== zoneTestingEntryPoint);
        if (Array.isArray(entryPoints['polyfills'])) {
            entryPoints['polyfills'].push(...polyfillsExludingZoneTesting);
        }
        else {
            entryPoints['polyfills'] = polyfillsExludingZoneTesting;
        }
        if (polyfillsExludingZoneTesting.length !== polyfills.length) {
            if (Array.isArray(entryPoints['main'])) {
                entryPoints['main'].unshift(zoneTestingEntryPoint);
            }
            else {
                entryPoints['main'] = [zoneTestingEntryPoint];
            }
        }
    }
    if (allowedCommonJsDependencies) {
        // When this is not defined it means the builder doesn't support showing common js usages.
        // When it does it will be an array.
        extraPlugins.push(new plugins_1.CommonJsUsageWarnPlugin({
            allowedDependencies: allowedCommonJsDependencies,
        }));
    }
    // process global scripts
    // Add a new asset for each entry.
    for (const { bundleName, inject, paths } of (0, helpers_1.globalScriptsByBundleName)(buildOptions.scripts)) {
        // Lazy scripts don't get a hash, otherwise they can't be loaded by name.
        const hash = inject ? hashFormat.script : '';
        extraPlugins.push(new plugins_1.ScriptsWebpackPlugin({
            name: bundleName,
            sourceMap: scriptsSourceMap,
            scripts: paths,
            filename: `${path.basename(bundleName)}${hash}.js`,
            basePath: root,
        }));
    }
    // process asset entries
    if (buildOptions.assets.length) {
        extraPlugins.push(new copy_webpack_plugin_1.default({
            patterns: (0, helpers_1.assetPatterns)(root, buildOptions.assets),
        }));
    }
    if (buildOptions.extractLicenses) {
        const LicenseWebpackPlugin = require('license-webpack-plugin').LicenseWebpackPlugin;
        extraPlugins.push(new LicenseWebpackPlugin({
            stats: {
                warnings: false,
                errors: false,
            },
            perChunkOutput: false,
            outputFilename: '3rdpartylicenses.txt',
            skipChildCompilers: true,
        }));
    }
    if (scriptsSourceMap || stylesSourceMap) {
        const include = [];
        if (scriptsSourceMap) {
            include.push(/js$/);
        }
        if (stylesSourceMap) {
            include.push(/css$/);
        }
        extraPlugins.push(new devtools_ignore_plugin_1.DevToolsIgnorePlugin());
        extraPlugins.push(new webpack_2.SourceMapDevToolPlugin({
            filename: '[file].map',
            include,
            // We want to set sourceRoot to  `webpack:///` for non
            // inline sourcemaps as otherwise paths to sourcemaps will be broken in browser
            // `webpack:///` is needed for Visual Studio breakpoints to work properly as currently
            // there is no way to set the 'webRoot'
            sourceRoot: 'webpack:///',
            moduleFilenameTemplate: '[resource-path]',
            append: hiddenSourceMap ? false : undefined,
        }));
    }
    if (verbose) {
        extraPlugins.push(new watch_files_logs_plugin_1.WatchFilesLogsPlugin());
    }
    if (buildOptions.statsJson) {
        extraPlugins.push(new plugins_1.JsonStatsPlugin(path.resolve(root, buildOptions.outputPath, 'stats.json')));
    }
    if (subresourceIntegrity) {
        extraPlugins.push(new webpack_subresource_integrity_1.SubresourceIntegrityPlugin({
            hashFuncNames: ['sha384'],
        }));
    }
    if (scriptsSourceMap || stylesSourceMap) {
        extraRules.push({
            test: /\.[cm]?jsx?$/,
            enforce: 'pre',
            loader: require.resolve('source-map-loader'),
            options: {
                filterSourceMappingUrl: (_mapUri, resourcePath) => {
                    if (vendorSourceMap) {
                        // Consume all sourcemaps when vendor option is enabled.
                        return true;
                    }
                    // Don't consume sourcemaps in node_modules when vendor is disabled.
                    // But, do consume local libraries sourcemaps.
                    return !resourcePath.includes('node_modules');
                },
            },
        });
    }
    if (main || polyfills) {
        extraRules.push({
            test: tsConfig.options.allowJs ? /\.[cm]?[tj]sx?$/ : /\.[cm]?tsx?$/,
            loader: webpack_1.AngularWebpackLoaderPath,
            // The below are known paths that are not part of the TypeScript compilation even when allowJs is enabled.
            exclude: [
                /[\\/]node_modules[/\\](?:css-loader|mini-css-extract-plugin|webpack-dev-server|webpack)[/\\]/,
            ],
        });
        extraPlugins.push((0, typescript_1.createIvyPlugin)(wco, aot, tsConfigPath));
    }
    if (webWorkerTsConfig) {
        extraPlugins.push((0, typescript_1.createIvyPlugin)(wco, false, path.resolve(wco.root, webWorkerTsConfig)));
    }
    const extraMinimizers = [];
    if (scriptsOptimization) {
        extraMinimizers.push(new plugins_1.JavaScriptOptimizerPlugin({
            define: buildOptions.aot ? GLOBAL_DEFS_FOR_TERSER_WITH_AOT : GLOBAL_DEFS_FOR_TERSER,
            sourcemap: scriptsSourceMap,
            supportedBrowsers: buildOptions.supportedBrowsers,
            keepIdentifierNames: !environment_options_1.allowMangle || isPlatformServer,
            keepNames: isPlatformServer,
            removeLicenses: buildOptions.extractLicenses,
            advanced: buildOptions.buildOptimizer,
        }));
    }
    if (platform === 'browser' && (scriptsOptimization || stylesOptimization.minify)) {
        extraMinimizers.push(new transfer_size_plugin_1.TransferSizePlugin());
    }
    let crossOriginLoading = false;
    if (subresourceIntegrity && crossOrigin === 'none') {
        crossOriginLoading = 'anonymous';
    }
    else if (crossOrigin !== 'none') {
        crossOriginLoading = crossOrigin;
    }
    return {
        mode: scriptsOptimization || stylesOptimization.minify ? 'production' : 'development',
        devtool: false,
        target: [isPlatformServer ? 'node' : 'web', 'es2015'],
        profile: buildOptions.statsJson,
        resolve: {
            roots: [projectRoot],
            extensions: ['.ts', '.tsx', '.mjs', '.js'],
            symlinks: !buildOptions.preserveSymlinks,
            modules: [tsConfig.options.baseUrl || projectRoot, 'node_modules'],
            mainFields: isPlatformServer
                ? ['es2020', 'es2015', 'module', 'main']
                : ['es2020', 'es2015', 'browser', 'module', 'main'],
            conditionNames: ['es2020', 'es2015', '...'],
        },
        resolveLoader: {
            symlinks: !buildOptions.preserveSymlinks,
        },
        context: root,
        entry: entryPoints,
        externals: externalDependencies,
        output: {
            uniqueName: projectName,
            hashFunction: 'xxhash64',
            clean: buildOptions.deleteOutputPath ?? true,
            path: path.resolve(root, buildOptions.outputPath),
            publicPath: buildOptions.deployUrl ?? '',
            filename: `[name]${hashFormat.chunk}.js`,
            chunkFilename: `[name]${hashFormat.chunk}.js`,
            libraryTarget: isPlatformServer ? 'commonjs' : undefined,
            crossOriginLoading,
            trustedTypes: 'angular#bundler',
            scriptType: 'module',
        },
        watch: buildOptions.watch,
        watchOptions: {
            poll,
            // The below is needed as when preserveSymlinks is enabled we disable `resolve.symlinks`.
            followSymlinks: buildOptions.preserveSymlinks,
            ignored: poll === undefined ? undefined : '**/node_modules/**',
        },
        snapshot: {
            module: {
                // Use hash of content instead of timestamp because the timestamp of the symlink will be used
                // instead of the referenced files which causes changes in symlinks not to be picked up.
                hash: buildOptions.preserveSymlinks,
            },
        },
        performance: {
            hints: false,
        },
        ignoreWarnings: [
            // https://github.com/webpack-contrib/source-map-loader/blob/b2de4249c7431dd8432da607e08f0f65e9d64219/src/index.js#L83
            /Failed to parse source map from/,
            // https://github.com/webpack-contrib/postcss-loader/blob/bd261875fdf9c596af4ffb3a1a73fe3c549befda/src/index.js#L153-L158
            /Add postcss as project dependency/,
            // esbuild will issue a warning, while still hoists the @charset at the very top.
            // This is caused by a bug in css-loader https://github.com/webpack-contrib/css-loader/issues/1212
            /"@charset" must be the first rule in the file/,
        ],
        module: {
            // Show an error for missing exports instead of a warning.
            strictExportPresence: true,
            parser: {
                javascript: {
                    requireContext: false,
                    // Disable auto URL asset module creation. This doesn't effect `new Worker(new URL(...))`
                    // https://webpack.js.org/guides/asset-modules/#url-assets
                    url: false,
                    worker: !!webWorkerTsConfig,
                },
            },
            rules: [
                {
                    test: /\.?(svg|html)$/,
                    // Only process HTML and SVG which are known Angular component resources.
                    resourceQuery: /\?ngResource/,
                    type: 'asset/source',
                },
                {
                    // Mark files inside `rxjs/add` as containing side effects.
                    // If this is fixed upstream and the fixed version becomes the minimum
                    // supported version, this can be removed.
                    test: /[/\\]rxjs[/\\]add[/\\].+\.js$/,
                    sideEffects: true,
                },
                {
                    test: /\.[cm]?[tj]sx?$/,
                    // The below is needed due to a bug in `@babel/runtime`. See: https://github.com/babel/babel/issues/12824
                    resolve: { fullySpecified: false },
                    exclude: [
                        /[\\/]node_modules[/\\](?:core-js|@babel|tslib|web-animations-js|web-streams-polyfill|whatwg-url)[/\\]/,
                    ],
                    use: [
                        {
                            loader: require.resolve('../../babel/webpack-loader'),
                            options: {
                                cacheDirectory: (cache.enabled && path.join(cache.path, 'babel-webpack')) || false,
                                aot: buildOptions.aot,
                                optimize: buildOptions.buildOptimizer,
                                supportedBrowsers: buildOptions.supportedBrowsers,
                                instrumentCode: codeCoverage
                                    ? {
                                        includedBasePath: sourceRoot ?? projectRoot,
                                        excludedPaths: (0, helpers_1.getInstrumentationExcludedPaths)(root, codeCoverageExclude),
                                    }
                                    : undefined,
                            },
                        },
                    ],
                },
                ...extraRules,
            ],
        },
        experiments: {
            backCompat: false,
            syncWebAssembly: true,
            asyncWebAssembly: true,
            topLevelAwait: false,
        },
        infrastructureLogging: {
            debug: verbose,
            level: verbose ? 'verbose' : 'error',
        },
        stats: (0, helpers_1.getStatsOptions)(verbose),
        cache: (0, helpers_1.getCacheSettings)(wco, NG_VERSION.full),
        optimization: {
            minimizer: extraMinimizers,
            moduleIds: 'deterministic',
            chunkIds: buildOptions.namedChunks ? 'named' : 'deterministic',
            emitOnErrors: false,
            runtimeChunk: isPlatformServer ? false : 'single',
            splitChunks: {
                maxAsyncRequests: Infinity,
                cacheGroups: {
                    default: !!commonChunk && {
                        chunks: 'async',
                        minChunks: 2,
                        priority: 10,
                    },
                    common: !!commonChunk && {
                        name: 'common',
                        chunks: 'async',
                        minChunks: 2,
                        enforce: true,
                        priority: 5,
                    },
                    vendors: false,
                    defaultVendors: !!vendorChunk && {
                        name: 'vendor',
                        chunks: (chunk) => chunk.name === 'main',
                        enforce: true,
                        test: VENDORS_TEST,
                    },
                },
            },
        },
        plugins: [
            new named_chunks_plugin_1.NamedChunksPlugin(),
            new occurrences_plugin_1.OccurrencesPlugin({
                aot,
                scriptsOptimization,
            }),
            new plugins_1.DedupeModuleResolvePlugin({ verbose }),
            ...extraPlugins,
        ],
        node: false,
    };
}
exports.getCommonConfig = getCommonConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvd2VicGFjay9jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhDQUE0RDtBQUM1RCw4RUFBb0Q7QUFDcEQsMkNBQTZCO0FBQzdCLHFDQU1pQjtBQUNqQixpRkFBMkU7QUFFM0UsNEVBQWlFO0FBQ2pFLHNEQUF3RDtBQUV4RCx3Q0FNb0I7QUFDcEIsOEVBQXlFO0FBQ3pFLHdFQUFtRTtBQUNuRSxzRUFBa0U7QUFDbEUsZ0VBQTREO0FBQzVELDBFQUFxRTtBQUNyRSxzREFBd0Q7QUFDeEQsZ0ZBQTBFO0FBQzFFLDhDQVEwQjtBQUUxQixNQUFNLFlBQVksR0FBRyx3QkFBd0IsQ0FBQztBQUU5QyxrREFBa0Q7QUFDM0MsS0FBSyxVQUFVLGVBQWUsQ0FBQyxHQUF5QjtJQUM3RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ2pHLE1BQU0sRUFDSixLQUFLLEVBQ0wsWUFBWSxFQUNaLFdBQVcsR0FBRyxNQUFNLEVBQ3BCLFFBQVEsR0FBRyxTQUFTLEVBQ3BCLEdBQUcsR0FBRyxJQUFJLEVBQ1YsbUJBQW1CLEdBQUcsRUFBRSxFQUN4QixJQUFJLEVBQ0osU0FBUyxFQUFFLEVBQ1QsTUFBTSxFQUFFLGVBQWUsRUFDdkIsT0FBTyxFQUFFLGdCQUFnQixFQUN6QixNQUFNLEVBQUUsZUFBZSxFQUN2QixNQUFNLEVBQUUsZUFBZSxHQUN4QixFQUNELFlBQVksRUFBRSxFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxPQUFPLEVB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O2dCQUMxQixXQUFXLEVBQUU7b0JBQ1gsT0FBTyxFQUFFLENBQUMsQ0FBQyxXQUFXLElBQUk7d0JBQ3hCLE1BQU0sRUFBRSxPQUFPO3dCQUNmLFNBQVMsRUFBRSxDQUFDO3dCQUNaLFFBQVEsRUFBRSxFQUFFO3FCQUNiO29CQUNELE1BQU0sRUFBRSxDQUFDLENBQUMsV0FBVyxJQUFJO3dCQUN2QixJQUFJLEVBQUUsUUFBUTt3QkFDZCxNQUFNLEVBQUUsT0FBTzt3QkFDZixTQUFTLEVBQUUsQ0FBQzt3QkFDWixPQUFPLEVBQUUsSUFBSTt3QkFDYixRQUFRLEVBQUUsQ0FBQztxQkFDWjtvQkFDRCxPQUFPLEVBQUUsS0FBSztvQkFDZCxjQUFjLEVBQUUsQ0FBQyxDQUFDLFdBQVcsSUFBSTt3QkFDL0IsSUFBSSxFQUFFLFFBQVE7d0JBQ2QsTUFBTSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU07d0JBQ3hDLE9BQU8sRUFBRSxJQUFJO3dCQUNiLElBQUksRUFBRSxZQUFZO3FCQUNuQjtpQkFDRjthQUNGO1NBQ0Y7UUFDRCxPQUFPLEVBQUU7WUFDUCxJQUFJLHVDQUFpQixFQUFFO1lBQ3ZCLElBQUksc0NBQWlCLENBQUM7Z0JBQ3BCLEdBQUc7Z0JBQ0gsbUJBQW1CO2FBQ3BCLENBQUM7WUFDRixJQUFJLG1DQUF5QixDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUM7WUFDMUMsR0FBRyxZQUFZO1NBQ2hCO1FBQ0QsSUFBSSxFQUFFLEtBQUs7S0FDWixDQUFDO0FBQ0osQ0FBQztBQXRiRCwwQ0FzYkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQW5ndWxhcldlYnBhY2tMb2FkZXJQYXRoIH0gZnJvbSAnQG5ndG9vbHMvd2VicGFjayc7XG5pbXBvcnQgQ29weVdlYnBhY2tQbHVnaW4gZnJvbSAnY29weS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtcbiAgQ29tcGlsZXIsXG4gIENvbmZpZ3VyYXRpb24sXG4gIENvbnRleHRSZXBsYWNlbWVudFBsdWdpbixcbiAgUnVsZVNldFJ1bGUsXG4gIFNvdXJjZU1hcERldlRvb2xQbHVnaW4sXG59IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4gfSBmcm9tICd3ZWJwYWNrLXN1YnJlc291cmNlLWludGVncml0eSc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgYWxsb3dNYW5nbGUgfSBmcm9tICcuLi8uLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi8uLi8uLi91dGlscy9sb2FkLWVzbSc7XG5pbXBvcnQgeyBBbmd1bGFyQmFiZWxMb2FkZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInO1xuaW1wb3J0IHtcbiAgQ29tbW9uSnNVc2FnZVdhcm5QbHVnaW4sXG4gIERlZHVwZU1vZHVsZVJlc29sdmVQbHVnaW4sXG4gIEphdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW4sXG4gIEpzb25TdGF0c1BsdWdpbixcbiAgU2NyaXB0c1dlYnBhY2tQbHVnaW4sXG59IGZyb20gJy4uL3BsdWdpbnMnO1xuaW1wb3J0IHsgRGV2VG9vbHNJZ25vcmVQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL2RldnRvb2xzLWlnbm9yZS1wbHVnaW4nO1xuaW1wb3J0IHsgTmFtZWRDaHVua3NQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL25hbWVkLWNodW5rcy1wbHVnaW4nO1xuaW1wb3J0IHsgT2NjdXJyZW5jZXNQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL29jY3VycmVuY2VzLXBsdWdpbic7XG5pbXBvcnQgeyBQcm9ncmVzc1BsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvcHJvZ3Jlc3MtcGx1Z2luJztcbmltcG9ydCB7IFRyYW5zZmVyU2l6ZVBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvdHJhbnNmZXItc2l6ZS1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlSXZ5UGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy90eXBlc2NyaXB0JztcbmltcG9ydCB7IFdhdGNoRmlsZXNMb2dzUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy93YXRjaC1maWxlcy1sb2dzLXBsdWdpbic7XG5pbXBvcnQge1xuICBhc3NldFBhdHRlcm5zLFxuICBnZXRDYWNoZVNldHRpbmdzLFxuICBnZXRJbnN0cnVtZW50YXRpb25FeGNsdWRlZFBhdGhzLFxuICBnZXRPdXRwdXRIYXNoRm9ybWF0LFxuICBnZXRTdGF0c09wdGlvbnMsXG4gIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUsXG4gIGlzUGxhdGZvcm1TZXJ2ZXJJbnN0YWxsZWQsXG59IGZyb20gJy4uL3V0aWxzL2hlbHBlcnMnO1xuXG5jb25zdCBWRU5ET1JTX1RFU1QgPSAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vO1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldENvbW1vbkNvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKTogUHJvbWlzZTxDb25maWd1cmF0aW9uPiB7XG4gIGNvbnN0IHsgcm9vdCwgcHJvamVjdFJvb3QsIGJ1aWxkT3B0aW9ucywgdHNDb25maWcsIHByb2plY3ROYW1lLCBzb3VyY2VSb290LCB0c0NvbmZpZ1BhdGggfSA9IHdjbztcbiAgY29uc3Qge1xuICAgIGNhY2hlLFxuICAgIGNvZGVDb3ZlcmFnZSxcbiAgICBjcm9zc09yaWdpbiA9ICdub25lJyxcbiAgICBwbGF0Zm9ybSA9ICdicm93c2VyJyxcbiAgICBhb3QgPSB0cnVlLFxuICAgIGNvZGVDb3ZlcmFnZUV4Y2x1ZGUgPSBbXSxcbiAgICBtYWluLFxuICAgIHNvdXJjZU1hcDoge1xuICAgICAgc3R5bGVzOiBzdHlsZXNTb3VyY2VNYXAsXG4gICAgICBzY3JpcHRzOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgdmVuZG9yOiB2ZW5kb3JTb3VyY2VNYXAsXG4gICAgICBoaWRkZW46IGhpZGRlblNvdXJjZU1hcCxcbiAgICB9LFxuICAgIG9wdGltaXphdGlvbjogeyBzdHlsZXM6IHN0eWxlc09wdGltaXphdGlvbiwgc2NyaXB0czogc2NyaXB0c09wdGltaXphdGlvbiB9LFxuICAgIGNvbW1vbkNodW5rLFxuICAgIHZlbmRvckNodW5rLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIHZlcmJvc2UsXG4gICAgcG9sbCxcbiAgICB3ZWJXb3JrZXJUc0NvbmZpZyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyA9IFtdLFxuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgfSA9IGJ1aWxkT3B0aW9ucztcblxuICBjb25zdCBpc1BsYXRmb3JtU2VydmVyID0gYnVpbGRPcHRpb25zLnBsYXRmb3JtID09PSAnc2VydmVyJztcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiB7IGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcik6IHZvaWQgfVtdID0gW107XG4gIGNvbnN0IGV4dHJhUnVsZXM6IFJ1bGVTZXRSdWxlW10gPSBbXTtcbiAgY29uc3QgZW50cnlQb2ludHM6IENvbmZpZ3VyYXRpb25bJ2VudHJ5J10gPSB7fTtcblxuICAvLyBMb2FkIEVTTSBgQGFuZ3VsYXIvY29tcGlsZXItY2xpYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICBjb25zdCB7XG4gICAgR0xPQkFMX0RFRlNfRk9SX1RFUlNFUixcbiAgICBHTE9CQUxfREVGU19GT1JfVEVSU0VSX1dJVEhfQU9ULFxuICAgIFZFUlNJT046IE5HX1ZFUlNJT04sXG4gIH0gPSBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpPignQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk7XG5cbiAgLy8gZGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0XG4gIGNvbnN0IGhhc2hGb3JtYXQgPSBnZXRPdXRwdXRIYXNoRm9ybWF0KGJ1aWxkT3B0aW9ucy5vdXRwdXRIYXNoaW5nKTtcblxuICBpZiAoYnVpbGRPcHRpb25zLnByb2dyZXNzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFByb2dyZXNzUGx1Z2luKHBsYXRmb3JtKSk7XG4gIH1cblxuICBjb25zdCBsb2NhbGl6ZVBhY2thZ2VJbml0RW50cnlQb2ludCA9ICdAYW5ndWxhci9sb2NhbGl6ZS9pbml0JztcbiAgY29uc3QgaGFzTG9jYWxpemVUeXBlID0gdHNDb25maWcub3B0aW9ucy50eXBlcz8uc29tZShcbiAgICAodCkgPT4gdCA9PT0gJ0Bhbmd1bGFyL2xvY2FsaXplJyB8fCB0ID09PSBsb2NhbGl6ZVBhY2thZ2VJbml0RW50cnlQb2ludCxcbiAgKTtcblxuICBpZiAoaGFzTG9jYWxpemVUeXBlKSB7XG4gICAgZW50cnlQb2ludHNbJ21haW4nXSA9IFtsb2NhbGl6ZVBhY2thZ2VJbml0RW50cnlQb2ludF07XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLm1haW4pIHtcbiAgICBjb25zdCBtYWluUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMubWFpbik7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZW50cnlQb2ludHNbJ21haW4nXSkpIHtcbiAgICAgIGVudHJ5UG9pbnRzWydtYWluJ10ucHVzaChtYWluUGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVudHJ5UG9pbnRzWydtYWluJ10gPSBbbWFpblBhdGhdO1xuICAgIH1cbiAgfVxuXG4gIGlmIChpc1BsYXRmb3JtU2VydmVyKSB7XG4gICAgLy8gRml4ZXMgQ3JpdGljYWwgZGVwZW5kZW5jeTogdGhlIHJlcXVlc3Qgb2YgYSBkZXBlbmRlbmN5IGlzIGFuIGV4cHJlc3Npb25cbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgQ29udGV4dFJlcGxhY2VtZW50UGx1Z2luKC9AP2hhcGl8ZXhwcmVzc1tcXFxcL10vKSk7XG5cbiAgICBpZiAoaXNQbGF0Zm9ybVNlcnZlckluc3RhbGxlZCh3Y28ucm9vdCkgJiYgQXJyYXkuaXNBcnJheShlbnRyeVBvaW50c1snbWFpbiddKSkge1xuICAgICAgLy8gVGhpcyBpbXBvcnQgbXVzdCBjb21lIGJlZm9yZSBhbnkgaW1wb3J0cyAoZGlyZWN0IG9yIHRyYW5zaXRpdmUpIHRoYXQgcmVseSBvbiBET00gYnVpbHQtaW5zIGJlaW5nXG4gICAgICAvLyBhdmFpbGFibGUsIHN1Y2ggYXMgYEBhbmd1bGFyL2VsZW1lbnRzYC5cbiAgICAgIGVudHJ5UG9pbnRzWydtYWluJ10udW5zaGlmdCgnQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyL2luaXQnKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBwb2x5ZmlsbHMgPSBbLi4uYnVpbGRPcHRpb25zLnBvbHlmaWxsc107XG4gIGlmICghYW90KSB7XG4gICAgcG9seWZpbGxzLnB1c2goJ0Bhbmd1bGFyL2NvbXBpbGVyJyk7XG4gIH1cblxuICBpZiAocG9seWZpbGxzLmxlbmd0aCkge1xuICAgIC8vIGB6b25lLmpzL3Rlc3RpbmdgIGlzIGEgKipzcGVjaWFsKiogcG9seWZpbGwgYmVjYXVzZSB3aGVuIG5vdCBpbXBvcnRlZCBpbiB0aGUgbWFpbiBpdCBmYWlscyB3aXRoIHRoZSBiZWxvdyBlcnJvcnM6XG4gICAgLy8gYEVycm9yOiBFeHBlY3RlZCB0byBiZSBydW5uaW5nIGluICdQcm94eVpvbmUnLCBidXQgaXQgd2FzIG5vdCBmb3VuZC5gXG4gICAgLy8gVGhpcyB3YXMgYWxzbyB0aGUgcmVhc29uIHdoeSBwcmV2aW91c2x5IGl0IHdhcyBpbXBvcnRlZCBpbiBgdGVzdC50c2AgYXMgdGhlIGZpcnN0IG1vZHVsZS5cbiAgICAvLyBGcm9tIEppYSBsaTpcbiAgICAvLyBUaGlzIGlzIGJlY2F1c2UgdGhlIGphc21pbmUgZnVuY3Rpb25zIHN1Y2ggYXMgYmVmb3JlRWFjaC9pdCB3aWxsIG5vdCBiZSBwYXRjaGVkIGJ5IHpvbmUuanMgc2luY2VcbiAgICAvLyBqYXNtaW5lIHdpbGwgbm90IGJlIGxvYWRlZCB5ZXQsIHNvIHRoZSBQcm94eVpvbmUgd2lsbCBub3QgYmUgdGhlcmUuIFdlIGhhdmUgdG8gbG9hZCB6b25lLXRlc3RpbmcuanMgYWZ0ZXJcbiAgICAvLyBqYXNtaW5lIGlzIHJlYWR5LlxuICAgIC8vIFdlIGNvdWxkIGZvcmNlIGxvYWRpbmcgJ3pvbmUuanMvdGVzdGluZycgcHJpb3IgdG8gamFzbWluZSBieSBjaGFuZ2luZyB0aGUgb3JkZXIgb2Ygc2NyaXB0cyBpbiAna2FybWEtY29udGV4dC5odG1sJy5cbiAgICAvLyBCdXQgdGhpcyBoYXMgaXQncyBvd24gcHJvYmxlbXMgYXMgem9uZS5qcyBuZWVkcyB0byBiZSBsb2FkZWQgcHJpb3IgdG8gamFzbWluZSBkdWUgdG8gcGF0Y2hpbmcgb2YgdGltaW5nIGZ1bmN0aW9uc1xuICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2phc21pbmUvamFzbWluZS9pc3N1ZXMvMTk0NFxuICAgIC8vIFRodXMgdGhlIGNvcnJlY3Qgb3JkZXIgaXMgem9uZS5qcyAtPiBqYXNtaW5lIC0+IHpvbmUuanMvdGVzdGluZy5cbiAgICBjb25zdCB6b25lVGVzdGluZ0VudHJ5UG9pbnQgPSAnem9uZS5qcy90ZXN0aW5nJztcbiAgICBjb25zdCBwb2x5ZmlsbHNFeGx1ZGluZ1pvbmVUZXN0aW5nID0gcG9seWZpbGxzLmZpbHRlcigocCkgPT4gcCAhPT0gem9uZVRlc3RpbmdFbnRyeVBvaW50KTtcblxuICAgIGlmIChBcnJheS5pc0FycmF5KGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSkpIHtcbiAgICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXS5wdXNoKC4uLnBvbHlmaWxsc0V4bHVkaW5nWm9uZVRlc3RpbmcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10gPSBwb2x5ZmlsbHNFeGx1ZGluZ1pvbmVUZXN0aW5nO1xuICAgIH1cblxuICAgIGlmIChwb2x5ZmlsbHNFeGx1ZGluZ1pvbmVUZXN0aW5nLmxlbmd0aCAhPT0gcG9seWZpbGxzLmxlbmd0aCkge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZW50cnlQb2ludHNbJ21haW4nXSkpIHtcbiAgICAgICAgZW50cnlQb2ludHNbJ21haW4nXS51bnNoaWZ0KHpvbmVUZXN0aW5nRW50cnlQb2ludCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbnRyeVBvaW50c1snbWFpbiddID0gW3pvbmVUZXN0aW5nRW50cnlQb2ludF07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcykge1xuICAgIC8vIFdoZW4gdGhpcyBpcyBub3QgZGVmaW5lZCBpdCBtZWFucyB0aGUgYnVpbGRlciBkb2Vzbid0IHN1cHBvcnQgc2hvd2luZyBjb21tb24ganMgdXNhZ2VzLlxuICAgIC8vIFdoZW4gaXQgZG9lcyBpdCB3aWxsIGJlIGFuIGFycmF5LlxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IENvbW1vbkpzVXNhZ2VXYXJuUGx1Z2luKHtcbiAgICAgICAgYWxsb3dlZERlcGVuZGVuY2llczogYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgZ2xvYmFsIHNjcmlwdHNcbiAgLy8gQWRkIGEgbmV3IGFzc2V0IGZvciBlYWNoIGVudHJ5LlxuICBmb3IgKGNvbnN0IHsgYnVuZGxlTmFtZSwgaW5qZWN0LCBwYXRocyB9IG9mIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUoYnVpbGRPcHRpb25zLnNjcmlwdHMpKSB7XG4gICAgLy8gTGF6eSBzY3JpcHRzIGRvbid0IGdldCBhIGhhc2gsIG90aGVyd2lzZSB0aGV5IGNhbid0IGJlIGxvYWRlZCBieSBuYW1lLlxuICAgIGNvbnN0IGhhc2ggPSBpbmplY3QgPyBoYXNoRm9ybWF0LnNjcmlwdCA6ICcnO1xuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU2NyaXB0c1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICBuYW1lOiBidW5kbGVOYW1lLFxuICAgICAgICBzb3VyY2VNYXA6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICAgIHNjcmlwdHM6IHBhdGhzLFxuICAgICAgICBmaWxlbmFtZTogYCR7cGF0aC5iYXNlbmFtZShidW5kbGVOYW1lKX0ke2hhc2h9LmpzYCxcbiAgICAgICAgYmFzZVBhdGg6IHJvb3QsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgLy8gcHJvY2VzcyBhc3NldCBlbnRyaWVzXG4gIGlmIChidWlsZE9wdGlvbnMuYXNzZXRzLmxlbmd0aCkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IENvcHlXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgcGF0dGVybnM6IGFzc2V0UGF0dGVybnMocm9vdCwgYnVpbGRPcHRpb25zLmFzc2V0cyksXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5leHRyYWN0TGljZW5zZXMpIHtcbiAgICBjb25zdCBMaWNlbnNlV2VicGFja1BsdWdpbiA9IHJlcXVpcmUoJ2xpY2Vuc2Utd2VicGFjay1wbHVnaW4nKS5MaWNlbnNlV2VicGFja1BsdWdpbjtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBMaWNlbnNlV2VicGFja1BsdWdpbih7XG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgd2FybmluZ3M6IGZhbHNlLFxuICAgICAgICAgIGVycm9yczogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIHBlckNodW5rT3V0cHV0OiBmYWxzZSxcbiAgICAgICAgb3V0cHV0RmlsZW5hbWU6ICczcmRwYXJ0eWxpY2Vuc2VzLnR4dCcsXG4gICAgICAgIHNraXBDaGlsZENvbXBpbGVyczogdHJ1ZSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoc2NyaXB0c1NvdXJjZU1hcCB8fCBzdHlsZXNTb3VyY2VNYXApIHtcbiAgICBjb25zdCBpbmNsdWRlID0gW107XG4gICAgaWYgKHNjcmlwdHNTb3VyY2VNYXApIHtcbiAgICAgIGluY2x1ZGUucHVzaCgvanMkLyk7XG4gICAgfVxuXG4gICAgaWYgKHN0eWxlc1NvdXJjZU1hcCkge1xuICAgICAgaW5jbHVkZS5wdXNoKC9jc3MkLyk7XG4gICAgfVxuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IERldlRvb2xzSWdub3JlUGx1Z2luKCkpO1xuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU291cmNlTWFwRGV2VG9vbFBsdWdpbih7XG4gICAgICAgIGZpbGVuYW1lOiAnW2ZpbGVdLm1hcCcsXG4gICAgICAgIGluY2x1ZGUsXG4gICAgICAgIC8vIFdlIHdhbnQgdG8gc2V0IHNvdXJjZVJvb3QgdG8gIGB3ZWJwYWNrOi8vL2AgZm9yIG5vblxuICAgICAgICAvLyBpbmxpbmUgc291cmNlbWFwcyBhcyBvdGhlcndpc2UgcGF0aHMgdG8gc291cmNlbWFwcyB3aWxsIGJlIGJyb2tlbiBpbiBicm93c2VyXG4gICAgICAgIC8vIGB3ZWJwYWNrOi8vL2AgaXMgbmVlZGVkIGZvciBWaXN1YWwgU3R1ZGlvIGJyZWFrcG9pbnRzIHRvIHdvcmsgcHJvcGVybHkgYXMgY3VycmVudGx5XG4gICAgICAgIC8vIHRoZXJlIGlzIG5vIHdheSB0byBzZXQgdGhlICd3ZWJSb290J1xuICAgICAgICBzb3VyY2VSb290OiAnd2VicGFjazovLy8nLFxuICAgICAgICBtb2R1bGVGaWxlbmFtZVRlbXBsYXRlOiAnW3Jlc291cmNlLXBhdGhdJyxcbiAgICAgICAgYXBwZW5kOiBoaWRkZW5Tb3VyY2VNYXAgPyBmYWxzZSA6IHVuZGVmaW5lZCxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAodmVyYm9zZSkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBXYXRjaEZpbGVzTG9nc1BsdWdpbigpKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3RhdHNKc29uKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgSnNvblN0YXRzUGx1Z2luKHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCwgJ3N0YXRzLmpzb24nKSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzdWJyZXNvdXJjZUludGVncml0eSkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFN1YnJlc291cmNlSW50ZWdyaXR5UGx1Z2luKHtcbiAgICAgICAgaGFzaEZ1bmNOYW1lczogWydzaGEzODQnXSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoc2NyaXB0c1NvdXJjZU1hcCB8fCBzdHlsZXNTb3VyY2VNYXApIHtcbiAgICBleHRyYVJ1bGVzLnB1c2goe1xuICAgICAgdGVzdDogL1xcLltjbV0/anN4PyQvLFxuICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnc291cmNlLW1hcC1sb2FkZXInKSxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgZmlsdGVyU291cmNlTWFwcGluZ1VybDogKF9tYXBVcmk6IHN0cmluZywgcmVzb3VyY2VQYXRoOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICBpZiAodmVuZG9yU291cmNlTWFwKSB7XG4gICAgICAgICAgICAvLyBDb25zdW1lIGFsbCBzb3VyY2VtYXBzIHdoZW4gdmVuZG9yIG9wdGlvbiBpcyBlbmFibGVkLlxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gRG9uJ3QgY29uc3VtZSBzb3VyY2VtYXBzIGluIG5vZGVfbW9kdWxlcyB3aGVuIHZlbmRvciBpcyBkaXNhYmxlZC5cbiAgICAgICAgICAvLyBCdXQsIGRvIGNvbnN1bWUgbG9jYWwgbGlicmFyaWVzIHNvdXJjZW1hcHMuXG4gICAgICAgICAgcmV0dXJuICFyZXNvdXJjZVBhdGguaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChtYWluIHx8IHBvbHlmaWxscykge1xuICAgIGV4dHJhUnVsZXMucHVzaCh7XG4gICAgICB0ZXN0OiB0c0NvbmZpZy5vcHRpb25zLmFsbG93SnMgPyAvXFwuW2NtXT9bdGpdc3g/JC8gOiAvXFwuW2NtXT90c3g/JC8sXG4gICAgICBsb2FkZXI6IEFuZ3VsYXJXZWJwYWNrTG9hZGVyUGF0aCxcbiAgICAgIC8vIFRoZSBiZWxvdyBhcmUga25vd24gcGF0aHMgdGhhdCBhcmUgbm90IHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gZXZlbiB3aGVuIGFsbG93SnMgaXMgZW5hYmxlZC5cbiAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgL1tcXFxcL11ub2RlX21vZHVsZXNbL1xcXFxdKD86Y3NzLWxvYWRlcnxtaW5pLWNzcy1leHRyYWN0LXBsdWdpbnx3ZWJwYWNrLWRldi1zZXJ2ZXJ8d2VicGFjaylbL1xcXFxdLyxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goY3JlYXRlSXZ5UGx1Z2luKHdjbywgYW90LCB0c0NvbmZpZ1BhdGgpKTtcbiAgfVxuXG4gIGlmICh3ZWJXb3JrZXJUc0NvbmZpZykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGNyZWF0ZUl2eVBsdWdpbih3Y28sIGZhbHNlLCBwYXRoLnJlc29sdmUod2NvLnJvb3QsIHdlYldvcmtlclRzQ29uZmlnKSkpO1xuICB9XG5cbiAgY29uc3QgZXh0cmFNaW5pbWl6ZXJzID0gW107XG4gIGlmIChzY3JpcHRzT3B0aW1pemF0aW9uKSB7XG4gICAgZXh0cmFNaW5pbWl6ZXJzLnB1c2goXG4gICAgICBuZXcgSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbih7XG4gICAgICAgIGRlZmluZTogYnVpbGRPcHRpb25zLmFvdCA/IEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QgOiBHTE9CQUxfREVGU19GT1JfVEVSU0VSLFxuICAgICAgICBzb3VyY2VtYXA6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICAgIHN1cHBvcnRlZEJyb3dzZXJzOiBidWlsZE9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICAgIGtlZXBJZGVudGlmaWVyTmFtZXM6ICFhbGxvd01hbmdsZSB8fCBpc1BsYXRmb3JtU2VydmVyLFxuICAgICAgICBrZWVwTmFtZXM6IGlzUGxhdGZvcm1TZXJ2ZXIsXG4gICAgICAgIHJlbW92ZUxpY2Vuc2VzOiBidWlsZE9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzLFxuICAgICAgICBhZHZhbmNlZDogYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChwbGF0Zm9ybSA9PT0gJ2Jyb3dzZXInICYmIChzY3JpcHRzT3B0aW1pemF0aW9uIHx8IHN0eWxlc09wdGltaXphdGlvbi5taW5pZnkpKSB7XG4gICAgZXh0cmFNaW5pbWl6ZXJzLnB1c2gobmV3IFRyYW5zZmVyU2l6ZVBsdWdpbigpKTtcbiAgfVxuXG4gIGxldCBjcm9zc09yaWdpbkxvYWRpbmc6IE5vbk51bGxhYmxlPENvbmZpZ3VyYXRpb25bJ291dHB1dCddPlsnY3Jvc3NPcmlnaW5Mb2FkaW5nJ10gPSBmYWxzZTtcbiAgaWYgKHN1YnJlc291cmNlSW50ZWdyaXR5ICYmIGNyb3NzT3JpZ2luID09PSAnbm9uZScpIHtcbiAgICBjcm9zc09yaWdpbkxvYWRpbmcgPSAnYW5vbnltb3VzJztcbiAgfSBlbHNlIGlmIChjcm9zc09yaWdpbiAhPT0gJ25vbmUnKSB7XG4gICAgY3Jvc3NPcmlnaW5Mb2FkaW5nID0gY3Jvc3NPcmlnaW47XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG1vZGU6IHNjcmlwdHNPcHRpbWl6YXRpb24gfHwgc3R5bGVzT3B0aW1pemF0aW9uLm1pbmlmeSA/ICdwcm9kdWN0aW9uJyA6ICdkZXZlbG9wbWVudCcsXG4gICAgZGV2dG9vbDogZmFsc2UsXG4gICAgdGFyZ2V0OiBbaXNQbGF0Zm9ybVNlcnZlciA/ICdub2RlJyA6ICd3ZWInLCAnZXMyMDE1J10sXG4gICAgcHJvZmlsZTogYnVpbGRPcHRpb25zLnN0YXRzSnNvbixcbiAgICByZXNvbHZlOiB7XG4gICAgICByb290czogW3Byb2plY3RSb290XSxcbiAgICAgIGV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICBtb2R1bGVzOiBbdHNDb25maWcub3B0aW9ucy5iYXNlVXJsIHx8IHByb2plY3RSb290LCAnbm9kZV9tb2R1bGVzJ10sXG4gICAgICBtYWluRmllbGRzOiBpc1BsYXRmb3JtU2VydmVyXG4gICAgICAgID8gWydlczIwMjAnLCAnZXMyMDE1JywgJ21vZHVsZScsICdtYWluJ11cbiAgICAgICAgOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgICAgY29uZGl0aW9uTmFtZXM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICcuLi4nXSxcbiAgICB9LFxuICAgIHJlc29sdmVMb2FkZXI6IHtcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgfSxcbiAgICBjb250ZXh0OiByb290LFxuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBleHRlcm5hbHM6IGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIG91dHB1dDoge1xuICAgICAgdW5pcXVlTmFtZTogcHJvamVjdE5hbWUsXG4gICAgICBoYXNoRnVuY3Rpb246ICd4eGhhc2g2NCcsIC8vIHRvZG86IHJlbW92ZSBpbiB3ZWJwYWNrIDYuIFRoaXMgaXMgcGFydCBvZiBgZnV0dXJlRGVmYXVsdHNgLlxuICAgICAgY2xlYW46IGJ1aWxkT3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoID8/IHRydWUsXG4gICAgICBwYXRoOiBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm91dHB1dFBhdGgpLFxuICAgICAgcHVibGljUGF0aDogYnVpbGRPcHRpb25zLmRlcGxveVVybCA/PyAnJyxcbiAgICAgIGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmNodW5rfS5qc2AsXG4gICAgICBjaHVua0ZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmNodW5rfS5qc2AsXG4gICAgICBsaWJyYXJ5VGFyZ2V0OiBpc1BsYXRmb3JtU2VydmVyID8gJ2NvbW1vbmpzJyA6IHVuZGVmaW5lZCxcbiAgICAgIGNyb3NzT3JpZ2luTG9hZGluZyxcbiAgICAgIHRydXN0ZWRUeXBlczogJ2FuZ3VsYXIjYnVuZGxlcicsXG4gICAgICBzY3JpcHRUeXBlOiAnbW9kdWxlJyxcbiAgICB9LFxuICAgIHdhdGNoOiBidWlsZE9wdGlvbnMud2F0Y2gsXG4gICAgd2F0Y2hPcHRpb25zOiB7XG4gICAgICBwb2xsLFxuICAgICAgLy8gVGhlIGJlbG93IGlzIG5lZWRlZCBhcyB3aGVuIHByZXNlcnZlU3ltbGlua3MgaXMgZW5hYmxlZCB3ZSBkaXNhYmxlIGByZXNvbHZlLnN5bWxpbmtzYC5cbiAgICAgIGZvbGxvd1N5bWxpbmtzOiBidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgIGlnbm9yZWQ6IHBvbGwgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6ICcqKi9ub2RlX21vZHVsZXMvKionLFxuICAgIH0sXG4gICAgc25hcHNob3Q6IHtcbiAgICAgIG1vZHVsZToge1xuICAgICAgICAvLyBVc2UgaGFzaCBvZiBjb250ZW50IGluc3RlYWQgb2YgdGltZXN0YW1wIGJlY2F1c2UgdGhlIHRpbWVzdGFtcCBvZiB0aGUgc3ltbGluayB3aWxsIGJlIHVzZWRcbiAgICAgICAgLy8gaW5zdGVhZCBvZiB0aGUgcmVmZXJlbmNlZCBmaWxlcyB3aGljaCBjYXVzZXMgY2hhbmdlcyBpbiBzeW1saW5rcyBub3QgdG8gYmUgcGlja2VkIHVwLlxuICAgICAgICBoYXNoOiBidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwZXJmb3JtYW5jZToge1xuICAgICAgaGludHM6IGZhbHNlLFxuICAgIH0sXG4gICAgaWdub3JlV2FybmluZ3M6IFtcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc291cmNlLW1hcC1sb2FkZXIvYmxvYi9iMmRlNDI0OWM3NDMxZGQ4NDMyZGE2MDdlMDhmMGY2NWU5ZDY0MjE5L3NyYy9pbmRleC5qcyNMODNcbiAgICAgIC9GYWlsZWQgdG8gcGFyc2Ugc291cmNlIG1hcCBmcm9tLyxcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvcG9zdGNzcy1sb2FkZXIvYmxvYi9iZDI2MTg3NWZkZjljNTk2YWY0ZmZiM2ExYTczZmUzYzU0OWJlZmRhL3NyYy9pbmRleC5qcyNMMTUzLUwxNThcbiAgICAgIC9BZGQgcG9zdGNzcyBhcyBwcm9qZWN0IGRlcGVuZGVuY3kvLFxuICAgICAgLy8gZXNidWlsZCB3aWxsIGlzc3VlIGEgd2FybmluZywgd2hpbGUgc3RpbGwgaG9pc3RzIHRoZSBAY2hhcnNldCBhdCB0aGUgdmVyeSB0b3AuXG4gICAgICAvLyBUaGlzIGlzIGNhdXNlZCBieSBhIGJ1ZyBpbiBjc3MtbG9hZGVyIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvY3NzLWxvYWRlci9pc3N1ZXMvMTIxMlxuICAgICAgL1wiQGNoYXJzZXRcIiBtdXN0IGJlIHRoZSBmaXJzdCBydWxlIGluIHRoZSBmaWxlLyxcbiAgICBdLFxuICAgIG1vZHVsZToge1xuICAgICAgLy8gU2hvdyBhbiBlcnJvciBmb3IgbWlzc2luZyBleHBvcnRzIGluc3RlYWQgb2YgYSB3YXJuaW5nLlxuICAgICAgc3RyaWN0RXhwb3J0UHJlc2VuY2U6IHRydWUsXG4gICAgICBwYXJzZXI6IHtcbiAgICAgICAgamF2YXNjcmlwdDoge1xuICAgICAgICAgIHJlcXVpcmVDb250ZXh0OiBmYWxzZSxcbiAgICAgICAgICAvLyBEaXNhYmxlIGF1dG8gVVJMIGFzc2V0IG1vZHVsZSBjcmVhdGlvbi4gVGhpcyBkb2Vzbid0IGVmZmVjdCBgbmV3IFdvcmtlcihuZXcgVVJMKC4uLikpYFxuICAgICAgICAgIC8vIGh0dHBzOi8vd2VicGFjay5qcy5vcmcvZ3VpZGVzL2Fzc2V0LW1vZHVsZXMvI3VybC1hc3NldHNcbiAgICAgICAgICB1cmw6IGZhbHNlLFxuICAgICAgICAgIHdvcmtlcjogISF3ZWJXb3JrZXJUc0NvbmZpZyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBydWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLj8oc3ZnfGh0bWwpJC8sXG4gICAgICAgICAgLy8gT25seSBwcm9jZXNzIEhUTUwgYW5kIFNWRyB3aGljaCBhcmUga25vd24gQW5ndWxhciBjb21wb25lbnQgcmVzb3VyY2VzLlxuICAgICAgICAgIHJlc291cmNlUXVlcnk6IC9cXD9uZ1Jlc291cmNlLyxcbiAgICAgICAgICB0eXBlOiAnYXNzZXQvc291cmNlJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIC8vIE1hcmsgZmlsZXMgaW5zaWRlIGByeGpzL2FkZGAgYXMgY29udGFpbmluZyBzaWRlIGVmZmVjdHMuXG4gICAgICAgICAgLy8gSWYgdGhpcyBpcyBmaXhlZCB1cHN0cmVhbSBhbmQgdGhlIGZpeGVkIHZlcnNpb24gYmVjb21lcyB0aGUgbWluaW11bVxuICAgICAgICAgIC8vIHN1cHBvcnRlZCB2ZXJzaW9uLCB0aGlzIGNhbiBiZSByZW1vdmVkLlxuICAgICAgICAgIHRlc3Q6IC9bL1xcXFxdcnhqc1svXFxcXF1hZGRbL1xcXFxdLitcXC5qcyQvLFxuICAgICAgICAgIHNpZGVFZmZlY3RzOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLltjbV0/W3RqXXN4PyQvLFxuICAgICAgICAgIC8vIFRoZSBiZWxvdyBpcyBuZWVkZWQgZHVlIHRvIGEgYnVnIGluIGBAYmFiZWwvcnVudGltZWAuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2JhYmVsL2JhYmVsL2lzc3Vlcy8xMjgyNFxuICAgICAgICAgIHJlc29sdmU6IHsgZnVsbHlTcGVjaWZpZWQ6IGZhbHNlIH0sXG4gICAgICAgICAgZXhjbHVkZTogW1xuICAgICAgICAgICAgL1tcXFxcL11ub2RlX21vZHVsZXNbL1xcXFxdKD86Y29yZS1qc3xAYmFiZWx8dHNsaWJ8d2ViLWFuaW1hdGlvbnMtanN8d2ViLXN0cmVhbXMtcG9seWZpbGx8d2hhdHdnLXVybClbL1xcXFxdLyxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHVzZTogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInKSxcbiAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICAgIGNhY2hlRGlyZWN0b3J5OiAoY2FjaGUuZW5hYmxlZCAmJiBwYXRoLmpvaW4oY2FjaGUucGF0aCwgJ2JhYmVsLXdlYnBhY2snKSkgfHwgZmFsc2UsXG4gICAgICAgICAgICAgICAgYW90OiBidWlsZE9wdGlvbnMuYW90LFxuICAgICAgICAgICAgICAgIG9wdGltaXplOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICAgICAgICAgICAgc3VwcG9ydGVkQnJvd3NlcnM6IGJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2VycyxcbiAgICAgICAgICAgICAgICBpbnN0cnVtZW50Q29kZTogY29kZUNvdmVyYWdlXG4gICAgICAgICAgICAgICAgICA/IHtcbiAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZEJhc2VQYXRoOiBzb3VyY2VSb290ID8/IHByb2plY3RSb290LFxuICAgICAgICAgICAgICAgICAgICAgIGV4Y2x1ZGVkUGF0aHM6IGdldEluc3RydW1lbnRhdGlvbkV4Y2x1ZGVkUGF0aHMocm9vdCwgY29kZUNvdmVyYWdlRXhjbHVkZSksXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICB9IGFzIEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIC4uLmV4dHJhUnVsZXMsXG4gICAgICBdLFxuICAgIH0sXG4gICAgZXhwZXJpbWVudHM6IHtcbiAgICAgIGJhY2tDb21wYXQ6IGZhbHNlLFxuICAgICAgc3luY1dlYkFzc2VtYmx5OiB0cnVlLFxuICAgICAgYXN5bmNXZWJBc3NlbWJseTogdHJ1ZSxcbiAgICAgIHRvcExldmVsQXdhaXQ6IGZhbHNlLFxuICAgIH0sXG4gICAgaW5mcmFzdHJ1Y3R1cmVMb2dnaW5nOiB7XG4gICAgICBkZWJ1ZzogdmVyYm9zZSxcbiAgICAgIGxldmVsOiB2ZXJib3NlID8gJ3ZlcmJvc2UnIDogJ2Vycm9yJyxcbiAgICB9LFxuICAgIHN0YXRzOiBnZXRTdGF0c09wdGlvbnModmVyYm9zZSksXG4gICAgY2FjaGU6IGdldENhY2hlU2V0dGluZ3Mod2NvLCBOR19WRVJTSU9OLmZ1bGwpLFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgbWluaW1pemVyOiBleHRyYU1pbmltaXplcnMsXG4gICAgICBtb2R1bGVJZHM6ICdkZXRlcm1pbmlzdGljJyxcbiAgICAgIGNodW5rSWRzOiBidWlsZE9wdGlvbnMubmFtZWRDaHVua3MgPyAnbmFtZWQnIDogJ2RldGVybWluaXN0aWMnLFxuICAgICAgZW1pdE9uRXJyb3JzOiBmYWxzZSxcbiAgICAgIHJ1bnRpbWVDaHVuazogaXNQbGF0Zm9ybVNlcnZlciA/IGZhbHNlIDogJ3NpbmdsZScsXG4gICAgICBzcGxpdENodW5rczoge1xuICAgICAgICBtYXhBc3luY1JlcXVlc3RzOiBJbmZpbml0eSxcbiAgICAgICAgY2FjaGVHcm91cHM6IHtcbiAgICAgICAgICBkZWZhdWx0OiAhIWNvbW1vbkNodW5rICYmIHtcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIHByaW9yaXR5OiAxMCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbW1vbjogISFjb21tb25DaHVuayAmJiB7XG4gICAgICAgICAgICBuYW1lOiAnY29tbW9uJyxcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICBwcmlvcml0eTogNSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZlbmRvcnM6IGZhbHNlLFxuICAgICAgICAgIGRlZmF1bHRWZW5kb3JzOiAhIXZlbmRvckNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICd2ZW5kb3InLFxuICAgICAgICAgICAgY2h1bmtzOiAoY2h1bmspID0+IGNodW5rLm5hbWUgPT09ICdtYWluJyxcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICB0ZXN0OiBWRU5ET1JTX1RFU1QsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBuZXcgTmFtZWRDaHVua3NQbHVnaW4oKSxcbiAgICAgIG5ldyBPY2N1cnJlbmNlc1BsdWdpbih7XG4gICAgICAgIGFvdCxcbiAgICAgICAgc2NyaXB0c09wdGltaXphdGlvbixcbiAgICAgIH0pLFxuICAgICAgbmV3IERlZHVwZU1vZHVsZVJlc29sdmVQbHVnaW4oeyB2ZXJib3NlIH0pLFxuICAgICAgLi4uZXh0cmFQbHVnaW5zLFxuICAgIF0sXG4gICAgbm9kZTogZmFsc2UsXG4gIH07XG59XG4iXX0=