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
const url_1 = require("url");
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
    const { root, projectRoot, buildOptions } = wco;
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
        findFileUrl: async (url, { fromImport }) => {
            if (url.charAt(0) === '.') {
                // Let Sass handle relative imports.
                return null;
            }
            let file;
            const resolve = fromImport ? resolveImport : resolveModule;
            try {
                file = await resolve(root, url);
            }
            catch (_a) {
                // Try to resolve a partial file
                // @use '@material/button/button' as mdc-button;
                // `@material/button/button` -> `@material/button/_button`
                const lastSlashIndex = url.lastIndexOf('/');
                const underscoreIndex = lastSlashIndex + 1;
                if (underscoreIndex > 0 && url.charAt(underscoreIndex) !== '_') {
                    const partialFileUrl = `${url.slice(0, underscoreIndex)}_${url.slice(underscoreIndex)}`;
                    file = await resolve(root, partialFileUrl).catch(() => undefined);
                }
            }
            return file ? (0, url_1.pathToFileURL)(file) : null;
        },
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHVDQUF5QjtBQUN6QixzRkFBMkQ7QUFDM0QsMkNBQTZCO0FBRTdCLDZCQUFvQztBQUdwQywwREFBbUU7QUFDbkUsd0VBQWdGO0FBRWhGLHlFQUFnRTtBQUNoRSx3Q0FLb0I7QUFDcEIsMEVBQXFFO0FBQ3JFLDRFQUF1RTtBQUN2RSw4Q0FLMEI7QUFFMUIsa0RBQWtEO0FBQ2xELFNBQWdCLGVBQWUsQ0FBQyxHQUF5Qjs7SUFDdkQsTUFBTSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ2hELE1BQU0sWUFBWSxHQUE2QixFQUFFLENBQUM7SUFFbEQsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLHdDQUE4QixDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBRTVFLE1BQU0sWUFBWSxHQUFHLFlBQVksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO0lBRW5ELDRCQUE0QjtJQUM1QixNQUFNLFVBQVUsR0FBRyxJQUFBLDZCQUFtQixFQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUVuRSxrQ0FBa0M7SUFDbEMsTUFBTSxZQUFZLEdBQ2hCLE1BQUEsTUFBQSxNQUFBLFlBQVksQ0FBQyx3QkFBd0IsMENBQUUsWUFBWSwwQ0FBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLG1DQUFJLEVBQUUsQ0FBQztJQUUvRix5QkFBeUI7SUFDekIs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LGVBQWUsQ0FBQyxLQUFLLEdBQUcsRUFBRTtvQkFDOUQsTUFBTSxjQUFjLEdBQUcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUM7b0JBQ3hGLElBQUksR0FBRyxNQUFNLE9BQU8sQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2lCQUNuRTthQUNGO1lBRUQsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUEsbUJBQWEsRUFBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQzNDLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgTWluaUNzc0V4dHJhY3RQbHVnaW4gZnJvbSAnbWluaS1jc3MtZXh0cmFjdC1wbHVnaW4nO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0eXBlIHsgRmlsZUltcG9ydGVyIH0gZnJvbSAnc2Fzcyc7XG5pbXBvcnQgeyBwYXRoVG9GaWxlVVJMIH0gZnJvbSAndXJsJztcbmltcG9ydCB0eXBlIHsgQ29uZmlndXJhdGlvbiwgTG9hZGVyQ29udGV4dCwgUnVsZVNldFVzZUl0ZW0gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IFN0eWxlRWxlbWVudCB9IGZyb20gJy4uLy4uL2J1aWxkZXJzL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbiB9IGZyb20gJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlJztcbmltcG9ydCB7IFNhc3NMZWdhY3lXb3JrZXJJbXBsZW1lbnRhdGlvbiB9IGZyb20gJy4uLy4uL3Nhc3Mvc2Fzcy1zZXJ2aWNlLWxlZ2FjeSc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgdXNlTGVnYWN5U2FzcyB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHtcbiAgQW55Q29tcG9uZW50U3R5bGVCdWRnZXRDaGVja2VyLFxuICBQb3N0Y3NzQ2xpUmVzb3VyY2VzLFxuICBSZW1vdmVIYXNoUGx1Z2luLFxuICBTdXBwcmVzc0V4dHJhY3RlZFRleHRDaHVua3NXZWJwYWNrUGx1Z2luLFxufSBmcm9tICcuLi9wbHVnaW5zJztcbmltcG9ydCB7IENzc09wdGltaXplclBsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvY3NzLW9wdGltaXplci1wbHVnaW4nO1xuaW1wb3J0IHsgU3R5bGVzV2VicGFja1BsdWdpbiB9IGZyb20gJy4uL3BsdWdpbnMvc3R5bGVzLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7XG4gIGFzc2V0TmFtZVRlbXBsYXRlRmFjdG9yeSxcbiAgZ2V0T3V0cHV0SGFzaEZvcm1hdCxcbiAgbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyxcbiAgbm9ybWFsaXplR2xvYmFsU3R5bGVzLFxufSBmcm9tICcuLi91dGlscy9oZWxwZXJzJztcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBnZXRTdHlsZXNDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IENvbmZpZ3VyYXRpb24ge1xuICBjb25zdCB7IHJvb3QsIHByb2plY3RSb290LCBidWlsZE9wdGlvbnMgfSA9IHdjbztcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiBDb25maWd1cmF0aW9uWydwbHVnaW5zJ10gPSBbXTtcblxuICBleHRyYVBsdWdpbnMucHVzaChuZXcgQW55Q29tcG9uZW50U3R5bGVCdWRnZXRDaGVja2VyKGJ1aWxkT3B0aW9ucy5idWRnZXRzKSk7XG5cbiAgY29uc3QgY3NzU291cmNlTWFwID0gYnVpbGRPcHRpb25zLnNvdXJjZU1hcC5zdHlsZXM7XG5cbiAgLy8gRGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0LlxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyk7XG5cbiAgLy8gdXNlIGluY2x1ZGVQYXRocyBmcm9tIGFwcENvbmZpZ1xuICBjb25zdCBpbmNsdWRlUGF0aHMgPVxuICAgIGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocz8ubWFwKChwKSA9PiBwYXRoLnJlc29sdmUocm9vdCwgcCkpID8/IFtdO1xuXG4gIC8vIFByb2Nlc3MgZ2xvYmFsIHN0eWxlcy5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdHlsZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHsgZW50cnlQb2ludHMsIG5vSW5qZWN0TmFtZXMgfSA9IG5vcm1hbGl6ZUdsb2JhbFN0eWxlcyhidWlsZE9wdGlvbnMuc3R5bGVzKTtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBTdHlsZXNXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgcm9vdCxcbiAgICAgICAgZW50cnlQb2ludHMsXG4gICAgICAgIHByZXNlcnZlU3ltbGlua3M6IGJ1aWxkT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIGlmIChub0luamVjdE5hbWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIEFkZCBwbHVnaW4gdG8gcmVtb3ZlIGhhc2hlcyBmcm9tIGxhenkgc3R5bGVzLlxuICAgICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFJlbW92ZUhhc2hQbHVnaW4oeyBjaHVua05hbWVzOiBub0luamVjdE5hbWVzLCBoYXNoRm9ybWF0IH0pKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBzYXNzSW1wbGVtZW50YXRpb24gPSB1c2VMZWdhY3lTYXNzXG4gICAgPyBuZXcgU2Fzc0xlZ2FjeVdvcmtlckltcGxlbWVudGF0aW9uKClcbiAgICA6IG5ldyBTYXNzV29ya2VySW1wbGVtZW50YXRpb24oKTtcblxuICBleHRyYVBsdWdpbnMucHVzaCh7XG4gICAgYXBwbHkoY29tcGlsZXIpIHtcbiAgICAgIGNvbXBpbGVyLmhvb2tzLnNodXRkb3duLnRhcCgnc2Fzcy13b3JrZXInLCAoKSA9PiB7XG4gICAgICAgIHNhc3NJbXBsZW1lbnRhdGlvbi5jbG9zZSgpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG5cbiAgY29uc3QgYXNzZXROYW1lVGVtcGxhdGUgPSBhc3NldE5hbWVUZW1wbGF0ZUZhY3RvcnkoaGFzaEZvcm1hdCk7XG5cbiAgY29uc3QgZXh0cmFQb3N0Y3NzUGx1Z2luczogaW1wb3J0KCdwb3N0Y3NzJykuUGx1Z2luW10gPSBbXTtcblxuICAvLyBBdHRlbXB0IHRvIHNldHVwIFRhaWx3aW5kIENTU1xuICAvLyBPbmx5IGxvYWQgVGFpbHdpbmQgQ1NTIHBsdWdpbiBpZiBjb25maWd1cmF0aW9uIGZpbGUgd2FzIGZvdW5kLlxuICAvLyBUaGlzIGFjdHMgYXMgYSBndWFyZCB0byBlbnN1cmUgdGhlIHByb2plY3QgYWN0dWFsbHkgd2FudHMgdG8gdXNlIFRhaWx3aW5kIENTUy5cbiAgLy8gVGhlIHBhY2thZ2UgbWF5IGJlIHVua25vd25pbmdseSBwcmVzZW50IGR1ZSB0byBhIHRoaXJkLXBhcnR5IHRyYW5zaXRpdmUgcGFja2FnZSBkZXBlbmRlbmN5LlxuICBjb25zdCB0YWlsd2luZENvbmZpZ1BhdGggPSBnZXRUYWlsd2luZENvbmZpZ1BhdGgod2NvKTtcbiAgaWYgKHRhaWx3aW5kQ29uZmlnUGF0aCkge1xuICAgIGxldCB0YWlsd2luZFBhY2thZ2VQYXRoO1xuICAgIHRyeSB7XG4gICAgICB0YWlsd2luZFBhY2thZ2VQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCd0YWlsd2luZGNzcycsIHsgcGF0aHM6IFt3Y28ucm9vdF0gfSk7XG4gICAgfSBjYXRjaCB7XG4gICAgICBjb25zdCByZWxhdGl2ZVRhaWx3aW5kQ29uZmlnUGF0aCA9IHBhdGgucmVsYXRpdmUod2NvLnJvb3QsIHRhaWx3aW5kQ29uZmlnUGF0aCk7XG4gICAgICB3Y28ubG9nZ2VyLndhcm4oXG4gICAgICAgIGBUYWlsd2luZCBDU1MgY29uZmlndXJhdGlvbiBmaWxlIGZvdW5kICgke3JlbGF0aXZlVGFpbHdpbmRDb25maWdQYXRofSlgICtcbiAgICAgICAgICBgIGJ1dCB0aGUgJ3RhaWx3aW5kY3NzJyBwYWNrYWdlIGlzIG5vdCBpbnN0YWxsZWQuYCArXG4gICAgICAgICAgYCBUbyBlbmFibGUgVGFpbHdpbmQgQ1NTLCBwbGVhc2UgaW5zdGFsbCB0aGUgJ3RhaWx3aW5kY3NzJyBwYWNrYWdlLmAsXG4gICAgICApO1xuICAgIH1cbiAgICBpZiAodGFpbHdpbmRQYWNrYWdlUGF0aCkge1xuICAgICAgZXh0cmFQb3N0Y3NzUGx1Z2lucy5wdXNoKHJlcXVpcmUodGFpbHdpbmRQYWNrYWdlUGF0aCkoeyBjb25maWc6IHRhaWx3aW5kQ29uZmlnUGF0aCB9KSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgcG9zdGNzc0ltcG9ydHMgPSByZXF1aXJlKCdwb3N0Y3NzLWltcG9ydCcpO1xuICBjb25zdCBhdXRvcHJlZml4ZXI6IHR5cGVvZiBpbXBvcnQoJ2F1dG9wcmVmaXhlcicpID0gcmVxdWlyZSgnYXV0b3ByZWZpeGVyJyk7XG5cbiAgY29uc3QgcG9zdGNzc09wdGlvbnNDcmVhdG9yID0gKGlubGluZVNvdXJjZW1hcHM6IGJvb2xlYW4sIGV4dHJhY3RlZDogYm9vbGVhbikgPT4ge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3Qgb3B0aW9uR2VuZXJhdG9yID0gKGxvYWRlcjogYW55KSA9PiAoe1xuICAgICAgbWFwOiBpbmxpbmVTb3VyY2VtYXBzXG4gICAgICAgID8ge1xuICAgICAgICAgICAgaW5saW5lOiB0cnVlLFxuICAgICAgICAgICAgYW5ub3RhdGlvbjogZmFsc2UsXG4gICAgICAgICAgfVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgIHBsdWdpbnM6IFtcbiAgICAgICAgcG9zdGNzc0ltcG9ydHMoe1xuICAgICAgICAgIGxvYWQ6IChmaWxlbmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgIGxvYWRlci5mcy5yZWFkRmlsZShmaWxlbmFtZSwgKGVycjogRXJyb3IsIGRhdGE6IEJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuXG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGNvbnRlbnQpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgICBQb3N0Y3NzQ2xpUmVzb3VyY2VzKHtcbiAgICAgICAgICBiYXNlSHJlZjogYnVpbGRPcHRpb25zLmJhc2VIcmVmLFxuICAgICAgICAgIGRlcGxveVVybDogYnVpbGRPcHRpb25zLmRlcGxveVVybCxcbiAgICAgICAgICByZXNvdXJjZXNPdXRwdXRQYXRoOiBidWlsZE9wdGlvbnMucmVzb3VyY2VzT3V0cHV0UGF0aCxcbiAgICAgICAgICBsb2FkZXIsXG4gICAgICAgICAgZmlsZW5hbWU6IGFzc2V0TmFtZVRlbXBsYXRlLFxuICAgICAgICAgIGVtaXRGaWxlOiBidWlsZE9wdGlvbnMucGxhdGZvcm0gIT09ICdzZXJ2ZXInLFxuICAgICAgICAgIGV4dHJhY3RlZCxcbiAgICAgICAgfSksXG4gICAgICAgIC4uLmV4dHJhUG9zdGNzc1BsdWdpbnMsXG4gICAgICAgIGF1dG9wcmVmaXhlcih7XG4gICAgICAgICAgaWdub3JlVW5rbm93blZlcnNpb25zOiB0cnVlLFxuICAgICAgICAgIG92ZXJyaWRlQnJvd3NlcnNsaXN0OiBidWlsZE9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcbiAgICAvLyBwb3N0Y3NzLWxvYWRlciBmYWlscyB3aGVuIHRyeWluZyB0byBkZXRlcm1pbmUgY29uZmlndXJhdGlvbiBmaWxlcyBmb3IgZGF0YSBVUklzXG4gICAgb3B0aW9uR2VuZXJhdG9yLmNvbmZpZyA9IGZhbHNlO1xuXG4gICAgcmV0dXJuIG9wdGlvbkdlbmVyYXRvcjtcbiAgfTtcblxuICAvLyBsb2FkIGNvbXBvbmVudCBjc3MgYXMgcmF3IHN0cmluZ3NcbiAgY29uc3QgY29tcG9uZW50c1NvdXJjZU1hcCA9ICEhKFxuICAgIGNzc1NvdXJjZU1hcCAmJlxuICAgIC8vIE5ldmVyIHVzZSBjb21wb25lbnQgY3NzIHNvdXJjZW1hcCB3aGVuIHN0eWxlIG9wdGltaXphdGlvbnMgYXJlIG9uLlxuICAgIC8vIEl0IHdpbGwganVzdCBpbmNyZWFzZSBidW5kbGUgc2l6ZSB3aXRob3V0IG9mZmVyaW5nIGdvb2QgZGVidWcgZXhwZXJpZW5jZS5cbiAgICAhYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbi5zdHlsZXMubWluaWZ5ICYmXG4gICAgLy8gSW5saW5lIGFsbCBzb3VyY2VtYXAgdHlwZXMgZXhjZXB0IGhpZGRlbiBvbmVzLCB3aGljaCBhcmUgdGhlIHNhbWUgYXMgbm8gc291cmNlbWFwc1xuICAgIC8vIGZvciBjb21wb25lbnQgY3NzLlxuICAgICFidWlsZE9wdGlvbnMuc291cmNlTWFwLmhpZGRlblxuICApO1xuXG4gIC8vIGV4dHJhY3QgZ2xvYmFsIGNzcyBmcm9tIGpzIGZpbGVzIGludG8gb3duIGNzcyBmaWxlLlxuICBleHRyYVBsdWdpbnMucHVzaChuZXcgTWluaUNzc0V4dHJhY3RQbHVnaW4oeyBmaWxlbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5leHRyYWN0fS5jc3NgIH0pKTtcblxuICBpZiAoIWJ1aWxkT3B0aW9ucy5obXIpIHtcbiAgICAvLyBkb24ndCByZW1vdmUgYC5qc2AgZmlsZXMgZm9yIGAuY3NzYCB3aGVuIHdlIGFyZSB1c2luZyBITVIgdGhlc2UgY29udGFpbiBITVIgYWNjZXB0IGNvZGVzLlxuICAgIC8vIHN1cHByZXNzIGVtcHR5IC5qcyBmaWxlcyBpbiBjc3Mgb25seSBlbnRyeSBwb2ludHMuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4oKSk7XG4gIH1cblxuICBjb25zdCBwb3N0Q3NzID0gcmVxdWlyZSgncG9zdGNzcycpO1xuICBjb25zdCBwb3N0Q3NzTG9hZGVyUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgncG9zdGNzcy1sb2FkZXInKTtcblxuICBjb25zdCBjb21wb25lbnRTdHlsZUxvYWRlcnM6IFJ1bGVTZXRVc2VJdGVtW10gPSBbXG4gICAge1xuICAgICAgbG9hZGVyOiBwb3N0Q3NzTG9hZGVyUGF0aCxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgaW1wbGVtZW50YXRpb246IHBvc3RDc3MsXG4gICAgICAgIHBvc3Rjc3NPcHRpb25zOiBwb3N0Y3NzT3B0aW9uc0NyZWF0b3IoY29tcG9uZW50c1NvdXJjZU1hcCwgZmFsc2UpLFxuICAgICAgfSxcbiAgICB9LFxuICBdO1xuXG4gIGNvbnN0IGdsb2JhbFN0eWxlTG9hZGVyczogUnVsZVNldFVzZUl0ZW1bXSA9IFtcbiAgICB7XG4gICAgICBsb2FkZXI6IE1pbmlDc3NFeHRyYWN0UGx1Z2luLmxvYWRlcixcbiAgICB9LFxuICAgIHtcbiAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdjc3MtbG9hZGVyJyksXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIHVybDogZmFsc2UsXG4gICAgICAgIHNvdXJjZU1hcDogISFjc3NTb3VyY2VNYXAsXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgbG9hZGVyOiBwb3N0Q3NzTG9hZGVyUGF0aCxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgaW1wbGVtZW50YXRpb246IHBvc3RDc3MsXG4gICAgICAgIHBvc3Rjc3NPcHRpb25zOiBwb3N0Y3NzT3B0aW9uc0NyZWF0b3IoZmFsc2UsIHRydWUpLFxuICAgICAgICBzb3VyY2VNYXA6ICEhY3NzU291cmNlTWFwLFxuICAgICAgfSxcbiAgICB9LFxuICBdO1xuXG4gIGNvbnN0IHN0eWxlTGFuZ3VhZ2VzOiB7XG4gICAgZXh0ZW5zaW9uczogc3RyaW5nW107XG4gICAgdXNlOiBSdWxlU2V0VXNlSXRlbVtdO1xuICB9W10gPSBbXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydjc3MnXSxcbiAgICAgIHVzZTogW10sXG4gICAgfSxcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ3Njc3MnXSxcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Jlc29sdmUtdXJsLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnc2Fzcy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiBnZXRTYXNzTG9hZGVyT3B0aW9ucyhcbiAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICBzYXNzSW1wbGVtZW50YXRpb24sXG4gICAgICAgICAgICBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICFidWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgICAgICEhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICAgICAgKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ3Nhc3MnXSxcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Jlc29sdmUtdXJsLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnc2Fzcy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiBnZXRTYXNzTG9hZGVyT3B0aW9ucyhcbiAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICBzYXNzSW1wbGVtZW50YXRpb24sXG4gICAgICAgICAgICBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICAgIWJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAgICAgISFidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgICAgICApLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnbGVzcyddLFxuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnbGVzcy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBpbXBsZW1lbnRhdGlvbjogcmVxdWlyZSgnbGVzcycpLFxuICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgICBsZXNzT3B0aW9uczoge1xuICAgICAgICAgICAgICBqYXZhc2NyaXB0RW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgcGF0aHM6IGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgXTtcblxuICByZXR1cm4ge1xuICAgIG1vZHVsZToge1xuICAgICAgcnVsZXM6IHN0eWxlTGFuZ3VhZ2VzLm1hcCgoeyBleHRlbnNpb25zLCB1c2UgfSkgPT4gKHtcbiAgICAgICAgdGVzdDogbmV3IFJlZ0V4cChgXFxcXC4oPzoke2V4dGVuc2lvbnMuam9pbignfCcpfSkkYCwgJ2knKSxcbiAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAvLyBTZXR1cCBwcm9jZXNzaW5nIHJ1bGVzIGZvciBnbG9iYWwgYW5kIGNvbXBvbmVudCBzdHlsZXNcbiAgICAgICAgICB7XG4gICAgICAgICAgICBvbmVPZjogW1xuICAgICAgICAgICAgICAvLyBHbG9iYWwgc3R5bGVzIGFyZSBvbmx5IGRlZmluZWQgZ2xvYmFsIHN0eWxlc1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdXNlOiBnbG9iYWxTdHlsZUxvYWRlcnMsXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VRdWVyeTogL1xcP25nR2xvYmFsU3R5bGUvLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzIGFyZSBhbGwgc3R5bGVzIGV4Y2VwdCBkZWZpbmVkIGdsb2JhbCBzdHlsZXNcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVzZTogY29tcG9uZW50U3R5bGVMb2FkZXJzLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhc3NldC9zb3VyY2UnLFxuICAgICAgICAgICAgICAgIHJlc291cmNlUXVlcnk6IC9cXD9uZ1Jlc291cmNlLyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7IHVzZSB9LFxuICAgICAgICBdLFxuICAgICAgfSkpLFxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICBtaW5pbWl6ZXI6IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24uc3R5bGVzLm1pbmlmeVxuICAgICAgICA/IFtcbiAgICAgICAgICAgIG5ldyBDc3NPcHRpbWl6ZXJQbHVnaW4oe1xuICAgICAgICAgICAgICBzdXBwb3J0ZWRCcm93c2VyczogYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICB9LFxuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2lucyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0VGFpbHdpbmRDb25maWdQYXRoKHsgcHJvamVjdFJvb3QsIHJvb3QgfTogV2VicGFja0NvbmZpZ09wdGlvbnMpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAvLyBBIGNvbmZpZ3VyYXRpb24gZmlsZSBjYW4gZXhpc3QgaW4gdGhlIHByb2plY3Qgb3Igd29ya3NwYWNlIHJvb3RcbiAgLy8gVGhlIGxpc3Qgb2YgdmFsaWQgY29uZmlnIGZpbGVzIGNhbiBiZSBmb3VuZDpcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3RhaWx3aW5kbGFicy90YWlsd2luZGNzcy9ibG9iLzg4NDVkMTEyZmI2MmQ3OTgxNWI1MGIzYmFlODBjMzE3NDUwYjhiOTIvc3JjL3V0aWwvcmVzb2x2ZUNvbmZpZ1BhdGguanMjTDQ2LUw1MlxuICBjb25zdCB0YWlsd2luZENvbmZpZ0ZpbGVzID0gWyd0YWlsd2luZC5jb25maWcuanMnLCAndGFpbHdpbmQuY29uZmlnLmNqcyddO1xuICBmb3IgKGNvbnN0IGJhc2VQYXRoIG9mIFtwcm9qZWN0Um9vdCwgcm9vdF0pIHtcbiAgICBmb3IgKGNvbnN0IGNvbmZpZ0ZpbGUgb2YgdGFpbHdpbmRDb25maWdGaWxlcykge1xuICAgICAgLy8gSXJyZXNwZWN0aXZlIG9mIHRoZSBuYW1lIHByb2plY3QgbGV2ZWwgY29uZmlndXJhdGlvbiBzaG91bGQgYWx3YXlzIHRha2UgcHJlY2VkZW5jZS5cbiAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGJhc2VQYXRoLCBjb25maWdGaWxlKTtcbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKGZ1bGxQYXRoKSkge1xuICAgICAgICByZXR1cm4gZnVsbFBhdGg7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZ2V0U2Fzc0xvYWRlck9wdGlvbnMoXG4gIHJvb3Q6IHN0cmluZyxcbiAgaW1wbGVtZW50YXRpb246IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbiB8IFNhc3NMZWdhY3lXb3JrZXJJbXBsZW1lbnRhdGlvbixcbiAgaW5jbHVkZVBhdGhzOiBzdHJpbmdbXSxcbiAgaW5kZW50ZWRTeW50YXg6IGJvb2xlYW4sXG4gIHZlcmJvc2U6IGJvb2xlYW4sXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4sXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiBpbXBsZW1lbnRhdGlvbiBpbnN0YW5jZW9mIFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvblxuICAgID8ge1xuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgIGFwaTogJ21vZGVybicsXG4gICAgICAgIGltcGxlbWVudGF0aW9uLFxuICAgICAgICAvLyBXZWJwYWNrIGltcG9ydGVyIGlzIG9ubHkgaW1wbGVtZW50ZWQgaW4gdGhlIGxlZ2FjeSBBUEkgYW5kIHdlIGhhdmUgb3VyIG93biBjdXN0b20gV2VicGFjayBpbXBvcnRlci5cbiAgICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3Nhc3MtbG9hZGVyL2Jsb2IvOTk3ZjNlYjQxZDg2ZGQwMGQ1ZmE0OWMzOTVhMWFlYjQxNTczMTA4Yy9zcmMvdXRpbHMuanMjTDY0Mi1MNjUxXG4gICAgICAgIHdlYnBhY2tJbXBvcnRlcjogZmFsc2UsXG4gICAgICAgIHNhc3NPcHRpb25zOiAobG9hZGVyQ29udGV4dDogTG9hZGVyQ29udGV4dDx7fT4pID0+ICh7XG4gICAgICAgICAgaW1wb3J0ZXJzOiBbZ2V0U2Fzc1Jlc29sdXRpb25JbXBvcnRlcihsb2FkZXJDb250ZXh0LCByb290LCBwcmVzZXJ2ZVN5bWxpbmtzKV0sXG4gICAgICAgICAgbG9hZFBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgLy8gVXNlIGV4cGFuZGVkIGFzIG90aGVyd2lzZSBzYXNzIHdpbGwgcmVtb3ZlIGNvbW1lbnRzIHRoYXQgYXJlIG5lZWRlZCBmb3IgYXV0b3ByZWZpeGVyXG4gICAgICAgICAgLy8gRXg6IC8qIGF1dG9wcmVmaXhlciBncmlkOiBhdXRvcGxhY2UgKi9cbiAgICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc2Fzcy1sb2FkZXIvYmxvYi80NWFkMGJlMTcyNjRjZWFkYTVmMGI0ZmI4N2U5MzU3YWJlODVjNGZmL3NyYy9nZXRTYXNzT3B0aW9ucy5qcyNMNjgtTDcwXG4gICAgICAgICAgc3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICAgICAgLy8gU2lsZW5jZXMgY29tcGlsZXIgd2FybmluZ3MgZnJvbSAzcmQgcGFydHkgc3R5bGVzaGVldHNcbiAgICAgICAgICBxdWlldERlcHM6ICF2ZXJib3NlLFxuICAgICAgICAgIHZlcmJvc2UsXG4gICAgICAgICAgc3ludGF4OiBpbmRlbnRlZFN5bnRheCA/ICdpbmRlbnRlZCcgOiAnc2NzcycsXG4gICAgICAgIH0pLFxuICAgICAgfVxuICAgIDoge1xuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgIGFwaTogJ2xlZ2FjeScsXG4gICAgICAgIGltcGxlbWVudGF0aW9uLFxuICAgICAgICBzYXNzT3B0aW9uczoge1xuICAgICAgICAgIGltcG9ydGVyOiAodXJsOiBzdHJpbmcsIGZyb206IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgaWYgKHVybC5jaGFyQXQoMCkgPT09ICd+Jykge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYCcke2Zyb219JyBpbXBvcnRzICcke3VybH0nIHdpdGggYSB0aWxkZS4gVXNhZ2Ugb2YgJ34nIGluIGltcG9ydHMgaXMgbm8gbG9uZ2VyIHN1cHBvcnRlZC5gLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9LFxuICAgICAgICAgIC8vIFByZXZlbnQgdXNlIG9mIGBmaWJlcnNgIHBhY2thZ2UgYXMgaXQgbm8gbG9uZ2VyIHdvcmtzIGluIG5ld2VyIE5vZGUuanMgdmVyc2lvbnNcbiAgICAgICAgICBmaWJlcjogZmFsc2UsXG4gICAgICAgICAgaW5kZW50ZWRTeW50YXgsXG4gICAgICAgICAgLy8gYm9vdHN0cmFwLXNhc3MgcmVxdWlyZXMgYSBtaW5pbXVtIHByZWNpc2lvbiBvZiA4XG4gICAgICAgICAgcHJlY2lzaW9uOiA4LFxuICAgICAgICAgIGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAvLyBVc2UgZXhwYW5kZWQgYXMgb3RoZXJ3aXNlIHNhc3Mgd2lsbCByZW1vdmUgY29tbWVudHMgdGhhdCBhcmUgbmVlZGVkIGZvciBhdXRvcHJlZml4ZXJcbiAgICAgICAgICAvLyBFeDogLyogYXV0b3ByZWZpeGVyIGdyaWQ6IGF1dG9wbGFjZSAqL1xuICAgICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zYXNzLWxvYWRlci9ibG9iLzQ1YWQwYmUxNzI2NGNlYWRhNWYwYjRmYjg3ZTkzNTdhYmU4NWM0ZmYvc3JjL2dldFNhc3NPcHRpb25zLmpzI0w2OC1MNzBcbiAgICAgICAgICBvdXRwdXRTdHlsZTogJ2V4cGFuZGVkJyxcbiAgICAgICAgICAvLyBTaWxlbmNlcyBjb21waWxlciB3YXJuaW5ncyBmcm9tIDNyZCBwYXJ0eSBzdHlsZXNoZWV0c1xuICAgICAgICAgIHF1aWV0RGVwczogIXZlcmJvc2UsXG4gICAgICAgICAgdmVyYm9zZSxcbiAgICAgICAgfSxcbiAgICAgIH07XG59XG5cbmZ1bmN0aW9uIGdldFNhc3NSZXNvbHV0aW9uSW1wb3J0ZXIoXG4gIGxvYWRlckNvbnRleHQ6IExvYWRlckNvbnRleHQ8e30+LFxuICByb290OiBzdHJpbmcsXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4sXG4pOiBGaWxlSW1wb3J0ZXI8J2FzeW5jJz4ge1xuICBjb25zdCBjb21tb25SZXNvbHZlck9wdGlvbnM6IFBhcmFtZXRlcnM8dHlwZW9mIGxvYWRlckNvbnRleHRbJ2dldFJlc29sdmUnXT5bMF0gPSB7XG4gICAgY29uZGl0aW9uTmFtZXM6IFsnc2FzcycsICdzdHlsZSddLFxuICAgIG1haW5GaWVsZHM6IFsnc2FzcycsICdzdHlsZScsICdtYWluJywgJy4uLiddLFxuICAgIGV4dGVuc2lvbnM6IFsnLnNjc3MnLCAnLnNhc3MnLCAnLmNzcyddLFxuICAgIHJlc3RyaWN0aW9uczogWy9cXC4oKHNhfHNjfGMpc3MpJC9pXSxcbiAgICBwcmVmZXJSZWxhdGl2ZTogdHJ1ZSxcbiAgICBzeW1saW5rczogIXByZXNlcnZlU3ltbGlua3MsXG4gIH07XG5cbiAgLy8gU2FzcyBhbHNvIHN1cHBvcnRzIGltcG9ydC1vbmx5IGZpbGVzLiBJZiB5b3UgbmFtZSBhIGZpbGUgPG5hbWU+LmltcG9ydC5zY3NzLCBpdCB3aWxsIG9ubHkgYmUgbG9hZGVkIGZvciBpbXBvcnRzLCBub3QgZm9yIEB1c2VzLlxuICAvLyBTZWU6IGh0dHBzOi8vc2Fzcy1sYW5nLmNvbS9kb2N1bWVudGF0aW9uL2F0LXJ1bGVzL2ltcG9ydCNpbXBvcnQtb25seS1maWxlc1xuICBjb25zdCByZXNvbHZlSW1wb3J0ID0gbG9hZGVyQ29udGV4dC5nZXRSZXNvbHZlKHtcbiAgICAuLi5jb21tb25SZXNvbHZlck9wdGlvbnMsXG4gICAgZGVwZW5kZW5jeVR5cGU6ICdzYXNzLWltcG9ydCcsXG4gICAgbWFpbkZpbGVzOiBbJ19pbmRleC5pbXBvcnQnLCAnX2luZGV4JywgJ2luZGV4LmltcG9ydCcsICdpbmRleCcsICcuLi4nXSxcbiAgfSk7XG5cbiAgY29uc3QgcmVzb2x2ZU1vZHVsZSA9IGxvYWRlckNvbnRleHQuZ2V0UmVzb2x2ZSh7XG4gICAgLi4uY29tbW9uUmVzb2x2ZXJPcHRpb25zLFxuICAgIGRlcGVuZGVuY3lUeXBlOiAnc2Fzcy1tb2R1bGUnLFxuICAgIG1haW5GaWxlczogWydfaW5kZXgnLCAnaW5kZXgnLCAnLi4uJ10sXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgZmluZEZpbGVVcmw6IGFzeW5jICh1cmwsIHsgZnJvbUltcG9ydCB9KTogUHJvbWlzZTxVUkwgfCBudWxsPiA9PiB7XG4gICAgICBpZiAodXJsLmNoYXJBdCgwKSA9PT0gJy4nKSB7XG4gICAgICAgIC8vIExldCBTYXNzIGhhbmRsZSByZWxhdGl2ZSBpbXBvcnRzLlxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgbGV0IGZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IHJlc29sdmUgPSBmcm9tSW1wb3J0ID8gcmVzb2x2ZUltcG9ydCA6IHJlc29sdmVNb2R1bGU7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGZpbGUgPSBhd2FpdCByZXNvbHZlKHJvb3QsIHVybCk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8gVHJ5IHRvIHJlc29sdmUgYSBwYXJ0aWFsIGZpbGVcbiAgICAgICAgLy8gQHVzZSAnQG1hdGVyaWFsL2J1dHRvbi9idXR0b24nIGFzIG1kYy1idXR0b247XG4gICAgICAgIC8vIGBAbWF0ZXJpYWwvYnV0dG9uL2J1dHRvbmAgLT4gYEBtYXRlcmlhbC9idXR0b24vX2J1dHRvbmBcbiAgICAgICAgY29uc3QgbGFzdFNsYXNoSW5kZXggPSB1cmwubGFzdEluZGV4T2YoJy8nKTtcbiAgICAgICAgY29uc3QgdW5kZXJzY29yZUluZGV4ID0gbGFzdFNsYXNoSW5kZXggKyAxO1xuICAgICAgICBpZiAodW5kZXJzY29yZUluZGV4ID4gMCAmJiB1cmwuY2hhckF0KHVuZGVyc2NvcmVJbmRleCkgIT09ICdfJykge1xuICAgICAgICAgIGNvbnN0IHBhcnRpYWxGaWxlVXJsID0gYCR7dXJsLnNsaWNlKDAsIHVuZGVyc2NvcmVJbmRleCl9XyR7dXJsLnNsaWNlKHVuZGVyc2NvcmVJbmRleCl9YDtcbiAgICAgICAgICBmaWxlID0gYXdhaXQgcmVzb2x2ZShyb290LCBwYXJ0aWFsRmlsZVVybCkuY2F0Y2goKCkgPT4gdW5kZWZpbmVkKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmlsZSA/IHBhdGhUb0ZpbGVVUkwoZmlsZSkgOiBudWxsO1xuICAgIH0sXG4gIH07XG59XG4iXX0=