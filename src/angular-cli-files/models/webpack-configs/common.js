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
                ignore: asset.ignore,
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
                    test: /\.(eot|svg|cur|jpg|png|webp|gif|otf|ttf|woff|woff2|ani)$/,
                    loader: 'file-loader',
                    options: {
                        name: `[name]${hashFormat.file}.[ext]`,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HO0FBQ0gsaUJBQWlCO0FBQ2pCLCtEQUErRDs7QUFFL0QsNkJBQTZCO0FBQzdCLHFDQUFnRDtBQUNoRCx5REFBeUQ7QUFDekQsbUNBQThDO0FBQzlDLCtEQUEyRDtBQUMzRCxtRkFBOEU7QUFFOUUsK0RBQWlFO0FBQ2pFLG1GQUE4RTtBQUM5RSxpRkFBNEU7QUFDNUUscURBQWlEO0FBRWpELG1DQUFvRDtBQUVwRCxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUM3RCxNQUFNLHdCQUF3QixHQUFHLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBQ3ZFLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO0FBQ3RELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBRXBEOzs7Ozs7Ozs7R0FTRztBQUVILE1BQU0sQ0FBQyxHQUFRLE9BQU8sTUFBTSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDOUMsUUFBQSxvQkFBb0IsR0FBVyxDQUFDLENBQUMsZ0JBQWdCLENBQUM7SUFDN0QsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsb0VBQW9FLENBQUM7SUFDdkYsQ0FBQyxDQUFDLGdEQUFnRCxDQUFDO0FBRXJELFNBQWdCLGVBQWUsQ0FBQyxHQUF5QjtJQUN2RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFFaEQsTUFBTSxXQUFXLEdBQUcsZ0JBQU0s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QUNqRCxJQUFJLGtDQUFrQixDQUFDLEVBQUUsT0FBTyxFQUFFLFlBQVksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDekQsSUFBSSwrQ0FBcUIsQ0FBQztvQkFDeEIsU0FBUyxFQUFFLFlBQVksQ0FBQyxTQUFTO29CQUNqQyxtREFBbUQ7b0JBQ25ELElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsZ0NBQWdDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztpQkFDNUQsQ0FBQztnQkFDRixJQUFJLFlBQVksQ0FBQztvQkFDZixTQUFTLEVBQUUsWUFBWSxDQUFDLFNBQVM7b0JBQ2pDLFFBQVEsRUFBRSxJQUFJO29CQUNkLEtBQUssRUFBRSxJQUFJO29CQUNYLGFBQWE7aUJBQ2QsQ0FBQzthQUNIO1NBQ0Y7UUFDRCxPQUFPLEVBQUUsWUFBWTtLQUN0QixDQUFDO0FBQ0osQ0FBQztBQWpSRCwwQ0FpUkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG4vLyB0c2xpbnQ6ZGlzYWJsZVxuLy8gVE9ETzogY2xlYW51cCB0aGlzIGZpbGUsIGl0J3MgY29waWVkIGFzIGlzIGZyb20gQW5ndWxhciBDTEkuXG5cbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBIYXNoZWRNb2R1bGVJZHNQbHVnaW4gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCAqIGFzIENvcHlXZWJwYWNrUGx1Z2luIGZyb20gJ2NvcHktd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgZ2V0T3V0cHV0SGFzaEZvcm1hdCB9IGZyb20gJy4vdXRpbHMnO1xuaW1wb3J0IHsgaXNEaXJlY3RvcnkgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvaXMtZGlyZWN0b3J5JztcbmltcG9ydCB7IHJlcXVpcmVQcm9qZWN0TW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL3JlcXVpcmUtcHJvamVjdC1tb2R1bGUnO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IEJ1bmRsZUJ1ZGdldFBsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvYnVuZGxlLWJ1ZGdldCc7XG5pbXBvcnQgeyBDbGVhbkNzc1dlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL2NsZWFuY3NzLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IFNjcmlwdHNXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9zY3JpcHRzLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IGZpbmRVcCB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9maW5kLXVwJztcbmltcG9ydCB7IEFzc2V0UGF0dGVybk9iamVjdCwgRXh0cmFFbnRyeVBvaW50IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyB9IGZyb20gJy4vdXRpbHMnO1xuXG5jb25zdCBQcm9ncmVzc1BsdWdpbiA9IHJlcXVpcmUoJ3dlYnBhY2svbGliL1Byb2dyZXNzUGx1Z2luJyk7XG5jb25zdCBDaXJjdWxhckRlcGVuZGVuY3lQbHVnaW4gPSByZXF1aXJlKCdjaXJjdWxhci1kZXBlbmRlbmN5LXBsdWdpbicpO1xuY29uc3QgVGVyc2VyUGx1Z2luID0gcmVxdWlyZSgndGVyc2VyLXdlYnBhY2stcGx1Z2luJyk7XG5jb25zdCBTdGF0c1BsdWdpbiA9IHJlcXVpcmUoJ3N0YXRzLXdlYnBhY2stcGx1Z2luJyk7XG5cbi8qKlxuICogRW51bWVyYXRlIGxvYWRlcnMgYW5kIHRoZWlyIGRlcGVuZGVuY2llcyBmcm9tIHRoaXMgZmlsZSB0byBsZXQgdGhlIGRlcGVuZGVuY3kgdmFsaWRhdG9yXG4gKiBrbm93IHRoZXkgYXJlIHVzZWQuXG4gKlxuICogcmVxdWlyZSgnc291cmNlLW1hcC1sb2FkZXInKVxuICogcmVxdWlyZSgncmF3LWxvYWRlcicpXG4gKiByZXF1aXJlKCd1cmwtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ2ZpbGUtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXInKVxuICovXG5cbmNvbnN0IGc6IGFueSA9IHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsIDoge307XG5leHBvcnQgY29uc3QgYnVpbGRPcHRpbWl6ZXJMb2FkZXI6IHN0cmluZyA9IGdbJ19EZXZLaXRJc0xvY2FsJ11cbiAgPyByZXF1aXJlLnJlc29sdmUoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXIvc3JjL2J1aWxkLW9wdGltaXplci93ZWJwYWNrLWxvYWRlcicpXG4gIDogJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXIvd2VicGFjay1sb2FkZXInO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q29tbW9uQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpIHtcbiAgY29uc3QgeyByb290LCBwcm9qZWN0Um9vdCwgYnVpbGRPcHRpb25zIH0gPSB3Y287XG5cbiAgY29uc3Qgbm9kZU1vZHVsZXMgPSBmaW5kVXAoJ25vZGVfbW9kdWxlcycsIHByb2plY3RSb290KTtcbiAgaWYgKCFub2RlTW9kdWxlcykge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGxvY2F0ZSBub2RlX21vZHVsZXMgZGlyZWN0b3J5LicpXG4gIH1cblxuICBsZXQgZXh0cmFQbHVnaW5zOiBhbnlbXSA9IFtdO1xuICBsZXQgZW50cnlQb2ludHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nW10gfSA9IHt9O1xuXG4gIGlmIChidWlsZE9wdGlvbnMubWFpbikge1xuICAgIGVudHJ5UG9pbnRzWydtYWluJ10gPSBbcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5tYWluKV07XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnBvbHlmaWxscykge1xuICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSA9IFtwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLnBvbHlmaWxscyldO1xuICB9XG5cbiAgLy8gZGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0XG4gIGNvbnN0IGhhc2hGb3JtYXQgPSBnZXRPdXRwdXRIYXNoRm9ybWF0KGJ1aWxkT3B0aW9ucy5vdXRwdXRIYXNoaW5nIGFzIGFueSk7XG5cbiAgLy8gcHJvY2VzcyBnbG9iYWwgc2NyaXB0c1xuICBpZiAoYnVpbGRPcHRpb25zLnNjcmlwdHMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUgPSBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKGJ1aWxkT3B0aW9ucy5zY3JpcHRzLCAnc2NyaXB0cycpXG4gICAgICAucmVkdWNlKChwcmV2OiB7IGJ1bmRsZU5hbWU6IHN0cmluZywgcGF0aHM6IHN0cmluZ1tdLCBsYXp5OiBib29sZWFuIH1bXSwgY3VycikgPT4ge1xuICAgICAgICBjb25zdCBidW5kbGVOYW1lID0gY3Vyci5idW5kbGVOYW1lO1xuICAgICAgICBjb25zdCByZXNvbHZlZFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgY3Vyci5pbnB1dCk7XG4gICAgICAgIGxldCBleGlzdGluZ0VudHJ5ID0gcHJldi5maW5kKChlbCkgPT4gZWwuYnVuZGxlTmFtZSA9PT0gYnVuZGxlTmFtZSk7XG4gICAgICAgIGlmIChleGlzdGluZ0VudHJ5KSB7XG4gICAgICAgICAgaWYgKGV4aXN0aW5nRW50cnkubGF6eSAmJiAhY3Vyci5sYXp5KSB7XG4gICAgICAgICAgICAvLyBBbGwgZW50cmllcyBoYXZlIHRvIGJlIGxhenkgZm9yIHRoZSBidW5kbGUgdG8gYmUgbGF6eS5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlICR7Y3Vyci5idW5kbGVOYW1lfSBidW5kbGUgaXMgbWl4aW5nIGxhenkgYW5kIG5vbi1sYXp5IHNjcmlwdHMuYCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZXhpc3RpbmdFbnRyeS5wYXRocy5wdXNoKHJlc29sdmVkUGF0aCk7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwcmV2LnB1c2goe1xuICAgICAgICAgICAgYnVuZGxlTmFtZSxcbiAgICAgICAgICAgIHBhdGhzOiBbcmVzb2x2ZWRQYXRoXSxcbiAgICAgICAgICAgIGxhenk6IGN1cnIubGF6eVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwcmV2O1xuICAgICAgfSwgW10pO1xuXG5cbiAgICAvLyBBZGQgYSBuZXcgYXNzZXQgZm9yIGVhY2ggZW50cnkuXG4gICAgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZS5mb3JFYWNoKChzY3JpcHQpID0+IHtcbiAgICAgIC8vIExhenkgc2NyaXB0cyBkb24ndCBnZXQgYSBoYXNoLCBvdGhlcndpc2UgdGhleSBjYW4ndCBiZSBsb2FkZWQgYnkgbmFtZS5cbiAgICAgIGNvbnN0IGhhc2ggPSBzY3JpcHQubGF6eSA/ICcnIDogaGFzaEZvcm1hdC5zY3JpcHQ7XG4gICAgICBjb25zdCBidW5kbGVOYW1lID0gc2NyaXB0LmJ1bmRsZU5hbWU7XG5cbiAgICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBTY3JpcHRzV2VicGFja1BsdWdpbih7XG4gICAgICAgIG5hbWU6IGJ1bmRsZU5hbWUsXG4gICAgICAgIHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCxcbiAgICAgICAgZmlsZW5hbWU6IGAke3BhdGguYmFzZW5hbWUoYnVuZGxlTmFtZSl9JHtoYXNofS5qc2AsXG4gICAgICAgIHNjcmlwdHM6IHNjcmlwdC5wYXRocyxcbiAgICAgICAgYmFzZVBhdGg6IHByb2plY3RSb290LFxuICAgICAgfSkpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gcHJvY2VzcyBhc3NldCBlbnRyaWVzXG4gIGlmIChidWlsZE9wdGlvbnMuYXNzZXRzKSB7XG4gICAgY29uc3QgY29weVdlYnBhY2tQbHVnaW5QYXR0ZXJucyA9IGJ1aWxkT3B0aW9ucy5hc3NldHMubWFwKChhc3NldDogQXNzZXRQYXR0ZXJuT2JqZWN0KSA9PiB7XG5cbiAgICAgIC8vIFJlc29sdmUgaW5wdXQgcGF0aHMgcmVsYXRpdmUgdG8gd29ya3NwYWNlIHJvb3QgYW5kIGFkZCBzbGFzaCBhdCB0aGUgZW5kLlxuICAgICAgYXNzZXQuaW5wdXQgPSBwYXRoLnJlc29sdmUocm9vdCwgYXNzZXQuaW5wdXQpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICAgIGFzc2V0LmlucHV0ID0gYXNzZXQuaW5wdXQuZW5kc1dpdGgoJy8nKSA/IGFzc2V0LmlucHV0IDogYXNzZXQuaW5wdXQgKyAnLyc7XG4gICAgICBhc3NldC5vdXRwdXQgPSBhc3NldC5vdXRwdXQuZW5kc1dpdGgoJy8nKSA/IGFzc2V0Lm91dHB1dCA6IGFzc2V0Lm91dHB1dCArICcvJztcblxuICAgICAgaWYgKGFzc2V0Lm91dHB1dC5zdGFydHNXaXRoKCcuLicpKSB7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSAnQW4gYXNzZXQgY2Fubm90IGJlIHdyaXR0ZW4gdG8gYSBsb2NhdGlvbiBvdXRzaWRlIG9mIHRoZSBvdXRwdXQgcGF0aC4nO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNvbnRleHQ6IGFzc2V0LmlucHV0LFxuICAgICAgICAvLyBOb3cgd2UgcmVtb3ZlIHN0YXJ0aW5nIHNsYXNoIHRvIG1ha2UgV2VicGFjayBwbGFjZSBpdCBmcm9tIHRoZSBvdXRwdXQgcm9vdC5cbiAgICAgICAgdG86IGFzc2V0Lm91dHB1dC5yZXBsYWNlKC9eXFwvLywgJycpLFxuICAgICAgICBpZ25vcmU6IGFzc2V0Lmlnbm9yZSxcbiAgICAgICAgZnJvbToge1xuICAgICAgICAgIGdsb2I6IGFzc2V0Lmdsb2IsXG4gICAgICAgICAgZG90OiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG5cbiAgICBjb25zdCBjb3B5V2VicGFja1BsdWdpbk9wdGlvbnMgPSB7IGlnbm9yZTogWycuZ2l0a2VlcCcsICcqKi8uRFNfU3RvcmUnLCAnKiovVGh1bWJzLmRiJ10gfTtcblxuICAgIGNvbnN0IGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UgPSBuZXcgQ29weVdlYnBhY2tQbHVnaW4oY29weVdlYnBhY2tQbHVnaW5QYXR0ZXJucyxcbiAgICAgIGNvcHlXZWJwYWNrUGx1Z2luT3B0aW9ucyk7XG5cbiAgICAvLyBTYXZlIG9wdGlvbnMgc28gd2UgY2FuIHVzZSB0aGVtIGluIGVqZWN0LlxuICAgIChjb3B5V2VicGFja1BsdWdpbkluc3RhbmNlIGFzIGFueSlbJ2NvcHlXZWJwYWNrUGx1Z2luUGF0dGVybnMnXSA9IGNvcHlXZWJwYWNrUGx1Z2luUGF0dGVybnM7XG4gICAgKGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UgYXMgYW55KVsnY29weVdlYnBhY2tQbHVnaW5PcHRpb25zJ10gPSBjb3B5V2VicGFja1BsdWdpbk9wdGlvbnM7XG5cbiAgICBleHRyYVBsdWdpbnMucHVzaChjb3B5V2VicGFja1BsdWdpbkluc3RhbmNlKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMucHJvZ3Jlc3MpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgUHJvZ3Jlc3NQbHVnaW4oeyBwcm9maWxlOiBidWlsZE9wdGlvbnMudmVyYm9zZSwgY29sb3JzOiB0cnVlIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc2hvd0NpcmN1bGFyRGVwZW5kZW5jaWVzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IENpcmN1bGFyRGVwZW5kZW5jeVBsdWdpbih7XG4gICAgICBleGNsdWRlOiAvW1xcXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFxcXC9dL1xuICAgIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3RhdHNKc29uKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN0YXRzUGx1Z2luKCdzdGF0cy5qc29uJywgJ3ZlcmJvc2UnKSk7XG4gIH1cblxuICBsZXQgc291cmNlTWFwVXNlUnVsZTtcbiAgaWYgKGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAgJiYgYnVpbGRPcHRpb25zLnZlbmRvclNvdXJjZU1hcCkge1xuICAgIHNvdXJjZU1hcFVzZVJ1bGUgPSB7XG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogJ3NvdXJjZS1tYXAtbG9hZGVyJ1xuICAgICAgICB9XG4gICAgICBdXG4gICAgfVxuICB9XG5cbiAgbGV0IGJ1aWxkT3B0aW1pemVyVXNlUnVsZTtcbiAgaWYgKGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcikge1xuICAgIGJ1aWxkT3B0aW1pemVyVXNlUnVsZSA9IHtcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiBidWlsZE9wdGltaXplckxvYWRlcixcbiAgICAgICAgICBvcHRpb25zOiB7IHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCB9XG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH07XG4gIH1cblxuICAvLyBBbGxvdyBsb2FkZXJzIHRvIGJlIGluIGEgbm9kZV9tb2R1bGVzIG5lc3RlZCBpbnNpZGUgdGhlIGRldmtpdC9idWlsZC1hbmd1bGFyIHBhY2thZ2UuXG4gIC8vIFRoaXMgaXMgaW1wb3J0YW50IGluIGNhc2UgbG9hZGVycyBkbyBub3QgZ2V0IGhvaXN0ZWQuXG4gIC8vIElmIHRoaXMgZmlsZSBtb3ZlcyB0byBhbm90aGVyIGxvY2F0aW9uLCBhbHRlciBwb3RlbnRpYWxOb2RlTW9kdWxlcyBhcyB3ZWxsLlxuICBjb25zdCBsb2FkZXJOb2RlTW9kdWxlcyA9IFsnbm9kZV9tb2R1bGVzJ107XG4gIGNvbnN0IGJ1aWxkQW5ndWxhck5vZGVNb2R1bGVzID0gZmluZFVwKCdub2RlX21vZHVsZXMnLCBfX2Rpcm5hbWUpO1xuICBpZiAoYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXNcbiAgICAmJiBpc0RpcmVjdG9yeShidWlsZEFuZ3VsYXJOb2RlTW9kdWxlcylcbiAgICAmJiBidWlsZEFuZ3VsYXJOb2RlTW9kdWxlcyAhPT0gbm9kZU1vZHVsZXNcbiAgICAmJiBidWlsZEFuZ3VsYXJOb2RlTW9kdWxlcy5zdGFydHNXaXRoKG5vZGVNb2R1bGVzKVxuICApIHtcbiAgICBsb2FkZXJOb2RlTW9kdWxlcy5wdXNoKGJ1aWxkQW5ndWxhck5vZGVNb2R1bGVzKTtcbiAgfVxuXG4gIC8vIExvYWQgcnhqcyBwYXRoIGFsaWFzZXMuXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9ibG9iL21hc3Rlci9kb2MvbGV0dGFibGUtb3BlcmF0b3JzLm1kI2J1aWxkLWFuZC10cmVlc2hha2luZ1xuICBsZXQgYWxpYXMgPSB7fTtcbiAgdHJ5IHtcbiAgICBjb25zdCByeGpzUGF0aE1hcHBpbmdJbXBvcnQgPSB3Y28uc3VwcG9ydEVTMjAxNVxuICAgICAgPyAncnhqcy9fZXNtMjAxNS9wYXRoLW1hcHBpbmcnXG4gICAgICA6ICdyeGpzL19lc201L3BhdGgtbWFwcGluZyc7XG4gICAgY29uc3QgcnhQYXRocyA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKHByb2plY3RSb290LCByeGpzUGF0aE1hcHBpbmdJbXBvcnQpO1xuICAgIGFsaWFzID0gcnhQYXRocyhub2RlTW9kdWxlcyk7XG4gIH0gY2F0Y2ggeyB9XG5cbiAgY29uc3QgaXNJdnlFbmFibGVkID0gd2NvLnRzQ29uZmlnLnJhdy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zXG4gICAgICAgICAgICAgICAgICAgICYmIHdjby50c0NvbmZpZy5yYXcuYW5ndWxhckNvbXBpbGVyT3B0aW9ucy5lbmFibGVJdnk7XG5cbiAgY29uc3QgdGVyc2VyT3B0aW9ucyA9IHtcbiAgICBlY21hOiB3Y28uc3VwcG9ydEVTMjAxNSA/IDYgOiA1LFxuICAgIHdhcm5pbmdzOiAhIWJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgIHNhZmFyaTEwOiB0cnVlLFxuICAgIG91dHB1dDoge1xuICAgICAgYXNjaWlfb25seTogdHJ1ZSxcbiAgICAgIGNvbW1lbnRzOiBmYWxzZSxcbiAgICAgIHdlYmtpdDogdHJ1ZSxcbiAgICB9LFxuXG4gICAgLy8gT24gc2VydmVyLCB3ZSBkb24ndCB3YW50IHRvIGNvbXByZXNzIGFueXRoaW5nLiBXZSBzdGlsbCBzZXQgdGhlIG5nRGV2TW9kZSA9IGZhbHNlIGZvciBpdFxuICAgIC8vIHRvIHJlbW92ZSBkZXYgY29kZS5cbiAgICBjb21wcmVzczogKGJ1aWxkT3B0aW9ucy5wbGF0Zm9ybSA9PSAnc2VydmVyJyA/IHtcbiAgICAgIGdsb2JhbF9kZWZzOiB7XG4gICAgICAgIG5nRGV2TW9kZTogZmFsc2UsXG4gICAgICB9LFxuICAgIH0gOiB7XG4gICAgICBwdXJlX2dldHRlcnM6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgIC8vIFBVUkUgY29tbWVudHMgd29yayBiZXN0IHdpdGggMyBwYXNzZXMuXG4gICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay9pc3N1ZXMvMjg5OSNpc3N1ZWNvbW1lbnQtMzE3NDI1OTI2LlxuICAgICAgcGFzc2VzOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIgPyAzIDogMSxcbiAgICAgIGdsb2JhbF9kZWZzOiB7XG4gICAgICAgIG5nRGV2TW9kZTogZmFsc2UsXG4gICAgICB9LFxuICAgIH0pLFxuICAgIC8vIFdlIGFsc28gd2FudCB0byBhdm9pZCBtYW5nbGluZyBvbiBzZXJ2ZXIuXG4gICAgLi4uKGJ1aWxkT3B0aW9ucy5wbGF0Zm9ybSA9PSAnc2VydmVyJyA/IHsgbWFuZ2xlOiBmYWxzZSB9IDoge30pLFxuICB9O1xuXG4gIHJldHVybiB7XG4gICAgbW9kZTogYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbiA/ICdwcm9kdWN0aW9uJyA6ICdkZXZlbG9wbWVudCcsXG4gICAgZGV2dG9vbDogZmFsc2UsXG4gICAgcmVzb2x2ZToge1xuICAgICAgZXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgICAgc3ltbGlua3M6ICFidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgIG1vZHVsZXM6IFtcbiAgICAgICAgd2NvLnRzQ29uZmlnLm9wdGlvbnMuYmFzZVVybCB8fCBwcm9qZWN0Um9vdCxcbiAgICAgICAgJ25vZGVfbW9kdWxlcycsXG4gICAgICBdLFxuICAgICAgYWxpYXNcbiAgICB9LFxuICAgIHJlc29sdmVMb2FkZXI6IHtcbiAgICAgIG1vZHVsZXM6IGxvYWRlck5vZGVNb2R1bGVzXG4gICAgfSxcbiAgICBjb250ZXh0OiBwcm9qZWN0Um9vdCxcbiAgICBlbnRyeTogZW50cnlQb2ludHMsXG4gICAgb3V0cHV0OiB7XG4gICAgICBwYXRoOiBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm91dHB1dFBhdGggYXMgc3RyaW5nKSxcbiAgICAgIHB1YmxpY1BhdGg6IGJ1aWxkT3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgICBmaWxlbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5jaHVua30uanNgLFxuICAgIH0sXG4gICAgd2F0Y2g6IGJ1aWxkT3B0aW9ucy53YXRjaCxcbiAgICB3YXRjaE9wdGlvbnM6IHtcbiAgICAgIHBvbGw6IGJ1aWxkT3B0aW9ucy5wb2xsXG4gICAgfSxcbiAgICBwZXJmb3JtYW5jZToge1xuICAgICAgaGludHM6IGZhbHNlLFxuICAgIH0sXG4gICAgbW9kdWxlOiB7XG4gICAgICBydWxlczogW1xuICAgICAgICB7IHRlc3Q6IC9cXC5odG1sJC8sIGxvYWRlcjogJ3Jhdy1sb2FkZXInIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuKGVvdHxzdmd8Y3VyfGpwZ3xwbmd8d2VicHxnaWZ8b3RmfHR0Znx3b2ZmfHdvZmYyfGFuaSkkLyxcbiAgICAgICAgICBsb2FkZXI6ICdmaWxlLWxvYWRlcicsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5maWxlfS5bZXh0XWAsXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgLy8gTWFyayBmaWxlcyBpbnNpZGUgYEBhbmd1bGFyL2NvcmVgIGFzIHVzaW5nIFN5c3RlbUpTIHN0eWxlIGR5bmFtaWMgaW1wb3J0cy5cbiAgICAgICAgICAvLyBSZW1vdmluZyB0aGlzIHdpbGwgY2F1c2UgZGVwcmVjYXRpb24gd2FybmluZ3MgdG8gYXBwZWFyLlxuICAgICAgICAgIHRlc3Q6IC9bXFwvXFxcXF1AYW5ndWxhcltcXC9cXFxcXWNvcmVbXFwvXFxcXF0uK1xcLmpzJC8sXG4gICAgICAgICAgcGFyc2VyOiB7IHN5c3RlbTogdHJ1ZSB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLmpzJC8sXG4gICAgICAgICAgLi4uYnVpbGRPcHRpbWl6ZXJVc2VSdWxlLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLmpzJC8sXG4gICAgICAgICAgZXhjbHVkZTogLyhuZ2ZhY3Rvcnl8bmdzdHlsZSkuanMkLyxcbiAgICAgICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgICAgICAuLi5zb3VyY2VNYXBVc2VSdWxlLFxuICAgICAgICB9LFxuICAgICAgXVxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICBub0VtaXRPbkVycm9yczogdHJ1ZSxcbiAgICAgIG1pbmltaXplcjogW1xuICAgICAgICBuZXcgSGFzaGVkTW9kdWxlSWRzUGx1Z2luKCksXG4gICAgICAgIC8vIFRPRE86IGNoZWNrIHdpdGggTWlrZSB3aGF0IHRoaXMgZmVhdHVyZSBuZWVkcy5cbiAgICAgICAgbmV3IEJ1bmRsZUJ1ZGdldFBsdWdpbih7IGJ1ZGdldHM6IGJ1aWxkT3B0aW9ucy5idWRnZXRzIH0pLFxuICAgICAgICBuZXcgQ2xlYW5Dc3NXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgICBzb3VyY2VNYXA6IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAsXG4gICAgICAgICAgLy8gY29tcG9uZW50IHN0eWxlcyByZXRhaW4gdGhlaXIgb3JpZ2luYWwgZmlsZSBuYW1lXG4gICAgICAgICAgdGVzdDogKGZpbGUpID0+IC9cXC4oPzpjc3N8c2Nzc3xzYXNzfGxlc3N8c3R5bCkkLy50ZXN0KGZpbGUpLFxuICAgICAgICB9KSxcbiAgICAgICAgbmV3IFRlcnNlclBsdWdpbih7XG4gICAgICAgICAgc291cmNlTWFwOiBidWlsZE9wdGlvbnMuc291cmNlTWFwLFxuICAgICAgICAgIHBhcmFsbGVsOiB0cnVlLFxuICAgICAgICAgIGNhY2hlOiB0cnVlLFxuICAgICAgICAgIHRlcnNlck9wdGlvbnMsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9LFxuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2lucyxcbiAgfTtcbn1cbiJdfQ==