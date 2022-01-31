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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
    const sassImplementation = getSassImplementation();
    if (sassImplementation instanceof sass_service_1.SassWorkerImplementation) {
        extraPlugins.push({
            apply(compiler) {
                compiler.hooks.shutdown.tap('sass-worker', () => {
                    sassImplementation === null || sassImplementation === void 0 ? void 0 : sassImplementation.close();
                });
            },
        });
    }
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
function getSassImplementation() {
    const { webcontainer } = process.versions;
    // When `webcontainer` is a truthy it means that we are running in a StackBlitz webcontainer.
    // `SassWorkerImplementation` uses `receiveMessageOnPort` Node.js `worker_thread` API to ensure sync behavior which is ~2x faster.
    // However, it is non trivial to support this in a webcontainer and while slower we choose to use `dart-sass`
    // which in Webpack uses the slower async path.
    // We should periodically check with StackBlitz folks (Mark Whitfeld / Dominic Elm) to determine if this workaround is still needed.
    return webcontainer ? require('sass') : new sass_service_1.SassWorkerImplementation();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsdUNBQXlCO0FBQ3pCLHNGQUEyRDtBQUMzRCwyQ0FBNkI7QUFHN0IsMERBQW1FO0FBRW5FLHdDQUtvQjtBQUNwQiwwRUFBcUU7QUFDckUsOENBSTBCO0FBRTFCLFNBQVMsbUJBQW1CLENBQzFCLGdCQUFnQyxFQUNoQyxJQUFZLEVBQ1osZ0JBQXlCO0lBRXpCLE1BQU0sV0FBVyxHQUE2QixFQUFFLENBQUM7SUFDakQsTUFBTSxhQUFhLEdBQWEsRUFBRSxDQUFDO0lBQ25DLE1BQU0sS0FBSyxHQUFhLEVBQUUsQ0FBQztJQUUzQixJQUFJLGdCQUFnQixDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDakMsT0FBTyxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLENBQUM7S0FDOUM7SUFFRCxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUEsbUNBQXlCLEVBQUMsZ0JBQWdCLEVBQUUsUUFBUSxDQUFDLEVBQUU7UUFDekUsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ25ELElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxFQUFFO1lBQ2hDLElBQUk7Z0JBQ0YsWUFBWSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUNoRTtZQUFDLFdBQU0sR0FBRTtTQUNYO1FBRUQsSUFB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a0JBQWtCO2dDQUN2QixPQUFPLEVBQUUsZ0JBQWdCO2dDQUN6QixhQUFhLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxjQUFjLENBQUMsRUFBRTs2QkFDekM7NEJBQ0QsK0RBQStEOzRCQUMvRDtnQ0FDRSxHQUFHLEVBQUUscUJBQXFCO2dDQUMxQixJQUFJLEVBQUUsY0FBYztnQ0FDcEIsYUFBYSxFQUFFLGNBQWM7NkJBQzlCO3lCQUNGO3FCQUNGO29CQUNELEVBQUUsR0FBRyxFQUFFO2lCQUNSO2FBQ0YsQ0FBQyxDQUFDO1NBQ0o7UUFDRCxZQUFZLEVBQUU7WUFDWixTQUFTLEVBQUUsWUFBWSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsTUFBTTtnQkFDaEQsQ0FBQyxDQUFDO29CQUNFLElBQUkseUNBQWtCLENBQUM7d0JBQ3JCLGlCQUFpQixFQUFFLFlBQVksQ0FBQyxpQkFBaUI7cUJBQ2xELENBQUM7aUJBQ0g7Z0JBQ0gsQ0FBQyxDQUFDLFNBQVM7U0FDZDtRQUNELE9BQU8sRUFBRSxZQUFZO0tBQ3RCLENBQUM7QUFDSixDQUFDO0FBNVVELDBDQTRVQztBQUVELFNBQVMscUJBQXFCO0lBQzVCLE1BQU0sRUFBRSxZQUFZLEVBQUUsR0FBRyxPQUFPLENBQUMsUUFBOEMsQ0FBQztJQUVoRiw2RkFBNkY7SUFDN0Ysa0lBQWtJO0lBQ2xJLDZHQUE2RztJQUM3RywrQ0FBK0M7SUFDL0Msb0lBQW9JO0lBQ3BJLE9BQU8sWUFBWSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksdUNBQXdCLEVBQUUsQ0FBQztBQUN6RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCBNaW5pQ3NzRXh0cmFjdFBsdWdpbiBmcm9tICdtaW5pLWNzcy1leHRyYWN0LXBsdWdpbic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiwgUnVsZVNldFVzZUl0ZW0gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IFN0eWxlRWxlbWVudCB9IGZyb20gJy4uLy4uL2J1aWxkZXJzL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbiB9IGZyb20gJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQge1xuICBBbnlDb21wb25lbnRTdHlsZUJ1ZGdldENoZWNrZXIsXG4gIFBvc3Rjc3NDbGlSZXNvdXJjZXMsXG4gIFJlbW92ZUhhc2hQbHVnaW4sXG4gIFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4sXG59IGZyb20gJy4uL3BsdWdpbnMnO1xuaW1wb3J0IHsgQ3NzT3B0aW1pemVyUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy9jc3Mtb3B0aW1pemVyLXBsdWdpbic7XG5pbXBvcnQge1xuICBhc3NldE5hbWVUZW1wbGF0ZUZhY3RvcnksXG4gIGdldE91dHB1dEhhc2hGb3JtYXQsXG4gIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMsXG59IGZyb20gJy4uL3V0aWxzL2hlbHBlcnMnO1xuXG5mdW5jdGlvbiByZXNvbHZlR2xvYmFsU3R5bGVzKFxuICBzdHlsZUVudHJ5cG9pbnRzOiBTdHlsZUVsZW1lbnRbXSxcbiAgcm9vdDogc3RyaW5nLFxuICBwcmVzZXJ2ZVN5bWxpbmtzOiBib29sZWFuLFxuKTogeyBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+OyBub0luamVjdE5hbWVzOiBzdHJpbmdbXTsgcGF0aHM6IHN0cmluZ1tdIH0ge1xuICBjb25zdCBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge307XG4gIGNvbnN0IG5vSW5qZWN0TmFtZXM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGlmIChzdHlsZUVudHJ5cG9pbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB7IGVudHJ5UG9pbnRzLCBub0luamVjdE5hbWVzLCBwYXRocyB9O1xuICB9XG5cbiAgZm9yIChjb25zdCBzdHlsZSBvZiBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKHN0eWxlRW50cnlwb2ludHMsICdzdHlsZXMnKSkge1xuICAgIGxldCByZXNvbHZlZFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgc3R5bGUuaW5wdXQpO1xuICAgIGlmICghZnMuZXhpc3RzU3luYyhyZXNvbHZlZFBhdGgpKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXNvbHZlZFBhdGggPSByZXF1aXJlLnJlc29sdmUoc3R5bGUuaW5wdXQsIHsgcGF0aHM6IFtyb290XSB9KTtcbiAgICAgIH0gY2F0Y2gge31cbiAgICB9XG5cbiAgICBpZiAoIXByZXNlcnZlU3ltbGlua3MpIHtcbiAgICAgIHJlc29sdmVkUGF0aCA9IGZzLnJlYWxwYXRoU3luYyhyZXNvbHZlZFBhdGgpO1xuICAgIH1cblxuICAgIC8vIEFkZCBzdHlsZSBlbnRyeSBwb2ludHMuXG4gICAgaWYgKGVudHJ5UG9pbnRzW3N0eWxlLmJ1bmRsZU5hbWVdKSB7XG4gICAgICBlbnRyeVBvaW50c1tzdHlsZS5idW5kbGVOYW1lXS5wdXNoKHJlc29sdmVkUGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVudHJ5UG9pbnRzW3N0eWxlLmJ1bmRsZU5hbWVdID0gW3Jlc29sdmVkUGF0aF07XG4gICAgfVxuXG4gICAgLy8gQWRkIG5vbiBpbmplY3RlZCBzdHlsZXMgdG8gdGhlIGxpc3QuXG4gICAgaWYgKCFzdHlsZS5pbmplY3QpIHtcbiAgICAgIG5vSW5qZWN0TmFtZXMucHVzaChzdHlsZS5idW5kbGVOYW1lKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgZ2xvYmFsIGNzcyBwYXRocy5cbiAgICBwYXRocy5wdXNoKHJlc29sdmVkUGF0aCk7XG4gIH1cblxuICByZXR1cm4geyBlbnRyeVBvaW50cywgbm9JbmplY3ROYW1lcywgcGF0aHMgfTtcbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBnZXRTdHlsZXNDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IENvbmZpZ3VyYXRpb24ge1xuICBjb25zdCBwb3N0Y3NzSW1wb3J0cyA9IHJlcXVpcmUoJ3Bvc3Rjc3MtaW1wb3J0Jyk7XG4gIGNvbnN0IHBvc3Rjc3NQcmVzZXRFbnY6IHR5cGVvZiBpbXBvcnQoJ3Bvc3Rjc3MtcHJlc2V0LWVudicpID0gcmVxdWlyZSgncG9zdGNzcy1wcmVzZXQtZW52Jyk7XG5cbiAgY29uc3QgeyByb290LCBidWlsZE9wdGlvbnMgfSA9IHdjbztcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiBDb25maWd1cmF0aW9uWydwbHVnaW5zJ10gPSBbXTtcblxuICBleHRyYVBsdWdpbnMucHVzaChuZXcgQW55Q29tcG9uZW50U3R5bGVCdWRnZXRDaGVja2VyKGJ1aWxkT3B0aW9ucy5idWRnZXRzKSk7XG5cbiAgY29uc3QgY3NzU291cmNlTWFwID0gYnVpbGRPcHRpb25zLnNvdXJjZU1hcC5zdHlsZXM7XG5cbiAgLy8gRGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0LlxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyBhcyBzdHJpbmcpO1xuXG4gIC8vIHVzZSBpbmNsdWRlUGF0aHMgZnJvbSBhcHBDb25maWdcbiAgY29uc3QgaW5jbHVkZVBhdGhzID1cbiAgICBidWlsZE9wdGlvbnMuc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zPy5pbmNsdWRlUGF0aHM/Lm1hcCgocCkgPT4gcGF0aC5yZXNvbHZlKHJvb3QsIHApKSA/PyBbXTtcblxuICAvLyBQcm9jZXNzIGdsb2JhbCBzdHlsZXMuXG4gIGNvbnN0IHtcbiAgICBlbnRyeVBvaW50cyxcbiAgICBub0luamVjdE5hbWVzLFxuICAgIHBhdGhzOiBnbG9iYWxTdHlsZVBhdGhzLFxuICB9ID0gcmVzb2x2ZUdsb2JhbFN0eWxlcyhidWlsZE9wdGlvbnMuc3R5bGVzLCByb290LCAhIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzKTtcbiAgaWYgKG5vSW5qZWN0TmFtZXMubGVuZ3RoID4gMCkge1xuICAgIC8vIEFkZCBwbHVnaW4gdG8gcmVtb3ZlIGhhc2hlcyBmcm9tIGxhenkgc3R5bGVzLlxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBSZW1vdmVIYXNoUGx1Z2luKHsgY2h1bmtOYW1lczogbm9JbmplY3ROYW1lcywgaGFzaEZvcm1hdCB9KSk7XG4gIH1cblxuICBpZiAoZ2xvYmFsU3R5bGVQYXRocy5zb21lKChwKSA9PiBwLmVuZHNXaXRoKCcuc3R5bCcpKSkge1xuICAgIHdjby5sb2dnZXIud2FybihcbiAgICAgICdTdHlsdXMgdXNhZ2UgaXMgZGVwcmVjYXRlZCBhbmQgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIG1ham9yIHZlcnNpb24uICcgK1xuICAgICAgICAnVG8gb3B0LW91dCBvZiB0aGUgZGVwcmVjYXRlZCBiZWhhdmlvdXIsIHBsZWFzZSBtaWdyYXRlIHRvIGFub3RoZXIgc3R5bGVzaGVldCBsYW5ndWFnZS4nLFxuICAgICk7XG4gIH1cblxuICBjb25zdCBzYXNzSW1wbGVtZW50YXRpb24gPSBnZXRTYXNzSW1wbGVtZW50YXRpb24oKTtcbiAgaWYgKHNhc3NJbXBsZW1lbnRhdGlvbiBpbnN0YW5jZW9mIFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbikge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKHtcbiAgICAgIGFwcGx5KGNvbXBpbGVyKSB7XG4gICAgICAgIGNvbXBpbGVyLmhvb2tzLnNodXRkb3duLnRhcCgnc2Fzcy13b3JrZXInLCAoKSA9PiB7XG4gICAgICAgICAgc2Fzc0ltcGxlbWVudGF0aW9uPy5jbG9zZSgpO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBhc3NldE5hbWVUZW1wbGF0ZSA9IGFzc2V0TmFtZVRlbXBsYXRlRmFjdG9yeShoYXNoRm9ybWF0KTtcblxuICBjb25zdCBleHRyYVBvc3Rjc3NQbHVnaW5zOiBpbXBvcnQoJ3Bvc3Rjc3MnKS5QbHVnaW5bXSA9IFtdO1xuXG4gIC8vIEF0dGVtcHQgdG8gc2V0dXAgVGFpbHdpbmQgQ1NTXG4gIC8vIEEgY29uZmlndXJhdGlvbiBmaWxlIGNhbiBleGlzdCBpbiB0aGUgcHJvamVjdCBvciB3b3Jrc3BhY2Ugcm9vdFxuICBjb25zdCB0YWlsd2luZENvbmZpZ0ZpbGUgPSAndGFpbHdpbmQuY29uZmlnLmpzJztcbiAgbGV0IHRhaWx3aW5kQ29uZmlnUGF0aDtcbiAgZm9yIChjb25zdCBiYXNlUGF0aCBvZiBbd2NvLnByb2plY3RSb290LCB3Y28ucm9vdF0pIHtcbiAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihiYXNlUGF0aCwgdGFpbHdpbmRDb25maWdGaWxlKTtcbiAgICBpZiAoZnMuZXhpc3RzU3luYyhmdWxsUGF0aCkpIHtcbiAgICAgIHRhaWx3aW5kQ29uZmlnUGF0aCA9IGZ1bGxQYXRoO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIC8vIE9ubHkgbG9hZCBUYWlsd2luZCBDU1MgcGx1Z2luIGlmIGNvbmZpZ3VyYXRpb24gZmlsZSB3YXMgZm91bmQuXG4gIC8vIFRoaXMgYWN0cyBhcyBhIGd1YXJkIHRvIGVuc3VyZSB0aGUgcHJvamVjdCBhY3R1YWxseSB3YW50cyB0byB1c2UgVGFpbHdpbmQgQ1NTLlxuICAvLyBUaGUgcGFja2FnZSBtYXkgYmUgdW5rbm93bmluZ2x5IHByZXNlbnQgZHVlIHRvIGEgdGhpcmQtcGFydHkgdHJhbnNpdGl2ZSBwYWNrYWdlIGRlcGVuZGVuY3kuXG4gIGlmICh0YWlsd2luZENvbmZpZ1BhdGgpIHtcbiAgICBsZXQgdGFpbHdpbmRQYWNrYWdlUGF0aDtcbiAgICB0cnkge1xuICAgICAgdGFpbHdpbmRQYWNrYWdlUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgndGFpbHdpbmRjc3MnLCB7IHBhdGhzOiBbd2NvLnJvb3RdIH0pO1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29uc3QgcmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGggPSBwYXRoLnJlbGF0aXZlKHdjby5yb290LCB0YWlsd2luZENvbmZpZ1BhdGgpO1xuICAgICAgd2NvLmxvZ2dlci53YXJuKFxuICAgICAgICBgVGFpbHdpbmQgQ1NTIGNvbmZpZ3VyYXRpb24gZmlsZSBmb3VuZCAoJHtyZWxhdGl2ZVRhaWx3aW5kQ29uZmlnUGF0aH0pYCArXG4gICAgICAgICAgYCBidXQgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZSBpcyBub3QgaW5zdGFsbGVkLmAgK1xuICAgICAgICAgIGAgVG8gZW5hYmxlIFRhaWx3aW5kIENTUywgcGxlYXNlIGluc3RhbGwgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZS5gLFxuICAgICAgKTtcbiAgICB9XG4gICAgaWYgKHRhaWx3aW5kUGFja2FnZVBhdGgpIHtcbiAgICAgIGV4dHJhUG9zdGNzc1BsdWdpbnMucHVzaChyZXF1aXJlKHRhaWx3aW5kUGFja2FnZVBhdGgpKHsgY29uZmlnOiB0YWlsd2luZENvbmZpZ1BhdGggfSkpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHBvc3Rjc3NQcmVzZXRFbnZQbHVnaW4gPSBwb3N0Y3NzUHJlc2V0RW52KHtcbiAgICBicm93c2VyczogYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgIGF1dG9wcmVmaXhlcjogdHJ1ZSxcbiAgICBzdGFnZTogMyxcbiAgfSk7XG4gIGNvbnN0IHBvc3Rjc3NPcHRpb25zQ3JlYXRvciA9IChpbmxpbmVTb3VyY2VtYXBzOiBib29sZWFuLCBleHRyYWN0ZWQ6IGJvb2xlYW4pID0+IHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGNvbnN0IG9wdGlvbkdlbmVyYXRvciA9IChsb2FkZXI6IGFueSkgPT4gKHtcbiAgICAgIG1hcDogaW5saW5lU291cmNlbWFwc1xuICAgICAgICA/IHtcbiAgICAgICAgICAgIGlubGluZTogdHJ1ZSxcbiAgICAgICAgICAgIGFubm90YXRpb246IGZhbHNlLFxuICAgICAgICAgIH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICBwbHVnaW5zOiBbXG4gICAgICAgIHBvc3Rjc3NJbXBvcnRzKHtcbiAgICAgICAgICByZXNvbHZlOiAodXJsOiBzdHJpbmcpID0+ICh1cmwuc3RhcnRzV2l0aCgnficpID8gdXJsLnN1YnN0cigxKSA6IHVybCksXG4gICAgICAgICAgbG9hZDogKGZpbGVuYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgbG9hZGVyLmZzLnJlYWRGaWxlKGZpbGVuYW1lLCAoZXJyOiBFcnJvciwgZGF0YTogQnVmZmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoY29udGVudCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICAgIFBvc3Rjc3NDbGlSZXNvdXJjZXMoe1xuICAgICAgICAgIGJhc2VIcmVmOiBidWlsZE9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgICAgZGVwbG95VXJsOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgICAgIHJlc291cmNlc091dHB1dFBhdGg6IGJ1aWxkT3B0aW9ucy5yZXNvdXJjZXNPdXRwdXRQYXRoLFxuICAgICAgICAgIGxvYWRlcixcbiAgICAgICAgICBmaWxlbmFtZTogYXNzZXROYW1lVGVtcGxhdGUsXG4gICAgICAgICAgZW1pdEZpbGU6IGJ1aWxkT3B0aW9ucy5wbGF0Zm9ybSAhPT0gJ3NlcnZlcicsXG4gICAgICAgICAgZXh0cmFjdGVkLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uZXh0cmFQb3N0Y3NzUGx1Z2lucyxcbiAgICAgICAgcG9zdGNzc1ByZXNldEVudlBsdWdpbixcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgLy8gcG9zdGNzcy1sb2FkZXIgZmFpbHMgd2hlbiB0cnlpbmcgdG8gZGV0ZXJtaW5lIGNvbmZpZ3VyYXRpb24gZmlsZXMgZm9yIGRhdGEgVVJJc1xuICAgIG9wdGlvbkdlbmVyYXRvci5jb25maWcgPSBmYWxzZTtcblxuICAgIHJldHVybiBvcHRpb25HZW5lcmF0b3I7XG4gIH07XG5cbiAgLy8gbG9hZCBjb21wb25lbnQgY3NzIGFzIHJhdyBzdHJpbmdzXG4gIGNvbnN0IGNvbXBvbmVudHNTb3VyY2VNYXAgPSAhIShcbiAgICBjc3NTb3VyY2VNYXAgJiZcbiAgICAvLyBOZXZlciB1c2UgY29tcG9uZW50IGNzcyBzb3VyY2VtYXAgd2hlbiBzdHlsZSBvcHRpbWl6YXRpb25zIGFyZSBvbi5cbiAgICAvLyBJdCB3aWxsIGp1c3QgaW5jcmVhc2UgYnVuZGxlIHNpemUgd2l0aG91dCBvZmZlcmluZyBnb29kIGRlYnVnIGV4cGVyaWVuY2UuXG4gICAgIWJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24uc3R5bGVzLm1pbmlmeSAmJlxuICAgIC8vIElubGluZSBhbGwgc291cmNlbWFwIHR5cGVzIGV4Y2VwdCBoaWRkZW4gb25lcywgd2hpY2ggYXJlIHRoZSBzYW1lIGFzIG5vIHNvdXJjZW1hcHNcbiAgICAvLyBmb3IgY29tcG9uZW50IGNzcy5cbiAgICAhYnVpbGRPcHRpb25zLnNvdXJjZU1hcC5oaWRkZW5cbiAgKTtcblxuICAvLyBleHRyYWN0IGdsb2JhbCBjc3MgZnJvbSBqcyBmaWxlcyBpbnRvIG93biBjc3MgZmlsZS5cbiAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IE1pbmlDc3NFeHRyYWN0UGx1Z2luKHsgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuZXh0cmFjdH0uY3NzYCB9KSk7XG5cbiAgaWYgKCFidWlsZE9wdGlvbnMuaG1yKSB7XG4gICAgLy8gZG9uJ3QgcmVtb3ZlIGAuanNgIGZpbGVzIGZvciBgLmNzc2Agd2hlbiB3ZSBhcmUgdXNpbmcgSE1SIHRoZXNlIGNvbnRhaW4gSE1SIGFjY2VwdCBjb2Rlcy5cbiAgICAvLyBzdXBwcmVzcyBlbXB0eSAuanMgZmlsZXMgaW4gY3NzIG9ubHkgZW50cnkgcG9pbnRzLlxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBTdXBwcmVzc0V4dHJhY3RlZFRleHRDaHVua3NXZWJwYWNrUGx1Z2luKCkpO1xuICB9XG5cbiAgY29uc3QgcG9zdENzcyA9IHJlcXVpcmUoJ3Bvc3Rjc3MnKTtcbiAgY29uc3QgcG9zdENzc0xvYWRlclBhdGggPSByZXF1aXJlLnJlc29sdmUoJ3Bvc3Rjc3MtbG9hZGVyJyk7XG5cbiAgY29uc3QgY29tcG9uZW50U3R5bGVMb2FkZXJzOiBSdWxlU2V0VXNlSXRlbVtdID0gW1xuICAgIHtcbiAgICAgIGxvYWRlcjogcG9zdENzc0xvYWRlclBhdGgsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBwb3N0Q3NzLFxuICAgICAgICBwb3N0Y3NzT3B0aW9uczogcG9zdGNzc09wdGlvbnNDcmVhdG9yKGNvbXBvbmVudHNTb3VyY2VNYXAsIGZhbHNlKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgXTtcblxuICBjb25zdCBnbG9iYWxTdHlsZUxvYWRlcnM6IFJ1bGVTZXRVc2VJdGVtW10gPSBbXG4gICAge1xuICAgICAgbG9hZGVyOiBNaW5pQ3NzRXh0cmFjdFBsdWdpbi5sb2FkZXIsXG4gICAgfSxcbiAgICB7XG4gICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnY3NzLWxvYWRlcicpLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICB1cmw6IGZhbHNlLFxuICAgICAgICBzb3VyY2VNYXA6ICEhY3NzU291cmNlTWFwLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGxvYWRlcjogcG9zdENzc0xvYWRlclBhdGgsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBwb3N0Q3NzLFxuICAgICAgICBwb3N0Y3NzT3B0aW9uczogcG9zdGNzc09wdGlvbnNDcmVhdG9yKGZhbHNlLCB0cnVlKSxcbiAgICAgICAgc291cmNlTWFwOiAhIWNzc1NvdXJjZU1hcCxcbiAgICAgIH0sXG4gICAgfSxcbiAgXTtcblxuICBjb25zdCBzdHlsZUxhbmd1YWdlczoge1xuICAgIGV4dGVuc2lvbnM6IHN0cmluZ1tdO1xuICAgIHVzZTogUnVsZVNldFVzZUl0ZW1bXTtcbiAgfVtdID0gW1xuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnY3NzJ10sXG4gICAgICB1c2U6IFtdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydzY3NzJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdyZXNvbHZlLXVybC1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Nhc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgaW1wbGVtZW50YXRpb246IHNhc3NJbXBsZW1lbnRhdGlvbixcbiAgICAgICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcbiAgICAgICAgICAgIHNhc3NPcHRpb25zOiB7XG4gICAgICAgICAgICAgIC8vIFByZXZlbnQgdXNlIG9mIGBmaWJlcnNgIHBhY2thZ2UgYXMgaXQgbm8gbG9uZ2VyIHdvcmtzIGluIG5ld2VyIE5vZGUuanMgdmVyc2lvbnNcbiAgICAgICAgICAgICAgZmliZXI6IGZhbHNlLFxuICAgICAgICAgICAgICAvLyBib290c3RyYXAtc2FzcyByZXF1aXJlcyBhIG1pbmltdW0gcHJlY2lzaW9uIG9mIDhcbiAgICAgICAgICAgICAgcHJlY2lzaW9uOiA4LFxuICAgICAgICAgICAgICBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICAgIC8vIFVzZSBleHBhbmRlZCBhcyBvdGhlcndpc2Ugc2FzcyB3aWxsIHJlbW92ZSBjb21tZW50cyB0aGF0IGFyZSBuZWVkZWQgZm9yIGF1dG9wcmVmaXhlclxuICAgICAgICAgICAgICAvLyBFeDogLyogYXV0b3ByZWZpeGVyIGdyaWQ6IGF1dG9wbGFjZSAqL1xuICAgICAgICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc2Fzcy1sb2FkZXIvYmxvYi80NWFkMGJlMTcyNjRjZWFkYTVmMGI0ZmI4N2U5MzU3YWJlODVjNGZmL3NyYy9nZXRTYXNzT3B0aW9ucy5qcyNMNjgtTDcwXG4gICAgICAgICAgICAgIG91dHB1dFN0eWxlOiAnZXhwYW5kZWQnLFxuICAgICAgICAgICAgICAvLyBTaWxlbmNlcyBjb21waWxlciB3YXJuaW5ncyBmcm9tIDNyZCBwYXJ0eSBzdHlsZXNoZWV0c1xuICAgICAgICAgICAgICBxdWlldERlcHM6ICFidWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgICAgICAgdmVyYm9zZTogYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydzYXNzJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdyZXNvbHZlLXVybC1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Nhc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgaW1wbGVtZW50YXRpb246IHNhc3NJbXBsZW1lbnRhdGlvbixcbiAgICAgICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcbiAgICAgICAgICAgIHNhc3NPcHRpb25zOiB7XG4gICAgICAgICAgICAgIC8vIFByZXZlbnQgdXNlIG9mIGBmaWJlcnNgIHBhY2thZ2UgYXMgaXQgbm8gbG9uZ2VyIHdvcmtzIGluIG5ld2VyIE5vZGUuanMgdmVyc2lvbnNcbiAgICAgICAgICAgICAgZmliZXI6IGZhbHNlLFxuICAgICAgICAgICAgICBpbmRlbnRlZFN5bnRheDogdHJ1ZSxcbiAgICAgICAgICAgICAgLy8gYm9vdHN0cmFwLXNhc3MgcmVxdWlyZXMgYSBtaW5pbXVtIHByZWNpc2lvbiBvZiA4XG4gICAgICAgICAgICAgIHByZWNpc2lvbjogOCxcbiAgICAgICAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgICAvLyBVc2UgZXhwYW5kZWQgYXMgb3RoZXJ3aXNlIHNhc3Mgd2lsbCByZW1vdmUgY29tbWVudHMgdGhhdCBhcmUgbmVlZGVkIGZvciBhdXRvcHJlZml4ZXJcbiAgICAgICAgICAgICAgLy8gRXg6IC8qIGF1dG9wcmVmaXhlciBncmlkOiBhdXRvcGxhY2UgKi9cbiAgICAgICAgICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3Nhc3MtbG9hZGVyL2Jsb2IvNDVhZDBiZTE3MjY0Y2VhZGE1ZjBiNGZiODdlOTM1N2FiZTg1YzRmZi9zcmMvZ2V0U2Fzc09wdGlvbnMuanMjTDY4LUw3MFxuICAgICAgICAgICAgICBvdXRwdXRTdHlsZTogJ2V4cGFuZGVkJyxcbiAgICAgICAgICAgICAgLy8gU2lsZW5jZXMgY29tcGlsZXIgd2FybmluZ3MgZnJvbSAzcmQgcGFydHkgc3R5bGVzaGVldHNcbiAgICAgICAgICAgICAgcXVpZXREZXBzOiAhYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgICAgIHZlcmJvc2U6IGJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnbGVzcyddLFxuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnbGVzcy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBpbXBsZW1lbnRhdGlvbjogcmVxdWlyZSgnbGVzcycpLFxuICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgICBsZXNzT3B0aW9uczoge1xuICAgICAgICAgICAgICBqYXZhc2NyaXB0RW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgcGF0aHM6IGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ3N0eWwnXSxcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3N0eWx1cy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICAgIHN0eWx1c09wdGlvbnM6IHtcbiAgICAgICAgICAgICAgY29tcHJlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICBzb3VyY2VNYXA6IHsgY29tbWVudDogZmFsc2UgfSxcbiAgICAgICAgICAgICAgcGF0aHM6IGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgXTtcblxuICByZXR1cm4ge1xuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBtb2R1bGU6IHtcbiAgICAgIHJ1bGVzOiBzdHlsZUxhbmd1YWdlcy5tYXAoKHsgZXh0ZW5zaW9ucywgdXNlIH0pID0+ICh7XG4gICAgICAgIHRlc3Q6IG5ldyBSZWdFeHAoYFxcXFwuKD86JHtleHRlbnNpb25zLmpvaW4oJ3wnKX0pJGAsICdpJyksXG4gICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAgLy8gU2V0dXAgcHJvY2Vzc2luZyBydWxlcyBmb3IgZ2xvYmFsIGFuZCBjb21wb25lbnQgc3R5bGVzXG4gICAgICAgICAge1xuICAgICAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICAgICAgLy8gR2xvYmFsIHN0eWxlcyBhcmUgb25seSBkZWZpbmVkIGdsb2JhbCBzdHlsZXNcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVzZTogZ2xvYmFsU3R5bGVMb2FkZXJzLFxuICAgICAgICAgICAgICAgIGluY2x1ZGU6IGdsb2JhbFN0eWxlUGF0aHMsXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VRdWVyeTogeyBub3Q6IFsvXFw/bmdSZXNvdXJjZS9dIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXMgYXJlIGFsbCBzdHlsZXMgZXhjZXB0IGRlZmluZWQgZ2xvYmFsIHN0eWxlc1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdXNlOiBjb21wb25lbnRTdHlsZUxvYWRlcnMsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2Fzc2V0L3NvdXJjZScsXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VRdWVyeTogL1xcP25nUmVzb3VyY2UvLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHsgdXNlIH0sXG4gICAgICAgIF0sXG4gICAgICB9KSksXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG1pbmltaXplcjogYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbi5zdHlsZXMubWluaWZ5XG4gICAgICAgID8gW1xuICAgICAgICAgICAgbmV3IENzc09wdGltaXplclBsdWdpbih7XG4gICAgICAgICAgICAgIHN1cHBvcnRlZEJyb3dzZXJzOiBidWlsZE9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdXG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLFxuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRTYXNzSW1wbGVtZW50YXRpb24oKTogU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uIHwgdHlwZW9mIGltcG9ydCgnc2FzcycpIHtcbiAgY29uc3QgeyB3ZWJjb250YWluZXIgfSA9IHByb2Nlc3MudmVyc2lvbnMgYXMgdW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcblxuICAvLyBXaGVuIGB3ZWJjb250YWluZXJgIGlzIGEgdHJ1dGh5IGl0IG1lYW5zIHRoYXQgd2UgYXJlIHJ1bm5pbmcgaW4gYSBTdGFja0JsaXR6IHdlYmNvbnRhaW5lci5cbiAgLy8gYFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbmAgdXNlcyBgcmVjZWl2ZU1lc3NhZ2VPblBvcnRgIE5vZGUuanMgYHdvcmtlcl90aHJlYWRgIEFQSSB0byBlbnN1cmUgc3luYyBiZWhhdmlvciB3aGljaCBpcyB+MnggZmFzdGVyLlxuICAvLyBIb3dldmVyLCBpdCBpcyBub24gdHJpdmlhbCB0byBzdXBwb3J0IHRoaXMgaW4gYSB3ZWJjb250YWluZXIgYW5kIHdoaWxlIHNsb3dlciB3ZSBjaG9vc2UgdG8gdXNlIGBkYXJ0LXNhc3NgXG4gIC8vIHdoaWNoIGluIFdlYnBhY2sgdXNlcyB0aGUgc2xvd2VyIGFzeW5jIHBhdGguXG4gIC8vIFdlIHNob3VsZCBwZXJpb2RpY2FsbHkgY2hlY2sgd2l0aCBTdGFja0JsaXR6IGZvbGtzIChNYXJrIFdoaXRmZWxkIC8gRG9taW5pYyBFbG0pIHRvIGRldGVybWluZSBpZiB0aGlzIHdvcmthcm91bmQgaXMgc3RpbGwgbmVlZGVkLlxuICByZXR1cm4gd2ViY29udGFpbmVyID8gcmVxdWlyZSgnc2FzcycpIDogbmV3IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbigpO1xufVxuIl19