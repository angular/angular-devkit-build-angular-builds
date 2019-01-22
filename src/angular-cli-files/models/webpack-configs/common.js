"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require("path");
const webpack_1 = require("webpack");
const bundle_budget_1 = require("../../plugins/bundle-budget");
const cleancss_webpack_plugin_1 = require("../../plugins/cleancss-webpack-plugin");
const scripts_webpack_plugin_1 = require("../../plugins/scripts-webpack-plugin");
const find_up_1 = require("../../utilities/find-up");
const is_directory_1 = require("../../utilities/is-directory");
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
        entryPoints['es2015-polyfills'] = [path.join(__dirname, '..', 'es2015-polyfills.js')];
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
            entryPoints['es2015-polyfills'] = [
                ...entryPoints['es2015-polyfills'],
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
                    lazy: curr.lazy,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILHlEQUF5RDtBQUN6RCw2QkFBNkI7QUFDN0IscUNBQXVEO0FBRXZELCtEQUFpRTtBQUNqRSxtRkFBOEU7QUFDOUUsaUZBQTRFO0FBQzVFLHFEQUFpRDtBQUNqRCwrREFBMkQ7QUFDM0QsbUZBQThFO0FBRTlFLG1DQUF5RTtBQUV6RSxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUM3RCxNQUFNLHdCQUF3QixHQUFHLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBQ3ZFLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO0FBQ3RELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBR3BELGtDQUFrQztBQUNsQyxNQUFNLENBQUMsR0FBUSxPQUFPLE1BQU0sS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQzlDLFFBQUEsb0JBQW9CLEdBQVcsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0lBQzdELENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLG9FQUFvRSxDQUFDO0lBQ3ZGLENBQUMsQ0FBQyxnREFBZ0QsQ0FBQztBQUVyRCwyQ0FBMkM7QUFDM0MsU0FBZ0IsZUFBZSxDQUFDLEdBQXlCO0lBQ3ZELE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxHQUFHLEdBQUcsQ0FBQztJQUNoRCxNQUFNLEVBQUUsTUFBTSxFQUFFLGtCQUFrQixFQUFFLE9BQU8sRUFBRSxtQkFBbUIsRUFB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LEVBQUUsS0FBSyxJQUNYLGdCQUFnQjthQUV0QjtTQUNGO1FBQ0QsWUFBWSxFQUFFO1lBQ1osY0FBYyxFQUFFLElBQUk7WUFDcEIsU0FBUyxFQUFFO2dCQUNULElBQUksK0JBQXFCLEVBQUU7Z0JBQzNCLGlEQUFpRDtnQkFDakQsSUFBSSxrQ0FBa0IsQ0FBQyxFQUFFLE9BQU8sRUFBRSxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3pELEdBQUcsZUFBZTthQUNuQjtTQUNGO1FBQ0QsT0FBTyxFQUFFLFlBQVk7S0FDdEIsQ0FBQztBQUNKLENBQUM7QUF4VEQsMENBd1RDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgQ29weVdlYnBhY2tQbHVnaW4gZnJvbSAnY29weS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgSGFzaGVkTW9kdWxlSWRzUGx1Z2luLCBkZWJ1ZyB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgQXNzZXRQYXR0ZXJuT2JqZWN0IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgQnVuZGxlQnVkZ2V0UGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9idW5kbGUtYnVkZ2V0JztcbmltcG9ydCB7IENsZWFuQ3NzV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvY2xlYW5jc3Mtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgU2NyaXB0c1dlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL3NjcmlwdHMtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgZmluZFVwIH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL2ZpbmQtdXAnO1xuaW1wb3J0IHsgaXNEaXJlY3RvcnkgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvaXMtZGlyZWN0b3J5JztcbmltcG9ydCB7IHJlcXVpcmVQcm9qZWN0TW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL3JlcXVpcmUtcHJvamVjdC1tb2R1bGUnO1xuaW1wb3J0IHsgQnVpbGRPcHRpb25zLCBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgZ2V0T3V0cHV0SGFzaEZvcm1hdCwgbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyB9IGZyb20gJy4vdXRpbHMnO1xuXG5jb25zdCBQcm9ncmVzc1BsdWdpbiA9IHJlcXVpcmUoJ3dlYnBhY2svbGliL1Byb2dyZXNzUGx1Z2luJyk7XG5jb25zdCBDaXJjdWxhckRlcGVuZGVuY3lQbHVnaW4gPSByZXF1aXJlKCdjaXJjdWxhci1kZXBlbmRlbmN5LXBsdWdpbicpO1xuY29uc3QgVGVyc2VyUGx1Z2luID0gcmVxdWlyZSgndGVyc2VyLXdlYnBhY2stcGx1Z2luJyk7XG5jb25zdCBTdGF0c1BsdWdpbiA9IHJlcXVpcmUoJ3N0YXRzLXdlYnBhY2stcGx1Z2luJyk7XG5cblxuLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuY29uc3QgZzogYW55ID0gdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWwgOiB7fTtcbmV4cG9ydCBjb25zdCBidWlsZE9wdGltaXplckxvYWRlcjogc3RyaW5nID0gZ1snX0RldktpdElzTG9jYWwnXVxuICA/IHJlcXVpcmUucmVzb2x2ZSgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLW9wdGltaXplci9zcmMvYnVpbGQtb3B0aW1pemVyL3dlYnBhY2stbG9hZGVyJylcbiAgOiAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLW9wdGltaXplci93ZWJwYWNrLWxvYWRlcic7XG5cbi8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1iaWctZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBnZXRDb21tb25Db25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucykge1xuICBjb25zdCB7IHJvb3QsIHByb2plY3RSb290LCBidWlsZE9wdGlvbnMgfSA9IHdjbztcbiAgY29uc3QgeyBzdHlsZXM6IHN0eWxlc09wdGltaXphdGlvbiwgc2NyaXB0czogc2NyaXB0c09wdGltaXphdGlvbiB9ID0gYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbjtcbiAgY29uc3Qge1xuICAgIHN0eWxlczogc3R5bGVzU291cmNlTWFwLFxuICAgIHNjcmlwdHM6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgdmVuZG9yOiB2ZW5kb3JTb3VyY2VNYXAsXG4gIH0gPSBidWlsZE9wdGlvbnMuc291cmNlTWFwO1xuXG4gIGNvbnN0IG5vZGVNb2R1bGVzID0gZmluZFVwKCdub2RlX21vZHVsZXMnLCBwcm9qZWN0Um9vdCk7XG4gIGlmICghbm9kZU1vZHVsZXMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBsb2NhdGUgbm9kZV9tb2R1bGVzIGRpcmVjdG9yeS4nKTtcbiAgfVxuXG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiBhbnlbXSA9IFtdO1xuICBjb25zdCBlbnRyeVBvaW50czogeyBba2V5OiBzdHJpbmddOiBzdHJpbmdbXSB9ID0ge307XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5tYWluKSB7XG4gICAgZW50cnlQb2ludHNbJ21haW4nXSA9IFtwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLm1haW4pXTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuZXM1QnJvd3NlclN1cHBvcnQpIHtcbiAgICBlbnRyeVBvaW50c1snZXMyMDE1LXBvbHlmaWxscyddID0gW3BhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICdlczIwMTUtcG9seWZpbGxzLmpzJyldO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5wb2x5ZmlsbHMpIHtcbiAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10gPSBbcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5wb2x5ZmlsbHMpXTtcbiAgfVxuXG4gIGlmICghYnVpbGRPcHRpb25zLmFvdCkge1xuICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSA9IFtcbiAgICAgIC4uLihlbnRyeVBvaW50c1sncG9seWZpbGxzJ10gfHwgW10pLFxuICAgICAgcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJ2ppdC1wb2x5ZmlsbHMuanMnKSxcbiAgICBdO1xuXG4gICAgaWYgKGJ1aWxkT3B0aW9ucy5lczVCcm93c2VyU3VwcG9ydCkge1xuICAgICAgZW50cnlQb2ludHNbJ2VzMjAxNS1wb2x5ZmlsbHMnXSA9IFtcbiAgICAgICAgLi4uZW50cnlQb2ludHNbJ2VzMjAxNS1wb2x5ZmlsbHMnXSxcbiAgICAgICAgcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJ2VzMjAxNS1qaXQtcG9seWZpbGxzLmpzJyksXG4gICAgICBdO1xuICAgIH1cbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMucHJvZmlsZSkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBkZWJ1Zy5Qcm9maWxpbmdQbHVnaW4oe1xuICAgICAgb3V0cHV0UGF0aDogcGF0aC5yZXNvbHZlKHJvb3QsICdjaHJvbWUtcHJvZmlsZXItZXZlbnRzLmpzb24nKSxcbiAgICB9KSk7XG4gIH1cblxuICAvLyBkZXRlcm1pbmUgaGFzaGluZyBmb3JtYXRcbiAgY29uc3QgaGFzaEZvcm1hdCA9IGdldE91dHB1dEhhc2hGb3JtYXQoYnVpbGRPcHRpb25zLm91dHB1dEhhc2hpbmcgfHwgJ25vbmUnKTtcblxuICAvLyBwcm9jZXNzIGdsb2JhbCBzY3JpcHRzXG4gIGlmIChidWlsZE9wdGlvbnMuc2NyaXB0cy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZSA9IG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoYnVpbGRPcHRpb25zLnNjcmlwdHMsICdzY3JpcHRzJylcbiAgICAgIC5yZWR1Y2UoKHByZXY6IHsgYnVuZGxlTmFtZTogc3RyaW5nLCBwYXRoczogc3RyaW5nW10sIGxhenk6IGJvb2xlYW4gfVtdLCBjdXJyKSA9PiB7XG4gICAgICAgIGNvbnN0IGJ1bmRsZU5hbWUgPSBjdXJyLmJ1bmRsZU5hbWU7XG4gICAgICAgIGNvbnN0IHJlc29sdmVkUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBjdXJyLmlucHV0KTtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdFbnRyeSA9IHByZXYuZmluZCgoZWwpID0+IGVsLmJ1bmRsZU5hbWUgPT09IGJ1bmRsZU5hbWUpO1xuICAgICAgICBpZiAoZXhpc3RpbmdFbnRyeSkge1xuICAgICAgICAgIGlmIChleGlzdGluZ0VudHJ5LmxhenkgJiYgIWN1cnIubGF6eSkge1xuICAgICAgICAgICAgLy8gQWxsIGVudHJpZXMgaGF2ZSB0byBiZSBsYXp5IGZvciB0aGUgYnVuZGxlIHRvIGJlIGxhenkuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSAke2N1cnIuYnVuZGxlTmFtZX0gYnVuZGxlIGlzIG1peGluZyBsYXp5IGFuZCBub24tbGF6eSBzY3JpcHRzLmApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGV4aXN0aW5nRW50cnkucGF0aHMucHVzaChyZXNvbHZlZFBhdGgpO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJldi5wdXNoKHtcbiAgICAgICAgICAgIGJ1bmRsZU5hbWUsXG4gICAgICAgICAgICBwYXRoczogW3Jlc29sdmVkUGF0aF0sXG4gICAgICAgICAgICBsYXp5OiBjdXJyLmxhenksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcHJldjtcbiAgICAgIH0sIFtdKTtcblxuXG4gICAgLy8gQWRkIGEgbmV3IGFzc2V0IGZvciBlYWNoIGVudHJ5LlxuICAgIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUuZm9yRWFjaCgoc2NyaXB0KSA9PiB7XG4gICAgICAvLyBMYXp5IHNjcmlwdHMgZG9uJ3QgZ2V0IGEgaGFzaCwgb3RoZXJ3aXNlIHRoZXkgY2FuJ3QgYmUgbG9hZGVkIGJ5IG5hbWUuXG4gICAgICBjb25zdCBoYXNoID0gc2NyaXB0LmxhenkgPyAnJyA6IGhhc2hGb3JtYXQuc2NyaXB0O1xuICAgICAgY29uc3QgYnVuZGxlTmFtZSA9IHNjcmlwdC5idW5kbGVOYW1lO1xuXG4gICAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU2NyaXB0c1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICBuYW1lOiBidW5kbGVOYW1lLFxuICAgICAgICBzb3VyY2VNYXA6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICAgIGZpbGVuYW1lOiBgJHtwYXRoLmJhc2VuYW1lKGJ1bmRsZU5hbWUpfSR7aGFzaH0uanNgLFxuICAgICAgICBzY3JpcHRzOiBzY3JpcHQucGF0aHMsXG4gICAgICAgIGJhc2VQYXRoOiBwcm9qZWN0Um9vdCxcbiAgICAgIH0pKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgYXNzZXQgZW50cmllc1xuICBpZiAoYnVpbGRPcHRpb25zLmFzc2V0cykge1xuICAgIGNvbnN0IGNvcHlXZWJwYWNrUGx1Z2luUGF0dGVybnMgPSBidWlsZE9wdGlvbnMuYXNzZXRzLm1hcCgoYXNzZXQ6IEFzc2V0UGF0dGVybk9iamVjdCkgPT4ge1xuXG4gICAgICAvLyBSZXNvbHZlIGlucHV0IHBhdGhzIHJlbGF0aXZlIHRvIHdvcmtzcGFjZSByb290IGFuZCBhZGQgc2xhc2ggYXQgdGhlIGVuZC5cbiAgICAgIGFzc2V0LmlucHV0ID0gcGF0aC5yZXNvbHZlKHJvb3QsIGFzc2V0LmlucHV0KS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgICBhc3NldC5pbnB1dCA9IGFzc2V0LmlucHV0LmVuZHNXaXRoKCcvJykgPyBhc3NldC5pbnB1dCA6IGFzc2V0LmlucHV0ICsgJy8nO1xuICAgICAgYXNzZXQub3V0cHV0ID0gYXNzZXQub3V0cHV0LmVuZHNXaXRoKCcvJykgPyBhc3NldC5vdXRwdXQgOiBhc3NldC5vdXRwdXQgKyAnLyc7XG5cbiAgICAgIGlmIChhc3NldC5vdXRwdXQuc3RhcnRzV2l0aCgnLi4nKSkge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gJ0FuIGFzc2V0IGNhbm5vdCBiZSB3cml0dGVuIHRvIGEgbG9jYXRpb24gb3V0c2lkZSBvZiB0aGUgb3V0cHV0IHBhdGguJztcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBjb250ZXh0OiBhc3NldC5pbnB1dCxcbiAgICAgICAgLy8gTm93IHdlIHJlbW92ZSBzdGFydGluZyBzbGFzaCB0byBtYWtlIFdlYnBhY2sgcGxhY2UgaXQgZnJvbSB0aGUgb3V0cHV0IHJvb3QuXG4gICAgICAgIHRvOiBhc3NldC5vdXRwdXQucmVwbGFjZSgvXlxcLy8sICcnKSxcbiAgICAgICAgaWdub3JlOiBhc3NldC5pZ25vcmUsXG4gICAgICAgIGZyb206IHtcbiAgICAgICAgICBnbG9iOiBhc3NldC5nbG9iLFxuICAgICAgICAgIGRvdDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH07XG4gICAgfSk7XG5cbiAgICBjb25zdCBjb3B5V2VicGFja1BsdWdpbk9wdGlvbnMgPSB7IGlnbm9yZTogWycuZ2l0a2VlcCcsICcqKi8uRFNfU3RvcmUnLCAnKiovVGh1bWJzLmRiJ10gfTtcblxuICAgIGNvbnN0IGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UgPSBuZXcgQ29weVdlYnBhY2tQbHVnaW4oY29weVdlYnBhY2tQbHVnaW5QYXR0ZXJucyxcbiAgICAgIGNvcHlXZWJwYWNrUGx1Z2luT3B0aW9ucyk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goY29weVdlYnBhY2tQbHVnaW5JbnN0YW5jZSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnByb2dyZXNzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFByb2dyZXNzUGx1Z2luKHsgcHJvZmlsZTogYnVpbGRPcHRpb25zLnZlcmJvc2UgfSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zaG93Q2lyY3VsYXJEZXBlbmRlbmNpZXMpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgQ2lyY3VsYXJEZXBlbmRlbmN5UGx1Z2luKHtcbiAgICAgIGV4Y2x1ZGU6IC8oW1xcXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFxcXC9dKXwobmdmYWN0b3J5XFwuanMkKS8sXG4gICAgfSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdGF0c0pzb24pIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU3RhdHNQbHVnaW4oJ3N0YXRzLmpzb24nLCAndmVyYm9zZScpKTtcbiAgfVxuXG4gIGxldCBzb3VyY2VNYXBVc2VSdWxlO1xuICBpZiAoKHNjcmlwdHNTb3VyY2VNYXAgfHwgc3R5bGVzU291cmNlTWFwKSAmJiB2ZW5kb3JTb3VyY2VNYXApIHtcbiAgICBzb3VyY2VNYXBVc2VSdWxlID0ge1xuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6ICdzb3VyY2UtbWFwLWxvYWRlcicsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH07XG4gIH1cblxuICBsZXQgYnVpbGRPcHRpbWl6ZXJVc2VSdWxlO1xuICBpZiAoYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyKSB7XG4gICAgYnVpbGRPcHRpbWl6ZXJVc2VSdWxlID0ge1xuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IGJ1aWxkT3B0aW1pemVyTG9hZGVyLFxuICAgICAgICAgIG9wdGlvbnM6IHsgc291cmNlTWFwOiBzY3JpcHRzU291cmNlTWFwIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH07XG4gIH1cblxuICAvLyBBbGxvdyBsb2FkZXJzIHRvIGJlIGluIGEgbm9kZV9tb2R1bGVzIG5lc3RlZCBpbnNpZGUgdGhlIGRldmtpdC9idWlsZC1hbmd1bGFyIHBhY2thZ2UuXG4gIC8vIFRoaXMgaXMgaW1wb3J0YW50IGluIGNhc2UgbG9hZGVycyBkbyBub3QgZ2V0IGhvaXN0ZWQuXG4gIC8vIElmIHRoaXMgZmlsZSBtb3ZlcyB0byBhbm90aGVyIGxvY2F0aW9uLCBhbHRlciBwb3RlbnRpYWxOb2RlTW9kdWxlcyBhcyB3ZWxsLlxuICBjb25zdCBsb2FkZXJOb2RlTW9kdWxlcyA9IFsnbm9kZV9tb2R1bGVzJ107XG4gIGNvbnN0IGJ1aWxkQW5ndWxhck5vZGVNb2R1bGVzID0gZmluZFVwKCdub2RlX21vZHVsZXMnLCBfX2Rpcm5hbWUpO1xuICBpZiAoYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXNcbiAgICAmJiBpc0RpcmVjdG9yeShidWlsZEFuZ3VsYXJOb2RlTW9kdWxlcylcbiAgICAmJiBidWlsZEFuZ3VsYXJOb2RlTW9kdWxlcyAhPT0gbm9kZU1vZHVsZXNcbiAgICAmJiBidWlsZEFuZ3VsYXJOb2RlTW9kdWxlcy5zdGFydHNXaXRoKG5vZGVNb2R1bGVzKVxuICApIHtcbiAgICBsb2FkZXJOb2RlTW9kdWxlcy5wdXNoKGJ1aWxkQW5ndWxhck5vZGVNb2R1bGVzKTtcbiAgfVxuXG4gIC8vIExvYWQgcnhqcyBwYXRoIGFsaWFzZXMuXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9ibG9iL21hc3Rlci9kb2MvbGV0dGFibGUtb3BlcmF0b3JzLm1kI2J1aWxkLWFuZC10cmVlc2hha2luZ1xuICBsZXQgYWxpYXMgPSB7fTtcbiAgdHJ5IHtcbiAgICBjb25zdCByeGpzUGF0aE1hcHBpbmdJbXBvcnQgPSB3Y28uc3VwcG9ydEVTMjAxNVxuICAgICAgPyAncnhqcy9fZXNtMjAxNS9wYXRoLW1hcHBpbmcnXG4gICAgICA6ICdyeGpzL19lc201L3BhdGgtbWFwcGluZyc7XG4gICAgY29uc3QgcnhQYXRocyA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKHByb2plY3RSb290LCByeGpzUGF0aE1hcHBpbmdJbXBvcnQpO1xuICAgIGFsaWFzID0gcnhQYXRocyhub2RlTW9kdWxlcyk7XG4gIH0gY2F0Y2ggeyB9XG5cbiAgY29uc3QgZXh0cmFNaW5pbWl6ZXJzID0gW107XG4gIGlmIChzdHlsZXNPcHRpbWl6YXRpb24pIHtcbiAgICBleHRyYU1pbmltaXplcnMucHVzaChcbiAgICAgIG5ldyBDbGVhbkNzc1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICBzb3VyY2VNYXA6IHN0eWxlc1NvdXJjZU1hcCxcbiAgICAgICAgLy8gY29tcG9uZW50IHN0eWxlcyByZXRhaW4gdGhlaXIgb3JpZ2luYWwgZmlsZSBuYW1lXG4gICAgICAgIHRlc3Q6IChmaWxlKSA9PiAvXFwuKD86Y3NzfHNjc3N8c2Fzc3xsZXNzfHN0eWwpJC8udGVzdChmaWxlKSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBpZiAoc2NyaXB0c09wdGltaXphdGlvbikge1xuICAgIGNvbnN0IHRlcnNlck9wdGlvbnMgPSB7XG4gICAgICBlY21hOiB3Y28uc3VwcG9ydEVTMjAxNSA/IDYgOiA1LFxuICAgICAgd2FybmluZ3M6ICEhYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICBzYWZhcmkxMDogdHJ1ZSxcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBhc2NpaV9vbmx5OiB0cnVlLFxuICAgICAgICBjb21tZW50czogZmFsc2UsXG4gICAgICAgIHdlYmtpdDogdHJ1ZSxcbiAgICAgIH0sXG5cbiAgICAgIC8vIE9uIHNlcnZlciwgd2UgZG9uJ3Qgd2FudCB0byBjb21wcmVzcyBhbnl0aGluZy4gV2Ugc3RpbGwgc2V0IHRoZSBuZ0Rldk1vZGUgPSBmYWxzZSBmb3IgaXRcbiAgICAgIC8vIHRvIHJlbW92ZSBkZXYgY29kZS5cbiAgICAgIGNvbXByZXNzOiAoYnVpbGRPcHRpb25zLnBsYXRmb3JtID09ICdzZXJ2ZXInID8ge1xuICAgICAgICBnbG9iYWxfZGVmczoge1xuICAgICAgICAgIG5nRGV2TW9kZTogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9IDoge1xuICAgICAgICAgIHB1cmVfZ2V0dGVyczogYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyLFxuICAgICAgICAgIC8vIFBVUkUgY29tbWVudHMgd29yayBiZXN0IHdpdGggMyBwYXNzZXMuXG4gICAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrL3dlYnBhY2svaXNzdWVzLzI4OTkjaXNzdWVjb21tZW50LTMxNzQyNTkyNi5cbiAgICAgICAgICBwYXNzZXM6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplciA/IDMgOiAxLFxuICAgICAgICAgIGdsb2JhbF9kZWZzOiB7XG4gICAgICAgICAgICBuZ0Rldk1vZGU6IGZhbHNlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgLy8gV2UgYWxzbyB3YW50IHRvIGF2b2lkIG1hbmdsaW5nIG9uIHNlcnZlci5cbiAgICAgIC4uLihidWlsZE9wdGlvbnMucGxhdGZvcm0gPT0gJ3NlcnZlcicgPyB7IG1hbmdsZTogZmFsc2UgfSA6IHt9KSxcbiAgICB9O1xuXG4gICAgZXh0cmFNaW5pbWl6ZXJzLnB1c2goXG4gICAgICBuZXcgVGVyc2VyUGx1Z2luKHtcbiAgICAgICAgc291cmNlTWFwOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgICBwYXJhbGxlbDogdHJ1ZSxcbiAgICAgICAgY2FjaGU6IHRydWUsXG4gICAgICAgIHRlcnNlck9wdGlvbnMsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBtb2RlOiBzY3JpcHRzT3B0aW1pemF0aW9uIHx8IHN0eWxlc09wdGltaXphdGlvblxuICAgICAgPyAncHJvZHVjdGlvbidcbiAgICAgIDogJ2RldmVsb3BtZW50JyxcbiAgICBkZXZ0b29sOiBmYWxzZSxcbiAgICByZXNvbHZlOiB7XG4gICAgICBleHRlbnNpb25zOiBbJy50cycsICcudHN4JywgJy5tanMnLCAnLmpzJ10sXG4gICAgICBzeW1saW5rczogIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgbW9kdWxlczogW1xuICAgICAgICB3Y28udHNDb25maWcub3B0aW9ucy5iYXNlVXJsIHx8IHByb2plY3RSb290LFxuICAgICAgICAnbm9kZV9tb2R1bGVzJyxcbiAgICAgIF0sXG4gICAgICBhbGlhcyxcbiAgICB9LFxuICAgIHJlc29sdmVMb2FkZXI6IHtcbiAgICAgIG1vZHVsZXM6IGxvYWRlck5vZGVNb2R1bGVzLFxuICAgIH0sXG4gICAgY29udGV4dDogcHJvamVjdFJvb3QsXG4gICAgZW50cnk6IGVudHJ5UG9pbnRzLFxuICAgIG91dHB1dDoge1xuICAgICAgZnV0dXJlRW1pdEFzc2V0czogdHJ1ZSxcbiAgICAgIHBhdGg6IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCBhcyBzdHJpbmcpLFxuICAgICAgcHVibGljUGF0aDogYnVpbGRPcHRpb25zLmRlcGxveVVybCxcbiAgICAgIGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmNodW5rfS5qc2AsXG4gICAgfSxcbiAgICB3YXRjaDogYnVpbGRPcHRpb25zLndhdGNoLFxuICAgIHdhdGNoT3B0aW9uczoge1xuICAgICAgcG9sbDogYnVpbGRPcHRpb25zLnBvbGwsXG4gICAgfSxcbiAgICBwZXJmb3JtYW5jZToge1xuICAgICAgaGludHM6IGZhbHNlLFxuICAgIH0sXG4gICAgbW9kdWxlOiB7XG4gICAgICBydWxlczogW1xuICAgICAgICB7IHRlc3Q6IC9cXC5odG1sJC8sIGxvYWRlcjogJ3Jhdy1sb2FkZXInIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuKGVvdHxzdmd8Y3VyfGpwZ3xwbmd8d2VicHxnaWZ8b3RmfHR0Znx3b2ZmfHdvZmYyfGFuaSkkLyxcbiAgICAgICAgICBsb2FkZXI6ICdmaWxlLWxvYWRlcicsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5maWxlfS5bZXh0XWAsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIC8vIE1hcmsgZmlsZXMgaW5zaWRlIGBAYW5ndWxhci9jb3JlYCBhcyB1c2luZyBTeXN0ZW1KUyBzdHlsZSBkeW5hbWljIGltcG9ydHMuXG4gICAgICAgICAgLy8gUmVtb3ZpbmcgdGhpcyB3aWxsIGNhdXNlIGRlcHJlY2F0aW9uIHdhcm5pbmdzIHRvIGFwcGVhci5cbiAgICAgICAgICB0ZXN0OiAvW1xcL1xcXFxdQGFuZ3VsYXJbXFwvXFxcXF1jb3JlW1xcL1xcXFxdLitcXC5qcyQvLFxuICAgICAgICAgIHBhcnNlcjogeyBzeXN0ZW06IHRydWUgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5qcyQvLFxuICAgICAgICAgIC4uLmJ1aWxkT3B0aW1pemVyVXNlUnVsZSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5qcyQvLFxuICAgICAgICAgIGV4Y2x1ZGU6IC8obmdmYWN0b3J5fG5nc3R5bGUpLmpzJC8sXG4gICAgICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICAgICAgLi4uc291cmNlTWFwVXNlUnVsZSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG5vRW1pdE9uRXJyb3JzOiB0cnVlLFxuICAgICAgbWluaW1pemVyOiBbXG4gICAgICAgIG5ldyBIYXNoZWRNb2R1bGVJZHNQbHVnaW4oKSxcbiAgICAgICAgLy8gVE9ETzogY2hlY2sgd2l0aCBNaWtlIHdoYXQgdGhpcyBmZWF0dXJlIG5lZWRzLlxuICAgICAgICBuZXcgQnVuZGxlQnVkZ2V0UGx1Z2luKHsgYnVkZ2V0czogYnVpbGRPcHRpb25zLmJ1ZGdldHMgfSksXG4gICAgICAgIC4uLmV4dHJhTWluaW1pemVycyxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gIH07XG59XG4iXX0=