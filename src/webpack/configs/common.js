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
    if (!isPlatformServer) {
        if (buildOptions.polyfills) {
            const projectPolyfills = path.resolve(root, buildOptions.polyfills);
            if (entryPoints['polyfills']) {
                entryPoints['polyfills'].push(projectPolyfills);
            }
            else {
                entryPoints['polyfills'] = [projectPolyfills];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhDQUE0RDtBQUM1RCw4RUFBb0Q7QUFDcEQsMkNBQTZCO0FBQzdCLHFDQU1pQjtBQUNqQixpRkFBMkU7QUFHM0UseUVBQThEO0FBQzlELG1EQUFxRDtBQUNyRCx3Q0FNb0I7QUFDcEIsOEVBQXlFO0FBQ3pFLHdFQUFtRTtBQUNuRSxnRUFBNEQ7QUFDNUQsMEVBQXFFO0FBQ3JFLHNEQUF3RDtBQUN4RCxnRkFBMEU7QUFDMUUsOENBTzBCO0FBRTFCLE1BQU0sWUFBWSxHQUFHLHdCQUF3QixDQUFDO0FBRTlDLGtEQUFrRDtBQUMzQyxLQUFLLFVBQVUsZUFBZSxDQUFDLEdBQXlCOztJQUM3RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ2pHLE1BQU0sRUFDSixLQUFLLEVBQ0wsWUFBWSxFQUNaLFdBQVcsR0FBRyxNQUFNLEVBQ3BCLFFBQVEsR0FBRyxTQUFTLEVBQ3BCLEdBQUcsR0FBRyxJQUFJLEVBQ1YsbUJBQW1CLEdBQUcsRUFBRSxFQUN4QixJQUFJLEVBQ0osU0FBUyxFQUNULFNBQVMsRUFBRSxFQUNULE1BQU0sRUFBRSxlQUFlLEVBQ3ZCLE9BQU8sRUFBRSxnQkFBZ0IsRUFDekIsTUFBTSxFQUFFLGVBQWUsRUFDdkIsTUFBTSxFQUFFLGVBQWUsR0FDeEIsRUFDRCxZQUFZLEVBQUUsRUFBRSxNQUFNLEVBQUUsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixF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QUFFLENBQUM7d0JBQ1osT0FBTyxFQUFFLElBQUk7d0JBQ2IsUUFBUSxFQUFFLENBQUM7cUJBQ1o7b0JBQ0QsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsY0FBYyxFQUFFLENBQUMsQ0FBQyxXQUFXLElBQUk7d0JBQy9CLElBQUksRUFBRSxRQUFRO3dCQUNkLE1BQU0sRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxNQUFNO3dCQUN4QyxPQUFPLEVBQUUsSUFBSTt3QkFDYixJQUFJLEVBQUUsWUFBWTtxQkFDbkI7aUJBQ0Y7YUFDRjtTQUNGO1FBQ0QsT0FBTyxFQUFFLENBQUMsSUFBSSx1Q0FBaUIsRUFBRSxFQUFFLElBQUksbUNBQXlCLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLEdBQUcsWUFBWSxDQUFDO1FBQy9GLElBQUksRUFBRSxLQUFLO0tBQ1osQ0FBQztBQUNKLENBQUM7QUF0WUQsMENBc1lDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEFuZ3VsYXJXZWJwYWNrTG9hZGVyUGF0aCB9IGZyb20gJ0BuZ3Rvb2xzL3dlYnBhY2snO1xuaW1wb3J0IENvcHlXZWJwYWNrUGx1Z2luIGZyb20gJ2NvcHktd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7XG4gIENvbXBpbGVyLFxuICBDb25maWd1cmF0aW9uLFxuICBDb250ZXh0UmVwbGFjZW1lbnRQbHVnaW4sXG4gIFJ1bGVTZXRSdWxlLFxuICBTb3VyY2VNYXBEZXZUb29sUGx1Z2luLFxufSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IFN1YnJlc291cmNlSW50ZWdyaXR5UGx1Z2luIH0gZnJvbSAnd2VicGFjay1zdWJyZXNvdXJjZS1pbnRlZ3JpdHknO1xuaW1wb3J0IHsgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucyB9IGZyb20gJy4uLy4uL2JhYmVsL3dlYnBhY2stbG9hZGVyJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBhbGxvd01hbmdsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcbmltcG9ydCB7XG4gIENvbW1vbkpzVXNhZ2VXYXJuUGx1Z2luLFxuICBEZWR1cGVNb2R1bGVSZXNvbHZlUGx1Z2luLFxuICBKYXZhU2NyaXB0T3B0aW1pemVyUGx1Z2luLFxuICBKc29uU3RhdHNQbHVnaW4sXG4gIFNjcmlwdHNXZWJwYWNrUGx1Z2luLFxufSBmcm9tICcuLi9wbHVnaW5zJztcbmltcG9ydCB7IERldlRvb2xzSWdub3JlUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy9kZXZ0b29scy1pZ25vcmUtcGx1Z2luJztcbmltcG9ydCB7IE5hbWVkQ2h1bmtzUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy9uYW1lZC1jaHVua3MtcGx1Z2luJztcbmltcG9ydCB7IFByb2dyZXNzUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy9wcm9ncmVzcy1wbHVnaW4nO1xuaW1wb3J0IHsgVHJhbnNmZXJTaXplUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy90cmFuc2Zlci1zaXplLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVJdnlQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3R5cGVzY3JpcHQnO1xuaW1wb3J0IHsgV2F0Y2hGaWxlc0xvZ3NQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3dhdGNoLWZpbGVzLWxvZ3MtcGx1Z2luJztcbmltcG9ydCB7XG4gIGFzc2V0UGF0dGVybnMsXG4gIGdldENhY2hlU2V0dGluZ3MsXG4gIGdldEluc3RydW1lbnRhdGlvbkV4Y2x1ZGVkUGF0aHMsXG4gIGdldE91dHB1dEhhc2hGb3JtYXQsXG4gIGdldFN0YXRzT3B0aW9ucyxcbiAgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZSxcbn0gZnJvbSAnLi4vdXRpbHMvaGVscGVycyc7XG5cbmNvbnN0IFZFTkRPUlNfVEVTVCA9IC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS87XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q29tbW9uQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpOiBQcm9taXNlPENvbmZpZ3VyYXRpb24+IHtcbiAgY29uc3QgeyByb290LCBwcm9qZWN0Um9vdCwgYnVpbGRPcHRpb25zLCB0c0NvbmZpZywgcHJvamVjdE5hbWUsIHNvdXJjZVJvb3QsIHRzQ29uZmlnUGF0aCB9ID0gd2NvO1xuICBjb25zdCB7XG4gICAgY2FjaGUsXG4gICAgY29kZUNvdmVyYWdlLFxuICAgIGNyb3NzT3JpZ2luID0gJ25vbmUnLFxuICAgIHBsYXRmb3JtID0gJ2Jyb3dzZXInLFxuICAgIGFvdCA9IHRydWUsXG4gICAgY29kZUNvdmVyYWdlRXhjbHVkZSA9IFtdLFxuICAgIG1haW4sXG4gICAgcG9seWZpbGxzLFxuICAgIHNvdXJjZU1hcDoge1xuICAgICAgc3R5bGVzOiBzdHlsZXNTb3VyY2VNYXAsXG4gICAgICBzY3JpcHRzOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgdmVuZG9yOiB2ZW5kb3JTb3VyY2VNYXAsXG4gICAgICBoaWRkZW46IGhpZGRlblNvdXJjZU1hcCxcbiAgICB9LFxuICAgIG9wdGltaXphdGlvbjogeyBzdHlsZXM6IHN0eWxlc09wdGltaXphdGlvbiwgc2NyaXB0czogc2NyaXB0c09wdGltaXphdGlvbiB9LFxuICAgIGNvbW1vbkNodW5rLFxuICAgIHZlbmRvckNodW5rLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIHZlcmJvc2UsXG4gICAgcG9sbCxcbiAgICB3ZWJXb3JrZXJUc0NvbmZpZyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyA9IFtdLFxuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgfSA9IGJ1aWxkT3B0aW9ucztcblxuICBjb25zdCBpc1BsYXRmb3JtU2VydmVyID0gYnVpbGRPcHRpb25zLnBsYXRmb3JtID09PSAnc2VydmVyJztcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiB7IGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcik6IHZvaWQgfVtdID0gW107XG4gIGNvbnN0IGV4dHJhUnVsZXM6IFJ1bGVTZXRSdWxlW10gPSBbXTtcbiAgY29uc3QgZW50cnlQb2ludHM6IHsgW2tleTogc3RyaW5nXTogW3N0cmluZywgLi4uc3RyaW5nW11dIH0gPSB7fTtcblxuICAvLyBMb2FkIEVTTSBgQGFuZ3VsYXIvY29tcGlsZXItY2xpYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICBjb25zdCB7XG4gICAgR0xPQkFMX0RFRlNfRk9SX1RFUlNFUixcbiAgICBHTE9CQUxfREVGU19GT1JfVEVSU0VSX1dJVEhfQU9ULFxuICAgIFZFUlNJT046IE5HX1ZFUlNJT04sXG4gIH0gPSBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpPignQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk7XG5cbiAgLy8gZGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0XG4gIGNvbnN0IGhhc2hGb3JtYXQgPSBnZXRPdXRwdXRIYXNoRm9ybWF0KGJ1aWxkT3B0aW9ucy5vdXRwdXRIYXNoaW5nKTtcblxuICBpZiAoYnVpbGRPcHRpb25zLnByb2dyZXNzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFByb2dyZXNzUGx1Z2luKHBsYXRmb3JtKSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLm1haW4pIHtcbiAgICBjb25zdCBtYWluUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMubWFpbik7XG4gICAgZW50cnlQb2ludHNbJ21haW4nXSA9IFttYWluUGF0aF07XG4gIH1cblxuICBpZiAoaXNQbGF0Zm9ybVNlcnZlcikge1xuICAgIC8vIEZpeGVzIENyaXRpY2FsIGRlcGVuZGVuY3k6IHRoZSByZXF1ZXN0IG9mIGEgZGVwZW5kZW5jeSBpcyBhbiBleHByZXNzaW9uXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IENvbnRleHRSZXBsYWNlbWVudFBsdWdpbigvQD9oYXBpfGV4cHJlc3NbXFxcXC9dLykpO1xuICB9XG5cbiAgaWYgKCFpc1BsYXRmb3JtU2VydmVyKSB7XG4gICAgaWYgKGJ1aWxkT3B0aW9ucy5wb2x5ZmlsbHMpIHtcbiAgICAgIGNvbnN0IHByb2plY3RQb2x5ZmlsbHMgPSBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLnBvbHlmaWxscyk7XG4gICAgICBpZiAoZW50cnlQb2ludHNbJ3BvbHlmaWxscyddKSB7XG4gICAgICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXS5wdXNoKHByb2plY3RQb2x5ZmlsbHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gW3Byb2plY3RQb2x5ZmlsbHNdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMpIHtcbiAgICAvLyBXaGVuIHRoaXMgaXMgbm90IGRlZmluZWQgaXQgbWVhbnMgdGhlIGJ1aWxkZXIgZG9lc24ndCBzdXBwb3J0IHNob3dpbmcgY29tbW9uIGpzIHVzYWdlcy5cbiAgICAvLyBXaGVuIGl0IGRvZXMgaXQgd2lsbCBiZSBhbiBhcnJheS5cbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBDb21tb25Kc1VzYWdlV2FyblBsdWdpbih7XG4gICAgICAgIGFsbG93ZWREZXBlbmRlbmNpZXM6IGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICAvLyBwcm9jZXNzIGdsb2JhbCBzY3JpcHRzXG4gIC8vIEFkZCBhIG5ldyBhc3NldCBmb3IgZWFjaCBlbnRyeS5cbiAgZm9yIChjb25zdCB7IGJ1bmRsZU5hbWUsIGluamVjdCwgcGF0aHMgfSBvZiBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lKFxuICAgIHJvb3QsXG4gICAgYnVpbGRPcHRpb25zLnNjcmlwdHMsXG4gICkpIHtcbiAgICAvLyBMYXp5IHNjcmlwdHMgZG9uJ3QgZ2V0IGEgaGFzaCwgb3RoZXJ3aXNlIHRoZXkgY2FuJ3QgYmUgbG9hZGVkIGJ5IG5hbWUuXG4gICAgY29uc3QgaGFzaCA9IGluamVjdCA/IGhhc2hGb3JtYXQuc2NyaXB0IDogJyc7XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBTY3JpcHRzV2VicGFja1BsdWdpbih7XG4gICAgICAgIG5hbWU6IGJ1bmRsZU5hbWUsXG4gICAgICAgIHNvdXJjZU1hcDogc2NyaXB0c1NvdXJjZU1hcCxcbiAgICAgICAgc2NyaXB0czogcGF0aHMsXG4gICAgICAgIGZpbGVuYW1lOiBgJHtwYXRoLmJhc2VuYW1lKGJ1bmRsZU5hbWUpfSR7aGFzaH0uanNgLFxuICAgICAgICBiYXNlUGF0aDogcHJvamVjdFJvb3QsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgLy8gcHJvY2VzcyBhc3NldCBlbnRyaWVzXG4gIGlmIChidWlsZE9wdGlvbnMuYXNzZXRzLmxlbmd0aCkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IENvcHlXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgcGF0dGVybnM6IGFzc2V0UGF0dGVybnMocm9vdCwgYnVpbGRPcHRpb25zLmFzc2V0cyksXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5leHRyYWN0TGljZW5zZXMpIHtcbiAgICBjb25zdCBMaWNlbnNlV2VicGFja1BsdWdpbiA9IHJlcXVpcmUoJ2xpY2Vuc2Utd2VicGFjay1wbHVnaW4nKS5MaWNlbnNlV2VicGFja1BsdWdpbjtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBMaWNlbnNlV2VicGFja1BsdWdpbih7XG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgd2FybmluZ3M6IGZhbHNlLFxuICAgICAgICAgIGVycm9yczogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIHBlckNodW5rT3V0cHV0OiBmYWxzZSxcbiAgICAgICAgb3V0cHV0RmlsZW5hbWU6ICczcmRwYXJ0eWxpY2Vuc2VzLnR4dCcsXG4gICAgICAgIHNraXBDaGlsZENvbXBpbGVyczogdHJ1ZSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoc2NyaXB0c1NvdXJjZU1hcCB8fCBzdHlsZXNTb3VyY2VNYXApIHtcbiAgICBjb25zdCBpbmNsdWRlID0gW107XG4gICAgaWYgKHNjcmlwdHNTb3VyY2VNYXApIHtcbiAgICAgIGluY2x1ZGUucHVzaCgvanMkLyk7XG4gICAgfVxuXG4gICAgaWYgKHN0eWxlc1NvdXJjZU1hcCkge1xuICAgICAgaW5jbHVkZS5wdXNoKC9jc3MkLyk7XG4gICAgfVxuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IERldlRvb2xzSWdub3JlUGx1Z2luKCkpO1xuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU291cmNlTWFwRGV2VG9vbFBsdWdpbih7XG4gICAgICAgIGZpbGVuYW1lOiAnW2ZpbGVdLm1hcCcsXG4gICAgICAgIGluY2x1ZGUsXG4gICAgICAgIC8vIFdlIHdhbnQgdG8gc2V0IHNvdXJjZVJvb3QgdG8gIGB3ZWJwYWNrOi8vL2AgZm9yIG5vblxuICAgICAgICAvLyBpbmxpbmUgc291cmNlbWFwcyBhcyBvdGhlcndpc2UgcGF0aHMgdG8gc291cmNlbWFwcyB3aWxsIGJlIGJyb2tlbiBpbiBicm93c2VyXG4gICAgICAgIC8vIGB3ZWJwYWNrOi8vL2AgaXMgbmVlZGVkIGZvciBWaXN1YWwgU3R1ZGlvIGJyZWFrcG9pbnRzIHRvIHdvcmsgcHJvcGVybHkgYXMgY3VycmVudGx5XG4gICAgICAgIC8vIHRoZXJlIGlzIG5vIHdheSB0byBzZXQgdGhlICd3ZWJSb290J1xuICAgICAgICBzb3VyY2VSb290OiAnd2VicGFjazovLy8nLFxuICAgICAgICBtb2R1bGVGaWxlbmFtZVRlbXBsYXRlOiAnW3Jlc291cmNlLXBhdGhdJyxcbiAgICAgICAgYXBwZW5kOiBoaWRkZW5Tb3VyY2VNYXAgPyBmYWxzZSA6IHVuZGVmaW5lZCxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAodmVyYm9zZSkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBXYXRjaEZpbGVzTG9nc1BsdWdpbigpKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3RhdHNKc29uKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgSnNvblN0YXRzUGx1Z2luKHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCwgJ3N0YXRzLmpzb24nKSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzdWJyZXNvdXJjZUludGVncml0eSkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFN1YnJlc291cmNlSW50ZWdyaXR5UGx1Z2luKHtcbiAgICAgICAgaGFzaEZ1bmNOYW1lczogWydzaGEzODQnXSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoc2NyaXB0c1NvdXJjZU1hcCB8fCBzdHlsZXNTb3VyY2VNYXApIHtcbiAgICBleHRyYVJ1bGVzLnB1c2goe1xuICAgICAgdGVzdDogL1xcLltjbV0/anN4PyQvLFxuICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnc291cmNlLW1hcC1sb2FkZXInKSxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgZmlsdGVyU291cmNlTWFwcGluZ1VybDogKF9tYXBVcmk6IHN0cmluZywgcmVzb3VyY2VQYXRoOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICBpZiAodmVuZG9yU291cmNlTWFwKSB7XG4gICAgICAgICAgICAvLyBDb25zdW1lIGFsbCBzb3VyY2VtYXBzIHdoZW4gdmVuZG9yIG9wdGlvbiBpcyBlbmFibGVkLlxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gRG9uJ3QgY29uc3VtZSBzb3VyY2VtYXBzIGluIG5vZGVfbW9kdWxlcyB3aGVuIHZlbmRvciBpcyBkaXNhYmxlZC5cbiAgICAgICAgICAvLyBCdXQsIGRvIGNvbnN1bWUgbG9jYWwgbGlicmFyaWVzIHNvdXJjZW1hcHMuXG4gICAgICAgICAgcmV0dXJuICFyZXNvdXJjZVBhdGguaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChtYWluIHx8IHBvbHlmaWxscykge1xuICAgIGV4dHJhUnVsZXMucHVzaCh7XG4gICAgICB0ZXN0OiB0c0NvbmZpZy5vcHRpb25zLmFsbG93SnMgPyAvXFwuW2NtXT9bdGpdc3g/JC8gOiAvXFwuW2NtXT90c3g/JC8sXG4gICAgICBsb2FkZXI6IEFuZ3VsYXJXZWJwYWNrTG9hZGVyUGF0aCxcbiAgICAgIC8vIFRoZSBiZWxvdyBhcmUga25vd24gcGF0aHMgdGhhdCBhcmUgbm90IHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gZXZlbiB3aGVuIGFsbG93SnMgaXMgZW5hYmxlZC5cbiAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgL1tcXFxcL11ub2RlX21vZHVsZXNbL1xcXFxdKD86Y3NzLWxvYWRlcnxtaW5pLWNzcy1leHRyYWN0LXBsdWdpbnx3ZWJwYWNrLWRldi1zZXJ2ZXJ8d2VicGFjaylbL1xcXFxdLyxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goY3JlYXRlSXZ5UGx1Z2luKHdjbywgYW90LCB0c0NvbmZpZ1BhdGgpKTtcbiAgfVxuXG4gIGlmICh3ZWJXb3JrZXJUc0NvbmZpZykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGNyZWF0ZUl2eVBsdWdpbih3Y28sIGZhbHNlLCBwYXRoLnJlc29sdmUod2NvLnJvb3QsIHdlYldvcmtlclRzQ29uZmlnKSkpO1xuICB9XG5cbiAgY29uc3QgZXh0cmFNaW5pbWl6ZXJzID0gW107XG4gIGlmIChzY3JpcHRzT3B0aW1pemF0aW9uKSB7XG4gICAgZXh0cmFNaW5pbWl6ZXJzLnB1c2goXG4gICAgICBuZXcgSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbih7XG4gICAgICAgIGRlZmluZTogYnVpbGRPcHRpb25zLmFvdCA/IEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QgOiBHTE9CQUxfREVGU19GT1JfVEVSU0VSLFxuICAgICAgICBzb3VyY2VtYXA6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICAgIHN1cHBvcnRlZEJyb3dzZXJzOiBidWlsZE9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICAgIGtlZXBJZGVudGlmaWVyTmFtZXM6ICFhbGxvd01hbmdsZSB8fCBpc1BsYXRmb3JtU2VydmVyLFxuICAgICAgICBrZWVwTmFtZXM6IGlzUGxhdGZvcm1TZXJ2ZXIsXG4gICAgICAgIHJlbW92ZUxpY2Vuc2VzOiBidWlsZE9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzLFxuICAgICAgICBhZHZhbmNlZDogYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChwbGF0Zm9ybSA9PT0gJ2Jyb3dzZXInICYmIChzY3JpcHRzT3B0aW1pemF0aW9uIHx8IHN0eWxlc09wdGltaXphdGlvbi5taW5pZnkpKSB7XG4gICAgZXh0cmFNaW5pbWl6ZXJzLnB1c2gobmV3IFRyYW5zZmVyU2l6ZVBsdWdpbigpKTtcbiAgfVxuXG4gIGxldCBjcm9zc09yaWdpbkxvYWRpbmc6IE5vbk51bGxhYmxlPENvbmZpZ3VyYXRpb25bJ291dHB1dCddPlsnY3Jvc3NPcmlnaW5Mb2FkaW5nJ10gPSBmYWxzZTtcbiAgaWYgKHN1YnJlc291cmNlSW50ZWdyaXR5ICYmIGNyb3NzT3JpZ2luID09PSAnbm9uZScpIHtcbiAgICBjcm9zc09yaWdpbkxvYWRpbmcgPSAnYW5vbnltb3VzJztcbiAgfSBlbHNlIGlmIChjcm9zc09yaWdpbiAhPT0gJ25vbmUnKSB7XG4gICAgY3Jvc3NPcmlnaW5Mb2FkaW5nID0gY3Jvc3NPcmlnaW47XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG1vZGU6IHNjcmlwdHNPcHRpbWl6YXRpb24gfHwgc3R5bGVzT3B0aW1pemF0aW9uLm1pbmlmeSA/ICdwcm9kdWN0aW9uJyA6ICdkZXZlbG9wbWVudCcsXG4gICAgZGV2dG9vbDogZmFsc2UsXG4gICAgdGFyZ2V0OiBbaXNQbGF0Zm9ybVNlcnZlciA/ICdub2RlJyA6ICd3ZWInLCAnZXMyMDE1J10sXG4gICAgcHJvZmlsZTogYnVpbGRPcHRpb25zLnN0YXRzSnNvbixcbiAgICByZXNvbHZlOiB7XG4gICAgICByb290czogW3Byb2plY3RSb290XSxcbiAgICAgIGV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICBtb2R1bGVzOiBbdHNDb25maWcub3B0aW9ucy5iYXNlVXJsIHx8IHByb2plY3RSb290LCAnbm9kZV9tb2R1bGVzJ10sXG4gICAgICBtYWluRmllbGRzOiBpc1BsYXRmb3JtU2VydmVyXG4gICAgICAgID8gWydlczIwMjAnLCAnZXMyMDE1JywgJ21vZHVsZScsICdtYWluJ11cbiAgICAgICAgOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgICAgY29uZGl0aW9uTmFtZXM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICcuLi4nXSxcbiAgICB9LFxuICAgIHJlc29sdmVMb2FkZXI6IHtcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgfSxcbiAgICBjb250ZXh0OiByb290LFxuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBleHRlcm5hbHM6IGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIG91dHB1dDoge1xuICAgICAgdW5pcXVlTmFtZTogcHJvamVjdE5hbWUsXG4gICAgICBoYXNoRnVuY3Rpb246ICd4eGhhc2g2NCcsIC8vIHRvZG86IHJlbW92ZSBpbiB3ZWJwYWNrIDYuIFRoaXMgaXMgcGFydCBvZiBgZnV0dXJlRGVmYXVsdHNgLlxuICAgICAgY2xlYW46IGJ1aWxkT3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoID8/IHRydWUsXG4gICAgICBwYXRoOiBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm91dHB1dFBhdGgpLFxuICAgICAgcHVibGljUGF0aDogYnVpbGRPcHRpb25zLmRlcGxveVVybCA/PyAnJyxcbiAgICAgIGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmNodW5rfS5qc2AsXG4gICAgICBjaHVua0ZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmNodW5rfS5qc2AsXG4gICAgICBsaWJyYXJ5VGFyZ2V0OiBpc1BsYXRmb3JtU2VydmVyID8gJ2NvbW1vbmpzJyA6IHVuZGVmaW5lZCxcbiAgICAgIGNyb3NzT3JpZ2luTG9hZGluZyxcbiAgICAgIHRydXN0ZWRUeXBlczogJ2FuZ3VsYXIjYnVuZGxlcicsXG4gICAgICBzY3JpcHRUeXBlOiAnbW9kdWxlJyxcbiAgICB9LFxuICAgIHdhdGNoOiBidWlsZE9wdGlvbnMud2F0Y2gsXG4gICAgd2F0Y2hPcHRpb25zOiB7XG4gICAgICBwb2xsLFxuICAgICAgLy8gVGhlIGJlbG93IGlzIG5lZWRlZCBhcyB3aGVuIHByZXNlcnZlU3ltbGlua3MgaXMgZW5hYmxlZCB3ZSBkaXNhYmxlIGByZXNvbHZlLnN5bWxpbmtzYC5cbiAgICAgIGZvbGxvd1N5bWxpbmtzOiBidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgIGlnbm9yZWQ6IHBvbGwgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6ICcqKi9ub2RlX21vZHVsZXMvKionLFxuICAgIH0sXG4gICAgc25hcHNob3Q6IHtcbiAgICAgIG1vZHVsZToge1xuICAgICAgICAvLyBVc2UgaGFzaCBvZiBjb250ZW50IGluc3RlYWQgb2YgdGltZXN0YW1wIGJlY2F1c2UgdGhlIHRpbWVzdGFtcCBvZiB0aGUgc3ltbGluayB3aWxsIGJlIHVzZWRcbiAgICAgICAgLy8gaW5zdGVhZCBvZiB0aGUgcmVmZXJlbmNlZCBmaWxlcyB3aGljaCBjYXVzZXMgY2hhbmdlcyBpbiBzeW1saW5rcyBub3QgdG8gYmUgcGlja2VkIHVwLlxuICAgICAgICBoYXNoOiBidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwZXJmb3JtYW5jZToge1xuICAgICAgaGludHM6IGZhbHNlLFxuICAgIH0sXG4gICAgaWdub3JlV2FybmluZ3M6IFtcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc291cmNlLW1hcC1sb2FkZXIvYmxvYi9iMmRlNDI0OWM3NDMxZGQ4NDMyZGE2MDdlMDhmMGY2NWU5ZDY0MjE5L3NyYy9pbmRleC5qcyNMODNcbiAgICAgIC9GYWlsZWQgdG8gcGFyc2Ugc291cmNlIG1hcCBmcm9tLyxcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvcG9zdGNzcy1sb2FkZXIvYmxvYi9iZDI2MTg3NWZkZjljNTk2YWY0ZmZiM2ExYTczZmUzYzU0OWJlZmRhL3NyYy9pbmRleC5qcyNMMTUzLUwxNThcbiAgICAgIC9BZGQgcG9zdGNzcyBhcyBwcm9qZWN0IGRlcGVuZGVuY3kvLFxuICAgICAgLy8gZXNidWlsZCB3aWxsIGlzc3VlIGEgd2FybmluZywgd2hpbGUgc3RpbGwgaG9pc3RzIHRoZSBAY2hhcnNldCBhdCB0aGUgdmVyeSB0b3AuXG4gICAgICAvLyBUaGlzIGlzIGNhdXNlZCBieSBhIGJ1ZyBpbiBjc3MtbG9hZGVyIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvY3NzLWxvYWRlci9pc3N1ZXMvMTIxMlxuICAgICAgL1wiQGNoYXJzZXRcIiBtdXN0IGJlIHRoZSBmaXJzdCBydWxlIGluIHRoZSBmaWxlLyxcbiAgICBdLFxuICAgIG1vZHVsZToge1xuICAgICAgLy8gU2hvdyBhbiBlcnJvciBmb3IgbWlzc2luZyBleHBvcnRzIGluc3RlYWQgb2YgYSB3YXJuaW5nLlxuICAgICAgc3RyaWN0RXhwb3J0UHJlc2VuY2U6IHRydWUsXG4gICAgICBwYXJzZXI6IHtcbiAgICAgICAgamF2YXNjcmlwdDoge1xuICAgICAgICAgIHJlcXVpcmVDb250ZXh0OiBmYWxzZSxcbiAgICAgICAgICAvLyBEaXNhYmxlIGF1dG8gVVJMIGFzc2V0IG1vZHVsZSBjcmVhdGlvbi4gVGhpcyBkb2Vzbid0IGVmZmVjdCBgbmV3IFdvcmtlcihuZXcgVVJMKC4uLikpYFxuICAgICAgICAgIC8vIGh0dHBzOi8vd2VicGFjay5qcy5vcmcvZ3VpZGVzL2Fzc2V0LW1vZHVsZXMvI3VybC1hc3NldHNcbiAgICAgICAgICB1cmw6IGZhbHNlLFxuICAgICAgICAgIHdvcmtlcjogISF3ZWJXb3JrZXJUc0NvbmZpZyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBydWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLj8oc3ZnfGh0bWwpJC8sXG4gICAgICAgICAgLy8gT25seSBwcm9jZXNzIEhUTUwgYW5kIFNWRyB3aGljaCBhcmUga25vd24gQW5ndWxhciBjb21wb25lbnQgcmVzb3VyY2VzLlxuICAgICAgICAgIHJlc291cmNlUXVlcnk6IC9cXD9uZ1Jlc291cmNlLyxcbiAgICAgICAgICB0eXBlOiAnYXNzZXQvc291cmNlJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIC8vIE1hcmsgZmlsZXMgaW5zaWRlIGByeGpzL2FkZGAgYXMgY29udGFpbmluZyBzaWRlIGVmZmVjdHMuXG4gICAgICAgICAgLy8gSWYgdGhpcyBpcyBmaXhlZCB1cHN0cmVhbSBhbmQgdGhlIGZpeGVkIHZlcnNpb24gYmVjb21lcyB0aGUgbWluaW11bVxuICAgICAgICAgIC8vIHN1cHBvcnRlZCB2ZXJzaW9uLCB0aGlzIGNhbiBiZSByZW1vdmVkLlxuICAgICAgICAgIHRlc3Q6IC9bL1xcXFxdcnhqc1svXFxcXF1hZGRbL1xcXFxdLitcXC5qcyQvLFxuICAgICAgICAgIHNpZGVFZmZlY3RzOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLltjbV0/W3RqXXN4PyQvLFxuICAgICAgICAgIC8vIFRoZSBiZWxvdyBpcyBuZWVkZWQgZHVlIHRvIGEgYnVnIGluIGBAYmFiZWwvcnVudGltZWAuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2JhYmVsL2JhYmVsL2lzc3Vlcy8xMjgyNFxuICAgICAgICAgIHJlc29sdmU6IHsgZnVsbHlTcGVjaWZpZWQ6IGZhbHNlIH0sXG4gICAgICAgICAgZXhjbHVkZTogW1xuICAgICAgICAgICAgL1tcXFxcL11ub2RlX21vZHVsZXNbL1xcXFxdKD86Y29yZS1qc3xAYmFiZWx8dHNsaWJ8d2ViLWFuaW1hdGlvbnMtanN8d2ViLXN0cmVhbXMtcG9seWZpbGx8d2hhdHdnLXVybClbL1xcXFxdLyxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHVzZTogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInKSxcbiAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICAgIGNhY2hlRGlyZWN0b3J5OiAoY2FjaGUuZW5hYmxlZCAmJiBwYXRoLmpvaW4oY2FjaGUucGF0aCwgJ2JhYmVsLXdlYnBhY2snKSkgfHwgZmFsc2UsXG4gICAgICAgICAgICAgICAgYW90OiBidWlsZE9wdGlvbnMuYW90LFxuICAgICAgICAgICAgICAgIG9wdGltaXplOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICAgICAgICAgICAgc3VwcG9ydGVkQnJvd3NlcnM6IGJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2VycyxcbiAgICAgICAgICAgICAgICBpbnN0cnVtZW50Q29kZTogY29kZUNvdmVyYWdlXG4gICAgICAgICAgICAgICAgICA/IHtcbiAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZEJhc2VQYXRoOiBzb3VyY2VSb290ID8/IHByb2plY3RSb290LFxuICAgICAgICAgICAgICAgICAgICAgIGV4Y2x1ZGVkUGF0aHM6IGdldEluc3RydW1lbnRhdGlvbkV4Y2x1ZGVkUGF0aHMocm9vdCwgY29kZUNvdmVyYWdlRXhjbHVkZSksXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICB9IGFzIEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIC4uLmV4dHJhUnVsZXMsXG4gICAgICBdLFxuICAgIH0sXG4gICAgZXhwZXJpbWVudHM6IHtcbiAgICAgIGJhY2tDb21wYXQ6IGZhbHNlLFxuICAgICAgc3luY1dlYkFzc2VtYmx5OiB0cnVlLFxuICAgICAgYXN5bmNXZWJBc3NlbWJseTogdHJ1ZSxcbiAgICB9LFxuICAgIGluZnJhc3RydWN0dXJlTG9nZ2luZzoge1xuICAgICAgZGVidWc6IHZlcmJvc2UsXG4gICAgICBsZXZlbDogdmVyYm9zZSA/ICd2ZXJib3NlJyA6ICdlcnJvcicsXG4gICAgfSxcbiAgICBzdGF0czogZ2V0U3RhdHNPcHRpb25zKHZlcmJvc2UpLFxuICAgIGNhY2hlOiBnZXRDYWNoZVNldHRpbmdzKHdjbywgTkdfVkVSU0lPTi5mdWxsKSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG1pbmltaXplcjogZXh0cmFNaW5pbWl6ZXJzLFxuICAgICAgbW9kdWxlSWRzOiAnZGV0ZXJtaW5pc3RpYycsXG4gICAgICBjaHVua0lkczogYnVpbGRPcHRpb25zLm5hbWVkQ2h1bmtzID8gJ25hbWVkJyA6ICdkZXRlcm1pbmlzdGljJyxcbiAgICAgIGVtaXRPbkVycm9yczogZmFsc2UsXG4gICAgICBydW50aW1lQ2h1bms6IGlzUGxhdGZvcm1TZXJ2ZXIgPyBmYWxzZSA6ICdzaW5nbGUnLFxuICAgICAgc3BsaXRDaHVua3M6IHtcbiAgICAgICAgbWF4QXN5bmNSZXF1ZXN0czogSW5maW5pdHksXG4gICAgICAgIGNhY2hlR3JvdXBzOiB7XG4gICAgICAgICAgZGVmYXVsdDogISFjb21tb25DaHVuayAmJiB7XG4gICAgICAgICAgICBjaHVua3M6ICdhc3luYycsXG4gICAgICAgICAgICBtaW5DaHVua3M6IDIsXG4gICAgICAgICAgICBwcmlvcml0eTogMTAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb21tb246ICEhY29tbW9uQ2h1bmsgJiYge1xuICAgICAgICAgICAgbmFtZTogJ2NvbW1vbicsXG4gICAgICAgICAgICBjaHVua3M6ICdhc3luYycsXG4gICAgICAgICAgICBtaW5DaHVua3M6IDIsXG4gICAgICAgICAgICBlbmZvcmNlOiB0cnVlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IDUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB2ZW5kb3JzOiBmYWxzZSxcbiAgICAgICAgICBkZWZhdWx0VmVuZG9yczogISF2ZW5kb3JDaHVuayAmJiB7XG4gICAgICAgICAgICBuYW1lOiAndmVuZG9yJyxcbiAgICAgICAgICAgIGNodW5rczogKGNodW5rKSA9PiBjaHVuay5uYW1lID09PSAnbWFpbicsXG4gICAgICAgICAgICBlbmZvcmNlOiB0cnVlLFxuICAgICAgICAgICAgdGVzdDogVkVORE9SU19URVNULFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgcGx1Z2luczogW25ldyBOYW1lZENodW5rc1BsdWdpbigpLCBuZXcgRGVkdXBlTW9kdWxlUmVzb2x2ZVBsdWdpbih7IHZlcmJvc2UgfSksIC4uLmV4dHJhUGx1Z2luc10sXG4gICAgbm9kZTogZmFsc2UsXG4gIH07XG59XG4iXX0=