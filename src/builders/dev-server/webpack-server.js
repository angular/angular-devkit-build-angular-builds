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
const build_webpack_1 = require("@angular-devkit/build-webpack");
const core_1 = require("@angular-devkit/core");
const path = __importStar(require("path"));
const rxjs_1 = require("rxjs");
const url = __importStar(require("url"));
const configs_1 = require("../../tools/webpack/configs");
const index_html_webpack_plugin_1 = require("../../tools/webpack/plugins/index-html-webpack-plugin");
const service_worker_plugin_1 = require("../../tools/webpack/plugins/service-worker-plugin");
const stats_1 = require("../../tools/webpack/utils/stats");
const utils_1 = require("../../utils");
const color_1 = require("../../utils/color");
const i18n_options_1 = require("../../utils/i18n-options");
const load_translations_1 = require("../../utils/load-translations");
const package_chunk_sort_1 = require("../../utils/package-chunk-sort");
const version_1 = require("../../utils/version");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const webpack_diagnostics_1 = require("../../utils/webpack-diagnostics");
const schema_1 = require("../browser/schema");
/**
 * Reusable implementation of the Angular Webpack development server builder.
 * @param options Dev Server options.
 * @param builderName The name of the builder used to build the application.
 * @param context The build context.
 * @param transforms A map of transforms that can be used to hook into some logic (such as
 *     transforming webpack configuration before passing it to webpack).
 */
