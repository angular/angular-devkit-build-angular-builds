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
const webpack_1 = require("webpack");
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
    const sassTildeUsageMessage = new Set();
    extraPlugins.push({
        apply(compiler) {
            compiler.hooks.shutdown.tap('sass-worker', () => {
                sassImplementation.close();
            });
            compiler.hooks.afterCompile.tap('sass-worker', (compilation) => {
                for (const message of sassTildeUsageMessage) {
                    compilation.warnings.push(new webpack_1.WebpackError(message));
                }
                sassTildeUsageMessage.clear();
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
    const postcssImports = require('postcss-import');
    const autoprefixer = require('autoprefixer');
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
                autoprefixer({
                    ignoreUnknownVersions: true,
                    overrideBrowserslist: buildOptions.supportedBrowsers,
                }),
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
                            importer: (url, from) => {
                                if (url.charAt(0) === '~') {
                                    sassTildeUsageMessage.add(`'${from}' imports '${url}' with a tilde. Usage of '~' in imports is deprecated.`);
                                }
                                return null;
                            },
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
                            importer: (url, from) => {
                                if (url.charAt(0) === '~') {
                                    sassTildeUsageMessage.add(`'${from}' imports '${url}' with a tilde. Usage of '~' in imports is deprecated.`);
                                }
                                return null;
                            },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHVDQUF5QjtBQUN6QixzRkFBMkQ7QUFDM0QsMkNBQTZCO0FBQzdCLHFDQUFzRTtBQUV0RSwwREFBbUU7QUFFbkUsd0NBS29CO0FBQ3BCLDBFQUFxRTtBQUNyRSw4Q0FJMEI7QUFFMUIsU0FBZ0IsbUJBQW1CLENBQ2pDLGdCQUFnQyxFQUNoQyxJQUFZLEVBQ1osZ0JBQXlCLEVBQ3pCLGNBQWMsR0FBRyxLQUFLO0lBRXRCLE1BQU0sV0FBVyxHQUE2QixFQUFFLENBQUM7SUFDakQsTUFBTSxhQUFhLEdBQWEsRUFBRSxDQUFDO0lBQ25DLE1BQU0sS0FBSyxHQUFhLEVBQUUsQ0FBQztJQUUzQixJQUFJLGdCQUFnQixDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDakMsT0FBTyxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLENBQUM7S0FDOUM7SUFFRCxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUEsbUNBQXlCLEVBQUMsZ0JBQWdCLEVBQUUsUUFBUSxDQUFDLEVBQUU7UUFDekUsSUFBSSxjQUFjLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQztRQUNqQyxJQUFJLENBQUMsY0FBYyxFQUFFO1lBQ25CLGNBQWMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQztZQUNwRCxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsRUFBRTtnQkFDbEMsSUFBSTtvQkFDRixjQUFjLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENB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O0FBQ0osQ0FBQztBQTNWRCwwQ0EyVkM7QUFFRCxTQUFTLHFCQUFxQixDQUFDLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBd0I7SUFDeEUsa0VBQWtFO0lBQ2xFLCtDQUErQztJQUMvQyxrSUFBa0k7SUFDbEksTUFBTSxtQkFBbUIsR0FBRyxDQUFDLG9CQUFvQixFQUFFLHFCQUFxQixDQUFDLENBQUM7SUFDMUUsS0FBSyxNQUFNLFFBQVEsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsRUFBRTtRQUMxQyxLQUFLLE1BQU0sVUFBVSxJQUFJLG1CQUFtQixFQUFFO1lBQzVDLHNGQUFzRjtZQUN0RixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxVQUFVLENBQUMsQ0FBQztZQUNqRCxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQzNCLE9BQU8sUUFBUSxDQUFDO2FBQ2pCO1NBQ0Y7S0FDRjtJQUVELE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IE1pbmlDc3NFeHRyYWN0UGx1Z2luIGZyb20gJ21pbmktY3NzLWV4dHJhY3QtcGx1Z2luJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uLCBSdWxlU2V0VXNlSXRlbSwgV2VicGFja0Vycm9yIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBTdHlsZUVsZW1lbnQgfSBmcm9tICcuLi8uLi9idWlsZGVycy9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBTYXNzV29ya2VySW1wbGVtZW50YXRpb24gfSBmcm9tICcuLi8uLi9zYXNzL3Nhc3Mtc2VydmljZSc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHtcbiAgQW55Q29tcG9uZW50U3R5bGVCdWRnZXRDaGVja2VyLFxuICBQb3N0Y3NzQ2xpUmVzb3VyY2VzLFxuICBSZW1vdmVIYXNoUGx1Z2luLFxuICBTdXBwcmVzc0V4dHJhY3RlZFRleHRDaHVua3NXZWJwYWNrUGx1Z2luLFxufSBmcm9tICcuLi9wbHVnaW5zJztcbmltcG9ydCB7IENzc09wdGltaXplclBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvY3NzLW9wdGltaXplci1wbHVnaW4nO1xuaW1wb3J0IHtcbiAgYXNzZXROYW1lVGVtcGxhdGVGYWN0b3J5LFxuICBnZXRPdXRwdXRIYXNoRm9ybWF0LFxuICBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzLFxufSBmcm9tICcuLi91dGlscy9oZWxwZXJzJztcblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVHbG9iYWxTdHlsZXMoXG4gIHN0eWxlRW50cnlwb2ludHM6IFN0eWxlRWxlbWVudFtdLFxuICByb290OiBzdHJpbmcsXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4sXG4gIHNraXBSZXNvbHV0aW9uID0gZmFsc2UsXG4pOiB7IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT47IG5vSW5qZWN0TmFtZXM6IHN0cmluZ1tdOyBwYXRoczogc3RyaW5nW10gfSB7XG4gIGNvbnN0IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7fTtcbiAgY29uc3Qgbm9JbmplY3ROYW1lczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgcGF0aHM6IHN0cmluZ1tdID0gW107XG5cbiAgaWYgKHN0eWxlRW50cnlwb2ludHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHsgZW50cnlQb2ludHMsIG5vSW5qZWN0TmFtZXMsIHBhdGhzIH07XG4gIH1cblxuICBmb3IgKGNvbnN0IHN0eWxlIG9mIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoc3R5bGVFbnRyeXBvaW50cywgJ3N0eWxlcycpKSB7XG4gICAgbGV0IHN0eWxlc2hlZXRQYXRoID0gc3R5bGUuaW5wdXQ7XG4gICAgaWYgKCFza2lwUmVzb2x1dGlvbikge1xuICAgICAgc3R5bGVzaGVldFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgc3R5bGVzaGVldFBhdGgpO1xuICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHN0eWxlc2hlZXRQYXRoKSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHN0eWxlc2hlZXRQYXRoID0gcmVxdWlyZS5yZXNvbHZlKHN0eWxlLmlucHV0LCB7IHBhdGhzOiBbcm9vdF0gfSk7XG4gICAgICAgIH0gY2F0Y2gge31cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXByZXNlcnZlU3ltbGlua3MpIHtcbiAgICAgIHN0eWxlc2hlZXRQYXRoID0gZnMucmVhbHBhdGhTeW5jKHN0eWxlc2hlZXRQYXRoKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgc3R5bGUgZW50cnkgcG9pbnRzLlxuICAgIGlmIChlbnRyeVBvaW50c1tzdHlsZS5idW5kbGVOYW1lXSkge1xuICAgICAgZW50cnlQb2ludHNbc3R5bGUuYnVuZGxlTmFtZV0ucHVzaChzdHlsZXNoZWV0UGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVudHJ5UG9pbnRzW3N0eWxlLmJ1bmRsZU5hbWVdID0gW3N0eWxlc2hlZXRQYXRoXTtcbiAgICB9XG5cbiAgICAvLyBBZGQgbm9uIGluamVjdGVkIHN0eWxlcyB0byB0aGUgbGlzdC5cbiAgICBpZiAoIXN0eWxlLmluamVjdCkge1xuICAgICAgbm9JbmplY3ROYW1lcy5wdXNoKHN0eWxlLmJ1bmRsZU5hbWUpO1xuICAgIH1cblxuICAgIC8vIEFkZCBnbG9iYWwgY3NzIHBhdGhzLlxuICAgIHBhdGhzLnB1c2goc3R5bGVzaGVldFBhdGgpO1xuICB9XG5cbiAgcmV0dXJuIHsgZW50cnlQb2ludHMsIG5vSW5qZWN0TmFtZXMsIHBhdGhzIH07XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3R5bGVzQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpOiBDb25maWd1cmF0aW9uIHtcbiAgY29uc3QgeyByb290LCBidWlsZE9wdGlvbnMgfSA9IHdjbztcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiBDb25maWd1cmF0aW9uWydwbHVnaW5zJ10gPSBbXTtcblxuICBleHRyYVBsdWdpbnMucHVzaChuZXcgQW55Q29tcG9uZW50U3R5bGVCdWRnZXRDaGVja2VyKGJ1aWxkT3B0aW9ucy5idWRnZXRzKSk7XG5cbiAgY29uc3QgY3NzU291cmNlTWFwID0gYnVpbGRPcHRpb25zLnNvdXJjZU1hcC5zdHlsZXM7XG5cbiAgLy8gRGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0LlxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyk7XG5cbiAgLy8gdXNlIGluY2x1ZGVQYXRocyBmcm9tIGFwcENvbmZpZ1xuICBjb25zdCBpbmNsdWRlUGF0aHMgPVxuICAgIGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocz8ubWFwKChwKSA9PiBwYXRoLnJlc29sdmUocm9vdCwgcCkpID8/IFtdO1xuXG4gIC8vIFByb2Nlc3MgZ2xvYmFsIHN0eWxlcy5cbiAgY29uc3Qge1xuICAgIGVudHJ5UG9pbnRzLFxuICAgIG5vSW5qZWN0TmFtZXMsXG4gICAgcGF0aHM6IGdsb2JhbFN0eWxlUGF0aHMsXG4gIH0gPSByZXNvbHZlR2xvYmFsU3R5bGVzKGJ1aWxkT3B0aW9ucy5zdHlsZXMsIHJvb3QsICEhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MpO1xuICBpZiAobm9JbmplY3ROYW1lcy5sZW5ndGggPiAwKSB7XG4gICAgLy8gQWRkIHBsdWdpbiB0byByZW1vdmUgaGFzaGVzIGZyb20gbGF6eSBzdHlsZXMuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFJlbW92ZUhhc2hQbHVnaW4oeyBjaHVua05hbWVzOiBub0luamVjdE5hbWVzLCBoYXNoRm9ybWF0IH0pKTtcbiAgfVxuXG4gIGlmIChnbG9iYWxTdHlsZVBhdGhzLnNvbWUoKHApID0+IHAuZW5kc1dpdGgoJy5zdHlsJykpKSB7XG4gICAgd2NvLmxvZ2dlci53YXJuKFxuICAgICAgJ1N0eWx1cyB1c2FnZSBpcyBkZXByZWNhdGVkIGFuZCB3aWxsIGJlIHJlbW92ZWQgaW4gYSBmdXR1cmUgbWFqb3IgdmVyc2lvbi4gJyArXG4gICAgICAgICdUbyBvcHQtb3V0IG9mIHRoZSBkZXByZWNhdGVkIGJlaGF2aW91ciwgcGxlYXNlIG1pZ3JhdGUgdG8gYW5vdGhlciBzdHlsZXNoZWV0IGxhbmd1YWdlLicsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHNhc3NJbXBsZW1lbnRhdGlvbiA9IG5ldyBTYXNzV29ya2VySW1wbGVtZW50YXRpb24oKTtcbiAgY29uc3Qgc2Fzc1RpbGRlVXNhZ2VNZXNzYWdlID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgZXh0cmFQbHVnaW5zLnB1c2goe1xuICAgIGFwcGx5KGNvbXBpbGVyKSB7XG4gICAgICBjb21waWxlci5ob29rcy5zaHV0ZG93bi50YXAoJ3Nhc3Mtd29ya2VyJywgKCkgPT4ge1xuICAgICAgICBzYXNzSW1wbGVtZW50YXRpb24uY2xvc2UoKTtcbiAgICAgIH0pO1xuXG4gICAgICBjb21waWxlci5ob29rcy5hZnRlckNvbXBpbGUudGFwKCdzYXNzLXdvcmtlcicsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgICBmb3IgKGNvbnN0IG1lc3NhZ2Ugb2Ygc2Fzc1RpbGRlVXNhZ2VNZXNzYWdlKSB7XG4gICAgICAgICAgY29tcGlsYXRpb24ud2FybmluZ3MucHVzaChuZXcgV2VicGFja0Vycm9yKG1lc3NhZ2UpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNhc3NUaWxkZVVzYWdlTWVzc2FnZS5jbGVhcigpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG5cbiAgY29uc3QgYXNzZXROYW1lVGVtcGxhdGUgPSBhc3NldE5hbWVUZW1wbGF0ZUZhY3RvcnkoaGFzaEZvcm1hdCk7XG5cbiAgY29uc3QgZXh0cmFQb3N0Y3NzUGx1Z2luczogaW1wb3J0KCdwb3N0Y3NzJykuUGx1Z2luW10gPSBbXTtcblxuICAvLyBBdHRlbXB0IHRvIHNldHVwIFRhaWx3aW5kIENTU1xuICAvLyBPbmx5IGxvYWQgVGFpbHdpbmQgQ1NTIHBsdWdpbiBpZiBjb25maWd1cmF0aW9uIGZpbGUgd2FzIGZvdW5kLlxuICAvLyBUaGlzIGFjdHMgYXMgYSBndWFyZCB0byBlbnN1cmUgdGhlIHByb2plY3QgYWN0dWFsbHkgd2FudHMgdG8gdXNlIFRhaWx3aW5kIENTUy5cbiAgLy8gVGhlIHBhY2thZ2UgbWF5IGJlIHVua25vd25pbmdseSBwcmVzZW50IGR1ZSB0byBhIHRoaXJkLXBhcnR5IHRyYW5zaXRpdmUgcGFja2FnZSBkZXBlbmRlbmN5LlxuICBjb25zdCB0YWlsd2luZENvbmZpZ1BhdGggPSBnZXRUYWlsd2luZENvbmZpZ1BhdGgod2NvKTtcbiAgaWYgKHRhaWx3aW5kQ29uZmlnUGF0aCkge1xuICAgIGxldCB0YWlsd2luZFBhY2thZ2VQYXRoO1xuICAgIHRyeSB7XG4gICAgICB0YWlsd2luZFBhY2thZ2VQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCd0YWlsd2luZGNzcycsIHsgcGF0aHM6IFt3Y28ucm9vdF0gfSk7XG4gICAgfSBjYXRjaCB7XG4gICAgICBjb25zdCByZWxhdGl2ZVRhaWx3aW5kQ29uZmlnUGF0aCA9IHBhdGgucmVsYXRpdmUod2NvLnJvb3QsIHRhaWx3aW5kQ29uZmlnUGF0aCk7XG4gICAgICB3Y28ubG9nZ2VyLndhcm4oXG4gICAgICAgIGBUYWlsd2luZCBDU1MgY29uZmlndXJhdGlvbiBmaWxlIGZvdW5kICgke3JlbGF0aXZlVGFpbHdpbmRDb25maWdQYXRofSlgICtcbiAgICAgICAgICBgIGJ1dCB0aGUgJ3RhaWx3aW5kY3NzJyBwYWNrYWdlIGlzIG5vdCBpbnN0YWxsZWQuYCArXG4gICAgICAgICAgYCBUbyBlbmFibGUgVGFpbHdpbmQgQ1NTLCBwbGVhc2UgaW5zdGFsbCB0aGUgJ3RhaWx3aW5kY3NzJyBwYWNrYWdlLmAsXG4gICAgICApO1xuICAgIH1cbiAgICBpZiAodGFpbHdpbmRQYWNrYWdlUGF0aCkge1xuICAgICAgZXh0cmFQb3N0Y3NzUGx1Z2lucy5wdXNoKHJlcXVpcmUodGFpbHdpbmRQYWNrYWdlUGF0aCkoeyBjb25maWc6IHRhaWx3aW5kQ29uZmlnUGF0aCB9KSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgcG9zdGNzc0ltcG9ydHMgPSByZXF1aXJlKCdwb3N0Y3NzLWltcG9ydCcpO1xuICBjb25zdCBhdXRvcHJlZml4ZXI6IHR5cGVvZiBpbXBvcnQoJ2F1dG9wcmVmaXhlcicpID0gcmVxdWlyZSgnYXV0b3ByZWZpeGVyJyk7XG5cbiAgY29uc3QgcG9zdGNzc09wdGlvbnNDcmVhdG9yID0gKGlubGluZVNvdXJjZW1hcHM6IGJvb2xlYW4sIGV4dHJhY3RlZDogYm9vbGVhbikgPT4ge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3Qgb3B0aW9uR2VuZXJhdG9yID0gKGxvYWRlcjogYW55KSA9PiAoe1xuICAgICAgbWFwOiBpbmxpbmVTb3VyY2VtYXBzXG4gICAgICAgID8ge1xuICAgICAgICAgICAgaW5saW5lOiB0cnVlLFxuICAgICAgICAgICAgYW5ub3RhdGlvbjogZmFsc2UsXG4gICAgICAgICAgfVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgIHBsdWdpbnM6IFtcbiAgICAgICAgcG9zdGNzc0ltcG9ydHMoe1xuICAgICAgICAgIHJlc29sdmU6ICh1cmw6IHN0cmluZykgPT4gKHVybC5zdGFydHNXaXRoKCd+JykgPyB1cmwuc2xpY2UoMSkgOiB1cmwpLFxuICAgICAgICAgIGxvYWQ6IChmaWxlbmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgIGxvYWRlci5mcy5yZWFkRmlsZShmaWxlbmFtZSwgKGVycjogRXJyb3IsIGRhdGE6IEJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuXG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGNvbnRlbnQpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgICBQb3N0Y3NzQ2xpUmVzb3VyY2VzKHtcbiAgICAgICAgICBiYXNlSHJlZjogYnVpbGRPcHRpb25zLmJhc2VIcmVmLFxuICAgICAgICAgIGRlcGxveVVybDogYnVpbGRPcHRpb25zLmRlcGxveVVybCxcbiAgICAgICAgICByZXNvdXJjZXNPdXRwdXRQYXRoOiBidWlsZE9wdGlvbnMucmVzb3VyY2VzT3V0cHV0UGF0aCxcbiAgICAgICAgICBsb2FkZXIsXG4gICAgICAgICAgZmlsZW5hbWU6IGFzc2V0TmFtZVRlbXBsYXRlLFxuICAgICAgICAgIGVtaXRGaWxlOiBidWlsZE9wdGlvbnMucGxhdGZvcm0gIT09ICdzZXJ2ZXInLFxuICAgICAgICAgIGV4dHJhY3RlZCxcbiAgICAgICAgfSksXG4gICAgICAgIC4uLmV4dHJhUG9zdGNzc1BsdWdpbnMsXG4gICAgICAgIGF1dG9wcmVmaXhlcih7XG4gICAgICAgICAgaWdub3JlVW5rbm93blZlcnNpb25zOiB0cnVlLFxuICAgICAgICAgIG92ZXJyaWRlQnJvd3NlcnNsaXN0OiBidWlsZE9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcbiAgICAvLyBwb3N0Y3NzLWxvYWRlciBmYWlscyB3aGVuIHRyeWluZyB0byBkZXRlcm1pbmUgY29uZmlndXJhdGlvbiBmaWxlcyBmb3IgZGF0YSBVUklzXG4gICAgb3B0aW9uR2VuZXJhdG9yLmNvbmZpZyA9IGZhbHNlO1xuXG4gICAgcmV0dXJuIG9wdGlvbkdlbmVyYXRvcjtcbiAgfTtcblxuICAvLyBsb2FkIGNvbXBvbmVudCBjc3MgYXMgcmF3IHN0cmluZ3NcbiAgY29uc3QgY29tcG9uZW50c1NvdXJjZU1hcCA9ICEhKFxuICAgIGNzc1NvdXJjZU1hcCAmJlxuICAgIC8vIE5ldmVyIHVzZSBjb21wb25lbnQgY3NzIHNvdXJjZW1hcCB3aGVuIHN0eWxlIG9wdGltaXphdGlvbnMgYXJlIG9uLlxuICAgIC8vIEl0IHdpbGwganVzdCBpbmNyZWFzZSBidW5kbGUgc2l6ZSB3aXRob3V0IG9mZmVyaW5nIGdvb2QgZGVidWcgZXhwZXJpZW5jZS5cbiAgICAhYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbi5zdHlsZXMubWluaWZ5ICYmXG4gICAgLy8gSW5saW5lIGFsbCBzb3VyY2VtYXAgdHlwZXMgZXhjZXB0IGhpZGRlbiBvbmVzLCB3aGljaCBhcmUgdGhlIHNhbWUgYXMgbm8gc291cmNlbWFwc1xuICAgIC8vIGZvciBjb21wb25lbnQgY3NzLlxuICAgICFidWlsZE9wdGlvbnMuc291cmNlTWFwLmhpZGRlblxuICApO1xuXG4gIC8vIGV4dHJhY3QgZ2xvYmFsIGNzcyBmcm9tIGpzIGZpbGVzIGludG8gb3duIGNzcyBmaWxlLlxuICBleHRyYVBsdWdpbnMucHVzaChuZXcgTWluaUNzc0V4dHJhY3RQbHVnaW4oeyBmaWxlbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5leHRyYWN0fS5jc3NgIH0pKTtcblxuICBpZiAoIWJ1aWxkT3B0aW9ucy5obXIpIHtcbiAgICAvLyBkb24ndCByZW1vdmUgYC5qc2AgZmlsZXMgZm9yIGAuY3NzYCB3aGVuIHdlIGFyZSB1c2luZyBITVIgdGhlc2UgY29udGFpbiBITVIgYWNjZXB0IGNvZGVzLlxuICAgIC8vIHN1cHByZXNzIGVtcHR5IC5qcyBmaWxlcyBpbiBjc3Mgb25seSBlbnRyeSBwb2ludHMuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4oKSk7XG4gIH1cblxuICBjb25zdCBwb3N0Q3NzID0gcmVxdWlyZSgncG9zdGNzcycpO1xuICBjb25zdCBwb3N0Q3NzTG9hZGVyUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgncG9zdGNzcy1sb2FkZXInKTtcblxuICBjb25zdCBjb21wb25lbnRTdHlsZUxvYWRlcnM6IFJ1bGVTZXRVc2VJdGVtW10gPSBbXG4gICAge1xuICAgICAgbG9hZGVyOiBwb3N0Q3NzTG9hZGVyUGF0aCxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgaW1wbGVtZW50YXRpb246IHBvc3RDc3MsXG4gICAgICAgIHBvc3Rjc3NPcHRpb25zOiBwb3N0Y3NzT3B0aW9uc0NyZWF0b3IoY29tcG9uZW50c1NvdXJjZU1hcCwgZmFsc2UpLFxuICAgICAgfSxcbiAgICB9LFxuICBdO1xuXG4gIGNvbnN0IGdsb2JhbFN0eWxlTG9hZGVyczogUnVsZVNldFVzZUl0ZW1bXSA9IFtcbiAgICB7XG4gICAgICBsb2FkZXI6IE1pbmlDc3NFeHRyYWN0UGx1Z2luLmxvYWRlcixcbiAgICB9LFxuICAgIHtcbiAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdjc3MtbG9hZGVyJyksXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIHVybDogZmFsc2UsXG4gICAgICAgIHNvdXJjZU1hcDogISFjc3NTb3VyY2VNYXAsXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgbG9hZGVyOiBwb3N0Q3NzTG9hZGVyUGF0aCxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgaW1wbGVtZW50YXRpb246IHBvc3RDc3MsXG4gICAgICAgIHBvc3Rjc3NPcHRpb25zOiBwb3N0Y3NzT3B0aW9uc0NyZWF0b3IoZmFsc2UsIHRydWUpLFxuICAgICAgICBzb3VyY2VNYXA6ICEhY3NzU291cmNlTWFwLFxuICAgICAgfSxcbiAgICB9LFxuICBdO1xuXG4gIGNvbnN0IHN0eWxlTGFuZ3VhZ2VzOiB7XG4gICAgZXh0ZW5zaW9uczogc3RyaW5nW107XG4gICAgdXNlOiBSdWxlU2V0VXNlSXRlbVtdO1xuICB9W10gPSBbXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydjc3MnXSxcbiAgICAgIHVzZTogW10sXG4gICAgfSxcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ3Njc3MnXSxcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Jlc29sdmUtdXJsLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnc2Fzcy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBpbXBsZW1lbnRhdGlvbjogc2Fzc0ltcGxlbWVudGF0aW9uLFxuICAgICAgICAgICAgc291cmNlTWFwOiB0cnVlLFxuICAgICAgICAgICAgc2Fzc09wdGlvbnM6IHtcbiAgICAgICAgICAgICAgaW1wb3J0ZXI6ICh1cmw6IHN0cmluZywgZnJvbTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHVybC5jaGFyQXQoMCkgPT09ICd+Jykge1xuICAgICAgICAgICAgICAgICAgc2Fzc1RpbGRlVXNhZ2VNZXNzYWdlLmFkZChcbiAgICAgICAgICAgICAgICAgICAgYCcke2Zyb219JyBpbXBvcnRzICcke3VybH0nIHdpdGggYSB0aWxkZS4gVXNhZ2Ugb2YgJ34nIGluIGltcG9ydHMgaXMgZGVwcmVjYXRlZC5gLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgLy8gUHJldmVudCB1c2Ugb2YgYGZpYmVyc2AgcGFja2FnZSBhcyBpdCBubyBsb25nZXIgd29ya3MgaW4gbmV3ZXIgTm9kZS5qcyB2ZXJzaW9uc1xuICAgICAgICAgICAgICBmaWJlcjogZmFsc2UsXG4gICAgICAgICAgICAgIC8vIGJvb3RzdHJhcC1zYXNzIHJlcXVpcmVzIGEgbWluaW11bSBwcmVjaXNpb24gb2YgOFxuICAgICAgICAgICAgICBwcmVjaXNpb246IDgsXG4gICAgICAgICAgICAgIGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAgICAgLy8gVXNlIGV4cGFuZGVkIGFzIG90aGVyd2lzZSBzYXNzIHdpbGwgcmVtb3ZlIGNvbW1lbnRzIHRoYXQgYXJlIG5lZWRlZCBmb3IgYXV0b3ByZWZpeGVyXG4gICAgICAgICAgICAgIC8vIEV4OiAvKiBhdXRvcHJlZml4ZXIgZ3JpZDogYXV0b3BsYWNlICovXG4gICAgICAgICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zYXNzLWxvYWRlci9ibG9iLzQ1YWQwYmUxNzI2NGNlYWRhNWYwYjRmYjg3ZTkzNTdhYmU4NWM0ZmYvc3JjL2dldFNhc3NPcHRpb25zLmpzI0w2OC1MNzBcbiAgICAgICAgICAgICAgb3V0cHV0U3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICAgICAgICAgIC8vIFNpbGVuY2VzIGNvbXBpbGVyIHdhcm5pbmdzIGZyb20gM3JkIHBhcnR5IHN0eWxlc2hlZXRzXG4gICAgICAgICAgICAgIHF1aWV0RGVwczogIWJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAgICAgICB2ZXJib3NlOiBidWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ3Nhc3MnXSxcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Jlc29sdmUtdXJsLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnc2Fzcy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBpbXBsZW1lbnRhdGlvbjogc2Fzc0ltcGxlbWVudGF0aW9uLFxuICAgICAgICAgICAgc291cmNlTWFwOiB0cnVlLFxuICAgICAgICAgICAgc2Fzc09wdGlvbnM6IHtcbiAgICAgICAgICAgICAgaW1wb3J0ZXI6ICh1cmw6IHN0cmluZywgZnJvbTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHVybC5jaGFyQXQoMCkgPT09ICd+Jykge1xuICAgICAgICAgICAgICAgICAgc2Fzc1RpbGRlVXNhZ2VNZXNzYWdlLmFkZChcbiAgICAgICAgICAgICAgICAgICAgYCcke2Zyb219JyBpbXBvcnRzICcke3VybH0nIHdpdGggYSB0aWxkZS4gVXNhZ2Ugb2YgJ34nIGluIGltcG9ydHMgaXMgZGVwcmVjYXRlZC5gLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgLy8gUHJldmVudCB1c2Ugb2YgYGZpYmVyc2AgcGFja2FnZSBhcyBpdCBubyBsb25nZXIgd29ya3MgaW4gbmV3ZXIgTm9kZS5qcyB2ZXJzaW9uc1xuICAgICAgICAgICAgICBmaWJlcjogZmFsc2UsXG4gICAgICAgICAgICAgIGluZGVudGVkU3ludGF4OiB0cnVlLFxuICAgICAgICAgICAgICAvLyBib290c3RyYXAtc2FzcyByZXF1aXJlcyBhIG1pbmltdW0gcHJlY2lzaW9uIG9mIDhcbiAgICAgICAgICAgICAgcHJlY2lzaW9uOiA4LFxuICAgICAgICAgICAgICBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICAgIC8vIFVzZSBleHBhbmRlZCBhcyBvdGhlcndpc2Ugc2FzcyB3aWxsIHJlbW92ZSBjb21tZW50cyB0aGF0IGFyZSBuZWVkZWQgZm9yIGF1dG9wcmVmaXhlclxuICAgICAgICAgICAgICAvLyBFeDogLyogYXV0b3ByZWZpeGVyIGdyaWQ6IGF1dG9wbGFjZSAqL1xuICAgICAgICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc2Fzcy1sb2FkZXIvYmxvYi80NWFkMGJlMTcyNjRjZWFkYTVmMGI0ZmI4N2U5MzU3YWJlODVjNGZmL3NyYy9nZXRTYXNzT3B0aW9ucy5qcyNMNjgtTDcwXG4gICAgICAgICAgICAgIG91dHB1dFN0eWxlOiAnZXhwYW5kZWQnLFxuICAgICAgICAgICAgICAvLyBTaWxlbmNlcyBjb21waWxlciB3YXJuaW5ncyBmcm9tIDNyZCBwYXJ0eSBzdHlsZXNoZWV0c1xuICAgICAgICAgICAgICBxdWlldERlcHM6ICFidWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgICAgICAgdmVyYm9zZTogYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydsZXNzJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdsZXNzLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIGltcGxlbWVudGF0aW9uOiByZXF1aXJlKCdsZXNzJyksXG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICAgIGxlc3NPcHRpb25zOiB7XG4gICAgICAgICAgICAgIGphdmFzY3JpcHRFbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICBwYXRoczogaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnc3R5bCddLFxuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnc3R5bHVzLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgICAgc3R5bHVzT3B0aW9uczoge1xuICAgICAgICAgICAgICBjb21wcmVzczogZmFsc2UsXG4gICAgICAgICAgICAgIHNvdXJjZU1hcDogeyBjb21tZW50OiBmYWxzZSB9LFxuICAgICAgICAgICAgICBwYXRoczogaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICBdO1xuXG4gIHJldHVybiB7XG4gICAgZW50cnk6IGVudHJ5UG9pbnRzLFxuICAgIG1vZHVsZToge1xuICAgICAgcnVsZXM6IHN0eWxlTGFuZ3VhZ2VzLm1hcCgoeyBleHRlbnNpb25zLCB1c2UgfSkgPT4gKHtcbiAgICAgICAgdGVzdDogbmV3IFJlZ0V4cChgXFxcXC4oPzoke2V4dGVuc2lvbnMuam9pbignfCcpfSkkYCwgJ2knKSxcbiAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAvLyBTZXR1cCBwcm9jZXNzaW5nIHJ1bGVzIGZvciBnbG9iYWwgYW5kIGNvbXBvbmVudCBzdHlsZXNcbiAgICAgICAgICB7XG4gICAgICAgICAgICBvbmVPZjogW1xuICAgICAgICAgICAgICAvLyBHbG9iYWwgc3R5bGVzIGFyZSBvbmx5IGRlZmluZWQgZ2xvYmFsIHN0eWxlc1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdXNlOiBnbG9iYWxTdHlsZUxvYWRlcnMsXG4gICAgICAgICAgICAgICAgaW5jbHVkZTogZ2xvYmFsU3R5bGVQYXRocyxcbiAgICAgICAgICAgICAgICByZXNvdXJjZVF1ZXJ5OiB7IG5vdDogWy9cXD9uZ1Jlc291cmNlL10gfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgLy8gQ29tcG9uZW50IHN0eWxlcyBhcmUgYWxsIHN0eWxlcyBleGNlcHQgZGVmaW5lZCBnbG9iYWwgc3R5bGVzXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1c2U6IGNvbXBvbmVudFN0eWxlTG9hZGVycyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYXNzZXQvc291cmNlJyxcbiAgICAgICAgICAgICAgICByZXNvdXJjZVF1ZXJ5OiAvXFw/bmdSZXNvdXJjZS8sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgeyB1c2UgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pKSxcbiAgICB9LFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgbWluaW1pemVyOiBidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uLnN0eWxlcy5taW5pZnlcbiAgICAgICAgPyBbXG4gICAgICAgICAgICBuZXcgQ3NzT3B0aW1pemVyUGx1Z2luKHtcbiAgICAgICAgICAgICAgc3VwcG9ydGVkQnJvd3NlcnM6IGJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2VycyxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgfSxcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGdldFRhaWx3aW5kQ29uZmlnUGF0aCh7IHByb2plY3RSb290LCByb290IH06IFdlYnBhY2tDb25maWdPcHRpb25zKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgLy8gQSBjb25maWd1cmF0aW9uIGZpbGUgY2FuIGV4aXN0IGluIHRoZSBwcm9qZWN0IG9yIHdvcmtzcGFjZSByb290XG4gIC8vIFRoZSBsaXN0IG9mIHZhbGlkIGNvbmZpZyBmaWxlcyBjYW4gYmUgZm91bmQ6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS90YWlsd2luZGxhYnMvdGFpbHdpbmRjc3MvYmxvYi84ODQ1ZDExMmZiNjJkNzk4MTViNTBiM2JhZTgwYzMxNzQ1MGI4YjkyL3NyYy91dGlsL3Jlc29sdmVDb25maWdQYXRoLmpzI0w0Ni1MNTJcbiAgY29uc3QgdGFpbHdpbmRDb25maWdGaWxlcyA9IFsndGFpbHdpbmQuY29uZmlnLmpzJywgJ3RhaWx3aW5kLmNvbmZpZy5janMnXTtcbiAgZm9yIChjb25zdCBiYXNlUGF0aCBvZiBbcHJvamVjdFJvb3QsIHJvb3RdKSB7XG4gICAgZm9yIChjb25zdCBjb25maWdGaWxlIG9mIHRhaWx3aW5kQ29uZmlnRmlsZXMpIHtcbiAgICAgIC8vIElycmVzcGVjdGl2ZSBvZiB0aGUgbmFtZSBwcm9qZWN0IGxldmVsIGNvbmZpZ3VyYXRpb24gc2hvdWxkIGFsd2F5cyB0YWtlIHByZWNlZGVuY2UuXG4gICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihiYXNlUGF0aCwgY29uZmlnRmlsZSk7XG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhmdWxsUGF0aCkpIHtcbiAgICAgICAgcmV0dXJuIGZ1bGxQYXRoO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG4iXX0=