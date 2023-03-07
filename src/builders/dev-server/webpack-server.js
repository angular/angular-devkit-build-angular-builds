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
Object.defineProperty(exports, "__esModule", { value: true });
exports.serveWebpackBrowser = void 0;
const architect_1 = require("@angular-devkit/architect");
const build_webpack_1 = require("@angular-devkit/build-webpack");
const core_1 = require("@angular-devkit/core");
const path = __importStar(require("path"));
const rxjs_1 = require("rxjs");
const url = __importStar(require("url"));
const utils_1 = require("../../utils");
const check_port_1 = require("../../utils/check-port");
const color_1 = require("../../utils/color");
const i18n_options_1 = require("../../utils/i18n-options");
const load_translations_1 = require("../../utils/load-translations");
const normalize_cache_1 = require("../../utils/normalize-cache");
const package_chunk_sort_1 = require("../../utils/package-chunk-sort");
const purge_cache_1 = require("../../utils/purge-cache");
const version_1 = require("../../utils/version");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const webpack_diagnostics_1 = require("../../utils/webpack-diagnostics");
const configs_1 = require("../../webpack/configs");
const index_html_webpack_plugin_1 = require("../../webpack/plugins/index-html-webpack-plugin");
const service_worker_plugin_1 = require("../../webpack/plugins/service-worker-plugin");
const stats_1 = require("../../webpack/utils/stats");
const schema_1 = require("../browser/schema");
/**
 * Reusable implementation of the Angular Webpack development server builder.
 * @param options Dev Server options.
 * @param context The build context.
 * @param transforms A map of transforms that can be used to hook into some logic (such as
 *     transforming webpack configuration before passing it to webpack).
 *
 * @experimental Direct usage of this function is considered experimental.
 */
