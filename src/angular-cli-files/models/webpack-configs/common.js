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
        const globalScriptsByBundleName = buildOptions.scripts
            .reduce((prev, curr) => {
            const bundleName = utils_2.computeBundleName(curr, 'scripts');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsaUJBQWlCO0FBQ2pCLCtEQUErRDs7QUFFL0QsNkJBQTZCO0FBQzdCLHFDQUFnRDtBQUNoRCx5REFBeUQ7QUFDekQsbUNBQThDO0FBQzlDLCtEQUEyRDtBQUMzRCxtRkFBOEU7QUFFOUUsK0RBQWlFO0FBQ2pFLG1GQUE4RTtBQUM5RSxpRkFBNEU7QUFDNUUscURBQWlEO0FBRWpELG1DQUE0QztBQUU1QyxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUM3RCxNQUFNLHdCQUF3QixHQUFHLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBQ3ZFLE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQzFELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBQ3BELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUM1QyxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7QUFFbkM7Ozs7Ozs7Ozs7R0FVRztBQUVILHlCQUFnQyxHQUF5QjtJQUN2RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFFaEQsTUFBTSxXQUFXLEdBQUcsZ0JBQU0sQ0FBQyxjQUFjLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDeEQsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBQ2pCLE1BQU0sSUFBSSxLQUFLLENBQUMsdUNBQXVDLENBQUMsQ0FBQTtJQUMxRCxDQUFDO0lBRUQsSUFB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QUMvQixRQUFRLEVBQUUsWUFBWSxDQUFDLE9BQU87d0JBQzlCLFFBQVEsRUFBRSxJQUFJO3dCQUNkLFFBQVEsRUFBRTs0QkFDUixZQUFZLEVBQUUsWUFBWSxDQUFDLGNBQWM7NEJBQ3pDLHlDQUF5Qzs0QkFDekMsNkVBQTZFOzRCQUM3RSxNQUFNLEVBQUUsWUFBWSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDOzRCQUMzQyxtQ0FBbUM7NEJBQ25DLDZFQUE2RTs0QkFDN0UsTUFBTSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzt5QkFDbEM7d0JBQ0QsTUFBTSxFQUFFOzRCQUNOLFVBQVUsRUFBRSxJQUFJOzRCQUNoQixRQUFRLEVBQUUsS0FBSzs0QkFDZixNQUFNLEVBQUUsSUFBSTt5QkFDYjtxQkFDRjtpQkFDRixDQUFDO2FBQ0g7U0FDRjtRQUNELE9BQU8sRUFBRSxZQUFZO0tBQ3RCLENBQUM7QUFDSixDQUFDO0FBL1BELDBDQStQQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIHRzbGludDpkaXNhYmxlXG4vLyBUT0RPOiBjbGVhbnVwIHRoaXMgZmlsZSwgaXQncyBjb3BpZWQgYXMgaXMgZnJvbSBBbmd1bGFyIENMSS5cblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEhhc2hlZE1vZHVsZUlkc1BsdWdpbiB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0ICogYXMgQ29weVdlYnBhY2tQbHVnaW4gZnJvbSAnY29weS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgeyBnZXRPdXRwdXRIYXNoRm9ybWF0IH0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQgeyBpc0RpcmVjdG9yeSB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9pcy1kaXJlY3RvcnknO1xuaW1wb3J0IHsgcmVxdWlyZVByb2plY3RNb2R1bGUgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvcmVxdWlyZS1wcm9qZWN0LW1vZHVsZSc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgQnVuZGxlQnVkZ2V0UGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9idW5kbGUtYnVkZ2V0JztcbmltcG9ydCB7IENsZWFuQ3NzV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvY2xlYW5jc3Mtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgU2NyaXB0c1dlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL3NjcmlwdHMtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgZmluZFVwIH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL2ZpbmQtdXAnO1xuaW1wb3J0IHsgQXNzZXRQYXR0ZXJuLCBFeHRyYUVudHJ5UG9pbnQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyJztcbmltcG9ydCB7IGNvbXB1dGVCdW5kbGVOYW1lIH0gZnJvbSAnLi91dGlscyc7XG5cbmNvbnN0IFByb2dyZXNzUGx1Z2luID0gcmVxdWlyZSgnd2VicGFjay9saWIvUHJvZ3Jlc3NQbHVnaW4nKTtcbmNvbnN0IENpcmN1bGFyRGVwZW5kZW5jeVBsdWdpbiA9IHJlcXVpcmUoJ2NpcmN1bGFyLWRlcGVuZGVuY3ktcGx1Z2luJyk7XG5jb25zdCBVZ2xpZnlKU1BsdWdpbiA9IHJlcXVpcmUoJ3VnbGlmeWpzLXdlYnBhY2stcGx1Z2luJyk7XG5jb25zdCBTdGF0c1BsdWdpbiA9IHJlcXVpcmUoJ3N0YXRzLXdlYnBhY2stcGx1Z2luJyk7XG5jb25zdCBTaWxlbnRFcnJvciA9IHJlcXVpcmUoJ3NpbGVudC1lcnJvcicpO1xuY29uc3QgcmVzb2x2ZSA9IHJlcXVpcmUoJ3Jlc29sdmUnKTtcblxuLyoqXG4gKiBFbnVtZXJhdGUgbG9hZGVycyBhbmQgdGhlaXIgZGVwZW5kZW5jaWVzIGZyb20gdGhpcyBmaWxlIHRvIGxldCB0aGUgZGVwZW5kZW5jeSB2YWxpZGF0b3JcbiAqIGtub3cgdGhleSBhcmUgdXNlZC5cbiAqXG4gKiByZXF1aXJlKCdzb3VyY2UtbWFwLWxvYWRlcicpXG4gKiByZXF1aXJlKCdyYXctbG9hZGVyJylcbiAqIHJlcXVpcmUoJ3VybC1sb2FkZXInKVxuICogcmVxdWlyZSgnZmlsZS1sb2FkZXInKVxuICogcmVxdWlyZSgnY2FjaGUtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXInKVxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDb21tb25Db25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucykge1xuICBjb25zdCB7IHJvb3QsIHByb2plY3RSb290LCBidWlsZE9wdGlvbnMgfSA9IHdjbztcblxuICBjb25zdCBub2RlTW9kdWxlcyA9IGZpbmRVcCgnbm9kZV9tb2R1bGVzJywgcHJvamVjdFJvb3QpO1xuICBpZiAoIW5vZGVNb2R1bGVzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgbG9jYXRlIG5vZGVfbW9kdWxlcyBkaXJlY3RvcnkuJylcbiAgfVxuXG4gIGxldCBleHRyYVBsdWdpbnM6IGFueVtdID0gW107XG4gIGxldCBlbnRyeVBvaW50czogeyBba2V5OiBzdHJpbmddOiBzdHJpbmdbXSB9ID0ge307XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5tYWluKSB7XG4gICAgZW50cnlQb2ludHNbJ21haW4nXSA9IFtwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm1haW4pXTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMucG9seWZpbGxzKSB7XG4gICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gW3BhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMucG9seWZpbGxzKV07XG4gIH1cblxuICAvLyBkZXRlcm1pbmUgaGFzaGluZyBmb3JtYXRcbiAgY29uc3QgaGFzaEZvcm1hdCA9IGdldE91dHB1dEhhc2hGb3JtYXQoYnVpbGRPcHRpb25zLm91dHB1dEhhc2hpbmcgYXMgYW55KTtcblxuICAvLyBwcm9jZXNzIGdsb2JhbCBzY3JpcHRzXG4gIGlmIChidWlsZE9wdGlvbnMuc2NyaXB0cy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZSA9IChidWlsZE9wdGlvbnMuc2NyaXB0cyBhcyBFeHRyYUVudHJ5UG9pbnRbXSlcbiAgICAgIC5yZWR1Y2UoKHByZXY6IHsgYnVuZGxlTmFtZTogc3RyaW5nLCBwYXRoczogc3RyaW5nW10sIGxhenk6IGJvb2xlYW4gfVtdLCBjdXJyKSA9PiB7XG4gICAgICAgIGNvbnN0IGJ1bmRsZU5hbWUgPSBjb21wdXRlQnVuZGxlTmFtZShjdXJyLCAnc2NyaXB0cycpO1xuICAgICAgICBjb25zdCByZXNvbHZlZFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgY3Vyci5pbnB1dCk7XG4gICAgICAgIGxldCBleGlzdGluZ0VudHJ5ID0gcHJldi5maW5kKChlbCkgPT4gZWwuYnVuZGxlTmFtZSA9PT0gYnVuZGxlTmFtZSk7XG4gICAgICAgIGlmIChleGlzdGluZ0VudHJ5KSB7XG4gICAgICAgICAgaWYgKGV4aXN0aW5nRW50cnkubGF6eSAmJiAhY3Vyci5sYXp5KSB7XG4gICAgICAgICAgICAvLyBBbGwgZW50cmllcyBoYXZlIHRvIGJlIGxhenkgZm9yIHRoZSBidW5kbGUgdG8gYmUgbGF6eS5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlICR7Y3Vyci5idW5kbGVOYW1lfSBidW5kbGUgaXMgbWl4aW5nIGxhenkgYW5kIG5vbi1sYXp5IHNjcmlwdHMuYCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZXhpc3RpbmdFbnRyeS5wYXRocy5wdXNoKHJlc29sdmVkUGF0aCk7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwcmV2LnB1c2goe1xuICAgICAgICAgICAgYnVuZGxlTmFtZSxcbiAgICAgICAgICAgIHBhdGhzOiBbcmVzb2x2ZWRQYXRoXSxcbiAgICAgICAgICAgIGxhenk6IGN1cnIubGF6eVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwcmV2O1xuICAgICAgfSwgW10pO1xuXG5cbiAgICAvLyBBZGQgYSBuZXcgYXNzZXQgZm9yIGVhY2ggZW50cnkuXG4gICAgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZS5mb3JFYWNoKChzY3JpcHQpID0+IHtcbiAgICAgIC8vIExhenkgc2NyaXB0cyBkb24ndCBnZXQgYSBoYXNoLCBvdGhlcndpc2UgdGhleSBjYW4ndCBiZSBsb2FkZWQgYnkgbmFtZS5cbiAgICAgIGNvbnN0IGhhc2ggPSBzY3JpcHQubGF6eSA/ICcnIDogaGFzaEZvcm1hdC5zY3JpcHQ7XG4gICAgICBjb25zdCBidW5kbGVOYW1lID0gc2NyaXB0LmJ1bmRsZU5hbWU7XG5cbiAgICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBTY3JpcHRzV2VicGFja1BsdWdpbih7XG4gICAgICAgIG5hbWU6IGJ1bmRsZU5hbWUsXG4gICAgICAgIHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCxcbiAgICAgICAgZmlsZW5hbWU6IGAke3BhdGguYmFzZW5hbWUoYnVuZGxlTmFtZSl9JHtoYXNofS5qc2AsXG4gICAgICAgIHNjcmlwdHM6IHNjcmlwdC5wYXRocyxcbiAgICAgICAgYmFzZVBhdGg6IHByb2plY3RSb290LFxuICAgICAgfSkpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gcHJvY2VzcyBhc3NldCBlbnRyaWVzXG4gIGlmIChidWlsZE9wdGlvbnMuYXNzZXRzKSB7XG4gICAgY29uc3QgY29weVdlYnBhY2tQbHVnaW5QYXR0ZXJucyA9IGJ1aWxkT3B0aW9ucy5hc3NldHMubWFwKChhc3NldDogQXNzZXRQYXR0ZXJuKSA9PiB7XG5cbiAgICAgIC8vIFJlc29sdmUgaW5wdXQgcGF0aHMgcmVsYXRpdmUgdG8gd29ya3NwYWNlIHJvb3QgYW5kIGFkZCBzbGFzaCBhdCB0aGUgZW5kLlxuICAgICAgYXNzZXQuaW5wdXQgPSBwYXRoLnJlc29sdmUocm9vdCwgYXNzZXQuaW5wdXQpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICAgIGFzc2V0LmlucHV0ID0gYXNzZXQuaW5wdXQuZW5kc1dpdGgoJy8nKSA/IGFzc2V0LmlucHV0IDogYXNzZXQuaW5wdXQgKyAnLyc7XG4gICAgICBhc3NldC5vdXRwdXQgPSBhc3NldC5vdXRwdXQuZW5kc1dpdGgoJy8nKSA/IGFzc2V0Lm91dHB1dCA6IGFzc2V0Lm91dHB1dCArICcvJztcblxuICAgICAgaWYgKGFzc2V0Lm91dHB1dC5zdGFydHNXaXRoKCcuLicpKSB7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSAnQW4gYXNzZXQgY2Fubm90IGJlIHdyaXR0ZW4gdG8gYSBsb2NhdGlvbiBvdXRzaWRlIG9mIHRoZSAuICdcbiAgICAgICAgICArICdZb3UgY2FuIG92ZXJyaWRlIHRoaXMgbWVzc2FnZSBieSBzZXR0aW5nIHRoZSBgYWxsb3dPdXRzaWRlT3V0RGlyYCAnXG4gICAgICAgICAgKyAncHJvcGVydHkgb24gdGhlIGFzc2V0IHRvIHRydWUgaW4gdGhlIENMSSBjb25maWd1cmF0aW9uLic7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGFzc2V0Lm91dHB1dC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICAgICAgLy8gTm93IHdlIHJlbW92ZSBzdGFydGluZyBzbGFzaCB0byBtYWtlIFdlYnBhY2sgcGxhY2UgaXQgZnJvbSB0aGUgb3V0cHV0IHJvb3QuXG4gICAgICAgIGFzc2V0Lm91dHB1dCA9IGFzc2V0Lm91dHB1dC5zbGljZSgxKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY29udGV4dDogYXNzZXQuaW5wdXQsXG4gICAgICAgIHRvOiBhc3NldC5vdXRwdXQsXG4gICAgICAgIGZyb206IHtcbiAgICAgICAgICBnbG9iOiBhc3NldC5nbG9iLFxuICAgICAgICAgIGRvdDogdHJ1ZVxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgY29uc3QgY29weVdlYnBhY2tQbHVnaW5PcHRpb25zID0geyBpZ25vcmU6IFsnLmdpdGtlZXAnLCAnKiovLkRTX1N0b3JlJywgJyoqL1RodW1icy5kYiddIH07XG5cbiAgICBjb25zdCBjb3B5V2VicGFja1BsdWdpbkluc3RhbmNlID0gbmV3IENvcHlXZWJwYWNrUGx1Z2luKGNvcHlXZWJwYWNrUGx1Z2luUGF0dGVybnMsXG4gICAgICBjb3B5V2VicGFja1BsdWdpbk9wdGlvbnMpO1xuXG4gICAgLy8gU2F2ZSBvcHRpb25zIHNvIHdlIGNhbiB1c2UgdGhlbSBpbiBlamVjdC5cbiAgICAoY29weVdlYnBhY2tQbHVnaW5JbnN0YW5jZSBhcyBhbnkpWydjb3B5V2VicGFja1BsdWdpblBhdHRlcm5zJ10gPSBjb3B5V2VicGFja1BsdWdpblBhdHRlcm5zO1xuICAgIChjb3B5V2VicGFja1BsdWdpbkluc3RhbmNlIGFzIGFueSlbJ2NvcHlXZWJwYWNrUGx1Z2luT3B0aW9ucyddID0gY29weVdlYnBhY2tQbHVnaW5PcHRpb25zO1xuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goY29weVdlYnBhY2tQbHVnaW5JbnN0YW5jZSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnByb2dyZXNzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFByb2dyZXNzUGx1Z2luKHsgcHJvZmlsZTogYnVpbGRPcHRpb25zLnZlcmJvc2UsIGNvbG9yczogdHJ1ZSB9KSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnNob3dDaXJjdWxhckRlcGVuZGVuY2llcykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBDaXJjdWxhckRlcGVuZGVuY3lQbHVnaW4oe1xuICAgICAgZXhjbHVkZTogL1tcXFxcXFwvXW5vZGVfbW9kdWxlc1tcXFxcXFwvXS9cbiAgICB9KSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnN0YXRzSnNvbikge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBTdGF0c1BsdWdpbignc3RhdHMuanNvbicsICd2ZXJib3NlJykpO1xuICB9XG5cbiAgbGV0IGJ1aWxkT3B0aW1pemVyVXNlUnVsZTtcbiAgaWYgKGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcikge1xuICAgIC8vIFNldCB0aGUgY2FjaGUgZGlyZWN0b3J5IHRvIHRoZSBCdWlsZCBPcHRpbWl6ZXIgZGlyLCBzbyB0aGF0IHBhY2thZ2UgdXBkYXRlcyB3aWxsIGRlbGV0ZSBpdC5cbiAgICBjb25zdCBidWlsZE9wdGltaXplckRpciA9IHBhdGguZGlybmFtZShcbiAgICAgIHJlc29sdmUuc3luYygnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLW9wdGltaXplcicsIHsgYmFzZWRpcjogcHJvamVjdFJvb3QgfSkpO1xuICAgIGNvbnN0IGNhY2hlRGlyZWN0b3J5ID0gcGF0aC5yZXNvbHZlKGJ1aWxkT3B0aW1pemVyRGlyLCAnLi8uY2FjaGUvJyk7XG5cbiAgICBidWlsZE9wdGltaXplclVzZVJ1bGUgPSB7XG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogJ2NhY2hlLWxvYWRlcicsXG4gICAgICAgICAgb3B0aW9uczogeyBjYWNoZURpcmVjdG9yeSB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6ICdAYW5ndWxhci1kZXZraXQvYnVpbGQtb3B0aW1pemVyL3dlYnBhY2stbG9hZGVyJyxcbiAgICAgICAgICBvcHRpb25zOiB7IHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCB9XG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH07XG4gIH1cblxuICAvLyBBbGxvdyBsb2FkZXJzIHRvIGJlIGluIGEgbm9kZV9tb2R1bGVzIG5lc3RlZCBpbnNpZGUgdGhlIENMSSBwYWNrYWdlXG4gIGNvbnN0IGxvYWRlck5vZGVNb2R1bGVzID0gWydub2RlX21vZHVsZXMnXTtcbiAgY29uc3QgcG90ZW50aWFsTm9kZU1vZHVsZXMgPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAnbm9kZV9tb2R1bGVzJyk7XG4gIGlmIChpc0RpcmVjdG9yeShwb3RlbnRpYWxOb2RlTW9kdWxlcykpIHtcbiAgICBsb2FkZXJOb2RlTW9kdWxlcy5wdXNoKHBvdGVudGlhbE5vZGVNb2R1bGVzKTtcbiAgfVxuXG4gIC8vIExvYWQgcnhqcyBwYXRoIGFsaWFzZXMuXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9ibG9iL21hc3Rlci9kb2MvbGV0dGFibGUtb3BlcmF0b3JzLm1kI2J1aWxkLWFuZC10cmVlc2hha2luZ1xuICBsZXQgYWxpYXMgPSB7fTtcbiAgdHJ5IHtcbiAgICBjb25zdCByeGpzUGF0aE1hcHBpbmdJbXBvcnQgPSB3Y28uc3VwcG9ydEVTMjAxNVxuICAgICAgPyAncnhqcy9fZXNtMjAxNS9wYXRoLW1hcHBpbmcnXG4gICAgICA6ICdyeGpzL19lc201L3BhdGgtbWFwcGluZyc7XG4gICAgY29uc3QgcnhQYXRocyA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKHByb2plY3RSb290LCByeGpzUGF0aE1hcHBpbmdJbXBvcnQpO1xuICAgIGFsaWFzID0gcnhQYXRocyhub2RlTW9kdWxlcyk7XG4gIH0gY2F0Y2ggKGUpIHsgfVxuXG4gIHJldHVybiB7XG4gICAgbW9kZTogYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbiA/ICdwcm9kdWN0aW9uJyA6ICdkZXZlbG9wbWVudCcsXG4gICAgZGV2dG9vbDogZmFsc2UsXG4gICAgcmVzb2x2ZToge1xuICAgICAgZXh0ZW5zaW9uczogWycudHMnLCAnLmpzJ10sXG4gICAgICBzeW1saW5rczogIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgbW9kdWxlczogW1xuICAgICAgICB3Y28udHNDb25maWcub3B0aW9ucy5iYXNlVXJsIHx8IHByb2plY3RSb290LFxuICAgICAgICAnbm9kZV9tb2R1bGVzJyxcbiAgICAgIF0sXG4gICAgICBhbGlhc1xuICAgIH0sXG4gICAgcmVzb2x2ZUxvYWRlcjoge1xuICAgICAgbW9kdWxlczogbG9hZGVyTm9kZU1vZHVsZXNcbiAgICB9LFxuICAgIGNvbnRleHQ6IHByb2plY3RSb290LFxuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBvdXRwdXQ6IHtcbiAgICAgIHBhdGg6IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCBhcyBzdHJpbmcpLFxuICAgICAgcHVibGljUGF0aDogYnVpbGRPcHRpb25zLmRlcGxveVVybCxcbiAgICAgIGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmNodW5rfS5qc2AsXG4gICAgfSxcbiAgICBwZXJmb3JtYW5jZToge1xuICAgICAgaGludHM6IGZhbHNlLFxuICAgIH0sXG4gICAgbW9kdWxlOiB7XG4gICAgICBydWxlczogW1xuICAgICAgICB7IHRlc3Q6IC9cXC5odG1sJC8sIGxvYWRlcjogJ3Jhdy1sb2FkZXInIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuKGVvdHxzdmd8Y3VyKSQvLFxuICAgICAgICAgIGxvYWRlcjogJ2ZpbGUtbG9hZGVyJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmZpbGV9LltleHRdYCxcbiAgICAgICAgICAgIGxpbWl0OiAxMDAwMFxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC4oanBnfHBuZ3x3ZWJwfGdpZnxvdGZ8dHRmfHdvZmZ8d29mZjJ8YW5pKSQvLFxuICAgICAgICAgIGxvYWRlcjogJ3VybC1sb2FkZXInLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIG5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuZmlsZX0uW2V4dF1gLFxuICAgICAgICAgICAgbGltaXQ6IDEwMDAwXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1tcXC9cXFxcXUBhbmd1bGFyW1xcL1xcXFxdLitcXC5qcyQvLFxuICAgICAgICAgIHNpZGVFZmZlY3RzOiBmYWxzZSxcbiAgICAgICAgICBwYXJzZXI6IHsgc3lzdGVtOiB0cnVlIH0sXG4gICAgICAgICAgLi4uYnVpbGRPcHRpbWl6ZXJVc2VSdWxlLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLmpzJC8sXG4gICAgICAgICAgLi4uYnVpbGRPcHRpbWl6ZXJVc2VSdWxlLFxuICAgICAgICB9LFxuICAgICAgXVxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICBub0VtaXRPbkVycm9yczogdHJ1ZSxcbiAgICAgIG1pbmltaXplcjogW1xuICAgICAgICBuZXcgSGFzaGVkTW9kdWxlSWRzUGx1Z2luKCksXG4gICAgICAgIC8vIFRPRE86IGNoZWNrIHdpdGggTWlrZSB3aGF0IHRoaXMgZmVhdHVyZSBuZWVkcy5cbiAgICAgICAgbmV3IEJ1bmRsZUJ1ZGdldFBsdWdpbih7IGJ1ZGdldHM6IGJ1aWxkT3B0aW9ucy5idWRnZXRzIH0pLFxuICAgICAgICBuZXcgQ2xlYW5Dc3NXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgICBzb3VyY2VNYXA6IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAsXG4gICAgICAgICAgLy8gY29tcG9uZW50IHN0eWxlcyByZXRhaW4gdGhlaXIgb3JpZ2luYWwgZmlsZSBuYW1lXG4gICAgICAgICAgdGVzdDogKGZpbGUpID0+IC9cXC4oPzpjc3N8c2Nzc3xzYXNzfGxlc3N8c3R5bCkkLy50ZXN0KGZpbGUpLFxuICAgICAgICB9KSxcbiAgICAgICAgbmV3IFVnbGlmeUpTUGx1Z2luKHtcbiAgICAgICAgICBzb3VyY2VNYXA6IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAsXG4gICAgICAgICAgcGFyYWxsZWw6IHRydWUsXG4gICAgICAgICAgY2FjaGU6IHRydWUsXG4gICAgICAgICAgdWdsaWZ5T3B0aW9uczoge1xuICAgICAgICAgICAgZWNtYTogd2NvLnN1cHBvcnRFUzIwMTUgPyA2IDogNSxcbiAgICAgICAgICAgIHdhcm5pbmdzOiBidWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgICAgIHNhZmFyaTEwOiB0cnVlLFxuICAgICAgICAgICAgY29tcHJlc3M6IHtcbiAgICAgICAgICAgICAgcHVyZV9nZXR0ZXJzOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICAgICAgICAgIC8vIFBVUkUgY29tbWVudHMgd29yayBiZXN0IHdpdGggMyBwYXNzZXMuXG4gICAgICAgICAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay93ZWJwYWNrL2lzc3Vlcy8yODk5I2lzc3VlY29tbWVudC0zMTc0MjU5MjYuXG4gICAgICAgICAgICAgIHBhc3NlczogYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyID8gMyA6IDEsXG4gICAgICAgICAgICAgIC8vIFdvcmthcm91bmQga25vd24gdWdsaWZ5LWVzIGlzc3VlXG4gICAgICAgICAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWlzaG9vL1VnbGlmeUpTMi9pc3N1ZXMvMjk0OSNpc3N1ZWNvbW1lbnQtMzY4MDcwMzA3XG4gICAgICAgICAgICAgIGlubGluZTogd2NvLnN1cHBvcnRFUzIwMTUgPyAxIDogMyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvdXRwdXQ6IHtcbiAgICAgICAgICAgICAgYXNjaWlfb25seTogdHJ1ZSxcbiAgICAgICAgICAgICAgY29tbWVudHM6IGZhbHNlLFxuICAgICAgICAgICAgICB3ZWJraXQ6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLFxuICB9O1xufVxuIl19