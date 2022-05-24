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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhDQUE0RDtBQUM1RCw4RUFBb0Q7QUFDcEQsMkNBQTZCO0FBQzdCLDJDQUEwQztBQUMxQyxxQ0FNaUI7QUFDakIsaUZBQTJFO0FBRzNFLHlFQUE4RDtBQUM5RCxtREFBcUQ7QUFDckQsd0NBTW9CO0FBQ3BCLHdFQUFtRTtBQUNuRSxnRUFBNEQ7QUFDNUQsMEVBQXFFO0FBQ3JFLHNEQUF3RDtBQUN4RCw4Q0FTMEI7QUFFMUIsa0RBQWtEO0FBQzNDLEtBQUssVUFBVSxlQUFlLENBQUMsR0FBeUI7O0lBQzdELE1BQU0sRUFDSixJQUFJLEVBQ0osV0FBVyxFQUNYLFlBQVksRUFDWixRQUFRLEVBQ1IsV0FBVyxFQUNYLFVBQVUsRUFDVixZQUFZLEVBQ1osWUFBWSxHQUNiLEdBQUcsR0FBRyxDQUFDO0lBQ1IsTUFBTSxFQUNKLEtBQUssRUFDTCxZQUFZLEVBQ1osV0FBVyxHQUFHLE1BQU0sRUFDcEIsUUFBUSxHQUFHLFNBQVMsRUFDcEIsR0FBRyxHQUFHLElBQUksRUFDVixtQkFBbUIsR0FBRyxFQUFFLEVBQ3hCLElBQUksRUFDSixTQUFTLEVBQ1QsU0FBUyxFQUFFLEVBQ1QsTUFBTSxFQUFFLGVBQWUsRUFDdkIsT0FBTyxFQUFFLGdCQUFnQixFQUN6QixNQUFNLEVBQUUsZUFBZSxFQUN2QixNQUFNLEVBQUUsZUFBZSxHQUN4QixFQUNELFlBQVksRUFBRSxFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsRUFDMUUsV0FBVyxFQUNYLFdBQVcsRUFDWCxvQkFBb0Is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QUssTUFBTTt3QkFDeEMsT0FBTyxFQUFFLElBQUk7d0JBQ2IsSUFBSSxFQUFFLHdCQUF3QjtxQkFDL0I7aUJBQ0Y7YUFDRjtTQUNGO1FBQ0QsT0FBTyxFQUFFLENBQUMsSUFBSSx1Q0FBaUIsRUFBRSxFQUFFLElBQUksbUNBQXlCLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLEdBQUcsWUFBWSxDQUFDO1FBQy9GLElBQUksRUFBRSxLQUFLO0tBQ1osQ0FBQztBQUNKLENBQUM7QUF4WUQsMENBd1lDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEFuZ3VsYXJXZWJwYWNrTG9hZGVyUGF0aCB9IGZyb20gJ0BuZ3Rvb2xzL3dlYnBhY2snO1xuaW1wb3J0IENvcHlXZWJwYWNrUGx1Z2luIGZyb20gJ2NvcHktd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IFNjcmlwdFRhcmdldCB9IGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtcbiAgQ29tcGlsZXIsXG4gIENvbmZpZ3VyYXRpb24sXG4gIENvbnRleHRSZXBsYWNlbWVudFBsdWdpbixcbiAgUnVsZVNldFJ1bGUsXG4gIFNvdXJjZU1hcERldlRvb2xQbHVnaW4sXG59IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4gfSBmcm9tICd3ZWJwYWNrLXN1YnJlc291cmNlLWludGVncml0eSc7XG5pbXBvcnQgeyBBbmd1bGFyQmFiZWxMb2FkZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IGFsbG93TWFuZ2xlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHtcbiAgQ29tbW9uSnNVc2FnZVdhcm5QbHVnaW4sXG4gIERlZHVwZU1vZHVsZVJlc29sdmVQbHVnaW4sXG4gIEphdmFTY3JpcHRPcHRpbWl6ZXJQbHVnaW4sXG4gIEpzb25TdGF0c1BsdWdpbixcbiAgU2NyaXB0c1dlYnBhY2tQbHVnaW4sXG59IGZyb20gJy4uL3BsdWdpbnMnO1xuaW1wb3J0IHsgTmFtZWRDaHVua3NQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL25hbWVkLWNodW5rcy1wbHVnaW4nO1xuaW1wb3J0IHsgUHJvZ3Jlc3NQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3Byb2dyZXNzLXBsdWdpbic7XG5pbXBvcnQgeyBUcmFuc2ZlclNpemVQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3RyYW5zZmVyLXNpemUtcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZUl2eVBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvdHlwZXNjcmlwdCc7XG5pbXBvcnQge1xuICBhc3NldFBhdHRlcm5zLFxuICBleHRlcm5hbGl6ZVBhY2thZ2VzLFxuICBnZXRDYWNoZVNldHRpbmdzLFxuICBnZXRJbnN0cnVtZW50YXRpb25FeGNsdWRlZFBhdGhzLFxuICBnZXRNYWluRmllbGRzQW5kQ29uZGl0aW9uTmFtZXMsXG4gIGdldE91dHB1dEhhc2hGb3JtYXQsXG4gIGdldFN0YXRzT3B0aW9ucyxcbiAgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZSxcbn0gZnJvbSAnLi4vdXRpbHMvaGVscGVycyc7XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q29tbW9uQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpOiBQcm9taXNlPENvbmZpZ3VyYXRpb24+IHtcbiAgY29uc3Qge1xuICAgIHJvb3QsXG4gICAgcHJvamVjdFJvb3QsXG4gICAgYnVpbGRPcHRpb25zLFxuICAgIHRzQ29uZmlnLFxuICAgIHByb2plY3ROYW1lLFxuICAgIHNvdXJjZVJvb3QsXG4gICAgdHNDb25maWdQYXRoLFxuICAgIHNjcmlwdFRhcmdldCxcbiAgfSA9IHdjbztcbiAgY29uc3Qge1xuICAgIGNhY2hlLFxuICAgIGNvZGVDb3ZlcmFnZSxcbiAgICBjcm9zc09yaWdpbiA9ICdub25lJyxcbiAgICBwbGF0Zm9ybSA9ICdicm93c2VyJyxcbiAgICBhb3QgPSB0cnVlLFxuICAgIGNvZGVDb3ZlcmFnZUV4Y2x1ZGUgPSBbXSxcbiAgICBtYWluLFxuICAgIHBvbHlmaWxscyxcbiAgICBzb3VyY2VNYXA6IHtcbiAgICAgIHN0eWxlczogc3R5bGVzU291cmNlTWFwLFxuICAgICAgc2NyaXB0czogc2NyaXB0c1NvdXJjZU1hcCxcbiAgICAgIHZlbmRvcjogdmVuZG9yU291cmNlTWFwLFxuICAgICAgaGlkZGVuOiBoaWRkZW5Tb3VyY2VNYXAsXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHsgc3R5bGVzOiBzdHlsZXNPcHRpbWl6YXRpb24sIHNjcmlwdHM6IHNjcmlwdHNPcHRpbWl6YXRpb24gfSxcbiAgICBjb21tb25DaHVuayxcbiAgICB2ZW5kb3JDaHVuayxcbiAgICBzdWJyZXNvdXJjZUludGVncml0eSxcbiAgICB2ZXJib3NlLFxuICAgIHBvbGwsXG4gICAgd2ViV29ya2VyVHNDb25maWcsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMgPSBbXSxcbiAgICBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMsXG4gICAgYnVuZGxlRGVwZW5kZW5jaWVzLFxuICB9ID0gYnVpbGRPcHRpb25zO1xuXG4gIGNvbnN0IGlzUGxhdGZvcm1TZXJ2ZXIgPSBidWlsZE9wdGlvbnMucGxhdGZvcm0gPT09ICdzZXJ2ZXInO1xuICBjb25zdCBleHRyYVBsdWdpbnM6IHsgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKTogdm9pZCB9W10gPSBbXTtcbiAgY29uc3QgZXh0cmFSdWxlczogUnVsZVNldFJ1bGVbXSA9IFtdO1xuICBjb25zdCBlbnRyeVBvaW50czogeyBba2V5OiBzdHJpbmddOiBbc3RyaW5nLCAuLi5zdHJpbmdbXV0gfSA9IHt9O1xuXG4gIC8vIExvYWQgRVNNIGBAYW5ndWxhci9jb21waWxlci1jbGlgIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gIGNvbnN0IHtcbiAgICBHTE9CQUxfREVGU19GT1JfVEVSU0VSLFxuICAgIEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QsXG4gICAgVkVSU0lPTjogTkdfVkVSU0lPTixcbiAgfSA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk+KCdAYW5ndWxhci9jb21waWxlci1jbGknKTtcblxuICAvLyBkZXRlcm1pbmUgaGFzaGluZyBmb3JtYXRcbiAgY29uc3QgaGFzaEZvcm1hdCA9IGdldE91dHB1dEhhc2hGb3JtYXQoYnVpbGRPcHRpb25zLm91dHB1dEhhc2hpbmcpO1xuXG4gIGlmIChidWlsZE9wdGlvbnMucHJvZ3Jlc3MpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgUHJvZ3Jlc3NQbHVnaW4ocGxhdGZvcm0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMubWFpbikge1xuICAgIGNvbnN0IG1haW5QYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5tYWluKTtcbiAgICBlbnRyeVBvaW50c1snbWFpbiddID0gW21haW5QYXRoXTtcbiAgfVxuXG4gIGlmIChpc1BsYXRmb3JtU2VydmVyKSB7XG4gICAgLy8gRml4ZXMgQ3JpdGljYWwgZGVwZW5kZW5jeTogdGhlIHJlcXVlc3Qgb2YgYSBkZXBlbmRlbmN5IGlzIGFuIGV4cHJlc3Npb25cbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgQ29udGV4dFJlcGxhY2VtZW50UGx1Z2luKC9AP2hhcGl8ZXhwcmVzc1tcXFxcL10vKSk7XG4gIH1cblxuICBpZiAoIWlzUGxhdGZvcm1TZXJ2ZXIpIHtcbiAgICBpZiAoYnVpbGRPcHRpb25zLnBvbHlmaWxscykge1xuICAgICAgY29uc3QgcHJvamVjdFBvbHlmaWxscyA9IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMucG9seWZpbGxzKTtcbiAgICAgIGlmIChlbnRyeVBvaW50c1sncG9seWZpbGxzJ10pIHtcbiAgICAgICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddLnB1c2gocHJvamVjdFBvbHlmaWxscyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10gPSBbcHJvamVjdFBvbHlmaWxsc107XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcykge1xuICAgIC8vIFdoZW4gdGhpcyBpcyBub3QgZGVmaW5lZCBpdCBtZWFucyB0aGUgYnVpbGRlciBkb2Vzbid0IHN1cHBvcnQgc2hvd2luZyBjb21tb24ganMgdXNhZ2VzLlxuICAgIC8vIFdoZW4gaXQgZG9lcyBpdCB3aWxsIGJlIGFuIGFycmF5LlxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IENvbW1vbkpzVXNhZ2VXYXJuUGx1Z2luKHtcbiAgICAgICAgYWxsb3dlZERlcGVuZGVuY2llczogYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgZ2xvYmFsIHNjcmlwdHNcbiAgLy8gQWRkIGEgbmV3IGFzc2V0IGZvciBlYWNoIGVudHJ5LlxuICBmb3IgKGNvbnN0IHsgYnVuZGxlTmFtZSwgaW5qZWN0LCBwYXRocyB9IG9mIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUoXG4gICAgcm9vdCxcbiAgICBidWlsZE9wdGlvbnMuc2NyaXB0cyxcbiAgKSkge1xuICAgIC8vIExhenkgc2NyaXB0cyBkb24ndCBnZXQgYSBoYXNoLCBvdGhlcndpc2UgdGhleSBjYW4ndCBiZSBsb2FkZWQgYnkgbmFtZS5cbiAgICBjb25zdCBoYXNoID0gaW5qZWN0ID8gaGFzaEZvcm1hdC5zY3JpcHQgOiAnJztcblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFNjcmlwdHNXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgbmFtZTogYnVuZGxlTmFtZSxcbiAgICAgICAgc291cmNlTWFwOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgICBzY3JpcHRzOiBwYXRocyxcbiAgICAgICAgZmlsZW5hbWU6IGAke3BhdGguYmFzZW5hbWUoYnVuZGxlTmFtZSl9JHtoYXNofS5qc2AsXG4gICAgICAgIGJhc2VQYXRoOiBwcm9qZWN0Um9vdCxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICAvLyBwcm9jZXNzIGFzc2V0IGVudHJpZXNcbiAgaWYgKGJ1aWxkT3B0aW9ucy5hc3NldHMubGVuZ3RoKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgQ29weVdlYnBhY2tQbHVnaW4oe1xuICAgICAgICBwYXR0ZXJuczogYXNzZXRQYXR0ZXJucyhyb290LCBidWlsZE9wdGlvbnMuYXNzZXRzKSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcykge1xuICAgIGNvbnN0IExpY2Vuc2VXZWJwYWNrUGx1Z2luID0gcmVxdWlyZSgnbGljZW5zZS13ZWJwYWNrLXBsdWdpbicpLkxpY2Vuc2VXZWJwYWNrUGx1Z2luO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IExpY2Vuc2VXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICB3YXJuaW5nczogZmFsc2UsXG4gICAgICAgICAgZXJyb3JzOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgcGVyQ2h1bmtPdXRwdXQ6IGZhbHNlLFxuICAgICAgICBvdXRwdXRGaWxlbmFtZTogJzNyZHBhcnR5bGljZW5zZXMudHh0JyxcbiAgICAgICAgc2tpcENoaWxkQ29tcGlsZXJzOiB0cnVlLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzY3JpcHRzU291cmNlTWFwIHx8IHN0eWxlc1NvdXJjZU1hcCkge1xuICAgIGNvbnN0IGluY2x1ZGUgPSBbXTtcbiAgICBpZiAoc2NyaXB0c1NvdXJjZU1hcCkge1xuICAgICAgaW5jbHVkZS5wdXNoKC9qcyQvKTtcbiAgICB9XG5cbiAgICBpZiAoc3R5bGVzU291cmNlTWFwKSB7XG4gICAgICBpbmNsdWRlLnB1c2goL2NzcyQvKTtcbiAgICB9XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBTb3VyY2VNYXBEZXZUb29sUGx1Z2luKHtcbiAgICAgICAgZmlsZW5hbWU6ICdbZmlsZV0ubWFwJyxcbiAgICAgICAgaW5jbHVkZSxcbiAgICAgICAgLy8gV2Ugd2FudCB0byBzZXQgc291cmNlUm9vdCB0byAgYHdlYnBhY2s6Ly8vYCBmb3Igbm9uXG4gICAgICAgIC8vIGlubGluZSBzb3VyY2VtYXBzIGFzIG90aGVyd2lzZSBwYXRocyB0byBzb3VyY2VtYXBzIHdpbGwgYmUgYnJva2VuIGluIGJyb3dzZXJcbiAgICAgICAgLy8gYHdlYnBhY2s6Ly8vYCBpcyBuZWVkZWQgZm9yIFZpc3VhbCBTdHVkaW8gYnJlYWtwb2ludHMgdG8gd29yayBwcm9wZXJseSBhcyBjdXJyZW50bHlcbiAgICAgICAgLy8gdGhlcmUgaXMgbm8gd2F5IHRvIHNldCB0aGUgJ3dlYlJvb3QnXG4gICAgICAgIHNvdXJjZVJvb3Q6ICd3ZWJwYWNrOi8vLycsXG4gICAgICAgIG1vZHVsZUZpbGVuYW1lVGVtcGxhdGU6ICdbcmVzb3VyY2UtcGF0aF0nLFxuICAgICAgICBhcHBlbmQ6IGhpZGRlblNvdXJjZU1hcCA/IGZhbHNlIDogdW5kZWZpbmVkLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3RhdHNKc29uKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgSnNvblN0YXRzUGx1Z2luKHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCwgJ3N0YXRzLmpzb24nKSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzdWJyZXNvdXJjZUludGVncml0eSkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFN1YnJlc291cmNlSW50ZWdyaXR5UGx1Z2luKHtcbiAgICAgICAgaGFzaEZ1bmNOYW1lczogWydzaGEzODQnXSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoc2NyaXB0c1NvdXJjZU1hcCB8fCBzdHlsZXNTb3VyY2VNYXApIHtcbiAgICBleHRyYVJ1bGVzLnB1c2goe1xuICAgICAgdGVzdDogL1xcLltjbV0/anN4PyQvLFxuICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnc291cmNlLW1hcC1sb2FkZXInKSxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgZmlsdGVyU291cmNlTWFwcGluZ1VybDogKF9tYXBVcmk6IHN0cmluZywgcmVzb3VyY2VQYXRoOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICBpZiAodmVuZG9yU291cmNlTWFwKSB7XG4gICAgICAgICAgICAvLyBDb25zdW1lIGFsbCBzb3VyY2VtYXBzIHdoZW4gdmVuZG9yIG9wdGlvbiBpcyBlbmFibGVkLlxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gRG9uJ3QgY29uc3VtZSBzb3VyY2VtYXBzIGluIG5vZGVfbW9kdWxlcyB3aGVuIHZlbmRvciBpcyBkaXNhYmxlZC5cbiAgICAgICAgICAvLyBCdXQsIGRvIGNvbnN1bWUgbG9jYWwgbGlicmFyaWVzIHNvdXJjZW1hcHMuXG4gICAgICAgICAgcmV0dXJuICFyZXNvdXJjZVBhdGguaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChtYWluIHx8IHBvbHlmaWxscykge1xuICAgIGV4dHJhUnVsZXMucHVzaCh7XG4gICAgICB0ZXN0OiB0c0NvbmZpZy5vcHRpb25zLmFsbG93SnMgPyAvXFwuW2NtXT9bdGpdc3g/JC8gOiAvXFwuW2NtXT90c3g/JC8sXG4gICAgICBsb2FkZXI6IEFuZ3VsYXJXZWJwYWNrTG9hZGVyUGF0aCxcbiAgICAgIC8vIFRoZSBiZWxvdyBhcmUga25vd24gcGF0aHMgdGhhdCBhcmUgbm90IHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gZXZlbiB3aGVuIGFsbG93SnMgaXMgZW5hYmxlZC5cbiAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgL1tcXFxcL11ub2RlX21vZHVsZXNbL1xcXFxdKD86Y3NzLWxvYWRlcnxtaW5pLWNzcy1leHRyYWN0LXBsdWdpbnx3ZWJwYWNrLWRldi1zZXJ2ZXJ8d2VicGFjaylbL1xcXFxdLyxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goY3JlYXRlSXZ5UGx1Z2luKHdjbywgYW90LCB0c0NvbmZpZ1BhdGgpKTtcbiAgfVxuXG4gIGlmICh3ZWJXb3JrZXJUc0NvbmZpZykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGNyZWF0ZUl2eVBsdWdpbih3Y28sIGZhbHNlLCBwYXRoLnJlc29sdmUod2NvLnJvb3QsIHdlYldvcmtlclRzQ29uZmlnKSkpO1xuICB9XG5cbiAgY29uc3QgZXh0cmFNaW5pbWl6ZXJzID0gW107XG4gIGlmIChzY3JpcHRzT3B0aW1pemF0aW9uKSB7XG4gICAgZXh0cmFNaW5pbWl6ZXJzLnB1c2goXG4gICAgICBuZXcgSmF2YVNjcmlwdE9wdGltaXplclBsdWdpbih7XG4gICAgICAgIGRlZmluZTogYnVpbGRPcHRpb25zLmFvdCA/IEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QgOiBHTE9CQUxfREVGU19GT1JfVEVSU0VSLFxuICAgICAgICBzb3VyY2VtYXA6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICAgIHRhcmdldDogc2NyaXB0VGFyZ2V0LFxuICAgICAgICBrZWVwSWRlbnRpZmllck5hbWVzOiAhYWxsb3dNYW5nbGUgfHwgaXNQbGF0Zm9ybVNlcnZlcixcbiAgICAgICAga2VlcE5hbWVzOiBpc1BsYXRmb3JtU2VydmVyLFxuICAgICAgICByZW1vdmVMaWNlbnNlczogYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcyxcbiAgICAgICAgYWR2YW5jZWQ6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAocGxhdGZvcm0gPT09ICdicm93c2VyJyAmJiAoc2NyaXB0c09wdGltaXphdGlvbiB8fCBzdHlsZXNPcHRpbWl6YXRpb24ubWluaWZ5KSkge1xuICAgIGV4dHJhTWluaW1pemVycy5wdXNoKG5ldyBUcmFuc2ZlclNpemVQbHVnaW4oKSk7XG4gIH1cblxuICBjb25zdCBleHRlcm5hbHM6IENvbmZpZ3VyYXRpb25bJ2V4dGVybmFscyddID0gWy4uLmV4dGVybmFsRGVwZW5kZW5jaWVzXTtcbiAgaWYgKGlzUGxhdGZvcm1TZXJ2ZXIgJiYgIWJ1bmRsZURlcGVuZGVuY2llcykge1xuICAgIGV4dGVybmFscy5wdXNoKCh7IGNvbnRleHQsIHJlcXVlc3QgfSwgY2FsbGJhY2spID0+XG4gICAgICBleHRlcm5hbGl6ZVBhY2thZ2VzKGNvbnRleHQgPz8gd2NvLnByb2plY3RSb290LCByZXF1ZXN0LCBjYWxsYmFjayksXG4gICAgKTtcbiAgfVxuXG4gIGxldCBjcm9zc09yaWdpbkxvYWRpbmc6IE5vbk51bGxhYmxlPENvbmZpZ3VyYXRpb25bJ291dHB1dCddPlsnY3Jvc3NPcmlnaW5Mb2FkaW5nJ10gPSBmYWxzZTtcbiAgaWYgKHN1YnJlc291cmNlSW50ZWdyaXR5ICYmIGNyb3NzT3JpZ2luID09PSAnbm9uZScpIHtcbiAgICBjcm9zc09yaWdpbkxvYWRpbmcgPSAnYW5vbnltb3VzJztcbiAgfSBlbHNlIGlmIChjcm9zc09yaWdpbiAhPT0gJ25vbmUnKSB7XG4gICAgY3Jvc3NPcmlnaW5Mb2FkaW5nID0gY3Jvc3NPcmlnaW47XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG1vZGU6IHNjcmlwdHNPcHRpbWl6YXRpb24gfHwgc3R5bGVzT3B0aW1pemF0aW9uLm1pbmlmeSA/ICdwcm9kdWN0aW9uJyA6ICdkZXZlbG9wbWVudCcsXG4gICAgZGV2dG9vbDogZmFsc2UsXG4gICAgdGFyZ2V0OiBbXG4gICAgICBpc1BsYXRmb3JtU2VydmVyID8gJ25vZGUnIDogJ3dlYicsXG4gICAgICBzY3JpcHRUYXJnZXQgPT09IFNjcmlwdFRhcmdldC5FUzUgPyAnZXM1JyA6ICdlczIwMTUnLFxuICAgIF0sXG4gICAgcHJvZmlsZTogYnVpbGRPcHRpb25zLnN0YXRzSnNvbixcbiAgICByZXNvbHZlOiB7XG4gICAgICByb290czogW3Byb2plY3RSb290XSxcbiAgICAgIGV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICBtb2R1bGVzOiBbdHNDb25maWcub3B0aW9ucy5iYXNlVXJsIHx8IHByb2plY3RSb290LCAnbm9kZV9tb2R1bGVzJ10sXG4gICAgICAuLi5nZXRNYWluRmllbGRzQW5kQ29uZGl0aW9uTmFtZXMoc2NyaXB0VGFyZ2V0LCBpc1BsYXRmb3JtU2VydmVyKSxcbiAgICB9LFxuICAgIHJlc29sdmVMb2FkZXI6IHtcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgfSxcbiAgICBjb250ZXh0OiByb290LFxuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBleHRlcm5hbHMsXG4gICAgb3V0cHV0OiB7XG4gICAgICB1bmlxdWVOYW1lOiBwcm9qZWN0TmFtZSxcbiAgICAgIGhhc2hGdW5jdGlvbjogJ3h4aGFzaDY0JywgLy8gdG9kbzogcmVtb3ZlIGluIHdlYnBhY2sgNi4gVGhpcyBpcyBwYXJ0IG9mIGBmdXR1cmVEZWZhdWx0c2AuXG4gICAgICBjbGVhbjogYnVpbGRPcHRpb25zLmRlbGV0ZU91dHB1dFBhdGggPz8gdHJ1ZSxcbiAgICAgIHBhdGg6IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCksXG4gICAgICBwdWJsaWNQYXRoOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsID8/ICcnLFxuICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICAgIGNodW5rRmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICAgIGxpYnJhcnlUYXJnZXQ6IGlzUGxhdGZvcm1TZXJ2ZXIgPyAnY29tbW9uanMnIDogdW5kZWZpbmVkLFxuICAgICAgY3Jvc3NPcmlnaW5Mb2FkaW5nLFxuICAgICAgdHJ1c3RlZFR5cGVzOiAnYW5ndWxhciNidW5kbGVyJyxcbiAgICAgIHNjcmlwdFR5cGU6ICdtb2R1bGUnLFxuICAgIH0sXG4gICAgd2F0Y2g6IGJ1aWxkT3B0aW9ucy53YXRjaCxcbiAgICB3YXRjaE9wdGlvbnM6IHtcbiAgICAgIHBvbGwsXG4gICAgICBpZ25vcmVkOiBwb2xsID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiAnKiovbm9kZV9tb2R1bGVzLyoqJyxcbiAgICB9LFxuICAgIHBlcmZvcm1hbmNlOiB7XG4gICAgICBoaW50czogZmFsc2UsXG4gICAgfSxcbiAgICBpZ25vcmVXYXJuaW5nczogW1xuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zb3VyY2UtbWFwLWxvYWRlci9ibG9iL2IyZGU0MjQ5Yzc0MzFkZDg0MzJkYTYwN2UwOGYwZjY1ZTlkNjQyMTkvc3JjL2luZGV4LmpzI0w4M1xuICAgICAgL0ZhaWxlZCB0byBwYXJzZSBzb3VyY2UgbWFwIGZyb20vLFxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9wb3N0Y3NzLWxvYWRlci9ibG9iL2JkMjYxODc1ZmRmOWM1OTZhZjRmZmIzYTFhNzNmZTNjNTQ5YmVmZGEvc3JjL2luZGV4LmpzI0wxNTMtTDE1OFxuICAgICAgL0FkZCBwb3N0Y3NzIGFzIHByb2plY3QgZGVwZW5kZW5jeS8sXG4gICAgICAvLyBlc2J1aWxkIHdpbGwgaXNzdWUgYSB3YXJuaW5nLCB3aGlsZSBzdGlsbCBob2lzdHMgdGhlIEBjaGFyc2V0IGF0IHRoZSB2ZXJ5IHRvcC5cbiAgICAgIC8vIFRoaXMgaXMgY2F1c2VkIGJ5IGEgYnVnIGluIGNzcy1sb2FkZXIgaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9jc3MtbG9hZGVyL2lzc3Vlcy8xMjEyXG4gICAgICAvXCJAY2hhcnNldFwiIG11c3QgYmUgdGhlIGZpcnN0IHJ1bGUgaW4gdGhlIGZpbGUvLFxuICAgIF0sXG4gICAgbW9kdWxlOiB7XG4gICAgICAvLyBTaG93IGFuIGVycm9yIGZvciBtaXNzaW5nIGV4cG9ydHMgaW5zdGVhZCBvZiBhIHdhcm5pbmcuXG4gICAgICBzdHJpY3RFeHBvcnRQcmVzZW5jZTogdHJ1ZSxcbiAgICAgIHBhcnNlcjoge1xuICAgICAgICBqYXZhc2NyaXB0OiB7XG4gICAgICAgICAgLy8gRGlzYWJsZSBhdXRvIFVSTCBhc3NldCBtb2R1bGUgY3JlYXRpb24uIFRoaXMgZG9lc24ndCBlZmZlY3QgYG5ldyBXb3JrZXIobmV3IFVSTCguLi4pKWBcbiAgICAgICAgICAvLyBodHRwczovL3dlYnBhY2suanMub3JnL2d1aWRlcy9hc3NldC1tb2R1bGVzLyN1cmwtYXNzZXRzXG4gICAgICAgICAgdXJsOiBmYWxzZSxcbiAgICAgICAgICB3b3JrZXI6ICEhd2ViV29ya2VyVHNDb25maWcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC4/KHN2Z3xodG1sKSQvLFxuICAgICAgICAgIC8vIE9ubHkgcHJvY2VzcyBIVE1MIGFuZCBTVkcgd2hpY2ggYXJlIGtub3duIEFuZ3VsYXIgY29tcG9uZW50IHJlc291cmNlcy5cbiAgICAgICAgICByZXNvdXJjZVF1ZXJ5OiAvXFw/bmdSZXNvdXJjZS8sXG4gICAgICAgICAgdHlwZTogJ2Fzc2V0L3NvdXJjZScsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBNYXJrIGZpbGVzIGluc2lkZSBgcnhqcy9hZGRgIGFzIGNvbnRhaW5pbmcgc2lkZSBlZmZlY3RzLlxuICAgICAgICAgIC8vIElmIHRoaXMgaXMgZml4ZWQgdXBzdHJlYW0gYW5kIHRoZSBmaXhlZCB2ZXJzaW9uIGJlY29tZXMgdGhlIG1pbmltdW1cbiAgICAgICAgICAvLyBzdXBwb3J0ZWQgdmVyc2lvbiwgdGhpcyBjYW4gYmUgcmVtb3ZlZC5cbiAgICAgICAgICB0ZXN0OiAvWy9cXFxcXXJ4anNbL1xcXFxdYWRkWy9cXFxcXS4rXFwuanMkLyxcbiAgICAgICAgICBzaWRlRWZmZWN0czogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5bY21dP1t0al1zeD8kLyxcbiAgICAgICAgICAvLyBUaGUgYmVsb3cgaXMgbmVlZGVkIGR1ZSB0byBhIGJ1ZyBpbiBgQGJhYmVsL3J1bnRpbWVgLiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9iYWJlbC9iYWJlbC9pc3N1ZXMvMTI4MjRcbiAgICAgICAgICByZXNvbHZlOiB7IGZ1bGx5U3BlY2lmaWVkOiBmYWxzZSB9LFxuICAgICAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgICAgIC9bXFxcXC9dbm9kZV9tb2R1bGVzWy9cXFxcXSg/OmNvcmUtanN8QGJhYmVsfHRzbGlifHdlYi1hbmltYXRpb25zLWpzfHdlYi1zdHJlYW1zLXBvbHlmaWxsfHdoYXR3Zy11cmwpWy9cXFxcXS8sXG4gICAgICAgICAgXSxcbiAgICAgICAgICB1c2U6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJy4uLy4uL2JhYmVsL3dlYnBhY2stbG9hZGVyJyksXG4gICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICBjYWNoZURpcmVjdG9yeTogKGNhY2hlLmVuYWJsZWQgJiYgcGF0aC5qb2luKGNhY2hlLnBhdGgsICdiYWJlbC13ZWJwYWNrJykpIHx8IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNjcmlwdFRhcmdldCxcbiAgICAgICAgICAgICAgICBhb3Q6IGJ1aWxkT3B0aW9ucy5hb3QsXG4gICAgICAgICAgICAgICAgb3B0aW1pemU6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgICAgICAgICAgICBzdXBwb3J0ZWRCcm93c2VyczogYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICAgICAgICAgIGluc3RydW1lbnRDb2RlOiBjb2RlQ292ZXJhZ2VcbiAgICAgICAgICAgICAgICAgID8ge1xuICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkQmFzZVBhdGg6IHNvdXJjZVJvb3QsXG4gICAgICAgICAgICAgICAgICAgICAgZXhjbHVkZWRQYXRoczogZ2V0SW5zdHJ1bWVudGF0aW9uRXhjbHVkZWRQYXRocyhyb290LCBjb2RlQ292ZXJhZ2VFeGNsdWRlKSxcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgIH0gYXMgQW5ndWxhckJhYmVsTG9hZGVyT3B0aW9ucyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgLi4uZXh0cmFSdWxlcyxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBleHBlcmltZW50czoge1xuICAgICAgYmFja0NvbXBhdDogZmFsc2UsXG4gICAgICBzeW5jV2ViQXNzZW1ibHk6IHRydWUsXG4gICAgICBhc3luY1dlYkFzc2VtYmx5OiB0cnVlLFxuICAgIH0sXG4gICAgaW5mcmFzdHJ1Y3R1cmVMb2dnaW5nOiB7XG4gICAgICBkZWJ1ZzogdmVyYm9zZSxcbiAgICAgIGxldmVsOiB2ZXJib3NlID8gJ3ZlcmJvc2UnIDogJ2Vycm9yJyxcbiAgICB9LFxuICAgIHN0YXRzOiBnZXRTdGF0c09wdGlvbnModmVyYm9zZSksXG4gICAgY2FjaGU6IGdldENhY2hlU2V0dGluZ3Mod2NvLCBOR19WRVJTSU9OLmZ1bGwpLFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgbWluaW1pemVyOiBleHRyYU1pbmltaXplcnMsXG4gICAgICBtb2R1bGVJZHM6ICdkZXRlcm1pbmlzdGljJyxcbiAgICAgIGNodW5rSWRzOiBidWlsZE9wdGlvbnMubmFtZWRDaHVua3MgPyAnbmFtZWQnIDogJ2RldGVybWluaXN0aWMnLFxuICAgICAgZW1pdE9uRXJyb3JzOiBmYWxzZSxcbiAgICAgIHJ1bnRpbWVDaHVuazogaXNQbGF0Zm9ybVNlcnZlciA/IGZhbHNlIDogJ3NpbmdsZScsXG4gICAgICBzcGxpdENodW5rczoge1xuICAgICAgICBtYXhBc3luY1JlcXVlc3RzOiBJbmZpbml0eSxcbiAgICAgICAgY2FjaGVHcm91cHM6IHtcbiAgICAgICAgICBkZWZhdWx0OiAhIWNvbW1vbkNodW5rICYmIHtcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIHByaW9yaXR5OiAxMCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbW1vbjogISFjb21tb25DaHVuayAmJiB7XG4gICAgICAgICAgICBuYW1lOiAnY29tbW9uJyxcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICBwcmlvcml0eTogNSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZlbmRvcnM6IGZhbHNlLFxuICAgICAgICAgIGRlZmF1bHRWZW5kb3JzOiAhIXZlbmRvckNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICd2ZW5kb3InLFxuICAgICAgICAgICAgY2h1bmtzOiAoY2h1bmspID0+IGNodW5rLm5hbWUgPT09ICdtYWluJyxcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICB0ZXN0OiAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgcGx1Z2luczogW25ldyBOYW1lZENodW5rc1BsdWdpbigpLCBuZXcgRGVkdXBlTW9kdWxlUmVzb2x2ZVBsdWdpbih7IHZlcmJvc2UgfSksIC4uLmV4dHJhUGx1Z2luc10sXG4gICAgbm9kZTogZmFsc2UsXG4gIH07XG59XG4iXX0=