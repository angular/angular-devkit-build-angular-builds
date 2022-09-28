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
const sass_service_legacy_1 = require("../../sass/sass-service-legacy");
const environment_options_1 = require("../../utils/environment-options");
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
    const { root, projectRoot, buildOptions } = wco;
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
    const sassImplementation = environment_options_1.useLegacySass
        ? new sass_service_legacy_1.SassLegacyWorkerImplementation()
        : new sass_service_1.SassWorkerImplementation();
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
                    options: getSassLoaderOptions(root, projectRoot, sassImplementation, includePaths, false, !buildOptions.verbose),
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
                    options: getSassLoaderOptions(root, projectRoot, sassImplementation, includePaths, true, !buildOptions.verbose),
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
function getSassLoaderOptions(root, projectRoot, implementation, includePaths, indentedSyntax, verbose) {
    return implementation instanceof sass_service_1.SassWorkerImplementation
        ? {
            sourceMap: true,
            api: 'modern',
            implementation,
            // Webpack importer is only implemented in the legacy API.
            // See: https://github.com/webpack-contrib/sass-loader/blob/997f3eb41d86dd00d5fa49c395a1aeb41573108c/src/utils.js#L642-L651
            webpackImporter: false,
            sassOptions: {
                loadPaths: [
                    ...includePaths,
                    // Needed to resolve node packages and retain the same behaviour of with the legacy API as sass-loader resolves
                    // scss also from the cwd and project root.
                    // See: https://github.com/webpack-contrib/sass-loader/blob/997f3eb41d86dd00d5fa49c395a1aeb41573108c/src/utils.js#L307
                    projectRoot,
                    path.join(root, 'node_modules'),
                ],
                // Use expanded as otherwise sass will remove comments that are needed for autoprefixer
                // Ex: /* autoprefixer grid: autoplace */
                // See: https://github.com/webpack-contrib/sass-loader/blob/45ad0be17264ceada5f0b4fb87e9357abe85c4ff/src/getSassOptions.js#L68-L70
                style: 'expanded',
                // Silences compiler warnings from 3rd party stylesheets
                quietDeps: !verbose,
                verbose,
                syntax: indentedSyntax ? 'indented' : 'scss',
            },
        }
        : {
            sourceMap: true,
            api: 'legacy',
            implementation,
            sassOptions: {
                importer: (url, from) => {
                    if (url.charAt(0) === '~') {
                        throw new Error(`'${from}' imports '${url}' with a tilde. Usage of '~' in imports is no longer supported.`);
                    }
                    return null;
                },
                // Prevent use of `fibers` package as it no longer works in newer Node.js versions
                fiber: false,
                indentedSyntax,
                // bootstrap-sass requires a minimum precision of 8
                precision: 8,
                includePaths,
                // Use expanded as otherwise sass will remove comments that are needed for autoprefixer
                // Ex: /* autoprefixer grid: autoplace */
                // See: https://github.com/webpack-contrib/sass-loader/blob/45ad0be17264ceada5f0b4fb87e9357abe85c4ff/src/getSassOptions.js#L68-L70
                outputStyle: 'expanded',
                // Silences compiler warnings from 3rd party stylesheets
                quietDeps: !verbose,
                verbose,
            },
        };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHVDQUF5QjtBQUN6QixzRkFBMkQ7QUFDM0QsMkNBQTZCO0FBRzdCLDBEQUFtRTtBQUNuRSx3RUFBZ0Y7QUFFaEYseUVBQWdFO0FBQ2hFLHdDQUtvQjtBQUNwQiwwRUFBcUU7QUFDckUsOENBSTBCO0FBRTFCLFNBQWdCLG1CQUFtQixDQUNqQyxnQkFBZ0MsRUFDaEMsSUFBWSxFQUNaLGdCQUF5QixFQUN6QixjQUFjLEdBQUcsS0FBSztJQUV0QixNQUFNLFdBQVcsR0FBNkIsRUFBRSxDQUFDO0lBQ2pELE1BQU0sYUFBYSxHQUFhLEVBQUUsQ0FBQztJQUNuQyxNQUFNLEtBQUssR0FBYSxFQUFFLENBQUM7SUFFM0IsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ2pDLE9BQU8sRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxDQUFDO0tBQzlDO0lBRUQsS0FBSyxNQUFNLEtBQUssSUFBSSxJQUFBLG1DQUF5QixFQUFDLGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxFQUFFO1FBQ3pFLElBQUksY0FBYyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUM7UUFDakMsSUFBSSxDQUFDLGNBQWMsRUFBRTtZQUNuQixjQUFjLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDcEQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDLEVBQUU7Z0JBQ2xDLElBQUk7b0JBQ0YsY0FBYyxHQUFHLE9BQU8sQ0FBQyxPQUFP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b0JBQzNDLHNIQUFzSDtvQkFDdEgsV0FBVztvQkFDWCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxjQUFjLENBQUM7aUJBQ2hDO2dCQUNELHVGQUF1RjtnQkFDdkYseUNBQXlDO2dCQUN6QyxrSUFBa0k7Z0JBQ2xJLEtBQUssRUFBRSxVQUFVO2dCQUNqQix3REFBd0Q7Z0JBQ3hELFNBQVMsRUFBRSxDQUFDLE9BQU87Z0JBQ25CLE9BQU87Z0JBQ1AsTUFBTSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxNQUFNO2FBQzdDO1NBQ0Y7UUFDSCxDQUFDLENBQUM7WUFDRSxTQUFTLEVBQUUsSUFBSTtZQUNmLEdBQUcsRUFBRSxRQUFRO1lBQ2IsY0FBYztZQUNkLFdBQVcsRUFBRTtnQkFDWCxRQUFRLEVBQUUsQ0FBQyxHQUFXLEVBQUUsSUFBWSxFQUFFLEVBQUU7b0JBQ3RDLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7d0JBQ3pCLE1BQU0sSUFBSSxLQUFLLENBQ2IsSUFBSSxJQUFJLGNBQWMsR0FBRyxpRUFBaUUsQ0FDM0YsQ0FBQztxQkFDSDtvQkFFRCxPQUFPLElBQUksQ0FBQztnQkFDZCxDQUFDO2dCQUNELGtGQUFrRjtnQkFDbEYsS0FBSyxFQUFFLEtBQUs7Z0JBQ1osY0FBYztnQkFDZCxtREFBbUQ7Z0JBQ25ELFNBQVMsRUFBRSxDQUFDO2dCQUNaLFlBQVk7Z0JBQ1osdUZBQXVGO2dCQUN2Rix5Q0FBeUM7Z0JBQ3pDLGtJQUFrSTtnQkFDbEksV0FBVyxFQUFFLFVBQVU7Z0JBQ3ZCLHdEQUF3RDtnQkFDeEQsU0FBUyxFQUFFLENBQUMsT0FBTztnQkFDbkIsT0FBTzthQUNSO1NBQ0YsQ0FBQztBQUNSLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IE1pbmlDc3NFeHRyYWN0UGx1Z2luIGZyb20gJ21pbmktY3NzLWV4dHJhY3QtcGx1Z2luJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uLCBSdWxlU2V0VXNlSXRlbSB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgU3R5bGVFbGVtZW50IH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uIH0gZnJvbSAnLi4vLi4vc2Fzcy9zYXNzLXNlcnZpY2UnO1xuaW1wb3J0IHsgU2Fzc0xlZ2FjeVdvcmtlckltcGxlbWVudGF0aW9uIH0gZnJvbSAnLi4vLi4vc2Fzcy9zYXNzLXNlcnZpY2UtbGVnYWN5JztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyB1c2VMZWdhY3lTYXNzIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQge1xuICBBbnlDb21wb25lbnRTdHlsZUJ1ZGdldENoZWNrZXIsXG4gIFBvc3Rjc3NDbGlSZXNvdXJjZXMsXG4gIFJlbW92ZUhhc2hQbHVnaW4sXG4gIFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4sXG59IGZyb20gJy4uL3BsdWdpbnMnO1xuaW1wb3J0IHsgQ3NzT3B0aW1pemVyUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy9jc3Mtb3B0aW1pemVyLXBsdWdpbic7XG5pbXBvcnQge1xuICBhc3NldE5hbWVUZW1wbGF0ZUZhY3RvcnksXG4gIGdldE91dHB1dEhhc2hGb3JtYXQsXG4gIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMsXG59IGZyb20gJy4uL3V0aWxzL2hlbHBlcnMnO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUdsb2JhbFN0eWxlcyhcbiAgc3R5bGVFbnRyeXBvaW50czogU3R5bGVFbGVtZW50W10sXG4gIHJvb3Q6IHN0cmluZyxcbiAgcHJlc2VydmVTeW1saW5rczogYm9vbGVhbixcbiAgc2tpcFJlc29sdXRpb24gPSBmYWxzZSxcbik6IHsgZW50cnlQb2ludHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPjsgbm9JbmplY3ROYW1lczogc3RyaW5nW107IHBhdGhzOiBzdHJpbmdbXSB9IHtcbiAgY29uc3QgZW50cnlQb2ludHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPiA9IHt9O1xuICBjb25zdCBub0luamVjdE5hbWVzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBwYXRoczogc3RyaW5nW10gPSBbXTtcblxuICBpZiAoc3R5bGVFbnRyeXBvaW50cy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4geyBlbnRyeVBvaW50cywgbm9JbmplY3ROYW1lcywgcGF0aHMgfTtcbiAgfVxuXG4gIGZvciAoY29uc3Qgc3R5bGUgb2Ygbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhzdHlsZUVudHJ5cG9pbnRzLCAnc3R5bGVzJykpIHtcbiAgICBsZXQgc3R5bGVzaGVldFBhdGggPSBzdHlsZS5pbnB1dDtcbiAgICBpZiAoIXNraXBSZXNvbHV0aW9uKSB7XG4gICAgICBzdHlsZXNoZWV0UGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBzdHlsZXNoZWV0UGF0aCk7XG4gICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoc3R5bGVzaGVldFBhdGgpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgc3R5bGVzaGVldFBhdGggPSByZXF1aXJlLnJlc29sdmUoc3R5bGUuaW5wdXQsIHsgcGF0aHM6IFtyb290XSB9KTtcbiAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghcHJlc2VydmVTeW1saW5rcykge1xuICAgICAgc3R5bGVzaGVldFBhdGggPSBmcy5yZWFscGF0aFN5bmMoc3R5bGVzaGVldFBhdGgpO1xuICAgIH1cblxuICAgIC8vIEFkZCBzdHlsZSBlbnRyeSBwb2ludHMuXG4gICAgaWYgKGVudHJ5UG9pbnRzW3N0eWxlLmJ1bmRsZU5hbWVdKSB7XG4gICAgICBlbnRyeVBvaW50c1tzdHlsZS5idW5kbGVOYW1lXS5wdXNoKHN0eWxlc2hlZXRQYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZW50cnlQb2ludHNbc3R5bGUuYnVuZGxlTmFtZV0gPSBbc3R5bGVzaGVldFBhdGhdO1xuICAgIH1cblxuICAgIC8vIEFkZCBub24gaW5qZWN0ZWQgc3R5bGVzIHRvIHRoZSBsaXN0LlxuICAgIGlmICghc3R5bGUuaW5qZWN0KSB7XG4gICAgICBub0luamVjdE5hbWVzLnB1c2goc3R5bGUuYnVuZGxlTmFtZSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIGdsb2JhbCBjc3MgcGF0aHMuXG4gICAgcGF0aHMucHVzaChzdHlsZXNoZWV0UGF0aCk7XG4gIH1cblxuICByZXR1cm4geyBlbnRyeVBvaW50cywgbm9JbmplY3ROYW1lcywgcGF0aHMgfTtcbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBnZXRTdHlsZXNDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IENvbmZpZ3VyYXRpb24ge1xuICBjb25zdCB7IHJvb3QsIHByb2plY3RSb290LCBidWlsZE9wdGlvbnMgfSA9IHdjbztcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiBDb25maWd1cmF0aW9uWydwbHVnaW5zJ10gPSBbXTtcblxuICBleHRyYVBsdWdpbnMucHVzaChuZXcgQW55Q29tcG9uZW50U3R5bGVCdWRnZXRDaGVja2VyKGJ1aWxkT3B0aW9ucy5idWRnZXRzKSk7XG5cbiAgY29uc3QgY3NzU291cmNlTWFwID0gYnVpbGRPcHRpb25zLnNvdXJjZU1hcC5zdHlsZXM7XG5cbiAgLy8gRGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0LlxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyk7XG5cbiAgLy8gdXNlIGluY2x1ZGVQYXRocyBmcm9tIGFwcENvbmZpZ1xuICBjb25zdCBpbmNsdWRlUGF0aHMgPVxuICAgIGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocz8ubWFwKChwKSA9PiBwYXRoLnJlc29sdmUocm9vdCwgcCkpID8/IFtdO1xuXG4gIC8vIFByb2Nlc3MgZ2xvYmFsIHN0eWxlcy5cbiAgY29uc3Qge1xuICAgIGVudHJ5UG9pbnRzLFxuICAgIG5vSW5qZWN0TmFtZXMsXG4gICAgcGF0aHM6IGdsb2JhbFN0eWxlUGF0aHMsXG4gIH0gPSByZXNvbHZlR2xvYmFsU3R5bGVzKGJ1aWxkT3B0aW9ucy5zdHlsZXMsIHJvb3QsICEhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MpO1xuICBpZiAobm9JbmplY3ROYW1lcy5sZW5ndGggPiAwKSB7XG4gICAgLy8gQWRkIHBsdWdpbiB0byByZW1vdmUgaGFzaGVzIGZyb20gbGF6eSBzdHlsZXMuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFJlbW92ZUhhc2hQbHVnaW4oeyBjaHVua05hbWVzOiBub0luamVjdE5hbWVzLCBoYXNoRm9ybWF0IH0pKTtcbiAgfVxuXG4gIGNvbnN0IHNhc3NJbXBsZW1lbnRhdGlvbiA9IHVzZUxlZ2FjeVNhc3NcbiAgICA/IG5ldyBTYXNzTGVnYWN5V29ya2VySW1wbGVtZW50YXRpb24oKVxuICAgIDogbmV3IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbigpO1xuXG4gIGV4dHJhUGx1Z2lucy5wdXNoKHtcbiAgICBhcHBseShjb21waWxlcikge1xuICAgICAgY29tcGlsZXIuaG9va3Muc2h1dGRvd24udGFwKCdzYXNzLXdvcmtlcicsICgpID0+IHtcbiAgICAgICAgc2Fzc0ltcGxlbWVudGF0aW9uLmNsb3NlKCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9KTtcblxuICBjb25zdCBhc3NldE5hbWVUZW1wbGF0ZSA9IGFzc2V0TmFtZVRlbXBsYXRlRmFjdG9yeShoYXNoRm9ybWF0KTtcblxuICBjb25zdCBleHRyYVBvc3Rjc3NQbHVnaW5zOiBpbXBvcnQoJ3Bvc3Rjc3MnKS5QbHVnaW5bXSA9IFtdO1xuXG4gIC8vIEF0dGVtcHQgdG8gc2V0dXAgVGFpbHdpbmQgQ1NTXG4gIC8vIE9ubHkgbG9hZCBUYWlsd2luZCBDU1MgcGx1Z2luIGlmIGNvbmZpZ3VyYXRpb24gZmlsZSB3YXMgZm91bmQuXG4gIC8vIFRoaXMgYWN0cyBhcyBhIGd1YXJkIHRvIGVuc3VyZSB0aGUgcHJvamVjdCBhY3R1YWxseSB3YW50cyB0byB1c2UgVGFpbHdpbmQgQ1NTLlxuICAvLyBUaGUgcGFja2FnZSBtYXkgYmUgdW5rbm93bmluZ2x5IHByZXNlbnQgZHVlIHRvIGEgdGhpcmQtcGFydHkgdHJhbnNpdGl2ZSBwYWNrYWdlIGRlcGVuZGVuY3kuXG4gIGNvbnN0IHRhaWx3aW5kQ29uZmlnUGF0aCA9IGdldFRhaWx3aW5kQ29uZmlnUGF0aCh3Y28pO1xuICBpZiAodGFpbHdpbmRDb25maWdQYXRoKSB7XG4gICAgbGV0IHRhaWx3aW5kUGFja2FnZVBhdGg7XG4gICAgdHJ5IHtcbiAgICAgIHRhaWx3aW5kUGFja2FnZVBhdGggPSByZXF1aXJlLnJlc29sdmUoJ3RhaWx3aW5kY3NzJywgeyBwYXRoczogW3djby5yb290XSB9KTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGNvbnN0IHJlbGF0aXZlVGFpbHdpbmRDb25maWdQYXRoID0gcGF0aC5yZWxhdGl2ZSh3Y28ucm9vdCwgdGFpbHdpbmRDb25maWdQYXRoKTtcbiAgICAgIHdjby5sb2dnZXIud2FybihcbiAgICAgICAgYFRhaWx3aW5kIENTUyBjb25maWd1cmF0aW9uIGZpbGUgZm91bmQgKCR7cmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGh9KWAgK1xuICAgICAgICAgIGAgYnV0IHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UgaXMgbm90IGluc3RhbGxlZC5gICtcbiAgICAgICAgICBgIFRvIGVuYWJsZSBUYWlsd2luZCBDU1MsIHBsZWFzZSBpbnN0YWxsIHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UuYCxcbiAgICAgICk7XG4gICAgfVxuICAgIGlmICh0YWlsd2luZFBhY2thZ2VQYXRoKSB7XG4gICAgICBleHRyYVBvc3Rjc3NQbHVnaW5zLnB1c2gocmVxdWlyZSh0YWlsd2luZFBhY2thZ2VQYXRoKSh7IGNvbmZpZzogdGFpbHdpbmRDb25maWdQYXRoIH0pKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBwb3N0Y3NzSW1wb3J0cyA9IHJlcXVpcmUoJ3Bvc3Rjc3MtaW1wb3J0Jyk7XG4gIGNvbnN0IGF1dG9wcmVmaXhlcjogdHlwZW9mIGltcG9ydCgnYXV0b3ByZWZpeGVyJykgPSByZXF1aXJlKCdhdXRvcHJlZml4ZXInKTtcblxuICBjb25zdCBwb3N0Y3NzT3B0aW9uc0NyZWF0b3IgPSAoaW5saW5lU291cmNlbWFwczogYm9vbGVhbiwgZXh0cmFjdGVkOiBib29sZWFuKSA9PiB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBjb25zdCBvcHRpb25HZW5lcmF0b3IgPSAobG9hZGVyOiBhbnkpID0+ICh7XG4gICAgICBtYXA6IGlubGluZVNvdXJjZW1hcHNcbiAgICAgICAgPyB7XG4gICAgICAgICAgICBpbmxpbmU6IHRydWUsXG4gICAgICAgICAgICBhbm5vdGF0aW9uOiBmYWxzZSxcbiAgICAgICAgICB9XG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgcGx1Z2luczogW1xuICAgICAgICBwb3N0Y3NzSW1wb3J0cyh7XG4gICAgICAgICAgbG9hZDogKGZpbGVuYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgbG9hZGVyLmZzLnJlYWRGaWxlKGZpbGVuYW1lLCAoZXJyOiBFcnJvciwgZGF0YTogQnVmZmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoY29udGVudCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICAgIFBvc3Rjc3NDbGlSZXNvdXJjZXMoe1xuICAgICAgICAgIGJhc2VIcmVmOiBidWlsZE9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgICAgZGVwbG95VXJsOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgICAgIHJlc291cmNlc091dHB1dFBhdGg6IGJ1aWxkT3B0aW9ucy5yZXNvdXJjZXNPdXRwdXRQYXRoLFxuICAgICAgICAgIGxvYWRlcixcbiAgICAgICAgICBmaWxlbmFtZTogYXNzZXROYW1lVGVtcGxhdGUsXG4gICAgICAgICAgZW1pdEZpbGU6IGJ1aWxkT3B0aW9ucy5wbGF0Zm9ybSAhPT0gJ3NlcnZlcicsXG4gICAgICAgICAgZXh0cmFjdGVkLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uZXh0cmFQb3N0Y3NzUGx1Z2lucyxcbiAgICAgICAgYXV0b3ByZWZpeGVyKHtcbiAgICAgICAgICBpZ25vcmVVbmtub3duVmVyc2lvbnM6IHRydWUsXG4gICAgICAgICAgb3ZlcnJpZGVCcm93c2Vyc2xpc3Q6IGJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2VycyxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuICAgIC8vIHBvc3Rjc3MtbG9hZGVyIGZhaWxzIHdoZW4gdHJ5aW5nIHRvIGRldGVybWluZSBjb25maWd1cmF0aW9uIGZpbGVzIGZvciBkYXRhIFVSSXNcbiAgICBvcHRpb25HZW5lcmF0b3IuY29uZmlnID0gZmFsc2U7XG5cbiAgICByZXR1cm4gb3B0aW9uR2VuZXJhdG9yO1xuICB9O1xuXG4gIC8vIGxvYWQgY29tcG9uZW50IGNzcyBhcyByYXcgc3RyaW5nc1xuICBjb25zdCBjb21wb25lbnRzU291cmNlTWFwID0gISEoXG4gICAgY3NzU291cmNlTWFwICYmXG4gICAgLy8gTmV2ZXIgdXNlIGNvbXBvbmVudCBjc3Mgc291cmNlbWFwIHdoZW4gc3R5bGUgb3B0aW1pemF0aW9ucyBhcmUgb24uXG4gICAgLy8gSXQgd2lsbCBqdXN0IGluY3JlYXNlIGJ1bmRsZSBzaXplIHdpdGhvdXQgb2ZmZXJpbmcgZ29vZCBkZWJ1ZyBleHBlcmllbmNlLlxuICAgICFidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uLnN0eWxlcy5taW5pZnkgJiZcbiAgICAvLyBJbmxpbmUgYWxsIHNvdXJjZW1hcCB0eXBlcyBleGNlcHQgaGlkZGVuIG9uZXMsIHdoaWNoIGFyZSB0aGUgc2FtZSBhcyBubyBzb3VyY2VtYXBzXG4gICAgLy8gZm9yIGNvbXBvbmVudCBjc3MuXG4gICAgIWJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAuaGlkZGVuXG4gICk7XG5cbiAgLy8gZXh0cmFjdCBnbG9iYWwgY3NzIGZyb20ganMgZmlsZXMgaW50byBvd24gY3NzIGZpbGUuXG4gIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBNaW5pQ3NzRXh0cmFjdFBsdWdpbih7IGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmV4dHJhY3R9LmNzc2AgfSkpO1xuXG4gIGlmICghYnVpbGRPcHRpb25zLmhtcikge1xuICAgIC8vIGRvbid0IHJlbW92ZSBgLmpzYCBmaWxlcyBmb3IgYC5jc3NgIHdoZW4gd2UgYXJlIHVzaW5nIEhNUiB0aGVzZSBjb250YWluIEhNUiBhY2NlcHQgY29kZXMuXG4gICAgLy8gc3VwcHJlc3MgZW1wdHkgLmpzIGZpbGVzIGluIGNzcyBvbmx5IGVudHJ5IHBvaW50cy5cbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU3VwcHJlc3NFeHRyYWN0ZWRUZXh0Q2h1bmtzV2VicGFja1BsdWdpbigpKTtcbiAgfVxuXG4gIGNvbnN0IHBvc3RDc3MgPSByZXF1aXJlKCdwb3N0Y3NzJyk7XG4gIGNvbnN0IHBvc3RDc3NMb2FkZXJQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCdwb3N0Y3NzLWxvYWRlcicpO1xuXG4gIGNvbnN0IGNvbXBvbmVudFN0eWxlTG9hZGVyczogUnVsZVNldFVzZUl0ZW1bXSA9IFtcbiAgICB7XG4gICAgICBsb2FkZXI6IHBvc3RDc3NMb2FkZXJQYXRoLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICBpbXBsZW1lbnRhdGlvbjogcG9zdENzcyxcbiAgICAgICAgcG9zdGNzc09wdGlvbnM6IHBvc3Rjc3NPcHRpb25zQ3JlYXRvcihjb21wb25lbnRzU291cmNlTWFwLCBmYWxzZSksXG4gICAgICB9LFxuICAgIH0sXG4gIF07XG5cbiAgY29uc3QgZ2xvYmFsU3R5bGVMb2FkZXJzOiBSdWxlU2V0VXNlSXRlbVtdID0gW1xuICAgIHtcbiAgICAgIGxvYWRlcjogTWluaUNzc0V4dHJhY3RQbHVnaW4ubG9hZGVyLFxuICAgIH0sXG4gICAge1xuICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ2Nzcy1sb2FkZXInKSxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgdXJsOiBmYWxzZSxcbiAgICAgICAgc291cmNlTWFwOiAhIWNzc1NvdXJjZU1hcCxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBsb2FkZXI6IHBvc3RDc3NMb2FkZXJQYXRoLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICBpbXBsZW1lbnRhdGlvbjogcG9zdENzcyxcbiAgICAgICAgcG9zdGNzc09wdGlvbnM6IHBvc3Rjc3NPcHRpb25zQ3JlYXRvcihmYWxzZSwgdHJ1ZSksXG4gICAgICAgIHNvdXJjZU1hcDogISFjc3NTb3VyY2VNYXAsXG4gICAgICB9LFxuICAgIH0sXG4gIF07XG5cbiAgY29uc3Qgc3R5bGVMYW5ndWFnZXM6IHtcbiAgICBleHRlbnNpb25zOiBzdHJpbmdbXTtcbiAgICB1c2U6IFJ1bGVTZXRVc2VJdGVtW107XG4gIH1bXSA9IFtcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ2NzcyddLFxuICAgICAgdXNlOiBbXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnc2NzcyddLFxuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgncmVzb2x2ZS11cmwtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdzYXNzLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IGdldFNhc3NMb2FkZXJPcHRpb25zKFxuICAgICAgICAgICAgcm9vdCxcbiAgICAgICAgICAgIHByb2plY3RSb290LFxuICAgICAgICAgICAgc2Fzc0ltcGxlbWVudGF0aW9uLFxuICAgICAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICAhYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ3Nhc3MnXSxcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Jlc29sdmUtdXJsLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnc2Fzcy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiBnZXRTYXNzTG9hZGVyT3B0aW9ucyhcbiAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICBwcm9qZWN0Um9vdCxcbiAgICAgICAgICAgIHNhc3NJbXBsZW1lbnRhdGlvbixcbiAgICAgICAgICAgIGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAgIHRydWUsXG4gICAgICAgICAgICAhYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ2xlc3MnXSxcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ2xlc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgaW1wbGVtZW50YXRpb246IHJlcXVpcmUoJ2xlc3MnKSxcbiAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgICAgbGVzc09wdGlvbnM6IHtcbiAgICAgICAgICAgICAgamF2YXNjcmlwdEVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgIHBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gIF07XG5cbiAgcmV0dXJuIHtcbiAgICBlbnRyeTogZW50cnlQb2ludHMsXG4gICAgbW9kdWxlOiB7XG4gICAgICBydWxlczogc3R5bGVMYW5ndWFnZXMubWFwKCh7IGV4dGVuc2lvbnMsIHVzZSB9KSA9PiAoe1xuICAgICAgICB0ZXN0OiBuZXcgUmVnRXhwKGBcXFxcLig/OiR7ZXh0ZW5zaW9ucy5qb2luKCd8Jyl9KSRgLCAnaScpLFxuICAgICAgICBydWxlczogW1xuICAgICAgICAgIC8vIFNldHVwIHByb2Nlc3NpbmcgcnVsZXMgZm9yIGdsb2JhbCBhbmQgY29tcG9uZW50IHN0eWxlc1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgICAgIC8vIEdsb2JhbCBzdHlsZXMgYXJlIG9ubHkgZGVmaW5lZCBnbG9iYWwgc3R5bGVzXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1c2U6IGdsb2JhbFN0eWxlTG9hZGVycyxcbiAgICAgICAgICAgICAgICBpbmNsdWRlOiBnbG9iYWxTdHlsZVBhdGhzLFxuICAgICAgICAgICAgICAgIHJlc291cmNlUXVlcnk6IHsgbm90OiBbL1xcP25nUmVzb3VyY2UvXSB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzIGFyZSBhbGwgc3R5bGVzIGV4Y2VwdCBkZWZpbmVkIGdsb2JhbCBzdHlsZXNcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVzZTogY29tcG9uZW50U3R5bGVMb2FkZXJzLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhc3NldC9zb3VyY2UnLFxuICAgICAgICAgICAgICAgIHJlc291cmNlUXVlcnk6IC9cXD9uZ1Jlc291cmNlLyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7IHVzZSB9LFxuICAgICAgICBdLFxuICAgICAgfSkpLFxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICBtaW5pbWl6ZXI6IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24uc3R5bGVzLm1pbmlmeVxuICAgICAgICA/IFtcbiAgICAgICAgICAgIG5ldyBDc3NPcHRpbWl6ZXJQbHVnaW4oe1xuICAgICAgICAgICAgICBzdXBwb3J0ZWRCcm93c2VyczogYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICB9LFxuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2lucyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0VGFpbHdpbmRDb25maWdQYXRoKHsgcHJvamVjdFJvb3QsIHJvb3QgfTogV2VicGFja0NvbmZpZ09wdGlvbnMpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAvLyBBIGNvbmZpZ3VyYXRpb24gZmlsZSBjYW4gZXhpc3QgaW4gdGhlIHByb2plY3Qgb3Igd29ya3NwYWNlIHJvb3RcbiAgLy8gVGhlIGxpc3Qgb2YgdmFsaWQgY29uZmlnIGZpbGVzIGNhbiBiZSBmb3VuZDpcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3RhaWx3aW5kbGFicy90YWlsd2luZGNzcy9ibG9iLzg4NDVkMTEyZmI2MmQ3OTgxNWI1MGIzYmFlODBjMzE3NDUwYjhiOTIvc3JjL3V0aWwvcmVzb2x2ZUNvbmZpZ1BhdGguanMjTDQ2LUw1MlxuICBjb25zdCB0YWlsd2luZENvbmZpZ0ZpbGVzID0gWyd0YWlsd2luZC5jb25maWcuanMnLCAndGFpbHdpbmQuY29uZmlnLmNqcyddO1xuICBmb3IgKGNvbnN0IGJhc2VQYXRoIG9mIFtwcm9qZWN0Um9vdCwgcm9vdF0pIHtcbiAgICBmb3IgKGNvbnN0IGNvbmZpZ0ZpbGUgb2YgdGFpbHdpbmRDb25maWdGaWxlcykge1xuICAgICAgLy8gSXJyZXNwZWN0aXZlIG9mIHRoZSBuYW1lIHByb2plY3QgbGV2ZWwgY29uZmlndXJhdGlvbiBzaG91bGQgYWx3YXlzIHRha2UgcHJlY2VkZW5jZS5cbiAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGJhc2VQYXRoLCBjb25maWdGaWxlKTtcbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKGZ1bGxQYXRoKSkge1xuICAgICAgICByZXR1cm4gZnVsbFBhdGg7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZ2V0U2Fzc0xvYWRlck9wdGlvbnMoXG4gIHJvb3Q6IHN0cmluZyxcbiAgcHJvamVjdFJvb3Q6IHN0cmluZyxcbiAgaW1wbGVtZW50YXRpb246IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbiB8IFNhc3NMZWdhY3lXb3JrZXJJbXBsZW1lbnRhdGlvbixcbiAgaW5jbHVkZVBhdGhzOiBzdHJpbmdbXSxcbiAgaW5kZW50ZWRTeW50YXg6IGJvb2xlYW4sXG4gIHZlcmJvc2U6IGJvb2xlYW4sXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiBpbXBsZW1lbnRhdGlvbiBpbnN0YW5jZW9mIFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvblxuICAgID8ge1xuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgIGFwaTogJ21vZGVybicsXG4gICAgICAgIGltcGxlbWVudGF0aW9uLFxuICAgICAgICAvLyBXZWJwYWNrIGltcG9ydGVyIGlzIG9ubHkgaW1wbGVtZW50ZWQgaW4gdGhlIGxlZ2FjeSBBUEkuXG4gICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zYXNzLWxvYWRlci9ibG9iLzk5N2YzZWI0MWQ4NmRkMDBkNWZhNDljMzk1YTFhZWI0MTU3MzEwOGMvc3JjL3V0aWxzLmpzI0w2NDItTDY1MVxuICAgICAgICB3ZWJwYWNrSW1wb3J0ZXI6IGZhbHNlLFxuICAgICAgICBzYXNzT3B0aW9uczoge1xuICAgICAgICAgIGxvYWRQYXRoczogW1xuICAgICAgICAgICAgLi4uaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgLy8gTmVlZGVkIHRvIHJlc29sdmUgbm9kZSBwYWNrYWdlcyBhbmQgcmV0YWluIHRoZSBzYW1lIGJlaGF2aW91ciBvZiB3aXRoIHRoZSBsZWdhY3kgQVBJIGFzIHNhc3MtbG9hZGVyIHJlc29sdmVzXG4gICAgICAgICAgICAvLyBzY3NzIGFsc28gZnJvbSB0aGUgY3dkIGFuZCBwcm9qZWN0IHJvb3QuXG4gICAgICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc2Fzcy1sb2FkZXIvYmxvYi85OTdmM2ViNDFkODZkZDAwZDVmYTQ5YzM5NWExYWViNDE1NzMxMDhjL3NyYy91dGlscy5qcyNMMzA3XG4gICAgICAgICAgICBwcm9qZWN0Um9vdCxcbiAgICAgICAgICAgIHBhdGguam9pbihyb290LCAnbm9kZV9tb2R1bGVzJyksXG4gICAgICAgICAgXSxcbiAgICAgICAgICAvLyBVc2UgZXhwYW5kZWQgYXMgb3RoZXJ3aXNlIHNhc3Mgd2lsbCByZW1vdmUgY29tbWVudHMgdGhhdCBhcmUgbmVlZGVkIGZvciBhdXRvcHJlZml4ZXJcbiAgICAgICAgICAvLyBFeDogLyogYXV0b3ByZWZpeGVyIGdyaWQ6IGF1dG9wbGFjZSAqL1xuICAgICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zYXNzLWxvYWRlci9ibG9iLzQ1YWQwYmUxNzI2NGNlYWRhNWYwYjRmYjg3ZTkzNTdhYmU4NWM0ZmYvc3JjL2dldFNhc3NPcHRpb25zLmpzI0w2OC1MNzBcbiAgICAgICAgICBzdHlsZTogJ2V4cGFuZGVkJyxcbiAgICAgICAgICAvLyBTaWxlbmNlcyBjb21waWxlciB3YXJuaW5ncyBmcm9tIDNyZCBwYXJ0eSBzdHlsZXNoZWV0c1xuICAgICAgICAgIHF1aWV0RGVwczogIXZlcmJvc2UsXG4gICAgICAgICAgdmVyYm9zZSxcbiAgICAgICAgICBzeW50YXg6IGluZGVudGVkU3ludGF4ID8gJ2luZGVudGVkJyA6ICdzY3NzJyxcbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICA6IHtcbiAgICAgICAgc291cmNlTWFwOiB0cnVlLFxuICAgICAgICBhcGk6ICdsZWdhY3knLFxuICAgICAgICBpbXBsZW1lbnRhdGlvbixcbiAgICAgICAgc2Fzc09wdGlvbnM6IHtcbiAgICAgICAgICBpbXBvcnRlcjogKHVybDogc3RyaW5nLCBmcm9tOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIGlmICh1cmwuY2hhckF0KDApID09PSAnficpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgIGAnJHtmcm9tfScgaW1wb3J0cyAnJHt1cmx9JyB3aXRoIGEgdGlsZGUuIFVzYWdlIG9mICd+JyBpbiBpbXBvcnRzIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQuYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfSxcbiAgICAgICAgICAvLyBQcmV2ZW50IHVzZSBvZiBgZmliZXJzYCBwYWNrYWdlIGFzIGl0IG5vIGxvbmdlciB3b3JrcyBpbiBuZXdlciBOb2RlLmpzIHZlcnNpb25zXG4gICAgICAgICAgZmliZXI6IGZhbHNlLFxuICAgICAgICAgIGluZGVudGVkU3ludGF4LFxuICAgICAgICAgIC8vIGJvb3RzdHJhcC1zYXNzIHJlcXVpcmVzIGEgbWluaW11bSBwcmVjaXNpb24gb2YgOFxuICAgICAgICAgIHByZWNpc2lvbjogOCxcbiAgICAgICAgICBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgLy8gVXNlIGV4cGFuZGVkIGFzIG90aGVyd2lzZSBzYXNzIHdpbGwgcmVtb3ZlIGNvbW1lbnRzIHRoYXQgYXJlIG5lZWRlZCBmb3IgYXV0b3ByZWZpeGVyXG4gICAgICAgICAgLy8gRXg6IC8qIGF1dG9wcmVmaXhlciBncmlkOiBhdXRvcGxhY2UgKi9cbiAgICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc2Fzcy1sb2FkZXIvYmxvYi80NWFkMGJlMTcyNjRjZWFkYTVmMGI0ZmI4N2U5MzU3YWJlODVjNGZmL3NyYy9nZXRTYXNzT3B0aW9ucy5qcyNMNjgtTDcwXG4gICAgICAgICAgb3V0cHV0U3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICAgICAgLy8gU2lsZW5jZXMgY29tcGlsZXIgd2FybmluZ3MgZnJvbSAzcmQgcGFydHkgc3R5bGVzaGVldHNcbiAgICAgICAgICBxdWlldERlcHM6ICF2ZXJib3NlLFxuICAgICAgICAgIHZlcmJvc2UsXG4gICAgICAgIH0sXG4gICAgICB9O1xufVxuIl19