// eslint-disable-next-line max-lines-per-function
function serveWebpackBrowser(options, builderName, context, transforms = {}) {
    // Check Angular version.
    const { logger, workspaceRoot } = context;
    (0, version_1.assertCompatibleAngularVersion)(workspaceRoot);
    async function setup() {
        if (options.hmr) {
            logger.warn(core_1.tags.stripIndents `NOTICE: Hot Module Replacement (HMR) is enabled for the dev server.
      See https://webpack.js.org/guides/hot-module-replacement for information on working with HMR for Webpack.`);
        }
        // Get the browser configuration from the target name.
        const rawBrowserOptions = (await context.getTargetOptions(options.buildTarget));
        if (rawBrowserOptions.outputHashing && rawBrowserOptions.outputHashing !== schema_1.OutputHashing.None) {
            // Disable output hashing for dev build as this can cause memory leaks
            // See: https://github.com/webpack/webpack-dev-server/issues/377#issuecomment-241258405
            rawBrowserOptions.outputHashing = schema_1.OutputHashing.None;
            logger.warn(`Warning: 'outputHashing' option is disabled when using the dev-server.`);
        }
        const browserOptions = (await context.validateOptions({
            ...rawBrowserOptions,
            watch: options.watch,
            verbose: options.verbose,
            // In dev server we should not have budgets because of extra libs such as socks-js
            budgets: undefined,
        }, builderName));
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
        const { config, i18n } = await (0, webpack_browser_config_1.generateI18nBrowserWebpackConfigFromContext)(browserOptions, context, (wco) => [(0, configs_1.getDevServerConfig)(wco), (0, configs_1.getCommonConfig)(wco), (0, configs_1.getStylesConfig)(wco)], options);
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
            await setupLocalize(locale, i18n, browserOptions, webpackConfig, options.cacheOptions, context);
        }
        if (transforms.webpackConfiguration) {
            webpackConfig = await transforms.webpackConfiguration(webpackConfig);
        }
        webpackConfig.plugins ??= [];
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
                cache: options.cacheOptions,
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
                projectRoot: options.projectRoot,
                ngswConfigPath: browserOptions.ngswConfigPath,
            }));
        }
        return {
            browserOptions,
            webpackConfig,
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
                loader: require.resolve('../../tools/babel/webpack-loader'),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2VicGFjay1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3dlYnBhY2stc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gsaUVBSXVDO0FBQ3ZDLCtDQUFrRDtBQUNsRCwyQ0FBNkI7QUFDN0IsK0JBQThEO0FBQzlELHlDQUEyQjtBQUczQix5REFBbUc7QUFDbkcscUdBQStGO0FBQy9GLDZGQUF3RjtBQUN4RiwyREFJeUM7QUFFekMsdUNBQW9EO0FBQ3BELDZDQUEyQztBQUMzQywyREFBeUU7QUFFekUscUVBQXdFO0FBRXhFLHVFQUFxRTtBQUNyRSxpREFBcUU7QUFDckUsK0VBSTRDO0FBQzVDLHlFQUF1RTtBQUN2RSw4Q0FBa0Y7QUFXbEY7Ozs7Ozs7R0FPRztBQUNILGtEQUFrRDtBQUNsRCxTQUFnQixtQkFBbUIsQ0FDakMsT0FBbUMsRUFDbkMsV0FBbUIsRUFDbkIsT0FBdUIsRUFDdkIsYUFJSSxFQUFFO0lBRU4seUJBQXlCO0lBQ3pCLE1BQU0sRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLEdBQUcsT0FBTyxDQUFDO0lBQzFDLElBQUEsd0NBQThCLEVBQUMsYUFBYSxDQUFDLENBQUM7SUFFOUMsS0FBSyxVQUFVLEtBQUs7UUFJbEIsSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFO1lBQ2YsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFJLENBQUMsWUFBWSxDQUFBO2dIQUM2RSxDQUFDLENBQUM7U0FDN0c7UUFFRCxzREFBc0Q7UUFDdEQsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUN2RCxPQUFPLENBQUMsV0FBVyxDQUNwQixDQUEyQyxDQUFDO1FBRTdD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QUksQ0FBQyxZQUFZLElBQUksaUJBQWlCLENBQUMsV0FBVyxLQUFLLFNBQVMsRUFBRTtvQkFDcEUsc0JBQXNCO29CQUN0QixJQUFBLCtCQUFnQixFQUNkLE1BQU0sRUFDTixpQkFBaUIsRUFDakIsT0FBTyxDQUFDLGFBQWEsRUFDckIsTUFBTSxFQUNOO3dCQUNFLElBQUksQ0FBQyxPQUFPOzRCQUNWLElBQUEsZ0NBQVUsRUFBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7d0JBQ25DLENBQUM7d0JBQ0QsS0FBSyxDQUFDLE9BQU87NEJBQ1gsSUFBQSw4QkFBUSxFQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQzt3QkFDakMsQ0FBQztxQkFDRixFQUNELFNBQVMsRUFDVCxjQUFjLENBQUMsd0JBQXdCLENBQ3hDLENBQUM7b0JBRUYsaUJBQWlCLENBQUMsV0FBVyxHQUFHLGlCQUFpQixDQUFDLFdBQVcsSUFBSSxFQUFFLENBQUM7aUJBQ3JFO2dCQUVELFdBQVcsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsR0FBRyxFQUFFO29CQUN4RCxzRUFBc0U7b0JBQ3RFLGlCQUFpQixDQUFDLFdBQVcsR0FBRyxTQUFTLENBQUM7Z0JBQzVDLENBQUMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0tBQ0YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHtcbiAgRGV2U2VydmVyQnVpbGRPdXRwdXQsXG4gIFdlYnBhY2tMb2dnaW5nQ2FsbGJhY2ssXG4gIHJ1bldlYnBhY2tEZXZTZXJ2ZXIsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJztcbmltcG9ydCB7IGpzb24sIHRhZ3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgY29uY2F0TWFwLCBmcm9tLCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzJztcbmltcG9ydCAqIGFzIHVybCBmcm9tICd1cmwnO1xuaW1wb3J0IHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgd2VicGFja0RldlNlcnZlciBmcm9tICd3ZWJwYWNrLWRldi1zZXJ2ZXInO1xuaW1wb3J0IHsgZ2V0Q29tbW9uQ29uZmlnLCBnZXREZXZTZXJ2ZXJDb25maWcsIGdldFN0eWxlc0NvbmZpZyB9IGZyb20gJy4uLy4uL3Rvb2xzL3dlYnBhY2svY29uZmlncyc7XG5pbXBvcnQgeyBJbmRleEh0bWxXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vdG9vbHMvd2VicGFjay9wbHVnaW5zL2luZGV4LWh0bWwtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgU2VydmljZVdvcmtlclBsdWdpbiB9IGZyb20gJy4uLy4uL3Rvb2xzL3dlYnBhY2svcGx1Z2lucy9zZXJ2aWNlLXdvcmtlci1wbHVnaW4nO1xuaW1wb3J0IHtcbiAgQnVpbGRFdmVudFN0YXRzLFxuICBjcmVhdGVXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrLFxuICBnZW5lcmF0ZUJ1aWxkRXZlbnRTdGF0cyxcbn0gZnJvbSAnLi4vLi4vdG9vbHMvd2VicGFjay91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBFeGVjdXRpb25UcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHsgbm9ybWFsaXplT3B0aW1pemF0aW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgY29sb3JzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29sb3InO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMsIGxvYWRUcmFuc2xhdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgSW5kZXhIdG1sVHJhbnNmb3JtIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBjcmVhdGVUcmFuc2xhdGlvbkxvYWRlciB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtdHJhbnNsYXRpb25zJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRDYWNoZWRPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvbm9ybWFsaXplLWNhY2hlJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMgfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvdmVyc2lvbic7XG5pbXBvcnQge1xuICBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0LFxuICBnZXRJbmRleElucHV0RmlsZSxcbiAgZ2V0SW5kZXhPdXRwdXRGaWxlLFxufSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IGFkZEVycm9yLCBhZGRXYXJuaW5nIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1kaWFnbm9zdGljcyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJTY2hlbWEsIE91dHB1dEhhc2hpbmcgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyB0eXBlIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgdHlwZSBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0ID0gRGV2U2VydmVyQnVpbGRPdXRwdXQgJiB7XG4gIGJhc2VVcmw6IHN0cmluZztcbiAgc3RhdHM6IEJ1aWxkRXZlbnRTdGF0cztcbn07XG5cbi8qKlxuICogUmV1c2FibGUgaW1wbGVtZW50YXRpb24gb2YgdGhlIEFuZ3VsYXIgV2VicGFjayBkZXZlbG9wbWVudCBzZXJ2ZXIgYnVpbGRlci5cbiAqIEBwYXJhbSBvcHRpb25zIERldiBTZXJ2ZXIgb3B0aW9ucy5cbiAqIEBwYXJhbSBidWlsZGVyTmFtZSBUaGUgbmFtZSBvZiB0aGUgYnVpbGRlciB1c2VkIHRvIGJ1aWxkIHRoZSBhcHBsaWNhdGlvbi5cbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBidWlsZCBjb250ZXh0LlxuICogQHBhcmFtIHRyYW5zZm9ybXMgQSBtYXAgb2YgdHJhbnNmb3JtcyB0aGF0IGNhbiBiZSB1c2VkIHRvIGhvb2sgaW50byBzb21lIGxvZ2ljIChzdWNoIGFzXG4gKiAgICAgdHJhbnNmb3JtaW5nIHdlYnBhY2sgY29uZmlndXJhdGlvbiBiZWZvcmUgcGFzc2luZyBpdCB0byB3ZWJwYWNrKS5cbiAqL1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBzZXJ2ZVdlYnBhY2tCcm93c2VyKFxuICBvcHRpb25zOiBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyxcbiAgYnVpbGRlck5hbWU6IHN0cmluZyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHRyYW5zZm9ybXM6IHtcbiAgICB3ZWJwYWNrQ29uZmlndXJhdGlvbj86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPHdlYnBhY2suQ29uZmlndXJhdGlvbj47XG4gICAgbG9nZ2luZz86IFdlYnBhY2tMb2dnaW5nQ2FsbGJhY2s7XG4gICAgaW5kZXhIdG1sPzogSW5kZXhIdG1sVHJhbnNmb3JtO1xuICB9ID0ge30sXG4pOiBPYnNlcnZhYmxlPERldlNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gQ2hlY2sgQW5ndWxhciB2ZXJzaW9uLlxuICBjb25zdCB7IGxvZ2dlciwgd29ya3NwYWNlUm9vdCB9ID0gY29udGV4dDtcbiAgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uKHdvcmtzcGFjZVJvb3QpO1xuXG4gIGFzeW5jIGZ1bmN0aW9uIHNldHVwKCk6IFByb21pc2U8e1xuICAgIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYTtcbiAgICB3ZWJwYWNrQ29uZmlnOiB3ZWJwYWNrLkNvbmZpZ3VyYXRpb247XG4gIH0+IHtcbiAgICBpZiAob3B0aW9ucy5obXIpIHtcbiAgICAgIGxvZ2dlci53YXJuKHRhZ3Muc3RyaXBJbmRlbnRzYE5PVElDRTogSG90IE1vZHVsZSBSZXBsYWNlbWVudCAoSE1SKSBpcyBlbmFibGVkIGZvciB0aGUgZGV2IHNlcnZlci5cbiAgICAgIFNlZSBodHRwczovL3dlYnBhY2suanMub3JnL2d1aWRlcy9ob3QtbW9kdWxlLXJlcGxhY2VtZW50IGZvciBpbmZvcm1hdGlvbiBvbiB3b3JraW5nIHdpdGggSE1SIGZvciBXZWJwYWNrLmApO1xuICAgIH1cblxuICAgIC8vIEdldCB0aGUgYnJvd3NlciBjb25maWd1cmF0aW9uIGZyb20gdGhlIHRhcmdldCBuYW1lLlxuICAgIGNvbnN0IHJhd0Jyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhcbiAgICAgIG9wdGlvbnMuYnVpbGRUYXJnZXQsXG4gICAgKSkgYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJTY2hlbWE7XG5cbiAgICBpZiAocmF3QnJvd3Nlck9wdGlvbnMub3V0cHV0SGFzaGluZyAmJiByYXdCcm93c2VyT3B0aW9ucy5vdXRwdXRIYXNoaW5nICE9PSBPdXRwdXRIYXNoaW5nLk5vbmUpIHtcbiAgICAgIC8vIERpc2FibGUgb3V0cHV0IGhhc2hpbmcgZm9yIGRldiBidWlsZCBhcyB0aGlzIGNhbiBjYXVzZSBtZW1vcnkgbGVha3NcbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay1kZXYtc2VydmVyL2lzc3Vlcy8zNzcjaXNzdWVjb21tZW50LTI0MTI1ODQwNVxuICAgICAgcmF3QnJvd3Nlck9wdGlvbnMub3V0cHV0SGFzaGluZyA9IE91dHB1dEhhc2hpbmcuTm9uZTtcbiAgICAgIGxvZ2dlci53YXJuKGBXYXJuaW5nOiAnb3V0cHV0SGFzaGluZycgb3B0aW9uIGlzIGRpc2FibGVkIHdoZW4gdXNpbmcgdGhlIGRldi1zZXJ2ZXIuYCk7XG4gICAgfVxuXG4gICAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC52YWxpZGF0ZU9wdGlvbnMoXG4gICAgICB7XG4gICAgICAgIC4uLnJhd0Jyb3dzZXJPcHRpb25zLFxuICAgICAgICB3YXRjaDogb3B0aW9ucy53YXRjaCxcbiAgICAgICAgdmVyYm9zZTogb3B0aW9ucy52ZXJib3NlLFxuICAgICAgICAvLyBJbiBkZXYgc2VydmVyIHdlIHNob3VsZCBub3QgaGF2ZSBidWRnZXRzIGJlY2F1c2Ugb2YgZXh0cmEgbGlicyBzdWNoIGFzIHNvY2tzLWpzXG4gICAgICAgIGJ1ZGdldHM6IHVuZGVmaW5lZCxcbiAgICAgIH0gYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICAgICBidWlsZGVyTmFtZSxcbiAgICApKSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlclNjaGVtYTtcblxuICAgIGNvbnN0IHsgc3R5bGVzLCBzY3JpcHRzIH0gPSBub3JtYWxpemVPcHRpbWl6YXRpb24oYnJvd3Nlck9wdGlvbnMub3B0aW1pemF0aW9uKTtcbiAgICBpZiAoc2NyaXB0cyB8fCBzdHlsZXMubWluaWZ5KSB7XG4gICAgICBsb2dnZXIuZXJyb3IodGFncy5zdHJpcEluZGVudHNgXG4gICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgVGhpcyBpcyBhIHNpbXBsZSBzZXJ2ZXIgZm9yIHVzZSBpbiB0ZXN0aW5nIG9yIGRlYnVnZ2luZyBBbmd1bGFyIGFwcGxpY2F0aW9ucyBsb2NhbGx5LlxuICAgICAgICBJdCBoYXNuJ3QgYmVlbiByZXZpZXdlZCBmb3Igc2VjdXJpdHkgaXNzdWVzLlxuXG4gICAgICAgIERPTidUIFVTRSBJVCBGT1IgUFJPRFVDVElPTiFcbiAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgYCk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBjb25maWcsIGkxOG4gfSA9IGF3YWl0IGdlbmVyYXRlSTE4bkJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQoXG4gICAgICBicm93c2VyT3B0aW9ucyxcbiAgICAgIGNvbnRleHQsXG4gICAgICAod2NvKSA9PiBbZ2V0RGV2U2VydmVyQ29uZmlnKHdjbyksIGdldENvbW1vbkNvbmZpZyh3Y28pLCBnZXRTdHlsZXNDb25maWcod2NvKV0sXG4gICAgICBvcHRpb25zLFxuICAgICk7XG5cbiAgICBpZiAoIWNvbmZpZy5kZXZTZXJ2ZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignV2VicGFjayBEZXYgU2VydmVyIGNvbmZpZ3VyYXRpb24gd2FzIG5vdCBzZXQuJyk7XG4gICAgfVxuXG4gICAgbGV0IGxvY2FsZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIGlmIChpMThuLnNob3VsZElubGluZSkge1xuICAgICAgLy8gRGV2LXNlcnZlciBvbmx5IHN1cHBvcnRzIG9uZSBsb2NhbGVcbiAgICAgIGxvY2FsZSA9IFsuLi5pMThuLmlubGluZUxvY2FsZXNdWzBdO1xuICAgIH0gZWxzZSBpZiAoaTE4bi5oYXNEZWZpbmVkU291cmNlTG9jYWxlKSB7XG4gICAgICAvLyB1c2Ugc291cmNlIGxvY2FsZSBpZiBub3QgbG9jYWxpemluZ1xuICAgICAgbG9jYWxlID0gaTE4bi5zb3VyY2VMb2NhbGU7XG4gICAgfVxuXG4gICAgbGV0IHdlYnBhY2tDb25maWcgPSBjb25maWc7XG5cbiAgICAvLyBJZiBhIGxvY2FsZSBpcyBkZWZpbmVkLCBzZXR1cCBsb2NhbGl6YXRpb25cbiAgICBpZiAobG9jYWxlKSB7XG4gICAgICBpZiAoaTE4bi5pbmxpbmVMb2NhbGVzLnNpemUgPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnVGhlIGRldmVsb3BtZW50IHNlcnZlciBvbmx5IHN1cHBvcnRzIGxvY2FsaXppbmcgYSBzaW5nbGUgbG9jYWxlIHBlciBidWlsZC4nLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCBzZXR1cExvY2FsaXplKFxuICAgICAgICBsb2NhbGUsXG4gICAgICAgIGkxOG4sXG4gICAgICAgIGJyb3dzZXJPcHRpb25zLFxuICAgICAgICB3ZWJwYWNrQ29uZmlnLFxuICAgICAgICBvcHRpb25zLmNhY2hlT3B0aW9ucyxcbiAgICAgICAgY29udGV4dCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKHRyYW5zZm9ybXMud2VicGFja0NvbmZpZ3VyYXRpb24pIHtcbiAgICAgIHdlYnBhY2tDb25maWcgPSBhd2FpdCB0cmFuc2Zvcm1zLndlYnBhY2tDb25maWd1cmF0aW9uKHdlYnBhY2tDb25maWcpO1xuICAgIH1cblxuICAgIHdlYnBhY2tDb25maWcucGx1Z2lucyA/Pz0gW107XG5cbiAgICBpZiAoYnJvd3Nlck9wdGlvbnMuaW5kZXgpIHtcbiAgICAgIGNvbnN0IHsgc2NyaXB0cyA9IFtdLCBzdHlsZXMgPSBbXSwgYmFzZUhyZWYgfSA9IGJyb3dzZXJPcHRpb25zO1xuICAgICAgY29uc3QgZW50cnlwb2ludHMgPSBnZW5lcmF0ZUVudHJ5UG9pbnRzKHtcbiAgICAgICAgc2NyaXB0cyxcbiAgICAgICAgc3R5bGVzLFxuICAgICAgICAvLyBUaGUgYmVsb3cgaXMgbmVlZGVkIGFzIG90aGVyd2lzZSBITVIgZm9yIENTUyB3aWxsIGJyZWFrLlxuICAgICAgICAvLyBzdHlsZXMuanMgYW5kIHJ1bnRpbWUuanMgbmVlZHMgdG8gYmUgbG9hZGVkIGFzIGEgbm9uLW1vZHVsZSBzY3JpcHRzIGFzIG90aGVyd2lzZSBgZG9jdW1lbnQuY3VycmVudFNjcmlwdGAgd2lsbCBiZSBudWxsLlxuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL21pbmktY3NzLWV4dHJhY3QtcGx1Z2luL2Jsb2IvOTA0NDVkZDFkODFkYTBjMTBiOWIwZThhMTdiNDE3ZDA2NTE4MTZiOC9zcmMvaG1yL2hvdE1vZHVsZVJlcGxhY2VtZW50LmpzI0wzOVxuICAgICAgICBpc0hNUkVuYWJsZWQ6ICEhd2VicGFja0NvbmZpZy5kZXZTZXJ2ZXI/LmhvdCxcbiAgICAgIH0pO1xuXG4gICAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMucHVzaChcbiAgICAgICAgbmV3IEluZGV4SHRtbFdlYnBhY2tQbHVnaW4oe1xuICAgICAgICAgIGluZGV4UGF0aDogcGF0aC5yZXNvbHZlKHdvcmtzcGFjZVJvb3QsIGdldEluZGV4SW5wdXRGaWxlKGJyb3dzZXJPcHRpb25zLmluZGV4KSksXG4gICAgICAgICAgb3V0cHV0UGF0aDogZ2V0SW5kZXhPdXRwdXRGaWxlKGJyb3dzZXJPcHRpb25zLmluZGV4KSxcbiAgICAgICAgICBiYXNlSHJlZixcbiAgICAgICAgICBlbnRyeXBvaW50cyxcbiAgICAgICAgICBkZXBsb3lVcmw6IGJyb3dzZXJPcHRpb25zLmRlcGxveVVybCxcbiAgICAgICAgICBzcmk6IGJyb3dzZXJPcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgICAgICAgIGNhY2hlOiBvcHRpb25zLmNhY2hlT3B0aW9ucyxcbiAgICAgICAgICBwb3N0VHJhbnNmb3JtOiB0cmFuc2Zvcm1zLmluZGV4SHRtbCxcbiAgICAgICAgICBvcHRpbWl6YXRpb246IG5vcm1hbGl6ZU9wdGltaXphdGlvbihicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24pLFxuICAgICAgICAgIGNyb3NzT3JpZ2luOiBicm93c2VyT3B0aW9ucy5jcm9zc09yaWdpbixcbiAgICAgICAgICBsYW5nOiBsb2NhbGUsXG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoYnJvd3Nlck9wdGlvbnMuc2VydmljZVdvcmtlcikge1xuICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnB1c2goXG4gICAgICAgIG5ldyBTZXJ2aWNlV29ya2VyUGx1Z2luKHtcbiAgICAgICAgICBiYXNlSHJlZjogYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgICAgcm9vdDogY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgICAgIHByb2plY3RSb290OiBvcHRpb25zLnByb2plY3RSb290LFxuICAgICAgICAgIG5nc3dDb25maWdQYXRoOiBicm93c2VyT3B0aW9ucy5uZ3N3Q29uZmlnUGF0aCxcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBicm93c2VyT3B0aW9ucyxcbiAgICAgIHdlYnBhY2tDb25maWcsXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiBmcm9tKHNldHVwKCkpLnBpcGUoXG4gICAgc3dpdGNoTWFwKCh7IGJyb3dzZXJPcHRpb25zLCB3ZWJwYWNrQ29uZmlnIH0pID0+IHtcbiAgICAgIHJldHVybiBydW5XZWJwYWNrRGV2U2VydmVyKHdlYnBhY2tDb25maWcsIGNvbnRleHQsIHtcbiAgICAgICAgbG9nZ2luZzogdHJhbnNmb3Jtcy5sb2dnaW5nIHx8IGNyZWF0ZVdlYnBhY2tMb2dnaW5nQ2FsbGJhY2soYnJvd3Nlck9wdGlvbnMsIGxvZ2dlciksXG4gICAgICAgIHdlYnBhY2tGYWN0b3J5OiByZXF1aXJlKCd3ZWJwYWNrJykgYXMgdHlwZW9mIHdlYnBhY2ssXG4gICAgICAgIHdlYnBhY2tEZXZTZXJ2ZXJGYWN0b3J5OiByZXF1aXJlKCd3ZWJwYWNrLWRldi1zZXJ2ZXInKSBhcyB0eXBlb2Ygd2VicGFja0RldlNlcnZlcixcbiAgICAgIH0pLnBpcGUoXG4gICAgICAgIGNvbmNhdE1hcChhc3luYyAoYnVpbGRFdmVudCwgaW5kZXgpID0+IHtcbiAgICAgICAgICBjb25zdCB3ZWJwYWNrUmF3U3RhdHMgPSBidWlsZEV2ZW50LndlYnBhY2tTdGF0cztcbiAgICAgICAgICBpZiAoIXdlYnBhY2tSYXdTdGF0cykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdXZWJwYWNrIHN0YXRzIGJ1aWxkIHJlc3VsdCBpcyByZXF1aXJlZC4nKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBSZXNvbHZlIHNlcnZlIGFkZHJlc3MuXG4gICAgICAgICAgY29uc3QgcHVibGljUGF0aCA9IHdlYnBhY2tDb25maWcuZGV2U2VydmVyPy5kZXZNaWRkbGV3YXJlPy5wdWJsaWNQYXRoO1xuXG4gICAgICAgICAgY29uc3Qgc2VydmVyQWRkcmVzcyA9IHVybC5mb3JtYXQoe1xuICAgICAgICAgICAgcHJvdG9jb2w6IG9wdGlvbnMuc3NsID8gJ2h0dHBzJyA6ICdodHRwJyxcbiAgICAgICAgICAgIGhvc3RuYW1lOiBvcHRpb25zLmhvc3QgPT09ICcwLjAuMC4wJyA/ICdsb2NhbGhvc3QnIDogb3B0aW9ucy5ob3N0LFxuICAgICAgICAgICAgcG9ydDogYnVpbGRFdmVudC5wb3J0LFxuICAgICAgICAgICAgcGF0aG5hbWU6IHR5cGVvZiBwdWJsaWNQYXRoID09PSAnc3RyaW5nJyA/IHB1YmxpY1BhdGggOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBpZiAoaW5kZXggPT09IDApIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKFxuICAgICAgICAgICAgICAnXFxuJyArXG4gICAgICAgICAgICAgICAgdGFncy5vbmVMaW5lYFxuICAgICAgICAgICAgICAqKlxuICAgICAgICAgICAgICBBbmd1bGFyIExpdmUgRGV2ZWxvcG1lbnQgU2VydmVyIGlzIGxpc3RlbmluZyBvbiAke29wdGlvbnMuaG9zdH06JHtidWlsZEV2ZW50LnBvcnR9LFxuICAgICAgICAgICAgICBvcGVuIHlvdXIgYnJvd3NlciBvbiAke3NlcnZlckFkZHJlc3N9XG4gICAgICAgICAgICAgICoqXG4gICAgICAgICAgICBgICtcbiAgICAgICAgICAgICAgICAnXFxuJyxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLm9wZW4pIHtcbiAgICAgICAgICAgICAgY29uc3Qgb3BlbiA9IChhd2FpdCBpbXBvcnQoJ29wZW4nKSkuZGVmYXVsdDtcbiAgICAgICAgICAgICAgYXdhaXQgb3BlbihzZXJ2ZXJBZGRyZXNzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoYnVpbGRFdmVudC5zdWNjZXNzKSB7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhgXFxuJHtjb2xvcnMuZ3JlZW5CcmlnaHQoY29sb3JzLnN5bWJvbHMuY2hlY2spfSBDb21waWxlZCBzdWNjZXNzZnVsbHkuYCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBcXG4ke2NvbG9ycy5yZWRCcmlnaHQoY29sb3JzLnN5bWJvbHMuY3Jvc3MpfSBGYWlsZWQgdG8gY29tcGlsZS5gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4uYnVpbGRFdmVudCxcbiAgICAgICAgICAgIGJhc2VVcmw6IHNlcnZlckFkZHJlc3MsXG4gICAgICAgICAgICBzdGF0czogZ2VuZXJhdGVCdWlsZEV2ZW50U3RhdHMod2VicGFja1Jhd1N0YXRzLCBicm93c2VyT3B0aW9ucyksXG4gICAgICAgICAgfSBhcyBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0O1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfSksXG4gICk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNldHVwTG9jYWxpemUoXG4gIGxvY2FsZTogc3RyaW5nLFxuICBpMThuOiBJMThuT3B0aW9ucyxcbiAgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICB3ZWJwYWNrQ29uZmlnOiB3ZWJwYWNrLkNvbmZpZ3VyYXRpb24sXG4gIGNhY2hlT3B0aW9uczogTm9ybWFsaXplZENhY2hlZE9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKSB7XG4gIGNvbnN0IGxvY2FsZURlc2NyaXB0aW9uID0gaTE4bi5sb2NhbGVzW2xvY2FsZV07XG5cbiAgLy8gTW9kaWZ5IG1haW4gZW50cnlwb2ludCB0byBpbmNsdWRlIGxvY2FsZSBkYXRhXG4gIGlmIChcbiAgICBsb2NhbGVEZXNjcmlwdGlvbj8uZGF0YVBhdGggJiZcbiAgICB0eXBlb2Ygd2VicGFja0NvbmZpZy5lbnRyeSA9PT0gJ29iamVjdCcgJiZcbiAgICAhQXJyYXkuaXNBcnJheSh3ZWJwYWNrQ29uZmlnLmVudHJ5KSAmJlxuICAgIHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXVxuICApIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10pKSB7XG4gICAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10udW5zaGlmdChsb2NhbGVEZXNjcmlwdGlvbi5kYXRhUGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXSA9IFtcbiAgICAgICAgbG9jYWxlRGVzY3JpcHRpb24uZGF0YVBhdGgsXG4gICAgICAgIHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXSBhcyBzdHJpbmcsXG4gICAgICBdO1xuICAgIH1cbiAgfVxuXG4gIGxldCBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvciA9IGJyb3dzZXJPcHRpb25zLmkxOG5NaXNzaW5nVHJhbnNsYXRpb24gfHwgJ2lnbm9yZSc7XG4gIGxldCB0cmFuc2xhdGlvbiA9IGxvY2FsZURlc2NyaXB0aW9uPy50cmFuc2xhdGlvbiB8fCB7fTtcblxuICBpZiAobG9jYWxlID09PSBpMThuLnNvdXJjZUxvY2FsZSkge1xuICAgIG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yID0gJ2lnbm9yZSc7XG4gICAgdHJhbnNsYXRpb24gPSB7fTtcbiAgfVxuXG4gIGNvbnN0IGkxOG5Mb2FkZXJPcHRpb25zID0ge1xuICAgIGxvY2FsZSxcbiAgICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvcixcbiAgICB0cmFuc2xhdGlvbjogaTE4bi5zaG91bGRJbmxpbmUgPyB0cmFuc2xhdGlvbiA6IHVuZGVmaW5lZCxcbiAgICB0cmFuc2xhdGlvbkZpbGVzOiBsb2NhbGVEZXNjcmlwdGlvbj8uZmlsZXMubWFwKChmaWxlKSA9PlxuICAgICAgcGF0aC5yZXNvbHZlKGNvbnRleHQud29ya3NwYWNlUm9vdCwgZmlsZS5wYXRoKSxcbiAgICApLFxuICB9O1xuXG4gIGNvbnN0IGkxOG5SdWxlOiB3ZWJwYWNrLlJ1bGVTZXRSdWxlID0ge1xuICAgIHRlc3Q6IC9cXC5bY21dP1t0al1zeD8kLyxcbiAgICBlbmZvcmNlOiAncG9zdCcsXG4gICAgdXNlOiBbXG4gICAgICB7XG4gICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCcuLi8uLi90b29scy9iYWJlbC93ZWJwYWNrLWxvYWRlcicpLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgY2FjaGVEaXJlY3Rvcnk6XG4gICAgICAgICAgICAoY2FjaGVPcHRpb25zLmVuYWJsZWQgJiYgcGF0aC5qb2luKGNhY2hlT3B0aW9ucy5wYXRoLCAnYmFiZWwtZGV2LXNlcnZlci1pMThuJykpIHx8XG4gICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICBjYWNoZUlkZW50aWZpZXI6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGxvY2FsZSxcbiAgICAgICAgICAgIHRyYW5zbGF0aW9uSW50ZWdyaXR5OiBsb2NhbGVEZXNjcmlwdGlvbj8uZmlsZXMubWFwKChmaWxlKSA9PiBmaWxlLmludGVncml0eSksXG4gICAgICAgICAgfSksXG4gICAgICAgICAgaTE4bjogaTE4bkxvYWRlck9wdGlvbnMsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIF0sXG4gIH07XG5cbiAgLy8gR2V0IHRoZSBydWxlcyBhbmQgZW5zdXJlIHRoZSBXZWJwYWNrIGNvbmZpZ3VyYXRpb24gaXMgc2V0dXAgcHJvcGVybHlcbiAgY29uc3QgcnVsZXMgPSB3ZWJwYWNrQ29uZmlnLm1vZHVsZT8ucnVsZXMgfHwgW107XG4gIGlmICghd2VicGFja0NvbmZpZy5tb2R1bGUpIHtcbiAgICB3ZWJwYWNrQ29uZmlnLm1vZHVsZSA9IHsgcnVsZXMgfTtcbiAgfSBlbHNlIGlmICghd2VicGFja0NvbmZpZy5tb2R1bGUucnVsZXMpIHtcbiAgICB3ZWJwYWNrQ29uZmlnLm1vZHVsZS5ydWxlcyA9IHJ1bGVzO1xuICB9XG5cbiAgcnVsZXMucHVzaChpMThuUnVsZSk7XG5cbiAgLy8gQWRkIGEgcGx1Z2luIHRvIHJlbG9hZCB0cmFuc2xhdGlvbiBmaWxlcyBvbiByZWJ1aWxkc1xuICBjb25zdCBsb2FkZXIgPSBhd2FpdCBjcmVhdGVUcmFuc2xhdGlvbkxvYWRlcigpO1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMhLnB1c2goe1xuICAgIGFwcGx5OiAoY29tcGlsZXI6IHdlYnBhY2suQ29tcGlsZXIpID0+IHtcbiAgICAgIGNvbXBpbGVyLmhvb2tzLnRoaXNDb21waWxhdGlvbi50YXAoJ2J1aWxkLWFuZ3VsYXInLCAoY29tcGlsYXRpb24pID0+IHtcbiAgICAgICAgaWYgKGkxOG4uc2hvdWxkSW5saW5lICYmIGkxOG5Mb2FkZXJPcHRpb25zLnRyYW5zbGF0aW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBSZWxvYWQgdHJhbnNsYXRpb25zXG4gICAgICAgICAgbG9hZFRyYW5zbGF0aW9ucyhcbiAgICAgICAgICAgIGxvY2FsZSxcbiAgICAgICAgICAgIGxvY2FsZURlc2NyaXB0aW9uLFxuICAgICAgICAgICAgY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgICAgICAgbG9hZGVyLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB3YXJuKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICBhZGRXYXJuaW5nKGNvbXBpbGF0aW9uLCBtZXNzYWdlKTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgZXJyb3IobWVzc2FnZSkge1xuICAgICAgICAgICAgICAgIGFkZEVycm9yKGNvbXBpbGF0aW9uLCBtZXNzYWdlKTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgICBicm93c2VyT3B0aW9ucy5pMThuRHVwbGljYXRlVHJhbnNsYXRpb24sXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGkxOG5Mb2FkZXJPcHRpb25zLnRyYW5zbGF0aW9uID0gbG9jYWxlRGVzY3JpcHRpb24udHJhbnNsYXRpb24gPz8ge307XG4gICAgICAgIH1cblxuICAgICAgICBjb21waWxhdGlvbi5ob29rcy5maW5pc2hNb2R1bGVzLnRhcCgnYnVpbGQtYW5ndWxhcicsICgpID0+IHtcbiAgICAgICAgICAvLyBBZnRlciBsb2FkZXJzIGFyZSBmaW5pc2hlZCwgY2xlYXIgb3V0IHRoZSBub3cgdW5uZWVkZWQgdHJhbnNsYXRpb25zXG4gICAgICAgICAgaTE4bkxvYWRlck9wdGlvbnMudHJhbnNsYXRpb24gPSB1bmRlZmluZWQ7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG59XG4iXX0=