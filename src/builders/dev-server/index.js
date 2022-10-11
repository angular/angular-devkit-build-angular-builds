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
    return (0, rxjs_1.from)(setup()).pipe((0, operators_1.switchMap)(({ browserOptions, webpackConfig }) => {
        return (0, build_webpack_1.runWebpackDevServer)(webpackConfig, context, {
            logging: transforms.logging || (0, stats_1.createWebpackLoggingCallback)(browserOptions, logger),
            webpackFactory: require('webpack'),
            webpackDevServerFactory: require('webpack-dev-server'),
        }).pipe((0, operators_1.concatMap)(async (buildEvent, index) => {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQWtHO0FBQ2xHLGlFQUl1QztBQUN2QywrQ0FBa0Q7QUFDbEQsMkNBQTZCO0FBQzdCLCtCQUF3QztBQUN4Qyw4Q0FBc0Q7QUFDdEQseUNBQTJCO0FBSTNCLHVDQUFvRDtBQUNwRCx1REFBbUQ7QUFDbkQsNkNBQTJDO0FBQzNDLDJEQUF5RTtBQUV6RSxxRUFBd0U7QUFDeEUsaUVBQTZGO0FBQzdGLHVFQUFxRTtBQUNyRSx5REFBK0Q7QUFDL0QsaURBQXFFO0FBQ3JFLCtFQUk0QztBQUM1Qyx5RUFBdUU7QUFDdkUsbURBQTZGO0FBQzdGLCtGQUF5RjtBQUN6Rix1RkFBa0Y7QUFDbEYscURBSW1DO0FBQ25DLDhDQUFrRjtBQWFsRjs7Ozs7Ozs7R0FRRztBQUNILGtEQUFrRDtBQUNsRCxTQUFnQixtQkFBbUIsQ0FDakMsT0FBZ0MsRUFDaEMsT0FBdUIsRUFDdkIsYUFJSSxFQUFFO0lBRU4seUJBQXlCO0lBQ3pCLE1BQU0sRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLEdBQUcsT0FBTyxDQUFDO0lBQzFDLElBQUEsd0NBQThCLEVBQUMsYUFBYSxDQUFDLENBQUM7SUFFOUMsTUFBTSxhQUFhLEdBQUcsSUFBQSxrQ0FBc0IsRUFBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7SUFFcEUsS0FBSyxVQUFVLEtBQUs7O1FBS2xCLE1BQU0sV0FBVyxHQUFHLE1BQUEsT0FBTyxDQUFDLE1BQU0sMENBQUUsT0FBTyxDQUFDO1FBQzVDLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDaEIsTUFBTSxJQUFJLEtBQUss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IEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgY3JlYXRlQnVpbGRlciwgdGFyZ2V0RnJvbVRhcmdldFN0cmluZyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHtcbiAgRGV2U2VydmVyQnVpbGRPdXRwdXQsXG4gIFdlYnBhY2tMb2dnaW5nQ2FsbGJhY2ssXG4gIHJ1bldlYnBhY2tEZXZTZXJ2ZXIsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJztcbmltcG9ydCB7IGpzb24sIHRhZ3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcbmltcG9ydCB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHdlYnBhY2tEZXZTZXJ2ZXIgZnJvbSAnd2VicGFjay1kZXYtc2VydmVyJztcbmltcG9ydCB7IEV4ZWN1dGlvblRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vdHJhbnNmb3Jtcyc7XG5pbXBvcnQgeyBub3JtYWxpemVPcHRpbWl6YXRpb24gfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBjaGVja1BvcnQgfSBmcm9tICcuLi8uLi91dGlscy9jaGVjay1wb3J0JztcbmltcG9ydCB7IGNvbG9ycyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvbG9yJztcbmltcG9ydCB7IEkxOG5PcHRpb25zLCBsb2FkVHJhbnNsYXRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IEluZGV4SHRtbFRyYW5zZm9ybSB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgY3JlYXRlVHJhbnNsYXRpb25Mb2FkZXIgfSBmcm9tICcuLi8uLi91dGlscy9sb2FkLXRyYW5zbGF0aW9ucyc7XG5pbXBvcnQgeyBOb3JtYWxpemVkQ2FjaGVkT3B0aW9ucywgbm9ybWFsaXplQ2FjaGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvbm9ybWFsaXplLWNhY2hlJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMgfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUgfSBmcm9tICcuLi8uLi91dGlscy9wdXJnZS1jYWNoZSc7XG5pbXBvcnQgeyBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24gfSBmcm9tICcuLi8uLi91dGlscy92ZXJzaW9uJztcbmltcG9ydCB7XG4gIGdlbmVyYXRlSTE4bkJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQsXG4gIGdldEluZGV4SW5wdXRGaWxlLFxuICBnZXRJbmRleE91dHB1dEZpbGUsXG59IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgYWRkRXJyb3IsIGFkZFdhcm5pbmcgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWRpYWdub3N0aWNzJztcbmltcG9ydCB7IGdldENvbW1vbkNvbmZpZywgZ2V0RGV2U2VydmVyQ29uZmlnLCBnZXRTdHlsZXNDb25maWcgfSBmcm9tICcuLi8uLi93ZWJwYWNrL2NvbmZpZ3MnO1xuaW1wb3J0IHsgSW5kZXhIdG1sV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3dlYnBhY2svcGx1Z2lucy9pbmRleC1odG1sLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IFNlcnZpY2VXb3JrZXJQbHVnaW4gfSBmcm9tICcuLi8uLi93ZWJwYWNrL3BsdWdpbnMvc2VydmljZS13b3JrZXItcGx1Z2luJztcbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnRTdGF0cyxcbiAgY3JlYXRlV2VicGFja0xvZ2dpbmdDYWxsYmFjayxcbiAgZ2VuZXJhdGVCdWlsZEV2ZW50U3RhdHMsXG59IGZyb20gJy4uLy4uL3dlYnBhY2svdXRpbHMvc3RhdHMnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyU2NoZW1hLCBPdXRwdXRIYXNoaW5nIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5leHBvcnQgdHlwZSBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyA9IFNjaGVtYTtcblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIHR5cGUgaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCB0eXBlIERldlNlcnZlckJ1aWxkZXJPdXRwdXQgPSBEZXZTZXJ2ZXJCdWlsZE91dHB1dCAmIHtcbiAgYmFzZVVybDogc3RyaW5nO1xuICBzdGF0czogQnVpbGRFdmVudFN0YXRzO1xufTtcblxuLyoqXG4gKiBSZXVzYWJsZSBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgQW5ndWxhciBXZWJwYWNrIGRldmVsb3BtZW50IHNlcnZlciBidWlsZGVyLlxuICogQHBhcmFtIG9wdGlvbnMgRGV2IFNlcnZlciBvcHRpb25zLlxuICogQHBhcmFtIGNvbnRleHQgVGhlIGJ1aWxkIGNvbnRleHQuXG4gKiBAcGFyYW0gdHJhbnNmb3JtcyBBIG1hcCBvZiB0cmFuc2Zvcm1zIHRoYXQgY2FuIGJlIHVzZWQgdG8gaG9vayBpbnRvIHNvbWUgbG9naWMgKHN1Y2ggYXNcbiAqICAgICB0cmFuc2Zvcm1pbmcgd2VicGFjayBjb25maWd1cmF0aW9uIGJlZm9yZSBwYXNzaW5nIGl0IHRvIHdlYnBhY2spLlxuICpcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gc2VydmVXZWJwYWNrQnJvd3NlcihcbiAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zOiB7XG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb24/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+O1xuICAgIGxvZ2dpbmc/OiBXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrO1xuICAgIGluZGV4SHRtbD86IEluZGV4SHRtbFRyYW5zZm9ybTtcbiAgfSA9IHt9LFxuKTogT2JzZXJ2YWJsZTxEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0PiB7XG4gIC8vIENoZWNrIEFuZ3VsYXIgdmVyc2lvbi5cbiAgY29uc3QgeyBsb2dnZXIsIHdvcmtzcGFjZVJvb3QgfSA9IGNvbnRleHQ7XG4gIGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbih3b3Jrc3BhY2VSb290KTtcblxuICBjb25zdCBicm93c2VyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLmJyb3dzZXJUYXJnZXQpO1xuXG4gIGFzeW5jIGZ1bmN0aW9uIHNldHVwKCk6IFByb21pc2U8e1xuICAgIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYTtcbiAgICB3ZWJwYWNrQ29uZmlnOiB3ZWJwYWNrLkNvbmZpZ3VyYXRpb247XG4gICAgcHJvamVjdFJvb3Q6IHN0cmluZztcbiAgfT4ge1xuICAgIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQ/LnByb2plY3Q7XG4gICAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldC4nKTtcbiAgICB9XG5cbiAgICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgICBhd2FpdCBwdXJnZVN0YWxlQnVpbGRDYWNoZShjb250ZXh0KTtcblxuICAgIG9wdGlvbnMucG9ydCA9IGF3YWl0IGNoZWNrUG9ydChvcHRpb25zLnBvcnQgPz8gNDIwMCwgb3B0aW9ucy5ob3N0IHx8ICdsb2NhbGhvc3QnKTtcblxuICAgIGlmIChvcHRpb25zLmhtcikge1xuICAgICAgbG9nZ2VyLndhcm4odGFncy5zdHJpcEluZGVudHNgTk9USUNFOiBIb3QgTW9kdWxlIFJlcGxhY2VtZW50IChITVIpIGlzIGVuYWJsZWQgZm9yIHRoZSBkZXYgc2VydmVyLlxuICAgICAgU2VlIGh0dHBzOi8vd2VicGFjay5qcy5vcmcvZ3VpZGVzL2hvdC1tb2R1bGUtcmVwbGFjZW1lbnQgZm9yIGluZm9ybWF0aW9uIG9uIHdvcmtpbmcgd2l0aCBITVIgZm9yIFdlYnBhY2suYCk7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgIW9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjayAmJlxuICAgICAgb3B0aW9ucy5ob3N0ICYmXG4gICAgICAhL14xMjdcXC5cXGQrXFwuXFxkK1xcLlxcZCsvZy50ZXN0KG9wdGlvbnMuaG9zdCkgJiZcbiAgICAgIG9wdGlvbnMuaG9zdCAhPT0gJ2xvY2FsaG9zdCdcbiAgICApIHtcbiAgICAgIGxvZ2dlci53YXJuKHRhZ3Muc3RyaXBJbmRlbnRgXG4gICAgICAgIFdhcm5pbmc6IFRoaXMgaXMgYSBzaW1wbGUgc2VydmVyIGZvciB1c2UgaW4gdGVzdGluZyBvciBkZWJ1Z2dpbmcgQW5ndWxhciBhcHBsaWNhdGlvbnNcbiAgICAgICAgbG9jYWxseS4gSXQgaGFzbid0IGJlZW4gcmV2aWV3ZWQgZm9yIHNlY3VyaXR5IGlzc3Vlcy5cblxuICAgICAgICBCaW5kaW5nIHRoaXMgc2VydmVyIHRvIGFuIG9wZW4gY29ubmVjdGlvbiBjYW4gcmVzdWx0IGluIGNvbXByb21pc2luZyB5b3VyIGFwcGxpY2F0aW9uIG9yXG4gICAgICAgIGNvbXB1dGVyLiBVc2luZyBhIGRpZmZlcmVudCBob3N0IHRoYW4gdGhlIG9uZSBwYXNzZWQgdG8gdGhlIFwiLS1ob3N0XCIgZmxhZyBtaWdodCByZXN1bHQgaW5cbiAgICAgICAgd2Vic29ja2V0IGNvbm5lY3Rpb24gaXNzdWVzLiBZb3UgbWlnaHQgbmVlZCB0byB1c2UgXCItLWRpc2FibGUtaG9zdC1jaGVja1wiIGlmIHRoYXQncyB0aGVcbiAgICAgICAgY2FzZS5cbiAgICAgIGApO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLmRpc2FibGVIb3N0Q2hlY2spIHtcbiAgICAgIGxvZ2dlci53YXJuKHRhZ3Mub25lTGluZWBcbiAgICAgICAgV2FybmluZzogUnVubmluZyBhIHNlcnZlciB3aXRoIC0tZGlzYWJsZS1ob3N0LWNoZWNrIGlzIGEgc2VjdXJpdHkgcmlzay5cbiAgICAgICAgU2VlIGh0dHBzOi8vbWVkaXVtLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LXNlcnZlci1taWRkbGV3YXJlLXNlY3VyaXR5LWlzc3Vlcy0xNDg5ZDk1MDg3NGFcbiAgICAgICAgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gICAgICBgKTtcbiAgICB9XG4gICAgLy8gR2V0IHRoZSBicm93c2VyIGNvbmZpZ3VyYXRpb24gZnJvbSB0aGUgdGFyZ2V0IG5hbWUuXG4gICAgY29uc3QgcmF3QnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC5nZXRUYXJnZXRPcHRpb25zKGJyb3dzZXJUYXJnZXQpKSBhcyBqc29uLkpzb25PYmplY3QgJlxuICAgICAgQnJvd3NlckJ1aWxkZXJTY2hlbWE7XG5cbiAgICBpZiAocmF3QnJvd3Nlck9wdGlvbnMub3V0cHV0SGFzaGluZyAmJiByYXdCcm93c2VyT3B0aW9ucy5vdXRwdXRIYXNoaW5nICE9PSBPdXRwdXRIYXNoaW5nLk5vbmUpIHtcbiAgICAgIC8vIERpc2FibGUgb3V0cHV0IGhhc2hpbmcgZm9yIGRldiBidWlsZCBhcyB0aGlzIGNhbiBjYXVzZSBtZW1vcnkgbGVha3NcbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay1kZXYtc2VydmVyL2lzc3Vlcy8zNzcjaXNzdWVjb21tZW50LTI0MTI1ODQwNVxuICAgICAgcmF3QnJvd3Nlck9wdGlvbnMub3V0cHV0SGFzaGluZyA9IE91dHB1dEhhc2hpbmcuTm9uZTtcbiAgICAgIGxvZ2dlci53YXJuKGBXYXJuaW5nOiAnb3V0cHV0SGFzaGluZycgb3B0aW9uIGlzIGRpc2FibGVkIHdoZW4gdXNpbmcgdGhlIGRldi1zZXJ2ZXIuYCk7XG4gICAgfVxuXG4gICAgY29uc3QgbWV0YWRhdGEgPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gICAgY29uc3QgY2FjaGVPcHRpb25zID0gbm9ybWFsaXplQ2FjaGVPcHRpb25zKG1ldGFkYXRhLCBjb250ZXh0LndvcmtzcGFjZVJvb3QpO1xuXG4gICAgY29uc3QgYnJvd3Nlck5hbWUgPSBhd2FpdCBjb250ZXh0LmdldEJ1aWxkZXJOYW1lRm9yVGFyZ2V0KGJyb3dzZXJUYXJnZXQpO1xuICAgIGNvbnN0IGJyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQudmFsaWRhdGVPcHRpb25zKFxuICAgICAge1xuICAgICAgICAuLi5yYXdCcm93c2VyT3B0aW9ucyxcbiAgICAgICAgd2F0Y2g6IG9wdGlvbnMud2F0Y2gsXG4gICAgICAgIHZlcmJvc2U6IG9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgLy8gSW4gZGV2IHNlcnZlciB3ZSBzaG91bGQgbm90IGhhdmUgYnVkZ2V0cyBiZWNhdXNlIG9mIGV4dHJhIGxpYnMgc3VjaCBhcyBzb2Nrcy1qc1xuICAgICAgICBidWRnZXRzOiB1bmRlZmluZWQsXG4gICAgICB9IGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICAgICAgYnJvd3Nlck5hbWUsXG4gICAgKSkgYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJTY2hlbWE7XG5cbiAgICBjb25zdCB7IHN0eWxlcywgc2NyaXB0cyB9ID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbik7XG4gICAgaWYgKHNjcmlwdHMgfHwgc3R5bGVzLm1pbmlmeSkge1xuICAgICAgbG9nZ2VyLmVycm9yKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgIFRoaXMgaXMgYSBzaW1wbGUgc2VydmVyIGZvciB1c2UgaW4gdGVzdGluZyBvciBkZWJ1Z2dpbmcgQW5ndWxhciBhcHBsaWNhdGlvbnMgbG9jYWxseS5cbiAgICAgICAgSXQgaGFzbid0IGJlZW4gcmV2aWV3ZWQgZm9yIHNlY3VyaXR5IGlzc3Vlcy5cblxuICAgICAgICBET04nVCBVU0UgSVQgRk9SIFBST0RVQ1RJT04hXG4gICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgIGApO1xuICAgIH1cblxuICAgIGNvbnN0IHsgY29uZmlnLCBwcm9qZWN0Um9vdCwgaTE4biB9ID0gYXdhaXQgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChcbiAgICAgIGJyb3dzZXJPcHRpb25zLFxuICAgICAgY29udGV4dCxcbiAgICAgICh3Y28pID0+IFtnZXREZXZTZXJ2ZXJDb25maWcod2NvKSwgZ2V0Q29tbW9uQ29uZmlnKHdjbyksIGdldFN0eWxlc0NvbmZpZyh3Y28pXSxcbiAgICAgIG9wdGlvbnMsXG4gICAgKTtcblxuICAgIGlmICghY29uZmlnLmRldlNlcnZlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdXZWJwYWNrIERldiBTZXJ2ZXIgY29uZmlndXJhdGlvbiB3YXMgbm90IHNldC4nKTtcbiAgICB9XG5cbiAgICBsZXQgbG9jYWxlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgaWYgKGkxOG4uc2hvdWxkSW5saW5lKSB7XG4gICAgICAvLyBEZXYtc2VydmVyIG9ubHkgc3VwcG9ydHMgb25lIGxvY2FsZVxuICAgICAgbG9jYWxlID0gWy4uLmkxOG4uaW5saW5lTG9jYWxlc11bMF07XG4gICAgfSBlbHNlIGlmIChpMThuLmhhc0RlZmluZWRTb3VyY2VMb2NhbGUpIHtcbiAgICAgIC8vIHVzZSBzb3VyY2UgbG9jYWxlIGlmIG5vdCBsb2NhbGl6aW5nXG4gICAgICBsb2NhbGUgPSBpMThuLnNvdXJjZUxvY2FsZTtcbiAgICB9XG5cbiAgICBsZXQgd2VicGFja0NvbmZpZyA9IGNvbmZpZztcblxuICAgIC8vIElmIGEgbG9jYWxlIGlzIGRlZmluZWQsIHNldHVwIGxvY2FsaXphdGlvblxuICAgIGlmIChsb2NhbGUpIHtcbiAgICAgIGlmIChpMThuLmlubGluZUxvY2FsZXMuc2l6ZSA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdUaGUgZGV2ZWxvcG1lbnQgc2VydmVyIG9ubHkgc3VwcG9ydHMgbG9jYWxpemluZyBhIHNpbmdsZSBsb2NhbGUgcGVyIGJ1aWxkLicsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHNldHVwTG9jYWxpemUobG9jYWxlLCBpMThuLCBicm93c2VyT3B0aW9ucywgd2VicGFja0NvbmZpZywgY2FjaGVPcHRpb25zLCBjb250ZXh0KTtcbiAgICB9XG5cbiAgICBpZiAodHJhbnNmb3Jtcy53ZWJwYWNrQ29uZmlndXJhdGlvbikge1xuICAgICAgd2VicGFja0NvbmZpZyA9IGF3YWl0IHRyYW5zZm9ybXMud2VicGFja0NvbmZpZ3VyYXRpb24od2VicGFja0NvbmZpZyk7XG4gICAgfVxuXG4gICAgd2VicGFja0NvbmZpZy5wbHVnaW5zID8/PSBbXTtcblxuICAgIGlmIChicm93c2VyT3B0aW9ucy5pbmRleCkge1xuICAgICAgY29uc3QgeyBzY3JpcHRzID0gW10sIHN0eWxlcyA9IFtdLCBiYXNlSHJlZiB9ID0gYnJvd3Nlck9wdGlvbnM7XG4gICAgICBjb25zdCBlbnRyeXBvaW50cyA9IGdlbmVyYXRlRW50cnlQb2ludHMoe1xuICAgICAgICBzY3JpcHRzLFxuICAgICAgICBzdHlsZXMsXG4gICAgICAgIC8vIFRoZSBiZWxvdyBpcyBuZWVkZWQgYXMgb3RoZXJ3aXNlIEhNUiBmb3IgQ1NTIHdpbGwgYnJlYWsuXG4gICAgICAgIC8vIHN0eWxlcy5qcyBhbmQgcnVudGltZS5qcyBuZWVkcyB0byBiZSBsb2FkZWQgYXMgYSBub24tbW9kdWxlIHNjcmlwdHMgYXMgb3RoZXJ3aXNlIGBkb2N1bWVudC5jdXJyZW50U2NyaXB0YCB3aWxsIGJlIG51bGwuXG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvbWluaS1jc3MtZXh0cmFjdC1wbHVnaW4vYmxvYi85MDQ0NWRkMWQ4MWRhMGMxMGI5YjBlOGExN2I0MTdkMDY1MTgxNmI4L3NyYy9obXIvaG90TW9kdWxlUmVwbGFjZW1lbnQuanMjTDM5XG4gICAgICAgIGlzSE1SRW5hYmxlZDogISF3ZWJwYWNrQ29uZmlnLmRldlNlcnZlcj8uaG90LFxuICAgICAgfSk7XG5cbiAgICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy5wdXNoKFxuICAgICAgICBuZXcgSW5kZXhIdG1sV2VicGFja1BsdWdpbih7XG4gICAgICAgICAgaW5kZXhQYXRoOiBwYXRoLnJlc29sdmUod29ya3NwYWNlUm9vdCwgZ2V0SW5kZXhJbnB1dEZpbGUoYnJvd3Nlck9wdGlvbnMuaW5kZXgpKSxcbiAgICAgICAgICBvdXRwdXRQYXRoOiBnZXRJbmRleE91dHB1dEZpbGUoYnJvd3Nlck9wdGlvbnMuaW5kZXgpLFxuICAgICAgICAgIGJhc2VIcmVmLFxuICAgICAgICAgIGVudHJ5cG9pbnRzLFxuICAgICAgICAgIGRlcGxveVVybDogYnJvd3Nlck9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgICAgIHNyaTogYnJvd3Nlck9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgICAgICAgY2FjaGU6IGNhY2hlT3B0aW9ucyxcbiAgICAgICAgICBwb3N0VHJhbnNmb3JtOiB0cmFuc2Zvcm1zLmluZGV4SHRtbCxcbiAgICAgICAgICBvcHRpbWl6YXRpb246IG5vcm1hbGl6ZU9wdGltaXphdGlvbihicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24pLFxuICAgICAgICAgIGNyb3NzT3JpZ2luOiBicm93c2VyT3B0aW9ucy5jcm9zc09yaWdpbixcbiAgICAgICAgICBsYW5nOiBsb2NhbGUsXG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoYnJvd3Nlck9wdGlvbnMuc2VydmljZVdvcmtlcikge1xuICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnB1c2goXG4gICAgICAgIG5ldyBTZXJ2aWNlV29ya2VyUGx1Z2luKHtcbiAgICAgICAgICBiYXNlSHJlZjogYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgICAgcm9vdDogY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgICAgIHByb2plY3RSb290LFxuICAgICAgICAgIG5nc3dDb25maWdQYXRoOiBicm93c2VyT3B0aW9ucy5uZ3N3Q29uZmlnUGF0aCxcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBicm93c2VyT3B0aW9ucyxcbiAgICAgIHdlYnBhY2tDb25maWcsXG4gICAgICBwcm9qZWN0Um9vdCxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIGZyb20oc2V0dXAoKSkucGlwZShcbiAgICBzd2l0Y2hNYXAoKHsgYnJvd3Nlck9wdGlvbnMsIHdlYnBhY2tDb25maWcgfSkgPT4ge1xuICAgICAgcmV0dXJuIHJ1bldlYnBhY2tEZXZTZXJ2ZXIod2VicGFja0NvbmZpZywgY29udGV4dCwge1xuICAgICAgICBsb2dnaW5nOiB0cmFuc2Zvcm1zLmxvZ2dpbmcgfHwgY3JlYXRlV2VicGFja0xvZ2dpbmdDYWxsYmFjayhicm93c2VyT3B0aW9ucywgbG9nZ2VyKSxcbiAgICAgICAgd2VicGFja0ZhY3Rvcnk6IHJlcXVpcmUoJ3dlYnBhY2snKSBhcyB0eXBlb2Ygd2VicGFjayxcbiAgICAgICAgd2VicGFja0RldlNlcnZlckZhY3Rvcnk6IHJlcXVpcmUoJ3dlYnBhY2stZGV2LXNlcnZlcicpIGFzIHR5cGVvZiB3ZWJwYWNrRGV2U2VydmVyLFxuICAgICAgfSkucGlwZShcbiAgICAgICAgY29uY2F0TWFwKGFzeW5jIChidWlsZEV2ZW50LCBpbmRleCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHdlYnBhY2tSYXdTdGF0cyA9IGJ1aWxkRXZlbnQud2VicGFja1N0YXRzO1xuICAgICAgICAgIGlmICghd2VicGFja1Jhd1N0YXRzKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYnBhY2sgc3RhdHMgYnVpbGQgcmVzdWx0IGlzIHJlcXVpcmVkLicpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFJlc29sdmUgc2VydmUgYWRkcmVzcy5cbiAgICAgICAgICBjb25zdCBwdWJsaWNQYXRoID0gd2VicGFja0NvbmZpZy5kZXZTZXJ2ZXI/LmRldk1pZGRsZXdhcmU/LnB1YmxpY1BhdGg7XG5cbiAgICAgICAgICBjb25zdCBzZXJ2ZXJBZGRyZXNzID0gdXJsLmZvcm1hdCh7XG4gICAgICAgICAgICBwcm90b2NvbDogb3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnLFxuICAgICAgICAgICAgaG9zdG5hbWU6IG9wdGlvbnMuaG9zdCA9PT0gJzAuMC4wLjAnID8gJ2xvY2FsaG9zdCcgOiBvcHRpb25zLmhvc3QsXG4gICAgICAgICAgICBwb3J0OiBidWlsZEV2ZW50LnBvcnQsXG4gICAgICAgICAgICBwYXRobmFtZTogdHlwZW9mIHB1YmxpY1BhdGggPT09ICdzdHJpbmcnID8gcHVibGljUGF0aCA6IHVuZGVmaW5lZCxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGlmIChpbmRleCA9PT0gMCkge1xuICAgICAgICAgICAgbG9nZ2VyLmluZm8oXG4gICAgICAgICAgICAgICdcXG4nICtcbiAgICAgICAgICAgICAgICB0YWdzLm9uZUxpbmVgXG4gICAgICAgICAgICAgICoqXG4gICAgICAgICAgICAgIEFuZ3VsYXIgTGl2ZSBEZXZlbG9wbWVudCBTZXJ2ZXIgaXMgbGlzdGVuaW5nIG9uICR7b3B0aW9ucy5ob3N0fToke2J1aWxkRXZlbnQucG9ydH0sXG4gICAgICAgICAgICAgIG9wZW4geW91ciBicm93c2VyIG9uICR7c2VydmVyQWRkcmVzc31cbiAgICAgICAgICAgICAgKipcbiAgICAgICAgICAgIGAgK1xuICAgICAgICAgICAgICAgICdcXG4nLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMub3Blbikge1xuICAgICAgICAgICAgICBjb25zdCBvcGVuID0gKGF3YWl0IGltcG9ydCgnb3BlbicpKS5kZWZhdWx0O1xuICAgICAgICAgICAgICBhd2FpdCBvcGVuKHNlcnZlckFkZHJlc3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChidWlsZEV2ZW50LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBcXG4ke2NvbG9ycy5ncmVlbkJyaWdodChjb2xvcnMuc3ltYm9scy5jaGVjayl9IENvbXBpbGVkIHN1Y2Nlc3NmdWxseS5gKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9nZ2VyLmluZm8oYFxcbiR7Y29sb3JzLnJlZEJyaWdodChjb2xvcnMuc3ltYm9scy5jcm9zcyl9IEZhaWxlZCB0byBjb21waWxlLmApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5idWlsZEV2ZW50LFxuICAgICAgICAgICAgYmFzZVVybDogc2VydmVyQWRkcmVzcyxcbiAgICAgICAgICAgIHN0YXRzOiBnZW5lcmF0ZUJ1aWxkRXZlbnRTdGF0cyh3ZWJwYWNrUmF3U3RhdHMsIGJyb3dzZXJPcHRpb25zKSxcbiAgICAgICAgICB9IGFzIERldlNlcnZlckJ1aWxkZXJPdXRwdXQ7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9KSxcbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2V0dXBMb2NhbGl6ZShcbiAgbG9jYWxlOiBzdHJpbmcsXG4gIGkxOG46IEkxOG5PcHRpb25zLFxuICBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIHdlYnBhY2tDb25maWc6IHdlYnBhY2suQ29uZmlndXJhdGlvbixcbiAgY2FjaGVPcHRpb25zOiBOb3JtYWxpemVkQ2FjaGVkT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pIHtcbiAgY29uc3QgbG9jYWxlRGVzY3JpcHRpb24gPSBpMThuLmxvY2FsZXNbbG9jYWxlXTtcblxuICAvLyBNb2RpZnkgbWFpbiBlbnRyeXBvaW50IHRvIGluY2x1ZGUgbG9jYWxlIGRhdGFcbiAgaWYgKFxuICAgIGxvY2FsZURlc2NyaXB0aW9uPy5kYXRhUGF0aCAmJlxuICAgIHR5cGVvZiB3ZWJwYWNrQ29uZmlnLmVudHJ5ID09PSAnb2JqZWN0JyAmJlxuICAgICFBcnJheS5pc0FycmF5KHdlYnBhY2tDb25maWcuZW50cnkpICYmXG4gICAgd2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddXG4gICkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXSkpIHtcbiAgICAgIHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXS51bnNoaWZ0KGxvY2FsZURlc2NyaXB0aW9uLmRhdGFQYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddID0gW1xuICAgICAgICBsb2NhbGVEZXNjcmlwdGlvbi5kYXRhUGF0aCxcbiAgICAgICAgd2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddIGFzIHN0cmluZyxcbiAgICAgIF07XG4gICAgfVxuICB9XG5cbiAgbGV0IG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yID0gYnJvd3Nlck9wdGlvbnMuaTE4bk1pc3NpbmdUcmFuc2xhdGlvbiB8fCAnaWdub3JlJztcbiAgbGV0IHRyYW5zbGF0aW9uID0gbG9jYWxlRGVzY3JpcHRpb24/LnRyYW5zbGF0aW9uIHx8IHt9O1xuXG4gIGlmIChsb2NhbGUgPT09IGkxOG4uc291cmNlTG9jYWxlKSB7XG4gICAgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IgPSAnaWdub3JlJztcbiAgICB0cmFuc2xhdGlvbiA9IHt9O1xuICB9XG5cbiAgY29uc3QgaTE4bkxvYWRlck9wdGlvbnMgPSB7XG4gICAgbG9jYWxlLFxuICAgIG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yLFxuICAgIHRyYW5zbGF0aW9uOiBpMThuLnNob3VsZElubGluZSA/IHRyYW5zbGF0aW9uIDogdW5kZWZpbmVkLFxuICAgIHRyYW5zbGF0aW9uRmlsZXM6IGxvY2FsZURlc2NyaXB0aW9uPy5maWxlcy5tYXAoKGZpbGUpID0+XG4gICAgICBwYXRoLnJlc29sdmUoY29udGV4dC53b3Jrc3BhY2VSb290LCBmaWxlLnBhdGgpLFxuICAgICksXG4gIH07XG5cbiAgY29uc3QgaTE4blJ1bGU6IHdlYnBhY2suUnVsZVNldFJ1bGUgPSB7XG4gICAgdGVzdDogL1xcLltjbV0/W3RqXXN4PyQvLFxuICAgIGVuZm9yY2U6ICdwb3N0JyxcbiAgICB1c2U6IFtcbiAgICAgIHtcbiAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJy4uLy4uL2JhYmVsL3dlYnBhY2stbG9hZGVyJyksXG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICBjYWNoZURpcmVjdG9yeTpcbiAgICAgICAgICAgIChjYWNoZU9wdGlvbnMuZW5hYmxlZCAmJiBwYXRoLmpvaW4oY2FjaGVPcHRpb25zLnBhdGgsICdiYWJlbC1kZXYtc2VydmVyLWkxOG4nKSkgfHxcbiAgICAgICAgICAgIGZhbHNlLFxuICAgICAgICAgIGNhY2hlSWRlbnRpZmllcjogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgbG9jYWxlLFxuICAgICAgICAgICAgdHJhbnNsYXRpb25JbnRlZ3JpdHk6IGxvY2FsZURlc2NyaXB0aW9uPy5maWxlcy5tYXAoKGZpbGUpID0+IGZpbGUuaW50ZWdyaXR5KSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBpMThuOiBpMThuTG9hZGVyT3B0aW9ucyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfTtcblxuICAvLyBHZXQgdGhlIHJ1bGVzIGFuZCBlbnN1cmUgdGhlIFdlYnBhY2sgY29uZmlndXJhdGlvbiBpcyBzZXR1cCBwcm9wZXJseVxuICBjb25zdCBydWxlcyA9IHdlYnBhY2tDb25maWcubW9kdWxlPy5ydWxlcyB8fCBbXTtcbiAgaWYgKCF3ZWJwYWNrQ29uZmlnLm1vZHVsZSkge1xuICAgIHdlYnBhY2tDb25maWcubW9kdWxlID0geyBydWxlcyB9O1xuICB9IGVsc2UgaWYgKCF3ZWJwYWNrQ29uZmlnLm1vZHVsZS5ydWxlcykge1xuICAgIHdlYnBhY2tDb25maWcubW9kdWxlLnJ1bGVzID0gcnVsZXM7XG4gIH1cblxuICBydWxlcy5wdXNoKGkxOG5SdWxlKTtcblxuICAvLyBBZGQgYSBwbHVnaW4gdG8gcmVsb2FkIHRyYW5zbGF0aW9uIGZpbGVzIG9uIHJlYnVpbGRzXG4gIGNvbnN0IGxvYWRlciA9IGF3YWl0IGNyZWF0ZVRyYW5zbGF0aW9uTG9hZGVyKCk7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gIHdlYnBhY2tDb25maWcucGx1Z2lucyEucHVzaCh7XG4gICAgYXBwbHk6IChjb21waWxlcjogd2VicGFjay5Db21waWxlcikgPT4ge1xuICAgICAgY29tcGlsZXIuaG9va3MudGhpc0NvbXBpbGF0aW9uLnRhcCgnYnVpbGQtYW5ndWxhcicsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgICBpZiAoaTE4bi5zaG91bGRJbmxpbmUgJiYgaTE4bkxvYWRlck9wdGlvbnMudHJhbnNsYXRpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIFJlbG9hZCB0cmFuc2xhdGlvbnNcbiAgICAgICAgICBsb2FkVHJhbnNsYXRpb25zKFxuICAgICAgICAgICAgbG9jYWxlLFxuICAgICAgICAgICAgbG9jYWxlRGVzY3JpcHRpb24sXG4gICAgICAgICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICBsb2FkZXIsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHdhcm4obWVzc2FnZSkge1xuICAgICAgICAgICAgICAgIGFkZFdhcm5pbmcoY29tcGlsYXRpb24sIG1lc3NhZ2UpO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBlcnJvcihtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgYWRkRXJyb3IoY29tcGlsYXRpb24sIG1lc3NhZ2UpO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGJyb3dzZXJPcHRpb25zLmkxOG5EdXBsaWNhdGVUcmFuc2xhdGlvbixcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgaTE4bkxvYWRlck9wdGlvbnMudHJhbnNsYXRpb24gPSBsb2NhbGVEZXNjcmlwdGlvbi50cmFuc2xhdGlvbiA/PyB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbXBpbGF0aW9uLmhvb2tzLmZpbmlzaE1vZHVsZXMudGFwKCdidWlsZC1hbmd1bGFyJywgKCkgPT4ge1xuICAgICAgICAgIC8vIEFmdGVyIGxvYWRlcnMgYXJlIGZpbmlzaGVkLCBjbGVhciBvdXQgdGhlIG5vdyB1bm5lZWRlZCB0cmFuc2xhdGlvbnNcbiAgICAgICAgICBpMThuTG9hZGVyT3B0aW9ucy50cmFuc2xhdGlvbiA9IHVuZGVmaW5lZDtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcjxEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucywgRGV2U2VydmVyQnVpbGRlck91dHB1dD4oc2VydmVXZWJwYWNrQnJvd3Nlcik7XG4iXX0=