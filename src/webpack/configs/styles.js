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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvd2VicGFjay9jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHVDQUF5QjtBQUN6QixzRkFBMkQ7QUFDM0QsMkNBQTZCO0FBRTdCLDZCQUFvQztBQUVwQywwREFBbUU7QUFDbkUsd0VBQWdGO0FBRWhGLHlFQUFnRTtBQUNoRSx3Q0FLb0I7QUFDcEIsMEVBQXFFO0FBQ3JFLDRFQUF1RTtBQUN2RSw4Q0FJMEI7QUFFMUIsa0RBQWtEO0FBQ2xELFNBQWdCLGVBQWUsQ0FBQyxHQUF5Qjs7SUFDdkQsTUFBTSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFDbkMsTUFBTSxZQUFZLEdBQTZCLEVBQUUsQ0FBQztJQUVsRCxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksd0NBQThCLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFFNUUsTUFBTSxZQUFZLEdBQUcsWUFBWSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7SUFFbkQsNEJBQTRCO0lBQzVCLE1BQU0sVUFBVSxHQUFHLElBQUEsNkJBQW1CLEVBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBRW5FLGtDQUFrQztJQUNsQyxNQUFNLFlBQVksR0FDaEIsTUFBQSxNQUFBLE1BQUEsWUFBWSxDQUFDLHdCQUF3QiwwQ0FBRSxZQUFZLDBDQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsbUNBQUksRUFBRSxDQUFDO0lBRS9GLHlCQUF5QjtJQUN6QixJQUFJLFlBQVks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QkFBYSxFQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDM0MsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCBNaW5pQ3NzRXh0cmFjdFBsdWdpbiBmcm9tICdtaW5pLWNzcy1leHRyYWN0LXBsdWdpbic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHR5cGUgeyBGaWxlSW1wb3J0ZXIgfSBmcm9tICdzYXNzJztcbmltcG9ydCB7IHBhdGhUb0ZpbGVVUkwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IHR5cGUgeyBDb25maWd1cmF0aW9uLCBMb2FkZXJDb250ZXh0LCBSdWxlU2V0VXNlSXRlbSB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uIH0gZnJvbSAnLi4vLi4vc2Fzcy9zYXNzLXNlcnZpY2UnO1xuaW1wb3J0IHsgU2Fzc0xlZ2FjeVdvcmtlckltcGxlbWVudGF0aW9uIH0gZnJvbSAnLi4vLi4vc2Fzcy9zYXNzLXNlcnZpY2UtbGVnYWN5JztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyB1c2VMZWdhY3lTYXNzIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQge1xuICBBbnlDb21wb25lbnRTdHlsZUJ1ZGdldENoZWNrZXIsXG4gIFBvc3Rjc3NDbGlSZXNvdXJjZXMsXG4gIFJlbW92ZUhhc2hQbHVnaW4sXG4gIFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4sXG59IGZyb20gJy4uL3BsdWdpbnMnO1xuaW1wb3J0IHsgQ3NzT3B0aW1pemVyUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy9jc3Mtb3B0aW1pemVyLXBsdWdpbic7XG5pbXBvcnQgeyBTdHlsZXNXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vcGx1Z2lucy9zdHlsZXMtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHtcbiAgYXNzZXROYW1lVGVtcGxhdGVGYWN0b3J5LFxuICBnZXRPdXRwdXRIYXNoRm9ybWF0LFxuICBub3JtYWxpemVHbG9iYWxTdHlsZXMsXG59IGZyb20gJy4uL3V0aWxzL2hlbHBlcnMnO1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGdldFN0eWxlc0NvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKTogQ29uZmlndXJhdGlvbiB7XG4gIGNvbnN0IHsgcm9vdCwgYnVpbGRPcHRpb25zIH0gPSB3Y287XG4gIGNvbnN0IGV4dHJhUGx1Z2luczogQ29uZmlndXJhdGlvblsncGx1Z2lucyddID0gW107XG5cbiAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IEFueUNvbXBvbmVudFN0eWxlQnVkZ2V0Q2hlY2tlcihidWlsZE9wdGlvbnMuYnVkZ2V0cykpO1xuXG4gIGNvbnN0IGNzc1NvdXJjZU1hcCA9IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAuc3R5bGVzO1xuXG4gIC8vIERldGVybWluZSBoYXNoaW5nIGZvcm1hdC5cbiAgY29uc3QgaGFzaEZvcm1hdCA9IGdldE91dHB1dEhhc2hGb3JtYXQoYnVpbGRPcHRpb25zLm91dHB1dEhhc2hpbmcpO1xuXG4gIC8vIHVzZSBpbmNsdWRlUGF0aHMgZnJvbSBhcHBDb25maWdcbiAgY29uc3QgaW5jbHVkZVBhdGhzID1cbiAgICBidWlsZE9wdGlvbnMuc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zPy5pbmNsdWRlUGF0aHM/Lm1hcCgocCkgPT4gcGF0aC5yZXNvbHZlKHJvb3QsIHApKSA/PyBbXTtcblxuICAvLyBQcm9jZXNzIGdsb2JhbCBzdHlsZXMuXG4gIGlmIChidWlsZE9wdGlvbnMuc3R5bGVzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCB7IGVudHJ5UG9pbnRzLCBub0luamVjdE5hbWVzIH0gPSBub3JtYWxpemVHbG9iYWxTdHlsZXMoYnVpbGRPcHRpb25zLnN0eWxlcyk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgU3R5bGVzV2VicGFja1BsdWdpbih7XG4gICAgICAgIHJvb3QsXG4gICAgICAgIGVudHJ5UG9pbnRzLFxuICAgICAgICBwcmVzZXJ2ZVN5bWxpbmtzOiBidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBpZiAobm9JbmplY3ROYW1lcy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBBZGQgcGx1Z2luIHRvIHJlbW92ZSBoYXNoZXMgZnJvbSBsYXp5IHN0eWxlcy5cbiAgICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBSZW1vdmVIYXNoUGx1Z2luKHsgY2h1bmtOYW1lczogbm9JbmplY3ROYW1lcywgaGFzaEZvcm1hdCB9KSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qgc2Fzc0ltcGxlbWVudGF0aW9uID0gdXNlTGVnYWN5U2Fzc1xuICAgID8gbmV3IFNhc3NMZWdhY3lXb3JrZXJJbXBsZW1lbnRhdGlvbigpXG4gICAgOiBuZXcgU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uKCk7XG5cbiAgZXh0cmFQbHVnaW5zLnB1c2goe1xuICAgIGFwcGx5KGNvbXBpbGVyKSB7XG4gICAgICBjb21waWxlci5ob29rcy5zaHV0ZG93bi50YXAoJ3Nhc3Mtd29ya2VyJywgKCkgPT4ge1xuICAgICAgICBzYXNzSW1wbGVtZW50YXRpb24uY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH0pO1xuXG4gIGNvbnN0IGFzc2V0TmFtZVRlbXBsYXRlID0gYXNzZXROYW1lVGVtcGxhdGVGYWN0b3J5KGhhc2hGb3JtYXQpO1xuXG4gIGNvbnN0IGV4dHJhUG9zdGNzc1BsdWdpbnM6IGltcG9ydCgncG9zdGNzcycpLlBsdWdpbltdID0gW107XG5cbiAgLy8gQXR0ZW1wdCB0byBzZXR1cCBUYWlsd2luZCBDU1NcbiAgLy8gT25seSBsb2FkIFRhaWx3aW5kIENTUyBwbHVnaW4gaWYgY29uZmlndXJhdGlvbiBmaWxlIHdhcyBmb3VuZC5cbiAgLy8gVGhpcyBhY3RzIGFzIGEgZ3VhcmQgdG8gZW5zdXJlIHRoZSBwcm9qZWN0IGFjdHVhbGx5IHdhbnRzIHRvIHVzZSBUYWlsd2luZCBDU1MuXG4gIC8vIFRoZSBwYWNrYWdlIG1heSBiZSB1bmtub3duaW5nbHkgcHJlc2VudCBkdWUgdG8gYSB0aGlyZC1wYXJ0eSB0cmFuc2l0aXZlIHBhY2thZ2UgZGVwZW5kZW5jeS5cbiAgY29uc3QgdGFpbHdpbmRDb25maWdQYXRoID0gZ2V0VGFpbHdpbmRDb25maWdQYXRoKHdjbyk7XG4gIGlmICh0YWlsd2luZENvbmZpZ1BhdGgpIHtcbiAgICBsZXQgdGFpbHdpbmRQYWNrYWdlUGF0aDtcbiAgICB0cnkge1xuICAgICAgdGFpbHdpbmRQYWNrYWdlUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgndGFpbHdpbmRjc3MnLCB7IHBhdGhzOiBbd2NvLnJvb3RdIH0pO1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29uc3QgcmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGggPSBwYXRoLnJlbGF0aXZlKHdjby5yb290LCB0YWlsd2luZENvbmZpZ1BhdGgpO1xuICAgICAgd2NvLmxvZ2dlci53YXJuKFxuICAgICAgICBgVGFpbHdpbmQgQ1NTIGNvbmZpZ3VyYXRpb24gZmlsZSBmb3VuZCAoJHtyZWxhdGl2ZVRhaWx3aW5kQ29uZmlnUGF0aH0pYCArXG4gICAgICAgICAgYCBidXQgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZSBpcyBub3QgaW5zdGFsbGVkLmAgK1xuICAgICAgICAgIGAgVG8gZW5hYmxlIFRhaWx3aW5kIENTUywgcGxlYXNlIGluc3RhbGwgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZS5gLFxuICAgICAgKTtcbiAgICB9XG4gICAgaWYgKHRhaWx3aW5kUGFja2FnZVBhdGgpIHtcbiAgICAgIGV4dHJhUG9zdGNzc1BsdWdpbnMucHVzaChyZXF1aXJlKHRhaWx3aW5kUGFja2FnZVBhdGgpKHsgY29uZmlnOiB0YWlsd2luZENvbmZpZ1BhdGggfSkpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGF1dG9wcmVmaXhlcjogdHlwZW9mIGltcG9ydCgnYXV0b3ByZWZpeGVyJykgPSByZXF1aXJlKCdhdXRvcHJlZml4ZXInKTtcblxuICBjb25zdCBwb3N0Y3NzT3B0aW9uc0NyZWF0b3IgPSAoaW5saW5lU291cmNlbWFwczogYm9vbGVhbiwgZXh0cmFjdGVkOiBib29sZWFuKSA9PiB7XG4gICAgY29uc3Qgb3B0aW9uR2VuZXJhdG9yID0gKGxvYWRlcjogTG9hZGVyQ29udGV4dDx1bmtub3duPikgPT4gKHtcbiAgICAgIG1hcDogaW5saW5lU291cmNlbWFwc1xuICAgICAgICA/IHtcbiAgICAgICAgICAgIGlubGluZTogdHJ1ZSxcbiAgICAgICAgICAgIGFubm90YXRpb246IGZhbHNlLFxuICAgICAgICAgIH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICBwbHVnaW5zOiBbXG4gICAgICAgIFBvc3Rjc3NDbGlSZXNvdXJjZXMoe1xuICAgICAgICAgIGJhc2VIcmVmOiBidWlsZE9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgICAgZGVwbG95VXJsOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgICAgIHJlc291cmNlc091dHB1dFBhdGg6IGJ1aWxkT3B0aW9ucy5yZXNvdXJjZXNPdXRwdXRQYXRoLFxuICAgICAgICAgIGxvYWRlcixcbiAgICAgICAgICBmaWxlbmFtZTogYXNzZXROYW1lVGVtcGxhdGUsXG4gICAgICAgICAgZW1pdEZpbGU6IGJ1aWxkT3B0aW9ucy5wbGF0Zm9ybSAhPT0gJ3NlcnZlcicsXG4gICAgICAgICAgZXh0cmFjdGVkLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uZXh0cmFQb3N0Y3NzUGx1Z2lucyxcbiAgICAgICAgYXV0b3ByZWZpeGVyKHtcbiAgICAgICAgICBpZ25vcmVVbmtub3duVmVyc2lvbnM6IHRydWUsXG4gICAgICAgICAgb3ZlcnJpZGVCcm93c2Vyc2xpc3Q6IGJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2VycyxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuICAgIC8vIHBvc3Rjc3MtbG9hZGVyIGZhaWxzIHdoZW4gdHJ5aW5nIHRvIGRldGVybWluZSBjb25maWd1cmF0aW9uIGZpbGVzIGZvciBkYXRhIFVSSXNcbiAgICBvcHRpb25HZW5lcmF0b3IuY29uZmlnID0gZmFsc2U7XG5cbiAgICByZXR1cm4gb3B0aW9uR2VuZXJhdG9yO1xuICB9O1xuXG4gIC8vIGxvYWQgY29tcG9uZW50IGNzcyBhcyByYXcgc3RyaW5nc1xuICBjb25zdCBjb21wb25lbnRzU291cmNlTWFwID0gISEoXG4gICAgY3NzU291cmNlTWFwICYmXG4gICAgLy8gTmV2ZXIgdXNlIGNvbXBvbmVudCBjc3Mgc291cmNlbWFwIHdoZW4gc3R5bGUgb3B0aW1pemF0aW9ucyBhcmUgb24uXG4gICAgLy8gSXQgd2lsbCBqdXN0IGluY3JlYXNlIGJ1bmRsZSBzaXplIHdpdGhvdXQgb2ZmZXJpbmcgZ29vZCBkZWJ1ZyBleHBlcmllbmNlLlxuICAgICFidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uLnN0eWxlcy5taW5pZnkgJiZcbiAgICAvLyBJbmxpbmUgYWxsIHNvdXJjZW1hcCB0eXBlcyBleGNlcHQgaGlkZGVuIG9uZXMsIHdoaWNoIGFyZSB0aGUgc2FtZSBhcyBubyBzb3VyY2VtYXBzXG4gICAgLy8gZm9yIGNvbXBvbmVudCBjc3MuXG4gICAgIWJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAuaGlkZGVuXG4gICk7XG5cbiAgLy8gZXh0cmFjdCBnbG9iYWwgY3NzIGZyb20ganMgZmlsZXMgaW50byBvd24gY3NzIGZpbGUuXG4gIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBNaW5pQ3NzRXh0cmFjdFBsdWdpbih7IGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmV4dHJhY3R9LmNzc2AgfSkpO1xuXG4gIGlmICghYnVpbGRPcHRpb25zLmhtcikge1xuICAgIC8vIGRvbid0IHJlbW92ZSBgLmpzYCBmaWxlcyBmb3IgYC5jc3NgIHdoZW4gd2UgYXJlIHVzaW5nIEhNUiB0aGVzZSBjb250YWluIEhNUiBhY2NlcHQgY29kZXMuXG4gICAgLy8gc3VwcHJlc3MgZW1wdHkgLmpzIGZpbGVzIGluIGNzcyBvbmx5IGVudHJ5IHBvaW50cy5cbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU3VwcHJlc3NFeHRyYWN0ZWRUZXh0Q2h1bmtzV2VicGFja1BsdWdpbigpKTtcbiAgfVxuXG4gIGNvbnN0IHBvc3RDc3MgPSByZXF1aXJlKCdwb3N0Y3NzJyk7XG4gIGNvbnN0IHBvc3RDc3NMb2FkZXJQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCdwb3N0Y3NzLWxvYWRlcicpO1xuXG4gIGNvbnN0IGNvbXBvbmVudFN0eWxlTG9hZGVyczogUnVsZVNldFVzZUl0ZW1bXSA9IFtcbiAgICB7XG4gICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnY3NzLWxvYWRlcicpLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICB1cmw6IGZhbHNlLFxuICAgICAgICBzb3VyY2VNYXA6IGNvbXBvbmVudHNTb3VyY2VNYXAsXG4gICAgICAgIGltcG9ydExvYWRlcnM6IDEsXG4gICAgICAgIGV4cG9ydFR5cGU6ICdzdHJpbmcnLFxuICAgICAgICBlc01vZHVsZTogZmFsc2UsXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgbG9hZGVyOiBwb3N0Q3NzTG9hZGVyUGF0aCxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgaW1wbGVtZW50YXRpb246IHBvc3RDc3MsXG4gICAgICAgIHBvc3Rjc3NPcHRpb25zOiBwb3N0Y3NzT3B0aW9uc0NyZWF0b3IoY29tcG9uZW50c1NvdXJjZU1hcCwgZmFsc2UpLFxuICAgICAgfSxcbiAgICB9LFxuICBdO1xuXG4gIGNvbnN0IGdsb2JhbFN0eWxlTG9hZGVyczogUnVsZVNldFVzZUl0ZW1bXSA9IFtcbiAgICB7XG4gICAgICBsb2FkZXI6IE1pbmlDc3NFeHRyYWN0UGx1Z2luLmxvYWRlcixcbiAgICB9LFxuICAgIHtcbiAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCdjc3MtbG9hZGVyJyksXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIHVybDogZmFsc2UsXG4gICAgICAgIHNvdXJjZU1hcDogISFjc3NTb3VyY2VNYXAsXG4gICAgICAgIGltcG9ydExvYWRlcnM6IDEsXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgbG9hZGVyOiBwb3N0Q3NzTG9hZGVyUGF0aCxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgaW1wbGVtZW50YXRpb246IHBvc3RDc3MsXG4gICAgICAgIHBvc3Rjc3NPcHRpb25zOiBwb3N0Y3NzT3B0aW9uc0NyZWF0b3IoZmFsc2UsIHRydWUpLFxuICAgICAgICBzb3VyY2VNYXA6ICEhY3NzU291cmNlTWFwLFxuICAgICAgfSxcbiAgICB9LFxuICBdO1xuXG4gIGNvbnN0IHN0eWxlTGFuZ3VhZ2VzOiB7XG4gICAgZXh0ZW5zaW9uczogc3RyaW5nW107XG4gICAgdXNlOiBSdWxlU2V0VXNlSXRlbVtdO1xuICB9W10gPSBbXG4gICAge1xuICAgICAgZXh0ZW5zaW9uczogWydjc3MnXSxcbiAgICAgIHVzZTogW10sXG4gICAgfSxcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ3Njc3MnXSxcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Jlc29sdmUtdXJsLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnc2Fzcy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiBnZXRTYXNzTG9hZGVyT3B0aW9ucyhcbiAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICBzYXNzSW1wbGVtZW50YXRpb24sXG4gICAgICAgICAgICBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICFidWlsZE9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgICAgICEhYnVpbGRPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICAgICAgKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICBleHRlbnNpb25zOiBbJ3Nhc3MnXSxcbiAgICAgIHVzZTogW1xuICAgICAgICB7XG4gICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJ3Jlc29sdmUtdXJsLWxvYWRlcicpLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnc2Fzcy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiBnZXRTYXNzTG9hZGVyT3B0aW9ucyhcbiAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICBzYXNzSW1wbGVtZW50YXRpb24sXG4gICAgICAgICAgICBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICAgIWJ1aWxkT3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAgICAgISFidWlsZE9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgICAgICApLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGV4dGVuc2lvbnM6IFsnbGVzcyddLFxuICAgICAgdXNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnbGVzcy1sb2FkZXInKSxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBpbXBsZW1lbnRhdGlvbjogcmVxdWlyZSgnbGVzcycpLFxuICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgICBsZXNzT3B0aW9uczoge1xuICAgICAgICAgICAgICBqYXZhc2NyaXB0RW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgcGF0aHM6IGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgXTtcblxuICByZXR1cm4ge1xuICAgIG1vZHVsZToge1xuICAgICAgcnVsZXM6IHN0eWxlTGFuZ3VhZ2VzLm1hcCgoeyBleHRlbnNpb25zLCB1c2UgfSkgPT4gKHtcbiAgICAgICAgdGVzdDogbmV3IFJlZ0V4cChgXFxcXC4oPzoke2V4dGVuc2lvbnMuam9pbignfCcpfSkkYCwgJ2knKSxcbiAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAvLyBTZXR1cCBwcm9jZXNzaW5nIHJ1bGVzIGZvciBnbG9iYWwgYW5kIGNvbXBvbmVudCBzdHlsZXNcbiAgICAgICAgICB7XG4gICAgICAgICAgICBvbmVPZjogW1xuICAgICAgICAgICAgICAvLyBHbG9iYWwgc3R5bGVzIGFyZSBvbmx5IGRlZmluZWQgZ2xvYmFsIHN0eWxlc1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdXNlOiBnbG9iYWxTdHlsZUxvYWRlcnMsXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VRdWVyeTogL1xcP25nR2xvYmFsU3R5bGUvLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzIGFyZSBhbGwgc3R5bGVzIGV4Y2VwdCBkZWZpbmVkIGdsb2JhbCBzdHlsZXNcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVzZTogY29tcG9uZW50U3R5bGVMb2FkZXJzLFxuICAgICAgICAgICAgICAgIHJlc291cmNlUXVlcnk6IC9cXD9uZ1Jlc291cmNlLyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7IHVzZSB9LFxuICAgICAgICBdLFxuICAgICAgfSkpLFxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICBtaW5pbWl6ZXI6IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24uc3R5bGVzLm1pbmlmeVxuICAgICAgICA/IFtcbiAgICAgICAgICAgIG5ldyBDc3NPcHRpbWl6ZXJQbHVnaW4oe1xuICAgICAgICAgICAgICBzdXBwb3J0ZWRCcm93c2VyczogYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICB9LFxuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2lucyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0VGFpbHdpbmRDb25maWdQYXRoKHsgcHJvamVjdFJvb3QsIHJvb3QgfTogV2VicGFja0NvbmZpZ09wdGlvbnMpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAvLyBBIGNvbmZpZ3VyYXRpb24gZmlsZSBjYW4gZXhpc3QgaW4gdGhlIHByb2plY3Qgb3Igd29ya3NwYWNlIHJvb3RcbiAgLy8gVGhlIGxpc3Qgb2YgdmFsaWQgY29uZmlnIGZpbGVzIGNhbiBiZSBmb3VuZDpcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3RhaWx3aW5kbGFicy90YWlsd2luZGNzcy9ibG9iLzg4NDVkMTEyZmI2MmQ3OTgxNWI1MGIzYmFlODBjMzE3NDUwYjhiOTIvc3JjL3V0aWwvcmVzb2x2ZUNvbmZpZ1BhdGguanMjTDQ2LUw1MlxuICBjb25zdCB0YWlsd2luZENvbmZpZ0ZpbGVzID0gWyd0YWlsd2luZC5jb25maWcuanMnLCAndGFpbHdpbmQuY29uZmlnLmNqcyddO1xuICBmb3IgKGNvbnN0IGJhc2VQYXRoIG9mIFtwcm9qZWN0Um9vdCwgcm9vdF0pIHtcbiAgICBmb3IgKGNvbnN0IGNvbmZpZ0ZpbGUgb2YgdGFpbHdpbmRDb25maWdGaWxlcykge1xuICAgICAgLy8gSXJyZXNwZWN0aXZlIG9mIHRoZSBuYW1lIHByb2plY3QgbGV2ZWwgY29uZmlndXJhdGlvbiBzaG91bGQgYWx3YXlzIHRha2UgcHJlY2VkZW5jZS5cbiAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGJhc2VQYXRoLCBjb25maWdGaWxlKTtcbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKGZ1bGxQYXRoKSkge1xuICAgICAgICByZXR1cm4gZnVsbFBhdGg7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZ2V0U2Fzc0xvYWRlck9wdGlvbnMoXG4gIHJvb3Q6IHN0cmluZyxcbiAgaW1wbGVtZW50YXRpb246IFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvbiB8IFNhc3NMZWdhY3lXb3JrZXJJbXBsZW1lbnRhdGlvbixcbiAgaW5jbHVkZVBhdGhzOiBzdHJpbmdbXSxcbiAgaW5kZW50ZWRTeW50YXg6IGJvb2xlYW4sXG4gIHZlcmJvc2U6IGJvb2xlYW4sXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4sXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiBpbXBsZW1lbnRhdGlvbiBpbnN0YW5jZW9mIFNhc3NXb3JrZXJJbXBsZW1lbnRhdGlvblxuICAgID8ge1xuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgIGFwaTogJ21vZGVybicsXG4gICAgICAgIGltcGxlbWVudGF0aW9uLFxuICAgICAgICAvLyBXZWJwYWNrIGltcG9ydGVyIGlzIG9ubHkgaW1wbGVtZW50ZWQgaW4gdGhlIGxlZ2FjeSBBUEkgYW5kIHdlIGhhdmUgb3VyIG93biBjdXN0b20gV2VicGFjayBpbXBvcnRlci5cbiAgICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3Nhc3MtbG9hZGVyL2Jsb2IvOTk3ZjNlYjQxZDg2ZGQwMGQ1ZmE0OWMzOTVhMWFlYjQxNTczMTA4Yy9zcmMvdXRpbHMuanMjTDY0Mi1MNjUxXG4gICAgICAgIHdlYnBhY2tJbXBvcnRlcjogZmFsc2UsXG4gICAgICAgIHNhc3NPcHRpb25zOiAobG9hZGVyQ29udGV4dDogTG9hZGVyQ29udGV4dDx7fT4pID0+ICh7XG4gICAgICAgICAgaW1wb3J0ZXJzOiBbZ2V0U2Fzc1Jlc29sdXRpb25JbXBvcnRlcihsb2FkZXJDb250ZXh0LCByb290LCBwcmVzZXJ2ZVN5bWxpbmtzKV0sXG4gICAgICAgICAgbG9hZFBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgICAgICAgLy8gVXNlIGV4cGFuZGVkIGFzIG90aGVyd2lzZSBzYXNzIHdpbGwgcmVtb3ZlIGNvbW1lbnRzIHRoYXQgYXJlIG5lZWRlZCBmb3IgYXV0b3ByZWZpeGVyXG4gICAgICAgICAgLy8gRXg6IC8qIGF1dG9wcmVmaXhlciBncmlkOiBhdXRvcGxhY2UgKi9cbiAgICAgICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc2Fzcy1sb2FkZXIvYmxvYi80NWFkMGJlMTcyNjRjZWFkYTVmMGI0ZmI4N2U5MzU3YWJlODVjNGZmL3NyYy9nZXRTYXNzT3B0aW9ucy5qcyNMNjgtTDcwXG4gICAgICAgICAgc3R5bGU6ICdleHBhbmRlZCcsXG4gICAgICAgICAgLy8gU2lsZW5jZXMgY29tcGlsZXIgd2FybmluZ3MgZnJvbSAzcmQgcGFydHkgc3R5bGVzaGVldHNcbiAgICAgICAgICBxdWlldERlcHM6ICF2ZXJib3NlLFxuICAgICAgICAgIHZlcmJvc2UsXG4gICAgICAgICAgc3ludGF4OiBpbmRlbnRlZFN5bnRheCA/ICdpbmRlbnRlZCcgOiAnc2NzcycsXG4gICAgICAgIH0pLFxuICAgICAgfVxuICAgIDoge1xuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgIGFwaTogJ2xlZ2FjeScsXG4gICAgICAgIGltcGxlbWVudGF0aW9uLFxuICAgICAgICBzYXNzT3B0aW9uczoge1xuICAgICAgICAgIGltcG9ydGVyOiAodXJsOiBzdHJpbmcsIGZyb206IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgaWYgKHVybC5jaGFyQXQoMCkgPT09ICd+Jykge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYCcke2Zyb219JyBpbXBvcnRzICcke3VybH0nIHdpdGggYSB0aWxkZS4gVXNhZ2Ugb2YgJ34nIGluIGltcG9ydHMgaXMgbm8gbG9uZ2VyIHN1cHBvcnRlZC5gLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9LFxuICAgICAgICAgIC8vIFByZXZlbnQgdXNlIG9mIGBmaWJlcnNgIHBhY2thZ2UgYXMgaXQgbm8gbG9uZ2VyIHdvcmtzIGluIG5ld2VyIE5vZGUuanMgdmVyc2lvbnNcbiAgICAgICAgICBmaWJlcjogZmFsc2UsXG4gICAgICAgICAgaW5kZW50ZWRTeW50YXgsXG4gICAgICAgICAgLy8gYm9vdHN0cmFwLXNhc3MgcmVxdWlyZXMgYSBtaW5pbXVtIHByZWNpc2lvbiBvZiA4XG4gICAgICAgICAgcHJlY2lzaW9uOiA4LFxuICAgICAgICAgIGluY2x1ZGVQYXRocyxcbiAgICAgICAgICAvLyBVc2UgZXhwYW5kZWQgYXMgb3RoZXJ3aXNlIHNhc3Mgd2lsbCByZW1vdmUgY29tbWVudHMgdGhhdCBhcmUgbmVlZGVkIGZvciBhdXRvcHJlZml4ZXJcbiAgICAgICAgICAvLyBFeDogLyogYXV0b3ByZWZpeGVyIGdyaWQ6IGF1dG9wbGFjZSAqL1xuICAgICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zYXNzLWxvYWRlci9ibG9iLzQ1YWQwYmUxNzI2NGNlYWRhNWYwYjRmYjg3ZTkzNTdhYmU4NWM0ZmYvc3JjL2dldFNhc3NPcHRpb25zLmpzI0w2OC1MNzBcbiAgICAgICAgICBvdXRwdXRTdHlsZTogJ2V4cGFuZGVkJyxcbiAgICAgICAgICAvLyBTaWxlbmNlcyBjb21waWxlciB3YXJuaW5ncyBmcm9tIDNyZCBwYXJ0eSBzdHlsZXNoZWV0c1xuICAgICAgICAgIHF1aWV0RGVwczogIXZlcmJvc2UsXG4gICAgICAgICAgdmVyYm9zZSxcbiAgICAgICAgfSxcbiAgICAgIH07XG59XG5cbmZ1bmN0aW9uIGdldFNhc3NSZXNvbHV0aW9uSW1wb3J0ZXIoXG4gIGxvYWRlckNvbnRleHQ6IExvYWRlckNvbnRleHQ8e30+LFxuICByb290OiBzdHJpbmcsXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4sXG4pOiBGaWxlSW1wb3J0ZXI8J2FzeW5jJz4ge1xuICBjb25zdCBjb21tb25SZXNvbHZlck9wdGlvbnM6IFBhcmFtZXRlcnM8dHlwZW9mIGxvYWRlckNvbnRleHRbJ2dldFJlc29sdmUnXT5bMF0gPSB7XG4gICAgY29uZGl0aW9uTmFtZXM6IFsnc2FzcycsICdzdHlsZSddLFxuICAgIG1haW5GaWVsZHM6IFsnc2FzcycsICdzdHlsZScsICdtYWluJywgJy4uLiddLFxuICAgIGV4dGVuc2lvbnM6IFsnLnNjc3MnLCAnLnNhc3MnLCAnLmNzcyddLFxuICAgIHJlc3RyaWN0aW9uczogWy9cXC4oKHNhfHNjfGMpc3MpJC9pXSxcbiAgICBwcmVmZXJSZWxhdGl2ZTogdHJ1ZSxcbiAgICBzeW1saW5rczogIXByZXNlcnZlU3ltbGlua3MsXG4gIH07XG5cbiAgLy8gU2FzcyBhbHNvIHN1cHBvcnRzIGltcG9ydC1vbmx5IGZpbGVzLiBJZiB5b3UgbmFtZSBhIGZpbGUgPG5hbWU+LmltcG9ydC5zY3NzLCBpdCB3aWxsIG9ubHkgYmUgbG9hZGVkIGZvciBpbXBvcnRzLCBub3QgZm9yIEB1c2VzLlxuICAvLyBTZWU6IGh0dHBzOi8vc2Fzcy1sYW5nLmNvbS9kb2N1bWVudGF0aW9uL2F0LXJ1bGVzL2ltcG9ydCNpbXBvcnQtb25seS1maWxlc1xuICBjb25zdCByZXNvbHZlSW1wb3J0ID0gbG9hZGVyQ29udGV4dC5nZXRSZXNvbHZlKHtcbiAgICAuLi5jb21tb25SZXNvbHZlck9wdGlvbnMsXG4gICAgZGVwZW5kZW5jeVR5cGU6ICdzYXNzLWltcG9ydCcsXG4gICAgbWFpbkZpbGVzOiBbJ19pbmRleC5pbXBvcnQnLCAnX2luZGV4JywgJ2luZGV4LmltcG9ydCcsICdpbmRleCcsICcuLi4nXSxcbiAgfSk7XG5cbiAgY29uc3QgcmVzb2x2ZU1vZHVsZSA9IGxvYWRlckNvbnRleHQuZ2V0UmVzb2x2ZSh7XG4gICAgLi4uY29tbW9uUmVzb2x2ZXJPcHRpb25zLFxuICAgIGRlcGVuZGVuY3lUeXBlOiAnc2Fzcy1tb2R1bGUnLFxuICAgIG1haW5GaWxlczogWydfaW5kZXgnLCAnaW5kZXgnLCAnLi4uJ10sXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgZmluZEZpbGVVcmw6IGFzeW5jICh1cmwsIHsgZnJvbUltcG9ydCB9KTogUHJvbWlzZTxVUkwgfCBudWxsPiA9PiB7XG4gICAgICBpZiAodXJsLmNoYXJBdCgwKSA9PT0gJy4nKSB7XG4gICAgICAgIC8vIExldCBTYXNzIGhhbmRsZSByZWxhdGl2ZSBpbXBvcnRzLlxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgbGV0IGZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IHJlc29sdmUgPSBmcm9tSW1wb3J0ID8gcmVzb2x2ZUltcG9ydCA6IHJlc29sdmVNb2R1bGU7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGZpbGUgPSBhd2FpdCByZXNvbHZlKHJvb3QsIHVybCk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8gVHJ5IHRvIHJlc29sdmUgYSBwYXJ0aWFsIGZpbGVcbiAgICAgICAgLy8gQHVzZSAnQG1hdGVyaWFsL2J1dHRvbi9idXR0b24nIGFzIG1kYy1idXR0b247XG4gICAgICAgIC8vIGBAbWF0ZXJpYWwvYnV0dG9uL2J1dHRvbmAgLT4gYEBtYXRlcmlhbC9idXR0b24vX2J1dHRvbmBcbiAgICAgICAgY29uc3QgbGFzdFNsYXNoSW5kZXggPSB1cmwubGFzdEluZGV4T2YoJy8nKTtcbiAgICAgICAgY29uc3QgdW5kZXJzY29yZUluZGV4ID0gbGFzdFNsYXNoSW5kZXggKyAxO1xuICAgICAgICBpZiAodW5kZXJzY29yZUluZGV4ID4gMCAmJiB1cmwuY2hhckF0KHVuZGVyc2NvcmVJbmRleCkgIT09ICdfJykge1xuICAgICAgICAgIGNvbnN0IHBhcnRpYWxGaWxlVXJsID0gYCR7dXJsLnNsaWNlKDAsIHVuZGVyc2NvcmVJbmRleCl9XyR7dXJsLnNsaWNlKHVuZGVyc2NvcmVJbmRleCl9YDtcbiAgICAgICAgICBmaWxlID0gYXdhaXQgcmVzb2x2ZShyb290LCBwYXJ0aWFsRmlsZVVybCkuY2F0Y2goKCkgPT4gdW5kZWZpbmVkKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmlsZSA/IHBhdGhUb0ZpbGVVUkwoZmlsZSkgOiBudWxsO1xuICAgIH0sXG4gIH07XG59XG4iXX0=