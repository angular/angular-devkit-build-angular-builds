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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsOENBQTREO0FBQzVELDhFQUFvRDtBQUNwRCwyQ0FBNkI7QUFDN0IsMkNBQTBDO0FBQzFDLHFDQU1pQjtBQUNqQixpRkFBMkU7QUFHM0UseUVBQThEO0FBQzlELG1EQUFxRDtBQUNyRCx3Q0FNb0I7QUFDcEIsd0VBQW1FO0FBQ25FLGdFQUE0RDtBQUM1RCwwRUFBcUU7QUFDckUsc0RBQXdEO0FBQ3hELDhDQVMwQjtBQUUxQixrREFBa0Q7QUFDM0MsS0FBSyxVQUFVLGVBQWUsQ0FBQyxHQUF5Qjs7SUFDN0QsTUFBTSxFQUNKLElBQUksRUFDSixXQUFXLEVBQ1gsWUFBWSxFQUNaLFFBQVEsRUFDUixXQUFXLEVBQ1gsVUFBVSxFQUNWLFlBQVksRUFDWixZQUFZLEdBQ2IsR0FBRyxHQUFHLENBQUM7SUFDUixNQUFNLEVBQ0osS0FBSyxFQUNMLFlBQVksRUFDWixXQUFXLEdBQUcsTUFBTSxFQUNwQixRQUFRLEdBQUcsU0FBUyxFQUNwQixHQUFHLEdBQUcsSUFBSSxFQUNWLG1CQUFtQixHQUFHLEVBQUUsRUFDeEIsSUFBSSxFQUNKLFNBQVMsRUFDVCxTQUFTLEVBQUUsRUFDVCxNQUFNLEVBQUUsZUFBZSxFQUN2QixPQUFPLEVBQUUsZ0JBQWdCLEVBQ3pCLE1BQU0sRUFBRSxlQUFlLEVBQ3ZCLE1BQU0sRUFBRSxlQUFlLEdBQ3hCLEVBQ0QsWUFBWSxFQUFFLEVBQUUsTUFBTSxFQUFFLGtCQUFrQixFQUFFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxFQUMxRSxXQUFXLEVBQ1gsV0FBVyxFQUNYLG9CQUFvQixFQUNw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QUFTLEVBQUUsQ0FBQzt3QkFDWixPQUFPLEVBQUUsSUFBSTt3QkFDYixRQUFRLEVBQUUsQ0FBQztxQkFDWjtvQkFDRCxPQUFPLEVBQUUsS0FBSztvQkFDZCxjQUFjLEVBQUUsQ0FBQyxDQUFDLFdBQVcsSUFBSTt3QkFDL0IsSUFBSSxFQUFFLFFBQVE7d0JBQ2QsTUFBTSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU07d0JBQ3hDLE9BQU8sRUFBRSxJQUFJO3dCQUNiLElBQUksRUFBRSx3QkFBd0I7cUJBQy9CO2lCQUNGO2FBQ0Y7U0FDRjtRQUNELE9BQU8sRUFBRSxDQUFDLElBQUksdUNBQWlCLEVBQUUsRUFBRSxJQUFJLG1DQUF5QixDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxHQUFHLFlBQVksQ0FBQztRQUMvRixJQUFJLEVBQUUsS0FBSztLQUNaLENBQUM7QUFDSixDQUFDO0FBN1lELDBDQTZZQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBBbmd1bGFyV2VicGFja0xvYWRlclBhdGggfSBmcm9tICdAbmd0b29scy93ZWJwYWNrJztcbmltcG9ydCBDb3B5V2VicGFja1BsdWdpbiBmcm9tICdjb3B5LXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7XG4gIENvbXBpbGVyLFxuICBDb25maWd1cmF0aW9uLFxuICBDb250ZXh0UmVwbGFjZW1lbnRQbHVnaW4sXG4gIFJ1bGVTZXRSdWxlLFxuICBTb3VyY2VNYXBEZXZUb29sUGx1Z2luLFxufSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IFN1YnJlc291cmNlSW50ZWdyaXR5UGx1Z2luIH0gZnJvbSAnd2VicGFjay1zdWJyZXNvdXJjZS1pbnRlZ3JpdHknO1xuaW1wb3J0IHsgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucyB9IGZyb20gJy4uLy4uL2JhYmVsL3dlYnBhY2stbG9hZGVyJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBhbGxvd01hbmdsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcbmltcG9ydCB7XG4gIENvbW1vbkpzVXNhZ2VXYXJuUGx1Z2luLFxuICBEZWR1cGVNb2R1bGVSZXNvbHZlUGx1Z2luLFxuICBKYXZhU2NyaXB0T3B0aW1pemVyUGx1Z2luLFxuICBKc29uU3RhdHNQbHVnaW4sXG4gIFNjcmlwdHNXZWJwYWNrUGx1Z2luLFxufSBmcm9tICcuLi9wbHVnaW5zJztcbmltcG9ydCB7IE5hbWVkQ2h1bmtzUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy9uYW1lZC1jaHVua3MtcGx1Z2luJztcbmltcG9ydCB7IFByb2dyZXNzUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy9wcm9ncmVzcy1wbHVnaW4nO1xuaW1wb3J0IHsgVHJhbnNmZXJTaXplUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy90cmFuc2Zlci1zaXplLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVJdnlQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtcbiAgYXNzZXRQYXR0ZXJucyxcbiAgZXh0ZXJuYWxpemVQYWNrYWdlcyxcbiAgZ2V0Q2FjaGVTZXR0aW5ncyxcbiAgZ2V0SW5zdHJ1bWVudGF0aW9uRXhjbHVkZWRQYXRocyxcbiAgZ2V0TWFpbkZpZWxkc0FuZENvbmRpdGlvbk5hbWVzLFxuICBnZXRPdXRwdXRIYXNoRm9ybWF0LFxuICBnZXRTdGF0c09wdGlvbnMsXG4gIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUsXG59IGZyb20gJy4uL3V0aWxzL2hlbHBlcnMnO1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldENvbW1vbkNvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKTogUHJvbWlzZTxDb25maWd1cmF0aW9uPiB7XG4gIGNvbnN0IHtcbiAgICByb290LFxuICAgIHByb2plY3RSb290LFxuICAgIGJ1aWxkT3B0aW9ucyxcbiAgICB0c0NvbmZpZyxcbiAgICBwcm9qZWN0TmFtZSxcbiAgICBzb3VyY2VSb290LFxuICAgIHRzQ29uZmlnUGF0aCxcbiAgICBzY3JpcHRUYXJnZXQsXG4gIH0gPSB3Y287XG4gIGNvbnN0IHtcbiAgICBjYWNoZSxcbiAgICBjb2RlQ292ZXJhZ2UsXG4gICAgY3Jvc3NPcmlnaW4gPSAnbm9uZScsXG4gICAgcGxhdGZvcm0gPSAnYnJvd3NlcicsXG4gICAgYW90ID0gdHJ1ZSxcbiAgICBjb2RlQ292ZXJhZ2VFeGNsdWRlID0gW10sXG4gICAgbWFpbixcbiAgICBwb2x5ZmlsbHMsXG4gICAgc291cmNlTWFwOiB7XG4gICAgICBzdHlsZXM6IHN0eWxlc1NvdXJjZU1hcCxcbiAgICAgIHNjcmlwdHM6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICB2ZW5kb3I6IHZlbmRvclNvdXJjZU1hcCxcbiAgICAgIGhpZGRlbjogaGlkZGVuU291cmNlTWFwLFxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7IHN0eWxlczogc3R5bGVzT3B0aW1pemF0aW9uLCBzY3JpcHRzOiBzY3JpcHRzT3B0aW1pemF0aW9uIH0sXG4gICAgY29tbW9uQ2h1bmssXG4gICAgdmVuZG9yQ2h1bmssXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgdmVyYm9zZSxcbiAgICBwb2xsLFxuICAgIHdlYldvcmtlclRzQ29uZmlnLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzID0gW10sXG4gICAgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgIGJ1bmRsZURlcGVuZGVuY2llcyxcbiAgfSA9IGJ1aWxkT3B0aW9ucztcblxuICBjb25zdCBpc1BsYXRmb3JtU2VydmVyID0gYnVpbGRPcHRpb25zLnBsYXRmb3JtID09PSAnc2VydmVyJztcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiB7IGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcik6IHZvaWQgfVtdID0gW107XG4gIGNvbnN0IGV4dHJhUnVsZXM6IFJ1bGVTZXRSdWxlW10gPSBbXTtcbiAgY29uc3QgZW50cnlQb2ludHM6IHsgW2tleTogc3RyaW5nXTogW3N0cmluZywgLi4uc3RyaW5nW11dIH0gPSB7fTtcblxuICAvLyBMb2FkIEVTTSBgQGFuZ3VsYXIvY29tcGlsZXItY2xpYCB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICBjb25zdCB7XG4gICAgR0xPQkFMX0RFRlNfRk9SX1RFUlNFUixcbiAgICBHTE9CQUxfREVGU19GT1JfVEVSU0VSX1dJVEhfQU9ULFxuICAgIFZFUlNJT046IE5HX1ZFUlNJT04sXG4gIH0gPSBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpPignQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk7XG5cbiAgLy8gZGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0XG4gIGNvbnN0IGhhc2hGb3JtYXQgPSBnZXRPdXRwdXRIYXNoRm9ybWF0KGJ1aWxkT3B0aW9ucy5vdXRwdXRIYXNoaW5nKTtcblxuICBpZiAoYnVpbGRPcHRpb25zLnByb2dyZXNzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFByb2dyZXNzUGx1Z2luKHBsYXRmb3JtKSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLm1haW4pIHtcbiAgICBjb25zdCBtYWluUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMubWFpbik7XG4gICAgZW50cnlQb2ludHNbJ21haW4nXSA9IFttYWluUGF0aF07XG4gIH1cblxuICBpZiAoaXNQbGF0Zm9ybVNlcnZlcikge1xuICAgIC8vIEZpeGVzIENyaXRpY2FsIGRlcGVuZGVuY3k6IHRoZSByZXF1ZXN0IG9mIGEgZGVwZW5kZW5jeSBpcyBhbiBleHByZXNzaW9uXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IENvbnRleHRSZXBsYWNlbWVudFBsdWdpbigvQD9oYXBpfGV4cHJlc3NbXFxcXC9dLykpO1xuICB9XG5cbiAgaWYgKCFpc1BsYXRmb3JtU2VydmVyKSB7XG4gICAgaWYgKGJ1aWxkT3B0aW9ucy5wb2x5ZmlsbHMpIHtcbiAgICAgIGNvbnN0IHByb2plY3RQb2x5ZmlsbHMgPSBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLnBvbHlmaWxscyk7XG4gICAgICBpZiAoZW50cnlQb2ludHNbJ3BvbHlmaWxscyddKSB7XG4gICAgICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXS5wdXNoKHByb2plY3RQb2x5ZmlsbHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gW3Byb2plY3RQb2x5ZmlsbHNdO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghYnVpbGRPcHRpb25zLmFvdCkge1xuICAgICAgY29uc3Qgaml0UG9seWZpbGxzID0gcmVxdWlyZS5yZXNvbHZlKCdjb3JlLWpzL3Byb3Bvc2Fscy9yZWZsZWN0LW1ldGFkYXRhJyk7XG4gICAgICBpZiAoZW50cnlQb2ludHNbJ3BvbHlmaWxscyddKSB7XG4gICAgICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXS5wdXNoKGppdFBvbHlmaWxscyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10gPSBbaml0UG9seWZpbGxzXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzKSB7XG4gICAgLy8gV2hlbiB0aGlzIGlzIG5vdCBkZWZpbmVkIGl0IG1lYW5zIHRoZSBidWlsZGVyIGRvZXNuJ3Qgc3VwcG9ydCBzaG93aW5nIGNvbW1vbiBqcyB1c2FnZXMuXG4gICAgLy8gV2hlbiBpdCBkb2VzIGl0IHdpbGwgYmUgYW4gYXJyYXkuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgQ29tbW9uSnNVc2FnZVdhcm5QbHVnaW4oe1xuICAgICAgICBhbGxvd2VkRGVwZW5kZW5jaWVzOiBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgLy8gcHJvY2VzcyBnbG9iYWwgc2NyaXB0c1xuICAvLyBBZGQgYSBuZXcgYXNzZXQgZm9yIGVhY2ggZW50cnkuXG4gIGZvciAoY29uc3QgeyBidW5kbGVOYW1lLCBpbmplY3QsIHBhdGhzIH0gb2YgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZShcbiAgICByb290LFxuICAgIGJ1aWxkT3B0aW9ucy5zY3JpcHRzLFxuICApKSB7XG4gICAgLy8gTGF6eSBzY3JpcHRzIGRvbid0IGdldCBhIGhhc2gsIG90aGVyd2lzZSB0aGV5IGNhbid0IGJlIGxvYWRlZCBieSBuYW1lLlxuICAgIGNvbnN0IGhhc2ggPSBpbmplY3QgPyBoYXNoRm9ybWF0LnNjcmlwdCA6ICcnO1xuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU2NyaXB0c1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICBuYW1lOiBidW5kbGVOYW1lLFxuICAgICAgICBzb3VyY2VNYXA6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICAgIHNjcmlwdHM6IHBhdGhzLFxuICAgICAgICBmaWxlbmFtZTogYCR7cGF0aC5iYXNlbmFtZShidW5kbGVOYW1lKX0ke2hhc2h9LmpzYCxcbiAgICAgICAgYmFzZVBhdGg6IHByb2plY3RSb290LFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgYXNzZXQgZW50cmllc1xuICBpZiAoYnVpbGRPcHRpb25zLmFzc2V0cy5sZW5ndGgpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBDb3B5V2VicGFja1BsdWdpbih7XG4gICAgICAgIHBhdHRlcm5zOiBhc3NldFBhdHRlcm5zKHJvb3QsIGJ1aWxkT3B0aW9ucy5hc3NldHMpLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzKSB7XG4gICAgY29uc3QgTGljZW5zZVdlYnBhY2tQbHVnaW4gPSByZXF1aXJlKCdsaWNlbnNlLXdlYnBhY2stcGx1Z2luJykuTGljZW5zZVdlYnBhY2tQbHVnaW47XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgTGljZW5zZVdlYnBhY2tQbHVnaW4oe1xuICAgICAgICBzdGF0czoge1xuICAgICAgICAgIHdhcm5pbmdzOiBmYWxzZSxcbiAgICAgICAgICBlcnJvcnM6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICBwZXJDaHVua091dHB1dDogZmFsc2UsXG4gICAgICAgIG91dHB1dEZpbGVuYW1lOiAnM3JkcGFydHlsaWNlbnNlcy50eHQnLFxuICAgICAgICBza2lwQ2hpbGRDb21waWxlcnM6IHRydWUsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHNjcmlwdHNTb3VyY2VNYXAgfHwgc3R5bGVzU291cmNlTWFwKSB7XG4gICAgY29uc3QgaW5jbHVkZSA9IFtdO1xuICAgIGlmIChzY3JpcHRzU291cmNlTWFwKSB7XG4gICAgICBpbmNsdWRlLnB1c2goL2pzJC8pO1xuICAgIH1cblxuICAgIGlmIChzdHlsZXNTb3VyY2VNYXApIHtcbiAgICAgIGluY2x1ZGUucHVzaCgvY3NzJC8pO1xuICAgIH1cblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFNvdXJjZU1hcERldlRvb2xQbHVnaW4oe1xuICAgICAgICBmaWxlbmFtZTogJ1tmaWxlXS5tYXAnLFxuICAgICAgICBpbmNsdWRlLFxuICAgICAgICAvLyBXZSB3YW50IHRvIHNldCBzb3VyY2VSb290IHRvICBgd2VicGFjazovLy9gIGZvciBub25cbiAgICAgICAgLy8gaW5saW5lIHNvdXJjZW1hcHMgYXMgb3RoZXJ3aXNlIHBhdGhzIHRvIHNvdXJjZW1hcHMgd2lsbCBiZSBicm9rZW4gaW4gYnJvd3NlclxuICAgICAgICAvLyBgd2VicGFjazovLy9gIGlzIG5lZWRlZCBmb3IgVmlzdWFsIFN0dWRpbyBicmVha3BvaW50cyB0byB3b3JrIHByb3Blcmx5IGFzIGN1cnJlbnRseVxuICAgICAgICAvLyB0aGVyZSBpcyBubyB3YXkgdG8gc2V0IHRoZSAnd2ViUm9vdCdcbiAgICAgICAgc291cmNlUm9vdDogJ3dlYnBhY2s6Ly8vJyxcbiAgICAgICAgbW9kdWxlRmlsZW5hbWVUZW1wbGF0ZTogJ1tyZXNvdXJjZS1wYXRoXScsXG4gICAgICAgIGFwcGVuZDogaGlkZGVuU291cmNlTWFwID8gZmFsc2UgOiB1bmRlZmluZWQsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdGF0c0pzb24pIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBKc29uU3RhdHNQbHVnaW4ocGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoLCAnc3RhdHMuanNvbicpKSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHN1YnJlc291cmNlSW50ZWdyaXR5KSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4oe1xuICAgICAgICBoYXNoRnVuY05hbWVzOiBbJ3NoYTM4NCddLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzY3JpcHRzU291cmNlTWFwIHx8IHN0eWxlc1NvdXJjZU1hcCkge1xuICAgIGV4dHJhUnVsZXMucHVzaCh7XG4gICAgICB0ZXN0OiAvXFwuW2NtXT9qc3g/JC8sXG4gICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdzb3VyY2UtbWFwLWxvYWRlcicpLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICBmaWx0ZXJTb3VyY2VNYXBwaW5nVXJsOiAoX21hcFVyaTogc3RyaW5nLCByZXNvdXJjZVBhdGg6IHN0cmluZykgPT4ge1xuICAgICAgICAgIGlmICh2ZW5kb3JTb3VyY2VNYXApIHtcbiAgICAgICAgICAgIC8vIENvbnN1bWUgYWxsIHNvdXJjZW1hcHMgd2hlbiB2ZW5kb3Igb3B0aW9uIGlzIGVuYWJsZWQuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBEb24ndCBjb25zdW1lIHNvdXJjZW1hcHMgaW4gbm9kZV9tb2R1bGVzIHdoZW4gdmVuZG9yIGlzIGRpc2FibGVkLlxuICAgICAgICAgIC8vIEJ1dCwgZG8gY29uc3VtZSBsb2NhbCBsaWJyYXJpZXMgc291cmNlbWFwcy5cbiAgICAgICAgICByZXR1cm4gIXJlc291cmNlUGF0aC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJyk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgaWYgKG1haW4gfHwgcG9seWZpbGxzKSB7XG4gICAgZXh0cmFSdWxlcy5wdXNoKHtcbiAgICAgIHRlc3Q6IHRzQ29uZmlnLm9wdGlvbnMuYWxsb3dKcyA/IC9cXC5bY21dP1t0al1zeD8kLyA6IC9cXC5bY21dP3RzeD8kLyxcbiAgICAgIGxvYWRlcjogQW5ndWxhcldlYnBhY2tMb2FkZXJQYXRoLFxuICAgICAgLy8gVGhlIGJlbG93IGFyZSBrbm93biBwYXRocyB0aGF0IGFyZSBub3QgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBjb21waWxhdGlvbiBldmVuIHdoZW4gYWxsb3dKcyBpcyBlbmFibGVkLlxuICAgICAgZXhjbHVkZTogWy9bL1xcXFxdKD86Y3NzLWxvYWRlcnxtaW5pLWNzcy1leHRyYWN0LXBsdWdpbnx3ZWJwYWNrLWRldi1zZXJ2ZXJ8d2VicGFjaylbL1xcXFxdL10sXG4gICAgfSk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goY3JlYXRlSXZ5UGx1Z2luKHdjbywgYW90LCB0c0NvbmZpZ1BhdGgpKTtcbiAgfVxuXG4gIGlmICh3ZWJXb3JrZXJUc0NvbmZpZykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGNyZWF0ZUl2eVBsdWdpbih3Y28sIGZhbHNlLCBwYXRoLnJlc29sdmUod2NvLnJvb3QsIHdlYldvcmtlclRzQ29uZmlnKSkpO1xuICB9XG5cbiAgY29uc3QgZXh0cmFNaW5pbWl6ZXJzID0gW107XG4gIGlmIChzY3JpcHRzT3B0aW1pemF0aW9uKSB7XG4gICAgZXh0cmFNaW5pbWl6ZXJzLnB1c2goXG4gICAgICBuZXcgSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbih7XG4gICAgICAgIGRlZmluZTogYnVpbGRPcHRpb25zLmFvdCA/IEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QgOiBHTE9CQUxfREVGU19GT1JfVEVSU0VSLFxuICAgICAgICBzb3VyY2VtYXA6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICAgIHRhcmdldDogc2NyaXB0VGFyZ2V0LFxuICAgICAgICBrZWVwSWRlbnRpZmllck5hbWVzOiAhYWxsb3dNYW5nbGUgfHwgaXNQbGF0Zm9ybVNlcnZlcixcbiAgICAgICAga2VlcE5hbWVzOiBpc1BsYXRmb3JtU2VydmVyLFxuICAgICAgICByZW1vdmVMaWNlbnNlczogYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcyxcbiAgICAgICAgYWR2YW5jZWQ6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAocGxhdGZvcm0gPT09ICdicm93c2VyJyAmJiAoc2NyaXB0c09wdGltaXphdGlvbiB8fCBzdHlsZXNPcHRpbWl6YXRpb24ubWluaWZ5KSkge1xuICAgIGV4dHJhTWluaW1pemVycy5wdXNoKG5ldyBUcmFuc2ZlclNpemVQbHVnaW4oKSk7XG4gIH1cblxuICBjb25zdCBleHRlcm5hbHM6IENvbmZpZ3VyYXRpb25bJ2V4dGVybmFscyddID0gWy4uLmV4dGVybmFsRGVwZW5kZW5jaWVzXTtcbiAgaWYgKGlzUGxhdGZvcm1TZXJ2ZXIgJiYgIWJ1bmRsZURlcGVuZGVuY2llcykge1xuICAgIGV4dGVybmFscy5wdXNoKCh7IGNvbnRleHQsIHJlcXVlc3QgfSwgY2FsbGJhY2spID0+XG4gICAgICBleHRlcm5hbGl6ZVBhY2thZ2VzKGNvbnRleHQgPz8gd2NvLnByb2plY3RSb290LCByZXF1ZXN0LCBjYWxsYmFjayksXG4gICAgKTtcbiAgfVxuXG4gIGxldCBjcm9zc09yaWdpbkxvYWRpbmc6IE5vbk51bGxhYmxlPENvbmZpZ3VyYXRpb25bJ291dHB1dCddPlsnY3Jvc3NPcmlnaW5Mb2FkaW5nJ10gPSBmYWxzZTtcbiAgaWYgKHN1YnJlc291cmNlSW50ZWdyaXR5ICYmIGNyb3NzT3JpZ2luID09PSAnbm9uZScpIHtcbiAgICBjcm9zc09yaWdpbkxvYWRpbmcgPSAnYW5vbnltb3VzJztcbiAgfSBlbHNlIGlmIChjcm9zc09yaWdpbiAhPT0gJ25vbmUnKSB7XG4gICAgY3Jvc3NPcmlnaW5Mb2FkaW5nID0gY3Jvc3NPcmlnaW47XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG1vZGU6IHNjcmlwdHNPcHRpbWl6YXRpb24gfHwgc3R5bGVzT3B0aW1pemF0aW9uLm1pbmlmeSA/ICdwcm9kdWN0aW9uJyA6ICdkZXZlbG9wbWVudCcsXG4gICAgZGV2dG9vbDogZmFsc2UsXG4gICAgdGFyZ2V0OiBbXG4gICAgICBpc1BsYXRmb3JtU2VydmVyID8gJ25vZGUnIDogJ3dlYicsXG4gICAgICBzY3JpcHRUYXJnZXQgPT09IFNjcmlwdFRhcmdldC5FUzUgPyAnZXM1JyA6ICdlczIwMTUnLFxuICAgIF0sXG4gICAgcHJvZmlsZTogYnVpbGRPcHRpb25zLnN0YXRzSnNvbixcbiAgICByZXNvbHZlOiB7XG4gICAgICByb290czogW3Byb2plY3RSb290XSxcbiAgICAgIGV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICBtb2R1bGVzOiBbdHNDb25maWcub3B0aW9ucy5iYXNlVXJsIHx8IHByb2plY3RSb290LCAnbm9kZV9tb2R1bGVzJ10sXG4gICAgICAuLi5nZXRNYWluRmllbGRzQW5kQ29uZGl0aW9uTmFtZXMoc2NyaXB0VGFyZ2V0LCBpc1BsYXRmb3JtU2VydmVyKSxcbiAgICB9LFxuICAgIHJlc29sdmVMb2FkZXI6IHtcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgfSxcbiAgICBjb250ZXh0OiByb290LFxuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBleHRlcm5hbHMsXG4gICAgb3V0cHV0OiB7XG4gICAgICB1bmlxdWVOYW1lOiBwcm9qZWN0TmFtZSxcbiAgICAgIGhhc2hGdW5jdGlvbjogJ3h4aGFzaDY0JywgLy8gdG9kbzogcmVtb3ZlIGluIHdlYnBhY2sgNi4gVGhpcyBpcyBwYXJ0IG9mIGBmdXR1cmVEZWZhdWx0c2AuXG4gICAgICBjbGVhbjogYnVpbGRPcHRpb25zLmRlbGV0ZU91dHB1dFBhdGggPz8gdHJ1ZSxcbiAgICAgIHBhdGg6IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCksXG4gICAgICBwdWJsaWNQYXRoOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsID8/ICcnLFxuICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICAgIGNodW5rRmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICAgIGxpYnJhcnlUYXJnZXQ6IGlzUGxhdGZvcm1TZXJ2ZXIgPyAnY29tbW9uanMnIDogdW5kZWZpbmVkLFxuICAgICAgY3Jvc3NPcmlnaW5Mb2FkaW5nLFxuICAgICAgdHJ1c3RlZFR5cGVzOiAnYW5ndWxhciNidW5kbGVyJyxcbiAgICAgIHNjcmlwdFR5cGU6ICdtb2R1bGUnLFxuICAgIH0sXG4gICAgd2F0Y2g6IGJ1aWxkT3B0aW9ucy53YXRjaCxcbiAgICB3YXRjaE9wdGlvbnM6IHtcbiAgICAgIHBvbGwsXG4gICAgICBpZ25vcmVkOiBwb2xsID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiAnKiovbm9kZV9tb2R1bGVzLyoqJyxcbiAgICB9LFxuICAgIHBlcmZvcm1hbmNlOiB7XG4gICAgICBoaW50czogZmFsc2UsXG4gICAgfSxcbiAgICBpZ25vcmVXYXJuaW5nczogW1xuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zb3VyY2UtbWFwLWxvYWRlci9ibG9iL2IyZGU0MjQ5Yzc0MzFkZDg0MzJkYTYwN2UwOGYwZjY1ZTlkNjQyMTkvc3JjL2luZGV4LmpzI0w4M1xuICAgICAgL0ZhaWxlZCB0byBwYXJzZSBzb3VyY2UgbWFwIGZyb20vLFxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9wb3N0Y3NzLWxvYWRlci9ibG9iL2JkMjYxODc1ZmRmOWM1OTZhZjRmZmIzYTFhNzNmZTNjNTQ5YmVmZGEvc3JjL2luZGV4LmpzI0wxNTMtTDE1OFxuICAgICAgL0FkZCBwb3N0Y3NzIGFzIHByb2plY3QgZGVwZW5kZW5jeS8sXG4gICAgICAvLyBlc2J1aWxkIHdpbGwgaXNzdWUgYSB3YXJuaW5nLCB3aGlsZSBzdGlsbCBob2lzdHMgdGhlIEBjaGFyc2V0IGF0IHRoZSB2ZXJ5IHRvcC5cbiAgICAgIC8vIFRoaXMgaXMgY2F1c2VkIGJ5IGEgYnVnIGluIGNzcy1sb2FkZXIgaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9jc3MtbG9hZGVyL2lzc3Vlcy8xMjEyXG4gICAgICAvXCJAY2hhcnNldFwiIG11c3QgYmUgdGhlIGZpcnN0IHJ1bGUgaW4gdGhlIGZpbGUvLFxuICAgIF0sXG4gICAgbW9kdWxlOiB7XG4gICAgICAvLyBTaG93IGFuIGVycm9yIGZvciBtaXNzaW5nIGV4cG9ydHMgaW5zdGVhZCBvZiBhIHdhcm5pbmcuXG4gICAgICBzdHJpY3RFeHBvcnRQcmVzZW5jZTogdHJ1ZSxcbiAgICAgIHBhcnNlcjoge1xuICAgICAgICBqYXZhc2NyaXB0OiB7XG4gICAgICAgICAgLy8gRGlzYWJsZSBhdXRvIFVSTCBhc3NldCBtb2R1bGUgY3JlYXRpb24uIFRoaXMgZG9lc24ndCBlZmZlY3QgYG5ldyBXb3JrZXIobmV3IFVSTCguLi4pKWBcbiAgICAgICAgICAvLyBodHRwczovL3dlYnBhY2suanMub3JnL2d1aWRlcy9hc3NldC1tb2R1bGVzLyN1cmwtYXNzZXRzXG4gICAgICAgICAgdXJsOiBmYWxzZSxcbiAgICAgICAgICB3b3JrZXI6ICEhd2ViV29ya2VyVHNDb25maWcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC4/KHN2Z3xodG1sKSQvLFxuICAgICAgICAgIC8vIE9ubHkgcHJvY2VzcyBIVE1MIGFuZCBTVkcgd2hpY2ggYXJlIGtub3duIEFuZ3VsYXIgY29tcG9uZW50IHJlc291cmNlcy5cbiAgICAgICAgICByZXNvdXJjZVF1ZXJ5OiAvXFw/bmdSZXNvdXJjZS8sXG4gICAgICAgICAgdHlwZTogJ2Fzc2V0L3NvdXJjZScsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBNYXJrIGZpbGVzIGluc2lkZSBgcnhqcy9hZGRgIGFzIGNvbnRhaW5pbmcgc2lkZSBlZmZlY3RzLlxuICAgICAgICAgIC8vIElmIHRoaXMgaXMgZml4ZWQgdXBzdHJlYW0gYW5kIHRoZSBmaXhlZCB2ZXJzaW9uIGJlY29tZXMgdGhlIG1pbmltdW1cbiAgICAgICAgICAvLyBzdXBwb3J0ZWQgdmVyc2lvbiwgdGhpcyBjYW4gYmUgcmVtb3ZlZC5cbiAgICAgICAgICB0ZXN0OiAvWy9cXFxcXXJ4anNbL1xcXFxdYWRkWy9cXFxcXS4rXFwuanMkLyxcbiAgICAgICAgICBzaWRlRWZmZWN0czogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5bY21dP1t0al1zeD8kLyxcbiAgICAgICAgICAvLyBUaGUgYmVsb3cgaXMgbmVlZGVkIGR1ZSB0byBhIGJ1ZyBpbiBgQGJhYmVsL3J1bnRpbWVgLiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9iYWJlbC9iYWJlbC9pc3N1ZXMvMTI4MjRcbiAgICAgICAgICByZXNvbHZlOiB7IGZ1bGx5U3BlY2lmaWVkOiBmYWxzZSB9LFxuICAgICAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgICAgIC9bL1xcXFxdKD86Y29yZS1qc3xAYmFiZWx8dHNsaWJ8d2ViLWFuaW1hdGlvbnMtanN8d2ViLXN0cmVhbXMtcG9seWZpbGx8d2hhdHdnLXVybClbL1xcXFxdLyxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHVzZTogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInKSxcbiAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICAgIGNhY2hlRGlyZWN0b3J5OiAoY2FjaGUuZW5hYmxlZCAmJiBwYXRoLmpvaW4oY2FjaGUucGF0aCwgJ2JhYmVsLXdlYnBhY2snKSkgfHwgZmFsc2UsXG4gICAgICAgICAgICAgICAgc2NyaXB0VGFyZ2V0LFxuICAgICAgICAgICAgICAgIGFvdDogYnVpbGRPcHRpb25zLmFvdCxcbiAgICAgICAgICAgICAgICBvcHRpbWl6ZTogYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyLFxuICAgICAgICAgICAgICAgIGluc3RydW1lbnRDb2RlOiBjb2RlQ292ZXJhZ2VcbiAgICAgICAgICAgICAgICAgID8ge1xuICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkQmFzZVBhdGg6IHNvdXJjZVJvb3QsXG4gICAgICAgICAgICAgICAgICAgICAgZXhjbHVkZWRQYXRoczogZ2V0SW5zdHJ1bWVudGF0aW9uRXhjbHVkZWRQYXRocyhyb290LCBjb2RlQ292ZXJhZ2VFeGNsdWRlKSxcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgIH0gYXMgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgLi4uZXh0cmFSdWxlcyxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBleHBlcmltZW50czoge1xuICAgICAgYmFja0NvbXBhdDogZmFsc2UsXG4gICAgICBzeW5jV2ViQXNzZW1ibHk6IHRydWUsXG4gICAgICBhc3luY1dlYkFzc2VtYmx5OiB0cnVlLFxuICAgIH0sXG4gICAgaW5mcmFzdHJ1Y3R1cmVMb2dnaW5nOiB7XG4gICAgICBsZXZlbDogdmVyYm9zZSA/ICd2ZXJib3NlJyA6ICdlcnJvcicsXG4gICAgfSxcbiAgICBzdGF0czogZ2V0U3RhdHNPcHRpb25zKHZlcmJvc2UpLFxuICAgIGNhY2hlOiBnZXRDYWNoZVNldHRpbmdzKHdjbywgTkdfVkVSU0lPTi5mdWxsKSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG1pbmltaXplcjogZXh0cmFNaW5pbWl6ZXJzLFxuICAgICAgbW9kdWxlSWRzOiAnZGV0ZXJtaW5pc3RpYycsXG4gICAgICBjaHVua0lkczogYnVpbGRPcHRpb25zLm5hbWVkQ2h1bmtzID8gJ25hbWVkJyA6ICdkZXRlcm1pbmlzdGljJyxcbiAgICAgIGVtaXRPbkVycm9yczogZmFsc2UsXG4gICAgICBydW50aW1lQ2h1bms6IGlzUGxhdGZvcm1TZXJ2ZXIgPyBmYWxzZSA6ICdzaW5nbGUnLFxuICAgICAgc3BsaXRDaHVua3M6IHtcbiAgICAgICAgbWF4QXN5bmNSZXF1ZXN0czogSW5maW5pdHksXG4gICAgICAgIGNhY2hlR3JvdXBzOiB7XG4gICAgICAgICAgZGVmYXVsdDogISFjb21tb25DaHVuayAmJiB7XG4gICAgICAgICAgICBjaHVua3M6ICdhc3luYycsXG4gICAgICAgICAgICBtaW5DaHVua3M6IDIsXG4gICAgICAgICAgICBwcmlvcml0eTogMTAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb21tb246ICEhY29tbW9uQ2h1bmsgJiYge1xuICAgICAgICAgICAgbmFtZTogJ2NvbW1vbicsXG4gICAgICAgICAgICBjaHVua3M6ICdhc3luYycsXG4gICAgICAgICAgICBtaW5DaHVua3M6IDIsXG4gICAgICAgICAgICBlbmZvcmNlOiB0cnVlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IDUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB2ZW5kb3JzOiBmYWxzZSxcbiAgICAgICAgICBkZWZhdWx0VmVuZG9yczogISF2ZW5kb3JDaHVuayAmJiB7XG4gICAgICAgICAgICBuYW1lOiAndmVuZG9yJyxcbiAgICAgICAgICAgIGNodW5rczogKGNodW5rKSA9PiBjaHVuay5uYW1lID09PSAnbWFpbicsXG4gICAgICAgICAgICBlbmZvcmNlOiB0cnVlLFxuICAgICAgICAgICAgdGVzdDogL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIHBsdWdpbnM6IFtuZXcgTmFtZWRDaHVua3NQbHVnaW4oKSwgbmV3IERlZHVwZU1vZHVsZVJlc29sdmVQbHVnaW4oeyB2ZXJib3NlIH0pLCAuLi5leHRyYVBsdWdpbnNdLFxuICAgIG5vZGU6IGZhbHNlLFxuICB9O1xufVxuIl19