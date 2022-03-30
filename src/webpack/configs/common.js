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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhDQUE0RDtBQUM1RCw4RUFBb0Q7QUFDcEQsMkNBQTZCO0FBQzdCLDJDQUEwQztBQUMxQyxxQ0FNaUI7QUFDakIsaUZBQTJFO0FBRzNFLHlFQUE4RDtBQUM5RCxtREFBcUQ7QUFDckQsd0NBTW9CO0FBQ3BCLHdFQUFtRTtBQUNuRSxnRUFBNEQ7QUFDNUQsMEVBQXFFO0FBQ3JFLHNEQUF3RDtBQUN4RCw4Q0FTMEI7QUFFMUIsa0RBQWtEO0FBQzNDLEtBQUssVUFBVSxlQUFlLENBQUMsR0FBeUI7O0lBQzdELE1BQU0sRUFDSixJQUFJLEVBQ0osV0FBVyxFQUNYLFlBQVksRUFDWixRQUFRLEVBQ1IsV0FBVyxFQUNYLFVBQVUsRUFDVixZQUFZLEVBQ1osWUFBWSxHQUNiLEdBQUcsR0FBRyxDQUFDO0lBQ1IsTUFBTSxFQUNKLEtBQUssRUFDTCxZQUFZLEVBQ1osV0FBVyxHQUFHLE1BQU0sRUFDcEIsUUFBUSxHQUFHLFNBQVMsRUFDcEIsR0FBRyxHQUFHLElBQUksRUFDVixtQkFBbUIsR0FBRyxFQUFFLEVBQ3hCLElBQUksRUFDSixTQUFTLEVBQ1QsU0FBUyxFQUFFLEVBQ1QsTUFBTSxFQUFFLGVBQWUsRUFDdkIsT0FBTyxFQUFFLGdCQUFnQixFQUN6QixNQUFNLEVBQUUsZUFBZSxFQUN2QixNQUFNLEVBQUUsZUFBZSxHQUN4QixFQUNELFlBQVksRUFBRSxFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsRUFDMUUsV0FBVyxFQUNYLFdBQVcsRUFDWCxvQkFBb0Is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Qy9CO2lCQUNGO2FBQ0Y7U0FDRjtRQUNELE9BQU8sRUFBRSxDQUFDLElBQUksdUNBQWlCLEVBQUUsRUFBRSxJQUFJLG1DQUF5QixDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxHQUFHLFlBQVksQ0FBQztRQUMvRixJQUFJLEVBQUUsS0FBSztLQUNaLENBQUM7QUFDSixDQUFDO0FBdFlELDBDQXNZQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBBbmd1bGFyV2VicGFja0xvYWRlclBhdGggfSBmcm9tICdAbmd0b29scy93ZWJwYWNrJztcbmltcG9ydCBDb3B5V2VicGFja1BsdWdpbiBmcm9tICdjb3B5LXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7XG4gIENvbXBpbGVyLFxuICBDb25maWd1cmF0aW9uLFxuICBDb250ZXh0UmVwbGFjZW1lbnRQbHVnaW4sXG4gIFJ1bGVTZXRSdWxlLFxuICBTb3VyY2VNYXBEZXZUb29sUGx1Z2luLFxufSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IFN1YnJlc291cmNlSW50ZWdyaXR5UGx1Z2luIH0gZnJvbSAnd2VicGFjay1zdWJyZXNvdXJjZS1pbnRlZ3JpdHknO1xuaW1wb3J0IHsgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucyB9IGZyb20gJy4uLy4uL2JhYmVsL3dlYnBhY2stbG9hZGVyJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBhbGxvd01hbmdsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcbmltcG9ydCB7XG4gIENvbW1vbkpzVXNhZ2VXYXJuUGx1Z2luLFxuICBEZWR1cGVNb2R1bGVSZXNvbHZlUGx1Z2luLFxuICBKYXZhU2NyaXB0T3B0aW1pemVyUGx1Z2luLFxuICBKc29uU3RhdHNQbHVnaW4sXG4gIFNjcmlwdHNXZWJwYWNrUGx1Z2luLFxufSBmcm9tICcuLi9wbHVnaW5zJztcbmltcG9ydCB7IE5hbWVkQ2h1bmtzUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy9uYW1lZC1jaHVua3MtcGx1Z2luJztcbmltcG9ydCB7IFByb2dyZXNzUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy9wcm9ncmVzcy1wbHVnaW4nO1xuaW1wb3J0IHsgVHJhbnNmZXJTaXplUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy90cmFuc2Zlci1zaXplLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVJdnlQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtcbiAgYXNzZXRQYXR0ZXJucyxcbiAgZXh0ZXJuYWxpemVQYWNrYWdlcyxcbiAgZ2V0Q2FjaGVTZXR0aW5ncyxcbiAgZ2V0SW5zdHJ1bWVudGF0aW9uRXhjbHVkZWRQYXRocyxcbiAgZ2V0TWFpbkZpZWxkc0FuZENvbmRpdGlvbk5hbWVzLFxuICBnZXRPdXRwdXRIYXNoRm9ybWF0LFxuICBnZXRTdGF0c09wdGlvbnMsXG4gIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUsXG59IGZyb20gJy4uL3V0aWxzL2hlbHBlcnMnO1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldENvbW1vbkNvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKTogUHJvbWlzZTxDb25maWd1cmF0aW9uPiB7XG4gIGNvbnN0IHtcbiAgICByb290LFxuICAgIHByb2plY3RSb290LFxuICAgIGJ1aWxkT3B0aW9ucyxcbiAgICB0c0NvbmZpZyxcbiAgICBwcm9qZWN0TmFtZSxcbiAgICBzb3VyY2VSb290LFxuICAgIHRzQ29uZmlnUGF0aCxcbiAgICBzY3JpcHRUYXJnZXQsXG4gIH0gPSB3Y287XG4gIGNvbnN0IHtcbiAgICBjYWNoZSxcbiAgICBjb2RlQ292ZXJhZ2UsXG4gICAgY3Jvc3NPcmlnaW4gPSAnbm9uZScsXG4gICAgcGxhdGZvcm0gPSAnYnJvd3NlcicsXG4gICAgYW90ID0gdHJ1ZSxcbiAgICBjb2RlQ292ZXJhZ2VFeGNsdWRlID0gW10sXG4gICAgbWFpbixcbiAgICBwb2x5ZmlsbHMsXG4gICAgc291cmNlTWFwOiB7XG4gICAgICBzdHlsZXM6IHN0eWxlc1NvdXJjZU1hcCxcbiAgICAgIHNjcmlwdHM6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICB2ZW5kb3I6IHZlbmRvclNvdXJjZU1hcCxcbiAgICAgIGhpZGRlbjogaGlkZGVuU291cmNlTWFwLFxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7IHN0eWxlczogc3R5bGVzT3B0aW1pemF0aW9uLCBzY3JpcHRzOiBzY3JpcHRzT3B0aW1pemF0aW9uIH0sXG4gICAgY29tbW9uQ2h1bmssXG4gICAgdmVuZG9yQ2h1bmssXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgdmVyYm9zZSxcbiAgICBwb2xsLFxuICAgIHdlYldvcmtlclRzQ29uZmlnLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzID0gW10sXG4gICAgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgIGJ1bmRsZURlcGVuZGVuY2llcyxcbiAgfSA9IGJ1aWxkT3B0aW9ucztcblxuICBjb25zdCBpc1BsYXRmb3JtU2VydmVyID0gYnVpbGRPcHRpb25zLnBsYXRmb3JtID09PSAnc2VydmVyJztcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiB7IGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcik6IHZvaWQgfVtdID0gW107XG4gIGNvbnN0IGV4dHJhUnVsZXM6IFJ1bGVTZXRSdWxlW10gPSBbXTtcbiAgY29uc3QgZW50cnlQb2ludHM6IHsgW2tleTogc3RyaW5nXTogW3N0cmluZywgLi4uc3RyaW5nW11dIH0gPSB7fTtcblxuICAvLyBMb2FkIEVTTSBgQGFuZ3VsYXIvY29tcGlsZXItY2xpYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICBjb25zdCB7XG4gICAgR0xPQkFMX0RFRlNfRk9SX1RFUlNFUixcbiAgICBHTE9CQUxfREVGU19GT1JfVEVSU0VSX1dJVEhfQU9ULFxuICAgIFZFUlNJT046IE5HX1ZFUlNJT04sXG4gIH0gPSBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpPignQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk7XG5cbiAgLy8gZGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0XG4gIGNvbnN0IGhhc2hGb3JtYXQgPSBnZXRPdXRwdXRIYXNoRm9ybWF0KGJ1aWxkT3B0aW9ucy5vdXRwdXRIYXNoaW5nKTtcblxuICBpZiAoYnVpbGRPcHRpb25zLnByb2dyZXNzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFByb2dyZXNzUGx1Z2luKHBsYXRmb3JtKSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLm1haW4pIHtcbiAgICBjb25zdCBtYWluUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMubWFpbik7XG4gICAgZW50cnlQb2ludHNbJ21haW4nXSA9IFttYWluUGF0aF07XG4gIH1cblxuICBpZiAoaXNQbGF0Zm9ybVNlcnZlcikge1xuICAgIC8vIEZpeGVzIENyaXRpY2FsIGRlcGVuZGVuY3k6IHRoZSByZXF1ZXN0IG9mIGEgZGVwZW5kZW5jeSBpcyBhbiBleHByZXNzaW9uXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IENvbnRleHRSZXBsYWNlbWVudFBsdWdpbigvQD9oYXBpfGV4cHJlc3NbXFxcXC9dLykpO1xuICB9XG5cbiAgaWYgKCFpc1BsYXRmb3JtU2VydmVyKSB7XG4gICAgaWYgKGJ1aWxkT3B0aW9ucy5wb2x5ZmlsbHMpIHtcbiAgICAgIGNvbnN0IHByb2plY3RQb2x5ZmlsbHMgPSBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLnBvbHlmaWxscyk7XG4gICAgICBpZiAoZW50cnlQb2ludHNbJ3BvbHlmaWxscyddKSB7XG4gICAgICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXS5wdXNoKHByb2plY3RQb2x5ZmlsbHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gW3Byb2plY3RQb2x5ZmlsbHNdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMpIHtcbiAgICAvLyBXaGVuIHRoaXMgaXMgbm90IGRlZmluZWQgaXQgbWVhbnMgdGhlIGJ1aWxkZXIgZG9lc24ndCBzdXBwb3J0IHNob3dpbmcgY29tbW9uIGpzIHVzYWdlcy5cbiAgICAvLyBXaGVuIGl0IGRvZXMgaXQgd2lsbCBiZSBhbiBhcnJheS5cbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBDb21tb25Kc1VzYWdlV2FyblBsdWdpbih7XG4gICAgICAgIGFsbG93ZWREZXBlbmRlbmNpZXM6IGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICAvLyBwcm9jZXNzIGdsb2JhbCBzY3JpcHRzXG4gIC8vIEFkZCBhIG5ldyBhc3NldCBmb3IgZWFjaCBlbnRyeS5cbiAgZm9yIChjb25zdCB7IGJ1bmRsZU5hbWUsIGluamVjdCwgcGF0aHMgfSBvZiBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lKFxuICAgIHJvb3QsXG4gICAgYnVpbGRPcHRpb25zLnNjcmlwdHMsXG4gICkpIHtcbiAgICAvLyBMYXp5IHNjcmlwdHMgZG9uJ3QgZ2V0IGEgaGFzaCwgb3RoZXJ3aXNlIHRoZXkgY2FuJ3QgYmUgbG9hZGVkIGJ5IG5hbWUuXG4gICAgY29uc3QgaGFzaCA9IGluamVjdCA/IGhhc2hGb3JtYXQuc2NyaXB0IDogJyc7XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBTY3JpcHRzV2VicGFja1BsdWdpbih7XG4gICAgICAgIG5hbWU6IGJ1bmRsZU5hbWUsXG4gICAgICAgIHNvdXJjZU1hcDogc2NyaXB0c1NvdXJjZU1hcCxcbiAgICAgICAgc2NyaXB0czogcGF0aHMsXG4gICAgICAgIGZpbGVuYW1lOiBgJHtwYXRoLmJhc2VuYW1lKGJ1bmRsZU5hbWUpfSR7aGFzaH0uanNgLFxuICAgICAgICBiYXNlUGF0aDogcHJvamVjdFJvb3QsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgLy8gcHJvY2VzcyBhc3NldCBlbnRyaWVzXG4gIGlmIChidWlsZE9wdGlvbnMuYXNzZXRzLmxlbmd0aCkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IENvcHlXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgcGF0dGVybnM6IGFzc2V0UGF0dGVybnMocm9vdCwgYnVpbGRPcHRpb25zLmFzc2V0cyksXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5leHRyYWN0TGljZW5zZXMpIHtcbiAgICBjb25zdCBMaWNlbnNlV2VicGFja1BsdWdpbiA9IHJlcXVpcmUoJ2xpY2Vuc2Utd2VicGFjay1wbHVnaW4nKS5MaWNlbnNlV2VicGFja1BsdWdpbjtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBMaWNlbnNlV2VicGFja1BsdWdpbih7XG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgd2FybmluZ3M6IGZhbHNlLFxuICAgICAgICAgIGVycm9yczogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIHBlckNodW5rT3V0cHV0OiBmYWxzZSxcbiAgICAgICAgb3V0cHV0RmlsZW5hbWU6ICczcmRwYXJ0eWxpY2Vuc2VzLnR4dCcsXG4gICAgICAgIHNraXBDaGlsZENvbXBpbGVyczogdHJ1ZSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoc2NyaXB0c1NvdXJjZU1hcCB8fCBzdHlsZXNTb3VyY2VNYXApIHtcbiAgICBjb25zdCBpbmNsdWRlID0gW107XG4gICAgaWYgKHNjcmlwdHNTb3VyY2VNYXApIHtcbiAgICAgIGluY2x1ZGUucHVzaCgvanMkLyk7XG4gICAgfVxuXG4gICAgaWYgKHN0eWxlc1NvdXJjZU1hcCkge1xuICAgICAgaW5jbHVkZS5wdXNoKC9jc3MkLyk7XG4gICAgfVxuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU291cmNlTWFwRGV2VG9vbFBsdWdpbih7XG4gICAgICAgIGZpbGVuYW1lOiAnW2ZpbGVdLm1hcCcsXG4gICAgICAgIGluY2x1ZGUsXG4gICAgICAgIC8vIFdlIHdhbnQgdG8gc2V0IHNvdXJjZVJvb3QgdG8gIGB3ZWJwYWNrOi8vL2AgZm9yIG5vblxuICAgICAgICAvLyBpbmxpbmUgc291cmNlbWFwcyBhcyBvdGhlcndpc2UgcGF0aHMgdG8gc291cmNlbWFwcyB3aWxsIGJlIGJyb2tlbiBpbiBicm93c2VyXG4gICAgICAgIC8vIGB3ZWJwYWNrOi8vL2AgaXMgbmVlZGVkIGZvciBWaXN1YWwgU3R1ZGlvIGJyZWFrcG9pbnRzIHRvIHdvcmsgcHJvcGVybHkgYXMgY3VycmVudGx5XG4gICAgICAgIC8vIHRoZXJlIGlzIG5vIHdheSB0byBzZXQgdGhlICd3ZWJSb290J1xuICAgICAgICBzb3VyY2VSb290OiAnd2VicGFjazovLy8nLFxuICAgICAgICBtb2R1bGVGaWxlbmFtZVRlbXBsYXRlOiAnW3Jlc291cmNlLXBhdGhdJyxcbiAgICAgICAgYXBwZW5kOiBoaWRkZW5Tb3VyY2VNYXAgPyBmYWxzZSA6IHVuZGVmaW5lZCxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnN0YXRzSnNvbikge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IEpzb25TdGF0c1BsdWdpbihwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm91dHB1dFBhdGgsICdzdGF0cy5qc29uJykpLFxuICAgICk7XG4gIH1cblxuICBpZiAoc3VicmVzb3VyY2VJbnRlZ3JpdHkpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBTdWJyZXNvdXJjZUludGVncml0eVBsdWdpbih7XG4gICAgICAgIGhhc2hGdW5jTmFtZXM6IFsnc2hhMzg0J10sXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHNjcmlwdHNTb3VyY2VNYXAgfHwgc3R5bGVzU291cmNlTWFwKSB7XG4gICAgZXh0cmFSdWxlcy5wdXNoKHtcbiAgICAgIHRlc3Q6IC9cXC5bY21dP2pzeD8kLyxcbiAgICAgIGVuZm9yY2U6ICdwcmUnLFxuICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3NvdXJjZS1tYXAtbG9hZGVyJyksXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGZpbHRlclNvdXJjZU1hcHBpbmdVcmw6IChfbWFwVXJpOiBzdHJpbmcsIHJlc291cmNlUGF0aDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgaWYgKHZlbmRvclNvdXJjZU1hcCkge1xuICAgICAgICAgICAgLy8gQ29uc3VtZSBhbGwgc291cmNlbWFwcyB3aGVuIHZlbmRvciBvcHRpb24gaXMgZW5hYmxlZC5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIERvbid0IGNvbnN1bWUgc291cmNlbWFwcyBpbiBub2RlX21vZHVsZXMgd2hlbiB2ZW5kb3IgaXMgZGlzYWJsZWQuXG4gICAgICAgICAgLy8gQnV0LCBkbyBjb25zdW1lIGxvY2FsIGxpYnJhcmllcyBzb3VyY2VtYXBzLlxuICAgICAgICAgIHJldHVybiAhcmVzb3VyY2VQYXRoLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBpZiAobWFpbiB8fCBwb2x5ZmlsbHMpIHtcbiAgICBleHRyYVJ1bGVzLnB1c2goe1xuICAgICAgdGVzdDogdHNDb25maWcub3B0aW9ucy5hbGxvd0pzID8gL1xcLltjbV0/W3RqXXN4PyQvIDogL1xcLltjbV0/dHN4PyQvLFxuICAgICAgbG9hZGVyOiBBbmd1bGFyV2VicGFja0xvYWRlclBhdGgsXG4gICAgICAvLyBUaGUgYmVsb3cgYXJlIGtub3duIHBhdGhzIHRoYXQgYXJlIG5vdCBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uIGV2ZW4gd2hlbiBhbGxvd0pzIGlzIGVuYWJsZWQuXG4gICAgICBleGNsdWRlOiBbXG4gICAgICAgIC9bXFxcXC9dbm9kZV9tb2R1bGVzWy9cXFxcXSg/OmNzcy1sb2FkZXJ8bWluaS1jc3MtZXh0cmFjdC1wbHVnaW58d2VicGFjay1kZXYtc2VydmVyfHdlYnBhY2spWy9cXFxcXS8sXG4gICAgICBdLFxuICAgIH0pO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGNyZWF0ZUl2eVBsdWdpbih3Y28sIGFvdCwgdHNDb25maWdQYXRoKSk7XG4gIH1cblxuICBpZiAod2ViV29ya2VyVHNDb25maWcpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChjcmVhdGVJdnlQbHVnaW4od2NvLCBmYWxzZSwgcGF0aC5yZXNvbHZlKHdjby5yb290LCB3ZWJXb3JrZXJUc0NvbmZpZykpKTtcbiAgfVxuXG4gIGNvbnN0IGV4dHJhTWluaW1pemVycyA9IFtdO1xuICBpZiAoc2NyaXB0c09wdGltaXphdGlvbikge1xuICAgIGV4dHJhTWluaW1pemVycy5wdXNoKFxuICAgICAgbmV3IEphdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW4oe1xuICAgICAgICBkZWZpbmU6IGJ1aWxkT3B0aW9ucy5hb3QgPyBHTE9CQUxfREVGU19GT1JfVEVSU0VSX1dJVEhfQU9UIDogR0xPQkFMX0RFRlNfRk9SX1RFUlNFUixcbiAgICAgICAgc291cmNlbWFwOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgICB0YXJnZXQ6IHNjcmlwdFRhcmdldCxcbiAgICAgICAga2VlcElkZW50aWZpZXJOYW1lczogIWFsbG93TWFuZ2xlIHx8IGlzUGxhdGZvcm1TZXJ2ZXIsXG4gICAgICAgIGtlZXBOYW1lczogaXNQbGF0Zm9ybVNlcnZlcixcbiAgICAgICAgcmVtb3ZlTGljZW5zZXM6IGJ1aWxkT3B0aW9ucy5leHRyYWN0TGljZW5zZXMsXG4gICAgICAgIGFkdmFuY2VkOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHBsYXRmb3JtID09PSAnYnJvd3NlcicgJiYgKHNjcmlwdHNPcHRpbWl6YXRpb24gfHwgc3R5bGVzT3B0aW1pemF0aW9uLm1pbmlmeSkpIHtcbiAgICBleHRyYU1pbmltaXplcnMucHVzaChuZXcgVHJhbnNmZXJTaXplUGx1Z2luKCkpO1xuICB9XG5cbiAgY29uc3QgZXh0ZXJuYWxzOiBDb25maWd1cmF0aW9uWydleHRlcm5hbHMnXSA9IFsuLi5leHRlcm5hbERlcGVuZGVuY2llc107XG4gIGlmIChpc1BsYXRmb3JtU2VydmVyICYmICFidW5kbGVEZXBlbmRlbmNpZXMpIHtcbiAgICBleHRlcm5hbHMucHVzaCgoeyBjb250ZXh0LCByZXF1ZXN0IH0sIGNhbGxiYWNrKSA9PlxuICAgICAgZXh0ZXJuYWxpemVQYWNrYWdlcyhjb250ZXh0ID8/IHdjby5wcm9qZWN0Um9vdCwgcmVxdWVzdCwgY2FsbGJhY2spLFxuICAgICk7XG4gIH1cblxuICBsZXQgY3Jvc3NPcmlnaW5Mb2FkaW5nOiBOb25OdWxsYWJsZTxDb25maWd1cmF0aW9uWydvdXRwdXQnXT5bJ2Nyb3NzT3JpZ2luTG9hZGluZyddID0gZmFsc2U7XG4gIGlmIChzdWJyZXNvdXJjZUludGVncml0eSAmJiBjcm9zc09yaWdpbiA9PT0gJ25vbmUnKSB7XG4gICAgY3Jvc3NPcmlnaW5Mb2FkaW5nID0gJ2Fub255bW91cyc7XG4gIH0gZWxzZSBpZiAoY3Jvc3NPcmlnaW4gIT09ICdub25lJykge1xuICAgIGNyb3NzT3JpZ2luTG9hZGluZyA9IGNyb3NzT3JpZ2luO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBtb2RlOiBzY3JpcHRzT3B0aW1pemF0aW9uIHx8IHN0eWxlc09wdGltaXphdGlvbi5taW5pZnkgPyAncHJvZHVjdGlvbicgOiAnZGV2ZWxvcG1lbnQnLFxuICAgIGRldnRvb2w6IGZhbHNlLFxuICAgIHRhcmdldDogW1xuICAgICAgaXNQbGF0Zm9ybVNlcnZlciA/ICdub2RlJyA6ICd3ZWInLFxuICAgICAgc2NyaXB0VGFyZ2V0ID09PSBTY3JpcHRUYXJnZXQuRVM1ID8gJ2VzNScgOiAnZXMyMDE1JyxcbiAgICBdLFxuICAgIHByb2ZpbGU6IGJ1aWxkT3B0aW9ucy5zdGF0c0pzb24sXG4gICAgcmVzb2x2ZToge1xuICAgICAgcm9vdHM6IFtwcm9qZWN0Um9vdF0sXG4gICAgICBleHRlbnNpb25zOiBbJy50cycsICcudHN4JywgJy5tanMnLCAnLmpzJ10sXG4gICAgICBzeW1saW5rczogIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgbW9kdWxlczogW3RzQ29uZmlnLm9wdGlvbnMuYmFzZVVybCB8fCBwcm9qZWN0Um9vdCwgJ25vZGVfbW9kdWxlcyddLFxuICAgICAgLi4uZ2V0TWFpbkZpZWxkc0FuZENvbmRpdGlvbk5hbWVzKHNjcmlwdFRhcmdldCwgaXNQbGF0Zm9ybVNlcnZlciksXG4gICAgfSxcbiAgICByZXNvbHZlTG9hZGVyOiB7XG4gICAgICBzeW1saW5rczogIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIH0sXG4gICAgY29udGV4dDogcm9vdCxcbiAgICBlbnRyeTogZW50cnlQb2ludHMsXG4gICAgZXh0ZXJuYWxzLFxuICAgIG91dHB1dDoge1xuICAgICAgdW5pcXVlTmFtZTogcHJvamVjdE5hbWUsXG4gICAgICBoYXNoRnVuY3Rpb246ICd4eGhhc2g2NCcsIC8vIHRvZG86IHJlbW92ZSBpbiB3ZWJwYWNrIDYuIFRoaXMgaXMgcGFydCBvZiBgZnV0dXJlRGVmYXVsdHNgLlxuICAgICAgY2xlYW46IGJ1aWxkT3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoID8/IHRydWUsXG4gICAgICBwYXRoOiBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm91dHB1dFBhdGgpLFxuICAgICAgcHVibGljUGF0aDogYnVpbGRPcHRpb25zLmRlcGxveVVybCA/PyAnJyxcbiAgICAgIGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmNodW5rfS5qc2AsXG4gICAgICBjaHVua0ZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmNodW5rfS5qc2AsXG4gICAgICBsaWJyYXJ5VGFyZ2V0OiBpc1BsYXRmb3JtU2VydmVyID8gJ2NvbW1vbmpzJyA6IHVuZGVmaW5lZCxcbiAgICAgIGNyb3NzT3JpZ2luTG9hZGluZyxcbiAgICAgIHRydXN0ZWRUeXBlczogJ2FuZ3VsYXIjYnVuZGxlcicsXG4gICAgICBzY3JpcHRUeXBlOiAnbW9kdWxlJyxcbiAgICB9LFxuICAgIHdhdGNoOiBidWlsZE9wdGlvbnMud2F0Y2gsXG4gICAgd2F0Y2hPcHRpb25zOiB7XG4gICAgICBwb2xsLFxuICAgICAgaWdub3JlZDogcG9sbCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogJyoqL25vZGVfbW9kdWxlcy8qKicsXG4gICAgfSxcbiAgICBwZXJmb3JtYW5jZToge1xuICAgICAgaGludHM6IGZhbHNlLFxuICAgIH0sXG4gICAgaWdub3JlV2FybmluZ3M6IFtcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc291cmNlLW1hcC1sb2FkZXIvYmxvYi9iMmRlNDI0OWM3NDMxZGQ4NDMyZGE2MDdlMDhmMGY2NWU5ZDY0MjE5L3NyYy9pbmRleC5qcyNMODNcbiAgICAgIC9GYWlsZWQgdG8gcGFyc2Ugc291cmNlIG1hcCBmcm9tLyxcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvcG9zdGNzcy1sb2FkZXIvYmxvYi9iZDI2MTg3NWZkZjljNTk2YWY0ZmZiM2ExYTczZmUzYzU0OWJlZmRhL3NyYy9pbmRleC5qcyNMMTUzLUwxNThcbiAgICAgIC9BZGQgcG9zdGNzcyBhcyBwcm9qZWN0IGRlcGVuZGVuY3kvLFxuICAgICAgLy8gZXNidWlsZCB3aWxsIGlzc3VlIGEgd2FybmluZywgd2hpbGUgc3RpbGwgaG9pc3RzIHRoZSBAY2hhcnNldCBhdCB0aGUgdmVyeSB0b3AuXG4gICAgICAvLyBUaGlzIGlzIGNhdXNlZCBieSBhIGJ1ZyBpbiBjc3MtbG9hZGVyIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvY3NzLWxvYWRlci9pc3N1ZXMvMTIxMlxuICAgICAgL1wiQGNoYXJzZXRcIiBtdXN0IGJlIHRoZSBmaXJzdCBydWxlIGluIHRoZSBmaWxlLyxcbiAgICBdLFxuICAgIG1vZHVsZToge1xuICAgICAgLy8gU2hvdyBhbiBlcnJvciBmb3IgbWlzc2luZyBleHBvcnRzIGluc3RlYWQgb2YgYSB3YXJuaW5nLlxuICAgICAgc3RyaWN0RXhwb3J0UHJlc2VuY2U6IHRydWUsXG4gICAgICBwYXJzZXI6IHtcbiAgICAgICAgamF2YXNjcmlwdDoge1xuICAgICAgICAgIC8vIERpc2FibGUgYXV0byBVUkwgYXNzZXQgbW9kdWxlIGNyZWF0aW9uLiBUaGlzIGRvZXNuJ3QgZWZmZWN0IGBuZXcgV29ya2VyKG5ldyBVUkwoLi4uKSlgXG4gICAgICAgICAgLy8gaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9ndWlkZXMvYXNzZXQtbW9kdWxlcy8jdXJsLWFzc2V0c1xuICAgICAgICAgIHVybDogZmFsc2UsXG4gICAgICAgICAgd29ya2VyOiAhIXdlYldvcmtlclRzQ29uZmlnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuPyhzdmd8aHRtbCkkLyxcbiAgICAgICAgICAvLyBPbmx5IHByb2Nlc3MgSFRNTCBhbmQgU1ZHIHdoaWNoIGFyZSBrbm93biBBbmd1bGFyIGNvbXBvbmVudCByZXNvdXJjZXMuXG4gICAgICAgICAgcmVzb3VyY2VRdWVyeTogL1xcP25nUmVzb3VyY2UvLFxuICAgICAgICAgIHR5cGU6ICdhc3NldC9zb3VyY2UnLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgLy8gTWFyayBmaWxlcyBpbnNpZGUgYHJ4anMvYWRkYCBhcyBjb250YWluaW5nIHNpZGUgZWZmZWN0cy5cbiAgICAgICAgICAvLyBJZiB0aGlzIGlzIGZpeGVkIHVwc3RyZWFtIGFuZCB0aGUgZml4ZWQgdmVyc2lvbiBiZWNvbWVzIHRoZSBtaW5pbXVtXG4gICAgICAgICAgLy8gc3VwcG9ydGVkIHZlcnNpb24sIHRoaXMgY2FuIGJlIHJlbW92ZWQuXG4gICAgICAgICAgdGVzdDogL1svXFxcXF1yeGpzWy9cXFxcXWFkZFsvXFxcXF0uK1xcLmpzJC8sXG4gICAgICAgICAgc2lkZUVmZmVjdHM6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuW2NtXT9bdGpdc3g/JC8sXG4gICAgICAgICAgLy8gVGhlIGJlbG93IGlzIG5lZWRlZCBkdWUgdG8gYSBidWcgaW4gYEBiYWJlbC9ydW50aW1lYC4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYmFiZWwvYmFiZWwvaXNzdWVzLzEyODI0XG4gICAgICAgICAgcmVzb2x2ZTogeyBmdWxseVNwZWNpZmllZDogZmFsc2UgfSxcbiAgICAgICAgICBleGNsdWRlOiBbXG4gICAgICAgICAgICAvW1xcXFwvXW5vZGVfbW9kdWxlc1svXFxcXF0oPzpjb3JlLWpzfEBiYWJlbHx0c2xpYnx3ZWItYW5pbWF0aW9ucy1qc3x3ZWItc3RyZWFtcy1wb2x5ZmlsbHx3aGF0d2ctdXJsKVsvXFxcXF0vLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgdXNlOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCcuLi8uLi9iYWJlbC93ZWJwYWNrLWxvYWRlcicpLFxuICAgICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgY2FjaGVEaXJlY3Rvcnk6IChjYWNoZS5lbmFibGVkICYmIHBhdGguam9pbihjYWNoZS5wYXRoLCAnYmFiZWwtd2VicGFjaycpKSB8fCBmYWxzZSxcbiAgICAgICAgICAgICAgICBzY3JpcHRUYXJnZXQsXG4gICAgICAgICAgICAgICAgYW90OiBidWlsZE9wdGlvbnMuYW90LFxuICAgICAgICAgICAgICAgIG9wdGltaXplOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICAgICAgICAgICAgaW5zdHJ1bWVudENvZGU6IGNvZGVDb3ZlcmFnZVxuICAgICAgICAgICAgICAgICAgPyB7XG4gICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWRCYXNlUGF0aDogc291cmNlUm9vdCxcbiAgICAgICAgICAgICAgICAgICAgICBleGNsdWRlZFBhdGhzOiBnZXRJbnN0cnVtZW50YXRpb25FeGNsdWRlZFBhdGhzKHJvb3QsIGNvZGVDb3ZlcmFnZUV4Y2x1ZGUpLFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgfSBhcyBBbmd1bGFyQmFiZWxMb2FkZXJPcHRpb25zLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICAuLi5leHRyYVJ1bGVzLFxuICAgICAgXSxcbiAgICB9LFxuICAgIGV4cGVyaW1lbnRzOiB7XG4gICAgICBiYWNrQ29tcGF0OiBmYWxzZSxcbiAgICAgIHN5bmNXZWJBc3NlbWJseTogdHJ1ZSxcbiAgICAgIGFzeW5jV2ViQXNzZW1ibHk6IHRydWUsXG4gICAgfSxcbiAgICBpbmZyYXN0cnVjdHVyZUxvZ2dpbmc6IHtcbiAgICAgIGxldmVsOiB2ZXJib3NlID8gJ3ZlcmJvc2UnIDogJ2Vycm9yJyxcbiAgICB9LFxuICAgIHN0YXRzOiBnZXRTdGF0c09wdGlvbnModmVyYm9zZSksXG4gICAgY2FjaGU6IGdldENhY2hlU2V0dGluZ3Mod2NvLCBOR19WRVJTSU9OLmZ1bGwpLFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgbWluaW1pemVyOiBleHRyYU1pbmltaXplcnMsXG4gICAgICBtb2R1bGVJZHM6ICdkZXRlcm1pbmlzdGljJyxcbiAgICAgIGNodW5rSWRzOiBidWlsZE9wdGlvbnMubmFtZWRDaHVua3MgPyAnbmFtZWQnIDogJ2RldGVybWluaXN0aWMnLFxuICAgICAgZW1pdE9uRXJyb3JzOiBmYWxzZSxcbiAgICAgIHJ1bnRpbWVDaHVuazogaXNQbGF0Zm9ybVNlcnZlciA/IGZhbHNlIDogJ3NpbmdsZScsXG4gICAgICBzcGxpdENodW5rczoge1xuICAgICAgICBtYXhBc3luY1JlcXVlc3RzOiBJbmZpbml0eSxcbiAgICAgICAgY2FjaGVHcm91cHM6IHtcbiAgICAgICAgICBkZWZhdWx0OiAhIWNvbW1vbkNodW5rICYmIHtcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIHByaW9yaXR5OiAxMCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbW1vbjogISFjb21tb25DaHVuayAmJiB7XG4gICAgICAgICAgICBuYW1lOiAnY29tbW9uJyxcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICBwcmlvcml0eTogNSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZlbmRvcnM6IGZhbHNlLFxuICAgICAgICAgIGRlZmF1bHRWZW5kb3JzOiAhIXZlbmRvckNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICd2ZW5kb3InLFxuICAgICAgICAgICAgY2h1bmtzOiAoY2h1bmspID0+IGNodW5rLm5hbWUgPT09ICdtYWluJyxcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICB0ZXN0OiAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgcGx1Z2luczogW25ldyBOYW1lZENodW5rc1BsdWdpbigpLCBuZXcgRGVkdXBlTW9kdWxlUmVzb2x2ZVBsdWdpbih7IHZlcmJvc2UgfSksIC4uLmV4dHJhUGx1Z2luc10sXG4gICAgbm9kZTogZmFsc2UsXG4gIH07XG59XG4iXX0=