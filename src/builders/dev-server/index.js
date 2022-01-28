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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
        if (browserOptions.index) {
            const { scripts = [], styles = [], baseHref } = browserOptions;
            const entrypoints = (0, package_chunk_sort_1.generateEntryPoints)({
                scripts,
                styles,
                // The below is needed as otherwise HMR for CSS will break.
                // styles.js and runtime.js needs to be loaded as a non-module scripts as otherwise `document.currentScript` will be null.
                // https://github.com/webpack-contrib/mini-css-extract-plugin/blob/90445dd1d81da0c10b9b0e8a17b417d0651816b8/src/hmr/hotModuleReplacement.js#L39
                isHMREnabled: !!((_c = webpackConfig.devServer) === null || _c === void 0 ? void 0 : _c.hot),
            });
            (_d = webpackConfig.plugins) !== null && _d !== void 0 ? _d : (webpackConfig.plugins = []);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBa0c7QUFDbEcsaUVBSXVDO0FBQ3ZDLCtDQUFrRDtBQUNsRCwyQ0FBNkI7QUFDN0IsK0JBQXdDO0FBQ3hDLDhDQUFzRDtBQUN0RCx5Q0FBMkI7QUFJM0IsdUNBQW9EO0FBQ3BELHVEQUFtRDtBQUNuRCw2Q0FBMkM7QUFDM0MsMkRBQXlFO0FBRXpFLHFFQUF3RTtBQUN4RSxpRUFBNkY7QUFDN0YsdUVBQXFFO0FBQ3JFLHlEQUErRDtBQUMvRCxpREFBcUU7QUFDckUsK0VBSTRDO0FBQzVDLHlFQUF1RTtBQUN2RSxtREFLK0I7QUFDL0IsK0ZBQXlGO0FBQ3pGLHFEQUF5RTtBQUN6RSw4Q0FBa0Y7QUFZbEY7Ozs7Ozs7O0dBUUc7QUFDSCxrREFBa0Q7QUFDbEQsU0FBZ0IsbUJBQW1CLENBQ2pDLE9BQWdDLEVBQ2hDLE9BQXVCLEVBQ3ZCLGFBSUksRUFBRTtJQUVOLHlCQUF5QjtJQUN6QixNQUFNLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxHQUFHLE9BQU8sQ0FBQztJQUMxQyxJQUFBLHdDQUE4QixFQUFDLGFBQWEsQ0FBQyxDQUFDO0lBRTlDLE1BQU0sYUFBYSxHQUFHLElBQUEsa0NBQXNCLEVBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBRXBFLEtBQUssVUFBVSxLQUFLOztRQUtsQixNQUFNLFdBQVcsR0FBRyxNQUFBLE9BQU8sQ0FBQyxNQUFNLDBDQUFFLE9BQU8sQ0FBQztRQUM1QyxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0NBQWdDLENBQUMs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QVcsRUFBRSxPQUFPLENBQUMsQ0FBQzt3QkFDbkMsQ0FBQzt3QkFDRCxLQUFLLENBQUMsT0FBTzs0QkFDWCxJQUFBLDhCQUFRLEVBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO3dCQUNqQyxDQUFDO3FCQUNGLEVBQ0QsU0FBUyxFQUNULGNBQWMsQ0FBQyx3QkFBd0IsQ0FDeEMsQ0FBQztvQkFFRixpQkFBaUIsQ0FBQyxXQUFXLEdBQUcsTUFBQSxpQkFBaUIsQ0FBQyxXQUFXLG1DQUFJLEVBQUUsQ0FBQztpQkFDckU7Z0JBRUQsV0FBVyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxHQUFHLEVBQUU7b0JBQ3hELHNFQUFzRTtvQkFDdEUsaUJBQWlCLENBQUMsV0FBVyxHQUFHLFNBQVMsQ0FBQztnQkFDNUMsQ0FBQyxDQUFDLENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsa0JBQWUsSUFBQSx5QkFBYSxFQUFrRCxtQkFBbUIsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBjcmVhdGVCdWlsZGVyLCB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQge1xuICBEZXZTZXJ2ZXJCdWlsZE91dHB1dCxcbiAgV2VicGFja0xvZ2dpbmdDYWxsYmFjayxcbiAgcnVuV2VicGFja0RldlNlcnZlcixcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLXdlYnBhY2snO1xuaW1wb3J0IHsganNvbiwgdGFncyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBmcm9tIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBjb25jYXRNYXAsIHN3aXRjaE1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHVybCBmcm9tICd1cmwnO1xuaW1wb3J0IHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgd2VicGFja0RldlNlcnZlciBmcm9tICd3ZWJwYWNrLWRldi1zZXJ2ZXInO1xuaW1wb3J0IHsgRXhlY3V0aW9uVHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7IG5vcm1hbGl6ZU9wdGltaXphdGlvbiB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IGNoZWNrUG9ydCB9IGZyb20gJy4uLy4uL3V0aWxzL2NoZWNrLXBvcnQnO1xuaW1wb3J0IHsgY29sb3JzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29sb3InO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMsIGxvYWRUcmFuc2xhdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgSW5kZXhIdG1sVHJhbnNmb3JtIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBjcmVhdGVUcmFuc2xhdGlvbkxvYWRlciB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtdHJhbnNsYXRpb25zJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRDYWNoZWRPcHRpb25zLCBub3JtYWxpemVDYWNoZU9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9ub3JtYWxpemUtY2FjaGUnO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cyB9IGZyb20gJy4uLy4uL3V0aWxzL3BhY2thZ2UtY2h1bmstc29ydCc7XG5pbXBvcnQgeyBwdXJnZVN0YWxlQnVpbGRDYWNoZSB9IGZyb20gJy4uLy4uL3V0aWxzL3B1cmdlLWNhY2hlJztcbmltcG9ydCB7IGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbiB9IGZyb20gJy4uLy4uL3V0aWxzL3ZlcnNpb24nO1xuaW1wb3J0IHtcbiAgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dCxcbiAgZ2V0SW5kZXhJbnB1dEZpbGUsXG4gIGdldEluZGV4T3V0cHV0RmlsZSxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBhZGRFcnJvciwgYWRkV2FybmluZyB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stZGlhZ25vc3RpY3MnO1xuaW1wb3J0IHtcbiAgZ2V0QW5hbHl0aWNzQ29uZmlnLFxuICBnZXRDb21tb25Db25maWcsXG4gIGdldERldlNlcnZlckNvbmZpZyxcbiAgZ2V0U3R5bGVzQ29uZmlnLFxufSBmcm9tICcuLi8uLi93ZWJwYWNrL2NvbmZpZ3MnO1xuaW1wb3J0IHsgSW5kZXhIdG1sV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3dlYnBhY2svcGx1Z2lucy9pbmRleC1odG1sLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZVdlYnBhY2tMb2dnaW5nQ2FsbGJhY2sgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL3N0YXRzJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlclNjaGVtYSwgT3V0cHV0SGFzaGluZyB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IFNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IHR5cGUgRGV2U2VydmVyQnVpbGRlck9wdGlvbnMgPSBTY2hlbWEgJiBqc29uLkpzb25PYmplY3Q7XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyB0eXBlIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgdHlwZSBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0ID0gRGV2U2VydmVyQnVpbGRPdXRwdXQgJiB7XG4gIGJhc2VVcmw6IHN0cmluZztcbn07XG5cbi8qKlxuICogUmV1c2FibGUgaW1wbGVtZW50YXRpb24gb2YgdGhlIEFuZ3VsYXIgV2VicGFjayBkZXZlbG9wbWVudCBzZXJ2ZXIgYnVpbGRlci5cbiAqIEBwYXJhbSBvcHRpb25zIERldiBTZXJ2ZXIgb3B0aW9ucy5cbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBidWlsZCBjb250ZXh0LlxuICogQHBhcmFtIHRyYW5zZm9ybXMgQSBtYXAgb2YgdHJhbnNmb3JtcyB0aGF0IGNhbiBiZSB1c2VkIHRvIGhvb2sgaW50byBzb21lIGxvZ2ljIChzdWNoIGFzXG4gKiAgICAgdHJhbnNmb3JtaW5nIHdlYnBhY2sgY29uZmlndXJhdGlvbiBiZWZvcmUgcGFzc2luZyBpdCB0byB3ZWJwYWNrKS5cbiAqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIHNlcnZlV2VicGFja0Jyb3dzZXIoXG4gIG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgdHJhbnNmb3Jtczoge1xuICAgIHdlYnBhY2tDb25maWd1cmF0aW9uPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8d2VicGFjay5Db25maWd1cmF0aW9uPjtcbiAgICBsb2dnaW5nPzogV2VicGFja0xvZ2dpbmdDYWxsYmFjaztcbiAgICBpbmRleEh0bWw/OiBJbmRleEh0bWxUcmFuc2Zvcm07XG4gIH0gPSB7fSxcbik6IE9ic2VydmFibGU8RGV2U2VydmVyQnVpbGRlck91dHB1dD4ge1xuICAvLyBDaGVjayBBbmd1bGFyIHZlcnNpb24uXG4gIGNvbnN0IHsgbG9nZ2VyLCB3b3Jrc3BhY2VSb290IH0gPSBjb250ZXh0O1xuICBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24od29ya3NwYWNlUm9vdCk7XG5cbiAgY29uc3QgYnJvd3NlclRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5icm93c2VyVGFyZ2V0KTtcblxuICBhc3luYyBmdW5jdGlvbiBzZXR1cCgpOiBQcm9taXNlPHtcbiAgICBicm93c2VyT3B0aW9uczoganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJTY2hlbWE7XG4gICAgd2VicGFja0NvbmZpZzogd2VicGFjay5Db25maWd1cmF0aW9uO1xuICAgIHByb2plY3RSb290OiBzdHJpbmc7XG4gIH0+IHtcbiAgICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0Py5wcm9qZWN0O1xuICAgIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQuJyk7XG4gICAgfVxuXG4gICAgLy8gUHVyZ2Ugb2xkIGJ1aWxkIGRpc2sgY2FjaGUuXG4gICAgYXdhaXQgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUoY29udGV4dCk7XG5cbiAgICBvcHRpb25zLnBvcnQgPSBhd2FpdCBjaGVja1BvcnQob3B0aW9ucy5wb3J0ID8/IDQyMDAsIG9wdGlvbnMuaG9zdCB8fCAnbG9jYWxob3N0Jyk7XG5cbiAgICBpZiAob3B0aW9ucy5obXIpIHtcbiAgICAgIGxvZ2dlci53YXJuKHRhZ3Muc3RyaXBJbmRlbnRzYE5PVElDRTogSG90IE1vZHVsZSBSZXBsYWNlbWVudCAoSE1SKSBpcyBlbmFibGVkIGZvciB0aGUgZGV2IHNlcnZlci5cbiAgICAgIFNlZSBodHRwczovL3dlYnBhY2suanMub3JnL2d1aWRlcy9ob3QtbW9kdWxlLXJlcGxhY2VtZW50IGZvciBpbmZvcm1hdGlvbiBvbiB3b3JraW5nIHdpdGggSE1SIGZvciBXZWJwYWNrLmApO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgICFvcHRpb25zLmRpc2FibGVIb3N0Q2hlY2sgJiZcbiAgICAgIG9wdGlvbnMuaG9zdCAmJlxuICAgICAgIS9eMTI3XFwuXFxkK1xcLlxcZCtcXC5cXGQrL2cudGVzdChvcHRpb25zLmhvc3QpICYmXG4gICAgICBvcHRpb25zLmhvc3QgIT09ICdsb2NhbGhvc3QnXG4gICAgKSB7XG4gICAgICBsb2dnZXIud2Fybih0YWdzLnN0cmlwSW5kZW50YFxuICAgICAgICBXYXJuaW5nOiBUaGlzIGlzIGEgc2ltcGxlIHNlcnZlciBmb3IgdXNlIGluIHRlc3Rpbmcgb3IgZGVidWdnaW5nIEFuZ3VsYXIgYXBwbGljYXRpb25zXG4gICAgICAgIGxvY2FsbHkuIEl0IGhhc24ndCBiZWVuIHJldmlld2VkIGZvciBzZWN1cml0eSBpc3N1ZXMuXG5cbiAgICAgICAgQmluZGluZyB0aGlzIHNlcnZlciB0byBhbiBvcGVuIGNvbm5lY3Rpb24gY2FuIHJlc3VsdCBpbiBjb21wcm9taXNpbmcgeW91ciBhcHBsaWNhdGlvbiBvclxuICAgICAgICBjb21wdXRlci4gVXNpbmcgYSBkaWZmZXJlbnQgaG9zdCB0aGFuIHRoZSBvbmUgcGFzc2VkIHRvIHRoZSBcIi0taG9zdFwiIGZsYWcgbWlnaHQgcmVzdWx0IGluXG4gICAgICAgIHdlYnNvY2tldCBjb25uZWN0aW9uIGlzc3Vlcy4gWW91IG1pZ2h0IG5lZWQgdG8gdXNlIFwiLS1kaXNhYmxlLWhvc3QtY2hlY2tcIiBpZiB0aGF0J3MgdGhlXG4gICAgICAgIGNhc2UuXG4gICAgICBgKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5kaXNhYmxlSG9zdENoZWNrKSB7XG4gICAgICBsb2dnZXIud2Fybih0YWdzLm9uZUxpbmVgXG4gICAgICAgIFdhcm5pbmc6IFJ1bm5pbmcgYSBzZXJ2ZXIgd2l0aCAtLWRpc2FibGUtaG9zdC1jaGVjayBpcyBhIHNlY3VyaXR5IHJpc2suXG4gICAgICAgIFNlZSBodHRwczovL21lZGl1bS5jb20vd2VicGFjay93ZWJwYWNrLWRldi1zZXJ2ZXItbWlkZGxld2FyZS1zZWN1cml0eS1pc3N1ZXMtMTQ4OWQ5NTA4NzRhXG4gICAgICAgIGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICAgICAgYCk7XG4gICAgfVxuICAgIC8vIEdldCB0aGUgYnJvd3NlciBjb25maWd1cmF0aW9uIGZyb20gdGhlIHRhcmdldCBuYW1lLlxuICAgIGNvbnN0IHJhd0Jyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhicm93c2VyVGFyZ2V0KSkgYXMganNvbi5Kc29uT2JqZWN0ICZcbiAgICAgIEJyb3dzZXJCdWlsZGVyU2NoZW1hO1xuXG4gICAgaWYgKHJhd0Jyb3dzZXJPcHRpb25zLm91dHB1dEhhc2hpbmcgJiYgcmF3QnJvd3Nlck9wdGlvbnMub3V0cHV0SGFzaGluZyAhPT0gT3V0cHV0SGFzaGluZy5Ob25lKSB7XG4gICAgICAvLyBEaXNhYmxlIG91dHB1dCBoYXNoaW5nIGZvciBkZXYgYnVpbGQgYXMgdGhpcyBjYW4gY2F1c2UgbWVtb3J5IGxlYWtzXG4gICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LXNlcnZlci9pc3N1ZXMvMzc3I2lzc3VlY29tbWVudC0yNDEyNTg0MDVcbiAgICAgIHJhd0Jyb3dzZXJPcHRpb25zLm91dHB1dEhhc2hpbmcgPSBPdXRwdXRIYXNoaW5nLk5vbmU7XG4gICAgICBsb2dnZXIud2FybihgV2FybmluZzogJ291dHB1dEhhc2hpbmcnIG9wdGlvbiBpcyBkaXNhYmxlZCB3aGVuIHVzaW5nIHRoZSBkZXYtc2VydmVyLmApO1xuICAgIH1cblxuICAgIGNvbnN0IG1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICAgIGNvbnN0IGNhY2hlT3B0aW9ucyA9IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyhtZXRhZGF0YSwgY29udGV4dC53b3Jrc3BhY2VSb290KTtcblxuICAgIGNvbnN0IGJyb3dzZXJOYW1lID0gYXdhaXQgY29udGV4dC5nZXRCdWlsZGVyTmFtZUZvclRhcmdldChicm93c2VyVGFyZ2V0KTtcbiAgICBjb25zdCBicm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LnZhbGlkYXRlT3B0aW9ucyhcbiAgICAgIHtcbiAgICAgICAgLi4ucmF3QnJvd3Nlck9wdGlvbnMsXG4gICAgICAgIHdhdGNoOiBvcHRpb25zLndhdGNoLFxuICAgICAgICB2ZXJib3NlOiBvcHRpb25zLnZlcmJvc2UsXG4gICAgICAgIC8vIEluIGRldiBzZXJ2ZXIgd2Ugc2hvdWxkIG5vdCBoYXZlIGJ1ZGdldHMgYmVjYXVzZSBvZiBleHRyYSBsaWJzIHN1Y2ggYXMgc29ja3MtanNcbiAgICAgICAgYnVkZ2V0czogdW5kZWZpbmVkLFxuICAgICAgfSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgICAgIGJyb3dzZXJOYW1lLFxuICAgICkpIGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyU2NoZW1hO1xuXG4gICAgY29uc3QgeyBzdHlsZXMsIHNjcmlwdHMgfSA9IG5vcm1hbGl6ZU9wdGltaXphdGlvbihicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24pO1xuICAgIGlmIChzY3JpcHRzIHx8IHN0eWxlcy5taW5pZnkpIHtcbiAgICAgIGxvZ2dlci5lcnJvcih0YWdzLnN0cmlwSW5kZW50c2BcbiAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBUaGlzIGlzIGEgc2ltcGxlIHNlcnZlciBmb3IgdXNlIGluIHRlc3Rpbmcgb3IgZGVidWdnaW5nIEFuZ3VsYXIgYXBwbGljYXRpb25zIGxvY2FsbHkuXG4gICAgICAgIEl0IGhhc24ndCBiZWVuIHJldmlld2VkIGZvciBzZWN1cml0eSBpc3N1ZXMuXG5cbiAgICAgICAgRE9OJ1QgVVNFIElUIEZPUiBQUk9EVUNUSU9OIVxuICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICBgKTtcbiAgICB9XG5cbiAgICBjb25zdCB7IGNvbmZpZywgcHJvamVjdFJvb3QsIGkxOG4gfSA9IGF3YWl0IGdlbmVyYXRlSTE4bkJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQoXG4gICAgICBicm93c2VyT3B0aW9ucyxcbiAgICAgIGNvbnRleHQsXG4gICAgICAod2NvKSA9PiBbXG4gICAgICAgIGdldERldlNlcnZlckNvbmZpZyh3Y28pLFxuICAgICAgICBnZXRDb21tb25Db25maWcod2NvKSxcbiAgICAgICAgZ2V0U3R5bGVzQ29uZmlnKHdjbyksXG4gICAgICAgIGdldEFuYWx5dGljc0NvbmZpZyh3Y28sIGNvbnRleHQpLFxuICAgICAgXSxcbiAgICAgIG9wdGlvbnMsXG4gICAgKTtcblxuICAgIGlmICghY29uZmlnLmRldlNlcnZlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdXZWJwYWNrIERldiBTZXJ2ZXIgY29uZmlndXJhdGlvbiB3YXMgbm90IHNldC4nKTtcbiAgICB9XG5cbiAgICBsZXQgbG9jYWxlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgaWYgKGkxOG4uc2hvdWxkSW5saW5lKSB7XG4gICAgICAvLyBEZXYtc2VydmVyIG9ubHkgc3VwcG9ydHMgb25lIGxvY2FsZVxuICAgICAgbG9jYWxlID0gWy4uLmkxOG4uaW5saW5lTG9jYWxlc11bMF07XG4gICAgfSBlbHNlIGlmIChpMThuLmhhc0RlZmluZWRTb3VyY2VMb2NhbGUpIHtcbiAgICAgIC8vIHVzZSBzb3VyY2UgbG9jYWxlIGlmIG5vdCBsb2NhbGl6aW5nXG4gICAgICBsb2NhbGUgPSBpMThuLnNvdXJjZUxvY2FsZTtcbiAgICB9XG5cbiAgICBsZXQgd2VicGFja0NvbmZpZyA9IGNvbmZpZztcblxuICAgIC8vIElmIGEgbG9jYWxlIGlzIGRlZmluZWQsIHNldHVwIGxvY2FsaXphdGlvblxuICAgIGlmIChsb2NhbGUpIHtcbiAgICAgIGlmIChpMThuLmlubGluZUxvY2FsZXMuc2l6ZSA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdUaGUgZGV2ZWxvcG1lbnQgc2VydmVyIG9ubHkgc3VwcG9ydHMgbG9jYWxpemluZyBhIHNpbmdsZSBsb2NhbGUgcGVyIGJ1aWxkLicsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHNldHVwTG9jYWxpemUobG9jYWxlLCBpMThuLCBicm93c2VyT3B0aW9ucywgd2VicGFja0NvbmZpZywgY2FjaGVPcHRpb25zLCBjb250ZXh0KTtcbiAgICB9XG5cbiAgICBpZiAodHJhbnNmb3Jtcy53ZWJwYWNrQ29uZmlndXJhdGlvbikge1xuICAgICAgd2VicGFja0NvbmZpZyA9IGF3YWl0IHRyYW5zZm9ybXMud2VicGFja0NvbmZpZ3VyYXRpb24od2VicGFja0NvbmZpZyk7XG4gICAgfVxuXG4gICAgaWYgKGJyb3dzZXJPcHRpb25zLmluZGV4KSB7XG4gICAgICBjb25zdCB7IHNjcmlwdHMgPSBbXSwgc3R5bGVzID0gW10sIGJhc2VIcmVmIH0gPSBicm93c2VyT3B0aW9ucztcbiAgICAgIGNvbnN0IGVudHJ5cG9pbnRzID0gZ2VuZXJhdGVFbnRyeVBvaW50cyh7XG4gICAgICAgIHNjcmlwdHMsXG4gICAgICAgIHN0eWxlcyxcbiAgICAgICAgLy8gVGhlIGJlbG93IGlzIG5lZWRlZCBhcyBvdGhlcndpc2UgSE1SIGZvciBDU1Mgd2lsbCBicmVhay5cbiAgICAgICAgLy8gc3R5bGVzLmpzIGFuZCBydW50aW1lLmpzIG5lZWRzIHRvIGJlIGxvYWRlZCBhcyBhIG5vbi1tb2R1bGUgc2NyaXB0cyBhcyBvdGhlcndpc2UgYGRvY3VtZW50LmN1cnJlbnRTY3JpcHRgIHdpbGwgYmUgbnVsbC5cbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9taW5pLWNzcy1leHRyYWN0LXBsdWdpbi9ibG9iLzkwNDQ1ZGQxZDgxZGEwYzEwYjliMGU4YTE3YjQxN2QwNjUxODE2Yjgvc3JjL2htci9ob3RNb2R1bGVSZXBsYWNlbWVudC5qcyNMMzlcbiAgICAgICAgaXNITVJFbmFibGVkOiAhIXdlYnBhY2tDb25maWcuZGV2U2VydmVyPy5ob3QsXG4gICAgICB9KTtcblxuICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zID8/PSBbXTtcbiAgICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy5wdXNoKFxuICAgICAgICBuZXcgSW5kZXhIdG1sV2VicGFja1BsdWdpbih7XG4gICAgICAgICAgaW5kZXhQYXRoOiBwYXRoLnJlc29sdmUod29ya3NwYWNlUm9vdCwgZ2V0SW5kZXhJbnB1dEZpbGUoYnJvd3Nlck9wdGlvbnMuaW5kZXgpKSxcbiAgICAgICAgICBvdXRwdXRQYXRoOiBnZXRJbmRleE91dHB1dEZpbGUoYnJvd3Nlck9wdGlvbnMuaW5kZXgpLFxuICAgICAgICAgIGJhc2VIcmVmLFxuICAgICAgICAgIGVudHJ5cG9pbnRzLFxuICAgICAgICAgIGRlcGxveVVybDogYnJvd3Nlck9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgICAgIHNyaTogYnJvd3Nlck9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgICAgICAgY2FjaGU6IGNhY2hlT3B0aW9ucyxcbiAgICAgICAgICBwb3N0VHJhbnNmb3JtOiB0cmFuc2Zvcm1zLmluZGV4SHRtbCxcbiAgICAgICAgICBvcHRpbWl6YXRpb246IG5vcm1hbGl6ZU9wdGltaXphdGlvbihicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24pLFxuICAgICAgICAgIGNyb3NzT3JpZ2luOiBicm93c2VyT3B0aW9ucy5jcm9zc09yaWdpbixcbiAgICAgICAgICBsYW5nOiBsb2NhbGUsXG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgYnJvd3Nlck9wdGlvbnMsXG4gICAgICB3ZWJwYWNrQ29uZmlnLFxuICAgICAgcHJvamVjdFJvb3QsXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiBmcm9tKHNldHVwKCkpLnBpcGUoXG4gICAgc3dpdGNoTWFwKCh7IGJyb3dzZXJPcHRpb25zLCB3ZWJwYWNrQ29uZmlnIH0pID0+IHtcbiAgICAgIHJldHVybiBydW5XZWJwYWNrRGV2U2VydmVyKHdlYnBhY2tDb25maWcsIGNvbnRleHQsIHtcbiAgICAgICAgbG9nZ2luZzogdHJhbnNmb3Jtcy5sb2dnaW5nIHx8IGNyZWF0ZVdlYnBhY2tMb2dnaW5nQ2FsbGJhY2soYnJvd3Nlck9wdGlvbnMsIGxvZ2dlciksXG4gICAgICAgIHdlYnBhY2tGYWN0b3J5OiByZXF1aXJlKCd3ZWJwYWNrJykgYXMgdHlwZW9mIHdlYnBhY2ssXG4gICAgICAgIHdlYnBhY2tEZXZTZXJ2ZXJGYWN0b3J5OiByZXF1aXJlKCd3ZWJwYWNrLWRldi1zZXJ2ZXInKSBhcyB0eXBlb2Ygd2VicGFja0RldlNlcnZlcixcbiAgICAgIH0pLnBpcGUoXG4gICAgICAgIGNvbmNhdE1hcChhc3luYyAoYnVpbGRFdmVudCwgaW5kZXgpID0+IHtcbiAgICAgICAgICAvLyBSZXNvbHZlIHNlcnZlIGFkZHJlc3MuXG4gICAgICAgICAgY29uc3QgcHVibGljUGF0aCA9IHdlYnBhY2tDb25maWcuZGV2U2VydmVyPy5kZXZNaWRkbGV3YXJlPy5wdWJsaWNQYXRoO1xuXG4gICAgICAgICAgY29uc3Qgc2VydmVyQWRkcmVzcyA9IHVybC5mb3JtYXQoe1xuICAgICAgICAgICAgcHJvdG9jb2w6IG9wdGlvbnMuc3NsID8gJ2h0dHBzJyA6ICdodHRwJyxcbiAgICAgICAgICAgIGhvc3RuYW1lOiBvcHRpb25zLmhvc3QgPT09ICcwLjAuMC4wJyA/ICdsb2NhbGhvc3QnIDogb3B0aW9ucy5ob3N0LFxuICAgICAgICAgICAgcG9ydDogYnVpbGRFdmVudC5wb3J0LFxuICAgICAgICAgICAgcGF0aG5hbWU6IHR5cGVvZiBwdWJsaWNQYXRoID09PSAnc3RyaW5nJyA/IHB1YmxpY1BhdGggOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBpZiAoaW5kZXggPT09IDApIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKFxuICAgICAgICAgICAgICAnXFxuJyArXG4gICAgICAgICAgICAgICAgdGFncy5vbmVMaW5lYFxuICAgICAgICAgICAgICAqKlxuICAgICAgICAgICAgICBBbmd1bGFyIExpdmUgRGV2ZWxvcG1lbnQgU2VydmVyIGlzIGxpc3RlbmluZyBvbiAke29wdGlvbnMuaG9zdH06JHtidWlsZEV2ZW50LnBvcnR9LFxuICAgICAgICAgICAgICBvcGVuIHlvdXIgYnJvd3NlciBvbiAke3NlcnZlckFkZHJlc3N9XG4gICAgICAgICAgICAgICoqXG4gICAgICAgICAgICBgICtcbiAgICAgICAgICAgICAgICAnXFxuJyxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLm9wZW4pIHtcbiAgICAgICAgICAgICAgY29uc3Qgb3BlbiA9IChhd2FpdCBpbXBvcnQoJ29wZW4nKSkuZGVmYXVsdDtcbiAgICAgICAgICAgICAgYXdhaXQgb3BlbihzZXJ2ZXJBZGRyZXNzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoYnVpbGRFdmVudC5zdWNjZXNzKSB7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhgXFxuJHtjb2xvcnMuZ3JlZW5CcmlnaHQoY29sb3JzLnN5bWJvbHMuY2hlY2spfSBDb21waWxlZCBzdWNjZXNzZnVsbHkuYCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBcXG4ke2NvbG9ycy5yZWRCcmlnaHQoY29sb3JzLnN5bWJvbHMuY3Jvc3MpfSBGYWlsZWQgdG8gY29tcGlsZS5gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4geyAuLi5idWlsZEV2ZW50LCBiYXNlVXJsOiBzZXJ2ZXJBZGRyZXNzIH0gYXMgRGV2U2VydmVyQnVpbGRlck91dHB1dDtcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH0pLFxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzZXR1cExvY2FsaXplKFxuICBsb2NhbGU6IHN0cmluZyxcbiAgaTE4bjogSTE4bk9wdGlvbnMsXG4gIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgd2VicGFja0NvbmZpZzogd2VicGFjay5Db25maWd1cmF0aW9uLFxuICBjYWNoZU9wdGlvbnM6IE5vcm1hbGl6ZWRDYWNoZWRPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbikge1xuICBjb25zdCBsb2NhbGVEZXNjcmlwdGlvbiA9IGkxOG4ubG9jYWxlc1tsb2NhbGVdO1xuXG4gIC8vIE1vZGlmeSBtYWluIGVudHJ5cG9pbnQgdG8gaW5jbHVkZSBsb2NhbGUgZGF0YVxuICBpZiAoXG4gICAgbG9jYWxlRGVzY3JpcHRpb24/LmRhdGFQYXRoICYmXG4gICAgdHlwZW9mIHdlYnBhY2tDb25maWcuZW50cnkgPT09ICdvYmplY3QnICYmXG4gICAgIUFycmF5LmlzQXJyYXkod2VicGFja0NvbmZpZy5lbnRyeSkgJiZcbiAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ11cbiAgKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkod2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddKSkge1xuICAgICAgd2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddLnVuc2hpZnQobG9jYWxlRGVzY3JpcHRpb24uZGF0YVBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10gPSBbXG4gICAgICAgIGxvY2FsZURlc2NyaXB0aW9uLmRhdGFQYXRoLFxuICAgICAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10gYXMgc3RyaW5nLFxuICAgICAgXTtcbiAgICB9XG4gIH1cblxuICBsZXQgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IgPSBicm93c2VyT3B0aW9ucy5pMThuTWlzc2luZ1RyYW5zbGF0aW9uIHx8ICdpZ25vcmUnO1xuICBsZXQgdHJhbnNsYXRpb24gPSBsb2NhbGVEZXNjcmlwdGlvbj8udHJhbnNsYXRpb24gfHwge307XG5cbiAgaWYgKGxvY2FsZSA9PT0gaTE4bi5zb3VyY2VMb2NhbGUpIHtcbiAgICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvciA9ICdpZ25vcmUnO1xuICAgIHRyYW5zbGF0aW9uID0ge307XG4gIH1cblxuICBjb25zdCBpMThuTG9hZGVyT3B0aW9ucyA9IHtcbiAgICBsb2NhbGUsXG4gICAgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IsXG4gICAgdHJhbnNsYXRpb246IGkxOG4uc2hvdWxkSW5saW5lID8gdHJhbnNsYXRpb24gOiB1bmRlZmluZWQsXG4gICAgdHJhbnNsYXRpb25GaWxlczogbG9jYWxlRGVzY3JpcHRpb24/LmZpbGVzLm1hcCgoZmlsZSkgPT5cbiAgICAgIHBhdGgucmVzb2x2ZShjb250ZXh0LndvcmtzcGFjZVJvb3QsIGZpbGUucGF0aCksXG4gICAgKSxcbiAgfTtcblxuICBjb25zdCBpMThuUnVsZTogd2VicGFjay5SdWxlU2V0UnVsZSA9IHtcbiAgICB0ZXN0OiAvXFwuW2NtXT9bdGpdc3g/JC8sXG4gICAgZW5mb3JjZTogJ3Bvc3QnLFxuICAgIHVzZTogW1xuICAgICAge1xuICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInKSxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIGNhY2hlRGlyZWN0b3J5OlxuICAgICAgICAgICAgKGNhY2hlT3B0aW9ucy5lbmFibGVkICYmIHBhdGguam9pbihjYWNoZU9wdGlvbnMucGF0aCwgJ2JhYmVsLWRldi1zZXJ2ZXItaTE4bicpKSB8fFxuICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgY2FjaGVJZGVudGlmaWVyOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBsb2NhbGUsXG4gICAgICAgICAgICB0cmFuc2xhdGlvbkludGVncml0eTogbG9jYWxlRGVzY3JpcHRpb24/LmZpbGVzLm1hcCgoZmlsZSkgPT4gZmlsZS5pbnRlZ3JpdHkpLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIGkxOG46IGkxOG5Mb2FkZXJPcHRpb25zLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xuXG4gIC8vIEdldCB0aGUgcnVsZXMgYW5kIGVuc3VyZSB0aGUgV2VicGFjayBjb25maWd1cmF0aW9uIGlzIHNldHVwIHByb3Blcmx5XG4gIGNvbnN0IHJ1bGVzID0gd2VicGFja0NvbmZpZy5tb2R1bGU/LnJ1bGVzIHx8IFtdO1xuICBpZiAoIXdlYnBhY2tDb25maWcubW9kdWxlKSB7XG4gICAgd2VicGFja0NvbmZpZy5tb2R1bGUgPSB7IHJ1bGVzIH07XG4gIH0gZWxzZSBpZiAoIXdlYnBhY2tDb25maWcubW9kdWxlLnJ1bGVzKSB7XG4gICAgd2VicGFja0NvbmZpZy5tb2R1bGUucnVsZXMgPSBydWxlcztcbiAgfVxuXG4gIHJ1bGVzLnB1c2goaTE4blJ1bGUpO1xuXG4gIC8vIEFkZCBhIHBsdWdpbiB0byByZWxvYWQgdHJhbnNsYXRpb24gZmlsZXMgb24gcmVidWlsZHNcbiAgY29uc3QgbG9hZGVyID0gYXdhaXQgY3JlYXRlVHJhbnNsYXRpb25Mb2FkZXIoKTtcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgd2VicGFja0NvbmZpZy5wbHVnaW5zIS5wdXNoKHtcbiAgICBhcHBseTogKGNvbXBpbGVyOiB3ZWJwYWNrLkNvbXBpbGVyKSA9PiB7XG4gICAgICBjb21waWxlci5ob29rcy50aGlzQ29tcGlsYXRpb24udGFwKCdidWlsZC1hbmd1bGFyJywgKGNvbXBpbGF0aW9uKSA9PiB7XG4gICAgICAgIGlmIChpMThuLnNob3VsZElubGluZSAmJiBpMThuTG9hZGVyT3B0aW9ucy50cmFuc2xhdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gUmVsb2FkIHRyYW5zbGF0aW9uc1xuICAgICAgICAgIGxvYWRUcmFuc2xhdGlvbnMoXG4gICAgICAgICAgICBsb2NhbGUsXG4gICAgICAgICAgICBsb2NhbGVEZXNjcmlwdGlvbixcbiAgICAgICAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgIGxvYWRlcixcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgd2FybihtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgYWRkV2FybmluZyhjb21waWxhdGlvbiwgbWVzc2FnZSk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGVycm9yKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICBhZGRFcnJvcihjb21waWxhdGlvbiwgbWVzc2FnZSk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgICAgYnJvd3Nlck9wdGlvbnMuaTE4bkR1cGxpY2F0ZVRyYW5zbGF0aW9uLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICBpMThuTG9hZGVyT3B0aW9ucy50cmFuc2xhdGlvbiA9IGxvY2FsZURlc2NyaXB0aW9uLnRyYW5zbGF0aW9uID8/IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29tcGlsYXRpb24uaG9va3MuZmluaXNoTW9kdWxlcy50YXAoJ2J1aWxkLWFuZ3VsYXInLCAoKSA9PiB7XG4gICAgICAgICAgLy8gQWZ0ZXIgbG9hZGVycyBhcmUgZmluaXNoZWQsIGNsZWFyIG91dCB0aGUgbm93IHVubmVlZGVkIHRyYW5zbGF0aW9uc1xuICAgICAgICAgIGkxOG5Mb2FkZXJPcHRpb25zLnRyYW5zbGF0aW9uID0gdW5kZWZpbmVkO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyPERldlNlcnZlckJ1aWxkZXJPcHRpb25zLCBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0PihzZXJ2ZVdlYnBhY2tCcm93c2VyKTtcbiJdfQ==