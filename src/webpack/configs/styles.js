"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStylesConfig = exports.resolveGlobalStyles = void 0;
const fs = __importStar(require("fs"));
const mini_css_extract_plugin_1 = __importDefault(require("mini-css-extract-plugin"));
const path = __importStar(require("path"));
const sass_service_1 = require("../../sass/sass-service");
const plugins_1 = require("../plugins");
const css_optimizer_plugin_1 = require("../plugins/css-optimizer-plugin");
const helpers_1 = require("../utils/helpers");
function resolveGlobalStyles(styleEntrypoints, root, preserveSymlinks, skipResolution = false) {
    const entryPoints = {};
    const noInjectNames = [];
    const paths = [];
    if (styleEntrypoints.length === 0) {
        return { entryPoints, noInjectNames, paths };
    }
    for (const style of (0, helpers_1.normalizeExtraEntryPoints)(styleEntrypoints, 'styles')) {
        let stylesheetPath = style.input;
        if (!skipResolution) {
            stylesheetPath = path.resolve(root, stylesheetPath);
            if (!fs.existsSync(stylesheetPath)) {
                try {
                    stylesheetPath = require.resolve(style.input, { paths: [root] });
                }
                catch (_a) { }
            }
        }
        if (!preserveSymlinks) {
            stylesheetPath = fs.realpathSync(stylesheetPath);
        }
        // Add style entry points.
        if (entryPoints[style.bundleName]) {
            entryPoints[style.bundleName].push(stylesheetPath);
        }
        else {
            entryPoints[style.bundleName] = [stylesheetPath];
        }
        // Add non injected styles to the list.
        if (!style.inject) {
            noInjectNames.push(style.bundleName);
        }
        // Add global css paths.
        paths.push(stylesheetPath);
    }
    return { entryPoints, noInjectNames, paths };
}
exports.resolveGlobalStyles = resolveGlobalStyles;
// eslint-disable-next-line max-lines-per-function
function getStylesConfig(wco) {
    var _a, _b, _c;
    const postcssImports = require('postcss-import');
    const postcssPresetEnv = require('postcss-preset-env');
    const { root, buildOptions } = wco;
    const extraPlugins = [];
    extraPlugins.push(new plugins_1.AnyComponentStyleBudgetChecker(buildOptions.budgets));
    const cssSourceMap = buildOptions.sourceMap.styles;
    // Determine hashing format.
    const hashFormat = (0, helpers_1.getOutputHashFormat)(buildOptions.outputHashing);
    // use includePaths from appConfig
    const includePaths = (_c = (_b = (_a = buildOptions.stylePreprocessorOptions) === null || _a === void 0 ? void 0 : _a.includePaths) === null || _b === void 0 ? void 0 : _b.map((p) => path.resolve(root, p))) !== null && _c !== void 0 ? _c : [];
    // Process global styles.
    const { entryPoints, noInjectNames, paths: globalStylePaths, } = resolveGlobalStyles(buildOptions.styles, root, !!buildOptions.preserveSymlinks);
    if (noInjectNames.length > 0) {
        // Add plugin to remove hashes from lazy styles.
        extraPlugins.push(new plugins_1.RemoveHashPlugin({ chunkNames: noInjectNames, hashFormat }));
    }
    if (globalStylePaths.some((p) => p.endsWith('.styl'))) {
        wco.logger.warn('Stylus usage is deprecated and will be removed in a future major version. ' +
            'To opt-out of the deprecated behaviour, please migrate to another stylesheet language.');
    }
    const sassImplementation = new sass_service_1.SassWorkerImplementation();
    extraPlugins.push({
        apply(compiler) {
            compiler.hooks.shutdown.tap('sass-worker', () => {
                sassImplementation.close();
            });
        },
    });
    const assetNameTemplate = (0, helpers_1.assetNameTemplateFactory)(hashFormat);
    const extraPostcssPlugins = [];
    // Attempt to setup Tailwind CSS
    // Only load Tailwind CSS plugin if configuration file was found.
    // This acts as a guard to ensure the project actually wants to use Tailwind CSS.
    // The package may be unknowningly present due to a third-party transitive package dependency.
    const tailwindConfigPath = getTailwindConfigPath(wco);
    if (tailwindConfigPath) {
        let tailwindPackagePath;
        try {
            tailwindPackagePath = require.resolve('tailwindcss', { paths: [wco.root] });
        }
        catch (_d) {
            const relativeTailwindConfigPath = path.relative(wco.root, tailwindConfigPath);
            wco.logger.warn(`Tailwind CSS configuration file found (${relativeTailwindConfigPath})` +
                ` but the 'tailwindcss' package is not installed.` +
                ` To enable Tailwind CSS, please install the 'tailwindcss' package.`);
        }
        if (tailwindPackagePath) {
            extraPostcssPlugins.push(require(tailwindPackagePath)({ config: tailwindConfigPath }));
        }
    }
    const postcssPresetEnvPlugin = postcssPresetEnv({
        browsers: buildOptions.supportedBrowsers,
        autoprefixer: true,
        stage: 3,
    });
    const postcssOptionsCreator = (inlineSourcemaps, extracted) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const optionGenerator = (loader) => ({
            map: inlineSourcemaps
                ? {
                    inline: true,
                    annotation: false,
                }
                : undefined,
            plugins: [
                postcssImports({
                    resolve: (url) => (url.startsWith('~') ? url.slice(1) : url),
                    load: (filename) => {
                        return new Promise((resolve, reject) => {
                            loader.fs.readFile(filename, (err, data) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                const content = data.toString();
                                resolve(content);
                            });
                        });
                    },
                }),
                (0, plugins_1.PostcssCliResources)({
                    baseHref: buildOptions.baseHref,
                    deployUrl: buildOptions.deployUrl,
                    resourcesOutputPath: buildOptions.resourcesOutputPath,
                    loader,
                    filename: assetNameTemplate,
                    emitFile: buildOptions.platform !== 'server',
                    extracted,
                }),
                ...extraPostcssPlugins,
                postcssPresetEnvPlugin,
            ],
        });
        // postcss-loader fails when trying to determine configuration files for data URIs
        optionGenerator.config = false;
        return optionGenerator;
    };
    // load component css as raw strings
    const componentsSourceMap = !!(cssSourceMap &&
        // Never use component css sourcemap when style optimizations are on.
        // It will just increase bundle size without offering good debug experience.
        !buildOptions.optimization.styles.minify &&
        // Inline all sourcemap types except hidden ones, which are the same as no sourcemaps
        // for component css.
        !buildOptions.sourceMap.hidden);
    // extract global css from js files into own css file.
    extraPlugins.push(new mini_css_extract_plugin_1.default({ filename: `[name]${hashFormat.extract}.css` }));
    if (!buildOptions.hmr) {
        // don't remove `.js` files for `.css` when we are using HMR these contain HMR accept codes.
        // suppress empty .js files in css only entry points.
        extraPlugins.push(new plugins_1.SuppressExtractedTextChunksWebpackPlugin());
    }
    const postCss = require('postcss');
    const postCssLoaderPath = require.resolve('postcss-loader');
    const componentStyleLoaders = [
        {
            loader: postCssLoaderPath,
            options: {
                implementation: postCss,
                postcssOptions: postcssOptionsCreator(componentsSourceMap, false),
            },
        },
    ];
    const globalStyleLoaders = [
        {
            loader: mini_css_extract_plugin_1.default.loader,
        },
        {
            loader: require.resolve('css-loader'),
            options: {
                url: false,
                sourceMap: !!cssSourceMap,
            },
        },
        {
            loader: postCssLoaderPath,
            options: {
                implementation: postCss,
                postcssOptions: postcssOptionsCreator(false, true),
                sourceMap: !!cssSourceMap,
            },
        },
    ];
    const styleLanguages = [
        {
            extensions: ['css'],
            use: [],
        },
        {
            extensions: ['scss'],
            use: [
                {
                    loader: require.resolve('resolve-url-loader'),
                    options: {
                        sourceMap: cssSourceMap,
                    },
                },
                {
                    loader: require.resolve('sass-loader'),
                    options: {
                        implementation: sassImplementation,
                        sourceMap: true,
                        sassOptions: {
                            // Prevent use of `fibers` package as it no longer works in newer Node.js versions
                            fiber: false,
                            // bootstrap-sass requires a minimum precision of 8
                            precision: 8,
                            includePaths,
                            // Use expanded as otherwise sass will remove comments that are needed for autoprefixer
                            // Ex: /* autoprefixer grid: autoplace */
                            // See: https://github.com/webpack-contrib/sass-loader/blob/45ad0be17264ceada5f0b4fb87e9357abe85c4ff/src/getSassOptions.js#L68-L70
                            outputStyle: 'expanded',
                            // Silences compiler warnings from 3rd party stylesheets
                            quietDeps: !buildOptions.verbose,
                            verbose: buildOptions.verbose,
                        },
                    },
                },
            ],
        },
        {
            extensions: ['sass'],
            use: [
                {
                    loader: require.resolve('resolve-url-loader'),
                    options: {
                        sourceMap: cssSourceMap,
                    },
                },
                {
                    loader: require.resolve('sass-loader'),
                    options: {
                        implementation: sassImplementation,
                        sourceMap: true,
                        sassOptions: {
                            // Prevent use of `fibers` package as it no longer works in newer Node.js versions
                            fiber: false,
                            indentedSyntax: true,
                            // bootstrap-sass requires a minimum precision of 8
                            precision: 8,
                            includePaths,
                            // Use expanded as otherwise sass will remove comments that are needed for autoprefixer
                            // Ex: /* autoprefixer grid: autoplace */
                            // See: https://github.com/webpack-contrib/sass-loader/blob/45ad0be17264ceada5f0b4fb87e9357abe85c4ff/src/getSassOptions.js#L68-L70
                            outputStyle: 'expanded',
                            // Silences compiler warnings from 3rd party stylesheets
                            quietDeps: !buildOptions.verbose,
                            verbose: buildOptions.verbose,
                        },
                    },
                },
            ],
        },
        {
            extensions: ['less'],
            use: [
                {
                    loader: require.resolve('less-loader'),
                    options: {
                        implementation: require('less'),
                        sourceMap: cssSourceMap,
                        lessOptions: {
                            javascriptEnabled: true,
                            paths: includePaths,
                        },
                    },
                },
            ],
        },
        {
            extensions: ['styl'],
            use: [
                {
                    loader: require.resolve('stylus-loader'),
                    options: {
                        sourceMap: cssSourceMap,
                        stylusOptions: {
                            compress: false,
                            sourceMap: { comment: false },
                            paths: includePaths,
                        },
                    },
                },
            ],
        },
    ];
    return {
        entry: entryPoints,
        module: {
            rules: styleLanguages.map(({ extensions, use }) => ({
                test: new RegExp(`\\.(?:${extensions.join('|')})$`, 'i'),
                rules: [
                    // Setup processing rules for global and component styles
                    {
                        oneOf: [
                            // Global styles are only defined global styles
                            {
                                use: globalStyleLoaders,
                                include: globalStylePaths,
                                resourceQuery: { not: [/\?ngResource/] },
                            },
                            // Component styles are all styles except defined global styles
                            {
                                use: componentStyleLoaders,
                                type: 'asset/source',
                                resourceQuery: /\?ngResource/,
                            },
                        ],
                    },
                    { use },
                ],
            })),
        },
        optimization: {
            minimizer: buildOptions.optimization.styles.minify
                ? [
                    new css_optimizer_plugin_1.CssOptimizerPlugin({
                        supportedBrowsers: buildOptions.supportedBrowsers,
                    }),
                ]
                : undefined,
        },
        plugins: extraPlugins,
    };
}
exports.getStylesConfig = getStylesConfig;
function getTailwindConfigPath({ projectRoot, root }) {
    // A configuration file can exist in the project or workspace root
    // The list of valid config files can be found:
    // https://github.com/tailwindlabs/tailwindcss/blob/8845d112fb62d79815b50b3bae80c317450b8b92/src/util/resolveConfigPath.js#L46-L52
    const tailwindConfigFiles = ['tailwind.config.js', 'tailwind.config.cjs'];
    for (const basePath of [projectRoot, root]) {
        for (const configFile of tailwindConfigFiles) {
            // Irrespective of the name project level configuration should always take precedence.
            const fullPath = path.join(basePath, configFile);
            if (fs.existsSync(fullPath)) {
                return fullPath;
            }
        }
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHVDQUF5QjtBQUN6QixzRkFBMkQ7QUFDM0QsMkNBQTZCO0FBRzdCLDBEQUFtRTtBQUVuRSx3Q0FLb0I7QUFDcEIsMEVBQXFFO0FBQ3JFLDhDQUkwQjtBQUUxQixTQUFnQixtQkFBbUIsQ0FDakMsZ0JBQWdDLEVBQ2hDLElBQVksRUFDWixnQkFBeUIsRUFDekIsY0FBYyxHQUFHLEtBQUs7SUFFdEIsTUFBTSxXQUFXLEdBQTZCLEVBQUUsQ0FBQztJQUNqRCxNQUFNLGFBQWEsR0FBYSxFQUFFLENBQUM7SUFDbkMsTUFBTSxLQUFLLEdBQWEsRUFBRSxDQUFDO0lBRTNCLElBQUksZ0JBQWdCLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtRQUNqQyxPQUFPLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsQ0FBQztLQUM5QztJQUVELEtBQUssTUFBTSxLQUFLLElBQUksSUFBQSxtQ0FBeUIsRUFBQyxnQkFBZ0IsRUFBRSxRQUFRLENBQUMsRUFBRTtRQUN6RSxJQUFJLGNBQWMsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQ2pDLElBQUksQ0FBQyxjQUFjLEVBQUU7WUFDbkIsY0FBYyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1lBQ3BELElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxFQUFFO2dCQUNsQyxJQUFJO29CQUNGLGNBQWMsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUs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Q0YsQ0FBQyxDQUFDO1NBQ0o7UUFDRCxZQUFZLEVBQUU7WUFDWixTQUFTLEVBQUUsWUFBWSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsTUFBTTtnQkFDaEQsQ0FBQyxDQUFDO29CQUNFLElBQUkseUNBQWtCLENBQUM7d0JBQ3JCLGlCQUFpQixFQUFFLFlBQVksQ0FBQyxpQkFBaUI7cUJBQ2xELENBQUM7aUJBQ0g7Z0JBQ0gsQ0FBQyxDQUFDLFNBQVM7U0FDZDtRQUNELE9BQU8sRUFBRSxZQUFZO0tBQ3RCLENBQUM7QUFDSixDQUFDO0FBalVELDBDQWlVQztBQUVELFNBQVMscUJBQXFCLENBQUMsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUF3QjtJQUN4RSxrRUFBa0U7SUFDbEUsK0NBQStDO0lBQy9DLGtJQUFrSTtJQUNsSSxNQUFNLG1CQUFtQixHQUFHLENBQUMsb0JBQW9CLEVBQUUscUJBQXFCLENBQUMsQ0FBQztJQUMxRSxLQUFLLE1BQU0sUUFBUSxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxFQUFFO1FBQzFDLEtBQUssTUFBTSxVQUFVLElBQUksbUJBQW1CLEVBQUU7WUFDNUMsc0ZBQXNGO1lBQ3RGLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQ2pELElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDM0IsT0FBTyxRQUFRLENBQUM7YUFDakI7U0FDRjtLQUNGO0lBRUQsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgTWluaUNzc0V4dHJhY3RQbHVnaW4gZnJvbSAnbWluaS1jc3MtZXh0cmFjdC1wbHVnaW4nO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb24sIFJ1bGVTZXRVc2VJdGVtIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBTdHlsZUVsZW1lbnQgfSBmcm9tICcuLi8uLi9idWlsZGVycy9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBTYXNzV29ya2VySW1wbGVtZW50YXRpb24gfSBmcm9tICcuLi8uLi9zYXNzL3Nhc3Mtc2VydmljZSc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHtcbiAgQW55Q29tcG9uZW50U3R5bGVCdWRnZXRDaGVja2VyLFxuICBQb3N0Y3NzQ2xpUmVzb3VyY2VzLFxuICBSZW1vdmVIYXNoUGx1Z2luLFxuICBTdXBwcmVzc0V4dHJhY3RlZFRleHRDaHVua3NXZWJwYWNrUGx1Z2luLFxufSBmcm9tICcuLi9wbHVnaW5zJztcbmltcG9ydCB7IENzc09wdGltaXplclBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvY3NzLW9wdGltaXplci1wbHVnaW4nO1xuaW1wb3J0IHtcbiAgYXNzZXROYW1lVGVtcGxhdGVGYWN0b3J5LFxuICBnZXRPdXRwdXRIYXNoRm9ybWF0LFxuICBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzLFxufSBmcm9tICcuLi91dGlscy9oZWxwZXJzJztcblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVHbG9iYWxTdHlsZXMoXG4gIHN0eWxlRW50cnlwb2ludHM6IFN0eWxlRWxlbWVudFtdLFxuICByb290OiBzdHJpbmcsXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4sXG4gIHNraXBSZXNvbHV0aW9uID0gZmFsc2UsXG4pOiB7IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT47IG5vSW5qZWN0TmFtZXM6IHN0cmluZ1tdOyBwYXRoczogc3RyaW5nW10gfSB7XG4gIGNvbnN0IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7fTtcbiAgY29uc3Qgbm9JbmplY3ROYW1lczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgcGF0aHM6IHN0cmluZ1tdID0gW107XG5cbiAgaWYgKHN0eWxlRW50cnlwb2ludHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHsgZW50cnlQb2ludHMsIG5vSW5qZWN0TmFtZXMsIHBhdGhzIH07XG4gIH1cblxuICBmb3IgKGNvbnN0IHN0eWxlIG9mIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoc3R5bGVFbnRyeXBvaW50cywgJ3N0eWxlcycpKSB7XG4gICAgbGV0IHN0eWxlc2hlZXRQYXRoID0gc3R5bGUuaW5wdXQ7XG4gICAgaWYgKCFza2lwUmVzb2x1dGlvbikge1xuICAgICAgc3R5bGVzaGVldFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgc3R5bGVzaGVldFBhdGgpO1xuICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHN0eWxlc2hlZXRQYXRoKSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHN0eWxlc2hlZXRQYXRoID0gcmVxdWlyZS5yZXNvbHZlKHN0eWxlLmlucHV0LCB7IHBhdGhzOiBbcm9vdF0gfSk7XG4gICAgICAgIH0gY2F0Y2gge31cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXByZXNlcnZlU3ltbGlua3MpIHtcbiAgICAgIHN0eWxlc2hlZXRQYXRoID0gZnMucmVhbHBhdGhTeW5jKHN0eWxlc2hlZXRQYXRoKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgc3R5bGUgZW50cnkgcG9pbnRzLlxuICAgIGlmIChlbnRyeVBvaW50c1tzdHlsZS5idW5kbGVOYW1lXSkge1xuICAgICAgZW50cnlQb2ludHNbc3R5bGUuYnVuZGxlTmFtZV0ucHVzaChzdHlsZXNoZWV0UGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVudHJ5UG9pbnRzW3N0eWxlLmJ1bmRsZU5hbWVdID0gW3N0eWxlc2hlZXRQYXRoXTtcbiAgICB9XG5cbiAgICAvLyBBZGQgbm9uIGluamVjdGVkIHN0eWxlcyB0byB0aGUgbGlzdC5cbiAgICBpZiAoIXN0eWxlLmluamVjdCkge1xuICAgICAgbm9JbmplY3ROYW1lcy5wdXNoKHN0eWxlLmJ1bmRsZU5hbWUpO1xuICAgIH1cblxuICAgIC8vIEFkZCBnbG9iYWwgY3NzIHBhdGhzLlxuICAgIHBhdGhzLnB1c2goc3R5bGVzaGVldFBhdGgpO1xuICB9XG5cbiAgcmV0dXJuIHsgZW50cnlQb2ludHMsIG5vSW5qZWN0TmFtZXMsIHBhdGhzIH07XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3R5bGVzQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpOiBDb25maWd1cmF0aW9uIHtcbiAgY29uc3QgcG9zdGNzc0ltcG9ydHMgPSByZXF1aXJlKCdwb3N0Y3NzLWltcG9ydCcpO1xuICBjb25zdCBwb3N0Y3NzUHJlc2V0RW52OiB0eXBlb2YgaW1wb3J0KCdwb3N0Y3NzLXByZXNldC1lbnYnKSA9IHJlcXVpcmUoJ3Bvc3Rjc3MtcHJlc2V0LWVudicpO1xuXG4gIGNvbnN0IHsgcm9vdCwgYnVpbGRPcHRpb25zIH0gPSB3Y287XG4gIGNvbnN0IGV4dHJhUGx1Z2luczogQ29uZmlndXJhdGlvblsncGx1Z2lucyddID0gW107XG5cbiAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IEFueUNvbXBvbmVudFN0eWxlQnVkZ2V0Q2hlY2tlcihidWlsZE9wdGlvbnMuYnVkZ2V0cykpO1xuXG4gIGNvbnN0IGNzc1NvdXJjZU1hcCA9IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAuc3R5bGVzO1xuXG4gIC8vIERldGVybWluZSBoYXNoaW5nIGZvcm1hdC5cbiAgY29uc3QgaGFzaEZvcm1hdCA9IGdldE91dHB1dEhhc2hGb3JtYXQoYnVpbGRPcHRpb25zLm91dHB1dEhhc2hpbmcpO1xuXG4gIC8vIHVzZSBpbmNsdWRlUGF0aHMgZnJvbSBhcHBDb25maWdcbiAgY29uc3QgaW5jbHVkZVBhdGhzID1cbiAgICBidWlsZE9wdGlvbnMuc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zPy5pbmNsdWRlUGF0aHM/Lm1hcCgocCkgPT4gcGF0aC5yZXNvbHZlKHJvb3QsIHApKSA/PyBbXTtcblxuICAvLyBQcm9jZXNzIGdsb2JhbCBzdHlsZXMuXG4gIGNvbnN0IHtcbiAgICBlbnRyeVBvaW50cyxcbiAgICBub0luamVjdE5hbWVzLFxuICAgIHBhdGhzOiBnbG9iYWxTdHlsZVBhdGhzLFxuICB9ID0gcmVzb2x2ZUdsb2JhbFN0eWxlcyhidWlsZE9wdGlvbnMuc3R5bGVzLCByb290LCAhIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzKTtcbiAgaWYgKG5vSW5qZWN0TmFtZXMubGVuZ3RoID4gMCkge1xuICAgIC8vIEFkZCBwbHVnaW4gdG8gcmVtb3ZlIGhhc2hlcyBmcm9tIGxhenkgc3R5bGVzLlxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBSZW1vdmVIYXNoUGx1Z2luKHsgY2h1bmtOYW1lczogbm9JbmplY3ROYW1lcywgaGFzaEZvcm1hdCB9KSk7XG4gIH1cblxuICBpZiAoZ2xvYmFsU3R5bGVQYXRocy5zb21lKChwKSA9PiBwLmVuZHNXaXRoKCcuc3R5bCcpKSkge1xuICAgIHdjby5sb2dnZXIud2FybihcbiAgICAgICdTdHlsdXMgdXNhZ2UgaXMgZGVwcmVjYXRlZCBhbmQgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIG1ham9yIHZlcnNpb24uICcgK1xuICAgICAgICAnVG8gb3B0LW91dCBvZiB0aGUgZGVwcmVjYXRlZCBiZWhhdmlvdXIsIHBsZWFzZSBtaWdyYXRlIHRvIGFub3RoZXIgc3R5bGVzaGVldCBsYW5ndWFnZS4nLFxuICAgICk7XG4gIH1cblxuICBjb25zdCBzYXNzSW1wbGVtZW50YXRpb24gPSBuZXcgU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uKCk7XG4gIGV4dHJhUGx1Z2lucy5wdXNoKHtcbiAgICBhcHBseShjb21waWxlcikge1xuICAgICAgY29tcGlsZXIuaG9va3Muc2h1dGRvd24udGFwKCdzYXNzLXdvcmtlcicsICgpID0+IHtcbiAgICAgICAgc2Fzc0ltcGxlbWVudGF0aW9uLmNsb3NlKCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9KTtcblxuICBjb25zdCBhc3NldE5hbWVUZW1wbGF0ZSA9IGFzc2V0TmFtZVRlbXBsYXRlRmFjdG9yeShoYXNoRm9ybWF0KTtcblxuICBjb25zdCBleHRyYVBvc3Rjc3NQbHVnaW5zOiBpbXBvcnQoJ3Bvc3Rjc3MnKS5QbHVnaW5bXSA9IFtdO1xuXG4gIC8vIEF0dGVtcHQgdG8gc2V0dXAgVGFpbHdpbmQgQ1NTXG4gIC8vIE9ubHkgbG9hZCBUYWlsd2luZCBDU1MgcGx1Z2luIGlmIGNvbmZpZ3VyYXRpb24gZmlsZSB3YXMgZm91bmQuXG4gIC8vIFRoaXMgYWN0cyBhcyBhIGd1YXJkIHRvIGVuc3VyZSB0aGUgcHJvamVjdCBhY3R1YWxseSB3YW50cyB0byB1c2UgVGFpbHdpbmQgQ1NTLlxuICAvLyBUaGUgcGFja2FnZSBtYXkgYmUgdW5rbm93bmluZ2x5IHByZXNlbnQgZHVlIHRvIGEgdGhpcmQtcGFydHkgdHJhbnNpdGl2ZSBwYWNrYWdlIGRlcGVuZGVuY3kuXG4gIGNvbnN0IHRhaWx3aW5kQ29uZmlnUGF0aCA9IGdldFRhaWx3aW5kQ29uZmlnUGF0aCh3Y28pO1xuICBpZiAodGFpbHdpbmRDb25maWdQYXRoKSB7XG4gICAgbGV0IHRhaWx3aW5kUGFja2FnZVBhdGg7XG4gICAgdHJ5IHtcbiAgICAgIHRhaWx3aW5kUGFja2FnZVBhdGggPSByZXF1aXJlLnJlc29sdmUoJ3RhaWx3aW5kY3NzJywgeyBwYXRoczogW3djby5yb290XSB9KTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGNvbnN0IHJlbGF0aXZlVGFpbHdpbmRDb25maWdQYXRoID0gcGF0aC5yZWxhdGl2ZSh3Y28ucm9vdCwgdGFpbHdpbmRDb25maWdQYXRoKTtcbiAgICAgIHdjby5sb2dnZXIud2FybihcbiAgICAgICAgYFRhaWx3aW5kIENTUyBjb25maWd1cmF0aW9uIGZpbGUgZm91bmQgKCR7cmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGh9KWAgK1xuICAgICAgICAgIGAgYnV0IHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UgaXMgbm90IGluc3RhbGxlZC5gICtcbiAgICAgICAgICBgIFRvIGVuYWJsZSBUYWlsd2luZCBDU1MsIHBsZWFzZSBpbnN0YWxsIHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UuYCxcbiAgICAgICk7XG4gICAgfVxuICAgIGlmICh0YWlsd2luZFBhY2thZ2VQYXRoKSB7XG4gICAgICBleHRyYVBvc3Rjc3NQbHVnaW5zLnB1c2gocmVxdWlyZSh0YWlsd2luZFBhY2thZ2VQYXRoKSh7IGNvbmZpZzogdGFpbHdpbmRDb25maWdQYXRoIH0pKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBwb3N0Y3NzUHJlc2V0RW52UGx1Z2luID0gcG9zdGNzc1ByZXNldEVudih7XG4gICAgYnJvd3NlcnM6IGJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2VycyxcbiAgICBhdXRvcHJlZml4ZXI6IHRydWUsXG4gICAgc3RhZ2U6IDMsXG4gIH0pO1xuICBjb25zdCBwb3N0Y3NzT3B0aW9uc0NyZWF0b3IgPSAoaW5saW5lU291cmNlbWFwczogYm9vbGVhbiwgZXh0cmFjdGVkOiBib29sZWFuKSA9PiB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBjb25zdCBvcHRpb25HZW5lcmF0b3IgPSAobG9hZGVyOiBhbnkpID0+ICh7XG4gICAgICBtYXA6IGlubGluZVNvdXJjZW1hcHNcbiAgICAgICAgPyB7XG4gICAgICAgICAgICBpbmxpbmU6IHRydWUsXG4gICAgICAgICAgICBhbm5vdGF0aW9uOiBmYWxzZSxcbiAgICAgICAgICB9XG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgcGx1Z2luczogW1xuICAgICAgICBwb3N0Y3NzSW1wb3J0cyh7XG4gICAgICAgICAgcmVzb2x2ZTogKHVybDogc3RyaW5nKSA9PiAodXJsLnN0YXJ0c1dpdGgoJ34nKSA/IHVybC5zbGljZSgxKSA6IHVybCksXG4gICAgICAgICAgbG9hZDogKGZpbGVuYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgbG9hZGVyLmZzLnJlYWRGaWxlKGZpbGVuYW1lLCAoZXJyOiBFcnJvciwgZGF0YTogQnVmZmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoY29udGVudCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICAgIFBvc3Rjc3NDbGlSZXNvdXJjZXMoe1xuICAgICAgICAgIGJhc2VIcmVmOiBidWlsZE9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgICAgZGVwbG95VXJsOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgICAgIHJlc291cmNlc091dHB1dFBhdGg6IGJ1aWxkT3B0aW9ucy5yZXNvdXJjZXNPdXRwdXRQYXRoLFxuICAgICAgICAgIGxvYWRlcixcbiAgICAgICAgICBmaWxlbmFtZTogYXNzZXROYW1lVGVtcGxhdGUsXG4gICAgICAgICAgZW1pdEZpbGU6IGJ1aWxkT3B0aW9ucy5wbGF0Zm9ybSAhPT0gJ3NlcnZlcicsXG4gICAgICAgICAgZXh0cmFjdGVkLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uZXh0cmFQb3N0Y3NzUGx1Z2lucyxcbiAgICAgICAgcG9zdGNzc1ByZXNldEVudlBsdWdpbixcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgLy8gcG9zdGNzcy1sb2FkZXIgZmFpbHMgd2hlbiB0cnlpbmcgdG8gZGV0ZXJtaW5lIGNvbmZpZ3VyYXRpb24gZmlsZXMgZm9yIGRhdGEgVVJJc1xuICAgIG9wdGlvbkdlbmVyYXRvci5jb25maWcgPSBmYWxzZTtcblxuICAgIHJldHVybiBvcHRpb25HZW5lcmF0b3I7XG4gIH07XG5cbiAgLy8gbG9hZCBjb21wb25lbnQgY3NzIGFzIHJhdyBzdHJpbmdzXG4gIGNvbnN0IGNvbXBvbmVudHNTb3VyY2VNYXAgPSAhIShcbiAgICBjc3NTb3VyY2VNYXAgJiZcbiAgICAvLyBOZXZlciB1c2UgY29tcG9uZW50IGNzcyBzb3VyY2VtYXAgd2hlbiBzdHlsZSBvcHRpbWl6YXRpb25zIGFyZSBvbi5cbiAgICAvLyBJdCB3aWxsIGp1c3QgaW5jcmVhc2UgYnVuZGxlIHNpemUgd2l0aG91dCBvZmZlcmluZyBnb29kIGRlYnVnIGV4cGVyaWVuY2UuXG4gICAgIWJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24uc3R5bGVzLm1pbmlmeSAmJlxuICAgIC8vIElubGluZSBhbGwgc291cmNlbWFwIHR5cGVzIGV4Y2VwdCBoaWRkZW4gb25lcywgd2hpY2ggYXJlIHRoZSBzYW1lIGFzIG5vIHNvdXJjZW1hcHNcbiAgICAvLyBmb3IgY29tcG9uZW50IGNzcy5cbiAgICAhYnVpbGRPcHRpb25zLnNvdXJjZU1hcC5oaWRkZW5cbiAgKTtcblxuICAvLyBleHRyYWN0IGdsb2JhbCBjc3MgZnJvbSBqcyBmaWxlcyBpbnRvIG93biBjc3MgZmlsZS5cbiAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IE1pbmlDc3NFeHRyYWN0UGx1Z2luKHsgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuZXh0cmFjdH0uY3NzYCB9KSk7XG5cbiAgaWYgKCFidWlsZE9wdGlvbnMuaG1yKSB7XG4gICAgLy8gZG9uJ3QgcmVtb3ZlIGAuanNgIGZpbGVzIGZvciBgLmNzc2Agd2hlbiB3ZSBhcmUgdXNpbmcgSE1SIHRoZXNlIGNvbnRhaW4gSE1SIGFjY2VwdCBjb2Rlcy5cbiAgICAvLyBzdXBwcmVzcyBlbXB0eSAuanMgZmlsZXMgaW4gY3NzIG9ubHkgZW50cnkgcG9pbnRzLlxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBTdXBwcmVzc0V4dHJhY3RlZFRleHRDaHVua3NXZWJwYWNrUGx1Z2luKCkpO1xuICB9XG5cbiAgY29uc3QgcG9zdENzcyA9IHJlcXVpcmUoJ3Bvc3Rjc3MnKTtcbiAgY29uc3QgcG9zdENzc0xvYWRlclBhdGggPSByZXF1aXJlLnJlc29sdmUoJ3Bvc3Rjc3MtbG9hZGVyJyk7XG5cbiAgY29uc3QgY29tcG9uZW50U3R5bGVMb2FkZXJzOiBSdWxlU2V0VXNlSXRlbVtdID0gW1xuICAgIHtcbiAgICAgIGxvYWRlcjogcG9zdENzc0xvYWRlclBhdGgsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBwb3N0Q3NzLFxuICAgICAgICBwb3N0Y3NzT3B0aW9uczogcG9zdGNzc09wdGlvbnNDcmVhdG9yKGNvbXBvbmVudHNTb3VyY2VNYXAsIGZhbHNlKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgXTtcblxuICBjb25zdCBnbG9iYWxTdHlsZUxvYWRlcnM6IFJ1bGVTZXRVc2VJdGVtW10gPSBbXG4gICAge1xuICAgICAgbG9hZGVyOiBNaW5pQ3NzRXh0cmFjdFBsdWdpbi5sb2FkZXIsXG4gICAgfSxcbiAgICB7XG4gICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnY3NzLWxvYWRlcicpLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICB1cmw6IGZhbHNlLFxuICAgICAgICBzb3VyY2VNYXA6ICEhY3NzU291cmNlTWFwLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGxvYWRlcjogcG9zdENzc0xvYWRlclBhdGgsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBwb3N0Q3NzLFxuICAgICAgICBwb3N0Y3NzT3B0aW9uczogcG9zdGNzc09wdGlvbnNDcmVhdG9yKGZhbHNlLCB0cnVlKSxcbiAgICAgICAgc291cmNlTWFwOiAhIWNzc1NvdXJjZU1hcCxcbiAgICAgIH0sXG4gICAgfSxcbiAgXTtcblxuICBjb25zdCBzdHlsZUxhbmd1YWdlczoge1xuICAgIGV4dGVuc2lvbnM6IHN0cmluZ1tdO1xuICAgIHVzZTogUnVsZVNldFVzZUl0ZW1bXTtcbiAgfVtdID0gW1xuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnY3NzJ10sXG4gICAgICB1c2U6IFtdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydzY3NzJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdyZXNvbHZlLXVybC1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Nhc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgaW1wbGVtZW50YXRpb246IHNhc3NJbXBsZW1lbnRhdGlvbixcbiAgICAgICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcbiAgICAgICAgICAgIHNhc3NPcHRpb25zOiB7XG4gICAgICAgICAgICAgIC8vIFByZXZlbnQgdXNlIG9mIGBmaWJlcnNgIHBhY2thZ2UgYXMgaXQgbm8gbG9uZ2VyIHdvcmtzIGluIG5ld2VyIE5vZGUuanMgdmVyc2lvbnNcbiAgICAgICAgICAgICAgZmliZXI6IGZhbHNlLFxuICAgICAgICAgICAgICAvLyBib290c3RyYXAtc2FzcyByZXF1aXJlcyBhIG1pbmltdW0gcHJlY2lzaW9uIG9mIDhcbiAgICAgICAgICAgICAgcHJlY2lzaW9uOiA4LFxuICAgICAgICAgICAgICBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICAgIC8vIFVzZSBleHBhbmRlZCBhcyBvdGhlcndpc2Ugc2FzcyB3aWxsIHJlbW92ZSBjb21tZW50cyB0aGF0IGFyZSBuZWVkZWQgZm9yIGF1dG9wcmVmaXhlclxuICAgICAgICAgICAgICAvLyBFeDogLyogYXV0b3ByZWZpeGVyIGdyaWQ6IGF1dG9wbGFjZSAqL1xuICAgICAgICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc2Fzcy1sb2FkZXIvYmxvYi80NWFkMGJlMTcyNjRjZWFkYTVmMGI0ZmI4N2U5MzU3YWJlODVjNGZmL3NyYy9nZXRTYXNzT3B0aW9ucy5qcyNMNjgtTDcwXG4gICAgICAgICAgICAgIG91dHB1dFN0eWxlOiAnZXhwYW5kZWQnLFxuICAgICAgICAgICAgICAvLyBTaWxlbmNlcyBjb21waWxlciB3YXJuaW5ncyBmcm9tIDNyZCBwYXJ0eSBzdHlsZXNoZWV0c1xuICAgICAgICAgICAgICBxdWlldERlcHM6ICFidWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgICAgICAgdmVyYm9zZTogYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydzYXNzJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdyZXNvbHZlLXVybC1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Nhc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgaW1wbGVtZW50YXRpb246IHNhc3NJbXBsZW1lbnRhdGlvbixcbiAgICAgICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcbiAgICAgICAgICAgIHNhc3NPcHRpb25zOiB7XG4gICAgICAgICAgICAgIC8vIFByZXZlbnQgdXNlIG9mIGBmaWJlcnNgIHBhY2thZ2UgYXMgaXQgbm8gbG9uZ2VyIHdvcmtzIGluIG5ld2VyIE5vZGUuanMgdmVyc2lvbnNcbiAgICAgICAgICAgICAgZmliZXI6IGZhbHNlLFxuICAgICAgICAgICAgICBpbmRlbnRlZFN5bnRheDogdHJ1ZSxcbiAgICAgICAgICAgICAgLy8gYm9vdHN0cmFwLXNhc3MgcmVxdWlyZXMgYSBtaW5pbXVtIHByZWNpc2lvbiBvZiA4XG4gICAgICAgICAgICAgIHByZWNpc2lvbjogOCxcbiAgICAgICAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgICAvLyBVc2UgZXhwYW5kZWQgYXMgb3RoZXJ3aXNlIHNhc3Mgd2lsbCByZW1vdmUgY29tbWVudHMgdGhhdCBhcmUgbmVlZGVkIGZvciBhdXRvcHJlZml4ZXJcbiAgICAgICAgICAgICAgLy8gRXg6IC8qIGF1dG9wcmVmaXhlciBncmlkOiBhdXRvcGxhY2UgKi9cbiAgICAgICAgICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3Nhc3MtbG9hZGVyL2Jsb2IvNDVhZDBiZTE3MjY0Y2VhZGE1ZjBiNGZiODdlOTM1N2FiZTg1YzRmZi9zcmMvZ2V0U2Fzc09wdGlvbnMuanMjTDY4LUw3MFxuICAgICAgICAgICAgICBvdXRwdXRTdHlsZTogJ2V4cGFuZGVkJyxcbiAgICAgICAgICAgICAgLy8gU2lsZW5jZXMgY29tcGlsZXIgd2FybmluZ3MgZnJvbSAzcmQgcGFydHkgc3R5bGVzaGVldHNcbiAgICAgICAgICAgICAgcXVpZXREZXBzOiAhYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgICAgIHZlcmJvc2U6IGJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnbGVzcyddLFxuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnbGVzcy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBpbXBsZW1lbnRhdGlvbjogcmVxdWlyZSgnbGVzcycpLFxuICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgICBsZXNzT3B0aW9uczoge1xuICAgICAgICAgICAgICBqYXZhc2NyaXB0RW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgcGF0aHM6IGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ3N0eWwnXSxcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3N0eWx1cy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICAgIHN0eWx1c09wdGlvbnM6IHtcbiAgICAgICAgICAgICAgY29tcHJlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICBzb3VyY2VNYXA6IHsgY29tbWVudDogZmFsc2UgfSxcbiAgICAgICAgICAgICAgcGF0aHM6IGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgXTtcblxuICByZXR1cm4ge1xuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBtb2R1bGU6IHtcbiAgICAgIHJ1bGVzOiBzdHlsZUxhbmd1YWdlcy5tYXAoKHsgZXh0ZW5zaW9ucywgdXNlIH0pID0+ICh7XG4gICAgICAgIHRlc3Q6IG5ldyBSZWdFeHAoYFxcXFwuKD86JHtleHRlbnNpb25zLmpvaW4oJ3wnKX0pJGAsICdpJyksXG4gICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAgLy8gU2V0dXAgcHJvY2Vzc2luZyBydWxlcyBmb3IgZ2xvYmFsIGFuZCBjb21wb25lbnQgc3R5bGVzXG4gICAgICAgICAge1xuICAgICAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICAgICAgLy8gR2xvYmFsIHN0eWxlcyBhcmUgb25seSBkZWZpbmVkIGdsb2JhbCBzdHlsZXNcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVzZTogZ2xvYmFsU3R5bGVMb2FkZXJzLFxuICAgICAgICAgICAgICAgIGluY2x1ZGU6IGdsb2JhbFN0eWxlUGF0aHMsXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VRdWVyeTogeyBub3Q6IFsvXFw/bmdSZXNvdXJjZS9dIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXMgYXJlIGFsbCBzdHlsZXMgZXhjZXB0IGRlZmluZWQgZ2xvYmFsIHN0eWxlc1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdXNlOiBjb21wb25lbnRTdHlsZUxvYWRlcnMsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2Fzc2V0L3NvdXJjZScsXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VRdWVyeTogL1xcP25nUmVzb3VyY2UvLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHsgdXNlIH0sXG4gICAgICAgIF0sXG4gICAgICB9KSksXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG1pbmltaXplcjogYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbi5zdHlsZXMubWluaWZ5XG4gICAgICAgID8gW1xuICAgICAgICAgICAgbmV3IENzc09wdGltaXplclBsdWdpbih7XG4gICAgICAgICAgICAgIHN1cHBvcnRlZEJyb3dzZXJzOiBidWlsZE9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdXG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLFxuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRUYWlsd2luZENvbmZpZ1BhdGgoeyBwcm9qZWN0Um9vdCwgcm9vdCB9OiBXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIC8vIEEgY29uZmlndXJhdGlvbiBmaWxlIGNhbiBleGlzdCBpbiB0aGUgcHJvamVjdCBvciB3b3Jrc3BhY2Ugcm9vdFxuICAvLyBUaGUgbGlzdCBvZiB2YWxpZCBjb25maWcgZmlsZXMgY2FuIGJlIGZvdW5kOlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vdGFpbHdpbmRsYWJzL3RhaWx3aW5kY3NzL2Jsb2IvODg0NWQxMTJmYjYyZDc5ODE1YjUwYjNiYWU4MGMzMTc0NTBiOGI5Mi9zcmMvdXRpbC9yZXNvbHZlQ29uZmlnUGF0aC5qcyNMNDYtTDUyXG4gIGNvbnN0IHRhaWx3aW5kQ29uZmlnRmlsZXMgPSBbJ3RhaWx3aW5kLmNvbmZpZy5qcycsICd0YWlsd2luZC5jb25maWcuY2pzJ107XG4gIGZvciAoY29uc3QgYmFzZVBhdGggb2YgW3Byb2plY3RSb290LCByb290XSkge1xuICAgIGZvciAoY29uc3QgY29uZmlnRmlsZSBvZiB0YWlsd2luZENvbmZpZ0ZpbGVzKSB7XG4gICAgICAvLyBJcnJlc3BlY3RpdmUgb2YgdGhlIG5hbWUgcHJvamVjdCBsZXZlbCBjb25maWd1cmF0aW9uIHNob3VsZCBhbHdheXMgdGFrZSBwcmVjZWRlbmNlLlxuICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4oYmFzZVBhdGgsIGNvbmZpZ0ZpbGUpO1xuICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoZnVsbFBhdGgpKSB7XG4gICAgICAgIHJldHVybiBmdWxsUGF0aDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuIl19