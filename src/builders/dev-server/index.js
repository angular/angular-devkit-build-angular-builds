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
const operators_1 = require("rxjs/operators");
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
        const { config, projectRoot, i18n } = await (0, webpack_browser_config_1.generateI18nBrowserWebpackConfigFromContext)(browserOptions, context, (wco) => [
            (0, configs_1.getDevServerConfig)(wco),
            (0, configs_1.getCommonConfig)(wco),
            (0, configs_1.getStylesConfig)(wco),
            (0, configs_1.getAnalyticsConfig)(wco, context),
        ], options);
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
    return (0, rxjs_1.from)(setup()).pipe((0, operators_1.switchMap)(({ browserOptions, webpackConfig }) => {
        return (0, build_webpack_1.runWebpackDevServer)(webpackConfig, context, {
            logging: transforms.logging || (0, stats_1.createWebpackLoggingCallback)(browserOptions, logger),
            webpackFactory: require('webpack'),
            webpackDevServerFactory: require('webpack-dev-server'),
        }).pipe((0, operators_1.concatMap)(async (buildEvent, index) => {
            var _a, _b;
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
            return { ...buildEvent, baseUrl: serverAddress };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQWtHO0FBQ2xHLGlFQUl1QztBQUN2QywrQ0FBa0Q7QUFDbEQsMkNBQTZCO0FBQzdCLCtCQUF3QztBQUN4Qyw4Q0FBc0Q7QUFDdEQseUNBQTJCO0FBSTNCLHVDQUFvRDtBQUNwRCx1REFBbUQ7QUFDbkQsNkNBQTJDO0FBQzNDLDJEQUF5RTtBQUV6RSxxRUFBd0U7QUFDeEUsaUVBQTZGO0FBQzdGLHVFQUFxRTtBQUNyRSx5REFBK0Q7QUFDL0QsaURBQXFFO0FBQ3JFLCtFQUk0QztBQUM1Qyx5RUFBdUU7QUFDdkUsbURBSytCO0FBQy9CLCtGQUF5RjtBQUN6Rix1RkFBa0Y7QUFDbEYscURBQXlFO0FBQ3pFLDhDQUFrRjtBQVlsRjs7Ozs7Ozs7R0FRRztBQUNILGtEQUFrRDtBQUNsRCxTQUFnQixtQkFBbUIsQ0FDakMsT0FBZ0MsRUFDaEMsT0FBdUIsRUFDdkIsYUFJSSxFQUFFO0lBRU4seUJBQXlCO0lBQ3pCLE1BQU0sRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLEdBQUcsT0FBTyxDQUFDO0lBQzFDLElBQUEsd0NBQThCLEVBQUMsYUFBYSxDQUFDLENBQUM7SUFFOUMsTUFBTSxhQUFhLEdBQUcsSUFBQSxrQ0FBc0IsRUFBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7SUFFcEUsS0FBSyxVQUFVLEtBQUs7O1FBS2xCLE1BQU0sV0FBVyxHQUFHLE1BQUEsT0FBTyxDQUFDLE1BQU0sMENBQUUsT0FBTyxDQUFDO1FBQzVDLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDaEIsTUFBTSxJQUFJLEtBQUss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QyxlQUFlLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRTs7Z0JBQ2xFLElBQUksSUFBSSxDQUFDLFlBQVksSUFBSSxpQkFBaUIsQ0FBQyxXQUFXLEtBQUssU0FBUyxFQUFFO29CQUNwRSxzQkFBc0I7b0JBQ3RCLElBQUEsK0JBQWdCLEVBQ2QsTUFBTSxFQUNOLGlCQUFpQixFQUNqQixPQUFPLENBQUMsYUFBYSxFQUNyQixNQUFNLEVBQ047d0JBQ0UsSUFBSSxDQUFDLE9BQU87NEJBQ1YsSUFBQSxnQ0FBVSxFQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQzt3QkFDbkMsQ0FBQzt3QkFDRCxLQUFLLENBQUMsT0FBTzs0QkFDWCxJQUFBLDhCQUFRLEVBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO3dCQUNqQyxDQUFDO3FCQUNGLEVBQ0QsU0FBUyxFQUNULGNBQWMsQ0FBQyx3QkFBd0IsQ0FDeEMsQ0FBQztvQkFFRixpQkFBaUIsQ0FBQyxXQUFXLEdBQUcsTUFBQSxpQkFBaUIsQ0FBQyxXQUFXLG1DQUFJLEVBQUUsQ0FBQztpQkFDckU7Z0JBRUQsV0FBVyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxHQUFHLEVBQUU7b0JBQ3hELHNFQUFzRTtvQkFDdEUsaUJBQWlCLENBQUMsV0FBVyxHQUFHLFNBQVMsQ0FBQztnQkFDNUMsQ0FBQyxDQUFDLENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsa0JBQWUsSUFBQSx5QkFBYSxFQUFrRCxtQkFBbUIsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBjcmVhdGVCdWlsZGVyLCB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQge1xuICBEZXZTZXJ2ZXJCdWlsZE91dHB1dCxcbiAgV2VicGFja0xvZ2dpbmdDYWxsYmFjayxcbiAgcnVuV2VicGFja0RldlNlcnZlcixcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLXdlYnBhY2snO1xuaW1wb3J0IHsganNvbiwgdGFncyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBmcm9tIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBjb25jYXRNYXAsIHN3aXRjaE1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHVybCBmcm9tICd1cmwnO1xuaW1wb3J0IHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgd2VicGFja0RldlNlcnZlciBmcm9tICd3ZWJwYWNrLWRldi1zZXJ2ZXInO1xuaW1wb3J0IHsgRXhlY3V0aW9uVHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7IG5vcm1hbGl6ZU9wdGltaXphdGlvbiB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IGNoZWNrUG9ydCB9IGZyb20gJy4uLy4uL3V0aWxzL2NoZWNrLXBvcnQnO1xuaW1wb3J0IHsgY29sb3JzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29sb3InO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMsIGxvYWRUcmFuc2xhdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgSW5kZXhIdG1sVHJhbnNmb3JtIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBjcmVhdGVUcmFuc2xhdGlvbkxvYWRlciB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtdHJhbnNsYXRpb25zJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRDYWNoZWRPcHRpb25zLCBub3JtYWxpemVDYWNoZU9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9ub3JtYWxpemUtY2FjaGUnO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cyB9IGZyb20gJy4uLy4uL3V0aWxzL3BhY2thZ2UtY2h1bmstc29ydCc7XG5pbXBvcnQgeyBwdXJnZVN0YWxlQnVpbGRDYWNoZSB9IGZyb20gJy4uLy4uL3V0aWxzL3B1cmdlLWNhY2hlJztcbmltcG9ydCB7IGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbiB9IGZyb20gJy4uLy4uL3V0aWxzL3ZlcnNpb24nO1xuaW1wb3J0IHtcbiAgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dCxcbiAgZ2V0SW5kZXhJbnB1dEZpbGUsXG4gIGdldEluZGV4T3V0cHV0RmlsZSxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBhZGRFcnJvciwgYWRkV2FybmluZyB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stZGlhZ25vc3RpY3MnO1xuaW1wb3J0IHtcbiAgZ2V0QW5hbHl0aWNzQ29uZmlnLFxuICBnZXRDb21tb25Db25maWcsXG4gIGdldERldlNlcnZlckNvbmZpZyxcbiAgZ2V0U3R5bGVzQ29uZmlnLFxufSBmcm9tICcuLi8uLi93ZWJwYWNrL2NvbmZpZ3MnO1xuaW1wb3J0IHsgSW5kZXhIdG1sV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3dlYnBhY2svcGx1Z2lucy9pbmRleC1odG1sLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IFNlcnZpY2VXb3JrZXJQbHVnaW4gfSBmcm9tICcuLi8uLi93ZWJwYWNrL3BsdWdpbnMvc2VydmljZS13b3JrZXItcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZVdlYnBhY2tMb2dnaW5nQ2FsbGJhY2sgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL3N0YXRzJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlclNjaGVtYSwgT3V0cHV0SGFzaGluZyB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IFNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IHR5cGUgRGV2U2VydmVyQnVpbGRlck9wdGlvbnMgPSBTY2hlbWE7XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyB0eXBlIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgdHlwZSBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0ID0gRGV2U2VydmVyQnVpbGRPdXRwdXQgJiB7XG4gIGJhc2VVcmw6IHN0cmluZztcbn07XG5cbi8qKlxuICogUmV1c2FibGUgaW1wbGVtZW50YXRpb24gb2YgdGhlIEFuZ3VsYXIgV2VicGFjayBkZXZlbG9wbWVudCBzZXJ2ZXIgYnVpbGRlci5cbiAqIEBwYXJhbSBvcHRpb25zIERldiBTZXJ2ZXIgb3B0aW9ucy5cbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBidWlsZCBjb250ZXh0LlxuICogQHBhcmFtIHRyYW5zZm9ybXMgQSBtYXAgb2YgdHJhbnNmb3JtcyB0aGF0IGNhbiBiZSB1c2VkIHRvIGhvb2sgaW50byBzb21lIGxvZ2ljIChzdWNoIGFzXG4gKiAgICAgdHJhbnNmb3JtaW5nIHdlYnBhY2sgY29uZmlndXJhdGlvbiBiZWZvcmUgcGFzc2luZyBpdCB0byB3ZWJwYWNrKS5cbiAqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIHNlcnZlV2VicGFja0Jyb3dzZXIoXG4gIG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgdHJhbnNmb3Jtczoge1xuICAgIHdlYnBhY2tDb25maWd1cmF0aW9uPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8d2VicGFjay5Db25maWd1cmF0aW9uPjtcbiAgICBsb2dnaW5nPzogV2VicGFja0xvZ2dpbmdDYWxsYmFjaztcbiAgICBpbmRleEh0bWw/OiBJbmRleEh0bWxUcmFuc2Zvcm07XG4gIH0gPSB7fSxcbik6IE9ic2VydmFibGU8RGV2U2VydmVyQnVpbGRlck91dHB1dD4ge1xuICAvLyBDaGVjayBBbmd1bGFyIHZlcnNpb24uXG4gIGNvbnN0IHsgbG9nZ2VyLCB3b3Jrc3BhY2VSb290IH0gPSBjb250ZXh0O1xuICBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24od29ya3NwYWNlUm9vdCk7XG5cbiAgY29uc3QgYnJvd3NlclRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5icm93c2VyVGFyZ2V0KTtcblxuICBhc3luYyBmdW5jdGlvbiBzZXR1cCgpOiBQcm9taXNlPHtcbiAgICBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWE7XG4gICAgd2VicGFja0NvbmZpZzogd2VicGFjay5Db25maWd1cmF0aW9uO1xuICAgIHByb2plY3RSb290OiBzdHJpbmc7XG4gIH0+IHtcbiAgICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0Py5wcm9qZWN0O1xuICAgIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQuJyk7XG4gICAgfVxuXG4gICAgLy8gUHVyZ2Ugb2xkIGJ1aWxkIGRpc2sgY2FjaGUuXG4gICAgYXdhaXQgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUoY29udGV4dCk7XG5cbiAgICBvcHRpb25zLnBvcnQgPSBhd2FpdCBjaGVja1BvcnQob3B0aW9ucy5wb3J0ID8/IDQyMDAsIG9wdGlvbnMuaG9zdCB8fCAnbG9jYWxob3N0Jyk7XG5cbiAgICBpZiAob3B0aW9ucy5obXIpIHtcbiAgICAgIGxvZ2dlci53YXJuKHRhZ3Muc3RyaXBJbmRlbnRzYE5PVElDRTogSG90IE1vZHVsZSBSZXBsYWNlbWVudCAoSE1SKSBpcyBlbmFibGVkIGZvciB0aGUgZGV2IHNlcnZlci5cbiAgICAgIFNlZSBodHRwczovL3dlYnBhY2suanMub3JnL2d1aWRlcy9ob3QtbW9kdWxlLXJlcGxhY2VtZW50IGZvciBpbmZvcm1hdGlvbiBvbiB3b3JraW5nIHdpdGggSE1SIGZvciBXZWJwYWNrLmApO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgICFvcHRpb25zLmRpc2FibGVIb3N0Q2hlY2sgJiZcbiAgICAgIG9wdGlvbnMuaG9zdCAmJlxuICAgICAgIS9eMTI3XFwuXFxkK1xcLlxcZCtcXC5cXGQrL2cudGVzdChvcHRpb25zLmhvc3QpICYmXG4gICAgICBvcHRpb25zLmhvc3QgIT09ICdsb2NhbGhvc3QnXG4gICAgKSB7XG4gICAgICBsb2dnZXIud2Fybih0YWdzLnN0cmlwSW5kZW50YFxuICAgICAgICBXYXJuaW5nOiBUaGlzIGlzIGEgc2ltcGxlIHNlcnZlciBmb3IgdXNlIGluIHRlc3Rpbmcgb3IgZGVidWdnaW5nIEFuZ3VsYXIgYXBwbGljYXRpb25zXG4gICAgICAgIGxvY2FsbHkuIEl0IGhhc24ndCBiZWVuIHJldmlld2VkIGZvciBzZWN1cml0eSBpc3N1ZXMuXG5cbiAgICAgICAgQmluZGluZyB0aGlzIHNlcnZlciB0byBhbiBvcGVuIGNvbm5lY3Rpb24gY2FuIHJlc3VsdCBpbiBjb21wcm9taXNpbmcgeW91ciBhcHBsaWNhdGlvbiBvclxuICAgICAgICBjb21wdXRlci4gVXNpbmcgYSBkaWZmZXJlbnQgaG9zdCB0aGFuIHRoZSBvbmUgcGFzc2VkIHRvIHRoZSBcIi0taG9zdFwiIGZsYWcgbWlnaHQgcmVzdWx0IGluXG4gICAgICAgIHdlYnNvY2tldCBjb25uZWN0aW9uIGlzc3Vlcy4gWW91IG1pZ2h0IG5lZWQgdG8gdXNlIFwiLS1kaXNhYmxlLWhvc3QtY2hlY2tcIiBpZiB0aGF0J3MgdGhlXG4gICAgICAgIGNhc2UuXG4gICAgICBgKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5kaXNhYmxlSG9zdENoZWNrKSB7XG4gICAgICBsb2dnZXIud2Fybih0YWdzLm9uZUxpbmVgXG4gICAgICAgIFdhcm5pbmc6IFJ1bm5pbmcgYSBzZXJ2ZXIgd2l0aCAtLWRpc2FibGUtaG9zdC1jaGVjayBpcyBhIHNlY3VyaXR5IHJpc2suXG4gICAgICAgIFNlZSBodHRwczovL21lZGl1bS5jb20vd2VicGFjay93ZWJwYWNrLWRldi1zZXJ2ZXItbWlkZGxld2FyZS1zZWN1cml0eS1pc3N1ZXMtMTQ4OWQ5NTA4NzRhXG4gICAgICAgIGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICAgICAgYCk7XG4gICAgfVxuICAgIC8vIEdldCB0aGUgYnJvd3NlciBjb25maWd1cmF0aW9uIGZyb20gdGhlIHRhcmdldCBuYW1lLlxuICAgIGNvbnN0IHJhd0Jyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhicm93c2VyVGFyZ2V0KSkgYXMganNvbi5Kc29uT2JqZWN0ICZcbiAgICAgIEJyb3dzZXJCdWlsZGVyU2NoZW1hO1xuXG4gICAgaWYgKHJhd0Jyb3dzZXJPcHRpb25zLm91dHB1dEhhc2hpbmcgJiYgcmF3QnJvd3Nlck9wdGlvbnMub3V0cHV0SGFzaGluZyAhPT0gT3V0cHV0SGFzaGluZy5Ob25lKSB7XG4gICAgICAvLyBEaXNhYmxlIG91dHB1dCBoYXNoaW5nIGZvciBkZXYgYnVpbGQgYXMgdGhpcyBjYW4gY2F1c2UgbWVtb3J5IGxlYWtzXG4gICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LXNlcnZlci9pc3N1ZXMvMzc3I2lzc3VlY29tbWVudC0yNDEyNTg0MDVcbiAgICAgIHJhd0Jyb3dzZXJPcHRpb25zLm91dHB1dEhhc2hpbmcgPSBPdXRwdXRIYXNoaW5nLk5vbmU7XG4gICAgICBsb2dnZXIud2FybihgV2FybmluZzogJ291dHB1dEhhc2hpbmcnIG9wdGlvbiBpcyBkaXNhYmxlZCB3aGVuIHVzaW5nIHRoZSBkZXYtc2VydmVyLmApO1xuICAgIH1cblxuICAgIGNvbnN0IG1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICAgIGNvbnN0IGNhY2hlT3B0aW9ucyA9IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyhtZXRhZGF0YSwgY29udGV4dC53b3Jrc3BhY2VSb290KTtcblxuICAgIGNvbnN0IGJyb3dzZXJOYW1lID0gYXdhaXQgY29udGV4dC5nZXRCdWlsZGVyTmFtZUZvclRhcmdldChicm93c2VyVGFyZ2V0KTtcbiAgICBjb25zdCBicm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LnZhbGlkYXRlT3B0aW9ucyhcbiAgICAgIHtcbiAgICAgICAgLi4ucmF3QnJvd3Nlck9wdGlvbnMsXG4gICAgICAgIHdhdGNoOiBvcHRpb25zLndhdGNoLFxuICAgICAgICB2ZXJib3NlOiBvcHRpb25zLnZlcmJvc2UsXG4gICAgICAgIC8vIEluIGRldiBzZXJ2ZXIgd2Ugc2hvdWxkIG5vdCBoYXZlIGJ1ZGdldHMgYmVjYXVzZSBvZiBleHRyYSBsaWJzIHN1Y2ggYXMgc29ja3MtanNcbiAgICAgICAgYnVkZ2V0czogdW5kZWZpbmVkLFxuICAgICAgfSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgICAgIGJyb3dzZXJOYW1lLFxuICAgICkpIGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyU2NoZW1hO1xuXG4gICAgY29uc3QgeyBzdHlsZXMsIHNjcmlwdHMgfSA9IG5vcm1hbGl6ZU9wdGltaXphdGlvbihicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24pO1xuICAgIGlmIChzY3JpcHRzIHx8IHN0eWxlcy5taW5pZnkpIHtcbiAgICAgIGxvZ2dlci5lcnJvcih0YWdzLnN0cmlwSW5kZW50c2BcbiAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBUaGlzIGlzIGEgc2ltcGxlIHNlcnZlciBmb3IgdXNlIGluIHRlc3Rpbmcgb3IgZGVidWdnaW5nIEFuZ3VsYXIgYXBwbGljYXRpb25zIGxvY2FsbHkuXG4gICAgICAgIEl0IGhhc24ndCBiZWVuIHJldmlld2VkIGZvciBzZWN1cml0eSBpc3N1ZXMuXG5cbiAgICAgICAgRE9OJ1QgVVNFIElUIEZPUiBQUk9EVUNUSU9OIVxuICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICBgKTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGNvbmZpZywgcHJvamVjdFJvb3QsIGkxOG4gfSA9IGF3YWl0IGdlbmVyYXRlSTE4bkJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQoXG4gICAgICBicm93c2VyT3B0aW9ucyxcbiAgICAgIGNvbnRleHQsXG4gICAgICAod2NvKSA9PiBbXG4gICAgICAgIGdldERldlNlcnZlckNvbmZpZyh3Y28pLFxuICAgICAgICBnZXRDb21tb25Db25maWcod2NvKSxcbiAgICAgICAgZ2V0U3R5bGVzQ29uZmlnKHdjbyksXG4gICAgICAgIGdldEFuYWx5dGljc0NvbmZpZyh3Y28sIGNvbnRleHQpLFxuICAgICAgXSxcbiAgICAgIG9wdGlvbnMsXG4gICAgKTtcblxuICAgIGlmICghY29uZmlnLmRldlNlcnZlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdXZWJwYWNrIERldiBTZXJ2ZXIgY29uZmlndXJhdGlvbiB3YXMgbm90IHNldC4nKTtcbiAgICB9XG5cbiAgICBsZXQgbG9jYWxlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgaWYgKGkxOG4uc2hvdWxkSW5saW5lKSB7XG4gICAgICAvLyBEZXYtc2VydmVyIG9ubHkgc3VwcG9ydHMgb25lIGxvY2FsZVxuICAgICAgbG9jYWxlID0gWy4uLmkxOG4uaW5saW5lTG9jYWxlc11bMF07XG4gICAgfSBlbHNlIGlmIChpMThuLmhhc0RlZmluZWRTb3VyY2VMb2NhbGUpIHtcbiAgICAgIC8vIHVzZSBzb3VyY2UgbG9jYWxlIGlmIG5vdCBsb2NhbGl6aW5nXG4gICAgICBsb2NhbGUgPSBpMThuLnNvdXJjZUxvY2FsZTtcbiAgICB9XG5cbiAgICBsZXQgd2VicGFja0NvbmZpZyA9IGNvbmZpZztcblxuICAgIC8vIElmIGEgbG9jYWxlIGlzIGRlZmluZWQsIHNldHVwIGxvY2FsaXphdGlvblxuICAgIGlmIChsb2NhbGUpIHtcbiAgICAgIGlmIChpMThuLmlubGluZUxvY2FsZXMuc2l6ZSA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdUaGUgZGV2ZWxvcG1lbnQgc2VydmVyIG9ubHkgc3VwcG9ydHMgbG9jYWxpemluZyBhIHNpbmdsZSBsb2NhbGUgcGVyIGJ1aWxkLicsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHNldHVwTG9jYWxpemUobG9jYWxlLCBpMThuLCBicm93c2VyT3B0aW9ucywgd2VicGFja0NvbmZpZywgY2FjaGVPcHRpb25zLCBjb250ZXh0KTtcbiAgICB9XG5cbiAgICBpZiAodHJhbnNmb3Jtcy53ZWJwYWNrQ29uZmlndXJhdGlvbikge1xuICAgICAgd2VicGFja0NvbmZpZyA9IGF3YWl0IHRyYW5zZm9ybXMud2VicGFja0NvbmZpZ3VyYXRpb24od2VicGFja0NvbmZpZyk7XG4gICAgfVxuXG4gICAgd2VicGFja0NvbmZpZy5wbHVnaW5zID8/PSBbXTtcblxuICAgIGlmIChicm93c2VyT3B0aW9ucy5pbmRleCkge1xuICAgICAgY29uc3QgeyBzY3JpcHRzID0gW10sIHN0eWxlcyA9IFtdLCBiYXNlSHJlZiB9ID0gYnJvd3Nlck9wdGlvbnM7XG4gICAgICBjb25zdCBlbnRyeXBvaW50cyA9IGdlbmVyYXRlRW50cnlQb2ludHMoe1xuICAgICAgICBzY3JpcHRzLFxuICAgICAgICBzdHlsZXMsXG4gICAgICAgIC8vIFRoZSBiZWxvdyBpcyBuZWVkZWQgYXMgb3RoZXJ3aXNlIEhNUiBmb3IgQ1NTIHdpbGwgYnJlYWsuXG4gICAgICAgIC8vIHN0eWxlcy5qcyBhbmQgcnVudGltZS5qcyBuZWVkcyB0byBiZSBsb2FkZWQgYXMgYSBub24tbW9kdWxlIHNjcmlwdHMgYXMgb3RoZXJ3aXNlIGBkb2N1bWVudC5jdXJyZW50U2NyaXB0YCB3aWxsIGJlIG51bGwuXG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvbWluaS1jc3MtZXh0cmFjdC1wbHVnaW4vYmxvYi85MDQ0NWRkMWQ4MWRhMGMxMGI5YjBlOGExN2I0MTdkMDY1MTgxNmI4L3NyYy9obXIvaG90TW9kdWxlUmVwbGFjZW1lbnQuanMjTDM5XG4gICAgICAgIGlzSE1SRW5hYmxlZDogISF3ZWJwYWNrQ29uZmlnLmRldlNlcnZlcj8uaG90LFxuICAgICAgfSk7XG5cbiAgICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy5wdXNoKFxuICAgICAgICBuZXcgSW5kZXhIdG1sV2VicGFja1BsdWdpbih7XG4gICAgICAgICAgaW5kZXhQYXRoOiBwYXRoLnJlc29sdmUod29ya3NwYWNlUm9vdCwgZ2V0SW5kZXhJbnB1dEZpbGUoYnJvd3Nlck9wdGlvbnMuaW5kZXgpKSxcbiAgICAgICAgICBvdXRwdXRQYXRoOiBnZXRJbmRleE91dHB1dEZpbGUoYnJvd3Nlck9wdGlvbnMuaW5kZXgpLFxuICAgICAgICAgIGJhc2VIcmVmLFxuICAgICAgICAgIGVudHJ5cG9pbnRzLFxuICAgICAgICAgIGRlcGxveVVybDogYnJvd3Nlck9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgICAgIHNyaTogYnJvd3Nlck9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgICAgICAgY2FjaGU6IGNhY2hlT3B0aW9ucyxcbiAgICAgICAgICBwb3N0VHJhbnNmb3JtOiB0cmFuc2Zvcm1zLmluZGV4SHRtbCxcbiAgICAgICAgICBvcHRpbWl6YXRpb246IG5vcm1hbGl6ZU9wdGltaXphdGlvbihicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24pLFxuICAgICAgICAgIGNyb3NzT3JpZ2luOiBicm93c2VyT3B0aW9ucy5jcm9zc09yaWdpbixcbiAgICAgICAgICBsYW5nOiBsb2NhbGUsXG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoYnJvd3Nlck9wdGlvbnMuc2VydmljZVdvcmtlcikge1xuICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnB1c2goXG4gICAgICAgIG5ldyBTZXJ2aWNlV29ya2VyUGx1Z2luKHtcbiAgICAgICAgICBiYXNlSHJlZjogYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgICAgcm9vdDogY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgICAgIHByb2plY3RSb290LFxuICAgICAgICAgIG5nc3dDb25maWdQYXRoOiBicm93c2VyT3B0aW9ucy5uZ3N3Q29uZmlnUGF0aCxcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBicm93c2VyT3B0aW9ucyxcbiAgICAgIHdlYnBhY2tDb25maWcsXG4gICAgICBwcm9qZWN0Um9vdCxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIGZyb20oc2V0dXAoKSkucGlwZShcbiAgICBzd2l0Y2hNYXAoKHsgYnJvd3Nlck9wdGlvbnMsIHdlYnBhY2tDb25maWcgfSkgPT4ge1xuICAgICAgcmV0dXJuIHJ1bldlYnBhY2tEZXZTZXJ2ZXIod2VicGFja0NvbmZpZywgY29udGV4dCwge1xuICAgICAgICBsb2dnaW5nOiB0cmFuc2Zvcm1zLmxvZ2dpbmcgfHwgY3JlYXRlV2VicGFja0xvZ2dpbmdDYWxsYmFjayhicm93c2VyT3B0aW9ucywgbG9nZ2VyKSxcbiAgICAgICAgd2VicGFja0ZhY3Rvcnk6IHJlcXVpcmUoJ3dlYnBhY2snKSBhcyB0eXBlb2Ygd2VicGFjayxcbiAgICAgICAgd2VicGFja0RldlNlcnZlckZhY3Rvcnk6IHJlcXVpcmUoJ3dlYnBhY2stZGV2LXNlcnZlcicpIGFzIHR5cGVvZiB3ZWJwYWNrRGV2U2VydmVyLFxuICAgICAgfSkucGlwZShcbiAgICAgICAgY29uY2F0TWFwKGFzeW5jIChidWlsZEV2ZW50LCBpbmRleCkgPT4ge1xuICAgICAgICAgIC8vIFJlc29sdmUgc2VydmUgYWRkcmVzcy5cbiAgICAgICAgICBjb25zdCBwdWJsaWNQYXRoID0gd2VicGFja0NvbmZpZy5kZXZTZXJ2ZXI/LmRldk1pZGRsZXdhcmU/LnB1YmxpY1BhdGg7XG5cbiAgICAgICAgICBjb25zdCBzZXJ2ZXJBZGRyZXNzID0gdXJsLmZvcm1hdCh7XG4gICAgICAgICAgICBwcm90b2NvbDogb3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnLFxuICAgICAgICAgICAgaG9zdG5hbWU6IG9wdGlvbnMuaG9zdCA9PT0gJzAuMC4wLjAnID8gJ2xvY2FsaG9zdCcgOiBvcHRpb25zLmhvc3QsXG4gICAgICAgICAgICBwb3J0OiBidWlsZEV2ZW50LnBvcnQsXG4gICAgICAgICAgICBwYXRobmFtZTogdHlwZW9mIHB1YmxpY1BhdGggPT09ICdzdHJpbmcnID8gcHVibGljUGF0aCA6IHVuZGVmaW5lZCxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGlmIChpbmRleCA9PT0gMCkge1xuICAgICAgICAgICAgbG9nZ2VyLmluZm8oXG4gICAgICAgICAgICAgICdcXG4nICtcbiAgICAgICAgICAgICAgICB0YWdzLm9uZUxpbmVgXG4gICAgICAgICAgICAgICoqXG4gICAgICAgICAgICAgIEFuZ3VsYXIgTGl2ZSBEZXZlbG9wbWVudCBTZXJ2ZXIgaXMgbGlzdGVuaW5nIG9uICR7b3B0aW9ucy5ob3N0fToke2J1aWxkRXZlbnQucG9ydH0sXG4gICAgICAgICAgICAgIG9wZW4geW91ciBicm93c2VyIG9uICR7c2VydmVyQWRkcmVzc31cbiAgICAgICAgICAgICAgKipcbiAgICAgICAgICAgIGAgK1xuICAgICAgICAgICAgICAgICdcXG4nLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMub3Blbikge1xuICAgICAgICAgICAgICBjb25zdCBvcGVuID0gKGF3YWl0IGltcG9ydCgnb3BlbicpKS5kZWZhdWx0O1xuICAgICAgICAgICAgICBhd2FpdCBvcGVuKHNlcnZlckFkZHJlc3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChidWlsZEV2ZW50LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBcXG4ke2NvbG9ycy5ncmVlbkJyaWdodChjb2xvcnMuc3ltYm9scy5jaGVjayl9IENvbXBpbGVkIHN1Y2Nlc3NmdWxseS5gKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9nZ2VyLmluZm8oYFxcbiR7Y29sb3JzLnJlZEJyaWdodChjb2xvcnMuc3ltYm9scy5jcm9zcyl9IEZhaWxlZCB0byBjb21waWxlLmApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB7IC4uLmJ1aWxkRXZlbnQsIGJhc2VVcmw6IHNlcnZlckFkZHJlc3MgfSBhcyBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0O1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfSksXG4gICk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNldHVwTG9jYWxpemUoXG4gIGxvY2FsZTogc3RyaW5nLFxuICBpMThuOiBJMThuT3B0aW9ucyxcbiAgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICB3ZWJwYWNrQ29uZmlnOiB3ZWJwYWNrLkNvbmZpZ3VyYXRpb24sXG4gIGNhY2hlT3B0aW9uczogTm9ybWFsaXplZENhY2hlZE9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKSB7XG4gIGNvbnN0IGxvY2FsZURlc2NyaXB0aW9uID0gaTE4bi5sb2NhbGVzW2xvY2FsZV07XG5cbiAgLy8gTW9kaWZ5IG1haW4gZW50cnlwb2ludCB0byBpbmNsdWRlIGxvY2FsZSBkYXRhXG4gIGlmIChcbiAgICBsb2NhbGVEZXNjcmlwdGlvbj8uZGF0YVBhdGggJiZcbiAgICB0eXBlb2Ygd2VicGFja0NvbmZpZy5lbnRyeSA9PT0gJ29iamVjdCcgJiZcbiAgICAhQXJyYXkuaXNBcnJheSh3ZWJwYWNrQ29uZmlnLmVudHJ5KSAmJlxuICAgIHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXVxuICApIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10pKSB7XG4gICAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10udW5zaGlmdChsb2NhbGVEZXNjcmlwdGlvbi5kYXRhUGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXSA9IFtcbiAgICAgICAgbG9jYWxlRGVzY3JpcHRpb24uZGF0YVBhdGgsXG4gICAgICAgIHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXSBhcyBzdHJpbmcsXG4gICAgICBdO1xuICAgIH1cbiAgfVxuXG4gIGxldCBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvciA9IGJyb3dzZXJPcHRpb25zLmkxOG5NaXNzaW5nVHJhbnNsYXRpb24gfHwgJ2lnbm9yZSc7XG4gIGxldCB0cmFuc2xhdGlvbiA9IGxvY2FsZURlc2NyaXB0aW9uPy50cmFuc2xhdGlvbiB8fCB7fTtcblxuICBpZiAobG9jYWxlID09PSBpMThuLnNvdXJjZUxvY2FsZSkge1xuICAgIG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yID0gJ2lnbm9yZSc7XG4gICAgdHJhbnNsYXRpb24gPSB7fTtcbiAgfVxuXG4gIGNvbnN0IGkxOG5Mb2FkZXJPcHRpb25zID0ge1xuICAgIGxvY2FsZSxcbiAgICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvcixcbiAgICB0cmFuc2xhdGlvbjogaTE4bi5zaG91bGRJbmxpbmUgPyB0cmFuc2xhdGlvbiA6IHVuZGVmaW5lZCxcbiAgICB0cmFuc2xhdGlvbkZpbGVzOiBsb2NhbGVEZXNjcmlwdGlvbj8uZmlsZXMubWFwKChmaWxlKSA9PlxuICAgICAgcGF0aC5yZXNvbHZlKGNvbnRleHQud29ya3NwYWNlUm9vdCwgZmlsZS5wYXRoKSxcbiAgICApLFxuICB9O1xuXG4gIGNvbnN0IGkxOG5SdWxlOiB3ZWJwYWNrLlJ1bGVTZXRSdWxlID0ge1xuICAgIHRlc3Q6IC9cXC5bY21dP1t0al1zeD8kLyxcbiAgICBlbmZvcmNlOiAncG9zdCcsXG4gICAgdXNlOiBbXG4gICAgICB7XG4gICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCcuLi8uLi9iYWJlbC93ZWJwYWNrLWxvYWRlcicpLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgY2FjaGVEaXJlY3Rvcnk6XG4gICAgICAgICAgICAoY2FjaGVPcHRpb25zLmVuYWJsZWQgJiYgcGF0aC5qb2luKGNhY2hlT3B0aW9ucy5wYXRoLCAnYmFiZWwtZGV2LXNlcnZlci1pMThuJykpIHx8XG4gICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICBjYWNoZUlkZW50aWZpZXI6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGxvY2FsZSxcbiAgICAgICAgICAgIHRyYW5zbGF0aW9uSW50ZWdyaXR5OiBsb2NhbGVEZXNjcmlwdGlvbj8uZmlsZXMubWFwKChmaWxlKSA9PiBmaWxlLmludGVncml0eSksXG4gICAgICAgICAgfSksXG4gICAgICAgICAgaTE4bjogaTE4bkxvYWRlck9wdGlvbnMsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIF0sXG4gIH07XG5cbiAgLy8gR2V0IHRoZSBydWxlcyBhbmQgZW5zdXJlIHRoZSBXZWJwYWNrIGNvbmZpZ3VyYXRpb24gaXMgc2V0dXAgcHJvcGVybHlcbiAgY29uc3QgcnVsZXMgPSB3ZWJwYWNrQ29uZmlnLm1vZHVsZT8ucnVsZXMgfHwgW107XG4gIGlmICghd2VicGFja0NvbmZpZy5tb2R1bGUpIHtcbiAgICB3ZWJwYWNrQ29uZmlnLm1vZHVsZSA9IHsgcnVsZXMgfTtcbiAgfSBlbHNlIGlmICghd2VicGFja0NvbmZpZy5tb2R1bGUucnVsZXMpIHtcbiAgICB3ZWJwYWNrQ29uZmlnLm1vZHVsZS5ydWxlcyA9IHJ1bGVzO1xuICB9XG5cbiAgcnVsZXMucHVzaChpMThuUnVsZSk7XG5cbiAgLy8gQWRkIGEgcGx1Z2luIHRvIHJlbG9hZCB0cmFuc2xhdGlvbiBmaWxlcyBvbiByZWJ1aWxkc1xuICBjb25zdCBsb2FkZXIgPSBhd2FpdCBjcmVhdGVUcmFuc2xhdGlvbkxvYWRlcigpO1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMhLnB1c2goe1xuICAgIGFwcGx5OiAoY29tcGlsZXI6IHdlYnBhY2suQ29tcGlsZXIpID0+IHtcbiAgICAgIGNvbXBpbGVyLmhvb2tzLnRoaXNDb21waWxhdGlvbi50YXAoJ2J1aWxkLWFuZ3VsYXInLCAoY29tcGlsYXRpb24pID0+IHtcbiAgICAgICAgaWYgKGkxOG4uc2hvdWxkSW5saW5lICYmIGkxOG5Mb2FkZXJPcHRpb25zLnRyYW5zbGF0aW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBSZWxvYWQgdHJhbnNsYXRpb25zXG4gICAgICAgICAgbG9hZFRyYW5zbGF0aW9ucyhcbiAgICAgICAgICAgIGxvY2FsZSxcbiAgICAgICAgICAgIGxvY2FsZURlc2NyaXB0aW9uLFxuICAgICAgICAgICAgY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgICAgICAgbG9hZGVyLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB3YXJuKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICBhZGRXYXJuaW5nKGNvbXBpbGF0aW9uLCBtZXNzYWdlKTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgZXJyb3IobWVzc2FnZSkge1xuICAgICAgICAgICAgICAgIGFkZEVycm9yKGNvbXBpbGF0aW9uLCBtZXNzYWdlKTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgICBicm93c2VyT3B0aW9ucy5pMThuRHVwbGljYXRlVHJhbnNsYXRpb24sXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGkxOG5Mb2FkZXJPcHRpb25zLnRyYW5zbGF0aW9uID0gbG9jYWxlRGVzY3JpcHRpb24udHJhbnNsYXRpb24gPz8ge307XG4gICAgICAgIH1cblxuICAgICAgICBjb21waWxhdGlvbi5ob29rcy5maW5pc2hNb2R1bGVzLnRhcCgnYnVpbGQtYW5ndWxhcicsICgpID0+IHtcbiAgICAgICAgICAvLyBBZnRlciBsb2FkZXJzIGFyZSBmaW5pc2hlZCwgY2xlYXIgb3V0IHRoZSBub3cgdW5uZWVkZWQgdHJhbnNsYXRpb25zXG4gICAgICAgICAgaTE4bkxvYWRlck9wdGlvbnMudHJhbnNsYXRpb24gPSB1bmRlZmluZWQ7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXI8RGV2U2VydmVyQnVpbGRlck9wdGlvbnMsIERldlNlcnZlckJ1aWxkZXJPdXRwdXQ+KHNlcnZlV2VicGFja0Jyb3dzZXIpO1xuIl19