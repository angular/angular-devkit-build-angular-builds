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
    if (buildOptions.profile || process.env['NG_BUILD_PROFILING']) {
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
            // to remove dev code, and ngI18nClosureMode to remove Closure compiler i18n code
            compress: (buildOptions.platform == 'server' ? {
                global_defs: {
                    ngDevMode: false,
                    ngI18nClosureMode: false,
                },
            } : {
                pure_getters: buildOptions.buildOptimizer,
                // PURE comments work best with 3 passes.
                // See https://github.com/webpack/webpack/issues/2899#issuecomment-317425926.
                passes: buildOptions.buildOptimizer ? 3 : 1,
                global_defs: {
                    ngDevMode: false,
                    ngI18nClosureMode: false,
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
        profile: buildOptions.statsJson,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILCtDQUE0QztBQUM1Qyx5REFBeUQ7QUFDekQsNkJBQTZCO0FBQzdCLHFDQUE4RTtBQUU5RSwrREFBaUU7QUFDakUsbUZBQThFO0FBQzlFLGlGQUE0RTtBQUM1RSxxREFBcUU7QUFDckUsbUZBQThFO0FBRTlFLG1DQUF5RTtBQUV6RSxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUM3RCxNQUFNLHdCQUF3QixHQUFHLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBQ3ZFLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO0FBQ3RELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBR3BELGtDQUFrQztBQUNsQyxNQUFNLENBQUMsR0FBUSxPQUFPLE1BQU0sS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQzlDLFFBQUEsb0JBQW9CLEdBQVcsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0lBQzdELENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLG9FQUFvRSxDQUFDO0lBQ3ZGLENBQUMsQ0FBQyxnREFBZ0QsQ0FBQztBQUVyRCwyQ0FBMkM7QUFDM0MsU0FBZ0IsZUFBZSxDQUFDLEdBQXlCO0lBQ3ZELE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxHQUFHLEdBQUcsQ0FBQztJQUNoRCxNQUFNLEVBQUUsTUFBTSxFQUFFLGtCQUFrQixFQUFFLE9BQU8sRUFBRSxtQkFBbUIsRUFB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QUFJLEVBQUUsT0FBTyxFQUNiLE9BQU8sRUFBRSx5QkFBeUIsRUFDbEMsT0FBTyxFQUFFLEtBQUssSUFDWCxnQkFBZ0I7YUFFdEI7U0FDRjtRQUNELFlBQVksRUFBRTtZQUNaLGNBQWMsRUFBRSxJQUFJO1lBQ3BCLFNBQVMsRUFBRTtnQkFDVCxJQUFJLCtCQUFxQixFQUFFO2dCQUMzQixpREFBaUQ7Z0JBQ2pELElBQUksa0NBQWtCLENBQUMsRUFBRSxPQUFPLEVBQUUsWUFBWSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUN6RCxHQUFHLGVBQWU7YUFDbkI7U0FDRjtRQUNELE9BQU8sRUFBRSxZQUFZO0tBQ3RCLENBQUM7QUFDSixDQUFDO0FBNVRELDBDQTRUQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IHRhZ3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBDb3B5V2VicGFja1BsdWdpbiBmcm9tICdjb3B5LXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uLCBIYXNoZWRNb2R1bGVJZHNQbHVnaW4sIE91dHB1dCwgZGVidWcgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IEFzc2V0UGF0dGVybkNsYXNzIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgQnVuZGxlQnVkZ2V0UGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9idW5kbGUtYnVkZ2V0JztcbmltcG9ydCB7IENsZWFuQ3NzV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvY2xlYW5jc3Mtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgU2NyaXB0c1dlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL3NjcmlwdHMtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgZmluZEFsbE5vZGVNb2R1bGVzLCBmaW5kVXAgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvZmluZC11cCc7XG5pbXBvcnQgeyByZXF1aXJlUHJvamVjdE1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9yZXF1aXJlLXByb2plY3QtbW9kdWxlJztcbmltcG9ydCB7IEJ1aWxkT3B0aW9ucywgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IGdldE91dHB1dEhhc2hGb3JtYXQsIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMgfSBmcm9tICcuL3V0aWxzJztcblxuY29uc3QgUHJvZ3Jlc3NQbHVnaW4gPSByZXF1aXJlKCd3ZWJwYWNrL2xpYi9Qcm9ncmVzc1BsdWdpbicpO1xuY29uc3QgQ2lyY3VsYXJEZXBlbmRlbmN5UGx1Z2luID0gcmVxdWlyZSgnY2lyY3VsYXItZGVwZW5kZW5jeS1wbHVnaW4nKTtcbmNvbnN0IFRlcnNlclBsdWdpbiA9IHJlcXVpcmUoJ3RlcnNlci13ZWJwYWNrLXBsdWdpbicpO1xuY29uc3QgU3RhdHNQbHVnaW4gPSByZXF1aXJlKCdzdGF0cy13ZWJwYWNrLXBsdWdpbicpO1xuXG5cbi8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbmNvbnN0IGc6IGFueSA9IHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsIDoge307XG5leHBvcnQgY29uc3QgYnVpbGRPcHRpbWl6ZXJMb2FkZXI6IHN0cmluZyA9IGdbJ19EZXZLaXRJc0xvY2FsJ11cbiAgPyByZXF1aXJlLnJlc29sdmUoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXIvc3JjL2J1aWxkLW9wdGltaXplci93ZWJwYWNrLWxvYWRlcicpXG4gIDogJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXIvd2VicGFjay1sb2FkZXInO1xuXG4vLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYmlnLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q29tbW9uQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpOiBDb25maWd1cmF0aW9uIHtcbiAgY29uc3QgeyByb290LCBwcm9qZWN0Um9vdCwgYnVpbGRPcHRpb25zIH0gPSB3Y287XG4gIGNvbnN0IHsgc3R5bGVzOiBzdHlsZXNPcHRpbWl6YXRpb24sIHNjcmlwdHM6IHNjcmlwdHNPcHRpbWl6YXRpb24gfSA9IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb247XG4gIGNvbnN0IHtcbiAgICBzdHlsZXM6IHN0eWxlc1NvdXJjZU1hcCxcbiAgICBzY3JpcHRzOiBzY3JpcHRzU291cmNlTWFwLFxuICAgIHZlbmRvcjogdmVuZG9yU291cmNlTWFwLFxuICB9ID0gYnVpbGRPcHRpb25zLnNvdXJjZU1hcDtcblxuICBjb25zdCBub2RlTW9kdWxlcyA9IGZpbmRVcCgnbm9kZV9tb2R1bGVzJywgcHJvamVjdFJvb3QpO1xuICBpZiAoIW5vZGVNb2R1bGVzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgbG9jYXRlIG5vZGVfbW9kdWxlcyBkaXJlY3RvcnkuJyk7XG4gIH1cblxuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gIGNvbnN0IGV4dHJhUGx1Z2luczogYW55W10gPSBbXTtcbiAgY29uc3QgZW50cnlQb2ludHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nW10gfSA9IHt9O1xuXG4gIGlmIChidWlsZE9wdGlvbnMubWFpbikge1xuICAgIGVudHJ5UG9pbnRzWydtYWluJ10gPSBbcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5tYWluKV07XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmVzNUJyb3dzZXJTdXBwb3J0KSB7XG4gICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscy5lczUnXSA9IFtwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnZXMyMDE1LXBvbHlmaWxscy5qcycpXTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMucG9seWZpbGxzKSB7XG4gICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gW3BhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMucG9seWZpbGxzKV07XG4gIH1cblxuICBpZiAoIWJ1aWxkT3B0aW9ucy5hb3QpIHtcbiAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10gPSBbXG4gICAgICAuLi4oZW50cnlQb2ludHNbJ3BvbHlmaWxscyddIHx8IFtdKSxcbiAgICAgIHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICdqaXQtcG9seWZpbGxzLmpzJyksXG4gICAgXTtcblxuICAgIGlmIChidWlsZE9wdGlvbnMuZXM1QnJvd3NlclN1cHBvcnQpIHtcbiAgICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMuZXM1J10gPSBbXG4gICAgICAgIC4uLmVudHJ5UG9pbnRzWydwb2x5ZmlsbHMuZXM1J10sXG4gICAgICAgIHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICdlczIwMTUtaml0LXBvbHlmaWxscy5qcycpLFxuICAgICAgXTtcbiAgICB9XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnByb2ZpbGUgfHwgcHJvY2Vzcy5lbnZbJ05HX0JVSUxEX1BST0ZJTElORyddKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IGRlYnVnLlByb2ZpbGluZ1BsdWdpbih7XG4gICAgICBvdXRwdXRQYXRoOiBwYXRoLnJlc29sdmUocm9vdCwgJ2Nocm9tZS1wcm9maWxlci1ldmVudHMuanNvbicpLFxuICAgIH0pKTtcbiAgfVxuXG4gIC8vIGRldGVybWluZSBoYXNoaW5nIGZvcm1hdFxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyB8fCAnbm9uZScpO1xuXG4gIC8vIHByb2Nlc3MgZ2xvYmFsIHNjcmlwdHNcbiAgaWYgKGJ1aWxkT3B0aW9ucy5zY3JpcHRzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lID0gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhidWlsZE9wdGlvbnMuc2NyaXB0cywgJ3NjcmlwdHMnKVxuICAgICAgLnJlZHVjZSgocHJldjogeyBidW5kbGVOYW1lOiBzdHJpbmcsIHBhdGhzOiBzdHJpbmdbXSwgbGF6eTogYm9vbGVhbiB9W10sIGN1cnIpID0+IHtcbiAgICAgICAgY29uc3QgYnVuZGxlTmFtZSA9IGN1cnIuYnVuZGxlTmFtZTtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWRQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIGN1cnIuaW5wdXQpO1xuICAgICAgICBjb25zdCBleGlzdGluZ0VudHJ5ID0gcHJldi5maW5kKChlbCkgPT4gZWwuYnVuZGxlTmFtZSA9PT0gYnVuZGxlTmFtZSk7XG4gICAgICAgIGlmIChleGlzdGluZ0VudHJ5KSB7XG4gICAgICAgICAgaWYgKGV4aXN0aW5nRW50cnkubGF6eSAmJiAhY3Vyci5sYXp5KSB7XG4gICAgICAgICAgICAvLyBBbGwgZW50cmllcyBoYXZlIHRvIGJlIGxhenkgZm9yIHRoZSBidW5kbGUgdG8gYmUgbGF6eS5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlICR7Y3Vyci5idW5kbGVOYW1lfSBidW5kbGUgaXMgbWl4aW5nIGxhenkgYW5kIG5vbi1sYXp5IHNjcmlwdHMuYCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZXhpc3RpbmdFbnRyeS5wYXRocy5wdXNoKHJlc29sdmVkUGF0aCk7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwcmV2LnB1c2goe1xuICAgICAgICAgICAgYnVuZGxlTmFtZSxcbiAgICAgICAgICAgIHBhdGhzOiBbcmVzb2x2ZWRQYXRoXSxcbiAgICAgICAgICAgIGxhenk6IGN1cnIubGF6eSB8fCBmYWxzZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcmV2O1xuICAgICAgfSwgW10pO1xuXG5cbiAgICAvLyBBZGQgYSBuZXcgYXNzZXQgZm9yIGVhY2ggZW50cnkuXG4gICAgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZS5mb3JFYWNoKChzY3JpcHQpID0+IHtcbiAgICAgIC8vIExhenkgc2NyaXB0cyBkb24ndCBnZXQgYSBoYXNoLCBvdGhlcndpc2UgdGhleSBjYW4ndCBiZSBsb2FkZWQgYnkgbmFtZS5cbiAgICAgIGNvbnN0IGhhc2ggPSBzY3JpcHQubGF6eSA/ICcnIDogaGFzaEZvcm1hdC5zY3JpcHQ7XG4gICAgICBjb25zdCBidW5kbGVOYW1lID0gc2NyaXB0LmJ1bmRsZU5hbWU7XG5cbiAgICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBTY3JpcHRzV2VicGFja1BsdWdpbih7XG4gICAgICAgIG5hbWU6IGJ1bmRsZU5hbWUsXG4gICAgICAgIHNvdXJjZU1hcDogc2NyaXB0c1NvdXJjZU1hcCxcbiAgICAgICAgZmlsZW5hbWU6IGAke3BhdGguYmFzZW5hbWUoYnVuZGxlTmFtZSl9JHtoYXNofS5qc2AsXG4gICAgICAgIHNjcmlwdHM6IHNjcmlwdC5wYXRocyxcbiAgICAgICAgYmFzZVBhdGg6IHByb2plY3RSb290LFxuICAgICAgfSkpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gcHJvY2VzcyBhc3NldCBlbnRyaWVzXG4gIGlmIChidWlsZE9wdGlvbnMuYXNzZXRzKSB7XG4gICAgY29uc3QgY29weVdlYnBhY2tQbHVnaW5QYXR0ZXJucyA9IGJ1aWxkT3B0aW9ucy5hc3NldHMubWFwKChhc3NldDogQXNzZXRQYXR0ZXJuQ2xhc3MpID0+IHtcblxuICAgICAgLy8gUmVzb2x2ZSBpbnB1dCBwYXRocyByZWxhdGl2ZSB0byB3b3Jrc3BhY2Ugcm9vdCBhbmQgYWRkIHNsYXNoIGF0IHRoZSBlbmQuXG4gICAgICBhc3NldC5pbnB1dCA9IHBhdGgucmVzb2x2ZShyb290LCBhc3NldC5pbnB1dCkucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgICAgYXNzZXQuaW5wdXQgPSBhc3NldC5pbnB1dC5lbmRzV2l0aCgnLycpID8gYXNzZXQuaW5wdXQgOiBhc3NldC5pbnB1dCArICcvJztcbiAgICAgIGFzc2V0Lm91dHB1dCA9IGFzc2V0Lm91dHB1dC5lbmRzV2l0aCgnLycpID8gYXNzZXQub3V0cHV0IDogYXNzZXQub3V0cHV0ICsgJy8nO1xuXG4gICAgICBpZiAoYXNzZXQub3V0cHV0LnN0YXJ0c1dpdGgoJy4uJykpIHtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9ICdBbiBhc3NldCBjYW5ub3QgYmUgd3JpdHRlbiB0byBhIGxvY2F0aW9uIG91dHNpZGUgb2YgdGhlIG91dHB1dCBwYXRoLic7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY29udGV4dDogYXNzZXQuaW5wdXQsXG4gICAgICAgIC8vIE5vdyB3ZSByZW1vdmUgc3RhcnRpbmcgc2xhc2ggdG8gbWFrZSBXZWJwYWNrIHBsYWNlIGl0IGZyb20gdGhlIG91dHB1dCByb290LlxuICAgICAgICB0bzogYXNzZXQub3V0cHV0LnJlcGxhY2UoL15cXC8vLCAnJyksXG4gICAgICAgIGlnbm9yZTogYXNzZXQuaWdub3JlLFxuICAgICAgICBmcm9tOiB7XG4gICAgICAgICAgZ2xvYjogYXNzZXQuZ2xvYixcbiAgICAgICAgICBkb3Q6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgY29uc3QgY29weVdlYnBhY2tQbHVnaW5PcHRpb25zID0geyBpZ25vcmU6IFsnLmdpdGtlZXAnLCAnKiovLkRTX1N0b3JlJywgJyoqL1RodW1icy5kYiddIH07XG5cbiAgICBjb25zdCBjb3B5V2VicGFja1BsdWdpbkluc3RhbmNlID0gbmV3IENvcHlXZWJwYWNrUGx1Z2luKGNvcHlXZWJwYWNrUGx1Z2luUGF0dGVybnMsXG4gICAgICBjb3B5V2VicGFja1BsdWdpbk9wdGlvbnMpO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5wcm9ncmVzcykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBQcm9ncmVzc1BsdWdpbih7IHByb2ZpbGU6IGJ1aWxkT3B0aW9ucy52ZXJib3NlIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc2hvd0NpcmN1bGFyRGVwZW5kZW5jaWVzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IENpcmN1bGFyRGVwZW5kZW5jeVBsdWdpbih7XG4gICAgICBleGNsdWRlOiAvKFtcXFxcXFwvXW5vZGVfbW9kdWxlc1tcXFxcXFwvXSl8KG5nZmFjdG9yeVxcLmpzJCkvLFxuICAgIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3RhdHNKc29uKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN0YXRzUGx1Z2luKCdzdGF0cy5qc29uJywgJ3ZlcmJvc2UnKSk7XG4gIH1cblxuICBsZXQgc291cmNlTWFwVXNlUnVsZTtcbiAgaWYgKChzY3JpcHRzU291cmNlTWFwIHx8IHN0eWxlc1NvdXJjZU1hcCkgJiYgdmVuZG9yU291cmNlTWFwKSB7XG4gICAgc291cmNlTWFwVXNlUnVsZSA9IHtcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiAnc291cmNlLW1hcC1sb2FkZXInLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9O1xuICB9XG5cbiAgbGV0IGJ1aWxkT3B0aW1pemVyVXNlUnVsZTtcbiAgaWYgKGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcikge1xuICAgIGJ1aWxkT3B0aW1pemVyVXNlUnVsZSA9IHtcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiBidWlsZE9wdGltaXplckxvYWRlcixcbiAgICAgICAgICBvcHRpb25zOiB7IHNvdXJjZU1hcDogc2NyaXB0c1NvdXJjZU1hcCB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9O1xuICB9XG5cbiAgLy8gQWxsb3cgbG9hZGVycyB0byBiZSBpbiBhIG5vZGVfbW9kdWxlcyBuZXN0ZWQgaW5zaWRlIHRoZSBkZXZraXQvYnVpbGQtYW5ndWxhciBwYWNrYWdlLlxuICAvLyBUaGlzIGlzIGltcG9ydGFudCBpbiBjYXNlIGxvYWRlcnMgZG8gbm90IGdldCBob2lzdGVkLlxuICAvLyBJZiB0aGlzIGZpbGUgbW92ZXMgdG8gYW5vdGhlciBsb2NhdGlvbiwgYWx0ZXIgcG90ZW50aWFsTm9kZU1vZHVsZXMgYXMgd2VsbC5cbiAgY29uc3QgbG9hZGVyTm9kZU1vZHVsZXMgPSBmaW5kQWxsTm9kZU1vZHVsZXMoX19kaXJuYW1lLCBwcm9qZWN0Um9vdCk7XG4gIGxvYWRlck5vZGVNb2R1bGVzLnVuc2hpZnQoJ25vZGVfbW9kdWxlcycpO1xuXG4gIC8vIExvYWQgcnhqcyBwYXRoIGFsaWFzZXMuXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9ibG9iL21hc3Rlci9kb2MvbGV0dGFibGUtb3BlcmF0b3JzLm1kI2J1aWxkLWFuZC10cmVlc2hha2luZ1xuICBsZXQgYWxpYXMgPSB7fTtcbiAgdHJ5IHtcbiAgICBjb25zdCByeGpzUGF0aE1hcHBpbmdJbXBvcnQgPSB3Y28uc3VwcG9ydEVTMjAxNVxuICAgICAgPyAncnhqcy9fZXNtMjAxNS9wYXRoLW1hcHBpbmcnXG4gICAgICA6ICdyeGpzL19lc201L3BhdGgtbWFwcGluZyc7XG4gICAgY29uc3QgcnhQYXRocyA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKHByb2plY3RSb290LCByeGpzUGF0aE1hcHBpbmdJbXBvcnQpO1xuICAgIGFsaWFzID0gcnhQYXRocyhub2RlTW9kdWxlcyk7XG4gIH0gY2F0Y2ggeyB9XG5cbiAgY29uc3QgZXh0cmFNaW5pbWl6ZXJzID0gW107XG4gIGlmIChzdHlsZXNPcHRpbWl6YXRpb24pIHtcbiAgICBleHRyYU1pbmltaXplcnMucHVzaChcbiAgICAgIG5ldyBDbGVhbkNzc1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICBzb3VyY2VNYXA6IHN0eWxlc1NvdXJjZU1hcCxcbiAgICAgICAgLy8gY29tcG9uZW50IHN0eWxlcyByZXRhaW4gdGhlaXIgb3JpZ2luYWwgZmlsZSBuYW1lXG4gICAgICAgIHRlc3Q6IChmaWxlKSA9PiAvXFwuKD86Y3NzfHNjc3N8c2Fzc3xsZXNzfHN0eWwpJC8udGVzdChmaWxlKSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoc2NyaXB0c09wdGltaXphdGlvbikge1xuICAgIGNvbnN0IHRlcnNlck9wdGlvbnMgPSB7XG4gICAgICBlY21hOiB3Y28uc3VwcG9ydEVTMjAxNSA/IDYgOiA1LFxuICAgICAgd2FybmluZ3M6ICEhYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICBzYWZhcmkxMDogdHJ1ZSxcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBhc2NpaV9vbmx5OiB0cnVlLFxuICAgICAgICBjb21tZW50czogZmFsc2UsXG4gICAgICAgIHdlYmtpdDogdHJ1ZSxcbiAgICAgIH0sXG5cbiAgICAgIC8vIE9uIHNlcnZlciwgd2UgZG9uJ3Qgd2FudCB0byBjb21wcmVzcyBhbnl0aGluZy4gV2Ugc3RpbGwgc2V0IHRoZSBuZ0Rldk1vZGUgPSBmYWxzZSBmb3IgaXRcbiAgICAgIC8vIHRvIHJlbW92ZSBkZXYgY29kZSwgYW5kIG5nSTE4bkNsb3N1cmVNb2RlIHRvIHJlbW92ZSBDbG9zdXJlIGNvbXBpbGVyIGkxOG4gY29kZVxuICAgICAgY29tcHJlc3M6IChidWlsZE9wdGlvbnMucGxhdGZvcm0gPT0gJ3NlcnZlcicgPyB7XG4gICAgICAgIGdsb2JhbF9kZWZzOiB7XG4gICAgICAgICAgbmdEZXZNb2RlOiBmYWxzZSxcbiAgICAgICAgICBuZ0kxOG5DbG9zdXJlTW9kZTogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9IDoge1xuICAgICAgICAgIHB1cmVfZ2V0dGVyczogYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyLFxuICAgICAgICAgIC8vIFBVUkUgY29tbWVudHMgd29yayBiZXN0IHdpdGggMyBwYXNzZXMuXG4gICAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrL3dlYnBhY2svaXNzdWVzLzI4OTkjaXNzdWVjb21tZW50LTMxNzQyNTkyNi5cbiAgICAgICAgICBwYXNzZXM6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplciA/IDMgOiAxLFxuICAgICAgICAgIGdsb2JhbF9kZWZzOiB7XG4gICAgICAgICAgICBuZ0Rldk1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgbmdJMThuQ2xvc3VyZU1vZGU6IGZhbHNlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgLy8gV2UgYWxzbyB3YW50IHRvIGF2b2lkIG1hbmdsaW5nIG9uIHNlcnZlci5cbiAgICAgIC4uLihidWlsZE9wdGlvbnMucGxhdGZvcm0gPT0gJ3NlcnZlcicgPyB7IG1hbmdsZTogZmFsc2UgfSA6IHt9KSxcbiAgICB9O1xuXG4gICAgZXh0cmFNaW5pbWl6ZXJzLnB1c2goXG4gICAgICBuZXcgVGVyc2VyUGx1Z2luKHtcbiAgICAgICAgc291cmNlTWFwOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgICBwYXJhbGxlbDogdHJ1ZSxcbiAgICAgICAgY2FjaGU6IHRydWUsXG4gICAgICAgIHRlcnNlck9wdGlvbnMsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHdjby50c0NvbmZpZy5vcHRpb25zLnRhcmdldCA9PT0gNCkge1xuICAgIHdjby5sb2dnZXIud2Fybih0YWdzLnN0cmlwSW5kZW50YFxuICAgICAgV0FSTklORzogWm9uZS5qcyBkb2VzIG5vdCBzdXBwb3J0IG5hdGl2ZSBhc3luYy9hd2FpdCBpbiBFUzIwMTcuXG4gICAgICBUaGVzZSBibG9ja3MgYXJlIG5vdCBpbnRlcmNlcHRlZCBieSB6b25lLmpzIGFuZCB3aWxsIG5vdCB0cmlnZ2VyaW5nIGNoYW5nZSBkZXRlY3Rpb24uXG4gICAgICBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL3pvbmUuanMvcHVsbC8xMTQwIGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICAgIGApO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBtb2RlOiBzY3JpcHRzT3B0aW1pemF0aW9uIHx8IHN0eWxlc09wdGltaXphdGlvblxuICAgICAgPyAncHJvZHVjdGlvbidcbiAgICAgIDogJ2RldmVsb3BtZW50JyxcbiAgICBkZXZ0b29sOiBmYWxzZSxcbiAgICBwcm9maWxlOiBidWlsZE9wdGlvbnMuc3RhdHNKc29uLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICAgIHN5bWxpbmtzOiAhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICBtb2R1bGVzOiBbXG4gICAgICAgIHdjby50c0NvbmZpZy5vcHRpb25zLmJhc2VVcmwgfHwgcHJvamVjdFJvb3QsXG4gICAgICAgICdub2RlX21vZHVsZXMnLFxuICAgICAgXSxcbiAgICAgIGFsaWFzLFxuICAgIH0sXG4gICAgcmVzb2x2ZUxvYWRlcjoge1xuICAgICAgbW9kdWxlczogbG9hZGVyTm9kZU1vZHVsZXMsXG4gICAgfSxcbiAgICBjb250ZXh0OiBwcm9qZWN0Um9vdCxcbiAgICBlbnRyeTogZW50cnlQb2ludHMsXG4gICAgb3V0cHV0OiB7XG4gICAgICBmdXR1cmVFbWl0QXNzZXRzOiB0cnVlLFxuICAgICAgcGF0aDogcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoIGFzIHN0cmluZyksXG4gICAgICBwdWJsaWNQYXRoOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuY2h1bmt9LmpzYCxcbiAgICAgIC8vIGNhc3QgcmVxdWlyZWQgdW50aWwgdHlwaW5ncyBpbmNsdWRlIGBmdXR1cmVFbWl0QXNzZXRzYCBwcm9wZXJ0eVxuICAgIH0gYXMgT3V0cHV0LFxuICAgIHdhdGNoOiBidWlsZE9wdGlvbnMud2F0Y2gsXG4gICAgd2F0Y2hPcHRpb25zOiB7XG4gICAgICBwb2xsOiBidWlsZE9wdGlvbnMucG9sbCxcbiAgICB9LFxuICAgIHBlcmZvcm1hbmNlOiB7XG4gICAgICBoaW50czogZmFsc2UsXG4gICAgfSxcbiAgICBtb2R1bGU6IHtcbiAgICAgIHJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuKGVvdHxzdmd8Y3VyfGpwZ3xwbmd8d2VicHxnaWZ8b3RmfHR0Znx3b2ZmfHdvZmYyfGFuaSkkLyxcbiAgICAgICAgICBsb2FkZXI6ICdmaWxlLWxvYWRlcicsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5maWxlfS5bZXh0XWAsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIC8vIE1hcmsgZmlsZXMgaW5zaWRlIGBAYW5ndWxhci9jb3JlYCBhcyB1c2luZyBTeXN0ZW1KUyBzdHlsZSBkeW5hbWljIGltcG9ydHMuXG4gICAgICAgICAgLy8gUmVtb3ZpbmcgdGhpcyB3aWxsIGNhdXNlIGRlcHJlY2F0aW9uIHdhcm5pbmdzIHRvIGFwcGVhci5cbiAgICAgICAgICB0ZXN0OiAvW1xcL1xcXFxdQGFuZ3VsYXJbXFwvXFxcXF1jb3JlW1xcL1xcXFxdLitcXC5qcyQvLFxuICAgICAgICAgIHBhcnNlcjogeyBzeXN0ZW06IHRydWUgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5qcyQvLFxuICAgICAgICAgIC4uLmJ1aWxkT3B0aW1pemVyVXNlUnVsZSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5qcyQvLFxuICAgICAgICAgIGV4Y2x1ZGU6IC8obmdmYWN0b3J5fG5nc3R5bGUpLmpzJC8sXG4gICAgICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICAgICAgLi4uc291cmNlTWFwVXNlUnVsZSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG5vRW1pdE9uRXJyb3JzOiB0cnVlLFxuICAgICAgbWluaW1pemVyOiBbXG4gICAgICAgIG5ldyBIYXNoZWRNb2R1bGVJZHNQbHVnaW4oKSxcbiAgICAgICAgLy8gVE9ETzogY2hlY2sgd2l0aCBNaWtlIHdoYXQgdGhpcyBmZWF0dXJlIG5lZWRzLlxuICAgICAgICBuZXcgQnVuZGxlQnVkZ2V0UGx1Z2luKHsgYnVkZ2V0czogYnVpbGRPcHRpb25zLmJ1ZGdldHMgfSksXG4gICAgICAgIC4uLmV4dHJhTWluaW1pemVycyxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gIH07XG59XG4iXX0=