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
                outputPath: path.join(context.workspaceRoot, browserOptions.outputPath),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQWtHO0FBQ2xHLGlFQUl1QztBQUN2QywrQ0FBa0Q7QUFDbEQsMkNBQTZCO0FBQzdCLCtCQUF3QztBQUN4Qyw4Q0FBc0Q7QUFDdEQseUNBQTJCO0FBSTNCLHVDQUFvRDtBQUNwRCx1REFBbUQ7QUFDbkQsNkNBQTJDO0FBQzNDLDJEQUF5RTtBQUV6RSxxRUFBd0U7QUFDeEUsaUVBQTZGO0FBQzdGLHVFQUFxRTtBQUNyRSx5REFBK0Q7QUFDL0QsaURBQXFFO0FBQ3JFLCtFQUk0QztBQUM1Qyx5RUFBdUU7QUFDdkUsbURBSytCO0FBQy9CLCtGQUF5RjtBQUN6Rix1RkFBa0Y7QUFDbEYscURBQXlFO0FBQ3pFLDhDQUFrRjtBQVlsRjs7Ozs7Ozs7R0FRRztBQUNILGtEQUFrRDtBQUNsRCxTQUFnQixtQkFBbUIsQ0FDakMsT0FBZ0MsRUFDaEMsT0FBdUIsRUFDdkIsYUFJSSxFQUFFO0lBRU4seUJBQXlCO0lBQ3pCLE1BQU0sRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLEdBQUcsT0FBTyxDQUFDO0lBQzFDLElBQUEsd0NBQThCLEVBQUMsYUFBYSxDQUFDLENBQUM7SUFFOUMsTUFBTSxhQUFhLEdBQUcsSUFBQSxrQ0FBc0IsRUFBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7SUFFcEUsS0FBSyxVQUFVLEtBQUs7O1FBS2xCLE1BQU0sV0FBVyxHQUFHLE1BQUEsT0FBTyxDQUFDLE1BQU0sMENBQUUsT0FBTyxDQUFDO1FBQzVDLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDaEIsTUFBTSxJQUFJLEtBQUss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QixLQUFLLEVBQUUsQ0FBQyxRQUEwQixFQUFFLEVBQUU7WUFDcEMsUUFBUSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFOztnQkFDbEUsSUFBSSxJQUFJLENBQUMsWUFBWSxJQUFJLGlCQUFpQixDQUFDLFdBQVcsS0FBSyxTQUFTLEVBQUU7b0JBQ3BFLHNCQUFzQjtvQkFDdEIsSUFBQSwrQkFBZ0IsRUFDZCxNQUFNLEVBQ04saUJBQWlCLEVBQ2pCLE9BQU8sQ0FBQyxhQUFhLEVBQ3JCLE1BQU0sRUFDTjt3QkFDRSxJQUFJLENBQUMsT0FBTzs0QkFDVixJQUFBLGdDQUFVLEVBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO3dCQUNuQyxDQUFDO3dCQUNELEtBQUssQ0FBQyxPQUFPOzRCQUNYLElBQUEsOEJBQVEsRUFBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7d0JBQ2pDLENBQUM7cUJBQ0YsRUFDRCxTQUFTLEVBQ1QsY0FBYyxDQUFDLHdCQUF3QixDQUN4QyxDQUFDO29CQUVGLGlCQUFpQixDQUFDLFdBQVcsR0FBRyxNQUFBLGlCQUFpQixDQUFDLFdBQVcsbUNBQUksRUFBRSxDQUFDO2lCQUNyRTtnQkFFRCxXQUFXLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLEdBQUcsRUFBRTtvQkFDeEQsc0VBQXNFO29CQUN0RSxpQkFBaUIsQ0FBQyxXQUFXLEdBQUcsU0FBUyxDQUFDO2dCQUM1QyxDQUFDLENBQUMsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztLQUNGLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxrQkFBZSxJQUFBLHlCQUFhLEVBQWtELG1CQUFtQixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIGNyZWF0ZUJ1aWxkZXIsIHRhcmdldEZyb21UYXJnZXRTdHJpbmcgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7XG4gIERldlNlcnZlckJ1aWxkT3V0cHV0LFxuICBXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrLFxuICBydW5XZWJwYWNrRGV2U2VydmVyLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyBqc29uLCB0YWdzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgc3dpdGNoTWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0ICogYXMgdXJsIGZyb20gJ3VybCc7XG5pbXBvcnQgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB3ZWJwYWNrRGV2U2VydmVyIGZyb20gJ3dlYnBhY2stZGV2LXNlcnZlcic7XG5pbXBvcnQgeyBFeGVjdXRpb25UcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHsgbm9ybWFsaXplT3B0aW1pemF0aW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgY2hlY2tQb3J0IH0gZnJvbSAnLi4vLi4vdXRpbHMvY2hlY2stcG9ydCc7XG5pbXBvcnQgeyBjb2xvcnMgfSBmcm9tICcuLi8uLi91dGlscy9jb2xvcic7XG5pbXBvcnQgeyBJMThuT3B0aW9ucywgbG9hZFRyYW5zbGF0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2kxOG4tb3B0aW9ucyc7XG5pbXBvcnQgeyBJbmRleEh0bWxUcmFuc2Zvcm0gfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2luZGV4LWh0bWwtZ2VuZXJhdG9yJztcbmltcG9ydCB7IGNyZWF0ZVRyYW5zbGF0aW9uTG9hZGVyIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC10cmFuc2xhdGlvbnMnO1xuaW1wb3J0IHsgTm9ybWFsaXplZENhY2hlZE9wdGlvbnMsIG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL25vcm1hbGl6ZS1jYWNoZSc7XG5pbXBvcnQgeyBnZW5lcmF0ZUVudHJ5UG9pbnRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGFja2FnZS1jaHVuay1zb3J0JztcbmltcG9ydCB7IHB1cmdlU3RhbGVCdWlsZENhY2hlIH0gZnJvbSAnLi4vLi4vdXRpbHMvcHVyZ2UtY2FjaGUnO1xuaW1wb3J0IHsgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvdmVyc2lvbic7XG5pbXBvcnQge1xuICBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0LFxuICBnZXRJbmRleElucHV0RmlsZSxcbiAgZ2V0SW5kZXhPdXRwdXRGaWxlLFxufSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IGFkZEVycm9yLCBhZGRXYXJuaW5nIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1kaWFnbm9zdGljcyc7XG5pbXBvcnQge1xuICBnZXRBbmFseXRpY3NDb25maWcsXG4gIGdldENvbW1vbkNvbmZpZyxcbiAgZ2V0RGV2U2VydmVyQ29uZmlnLFxuICBnZXRTdHlsZXNDb25maWcsXG59IGZyb20gJy4uLy4uL3dlYnBhY2svY29uZmlncyc7XG5pbXBvcnQgeyBJbmRleEh0bWxXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vd2VicGFjay9wbHVnaW5zL2luZGV4LWh0bWwtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgU2VydmljZVdvcmtlclBsdWdpbiB9IGZyb20gJy4uLy4uL3dlYnBhY2svcGx1Z2lucy9zZXJ2aWNlLXdvcmtlci1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlV2VicGFja0xvZ2dpbmdDYWxsYmFjayB9IGZyb20gJy4uLy4uL3dlYnBhY2svdXRpbHMvc3RhdHMnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyU2NoZW1hLCBPdXRwdXRIYXNoaW5nIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5leHBvcnQgdHlwZSBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyA9IFNjaGVtYTtcblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIHR5cGUgaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCB0eXBlIERldlNlcnZlckJ1aWxkZXJPdXRwdXQgPSBEZXZTZXJ2ZXJCdWlsZE91dHB1dCAmIHtcbiAgYmFzZVVybDogc3RyaW5nO1xufTtcblxuLyoqXG4gKiBSZXVzYWJsZSBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgQW5ndWxhciBXZWJwYWNrIGRldmVsb3BtZW50IHNlcnZlciBidWlsZGVyLlxuICogQHBhcmFtIG9wdGlvbnMgRGV2IFNlcnZlciBvcHRpb25zLlxuICogQHBhcmFtIGNvbnRleHQgVGhlIGJ1aWxkIGNvbnRleHQuXG4gKiBAcGFyYW0gdHJhbnNmb3JtcyBBIG1hcCBvZiB0cmFuc2Zvcm1zIHRoYXQgY2FuIGJlIHVzZWQgdG8gaG9vayBpbnRvIHNvbWUgbG9naWMgKHN1Y2ggYXNcbiAqICAgICB0cmFuc2Zvcm1pbmcgd2VicGFjayBjb25maWd1cmF0aW9uIGJlZm9yZSBwYXNzaW5nIGl0IHRvIHdlYnBhY2spLlxuICpcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gc2VydmVXZWJwYWNrQnJvd3NlcihcbiAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zOiB7XG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb24/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+O1xuICAgIGxvZ2dpbmc/OiBXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrO1xuICAgIGluZGV4SHRtbD86IEluZGV4SHRtbFRyYW5zZm9ybTtcbiAgfSA9IHt9LFxuKTogT2JzZXJ2YWJsZTxEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0PiB7XG4gIC8vIENoZWNrIEFuZ3VsYXIgdmVyc2lvbi5cbiAgY29uc3QgeyBsb2dnZXIsIHdvcmtzcGFjZVJvb3QgfSA9IGNvbnRleHQ7XG4gIGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbih3b3Jrc3BhY2VSb290KTtcblxuICBjb25zdCBicm93c2VyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLmJyb3dzZXJUYXJnZXQpO1xuXG4gIGFzeW5jIGZ1bmN0aW9uIHNldHVwKCk6IFByb21pc2U8e1xuICAgIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYTtcbiAgICB3ZWJwYWNrQ29uZmlnOiB3ZWJwYWNrLkNvbmZpZ3VyYXRpb247XG4gICAgcHJvamVjdFJvb3Q6IHN0cmluZztcbiAgfT4ge1xuICAgIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQ/LnByb2plY3Q7XG4gICAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldC4nKTtcbiAgICB9XG5cbiAgICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgICBhd2FpdCBwdXJnZVN0YWxlQnVpbGRDYWNoZShjb250ZXh0KTtcblxuICAgIG9wdGlvbnMucG9ydCA9IGF3YWl0IGNoZWNrUG9ydChvcHRpb25zLnBvcnQgPz8gNDIwMCwgb3B0aW9ucy5ob3N0IHx8ICdsb2NhbGhvc3QnKTtcblxuICAgIGlmIChvcHRpb25zLmhtcikge1xuICAgICAgbG9nZ2VyLndhcm4odGFncy5zdHJpcEluZGVudHNgTk9USUNFOiBIb3QgTW9kdWxlIFJlcGxhY2VtZW50IChITVIpIGlzIGVuYWJsZWQgZm9yIHRoZSBkZXYgc2VydmVyLlxuICAgICAgU2VlIGh0dHBzOi8vd2VicGFjay5qcy5vcmcvZ3VpZGVzL2hvdC1tb2R1bGUtcmVwbGFjZW1lbnQgZm9yIGluZm9ybWF0aW9uIG9uIHdvcmtpbmcgd2l0aCBITVIgZm9yIFdlYnBhY2suYCk7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgIW9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjayAmJlxuICAgICAgb3B0aW9ucy5ob3N0ICYmXG4gICAgICAhL14xMjdcXC5cXGQrXFwuXFxkK1xcLlxcZCsvZy50ZXN0KG9wdGlvbnMuaG9zdCkgJiZcbiAgICAgIG9wdGlvbnMuaG9zdCAhPT0gJ2xvY2FsaG9zdCdcbiAgICApIHtcbiAgICAgIGxvZ2dlci53YXJuKHRhZ3Muc3RyaXBJbmRlbnRgXG4gICAgICAgIFdhcm5pbmc6IFRoaXMgaXMgYSBzaW1wbGUgc2VydmVyIGZvciB1c2UgaW4gdGVzdGluZyBvciBkZWJ1Z2dpbmcgQW5ndWxhciBhcHBsaWNhdGlvbnNcbiAgICAgICAgbG9jYWxseS4gSXQgaGFzbid0IGJlZW4gcmV2aWV3ZWQgZm9yIHNlY3VyaXR5IGlzc3Vlcy5cblxuICAgICAgICBCaW5kaW5nIHRoaXMgc2VydmVyIHRvIGFuIG9wZW4gY29ubmVjdGlvbiBjYW4gcmVzdWx0IGluIGNvbXByb21pc2luZyB5b3VyIGFwcGxpY2F0aW9uIG9yXG4gICAgICAgIGNvbXB1dGVyLiBVc2luZyBhIGRpZmZlcmVudCBob3N0IHRoYW4gdGhlIG9uZSBwYXNzZWQgdG8gdGhlIFwiLS1ob3N0XCIgZmxhZyBtaWdodCByZXN1bHQgaW5cbiAgICAgICAgd2Vic29ja2V0IGNvbm5lY3Rpb24gaXNzdWVzLiBZb3UgbWlnaHQgbmVlZCB0byB1c2UgXCItLWRpc2FibGUtaG9zdC1jaGVja1wiIGlmIHRoYXQncyB0aGVcbiAgICAgICAgY2FzZS5cbiAgICAgIGApO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLmRpc2FibGVIb3N0Q2hlY2spIHtcbiAgICAgIGxvZ2dlci53YXJuKHRhZ3Mub25lTGluZWBcbiAgICAgICAgV2FybmluZzogUnVubmluZyBhIHNlcnZlciB3aXRoIC0tZGlzYWJsZS1ob3N0LWNoZWNrIGlzIGEgc2VjdXJpdHkgcmlzay5cbiAgICAgICAgU2VlIGh0dHBzOi8vbWVkaXVtLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LXNlcnZlci1taWRkbGV3YXJlLXNlY3VyaXR5LWlzc3Vlcy0xNDg5ZDk1MDg3NGFcbiAgICAgICAgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gICAgICBgKTtcbiAgICB9XG4gICAgLy8gR2V0IHRoZSBicm93c2VyIGNvbmZpZ3VyYXRpb24gZnJvbSB0aGUgdGFyZ2V0IG5hbWUuXG4gICAgY29uc3QgcmF3QnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC5nZXRUYXJnZXRPcHRpb25zKGJyb3dzZXJUYXJnZXQpKSBhcyBqc29uLkpzb25PYmplY3QgJlxuICAgICAgQnJvd3NlckJ1aWxkZXJTY2hlbWE7XG5cbiAgICBpZiAocmF3QnJvd3Nlck9wdGlvbnMub3V0cHV0SGFzaGluZyAmJiByYXdCcm93c2VyT3B0aW9ucy5vdXRwdXRIYXNoaW5nICE9PSBPdXRwdXRIYXNoaW5nLk5vbmUpIHtcbiAgICAgIC8vIERpc2FibGUgb3V0cHV0IGhhc2hpbmcgZm9yIGRldiBidWlsZCBhcyB0aGlzIGNhbiBjYXVzZSBtZW1vcnkgbGVha3NcbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay1kZXYtc2VydmVyL2lzc3Vlcy8zNzcjaXNzdWVjb21tZW50LTI0MTI1ODQwNVxuICAgICAgcmF3QnJvd3Nlck9wdGlvbnMub3V0cHV0SGFzaGluZyA9IE91dHB1dEhhc2hpbmcuTm9uZTtcbiAgICAgIGxvZ2dlci53YXJuKGBXYXJuaW5nOiAnb3V0cHV0SGFzaGluZycgb3B0aW9uIGlzIGRpc2FibGVkIHdoZW4gdXNpbmcgdGhlIGRldi1zZXJ2ZXIuYCk7XG4gICAgfVxuXG4gICAgY29uc3QgbWV0YWRhdGEgPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gICAgY29uc3QgY2FjaGVPcHRpb25zID0gbm9ybWFsaXplQ2FjaGVPcHRpb25zKG1ldGFkYXRhLCBjb250ZXh0LndvcmtzcGFjZVJvb3QpO1xuXG4gICAgY29uc3QgYnJvd3Nlck5hbWUgPSBhd2FpdCBjb250ZXh0LmdldEJ1aWxkZXJOYW1lRm9yVGFyZ2V0KGJyb3dzZXJUYXJnZXQpO1xuICAgIGNvbnN0IGJyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQudmFsaWRhdGVPcHRpb25zKFxuICAgICAge1xuICAgICAgICAuLi5yYXdCcm93c2VyT3B0aW9ucyxcbiAgICAgICAgd2F0Y2g6IG9wdGlvbnMud2F0Y2gsXG4gICAgICAgIHZlcmJvc2U6IG9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgLy8gSW4gZGV2IHNlcnZlciB3ZSBzaG91bGQgbm90IGhhdmUgYnVkZ2V0cyBiZWNhdXNlIG9mIGV4dHJhIGxpYnMgc3VjaCBhcyBzb2Nrcy1qc1xuICAgICAgICBidWRnZXRzOiB1bmRlZmluZWQsXG4gICAgICB9IGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICAgICAgYnJvd3Nlck5hbWUsXG4gICAgKSkgYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJTY2hlbWE7XG5cbiAgICBjb25zdCB7IHN0eWxlcywgc2NyaXB0cyB9ID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbik7XG4gICAgaWYgKHNjcmlwdHMgfHwgc3R5bGVzLm1pbmlmeSkge1xuICAgICAgbG9nZ2VyLmVycm9yKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgIFRoaXMgaXMgYSBzaW1wbGUgc2VydmVyIGZvciB1c2UgaW4gdGVzdGluZyBvciBkZWJ1Z2dpbmcgQW5ndWxhciBhcHBsaWNhdGlvbnMgbG9jYWxseS5cbiAgICAgICAgSXQgaGFzbid0IGJlZW4gcmV2aWV3ZWQgZm9yIHNlY3VyaXR5IGlzc3Vlcy5cblxuICAgICAgICBET04nVCBVU0UgSVQgRk9SIFBST0RVQ1RJT04hXG4gICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgIGApO1xuICAgIH1cblxuICAgIGNvbnN0IHsgY29uZmlnLCBwcm9qZWN0Um9vdCwgaTE4biB9ID0gYXdhaXQgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChcbiAgICAgIGJyb3dzZXJPcHRpb25zLFxuICAgICAgY29udGV4dCxcbiAgICAgICh3Y28pID0+IFtcbiAgICAgICAgZ2V0RGV2U2VydmVyQ29uZmlnKHdjbyksXG4gICAgICAgIGdldENvbW1vbkNvbmZpZyh3Y28pLFxuICAgICAgICBnZXRTdHlsZXNDb25maWcod2NvKSxcbiAgICAgICAgZ2V0QW5hbHl0aWNzQ29uZmlnKHdjbywgY29udGV4dCksXG4gICAgICBdLFxuICAgICAgb3B0aW9ucyxcbiAgICApO1xuXG4gICAgaWYgKCFjb25maWcuZGV2U2VydmVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYnBhY2sgRGV2IFNlcnZlciBjb25maWd1cmF0aW9uIHdhcyBub3Qgc2V0LicpO1xuICAgIH1cblxuICAgIGxldCBsb2NhbGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBpZiAoaTE4bi5zaG91bGRJbmxpbmUpIHtcbiAgICAgIC8vIERldi1zZXJ2ZXIgb25seSBzdXBwb3J0cyBvbmUgbG9jYWxlXG4gICAgICBsb2NhbGUgPSBbLi4uaTE4bi5pbmxpbmVMb2NhbGVzXVswXTtcbiAgICB9IGVsc2UgaWYgKGkxOG4uaGFzRGVmaW5lZFNvdXJjZUxvY2FsZSkge1xuICAgICAgLy8gdXNlIHNvdXJjZSBsb2NhbGUgaWYgbm90IGxvY2FsaXppbmdcbiAgICAgIGxvY2FsZSA9IGkxOG4uc291cmNlTG9jYWxlO1xuICAgIH1cblxuICAgIGxldCB3ZWJwYWNrQ29uZmlnID0gY29uZmlnO1xuXG4gICAgLy8gSWYgYSBsb2NhbGUgaXMgZGVmaW5lZCwgc2V0dXAgbG9jYWxpemF0aW9uXG4gICAgaWYgKGxvY2FsZSkge1xuICAgICAgaWYgKGkxOG4uaW5saW5lTG9jYWxlcy5zaXplID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ1RoZSBkZXZlbG9wbWVudCBzZXJ2ZXIgb25seSBzdXBwb3J0cyBsb2NhbGl6aW5nIGEgc2luZ2xlIGxvY2FsZSBwZXIgYnVpbGQuJyxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgc2V0dXBMb2NhbGl6ZShsb2NhbGUsIGkxOG4sIGJyb3dzZXJPcHRpb25zLCB3ZWJwYWNrQ29uZmlnLCBjYWNoZU9wdGlvbnMsIGNvbnRleHQpO1xuICAgIH1cblxuICAgIGlmICh0cmFuc2Zvcm1zLndlYnBhY2tDb25maWd1cmF0aW9uKSB7XG4gICAgICB3ZWJwYWNrQ29uZmlnID0gYXdhaXQgdHJhbnNmb3Jtcy53ZWJwYWNrQ29uZmlndXJhdGlvbih3ZWJwYWNrQ29uZmlnKTtcbiAgICB9XG5cbiAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMgPz89IFtdO1xuXG4gICAgaWYgKGJyb3dzZXJPcHRpb25zLmluZGV4KSB7XG4gICAgICBjb25zdCB7IHNjcmlwdHMgPSBbXSwgc3R5bGVzID0gW10sIGJhc2VIcmVmIH0gPSBicm93c2VyT3B0aW9ucztcbiAgICAgIGNvbnN0IGVudHJ5cG9pbnRzID0gZ2VuZXJhdGVFbnRyeVBvaW50cyh7XG4gICAgICAgIHNjcmlwdHMsXG4gICAgICAgIHN0eWxlcyxcbiAgICAgICAgLy8gVGhlIGJlbG93IGlzIG5lZWRlZCBhcyBvdGhlcndpc2UgSE1SIGZvciBDU1Mgd2lsbCBicmVhay5cbiAgICAgICAgLy8gc3R5bGVzLmpzIGFuZCBydW50aW1lLmpzIG5lZWRzIHRvIGJlIGxvYWRlZCBhcyBhIG5vbi1tb2R1bGUgc2NyaXB0cyBhcyBvdGhlcndpc2UgYGRvY3VtZW50LmN1cnJlbnRTY3JpcHRgIHdpbGwgYmUgbnVsbC5cbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9taW5pLWNzcy1leHRyYWN0LXBsdWdpbi9ibG9iLzkwNDQ1ZGQxZDgxZGEwYzEwYjliMGU4YTE3YjQxN2QwNjUxODE2Yjgvc3JjL2htci9ob3RNb2R1bGVSZXBsYWNlbWVudC5qcyNMMzlcbiAgICAgICAgaXNITVJFbmFibGVkOiAhIXdlYnBhY2tDb25maWcuZGV2U2VydmVyPy5ob3QsXG4gICAgICB9KTtcblxuICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnB1c2goXG4gICAgICAgIG5ldyBJbmRleEh0bWxXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgICBpbmRleFBhdGg6IHBhdGgucmVzb2x2ZSh3b3Jrc3BhY2VSb290LCBnZXRJbmRleElucHV0RmlsZShicm93c2VyT3B0aW9ucy5pbmRleCkpLFxuICAgICAgICAgIG91dHB1dFBhdGg6IGdldEluZGV4T3V0cHV0RmlsZShicm93c2VyT3B0aW9ucy5pbmRleCksXG4gICAgICAgICAgYmFzZUhyZWYsXG4gICAgICAgICAgZW50cnlwb2ludHMsXG4gICAgICAgICAgZGVwbG95VXJsOiBicm93c2VyT3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgICAgICAgc3JpOiBicm93c2VyT3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSxcbiAgICAgICAgICBjYWNoZTogY2FjaGVPcHRpb25zLFxuICAgICAgICAgIHBvc3RUcmFuc2Zvcm06IHRyYW5zZm9ybXMuaW5kZXhIdG1sLFxuICAgICAgICAgIG9wdGltaXphdGlvbjogbm9ybWFsaXplT3B0aW1pemF0aW9uKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbiksXG4gICAgICAgICAgY3Jvc3NPcmlnaW46IGJyb3dzZXJPcHRpb25zLmNyb3NzT3JpZ2luLFxuICAgICAgICAgIGxhbmc6IGxvY2FsZSxcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH1cblxuICAgIGlmIChicm93c2VyT3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMucHVzaChcbiAgICAgICAgbmV3IFNlcnZpY2VXb3JrZXJQbHVnaW4oe1xuICAgICAgICAgIGJhc2VIcmVmOiBicm93c2VyT3B0aW9ucy5iYXNlSHJlZixcbiAgICAgICAgICByb290OiBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgcHJvamVjdFJvb3QsXG4gICAgICAgICAgb3V0cHV0UGF0aDogcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgYnJvd3Nlck9wdGlvbnMub3V0cHV0UGF0aCksXG4gICAgICAgICAgbmdzd0NvbmZpZ1BhdGg6IGJyb3dzZXJPcHRpb25zLm5nc3dDb25maWdQYXRoLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGJyb3dzZXJPcHRpb25zLFxuICAgICAgd2VicGFja0NvbmZpZyxcbiAgICAgIHByb2plY3RSb290LFxuICAgIH07XG4gIH1cblxuICByZXR1cm4gZnJvbShzZXR1cCgpKS5waXBlKFxuICAgIHN3aXRjaE1hcCgoeyBicm93c2VyT3B0aW9ucywgd2VicGFja0NvbmZpZyB9KSA9PiB7XG4gICAgICByZXR1cm4gcnVuV2VicGFja0RldlNlcnZlcih3ZWJwYWNrQ29uZmlnLCBjb250ZXh0LCB7XG4gICAgICAgIGxvZ2dpbmc6IHRyYW5zZm9ybXMubG9nZ2luZyB8fCBjcmVhdGVXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrKGJyb3dzZXJPcHRpb25zLCBsb2dnZXIpLFxuICAgICAgICB3ZWJwYWNrRmFjdG9yeTogcmVxdWlyZSgnd2VicGFjaycpIGFzIHR5cGVvZiB3ZWJwYWNrLFxuICAgICAgICB3ZWJwYWNrRGV2U2VydmVyRmFjdG9yeTogcmVxdWlyZSgnd2VicGFjay1kZXYtc2VydmVyJykgYXMgdHlwZW9mIHdlYnBhY2tEZXZTZXJ2ZXIsXG4gICAgICB9KS5waXBlKFxuICAgICAgICBjb25jYXRNYXAoYXN5bmMgKGJ1aWxkRXZlbnQsIGluZGV4KSA9PiB7XG4gICAgICAgICAgLy8gUmVzb2x2ZSBzZXJ2ZSBhZGRyZXNzLlxuICAgICAgICAgIGNvbnN0IHB1YmxpY1BhdGggPSB3ZWJwYWNrQ29uZmlnLmRldlNlcnZlcj8uZGV2TWlkZGxld2FyZT8ucHVibGljUGF0aDtcblxuICAgICAgICAgIGNvbnN0IHNlcnZlckFkZHJlc3MgPSB1cmwuZm9ybWF0KHtcbiAgICAgICAgICAgIHByb3RvY29sOiBvcHRpb25zLnNzbCA/ICdodHRwcycgOiAnaHR0cCcsXG4gICAgICAgICAgICBob3N0bmFtZTogb3B0aW9ucy5ob3N0ID09PSAnMC4wLjAuMCcgPyAnbG9jYWxob3N0JyA6IG9wdGlvbnMuaG9zdCxcbiAgICAgICAgICAgIHBvcnQ6IGJ1aWxkRXZlbnQucG9ydCxcbiAgICAgICAgICAgIHBhdGhuYW1lOiB0eXBlb2YgcHVibGljUGF0aCA9PT0gJ3N0cmluZycgPyBwdWJsaWNQYXRoIDogdW5kZWZpbmVkLFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgaWYgKGluZGV4ID09PSAwKSB7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhcbiAgICAgICAgICAgICAgJ1xcbicgK1xuICAgICAgICAgICAgICAgIHRhZ3Mub25lTGluZWBcbiAgICAgICAgICAgICAgKipcbiAgICAgICAgICAgICAgQW5ndWxhciBMaXZlIERldmVsb3BtZW50IFNlcnZlciBpcyBsaXN0ZW5pbmcgb24gJHtvcHRpb25zLmhvc3R9OiR7YnVpbGRFdmVudC5wb3J0fSxcbiAgICAgICAgICAgICAgb3BlbiB5b3VyIGJyb3dzZXIgb24gJHtzZXJ2ZXJBZGRyZXNzfVxuICAgICAgICAgICAgICAqKlxuICAgICAgICAgICAgYCArXG4gICAgICAgICAgICAgICAgJ1xcbicsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5vcGVuKSB7XG4gICAgICAgICAgICAgIGNvbnN0IG9wZW4gPSAoYXdhaXQgaW1wb3J0KCdvcGVuJykpLmRlZmF1bHQ7XG4gICAgICAgICAgICAgIGF3YWl0IG9wZW4oc2VydmVyQWRkcmVzcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGJ1aWxkRXZlbnQuc3VjY2Vzcykge1xuICAgICAgICAgICAgbG9nZ2VyLmluZm8oYFxcbiR7Y29sb3JzLmdyZWVuQnJpZ2h0KGNvbG9ycy5zeW1ib2xzLmNoZWNrKX0gQ29tcGlsZWQgc3VjY2Vzc2Z1bGx5LmApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhgXFxuJHtjb2xvcnMucmVkQnJpZ2h0KGNvbG9ycy5zeW1ib2xzLmNyb3NzKX0gRmFpbGVkIHRvIGNvbXBpbGUuYCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHsgLi4uYnVpbGRFdmVudCwgYmFzZVVybDogc2VydmVyQWRkcmVzcyB9IGFzIERldlNlcnZlckJ1aWxkZXJPdXRwdXQ7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9KSxcbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2V0dXBMb2NhbGl6ZShcbiAgbG9jYWxlOiBzdHJpbmcsXG4gIGkxOG46IEkxOG5PcHRpb25zLFxuICBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIHdlYnBhY2tDb25maWc6IHdlYnBhY2suQ29uZmlndXJhdGlvbixcbiAgY2FjaGVPcHRpb25zOiBOb3JtYWxpemVkQ2FjaGVkT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pIHtcbiAgY29uc3QgbG9jYWxlRGVzY3JpcHRpb24gPSBpMThuLmxvY2FsZXNbbG9jYWxlXTtcblxuICAvLyBNb2RpZnkgbWFpbiBlbnRyeXBvaW50IHRvIGluY2x1ZGUgbG9jYWxlIGRhdGFcbiAgaWYgKFxuICAgIGxvY2FsZURlc2NyaXB0aW9uPy5kYXRhUGF0aCAmJlxuICAgIHR5cGVvZiB3ZWJwYWNrQ29uZmlnLmVudHJ5ID09PSAnb2JqZWN0JyAmJlxuICAgICFBcnJheS5pc0FycmF5KHdlYnBhY2tDb25maWcuZW50cnkpICYmXG4gICAgd2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddXG4gICkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXSkpIHtcbiAgICAgIHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXS51bnNoaWZ0KGxvY2FsZURlc2NyaXB0aW9uLmRhdGFQYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddID0gW1xuICAgICAgICBsb2NhbGVEZXNjcmlwdGlvbi5kYXRhUGF0aCxcbiAgICAgICAgd2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddIGFzIHN0cmluZyxcbiAgICAgIF07XG4gICAgfVxuICB9XG5cbiAgbGV0IG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yID0gYnJvd3Nlck9wdGlvbnMuaTE4bk1pc3NpbmdUcmFuc2xhdGlvbiB8fCAnaWdub3JlJztcbiAgbGV0IHRyYW5zbGF0aW9uID0gbG9jYWxlRGVzY3JpcHRpb24/LnRyYW5zbGF0aW9uIHx8IHt9O1xuXG4gIGlmIChsb2NhbGUgPT09IGkxOG4uc291cmNlTG9jYWxlKSB7XG4gICAgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IgPSAnaWdub3JlJztcbiAgICB0cmFuc2xhdGlvbiA9IHt9O1xuICB9XG5cbiAgY29uc3QgaTE4bkxvYWRlck9wdGlvbnMgPSB7XG4gICAgbG9jYWxlLFxuICAgIG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yLFxuICAgIHRyYW5zbGF0aW9uOiBpMThuLnNob3VsZElubGluZSA/IHRyYW5zbGF0aW9uIDogdW5kZWZpbmVkLFxuICAgIHRyYW5zbGF0aW9uRmlsZXM6IGxvY2FsZURlc2NyaXB0aW9uPy5maWxlcy5tYXAoKGZpbGUpID0+XG4gICAgICBwYXRoLnJlc29sdmUoY29udGV4dC53b3Jrc3BhY2VSb290LCBmaWxlLnBhdGgpLFxuICAgICksXG4gIH07XG5cbiAgY29uc3QgaTE4blJ1bGU6IHdlYnBhY2suUnVsZVNldFJ1bGUgPSB7XG4gICAgdGVzdDogL1xcLltjbV0/W3RqXXN4PyQvLFxuICAgIGVuZm9yY2U6ICdwb3N0JyxcbiAgICB1c2U6IFtcbiAgICAgIHtcbiAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJy4uLy4uL2JhYmVsL3dlYnBhY2stbG9hZGVyJyksXG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICBjYWNoZURpcmVjdG9yeTpcbiAgICAgICAgICAgIChjYWNoZU9wdGlvbnMuZW5hYmxlZCAmJiBwYXRoLmpvaW4oY2FjaGVPcHRpb25zLnBhdGgsICdiYWJlbC1kZXYtc2VydmVyLWkxOG4nKSkgfHxcbiAgICAgICAgICAgIGZhbHNlLFxuICAgICAgICAgIGNhY2hlSWRlbnRpZmllcjogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgbG9jYWxlLFxuICAgICAgICAgICAgdHJhbnNsYXRpb25JbnRlZ3JpdHk6IGxvY2FsZURlc2NyaXB0aW9uPy5maWxlcy5tYXAoKGZpbGUpID0+IGZpbGUuaW50ZWdyaXR5KSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBpMThuOiBpMThuTG9hZGVyT3B0aW9ucyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfTtcblxuICAvLyBHZXQgdGhlIHJ1bGVzIGFuZCBlbnN1cmUgdGhlIFdlYnBhY2sgY29uZmlndXJhdGlvbiBpcyBzZXR1cCBwcm9wZXJseVxuICBjb25zdCBydWxlcyA9IHdlYnBhY2tDb25maWcubW9kdWxlPy5ydWxlcyB8fCBbXTtcbiAgaWYgKCF3ZWJwYWNrQ29uZmlnLm1vZHVsZSkge1xuICAgIHdlYnBhY2tDb25maWcubW9kdWxlID0geyBydWxlcyB9O1xuICB9IGVsc2UgaWYgKCF3ZWJwYWNrQ29uZmlnLm1vZHVsZS5ydWxlcykge1xuICAgIHdlYnBhY2tDb25maWcubW9kdWxlLnJ1bGVzID0gcnVsZXM7XG4gIH1cblxuICBydWxlcy5wdXNoKGkxOG5SdWxlKTtcblxuICAvLyBBZGQgYSBwbHVnaW4gdG8gcmVsb2FkIHRyYW5zbGF0aW9uIGZpbGVzIG9uIHJlYnVpbGRzXG4gIGNvbnN0IGxvYWRlciA9IGF3YWl0IGNyZWF0ZVRyYW5zbGF0aW9uTG9hZGVyKCk7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gIHdlYnBhY2tDb25maWcucGx1Z2lucyEucHVzaCh7XG4gICAgYXBwbHk6IChjb21waWxlcjogd2VicGFjay5Db21waWxlcikgPT4ge1xuICAgICAgY29tcGlsZXIuaG9va3MudGhpc0NvbXBpbGF0aW9uLnRhcCgnYnVpbGQtYW5ndWxhcicsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgICBpZiAoaTE4bi5zaG91bGRJbmxpbmUgJiYgaTE4bkxvYWRlck9wdGlvbnMudHJhbnNsYXRpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIFJlbG9hZCB0cmFuc2xhdGlvbnNcbiAgICAgICAgICBsb2FkVHJhbnNsYXRpb25zKFxuICAgICAgICAgICAgbG9jYWxlLFxuICAgICAgICAgICAgbG9jYWxlRGVzY3JpcHRpb24sXG4gICAgICAgICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICBsb2FkZXIsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHdhcm4obWVzc2FnZSkge1xuICAgICAgICAgICAgICAgIGFkZFdhcm5pbmcoY29tcGlsYXRpb24sIG1lc3NhZ2UpO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBlcnJvcihtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgYWRkRXJyb3IoY29tcGlsYXRpb24sIG1lc3NhZ2UpO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGJyb3dzZXJPcHRpb25zLmkxOG5EdXBsaWNhdGVUcmFuc2xhdGlvbixcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgaTE4bkxvYWRlck9wdGlvbnMudHJhbnNsYXRpb24gPSBsb2NhbGVEZXNjcmlwdGlvbi50cmFuc2xhdGlvbiA/PyB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbXBpbGF0aW9uLmhvb2tzLmZpbmlzaE1vZHVsZXMudGFwKCdidWlsZC1hbmd1bGFyJywgKCkgPT4ge1xuICAgICAgICAgIC8vIEFmdGVyIGxvYWRlcnMgYXJlIGZpbmlzaGVkLCBjbGVhciBvdXQgdGhlIG5vdyB1bm5lZWRlZCB0cmFuc2xhdGlvbnNcbiAgICAgICAgICBpMThuTG9hZGVyT3B0aW9ucy50cmFuc2xhdGlvbiA9IHVuZGVmaW5lZDtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcjxEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucywgRGV2U2VydmVyQnVpbGRlck91dHB1dD4oc2VydmVXZWJwYWNrQnJvd3Nlcik7XG4iXX0=