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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
    const hashFormat = (0, helpers_1.getOutputHashFormat)(buildOptions.outputHashing || 'none');
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
    if (buildOptions.showCircularDependencies) {
        const CircularDependencyPlugin = require('circular-dependency-plugin');
        extraPlugins.push(new CircularDependencyPlugin({
            exclude: /[\\/]node_modules[\\/]/,
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
                    exclude: [/[/\\](?:core-js|@babel|tslib|web-animations-js|web-streams-polyfill)[/\\]/],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsOENBQTREO0FBQzVELDhFQUFvRDtBQUNwRCwyQ0FBNkI7QUFDN0IsMkNBQTBDO0FBQzFDLHFDQU1pQjtBQUNqQixpRkFBMkU7QUFHM0UseUVBQThEO0FBQzlELG1EQUFxRDtBQUNyRCx3Q0FNb0I7QUFDcEIsd0VBQW1FO0FBQ25FLGdFQUE0RDtBQUM1RCwwRUFBcUU7QUFDckUsc0RBQXdEO0FBQ3hELDhDQVMwQjtBQUUxQixrREFBa0Q7QUFDM0MsS0FBSyxVQUFVLGVBQWUsQ0FBQyxHQUF5Qjs7SUFDN0QsTUFBTSxFQUNKLElBQUksRUFDSixXQUFXLEVBQ1gsWUFBWSxFQUNaLFFBQVEsRUFDUixXQUFXLEVBQ1gsVUFBVSxFQUNWLFlBQVksRUFDWixZQUFZLEdBQ2IsR0FBRyxHQUFHLENBQUM7SUFDUixNQUFNLEVBQ0osS0FBSyxFQUNMLFlBQVksRUFDWixXQUFXLEdBQUcsTUFBTSxFQUNwQixRQUFRLEdBQUcsU0FBUyxFQUNwQixHQUFHLEdBQUcsSUFBSSxFQUNWLG1CQUFtQixHQUFHLEVBQUUsRUFDeEIsSUFBSSxFQUNKLFNBQVMsRUFDVCxTQUFTLEVBQUUsRUFDVCxNQUFNLEVBQUUsZUFBZSxFQUN2QixPQUFPLEVBQUUsZ0JBQWdCLEVBQ3pCLE1BQU0sRUFBRSxlQUFlLEVBQ3ZCLE1BQU0sRUFBRSxlQUFlLEdBQ3hCLEVBQ0QsWUFBWSxFQUFFLEVBQUUsTUFBTSxFQUFFLGtCQUFrQixFQUFFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxFQUMxRSxXQUFXLEVBQ1gsV0FBVyxFQUNYLG9CQUFvQixFQUNw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LEVBQUUsQ0FBQyxDQUFDLFdBQVcsSUFBSTt3QkFDeEIsTUFBTSxFQUFFLE9BQU87d0JBQ2YsU0FBUyxFQUFFLENBQUM7d0JBQ1osUUFBUSxFQUFFLEVBQUU7cUJBQ2I7b0JBQ0QsTUFBTSxFQUFFLENBQUMsQ0FBQyxXQUFXLElBQUk7d0JBQ3ZCLElBQUksRUFBRSxRQUFRO3dCQUNkLE1BQU0sRUFBRSxPQUFPO3dCQUNmLFNBQVMsRUFBRSxDQUFDO3dCQUNaLE9BQU8sRUFBRSxJQUFJO3dCQUNiLFFBQVEsRUFBRSxDQUFDO3FCQUNaO29CQUNELE9BQU8sRUFBRSxLQUFLO29CQUNkLGNBQWMsRUFBRSxDQUFDLENBQUMsV0FBVyxJQUFJO3dCQUMvQixJQUFJLEVBQUUsUUFBUTt3QkFDZCxNQUFNLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssTUFBTTt3QkFDeEMsT0FBTyxFQUFFLElBQUk7d0JBQ2IsSUFBSSxFQUFFLHdCQUF3QjtxQkFDL0I7aUJBQ0Y7YUFDRjtTQUNGO1FBQ0QsT0FBTyxFQUFFLENBQUMsSUFBSSx1Q0FBaUIsRUFBRSxFQUFFLElBQUksbUNBQXlCLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLEdBQUcsWUFBWSxDQUFDO1FBQy9GLElBQUksRUFBRSxLQUFLO0tBQ1osQ0FBQztBQUNKLENBQUM7QUFwWkQsMENBb1pDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEFuZ3VsYXJXZWJwYWNrTG9hZGVyUGF0aCB9IGZyb20gJ0BuZ3Rvb2xzL3dlYnBhY2snO1xuaW1wb3J0IENvcHlXZWJwYWNrUGx1Z2luIGZyb20gJ2NvcHktd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IFNjcmlwdFRhcmdldCB9IGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtcbiAgQ29tcGlsZXIsXG4gIENvbmZpZ3VyYXRpb24sXG4gIENvbnRleHRSZXBsYWNlbWVudFBsdWdpbixcbiAgUnVsZVNldFJ1bGUsXG4gIFNvdXJjZU1hcERldlRvb2xQbHVnaW4sXG59IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4gfSBmcm9tICd3ZWJwYWNrLXN1YnJlc291cmNlLWludGVncml0eSc7XG5pbXBvcnQgeyBBbmd1bGFyQmFiZWxMb2FkZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IGFsbG93TWFuZ2xlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHtcbiAgQ29tbW9uSnNVc2FnZVdhcm5QbHVnaW4sXG4gIERlZHVwZU1vZHVsZVJlc29sdmVQbHVnaW4sXG4gIEphdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW4sXG4gIEpzb25TdGF0c1BsdWdpbixcbiAgU2NyaXB0c1dlYnBhY2tQbHVnaW4sXG59IGZyb20gJy4uL3BsdWdpbnMnO1xuaW1wb3J0IHsgTmFtZWRDaHVua3NQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL25hbWVkLWNodW5rcy1wbHVnaW4nO1xuaW1wb3J0IHsgUHJvZ3Jlc3NQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3Byb2dyZXNzLXBsdWdpbic7XG5pbXBvcnQgeyBUcmFuc2ZlclNpemVQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3RyYW5zZmVyLXNpemUtcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZUl2eVBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvdHlwZXNjcmlwdCc7XG5pbXBvcnQge1xuICBhc3NldFBhdHRlcm5zLFxuICBleHRlcm5hbGl6ZVBhY2thZ2VzLFxuICBnZXRDYWNoZVNldHRpbmdzLFxuICBnZXRJbnN0cnVtZW50YXRpb25FeGNsdWRlZFBhdGhzLFxuICBnZXRNYWluRmllbGRzQW5kQ29uZGl0aW9uTmFtZXMsXG4gIGdldE91dHB1dEhhc2hGb3JtYXQsXG4gIGdldFN0YXRzT3B0aW9ucyxcbiAgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZSxcbn0gZnJvbSAnLi4vdXRpbHMvaGVscGVycyc7XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q29tbW9uQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpOiBQcm9taXNlPENvbmZpZ3VyYXRpb24+IHtcbiAgY29uc3Qge1xuICAgIHJvb3QsXG4gICAgcHJvamVjdFJvb3QsXG4gICAgYnVpbGRPcHRpb25zLFxuICAgIHRzQ29uZmlnLFxuICAgIHByb2plY3ROYW1lLFxuICAgIHNvdXJjZVJvb3QsXG4gICAgdHNDb25maWdQYXRoLFxuICAgIHNjcmlwdFRhcmdldCxcbiAgfSA9IHdjbztcbiAgY29uc3Qge1xuICAgIGNhY2hlLFxuICAgIGNvZGVDb3ZlcmFnZSxcbiAgICBjcm9zc09yaWdpbiA9ICdub25lJyxcbiAgICBwbGF0Zm9ybSA9ICdicm93c2VyJyxcbiAgICBhb3QgPSB0cnVlLFxuICAgIGNvZGVDb3ZlcmFnZUV4Y2x1ZGUgPSBbXSxcbiAgICBtYWluLFxuICAgIHBvbHlmaWxscyxcbiAgICBzb3VyY2VNYXA6IHtcbiAgICAgIHN0eWxlczogc3R5bGVzU291cmNlTWFwLFxuICAgICAgc2NyaXB0czogc2NyaXB0c1NvdXJjZU1hcCxcbiAgICAgIHZlbmRvcjogdmVuZG9yU291cmNlTWFwLFxuICAgICAgaGlkZGVuOiBoaWRkZW5Tb3VyY2VNYXAsXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHsgc3R5bGVzOiBzdHlsZXNPcHRpbWl6YXRpb24sIHNjcmlwdHM6IHNjcmlwdHNPcHRpbWl6YXRpb24gfSxcbiAgICBjb21tb25DaHVuayxcbiAgICB2ZW5kb3JDaHVuayxcbiAgICBzdWJyZXNvdXJjZUludGVncml0eSxcbiAgICB2ZXJib3NlLFxuICAgIHBvbGwsXG4gICAgd2ViV29ya2VyVHNDb25maWcsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMgPSBbXSxcbiAgICBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMsXG4gICAgYnVuZGxlRGVwZW5kZW5jaWVzLFxuICB9ID0gYnVpbGRPcHRpb25zO1xuXG4gIGNvbnN0IGlzUGxhdGZvcm1TZXJ2ZXIgPSBidWlsZE9wdGlvbnMucGxhdGZvcm0gPT09ICdzZXJ2ZXInO1xuICBjb25zdCBleHRyYVBsdWdpbnM6IHsgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKTogdm9pZCB9W10gPSBbXTtcbiAgY29uc3QgZXh0cmFSdWxlczogUnVsZVNldFJ1bGVbXSA9IFtdO1xuICBjb25zdCBlbnRyeVBvaW50czogeyBba2V5OiBzdHJpbmddOiBbc3RyaW5nLCAuLi5zdHJpbmdbXV0gfSA9IHt9O1xuXG4gIC8vIExvYWQgRVNNIGBAYW5ndWxhci9jb21waWxlci1jbGlgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gIGNvbnN0IHtcbiAgICBHTE9CQUxfREVGU19GT1JfVEVSU0VSLFxuICAgIEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QsXG4gICAgVkVSU0lPTjogTkdfVkVSU0lPTixcbiAgfSA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk+KCdAYW5ndWxhci9jb21waWxlci1jbGknKTtcblxuICAvLyBkZXRlcm1pbmUgaGFzaGluZyBmb3JtYXRcbiAgY29uc3QgaGFzaEZvcm1hdCA9IGdldE91dHB1dEhhc2hGb3JtYXQoYnVpbGRPcHRpb25zLm91dHB1dEhhc2hpbmcgfHwgJ25vbmUnKTtcblxuICBpZiAoYnVpbGRPcHRpb25zLnByb2dyZXNzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFByb2dyZXNzUGx1Z2luKHBsYXRmb3JtKSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLm1haW4pIHtcbiAgICBjb25zdCBtYWluUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMubWFpbik7XG4gICAgZW50cnlQb2ludHNbJ21haW4nXSA9IFttYWluUGF0aF07XG4gIH1cblxuICBpZiAoaXNQbGF0Zm9ybVNlcnZlcikge1xuICAgIC8vIEZpeGVzIENyaXRpY2FsIGRlcGVuZGVuY3k6IHRoZSByZXF1ZXN0IG9mIGEgZGVwZW5kZW5jeSBpcyBhbiBleHByZXNzaW9uXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IENvbnRleHRSZXBsYWNlbWVudFBsdWdpbigvQD9oYXBpfGV4cHJlc3NbXFxcXC9dLykpO1xuICB9XG5cbiAgaWYgKCFpc1BsYXRmb3JtU2VydmVyKSB7XG4gICAgaWYgKGJ1aWxkT3B0aW9ucy5wb2x5ZmlsbHMpIHtcbiAgICAgIGNvbnN0IHByb2plY3RQb2x5ZmlsbHMgPSBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLnBvbHlmaWxscyk7XG4gICAgICBpZiAoZW50cnlQb2ludHNbJ3BvbHlmaWxscyddKSB7XG4gICAgICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXS5wdXNoKHByb2plY3RQb2x5ZmlsbHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gW3Byb2plY3RQb2x5ZmlsbHNdO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghYnVpbGRPcHRpb25zLmFvdCkge1xuICAgICAgY29uc3Qgaml0UG9seWZpbGxzID0gcmVxdWlyZS5yZXNvbHZlKCdjb3JlLWpzL3Byb3Bvc2Fscy9yZWZsZWN0LW1ldGFkYXRhJyk7XG4gICAgICBpZiAoZW50cnlQb2ludHNbJ3BvbHlmaWxscyddKSB7XG4gICAgICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXS5wdXNoKGppdFBvbHlmaWxscyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10gPSBbaml0UG9seWZpbGxzXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzKSB7XG4gICAgLy8gV2hlbiB0aGlzIGlzIG5vdCBkZWZpbmVkIGl0IG1lYW5zIHRoZSBidWlsZGVyIGRvZXNuJ3Qgc3VwcG9ydCBzaG93aW5nIGNvbW1vbiBqcyB1c2FnZXMuXG4gICAgLy8gV2hlbiBpdCBkb2VzIGl0IHdpbGwgYmUgYW4gYXJyYXkuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgQ29tbW9uSnNVc2FnZVdhcm5QbHVnaW4oe1xuICAgICAgICBhbGxvd2VkRGVwZW5kZW5jaWVzOiBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgLy8gcHJvY2VzcyBnbG9iYWwgc2NyaXB0c1xuICAvLyBBZGQgYSBuZXcgYXNzZXQgZm9yIGVhY2ggZW50cnkuXG4gIGZvciAoY29uc3QgeyBidW5kbGVOYW1lLCBpbmplY3QsIHBhdGhzIH0gb2YgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZShcbiAgICByb290LFxuICAgIGJ1aWxkT3B0aW9ucy5zY3JpcHRzLFxuICApKSB7XG4gICAgLy8gTGF6eSBzY3JpcHRzIGRvbid0IGdldCBhIGhhc2gsIG90aGVyd2lzZSB0aGV5IGNhbid0IGJlIGxvYWRlZCBieSBuYW1lLlxuICAgIGNvbnN0IGhhc2ggPSBpbmplY3QgPyBoYXNoRm9ybWF0LnNjcmlwdCA6ICcnO1xuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU2NyaXB0c1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICBuYW1lOiBidW5kbGVOYW1lLFxuICAgICAgICBzb3VyY2VNYXA6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICAgIHNjcmlwdHM6IHBhdGhzLFxuICAgICAgICBmaWxlbmFtZTogYCR7cGF0aC5iYXNlbmFtZShidW5kbGVOYW1lKX0ke2hhc2h9LmpzYCxcbiAgICAgICAgYmFzZVBhdGg6IHByb2plY3RSb290LFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgYXNzZXQgZW50cmllc1xuICBpZiAoYnVpbGRPcHRpb25zLmFzc2V0cy5sZW5ndGgpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBDb3B5V2VicGFja1BsdWdpbih7XG4gICAgICAgIHBhdHRlcm5zOiBhc3NldFBhdHRlcm5zKHJvb3QsIGJ1aWxkT3B0aW9ucy5hc3NldHMpLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc2hvd0NpcmN1bGFyRGVwZW5kZW5jaWVzKSB7XG4gICAgY29uc3QgQ2lyY3VsYXJEZXBlbmRlbmN5UGx1Z2luID0gcmVxdWlyZSgnY2lyY3VsYXItZGVwZW5kZW5jeS1wbHVnaW4nKTtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBDaXJjdWxhckRlcGVuZGVuY3lQbHVnaW4oe1xuICAgICAgICBleGNsdWRlOiAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzKSB7XG4gICAgY29uc3QgTGljZW5zZVdlYnBhY2tQbHVnaW4gPSByZXF1aXJlKCdsaWNlbnNlLXdlYnBhY2stcGx1Z2luJykuTGljZW5zZVdlYnBhY2tQbHVnaW47XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgTGljZW5zZVdlYnBhY2tQbHVnaW4oe1xuICAgICAgICBzdGF0czoge1xuICAgICAgICAgIHdhcm5pbmdzOiBmYWxzZSxcbiAgICAgICAgICBlcnJvcnM6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICBwZXJDaHVua091dHB1dDogZmFsc2UsXG4gICAgICAgIG91dHB1dEZpbGVuYW1lOiAnM3JkcGFydHlsaWNlbnNlcy50eHQnLFxuICAgICAgICBza2lwQ2hpbGRDb21waWxlcnM6IHRydWUsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHNjcmlwdHNTb3VyY2VNYXAgfHwgc3R5bGVzU291cmNlTWFwKSB7XG4gICAgY29uc3QgaW5jbHVkZSA9IFtdO1xuICAgIGlmIChzY3JpcHRzU291cmNlTWFwKSB7XG4gICAgICBpbmNsdWRlLnB1c2goL2pzJC8pO1xuICAgIH1cblxuICAgIGlmIChzdHlsZXNTb3VyY2VNYXApIHtcbiAgICAgIGluY2x1ZGUucHVzaCgvY3NzJC8pO1xuICAgIH1cblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFNvdXJjZU1hcERldlRvb2xQbHVnaW4oe1xuICAgICAgICBmaWxlbmFtZTogJ1tmaWxlXS5tYXAnLFxuICAgICAgICBpbmNsdWRlLFxuICAgICAgICAvLyBXZSB3YW50IHRvIHNldCBzb3VyY2VSb290IHRvICBgd2VicGFjazovLy9gIGZvciBub25cbiAgICAgICAgLy8gaW5saW5lIHNvdXJjZW1hcHMgYXMgb3RoZXJ3aXNlIHBhdGhzIHRvIHNvdXJjZW1hcHMgd2lsbCBiZSBicm9rZW4gaW4gYnJvd3NlclxuICAgICAgICAvLyBgd2VicGFjazovLy9gIGlzIG5lZWRlZCBmb3IgVmlzdWFsIFN0dWRpbyBicmVha3BvaW50cyB0byB3b3JrIHByb3Blcmx5IGFzIGN1cnJlbnRseVxuICAgICAgICAvLyB0aGVyZSBpcyBubyB3YXkgdG8gc2V0IHRoZSAnd2ViUm9vdCdcbiAgICAgICAgc291cmNlUm9vdDogJ3dlYnBhY2s6Ly8vJyxcbiAgICAgICAgbW9kdWxlRmlsZW5hbWVUZW1wbGF0ZTogJ1tyZXNvdXJjZS1wYXRoXScsXG4gICAgICAgIGFwcGVuZDogaGlkZGVuU291cmNlTWFwID8gZmFsc2UgOiB1bmRlZmluZWQsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdGF0c0pzb24pIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBKc29uU3RhdHNQbHVnaW4ocGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoLCAnc3RhdHMuanNvbicpKSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHN1YnJlc291cmNlSW50ZWdyaXR5KSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4oe1xuICAgICAgICBoYXNoRnVuY05hbWVzOiBbJ3NoYTM4NCddLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzY3JpcHRzU291cmNlTWFwIHx8IHN0eWxlc1NvdXJjZU1hcCkge1xuICAgIGV4dHJhUnVsZXMucHVzaCh7XG4gICAgICB0ZXN0OiAvXFwuW2NtXT9qc3g/JC8sXG4gICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdzb3VyY2UtbWFwLWxvYWRlcicpLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICBmaWx0ZXJTb3VyY2VNYXBwaW5nVXJsOiAoX21hcFVyaTogc3RyaW5nLCByZXNvdXJjZVBhdGg6IHN0cmluZykgPT4ge1xuICAgICAgICAgIGlmICh2ZW5kb3JTb3VyY2VNYXApIHtcbiAgICAgICAgICAgIC8vIENvbnN1bWUgYWxsIHNvdXJjZW1hcHMgd2hlbiB2ZW5kb3Igb3B0aW9uIGlzIGVuYWJsZWQuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBEb24ndCBjb25zdW1lIHNvdXJjZW1hcHMgaW4gbm9kZV9tb2R1bGVzIHdoZW4gdmVuZG9yIGlzIGRpc2FibGVkLlxuICAgICAgICAgIC8vIEJ1dCwgZG8gY29uc3VtZSBsb2NhbCBsaWJyYXJpZXMgc291cmNlbWFwcy5cbiAgICAgICAgICByZXR1cm4gIXJlc291cmNlUGF0aC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJyk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgaWYgKG1haW4gfHwgcG9seWZpbGxzKSB7XG4gICAgZXh0cmFSdWxlcy5wdXNoKHtcbiAgICAgIHRlc3Q6IHRzQ29uZmlnLm9wdGlvbnMuYWxsb3dKcyA/IC9cXC5bY21dP1t0al1zeD8kLyA6IC9cXC5bY21dP3RzeD8kLyxcbiAgICAgIGxvYWRlcjogQW5ndWxhcldlYnBhY2tMb2FkZXJQYXRoLFxuICAgICAgLy8gVGhlIGJlbG93IGFyZSBrbm93biBwYXRocyB0aGF0IGFyZSBub3QgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBjb21waWxhdGlvbiBldmVuIHdoZW4gYWxsb3dKcyBpcyBlbmFibGVkLlxuICAgICAgZXhjbHVkZTogWy9bL1xcXFxdKD86Y3NzLWxvYWRlcnxtaW5pLWNzcy1leHRyYWN0LXBsdWdpbnx3ZWJwYWNrLWRldi1zZXJ2ZXJ8d2VicGFjaylbL1xcXFxdL10sXG4gICAgfSk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goY3JlYXRlSXZ5UGx1Z2luKHdjbywgYW90LCB0c0NvbmZpZ1BhdGgpKTtcbiAgfVxuXG4gIGlmICh3ZWJXb3JrZXJUc0NvbmZpZykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGNyZWF0ZUl2eVBsdWdpbih3Y28sIGZhbHNlLCBwYXRoLnJlc29sdmUod2NvLnJvb3QsIHdlYldvcmtlclRzQ29uZmlnKSkpO1xuICB9XG5cbiAgY29uc3QgZXh0cmFNaW5pbWl6ZXJzID0gW107XG4gIGlmIChzY3JpcHRzT3B0aW1pemF0aW9uKSB7XG4gICAgZXh0cmFNaW5pbWl6ZXJzLnB1c2goXG4gICAgICBuZXcgSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbih7XG4gICAgICAgIGRlZmluZTogYnVpbGRPcHRpb25zLmFvdCA/IEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QgOiBHTE9CQUxfREVGU19GT1JfVEVSU0VSLFxuICAgICAgICBzb3VyY2VtYXA6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICAgIHRhcmdldDogc2NyaXB0VGFyZ2V0LFxuICAgICAgICBrZWVwSWRlbnRpZmllck5hbWVzOiAhYWxsb3dNYW5nbGUgfHwgaXNQbGF0Zm9ybVNlcnZlcixcbiAgICAgICAga2VlcE5hbWVzOiBpc1BsYXRmb3JtU2VydmVyLFxuICAgICAgICByZW1vdmVMaWNlbnNlczogYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcyxcbiAgICAgICAgYWR2YW5jZWQ6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAocGxhdGZvcm0gPT09ICdicm93c2VyJyAmJiAoc2NyaXB0c09wdGltaXphdGlvbiB8fCBzdHlsZXNPcHRpbWl6YXRpb24ubWluaWZ5KSkge1xuICAgIGV4dHJhTWluaW1pemVycy5wdXNoKG5ldyBUcmFuc2ZlclNpemVQbHVnaW4oKSk7XG4gIH1cblxuICBjb25zdCBleHRlcm5hbHM6IENvbmZpZ3VyYXRpb25bJ2V4dGVybmFscyddID0gWy4uLmV4dGVybmFsRGVwZW5kZW5jaWVzXTtcbiAgaWYgKGlzUGxhdGZvcm1TZXJ2ZXIgJiYgIWJ1bmRsZURlcGVuZGVuY2llcykge1xuICAgIGV4dGVybmFscy5wdXNoKCh7IGNvbnRleHQsIHJlcXVlc3QgfSwgY2FsbGJhY2spID0+XG4gICAgICBleHRlcm5hbGl6ZVBhY2thZ2VzKGNvbnRleHQgPz8gd2NvLnByb2plY3RSb290LCByZXF1ZXN0LCBjYWxsYmFjayksXG4gICAgKTtcbiAgfVxuXG4gIGxldCBjcm9zc09yaWdpbkxvYWRpbmc6IE5vbk51bGxhYmxlPENvbmZpZ3VyYXRpb25bJ291dHB1dCddPlsnY3Jvc3NPcmlnaW5Mb2FkaW5nJ10gPSBmYWxzZTtcbiAgaWYgKHN1YnJlc291cmNlSW50ZWdyaXR5ICYmIGNyb3NzT3JpZ2luID09PSAnbm9uZScpIHtcbiAgICBjcm9zc09yaWdpbkxvYWRpbmcgPSAnYW5vbnltb3VzJztcbiAgfSBlbHNlIGlmIChjcm9zc09yaWdpbiAhPT0gJ25vbmUnKSB7XG4gICAgY3Jvc3NPcmlnaW5Mb2FkaW5nID0gY3Jvc3NPcmlnaW47XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG1vZGU6IHNjcmlwdHNPcHRpbWl6YXRpb24gfHwgc3R5bGVzT3B0aW1pemF0aW9uLm1pbmlmeSA/ICdwcm9kdWN0aW9uJyA6ICdkZXZlbG9wbWVudCcsXG4gICAgZGV2dG9vbDogZmFsc2UsXG4gICAgdGFyZ2V0OiBbXG4gICAgICBpc1BsYXRmb3JtU2VydmVyID8gJ25vZGUnIDogJ3dlYicsXG4gICAgICBzY3JpcHRUYXJnZXQgPT09IFNjcmlwdFRhcmdldC5FUzUgPyAnZXM1JyA6ICdlczIwMTUnLFxuICAgIF0sXG4gICAgcHJvZmlsZTogYnVpbGRPcHRpb25zLnN0YXRzSnNvbixcbiAgICByZXNvbHZlOiB7XG4gICAgICByb290czogW3Byb2plY3RSb290XSxcbiAgICAgIGV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICBtb2R1bGVzOiBbdHNDb25maWcub3B0aW9ucy5iYXNlVXJsIHx8IHByb2plY3RSb290LCAnbm9kZV9tb2R1bGVzJ10sXG4gICAgICAuLi5nZXRNYWluRmllbGRzQW5kQ29uZGl0aW9uTmFtZXMoc2NyaXB0VGFyZ2V0LCBpc1BsYXRmb3JtU2VydmVyKSxcbiAgICB9LFxuICAgIHJlc29sdmVMb2FkZXI6IHtcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgfSxcbiAgICBjb250ZXh0OiByb290LFxuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBleHRlcm5hbHMsXG4gICAgb3V0cHV0OiB7XG4gICAgICB1bmlxdWVOYW1lOiBwcm9qZWN0TmFtZSxcbiAgICAgIGhhc2hGdW5jdGlvbjogJ3h4aGFzaDY0JywgLy8gdG9kbzogcmVtb3ZlIGluIHdlYnBhY2sgNi4gVGhpcyBpcyBwYXJ0IG9mIGBmdXR1cmVEZWZhdWx0c2AuXG4gICAgICBjbGVhbjogYnVpbGRPcHRpb25zLmRlbGV0ZU91dHB1dFBhdGggPz8gdHJ1ZSxcbiAgICAgIHBhdGg6IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCksXG4gICAgICBwdWJsaWNQYXRoOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsID8/ICcnLFxuICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICAgIGNodW5rRmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICAgIGxpYnJhcnlUYXJnZXQ6IGlzUGxhdGZvcm1TZXJ2ZXIgPyAnY29tbW9uanMnIDogdW5kZWZpbmVkLFxuICAgICAgY3Jvc3NPcmlnaW5Mb2FkaW5nLFxuICAgICAgdHJ1c3RlZFR5cGVzOiAnYW5ndWxhciNidW5kbGVyJyxcbiAgICAgIHNjcmlwdFR5cGU6ICdtb2R1bGUnLFxuICAgIH0sXG4gICAgd2F0Y2g6IGJ1aWxkT3B0aW9ucy53YXRjaCxcbiAgICB3YXRjaE9wdGlvbnM6IHtcbiAgICAgIHBvbGwsXG4gICAgICBpZ25vcmVkOiBwb2xsID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiAnKiovbm9kZV9tb2R1bGVzLyoqJyxcbiAgICB9LFxuICAgIHBlcmZvcm1hbmNlOiB7XG4gICAgICBoaW50czogZmFsc2UsXG4gICAgfSxcbiAgICBpZ25vcmVXYXJuaW5nczogW1xuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zb3VyY2UtbWFwLWxvYWRlci9ibG9iL2IyZGU0MjQ5Yzc0MzFkZDg0MzJkYTYwN2UwOGYwZjY1ZTlkNjQyMTkvc3JjL2luZGV4LmpzI0w4M1xuICAgICAgL0ZhaWxlZCB0byBwYXJzZSBzb3VyY2UgbWFwIGZyb20vLFxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9wb3N0Y3NzLWxvYWRlci9ibG9iL2JkMjYxODc1ZmRmOWM1OTZhZjRmZmIzYTFhNzNmZTNjNTQ5YmVmZGEvc3JjL2luZGV4LmpzI0wxNTMtTDE1OFxuICAgICAgL0FkZCBwb3N0Y3NzIGFzIHByb2plY3QgZGVwZW5kZW5jeS8sXG4gICAgICAvLyBlc2J1aWxkIHdpbGwgaXNzdWUgYSB3YXJuaW5nLCB3aGlsZSBzdGlsbCBob2lzdHMgdGhlIEBjaGFyc2V0IGF0IHRoZSB2ZXJ5IHRvcC5cbiAgICAgIC8vIFRoaXMgaXMgY2F1c2VkIGJ5IGEgYnVnIGluIGNzcy1sb2FkZXIgaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9jc3MtbG9hZGVyL2lzc3Vlcy8xMjEyXG4gICAgICAvXCJAY2hhcnNldFwiIG11c3QgYmUgdGhlIGZpcnN0IHJ1bGUgaW4gdGhlIGZpbGUvLFxuICAgIF0sXG4gICAgbW9kdWxlOiB7XG4gICAgICAvLyBTaG93IGFuIGVycm9yIGZvciBtaXNzaW5nIGV4cG9ydHMgaW5zdGVhZCBvZiBhIHdhcm5pbmcuXG4gICAgICBzdHJpY3RFeHBvcnRQcmVzZW5jZTogdHJ1ZSxcbiAgICAgIHBhcnNlcjoge1xuICAgICAgICBqYXZhc2NyaXB0OiB7XG4gICAgICAgICAgLy8gRGlzYWJsZSBhdXRvIFVSTCBhc3NldCBtb2R1bGUgY3JlYXRpb24uIFRoaXMgZG9lc24ndCBlZmZlY3QgYG5ldyBXb3JrZXIobmV3IFVSTCguLi4pKWBcbiAgICAgICAgICAvLyBodHRwczovL3dlYnBhY2suanMub3JnL2d1aWRlcy9hc3NldC1tb2R1bGVzLyN1cmwtYXNzZXRzXG4gICAgICAgICAgdXJsOiBmYWxzZSxcbiAgICAgICAgICB3b3JrZXI6ICEhd2ViV29ya2VyVHNDb25maWcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC4/KHN2Z3xodG1sKSQvLFxuICAgICAgICAgIC8vIE9ubHkgcHJvY2VzcyBIVE1MIGFuZCBTVkcgd2hpY2ggYXJlIGtub3duIEFuZ3VsYXIgY29tcG9uZW50IHJlc291cmNlcy5cbiAgICAgICAgICByZXNvdXJjZVF1ZXJ5OiAvXFw/bmdSZXNvdXJjZS8sXG4gICAgICAgICAgdHlwZTogJ2Fzc2V0L3NvdXJjZScsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBNYXJrIGZpbGVzIGluc2lkZSBgcnhqcy9hZGRgIGFzIGNvbnRhaW5pbmcgc2lkZSBlZmZlY3RzLlxuICAgICAgICAgIC8vIElmIHRoaXMgaXMgZml4ZWQgdXBzdHJlYW0gYW5kIHRoZSBmaXhlZCB2ZXJzaW9uIGJlY29tZXMgdGhlIG1pbmltdW1cbiAgICAgICAgICAvLyBzdXBwb3J0ZWQgdmVyc2lvbiwgdGhpcyBjYW4gYmUgcmVtb3ZlZC5cbiAgICAgICAgICB0ZXN0OiAvWy9cXFxcXXJ4anNbL1xcXFxdYWRkWy9cXFxcXS4rXFwuanMkLyxcbiAgICAgICAgICBzaWRlRWZmZWN0czogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5bY21dP1t0al1zeD8kLyxcbiAgICAgICAgICAvLyBUaGUgYmVsb3cgaXMgbmVlZGVkIGR1ZSB0byBhIGJ1ZyBpbiBgQGJhYmVsL3J1bnRpbWVgLiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9iYWJlbC9iYWJlbC9pc3N1ZXMvMTI4MjRcbiAgICAgICAgICByZXNvbHZlOiB7IGZ1bGx5U3BlY2lmaWVkOiBmYWxzZSB9LFxuICAgICAgICAgIGV4Y2x1ZGU6IFsvWy9cXFxcXSg/OmNvcmUtanN8QGJhYmVsfHRzbGlifHdlYi1hbmltYXRpb25zLWpzfHdlYi1zdHJlYW1zLXBvbHlmaWxsKVsvXFxcXF0vXSxcbiAgICAgICAgICB1c2U6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJy4uLy4uL2JhYmVsL3dlYnBhY2stbG9hZGVyJyksXG4gICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICBjYWNoZURpcmVjdG9yeTogKGNhY2hlLmVuYWJsZWQgJiYgcGF0aC5qb2luKGNhY2hlLnBhdGgsICdiYWJlbC13ZWJwYWNrJykpIHx8IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNjcmlwdFRhcmdldCxcbiAgICAgICAgICAgICAgICBhb3Q6IGJ1aWxkT3B0aW9ucy5hb3QsXG4gICAgICAgICAgICAgICAgb3B0aW1pemU6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgICAgICAgICAgICBpbnN0cnVtZW50Q29kZTogY29kZUNvdmVyYWdlXG4gICAgICAgICAgICAgICAgICA/IHtcbiAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZEJhc2VQYXRoOiBzb3VyY2VSb290LFxuICAgICAgICAgICAgICAgICAgICAgIGV4Y2x1ZGVkUGF0aHM6IGdldEluc3RydW1lbnRhdGlvbkV4Y2x1ZGVkUGF0aHMocm9vdCwgY29kZUNvdmVyYWdlRXhjbHVkZSksXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICB9IGFzIEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIC4uLmV4dHJhUnVsZXMsXG4gICAgICBdLFxuICAgIH0sXG4gICAgZXhwZXJpbWVudHM6IHtcbiAgICAgIGJhY2tDb21wYXQ6IGZhbHNlLFxuICAgICAgc3luY1dlYkFzc2VtYmx5OiB0cnVlLFxuICAgICAgYXN5bmNXZWJBc3NlbWJseTogdHJ1ZSxcbiAgICB9LFxuICAgIGluZnJhc3RydWN0dXJlTG9nZ2luZzoge1xuICAgICAgbGV2ZWw6IHZlcmJvc2UgPyAndmVyYm9zZScgOiAnZXJyb3InLFxuICAgIH0sXG4gICAgc3RhdHM6IGdldFN0YXRzT3B0aW9ucyh2ZXJib3NlKSxcbiAgICBjYWNoZTogZ2V0Q2FjaGVTZXR0aW5ncyh3Y28sIE5HX1ZFUlNJT04uZnVsbCksXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICBtaW5pbWl6ZXI6IGV4dHJhTWluaW1pemVycyxcbiAgICAgIG1vZHVsZUlkczogJ2RldGVybWluaXN0aWMnLFxuICAgICAgY2h1bmtJZHM6IGJ1aWxkT3B0aW9ucy5uYW1lZENodW5rcyA/ICduYW1lZCcgOiAnZGV0ZXJtaW5pc3RpYycsXG4gICAgICBlbWl0T25FcnJvcnM6IGZhbHNlLFxuICAgICAgcnVudGltZUNodW5rOiBpc1BsYXRmb3JtU2VydmVyID8gZmFsc2UgOiAnc2luZ2xlJyxcbiAgICAgIHNwbGl0Q2h1bmtzOiB7XG4gICAgICAgIG1heEFzeW5jUmVxdWVzdHM6IEluZmluaXR5LFxuICAgICAgICBjYWNoZUdyb3Vwczoge1xuICAgICAgICAgIGRlZmF1bHQ6ICEhY29tbW9uQ2h1bmsgJiYge1xuICAgICAgICAgICAgY2h1bmtzOiAnYXN5bmMnLFxuICAgICAgICAgICAgbWluQ2h1bmtzOiAyLFxuICAgICAgICAgICAgcHJpb3JpdHk6IDEwLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29tbW9uOiAhIWNvbW1vbkNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21tb24nLFxuICAgICAgICAgICAgY2h1bmtzOiAnYXN5bmMnLFxuICAgICAgICAgICAgbWluQ2h1bmtzOiAyLFxuICAgICAgICAgICAgZW5mb3JjZTogdHJ1ZSxcbiAgICAgICAgICAgIHByaW9yaXR5OiA1LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdmVuZG9yczogZmFsc2UsXG4gICAgICAgICAgZGVmYXVsdFZlbmRvcnM6ICEhdmVuZG9yQ2h1bmsgJiYge1xuICAgICAgICAgICAgbmFtZTogJ3ZlbmRvcicsXG4gICAgICAgICAgICBjaHVua3M6IChjaHVuaykgPT4gY2h1bmsubmFtZSA9PT0gJ21haW4nLFxuICAgICAgICAgICAgZW5mb3JjZTogdHJ1ZSxcbiAgICAgICAgICAgIHRlc3Q6IC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS8sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbbmV3IE5hbWVkQ2h1bmtzUGx1Z2luKCksIG5ldyBEZWR1cGVNb2R1bGVSZXNvbHZlUGx1Z2luKHsgdmVyYm9zZSB9KSwgLi4uZXh0cmFQbHVnaW5zXSxcbiAgICBub2RlOiBmYWxzZSxcbiAgfTtcbn1cbiJdfQ==