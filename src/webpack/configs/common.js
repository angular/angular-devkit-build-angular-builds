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
                    // TODO(alanagius): disable the below once we have a migration to remove `require.context` from test.ts file in users projects.
                    requireContext: true,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhDQUE0RDtBQUM1RCw4RUFBb0Q7QUFDcEQsMkNBQTZCO0FBQzdCLHFDQU1pQjtBQUNqQixpRkFBMkU7QUFHM0UseUVBQThEO0FBQzlELG1EQUFxRDtBQUNyRCx3Q0FNb0I7QUFDcEIsOEVBQXlFO0FBQ3pFLHdFQUFtRTtBQUNuRSxnRUFBNEQ7QUFDNUQsMEVBQXFFO0FBQ3JFLHNEQUF3RDtBQUN4RCxnRkFBMEU7QUFDMUUsOENBTzBCO0FBRTFCLE1BQU0sWUFBWSxHQUFHLHdCQUF3QixDQUFDO0FBRTlDLGtEQUFrRDtBQUMzQyxLQUFLLFVBQVUsZUFBZSxDQUFDLEdBQXlCOztJQUM3RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ2pHLE1BQU0sRUFDSixLQUFLLEVBQ0wsWUFBWSxFQUNaLFdBQVcsR0FBRyxNQUFNLEVBQ3BCLFFBQVEsR0FBRyxTQUFTLEVBQ3BCLEdBQUcsR0FBRyxJQUFJLEVBQ1YsbUJBQW1CLEdBQUcsRUFBRSxFQUN4QixJQUFJLEVBQ0osU0FBUyxFQUNULFNBQVMsRUFBRSxFQUNULE1BQU0sRUFBRSxlQUFlLEVBQ3ZCLE9BQU8sRUFBRSxnQkFBZ0IsRUFDekIsTUFBTSxFQUFFLGVBQWUsRUFDdkIsTUFBTSxFQUFFLGVBQWUsR0FDeEIsRUFDRCxZQUFZLEVBQUUsRUFBRSxNQUFNLEVBQUUsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixF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Tzt3QkFDZixTQUFTLEVBQUUsQ0FBQzt3QkFDWixPQUFPLEVBQUUsSUFBSTt3QkFDYixRQUFRLEVBQUUsQ0FBQztxQkFDWjtvQkFDRCxPQUFPLEVBQUUsS0FBSztvQkFDZCxjQUFjLEVBQUUsQ0FBQyxDQUFDLFdBQVcsSUFBSTt3QkFDL0IsSUFBSSxFQUFFLFFBQVE7d0JBQ2QsTUFBTSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU07d0JBQ3hDLE9BQU8sRUFBRSxJQUFJO3dCQUNiLElBQUksRUFBRSxZQUFZO3FCQUNuQjtpQkFDRjthQUNGO1NBQ0Y7UUFDRCxPQUFPLEVBQUUsQ0FBQyxJQUFJLHVDQUFpQixFQUFFLEVBQUUsSUFBSSxtQ0FBeUIsQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsR0FBRyxZQUFZLENBQUM7UUFDL0YsSUFBSSxFQUFFLEtBQUs7S0FDWixDQUFDO0FBQ0osQ0FBQztBQXZZRCwwQ0F1WUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQW5ndWxhcldlYnBhY2tMb2FkZXJQYXRoIH0gZnJvbSAnQG5ndG9vbHMvd2VicGFjayc7XG5pbXBvcnQgQ29weVdlYnBhY2tQbHVnaW4gZnJvbSAnY29weS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtcbiAgQ29tcGlsZXIsXG4gIENvbmZpZ3VyYXRpb24sXG4gIENvbnRleHRSZXBsYWNlbWVudFBsdWdpbixcbiAgUnVsZVNldFJ1bGUsXG4gIFNvdXJjZU1hcERldlRvb2xQbHVnaW4sXG59IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4gfSBmcm9tICd3ZWJwYWNrLXN1YnJlc291cmNlLWludGVncml0eSc7XG5pbXBvcnQgeyBBbmd1bGFyQmFiZWxMb2FkZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IGFsbG93TWFuZ2xlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHtcbiAgQ29tbW9uSnNVc2FnZVdhcm5QbHVnaW4sXG4gIERlZHVwZU1vZHVsZVJlc29sdmVQbHVnaW4sXG4gIEphdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW4sXG4gIEpzb25TdGF0c1BsdWdpbixcbiAgU2NyaXB0c1dlYnBhY2tQbHVnaW4sXG59IGZyb20gJy4uL3BsdWdpbnMnO1xuaW1wb3J0IHsgRGV2VG9vbHNJZ25vcmVQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL2RldnRvb2xzLWlnbm9yZS1wbHVnaW4nO1xuaW1wb3J0IHsgTmFtZWRDaHVua3NQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL25hbWVkLWNodW5rcy1wbHVnaW4nO1xuaW1wb3J0IHsgUHJvZ3Jlc3NQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3Byb2dyZXNzLXBsdWdpbic7XG5pbXBvcnQgeyBUcmFuc2ZlclNpemVQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3RyYW5zZmVyLXNpemUtcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZUl2eVBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvdHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBXYXRjaEZpbGVzTG9nc1BsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvd2F0Y2gtZmlsZXMtbG9ncy1wbHVnaW4nO1xuaW1wb3J0IHtcbiAgYXNzZXRQYXR0ZXJucyxcbiAgZ2V0Q2FjaGVTZXR0aW5ncyxcbiAgZ2V0SW5zdHJ1bWVudGF0aW9uRXhjbHVkZWRQYXRocyxcbiAgZ2V0T3V0cHV0SGFzaEZvcm1hdCxcbiAgZ2V0U3RhdHNPcHRpb25zLFxuICBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lLFxufSBmcm9tICcuLi91dGlscy9oZWxwZXJzJztcblxuY29uc3QgVkVORE9SU19URVNUID0gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLztcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRDb21tb25Db25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IFByb21pc2U8Q29uZmlndXJhdGlvbj4ge1xuICBjb25zdCB7IHJvb3QsIHByb2plY3RSb290LCBidWlsZE9wdGlvbnMsIHRzQ29uZmlnLCBwcm9qZWN0TmFtZSwgc291cmNlUm9vdCwgdHNDb25maWdQYXRoIH0gPSB3Y287XG4gIGNvbnN0IHtcbiAgICBjYWNoZSxcbiAgICBjb2RlQ292ZXJhZ2UsXG4gICAgY3Jvc3NPcmlnaW4gPSAnbm9uZScsXG4gICAgcGxhdGZvcm0gPSAnYnJvd3NlcicsXG4gICAgYW90ID0gdHJ1ZSxcbiAgICBjb2RlQ292ZXJhZ2VFeGNsdWRlID0gW10sXG4gICAgbWFpbixcbiAgICBwb2x5ZmlsbHMsXG4gICAgc291cmNlTWFwOiB7XG4gICAgICBzdHlsZXM6IHN0eWxlc1NvdXJjZU1hcCxcbiAgICAgIHNjcmlwdHM6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICB2ZW5kb3I6IHZlbmRvclNvdXJjZU1hcCxcbiAgICAgIGhpZGRlbjogaGlkZGVuU291cmNlTWFwLFxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7IHN0eWxlczogc3R5bGVzT3B0aW1pemF0aW9uLCBzY3JpcHRzOiBzY3JpcHRzT3B0aW1pemF0aW9uIH0sXG4gICAgY29tbW9uQ2h1bmssXG4gICAgdmVuZG9yQ2h1bmssXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgdmVyYm9zZSxcbiAgICBwb2xsLFxuICAgIHdlYldvcmtlclRzQ29uZmlnLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzID0gW10sXG4gICAgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICB9ID0gYnVpbGRPcHRpb25zO1xuXG4gIGNvbnN0IGlzUGxhdGZvcm1TZXJ2ZXIgPSBidWlsZE9wdGlvbnMucGxhdGZvcm0gPT09ICdzZXJ2ZXInO1xuICBjb25zdCBleHRyYVBsdWdpbnM6IHsgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKTogdm9pZCB9W10gPSBbXTtcbiAgY29uc3QgZXh0cmFSdWxlczogUnVsZVNldFJ1bGVbXSA9IFtdO1xuICBjb25zdCBlbnRyeVBvaW50czogeyBba2V5OiBzdHJpbmddOiBbc3RyaW5nLCAuLi5zdHJpbmdbXV0gfSA9IHt9O1xuXG4gIC8vIExvYWQgRVNNIGBAYW5ndWxhci9jb21waWxlci1jbGlgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gIGNvbnN0IHtcbiAgICBHTE9CQUxfREVGU19GT1JfVEVSU0VSLFxuICAgIEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QsXG4gICAgVkVSU0lPTjogTkdfVkVSU0lPTixcbiAgfSA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk+KCdAYW5ndWxhci9jb21waWxlci1jbGknKTtcblxuICAvLyBkZXRlcm1pbmUgaGFzaGluZyBmb3JtYXRcbiAgY29uc3QgaGFzaEZvcm1hdCA9IGdldE91dHB1dEhhc2hGb3JtYXQoYnVpbGRPcHRpb25zLm91dHB1dEhhc2hpbmcpO1xuXG4gIGlmIChidWlsZE9wdGlvbnMucHJvZ3Jlc3MpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgUHJvZ3Jlc3NQbHVnaW4ocGxhdGZvcm0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMubWFpbikge1xuICAgIGNvbnN0IG1haW5QYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5tYWluKTtcbiAgICBlbnRyeVBvaW50c1snbWFpbiddID0gW21haW5QYXRoXTtcbiAgfVxuXG4gIGlmIChpc1BsYXRmb3JtU2VydmVyKSB7XG4gICAgLy8gRml4ZXMgQ3JpdGljYWwgZGVwZW5kZW5jeTogdGhlIHJlcXVlc3Qgb2YgYSBkZXBlbmRlbmN5IGlzIGFuIGV4cHJlc3Npb25cbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgQ29udGV4dFJlcGxhY2VtZW50UGx1Z2luKC9AP2hhcGl8ZXhwcmVzc1tcXFxcL10vKSk7XG4gIH1cblxuICBpZiAoIWlzUGxhdGZvcm1TZXJ2ZXIpIHtcbiAgICBpZiAoYnVpbGRPcHRpb25zLnBvbHlmaWxscykge1xuICAgICAgY29uc3QgcHJvamVjdFBvbHlmaWxscyA9IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMucG9seWZpbGxzKTtcbiAgICAgIGlmIChlbnRyeVBvaW50c1sncG9seWZpbGxzJ10pIHtcbiAgICAgICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddLnB1c2gocHJvamVjdFBvbHlmaWxscyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10gPSBbcHJvamVjdFBvbHlmaWxsc107XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcykge1xuICAgIC8vIFdoZW4gdGhpcyBpcyBub3QgZGVmaW5lZCBpdCBtZWFucyB0aGUgYnVpbGRlciBkb2Vzbid0IHN1cHBvcnQgc2hvd2luZyBjb21tb24ganMgdXNhZ2VzLlxuICAgIC8vIFdoZW4gaXQgZG9lcyBpdCB3aWxsIGJlIGFuIGFycmF5LlxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IENvbW1vbkpzVXNhZ2VXYXJuUGx1Z2luKHtcbiAgICAgICAgYWxsb3dlZERlcGVuZGVuY2llczogYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgZ2xvYmFsIHNjcmlwdHNcbiAgLy8gQWRkIGEgbmV3IGFzc2V0IGZvciBlYWNoIGVudHJ5LlxuICBmb3IgKGNvbnN0IHsgYnVuZGxlTmFtZSwgaW5qZWN0LCBwYXRocyB9IG9mIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUoXG4gICAgcm9vdCxcbiAgICBidWlsZE9wdGlvbnMuc2NyaXB0cyxcbiAgKSkge1xuICAgIC8vIExhenkgc2NyaXB0cyBkb24ndCBnZXQgYSBoYXNoLCBvdGhlcndpc2UgdGhleSBjYW4ndCBiZSBsb2FkZWQgYnkgbmFtZS5cbiAgICBjb25zdCBoYXNoID0gaW5qZWN0ID8gaGFzaEZvcm1hdC5zY3JpcHQgOiAnJztcblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFNjcmlwdHNXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgbmFtZTogYnVuZGxlTmFtZSxcbiAgICAgICAgc291cmNlTWFwOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgICBzY3JpcHRzOiBwYXRocyxcbiAgICAgICAgZmlsZW5hbWU6IGAke3BhdGguYmFzZW5hbWUoYnVuZGxlTmFtZSl9JHtoYXNofS5qc2AsXG4gICAgICAgIGJhc2VQYXRoOiBwcm9qZWN0Um9vdCxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICAvLyBwcm9jZXNzIGFzc2V0IGVudHJpZXNcbiAgaWYgKGJ1aWxkT3B0aW9ucy5hc3NldHMubGVuZ3RoKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgQ29weVdlYnBhY2tQbHVnaW4oe1xuICAgICAgICBwYXR0ZXJuczogYXNzZXRQYXR0ZXJucyhyb290LCBidWlsZE9wdGlvbnMuYXNzZXRzKSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcykge1xuICAgIGNvbnN0IExpY2Vuc2VXZWJwYWNrUGx1Z2luID0gcmVxdWlyZSgnbGljZW5zZS13ZWJwYWNrLXBsdWdpbicpLkxpY2Vuc2VXZWJwYWNrUGx1Z2luO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IExpY2Vuc2VXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICB3YXJuaW5nczogZmFsc2UsXG4gICAgICAgICAgZXJyb3JzOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgcGVyQ2h1bmtPdXRwdXQ6IGZhbHNlLFxuICAgICAgICBvdXRwdXRGaWxlbmFtZTogJzNyZHBhcnR5bGljZW5zZXMudHh0JyxcbiAgICAgICAgc2tpcENoaWxkQ29tcGlsZXJzOiB0cnVlLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzY3JpcHRzU291cmNlTWFwIHx8IHN0eWxlc1NvdXJjZU1hcCkge1xuICAgIGNvbnN0IGluY2x1ZGUgPSBbXTtcbiAgICBpZiAoc2NyaXB0c1NvdXJjZU1hcCkge1xuICAgICAgaW5jbHVkZS5wdXNoKC9qcyQvKTtcbiAgICB9XG5cbiAgICBpZiAoc3R5bGVzU291cmNlTWFwKSB7XG4gICAgICBpbmNsdWRlLnB1c2goL2NzcyQvKTtcbiAgICB9XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgRGV2VG9vbHNJZ25vcmVQbHVnaW4oKSk7XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBTb3VyY2VNYXBEZXZUb29sUGx1Z2luKHtcbiAgICAgICAgZmlsZW5hbWU6ICdbZmlsZV0ubWFwJyxcbiAgICAgICAgaW5jbHVkZSxcbiAgICAgICAgLy8gV2Ugd2FudCB0byBzZXQgc291cmNlUm9vdCB0byAgYHdlYnBhY2s6Ly8vYCBmb3Igbm9uXG4gICAgICAgIC8vIGlubGluZSBzb3VyY2VtYXBzIGFzIG90aGVyd2lzZSBwYXRocyB0byBzb3VyY2VtYXBzIHdpbGwgYmUgYnJva2VuIGluIGJyb3dzZXJcbiAgICAgICAgLy8gYHdlYnBhY2s6Ly8vYCBpcyBuZWVkZWQgZm9yIFZpc3VhbCBTdHVkaW8gYnJlYWtwb2ludHMgdG8gd29yayBwcm9wZXJseSBhcyBjdXJyZW50bHlcbiAgICAgICAgLy8gdGhlcmUgaXMgbm8gd2F5IHRvIHNldCB0aGUgJ3dlYlJvb3QnXG4gICAgICAgIHNvdXJjZVJvb3Q6ICd3ZWJwYWNrOi8vLycsXG4gICAgICAgIG1vZHVsZUZpbGVuYW1lVGVtcGxhdGU6ICdbcmVzb3VyY2UtcGF0aF0nLFxuICAgICAgICBhcHBlbmQ6IGhpZGRlblNvdXJjZU1hcCA/IGZhbHNlIDogdW5kZWZpbmVkLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmICh2ZXJib3NlKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFdhdGNoRmlsZXNMb2dzUGx1Z2luKCkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdGF0c0pzb24pIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBKc29uU3RhdHNQbHVnaW4ocGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoLCAnc3RhdHMuanNvbicpKSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHN1YnJlc291cmNlSW50ZWdyaXR5KSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4oe1xuICAgICAgICBoYXNoRnVuY05hbWVzOiBbJ3NoYTM4NCddLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzY3JpcHRzU291cmNlTWFwIHx8IHN0eWxlc1NvdXJjZU1hcCkge1xuICAgIGV4dHJhUnVsZXMucHVzaCh7XG4gICAgICB0ZXN0OiAvXFwuW2NtXT9qc3g/JC8sXG4gICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdzb3VyY2UtbWFwLWxvYWRlcicpLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICBmaWx0ZXJTb3VyY2VNYXBwaW5nVXJsOiAoX21hcFVyaTogc3RyaW5nLCByZXNvdXJjZVBhdGg6IHN0cmluZykgPT4ge1xuICAgICAgICAgIGlmICh2ZW5kb3JTb3VyY2VNYXApIHtcbiAgICAgICAgICAgIC8vIENvbnN1bWUgYWxsIHNvdXJjZW1hcHMgd2hlbiB2ZW5kb3Igb3B0aW9uIGlzIGVuYWJsZWQuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBEb24ndCBjb25zdW1lIHNvdXJjZW1hcHMgaW4gbm9kZV9tb2R1bGVzIHdoZW4gdmVuZG9yIGlzIGRpc2FibGVkLlxuICAgICAgICAgIC8vIEJ1dCwgZG8gY29uc3VtZSBsb2NhbCBsaWJyYXJpZXMgc291cmNlbWFwcy5cbiAgICAgICAgICByZXR1cm4gIXJlc291cmNlUGF0aC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJyk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgaWYgKG1haW4gfHwgcG9seWZpbGxzKSB7XG4gICAgZXh0cmFSdWxlcy5wdXNoKHtcbiAgICAgIHRlc3Q6IHRzQ29uZmlnLm9wdGlvbnMuYWxsb3dKcyA/IC9cXC5bY21dP1t0al1zeD8kLyA6IC9cXC5bY21dP3RzeD8kLyxcbiAgICAgIGxvYWRlcjogQW5ndWxhcldlYnBhY2tMb2FkZXJQYXRoLFxuICAgICAgLy8gVGhlIGJlbG93IGFyZSBrbm93biBwYXRocyB0aGF0IGFyZSBub3QgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBjb21waWxhdGlvbiBldmVuIHdoZW4gYWxsb3dKcyBpcyBlbmFibGVkLlxuICAgICAgZXhjbHVkZTogW1xuICAgICAgICAvW1xcXFwvXW5vZGVfbW9kdWxlc1svXFxcXF0oPzpjc3MtbG9hZGVyfG1pbmktY3NzLWV4dHJhY3QtcGx1Z2lufHdlYnBhY2stZGV2LXNlcnZlcnx3ZWJwYWNrKVsvXFxcXF0vLFxuICAgICAgXSxcbiAgICB9KTtcbiAgICBleHRyYVBsdWdpbnMucHVzaChjcmVhdGVJdnlQbHVnaW4od2NvLCBhb3QsIHRzQ29uZmlnUGF0aCkpO1xuICB9XG5cbiAgaWYgKHdlYldvcmtlclRzQ29uZmlnKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goY3JlYXRlSXZ5UGx1Z2luKHdjbywgZmFsc2UsIHBhdGgucmVzb2x2ZSh3Y28ucm9vdCwgd2ViV29ya2VyVHNDb25maWcpKSk7XG4gIH1cblxuICBjb25zdCBleHRyYU1pbmltaXplcnMgPSBbXTtcbiAgaWYgKHNjcmlwdHNPcHRpbWl6YXRpb24pIHtcbiAgICBleHRyYU1pbmltaXplcnMucHVzaChcbiAgICAgIG5ldyBKYXZhU2NyaXB0T3B0aW1pemVyUGx1Z2luKHtcbiAgICAgICAgZGVmaW5lOiBidWlsZE9wdGlvbnMuYW90ID8gR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCA6IEdMT0JBTF9ERUZTX0ZPUl9URVJTRVIsXG4gICAgICAgIHNvdXJjZW1hcDogc2NyaXB0c1NvdXJjZU1hcCxcbiAgICAgICAgc3VwcG9ydGVkQnJvd3NlcnM6IGJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2VycyxcbiAgICAgICAga2VlcElkZW50aWZpZXJOYW1lczogIWFsbG93TWFuZ2xlIHx8IGlzUGxhdGZvcm1TZXJ2ZXIsXG4gICAgICAgIGtlZXBOYW1lczogaXNQbGF0Zm9ybVNlcnZlcixcbiAgICAgICAgcmVtb3ZlTGljZW5zZXM6IGJ1aWxkT3B0aW9ucy5leHRyYWN0TGljZW5zZXMsXG4gICAgICAgIGFkdmFuY2VkOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHBsYXRmb3JtID09PSAnYnJvd3NlcicgJiYgKHNjcmlwdHNPcHRpbWl6YXRpb24gfHwgc3R5bGVzT3B0aW1pemF0aW9uLm1pbmlmeSkpIHtcbiAgICBleHRyYU1pbmltaXplcnMucHVzaChuZXcgVHJhbnNmZXJTaXplUGx1Z2luKCkpO1xuICB9XG5cbiAgbGV0IGNyb3NzT3JpZ2luTG9hZGluZzogTm9uTnVsbGFibGU8Q29uZmlndXJhdGlvblsnb3V0cHV0J10+Wydjcm9zc09yaWdpbkxvYWRpbmcnXSA9IGZhbHNlO1xuICBpZiAoc3VicmVzb3VyY2VJbnRlZ3JpdHkgJiYgY3Jvc3NPcmlnaW4gPT09ICdub25lJykge1xuICAgIGNyb3NzT3JpZ2luTG9hZGluZyA9ICdhbm9ueW1vdXMnO1xuICB9IGVsc2UgaWYgKGNyb3NzT3JpZ2luICE9PSAnbm9uZScpIHtcbiAgICBjcm9zc09yaWdpbkxvYWRpbmcgPSBjcm9zc09yaWdpbjtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbW9kZTogc2NyaXB0c09wdGltaXphdGlvbiB8fCBzdHlsZXNPcHRpbWl6YXRpb24ubWluaWZ5ID8gJ3Byb2R1Y3Rpb24nIDogJ2RldmVsb3BtZW50JyxcbiAgICBkZXZ0b29sOiBmYWxzZSxcbiAgICB0YXJnZXQ6IFtpc1BsYXRmb3JtU2VydmVyID8gJ25vZGUnIDogJ3dlYicsICdlczIwMTUnXSxcbiAgICBwcm9maWxlOiBidWlsZE9wdGlvbnMuc3RhdHNKc29uLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIHJvb3RzOiBbcHJvamVjdFJvb3RdLFxuICAgICAgZXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgICAgc3ltbGlua3M6ICFidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgIG1vZHVsZXM6IFt0c0NvbmZpZy5vcHRpb25zLmJhc2VVcmwgfHwgcHJvamVjdFJvb3QsICdub2RlX21vZHVsZXMnXSxcbiAgICAgIG1haW5GaWVsZHM6IGlzUGxhdGZvcm1TZXJ2ZXJcbiAgICAgICAgPyBbJ2VzMjAyMCcsICdlczIwMTUnLCAnbW9kdWxlJywgJ21haW4nXVxuICAgICAgICA6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgICBjb25kaXRpb25OYW1lczogWydlczIwMjAnLCAnZXMyMDE1JywgJy4uLiddLFxuICAgIH0sXG4gICAgcmVzb2x2ZUxvYWRlcjoge1xuICAgICAgc3ltbGlua3M6ICFidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICB9LFxuICAgIGNvbnRleHQ6IHJvb3QsXG4gICAgZW50cnk6IGVudHJ5UG9pbnRzLFxuICAgIGV4dGVybmFsczogZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgb3V0cHV0OiB7XG4gICAgICB1bmlxdWVOYW1lOiBwcm9qZWN0TmFtZSxcbiAgICAgIGhhc2hGdW5jdGlvbjogJ3h4aGFzaDY0JywgLy8gdG9kbzogcmVtb3ZlIGluIHdlYnBhY2sgNi4gVGhpcyBpcyBwYXJ0IG9mIGBmdXR1cmVEZWZhdWx0c2AuXG4gICAgICBjbGVhbjogYnVpbGRPcHRpb25zLmRlbGV0ZU91dHB1dFBhdGggPz8gdHJ1ZSxcbiAgICAgIHBhdGg6IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCksXG4gICAgICBwdWJsaWNQYXRoOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsID8/ICcnLFxuICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICAgIGNodW5rRmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICAgIGxpYnJhcnlUYXJnZXQ6IGlzUGxhdGZvcm1TZXJ2ZXIgPyAnY29tbW9uanMnIDogdW5kZWZpbmVkLFxuICAgICAgY3Jvc3NPcmlnaW5Mb2FkaW5nLFxuICAgICAgdHJ1c3RlZFR5cGVzOiAnYW5ndWxhciNidW5kbGVyJyxcbiAgICAgIHNjcmlwdFR5cGU6ICdtb2R1bGUnLFxuICAgIH0sXG4gICAgd2F0Y2g6IGJ1aWxkT3B0aW9ucy53YXRjaCxcbiAgICB3YXRjaE9wdGlvbnM6IHtcbiAgICAgIHBvbGwsXG4gICAgICAvLyBUaGUgYmVsb3cgaXMgbmVlZGVkIGFzIHdoZW4gcHJlc2VydmVTeW1saW5rcyBpcyBlbmFibGVkIHdlIGRpc2FibGUgYHJlc29sdmUuc3ltbGlua3NgLlxuICAgICAgZm9sbG93U3ltbGlua3M6IGJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgaWdub3JlZDogcG9sbCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogJyoqL25vZGVfbW9kdWxlcy8qKicsXG4gICAgfSxcbiAgICBzbmFwc2hvdDoge1xuICAgICAgbW9kdWxlOiB7XG4gICAgICAgIC8vIFVzZSBoYXNoIG9mIGNvbnRlbnQgaW5zdGVhZCBvZiB0aW1lc3RhbXAgYmVjYXVzZSB0aGUgdGltZXN0YW1wIG9mIHRoZSBzeW1saW5rIHdpbGwgYmUgdXNlZFxuICAgICAgICAvLyBpbnN0ZWFkIG9mIHRoZSByZWZlcmVuY2VkIGZpbGVzIHdoaWNoIGNhdXNlcyBjaGFuZ2VzIGluIHN5bWxpbmtzIG5vdCB0byBiZSBwaWNrZWQgdXAuXG4gICAgICAgIGhhc2g6IGJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHBlcmZvcm1hbmNlOiB7XG4gICAgICBoaW50czogZmFsc2UsXG4gICAgfSxcbiAgICBpZ25vcmVXYXJuaW5nczogW1xuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zb3VyY2UtbWFwLWxvYWRlci9ibG9iL2IyZGU0MjQ5Yzc0MzFkZDg0MzJkYTYwN2UwOGYwZjY1ZTlkNjQyMTkvc3JjL2luZGV4LmpzI0w4M1xuICAgICAgL0ZhaWxlZCB0byBwYXJzZSBzb3VyY2UgbWFwIGZyb20vLFxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9wb3N0Y3NzLWxvYWRlci9ibG9iL2JkMjYxODc1ZmRmOWM1OTZhZjRmZmIzYTFhNzNmZTNjNTQ5YmVmZGEvc3JjL2luZGV4LmpzI0wxNTMtTDE1OFxuICAgICAgL0FkZCBwb3N0Y3NzIGFzIHByb2plY3QgZGVwZW5kZW5jeS8sXG4gICAgICAvLyBlc2J1aWxkIHdpbGwgaXNzdWUgYSB3YXJuaW5nLCB3aGlsZSBzdGlsbCBob2lzdHMgdGhlIEBjaGFyc2V0IGF0IHRoZSB2ZXJ5IHRvcC5cbiAgICAgIC8vIFRoaXMgaXMgY2F1c2VkIGJ5IGEgYnVnIGluIGNzcy1sb2FkZXIgaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9jc3MtbG9hZGVyL2lzc3Vlcy8xMjEyXG4gICAgICAvXCJAY2hhcnNldFwiIG11c3QgYmUgdGhlIGZpcnN0IHJ1bGUgaW4gdGhlIGZpbGUvLFxuICAgIF0sXG4gICAgbW9kdWxlOiB7XG4gICAgICAvLyBTaG93IGFuIGVycm9yIGZvciBtaXNzaW5nIGV4cG9ydHMgaW5zdGVhZCBvZiBhIHdhcm5pbmcuXG4gICAgICBzdHJpY3RFeHBvcnRQcmVzZW5jZTogdHJ1ZSxcbiAgICAgIHBhcnNlcjoge1xuICAgICAgICBqYXZhc2NyaXB0OiB7XG4gICAgICAgICAgLy8gVE9ETyhhbGFuYWdpdXMpOiBkaXNhYmxlIHRoZSBiZWxvdyBvbmNlIHdlIGhhdmUgYSBtaWdyYXRpb24gdG8gcmVtb3ZlIGByZXF1aXJlLmNvbnRleHRgIGZyb20gdGVzdC50cyBmaWxlIGluIHVzZXJzIHByb2plY3RzLlxuICAgICAgICAgIHJlcXVpcmVDb250ZXh0OiB0cnVlLFxuICAgICAgICAgIC8vIERpc2FibGUgYXV0byBVUkwgYXNzZXQgbW9kdWxlIGNyZWF0aW9uLiBUaGlzIGRvZXNuJ3QgZWZmZWN0IGBuZXcgV29ya2VyKG5ldyBVUkwoLi4uKSlgXG4gICAgICAgICAgLy8gaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9ndWlkZXMvYXNzZXQtbW9kdWxlcy8jdXJsLWFzc2V0c1xuICAgICAgICAgIHVybDogZmFsc2UsXG4gICAgICAgICAgd29ya2VyOiAhIXdlYldvcmtlclRzQ29uZmlnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuPyhzdmd8aHRtbCkkLyxcbiAgICAgICAgICAvLyBPbmx5IHByb2Nlc3MgSFRNTCBhbmQgU1ZHIHdoaWNoIGFyZSBrbm93biBBbmd1bGFyIGNvbXBvbmVudCByZXNvdXJjZXMuXG4gICAgICAgICAgcmVzb3VyY2VRdWVyeTogL1xcP25nUmVzb3VyY2UvLFxuICAgICAgICAgIHR5cGU6ICdhc3NldC9zb3VyY2UnLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgLy8gTWFyayBmaWxlcyBpbnNpZGUgYHJ4anMvYWRkYCBhcyBjb250YWluaW5nIHNpZGUgZWZmZWN0cy5cbiAgICAgICAgICAvLyBJZiB0aGlzIGlzIGZpeGVkIHVwc3RyZWFtIGFuZCB0aGUgZml4ZWQgdmVyc2lvbiBiZWNvbWVzIHRoZSBtaW5pbXVtXG4gICAgICAgICAgLy8gc3VwcG9ydGVkIHZlcnNpb24sIHRoaXMgY2FuIGJlIHJlbW92ZWQuXG4gICAgICAgICAgdGVzdDogL1svXFxcXF1yeGpzWy9cXFxcXWFkZFsvXFxcXF0uK1xcLmpzJC8sXG4gICAgICAgICAgc2lkZUVmZmVjdHM6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuW2NtXT9bdGpdc3g/JC8sXG4gICAgICAgICAgLy8gVGhlIGJlbG93IGlzIG5lZWRlZCBkdWUgdG8gYSBidWcgaW4gYEBiYWJlbC9ydW50aW1lYC4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYmFiZWwvYmFiZWwvaXNzdWVzLzEyODI0XG4gICAgICAgICAgcmVzb2x2ZTogeyBmdWxseVNwZWNpZmllZDogZmFsc2UgfSxcbiAgICAgICAgICBleGNsdWRlOiBbXG4gICAgICAgICAgICAvW1xcXFwvXW5vZGVfbW9kdWxlc1svXFxcXF0oPzpjb3JlLWpzfEBiYWJlbHx0c2xpYnx3ZWItYW5pbWF0aW9ucy1qc3x3ZWItc3RyZWFtcy1wb2x5ZmlsbHx3aGF0d2ctdXJsKVsvXFxcXF0vLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgdXNlOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCcuLi8uLi9iYWJlbC93ZWJwYWNrLWxvYWRlcicpLFxuICAgICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgY2FjaGVEaXJlY3Rvcnk6IChjYWNoZS5lbmFibGVkICYmIHBhdGguam9pbihjYWNoZS5wYXRoLCAnYmFiZWwtd2VicGFjaycpKSB8fCBmYWxzZSxcbiAgICAgICAgICAgICAgICBhb3Q6IGJ1aWxkT3B0aW9ucy5hb3QsXG4gICAgICAgICAgICAgICAgb3B0aW1pemU6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgICAgICAgICAgICBzdXBwb3J0ZWRCcm93c2VyczogYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICAgICAgICAgIGluc3RydW1lbnRDb2RlOiBjb2RlQ292ZXJhZ2VcbiAgICAgICAgICAgICAgICAgID8ge1xuICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkQmFzZVBhdGg6IHNvdXJjZVJvb3QgPz8gcHJvamVjdFJvb3QsXG4gICAgICAgICAgICAgICAgICAgICAgZXhjbHVkZWRQYXRoczogZ2V0SW5zdHJ1bWVudGF0aW9uRXhjbHVkZWRQYXRocyhyb290LCBjb2RlQ292ZXJhZ2VFeGNsdWRlKSxcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgIH0gYXMgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgLi4uZXh0cmFSdWxlcyxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBleHBlcmltZW50czoge1xuICAgICAgYmFja0NvbXBhdDogZmFsc2UsXG4gICAgICBzeW5jV2ViQXNzZW1ibHk6IHRydWUsXG4gICAgICBhc3luY1dlYkFzc2VtYmx5OiB0cnVlLFxuICAgIH0sXG4gICAgaW5mcmFzdHJ1Y3R1cmVMb2dnaW5nOiB7XG4gICAgICBkZWJ1ZzogdmVyYm9zZSxcbiAgICAgIGxldmVsOiB2ZXJib3NlID8gJ3ZlcmJvc2UnIDogJ2Vycm9yJyxcbiAgICB9LFxuICAgIHN0YXRzOiBnZXRTdGF0c09wdGlvbnModmVyYm9zZSksXG4gICAgY2FjaGU6IGdldENhY2hlU2V0dGluZ3Mod2NvLCBOR19WRVJTSU9OLmZ1bGwpLFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgbWluaW1pemVyOiBleHRyYU1pbmltaXplcnMsXG4gICAgICBtb2R1bGVJZHM6ICdkZXRlcm1pbmlzdGljJyxcbiAgICAgIGNodW5rSWRzOiBidWlsZE9wdGlvbnMubmFtZWRDaHVua3MgPyAnbmFtZWQnIDogJ2RldGVybWluaXN0aWMnLFxuICAgICAgZW1pdE9uRXJyb3JzOiBmYWxzZSxcbiAgICAgIHJ1bnRpbWVDaHVuazogaXNQbGF0Zm9ybVNlcnZlciA/IGZhbHNlIDogJ3NpbmdsZScsXG4gICAgICBzcGxpdENodW5rczoge1xuICAgICAgICBtYXhBc3luY1JlcXVlc3RzOiBJbmZpbml0eSxcbiAgICAgICAgY2FjaGVHcm91cHM6IHtcbiAgICAgICAgICBkZWZhdWx0OiAhIWNvbW1vbkNodW5rICYmIHtcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIHByaW9yaXR5OiAxMCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbW1vbjogISFjb21tb25DaHVuayAmJiB7XG4gICAgICAgICAgICBuYW1lOiAnY29tbW9uJyxcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICBwcmlvcml0eTogNSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZlbmRvcnM6IGZhbHNlLFxuICAgICAgICAgIGRlZmF1bHRWZW5kb3JzOiAhIXZlbmRvckNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICd2ZW5kb3InLFxuICAgICAgICAgICAgY2h1bmtzOiAoY2h1bmspID0+IGNodW5rLm5hbWUgPT09ICdtYWluJyxcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICB0ZXN0OiBWRU5ET1JTX1RFU1QsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbbmV3IE5hbWVkQ2h1bmtzUGx1Z2luKCksIG5ldyBEZWR1cGVNb2R1bGVSZXNvbHZlUGx1Z2luKHsgdmVyYm9zZSB9KSwgLi4uZXh0cmFQbHVnaW5zXSxcbiAgICBub2RlOiBmYWxzZSxcbiAgfTtcbn1cbiJdfQ==