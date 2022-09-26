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
const environment_options_1 = require("../../utils/environment-options");
const load_esm_1 = require("../../utils/load-esm");
const plugins_1 = require("../plugins");
const devtools_ignore_plugin_1 = require("../plugins/devtools-ignore-plugin");
const named_chunks_plugin_1 = require("../plugins/named-chunks-plugin");
const progress_plugin_1 = require("../plugins/progress-plugin");
const transfer_size_plugin_1 = require("../plugins/transfer-size-plugin");
const typescript_1 = require("../plugins/typescript");
const watch_files_logs_plugin_1 = require("../plugins/watch-files-logs-plugin");
const helpers_1 = require("../utils/helpers");
const VENDORS_TEST = /[\\/]node_modules[\\/]/;
// eslint-disable-next-line max-lines-per-function
async function getCommonConfig(wco) {
    var _a, _b;
    const { root, projectRoot, buildOptions, tsConfig, projectName, sourceRoot, tsConfigPath } = wco;
    const { cache, codeCoverage, crossOrigin = 'none', platform = 'browser', aot = true, codeCoverageExclude = [], main, polyfills, sourceMap: { styles: stylesSourceMap, scripts: scriptsSourceMap, vendor: vendorSourceMap, hidden: hiddenSourceMap, }, optimization: { styles: stylesOptimization, scripts: scriptsOptimization }, commonChunk, vendorChunk, subresourceIntegrity, verbose, poll, webWorkerTsConfig, externalDependencies = [], allowedCommonJsDependencies, } = buildOptions;
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
    if (buildOptions.main) {
        const mainPath = path.resolve(root, buildOptions.main);
        entryPoints['main'] = [mainPath];
    }
    if (isPlatformServer) {
        // Fixes Critical dependency: the request of a dependency is an expression
        extraPlugins.push(new webpack_2.ContextReplacementPlugin(/@?hapi|express[\\/]/));
    }
    if (polyfills === null || polyfills === void 0 ? void 0 : polyfills.length) {
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
                entryPoints['main'] = [zoneTestingEntryPoint, entryPoints['main']];
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
    for (const { bundleName, inject, paths } of (0, helpers_1.globalScriptsByBundleName)(root, buildOptions.scripts)) {
        // Lazy scripts don't get a hash, otherwise they can't be loaded by name.
        const hash = inject ? hashFormat.script : '';
        extraPlugins.push(new plugins_1.ScriptsWebpackPlugin({
            name: bundleName,
            sourceMap: scriptsSourceMap,
            scripts: paths,
            filename: `${path.basename(bundleName)}${hash}.js`,
            basePath: projectRoot,
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
            clean: (_a = buildOptions.deleteOutputPath) !== null && _a !== void 0 ? _a : true,
            path: path.resolve(root, buildOptions.outputPath),
            publicPath: (_b = buildOptions.deployUrl) !== null && _b !== void 0 ? _b : '',
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
                                        includedBasePath: sourceRoot !== null && sourceRoot !== void 0 ? sourceRoot : projectRoot,
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
        plugins: [new named_chunks_plugin_1.NamedChunksPlugin(), new plugins_1.DedupeModuleResolvePlugin({ verbose }), ...extraPlugins],
        node: false,
    };
}
exports.getCommonConfig = getCommonConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhDQUE0RDtBQUM1RCw4RUFBb0Q7QUFDcEQsMkNBQTZCO0FBQzdCLHFDQU1pQjtBQUNqQixpRkFBMkU7QUFHM0UseUVBQThEO0FBQzlELG1EQUFxRDtBQUNyRCx3Q0FNb0I7QUFDcEIsOEVBQXlFO0FBQ3pFLHdFQUFtRTtBQUNuRSxnRUFBNEQ7QUFDNUQsMEVBQXFFO0FBQ3JFLHNEQUF3RDtBQUN4RCxnRkFBMEU7QUFDMUUsOENBTzBCO0FBRTFCLE1BQU0sWUFBWSxHQUFHLHdCQUF3QixDQUFDO0FBRTlDLGtEQUFrRDtBQUMzQyxLQUFLLFVBQVUsZUFBZSxDQUFDLEdBQXlCOztJQUM3RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ2pHLE1BQU0sRUFDSixLQUFLLEVBQ0wsWUFBWSxFQUNaLFdBQVcsR0FBRyxNQUFNLEVBQ3BCLFFBQVEsR0FBRyxTQUFTLEVBQ3BCLEdBQUcsR0FBRyxJQUFJLEVBQ1YsbUJBQW1CLEdBQUcsRUFBRSxFQUN4QixJQUFJLEVBQ0osU0FBUyxFQUNULFNBQVMsRUFBRSxFQUNULE1BQU0sRUFBRSxlQUFlLEVBQ3ZCLE9BQU8sRUFBRSxnQkFBZ0IsRUFDekIsTUFBTSxFQUFFLGVBQWUsRUFDdkIsTUFBTSxFQUFFLGVBQWUsR0FDeEIsRUFDRCxZQUFZLEVBQUUsRUFBRSxNQUFNLEVBQUUsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixF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Q29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQW5ndWxhcldlYnBhY2tMb2FkZXJQYXRoIH0gZnJvbSAnQG5ndG9vbHMvd2VicGFjayc7XG5pbXBvcnQgQ29weVdlYnBhY2tQbHVnaW4gZnJvbSAnY29weS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtcbiAgQ29tcGlsZXIsXG4gIENvbmZpZ3VyYXRpb24sXG4gIENvbnRleHRSZXBsYWNlbWVudFBsdWdpbixcbiAgUnVsZVNldFJ1bGUsXG4gIFNvdXJjZU1hcERldlRvb2xQbHVnaW4sXG59IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4gfSBmcm9tICd3ZWJwYWNrLXN1YnJlc291cmNlLWludGVncml0eSc7XG5pbXBvcnQgeyBBbmd1bGFyQmFiZWxMb2FkZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IGFsbG93TWFuZ2xlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHtcbiAgQ29tbW9uSnNVc2FnZVdhcm5QbHVnaW4sXG4gIERlZHVwZU1vZHVsZVJlc29sdmVQbHVnaW4sXG4gIEphdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW4sXG4gIEpzb25TdGF0c1BsdWdpbixcbiAgU2NyaXB0c1dlYnBhY2tQbHVnaW4sXG59IGZyb20gJy4uL3BsdWdpbnMnO1xuaW1wb3J0IHsgRGV2VG9vbHNJZ25vcmVQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL2RldnRvb2xzLWlnbm9yZS1wbHVnaW4nO1xuaW1wb3J0IHsgTmFtZWRDaHVua3NQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL25hbWVkLWNodW5rcy1wbHVnaW4nO1xuaW1wb3J0IHsgUHJvZ3Jlc3NQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3Byb2dyZXNzLXBsdWdpbic7XG5pbXBvcnQgeyBUcmFuc2ZlclNpemVQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3RyYW5zZmVyLXNpemUtcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZUl2eVBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvdHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBXYXRjaEZpbGVzTG9nc1BsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvd2F0Y2gtZmlsZXMtbG9ncy1wbHVnaW4nO1xuaW1wb3J0IHtcbiAgYXNzZXRQYXR0ZXJucyxcbiAgZ2V0Q2FjaGVTZXR0aW5ncyxcbiAgZ2V0SW5zdHJ1bWVudGF0aW9uRXhjbHVkZWRQYXRocyxcbiAgZ2V0T3V0cHV0SGFzaEZvcm1hdCxcbiAgZ2V0U3RhdHNPcHRpb25zLFxuICBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lLFxufSBmcm9tICcuLi91dGlscy9oZWxwZXJzJztcblxuY29uc3QgVkVORE9SU19URVNUID0gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLztcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRDb21tb25Db25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IFByb21pc2U8Q29uZmlndXJhdGlvbj4ge1xuICBjb25zdCB7IHJvb3QsIHByb2plY3RSb290LCBidWlsZE9wdGlvbnMsIHRzQ29uZmlnLCBwcm9qZWN0TmFtZSwgc291cmNlUm9vdCwgdHNDb25maWdQYXRoIH0gPSB3Y287XG4gIGNvbnN0IHtcbiAgICBjYWNoZSxcbiAgICBjb2RlQ292ZXJhZ2UsXG4gICAgY3Jvc3NPcmlnaW4gPSAnbm9uZScsXG4gICAgcGxhdGZvcm0gPSAnYnJvd3NlcicsXG4gICAgYW90ID0gdHJ1ZSxcbiAgICBjb2RlQ292ZXJhZ2VFeGNsdWRlID0gW10sXG4gICAgbWFpbixcbiAgICBwb2x5ZmlsbHMsXG4gICAgc291cmNlTWFwOiB7XG4gICAgICBzdHlsZXM6IHN0eWxlc1NvdXJjZU1hcCxcbiAgICAgIHNjcmlwdHM6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICB2ZW5kb3I6IHZlbmRvclNvdXJjZU1hcCxcbiAgICAgIGhpZGRlbjogaGlkZGVuU291cmNlTWFwLFxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7IHN0eWxlczogc3R5bGVzT3B0aW1pemF0aW9uLCBzY3JpcHRzOiBzY3JpcHRzT3B0aW1pemF0aW9uIH0sXG4gICAgY29tbW9uQ2h1bmssXG4gICAgdmVuZG9yQ2h1bmssXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgdmVyYm9zZSxcbiAgICBwb2xsLFxuICAgIHdlYldvcmtlclRzQ29uZmlnLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzID0gW10sXG4gICAgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICB9ID0gYnVpbGRPcHRpb25zO1xuXG4gIGNvbnN0IGlzUGxhdGZvcm1TZXJ2ZXIgPSBidWlsZE9wdGlvbnMucGxhdGZvcm0gPT09ICdzZXJ2ZXInO1xuICBjb25zdCBleHRyYVBsdWdpbnM6IHsgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKTogdm9pZCB9W10gPSBbXTtcbiAgY29uc3QgZXh0cmFSdWxlczogUnVsZVNldFJ1bGVbXSA9IFtdO1xuICBjb25zdCBlbnRyeVBvaW50czogQ29uZmlndXJhdGlvblsnZW50cnknXSA9IHt9O1xuXG4gIC8vIExvYWQgRVNNIGBAYW5ndWxhci9jb21waWxlci1jbGlgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gIGNvbnN0IHtcbiAgICBHTE9CQUxfREVGU19GT1JfVEVSU0VSLFxuICAgIEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QsXG4gICAgVkVSU0lPTjogTkdfVkVSU0lPTixcbiAgfSA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk+KCdAYW5ndWxhci9jb21waWxlci1jbGknKTtcblxuICAvLyBkZXRlcm1pbmUgaGFzaGluZyBmb3JtYXRcbiAgY29uc3QgaGFzaEZvcm1hdCA9IGdldE91dHB1dEhhc2hGb3JtYXQoYnVpbGRPcHRpb25zLm91dHB1dEhhc2hpbmcpO1xuXG4gIGlmIChidWlsZE9wdGlvbnMucHJvZ3Jlc3MpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgUHJvZ3Jlc3NQbHVnaW4ocGxhdGZvcm0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMubWFpbikge1xuICAgIGNvbnN0IG1haW5QYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5tYWluKTtcbiAgICBlbnRyeVBvaW50c1snbWFpbiddID0gW21haW5QYXRoXTtcbiAgfVxuXG4gIGlmIChpc1BsYXRmb3JtU2VydmVyKSB7XG4gICAgLy8gRml4ZXMgQ3JpdGljYWwgZGVwZW5kZW5jeTogdGhlIHJlcXVlc3Qgb2YgYSBkZXBlbmRlbmN5IGlzIGFuIGV4cHJlc3Npb25cbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgQ29udGV4dFJlcGxhY2VtZW50UGx1Z2luKC9AP2hhcGl8ZXhwcmVzc1tcXFxcL10vKSk7XG4gIH1cblxuICBpZiAocG9seWZpbGxzPy5sZW5ndGgpIHtcbiAgICAvLyBgem9uZS5qcy90ZXN0aW5nYCBpcyBhICoqc3BlY2lhbCoqIHBvbHlmaWxsIGJlY2F1c2Ugd2hlbiBub3QgaW1wb3J0ZWQgaW4gdGhlIG1haW4gaXQgZmFpbHMgd2l0aCB0aGUgYmVsb3cgZXJyb3JzOlxuICAgIC8vIGBFcnJvcjogRXhwZWN0ZWQgdG8gYmUgcnVubmluZyBpbiAnUHJveHlab25lJywgYnV0IGl0IHdhcyBub3QgZm91bmQuYFxuICAgIC8vIFRoaXMgd2FzIGFsc28gdGhlIHJlYXNvbiB3aHkgcHJldmlvdXNseSBpdCB3YXMgaW1wb3J0ZWQgaW4gYHRlc3QudHNgIGFzIHRoZSBmaXJzdCBtb2R1bGUuXG4gICAgLy8gRnJvbSBKaWEgbGk6XG4gICAgLy8gVGhpcyBpcyBiZWNhdXNlIHRoZSBqYXNtaW5lIGZ1bmN0aW9ucyBzdWNoIGFzIGJlZm9yZUVhY2gvaXQgd2lsbCBub3QgYmUgcGF0Y2hlZCBieSB6b25lLmpzIHNpbmNlXG4gICAgLy8gamFzbWluZSB3aWxsIG5vdCBiZSBsb2FkZWQgeWV0LCBzbyB0aGUgUHJveHlab25lIHdpbGwgbm90IGJlIHRoZXJlLiBXZSBoYXZlIHRvIGxvYWQgem9uZS10ZXN0aW5nLmpzIGFmdGVyXG4gICAgLy8gamFzbWluZSBpcyByZWFkeS5cbiAgICAvLyBXZSBjb3VsZCBmb3JjZSBsb2FkaW5nICd6b25lLmpzL3Rlc3RpbmcnIHByaW9yIHRvIGphc21pbmUgYnkgY2hhbmdpbmcgdGhlIG9yZGVyIG9mIHNjcmlwdHMgaW4gJ2thcm1hLWNvbnRleHQuaHRtbCcuXG4gICAgLy8gQnV0IHRoaXMgaGFzIGl0J3Mgb3duIHByb2JsZW1zIGFzIHpvbmUuanMgbmVlZHMgdG8gYmUgbG9hZGVkIHByaW9yIHRvIGphc21pbmUgZHVlIHRvIHBhdGNoaW5nIG9mIHRpbWluZyBmdW5jdGlvbnNcbiAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9qYXNtaW5lL2phc21pbmUvaXNzdWVzLzE5NDRcbiAgICAvLyBUaHVzIHRoZSBjb3JyZWN0IG9yZGVyIGlzIHpvbmUuanMgLT4gamFzbWluZSAtPiB6b25lLmpzL3Rlc3RpbmcuXG4gICAgY29uc3Qgem9uZVRlc3RpbmdFbnRyeVBvaW50ID0gJ3pvbmUuanMvdGVzdGluZyc7XG4gICAgY29uc3QgcG9seWZpbGxzRXhsdWRpbmdab25lVGVzdGluZyA9IHBvbHlmaWxscy5maWx0ZXIoKHApID0+IHAgIT09IHpvbmVUZXN0aW5nRW50cnlQb2ludCk7XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShlbnRyeVBvaW50c1sncG9seWZpbGxzJ10pKSB7XG4gICAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10ucHVzaCguLi5wb2x5ZmlsbHNFeGx1ZGluZ1pvbmVUZXN0aW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gcG9seWZpbGxzRXhsdWRpbmdab25lVGVzdGluZztcbiAgICB9XG5cbiAgICBpZiAocG9seWZpbGxzRXhsdWRpbmdab25lVGVzdGluZy5sZW5ndGggIT09IHBvbHlmaWxscy5sZW5ndGgpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGVudHJ5UG9pbnRzWydtYWluJ10pKSB7XG4gICAgICAgIGVudHJ5UG9pbnRzWydtYWluJ10udW5zaGlmdCh6b25lVGVzdGluZ0VudHJ5UG9pbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW50cnlQb2ludHNbJ21haW4nXSA9IFt6b25lVGVzdGluZ0VudHJ5UG9pbnQsIGVudHJ5UG9pbnRzWydtYWluJ10gYXMgc3RyaW5nXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzKSB7XG4gICAgLy8gV2hlbiB0aGlzIGlzIG5vdCBkZWZpbmVkIGl0IG1lYW5zIHRoZSBidWlsZGVyIGRvZXNuJ3Qgc3VwcG9ydCBzaG93aW5nIGNvbW1vbiBqcyB1c2FnZXMuXG4gICAgLy8gV2hlbiBpdCBkb2VzIGl0IHdpbGwgYmUgYW4gYXJyYXkuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgQ29tbW9uSnNVc2FnZVdhcm5QbHVnaW4oe1xuICAgICAgICBhbGxvd2VkRGVwZW5kZW5jaWVzOiBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgLy8gcHJvY2VzcyBnbG9iYWwgc2NyaXB0c1xuICAvLyBBZGQgYSBuZXcgYXNzZXQgZm9yIGVhY2ggZW50cnkuXG4gIGZvciAoY29uc3QgeyBidW5kbGVOYW1lLCBpbmplY3QsIHBhdGhzIH0gb2YgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZShcbiAgICByb290LFxuICAgIGJ1aWxkT3B0aW9ucy5zY3JpcHRzLFxuICApKSB7XG4gICAgLy8gTGF6eSBzY3JpcHRzIGRvbid0IGdldCBhIGhhc2gsIG90aGVyd2lzZSB0aGV5IGNhbid0IGJlIGxvYWRlZCBieSBuYW1lLlxuICAgIGNvbnN0IGhhc2ggPSBpbmplY3QgPyBoYXNoRm9ybWF0LnNjcmlwdCA6ICcnO1xuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU2NyaXB0c1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICBuYW1lOiBidW5kbGVOYW1lLFxuICAgICAgICBzb3VyY2VNYXA6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICAgIHNjcmlwdHM6IHBhdGhzLFxuICAgICAgICBmaWxlbmFtZTogYCR7cGF0aC5iYXNlbmFtZShidW5kbGVOYW1lKX0ke2hhc2h9LmpzYCxcbiAgICAgICAgYmFzZVBhdGg6IHByb2plY3RSb290LFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgYXNzZXQgZW50cmllc1xuICBpZiAoYnVpbGRPcHRpb25zLmFzc2V0cy5sZW5ndGgpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBDb3B5V2VicGFja1BsdWdpbih7XG4gICAgICAgIHBhdHRlcm5zOiBhc3NldFBhdHRlcm5zKHJvb3QsIGJ1aWxkT3B0aW9ucy5hc3NldHMpLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzKSB7XG4gICAgY29uc3QgTGljZW5zZVdlYnBhY2tQbHVnaW4gPSByZXF1aXJlKCdsaWNlbnNlLXdlYnBhY2stcGx1Z2luJykuTGljZW5zZVdlYnBhY2tQbHVnaW47XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgTGljZW5zZVdlYnBhY2tQbHVnaW4oe1xuICAgICAgICBzdGF0czoge1xuICAgICAgICAgIHdhcm5pbmdzOiBmYWxzZSxcbiAgICAgICAgICBlcnJvcnM6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICBwZXJDaHVua091dHB1dDogZmFsc2UsXG4gICAgICAgIG91dHB1dEZpbGVuYW1lOiAnM3JkcGFydHlsaWNlbnNlcy50eHQnLFxuICAgICAgICBza2lwQ2hpbGRDb21waWxlcnM6IHRydWUsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHNjcmlwdHNTb3VyY2VNYXAgfHwgc3R5bGVzU291cmNlTWFwKSB7XG4gICAgY29uc3QgaW5jbHVkZSA9IFtdO1xuICAgIGlmIChzY3JpcHRzU291cmNlTWFwKSB7XG4gICAgICBpbmNsdWRlLnB1c2goL2pzJC8pO1xuICAgIH1cblxuICAgIGlmIChzdHlsZXNTb3VyY2VNYXApIHtcbiAgICAgIGluY2x1ZGUucHVzaCgvY3NzJC8pO1xuICAgIH1cblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBEZXZUb29sc0lnbm9yZVBsdWdpbigpKTtcblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFNvdXJjZU1hcERldlRvb2xQbHVnaW4oe1xuICAgICAgICBmaWxlbmFtZTogJ1tmaWxlXS5tYXAnLFxuICAgICAgICBpbmNsdWRlLFxuICAgICAgICAvLyBXZSB3YW50IHRvIHNldCBzb3VyY2VSb290IHRvICBgd2VicGFjazovLy9gIGZvciBub25cbiAgICAgICAgLy8gaW5saW5lIHNvdXJjZW1hcHMgYXMgb3RoZXJ3aXNlIHBhdGhzIHRvIHNvdXJjZW1hcHMgd2lsbCBiZSBicm9rZW4gaW4gYnJvd3NlclxuICAgICAgICAvLyBgd2VicGFjazovLy9gIGlzIG5lZWRlZCBmb3IgVmlzdWFsIFN0dWRpbyBicmVha3BvaW50cyB0byB3b3JrIHByb3Blcmx5IGFzIGN1cnJlbnRseVxuICAgICAgICAvLyB0aGVyZSBpcyBubyB3YXkgdG8gc2V0IHRoZSAnd2ViUm9vdCdcbiAgICAgICAgc291cmNlUm9vdDogJ3dlYnBhY2s6Ly8vJyxcbiAgICAgICAgbW9kdWxlRmlsZW5hbWVUZW1wbGF0ZTogJ1tyZXNvdXJjZS1wYXRoXScsXG4gICAgICAgIGFwcGVuZDogaGlkZGVuU291cmNlTWFwID8gZmFsc2UgOiB1bmRlZmluZWQsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHZlcmJvc2UpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgV2F0Y2hGaWxlc0xvZ3NQbHVnaW4oKSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnN0YXRzSnNvbikge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IEpzb25TdGF0c1BsdWdpbihwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm91dHB1dFBhdGgsICdzdGF0cy5qc29uJykpLFxuICAgICk7XG4gIH1cblxuICBpZiAoc3VicmVzb3VyY2VJbnRlZ3JpdHkpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBTdWJyZXNvdXJjZUludGVncml0eVBsdWdpbih7XG4gICAgICAgIGhhc2hGdW5jTmFtZXM6IFsnc2hhMzg0J10sXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHNjcmlwdHNTb3VyY2VNYXAgfHwgc3R5bGVzU291cmNlTWFwKSB7XG4gICAgZXh0cmFSdWxlcy5wdXNoKHtcbiAgICAgIHRlc3Q6IC9cXC5bY21dP2pzeD8kLyxcbiAgICAgIGVuZm9yY2U6ICdwcmUnLFxuICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3NvdXJjZS1tYXAtbG9hZGVyJyksXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGZpbHRlclNvdXJjZU1hcHBpbmdVcmw6IChfbWFwVXJpOiBzdHJpbmcsIHJlc291cmNlUGF0aDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgaWYgKHZlbmRvclNvdXJjZU1hcCkge1xuICAgICAgICAgICAgLy8gQ29uc3VtZSBhbGwgc291cmNlbWFwcyB3aGVuIHZlbmRvciBvcHRpb24gaXMgZW5hYmxlZC5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIERvbid0IGNvbnN1bWUgc291cmNlbWFwcyBpbiBub2RlX21vZHVsZXMgd2hlbiB2ZW5kb3IgaXMgZGlzYWJsZWQuXG4gICAgICAgICAgLy8gQnV0LCBkbyBjb25zdW1lIGxvY2FsIGxpYnJhcmllcyBzb3VyY2VtYXBzLlxuICAgICAgICAgIHJldHVybiAhcmVzb3VyY2VQYXRoLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBpZiAobWFpbiB8fCBwb2x5ZmlsbHMpIHtcbiAgICBleHRyYVJ1bGVzLnB1c2goe1xuICAgICAgdGVzdDogdHNDb25maWcub3B0aW9ucy5hbGxvd0pzID8gL1xcLltjbV0/W3RqXXN4PyQvIDogL1xcLltjbV0/dHN4PyQvLFxuICAgICAgbG9hZGVyOiBBbmd1bGFyV2VicGFja0xvYWRlclBhdGgsXG4gICAgICAvLyBUaGUgYmVsb3cgYXJlIGtub3duIHBhdGhzIHRoYXQgYXJlIG5vdCBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uIGV2ZW4gd2hlbiBhbGxvd0pzIGlzIGVuYWJsZWQuXG4gICAgICBleGNsdWRlOiBbXG4gICAgICAgIC9bXFxcXC9dbm9kZV9tb2R1bGVzWy9cXFxcXSg/OmNzcy1sb2FkZXJ8bWluaS1jc3MtZXh0cmFjdC1wbHVnaW58d2VicGFjay1kZXYtc2VydmVyfHdlYnBhY2spWy9cXFxcXS8sXG4gICAgICBdLFxuICAgIH0pO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGNyZWF0ZUl2eVBsdWdpbih3Y28sIGFvdCwgdHNDb25maWdQYXRoKSk7XG4gIH1cblxuICBpZiAod2ViV29ya2VyVHNDb25maWcpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChjcmVhdGVJdnlQbHVnaW4od2NvLCBmYWxzZSwgcGF0aC5yZXNvbHZlKHdjby5yb290LCB3ZWJXb3JrZXJUc0NvbmZpZykpKTtcbiAgfVxuXG4gIGNvbnN0IGV4dHJhTWluaW1pemVycyA9IFtdO1xuICBpZiAoc2NyaXB0c09wdGltaXphdGlvbikge1xuICAgIGV4dHJhTWluaW1pemVycy5wdXNoKFxuICAgICAgbmV3IEphdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW4oe1xuICAgICAgICBkZWZpbmU6IGJ1aWxkT3B0aW9ucy5hb3QgPyBHTE9CQUxfREVGU19GT1JfVEVSU0VSX1dJVEhfQU9UIDogR0xPQkFMX0RFRlNfRk9SX1RFUlNFUixcbiAgICAgICAgc291cmNlbWFwOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgICBzdXBwb3J0ZWRCcm93c2VyczogYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICBrZWVwSWRlbnRpZmllck5hbWVzOiAhYWxsb3dNYW5nbGUgfHwgaXNQbGF0Zm9ybVNlcnZlcixcbiAgICAgICAga2VlcE5hbWVzOiBpc1BsYXRmb3JtU2VydmVyLFxuICAgICAgICByZW1vdmVMaWNlbnNlczogYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcyxcbiAgICAgICAgYWR2YW5jZWQ6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAocGxhdGZvcm0gPT09ICdicm93c2VyJyAmJiAoc2NyaXB0c09wdGltaXphdGlvbiB8fCBzdHlsZXNPcHRpbWl6YXRpb24ubWluaWZ5KSkge1xuICAgIGV4dHJhTWluaW1pemVycy5wdXNoKG5ldyBUcmFuc2ZlclNpemVQbHVnaW4oKSk7XG4gIH1cblxuICBsZXQgY3Jvc3NPcmlnaW5Mb2FkaW5nOiBOb25OdWxsYWJsZTxDb25maWd1cmF0aW9uWydvdXRwdXQnXT5bJ2Nyb3NzT3JpZ2luTG9hZGluZyddID0gZmFsc2U7XG4gIGlmIChzdWJyZXNvdXJjZUludGVncml0eSAmJiBjcm9zc09yaWdpbiA9PT0gJ25vbmUnKSB7XG4gICAgY3Jvc3NPcmlnaW5Mb2FkaW5nID0gJ2Fub255bW91cyc7XG4gIH0gZWxzZSBpZiAoY3Jvc3NPcmlnaW4gIT09ICdub25lJykge1xuICAgIGNyb3NzT3JpZ2luTG9hZGluZyA9IGNyb3NzT3JpZ2luO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBtb2RlOiBzY3JpcHRzT3B0aW1pemF0aW9uIHx8IHN0eWxlc09wdGltaXphdGlvbi5taW5pZnkgPyAncHJvZHVjdGlvbicgOiAnZGV2ZWxvcG1lbnQnLFxuICAgIGRldnRvb2w6IGZhbHNlLFxuICAgIHRhcmdldDogW2lzUGxhdGZvcm1TZXJ2ZXIgPyAnbm9kZScgOiAnd2ViJywgJ2VzMjAxNSddLFxuICAgIHByb2ZpbGU6IGJ1aWxkT3B0aW9ucy5zdGF0c0pzb24sXG4gICAgcmVzb2x2ZToge1xuICAgICAgcm9vdHM6IFtwcm9qZWN0Um9vdF0sXG4gICAgICBleHRlbnNpb25zOiBbJy50cycsICcudHN4JywgJy5tanMnLCAnLmpzJ10sXG4gICAgICBzeW1saW5rczogIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgbW9kdWxlczogW3RzQ29uZmlnLm9wdGlvbnMuYmFzZVVybCB8fCBwcm9qZWN0Um9vdCwgJ25vZGVfbW9kdWxlcyddLFxuICAgICAgbWFpbkZpZWxkczogaXNQbGF0Zm9ybVNlcnZlclxuICAgICAgICA/IFsnZXMyMDIwJywgJ2VzMjAxNScsICdtb2R1bGUnLCAnbWFpbiddXG4gICAgICAgIDogWydlczIwMjAnLCAnZXMyMDE1JywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICAgIGNvbmRpdGlvbk5hbWVzOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnLi4uJ10sXG4gICAgfSxcbiAgICByZXNvbHZlTG9hZGVyOiB7XG4gICAgICBzeW1saW5rczogIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIH0sXG4gICAgY29udGV4dDogcm9vdCxcbiAgICBlbnRyeTogZW50cnlQb2ludHMsXG4gICAgZXh0ZXJuYWxzOiBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBvdXRwdXQ6IHtcbiAgICAgIHVuaXF1ZU5hbWU6IHByb2plY3ROYW1lLFxuICAgICAgaGFzaEZ1bmN0aW9uOiAneHhoYXNoNjQnLCAvLyB0b2RvOiByZW1vdmUgaW4gd2VicGFjayA2LiBUaGlzIGlzIHBhcnQgb2YgYGZ1dHVyZURlZmF1bHRzYC5cbiAgICAgIGNsZWFuOiBidWlsZE9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aCA/PyB0cnVlLFxuICAgICAgcGF0aDogcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoKSxcbiAgICAgIHB1YmxpY1BhdGg6IGJ1aWxkT3B0aW9ucy5kZXBsb3lVcmwgPz8gJycsXG4gICAgICBmaWxlbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5jaHVua30uanNgLFxuICAgICAgY2h1bmtGaWxlbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5jaHVua30uanNgLFxuICAgICAgbGlicmFyeVRhcmdldDogaXNQbGF0Zm9ybVNlcnZlciA/ICdjb21tb25qcycgOiB1bmRlZmluZWQsXG4gICAgICBjcm9zc09yaWdpbkxvYWRpbmcsXG4gICAgICB0cnVzdGVkVHlwZXM6ICdhbmd1bGFyI2J1bmRsZXInLFxuICAgICAgc2NyaXB0VHlwZTogJ21vZHVsZScsXG4gICAgfSxcbiAgICB3YXRjaDogYnVpbGRPcHRpb25zLndhdGNoLFxuICAgIHdhdGNoT3B0aW9uczoge1xuICAgICAgcG9sbCxcbiAgICAgIC8vIFRoZSBiZWxvdyBpcyBuZWVkZWQgYXMgd2hlbiBwcmVzZXJ2ZVN5bWxpbmtzIGlzIGVuYWJsZWQgd2UgZGlzYWJsZSBgcmVzb2x2ZS5zeW1saW5rc2AuXG4gICAgICBmb2xsb3dTeW1saW5rczogYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICBpZ25vcmVkOiBwb2xsID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiAnKiovbm9kZV9tb2R1bGVzLyoqJyxcbiAgICB9LFxuICAgIHNuYXBzaG90OiB7XG4gICAgICBtb2R1bGU6IHtcbiAgICAgICAgLy8gVXNlIGhhc2ggb2YgY29udGVudCBpbnN0ZWFkIG9mIHRpbWVzdGFtcCBiZWNhdXNlIHRoZSB0aW1lc3RhbXAgb2YgdGhlIHN5bWxpbmsgd2lsbCBiZSB1c2VkXG4gICAgICAgIC8vIGluc3RlYWQgb2YgdGhlIHJlZmVyZW5jZWQgZmlsZXMgd2hpY2ggY2F1c2VzIGNoYW5nZXMgaW4gc3ltbGlua3Mgbm90IHRvIGJlIHBpY2tlZCB1cC5cbiAgICAgICAgaGFzaDogYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICB9LFxuICAgIH0sXG4gICAgcGVyZm9ybWFuY2U6IHtcbiAgICAgIGhpbnRzOiBmYWxzZSxcbiAgICB9LFxuICAgIGlnbm9yZVdhcm5pbmdzOiBbXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3NvdXJjZS1tYXAtbG9hZGVyL2Jsb2IvYjJkZTQyNDljNzQzMWRkODQzMmRhNjA3ZTA4ZjBmNjVlOWQ2NDIxOS9zcmMvaW5kZXguanMjTDgzXG4gICAgICAvRmFpbGVkIHRvIHBhcnNlIHNvdXJjZSBtYXAgZnJvbS8sXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3Bvc3Rjc3MtbG9hZGVyL2Jsb2IvYmQyNjE4NzVmZGY5YzU5NmFmNGZmYjNhMWE3M2ZlM2M1NDliZWZkYS9zcmMvaW5kZXguanMjTDE1My1MMTU4XG4gICAgICAvQWRkIHBvc3Rjc3MgYXMgcHJvamVjdCBkZXBlbmRlbmN5LyxcbiAgICAgIC8vIGVzYnVpbGQgd2lsbCBpc3N1ZSBhIHdhcm5pbmcsIHdoaWxlIHN0aWxsIGhvaXN0cyB0aGUgQGNoYXJzZXQgYXQgdGhlIHZlcnkgdG9wLlxuICAgICAgLy8gVGhpcyBpcyBjYXVzZWQgYnkgYSBidWcgaW4gY3NzLWxvYWRlciBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL2Nzcy1sb2FkZXIvaXNzdWVzLzEyMTJcbiAgICAgIC9cIkBjaGFyc2V0XCIgbXVzdCBiZSB0aGUgZmlyc3QgcnVsZSBpbiB0aGUgZmlsZS8sXG4gICAgXSxcbiAgICBtb2R1bGU6IHtcbiAgICAgIC8vIFNob3cgYW4gZXJyb3IgZm9yIG1pc3NpbmcgZXhwb3J0cyBpbnN0ZWFkIG9mIGEgd2FybmluZy5cbiAgICAgIHN0cmljdEV4cG9ydFByZXNlbmNlOiB0cnVlLFxuICAgICAgcGFyc2VyOiB7XG4gICAgICAgIGphdmFzY3JpcHQ6IHtcbiAgICAgICAgICByZXF1aXJlQ29udGV4dDogZmFsc2UsXG4gICAgICAgICAgLy8gRGlzYWJsZSBhdXRvIFVSTCBhc3NldCBtb2R1bGUgY3JlYXRpb24uIFRoaXMgZG9lc24ndCBlZmZlY3QgYG5ldyBXb3JrZXIobmV3IFVSTCguLi4pKWBcbiAgICAgICAgICAvLyBodHRwczovL3dlYnBhY2suanMub3JnL2d1aWRlcy9hc3NldC1tb2R1bGVzLyN1cmwtYXNzZXRzXG4gICAgICAgICAgdXJsOiBmYWxzZSxcbiAgICAgICAgICB3b3JrZXI6ICEhd2ViV29ya2VyVHNDb25maWcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC4/KHN2Z3xodG1sKSQvLFxuICAgICAgICAgIC8vIE9ubHkgcHJvY2VzcyBIVE1MIGFuZCBTVkcgd2hpY2ggYXJlIGtub3duIEFuZ3VsYXIgY29tcG9uZW50IHJlc291cmNlcy5cbiAgICAgICAgICByZXNvdXJjZVF1ZXJ5OiAvXFw/bmdSZXNvdXJjZS8sXG4gICAgICAgICAgdHlwZTogJ2Fzc2V0L3NvdXJjZScsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBNYXJrIGZpbGVzIGluc2lkZSBgcnhqcy9hZGRgIGFzIGNvbnRhaW5pbmcgc2lkZSBlZmZlY3RzLlxuICAgICAgICAgIC8vIElmIHRoaXMgaXMgZml4ZWQgdXBzdHJlYW0gYW5kIHRoZSBmaXhlZCB2ZXJzaW9uIGJlY29tZXMgdGhlIG1pbmltdW1cbiAgICAgICAgICAvLyBzdXBwb3J0ZWQgdmVyc2lvbiwgdGhpcyBjYW4gYmUgcmVtb3ZlZC5cbiAgICAgICAgICB0ZXN0OiAvWy9cXFxcXXJ4anNbL1xcXFxdYWRkWy9cXFxcXS4rXFwuanMkLyxcbiAgICAgICAgICBzaWRlRWZmZWN0czogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5bY21dP1t0al1zeD8kLyxcbiAgICAgICAgICAvLyBUaGUgYmVsb3cgaXMgbmVlZGVkIGR1ZSB0byBhIGJ1ZyBpbiBgQGJhYmVsL3J1bnRpbWVgLiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9iYWJlbC9iYWJlbC9pc3N1ZXMvMTI4MjRcbiAgICAgICAgICByZXNvbHZlOiB7IGZ1bGx5U3BlY2lmaWVkOiBmYWxzZSB9LFxuICAgICAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgICAgIC9bXFxcXC9dbm9kZV9tb2R1bGVzWy9cXFxcXSg/OmNvcmUtanN8QGJhYmVsfHRzbGlifHdlYi1hbmltYXRpb25zLWpzfHdlYi1zdHJlYW1zLXBvbHlmaWxsfHdoYXR3Zy11cmwpWy9cXFxcXS8sXG4gICAgICAgICAgXSxcbiAgICAgICAgICB1c2U6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJy4uLy4uL2JhYmVsL3dlYnBhY2stbG9hZGVyJyksXG4gICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICBjYWNoZURpcmVjdG9yeTogKGNhY2hlLmVuYWJsZWQgJiYgcGF0aC5qb2luKGNhY2hlLnBhdGgsICdiYWJlbC13ZWJwYWNrJykpIHx8IGZhbHNlLFxuICAgICAgICAgICAgICAgIGFvdDogYnVpbGRPcHRpb25zLmFvdCxcbiAgICAgICAgICAgICAgICBvcHRpbWl6ZTogYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyLFxuICAgICAgICAgICAgICAgIHN1cHBvcnRlZEJyb3dzZXJzOiBidWlsZE9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICAgICAgICAgICAgaW5zdHJ1bWVudENvZGU6IGNvZGVDb3ZlcmFnZVxuICAgICAgICAgICAgICAgICAgPyB7XG4gICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWRCYXNlUGF0aDogc291cmNlUm9vdCA/PyBwcm9qZWN0Um9vdCxcbiAgICAgICAgICAgICAgICAgICAgICBleGNsdWRlZFBhdGhzOiBnZXRJbnN0cnVtZW50YXRpb25FeGNsdWRlZFBhdGhzKHJvb3QsIGNvZGVDb3ZlcmFnZUV4Y2x1ZGUpLFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgfSBhcyBBbmd1bGFyQmFiZWxMb2FkZXJPcHRpb25zLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICAuLi5leHRyYVJ1bGVzLFxuICAgICAgXSxcbiAgICB9LFxuICAgIGV4cGVyaW1lbnRzOiB7XG4gICAgICBiYWNrQ29tcGF0OiBmYWxzZSxcbiAgICAgIHN5bmNXZWJBc3NlbWJseTogdHJ1ZSxcbiAgICAgIGFzeW5jV2ViQXNzZW1ibHk6IHRydWUsXG4gICAgfSxcbiAgICBpbmZyYXN0cnVjdHVyZUxvZ2dpbmc6IHtcbiAgICAgIGRlYnVnOiB2ZXJib3NlLFxuICAgICAgbGV2ZWw6IHZlcmJvc2UgPyAndmVyYm9zZScgOiAnZXJyb3InLFxuICAgIH0sXG4gICAgc3RhdHM6IGdldFN0YXRzT3B0aW9ucyh2ZXJib3NlKSxcbiAgICBjYWNoZTogZ2V0Q2FjaGVTZXR0aW5ncyh3Y28sIE5HX1ZFUlNJT04uZnVsbCksXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICBtaW5pbWl6ZXI6IGV4dHJhTWluaW1pemVycyxcbiAgICAgIG1vZHVsZUlkczogJ2RldGVybWluaXN0aWMnLFxuICAgICAgY2h1bmtJZHM6IGJ1aWxkT3B0aW9ucy5uYW1lZENodW5rcyA/ICduYW1lZCcgOiAnZGV0ZXJtaW5pc3RpYycsXG4gICAgICBlbWl0T25FcnJvcnM6IGZhbHNlLFxuICAgICAgcnVudGltZUNodW5rOiBpc1BsYXRmb3JtU2VydmVyID8gZmFsc2UgOiAnc2luZ2xlJyxcbiAgICAgIHNwbGl0Q2h1bmtzOiB7XG4gICAgICAgIG1heEFzeW5jUmVxdWVzdHM6IEluZmluaXR5LFxuICAgICAgICBjYWNoZUdyb3Vwczoge1xuICAgICAgICAgIGRlZmF1bHQ6ICEhY29tbW9uQ2h1bmsgJiYge1xuICAgICAgICAgICAgY2h1bmtzOiAnYXN5bmMnLFxuICAgICAgICAgICAgbWluQ2h1bmtzOiAyLFxuICAgICAgICAgICAgcHJpb3JpdHk6IDEwLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29tbW9uOiAhIWNvbW1vbkNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21tb24nLFxuICAgICAgICAgICAgY2h1bmtzOiAnYXN5bmMnLFxuICAgICAgICAgICAgbWluQ2h1bmtzOiAyLFxuICAgICAgICAgICAgZW5mb3JjZTogdHJ1ZSxcbiAgICAgICAgICAgIHByaW9yaXR5OiA1LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdmVuZG9yczogZmFsc2UsXG4gICAgICAgICAgZGVmYXVsdFZlbmRvcnM6ICEhdmVuZG9yQ2h1bmsgJiYge1xuICAgICAgICAgICAgbmFtZTogJ3ZlbmRvcicsXG4gICAgICAgICAgICBjaHVua3M6IChjaHVuaykgPT4gY2h1bmsubmFtZSA9PT0gJ21haW4nLFxuICAgICAgICAgICAgZW5mb3JjZTogdHJ1ZSxcbiAgICAgICAgICAgIHRlc3Q6IFZFTkRPUlNfVEVTVCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIHBsdWdpbnM6IFtuZXcgTmFtZWRDaHVua3NQbHVnaW4oKSwgbmV3IERlZHVwZU1vZHVsZVJlc29sdmVQbHVnaW4oeyB2ZXJib3NlIH0pLCAuLi5leHRyYVBsdWdpbnNdLFxuICAgIG5vZGU6IGZhbHNlLFxuICB9O1xufVxuIl19