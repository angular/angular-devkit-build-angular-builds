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
const path = __importStar(require("node:path"));
const node_url_1 = require("node:url");
const environment_options_1 = require("../../../utils/environment-options");
const tailwind_1 = require("../../../utils/tailwind");
const sass_service_1 = require("../../sass/sass-service");
const sass_service_legacy_1 = require("../../sass/sass-service-legacy");
const plugins_1 = require("../plugins");
const css_optimizer_plugin_1 = require("../plugins/css-optimizer-plugin");
const styles_webpack_plugin_1 = require("../plugins/styles-webpack-plugin");
const helpers_1 = require("../utils/helpers");
// eslint-disable-next-line max-lines-per-function
async function getStylesConfig(wco) {
    const { root, buildOptions, logger, projectRoot } = wco;
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
    const tailwindConfigPath = await (0, tailwind_1.findTailwindConfigurationFile)(root, projectRoot);
    if (tailwindConfigPath) {
        let tailwindPackagePath;
        try {
            tailwindPackagePath = require.resolve('tailwindcss', { paths: [root] });
        }
        catch {
            const relativeTailwindConfigPath = path.relative(root, tailwindConfigPath);
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
        findFileUrl: async (url, { fromImport, containingUrl }) => {
            if (url.charAt(0) === '.') {
                // Let Sass handle relative imports.
                return null;
            }
            let resolveDir = root;
            if (containingUrl) {
                resolveDir = path.dirname((0, node_url_1.fileURLToPath)(containingUrl));
            }
            const resolve = fromImport ? resolveImport : resolveModule;
            // Try to resolve from root of workspace
            const result = await tryResolve(resolve, resolveDir, url);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvd2VicGFjay9jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHNGQUEyRDtBQUMzRCxnREFBa0M7QUFDbEMsdUNBQXdEO0FBSXhELDRFQUFtRTtBQUNuRSxzREFBd0U7QUFDeEUsMERBQW1FO0FBQ25FLHdFQUFnRjtBQUNoRix3Q0FLb0I7QUFDcEIsMEVBQXFFO0FBQ3JFLDRFQUF1RTtBQUN2RSw4Q0FJMEI7QUFFMUIsa0RBQWtEO0FBQzNDLEtBQUssVUFBVSxlQUFlLENBQUMsR0FBeUI7SUFDN0QsTUFBTSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxHQUFHLEdBQUcsQ0FBQztJQUN4RCxNQUFNLFlBQVksR0FBNkIsRUFBRSxDQUFDO0lBRWxELFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSx3Q0FBOEIsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUU1RSxNQUFNLFlBQVksR0FBRyxZQUFZLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztJQUVuRCw0QkFBNEI7SUFDNUIsTUFBTSxVQUFVLEdBQUcsSUFBQSw2QkFBbUIsRUFBQyxZQUFZLENBQUMsYUFBYSxDQUFDLENBQUM7SUFFbkUsa0NBQWtDO0lBQ2xDLE1BQU0sWUFBWSxHQUNoQixZQUFZLENBQUMsd0JBQXdCLEVBQUUsWUFBWSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7SUFFL0YseUJBQXlCO0lB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LElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDN0Q7S0FDRjtJQUVELE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IE1pbmlDc3NFeHRyYWN0UGx1Z2luIGZyb20gJ21pbmktY3NzLWV4dHJhY3QtcGx1Z2luJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgdHlwZSB7IEZpbGVJbXBvcnRlciB9IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHR5cGUgeyBDb25maWd1cmF0aW9uLCBMb2FkZXJDb250ZXh0LCBSdWxlU2V0VXNlSXRlbSB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IHVzZUxlZ2FjeVNhc3MgfSBmcm9tICcuLi8uLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IGZpbmRUYWlsd2luZENvbmZpZ3VyYXRpb25GaWxlIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvdGFpbHdpbmQnO1xuaW1wb3J0IHsgU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uIH0gZnJvbSAnLi4vLi4vc2Fzcy9zYXNzLXNlcnZpY2UnO1xuaW1wb3J0IHsgU2Fzc0xlZ2FjeVdvcmtlckltcGxlbWVudGF0aW9uIH0gZnJvbSAnLi4vLi4vc2Fzcy9zYXNzLXNlcnZpY2UtbGVnYWN5JztcbmltcG9ydCB7XG4gIEFueUNvbXBvbmVudFN0eWxlQnVkZ2V0Q2hlY2tlcixcbiAgUG9zdGNzc0NsaVJlc291cmNlcyxcbiAgUmVtb3ZlSGFzaFBsdWdpbixcbiAgU3VwcHJlc3NFeHRyYWN0ZWRUZXh0Q2h1bmtzV2VicGFja1BsdWdpbixcbn0gZnJvbSAnLi4vcGx1Z2lucyc7XG5pbXBvcnQgeyBDc3NPcHRpbWl6ZXJQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL2Nzcy1vcHRpbWl6ZXItcGx1Z2luJztcbmltcG9ydCB7IFN0eWxlc1dlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi9wbHVnaW5zL3N0eWxlcy13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQge1xuICBhc3NldE5hbWVUZW1wbGF0ZUZhY3RvcnksXG4gIGdldE91dHB1dEhhc2hGb3JtYXQsXG4gIG5vcm1hbGl6ZUdsb2JhbFN0eWxlcyxcbn0gZnJvbSAnLi4vdXRpbHMvaGVscGVycyc7XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0U3R5bGVzQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpOiBQcm9taXNlPENvbmZpZ3VyYXRpb24+IHtcbiAgY29uc3QgeyByb290LCBidWlsZE9wdGlvbnMsIGxvZ2dlciwgcHJvamVjdFJvb3QgfSA9IHdjbztcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiBDb25maWd1cmF0aW9uWydwbHVnaW5zJ10gPSBbXTtcblxuICBleHRyYVBsdWdpbnMucHVzaChuZXcgQW55Q29tcG9uZW50U3R5bGVCdWRnZXRDaGVja2VyKGJ1aWxkT3B0aW9ucy5idWRnZXRzKSk7XG5cbiAgY29uc3QgY3NzU291cmNlTWFwID0gYnVpbGRPcHRpb25zLnNvdXJjZU1hcC5zdHlsZXM7XG5cbiAgLy8gRGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0LlxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyk7XG5cbiAgLy8gdXNlIGluY2x1ZGVQYXRocyBmcm9tIGFwcENvbmZpZ1xuICBjb25zdCBpbmNsdWRlUGF0aHMgPVxuICAgIGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocz8ubWFwKChwKSA9PiBwYXRoLnJlc29sdmUocm9vdCwgcCkpID8/IFtdO1xuXG4gIC8vIFByb2Nlc3MgZ2xvYmFsIHN0eWxlcy5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdHlsZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHsgZW50cnlQb2ludHMsIG5vSW5qZWN0TmFtZXMgfSA9IG5vcm1hbGl6ZUdsb2JhbFN0eWxlcyhidWlsZE9wdGlvbnMuc3R5bGVzKTtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBTdHlsZXNXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgcm9vdCxcbiAgICAgICAgZW50cnlQb2ludHMsXG4gICAgICAgIHByZXNlcnZlU3ltbGlua3M6IGJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIGlmIChub0luamVjdE5hbWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIEFkZCBwbHVnaW4gdG8gcmVtb3ZlIGhhc2hlcyBmcm9tIGxhenkgc3R5bGVzLlxuICAgICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFJlbW92ZUhhc2hQbHVnaW4oeyBjaHVua05hbWVzOiBub0luamVjdE5hbWVzLCBoYXNoRm9ybWF0IH0pKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBzYXNzSW1wbGVtZW50YXRpb24gPSB1c2VMZWdhY3lTYXNzXG4gICAgPyBuZXcgU2Fzc0xlZ2FjeVdvcmtlckltcGxlbWVudGF0aW9uKClcbiAgICA6IG5ldyBTYXNzV29ya2VySW1wbGVtZW50YXRpb24oKTtcblxuICBleHRyYVBsdWdpbnMucHVzaCh7XG4gICAgYXBwbHkoY29tcGlsZXIpIHtcbiAgICAgIGNvbXBpbGVyLmhvb2tzLnNodXRkb3duLnRhcCgnc2Fzcy13b3JrZXInLCAoKSA9PiB7XG4gICAgICAgIHNhc3NJbXBsZW1lbnRhdGlvbi5jbG9zZSgpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG5cbiAgY29uc3QgYXNzZXROYW1lVGVtcGxhdGUgPSBhc3NldE5hbWVUZW1wbGF0ZUZhY3RvcnkoaGFzaEZvcm1hdCk7XG5cbiAgY29uc3QgZXh0cmFQb3N0Y3NzUGx1Z2luczogaW1wb3J0KCdwb3N0Y3NzJykuUGx1Z2luW10gPSBbXTtcblxuICAvLyBBdHRlbXB0IHRvIHNldHVwIFRhaWx3aW5kIENTU1xuICAvLyBPbmx5IGxvYWQgVGFpbHdpbmQgQ1NTIHBsdWdpbiBpZiBjb25maWd1cmF0aW9uIGZpbGUgd2FzIGZvdW5kLlxuICAvLyBUaGlzIGFjdHMgYXMgYSBndWFyZCB0byBlbnN1cmUgdGhlIHByb2plY3QgYWN0dWFsbHkgd2FudHMgdG8gdXNlIFRhaWx3aW5kIENTUy5cbiAgLy8gVGhlIHBhY2thZ2UgbWF5IGJlIHVua25vd25pbmdseSBwcmVzZW50IGR1ZSB0byBhIHRoaXJkLXBhcnR5IHRyYW5zaXRpdmUgcGFja2FnZSBkZXBlbmRlbmN5LlxuICBjb25zdCB0YWlsd2luZENvbmZpZ1BhdGggPSBhd2FpdCBmaW5kVGFpbHdpbmRDb25maWd1cmF0aW9uRmlsZShyb290LCBwcm9qZWN0Um9vdCk7XG4gIGlmICh0YWlsd2luZENvbmZpZ1BhdGgpIHtcbiAgICBsZXQgdGFpbHdpbmRQYWNrYWdlUGF0aDtcbiAgICB0cnkge1xuICAgICAgdGFpbHdpbmRQYWNrYWdlUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgndGFpbHdpbmRjc3MnLCB7IHBhdGhzOiBbcm9vdF0gfSk7XG4gICAgfSBjYXRjaCB7XG4gICAgICBjb25zdCByZWxhdGl2ZVRhaWx3aW5kQ29uZmlnUGF0aCA9IHBhdGgucmVsYXRpdmUocm9vdCwgdGFpbHdpbmRDb25maWdQYXRoKTtcbiAgICAgIGxvZ2dlci53YXJuKFxuICAgICAgICBgVGFpbHdpbmQgQ1NTIGNvbmZpZ3VyYXRpb24gZmlsZSBmb3VuZCAoJHtyZWxhdGl2ZVRhaWx3aW5kQ29uZmlnUGF0aH0pYCArXG4gICAgICAgICAgYCBidXQgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZSBpcyBub3QgaW5zdGFsbGVkLmAgK1xuICAgICAgICAgIGAgVG8gZW5hYmxlIFRhaWx3aW5kIENTUywgcGxlYXNlIGluc3RhbGwgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZS5gLFxuICAgICAgKTtcbiAgICB9XG4gICAgaWYgKHRhaWx3aW5kUGFja2FnZVBhdGgpIHtcbiAgICAgIGV4dHJhUG9zdGNzc1BsdWdpbnMucHVzaChyZXF1aXJlKHRhaWx3aW5kUGFja2FnZVBhdGgpKHsgY29uZmlnOiB0YWlsd2luZENvbmZpZ1BhdGggfSkpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGF1dG9wcmVmaXhlcjogdHlwZW9mIGltcG9ydCgnYXV0b3ByZWZpeGVyJykgPSByZXF1aXJlKCdhdXRvcHJlZml4ZXInKTtcblxuICBjb25zdCBwb3N0Y3NzT3B0aW9uc0NyZWF0b3IgPSAoaW5saW5lU291cmNlbWFwczogYm9vbGVhbiwgZXh0cmFjdGVkOiBib29sZWFuKSA9PiB7XG4gICAgY29uc3Qgb3B0aW9uR2VuZXJhdG9yID0gKGxvYWRlcjogTG9hZGVyQ29udGV4dDx1bmtub3duPikgPT4gKHtcbiAgICAgIG1hcDogaW5saW5lU291cmNlbWFwc1xuICAgICAgICA/IHtcbiAgICAgICAgICAgIGlubGluZTogdHJ1ZSxcbiAgICAgICAgICAgIGFubm90YXRpb246IGZhbHNlLFxuICAgICAgICAgIH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICBwbHVnaW5zOiBbXG4gICAgICAgIFBvc3Rjc3NDbGlSZXNvdXJjZXMoe1xuICAgICAgICAgIGJhc2VIcmVmOiBidWlsZE9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgICAgZGVwbG95VXJsOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgICAgIHJlc291cmNlc091dHB1dFBhdGg6IGJ1aWxkT3B0aW9ucy5yZXNvdXJjZXNPdXRwdXRQYXRoLFxuICAgICAgICAgIGxvYWRlcixcbiAgICAgICAgICBmaWxlbmFtZTogYXNzZXROYW1lVGVtcGxhdGUsXG4gICAgICAgICAgZW1pdEZpbGU6IGJ1aWxkT3B0aW9ucy5wbGF0Zm9ybSAhPT0gJ3NlcnZlcicsXG4gICAgICAgICAgZXh0cmFjdGVkLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uZXh0cmFQb3N0Y3NzUGx1Z2lucyxcbiAgICAgICAgYXV0b3ByZWZpeGVyKHtcbiAgICAgICAgICBpZ25vcmVVbmtub3duVmVyc2lvbnM6IHRydWUsXG4gICAgICAgICAgb3ZlcnJpZGVCcm93c2Vyc2xpc3Q6IGJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2VycyxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuICAgIC8vIHBvc3Rjc3MtbG9hZGVyIGZhaWxzIHdoZW4gdHJ5aW5nIHRvIGRldGVybWluZSBjb25maWd1cmF0aW9uIGZpbGVzIGZvciBkYXRhIFVSSXNcbiAgICBvcHRpb25HZW5lcmF0b3IuY29uZmlnID0gZmFsc2U7XG5cbiAgICByZXR1cm4gb3B0aW9uR2VuZXJhdG9yO1xuICB9O1xuXG4gIGxldCBjb21wb25lbnRzU291cmNlTWFwID0gISFjc3NTb3VyY2VNYXA7XG4gIGlmIChjc3NTb3VyY2VNYXApIHtcbiAgICBpZiAoYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbi5zdHlsZXMubWluaWZ5KSB7XG4gICAgICAvLyBOZXZlciB1c2UgY29tcG9uZW50IGNzcyBzb3VyY2VtYXAgd2hlbiBzdHlsZSBvcHRpbWl6YXRpb25zIGFyZSBvbi5cbiAgICAgIC8vIEl0IHdpbGwganVzdCBpbmNyZWFzZSBidW5kbGUgc2l6ZSB3aXRob3V0IG9mZmVyaW5nIGdvb2QgZGVidWcgZXhwZXJpZW5jZS5cbiAgICAgIGxvZ2dlci53YXJuKFxuICAgICAgICAnQ29tcG9uZW50cyBzdHlsZXMgc291cmNlbWFwcyBhcmUgbm90IGdlbmVyYXRlZCB3aGVuIHN0eWxlcyBvcHRpbWl6YXRpb24gaXMgZW5hYmxlZC4nLFxuICAgICAgKTtcbiAgICAgIGNvbXBvbmVudHNTb3VyY2VNYXAgPSBmYWxzZTtcbiAgICB9IGVsc2UgaWYgKGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAuaGlkZGVuKSB7XG4gICAgICAvLyBJbmxpbmUgYWxsIHNvdXJjZW1hcCB0eXBlcyBleGNlcHQgaGlkZGVuIG9uZXMsIHdoaWNoIGFyZSB0aGUgc2FtZSBhcyBubyBzb3VyY2VtYXBzXG4gICAgICAvLyBmb3IgY29tcG9uZW50IGNzcy5cbiAgICAgIGxvZ2dlci53YXJuKCdDb21wb25lbnRzIHN0eWxlcyBzb3VyY2VtYXBzIGFyZSBub3QgZ2VuZXJhdGVkIHdoZW4gc291cmNlbWFwcyBhcmUgaGlkZGVuLicpO1xuICAgICAgY29tcG9uZW50c1NvdXJjZU1hcCA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8vIGV4dHJhY3QgZ2xvYmFsIGNzcyBmcm9tIGpzIGZpbGVzIGludG8gb3duIGNzcyBmaWxlLlxuICBleHRyYVBsdWdpbnMucHVzaChuZXcgTWluaUNzc0V4dHJhY3RQbHVnaW4oeyBmaWxlbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5leHRyYWN0fS5jc3NgIH0pKTtcblxuICBpZiAoIWJ1aWxkT3B0aW9ucy5obXIpIHtcbiAgICAvLyBkb24ndCByZW1vdmUgYC5qc2AgZmlsZXMgZm9yIGAuY3NzYCB3aGVuIHdlIGFyZSB1c2luZyBITVIgdGhlc2UgY29udGFpbiBITVIgYWNjZXB0IGNvZGVzLlxuICAgIC8vIHN1cHByZXNzIGVtcHR5IC5qcyBmaWxlcyBpbiBjc3Mgb25seSBlbnRyeSBwb2ludHMuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4oKSk7XG4gIH1cblxuICBjb25zdCBwb3N0Q3NzID0gcmVxdWlyZSgncG9zdGNzcycpO1xuICBjb25zdCBwb3N0Q3NzTG9hZGVyUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgncG9zdGNzcy1sb2FkZXInKTtcblxuICBjb25zdCBjb21wb25lbnRTdHlsZUxvYWRlcnM6IFJ1bGVTZXRVc2VJdGVtW10gPSBbXG4gICAge1xuICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ2Nzcy1sb2FkZXInKSxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgdXJsOiBmYWxzZSxcbiAgICAgICAgc291cmNlTWFwOiBjb21wb25lbnRzU291cmNlTWFwLFxuICAgICAgICBpbXBvcnRMb2FkZXJzOiAxLFxuICAgICAgICBleHBvcnRUeXBlOiAnc3RyaW5nJyxcbiAgICAgICAgZXNNb2R1bGU6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGxvYWRlcjogcG9zdENzc0xvYWRlclBhdGgsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBwb3N0Q3NzLFxuICAgICAgICBwb3N0Y3NzT3B0aW9uczogcG9zdGNzc09wdGlvbnNDcmVhdG9yKGNvbXBvbmVudHNTb3VyY2VNYXAsIGZhbHNlKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgXTtcblxuICBjb25zdCBnbG9iYWxTdHlsZUxvYWRlcnM6IFJ1bGVTZXRVc2VJdGVtW10gPSBbXG4gICAge1xuICAgICAgbG9hZGVyOiBNaW5pQ3NzRXh0cmFjdFBsdWdpbi5sb2FkZXIsXG4gICAgfSxcbiAgICB7XG4gICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnY3NzLWxvYWRlcicpLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICB1cmw6IGZhbHNlLFxuICAgICAgICBzb3VyY2VNYXA6ICEhY3NzU291cmNlTWFwLFxuICAgICAgICBpbXBvcnRMb2FkZXJzOiAxLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGxvYWRlcjogcG9zdENzc0xvYWRlclBhdGgsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGltcGxlbWVudGF0aW9uOiBwb3N0Q3NzLFxuICAgICAgICBwb3N0Y3NzT3B0aW9uczogcG9zdGNzc09wdGlvbnNDcmVhdG9yKGZhbHNlLCB0cnVlKSxcbiAgICAgICAgc291cmNlTWFwOiAhIWNzc1NvdXJjZU1hcCxcbiAgICAgIH0sXG4gICAgfSxcbiAgXTtcblxuICBjb25zdCBzdHlsZUxhbmd1YWdlczoge1xuICAgIGV4dGVuc2lvbnM6IHN0cmluZ1tdO1xuICAgIHVzZTogUnVsZVNldFVzZUl0ZW1bXTtcbiAgfVtdID0gW1xuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnY3NzJ10sXG4gICAgICB1c2U6IFtdLFxuICAgIH0sXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydzY3NzJ10sXG4gICAgICB1c2U6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdyZXNvbHZlLXVybC1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Nhc3MtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczogZ2V0U2Fzc0xvYWRlck9wdGlvbnMoXG4gICAgICAgICAgICByb290LFxuICAgICAgICAgICAgc2Fzc0ltcGxlbWVudGF0aW9uLFxuICAgICAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICAhIWJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAgICAgISFidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgICAgICApLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnc2FzcyddLFxuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgncmVzb2x2ZS11cmwtbG9hZGVyJyksXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdzYXNzLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IGdldFNhc3NMb2FkZXJPcHRpb25zKFxuICAgICAgICAgICAgcm9vdCxcbiAgICAgICAgICAgIHNhc3NJbXBsZW1lbnRhdGlvbixcbiAgICAgICAgICAgIGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAgIHRydWUsXG4gICAgICAgICAgICAhIWJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAgICAgISFidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgICAgICApLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnbGVzcyddLFxuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnbGVzcy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBpbXBsZW1lbnRhdGlvbjogcmVxdWlyZSgnbGVzcycpLFxuICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgICBsZXNzT3B0aW9uczoge1xuICAgICAgICAgICAgICBqYXZhc2NyaXB0RW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgcGF0aHM6IGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgXTtcblxuICByZXR1cm4ge1xuICAgIG1vZHVsZToge1xuICAgICAgcnVsZXM6IHN0eWxlTGFuZ3VhZ2VzLm1hcCgoeyBleHRlbnNpb25zLCB1c2UgfSkgPT4gKHtcbiAgICAgICAgdGVzdDogbmV3IFJlZ0V4cChgXFxcXC4oPzoke2V4dGVuc2lvbnMuam9pbignfCcpfSkkYCwgJ2knKSxcbiAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAvLyBTZXR1cCBwcm9jZXNzaW5nIHJ1bGVzIGZvciBnbG9iYWwgYW5kIGNvbXBvbmVudCBzdHlsZXNcbiAgICAgICAgICB7XG4gICAgICAgICAgICBvbmVPZjogW1xuICAgICAgICAgICAgICAvLyBHbG9iYWwgc3R5bGVzIGFyZSBvbmx5IGRlZmluZWQgZ2xvYmFsIHN0eWxlc1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdXNlOiBnbG9iYWxTdHlsZUxvYWRlcnMsXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VRdWVyeTogL1xcP25nR2xvYmFsU3R5bGUvLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzIGFyZSBhbGwgc3R5bGVzIGV4Y2VwdCBkZWZpbmVkIGdsb2JhbCBzdHlsZXNcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVzZTogY29tcG9uZW50U3R5bGVMb2FkZXJzLFxuICAgICAgICAgICAgICAgIHJlc291cmNlUXVlcnk6IC9cXD9uZ1Jlc291cmNlLyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7IHVzZSB9LFxuICAgICAgICBdLFxuICAgICAgfSkpLFxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICBtaW5pbWl6ZXI6IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24uc3R5bGVzLm1pbmlmeVxuICAgICAgICA/IFtcbiAgICAgICAgICAgIG5ldyBDc3NPcHRpbWl6ZXJQbHVnaW4oe1xuICAgICAgICAgICAgICBzdXBwb3J0ZWRCcm93c2VyczogYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICB9LFxuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2lucyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0U2Fzc0xvYWRlck9wdGlvbnMoXG4gIHJvb3Q6IHN0cmluZyxcbiAgaW1wbGVtZW50YXRpb246IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbiB8IFNhc3NMZWdhY3lXb3JrZXJJbXBsZW1lbnRhdGlvbixcbiAgaW5jbHVkZVBhdGhzOiBzdHJpbmdbXSxcbiAgaW5kZW50ZWRTeW50YXg6IGJvb2xlYW4sXG4gIHZlcmJvc2U6IGJvb2xlYW4sXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4sXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiBpbXBsZW1lbnRhdGlvbiBpbnN0YW5jZW9mIFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvblxuICAgID8ge1xuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgIGFwaTogJ21vZGVybicsXG4gICAgICAgIGltcGxlbWVudGF0aW9uLFxuICAgICAgICAvLyBXZWJwYWNrIGltcG9ydGVyIGlzIG9ubHkgaW1wbGVtZW50ZWQgaW4gdGhlIGxlZ2FjeSBBUEkgYW5kIHdlIGhhdmUgb3VyIG93biBjdXN0b20gV2VicGFjayBpbXBvcnRlci5cbiAgICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3Nhc3MtbG9hZGVyL2Jsb2IvOTk3ZjNlYjQxZDg2ZGQwMGQ1ZmE0OWMzOTVhMWFlYjQxNTczMTA4Yy9zcmMvdXRpbHMuanMjTDY0Mi1MNjUxXG4gICAgICAgIHdlYnBhY2tJbXBvcnRlcjogZmFsc2UsXG4gICAgICAgIHNhc3NPcHRpb25zOiAobG9hZGVyQ29udGV4dDogTG9hZGVyQ29udGV4dDx7fT4pID0+ICh7XG4gICAgICAgICAgaW1wb3J0ZXJzOiBbZ2V0U2Fzc1Jlc29sdXRpb25JbXBvcnRlcihsb2FkZXJDb250ZXh0LCByb290LCBwcmVzZXJ2ZVN5bWxpbmtzKV0sXG4gICAgICAgICAgbG9hZFBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgLy8gVXNlIGV4cGFuZGVkIGFzIG90aGVyd2lzZSBzYXNzIHdpbGwgcmVtb3ZlIGNvbW1lbnRzIHRoYXQgYXJlIG5lZWRlZCBmb3IgYXV0b3ByZWZpeGVyXG4gICAgICAgICAgLy8gRXg6IC8qIGF1dG9wcmVmaXhlciBncmlkOiBhdXRvcGxhY2UgKi9cbiAgICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc2Fzcy1sb2FkZXIvYmxvYi80NWFkMGJlMTcyNjRjZWFkYTVmMGI0ZmI4N2U5MzU3YWJlODVjNGZmL3NyYy9nZXRTYXNzT3B0aW9ucy5qcyNMNjgtTDcwXG4gICAgICAgICAgc3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICAgICAgLy8gU2lsZW5jZXMgY29tcGlsZXIgd2FybmluZ3MgZnJvbSAzcmQgcGFydHkgc3R5bGVzaGVldHNcbiAgICAgICAgICBxdWlldERlcHM6ICF2ZXJib3NlLFxuICAgICAgICAgIHZlcmJvc2UsXG4gICAgICAgICAgc3ludGF4OiBpbmRlbnRlZFN5bnRheCA/ICdpbmRlbnRlZCcgOiAnc2NzcycsXG4gICAgICAgICAgc291cmNlTWFwSW5jbHVkZVNvdXJjZXM6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgfVxuICAgIDoge1xuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgIGFwaTogJ2xlZ2FjeScsXG4gICAgICAgIGltcGxlbWVudGF0aW9uLFxuICAgICAgICBzYXNzT3B0aW9uczoge1xuICAgICAgICAgIGltcG9ydGVyOiAodXJsOiBzdHJpbmcsIGZyb206IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgaWYgKHVybC5jaGFyQXQoMCkgPT09ICd+Jykge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYCcke2Zyb219JyBpbXBvcnRzICcke3VybH0nIHdpdGggYSB0aWxkZS4gVXNhZ2Ugb2YgJ34nIGluIGltcG9ydHMgaXMgbm8gbG9uZ2VyIHN1cHBvcnRlZC5gLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9LFxuICAgICAgICAgIC8vIFByZXZlbnQgdXNlIG9mIGBmaWJlcnNgIHBhY2thZ2UgYXMgaXQgbm8gbG9uZ2VyIHdvcmtzIGluIG5ld2VyIE5vZGUuanMgdmVyc2lvbnNcbiAgICAgICAgICBmaWJlcjogZmFsc2UsXG4gICAgICAgICAgaW5kZW50ZWRTeW50YXgsXG4gICAgICAgICAgLy8gYm9vdHN0cmFwLXNhc3MgcmVxdWlyZXMgYSBtaW5pbXVtIHByZWNpc2lvbiBvZiA4XG4gICAgICAgICAgcHJlY2lzaW9uOiA4LFxuICAgICAgICAgIGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAvLyBVc2UgZXhwYW5kZWQgYXMgb3RoZXJ3aXNlIHNhc3Mgd2lsbCByZW1vdmUgY29tbWVudHMgdGhhdCBhcmUgbmVlZGVkIGZvciBhdXRvcHJlZml4ZXJcbiAgICAgICAgICAvLyBFeDogLyogYXV0b3ByZWZpeGVyIGdyaWQ6IGF1dG9wbGFjZSAqL1xuICAgICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zYXNzLWxvYWRlci9ibG9iLzQ1YWQwYmUxNzI2NGNlYWRhNWYwYjRmYjg3ZTkzNTdhYmU4NWM0ZmYvc3JjL2dldFNhc3NPcHRpb25zLmpzI0w2OC1MNzBcbiAgICAgICAgICBvdXRwdXRTdHlsZTogJ2V4cGFuZGVkJyxcbiAgICAgICAgICAvLyBTaWxlbmNlcyBjb21waWxlciB3YXJuaW5ncyBmcm9tIDNyZCBwYXJ0eSBzdHlsZXNoZWV0c1xuICAgICAgICAgIHF1aWV0RGVwczogIXZlcmJvc2UsXG4gICAgICAgICAgdmVyYm9zZSxcbiAgICAgICAgfSxcbiAgICAgIH07XG59XG5cbmZ1bmN0aW9uIGdldFNhc3NSZXNvbHV0aW9uSW1wb3J0ZXIoXG4gIGxvYWRlckNvbnRleHQ6IExvYWRlckNvbnRleHQ8e30+LFxuICByb290OiBzdHJpbmcsXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4sXG4pOiBGaWxlSW1wb3J0ZXI8J2FzeW5jJz4ge1xuICBjb25zdCBjb21tb25SZXNvbHZlck9wdGlvbnM6IFBhcmFtZXRlcnM8KHR5cGVvZiBsb2FkZXJDb250ZXh0KVsnZ2V0UmVzb2x2ZSddPlswXSA9IHtcbiAgICBjb25kaXRpb25OYW1lczogWydzYXNzJywgJ3N0eWxlJ10sXG4gICAgbWFpbkZpZWxkczogWydzYXNzJywgJ3N0eWxlJywgJ21haW4nLCAnLi4uJ10sXG4gICAgZXh0ZW5zaW9uczogWycuc2NzcycsICcuc2FzcycsICcuY3NzJ10sXG4gICAgcmVzdHJpY3Rpb25zOiBbL1xcLigoc2F8c2N8YylzcykkL2ldLFxuICAgIHByZWZlclJlbGF0aXZlOiB0cnVlLFxuICAgIHN5bWxpbmtzOiAhcHJlc2VydmVTeW1saW5rcyxcbiAgfTtcblxuICAvLyBTYXNzIGFsc28gc3VwcG9ydHMgaW1wb3J0LW9ubHkgZmlsZXMuIElmIHlvdSBuYW1lIGEgZmlsZSA8bmFtZT4uaW1wb3J0LnNjc3MsIGl0IHdpbGwgb25seSBiZSBsb2FkZWQgZm9yIGltcG9ydHMsIG5vdCBmb3IgQHVzZXMuXG4gIC8vIFNlZTogaHR0cHM6Ly9zYXNzLWxhbmcuY29tL2RvY3VtZW50YXRpb24vYXQtcnVsZXMvaW1wb3J0I2ltcG9ydC1vbmx5LWZpbGVzXG4gIGNvbnN0IHJlc29sdmVJbXBvcnQgPSBsb2FkZXJDb250ZXh0LmdldFJlc29sdmUoe1xuICAgIC4uLmNvbW1vblJlc29sdmVyT3B0aW9ucyxcbiAgICBkZXBlbmRlbmN5VHlwZTogJ3Nhc3MtaW1wb3J0JyxcbiAgICBtYWluRmlsZXM6IFsnX2luZGV4LmltcG9ydCcsICdfaW5kZXgnLCAnaW5kZXguaW1wb3J0JywgJ2luZGV4JywgJy4uLiddLFxuICB9KTtcblxuICBjb25zdCByZXNvbHZlTW9kdWxlID0gbG9hZGVyQ29udGV4dC5nZXRSZXNvbHZlKHtcbiAgICAuLi5jb21tb25SZXNvbHZlck9wdGlvbnMsXG4gICAgZGVwZW5kZW5jeVR5cGU6ICdzYXNzLW1vZHVsZScsXG4gICAgbWFpbkZpbGVzOiBbJ19pbmRleCcsICdpbmRleCcsICcuLi4nXSxcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBmaW5kRmlsZVVybDogYXN5bmMgKHVybCwgeyBmcm9tSW1wb3J0LCBjb250YWluaW5nVXJsIH0pOiBQcm9taXNlPFVSTCB8IG51bGw+ID0+IHtcbiAgICAgIGlmICh1cmwuY2hhckF0KDApID09PSAnLicpIHtcbiAgICAgICAgLy8gTGV0IFNhc3MgaGFuZGxlIHJlbGF0aXZlIGltcG9ydHMuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBsZXQgcmVzb2x2ZURpciA9IHJvb3Q7XG4gICAgICBpZiAoY29udGFpbmluZ1VybCkge1xuICAgICAgICByZXNvbHZlRGlyID0gcGF0aC5kaXJuYW1lKGZpbGVVUkxUb1BhdGgoY29udGFpbmluZ1VybCkpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZXNvbHZlID0gZnJvbUltcG9ydCA/IHJlc29sdmVJbXBvcnQgOiByZXNvbHZlTW9kdWxlO1xuICAgICAgLy8gVHJ5IHRvIHJlc29sdmUgZnJvbSByb290IG9mIHdvcmtzcGFjZVxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdHJ5UmVzb2x2ZShyZXNvbHZlLCByZXNvbHZlRGlyLCB1cmwpO1xuXG4gICAgICByZXR1cm4gcmVzdWx0ID8gcGF0aFRvRmlsZVVSTChyZXN1bHQpIDogbnVsbDtcbiAgICB9LFxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiB0cnlSZXNvbHZlKFxuICByZXNvbHZlOiBSZXR1cm5UeXBlPExvYWRlckNvbnRleHQ8e30+WydnZXRSZXNvbHZlJ10+LFxuICByb290OiBzdHJpbmcsXG4gIHVybDogc3RyaW5nLFxuKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgcmVzb2x2ZShyb290LCB1cmwpO1xuICB9IGNhdGNoIHtcbiAgICAvLyBUcnkgdG8gcmVzb2x2ZSBhIHBhcnRpYWwgZmlsZVxuICAgIC8vIEB1c2UgJ0BtYXRlcmlhbC9idXR0b24vYnV0dG9uJyBhcyBtZGMtYnV0dG9uO1xuICAgIC8vIGBAbWF0ZXJpYWwvYnV0dG9uL2J1dHRvbmAgLT4gYEBtYXRlcmlhbC9idXR0b24vX2J1dHRvbmBcbiAgICBjb25zdCBsYXN0U2xhc2hJbmRleCA9IHVybC5sYXN0SW5kZXhPZignLycpO1xuICAgIGNvbnN0IHVuZGVyc2NvcmVJbmRleCA9IGxhc3RTbGFzaEluZGV4ICsgMTtcbiAgICBpZiAodW5kZXJzY29yZUluZGV4ID4gMCAmJiB1cmwuY2hhckF0KHVuZGVyc2NvcmVJbmRleCkgIT09ICdfJykge1xuICAgICAgY29uc3QgcGFydGlhbEZpbGVVcmwgPSBgJHt1cmwuc2xpY2UoMCwgdW5kZXJzY29yZUluZGV4KX1fJHt1cmwuc2xpY2UodW5kZXJzY29yZUluZGV4KX1gO1xuXG4gICAgICByZXR1cm4gcmVzb2x2ZShyb290LCBwYXJ0aWFsRmlsZVVybCkuY2F0Y2goKCkgPT4gdW5kZWZpbmVkKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuIl19