"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const webpack_1 = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const utils_1 = require("./utils");
const is_directory_1 = require("../../utilities/is-directory");
const require_project_module_1 = require("../../utilities/require-project-module");
const bundle_budget_1 = require("../../plugins/bundle-budget");
const cleancss_webpack_plugin_1 = require("../../plugins/cleancss-webpack-plugin");
const scripts_webpack_plugin_1 = require("../../plugins/scripts-webpack-plugin");
const find_up_1 = require("../../utilities/find-up");
const utils_2 = require("./utils");
const ProgressPlugin = require('webpack/lib/ProgressPlugin');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const StatsPlugin = require('stats-webpack-plugin');
/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 *
 * require('source-map-loader')
 * require('raw-loader')
 * require('url-loader')
 * require('file-loader')
 * require('@angular-devkit/build-optimizer')
 */
const g = typeof global !== 'undefined' ? global : {};
exports.buildOptimizerLoader = g['_DevKitIsLocal']
    ? require.resolve('@angular-devkit/build-optimizer/src/build-optimizer/webpack-loader')
    : '@angular-devkit/build-optimizer/webpack-loader';
function getCommonConfig(wco) {
    const { root, projectRoot, buildOptions } = wco;
    const nodeModules = find_up_1.findUp('node_modules', projectRoot);
    if (!nodeModules) {
        throw new Error('Cannot locate node_modules directory.');
    }
    let extraPlugins = [];
    let entryPoints = {};
    if (buildOptions.main) {
        entryPoints['main'] = [path.resolve(root, buildOptions.main)];
    }
    if (buildOptions.polyfills) {
        entryPoints['polyfills'] = [path.resolve(root, buildOptions.polyfills)];
    }
    // determine hashing format
    const hashFormat = utils_1.getOutputHashFormat(buildOptions.outputHashing);
    // process global scripts
    if (buildOptions.scripts.length > 0) {
        const globalScriptsByBundleName = utils_2.normalizeExtraEntryPoints(buildOptions.scripts, 'scripts')
            .reduce((prev, curr) => {
            const bundleName = curr.bundleName;
            const resolvedPath = path.resolve(root, curr.input);
            let existingEntry = prev.find((el) => el.bundleName === bundleName);
            if (existingEntry) {
                if (existingEntry.lazy && !curr.lazy) {
                    // All entries have to be lazy for the bundle to be lazy.
                    throw new Error(`The ${curr.bundleName} bundle is mixing lazy and non-lazy scripts.`);
                }
                existingEntry.paths.push(resolvedPath);
            }
            else {
                prev.push({
                    bundleName,
                    paths: [resolvedPath],
                    lazy: curr.lazy
                });
            }
            return prev;
        }, []);
        // Add a new asset for each entry.
        globalScriptsByBundleName.forEach((script) => {
            // Lazy scripts don't get a hash, otherwise they can't be loaded by name.
            const hash = script.lazy ? '' : hashFormat.script;
            const bundleName = script.bundleName;
            extraPlugins.push(new scripts_webpack_plugin_1.ScriptsWebpackPlugin({
                name: bundleName,
                sourceMap: buildOptions.sourceMap,
                filename: `${path.basename(bundleName)}${hash}.js`,
                scripts: script.paths,
                basePath: projectRoot,
            }));
        });
    }
    // process asset entries
    if (buildOptions.assets) {
        const copyWebpackPluginPatterns = buildOptions.assets.map((asset) => {
            // Resolve input paths relative to workspace root and add slash at the end.
            asset.input = path.resolve(root, asset.input).replace(/\\/g, '/');
            asset.input = asset.input.endsWith('/') ? asset.input : asset.input + '/';
            asset.output = asset.output.endsWith('/') ? asset.output : asset.output + '/';
            if (asset.output.startsWith('..')) {
                const message = 'An asset cannot be written to a location outside of the output path.';
                throw new Error(message);
            }
            return {
                context: asset.input,
                // Now we remove starting slash to make Webpack place it from the output root.
                to: asset.output.replace(/^\//, ''),
                from: {
                    glob: asset.glob,
                    dot: true
                }
            };
        });
        const copyWebpackPluginOptions = { ignore: ['.gitkeep', '**/.DS_Store', '**/Thumbs.db'] };
        const copyWebpackPluginInstance = new CopyWebpackPlugin(copyWebpackPluginPatterns, copyWebpackPluginOptions);
        // Save options so we can use them in eject.
        copyWebpackPluginInstance['copyWebpackPluginPatterns'] = copyWebpackPluginPatterns;
        copyWebpackPluginInstance['copyWebpackPluginOptions'] = copyWebpackPluginOptions;
        extraPlugins.push(copyWebpackPluginInstance);
    }
    if (buildOptions.progress) {
        extraPlugins.push(new ProgressPlugin({ profile: buildOptions.verbose, colors: true }));
    }
    if (buildOptions.showCircularDependencies) {
        extraPlugins.push(new CircularDependencyPlugin({
            exclude: /[\\\/]node_modules[\\\/]/
        }));
    }
    if (buildOptions.statsJson) {
        extraPlugins.push(new StatsPlugin('stats.json', 'verbose'));
    }
    let sourceMapUseRule;
    if (buildOptions.sourceMap && buildOptions.vendorSourceMap) {
        sourceMapUseRule = {
            use: [
                {
                    loader: 'source-map-loader'
                }
            ]
        };
    }
    let buildOptimizerUseRule;
    if (buildOptions.buildOptimizer) {
        buildOptimizerUseRule = {
            use: [
                {
                    loader: exports.buildOptimizerLoader,
                    options: { sourceMap: buildOptions.sourceMap }
                },
            ],
        };
    }
    // Allow loaders to be in a node_modules nested inside the devkit/build-angular package.
    // This is important in case loaders do not get hoisted.
    // If this file moves to another location, alter potentialNodeModules as well.
    const loaderNodeModules = ['node_modules'];
    const buildAngularNodeModules = find_up_1.findUp('node_modules', __dirname);
    if (buildAngularNodeModules
        && is_directory_1.isDirectory(buildAngularNodeModules)
        && buildAngularNodeModules !== nodeModules
        && buildAngularNodeModules.startsWith(nodeModules)) {
        loaderNodeModules.push(buildAngularNodeModules);
    }
    // Load rxjs path aliases.
    // https://github.com/ReactiveX/rxjs/blob/master/doc/lettable-operators.md#build-and-treeshaking
    let alias = {};
    try {
        const rxjsPathMappingImport = wco.supportES2015
            ? 'rxjs/_esm2015/path-mapping'
            : 'rxjs/_esm5/path-mapping';
        const rxPaths = require_project_module_1.requireProjectModule(projectRoot, rxjsPathMappingImport);
        alias = rxPaths(nodeModules);
    }
    catch (_a) { }
    const isIvyEnabled = wco.tsConfig.raw.angularCompilerOptions
        && wco.tsConfig.raw.angularCompilerOptions.enableIvy;
    const terserOptions = Object.assign({ ecma: wco.supportES2015 ? 6 : 5, warnings: !!buildOptions.verbose, safari10: true, output: {
            ascii_only: true,
            comments: false,
            webkit: true,
        }, 
        // On server, we don't want to compress anything. We still set the ngDevMode = false for it
        // to remove dev code.
        compress: (buildOptions.platform == 'server' ? {
            global_defs: {
                ngDevMode: false,
            },
        } : {
            pure_getters: buildOptions.buildOptimizer,
            // PURE comments work best with 3 passes.
            // See https://github.com/webpack/webpack/issues/2899#issuecomment-317425926.
            passes: buildOptions.buildOptimizer ? 3 : 1,
            // Workaround known uglify-es issue
            // See https://github.com/mishoo/UglifyJS2/issues/2949#issuecomment-368070307
            inline: wco.supportES2015 ? 1 : 3,
            global_defs: {
                ngDevMode: false,
            },
        }) }, (buildOptions.platform == 'server' ? { mangle: false } : {}));
    return {
        mode: buildOptions.optimization ? 'production' : 'development',
        devtool: false,
        resolve: {
            extensions: ['.ts', '.tsx', '.mjs', '.js'],
            symlinks: !buildOptions.preserveSymlinks,
            modules: [
                wco.tsConfig.options.baseUrl || projectRoot,
                'node_modules',
            ],
            alias
        },
        resolveLoader: {
            modules: loaderNodeModules
        },
        context: projectRoot,
        entry: entryPoints,
        output: {
            path: path.resolve(root, buildOptions.outputPath),
            publicPath: buildOptions.deployUrl,
            filename: `[name]${hashFormat.chunk}.js`,
        },
        watch: buildOptions.watch,
        watchOptions: {
            poll: buildOptions.poll
        },
        performance: {
            hints: false,
        },
        module: {
            rules: [
                { test: /\.html$/, loader: 'raw-loader' },
                {
                    test: /\.(eot|svg|cur)$/,
                    loader: 'file-loader',
                    options: {
                        name: `[name]${hashFormat.file}.[ext]`,
                        limit: 10000
                    }
                },
                {
                    test: /\.(jpg|png|webp|gif|otf|ttf|woff|woff2|ani)$/,
                    loader: 'url-loader',
                    options: {
                        name: `[name]${hashFormat.file}.[ext]`,
                        limit: 10000
                    }
                },
                {
                    // Mark files inside `@angular/core` as using SystemJS style dynamic imports.
                    // Removing this will cause deprecation warnings to appear.
                    test: /[\/\\]@angular[\/\\]core[\/\\].+\.js$/,
                    parser: { system: true },
                },
                Object.assign({ test: /\.js$/ }, buildOptimizerUseRule),
                Object.assign({ test: /\.js$/, exclude: /(ngfactory|ngstyle).js$/, enforce: 'pre' }, sourceMapUseRule),
            ]
        },
        optimization: {
            noEmitOnErrors: true,
            minimizer: [
                new webpack_1.HashedModuleIdsPlugin(),
                // TODO: check with Mike what this feature needs.
                new bundle_budget_1.BundleBudgetPlugin({ budgets: buildOptions.budgets }),
                new cleancss_webpack_plugin_1.CleanCssWebpackPlugin({
                    sourceMap: buildOptions.sourceMap,
                    // component styles retain their original file name
                    test: (file) => /\.(?:css|scss|sass|less|styl)$/.test(file),
                }),
                new TerserPlugin({
                    sourceMap: buildOptions.sourceMap,
                    parallel: true,
                    cache: true,
                    terserOptions,
                }),
            ],
        },
        plugins: extraPlugins,
    };
}
exports.getCommonConfig = getCommonConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HO0FBQ0gsaUJBQWlCO0FBQ2pCLCtEQUErRDs7QUFFL0QsNkJBQTZCO0FBQzdCLHFDQUFnRDtBQUNoRCx5REFBeUQ7QUFDekQsbUNBQThDO0FBQzlDLCtEQUEyRDtBQUMzRCxtRkFBOEU7QUFFOUUsK0RBQWlFO0FBQ2pFLG1GQUE4RTtBQUM5RSxpRkFBNEU7QUFDNUUscURBQWlEO0FBRWpELG1DQUFvRDtBQUVwRCxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUM3RCxNQUFNLHdCQUF3QixHQUFHLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBQ3ZFLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO0FBQ3RELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBRXBEOzs7Ozs7Ozs7R0FTRztBQUVILE1BQU0sQ0FBQyxHQUFRLE9BQU8sTUFBTSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDOUMsUUFBQSxvQkFBb0IsR0FBVyxDQUFDLENBQUMsZ0JBQWdCLENBQUM7SUFDN0QsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsb0VBQW9FLENBQUM7SUFDdkYsQ0FBQyxDQUFDLGdEQUFnRCxDQUFDO0FBRXJELHlCQUFnQyxHQUF5QjtJQUN2RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFFaEQsTUFBTSxXQUFXLEdBQUcsZ0JBQU0sQ0FBQyxjQUFj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RTtpQkFDekI7Z0NBRUMsSUFBSSxFQUFFLE9BQU8sSUFDVixxQkFBcUI7Z0NBR3hCLElBQUksRUFBRSxPQUFPLEVBQ2IsT0FBTyxFQUFFLHlCQUF5QixFQUNsQyxPQUFPLEVBQUUsS0FBSyxJQUNYLGdCQUFnQjthQUV0QjtTQUNGO1FBQ0QsWUFBWSxFQUFFO1lBQ1osY0FBYyxFQUFFLElBQUk7WUFDcEIsU0FBUyxFQUFFO2dCQUNULElBQUksK0JBQXFCLEVBQUU7Z0JBQzNCLGlEQUFpRDtnQkFDakQsSUFBSSxrQ0FBa0IsQ0FBQyxFQUFFLE9BQU8sRUFBRSxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3pELElBQUksK0NBQXFCLENBQUM7b0JBQ3hCLFNBQVMsRUFBRSxZQUFZLENBQUMsU0FBUztvQkFDakMsbURBQW1EO29CQUNuRCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLGdDQUFnQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7aUJBQzVELENBQUM7Z0JBQ0YsSUFBSSxZQUFZLENBQUM7b0JBQ2YsU0FBUyxFQUFFLFlBQVksQ0FBQyxTQUFTO29CQUNqQyxRQUFRLEVBQUUsSUFBSTtvQkFDZCxLQUFLLEVBQUUsSUFBSTtvQkFDWCxhQUFhO2lCQUNkLENBQUM7YUFDSDtTQUNGO1FBQ0QsT0FBTyxFQUFFLFlBQVk7S0FDdEIsQ0FBQztBQUNKLENBQUM7QUE3UkQsMENBNlJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgSGFzaGVkTW9kdWxlSWRzUGx1Z2luIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgKiBhcyBDb3B5V2VicGFja1BsdWdpbiBmcm9tICdjb3B5LXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IGdldE91dHB1dEhhc2hGb3JtYXQgfSBmcm9tICcuL3V0aWxzJztcbmltcG9ydCB7IGlzRGlyZWN0b3J5IH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL2lzLWRpcmVjdG9yeSc7XG5pbXBvcnQgeyByZXF1aXJlUHJvamVjdE1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9yZXF1aXJlLXByb2plY3QtbW9kdWxlJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBCdW5kbGVCdWRnZXRQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL2J1bmRsZS1idWRnZXQnO1xuaW1wb3J0IHsgQ2xlYW5Dc3NXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9jbGVhbmNzcy13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgeyBTY3JpcHRzV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvc2NyaXB0cy13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgeyBmaW5kVXAgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvZmluZC11cCc7XG5pbXBvcnQgeyBBc3NldFBhdHRlcm5PYmplY3QsIEV4dHJhRW50cnlQb2ludCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMgfSBmcm9tICcuL3V0aWxzJztcblxuY29uc3QgUHJvZ3Jlc3NQbHVnaW4gPSByZXF1aXJlKCd3ZWJwYWNrL2xpYi9Qcm9ncmVzc1BsdWdpbicpO1xuY29uc3QgQ2lyY3VsYXJEZXBlbmRlbmN5UGx1Z2luID0gcmVxdWlyZSgnY2lyY3VsYXItZGVwZW5kZW5jeS1wbHVnaW4nKTtcbmNvbnN0IFRlcnNlclBsdWdpbiA9IHJlcXVpcmUoJ3RlcnNlci13ZWJwYWNrLXBsdWdpbicpO1xuY29uc3QgU3RhdHNQbHVnaW4gPSByZXF1aXJlKCdzdGF0cy13ZWJwYWNrLXBsdWdpbicpO1xuXG4vKipcbiAqIEVudW1lcmF0ZSBsb2FkZXJzIGFuZCB0aGVpciBkZXBlbmRlbmNpZXMgZnJvbSB0aGlzIGZpbGUgdG8gbGV0IHRoZSBkZXBlbmRlbmN5IHZhbGlkYXRvclxuICoga25vdyB0aGV5IGFyZSB1c2VkLlxuICpcbiAqIHJlcXVpcmUoJ3NvdXJjZS1tYXAtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ3Jhdy1sb2FkZXInKVxuICogcmVxdWlyZSgndXJsLWxvYWRlcicpXG4gKiByZXF1aXJlKCdmaWxlLWxvYWRlcicpXG4gKiByZXF1aXJlKCdAYW5ndWxhci1kZXZraXQvYnVpbGQtb3B0aW1pemVyJylcbiAqL1xuXG5jb25zdCBnOiBhbnkgPSB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6IHt9O1xuZXhwb3J0IGNvbnN0IGJ1aWxkT3B0aW1pemVyTG9hZGVyOiBzdHJpbmcgPSBnWydfRGV2S2l0SXNMb2NhbCddXG4gID8gcmVxdWlyZS5yZXNvbHZlKCdAYW5ndWxhci1kZXZraXQvYnVpbGQtb3B0aW1pemVyL3NyYy9idWlsZC1vcHRpbWl6ZXIvd2VicGFjay1sb2FkZXInKVxuICA6ICdAYW5ndWxhci1kZXZraXQvYnVpbGQtb3B0aW1pemVyL3dlYnBhY2stbG9hZGVyJztcblxuZXhwb3J0IGZ1bmN0aW9uIGdldENvbW1vbkNvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKSB7XG4gIGNvbnN0IHsgcm9vdCwgcHJvamVjdFJvb3QsIGJ1aWxkT3B0aW9ucyB9ID0gd2NvO1xuXG4gIGNvbnN0IG5vZGVNb2R1bGVzID0gZmluZFVwKCdub2RlX21vZHVsZXMnLCBwcm9qZWN0Um9vdCk7XG4gIGlmICghbm9kZU1vZHVsZXMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBsb2NhdGUgbm9kZV9tb2R1bGVzIGRpcmVjdG9yeS4nKVxuICB9XG5cbiAgbGV0IGV4dHJhUGx1Z2luczogYW55W10gPSBbXTtcbiAgbGV0IGVudHJ5UG9pbnRzOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZ1tdIH0gPSB7fTtcblxuICBpZiAoYnVpbGRPcHRpb25zLm1haW4pIHtcbiAgICBlbnRyeVBvaW50c1snbWFpbiddID0gW3BhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMubWFpbildO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5wb2x5ZmlsbHMpIHtcbiAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10gPSBbcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5wb2x5ZmlsbHMpXTtcbiAgfVxuXG4gIC8vIGRldGVybWluZSBoYXNoaW5nIGZvcm1hdFxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyBhcyBhbnkpO1xuXG4gIC8vIHByb2Nlc3MgZ2xvYmFsIHNjcmlwdHNcbiAgaWYgKGJ1aWxkT3B0aW9ucy5zY3JpcHRzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lID0gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhidWlsZE9wdGlvbnMuc2NyaXB0cywgJ3NjcmlwdHMnKVxuICAgICAgLnJlZHVjZSgocHJldjogeyBidW5kbGVOYW1lOiBzdHJpbmcsIHBhdGhzOiBzdHJpbmdbXSwgbGF6eTogYm9vbGVhbiB9W10sIGN1cnIpID0+IHtcbiAgICAgICAgY29uc3QgYnVuZGxlTmFtZSA9IGN1cnIuYnVuZGxlTmFtZTtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWRQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIGN1cnIuaW5wdXQpO1xuICAgICAgICBsZXQgZXhpc3RpbmdFbnRyeSA9IHByZXYuZmluZCgoZWwpID0+IGVsLmJ1bmRsZU5hbWUgPT09IGJ1bmRsZU5hbWUpO1xuICAgICAgICBpZiAoZXhpc3RpbmdFbnRyeSkge1xuICAgICAgICAgIGlmIChleGlzdGluZ0VudHJ5LmxhenkgJiYgIWN1cnIubGF6eSkge1xuICAgICAgICAgICAgLy8gQWxsIGVudHJpZXMgaGF2ZSB0byBiZSBsYXp5IGZvciB0aGUgYnVuZGxlIHRvIGJlIGxhenkuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSAke2N1cnIuYnVuZGxlTmFtZX0gYnVuZGxlIGlzIG1peGluZyBsYXp5IGFuZCBub24tbGF6eSBzY3JpcHRzLmApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGV4aXN0aW5nRW50cnkucGF0aHMucHVzaChyZXNvbHZlZFBhdGgpO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJldi5wdXNoKHtcbiAgICAgICAgICAgIGJ1bmRsZU5hbWUsXG4gICAgICAgICAgICBwYXRoczogW3Jlc29sdmVkUGF0aF0sXG4gICAgICAgICAgICBsYXp5OiBjdXJyLmxhenlcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcHJldjtcbiAgICAgIH0sIFtdKTtcblxuXG4gICAgLy8gQWRkIGEgbmV3IGFzc2V0IGZvciBlYWNoIGVudHJ5LlxuICAgIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUuZm9yRWFjaCgoc2NyaXB0KSA9PiB7XG4gICAgICAvLyBMYXp5IHNjcmlwdHMgZG9uJ3QgZ2V0IGEgaGFzaCwgb3RoZXJ3aXNlIHRoZXkgY2FuJ3QgYmUgbG9hZGVkIGJ5IG5hbWUuXG4gICAgICBjb25zdCBoYXNoID0gc2NyaXB0LmxhenkgPyAnJyA6IGhhc2hGb3JtYXQuc2NyaXB0O1xuICAgICAgY29uc3QgYnVuZGxlTmFtZSA9IHNjcmlwdC5idW5kbGVOYW1lO1xuXG4gICAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU2NyaXB0c1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICBuYW1lOiBidW5kbGVOYW1lLFxuICAgICAgICBzb3VyY2VNYXA6IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAsXG4gICAgICAgIGZpbGVuYW1lOiBgJHtwYXRoLmJhc2VuYW1lKGJ1bmRsZU5hbWUpfSR7aGFzaH0uanNgLFxuICAgICAgICBzY3JpcHRzOiBzY3JpcHQucGF0aHMsXG4gICAgICAgIGJhc2VQYXRoOiBwcm9qZWN0Um9vdCxcbiAgICAgIH0pKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgYXNzZXQgZW50cmllc1xuICBpZiAoYnVpbGRPcHRpb25zLmFzc2V0cykge1xuICAgIGNvbnN0IGNvcHlXZWJwYWNrUGx1Z2luUGF0dGVybnMgPSBidWlsZE9wdGlvbnMuYXNzZXRzLm1hcCgoYXNzZXQ6IEFzc2V0UGF0dGVybk9iamVjdCkgPT4ge1xuXG4gICAgICAvLyBSZXNvbHZlIGlucHV0IHBhdGhzIHJlbGF0aXZlIHRvIHdvcmtzcGFjZSByb290IGFuZCBhZGQgc2xhc2ggYXQgdGhlIGVuZC5cbiAgICAgIGFzc2V0LmlucHV0ID0gcGF0aC5yZXNvbHZlKHJvb3QsIGFzc2V0LmlucHV0KS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgICBhc3NldC5pbnB1dCA9IGFzc2V0LmlucHV0LmVuZHNXaXRoKCcvJykgPyBhc3NldC5pbnB1dCA6IGFzc2V0LmlucHV0ICsgJy8nO1xuICAgICAgYXNzZXQub3V0cHV0ID0gYXNzZXQub3V0cHV0LmVuZHNXaXRoKCcvJykgPyBhc3NldC5vdXRwdXQgOiBhc3NldC5vdXRwdXQgKyAnLyc7XG5cbiAgICAgIGlmIChhc3NldC5vdXRwdXQuc3RhcnRzV2l0aCgnLi4nKSkge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gJ0FuIGFzc2V0IGNhbm5vdCBiZSB3cml0dGVuIHRvIGEgbG9jYXRpb24gb3V0c2lkZSBvZiB0aGUgb3V0cHV0IHBhdGguJztcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBjb250ZXh0OiBhc3NldC5pbnB1dCxcbiAgICAgICAgLy8gTm93IHdlIHJlbW92ZSBzdGFydGluZyBzbGFzaCB0byBtYWtlIFdlYnBhY2sgcGxhY2UgaXQgZnJvbSB0aGUgb3V0cHV0IHJvb3QuXG4gICAgICAgIHRvOiBhc3NldC5vdXRwdXQucmVwbGFjZSgvXlxcLy8sICcnKSxcbiAgICAgICAgZnJvbToge1xuICAgICAgICAgIGdsb2I6IGFzc2V0Lmdsb2IsXG4gICAgICAgICAgZG90OiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG5cbiAgICBjb25zdCBjb3B5V2VicGFja1BsdWdpbk9wdGlvbnMgPSB7IGlnbm9yZTogWycuZ2l0a2VlcCcsICcqKi8uRFNfU3RvcmUnLCAnKiovVGh1bWJzLmRiJ10gfTtcblxuICAgIGNvbnN0IGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UgPSBuZXcgQ29weVdlYnBhY2tQbHVnaW4oY29weVdlYnBhY2tQbHVnaW5QYXR0ZXJucyxcbiAgICAgIGNvcHlXZWJwYWNrUGx1Z2luT3B0aW9ucyk7XG5cbiAgICAvLyBTYXZlIG9wdGlvbnMgc28gd2UgY2FuIHVzZSB0aGVtIGluIGVqZWN0LlxuICAgIChjb3B5V2VicGFja1BsdWdpbkluc3RhbmNlIGFzIGFueSlbJ2NvcHlXZWJwYWNrUGx1Z2luUGF0dGVybnMnXSA9IGNvcHlXZWJwYWNrUGx1Z2luUGF0dGVybnM7XG4gICAgKGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UgYXMgYW55KVsnY29weVdlYnBhY2tQbHVnaW5PcHRpb25zJ10gPSBjb3B5V2VicGFja1BsdWdpbk9wdGlvbnM7XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChjb3B5V2VicGFja1BsdWdpbkluc3RhbmNlKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMucHJvZ3Jlc3MpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgUHJvZ3Jlc3NQbHVnaW4oeyBwcm9maWxlOiBidWlsZE9wdGlvbnMudmVyYm9zZSwgY29sb3JzOiB0cnVlIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc2hvd0NpcmN1bGFyRGVwZW5kZW5jaWVzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IENpcmN1bGFyRGVwZW5kZW5jeVBsdWdpbih7XG4gICAgICBleGNsdWRlOiAvW1xcXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFxcXC9dL1xuICAgIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3RhdHNKc29uKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN0YXRzUGx1Z2luKCdzdGF0cy5qc29uJywgJ3ZlcmJvc2UnKSk7XG4gIH1cblxuICBsZXQgc291cmNlTWFwVXNlUnVsZTtcbiAgaWYgKGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAgJiYgYnVpbGRPcHRpb25zLnZlbmRvclNvdXJjZU1hcCkge1xuICAgIHNvdXJjZU1hcFVzZVJ1bGUgPSB7XG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogJ3NvdXJjZS1tYXAtbG9hZGVyJ1xuICAgICAgICB9XG4gICAgICBdXG4gICAgfVxuICB9XG5cbiAgbGV0IGJ1aWxkT3B0aW1pemVyVXNlUnVsZTtcbiAgaWYgKGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcikge1xuICAgIGJ1aWxkT3B0aW1pemVyVXNlUnVsZSA9IHtcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiBidWlsZE9wdGltaXplckxvYWRlcixcbiAgICAgICAgICBvcHRpb25zOiB7IHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCB9XG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH07XG4gIH1cblxuICAvLyBBbGxvdyBsb2FkZXJzIHRvIGJlIGluIGEgbm9kZV9tb2R1bGVzIG5lc3RlZCBpbnNpZGUgdGhlIGRldmtpdC9idWlsZC1hbmd1bGFyIHBhY2thZ2UuXG4gIC8vIFRoaXMgaXMgaW1wb3J0YW50IGluIGNhc2UgbG9hZGVycyBkbyBub3QgZ2V0IGhvaXN0ZWQuXG4gIC8vIElmIHRoaXMgZmlsZSBtb3ZlcyB0byBhbm90aGVyIGxvY2F0aW9uLCBhbHRlciBwb3RlbnRpYWxOb2RlTW9kdWxlcyBhcyB3ZWxsLlxuICBjb25zdCBsb2FkZXJOb2RlTW9kdWxlcyA9IFsnbm9kZV9tb2R1bGVzJ107XG4gIGNvbnN0IGJ1aWxkQW5ndWxhck5vZGVNb2R1bGVzID0gZmluZFVwKCdub2RlX21vZHVsZXMnLCBfX2Rpcm5hbWUpO1xuICBpZiAoYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXNcbiAgICAmJiBpc0RpcmVjdG9yeShidWlsZEFuZ3VsYXJOb2RlTW9kdWxlcylcbiAgICAmJiBidWlsZEFuZ3VsYXJOb2RlTW9kdWxlcyAhPT0gbm9kZU1vZHVsZXNcbiAgICAmJiBidWlsZEFuZ3VsYXJOb2RlTW9kdWxlcy5zdGFydHNXaXRoKG5vZGVNb2R1bGVzKVxuICApIHtcbiAgICBsb2FkZXJOb2RlTW9kdWxlcy5wdXNoKGJ1aWxkQW5ndWxhck5vZGVNb2R1bGVzKTtcbiAgfVxuXG4gIC8vIExvYWQgcnhqcyBwYXRoIGFsaWFzZXMuXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9ibG9iL21hc3Rlci9kb2MvbGV0dGFibGUtb3BlcmF0b3JzLm1kI2J1aWxkLWFuZC10cmVlc2hha2luZ1xuICBsZXQgYWxpYXMgPSB7fTtcbiAgdHJ5IHtcbiAgICBjb25zdCByeGpzUGF0aE1hcHBpbmdJbXBvcnQgPSB3Y28uc3VwcG9ydEVTMjAxNVxuICAgICAgPyAncnhqcy9fZXNtMjAxNS9wYXRoLW1hcHBpbmcnXG4gICAgICA6ICdyeGpzL19lc201L3BhdGgtbWFwcGluZyc7XG4gICAgY29uc3QgcnhQYXRocyA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKHByb2plY3RSb290LCByeGpzUGF0aE1hcHBpbmdJbXBvcnQpO1xuICAgIGFsaWFzID0gcnhQYXRocyhub2RlTW9kdWxlcyk7XG4gIH0gY2F0Y2ggeyB9XG5cbiAgY29uc3QgaXNJdnlFbmFibGVkID0gd2NvLnRzQ29uZmlnLnJhdy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zXG4gICAgICAgICAgICAgICAgICAgICYmIHdjby50c0NvbmZpZy5yYXcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5lbmFibGVJdnk7XG5cbiAgY29uc3QgdGVyc2VyT3B0aW9ucyA9IHtcbiAgICBlY21hOiB3Y28uc3VwcG9ydEVTMjAxNSA/IDYgOiA1LFxuICAgIHdhcm5pbmdzOiAhIWJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgIHNhZmFyaTEwOiB0cnVlLFxuICAgIG91dHB1dDoge1xuICAgICAgYXNjaWlfb25seTogdHJ1ZSxcbiAgICAgIGNvbW1lbnRzOiBmYWxzZSxcbiAgICAgIHdlYmtpdDogdHJ1ZSxcbiAgICB9LFxuXG4gICAgLy8gT24gc2VydmVyLCB3ZSBkb24ndCB3YW50IHRvIGNvbXByZXNzIGFueXRoaW5nLiBXZSBzdGlsbCBzZXQgdGhlIG5nRGV2TW9kZSA9IGZhbHNlIGZvciBpdFxuICAgIC8vIHRvIHJlbW92ZSBkZXYgY29kZS5cbiAgICBjb21wcmVzczogKGJ1aWxkT3B0aW9ucy5wbGF0Zm9ybSA9PSAnc2VydmVyJyA/IHtcbiAgICAgIGdsb2JhbF9kZWZzOiB7XG4gICAgICAgIG5nRGV2TW9kZTogZmFsc2UsXG4gICAgICB9LFxuICAgIH0gOiB7XG4gICAgICBwdXJlX2dldHRlcnM6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgIC8vIFBVUkUgY29tbWVudHMgd29yayBiZXN0IHdpdGggMyBwYXNzZXMuXG4gICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay9pc3N1ZXMvMjg5OSNpc3N1ZWNvbW1lbnQtMzE3NDI1OTI2LlxuICAgICAgcGFzc2VzOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIgPyAzIDogMSxcbiAgICAgIC8vIFdvcmthcm91bmQga25vd24gdWdsaWZ5LWVzIGlzc3VlXG4gICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21pc2hvby9VZ2xpZnlKUzIvaXNzdWVzLzI5NDkjaXNzdWVjb21tZW50LTM2ODA3MDMwN1xuICAgICAgaW5saW5lOiB3Y28uc3VwcG9ydEVTMjAxNSA/IDEgOiAzLFxuXG4gICAgICBnbG9iYWxfZGVmczoge1xuICAgICAgICBuZ0Rldk1vZGU6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9KSxcbiAgICAvLyBXZSBhbHNvIHdhbnQgdG8gYXZvaWQgbWFuZ2xpbmcgb24gc2VydmVyLlxuICAgIC4uLihidWlsZE9wdGlvbnMucGxhdGZvcm0gPT0gJ3NlcnZlcicgPyB7IG1hbmdsZTogZmFsc2UgfSA6IHt9KSxcbiAgfTtcblxuICByZXR1cm4ge1xuICAgIG1vZGU6IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24gPyAncHJvZHVjdGlvbicgOiAnZGV2ZWxvcG1lbnQnLFxuICAgIGRldnRvb2w6IGZhbHNlLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICBtb2R1bGVzOiBbXG4gICAgICAgIHdjby50c0NvbmZpZy5vcHRpb25zLmJhc2VVcmwgfHwgcHJvamVjdFJvb3QsXG4gICAgICAgICdub2RlX21vZHVsZXMnLFxuICAgICAgXSxcbiAgICAgIGFsaWFzXG4gICAgfSxcbiAgICByZXNvbHZlTG9hZGVyOiB7XG4gICAgICBtb2R1bGVzOiBsb2FkZXJOb2RlTW9kdWxlc1xuICAgIH0sXG4gICAgY29udGV4dDogcHJvamVjdFJvb3QsXG4gICAgZW50cnk6IGVudHJ5UG9pbnRzLFxuICAgIG91dHB1dDoge1xuICAgICAgcGF0aDogcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoIGFzIHN0cmluZyksXG4gICAgICBwdWJsaWNQYXRoOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICB9LFxuICAgIHdhdGNoOiBidWlsZE9wdGlvbnMud2F0Y2gsXG4gICAgd2F0Y2hPcHRpb25zOiB7XG4gICAgICBwb2xsOiBidWlsZE9wdGlvbnMucG9sbFxuICAgIH0sXG4gICAgcGVyZm9ybWFuY2U6IHtcbiAgICAgIGhpbnRzOiBmYWxzZSxcbiAgICB9LFxuICAgIG1vZHVsZToge1xuICAgICAgcnVsZXM6IFtcbiAgICAgICAgeyB0ZXN0OiAvXFwuaHRtbCQvLCBsb2FkZXI6ICdyYXctbG9hZGVyJyB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLihlb3R8c3ZnfGN1cikkLyxcbiAgICAgICAgICBsb2FkZXI6ICdmaWxlLWxvYWRlcicsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5maWxlfS5bZXh0XWAsXG4gICAgICAgICAgICBsaW1pdDogMTAwMDBcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuKGpwZ3xwbmd8d2VicHxnaWZ8b3RmfHR0Znx3b2ZmfHdvZmYyfGFuaSkkLyxcbiAgICAgICAgICBsb2FkZXI6ICd1cmwtbG9hZGVyJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmZpbGV9LltleHRdYCxcbiAgICAgICAgICAgIGxpbWl0OiAxMDAwMFxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIC8vIE1hcmsgZmlsZXMgaW5zaWRlIGBAYW5ndWxhci9jb3JlYCBhcyB1c2luZyBTeXN0ZW1KUyBzdHlsZSBkeW5hbWljIGltcG9ydHMuXG4gICAgICAgICAgLy8gUmVtb3ZpbmcgdGhpcyB3aWxsIGNhdXNlIGRlcHJlY2F0aW9uIHdhcm5pbmdzIHRvIGFwcGVhci5cbiAgICAgICAgICB0ZXN0OiAvW1xcL1xcXFxdQGFuZ3VsYXJbXFwvXFxcXF1jb3JlW1xcL1xcXFxdLitcXC5qcyQvLFxuICAgICAgICAgIHBhcnNlcjogeyBzeXN0ZW06IHRydWUgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5qcyQvLFxuICAgICAgICAgIC4uLmJ1aWxkT3B0aW1pemVyVXNlUnVsZSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5qcyQvLFxuICAgICAgICAgIGV4Y2x1ZGU6IC8obmdmYWN0b3J5fG5nc3R5bGUpLmpzJC8sXG4gICAgICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICAgICAgLi4uc291cmNlTWFwVXNlUnVsZSxcbiAgICAgICAgfSxcbiAgICAgIF1cbiAgICB9LFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgbm9FbWl0T25FcnJvcnM6IHRydWUsXG4gICAgICBtaW5pbWl6ZXI6IFtcbiAgICAgICAgbmV3IEhhc2hlZE1vZHVsZUlkc1BsdWdpbigpLFxuICAgICAgICAvLyBUT0RPOiBjaGVjayB3aXRoIE1pa2Ugd2hhdCB0aGlzIGZlYXR1cmUgbmVlZHMuXG4gICAgICAgIG5ldyBCdW5kbGVCdWRnZXRQbHVnaW4oeyBidWRnZXRzOiBidWlsZE9wdGlvbnMuYnVkZ2V0cyB9KSxcbiAgICAgICAgbmV3IENsZWFuQ3NzV2VicGFja1BsdWdpbih7XG4gICAgICAgICAgc291cmNlTWFwOiBidWlsZE9wdGlvbnMuc291cmNlTWFwLFxuICAgICAgICAgIC8vIGNvbXBvbmVudCBzdHlsZXMgcmV0YWluIHRoZWlyIG9yaWdpbmFsIGZpbGUgbmFtZVxuICAgICAgICAgIHRlc3Q6IChmaWxlKSA9PiAvXFwuKD86Y3NzfHNjc3N8c2Fzc3xsZXNzfHN0eWwpJC8udGVzdChmaWxlKSxcbiAgICAgICAgfSksXG4gICAgICAgIG5ldyBUZXJzZXJQbHVnaW4oe1xuICAgICAgICAgIHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCxcbiAgICAgICAgICBwYXJhbGxlbDogdHJ1ZSxcbiAgICAgICAgICBjYWNoZTogdHJ1ZSxcbiAgICAgICAgICB0ZXJzZXJPcHRpb25zLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gIH07XG59XG4iXX0=