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
        var _a, _b, _c, _d;
        const projectName = (_a = context.target) === null || _a === void 0 ? void 0 : _a.project;
        if (!projectName) {
            throw new Error('The builder requires a target.');
        }
        // Purge old build disk cache.
        await (0, purge_cache_1.purgeStaleBuildCache)(context);
        options.port = await (0, check_port_1.checkPort)((_b = options.port) !== null && _b !== void 0 ? _b : 4200, options.host || 'localhost');
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
        (_c = webpackConfig.plugins) !== null && _c !== void 0 ? _c : (webpackConfig.plugins = []);
        if (browserOptions.index) {
            const { scripts = [], styles = [], baseHref } = browserOptions;
            const entrypoints = (0, package_chunk_sort_1.generateEntryPoints)({
                scripts,
                styles,
                // The below is needed as otherwise HMR for CSS will break.
                // styles.js and runtime.js needs to be loaded as a non-module scripts as otherwise `document.currentScript` will be null.
                // https://github.com/webpack-contrib/mini-css-extract-plugin/blob/90445dd1d81da0c10b9b0e8a17b417d0651816b8/src/hmr/hotModuleReplacement.js#L39
                isHMREnabled: !!((_d = webpackConfig.devServer) === null || _d === void 0 ? void 0 : _d.hot),
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
            var _a, _b;
            const webpackRawStats = buildEvent.webpackStats;
            if (!webpackRawStats) {
                throw new Error('Webpack stats build result is required.');
            }
            // Resolve serve address.
            const publicPath = (_b = (_a = webpackConfig.devServer) === null || _a === void 0 ? void 0 : _a.devMiddleware) === null || _b === void 0 ? void 0 : _b.publicPath;
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
    var _a;
    const localeDescription = i18n.locales[locale];
    // Modify main entrypoint to include locale data
    if ((localeDescription === null || localeDescription === void 0 ? void 0 : localeDescription.dataPath) &&
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
    let translation = (localeDescription === null || localeDescription === void 0 ? void 0 : localeDescription.translation) || {};
    if (locale === i18n.sourceLocale) {
        missingTranslationBehavior = 'ignore';
        translation = {};
    }
    const i18nLoaderOptions = {
        locale,
        missingTranslationBehavior,
        translation: i18n.shouldInline ? translation : undefined,
        translationFiles: localeDescription === null || localeDescription === void 0 ? void 0 : localeDescription.files.map((file) => path.resolve(context.workspaceRoot, file.path)),
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
                        translationIntegrity: localeDescription === null || localeDescription === void 0 ? void 0 : localeDescription.files.map((file) => file.integrity),
                    }),
                    i18n: i18nLoaderOptions,
                },
            },
        ],
    };
    // Get the rules and ensure the Webpack configuration is setup properly
    const rules = ((_a = webpackConfig.module) === null || _a === void 0 ? void 0 : _a.rules) || [];
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
                var _a;
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
                    i18nLoaderOptions.translation = (_a = localeDescription.translation) !== null && _a !== void 0 ? _a : {};
                }
                compilation.hooks.finishModules.tap('build-angular', () => {
                    // After loaders are finished, clear out the now unneeded translations
                    i18nLoaderOptions.translation = undefined;
                });
            });
        },
    });
}
exports.default = (0, architect_1.createBuilder)(serveWebpackBrowser);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQWtHO0FBQ2xHLGlFQUl1QztBQUN2QywrQ0FBa0Q7QUFDbEQsMkNBQTZCO0FBQzdCLCtCQUE4RDtBQUM5RCx5Q0FBMkI7QUFJM0IsdUNBQW9EO0FBQ3BELHVEQUFtRDtBQUNuRCw2Q0FBMkM7QUFDM0MsMkRBQXlFO0FBRXpFLHFFQUF3RTtBQUN4RSxpRUFBNkY7QUFDN0YsdUVBQXFFO0FBQ3JFLHlEQUErRDtBQUMvRCxpREFBcUU7QUFDckUsK0VBSTRDO0FBQzVDLHlFQUF1RTtBQUN2RSxtREFBNkY7QUFDN0YsK0ZBQXlGO0FBQ3pGLHVGQUFrRjtBQUNsRixxREFJbUM7QUFDbkMsOENBQWtGO0FBYWxGOzs7Ozs7OztHQVFHO0FBQ0gsa0RBQWtEO0FBQ2xELFNBQWdCLG1CQUFtQixDQUNqQyxPQUFnQyxFQUNoQyxPQUF1QixFQUN2QixhQUlJLEVBQUU7SUFFTix5QkFBeUI7SUFDekIsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsR0FBRyxPQUFPLENBQUM7SUFDMUMsSUFBQSx3Q0FBOEIsRUFBQyxhQUFhLENBQUMsQ0FBQztJQUU5QyxNQUFNLGFBQWEsR0FBRyxJQUFBLGtDQUFzQixFQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUVwRSxLQUFLLFVBQVUsS0FBSzs7UUFLbEIsTUFBTSxXQUFXLEdBQUcsTUFBQSxPQUFPLENBQUMsTUFBTSwwQ0FBRSxPQUFPLENBQUM7UUFDNUMsSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUNoQixNQUFNLElBQUksS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7U0FDbkQ7UUFFRCw4QkFBOEI7UUFDOUIsTUFBTSxJQUFBLGtDQUFvQixFQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRXBDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsTUFBTSxJQUFBLHNCQUFTLEVBQUMsTUFBQSxPQUFPLENBQUMsSUFBSSxtQ0FBSSxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUksSUFBSSxXQUFXLENBQUMsQ0FBQztRQUVsRixJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUU7WUFDZixNQUFNLENBQUMsSUFBSSxDQUFDLFdBQUksQ0FBQyxZQUFZLENBQUE7Z0hBQzZFLENBQUMsQ0FBQztTQUM3RztRQUVELElBQ0UsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCO1lBQ3pCLE9BQU8sQ0FBQyxJQUFJO1lBQ1osQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztZQUMxQyxPQUFPLENBQUMsSUFBSSxLQUFLLFdBQVcsRUFDNUI7WUFDQSxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQUksQ0FBQyxXQUFXLENBQUE7Ozs7Ozs7O09BUTNCLENBQUMsQ0FBQztTQUNKO1FBRUQsSUFBSSxPQUFPLENBQUMsZ0JBQWdCLEVBQUU7WUFDNUIsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFJLENBQUMsT0FBTyxDQUFBOzs7O09BSXZCLENBQUMsQ0FBQztTQUNKO1FBQ0Qsc0RBQXNEO1FBQ3RELE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsQ0FDbEQsQ0FBQztRQUV2QixJQUFJLGlCQUFpQixDQUFDLGFBQWEsSUFBSSxpQkFBaUIsQ0FBQyxhQUFhLEtBQUssc0JBQWEsQ0FBQyxJQUFJLEVBQUU7WUFDN0Ysc0VBQXNFO1lBQ3RFLHVGQUF1RjtZQUN2RixpQkFBaUIsQ0FBQyxhQUFhLEdBQUcsc0JBQWEsQ0FBQyxJQUFJLENBQUM7WUFDckQsTUFBTSxDQUFDLElBQUksQ0FBQyx3RUFBd0UsQ0FBQyxDQUFDO1NBQ3ZGO1FBRUQsTUFBTSxRQUFRLEdBQUcsTUFBTSxPQUFPLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDL0QsTUFBTSxZQUFZLEdBQUcsSUFBQSx1Q0FBcUIsRUFBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBRTVFLE1BQU0sV0FBVyxHQUFHLE1BQU0sT0FBTyxDQUFDLHVCQUF1QixDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBRXpFLDJGQUEyRjtRQUMzRixzQ0FBc0M7UUFDdEMsSUFBSSxXQUFXLEtBQUssK0NBQStDLEVBQUU7WUFDbkUsTUFBTSxDQUFDLElBQUksQ0FDVCw2RUFBNkU7Z0JBQzNFLDJFQUEyRSxDQUM5RSxDQUFDO1NBQ0g7UUFFRCxNQUFNLGNBQWMsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FDbkQ7WUFDRSxHQUFHLGlCQUFpQjtZQUNwQixLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUs7WUFDcEIsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPO1lBQ3hCLGtGQUFrRjtZQUNsRixPQUFPLEVBQUUsU0FBUztTQUN1QixFQUMzQyxXQUFXLENBQ1osQ0FBMkMsQ0FBQztRQUU3QyxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxHQUFHLElBQUEsNkJBQXFCLEVBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQy9FLElBQUksT0FBTyxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUU7WUFDNUIsTUFBTSxDQUFDLEtBQUssQ0FBQyxXQUFJLENBQUMsWUFBWSxDQUFBOzs7Ozs7O09BTzdCLENBQUMsQ0FBQztTQUNKO1FBRUQsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLEdBQUcsTUFBTSxJQUFBLG9FQUEyQyxFQUNyRixjQUFjLEVBQ2QsT0FBTyxFQUNQLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUEsNEJBQWtCLEVBQUMsR0FBRyxDQUFDLEVBQUUsSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsQ0FBQyxFQUM5RSxPQUFPLENBQ1IsQ0FBQztRQUVGLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFO1lBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQUMsK0NBQStDLENBQUMsQ0FBQztTQUNsRTtRQUVELElBQUksTUFBMEIsQ0FBQztRQUMvQixJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDckIsc0NBQXNDO1lBQ3RDLE1BQU0sR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ3JDO2FBQU0sSUFBSSxJQUFJLENBQUMsc0JBQXNCLEVBQUU7WUFDdEMsc0NBQXNDO1lBQ3RDLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO1NBQzVCO1FBRUQsSUFBSSxhQUFhLEdBQUcsTUFBTSxDQUFDO1FBRTNCLDZDQUE2QztRQUM3QyxJQUFJLE1BQU0sRUFBRTtZQUNWLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFO2dCQUMvQixNQUFNLElBQUksS0FBSyxDQUNiLDRFQUE0RSxDQUM3RSxDQUFDO2FBQ0g7WUFFRCxNQUFNLGFBQWEsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1NBQ3pGO1FBRUQsSUFBSSxVQUFVLENBQUMsb0JBQW9CLEVBQUU7WUFDbkMsYUFBYSxHQUFHLE1BQU0sVUFBVSxDQUFDLG9CQUFvQixDQUFDLGFBQWEsQ0FBQyxDQUFDO1NBQ3RFO1FBRUQsTUFBQSxhQUFhLENBQUMsT0FBTyxvQ0FBckIsYUFBYSxDQUFDLE9BQU8sR0FBSyxFQUFFLEVBQUM7UUFFN0IsSUFBSSxjQUFjLENBQUMsS0FBSyxFQUFFO1lBQ3hCLE1BQU0sRUFBRSxPQUFPLEdBQUcsRUFBRSxFQUFFLE1BQU0sR0FBRyxFQUFFLEVBQUUsUUFBUSxFQUFFLEdBQUcsY0FBYyxDQUFDO1lBQy9ELE1BQU0sV0FBVyxHQUFHLElBQUEsd0NBQW1CLEVBQUM7Z0JBQ3RDLE9BQU87Z0JBQ1AsTUFBTTtnQkFDTiwyREFBMkQ7Z0JBQzNELDBIQUEwSDtnQkFDMUgsK0lBQStJO2dCQUMvSSxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUEsTUFBQSxhQUFhLENBQUMsU0FBUywwQ0FBRSxHQUFHLENBQUE7YUFDN0MsQ0FBQyxDQUFDO1lBRUgsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQ3hCLElBQUksa0RBQXNCLENBQUM7Z0JBQ3pCLFNBQVMsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxJQUFBLDBDQUFpQixFQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDL0UsVUFBVSxFQUFFLElBQUEsMkNBQWtCLEVBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQztnQkFDcEQsUUFBUTtnQkFDUixXQUFXO2dCQUNYLFNBQVMsRUFBRSxjQUFjLENBQUMsU0FBUztnQkFDbkMsR0FBRyxFQUFFLGNBQWMsQ0FBQyxvQkFBb0I7Z0JBQ3hDLEtBQUssRUFBRSxZQUFZO2dCQUNuQixhQUFhLEVBQUUsVUFBVSxDQUFDLFNBQVM7Z0JBQ25DLFlBQVksRUFBRSxJQUFBLDZCQUFxQixFQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUM7Z0JBQ2hFLFdBQVcsRUFBRSxjQUFjLENBQUMsV0FBVztnQkFDdkMsSUFBSSxFQUFFLE1BQU07YUFDYixDQUFDLENBQ0gsQ0FBQztTQUNIO1FBRUQsSUFBSSxjQUFjLENBQUMsYUFBYSxFQUFFO1lBQ2hDLGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUN4QixJQUFJLDJDQUFtQixDQUFDO2dCQUN0QixRQUFRLEVBQUUsY0FBYyxDQUFDLFFBQVE7Z0JBQ2pDLElBQUksRUFBRSxPQUFPLENBQUMsYUFBYTtnQkFDM0IsV0FBVztnQkFDWCxjQUFjLEVBQUUsY0FBYyxDQUFDLGNBQWM7YUFDOUMsQ0FBQyxDQUNILENBQUM7U0FDSDtRQUVELE9BQU87WUFDTCxjQUFjO1lBQ2QsYUFBYTtZQUNiLFdBQVc7U0FDWixDQUFDO0lBQ0osQ0FBQztJQUVELE9BQU8sSUFBQSxXQUFJLEVBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQ3ZCLElBQUEsZ0JBQVMsRUFBQyxDQUFDLEVBQUUsY0FBYyxFQUFFLGFBQWEsRUFBRSxFQUFFLEVBQUU7UUFDOUMsT0FBTyxJQUFBLG1DQUFtQixFQUFDLGFBQWEsRUFBRSxPQUFPLEVBQUU7WUFDakQsT0FBTyxFQUFFLFVBQVUsQ0FBQyxPQUFPLElBQUksSUFBQSxvQ0FBNEIsRUFBQyxjQUFjLEVBQUUsTUFBTSxDQUFDO1lBQ25GLGNBQWMsRUFBRSxPQUFPLENBQUMsU0FBUyxDQUFtQjtZQUNwRCx1QkFBdUIsRUFBRSxPQUFPLENBQUMsb0JBQW9CLENBQTRCO1NBQ2xGLENBQUMsQ0FBQyxJQUFJLENBQ0wsSUFBQSxnQkFBUyxFQUFDLEtBQUssRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLEVBQUU7O1lBQ3BDLE1BQU0sZUFBZSxHQUFHLFVBQVUsQ0FBQyxZQUFZLENBQUM7WUFDaEQsSUFBSSxDQUFDLGVBQWUsRUFBRTtnQkFDcEIsTUFBTSxJQUFJLEtBQUssQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDO2FBQzVEO1lBRUQseUJBQXlCO1lBQ3pCLE1BQU0sVUFBVSxHQUFHLE1BQUEsTUFBQSxhQUFhLENBQUMsU0FBUywwQ0FBRSxhQUFhLDBDQUFFLFVBQVUsQ0FBQztZQUV0RSxNQUFNLGFBQWEsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO2dCQUMvQixRQUFRLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNO2dCQUN4QyxRQUFRLEVBQUUsT0FBTyxDQUFDLElBQUksS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUk7Z0JBQ2pFLElBQUksRUFBRSxVQUFVLENBQUMsSUFBSTtnQkFDckIsUUFBUSxFQUFFLE9BQU8sVUFBVSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxTQUFTO2FBQ2xFLENBQUMsQ0FBQztZQUVILElBQUksS0FBSyxLQUFLLENBQUMsRUFBRTtnQkFDZixNQUFNLENBQUMsSUFBSSxDQUNULElBQUk7b0JBQ0YsV0FBSSxDQUFDLE9BQU8sQ0FBQTs7Z0VBRW9DLE9BQU8sQ0FBQyxJQUFJLElBQUksVUFBVSxDQUFDLElBQUk7cUNBQzFELGFBQWE7O2FBRXJDO29CQUNHLElBQUksQ0FDUCxDQUFDO2dCQUVGLElBQUksT0FBTyxDQUFDLElBQUksRUFBRTtvQkFDaEIsTUFBTSxJQUFJLEdBQUcsQ0FBQyx3REFBYSxNQUFNLEdBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztvQkFDNUMsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7aUJBQzNCO2FBQ0Y7WUFFRCxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUU7Z0JBQ3RCLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxjQUFNLENBQUMsV0FBVyxDQUFDLGNBQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7YUFDckY7aUJBQU07Z0JBQ0wsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLGNBQU0sQ0FBQyxTQUFTLENBQUMsY0FBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQzthQUMvRTtZQUVELE9BQU87Z0JBQ0wsR0FBRyxVQUFVO2dCQUNiLE9BQU8sRUFBRSxhQUFhO2dCQUN0QixLQUFLLEVBQUUsSUFBQSwrQkFBdUIsRUFBQyxlQUFlLEVBQUUsY0FBYyxDQUFDO2FBQ3RDLENBQUM7UUFDOUIsQ0FBQyxDQUFDLENBQ0gsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUNILENBQUM7QUFDSixDQUFDO0FBeFBELGtEQXdQQztBQUVELEtBQUssVUFBVSxhQUFhLENBQzFCLE1BQWMsRUFDZCxJQUFpQixFQUNqQixjQUFvQyxFQUNwQyxhQUFvQyxFQUNwQyxZQUFxQyxFQUNyQyxPQUF1Qjs7SUFFdkIsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRS9DLGdEQUFnRDtJQUNoRCxJQUNFLENBQUEsaUJBQWlCLGFBQWpCLGlCQUFpQix1QkFBakIsaUJBQWlCLENBQUUsUUFBUTtRQUMzQixPQUFPLGFBQWEsQ0FBQyxLQUFLLEtBQUssUUFBUTtRQUN2QyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQztRQUNuQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUMzQjtRQUNBLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUU7WUFDOUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDakU7YUFBTTtZQUNMLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUc7Z0JBQzVCLGlCQUFpQixDQUFDLFFBQVE7Z0JBQzFCLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFXO2FBQ3RDLENBQUM7U0FDSDtLQUNGO0lBRUQsSUFBSSwwQkFBMEIsR0FBRyxjQUFjLENBQUMsc0JBQXNCLElBQUksUUFBUSxDQUFDO0lBQ25GLElBQUksV0FBVyxHQUFHLENBQUEsaUJBQWlCLGFBQWpCLGlCQUFpQix1QkFBakIsaUJBQWlCLENBQUUsV0FBVyxLQUFJLEVBQUUsQ0FBQztJQUV2RCxJQUFJLE1BQU0sS0FBSyxJQUFJLENBQUMsWUFBWSxFQUFFO1FBQ2hDLDBCQUEwQixHQUFHLFFBQVEsQ0FBQztRQUN0QyxXQUFXLEdBQUcsRUFBRSxDQUFDO0tBQ2xCO0lBRUQsTUFBTSxpQkFBaUIsR0FBRztRQUN4QixNQUFNO1FBQ04sMEJBQTBCO1FBQzFCLFdBQVcsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFNBQVM7UUFDeEQsZ0JBQWdCLEVBQUUsaUJBQWlCLGFBQWpCLGlCQUFpQix1QkFBakIsaUJBQWlCLENBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQ3RELElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQy9DO0tBQ0YsQ0FBQztJQUVGLE1BQU0sUUFBUSxHQUF3QjtRQUNwQyxJQUFJLEVBQUUsaUJBQWlCO1FBQ3ZCLE9BQU8sRUFBRSxNQUFNO1FBQ2YsR0FBRyxFQUFFO1lBQ0g7Z0JBQ0UsTUFBTSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsNEJBQTRCLENBQUM7Z0JBQ3JELE9BQU8sRUFBRTtvQkFDUCxjQUFjLEVBQ1osQ0FBQyxZQUFZLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO3dCQUMvRSxLQUFLO29CQUNQLGVBQWUsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO3dCQUM5QixNQUFNO3dCQUNOLG9CQUFvQixFQUFFLGlCQUFpQixhQUFqQixpQkFBaUIsdUJBQWpCLGlCQUFpQixDQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7cUJBQzdFLENBQUM7b0JBQ0YsSUFBSSxFQUFFLGlCQUFpQjtpQkFDeEI7YUFDRjtTQUNGO0tBQ0YsQ0FBQztJQUVGLHVFQUF1RTtJQUN2RSxNQUFNLEtBQUssR0FBRyxDQUFBLE1BQUEsYUFBYSxDQUFDLE1BQU0sMENBQUUsS0FBSyxLQUFJLEVBQUUsQ0FBQztJQUNoRCxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtRQUN6QixhQUFhLENBQUMsTUFBTSxHQUFHLEVBQUUsS0FBSyxFQUFFLENBQUM7S0FDbEM7U0FBTSxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUU7UUFDdEMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0tBQ3BDO0lBRUQsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUVyQix1REFBdUQ7SUFDdkQsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFBLDJDQUF1QixHQUFFLENBQUM7SUFDL0Msb0VBQW9FO0lBQ3BFLGFBQWEsQ0FBQyxPQUFRLENBQUMsSUFBSSxDQUFDO1FBQzFCLEtBQUssRUFBRSxDQUFDLFFBQTBCLEVBQUUsRUFBRTtZQUNwQyxRQUFRLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUU7O2dCQUNsRSxJQUFJLElBQUksQ0FBQyxZQUFZLElBQUksaUJBQWlCLENBQUMsV0FBVyxLQUFLLFNBQVMsRUFBRTtvQkFDcEUsc0JBQXNCO29CQUN0QixJQUFBLCtCQUFnQixFQUNkLE1BQU0sRUFDTixpQkFBaUIsRUFDakIsT0FBTyxDQUFDLGFBQWEsRUFDckIsTUFBTSxFQUNOO3dCQUNFLElBQUksQ0FBQyxPQUFPOzRCQUNWLElBQUEsZ0NBQVUsRUFBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7d0JBQ25DLENBQUM7d0JBQ0QsS0FBSyxDQUFDLE9BQU87NEJBQ1gsSUFBQSw4QkFBUSxFQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQzt3QkFDakMsQ0FBQztxQkFDRixFQUNELFNBQVMsRUFDVCxjQUFjLENBQUMsd0JBQXdCLENBQ3hDLENBQUM7b0JBRUYsaUJBQWlCLENBQUMsV0FBVyxHQUFHLE1BQUEsaUJBQWlCLENBQUMsV0FBVyxtQ0FBSSxFQUFFLENBQUM7aUJBQ3JFO2dCQUVELFdBQVcsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsR0FBRyxFQUFFO29CQUN4RCxzRUFBc0U7b0JBQ3RFLGlCQUFpQixDQUFDLFdBQVcsR0FBRyxTQUFTLENBQUM7Z0JBQzVDLENBQUMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0tBQ0YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELGtCQUFlLElBQUEseUJBQWEsRUFBa0QsbUJBQW1CLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgY3JlYXRlQnVpbGRlciwgdGFyZ2V0RnJvbVRhcmdldFN0cmluZyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHtcbiAgRGV2U2VydmVyQnVpbGRPdXRwdXQsXG4gIFdlYnBhY2tMb2dnaW5nQ2FsbGJhY2ssXG4gIHJ1bldlYnBhY2tEZXZTZXJ2ZXIsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJztcbmltcG9ydCB7IGpzb24sIHRhZ3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgY29uY2F0TWFwLCBmcm9tLCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzJztcbmltcG9ydCAqIGFzIHVybCBmcm9tICd1cmwnO1xuaW1wb3J0IHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgd2VicGFja0RldlNlcnZlciBmcm9tICd3ZWJwYWNrLWRldi1zZXJ2ZXInO1xuaW1wb3J0IHsgRXhlY3V0aW9uVHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7IG5vcm1hbGl6ZU9wdGltaXphdGlvbiB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IGNoZWNrUG9ydCB9IGZyb20gJy4uLy4uL3V0aWxzL2NoZWNrLXBvcnQnO1xuaW1wb3J0IHsgY29sb3JzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29sb3InO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMsIGxvYWRUcmFuc2xhdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgSW5kZXhIdG1sVHJhbnNmb3JtIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBjcmVhdGVUcmFuc2xhdGlvbkxvYWRlciB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtdHJhbnNsYXRpb25zJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRDYWNoZWRPcHRpb25zLCBub3JtYWxpemVDYWNoZU9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9ub3JtYWxpemUtY2FjaGUnO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cyB9IGZyb20gJy4uLy4uL3V0aWxzL3BhY2thZ2UtY2h1bmstc29ydCc7XG5pbXBvcnQgeyBwdXJnZVN0YWxlQnVpbGRDYWNoZSB9IGZyb20gJy4uLy4uL3V0aWxzL3B1cmdlLWNhY2hlJztcbmltcG9ydCB7IGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbiB9IGZyb20gJy4uLy4uL3V0aWxzL3ZlcnNpb24nO1xuaW1wb3J0IHtcbiAgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dCxcbiAgZ2V0SW5kZXhJbnB1dEZpbGUsXG4gIGdldEluZGV4T3V0cHV0RmlsZSxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBhZGRFcnJvciwgYWRkV2FybmluZyB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stZGlhZ25vc3RpY3MnO1xuaW1wb3J0IHsgZ2V0Q29tbW9uQ29uZmlnLCBnZXREZXZTZXJ2ZXJDb25maWcsIGdldFN0eWxlc0NvbmZpZyB9IGZyb20gJy4uLy4uL3dlYnBhY2svY29uZmlncyc7XG5pbXBvcnQgeyBJbmRleEh0bWxXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vd2VicGFjay9wbHVnaW5zL2luZGV4LWh0bWwtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgU2VydmljZVdvcmtlclBsdWdpbiB9IGZyb20gJy4uLy4uL3dlYnBhY2svcGx1Z2lucy9zZXJ2aWNlLXdvcmtlci1wbHVnaW4nO1xuaW1wb3J0IHtcbiAgQnVpbGRFdmVudFN0YXRzLFxuICBjcmVhdGVXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrLFxuICBnZW5lcmF0ZUJ1aWxkRXZlbnRTdGF0cyxcbn0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJTY2hlbWEsIE91dHB1dEhhc2hpbmcgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmV4cG9ydCB0eXBlIERldlNlcnZlckJ1aWxkZXJPcHRpb25zID0gU2NoZW1hO1xuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgdHlwZSBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuZXhwb3J0IHR5cGUgRGV2U2VydmVyQnVpbGRlck91dHB1dCA9IERldlNlcnZlckJ1aWxkT3V0cHV0ICYge1xuICBiYXNlVXJsOiBzdHJpbmc7XG4gIHN0YXRzOiBCdWlsZEV2ZW50U3RhdHM7XG59O1xuXG4vKipcbiAqIFJldXNhYmxlIGltcGxlbWVudGF0aW9uIG9mIHRoZSBBbmd1bGFyIFdlYnBhY2sgZGV2ZWxvcG1lbnQgc2VydmVyIGJ1aWxkZXIuXG4gKiBAcGFyYW0gb3B0aW9ucyBEZXYgU2VydmVyIG9wdGlvbnMuXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgYnVpbGQgY29udGV4dC5cbiAqIEBwYXJhbSB0cmFuc2Zvcm1zIEEgbWFwIG9mIHRyYW5zZm9ybXMgdGhhdCBjYW4gYmUgdXNlZCB0byBob29rIGludG8gc29tZSBsb2dpYyAoc3VjaCBhc1xuICogICAgIHRyYW5zZm9ybWluZyB3ZWJwYWNrIGNvbmZpZ3VyYXRpb24gYmVmb3JlIHBhc3NpbmcgaXQgdG8gd2VicGFjaykuXG4gKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBzZXJ2ZVdlYnBhY2tCcm93c2VyKFxuICBvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHRyYW5zZm9ybXM6IHtcbiAgICB3ZWJwYWNrQ29uZmlndXJhdGlvbj86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPHdlYnBhY2suQ29uZmlndXJhdGlvbj47XG4gICAgbG9nZ2luZz86IFdlYnBhY2tMb2dnaW5nQ2FsbGJhY2s7XG4gICAgaW5kZXhIdG1sPzogSW5kZXhIdG1sVHJhbnNmb3JtO1xuICB9ID0ge30sXG4pOiBPYnNlcnZhYmxlPERldlNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gQ2hlY2sgQW5ndWxhciB2ZXJzaW9uLlxuICBjb25zdCB7IGxvZ2dlciwgd29ya3NwYWNlUm9vdCB9ID0gY29udGV4dDtcbiAgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uKHdvcmtzcGFjZVJvb3QpO1xuXG4gIGNvbnN0IGJyb3dzZXJUYXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuYnJvd3NlclRhcmdldCk7XG5cbiAgYXN5bmMgZnVuY3Rpb24gc2V0dXAoKTogUHJvbWlzZTx7XG4gICAgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hO1xuICAgIHdlYnBhY2tDb25maWc6IHdlYnBhY2suQ29uZmlndXJhdGlvbjtcbiAgICBwcm9qZWN0Um9vdDogc3RyaW5nO1xuICB9PiB7XG4gICAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0LicpO1xuICAgIH1cblxuICAgIC8vIFB1cmdlIG9sZCBidWlsZCBkaXNrIGNhY2hlLlxuICAgIGF3YWl0IHB1cmdlU3RhbGVCdWlsZENhY2hlKGNvbnRleHQpO1xuXG4gICAgb3B0aW9ucy5wb3J0ID0gYXdhaXQgY2hlY2tQb3J0KG9wdGlvbnMucG9ydCA/PyA0MjAwLCBvcHRpb25zLmhvc3QgfHwgJ2xvY2FsaG9zdCcpO1xuXG4gICAgaWYgKG9wdGlvbnMuaG1yKSB7XG4gICAgICBsb2dnZXIud2Fybih0YWdzLnN0cmlwSW5kZW50c2BOT1RJQ0U6IEhvdCBNb2R1bGUgUmVwbGFjZW1lbnQgKEhNUikgaXMgZW5hYmxlZCBmb3IgdGhlIGRldiBzZXJ2ZXIuXG4gICAgICBTZWUgaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9ndWlkZXMvaG90LW1vZHVsZS1yZXBsYWNlbWVudCBmb3IgaW5mb3JtYXRpb24gb24gd29ya2luZyB3aXRoIEhNUiBmb3IgV2VicGFjay5gKTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICAhb3B0aW9ucy5kaXNhYmxlSG9zdENoZWNrICYmXG4gICAgICBvcHRpb25zLmhvc3QgJiZcbiAgICAgICEvXjEyN1xcLlxcZCtcXC5cXGQrXFwuXFxkKy9nLnRlc3Qob3B0aW9ucy5ob3N0KSAmJlxuICAgICAgb3B0aW9ucy5ob3N0ICE9PSAnbG9jYWxob3N0J1xuICAgICkge1xuICAgICAgbG9nZ2VyLndhcm4odGFncy5zdHJpcEluZGVudGBcbiAgICAgICAgV2FybmluZzogVGhpcyBpcyBhIHNpbXBsZSBzZXJ2ZXIgZm9yIHVzZSBpbiB0ZXN0aW5nIG9yIGRlYnVnZ2luZyBBbmd1bGFyIGFwcGxpY2F0aW9uc1xuICAgICAgICBsb2NhbGx5LiBJdCBoYXNuJ3QgYmVlbiByZXZpZXdlZCBmb3Igc2VjdXJpdHkgaXNzdWVzLlxuXG4gICAgICAgIEJpbmRpbmcgdGhpcyBzZXJ2ZXIgdG8gYW4gb3BlbiBjb25uZWN0aW9uIGNhbiByZXN1bHQgaW4gY29tcHJvbWlzaW5nIHlvdXIgYXBwbGljYXRpb24gb3JcbiAgICAgICAgY29tcHV0ZXIuIFVzaW5nIGEgZGlmZmVyZW50IGhvc3QgdGhhbiB0aGUgb25lIHBhc3NlZCB0byB0aGUgXCItLWhvc3RcIiBmbGFnIG1pZ2h0IHJlc3VsdCBpblxuICAgICAgICB3ZWJzb2NrZXQgY29ubmVjdGlvbiBpc3N1ZXMuIFlvdSBtaWdodCBuZWVkIHRvIHVzZSBcIi0tZGlzYWJsZS1ob3N0LWNoZWNrXCIgaWYgdGhhdCdzIHRoZVxuICAgICAgICBjYXNlLlxuICAgICAgYCk7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjaykge1xuICAgICAgbG9nZ2VyLndhcm4odGFncy5vbmVMaW5lYFxuICAgICAgICBXYXJuaW5nOiBSdW5uaW5nIGEgc2VydmVyIHdpdGggLS1kaXNhYmxlLWhvc3QtY2hlY2sgaXMgYSBzZWN1cml0eSByaXNrLlxuICAgICAgICBTZWUgaHR0cHM6Ly9tZWRpdW0uY29tL3dlYnBhY2svd2VicGFjay1kZXYtc2VydmVyLW1pZGRsZXdhcmUtc2VjdXJpdHktaXNzdWVzLTE0ODlkOTUwODc0YVxuICAgICAgICBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cbiAgICAgIGApO1xuICAgIH1cbiAgICAvLyBHZXQgdGhlIGJyb3dzZXIgY29uZmlndXJhdGlvbiBmcm9tIHRoZSB0YXJnZXQgbmFtZS5cbiAgICBjb25zdCByYXdCcm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMoYnJvd3NlclRhcmdldCkpIGFzIGpzb24uSnNvbk9iamVjdCAmXG4gICAgICBCcm93c2VyQnVpbGRlclNjaGVtYTtcblxuICAgIGlmIChyYXdCcm93c2VyT3B0aW9ucy5vdXRwdXRIYXNoaW5nICYmIHJhd0Jyb3dzZXJPcHRpb25zLm91dHB1dEhhc2hpbmcgIT09IE91dHB1dEhhc2hpbmcuTm9uZSkge1xuICAgICAgLy8gRGlzYWJsZSBvdXRwdXQgaGFzaGluZyBmb3IgZGV2IGJ1aWxkIGFzIHRoaXMgY2FuIGNhdXNlIG1lbW9yeSBsZWFrc1xuICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay93ZWJwYWNrLWRldi1zZXJ2ZXIvaXNzdWVzLzM3NyNpc3N1ZWNvbW1lbnQtMjQxMjU4NDA1XG4gICAgICByYXdCcm93c2VyT3B0aW9ucy5vdXRwdXRIYXNoaW5nID0gT3V0cHV0SGFzaGluZy5Ob25lO1xuICAgICAgbG9nZ2VyLndhcm4oYFdhcm5pbmc6ICdvdXRwdXRIYXNoaW5nJyBvcHRpb24gaXMgZGlzYWJsZWQgd2hlbiB1c2luZyB0aGUgZGV2LXNlcnZlci5gKTtcbiAgICB9XG5cbiAgICBjb25zdCBtZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgICBjb25zdCBjYWNoZU9wdGlvbnMgPSBub3JtYWxpemVDYWNoZU9wdGlvbnMobWV0YWRhdGEsIGNvbnRleHQud29ya3NwYWNlUm9vdCk7XG5cbiAgICBjb25zdCBicm93c2VyTmFtZSA9IGF3YWl0IGNvbnRleHQuZ2V0QnVpbGRlck5hbWVGb3JUYXJnZXQoYnJvd3NlclRhcmdldCk7XG5cbiAgICAvLyBJc3N1ZSBhIHdhcm5pbmcgdGhhdCB0aGUgZGV2LXNlcnZlciBkb2VzIG5vdCBjdXJyZW50bHkgc3VwcG9ydCB0aGUgZXhwZXJpbWVudGFsIGVzYnVpbGQtXG4gICAgLy8gYmFzZWQgYnVpbGRlciBhbmQgd2lsbCB1c2UgV2VicGFjay5cbiAgICBpZiAoYnJvd3Nlck5hbWUgPT09ICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcjpicm93c2VyLWVzYnVpbGQnKSB7XG4gICAgICBsb2dnZXIud2FybihcbiAgICAgICAgJ1dBUk5JTkc6IFRoZSBleHBlcmltZW50YWwgZXNidWlsZC1iYXNlZCBidWlsZGVyIGlzIG5vdCBjdXJyZW50bHkgc3VwcG9ydGVkICcgK1xuICAgICAgICAgICdieSB0aGUgZGV2LXNlcnZlci4gVGhlIHN0YWJsZSBXZWJwYWNrLWJhc2VkIGJ1aWxkZXIgd2lsbCBiZSB1c2VkIGluc3RlYWQuJyxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC52YWxpZGF0ZU9wdGlvbnMoXG4gICAgICB7XG4gICAgICAgIC4uLnJhd0Jyb3dzZXJPcHRpb25zLFxuICAgICAgICB3YXRjaDogb3B0aW9ucy53YXRjaCxcbiAgICAgICAgdmVyYm9zZTogb3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAvLyBJbiBkZXYgc2VydmVyIHdlIHNob3VsZCBub3QgaGF2ZSBidWRnZXRzIGJlY2F1c2Ugb2YgZXh0cmEgbGlicyBzdWNoIGFzIHNvY2tzLWpzXG4gICAgICAgIGJ1ZGdldHM6IHVuZGVmaW5lZCxcbiAgICAgIH0gYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICAgICBicm93c2VyTmFtZSxcbiAgICApKSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlclNjaGVtYTtcblxuICAgIGNvbnN0IHsgc3R5bGVzLCBzY3JpcHRzIH0gPSBub3JtYWxpemVPcHRpbWl6YXRpb24oYnJvd3Nlck9wdGlvbnMub3B0aW1pemF0aW9uKTtcbiAgICBpZiAoc2NyaXB0cyB8fCBzdHlsZXMubWluaWZ5KSB7XG4gICAgICBsb2dnZXIuZXJyb3IodGFncy5zdHJpcEluZGVudHNgXG4gICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgVGhpcyBpcyBhIHNpbXBsZSBzZXJ2ZXIgZm9yIHVzZSBpbiB0ZXN0aW5nIG9yIGRlYnVnZ2luZyBBbmd1bGFyIGFwcGxpY2F0aW9ucyBsb2NhbGx5LlxuICAgICAgICBJdCBoYXNuJ3QgYmVlbiByZXZpZXdlZCBmb3Igc2VjdXJpdHkgaXNzdWVzLlxuXG4gICAgICAgIERPTidUIFVTRSBJVCBGT1IgUFJPRFVDVElPTiFcbiAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgYCk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBjb25maWcsIHByb2plY3RSb290LCBpMThuIH0gPSBhd2FpdCBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KFxuICAgICAgYnJvd3Nlck9wdGlvbnMsXG4gICAgICBjb250ZXh0LFxuICAgICAgKHdjbykgPT4gW2dldERldlNlcnZlckNvbmZpZyh3Y28pLCBnZXRDb21tb25Db25maWcod2NvKSwgZ2V0U3R5bGVzQ29uZmlnKHdjbyldLFxuICAgICAgb3B0aW9ucyxcbiAgICApO1xuXG4gICAgaWYgKCFjb25maWcuZGV2U2VydmVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYnBhY2sgRGV2IFNlcnZlciBjb25maWd1cmF0aW9uIHdhcyBub3Qgc2V0LicpO1xuICAgIH1cblxuICAgIGxldCBsb2NhbGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBpZiAoaTE4bi5zaG91bGRJbmxpbmUpIHtcbiAgICAgIC8vIERldi1zZXJ2ZXIgb25seSBzdXBwb3J0cyBvbmUgbG9jYWxlXG4gICAgICBsb2NhbGUgPSBbLi4uaTE4bi5pbmxpbmVMb2NhbGVzXVswXTtcbiAgICB9IGVsc2UgaWYgKGkxOG4uaGFzRGVmaW5lZFNvdXJjZUxvY2FsZSkge1xuICAgICAgLy8gdXNlIHNvdXJjZSBsb2NhbGUgaWYgbm90IGxvY2FsaXppbmdcbiAgICAgIGxvY2FsZSA9IGkxOG4uc291cmNlTG9jYWxlO1xuICAgIH1cblxuICAgIGxldCB3ZWJwYWNrQ29uZmlnID0gY29uZmlnO1xuXG4gICAgLy8gSWYgYSBsb2NhbGUgaXMgZGVmaW5lZCwgc2V0dXAgbG9jYWxpemF0aW9uXG4gICAgaWYgKGxvY2FsZSkge1xuICAgICAgaWYgKGkxOG4uaW5saW5lTG9jYWxlcy5zaXplID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ1RoZSBkZXZlbG9wbWVudCBzZXJ2ZXIgb25seSBzdXBwb3J0cyBsb2NhbGl6aW5nIGEgc2luZ2xlIGxvY2FsZSBwZXIgYnVpbGQuJyxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgc2V0dXBMb2NhbGl6ZShsb2NhbGUsIGkxOG4sIGJyb3dzZXJPcHRpb25zLCB3ZWJwYWNrQ29uZmlnLCBjYWNoZU9wdGlvbnMsIGNvbnRleHQpO1xuICAgIH1cblxuICAgIGlmICh0cmFuc2Zvcm1zLndlYnBhY2tDb25maWd1cmF0aW9uKSB7XG4gICAgICB3ZWJwYWNrQ29uZmlnID0gYXdhaXQgdHJhbnNmb3Jtcy53ZWJwYWNrQ29uZmlndXJhdGlvbih3ZWJwYWNrQ29uZmlnKTtcbiAgICB9XG5cbiAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMgPz89IFtdO1xuXG4gICAgaWYgKGJyb3dzZXJPcHRpb25zLmluZGV4KSB7XG4gICAgICBjb25zdCB7IHNjcmlwdHMgPSBbXSwgc3R5bGVzID0gW10sIGJhc2VIcmVmIH0gPSBicm93c2VyT3B0aW9ucztcbiAgICAgIGNvbnN0IGVudHJ5cG9pbnRzID0gZ2VuZXJhdGVFbnRyeVBvaW50cyh7XG4gICAgICAgIHNjcmlwdHMsXG4gICAgICAgIHN0eWxlcyxcbiAgICAgICAgLy8gVGhlIGJlbG93IGlzIG5lZWRlZCBhcyBvdGhlcndpc2UgSE1SIGZvciBDU1Mgd2lsbCBicmVhay5cbiAgICAgICAgLy8gc3R5bGVzLmpzIGFuZCBydW50aW1lLmpzIG5lZWRzIHRvIGJlIGxvYWRlZCBhcyBhIG5vbi1tb2R1bGUgc2NyaXB0cyBhcyBvdGhlcndpc2UgYGRvY3VtZW50LmN1cnJlbnRTY3JpcHRgIHdpbGwgYmUgbnVsbC5cbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9taW5pLWNzcy1leHRyYWN0LXBsdWdpbi9ibG9iLzkwNDQ1ZGQxZDgxZGEwYzEwYjliMGU4YTE3YjQxN2QwNjUxODE2Yjgvc3JjL2htci9ob3RNb2R1bGVSZXBsYWNlbWVudC5qcyNMMzlcbiAgICAgICAgaXNITVJFbmFibGVkOiAhIXdlYnBhY2tDb25maWcuZGV2U2VydmVyPy5ob3QsXG4gICAgICB9KTtcblxuICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnB1c2goXG4gICAgICAgIG5ldyBJbmRleEh0bWxXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgICBpbmRleFBhdGg6IHBhdGgucmVzb2x2ZSh3b3Jrc3BhY2VSb290LCBnZXRJbmRleElucHV0RmlsZShicm93c2VyT3B0aW9ucy5pbmRleCkpLFxuICAgICAgICAgIG91dHB1dFBhdGg6IGdldEluZGV4T3V0cHV0RmlsZShicm93c2VyT3B0aW9ucy5pbmRleCksXG4gICAgICAgICAgYmFzZUhyZWYsXG4gICAgICAgICAgZW50cnlwb2ludHMsXG4gICAgICAgICAgZGVwbG95VXJsOiBicm93c2VyT3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgICAgICAgc3JpOiBicm93c2VyT3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSxcbiAgICAgICAgICBjYWNoZTogY2FjaGVPcHRpb25zLFxuICAgICAgICAgIHBvc3RUcmFuc2Zvcm06IHRyYW5zZm9ybXMuaW5kZXhIdG1sLFxuICAgICAgICAgIG9wdGltaXphdGlvbjogbm9ybWFsaXplT3B0aW1pemF0aW9uKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbiksXG4gICAgICAgICAgY3Jvc3NPcmlnaW46IGJyb3dzZXJPcHRpb25zLmNyb3NzT3JpZ2luLFxuICAgICAgICAgIGxhbmc6IGxvY2FsZSxcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH1cblxuICAgIGlmIChicm93c2VyT3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMucHVzaChcbiAgICAgICAgbmV3IFNlcnZpY2VXb3JrZXJQbHVnaW4oe1xuICAgICAgICAgIGJhc2VIcmVmOiBicm93c2VyT3B0aW9ucy5iYXNlSHJlZixcbiAgICAgICAgICByb290OiBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgcHJvamVjdFJvb3QsXG4gICAgICAgICAgbmdzd0NvbmZpZ1BhdGg6IGJyb3dzZXJPcHRpb25zLm5nc3dDb25maWdQYXRoLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGJyb3dzZXJPcHRpb25zLFxuICAgICAgd2VicGFja0NvbmZpZyxcbiAgICAgIHByb2plY3RSb290LFxuICAgIH07XG4gIH1cblxuICByZXR1cm4gZnJvbShzZXR1cCgpKS5waXBlKFxuICAgIHN3aXRjaE1hcCgoeyBicm93c2VyT3B0aW9ucywgd2VicGFja0NvbmZpZyB9KSA9PiB7XG4gICAgICByZXR1cm4gcnVuV2VicGFja0RldlNlcnZlcih3ZWJwYWNrQ29uZmlnLCBjb250ZXh0LCB7XG4gICAgICAgIGxvZ2dpbmc6IHRyYW5zZm9ybXMubG9nZ2luZyB8fCBjcmVhdGVXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrKGJyb3dzZXJPcHRpb25zLCBsb2dnZXIpLFxuICAgICAgICB3ZWJwYWNrRmFjdG9yeTogcmVxdWlyZSgnd2VicGFjaycpIGFzIHR5cGVvZiB3ZWJwYWNrLFxuICAgICAgICB3ZWJwYWNrRGV2U2VydmVyRmFjdG9yeTogcmVxdWlyZSgnd2VicGFjay1kZXYtc2VydmVyJykgYXMgdHlwZW9mIHdlYnBhY2tEZXZTZXJ2ZXIsXG4gICAgICB9KS5waXBlKFxuICAgICAgICBjb25jYXRNYXAoYXN5bmMgKGJ1aWxkRXZlbnQsIGluZGV4KSA9PiB7XG4gICAgICAgICAgY29uc3Qgd2VicGFja1Jhd1N0YXRzID0gYnVpbGRFdmVudC53ZWJwYWNrU3RhdHM7XG4gICAgICAgICAgaWYgKCF3ZWJwYWNrUmF3U3RhdHMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignV2VicGFjayBzdGF0cyBidWlsZCByZXN1bHQgaXMgcmVxdWlyZWQuJyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gUmVzb2x2ZSBzZXJ2ZSBhZGRyZXNzLlxuICAgICAgICAgIGNvbnN0IHB1YmxpY1BhdGggPSB3ZWJwYWNrQ29uZmlnLmRldlNlcnZlcj8uZGV2TWlkZGxld2FyZT8ucHVibGljUGF0aDtcblxuICAgICAgICAgIGNvbnN0IHNlcnZlckFkZHJlc3MgPSB1cmwuZm9ybWF0KHtcbiAgICAgICAgICAgIHByb3RvY29sOiBvcHRpb25zLnNzbCA/ICdodHRwcycgOiAnaHR0cCcsXG4gICAgICAgICAgICBob3N0bmFtZTogb3B0aW9ucy5ob3N0ID09PSAnMC4wLjAuMCcgPyAnbG9jYWxob3N0JyA6IG9wdGlvbnMuaG9zdCxcbiAgICAgICAgICAgIHBvcnQ6IGJ1aWxkRXZlbnQucG9ydCxcbiAgICAgICAgICAgIHBhdGhuYW1lOiB0eXBlb2YgcHVibGljUGF0aCA9PT0gJ3N0cmluZycgPyBwdWJsaWNQYXRoIDogdW5kZWZpbmVkLFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgaWYgKGluZGV4ID09PSAwKSB7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhcbiAgICAgICAgICAgICAgJ1xcbicgK1xuICAgICAgICAgICAgICAgIHRhZ3Mub25lTGluZWBcbiAgICAgICAgICAgICAgKipcbiAgICAgICAgICAgICAgQW5ndWxhciBMaXZlIERldmVsb3BtZW50IFNlcnZlciBpcyBsaXN0ZW5pbmcgb24gJHtvcHRpb25zLmhvc3R9OiR7YnVpbGRFdmVudC5wb3J0fSxcbiAgICAgICAgICAgICAgb3BlbiB5b3VyIGJyb3dzZXIgb24gJHtzZXJ2ZXJBZGRyZXNzfVxuICAgICAgICAgICAgICAqKlxuICAgICAgICAgICAgYCArXG4gICAgICAgICAgICAgICAgJ1xcbicsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5vcGVuKSB7XG4gICAgICAgICAgICAgIGNvbnN0IG9wZW4gPSAoYXdhaXQgaW1wb3J0KCdvcGVuJykpLmRlZmF1bHQ7XG4gICAgICAgICAgICAgIGF3YWl0IG9wZW4oc2VydmVyQWRkcmVzcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGJ1aWxkRXZlbnQuc3VjY2Vzcykge1xuICAgICAgICAgICAgbG9nZ2VyLmluZm8oYFxcbiR7Y29sb3JzLmdyZWVuQnJpZ2h0KGNvbG9ycy5zeW1ib2xzLmNoZWNrKX0gQ29tcGlsZWQgc3VjY2Vzc2Z1bGx5LmApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhgXFxuJHtjb2xvcnMucmVkQnJpZ2h0KGNvbG9ycy5zeW1ib2xzLmNyb3NzKX0gRmFpbGVkIHRvIGNvbXBpbGUuYCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLmJ1aWxkRXZlbnQsXG4gICAgICAgICAgICBiYXNlVXJsOiBzZXJ2ZXJBZGRyZXNzLFxuICAgICAgICAgICAgc3RhdHM6IGdlbmVyYXRlQnVpbGRFdmVudFN0YXRzKHdlYnBhY2tSYXdTdGF0cywgYnJvd3Nlck9wdGlvbnMpLFxuICAgICAgICAgIH0gYXMgRGV2U2VydmVyQnVpbGRlck91dHB1dDtcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH0pLFxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzZXR1cExvY2FsaXplKFxuICBsb2NhbGU6IHN0cmluZyxcbiAgaTE4bjogSTE4bk9wdGlvbnMsXG4gIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgd2VicGFja0NvbmZpZzogd2VicGFjay5Db25maWd1cmF0aW9uLFxuICBjYWNoZU9wdGlvbnM6IE5vcm1hbGl6ZWRDYWNoZWRPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbikge1xuICBjb25zdCBsb2NhbGVEZXNjcmlwdGlvbiA9IGkxOG4ubG9jYWxlc1tsb2NhbGVdO1xuXG4gIC8vIE1vZGlmeSBtYWluIGVudHJ5cG9pbnQgdG8gaW5jbHVkZSBsb2NhbGUgZGF0YVxuICBpZiAoXG4gICAgbG9jYWxlRGVzY3JpcHRpb24/LmRhdGFQYXRoICYmXG4gICAgdHlwZW9mIHdlYnBhY2tDb25maWcuZW50cnkgPT09ICdvYmplY3QnICYmXG4gICAgIUFycmF5LmlzQXJyYXkod2VicGFja0NvbmZpZy5lbnRyeSkgJiZcbiAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ11cbiAgKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkod2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddKSkge1xuICAgICAgd2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddLnVuc2hpZnQobG9jYWxlRGVzY3JpcHRpb24uZGF0YVBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10gPSBbXG4gICAgICAgIGxvY2FsZURlc2NyaXB0aW9uLmRhdGFQYXRoLFxuICAgICAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10gYXMgc3RyaW5nLFxuICAgICAgXTtcbiAgICB9XG4gIH1cblxuICBsZXQgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IgPSBicm93c2VyT3B0aW9ucy5pMThuTWlzc2luZ1RyYW5zbGF0aW9uIHx8ICdpZ25vcmUnO1xuICBsZXQgdHJhbnNsYXRpb24gPSBsb2NhbGVEZXNjcmlwdGlvbj8udHJhbnNsYXRpb24gfHwge307XG5cbiAgaWYgKGxvY2FsZSA9PT0gaTE4bi5zb3VyY2VMb2NhbGUpIHtcbiAgICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvciA9ICdpZ25vcmUnO1xuICAgIHRyYW5zbGF0aW9uID0ge307XG4gIH1cblxuICBjb25zdCBpMThuTG9hZGVyT3B0aW9ucyA9IHtcbiAgICBsb2NhbGUsXG4gICAgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IsXG4gICAgdHJhbnNsYXRpb246IGkxOG4uc2hvdWxkSW5saW5lID8gdHJhbnNsYXRpb24gOiB1bmRlZmluZWQsXG4gICAgdHJhbnNsYXRpb25GaWxlczogbG9jYWxlRGVzY3JpcHRpb24/LmZpbGVzLm1hcCgoZmlsZSkgPT5cbiAgICAgIHBhdGgucmVzb2x2ZShjb250ZXh0LndvcmtzcGFjZVJvb3QsIGZpbGUucGF0aCksXG4gICAgKSxcbiAgfTtcblxuICBjb25zdCBpMThuUnVsZTogd2VicGFjay5SdWxlU2V0UnVsZSA9IHtcbiAgICB0ZXN0OiAvXFwuW2NtXT9bdGpdc3g/JC8sXG4gICAgZW5mb3JjZTogJ3Bvc3QnLFxuICAgIHVzZTogW1xuICAgICAge1xuICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInKSxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIGNhY2hlRGlyZWN0b3J5OlxuICAgICAgICAgICAgKGNhY2hlT3B0aW9ucy5lbmFibGVkICYmIHBhdGguam9pbihjYWNoZU9wdGlvbnMucGF0aCwgJ2JhYmVsLWRldi1zZXJ2ZXItaTE4bicpKSB8fFxuICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgY2FjaGVJZGVudGlmaWVyOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBsb2NhbGUsXG4gICAgICAgICAgICB0cmFuc2xhdGlvbkludGVncml0eTogbG9jYWxlRGVzY3JpcHRpb24/LmZpbGVzLm1hcCgoZmlsZSkgPT4gZmlsZS5pbnRlZ3JpdHkpLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIGkxOG46IGkxOG5Mb2FkZXJPcHRpb25zLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xuXG4gIC8vIEdldCB0aGUgcnVsZXMgYW5kIGVuc3VyZSB0aGUgV2VicGFjayBjb25maWd1cmF0aW9uIGlzIHNldHVwIHByb3Blcmx5XG4gIGNvbnN0IHJ1bGVzID0gd2VicGFja0NvbmZpZy5tb2R1bGU/LnJ1bGVzIHx8IFtdO1xuICBpZiAoIXdlYnBhY2tDb25maWcubW9kdWxlKSB7XG4gICAgd2VicGFja0NvbmZpZy5tb2R1bGUgPSB7IHJ1bGVzIH07XG4gIH0gZWxzZSBpZiAoIXdlYnBhY2tDb25maWcubW9kdWxlLnJ1bGVzKSB7XG4gICAgd2VicGFja0NvbmZpZy5tb2R1bGUucnVsZXMgPSBydWxlcztcbiAgfVxuXG4gIHJ1bGVzLnB1c2goaTE4blJ1bGUpO1xuXG4gIC8vIEFkZCBhIHBsdWdpbiB0byByZWxvYWQgdHJhbnNsYXRpb24gZmlsZXMgb24gcmVidWlsZHNcbiAgY29uc3QgbG9hZGVyID0gYXdhaXQgY3JlYXRlVHJhbnNsYXRpb25Mb2FkZXIoKTtcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgd2VicGFja0NvbmZpZy5wbHVnaW5zIS5wdXNoKHtcbiAgICBhcHBseTogKGNvbXBpbGVyOiB3ZWJwYWNrLkNvbXBpbGVyKSA9PiB7XG4gICAgICBjb21waWxlci5ob29rcy50aGlzQ29tcGlsYXRpb24udGFwKCdidWlsZC1hbmd1bGFyJywgKGNvbXBpbGF0aW9uKSA9PiB7XG4gICAgICAgIGlmIChpMThuLnNob3VsZElubGluZSAmJiBpMThuTG9hZGVyT3B0aW9ucy50cmFuc2xhdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gUmVsb2FkIHRyYW5zbGF0aW9uc1xuICAgICAgICAgIGxvYWRUcmFuc2xhdGlvbnMoXG4gICAgICAgICAgICBsb2NhbGUsXG4gICAgICAgICAgICBsb2NhbGVEZXNjcmlwdGlvbixcbiAgICAgICAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgIGxvYWRlcixcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgd2FybihtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgYWRkV2FybmluZyhjb21waWxhdGlvbiwgbWVzc2FnZSk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGVycm9yKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICBhZGRFcnJvcihjb21waWxhdGlvbiwgbWVzc2FnZSk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgICAgYnJvd3Nlck9wdGlvbnMuaTE4bkR1cGxpY2F0ZVRyYW5zbGF0aW9uLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICBpMThuTG9hZGVyT3B0aW9ucy50cmFuc2xhdGlvbiA9IGxvY2FsZURlc2NyaXB0aW9uLnRyYW5zbGF0aW9uID8/IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29tcGlsYXRpb24uaG9va3MuZmluaXNoTW9kdWxlcy50YXAoJ2J1aWxkLWFuZ3VsYXInLCAoKSA9PiB7XG4gICAgICAgICAgLy8gQWZ0ZXIgbG9hZGVycyBhcmUgZmluaXNoZWQsIGNsZWFyIG91dCB0aGUgbm93IHVubmVlZGVkIHRyYW5zbGF0aW9uc1xuICAgICAgICAgIGkxOG5Mb2FkZXJPcHRpb25zLnRyYW5zbGF0aW9uID0gdW5kZWZpbmVkO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyPERldlNlcnZlckJ1aWxkZXJPcHRpb25zLCBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0PihzZXJ2ZVdlYnBhY2tCcm93c2VyKTtcbiJdfQ==