// eslint-disable-next-line max-lines-per-function
function serveWebpackBrowser(options, context, transforms = {}) {
    // Check Angular version.
    const { logger, workspaceRoot } = context;
    (0, version_1.assertCompatibleAngularVersion)(workspaceRoot);
    const browserTarget = (0, architect_1.targetFromTargetString)(options.browserTarget);
    async function setup() {
        const projectName = context.target?.project;
        if (!projectName) {
            throw new Error('The builder requires a target.');
        }
        // Purge old build disk cache.
        await (0, purge_cache_1.purgeStaleBuildCache)(context);
        options.port = await (0, check_port_1.checkPort)(options.port ?? 4200, options.host || 'localhost');
        if (options.hmr) {
            logger.warn(core_1.tags.stripIndents `NOTICE: Hot Module Replacement (HMR) is enabled for the dev server.
      See https://webpack.js.org/guides/hot-module-replacement for information on working with HMR for Webpack.`);
        }
        if (!options.disableHostCheck &&
            options.host &&
            !/^127\.\d+\.\d+\.\d+/g.test(options.host) &&
            options.host !== 'localhost') {
            logger.warn(core_1.tags.stripIndent `
        Warning: This is a simple server for use in testing or debugging Angular applications
        locally. It hasn't been reviewed for security issues.

        Binding this server to an open connection can result in compromising your application or
        computer. Using a different host than the one passed to the "--host" flag might result in
        websocket connection issues. You might need to use "--disable-host-check" if that's the
        case.
      `);
        }
        if (options.disableHostCheck) {
            logger.warn(core_1.tags.oneLine `
        Warning: Running a server with --disable-host-check is a security risk.
        See https://medium.com/webpack/webpack-dev-server-middleware-security-issues-1489d950874a
        for more information.
      `);
        }
        // Get the browser configuration from the target name.
        const rawBrowserOptions = (await context.getTargetOptions(browserTarget));
        if (rawBrowserOptions.outputHashing && rawBrowserOptions.outputHashing !== schema_1.OutputHashing.None) {
            // Disable output hashing for dev build as this can cause memory leaks
            // See: https://github.com/webpack/webpack-dev-server/issues/377#issuecomment-241258405
            rawBrowserOptions.outputHashing = schema_1.OutputHashing.None;
            logger.warn(`Warning: 'outputHashing' option is disabled when using the dev-server.`);
        }
        const metadata = await context.getProjectMetadata(projectName);
        const cacheOptions = (0, normalize_cache_1.normalizeCacheOptions)(metadata, context.workspaceRoot);
        const browserName = await context.getBuilderNameForTarget(browserTarget);
        // Issue a warning that the dev-server does not currently support the experimental esbuild-
        // based builder and will use Webpack.
        if (browserName === '@angular-devkit/build-angular:browser-esbuild') {
            logger.warn('WARNING: The experimental esbuild-based builder is not currently supported ' +
                'by the dev-server. The stable Webpack-based builder will be used instead.');
        }
        const browserOptions = (await context.validateOptions({
            ...rawBrowserOptions,
            watch: options.watch,
            verbose: options.verbose,
            // In dev server we should not have budgets because of extra libs such as socks-js
            budgets: undefined,
        }, browserName));
        const { styles, scripts } = (0, utils_1.normalizeOptimization)(browserOptions.optimization);
        if (scripts || styles.minify) {
            logger.error(core_1.tags.stripIndents `
        ****************************************************************************************
        This is a simple server for use in testing or debugging Angular applications locally.
        It hasn't been reviewed for security issues.

        DON'T USE IT FOR PRODUCTION!
        ****************************************************************************************
      `);
        }
        const { config, projectRoot, i18n } = await (0, webpack_browser_config_1.generateI18nBrowserWebpackConfigFromContext)(browserOptions, context, (wco) => [(0, configs_1.getDevServerConfig)(wco), (0, configs_1.getCommonConfig)(wco), (0, configs_1.getStylesConfig)(wco)], options);
        if (!config.devServer) {
            throw new Error('Webpack Dev Server configuration was not set.');
        }
        let locale;
        if (i18n.shouldInline) {
            // Dev-server only supports one locale
            locale = [...i18n.inlineLocales][0];
        }
        else if (i18n.hasDefinedSourceLocale) {
            // use source locale if not localizing
            locale = i18n.sourceLocale;
        }
        let webpackConfig = config;
        // If a locale is defined, setup localization
        if (locale) {
            if (i18n.inlineLocales.size > 1) {
                throw new Error('The development server only supports localizing a single locale per build.');
            }
            await setupLocalize(locale, i18n, browserOptions, webpackConfig, cacheOptions, context);
        }
        if (transforms.webpackConfiguration) {
            webpackConfig = await transforms.webpackConfiguration(webpackConfig);
        }
        webpackConfig.plugins ?? (webpackConfig.plugins = []);
        if (browserOptions.index) {
            const { scripts = [], styles = [], baseHref } = browserOptions;
            const entrypoints = (0, package_chunk_sort_1.generateEntryPoints)({
                scripts,
                styles,
                // The below is needed as otherwise HMR for CSS will break.
                // styles.js and runtime.js needs to be loaded as a non-module scripts as otherwise `document.currentScript` will be null.
                // https://github.com/webpack-contrib/mini-css-extract-plugin/blob/90445dd1d81da0c10b9b0e8a17b417d0651816b8/src/hmr/hotModuleReplacement.js#L39
                isHMREnabled: !!webpackConfig.devServer?.hot,
            });
            webpackConfig.plugins.push(new index_html_webpack_plugin_1.IndexHtmlWebpackPlugin({
                indexPath: path.resolve(workspaceRoot, (0, webpack_browser_config_1.getIndexInputFile)(browserOptions.index)),
                outputPath: (0, webpack_browser_config_1.getIndexOutputFile)(browserOptions.index),
                baseHref,
                entrypoints,
                deployUrl: browserOptions.deployUrl,
                sri: browserOptions.subresourceIntegrity,
                cache: cacheOptions,
                postTransform: transforms.indexHtml,
                optimization: (0, utils_1.normalizeOptimization)(browserOptions.optimization),
                crossOrigin: browserOptions.crossOrigin,
                lang: locale,
            }));
        }
        if (browserOptions.serviceWorker) {
            webpackConfig.plugins.push(new service_worker_plugin_1.ServiceWorkerPlugin({
                baseHref: browserOptions.baseHref,
                root: context.workspaceRoot,
                projectRoot,
                ngswConfigPath: browserOptions.ngswConfigPath,
            }));
        }
        return {
            browserOptions,
            webpackConfig,
            projectRoot,
        };
    }
    return (0, rxjs_1.from)(setup()).pipe((0, rxjs_1.switchMap)(({ browserOptions, webpackConfig }) => {
        return (0, build_webpack_1.runWebpackDevServer)(webpackConfig, context, {
            logging: transforms.logging || (0, stats_1.createWebpackLoggingCallback)(browserOptions, logger),
            webpackFactory: require('webpack'),
            webpackDevServerFactory: require('webpack-dev-server'),
        }).pipe((0, rxjs_1.concatMap)(async (buildEvent, index) => {
            const webpackRawStats = buildEvent.webpackStats;
            if (!webpackRawStats) {
                throw new Error('Webpack stats build result is required.');
            }
            // Resolve serve address.
            const publicPath = webpackConfig.devServer?.devMiddleware?.publicPath;
            const serverAddress = url.format({
                protocol: options.ssl ? 'https' : 'http',
                hostname: options.host === '0.0.0.0' ? 'localhost' : options.host,
                port: buildEvent.port,
                pathname: typeof publicPath === 'string' ? publicPath : undefined,
            });
            if (index === 0) {
                logger.info('\n' +
                    core_1.tags.oneLine `
              **
              Angular Live Development Server is listening on ${options.host}:${buildEvent.port},
              open your browser on ${serverAddress}
              **
            ` +
                    '\n');
                if (options.open) {
                    const open = (await Promise.resolve().then(() => __importStar(require('open')))).default;
                    await open(serverAddress);
                }
            }
            if (buildEvent.success) {
                logger.info(`\n${color_1.colors.greenBright(color_1.colors.symbols.check)} Compiled successfully.`);
            }
            else {
                logger.info(`\n${color_1.colors.redBright(color_1.colors.symbols.cross)} Failed to compile.`);
            }
            return {
                ...buildEvent,
                baseUrl: serverAddress,
                stats: (0, stats_1.generateBuildEventStats)(webpackRawStats, browserOptions),
            };
        }));
    }));
}
exports.serveWebpackBrowser = serveWebpackBrowser;
async function setupLocalize(locale, i18n, browserOptions, webpackConfig, cacheOptions, context) {
    const localeDescription = i18n.locales[locale];
    // Modify main entrypoint to include locale data
    if (localeDescription?.dataPath &&
        typeof webpackConfig.entry === 'object' &&
        !Array.isArray(webpackConfig.entry) &&
        webpackConfig.entry['main']) {
        if (Array.isArray(webpackConfig.entry['main'])) {
            webpackConfig.entry['main'].unshift(localeDescription.dataPath);
        }
        else {
            webpackConfig.entry['main'] = [
                localeDescription.dataPath,
                webpackConfig.entry['main'],
            ];
        }
    }
    let missingTranslationBehavior = browserOptions.i18nMissingTranslation || 'ignore';
    let translation = localeDescription?.translation || {};
    if (locale === i18n.sourceLocale) {
        missingTranslationBehavior = 'ignore';
        translation = {};
    }
    const i18nLoaderOptions = {
        locale,
        missingTranslationBehavior,
        translation: i18n.shouldInline ? translation : undefined,
        translationFiles: localeDescription?.files.map((file) => path.resolve(context.workspaceRoot, file.path)),
    };
    const i18nRule = {
        test: /\.[cm]?[tj]sx?$/,
        enforce: 'post',
        use: [
            {
                loader: require.resolve('../../babel/webpack-loader'),
                options: {
                    cacheDirectory: (cacheOptions.enabled && path.join(cacheOptions.path, 'babel-dev-server-i18n')) ||
                        false,
                    cacheIdentifier: JSON.stringify({
                        locale,
                        translationIntegrity: localeDescription?.files.map((file) => file.integrity),
                    }),
                    i18n: i18nLoaderOptions,
                },
            },
        ],
    };
    // Get the rules and ensure the Webpack configuration is setup properly
    const rules = webpackConfig.module?.rules || [];
    if (!webpackConfig.module) {
        webpackConfig.module = { rules };
    }
    else if (!webpackConfig.module.rules) {
        webpackConfig.module.rules = rules;
    }
    rules.push(i18nRule);
    // Add a plugin to reload translation files on rebuilds
    const loader = await (0, load_translations_1.createTranslationLoader)();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    webpackConfig.plugins.push({
        apply: (compiler) => {
            compiler.hooks.thisCompilation.tap('build-angular', (compilation) => {
                if (i18n.shouldInline && i18nLoaderOptions.translation === undefined) {
                    // Reload translations
                    (0, i18n_options_1.loadTranslations)(locale, localeDescription, context.workspaceRoot, loader, {
                        warn(message) {
                            (0, webpack_diagnostics_1.addWarning)(compilation, message);
                        },
                        error(message) {
                            (0, webpack_diagnostics_1.addError)(compilation, message);
                        },
                    }, undefined, browserOptions.i18nDuplicateTranslation);
                    i18nLoaderOptions.translation = localeDescription.translation ?? {};
                }
                compilation.hooks.finishModules.tap('build-angular', () => {
                    // After loaders are finished, clear out the now unneeded translations
                    i18nLoaderOptions.translation = undefined;
                });
            });
        },
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2VicGFjay1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3dlYnBhY2stc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQW1GO0FBQ25GLGlFQUl1QztBQUN2QywrQ0FBa0Q7QUFDbEQsMkNBQTZCO0FBQzdCLCtCQUE4RDtBQUM5RCx5Q0FBMkI7QUFJM0IsdUNBQW9EO0FBQ3BELHVEQUFtRDtBQUNuRCw2Q0FBMkM7QUFDM0MsMkRBQXlFO0FBRXpFLHFFQUF3RTtBQUN4RSxpRUFBNkY7QUFDN0YsdUVBQXFFO0FBQ3JFLHlEQUErRDtBQUMvRCxpREFBcUU7QUFDckUsK0VBSTRDO0FBQzVDLHlFQUF1RTtBQUN2RSxtREFBNkY7QUFDN0YsK0ZBQXlGO0FBQ3pGLHVGQUFrRjtBQUNsRixxREFJbUM7QUFDbkMsOENBQWtGO0FBYWxGOzs7Ozs7OztHQVFHO0FBQ0gsa0RBQWtEO0FBQ2xELFNBQWdCLG1CQUFtQixDQUNqQyxPQUFnQyxFQUNoQyxPQUF1QixFQUN2QixhQUlJLEVBQUU7SUFFTix5QkFBeUI7SUFDekIsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsR0FBRyxPQUFPLENBQUM7SUFDMUMsSUFBQSx3Q0FBOEIsRUFBQyxhQUFhLENBQUMsQ0FBQztJQUU5QyxNQUFNLGFBQWEsR0FBRyxJQUFBLGtDQUFzQixFQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUVwRSxLQUFLLFVBQVUsS0FBSztRQUtsQixNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQztRQUM1QyxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ2hCLE1BQU0sSUFBSSxLQUFLLENB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S0FBSyxFQUFFLENBQUMsUUFBMEIsRUFBRSxFQUFFO1lBQ3BDLFFBQVEsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRTtnQkFDbEUsSUFBSSxJQUFJLENBQUMsWUFBWSxJQUFJLGlCQUFpQixDQUFDLFdBQVcsS0FBSyxTQUFTLEVBQUU7b0JBQ3BFLHNCQUFzQjtvQkFDdEIsSUFBQSwrQkFBZ0IsRUFDZCxNQUFNLEVBQ04saUJBQWlCLEVBQ2pCLE9BQU8sQ0FBQyxhQUFhLEVBQ3JCLE1BQU0sRUFDTjt3QkFDRSxJQUFJLENBQUMsT0FBTzs0QkFDVixJQUFBLGdDQUFVLEVBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO3dCQUNuQyxDQUFDO3dCQUNELEtBQUssQ0FBQyxPQUFPOzRCQUNYLElBQUEsOEJBQVEsRUFBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7d0JBQ2pDLENBQUM7cUJBQ0YsRUFDRCxTQUFTLEVBQ1QsY0FBYyxDQUFDLHdCQUF3QixDQUN4QyxDQUFDO29CQUVGLGlCQUFpQixDQUFDLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQyxXQUFXLElBQUksRUFBRSxDQUFDO2lCQUNyRTtnQkFFRCxXQUFXLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLEdBQUcsRUFBRTtvQkFDeEQsc0VBQXNFO29CQUN0RSxpQkFBaUIsQ0FBQyxXQUFXLEdBQUcsU0FBUyxDQUFDO2dCQUM1QyxDQUFDLENBQUMsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztLQUNGLENBQUMsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIHRhcmdldEZyb21UYXJnZXRTdHJpbmcgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7XG4gIERldlNlcnZlckJ1aWxkT3V0cHV0LFxuICBXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrLFxuICBydW5XZWJwYWNrRGV2U2VydmVyLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyBqc29uLCB0YWdzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGNvbmNhdE1hcCwgZnJvbSwgc3dpdGNoTWFwIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcbmltcG9ydCB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHdlYnBhY2tEZXZTZXJ2ZXIgZnJvbSAnd2VicGFjay1kZXYtc2VydmVyJztcbmltcG9ydCB7IEV4ZWN1dGlvblRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vdHJhbnNmb3Jtcyc7XG5pbXBvcnQgeyBub3JtYWxpemVPcHRpbWl6YXRpb24gfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBjaGVja1BvcnQgfSBmcm9tICcuLi8uLi91dGlscy9jaGVjay1wb3J0JztcbmltcG9ydCB7IGNvbG9ycyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvbG9yJztcbmltcG9ydCB7IEkxOG5PcHRpb25zLCBsb2FkVHJhbnNsYXRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IEluZGV4SHRtbFRyYW5zZm9ybSB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgY3JlYXRlVHJhbnNsYXRpb25Mb2FkZXIgfSBmcm9tICcuLi8uLi91dGlscy9sb2FkLXRyYW5zbGF0aW9ucyc7XG5pbXBvcnQgeyBOb3JtYWxpemVkQ2FjaGVkT3B0aW9ucywgbm9ybWFsaXplQ2FjaGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvbm9ybWFsaXplLWNhY2hlJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMgfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUgfSBmcm9tICcuLi8uLi91dGlscy9wdXJnZS1jYWNoZSc7XG5pbXBvcnQgeyBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24gfSBmcm9tICcuLi8uLi91dGlscy92ZXJzaW9uJztcbmltcG9ydCB7XG4gIGdlbmVyYXRlSTE4bkJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQsXG4gIGdldEluZGV4SW5wdXRGaWxlLFxuICBnZXRJbmRleE91dHB1dEZpbGUsXG59IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgYWRkRXJyb3IsIGFkZFdhcm5pbmcgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWRpYWdub3N0aWNzJztcbmltcG9ydCB7IGdldENvbW1vbkNvbmZpZywgZ2V0RGV2U2VydmVyQ29uZmlnLCBnZXRTdHlsZXNDb25maWcgfSBmcm9tICcuLi8uLi93ZWJwYWNrL2NvbmZpZ3MnO1xuaW1wb3J0IHsgSW5kZXhIdG1sV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3dlYnBhY2svcGx1Z2lucy9pbmRleC1odG1sLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IFNlcnZpY2VXb3JrZXJQbHVnaW4gfSBmcm9tICcuLi8uLi93ZWJwYWNrL3BsdWdpbnMvc2VydmljZS13b3JrZXItcGx1Z2luJztcbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnRTdGF0cyxcbiAgY3JlYXRlV2VicGFja0xvZ2dpbmdDYWxsYmFjayxcbiAgZ2VuZXJhdGVCdWlsZEV2ZW50U3RhdHMsXG59IGZyb20gJy4uLy4uL3dlYnBhY2svdXRpbHMvc3RhdHMnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyU2NoZW1hLCBPdXRwdXRIYXNoaW5nIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5leHBvcnQgdHlwZSBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyA9IFNjaGVtYTtcblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIHR5cGUgaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCB0eXBlIERldlNlcnZlckJ1aWxkZXJPdXRwdXQgPSBEZXZTZXJ2ZXJCdWlsZE91dHB1dCAmIHtcbiAgYmFzZVVybDogc3RyaW5nO1xuICBzdGF0czogQnVpbGRFdmVudFN0YXRzO1xufTtcblxuLyoqXG4gKiBSZXVzYWJsZSBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgQW5ndWxhciBXZWJwYWNrIGRldmVsb3BtZW50IHNlcnZlciBidWlsZGVyLlxuICogQHBhcmFtIG9wdGlvbnMgRGV2IFNlcnZlciBvcHRpb25zLlxuICogQHBhcmFtIGNvbnRleHQgVGhlIGJ1aWxkIGNvbnRleHQuXG4gKiBAcGFyYW0gdHJhbnNmb3JtcyBBIG1hcCBvZiB0cmFuc2Zvcm1zIHRoYXQgY2FuIGJlIHVzZWQgdG8gaG9vayBpbnRvIHNvbWUgbG9naWMgKHN1Y2ggYXNcbiAqICAgICB0cmFuc2Zvcm1pbmcgd2VicGFjayBjb25maWd1cmF0aW9uIGJlZm9yZSBwYXNzaW5nIGl0IHRvIHdlYnBhY2spLlxuICpcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gc2VydmVXZWJwYWNrQnJvd3NlcihcbiAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zOiB7XG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb24/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+O1xuICAgIGxvZ2dpbmc/OiBXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrO1xuICAgIGluZGV4SHRtbD86IEluZGV4SHRtbFRyYW5zZm9ybTtcbiAgfSA9IHt9LFxuKTogT2JzZXJ2YWJsZTxEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0PiB7XG4gIC8vIENoZWNrIEFuZ3VsYXIgdmVyc2lvbi5cbiAgY29uc3QgeyBsb2dnZXIsIHdvcmtzcGFjZVJvb3QgfSA9IGNvbnRleHQ7XG4gIGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbih3b3Jrc3BhY2VSb290KTtcblxuICBjb25zdCBicm93c2VyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLmJyb3dzZXJUYXJnZXQpO1xuXG4gIGFzeW5jIGZ1bmN0aW9uIHNldHVwKCk6IFByb21pc2U8e1xuICAgIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYTtcbiAgICB3ZWJwYWNrQ29uZmlnOiB3ZWJwYWNrLkNvbmZpZ3VyYXRpb247XG4gICAgcHJvamVjdFJvb3Q6IHN0cmluZztcbiAgfT4ge1xuICAgIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQ/LnByb2plY3Q7XG4gICAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldC4nKTtcbiAgICB9XG5cbiAgICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgICBhd2FpdCBwdXJnZVN0YWxlQnVpbGRDYWNoZShjb250ZXh0KTtcblxuICAgIG9wdGlvbnMucG9ydCA9IGF3YWl0IGNoZWNrUG9ydChvcHRpb25zLnBvcnQgPz8gNDIwMCwgb3B0aW9ucy5ob3N0IHx8ICdsb2NhbGhvc3QnKTtcblxuICAgIGlmIChvcHRpb25zLmhtcikge1xuICAgICAgbG9nZ2VyLndhcm4odGFncy5zdHJpcEluZGVudHNgTk9USUNFOiBIb3QgTW9kdWxlIFJlcGxhY2VtZW50IChITVIpIGlzIGVuYWJsZWQgZm9yIHRoZSBkZXYgc2VydmVyLlxuICAgICAgU2VlIGh0dHBzOi8vd2VicGFjay5qcy5vcmcvZ3VpZGVzL2hvdC1tb2R1bGUtcmVwbGFjZW1lbnQgZm9yIGluZm9ybWF0aW9uIG9uIHdvcmtpbmcgd2l0aCBITVIgZm9yIFdlYnBhY2suYCk7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgIW9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjayAmJlxuICAgICAgb3B0aW9ucy5ob3N0ICYmXG4gICAgICAhL14xMjdcXC5cXGQrXFwuXFxkK1xcLlxcZCsvZy50ZXN0KG9wdGlvbnMuaG9zdCkgJiZcbiAgICAgIG9wdGlvbnMuaG9zdCAhPT0gJ2xvY2FsaG9zdCdcbiAgICApIHtcbiAgICAgIGxvZ2dlci53YXJuKHRhZ3Muc3RyaXBJbmRlbnRgXG4gICAgICAgIFdhcm5pbmc6IFRoaXMgaXMgYSBzaW1wbGUgc2VydmVyIGZvciB1c2UgaW4gdGVzdGluZyBvciBkZWJ1Z2dpbmcgQW5ndWxhciBhcHBsaWNhdGlvbnNcbiAgICAgICAgbG9jYWxseS4gSXQgaGFzbid0IGJlZW4gcmV2aWV3ZWQgZm9yIHNlY3VyaXR5IGlzc3Vlcy5cblxuICAgICAgICBCaW5kaW5nIHRoaXMgc2VydmVyIHRvIGFuIG9wZW4gY29ubmVjdGlvbiBjYW4gcmVzdWx0IGluIGNvbXByb21pc2luZyB5b3VyIGFwcGxpY2F0aW9uIG9yXG4gICAgICAgIGNvbXB1dGVyLiBVc2luZyBhIGRpZmZlcmVudCBob3N0IHRoYW4gdGhlIG9uZSBwYXNzZWQgdG8gdGhlIFwiLS1ob3N0XCIgZmxhZyBtaWdodCByZXN1bHQgaW5cbiAgICAgICAgd2Vic29ja2V0IGNvbm5lY3Rpb24gaXNzdWVzLiBZb3UgbWlnaHQgbmVlZCB0byB1c2UgXCItLWRpc2FibGUtaG9zdC1jaGVja1wiIGlmIHRoYXQncyB0aGVcbiAgICAgICAgY2FzZS5cbiAgICAgIGApO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLmRpc2FibGVIb3N0Q2hlY2spIHtcbiAgICAgIGxvZ2dlci53YXJuKHRhZ3Mub25lTGluZWBcbiAgICAgICAgV2FybmluZzogUnVubmluZyBhIHNlcnZlciB3aXRoIC0tZGlzYWJsZS1ob3N0LWNoZWNrIGlzIGEgc2VjdXJpdHkgcmlzay5cbiAgICAgICAgU2VlIGh0dHBzOi8vbWVkaXVtLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LXNlcnZlci1taWRkbGV3YXJlLXNlY3VyaXR5LWlzc3Vlcy0xNDg5ZDk1MDg3NGFcbiAgICAgICAgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gICAgICBgKTtcbiAgICB9XG4gICAgLy8gR2V0IHRoZSBicm93c2VyIGNvbmZpZ3VyYXRpb24gZnJvbSB0aGUgdGFyZ2V0IG5hbWUuXG4gICAgY29uc3QgcmF3QnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC5nZXRUYXJnZXRPcHRpb25zKGJyb3dzZXJUYXJnZXQpKSBhcyBqc29uLkpzb25PYmplY3QgJlxuICAgICAgQnJvd3NlckJ1aWxkZXJTY2hlbWE7XG5cbiAgICBpZiAocmF3QnJvd3Nlck9wdGlvbnMub3V0cHV0SGFzaGluZyAmJiByYXdCcm93c2VyT3B0aW9ucy5vdXRwdXRIYXNoaW5nICE9PSBPdXRwdXRIYXNoaW5nLk5vbmUpIHtcbiAgICAgIC8vIERpc2FibGUgb3V0cHV0IGhhc2hpbmcgZm9yIGRldiBidWlsZCBhcyB0aGlzIGNhbiBjYXVzZSBtZW1vcnkgbGVha3NcbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay1kZXYtc2VydmVyL2lzc3Vlcy8zNzcjaXNzdWVjb21tZW50LTI0MTI1ODQwNVxuICAgICAgcmF3QnJvd3Nlck9wdGlvbnMub3V0cHV0SGFzaGluZyA9IE91dHB1dEhhc2hpbmcuTm9uZTtcbiAgICAgIGxvZ2dlci53YXJuKGBXYXJuaW5nOiAnb3V0cHV0SGFzaGluZycgb3B0aW9uIGlzIGRpc2FibGVkIHdoZW4gdXNpbmcgdGhlIGRldi1zZXJ2ZXIuYCk7XG4gICAgfVxuXG4gICAgY29uc3QgbWV0YWRhdGEgPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gICAgY29uc3QgY2FjaGVPcHRpb25zID0gbm9ybWFsaXplQ2FjaGVPcHRpb25zKG1ldGFkYXRhLCBjb250ZXh0LndvcmtzcGFjZVJvb3QpO1xuXG4gICAgY29uc3QgYnJvd3Nlck5hbWUgPSBhd2FpdCBjb250ZXh0LmdldEJ1aWxkZXJOYW1lRm9yVGFyZ2V0KGJyb3dzZXJUYXJnZXQpO1xuXG4gICAgLy8gSXNzdWUgYSB3YXJuaW5nIHRoYXQgdGhlIGRldi1zZXJ2ZXIgZG9lcyBub3QgY3VycmVudGx5IHN1cHBvcnQgdGhlIGV4cGVyaW1lbnRhbCBlc2J1aWxkLVxuICAgIC8vIGJhc2VkIGJ1aWxkZXIgYW5kIHdpbGwgdXNlIFdlYnBhY2suXG4gICAgaWYgKGJyb3dzZXJOYW1lID09PSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6YnJvd3Nlci1lc2J1aWxkJykge1xuICAgICAgbG9nZ2VyLndhcm4oXG4gICAgICAgICdXQVJOSU5HOiBUaGUgZXhwZXJpbWVudGFsIGVzYnVpbGQtYmFzZWQgYnVpbGRlciBpcyBub3QgY3VycmVudGx5IHN1cHBvcnRlZCAnICtcbiAgICAgICAgICAnYnkgdGhlIGRldi1zZXJ2ZXIuIFRoZSBzdGFibGUgV2VicGFjay1iYXNlZCBidWlsZGVyIHdpbGwgYmUgdXNlZCBpbnN0ZWFkLicsXG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IGJyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQudmFsaWRhdGVPcHRpb25zKFxuICAgICAge1xuICAgICAgICAuLi5yYXdCcm93c2VyT3B0aW9ucyxcbiAgICAgICAgd2F0Y2g6IG9wdGlvbnMud2F0Y2gsXG4gICAgICAgIHZlcmJvc2U6IG9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgLy8gSW4gZGV2IHNlcnZlciB3ZSBzaG91bGQgbm90IGhhdmUgYnVkZ2V0cyBiZWNhdXNlIG9mIGV4dHJhIGxpYnMgc3VjaCBhcyBzb2Nrcy1qc1xuICAgICAgICBidWRnZXRzOiB1bmRlZmluZWQsXG4gICAgICB9IGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICAgICAgYnJvd3Nlck5hbWUsXG4gICAgKSkgYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJTY2hlbWE7XG5cbiAgICBjb25zdCB7IHN0eWxlcywgc2NyaXB0cyB9ID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbik7XG4gICAgaWYgKHNjcmlwdHMgfHwgc3R5bGVzLm1pbmlmeSkge1xuICAgICAgbG9nZ2VyLmVycm9yKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgIFRoaXMgaXMgYSBzaW1wbGUgc2VydmVyIGZvciB1c2UgaW4gdGVzdGluZyBvciBkZWJ1Z2dpbmcgQW5ndWxhciBhcHBsaWNhdGlvbnMgbG9jYWxseS5cbiAgICAgICAgSXQgaGFzbid0IGJlZW4gcmV2aWV3ZWQgZm9yIHNlY3VyaXR5IGlzc3Vlcy5cblxuICAgICAgICBET04nVCBVU0UgSVQgRk9SIFBST0RVQ1RJT04hXG4gICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgIGApO1xuICAgIH1cblxuICAgIGNvbnN0IHsgY29uZmlnLCBwcm9qZWN0Um9vdCwgaTE4biB9ID0gYXdhaXQgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChcbiAgICAgIGJyb3dzZXJPcHRpb25zLFxuICAgICAgY29udGV4dCxcbiAgICAgICh3Y28pID0+IFtnZXREZXZTZXJ2ZXJDb25maWcod2NvKSwgZ2V0Q29tbW9uQ29uZmlnKHdjbyksIGdldFN0eWxlc0NvbmZpZyh3Y28pXSxcbiAgICAgIG9wdGlvbnMsXG4gICAgKTtcblxuICAgIGlmICghY29uZmlnLmRldlNlcnZlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdXZWJwYWNrIERldiBTZXJ2ZXIgY29uZmlndXJhdGlvbiB3YXMgbm90IHNldC4nKTtcbiAgICB9XG5cbiAgICBsZXQgbG9jYWxlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgaWYgKGkxOG4uc2hvdWxkSW5saW5lKSB7XG4gICAgICAvLyBEZXYtc2VydmVyIG9ubHkgc3VwcG9ydHMgb25lIGxvY2FsZVxuICAgICAgbG9jYWxlID0gWy4uLmkxOG4uaW5saW5lTG9jYWxlc11bMF07XG4gICAgfSBlbHNlIGlmIChpMThuLmhhc0RlZmluZWRTb3VyY2VMb2NhbGUpIHtcbiAgICAgIC8vIHVzZSBzb3VyY2UgbG9jYWxlIGlmIG5vdCBsb2NhbGl6aW5nXG4gICAgICBsb2NhbGUgPSBpMThuLnNvdXJjZUxvY2FsZTtcbiAgICB9XG5cbiAgICBsZXQgd2VicGFja0NvbmZpZyA9IGNvbmZpZztcblxuICAgIC8vIElmIGEgbG9jYWxlIGlzIGRlZmluZWQsIHNldHVwIGxvY2FsaXphdGlvblxuICAgIGlmIChsb2NhbGUpIHtcbiAgICAgIGlmIChpMThuLmlubGluZUxvY2FsZXMuc2l6ZSA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdUaGUgZGV2ZWxvcG1lbnQgc2VydmVyIG9ubHkgc3VwcG9ydHMgbG9jYWxpemluZyBhIHNpbmdsZSBsb2NhbGUgcGVyIGJ1aWxkLicsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHNldHVwTG9jYWxpemUobG9jYWxlLCBpMThuLCBicm93c2VyT3B0aW9ucywgd2VicGFja0NvbmZpZywgY2FjaGVPcHRpb25zLCBjb250ZXh0KTtcbiAgICB9XG5cbiAgICBpZiAodHJhbnNmb3Jtcy53ZWJwYWNrQ29uZmlndXJhdGlvbikge1xuICAgICAgd2VicGFja0NvbmZpZyA9IGF3YWl0IHRyYW5zZm9ybXMud2VicGFja0NvbmZpZ3VyYXRpb24od2VicGFja0NvbmZpZyk7XG4gICAgfVxuXG4gICAgd2VicGFja0NvbmZpZy5wbHVnaW5zID8/PSBbXTtcblxuICAgIGlmIChicm93c2VyT3B0aW9ucy5pbmRleCkge1xuICAgICAgY29uc3QgeyBzY3JpcHRzID0gW10sIHN0eWxlcyA9IFtdLCBiYXNlSHJlZiB9ID0gYnJvd3Nlck9wdGlvbnM7XG4gICAgICBjb25zdCBlbnRyeXBvaW50cyA9IGdlbmVyYXRlRW50cnlQb2ludHMoe1xuICAgICAgICBzY3JpcHRzLFxuICAgICAgICBzdHlsZXMsXG4gICAgICAgIC8vIFRoZSBiZWxvdyBpcyBuZWVkZWQgYXMgb3RoZXJ3aXNlIEhNUiBmb3IgQ1NTIHdpbGwgYnJlYWsuXG4gICAgICAgIC8vIHN0eWxlcy5qcyBhbmQgcnVudGltZS5qcyBuZWVkcyB0byBiZSBsb2FkZWQgYXMgYSBub24tbW9kdWxlIHNjcmlwdHMgYXMgb3RoZXJ3aXNlIGBkb2N1bWVudC5jdXJyZW50U2NyaXB0YCB3aWxsIGJlIG51bGwuXG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvbWluaS1jc3MtZXh0cmFjdC1wbHVnaW4vYmxvYi85MDQ0NWRkMWQ4MWRhMGMxMGI5YjBlOGExN2I0MTdkMDY1MTgxNmI4L3NyYy9obXIvaG90TW9kdWxlUmVwbGFjZW1lbnQuanMjTDM5XG4gICAgICAgIGlzSE1SRW5hYmxlZDogISF3ZWJwYWNrQ29uZmlnLmRldlNlcnZlcj8uaG90LFxuICAgICAgfSk7XG5cbiAgICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy5wdXNoKFxuICAgICAgICBuZXcgSW5kZXhIdG1sV2VicGFja1BsdWdpbih7XG4gICAgICAgICAgaW5kZXhQYXRoOiBwYXRoLnJlc29sdmUod29ya3NwYWNlUm9vdCwgZ2V0SW5kZXhJbnB1dEZpbGUoYnJvd3Nlck9wdGlvbnMuaW5kZXgpKSxcbiAgICAgICAgICBvdXRwdXRQYXRoOiBnZXRJbmRleE91dHB1dEZpbGUoYnJvd3Nlck9wdGlvbnMuaW5kZXgpLFxuICAgICAgICAgIGJhc2VIcmVmLFxuICAgICAgICAgIGVudHJ5cG9pbnRzLFxuICAgICAgICAgIGRlcGxveVVybDogYnJvd3Nlck9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgICAgIHNyaTogYnJvd3Nlck9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgICAgICAgY2FjaGU6IGNhY2hlT3B0aW9ucyxcbiAgICAgICAgICBwb3N0VHJhbnNmb3JtOiB0cmFuc2Zvcm1zLmluZGV4SHRtbCxcbiAgICAgICAgICBvcHRpbWl6YXRpb246IG5vcm1hbGl6ZU9wdGltaXphdGlvbihicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24pLFxuICAgICAgICAgIGNyb3NzT3JpZ2luOiBicm93c2VyT3B0aW9ucy5jcm9zc09yaWdpbixcbiAgICAgICAgICBsYW5nOiBsb2NhbGUsXG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoYnJvd3Nlck9wdGlvbnMuc2VydmljZVdvcmtlcikge1xuICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnB1c2goXG4gICAgICAgIG5ldyBTZXJ2aWNlV29ya2VyUGx1Z2luKHtcbiAgICAgICAgICBiYXNlSHJlZjogYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgICAgcm9vdDogY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgICAgIHByb2plY3RSb290LFxuICAgICAgICAgIG5nc3dDb25maWdQYXRoOiBicm93c2VyT3B0aW9ucy5uZ3N3Q29uZmlnUGF0aCxcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBicm93c2VyT3B0aW9ucyxcbiAgICAgIHdlYnBhY2tDb25maWcsXG4gICAgICBwcm9qZWN0Um9vdCxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIGZyb20oc2V0dXAoKSkucGlwZShcbiAgICBzd2l0Y2hNYXAoKHsgYnJvd3Nlck9wdGlvbnMsIHdlYnBhY2tDb25maWcgfSkgPT4ge1xuICAgICAgcmV0dXJuIHJ1bldlYnBhY2tEZXZTZXJ2ZXIod2VicGFja0NvbmZpZywgY29udGV4dCwge1xuICAgICAgICBsb2dnaW5nOiB0cmFuc2Zvcm1zLmxvZ2dpbmcgfHwgY3JlYXRlV2VicGFja0xvZ2dpbmdDYWxsYmFjayhicm93c2VyT3B0aW9ucywgbG9nZ2VyKSxcbiAgICAgICAgd2VicGFja0ZhY3Rvcnk6IHJlcXVpcmUoJ3dlYnBhY2snKSBhcyB0eXBlb2Ygd2VicGFjayxcbiAgICAgICAgd2VicGFja0RldlNlcnZlckZhY3Rvcnk6IHJlcXVpcmUoJ3dlYnBhY2stZGV2LXNlcnZlcicpIGFzIHR5cGVvZiB3ZWJwYWNrRGV2U2VydmVyLFxuICAgICAgfSkucGlwZShcbiAgICAgICAgY29uY2F0TWFwKGFzeW5jIChidWlsZEV2ZW50LCBpbmRleCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHdlYnBhY2tSYXdTdGF0cyA9IGJ1aWxkRXZlbnQud2VicGFja1N0YXRzO1xuICAgICAgICAgIGlmICghd2VicGFja1Jhd1N0YXRzKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYnBhY2sgc3RhdHMgYnVpbGQgcmVzdWx0IGlzIHJlcXVpcmVkLicpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFJlc29sdmUgc2VydmUgYWRkcmVzcy5cbiAgICAgICAgICBjb25zdCBwdWJsaWNQYXRoID0gd2VicGFja0NvbmZpZy5kZXZTZXJ2ZXI/LmRldk1pZGRsZXdhcmU/LnB1YmxpY1BhdGg7XG5cbiAgICAgICAgICBjb25zdCBzZXJ2ZXJBZGRyZXNzID0gdXJsLmZvcm1hdCh7XG4gICAgICAgICAgICBwcm90b2NvbDogb3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnLFxuICAgICAgICAgICAgaG9zdG5hbWU6IG9wdGlvbnMuaG9zdCA9PT0gJzAuMC4wLjAnID8gJ2xvY2FsaG9zdCcgOiBvcHRpb25zLmhvc3QsXG4gICAgICAgICAgICBwb3J0OiBidWlsZEV2ZW50LnBvcnQsXG4gICAgICAgICAgICBwYXRobmFtZTogdHlwZW9mIHB1YmxpY1BhdGggPT09ICdzdHJpbmcnID8gcHVibGljUGF0aCA6IHVuZGVmaW5lZCxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGlmIChpbmRleCA9PT0gMCkge1xuICAgICAgICAgICAgbG9nZ2VyLmluZm8oXG4gICAgICAgICAgICAgICdcXG4nICtcbiAgICAgICAgICAgICAgICB0YWdzLm9uZUxpbmVgXG4gICAgICAgICAgICAgICoqXG4gICAgICAgICAgICAgIEFuZ3VsYXIgTGl2ZSBEZXZlbG9wbWVudCBTZXJ2ZXIgaXMgbGlzdGVuaW5nIG9uICR7b3B0aW9ucy5ob3N0fToke2J1aWxkRXZlbnQucG9ydH0sXG4gICAgICAgICAgICAgIG9wZW4geW91ciBicm93c2VyIG9uICR7c2VydmVyQWRkcmVzc31cbiAgICAgICAgICAgICAgKipcbiAgICAgICAgICAgIGAgK1xuICAgICAgICAgICAgICAgICdcXG4nLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMub3Blbikge1xuICAgICAgICAgICAgICBjb25zdCBvcGVuID0gKGF3YWl0IGltcG9ydCgnb3BlbicpKS5kZWZhdWx0O1xuICAgICAgICAgICAgICBhd2FpdCBvcGVuKHNlcnZlckFkZHJlc3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChidWlsZEV2ZW50LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBcXG4ke2NvbG9ycy5ncmVlbkJyaWdodChjb2xvcnMuc3ltYm9scy5jaGVjayl9IENvbXBpbGVkIHN1Y2Nlc3NmdWxseS5gKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9nZ2VyLmluZm8oYFxcbiR7Y29sb3JzLnJlZEJyaWdodChjb2xvcnMuc3ltYm9scy5jcm9zcyl9IEZhaWxlZCB0byBjb21waWxlLmApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5idWlsZEV2ZW50LFxuICAgICAgICAgICAgYmFzZVVybDogc2VydmVyQWRkcmVzcyxcbiAgICAgICAgICAgIHN0YXRzOiBnZW5lcmF0ZUJ1aWxkRXZlbnRTdGF0cyh3ZWJwYWNrUmF3U3RhdHMsIGJyb3dzZXJPcHRpb25zKSxcbiAgICAgICAgICB9IGFzIERldlNlcnZlckJ1aWxkZXJPdXRwdXQ7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9KSxcbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2V0dXBMb2NhbGl6ZShcbiAgbG9jYWxlOiBzdHJpbmcsXG4gIGkxOG46IEkxOG5PcHRpb25zLFxuICBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIHdlYnBhY2tDb25maWc6IHdlYnBhY2suQ29uZmlndXJhdGlvbixcbiAgY2FjaGVPcHRpb25zOiBOb3JtYWxpemVkQ2FjaGVkT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pIHtcbiAgY29uc3QgbG9jYWxlRGVzY3JpcHRpb24gPSBpMThuLmxvY2FsZXNbbG9jYWxlXTtcblxuICAvLyBNb2RpZnkgbWFpbiBlbnRyeXBvaW50IHRvIGluY2x1ZGUgbG9jYWxlIGRhdGFcbiAgaWYgKFxuICAgIGxvY2FsZURlc2NyaXB0aW9uPy5kYXRhUGF0aCAmJlxuICAgIHR5cGVvZiB3ZWJwYWNrQ29uZmlnLmVudHJ5ID09PSAnb2JqZWN0JyAmJlxuICAgICFBcnJheS5pc0FycmF5KHdlYnBhY2tDb25maWcuZW50cnkpICYmXG4gICAgd2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddXG4gICkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXSkpIHtcbiAgICAgIHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXS51bnNoaWZ0KGxvY2FsZURlc2NyaXB0aW9uLmRhdGFQYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddID0gW1xuICAgICAgICBsb2NhbGVEZXNjcmlwdGlvbi5kYXRhUGF0aCxcbiAgICAgICAgd2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddIGFzIHN0cmluZyxcbiAgICAgIF07XG4gICAgfVxuICB9XG5cbiAgbGV0IG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yID0gYnJvd3Nlck9wdGlvbnMuaTE4bk1pc3NpbmdUcmFuc2xhdGlvbiB8fCAnaWdub3JlJztcbiAgbGV0IHRyYW5zbGF0aW9uID0gbG9jYWxlRGVzY3JpcHRpb24/LnRyYW5zbGF0aW9uIHx8IHt9O1xuXG4gIGlmIChsb2NhbGUgPT09IGkxOG4uc291cmNlTG9jYWxlKSB7XG4gICAgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IgPSAnaWdub3JlJztcbiAgICB0cmFuc2xhdGlvbiA9IHt9O1xuICB9XG5cbiAgY29uc3QgaTE4bkxvYWRlck9wdGlvbnMgPSB7XG4gICAgbG9jYWxlLFxuICAgIG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yLFxuICAgIHRyYW5zbGF0aW9uOiBpMThuLnNob3VsZElubGluZSA/IHRyYW5zbGF0aW9uIDogdW5kZWZpbmVkLFxuICAgIHRyYW5zbGF0aW9uRmlsZXM6IGxvY2FsZURlc2NyaXB0aW9uPy5maWxlcy5tYXAoKGZpbGUpID0+XG4gICAgICBwYXRoLnJlc29sdmUoY29udGV4dC53b3Jrc3BhY2VSb290LCBmaWxlLnBhdGgpLFxuICAgICksXG4gIH07XG5cbiAgY29uc3QgaTE4blJ1bGU6IHdlYnBhY2suUnVsZVNldFJ1bGUgPSB7XG4gICAgdGVzdDogL1xcLltjbV0/W3RqXXN4PyQvLFxuICAgIGVuZm9yY2U6ICdwb3N0JyxcbiAgICB1c2U6IFtcbiAgICAgIHtcbiAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJy4uLy4uL2JhYmVsL3dlYnBhY2stbG9hZGVyJyksXG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICBjYWNoZURpcmVjdG9yeTpcbiAgICAgICAgICAgIChjYWNoZU9wdGlvbnMuZW5hYmxlZCAmJiBwYXRoLmpvaW4oY2FjaGVPcHRpb25zLnBhdGgsICdiYWJlbC1kZXYtc2VydmVyLWkxOG4nKSkgfHxcbiAgICAgICAgICAgIGZhbHNlLFxuICAgICAgICAgIGNhY2hlSWRlbnRpZmllcjogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgbG9jYWxlLFxuICAgICAgICAgICAgdHJhbnNsYXRpb25JbnRlZ3JpdHk6IGxvY2FsZURlc2NyaXB0aW9uPy5maWxlcy5tYXAoKGZpbGUpID0+IGZpbGUuaW50ZWdyaXR5KSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBpMThuOiBpMThuTG9hZGVyT3B0aW9ucyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfTtcblxuICAvLyBHZXQgdGhlIHJ1bGVzIGFuZCBlbnN1cmUgdGhlIFdlYnBhY2sgY29uZmlndXJhdGlvbiBpcyBzZXR1cCBwcm9wZXJseVxuICBjb25zdCBydWxlcyA9IHdlYnBhY2tDb25maWcubW9kdWxlPy5ydWxlcyB8fCBbXTtcbiAgaWYgKCF3ZWJwYWNrQ29uZmlnLm1vZHVsZSkge1xuICAgIHdlYnBhY2tDb25maWcubW9kdWxlID0geyBydWxlcyB9O1xuICB9IGVsc2UgaWYgKCF3ZWJwYWNrQ29uZmlnLm1vZHVsZS5ydWxlcykge1xuICAgIHdlYnBhY2tDb25maWcubW9kdWxlLnJ1bGVzID0gcnVsZXM7XG4gIH1cblxuICBydWxlcy5wdXNoKGkxOG5SdWxlKTtcblxuICAvLyBBZGQgYSBwbHVnaW4gdG8gcmVsb2FkIHRyYW5zbGF0aW9uIGZpbGVzIG9uIHJlYnVpbGRzXG4gIGNvbnN0IGxvYWRlciA9IGF3YWl0IGNyZWF0ZVRyYW5zbGF0aW9uTG9hZGVyKCk7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gIHdlYnBhY2tDb25maWcucGx1Z2lucyEucHVzaCh7XG4gICAgYXBwbHk6IChjb21waWxlcjogd2VicGFjay5Db21waWxlcikgPT4ge1xuICAgICAgY29tcGlsZXIuaG9va3MudGhpc0NvbXBpbGF0aW9uLnRhcCgnYnVpbGQtYW5ndWxhcicsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgICBpZiAoaTE4bi5zaG91bGRJbmxpbmUgJiYgaTE4bkxvYWRlck9wdGlvbnMudHJhbnNsYXRpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIFJlbG9hZCB0cmFuc2xhdGlvbnNcbiAgICAgICAgICBsb2FkVHJhbnNsYXRpb25zKFxuICAgICAgICAgICAgbG9jYWxlLFxuICAgICAgICAgICAgbG9jYWxlRGVzY3JpcHRpb24sXG4gICAgICAgICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICBsb2FkZXIsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHdhcm4obWVzc2FnZSkge1xuICAgICAgICAgICAgICAgIGFkZFdhcm5pbmcoY29tcGlsYXRpb24sIG1lc3NhZ2UpO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBlcnJvcihtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgYWRkRXJyb3IoY29tcGlsYXRpb24sIG1lc3NhZ2UpO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGJyb3dzZXJPcHRpb25zLmkxOG5EdXBsaWNhdGVUcmFuc2xhdGlvbixcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgaTE4bkxvYWRlck9wdGlvbnMudHJhbnNsYXRpb24gPSBsb2NhbGVEZXNjcmlwdGlvbi50cmFuc2xhdGlvbiA/PyB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbXBpbGF0aW9uLmhvb2tzLmZpbmlzaE1vZHVsZXMudGFwKCdidWlsZC1hbmd1bGFyJywgKCkgPT4ge1xuICAgICAgICAgIC8vIEFmdGVyIGxvYWRlcnMgYXJlIGZpbmlzaGVkLCBjbGVhciBvdXQgdGhlIG5vdyB1bm5lZWRlZCB0cmFuc2xhdGlvbnNcbiAgICAgICAgICBpMThuTG9hZGVyT3B0aW9ucy50cmFuc2xhdGlvbiA9IHVuZGVmaW5lZDtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9KTtcbn1cbiJdfQ==