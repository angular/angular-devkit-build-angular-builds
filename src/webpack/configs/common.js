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
const devtools_ignore_plugin_1 = require("../plugins/devtools-ignore-plugin");
const named_chunks_plugin_1 = require("../plugins/named-chunks-plugin");
const progress_plugin_1 = require("../plugins/progress-plugin");
const transfer_size_plugin_1 = require("../plugins/transfer-size-plugin");
const typescript_2 = require("../plugins/typescript");
const watch_files_logs_plugin_1 = require("../plugins/watch-files-logs-plugin");
const helpers_1 = require("../utils/helpers");
const VENDORS_TEST = /[\\/]node_modules[\\/]/;
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
                                scriptTarget,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhDQUE0RDtBQUM1RCw4RUFBb0Q7QUFDcEQsMkNBQTZCO0FBQzdCLDJDQUEwQztBQUMxQyxxQ0FNaUI7QUFDakIsaUZBQTJFO0FBRzNFLHlFQUE4RDtBQUM5RCxtREFBcUQ7QUFDckQsd0NBTW9CO0FBQ3BCLDhFQUF5RTtBQUN6RSx3RUFBbUU7QUFDbkUsZ0VBQTREO0FBQzVELDBFQUFxRTtBQUNyRSxzREFBd0Q7QUFDeEQsZ0ZBQTBFO0FBQzFFLDhDQVMwQjtBQUUxQixNQUFNLFlBQVksR0FBRyx3QkFBd0IsQ0FBQztBQUU5QyxrREFBa0Q7QUFDM0MsS0FBSyxVQUFVLGVBQWUsQ0FBQyxHQUF5Qjs7SUFDN0QsTUFBTSxFQUNKLElBQUksRUFDSixXQUFXLEVBQ1gsWUFBWSxFQUNaLFFBQVEsRUFDUixXQUFXLEVBQ1gsVUFBVSxFQUNWLFlBQVksRUFDWixZQUFZLEdBQ2IsR0FBRyxHQUFHLENBQUM7SUFDUixNQUFNLEVBQ0osS0FBSyxFQUNMLFlBQVksRUFDWixXQUFXLEdBQUcsTUFBTSxFQUNwQixRQUFRLEdBQUcsU0FBUyxFQUNwQixHQUFHLEdBQUcsSUFBSSxFQUNWLG1CQUFtQixHQUFHLEVBQUUsRUFDeEIsSUFBSSxFQUNKLFNBQVMsRUFDVCxTQUFTLEVBQUUsRUFDVCxNQUFNLEVBQUUsZUFBZSxFQUN2QixPQUFPLEVBQUUsZ0JBQWdCLEVBQ3pCLE1BQU0sRUFBRSxlQUFlLEVBQ3ZCLE1BQU0sRUFBRSxlQUFlLEdBQ3hCLEVBQ0QsWUFBWSxFQUFFLEVBQUUsTUFBTSxFQUFFLGtCQUFrQixF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QUMsV0FBVyxJQUFJO3dCQUN4QixNQUFNLEVBQUUsT0FBTzt3QkFDZixTQUFTLEVBQUUsQ0FBQzt3QkFDWixRQUFRLEVBQUUsRUFBRTtxQkFDYjtvQkFDRCxNQUFNLEVBQUUsQ0FBQyxDQUFDLFdBQVcsSUFBSTt3QkFDdkIsSUFBSSxFQUFFLFFBQVE7d0JBQ2QsTUFBTSxFQUFFLE9BQU87d0JBQ2YsU0FBUyxFQUFFLENBQUM7d0JBQ1osT0FBTyxFQUFFLElBQUk7d0JBQ2IsUUFBUSxFQUFFLENBQUM7cUJBQ1o7b0JBQ0QsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsY0FBYyxFQUFFLENBQUMsQ0FBQyxXQUFXLElBQUk7d0JBQy9CLElBQUksRUFBRSxRQUFRO3dCQUNkLE1BQU0sRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxNQUFNO3dCQUN4QyxPQUFPLEVBQUUsSUFBSTt3QkFDYixJQUFJLEVBQUUsWUFBWTtxQkFDbkI7aUJBQ0Y7YUFDRjtTQUNGO1FBQ0QsT0FBTyxFQUFFLENBQUMsSUFBSSx1Q0FBaUIsRUFBRSxFQUFFLElBQUksbUNBQXlCLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLEdBQUcsWUFBWSxDQUFDO1FBQy9GLElBQUksRUFBRSxLQUFLO0tBQ1osQ0FBQztBQUNKLENBQUM7QUF2WkQsMENBdVpDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEFuZ3VsYXJXZWJwYWNrTG9hZGVyUGF0aCB9IGZyb20gJ0BuZ3Rvb2xzL3dlYnBhY2snO1xuaW1wb3J0IENvcHlXZWJwYWNrUGx1Z2luIGZyb20gJ2NvcHktd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IFNjcmlwdFRhcmdldCB9IGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtcbiAgQ29tcGlsZXIsXG4gIENvbmZpZ3VyYXRpb24sXG4gIENvbnRleHRSZXBsYWNlbWVudFBsdWdpbixcbiAgUnVsZVNldFJ1bGUsXG4gIFNvdXJjZU1hcERldlRvb2xQbHVnaW4sXG59IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4gfSBmcm9tICd3ZWJwYWNrLXN1YnJlc291cmNlLWludGVncml0eSc7XG5pbXBvcnQgeyBBbmd1bGFyQmFiZWxMb2FkZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IGFsbG93TWFuZ2xlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHtcbiAgQ29tbW9uSnNVc2FnZVdhcm5QbHVnaW4sXG4gIERlZHVwZU1vZHVsZVJlc29sdmVQbHVnaW4sXG4gIEphdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW4sXG4gIEpzb25TdGF0c1BsdWdpbixcbiAgU2NyaXB0c1dlYnBhY2tQbHVnaW4sXG59IGZyb20gJy4uL3BsdWdpbnMnO1xuaW1wb3J0IHsgRGV2VG9vbHNJZ25vcmVQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL2RldnRvb2xzLWlnbm9yZS1wbHVnaW4nO1xuaW1wb3J0IHsgTmFtZWRDaHVua3NQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL25hbWVkLWNodW5rcy1wbHVnaW4nO1xuaW1wb3J0IHsgUHJvZ3Jlc3NQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3Byb2dyZXNzLXBsdWdpbic7XG5pbXBvcnQgeyBUcmFuc2ZlclNpemVQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3RyYW5zZmVyLXNpemUtcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZUl2eVBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvdHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBXYXRjaEZpbGVzTG9nc1BsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvd2F0Y2gtZmlsZXMtbG9ncy1wbHVnaW4nO1xuaW1wb3J0IHtcbiAgYXNzZXRQYXR0ZXJucyxcbiAgZXh0ZXJuYWxpemVQYWNrYWdlcyxcbiAgZ2V0Q2FjaGVTZXR0aW5ncyxcbiAgZ2V0SW5zdHJ1bWVudGF0aW9uRXhjbHVkZWRQYXRocyxcbiAgZ2V0TWFpbkZpZWxkc0FuZENvbmRpdGlvbk5hbWVzLFxuICBnZXRPdXRwdXRIYXNoRm9ybWF0LFxuICBnZXRTdGF0c09wdGlvbnMsXG4gIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUsXG59IGZyb20gJy4uL3V0aWxzL2hlbHBlcnMnO1xuXG5jb25zdCBWRU5ET1JTX1RFU1QgPSAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vO1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldENvbW1vbkNvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKTogUHJvbWlzZTxDb25maWd1cmF0aW9uPiB7XG4gIGNvbnN0IHtcbiAgICByb290LFxuICAgIHByb2plY3RSb290LFxuICAgIGJ1aWxkT3B0aW9ucyxcbiAgICB0c0NvbmZpZyxcbiAgICBwcm9qZWN0TmFtZSxcbiAgICBzb3VyY2VSb290LFxuICAgIHRzQ29uZmlnUGF0aCxcbiAgICBzY3JpcHRUYXJnZXQsXG4gIH0gPSB3Y287XG4gIGNvbnN0IHtcbiAgICBjYWNoZSxcbiAgICBjb2RlQ292ZXJhZ2UsXG4gICAgY3Jvc3NPcmlnaW4gPSAnbm9uZScsXG4gICAgcGxhdGZvcm0gPSAnYnJvd3NlcicsXG4gICAgYW90ID0gdHJ1ZSxcbiAgICBjb2RlQ292ZXJhZ2VFeGNsdWRlID0gW10sXG4gICAgbWFpbixcbiAgICBwb2x5ZmlsbHMsXG4gICAgc291cmNlTWFwOiB7XG4gICAgICBzdHlsZXM6IHN0eWxlc1NvdXJjZU1hcCxcbiAgICAgIHNjcmlwdHM6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICB2ZW5kb3I6IHZlbmRvclNvdXJjZU1hcCxcbiAgICAgIGhpZGRlbjogaGlkZGVuU291cmNlTWFwLFxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7IHN0eWxlczogc3R5bGVzT3B0aW1pemF0aW9uLCBzY3JpcHRzOiBzY3JpcHRzT3B0aW1pemF0aW9uIH0sXG4gICAgY29tbW9uQ2h1bmssXG4gICAgdmVuZG9yQ2h1bmssXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgdmVyYm9zZSxcbiAgICBwb2xsLFxuICAgIHdlYldvcmtlclRzQ29uZmlnLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzID0gW10sXG4gICAgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgIGJ1bmRsZURlcGVuZGVuY2llcyxcbiAgfSA9IGJ1aWxkT3B0aW9ucztcblxuICBjb25zdCBpc1BsYXRmb3JtU2VydmVyID0gYnVpbGRPcHRpb25zLnBsYXRmb3JtID09PSAnc2VydmVyJztcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiB7IGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcik6IHZvaWQgfVtdID0gW107XG4gIGNvbnN0IGV4dHJhUnVsZXM6IFJ1bGVTZXRSdWxlW10gPSBbXTtcbiAgY29uc3QgZW50cnlQb2ludHM6IHsgW2tleTogc3RyaW5nXTogW3N0cmluZywgLi4uc3RyaW5nW11dIH0gPSB7fTtcblxuICAvLyBMb2FkIEVTTSBgQGFuZ3VsYXIvY29tcGlsZXItY2xpYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICBjb25zdCB7XG4gICAgR0xPQkFMX0RFRlNfRk9SX1RFUlNFUixcbiAgICBHTE9CQUxfREVGU19GT1JfVEVSU0VSX1dJVEhfQU9ULFxuICAgIFZFUlNJT046IE5HX1ZFUlNJT04sXG4gIH0gPSBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpPignQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk7XG5cbiAgLy8gZGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0XG4gIGNvbnN0IGhhc2hGb3JtYXQgPSBnZXRPdXRwdXRIYXNoRm9ybWF0KGJ1aWxkT3B0aW9ucy5vdXRwdXRIYXNoaW5nKTtcblxuICBpZiAoYnVpbGRPcHRpb25zLnByb2dyZXNzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFByb2dyZXNzUGx1Z2luKHBsYXRmb3JtKSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLm1haW4pIHtcbiAgICBjb25zdCBtYWluUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMubWFpbik7XG4gICAgZW50cnlQb2ludHNbJ21haW4nXSA9IFttYWluUGF0aF07XG4gIH1cblxuICBpZiAoaXNQbGF0Zm9ybVNlcnZlcikge1xuICAgIC8vIEZpeGVzIENyaXRpY2FsIGRlcGVuZGVuY3k6IHRoZSByZXF1ZXN0IG9mIGEgZGVwZW5kZW5jeSBpcyBhbiBleHByZXNzaW9uXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IENvbnRleHRSZXBsYWNlbWVudFBsdWdpbigvQD9oYXBpfGV4cHJlc3NbXFxcXC9dLykpO1xuICB9XG5cbiAgaWYgKCFpc1BsYXRmb3JtU2VydmVyKSB7XG4gICAgaWYgKGJ1aWxkT3B0aW9ucy5wb2x5ZmlsbHMpIHtcbiAgICAgIGNvbnN0IHByb2plY3RQb2x5ZmlsbHMgPSBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLnBvbHlmaWxscyk7XG4gICAgICBpZiAoZW50cnlQb2ludHNbJ3BvbHlmaWxscyddKSB7XG4gICAgICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXS5wdXNoKHByb2plY3RQb2x5ZmlsbHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gW3Byb2plY3RQb2x5ZmlsbHNdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMpIHtcbiAgICAvLyBXaGVuIHRoaXMgaXMgbm90IGRlZmluZWQgaXQgbWVhbnMgdGhlIGJ1aWxkZXIgZG9lc24ndCBzdXBwb3J0IHNob3dpbmcgY29tbW9uIGpzIHVzYWdlcy5cbiAgICAvLyBXaGVuIGl0IGRvZXMgaXQgd2lsbCBiZSBhbiBhcnJheS5cbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBDb21tb25Kc1VzYWdlV2FyblBsdWdpbih7XG4gICAgICAgIGFsbG93ZWREZXBlbmRlbmNpZXM6IGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICAvLyBwcm9jZXNzIGdsb2JhbCBzY3JpcHRzXG4gIC8vIEFkZCBhIG5ldyBhc3NldCBmb3IgZWFjaCBlbnRyeS5cbiAgZm9yIChjb25zdCB7IGJ1bmRsZU5hbWUsIGluamVjdCwgcGF0aHMgfSBvZiBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lKFxuICAgIHJvb3QsXG4gICAgYnVpbGRPcHRpb25zLnNjcmlwdHMsXG4gICkpIHtcbiAgICAvLyBMYXp5IHNjcmlwdHMgZG9uJ3QgZ2V0IGEgaGFzaCwgb3RoZXJ3aXNlIHRoZXkgY2FuJ3QgYmUgbG9hZGVkIGJ5IG5hbWUuXG4gICAgY29uc3QgaGFzaCA9IGluamVjdCA/IGhhc2hGb3JtYXQuc2NyaXB0IDogJyc7XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBTY3JpcHRzV2VicGFja1BsdWdpbih7XG4gICAgICAgIG5hbWU6IGJ1bmRsZU5hbWUsXG4gICAgICAgIHNvdXJjZU1hcDogc2NyaXB0c1NvdXJjZU1hcCxcbiAgICAgICAgc2NyaXB0czogcGF0aHMsXG4gICAgICAgIGZpbGVuYW1lOiBgJHtwYXRoLmJhc2VuYW1lKGJ1bmRsZU5hbWUpfSR7aGFzaH0uanNgLFxuICAgICAgICBiYXNlUGF0aDogcHJvamVjdFJvb3QsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgLy8gcHJvY2VzcyBhc3NldCBlbnRyaWVzXG4gIGlmIChidWlsZE9wdGlvbnMuYXNzZXRzLmxlbmd0aCkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IENvcHlXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgcGF0dGVybnM6IGFzc2V0UGF0dGVybnMocm9vdCwgYnVpbGRPcHRpb25zLmFzc2V0cyksXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5leHRyYWN0TGljZW5zZXMpIHtcbiAgICBjb25zdCBMaWNlbnNlV2VicGFja1BsdWdpbiA9IHJlcXVpcmUoJ2xpY2Vuc2Utd2VicGFjay1wbHVnaW4nKS5MaWNlbnNlV2VicGFja1BsdWdpbjtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBMaWNlbnNlV2VicGFja1BsdWdpbih7XG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgd2FybmluZ3M6IGZhbHNlLFxuICAgICAgICAgIGVycm9yczogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIHBlckNodW5rT3V0cHV0OiBmYWxzZSxcbiAgICAgICAgb3V0cHV0RmlsZW5hbWU6ICczcmRwYXJ0eWxpY2Vuc2VzLnR4dCcsXG4gICAgICAgIHNraXBDaGlsZENvbXBpbGVyczogdHJ1ZSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoc2NyaXB0c1NvdXJjZU1hcCB8fCBzdHlsZXNTb3VyY2VNYXApIHtcbiAgICBjb25zdCBpbmNsdWRlID0gW107XG4gICAgaWYgKHNjcmlwdHNTb3VyY2VNYXApIHtcbiAgICAgIGluY2x1ZGUucHVzaCgvanMkLyk7XG4gICAgfVxuXG4gICAgaWYgKHN0eWxlc1NvdXJjZU1hcCkge1xuICAgICAgaW5jbHVkZS5wdXNoKC9jc3MkLyk7XG4gICAgfVxuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IERldlRvb2xzSWdub3JlUGx1Z2luKCkpO1xuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU291cmNlTWFwRGV2VG9vbFBsdWdpbih7XG4gICAgICAgIGZpbGVuYW1lOiAnW2ZpbGVdLm1hcCcsXG4gICAgICAgIGluY2x1ZGUsXG4gICAgICAgIC8vIFdlIHdhbnQgdG8gc2V0IHNvdXJjZVJvb3QgdG8gIGB3ZWJwYWNrOi8vL2AgZm9yIG5vblxuICAgICAgICAvLyBpbmxpbmUgc291cmNlbWFwcyBhcyBvdGhlcndpc2UgcGF0aHMgdG8gc291cmNlbWFwcyB3aWxsIGJlIGJyb2tlbiBpbiBicm93c2VyXG4gICAgICAgIC8vIGB3ZWJwYWNrOi8vL2AgaXMgbmVlZGVkIGZvciBWaXN1YWwgU3R1ZGlvIGJyZWFrcG9pbnRzIHRvIHdvcmsgcHJvcGVybHkgYXMgY3VycmVudGx5XG4gICAgICAgIC8vIHRoZXJlIGlzIG5vIHdheSB0byBzZXQgdGhlICd3ZWJSb290J1xuICAgICAgICBzb3VyY2VSb290OiAnd2VicGFjazovLy8nLFxuICAgICAgICBtb2R1bGVGaWxlbmFtZVRlbXBsYXRlOiAnW3Jlc291cmNlLXBhdGhdJyxcbiAgICAgICAgYXBwZW5kOiBoaWRkZW5Tb3VyY2VNYXAgPyBmYWxzZSA6IHVuZGVmaW5lZCxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAodmVyYm9zZSkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBXYXRjaEZpbGVzTG9nc1BsdWdpbigpKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3RhdHNKc29uKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgSnNvblN0YXRzUGx1Z2luKHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCwgJ3N0YXRzLmpzb24nKSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzdWJyZXNvdXJjZUludGVncml0eSkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFN1YnJlc291cmNlSW50ZWdyaXR5UGx1Z2luKHtcbiAgICAgICAgaGFzaEZ1bmNOYW1lczogWydzaGEzODQnXSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoc2NyaXB0c1NvdXJjZU1hcCB8fCBzdHlsZXNTb3VyY2VNYXApIHtcbiAgICBleHRyYVJ1bGVzLnB1c2goe1xuICAgICAgdGVzdDogL1xcLltjbV0/anN4PyQvLFxuICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnc291cmNlLW1hcC1sb2FkZXInKSxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgZmlsdGVyU291cmNlTWFwcGluZ1VybDogKF9tYXBVcmk6IHN0cmluZywgcmVzb3VyY2VQYXRoOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICBpZiAodmVuZG9yU291cmNlTWFwKSB7XG4gICAgICAgICAgICAvLyBDb25zdW1lIGFsbCBzb3VyY2VtYXBzIHdoZW4gdmVuZG9yIG9wdGlvbiBpcyBlbmFibGVkLlxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gRG9uJ3QgY29uc3VtZSBzb3VyY2VtYXBzIGluIG5vZGVfbW9kdWxlcyB3aGVuIHZlbmRvciBpcyBkaXNhYmxlZC5cbiAgICAgICAgICAvLyBCdXQsIGRvIGNvbnN1bWUgbG9jYWwgbGlicmFyaWVzIHNvdXJjZW1hcHMuXG4gICAgICAgICAgcmV0dXJuICFyZXNvdXJjZVBhdGguaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChtYWluIHx8IHBvbHlmaWxscykge1xuICAgIGV4dHJhUnVsZXMucHVzaCh7XG4gICAgICB0ZXN0OiB0c0NvbmZpZy5vcHRpb25zLmFsbG93SnMgPyAvXFwuW2NtXT9bdGpdc3g/JC8gOiAvXFwuW2NtXT90c3g/JC8sXG4gICAgICBsb2FkZXI6IEFuZ3VsYXJXZWJwYWNrTG9hZGVyUGF0aCxcbiAgICAgIC8vIFRoZSBiZWxvdyBhcmUga25vd24gcGF0aHMgdGhhdCBhcmUgbm90IHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gZXZlbiB3aGVuIGFsbG93SnMgaXMgZW5hYmxlZC5cbiAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgL1tcXFxcL11ub2RlX21vZHVsZXNbL1xcXFxdKD86Y3NzLWxvYWRlcnxtaW5pLWNzcy1leHRyYWN0LXBsdWdpbnx3ZWJwYWNrLWRldi1zZXJ2ZXJ8d2VicGFjaylbL1xcXFxdLyxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goY3JlYXRlSXZ5UGx1Z2luKHdjbywgYW90LCB0c0NvbmZpZ1BhdGgpKTtcbiAgfVxuXG4gIGlmICh3ZWJXb3JrZXJUc0NvbmZpZykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGNyZWF0ZUl2eVBsdWdpbih3Y28sIGZhbHNlLCBwYXRoLnJlc29sdmUod2NvLnJvb3QsIHdlYldvcmtlclRzQ29uZmlnKSkpO1xuICB9XG5cbiAgY29uc3QgZXh0cmFNaW5pbWl6ZXJzID0gW107XG4gIGlmIChzY3JpcHRzT3B0aW1pemF0aW9uKSB7XG4gICAgZXh0cmFNaW5pbWl6ZXJzLnB1c2goXG4gICAgICBuZXcgSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbih7XG4gICAgICAgIGRlZmluZTogYnVpbGRPcHRpb25zLmFvdCA/IEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QgOiBHTE9CQUxfREVGU19GT1JfVEVSU0VSLFxuICAgICAgICBzb3VyY2VtYXA6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICAgIHRhcmdldDogc2NyaXB0VGFyZ2V0LFxuICAgICAgICBrZWVwSWRlbnRpZmllck5hbWVzOiAhYWxsb3dNYW5nbGUgfHwgaXNQbGF0Zm9ybVNlcnZlcixcbiAgICAgICAga2VlcE5hbWVzOiBpc1BsYXRmb3JtU2VydmVyLFxuICAgICAgICByZW1vdmVMaWNlbnNlczogYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcyxcbiAgICAgICAgYWR2YW5jZWQ6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAocGxhdGZvcm0gPT09ICdicm93c2VyJyAmJiAoc2NyaXB0c09wdGltaXphdGlvbiB8fCBzdHlsZXNPcHRpbWl6YXRpb24ubWluaWZ5KSkge1xuICAgIGV4dHJhTWluaW1pemVycy5wdXNoKG5ldyBUcmFuc2ZlclNpemVQbHVnaW4oKSk7XG4gIH1cblxuICBjb25zdCBleHRlcm5hbHM6IENvbmZpZ3VyYXRpb25bJ2V4dGVybmFscyddID0gWy4uLmV4dGVybmFsRGVwZW5kZW5jaWVzXTtcbiAgaWYgKGlzUGxhdGZvcm1TZXJ2ZXIgJiYgIWJ1bmRsZURlcGVuZGVuY2llcykge1xuICAgIGV4dGVybmFscy5wdXNoKCh7IGNvbnRleHQsIHJlcXVlc3QgfSwgY2FsbGJhY2spID0+XG4gICAgICBleHRlcm5hbGl6ZVBhY2thZ2VzKGNvbnRleHQgPz8gd2NvLnByb2plY3RSb290LCByZXF1ZXN0LCBjYWxsYmFjayksXG4gICAgKTtcbiAgfVxuXG4gIGxldCBjcm9zc09yaWdpbkxvYWRpbmc6IE5vbk51bGxhYmxlPENvbmZpZ3VyYXRpb25bJ291dHB1dCddPlsnY3Jvc3NPcmlnaW5Mb2FkaW5nJ10gPSBmYWxzZTtcbiAgaWYgKHN1YnJlc291cmNlSW50ZWdyaXR5ICYmIGNyb3NzT3JpZ2luID09PSAnbm9uZScpIHtcbiAgICBjcm9zc09yaWdpbkxvYWRpbmcgPSAnYW5vbnltb3VzJztcbiAgfSBlbHNlIGlmIChjcm9zc09yaWdpbiAhPT0gJ25vbmUnKSB7XG4gICAgY3Jvc3NPcmlnaW5Mb2FkaW5nID0gY3Jvc3NPcmlnaW47XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG1vZGU6IHNjcmlwdHNPcHRpbWl6YXRpb24gfHwgc3R5bGVzT3B0aW1pemF0aW9uLm1pbmlmeSA/ICdwcm9kdWN0aW9uJyA6ICdkZXZlbG9wbWVudCcsXG4gICAgZGV2dG9vbDogZmFsc2UsXG4gICAgdGFyZ2V0OiBbXG4gICAgICBpc1BsYXRmb3JtU2VydmVyID8gJ25vZGUnIDogJ3dlYicsXG4gICAgICBzY3JpcHRUYXJnZXQgPT09IFNjcmlwdFRhcmdldC5FUzUgPyAnZXM1JyA6ICdlczIwMTUnLFxuICAgIF0sXG4gICAgcHJvZmlsZTogYnVpbGRPcHRpb25zLnN0YXRzSnNvbixcbiAgICByZXNvbHZlOiB7XG4gICAgICByb290czogW3Byb2plY3RSb290XSxcbiAgICAgIGV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICBtb2R1bGVzOiBbdHNDb25maWcub3B0aW9ucy5iYXNlVXJsIHx8IHByb2plY3RSb290LCAnbm9kZV9tb2R1bGVzJ10sXG4gICAgICAuLi5nZXRNYWluRmllbGRzQW5kQ29uZGl0aW9uTmFtZXMoc2NyaXB0VGFyZ2V0LCBpc1BsYXRmb3JtU2VydmVyKSxcbiAgICB9LFxuICAgIHJlc29sdmVMb2FkZXI6IHtcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgfSxcbiAgICBjb250ZXh0OiByb290LFxuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBleHRlcm5hbHMsXG4gICAgb3V0cHV0OiB7XG4gICAgICB1bmlxdWVOYW1lOiBwcm9qZWN0TmFtZSxcbiAgICAgIGhhc2hGdW5jdGlvbjogJ3h4aGFzaDY0JywgLy8gdG9kbzogcmVtb3ZlIGluIHdlYnBhY2sgNi4gVGhpcyBpcyBwYXJ0IG9mIGBmdXR1cmVEZWZhdWx0c2AuXG4gICAgICBjbGVhbjogYnVpbGRPcHRpb25zLmRlbGV0ZU91dHB1dFBhdGggPz8gdHJ1ZSxcbiAgICAgIHBhdGg6IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCksXG4gICAgICBwdWJsaWNQYXRoOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsID8/ICcnLFxuICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICAgIGNodW5rRmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICAgIGxpYnJhcnlUYXJnZXQ6IGlzUGxhdGZvcm1TZXJ2ZXIgPyAnY29tbW9uanMnIDogdW5kZWZpbmVkLFxuICAgICAgY3Jvc3NPcmlnaW5Mb2FkaW5nLFxuICAgICAgdHJ1c3RlZFR5cGVzOiAnYW5ndWxhciNidW5kbGVyJyxcbiAgICAgIHNjcmlwdFR5cGU6ICdtb2R1bGUnLFxuICAgIH0sXG4gICAgd2F0Y2g6IGJ1aWxkT3B0aW9ucy53YXRjaCxcbiAgICB3YXRjaE9wdGlvbnM6IHtcbiAgICAgIHBvbGwsXG4gICAgICAvLyBUaGUgYmVsb3cgaXMgbmVlZGVkIGFzIHdoZW4gcHJlc2VydmVTeW1saW5rcyBpcyBlbmFibGVkIHdlIGRpc2FibGUgYHJlc29sdmUuc3ltbGlua3NgLlxuICAgICAgZm9sbG93U3ltbGlua3M6IGJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgaWdub3JlZDogcG9sbCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogJyoqL25vZGVfbW9kdWxlcy8qKicsXG4gICAgfSxcbiAgICBzbmFwc2hvdDoge1xuICAgICAgbW9kdWxlOiB7XG4gICAgICAgIC8vIFVzZSBoYXNoIG9mIGNvbnRlbnQgaW5zdGVhZCBvZiB0aW1lc3RhbXAgYmVjYXVzZSB0aGUgdGltZXN0YW1wIG9mIHRoZSBzeW1saW5rIHdpbGwgYmUgdXNlZFxuICAgICAgICAvLyBpbnN0ZWFkIG9mIHRoZSByZWZlcmVuY2VkIGZpbGVzIHdoaWNoIGNhdXNlcyBjaGFuZ2VzIGluIHN5bWxpbmtzIG5vdCB0byBiZSBwaWNrZWQgdXAuXG4gICAgICAgIGhhc2g6IGJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHBlcmZvcm1hbmNlOiB7XG4gICAgICBoaW50czogZmFsc2UsXG4gICAgfSxcbiAgICBpZ25vcmVXYXJuaW5nczogW1xuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zb3VyY2UtbWFwLWxvYWRlci9ibG9iL2IyZGU0MjQ5Yzc0MzFkZDg0MzJkYTYwN2UwOGYwZjY1ZTlkNjQyMTkvc3JjL2luZGV4LmpzI0w4M1xuICAgICAgL0ZhaWxlZCB0byBwYXJzZSBzb3VyY2UgbWFwIGZyb20vLFxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9wb3N0Y3NzLWxvYWRlci9ibG9iL2JkMjYxODc1ZmRmOWM1OTZhZjRmZmIzYTFhNzNmZTNjNTQ5YmVmZGEvc3JjL2luZGV4LmpzI0wxNTMtTDE1OFxuICAgICAgL0FkZCBwb3N0Y3NzIGFzIHByb2plY3QgZGVwZW5kZW5jeS8sXG4gICAgICAvLyBlc2J1aWxkIHdpbGwgaXNzdWUgYSB3YXJuaW5nLCB3aGlsZSBzdGlsbCBob2lzdHMgdGhlIEBjaGFyc2V0IGF0IHRoZSB2ZXJ5IHRvcC5cbiAgICAgIC8vIFRoaXMgaXMgY2F1c2VkIGJ5IGEgYnVnIGluIGNzcy1sb2FkZXIgaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9jc3MtbG9hZGVyL2lzc3Vlcy8xMjEyXG4gICAgICAvXCJAY2hhcnNldFwiIG11c3QgYmUgdGhlIGZpcnN0IHJ1bGUgaW4gdGhlIGZpbGUvLFxuICAgIF0sXG4gICAgbW9kdWxlOiB7XG4gICAgICAvLyBTaG93IGFuIGVycm9yIGZvciBtaXNzaW5nIGV4cG9ydHMgaW5zdGVhZCBvZiBhIHdhcm5pbmcuXG4gICAgICBzdHJpY3RFeHBvcnRQcmVzZW5jZTogdHJ1ZSxcbiAgICAgIHBhcnNlcjoge1xuICAgICAgICBqYXZhc2NyaXB0OiB7XG4gICAgICAgICAgLy8gRGlzYWJsZSBhdXRvIFVSTCBhc3NldCBtb2R1bGUgY3JlYXRpb24uIFRoaXMgZG9lc24ndCBlZmZlY3QgYG5ldyBXb3JrZXIobmV3IFVSTCguLi4pKWBcbiAgICAgICAgICAvLyBodHRwczovL3dlYnBhY2suanMub3JnL2d1aWRlcy9hc3NldC1tb2R1bGVzLyN1cmwtYXNzZXRzXG4gICAgICAgICAgdXJsOiBmYWxzZSxcbiAgICAgICAgICB3b3JrZXI6ICEhd2ViV29ya2VyVHNDb25maWcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC4/KHN2Z3xodG1sKSQvLFxuICAgICAgICAgIC8vIE9ubHkgcHJvY2VzcyBIVE1MIGFuZCBTVkcgd2hpY2ggYXJlIGtub3duIEFuZ3VsYXIgY29tcG9uZW50IHJlc291cmNlcy5cbiAgICAgICAgICByZXNvdXJjZVF1ZXJ5OiAvXFw/bmdSZXNvdXJjZS8sXG4gICAgICAgICAgdHlwZTogJ2Fzc2V0L3NvdXJjZScsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBNYXJrIGZpbGVzIGluc2lkZSBgcnhqcy9hZGRgIGFzIGNvbnRhaW5pbmcgc2lkZSBlZmZlY3RzLlxuICAgICAgICAgIC8vIElmIHRoaXMgaXMgZml4ZWQgdXBzdHJlYW0gYW5kIHRoZSBmaXhlZCB2ZXJzaW9uIGJlY29tZXMgdGhlIG1pbmltdW1cbiAgICAgICAgICAvLyBzdXBwb3J0ZWQgdmVyc2lvbiwgdGhpcyBjYW4gYmUgcmVtb3ZlZC5cbiAgICAgICAgICB0ZXN0OiAvWy9cXFxcXXJ4anNbL1xcXFxdYWRkWy9cXFxcXS4rXFwuanMkLyxcbiAgICAgICAgICBzaWRlRWZmZWN0czogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5bY21dP1t0al1zeD8kLyxcbiAgICAgICAgICAvLyBUaGUgYmVsb3cgaXMgbmVlZGVkIGR1ZSB0byBhIGJ1ZyBpbiBgQGJhYmVsL3J1bnRpbWVgLiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9iYWJlbC9iYWJlbC9pc3N1ZXMvMTI4MjRcbiAgICAgICAgICByZXNvbHZlOiB7IGZ1bGx5U3BlY2lmaWVkOiBmYWxzZSB9LFxuICAgICAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgICAgIC9bXFxcXC9dbm9kZV9tb2R1bGVzWy9cXFxcXSg/OmNvcmUtanN8QGJhYmVsfHRzbGlifHdlYi1hbmltYXRpb25zLWpzfHdlYi1zdHJlYW1zLXBvbHlmaWxsfHdoYXR3Zy11cmwpWy9cXFxcXS8sXG4gICAgICAgICAgXSxcbiAgICAgICAgICB1c2U6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJy4uLy4uL2JhYmVsL3dlYnBhY2stbG9hZGVyJyksXG4gICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICBjYWNoZURpcmVjdG9yeTogKGNhY2hlLmVuYWJsZWQgJiYgcGF0aC5qb2luKGNhY2hlLnBhdGgsICdiYWJlbC13ZWJwYWNrJykpIHx8IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNjcmlwdFRhcmdldCxcbiAgICAgICAgICAgICAgICBhb3Q6IGJ1aWxkT3B0aW9ucy5hb3QsXG4gICAgICAgICAgICAgICAgb3B0aW1pemU6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgICAgICAgICAgICBzdXBwb3J0ZWRCcm93c2VyczogYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICAgICAgICAgIGluc3RydW1lbnRDb2RlOiBjb2RlQ292ZXJhZ2VcbiAgICAgICAgICAgICAgICAgID8ge1xuICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkQmFzZVBhdGg6IHNvdXJjZVJvb3QgPz8gcHJvamVjdFJvb3QsXG4gICAgICAgICAgICAgICAgICAgICAgZXhjbHVkZWRQYXRoczogZ2V0SW5zdHJ1bWVudGF0aW9uRXhjbHVkZWRQYXRocyhyb290LCBjb2RlQ292ZXJhZ2VFeGNsdWRlKSxcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgIH0gYXMgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgLi4uZXh0cmFSdWxlcyxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBleHBlcmltZW50czoge1xuICAgICAgYmFja0NvbXBhdDogZmFsc2UsXG4gICAgICBzeW5jV2ViQXNzZW1ibHk6IHRydWUsXG4gICAgICBhc3luY1dlYkFzc2VtYmx5OiB0cnVlLFxuICAgIH0sXG4gICAgaW5mcmFzdHJ1Y3R1cmVMb2dnaW5nOiB7XG4gICAgICBkZWJ1ZzogdmVyYm9zZSxcbiAgICAgIGxldmVsOiB2ZXJib3NlID8gJ3ZlcmJvc2UnIDogJ2Vycm9yJyxcbiAgICB9LFxuICAgIHN0YXRzOiBnZXRTdGF0c09wdGlvbnModmVyYm9zZSksXG4gICAgY2FjaGU6IGdldENhY2hlU2V0dGluZ3Mod2NvLCBOR19WRVJTSU9OLmZ1bGwpLFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgbWluaW1pemVyOiBleHRyYU1pbmltaXplcnMsXG4gICAgICBtb2R1bGVJZHM6ICdkZXRlcm1pbmlzdGljJyxcbiAgICAgIGNodW5rSWRzOiBidWlsZE9wdGlvbnMubmFtZWRDaHVua3MgPyAnbmFtZWQnIDogJ2RldGVybWluaXN0aWMnLFxuICAgICAgZW1pdE9uRXJyb3JzOiBmYWxzZSxcbiAgICAgIHJ1bnRpbWVDaHVuazogaXNQbGF0Zm9ybVNlcnZlciA/IGZhbHNlIDogJ3NpbmdsZScsXG4gICAgICBzcGxpdENodW5rczoge1xuICAgICAgICBtYXhBc3luY1JlcXVlc3RzOiBJbmZpbml0eSxcbiAgICAgICAgY2FjaGVHcm91cHM6IHtcbiAgICAgICAgICBkZWZhdWx0OiAhIWNvbW1vbkNodW5rICYmIHtcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIHByaW9yaXR5OiAxMCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbW1vbjogISFjb21tb25DaHVuayAmJiB7XG4gICAgICAgICAgICBuYW1lOiAnY29tbW9uJyxcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICBwcmlvcml0eTogNSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZlbmRvcnM6IGZhbHNlLFxuICAgICAgICAgIGRlZmF1bHRWZW5kb3JzOiAhIXZlbmRvckNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICd2ZW5kb3InLFxuICAgICAgICAgICAgY2h1bmtzOiAoY2h1bmspID0+IGNodW5rLm5hbWUgPT09ICdtYWluJyxcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICB0ZXN0OiBWRU5ET1JTX1RFU1QsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbbmV3IE5hbWVkQ2h1bmtzUGx1Z2luKCksIG5ldyBEZWR1cGVNb2R1bGVSZXNvbHZlUGx1Z2luKHsgdmVyYm9zZSB9KSwgLi4uZXh0cmFQbHVnaW5zXSxcbiAgICBub2RlOiBmYWxzZSxcbiAgfTtcbn1cbiJdfQ==