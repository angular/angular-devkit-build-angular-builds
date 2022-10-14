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
const mini_css_extract_plugin_1 = __importDefault(require("mini-css-extract-plugin"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_url_1 = require("node:url");
const sass_service_1 = require("../../sass/sass-service");
const sass_service_legacy_1 = require("../../sass/sass-service-legacy");
const environment_options_1 = require("../../utils/environment-options");
const plugins_1 = require("../plugins");
const css_optimizer_plugin_1 = require("../plugins/css-optimizer-plugin");
const styles_webpack_plugin_1 = require("../plugins/styles-webpack-plugin");
const helpers_1 = require("../utils/helpers");
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
    if (buildOptions.styles.length > 0) {
        const { entryPoints, noInjectNames } = (0, helpers_1.normalizeGlobalStyles)(buildOptions.styles);
        extraPlugins.push(new styles_webpack_plugin_1.StylesWebpackPlugin({
            root,
            entryPoints,
            preserveSymlinks: buildOptions.preserveSymlinks,
        }));
        if (noInjectNames.length > 0) {
            // Add plugin to remove hashes from lazy styles.
            extraPlugins.push(new plugins_1.RemoveHashPlugin({ chunkNames: noInjectNames, hashFormat }));
        }
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
    const autoprefixer = require('autoprefixer');
    const postcssOptionsCreator = (inlineSourcemaps, extracted) => {
        const optionGenerator = (loader) => ({
            map: inlineSourcemaps
                ? {
                    inline: true,
                    annotation: false,
                }
                : undefined,
            plugins: [
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
            loader: require.resolve('css-loader'),
            options: {
                url: false,
                sourceMap: componentsSourceMap,
                importLoaders: 1,
                exportType: 'string',
                esModule: false,
            },
        },
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
                importLoaders: 1,
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
                                resourceQuery: /\?ngGlobalStyle/,
                            },
                            // Component styles are all styles except defined global styles
                            {
                                use: componentStyleLoaders,
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
        findFileUrl: async (url, { fromImport, previousResolvedModules }) => {
            if (url.charAt(0) === '.') {
                // Let Sass handle relative imports.
                return null;
            }
            const resolve = fromImport ? resolveImport : resolveModule;
            // Try to resolve from root of workspace
            let result = await tryResolve(resolve, root, url);
            // Try to resolve from previously resolved modules.
            if (!result && previousResolvedModules) {
                for (const path of previousResolvedModules) {
                    result = await tryResolve(resolve, path, url);
                    if (result) {
                        break;
                    }
                }
            }
            return result ? (0, node_url_1.pathToFileURL)(result) : null;
        },
    };
}
async function tryResolve(resolve, root, url) {
    try {
        return await resolve(root, url);
    }
    catch (_a) {
        // Try to resolve a partial file
        // @use '@material/button/button' as mdc-button;
        // `@material/button/button` -> `@material/button/_button`
        const lastSlashIndex = url.lastIndexOf('/');
        const underscoreIndex = lastSlashIndex + 1;
        if (underscoreIndex > 0 && url.charAt(underscoreIndex) !== '_') {
            const partialFileUrl = `${url.slice(0, underscoreIndex)}_${url.slice(underscoreIndex)}`;
            return resolve(root, partialFileUrl).catch(() => undefined);
        }
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHNGQUEyRDtBQUMzRCw0Q0FBOEI7QUFDOUIsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUd6QywwREFHaUM7QUFDakMsd0VBQWdGO0FBRWhGLHlFQUFnRTtBQUNoRSx3Q0FLb0I7QUFDcEIsMEVBQXFFO0FBQ3JFLDRFQUF1RTtBQUN2RSw4Q0FJMEI7QUFFMUIsa0RBQWtEO0FBQ2xELFNBQWdCLGVBQWUsQ0FBQyxHQUF5Qjs7SUFDdkQsTUFBTSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFDbkMsTUFBTSxZQUFZLEdBQTZCLEVBQUUsQ0FBQztJQUVsRCxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksd0NBQThCLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFFNUUsTUFBTSxZQUFZLEdBQUcsWUFBWSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7SUFFbkQsNEJBQTRCO0lBQzVCLE1BQU0sVUFBVSxHQUFHLElBQUEsNkJBQW1CLEVBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBRW5FLGtDQUFrQztJQUNsQyxNQUFNLFlBQVksR0FDaEIsTUFBQSxNQUFBLE1BQUEsWUFBWSxDQUFDLHdCQUF3QiwwQ0FBRSxZQUFZLDBDQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsbUNBQUksRUFBRSxDQUFDO0lBRS9GLHlCQUF5QjtJQUN6QixJQUFJLFlBQVks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QUEwRDtRQUMxRCxNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzVDLE1BQU0sZUFBZSxHQUFHLGNBQWMsR0FBRyxDQUFDLENBQUM7UUFDM0MsSUFBSSxlQUFlLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLEtBQUssR0FBRyxFQUFFO1lBQzlELE1BQU0sY0FBYyxHQUFHLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsZUFBZSxDQUFDLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDO1lBRXhGLE9BQU8sT0FBTyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDN0Q7S0FDRjtJQUVELE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IE1pbmlDc3NFeHRyYWN0UGx1Z2luIGZyb20gJ21pbmktY3NzLWV4dHJhY3QtcGx1Z2luJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0eXBlIHsgRmlsZUltcG9ydGVyIH0gZnJvbSAnc2Fzcyc7XG5pbXBvcnQgdHlwZSB7IENvbmZpZ3VyYXRpb24sIExvYWRlckNvbnRleHQsIFJ1bGVTZXRVc2VJdGVtIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQge1xuICBGaWxlSW1wb3J0ZXJXaXRoUmVxdWVzdENvbnRleHRPcHRpb25zLFxuICBTYXNzV29ya2VySW1wbGVtZW50YXRpb24sXG59IGZyb20gJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlJztcbmltcG9ydCB7IFNhc3NMZWdhY3lXb3JrZXJJbXBsZW1lbnRhdGlvbiB9IGZyb20gJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlLWxlZ2FjeSc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgdXNlTGVnYWN5U2FzcyB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHtcbiAgQW55Q29tcG9uZW50U3R5bGVCdWRnZXRDaGVja2VyLFxuICBQb3N0Y3NzQ2xpUmVzb3VyY2VzLFxuICBSZW1vdmVIYXNoUGx1Z2luLFxuICBTdXBwcmVzc0V4dHJhY3RlZFRleHRDaHVua3NXZWJwYWNrUGx1Z2luLFxufSBmcm9tICcuLi9wbHVnaW5zJztcbmltcG9ydCB7IENzc09wdGltaXplclBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvY3NzLW9wdGltaXplci1wbHVnaW4nO1xuaW1wb3J0IHsgU3R5bGVzV2VicGFja1BsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvc3R5bGVzLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7XG4gIGFzc2V0TmFtZVRlbXBsYXRlRmFjdG9yeSxcbiAgZ2V0T3V0cHV0SGFzaEZvcm1hdCxcbiAgbm9ybWFsaXplR2xvYmFsU3R5bGVzLFxufSBmcm9tICcuLi91dGlscy9oZWxwZXJzJztcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBnZXRTdHlsZXNDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IENvbmZpZ3VyYXRpb24ge1xuICBjb25zdCB7IHJvb3QsIGJ1aWxkT3B0aW9ucyB9ID0gd2NvO1xuICBjb25zdCBleHRyYVBsdWdpbnM6IENvbmZpZ3VyYXRpb25bJ3BsdWdpbnMnXSA9IFtdO1xuXG4gIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBBbnlDb21wb25lbnRTdHlsZUJ1ZGdldENoZWNrZXIoYnVpbGRPcHRpb25zLmJ1ZGdldHMpKTtcblxuICBjb25zdCBjc3NTb3VyY2VNYXAgPSBidWlsZE9wdGlvbnMuc291cmNlTWFwLnN0eWxlcztcblxuICAvLyBEZXRlcm1pbmUgaGFzaGluZyBmb3JtYXQuXG4gIGNvbnN0IGhhc2hGb3JtYXQgPSBnZXRPdXRwdXRIYXNoRm9ybWF0KGJ1aWxkT3B0aW9ucy5vdXRwdXRIYXNoaW5nKTtcblxuICAvLyB1c2UgaW5jbHVkZVBhdGhzIGZyb20gYXBwQ29uZmlnXG4gIGNvbnN0IGluY2x1ZGVQYXRocyA9XG4gICAgYnVpbGRPcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucz8uaW5jbHVkZVBhdGhzPy5tYXAoKHApID0+IHBhdGgucmVzb2x2ZShyb290LCBwKSkgPz8gW107XG5cbiAgLy8gUHJvY2VzcyBnbG9iYWwgc3R5bGVzLlxuICBpZiAoYnVpbGRPcHRpb25zLnN0eWxlcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgeyBlbnRyeVBvaW50cywgbm9JbmplY3ROYW1lcyB9ID0gbm9ybWFsaXplR2xvYmFsU3R5bGVzKGJ1aWxkT3B0aW9ucy5zdHlsZXMpO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IFN0eWxlc1dlYnBhY2tQbHVnaW4oe1xuICAgICAgICByb290LFxuICAgICAgICBlbnRyeVBvaW50cyxcbiAgICAgICAgcHJlc2VydmVTeW1saW5rczogYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgaWYgKG5vSW5qZWN0TmFtZXMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gQWRkIHBsdWdpbiB0byByZW1vdmUgaGFzaGVzIGZyb20gbGF6eSBzdHlsZXMuXG4gICAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgUmVtb3ZlSGFzaFBsdWdpbih7IGNodW5rTmFtZXM6IG5vSW5qZWN0TmFtZXMsIGhhc2hGb3JtYXQgfSkpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHNhc3NJbXBsZW1lbnRhdGlvbiA9IHVzZUxlZ2FjeVNhc3NcbiAgICA/IG5ldyBTYXNzTGVnYWN5V29ya2VySW1wbGVtZW50YXRpb24oKVxuICAgIDogbmV3IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbigpO1xuXG4gIGV4dHJhUGx1Z2lucy5wdXNoKHtcbiAgICBhcHBseShjb21waWxlcikge1xuICAgICAgY29tcGlsZXIuaG9va3Muc2h1dGRvd24udGFwKCdzYXNzLXdvcmtlcicsICgpID0+IHtcbiAgICAgICAgc2Fzc0ltcGxlbWVudGF0aW9uLmNsb3NlKCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9KTtcblxuICBjb25zdCBhc3NldE5hbWVUZW1wbGF0ZSA9IGFzc2V0TmFtZVRlbXBsYXRlRmFjdG9yeShoYXNoRm9ybWF0KTtcblxuICBjb25zdCBleHRyYVBvc3Rjc3NQbHVnaW5zOiBpbXBvcnQoJ3Bvc3Rjc3MnKS5QbHVnaW5bXSA9IFtdO1xuXG4gIC8vIEF0dGVtcHQgdG8gc2V0dXAgVGFpbHdpbmQgQ1NTXG4gIC8vIE9ubHkgbG9hZCBUYWlsd2luZCBDU1MgcGx1Z2luIGlmIGNvbmZpZ3VyYXRpb24gZmlsZSB3YXMgZm91bmQuXG4gIC8vIFRoaXMgYWN0cyBhcyBhIGd1YXJkIHRvIGVuc3VyZSB0aGUgcHJvamVjdCBhY3R1YWxseSB3YW50cyB0byB1c2UgVGFpbHdpbmQgQ1NTLlxuICAvLyBUaGUgcGFja2FnZSBtYXkgYmUgdW5rbm93bmluZ2x5IHByZXNlbnQgZHVlIHRvIGEgdGhpcmQtcGFydHkgdHJhbnNpdGl2ZSBwYWNrYWdlIGRlcGVuZGVuY3kuXG4gIGNvbnN0IHRhaWx3aW5kQ29uZmlnUGF0aCA9IGdldFRhaWx3aW5kQ29uZmlnUGF0aCh3Y28pO1xuICBpZiAodGFpbHdpbmRDb25maWdQYXRoKSB7XG4gICAgbGV0IHRhaWx3aW5kUGFja2FnZVBhdGg7XG4gICAgdHJ5IHtcbiAgICAgIHRhaWx3aW5kUGFja2FnZVBhdGggPSByZXF1aXJlLnJlc29sdmUoJ3RhaWx3aW5kY3NzJywgeyBwYXRoczogW3djby5yb290XSB9KTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGNvbnN0IHJlbGF0aXZlVGFpbHdpbmRDb25maWdQYXRoID0gcGF0aC5yZWxhdGl2ZSh3Y28ucm9vdCwgdGFpbHdpbmRDb25maWdQYXRoKTtcbiAgICAgIHdjby5sb2dnZXIud2FybihcbiAgICAgICAgYFRhaWx3aW5kIENTUyBjb25maWd1cmF0aW9uIGZpbGUgZm91bmQgKCR7cmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGh9KWAgK1xuICAgICAgICAgIGAgYnV0IHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UgaXMgbm90IGluc3RhbGxlZC5gICtcbiAgICAgICAgICBgIFRvIGVuYWJsZSBUYWlsd2luZCBDU1MsIHBsZWFzZSBpbnN0YWxsIHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UuYCxcbiAgICAgICk7XG4gICAgfVxuICAgIGlmICh0YWlsd2luZFBhY2thZ2VQYXRoKSB7XG4gICAgICBleHRyYVBvc3Rjc3NQbHVnaW5zLnB1c2gocmVxdWlyZSh0YWlsd2luZFBhY2thZ2VQYXRoKSh7IGNvbmZpZzogdGFpbHdpbmRDb25maWdQYXRoIH0pKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBhdXRvcHJlZml4ZXI6IHR5cGVvZiBpbXBvcnQoJ2F1dG9wcmVmaXhlcicpID0gcmVxdWlyZSgnYXV0b3ByZWZpeGVyJyk7XG5cbiAgY29uc3QgcG9zdGNzc09wdGlvbnNDcmVhdG9yID0gKGlubGluZVNvdXJjZW1hcHM6IGJvb2xlYW4sIGV4dHJhY3RlZDogYm9vbGVhbikgPT4ge1xuICAgIGNvbnN0IG9wdGlvbkdlbmVyYXRvciA9IChsb2FkZXI6IExvYWRlckNvbnRleHQ8dW5rbm93bj4pID0+ICh7XG4gICAgICBtYXA6IGlubGluZVNvdXJjZW1hcHNcbiAgICAgICAgPyB7XG4gICAgICAgICAgICBpbmxpbmU6IHRydWUsXG4gICAgICAgICAgICBhbm5vdGF0aW9uOiBmYWxzZSxcbiAgICAgICAgICB9XG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgcGx1Z2luczogW1xuICAgICAgICBQb3N0Y3NzQ2xpUmVzb3VyY2VzKHtcbiAgICAgICAgICBiYXNlSHJlZjogYnVpbGRPcHRpb25zLmJhc2VIcmVmLFxuICAgICAgICAgIGRlcGxveVVybDogYnVpbGRPcHRpb25zLmRlcGxveVVybCxcbiAgICAgICAgICByZXNvdXJjZXNPdXRwdXRQYXRoOiBidWlsZE9wdGlvbnMucmVzb3VyY2VzT3V0cHV0UGF0aCxcbiAgICAgICAgICBsb2FkZXIsXG4gICAgICAgICAgZmlsZW5hbWU6IGFzc2V0TmFtZVRlbXBsYXRlLFxuICAgICAgICAgIGVtaXRGaWxlOiBidWlsZE9wdGlvbnMucGxhdGZvcm0gIT09ICdzZXJ2ZXInLFxuICAgICAgICAgIGV4dHJhY3RlZCxcbiAgICAgICAgfSksXG4gICAgICAgIC4uLmV4dHJhUG9zdGNzc1BsdWdpbnMsXG4gICAgICAgIGF1dG9wcmVmaXhlcih7XG4gICAgICAgICAgaWdub3JlVW5rbm93blZlcnNpb25zOiB0cnVlLFxuICAgICAgICAgIG92ZXJyaWRlQnJvd3NlcnNsaXN0OiBidWlsZE9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcbiAgICAvLyBwb3N0Y3NzLWxvYWRlciBmYWlscyB3aGVuIHRyeWluZyB0byBkZXRlcm1pbmUgY29uZmlndXJhdGlvbiBmaWxlcyBmb3IgZGF0YSBVUklzXG4gICAgb3B0aW9uR2VuZXJhdG9yLmNvbmZpZyA9IGZhbHNlO1xuXG4gICAgcmV0dXJuIG9wdGlvbkdlbmVyYXRvcjtcbiAgfTtcblxuICAvLyBsb2FkIGNvbXBvbmVudCBjc3MgYXMgcmF3IHN0cmluZ3NcbiAgY29uc3QgY29tcG9uZW50c1NvdXJjZU1hcCA9ICEhKFxuICAgIGNzc1NvdXJjZU1hcCAmJlxuICAgIC8vIE5ldmVyIHVzZSBjb21wb25lbnQgY3NzIHNvdXJjZW1hcCB3aGVuIHN0eWxlIG9wdGltaXphdGlvbnMgYXJlIG9uLlxuICAgIC8vIEl0IHdpbGwganVzdCBpbmNyZWFzZSBidW5kbGUgc2l6ZSB3aXRob3V0IG9mZmVyaW5nIGdvb2QgZGVidWcgZXhwZXJpZW5jZS5cbiAgICAhYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbi5zdHlsZXMubWluaWZ5ICYmXG4gICAgLy8gSW5saW5lIGFsbCBzb3VyY2VtYXAgdHlwZXMgZXhjZXB0IGhpZGRlbiBvbmVzLCB3aGljaCBhcmUgdGhlIHNhbWUgYXMgbm8gc291cmNlbWFwc1xuICAgIC8vIGZvciBjb21wb25lbnQgY3NzLlxuICAgICFidWlsZE9wdGlvbnMuc291cmNlTWFwLmhpZGRlblxuICApO1xuXG4gIC8vIGV4dHJhY3QgZ2xvYmFsIGNzcyBmcm9tIGpzIGZpbGVzIGludG8gb3duIGNzcyBmaWxlLlxuICBleHRyYVBsdWdpbnMucHVzaChuZXcgTWluaUNzc0V4dHJhY3RQbHVnaW4oeyBmaWxlbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5leHRyYWN0fS5jc3NgIH0pKTtcblxuICBpZiAoIWJ1aWxkT3B0aW9ucy5obXIpIHtcbiAgICAvLyBkb24ndCByZW1vdmUgYC5qc2AgZmlsZXMgZm9yIGAuY3NzYCB3aGVuIHdlIGFyZSB1c2luZyBITVIgdGhlc2UgY29udGFpbiBITVIgYWNjZXB0IGNvZGVzLlxuICAgIC8vIHN1cHByZXNzIGVtcHR5IC5qcyBmaWxlcyBpbiBjc3Mgb25seSBlbnRyeSBwb2ludHMuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4oKSk7XG4gIH1cblxuICBjb25zdCBwb3N0Q3NzID0gcmVxdWlyZSgncG9zdGNzcycpO1xuICBjb25zdCBwb3N0Q3NzTG9hZGVyUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgncG9zdGNzcy1sb2FkZXInKTtcblxuICBjb25zdCBjb21wb25lbnRTdHlsZUxvYWRlcnM6IFJ1bGVTZXRVc2VJdGVtW10gPSBbXG4gICAge1xuICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ2Nzcy1sb2FkZXInKSxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgdXJsOiBmYWxzZSxcbiAgICAgICAgc291cmNlTWFwOiBjb21wb25lbnRzU291cmNlTWFwLFxuICAgICAgICBpbXBvcnRMb2FkZXJzOiAxLFxuICAgICAgICBleHBvcnRUeXBlOiAnc3RyaW5nJyxcbiAgICAgICAgZXNNb2R1bGU6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGxvYWRlcjogcG9zdENzc0xvYWRlclBhdGgsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBwb3N0Q3NzLFxuICAgICAgICBwb3N0Y3NzT3B0aW9uczogcG9zdGNzc09wdGlvbnNDcmVhdG9yKGNvbXBvbmVudHNTb3VyY2VNYXAsIGZhbHNlKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgXTtcblxuICBjb25zdCBnbG9iYWxTdHlsZUxvYWRlcnM6IFJ1bGVTZXRVc2VJdGVtW10gPSBbXG4gICAge1xuICAgICAgbG9hZGVyOiBNaW5pQ3NzRXh0cmFjdFBsdWdpbi5sb2FkZXIsXG4gICAgfSxcbiAgICB7XG4gICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnY3NzLWxvYWRlcicpLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICB1cmw6IGZhbHNlLFxuICAgICAgICBzb3VyY2VNYXA6ICEhY3NzU291cmNlTWFwLFxuICAgICAgICBpbXBvcnRMb2FkZXJzOiAxLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGxvYWRlcjogcG9zdENzc0xvYWRlclBhdGgsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBwb3N0Q3NzLFxuICAgICAgICBwb3N0Y3NzT3B0aW9uczogcG9zdGNzc09wdGlvbnNDcmVhdG9yKGZhbHNlLCB0cnVlKSxcbiAgICAgICAgc291cmNlTWFwOiAhIWNzc1NvdXJjZU1hcCxcbiAgICAgIH0sXG4gICAgfSxcbiAgXTtcblxuICBjb25zdCBzdHlsZUxhbmd1YWdlczoge1xuICAgIGV4dGVuc2lvbnM6IHN0cmluZ1tdO1xuICAgIHVzZTogUnVsZVNldFVzZUl0ZW1bXTtcbiAgfVtdID0gW1xuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnY3NzJ10sXG4gICAgICB1c2U6IFtdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydzY3NzJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdyZXNvbHZlLXVybC1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Nhc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczogZ2V0U2Fzc0xvYWRlck9wdGlvbnMoXG4gICAgICAgICAgICByb290LFxuICAgICAgICAgICAgc2Fzc0ltcGxlbWVudGF0aW9uLFxuICAgICAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICAhYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgICAhIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgICAgICksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydzYXNzJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdyZXNvbHZlLXVybC1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Nhc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczogZ2V0U2Fzc0xvYWRlck9wdGlvbnMoXG4gICAgICAgICAgICByb290LFxuICAgICAgICAgICAgc2Fzc0ltcGxlbWVudGF0aW9uLFxuICAgICAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICAgICFidWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgICAgICEhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICAgICAgKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ2xlc3MnXSxcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ2xlc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgaW1wbGVtZW50YXRpb246IHJlcXVpcmUoJ2xlc3MnKSxcbiAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgICAgbGVzc09wdGlvbnM6IHtcbiAgICAgICAgICAgICAgamF2YXNjcmlwdEVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgIHBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gIF07XG5cbiAgcmV0dXJuIHtcbiAgICBtb2R1bGU6IHtcbiAgICAgIHJ1bGVzOiBzdHlsZUxhbmd1YWdlcy5tYXAoKHsgZXh0ZW5zaW9ucywgdXNlIH0pID0+ICh7XG4gICAgICAgIHRlc3Q6IG5ldyBSZWdFeHAoYFxcXFwuKD86JHtleHRlbnNpb25zLmpvaW4oJ3wnKX0pJGAsICdpJyksXG4gICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAgLy8gU2V0dXAgcHJvY2Vzc2luZyBydWxlcyBmb3IgZ2xvYmFsIGFuZCBjb21wb25lbnQgc3R5bGVzXG4gICAgICAgICAge1xuICAgICAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICAgICAgLy8gR2xvYmFsIHN0eWxlcyBhcmUgb25seSBkZWZpbmVkIGdsb2JhbCBzdHlsZXNcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVzZTogZ2xvYmFsU3R5bGVMb2FkZXJzLFxuICAgICAgICAgICAgICAgIHJlc291cmNlUXVlcnk6IC9cXD9uZ0dsb2JhbFN0eWxlLyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgLy8gQ29tcG9uZW50IHN0eWxlcyBhcmUgYWxsIHN0eWxlcyBleGNlcHQgZGVmaW5lZCBnbG9iYWwgc3R5bGVzXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1c2U6IGNvbXBvbmVudFN0eWxlTG9hZGVycyxcbiAgICAgICAgICAgICAgICByZXNvdXJjZVF1ZXJ5OiAvXFw/bmdSZXNvdXJjZS8sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgeyB1c2UgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pKSxcbiAgICB9LFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgbWluaW1pemVyOiBidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uLnN0eWxlcy5taW5pZnlcbiAgICAgICAgPyBbXG4gICAgICAgICAgICBuZXcgQ3NzT3B0aW1pemVyUGx1Z2luKHtcbiAgICAgICAgICAgICAgc3VwcG9ydGVkQnJvd3NlcnM6IGJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2VycyxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgfSxcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGdldFRhaWx3aW5kQ29uZmlnUGF0aCh7IHByb2plY3RSb290LCByb290IH06IFdlYnBhY2tDb25maWdPcHRpb25zKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgLy8gQSBjb25maWd1cmF0aW9uIGZpbGUgY2FuIGV4aXN0IGluIHRoZSBwcm9qZWN0IG9yIHdvcmtzcGFjZSByb290XG4gIC8vIFRoZSBsaXN0IG9mIHZhbGlkIGNvbmZpZyBmaWxlcyBjYW4gYmUgZm91bmQ6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS90YWlsd2luZGxhYnMvdGFpbHdpbmRjc3MvYmxvYi84ODQ1ZDExMmZiNjJkNzk4MTViNTBiM2JhZTgwYzMxNzQ1MGI4YjkyL3NyYy91dGlsL3Jlc29sdmVDb25maWdQYXRoLmpzI0w0Ni1MNTJcbiAgY29uc3QgdGFpbHdpbmRDb25maWdGaWxlcyA9IFsndGFpbHdpbmQuY29uZmlnLmpzJywgJ3RhaWx3aW5kLmNvbmZpZy5janMnXTtcbiAgZm9yIChjb25zdCBiYXNlUGF0aCBvZiBbcHJvamVjdFJvb3QsIHJvb3RdKSB7XG4gICAgZm9yIChjb25zdCBjb25maWdGaWxlIG9mIHRhaWx3aW5kQ29uZmlnRmlsZXMpIHtcbiAgICAgIC8vIElycmVzcGVjdGl2ZSBvZiB0aGUgbmFtZSBwcm9qZWN0IGxldmVsIGNvbmZpZ3VyYXRpb24gc2hvdWxkIGFsd2F5cyB0YWtlIHByZWNlZGVuY2UuXG4gICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihiYXNlUGF0aCwgY29uZmlnRmlsZSk7XG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhmdWxsUGF0aCkpIHtcbiAgICAgICAgcmV0dXJuIGZ1bGxQYXRoO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGdldFNhc3NMb2FkZXJPcHRpb25zKFxuICByb290OiBzdHJpbmcsXG4gIGltcGxlbWVudGF0aW9uOiBTYXNzV29ya2VySW1wbGVtZW50YXRpb24gfCBTYXNzTGVnYWN5V29ya2VySW1wbGVtZW50YXRpb24sXG4gIGluY2x1ZGVQYXRoczogc3RyaW5nW10sXG4gIGluZGVudGVkU3ludGF4OiBib29sZWFuLFxuICB2ZXJib3NlOiBib29sZWFuLFxuICBwcmVzZXJ2ZVN5bWxpbmtzOiBib29sZWFuLFxuKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4gaW1wbGVtZW50YXRpb24gaW5zdGFuY2VvZiBTYXNzV29ya2VySW1wbGVtZW50YXRpb25cbiAgICA/IHtcbiAgICAgICAgc291cmNlTWFwOiB0cnVlLFxuICAgICAgICBhcGk6ICdtb2Rlcm4nLFxuICAgICAgICBpbXBsZW1lbnRhdGlvbixcbiAgICAgICAgLy8gV2VicGFjayBpbXBvcnRlciBpcyBvbmx5IGltcGxlbWVudGVkIGluIHRoZSBsZWdhY3kgQVBJIGFuZCB3ZSBoYXZlIG91ciBvd24gY3VzdG9tIFdlYnBhY2sgaW1wb3J0ZXIuXG4gICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zYXNzLWxvYWRlci9ibG9iLzk5N2YzZWI0MWQ4NmRkMDBkNWZhNDljMzk1YTFhZWI0MTU3MzEwOGMvc3JjL3V0aWxzLmpzI0w2NDItTDY1MVxuICAgICAgICB3ZWJwYWNrSW1wb3J0ZXI6IGZhbHNlLFxuICAgICAgICBzYXNzT3B0aW9uczogKGxvYWRlckNvbnRleHQ6IExvYWRlckNvbnRleHQ8e30+KSA9PiAoe1xuICAgICAgICAgIGltcG9ydGVyczogW2dldFNhc3NSZXNvbHV0aW9uSW1wb3J0ZXIobG9hZGVyQ29udGV4dCwgcm9vdCwgcHJlc2VydmVTeW1saW5rcyldLFxuICAgICAgICAgIGxvYWRQYXRoczogaW5jbHVkZVBhdGhzLFxuICAgICAgICAgIC8vIFVzZSBleHBhbmRlZCBhcyBvdGhlcndpc2Ugc2FzcyB3aWxsIHJlbW92ZSBjb21tZW50cyB0aGF0IGFyZSBuZWVkZWQgZm9yIGF1dG9wcmVmaXhlclxuICAgICAgICAgIC8vIEV4OiAvKiBhdXRvcHJlZml4ZXIgZ3JpZDogYXV0b3BsYWNlICovXG4gICAgICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3Nhc3MtbG9hZGVyL2Jsb2IvNDVhZDBiZTE3MjY0Y2VhZGE1ZjBiNGZiODdlOTM1N2FiZTg1YzRmZi9zcmMvZ2V0U2Fzc09wdGlvbnMuanMjTDY4LUw3MFxuICAgICAgICAgIHN0eWxlOiAnZXhwYW5kZWQnLFxuICAgICAgICAgIC8vIFNpbGVuY2VzIGNvbXBpbGVyIHdhcm5pbmdzIGZyb20gM3JkIHBhcnR5IHN0eWxlc2hlZXRzXG4gICAgICAgICAgcXVpZXREZXBzOiAhdmVyYm9zZSxcbiAgICAgICAgICB2ZXJib3NlLFxuICAgICAgICAgIHN5bnRheDogaW5kZW50ZWRTeW50YXggPyAnaW5kZW50ZWQnIDogJ3Njc3MnLFxuICAgICAgICB9KSxcbiAgICAgIH1cbiAgICA6IHtcbiAgICAgICAgc291cmNlTWFwOiB0cnVlLFxuICAgICAgICBhcGk6ICdsZWdhY3knLFxuICAgICAgICBpbXBsZW1lbnRhdGlvbixcbiAgICAgICAgc2Fzc09wdGlvbnM6IHtcbiAgICAgICAgICBpbXBvcnRlcjogKHVybDogc3RyaW5nLCBmcm9tOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIGlmICh1cmwuY2hhckF0KDApID09PSAnficpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgIGAnJHtmcm9tfScgaW1wb3J0cyAnJHt1cmx9JyB3aXRoIGEgdGlsZGUuIFVzYWdlIG9mICd+JyBpbiBpbXBvcnRzIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQuYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfSxcbiAgICAgICAgICAvLyBQcmV2ZW50IHVzZSBvZiBgZmliZXJzYCBwYWNrYWdlIGFzIGl0IG5vIGxvbmdlciB3b3JrcyBpbiBuZXdlciBOb2RlLmpzIHZlcnNpb25zXG4gICAgICAgICAgZmliZXI6IGZhbHNlLFxuICAgICAgICAgIGluZGVudGVkU3ludGF4LFxuICAgICAgICAgIC8vIGJvb3RzdHJhcC1zYXNzIHJlcXVpcmVzIGEgbWluaW11bSBwcmVjaXNpb24gb2YgOFxuICAgICAgICAgIHByZWNpc2lvbjogOCxcbiAgICAgICAgICBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgLy8gVXNlIGV4cGFuZGVkIGFzIG90aGVyd2lzZSBzYXNzIHdpbGwgcmVtb3ZlIGNvbW1lbnRzIHRoYXQgYXJlIG5lZWRlZCBmb3IgYXV0b3ByZWZpeGVyXG4gICAgICAgICAgLy8gRXg6IC8qIGF1dG9wcmVmaXhlciBncmlkOiBhdXRvcGxhY2UgKi9cbiAgICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc2Fzcy1sb2FkZXIvYmxvYi80NWFkMGJlMTcyNjRjZWFkYTVmMGI0ZmI4N2U5MzU3YWJlODVjNGZmL3NyYy9nZXRTYXNzT3B0aW9ucy5qcyNMNjgtTDcwXG4gICAgICAgICAgb3V0cHV0U3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICAgICAgLy8gU2lsZW5jZXMgY29tcGlsZXIgd2FybmluZ3MgZnJvbSAzcmQgcGFydHkgc3R5bGVzaGVldHNcbiAgICAgICAgICBxdWlldERlcHM6ICF2ZXJib3NlLFxuICAgICAgICAgIHZlcmJvc2UsXG4gICAgICAgIH0sXG4gICAgICB9O1xufVxuXG5mdW5jdGlvbiBnZXRTYXNzUmVzb2x1dGlvbkltcG9ydGVyKFxuICBsb2FkZXJDb250ZXh0OiBMb2FkZXJDb250ZXh0PHt9PixcbiAgcm9vdDogc3RyaW5nLFxuICBwcmVzZXJ2ZVN5bWxpbmtzOiBib29sZWFuLFxuKTogRmlsZUltcG9ydGVyPCdhc3luYyc+IHtcbiAgY29uc3QgY29tbW9uUmVzb2x2ZXJPcHRpb25zOiBQYXJhbWV0ZXJzPHR5cGVvZiBsb2FkZXJDb250ZXh0WydnZXRSZXNvbHZlJ10+WzBdID0ge1xuICAgIGNvbmRpdGlvbk5hbWVzOiBbJ3Nhc3MnLCAnc3R5bGUnXSxcbiAgICBtYWluRmllbGRzOiBbJ3Nhc3MnLCAnc3R5bGUnLCAnbWFpbicsICcuLi4nXSxcbiAgICBleHRlbnNpb25zOiBbJy5zY3NzJywgJy5zYXNzJywgJy5jc3MnXSxcbiAgICByZXN0cmljdGlvbnM6IFsvXFwuKChzYXxzY3xjKXNzKSQvaV0sXG4gICAgcHJlZmVyUmVsYXRpdmU6IHRydWUsXG4gICAgc3ltbGlua3M6ICFwcmVzZXJ2ZVN5bWxpbmtzLFxuICB9O1xuXG4gIC8vIFNhc3MgYWxzbyBzdXBwb3J0cyBpbXBvcnQtb25seSBmaWxlcy4gSWYgeW91IG5hbWUgYSBmaWxlIDxuYW1lPi5pbXBvcnQuc2NzcywgaXQgd2lsbCBvbmx5IGJlIGxvYWRlZCBmb3IgaW1wb3J0cywgbm90IGZvciBAdXNlcy5cbiAgLy8gU2VlOiBodHRwczovL3Nhc3MtbGFuZy5jb20vZG9jdW1lbnRhdGlvbi9hdC1ydWxlcy9pbXBvcnQjaW1wb3J0LW9ubHktZmlsZXNcbiAgY29uc3QgcmVzb2x2ZUltcG9ydCA9IGxvYWRlckNvbnRleHQuZ2V0UmVzb2x2ZSh7XG4gICAgLi4uY29tbW9uUmVzb2x2ZXJPcHRpb25zLFxuICAgIGRlcGVuZGVuY3lUeXBlOiAnc2Fzcy1pbXBvcnQnLFxuICAgIG1haW5GaWxlczogWydfaW5kZXguaW1wb3J0JywgJ19pbmRleCcsICdpbmRleC5pbXBvcnQnLCAnaW5kZXgnLCAnLi4uJ10sXG4gIH0pO1xuXG4gIGNvbnN0IHJlc29sdmVNb2R1bGUgPSBsb2FkZXJDb250ZXh0LmdldFJlc29sdmUoe1xuICAgIC4uLmNvbW1vblJlc29sdmVyT3B0aW9ucyxcbiAgICBkZXBlbmRlbmN5VHlwZTogJ3Nhc3MtbW9kdWxlJyxcbiAgICBtYWluRmlsZXM6IFsnX2luZGV4JywgJ2luZGV4JywgJy4uLiddLFxuICB9KTtcblxuICByZXR1cm4ge1xuICAgIGZpbmRGaWxlVXJsOiBhc3luYyAoXG4gICAgICB1cmwsXG4gICAgICB7IGZyb21JbXBvcnQsIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzIH06IEZpbGVJbXBvcnRlcldpdGhSZXF1ZXN0Q29udGV4dE9wdGlvbnMsXG4gICAgKTogUHJvbWlzZTxVUkwgfCBudWxsPiA9PiB7XG4gICAgICBpZiAodXJsLmNoYXJBdCgwKSA9PT0gJy4nKSB7XG4gICAgICAgIC8vIExldCBTYXNzIGhhbmRsZSByZWxhdGl2ZSBpbXBvcnRzLlxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzb2x2ZSA9IGZyb21JbXBvcnQgPyByZXNvbHZlSW1wb3J0IDogcmVzb2x2ZU1vZHVsZTtcbiAgICAgIC8vIFRyeSB0byByZXNvbHZlIGZyb20gcm9vdCBvZiB3b3Jrc3BhY2VcbiAgICAgIGxldCByZXN1bHQgPSBhd2FpdCB0cnlSZXNvbHZlKHJlc29sdmUsIHJvb3QsIHVybCk7XG5cbiAgICAgIC8vIFRyeSB0byByZXNvbHZlIGZyb20gcHJldmlvdXNseSByZXNvbHZlZCBtb2R1bGVzLlxuICAgICAgaWYgKCFyZXN1bHQgJiYgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXMpIHtcbiAgICAgICAgZm9yIChjb25zdCBwYXRoIG9mIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzKSB7XG4gICAgICAgICAgcmVzdWx0ID0gYXdhaXQgdHJ5UmVzb2x2ZShyZXNvbHZlLCBwYXRoLCB1cmwpO1xuICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzdWx0ID8gcGF0aFRvRmlsZVVSTChyZXN1bHQpIDogbnVsbDtcbiAgICB9LFxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiB0cnlSZXNvbHZlKFxuICByZXNvbHZlOiBSZXR1cm5UeXBlPExvYWRlckNvbnRleHQ8e30+WydnZXRSZXNvbHZlJ10+LFxuICByb290OiBzdHJpbmcsXG4gIHVybDogc3RyaW5nLFxuKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgcmVzb2x2ZShyb290LCB1cmwpO1xuICB9IGNhdGNoIHtcbiAgICAvLyBUcnkgdG8gcmVzb2x2ZSBhIHBhcnRpYWwgZmlsZVxuICAgIC8vIEB1c2UgJ0BtYXRlcmlhbC9idXR0b24vYnV0dG9uJyBhcyBtZGMtYnV0dG9uO1xuICAgIC8vIGBAbWF0ZXJpYWwvYnV0dG9uL2J1dHRvbmAgLT4gYEBtYXRlcmlhbC9idXR0b24vX2J1dHRvbmBcbiAgICBjb25zdCBsYXN0U2xhc2hJbmRleCA9IHVybC5sYXN0SW5kZXhPZignLycpO1xuICAgIGNvbnN0IHVuZGVyc2NvcmVJbmRleCA9IGxhc3RTbGFzaEluZGV4ICsgMTtcbiAgICBpZiAodW5kZXJzY29yZUluZGV4ID4gMCAmJiB1cmwuY2hhckF0KHVuZGVyc2NvcmVJbmRleCkgIT09ICdfJykge1xuICAgICAgY29uc3QgcGFydGlhbEZpbGVVcmwgPSBgJHt1cmwuc2xpY2UoMCwgdW5kZXJzY29yZUluZGV4KX1fJHt1cmwuc2xpY2UodW5kZXJzY29yZUluZGV4KX1gO1xuXG4gICAgICByZXR1cm4gcmVzb2x2ZShyb290LCBwYXJ0aWFsRmlsZVVybCkuY2F0Y2goKCkgPT4gdW5kZWZpbmVkKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuIl19