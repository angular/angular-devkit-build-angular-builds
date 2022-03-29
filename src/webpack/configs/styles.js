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
exports.getStylesConfig = void 0;
const fs = __importStar(require("fs"));
const mini_css_extract_plugin_1 = __importDefault(require("mini-css-extract-plugin"));
const path = __importStar(require("path"));
const sass_service_1 = require("../../sass/sass-service");
const plugins_1 = require("../plugins");
const css_optimizer_plugin_1 = require("../plugins/css-optimizer-plugin");
const helpers_1 = require("../utils/helpers");
function resolveGlobalStyles(styleEntrypoints, root, preserveSymlinks) {
    const entryPoints = {};
    const noInjectNames = [];
    const paths = [];
    if (styleEntrypoints.length === 0) {
        return { entryPoints, noInjectNames, paths };
    }
    for (const style of (0, helpers_1.normalizeExtraEntryPoints)(styleEntrypoints, 'styles')) {
        let resolvedPath = path.resolve(root, style.input);
        if (!fs.existsSync(resolvedPath)) {
            try {
                resolvedPath = require.resolve(style.input, { paths: [root] });
            }
            catch (_a) { }
        }
        if (!preserveSymlinks) {
            resolvedPath = fs.realpathSync(resolvedPath);
        }
        // Add style entry points.
        if (entryPoints[style.bundleName]) {
            entryPoints[style.bundleName].push(resolvedPath);
        }
        else {
            entryPoints[style.bundleName] = [resolvedPath];
        }
        // Add non injected styles to the list.
        if (!style.inject) {
            noInjectNames.push(style.bundleName);
        }
        // Add global css paths.
        paths.push(resolvedPath);
    }
    return { entryPoints, noInjectNames, paths };
}
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
    // A configuration file can exist in the project or workspace root
    const tailwindConfigFile = 'tailwind.config.js';
    let tailwindConfigPath;
    for (const basePath of [wco.projectRoot, wco.root]) {
        const fullPath = path.join(basePath, tailwindConfigFile);
        if (fs.existsSync(fullPath)) {
            tailwindConfigPath = fullPath;
            break;
        }
    }
    // Only load Tailwind CSS plugin if configuration file was found.
    // This acts as a guard to ensure the project actually wants to use Tailwind CSS.
    // The package may be unknowningly present due to a third-party transitive package dependency.
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
                    resolve: (url) => (url.startsWith('~') ? url.substr(1) : url),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHVDQUF5QjtBQUN6QixzRkFBMkQ7QUFDM0QsMkNBQTZCO0FBRzdCLDBEQUFtRTtBQUVuRSx3Q0FLb0I7QUFDcEIsMEVBQXFFO0FBQ3JFLDhDQUkwQjtBQUUxQixTQUFTLG1CQUFtQixDQUMxQixnQkFBbUMsRUFDbkMsSUFBWSxFQUNaLGdCQUF5QjtJQUV6QixNQUFNLFdBQVcsR0FBNkIsRUFBRSxDQUFDO0lBQ2pELE1BQU0sYUFBYSxHQUFhLEVBQUUsQ0FBQztJQUNuQyxNQUFNLEtBQUssR0FBYSxFQUFFLENBQUM7SUFFM0IsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ2pDLE9BQU8sRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxDQUFDO0tBQzlDO0lBRUQsS0FBSyxNQUFNLEtBQUssSUFBSSxJQUFBLG1DQUF5QixFQUFDLGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxFQUFFO1FBQ3pFLElBQUksWUFBWSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRTtZQUNoQyxJQUFJO2dCQUNGLFlBQVksR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7YUFDaEU7WUFBQyxXQUFNLEdBQUU7U0FDWDtRQUVE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RSxDQUFDLGNBQWMsQ0FBQyxFQUFFOzZCQUN6Qzs0QkFDRCwrREFBK0Q7NEJBQy9EO2dDQUNFLEdBQUcsRUFBRSxxQkFBcUI7Z0NBQzFCLElBQUksRUFBRSxjQUFjOzZCQUNyQjt5QkFDRjtxQkFDRjtvQkFDRCxFQUFFLEdBQUcsRUFBRTtpQkFDUjthQUNGLENBQUMsQ0FBQztTQUNKO1FBQ0QsWUFBWSxFQUFFO1lBQ1osU0FBUyxFQUFFLFlBQVksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLE1BQU07Z0JBQ2hELENBQUMsQ0FBQztvQkFDRSxJQUFJLHlDQUFrQixDQUFDO3dCQUNyQixpQkFBaUIsRUFBRSxZQUFZLENBQUMsaUJBQWlCO3FCQUNsRCxDQUFDO2lCQUNIO2dCQUNILENBQUMsQ0FBQyxTQUFTO1NBQ2Q7UUFDRCxPQUFPLEVBQUUsWUFBWTtLQUN0QixDQUFDO0FBQ0osQ0FBQztBQXpVRCwwQ0F5VUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IE1pbmlDc3NFeHRyYWN0UGx1Z2luIGZyb20gJ21pbmktY3NzLWV4dHJhY3QtcGx1Z2luJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uLCBSdWxlU2V0VXNlSXRlbSB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgRXh0cmFFbnRyeVBvaW50IH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uIH0gZnJvbSAnLi4vLi4vc2Fzcy9zYXNzLXNlcnZpY2UnO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7XG4gIEFueUNvbXBvbmVudFN0eWxlQnVkZ2V0Q2hlY2tlcixcbiAgUG9zdGNzc0NsaVJlc291cmNlcyxcbiAgUmVtb3ZlSGFzaFBsdWdpbixcbiAgU3VwcHJlc3NFeHRyYWN0ZWRUZXh0Q2h1bmtzV2VicGFja1BsdWdpbixcbn0gZnJvbSAnLi4vcGx1Z2lucyc7XG5pbXBvcnQgeyBDc3NPcHRpbWl6ZXJQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL2Nzcy1vcHRpbWl6ZXItcGx1Z2luJztcbmltcG9ydCB7XG4gIGFzc2V0TmFtZVRlbXBsYXRlRmFjdG9yeSxcbiAgZ2V0T3V0cHV0SGFzaEZvcm1hdCxcbiAgbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyxcbn0gZnJvbSAnLi4vdXRpbHMvaGVscGVycyc7XG5cbmZ1bmN0aW9uIHJlc29sdmVHbG9iYWxTdHlsZXMoXG4gIHN0eWxlRW50cnlwb2ludHM6IEV4dHJhRW50cnlQb2ludFtdLFxuICByb290OiBzdHJpbmcsXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4sXG4pOiB7IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT47IG5vSW5qZWN0TmFtZXM6IHN0cmluZ1tdOyBwYXRoczogc3RyaW5nW10gfSB7XG4gIGNvbnN0IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7fTtcbiAgY29uc3Qgbm9JbmplY3ROYW1lczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgcGF0aHM6IHN0cmluZ1tdID0gW107XG5cbiAgaWYgKHN0eWxlRW50cnlwb2ludHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHsgZW50cnlQb2ludHMsIG5vSW5qZWN0TmFtZXMsIHBhdGhzIH07XG4gIH1cblxuICBmb3IgKGNvbnN0IHN0eWxlIG9mIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoc3R5bGVFbnRyeXBvaW50cywgJ3N0eWxlcycpKSB7XG4gICAgbGV0IHJlc29sdmVkUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBzdHlsZS5pbnB1dCk7XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKHJlc29sdmVkUGF0aCkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJlc29sdmVkUGF0aCA9IHJlcXVpcmUucmVzb2x2ZShzdHlsZS5pbnB1dCwgeyBwYXRoczogW3Jvb3RdIH0pO1xuICAgICAgfSBjYXRjaCB7fVxuICAgIH1cblxuICAgIGlmICghcHJlc2VydmVTeW1saW5rcykge1xuICAgICAgcmVzb2x2ZWRQYXRoID0gZnMucmVhbHBhdGhTeW5jKHJlc29sdmVkUGF0aCk7XG4gICAgfVxuXG4gICAgLy8gQWRkIHN0eWxlIGVudHJ5IHBvaW50cy5cbiAgICBpZiAoZW50cnlQb2ludHNbc3R5bGUuYnVuZGxlTmFtZV0pIHtcbiAgICAgIGVudHJ5UG9pbnRzW3N0eWxlLmJ1bmRsZU5hbWVdLnB1c2gocmVzb2x2ZWRQYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZW50cnlQb2ludHNbc3R5bGUuYnVuZGxlTmFtZV0gPSBbcmVzb2x2ZWRQYXRoXTtcbiAgICB9XG5cbiAgICAvLyBBZGQgbm9uIGluamVjdGVkIHN0eWxlcyB0byB0aGUgbGlzdC5cbiAgICBpZiAoIXN0eWxlLmluamVjdCkge1xuICAgICAgbm9JbmplY3ROYW1lcy5wdXNoKHN0eWxlLmJ1bmRsZU5hbWUpO1xuICAgIH1cblxuICAgIC8vIEFkZCBnbG9iYWwgY3NzIHBhdGhzLlxuICAgIHBhdGhzLnB1c2gocmVzb2x2ZWRQYXRoKTtcbiAgfVxuXG4gIHJldHVybiB7IGVudHJ5UG9pbnRzLCBub0luamVjdE5hbWVzLCBwYXRocyB9O1xufVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGdldFN0eWxlc0NvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKTogQ29uZmlndXJhdGlvbiB7XG4gIGNvbnN0IHBvc3Rjc3NJbXBvcnRzID0gcmVxdWlyZSgncG9zdGNzcy1pbXBvcnQnKTtcbiAgY29uc3QgcG9zdGNzc1ByZXNldEVudjogdHlwZW9mIGltcG9ydCgncG9zdGNzcy1wcmVzZXQtZW52JykgPSByZXF1aXJlKCdwb3N0Y3NzLXByZXNldC1lbnYnKTtcblxuICBjb25zdCB7IHJvb3QsIGJ1aWxkT3B0aW9ucyB9ID0gd2NvO1xuICBjb25zdCBleHRyYVBsdWdpbnM6IENvbmZpZ3VyYXRpb25bJ3BsdWdpbnMnXSA9IFtdO1xuXG4gIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBBbnlDb21wb25lbnRTdHlsZUJ1ZGdldENoZWNrZXIoYnVpbGRPcHRpb25zLmJ1ZGdldHMpKTtcblxuICBjb25zdCBjc3NTb3VyY2VNYXAgPSBidWlsZE9wdGlvbnMuc291cmNlTWFwLnN0eWxlcztcblxuICAvLyBEZXRlcm1pbmUgaGFzaGluZyBmb3JtYXQuXG4gIGNvbnN0IGhhc2hGb3JtYXQgPSBnZXRPdXRwdXRIYXNoRm9ybWF0KGJ1aWxkT3B0aW9ucy5vdXRwdXRIYXNoaW5nKTtcblxuICAvLyB1c2UgaW5jbHVkZVBhdGhzIGZyb20gYXBwQ29uZmlnXG4gIGNvbnN0IGluY2x1ZGVQYXRocyA9XG4gICAgYnVpbGRPcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucz8uaW5jbHVkZVBhdGhzPy5tYXAoKHApID0+IHBhdGgucmVzb2x2ZShyb290LCBwKSkgPz8gW107XG5cbiAgLy8gUHJvY2VzcyBnbG9iYWwgc3R5bGVzLlxuICBjb25zdCB7XG4gICAgZW50cnlQb2ludHMsXG4gICAgbm9JbmplY3ROYW1lcyxcbiAgICBwYXRoczogZ2xvYmFsU3R5bGVQYXRocyxcbiAgfSA9IHJlc29sdmVHbG9iYWxTdHlsZXMoYnVpbGRPcHRpb25zLnN0eWxlcywgcm9vdCwgISFidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyk7XG4gIGlmIChub0luamVjdE5hbWVzLmxlbmd0aCA+IDApIHtcbiAgICAvLyBBZGQgcGx1Z2luIHRvIHJlbW92ZSBoYXNoZXMgZnJvbSBsYXp5IHN0eWxlcy5cbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgUmVtb3ZlSGFzaFBsdWdpbih7IGNodW5rTmFtZXM6IG5vSW5qZWN0TmFtZXMsIGhhc2hGb3JtYXQgfSkpO1xuICB9XG5cbiAgaWYgKGdsb2JhbFN0eWxlUGF0aHMuc29tZSgocCkgPT4gcC5lbmRzV2l0aCgnLnN0eWwnKSkpIHtcbiAgICB3Y28ubG9nZ2VyLndhcm4oXG4gICAgICAnU3R5bHVzIHVzYWdlIGlzIGRlcHJlY2F0ZWQgYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSBtYWpvciB2ZXJzaW9uLiAnICtcbiAgICAgICAgJ1RvIG9wdC1vdXQgb2YgdGhlIGRlcHJlY2F0ZWQgYmVoYXZpb3VyLCBwbGVhc2UgbWlncmF0ZSB0byBhbm90aGVyIHN0eWxlc2hlZXQgbGFuZ3VhZ2UuJyxcbiAgICApO1xuICB9XG5cbiAgY29uc3Qgc2Fzc0ltcGxlbWVudGF0aW9uID0gbmV3IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbigpO1xuICBleHRyYVBsdWdpbnMucHVzaCh7XG4gICAgYXBwbHkoY29tcGlsZXIpIHtcbiAgICAgIGNvbXBpbGVyLmhvb2tzLnNodXRkb3duLnRhcCgnc2Fzcy13b3JrZXInLCAoKSA9PiB7XG4gICAgICAgIHNhc3NJbXBsZW1lbnRhdGlvbi5jbG9zZSgpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG5cbiAgY29uc3QgYXNzZXROYW1lVGVtcGxhdGUgPSBhc3NldE5hbWVUZW1wbGF0ZUZhY3RvcnkoaGFzaEZvcm1hdCk7XG5cbiAgY29uc3QgZXh0cmFQb3N0Y3NzUGx1Z2luczogaW1wb3J0KCdwb3N0Y3NzJykuUGx1Z2luW10gPSBbXTtcblxuICAvLyBBdHRlbXB0IHRvIHNldHVwIFRhaWx3aW5kIENTU1xuICAvLyBBIGNvbmZpZ3VyYXRpb24gZmlsZSBjYW4gZXhpc3QgaW4gdGhlIHByb2plY3Qgb3Igd29ya3NwYWNlIHJvb3RcbiAgY29uc3QgdGFpbHdpbmRDb25maWdGaWxlID0gJ3RhaWx3aW5kLmNvbmZpZy5qcyc7XG4gIGxldCB0YWlsd2luZENvbmZpZ1BhdGg7XG4gIGZvciAoY29uc3QgYmFzZVBhdGggb2YgW3djby5wcm9qZWN0Um9vdCwgd2NvLnJvb3RdKSB7XG4gICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4oYmFzZVBhdGgsIHRhaWx3aW5kQ29uZmlnRmlsZSk7XG4gICAgaWYgKGZzLmV4aXN0c1N5bmMoZnVsbFBhdGgpKSB7XG4gICAgICB0YWlsd2luZENvbmZpZ1BhdGggPSBmdWxsUGF0aDtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICAvLyBPbmx5IGxvYWQgVGFpbHdpbmQgQ1NTIHBsdWdpbiBpZiBjb25maWd1cmF0aW9uIGZpbGUgd2FzIGZvdW5kLlxuICAvLyBUaGlzIGFjdHMgYXMgYSBndWFyZCB0byBlbnN1cmUgdGhlIHByb2plY3QgYWN0dWFsbHkgd2FudHMgdG8gdXNlIFRhaWx3aW5kIENTUy5cbiAgLy8gVGhlIHBhY2thZ2UgbWF5IGJlIHVua25vd25pbmdseSBwcmVzZW50IGR1ZSB0byBhIHRoaXJkLXBhcnR5IHRyYW5zaXRpdmUgcGFja2FnZSBkZXBlbmRlbmN5LlxuICBpZiAodGFpbHdpbmRDb25maWdQYXRoKSB7XG4gICAgbGV0IHRhaWx3aW5kUGFja2FnZVBhdGg7XG4gICAgdHJ5IHtcbiAgICAgIHRhaWx3aW5kUGFja2FnZVBhdGggPSByZXF1aXJlLnJlc29sdmUoJ3RhaWx3aW5kY3NzJywgeyBwYXRoczogW3djby5yb290XSB9KTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGNvbnN0IHJlbGF0aXZlVGFpbHdpbmRDb25maWdQYXRoID0gcGF0aC5yZWxhdGl2ZSh3Y28ucm9vdCwgdGFpbHdpbmRDb25maWdQYXRoKTtcbiAgICAgIHdjby5sb2dnZXIud2FybihcbiAgICAgICAgYFRhaWx3aW5kIENTUyBjb25maWd1cmF0aW9uIGZpbGUgZm91bmQgKCR7cmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGh9KWAgK1xuICAgICAgICAgIGAgYnV0IHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UgaXMgbm90IGluc3RhbGxlZC5gICtcbiAgICAgICAgICBgIFRvIGVuYWJsZSBUYWlsd2luZCBDU1MsIHBsZWFzZSBpbnN0YWxsIHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UuYCxcbiAgICAgICk7XG4gICAgfVxuICAgIGlmICh0YWlsd2luZFBhY2thZ2VQYXRoKSB7XG4gICAgICBleHRyYVBvc3Rjc3NQbHVnaW5zLnB1c2gocmVxdWlyZSh0YWlsd2luZFBhY2thZ2VQYXRoKSh7IGNvbmZpZzogdGFpbHdpbmRDb25maWdQYXRoIH0pKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBwb3N0Y3NzUHJlc2V0RW52UGx1Z2luID0gcG9zdGNzc1ByZXNldEVudih7XG4gICAgYnJvd3NlcnM6IGJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2VycyxcbiAgICBhdXRvcHJlZml4ZXI6IHRydWUsXG4gICAgc3RhZ2U6IDMsXG4gIH0pO1xuICBjb25zdCBwb3N0Y3NzT3B0aW9uc0NyZWF0b3IgPSAoaW5saW5lU291cmNlbWFwczogYm9vbGVhbiwgZXh0cmFjdGVkOiBib29sZWFuKSA9PiB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBjb25zdCBvcHRpb25HZW5lcmF0b3IgPSAobG9hZGVyOiBhbnkpID0+ICh7XG4gICAgICBtYXA6IGlubGluZVNvdXJjZW1hcHNcbiAgICAgICAgPyB7XG4gICAgICAgICAgICBpbmxpbmU6IHRydWUsXG4gICAgICAgICAgICBhbm5vdGF0aW9uOiBmYWxzZSxcbiAgICAgICAgICB9XG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgcGx1Z2luczogW1xuICAgICAgICBwb3N0Y3NzSW1wb3J0cyh7XG4gICAgICAgICAgcmVzb2x2ZTogKHVybDogc3RyaW5nKSA9PiAodXJsLnN0YXJ0c1dpdGgoJ34nKSA/IHVybC5zdWJzdHIoMSkgOiB1cmwpLFxuICAgICAgICAgIGxvYWQ6IChmaWxlbmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgIGxvYWRlci5mcy5yZWFkRmlsZShmaWxlbmFtZSwgKGVycjogRXJyb3IsIGRhdGE6IEJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuXG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGNvbnRlbnQpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgICBQb3N0Y3NzQ2xpUmVzb3VyY2VzKHtcbiAgICAgICAgICBiYXNlSHJlZjogYnVpbGRPcHRpb25zLmJhc2VIcmVmLFxuICAgICAgICAgIGRlcGxveVVybDogYnVpbGRPcHRpb25zLmRlcGxveVVybCxcbiAgICAgICAgICByZXNvdXJjZXNPdXRwdXRQYXRoOiBidWlsZE9wdGlvbnMucmVzb3VyY2VzT3V0cHV0UGF0aCxcbiAgICAgICAgICBsb2FkZXIsXG4gICAgICAgICAgZmlsZW5hbWU6IGFzc2V0TmFtZVRlbXBsYXRlLFxuICAgICAgICAgIGVtaXRGaWxlOiBidWlsZE9wdGlvbnMucGxhdGZvcm0gIT09ICdzZXJ2ZXInLFxuICAgICAgICAgIGV4dHJhY3RlZCxcbiAgICAgICAgfSksXG4gICAgICAgIC4uLmV4dHJhUG9zdGNzc1BsdWdpbnMsXG4gICAgICAgIHBvc3Rjc3NQcmVzZXRFbnZQbHVnaW4sXG4gICAgICBdLFxuICAgIH0pO1xuICAgIC8vIHBvc3Rjc3MtbG9hZGVyIGZhaWxzIHdoZW4gdHJ5aW5nIHRvIGRldGVybWluZSBjb25maWd1cmF0aW9uIGZpbGVzIGZvciBkYXRhIFVSSXNcbiAgICBvcHRpb25HZW5lcmF0b3IuY29uZmlnID0gZmFsc2U7XG5cbiAgICByZXR1cm4gb3B0aW9uR2VuZXJhdG9yO1xuICB9O1xuXG4gIC8vIGxvYWQgY29tcG9uZW50IGNzcyBhcyByYXcgc3RyaW5nc1xuICBjb25zdCBjb21wb25lbnRzU291cmNlTWFwID0gISEoXG4gICAgY3NzU291cmNlTWFwICYmXG4gICAgLy8gTmV2ZXIgdXNlIGNvbXBvbmVudCBjc3Mgc291cmNlbWFwIHdoZW4gc3R5bGUgb3B0aW1pemF0aW9ucyBhcmUgb24uXG4gICAgLy8gSXQgd2lsbCBqdXN0IGluY3JlYXNlIGJ1bmRsZSBzaXplIHdpdGhvdXQgb2ZmZXJpbmcgZ29vZCBkZWJ1ZyBleHBlcmllbmNlLlxuICAgICFidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uLnN0eWxlcy5taW5pZnkgJiZcbiAgICAvLyBJbmxpbmUgYWxsIHNvdXJjZW1hcCB0eXBlcyBleGNlcHQgaGlkZGVuIG9uZXMsIHdoaWNoIGFyZSB0aGUgc2FtZSBhcyBubyBzb3VyY2VtYXBzXG4gICAgLy8gZm9yIGNvbXBvbmVudCBjc3MuXG4gICAgIWJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAuaGlkZGVuXG4gICk7XG5cbiAgLy8gZXh0cmFjdCBnbG9iYWwgY3NzIGZyb20ganMgZmlsZXMgaW50byBvd24gY3NzIGZpbGUuXG4gIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBNaW5pQ3NzRXh0cmFjdFBsdWdpbih7IGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmV4dHJhY3R9LmNzc2AgfSkpO1xuXG4gIGlmICghYnVpbGRPcHRpb25zLmhtcikge1xuICAgIC8vIGRvbid0IHJlbW92ZSBgLmpzYCBmaWxlcyBmb3IgYC5jc3NgIHdoZW4gd2UgYXJlIHVzaW5nIEhNUiB0aGVzZSBjb250YWluIEhNUiBhY2NlcHQgY29kZXMuXG4gICAgLy8gc3VwcHJlc3MgZW1wdHkgLmpzIGZpbGVzIGluIGNzcyBvbmx5IGVudHJ5IHBvaW50cy5cbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU3VwcHJlc3NFeHRyYWN0ZWRUZXh0Q2h1bmtzV2VicGFja1BsdWdpbigpKTtcbiAgfVxuXG4gIGNvbnN0IHBvc3RDc3MgPSByZXF1aXJlKCdwb3N0Y3NzJyk7XG4gIGNvbnN0IHBvc3RDc3NMb2FkZXJQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCdwb3N0Y3NzLWxvYWRlcicpO1xuXG4gIGNvbnN0IGNvbXBvbmVudFN0eWxlTG9hZGVyczogUnVsZVNldFVzZUl0ZW1bXSA9IFtcbiAgICB7XG4gICAgICBsb2FkZXI6IHBvc3RDc3NMb2FkZXJQYXRoLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICBpbXBsZW1lbnRhdGlvbjogcG9zdENzcyxcbiAgICAgICAgcG9zdGNzc09wdGlvbnM6IHBvc3Rjc3NPcHRpb25zQ3JlYXRvcihjb21wb25lbnRzU291cmNlTWFwLCBmYWxzZSksXG4gICAgICB9LFxuICAgIH0sXG4gIF07XG5cbiAgY29uc3QgZ2xvYmFsU3R5bGVMb2FkZXJzOiBSdWxlU2V0VXNlSXRlbVtdID0gW1xuICAgIHtcbiAgICAgIGxvYWRlcjogTWluaUNzc0V4dHJhY3RQbHVnaW4ubG9hZGVyLFxuICAgIH0sXG4gICAge1xuICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ2Nzcy1sb2FkZXInKSxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgdXJsOiBmYWxzZSxcbiAgICAgICAgc291cmNlTWFwOiAhIWNzc1NvdXJjZU1hcCxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBsb2FkZXI6IHBvc3RDc3NMb2FkZXJQYXRoLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICBpbXBsZW1lbnRhdGlvbjogcG9zdENzcyxcbiAgICAgICAgcG9zdGNzc09wdGlvbnM6IHBvc3Rjc3NPcHRpb25zQ3JlYXRvcihmYWxzZSwgdHJ1ZSksXG4gICAgICAgIHNvdXJjZU1hcDogISFjc3NTb3VyY2VNYXAsXG4gICAgICB9LFxuICAgIH0sXG4gIF07XG5cbiAgY29uc3Qgc3R5bGVMYW5ndWFnZXM6IHtcbiAgICBleHRlbnNpb25zOiBzdHJpbmdbXTtcbiAgICB1c2U6IFJ1bGVTZXRVc2VJdGVtW107XG4gIH1bXSA9IFtcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ2NzcyddLFxuICAgICAgdXNlOiBbXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnc2NzcyddLFxuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgncmVzb2x2ZS11cmwtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdzYXNzLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIGltcGxlbWVudGF0aW9uOiBzYXNzSW1wbGVtZW50YXRpb24sXG4gICAgICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgICAgICBzYXNzT3B0aW9uczoge1xuICAgICAgICAgICAgICAvLyBQcmV2ZW50IHVzZSBvZiBgZmliZXJzYCBwYWNrYWdlIGFzIGl0IG5vIGxvbmdlciB3b3JrcyBpbiBuZXdlciBOb2RlLmpzIHZlcnNpb25zXG4gICAgICAgICAgICAgIGZpYmVyOiBmYWxzZSxcbiAgICAgICAgICAgICAgLy8gYm9vdHN0cmFwLXNhc3MgcmVxdWlyZXMgYSBtaW5pbXVtIHByZWNpc2lvbiBvZiA4XG4gICAgICAgICAgICAgIHByZWNpc2lvbjogOCxcbiAgICAgICAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgICAvLyBVc2UgZXhwYW5kZWQgYXMgb3RoZXJ3aXNlIHNhc3Mgd2lsbCByZW1vdmUgY29tbWVudHMgdGhhdCBhcmUgbmVlZGVkIGZvciBhdXRvcHJlZml4ZXJcbiAgICAgICAgICAgICAgLy8gRXg6IC8qIGF1dG9wcmVmaXhlciBncmlkOiBhdXRvcGxhY2UgKi9cbiAgICAgICAgICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3Nhc3MtbG9hZGVyL2Jsb2IvNDVhZDBiZTE3MjY0Y2VhZGE1ZjBiNGZiODdlOTM1N2FiZTg1YzRmZi9zcmMvZ2V0U2Fzc09wdGlvbnMuanMjTDY4LUw3MFxuICAgICAgICAgICAgICBvdXRwdXRTdHlsZTogJ2V4cGFuZGVkJyxcbiAgICAgICAgICAgICAgLy8gU2lsZW5jZXMgY29tcGlsZXIgd2FybmluZ3MgZnJvbSAzcmQgcGFydHkgc3R5bGVzaGVldHNcbiAgICAgICAgICAgICAgcXVpZXREZXBzOiAhYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgICAgIHZlcmJvc2U6IGJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnc2FzcyddLFxuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgncmVzb2x2ZS11cmwtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdzYXNzLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIGltcGxlbWVudGF0aW9uOiBzYXNzSW1wbGVtZW50YXRpb24sXG4gICAgICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgICAgICBzYXNzT3B0aW9uczoge1xuICAgICAgICAgICAgICAvLyBQcmV2ZW50IHVzZSBvZiBgZmliZXJzYCBwYWNrYWdlIGFzIGl0IG5vIGxvbmdlciB3b3JrcyBpbiBuZXdlciBOb2RlLmpzIHZlcnNpb25zXG4gICAgICAgICAgICAgIGZpYmVyOiBmYWxzZSxcbiAgICAgICAgICAgICAgaW5kZW50ZWRTeW50YXg6IHRydWUsXG4gICAgICAgICAgICAgIC8vIGJvb3RzdHJhcC1zYXNzIHJlcXVpcmVzIGEgbWluaW11bSBwcmVjaXNpb24gb2YgOFxuICAgICAgICAgICAgICBwcmVjaXNpb246IDgsXG4gICAgICAgICAgICAgIGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAgICAgLy8gVXNlIGV4cGFuZGVkIGFzIG90aGVyd2lzZSBzYXNzIHdpbGwgcmVtb3ZlIGNvbW1lbnRzIHRoYXQgYXJlIG5lZWRlZCBmb3IgYXV0b3ByZWZpeGVyXG4gICAgICAgICAgICAgIC8vIEV4OiAvKiBhdXRvcHJlZml4ZXIgZ3JpZDogYXV0b3BsYWNlICovXG4gICAgICAgICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zYXNzLWxvYWRlci9ibG9iLzQ1YWQwYmUxNzI2NGNlYWRhNWYwYjRmYjg3ZTkzNTdhYmU4NWM0ZmYvc3JjL2dldFNhc3NPcHRpb25zLmpzI0w2OC1MNzBcbiAgICAgICAgICAgICAgb3V0cHV0U3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICAgICAgICAgIC8vIFNpbGVuY2VzIGNvbXBpbGVyIHdhcm5pbmdzIGZyb20gM3JkIHBhcnR5IHN0eWxlc2hlZXRzXG4gICAgICAgICAgICAgIHF1aWV0RGVwczogIWJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAgICAgICB2ZXJib3NlOiBidWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ2xlc3MnXSxcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ2xlc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgaW1wbGVtZW50YXRpb246IHJlcXVpcmUoJ2xlc3MnKSxcbiAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgICAgbGVzc09wdGlvbnM6IHtcbiAgICAgICAgICAgICAgamF2YXNjcmlwdEVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgIHBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydzdHlsJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdzdHlsdXMtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgICBzdHlsdXNPcHRpb25zOiB7XG4gICAgICAgICAgICAgIGNvbXByZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgc291cmNlTWFwOiB7IGNvbW1lbnQ6IGZhbHNlIH0sXG4gICAgICAgICAgICAgIHBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gIF07XG5cbiAgcmV0dXJuIHtcbiAgICBlbnRyeTogZW50cnlQb2ludHMsXG4gICAgbW9kdWxlOiB7XG4gICAgICBydWxlczogc3R5bGVMYW5ndWFnZXMubWFwKCh7IGV4dGVuc2lvbnMsIHVzZSB9KSA9PiAoe1xuICAgICAgICB0ZXN0OiBuZXcgUmVnRXhwKGBcXFxcLig/OiR7ZXh0ZW5zaW9ucy5qb2luKCd8Jyl9KSRgLCAnaScpLFxuICAgICAgICBydWxlczogW1xuICAgICAgICAgIC8vIFNldHVwIHByb2Nlc3NpbmcgcnVsZXMgZm9yIGdsb2JhbCBhbmQgY29tcG9uZW50IHN0eWxlc1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgICAgIC8vIEdsb2JhbCBzdHlsZXMgYXJlIG9ubHkgZGVmaW5lZCBnbG9iYWwgc3R5bGVzXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1c2U6IGdsb2JhbFN0eWxlTG9hZGVycyxcbiAgICAgICAgICAgICAgICBpbmNsdWRlOiBnbG9iYWxTdHlsZVBhdGhzLFxuICAgICAgICAgICAgICAgIHJlc291cmNlUXVlcnk6IHsgbm90OiBbL1xcP25nUmVzb3VyY2UvXSB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzIGFyZSBhbGwgc3R5bGVzIGV4Y2VwdCBkZWZpbmVkIGdsb2JhbCBzdHlsZXNcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVzZTogY29tcG9uZW50U3R5bGVMb2FkZXJzLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhc3NldC9zb3VyY2UnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHsgdXNlIH0sXG4gICAgICAgIF0sXG4gICAgICB9KSksXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG1pbmltaXplcjogYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbi5zdHlsZXMubWluaWZ5XG4gICAgICAgID8gW1xuICAgICAgICAgICAgbmV3IENzc09wdGltaXplclBsdWdpbih7XG4gICAgICAgICAgICAgIHN1cHBvcnRlZEJyb3dzZXJzOiBidWlsZE9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdXG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLFxuICB9O1xufVxuIl19