"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const core_1 = require("@angular-devkit/core");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require("path");
const webpack_1 = require("webpack");
const bundle_budget_1 = require("../../plugins/bundle-budget");
const cleancss_webpack_plugin_1 = require("../../plugins/cleancss-webpack-plugin");
const scripts_webpack_plugin_1 = require("../../plugins/scripts-webpack-plugin");
const find_up_1 = require("../../utilities/find-up");
const require_project_module_1 = require("../../utilities/require-project-module");
const utils_1 = require("./utils");
const ProgressPlugin = require('webpack/lib/ProgressPlugin');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const StatsPlugin = require('stats-webpack-plugin');
// tslint:disable-next-line:no-any
const g = typeof global !== 'undefined' ? global : {};
exports.buildOptimizerLoader = g['_DevKitIsLocal']
    ? require.resolve('@angular-devkit/build-optimizer/src/build-optimizer/webpack-loader')
    : '@angular-devkit/build-optimizer/webpack-loader';
// tslint:disable-next-line:no-big-function
function getCommonConfig(wco) {
    const { root, projectRoot, buildOptions } = wco;
    const { styles: stylesOptimization, scripts: scriptsOptimization } = buildOptions.optimization;
    const { styles: stylesSourceMap, scripts: scriptsSourceMap, vendor: vendorSourceMap, } = buildOptions.sourceMap;
    const nodeModules = find_up_1.findUp('node_modules', projectRoot);
    if (!nodeModules) {
        throw new Error('Cannot locate node_modules directory.');
    }
    // tslint:disable-next-line:no-any
    const extraPlugins = [];
    const entryPoints = {};
    if (buildOptions.main) {
        entryPoints['main'] = [path.resolve(root, buildOptions.main)];
    }
    if (buildOptions.es5BrowserSupport) {
        entryPoints['polyfills.es5'] = [path.join(__dirname, '..', 'es2015-polyfills.js')];
    }
    if (buildOptions.polyfills) {
        entryPoints['polyfills'] = [path.resolve(root, buildOptions.polyfills)];
    }
    if (!buildOptions.aot) {
        entryPoints['polyfills'] = [
            ...(entryPoints['polyfills'] || []),
            path.join(__dirname, '..', 'jit-polyfills.js'),
        ];
        if (buildOptions.es5BrowserSupport) {
            entryPoints['polyfills.es5'] = [
                ...entryPoints['polyfills.es5'],
                path.join(__dirname, '..', 'es2015-jit-polyfills.js'),
            ];
        }
    }
    if (buildOptions.profile) {
        extraPlugins.push(new webpack_1.debug.ProfilingPlugin({
            outputPath: path.resolve(root, 'chrome-profiler-events.json'),
        }));
    }
    // determine hashing format
    const hashFormat = utils_1.getOutputHashFormat(buildOptions.outputHashing || 'none');
    // process global scripts
    if (buildOptions.scripts.length > 0) {
        const globalScriptsByBundleName = utils_1.normalizeExtraEntryPoints(buildOptions.scripts, 'scripts')
            .reduce((prev, curr) => {
            const bundleName = curr.bundleName;
            const resolvedPath = path.resolve(root, curr.input);
            const existingEntry = prev.find((el) => el.bundleName === bundleName);
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
                    lazy: curr.lazy || false,
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
                sourceMap: scriptsSourceMap,
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
                    dot: true,
                },
            };
        });
        const copyWebpackPluginOptions = { ignore: ['.gitkeep', '**/.DS_Store', '**/Thumbs.db'] };
        const copyWebpackPluginInstance = new CopyWebpackPlugin(copyWebpackPluginPatterns, copyWebpackPluginOptions);
        extraPlugins.push(copyWebpackPluginInstance);
    }
    if (buildOptions.progress) {
        extraPlugins.push(new ProgressPlugin({ profile: buildOptions.verbose }));
    }
    if (buildOptions.showCircularDependencies) {
        extraPlugins.push(new CircularDependencyPlugin({
            exclude: /([\\\/]node_modules[\\\/])|(ngfactory\.js$)/,
        }));
    }
    if (buildOptions.statsJson) {
        extraPlugins.push(new StatsPlugin('stats.json', 'verbose'));
    }
    let sourceMapUseRule;
    if ((scriptsSourceMap || stylesSourceMap) && vendorSourceMap) {
        sourceMapUseRule = {
            use: [
                {
                    loader: 'source-map-loader',
                },
            ],
        };
    }
    let buildOptimizerUseRule;
    if (buildOptions.buildOptimizer) {
        buildOptimizerUseRule = {
            use: [
                {
                    loader: exports.buildOptimizerLoader,
                    options: { sourceMap: scriptsSourceMap },
                },
            ],
        };
    }
    // Allow loaders to be in a node_modules nested inside the devkit/build-angular package.
    // This is important in case loaders do not get hoisted.
    // If this file moves to another location, alter potentialNodeModules as well.
    const loaderNodeModules = find_up_1.findAllNodeModules(__dirname, projectRoot);
    loaderNodeModules.unshift('node_modules');
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
    const extraMinimizers = [];
    if (stylesOptimization) {
        extraMinimizers.push(new cleancss_webpack_plugin_1.CleanCssWebpackPlugin({
            sourceMap: stylesSourceMap,
            // component styles retain their original file name
            test: (file) => /\.(?:css|scss|sass|less|styl)$/.test(file),
        }));
    }
    if (scriptsOptimization) {
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
        extraMinimizers.push(new TerserPlugin({
            sourceMap: scriptsSourceMap,
            parallel: true,
            cache: true,
            terserOptions,
        }));
    }
    if (wco.tsConfig.options.target === 4) {
        wco.logger.warn(core_1.tags.stripIndent `
      WARNING: Zone.js does not support native async/await in ES2017.
      These blocks are not intercepted by zone.js and will not triggering change detection.
      See: https://github.com/angular/zone.js/pull/1140 for more information.
    `);
    }
    return {
        mode: scriptsOptimization || stylesOptimization
            ? 'production'
            : 'development',
        devtool: false,
        resolve: {
            extensions: ['.ts', '.tsx', '.mjs', '.js'],
            symlinks: !buildOptions.preserveSymlinks,
            modules: [
                wco.tsConfig.options.baseUrl || projectRoot,
                'node_modules',
            ],
            alias,
        },
        resolveLoader: {
            modules: loaderNodeModules,
        },
        context: projectRoot,
        entry: entryPoints,
        output: {
            futureEmitAssets: true,
            path: path.resolve(root, buildOptions.outputPath),
            publicPath: buildOptions.deployUrl,
            filename: `[name]${hashFormat.chunk}.js`,
        },
        watch: buildOptions.watch,
        watchOptions: {
            poll: buildOptions.poll,
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
                    },
                },
                {
                    // Mark files inside `@angular/core` as using SystemJS style dynamic imports.
                    // Removing this will cause deprecation warnings to appear.
                    test: /[\/\\]@angular[\/\\]core[\/\\].+\.js$/,
                    parser: { system: true },
                },
                Object.assign({ test: /\.js$/ }, buildOptimizerUseRule),
                Object.assign({ test: /\.js$/, exclude: /(ngfactory|ngstyle).js$/, enforce: 'pre' }, sourceMapUseRule),
            ],
        },
        optimization: {
            noEmitOnErrors: true,
            minimizer: [
                new webpack_1.HashedModuleIdsPlugin(),
                // TODO: check with Mike what this feature needs.
                new bundle_budget_1.BundleBudgetPlugin({ budgets: buildOptions.budgets }),
                ...extraMinimizers,
            ],
        },
        plugins: extraPlugins,
    };
}
exports.getCommonConfig = getCommonConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILCtDQUE0QztBQUM1Qyx5REFBeUQ7QUFDekQsNkJBQTZCO0FBQzdCLHFDQUF1RDtBQUV2RCwrREFBaUU7QUFDakUsbUZBQThFO0FBQzlFLGlGQUE0RTtBQUM1RSxxREFBcUU7QUFDckUsbUZBQThFO0FBRTlFLG1DQUF5RTtBQUV6RSxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUM3RCxNQUFNLHdCQUF3QixHQUFHLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBQ3ZFLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO0FBQ3RELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBR3BELGtDQUFrQztBQUNsQyxNQUFNLENBQUMsR0FBUSxPQUFPLE1BQU0sS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQzlDLFFBQUEsb0JBQW9CLEdBQVcsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0lBQzdELENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLG9FQUFvRSxDQUFDO0lBQ3ZGLENBQUMsQ0FBQyxnREFBZ0QsQ0FBQztBQUVyRCwyQ0FBMkM7QUFDM0MsU0FBZ0IsZUFBZSxDQUFDLEdBQXlCO0lBQ3ZELE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxHQUFHLEdBQUcsQ0FBQztJQUNoRCxNQUFNLEVBQUUsTUFBTSxFQUFFLGtCQUFrQixFQUFFLE9BQU8sRUFBRSxtQkFBbUIsRUFB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QUFnQjthQUV0QjtTQUNGO1FBQ0QsWUFBWSxFQUFFO1lBQ1osY0FBYyxFQUFFLElBQUk7WUFDcEIsU0FBUyxFQUFFO2dCQUNULElBQUksK0JBQXFCLEVBQUU7Z0JBQzNCLGlEQUFpRDtnQkFDakQsSUFBSSxrQ0FBa0IsQ0FBQyxFQUFFLE9BQU8sRUFBRSxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3pELEdBQUcsZUFBZTthQUNuQjtTQUNGO1FBQ0QsT0FBTyxFQUFFLFlBQVk7S0FDdEIsQ0FBQztBQUNKLENBQUM7QUF6VEQsMENBeVRDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHsgdGFncyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCAqIGFzIENvcHlXZWJwYWNrUGx1Z2luIGZyb20gJ2NvcHktd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEhhc2hlZE1vZHVsZUlkc1BsdWdpbiwgZGVidWcgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IEFzc2V0UGF0dGVybkNsYXNzIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgQnVuZGxlQnVkZ2V0UGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9idW5kbGUtYnVkZ2V0JztcbmltcG9ydCB7IENsZWFuQ3NzV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvY2xlYW5jc3Mtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgU2NyaXB0c1dlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL3NjcmlwdHMtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgZmluZEFsbE5vZGVNb2R1bGVzLCBmaW5kVXAgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvZmluZC11cCc7XG5pbXBvcnQgeyByZXF1aXJlUHJvamVjdE1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9yZXF1aXJlLXByb2plY3QtbW9kdWxlJztcbmltcG9ydCB7IEJ1aWxkT3B0aW9ucywgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IGdldE91dHB1dEhhc2hGb3JtYXQsIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMgfSBmcm9tICcuL3V0aWxzJztcblxuY29uc3QgUHJvZ3Jlc3NQbHVnaW4gPSByZXF1aXJlKCd3ZWJwYWNrL2xpYi9Qcm9ncmVzc1BsdWdpbicpO1xuY29uc3QgQ2lyY3VsYXJEZXBlbmRlbmN5UGx1Z2luID0gcmVxdWlyZSgnY2lyY3VsYXItZGVwZW5kZW5jeS1wbHVnaW4nKTtcbmNvbnN0IFRlcnNlclBsdWdpbiA9IHJlcXVpcmUoJ3RlcnNlci13ZWJwYWNrLXBsdWdpbicpO1xuY29uc3QgU3RhdHNQbHVnaW4gPSByZXF1aXJlKCdzdGF0cy13ZWJwYWNrLXBsdWdpbicpO1xuXG5cbi8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbmNvbnN0IGc6IGFueSA9IHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsIDoge307XG5leHBvcnQgY29uc3QgYnVpbGRPcHRpbWl6ZXJMb2FkZXI6IHN0cmluZyA9IGdbJ19EZXZLaXRJc0xvY2FsJ11cbiAgPyByZXF1aXJlLnJlc29sdmUoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXIvc3JjL2J1aWxkLW9wdGltaXplci93ZWJwYWNrLWxvYWRlcicpXG4gIDogJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXIvd2VicGFjay1sb2FkZXInO1xuXG4vLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYmlnLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q29tbW9uQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpIHtcbiAgY29uc3QgeyByb290LCBwcm9qZWN0Um9vdCwgYnVpbGRPcHRpb25zIH0gPSB3Y287XG4gIGNvbnN0IHsgc3R5bGVzOiBzdHlsZXNPcHRpbWl6YXRpb24sIHNjcmlwdHM6IHNjcmlwdHNPcHRpbWl6YXRpb24gfSA9IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb247XG4gIGNvbnN0IHtcbiAgICBzdHlsZXM6IHN0eWxlc1NvdXJjZU1hcCxcbiAgICBzY3JpcHRzOiBzY3JpcHRzU291cmNlTWFwLFxuICAgIHZlbmRvcjogdmVuZG9yU291cmNlTWFwLFxuICB9ID0gYnVpbGRPcHRpb25zLnNvdXJjZU1hcDtcblxuICBjb25zdCBub2RlTW9kdWxlcyA9IGZpbmRVcCgnbm9kZV9tb2R1bGVzJywgcHJvamVjdFJvb3QpO1xuICBpZiAoIW5vZGVNb2R1bGVzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgbG9jYXRlIG5vZGVfbW9kdWxlcyBkaXJlY3RvcnkuJyk7XG4gIH1cblxuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gIGNvbnN0IGV4dHJhUGx1Z2luczogYW55W10gPSBbXTtcbiAgY29uc3QgZW50cnlQb2ludHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nW10gfSA9IHt9O1xuXG4gIGlmIChidWlsZE9wdGlvbnMubWFpbikge1xuICAgIGVudHJ5UG9pbnRzWydtYWluJ10gPSBbcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5tYWluKV07XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmVzNUJyb3dzZXJTdXBwb3J0KSB7XG4gICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscy5lczUnXSA9IFtwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnZXMyMDE1LXBvbHlmaWxscy5qcycpXTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMucG9seWZpbGxzKSB7XG4gICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gW3BhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMucG9seWZpbGxzKV07XG4gIH1cblxuICBpZiAoIWJ1aWxkT3B0aW9ucy5hb3QpIHtcbiAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10gPSBbXG4gICAgICAuLi4oZW50cnlQb2ludHNbJ3BvbHlmaWxscyddIHx8IFtdKSxcbiAgICAgIHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICdqaXQtcG9seWZpbGxzLmpzJyksXG4gICAgXTtcblxuICAgIGlmIChidWlsZE9wdGlvbnMuZXM1QnJvd3NlclN1cHBvcnQpIHtcbiAgICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMuZXM1J10gPSBbXG4gICAgICAgIC4uLmVudHJ5UG9pbnRzWydwb2x5ZmlsbHMuZXM1J10sXG4gICAgICAgIHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICdlczIwMTUtaml0LXBvbHlmaWxscy5qcycpLFxuICAgICAgXTtcbiAgICB9XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnByb2ZpbGUpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgZGVidWcuUHJvZmlsaW5nUGx1Z2luKHtcbiAgICAgIG91dHB1dFBhdGg6IHBhdGgucmVzb2x2ZShyb290LCAnY2hyb21lLXByb2ZpbGVyLWV2ZW50cy5qc29uJyksXG4gICAgfSkpO1xuICB9XG5cbiAgLy8gZGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0XG4gIGNvbnN0IGhhc2hGb3JtYXQgPSBnZXRPdXRwdXRIYXNoRm9ybWF0KGJ1aWxkT3B0aW9ucy5vdXRwdXRIYXNoaW5nIHx8ICdub25lJyk7XG5cbiAgLy8gcHJvY2VzcyBnbG9iYWwgc2NyaXB0c1xuICBpZiAoYnVpbGRPcHRpb25zLnNjcmlwdHMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUgPSBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKGJ1aWxkT3B0aW9ucy5zY3JpcHRzLCAnc2NyaXB0cycpXG4gICAgICAucmVkdWNlKChwcmV2OiB7IGJ1bmRsZU5hbWU6IHN0cmluZywgcGF0aHM6IHN0cmluZ1tdLCBsYXp5OiBib29sZWFuIH1bXSwgY3VycikgPT4ge1xuICAgICAgICBjb25zdCBidW5kbGVOYW1lID0gY3Vyci5idW5kbGVOYW1lO1xuICAgICAgICBjb25zdCByZXNvbHZlZFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgY3Vyci5pbnB1dCk7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nRW50cnkgPSBwcmV2LmZpbmQoKGVsKSA9PiBlbC5idW5kbGVOYW1lID09PSBidW5kbGVOYW1lKTtcbiAgICAgICAgaWYgKGV4aXN0aW5nRW50cnkpIHtcbiAgICAgICAgICBpZiAoZXhpc3RpbmdFbnRyeS5sYXp5ICYmICFjdXJyLmxhenkpIHtcbiAgICAgICAgICAgIC8vIEFsbCBlbnRyaWVzIGhhdmUgdG8gYmUgbGF6eSBmb3IgdGhlIGJ1bmRsZSB0byBiZSBsYXp5LlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJHtjdXJyLmJ1bmRsZU5hbWV9IGJ1bmRsZSBpcyBtaXhpbmcgbGF6eSBhbmQgbm9uLWxhenkgc2NyaXB0cy5gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBleGlzdGluZ0VudHJ5LnBhdGhzLnB1c2gocmVzb2x2ZWRQYXRoKTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHByZXYucHVzaCh7XG4gICAgICAgICAgICBidW5kbGVOYW1lLFxuICAgICAgICAgICAgcGF0aHM6IFtyZXNvbHZlZFBhdGhdLFxuICAgICAgICAgICAgbGF6eTogY3Vyci5sYXp5IHx8IGZhbHNlLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHByZXY7XG4gICAgICB9LCBbXSk7XG5cblxuICAgIC8vIEFkZCBhIG5ldyBhc3NldCBmb3IgZWFjaCBlbnRyeS5cbiAgICBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lLmZvckVhY2goKHNjcmlwdCkgPT4ge1xuICAgICAgLy8gTGF6eSBzY3JpcHRzIGRvbid0IGdldCBhIGhhc2gsIG90aGVyd2lzZSB0aGV5IGNhbid0IGJlIGxvYWRlZCBieSBuYW1lLlxuICAgICAgY29uc3QgaGFzaCA9IHNjcmlwdC5sYXp5ID8gJycgOiBoYXNoRm9ybWF0LnNjcmlwdDtcbiAgICAgIGNvbnN0IGJ1bmRsZU5hbWUgPSBzY3JpcHQuYnVuZGxlTmFtZTtcblxuICAgICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFNjcmlwdHNXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgbmFtZTogYnVuZGxlTmFtZSxcbiAgICAgICAgc291cmNlTWFwOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgICBmaWxlbmFtZTogYCR7cGF0aC5iYXNlbmFtZShidW5kbGVOYW1lKX0ke2hhc2h9LmpzYCxcbiAgICAgICAgc2NyaXB0czogc2NyaXB0LnBhdGhzLFxuICAgICAgICBiYXNlUGF0aDogcHJvamVjdFJvb3QsXG4gICAgICB9KSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBwcm9jZXNzIGFzc2V0IGVudHJpZXNcbiAgaWYgKGJ1aWxkT3B0aW9ucy5hc3NldHMpIHtcbiAgICBjb25zdCBjb3B5V2VicGFja1BsdWdpblBhdHRlcm5zID0gYnVpbGRPcHRpb25zLmFzc2V0cy5tYXAoKGFzc2V0OiBBc3NldFBhdHRlcm5DbGFzcykgPT4ge1xuXG4gICAgICAvLyBSZXNvbHZlIGlucHV0IHBhdGhzIHJlbGF0aXZlIHRvIHdvcmtzcGFjZSByb290IGFuZCBhZGQgc2xhc2ggYXQgdGhlIGVuZC5cbiAgICAgIGFzc2V0LmlucHV0ID0gcGF0aC5yZXNvbHZlKHJvb3QsIGFzc2V0LmlucHV0KS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgICBhc3NldC5pbnB1dCA9IGFzc2V0LmlucHV0LmVuZHNXaXRoKCcvJykgPyBhc3NldC5pbnB1dCA6IGFzc2V0LmlucHV0ICsgJy8nO1xuICAgICAgYXNzZXQub3V0cHV0ID0gYXNzZXQub3V0cHV0LmVuZHNXaXRoKCcvJykgPyBhc3NldC5vdXRwdXQgOiBhc3NldC5vdXRwdXQgKyAnLyc7XG5cbiAgICAgIGlmIChhc3NldC5vdXRwdXQuc3RhcnRzV2l0aCgnLi4nKSkge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gJ0FuIGFzc2V0IGNhbm5vdCBiZSB3cml0dGVuIHRvIGEgbG9jYXRpb24gb3V0c2lkZSBvZiB0aGUgb3V0cHV0IHBhdGguJztcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBjb250ZXh0OiBhc3NldC5pbnB1dCxcbiAgICAgICAgLy8gTm93IHdlIHJlbW92ZSBzdGFydGluZyBzbGFzaCB0byBtYWtlIFdlYnBhY2sgcGxhY2UgaXQgZnJvbSB0aGUgb3V0cHV0IHJvb3QuXG4gICAgICAgIHRvOiBhc3NldC5vdXRwdXQucmVwbGFjZSgvXlxcLy8sICcnKSxcbiAgICAgICAgaWdub3JlOiBhc3NldC5pZ25vcmUsXG4gICAgICAgIGZyb206IHtcbiAgICAgICAgICBnbG9iOiBhc3NldC5nbG9iLFxuICAgICAgICAgIGRvdDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH07XG4gICAgfSk7XG5cbiAgICBjb25zdCBjb3B5V2VicGFja1BsdWdpbk9wdGlvbnMgPSB7IGlnbm9yZTogWycuZ2l0a2VlcCcsICcqKi8uRFNfU3RvcmUnLCAnKiovVGh1bWJzLmRiJ10gfTtcblxuICAgIGNvbnN0IGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UgPSBuZXcgQ29weVdlYnBhY2tQbHVnaW4oY29weVdlYnBhY2tQbHVnaW5QYXR0ZXJucyxcbiAgICAgIGNvcHlXZWJwYWNrUGx1Z2luT3B0aW9ucyk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goY29weVdlYnBhY2tQbHVnaW5JbnN0YW5jZSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnByb2dyZXNzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFByb2dyZXNzUGx1Z2luKHsgcHJvZmlsZTogYnVpbGRPcHRpb25zLnZlcmJvc2UgfSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zaG93Q2lyY3VsYXJEZXBlbmRlbmNpZXMpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgQ2lyY3VsYXJEZXBlbmRlbmN5UGx1Z2luKHtcbiAgICAgIGV4Y2x1ZGU6IC8oW1xcXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFxcXC9dKXwobmdmYWN0b3J5XFwuanMkKS8sXG4gICAgfSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdGF0c0pzb24pIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU3RhdHNQbHVnaW4oJ3N0YXRzLmpzb24nLCAndmVyYm9zZScpKTtcbiAgfVxuXG4gIGxldCBzb3VyY2VNYXBVc2VSdWxlO1xuICBpZiAoKHNjcmlwdHNTb3VyY2VNYXAgfHwgc3R5bGVzU291cmNlTWFwKSAmJiB2ZW5kb3JTb3VyY2VNYXApIHtcbiAgICBzb3VyY2VNYXBVc2VSdWxlID0ge1xuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6ICdzb3VyY2UtbWFwLWxvYWRlcicsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH07XG4gIH1cblxuICBsZXQgYnVpbGRPcHRpbWl6ZXJVc2VSdWxlO1xuICBpZiAoYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyKSB7XG4gICAgYnVpbGRPcHRpbWl6ZXJVc2VSdWxlID0ge1xuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IGJ1aWxkT3B0aW1pemVyTG9hZGVyLFxuICAgICAgICAgIG9wdGlvbnM6IHsgc291cmNlTWFwOiBzY3JpcHRzU291cmNlTWFwIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH07XG4gIH1cblxuICAvLyBBbGxvdyBsb2FkZXJzIHRvIGJlIGluIGEgbm9kZV9tb2R1bGVzIG5lc3RlZCBpbnNpZGUgdGhlIGRldmtpdC9idWlsZC1hbmd1bGFyIHBhY2thZ2UuXG4gIC8vIFRoaXMgaXMgaW1wb3J0YW50IGluIGNhc2UgbG9hZGVycyBkbyBub3QgZ2V0IGhvaXN0ZWQuXG4gIC8vIElmIHRoaXMgZmlsZSBtb3ZlcyB0byBhbm90aGVyIGxvY2F0aW9uLCBhbHRlciBwb3RlbnRpYWxOb2RlTW9kdWxlcyBhcyB3ZWxsLlxuICBjb25zdCBsb2FkZXJOb2RlTW9kdWxlcyA9IGZpbmRBbGxOb2RlTW9kdWxlcyhfX2Rpcm5hbWUsIHByb2plY3RSb290KTtcbiAgbG9hZGVyTm9kZU1vZHVsZXMudW5zaGlmdCgnbm9kZV9tb2R1bGVzJyk7XG5cbiAgLy8gTG9hZCByeGpzIHBhdGggYWxpYXNlcy5cbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL1JlYWN0aXZlWC9yeGpzL2Jsb2IvbWFzdGVyL2RvYy9sZXR0YWJsZS1vcGVyYXRvcnMubWQjYnVpbGQtYW5kLXRyZWVzaGFraW5nXG4gIGxldCBhbGlhcyA9IHt9O1xuICB0cnkge1xuICAgIGNvbnN0IHJ4anNQYXRoTWFwcGluZ0ltcG9ydCA9IHdjby5zdXBwb3J0RVMyMDE1XG4gICAgICA/ICdyeGpzL19lc20yMDE1L3BhdGgtbWFwcGluZydcbiAgICAgIDogJ3J4anMvX2VzbTUvcGF0aC1tYXBwaW5nJztcbiAgICBjb25zdCByeFBhdGhzID0gcmVxdWlyZVByb2plY3RNb2R1bGUocHJvamVjdFJvb3QsIHJ4anNQYXRoTWFwcGluZ0ltcG9ydCk7XG4gICAgYWxpYXMgPSByeFBhdGhzKG5vZGVNb2R1bGVzKTtcbiAgfSBjYXRjaCB7IH1cblxuICBjb25zdCBleHRyYU1pbmltaXplcnMgPSBbXTtcbiAgaWYgKHN0eWxlc09wdGltaXphdGlvbikge1xuICAgIGV4dHJhTWluaW1pemVycy5wdXNoKFxuICAgICAgbmV3IENsZWFuQ3NzV2VicGFja1BsdWdpbih7XG4gICAgICAgIHNvdXJjZU1hcDogc3R5bGVzU291cmNlTWFwLFxuICAgICAgICAvLyBjb21wb25lbnQgc3R5bGVzIHJldGFpbiB0aGVpciBvcmlnaW5hbCBmaWxlIG5hbWVcbiAgICAgICAgdGVzdDogKGZpbGUpID0+IC9cXC4oPzpjc3N8c2Nzc3xzYXNzfGxlc3N8c3R5bCkkLy50ZXN0KGZpbGUpLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzY3JpcHRzT3B0aW1pemF0aW9uKSB7XG4gICAgY29uc3QgdGVyc2VyT3B0aW9ucyA9IHtcbiAgICAgIGVjbWE6IHdjby5zdXBwb3J0RVMyMDE1ID8gNiA6IDUsXG4gICAgICB3YXJuaW5nczogISFidWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgIHNhZmFyaTEwOiB0cnVlLFxuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIGFzY2lpX29ubHk6IHRydWUsXG4gICAgICAgIGNvbW1lbnRzOiBmYWxzZSxcbiAgICAgICAgd2Via2l0OiB0cnVlLFxuICAgICAgfSxcblxuICAgICAgLy8gT24gc2VydmVyLCB3ZSBkb24ndCB3YW50IHRvIGNvbXByZXNzIGFueXRoaW5nLiBXZSBzdGlsbCBzZXQgdGhlIG5nRGV2TW9kZSA9IGZhbHNlIGZvciBpdFxuICAgICAgLy8gdG8gcmVtb3ZlIGRldiBjb2RlLlxuICAgICAgY29tcHJlc3M6IChidWlsZE9wdGlvbnMucGxhdGZvcm0gPT0gJ3NlcnZlcicgPyB7XG4gICAgICAgIGdsb2JhbF9kZWZzOiB7XG4gICAgICAgICAgbmdEZXZNb2RlOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgIH0gOiB7XG4gICAgICAgICAgcHVyZV9nZXR0ZXJzOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICAgICAgLy8gUFVSRSBjb21tZW50cyB3b3JrIGJlc3Qgd2l0aCAzIHBhc3Nlcy5cbiAgICAgICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay9pc3N1ZXMvMjg5OSNpc3N1ZWNvbW1lbnQtMzE3NDI1OTI2LlxuICAgICAgICAgIHBhc3NlczogYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyID8gMyA6IDEsXG4gICAgICAgICAgZ2xvYmFsX2RlZnM6IHtcbiAgICAgICAgICAgIG5nRGV2TW9kZTogZmFsc2UsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICAvLyBXZSBhbHNvIHdhbnQgdG8gYXZvaWQgbWFuZ2xpbmcgb24gc2VydmVyLlxuICAgICAgLi4uKGJ1aWxkT3B0aW9ucy5wbGF0Zm9ybSA9PSAnc2VydmVyJyA/IHsgbWFuZ2xlOiBmYWxzZSB9IDoge30pLFxuICAgIH07XG5cbiAgICBleHRyYU1pbmltaXplcnMucHVzaChcbiAgICAgIG5ldyBUZXJzZXJQbHVnaW4oe1xuICAgICAgICBzb3VyY2VNYXA6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICAgIHBhcmFsbGVsOiB0cnVlLFxuICAgICAgICBjYWNoZTogdHJ1ZSxcbiAgICAgICAgdGVyc2VyT3B0aW9ucyxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAod2NvLnRzQ29uZmlnLm9wdGlvbnMudGFyZ2V0ID09PSA0KSB7XG4gICAgd2NvLmxvZ2dlci53YXJuKHRhZ3Muc3RyaXBJbmRlbnRgXG4gICAgICBXQVJOSU5HOiBab25lLmpzIGRvZXMgbm90IHN1cHBvcnQgbmF0aXZlIGFzeW5jL2F3YWl0IGluIEVTMjAxNy5cbiAgICAgIFRoZXNlIGJsb2NrcyBhcmUgbm90IGludGVyY2VwdGVkIGJ5IHpvbmUuanMgYW5kIHdpbGwgbm90IHRyaWdnZXJpbmcgY2hhbmdlIGRldGVjdGlvbi5cbiAgICAgIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvem9uZS5qcy9wdWxsLzExNDAgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gICAgYCk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG1vZGU6IHNjcmlwdHNPcHRpbWl6YXRpb24gfHwgc3R5bGVzT3B0aW1pemF0aW9uXG4gICAgICA/ICdwcm9kdWN0aW9uJ1xuICAgICAgOiAnZGV2ZWxvcG1lbnQnLFxuICAgIGRldnRvb2w6IGZhbHNlLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICBtb2R1bGVzOiBbXG4gICAgICAgIHdjby50c0NvbmZpZy5vcHRpb25zLmJhc2VVcmwgfHwgcHJvamVjdFJvb3QsXG4gICAgICAgICdub2RlX21vZHVsZXMnLFxuICAgICAgXSxcbiAgICAgIGFsaWFzLFxuICAgIH0sXG4gICAgcmVzb2x2ZUxvYWRlcjoge1xuICAgICAgbW9kdWxlczogbG9hZGVyTm9kZU1vZHVsZXMsXG4gICAgfSxcbiAgICBjb250ZXh0OiBwcm9qZWN0Um9vdCxcbiAgICBlbnRyeTogZW50cnlQb2ludHMsXG4gICAgb3V0cHV0OiB7XG4gICAgICBmdXR1cmVFbWl0QXNzZXRzOiB0cnVlLFxuICAgICAgcGF0aDogcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoIGFzIHN0cmluZyksXG4gICAgICBwdWJsaWNQYXRoOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICB9LFxuICAgIHdhdGNoOiBidWlsZE9wdGlvbnMud2F0Y2gsXG4gICAgd2F0Y2hPcHRpb25zOiB7XG4gICAgICBwb2xsOiBidWlsZE9wdGlvbnMucG9sbCxcbiAgICB9LFxuICAgIHBlcmZvcm1hbmNlOiB7XG4gICAgICBoaW50czogZmFsc2UsXG4gICAgfSxcbiAgICBtb2R1bGU6IHtcbiAgICAgIHJ1bGVzOiBbXG4gICAgICAgIHsgdGVzdDogL1xcLmh0bWwkLywgbG9hZGVyOiAncmF3LWxvYWRlcicgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC4oZW90fHN2Z3xjdXJ8anBnfHBuZ3x3ZWJwfGdpZnxvdGZ8dHRmfHdvZmZ8d29mZjJ8YW5pKSQvLFxuICAgICAgICAgIGxvYWRlcjogJ2ZpbGUtbG9hZGVyJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmZpbGV9LltleHRdYCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgLy8gTWFyayBmaWxlcyBpbnNpZGUgYEBhbmd1bGFyL2NvcmVgIGFzIHVzaW5nIFN5c3RlbUpTIHN0eWxlIGR5bmFtaWMgaW1wb3J0cy5cbiAgICAgICAgICAvLyBSZW1vdmluZyB0aGlzIHdpbGwgY2F1c2UgZGVwcmVjYXRpb24gd2FybmluZ3MgdG8gYXBwZWFyLlxuICAgICAgICAgIHRlc3Q6IC9bXFwvXFxcXF1AYW5ndWxhcltcXC9cXFxcXWNvcmVbXFwvXFxcXF0uK1xcLmpzJC8sXG4gICAgICAgICAgcGFyc2VyOiB7IHN5c3RlbTogdHJ1ZSB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLmpzJC8sXG4gICAgICAgICAgLi4uYnVpbGRPcHRpbWl6ZXJVc2VSdWxlLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGVzdDogL1xcLmpzJC8sXG4gICAgICAgICAgZXhjbHVkZTogLyhuZ2ZhY3Rvcnl8bmdzdHlsZSkuanMkLyxcbiAgICAgICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgICAgICAuLi5zb3VyY2VNYXBVc2VSdWxlLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgbm9FbWl0T25FcnJvcnM6IHRydWUsXG4gICAgICBtaW5pbWl6ZXI6IFtcbiAgICAgICAgbmV3IEhhc2hlZE1vZHVsZUlkc1BsdWdpbigpLFxuICAgICAgICAvLyBUT0RPOiBjaGVjayB3aXRoIE1pa2Ugd2hhdCB0aGlzIGZlYXR1cmUgbmVlZHMuXG4gICAgICAgIG5ldyBCdW5kbGVCdWRnZXRQbHVnaW4oeyBidWRnZXRzOiBidWlsZE9wdGlvbnMuYnVkZ2V0cyB9KSxcbiAgICAgICAgLi4uZXh0cmFNaW5pbWl6ZXJzLFxuICAgICAgXSxcbiAgICB9LFxuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2lucyxcbiAgfTtcbn1cbiJdfQ==