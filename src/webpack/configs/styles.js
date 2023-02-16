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
    const { root, buildOptions, logger } = wco;
    const extraPlugins = [];
    extraPlugins.push(new plugins_1.AnyComponentStyleBudgetChecker(buildOptions.budgets));
    const cssSourceMap = buildOptions.sourceMap.styles;
    // Determine hashing format.
    const hashFormat = (0, helpers_1.getOutputHashFormat)(buildOptions.outputHashing);
    // use includePaths from appConfig
    const includePaths = buildOptions.stylePreprocessorOptions?.includePaths?.map((p) => path.resolve(root, p)) ?? [];
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
        catch {
            const relativeTailwindConfigPath = path.relative(wco.root, tailwindConfigPath);
            logger.warn(`Tailwind CSS configuration file found (${relativeTailwindConfigPath})` +
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
    let componentsSourceMap = !!cssSourceMap;
    if (cssSourceMap) {
        if (buildOptions.optimization.styles.minify) {
            // Never use component css sourcemap when style optimizations are on.
            // It will just increase bundle size without offering good debug experience.
            logger.warn('Components styles sourcemaps are not generated when styles optimization is enabled.');
            componentsSourceMap = false;
        }
        else if (buildOptions.sourceMap.hidden) {
            // Inline all sourcemap types except hidden ones, which are the same as no sourcemaps
            // for component css.
            logger.warn('Components styles sourcemaps are not generated when sourcemaps are hidden.');
            componentsSourceMap = false;
        }
    }
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
                    options: getSassLoaderOptions(root, sassImplementation, includePaths, false, !!buildOptions.verbose, !!buildOptions.preserveSymlinks),
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
                    options: getSassLoaderOptions(root, sassImplementation, includePaths, true, !!buildOptions.verbose, !!buildOptions.preserveSymlinks),
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
                sourceMapIncludeSources: true,
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
    catch {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHNGQUEyRDtBQUMzRCw0Q0FBOEI7QUFDOUIsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUd6QywwREFHaUM7QUFDakMsd0VBQWdGO0FBRWhGLHlFQUFnRTtBQUNoRSx3Q0FLb0I7QUFDcEIsMEVBQXFFO0FBQ3JFLDRFQUF1RTtBQUN2RSw4Q0FJMEI7QUFFMUIsa0RBQWtEO0FBQ2xELFNBQWdCLGVBQWUsQ0FBQyxHQUF5QjtJQUN2RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFDM0MsTUFBTSxZQUFZLEdBQTZCLEVBQUUsQ0FBQztJQUVsRCxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksd0NBQThCLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFFNUUsTUFBTSxZQUFZLEdBQUcsWUFBWSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7SUFFbkQsNEJBQTRCO0lBQzVCLE1BQU0sVUFBVSxHQUFHLElBQUEsNkJBQW1CLEVBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBRW5FLGtDQUFrQztJQUNsQyxNQUFNLFlBQVksR0FDaEIsWUFBWSxDQUFDLHdCQUF3QixFQUFFLFlBQVksRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBRS9GLHlCQUF5QjtJQUN6QixJQUFJLFlBQVksQ0FBQyxNQUFN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Q0YsQ0FBQztBQUNKLENBQUM7QUFFRCxLQUFLLFVBQVUsVUFBVSxDQUN2QixPQUFvRCxFQUNwRCxJQUFZLEVBQ1osR0FBVztJQUVYLElBQUk7UUFDRixPQUFPLE1BQU0sT0FBTyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztLQUNqQztJQUFDLE1BQU07UUFDTixnQ0FBZ0M7UUFDaEMsZ0RBQWdEO1FBQ2hELDBEQUEwRDtRQUMxRCxNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzVDLE1BQU0sZUFBZSxHQUFHLGNBQWMsR0FBRyxDQUFDLENBQUM7UUFDM0MsSUFBSSxlQUFlLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLEtBQUssR0FBRyxFQUFFO1lBQzlELE1BQU0sY0FBYyxHQUFHLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsZUFBZSxDQUFDLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDO1lBRXhGLE9BQU8sT0FBTyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDN0Q7S0FDRjtJQUVELE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IE1pbmlDc3NFeHRyYWN0UGx1Z2luIGZyb20gJ21pbmktY3NzLWV4dHJhY3QtcGx1Z2luJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0eXBlIHsgRmlsZUltcG9ydGVyIH0gZnJvbSAnc2Fzcyc7XG5pbXBvcnQgdHlwZSB7IENvbmZpZ3VyYXRpb24sIExvYWRlckNvbnRleHQsIFJ1bGVTZXRVc2VJdGVtIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQge1xuICBGaWxlSW1wb3J0ZXJXaXRoUmVxdWVzdENvbnRleHRPcHRpb25zLFxuICBTYXNzV29ya2VySW1wbGVtZW50YXRpb24sXG59IGZyb20gJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlJztcbmltcG9ydCB7IFNhc3NMZWdhY3lXb3JrZXJJbXBsZW1lbnRhdGlvbiB9IGZyb20gJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlLWxlZ2FjeSc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgdXNlTGVnYWN5U2FzcyB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHtcbiAgQW55Q29tcG9uZW50U3R5bGVCdWRnZXRDaGVja2VyLFxuICBQb3N0Y3NzQ2xpUmVzb3VyY2VzLFxuICBSZW1vdmVIYXNoUGx1Z2luLFxuICBTdXBwcmVzc0V4dHJhY3RlZFRleHRDaHVua3NXZWJwYWNrUGx1Z2luLFxufSBmcm9tICcuLi9wbHVnaW5zJztcbmltcG9ydCB7IENzc09wdGltaXplclBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvY3NzLW9wdGltaXplci1wbHVnaW4nO1xuaW1wb3J0IHsgU3R5bGVzV2VicGFja1BsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvc3R5bGVzLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7XG4gIGFzc2V0TmFtZVRlbXBsYXRlRmFjdG9yeSxcbiAgZ2V0T3V0cHV0SGFzaEZvcm1hdCxcbiAgbm9ybWFsaXplR2xvYmFsU3R5bGVzLFxufSBmcm9tICcuLi91dGlscy9oZWxwZXJzJztcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBnZXRTdHlsZXNDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IENvbmZpZ3VyYXRpb24ge1xuICBjb25zdCB7IHJvb3QsIGJ1aWxkT3B0aW9ucywgbG9nZ2VyIH0gPSB3Y287XG4gIGNvbnN0IGV4dHJhUGx1Z2luczogQ29uZmlndXJhdGlvblsncGx1Z2lucyddID0gW107XG5cbiAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IEFueUNvbXBvbmVudFN0eWxlQnVkZ2V0Q2hlY2tlcihidWlsZE9wdGlvbnMuYnVkZ2V0cykpO1xuXG4gIGNvbnN0IGNzc1NvdXJjZU1hcCA9IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAuc3R5bGVzO1xuXG4gIC8vIERldGVybWluZSBoYXNoaW5nIGZvcm1hdC5cbiAgY29uc3QgaGFzaEZvcm1hdCA9IGdldE91dHB1dEhhc2hGb3JtYXQoYnVpbGRPcHRpb25zLm91dHB1dEhhc2hpbmcpO1xuXG4gIC8vIHVzZSBpbmNsdWRlUGF0aHMgZnJvbSBhcHBDb25maWdcbiAgY29uc3QgaW5jbHVkZVBhdGhzID1cbiAgICBidWlsZE9wdGlvbnMuc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zPy5pbmNsdWRlUGF0aHM/Lm1hcCgocCkgPT4gcGF0aC5yZXNvbHZlKHJvb3QsIHApKSA/PyBbXTtcblxuICAvLyBQcm9jZXNzIGdsb2JhbCBzdHlsZXMuXG4gIGlmIChidWlsZE9wdGlvbnMuc3R5bGVzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCB7IGVudHJ5UG9pbnRzLCBub0luamVjdE5hbWVzIH0gPSBub3JtYWxpemVHbG9iYWxTdHlsZXMoYnVpbGRPcHRpb25zLnN0eWxlcyk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU3R5bGVzV2VicGFja1BsdWdpbih7XG4gICAgICAgIHJvb3QsXG4gICAgICAgIGVudHJ5UG9pbnRzLFxuICAgICAgICBwcmVzZXJ2ZVN5bWxpbmtzOiBidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBpZiAobm9JbmplY3ROYW1lcy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBBZGQgcGx1Z2luIHRvIHJlbW92ZSBoYXNoZXMgZnJvbSBsYXp5IHN0eWxlcy5cbiAgICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBSZW1vdmVIYXNoUGx1Z2luKHsgY2h1bmtOYW1lczogbm9JbmplY3ROYW1lcywgaGFzaEZvcm1hdCB9KSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qgc2Fzc0ltcGxlbWVudGF0aW9uID0gdXNlTGVnYWN5U2Fzc1xuICAgID8gbmV3IFNhc3NMZWdhY3lXb3JrZXJJbXBsZW1lbnRhdGlvbigpXG4gICAgOiBuZXcgU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uKCk7XG5cbiAgZXh0cmFQbHVnaW5zLnB1c2goe1xuICAgIGFwcGx5KGNvbXBpbGVyKSB7XG4gICAgICBjb21waWxlci5ob29rcy5zaHV0ZG93bi50YXAoJ3Nhc3Mtd29ya2VyJywgKCkgPT4ge1xuICAgICAgICBzYXNzSW1wbGVtZW50YXRpb24uY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH0pO1xuXG4gIGNvbnN0IGFzc2V0TmFtZVRlbXBsYXRlID0gYXNzZXROYW1lVGVtcGxhdGVGYWN0b3J5KGhhc2hGb3JtYXQpO1xuXG4gIGNvbnN0IGV4dHJhUG9zdGNzc1BsdWdpbnM6IGltcG9ydCgncG9zdGNzcycpLlBsdWdpbltdID0gW107XG5cbiAgLy8gQXR0ZW1wdCB0byBzZXR1cCBUYWlsd2luZCBDU1NcbiAgLy8gT25seSBsb2FkIFRhaWx3aW5kIENTUyBwbHVnaW4gaWYgY29uZmlndXJhdGlvbiBmaWxlIHdhcyBmb3VuZC5cbiAgLy8gVGhpcyBhY3RzIGFzIGEgZ3VhcmQgdG8gZW5zdXJlIHRoZSBwcm9qZWN0IGFjdHVhbGx5IHdhbnRzIHRvIHVzZSBUYWlsd2luZCBDU1MuXG4gIC8vIFRoZSBwYWNrYWdlIG1heSBiZSB1bmtub3duaW5nbHkgcHJlc2VudCBkdWUgdG8gYSB0aGlyZC1wYXJ0eSB0cmFuc2l0aXZlIHBhY2thZ2UgZGVwZW5kZW5jeS5cbiAgY29uc3QgdGFpbHdpbmRDb25maWdQYXRoID0gZ2V0VGFpbHdpbmRDb25maWdQYXRoKHdjbyk7XG4gIGlmICh0YWlsd2luZENvbmZpZ1BhdGgpIHtcbiAgICBsZXQgdGFpbHdpbmRQYWNrYWdlUGF0aDtcbiAgICB0cnkge1xuICAgICAgdGFpbHdpbmRQYWNrYWdlUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgndGFpbHdpbmRjc3MnLCB7IHBhdGhzOiBbd2NvLnJvb3RdIH0pO1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29uc3QgcmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGggPSBwYXRoLnJlbGF0aXZlKHdjby5yb290LCB0YWlsd2luZENvbmZpZ1BhdGgpO1xuICAgICAgbG9nZ2VyLndhcm4oXG4gICAgICAgIGBUYWlsd2luZCBDU1MgY29uZmlndXJhdGlvbiBmaWxlIGZvdW5kICgke3JlbGF0aXZlVGFpbHdpbmRDb25maWdQYXRofSlgICtcbiAgICAgICAgICBgIGJ1dCB0aGUgJ3RhaWx3aW5kY3NzJyBwYWNrYWdlIGlzIG5vdCBpbnN0YWxsZWQuYCArXG4gICAgICAgICAgYCBUbyBlbmFibGUgVGFpbHdpbmQgQ1NTLCBwbGVhc2UgaW5zdGFsbCB0aGUgJ3RhaWx3aW5kY3NzJyBwYWNrYWdlLmAsXG4gICAgICApO1xuICAgIH1cbiAgICBpZiAodGFpbHdpbmRQYWNrYWdlUGF0aCkge1xuICAgICAgZXh0cmFQb3N0Y3NzUGx1Z2lucy5wdXNoKHJlcXVpcmUodGFpbHdpbmRQYWNrYWdlUGF0aCkoeyBjb25maWc6IHRhaWx3aW5kQ29uZmlnUGF0aCB9KSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgYXV0b3ByZWZpeGVyOiB0eXBlb2YgaW1wb3J0KCdhdXRvcHJlZml4ZXInKSA9IHJlcXVpcmUoJ2F1dG9wcmVmaXhlcicpO1xuXG4gIGNvbnN0IHBvc3Rjc3NPcHRpb25zQ3JlYXRvciA9IChpbmxpbmVTb3VyY2VtYXBzOiBib29sZWFuLCBleHRyYWN0ZWQ6IGJvb2xlYW4pID0+IHtcbiAgICBjb25zdCBvcHRpb25HZW5lcmF0b3IgPSAobG9hZGVyOiBMb2FkZXJDb250ZXh0PHVua25vd24+KSA9PiAoe1xuICAgICAgbWFwOiBpbmxpbmVTb3VyY2VtYXBzXG4gICAgICAgID8ge1xuICAgICAgICAgICAgaW5saW5lOiB0cnVlLFxuICAgICAgICAgICAgYW5ub3RhdGlvbjogZmFsc2UsXG4gICAgICAgICAgfVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgIHBsdWdpbnM6IFtcbiAgICAgICAgUG9zdGNzc0NsaVJlc291cmNlcyh7XG4gICAgICAgICAgYmFzZUhyZWY6IGJ1aWxkT3B0aW9ucy5iYXNlSHJlZixcbiAgICAgICAgICBkZXBsb3lVcmw6IGJ1aWxkT3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgICAgICAgcmVzb3VyY2VzT3V0cHV0UGF0aDogYnVpbGRPcHRpb25zLnJlc291cmNlc091dHB1dFBhdGgsXG4gICAgICAgICAgbG9hZGVyLFxuICAgICAgICAgIGZpbGVuYW1lOiBhc3NldE5hbWVUZW1wbGF0ZSxcbiAgICAgICAgICBlbWl0RmlsZTogYnVpbGRPcHRpb25zLnBsYXRmb3JtICE9PSAnc2VydmVyJyxcbiAgICAgICAgICBleHRyYWN0ZWQsXG4gICAgICAgIH0pLFxuICAgICAgICAuLi5leHRyYVBvc3Rjc3NQbHVnaW5zLFxuICAgICAgICBhdXRvcHJlZml4ZXIoe1xuICAgICAgICAgIGlnbm9yZVVua25vd25WZXJzaW9uczogdHJ1ZSxcbiAgICAgICAgICBvdmVycmlkZUJyb3dzZXJzbGlzdDogYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgLy8gcG9zdGNzcy1sb2FkZXIgZmFpbHMgd2hlbiB0cnlpbmcgdG8gZGV0ZXJtaW5lIGNvbmZpZ3VyYXRpb24gZmlsZXMgZm9yIGRhdGEgVVJJc1xuICAgIG9wdGlvbkdlbmVyYXRvci5jb25maWcgPSBmYWxzZTtcblxuICAgIHJldHVybiBvcHRpb25HZW5lcmF0b3I7XG4gIH07XG5cbiAgbGV0IGNvbXBvbmVudHNTb3VyY2VNYXAgPSAhIWNzc1NvdXJjZU1hcDtcbiAgaWYgKGNzc1NvdXJjZU1hcCkge1xuICAgIGlmIChidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uLnN0eWxlcy5taW5pZnkpIHtcbiAgICAgIC8vIE5ldmVyIHVzZSBjb21wb25lbnQgY3NzIHNvdXJjZW1hcCB3aGVuIHN0eWxlIG9wdGltaXphdGlvbnMgYXJlIG9uLlxuICAgICAgLy8gSXQgd2lsbCBqdXN0IGluY3JlYXNlIGJ1bmRsZSBzaXplIHdpdGhvdXQgb2ZmZXJpbmcgZ29vZCBkZWJ1ZyBleHBlcmllbmNlLlxuICAgICAgbG9nZ2VyLndhcm4oXG4gICAgICAgICdDb21wb25lbnRzIHN0eWxlcyBzb3VyY2VtYXBzIGFyZSBub3QgZ2VuZXJhdGVkIHdoZW4gc3R5bGVzIG9wdGltaXphdGlvbiBpcyBlbmFibGVkLicsXG4gICAgICApO1xuICAgICAgY29tcG9uZW50c1NvdXJjZU1hcCA9IGZhbHNlO1xuICAgIH0gZWxzZSBpZiAoYnVpbGRPcHRpb25zLnNvdXJjZU1hcC5oaWRkZW4pIHtcbiAgICAgIC8vIElubGluZSBhbGwgc291cmNlbWFwIHR5cGVzIGV4Y2VwdCBoaWRkZW4gb25lcywgd2hpY2ggYXJlIHRoZSBzYW1lIGFzIG5vIHNvdXJjZW1hcHNcbiAgICAgIC8vIGZvciBjb21wb25lbnQgY3NzLlxuICAgICAgbG9nZ2VyLndhcm4oJ0NvbXBvbmVudHMgc3R5bGVzIHNvdXJjZW1hcHMgYXJlIG5vdCBnZW5lcmF0ZWQgd2hlbiBzb3VyY2VtYXBzIGFyZSBoaWRkZW4uJyk7XG4gICAgICBjb21wb25lbnRzU291cmNlTWFwID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLy8gZXh0cmFjdCBnbG9iYWwgY3NzIGZyb20ganMgZmlsZXMgaW50byBvd24gY3NzIGZpbGUuXG4gIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBNaW5pQ3NzRXh0cmFjdFBsdWdpbih7IGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmV4dHJhY3R9LmNzc2AgfSkpO1xuXG4gIGlmICghYnVpbGRPcHRpb25zLmhtcikge1xuICAgIC8vIGRvbid0IHJlbW92ZSBgLmpzYCBmaWxlcyBmb3IgYC5jc3NgIHdoZW4gd2UgYXJlIHVzaW5nIEhNUiB0aGVzZSBjb250YWluIEhNUiBhY2NlcHQgY29kZXMuXG4gICAgLy8gc3VwcHJlc3MgZW1wdHkgLmpzIGZpbGVzIGluIGNzcyBvbmx5IGVudHJ5IHBvaW50cy5cbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU3VwcHJlc3NFeHRyYWN0ZWRUZXh0Q2h1bmtzV2VicGFja1BsdWdpbigpKTtcbiAgfVxuXG4gIGNvbnN0IHBvc3RDc3MgPSByZXF1aXJlKCdwb3N0Y3NzJyk7XG4gIGNvbnN0IHBvc3RDc3NMb2FkZXJQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCdwb3N0Y3NzLWxvYWRlcicpO1xuXG4gIGNvbnN0IGNvbXBvbmVudFN0eWxlTG9hZGVyczogUnVsZVNldFVzZUl0ZW1bXSA9IFtcbiAgICB7XG4gICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnY3NzLWxvYWRlcicpLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICB1cmw6IGZhbHNlLFxuICAgICAgICBzb3VyY2VNYXA6IGNvbXBvbmVudHNTb3VyY2VNYXAsXG4gICAgICAgIGltcG9ydExvYWRlcnM6IDEsXG4gICAgICAgIGV4cG9ydFR5cGU6ICdzdHJpbmcnLFxuICAgICAgICBlc01vZHVsZTogZmFsc2UsXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgbG9hZGVyOiBwb3N0Q3NzTG9hZGVyUGF0aCxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgaW1wbGVtZW50YXRpb246IHBvc3RDc3MsXG4gICAgICAgIHBvc3Rjc3NPcHRpb25zOiBwb3N0Y3NzT3B0aW9uc0NyZWF0b3IoY29tcG9uZW50c1NvdXJjZU1hcCwgZmFsc2UpLFxuICAgICAgfSxcbiAgICB9LFxuICBdO1xuXG4gIGNvbnN0IGdsb2JhbFN0eWxlTG9hZGVyczogUnVsZVNldFVzZUl0ZW1bXSA9IFtcbiAgICB7XG4gICAgICBsb2FkZXI6IE1pbmlDc3NFeHRyYWN0UGx1Z2luLmxvYWRlcixcbiAgICB9LFxuICAgIHtcbiAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdjc3MtbG9hZGVyJyksXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIHVybDogZmFsc2UsXG4gICAgICAgIHNvdXJjZU1hcDogISFjc3NTb3VyY2VNYXAsXG4gICAgICAgIGltcG9ydExvYWRlcnM6IDEsXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgbG9hZGVyOiBwb3N0Q3NzTG9hZGVyUGF0aCxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgaW1wbGVtZW50YXRpb246IHBvc3RDc3MsXG4gICAgICAgIHBvc3Rjc3NPcHRpb25zOiBwb3N0Y3NzT3B0aW9uc0NyZWF0b3IoZmFsc2UsIHRydWUpLFxuICAgICAgICBzb3VyY2VNYXA6ICEhY3NzU291cmNlTWFwLFxuICAgICAgfSxcbiAgICB9LFxuICBdO1xuXG4gIGNvbnN0IHN0eWxlTGFuZ3VhZ2VzOiB7XG4gICAgZXh0ZW5zaW9uczogc3RyaW5nW107XG4gICAgdXNlOiBSdWxlU2V0VXNlSXRlbVtdO1xuICB9W10gPSBbXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydjc3MnXSxcbiAgICAgIHVzZTogW10sXG4gICAgfSxcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ3Njc3MnXSxcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Jlc29sdmUtdXJsLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnc2Fzcy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiBnZXRTYXNzTG9hZGVyT3B0aW9ucyhcbiAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICBzYXNzSW1wbGVtZW50YXRpb24sXG4gICAgICAgICAgICBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICEhYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgICAhIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgICAgICksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydzYXNzJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdyZXNvbHZlLXVybC1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Nhc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczogZ2V0U2Fzc0xvYWRlck9wdGlvbnMoXG4gICAgICAgICAgICByb290LFxuICAgICAgICAgICAgc2Fzc0ltcGxlbWVudGF0aW9uLFxuICAgICAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICAgICEhYnVpbGRPcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgICAhIWJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgICAgICksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydsZXNzJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdsZXNzLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIGltcGxlbWVudGF0aW9uOiByZXF1aXJlKCdsZXNzJyksXG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICAgIGxlc3NPcHRpb25zOiB7XG4gICAgICAgICAgICAgIGphdmFzY3JpcHRFbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICBwYXRoczogaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICBdO1xuXG4gIHJldHVybiB7XG4gICAgbW9kdWxlOiB7XG4gICAgICBydWxlczogc3R5bGVMYW5ndWFnZXMubWFwKCh7IGV4dGVuc2lvbnMsIHVzZSB9KSA9PiAoe1xuICAgICAgICB0ZXN0OiBuZXcgUmVnRXhwKGBcXFxcLig/OiR7ZXh0ZW5zaW9ucy5qb2luKCd8Jyl9KSRgLCAnaScpLFxuICAgICAgICBydWxlczogW1xuICAgICAgICAgIC8vIFNldHVwIHByb2Nlc3NpbmcgcnVsZXMgZm9yIGdsb2JhbCBhbmQgY29tcG9uZW50IHN0eWxlc1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgICAgIC8vIEdsb2JhbCBzdHlsZXMgYXJlIG9ubHkgZGVmaW5lZCBnbG9iYWwgc3R5bGVzXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1c2U6IGdsb2JhbFN0eWxlTG9hZGVycyxcbiAgICAgICAgICAgICAgICByZXNvdXJjZVF1ZXJ5OiAvXFw/bmdHbG9iYWxTdHlsZS8sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXMgYXJlIGFsbCBzdHlsZXMgZXhjZXB0IGRlZmluZWQgZ2xvYmFsIHN0eWxlc1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdXNlOiBjb21wb25lbnRTdHlsZUxvYWRlcnMsXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VRdWVyeTogL1xcP25nUmVzb3VyY2UvLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHsgdXNlIH0sXG4gICAgICAgIF0sXG4gICAgICB9KSksXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIG1pbmltaXplcjogYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbi5zdHlsZXMubWluaWZ5XG4gICAgICAgID8gW1xuICAgICAgICAgICAgbmV3IENzc09wdGltaXplclBsdWdpbih7XG4gICAgICAgICAgICAgIHN1cHBvcnRlZEJyb3dzZXJzOiBidWlsZE9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdXG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLFxuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRUYWlsd2luZENvbmZpZ1BhdGgoeyBwcm9qZWN0Um9vdCwgcm9vdCB9OiBXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIC8vIEEgY29uZmlndXJhdGlvbiBmaWxlIGNhbiBleGlzdCBpbiB0aGUgcHJvamVjdCBvciB3b3Jrc3BhY2Ugcm9vdFxuICAvLyBUaGUgbGlzdCBvZiB2YWxpZCBjb25maWcgZmlsZXMgY2FuIGJlIGZvdW5kOlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vdGFpbHdpbmRsYWJzL3RhaWx3aW5kY3NzL2Jsb2IvODg0NWQxMTJmYjYyZDc5ODE1YjUwYjNiYWU4MGMzMTc0NTBiOGI5Mi9zcmMvdXRpbC9yZXNvbHZlQ29uZmlnUGF0aC5qcyNMNDYtTDUyXG4gIGNvbnN0IHRhaWx3aW5kQ29uZmlnRmlsZXMgPSBbJ3RhaWx3aW5kLmNvbmZpZy5qcycsICd0YWlsd2luZC5jb25maWcuY2pzJ107XG4gIGZvciAoY29uc3QgYmFzZVBhdGggb2YgW3Byb2plY3RSb290LCByb290XSkge1xuICAgIGZvciAoY29uc3QgY29uZmlnRmlsZSBvZiB0YWlsd2luZENvbmZpZ0ZpbGVzKSB7XG4gICAgICAvLyBJcnJlc3BlY3RpdmUgb2YgdGhlIG5hbWUgcHJvamVjdCBsZXZlbCBjb25maWd1cmF0aW9uIHNob3VsZCBhbHdheXMgdGFrZSBwcmVjZWRlbmNlLlxuICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4oYmFzZVBhdGgsIGNvbmZpZ0ZpbGUpO1xuICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoZnVsbFBhdGgpKSB7XG4gICAgICAgIHJldHVybiBmdWxsUGF0aDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBnZXRTYXNzTG9hZGVyT3B0aW9ucyhcbiAgcm9vdDogc3RyaW5nLFxuICBpbXBsZW1lbnRhdGlvbjogU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uIHwgU2Fzc0xlZ2FjeVdvcmtlckltcGxlbWVudGF0aW9uLFxuICBpbmNsdWRlUGF0aHM6IHN0cmluZ1tdLFxuICBpbmRlbnRlZFN5bnRheDogYm9vbGVhbixcbiAgdmVyYm9zZTogYm9vbGVhbixcbiAgcHJlc2VydmVTeW1saW5rczogYm9vbGVhbixcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIGltcGxlbWVudGF0aW9uIGluc3RhbmNlb2YgU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uXG4gICAgPyB7XG4gICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcbiAgICAgICAgYXBpOiAnbW9kZXJuJyxcbiAgICAgICAgaW1wbGVtZW50YXRpb24sXG4gICAgICAgIC8vIFdlYnBhY2sgaW1wb3J0ZXIgaXMgb25seSBpbXBsZW1lbnRlZCBpbiB0aGUgbGVnYWN5IEFQSSBhbmQgd2UgaGF2ZSBvdXIgb3duIGN1c3RvbSBXZWJwYWNrIGltcG9ydGVyLlxuICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc2Fzcy1sb2FkZXIvYmxvYi85OTdmM2ViNDFkODZkZDAwZDVmYTQ5YzM5NWExYWViNDE1NzMxMDhjL3NyYy91dGlscy5qcyNMNjQyLUw2NTFcbiAgICAgICAgd2VicGFja0ltcG9ydGVyOiBmYWxzZSxcbiAgICAgICAgc2Fzc09wdGlvbnM6IChsb2FkZXJDb250ZXh0OiBMb2FkZXJDb250ZXh0PHt9PikgPT4gKHtcbiAgICAgICAgICBpbXBvcnRlcnM6IFtnZXRTYXNzUmVzb2x1dGlvbkltcG9ydGVyKGxvYWRlckNvbnRleHQsIHJvb3QsIHByZXNlcnZlU3ltbGlua3MpXSxcbiAgICAgICAgICBsb2FkUGF0aHM6IGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAvLyBVc2UgZXhwYW5kZWQgYXMgb3RoZXJ3aXNlIHNhc3Mgd2lsbCByZW1vdmUgY29tbWVudHMgdGhhdCBhcmUgbmVlZGVkIGZvciBhdXRvcHJlZml4ZXJcbiAgICAgICAgICAvLyBFeDogLyogYXV0b3ByZWZpeGVyIGdyaWQ6IGF1dG9wbGFjZSAqL1xuICAgICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zYXNzLWxvYWRlci9ibG9iLzQ1YWQwYmUxNzI2NGNlYWRhNWYwYjRmYjg3ZTkzNTdhYmU4NWM0ZmYvc3JjL2dldFNhc3NPcHRpb25zLmpzI0w2OC1MNzBcbiAgICAgICAgICBzdHlsZTogJ2V4cGFuZGVkJyxcbiAgICAgICAgICAvLyBTaWxlbmNlcyBjb21waWxlciB3YXJuaW5ncyBmcm9tIDNyZCBwYXJ0eSBzdHlsZXNoZWV0c1xuICAgICAgICAgIHF1aWV0RGVwczogIXZlcmJvc2UsXG4gICAgICAgICAgdmVyYm9zZSxcbiAgICAgICAgICBzeW50YXg6IGluZGVudGVkU3ludGF4ID8gJ2luZGVudGVkJyA6ICdzY3NzJyxcbiAgICAgICAgICBzb3VyY2VNYXBJbmNsdWRlU291cmNlczogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICB9XG4gICAgOiB7XG4gICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcbiAgICAgICAgYXBpOiAnbGVnYWN5JyxcbiAgICAgICAgaW1wbGVtZW50YXRpb24sXG4gICAgICAgIHNhc3NPcHRpb25zOiB7XG4gICAgICAgICAgaW1wb3J0ZXI6ICh1cmw6IHN0cmluZywgZnJvbTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICBpZiAodXJsLmNoYXJBdCgwKSA9PT0gJ34nKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgJyR7ZnJvbX0nIGltcG9ydHMgJyR7dXJsfScgd2l0aCBhIHRpbGRlLiBVc2FnZSBvZiAnficgaW4gaW1wb3J0cyBpcyBubyBsb25nZXIgc3VwcG9ydGVkLmAsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgLy8gUHJldmVudCB1c2Ugb2YgYGZpYmVyc2AgcGFja2FnZSBhcyBpdCBubyBsb25nZXIgd29ya3MgaW4gbmV3ZXIgTm9kZS5qcyB2ZXJzaW9uc1xuICAgICAgICAgIGZpYmVyOiBmYWxzZSxcbiAgICAgICAgICBpbmRlbnRlZFN5bnRheCxcbiAgICAgICAgICAvLyBib290c3RyYXAtc2FzcyByZXF1aXJlcyBhIG1pbmltdW0gcHJlY2lzaW9uIG9mIDhcbiAgICAgICAgICBwcmVjaXNpb246IDgsXG4gICAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICAgIC8vIFVzZSBleHBhbmRlZCBhcyBvdGhlcndpc2Ugc2FzcyB3aWxsIHJlbW92ZSBjb21tZW50cyB0aGF0IGFyZSBuZWVkZWQgZm9yIGF1dG9wcmVmaXhlclxuICAgICAgICAgIC8vIEV4OiAvKiBhdXRvcHJlZml4ZXIgZ3JpZDogYXV0b3BsYWNlICovXG4gICAgICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3Nhc3MtbG9hZGVyL2Jsb2IvNDVhZDBiZTE3MjY0Y2VhZGE1ZjBiNGZiODdlOTM1N2FiZTg1YzRmZi9zcmMvZ2V0U2Fzc09wdGlvbnMuanMjTDY4LUw3MFxuICAgICAgICAgIG91dHB1dFN0eWxlOiAnZXhwYW5kZWQnLFxuICAgICAgICAgIC8vIFNpbGVuY2VzIGNvbXBpbGVyIHdhcm5pbmdzIGZyb20gM3JkIHBhcnR5IHN0eWxlc2hlZXRzXG4gICAgICAgICAgcXVpZXREZXBzOiAhdmVyYm9zZSxcbiAgICAgICAgICB2ZXJib3NlLFxuICAgICAgICB9LFxuICAgICAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0U2Fzc1Jlc29sdXRpb25JbXBvcnRlcihcbiAgbG9hZGVyQ29udGV4dDogTG9hZGVyQ29udGV4dDx7fT4sXG4gIHJvb3Q6IHN0cmluZyxcbiAgcHJlc2VydmVTeW1saW5rczogYm9vbGVhbixcbik6IEZpbGVJbXBvcnRlcjwnYXN5bmMnPiB7XG4gIGNvbnN0IGNvbW1vblJlc29sdmVyT3B0aW9uczogUGFyYW1ldGVyczx0eXBlb2YgbG9hZGVyQ29udGV4dFsnZ2V0UmVzb2x2ZSddPlswXSA9IHtcbiAgICBjb25kaXRpb25OYW1lczogWydzYXNzJywgJ3N0eWxlJ10sXG4gICAgbWFpbkZpZWxkczogWydzYXNzJywgJ3N0eWxlJywgJ21haW4nLCAnLi4uJ10sXG4gICAgZXh0ZW5zaW9uczogWycuc2NzcycsICcuc2FzcycsICcuY3NzJ10sXG4gICAgcmVzdHJpY3Rpb25zOiBbL1xcLigoc2F8c2N8YylzcykkL2ldLFxuICAgIHByZWZlclJlbGF0aXZlOiB0cnVlLFxuICAgIHN5bWxpbmtzOiAhcHJlc2VydmVTeW1saW5rcyxcbiAgfTtcblxuICAvLyBTYXNzIGFsc28gc3VwcG9ydHMgaW1wb3J0LW9ubHkgZmlsZXMuIElmIHlvdSBuYW1lIGEgZmlsZSA8bmFtZT4uaW1wb3J0LnNjc3MsIGl0IHdpbGwgb25seSBiZSBsb2FkZWQgZm9yIGltcG9ydHMsIG5vdCBmb3IgQHVzZXMuXG4gIC8vIFNlZTogaHR0cHM6Ly9zYXNzLWxhbmcuY29tL2RvY3VtZW50YXRpb24vYXQtcnVsZXMvaW1wb3J0I2ltcG9ydC1vbmx5LWZpbGVzXG4gIGNvbnN0IHJlc29sdmVJbXBvcnQgPSBsb2FkZXJDb250ZXh0LmdldFJlc29sdmUoe1xuICAgIC4uLmNvbW1vblJlc29sdmVyT3B0aW9ucyxcbiAgICBkZXBlbmRlbmN5VHlwZTogJ3Nhc3MtaW1wb3J0JyxcbiAgICBtYWluRmlsZXM6IFsnX2luZGV4LmltcG9ydCcsICdfaW5kZXgnLCAnaW5kZXguaW1wb3J0JywgJ2luZGV4JywgJy4uLiddLFxuICB9KTtcblxuICBjb25zdCByZXNvbHZlTW9kdWxlID0gbG9hZGVyQ29udGV4dC5nZXRSZXNvbHZlKHtcbiAgICAuLi5jb21tb25SZXNvbHZlck9wdGlvbnMsXG4gICAgZGVwZW5kZW5jeVR5cGU6ICdzYXNzLW1vZHVsZScsXG4gICAgbWFpbkZpbGVzOiBbJ19pbmRleCcsICdpbmRleCcsICcuLi4nXSxcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBmaW5kRmlsZVVybDogYXN5bmMgKFxuICAgICAgdXJsLFxuICAgICAgeyBmcm9tSW1wb3J0LCBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcyB9OiBGaWxlSW1wb3J0ZXJXaXRoUmVxdWVzdENvbnRleHRPcHRpb25zLFxuICAgICk6IFByb21pc2U8VVJMIHwgbnVsbD4gPT4ge1xuICAgICAgaWYgKHVybC5jaGFyQXQoMCkgPT09ICcuJykge1xuICAgICAgICAvLyBMZXQgU2FzcyBoYW5kbGUgcmVsYXRpdmUgaW1wb3J0cy5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc29sdmUgPSBmcm9tSW1wb3J0ID8gcmVzb2x2ZUltcG9ydCA6IHJlc29sdmVNb2R1bGU7XG4gICAgICAvLyBUcnkgdG8gcmVzb2x2ZSBmcm9tIHJvb3Qgb2Ygd29ya3NwYWNlXG4gICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgdHJ5UmVzb2x2ZShyZXNvbHZlLCByb290LCB1cmwpO1xuXG4gICAgICAvLyBUcnkgdG8gcmVzb2x2ZSBmcm9tIHByZXZpb3VzbHkgcmVzb2x2ZWQgbW9kdWxlcy5cbiAgICAgIGlmICghcmVzdWx0ICYmIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzKSB7XG4gICAgICAgIGZvciAoY29uc3QgcGF0aCBvZiBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcykge1xuICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IHRyeVJlc29sdmUocmVzb2x2ZSwgcGF0aCwgdXJsKTtcbiAgICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlc3VsdCA/IHBhdGhUb0ZpbGVVUkwocmVzdWx0KSA6IG51bGw7XG4gICAgfSxcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdHJ5UmVzb2x2ZShcbiAgcmVzb2x2ZTogUmV0dXJuVHlwZTxMb2FkZXJDb250ZXh0PHt9PlsnZ2V0UmVzb2x2ZSddPixcbiAgcm9vdDogc3RyaW5nLFxuICB1cmw6IHN0cmluZyxcbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGF3YWl0IHJlc29sdmUocm9vdCwgdXJsKTtcbiAgfSBjYXRjaCB7XG4gICAgLy8gVHJ5IHRvIHJlc29sdmUgYSBwYXJ0aWFsIGZpbGVcbiAgICAvLyBAdXNlICdAbWF0ZXJpYWwvYnV0dG9uL2J1dHRvbicgYXMgbWRjLWJ1dHRvbjtcbiAgICAvLyBgQG1hdGVyaWFsL2J1dHRvbi9idXR0b25gIC0+IGBAbWF0ZXJpYWwvYnV0dG9uL19idXR0b25gXG4gICAgY29uc3QgbGFzdFNsYXNoSW5kZXggPSB1cmwubGFzdEluZGV4T2YoJy8nKTtcbiAgICBjb25zdCB1bmRlcnNjb3JlSW5kZXggPSBsYXN0U2xhc2hJbmRleCArIDE7XG4gICAgaWYgKHVuZGVyc2NvcmVJbmRleCA+IDAgJiYgdXJsLmNoYXJBdCh1bmRlcnNjb3JlSW5kZXgpICE9PSAnXycpIHtcbiAgICAgIGNvbnN0IHBhcnRpYWxGaWxlVXJsID0gYCR7dXJsLnNsaWNlKDAsIHVuZGVyc2NvcmVJbmRleCl9XyR7dXJsLnNsaWNlKHVuZGVyc2NvcmVJbmRleCl9YDtcblxuICAgICAgcmV0dXJuIHJlc29sdmUocm9vdCwgcGFydGlhbEZpbGVVcmwpLmNhdGNoKCgpID0+IHVuZGVmaW5lZCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cbiJdfQ==