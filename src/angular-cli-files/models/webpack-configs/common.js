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
    if (buildOptions.polyfills) {
        entryPoints['polyfills'] = [path.resolve(root, buildOptions.polyfills)];
    }
    if (!buildOptions.aot) {
        entryPoints['polyfills'] = [
            ...(entryPoints['polyfills'] || []),
            path.join(__dirname, '..', 'jit-polyfills.js'),
        ];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILHlEQUF5RDtBQUN6RCw2QkFBNkI7QUFDN0IscUNBQXVEO0FBRXZELCtEQUFpRTtBQUNqRSxtRkFBOEU7QUFDOUUsaUZBQTRFO0FBQzVFLHFEQUFpRDtBQUNqRCwrREFBMkQ7QUFDM0QsbUZBQThFO0FBRTlFLG1DQUF5RTtBQUV6RSxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUM3RCxNQUFNLHdCQUF3QixHQUFHLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBQ3ZFLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO0FBQ3RELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBR3BELGtDQUFrQztBQUNsQyxNQUFNLENBQUMsR0FBUSxPQUFPLE1BQU0sS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQzlDLFFBQUEsb0JBQW9CLEdBQVcsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0lBQzdELENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLG9FQUFvRSxDQUFDO0lBQ3ZGLENBQUMsQ0FBQyxnREFBZ0QsQ0FBQztBQUVyRCwyQ0FBMkM7QUFDM0MsU0FBZ0IsZUFBZSxDQUFDLEdBQXlCO0lBQ3ZELE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxHQUFHLEdBQUcsQ0FBQztJQUNoRCxNQUFNLEVBQUUsTUFBTSxFQUFFLGtCQUFrQixFQUFFLE9BQU8sRUFBRSxtQkFBbUIsRUFB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QUNsQyxRQUFRLEVBQUUsU0FBUyxVQUFVLENBQUMsS0FBSyxLQUFLO1NBQ3pDO1FBQ0QsS0FBSyxFQUFFLFlBQVksQ0FBQyxLQUFLO1FBQ3pCLFlBQVksRUFBRTtZQUNaLElBQUksRUFBRSxZQUFZLENBQUMsSUFBSTtTQUN4QjtRQUNELFdBQVcsRUFBRTtZQUNYLEtBQUssRUFBRSxLQUFLO1NBQ2I7UUFDRCxNQUFNLEVBQUU7WUFDTixLQUFLLEVBQUU7Z0JBQ0wsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUU7Z0JBQ3pDO29CQUNFLElBQUksRUFBRSwwREFBMEQ7b0JBQ2hFLE1BQU0sRUFBRSxhQUFhO29CQUNyQixPQUFPLEVBQUU7d0JBQ1AsSUFBSSxFQUFFLFNBQVMsVUFBVSxDQUFDLElBQUksUUFBUTtxQkFDdkM7aUJBQ0Y7Z0JBQ0Q7b0JBQ0UsNkVBQTZFO29CQUM3RSwyREFBMkQ7b0JBQzNELElBQUksRUFBRSx1Q0FBdUM7b0JBQzdDLE1BQU0sRUFBRSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUU7aUJBQ3pCO2dDQUVDLElBQUksRUFBRSxPQUFPLElBQ1YscUJBQXFCO2dDQUd4QixJQUFJLEVBQUUsT0FBTyxFQUNiLE9BQU8sRUFBRSx5QkFBeUIsRUFDbEMsT0FBTyxFQUFFLEtBQUssSUFDWCxnQkFBZ0I7YUFFdEI7U0FDRjtRQUNELFlBQVksRUFBRTtZQUNaLGNBQWMsRUFBRSxJQUFJO1lBQ3BCLFNBQVMsRUFBRTtnQkFDVCxJQUFJLCtCQUFxQixFQUFFO2dCQUMzQixpREFBaUQ7Z0JBQ2pELElBQUksa0NBQWtCLENBQUMsRUFBRSxPQUFPLEVBQUUsWUFBWSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUN6RCxHQUFHLGVBQWU7YUFDbkI7U0FDRjtRQUNELE9BQU8sRUFBRSxZQUFZO0tBQ3RCLENBQUM7QUFDSixDQUFDO0FBNVNELDBDQTRTQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIENvcHlXZWJwYWNrUGx1Z2luIGZyb20gJ2NvcHktd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEhhc2hlZE1vZHVsZUlkc1BsdWdpbiwgZGVidWcgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IEFzc2V0UGF0dGVybk9iamVjdCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IEJ1bmRsZUJ1ZGdldFBsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvYnVuZGxlLWJ1ZGdldCc7XG5pbXBvcnQgeyBDbGVhbkNzc1dlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL2NsZWFuY3NzLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IFNjcmlwdHNXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9zY3JpcHRzLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IGZpbmRVcCB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9maW5kLXVwJztcbmltcG9ydCB7IGlzRGlyZWN0b3J5IH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL2lzLWRpcmVjdG9yeSc7XG5pbXBvcnQgeyByZXF1aXJlUHJvamVjdE1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9yZXF1aXJlLXByb2plY3QtbW9kdWxlJztcbmltcG9ydCB7IEJ1aWxkT3B0aW9ucywgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IGdldE91dHB1dEhhc2hGb3JtYXQsIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMgfSBmcm9tICcuL3V0aWxzJztcblxuY29uc3QgUHJvZ3Jlc3NQbHVnaW4gPSByZXF1aXJlKCd3ZWJwYWNrL2xpYi9Qcm9ncmVzc1BsdWdpbicpO1xuY29uc3QgQ2lyY3VsYXJEZXBlbmRlbmN5UGx1Z2luID0gcmVxdWlyZSgnY2lyY3VsYXItZGVwZW5kZW5jeS1wbHVnaW4nKTtcbmNvbnN0IFRlcnNlclBsdWdpbiA9IHJlcXVpcmUoJ3RlcnNlci13ZWJwYWNrLXBsdWdpbicpO1xuY29uc3QgU3RhdHNQbHVnaW4gPSByZXF1aXJlKCdzdGF0cy13ZWJwYWNrLXBsdWdpbicpO1xuXG5cbi8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbmNvbnN0IGc6IGFueSA9IHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsIDoge307XG5leHBvcnQgY29uc3QgYnVpbGRPcHRpbWl6ZXJMb2FkZXI6IHN0cmluZyA9IGdbJ19EZXZLaXRJc0xvY2FsJ11cbiAgPyByZXF1aXJlLnJlc29sdmUoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXIvc3JjL2J1aWxkLW9wdGltaXplci93ZWJwYWNrLWxvYWRlcicpXG4gIDogJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXIvd2VicGFjay1sb2FkZXInO1xuXG4vLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYmlnLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q29tbW9uQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpIHtcbiAgY29uc3QgeyByb290LCBwcm9qZWN0Um9vdCwgYnVpbGRPcHRpb25zIH0gPSB3Y287XG4gIGNvbnN0IHsgc3R5bGVzOiBzdHlsZXNPcHRpbWl6YXRpb24sIHNjcmlwdHM6IHNjcmlwdHNPcHRpbWl6YXRpb24gfSA9IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb247XG4gIGNvbnN0IHtcbiAgICBzdHlsZXM6IHN0eWxlc1NvdXJjZU1hcCxcbiAgICBzY3JpcHRzOiBzY3JpcHRzU291cmNlTWFwLFxuICAgIHZlbmRvcjogdmVuZG9yU291cmNlTWFwLFxuICB9ID0gYnVpbGRPcHRpb25zLnNvdXJjZU1hcDtcblxuICBjb25zdCBub2RlTW9kdWxlcyA9IGZpbmRVcCgnbm9kZV9tb2R1bGVzJywgcHJvamVjdFJvb3QpO1xuICBpZiAoIW5vZGVNb2R1bGVzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgbG9jYXRlIG5vZGVfbW9kdWxlcyBkaXJlY3RvcnkuJyk7XG4gIH1cblxuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gIGNvbnN0IGV4dHJhUGx1Z2luczogYW55W10gPSBbXTtcbiAgY29uc3QgZW50cnlQb2ludHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nW10gfSA9IHt9O1xuXG4gIGlmIChidWlsZE9wdGlvbnMubWFpbikge1xuICAgIGVudHJ5UG9pbnRzWydtYWluJ10gPSBbcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5tYWluKV07XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnBvbHlmaWxscykge1xuICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSA9IFtwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLnBvbHlmaWxscyldO1xuICB9XG5cbiAgaWYgKCFidWlsZE9wdGlvbnMuYW90KSB7XG4gICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gW1xuICAgICAgLi4uKGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSB8fCBbXSksXG4gICAgICBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnaml0LXBvbHlmaWxscy5qcycpLFxuICAgIF07XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnByb2ZpbGUpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgZGVidWcuUHJvZmlsaW5nUGx1Z2luKHtcbiAgICAgIG91dHB1dFBhdGg6IHBhdGgucmVzb2x2ZShyb290LCAnY2hyb21lLXByb2ZpbGVyLWV2ZW50cy5qc29uJyksXG4gICAgfSkpO1xuICB9XG5cbiAgLy8gZGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0XG4gIGNvbnN0IGhhc2hGb3JtYXQgPSBnZXRPdXRwdXRIYXNoRm9ybWF0KGJ1aWxkT3B0aW9ucy5vdXRwdXRIYXNoaW5nIHx8ICdub25lJyk7XG5cbiAgLy8gcHJvY2VzcyBnbG9iYWwgc2NyaXB0c1xuICBpZiAoYnVpbGRPcHRpb25zLnNjcmlwdHMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUgPSBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKGJ1aWxkT3B0aW9ucy5zY3JpcHRzLCAnc2NyaXB0cycpXG4gICAgICAucmVkdWNlKChwcmV2OiB7IGJ1bmRsZU5hbWU6IHN0cmluZywgcGF0aHM6IHN0cmluZ1tdLCBsYXp5OiBib29sZWFuIH1bXSwgY3VycikgPT4ge1xuICAgICAgICBjb25zdCBidW5kbGVOYW1lID0gY3Vyci5idW5kbGVOYW1lO1xuICAgICAgICBjb25zdCByZXNvbHZlZFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgY3Vyci5pbnB1dCk7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nRW50cnkgPSBwcmV2LmZpbmQoKGVsKSA9PiBlbC5idW5kbGVOYW1lID09PSBidW5kbGVOYW1lKTtcbiAgICAgICAgaWYgKGV4aXN0aW5nRW50cnkpIHtcbiAgICAgICAgICBpZiAoZXhpc3RpbmdFbnRyeS5sYXp5ICYmICFjdXJyLmxhenkpIHtcbiAgICAgICAgICAgIC8vIEFsbCBlbnRyaWVzIGhhdmUgdG8gYmUgbGF6eSBmb3IgdGhlIGJ1bmRsZSB0byBiZSBsYXp5LlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJHtjdXJyLmJ1bmRsZU5hbWV9IGJ1bmRsZSBpcyBtaXhpbmcgbGF6eSBhbmQgbm9uLWxhenkgc2NyaXB0cy5gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBleGlzdGluZ0VudHJ5LnBhdGhzLnB1c2gocmVzb2x2ZWRQYXRoKTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHByZXYucHVzaCh7XG4gICAgICAgICAgICBidW5kbGVOYW1lLFxuICAgICAgICAgICAgcGF0aHM6IFtyZXNvbHZlZFBhdGhdLFxuICAgICAgICAgICAgbGF6eTogY3Vyci5sYXp5LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHByZXY7XG4gICAgICB9LCBbXSk7XG5cblxuICAgIC8vIEFkZCBhIG5ldyBhc3NldCBmb3IgZWFjaCBlbnRyeS5cbiAgICBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lLmZvckVhY2goKHNjcmlwdCkgPT4ge1xuICAgICAgLy8gTGF6eSBzY3JpcHRzIGRvbid0IGdldCBhIGhhc2gsIG90aGVyd2lzZSB0aGV5IGNhbid0IGJlIGxvYWRlZCBieSBuYW1lLlxuICAgICAgY29uc3QgaGFzaCA9IHNjcmlwdC5sYXp5ID8gJycgOiBoYXNoRm9ybWF0LnNjcmlwdDtcbiAgICAgIGNvbnN0IGJ1bmRsZU5hbWUgPSBzY3JpcHQuYnVuZGxlTmFtZTtcblxuICAgICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFNjcmlwdHNXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgbmFtZTogYnVuZGxlTmFtZSxcbiAgICAgICAgc291cmNlTWFwOiBzY3JpcHRzU291cmNlTWFwLFxuICAgICAgICBmaWxlbmFtZTogYCR7cGF0aC5iYXNlbmFtZShidW5kbGVOYW1lKX0ke2hhc2h9LmpzYCxcbiAgICAgICAgc2NyaXB0czogc2NyaXB0LnBhdGhzLFxuICAgICAgICBiYXNlUGF0aDogcHJvamVjdFJvb3QsXG4gICAgICB9KSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBwcm9jZXNzIGFzc2V0IGVudHJpZXNcbiAgaWYgKGJ1aWxkT3B0aW9ucy5hc3NldHMpIHtcbiAgICBjb25zdCBjb3B5V2VicGFja1BsdWdpblBhdHRlcm5zID0gYnVpbGRPcHRpb25zLmFzc2V0cy5tYXAoKGFzc2V0OiBBc3NldFBhdHRlcm5PYmplY3QpID0+IHtcblxuICAgICAgLy8gUmVzb2x2ZSBpbnB1dCBwYXRocyByZWxhdGl2ZSB0byB3b3Jrc3BhY2Ugcm9vdCBhbmQgYWRkIHNsYXNoIGF0IHRoZSBlbmQuXG4gICAgICBhc3NldC5pbnB1dCA9IHBhdGgucmVzb2x2ZShyb290LCBhc3NldC5pbnB1dCkucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgICAgYXNzZXQuaW5wdXQgPSBhc3NldC5pbnB1dC5lbmRzV2l0aCgnLycpID8gYXNzZXQuaW5wdXQgOiBhc3NldC5pbnB1dCArICcvJztcbiAgICAgIGFzc2V0Lm91dHB1dCA9IGFzc2V0Lm91dHB1dC5lbmRzV2l0aCgnLycpID8gYXNzZXQub3V0cHV0IDogYXNzZXQub3V0cHV0ICsgJy8nO1xuXG4gICAgICBpZiAoYXNzZXQub3V0cHV0LnN0YXJ0c1dpdGgoJy4uJykpIHtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9ICdBbiBhc3NldCBjYW5ub3QgYmUgd3JpdHRlbiB0byBhIGxvY2F0aW9uIG91dHNpZGUgb2YgdGhlIG91dHB1dCBwYXRoLic7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY29udGV4dDogYXNzZXQuaW5wdXQsXG4gICAgICAgIC8vIE5vdyB3ZSByZW1vdmUgc3RhcnRpbmcgc2xhc2ggdG8gbWFrZSBXZWJwYWNrIHBsYWNlIGl0IGZyb20gdGhlIG91dHB1dCByb290LlxuICAgICAgICB0bzogYXNzZXQub3V0cHV0LnJlcGxhY2UoL15cXC8vLCAnJyksXG4gICAgICAgIGlnbm9yZTogYXNzZXQuaWdub3JlLFxuICAgICAgICBmcm9tOiB7XG4gICAgICAgICAgZ2xvYjogYXNzZXQuZ2xvYixcbiAgICAgICAgICBkb3Q6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgY29uc3QgY29weVdlYnBhY2tQbHVnaW5PcHRpb25zID0geyBpZ25vcmU6IFsnLmdpdGtlZXAnLCAnKiovLkRTX1N0b3JlJywgJyoqL1RodW1icy5kYiddIH07XG5cbiAgICBjb25zdCBjb3B5V2VicGFja1BsdWdpbkluc3RhbmNlID0gbmV3IENvcHlXZWJwYWNrUGx1Z2luKGNvcHlXZWJwYWNrUGx1Z2luUGF0dGVybnMsXG4gICAgICBjb3B5V2VicGFja1BsdWdpbk9wdGlvbnMpO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5wcm9ncmVzcykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBQcm9ncmVzc1BsdWdpbih7IHByb2ZpbGU6IGJ1aWxkT3B0aW9ucy52ZXJib3NlIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc2hvd0NpcmN1bGFyRGVwZW5kZW5jaWVzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IENpcmN1bGFyRGVwZW5kZW5jeVBsdWdpbih7XG4gICAgICBleGNsdWRlOiAvKFtcXFxcXFwvXW5vZGVfbW9kdWxlc1tcXFxcXFwvXSl8KG5nZmFjdG9yeVxcLmpzJCkvLFxuICAgIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3RhdHNKc29uKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN0YXRzUGx1Z2luKCdzdGF0cy5qc29uJywgJ3ZlcmJvc2UnKSk7XG4gIH1cblxuICBsZXQgc291cmNlTWFwVXNlUnVsZTtcbiAgaWYgKChzY3JpcHRzU291cmNlTWFwIHx8IHN0eWxlc1NvdXJjZU1hcCkgJiYgdmVuZG9yU291cmNlTWFwKSB7XG4gICAgc291cmNlTWFwVXNlUnVsZSA9IHtcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiAnc291cmNlLW1hcC1sb2FkZXInLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9O1xuICB9XG5cbiAgbGV0IGJ1aWxkT3B0aW1pemVyVXNlUnVsZTtcbiAgaWYgKGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcikge1xuICAgIGJ1aWxkT3B0aW1pemVyVXNlUnVsZSA9IHtcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiBidWlsZE9wdGltaXplckxvYWRlcixcbiAgICAgICAgICBvcHRpb25zOiB7IHNvdXJjZU1hcDogc2NyaXB0c1NvdXJjZU1hcCB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9O1xuICB9XG5cbiAgLy8gQWxsb3cgbG9hZGVycyB0byBiZSBpbiBhIG5vZGVfbW9kdWxlcyBuZXN0ZWQgaW5zaWRlIHRoZSBkZXZraXQvYnVpbGQtYW5ndWxhciBwYWNrYWdlLlxuICAvLyBUaGlzIGlzIGltcG9ydGFudCBpbiBjYXNlIGxvYWRlcnMgZG8gbm90IGdldCBob2lzdGVkLlxuICAvLyBJZiB0aGlzIGZpbGUgbW92ZXMgdG8gYW5vdGhlciBsb2NhdGlvbiwgYWx0ZXIgcG90ZW50aWFsTm9kZU1vZHVsZXMgYXMgd2VsbC5cbiAgY29uc3QgbG9hZGVyTm9kZU1vZHVsZXMgPSBbJ25vZGVfbW9kdWxlcyddO1xuICBjb25zdCBidWlsZEFuZ3VsYXJOb2RlTW9kdWxlcyA9IGZpbmRVcCgnbm9kZV9tb2R1bGVzJywgX19kaXJuYW1lKTtcbiAgaWYgKGJ1aWxkQW5ndWxhck5vZGVNb2R1bGVzXG4gICAgJiYgaXNEaXJlY3RvcnkoYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXMpXG4gICAgJiYgYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXMgIT09IG5vZGVNb2R1bGVzXG4gICAgJiYgYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXMuc3RhcnRzV2l0aChub2RlTW9kdWxlcylcbiAgKSB7XG4gICAgbG9hZGVyTm9kZU1vZHVsZXMucHVzaChidWlsZEFuZ3VsYXJOb2RlTW9kdWxlcyk7XG4gIH1cblxuICAvLyBMb2FkIHJ4anMgcGF0aCBhbGlhc2VzLlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vUmVhY3RpdmVYL3J4anMvYmxvYi9tYXN0ZXIvZG9jL2xldHRhYmxlLW9wZXJhdG9ycy5tZCNidWlsZC1hbmQtdHJlZXNoYWtpbmdcbiAgbGV0IGFsaWFzID0ge307XG4gIHRyeSB7XG4gICAgY29uc3Qgcnhqc1BhdGhNYXBwaW5nSW1wb3J0ID0gd2NvLnN1cHBvcnRFUzIwMTVcbiAgICAgID8gJ3J4anMvX2VzbTIwMTUvcGF0aC1tYXBwaW5nJ1xuICAgICAgOiAncnhqcy9fZXNtNS9wYXRoLW1hcHBpbmcnO1xuICAgIGNvbnN0IHJ4UGF0aHMgPSByZXF1aXJlUHJvamVjdE1vZHVsZShwcm9qZWN0Um9vdCwgcnhqc1BhdGhNYXBwaW5nSW1wb3J0KTtcbiAgICBhbGlhcyA9IHJ4UGF0aHMobm9kZU1vZHVsZXMpO1xuICB9IGNhdGNoIHsgfVxuXG4gIGNvbnN0IGV4dHJhTWluaW1pemVycyA9IFtdO1xuICBpZiAoc3R5bGVzT3B0aW1pemF0aW9uKSB7XG4gICAgZXh0cmFNaW5pbWl6ZXJzLnB1c2goXG4gICAgICBuZXcgQ2xlYW5Dc3NXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgc291cmNlTWFwOiBzdHlsZXNTb3VyY2VNYXAsXG4gICAgICAgIC8vIGNvbXBvbmVudCBzdHlsZXMgcmV0YWluIHRoZWlyIG9yaWdpbmFsIGZpbGUgbmFtZVxuICAgICAgICB0ZXN0OiAoZmlsZSkgPT4gL1xcLig/OmNzc3xzY3NzfHNhc3N8bGVzc3xzdHlsKSQvLnRlc3QoZmlsZSksXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgaWYgKHNjcmlwdHNPcHRpbWl6YXRpb24pIHtcbiAgICBjb25zdCB0ZXJzZXJPcHRpb25zID0ge1xuICAgICAgZWNtYTogd2NvLnN1cHBvcnRFUzIwMTUgPyA2IDogNSxcbiAgICAgIHdhcm5pbmdzOiAhIWJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgc2FmYXJpMTA6IHRydWUsXG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgYXNjaWlfb25seTogdHJ1ZSxcbiAgICAgICAgY29tbWVudHM6IGZhbHNlLFxuICAgICAgICB3ZWJraXQ6IHRydWUsXG4gICAgICB9LFxuXG4gICAgICAvLyBPbiBzZXJ2ZXIsIHdlIGRvbid0IHdhbnQgdG8gY29tcHJlc3MgYW55dGhpbmcuIFdlIHN0aWxsIHNldCB0aGUgbmdEZXZNb2RlID0gZmFsc2UgZm9yIGl0XG4gICAgICAvLyB0byByZW1vdmUgZGV2IGNvZGUuXG4gICAgICBjb21wcmVzczogKGJ1aWxkT3B0aW9ucy5wbGF0Zm9ybSA9PSAnc2VydmVyJyA/IHtcbiAgICAgICAgZ2xvYmFsX2RlZnM6IHtcbiAgICAgICAgICBuZ0Rldk1vZGU6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgfSA6IHtcbiAgICAgICAgICBwdXJlX2dldHRlcnM6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgICAgICAvLyBQVVJFIGNvbW1lbnRzIHdvcmsgYmVzdCB3aXRoIDMgcGFzc2VzLlxuICAgICAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay93ZWJwYWNrL2lzc3Vlcy8yODk5I2lzc3VlY29tbWVudC0zMTc0MjU5MjYuXG4gICAgICAgICAgcGFzc2VzOiBidWlsZE9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIgPyAzIDogMSxcbiAgICAgICAgICBnbG9iYWxfZGVmczoge1xuICAgICAgICAgICAgbmdEZXZNb2RlOiBmYWxzZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgIC8vIFdlIGFsc28gd2FudCB0byBhdm9pZCBtYW5nbGluZyBvbiBzZXJ2ZXIuXG4gICAgICAuLi4oYnVpbGRPcHRpb25zLnBsYXRmb3JtID09ICdzZXJ2ZXInID8geyBtYW5nbGU6IGZhbHNlIH0gOiB7fSksXG4gICAgfTtcblxuICAgIGV4dHJhTWluaW1pemVycy5wdXNoKFxuICAgICAgbmV3IFRlcnNlclBsdWdpbih7XG4gICAgICAgIHNvdXJjZU1hcDogc2NyaXB0c1NvdXJjZU1hcCxcbiAgICAgICAgcGFyYWxsZWw6IHRydWUsXG4gICAgICAgIGNhY2hlOiB0cnVlLFxuICAgICAgICB0ZXJzZXJPcHRpb25zLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgbW9kZTogc2NyaXB0c09wdGltaXphdGlvbiB8fCBzdHlsZXNPcHRpbWl6YXRpb25cbiAgICAgID8gJ3Byb2R1Y3Rpb24nXG4gICAgICA6ICdkZXZlbG9wbWVudCcsXG4gICAgZGV2dG9vbDogZmFsc2UsXG4gICAgcmVzb2x2ZToge1xuICAgICAgZXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgICAgc3ltbGlua3M6ICFidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgIG1vZHVsZXM6IFtcbiAgICAgICAgd2NvLnRzQ29uZmlnLm9wdGlvbnMuYmFzZVVybCB8fCBwcm9qZWN0Um9vdCxcbiAgICAgICAgJ25vZGVfbW9kdWxlcycsXG4gICAgICBdLFxuICAgICAgYWxpYXMsXG4gICAgfSxcbiAgICByZXNvbHZlTG9hZGVyOiB7XG4gICAgICBtb2R1bGVzOiBsb2FkZXJOb2RlTW9kdWxlcyxcbiAgICB9LFxuICAgIGNvbnRleHQ6IHByb2plY3RSb290LFxuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBvdXRwdXQ6IHtcbiAgICAgIHBhdGg6IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCBhcyBzdHJpbmcpLFxuICAgICAgcHVibGljUGF0aDogYnVpbGRPcHRpb25zLmRlcGxveVVybCxcbiAgICAgIGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmNodW5rfS5qc2AsXG4gICAgfSxcbiAgICB3YXRjaDogYnVpbGRPcHRpb25zLndhdGNoLFxuICAgIHdhdGNoT3B0aW9uczoge1xuICAgICAgcG9sbDogYnVpbGRPcHRpb25zLnBvbGwsXG4gICAgfSxcbiAgICBwZXJmb3JtYW5jZToge1xuICAgICAgaGludHM6IGZhbHNlLFxuICAgIH0sXG4gICAgbW9kdWxlOiB7XG4gICAgICBydWxlczogW1xuICAgICAgICB7IHRlc3Q6IC9cXC5odG1sJC8sIGxvYWRlcjogJ3Jhdy1sb2FkZXInIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuKGVvdHxzdmd8Y3VyfGpwZ3xwbmd8d2VicHxnaWZ8b3RmfHR0Znx3b2ZmfHdvZmYyfGFuaSkkLyxcbiAgICAgICAgICBsb2FkZXI6ICdmaWxlLWxvYWRlcicsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5maWxlfS5bZXh0XWAsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIC8vIE1hcmsgZmlsZXMgaW5zaWRlIGBAYW5ndWxhci9jb3JlYCBhcyB1c2luZyBTeXN0ZW1KUyBzdHlsZSBkeW5hbWljIGltcG9ydHMuXG4gICAgICAgICAgLy8gUmVtb3ZpbmcgdGhpcyB3aWxsIGNhdXNlIGRlcHJlY2F0aW9uIHdhcm5pbmdzIHRvIGFwcGVhci5cbiAgICAgICAgICB0ZXN0OiAvW1xcL1xcXFxdQGFuZ3VsYXJbXFwvXFxcXF1jb3JlW1xcL1xcXFxdLitcXC5qcyQvLFxuICAgICAgICAgIHBhcnNlcjogeyBzeXN0ZW06IHRydWUgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5qcyQvLFxuICAgICAgICAgIC4uLmJ1aWxkT3B0aW1pemVyVXNlUnVsZSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC5qcyQvLFxuICAgICAgICAgIGV4Y2x1ZGU6IC8obmdmYWN0b3J5fG5nc3R5bGUpLmpzJC8sXG4gICAgICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICAgICAgLi4uc291cmNlTWFwVXNlUnVsZSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG5vRW1pdE9uRXJyb3JzOiB0cnVlLFxuICAgICAgbWluaW1pemVyOiBbXG4gICAgICAgIG5ldyBIYXNoZWRNb2R1bGVJZHNQbHVnaW4oKSxcbiAgICAgICAgLy8gVE9ETzogY2hlY2sgd2l0aCBNaWtlIHdoYXQgdGhpcyBmZWF0dXJlIG5lZWRzLlxuICAgICAgICBuZXcgQnVuZGxlQnVkZ2V0UGx1Z2luKHsgYnVkZ2V0czogYnVpbGRPcHRpb25zLmJ1ZGdldHMgfSksXG4gICAgICAgIC4uLmV4dHJhTWluaW1pemVycyxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gIH07XG59XG4iXX0=