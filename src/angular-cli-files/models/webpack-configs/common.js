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
function getCommonConfig(wco) {
    const { root, projectRoot, buildOptions, appConfig } = wco;
    const nodeModules = find_up_1.findUp('node_modules', projectRoot);
    if (!nodeModules) {
        throw new Error('Cannot locate node_modules directory.');
    }
    let extraPlugins = [];
    let entryPoints = {};
    if (appConfig.main) {
        entryPoints['main'] = [path.resolve(root, appConfig.main)];
    }
    if (appConfig.polyfills) {
        entryPoints['polyfills'] = [path.resolve(root, appConfig.polyfills)];
    }
    // determine hashing format
    const hashFormat = utils_1.getOutputHashFormat(buildOptions.outputHashing);
    // process global scripts
    if (appConfig.scripts.length > 0) {
        const globalScripts = utils_1.extraEntryParser(appConfig.scripts, root, 'scripts');
        const globalScriptsByEntry = globalScripts
            .reduce((prev, curr) => {
            let existingEntry = prev.find((el) => el.entry === curr.entry);
            if (existingEntry) {
                existingEntry.paths.push(curr.path);
                // All entries have to be lazy for the bundle to be lazy.
                existingEntry.lazy = existingEntry.lazy && curr.lazy;
            }
            else {
                prev.push({
                    entry: curr.entry, paths: [curr.path],
                    lazy: curr.lazy
                });
            }
            return prev;
        }, []);
        // Add a new asset for each entry.
        globalScriptsByEntry.forEach((script) => {
            // Lazy scripts don't get a hash, otherwise they can't be loaded by name.
            const hash = script.lazy ? '' : hashFormat.script;
            extraPlugins.push(new scripts_webpack_plugin_1.ScriptsWebpackPlugin({
                name: script.entry,
                sourceMap: buildOptions.sourceMap,
                filename: `${path.basename(script.entry)}${hash}.js`,
                scripts: script.paths,
                basePath: projectRoot,
            }));
        });
    }
    // process asset entries
    if (appConfig.assets) {
        const copyWebpackPluginPatterns = appConfig.assets.map((asset) => {
            // Add defaults.
            // Input is always resolved relative to the projectRoot.
            // TODO: add smart defaults to schema to use project root as default.
            asset.input = path.resolve(root, asset.input || projectRoot).replace(/\\/g, '/');
            asset.output = asset.output || '';
            asset.glob = asset.glob || '';
            // Prevent asset configurations from writing outside of the output path, except if the user
            // specify a configuration flag.
            // Also prevent writing outside the project path. That is not overridable.
            const absoluteOutputPath = path.resolve(projectRoot, buildOptions.outputPath);
            const absoluteAssetOutput = path.resolve(absoluteOutputPath, asset.output);
            const outputRelativeOutput = path.relative(absoluteOutputPath, absoluteAssetOutput);
            if (outputRelativeOutput.startsWith('..') || path.isAbsolute(outputRelativeOutput)) {
                // TODO: This check doesn't make a lot of sense anymore with multiple project. Review it.
                // const projectRelativeOutput = path.relative(projectRoot, absoluteAssetOutput);
                // if (projectRelativeOutput.startsWith('..') || path.isAbsolute(projectRelativeOutput)) {
                //   const message = 'An asset cannot be written to a location outside the project.';
                //   throw new SilentError(message);
                // }
                if (!asset.allowOutsideOutDir) {
                    const message = 'An asset cannot be written to a location outside of the output path. '
                        + 'You can override this message by setting the `allowOutsideOutDir` '
                        + 'property on the asset to true in the CLI configuration.';
                    throw new SilentError(message);
                }
            }
            // TODO: This check doesn't make a lot of sense anymore with multiple project. Review it.
            // Prevent asset configurations from reading files outside of the project.
            // const projectRelativeInput = path.relative(projectRoot, asset.input);
            // if (projectRelativeInput.startsWith('..') || path.isAbsolute(projectRelativeInput)) {
            //   const message = 'An asset cannot be read from a location outside the project.';
            //   throw new SilentError(message);
            // }
            // Ensure trailing slash.
            if (is_directory_1.isDirectory(path.resolve(asset.input))) {
                asset.input += '/';
            }
            // Convert dir patterns to globs.
            if (is_directory_1.isDirectory(path.resolve(asset.input, asset.glob))) {
                asset.glob = asset.glob + '/**/*';
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
        const buildOptimizerDir = path.dirname(resolve.sync('@angular-devkit/build-optimizer', { basedir: projectRoot }));
        const cacheDirectory = path.resolve(buildOptimizerDir, './.cache/');
        buildOptimizerUseRule = {
            use: [
                {
                    loader: 'cache-loader',
                    options: { cacheDirectory }
                },
                {
                    loader: '@angular-devkit/build-optimizer/webpack-loader',
                    options: { sourceMap: buildOptions.sourceMap }
                },
            ],
        };
    }
    // Allow loaders to be in a node_modules nested inside the CLI package
    const loaderNodeModules = ['node_modules'];
    const potentialNodeModules = path.join(__dirname, '..', '..', 'node_modules');
    if (is_directory_1.isDirectory(potentialNodeModules)) {
        loaderNodeModules.push(potentialNodeModules);
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
                wco.tsConfig.baseUrl || projectRoot,
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
                new bundle_budget_1.BundleBudgetPlugin({ budgets: appConfig.budgets }),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsaUJBQWlCO0FBQ2pCLCtEQUErRDs7QUFFL0QsNkJBQTZCO0FBQzdCLHFDQUFnRDtBQUNoRCx5REFBeUQ7QUFDekQsbUNBQThFO0FBQzlFLCtEQUEyRDtBQUMzRCxtRkFBOEU7QUFFOUUsK0RBQWlFO0FBQ2pFLG1GQUE4RTtBQUM5RSxpRkFBNEU7QUFDNUUscURBQWlEO0FBRWpELE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBQzdELE1BQU0sd0JBQXdCLEdBQUcsT0FBTyxDQUFDLDRCQUE0QixDQUFDLENBQUM7QUFDdkUsTUFBTSxjQUFjLEdBQUcsT0FBTyxDQUFDLHlCQUF5QixDQUFDLENBQUM7QUFDMUQsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUM7QUFDcEQsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQzVDLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUVuQzs7Ozs7Ozs7OztHQVVHO0FBRUgseUJBQWdDLEdBQXlCO0lBQ3ZELE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFFM0QsTUFBTSxXQUFXLEdBQUcsZ0JBQU0sQ0FBQyxjQUFjLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDeEQsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBQ2pCLE1BQU0sSUFBSSxLQUFLLENBQUMsdUNBQXVDLENBQUMsQ0FBQTtJQUMxRCxDQUFDO0lBRUQsSUFBSSxZ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QUF2UkQsMENBdVJDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgSGFzaGVkTW9kdWxlSWRzUGx1Z2luIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgKiBhcyBDb3B5V2VicGFja1BsdWdpbiBmcm9tICdjb3B5LXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IGV4dHJhRW50cnlQYXJzZXIsIGdldE91dHB1dEhhc2hGb3JtYXQsIEFzc2V0UGF0dGVybiB9IGZyb20gJy4vdXRpbHMnO1xuaW1wb3J0IHsgaXNEaXJlY3RvcnkgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvaXMtZGlyZWN0b3J5JztcbmltcG9ydCB7IHJlcXVpcmVQcm9qZWN0TW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL3JlcXVpcmUtcHJvamVjdC1tb2R1bGUnO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IEJ1bmRsZUJ1ZGdldFBsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvYnVuZGxlLWJ1ZGdldCc7XG5pbXBvcnQgeyBDbGVhbkNzc1dlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL2NsZWFuY3NzLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IFNjcmlwdHNXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9zY3JpcHRzLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IGZpbmRVcCB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9maW5kLXVwJztcblxuY29uc3QgUHJvZ3Jlc3NQbHVnaW4gPSByZXF1aXJlKCd3ZWJwYWNrL2xpYi9Qcm9ncmVzc1BsdWdpbicpO1xuY29uc3QgQ2lyY3VsYXJEZXBlbmRlbmN5UGx1Z2luID0gcmVxdWlyZSgnY2lyY3VsYXItZGVwZW5kZW5jeS1wbHVnaW4nKTtcbmNvbnN0IFVnbGlmeUpTUGx1Z2luID0gcmVxdWlyZSgndWdsaWZ5anMtd2VicGFjay1wbHVnaW4nKTtcbmNvbnN0IFN0YXRzUGx1Z2luID0gcmVxdWlyZSgnc3RhdHMtd2VicGFjay1wbHVnaW4nKTtcbmNvbnN0IFNpbGVudEVycm9yID0gcmVxdWlyZSgnc2lsZW50LWVycm9yJyk7XG5jb25zdCByZXNvbHZlID0gcmVxdWlyZSgncmVzb2x2ZScpO1xuXG4vKipcbiAqIEVudW1lcmF0ZSBsb2FkZXJzIGFuZCB0aGVpciBkZXBlbmRlbmNpZXMgZnJvbSB0aGlzIGZpbGUgdG8gbGV0IHRoZSBkZXBlbmRlbmN5IHZhbGlkYXRvclxuICoga25vdyB0aGV5IGFyZSB1c2VkLlxuICpcbiAqIHJlcXVpcmUoJ3NvdXJjZS1tYXAtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ3Jhdy1sb2FkZXInKVxuICogcmVxdWlyZSgndXJsLWxvYWRlcicpXG4gKiByZXF1aXJlKCdmaWxlLWxvYWRlcicpXG4gKiByZXF1aXJlKCdjYWNoZS1sb2FkZXInKVxuICogcmVxdWlyZSgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLW9wdGltaXplcicpXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENvbW1vbkNvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKSB7XG4gIGNvbnN0IHsgcm9vdCwgcHJvamVjdFJvb3QsIGJ1aWxkT3B0aW9ucywgYXBwQ29uZmlnIH0gPSB3Y287XG5cbiAgY29uc3Qgbm9kZU1vZHVsZXMgPSBmaW5kVXAoJ25vZGVfbW9kdWxlcycsIHByb2plY3RSb290KTtcbiAgaWYgKCFub2RlTW9kdWxlcykge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGxvY2F0ZSBub2RlX21vZHVsZXMgZGlyZWN0b3J5LicpXG4gIH1cblxuICBsZXQgZXh0cmFQbHVnaW5zOiBhbnlbXSA9IFtdO1xuICBsZXQgZW50cnlQb2ludHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nW10gfSA9IHt9O1xuXG4gIGlmIChhcHBDb25maWcubWFpbikge1xuICAgIGVudHJ5UG9pbnRzWydtYWluJ10gPSBbcGF0aC5yZXNvbHZlKHJvb3QsIGFwcENvbmZpZy5tYWluKV07XG4gIH1cblxuICBpZiAoYXBwQ29uZmlnLnBvbHlmaWxscykge1xuICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSA9IFtwYXRoLnJlc29sdmUocm9vdCwgYXBwQ29uZmlnLnBvbHlmaWxscyldO1xuICB9XG5cbiAgLy8gZGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0XG4gIGNvbnN0IGhhc2hGb3JtYXQgPSBnZXRPdXRwdXRIYXNoRm9ybWF0KGJ1aWxkT3B0aW9ucy5vdXRwdXRIYXNoaW5nIGFzIGFueSk7XG5cbiAgLy8gcHJvY2VzcyBnbG9iYWwgc2NyaXB0c1xuICBpZiAoYXBwQ29uZmlnLnNjcmlwdHMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGdsb2JhbFNjcmlwdHMgPSBleHRyYUVudHJ5UGFyc2VyKGFwcENvbmZpZy5zY3JpcHRzLCByb290LCAnc2NyaXB0cycpO1xuICAgIGNvbnN0IGdsb2JhbFNjcmlwdHNCeUVudHJ5ID0gZ2xvYmFsU2NyaXB0c1xuICAgICAgLnJlZHVjZSgocHJldjogeyBlbnRyeTogc3RyaW5nLCBwYXRoczogc3RyaW5nW10sIGxhenk6IGJvb2xlYW4gfVtdLCBjdXJyKSA9PiB7XG5cbiAgICAgICAgbGV0IGV4aXN0aW5nRW50cnkgPSBwcmV2LmZpbmQoKGVsKSA9PiBlbC5lbnRyeSA9PT0gY3Vyci5lbnRyeSk7XG4gICAgICAgIGlmIChleGlzdGluZ0VudHJ5KSB7XG4gICAgICAgICAgZXhpc3RpbmdFbnRyeS5wYXRocy5wdXNoKGN1cnIucGF0aCBhcyBzdHJpbmcpO1xuICAgICAgICAgIC8vIEFsbCBlbnRyaWVzIGhhdmUgdG8gYmUgbGF6eSBmb3IgdGhlIGJ1bmRsZSB0byBiZSBsYXp5LlxuICAgICAgICAgIChleGlzdGluZ0VudHJ5IGFzIGFueSkubGF6eSA9IGV4aXN0aW5nRW50cnkubGF6eSAmJiBjdXJyLmxhenk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJldi5wdXNoKHtcbiAgICAgICAgICAgIGVudHJ5OiBjdXJyLmVudHJ5IGFzIHN0cmluZywgcGF0aHM6IFtjdXJyLnBhdGggYXMgc3RyaW5nXSxcbiAgICAgICAgICAgIGxhenk6IGN1cnIubGF6eSBhcyBib29sZWFuXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByZXY7XG4gICAgICB9LCBbXSk7XG5cblxuICAgIC8vIEFkZCBhIG5ldyBhc3NldCBmb3IgZWFjaCBlbnRyeS5cbiAgICBnbG9iYWxTY3JpcHRzQnlFbnRyeS5mb3JFYWNoKChzY3JpcHQpID0+IHtcbiAgICAgIC8vIExhenkgc2NyaXB0cyBkb24ndCBnZXQgYSBoYXNoLCBvdGhlcndpc2UgdGhleSBjYW4ndCBiZSBsb2FkZWQgYnkgbmFtZS5cbiAgICAgIGNvbnN0IGhhc2ggPSBzY3JpcHQubGF6eSA/ICcnIDogaGFzaEZvcm1hdC5zY3JpcHQ7XG4gICAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU2NyaXB0c1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICBuYW1lOiBzY3JpcHQuZW50cnksXG4gICAgICAgIHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCxcbiAgICAgICAgZmlsZW5hbWU6IGAke3BhdGguYmFzZW5hbWUoc2NyaXB0LmVudHJ5KX0ke2hhc2h9LmpzYCxcbiAgICAgICAgc2NyaXB0czogc2NyaXB0LnBhdGhzLFxuICAgICAgICBiYXNlUGF0aDogcHJvamVjdFJvb3QsXG4gICAgICB9KSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBwcm9jZXNzIGFzc2V0IGVudHJpZXNcbiAgaWYgKGFwcENvbmZpZy5hc3NldHMpIHtcbiAgICBjb25zdCBjb3B5V2VicGFja1BsdWdpblBhdHRlcm5zID0gYXBwQ29uZmlnLmFzc2V0cy5tYXAoKGFzc2V0OiBBc3NldFBhdHRlcm4pID0+IHtcbiAgICAgIC8vIEFkZCBkZWZhdWx0cy5cbiAgICAgIC8vIElucHV0IGlzIGFsd2F5cyByZXNvbHZlZCByZWxhdGl2ZSB0byB0aGUgcHJvamVjdFJvb3QuXG4gICAgICAvLyBUT0RPOiBhZGQgc21hcnQgZGVmYXVsdHMgdG8gc2NoZW1hIHRvIHVzZSBwcm9qZWN0IHJvb3QgYXMgZGVmYXVsdC5cbiAgICAgIGFzc2V0LmlucHV0ID0gcGF0aC5yZXNvbHZlKHJvb3QsIGFzc2V0LmlucHV0IHx8IHByb2plY3RSb290KS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgICBhc3NldC5vdXRwdXQgPSBhc3NldC5vdXRwdXQgfHwgJyc7XG4gICAgICBhc3NldC5nbG9iID0gYXNzZXQuZ2xvYiB8fCAnJztcblxuICAgICAgLy8gUHJldmVudCBhc3NldCBjb25maWd1cmF0aW9ucyBmcm9tIHdyaXRpbmcgb3V0c2lkZSBvZiB0aGUgb3V0cHV0IHBhdGgsIGV4Y2VwdCBpZiB0aGUgdXNlclxuICAgICAgLy8gc3BlY2lmeSBhIGNvbmZpZ3VyYXRpb24gZmxhZy5cbiAgICAgIC8vIEFsc28gcHJldmVudCB3cml0aW5nIG91dHNpZGUgdGhlIHByb2plY3QgcGF0aC4gVGhhdCBpcyBub3Qgb3ZlcnJpZGFibGUuXG4gICAgICBjb25zdCBhYnNvbHV0ZU91dHB1dFBhdGggPSBwYXRoLnJlc29sdmUocHJvamVjdFJvb3QsIGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoIGFzIHN0cmluZyk7XG4gICAgICBjb25zdCBhYnNvbHV0ZUFzc2V0T3V0cHV0ID0gcGF0aC5yZXNvbHZlKGFic29sdXRlT3V0cHV0UGF0aCwgYXNzZXQub3V0cHV0KTtcbiAgICAgIGNvbnN0IG91dHB1dFJlbGF0aXZlT3V0cHV0ID0gcGF0aC5yZWxhdGl2ZShhYnNvbHV0ZU91dHB1dFBhdGgsIGFic29sdXRlQXNzZXRPdXRwdXQpO1xuXG4gICAgICBpZiAob3V0cHV0UmVsYXRpdmVPdXRwdXQuc3RhcnRzV2l0aCgnLi4nKSB8fCBwYXRoLmlzQWJzb2x1dGUob3V0cHV0UmVsYXRpdmVPdXRwdXQpKSB7XG5cbiAgICAgICAgLy8gVE9ETzogVGhpcyBjaGVjayBkb2Vzbid0IG1ha2UgYSBsb3Qgb2Ygc2Vuc2UgYW55bW9yZSB3aXRoIG11bHRpcGxlIHByb2plY3QuIFJldmlldyBpdC5cbiAgICAgICAgLy8gY29uc3QgcHJvamVjdFJlbGF0aXZlT3V0cHV0ID0gcGF0aC5yZWxhdGl2ZShwcm9qZWN0Um9vdCwgYWJzb2x1dGVBc3NldE91dHB1dCk7XG4gICAgICAgIC8vIGlmIChwcm9qZWN0UmVsYXRpdmVPdXRwdXQuc3RhcnRzV2l0aCgnLi4nKSB8fCBwYXRoLmlzQWJzb2x1dGUocHJvamVjdFJlbGF0aXZlT3V0cHV0KSkge1xuICAgICAgICAvLyAgIGNvbnN0IG1lc3NhZ2UgPSAnQW4gYXNzZXQgY2Fubm90IGJlIHdyaXR0ZW4gdG8gYSBsb2NhdGlvbiBvdXRzaWRlIHRoZSBwcm9qZWN0Lic7XG4gICAgICAgIC8vICAgdGhyb3cgbmV3IFNpbGVudEVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAvLyB9XG5cbiAgICAgICAgaWYgKCFhc3NldC5hbGxvd091dHNpZGVPdXREaXIpIHtcbiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gJ0FuIGFzc2V0IGNhbm5vdCBiZSB3cml0dGVuIHRvIGEgbG9jYXRpb24gb3V0c2lkZSBvZiB0aGUgb3V0cHV0IHBhdGguICdcbiAgICAgICAgICAgICsgJ1lvdSBjYW4gb3ZlcnJpZGUgdGhpcyBtZXNzYWdlIGJ5IHNldHRpbmcgdGhlIGBhbGxvd091dHNpZGVPdXREaXJgICdcbiAgICAgICAgICAgICsgJ3Byb3BlcnR5IG9uIHRoZSBhc3NldCB0byB0cnVlIGluIHRoZSBDTEkgY29uZmlndXJhdGlvbi4nO1xuICAgICAgICAgIHRocm93IG5ldyBTaWxlbnRFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBUT0RPOiBUaGlzIGNoZWNrIGRvZXNuJ3QgbWFrZSBhIGxvdCBvZiBzZW5zZSBhbnltb3JlIHdpdGggbXVsdGlwbGUgcHJvamVjdC4gUmV2aWV3IGl0LlxuICAgICAgLy8gUHJldmVudCBhc3NldCBjb25maWd1cmF0aW9ucyBmcm9tIHJlYWRpbmcgZmlsZXMgb3V0c2lkZSBvZiB0aGUgcHJvamVjdC5cbiAgICAgIC8vIGNvbnN0IHByb2plY3RSZWxhdGl2ZUlucHV0ID0gcGF0aC5yZWxhdGl2ZShwcm9qZWN0Um9vdCwgYXNzZXQuaW5wdXQpO1xuICAgICAgLy8gaWYgKHByb2plY3RSZWxhdGl2ZUlucHV0LnN0YXJ0c1dpdGgoJy4uJykgfHwgcGF0aC5pc0Fic29sdXRlKHByb2plY3RSZWxhdGl2ZUlucHV0KSkge1xuICAgICAgLy8gICBjb25zdCBtZXNzYWdlID0gJ0FuIGFzc2V0IGNhbm5vdCBiZSByZWFkIGZyb20gYSBsb2NhdGlvbiBvdXRzaWRlIHRoZSBwcm9qZWN0Lic7XG4gICAgICAvLyAgIHRocm93IG5ldyBTaWxlbnRFcnJvcihtZXNzYWdlKTtcbiAgICAgIC8vIH1cblxuICAgICAgLy8gRW5zdXJlIHRyYWlsaW5nIHNsYXNoLlxuICAgICAgaWYgKGlzRGlyZWN0b3J5KHBhdGgucmVzb2x2ZShhc3NldC5pbnB1dCkpKSB7XG4gICAgICAgIGFzc2V0LmlucHV0ICs9ICcvJztcbiAgICAgIH1cblxuICAgICAgLy8gQ29udmVydCBkaXIgcGF0dGVybnMgdG8gZ2xvYnMuXG4gICAgICBpZiAoaXNEaXJlY3RvcnkocGF0aC5yZXNvbHZlKGFzc2V0LmlucHV0LCBhc3NldC5nbG9iKSkpIHtcbiAgICAgICAgYXNzZXQuZ2xvYiA9IGFzc2V0Lmdsb2IgKyAnLyoqLyonO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBjb250ZXh0OiBhc3NldC5pbnB1dCxcbiAgICAgICAgdG86IGFzc2V0Lm91dHB1dCxcbiAgICAgICAgZnJvbToge1xuICAgICAgICAgIGdsb2I6IGFzc2V0Lmdsb2IsXG4gICAgICAgICAgZG90OiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG5cbiAgICBjb25zdCBjb3B5V2VicGFja1BsdWdpbk9wdGlvbnMgPSB7IGlnbm9yZTogWycuZ2l0a2VlcCcsICcqKi8uRFNfU3RvcmUnLCAnKiovVGh1bWJzLmRiJ10gfTtcblxuICAgIGNvbnN0IGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UgPSBuZXcgQ29weVdlYnBhY2tQbHVnaW4oY29weVdlYnBhY2tQbHVnaW5QYXR0ZXJucyxcbiAgICAgIGNvcHlXZWJwYWNrUGx1Z2luT3B0aW9ucyk7XG5cbiAgICAvLyBTYXZlIG9wdGlvbnMgc28gd2UgY2FuIHVzZSB0aGVtIGluIGVqZWN0LlxuICAgIChjb3B5V2VicGFja1BsdWdpbkluc3RhbmNlIGFzIGFueSlbJ2NvcHlXZWJwYWNrUGx1Z2luUGF0dGVybnMnXSA9IGNvcHlXZWJwYWNrUGx1Z2luUGF0dGVybnM7XG4gICAgKGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UgYXMgYW55KVsnY29weVdlYnBhY2tQbHVnaW5PcHRpb25zJ10gPSBjb3B5V2VicGFja1BsdWdpbk9wdGlvbnM7XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChjb3B5V2VicGFja1BsdWdpbkluc3RhbmNlKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMucHJvZ3Jlc3MpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgUHJvZ3Jlc3NQbHVnaW4oeyBwcm9maWxlOiBidWlsZE9wdGlvbnMudmVyYm9zZSwgY29sb3JzOiB0cnVlIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc2hvd0NpcmN1bGFyRGVwZW5kZW5jaWVzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IENpcmN1bGFyRGVwZW5kZW5jeVBsdWdpbih7XG4gICAgICBleGNsdWRlOiAvW1xcXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFxcXC9dL1xuICAgIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3RhdHNKc29uKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN0YXRzUGx1Z2luKCdzdGF0cy5qc29uJywgJ3ZlcmJvc2UnKSk7XG4gIH1cblxuICBsZXQgYnVpbGRPcHRpbWl6ZXJVc2VSdWxlO1xuICBpZiAoYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyKSB7XG4gICAgLy8gU2V0IHRoZSBjYWNoZSBkaXJlY3RvcnkgdG8gdGhlIEJ1aWxkIE9wdGltaXplciBkaXIsIHNvIHRoYXQgcGFja2FnZSB1cGRhdGVzIHdpbGwgZGVsZXRlIGl0LlxuICAgIGNvbnN0IGJ1aWxkT3B0aW1pemVyRGlyID0gcGF0aC5kaXJuYW1lKFxuICAgICAgcmVzb2x2ZS5zeW5jKCdAYW5ndWxhci1kZXZraXQvYnVpbGQtb3B0aW1pemVyJywgeyBiYXNlZGlyOiBwcm9qZWN0Um9vdCB9KSk7XG4gICAgY29uc3QgY2FjaGVEaXJlY3RvcnkgPSBwYXRoLnJlc29sdmUoYnVpbGRPcHRpbWl6ZXJEaXIsICcuLy5jYWNoZS8nKTtcblxuICAgIGJ1aWxkT3B0aW1pemVyVXNlUnVsZSA9IHtcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiAnY2FjaGUtbG9hZGVyJyxcbiAgICAgICAgICBvcHRpb25zOiB7IGNhY2hlRGlyZWN0b3J5IH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXIvd2VicGFjay1sb2FkZXInLFxuICAgICAgICAgIG9wdGlvbnM6IHsgc291cmNlTWFwOiBidWlsZE9wdGlvbnMuc291cmNlTWFwIH1cbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfTtcbiAgfVxuXG4gIC8vIEFsbG93IGxvYWRlcnMgdG8gYmUgaW4gYSBub2RlX21vZHVsZXMgbmVzdGVkIGluc2lkZSB0aGUgQ0xJIHBhY2thZ2VcbiAgY29uc3QgbG9hZGVyTm9kZU1vZHVsZXMgPSBbJ25vZGVfbW9kdWxlcyddO1xuICBjb25zdCBwb3RlbnRpYWxOb2RlTW9kdWxlcyA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdub2RlX21vZHVsZXMnKTtcbiAgaWYgKGlzRGlyZWN0b3J5KHBvdGVudGlhbE5vZGVNb2R1bGVzKSkge1xuICAgIGxvYWRlck5vZGVNb2R1bGVzLnB1c2gocG90ZW50aWFsTm9kZU1vZHVsZXMpO1xuICB9XG5cbiAgLy8gTG9hZCByeGpzIHBhdGggYWxpYXNlcy5cbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL1JlYWN0aXZlWC9yeGpzL2Jsb2IvbWFzdGVyL2RvYy9sZXR0YWJsZS1vcGVyYXRvcnMubWQjYnVpbGQtYW5kLXRyZWVzaGFraW5nXG4gIGxldCBhbGlhcyA9IHt9O1xuICB0cnkge1xuICAgIGNvbnN0IHJ4anNQYXRoTWFwcGluZ0ltcG9ydCA9IHdjby5zdXBwb3J0RVMyMDE1XG4gICAgICA/ICdyeGpzL19lc20yMDE1L3BhdGgtbWFwcGluZydcbiAgICAgIDogJ3J4anMvX2VzbTUvcGF0aC1tYXBwaW5nJztcbiAgICBjb25zdCByeFBhdGhzID0gcmVxdWlyZVByb2plY3RNb2R1bGUocHJvamVjdFJvb3QsIHJ4anNQYXRoTWFwcGluZ0ltcG9ydCk7XG4gICAgYWxpYXMgPSByeFBhdGhzKG5vZGVNb2R1bGVzKTtcbiAgfSBjYXRjaCAoZSkgeyB9XG5cbiAgcmV0dXJuIHtcbiAgICBtb2RlOiBidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uID8gJ3Byb2R1Y3Rpb24nOiAnZGV2ZWxvcG1lbnQnLFxuICAgIGRldnRvb2w6IGZhbHNlLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnLnRzJywgJy5qcyddLFxuICAgICAgc3ltbGlua3M6ICFidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgIG1vZHVsZXM6IFtcbiAgICAgICAgd2NvLnRzQ29uZmlnLmJhc2VVcmwgfHwgcHJvamVjdFJvb3QsXG4gICAgICAgICdub2RlX21vZHVsZXMnLFxuICAgICAgXSxcbiAgICAgIGFsaWFzXG4gICAgfSxcbiAgICByZXNvbHZlTG9hZGVyOiB7XG4gICAgICBtb2R1bGVzOiBsb2FkZXJOb2RlTW9kdWxlc1xuICAgIH0sXG4gICAgY29udGV4dDogcHJvamVjdFJvb3QsXG4gICAgZW50cnk6IGVudHJ5UG9pbnRzLFxuICAgIG91dHB1dDoge1xuICAgICAgcGF0aDogcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoIGFzIHN0cmluZyksXG4gICAgICBwdWJsaWNQYXRoOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICB9LFxuICAgIHBlcmZvcm1hbmNlOiB7XG4gICAgICBoaW50czogZmFsc2UsXG4gICAgfSxcbiAgICBtb2R1bGU6IHtcbiAgICAgIHJ1bGVzOiBbXG4gICAgICAgIHsgdGVzdDogL1xcLmh0bWwkLywgbG9hZGVyOiAncmF3LWxvYWRlcicgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC4oZW90fHN2Z3xjdXIpJC8sXG4gICAgICAgICAgbG9hZGVyOiAnZmlsZS1sb2FkZXInLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIG5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuZmlsZX0uW2V4dF1gLFxuICAgICAgICAgICAgbGltaXQ6IDEwMDAwXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLihqcGd8cG5nfHdlYnB8Z2lmfG90Znx0dGZ8d29mZnx3b2ZmMnxhbmkpJC8sXG4gICAgICAgICAgbG9hZGVyOiAndXJsLWxvYWRlcicsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5maWxlfS5bZXh0XWAsXG4gICAgICAgICAgICBsaW1pdDogMTAwMDBcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvW1xcL1xcXFxdQGFuZ3VsYXJbXFwvXFxcXF0uK1xcLmpzJC8sXG4gICAgICAgICAgc2lkZUVmZmVjdHM6IGZhbHNlLFxuICAgICAgICAgIHBhcnNlcjogeyBzeXN0ZW06IHRydWUgfSxcbiAgICAgICAgICAuLi5idWlsZE9wdGltaXplclVzZVJ1bGUsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuanMkLyxcbiAgICAgICAgICAuLi5idWlsZE9wdGltaXplclVzZVJ1bGUsXG4gICAgICAgIH0sXG4gICAgICBdXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG5vRW1pdE9uRXJyb3JzOiB0cnVlLFxuICAgICAgbWluaW1pemVyOiBbXG4gICAgICAgIG5ldyBIYXNoZWRNb2R1bGVJZHNQbHVnaW4oKSxcbiAgICAgICAgLy8gVE9ETzogY2hlY2sgd2l0aCBNaWtlIHdoYXQgdGhpcyBmZWF0dXJlIG5lZWRzLlxuICAgICAgICBuZXcgQnVuZGxlQnVkZ2V0UGx1Z2luKHsgYnVkZ2V0czogYXBwQ29uZmlnLmJ1ZGdldHMgfSksXG4gICAgICAgIG5ldyBDbGVhbkNzc1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICAgIHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCxcbiAgICAgICAgICAvLyBjb21wb25lbnQgc3R5bGVzIHJldGFpbiB0aGVpciBvcmlnaW5hbCBmaWxlIG5hbWVcbiAgICAgICAgICB0ZXN0OiAoZmlsZSkgPT4gL1xcLig/OmNzc3xzY3NzfHNhc3N8bGVzc3xzdHlsKSQvLnRlc3QoZmlsZSksXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgVWdsaWZ5SlNQbHVnaW4oe1xuICAgICAgICAgIHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCxcbiAgICAgICAgICBwYXJhbGxlbDogdHJ1ZSxcbiAgICAgICAgICBjYWNoZTogdHJ1ZSxcbiAgICAgICAgICB1Z2xpZnlPcHRpb25zOiB7XG4gICAgICAgICAgICBlY21hOiB3Y28uc3VwcG9ydEVTMjAxNSA/IDYgOiA1LFxuICAgICAgICAgICAgd2FybmluZ3M6IGJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAgICAgc2FmYXJpMTA6IHRydWUsXG4gICAgICAgICAgICBjb21wcmVzczoge1xuICAgICAgICAgICAgICBwdXJlX2dldHRlcnM6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgICAgICAgICAgLy8gUFVSRSBjb21tZW50cyB3b3JrIGJlc3Qgd2l0aCAzIHBhc3Nlcy5cbiAgICAgICAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrL3dlYnBhY2svaXNzdWVzLzI4OTkjaXNzdWVjb21tZW50LTMxNzQyNTkyNi5cbiAgICAgICAgICAgICAgcGFzc2VzOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIgPyAzIDogMSxcbiAgICAgICAgICAgICAgLy8gV29ya2Fyb3VuZCBrbm93biB1Z2xpZnktZXMgaXNzdWVcbiAgICAgICAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taXNob28vVWdsaWZ5SlMyL2lzc3Vlcy8yOTQ5I2lzc3VlY29tbWVudC0zNjgwNzAzMDdcbiAgICAgICAgICAgICAgaW5saW5lOiB3Y28uc3VwcG9ydEVTMjAxNSA/IDEgOiAzLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG91dHB1dDoge1xuICAgICAgICAgICAgICBhc2NpaV9vbmx5OiB0cnVlLFxuICAgICAgICAgICAgICBjb21tZW50czogZmFsc2UsXG4gICAgICAgICAgICAgIHdlYmtpdDogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gIH07XG59XG4iXX0=