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
const typescript_1 = require("typescript");
const webpack_2 = require("webpack");
const webpack_subresource_integrity_1 = require("webpack-subresource-integrity");
const environment_options_1 = require("../../utils/environment-options");
const load_esm_1 = require("../../utils/load-esm");
const plugins_1 = require("../plugins");
const named_chunks_plugin_1 = require("../plugins/named-chunks-plugin");
const progress_plugin_1 = require("../plugins/progress-plugin");
const transfer_size_plugin_1 = require("../plugins/transfer-size-plugin");
const typescript_2 = require("../plugins/typescript");
const helpers_1 = require("../utils/helpers");
// eslint-disable-next-line max-lines-per-function
async function getCommonConfig(wco) {
    var _a, _b;
    const { root, projectRoot, buildOptions, tsConfig, projectName, sourceRoot, tsConfigPath, scriptTarget, } = wco;
    const { cache, codeCoverage, crossOrigin = 'none', platform = 'browser', aot = true, codeCoverageExclude = [], main, polyfills, sourceMap: { styles: stylesSourceMap, scripts: scriptsSourceMap, vendor: vendorSourceMap, hidden: hiddenSourceMap, }, optimization: { styles: stylesOptimization, scripts: scriptsOptimization }, commonChunk, vendorChunk, subresourceIntegrity, verbose, poll, webWorkerTsConfig, externalDependencies = [], allowedCommonJsDependencies, bundleDependencies, } = buildOptions;
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
        if (!buildOptions.aot) {
            const jitPolyfills = require.resolve('core-js/proposals/reflect-metadata');
            if (entryPoints['polyfills']) {
                entryPoints['polyfills'].push(jitPolyfills);
            }
            else {
                entryPoints['polyfills'] = [jitPolyfills];
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
            exclude: [/[/\\](?:css-loader|mini-css-extract-plugin|webpack-dev-server|webpack)[/\\]/],
        });
        extraPlugins.push((0, typescript_2.createIvyPlugin)(wco, aot, tsConfigPath));
    }
    if (webWorkerTsConfig) {
        extraPlugins.push((0, typescript_2.createIvyPlugin)(wco, false, path.resolve(wco.root, webWorkerTsConfig)));
    }
    const extraMinimizers = [];
    if (scriptsOptimization) {
        extraMinimizers.push(new plugins_1.JavaScriptOptimizerPlugin({
            define: buildOptions.aot ? GLOBAL_DEFS_FOR_TERSER_WITH_AOT : GLOBAL_DEFS_FOR_TERSER,
            sourcemap: scriptsSourceMap,
            target: scriptTarget,
            keepIdentifierNames: !environment_options_1.allowMangle || isPlatformServer,
            keepNames: isPlatformServer,
            removeLicenses: buildOptions.extractLicenses,
            advanced: buildOptions.buildOptimizer,
        }));
    }
    if (platform === 'browser' && (scriptsOptimization || stylesOptimization.minify)) {
        extraMinimizers.push(new transfer_size_plugin_1.TransferSizePlugin());
    }
    const externals = [...externalDependencies];
    if (isPlatformServer && !bundleDependencies) {
        externals.push(({ context, request }, callback) => (0, helpers_1.externalizePackages)(context !== null && context !== void 0 ? context : wco.projectRoot, request, callback));
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
        target: [
            isPlatformServer ? 'node' : 'web',
            scriptTarget === typescript_1.ScriptTarget.ES5 ? 'es5' : 'es2015',
        ],
        profile: buildOptions.statsJson,
        resolve: {
            roots: [projectRoot],
            extensions: ['.ts', '.tsx', '.mjs', '.js'],
            symlinks: !buildOptions.preserveSymlinks,
            modules: [tsConfig.options.baseUrl || projectRoot, 'node_modules'],
            ...(0, helpers_1.getMainFieldsAndConditionNames)(scriptTarget, isPlatformServer),
        },
        resolveLoader: {
            symlinks: !buildOptions.preserveSymlinks,
        },
        context: root,
        entry: entryPoints,
        externals,
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
            ignored: poll === undefined ? undefined : '**/node_modules/**',
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
                        /[/\\](?:core-js|@babel|tslib|web-animations-js|web-streams-polyfill|whatwg-url)[/\\]/,
                    ],
                    use: [
                        {
                            loader: require.resolve('../../babel/webpack-loader'),
                            options: {
                                cacheDirectory: (cache.enabled && path.join(cache.path, 'babel-webpack')) || false,
                                scriptTarget,
                                aot: buildOptions.aot,
                                optimize: buildOptions.buildOptimizer,
                                instrumentCode: codeCoverage
                                    ? {
                                        includedBasePath: sourceRoot,
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
                        test: /[\\/]node_modules[\\/]/,
                    },
                },
            },
        },
        plugins: [new named_chunks_plugin_1.NamedChunksPlugin(), new plugins_1.DedupeModuleResolvePlugin({ verbose }), ...extraPlugins],
        node: false,
    };
}
exports.getCommonConfig = getCommonConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhDQUE0RDtBQUM1RCw4RUFBb0Q7QUFDcEQsMkNBQTZCO0FBQzdCLDJDQUEwQztBQUMxQyxxQ0FNaUI7QUFDakIsaUZBQTJFO0FBRzNFLHlFQUE4RDtBQUM5RCxtREFBcUQ7QUFDckQsd0NBTW9CO0FBQ3BCLHdFQUFtRTtBQUNuRSxnRUFBNEQ7QUFDNUQsMEVBQXFFO0FBQ3JFLHNEQUF3RDtBQUN4RCw4Q0FTMEI7QUFFMUIsa0RBQWtEO0FBQzNDLEtBQUssVUFBVSxlQUFlLENBQUMsR0FBeUI7O0lBQzdELE1BQU0sRUFDSixJQUFJLEVBQ0osV0FBVyxFQUNYLFlBQVksRUFDWixRQUFRLEVBQ1IsV0FBVyxFQUNYLFVBQVUsRUFDVixZQUFZLEVBQ1osWUFBWSxHQUNiLEdBQUcsR0FBRyxDQUFDO0lBQ1IsTUFBTSxFQUNKLEtBQUssRUFDTCxZQUFZLEVBQ1osV0FBVyxHQUFHLE1BQU0sRUFDcEIsUUFBUSxHQUFHLFNBQVMsRUFDcEIsR0FBRyxHQUFHLElBQUksRUFDVixtQkFBbUIsR0FBRyxFQUFFLEVBQ3hCLElBQUksRUFDSixTQUFTLEVBQ1QsU0FBUyxFQUFFLEVBQ1QsTUFBTSxFQUFFLGVBQWUsRUFDdkIsT0FBTyxFQUFFLGdCQUFnQixFQUN6QixNQUFNLEVBQUUsZUFBZSxFQUN2QixNQUFNLEVBQUUsZUFBZSxHQUN4QixFQUNELFlBQVksRUFBRSxFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsRUFDMUUsV0FBVyxFQUNYLFdBQVcsRUFDWCxvQkFBb0IsRUFDcEIsT0FBTyxFQUNQLElBQUksRUFDSixpQkFBaUIsRUFDakIsb0JBQW9CLEdBQUcsRUFBRSxFQUN6QiwyQkFBMkIsRUFDM0Isa0JBQWtCLEdBQ25CLEdBQUcsWUFBWSxDQUFDO0lBRWpCLE1BQU0sZ0JBQWdCLEdBQUcsWUFBWSxDQUFDLFFBQVEsS0FBSyxRQUFRLENBQUM7SUFDNUQsTUFBTSxZQUFZLEdBQTBDLEVBQUUsQ0FBQztJQUMvRCxNQUFNLFVBQVUsR0FBa0IsRUFBRSxDQUFDO0lBQ3JDLE1BQU0sV0FBVyxHQUE2QyxFQUFFLENBQUM7SUFFakUsbUZBQW1GO0lBQ25GLHlGQUF5RjtJQUN6RixzQ0FBc0M7SUFDdEMsTUFBTSxFQUNKLHNCQUFzQixFQUN0QiwrQkFBK0IsRUFDL0IsT0FBTyxFQUFFLFVBQVUsR0FDcEIsR0FBRyxNQUFNLElBQUEsd0JBQWEsRUFBeUMsdUJBQXVCLENBQUMsQ0FBQztJQUV6RiwyQkFBMkI7SUFDM0IsTUFBTSxVQUFVLEdBQUcsSUFBQSw2QkFBbUIsRUFBQyxZQUFZLENBQUMsYUFBYSxDQUFDLENBQUM7SUFFbkUsSUFBSSxZQUFZLENBQUMsUUFBUSxFQUFFO1FBQ3pCLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxnQ0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7S0FDakQ7SUFFRCxJQUFJLFlBQVksQ0FBQyxJQUFJLEVBQUU7UUFDckIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZELFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0tBQ2xDO0lBRUQsSUFBSSxnQkFBZ0IsRUFBRTtRQUNwQiwwRUFBMEU7UUFDMUUsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLGtDQUF3QixDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQztLQUN4RTtJQUVELElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtRQUNyQixJQUFJLFlBQVksQ0FBQyxTQUFTLEVBQUU7WUFDMUIsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDcEUsSUFBSSxXQUFXLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQzVCLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQzthQUNqRDtpQkFBTTtnQkFDTCxXQUFXLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO2FBQy9DO1NBQ0Y7UUFFRCxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRTtZQUNyQixNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLG9DQUFvQyxDQUFDLENBQUM7WUFDM0UsSUFBSSxXQUFXLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQzVCLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7YUFDN0M7aUJBQU07Z0JBQ0wsV0FBVyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7YUFDM0M7U0FDRjtLQUNGO0lBRUQsSUFBSSwyQkFBMkIsRUFBRTtRQUMvQiwwRkFBMEY7UUFDMUYsb0NBQW9DO1FBQ3BDLFlBQVksQ0FBQyxJQUFJLENBQ2YsSUFBSSxpQ0FBdUIsQ0FBQztZQUMxQixtQkFBbUIsRUFBRSwyQkFBMkI7U0FDakQsQ0FBQyxDQUNILENBQUM7S0FDSDtJQUVELHlCQUF5QjtJQUN6QixrQ0FBa0M7SUFDbEMsS0FBSyxNQUFNLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsSUFBSSxJQUFBLG1DQUF5QixFQUNuRSxJQUFJLEVBQ0osWUFBWSxDQUFDLE9BQU8sQ0FDckIsRUFBRTtRQUNELHlFQUF5RTtRQUN6RSxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUU3QyxZQUFZLENBQUMsSUFBSSxDQUNmLElBQUksOEJBQW9CLENBQUM7WUFDdkIsSUFBSSxFQUFFLFVBQVU7WUFDaEIsU0FBUyxFQUFFLGdCQUFnQjtZQUMzQixPQUFPLEVBQUUsS0FBSztZQUNkLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEdBQUcsSUFBSSxLQUFLO1lBQ2xELFFBQVEsRUFBRSxXQUFXO1NBQ3RCLENBQUMsQ0FDSCxDQUFDO0tBQ0g7SUFFRCx3QkFBd0I7SUFDeEIsSUFBSSxZQUFZLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtRQUM5QixZQUFZLENBQUMsSUFBSSxDQUNmLElBQUksNkJBQWlCLENBQUM7WUFDcEIsUUFBUSxFQUFFLElBQUEsdUJBQWEsRUFBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLE1BQU0sQ0FBQztTQUNuRCxDQUFDLENBQ0gsQ0FBQztLQUNIO0lBRUQsSUFBSSxZQUFZLENBQUMsZUFBZSxFQUFFO1FBQ2hDLE1BQU0sb0JBQW9CLEdBQUcsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUMsb0JBQW9CLENBQUM7UUFDcEYsWUFBWSxDQUFDLElBQUksQ0FDZixJQUFJLG9CQUFvQixDQUFDO1lBQ3ZCLEtBQUssRUFBRTtnQkFDTCxRQUFRLEVBQUUsS0FBSztnQkFDZixNQUFNLEVBQUUsS0FBSzthQUNkO1lBQ0QsY0FBYyxFQUFFLEtBQUs7WUFDckIsY0FBYyxFQUFFLHNCQUFzQjtZQUN0QyxrQkFBa0IsRUFBRSxJQUFJO1NBQ3pCLENBQUMsQ0FDSCxDQUFDO0tBQ0g7SUFFRCxJQUFJLGdCQUFnQixJQUFJLGVBQWUsRUFBRTtRQUN2QyxNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFDbkIsSUFBSSxnQkFBZ0IsRUFBRTtZQUNwQixPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ3JCO1FBRUQsSUFBSSxlQUFlLEVBQUU7WUFDbkIsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUN0QjtRQUVELFlBQVksQ0FBQyxJQUFJLENBQ2YsSUFBSSxnQ0FBc0IsQ0FBQztZQUN6QixRQUFRLEVBQUUsWUFBWTtZQUN0QixPQUFPO1lBQ1Asc0RBQXNEO1lBQ3RELCtFQUErRTtZQUMvRSxzRkFBc0Y7WUFDdEYsdUNBQXVDO1lBQ3ZDLFVBQVUsRUFBRSxhQUFhO1lBQ3pCLHNCQUFzQixFQUFFLGlCQUFpQjtZQUN6QyxNQUFNLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVM7U0FDNUMsQ0FBQyxDQUNILENBQUM7S0FDSDtJQUVELElBQUksWUFBWSxDQUFDLFNBQVMsRUFBRTtRQUMxQixZQUFZLENBQUMsSUFBSSxDQUNmLElBQUkseUJBQWUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsVUFBVSxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQy9FLENBQUM7S0FDSDtJQUVELElBQUksb0JBQW9CLEVBQUU7UUFDeEIsWUFBWSxDQUFDLElBQUksQ0FDZixJQUFJLDBEQUEwQixDQUFDO1lBQzdCLGFBQWEsRUFBRSxDQUFDLFFBQVEsQ0FBQztTQUMxQixDQUFDLENBQ0gsQ0FBQztLQUNIO0lBRUQsSUFBSSxnQkFBZ0IsSUFBSSxlQUFlLEVBQUU7UUFDdkMsVUFBVSxDQUFDLElBQUksQ0FBQztZQUNkLElBQUksRUFBRSxjQUFjO1lBQ3BCLE9BQU8sRUFBRSxLQUFLO1lBQ2QsTUFBTSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUM7WUFDNUMsT0FBTyxFQUFFO2dCQUNQLHNCQUFzQixFQUFFLENBQUMsT0FBZSxFQUFFLFlBQW9CLEVBQUUsRUFBRTtvQkFDaEUsSUFBSSxlQUFlLEVBQUU7d0JBQ25CLHdEQUF3RDt3QkFDeEQsT0FBTyxJQUFJLENBQUM7cUJBQ2I7b0JBRUQsb0VBQW9FO29CQUNwRSw4Q0FBOEM7b0JBQzlDLE9BQU8sQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxDQUFDO2dCQUNoRCxDQUFDO2FBQ0Y7U0FDRixDQUFDLENBQUM7S0FDSjtJQUVELElBQUksSUFBSSxJQUFJLFNBQVMsRUFBRTtRQUNyQixVQUFVLENBQUMsSUFBSSxDQUFDO1lBQ2QsSUFBSSxFQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsY0FBYztZQUNuRSxNQUFNLEVBQUUsa0NBQXdCO1lBQ2hDLDBHQUEwRztZQUMxRyxPQUFPLEVBQUUsQ0FBQyw2RUFBNkUsQ0FBQztTQUN6RixDQUFDLENBQUM7UUFDSCxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUEsNEJBQWUsRUFBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUM7S0FDNUQ7SUFFRCxJQUFJLGlCQUFpQixFQUFFO1FBQ3JCLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBQSw0QkFBZSxFQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQzNGO0lBRUQsTUFBTSxlQUFlLEdBQUcsRUFBRSxDQUFDO0lBQzNCLElBQUksbUJBQW1CLEVBQUU7UUFDdkIsZUFBZSxDQUFDLElBQUksQ0FDbEIsSUFBSSxtQ0FBeUIsQ0FBQztZQUM1QixNQUFNLEVBQUUsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsK0JBQStCLENBQUMsQ0FBQyxDQUFDLHNCQUFzQjtZQUNuRixTQUFTLEVBQUUsZ0JBQWdCO1lBQzNCLE1BQU0sRUFBRSxZQUFZO1lBQ3BCLG1CQUFtQixFQUFFLENBQUMsaUNBQVcsSUFBSSxnQkFBZ0I7WUFDckQsU0FBUyxFQUFFLGdCQUFnQjtZQUMzQixjQUFjLEVBQUUsWUFBWSxDQUFDLGVBQWU7WUFDNUMsUUFBUSxFQUFFLFlBQVksQ0FBQyxjQUFjO1NBQ3RDLENBQUMsQ0FDSCxDQUFDO0tBQ0g7SUFFRCxJQUFJLFFBQVEsS0FBSyxTQUFTLElBQUksQ0FBQyxtQkFBbUIsSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRTtRQUNoRixlQUFlLENBQUMsSUFBSSxDQUFDLElBQUkseUNBQWtCLEVBQUUsQ0FBQyxDQUFDO0tBQ2hEO0lBRUQsTUFBTSxTQUFTLEdBQStCLENBQUMsR0FBRyxvQkFBb0IsQ0FBQyxDQUFDO0lBQ3hFLElBQUksZ0JBQWdCLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtRQUMzQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEVBQUUsUUFBUSxFQUFFLEVBQUUsQ0FDaEQsSUFBQSw2QkFBbUIsRUFBQyxPQUFPLGFBQVAsT0FBTyxjQUFQLE9BQU8sR0FBSSxHQUFHLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FDbkUsQ0FBQztLQUNIO0lBRUQsSUFBSSxrQkFBa0IsR0FBK0QsS0FBSyxDQUFDO0lBQzNGLElBQUksb0JBQW9CLElBQUksV0FBVyxLQUFLLE1BQU0sRUFBRTtRQUNsRCxrQkFBa0IsR0FBRyxXQUFXLENBQUM7S0FDbEM7U0FBTSxJQUFJLFdBQVcsS0FBSyxNQUFNLEVBQUU7UUFDakMsa0JBQWtCLEdBQUcsV0FBVyxDQUFDO0tBQ2xDO0lBRUQsT0FBTztRQUNMLElBQUksRUFBRSxtQkFBbUIsSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsYUFBYTtRQUNyRixPQUFPLEVBQUUsS0FBSztRQUNkLE1BQU0sRUFBRTtZQUNOLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUs7WUFDakMsWUFBWSxLQUFLLHlCQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVE7U0FDckQ7UUFDRCxPQUFPLEVBQUUsWUFBWSxDQUFDLFNBQVM7UUFDL0IsT0FBTyxFQUFFO1lBQ1AsS0FBSyxFQUFFLENBQUMsV0FBVyxDQUFDO1lBQ3BCLFVBQVUsRUFBRSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQztZQUMxQyxRQUFRLEVBQUUsQ0FBQyxZQUFZLENBQUMsZ0JBQWdCO1lBQ3hDLE9BQU8sRUFBRSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxJQUFJLFdBQVcsRUFBRSxjQUFjLENBQUM7WUFDbEUsR0FBRyxJQUFBLHdDQUE4QixFQUFDLFlBQVksRUFBRSxnQkFBZ0IsQ0FBQztTQUNsRTtRQUNELGFBQWEsRUFBRTtZQUNiLFFBQVEsRUFBRSxDQUFDLFlBQVksQ0FBQyxnQkFBZ0I7U0FDekM7UUFDRCxPQUFPLEVBQUUsSUFBSTtRQUNiLEtBQUssRUFBRSxXQUFXO1FBQ2xCLFNBQVM7UUFDVCxNQUFNLEVBQUU7WUFDTixVQUFVLEVBQUUsV0FBVztZQUN2QixZQUFZLEVBQUUsVUFBVTtZQUN4QixLQUFLLEVBQUUsTUFBQSxZQUFZLENBQUMsZ0JBQWdCLG1DQUFJLElBQUk7WUFDNUMsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxVQUFVLENBQUM7WUFDakQsVUFBVSxFQUFFLE1BQUEsWUFBWSxDQUFDLFNBQVMsbUNBQUksRUFBRTtZQUN4QyxRQUFRLEVBQUUsU0FBUyxVQUFVLENBQUMsS0FBSyxLQUFLO1lBQ3hDLGFBQWEsRUFBRSxTQUFTLFVBQVUsQ0FBQyxLQUFLLEtBQUs7WUFDN0MsYUFBYSxFQUFFLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFNBQVM7WUFDeEQsa0JBQWtCO1lBQ2xCLFlBQVksRUFBRSxpQkFBaUI7WUFDL0IsVUFBVSxFQUFFLFFBQVE7U0FDckI7UUFDRCxLQUFLLEVBQUUsWUFBWSxDQUFDLEtBQUs7UUFDekIsWUFBWSxFQUFFO1lBQ1osSUFBSTtZQUNKLE9BQU8sRUFBRSxJQUFJLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLG9CQUFvQjtTQUMvRDtRQUNELFdBQVcsRUFBRTtZQUNYLEtBQUssRUFBRSxLQUFLO1NBQ2I7UUFDRCxjQUFjLEVBQUU7WUFDZCxzSEFBc0g7WUFDdEgsaUNBQWlDO1lBQ2pDLHlIQUF5SDtZQUN6SCxtQ0FBbUM7WUFDbkMsaUZBQWlGO1lBQ2pGLGtHQUFrRztZQUNsRywrQ0FBK0M7U0FDaEQ7UUFDRCxNQUFNLEVBQUU7WUFDTiwwREFBMEQ7WUFDMUQsb0JBQW9CLEVBQUUsSUFBSTtZQUMxQixNQUFNLEVBQUU7Z0JBQ04sVUFBVSxFQUFFO29CQUNWLHlGQUF5RjtvQkFDekYsMERBQTBEO29CQUMxRCxHQUFHLEVBQUUsS0FBSztvQkFDVixNQUFNLEVBQUUsQ0FBQyxDQUFDLGlCQUFpQjtpQkFDNUI7YUFDRjtZQUNELEtBQUssRUFBRTtnQkFDTDtvQkFDRSxJQUFJLEVBQUUsZ0JBQWdCO29CQUN0Qix5RUFBeUU7b0JBQ3pFLGFBQWEsRUFBRSxjQUFjO29CQUM3QixJQUFJLEVBQUUsY0FBYztpQkFDckI7Z0JBQ0Q7b0JBQ0UsMkRBQTJEO29CQUMzRCxzRUFBc0U7b0JBQ3RFLDBDQUEwQztvQkFDMUMsSUFBSSxFQUFFLCtCQUErQjtvQkFDckMsV0FBVyxFQUFFLElBQUk7aUJBQ2xCO2dCQUNEO29CQUNFLElBQUksRUFBRSxpQkFBaUI7b0JBQ3ZCLHlHQUF5RztvQkFDekcsT0FBTyxFQUFFLEVBQUUsY0FBYyxFQUFFLEtBQUssRUFBRTtvQkFDbEMsT0FBTyxFQUFFO3dCQUNQLHNGQUFzRjtxQkFDdkY7b0JBQ0QsR0FBRyxFQUFFO3dCQUNIOzRCQUNFLE1BQU0sRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLDRCQUE0QixDQUFDOzRCQUNyRCxPQUFPLEVBQUU7Z0NBQ1AsY0FBYyxFQUFFLENBQUMsS0FBSyxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUMsSUFBSSxLQUFLO2dDQUNsRixZQUFZO2dDQUNaLEdBQUcsRUFBRSxZQUFZLENBQUMsR0FBRztnQ0FDckIsUUFBUSxFQUFFLFlBQVksQ0FBQyxjQUFjO2dDQUNyQyxjQUFjLEVBQUUsWUFBWTtvQ0FDMUIsQ0FBQyxDQUFDO3dDQUNFLGdCQUFnQixFQUFFLFVBQVU7d0NBQzVCLGFBQWEsRUFBRSxJQUFBLHlDQUErQixFQUFDLElBQUksRUFBRSxtQkFBbUIsQ0FBQztxQ0FDMUU7b0NBQ0gsQ0FBQyxDQUFDLFNBQVM7NkJBQ2U7eUJBQy9CO3FCQUNGO2lCQUNGO2dCQUNELEdBQUcsVUFBVTthQUNkO1NBQ0Y7UUFDRCxXQUFXLEVBQUU7WUFDWCxVQUFVLEVBQUUsS0FBSztZQUNqQixlQUFlLEVBQUUsSUFBSTtZQUNyQixnQkFBZ0IsRUFBRSxJQUFJO1NBQ3ZCO1FBQ0QscUJBQXFCLEVBQUU7WUFDckIsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPO1NBQ3JDO1FBQ0QsS0FBSyxFQUFFLElBQUEseUJBQWUsRUFBQyxPQUFPLENBQUM7UUFDL0IsS0FBSyxFQUFFLElBQUEsMEJBQWdCLEVBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUM7UUFDN0MsWUFBWSxFQUFFO1lBQ1osU0FBUyxFQUFFLGVBQWU7WUFDMUIsU0FBUyxFQUFFLGVBQWU7WUFDMUIsUUFBUSxFQUFFLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsZUFBZTtZQUM5RCxZQUFZLEVBQUUsS0FBSztZQUNuQixZQUFZLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUTtZQUNqRCxXQUFXLEVBQUU7Z0JBQ1gsZ0JBQWdCLEVBQUUsUUFBUTtnQkFDMUIsV0FBVyxFQUFFO29CQUNYLE9BQU8sRUFBRSxDQUFDLENBQUMsV0FBVyxJQUFJO3dCQUN4QixNQUFNLEVBQUUsT0FBTzt3QkFDZixTQUFTLEVBQUUsQ0FBQzt3QkFDWixRQUFRLEVBQUUsRUFBRTtxQkFDYjtvQkFDRCxNQUFNLEVBQUUsQ0FBQyxDQUFDLFdBQVcsSUFBSTt3QkFDdkIsSUFBSSxFQUFFLFFBQVE7d0JBQ2QsTUFBTSxFQUFFLE9BQU87d0JBQ2YsU0FBUyxFQUFFLENBQUM7d0JBQ1osT0FBTyxFQUFFLElBQUk7d0JBQ2IsUUFBUSxFQUFFLENBQUM7cUJBQ1o7b0JBQ0QsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsY0FBYyxFQUFFLENBQUMsQ0FBQyxXQUFXLElBQUk7d0JBQy9CLElBQUksRUFBRSxRQUFRO3dCQUNkLE1BQU0sRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxNQUFNO3dCQUN4QyxPQUFPLEVBQUUsSUFBSTt3QkFDYixJQUFJLEVBQUUsd0JBQXdCO3FCQUMvQjtpQkFDRjthQUNGO1NBQ0Y7UUFDRCxPQUFPLEVBQUUsQ0FBQyxJQUFJLHVDQUFpQixFQUFFLEVBQUUsSUFBSSxtQ0FBeUIsQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsR0FBRyxZQUFZLENBQUM7UUFDL0YsSUFBSSxFQUFFLEtBQUs7S0FDWixDQUFDO0FBQ0osQ0FBQztBQTdZRCwwQ0E2WUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQW5ndWxhcldlYnBhY2tMb2FkZXJQYXRoIH0gZnJvbSAnQG5ndG9vbHMvd2VicGFjayc7XG5pbXBvcnQgQ29weVdlYnBhY2tQbHVnaW4gZnJvbSAnY29weS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgU2NyaXB0VGFyZ2V0IH0gZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQge1xuICBDb21waWxlcixcbiAgQ29uZmlndXJhdGlvbixcbiAgQ29udGV4dFJlcGxhY2VtZW50UGx1Z2luLFxuICBSdWxlU2V0UnVsZSxcbiAgU291cmNlTWFwRGV2VG9vbFBsdWdpbixcbn0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBTdWJyZXNvdXJjZUludGVncml0eVBsdWdpbiB9IGZyb20gJ3dlYnBhY2stc3VicmVzb3VyY2UtaW50ZWdyaXR5JztcbmltcG9ydCB7IEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnMgfSBmcm9tICcuLi8uLi9iYWJlbC93ZWJwYWNrLWxvYWRlcic7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgYWxsb3dNYW5nbGUgfSBmcm9tICcuLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi8uLi91dGlscy9sb2FkLWVzbSc7XG5pbXBvcnQge1xuICBDb21tb25Kc1VzYWdlV2FyblBsdWdpbixcbiAgRGVkdXBlTW9kdWxlUmVzb2x2ZVBsdWdpbixcbiAgSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbixcbiAgSnNvblN0YXRzUGx1Z2luLFxuICBTY3JpcHRzV2VicGFja1BsdWdpbixcbn0gZnJvbSAnLi4vcGx1Z2lucyc7XG5pbXBvcnQgeyBOYW1lZENodW5rc1BsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvbmFtZWQtY2h1bmtzLXBsdWdpbic7XG5pbXBvcnQgeyBQcm9ncmVzc1BsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvcHJvZ3Jlc3MtcGx1Z2luJztcbmltcG9ydCB7IFRyYW5zZmVyU2l6ZVBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvdHJhbnNmZXItc2l6ZS1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlSXZ5UGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy90eXBlc2NyaXB0JztcbmltcG9ydCB7XG4gIGFzc2V0UGF0dGVybnMsXG4gIGV4dGVybmFsaXplUGFja2FnZXMsXG4gIGdldENhY2hlU2V0dGluZ3MsXG4gIGdldEluc3RydW1lbnRhdGlvbkV4Y2x1ZGVkUGF0aHMsXG4gIGdldE1haW5GaWVsZHNBbmRDb25kaXRpb25OYW1lcyxcbiAgZ2V0T3V0cHV0SGFzaEZvcm1hdCxcbiAgZ2V0U3RhdHNPcHRpb25zLFxuICBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lLFxufSBmcm9tICcuLi91dGlscy9oZWxwZXJzJztcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRDb21tb25Db25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IFByb21pc2U8Q29uZmlndXJhdGlvbj4ge1xuICBjb25zdCB7XG4gICAgcm9vdCxcbiAgICBwcm9qZWN0Um9vdCxcbiAgICBidWlsZE9wdGlvbnMsXG4gICAgdHNDb25maWcsXG4gICAgcHJvamVjdE5hbWUsXG4gICAgc291cmNlUm9vdCxcbiAgICB0c0NvbmZpZ1BhdGgsXG4gICAgc2NyaXB0VGFyZ2V0LFxuICB9ID0gd2NvO1xuICBjb25zdCB7XG4gICAgY2FjaGUsXG4gICAgY29kZUNvdmVyYWdlLFxuICAgIGNyb3NzT3JpZ2luID0gJ25vbmUnLFxuICAgIHBsYXRmb3JtID0gJ2Jyb3dzZXInLFxuICAgIGFvdCA9IHRydWUsXG4gICAgY29kZUNvdmVyYWdlRXhjbHVkZSA9IFtdLFxuICAgIG1haW4sXG4gICAgcG9seWZpbGxzLFxuICAgIHNvdXJjZU1hcDoge1xuICAgICAgc3R5bGVzOiBzdHlsZXNTb3VyY2VNYXAsXG4gICAgICBzY3JpcHRzOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgdmVuZG9yOiB2ZW5kb3JTb3VyY2VNYXAsXG4gICAgICBoaWRkZW46IGhpZGRlblNvdXJjZU1hcCxcbiAgICB9LFxuICAgIG9wdGltaXphdGlvbjogeyBzdHlsZXM6IHN0eWxlc09wdGltaXphdGlvbiwgc2NyaXB0czogc2NyaXB0c09wdGltaXphdGlvbiB9LFxuICAgIGNvbW1vbkNodW5rLFxuICAgIHZlbmRvckNodW5rLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIHZlcmJvc2UsXG4gICAgcG9sbCxcbiAgICB3ZWJXb3JrZXJUc0NvbmZpZyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyA9IFtdLFxuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICBidW5kbGVEZXBlbmRlbmNpZXMsXG4gIH0gPSBidWlsZE9wdGlvbnM7XG5cbiAgY29uc3QgaXNQbGF0Zm9ybVNlcnZlciA9IGJ1aWxkT3B0aW9ucy5wbGF0Zm9ybSA9PT0gJ3NlcnZlcic7XG4gIGNvbnN0IGV4dHJhUGx1Z2luczogeyBhcHBseShjb21waWxlcjogQ29tcGlsZXIpOiB2b2lkIH1bXSA9IFtdO1xuICBjb25zdCBleHRyYVJ1bGVzOiBSdWxlU2V0UnVsZVtdID0gW107XG4gIGNvbnN0IGVudHJ5UG9pbnRzOiB7IFtrZXk6IHN0cmluZ106IFtzdHJpbmcsIC4uLnN0cmluZ1tdXSB9ID0ge307XG5cbiAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgY29uc3Qge1xuICAgIEdMT0JBTF9ERUZTX0ZPUl9URVJTRVIsXG4gICAgR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCxcbiAgICBWRVJTSU9OOiBOR19WRVJTSU9OLFxuICB9ID0gYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGknKT4oJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpO1xuXG4gIC8vIGRldGVybWluZSBoYXNoaW5nIGZvcm1hdFxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyk7XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5wcm9ncmVzcykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBQcm9ncmVzc1BsdWdpbihwbGF0Zm9ybSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5tYWluKSB7XG4gICAgY29uc3QgbWFpblBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm1haW4pO1xuICAgIGVudHJ5UG9pbnRzWydtYWluJ10gPSBbbWFpblBhdGhdO1xuICB9XG5cbiAgaWYgKGlzUGxhdGZvcm1TZXJ2ZXIpIHtcbiAgICAvLyBGaXhlcyBDcml0aWNhbCBkZXBlbmRlbmN5OiB0aGUgcmVxdWVzdCBvZiBhIGRlcGVuZGVuY3kgaXMgYW4gZXhwcmVzc2lvblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBDb250ZXh0UmVwbGFjZW1lbnRQbHVnaW4oL0A/aGFwaXxleHByZXNzW1xcXFwvXS8pKTtcbiAgfVxuXG4gIGlmICghaXNQbGF0Zm9ybVNlcnZlcikge1xuICAgIGlmIChidWlsZE9wdGlvbnMucG9seWZpbGxzKSB7XG4gICAgICBjb25zdCBwcm9qZWN0UG9seWZpbGxzID0gcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5wb2x5ZmlsbHMpO1xuICAgICAgaWYgKGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSkge1xuICAgICAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10ucHVzaChwcm9qZWN0UG9seWZpbGxzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSA9IFtwcm9qZWN0UG9seWZpbGxzXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWJ1aWxkT3B0aW9ucy5hb3QpIHtcbiAgICAgIGNvbnN0IGppdFBvbHlmaWxscyA9IHJlcXVpcmUucmVzb2x2ZSgnY29yZS1qcy9wcm9wb3NhbHMvcmVmbGVjdC1tZXRhZGF0YScpO1xuICAgICAgaWYgKGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSkge1xuICAgICAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10ucHVzaChqaXRQb2x5ZmlsbHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gW2ppdFBvbHlmaWxsc107XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcykge1xuICAgIC8vIFdoZW4gdGhpcyBpcyBub3QgZGVmaW5lZCBpdCBtZWFucyB0aGUgYnVpbGRlciBkb2Vzbid0IHN1cHBvcnQgc2hvd2luZyBjb21tb24ganMgdXNhZ2VzLlxuICAgIC8vIFdoZW4gaXQgZG9lcyBpdCB3aWxsIGJlIGFuIGFycmF5LlxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IENvbW1vbkpzVXNhZ2VXYXJuUGx1Z2luKHtcbiAgICAgICAgYWxsb3dlZERlcGVuZGVuY2llczogYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgZ2xvYmFsIHNjcmlwdHNcbiAgLy8gQWRkIGEgbmV3IGFzc2V0IGZvciBlYWNoIGVudHJ5LlxuICBmb3IgKGNvbnN0IHsgYnVuZGxlTmFtZSwgaW5qZWN0LCBwYXRocyB9IG9mIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUoXG4gICAgcm9vdCxcbiAgICBidWlsZE9wdGlvbnMuc2NyaXB0cyxcbiAgKSkge1xuICAgIC8vIExhenkgc2NyaXB0cyBkb24ndCBnZXQgYSBoYXNoLCBvdGhlcndpc2UgdGhleSBjYW4ndCBiZSBsb2FkZWQgYnkgbmFtZS5cbiAgICBjb25zdCBoYXNoID0gaW5qZWN0ID8gaGFzaEZvcm1hdC5zY3JpcHQgOiAnJztcblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFNjcmlwdHNXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgbmFtZTogYnVuZGxlTmFtZSxcbiAgICAgICAgc291cmNlTWFwOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgICBzY3JpcHRzOiBwYXRocyxcbiAgICAgICAgZmlsZW5hbWU6IGAke3BhdGguYmFzZW5hbWUoYnVuZGxlTmFtZSl9JHtoYXNofS5qc2AsXG4gICAgICAgIGJhc2VQYXRoOiBwcm9qZWN0Um9vdCxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICAvLyBwcm9jZXNzIGFzc2V0IGVudHJpZXNcbiAgaWYgKGJ1aWxkT3B0aW9ucy5hc3NldHMubGVuZ3RoKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgQ29weVdlYnBhY2tQbHVnaW4oe1xuICAgICAgICBwYXR0ZXJuczogYXNzZXRQYXR0ZXJucyhyb290LCBidWlsZE9wdGlvbnMuYXNzZXRzKSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcykge1xuICAgIGNvbnN0IExpY2Vuc2VXZWJwYWNrUGx1Z2luID0gcmVxdWlyZSgnbGljZW5zZS13ZWJwYWNrLXBsdWdpbicpLkxpY2Vuc2VXZWJwYWNrUGx1Z2luO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IExpY2Vuc2VXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICB3YXJuaW5nczogZmFsc2UsXG4gICAgICAgICAgZXJyb3JzOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgcGVyQ2h1bmtPdXRwdXQ6IGZhbHNlLFxuICAgICAgICBvdXRwdXRGaWxlbmFtZTogJzNyZHBhcnR5bGljZW5zZXMudHh0JyxcbiAgICAgICAgc2tpcENoaWxkQ29tcGlsZXJzOiB0cnVlLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzY3JpcHRzU291cmNlTWFwIHx8IHN0eWxlc1NvdXJjZU1hcCkge1xuICAgIGNvbnN0IGluY2x1ZGUgPSBbXTtcbiAgICBpZiAoc2NyaXB0c1NvdXJjZU1hcCkge1xuICAgICAgaW5jbHVkZS5wdXNoKC9qcyQvKTtcbiAgICB9XG5cbiAgICBpZiAoc3R5bGVzU291cmNlTWFwKSB7XG4gICAgICBpbmNsdWRlLnB1c2goL2NzcyQvKTtcbiAgICB9XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBTb3VyY2VNYXBEZXZUb29sUGx1Z2luKHtcbiAgICAgICAgZmlsZW5hbWU6ICdbZmlsZV0ubWFwJyxcbiAgICAgICAgaW5jbHVkZSxcbiAgICAgICAgLy8gV2Ugd2FudCB0byBzZXQgc291cmNlUm9vdCB0byAgYHdlYnBhY2s6Ly8vYCBmb3Igbm9uXG4gICAgICAgIC8vIGlubGluZSBzb3VyY2VtYXBzIGFzIG90aGVyd2lzZSBwYXRocyB0byBzb3VyY2VtYXBzIHdpbGwgYmUgYnJva2VuIGluIGJyb3dzZXJcbiAgICAgICAgLy8gYHdlYnBhY2s6Ly8vYCBpcyBuZWVkZWQgZm9yIFZpc3VhbCBTdHVkaW8gYnJlYWtwb2ludHMgdG8gd29yayBwcm9wZXJseSBhcyBjdXJyZW50bHlcbiAgICAgICAgLy8gdGhlcmUgaXMgbm8gd2F5IHRvIHNldCB0aGUgJ3dlYlJvb3QnXG4gICAgICAgIHNvdXJjZVJvb3Q6ICd3ZWJwYWNrOi8vLycsXG4gICAgICAgIG1vZHVsZUZpbGVuYW1lVGVtcGxhdGU6ICdbcmVzb3VyY2UtcGF0aF0nLFxuICAgICAgICBhcHBlbmQ6IGhpZGRlblNvdXJjZU1hcCA/IGZhbHNlIDogdW5kZWZpbmVkLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3RhdHNKc29uKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgSnNvblN0YXRzUGx1Z2luKHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCwgJ3N0YXRzLmpzb24nKSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzdWJyZXNvdXJjZUludGVncml0eSkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFN1YnJlc291cmNlSW50ZWdyaXR5UGx1Z2luKHtcbiAgICAgICAgaGFzaEZ1bmNOYW1lczogWydzaGEzODQnXSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoc2NyaXB0c1NvdXJjZU1hcCB8fCBzdHlsZXNTb3VyY2VNYXApIHtcbiAgICBleHRyYVJ1bGVzLnB1c2goe1xuICAgICAgdGVzdDogL1xcLltjbV0/anN4PyQvLFxuICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnc291cmNlLW1hcC1sb2FkZXInKSxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgZmlsdGVyU291cmNlTWFwcGluZ1VybDogKF9tYXBVcmk6IHN0cmluZywgcmVzb3VyY2VQYXRoOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICBpZiAodmVuZG9yU291cmNlTWFwKSB7XG4gICAgICAgICAgICAvLyBDb25zdW1lIGFsbCBzb3VyY2VtYXBzIHdoZW4gdmVuZG9yIG9wdGlvbiBpcyBlbmFibGVkLlxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gRG9uJ3QgY29uc3VtZSBzb3VyY2VtYXBzIGluIG5vZGVfbW9kdWxlcyB3aGVuIHZlbmRvciBpcyBkaXNhYmxlZC5cbiAgICAgICAgICAvLyBCdXQsIGRvIGNvbnN1bWUgbG9jYWwgbGlicmFyaWVzIHNvdXJjZW1hcHMuXG4gICAgICAgICAgcmV0dXJuICFyZXNvdXJjZVBhdGguaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChtYWluIHx8IHBvbHlmaWxscykge1xuICAgIGV4dHJhUnVsZXMucHVzaCh7XG4gICAgICB0ZXN0OiB0c0NvbmZpZy5vcHRpb25zLmFsbG93SnMgPyAvXFwuW2NtXT9bdGpdc3g/JC8gOiAvXFwuW2NtXT90c3g/JC8sXG4gICAgICBsb2FkZXI6IEFuZ3VsYXJXZWJwYWNrTG9hZGVyUGF0aCxcbiAgICAgIC8vIFRoZSBiZWxvdyBhcmUga25vd24gcGF0aHMgdGhhdCBhcmUgbm90IHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gZXZlbiB3aGVuIGFsbG93SnMgaXMgZW5hYmxlZC5cbiAgICAgIGV4Y2x1ZGU6IFsvWy9cXFxcXSg/OmNzcy1sb2FkZXJ8bWluaS1jc3MtZXh0cmFjdC1wbHVnaW58d2VicGFjay1kZXYtc2VydmVyfHdlYnBhY2spWy9cXFxcXS9dLFxuICAgIH0pO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGNyZWF0ZUl2eVBsdWdpbih3Y28sIGFvdCwgdHNDb25maWdQYXRoKSk7XG4gIH1cblxuICBpZiAod2ViV29ya2VyVHNDb25maWcpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChjcmVhdGVJdnlQbHVnaW4od2NvLCBmYWxzZSwgcGF0aC5yZXNvbHZlKHdjby5yb290LCB3ZWJXb3JrZXJUc0NvbmZpZykpKTtcbiAgfVxuXG4gIGNvbnN0IGV4dHJhTWluaW1pemVycyA9IFtdO1xuICBpZiAoc2NyaXB0c09wdGltaXphdGlvbikge1xuICAgIGV4dHJhTWluaW1pemVycy5wdXNoKFxuICAgICAgbmV3IEphdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW4oe1xuICAgICAgICBkZWZpbmU6IGJ1aWxkT3B0aW9ucy5hb3QgPyBHTE9CQUxfREVGU19GT1JfVEVSU0VSX1dJVEhfQU9UIDogR0xPQkFMX0RFRlNfRk9SX1RFUlNFUixcbiAgICAgICAgc291cmNlbWFwOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgICB0YXJnZXQ6IHNjcmlwdFRhcmdldCxcbiAgICAgICAga2VlcElkZW50aWZpZXJOYW1lczogIWFsbG93TWFuZ2xlIHx8IGlzUGxhdGZvcm1TZXJ2ZXIsXG4gICAgICAgIGtlZXBOYW1lczogaXNQbGF0Zm9ybVNlcnZlcixcbiAgICAgICAgcmVtb3ZlTGljZW5zZXM6IGJ1aWxkT3B0aW9ucy5leHRyYWN0TGljZW5zZXMsXG4gICAgICAgIGFkdmFuY2VkOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHBsYXRmb3JtID09PSAnYnJvd3NlcicgJiYgKHNjcmlwdHNPcHRpbWl6YXRpb24gfHwgc3R5bGVzT3B0aW1pemF0aW9uLm1pbmlmeSkpIHtcbiAgICBleHRyYU1pbmltaXplcnMucHVzaChuZXcgVHJhbnNmZXJTaXplUGx1Z2luKCkpO1xuICB9XG5cbiAgY29uc3QgZXh0ZXJuYWxzOiBDb25maWd1cmF0aW9uWydleHRlcm5hbHMnXSA9IFsuLi5leHRlcm5hbERlcGVuZGVuY2llc107XG4gIGlmIChpc1BsYXRmb3JtU2VydmVyICYmICFidW5kbGVEZXBlbmRlbmNpZXMpIHtcbiAgICBleHRlcm5hbHMucHVzaCgoeyBjb250ZXh0LCByZXF1ZXN0IH0sIGNhbGxiYWNrKSA9PlxuICAgICAgZXh0ZXJuYWxpemVQYWNrYWdlcyhjb250ZXh0ID8/IHdjby5wcm9qZWN0Um9vdCwgcmVxdWVzdCwgY2FsbGJhY2spLFxuICAgICk7XG4gIH1cblxuICBsZXQgY3Jvc3NPcmlnaW5Mb2FkaW5nOiBOb25OdWxsYWJsZTxDb25maWd1cmF0aW9uWydvdXRwdXQnXT5bJ2Nyb3NzT3JpZ2luTG9hZGluZyddID0gZmFsc2U7XG4gIGlmIChzdWJyZXNvdXJjZUludGVncml0eSAmJiBjcm9zc09yaWdpbiA9PT0gJ25vbmUnKSB7XG4gICAgY3Jvc3NPcmlnaW5Mb2FkaW5nID0gJ2Fub255bW91cyc7XG4gIH0gZWxzZSBpZiAoY3Jvc3NPcmlnaW4gIT09ICdub25lJykge1xuICAgIGNyb3NzT3JpZ2luTG9hZGluZyA9IGNyb3NzT3JpZ2luO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBtb2RlOiBzY3JpcHRzT3B0aW1pemF0aW9uIHx8IHN0eWxlc09wdGltaXphdGlvbi5taW5pZnkgPyAncHJvZHVjdGlvbicgOiAnZGV2ZWxvcG1lbnQnLFxuICAgIGRldnRvb2w6IGZhbHNlLFxuICAgIHRhcmdldDogW1xuICAgICAgaXNQbGF0Zm9ybVNlcnZlciA/ICdub2RlJyA6ICd3ZWInLFxuICAgICAgc2NyaXB0VGFyZ2V0ID09PSBTY3JpcHRUYXJnZXQuRVM1ID8gJ2VzNScgOiAnZXMyMDE1JyxcbiAgICBdLFxuICAgIHByb2ZpbGU6IGJ1aWxkT3B0aW9ucy5zdGF0c0pzb24sXG4gICAgcmVzb2x2ZToge1xuICAgICAgcm9vdHM6IFtwcm9qZWN0Um9vdF0sXG4gICAgICBleHRlbnNpb25zOiBbJy50cycsICcudHN4JywgJy5tanMnLCAnLmpzJ10sXG4gICAgICBzeW1saW5rczogIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgbW9kdWxlczogW3RzQ29uZmlnLm9wdGlvbnMuYmFzZVVybCB8fCBwcm9qZWN0Um9vdCwgJ25vZGVfbW9kdWxlcyddLFxuICAgICAgLi4uZ2V0TWFpbkZpZWxkc0FuZENvbmRpdGlvbk5hbWVzKHNjcmlwdFRhcmdldCwgaXNQbGF0Zm9ybVNlcnZlciksXG4gICAgfSxcbiAgICByZXNvbHZlTG9hZGVyOiB7XG4gICAgICBzeW1saW5rczogIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIH0sXG4gICAgY29udGV4dDogcm9vdCxcbiAgICBlbnRyeTogZW50cnlQb2ludHMsXG4gICAgZXh0ZXJuYWxzLFxuICAgIG91dHB1dDoge1xuICAgICAgdW5pcXVlTmFtZTogcHJvamVjdE5hbWUsXG4gICAgICBoYXNoRnVuY3Rpb246ICd4eGhhc2g2NCcsIC8vIHRvZG86IHJlbW92ZSBpbiB3ZWJwYWNrIDYuIFRoaXMgaXMgcGFydCBvZiBgZnV0dXJlRGVmYXVsdHNgLlxuICAgICAgY2xlYW46IGJ1aWxkT3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoID8/IHRydWUsXG4gICAgICBwYXRoOiBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm91dHB1dFBhdGgpLFxuICAgICAgcHVibGljUGF0aDogYnVpbGRPcHRpb25zLmRlcGxveVVybCA/PyAnJyxcbiAgICAgIGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmNodW5rfS5qc2AsXG4gICAgICBjaHVua0ZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmNodW5rfS5qc2AsXG4gICAgICBsaWJyYXJ5VGFyZ2V0OiBpc1BsYXRmb3JtU2VydmVyID8gJ2NvbW1vbmpzJyA6IHVuZGVmaW5lZCxcbiAgICAgIGNyb3NzT3JpZ2luTG9hZGluZyxcbiAgICAgIHRydXN0ZWRUeXBlczogJ2FuZ3VsYXIjYnVuZGxlcicsXG4gICAgICBzY3JpcHRUeXBlOiAnbW9kdWxlJyxcbiAgICB9LFxuICAgIHdhdGNoOiBidWlsZE9wdGlvbnMud2F0Y2gsXG4gICAgd2F0Y2hPcHRpb25zOiB7XG4gICAgICBwb2xsLFxuICAgICAgaWdub3JlZDogcG9sbCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogJyoqL25vZGVfbW9kdWxlcy8qKicsXG4gICAgfSxcbiAgICBwZXJmb3JtYW5jZToge1xuICAgICAgaGludHM6IGZhbHNlLFxuICAgIH0sXG4gICAgaWdub3JlV2FybmluZ3M6IFtcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc291cmNlLW1hcC1sb2FkZXIvYmxvYi9iMmRlNDI0OWM3NDMxZGQ4NDMyZGE2MDdlMDhmMGY2NWU5ZDY0MjE5L3NyYy9pbmRleC5qcyNMODNcbiAgICAgIC9GYWlsZWQgdG8gcGFyc2Ugc291cmNlIG1hcCBmcm9tLyxcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvcG9zdGNzcy1sb2FkZXIvYmxvYi9iZDI2MTg3NWZkZjljNTk2YWY0ZmZiM2ExYTczZmUzYzU0OWJlZmRhL3NyYy9pbmRleC5qcyNMMTUzLUwxNThcbiAgICAgIC9BZGQgcG9zdGNzcyBhcyBwcm9qZWN0IGRlcGVuZGVuY3kvLFxuICAgICAgLy8gZXNidWlsZCB3aWxsIGlzc3VlIGEgd2FybmluZywgd2hpbGUgc3RpbGwgaG9pc3RzIHRoZSBAY2hhcnNldCBhdCB0aGUgdmVyeSB0b3AuXG4gICAgICAvLyBUaGlzIGlzIGNhdXNlZCBieSBhIGJ1ZyBpbiBjc3MtbG9hZGVyIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvY3NzLWxvYWRlci9pc3N1ZXMvMTIxMlxuICAgICAgL1wiQGNoYXJzZXRcIiBtdXN0IGJlIHRoZSBmaXJzdCBydWxlIGluIHRoZSBmaWxlLyxcbiAgICBdLFxuICAgIG1vZHVsZToge1xuICAgICAgLy8gU2hvdyBhbiBlcnJvciBmb3IgbWlzc2luZyBleHBvcnRzIGluc3RlYWQgb2YgYSB3YXJuaW5nLlxuICAgICAgc3RyaWN0RXhwb3J0UHJlc2VuY2U6IHRydWUsXG4gICAgICBwYXJzZXI6IHtcbiAgICAgICAgamF2YXNjcmlwdDoge1xuICAgICAgICAgIC8vIERpc2FibGUgYXV0byBVUkwgYXNzZXQgbW9kdWxlIGNyZWF0aW9uLiBUaGlzIGRvZXNuJ3QgZWZmZWN0IGBuZXcgV29ya2VyKG5ldyBVUkwoLi4uKSlgXG4gICAgICAgICAgLy8gaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9ndWlkZXMvYXNzZXQtbW9kdWxlcy8jdXJsLWFzc2V0c1xuICAgICAgICAgIHVybDogZmFsc2UsXG4gICAgICAgICAgd29ya2VyOiAhIXdlYldvcmtlclRzQ29uZmlnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuPyhzdmd8aHRtbCkkLyxcbiAgICAgICAgICAvLyBPbmx5IHByb2Nlc3MgSFRNTCBhbmQgU1ZHIHdoaWNoIGFyZSBrbm93biBBbmd1bGFyIGNvbXBvbmVudCByZXNvdXJjZXMuXG4gICAgICAgICAgcmVzb3VyY2VRdWVyeTogL1xcP25nUmVzb3VyY2UvLFxuICAgICAgICAgIHR5cGU6ICdhc3NldC9zb3VyY2UnLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgLy8gTWFyayBmaWxlcyBpbnNpZGUgYHJ4anMvYWRkYCBhcyBjb250YWluaW5nIHNpZGUgZWZmZWN0cy5cbiAgICAgICAgICAvLyBJZiB0aGlzIGlzIGZpeGVkIHVwc3RyZWFtIGFuZCB0aGUgZml4ZWQgdmVyc2lvbiBiZWNvbWVzIHRoZSBtaW5pbXVtXG4gICAgICAgICAgLy8gc3VwcG9ydGVkIHZlcnNpb24sIHRoaXMgY2FuIGJlIHJlbW92ZWQuXG4gICAgICAgICAgdGVzdDogL1svXFxcXF1yeGpzWy9cXFxcXWFkZFsvXFxcXF0uK1xcLmpzJC8sXG4gICAgICAgICAgc2lkZUVmZmVjdHM6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuW2NtXT9bdGpdc3g/JC8sXG4gICAgICAgICAgLy8gVGhlIGJlbG93IGlzIG5lZWRlZCBkdWUgdG8gYSBidWcgaW4gYEBiYWJlbC9ydW50aW1lYC4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYmFiZWwvYmFiZWwvaXNzdWVzLzEyODI0XG4gICAgICAgICAgcmVzb2x2ZTogeyBmdWxseVNwZWNpZmllZDogZmFsc2UgfSxcbiAgICAgICAgICBleGNsdWRlOiBbXG4gICAgICAgICAgICAvWy9cXFxcXSg/OmNvcmUtanN8QGJhYmVsfHRzbGlifHdlYi1hbmltYXRpb25zLWpzfHdlYi1zdHJlYW1zLXBvbHlmaWxsfHdoYXR3Zy11cmwpWy9cXFxcXS8sXG4gICAgICAgICAgXSxcbiAgICAgICAgICB1c2U6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJy4uLy4uL2JhYmVsL3dlYnBhY2stbG9hZGVyJyksXG4gICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICBjYWNoZURpcmVjdG9yeTogKGNhY2hlLmVuYWJsZWQgJiYgcGF0aC5qb2luKGNhY2hlLnBhdGgsICdiYWJlbC13ZWJwYWNrJykpIHx8IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNjcmlwdFRhcmdldCxcbiAgICAgICAgICAgICAgICBhb3Q6IGJ1aWxkT3B0aW9ucy5hb3QsXG4gICAgICAgICAgICAgICAgb3B0aW1pemU6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgICAgICAgICAgICBpbnN0cnVtZW50Q29kZTogY29kZUNvdmVyYWdlXG4gICAgICAgICAgICAgICAgICA/IHtcbiAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZEJhc2VQYXRoOiBzb3VyY2VSb290LFxuICAgICAgICAgICAgICAgICAgICAgIGV4Y2x1ZGVkUGF0aHM6IGdldEluc3RydW1lbnRhdGlvbkV4Y2x1ZGVkUGF0aHMocm9vdCwgY29kZUNvdmVyYWdlRXhjbHVkZSksXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICB9IGFzIEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIC4uLmV4dHJhUnVsZXMsXG4gICAgICBdLFxuICAgIH0sXG4gICAgZXhwZXJpbWVudHM6IHtcbiAgICAgIGJhY2tDb21wYXQ6IGZhbHNlLFxuICAgICAgc3luY1dlYkFzc2VtYmx5OiB0cnVlLFxuICAgICAgYXN5bmNXZWJBc3NlbWJseTogdHJ1ZSxcbiAgICB9LFxuICAgIGluZnJhc3RydWN0dXJlTG9nZ2luZzoge1xuICAgICAgbGV2ZWw6IHZlcmJvc2UgPyAndmVyYm9zZScgOiAnZXJyb3InLFxuICAgIH0sXG4gICAgc3RhdHM6IGdldFN0YXRzT3B0aW9ucyh2ZXJib3NlKSxcbiAgICBjYWNoZTogZ2V0Q2FjaGVTZXR0aW5ncyh3Y28sIE5HX1ZFUlNJT04uZnVsbCksXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICBtaW5pbWl6ZXI6IGV4dHJhTWluaW1pemVycyxcbiAgICAgIG1vZHVsZUlkczogJ2RldGVybWluaXN0aWMnLFxuICAgICAgY2h1bmtJZHM6IGJ1aWxkT3B0aW9ucy5uYW1lZENodW5rcyA/ICduYW1lZCcgOiAnZGV0ZXJtaW5pc3RpYycsXG4gICAgICBlbWl0T25FcnJvcnM6IGZhbHNlLFxuICAgICAgcnVudGltZUNodW5rOiBpc1BsYXRmb3JtU2VydmVyID8gZmFsc2UgOiAnc2luZ2xlJyxcbiAgICAgIHNwbGl0Q2h1bmtzOiB7XG4gICAgICAgIG1heEFzeW5jUmVxdWVzdHM6IEluZmluaXR5LFxuICAgICAgICBjYWNoZUdyb3Vwczoge1xuICAgICAgICAgIGRlZmF1bHQ6ICEhY29tbW9uQ2h1bmsgJiYge1xuICAgICAgICAgICAgY2h1bmtzOiAnYXN5bmMnLFxuICAgICAgICAgICAgbWluQ2h1bmtzOiAyLFxuICAgICAgICAgICAgcHJpb3JpdHk6IDEwLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29tbW9uOiAhIWNvbW1vbkNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21tb24nLFxuICAgICAgICAgICAgY2h1bmtzOiAnYXN5bmMnLFxuICAgICAgICAgICAgbWluQ2h1bmtzOiAyLFxuICAgICAgICAgICAgZW5mb3JjZTogdHJ1ZSxcbiAgICAgICAgICAgIHByaW9yaXR5OiA1LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdmVuZG9yczogZmFsc2UsXG4gICAgICAgICAgZGVmYXVsdFZlbmRvcnM6ICEhdmVuZG9yQ2h1bmsgJiYge1xuICAgICAgICAgICAgbmFtZTogJ3ZlbmRvcicsXG4gICAgICAgICAgICBjaHVua3M6IChjaHVuaykgPT4gY2h1bmsubmFtZSA9PT0gJ21haW4nLFxuICAgICAgICAgICAgZW5mb3JjZTogdHJ1ZSxcbiAgICAgICAgICAgIHRlc3Q6IC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS8sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbbmV3IE5hbWVkQ2h1bmtzUGx1Z2luKCksIG5ldyBEZWR1cGVNb2R1bGVSZXNvbHZlUGx1Z2luKHsgdmVyYm9zZSB9KSwgLi4uZXh0cmFQbHVnaW5zXSxcbiAgICBub2RlOiBmYWxzZSxcbiAgfTtcbn1cbiJdfQ==