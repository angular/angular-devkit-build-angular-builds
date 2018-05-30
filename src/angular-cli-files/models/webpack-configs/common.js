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
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
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
    catch (e) { }
    const uglifyOptions = Object.assign({ ecma: wco.supportES2015 ? 6 : 5, warnings: !!buildOptions.verbose, safari10: true, output: {
            ascii_only: true,
            comments: false,
            webkit: true,
        } }, (buildOptions.platform == 'server' ? {} : {
        compress: {
            pure_getters: buildOptions.buildOptimizer,
            // PURE comments work best with 3 passes.
            // See https://github.com/webpack/webpack/issues/2899#issuecomment-317425926.
            passes: buildOptions.buildOptimizer ? 3 : 1,
            // Workaround known uglify-es issue
            // See https://github.com/mishoo/UglifyJS2/issues/2949#issuecomment-368070307
            inline: wco.supportES2015 ? 1 : 3,
        }
    }), (buildOptions.platform == 'server' ? { mangle: false } : {}));
    return {
        mode: buildOptions.optimization ? 'production' : 'development',
        devtool: false,
        resolve: {
            extensions: ['.ts', '.mjs', '.js'],
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
                {
                    // Mark files inside `@angular/core` as using SystemJS style dynamic imports.
                    // Removing this will cause deprecation warnings to appear.
                    test: /[\/\\]@angular[\/\\]core[\/\\].+\.js$/,
                    parser: { system: true },
                },
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
                    uglifyOptions,
                }),
            ],
        },
        plugins: extraPlugins,
    };
}
exports.getCommonConfig = getCommonConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HO0FBQ0gsaUJBQWlCO0FBQ2pCLCtEQUErRDs7QUFFL0QsNkJBQTZCO0FBQzdCLHFDQUFnRDtBQUNoRCx5REFBeUQ7QUFDekQsbUNBQThDO0FBQzlDLCtEQUEyRDtBQUMzRCxtRkFBOEU7QUFFOUUsK0RBQWlFO0FBQ2pFLG1GQUE4RTtBQUM5RSxpRkFBNEU7QUFDNUUscURBQWlEO0FBRWpELG1DQUFvRDtBQUVwRCxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUM3RCxNQUFNLHdCQUF3QixHQUFHLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBQ3ZFLE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQzFELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBRXBEOzs7Ozs7Ozs7R0FTRztBQUVILE1BQU0sQ0FBQyxHQUFRLE9BQU8sTUFBTSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDOUMsUUFBQSxvQkFBb0IsR0FBVyxDQUFDLENBQUMsZ0JBQWdCLENBQUM7SUFDN0QsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsb0VBQW9FLENBQUM7SUFDdkYsQ0FBQyxDQUFDLGdEQUFnRCxDQUFDO0FBRXJELHlCQUFnQyxHQUF5QjtJQUN2RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFFaEQsTUFBTSxXQUFXLEdBQUcsZ0JBQU0sQ0FBQyxjQUFj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O1lBQ1osY0FBYyxFQUFFLElBQUk7WUFDcEIsU0FBUyxFQUFFO2dCQUNULElBQUksK0JBQXFCLEVBQUU7Z0JBQzNCLGlEQUFpRDtnQkFDakQsSUFBSSxrQ0FBa0IsQ0FBQyxFQUFFLE9BQU8sRUFBRSxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3pELElBQUksK0NBQXFCLENBQUM7b0JBQ3hCLFNBQVMsRUFBRSxZQUFZLENBQUMsU0FBUztvQkFDakMsbURBQW1EO29CQUNuRCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLGdDQUFnQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7aUJBQzVELENBQUM7Z0JBQ0YsSUFBSSxjQUFjLENBQUM7b0JBQ2pCLFNBQVMsRUFBRSxZQUFZLENBQUMsU0FBUztvQkFDakMsUUFBUSxFQUFFLElBQUk7b0JBQ2QsS0FBSyxFQUFFLElBQUk7b0JBQ1gsYUFBYTtpQkFDZCxDQUFDO2FBQ0g7U0FDRjtRQUNELE9BQU8sRUFBRSxZQUFZO0tBQ3RCLENBQUM7QUFDSixDQUFDO0FBOVBELDBDQThQQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbi8vIHRzbGludDpkaXNhYmxlXG4vLyBUT0RPOiBjbGVhbnVwIHRoaXMgZmlsZSwgaXQncyBjb3BpZWQgYXMgaXMgZnJvbSBBbmd1bGFyIENMSS5cblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEhhc2hlZE1vZHVsZUlkc1BsdWdpbiB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0ICogYXMgQ29weVdlYnBhY2tQbHVnaW4gZnJvbSAnY29weS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgeyBnZXRPdXRwdXRIYXNoRm9ybWF0IH0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQgeyBpc0RpcmVjdG9yeSB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9pcy1kaXJlY3RvcnknO1xuaW1wb3J0IHsgcmVxdWlyZVByb2plY3RNb2R1bGUgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvcmVxdWlyZS1wcm9qZWN0LW1vZHVsZSc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgQnVuZGxlQnVkZ2V0UGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9idW5kbGUtYnVkZ2V0JztcbmltcG9ydCB7IENsZWFuQ3NzV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvY2xlYW5jc3Mtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgU2NyaXB0c1dlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL3NjcmlwdHMtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgZmluZFVwIH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL2ZpbmQtdXAnO1xuaW1wb3J0IHsgQXNzZXRQYXR0ZXJuT2JqZWN0LCBFeHRyYUVudHJ5UG9pbnQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzIH0gZnJvbSAnLi91dGlscyc7XG5cbmNvbnN0IFByb2dyZXNzUGx1Z2luID0gcmVxdWlyZSgnd2VicGFjay9saWIvUHJvZ3Jlc3NQbHVnaW4nKTtcbmNvbnN0IENpcmN1bGFyRGVwZW5kZW5jeVBsdWdpbiA9IHJlcXVpcmUoJ2NpcmN1bGFyLWRlcGVuZGVuY3ktcGx1Z2luJyk7XG5jb25zdCBVZ2xpZnlKU1BsdWdpbiA9IHJlcXVpcmUoJ3VnbGlmeWpzLXdlYnBhY2stcGx1Z2luJyk7XG5jb25zdCBTdGF0c1BsdWdpbiA9IHJlcXVpcmUoJ3N0YXRzLXdlYnBhY2stcGx1Z2luJyk7XG5cbi8qKlxuICogRW51bWVyYXRlIGxvYWRlcnMgYW5kIHRoZWlyIGRlcGVuZGVuY2llcyBmcm9tIHRoaXMgZmlsZSB0byBsZXQgdGhlIGRlcGVuZGVuY3kgdmFsaWRhdG9yXG4gKiBrbm93IHRoZXkgYXJlIHVzZWQuXG4gKlxuICogcmVxdWlyZSgnc291cmNlLW1hcC1sb2FkZXInKVxuICogcmVxdWlyZSgncmF3LWxvYWRlcicpXG4gKiByZXF1aXJlKCd1cmwtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ2ZpbGUtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXInKVxuICovXG5cbmNvbnN0IGc6IGFueSA9IHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsIDoge307XG5leHBvcnQgY29uc3QgYnVpbGRPcHRpbWl6ZXJMb2FkZXI6IHN0cmluZyA9IGdbJ19EZXZLaXRJc0xvY2FsJ11cbiAgPyByZXF1aXJlLnJlc29sdmUoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXIvc3JjL2J1aWxkLW9wdGltaXplci93ZWJwYWNrLWxvYWRlcicpXG4gIDogJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXIvd2VicGFjay1sb2FkZXInO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q29tbW9uQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpIHtcbiAgY29uc3QgeyByb290LCBwcm9qZWN0Um9vdCwgYnVpbGRPcHRpb25zIH0gPSB3Y287XG5cbiAgY29uc3Qgbm9kZU1vZHVsZXMgPSBmaW5kVXAoJ25vZGVfbW9kdWxlcycsIHByb2plY3RSb290KTtcbiAgaWYgKCFub2RlTW9kdWxlcykge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGxvY2F0ZSBub2RlX21vZHVsZXMgZGlyZWN0b3J5LicpXG4gIH1cblxuICBsZXQgZXh0cmFQbHVnaW5zOiBhbnlbXSA9IFtdO1xuICBsZXQgZW50cnlQb2ludHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nW10gfSA9IHt9O1xuXG4gIGlmIChidWlsZE9wdGlvbnMubWFpbikge1xuICAgIGVudHJ5UG9pbnRzWydtYWluJ10gPSBbcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5tYWluKV07XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnBvbHlmaWxscykge1xuICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSA9IFtwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLnBvbHlmaWxscyldO1xuICB9XG5cbiAgLy8gZGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0XG4gIGNvbnN0IGhhc2hGb3JtYXQgPSBnZXRPdXRwdXRIYXNoRm9ybWF0KGJ1aWxkT3B0aW9ucy5vdXRwdXRIYXNoaW5nIGFzIGFueSk7XG5cbiAgLy8gcHJvY2VzcyBnbG9iYWwgc2NyaXB0c1xuICBpZiAoYnVpbGRPcHRpb25zLnNjcmlwdHMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUgPSBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKGJ1aWxkT3B0aW9ucy5zY3JpcHRzLCAnc2NyaXB0cycpXG4gICAgICAucmVkdWNlKChwcmV2OiB7IGJ1bmRsZU5hbWU6IHN0cmluZywgcGF0aHM6IHN0cmluZ1tdLCBsYXp5OiBib29sZWFuIH1bXSwgY3VycikgPT4ge1xuICAgICAgICBjb25zdCBidW5kbGVOYW1lID0gY3Vyci5idW5kbGVOYW1lO1xuICAgICAgICBjb25zdCByZXNvbHZlZFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgY3Vyci5pbnB1dCk7XG4gICAgICAgIGxldCBleGlzdGluZ0VudHJ5ID0gcHJldi5maW5kKChlbCkgPT4gZWwuYnVuZGxlTmFtZSA9PT0gYnVuZGxlTmFtZSk7XG4gICAgICAgIGlmIChleGlzdGluZ0VudHJ5KSB7XG4gICAgICAgICAgaWYgKGV4aXN0aW5nRW50cnkubGF6eSAmJiAhY3Vyci5sYXp5KSB7XG4gICAgICAgICAgICAvLyBBbGwgZW50cmllcyBoYXZlIHRvIGJlIGxhenkgZm9yIHRoZSBidW5kbGUgdG8gYmUgbGF6eS5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlICR7Y3Vyci5idW5kbGVOYW1lfSBidW5kbGUgaXMgbWl4aW5nIGxhenkgYW5kIG5vbi1sYXp5IHNjcmlwdHMuYCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZXhpc3RpbmdFbnRyeS5wYXRocy5wdXNoKHJlc29sdmVkUGF0aCk7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwcmV2LnB1c2goe1xuICAgICAgICAgICAgYnVuZGxlTmFtZSxcbiAgICAgICAgICAgIHBhdGhzOiBbcmVzb2x2ZWRQYXRoXSxcbiAgICAgICAgICAgIGxhenk6IGN1cnIubGF6eVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwcmV2O1xuICAgICAgfSwgW10pO1xuXG5cbiAgICAvLyBBZGQgYSBuZXcgYXNzZXQgZm9yIGVhY2ggZW50cnkuXG4gICAgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZS5mb3JFYWNoKChzY3JpcHQpID0+IHtcbiAgICAgIC8vIExhenkgc2NyaXB0cyBkb24ndCBnZXQgYSBoYXNoLCBvdGhlcndpc2UgdGhleSBjYW4ndCBiZSBsb2FkZWQgYnkgbmFtZS5cbiAgICAgIGNvbnN0IGhhc2ggPSBzY3JpcHQubGF6eSA/ICcnIDogaGFzaEZvcm1hdC5zY3JpcHQ7XG4gICAgICBjb25zdCBidW5kbGVOYW1lID0gc2NyaXB0LmJ1bmRsZU5hbWU7XG5cbiAgICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBTY3JpcHRzV2VicGFja1BsdWdpbih7XG4gICAgICAgIG5hbWU6IGJ1bmRsZU5hbWUsXG4gICAgICAgIHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCxcbiAgICAgICAgZmlsZW5hbWU6IGAke3BhdGguYmFzZW5hbWUoYnVuZGxlTmFtZSl9JHtoYXNofS5qc2AsXG4gICAgICAgIHNjcmlwdHM6IHNjcmlwdC5wYXRocyxcbiAgICAgICAgYmFzZVBhdGg6IHByb2plY3RSb290LFxuICAgICAgfSkpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gcHJvY2VzcyBhc3NldCBlbnRyaWVzXG4gIGlmIChidWlsZE9wdGlvbnMuYXNzZXRzKSB7XG4gICAgY29uc3QgY29weVdlYnBhY2tQbHVnaW5QYXR0ZXJucyA9IGJ1aWxkT3B0aW9ucy5hc3NldHMubWFwKChhc3NldDogQXNzZXRQYXR0ZXJuT2JqZWN0KSA9PiB7XG5cbiAgICAgIC8vIFJlc29sdmUgaW5wdXQgcGF0aHMgcmVsYXRpdmUgdG8gd29ya3NwYWNlIHJvb3QgYW5kIGFkZCBzbGFzaCBhdCB0aGUgZW5kLlxuICAgICAgYXNzZXQuaW5wdXQgPSBwYXRoLnJlc29sdmUocm9vdCwgYXNzZXQuaW5wdXQpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICAgIGFzc2V0LmlucHV0ID0gYXNzZXQuaW5wdXQuZW5kc1dpdGgoJy8nKSA/IGFzc2V0LmlucHV0IDogYXNzZXQuaW5wdXQgKyAnLyc7XG4gICAgICBhc3NldC5vdXRwdXQgPSBhc3NldC5vdXRwdXQuZW5kc1dpdGgoJy8nKSA/IGFzc2V0Lm91dHB1dCA6IGFzc2V0Lm91dHB1dCArICcvJztcblxuICAgICAgaWYgKGFzc2V0Lm91dHB1dC5zdGFydHNXaXRoKCcuLicpKSB7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSAnQW4gYXNzZXQgY2Fubm90IGJlIHdyaXR0ZW4gdG8gYSBsb2NhdGlvbiBvdXRzaWRlIG9mIHRoZSBvdXRwdXQgcGF0aC4nO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNvbnRleHQ6IGFzc2V0LmlucHV0LFxuICAgICAgICAvLyBOb3cgd2UgcmVtb3ZlIHN0YXJ0aW5nIHNsYXNoIHRvIG1ha2UgV2VicGFjayBwbGFjZSBpdCBmcm9tIHRoZSBvdXRwdXQgcm9vdC5cbiAgICAgICAgdG86IGFzc2V0Lm91dHB1dC5yZXBsYWNlKC9eXFwvLywgJycpLFxuICAgICAgICBmcm9tOiB7XG4gICAgICAgICAgZ2xvYjogYXNzZXQuZ2xvYixcbiAgICAgICAgICBkb3Q6IHRydWVcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvcHlXZWJwYWNrUGx1Z2luT3B0aW9ucyA9IHsgaWdub3JlOiBbJy5naXRrZWVwJywgJyoqLy5EU19TdG9yZScsICcqKi9UaHVtYnMuZGInXSB9O1xuXG4gICAgY29uc3QgY29weVdlYnBhY2tQbHVnaW5JbnN0YW5jZSA9IG5ldyBDb3B5V2VicGFja1BsdWdpbihjb3B5V2VicGFja1BsdWdpblBhdHRlcm5zLFxuICAgICAgY29weVdlYnBhY2tQbHVnaW5PcHRpb25zKTtcblxuICAgIC8vIFNhdmUgb3B0aW9ucyBzbyB3ZSBjYW4gdXNlIHRoZW0gaW4gZWplY3QuXG4gICAgKGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UgYXMgYW55KVsnY29weVdlYnBhY2tQbHVnaW5QYXR0ZXJucyddID0gY29weVdlYnBhY2tQbHVnaW5QYXR0ZXJucztcbiAgICAoY29weVdlYnBhY2tQbHVnaW5JbnN0YW5jZSBhcyBhbnkpWydjb3B5V2VicGFja1BsdWdpbk9wdGlvbnMnXSA9IGNvcHlXZWJwYWNrUGx1Z2luT3B0aW9ucztcblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5wcm9ncmVzcykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBQcm9ncmVzc1BsdWdpbih7IHByb2ZpbGU6IGJ1aWxkT3B0aW9ucy52ZXJib3NlLCBjb2xvcnM6IHRydWUgfSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zaG93Q2lyY3VsYXJEZXBlbmRlbmNpZXMpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgQ2lyY3VsYXJEZXBlbmRlbmN5UGx1Z2luKHtcbiAgICAgIGV4Y2x1ZGU6IC9bXFxcXFxcL11ub2RlX21vZHVsZXNbXFxcXFxcL10vXG4gICAgfSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdGF0c0pzb24pIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU3RhdHNQbHVnaW4oJ3N0YXRzLmpzb24nLCAndmVyYm9zZScpKTtcbiAgfVxuXG4gIGxldCBidWlsZE9wdGltaXplclVzZVJ1bGU7XG4gIGlmIChidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIpIHtcbiAgICBidWlsZE9wdGltaXplclVzZVJ1bGUgPSB7XG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogYnVpbGRPcHRpbWl6ZXJMb2FkZXIsXG4gICAgICAgICAgb3B0aW9uczogeyBzb3VyY2VNYXA6IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAgfVxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9O1xuICB9XG5cbiAgLy8gQWxsb3cgbG9hZGVycyB0byBiZSBpbiBhIG5vZGVfbW9kdWxlcyBuZXN0ZWQgaW5zaWRlIHRoZSBkZXZraXQvYnVpbGQtYW5ndWxhciBwYWNrYWdlLlxuICAvLyBUaGlzIGlzIGltcG9ydGFudCBpbiBjYXNlIGxvYWRlcnMgZG8gbm90IGdldCBob2lzdGVkLlxuICAvLyBJZiB0aGlzIGZpbGUgbW92ZXMgdG8gYW5vdGhlciBsb2NhdGlvbiwgYWx0ZXIgcG90ZW50aWFsTm9kZU1vZHVsZXMgYXMgd2VsbC5cbiAgY29uc3QgbG9hZGVyTm9kZU1vZHVsZXMgPSBbJ25vZGVfbW9kdWxlcyddO1xuICBjb25zdCBidWlsZEFuZ3VsYXJOb2RlTW9kdWxlcyA9IGZpbmRVcCgnbm9kZV9tb2R1bGVzJywgX19kaXJuYW1lKTtcbiAgaWYgKGJ1aWxkQW5ndWxhck5vZGVNb2R1bGVzXG4gICAgJiYgaXNEaXJlY3RvcnkoYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXMpXG4gICAgJiYgYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXMgIT09IG5vZGVNb2R1bGVzXG4gICAgJiYgYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXMuc3RhcnRzV2l0aChub2RlTW9kdWxlcylcbiAgKSB7XG4gICAgbG9hZGVyTm9kZU1vZHVsZXMucHVzaChidWlsZEFuZ3VsYXJOb2RlTW9kdWxlcyk7XG4gIH1cblxuICAvLyBMb2FkIHJ4anMgcGF0aCBhbGlhc2VzLlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vUmVhY3RpdmVYL3J4anMvYmxvYi9tYXN0ZXIvZG9jL2xldHRhYmxlLW9wZXJhdG9ycy5tZCNidWlsZC1hbmQtdHJlZXNoYWtpbmdcbiAgbGV0IGFsaWFzID0ge307XG4gIHRyeSB7XG4gICAgY29uc3Qgcnhqc1BhdGhNYXBwaW5nSW1wb3J0ID0gd2NvLnN1cHBvcnRFUzIwMTVcbiAgICAgID8gJ3J4anMvX2VzbTIwMTUvcGF0aC1tYXBwaW5nJ1xuICAgICAgOiAncnhqcy9fZXNtNS9wYXRoLW1hcHBpbmcnO1xuICAgIGNvbnN0IHJ4UGF0aHMgPSByZXF1aXJlUHJvamVjdE1vZHVsZShwcm9qZWN0Um9vdCwgcnhqc1BhdGhNYXBwaW5nSW1wb3J0KTtcbiAgICBhbGlhcyA9IHJ4UGF0aHMobm9kZU1vZHVsZXMpO1xuICB9IGNhdGNoIChlKSB7IH1cblxuICBjb25zdCB1Z2xpZnlPcHRpb25zID0ge1xuICAgIGVjbWE6IHdjby5zdXBwb3J0RVMyMDE1ID8gNiA6IDUsXG4gICAgd2FybmluZ3M6ICEhYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgc2FmYXJpMTA6IHRydWUsXG4gICAgb3V0cHV0OiB7XG4gICAgICBhc2NpaV9vbmx5OiB0cnVlLFxuICAgICAgY29tbWVudHM6IGZhbHNlLFxuICAgICAgd2Via2l0OiB0cnVlLFxuICAgIH0sXG5cbiAgICAvLyBPbiBzZXJ2ZXIsIHdlIGRvbid0IHdhbnQgdG8gY29tcHJlc3MgYW55dGhpbmcuXG4gICAgLi4uKGJ1aWxkT3B0aW9ucy5wbGF0Zm9ybSA9PSAnc2VydmVyJyA/IHt9IDoge1xuICAgICAgY29tcHJlc3M6IHtcbiAgICAgICAgcHVyZV9nZXR0ZXJzOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICAgIC8vIFBVUkUgY29tbWVudHMgd29yayBiZXN0IHdpdGggMyBwYXNzZXMuXG4gICAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay93ZWJwYWNrL2lzc3Vlcy8yODk5I2lzc3VlY29tbWVudC0zMTc0MjU5MjYuXG4gICAgICAgIHBhc3NlczogYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyID8gMyA6IDEsXG4gICAgICAgIC8vIFdvcmthcm91bmQga25vd24gdWdsaWZ5LWVzIGlzc3VlXG4gICAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWlzaG9vL1VnbGlmeUpTMi9pc3N1ZXMvMjk0OSNpc3N1ZWNvbW1lbnQtMzY4MDcwMzA3XG4gICAgICAgIGlubGluZTogd2NvLnN1cHBvcnRFUzIwMTUgPyAxIDogMyxcbiAgICAgIH1cbiAgICB9KSxcbiAgICAvLyBXZSBhbHNvIHdhbnQgdG8gYXZvaWQgbWFuZ2xpbmcgb24gc2VydmVyLlxuICAgIC4uLihidWlsZE9wdGlvbnMucGxhdGZvcm0gPT0gJ3NlcnZlcicgPyB7IG1hbmdsZTogZmFsc2UgfSA6IHt9KVxuICB9O1xuXG4gIHJldHVybiB7XG4gICAgbW9kZTogYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbiA/ICdwcm9kdWN0aW9uJyA6ICdkZXZlbG9wbWVudCcsXG4gICAgZGV2dG9vbDogZmFsc2UsXG4gICAgcmVzb2x2ZToge1xuICAgICAgZXh0ZW5zaW9uczogWycudHMnLCAnLm1qcycsICcuanMnXSxcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICBtb2R1bGVzOiBbXG4gICAgICAgIHdjby50c0NvbmZpZy5vcHRpb25zLmJhc2VVcmwgfHwgcHJvamVjdFJvb3QsXG4gICAgICAgICdub2RlX21vZHVsZXMnLFxuICAgICAgXSxcbiAgICAgIGFsaWFzXG4gICAgfSxcbiAgICByZXNvbHZlTG9hZGVyOiB7XG4gICAgICBtb2R1bGVzOiBsb2FkZXJOb2RlTW9kdWxlc1xuICAgIH0sXG4gICAgY29udGV4dDogcHJvamVjdFJvb3QsXG4gICAgZW50cnk6IGVudHJ5UG9pbnRzLFxuICAgIG91dHB1dDoge1xuICAgICAgcGF0aDogcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoIGFzIHN0cmluZyksXG4gICAgICBwdWJsaWNQYXRoOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICB9LFxuICAgIHBlcmZvcm1hbmNlOiB7XG4gICAgICBoaW50czogZmFsc2UsXG4gICAgfSxcbiAgICBtb2R1bGU6IHtcbiAgICAgIHJ1bGVzOiBbXG4gICAgICAgIHsgdGVzdDogL1xcLmh0bWwkLywgbG9hZGVyOiAncmF3LWxvYWRlcicgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC4oZW90fHN2Z3xjdXIpJC8sXG4gICAgICAgICAgbG9hZGVyOiAnZmlsZS1sb2FkZXInLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIG5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuZmlsZX0uW2V4dF1gLFxuICAgICAgICAgICAgbGltaXQ6IDEwMDAwXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLihqcGd8cG5nfHdlYnB8Z2lmfG90Znx0dGZ8d29mZnx3b2ZmMnxhbmkpJC8sXG4gICAgICAgICAgbG9hZGVyOiAndXJsLWxvYWRlcicsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5maWxlfS5bZXh0XWAsXG4gICAgICAgICAgICBsaW1pdDogMTAwMDBcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBNYXJrIGZpbGVzIGluc2lkZSBgQGFuZ3VsYXIvY29yZWAgYXMgdXNpbmcgU3lzdGVtSlMgc3R5bGUgZHluYW1pYyBpbXBvcnRzLlxuICAgICAgICAgIC8vIFJlbW92aW5nIHRoaXMgd2lsbCBjYXVzZSBkZXByZWNhdGlvbiB3YXJuaW5ncyB0byBhcHBlYXIuXG4gICAgICAgICAgdGVzdDogL1tcXC9cXFxcXUBhbmd1bGFyW1xcL1xcXFxdY29yZVtcXC9cXFxcXS4rXFwuanMkLyxcbiAgICAgICAgICBwYXJzZXI6IHsgc3lzdGVtOiB0cnVlIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuanMkLyxcbiAgICAgICAgICAuLi5idWlsZE9wdGltaXplclVzZVJ1bGUsXG4gICAgICAgIH0sXG4gICAgICBdXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG5vRW1pdE9uRXJyb3JzOiB0cnVlLFxuICAgICAgbWluaW1pemVyOiBbXG4gICAgICAgIG5ldyBIYXNoZWRNb2R1bGVJZHNQbHVnaW4oKSxcbiAgICAgICAgLy8gVE9ETzogY2hlY2sgd2l0aCBNaWtlIHdoYXQgdGhpcyBmZWF0dXJlIG5lZWRzLlxuICAgICAgICBuZXcgQnVuZGxlQnVkZ2V0UGx1Z2luKHsgYnVkZ2V0czogYnVpbGRPcHRpb25zLmJ1ZGdldHMgfSksXG4gICAgICAgIG5ldyBDbGVhbkNzc1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICAgIHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCxcbiAgICAgICAgICAvLyBjb21wb25lbnQgc3R5bGVzIHJldGFpbiB0aGVpciBvcmlnaW5hbCBmaWxlIG5hbWVcbiAgICAgICAgICB0ZXN0OiAoZmlsZSkgPT4gL1xcLig/OmNzc3xzY3NzfHNhc3N8bGVzc3xzdHlsKSQvLnRlc3QoZmlsZSksXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgVWdsaWZ5SlNQbHVnaW4oe1xuICAgICAgICAgIHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCxcbiAgICAgICAgICBwYXJhbGxlbDogdHJ1ZSxcbiAgICAgICAgICBjYWNoZTogdHJ1ZSxcbiAgICAgICAgICB1Z2xpZnlPcHRpb25zLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gIH07XG59XG4iXX0=