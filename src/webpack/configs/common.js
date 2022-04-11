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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhDQUE0RDtBQUM1RCw4RUFBb0Q7QUFDcEQsMkNBQTZCO0FBQzdCLDJDQUEwQztBQUMxQyxxQ0FNaUI7QUFDakIsaUZBQTJFO0FBRzNFLHlFQUE4RDtBQUM5RCxtREFBcUQ7QUFDckQsd0NBTW9CO0FBQ3BCLHdFQUFtRTtBQUNuRSxnRUFBNEQ7QUFDNUQsMEVBQXFFO0FBQ3JFLHNEQUF3RDtBQUN4RCw4Q0FTMEI7QUFFMUIsa0RBQWtEO0FBQzNDLEtBQUssVUFBVSxlQUFlLENBQUMsR0FBeUI7O0lBQzdELE1BQU0sRUFDSixJQUFJLEVBQ0osV0FBVyxFQUNYLFlBQVksRUFDWixRQUFRLEVBQ1IsV0FBVyxFQUNYLFVBQVUsRUFDVixZQUFZLEVBQ1osWUFBWSxHQUNiLEdBQUcsR0FBRyxDQUFDO0lBQ1IsTUFBTSxFQUNKLEtBQUssRUFDTCxZQUFZLEVBQ1osV0FBVyxHQUFHLE1BQU0sRUFDcEIsUUFBUSxHQUFHLFNBQVMsRUFDcEIsR0FBRyxHQUFHLElBQUksRUFDVixtQkFBbUIsR0FBRyxFQUFFLEVBQ3hCLElBQUksRUFDSixTQUFTLEVBQ1QsU0FBUyxFQUFFLEVBQ1QsTUFBTSxFQUFFLGVBQWUsRUFDdkIsT0FBTyxFQUFFLGdCQUFnQixFQUN6QixNQUFNLEVBQUUsZUFBZSxFQUN2QixNQUFNLEVBQUUsZUFBZSxHQUN4QixFQUNELFlBQVksRUFBRSxFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsRUFDMUUsV0FBVyxFQUNYLFdBQVcsRUFDWCxvQkFBb0Is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VyxFQUFFO29CQUNYLE9BQU8sRUFBRSxDQUFDLENBQUMsV0FBVyxJQUFJO3dCQUN4QixNQUFNLEVBQUUsT0FBTzt3QkFDZixTQUFTLEVBQUUsQ0FBQzt3QkFDWixRQUFRLEVBQUUsRUFBRTtxQkFDYjtvQkFDRCxNQUFNLEVBQUUsQ0FBQyxDQUFDLFdBQVcsSUFBSTt3QkFDdkIsSUFBSSxFQUFFLFFBQVE7d0JBQ2QsTUFBTSxFQUFFLE9BQU87d0JBQ2YsU0FBUyxFQUFFLENBQUM7d0JBQ1osT0FBTyxFQUFFLElBQUk7d0JBQ2IsUUFBUSxFQUFFLENBQUM7cUJBQ1o7b0JBQ0QsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsY0FBYyxFQUFFLENBQUMsQ0FBQyxXQUFXLElBQUk7d0JBQy9CLElBQUksRUFBRSxRQUFRO3dCQUNkLE1BQU0sRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxNQUFNO3dCQUN4QyxPQUFPLEVBQUUsSUFBSTt3QkFDYixJQUFJLEVBQUUsd0JBQXdCO3FCQUMvQjtpQkFDRjthQUNGO1NBQ0Y7UUFDRCxPQUFPLEVBQUUsQ0FBQyxJQUFJLHVDQUFpQixFQUFFLEVBQUUsSUFBSSxtQ0FBeUIsQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsR0FBRyxZQUFZLENBQUM7UUFDL0YsSUFBSSxFQUFFLEtBQUs7S0FDWixDQUFDO0FBQ0osQ0FBQztBQXpaRCwwQ0F5WkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQW5ndWxhcldlYnBhY2tMb2FkZXJQYXRoIH0gZnJvbSAnQG5ndG9vbHMvd2VicGFjayc7XG5pbXBvcnQgQ29weVdlYnBhY2tQbHVnaW4gZnJvbSAnY29weS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgU2NyaXB0VGFyZ2V0IH0gZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQge1xuICBDb21waWxlcixcbiAgQ29uZmlndXJhdGlvbixcbiAgQ29udGV4dFJlcGxhY2VtZW50UGx1Z2luLFxuICBSdWxlU2V0UnVsZSxcbiAgU291cmNlTWFwRGV2VG9vbFBsdWdpbixcbn0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBTdWJyZXNvdXJjZUludGVncml0eVBsdWdpbiB9IGZyb20gJ3dlYnBhY2stc3VicmVzb3VyY2UtaW50ZWdyaXR5JztcbmltcG9ydCB7IEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnMgfSBmcm9tICcuLi8uLi9iYWJlbC93ZWJwYWNrLWxvYWRlcic7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgYWxsb3dNYW5nbGUgfSBmcm9tICcuLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi8uLi91dGlscy9sb2FkLWVzbSc7XG5pbXBvcnQge1xuICBDb21tb25Kc1VzYWdlV2FyblBsdWdpbixcbiAgRGVkdXBlTW9kdWxlUmVzb2x2ZVBsdWdpbixcbiAgSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbixcbiAgSnNvblN0YXRzUGx1Z2luLFxuICBTY3JpcHRzV2VicGFja1BsdWdpbixcbn0gZnJvbSAnLi4vcGx1Z2lucyc7XG5pbXBvcnQgeyBOYW1lZENodW5rc1BsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvbmFtZWQtY2h1bmtzLXBsdWdpbic7XG5pbXBvcnQgeyBQcm9ncmVzc1BsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvcHJvZ3Jlc3MtcGx1Z2luJztcbmltcG9ydCB7IFRyYW5zZmVyU2l6ZVBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvdHJhbnNmZXItc2l6ZS1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlSXZ5UGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy90eXBlc2NyaXB0JztcbmltcG9ydCB7XG4gIGFzc2V0UGF0dGVybnMsXG4gIGV4dGVybmFsaXplUGFja2FnZXMsXG4gIGdldENhY2hlU2V0dGluZ3MsXG4gIGdldEluc3RydW1lbnRhdGlvbkV4Y2x1ZGVkUGF0aHMsXG4gIGdldE1haW5GaWVsZHNBbmRDb25kaXRpb25OYW1lcyxcbiAgZ2V0T3V0cHV0SGFzaEZvcm1hdCxcbiAgZ2V0U3RhdHNPcHRpb25zLFxuICBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lLFxufSBmcm9tICcuLi91dGlscy9oZWxwZXJzJztcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRDb21tb25Db25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IFByb21pc2U8Q29uZmlndXJhdGlvbj4ge1xuICBjb25zdCB7XG4gICAgcm9vdCxcbiAgICBwcm9qZWN0Um9vdCxcbiAgICBidWlsZE9wdGlvbnMsXG4gICAgdHNDb25maWcsXG4gICAgcHJvamVjdE5hbWUsXG4gICAgc291cmNlUm9vdCxcbiAgICB0c0NvbmZpZ1BhdGgsXG4gICAgc2NyaXB0VGFyZ2V0LFxuICB9ID0gd2NvO1xuICBjb25zdCB7XG4gICAgY2FjaGUsXG4gICAgY29kZUNvdmVyYWdlLFxuICAgIGNyb3NzT3JpZ2luID0gJ25vbmUnLFxuICAgIHBsYXRmb3JtID0gJ2Jyb3dzZXInLFxuICAgIGFvdCA9IHRydWUsXG4gICAgY29kZUNvdmVyYWdlRXhjbHVkZSA9IFtdLFxuICAgIG1haW4sXG4gICAgcG9seWZpbGxzLFxuICAgIHNvdXJjZU1hcDoge1xuICAgICAgc3R5bGVzOiBzdHlsZXNTb3VyY2VNYXAsXG4gICAgICBzY3JpcHRzOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgdmVuZG9yOiB2ZW5kb3JTb3VyY2VNYXAsXG4gICAgICBoaWRkZW46IGhpZGRlblNvdXJjZU1hcCxcbiAgICB9LFxuICAgIG9wdGltaXphdGlvbjogeyBzdHlsZXM6IHN0eWxlc09wdGltaXphdGlvbiwgc2NyaXB0czogc2NyaXB0c09wdGltaXphdGlvbiB9LFxuICAgIGNvbW1vbkNodW5rLFxuICAgIHZlbmRvckNodW5rLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIHZlcmJvc2UsXG4gICAgcG9sbCxcbiAgICB3ZWJXb3JrZXJUc0NvbmZpZyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyA9IFtdLFxuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICBidW5kbGVEZXBlbmRlbmNpZXMsXG4gIH0gPSBidWlsZE9wdGlvbnM7XG5cbiAgY29uc3QgaXNQbGF0Zm9ybVNlcnZlciA9IGJ1aWxkT3B0aW9ucy5wbGF0Zm9ybSA9PT0gJ3NlcnZlcic7XG4gIGNvbnN0IGV4dHJhUGx1Z2luczogeyBhcHBseShjb21waWxlcjogQ29tcGlsZXIpOiB2b2lkIH1bXSA9IFtdO1xuICBjb25zdCBleHRyYVJ1bGVzOiBSdWxlU2V0UnVsZVtdID0gW107XG4gIGNvbnN0IGVudHJ5UG9pbnRzOiB7IFtrZXk6IHN0cmluZ106IFtzdHJpbmcsIC4uLnN0cmluZ1tdXSB9ID0ge307XG5cbiAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgY29uc3Qge1xuICAgIEdMT0JBTF9ERUZTX0ZPUl9URVJTRVIsXG4gICAgR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCxcbiAgICBWRVJTSU9OOiBOR19WRVJTSU9OLFxuICB9ID0gYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGknKT4oJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpO1xuXG4gIC8vIGRldGVybWluZSBoYXNoaW5nIGZvcm1hdFxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyk7XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5wcm9ncmVzcykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBQcm9ncmVzc1BsdWdpbihwbGF0Zm9ybSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5tYWluKSB7XG4gICAgY29uc3QgbWFpblBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm1haW4pO1xuICAgIGVudHJ5UG9pbnRzWydtYWluJ10gPSBbbWFpblBhdGhdO1xuICB9XG5cbiAgaWYgKGlzUGxhdGZvcm1TZXJ2ZXIpIHtcbiAgICAvLyBGaXhlcyBDcml0aWNhbCBkZXBlbmRlbmN5OiB0aGUgcmVxdWVzdCBvZiBhIGRlcGVuZGVuY3kgaXMgYW4gZXhwcmVzc2lvblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBDb250ZXh0UmVwbGFjZW1lbnRQbHVnaW4oL0A/aGFwaXxleHByZXNzW1xcXFwvXS8pKTtcbiAgfVxuXG4gIGlmICghaXNQbGF0Zm9ybVNlcnZlcikge1xuICAgIGlmIChidWlsZE9wdGlvbnMucG9seWZpbGxzKSB7XG4gICAgICBjb25zdCBwcm9qZWN0UG9seWZpbGxzID0gcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5wb2x5ZmlsbHMpO1xuICAgICAgaWYgKGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSkge1xuICAgICAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10ucHVzaChwcm9qZWN0UG9seWZpbGxzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSA9IFtwcm9qZWN0UG9seWZpbGxzXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWJ1aWxkT3B0aW9ucy5hb3QpIHtcbiAgICAgIGNvbnN0IGppdFBvbHlmaWxscyA9IHJlcXVpcmUucmVzb2x2ZSgnY29yZS1qcy9wcm9wb3NhbHMvcmVmbGVjdC1tZXRhZGF0YScpO1xuICAgICAgaWYgKGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSkge1xuICAgICAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10ucHVzaChqaXRQb2x5ZmlsbHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gW2ppdFBvbHlmaWxsc107XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcykge1xuICAgIC8vIFdoZW4gdGhpcyBpcyBub3QgZGVmaW5lZCBpdCBtZWFucyB0aGUgYnVpbGRlciBkb2Vzbid0IHN1cHBvcnQgc2hvd2luZyBjb21tb24ganMgdXNhZ2VzLlxuICAgIC8vIFdoZW4gaXQgZG9lcyBpdCB3aWxsIGJlIGFuIGFycmF5LlxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IENvbW1vbkpzVXNhZ2VXYXJuUGx1Z2luKHtcbiAgICAgICAgYWxsb3dlZERlcGVuZGVuY2llczogYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgZ2xvYmFsIHNjcmlwdHNcbiAgLy8gQWRkIGEgbmV3IGFzc2V0IGZvciBlYWNoIGVudHJ5LlxuICBmb3IgKGNvbnN0IHsgYnVuZGxlTmFtZSwgaW5qZWN0LCBwYXRocyB9IG9mIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUoXG4gICAgcm9vdCxcbiAgICBidWlsZE9wdGlvbnMuc2NyaXB0cyxcbiAgKSkge1xuICAgIC8vIExhenkgc2NyaXB0cyBkb24ndCBnZXQgYSBoYXNoLCBvdGhlcndpc2UgdGhleSBjYW4ndCBiZSBsb2FkZWQgYnkgbmFtZS5cbiAgICBjb25zdCBoYXNoID0gaW5qZWN0ID8gaGFzaEZvcm1hdC5zY3JpcHQgOiAnJztcblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFNjcmlwdHNXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgbmFtZTogYnVuZGxlTmFtZSxcbiAgICAgICAgc291cmNlTWFwOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgICBzY3JpcHRzOiBwYXRocyxcbiAgICAgICAgZmlsZW5hbWU6IGAke3BhdGguYmFzZW5hbWUoYnVuZGxlTmFtZSl9JHtoYXNofS5qc2AsXG4gICAgICAgIGJhc2VQYXRoOiBwcm9qZWN0Um9vdCxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICAvLyBwcm9jZXNzIGFzc2V0IGVudHJpZXNcbiAgaWYgKGJ1aWxkT3B0aW9ucy5hc3NldHMubGVuZ3RoKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgQ29weVdlYnBhY2tQbHVnaW4oe1xuICAgICAgICBwYXR0ZXJuczogYXNzZXRQYXR0ZXJucyhyb290LCBidWlsZE9wdGlvbnMuYXNzZXRzKSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnNob3dDaXJjdWxhckRlcGVuZGVuY2llcykge1xuICAgIGNvbnN0IENpcmN1bGFyRGVwZW5kZW5jeVBsdWdpbiA9IHJlcXVpcmUoJ2NpcmN1bGFyLWRlcGVuZGVuY3ktcGx1Z2luJyk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgQ2lyY3VsYXJEZXBlbmRlbmN5UGx1Z2luKHtcbiAgICAgICAgZXhjbHVkZTogL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLyxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcykge1xuICAgIGNvbnN0IExpY2Vuc2VXZWJwYWNrUGx1Z2luID0gcmVxdWlyZSgnbGljZW5zZS13ZWJwYWNrLXBsdWdpbicpLkxpY2Vuc2VXZWJwYWNrUGx1Z2luO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IExpY2Vuc2VXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICB3YXJuaW5nczogZmFsc2UsXG4gICAgICAgICAgZXJyb3JzOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgcGVyQ2h1bmtPdXRwdXQ6IGZhbHNlLFxuICAgICAgICBvdXRwdXRGaWxlbmFtZTogJzNyZHBhcnR5bGljZW5zZXMudHh0JyxcbiAgICAgICAgc2tpcENoaWxkQ29tcGlsZXJzOiB0cnVlLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzY3JpcHRzU291cmNlTWFwIHx8IHN0eWxlc1NvdXJjZU1hcCkge1xuICAgIGNvbnN0IGluY2x1ZGUgPSBbXTtcbiAgICBpZiAoc2NyaXB0c1NvdXJjZU1hcCkge1xuICAgICAgaW5jbHVkZS5wdXNoKC9qcyQvKTtcbiAgICB9XG5cbiAgICBpZiAoc3R5bGVzU291cmNlTWFwKSB7XG4gICAgICBpbmNsdWRlLnB1c2goL2NzcyQvKTtcbiAgICB9XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBTb3VyY2VNYXBEZXZUb29sUGx1Z2luKHtcbiAgICAgICAgZmlsZW5hbWU6ICdbZmlsZV0ubWFwJyxcbiAgICAgICAgaW5jbHVkZSxcbiAgICAgICAgLy8gV2Ugd2FudCB0byBzZXQgc291cmNlUm9vdCB0byAgYHdlYnBhY2s6Ly8vYCBmb3Igbm9uXG4gICAgICAgIC8vIGlubGluZSBzb3VyY2VtYXBzIGFzIG90aGVyd2lzZSBwYXRocyB0byBzb3VyY2VtYXBzIHdpbGwgYmUgYnJva2VuIGluIGJyb3dzZXJcbiAgICAgICAgLy8gYHdlYnBhY2s6Ly8vYCBpcyBuZWVkZWQgZm9yIFZpc3VhbCBTdHVkaW8gYnJlYWtwb2ludHMgdG8gd29yayBwcm9wZXJseSBhcyBjdXJyZW50bHlcbiAgICAgICAgLy8gdGhlcmUgaXMgbm8gd2F5IHRvIHNldCB0aGUgJ3dlYlJvb3QnXG4gICAgICAgIHNvdXJjZVJvb3Q6ICd3ZWJwYWNrOi8vLycsXG4gICAgICAgIG1vZHVsZUZpbGVuYW1lVGVtcGxhdGU6ICdbcmVzb3VyY2UtcGF0aF0nLFxuICAgICAgICBhcHBlbmQ6IGhpZGRlblNvdXJjZU1hcCA/IGZhbHNlIDogdW5kZWZpbmVkLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3RhdHNKc29uKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgSnNvblN0YXRzUGx1Z2luKHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCwgJ3N0YXRzLmpzb24nKSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzdWJyZXNvdXJjZUludGVncml0eSkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFN1YnJlc291cmNlSW50ZWdyaXR5UGx1Z2luKHtcbiAgICAgICAgaGFzaEZ1bmNOYW1lczogWydzaGEzODQnXSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoc2NyaXB0c1NvdXJjZU1hcCB8fCBzdHlsZXNTb3VyY2VNYXApIHtcbiAgICBleHRyYVJ1bGVzLnB1c2goe1xuICAgICAgdGVzdDogL1xcLltjbV0/anN4PyQvLFxuICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnc291cmNlLW1hcC1sb2FkZXInKSxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgZmlsdGVyU291cmNlTWFwcGluZ1VybDogKF9tYXBVcmk6IHN0cmluZywgcmVzb3VyY2VQYXRoOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICBpZiAodmVuZG9yU291cmNlTWFwKSB7XG4gICAgICAgICAgICAvLyBDb25zdW1lIGFsbCBzb3VyY2VtYXBzIHdoZW4gdmVuZG9yIG9wdGlvbiBpcyBlbmFibGVkLlxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gRG9uJ3QgY29uc3VtZSBzb3VyY2VtYXBzIGluIG5vZGVfbW9kdWxlcyB3aGVuIHZlbmRvciBpcyBkaXNhYmxlZC5cbiAgICAgICAgICAvLyBCdXQsIGRvIGNvbnN1bWUgbG9jYWwgbGlicmFyaWVzIHNvdXJjZW1hcHMuXG4gICAgICAgICAgcmV0dXJuICFyZXNvdXJjZVBhdGguaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChtYWluIHx8IHBvbHlmaWxscykge1xuICAgIGV4dHJhUnVsZXMucHVzaCh7XG4gICAgICB0ZXN0OiB0c0NvbmZpZy5vcHRpb25zLmFsbG93SnMgPyAvXFwuW2NtXT9bdGpdc3g/JC8gOiAvXFwuW2NtXT90c3g/JC8sXG4gICAgICBsb2FkZXI6IEFuZ3VsYXJXZWJwYWNrTG9hZGVyUGF0aCxcbiAgICAgIC8vIFRoZSBiZWxvdyBhcmUga25vd24gcGF0aHMgdGhhdCBhcmUgbm90IHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gZXZlbiB3aGVuIGFsbG93SnMgaXMgZW5hYmxlZC5cbiAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgL1tcXFxcL11ub2RlX21vZHVsZXNbL1xcXFxdKD86Y3NzLWxvYWRlcnxtaW5pLWNzcy1leHRyYWN0LXBsdWdpbnx3ZWJwYWNrLWRldi1zZXJ2ZXJ8d2VicGFjaylbL1xcXFxdLyxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goY3JlYXRlSXZ5UGx1Z2luKHdjbywgYW90LCB0c0NvbmZpZ1BhdGgpKTtcbiAgfVxuXG4gIGlmICh3ZWJXb3JrZXJUc0NvbmZpZykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGNyZWF0ZUl2eVBsdWdpbih3Y28sIGZhbHNlLCBwYXRoLnJlc29sdmUod2NvLnJvb3QsIHdlYldvcmtlclRzQ29uZmlnKSkpO1xuICB9XG5cbiAgY29uc3QgZXh0cmFNaW5pbWl6ZXJzID0gW107XG4gIGlmIChzY3JpcHRzT3B0aW1pemF0aW9uKSB7XG4gICAgZXh0cmFNaW5pbWl6ZXJzLnB1c2goXG4gICAgICBuZXcgSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbih7XG4gICAgICAgIGRlZmluZTogYnVpbGRPcHRpb25zLmFvdCA/IEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QgOiBHTE9CQUxfREVGU19GT1JfVEVSU0VSLFxuICAgICAgICBzb3VyY2VtYXA6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICAgIHRhcmdldDogc2NyaXB0VGFyZ2V0LFxuICAgICAgICBrZWVwSWRlbnRpZmllck5hbWVzOiAhYWxsb3dNYW5nbGUgfHwgaXNQbGF0Zm9ybVNlcnZlcixcbiAgICAgICAga2VlcE5hbWVzOiBpc1BsYXRmb3JtU2VydmVyLFxuICAgICAgICByZW1vdmVMaWNlbnNlczogYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcyxcbiAgICAgICAgYWR2YW5jZWQ6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAocGxhdGZvcm0gPT09ICdicm93c2VyJyAmJiAoc2NyaXB0c09wdGltaXphdGlvbiB8fCBzdHlsZXNPcHRpbWl6YXRpb24ubWluaWZ5KSkge1xuICAgIGV4dHJhTWluaW1pemVycy5wdXNoKG5ldyBUcmFuc2ZlclNpemVQbHVnaW4oKSk7XG4gIH1cblxuICBjb25zdCBleHRlcm5hbHM6IENvbmZpZ3VyYXRpb25bJ2V4dGVybmFscyddID0gWy4uLmV4dGVybmFsRGVwZW5kZW5jaWVzXTtcbiAgaWYgKGlzUGxhdGZvcm1TZXJ2ZXIgJiYgIWJ1bmRsZURlcGVuZGVuY2llcykge1xuICAgIGV4dGVybmFscy5wdXNoKCh7IGNvbnRleHQsIHJlcXVlc3QgfSwgY2FsbGJhY2spID0+XG4gICAgICBleHRlcm5hbGl6ZVBhY2thZ2VzKGNvbnRleHQgPz8gd2NvLnByb2plY3RSb290LCByZXF1ZXN0LCBjYWxsYmFjayksXG4gICAgKTtcbiAgfVxuXG4gIGxldCBjcm9zc09yaWdpbkxvYWRpbmc6IE5vbk51bGxhYmxlPENvbmZpZ3VyYXRpb25bJ291dHB1dCddPlsnY3Jvc3NPcmlnaW5Mb2FkaW5nJ10gPSBmYWxzZTtcbiAgaWYgKHN1YnJlc291cmNlSW50ZWdyaXR5ICYmIGNyb3NzT3JpZ2luID09PSAnbm9uZScpIHtcbiAgICBjcm9zc09yaWdpbkxvYWRpbmcgPSAnYW5vbnltb3VzJztcbiAgfSBlbHNlIGlmIChjcm9zc09yaWdpbiAhPT0gJ25vbmUnKSB7XG4gICAgY3Jvc3NPcmlnaW5Mb2FkaW5nID0gY3Jvc3NPcmlnaW47XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG1vZGU6IHNjcmlwdHNPcHRpbWl6YXRpb24gfHwgc3R5bGVzT3B0aW1pemF0aW9uLm1pbmlmeSA/ICdwcm9kdWN0aW9uJyA6ICdkZXZlbG9wbWVudCcsXG4gICAgZGV2dG9vbDogZmFsc2UsXG4gICAgdGFyZ2V0OiBbXG4gICAgICBpc1BsYXRmb3JtU2VydmVyID8gJ25vZGUnIDogJ3dlYicsXG4gICAgICBzY3JpcHRUYXJnZXQgPT09IFNjcmlwdFRhcmdldC5FUzUgPyAnZXM1JyA6ICdlczIwMTUnLFxuICAgIF0sXG4gICAgcHJvZmlsZTogYnVpbGRPcHRpb25zLnN0YXRzSnNvbixcbiAgICByZXNvbHZlOiB7XG4gICAgICByb290czogW3Byb2plY3RSb290XSxcbiAgICAgIGV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICBtb2R1bGVzOiBbdHNDb25maWcub3B0aW9ucy5iYXNlVXJsIHx8IHByb2plY3RSb290LCAnbm9kZV9tb2R1bGVzJ10sXG4gICAgICAuLi5nZXRNYWluRmllbGRzQW5kQ29uZGl0aW9uTmFtZXMoc2NyaXB0VGFyZ2V0LCBpc1BsYXRmb3JtU2VydmVyKSxcbiAgICB9LFxuICAgIHJlc29sdmVMb2FkZXI6IHtcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgfSxcbiAgICBjb250ZXh0OiByb290LFxuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBleHRlcm5hbHMsXG4gICAgb3V0cHV0OiB7XG4gICAgICB1bmlxdWVOYW1lOiBwcm9qZWN0TmFtZSxcbiAgICAgIGhhc2hGdW5jdGlvbjogJ3h4aGFzaDY0JywgLy8gdG9kbzogcmVtb3ZlIGluIHdlYnBhY2sgNi4gVGhpcyBpcyBwYXJ0IG9mIGBmdXR1cmVEZWZhdWx0c2AuXG4gICAgICBjbGVhbjogYnVpbGRPcHRpb25zLmRlbGV0ZU91dHB1dFBhdGggPz8gdHJ1ZSxcbiAgICAgIHBhdGg6IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCksXG4gICAgICBwdWJsaWNQYXRoOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsID8/ICcnLFxuICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICAgIGNodW5rRmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICAgIGxpYnJhcnlUYXJnZXQ6IGlzUGxhdGZvcm1TZXJ2ZXIgPyAnY29tbW9uanMnIDogdW5kZWZpbmVkLFxuICAgICAgY3Jvc3NPcmlnaW5Mb2FkaW5nLFxuICAgICAgdHJ1c3RlZFR5cGVzOiAnYW5ndWxhciNidW5kbGVyJyxcbiAgICAgIHNjcmlwdFR5cGU6ICdtb2R1bGUnLFxuICAgIH0sXG4gICAgd2F0Y2g6IGJ1aWxkT3B0aW9ucy53YXRjaCxcbiAgICB3YXRjaE9wdGlvbnM6IHtcbiAgICAgIHBvbGwsXG4gICAgICBpZ25vcmVkOiBwb2xsID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiAnKiovbm9kZV9tb2R1bGVzLyoqJyxcbiAgICB9LFxuICAgIHBlcmZvcm1hbmNlOiB7XG4gICAgICBoaW50czogZmFsc2UsXG4gICAgfSxcbiAgICBpZ25vcmVXYXJuaW5nczogW1xuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zb3VyY2UtbWFwLWxvYWRlci9ibG9iL2IyZGU0MjQ5Yzc0MzFkZDg0MzJkYTYwN2UwOGYwZjY1ZTlkNjQyMTkvc3JjL2luZGV4LmpzI0w4M1xuICAgICAgL0ZhaWxlZCB0byBwYXJzZSBzb3VyY2UgbWFwIGZyb20vLFxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9wb3N0Y3NzLWxvYWRlci9ibG9iL2JkMjYxODc1ZmRmOWM1OTZhZjRmZmIzYTFhNzNmZTNjNTQ5YmVmZGEvc3JjL2luZGV4LmpzI0wxNTMtTDE1OFxuICAgICAgL0FkZCBwb3N0Y3NzIGFzIHByb2plY3QgZGVwZW5kZW5jeS8sXG4gICAgICAvLyBlc2J1aWxkIHdpbGwgaXNzdWUgYSB3YXJuaW5nLCB3aGlsZSBzdGlsbCBob2lzdHMgdGhlIEBjaGFyc2V0IGF0IHRoZSB2ZXJ5IHRvcC5cbiAgICAgIC8vIFRoaXMgaXMgY2F1c2VkIGJ5IGEgYnVnIGluIGNzcy1sb2FkZXIgaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9jc3MtbG9hZGVyL2lzc3Vlcy8xMjEyXG4gICAgICAvXCJAY2hhcnNldFwiIG11c3QgYmUgdGhlIGZpcnN0IHJ1bGUgaW4gdGhlIGZpbGUvLFxuICAgIF0sXG4gICAgbW9kdWxlOiB7XG4gICAgICAvLyBTaG93IGFuIGVycm9yIGZvciBtaXNzaW5nIGV4cG9ydHMgaW5zdGVhZCBvZiBhIHdhcm5pbmcuXG4gICAgICBzdHJpY3RFeHBvcnRQcmVzZW5jZTogdHJ1ZSxcbiAgICAgIHBhcnNlcjoge1xuICAgICAgICBqYXZhc2NyaXB0OiB7XG4gICAgICAgICAgLy8gRGlzYWJsZSBhdXRvIFVSTCBhc3NldCBtb2R1bGUgY3JlYXRpb24uIFRoaXMgZG9lc24ndCBlZmZlY3QgYG5ldyBXb3JrZXIobmV3IFVSTCguLi4pKWBcbiAgICAgICAgICAvLyBodHRwczovL3dlYnBhY2suanMub3JnL2d1aWRlcy9hc3NldC1tb2R1bGVzLyN1cmwtYXNzZXRzXG4gICAgICAgICAgdXJsOiBmYWxzZSxcbiAgICAgICAgICB3b3JrZXI6ICEhd2ViV29ya2VyVHNDb25maWcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC4/KHN2Z3xodG1sKSQvLFxuICAgICAgICAgIC8vIE9ubHkgcHJvY2VzcyBIVE1MIGFuZCBTVkcgd2hpY2ggYXJlIGtub3duIEFuZ3VsYXIgY29tcG9uZW50IHJlc291cmNlcy5cbiAgICAgICAgICByZXNvdXJjZVF1ZXJ5OiAvXFw/bmdSZXNvdXJjZS8sXG4gICAgICAgICAgdHlwZTogJ2Fzc2V0L3NvdXJjZScsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBNYXJrIGZpbGVzIGluc2lkZSBgcnhqcy9hZGRgIGFzIGNvbnRhaW5pbmcgc2lkZSBlZmZlY3RzLlxuICAgICAgICAgIC8vIElmIHRoaXMgaXMgZml4ZWQgdXBzdHJlYW0gYW5kIHRoZSBmaXhlZCB2ZXJzaW9uIGJlY29tZXMgdGhlIG1pbmltdW1cbiAgICAgICAgICAvLyBzdXBwb3J0ZWQgdmVyc2lvbiwgdGhpcyBjYW4gYmUgcmVtb3ZlZC5cbiAgICAgICAgICB0ZXN0OiAvWy9cXFxcXXJ4anNbL1xcXFxdYWRkWy9cXFxcXS4rXFwuanMkLyxcbiAgICAgICAgICBzaWRlRWZmZWN0czogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5bY21dP1t0al1zeD8kLyxcbiAgICAgICAgICAvLyBUaGUgYmVsb3cgaXMgbmVlZGVkIGR1ZSB0byBhIGJ1ZyBpbiBgQGJhYmVsL3J1bnRpbWVgLiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9iYWJlbC9iYWJlbC9pc3N1ZXMvMTI4MjRcbiAgICAgICAgICByZXNvbHZlOiB7IGZ1bGx5U3BlY2lmaWVkOiBmYWxzZSB9LFxuICAgICAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgICAgIC9bXFxcXC9dbm9kZV9tb2R1bGVzWy9cXFxcXSg/OmNvcmUtanN8QGJhYmVsfHRzbGlifHdlYi1hbmltYXRpb25zLWpzfHdlYi1zdHJlYW1zLXBvbHlmaWxsfHdoYXR3Zy11cmwpWy9cXFxcXS8sXG4gICAgICAgICAgXSxcbiAgICAgICAgICB1c2U6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJy4uLy4uL2JhYmVsL3dlYnBhY2stbG9hZGVyJyksXG4gICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICBjYWNoZURpcmVjdG9yeTogKGNhY2hlLmVuYWJsZWQgJiYgcGF0aC5qb2luKGNhY2hlLnBhdGgsICdiYWJlbC13ZWJwYWNrJykpIHx8IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNjcmlwdFRhcmdldCxcbiAgICAgICAgICAgICAgICBhb3Q6IGJ1aWxkT3B0aW9ucy5hb3QsXG4gICAgICAgICAgICAgICAgb3B0aW1pemU6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgICAgICAgICAgICBpbnN0cnVtZW50Q29kZTogY29kZUNvdmVyYWdlXG4gICAgICAgICAgICAgICAgICA/IHtcbiAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZEJhc2VQYXRoOiBzb3VyY2VSb290LFxuICAgICAgICAgICAgICAgICAgICAgIGV4Y2x1ZGVkUGF0aHM6IGdldEluc3RydW1lbnRhdGlvbkV4Y2x1ZGVkUGF0aHMocm9vdCwgY29kZUNvdmVyYWdlRXhjbHVkZSksXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICB9IGFzIEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIC4uLmV4dHJhUnVsZXMsXG4gICAgICBdLFxuICAgIH0sXG4gICAgZXhwZXJpbWVudHM6IHtcbiAgICAgIGJhY2tDb21wYXQ6IGZhbHNlLFxuICAgICAgc3luY1dlYkFzc2VtYmx5OiB0cnVlLFxuICAgICAgYXN5bmNXZWJBc3NlbWJseTogdHJ1ZSxcbiAgICB9LFxuICAgIGluZnJhc3RydWN0dXJlTG9nZ2luZzoge1xuICAgICAgZGVidWc6IHZlcmJvc2UsXG4gICAgICBsZXZlbDogdmVyYm9zZSA/ICd2ZXJib3NlJyA6ICdlcnJvcicsXG4gICAgfSxcbiAgICBzdGF0czogZ2V0U3RhdHNPcHRpb25zKHZlcmJvc2UpLFxuICAgIGNhY2hlOiBnZXRDYWNoZVNldHRpbmdzKHdjbywgTkdfVkVSU0lPTi5mdWxsKSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG1pbmltaXplcjogZXh0cmFNaW5pbWl6ZXJzLFxuICAgICAgbW9kdWxlSWRzOiAnZGV0ZXJtaW5pc3RpYycsXG4gICAgICBjaHVua0lkczogYnVpbGRPcHRpb25zLm5hbWVkQ2h1bmtzID8gJ25hbWVkJyA6ICdkZXRlcm1pbmlzdGljJyxcbiAgICAgIGVtaXRPbkVycm9yczogZmFsc2UsXG4gICAgICBydW50aW1lQ2h1bms6IGlzUGxhdGZvcm1TZXJ2ZXIgPyBmYWxzZSA6ICdzaW5nbGUnLFxuICAgICAgc3BsaXRDaHVua3M6IHtcbiAgICAgICAgbWF4QXN5bmNSZXF1ZXN0czogSW5maW5pdHksXG4gICAgICAgIGNhY2hlR3JvdXBzOiB7XG4gICAgICAgICAgZGVmYXVsdDogISFjb21tb25DaHVuayAmJiB7XG4gICAgICAgICAgICBjaHVua3M6ICdhc3luYycsXG4gICAgICAgICAgICBtaW5DaHVua3M6IDIsXG4gICAgICAgICAgICBwcmlvcml0eTogMTAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb21tb246ICEhY29tbW9uQ2h1bmsgJiYge1xuICAgICAgICAgICAgbmFtZTogJ2NvbW1vbicsXG4gICAgICAgICAgICBjaHVua3M6ICdhc3luYycsXG4gICAgICAgICAgICBtaW5DaHVua3M6IDIsXG4gICAgICAgICAgICBlbmZvcmNlOiB0cnVlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IDUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB2ZW5kb3JzOiBmYWxzZSxcbiAgICAgICAgICBkZWZhdWx0VmVuZG9yczogISF2ZW5kb3JDaHVuayAmJiB7XG4gICAgICAgICAgICBuYW1lOiAndmVuZG9yJyxcbiAgICAgICAgICAgIGNodW5rczogKGNodW5rKSA9PiBjaHVuay5uYW1lID09PSAnbWFpbicsXG4gICAgICAgICAgICBlbmZvcmNlOiB0cnVlLFxuICAgICAgICAgICAgdGVzdDogL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIHBsdWdpbnM6IFtuZXcgTmFtZWRDaHVua3NQbHVnaW4oKSwgbmV3IERlZHVwZU1vZHVsZVJlc29sdmVQbHVnaW4oeyB2ZXJib3NlIH0pLCAuLi5leHRyYVBsdWdpbnNdLFxuICAgIG5vZGU6IGZhbHNlLFxuICB9O1xufVxuIl19