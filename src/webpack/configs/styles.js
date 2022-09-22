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
const webpack_diagnostics_1 = require("../../utils/webpack-diagnostics");
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
    const sassImplementation = new sass_service_1.SassWorkerImplementation();
    const sassTildeUsageMessage = new Set();
    extraPlugins.push({
        apply(compiler) {
            compiler.hooks.shutdown.tap('sass-worker', () => {
                sassImplementation.close();
            });
            compiler.hooks.afterCompile.tap('sass-worker', (compilation) => {
                for (const message of sassTildeUsageMessage) {
                    (0, webpack_diagnostics_1.addWarning)(compilation, message);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHVDQUF5QjtBQUN6QixzRkFBMkQ7QUFDM0QsMkNBQTZCO0FBRzdCLDBEQUFtRTtBQUVuRSx5RUFBNkQ7QUFDN0Qsd0NBS29CO0FBQ3BCLDBFQUFxRTtBQUNyRSw4Q0FJMEI7QUFFMUIsU0FBZ0IsbUJBQW1CLENBQ2pDLGdCQUFnQyxFQUNoQyxJQUFZLEVBQ1osZ0JBQXlCLEVBQ3pCLGNBQWMsR0FBRyxLQUFLO0lBRXRCLE1BQU0sV0FBVyxHQUE2QixFQUFFLENBQUM7SUFDakQsTUFBTSxhQUFhLEdBQWEsRUFBRSxDQUFDO0lBQ25DLE1BQU0sS0FBSyxHQUFhLEVBQUUsQ0FBQztJQUUzQixJQUFJLGdCQUFnQixDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDakMsT0FBTyxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLENBQUM7S0FDOUM7SUFFRCxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUEsbUNBQXlCLEVBQUMsZ0JBQWdCLEVBQUUsUUFBUSxDQUFDLEVBQUU7UUFDekUsSUFBSSxjQUFjLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQztRQUNqQyxJQUFJLENBQUMsY0FBYyxFQUFFO1lBQ25CLGNBQWMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQztZQUNwRCxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsRUFBRTtnQkFDbEMsSUFBSTtvQkFDRixjQUFjLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENB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Q29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IE1pbmlDc3NFeHRyYWN0UGx1Z2luIGZyb20gJ21pbmktY3NzLWV4dHJhY3QtcGx1Z2luJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHlwZSB7IENvbmZpZ3VyYXRpb24sIFJ1bGVTZXRVc2VJdGVtIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBTdHlsZUVsZW1lbnQgfSBmcm9tICcuLi8uLi9idWlsZGVycy9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBTYXNzV29ya2VySW1wbGVtZW50YXRpb24gfSBmcm9tICcuLi8uLi9zYXNzL3Nhc3Mtc2VydmljZSc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgYWRkV2FybmluZyB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stZGlhZ25vc3RpY3MnO1xuaW1wb3J0IHtcbiAgQW55Q29tcG9uZW50U3R5bGVCdWRnZXRDaGVja2VyLFxuICBQb3N0Y3NzQ2xpUmVzb3VyY2VzLFxuICBSZW1vdmVIYXNoUGx1Z2luLFxuICBTdXBwcmVzc0V4dHJhY3RlZFRleHRDaHVua3NXZWJwYWNrUGx1Z2luLFxufSBmcm9tICcuLi9wbHVnaW5zJztcbmltcG9ydCB7IENzc09wdGltaXplclBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvY3NzLW9wdGltaXplci1wbHVnaW4nO1xuaW1wb3J0IHtcbiAgYXNzZXROYW1lVGVtcGxhdGVGYWN0b3J5LFxuICBnZXRPdXRwdXRIYXNoRm9ybWF0LFxuICBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzLFxufSBmcm9tICcuLi91dGlscy9oZWxwZXJzJztcblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVHbG9iYWxTdHlsZXMoXG4gIHN0eWxlRW50cnlwb2ludHM6IFN0eWxlRWxlbWVudFtdLFxuICByb290OiBzdHJpbmcsXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4sXG4gIHNraXBSZXNvbHV0aW9uID0gZmFsc2UsXG4pOiB7IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT47IG5vSW5qZWN0TmFtZXM6IHN0cmluZ1tdOyBwYXRoczogc3RyaW5nW10gfSB7XG4gIGNvbnN0IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7fTtcbiAgY29uc3Qgbm9JbmplY3ROYW1lczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgcGF0aHM6IHN0cmluZ1tdID0gW107XG5cbiAgaWYgKHN0eWxlRW50cnlwb2ludHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHsgZW50cnlQb2ludHMsIG5vSW5qZWN0TmFtZXMsIHBhdGhzIH07XG4gIH1cblxuICBmb3IgKGNvbnN0IHN0eWxlIG9mIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoc3R5bGVFbnRyeXBvaW50cywgJ3N0eWxlcycpKSB7XG4gICAgbGV0IHN0eWxlc2hlZXRQYXRoID0gc3R5bGUuaW5wdXQ7XG4gICAgaWYgKCFza2lwUmVzb2x1dGlvbikge1xuICAgICAgc3R5bGVzaGVldFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgc3R5bGVzaGVldFBhdGgpO1xuICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHN0eWxlc2hlZXRQYXRoKSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHN0eWxlc2hlZXRQYXRoID0gcmVxdWlyZS5yZXNvbHZlKHN0eWxlLmlucHV0LCB7IHBhdGhzOiBbcm9vdF0gfSk7XG4gICAgICAgIH0gY2F0Y2gge31cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXByZXNlcnZlU3ltbGlua3MpIHtcbiAgICAgIHN0eWxlc2hlZXRQYXRoID0gZnMucmVhbHBhdGhTeW5jKHN0eWxlc2hlZXRQYXRoKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgc3R5bGUgZW50cnkgcG9pbnRzLlxuICAgIGlmIChlbnRyeVBvaW50c1tzdHlsZS5idW5kbGVOYW1lXSkge1xuICAgICAgZW50cnlQb2ludHNbc3R5bGUuYnVuZGxlTmFtZV0ucHVzaChzdHlsZXNoZWV0UGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVudHJ5UG9pbnRzW3N0eWxlLmJ1bmRsZU5hbWVdID0gW3N0eWxlc2hlZXRQYXRoXTtcbiAgICB9XG5cbiAgICAvLyBBZGQgbm9uIGluamVjdGVkIHN0eWxlcyB0byB0aGUgbGlzdC5cbiAgICBpZiAoIXN0eWxlLmluamVjdCkge1xuICAgICAgbm9JbmplY3ROYW1lcy5wdXNoKHN0eWxlLmJ1bmRsZU5hbWUpO1xuICAgIH1cblxuICAgIC8vIEFkZCBnbG9iYWwgY3NzIHBhdGhzLlxuICAgIHBhdGhzLnB1c2goc3R5bGVzaGVldFBhdGgpO1xuICB9XG5cbiAgcmV0dXJuIHsgZW50cnlQb2ludHMsIG5vSW5qZWN0TmFtZXMsIHBhdGhzIH07XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3R5bGVzQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpOiBDb25maWd1cmF0aW9uIHtcbiAgY29uc3QgeyByb290LCBidWlsZE9wdGlvbnMgfSA9IHdjbztcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiBDb25maWd1cmF0aW9uWydwbHVnaW5zJ10gPSBbXTtcblxuICBleHRyYVBsdWdpbnMucHVzaChuZXcgQW55Q29tcG9uZW50U3R5bGVCdWRnZXRDaGVja2VyKGJ1aWxkT3B0aW9ucy5idWRnZXRzKSk7XG5cbiAgY29uc3QgY3NzU291cmNlTWFwID0gYnVpbGRPcHRpb25zLnNvdXJjZU1hcC5zdHlsZXM7XG5cbiAgLy8gRGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0LlxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyk7XG5cbiAgLy8gdXNlIGluY2x1ZGVQYXRocyBmcm9tIGFwcENvbmZpZ1xuICBjb25zdCBpbmNsdWRlUGF0aHMgPVxuICAgIGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocz8ubWFwKChwKSA9PiBwYXRoLnJlc29sdmUocm9vdCwgcCkpID8/IFtdO1xuXG4gIC8vIFByb2Nlc3MgZ2xvYmFsIHN0eWxlcy5cbiAgY29uc3Qge1xuICAgIGVudHJ5UG9pbnRzLFxuICAgIG5vSW5qZWN0TmFtZXMsXG4gICAgcGF0aHM6IGdsb2JhbFN0eWxlUGF0aHMsXG4gIH0gPSByZXNvbHZlR2xvYmFsU3R5bGVzKGJ1aWxkT3B0aW9ucy5zdHlsZXMsIHJvb3QsICEhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MpO1xuICBpZiAobm9JbmplY3ROYW1lcy5sZW5ndGggPiAwKSB7XG4gICAgLy8gQWRkIHBsdWdpbiB0byByZW1vdmUgaGFzaGVzIGZyb20gbGF6eSBzdHlsZXMuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFJlbW92ZUhhc2hQbHVnaW4oeyBjaHVua05hbWVzOiBub0luamVjdE5hbWVzLCBoYXNoRm9ybWF0IH0pKTtcbiAgfVxuXG4gIGNvbnN0IHNhc3NJbXBsZW1lbnRhdGlvbiA9IG5ldyBTYXNzV29ya2VySW1wbGVtZW50YXRpb24oKTtcbiAgY29uc3Qgc2Fzc1RpbGRlVXNhZ2VNZXNzYWdlID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgZXh0cmFQbHVnaW5zLnB1c2goe1xuICAgIGFwcGx5KGNvbXBpbGVyKSB7XG4gICAgICBjb21waWxlci5ob29rcy5zaHV0ZG93bi50YXAoJ3Nhc3Mtd29ya2VyJywgKCkgPT4ge1xuICAgICAgICBzYXNzSW1wbGVtZW50YXRpb24uY2xvc2UoKTtcbiAgICAgIH0pO1xuXG4gICAgICBjb21waWxlci5ob29rcy5hZnRlckNvbXBpbGUudGFwKCdzYXNzLXdvcmtlcicsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgICBmb3IgKGNvbnN0IG1lc3NhZ2Ugb2Ygc2Fzc1RpbGRlVXNhZ2VNZXNzYWdlKSB7XG4gICAgICAgICAgYWRkV2FybmluZyhjb21waWxhdGlvbiwgbWVzc2FnZSk7XG4gICAgICAgIH1cblxuICAgICAgICBzYXNzVGlsZGVVc2FnZU1lc3NhZ2UuY2xlYXIoKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH0pO1xuXG4gIGNvbnN0IGFzc2V0TmFtZVRlbXBsYXRlID0gYXNzZXROYW1lVGVtcGxhdGVGYWN0b3J5KGhhc2hGb3JtYXQpO1xuXG4gIGNvbnN0IGV4dHJhUG9zdGNzc1BsdWdpbnM6IGltcG9ydCgncG9zdGNzcycpLlBsdWdpbltdID0gW107XG5cbiAgLy8gQXR0ZW1wdCB0byBzZXR1cCBUYWlsd2luZCBDU1NcbiAgLy8gT25seSBsb2FkIFRhaWx3aW5kIENTUyBwbHVnaW4gaWYgY29uZmlndXJhdGlvbiBmaWxlIHdhcyBmb3VuZC5cbiAgLy8gVGhpcyBhY3RzIGFzIGEgZ3VhcmQgdG8gZW5zdXJlIHRoZSBwcm9qZWN0IGFjdHVhbGx5IHdhbnRzIHRvIHVzZSBUYWlsd2luZCBDU1MuXG4gIC8vIFRoZSBwYWNrYWdlIG1heSBiZSB1bmtub3duaW5nbHkgcHJlc2VudCBkdWUgdG8gYSB0aGlyZC1wYXJ0eSB0cmFuc2l0aXZlIHBhY2thZ2UgZGVwZW5kZW5jeS5cbiAgY29uc3QgdGFpbHdpbmRDb25maWdQYXRoID0gZ2V0VGFpbHdpbmRDb25maWdQYXRoKHdjbyk7XG4gIGlmICh0YWlsd2luZENvbmZpZ1BhdGgpIHtcbiAgICBsZXQgdGFpbHdpbmRQYWNrYWdlUGF0aDtcbiAgICB0cnkge1xuICAgICAgdGFpbHdpbmRQYWNrYWdlUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgndGFpbHdpbmRjc3MnLCB7IHBhdGhzOiBbd2NvLnJvb3RdIH0pO1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29uc3QgcmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGggPSBwYXRoLnJlbGF0aXZlKHdjby5yb290LCB0YWlsd2luZENvbmZpZ1BhdGgpO1xuICAgICAgd2NvLmxvZ2dlci53YXJuKFxuICAgICAgICBgVGFpbHdpbmQgQ1NTIGNvbmZpZ3VyYXRpb24gZmlsZSBmb3VuZCAoJHtyZWxhdGl2ZVRhaWx3aW5kQ29uZmlnUGF0aH0pYCArXG4gICAgICAgICAgYCBidXQgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZSBpcyBub3QgaW5zdGFsbGVkLmAgK1xuICAgICAgICAgIGAgVG8gZW5hYmxlIFRhaWx3aW5kIENTUywgcGxlYXNlIGluc3RhbGwgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZS5gLFxuICAgICAgKTtcbiAgICB9XG4gICAgaWYgKHRhaWx3aW5kUGFja2FnZVBhdGgpIHtcbiAgICAgIGV4dHJhUG9zdGNzc1BsdWdpbnMucHVzaChyZXF1aXJlKHRhaWx3aW5kUGFja2FnZVBhdGgpKHsgY29uZmlnOiB0YWlsd2luZENvbmZpZ1BhdGggfSkpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHBvc3Rjc3NJbXBvcnRzID0gcmVxdWlyZSgncG9zdGNzcy1pbXBvcnQnKTtcbiAgY29uc3QgYXV0b3ByZWZpeGVyOiB0eXBlb2YgaW1wb3J0KCdhdXRvcHJlZml4ZXInKSA9IHJlcXVpcmUoJ2F1dG9wcmVmaXhlcicpO1xuXG4gIGNvbnN0IHBvc3Rjc3NPcHRpb25zQ3JlYXRvciA9IChpbmxpbmVTb3VyY2VtYXBzOiBib29sZWFuLCBleHRyYWN0ZWQ6IGJvb2xlYW4pID0+IHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGNvbnN0IG9wdGlvbkdlbmVyYXRvciA9IChsb2FkZXI6IGFueSkgPT4gKHtcbiAgICAgIG1hcDogaW5saW5lU291cmNlbWFwc1xuICAgICAgICA/IHtcbiAgICAgICAgICAgIGlubGluZTogdHJ1ZSxcbiAgICAgICAgICAgIGFubm90YXRpb246IGZhbHNlLFxuICAgICAgICAgIH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICBwbHVnaW5zOiBbXG4gICAgICAgIHBvc3Rjc3NJbXBvcnRzKHtcbiAgICAgICAgICByZXNvbHZlOiAodXJsOiBzdHJpbmcpID0+ICh1cmwuc3RhcnRzV2l0aCgnficpID8gdXJsLnNsaWNlKDEpIDogdXJsKSxcbiAgICAgICAgICBsb2FkOiAoZmlsZW5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICBsb2FkZXIuZnMucmVhZEZpbGUoZmlsZW5hbWUsIChlcnI6IEVycm9yLCBkYXRhOiBCdWZmZXIpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcblxuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShjb250ZW50KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgICAgUG9zdGNzc0NsaVJlc291cmNlcyh7XG4gICAgICAgICAgYmFzZUhyZWY6IGJ1aWxkT3B0aW9ucy5iYXNlSHJlZixcbiAgICAgICAgICBkZXBsb3lVcmw6IGJ1aWxkT3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgICAgICAgcmVzb3VyY2VzT3V0cHV0UGF0aDogYnVpbGRPcHRpb25zLnJlc291cmNlc091dHB1dFBhdGgsXG4gICAgICAgICAgbG9hZGVyLFxuICAgICAgICAgIGZpbGVuYW1lOiBhc3NldE5hbWVUZW1wbGF0ZSxcbiAgICAgICAgICBlbWl0RmlsZTogYnVpbGRPcHRpb25zLnBsYXRmb3JtICE9PSAnc2VydmVyJyxcbiAgICAgICAgICBleHRyYWN0ZWQsXG4gICAgICAgIH0pLFxuICAgICAgICAuLi5leHRyYVBvc3Rjc3NQbHVnaW5zLFxuICAgICAgICBhdXRvcHJlZml4ZXIoe1xuICAgICAgICAgIGlnbm9yZVVua25vd25WZXJzaW9uczogdHJ1ZSxcbiAgICAgICAgICBvdmVycmlkZUJyb3dzZXJzbGlzdDogYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgLy8gcG9zdGNzcy1sb2FkZXIgZmFpbHMgd2hlbiB0cnlpbmcgdG8gZGV0ZXJtaW5lIGNvbmZpZ3VyYXRpb24gZmlsZXMgZm9yIGRhdGEgVVJJc1xuICAgIG9wdGlvbkdlbmVyYXRvci5jb25maWcgPSBmYWxzZTtcblxuICAgIHJldHVybiBvcHRpb25HZW5lcmF0b3I7XG4gIH07XG5cbiAgLy8gbG9hZCBjb21wb25lbnQgY3NzIGFzIHJhdyBzdHJpbmdzXG4gIGNvbnN0IGNvbXBvbmVudHNTb3VyY2VNYXAgPSAhIShcbiAgICBjc3NTb3VyY2VNYXAgJiZcbiAgICAvLyBOZXZlciB1c2UgY29tcG9uZW50IGNzcyBzb3VyY2VtYXAgd2hlbiBzdHlsZSBvcHRpbWl6YXRpb25zIGFyZSBvbi5cbiAgICAvLyBJdCB3aWxsIGp1c3QgaW5jcmVhc2UgYnVuZGxlIHNpemUgd2l0aG91dCBvZmZlcmluZyBnb29kIGRlYnVnIGV4cGVyaWVuY2UuXG4gICAgIWJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24uc3R5bGVzLm1pbmlmeSAmJlxuICAgIC8vIElubGluZSBhbGwgc291cmNlbWFwIHR5cGVzIGV4Y2VwdCBoaWRkZW4gb25lcywgd2hpY2ggYXJlIHRoZSBzYW1lIGFzIG5vIHNvdXJjZW1hcHNcbiAgICAvLyBmb3IgY29tcG9uZW50IGNzcy5cbiAgICAhYnVpbGRPcHRpb25zLnNvdXJjZU1hcC5oaWRkZW5cbiAgKTtcblxuICAvLyBleHRyYWN0IGdsb2JhbCBjc3MgZnJvbSBqcyBmaWxlcyBpbnRvIG93biBjc3MgZmlsZS5cbiAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IE1pbmlDc3NFeHRyYWN0UGx1Z2luKHsgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuZXh0cmFjdH0uY3NzYCB9KSk7XG5cbiAgaWYgKCFidWlsZE9wdGlvbnMuaG1yKSB7XG4gICAgLy8gZG9uJ3QgcmVtb3ZlIGAuanNgIGZpbGVzIGZvciBgLmNzc2Agd2hlbiB3ZSBhcmUgdXNpbmcgSE1SIHRoZXNlIGNvbnRhaW4gSE1SIGFjY2VwdCBjb2Rlcy5cbiAgICAvLyBzdXBwcmVzcyBlbXB0eSAuanMgZmlsZXMgaW4gY3NzIG9ubHkgZW50cnkgcG9pbnRzLlxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBTdXBwcmVzc0V4dHJhY3RlZFRleHRDaHVua3NXZWJwYWNrUGx1Z2luKCkpO1xuICB9XG5cbiAgY29uc3QgcG9zdENzcyA9IHJlcXVpcmUoJ3Bvc3Rjc3MnKTtcbiAgY29uc3QgcG9zdENzc0xvYWRlclBhdGggPSByZXF1aXJlLnJlc29sdmUoJ3Bvc3Rjc3MtbG9hZGVyJyk7XG5cbiAgY29uc3QgY29tcG9uZW50U3R5bGVMb2FkZXJzOiBSdWxlU2V0VXNlSXRlbVtdID0gW1xuICAgIHtcbiAgICAgIGxvYWRlcjogcG9zdENzc0xvYWRlclBhdGgsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBwb3N0Q3NzLFxuICAgICAgICBwb3N0Y3NzT3B0aW9uczogcG9zdGNzc09wdGlvbnNDcmVhdG9yKGNvbXBvbmVudHNTb3VyY2VNYXAsIGZhbHNlKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgXTtcblxuICBjb25zdCBnbG9iYWxTdHlsZUxvYWRlcnM6IFJ1bGVTZXRVc2VJdGVtW10gPSBbXG4gICAge1xuICAgICAgbG9hZGVyOiBNaW5pQ3NzRXh0cmFjdFBsdWdpbi5sb2FkZXIsXG4gICAgfSxcbiAgICB7XG4gICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnY3NzLWxvYWRlcicpLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICB1cmw6IGZhbHNlLFxuICAgICAgICBzb3VyY2VNYXA6ICEhY3NzU291cmNlTWFwLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGxvYWRlcjogcG9zdENzc0xvYWRlclBhdGgsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBwb3N0Q3NzLFxuICAgICAgICBwb3N0Y3NzT3B0aW9uczogcG9zdGNzc09wdGlvbnNDcmVhdG9yKGZhbHNlLCB0cnVlKSxcbiAgICAgICAgc291cmNlTWFwOiAhIWNzc1NvdXJjZU1hcCxcbiAgICAgIH0sXG4gICAgfSxcbiAgXTtcblxuICBjb25zdCBzdHlsZUxhbmd1YWdlczoge1xuICAgIGV4dGVuc2lvbnM6IHN0cmluZ1tdO1xuICAgIHVzZTogUnVsZVNldFVzZUl0ZW1bXTtcbiAgfVtdID0gW1xuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnY3NzJ10sXG4gICAgICB1c2U6IFtdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydzY3NzJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdyZXNvbHZlLXVybC1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Nhc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgaW1wbGVtZW50YXRpb246IHNhc3NJbXBsZW1lbnRhdGlvbixcbiAgICAgICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcbiAgICAgICAgICAgIHNhc3NPcHRpb25zOiB7XG4gICAgICAgICAgICAgIGltcG9ydGVyOiAodXJsOiBzdHJpbmcsIGZyb206IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh1cmwuY2hhckF0KDApID09PSAnficpIHtcbiAgICAgICAgICAgICAgICAgIHNhc3NUaWxkZVVzYWdlTWVzc2FnZS5hZGQoXG4gICAgICAgICAgICAgICAgICAgIGAnJHtmcm9tfScgaW1wb3J0cyAnJHt1cmx9JyB3aXRoIGEgdGlsZGUuIFVzYWdlIG9mICd+JyBpbiBpbXBvcnRzIGlzIGRlcHJlY2F0ZWQuYCxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIC8vIFByZXZlbnQgdXNlIG9mIGBmaWJlcnNgIHBhY2thZ2UgYXMgaXQgbm8gbG9uZ2VyIHdvcmtzIGluIG5ld2VyIE5vZGUuanMgdmVyc2lvbnNcbiAgICAgICAgICAgICAgZmliZXI6IGZhbHNlLFxuICAgICAgICAgICAgICAvLyBib290c3RyYXAtc2FzcyByZXF1aXJlcyBhIG1pbmltdW0gcHJlY2lzaW9uIG9mIDhcbiAgICAgICAgICAgICAgcHJlY2lzaW9uOiA4LFxuICAgICAgICAgICAgICBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICAgIC8vIFVzZSBleHBhbmRlZCBhcyBvdGhlcndpc2Ugc2FzcyB3aWxsIHJlbW92ZSBjb21tZW50cyB0aGF0IGFyZSBuZWVkZWQgZm9yIGF1dG9wcmVmaXhlclxuICAgICAgICAgICAgICAvLyBFeDogLyogYXV0b3ByZWZpeGVyIGdyaWQ6IGF1dG9wbGFjZSAqL1xuICAgICAgICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc2Fzcy1sb2FkZXIvYmxvYi80NWFkMGJlMTcyNjRjZWFkYTVmMGI0ZmI4N2U5MzU3YWJlODVjNGZmL3NyYy9nZXRTYXNzT3B0aW9ucy5qcyNMNjgtTDcwXG4gICAgICAgICAgICAgIG91dHB1dFN0eWxlOiAnZXhwYW5kZWQnLFxuICAgICAgICAgICAgICAvLyBTaWxlbmNlcyBjb21waWxlciB3YXJuaW5ncyBmcm9tIDNyZCBwYXJ0eSBzdHlsZXNoZWV0c1xuICAgICAgICAgICAgICBxdWlldERlcHM6ICFidWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgICAgICAgdmVyYm9zZTogYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydzYXNzJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdyZXNvbHZlLXVybC1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Nhc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgaW1wbGVtZW50YXRpb246IHNhc3NJbXBsZW1lbnRhdGlvbixcbiAgICAgICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcbiAgICAgICAgICAgIHNhc3NPcHRpb25zOiB7XG4gICAgICAgICAgICAgIGltcG9ydGVyOiAodXJsOiBzdHJpbmcsIGZyb206IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh1cmwuY2hhckF0KDApID09PSAnficpIHtcbiAgICAgICAgICAgICAgICAgIHNhc3NUaWxkZVVzYWdlTWVzc2FnZS5hZGQoXG4gICAgICAgICAgICAgICAgICAgIGAnJHtmcm9tfScgaW1wb3J0cyAnJHt1cmx9JyB3aXRoIGEgdGlsZGUuIFVzYWdlIG9mICd+JyBpbiBpbXBvcnRzIGlzIGRlcHJlY2F0ZWQuYCxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIC8vIFByZXZlbnQgdXNlIG9mIGBmaWJlcnNgIHBhY2thZ2UgYXMgaXQgbm8gbG9uZ2VyIHdvcmtzIGluIG5ld2VyIE5vZGUuanMgdmVyc2lvbnNcbiAgICAgICAgICAgICAgZmliZXI6IGZhbHNlLFxuICAgICAgICAgICAgICBpbmRlbnRlZFN5bnRheDogdHJ1ZSxcbiAgICAgICAgICAgICAgLy8gYm9vdHN0cmFwLXNhc3MgcmVxdWlyZXMgYSBtaW5pbXVtIHByZWNpc2lvbiBvZiA4XG4gICAgICAgICAgICAgIHByZWNpc2lvbjogOCxcbiAgICAgICAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgICAvLyBVc2UgZXhwYW5kZWQgYXMgb3RoZXJ3aXNlIHNhc3Mgd2lsbCByZW1vdmUgY29tbWVudHMgdGhhdCBhcmUgbmVlZGVkIGZvciBhdXRvcHJlZml4ZXJcbiAgICAgICAgICAgICAgLy8gRXg6IC8qIGF1dG9wcmVmaXhlciBncmlkOiBhdXRvcGxhY2UgKi9cbiAgICAgICAgICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3Nhc3MtbG9hZGVyL2Jsb2IvNDVhZDBiZTE3MjY0Y2VhZGE1ZjBiNGZiODdlOTM1N2FiZTg1YzRmZi9zcmMvZ2V0U2Fzc09wdGlvbnMuanMjTDY4LUw3MFxuICAgICAgICAgICAgICBvdXRwdXRTdHlsZTogJ2V4cGFuZGVkJyxcbiAgICAgICAgICAgICAgLy8gU2lsZW5jZXMgY29tcGlsZXIgd2FybmluZ3MgZnJvbSAzcmQgcGFydHkgc3R5bGVzaGVldHNcbiAgICAgICAgICAgICAgcXVpZXREZXBzOiAhYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgICAgIHZlcmJvc2U6IGJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnbGVzcyddLFxuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnbGVzcy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBpbXBsZW1lbnRhdGlvbjogcmVxdWlyZSgnbGVzcycpLFxuICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgICBsZXNzT3B0aW9uczoge1xuICAgICAgICAgICAgICBqYXZhc2NyaXB0RW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgcGF0aHM6IGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgXTtcblxuICByZXR1cm4ge1xuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBtb2R1bGU6IHtcbiAgICAgIHJ1bGVzOiBzdHlsZUxhbmd1YWdlcy5tYXAoKHsgZXh0ZW5zaW9ucywgdXNlIH0pID0+ICh7XG4gICAgICAgIHRlc3Q6IG5ldyBSZWdFeHAoYFxcXFwuKD86JHtleHRlbnNpb25zLmpvaW4oJ3wnKX0pJGAsICdpJyksXG4gICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAgLy8gU2V0dXAgcHJvY2Vzc2luZyBydWxlcyBmb3IgZ2xvYmFsIGFuZCBjb21wb25lbnQgc3R5bGVzXG4gICAgICAgICAge1xuICAgICAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICAgICAgLy8gR2xvYmFsIHN0eWxlcyBhcmUgb25seSBkZWZpbmVkIGdsb2JhbCBzdHlsZXNcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVzZTogZ2xvYmFsU3R5bGVMb2FkZXJzLFxuICAgICAgICAgICAgICAgIGluY2x1ZGU6IGdsb2JhbFN0eWxlUGF0aHMsXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VRdWVyeTogeyBub3Q6IFsvXFw/bmdSZXNvdXJjZS9dIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXMgYXJlIGFsbCBzdHlsZXMgZXhjZXB0IGRlZmluZWQgZ2xvYmFsIHN0eWxlc1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdXNlOiBjb21wb25lbnRTdHlsZUxvYWRlcnMsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2Fzc2V0L3NvdXJjZScsXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VRdWVyeTogL1xcP25nUmVzb3VyY2UvLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHsgdXNlIH0sXG4gICAgICAgIF0sXG4gICAgICB9KSksXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG1pbmltaXplcjogYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbi5zdHlsZXMubWluaWZ5XG4gICAgICAgID8gW1xuICAgICAgICAgICAgbmV3IENzc09wdGltaXplclBsdWdpbih7XG4gICAgICAgICAgICAgIHN1cHBvcnRlZEJyb3dzZXJzOiBidWlsZE9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdXG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLFxuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRUYWlsd2luZENvbmZpZ1BhdGgoeyBwcm9qZWN0Um9vdCwgcm9vdCB9OiBXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIC8vIEEgY29uZmlndXJhdGlvbiBmaWxlIGNhbiBleGlzdCBpbiB0aGUgcHJvamVjdCBvciB3b3Jrc3BhY2Ugcm9vdFxuICAvLyBUaGUgbGlzdCBvZiB2YWxpZCBjb25maWcgZmlsZXMgY2FuIGJlIGZvdW5kOlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vdGFpbHdpbmRsYWJzL3RhaWx3aW5kY3NzL2Jsb2IvODg0NWQxMTJmYjYyZDc5ODE1YjUwYjNiYWU4MGMzMTc0NTBiOGI5Mi9zcmMvdXRpbC9yZXNvbHZlQ29uZmlnUGF0aC5qcyNMNDYtTDUyXG4gIGNvbnN0IHRhaWx3aW5kQ29uZmlnRmlsZXMgPSBbJ3RhaWx3aW5kLmNvbmZpZy5qcycsICd0YWlsd2luZC5jb25maWcuY2pzJ107XG4gIGZvciAoY29uc3QgYmFzZVBhdGggb2YgW3Byb2plY3RSb290LCByb290XSkge1xuICAgIGZvciAoY29uc3QgY29uZmlnRmlsZSBvZiB0YWlsd2luZENvbmZpZ0ZpbGVzKSB7XG4gICAgICAvLyBJcnJlc3BlY3RpdmUgb2YgdGhlIG5hbWUgcHJvamVjdCBsZXZlbCBjb25maWd1cmF0aW9uIHNob3VsZCBhbHdheXMgdGFrZSBwcmVjZWRlbmNlLlxuICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4oYmFzZVBhdGgsIGNvbmZpZ0ZpbGUpO1xuICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoZnVsbFBhdGgpKSB7XG4gICAgICAgIHJldHVybiBmdWxsUGF0aDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuIl19