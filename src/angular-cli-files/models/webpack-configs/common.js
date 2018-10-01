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
    if (buildOptions.profile) {
        extraPlugins.push(new webpack_1.debug.ProfilingPlugin({
            outputPath: path.resolve(root, 'chrome-profiler-events.json'),
        }));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HO0FBQ0gsaUJBQWlCO0FBQ2pCLCtEQUErRDs7QUFFL0QsNkJBQTZCO0FBQzdCLHFDQUF1RDtBQUN2RCx5REFBeUQ7QUFDekQsbUNBQThDO0FBQzlDLCtEQUEyRDtBQUMzRCxtRkFBOEU7QUFFOUUsK0RBQWlFO0FBQ2pFLG1GQUE4RTtBQUM5RSxpRkFBNEU7QUFDNUUscURBQWlEO0FBRWpELG1DQUFvRDtBQUVwRCxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUM3RCxNQUFNLHdCQUF3QixHQUFHLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBQ3ZFLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO0FBQ3RELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBRXBEOzs7Ozs7Ozs7R0FTRztBQUVILE1BQU0sQ0FBQyxHQUFRLE9BQU8sTUFBTSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDOUMsUUFBQSxvQkFBb0IsR0FBVyxDQUFDLENBQUMsZ0JBQWdCLENBQUM7SUFDN0QsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsb0VBQW9FLENBQUM7SUFDdkYsQ0FBQyxDQUFDLGdEQUFnRCxDQUFDO0FBRXJELFNBQWdCLGVBQWUsQ0FBQyxHQUF5QjtJQUN2RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFFaEQsTUFBTSxXQUFXLEdBQUcsZ0JBQU0s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LFNBQVMsVUFBVSxDQUFDLElBQUksUUFBUTtxQkFDdkM7aUJBQ0Y7Z0JBQ0Q7b0JBQ0UsNkVBQTZFO29CQUM3RSwyREFBMkQ7b0JBQzNELElBQUksRUFBRSx1Q0FBdUM7b0JBQzdDLE1BQU0sRUFBRSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUU7aUJBQ3pCO2dDQUVDLElBQUksRUFBRSxPQUFPLElBQ1YscUJBQXFCO2dDQUd4QixJQUFJLEVBQUUsT0FBTyxFQUNiLE9BQU8sRUFBRSx5QkFBeUIsRUFDbEMsT0FBTyxFQUFFLEtBQUssSUFDWCxnQkFBZ0I7YUFFdEI7U0FDRjtRQUNELFlBQVksRUFBRTtZQUNaLGNBQWMsRUFBRSxJQUFJO1lBQ3BCLFNBQVMsRUFBRTtnQkFDVCxJQUFJLCtCQUFxQixFQUFFO2dCQUMzQixpREFBaUQ7Z0JBQ2pELElBQUksa0NBQWtCLENBQUMsRUFBRSxPQUFPLEVBQUUsWUFBWSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUN6RCxJQUFJLCtDQUFxQixDQUFDO29CQUN4QixTQUFTLEVBQUUsWUFBWSxDQUFDLFNBQVM7b0JBQ2pDLG1EQUFtRDtvQkFDbkQsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxnQ0FBZ0MsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO2lCQUM1RCxDQUFDO2dCQUNGLElBQUksWUFBWSxDQUFDO29CQUNmLFNBQVMsRUFBRSxZQUFZLENBQUMsU0FBUztvQkFDakMsUUFBUSxFQUFFLElBQUk7b0JBQ2QsS0FBSyxFQUFFLElBQUk7b0JBQ1gsYUFBYTtpQkFDZCxDQUFDO2FBQ0g7U0FDRjtRQUNELE9BQU8sRUFBRSxZQUFZO0tBQ3RCLENBQUM7QUFDSixDQUFDO0FBOVJELDBDQThSQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbi8vIHRzbGludDpkaXNhYmxlXG4vLyBUT0RPOiBjbGVhbnVwIHRoaXMgZmlsZSwgaXQncyBjb3BpZWQgYXMgaXMgZnJvbSBBbmd1bGFyIENMSS5cblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEhhc2hlZE1vZHVsZUlkc1BsdWdpbiwgZGVidWcgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCAqIGFzIENvcHlXZWJwYWNrUGx1Z2luIGZyb20gJ2NvcHktd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgZ2V0T3V0cHV0SGFzaEZvcm1hdCB9IGZyb20gJy4vdXRpbHMnO1xuaW1wb3J0IHsgaXNEaXJlY3RvcnkgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvaXMtZGlyZWN0b3J5JztcbmltcG9ydCB7IHJlcXVpcmVQcm9qZWN0TW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL3JlcXVpcmUtcHJvamVjdC1tb2R1bGUnO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IEJ1bmRsZUJ1ZGdldFBsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvYnVuZGxlLWJ1ZGdldCc7XG5pbXBvcnQgeyBDbGVhbkNzc1dlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL2NsZWFuY3NzLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IFNjcmlwdHNXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9zY3JpcHRzLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IGZpbmRVcCB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9maW5kLXVwJztcbmltcG9ydCB7IEFzc2V0UGF0dGVybk9iamVjdCwgRXh0cmFFbnRyeVBvaW50IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyB9IGZyb20gJy4vdXRpbHMnO1xuXG5jb25zdCBQcm9ncmVzc1BsdWdpbiA9IHJlcXVpcmUoJ3dlYnBhY2svbGliL1Byb2dyZXNzUGx1Z2luJyk7XG5jb25zdCBDaXJjdWxhckRlcGVuZGVuY3lQbHVnaW4gPSByZXF1aXJlKCdjaXJjdWxhci1kZXBlbmRlbmN5LXBsdWdpbicpO1xuY29uc3QgVGVyc2VyUGx1Z2luID0gcmVxdWlyZSgndGVyc2VyLXdlYnBhY2stcGx1Z2luJyk7XG5jb25zdCBTdGF0c1BsdWdpbiA9IHJlcXVpcmUoJ3N0YXRzLXdlYnBhY2stcGx1Z2luJyk7XG5cbi8qKlxuICogRW51bWVyYXRlIGxvYWRlcnMgYW5kIHRoZWlyIGRlcGVuZGVuY2llcyBmcm9tIHRoaXMgZmlsZSB0byBsZXQgdGhlIGRlcGVuZGVuY3kgdmFsaWRhdG9yXG4gKiBrbm93IHRoZXkgYXJlIHVzZWQuXG4gKlxuICogcmVxdWlyZSgnc291cmNlLW1hcC1sb2FkZXInKVxuICogcmVxdWlyZSgncmF3LWxvYWRlcicpXG4gKiByZXF1aXJlKCd1cmwtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ2ZpbGUtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXInKVxuICovXG5cbmNvbnN0IGc6IGFueSA9IHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsIDoge307XG5leHBvcnQgY29uc3QgYnVpbGRPcHRpbWl6ZXJMb2FkZXI6IHN0cmluZyA9IGdbJ19EZXZLaXRJc0xvY2FsJ11cbiAgPyByZXF1aXJlLnJlc29sdmUoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXIvc3JjL2J1aWxkLW9wdGltaXplci93ZWJwYWNrLWxvYWRlcicpXG4gIDogJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1vcHRpbWl6ZXIvd2VicGFjay1sb2FkZXInO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q29tbW9uQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpIHtcbiAgY29uc3QgeyByb290LCBwcm9qZWN0Um9vdCwgYnVpbGRPcHRpb25zIH0gPSB3Y287XG5cbiAgY29uc3Qgbm9kZU1vZHVsZXMgPSBmaW5kVXAoJ25vZGVfbW9kdWxlcycsIHByb2plY3RSb290KTtcbiAgaWYgKCFub2RlTW9kdWxlcykge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGxvY2F0ZSBub2RlX21vZHVsZXMgZGlyZWN0b3J5LicpXG4gIH1cblxuICBsZXQgZXh0cmFQbHVnaW5zOiBhbnlbXSA9IFtdO1xuICBsZXQgZW50cnlQb2ludHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nW10gfSA9IHt9O1xuXG4gIGlmIChidWlsZE9wdGlvbnMubWFpbikge1xuICAgIGVudHJ5UG9pbnRzWydtYWluJ10gPSBbcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5tYWluKV07XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnBvbHlmaWxscykge1xuICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSA9IFtwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLnBvbHlmaWxscyldO1xuICB9XG5cbiAgaWYgKCFidWlsZE9wdGlvbnMuYW90KSB7XG4gICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gW1xuICAgICAgLi4uKGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSB8fCBbXSksXG4gICAgICBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnaml0LXBvbHlmaWxscy5qcycpLFxuICAgIF07XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnByb2ZpbGUpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgZGVidWcuUHJvZmlsaW5nUGx1Z2luKHtcbiAgICAgIG91dHB1dFBhdGg6IHBhdGgucmVzb2x2ZShyb290LCAnY2hyb21lLXByb2ZpbGVyLWV2ZW50cy5qc29uJyksXG4gICAgfSkpXG4gIH1cblxuICAvLyBkZXRlcm1pbmUgaGFzaGluZyBmb3JtYXRcbiAgY29uc3QgaGFzaEZvcm1hdCA9IGdldE91dHB1dEhhc2hGb3JtYXQoYnVpbGRPcHRpb25zLm91dHB1dEhhc2hpbmcgYXMgYW55KTtcblxuICAvLyBwcm9jZXNzIGdsb2JhbCBzY3JpcHRzXG4gIGlmIChidWlsZE9wdGlvbnMuc2NyaXB0cy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZSA9IG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoYnVpbGRPcHRpb25zLnNjcmlwdHMsICdzY3JpcHRzJylcbiAgICAgIC5yZWR1Y2UoKHByZXY6IHsgYnVuZGxlTmFtZTogc3RyaW5nLCBwYXRoczogc3RyaW5nW10sIGxhenk6IGJvb2xlYW4gfVtdLCBjdXJyKSA9PiB7XG4gICAgICAgIGNvbnN0IGJ1bmRsZU5hbWUgPSBjdXJyLmJ1bmRsZU5hbWU7XG4gICAgICAgIGNvbnN0IHJlc29sdmVkUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBjdXJyLmlucHV0KTtcbiAgICAgICAgbGV0IGV4aXN0aW5nRW50cnkgPSBwcmV2LmZpbmQoKGVsKSA9PiBlbC5idW5kbGVOYW1lID09PSBidW5kbGVOYW1lKTtcbiAgICAgICAgaWYgKGV4aXN0aW5nRW50cnkpIHtcbiAgICAgICAgICBpZiAoZXhpc3RpbmdFbnRyeS5sYXp5ICYmICFjdXJyLmxhenkpIHtcbiAgICAgICAgICAgIC8vIEFsbCBlbnRyaWVzIGhhdmUgdG8gYmUgbGF6eSBmb3IgdGhlIGJ1bmRsZSB0byBiZSBsYXp5LlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJHtjdXJyLmJ1bmRsZU5hbWV9IGJ1bmRsZSBpcyBtaXhpbmcgbGF6eSBhbmQgbm9uLWxhenkgc2NyaXB0cy5gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBleGlzdGluZ0VudHJ5LnBhdGhzLnB1c2gocmVzb2x2ZWRQYXRoKTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHByZXYucHVzaCh7XG4gICAgICAgICAgICBidW5kbGVOYW1lLFxuICAgICAgICAgICAgcGF0aHM6IFtyZXNvbHZlZFBhdGhdLFxuICAgICAgICAgICAgbGF6eTogY3Vyci5sYXp5XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByZXY7XG4gICAgICB9LCBbXSk7XG5cblxuICAgIC8vIEFkZCBhIG5ldyBhc3NldCBmb3IgZWFjaCBlbnRyeS5cbiAgICBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lLmZvckVhY2goKHNjcmlwdCkgPT4ge1xuICAgICAgLy8gTGF6eSBzY3JpcHRzIGRvbid0IGdldCBhIGhhc2gsIG90aGVyd2lzZSB0aGV5IGNhbid0IGJlIGxvYWRlZCBieSBuYW1lLlxuICAgICAgY29uc3QgaGFzaCA9IHNjcmlwdC5sYXp5ID8gJycgOiBoYXNoRm9ybWF0LnNjcmlwdDtcbiAgICAgIGNvbnN0IGJ1bmRsZU5hbWUgPSBzY3JpcHQuYnVuZGxlTmFtZTtcblxuICAgICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFNjcmlwdHNXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgbmFtZTogYnVuZGxlTmFtZSxcbiAgICAgICAgc291cmNlTWFwOiBidWlsZE9wdGlvbnMuc291cmNlTWFwLFxuICAgICAgICBmaWxlbmFtZTogYCR7cGF0aC5iYXNlbmFtZShidW5kbGVOYW1lKX0ke2hhc2h9LmpzYCxcbiAgICAgICAgc2NyaXB0czogc2NyaXB0LnBhdGhzLFxuICAgICAgICBiYXNlUGF0aDogcHJvamVjdFJvb3QsXG4gICAgICB9KSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBwcm9jZXNzIGFzc2V0IGVudHJpZXNcbiAgaWYgKGJ1aWxkT3B0aW9ucy5hc3NldHMpIHtcbiAgICBjb25zdCBjb3B5V2VicGFja1BsdWdpblBhdHRlcm5zID0gYnVpbGRPcHRpb25zLmFzc2V0cy5tYXAoKGFzc2V0OiBBc3NldFBhdHRlcm5PYmplY3QpID0+IHtcblxuICAgICAgLy8gUmVzb2x2ZSBpbnB1dCBwYXRocyByZWxhdGl2ZSB0byB3b3Jrc3BhY2Ugcm9vdCBhbmQgYWRkIHNsYXNoIGF0IHRoZSBlbmQuXG4gICAgICBhc3NldC5pbnB1dCA9IHBhdGgucmVzb2x2ZShyb290LCBhc3NldC5pbnB1dCkucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgICAgYXNzZXQuaW5wdXQgPSBhc3NldC5pbnB1dC5lbmRzV2l0aCgnLycpID8gYXNzZXQuaW5wdXQgOiBhc3NldC5pbnB1dCArICcvJztcbiAgICAgIGFzc2V0Lm91dHB1dCA9IGFzc2V0Lm91dHB1dC5lbmRzV2l0aCgnLycpID8gYXNzZXQub3V0cHV0IDogYXNzZXQub3V0cHV0ICsgJy8nO1xuXG4gICAgICBpZiAoYXNzZXQub3V0cHV0LnN0YXJ0c1dpdGgoJy4uJykpIHtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9ICdBbiBhc3NldCBjYW5ub3QgYmUgd3JpdHRlbiB0byBhIGxvY2F0aW9uIG91dHNpZGUgb2YgdGhlIG91dHB1dCBwYXRoLic7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY29udGV4dDogYXNzZXQuaW5wdXQsXG4gICAgICAgIC8vIE5vdyB3ZSByZW1vdmUgc3RhcnRpbmcgc2xhc2ggdG8gbWFrZSBXZWJwYWNrIHBsYWNlIGl0IGZyb20gdGhlIG91dHB1dCByb290LlxuICAgICAgICB0bzogYXNzZXQub3V0cHV0LnJlcGxhY2UoL15cXC8vLCAnJyksXG4gICAgICAgIGlnbm9yZTogYXNzZXQuaWdub3JlLFxuICAgICAgICBmcm9tOiB7XG4gICAgICAgICAgZ2xvYjogYXNzZXQuZ2xvYixcbiAgICAgICAgICBkb3Q6IHRydWVcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvcHlXZWJwYWNrUGx1Z2luT3B0aW9ucyA9IHsgaWdub3JlOiBbJy5naXRrZWVwJywgJyoqLy5EU19TdG9yZScsICcqKi9UaHVtYnMuZGInXSB9O1xuXG4gICAgY29uc3QgY29weVdlYnBhY2tQbHVnaW5JbnN0YW5jZSA9IG5ldyBDb3B5V2VicGFja1BsdWdpbihjb3B5V2VicGFja1BsdWdpblBhdHRlcm5zLFxuICAgICAgY29weVdlYnBhY2tQbHVnaW5PcHRpb25zKTtcblxuICAgIC8vIFNhdmUgb3B0aW9ucyBzbyB3ZSBjYW4gdXNlIHRoZW0gaW4gZWplY3QuXG4gICAgKGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UgYXMgYW55KVsnY29weVdlYnBhY2tQbHVnaW5QYXR0ZXJucyddID0gY29weVdlYnBhY2tQbHVnaW5QYXR0ZXJucztcbiAgICAoY29weVdlYnBhY2tQbHVnaW5JbnN0YW5jZSBhcyBhbnkpWydjb3B5V2VicGFja1BsdWdpbk9wdGlvbnMnXSA9IGNvcHlXZWJwYWNrUGx1Z2luT3B0aW9ucztcblxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGNvcHlXZWJwYWNrUGx1Z2luSW5zdGFuY2UpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5wcm9ncmVzcykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBQcm9ncmVzc1BsdWdpbih7IHByb2ZpbGU6IGJ1aWxkT3B0aW9ucy52ZXJib3NlLCBjb2xvcnM6IHRydWUgfSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zaG93Q2lyY3VsYXJEZXBlbmRlbmNpZXMpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgQ2lyY3VsYXJEZXBlbmRlbmN5UGx1Z2luKHtcbiAgICAgIGV4Y2x1ZGU6IC9bXFxcXFxcL11ub2RlX21vZHVsZXNbXFxcXFxcL10vXG4gICAgfSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdGF0c0pzb24pIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU3RhdHNQbHVnaW4oJ3N0YXRzLmpzb24nLCAndmVyYm9zZScpKTtcbiAgfVxuXG4gIGxldCBzb3VyY2VNYXBVc2VSdWxlO1xuICBpZiAoYnVpbGRPcHRpb25zLnNvdXJjZU1hcCAmJiBidWlsZE9wdGlvbnMudmVuZG9yU291cmNlTWFwKSB7XG4gICAgc291cmNlTWFwVXNlUnVsZSA9IHtcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiAnc291cmNlLW1hcC1sb2FkZXInXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9XG4gIH1cblxuICBsZXQgYnVpbGRPcHRpbWl6ZXJVc2VSdWxlO1xuICBpZiAoYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyKSB7XG4gICAgYnVpbGRPcHRpbWl6ZXJVc2VSdWxlID0ge1xuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IGJ1aWxkT3B0aW1pemVyTG9hZGVyLFxuICAgICAgICAgIG9wdGlvbnM6IHsgc291cmNlTWFwOiBidWlsZE9wdGlvbnMuc291cmNlTWFwIH1cbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfTtcbiAgfVxuXG4gIC8vIEFsbG93IGxvYWRlcnMgdG8gYmUgaW4gYSBub2RlX21vZHVsZXMgbmVzdGVkIGluc2lkZSB0aGUgZGV2a2l0L2J1aWxkLWFuZ3VsYXIgcGFja2FnZS5cbiAgLy8gVGhpcyBpcyBpbXBvcnRhbnQgaW4gY2FzZSBsb2FkZXJzIGRvIG5vdCBnZXQgaG9pc3RlZC5cbiAgLy8gSWYgdGhpcyBmaWxlIG1vdmVzIHRvIGFub3RoZXIgbG9jYXRpb24sIGFsdGVyIHBvdGVudGlhbE5vZGVNb2R1bGVzIGFzIHdlbGwuXG4gIGNvbnN0IGxvYWRlck5vZGVNb2R1bGVzID0gWydub2RlX21vZHVsZXMnXTtcbiAgY29uc3QgYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXMgPSBmaW5kVXAoJ25vZGVfbW9kdWxlcycsIF9fZGlybmFtZSk7XG4gIGlmIChidWlsZEFuZ3VsYXJOb2RlTW9kdWxlc1xuICAgICYmIGlzRGlyZWN0b3J5KGJ1aWxkQW5ndWxhck5vZGVNb2R1bGVzKVxuICAgICYmIGJ1aWxkQW5ndWxhck5vZGVNb2R1bGVzICE9PSBub2RlTW9kdWxlc1xuICAgICYmIGJ1aWxkQW5ndWxhck5vZGVNb2R1bGVzLnN0YXJ0c1dpdGgobm9kZU1vZHVsZXMpXG4gICkge1xuICAgIGxvYWRlck5vZGVNb2R1bGVzLnB1c2goYnVpbGRBbmd1bGFyTm9kZU1vZHVsZXMpO1xuICB9XG5cbiAgLy8gTG9hZCByeGpzIHBhdGggYWxpYXNlcy5cbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL1JlYWN0aXZlWC9yeGpzL2Jsb2IvbWFzdGVyL2RvYy9sZXR0YWJsZS1vcGVyYXRvcnMubWQjYnVpbGQtYW5kLXRyZWVzaGFraW5nXG4gIGxldCBhbGlhcyA9IHt9O1xuICB0cnkge1xuICAgIGNvbnN0IHJ4anNQYXRoTWFwcGluZ0ltcG9ydCA9IHdjby5zdXBwb3J0RVMyMDE1XG4gICAgICA/ICdyeGpzL19lc20yMDE1L3BhdGgtbWFwcGluZydcbiAgICAgIDogJ3J4anMvX2VzbTUvcGF0aC1tYXBwaW5nJztcbiAgICBjb25zdCByeFBhdGhzID0gcmVxdWlyZVByb2plY3RNb2R1bGUocHJvamVjdFJvb3QsIHJ4anNQYXRoTWFwcGluZ0ltcG9ydCk7XG4gICAgYWxpYXMgPSByeFBhdGhzKG5vZGVNb2R1bGVzKTtcbiAgfSBjYXRjaCB7IH1cblxuICBjb25zdCBpc0l2eUVuYWJsZWQgPSB3Y28udHNDb25maWcucmF3LmFuZ3VsYXJDb21waWxlck9wdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgJiYgd2NvLnRzQ29uZmlnLnJhdy5hbmd1bGFyQ29tcGlsZXJPcHRpb25zLmVuYWJsZUl2eTtcblxuICBjb25zdCB0ZXJzZXJPcHRpb25zID0ge1xuICAgIGVjbWE6IHdjby5zdXBwb3J0RVMyMDE1ID8gNiA6IDUsXG4gICAgd2FybmluZ3M6ICEhYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgc2FmYXJpMTA6IHRydWUsXG4gICAgb3V0cHV0OiB7XG4gICAgICBhc2NpaV9vbmx5OiB0cnVlLFxuICAgICAgY29tbWVudHM6IGZhbHNlLFxuICAgICAgd2Via2l0OiB0cnVlLFxuICAgIH0sXG5cbiAgICAvLyBPbiBzZXJ2ZXIsIHdlIGRvbid0IHdhbnQgdG8gY29tcHJlc3MgYW55dGhpbmcuIFdlIHN0aWxsIHNldCB0aGUgbmdEZXZNb2RlID0gZmFsc2UgZm9yIGl0XG4gICAgLy8gdG8gcmVtb3ZlIGRldiBjb2RlLlxuICAgIGNvbXByZXNzOiAoYnVpbGRPcHRpb25zLnBsYXRmb3JtID09ICdzZXJ2ZXInID8ge1xuICAgICAgZ2xvYmFsX2RlZnM6IHtcbiAgICAgICAgbmdEZXZNb2RlOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSA6IHtcbiAgICAgIHB1cmVfZ2V0dGVyczogYnVpbGRPcHRpb25zLmJ1aWxkT3B0aW1pemVyLFxuICAgICAgLy8gUFVSRSBjb21tZW50cyB3b3JrIGJlc3Qgd2l0aCAzIHBhc3Nlcy5cbiAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay93ZWJwYWNrL2lzc3Vlcy8yODk5I2lzc3VlY29tbWVudC0zMTc0MjU5MjYuXG4gICAgICBwYXNzZXM6IGJ1aWxkT3B0aW9ucy5idWlsZE9wdGltaXplciA/IDMgOiAxLFxuICAgICAgZ2xvYmFsX2RlZnM6IHtcbiAgICAgICAgbmdEZXZNb2RlOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSksXG4gICAgLy8gV2UgYWxzbyB3YW50IHRvIGF2b2lkIG1hbmdsaW5nIG9uIHNlcnZlci5cbiAgICAuLi4oYnVpbGRPcHRpb25zLnBsYXRmb3JtID09ICdzZXJ2ZXInID8geyBtYW5nbGU6IGZhbHNlIH0gOiB7fSksXG4gIH07XG5cbiAgcmV0dXJuIHtcbiAgICBtb2RlOiBidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uID8gJ3Byb2R1Y3Rpb24nIDogJ2RldmVsb3BtZW50JyxcbiAgICBkZXZ0b29sOiBmYWxzZSxcbiAgICByZXNvbHZlOiB7XG4gICAgICBleHRlbnNpb25zOiBbJy50cycsICcudHN4JywgJy5tanMnLCAnLmpzJ10sXG4gICAgICBzeW1saW5rczogIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgbW9kdWxlczogW1xuICAgICAgICB3Y28udHNDb25maWcub3B0aW9ucy5iYXNlVXJsIHx8IHByb2plY3RSb290LFxuICAgICAgICAnbm9kZV9tb2R1bGVzJyxcbiAgICAgIF0sXG4gICAgICBhbGlhc1xuICAgIH0sXG4gICAgcmVzb2x2ZUxvYWRlcjoge1xuICAgICAgbW9kdWxlczogbG9hZGVyTm9kZU1vZHVsZXNcbiAgICB9LFxuICAgIGNvbnRleHQ6IHByb2plY3RSb290LFxuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBvdXRwdXQ6IHtcbiAgICAgIHBhdGg6IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMub3V0cHV0UGF0aCBhcyBzdHJpbmcpLFxuICAgICAgcHVibGljUGF0aDogYnVpbGRPcHRpb25zLmRlcGxveVVybCxcbiAgICAgIGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmNodW5rfS5qc2AsXG4gICAgfSxcbiAgICB3YXRjaDogYnVpbGRPcHRpb25zLndhdGNoLFxuICAgIHdhdGNoT3B0aW9uczoge1xuICAgICAgcG9sbDogYnVpbGRPcHRpb25zLnBvbGxcbiAgICB9LFxuICAgIHBlcmZvcm1hbmNlOiB7XG4gICAgICBoaW50czogZmFsc2UsXG4gICAgfSxcbiAgICBtb2R1bGU6IHtcbiAgICAgIHJ1bGVzOiBbXG4gICAgICAgIHsgdGVzdDogL1xcLmh0bWwkLywgbG9hZGVyOiAncmF3LWxvYWRlcicgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRlc3Q6IC9cXC4oZW90fHN2Z3xjdXJ8anBnfHBuZ3x3ZWJwfGdpZnxvdGZ8dHRmfHdvZmZ8d29mZjJ8YW5pKSQvLFxuICAgICAgICAgIGxvYWRlcjogJ2ZpbGUtbG9hZGVyJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmZpbGV9LltleHRdYCxcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBNYXJrIGZpbGVzIGluc2lkZSBgQGFuZ3VsYXIvY29yZWAgYXMgdXNpbmcgU3lzdGVtSlMgc3R5bGUgZHluYW1pYyBpbXBvcnRzLlxuICAgICAgICAgIC8vIFJlbW92aW5nIHRoaXMgd2lsbCBjYXVzZSBkZXByZWNhdGlvbiB3YXJuaW5ncyB0byBhcHBlYXIuXG4gICAgICAgICAgdGVzdDogL1tcXC9cXFxcXUBhbmd1bGFyW1xcL1xcXFxdY29yZVtcXC9cXFxcXS4rXFwuanMkLyxcbiAgICAgICAgICBwYXJzZXI6IHsgc3lzdGVtOiB0cnVlIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuanMkLyxcbiAgICAgICAgICAuLi5idWlsZE9wdGltaXplclVzZVJ1bGUsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0ZXN0OiAvXFwuanMkLyxcbiAgICAgICAgICBleGNsdWRlOiAvKG5nZmFjdG9yeXxuZ3N0eWxlKS5qcyQvLFxuICAgICAgICAgIGVuZm9yY2U6ICdwcmUnLFxuICAgICAgICAgIC4uLnNvdXJjZU1hcFVzZVJ1bGUsXG4gICAgICAgIH0sXG4gICAgICBdXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG5vRW1pdE9uRXJyb3JzOiB0cnVlLFxuICAgICAgbWluaW1pemVyOiBbXG4gICAgICAgIG5ldyBIYXNoZWRNb2R1bGVJZHNQbHVnaW4oKSxcbiAgICAgICAgLy8gVE9ETzogY2hlY2sgd2l0aCBNaWtlIHdoYXQgdGhpcyBmZWF0dXJlIG5lZWRzLlxuICAgICAgICBuZXcgQnVuZGxlQnVkZ2V0UGx1Z2luKHsgYnVkZ2V0czogYnVpbGRPcHRpb25zLmJ1ZGdldHMgfSksXG4gICAgICAgIG5ldyBDbGVhbkNzc1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICAgIHNvdXJjZU1hcDogYnVpbGRPcHRpb25zLnNvdXJjZU1hcCxcbiAgICAgICAgICAvLyBjb21wb25lbnQgc3R5bGVzIHJldGFpbiB0aGVpciBvcmlnaW5hbCBmaWxlIG5hbWVcbiAgICAgICAgICB0ZXN0OiAoZmlsZSkgPT4gL1xcLig/OmNzc3xzY3NzfHNhc3N8bGVzc3xzdHlsKSQvLnRlc3QoZmlsZSksXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgVGVyc2VyUGx1Z2luKHtcbiAgICAgICAgICBzb3VyY2VNYXA6IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAsXG4gICAgICAgICAgcGFyYWxsZWw6IHRydWUsXG4gICAgICAgICAgY2FjaGU6IHRydWUsXG4gICAgICAgICAgdGVyc2VyT3B0aW9ucyxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLFxuICB9O1xufVxuIl19