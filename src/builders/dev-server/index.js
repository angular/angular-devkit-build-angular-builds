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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQWtHO0FBQ2xHLGlFQUl1QztBQUN2QywrQ0FBa0Q7QUFDbEQsMkNBQTZCO0FBQzdCLCtCQUF3QztBQUN4Qyw4Q0FBc0Q7QUFDdEQseUNBQTJCO0FBSTNCLHVDQUFvRDtBQUNwRCx1REFBbUQ7QUFDbkQsNkNBQTJDO0FBQzNDLDJEQUF5RTtBQUV6RSxxRUFBd0U7QUFDeEUsaUVBQTZGO0FBQzdGLHVFQUFxRTtBQUNyRSx5REFBK0Q7QUFDL0QsaURBQXFFO0FBQ3JFLCtFQUk0QztBQUM1Qyx5RUFBdUU7QUFDdkUsbURBSytCO0FBQy9CLCtGQUF5RjtBQUN6Rix1RkFBa0Y7QUFDbEYscURBQXlFO0FBQ3pFLDhDQUFrRjtBQVlsRjs7Ozs7Ozs7R0FRRztBQUNILGtEQUFrRDtBQUNsRCxTQUFnQixtQkFBbUIsQ0FDakMsT0FBZ0MsRUFDaEMsT0FBdUIsRUFDdkIsYUFJSSxFQUFFO0lBRU4seUJBQXlCO0lBQ3pCLE1BQU0sRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLEdBQUcsT0FBTyxDQUFDO0lBQzFDLElBQUEsd0NBQThCLEVBQUMsYUFBYSxDQUFDLENBQUM7SUFFOUMsTUFBTSxhQUFhLEdBQUcsSUFBQSxrQ0FBc0IsRUFBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7SUFFcEUsS0FBSyxVQUFVLEtBQUs7O1FBS2xCLE1BQU0sV0FBVyxHQUFHLE1BQUEsT0FBTyxDQUFDLE1BQU0sMENBQUUsT0FBTyxDQUFDO1FBQzVDLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDaEIsTUFBTSxJQUFJLEtBQUss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aWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgY3JlYXRlQnVpbGRlciwgdGFyZ2V0RnJvbVRhcmdldFN0cmluZyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHtcbiAgRGV2U2VydmVyQnVpbGRPdXRwdXQsXG4gIFdlYnBhY2tMb2dnaW5nQ2FsbGJhY2ssXG4gIHJ1bldlYnBhY2tEZXZTZXJ2ZXIsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJztcbmltcG9ydCB7IGpzb24sIHRhZ3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcbmltcG9ydCB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHdlYnBhY2tEZXZTZXJ2ZXIgZnJvbSAnd2VicGFjay1kZXYtc2VydmVyJztcbmltcG9ydCB7IEV4ZWN1dGlvblRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vdHJhbnNmb3Jtcyc7XG5pbXBvcnQgeyBub3JtYWxpemVPcHRpbWl6YXRpb24gfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBjaGVja1BvcnQgfSBmcm9tICcuLi8uLi91dGlscy9jaGVjay1wb3J0JztcbmltcG9ydCB7IGNvbG9ycyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvbG9yJztcbmltcG9ydCB7IEkxOG5PcHRpb25zLCBsb2FkVHJhbnNsYXRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IEluZGV4SHRtbFRyYW5zZm9ybSB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgY3JlYXRlVHJhbnNsYXRpb25Mb2FkZXIgfSBmcm9tICcuLi8uLi91dGlscy9sb2FkLXRyYW5zbGF0aW9ucyc7XG5pbXBvcnQgeyBOb3JtYWxpemVkQ2FjaGVkT3B0aW9ucywgbm9ybWFsaXplQ2FjaGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvbm9ybWFsaXplLWNhY2hlJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMgfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUgfSBmcm9tICcuLi8uLi91dGlscy9wdXJnZS1jYWNoZSc7XG5pbXBvcnQgeyBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24gfSBmcm9tICcuLi8uLi91dGlscy92ZXJzaW9uJztcbmltcG9ydCB7XG4gIGdlbmVyYXRlSTE4bkJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQsXG4gIGdldEluZGV4SW5wdXRGaWxlLFxuICBnZXRJbmRleE91dHB1dEZpbGUsXG59IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgYWRkRXJyb3IsIGFkZFdhcm5pbmcgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWRpYWdub3N0aWNzJztcbmltcG9ydCB7XG4gIGdldEFuYWx5dGljc0NvbmZpZyxcbiAgZ2V0Q29tbW9uQ29uZmlnLFxuICBnZXREZXZTZXJ2ZXJDb25maWcsXG4gIGdldFN0eWxlc0NvbmZpZyxcbn0gZnJvbSAnLi4vLi4vd2VicGFjay9jb25maWdzJztcbmltcG9ydCB7IEluZGV4SHRtbFdlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi93ZWJwYWNrL3BsdWdpbnMvaW5kZXgtaHRtbC13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgeyBTZXJ2aWNlV29ya2VyUGx1Z2luIH0gZnJvbSAnLi4vLi4vd2VicGFjay9wbHVnaW5zL3NlcnZpY2Utd29ya2VyLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrIH0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJTY2hlbWEsIE91dHB1dEhhc2hpbmcgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmV4cG9ydCB0eXBlIERldlNlcnZlckJ1aWxkZXJPcHRpb25zID0gU2NoZW1hO1xuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgdHlwZSBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuZXhwb3J0IHR5cGUgRGV2U2VydmVyQnVpbGRlck91dHB1dCA9IERldlNlcnZlckJ1aWxkT3V0cHV0ICYge1xuICBiYXNlVXJsOiBzdHJpbmc7XG59O1xuXG4vKipcbiAqIFJldXNhYmxlIGltcGxlbWVudGF0aW9uIG9mIHRoZSBBbmd1bGFyIFdlYnBhY2sgZGV2ZWxvcG1lbnQgc2VydmVyIGJ1aWxkZXIuXG4gKiBAcGFyYW0gb3B0aW9ucyBEZXYgU2VydmVyIG9wdGlvbnMuXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgYnVpbGQgY29udGV4dC5cbiAqIEBwYXJhbSB0cmFuc2Zvcm1zIEEgbWFwIG9mIHRyYW5zZm9ybXMgdGhhdCBjYW4gYmUgdXNlZCB0byBob29rIGludG8gc29tZSBsb2dpYyAoc3VjaCBhc1xuICogICAgIHRyYW5zZm9ybWluZyB3ZWJwYWNrIGNvbmZpZ3VyYXRpb24gYmVmb3JlIHBhc3NpbmcgaXQgdG8gd2VicGFjaykuXG4gKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBzZXJ2ZVdlYnBhY2tCcm93c2VyKFxuICBvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHRyYW5zZm9ybXM6IHtcbiAgICB3ZWJwYWNrQ29uZmlndXJhdGlvbj86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPHdlYnBhY2suQ29uZmlndXJhdGlvbj47XG4gICAgbG9nZ2luZz86IFdlYnBhY2tMb2dnaW5nQ2FsbGJhY2s7XG4gICAgaW5kZXhIdG1sPzogSW5kZXhIdG1sVHJhbnNmb3JtO1xuICB9ID0ge30sXG4pOiBPYnNlcnZhYmxlPERldlNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gQ2hlY2sgQW5ndWxhciB2ZXJzaW9uLlxuICBjb25zdCB7IGxvZ2dlciwgd29ya3NwYWNlUm9vdCB9ID0gY29udGV4dDtcbiAgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uKHdvcmtzcGFjZVJvb3QpO1xuXG4gIGNvbnN0IGJyb3dzZXJUYXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuYnJvd3NlclRhcmdldCk7XG5cbiAgYXN5bmMgZnVuY3Rpb24gc2V0dXAoKTogUHJvbWlzZTx7XG4gICAgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hO1xuICAgIHdlYnBhY2tDb25maWc6IHdlYnBhY2suQ29uZmlndXJhdGlvbjtcbiAgICBwcm9qZWN0Um9vdDogc3RyaW5nO1xuICB9PiB7XG4gICAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0LicpO1xuICAgIH1cblxuICAgIC8vIFB1cmdlIG9sZCBidWlsZCBkaXNrIGNhY2hlLlxuICAgIGF3YWl0IHB1cmdlU3RhbGVCdWlsZENhY2hlKGNvbnRleHQpO1xuXG4gICAgb3B0aW9ucy5wb3J0ID0gYXdhaXQgY2hlY2tQb3J0KG9wdGlvbnMucG9ydCA/PyA0MjAwLCBvcHRpb25zLmhvc3QgfHwgJ2xvY2FsaG9zdCcpO1xuXG4gICAgaWYgKG9wdGlvbnMuaG1yKSB7XG4gICAgICBsb2dnZXIud2Fybih0YWdzLnN0cmlwSW5kZW50c2BOT1RJQ0U6IEhvdCBNb2R1bGUgUmVwbGFjZW1lbnQgKEhNUikgaXMgZW5hYmxlZCBmb3IgdGhlIGRldiBzZXJ2ZXIuXG4gICAgICBTZWUgaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9ndWlkZXMvaG90LW1vZHVsZS1yZXBsYWNlbWVudCBmb3IgaW5mb3JtYXRpb24gb24gd29ya2luZyB3aXRoIEhNUiBmb3IgV2VicGFjay5gKTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICAhb3B0aW9ucy5kaXNhYmxlSG9zdENoZWNrICYmXG4gICAgICBvcHRpb25zLmhvc3QgJiZcbiAgICAgICEvXjEyN1xcLlxcZCtcXC5cXGQrXFwuXFxkKy9nLnRlc3Qob3B0aW9ucy5ob3N0KSAmJlxuICAgICAgb3B0aW9ucy5ob3N0ICE9PSAnbG9jYWxob3N0J1xuICAgICkge1xuICAgICAgbG9nZ2VyLndhcm4odGFncy5zdHJpcEluZGVudGBcbiAgICAgICAgV2FybmluZzogVGhpcyBpcyBhIHNpbXBsZSBzZXJ2ZXIgZm9yIHVzZSBpbiB0ZXN0aW5nIG9yIGRlYnVnZ2luZyBBbmd1bGFyIGFwcGxpY2F0aW9uc1xuICAgICAgICBsb2NhbGx5LiBJdCBoYXNuJ3QgYmVlbiByZXZpZXdlZCBmb3Igc2VjdXJpdHkgaXNzdWVzLlxuXG4gICAgICAgIEJpbmRpbmcgdGhpcyBzZXJ2ZXIgdG8gYW4gb3BlbiBjb25uZWN0aW9uIGNhbiByZXN1bHQgaW4gY29tcHJvbWlzaW5nIHlvdXIgYXBwbGljYXRpb24gb3JcbiAgICAgICAgY29tcHV0ZXIuIFVzaW5nIGEgZGlmZmVyZW50IGhvc3QgdGhhbiB0aGUgb25lIHBhc3NlZCB0byB0aGUgXCItLWhvc3RcIiBmbGFnIG1pZ2h0IHJlc3VsdCBpblxuICAgICAgICB3ZWJzb2NrZXQgY29ubmVjdGlvbiBpc3N1ZXMuIFlvdSBtaWdodCBuZWVkIHRvIHVzZSBcIi0tZGlzYWJsZS1ob3N0LWNoZWNrXCIgaWYgdGhhdCdzIHRoZVxuICAgICAgICBjYXNlLlxuICAgICAgYCk7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjaykge1xuICAgICAgbG9nZ2VyLndhcm4odGFncy5vbmVMaW5lYFxuICAgICAgICBXYXJuaW5nOiBSdW5uaW5nIGEgc2VydmVyIHdpdGggLS1kaXNhYmxlLWhvc3QtY2hlY2sgaXMgYSBzZWN1cml0eSByaXNrLlxuICAgICAgICBTZWUgaHR0cHM6Ly9tZWRpdW0uY29tL3dlYnBhY2svd2VicGFjay1kZXYtc2VydmVyLW1pZGRsZXdhcmUtc2VjdXJpdHktaXNzdWVzLTE0ODlkOTUwODc0YVxuICAgICAgICBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cbiAgICAgIGApO1xuICAgIH1cbiAgICAvLyBHZXQgdGhlIGJyb3dzZXIgY29uZmlndXJhdGlvbiBmcm9tIHRoZSB0YXJnZXQgbmFtZS5cbiAgICBjb25zdCByYXdCcm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMoYnJvd3NlclRhcmdldCkpIGFzIGpzb24uSnNvbk9iamVjdCAmXG4gICAgICBCcm93c2VyQnVpbGRlclNjaGVtYTtcblxuICAgIGlmIChyYXdCcm93c2VyT3B0aW9ucy5vdXRwdXRIYXNoaW5nICYmIHJhd0Jyb3dzZXJPcHRpb25zLm91dHB1dEhhc2hpbmcgIT09IE91dHB1dEhhc2hpbmcuTm9uZSkge1xuICAgICAgLy8gRGlzYWJsZSBvdXRwdXQgaGFzaGluZyBmb3IgZGV2IGJ1aWxkIGFzIHRoaXMgY2FuIGNhdXNlIG1lbW9yeSBsZWFrc1xuICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay93ZWJwYWNrLWRldi1zZXJ2ZXIvaXNzdWVzLzM3NyNpc3N1ZWNvbW1lbnQtMjQxMjU4NDA1XG4gICAgICByYXdCcm93c2VyT3B0aW9ucy5vdXRwdXRIYXNoaW5nID0gT3V0cHV0SGFzaGluZy5Ob25lO1xuICAgICAgbG9nZ2VyLndhcm4oYFdhcm5pbmc6ICdvdXRwdXRIYXNoaW5nJyBvcHRpb24gaXMgZGlzYWJsZWQgd2hlbiB1c2luZyB0aGUgZGV2LXNlcnZlci5gKTtcbiAgICB9XG5cbiAgICBjb25zdCBtZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgICBjb25zdCBjYWNoZU9wdGlvbnMgPSBub3JtYWxpemVDYWNoZU9wdGlvbnMobWV0YWRhdGEsIGNvbnRleHQud29ya3NwYWNlUm9vdCk7XG5cbiAgICBjb25zdCBicm93c2VyTmFtZSA9IGF3YWl0IGNvbnRleHQuZ2V0QnVpbGRlck5hbWVGb3JUYXJnZXQoYnJvd3NlclRhcmdldCk7XG5cbiAgICAvLyBJc3N1ZSBhIHdhcm5pbmcgdGhhdCB0aGUgZGV2LXNlcnZlciBkb2VzIG5vdCBjdXJyZW50bHkgc3VwcG9ydCB0aGUgZXhwZXJpbWVudGFsIGVzYnVpbGQtXG4gICAgLy8gYmFzZWQgYnVpbGRlciBhbmQgd2lsbCB1c2UgV2VicGFjay5cbiAgICBpZiAoYnJvd3Nlck5hbWUgPT09ICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcjpicm93c2VyLWVzYnVpbGQnKSB7XG4gICAgICBsb2dnZXIud2FybihcbiAgICAgICAgJ1dBUk5JTkc6IFRoZSBleHBlcmltZW50YWwgZXNidWlsZC1iYXNlZCBidWlsZGVyIGlzIG5vdCBjdXJyZW50bHkgc3VwcG9ydGVkICcgK1xuICAgICAgICAgICdieSB0aGUgZGV2LXNlcnZlci4gVGhlIHN0YWJsZSBXZWJwYWNrLWJhc2VkIGJ1aWxkZXIgd2lsbCBiZSB1c2VkIGluc3RlYWQuJyxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC52YWxpZGF0ZU9wdGlvbnMoXG4gICAgICB7XG4gICAgICAgIC4uLnJhd0Jyb3dzZXJPcHRpb25zLFxuICAgICAgICB3YXRjaDogb3B0aW9ucy53YXRjaCxcbiAgICAgICAgdmVyYm9zZTogb3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAvLyBJbiBkZXYgc2VydmVyIHdlIHNob3VsZCBub3QgaGF2ZSBidWRnZXRzIGJlY2F1c2Ugb2YgZXh0cmEgbGlicyBzdWNoIGFzIHNvY2tzLWpzXG4gICAgICAgIGJ1ZGdldHM6IHVuZGVmaW5lZCxcbiAgICAgIH0gYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICAgICBicm93c2VyTmFtZSxcbiAgICApKSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlclNjaGVtYTtcblxuICAgIGNvbnN0IHsgc3R5bGVzLCBzY3JpcHRzIH0gPSBub3JtYWxpemVPcHRpbWl6YXRpb24oYnJvd3Nlck9wdGlvbnMub3B0aW1pemF0aW9uKTtcbiAgICBpZiAoc2NyaXB0cyB8fCBzdHlsZXMubWluaWZ5KSB7XG4gICAgICBsb2dnZXIuZXJyb3IodGFncy5zdHJpcEluZGVudHNgXG4gICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgVGhpcyBpcyBhIHNpbXBsZSBzZXJ2ZXIgZm9yIHVzZSBpbiB0ZXN0aW5nIG9yIGRlYnVnZ2luZyBBbmd1bGFyIGFwcGxpY2F0aW9ucyBsb2NhbGx5LlxuICAgICAgICBJdCBoYXNuJ3QgYmVlbiByZXZpZXdlZCBmb3Igc2VjdXJpdHkgaXNzdWVzLlxuXG4gICAgICAgIERPTidUIFVTRSBJVCBGT1IgUFJPRFVDVElPTiFcbiAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgYCk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBjb25maWcsIHByb2plY3RSb290LCBpMThuIH0gPSBhd2FpdCBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KFxuICAgICAgYnJvd3Nlck9wdGlvbnMsXG4gICAgICBjb250ZXh0LFxuICAgICAgKHdjbykgPT4gW1xuICAgICAgICBnZXREZXZTZXJ2ZXJDb25maWcod2NvKSxcbiAgICAgICAgZ2V0Q29tbW9uQ29uZmlnKHdjbyksXG4gICAgICAgIGdldFN0eWxlc0NvbmZpZyh3Y28pLFxuICAgICAgICBnZXRBbmFseXRpY3NDb25maWcod2NvLCBjb250ZXh0KSxcbiAgICAgIF0sXG4gICAgICBvcHRpb25zLFxuICAgICk7XG5cbiAgICBpZiAoIWNvbmZpZy5kZXZTZXJ2ZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignV2VicGFjayBEZXYgU2VydmVyIGNvbmZpZ3VyYXRpb24gd2FzIG5vdCBzZXQuJyk7XG4gICAgfVxuXG4gICAgbGV0IGxvY2FsZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIGlmIChpMThuLnNob3VsZElubGluZSkge1xuICAgICAgLy8gRGV2LXNlcnZlciBvbmx5IHN1cHBvcnRzIG9uZSBsb2NhbGVcbiAgICAgIGxvY2FsZSA9IFsuLi5pMThuLmlubGluZUxvY2FsZXNdWzBdO1xuICAgIH0gZWxzZSBpZiAoaTE4bi5oYXNEZWZpbmVkU291cmNlTG9jYWxlKSB7XG4gICAgICAvLyB1c2Ugc291cmNlIGxvY2FsZSBpZiBub3QgbG9jYWxpemluZ1xuICAgICAgbG9jYWxlID0gaTE4bi5zb3VyY2VMb2NhbGU7XG4gICAgfVxuXG4gICAgbGV0IHdlYnBhY2tDb25maWcgPSBjb25maWc7XG5cbiAgICAvLyBJZiBhIGxvY2FsZSBpcyBkZWZpbmVkLCBzZXR1cCBsb2NhbGl6YXRpb25cbiAgICBpZiAobG9jYWxlKSB7XG4gICAgICBpZiAoaTE4bi5pbmxpbmVMb2NhbGVzLnNpemUgPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnVGhlIGRldmVsb3BtZW50IHNlcnZlciBvbmx5IHN1cHBvcnRzIGxvY2FsaXppbmcgYSBzaW5nbGUgbG9jYWxlIHBlciBidWlsZC4nLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCBzZXR1cExvY2FsaXplKGxvY2FsZSwgaTE4biwgYnJvd3Nlck9wdGlvbnMsIHdlYnBhY2tDb25maWcsIGNhY2hlT3B0aW9ucywgY29udGV4dCk7XG4gICAgfVxuXG4gICAgaWYgKHRyYW5zZm9ybXMud2VicGFja0NvbmZpZ3VyYXRpb24pIHtcbiAgICAgIHdlYnBhY2tDb25maWcgPSBhd2FpdCB0cmFuc2Zvcm1zLndlYnBhY2tDb25maWd1cmF0aW9uKHdlYnBhY2tDb25maWcpO1xuICAgIH1cblxuICAgIHdlYnBhY2tDb25maWcucGx1Z2lucyA/Pz0gW107XG5cbiAgICBpZiAoYnJvd3Nlck9wdGlvbnMuaW5kZXgpIHtcbiAgICAgIGNvbnN0IHsgc2NyaXB0cyA9IFtdLCBzdHlsZXMgPSBbXSwgYmFzZUhyZWYgfSA9IGJyb3dzZXJPcHRpb25zO1xuICAgICAgY29uc3QgZW50cnlwb2ludHMgPSBnZW5lcmF0ZUVudHJ5UG9pbnRzKHtcbiAgICAgICAgc2NyaXB0cyxcbiAgICAgICAgc3R5bGVzLFxuICAgICAgICAvLyBUaGUgYmVsb3cgaXMgbmVlZGVkIGFzIG90aGVyd2lzZSBITVIgZm9yIENTUyB3aWxsIGJyZWFrLlxuICAgICAgICAvLyBzdHlsZXMuanMgYW5kIHJ1bnRpbWUuanMgbmVlZHMgdG8gYmUgbG9hZGVkIGFzIGEgbm9uLW1vZHVsZSBzY3JpcHRzIGFzIG90aGVyd2lzZSBgZG9jdW1lbnQuY3VycmVudFNjcmlwdGAgd2lsbCBiZSBudWxsLlxuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL21pbmktY3NzLWV4dHJhY3QtcGx1Z2luL2Jsb2IvOTA0NDVkZDFkODFkYTBjMTBiOWIwZThhMTdiNDE3ZDA2NTE4MTZiOC9zcmMvaG1yL2hvdE1vZHVsZVJlcGxhY2VtZW50LmpzI0wzOVxuICAgICAgICBpc0hNUkVuYWJsZWQ6ICEhd2VicGFja0NvbmZpZy5kZXZTZXJ2ZXI/LmhvdCxcbiAgICAgIH0pO1xuXG4gICAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMucHVzaChcbiAgICAgICAgbmV3IEluZGV4SHRtbFdlYnBhY2tQbHVnaW4oe1xuICAgICAgICAgIGluZGV4UGF0aDogcGF0aC5yZXNvbHZlKHdvcmtzcGFjZVJvb3QsIGdldEluZGV4SW5wdXRGaWxlKGJyb3dzZXJPcHRpb25zLmluZGV4KSksXG4gICAgICAgICAgb3V0cHV0UGF0aDogZ2V0SW5kZXhPdXRwdXRGaWxlKGJyb3dzZXJPcHRpb25zLmluZGV4KSxcbiAgICAgICAgICBiYXNlSHJlZixcbiAgICAgICAgICBlbnRyeXBvaW50cyxcbiAgICAgICAgICBkZXBsb3lVcmw6IGJyb3dzZXJPcHRpb25zLmRlcGxveVVybCxcbiAgICAgICAgICBzcmk6IGJyb3dzZXJPcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgICAgICAgIGNhY2hlOiBjYWNoZU9wdGlvbnMsXG4gICAgICAgICAgcG9zdFRyYW5zZm9ybTogdHJhbnNmb3Jtcy5pbmRleEh0bWwsXG4gICAgICAgICAgb3B0aW1pemF0aW9uOiBub3JtYWxpemVPcHRpbWl6YXRpb24oYnJvd3Nlck9wdGlvbnMub3B0aW1pemF0aW9uKSxcbiAgICAgICAgICBjcm9zc09yaWdpbjogYnJvd3Nlck9wdGlvbnMuY3Jvc3NPcmlnaW4sXG4gICAgICAgICAgbGFuZzogbG9jYWxlLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKGJyb3dzZXJPcHRpb25zLnNlcnZpY2VXb3JrZXIpIHtcbiAgICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy5wdXNoKFxuICAgICAgICBuZXcgU2VydmljZVdvcmtlclBsdWdpbih7XG4gICAgICAgICAgYmFzZUhyZWY6IGJyb3dzZXJPcHRpb25zLmJhc2VIcmVmLFxuICAgICAgICAgIHJvb3Q6IGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICBwcm9qZWN0Um9vdCxcbiAgICAgICAgICBuZ3N3Q29uZmlnUGF0aDogYnJvd3Nlck9wdGlvbnMubmdzd0NvbmZpZ1BhdGgsXG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgYnJvd3Nlck9wdGlvbnMsXG4gICAgICB3ZWJwYWNrQ29uZmlnLFxuICAgICAgcHJvamVjdFJvb3QsXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiBmcm9tKHNldHVwKCkpLnBpcGUoXG4gICAgc3dpdGNoTWFwKCh7IGJyb3dzZXJPcHRpb25zLCB3ZWJwYWNrQ29uZmlnIH0pID0+IHtcbiAgICAgIHJldHVybiBydW5XZWJwYWNrRGV2U2VydmVyKHdlYnBhY2tDb25maWcsIGNvbnRleHQsIHtcbiAgICAgICAgbG9nZ2luZzogdHJhbnNmb3Jtcy5sb2dnaW5nIHx8IGNyZWF0ZVdlYnBhY2tMb2dnaW5nQ2FsbGJhY2soYnJvd3Nlck9wdGlvbnMsIGxvZ2dlciksXG4gICAgICAgIHdlYnBhY2tGYWN0b3J5OiByZXF1aXJlKCd3ZWJwYWNrJykgYXMgdHlwZW9mIHdlYnBhY2ssXG4gICAgICAgIHdlYnBhY2tEZXZTZXJ2ZXJGYWN0b3J5OiByZXF1aXJlKCd3ZWJwYWNrLWRldi1zZXJ2ZXInKSBhcyB0eXBlb2Ygd2VicGFja0RldlNlcnZlcixcbiAgICAgIH0pLnBpcGUoXG4gICAgICAgIGNvbmNhdE1hcChhc3luYyAoYnVpbGRFdmVudCwgaW5kZXgpID0+IHtcbiAgICAgICAgICAvLyBSZXNvbHZlIHNlcnZlIGFkZHJlc3MuXG4gICAgICAgICAgY29uc3QgcHVibGljUGF0aCA9IHdlYnBhY2tDb25maWcuZGV2U2VydmVyPy5kZXZNaWRkbGV3YXJlPy5wdWJsaWNQYXRoO1xuXG4gICAgICAgICAgY29uc3Qgc2VydmVyQWRkcmVzcyA9IHVybC5mb3JtYXQoe1xuICAgICAgICAgICAgcHJvdG9jb2w6IG9wdGlvbnMuc3NsID8gJ2h0dHBzJyA6ICdodHRwJyxcbiAgICAgICAgICAgIGhvc3RuYW1lOiBvcHRpb25zLmhvc3QgPT09ICcwLjAuMC4wJyA/ICdsb2NhbGhvc3QnIDogb3B0aW9ucy5ob3N0LFxuICAgICAgICAgICAgcG9ydDogYnVpbGRFdmVudC5wb3J0LFxuICAgICAgICAgICAgcGF0aG5hbWU6IHR5cGVvZiBwdWJsaWNQYXRoID09PSAnc3RyaW5nJyA/IHB1YmxpY1BhdGggOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBpZiAoaW5kZXggPT09IDApIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKFxuICAgICAgICAgICAgICAnXFxuJyArXG4gICAgICAgICAgICAgICAgdGFncy5vbmVMaW5lYFxuICAgICAgICAgICAgICAqKlxuICAgICAgICAgICAgICBBbmd1bGFyIExpdmUgRGV2ZWxvcG1lbnQgU2VydmVyIGlzIGxpc3RlbmluZyBvbiAke29wdGlvbnMuaG9zdH06JHtidWlsZEV2ZW50LnBvcnR9LFxuICAgICAgICAgICAgICBvcGVuIHlvdXIgYnJvd3NlciBvbiAke3NlcnZlckFkZHJlc3N9XG4gICAgICAgICAgICAgICoqXG4gICAgICAgICAgICBgICtcbiAgICAgICAgICAgICAgICAnXFxuJyxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLm9wZW4pIHtcbiAgICAgICAgICAgICAgY29uc3Qgb3BlbiA9IChhd2FpdCBpbXBvcnQoJ29wZW4nKSkuZGVmYXVsdDtcbiAgICAgICAgICAgICAgYXdhaXQgb3BlbihzZXJ2ZXJBZGRyZXNzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoYnVpbGRFdmVudC5zdWNjZXNzKSB7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhgXFxuJHtjb2xvcnMuZ3JlZW5CcmlnaHQoY29sb3JzLnN5bWJvbHMuY2hlY2spfSBDb21waWxlZCBzdWNjZXNzZnVsbHkuYCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBcXG4ke2NvbG9ycy5yZWRCcmlnaHQoY29sb3JzLnN5bWJvbHMuY3Jvc3MpfSBGYWlsZWQgdG8gY29tcGlsZS5gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4geyAuLi5idWlsZEV2ZW50LCBiYXNlVXJsOiBzZXJ2ZXJBZGRyZXNzIH0gYXMgRGV2U2VydmVyQnVpbGRlck91dHB1dDtcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH0pLFxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzZXR1cExvY2FsaXplKFxuICBsb2NhbGU6IHN0cmluZyxcbiAgaTE4bjogSTE4bk9wdGlvbnMsXG4gIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgd2VicGFja0NvbmZpZzogd2VicGFjay5Db25maWd1cmF0aW9uLFxuICBjYWNoZU9wdGlvbnM6IE5vcm1hbGl6ZWRDYWNoZWRPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbikge1xuICBjb25zdCBsb2NhbGVEZXNjcmlwdGlvbiA9IGkxOG4ubG9jYWxlc1tsb2NhbGVdO1xuXG4gIC8vIE1vZGlmeSBtYWluIGVudHJ5cG9pbnQgdG8gaW5jbHVkZSBsb2NhbGUgZGF0YVxuICBpZiAoXG4gICAgbG9jYWxlRGVzY3JpcHRpb24/LmRhdGFQYXRoICYmXG4gICAgdHlwZW9mIHdlYnBhY2tDb25maWcuZW50cnkgPT09ICdvYmplY3QnICYmXG4gICAgIUFycmF5LmlzQXJyYXkod2VicGFja0NvbmZpZy5lbnRyeSkgJiZcbiAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ11cbiAgKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkod2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddKSkge1xuICAgICAgd2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddLnVuc2hpZnQobG9jYWxlRGVzY3JpcHRpb24uZGF0YVBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10gPSBbXG4gICAgICAgIGxvY2FsZURlc2NyaXB0aW9uLmRhdGFQYXRoLFxuICAgICAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10gYXMgc3RyaW5nLFxuICAgICAgXTtcbiAgICB9XG4gIH1cblxuICBsZXQgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IgPSBicm93c2VyT3B0aW9ucy5pMThuTWlzc2luZ1RyYW5zbGF0aW9uIHx8ICdpZ25vcmUnO1xuICBsZXQgdHJhbnNsYXRpb24gPSBsb2NhbGVEZXNjcmlwdGlvbj8udHJhbnNsYXRpb24gfHwge307XG5cbiAgaWYgKGxvY2FsZSA9PT0gaTE4bi5zb3VyY2VMb2NhbGUpIHtcbiAgICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvciA9ICdpZ25vcmUnO1xuICAgIHRyYW5zbGF0aW9uID0ge307XG4gIH1cblxuICBjb25zdCBpMThuTG9hZGVyT3B0aW9ucyA9IHtcbiAgICBsb2NhbGUsXG4gICAgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IsXG4gICAgdHJhbnNsYXRpb246IGkxOG4uc2hvdWxkSW5saW5lID8gdHJhbnNsYXRpb24gOiB1bmRlZmluZWQsXG4gICAgdHJhbnNsYXRpb25GaWxlczogbG9jYWxlRGVzY3JpcHRpb24/LmZpbGVzLm1hcCgoZmlsZSkgPT5cbiAgICAgIHBhdGgucmVzb2x2ZShjb250ZXh0LndvcmtzcGFjZVJvb3QsIGZpbGUucGF0aCksXG4gICAgKSxcbiAgfTtcblxuICBjb25zdCBpMThuUnVsZTogd2VicGFjay5SdWxlU2V0UnVsZSA9IHtcbiAgICB0ZXN0OiAvXFwuW2NtXT9bdGpdc3g/JC8sXG4gICAgZW5mb3JjZTogJ3Bvc3QnLFxuICAgIHVzZTogW1xuICAgICAge1xuICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInKSxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIGNhY2hlRGlyZWN0b3J5OlxuICAgICAgICAgICAgKGNhY2hlT3B0aW9ucy5lbmFibGVkICYmIHBhdGguam9pbihjYWNoZU9wdGlvbnMucGF0aCwgJ2JhYmVsLWRldi1zZXJ2ZXItaTE4bicpKSB8fFxuICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgY2FjaGVJZGVudGlmaWVyOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBsb2NhbGUsXG4gICAgICAgICAgICB0cmFuc2xhdGlvbkludGVncml0eTogbG9jYWxlRGVzY3JpcHRpb24/LmZpbGVzLm1hcCgoZmlsZSkgPT4gZmlsZS5pbnRlZ3JpdHkpLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIGkxOG46IGkxOG5Mb2FkZXJPcHRpb25zLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xuXG4gIC8vIEdldCB0aGUgcnVsZXMgYW5kIGVuc3VyZSB0aGUgV2VicGFjayBjb25maWd1cmF0aW9uIGlzIHNldHVwIHByb3Blcmx5XG4gIGNvbnN0IHJ1bGVzID0gd2VicGFja0NvbmZpZy5tb2R1bGU/LnJ1bGVzIHx8IFtdO1xuICBpZiAoIXdlYnBhY2tDb25maWcubW9kdWxlKSB7XG4gICAgd2VicGFja0NvbmZpZy5tb2R1bGUgPSB7IHJ1bGVzIH07XG4gIH0gZWxzZSBpZiAoIXdlYnBhY2tDb25maWcubW9kdWxlLnJ1bGVzKSB7XG4gICAgd2VicGFja0NvbmZpZy5tb2R1bGUucnVsZXMgPSBydWxlcztcbiAgfVxuXG4gIHJ1bGVzLnB1c2goaTE4blJ1bGUpO1xuXG4gIC8vIEFkZCBhIHBsdWdpbiB0byByZWxvYWQgdHJhbnNsYXRpb24gZmlsZXMgb24gcmVidWlsZHNcbiAgY29uc3QgbG9hZGVyID0gYXdhaXQgY3JlYXRlVHJhbnNsYXRpb25Mb2FkZXIoKTtcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgd2VicGFja0NvbmZpZy5wbHVnaW5zIS5wdXNoKHtcbiAgICBhcHBseTogKGNvbXBpbGVyOiB3ZWJwYWNrLkNvbXBpbGVyKSA9PiB7XG4gICAgICBjb21waWxlci5ob29rcy50aGlzQ29tcGlsYXRpb24udGFwKCdidWlsZC1hbmd1bGFyJywgKGNvbXBpbGF0aW9uKSA9PiB7XG4gICAgICAgIGlmIChpMThuLnNob3VsZElubGluZSAmJiBpMThuTG9hZGVyT3B0aW9ucy50cmFuc2xhdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gUmVsb2FkIHRyYW5zbGF0aW9uc1xuICAgICAgICAgIGxvYWRUcmFuc2xhdGlvbnMoXG4gICAgICAgICAgICBsb2NhbGUsXG4gICAgICAgICAgICBsb2NhbGVEZXNjcmlwdGlvbixcbiAgICAgICAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgIGxvYWRlcixcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgd2FybihtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgYWRkV2FybmluZyhjb21waWxhdGlvbiwgbWVzc2FnZSk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGVycm9yKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICBhZGRFcnJvcihjb21waWxhdGlvbiwgbWVzc2FnZSk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgICAgYnJvd3Nlck9wdGlvbnMuaTE4bkR1cGxpY2F0ZVRyYW5zbGF0aW9uLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICBpMThuTG9hZGVyT3B0aW9ucy50cmFuc2xhdGlvbiA9IGxvY2FsZURlc2NyaXB0aW9uLnRyYW5zbGF0aW9uID8/IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29tcGlsYXRpb24uaG9va3MuZmluaXNoTW9kdWxlcy50YXAoJ2J1aWxkLWFuZ3VsYXInLCAoKSA9PiB7XG4gICAgICAgICAgLy8gQWZ0ZXIgbG9hZGVycyBhcmUgZmluaXNoZWQsIGNsZWFyIG91dCB0aGUgbm93IHVubmVlZGVkIHRyYW5zbGF0aW9uc1xuICAgICAgICAgIGkxOG5Mb2FkZXJPcHRpb25zLnRyYW5zbGF0aW9uID0gdW5kZWZpbmVkO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyPERldlNlcnZlckJ1aWxkZXJPcHRpb25zLCBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0PihzZXJ2ZVdlYnBhY2tCcm93c2VyKTtcbiJdfQ==