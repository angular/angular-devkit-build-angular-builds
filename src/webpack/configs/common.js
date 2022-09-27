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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhDQUE0RDtBQUM1RCw4RUFBb0Q7QUFDcEQsMkNBQTZCO0FBQzdCLHFDQU1pQjtBQUNqQixpRkFBMkU7QUFHM0UseUVBQThEO0FBQzlELG1EQUFxRDtBQUNyRCx3Q0FNb0I7QUFDcEIsOEVBQXlFO0FBQ3pFLHdFQUFtRTtBQUNuRSxnRUFBNEQ7QUFDNUQsMEVBQXFFO0FBQ3JFLHNEQUF3RDtBQUN4RCxnRkFBMEU7QUFDMUUsOENBTzBCO0FBRTFCLE1BQU0sWUFBWSxHQUFHLHdCQUF3QixDQUFDO0FBRTlDLGtEQUFrRDtBQUMzQyxLQUFLLFVBQVUsZUFBZSxDQUFDLEdBQXlCOztJQUM3RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ2pHLE1BQU0sRUFDSixLQUFLLEVBQ0wsWUFBWSxFQUNaLFdBQVcsR0FBRyxNQUFNLEVBQ3BCLFFBQVEsR0FBRyxTQUFTLEVBQ3BCLEdBQUcsR0FBRyxJQUFJLEVBQ1YsbUJBQW1CLEdBQUcsRUFBRSxFQUN4QixJQUFJLEVBQ0osU0FBUyxFQUNULFNBQVMsRUFBRSxFQUNULE1BQU0sRUFBRSxlQUFlLEVBQ3ZCLE9BQU8sRUFBRSxnQkFBZ0IsRUFDekIsTUFBTSxFQUFFLGVBQWUsRUFDdkIsTUFBTSxFQUFFLGVBQWUsR0FDeEIsRUFDRCxZQUFZLEVBQUUsRUFBRSxNQUFNLEVBQUUsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixF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c2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBBbmd1bGFyV2VicGFja0xvYWRlclBhdGggfSBmcm9tICdAbmd0b29scy93ZWJwYWNrJztcbmltcG9ydCBDb3B5V2VicGFja1BsdWdpbiBmcm9tICdjb3B5LXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQge1xuICBDb21waWxlcixcbiAgQ29uZmlndXJhdGlvbixcbiAgQ29udGV4dFJlcGxhY2VtZW50UGx1Z2luLFxuICBSdWxlU2V0UnVsZSxcbiAgU291cmNlTWFwRGV2VG9vbFBsdWdpbixcbn0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBTdWJyZXNvdXJjZUludGVncml0eVBsdWdpbiB9IGZyb20gJ3dlYnBhY2stc3VicmVzb3VyY2UtaW50ZWdyaXR5JztcbmltcG9ydCB7IEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnMgfSBmcm9tICcuLi8uLi9iYWJlbC93ZWJwYWNrLWxvYWRlcic7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgYWxsb3dNYW5nbGUgfSBmcm9tICcuLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi8uLi91dGlscy9sb2FkLWVzbSc7XG5pbXBvcnQge1xuICBDb21tb25Kc1VzYWdlV2FyblBsdWdpbixcbiAgRGVkdXBlTW9kdWxlUmVzb2x2ZVBsdWdpbixcbiAgSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbixcbiAgSnNvblN0YXRzUGx1Z2luLFxuICBTY3JpcHRzV2VicGFja1BsdWdpbixcbn0gZnJvbSAnLi4vcGx1Z2lucyc7XG5pbXBvcnQgeyBEZXZUb29sc0lnbm9yZVBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvZGV2dG9vbHMtaWdub3JlLXBsdWdpbic7XG5pbXBvcnQgeyBOYW1lZENodW5rc1BsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvbmFtZWQtY2h1bmtzLXBsdWdpbic7XG5pbXBvcnQgeyBQcm9ncmVzc1BsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvcHJvZ3Jlc3MtcGx1Z2luJztcbmltcG9ydCB7IFRyYW5zZmVyU2l6ZVBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvdHJhbnNmZXItc2l6ZS1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlSXZ5UGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy90eXBlc2NyaXB0JztcbmltcG9ydCB7IFdhdGNoRmlsZXNMb2dzUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy93YXRjaC1maWxlcy1sb2dzLXBsdWdpbic7XG5pbXBvcnQge1xuICBhc3NldFBhdHRlcm5zLFxuICBnZXRDYWNoZVNldHRpbmdzLFxuICBnZXRJbnN0cnVtZW50YXRpb25FeGNsdWRlZFBhdGhzLFxuICBnZXRPdXRwdXRIYXNoRm9ybWF0LFxuICBnZXRTdGF0c09wdGlvbnMsXG4gIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUsXG59IGZyb20gJy4uL3V0aWxzL2hlbHBlcnMnO1xuXG5jb25zdCBWRU5ET1JTX1RFU1QgPSAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vO1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldENvbW1vbkNvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKTogUHJvbWlzZTxDb25maWd1cmF0aW9uPiB7XG4gIGNvbnN0IHsgcm9vdCwgcHJvamVjdFJvb3QsIGJ1aWxkT3B0aW9ucywgdHNDb25maWcsIHByb2plY3ROYW1lLCBzb3VyY2VSb290LCB0c0NvbmZpZ1BhdGggfSA9IHdjbztcbiAgY29uc3Qge1xuICAgIGNhY2hlLFxuICAgIGNvZGVDb3ZlcmFnZSxcbiAgICBjcm9zc09yaWdpbiA9ICdub25lJyxcbiAgICBwbGF0Zm9ybSA9ICdicm93c2VyJyxcbiAgICBhb3QgPSB0cnVlLFxuICAgIGNvZGVDb3ZlcmFnZUV4Y2x1ZGUgPSBbXSxcbiAgICBtYWluLFxuICAgIHBvbHlmaWxscyxcbiAgICBzb3VyY2VNYXA6IHtcbiAgICAgIHN0eWxlczogc3R5bGVzU291cmNlTWFwLFxuICAgICAgc2NyaXB0czogc2NyaXB0c1NvdXJjZU1hcCxcbiAgICAgIHZlbmRvcjogdmVuZG9yU291cmNlTWFwLFxuICAgICAgaGlkZGVuOiBoaWRkZW5Tb3VyY2VNYXAsXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHsgc3R5bGVzOiBzdHlsZXNPcHRpbWl6YXRpb24sIHNjcmlwdHM6IHNjcmlwdHNPcHRpbWl6YXRpb24gfSxcbiAgICBjb21tb25DaHVuayxcbiAgICB2ZW5kb3JDaHVuayxcbiAgICBzdWJyZXNvdXJjZUludGVncml0eSxcbiAgICB2ZXJib3NlLFxuICAgIHBvbGwsXG4gICAgd2ViV29ya2VyVHNDb25maWcsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMgPSBbXSxcbiAgICBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMsXG4gIH0gPSBidWlsZE9wdGlvbnM7XG5cbiAgY29uc3QgaXNQbGF0Zm9ybVNlcnZlciA9IGJ1aWxkT3B0aW9ucy5wbGF0Zm9ybSA9PT0gJ3NlcnZlcic7XG4gIGNvbnN0IGV4dHJhUGx1Z2luczogeyBhcHBseShjb21waWxlcjogQ29tcGlsZXIpOiB2b2lkIH1bXSA9IFtdO1xuICBjb25zdCBleHRyYVJ1bGVzOiBSdWxlU2V0UnVsZVtdID0gW107XG4gIGNvbnN0IGVudHJ5UG9pbnRzOiBDb25maWd1cmF0aW9uWydlbnRyeSddID0ge307XG5cbiAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgY29uc3Qge1xuICAgIEdMT0JBTF9ERUZTX0ZPUl9URVJTRVIsXG4gICAgR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCxcbiAgICBWRVJTSU9OOiBOR19WRVJTSU9OLFxuICB9ID0gYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGknKT4oJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpO1xuXG4gIC8vIGRldGVybWluZSBoYXNoaW5nIGZvcm1hdFxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyk7XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5wcm9ncmVzcykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBQcm9ncmVzc1BsdWdpbihwbGF0Zm9ybSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5tYWluKSB7XG4gICAgY29uc3QgbWFpblBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm1haW4pO1xuICAgIGVudHJ5UG9pbnRzWydtYWluJ10gPSBbbWFpblBhdGhdO1xuICB9XG5cbiAgaWYgKGlzUGxhdGZvcm1TZXJ2ZXIpIHtcbiAgICAvLyBGaXhlcyBDcml0aWNhbCBkZXBlbmRlbmN5OiB0aGUgcmVxdWVzdCBvZiBhIGRlcGVuZGVuY3kgaXMgYW4gZXhwcmVzc2lvblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBDb250ZXh0UmVwbGFjZW1lbnRQbHVnaW4oL0A/aGFwaXxleHByZXNzW1xcXFwvXS8pKTtcbiAgfVxuXG4gIGlmIChwb2x5ZmlsbHM/Lmxlbmd0aCkge1xuICAgIC8vIGB6b25lLmpzL3Rlc3RpbmdgIGlzIGEgKipzcGVjaWFsKiogcG9seWZpbGwgYmVjYXVzZSB3aGVuIG5vdCBpbXBvcnRlZCBpbiB0aGUgbWFpbiBpdCBmYWlscyB3aXRoIHRoZSBiZWxvdyBlcnJvcnM6XG4gICAgLy8gYEVycm9yOiBFeHBlY3RlZCB0byBiZSBydW5uaW5nIGluICdQcm94eVpvbmUnLCBidXQgaXQgd2FzIG5vdCBmb3VuZC5gXG4gICAgLy8gVGhpcyB3YXMgYWxzbyB0aGUgcmVhc29uIHdoeSBwcmV2aW91c2x5IGl0IHdhcyBpbXBvcnRlZCBpbiBgdGVzdC50c2AgYXMgdGhlIGZpcnN0IG1vZHVsZS5cbiAgICAvLyBGcm9tIEppYSBsaTpcbiAgICAvLyBUaGlzIGlzIGJlY2F1c2UgdGhlIGphc21pbmUgZnVuY3Rpb25zIHN1Y2ggYXMgYmVmb3JlRWFjaC9pdCB3aWxsIG5vdCBiZSBwYXRjaGVkIGJ5IHpvbmUuanMgc2luY2VcbiAgICAvLyBqYXNtaW5lIHdpbGwgbm90IGJlIGxvYWRlZCB5ZXQsIHNvIHRoZSBQcm94eVpvbmUgd2lsbCBub3QgYmUgdGhlcmUuIFdlIGhhdmUgdG8gbG9hZCB6b25lLXRlc3RpbmcuanMgYWZ0ZXJcbiAgICAvLyBqYXNtaW5lIGlzIHJlYWR5LlxuICAgIC8vIFdlIGNvdWxkIGZvcmNlIGxvYWRpbmcgJ3pvbmUuanMvdGVzdGluZycgcHJpb3IgdG8gamFzbWluZSBieSBjaGFuZ2luZyB0aGUgb3JkZXIgb2Ygc2NyaXB0cyBpbiAna2FybWEtY29udGV4dC5odG1sJy5cbiAgICAvLyBCdXQgdGhpcyBoYXMgaXQncyBvd24gcHJvYmxlbXMgYXMgem9uZS5qcyBuZWVkcyB0byBiZSBsb2FkZWQgcHJpb3IgdG8gamFzbWluZSBkdWUgdG8gcGF0Y2hpbmcgb2YgdGltaW5nIGZ1bmN0aW9uc1xuICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2phc21pbmUvamFzbWluZS9pc3N1ZXMvMTk0NFxuICAgIC8vIFRodXMgdGhlIGNvcnJlY3Qgb3JkZXIgaXMgem9uZS5qcyAtPiBqYXNtaW5lIC0+IHpvbmUuanMvdGVzdGluZy5cbiAgICBjb25zdCB6b25lVGVzdGluZ0VudHJ5UG9pbnQgPSAnem9uZS5qcy90ZXN0aW5nJztcbiAgICBjb25zdCBwb2x5ZmlsbHNFeGx1ZGluZ1pvbmVUZXN0aW5nID0gcG9seWZpbGxzLmZpbHRlcigocCkgPT4gcCAhPT0gem9uZVRlc3RpbmdFbnRyeVBvaW50KTtcblxuICAgIGlmIChBcnJheS5pc0FycmF5KGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSkpIHtcbiAgICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXS5wdXNoKC4uLnBvbHlmaWxsc0V4bHVkaW5nWm9uZVRlc3RpbmcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10gPSBwb2x5ZmlsbHNFeGx1ZGluZ1pvbmVUZXN0aW5nO1xuICAgIH1cblxuICAgIGlmIChwb2x5ZmlsbHNFeGx1ZGluZ1pvbmVUZXN0aW5nLmxlbmd0aCAhPT0gcG9seWZpbGxzLmxlbmd0aCkge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZW50cnlQb2ludHNbJ21haW4nXSkpIHtcbiAgICAgICAgZW50cnlQb2ludHNbJ21haW4nXS51bnNoaWZ0KHpvbmVUZXN0aW5nRW50cnlQb2ludCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbnRyeVBvaW50c1snbWFpbiddID0gW3pvbmVUZXN0aW5nRW50cnlQb2ludF07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcykge1xuICAgIC8vIFdoZW4gdGhpcyBpcyBub3QgZGVmaW5lZCBpdCBtZWFucyB0aGUgYnVpbGRlciBkb2Vzbid0IHN1cHBvcnQgc2hvd2luZyBjb21tb24ganMgdXNhZ2VzLlxuICAgIC8vIFdoZW4gaXQgZG9lcyBpdCB3aWxsIGJlIGFuIGFycmF5LlxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IENvbW1vbkpzVXNhZ2VXYXJuUGx1Z2luKHtcbiAgICAgICAgYWxsb3dlZERlcGVuZGVuY2llczogYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgZ2xvYmFsIHNjcmlwdHNcbiAgLy8gQWRkIGEgbmV3IGFzc2V0IGZvciBlYWNoIGVudHJ5LlxuICBmb3IgKGNvbnN0IHsgYnVuZGxlTmFtZSwgaW5qZWN0LCBwYXRocyB9IG9mIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUoXG4gICAgcm9vdCxcbiAgICBidWlsZE9wdGlvbnMuc2NyaXB0cyxcbiAgKSkge1xuICAgIC8vIExhenkgc2NyaXB0cyBkb24ndCBnZXQgYSBoYXNoLCBvdGhlcndpc2UgdGhleSBjYW4ndCBiZSBsb2FkZWQgYnkgbmFtZS5cbiAgICBjb25zdCBoYXNoID0gaW5qZWN0ID8gaGFzaEZvcm1hdC5zY3JpcHQgOiAnJztcblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFNjcmlwdHNXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgbmFtZTogYnVuZGxlTmFtZSxcbiAgICAgICAgc291cmNlTWFwOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgICBzY3JpcHRzOiBwYXRocyxcbiAgICAgICAgZmlsZW5hbWU6IGAke3BhdGguYmFzZW5hbWUoYnVuZGxlTmFtZSl9JHtoYXNofS5qc2AsXG4gICAgICAgIGJhc2VQYXRoOiBwcm9qZWN0Um9vdCxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICAvLyBwcm9jZXNzIGFzc2V0IGVudHJpZXNcbiAgaWYgKGJ1aWxkT3B0aW9ucy5hc3NldHMubGVuZ3RoKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgQ29weVdlYnBhY2tQbHVnaW4oe1xuICAgICAgICBwYXR0ZXJuczogYXNzZXRQYXR0ZXJucyhyb290LCBidWlsZE9wdGlvbnMuYXNzZXRzKSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcykge1xuICAgIGNvbnN0IExpY2Vuc2VXZWJwYWNrUGx1Z2luID0gcmVxdWlyZSgnbGljZW5zZS13ZWJwYWNrLXBsdWdpbicpLkxpY2Vuc2VXZWJwYWNrUGx1Z2luO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IExpY2Vuc2VXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICB3YXJuaW5nczogZmFsc2UsXG4gICAgICAgICAgZXJyb3JzOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgcGVyQ2h1bmtPdXRwdXQ6IGZhbHNlLFxuICAgICAgICBvdXRwdXRGaWxlbmFtZTogJzNyZHBhcnR5bGljZW5zZXMudHh0JyxcbiAgICAgICAgc2tpcENoaWxkQ29tcGlsZXJzOiB0cnVlLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzY3JpcHRzU291cmNlTWFwIHx8IHN0eWxlc1NvdXJjZU1hcCkge1xuICAgIGNvbnN0IGluY2x1ZGUgPSBbXTtcbiAgICBpZiAoc2NyaXB0c1NvdXJjZU1hcCkge1xuICAgICAgaW5jbHVkZS5wdXNoKC9qcyQvKTtcbiAgICB9XG5cbiAgICBpZiAoc3R5bGVzU291cmNlTWFwKSB7XG4gICAgICBpbmNsdWRlLnB1c2goL2NzcyQvKTtcbiAgICB9XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgRGV2VG9vbHNJZ25vcmVQbHVnaW4oKSk7XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBTb3VyY2VNYXBEZXZUb29sUGx1Z2luKHtcbiAgICAgICAgZmlsZW5hbWU6ICdbZmlsZV0ubWFwJyxcbiAgICAgICAgaW5jbHVkZSxcbiAgICAgICAgLy8gV2Ugd2FudCB0byBzZXQgc291cmNlUm9vdCB0byAgYHdlYnBhY2s6Ly8vYCBmb3Igbm9uXG4gICAgICAgIC8vIGlubGluZSBzb3VyY2VtYXBzIGFzIG90aGVyd2lzZSBwYXRocyB0byBzb3VyY2VtYXBzIHdpbGwgYmUgYnJva2VuIGluIGJyb3dzZXJcbiAgICAgICAgLy8gYHdlYnBhY2s6Ly8vYCBpcyBuZWVkZWQgZm9yIFZpc3VhbCBTdHVkaW8gYnJlYWtwb2ludHMgdG8gd29yayBwcm9wZXJseSBhcyBjdXJyZW50bHlcbiAgICAgICAgLy8gdGhlcmUgaXMgbm8gd2F5IHRvIHNldCB0aGUgJ3dlYlJvb3QnXG4gICAgICAgIHNvdXJjZVJvb3Q6ICd3ZWJwYWNrOi8vLycsXG4gICAgICAgIG1vZHVsZUZpbGVuYW1lVGVtcGxhdGU6ICdbcmVzb3VyY2UtcGF0aF0nLFxuICAgICAgICBhcHBlbmQ6IGhpZGRlblNvdXJjZU1hcCA/IGZhbHNlIDogdW5kZWZpbmVkLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmICh2ZXJib3NlKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFdhdGNoRmlsZXNMb2dzUGx1Z2luKCkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdGF0c0pzb24pIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBKc29uU3RhdHNQbHVnaW4ocGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoLCAnc3RhdHMuanNvbicpKSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHN1YnJlc291cmNlSW50ZWdyaXR5KSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4oe1xuICAgICAgICBoYXNoRnVuY05hbWVzOiBbJ3NoYTM4NCddLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzY3JpcHRzU291cmNlTWFwIHx8IHN0eWxlc1NvdXJjZU1hcCkge1xuICAgIGV4dHJhUnVsZXMucHVzaCh7XG4gICAgICB0ZXN0OiAvXFwuW2NtXT9qc3g/JC8sXG4gICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdzb3VyY2UtbWFwLWxvYWRlcicpLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICBmaWx0ZXJTb3VyY2VNYXBwaW5nVXJsOiAoX21hcFVyaTogc3RyaW5nLCByZXNvdXJjZVBhdGg6IHN0cmluZykgPT4ge1xuICAgICAgICAgIGlmICh2ZW5kb3JTb3VyY2VNYXApIHtcbiAgICAgICAgICAgIC8vIENvbnN1bWUgYWxsIHNvdXJjZW1hcHMgd2hlbiB2ZW5kb3Igb3B0aW9uIGlzIGVuYWJsZWQuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBEb24ndCBjb25zdW1lIHNvdXJjZW1hcHMgaW4gbm9kZV9tb2R1bGVzIHdoZW4gdmVuZG9yIGlzIGRpc2FibGVkLlxuICAgICAgICAgIC8vIEJ1dCwgZG8gY29uc3VtZSBsb2NhbCBsaWJyYXJpZXMgc291cmNlbWFwcy5cbiAgICAgICAgICByZXR1cm4gIXJlc291cmNlUGF0aC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJyk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgaWYgKG1haW4gfHwgcG9seWZpbGxzKSB7XG4gICAgZXh0cmFSdWxlcy5wdXNoKHtcbiAgICAgIHRlc3Q6IHRzQ29uZmlnLm9wdGlvbnMuYWxsb3dKcyA/IC9cXC5bY21dP1t0al1zeD8kLyA6IC9cXC5bY21dP3RzeD8kLyxcbiAgICAgIGxvYWRlcjogQW5ndWxhcldlYnBhY2tMb2FkZXJQYXRoLFxuICAgICAgLy8gVGhlIGJlbG93IGFyZSBrbm93biBwYXRocyB0aGF0IGFyZSBub3QgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBjb21waWxhdGlvbiBldmVuIHdoZW4gYWxsb3dKcyBpcyBlbmFibGVkLlxuICAgICAgZXhjbHVkZTogW1xuICAgICAgICAvW1xcXFwvXW5vZGVfbW9kdWxlc1svXFxcXF0oPzpjc3MtbG9hZGVyfG1pbmktY3NzLWV4dHJhY3QtcGx1Z2lufHdlYnBhY2stZGV2LXNlcnZlcnx3ZWJwYWNrKVsvXFxcXF0vLFxuICAgICAgXSxcbiAgICB9KTtcbiAgICBleHRyYVBsdWdpbnMucHVzaChjcmVhdGVJdnlQbHVnaW4od2NvLCBhb3QsIHRzQ29uZmlnUGF0aCkpO1xuICB9XG5cbiAgaWYgKHdlYldvcmtlclRzQ29uZmlnKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goY3JlYXRlSXZ5UGx1Z2luKHdjbywgZmFsc2UsIHBhdGgucmVzb2x2ZSh3Y28ucm9vdCwgd2ViV29ya2VyVHNDb25maWcpKSk7XG4gIH1cblxuICBjb25zdCBleHRyYU1pbmltaXplcnMgPSBbXTtcbiAgaWYgKHNjcmlwdHNPcHRpbWl6YXRpb24pIHtcbiAgICBleHRyYU1pbmltaXplcnMucHVzaChcbiAgICAgIG5ldyBKYXZhU2NyaXB0T3B0aW1pemVyUGx1Z2luKHtcbiAgICAgICAgZGVmaW5lOiBidWlsZE9wdGlvbnMuYW90ID8gR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCA6IEdMT0JBTF9ERUZTX0ZPUl9URVJTRVIsXG4gICAgICAgIHNvdXJjZW1hcDogc2NyaXB0c1NvdXJjZU1hcCxcbiAgICAgICAgc3VwcG9ydGVkQnJvd3NlcnM6IGJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2VycyxcbiAgICAgICAga2VlcElkZW50aWZpZXJOYW1lczogIWFsbG93TWFuZ2xlIHx8IGlzUGxhdGZvcm1TZXJ2ZXIsXG4gICAgICAgIGtlZXBOYW1lczogaXNQbGF0Zm9ybVNlcnZlcixcbiAgICAgICAgcmVtb3ZlTGljZW5zZXM6IGJ1aWxkT3B0aW9ucy5leHRyYWN0TGljZW5zZXMsXG4gICAgICAgIGFkdmFuY2VkOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHBsYXRmb3JtID09PSAnYnJvd3NlcicgJiYgKHNjcmlwdHNPcHRpbWl6YXRpb24gfHwgc3R5bGVzT3B0aW1pemF0aW9uLm1pbmlmeSkpIHtcbiAgICBleHRyYU1pbmltaXplcnMucHVzaChuZXcgVHJhbnNmZXJTaXplUGx1Z2luKCkpO1xuICB9XG5cbiAgbGV0IGNyb3NzT3JpZ2luTG9hZGluZzogTm9uTnVsbGFibGU8Q29uZmlndXJhdGlvblsnb3V0cHV0J10+Wydjcm9zc09yaWdpbkxvYWRpbmcnXSA9IGZhbHNlO1xuICBpZiAoc3VicmVzb3VyY2VJbnRlZ3JpdHkgJiYgY3Jvc3NPcmlnaW4gPT09ICdub25lJykge1xuICAgIGNyb3NzT3JpZ2luTG9hZGluZyA9ICdhbm9ueW1vdXMnO1xuICB9IGVsc2UgaWYgKGNyb3NzT3JpZ2luICE9PSAnbm9uZScpIHtcbiAgICBjcm9zc09yaWdpbkxvYWRpbmcgPSBjcm9zc09yaWdpbjtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbW9kZTogc2NyaXB0c09wdGltaXphdGlvbiB8fCBzdHlsZXNPcHRpbWl6YXRpb24ubWluaWZ5ID8gJ3Byb2R1Y3Rpb24nIDogJ2RldmVsb3BtZW50JyxcbiAgICBkZXZ0b29sOiBmYWxzZSxcbiAgICB0YXJnZXQ6IFtpc1BsYXRmb3JtU2VydmVyID8gJ25vZGUnIDogJ3dlYicsICdlczIwMTUnXSxcbiAgICBwcm9maWxlOiBidWlsZE9wdGlvbnMuc3RhdHNKc29uLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIHJvb3RzOiBbcHJvamVjdFJvb3RdLFxuICAgICAgZXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgICAgc3ltbGlua3M6ICFidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgIG1vZHVsZXM6IFt0c0NvbmZpZy5vcHRpb25zLmJhc2VVcmwgfHwgcHJvamVjdFJvb3QsICdub2RlX21vZHVsZXMnXSxcbiAgICAgIG1haW5GaWVsZHM6IGlzUGxhdGZvcm1TZXJ2ZXJcbiAgICAgICAgPyBbJ2VzMjAyMCcsICdlczIwMTUnLCAnbW9kdWxlJywgJ21haW4nXVxuICAgICAgICA6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgICBjb25kaXRpb25OYW1lczogWydlczIwMjAnLCAnZXMyMDE1JywgJy4uLiddLFxuICAgIH0sXG4gICAgcmVzb2x2ZUxvYWRlcjoge1xuICAgICAgc3ltbGlua3M6ICFidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICB9LFxuICAgIGNvbnRleHQ6IHJvb3QsXG4gICAgZW50cnk6IGVudHJ5UG9pbnRzLFxuICAgIGV4dGVybmFsczogZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgb3V0cHV0OiB7XG4gICAgICB1bmlxdWVOYW1lOiBwcm9qZWN0TmFtZSxcbiAgICAgIGhhc2hGdW5jdGlvbjogJ3h4aGFzaDY0JywgLy8gdG9kbzogcmVtb3ZlIGluIHdlYnBhY2sgNi4gVGhpcyBpcyBwYXJ0IG9mIGBmdXR1cmVEZWZhdWx0c2AuXG4gICAgICBjbGVhbjogYnVpbGRPcHRpb25zLmRlbGV0ZU91dHB1dFBhdGggPz8gdHJ1ZSxcbiAgICAgIHBhdGg6IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCksXG4gICAgICBwdWJsaWNQYXRoOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsID8/ICcnLFxuICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICAgIGNodW5rRmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICAgIGxpYnJhcnlUYXJnZXQ6IGlzUGxhdGZvcm1TZXJ2ZXIgPyAnY29tbW9uanMnIDogdW5kZWZpbmVkLFxuICAgICAgY3Jvc3NPcmlnaW5Mb2FkaW5nLFxuICAgICAgdHJ1c3RlZFR5cGVzOiAnYW5ndWxhciNidW5kbGVyJyxcbiAgICAgIHNjcmlwdFR5cGU6ICdtb2R1bGUnLFxuICAgIH0sXG4gICAgd2F0Y2g6IGJ1aWxkT3B0aW9ucy53YXRjaCxcbiAgICB3YXRjaE9wdGlvbnM6IHtcbiAgICAgIHBvbGwsXG4gICAgICAvLyBUaGUgYmVsb3cgaXMgbmVlZGVkIGFzIHdoZW4gcHJlc2VydmVTeW1saW5rcyBpcyBlbmFibGVkIHdlIGRpc2FibGUgYHJlc29sdmUuc3ltbGlua3NgLlxuICAgICAgZm9sbG93U3ltbGlua3M6IGJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgaWdub3JlZDogcG9sbCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogJyoqL25vZGVfbW9kdWxlcy8qKicsXG4gICAgfSxcbiAgICBzbmFwc2hvdDoge1xuICAgICAgbW9kdWxlOiB7XG4gICAgICAgIC8vIFVzZSBoYXNoIG9mIGNvbnRlbnQgaW5zdGVhZCBvZiB0aW1lc3RhbXAgYmVjYXVzZSB0aGUgdGltZXN0YW1wIG9mIHRoZSBzeW1saW5rIHdpbGwgYmUgdXNlZFxuICAgICAgICAvLyBpbnN0ZWFkIG9mIHRoZSByZWZlcmVuY2VkIGZpbGVzIHdoaWNoIGNhdXNlcyBjaGFuZ2VzIGluIHN5bWxpbmtzIG5vdCB0byBiZSBwaWNrZWQgdXAuXG4gICAgICAgIGhhc2g6IGJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHBlcmZvcm1hbmNlOiB7XG4gICAgICBoaW50czogZmFsc2UsXG4gICAgfSxcbiAgICBpZ25vcmVXYXJuaW5nczogW1xuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zb3VyY2UtbWFwLWxvYWRlci9ibG9iL2IyZGU0MjQ5Yzc0MzFkZDg0MzJkYTYwN2UwOGYwZjY1ZTlkNjQyMTkvc3JjL2luZGV4LmpzI0w4M1xuICAgICAgL0ZhaWxlZCB0byBwYXJzZSBzb3VyY2UgbWFwIGZyb20vLFxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9wb3N0Y3NzLWxvYWRlci9ibG9iL2JkMjYxODc1ZmRmOWM1OTZhZjRmZmIzYTFhNzNmZTNjNTQ5YmVmZGEvc3JjL2luZGV4LmpzI0wxNTMtTDE1OFxuICAgICAgL0FkZCBwb3N0Y3NzIGFzIHByb2plY3QgZGVwZW5kZW5jeS8sXG4gICAgICAvLyBlc2J1aWxkIHdpbGwgaXNzdWUgYSB3YXJuaW5nLCB3aGlsZSBzdGlsbCBob2lzdHMgdGhlIEBjaGFyc2V0IGF0IHRoZSB2ZXJ5IHRvcC5cbiAgICAgIC8vIFRoaXMgaXMgY2F1c2VkIGJ5IGEgYnVnIGluIGNzcy1sb2FkZXIgaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9jc3MtbG9hZGVyL2lzc3Vlcy8xMjEyXG4gICAgICAvXCJAY2hhcnNldFwiIG11c3QgYmUgdGhlIGZpcnN0IHJ1bGUgaW4gdGhlIGZpbGUvLFxuICAgIF0sXG4gICAgbW9kdWxlOiB7XG4gICAgICAvLyBTaG93IGFuIGVycm9yIGZvciBtaXNzaW5nIGV4cG9ydHMgaW5zdGVhZCBvZiBhIHdhcm5pbmcuXG4gICAgICBzdHJpY3RFeHBvcnRQcmVzZW5jZTogdHJ1ZSxcbiAgICAgIHBhcnNlcjoge1xuICAgICAgICBqYXZhc2NyaXB0OiB7XG4gICAgICAgICAgcmVxdWlyZUNvbnRleHQ6IGZhbHNlLFxuICAgICAgICAgIC8vIERpc2FibGUgYXV0byBVUkwgYXNzZXQgbW9kdWxlIGNyZWF0aW9uLiBUaGlzIGRvZXNuJ3QgZWZmZWN0IGBuZXcgV29ya2VyKG5ldyBVUkwoLi4uKSlgXG4gICAgICAgICAgLy8gaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9ndWlkZXMvYXNzZXQtbW9kdWxlcy8jdXJsLWFzc2V0c1xuICAgICAgICAgIHVybDogZmFsc2UsXG4gICAgICAgICAgd29ya2VyOiAhIXdlYldvcmtlclRzQ29uZmlnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuPyhzdmd8aHRtbCkkLyxcbiAgICAgICAgICAvLyBPbmx5IHByb2Nlc3MgSFRNTCBhbmQgU1ZHIHdoaWNoIGFyZSBrbm93biBBbmd1bGFyIGNvbXBvbmVudCByZXNvdXJjZXMuXG4gICAgICAgICAgcmVzb3VyY2VRdWVyeTogL1xcP25nUmVzb3VyY2UvLFxuICAgICAgICAgIHR5cGU6ICdhc3NldC9zb3VyY2UnLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgLy8gTWFyayBmaWxlcyBpbnNpZGUgYHJ4anMvYWRkYCBhcyBjb250YWluaW5nIHNpZGUgZWZmZWN0cy5cbiAgICAgICAgICAvLyBJZiB0aGlzIGlzIGZpeGVkIHVwc3RyZWFtIGFuZCB0aGUgZml4ZWQgdmVyc2lvbiBiZWNvbWVzIHRoZSBtaW5pbXVtXG4gICAgICAgICAgLy8gc3VwcG9ydGVkIHZlcnNpb24sIHRoaXMgY2FuIGJlIHJlbW92ZWQuXG4gICAgICAgICAgdGVzdDogL1svXFxcXF1yeGpzWy9cXFxcXWFkZFsvXFxcXF0uK1xcLmpzJC8sXG4gICAgICAgICAgc2lkZUVmZmVjdHM6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuW2NtXT9bdGpdc3g/JC8sXG4gICAgICAgICAgLy8gVGhlIGJlbG93IGlzIG5lZWRlZCBkdWUgdG8gYSBidWcgaW4gYEBiYWJlbC9ydW50aW1lYC4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYmFiZWwvYmFiZWwvaXNzdWVzLzEyODI0XG4gICAgICAgICAgcmVzb2x2ZTogeyBmdWxseVNwZWNpZmllZDogZmFsc2UgfSxcbiAgICAgICAgICBleGNsdWRlOiBbXG4gICAgICAgICAgICAvW1xcXFwvXW5vZGVfbW9kdWxlc1svXFxcXF0oPzpjb3JlLWpzfEBiYWJlbHx0c2xpYnx3ZWItYW5pbWF0aW9ucy1qc3x3ZWItc3RyZWFtcy1wb2x5ZmlsbHx3aGF0d2ctdXJsKVsvXFxcXF0vLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgdXNlOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCcuLi8uLi9iYWJlbC93ZWJwYWNrLWxvYWRlcicpLFxuICAgICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgY2FjaGVEaXJlY3Rvcnk6IChjYWNoZS5lbmFibGVkICYmIHBhdGguam9pbihjYWNoZS5wYXRoLCAnYmFiZWwtd2VicGFjaycpKSB8fCBmYWxzZSxcbiAgICAgICAgICAgICAgICBhb3Q6IGJ1aWxkT3B0aW9ucy5hb3QsXG4gICAgICAgICAgICAgICAgb3B0aW1pemU6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgICAgICAgICAgICBzdXBwb3J0ZWRCcm93c2VyczogYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICAgICAgICAgIGluc3RydW1lbnRDb2RlOiBjb2RlQ292ZXJhZ2VcbiAgICAgICAgICAgICAgICAgID8ge1xuICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkQmFzZVBhdGg6IHNvdXJjZVJvb3QgPz8gcHJvamVjdFJvb3QsXG4gICAgICAgICAgICAgICAgICAgICAgZXhjbHVkZWRQYXRoczogZ2V0SW5zdHJ1bWVudGF0aW9uRXhjbHVkZWRQYXRocyhyb290LCBjb2RlQ292ZXJhZ2VFeGNsdWRlKSxcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgIH0gYXMgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgLi4uZXh0cmFSdWxlcyxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBleHBlcmltZW50czoge1xuICAgICAgYmFja0NvbXBhdDogZmFsc2UsXG4gICAgICBzeW5jV2ViQXNzZW1ibHk6IHRydWUsXG4gICAgICBhc3luY1dlYkFzc2VtYmx5OiB0cnVlLFxuICAgIH0sXG4gICAgaW5mcmFzdHJ1Y3R1cmVMb2dnaW5nOiB7XG4gICAgICBkZWJ1ZzogdmVyYm9zZSxcbiAgICAgIGxldmVsOiB2ZXJib3NlID8gJ3ZlcmJvc2UnIDogJ2Vycm9yJyxcbiAgICB9LFxuICAgIHN0YXRzOiBnZXRTdGF0c09wdGlvbnModmVyYm9zZSksXG4gICAgY2FjaGU6IGdldENhY2hlU2V0dGluZ3Mod2NvLCBOR19WRVJTSU9OLmZ1bGwpLFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgbWluaW1pemVyOiBleHRyYU1pbmltaXplcnMsXG4gICAgICBtb2R1bGVJZHM6ICdkZXRlcm1pbmlzdGljJyxcbiAgICAgIGNodW5rSWRzOiBidWlsZE9wdGlvbnMubmFtZWRDaHVua3MgPyAnbmFtZWQnIDogJ2RldGVybWluaXN0aWMnLFxuICAgICAgZW1pdE9uRXJyb3JzOiBmYWxzZSxcbiAgICAgIHJ1bnRpbWVDaHVuazogaXNQbGF0Zm9ybVNlcnZlciA/IGZhbHNlIDogJ3NpbmdsZScsXG4gICAgICBzcGxpdENodW5rczoge1xuICAgICAgICBtYXhBc3luY1JlcXVlc3RzOiBJbmZpbml0eSxcbiAgICAgICAgY2FjaGVHcm91cHM6IHtcbiAgICAgICAgICBkZWZhdWx0OiAhIWNvbW1vbkNodW5rICYmIHtcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIHByaW9yaXR5OiAxMCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbW1vbjogISFjb21tb25DaHVuayAmJiB7XG4gICAgICAgICAgICBuYW1lOiAnY29tbW9uJyxcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICBwcmlvcml0eTogNSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZlbmRvcnM6IGZhbHNlLFxuICAgICAgICAgIGRlZmF1bHRWZW5kb3JzOiAhIXZlbmRvckNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICd2ZW5kb3InLFxuICAgICAgICAgICAgY2h1bmtzOiAoY2h1bmspID0+IGNodW5rLm5hbWUgPT09ICdtYWluJyxcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICB0ZXN0OiBWRU5ET1JTX1RFU1QsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbbmV3IE5hbWVkQ2h1bmtzUGx1Z2luKCksIG5ldyBEZWR1cGVNb2R1bGVSZXNvbHZlUGx1Z2luKHsgdmVyYm9zZSB9KSwgLi4uZXh0cmFQbHVnaW5zXSxcbiAgICBub2RlOiBmYWxzZSxcbiAgfTtcbn1cbiJdfQ==