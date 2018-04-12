"use strict";
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
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const StatsPlugin = require('stats-webpack-plugin');
const SilentError = require('silent-error');
const resolve = require('resolve');
/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 *
 * require('source-map-loader')
 * require('raw-loader')
 * require('url-loader')
 * require('file-loader')
 * require('cache-loader')
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
                const message = 'An asset cannot be written to a location outside of the . '
                    + 'You can override this message by setting the `allowOutsideOutDir` '
                    + 'property on the asset to true in the CLI configuration.';
                throw new Error(message);
            }
            if (asset.output.startsWith('/')) {
                // Now we remove starting slash to make Webpack place it from the output root.
                asset.output = asset.output.slice(1);
            }
            return {
                context: asset.input,
                to: asset.output,
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
    let buildOptimizerUseRule;
    if (buildOptions.buildOptimizer) {
        // Set the cache directory to the Build Optimizer dir, so that package updates will delete it.
        const buildOptimizerDir = g['_DevKitIsLocal']
            ? nodeModules
            : path.dirname(resolve.sync('@angular-devkit/build-optimizer', { basedir: projectRoot }));
        const cacheDirectory = path.resolve(buildOptimizerDir, './.cache/');
        buildOptimizerUseRule = {
            use: [
                {
                    loader: 'cache-loader',
                    options: { cacheDirectory }
                },
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
    catch (e) { }
    return {
        mode: buildOptions.optimization ? 'production' : 'development',
        devtool: false,
        resolve: {
            extensions: ['.ts', '.js'],
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
                Object.assign({ test: /[\/\\]@angular[\/\\].+\.js$/, sideEffects: false, parser: { system: true } }, buildOptimizerUseRule),
                Object.assign({ test: /\.js$/ }, buildOptimizerUseRule),
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
                new UglifyJSPlugin({
                    sourceMap: buildOptions.sourceMap,
                    parallel: true,
                    cache: true,
                    uglifyOptions: {
                        ecma: wco.supportES2015 ? 6 : 5,
                        warnings: buildOptions.verbose,
                        safari10: true,
                        compress: {
                            pure_getters: buildOptions.buildOptimizer,
                            // PURE comments work best with 3 passes.
                            // See https://github.com/webpack/webpack/issues/2899#issuecomment-317425926.
                            passes: buildOptions.buildOptimizer ? 3 : 1,
                            // Workaround known uglify-es issue
                            // See https://github.com/mishoo/UglifyJS2/issues/2949#issuecomment-368070307
                            inline: wco.supportES2015 ? 1 : 3,
                        },
                        output: {
                            ascii_only: true,
                            comments: false,
                            webkit: true,
                        },
                    }
                }),
            ],
        },
        plugins: extraPlugins,
    };
}
exports.getCommonConfig = getCommonConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsaUJBQWlCO0FBQ2pCLCtEQUErRDs7QUFFL0QsNkJBQTZCO0FBQzdCLHFDQUFnRDtBQUNoRCx5REFBeUQ7QUFDekQsbUNBQThDO0FBQzlDLCtEQUEyRDtBQUMzRCxtRkFBOEU7QUFFOUUsK0RBQWlFO0FBQ2pFLG1GQUE4RTtBQUM5RSxpRkFBNEU7QUFDNUUscURBQWlEO0FBRWpELG1DQUFvRDtBQUVwRCxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUM3RCxNQUFNLHdCQUF3QixHQUFHLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBQ3ZFLE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQzFELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBQ3BELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUM1QyxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7QUFFbkM7Ozs7Ozs7Ozs7R0FVRztBQUVILE1BQU0sQ0FBQyxHQUFRLE9BQU8sTUFBTSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDOUMsUUFBQSxvQkFBb0IsR0FBVyxDQUFDLENBQUMsZ0JBQWdCLENBQUM7SUFDN0QsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsb0VBQW9FLENBQUM7SUFDdkYsQ0FBQyxDQUFDLGdEQUFnRCxDQUFDO0FBRXJELHlCQUFnQyxHQUF5QjtJQUN2RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFFaEQsTUFBTSxXQUFXLEdBQUcsZ0JBQU0sQ0FBQyxjQUFjLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDeEQsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBQ2pCLE1BQU0sSUFBSSxLQUFLLENBQUMsdUNBQXVDLENBQUMsQ0FBQTtJQUMxRCxDQUFDO0lBRUQsSUFBSSxZQUFZLEdBQVUsRUFBRSxDQUFDO0lBQzdCLElBQUksV0FBVyxHQUFnQyxFQUFFLENBQUM7SUFFbEQsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDdEIsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDaEUsQ0FBQztJQUVELEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQzNCLFdBQVcsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQzFFLENBQUM7SUFFRCwyQkFBMkI7SUFDM0IsTUFBTSxVQUFVLEdBQUcsMkJBQW1CLENBQUMsWUFBWSxDQUFDLGFBQW9CLENBQUMsQ0FBQztJQUUxRSx5QkFBeUI7SUFDekIsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwQyxNQUFNLHlCQUF5QixHQUFHLGlDQUF5QixDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDO2FBQ3pGLE1BQU0sQ0FBQyxDQUFDLElBQThELEVBQUUsSUFBSSxFQUFFLEVBQUU7WUFDL0UsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztZQUNuQyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDcEQsSUFBSSxhQUFhLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLFVBQVUsS0FBSyxVQUFVLENBQUMsQ0FBQztZQUNwRSxFQUFFLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO2dCQUNsQixFQUFFLENBQUMsQ0FBQyxhQUFhLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQ3JDLHlEQUF5RDtvQkFDekQsTUFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLElBQUksQ0FBQyxVQUFVLDhDQUE4QyxDQUFDLENBQUM7Z0JBQ3hGLENBQUM7Z0JBRUQsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFFekMsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLElBQUksQ0FBQyxJQUFJLENBQUM7b0JBQ1IsVUFBVTtvQkFDVixLQUFLLEVBQUUsQ0FBQyxZQUFZLENBQUM7b0JBQ3JCLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtpQkFDaEIsQ0FBQyxDQUFDO1lBQ0wsQ0FBQztZQUNELE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDZCxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFHVCxrQ0FBa0M7UUFDbEMseUJBQXlCLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDM0MseUVBQXlFO1lBQ3pFLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQztZQUNsRCxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDO1lBRXJDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSw2Q0FBb0IsQ0FBQztnQkFDekMsSUFBSSxFQUFFLFVBQVU7Z0JBQ2hCLFNBQVMsRUFBRSxZQUFZLENBQUMsU0FBUztnQkFDakMsUUFBUSxFQUFFLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsR0FBRyxJQUFJLEtBQUs7Z0JBQ2xELE9BQU8sRUFBRSxNQUFNLENBQUMsS0FBSztnQkFDckIsUUFBUSxFQUFFLFdBQVc7YUFDdEIsQ0FBQyxDQUFDLENBQUM7UUFDTixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCx3QkFBd0I7SUFDeEIsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDeEIsTUFBTSx5QkFBeUIsR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQW1CLEVBQUUsRUFBRTtZQUVoRiwyRUFBMkU7WUFDM0UsS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztZQUNsRSxLQUFLLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQztZQUMxRSxLQUFLLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQztZQUU5RSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2xDLE1BQU0sT0FBTyxHQUFHLDREQUE0RDtzQkFDeEUsb0VBQW9FO3NCQUNwRSx5REFBeUQsQ0FBQztnQkFDOUQsTUFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUMzQixDQUFDO1lBRUQsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNqQyw4RUFBOEU7Z0JBQzlFLEtBQUssQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkMsQ0FBQztZQUVELE1BQU0sQ0FBQztnQkFDTCxPQUFPLEVBQUUsS0FBSyxDQUFDLEtBQUs7Z0JBQ3BCLEVBQUUsRUFBRSxLQUFLLENBQUMsTUFBTTtnQkFDaEIsSUFBSSxFQUFFO29CQUNKLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTtvQkFDaEIsR0FBRyxFQUFFLElBQUk7aUJBQ1Y7YUFDRixDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7UUFFSCxNQUFNLHdCQUF3QixHQUFHLEVBQUUsTUFBTSxFQUFFLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRSxjQUFjLENBQUMsRUFBRSxDQUFDO1FBRTFGLE1BQU0seUJBQXlCLEdBQUcsSUFBSSxpQkFBaUIsQ0FBQyx5QkFBeUIsRUFDL0Usd0JBQXdCLENBQUMsQ0FBQztRQUU1Qiw0Q0FBNEM7UUFDM0MseUJBQWlDLENBQUMsMkJBQTJCLENBQUMsR0FBRyx5QkFBeUIsQ0FBQztRQUMzRix5QkFBaUMsQ0FBQywwQkFBMEIsQ0FBQyxHQUFHLHdCQUF3QixDQUFDO1FBRTFGLFlBQVksQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRUQsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDMUIsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLGNBQWMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxZQUFZLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDekYsQ0FBQztJQUVELEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUM7UUFDMUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLHdCQUF3QixDQUFDO1lBQzdDLE9BQU8sRUFBRSwwQkFBMEI7U0FDcEMsQ0FBQyxDQUFDLENBQUM7SUFDTixDQUFDO0lBRUQsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDM0IsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLFdBQVcsQ0FBQyxZQUFZLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztJQUM5RCxDQUFDO0lBRUQsSUFBSSxxQkFBcUIsQ0FBQztJQUMxQixFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztRQUNoQyw4RkFBOEY7UUFDOUYsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLENBQUMsZ0JBQWdCLENBQUM7WUFDNUMsQ0FBQyxDQUFDLFdBQVc7WUFDYixDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGlDQUFpQyxFQUFFLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMzRixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBRXBFLHFCQUFxQixHQUFHO1lBQ3RCLEdBQUcsRUFBRTtnQkFDSDtvQkFDRSxNQUFNLEVBQUUsY0FBYztvQkFDdEIsT0FBTyxFQUFFLEVBQUUsY0FBYyxFQUFFO2lCQUM1QjtnQkFDRDtvQkFDRSxNQUFNLEVBQUUsNEJBQW9CO29CQUM1QixPQUFPLEVBQUUsRUFBRSxTQUFTLEVBQUUsWUFBWSxDQUFDLFNBQVMsRUFBRTtpQkFDL0M7YUFDRjtTQUNGLENBQUM7SUFDSixDQUFDO0lBRUQsd0ZBQXdGO0lBQ3hGLHdEQUF3RDtJQUN4RCw4RUFBOEU7SUFDOUUsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQzNDLE1BQU0sdUJBQXVCLEdBQUcsZ0JBQU0sQ0FBQyxjQUFjLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDbEUsRUFBRSxDQUFDLENBQUMsdUJBQXVCO1dBQ3RCLDBCQUFXLENBQUMsdUJBQXVCLENBQUM7V0FDcEMsdUJBQXVCLEtBQUssV0FBVztXQUN2Qyx1QkFBdUIsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUNuRCxDQUFDLENBQUMsQ0FBQztRQUNELGlCQUFpQixDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFFRCwwQkFBMEI7SUFDMUIsZ0dBQWdHO0lBQ2hHLElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQztJQUNmLElBQUksQ0FBQztRQUNILE1BQU0scUJBQXFCLEdBQUcsR0FBRyxDQUFDLGFBQWE7WUFDN0MsQ0FBQyxDQUFDLDRCQUE0QjtZQUM5QixDQUFDLENBQUMseUJBQXlCLENBQUM7UUFDOUIsTUFBTSxPQUFPLEdBQUcsNkNBQW9CLENBQUMsV0FBVyxFQUFFLHFCQUFxQixDQUFDLENBQUM7UUFDekUsS0FBSyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFZixNQUFNLENBQUM7UUFDTCxJQUFJLEVBQUUsWUFBWSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxhQUFhO1FBQzlELE9BQU8sRUFBRSxLQUFLO1FBQ2QsT0FBTyxFQUFFO1lBQ1AsVUFBVSxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQztZQUMxQixRQUFRLEVBQUUsQ0FBQyxZQUFZLENBQUMsZ0JBQWdCO1lBQ3hDLE9BQU8sRUFBRTtnQkFDUCxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUksV0FBVztnQkFDM0MsY0FBYzthQUNmO1lBQ0QsS0FBSztTQUNOO1FBQ0QsYUFBYSxFQUFFO1lBQ2IsT0FBTyxFQUFFLGlCQUFpQjtTQUMzQjtRQUNELE9BQU8sRUFBRSxXQUFXO1FBQ3BCLEtBQUssRUFBRSxXQUFXO1FBQ2xCLE1BQU0sRUFBRTtZQUNOLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsVUFBb0IsQ0FBQztZQUMzRCxVQUFVLEVBQUUsWUFBWSxDQUFDLFNBQVM7WUFDbEMsUUFBUSxFQUFFLFNBQVMsVUFBVSxDQUFDLEtBQUssS0FBSztTQUN6QztRQUNELFdBQVcsRUFBRTtZQUNYLEtBQUssRUFBRSxLQUFLO1NBQ2I7UUFDRCxNQUFNLEVBQUU7WUFDTixLQUFLLEVBQUU7Z0JBQ0wsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUU7Z0JBQ3pDO29CQUNFLElBQUksRUFBRSxrQkFBa0I7b0JBQ3hCLE1BQU0sRUFBRSxhQUFhO29CQUNyQixPQUFPLEVBQUU7d0JBQ1AsSUFBSSxFQUFFLFNBQVMsVUFBVSxDQUFDLElBQUksUUFBUTt3QkFDdEMsS0FBSyxFQUFFLEtBQUs7cUJBQ2I7aUJBQ0Y7Z0JBQ0Q7b0JBQ0UsSUFBSSxFQUFFLDhDQUE4QztvQkFDcEQsTUFBTSxFQUFFLFlBQVk7b0JBQ3BCLE9BQU8sRUFBRTt3QkFDUCxJQUFJLEVBQUUsU0FBUyxVQUFVLENBQUMsSUFBSSxRQUFRO3dCQUN0QyxLQUFLLEVBQUUsS0FBSztxQkFDYjtpQkFDRjtnQ0FFQyxJQUFJLEVBQUUsNkJBQTZCLEVBQ25DLFdBQVcsRUFBRSxLQUFLLEVBQ2xCLE1BQU0sRUFBRSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFDckIscUJBQXFCO2dDQUd4QixJQUFJLEVBQUUsT0FBTyxJQUNWLHFCQUFxQjthQUUzQjtTQUNGO1FBQ0QsWUFBWSxFQUFFO1lBQ1osY0FBYyxFQUFFLElBQUk7WUFDcEIsU0FBUyxFQUFFO2dCQUNULElBQUksK0JBQXFCLEVBQUU7Z0JBQzNCLGlEQUFpRDtnQkFDakQsSUFBSSxrQ0FBa0IsQ0FBQyxFQUFFLE9BQU8sRUFBRSxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3pELElBQUksK0NBQXFCLENBQUM7b0JBQ3hCLFNBQVMsRUFBRSxZQUFZLENBQUMsU0FBUztvQkFDakMsbURBQW1EO29CQUNuRCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLGdDQUFnQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7aUJBQzVELENBQUM7Z0JBQ0YsSUFBSSxjQUFjLENBQUM7b0JBQ2pCLFNBQVMsRUFBRSxZQUFZLENBQUMsU0FBUztvQkFDakMsUUFBUSxFQUFFLElBQUk7b0JBQ2QsS0FBSyxFQUFFLElBQUk7b0JBQ1gsYUFBYSxFQUFFO3dCQUNiLElBQUksRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQy9CLFFBQVEsRUFBRSxZQUFZLENBQUMsT0FBTzt3QkFDOUIsUUFBUSxFQUFFLElBQUk7d0JBQ2QsUUFBUSxFQUFFOzRCQUNSLFlBQVksRUFBRSxZQUFZLENBQUMsY0FBYzs0QkFDekMseUNBQXlDOzRCQUN6Qyw2RUFBNkU7NEJBQzdFLE1BQU0sRUFBRSxZQUFZLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7NEJBQzNDLG1DQUFtQzs0QkFDbkMsNkVBQTZFOzRCQUM3RSxNQUFNLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO3lCQUNsQzt3QkFDRCxNQUFNLEVBQUU7NEJBQ04sVUFBVSxFQUFFLElBQUk7NEJBQ2hCLFFBQVEsRUFBRSxLQUFLOzRCQUNmLE1BQU0sRUFBRSxJQUFJO3lCQUNiO3FCQUNGO2lCQUNGLENBQUM7YUFDSDtTQUNGO1FBQ0QsT0FBTyxFQUFFLFlBQVk7S0FDdEIsQ0FBQztBQUNKLENBQUM7QUF0UUQsMENBc1FDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgSGFzaGVkTW9kdWxlSWRzUGx1Z2luIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgKiBhcyBDb3B5V2VicGFja1BsdWdpbiBmcm9tICdjb3B5LXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IGdldE91dHB1dEhhc2hGb3JtYXQgfSBmcm9tICcuL3V0aWxzJztcbmltcG9ydCB7IGlzRGlyZWN0b3J5IH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL2lzLWRpcmVjdG9yeSc7XG5pbXBvcnQgeyByZXF1aXJlUHJvamVjdE1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9yZXF1aXJlLXByb2plY3QtbW9kdWxlJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBCdW5kbGVCdWRnZXRQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL2J1bmRsZS1idWRnZXQnO1xuaW1wb3J0IHsgQ2xlYW5Dc3NXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9jbGVhbmNzcy13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgeyBTY3JpcHRzV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvc2NyaXB0cy13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgeyBmaW5kVXAgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvZmluZC11cCc7XG5pbXBvcnQgeyBBc3NldFBhdHRlcm4sIEV4dHJhRW50cnlQb2ludCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMgfSBmcm9tICcuL3V0aWxzJztcblxuY29uc3QgUHJvZ3Jlc3NQbHVnaW4gPSByZXF1aXJlKCd3ZWJwYWNrL2xpYi9Qcm9ncmVzc1BsdWdpbicpO1xuY29uc3QgQ2lyY3VsYXJEZXBlbmRlbmN5UGx1Z2luID0gcmVxdWlyZSgnY2lyY3VsYXItZGVwZW5kZW5jeS1wbHVnaW4nKTtcbmNvbnN0IFVnbGlmeUpTUGx1Z2luID0gcmVxdWlyZSgndWdsaWZ5anMtd2VicGFjay1wbHVnaW4nKTtcbmNvbnN0IFN0YXRzUGx1Z2luID0gcmVxdWlyZSgnc3RhdHMtd2VicGFjay1wbHVnaW4nKTtcbmNvbnN0IFNpbGVudEVycm9yID0gcmVxdWlyZSgnc2lsZW50LWVycm9yJyk7XG5jb25zdCByZXNvbHZlID0gcmVxdWlyZSgncmVzb2x2ZScpO1xuXG4vKipcbiAqIEVudW1lcmF0ZSBsb2FkZXJzIGFuZCB0aGVpciBkZXBlbmRlbmNpZXMgZnJvbSB0aGlzIGZpbGUgdG8gbGV0IHRoZSBkZXBlbmRlbmN5IHZhbGlkYXRvclxuICoga25vdyB0aGV5IGFyZSB1c2VkLlxuICpcbiAqIHJlcXVpcmUoJ3NvdXJjZS1tYXAtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ3Jhdy1sb2FkZXInKVxuICogcmVxdWlyZSgndXJsLWxvYWRlcicpXG4gKiByZXF1aXJlKCdmaWxlLWxvYWRlcicpXG4gKiByZXF1aXJlKCdjYWNoZS1sb2FkZXInKVxuICogcmVxdWlyZSgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLW9wdGltaXplcicpXG4gKi9cblxuY29uc3QgZzogYW55ID0gdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWwgOiB7fTtcbmV4cG9ydCBjb25zdCBidWlsZE9wdGltaXplckxvYWRlcjogc3RyaW5nID0gZ1snX0RldktpdElzTG9jYWwnXVxuICA/IHJlcXVpcmUucmVzb2x2ZSgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLW9wdGltaXplci9zcmMvYnVpbGQtb3B0aW1pemVyL3dlYnBhY2stbG9hZGVyJylcbiAgOiAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLW9wdGltaXplci93ZWJwYWNrLWxvYWRlcic7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDb21tb25Db25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucykge1xuICBjb25zdCB7IHJvb3QsIHByb2plY3RSb290LCBidWlsZE9wdGlvbnMgfSA9IHdjbztcblxuICBjb25zdCBub2RlTW9kdWxlcyA9IGZpbmRVcCgnbm9kZV9tb2R1bGVzJywgcHJvamVjdFJvb3QpO1xuICBpZiAoIW5vZGVNb2R1bGVzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgbG9jYXRlIG5vZGVfbW9kdWxlcyBkaXJlY3RvcnkuJylcbiAgfVxuXG4gIGxldCBleHRyYVBsdWdpbnM6IGFueVtdID0gW107XG4gIGxldCBlbnRyeVBvaW50czogeyBba2V5OiBzdHJpbmddOiBzdHJpbmdbXSB9ID0ge307XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5tYWluKSB7XG4gICAgZW50cnlQb2ludHNbJ21haW4nXSA9IFtwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm1haW4pXTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMucG9seWZpbGxzKSB7XG4gICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gW3BhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMucG9seWZpbGxzKV07XG4gIH1cblxuICAvLyBkZXRlcm1pbmUgaGFzaGluZyBmb3JtYXRcbiAgY29uc3QgaGFzaEZvcm1hdCA9IGdldE91dHB1dEhhc2hGb3JtYXQoYnVpbGRPcHRpb25zLm91dHB1dEhhc2hpbmcgYXMgYW55KTtcblxuICAvLyBwcm9jZXNzIGdsb2JhbCBzY3JpcHRzXG4gIGlmIChidWlsZE9wdGlvbnMuc2NyaXB0cy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZSA9IG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoYnVpbGRPcHRpb25zLnNjcmlwdHMsICdzY3JpcHRzJylcbiAgICAgIC5yZWR1Y2UoKHByZXY6IHsgYnVuZGxlTmFtZTogc3RyaW5nLCBwYXRoczogc3RyaW5nW10sIGxhenk6IGJvb2xlYW4gfVtdLCBjdXJyKSA9PiB7XG4gICAgICAgIGNvbnN0IGJ1bmRsZU5hbWUgPSBjdXJyLmJ1bmRsZU5hbWU7XG4gICAgICAgIGNvbnN0IHJlc29sdmVkUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBjdXJyLmlucHV0KTtcbiAgICAgICAgbGV0IGV4aXN0aW5nRW50cnkgPSBwcmV2LmZpbmQoKGVsKSA9PiBlbC5idW5kbGVOYW1lID09PSBidW5kbGVOYW1lKTtcbiAgICAgICAgaWYgKGV4aXN0aW5nRW50cnkpIHtcbiAgICAgICAgICBpZiAoZXhpc3RpbmdFbnRyeS5sYXp5ICYmICFjdXJyLmxhenkpIHtcbiAgICAgICAgICAgIC8vIEFsbCBlbnRyaWVzIGhhdmUgdG8gYmUgbGF6eSBmb3IgdGhlIGJ1bmRsZSB0byBiZSBsYXp5LlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJHtjdXJyLmJ1bmRsZU5hbWV9IGJ1bmRsZSBpcyBtaXhpbmcgbGF6eSBhbmQgbm9uLWxhenkgc2NyaXB0cy5gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBleGlzdGluZ0VudHJ5LnBhdGhzLnB1c2gocmVzb2x2ZWRQYXRoKTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHByZXYucHVzaCh7XG4gICAgICAgICAgICBidW5kbGVOYW1lLFxuICAgICAgICAgICAgcGF0aHM6IFtyZXNvbHZlZFBhdGhdLFxuICAgICAgICAgICAgbGF6eTogY3Vyci5sYXp5XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByZXY7XG4gICAgICB9LCBbXSk7XG5cblxuICAgIC8vIEFkZCBhIG5ldyBhc3NldCBmb3IgZWFjaCBlbnRyeS5cbiAgICBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lLmZvckVhY2goKHNjcmlwdCkgPT4ge1xuICAgICAgLy8gTGF6eSBzY3JpcHRzIGRvbid0IGdldCBhIGhhc2gsIG90aGVyd2lzZSB0aGV5IGNhbid0IGJlIGxvYWRlZCBieSBuYW1lLlxuICAgICAgY29uc3QgaGFzaCA9IHNjcmlwdC5sYXp5ID8gJycgOiBoYXNoRm9ybWF0LnNjcmlwdDtcbiAgICAgIGNvbnN0IGJ1bmRsZU5hbWUgPSBzY3JpcHQuYnVuZGxlTmFtZTtcblxuICAgICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFNjcmlwdHNXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgbmFtZTogYnVuZGxlTmFtZSxcbiAgICAgICAgc291cmNlTWFwOiBidWlsZE9wdGlvbnMuc291cmNlTWFwLFxuICAgICAgICBmaWxlbmFtZTogYCR7cGF0aC5iYXNlbmFtZShidW5kbGVOYW1lKX0ke2hhc2h9LmpzYCxcbiAgICAgICAgc2NyaXB0czogc2NyaXB0LnBhdGhzLFxuICAgICAgICBiYXNlUGF0aDogcHJvamVjdFJvb3QsXG4gICAgICB9KSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBwcm9jZXNzIGFzc2V0IGVudHJpZXNcbiAgaWYgKGJ1aWxkT3B0aW9ucy5hc3NldHMpIHtcbiAgICBjb25zdCBjb3B5V2VicGFja1BsdWdpblBhdHRlcm5zID0gYnVpbGRPcHRpb25zLmFzc2V0cy5tYXAoKGFzc2V0OiBBc3NldFBhdHRlcm4pID0+IHtcblxuICAgICAgLy8gUmVzb2x2ZSBpbnB1dCBwYXRocyByZWxhdGl2ZSB0byB3b3Jrc3BhY2Ugcm9vdCBhbmQgYWRkIHNsYXNoIGF0IHRoZSBlbmQuXG4gICAgICBhc3NldC5pbnB1dCA9IHBhdGgucmVzb2x2ZShyb290LCBhc3NldC5pbnB1dCkucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgICAgYXNzZXQuaW5wdXQgPSBhc3NldC5pbnB1dC5lbmRzV2l0aCgnLycpID8gYXNzZXQuaW5wdXQgOiBhc3NldC5pbnB1dCArICcvJztcbiAgICAgIGFzc2V0Lm91dHB1dCA9IGFzc2V0Lm91dHB1dC5lbmRzV2l0aCgnLycpID8gYXNzZXQub3V0cHV0IDogYXNzZXQub3V0cHV0ICsgJy8nO1xuXG4gICAgICBpZiAoYXNzZXQub3V0cHV0LnN0YXJ0c1dpdGgoJy4uJykpIHtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9ICdBbiBhc3NldCBjYW5ub3QgYmUgd3JpdHRlbiB0byBhIGxvY2F0aW9uIG91dHNpZGUgb2YgdGhlIC4gJ1xuICAgICAgICAgICsgJ1lvdSBjYW4gb3ZlcnJpZGUgdGhpcyBtZXNzYWdlIGJ5IHNldHRpbmcgdGhlIGBhbGxvd091dHNpZGVPdXREaXJgICdcbiAgICAgICAgICArICdwcm9wZXJ0eSBvbiB0aGUgYXNzZXQgdG8gdHJ1ZSBpbiB0aGUgQ0xJIGNvbmZpZ3VyYXRpb24uJztcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgICAgfVxuXG4gICAgICBpZiAoYXNzZXQub3V0cHV0LnN0YXJ0c1dpdGgoJy8nKSkge1xuICAgICAgICAvLyBOb3cgd2UgcmVtb3ZlIHN0YXJ0aW5nIHNsYXNoIHRvIG1ha2UgV2VicGFjayBwbGFjZSBpdCBmcm9tIHRoZSBvdXRwdXQgcm9vdC5cbiAgICAgICAgYXNzZXQub3V0cHV0ID0gYXNzZXQub3V0cHV0LnNsaWNlKDEpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBjb250ZXh0OiBhc3NldC5pbnB1dCxcbiAgICAgICAgdG86IGFzc2V0Lm91dHB1dCxcbiAgICAgICAgZnJvbToge1xuICAgICAgICAgIGdsb2I6IGFzc2V0Lmdsb2IsXG4gICAgICAgICAgZG90OiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG5cbiAgICBjb25zdCBjb3B5V2VicGFja1BsdWdpbk9wdGlvbnMgPSB7IGlnbm9yZTogWycuZ2l0a2VlcCcsICcqKi8uRFNfU3RvcmUnLCAnKiovVGh1bWJzLmRiJ10gfTtcblxuICAgIGNvbnN0IGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UgPSBuZXcgQ29weVdlYnBhY2tQbHVnaW4oY29weVdlYnBhY2tQbHVnaW5QYXR0ZXJucyxcbiAgICAgIGNvcHlXZWJwYWNrUGx1Z2luT3B0aW9ucyk7XG5cbiAgICAvLyBTYXZlIG9wdGlvbnMgc28gd2UgY2FuIHVzZSB0aGVtIGluIGVqZWN0LlxuICAgIChjb3B5V2VicGFja1BsdWdpbkluc3RhbmNlIGFzIGFueSlbJ2NvcHlXZWJwYWNrUGx1Z2luUGF0dGVybnMnXSA9IGNvcHlXZWJwYWNrUGx1Z2luUGF0dGVybnM7XG4gICAgKGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UgYXMgYW55KVsnY29weVdlYnBhY2tQbHVnaW5PcHRpb25zJ10gPSBjb3B5V2VicGFja1BsdWdpbk9wdGlvbnM7XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChjb3B5V2VicGFja1BsdWdpbkluc3RhbmNlKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMucHJvZ3Jlc3MpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgUHJvZ3Jlc3NQbHVnaW4oeyBwcm9maWxlOiBidWlsZE9wdGlvbnMudmVyYm9zZSwgY29sb3JzOiB0cnVlIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc2hvd0NpcmN1bGFyRGVwZW5kZW5jaWVzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IENpcmN1bGFyRGVwZW5kZW5jeVBsdWdpbih7XG4gICAgICBleGNsdWRlOiAvW1xcXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFxcXC9dL1xuICAgIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3RhdHNKc29uKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN0YXRzUGx1Z2luKCdzdGF0cy5qc29uJywgJ3ZlcmJvc2UnKSk7XG4gIH1cblxuICBsZXQgYnVpbGRPcHRpbWl6ZXJVc2VSdWxlO1xuICBpZiAoYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyKSB7XG4gICAgLy8gU2V0IHRoZSBjYWNoZSBkaXJlY3RvcnkgdG8gdGhlIEJ1aWxkIE9wdGltaXplciBkaXIsIHNvIHRoYXQgcGFja2FnZSB1cGRhdGVzIHdpbGwgZGVsZXRlIGl0LlxuICAgIGNvbnN0IGJ1aWxkT3B0aW1pemVyRGlyID0gZ1snX0RldktpdElzTG9jYWwnXVxuICAgICA/IG5vZGVNb2R1bGVzXG4gICAgIDogcGF0aC5kaXJuYW1lKHJlc29sdmUuc3luYygnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLW9wdGltaXplcicsIHsgYmFzZWRpcjogcHJvamVjdFJvb3QgfSkpO1xuICAgIGNvbnN0IGNhY2hlRGlyZWN0b3J5ID0gcGF0aC5yZXNvbHZlKGJ1aWxkT3B0aW1pemVyRGlyLCAnLi8uY2FjaGUvJyk7XG5cbiAgICBidWlsZE9wdGltaXplclVzZVJ1bGUgPSB7XG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogJ2NhY2hlLWxvYWRlcicsXG4gICAgICAgICAgb3B0aW9uczogeyBjYWNoZURpcmVjdG9yeSB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IGJ1aWxkT3B0aW1pemVyTG9hZGVyLFxuICAgICAgICAgIG9wdGlvbnM6IHsgc291cmNlTWFwOiBidWlsZE9wdGlvbnMuc291cmNlTWFwIH1cbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfTtcbiAgfVxuXG4gIC8vIEFsbG93IGxvYWRlcnMgdG8gYmUgaW4gYSBub2RlX21vZHVsZXMgbmVzdGVkIGluc2lkZSB0aGUgZGV2a2l0L2J1aWxkLWFuZ3VsYXIgcGFja2FnZS5cbiAgLy8gVGhpcyBpcyBpbXBvcnRhbnQgaW4gY2FzZSBsb2FkZXJzIGRvIG5vdCBnZXQgaG9pc3RlZC5cbiAgLy8gSWYgdGhpcyBmaWxlIG1vdmVzIHRvIGFub3RoZXIgbG9jYXRpb24sIGFsdGVyIHBvdGVudGlhbE5vZGVNb2R1bGVzIGFzIHdlbGwuXG4gIGNvbnN0IGxvYWRlck5vZGVNb2R1bGVzID0gWydub2RlX21vZHVsZXMnXTtcbiAgY29uc3QgYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXMgPSBmaW5kVXAoJ25vZGVfbW9kdWxlcycsIF9fZGlybmFtZSk7XG4gIGlmIChidWlsZEFuZ3VsYXJOb2RlTW9kdWxlc1xuICAgICYmIGlzRGlyZWN0b3J5KGJ1aWxkQW5ndWxhck5vZGVNb2R1bGVzKVxuICAgICYmIGJ1aWxkQW5ndWxhck5vZGVNb2R1bGVzICE9PSBub2RlTW9kdWxlc1xuICAgICYmIGJ1aWxkQW5ndWxhck5vZGVNb2R1bGVzLnN0YXJ0c1dpdGgobm9kZU1vZHVsZXMpXG4gICkge1xuICAgIGxvYWRlck5vZGVNb2R1bGVzLnB1c2goYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXMpO1xuICB9XG5cbiAgLy8gTG9hZCByeGpzIHBhdGggYWxpYXNlcy5cbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL1JlYWN0aXZlWC9yeGpzL2Jsb2IvbWFzdGVyL2RvYy9sZXR0YWJsZS1vcGVyYXRvcnMubWQjYnVpbGQtYW5kLXRyZWVzaGFraW5nXG4gIGxldCBhbGlhcyA9IHt9O1xuICB0cnkge1xuICAgIGNvbnN0IHJ4anNQYXRoTWFwcGluZ0ltcG9ydCA9IHdjby5zdXBwb3J0RVMyMDE1XG4gICAgICA/ICdyeGpzL19lc20yMDE1L3BhdGgtbWFwcGluZydcbiAgICAgIDogJ3J4anMvX2VzbTUvcGF0aC1tYXBwaW5nJztcbiAgICBjb25zdCByeFBhdGhzID0gcmVxdWlyZVByb2plY3RNb2R1bGUocHJvamVjdFJvb3QsIHJ4anNQYXRoTWFwcGluZ0ltcG9ydCk7XG4gICAgYWxpYXMgPSByeFBhdGhzKG5vZGVNb2R1bGVzKTtcbiAgfSBjYXRjaCAoZSkgeyB9XG5cbiAgcmV0dXJuIHtcbiAgICBtb2RlOiBidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uID8gJ3Byb2R1Y3Rpb24nIDogJ2RldmVsb3BtZW50JyxcbiAgICBkZXZ0b29sOiBmYWxzZSxcbiAgICByZXNvbHZlOiB7XG4gICAgICBleHRlbnNpb25zOiBbJy50cycsICcuanMnXSxcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICBtb2R1bGVzOiBbXG4gICAgICAgIHdjby50c0NvbmZpZy5vcHRpb25zLmJhc2VVcmwgfHwgcHJvamVjdFJvb3QsXG4gICAgICAgICdub2RlX21vZHVsZXMnLFxuICAgICAgXSxcbiAgICAgIGFsaWFzXG4gICAgfSxcbiAgICByZXNvbHZlTG9hZGVyOiB7XG4gICAgICBtb2R1bGVzOiBsb2FkZXJOb2RlTW9kdWxlc1xuICAgIH0sXG4gICAgY29udGV4dDogcHJvamVjdFJvb3QsXG4gICAgZW50cnk6IGVudHJ5UG9pbnRzLFxuICAgIG91dHB1dDoge1xuICAgICAgcGF0aDogcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoIGFzIHN0cmluZyksXG4gICAgICBwdWJsaWNQYXRoOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICB9LFxuICAgIHBlcmZvcm1hbmNlOiB7XG4gICAgICBoaW50czogZmFsc2UsXG4gICAgfSxcbiAgICBtb2R1bGU6IHtcbiAgICAgIHJ1bGVzOiBbXG4gICAgICAgIHsgdGVzdDogL1xcLmh0bWwkLywgbG9hZGVyOiAncmF3LWxvYWRlcicgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC4oZW90fHN2Z3xjdXIpJC8sXG4gICAgICAgICAgbG9hZGVyOiAnZmlsZS1sb2FkZXInLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIG5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuZmlsZX0uW2V4dF1gLFxuICAgICAgICAgICAgbGltaXQ6IDEwMDAwXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLihqcGd8cG5nfHdlYnB8Z2lmfG90Znx0dGZ8d29mZnx3b2ZmMnxhbmkpJC8sXG4gICAgICAgICAgbG9hZGVyOiAndXJsLWxvYWRlcicsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5maWxlfS5bZXh0XWAsXG4gICAgICAgICAgICBsaW1pdDogMTAwMDBcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvW1xcL1xcXFxdQGFuZ3VsYXJbXFwvXFxcXF0uK1xcLmpzJC8sXG4gICAgICAgICAgc2lkZUVmZmVjdHM6IGZhbHNlLFxuICAgICAgICAgIHBhcnNlcjogeyBzeXN0ZW06IHRydWUgfSxcbiAgICAgICAgICAuLi5idWlsZE9wdGltaXplclVzZVJ1bGUsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuanMkLyxcbiAgICAgICAgICAuLi5idWlsZE9wdGltaXplclVzZVJ1bGUsXG4gICAgICAgIH0sXG4gICAgICBdXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG5vRW1pdE9uRXJyb3JzOiB0cnVlLFxuICAgICAgbWluaW1pemVyOiBbXG4gICAgICAgIG5ldyBIYXNoZWRNb2R1bGVJZHNQbHVnaW4oKSxcbiAgICAgICAgLy8gVE9ETzogY2hlY2sgd2l0aCBNaWtlIHdoYXQgdGhpcyBmZWF0dXJlIG5lZWRzLlxuICAgICAgICBuZXcgQnVuZGxlQnVkZ2V0UGx1Z2luKHsgYnVkZ2V0czogYnVpbGRPcHRpb25zLmJ1ZGdldHMgfSksXG4gICAgICAgIG5ldyBDbGVhbkNzc1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICAgIHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCxcbiAgICAgICAgICAvLyBjb21wb25lbnQgc3R5bGVzIHJldGFpbiB0aGVpciBvcmlnaW5hbCBmaWxlIG5hbWVcbiAgICAgICAgICB0ZXN0OiAoZmlsZSkgPT4gL1xcLig/OmNzc3xzY3NzfHNhc3N8bGVzc3xzdHlsKSQvLnRlc3QoZmlsZSksXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgVWdsaWZ5SlNQbHVnaW4oe1xuICAgICAgICAgIHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCxcbiAgICAgICAgICBwYXJhbGxlbDogdHJ1ZSxcbiAgICAgICAgICBjYWNoZTogdHJ1ZSxcbiAgICAgICAgICB1Z2xpZnlPcHRpb25zOiB7XG4gICAgICAgICAgICBlY21hOiB3Y28uc3VwcG9ydEVTMjAxNSA/IDYgOiA1LFxuICAgICAgICAgICAgd2FybmluZ3M6IGJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAgICAgc2FmYXJpMTA6IHRydWUsXG4gICAgICAgICAgICBjb21wcmVzczoge1xuICAgICAgICAgICAgICBwdXJlX2dldHRlcnM6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgICAgICAgICAgLy8gUFVSRSBjb21tZW50cyB3b3JrIGJlc3Qgd2l0aCAzIHBhc3Nlcy5cbiAgICAgICAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrL3dlYnBhY2svaXNzdWVzLzI4OTkjaXNzdWVjb21tZW50LTMxNzQyNTkyNi5cbiAgICAgICAgICAgICAgcGFzc2VzOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIgPyAzIDogMSxcbiAgICAgICAgICAgICAgLy8gV29ya2Fyb3VuZCBrbm93biB1Z2xpZnktZXMgaXNzdWVcbiAgICAgICAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taXNob28vVWdsaWZ5SlMyL2lzc3Vlcy8yOTQ5I2lzc3VlY29tbWVudC0zNjgwNzAzMDdcbiAgICAgICAgICAgICAgaW5saW5lOiB3Y28uc3VwcG9ydEVTMjAxNSA/IDEgOiAzLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG91dHB1dDoge1xuICAgICAgICAgICAgICBhc2NpaV9vbmx5OiB0cnVlLFxuICAgICAgICAgICAgICBjb21tZW50czogZmFsc2UsXG4gICAgICAgICAgICAgIHdlYmtpdDogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gIH07XG59XG4iXX0=