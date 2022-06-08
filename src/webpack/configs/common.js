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
const watch_files_logs_plugin_1 = require("../plugins/watch-files-logs-plugin");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhDQUE0RDtBQUM1RCw4RUFBb0Q7QUFDcEQsMkNBQTZCO0FBQzdCLDJDQUEwQztBQUMxQyxxQ0FNaUI7QUFDakIsaUZBQTJFO0FBRzNFLHlFQUE4RDtBQUM5RCxtREFBcUQ7QUFDckQsd0NBTW9CO0FBQ3BCLHdFQUFtRTtBQUNuRSxnRUFBNEQ7QUFDNUQsMEVBQXFFO0FBQ3JFLHNEQUF3RDtBQUN4RCxnRkFBMEU7QUFDMUUsOENBUzBCO0FBRTFCLGtEQUFrRDtBQUMzQyxLQUFLLFVBQVUsZUFBZSxDQUFDLEdBQXlCOztJQUM3RCxNQUFNLEVBQ0osSUFBSSxFQUNKLFdBQVcsRUFDWCxZQUFZLEVBQ1osUUFBUSxFQUNSLFdBQVcsRUFDWCxVQUFVLEVBQ1YsWUFBWSxFQUNaLFlBQVksR0FDYixHQUFHLEdBQUcsQ0FBQztJQUNSLE1BQU0sRUFDSixLQUFLLEVBQ0wsWUFBWSxFQUNaLFdBQVcsR0FBRyxNQUFNLEVBQ3BCLFFBQVEsR0FBRyxTQUFTLEVBQ3BCLEdBQUcsR0FBRyxJQUFJLEVBQ1YsbUJBQW1CLEdBQUcsRUFBRSxFQUN4QixJQUFJLEVBQ0osU0FBUyxFQUNULFNBQVMsRUFBRSxFQUNULE1BQU0sRUFBRSxlQUFlLEVBQ3ZCLE9BQU8sRUFBRSxnQkFBZ0IsRUFDekIsTUFBTSxFQUFFLGVBQWUsRUFDdkIsTUFBTSxFQUFFLGVBQWUsR0FDeEIsRUFDRCxZQUFZLEVBQUUsRUFBRSxNQUFNLEVBQUUsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLEVBQzFFLFdBQVcsRUFDWCxXQUFX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LFdBQVcsSUFBSTt3QkFDL0IsSUFBSSxFQUFFLFFBQVE7d0JBQ2QsTUFBTSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU07d0JBQ3hDLE9BQU8sRUFBRSxJQUFJO3dCQUNiLElBQUksRUFBRSx3QkFBd0I7cUJBQy9CO2lCQUNGO2FBQ0Y7U0FDRjtRQUNELE9BQU8sRUFBRSxDQUFDLElBQUksdUNBQWlCLEVBQUUsRUFBRSxJQUFJLG1DQUF5QixDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxHQUFHLFlBQVksQ0FBQztRQUMvRixJQUFJLEVBQUUsS0FBSztLQUNaLENBQUM7QUFDSixDQUFDO0FBNVlELDBDQTRZQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBBbmd1bGFyV2VicGFja0xvYWRlclBhdGggfSBmcm9tICdAbmd0b29scy93ZWJwYWNrJztcbmltcG9ydCBDb3B5V2VicGFja1BsdWdpbiBmcm9tICdjb3B5LXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7XG4gIENvbXBpbGVyLFxuICBDb25maWd1cmF0aW9uLFxuICBDb250ZXh0UmVwbGFjZW1lbnRQbHVnaW4sXG4gIFJ1bGVTZXRSdWxlLFxuICBTb3VyY2VNYXBEZXZUb29sUGx1Z2luLFxufSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IFN1YnJlc291cmNlSW50ZWdyaXR5UGx1Z2luIH0gZnJvbSAnd2VicGFjay1zdWJyZXNvdXJjZS1pbnRlZ3JpdHknO1xuaW1wb3J0IHsgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucyB9IGZyb20gJy4uLy4uL2JhYmVsL3dlYnBhY2stbG9hZGVyJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBhbGxvd01hbmdsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcbmltcG9ydCB7XG4gIENvbW1vbkpzVXNhZ2VXYXJuUGx1Z2luLFxuICBEZWR1cGVNb2R1bGVSZXNvbHZlUGx1Z2luLFxuICBKYXZhU2NyaXB0T3B0aW1pemVyUGx1Z2luLFxuICBKc29uU3RhdHNQbHVnaW4sXG4gIFNjcmlwdHNXZWJwYWNrUGx1Z2luLFxufSBmcm9tICcuLi9wbHVnaW5zJztcbmltcG9ydCB7IE5hbWVkQ2h1bmtzUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy9uYW1lZC1jaHVua3MtcGx1Z2luJztcbmltcG9ydCB7IFByb2dyZXNzUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy9wcm9ncmVzcy1wbHVnaW4nO1xuaW1wb3J0IHsgVHJhbnNmZXJTaXplUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy90cmFuc2Zlci1zaXplLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVJdnlQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3R5cGVzY3JpcHQnO1xuaW1wb3J0IHsgV2F0Y2hGaWxlc0xvZ3NQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3dhdGNoLWZpbGVzLWxvZ3MtcGx1Z2luJztcbmltcG9ydCB7XG4gIGFzc2V0UGF0dGVybnMsXG4gIGV4dGVybmFsaXplUGFja2FnZXMsXG4gIGdldENhY2hlU2V0dGluZ3MsXG4gIGdldEluc3RydW1lbnRhdGlvbkV4Y2x1ZGVkUGF0aHMsXG4gIGdldE1haW5GaWVsZHNBbmRDb25kaXRpb25OYW1lcyxcbiAgZ2V0T3V0cHV0SGFzaEZvcm1hdCxcbiAgZ2V0U3RhdHNPcHRpb25zLFxuICBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lLFxufSBmcm9tICcuLi91dGlscy9oZWxwZXJzJztcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRDb21tb25Db25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IFByb21pc2U8Q29uZmlndXJhdGlvbj4ge1xuICBjb25zdCB7XG4gICAgcm9vdCxcbiAgICBwcm9qZWN0Um9vdCxcbiAgICBidWlsZE9wdGlvbnMsXG4gICAgdHNDb25maWcsXG4gICAgcHJvamVjdE5hbWUsXG4gICAgc291cmNlUm9vdCxcbiAgICB0c0NvbmZpZ1BhdGgsXG4gICAgc2NyaXB0VGFyZ2V0LFxuICB9ID0gd2NvO1xuICBjb25zdCB7XG4gICAgY2FjaGUsXG4gICAgY29kZUNvdmVyYWdlLFxuICAgIGNyb3NzT3JpZ2luID0gJ25vbmUnLFxuICAgIHBsYXRmb3JtID0gJ2Jyb3dzZXInLFxuICAgIGFvdCA9IHRydWUsXG4gICAgY29kZUNvdmVyYWdlRXhjbHVkZSA9IFtdLFxuICAgIG1haW4sXG4gICAgcG9seWZpbGxzLFxuICAgIHNvdXJjZU1hcDoge1xuICAgICAgc3R5bGVzOiBzdHlsZXNTb3VyY2VNYXAsXG4gICAgICBzY3JpcHRzOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgdmVuZG9yOiB2ZW5kb3JTb3VyY2VNYXAsXG4gICAgICBoaWRkZW46IGhpZGRlblNvdXJjZU1hcCxcbiAgICB9LFxuICAgIG9wdGltaXphdGlvbjogeyBzdHlsZXM6IHN0eWxlc09wdGltaXphdGlvbiwgc2NyaXB0czogc2NyaXB0c09wdGltaXphdGlvbiB9LFxuICAgIGNvbW1vbkNodW5rLFxuICAgIHZlbmRvckNodW5rLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIHZlcmJvc2UsXG4gICAgcG9sbCxcbiAgICB3ZWJXb3JrZXJUc0NvbmZpZyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyA9IFtdLFxuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICBidW5kbGVEZXBlbmRlbmNpZXMsXG4gIH0gPSBidWlsZE9wdGlvbnM7XG5cbiAgY29uc3QgaXNQbGF0Zm9ybVNlcnZlciA9IGJ1aWxkT3B0aW9ucy5wbGF0Zm9ybSA9PT0gJ3NlcnZlcic7XG4gIGNvbnN0IGV4dHJhUGx1Z2luczogeyBhcHBseShjb21waWxlcjogQ29tcGlsZXIpOiB2b2lkIH1bXSA9IFtdO1xuICBjb25zdCBleHRyYVJ1bGVzOiBSdWxlU2V0UnVsZVtdID0gW107XG4gIGNvbnN0IGVudHJ5UG9pbnRzOiB7IFtrZXk6IHN0cmluZ106IFtzdHJpbmcsIC4uLnN0cmluZ1tdXSB9ID0ge307XG5cbiAgLy8gTG9hZCBFU00gYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgY29uc3Qge1xuICAgIEdMT0JBTF9ERUZTX0ZPUl9URVJTRVIsXG4gICAgR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCxcbiAgICBWRVJTSU9OOiBOR19WRVJTSU9OLFxuICB9ID0gYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGknKT4oJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpO1xuXG4gIC8vIGRldGVybWluZSBoYXNoaW5nIGZvcm1hdFxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyk7XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5wcm9ncmVzcykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBQcm9ncmVzc1BsdWdpbihwbGF0Zm9ybSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5tYWluKSB7XG4gICAgY29uc3QgbWFpblBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm1haW4pO1xuICAgIGVudHJ5UG9pbnRzWydtYWluJ10gPSBbbWFpblBhdGhdO1xuICB9XG5cbiAgaWYgKGlzUGxhdGZvcm1TZXJ2ZXIpIHtcbiAgICAvLyBGaXhlcyBDcml0aWNhbCBkZXBlbmRlbmN5OiB0aGUgcmVxdWVzdCBvZiBhIGRlcGVuZGVuY3kgaXMgYW4gZXhwcmVzc2lvblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBDb250ZXh0UmVwbGFjZW1lbnRQbHVnaW4oL0A/aGFwaXxleHByZXNzW1xcXFwvXS8pKTtcbiAgfVxuXG4gIGlmICghaXNQbGF0Zm9ybVNlcnZlcikge1xuICAgIGlmIChidWlsZE9wdGlvbnMucG9seWZpbGxzKSB7XG4gICAgICBjb25zdCBwcm9qZWN0UG9seWZpbGxzID0gcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5wb2x5ZmlsbHMpO1xuICAgICAgaWYgKGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSkge1xuICAgICAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10ucHVzaChwcm9qZWN0UG9seWZpbGxzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSA9IFtwcm9qZWN0UG9seWZpbGxzXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzKSB7XG4gICAgLy8gV2hlbiB0aGlzIGlzIG5vdCBkZWZpbmVkIGl0IG1lYW5zIHRoZSBidWlsZGVyIGRvZXNuJ3Qgc3VwcG9ydCBzaG93aW5nIGNvbW1vbiBqcyB1c2FnZXMuXG4gICAgLy8gV2hlbiBpdCBkb2VzIGl0IHdpbGwgYmUgYW4gYXJyYXkuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgQ29tbW9uSnNVc2FnZVdhcm5QbHVnaW4oe1xuICAgICAgICBhbGxvd2VkRGVwZW5kZW5jaWVzOiBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgLy8gcHJvY2VzcyBnbG9iYWwgc2NyaXB0c1xuICAvLyBBZGQgYSBuZXcgYXNzZXQgZm9yIGVhY2ggZW50cnkuXG4gIGZvciAoY29uc3QgeyBidW5kbGVOYW1lLCBpbmplY3QsIHBhdGhzIH0gb2YgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZShcbiAgICByb290LFxuICAgIGJ1aWxkT3B0aW9ucy5zY3JpcHRzLFxuICApKSB7XG4gICAgLy8gTGF6eSBzY3JpcHRzIGRvbid0IGdldCBhIGhhc2gsIG90aGVyd2lzZSB0aGV5IGNhbid0IGJlIGxvYWRlZCBieSBuYW1lLlxuICAgIGNvbnN0IGhhc2ggPSBpbmplY3QgPyBoYXNoRm9ybWF0LnNjcmlwdCA6ICcnO1xuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU2NyaXB0c1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICBuYW1lOiBidW5kbGVOYW1lLFxuICAgICAgICBzb3VyY2VNYXA6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICAgIHNjcmlwdHM6IHBhdGhzLFxuICAgICAgICBmaWxlbmFtZTogYCR7cGF0aC5iYXNlbmFtZShidW5kbGVOYW1lKX0ke2hhc2h9LmpzYCxcbiAgICAgICAgYmFzZVBhdGg6IHByb2plY3RSb290LFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgYXNzZXQgZW50cmllc1xuICBpZiAoYnVpbGRPcHRpb25zLmFzc2V0cy5sZW5ndGgpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBDb3B5V2VicGFja1BsdWdpbih7XG4gICAgICAgIHBhdHRlcm5zOiBhc3NldFBhdHRlcm5zKHJvb3QsIGJ1aWxkT3B0aW9ucy5hc3NldHMpLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzKSB7XG4gICAgY29uc3QgTGljZW5zZVdlYnBhY2tQbHVnaW4gPSByZXF1aXJlKCdsaWNlbnNlLXdlYnBhY2stcGx1Z2luJykuTGljZW5zZVdlYnBhY2tQbHVnaW47XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgTGljZW5zZVdlYnBhY2tQbHVnaW4oe1xuICAgICAgICBzdGF0czoge1xuICAgICAgICAgIHdhcm5pbmdzOiBmYWxzZSxcbiAgICAgICAgICBlcnJvcnM6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICBwZXJDaHVua091dHB1dDogZmFsc2UsXG4gICAgICAgIG91dHB1dEZpbGVuYW1lOiAnM3JkcGFydHlsaWNlbnNlcy50eHQnLFxuICAgICAgICBza2lwQ2hpbGRDb21waWxlcnM6IHRydWUsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHNjcmlwdHNTb3VyY2VNYXAgfHwgc3R5bGVzU291cmNlTWFwKSB7XG4gICAgY29uc3QgaW5jbHVkZSA9IFtdO1xuICAgIGlmIChzY3JpcHRzU291cmNlTWFwKSB7XG4gICAgICBpbmNsdWRlLnB1c2goL2pzJC8pO1xuICAgIH1cblxuICAgIGlmIChzdHlsZXNTb3VyY2VNYXApIHtcbiAgICAgIGluY2x1ZGUucHVzaCgvY3NzJC8pO1xuICAgIH1cblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFNvdXJjZU1hcERldlRvb2xQbHVnaW4oe1xuICAgICAgICBmaWxlbmFtZTogJ1tmaWxlXS5tYXAnLFxuICAgICAgICBpbmNsdWRlLFxuICAgICAgICAvLyBXZSB3YW50IHRvIHNldCBzb3VyY2VSb290IHRvICBgd2VicGFjazovLy9gIGZvciBub25cbiAgICAgICAgLy8gaW5saW5lIHNvdXJjZW1hcHMgYXMgb3RoZXJ3aXNlIHBhdGhzIHRvIHNvdXJjZW1hcHMgd2lsbCBiZSBicm9rZW4gaW4gYnJvd3NlclxuICAgICAgICAvLyBgd2VicGFjazovLy9gIGlzIG5lZWRlZCBmb3IgVmlzdWFsIFN0dWRpbyBicmVha3BvaW50cyB0byB3b3JrIHByb3Blcmx5IGFzIGN1cnJlbnRseVxuICAgICAgICAvLyB0aGVyZSBpcyBubyB3YXkgdG8gc2V0IHRoZSAnd2ViUm9vdCdcbiAgICAgICAgc291cmNlUm9vdDogJ3dlYnBhY2s6Ly8vJyxcbiAgICAgICAgbW9kdWxlRmlsZW5hbWVUZW1wbGF0ZTogJ1tyZXNvdXJjZS1wYXRoXScsXG4gICAgICAgIGFwcGVuZDogaGlkZGVuU291cmNlTWFwID8gZmFsc2UgOiB1bmRlZmluZWQsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHZlcmJvc2UpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgV2F0Y2hGaWxlc0xvZ3NQbHVnaW4oKSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnN0YXRzSnNvbikge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IEpzb25TdGF0c1BsdWdpbihwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm91dHB1dFBhdGgsICdzdGF0cy5qc29uJykpLFxuICAgICk7XG4gIH1cblxuICBpZiAoc3VicmVzb3VyY2VJbnRlZ3JpdHkpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBTdWJyZXNvdXJjZUludGVncml0eVBsdWdpbih7XG4gICAgICAgIGhhc2hGdW5jTmFtZXM6IFsnc2hhMzg0J10sXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHNjcmlwdHNTb3VyY2VNYXAgfHwgc3R5bGVzU291cmNlTWFwKSB7XG4gICAgZXh0cmFSdWxlcy5wdXNoKHtcbiAgICAgIHRlc3Q6IC9cXC5bY21dP2pzeD8kLyxcbiAgICAgIGVuZm9yY2U6ICdwcmUnLFxuICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3NvdXJjZS1tYXAtbG9hZGVyJyksXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGZpbHRlclNvdXJjZU1hcHBpbmdVcmw6IChfbWFwVXJpOiBzdHJpbmcsIHJlc291cmNlUGF0aDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgaWYgKHZlbmRvclNvdXJjZU1hcCkge1xuICAgICAgICAgICAgLy8gQ29uc3VtZSBhbGwgc291cmNlbWFwcyB3aGVuIHZlbmRvciBvcHRpb24gaXMgZW5hYmxlZC5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIERvbid0IGNvbnN1bWUgc291cmNlbWFwcyBpbiBub2RlX21vZHVsZXMgd2hlbiB2ZW5kb3IgaXMgZGlzYWJsZWQuXG4gICAgICAgICAgLy8gQnV0LCBkbyBjb25zdW1lIGxvY2FsIGxpYnJhcmllcyBzb3VyY2VtYXBzLlxuICAgICAgICAgIHJldHVybiAhcmVzb3VyY2VQYXRoLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBpZiAobWFpbiB8fCBwb2x5ZmlsbHMpIHtcbiAgICBleHRyYVJ1bGVzLnB1c2goe1xuICAgICAgdGVzdDogdHNDb25maWcub3B0aW9ucy5hbGxvd0pzID8gL1xcLltjbV0/W3RqXXN4PyQvIDogL1xcLltjbV0/dHN4PyQvLFxuICAgICAgbG9hZGVyOiBBbmd1bGFyV2VicGFja0xvYWRlclBhdGgsXG4gICAgICAvLyBUaGUgYmVsb3cgYXJlIGtub3duIHBhdGhzIHRoYXQgYXJlIG5vdCBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uIGV2ZW4gd2hlbiBhbGxvd0pzIGlzIGVuYWJsZWQuXG4gICAgICBleGNsdWRlOiBbXG4gICAgICAgIC9bXFxcXC9dbm9kZV9tb2R1bGVzWy9cXFxcXSg/OmNzcy1sb2FkZXJ8bWluaS1jc3MtZXh0cmFjdC1wbHVnaW58d2VicGFjay1kZXYtc2VydmVyfHdlYnBhY2spWy9cXFxcXS8sXG4gICAgICBdLFxuICAgIH0pO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGNyZWF0ZUl2eVBsdWdpbih3Y28sIGFvdCwgdHNDb25maWdQYXRoKSk7XG4gIH1cblxuICBpZiAod2ViV29ya2VyVHNDb25maWcpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChjcmVhdGVJdnlQbHVnaW4od2NvLCBmYWxzZSwgcGF0aC5yZXNvbHZlKHdjby5yb290LCB3ZWJXb3JrZXJUc0NvbmZpZykpKTtcbiAgfVxuXG4gIGNvbnN0IGV4dHJhTWluaW1pemVycyA9IFtdO1xuICBpZiAoc2NyaXB0c09wdGltaXphdGlvbikge1xuICAgIGV4dHJhTWluaW1pemVycy5wdXNoKFxuICAgICAgbmV3IEphdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW4oe1xuICAgICAgICBkZWZpbmU6IGJ1aWxkT3B0aW9ucy5hb3QgPyBHTE9CQUxfREVGU19GT1JfVEVSU0VSX1dJVEhfQU9UIDogR0xPQkFMX0RFRlNfRk9SX1RFUlNFUixcbiAgICAgICAgc291cmNlbWFwOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgICB0YXJnZXQ6IHNjcmlwdFRhcmdldCxcbiAgICAgICAga2VlcElkZW50aWZpZXJOYW1lczogIWFsbG93TWFuZ2xlIHx8IGlzUGxhdGZvcm1TZXJ2ZXIsXG4gICAgICAgIGtlZXBOYW1lczogaXNQbGF0Zm9ybVNlcnZlcixcbiAgICAgICAgcmVtb3ZlTGljZW5zZXM6IGJ1aWxkT3B0aW9ucy5leHRyYWN0TGljZW5zZXMsXG4gICAgICAgIGFkdmFuY2VkOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHBsYXRmb3JtID09PSAnYnJvd3NlcicgJiYgKHNjcmlwdHNPcHRpbWl6YXRpb24gfHwgc3R5bGVzT3B0aW1pemF0aW9uLm1pbmlmeSkpIHtcbiAgICBleHRyYU1pbmltaXplcnMucHVzaChuZXcgVHJhbnNmZXJTaXplUGx1Z2luKCkpO1xuICB9XG5cbiAgY29uc3QgZXh0ZXJuYWxzOiBDb25maWd1cmF0aW9uWydleHRlcm5hbHMnXSA9IFsuLi5leHRlcm5hbERlcGVuZGVuY2llc107XG4gIGlmIChpc1BsYXRmb3JtU2VydmVyICYmICFidW5kbGVEZXBlbmRlbmNpZXMpIHtcbiAgICBleHRlcm5hbHMucHVzaCgoeyBjb250ZXh0LCByZXF1ZXN0IH0sIGNhbGxiYWNrKSA9PlxuICAgICAgZXh0ZXJuYWxpemVQYWNrYWdlcyhjb250ZXh0ID8/IHdjby5wcm9qZWN0Um9vdCwgcmVxdWVzdCwgY2FsbGJhY2spLFxuICAgICk7XG4gIH1cblxuICBsZXQgY3Jvc3NPcmlnaW5Mb2FkaW5nOiBOb25OdWxsYWJsZTxDb25maWd1cmF0aW9uWydvdXRwdXQnXT5bJ2Nyb3NzT3JpZ2luTG9hZGluZyddID0gZmFsc2U7XG4gIGlmIChzdWJyZXNvdXJjZUludGVncml0eSAmJiBjcm9zc09yaWdpbiA9PT0gJ25vbmUnKSB7XG4gICAgY3Jvc3NPcmlnaW5Mb2FkaW5nID0gJ2Fub255bW91cyc7XG4gIH0gZWxzZSBpZiAoY3Jvc3NPcmlnaW4gIT09ICdub25lJykge1xuICAgIGNyb3NzT3JpZ2luTG9hZGluZyA9IGNyb3NzT3JpZ2luO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBtb2RlOiBzY3JpcHRzT3B0aW1pemF0aW9uIHx8IHN0eWxlc09wdGltaXphdGlvbi5taW5pZnkgPyAncHJvZHVjdGlvbicgOiAnZGV2ZWxvcG1lbnQnLFxuICAgIGRldnRvb2w6IGZhbHNlLFxuICAgIHRhcmdldDogW1xuICAgICAgaXNQbGF0Zm9ybVNlcnZlciA/ICdub2RlJyA6ICd3ZWInLFxuICAgICAgc2NyaXB0VGFyZ2V0ID09PSBTY3JpcHRUYXJnZXQuRVM1ID8gJ2VzNScgOiAnZXMyMDE1JyxcbiAgICBdLFxuICAgIHByb2ZpbGU6IGJ1aWxkT3B0aW9ucy5zdGF0c0pzb24sXG4gICAgcmVzb2x2ZToge1xuICAgICAgcm9vdHM6IFtwcm9qZWN0Um9vdF0sXG4gICAgICBleHRlbnNpb25zOiBbJy50cycsICcudHN4JywgJy5tanMnLCAnLmpzJ10sXG4gICAgICBzeW1saW5rczogIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgbW9kdWxlczogW3RzQ29uZmlnLm9wdGlvbnMuYmFzZVVybCB8fCBwcm9qZWN0Um9vdCwgJ25vZGVfbW9kdWxlcyddLFxuICAgICAgLi4uZ2V0TWFpbkZpZWxkc0FuZENvbmRpdGlvbk5hbWVzKHNjcmlwdFRhcmdldCwgaXNQbGF0Zm9ybVNlcnZlciksXG4gICAgfSxcbiAgICByZXNvbHZlTG9hZGVyOiB7XG4gICAgICBzeW1saW5rczogIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIH0sXG4gICAgY29udGV4dDogcm9vdCxcbiAgICBlbnRyeTogZW50cnlQb2ludHMsXG4gICAgZXh0ZXJuYWxzLFxuICAgIG91dHB1dDoge1xuICAgICAgdW5pcXVlTmFtZTogcHJvamVjdE5hbWUsXG4gICAgICBoYXNoRnVuY3Rpb246ICd4eGhhc2g2NCcsIC8vIHRvZG86IHJlbW92ZSBpbiB3ZWJwYWNrIDYuIFRoaXMgaXMgcGFydCBvZiBgZnV0dXJlRGVmYXVsdHNgLlxuICAgICAgY2xlYW46IGJ1aWxkT3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoID8/IHRydWUsXG4gICAgICBwYXRoOiBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm91dHB1dFBhdGgpLFxuICAgICAgcHVibGljUGF0aDogYnVpbGRPcHRpb25zLmRlcGxveVVybCA/PyAnJyxcbiAgICAgIGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmNodW5rfS5qc2AsXG4gICAgICBjaHVua0ZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmNodW5rfS5qc2AsXG4gICAgICBsaWJyYXJ5VGFyZ2V0OiBpc1BsYXRmb3JtU2VydmVyID8gJ2NvbW1vbmpzJyA6IHVuZGVmaW5lZCxcbiAgICAgIGNyb3NzT3JpZ2luTG9hZGluZyxcbiAgICAgIHRydXN0ZWRUeXBlczogJ2FuZ3VsYXIjYnVuZGxlcicsXG4gICAgICBzY3JpcHRUeXBlOiAnbW9kdWxlJyxcbiAgICB9LFxuICAgIHdhdGNoOiBidWlsZE9wdGlvbnMud2F0Y2gsXG4gICAgd2F0Y2hPcHRpb25zOiB7XG4gICAgICBwb2xsLFxuICAgICAgaWdub3JlZDogcG9sbCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogJyoqL25vZGVfbW9kdWxlcy8qKicsXG4gICAgfSxcbiAgICBwZXJmb3JtYW5jZToge1xuICAgICAgaGludHM6IGZhbHNlLFxuICAgIH0sXG4gICAgaWdub3JlV2FybmluZ3M6IFtcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc291cmNlLW1hcC1sb2FkZXIvYmxvYi9iMmRlNDI0OWM3NDMxZGQ4NDMyZGE2MDdlMDhmMGY2NWU5ZDY0MjE5L3NyYy9pbmRleC5qcyNMODNcbiAgICAgIC9GYWlsZWQgdG8gcGFyc2Ugc291cmNlIG1hcCBmcm9tLyxcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvcG9zdGNzcy1sb2FkZXIvYmxvYi9iZDI2MTg3NWZkZjljNTk2YWY0ZmZiM2ExYTczZmUzYzU0OWJlZmRhL3NyYy9pbmRleC5qcyNMMTUzLUwxNThcbiAgICAgIC9BZGQgcG9zdGNzcyBhcyBwcm9qZWN0IGRlcGVuZGVuY3kvLFxuICAgICAgLy8gZXNidWlsZCB3aWxsIGlzc3VlIGEgd2FybmluZywgd2hpbGUgc3RpbGwgaG9pc3RzIHRoZSBAY2hhcnNldCBhdCB0aGUgdmVyeSB0b3AuXG4gICAgICAvLyBUaGlzIGlzIGNhdXNlZCBieSBhIGJ1ZyBpbiBjc3MtbG9hZGVyIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvY3NzLWxvYWRlci9pc3N1ZXMvMTIxMlxuICAgICAgL1wiQGNoYXJzZXRcIiBtdXN0IGJlIHRoZSBmaXJzdCBydWxlIGluIHRoZSBmaWxlLyxcbiAgICBdLFxuICAgIG1vZHVsZToge1xuICAgICAgLy8gU2hvdyBhbiBlcnJvciBmb3IgbWlzc2luZyBleHBvcnRzIGluc3RlYWQgb2YgYSB3YXJuaW5nLlxuICAgICAgc3RyaWN0RXhwb3J0UHJlc2VuY2U6IHRydWUsXG4gICAgICBwYXJzZXI6IHtcbiAgICAgICAgamF2YXNjcmlwdDoge1xuICAgICAgICAgIC8vIERpc2FibGUgYXV0byBVUkwgYXNzZXQgbW9kdWxlIGNyZWF0aW9uLiBUaGlzIGRvZXNuJ3QgZWZmZWN0IGBuZXcgV29ya2VyKG5ldyBVUkwoLi4uKSlgXG4gICAgICAgICAgLy8gaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9ndWlkZXMvYXNzZXQtbW9kdWxlcy8jdXJsLWFzc2V0c1xuICAgICAgICAgIHVybDogZmFsc2UsXG4gICAgICAgICAgd29ya2VyOiAhIXdlYldvcmtlclRzQ29uZmlnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuPyhzdmd8aHRtbCkkLyxcbiAgICAgICAgICAvLyBPbmx5IHByb2Nlc3MgSFRNTCBhbmQgU1ZHIHdoaWNoIGFyZSBrbm93biBBbmd1bGFyIGNvbXBvbmVudCByZXNvdXJjZXMuXG4gICAgICAgICAgcmVzb3VyY2VRdWVyeTogL1xcP25nUmVzb3VyY2UvLFxuICAgICAgICAgIHR5cGU6ICdhc3NldC9zb3VyY2UnLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgLy8gTWFyayBmaWxlcyBpbnNpZGUgYHJ4anMvYWRkYCBhcyBjb250YWluaW5nIHNpZGUgZWZmZWN0cy5cbiAgICAgICAgICAvLyBJZiB0aGlzIGlzIGZpeGVkIHVwc3RyZWFtIGFuZCB0aGUgZml4ZWQgdmVyc2lvbiBiZWNvbWVzIHRoZSBtaW5pbXVtXG4gICAgICAgICAgLy8gc3VwcG9ydGVkIHZlcnNpb24sIHRoaXMgY2FuIGJlIHJlbW92ZWQuXG4gICAgICAgICAgdGVzdDogL1svXFxcXF1yeGpzWy9cXFxcXWFkZFsvXFxcXF0uK1xcLmpzJC8sXG4gICAgICAgICAgc2lkZUVmZmVjdHM6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuW2NtXT9bdGpdc3g/JC8sXG4gICAgICAgICAgLy8gVGhlIGJlbG93IGlzIG5lZWRlZCBkdWUgdG8gYSBidWcgaW4gYEBiYWJlbC9ydW50aW1lYC4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYmFiZWwvYmFiZWwvaXNzdWVzLzEyODI0XG4gICAgICAgICAgcmVzb2x2ZTogeyBmdWxseVNwZWNpZmllZDogZmFsc2UgfSxcbiAgICAgICAgICBleGNsdWRlOiBbXG4gICAgICAgICAgICAvW1xcXFwvXW5vZGVfbW9kdWxlc1svXFxcXF0oPzpjb3JlLWpzfEBiYWJlbHx0c2xpYnx3ZWItYW5pbWF0aW9ucy1qc3x3ZWItc3RyZWFtcy1wb2x5ZmlsbHx3aGF0d2ctdXJsKVsvXFxcXF0vLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgdXNlOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCcuLi8uLi9iYWJlbC93ZWJwYWNrLWxvYWRlcicpLFxuICAgICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgY2FjaGVEaXJlY3Rvcnk6IChjYWNoZS5lbmFibGVkICYmIHBhdGguam9pbihjYWNoZS5wYXRoLCAnYmFiZWwtd2VicGFjaycpKSB8fCBmYWxzZSxcbiAgICAgICAgICAgICAgICBzY3JpcHRUYXJnZXQsXG4gICAgICAgICAgICAgICAgYW90OiBidWlsZE9wdGlvbnMuYW90LFxuICAgICAgICAgICAgICAgIG9wdGltaXplOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICAgICAgICAgICAgc3VwcG9ydGVkQnJvd3NlcnM6IGJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2VycyxcbiAgICAgICAgICAgICAgICBpbnN0cnVtZW50Q29kZTogY29kZUNvdmVyYWdlXG4gICAgICAgICAgICAgICAgICA/IHtcbiAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZEJhc2VQYXRoOiBzb3VyY2VSb290LFxuICAgICAgICAgICAgICAgICAgICAgIGV4Y2x1ZGVkUGF0aHM6IGdldEluc3RydW1lbnRhdGlvbkV4Y2x1ZGVkUGF0aHMocm9vdCwgY29kZUNvdmVyYWdlRXhjbHVkZSksXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICB9IGFzIEFuZ3VsYXJCYWJlbExvYWRlck9wdGlvbnMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIC4uLmV4dHJhUnVsZXMsXG4gICAgICBdLFxuICAgIH0sXG4gICAgZXhwZXJpbWVudHM6IHtcbiAgICAgIGJhY2tDb21wYXQ6IGZhbHNlLFxuICAgICAgc3luY1dlYkFzc2VtYmx5OiB0cnVlLFxuICAgICAgYXN5bmNXZWJBc3NlbWJseTogdHJ1ZSxcbiAgICB9LFxuICAgIGluZnJhc3RydWN0dXJlTG9nZ2luZzoge1xuICAgICAgZGVidWc6IHZlcmJvc2UsXG4gICAgICBsZXZlbDogdmVyYm9zZSA/ICd2ZXJib3NlJyA6ICdlcnJvcicsXG4gICAgfSxcbiAgICBzdGF0czogZ2V0U3RhdHNPcHRpb25zKHZlcmJvc2UpLFxuICAgIGNhY2hlOiBnZXRDYWNoZVNldHRpbmdzKHdjbywgTkdfVkVSU0lPTi5mdWxsKSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG1pbmltaXplcjogZXh0cmFNaW5pbWl6ZXJzLFxuICAgICAgbW9kdWxlSWRzOiAnZGV0ZXJtaW5pc3RpYycsXG4gICAgICBjaHVua0lkczogYnVpbGRPcHRpb25zLm5hbWVkQ2h1bmtzID8gJ25hbWVkJyA6ICdkZXRlcm1pbmlzdGljJyxcbiAgICAgIGVtaXRPbkVycm9yczogZmFsc2UsXG4gICAgICBydW50aW1lQ2h1bms6IGlzUGxhdGZvcm1TZXJ2ZXIgPyBmYWxzZSA6ICdzaW5nbGUnLFxuICAgICAgc3BsaXRDaHVua3M6IHtcbiAgICAgICAgbWF4QXN5bmNSZXF1ZXN0czogSW5maW5pdHksXG4gICAgICAgIGNhY2hlR3JvdXBzOiB7XG4gICAgICAgICAgZGVmYXVsdDogISFjb21tb25DaHVuayAmJiB7XG4gICAgICAgICAgICBjaHVua3M6ICdhc3luYycsXG4gICAgICAgICAgICBtaW5DaHVua3M6IDIsXG4gICAgICAgICAgICBwcmlvcml0eTogMTAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb21tb246ICEhY29tbW9uQ2h1bmsgJiYge1xuICAgICAgICAgICAgbmFtZTogJ2NvbW1vbicsXG4gICAgICAgICAgICBjaHVua3M6ICdhc3luYycsXG4gICAgICAgICAgICBtaW5DaHVua3M6IDIsXG4gICAgICAgICAgICBlbmZvcmNlOiB0cnVlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IDUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB2ZW5kb3JzOiBmYWxzZSxcbiAgICAgICAgICBkZWZhdWx0VmVuZG9yczogISF2ZW5kb3JDaHVuayAmJiB7XG4gICAgICAgICAgICBuYW1lOiAndmVuZG9yJyxcbiAgICAgICAgICAgIGNodW5rczogKGNodW5rKSA9PiBjaHVuay5uYW1lID09PSAnbWFpbicsXG4gICAgICAgICAgICBlbmZvcmNlOiB0cnVlLFxuICAgICAgICAgICAgdGVzdDogL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIHBsdWdpbnM6IFtuZXcgTmFtZWRDaHVua3NQbHVnaW4oKSwgbmV3IERlZHVwZU1vZHVsZVJlc29sdmVQbHVnaW4oeyB2ZXJib3NlIH0pLCAuLi5leHRyYVBsdWdpbnNdLFxuICAgIG5vZGU6IGZhbHNlLFxuICB9O1xufVxuIl19