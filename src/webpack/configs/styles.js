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
const url_1 = require("url");
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
                    options: getSassLoaderOptions(root, sassImplementation, includePaths, false, !buildOptions.verbose, !!buildOptions.preserveSymlinks),
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
                    options: getSassLoaderOptions(root, sassImplementation, includePaths, true, !buildOptions.verbose, !!buildOptions.preserveSymlinks),
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
function getSassLoaderOptions(root, implementation, includePaths, indentedSyntax, verbose, preserveSymlinks) {
    return implementation instanceof sass_service_1.SassWorkerImplementation
        ? {
            sourceMap: true,
            api: 'modern',
            implementation,
            // Webpack importer is only implemented in the legacy API and we have our own custom Webpack importer.
            // See: https://github.com/webpack-contrib/sass-loader/blob/997f3eb41d86dd00d5fa49c395a1aeb41573108c/src/utils.js#L642-L651
            webpackImporter: false,
            sassOptions: (loaderContext) => ({
                importers: [getSassResolutionImporter(loaderContext, root, preserveSymlinks)],
                loadPaths: includePaths,
                // Use expanded as otherwise sass will remove comments that are needed for autoprefixer
                // Ex: /* autoprefixer grid: autoplace */
                // See: https://github.com/webpack-contrib/sass-loader/blob/45ad0be17264ceada5f0b4fb87e9357abe85c4ff/src/getSassOptions.js#L68-L70
                style: 'expanded',
                // Silences compiler warnings from 3rd party stylesheets
                quietDeps: !verbose,
                verbose,
                syntax: indentedSyntax ? 'indented' : 'scss',
            }),
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
function getSassResolutionImporter(loaderContext, root, preserveSymlinks) {
    const commonResolverOptions = {
        conditionNames: ['sass', 'style'],
        mainFields: ['sass', 'style', 'main', '...'],
        extensions: ['.scss', '.sass', '.css'],
        restrictions: [/\.((sa|sc|c)ss)$/i],
        preferRelative: true,
        symlinks: !preserveSymlinks,
    };
    // Sass also supports import-only files. If you name a file <name>.import.scss, it will only be loaded for imports, not for @uses.
    // See: https://sass-lang.com/documentation/at-rules/import#import-only-files
    const resolveImport = loaderContext.getResolve({
        ...commonResolverOptions,
        dependencyType: 'sass-import',
        mainFiles: ['_index.import', '_index', 'index.import', 'index', '...'],
    });
    const resolveModule = loaderContext.getResolve({
        ...commonResolverOptions,
        dependencyType: 'sass-module',
        mainFiles: ['_index', 'index', '...'],
    });
    return {
        findFileUrl: (url, { fromImport }) => {
            const resolve = fromImport ? resolveImport : resolveModule;
            return resolve(root, url)
                .then((file) => (0, url_1.pathToFileURL)(file))
                .catch(() => null);
        },
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHVDQUF5QjtBQUN6QixzRkFBMkQ7QUFDM0QsMkNBQTZCO0FBRTdCLDZCQUFvQztBQUdwQywwREFBbUU7QUFDbkUsd0VBQWdGO0FBRWhGLHlFQUFnRTtBQUNoRSx3Q0FLb0I7QUFDcEIsMEVBQXFFO0FBQ3JFLDhDQUkwQjtBQUUxQixTQUFnQixtQkFBbUIsQ0FDakMsZ0JBQWdDLEVBQ2hDLElBQVksRUFDWixnQkFBeUIsRUFDekIsY0FBYyxHQUFHLEtBQUs7SUFFdEIsTUFBTSxXQUFXLEdBQTZCLEVBQUUsQ0FBQztJQUNqRCxNQUFNLGFBQWEsR0FBYSxFQUFFLENBQUM7SUFDbkMsTUFBTSxLQUFLLEdBQWEsRUFBRSxDQUFDO0lBRTNCLElBQUksZ0JBQWdCLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtRQUNqQyxPQUFPLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsQ0FBQztLQUM5QztJQUVELEtBQUssTUFBTSxLQUFLLElBQUksSUFBQSxtQ0FBeUIsRUFBQyxnQkFBZ0IsRUFBRSxRQUFRLENBQUMsRUFBRTtRQUN6RSxJQUFJLGNBQWMsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQ2pDLElBQUksQ0FBQyxjQUFjLEVBQUU7WUFDbkIsY0FBYyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1lBQ3BELElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxFQUFFO2dCQUNsQyxJQUFJO29CQUNGLGNBQWMsR0FBRyxP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QixDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IE1pbmlDc3NFeHRyYWN0UGx1Z2luIGZyb20gJ21pbmktY3NzLWV4dHJhY3QtcGx1Z2luJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHlwZSB7IEZpbGVJbXBvcnRlciB9IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgdHlwZSB7IENvbmZpZ3VyYXRpb24sIExvYWRlckNvbnRleHQsIFJ1bGVTZXRVc2VJdGVtIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBTdHlsZUVsZW1lbnQgfSBmcm9tICcuLi8uLi9idWlsZGVycy9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBTYXNzV29ya2VySW1wbGVtZW50YXRpb24gfSBmcm9tICcuLi8uLi9zYXNzL3Nhc3Mtc2VydmljZSc7XG5pbXBvcnQgeyBTYXNzTGVnYWN5V29ya2VySW1wbGVtZW50YXRpb24gfSBmcm9tICcuLi8uLi9zYXNzL3Nhc3Mtc2VydmljZS1sZWdhY3knO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IHVzZUxlZ2FjeVNhc3MgfSBmcm9tICcuLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7XG4gIEFueUNvbXBvbmVudFN0eWxlQnVkZ2V0Q2hlY2tlcixcbiAgUG9zdGNzc0NsaVJlc291cmNlcyxcbiAgUmVtb3ZlSGFzaFBsdWdpbixcbiAgU3VwcHJlc3NFeHRyYWN0ZWRUZXh0Q2h1bmtzV2VicGFja1BsdWdpbixcbn0gZnJvbSAnLi4vcGx1Z2lucyc7XG5pbXBvcnQgeyBDc3NPcHRpbWl6ZXJQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL2Nzcy1vcHRpbWl6ZXItcGx1Z2luJztcbmltcG9ydCB7XG4gIGFzc2V0TmFtZVRlbXBsYXRlRmFjdG9yeSxcbiAgZ2V0T3V0cHV0SGFzaEZvcm1hdCxcbiAgbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyxcbn0gZnJvbSAnLi4vdXRpbHMvaGVscGVycyc7XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlR2xvYmFsU3R5bGVzKFxuICBzdHlsZUVudHJ5cG9pbnRzOiBTdHlsZUVsZW1lbnRbXSxcbiAgcm9vdDogc3RyaW5nLFxuICBwcmVzZXJ2ZVN5bWxpbmtzOiBib29sZWFuLFxuICBza2lwUmVzb2x1dGlvbiA9IGZhbHNlLFxuKTogeyBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+OyBub0luamVjdE5hbWVzOiBzdHJpbmdbXTsgcGF0aHM6IHN0cmluZ1tdIH0ge1xuICBjb25zdCBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge307XG4gIGNvbnN0IG5vSW5qZWN0TmFtZXM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGlmIChzdHlsZUVudHJ5cG9pbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB7IGVudHJ5UG9pbnRzLCBub0luamVjdE5hbWVzLCBwYXRocyB9O1xuICB9XG5cbiAgZm9yIChjb25zdCBzdHlsZSBvZiBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKHN0eWxlRW50cnlwb2ludHMsICdzdHlsZXMnKSkge1xuICAgIGxldCBzdHlsZXNoZWV0UGF0aCA9IHN0eWxlLmlucHV0O1xuICAgIGlmICghc2tpcFJlc29sdXRpb24pIHtcbiAgICAgIHN0eWxlc2hlZXRQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIHN0eWxlc2hlZXRQYXRoKTtcbiAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzdHlsZXNoZWV0UGF0aCkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBzdHlsZXNoZWV0UGF0aCA9IHJlcXVpcmUucmVzb2x2ZShzdHlsZS5pbnB1dCwgeyBwYXRoczogW3Jvb3RdIH0pO1xuICAgICAgICB9IGNhdGNoIHt9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFwcmVzZXJ2ZVN5bWxpbmtzKSB7XG4gICAgICBzdHlsZXNoZWV0UGF0aCA9IGZzLnJlYWxwYXRoU3luYyhzdHlsZXNoZWV0UGF0aCk7XG4gICAgfVxuXG4gICAgLy8gQWRkIHN0eWxlIGVudHJ5IHBvaW50cy5cbiAgICBpZiAoZW50cnlQb2ludHNbc3R5bGUuYnVuZGxlTmFtZV0pIHtcbiAgICAgIGVudHJ5UG9pbnRzW3N0eWxlLmJ1bmRsZU5hbWVdLnB1c2goc3R5bGVzaGVldFBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbnRyeVBvaW50c1tzdHlsZS5idW5kbGVOYW1lXSA9IFtzdHlsZXNoZWV0UGF0aF07XG4gICAgfVxuXG4gICAgLy8gQWRkIG5vbiBpbmplY3RlZCBzdHlsZXMgdG8gdGhlIGxpc3QuXG4gICAgaWYgKCFzdHlsZS5pbmplY3QpIHtcbiAgICAgIG5vSW5qZWN0TmFtZXMucHVzaChzdHlsZS5idW5kbGVOYW1lKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgZ2xvYmFsIGNzcyBwYXRocy5cbiAgICBwYXRocy5wdXNoKHN0eWxlc2hlZXRQYXRoKTtcbiAgfVxuXG4gIHJldHVybiB7IGVudHJ5UG9pbnRzLCBub0luamVjdE5hbWVzLCBwYXRocyB9O1xufVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGdldFN0eWxlc0NvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKTogQ29uZmlndXJhdGlvbiB7XG4gIGNvbnN0IHsgcm9vdCwgcHJvamVjdFJvb3QsIGJ1aWxkT3B0aW9ucyB9ID0gd2NvO1xuICBjb25zdCBleHRyYVBsdWdpbnM6IENvbmZpZ3VyYXRpb25bJ3BsdWdpbnMnXSA9IFtdO1xuXG4gIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBBbnlDb21wb25lbnRTdHlsZUJ1ZGdldENoZWNrZXIoYnVpbGRPcHRpb25zLmJ1ZGdldHMpKTtcblxuICBjb25zdCBjc3NTb3VyY2VNYXAgPSBidWlsZE9wdGlvbnMuc291cmNlTWFwLnN0eWxlcztcblxuICAvLyBEZXRlcm1pbmUgaGFzaGluZyBmb3JtYXQuXG4gIGNvbnN0IGhhc2hGb3JtYXQgPSBnZXRPdXRwdXRIYXNoRm9ybWF0KGJ1aWxkT3B0aW9ucy5vdXRwdXRIYXNoaW5nKTtcblxuICAvLyB1c2UgaW5jbHVkZVBhdGhzIGZyb20gYXBwQ29uZmlnXG4gIGNvbnN0IGluY2x1ZGVQYXRocyA9XG4gICAgYnVpbGRPcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucz8uaW5jbHVkZVBhdGhzPy5tYXAoKHApID0+IHBhdGgucmVzb2x2ZShyb290LCBwKSkgPz8gW107XG5cbiAgLy8gUHJvY2VzcyBnbG9iYWwgc3R5bGVzLlxuICBjb25zdCB7XG4gICAgZW50cnlQb2ludHMsXG4gICAgbm9JbmplY3ROYW1lcyxcbiAgICBwYXRoczogZ2xvYmFsU3R5bGVQYXRocyxcbiAgfSA9IHJlc29sdmVHbG9iYWxTdHlsZXMoYnVpbGRPcHRpb25zLnN0eWxlcywgcm9vdCwgISFidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyk7XG4gIGlmIChub0luamVjdE5hbWVzLmxlbmd0aCA+IDApIHtcbiAgICAvLyBBZGQgcGx1Z2luIHRvIHJlbW92ZSBoYXNoZXMgZnJvbSBsYXp5IHN0eWxlcy5cbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgUmVtb3ZlSGFzaFBsdWdpbih7IGNodW5rTmFtZXM6IG5vSW5qZWN0TmFtZXMsIGhhc2hGb3JtYXQgfSkpO1xuICB9XG5cbiAgY29uc3Qgc2Fzc0ltcGxlbWVudGF0aW9uID0gdXNlTGVnYWN5U2Fzc1xuICAgID8gbmV3IFNhc3NMZWdhY3lXb3JrZXJJbXBsZW1lbnRhdGlvbigpXG4gICAgOiBuZXcgU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uKCk7XG5cbiAgZXh0cmFQbHVnaW5zLnB1c2goe1xuICAgIGFwcGx5KGNvbXBpbGVyKSB7XG4gICAgICBjb21waWxlci5ob29rcy5zaHV0ZG93bi50YXAoJ3Nhc3Mtd29ya2VyJywgKCkgPT4ge1xuICAgICAgICBzYXNzSW1wbGVtZW50YXRpb24uY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH0pO1xuXG4gIGNvbnN0IGFzc2V0TmFtZVRlbXBsYXRlID0gYXNzZXROYW1lVGVtcGxhdGVGYWN0b3J5KGhhc2hGb3JtYXQpO1xuXG4gIGNvbnN0IGV4dHJhUG9zdGNzc1BsdWdpbnM6IGltcG9ydCgncG9zdGNzcycpLlBsdWdpbltdID0gW107XG5cbiAgLy8gQXR0ZW1wdCB0byBzZXR1cCBUYWlsd2luZCBDU1NcbiAgLy8gT25seSBsb2FkIFRhaWx3aW5kIENTUyBwbHVnaW4gaWYgY29uZmlndXJhdGlvbiBmaWxlIHdhcyBmb3VuZC5cbiAgLy8gVGhpcyBhY3RzIGFzIGEgZ3VhcmQgdG8gZW5zdXJlIHRoZSBwcm9qZWN0IGFjdHVhbGx5IHdhbnRzIHRvIHVzZSBUYWlsd2luZCBDU1MuXG4gIC8vIFRoZSBwYWNrYWdlIG1heSBiZSB1bmtub3duaW5nbHkgcHJlc2VudCBkdWUgdG8gYSB0aGlyZC1wYXJ0eSB0cmFuc2l0aXZlIHBhY2thZ2UgZGVwZW5kZW5jeS5cbiAgY29uc3QgdGFpbHdpbmRDb25maWdQYXRoID0gZ2V0VGFpbHdpbmRDb25maWdQYXRoKHdjbyk7XG4gIGlmICh0YWlsd2luZENvbmZpZ1BhdGgpIHtcbiAgICBsZXQgdGFpbHdpbmRQYWNrYWdlUGF0aDtcbiAgICB0cnkge1xuICAgICAgdGFpbHdpbmRQYWNrYWdlUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgndGFpbHdpbmRjc3MnLCB7IHBhdGhzOiBbd2NvLnJvb3RdIH0pO1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29uc3QgcmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGggPSBwYXRoLnJlbGF0aXZlKHdjby5yb290LCB0YWlsd2luZENvbmZpZ1BhdGgpO1xuICAgICAgd2NvLmxvZ2dlci53YXJuKFxuICAgICAgICBgVGFpbHdpbmQgQ1NTIGNvbmZpZ3VyYXRpb24gZmlsZSBmb3VuZCAoJHtyZWxhdGl2ZVRhaWx3aW5kQ29uZmlnUGF0aH0pYCArXG4gICAgICAgICAgYCBidXQgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZSBpcyBub3QgaW5zdGFsbGVkLmAgK1xuICAgICAgICAgIGAgVG8gZW5hYmxlIFRhaWx3aW5kIENTUywgcGxlYXNlIGluc3RhbGwgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZS5gLFxuICAgICAgKTtcbiAgICB9XG4gICAgaWYgKHRhaWx3aW5kUGFja2FnZVBhdGgpIHtcbiAgICAgIGV4dHJhUG9zdGNzc1BsdWdpbnMucHVzaChyZXF1aXJlKHRhaWx3aW5kUGFja2FnZVBhdGgpKHsgY29uZmlnOiB0YWlsd2luZENvbmZpZ1BhdGggfSkpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHBvc3Rjc3NJbXBvcnRzID0gcmVxdWlyZSgncG9zdGNzcy1pbXBvcnQnKTtcbiAgY29uc3QgYXV0b3ByZWZpeGVyOiB0eXBlb2YgaW1wb3J0KCdhdXRvcHJlZml4ZXInKSA9IHJlcXVpcmUoJ2F1dG9wcmVmaXhlcicpO1xuXG4gIGNvbnN0IHBvc3Rjc3NPcHRpb25zQ3JlYXRvciA9IChpbmxpbmVTb3VyY2VtYXBzOiBib29sZWFuLCBleHRyYWN0ZWQ6IGJvb2xlYW4pID0+IHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGNvbnN0IG9wdGlvbkdlbmVyYXRvciA9IChsb2FkZXI6IGFueSkgPT4gKHtcbiAgICAgIG1hcDogaW5saW5lU291cmNlbWFwc1xuICAgICAgICA/IHtcbiAgICAgICAgICAgIGlubGluZTogdHJ1ZSxcbiAgICAgICAgICAgIGFubm90YXRpb246IGZhbHNlLFxuICAgICAgICAgIH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICBwbHVnaW5zOiBbXG4gICAgICAgIHBvc3Rjc3NJbXBvcnRzKHtcbiAgICAgICAgICBsb2FkOiAoZmlsZW5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICBsb2FkZXIuZnMucmVhZEZpbGUoZmlsZW5hbWUsIChlcnI6IEVycm9yLCBkYXRhOiBCdWZmZXIpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcblxuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShjb250ZW50KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgICAgUG9zdGNzc0NsaVJlc291cmNlcyh7XG4gICAgICAgICAgYmFzZUhyZWY6IGJ1aWxkT3B0aW9ucy5iYXNlSHJlZixcbiAgICAgICAgICBkZXBsb3lVcmw6IGJ1aWxkT3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgICAgICAgcmVzb3VyY2VzT3V0cHV0UGF0aDogYnVpbGRPcHRpb25zLnJlc291cmNlc091dHB1dFBhdGgsXG4gICAgICAgICAgbG9hZGVyLFxuICAgICAgICAgIGZpbGVuYW1lOiBhc3NldE5hbWVUZW1wbGF0ZSxcbiAgICAgICAgICBlbWl0RmlsZTogYnVpbGRPcHRpb25zLnBsYXRmb3JtICE9PSAnc2VydmVyJyxcbiAgICAgICAgICBleHRyYWN0ZWQsXG4gICAgICAgIH0pLFxuICAgICAgICAuLi5leHRyYVBvc3Rjc3NQbHVnaW5zLFxuICAgICAgICBhdXRvcHJlZml4ZXIoe1xuICAgICAgICAgIGlnbm9yZVVua25vd25WZXJzaW9uczogdHJ1ZSxcbiAgICAgICAgICBvdmVycmlkZUJyb3dzZXJzbGlzdDogYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgLy8gcG9zdGNzcy1sb2FkZXIgZmFpbHMgd2hlbiB0cnlpbmcgdG8gZGV0ZXJtaW5lIGNvbmZpZ3VyYXRpb24gZmlsZXMgZm9yIGRhdGEgVVJJc1xuICAgIG9wdGlvbkdlbmVyYXRvci5jb25maWcgPSBmYWxzZTtcblxuICAgIHJldHVybiBvcHRpb25HZW5lcmF0b3I7XG4gIH07XG5cbiAgLy8gbG9hZCBjb21wb25lbnQgY3NzIGFzIHJhdyBzdHJpbmdzXG4gIGNvbnN0IGNvbXBvbmVudHNTb3VyY2VNYXAgPSAhIShcbiAgICBjc3NTb3VyY2VNYXAgJiZcbiAgICAvLyBOZXZlciB1c2UgY29tcG9uZW50IGNzcyBzb3VyY2VtYXAgd2hlbiBzdHlsZSBvcHRpbWl6YXRpb25zIGFyZSBvbi5cbiAgICAvLyBJdCB3aWxsIGp1c3QgaW5jcmVhc2UgYnVuZGxlIHNpemUgd2l0aG91dCBvZmZlcmluZyBnb29kIGRlYnVnIGV4cGVyaWVuY2UuXG4gICAgIWJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24uc3R5bGVzLm1pbmlmeSAmJlxuICAgIC8vIElubGluZSBhbGwgc291cmNlbWFwIHR5cGVzIGV4Y2VwdCBoaWRkZW4gb25lcywgd2hpY2ggYXJlIHRoZSBzYW1lIGFzIG5vIHNvdXJjZW1hcHNcbiAgICAvLyBmb3IgY29tcG9uZW50IGNzcy5cbiAgICAhYnVpbGRPcHRpb25zLnNvdXJjZU1hcC5oaWRkZW5cbiAgKTtcblxuICAvLyBleHRyYWN0IGdsb2JhbCBjc3MgZnJvbSBqcyBmaWxlcyBpbnRvIG93biBjc3MgZmlsZS5cbiAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IE1pbmlDc3NFeHRyYWN0UGx1Z2luKHsgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuZXh0cmFjdH0uY3NzYCB9KSk7XG5cbiAgaWYgKCFidWlsZE9wdGlvbnMuaG1yKSB7XG4gICAgLy8gZG9uJ3QgcmVtb3ZlIGAuanNgIGZpbGVzIGZvciBgLmNzc2Agd2hlbiB3ZSBhcmUgdXNpbmcgSE1SIHRoZXNlIGNvbnRhaW4gSE1SIGFjY2VwdCBjb2Rlcy5cbiAgICAvLyBzdXBwcmVzcyBlbXB0eSAuanMgZmlsZXMgaW4gY3NzIG9ubHkgZW50cnkgcG9pbnRzLlxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBTdXBwcmVzc0V4dHJhY3RlZFRleHRDaHVua3NXZWJwYWNrUGx1Z2luKCkpO1xuICB9XG5cbiAgY29uc3QgcG9zdENzcyA9IHJlcXVpcmUoJ3Bvc3Rjc3MnKTtcbiAgY29uc3QgcG9zdENzc0xvYWRlclBhdGggPSByZXF1aXJlLnJlc29sdmUoJ3Bvc3Rjc3MtbG9hZGVyJyk7XG5cbiAgY29uc3QgY29tcG9uZW50U3R5bGVMb2FkZXJzOiBSdWxlU2V0VXNlSXRlbVtdID0gW1xuICAgIHtcbiAgICAgIGxvYWRlcjogcG9zdENzc0xvYWRlclBhdGgsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBwb3N0Q3NzLFxuICAgICAgICBwb3N0Y3NzT3B0aW9uczogcG9zdGNzc09wdGlvbnNDcmVhdG9yKGNvbXBvbmVudHNTb3VyY2VNYXAsIGZhbHNlKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgXTtcblxuICBjb25zdCBnbG9iYWxTdHlsZUxvYWRlcnM6IFJ1bGVTZXRVc2VJdGVtW10gPSBbXG4gICAge1xuICAgICAgbG9hZGVyOiBNaW5pQ3NzRXh0cmFjdFBsdWdpbi5sb2FkZXIsXG4gICAgfSxcbiAgICB7XG4gICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnY3NzLWxvYWRlcicpLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICB1cmw6IGZhbHNlLFxuICAgICAgICBzb3VyY2VNYXA6ICEhY3NzU291cmNlTWFwLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGxvYWRlcjogcG9zdENzc0xvYWRlclBhdGgsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBwb3N0Q3NzLFxuICAgICAgICBwb3N0Y3NzT3B0aW9uczogcG9zdGNzc09wdGlvbnNDcmVhdG9yKGZhbHNlLCB0cnVlKSxcbiAgICAgICAgc291cmNlTWFwOiAhIWNzc1NvdXJjZU1hcCxcbiAgICAgIH0sXG4gICAgfSxcbiAgXTtcblxuICBjb25zdCBzdHlsZUxhbmd1YWdlczoge1xuICAgIGV4dGVuc2lvbnM6IHN0cmluZ1tdO1xuICAgIHVzZTogUnVsZVNldFVzZUl0ZW1bXTtcbiAgfVtdID0gW1xuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnY3NzJ10sXG4gICAgICB1c2U6IFtdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydzY3NzJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdyZXNvbHZlLXVybC1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Nhc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczogZ2V0U2Fzc0xvYWRlck9wdGlvbnMoXG4gICAgICAgICAgICByb290LFxuICAgICAgICAgICAgc2Fzc0ltcGxlbWVudGF0aW9uLFxuICAgICAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICAhYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgICAhIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgICAgICksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydzYXNzJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdyZXNvbHZlLXVybC1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Nhc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczogZ2V0U2Fzc0xvYWRlck9wdGlvbnMoXG4gICAgICAgICAgICByb290LFxuICAgICAgICAgICAgc2Fzc0ltcGxlbWVudGF0aW9uLFxuICAgICAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICAgICFidWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgICAgICEhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICAgICAgKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ2xlc3MnXSxcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ2xlc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgaW1wbGVtZW50YXRpb246IHJlcXVpcmUoJ2xlc3MnKSxcbiAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgICAgbGVzc09wdGlvbnM6IHtcbiAgICAgICAgICAgICAgamF2YXNjcmlwdEVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgIHBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gIF07XG5cbiAgcmV0dXJuIHtcbiAgICBlbnRyeTogZW50cnlQb2ludHMsXG4gICAgbW9kdWxlOiB7XG4gICAgICBydWxlczogc3R5bGVMYW5ndWFnZXMubWFwKCh7IGV4dGVuc2lvbnMsIHVzZSB9KSA9PiAoe1xuICAgICAgICB0ZXN0OiBuZXcgUmVnRXhwKGBcXFxcLig/OiR7ZXh0ZW5zaW9ucy5qb2luKCd8Jyl9KSRgLCAnaScpLFxuICAgICAgICBydWxlczogW1xuICAgICAgICAgIC8vIFNldHVwIHByb2Nlc3NpbmcgcnVsZXMgZm9yIGdsb2JhbCBhbmQgY29tcG9uZW50IHN0eWxlc1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgICAgIC8vIEdsb2JhbCBzdHlsZXMgYXJlIG9ubHkgZGVmaW5lZCBnbG9iYWwgc3R5bGVzXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1c2U6IGdsb2JhbFN0eWxlTG9hZGVycyxcbiAgICAgICAgICAgICAgICBpbmNsdWRlOiBnbG9iYWxTdHlsZVBhdGhzLFxuICAgICAgICAgICAgICAgIHJlc291cmNlUXVlcnk6IHsgbm90OiBbL1xcP25nUmVzb3VyY2UvXSB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzIGFyZSBhbGwgc3R5bGVzIGV4Y2VwdCBkZWZpbmVkIGdsb2JhbCBzdHlsZXNcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVzZTogY29tcG9uZW50U3R5bGVMb2FkZXJzLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhc3NldC9zb3VyY2UnLFxuICAgICAgICAgICAgICAgIHJlc291cmNlUXVlcnk6IC9cXD9uZ1Jlc291cmNlLyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7IHVzZSB9LFxuICAgICAgICBdLFxuICAgICAgfSkpLFxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICBtaW5pbWl6ZXI6IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24uc3R5bGVzLm1pbmlmeVxuICAgICAgICA/IFtcbiAgICAgICAgICAgIG5ldyBDc3NPcHRpbWl6ZXJQbHVnaW4oe1xuICAgICAgICAgICAgICBzdXBwb3J0ZWRCcm93c2VyczogYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICB9LFxuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2lucyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0VGFpbHdpbmRDb25maWdQYXRoKHsgcHJvamVjdFJvb3QsIHJvb3QgfTogV2VicGFja0NvbmZpZ09wdGlvbnMpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAvLyBBIGNvbmZpZ3VyYXRpb24gZmlsZSBjYW4gZXhpc3QgaW4gdGhlIHByb2plY3Qgb3Igd29ya3NwYWNlIHJvb3RcbiAgLy8gVGhlIGxpc3Qgb2YgdmFsaWQgY29uZmlnIGZpbGVzIGNhbiBiZSBmb3VuZDpcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3RhaWx3aW5kbGFicy90YWlsd2luZGNzcy9ibG9iLzg4NDVkMTEyZmI2MmQ3OTgxNWI1MGIzYmFlODBjMzE3NDUwYjhiOTIvc3JjL3V0aWwvcmVzb2x2ZUNvbmZpZ1BhdGguanMjTDQ2LUw1MlxuICBjb25zdCB0YWlsd2luZENvbmZpZ0ZpbGVzID0gWyd0YWlsd2luZC5jb25maWcuanMnLCAndGFpbHdpbmQuY29uZmlnLmNqcyddO1xuICBmb3IgKGNvbnN0IGJhc2VQYXRoIG9mIFtwcm9qZWN0Um9vdCwgcm9vdF0pIHtcbiAgICBmb3IgKGNvbnN0IGNvbmZpZ0ZpbGUgb2YgdGFpbHdpbmRDb25maWdGaWxlcykge1xuICAgICAgLy8gSXJyZXNwZWN0aXZlIG9mIHRoZSBuYW1lIHByb2plY3QgbGV2ZWwgY29uZmlndXJhdGlvbiBzaG91bGQgYWx3YXlzIHRha2UgcHJlY2VkZW5jZS5cbiAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGJhc2VQYXRoLCBjb25maWdGaWxlKTtcbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKGZ1bGxQYXRoKSkge1xuICAgICAgICByZXR1cm4gZnVsbFBhdGg7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZ2V0U2Fzc0xvYWRlck9wdGlvbnMoXG4gIHJvb3Q6IHN0cmluZyxcbiAgaW1wbGVtZW50YXRpb246IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbiB8IFNhc3NMZWdhY3lXb3JrZXJJbXBsZW1lbnRhdGlvbixcbiAgaW5jbHVkZVBhdGhzOiBzdHJpbmdbXSxcbiAgaW5kZW50ZWRTeW50YXg6IGJvb2xlYW4sXG4gIHZlcmJvc2U6IGJvb2xlYW4sXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4sXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiBpbXBsZW1lbnRhdGlvbiBpbnN0YW5jZW9mIFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvblxuICAgID8ge1xuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgIGFwaTogJ21vZGVybicsXG4gICAgICAgIGltcGxlbWVudGF0aW9uLFxuICAgICAgICAvLyBXZWJwYWNrIGltcG9ydGVyIGlzIG9ubHkgaW1wbGVtZW50ZWQgaW4gdGhlIGxlZ2FjeSBBUEkgYW5kIHdlIGhhdmUgb3VyIG93biBjdXN0b20gV2VicGFjayBpbXBvcnRlci5cbiAgICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3Nhc3MtbG9hZGVyL2Jsb2IvOTk3ZjNlYjQxZDg2ZGQwMGQ1ZmE0OWMzOTVhMWFlYjQxNTczMTA4Yy9zcmMvdXRpbHMuanMjTDY0Mi1MNjUxXG4gICAgICAgIHdlYnBhY2tJbXBvcnRlcjogZmFsc2UsXG4gICAgICAgIHNhc3NPcHRpb25zOiAobG9hZGVyQ29udGV4dDogTG9hZGVyQ29udGV4dDx7fT4pID0+ICh7XG4gICAgICAgICAgaW1wb3J0ZXJzOiBbZ2V0U2Fzc1Jlc29sdXRpb25JbXBvcnRlcihsb2FkZXJDb250ZXh0LCByb290LCBwcmVzZXJ2ZVN5bWxpbmtzKV0sXG4gICAgICAgICAgbG9hZFBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgLy8gVXNlIGV4cGFuZGVkIGFzIG90aGVyd2lzZSBzYXNzIHdpbGwgcmVtb3ZlIGNvbW1lbnRzIHRoYXQgYXJlIG5lZWRlZCBmb3IgYXV0b3ByZWZpeGVyXG4gICAgICAgICAgLy8gRXg6IC8qIGF1dG9wcmVmaXhlciBncmlkOiBhdXRvcGxhY2UgKi9cbiAgICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc2Fzcy1sb2FkZXIvYmxvYi80NWFkMGJlMTcyNjRjZWFkYTVmMGI0ZmI4N2U5MzU3YWJlODVjNGZmL3NyYy9nZXRTYXNzT3B0aW9ucy5qcyNMNjgtTDcwXG4gICAgICAgICAgc3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICAgICAgLy8gU2lsZW5jZXMgY29tcGlsZXIgd2FybmluZ3MgZnJvbSAzcmQgcGFydHkgc3R5bGVzaGVldHNcbiAgICAgICAgICBxdWlldERlcHM6ICF2ZXJib3NlLFxuICAgICAgICAgIHZlcmJvc2UsXG4gICAgICAgICAgc3ludGF4OiBpbmRlbnRlZFN5bnRheCA/ICdpbmRlbnRlZCcgOiAnc2NzcycsXG4gICAgICAgIH0pLFxuICAgICAgfVxuICAgIDoge1xuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgIGFwaTogJ2xlZ2FjeScsXG4gICAgICAgIGltcGxlbWVudGF0aW9uLFxuICAgICAgICBzYXNzT3B0aW9uczoge1xuICAgICAgICAgIGltcG9ydGVyOiAodXJsOiBzdHJpbmcsIGZyb206IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgaWYgKHVybC5jaGFyQXQoMCkgPT09ICd+Jykge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYCcke2Zyb219JyBpbXBvcnRzICcke3VybH0nIHdpdGggYSB0aWxkZS4gVXNhZ2Ugb2YgJ34nIGluIGltcG9ydHMgaXMgbm8gbG9uZ2VyIHN1cHBvcnRlZC5gLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9LFxuICAgICAgICAgIC8vIFByZXZlbnQgdXNlIG9mIGBmaWJlcnNgIHBhY2thZ2UgYXMgaXQgbm8gbG9uZ2VyIHdvcmtzIGluIG5ld2VyIE5vZGUuanMgdmVyc2lvbnNcbiAgICAgICAgICBmaWJlcjogZmFsc2UsXG4gICAgICAgICAgaW5kZW50ZWRTeW50YXgsXG4gICAgICAgICAgLy8gYm9vdHN0cmFwLXNhc3MgcmVxdWlyZXMgYSBtaW5pbXVtIHByZWNpc2lvbiBvZiA4XG4gICAgICAgICAgcHJlY2lzaW9uOiA4LFxuICAgICAgICAgIGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAvLyBVc2UgZXhwYW5kZWQgYXMgb3RoZXJ3aXNlIHNhc3Mgd2lsbCByZW1vdmUgY29tbWVudHMgdGhhdCBhcmUgbmVlZGVkIGZvciBhdXRvcHJlZml4ZXJcbiAgICAgICAgICAvLyBFeDogLyogYXV0b3ByZWZpeGVyIGdyaWQ6IGF1dG9wbGFjZSAqL1xuICAgICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zYXNzLWxvYWRlci9ibG9iLzQ1YWQwYmUxNzI2NGNlYWRhNWYwYjRmYjg3ZTkzNTdhYmU4NWM0ZmYvc3JjL2dldFNhc3NPcHRpb25zLmpzI0w2OC1MNzBcbiAgICAgICAgICBvdXRwdXRTdHlsZTogJ2V4cGFuZGVkJyxcbiAgICAgICAgICAvLyBTaWxlbmNlcyBjb21waWxlciB3YXJuaW5ncyBmcm9tIDNyZCBwYXJ0eSBzdHlsZXNoZWV0c1xuICAgICAgICAgIHF1aWV0RGVwczogIXZlcmJvc2UsXG4gICAgICAgICAgdmVyYm9zZSxcbiAgICAgICAgfSxcbiAgICAgIH07XG59XG5cbmZ1bmN0aW9uIGdldFNhc3NSZXNvbHV0aW9uSW1wb3J0ZXIoXG4gIGxvYWRlckNvbnRleHQ6IExvYWRlckNvbnRleHQ8e30+LFxuICByb290OiBzdHJpbmcsXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4sXG4pOiBGaWxlSW1wb3J0ZXI8J2FzeW5jJz4ge1xuICBjb25zdCBjb21tb25SZXNvbHZlck9wdGlvbnM6IFBhcmFtZXRlcnM8dHlwZW9mIGxvYWRlckNvbnRleHRbJ2dldFJlc29sdmUnXT5bMF0gPSB7XG4gICAgY29uZGl0aW9uTmFtZXM6IFsnc2FzcycsICdzdHlsZSddLFxuICAgIG1haW5GaWVsZHM6IFsnc2FzcycsICdzdHlsZScsICdtYWluJywgJy4uLiddLFxuICAgIGV4dGVuc2lvbnM6IFsnLnNjc3MnLCAnLnNhc3MnLCAnLmNzcyddLFxuICAgIHJlc3RyaWN0aW9uczogWy9cXC4oKHNhfHNjfGMpc3MpJC9pXSxcbiAgICBwcmVmZXJSZWxhdGl2ZTogdHJ1ZSxcbiAgICBzeW1saW5rczogIXByZXNlcnZlU3ltbGlua3MsXG4gIH07XG5cbiAgLy8gU2FzcyBhbHNvIHN1cHBvcnRzIGltcG9ydC1vbmx5IGZpbGVzLiBJZiB5b3UgbmFtZSBhIGZpbGUgPG5hbWU+LmltcG9ydC5zY3NzLCBpdCB3aWxsIG9ubHkgYmUgbG9hZGVkIGZvciBpbXBvcnRzLCBub3QgZm9yIEB1c2VzLlxuICAvLyBTZWU6IGh0dHBzOi8vc2Fzcy1sYW5nLmNvbS9kb2N1bWVudGF0aW9uL2F0LXJ1bGVzL2ltcG9ydCNpbXBvcnQtb25seS1maWxlc1xuICBjb25zdCByZXNvbHZlSW1wb3J0ID0gbG9hZGVyQ29udGV4dC5nZXRSZXNvbHZlKHtcbiAgICAuLi5jb21tb25SZXNvbHZlck9wdGlvbnMsXG4gICAgZGVwZW5kZW5jeVR5cGU6ICdzYXNzLWltcG9ydCcsXG4gICAgbWFpbkZpbGVzOiBbJ19pbmRleC5pbXBvcnQnLCAnX2luZGV4JywgJ2luZGV4LmltcG9ydCcsICdpbmRleCcsICcuLi4nXSxcbiAgfSk7XG5cbiAgY29uc3QgcmVzb2x2ZU1vZHVsZSA9IGxvYWRlckNvbnRleHQuZ2V0UmVzb2x2ZSh7XG4gICAgLi4uY29tbW9uUmVzb2x2ZXJPcHRpb25zLFxuICAgIGRlcGVuZGVuY3lUeXBlOiAnc2Fzcy1tb2R1bGUnLFxuICAgIG1haW5GaWxlczogWydfaW5kZXgnLCAnaW5kZXgnLCAnLi4uJ10sXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgZmluZEZpbGVVcmw6ICh1cmwsIHsgZnJvbUltcG9ydCB9KTogUHJvbWlzZTxVUkwgfCBudWxsPiA9PiB7XG4gICAgICBjb25zdCByZXNvbHZlID0gZnJvbUltcG9ydCA/IHJlc29sdmVJbXBvcnQgOiByZXNvbHZlTW9kdWxlO1xuXG4gICAgICByZXR1cm4gcmVzb2x2ZShyb290LCB1cmwpXG4gICAgICAgIC50aGVuKChmaWxlKSA9PiBwYXRoVG9GaWxlVVJMKGZpbGUpKVxuICAgICAgICAuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==