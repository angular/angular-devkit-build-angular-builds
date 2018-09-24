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
    if (!buildOptions.aot) {
        entryPoints['polyfills'] = [
            ...(entryPoints['polyfills'] || []),
            path.join(__dirname, '..', 'jit-polyfills.js'),
        ];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HO0FBQ0gsaUJBQWlCO0FBQ2pCLCtEQUErRDs7QUFFL0QsNkJBQTZCO0FBQzdCLHFDQUFnRDtBQUNoRCx5REFBeUQ7QUFDekQsbUNBQThDO0FBQzlDLCtEQUEyRDtBQUMzRCxtRkFBOEU7QUFFOUUsK0RBQWlFO0FBQ2pFLG1GQUE4RTtBQUM5RSxpRkFBNEU7QUFDNUUscURBQWlEO0FBRWpELG1DQUFvRDtBQUVwRCxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUM3RCxNQUFNLHdCQUF3QixHQUFHLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBQ3ZFLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO0FBQ3RELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBRXBEOzs7Ozs7Ozs7R0FTRztBQUVILE1BQU0sQ0FBQyxHQUFRLE9BQU8sTUFBTSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDOUMsUUFBQSxvQkFBb0IsR0FBVyxDQUFDLENBQUMsZ0JBQWdCLENBQUM7SUFDN0QsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsb0VBQW9FLENBQUM7SUFDdkYsQ0FBQyxDQUFDLGdEQUFnRCxDQUFDO0FBRXJELFNBQWdCLGVBQWUsQ0FBQyxHQUF5QjtJQUN2RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFFaEQsTUFBTSxXQUFXLEdBQUcsZ0JBQU0s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LElBQ1YscUJBQXFCO2dDQUd4QixJQUFJLEVBQUUsT0FBTyxFQUNiLE9BQU8sRUFBRSx5QkFBeUIsRUFDbEMsT0FBTyxFQUFFLEtBQUssSUFDWCxnQkFBZ0I7YUFFdEI7U0FDRjtRQUNELFlBQVksRUFBRTtZQUNaLGNBQWMsRUFBRSxJQUFJO1lBQ3BCLFNBQVMsRUFBRTtnQkFDVCxJQUFJLCtCQUFxQixFQUFFO2dCQUMzQixpREFBaUQ7Z0JBQ2pELElBQUksa0NBQWtCLENBQUMsRUFBRSxPQUFPLEVBQUUsWUFBWSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUN6RCxJQUFJLCtDQUFxQixDQUFDO29CQUN4QixTQUFTLEVBQUUsWUFBWSxDQUFDLFNBQVM7b0JBQ2pDLG1EQUFtRDtvQkFDbkQsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxnQ0FBZ0MsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO2lCQUM1RCxDQUFDO2dCQUNGLElBQUksWUFBWSxDQUFDO29CQUNmLFNBQVMsRUFBRSxZQUFZLENBQUMsU0FBUztvQkFDakMsUUFBUSxFQUFFLElBQUk7b0JBQ2QsS0FBSyxFQUFFLElBQUk7b0JBQ1gsYUFBYTtpQkFDZCxDQUFDO2FBQ0g7U0FDRjtRQUNELE9BQU8sRUFBRSxZQUFZO0tBQ3RCLENBQUM7QUFDSixDQUFDO0FBeFJELDBDQXdSQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbi8vIHRzbGludDpkaXNhYmxlXG4vLyBUT0RPOiBjbGVhbnVwIHRoaXMgZmlsZSwgaXQncyBjb3BpZWQgYXMgaXMgZnJvbSBBbmd1bGFyIENMSS5cblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEhhc2hlZE1vZHVsZUlkc1BsdWdpbiB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0ICogYXMgQ29weVdlYnBhY2tQbHVnaW4gZnJvbSAnY29weS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgeyBnZXRPdXRwdXRIYXNoRm9ybWF0IH0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQgeyBpc0RpcmVjdG9yeSB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9pcy1kaXJlY3RvcnknO1xuaW1wb3J0IHsgcmVxdWlyZVByb2plY3RNb2R1bGUgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvcmVxdWlyZS1wcm9qZWN0LW1vZHVsZSc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgQnVuZGxlQnVkZ2V0UGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9idW5kbGUtYnVkZ2V0JztcbmltcG9ydCB7IENsZWFuQ3NzV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvY2xlYW5jc3Mtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgU2NyaXB0c1dlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL3NjcmlwdHMtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgZmluZFVwIH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL2ZpbmQtdXAnO1xuaW1wb3J0IHsgQXNzZXRQYXR0ZXJuT2JqZWN0LCBFeHRyYUVudHJ5UG9pbnQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzIH0gZnJvbSAnLi91dGlscyc7XG5cbmNvbnN0IFByb2dyZXNzUGx1Z2luID0gcmVxdWlyZSgnd2VicGFjay9saWIvUHJvZ3Jlc3NQbHVnaW4nKTtcbmNvbnN0IENpcmN1bGFyRGVwZW5kZW5jeVBsdWdpbiA9IHJlcXVpcmUoJ2NpcmN1bGFyLWRlcGVuZGVuY3ktcGx1Z2luJyk7XG5jb25zdCBUZXJzZXJQbHVnaW4gPSByZXF1aXJlKCd0ZXJzZXItd2VicGFjay1wbHVnaW4nKTtcbmNvbnN0IFN0YXRzUGx1Z2luID0gcmVxdWlyZSgnc3RhdHMtd2VicGFjay1wbHVnaW4nKTtcblxuLyoqXG4gKiBFbnVtZXJhdGUgbG9hZGVycyBhbmQgdGhlaXIgZGVwZW5kZW5jaWVzIGZyb20gdGhpcyBmaWxlIHRvIGxldCB0aGUgZGVwZW5kZW5jeSB2YWxpZGF0b3JcbiAqIGtub3cgdGhleSBhcmUgdXNlZC5cbiAqXG4gKiByZXF1aXJlKCdzb3VyY2UtbWFwLWxvYWRlcicpXG4gKiByZXF1aXJlKCdyYXctbG9hZGVyJylcbiAqIHJlcXVpcmUoJ3VybC1sb2FkZXInKVxuICogcmVxdWlyZSgnZmlsZS1sb2FkZXInKVxuICogcmVxdWlyZSgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLW9wdGltaXplcicpXG4gKi9cblxuY29uc3QgZzogYW55ID0gdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWwgOiB7fTtcbmV4cG9ydCBjb25zdCBidWlsZE9wdGltaXplckxvYWRlcjogc3RyaW5nID0gZ1snX0RldktpdElzTG9jYWwnXVxuICA/IHJlcXVpcmUucmVzb2x2ZSgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLW9wdGltaXplci9zcmMvYnVpbGQtb3B0aW1pemVyL3dlYnBhY2stbG9hZGVyJylcbiAgOiAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLW9wdGltaXplci93ZWJwYWNrLWxvYWRlcic7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDb21tb25Db25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucykge1xuICBjb25zdCB7IHJvb3QsIHByb2plY3RSb290LCBidWlsZE9wdGlvbnMgfSA9IHdjbztcblxuICBjb25zdCBub2RlTW9kdWxlcyA9IGZpbmRVcCgnbm9kZV9tb2R1bGVzJywgcHJvamVjdFJvb3QpO1xuICBpZiAoIW5vZGVNb2R1bGVzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgbG9jYXRlIG5vZGVfbW9kdWxlcyBkaXJlY3RvcnkuJylcbiAgfVxuXG4gIGxldCBleHRyYVBsdWdpbnM6IGFueVtdID0gW107XG4gIGxldCBlbnRyeVBvaW50czogeyBba2V5OiBzdHJpbmddOiBzdHJpbmdbXSB9ID0ge307XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5tYWluKSB7XG4gICAgZW50cnlQb2ludHNbJ21haW4nXSA9IFtwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm1haW4pXTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMucG9seWZpbGxzKSB7XG4gICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gW3BhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMucG9seWZpbGxzKV07XG4gIH1cblxuICBpZiAoIWJ1aWxkT3B0aW9ucy5hb3QpIHtcbiAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10gPSBbXG4gICAgICAuLi4oZW50cnlQb2ludHNbJ3BvbHlmaWxscyddIHx8IFtdKSxcbiAgICAgIHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICdqaXQtcG9seWZpbGxzLmpzJyksXG4gICAgXTtcbiAgfVxuXG4gIC8vIGRldGVybWluZSBoYXNoaW5nIGZvcm1hdFxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyBhcyBhbnkpO1xuXG4gIC8vIHByb2Nlc3MgZ2xvYmFsIHNjcmlwdHNcbiAgaWYgKGJ1aWxkT3B0aW9ucy5zY3JpcHRzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lID0gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhidWlsZE9wdGlvbnMuc2NyaXB0cywgJ3NjcmlwdHMnKVxuICAgICAgLnJlZHVjZSgocHJldjogeyBidW5kbGVOYW1lOiBzdHJpbmcsIHBhdGhzOiBzdHJpbmdbXSwgbGF6eTogYm9vbGVhbiB9W10sIGN1cnIpID0+IHtcbiAgICAgICAgY29uc3QgYnVuZGxlTmFtZSA9IGN1cnIuYnVuZGxlTmFtZTtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWRQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIGN1cnIuaW5wdXQpO1xuICAgICAgICBsZXQgZXhpc3RpbmdFbnRyeSA9IHByZXYuZmluZCgoZWwpID0+IGVsLmJ1bmRsZU5hbWUgPT09IGJ1bmRsZU5hbWUpO1xuICAgICAgICBpZiAoZXhpc3RpbmdFbnRyeSkge1xuICAgICAgICAgIGlmIChleGlzdGluZ0VudHJ5LmxhenkgJiYgIWN1cnIubGF6eSkge1xuICAgICAgICAgICAgLy8gQWxsIGVudHJpZXMgaGF2ZSB0byBiZSBsYXp5IGZvciB0aGUgYnVuZGxlIHRvIGJlIGxhenkuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSAke2N1cnIuYnVuZGxlTmFtZX0gYnVuZGxlIGlzIG1peGluZyBsYXp5IGFuZCBub24tbGF6eSBzY3JpcHRzLmApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGV4aXN0aW5nRW50cnkucGF0aHMucHVzaChyZXNvbHZlZFBhdGgpO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJldi5wdXNoKHtcbiAgICAgICAgICAgIGJ1bmRsZU5hbWUsXG4gICAgICAgICAgICBwYXRoczogW3Jlc29sdmVkUGF0aF0sXG4gICAgICAgICAgICBsYXp5OiBjdXJyLmxhenlcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcHJldjtcbiAgICAgIH0sIFtdKTtcblxuXG4gICAgLy8gQWRkIGEgbmV3IGFzc2V0IGZvciBlYWNoIGVudHJ5LlxuICAgIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUuZm9yRWFjaCgoc2NyaXB0KSA9PiB7XG4gICAgICAvLyBMYXp5IHNjcmlwdHMgZG9uJ3QgZ2V0IGEgaGFzaCwgb3RoZXJ3aXNlIHRoZXkgY2FuJ3QgYmUgbG9hZGVkIGJ5IG5hbWUuXG4gICAgICBjb25zdCBoYXNoID0gc2NyaXB0LmxhenkgPyAnJyA6IGhhc2hGb3JtYXQuc2NyaXB0O1xuICAgICAgY29uc3QgYnVuZGxlTmFtZSA9IHNjcmlwdC5idW5kbGVOYW1lO1xuXG4gICAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU2NyaXB0c1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICBuYW1lOiBidW5kbGVOYW1lLFxuICAgICAgICBzb3VyY2VNYXA6IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAsXG4gICAgICAgIGZpbGVuYW1lOiBgJHtwYXRoLmJhc2VuYW1lKGJ1bmRsZU5hbWUpfSR7aGFzaH0uanNgLFxuICAgICAgICBzY3JpcHRzOiBzY3JpcHQucGF0aHMsXG4gICAgICAgIGJhc2VQYXRoOiBwcm9qZWN0Um9vdCxcbiAgICAgIH0pKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgYXNzZXQgZW50cmllc1xuICBpZiAoYnVpbGRPcHRpb25zLmFzc2V0cykge1xuICAgIGNvbnN0IGNvcHlXZWJwYWNrUGx1Z2luUGF0dGVybnMgPSBidWlsZE9wdGlvbnMuYXNzZXRzLm1hcCgoYXNzZXQ6IEFzc2V0UGF0dGVybk9iamVjdCkgPT4ge1xuXG4gICAgICAvLyBSZXNvbHZlIGlucHV0IHBhdGhzIHJlbGF0aXZlIHRvIHdvcmtzcGFjZSByb290IGFuZCBhZGQgc2xhc2ggYXQgdGhlIGVuZC5cbiAgICAgIGFzc2V0LmlucHV0ID0gcGF0aC5yZXNvbHZlKHJvb3QsIGFzc2V0LmlucHV0KS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgICBhc3NldC5pbnB1dCA9IGFzc2V0LmlucHV0LmVuZHNXaXRoKCcvJykgPyBhc3NldC5pbnB1dCA6IGFzc2V0LmlucHV0ICsgJy8nO1xuICAgICAgYXNzZXQub3V0cHV0ID0gYXNzZXQub3V0cHV0LmVuZHNXaXRoKCcvJykgPyBhc3NldC5vdXRwdXQgOiBhc3NldC5vdXRwdXQgKyAnLyc7XG5cbiAgICAgIGlmIChhc3NldC5vdXRwdXQuc3RhcnRzV2l0aCgnLi4nKSkge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gJ0FuIGFzc2V0IGNhbm5vdCBiZSB3cml0dGVuIHRvIGEgbG9jYXRpb24gb3V0c2lkZSBvZiB0aGUgb3V0cHV0IHBhdGguJztcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBjb250ZXh0OiBhc3NldC5pbnB1dCxcbiAgICAgICAgLy8gTm93IHdlIHJlbW92ZSBzdGFydGluZyBzbGFzaCB0byBtYWtlIFdlYnBhY2sgcGxhY2UgaXQgZnJvbSB0aGUgb3V0cHV0IHJvb3QuXG4gICAgICAgIHRvOiBhc3NldC5vdXRwdXQucmVwbGFjZSgvXlxcLy8sICcnKSxcbiAgICAgICAgaWdub3JlOiBhc3NldC5pZ25vcmUsXG4gICAgICAgIGZyb206IHtcbiAgICAgICAgICBnbG9iOiBhc3NldC5nbG9iLFxuICAgICAgICAgIGRvdDogdHJ1ZVxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgY29uc3QgY29weVdlYnBhY2tQbHVnaW5PcHRpb25zID0geyBpZ25vcmU6IFsnLmdpdGtlZXAnLCAnKiovLkRTX1N0b3JlJywgJyoqL1RodW1icy5kYiddIH07XG5cbiAgICBjb25zdCBjb3B5V2VicGFja1BsdWdpbkluc3RhbmNlID0gbmV3IENvcHlXZWJwYWNrUGx1Z2luKGNvcHlXZWJwYWNrUGx1Z2luUGF0dGVybnMsXG4gICAgICBjb3B5V2VicGFja1BsdWdpbk9wdGlvbnMpO1xuXG4gICAgLy8gU2F2ZSBvcHRpb25zIHNvIHdlIGNhbiB1c2UgdGhlbSBpbiBlamVjdC5cbiAgICAoY29weVdlYnBhY2tQbHVnaW5JbnN0YW5jZSBhcyBhbnkpWydjb3B5V2VicGFja1BsdWdpblBhdHRlcm5zJ10gPSBjb3B5V2VicGFja1BsdWdpblBhdHRlcm5zO1xuICAgIChjb3B5V2VicGFja1BsdWdpbkluc3RhbmNlIGFzIGFueSlbJ2NvcHlXZWJwYWNrUGx1Z2luT3B0aW9ucyddID0gY29weVdlYnBhY2tQbHVnaW5PcHRpb25zO1xuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goY29weVdlYnBhY2tQbHVnaW5JbnN0YW5jZSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnByb2dyZXNzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFByb2dyZXNzUGx1Z2luKHsgcHJvZmlsZTogYnVpbGRPcHRpb25zLnZlcmJvc2UsIGNvbG9yczogdHJ1ZSB9KSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnNob3dDaXJjdWxhckRlcGVuZGVuY2llcykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBDaXJjdWxhckRlcGVuZGVuY3lQbHVnaW4oe1xuICAgICAgZXhjbHVkZTogL1tcXFxcXFwvXW5vZGVfbW9kdWxlc1tcXFxcXFwvXS9cbiAgICB9KSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnN0YXRzSnNvbikge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBTdGF0c1BsdWdpbignc3RhdHMuanNvbicsICd2ZXJib3NlJykpO1xuICB9XG5cbiAgbGV0IHNvdXJjZU1hcFVzZVJ1bGU7XG4gIGlmIChidWlsZE9wdGlvbnMuc291cmNlTWFwICYmIGJ1aWxkT3B0aW9ucy52ZW5kb3JTb3VyY2VNYXApIHtcbiAgICBzb3VyY2VNYXBVc2VSdWxlID0ge1xuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6ICdzb3VyY2UtbWFwLWxvYWRlcidcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH1cbiAgfVxuXG4gIGxldCBidWlsZE9wdGltaXplclVzZVJ1bGU7XG4gIGlmIChidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIpIHtcbiAgICBidWlsZE9wdGltaXplclVzZVJ1bGUgPSB7XG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogYnVpbGRPcHRpbWl6ZXJMb2FkZXIsXG4gICAgICAgICAgb3B0aW9uczogeyBzb3VyY2VNYXA6IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAgfVxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9O1xuICB9XG5cbiAgLy8gQWxsb3cgbG9hZGVycyB0byBiZSBpbiBhIG5vZGVfbW9kdWxlcyBuZXN0ZWQgaW5zaWRlIHRoZSBkZXZraXQvYnVpbGQtYW5ndWxhciBwYWNrYWdlLlxuICAvLyBUaGlzIGlzIGltcG9ydGFudCBpbiBjYXNlIGxvYWRlcnMgZG8gbm90IGdldCBob2lzdGVkLlxuICAvLyBJZiB0aGlzIGZpbGUgbW92ZXMgdG8gYW5vdGhlciBsb2NhdGlvbiwgYWx0ZXIgcG90ZW50aWFsTm9kZU1vZHVsZXMgYXMgd2VsbC5cbiAgY29uc3QgbG9hZGVyTm9kZU1vZHVsZXMgPSBbJ25vZGVfbW9kdWxlcyddO1xuICBjb25zdCBidWlsZEFuZ3VsYXJOb2RlTW9kdWxlcyA9IGZpbmRVcCgnbm9kZV9tb2R1bGVzJywgX19kaXJuYW1lKTtcbiAgaWYgKGJ1aWxkQW5ndWxhck5vZGVNb2R1bGVzXG4gICAgJiYgaXNEaXJlY3RvcnkoYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXMpXG4gICAgJiYgYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXMgIT09IG5vZGVNb2R1bGVzXG4gICAgJiYgYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXMuc3RhcnRzV2l0aChub2RlTW9kdWxlcylcbiAgKSB7XG4gICAgbG9hZGVyTm9kZU1vZHVsZXMucHVzaChidWlsZEFuZ3VsYXJOb2RlTW9kdWxlcyk7XG4gIH1cblxuICAvLyBMb2FkIHJ4anMgcGF0aCBhbGlhc2VzLlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vUmVhY3RpdmVYL3J4anMvYmxvYi9tYXN0ZXIvZG9jL2xldHRhYmxlLW9wZXJhdG9ycy5tZCNidWlsZC1hbmQtdHJlZXNoYWtpbmdcbiAgbGV0IGFsaWFzID0ge307XG4gIHRyeSB7XG4gICAgY29uc3Qgcnhqc1BhdGhNYXBwaW5nSW1wb3J0ID0gd2NvLnN1cHBvcnRFUzIwMTVcbiAgICAgID8gJ3J4anMvX2VzbTIwMTUvcGF0aC1tYXBwaW5nJ1xuICAgICAgOiAncnhqcy9fZXNtNS9wYXRoLW1hcHBpbmcnO1xuICAgIGNvbnN0IHJ4UGF0aHMgPSByZXF1aXJlUHJvamVjdE1vZHVsZShwcm9qZWN0Um9vdCwgcnhqc1BhdGhNYXBwaW5nSW1wb3J0KTtcbiAgICBhbGlhcyA9IHJ4UGF0aHMobm9kZU1vZHVsZXMpO1xuICB9IGNhdGNoIHsgfVxuXG4gIGNvbnN0IGlzSXZ5RW5hYmxlZCA9IHdjby50c0NvbmZpZy5yYXcuYW5ndWxhckNvbXBpbGVyT3B0aW9uc1xuICAgICAgICAgICAgICAgICAgICAmJiB3Y28udHNDb25maWcucmF3LmFuZ3VsYXJDb21waWxlck9wdGlvbnMuZW5hYmxlSXZ5O1xuXG4gIGNvbnN0IHRlcnNlck9wdGlvbnMgPSB7XG4gICAgZWNtYTogd2NvLnN1cHBvcnRFUzIwMTUgPyA2IDogNSxcbiAgICB3YXJuaW5nczogISFidWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICBzYWZhcmkxMDogdHJ1ZSxcbiAgICBvdXRwdXQ6IHtcbiAgICAgIGFzY2lpX29ubHk6IHRydWUsXG4gICAgICBjb21tZW50czogZmFsc2UsXG4gICAgICB3ZWJraXQ6IHRydWUsXG4gICAgfSxcblxuICAgIC8vIE9uIHNlcnZlciwgd2UgZG9uJ3Qgd2FudCB0byBjb21wcmVzcyBhbnl0aGluZy4gV2Ugc3RpbGwgc2V0IHRoZSBuZ0Rldk1vZGUgPSBmYWxzZSBmb3IgaXRcbiAgICAvLyB0byByZW1vdmUgZGV2IGNvZGUuXG4gICAgY29tcHJlc3M6IChidWlsZE9wdGlvbnMucGxhdGZvcm0gPT0gJ3NlcnZlcicgPyB7XG4gICAgICBnbG9iYWxfZGVmczoge1xuICAgICAgICBuZ0Rldk1vZGU6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9IDoge1xuICAgICAgcHVyZV9nZXR0ZXJzOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICAvLyBQVVJFIGNvbW1lbnRzIHdvcmsgYmVzdCB3aXRoIDMgcGFzc2VzLlxuICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrL3dlYnBhY2svaXNzdWVzLzI4OTkjaXNzdWVjb21tZW50LTMxNzQyNTkyNi5cbiAgICAgIHBhc3NlczogYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyID8gMyA6IDEsXG4gICAgICBnbG9iYWxfZGVmczoge1xuICAgICAgICBuZ0Rldk1vZGU6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9KSxcbiAgICAvLyBXZSBhbHNvIHdhbnQgdG8gYXZvaWQgbWFuZ2xpbmcgb24gc2VydmVyLlxuICAgIC4uLihidWlsZE9wdGlvbnMucGxhdGZvcm0gPT0gJ3NlcnZlcicgPyB7IG1hbmdsZTogZmFsc2UgfSA6IHt9KSxcbiAgfTtcblxuICByZXR1cm4ge1xuICAgIG1vZGU6IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24gPyAncHJvZHVjdGlvbicgOiAnZGV2ZWxvcG1lbnQnLFxuICAgIGRldnRvb2w6IGZhbHNlLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICBtb2R1bGVzOiBbXG4gICAgICAgIHdjby50c0NvbmZpZy5vcHRpb25zLmJhc2VVcmwgfHwgcHJvamVjdFJvb3QsXG4gICAgICAgICdub2RlX21vZHVsZXMnLFxuICAgICAgXSxcbiAgICAgIGFsaWFzXG4gICAgfSxcbiAgICByZXNvbHZlTG9hZGVyOiB7XG4gICAgICBtb2R1bGVzOiBsb2FkZXJOb2RlTW9kdWxlc1xuICAgIH0sXG4gICAgY29udGV4dDogcHJvamVjdFJvb3QsXG4gICAgZW50cnk6IGVudHJ5UG9pbnRzLFxuICAgIG91dHB1dDoge1xuICAgICAgcGF0aDogcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoIGFzIHN0cmluZyksXG4gICAgICBwdWJsaWNQYXRoOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICB9LFxuICAgIHdhdGNoOiBidWlsZE9wdGlvbnMud2F0Y2gsXG4gICAgd2F0Y2hPcHRpb25zOiB7XG4gICAgICBwb2xsOiBidWlsZE9wdGlvbnMucG9sbFxuICAgIH0sXG4gICAgcGVyZm9ybWFuY2U6IHtcbiAgICAgIGhpbnRzOiBmYWxzZSxcbiAgICB9LFxuICAgIG1vZHVsZToge1xuICAgICAgcnVsZXM6IFtcbiAgICAgICAgeyB0ZXN0OiAvXFwuaHRtbCQvLCBsb2FkZXI6ICdyYXctbG9hZGVyJyB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLihlb3R8c3ZnfGN1cnxqcGd8cG5nfHdlYnB8Z2lmfG90Znx0dGZ8d29mZnx3b2ZmMnxhbmkpJC8sXG4gICAgICAgICAgbG9hZGVyOiAnZmlsZS1sb2FkZXInLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIG5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuZmlsZX0uW2V4dF1gLFxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIC8vIE1hcmsgZmlsZXMgaW5zaWRlIGBAYW5ndWxhci9jb3JlYCBhcyB1c2luZyBTeXN0ZW1KUyBzdHlsZSBkeW5hbWljIGltcG9ydHMuXG4gICAgICAgICAgLy8gUmVtb3ZpbmcgdGhpcyB3aWxsIGNhdXNlIGRlcHJlY2F0aW9uIHdhcm5pbmdzIHRvIGFwcGVhci5cbiAgICAgICAgICB0ZXN0OiAvW1xcL1xcXFxdQGFuZ3VsYXJbXFwvXFxcXF1jb3JlW1xcL1xcXFxdLitcXC5qcyQvLFxuICAgICAgICAgIHBhcnNlcjogeyBzeXN0ZW06IHRydWUgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5qcyQvLFxuICAgICAgICAgIC4uLmJ1aWxkT3B0aW1pemVyVXNlUnVsZSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5qcyQvLFxuICAgICAgICAgIGV4Y2x1ZGU6IC8obmdmYWN0b3J5fG5nc3R5bGUpLmpzJC8sXG4gICAgICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICAgICAgLi4uc291cmNlTWFwVXNlUnVsZSxcbiAgICAgICAgfSxcbiAgICAgIF1cbiAgICB9LFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgbm9FbWl0T25FcnJvcnM6IHRydWUsXG4gICAgICBtaW5pbWl6ZXI6IFtcbiAgICAgICAgbmV3IEhhc2hlZE1vZHVsZUlkc1BsdWdpbigpLFxuICAgICAgICAvLyBUT0RPOiBjaGVjayB3aXRoIE1pa2Ugd2hhdCB0aGlzIGZlYXR1cmUgbmVlZHMuXG4gICAgICAgIG5ldyBCdW5kbGVCdWRnZXRQbHVnaW4oeyBidWRnZXRzOiBidWlsZE9wdGlvbnMuYnVkZ2V0cyB9KSxcbiAgICAgICAgbmV3IENsZWFuQ3NzV2VicGFja1BsdWdpbih7XG4gICAgICAgICAgc291cmNlTWFwOiBidWlsZE9wdGlvbnMuc291cmNlTWFwLFxuICAgICAgICAgIC8vIGNvbXBvbmVudCBzdHlsZXMgcmV0YWluIHRoZWlyIG9yaWdpbmFsIGZpbGUgbmFtZVxuICAgICAgICAgIHRlc3Q6IChmaWxlKSA9PiAvXFwuKD86Y3NzfHNjc3N8c2Fzc3xsZXNzfHN0eWwpJC8udGVzdChmaWxlKSxcbiAgICAgICAgfSksXG4gICAgICAgIG5ldyBUZXJzZXJQbHVnaW4oe1xuICAgICAgICAgIHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCxcbiAgICAgICAgICBwYXJhbGxlbDogdHJ1ZSxcbiAgICAgICAgICBjYWNoZTogdHJ1ZSxcbiAgICAgICAgICB0ZXJzZXJPcHRpb25zLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gIH07XG59XG4iXX0=