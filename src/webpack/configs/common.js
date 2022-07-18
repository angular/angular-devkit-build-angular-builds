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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhDQUE0RDtBQUM1RCw4RUFBb0Q7QUFDcEQsMkNBQTZCO0FBQzdCLDJDQUEwQztBQUMxQyxxQ0FNaUI7QUFDakIsaUZBQTJFO0FBRzNFLHlFQUE4RDtBQUM5RCxtREFBcUQ7QUFDckQsd0NBTW9CO0FBQ3BCLDhFQUF5RTtBQUN6RSx3RUFBbUU7QUFDbkUsZ0VBQTREO0FBQzVELDBFQUFxRTtBQUNyRSxzREFBd0Q7QUFDeEQsZ0ZBQTBFO0FBQzFFLDhDQVMwQjtBQUUxQixNQUFNLFlBQVksR0FBRyx3QkFBd0IsQ0FBQztBQUU5QyxrREFBa0Q7QUFDM0MsS0FBSyxVQUFVLGVBQWUsQ0FBQyxHQUF5Qjs7SUFDN0QsTUFBTSxFQUNKLElBQUksRUFDSixXQUFXLEVBQ1gsWUFBWSxFQUNaLFFBQVEsRUFDUixXQUFXLEVBQ1gsVUFBVSxFQUNWLFlBQVksRUFDWixZQUFZLEdBQ2IsR0FBRyxHQUFHLENBQUM7SUFDUixNQUFNLEVBQ0osS0FBSyxFQUNMLFlBQVksRUFDWixXQUFXLEdBQUcsTUFBTSxFQUNwQixRQUFRLEdBQUcsU0FBUyxFQUNwQixHQUFHLEdBQUcsSUFBSSxFQUNWLG1CQUFtQixHQUFHLEVBQUUsRUFDeEIsSUFBSSxFQUNKLFNBQVMsRUFDVCxTQUFTLEVBQUUsRUFDVCxNQUFNLEVBQUUsZUFBZSxFQUN2QixPQUFPLEVBQUUsZ0JBQWdCLEVBQ3pCLE1BQU0sRUFBRSxlQUFlLEVBQ3ZCLE1BQU0sRUFBRSxlQUFlLEdBQ3hCLEVBQ0QsWUFBWSxFQUFFLEVBQUUsTUFBTSxFQUFFLGtCQUFrQixF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QUFNLEVBQUUsT0FBTzt3QkFDZixTQUFTLEVBQUUsQ0FBQzt3QkFDWixPQUFPLEVBQUUsSUFBSTt3QkFDYixRQUFRLEVBQUUsQ0FBQztxQkFDWjtvQkFDRCxPQUFPLEVBQUUsS0FBSztvQkFDZCxjQUFjLEVBQUUsQ0FBQyxDQUFDLFdBQVcsSUFBSTt3QkFDL0IsSUFBSSxFQUFFLFFBQVE7d0JBQ2QsTUFBTSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU07d0JBQ3hDLE9BQU8sRUFBRSxJQUFJO3dCQUNiLElBQUksRUFBRSxZQUFZO3FCQUNuQjtpQkFDRjthQUNGO1NBQ0Y7UUFDRCxPQUFPLEVBQUUsQ0FBQyxJQUFJLHVDQUFpQixFQUFFLEVBQUUsSUFBSSxtQ0FBeUIsQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsR0FBRyxZQUFZLENBQUM7UUFDL0YsSUFBSSxFQUFFLEtBQUs7S0FDWixDQUFDO0FBQ0osQ0FBQztBQTlZRCwwQ0E4WUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQW5ndWxhcldlYnBhY2tMb2FkZXJQYXRoIH0gZnJvbSAnQG5ndG9vbHMvd2VicGFjayc7XG5pbXBvcnQgQ29weVdlYnBhY2tQbHVnaW4gZnJvbSAnY29weS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgU2NyaXB0VGFyZ2V0IH0gZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQge1xuICBDb21waWxlcixcbiAgQ29uZmlndXJhdGlvbixcbiAgQ29udGV4dFJlcGxhY2VtZW50UGx1Z2luLFxuICBSdWxlU2V0UnVsZSxcbiAgU291cmNlTWFwRGV2VG9vbFBsdWdpbixcbn0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBTdWJyZXNvdXJjZUludGVncml0eVBsdWdpbiB9IGZyb20gJ3dlYnBhY2stc3VicmVzb3VyY2UtaW50ZWdyaXR5JztcbmltcG9ydCB7IEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnMgfSBmcm9tICcuLi8uLi9iYWJlbC93ZWJwYWNrLWxvYWRlcic7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgYWxsb3dNYW5nbGUgfSBmcm9tICcuLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi8uLi91dGlscy9sb2FkLWVzbSc7XG5pbXBvcnQge1xuICBDb21tb25Kc1VzYWdlV2FyblBsdWdpbixcbiAgRGVkdXBlTW9kdWxlUmVzb2x2ZVBsdWdpbixcbiAgSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbixcbiAgSnNvblN0YXRzUGx1Z2luLFxuICBTY3JpcHRzV2VicGFja1BsdWdpbixcbn0gZnJvbSAnLi4vcGx1Z2lucyc7XG5pbXBvcnQgeyBEZXZUb29sc0lnbm9yZVBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvZGV2dG9vbHMtaWdub3JlLXBsdWdpbic7XG5pbXBvcnQgeyBOYW1lZENodW5rc1BsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvbmFtZWQtY2h1bmtzLXBsdWdpbic7XG5pbXBvcnQgeyBQcm9ncmVzc1BsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvcHJvZ3Jlc3MtcGx1Z2luJztcbmltcG9ydCB7IFRyYW5zZmVyU2l6ZVBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvdHJhbnNmZXItc2l6ZS1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlSXZ5UGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy90eXBlc2NyaXB0JztcbmltcG9ydCB7IFdhdGNoRmlsZXNMb2dzUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy93YXRjaC1maWxlcy1sb2dzLXBsdWdpbic7XG5pbXBvcnQge1xuICBhc3NldFBhdHRlcm5zLFxuICBleHRlcm5hbGl6ZVBhY2thZ2VzLFxuICBnZXRDYWNoZVNldHRpbmdzLFxuICBnZXRJbnN0cnVtZW50YXRpb25FeGNsdWRlZFBhdGhzLFxuICBnZXRNYWluRmllbGRzQW5kQ29uZGl0aW9uTmFtZXMsXG4gIGdldE91dHB1dEhhc2hGb3JtYXQsXG4gIGdldFN0YXRzT3B0aW9ucyxcbiAgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZSxcbn0gZnJvbSAnLi4vdXRpbHMvaGVscGVycyc7XG5cbmNvbnN0IFZFTkRPUlNfVEVTVCA9IC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS87XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q29tbW9uQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpOiBQcm9taXNlPENvbmZpZ3VyYXRpb24+IHtcbiAgY29uc3Qge1xuICAgIHJvb3QsXG4gICAgcHJvamVjdFJvb3QsXG4gICAgYnVpbGRPcHRpb25zLFxuICAgIHRzQ29uZmlnLFxuICAgIHByb2plY3ROYW1lLFxuICAgIHNvdXJjZVJvb3QsXG4gICAgdHNDb25maWdQYXRoLFxuICAgIHNjcmlwdFRhcmdldCxcbiAgfSA9IHdjbztcbiAgY29uc3Qge1xuICAgIGNhY2hlLFxuICAgIGNvZGVDb3ZlcmFnZSxcbiAgICBjcm9zc09yaWdpbiA9ICdub25lJyxcbiAgICBwbGF0Zm9ybSA9ICdicm93c2VyJyxcbiAgICBhb3QgPSB0cnVlLFxuICAgIGNvZGVDb3ZlcmFnZUV4Y2x1ZGUgPSBbXSxcbiAgICBtYWluLFxuICAgIHBvbHlmaWxscyxcbiAgICBzb3VyY2VNYXA6IHtcbiAgICAgIHN0eWxlczogc3R5bGVzU291cmNlTWFwLFxuICAgICAgc2NyaXB0czogc2NyaXB0c1NvdXJjZU1hcCxcbiAgICAgIHZlbmRvcjogdmVuZG9yU291cmNlTWFwLFxuICAgICAgaGlkZGVuOiBoaWRkZW5Tb3VyY2VNYXAsXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHsgc3R5bGVzOiBzdHlsZXNPcHRpbWl6YXRpb24sIHNjcmlwdHM6IHNjcmlwdHNPcHRpbWl6YXRpb24gfSxcbiAgICBjb21tb25DaHVuayxcbiAgICB2ZW5kb3JDaHVuayxcbiAgICBzdWJyZXNvdXJjZUludGVncml0eSxcbiAgICB2ZXJib3NlLFxuICAgIHBvbGwsXG4gICAgd2ViV29ya2VyVHNDb25maWcsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMgPSBbXSxcbiAgICBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMsXG4gICAgYnVuZGxlRGVwZW5kZW5jaWVzLFxuICB9ID0gYnVpbGRPcHRpb25zO1xuXG4gIGNvbnN0IGlzUGxhdGZvcm1TZXJ2ZXIgPSBidWlsZE9wdGlvbnMucGxhdGZvcm0gPT09ICdzZXJ2ZXInO1xuICBjb25zdCBleHRyYVBsdWdpbnM6IHsgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKTogdm9pZCB9W10gPSBbXTtcbiAgY29uc3QgZXh0cmFSdWxlczogUnVsZVNldFJ1bGVbXSA9IFtdO1xuICBjb25zdCBlbnRyeVBvaW50czogeyBba2V5OiBzdHJpbmddOiBbc3RyaW5nLCAuLi5zdHJpbmdbXV0gfSA9IHt9O1xuXG4gIC8vIExvYWQgRVNNIGBAYW5ndWxhci9jb21waWxlci1jbGlgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gIGNvbnN0IHtcbiAgICBHTE9CQUxfREVGU19GT1JfVEVSU0VSLFxuICAgIEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QsXG4gICAgVkVSU0lPTjogTkdfVkVSU0lPTixcbiAgfSA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk+KCdAYW5ndWxhci9jb21waWxlci1jbGknKTtcblxuICAvLyBkZXRlcm1pbmUgaGFzaGluZyBmb3JtYXRcbiAgY29uc3QgaGFzaEZvcm1hdCA9IGdldE91dHB1dEhhc2hGb3JtYXQoYnVpbGRPcHRpb25zLm91dHB1dEhhc2hpbmcpO1xuXG4gIGlmIChidWlsZE9wdGlvbnMucHJvZ3Jlc3MpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgUHJvZ3Jlc3NQbHVnaW4ocGxhdGZvcm0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMubWFpbikge1xuICAgIGNvbnN0IG1haW5QYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5tYWluKTtcbiAgICBlbnRyeVBvaW50c1snbWFpbiddID0gW21haW5QYXRoXTtcbiAgfVxuXG4gIGlmIChpc1BsYXRmb3JtU2VydmVyKSB7XG4gICAgLy8gRml4ZXMgQ3JpdGljYWwgZGVwZW5kZW5jeTogdGhlIHJlcXVlc3Qgb2YgYSBkZXBlbmRlbmN5IGlzIGFuIGV4cHJlc3Npb25cbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgQ29udGV4dFJlcGxhY2VtZW50UGx1Z2luKC9AP2hhcGl8ZXhwcmVzc1tcXFxcL10vKSk7XG4gIH1cblxuICBpZiAoIWlzUGxhdGZvcm1TZXJ2ZXIpIHtcbiAgICBpZiAoYnVpbGRPcHRpb25zLnBvbHlmaWxscykge1xuICAgICAgY29uc3QgcHJvamVjdFBvbHlmaWxscyA9IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMucG9seWZpbGxzKTtcbiAgICAgIGlmIChlbnRyeVBvaW50c1sncG9seWZpbGxzJ10pIHtcbiAgICAgICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddLnB1c2gocHJvamVjdFBvbHlmaWxscyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10gPSBbcHJvamVjdFBvbHlmaWxsc107XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcykge1xuICAgIC8vIFdoZW4gdGhpcyBpcyBub3QgZGVmaW5lZCBpdCBtZWFucyB0aGUgYnVpbGRlciBkb2Vzbid0IHN1cHBvcnQgc2hvd2luZyBjb21tb24ganMgdXNhZ2VzLlxuICAgIC8vIFdoZW4gaXQgZG9lcyBpdCB3aWxsIGJlIGFuIGFycmF5LlxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IENvbW1vbkpzVXNhZ2VXYXJuUGx1Z2luKHtcbiAgICAgICAgYWxsb3dlZERlcGVuZGVuY2llczogYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgZ2xvYmFsIHNjcmlwdHNcbiAgLy8gQWRkIGEgbmV3IGFzc2V0IGZvciBlYWNoIGVudHJ5LlxuICBmb3IgKGNvbnN0IHsgYnVuZGxlTmFtZSwgaW5qZWN0LCBwYXRocyB9IG9mIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUoXG4gICAgcm9vdCxcbiAgICBidWlsZE9wdGlvbnMuc2NyaXB0cyxcbiAgKSkge1xuICAgIC8vIExhenkgc2NyaXB0cyBkb24ndCBnZXQgYSBoYXNoLCBvdGhlcndpc2UgdGhleSBjYW4ndCBiZSBsb2FkZWQgYnkgbmFtZS5cbiAgICBjb25zdCBoYXNoID0gaW5qZWN0ID8gaGFzaEZvcm1hdC5zY3JpcHQgOiAnJztcblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFNjcmlwdHNXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgbmFtZTogYnVuZGxlTmFtZSxcbiAgICAgICAgc291cmNlTWFwOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgICBzY3JpcHRzOiBwYXRocyxcbiAgICAgICAgZmlsZW5hbWU6IGAke3BhdGguYmFzZW5hbWUoYnVuZGxlTmFtZSl9JHtoYXNofS5qc2AsXG4gICAgICAgIGJhc2VQYXRoOiBwcm9qZWN0Um9vdCxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICAvLyBwcm9jZXNzIGFzc2V0IGVudHJpZXNcbiAgaWYgKGJ1aWxkT3B0aW9ucy5hc3NldHMubGVuZ3RoKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgQ29weVdlYnBhY2tQbHVnaW4oe1xuICAgICAgICBwYXR0ZXJuczogYXNzZXRQYXR0ZXJucyhyb290LCBidWlsZE9wdGlvbnMuYXNzZXRzKSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcykge1xuICAgIGNvbnN0IExpY2Vuc2VXZWJwYWNrUGx1Z2luID0gcmVxdWlyZSgnbGljZW5zZS13ZWJwYWNrLXBsdWdpbicpLkxpY2Vuc2VXZWJwYWNrUGx1Z2luO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IExpY2Vuc2VXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICB3YXJuaW5nczogZmFsc2UsXG4gICAgICAgICAgZXJyb3JzOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgcGVyQ2h1bmtPdXRwdXQ6IGZhbHNlLFxuICAgICAgICBvdXRwdXRGaWxlbmFtZTogJzNyZHBhcnR5bGljZW5zZXMudHh0JyxcbiAgICAgICAgc2tpcENoaWxkQ29tcGlsZXJzOiB0cnVlLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzY3JpcHRzU291cmNlTWFwIHx8IHN0eWxlc1NvdXJjZU1hcCkge1xuICAgIGNvbnN0IGluY2x1ZGUgPSBbXTtcbiAgICBpZiAoc2NyaXB0c1NvdXJjZU1hcCkge1xuICAgICAgaW5jbHVkZS5wdXNoKC9qcyQvKTtcbiAgICB9XG5cbiAgICBpZiAoc3R5bGVzU291cmNlTWFwKSB7XG4gICAgICBpbmNsdWRlLnB1c2goL2NzcyQvKTtcbiAgICB9XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgRGV2VG9vbHNJZ25vcmVQbHVnaW4oKSk7XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBTb3VyY2VNYXBEZXZUb29sUGx1Z2luKHtcbiAgICAgICAgZmlsZW5hbWU6ICdbZmlsZV0ubWFwJyxcbiAgICAgICAgaW5jbHVkZSxcbiAgICAgICAgLy8gV2Ugd2FudCB0byBzZXQgc291cmNlUm9vdCB0byAgYHdlYnBhY2s6Ly8vYCBmb3Igbm9uXG4gICAgICAgIC8vIGlubGluZSBzb3VyY2VtYXBzIGFzIG90aGVyd2lzZSBwYXRocyB0byBzb3VyY2VtYXBzIHdpbGwgYmUgYnJva2VuIGluIGJyb3dzZXJcbiAgICAgICAgLy8gYHdlYnBhY2s6Ly8vYCBpcyBuZWVkZWQgZm9yIFZpc3VhbCBTdHVkaW8gYnJlYWtwb2ludHMgdG8gd29yayBwcm9wZXJseSBhcyBjdXJyZW50bHlcbiAgICAgICAgLy8gdGhlcmUgaXMgbm8gd2F5IHRvIHNldCB0aGUgJ3dlYlJvb3QnXG4gICAgICAgIHNvdXJjZVJvb3Q6ICd3ZWJwYWNrOi8vLycsXG4gICAgICAgIG1vZHVsZUZpbGVuYW1lVGVtcGxhdGU6ICdbcmVzb3VyY2UtcGF0aF0nLFxuICAgICAgICBhcHBlbmQ6IGhpZGRlblNvdXJjZU1hcCA/IGZhbHNlIDogdW5kZWZpbmVkLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmICh2ZXJib3NlKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFdhdGNoRmlsZXNMb2dzUGx1Z2luKCkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdGF0c0pzb24pIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBKc29uU3RhdHNQbHVnaW4ocGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoLCAnc3RhdHMuanNvbicpKSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHN1YnJlc291cmNlSW50ZWdyaXR5KSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4oe1xuICAgICAgICBoYXNoRnVuY05hbWVzOiBbJ3NoYTM4NCddLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzY3JpcHRzU291cmNlTWFwIHx8IHN0eWxlc1NvdXJjZU1hcCkge1xuICAgIGV4dHJhUnVsZXMucHVzaCh7XG4gICAgICB0ZXN0OiAvXFwuW2NtXT9qc3g/JC8sXG4gICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdzb3VyY2UtbWFwLWxvYWRlcicpLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICBmaWx0ZXJTb3VyY2VNYXBwaW5nVXJsOiAoX21hcFVyaTogc3RyaW5nLCByZXNvdXJjZVBhdGg6IHN0cmluZykgPT4ge1xuICAgICAgICAgIGlmICh2ZW5kb3JTb3VyY2VNYXApIHtcbiAgICAgICAgICAgIC8vIENvbnN1bWUgYWxsIHNvdXJjZW1hcHMgd2hlbiB2ZW5kb3Igb3B0aW9uIGlzIGVuYWJsZWQuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBEb24ndCBjb25zdW1lIHNvdXJjZW1hcHMgaW4gbm9kZV9tb2R1bGVzIHdoZW4gdmVuZG9yIGlzIGRpc2FibGVkLlxuICAgICAgICAgIC8vIEJ1dCwgZG8gY29uc3VtZSBsb2NhbCBsaWJyYXJpZXMgc291cmNlbWFwcy5cbiAgICAgICAgICByZXR1cm4gIXJlc291cmNlUGF0aC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJyk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgaWYgKG1haW4gfHwgcG9seWZpbGxzKSB7XG4gICAgZXh0cmFSdWxlcy5wdXNoKHtcbiAgICAgIHRlc3Q6IHRzQ29uZmlnLm9wdGlvbnMuYWxsb3dKcyA/IC9cXC5bY21dP1t0al1zeD8kLyA6IC9cXC5bY21dP3RzeD8kLyxcbiAgICAgIGxvYWRlcjogQW5ndWxhcldlYnBhY2tMb2FkZXJQYXRoLFxuICAgICAgLy8gVGhlIGJlbG93IGFyZSBrbm93biBwYXRocyB0aGF0IGFyZSBub3QgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBjb21waWxhdGlvbiBldmVuIHdoZW4gYWxsb3dKcyBpcyBlbmFibGVkLlxuICAgICAgZXhjbHVkZTogW1xuICAgICAgICAvW1xcXFwvXW5vZGVfbW9kdWxlc1svXFxcXF0oPzpjc3MtbG9hZGVyfG1pbmktY3NzLWV4dHJhY3QtcGx1Z2lufHdlYnBhY2stZGV2LXNlcnZlcnx3ZWJwYWNrKVsvXFxcXF0vLFxuICAgICAgXSxcbiAgICB9KTtcbiAgICBleHRyYVBsdWdpbnMucHVzaChjcmVhdGVJdnlQbHVnaW4od2NvLCBhb3QsIHRzQ29uZmlnUGF0aCkpO1xuICB9XG5cbiAgaWYgKHdlYldvcmtlclRzQ29uZmlnKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goY3JlYXRlSXZ5UGx1Z2luKHdjbywgZmFsc2UsIHBhdGgucmVzb2x2ZSh3Y28ucm9vdCwgd2ViV29ya2VyVHNDb25maWcpKSk7XG4gIH1cblxuICBjb25zdCBleHRyYU1pbmltaXplcnMgPSBbXTtcbiAgaWYgKHNjcmlwdHNPcHRpbWl6YXRpb24pIHtcbiAgICBleHRyYU1pbmltaXplcnMucHVzaChcbiAgICAgIG5ldyBKYXZhU2NyaXB0T3B0aW1pemVyUGx1Z2luKHtcbiAgICAgICAgZGVmaW5lOiBidWlsZE9wdGlvbnMuYW90ID8gR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCA6IEdMT0JBTF9ERUZTX0ZPUl9URVJTRVIsXG4gICAgICAgIHNvdXJjZW1hcDogc2NyaXB0c1NvdXJjZU1hcCxcbiAgICAgICAgdGFyZ2V0OiBzY3JpcHRUYXJnZXQsXG4gICAgICAgIGtlZXBJZGVudGlmaWVyTmFtZXM6ICFhbGxvd01hbmdsZSB8fCBpc1BsYXRmb3JtU2VydmVyLFxuICAgICAgICBrZWVwTmFtZXM6IGlzUGxhdGZvcm1TZXJ2ZXIsXG4gICAgICAgIHJlbW92ZUxpY2Vuc2VzOiBidWlsZE9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzLFxuICAgICAgICBhZHZhbmNlZDogYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChwbGF0Zm9ybSA9PT0gJ2Jyb3dzZXInICYmIChzY3JpcHRzT3B0aW1pemF0aW9uIHx8IHN0eWxlc09wdGltaXphdGlvbi5taW5pZnkpKSB7XG4gICAgZXh0cmFNaW5pbWl6ZXJzLnB1c2gobmV3IFRyYW5zZmVyU2l6ZVBsdWdpbigpKTtcbiAgfVxuXG4gIGNvbnN0IGV4dGVybmFsczogQ29uZmlndXJhdGlvblsnZXh0ZXJuYWxzJ10gPSBbLi4uZXh0ZXJuYWxEZXBlbmRlbmNpZXNdO1xuICBpZiAoaXNQbGF0Zm9ybVNlcnZlciAmJiAhYnVuZGxlRGVwZW5kZW5jaWVzKSB7XG4gICAgZXh0ZXJuYWxzLnB1c2goKHsgY29udGV4dCwgcmVxdWVzdCB9LCBjYWxsYmFjaykgPT5cbiAgICAgIGV4dGVybmFsaXplUGFja2FnZXMoY29udGV4dCA/PyB3Y28ucHJvamVjdFJvb3QsIHJlcXVlc3QsIGNhbGxiYWNrKSxcbiAgICApO1xuICB9XG5cbiAgbGV0IGNyb3NzT3JpZ2luTG9hZGluZzogTm9uTnVsbGFibGU8Q29uZmlndXJhdGlvblsnb3V0cHV0J10+Wydjcm9zc09yaWdpbkxvYWRpbmcnXSA9IGZhbHNlO1xuICBpZiAoc3VicmVzb3VyY2VJbnRlZ3JpdHkgJiYgY3Jvc3NPcmlnaW4gPT09ICdub25lJykge1xuICAgIGNyb3NzT3JpZ2luTG9hZGluZyA9ICdhbm9ueW1vdXMnO1xuICB9IGVsc2UgaWYgKGNyb3NzT3JpZ2luICE9PSAnbm9uZScpIHtcbiAgICBjcm9zc09yaWdpbkxvYWRpbmcgPSBjcm9zc09yaWdpbjtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbW9kZTogc2NyaXB0c09wdGltaXphdGlvbiB8fCBzdHlsZXNPcHRpbWl6YXRpb24ubWluaWZ5ID8gJ3Byb2R1Y3Rpb24nIDogJ2RldmVsb3BtZW50JyxcbiAgICBkZXZ0b29sOiBmYWxzZSxcbiAgICB0YXJnZXQ6IFtcbiAgICAgIGlzUGxhdGZvcm1TZXJ2ZXIgPyAnbm9kZScgOiAnd2ViJyxcbiAgICAgIHNjcmlwdFRhcmdldCA9PT0gU2NyaXB0VGFyZ2V0LkVTNSA/ICdlczUnIDogJ2VzMjAxNScsXG4gICAgXSxcbiAgICBwcm9maWxlOiBidWlsZE9wdGlvbnMuc3RhdHNKc29uLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIHJvb3RzOiBbcHJvamVjdFJvb3RdLFxuICAgICAgZXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgICAgc3ltbGlua3M6ICFidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgIG1vZHVsZXM6IFt0c0NvbmZpZy5vcHRpb25zLmJhc2VVcmwgfHwgcHJvamVjdFJvb3QsICdub2RlX21vZHVsZXMnXSxcbiAgICAgIC4uLmdldE1haW5GaWVsZHNBbmRDb25kaXRpb25OYW1lcyhzY3JpcHRUYXJnZXQsIGlzUGxhdGZvcm1TZXJ2ZXIpLFxuICAgIH0sXG4gICAgcmVzb2x2ZUxvYWRlcjoge1xuICAgICAgc3ltbGlua3M6ICFidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICB9LFxuICAgIGNvbnRleHQ6IHJvb3QsXG4gICAgZW50cnk6IGVudHJ5UG9pbnRzLFxuICAgIGV4dGVybmFscyxcbiAgICBvdXRwdXQ6IHtcbiAgICAgIHVuaXF1ZU5hbWU6IHByb2plY3ROYW1lLFxuICAgICAgaGFzaEZ1bmN0aW9uOiAneHhoYXNoNjQnLCAvLyB0b2RvOiByZW1vdmUgaW4gd2VicGFjayA2LiBUaGlzIGlzIHBhcnQgb2YgYGZ1dHVyZURlZmF1bHRzYC5cbiAgICAgIGNsZWFuOiBidWlsZE9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aCA/PyB0cnVlLFxuICAgICAgcGF0aDogcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoKSxcbiAgICAgIHB1YmxpY1BhdGg6IGJ1aWxkT3B0aW9ucy5kZXBsb3lVcmwgPz8gJycsXG4gICAgICBmaWxlbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5jaHVua30uanNgLFxuICAgICAgY2h1bmtGaWxlbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5jaHVua30uanNgLFxuICAgICAgbGlicmFyeVRhcmdldDogaXNQbGF0Zm9ybVNlcnZlciA/ICdjb21tb25qcycgOiB1bmRlZmluZWQsXG4gICAgICBjcm9zc09yaWdpbkxvYWRpbmcsXG4gICAgICB0cnVzdGVkVHlwZXM6ICdhbmd1bGFyI2J1bmRsZXInLFxuICAgICAgc2NyaXB0VHlwZTogJ21vZHVsZScsXG4gICAgfSxcbiAgICB3YXRjaDogYnVpbGRPcHRpb25zLndhdGNoLFxuICAgIHdhdGNoT3B0aW9uczoge1xuICAgICAgcG9sbCxcbiAgICAgIGlnbm9yZWQ6IHBvbGwgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6ICcqKi9ub2RlX21vZHVsZXMvKionLFxuICAgIH0sXG4gICAgcGVyZm9ybWFuY2U6IHtcbiAgICAgIGhpbnRzOiBmYWxzZSxcbiAgICB9LFxuICAgIGlnbm9yZVdhcm5pbmdzOiBbXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3NvdXJjZS1tYXAtbG9hZGVyL2Jsb2IvYjJkZTQyNDljNzQzMWRkODQzMmRhNjA3ZTA4ZjBmNjVlOWQ2NDIxOS9zcmMvaW5kZXguanMjTDgzXG4gICAgICAvRmFpbGVkIHRvIHBhcnNlIHNvdXJjZSBtYXAgZnJvbS8sXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3Bvc3Rjc3MtbG9hZGVyL2Jsb2IvYmQyNjE4NzVmZGY5YzU5NmFmNGZmYjNhMWE3M2ZlM2M1NDliZWZkYS9zcmMvaW5kZXguanMjTDE1My1MMTU4XG4gICAgICAvQWRkIHBvc3Rjc3MgYXMgcHJvamVjdCBkZXBlbmRlbmN5LyxcbiAgICAgIC8vIGVzYnVpbGQgd2lsbCBpc3N1ZSBhIHdhcm5pbmcsIHdoaWxlIHN0aWxsIGhvaXN0cyB0aGUgQGNoYXJzZXQgYXQgdGhlIHZlcnkgdG9wLlxuICAgICAgLy8gVGhpcyBpcyBjYXVzZWQgYnkgYSBidWcgaW4gY3NzLWxvYWRlciBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL2Nzcy1sb2FkZXIvaXNzdWVzLzEyMTJcbiAgICAgIC9cIkBjaGFyc2V0XCIgbXVzdCBiZSB0aGUgZmlyc3QgcnVsZSBpbiB0aGUgZmlsZS8sXG4gICAgXSxcbiAgICBtb2R1bGU6IHtcbiAgICAgIC8vIFNob3cgYW4gZXJyb3IgZm9yIG1pc3NpbmcgZXhwb3J0cyBpbnN0ZWFkIG9mIGEgd2FybmluZy5cbiAgICAgIHN0cmljdEV4cG9ydFByZXNlbmNlOiB0cnVlLFxuICAgICAgcGFyc2VyOiB7XG4gICAgICAgIGphdmFzY3JpcHQ6IHtcbiAgICAgICAgICAvLyBEaXNhYmxlIGF1dG8gVVJMIGFzc2V0IG1vZHVsZSBjcmVhdGlvbi4gVGhpcyBkb2Vzbid0IGVmZmVjdCBgbmV3IFdvcmtlcihuZXcgVVJMKC4uLikpYFxuICAgICAgICAgIC8vIGh0dHBzOi8vd2VicGFjay5qcy5vcmcvZ3VpZGVzL2Fzc2V0LW1vZHVsZXMvI3VybC1hc3NldHNcbiAgICAgICAgICB1cmw6IGZhbHNlLFxuICAgICAgICAgIHdvcmtlcjogISF3ZWJXb3JrZXJUc0NvbmZpZyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBydWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLj8oc3ZnfGh0bWwpJC8sXG4gICAgICAgICAgLy8gT25seSBwcm9jZXNzIEhUTUwgYW5kIFNWRyB3aGljaCBhcmUga25vd24gQW5ndWxhciBjb21wb25lbnQgcmVzb3VyY2VzLlxuICAgICAgICAgIHJlc291cmNlUXVlcnk6IC9cXD9uZ1Jlc291cmNlLyxcbiAgICAgICAgICB0eXBlOiAnYXNzZXQvc291cmNlJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIC8vIE1hcmsgZmlsZXMgaW5zaWRlIGByeGpzL2FkZGAgYXMgY29udGFpbmluZyBzaWRlIGVmZmVjdHMuXG4gICAgICAgICAgLy8gSWYgdGhpcyBpcyBmaXhlZCB1cHN0cmVhbSBhbmQgdGhlIGZpeGVkIHZlcnNpb24gYmVjb21lcyB0aGUgbWluaW11bVxuICAgICAgICAgIC8vIHN1cHBvcnRlZCB2ZXJzaW9uLCB0aGlzIGNhbiBiZSByZW1vdmVkLlxuICAgICAgICAgIHRlc3Q6IC9bL1xcXFxdcnhqc1svXFxcXF1hZGRbL1xcXFxdLitcXC5qcyQvLFxuICAgICAgICAgIHNpZGVFZmZlY3RzOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLltjbV0/W3RqXXN4PyQvLFxuICAgICAgICAgIC8vIFRoZSBiZWxvdyBpcyBuZWVkZWQgZHVlIHRvIGEgYnVnIGluIGBAYmFiZWwvcnVudGltZWAuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2JhYmVsL2JhYmVsL2lzc3Vlcy8xMjgyNFxuICAgICAgICAgIHJlc29sdmU6IHsgZnVsbHlTcGVjaWZpZWQ6IGZhbHNlIH0sXG4gICAgICAgICAgZXhjbHVkZTogW1xuICAgICAgICAgICAgL1tcXFxcL11ub2RlX21vZHVsZXNbL1xcXFxdKD86Y29yZS1qc3xAYmFiZWx8dHNsaWJ8d2ViLWFuaW1hdGlvbnMtanN8d2ViLXN0cmVhbXMtcG9seWZpbGx8d2hhdHdnLXVybClbL1xcXFxdLyxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHVzZTogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInKSxcbiAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICAgIGNhY2hlRGlyZWN0b3J5OiAoY2FjaGUuZW5hYmxlZCAmJiBwYXRoLmpvaW4oY2FjaGUucGF0aCwgJ2JhYmVsLXdlYnBhY2snKSkgfHwgZmFsc2UsXG4gICAgICAgICAgICAgICAgc2NyaXB0VGFyZ2V0LFxuICAgICAgICAgICAgICAgIGFvdDogYnVpbGRPcHRpb25zLmFvdCxcbiAgICAgICAgICAgICAgICBvcHRpbWl6ZTogYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyLFxuICAgICAgICAgICAgICAgIHN1cHBvcnRlZEJyb3dzZXJzOiBidWlsZE9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICAgICAgICAgICAgaW5zdHJ1bWVudENvZGU6IGNvZGVDb3ZlcmFnZVxuICAgICAgICAgICAgICAgICAgPyB7XG4gICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWRCYXNlUGF0aDogc291cmNlUm9vdCA/PyBwcm9qZWN0Um9vdCxcbiAgICAgICAgICAgICAgICAgICAgICBleGNsdWRlZFBhdGhzOiBnZXRJbnN0cnVtZW50YXRpb25FeGNsdWRlZFBhdGhzKHJvb3QsIGNvZGVDb3ZlcmFnZUV4Y2x1ZGUpLFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgfSBhcyBBbmd1bGFyQmFiZWxMb2FkZXJPcHRpb25zLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICAuLi5leHRyYVJ1bGVzLFxuICAgICAgXSxcbiAgICB9LFxuICAgIGV4cGVyaW1lbnRzOiB7XG4gICAgICBiYWNrQ29tcGF0OiBmYWxzZSxcbiAgICAgIHN5bmNXZWJBc3NlbWJseTogdHJ1ZSxcbiAgICAgIGFzeW5jV2ViQXNzZW1ibHk6IHRydWUsXG4gICAgfSxcbiAgICBpbmZyYXN0cnVjdHVyZUxvZ2dpbmc6IHtcbiAgICAgIGRlYnVnOiB2ZXJib3NlLFxuICAgICAgbGV2ZWw6IHZlcmJvc2UgPyAndmVyYm9zZScgOiAnZXJyb3InLFxuICAgIH0sXG4gICAgc3RhdHM6IGdldFN0YXRzT3B0aW9ucyh2ZXJib3NlKSxcbiAgICBjYWNoZTogZ2V0Q2FjaGVTZXR0aW5ncyh3Y28sIE5HX1ZFUlNJT04uZnVsbCksXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICBtaW5pbWl6ZXI6IGV4dHJhTWluaW1pemVycyxcbiAgICAgIG1vZHVsZUlkczogJ2RldGVybWluaXN0aWMnLFxuICAgICAgY2h1bmtJZHM6IGJ1aWxkT3B0aW9ucy5uYW1lZENodW5rcyA/ICduYW1lZCcgOiAnZGV0ZXJtaW5pc3RpYycsXG4gICAgICBlbWl0T25FcnJvcnM6IGZhbHNlLFxuICAgICAgcnVudGltZUNodW5rOiBpc1BsYXRmb3JtU2VydmVyID8gZmFsc2UgOiAnc2luZ2xlJyxcbiAgICAgIHNwbGl0Q2h1bmtzOiB7XG4gICAgICAgIG1heEFzeW5jUmVxdWVzdHM6IEluZmluaXR5LFxuICAgICAgICBjYWNoZUdyb3Vwczoge1xuICAgICAgICAgIGRlZmF1bHQ6ICEhY29tbW9uQ2h1bmsgJiYge1xuICAgICAgICAgICAgY2h1bmtzOiAnYXN5bmMnLFxuICAgICAgICAgICAgbWluQ2h1bmtzOiAyLFxuICAgICAgICAgICAgcHJpb3JpdHk6IDEwLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29tbW9uOiAhIWNvbW1vbkNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21tb24nLFxuICAgICAgICAgICAgY2h1bmtzOiAnYXN5bmMnLFxuICAgICAgICAgICAgbWluQ2h1bmtzOiAyLFxuICAgICAgICAgICAgZW5mb3JjZTogdHJ1ZSxcbiAgICAgICAgICAgIHByaW9yaXR5OiA1LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdmVuZG9yczogZmFsc2UsXG4gICAgICAgICAgZGVmYXVsdFZlbmRvcnM6ICEhdmVuZG9yQ2h1bmsgJiYge1xuICAgICAgICAgICAgbmFtZTogJ3ZlbmRvcicsXG4gICAgICAgICAgICBjaHVua3M6IChjaHVuaykgPT4gY2h1bmsubmFtZSA9PT0gJ21haW4nLFxuICAgICAgICAgICAgZW5mb3JjZTogdHJ1ZSxcbiAgICAgICAgICAgIHRlc3Q6IFZFTkRPUlNfVEVTVCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIHBsdWdpbnM6IFtuZXcgTmFtZWRDaHVua3NQbHVnaW4oKSwgbmV3IERlZHVwZU1vZHVsZVJlc29sdmVQbHVnaW4oeyB2ZXJib3NlIH0pLCAuLi5leHRyYVBsdWdpbnNdLFxuICAgIG5vZGU6IGZhbHNlLFxuICB9O1xufVxuIl19