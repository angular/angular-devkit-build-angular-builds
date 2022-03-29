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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHVDQUF5QjtBQUN6QixzRkFBMkQ7QUFDM0QsMkNBQTZCO0FBRzdCLDBEQUFtRTtBQUVuRSx3Q0FLb0I7QUFDcEIsMEVBQXFFO0FBQ3JFLDhDQUkwQjtBQUUxQixTQUFTLG1CQUFtQixDQUMxQixnQkFBZ0MsRUFDaEMsSUFBWSxFQUNaLGdCQUF5QjtJQUV6QixNQUFNLFdBQVcsR0FBNkIsRUFBRSxDQUFDO0lBQ2pELE1BQU0sYUFBYSxHQUFhLEVBQUUsQ0FBQztJQUNuQyxNQUFNLEtBQUssR0FBYSxFQUFFLENBQUM7SUFFM0IsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ2pDLE9BQU8sRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxDQUFDO0tBQzlDO0lBRUQsS0FBSyxNQUFNLEtBQUssSUFBSSxJQUFBLG1DQUF5QixFQUFDLGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxFQUFFO1FBQ3pFLElBQUksWUFBWSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRTtZQUNoQyxJQUFJO2dCQUNGLFlBQVksR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7YUFDaEU7WUFBQyxXQUFNLEdBQUU7U0FDWDtRQUVE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RSxDQUFDLGNBQWMsQ0FBQyxFQUFFOzZCQUN6Qzs0QkFDRCwrREFBK0Q7NEJBQy9EO2dDQUNFLEdBQUcsRUFBRSxxQkFBcUI7Z0NBQzFCLElBQUksRUFBRSxjQUFjO2dDQUNwQixhQUFhLEVBQUUsY0FBYzs2QkFDOUI7eUJBQ0Y7cUJBQ0Y7b0JBQ0QsRUFBRSxHQUFHLEVBQUU7aUJBQ1I7YUFDRixDQUFDLENBQUM7U0FDSjtRQUNELFlBQVksRUFBRTtZQUNaLFNBQVMsRUFBRSxZQUFZLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxNQUFNO2dCQUNoRCxDQUFDLENBQUM7b0JBQ0UsSUFBSSx5Q0FBa0IsQ0FBQzt3QkFDckIsaUJBQWlCLEVBQUUsWUFBWSxDQUFDLGlCQUFpQjtxQkFDbEQsQ0FBQztpQkFDSDtnQkFDSCxDQUFDLENBQUMsU0FBUztTQUNkO1FBQ0QsT0FBTyxFQUFFLFlBQVk7S0FDdEIsQ0FBQztBQUNKLENBQUM7QUExVUQsMENBMFVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCBNaW5pQ3NzRXh0cmFjdFBsdWdpbiBmcm9tICdtaW5pLWNzcy1leHRyYWN0LXBsdWdpbic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiwgUnVsZVNldFVzZUl0ZW0gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IFN0eWxlRWxlbWVudCB9IGZyb20gJy4uLy4uL2J1aWxkZXJzL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbiB9IGZyb20gJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQge1xuICBBbnlDb21wb25lbnRTdHlsZUJ1ZGdldENoZWNrZXIsXG4gIFBvc3Rjc3NDbGlSZXNvdXJjZXMsXG4gIFJlbW92ZUhhc2hQbHVnaW4sXG4gIFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4sXG59IGZyb20gJy4uL3BsdWdpbnMnO1xuaW1wb3J0IHsgQ3NzT3B0aW1pemVyUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy9jc3Mtb3B0aW1pemVyLXBsdWdpbic7XG5pbXBvcnQge1xuICBhc3NldE5hbWVUZW1wbGF0ZUZhY3RvcnksXG4gIGdldE91dHB1dEhhc2hGb3JtYXQsXG4gIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMsXG59IGZyb20gJy4uL3V0aWxzL2hlbHBlcnMnO1xuXG5mdW5jdGlvbiByZXNvbHZlR2xvYmFsU3R5bGVzKFxuICBzdHlsZUVudHJ5cG9pbnRzOiBTdHlsZUVsZW1lbnRbXSxcbiAgcm9vdDogc3RyaW5nLFxuICBwcmVzZXJ2ZVN5bWxpbmtzOiBib29sZWFuLFxuKTogeyBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+OyBub0luamVjdE5hbWVzOiBzdHJpbmdbXTsgcGF0aHM6IHN0cmluZ1tdIH0ge1xuICBjb25zdCBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge307XG4gIGNvbnN0IG5vSW5qZWN0TmFtZXM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGlmIChzdHlsZUVudHJ5cG9pbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB7IGVudHJ5UG9pbnRzLCBub0luamVjdE5hbWVzLCBwYXRocyB9O1xuICB9XG5cbiAgZm9yIChjb25zdCBzdHlsZSBvZiBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKHN0eWxlRW50cnlwb2ludHMsICdzdHlsZXMnKSkge1xuICAgIGxldCByZXNvbHZlZFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgc3R5bGUuaW5wdXQpO1xuICAgIGlmICghZnMuZXhpc3RzU3luYyhyZXNvbHZlZFBhdGgpKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXNvbHZlZFBhdGggPSByZXF1aXJlLnJlc29sdmUoc3R5bGUuaW5wdXQsIHsgcGF0aHM6IFtyb290XSB9KTtcbiAgICAgIH0gY2F0Y2gge31cbiAgICB9XG5cbiAgICBpZiAoIXByZXNlcnZlU3ltbGlua3MpIHtcbiAgICAgIHJlc29sdmVkUGF0aCA9IGZzLnJlYWxwYXRoU3luYyhyZXNvbHZlZFBhdGgpO1xuICAgIH1cblxuICAgIC8vIEFkZCBzdHlsZSBlbnRyeSBwb2ludHMuXG4gICAgaWYgKGVudHJ5UG9pbnRzW3N0eWxlLmJ1bmRsZU5hbWVdKSB7XG4gICAgICBlbnRyeVBvaW50c1tzdHlsZS5idW5kbGVOYW1lXS5wdXNoKHJlc29sdmVkUGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVudHJ5UG9pbnRzW3N0eWxlLmJ1bmRsZU5hbWVdID0gW3Jlc29sdmVkUGF0aF07XG4gICAgfVxuXG4gICAgLy8gQWRkIG5vbiBpbmplY3RlZCBzdHlsZXMgdG8gdGhlIGxpc3QuXG4gICAgaWYgKCFzdHlsZS5pbmplY3QpIHtcbiAgICAgIG5vSW5qZWN0TmFtZXMucHVzaChzdHlsZS5idW5kbGVOYW1lKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgZ2xvYmFsIGNzcyBwYXRocy5cbiAgICBwYXRocy5wdXNoKHJlc29sdmVkUGF0aCk7XG4gIH1cblxuICByZXR1cm4geyBlbnRyeVBvaW50cywgbm9JbmplY3ROYW1lcywgcGF0aHMgfTtcbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBnZXRTdHlsZXNDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IENvbmZpZ3VyYXRpb24ge1xuICBjb25zdCBwb3N0Y3NzSW1wb3J0cyA9IHJlcXVpcmUoJ3Bvc3Rjc3MtaW1wb3J0Jyk7XG4gIGNvbnN0IHBvc3Rjc3NQcmVzZXRFbnY6IHR5cGVvZiBpbXBvcnQoJ3Bvc3Rjc3MtcHJlc2V0LWVudicpID0gcmVxdWlyZSgncG9zdGNzcy1wcmVzZXQtZW52Jyk7XG5cbiAgY29uc3QgeyByb290LCBidWlsZE9wdGlvbnMgfSA9IHdjbztcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiBDb25maWd1cmF0aW9uWydwbHVnaW5zJ10gPSBbXTtcblxuICBleHRyYVBsdWdpbnMucHVzaChuZXcgQW55Q29tcG9uZW50U3R5bGVCdWRnZXRDaGVja2VyKGJ1aWxkT3B0aW9ucy5idWRnZXRzKSk7XG5cbiAgY29uc3QgY3NzU291cmNlTWFwID0gYnVpbGRPcHRpb25zLnNvdXJjZU1hcC5zdHlsZXM7XG5cbiAgLy8gRGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0LlxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyk7XG5cbiAgLy8gdXNlIGluY2x1ZGVQYXRocyBmcm9tIGFwcENvbmZpZ1xuICBjb25zdCBpbmNsdWRlUGF0aHMgPVxuICAgIGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocz8ubWFwKChwKSA9PiBwYXRoLnJlc29sdmUocm9vdCwgcCkpID8/IFtdO1xuXG4gIC8vIFByb2Nlc3MgZ2xvYmFsIHN0eWxlcy5cbiAgY29uc3Qge1xuICAgIGVudHJ5UG9pbnRzLFxuICAgIG5vSW5qZWN0TmFtZXMsXG4gICAgcGF0aHM6IGdsb2JhbFN0eWxlUGF0aHMsXG4gIH0gPSByZXNvbHZlR2xvYmFsU3R5bGVzKGJ1aWxkT3B0aW9ucy5zdHlsZXMsIHJvb3QsICEhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MpO1xuICBpZiAobm9JbmplY3ROYW1lcy5sZW5ndGggPiAwKSB7XG4gICAgLy8gQWRkIHBsdWdpbiB0byByZW1vdmUgaGFzaGVzIGZyb20gbGF6eSBzdHlsZXMuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFJlbW92ZUhhc2hQbHVnaW4oeyBjaHVua05hbWVzOiBub0luamVjdE5hbWVzLCBoYXNoRm9ybWF0IH0pKTtcbiAgfVxuXG4gIGlmIChnbG9iYWxTdHlsZVBhdGhzLnNvbWUoKHApID0+IHAuZW5kc1dpdGgoJy5zdHlsJykpKSB7XG4gICAgd2NvLmxvZ2dlci53YXJuKFxuICAgICAgJ1N0eWx1cyB1c2FnZSBpcyBkZXByZWNhdGVkIGFuZCB3aWxsIGJlIHJlbW92ZWQgaW4gYSBmdXR1cmUgbWFqb3IgdmVyc2lvbi4gJyArXG4gICAgICAgICdUbyBvcHQtb3V0IG9mIHRoZSBkZXByZWNhdGVkIGJlaGF2aW91ciwgcGxlYXNlIG1pZ3JhdGUgdG8gYW5vdGhlciBzdHlsZXNoZWV0IGxhbmd1YWdlLicsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHNhc3NJbXBsZW1lbnRhdGlvbiA9IG5ldyBTYXNzV29ya2VySW1wbGVtZW50YXRpb24oKTtcbiAgZXh0cmFQbHVnaW5zLnB1c2goe1xuICAgIGFwcGx5KGNvbXBpbGVyKSB7XG4gICAgICBjb21waWxlci5ob29rcy5zaHV0ZG93bi50YXAoJ3Nhc3Mtd29ya2VyJywgKCkgPT4ge1xuICAgICAgICBzYXNzSW1wbGVtZW50YXRpb24uY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH0pO1xuXG4gIGNvbnN0IGFzc2V0TmFtZVRlbXBsYXRlID0gYXNzZXROYW1lVGVtcGxhdGVGYWN0b3J5KGhhc2hGb3JtYXQpO1xuXG4gIGNvbnN0IGV4dHJhUG9zdGNzc1BsdWdpbnM6IGltcG9ydCgncG9zdGNzcycpLlBsdWdpbltdID0gW107XG5cbiAgLy8gQXR0ZW1wdCB0byBzZXR1cCBUYWlsd2luZCBDU1NcbiAgLy8gQSBjb25maWd1cmF0aW9uIGZpbGUgY2FuIGV4aXN0IGluIHRoZSBwcm9qZWN0IG9yIHdvcmtzcGFjZSByb290XG4gIGNvbnN0IHRhaWx3aW5kQ29uZmlnRmlsZSA9ICd0YWlsd2luZC5jb25maWcuanMnO1xuICBsZXQgdGFpbHdpbmRDb25maWdQYXRoO1xuICBmb3IgKGNvbnN0IGJhc2VQYXRoIG9mIFt3Y28ucHJvamVjdFJvb3QsIHdjby5yb290XSkge1xuICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGJhc2VQYXRoLCB0YWlsd2luZENvbmZpZ0ZpbGUpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKGZ1bGxQYXRoKSkge1xuICAgICAgdGFpbHdpbmRDb25maWdQYXRoID0gZnVsbFBhdGg7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgLy8gT25seSBsb2FkIFRhaWx3aW5kIENTUyBwbHVnaW4gaWYgY29uZmlndXJhdGlvbiBmaWxlIHdhcyBmb3VuZC5cbiAgLy8gVGhpcyBhY3RzIGFzIGEgZ3VhcmQgdG8gZW5zdXJlIHRoZSBwcm9qZWN0IGFjdHVhbGx5IHdhbnRzIHRvIHVzZSBUYWlsd2luZCBDU1MuXG4gIC8vIFRoZSBwYWNrYWdlIG1heSBiZSB1bmtub3duaW5nbHkgcHJlc2VudCBkdWUgdG8gYSB0aGlyZC1wYXJ0eSB0cmFuc2l0aXZlIHBhY2thZ2UgZGVwZW5kZW5jeS5cbiAgaWYgKHRhaWx3aW5kQ29uZmlnUGF0aCkge1xuICAgIGxldCB0YWlsd2luZFBhY2thZ2VQYXRoO1xuICAgIHRyeSB7XG4gICAgICB0YWlsd2luZFBhY2thZ2VQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCd0YWlsd2luZGNzcycsIHsgcGF0aHM6IFt3Y28ucm9vdF0gfSk7XG4gICAgfSBjYXRjaCB7XG4gICAgICBjb25zdCByZWxhdGl2ZVRhaWx3aW5kQ29uZmlnUGF0aCA9IHBhdGgucmVsYXRpdmUod2NvLnJvb3QsIHRhaWx3aW5kQ29uZmlnUGF0aCk7XG4gICAgICB3Y28ubG9nZ2VyLndhcm4oXG4gICAgICAgIGBUYWlsd2luZCBDU1MgY29uZmlndXJhdGlvbiBmaWxlIGZvdW5kICgke3JlbGF0aXZlVGFpbHdpbmRDb25maWdQYXRofSlgICtcbiAgICAgICAgICBgIGJ1dCB0aGUgJ3RhaWx3aW5kY3NzJyBwYWNrYWdlIGlzIG5vdCBpbnN0YWxsZWQuYCArXG4gICAgICAgICAgYCBUbyBlbmFibGUgVGFpbHdpbmQgQ1NTLCBwbGVhc2UgaW5zdGFsbCB0aGUgJ3RhaWx3aW5kY3NzJyBwYWNrYWdlLmAsXG4gICAgICApO1xuICAgIH1cbiAgICBpZiAodGFpbHdpbmRQYWNrYWdlUGF0aCkge1xuICAgICAgZXh0cmFQb3N0Y3NzUGx1Z2lucy5wdXNoKHJlcXVpcmUodGFpbHdpbmRQYWNrYWdlUGF0aCkoeyBjb25maWc6IHRhaWx3aW5kQ29uZmlnUGF0aCB9KSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgcG9zdGNzc1ByZXNldEVudlBsdWdpbiA9IHBvc3Rjc3NQcmVzZXRFbnYoe1xuICAgIGJyb3dzZXJzOiBidWlsZE9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgYXV0b3ByZWZpeGVyOiB0cnVlLFxuICAgIHN0YWdlOiAzLFxuICB9KTtcbiAgY29uc3QgcG9zdGNzc09wdGlvbnNDcmVhdG9yID0gKGlubGluZVNvdXJjZW1hcHM6IGJvb2xlYW4sIGV4dHJhY3RlZDogYm9vbGVhbikgPT4ge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3Qgb3B0aW9uR2VuZXJhdG9yID0gKGxvYWRlcjogYW55KSA9PiAoe1xuICAgICAgbWFwOiBpbmxpbmVTb3VyY2VtYXBzXG4gICAgICAgID8ge1xuICAgICAgICAgICAgaW5saW5lOiB0cnVlLFxuICAgICAgICAgICAgYW5ub3RhdGlvbjogZmFsc2UsXG4gICAgICAgICAgfVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgIHBsdWdpbnM6IFtcbiAgICAgICAgcG9zdGNzc0ltcG9ydHMoe1xuICAgICAgICAgIHJlc29sdmU6ICh1cmw6IHN0cmluZykgPT4gKHVybC5zdGFydHNXaXRoKCd+JykgPyB1cmwuc2xpY2UoMSkgOiB1cmwpLFxuICAgICAgICAgIGxvYWQ6IChmaWxlbmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgIGxvYWRlci5mcy5yZWFkRmlsZShmaWxlbmFtZSwgKGVycjogRXJyb3IsIGRhdGE6IEJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuXG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGNvbnRlbnQpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgICBQb3N0Y3NzQ2xpUmVzb3VyY2VzKHtcbiAgICAgICAgICBiYXNlSHJlZjogYnVpbGRPcHRpb25zLmJhc2VIcmVmLFxuICAgICAgICAgIGRlcGxveVVybDogYnVpbGRPcHRpb25zLmRlcGxveVVybCxcbiAgICAgICAgICByZXNvdXJjZXNPdXRwdXRQYXRoOiBidWlsZE9wdGlvbnMucmVzb3VyY2VzT3V0cHV0UGF0aCxcbiAgICAgICAgICBsb2FkZXIsXG4gICAgICAgICAgZmlsZW5hbWU6IGFzc2V0TmFtZVRlbXBsYXRlLFxuICAgICAgICAgIGVtaXRGaWxlOiBidWlsZE9wdGlvbnMucGxhdGZvcm0gIT09ICdzZXJ2ZXInLFxuICAgICAgICAgIGV4dHJhY3RlZCxcbiAgICAgICAgfSksXG4gICAgICAgIC4uLmV4dHJhUG9zdGNzc1BsdWdpbnMsXG4gICAgICAgIHBvc3Rjc3NQcmVzZXRFbnZQbHVnaW4sXG4gICAgICBdLFxuICAgIH0pO1xuICAgIC8vIHBvc3Rjc3MtbG9hZGVyIGZhaWxzIHdoZW4gdHJ5aW5nIHRvIGRldGVybWluZSBjb25maWd1cmF0aW9uIGZpbGVzIGZvciBkYXRhIFVSSXNcbiAgICBvcHRpb25HZW5lcmF0b3IuY29uZmlnID0gZmFsc2U7XG5cbiAgICByZXR1cm4gb3B0aW9uR2VuZXJhdG9yO1xuICB9O1xuXG4gIC8vIGxvYWQgY29tcG9uZW50IGNzcyBhcyByYXcgc3RyaW5nc1xuICBjb25zdCBjb21wb25lbnRzU291cmNlTWFwID0gISEoXG4gICAgY3NzU291cmNlTWFwICYmXG4gICAgLy8gTmV2ZXIgdXNlIGNvbXBvbmVudCBjc3Mgc291cmNlbWFwIHdoZW4gc3R5bGUgb3B0aW1pemF0aW9ucyBhcmUgb24uXG4gICAgLy8gSXQgd2lsbCBqdXN0IGluY3JlYXNlIGJ1bmRsZSBzaXplIHdpdGhvdXQgb2ZmZXJpbmcgZ29vZCBkZWJ1ZyBleHBlcmllbmNlLlxuICAgICFidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uLnN0eWxlcy5taW5pZnkgJiZcbiAgICAvLyBJbmxpbmUgYWxsIHNvdXJjZW1hcCB0eXBlcyBleGNlcHQgaGlkZGVuIG9uZXMsIHdoaWNoIGFyZSB0aGUgc2FtZSBhcyBubyBzb3VyY2VtYXBzXG4gICAgLy8gZm9yIGNvbXBvbmVudCBjc3MuXG4gICAgIWJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAuaGlkZGVuXG4gICk7XG5cbiAgLy8gZXh0cmFjdCBnbG9iYWwgY3NzIGZyb20ganMgZmlsZXMgaW50byBvd24gY3NzIGZpbGUuXG4gIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBNaW5pQ3NzRXh0cmFjdFBsdWdpbih7IGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmV4dHJhY3R9LmNzc2AgfSkpO1xuXG4gIGlmICghYnVpbGRPcHRpb25zLmhtcikge1xuICAgIC8vIGRvbid0IHJlbW92ZSBgLmpzYCBmaWxlcyBmb3IgYC5jc3NgIHdoZW4gd2UgYXJlIHVzaW5nIEhNUiB0aGVzZSBjb250YWluIEhNUiBhY2NlcHQgY29kZXMuXG4gICAgLy8gc3VwcHJlc3MgZW1wdHkgLmpzIGZpbGVzIGluIGNzcyBvbmx5IGVudHJ5IHBvaW50cy5cbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU3VwcHJlc3NFeHRyYWN0ZWRUZXh0Q2h1bmtzV2VicGFja1BsdWdpbigpKTtcbiAgfVxuXG4gIGNvbnN0IHBvc3RDc3MgPSByZXF1aXJlKCdwb3N0Y3NzJyk7XG4gIGNvbnN0IHBvc3RDc3NMb2FkZXJQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCdwb3N0Y3NzLWxvYWRlcicpO1xuXG4gIGNvbnN0IGNvbXBvbmVudFN0eWxlTG9hZGVyczogUnVsZVNldFVzZUl0ZW1bXSA9IFtcbiAgICB7XG4gICAgICBsb2FkZXI6IHBvc3RDc3NMb2FkZXJQYXRoLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICBpbXBsZW1lbnRhdGlvbjogcG9zdENzcyxcbiAgICAgICAgcG9zdGNzc09wdGlvbnM6IHBvc3Rjc3NPcHRpb25zQ3JlYXRvcihjb21wb25lbnRzU291cmNlTWFwLCBmYWxzZSksXG4gICAgICB9LFxuICAgIH0sXG4gIF07XG5cbiAgY29uc3QgZ2xvYmFsU3R5bGVMb2FkZXJzOiBSdWxlU2V0VXNlSXRlbVtdID0gW1xuICAgIHtcbiAgICAgIGxvYWRlcjogTWluaUNzc0V4dHJhY3RQbHVnaW4ubG9hZGVyLFxuICAgIH0sXG4gICAge1xuICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ2Nzcy1sb2FkZXInKSxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgdXJsOiBmYWxzZSxcbiAgICAgICAgc291cmNlTWFwOiAhIWNzc1NvdXJjZU1hcCxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBsb2FkZXI6IHBvc3RDc3NMb2FkZXJQYXRoLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICBpbXBsZW1lbnRhdGlvbjogcG9zdENzcyxcbiAgICAgICAgcG9zdGNzc09wdGlvbnM6IHBvc3Rjc3NPcHRpb25zQ3JlYXRvcihmYWxzZSwgdHJ1ZSksXG4gICAgICAgIHNvdXJjZU1hcDogISFjc3NTb3VyY2VNYXAsXG4gICAgICB9LFxuICAgIH0sXG4gIF07XG5cbiAgY29uc3Qgc3R5bGVMYW5ndWFnZXM6IHtcbiAgICBleHRlbnNpb25zOiBzdHJpbmdbXTtcbiAgICB1c2U6IFJ1bGVTZXRVc2VJdGVtW107XG4gIH1bXSA9IFtcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ2NzcyddLFxuICAgICAgdXNlOiBbXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnc2NzcyddLFxuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgncmVzb2x2ZS11cmwtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdzYXNzLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIGltcGxlbWVudGF0aW9uOiBzYXNzSW1wbGVtZW50YXRpb24sXG4gICAgICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgICAgICBzYXNzT3B0aW9uczoge1xuICAgICAgICAgICAgICAvLyBQcmV2ZW50IHVzZSBvZiBgZmliZXJzYCBwYWNrYWdlIGFzIGl0IG5vIGxvbmdlciB3b3JrcyBpbiBuZXdlciBOb2RlLmpzIHZlcnNpb25zXG4gICAgICAgICAgICAgIGZpYmVyOiBmYWxzZSxcbiAgICAgICAgICAgICAgLy8gYm9vdHN0cmFwLXNhc3MgcmVxdWlyZXMgYSBtaW5pbXVtIHByZWNpc2lvbiBvZiA4XG4gICAgICAgICAgICAgIHByZWNpc2lvbjogOCxcbiAgICAgICAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgICAvLyBVc2UgZXhwYW5kZWQgYXMgb3RoZXJ3aXNlIHNhc3Mgd2lsbCByZW1vdmUgY29tbWVudHMgdGhhdCBhcmUgbmVlZGVkIGZvciBhdXRvcHJlZml4ZXJcbiAgICAgICAgICAgICAgLy8gRXg6IC8qIGF1dG9wcmVmaXhlciBncmlkOiBhdXRvcGxhY2UgKi9cbiAgICAgICAgICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3Nhc3MtbG9hZGVyL2Jsb2IvNDVhZDBiZTE3MjY0Y2VhZGE1ZjBiNGZiODdlOTM1N2FiZTg1YzRmZi9zcmMvZ2V0U2Fzc09wdGlvbnMuanMjTDY4LUw3MFxuICAgICAgICAgICAgICBvdXRwdXRTdHlsZTogJ2V4cGFuZGVkJyxcbiAgICAgICAgICAgICAgLy8gU2lsZW5jZXMgY29tcGlsZXIgd2FybmluZ3MgZnJvbSAzcmQgcGFydHkgc3R5bGVzaGVldHNcbiAgICAgICAgICAgICAgcXVpZXREZXBzOiAhYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgICAgIHZlcmJvc2U6IGJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnc2FzcyddLFxuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgncmVzb2x2ZS11cmwtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdzYXNzLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIGltcGxlbWVudGF0aW9uOiBzYXNzSW1wbGVtZW50YXRpb24sXG4gICAgICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgICAgICBzYXNzT3B0aW9uczoge1xuICAgICAgICAgICAgICAvLyBQcmV2ZW50IHVzZSBvZiBgZmliZXJzYCBwYWNrYWdlIGFzIGl0IG5vIGxvbmdlciB3b3JrcyBpbiBuZXdlciBOb2RlLmpzIHZlcnNpb25zXG4gICAgICAgICAgICAgIGZpYmVyOiBmYWxzZSxcbiAgICAgICAgICAgICAgaW5kZW50ZWRTeW50YXg6IHRydWUsXG4gICAgICAgICAgICAgIC8vIGJvb3RzdHJhcC1zYXNzIHJlcXVpcmVzIGEgbWluaW11bSBwcmVjaXNpb24gb2YgOFxuICAgICAgICAgICAgICBwcmVjaXNpb246IDgsXG4gICAgICAgICAgICAgIGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAgICAgLy8gVXNlIGV4cGFuZGVkIGFzIG90aGVyd2lzZSBzYXNzIHdpbGwgcmVtb3ZlIGNvbW1lbnRzIHRoYXQgYXJlIG5lZWRlZCBmb3IgYXV0b3ByZWZpeGVyXG4gICAgICAgICAgICAgIC8vIEV4OiAvKiBhdXRvcHJlZml4ZXIgZ3JpZDogYXV0b3BsYWNlICovXG4gICAgICAgICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zYXNzLWxvYWRlci9ibG9iLzQ1YWQwYmUxNzI2NGNlYWRhNWYwYjRmYjg3ZTkzNTdhYmU4NWM0ZmYvc3JjL2dldFNhc3NPcHRpb25zLmpzI0w2OC1MNzBcbiAgICAgICAgICAgICAgb3V0cHV0U3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICAgICAgICAgIC8vIFNpbGVuY2VzIGNvbXBpbGVyIHdhcm5pbmdzIGZyb20gM3JkIHBhcnR5IHN0eWxlc2hlZXRzXG4gICAgICAgICAgICAgIHF1aWV0RGVwczogIWJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAgICAgICB2ZXJib3NlOiBidWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ2xlc3MnXSxcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ2xlc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgaW1wbGVtZW50YXRpb246IHJlcXVpcmUoJ2xlc3MnKSxcbiAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgICAgbGVzc09wdGlvbnM6IHtcbiAgICAgICAgICAgICAgamF2YXNjcmlwdEVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgIHBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydzdHlsJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdzdHlsdXMtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgICBzdHlsdXNPcHRpb25zOiB7XG4gICAgICAgICAgICAgIGNvbXByZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgc291cmNlTWFwOiB7IGNvbW1lbnQ6IGZhbHNlIH0sXG4gICAgICAgICAgICAgIHBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gIF07XG5cbiAgcmV0dXJuIHtcbiAgICBlbnRyeTogZW50cnlQb2ludHMsXG4gICAgbW9kdWxlOiB7XG4gICAgICBydWxlczogc3R5bGVMYW5ndWFnZXMubWFwKCh7IGV4dGVuc2lvbnMsIHVzZSB9KSA9PiAoe1xuICAgICAgICB0ZXN0OiBuZXcgUmVnRXhwKGBcXFxcLig/OiR7ZXh0ZW5zaW9ucy5qb2luKCd8Jyl9KSRgLCAnaScpLFxuICAgICAgICBydWxlczogW1xuICAgICAgICAgIC8vIFNldHVwIHByb2Nlc3NpbmcgcnVsZXMgZm9yIGdsb2JhbCBhbmQgY29tcG9uZW50IHN0eWxlc1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgICAgIC8vIEdsb2JhbCBzdHlsZXMgYXJlIG9ubHkgZGVmaW5lZCBnbG9iYWwgc3R5bGVzXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1c2U6IGdsb2JhbFN0eWxlTG9hZGVycyxcbiAgICAgICAgICAgICAgICBpbmNsdWRlOiBnbG9iYWxTdHlsZVBhdGhzLFxuICAgICAgICAgICAgICAgIHJlc291cmNlUXVlcnk6IHsgbm90OiBbL1xcP25nUmVzb3VyY2UvXSB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzIGFyZSBhbGwgc3R5bGVzIGV4Y2VwdCBkZWZpbmVkIGdsb2JhbCBzdHlsZXNcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVzZTogY29tcG9uZW50U3R5bGVMb2FkZXJzLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhc3NldC9zb3VyY2UnLFxuICAgICAgICAgICAgICAgIHJlc291cmNlUXVlcnk6IC9cXD9uZ1Jlc291cmNlLyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7IHVzZSB9LFxuICAgICAgICBdLFxuICAgICAgfSkpLFxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICBtaW5pbWl6ZXI6IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24uc3R5bGVzLm1pbmlmeVxuICAgICAgICA/IFtcbiAgICAgICAgICAgIG5ldyBDc3NPcHRpbWl6ZXJQbHVnaW4oe1xuICAgICAgICAgICAgICBzdXBwb3J0ZWRCcm93c2VyczogYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICB9LFxuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2lucyxcbiAgfTtcbn1cbiJdfQ==