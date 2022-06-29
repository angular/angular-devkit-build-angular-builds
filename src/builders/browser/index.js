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
exports.buildWebpackBrowser = exports.BUILD_TIMEOUT = void 0;
const architect_1 = require("@angular-devkit/architect");
const build_webpack_1 = require("@angular-devkit/build-webpack");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const typescript_1 = require("typescript");
const utils_1 = require("../../utils");
const bundle_calculator_1 = require("../../utils/bundle-calculator");
const color_1 = require("../../utils/color");
const copy_assets_1 = require("../../utils/copy-assets");
const i18n_inlining_1 = require("../../utils/i18n-inlining");
const index_html_generator_1 = require("../../utils/index-file/index-html-generator");
const normalize_cache_1 = require("../../utils/normalize-cache");
const output_paths_1 = require("../../utils/output-paths");
const package_chunk_sort_1 = require("../../utils/package-chunk-sort");
const purge_cache_1 = require("../../utils/purge-cache");
const service_worker_1 = require("../../utils/service-worker");
const spinner_1 = require("../../utils/spinner");
const supported_browsers_1 = require("../../utils/supported-browsers");
const version_1 = require("../../utils/version");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const configs_1 = require("../../webpack/configs");
const async_chunks_1 = require("../../webpack/utils/async-chunks");
const helpers_1 = require("../../webpack/utils/helpers");
const stats_1 = require("../../webpack/utils/stats");
/**
 * Maximum time in milliseconds for single build/rebuild
 * This accounts for CI variability.
 */
exports.BUILD_TIMEOUT = 30000;
async function initialize(options, context, webpackConfigurationTransform) {
    var _a, _b;
    const originalOutputPath = options.outputPath;
    // Assets are processed directly by the builder except when watching
    const adjustedOptions = options.watch ? options : { ...options, assets: [] };
    const { config, projectRoot, projectSourceRoot, i18n, target } = await (0, webpack_browser_config_1.generateI18nBrowserWebpackConfigFromContext)(adjustedOptions, context, (wco) => [
        (0, configs_1.getCommonConfig)(wco),
        (0, configs_1.getStylesConfig)(wco),
        (0, configs_1.getAnalyticsConfig)(wco, context),
    ]);
    // Validate asset option values if processed directly
    if (((_a = options.assets) === null || _a === void 0 ? void 0 : _a.length) && !((_b = adjustedOptions.assets) === null || _b === void 0 ? void 0 : _b.length)) {
        (0, utils_1.normalizeAssetPatterns)(options.assets, context.workspaceRoot, projectRoot, projectSourceRoot).forEach(({ output }) => {
            if (output.startsWith('..')) {
                throw new Error('An asset cannot be written to a location outside of the output path.');
            }
        });
    }
    let transformedConfig;
    if (webpackConfigurationTransform) {
        transformedConfig = await webpackConfigurationTransform(config);
    }
    if (options.deleteOutputPath) {
        (0, utils_1.deleteOutputDir)(context.workspaceRoot, originalOutputPath);
    }
    return { config: transformedConfig || config, projectRoot, projectSourceRoot, i18n, target };
}
/**
 * @experimental Direct usage of this function is considered experimental.
 */
// eslint-disable-next-line max-lines-per-function
function buildWebpackBrowser(options, context, transforms = {}) {
    var _a;
    const projectName = (_a = context.target) === null || _a === void 0 ? void 0 : _a.project;
    if (!projectName) {
        throw new Error('The builder requires a target.');
    }
    const baseOutputPath = path.resolve(context.workspaceRoot, options.outputPath);
    let outputPaths;
    // Check Angular version.
    (0, version_1.assertCompatibleAngularVersion)(context.workspaceRoot);
    return (0, rxjs_1.from)(context.getProjectMetadata(projectName)).pipe((0, operators_1.switchMap)(async (projectMetadata) => {
        // Purge old build disk cache.
        await (0, purge_cache_1.purgeStaleBuildCache)(context);
        // Initialize builder
        const initialization = await initialize(options, context, transforms.webpackConfiguration);
        // Check and warn about IE browser support
        checkInternetExplorerSupport(initialization.projectRoot, context.logger);
        return {
            ...initialization,
            cacheOptions: (0, normalize_cache_1.normalizeCacheOptions)(projectMetadata, context.workspaceRoot),
        };
    }), (0, operators_1.switchMap)(
    // eslint-disable-next-line max-lines-per-function
    ({ config, projectRoot, projectSourceRoot, i18n, target, cacheOptions }) => {
        var _a;
        const normalizedOptimization = (0, utils_1.normalizeOptimization)(options.optimization);
        const defaultBaseHref = (_a = options.baseHref) !== null && _a !== void 0 ? _a : '/';
        return (0, build_webpack_1.runWebpack)(config, context, {
            webpackFactory: require('webpack'),
            logging: transforms.logging ||
                ((stats, config) => {
                    if (options.verbose) {
                        context.logger.info(stats.toString(config.stats));
                    }
                }),
        }).pipe((0, operators_1.concatMap)(async (buildEvent) => {
            var _a, _b, _c, _d, _e, _f;
            const spinner = new spinner_1.Spinner();
            spinner.enabled = options.progress !== false;
            const { success, emittedFiles = [], outputPath: webpackOutputPath } = buildEvent;
            const webpackRawStats = buildEvent.webpackStats;
            if (!webpackRawStats) {
                throw new Error('Webpack stats build result is required.');
            }
            // Fix incorrectly set `initial` value on chunks.
            const extraEntryPoints = [
                ...(0, helpers_1.normalizeExtraEntryPoints)(options.styles || [], 'styles'),
                ...(0, helpers_1.normalizeExtraEntryPoints)(options.scripts || [], 'scripts'),
            ];
            const webpackStats = {
                ...webpackRawStats,
                chunks: (0, async_chunks_1.markAsyncChunksNonInitial)(webpackRawStats, extraEntryPoints),
            };
            if (!success) {
                // If using bundle downleveling then there is only one build
                // If it fails show any diagnostic messages and bail
                if ((0, stats_1.statsHasWarnings)(webpackStats)) {
                    context.logger.warn((0, stats_1.statsWarningsToString)(webpackStats, { colors: true }));
                }
                if ((0, stats_1.statsHasErrors)(webpackStats)) {
                    context.logger.error((0, stats_1.statsErrorsToString)(webpackStats, { colors: true }));
                }
                return { success };
            }
            else {
                outputPaths = (0, output_paths_1.ensureOutputPaths)(baseOutputPath, i18n);
                const scriptsEntryPointName = (0, helpers_1.normalizeExtraEntryPoints)(options.scripts || [], 'scripts').map((x) => x.bundleName);
                if (i18n.shouldInline) {
                    const success = await (0, i18n_inlining_1.i18nInlineEmittedFiles)(context, emittedFiles, i18n, baseOutputPath, Array.from(outputPaths.values()), scriptsEntryPointName, webpackOutputPath, target <= typescript_1.ScriptTarget.ES5, options.i18nMissingTranslation);
                    if (!success) {
                        return { success: false };
                    }
                }
                // Check for budget errors and display them to the user.
                const budgets = options.budgets;
                let budgetFailures;
                if (budgets === null || budgets === void 0 ? void 0 : budgets.length) {
                    budgetFailures = [...(0, bundle_calculator_1.checkBudgets)(budgets, webpackStats)];
                    for (const { severity, message } of budgetFailures) {
                        switch (severity) {
                            case bundle_calculator_1.ThresholdSeverity.Warning:
                                (_a = webpackStats.warnings) === null || _a === void 0 ? void 0 : _a.push({ message });
                                break;
                            case bundle_calculator_1.ThresholdSeverity.Error:
                                (_b = webpackStats.errors) === null || _b === void 0 ? void 0 : _b.push({ message });
                                break;
                            default:
                                assertNever(severity);
                        }
                    }
                }
                const buildSuccess = success && !(0, stats_1.statsHasErrors)(webpackStats);
                if (buildSuccess) {
                    // Copy assets
                    if (!options.watch && ((_c = options.assets) === null || _c === void 0 ? void 0 : _c.length)) {
                        spinner.start('Copying assets...');
                        try {
                            await (0, copy_assets_1.copyAssets)((0, utils_1.normalizeAssetPatterns)(options.assets, context.workspaceRoot, projectRoot, projectSourceRoot), Array.from(outputPaths.values()), context.workspaceRoot);
                            spinner.succeed('Copying assets complete.');
                        }
                        catch (err) {
                            spinner.fail(color_1.colors.redBright('Copying of assets failed.'));
                            return { success: false, error: 'Unable to copy assets: ' + err.message };
                        }
                    }
                    if (options.index) {
                        spinner.start('Generating index html...');
                        const entrypoints = (0, package_chunk_sort_1.generateEntryPoints)({
                            scripts: (_d = options.scripts) !== null && _d !== void 0 ? _d : [],
                            styles: (_e = options.styles) !== null && _e !== void 0 ? _e : [],
                        });
                        const indexHtmlGenerator = new index_html_generator_1.IndexHtmlGenerator({
                            cache: cacheOptions,
                            indexPath: path.join(context.workspaceRoot, (0, webpack_browser_config_1.getIndexInputFile)(options.index)),
                            entrypoints,
                            deployUrl: options.deployUrl,
                            sri: options.subresourceIntegrity,
                            optimization: normalizedOptimization,
                            crossOrigin: options.crossOrigin,
                            postTransform: transforms.indexHtml,
                        });
                        let hasErrors = false;
                        for (const [locale, outputPath] of outputPaths.entries()) {
                            try {
                                const { content, warnings, errors } = await indexHtmlGenerator.process({
                                    baseHref: getLocaleBaseHref(i18n, locale) || defaultBaseHref,
                                    // i18nLocale is used when Ivy is disabled
                                    lang: locale || undefined,
                                    outputPath,
                                    files: mapEmittedFilesToFileInfo(emittedFiles),
                                });
                                if (warnings.length || errors.length) {
                                    spinner.stop();
                                    warnings.forEach((m) => context.logger.warn(m));
                                    errors.forEach((m) => {
                                        context.logger.error(m);
                                        hasErrors = true;
                                    });
                                    spinner.start();
                                }
                                const indexOutput = path.join(outputPath, (0, webpack_browser_config_1.getIndexOutputFile)(options.index));
                                await fs.promises.mkdir(path.dirname(indexOutput), { recursive: true });
                                await fs.promises.writeFile(indexOutput, content);
                            }
                            catch (error) {
                                spinner.fail('Index html generation failed.');
                                return { success: false, error: mapErrorToMessage(error) };
                            }
                        }
                        if (hasErrors) {
                            spinner.fail('Index html generation failed.');
                            return { success: false };
                        }
                        else {
                            spinner.succeed('Index html generation complete.');
                        }
                    }
                    if (options.serviceWorker) {
                        spinner.start('Generating service worker...');
                        for (const [locale, outputPath] of outputPaths.entries()) {
                            try {
                                await (0, service_worker_1.augmentAppWithServiceWorker)(projectRoot, context.workspaceRoot, outputPath, (_f = getLocaleBaseHref(i18n, locale)) !== null && _f !== void 0 ? _f : defaultBaseHref, options.ngswConfigPath);
                            }
                            catch (error) {
                                spinner.fail('Service worker generation failed.');
                                return { success: false, error: mapErrorToMessage(error) };
                            }
                        }
                        spinner.succeed('Service worker generation complete.');
                    }
                }
                (0, stats_1.webpackStatsLogger)(context.logger, webpackStats, config, budgetFailures);
                return { success: buildSuccess };
            }
        }), (0, operators_1.map)((event) => ({
            ...event,
            baseOutputPath,
            outputPath: baseOutputPath,
            outputPaths: (outputPaths && Array.from(outputPaths.values())) || [baseOutputPath],
            outputs: (outputPaths &&
                [...outputPaths.entries()].map(([locale, path]) => {
                    var _a;
                    return ({
                        locale,
                        path,
                        baseHref: (_a = getLocaleBaseHref(i18n, locale)) !== null && _a !== void 0 ? _a : defaultBaseHref,
                    });
                })) || {
                path: baseOutputPath,
                baseHref: defaultBaseHref,
            },
        })));
    }));
    function getLocaleBaseHref(i18n, locale) {
        var _a, _b;
        if (i18n.locales[locale] && ((_a = i18n.locales[locale]) === null || _a === void 0 ? void 0 : _a.baseHref) !== '') {
            return (0, utils_1.urlJoin)(options.baseHref || '', (_b = i18n.locales[locale].baseHref) !== null && _b !== void 0 ? _b : `/${locale}/`);
        }
        return undefined;
    }
}
exports.buildWebpackBrowser = buildWebpackBrowser;
function mapErrorToMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return undefined;
}
function assertNever(input) {
    throw new Error(`Unexpected call to assertNever() with input: ${JSON.stringify(input, null /* replacer */, 4 /* tabSize */)}`);
}
function mapEmittedFilesToFileInfo(files = []) {
    const filteredFiles = [];
    for (const { file, name, extension, initial } of files) {
        if (name && initial) {
            filteredFiles.push({ file, extension, name });
        }
    }
    return filteredFiles;
}
function checkInternetExplorerSupport(projectRoot, logger) {
    const supportedBrowsers = (0, supported_browsers_1.getSupportedBrowsers)(projectRoot);
    if (supportedBrowsers.some((b) => b === 'ie 9' || b === 'ie 10' || b === 'ie 11')) {
        logger.warn(`Warning: Support was requested for Internet Explorer in the project's browserslist configuration. ` +
            'Internet Explorer is no longer officially supported.' +
            '\nFor more information, see https://angular.io/guide/browser-support');
    }
}
exports.default = (0, architect_1.createBuilder)(buildWebpackBrowser);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQXlGO0FBQ3pGLGlFQUFpRztBQUVqRyx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLCtCQUF3QztBQUN4Qyw4Q0FBMkQ7QUFDM0QsMkNBQTBDO0FBRzFDLHVDQUtxQjtBQUNyQixxRUFJdUM7QUFDdkMsNkNBQTJDO0FBQzNDLHlEQUFxRDtBQUNyRCw2REFBbUU7QUFHbkUsc0ZBR3FEO0FBQ3JELGlFQUFvRTtBQUNwRSwyREFBNkQ7QUFDN0QsdUVBQXFFO0FBQ3JFLHlEQUErRDtBQUMvRCwrREFBeUU7QUFDekUsaURBQThDO0FBQzlDLHVFQUFzRTtBQUN0RSxpREFBcUU7QUFDckUsK0VBSTRDO0FBQzVDLG1EQUE2RjtBQUM3RixtRUFBNkU7QUFDN0UseURBQXdFO0FBQ3hFLHFEQU1tQztBQXdCbkM7OztHQUdHO0FBQ1UsUUFBQSxhQUFhLEdBQUcsS0FBTSxDQUFDO0FBRXBDLEtBQUssVUFBVSxVQUFVLENBQ3ZCLE9BQTZCLEVBQzdCLE9BQXVCLEVBQ3ZCLDZCQUEyRTs7SUFRM0UsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDO0lBRTlDLG9FQUFvRTtJQUNwRSxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxDQUFDO0lBRTdFLE1BQU0sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUs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RUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLElBQUksS0FBSyxFQUFFO1FBQ3RELElBQUksSUFBSSxJQUFJLE9BQU8sRUFBRTtZQUNuQixhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1NBQy9DO0tBQ0Y7SUFFRCxPQUFPLGFBQWEsQ0FBQztBQUN2QixDQUFDO0FBRUQsU0FBUyw0QkFBNEIsQ0FBQyxXQUFtQixFQUFFLE1BQXlCO0lBQ2xGLE1BQU0saUJBQWlCLEdBQUcsSUFBQSx5Q0FBb0IsRUFBQyxXQUFXLENBQUMsQ0FBQztJQUM1RCxJQUFJLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxLQUFLLE1BQU0sSUFBSSxDQUFDLEtBQUssT0FBTyxJQUFJLENBQUMsS0FBSyxPQUFPLENBQUMsRUFBRTtRQUNqRixNQUFNLENBQUMsSUFBSSxDQUNULG9HQUFvRztZQUNsRyxzREFBc0Q7WUFDdEQsc0VBQXNFLENBQ3pFLENBQUM7S0FDSDtBQUNILENBQUM7QUFFRCxrQkFBZSxJQUFBLHlCQUFhLEVBQXVCLG1CQUFtQixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IEVtaXR0ZWRGaWxlcywgV2VicGFja0xvZ2dpbmdDYWxsYmFjaywgcnVuV2VicGFjayB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJztcbmltcG9ydCB7IGxvZ2dpbmcgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAsIHN3aXRjaE1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IFNjcmlwdFRhcmdldCB9IGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBFeGVjdXRpb25UcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHtcbiAgZGVsZXRlT3V0cHV0RGlyLFxuICBub3JtYWxpemVBc3NldFBhdHRlcm5zLFxuICBub3JtYWxpemVPcHRpbWl6YXRpb24sXG4gIHVybEpvaW4sXG59IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7XG4gIEJ1ZGdldENhbGN1bGF0b3JSZXN1bHQsXG4gIFRocmVzaG9sZFNldmVyaXR5LFxuICBjaGVja0J1ZGdldHMsXG59IGZyb20gJy4uLy4uL3V0aWxzL2J1bmRsZS1jYWxjdWxhdG9yJztcbmltcG9ydCB7IGNvbG9ycyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvbG9yJztcbmltcG9ydCB7IGNvcHlBc3NldHMgfSBmcm9tICcuLi8uLi91dGlscy9jb3B5LWFzc2V0cyc7XG5pbXBvcnQgeyBpMThuSW5saW5lRW1pdHRlZEZpbGVzIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1pbmxpbmluZyc7XG5pbXBvcnQgeyBJMThuT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2kxOG4tb3B0aW9ucyc7XG5pbXBvcnQgeyBGaWxlSW5mbyB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvYXVnbWVudC1pbmRleC1odG1sJztcbmltcG9ydCB7XG4gIEluZGV4SHRtbEdlbmVyYXRvcixcbiAgSW5kZXhIdG1sVHJhbnNmb3JtLFxufSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2luZGV4LWh0bWwtZ2VuZXJhdG9yJztcbmltcG9ydCB7IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL25vcm1hbGl6ZS1jYWNoZSc7XG5pbXBvcnQgeyBlbnN1cmVPdXRwdXRQYXRocyB9IGZyb20gJy4uLy4uL3V0aWxzL291dHB1dC1wYXRocyc7XG5pbXBvcnQgeyBnZW5lcmF0ZUVudHJ5UG9pbnRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGFja2FnZS1jaHVuay1zb3J0JztcbmltcG9ydCB7IHB1cmdlU3RhbGVCdWlsZENhY2hlIH0gZnJvbSAnLi4vLi4vdXRpbHMvcHVyZ2UtY2FjaGUnO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2VydmljZS13b3JrZXInO1xuaW1wb3J0IHsgU3Bpbm5lciB9IGZyb20gJy4uLy4uL3V0aWxzL3NwaW5uZXInO1xuaW1wb3J0IHsgZ2V0U3VwcG9ydGVkQnJvd3NlcnMgfSBmcm9tICcuLi8uLi91dGlscy9zdXBwb3J0ZWQtYnJvd3NlcnMnO1xuaW1wb3J0IHsgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvdmVyc2lvbic7XG5pbXBvcnQge1xuICBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0LFxuICBnZXRJbmRleElucHV0RmlsZSxcbiAgZ2V0SW5kZXhPdXRwdXRGaWxlLFxufSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IGdldEFuYWx5dGljc0NvbmZpZywgZ2V0Q29tbW9uQ29uZmlnLCBnZXRTdHlsZXNDb25maWcgfSBmcm9tICcuLi8uLi93ZWJwYWNrL2NvbmZpZ3MnO1xuaW1wb3J0IHsgbWFya0FzeW5jQ2h1bmtzTm9uSW5pdGlhbCB9IGZyb20gJy4uLy4uL3dlYnBhY2svdXRpbHMvYXN5bmMtY2h1bmtzJztcbmltcG9ydCB7IG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL2hlbHBlcnMnO1xuaW1wb3J0IHtcbiAgc3RhdHNFcnJvcnNUb1N0cmluZyxcbiAgc3RhdHNIYXNFcnJvcnMsXG4gIHN0YXRzSGFzV2FybmluZ3MsXG4gIHN0YXRzV2FybmluZ3NUb1N0cmluZyxcbiAgd2VicGFja1N0YXRzTG9nZ2VyLFxufSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL3N0YXRzJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlclNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIHR5cGUgaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCB0eXBlIEJyb3dzZXJCdWlsZGVyT3V0cHV0ID0gQnVpbGRlck91dHB1dCAmIHtcbiAgYmFzZU91dHB1dFBhdGg6IHN0cmluZztcbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIGluIHZlcnNpb24gMTQuIFVzZSAnb3V0cHV0cycgaW5zdGVhZC5cbiAgICovXG4gIG91dHB1dFBhdGhzOiBzdHJpbmdbXTtcbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIGluIHZlcnNpb24gOS4gVXNlICdvdXRwdXRzJyBpbnN0ZWFkLlxuICAgKi9cbiAgb3V0cHV0UGF0aDogc3RyaW5nO1xuXG4gIG91dHB1dHM6IHtcbiAgICBsb2NhbGU/OiBzdHJpbmc7XG4gICAgcGF0aDogc3RyaW5nO1xuICAgIGJhc2VIcmVmOiBzdHJpbmc7XG4gIH1bXTtcbn07XG5cbi8qKlxuICogTWF4aW11bSB0aW1lIGluIG1pbGxpc2Vjb25kcyBmb3Igc2luZ2xlIGJ1aWxkL3JlYnVpbGRcbiAqIFRoaXMgYWNjb3VudHMgZm9yIENJIHZhcmlhYmlsaXR5LlxuICovXG5leHBvcnQgY29uc3QgQlVJTERfVElNRU9VVCA9IDMwXzAwMDtcblxuYXN5bmMgZnVuY3Rpb24gaW5pdGlhbGl6ZShcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybT86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPHdlYnBhY2suQ29uZmlndXJhdGlvbj4sXG4pOiBQcm9taXNlPHtcbiAgY29uZmlnOiB3ZWJwYWNrLkNvbmZpZ3VyYXRpb247XG4gIHByb2plY3RSb290OiBzdHJpbmc7XG4gIHByb2plY3RTb3VyY2VSb290Pzogc3RyaW5nO1xuICBpMThuOiBJMThuT3B0aW9ucztcbiAgdGFyZ2V0OiBTY3JpcHRUYXJnZXQ7XG59PiB7XG4gIGNvbnN0IG9yaWdpbmFsT3V0cHV0UGF0aCA9IG9wdGlvbnMub3V0cHV0UGF0aDtcblxuICAvLyBBc3NldHMgYXJlIHByb2Nlc3NlZCBkaXJlY3RseSBieSB0aGUgYnVpbGRlciBleGNlcHQgd2hlbiB3YXRjaGluZ1xuICBjb25zdCBhZGp1c3RlZE9wdGlvbnMgPSBvcHRpb25zLndhdGNoID8gb3B0aW9ucyA6IHsgLi4ub3B0aW9ucywgYXNzZXRzOiBbXSB9O1xuXG4gIGNvbnN0IHsgY29uZmlnLCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QsIGkxOG4sIHRhcmdldCB9ID1cbiAgICBhd2FpdCBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KGFkanVzdGVkT3B0aW9ucywgY29udGV4dCwgKHdjbykgPT4gW1xuICAgICAgZ2V0Q29tbW9uQ29uZmlnKHdjbyksXG4gICAgICBnZXRTdHlsZXNDb25maWcod2NvKSxcbiAgICAgIGdldEFuYWx5dGljc0NvbmZpZyh3Y28sIGNvbnRleHQpLFxuICAgIF0pO1xuXG4gIC8vIFZhbGlkYXRlIGFzc2V0IG9wdGlvbiB2YWx1ZXMgaWYgcHJvY2Vzc2VkIGRpcmVjdGx5XG4gIGlmIChvcHRpb25zLmFzc2V0cz8ubGVuZ3RoICYmICFhZGp1c3RlZE9wdGlvbnMuYXNzZXRzPy5sZW5ndGgpIHtcbiAgICBub3JtYWxpemVBc3NldFBhdHRlcm5zKFxuICAgICAgb3B0aW9ucy5hc3NldHMsXG4gICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICBwcm9qZWN0Um9vdCxcbiAgICAgIHByb2plY3RTb3VyY2VSb290LFxuICAgICkuZm9yRWFjaCgoeyBvdXRwdXQgfSkgPT4ge1xuICAgICAgaWYgKG91dHB1dC5zdGFydHNXaXRoKCcuLicpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQW4gYXNzZXQgY2Fubm90IGJlIHdyaXR0ZW4gdG8gYSBsb2NhdGlvbiBvdXRzaWRlIG9mIHRoZSBvdXRwdXQgcGF0aC4nKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGxldCB0cmFuc2Zvcm1lZENvbmZpZztcbiAgaWYgKHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtKSB7XG4gICAgdHJhbnNmb3JtZWRDb25maWcgPSBhd2FpdCB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybShjb25maWcpO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aCkge1xuICAgIGRlbGV0ZU91dHB1dERpcihjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9yaWdpbmFsT3V0cHV0UGF0aCk7XG4gIH1cblxuICByZXR1cm4geyBjb25maWc6IHRyYW5zZm9ybWVkQ29uZmlnIHx8IGNvbmZpZywgcHJvamVjdFJvb3QsIHByb2plY3RTb3VyY2VSb290LCBpMThuLCB0YXJnZXQgfTtcbn1cblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkV2VicGFja0Jyb3dzZXIoXG4gIG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgdHJhbnNmb3Jtczoge1xuICAgIHdlYnBhY2tDb25maWd1cmF0aW9uPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8d2VicGFjay5Db25maWd1cmF0aW9uPjtcbiAgICBsb2dnaW5nPzogV2VicGFja0xvZ2dpbmdDYWxsYmFjaztcbiAgICBpbmRleEh0bWw/OiBJbmRleEh0bWxUcmFuc2Zvcm07XG4gIH0gPSB7fSxcbik6IE9ic2VydmFibGU8QnJvd3NlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVGhlIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQuJyk7XG4gIH1cblxuICBjb25zdCBiYXNlT3V0cHV0UGF0aCA9IHBhdGgucmVzb2x2ZShjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9wdGlvbnMub3V0cHV0UGF0aCk7XG4gIGxldCBvdXRwdXRQYXRoczogdW5kZWZpbmVkIHwgTWFwPHN0cmluZywgc3RyaW5nPjtcblxuICAvLyBDaGVjayBBbmd1bGFyIHZlcnNpb24uXG4gIGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbihjb250ZXh0LndvcmtzcGFjZVJvb3QpO1xuXG4gIHJldHVybiBmcm9tKGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKSkucGlwZShcbiAgICBzd2l0Y2hNYXAoYXN5bmMgKHByb2plY3RNZXRhZGF0YSkgPT4ge1xuICAgICAgLy8gUHVyZ2Ugb2xkIGJ1aWxkIGRpc2sgY2FjaGUuXG4gICAgICBhd2FpdCBwdXJnZVN0YWxlQnVpbGRDYWNoZShjb250ZXh0KTtcblxuICAgICAgLy8gSW5pdGlhbGl6ZSBidWlsZGVyXG4gICAgICBjb25zdCBpbml0aWFsaXphdGlvbiA9IGF3YWl0IGluaXRpYWxpemUob3B0aW9ucywgY29udGV4dCwgdHJhbnNmb3Jtcy53ZWJwYWNrQ29uZmlndXJhdGlvbik7XG5cbiAgICAgIC8vIENoZWNrIGFuZCB3YXJuIGFib3V0IElFIGJyb3dzZXIgc3VwcG9ydFxuICAgICAgY2hlY2tJbnRlcm5ldEV4cGxvcmVyU3VwcG9ydChpbml0aWFsaXphdGlvbi5wcm9qZWN0Um9vdCwgY29udGV4dC5sb2dnZXIpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi5pbml0aWFsaXphdGlvbixcbiAgICAgICAgY2FjaGVPcHRpb25zOiBub3JtYWxpemVDYWNoZU9wdGlvbnMocHJvamVjdE1ldGFkYXRhLCBjb250ZXh0LndvcmtzcGFjZVJvb3QpLFxuICAgICAgfTtcbiAgICB9KSxcbiAgICBzd2l0Y2hNYXAoXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuICAgICAgKHsgY29uZmlnLCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QsIGkxOG4sIHRhcmdldCwgY2FjaGVPcHRpb25zIH0pID0+IHtcbiAgICAgICAgY29uc3Qgbm9ybWFsaXplZE9wdGltaXphdGlvbiA9IG5vcm1hbGl6ZU9wdGltaXphdGlvbihvcHRpb25zLm9wdGltaXphdGlvbik7XG5cbiAgICAgICAgY29uc3QgZGVmYXVsdEJhc2VIcmVmID0gb3B0aW9ucy5iYXNlSHJlZiA/PyAnLyc7XG5cbiAgICAgICAgcmV0dXJuIHJ1bldlYnBhY2soY29uZmlnLCBjb250ZXh0LCB7XG4gICAgICAgICAgd2VicGFja0ZhY3Rvcnk6IHJlcXVpcmUoJ3dlYnBhY2snKSBhcyB0eXBlb2Ygd2VicGFjayxcbiAgICAgICAgICBsb2dnaW5nOlxuICAgICAgICAgICAgdHJhbnNmb3Jtcy5sb2dnaW5nIHx8XG4gICAgICAgICAgICAoKHN0YXRzLCBjb25maWcpID0+IHtcbiAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudmVyYm9zZSkge1xuICAgICAgICAgICAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oc3RhdHMudG9TdHJpbmcoY29uZmlnLnN0YXRzKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLFxuICAgICAgICB9KS5waXBlKFxuICAgICAgICAgIGNvbmNhdE1hcChhc3luYyAoYnVpbGRFdmVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKCk7XG4gICAgICAgICAgICBzcGlubmVyLmVuYWJsZWQgPSBvcHRpb25zLnByb2dyZXNzICE9PSBmYWxzZTtcblxuICAgICAgICAgICAgY29uc3QgeyBzdWNjZXNzLCBlbWl0dGVkRmlsZXMgPSBbXSwgb3V0cHV0UGF0aDogd2VicGFja091dHB1dFBhdGggfSA9IGJ1aWxkRXZlbnQ7XG4gICAgICAgICAgICBjb25zdCB3ZWJwYWNrUmF3U3RhdHMgPSBidWlsZEV2ZW50LndlYnBhY2tTdGF0cztcbiAgICAgICAgICAgIGlmICghd2VicGFja1Jhd1N0YXRzKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignV2VicGFjayBzdGF0cyBidWlsZCByZXN1bHQgaXMgcmVxdWlyZWQuJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEZpeCBpbmNvcnJlY3RseSBzZXQgYGluaXRpYWxgIHZhbHVlIG9uIGNodW5rcy5cbiAgICAgICAgICAgIGNvbnN0IGV4dHJhRW50cnlQb2ludHMgPSBbXG4gICAgICAgICAgICAgIC4uLm5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMob3B0aW9ucy5zdHlsZXMgfHwgW10sICdzdHlsZXMnKSxcbiAgICAgICAgICAgICAgLi4ubm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhvcHRpb25zLnNjcmlwdHMgfHwgW10sICdzY3JpcHRzJyksXG4gICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICBjb25zdCB3ZWJwYWNrU3RhdHMgPSB7XG4gICAgICAgICAgICAgIC4uLndlYnBhY2tSYXdTdGF0cyxcbiAgICAgICAgICAgICAgY2h1bmtzOiBtYXJrQXN5bmNDaHVua3NOb25Jbml0aWFsKHdlYnBhY2tSYXdTdGF0cywgZXh0cmFFbnRyeVBvaW50cyksXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgLy8gSWYgdXNpbmcgYnVuZGxlIGRvd25sZXZlbGluZyB0aGVuIHRoZXJlIGlzIG9ubHkgb25lIGJ1aWxkXG4gICAgICAgICAgICAgIC8vIElmIGl0IGZhaWxzIHNob3cgYW55IGRpYWdub3N0aWMgbWVzc2FnZXMgYW5kIGJhaWxcbiAgICAgICAgICAgICAgaWYgKHN0YXRzSGFzV2FybmluZ3Mod2VicGFja1N0YXRzKSkge1xuICAgICAgICAgICAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4oc3RhdHNXYXJuaW5nc1RvU3RyaW5nKHdlYnBhY2tTdGF0cywgeyBjb2xvcnM6IHRydWUgfSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzdGF0c0hhc0Vycm9ycyh3ZWJwYWNrU3RhdHMpKSB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3Ioc3RhdHNFcnJvcnNUb1N0cmluZyh3ZWJwYWNrU3RhdHMsIHsgY29sb3JzOiB0cnVlIH0pKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3MgfTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG91dHB1dFBhdGhzID0gZW5zdXJlT3V0cHV0UGF0aHMoYmFzZU91dHB1dFBhdGgsIGkxOG4pO1xuXG4gICAgICAgICAgICAgIGNvbnN0IHNjcmlwdHNFbnRyeVBvaW50TmFtZSA9IG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5zY3JpcHRzIHx8IFtdLFxuICAgICAgICAgICAgICAgICdzY3JpcHRzJyxcbiAgICAgICAgICAgICAgKS5tYXAoKHgpID0+IHguYnVuZGxlTmFtZSk7XG5cbiAgICAgICAgICAgICAgaWYgKGkxOG4uc2hvdWxkSW5saW5lKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3VjY2VzcyA9IGF3YWl0IGkxOG5JbmxpbmVFbWl0dGVkRmlsZXMoXG4gICAgICAgICAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgICAgICAgICAgZW1pdHRlZEZpbGVzLFxuICAgICAgICAgICAgICAgICAgaTE4bixcbiAgICAgICAgICAgICAgICAgIGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICAgICAgICAgICAgQXJyYXkuZnJvbShvdXRwdXRQYXRocy52YWx1ZXMoKSksXG4gICAgICAgICAgICAgICAgICBzY3JpcHRzRW50cnlQb2ludE5hbWUsXG4gICAgICAgICAgICAgICAgICB3ZWJwYWNrT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgICAgIHRhcmdldCA8PSBTY3JpcHRUYXJnZXQuRVM1LFxuICAgICAgICAgICAgICAgICAgb3B0aW9ucy5pMThuTWlzc2luZ1RyYW5zbGF0aW9uLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIENoZWNrIGZvciBidWRnZXQgZXJyb3JzIGFuZCBkaXNwbGF5IHRoZW0gdG8gdGhlIHVzZXIuXG4gICAgICAgICAgICAgIGNvbnN0IGJ1ZGdldHMgPSBvcHRpb25zLmJ1ZGdldHM7XG4gICAgICAgICAgICAgIGxldCBidWRnZXRGYWlsdXJlczogQnVkZ2V0Q2FsY3VsYXRvclJlc3VsdFtdIHwgdW5kZWZpbmVkO1xuICAgICAgICAgICAgICBpZiAoYnVkZ2V0cz8ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgYnVkZ2V0RmFpbHVyZXMgPSBbLi4uY2hlY2tCdWRnZXRzKGJ1ZGdldHMsIHdlYnBhY2tTdGF0cyldO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgeyBzZXZlcml0eSwgbWVzc2FnZSB9IG9mIGJ1ZGdldEZhaWx1cmVzKSB7XG4gICAgICAgICAgICAgICAgICBzd2l0Y2ggKHNldmVyaXR5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgVGhyZXNob2xkU2V2ZXJpdHkuV2FybmluZzpcbiAgICAgICAgICAgICAgICAgICAgICB3ZWJwYWNrU3RhdHMud2FybmluZ3M/LnB1c2goeyBtZXNzYWdlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFRocmVzaG9sZFNldmVyaXR5LkVycm9yOlxuICAgICAgICAgICAgICAgICAgICAgIHdlYnBhY2tTdGF0cy5lcnJvcnM/LnB1c2goeyBtZXNzYWdlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgIGFzc2VydE5ldmVyKHNldmVyaXR5KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBidWlsZFN1Y2Nlc3MgPSBzdWNjZXNzICYmICFzdGF0c0hhc0Vycm9ycyh3ZWJwYWNrU3RhdHMpO1xuICAgICAgICAgICAgICBpZiAoYnVpbGRTdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgLy8gQ29weSBhc3NldHNcbiAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnMud2F0Y2ggJiYgb3B0aW9ucy5hc3NldHM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdGFydCgnQ29weWluZyBhc3NldHMuLi4nKTtcbiAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGNvcHlBc3NldHMoXG4gICAgICAgICAgICAgICAgICAgICAgbm9ybWFsaXplQXNzZXRQYXR0ZXJucyhcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuYXNzZXRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvamVjdFJvb3QsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9qZWN0U291cmNlUm9vdCxcbiAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgICAgIEFycmF5LmZyb20ob3V0cHV0UGF0aHMudmFsdWVzKCkpLFxuICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdWNjZWVkKCdDb3B5aW5nIGFzc2V0cyBjb21wbGV0ZS4nKTtcbiAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBzcGlubmVyLmZhaWwoY29sb3JzLnJlZEJyaWdodCgnQ29weWluZyBvZiBhc3NldHMgZmFpbGVkLicpKTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdVbmFibGUgdG8gY29weSBhc3NldHM6ICcgKyBlcnIubWVzc2FnZSB9O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmluZGV4KSB7XG4gICAgICAgICAgICAgICAgICBzcGlubmVyLnN0YXJ0KCdHZW5lcmF0aW5nIGluZGV4IGh0bWwuLi4nKTtcblxuICAgICAgICAgICAgICAgICAgY29uc3QgZW50cnlwb2ludHMgPSBnZW5lcmF0ZUVudHJ5UG9pbnRzKHtcbiAgICAgICAgICAgICAgICAgICAgc2NyaXB0czogb3B0aW9ucy5zY3JpcHRzID8/IFtdLFxuICAgICAgICAgICAgICAgICAgICBzdHlsZXM6IG9wdGlvbnMuc3R5bGVzID8/IFtdLFxuICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4SHRtbEdlbmVyYXRvciA9IG5ldyBJbmRleEh0bWxHZW5lcmF0b3Ioe1xuICAgICAgICAgICAgICAgICAgICBjYWNoZTogY2FjaGVPcHRpb25zLFxuICAgICAgICAgICAgICAgICAgICBpbmRleFBhdGg6IHBhdGguam9pbihjb250ZXh0LndvcmtzcGFjZVJvb3QsIGdldEluZGV4SW5wdXRGaWxlKG9wdGlvbnMuaW5kZXgpKSxcbiAgICAgICAgICAgICAgICAgICAgZW50cnlwb2ludHMsXG4gICAgICAgICAgICAgICAgICAgIGRlcGxveVVybDogb3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgICAgICAgICAgICAgICAgIHNyaTogb3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSxcbiAgICAgICAgICAgICAgICAgICAgb3B0aW1pemF0aW9uOiBub3JtYWxpemVkT3B0aW1pemF0aW9uLFxuICAgICAgICAgICAgICAgICAgICBjcm9zc09yaWdpbjogb3B0aW9ucy5jcm9zc09yaWdpbixcbiAgICAgICAgICAgICAgICAgICAgcG9zdFRyYW5zZm9ybTogdHJhbnNmb3Jtcy5pbmRleEh0bWwsXG4gICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgbGV0IGhhc0Vycm9ycyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBbbG9jYWxlLCBvdXRwdXRQYXRoXSBvZiBvdXRwdXRQYXRocy5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IGluZGV4SHRtbEdlbmVyYXRvci5wcm9jZXNzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJhc2VIcmVmOiBnZXRMb2NhbGVCYXNlSHJlZihpMThuLCBsb2NhbGUpIHx8IGRlZmF1bHRCYXNlSHJlZixcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGkxOG5Mb2NhbGUgaXMgdXNlZCB3aGVuIEl2eSBpcyBkaXNhYmxlZFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFuZzogbG9jYWxlIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlczogbWFwRW1pdHRlZEZpbGVzVG9GaWxlSW5mbyhlbWl0dGVkRmlsZXMpLFxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHdhcm5pbmdzLmxlbmd0aCB8fCBlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcGlubmVyLnN0b3AoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdhcm5pbmdzLmZvckVhY2goKG0pID0+IGNvbnRleHQubG9nZ2VyLndhcm4obSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLmZvckVhY2goKG0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IobSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGhhc0Vycm9ycyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3RhcnQoKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleE91dHB1dCA9IHBhdGguam9pbihvdXRwdXRQYXRoLCBnZXRJbmRleE91dHB1dEZpbGUob3B0aW9ucy5pbmRleCkpO1xuICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHBhdGguZGlybmFtZShpbmRleE91dHB1dCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLndyaXRlRmlsZShpbmRleE91dHB1dCwgY29udGVudCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5mYWlsKCdJbmRleCBodG1sIGdlbmVyYXRpb24gZmFpbGVkLicpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBtYXBFcnJvclRvTWVzc2FnZShlcnJvcikgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBpZiAoaGFzRXJyb3JzKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuZmFpbCgnSW5kZXggaHRtbCBnZW5lcmF0aW9uIGZhaWxlZC4nKTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdWNjZWVkKCdJbmRleCBodG1sIGdlbmVyYXRpb24gY29tcGxldGUuJyk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuc2VydmljZVdvcmtlcikge1xuICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdGFydCgnR2VuZXJhdGluZyBzZXJ2aWNlIHdvcmtlci4uLicpO1xuICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBbbG9jYWxlLCBvdXRwdXRQYXRoXSBvZiBvdXRwdXRQYXRocy5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIoXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9qZWN0Um9vdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBnZXRMb2NhbGVCYXNlSHJlZihpMThuLCBsb2NhbGUpID8/IGRlZmF1bHRCYXNlSHJlZixcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMubmdzd0NvbmZpZ1BhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzcGlubmVyLmZhaWwoJ1NlcnZpY2Ugd29ya2VyIGdlbmVyYXRpb24gZmFpbGVkLicpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBtYXBFcnJvclRvTWVzc2FnZShlcnJvcikgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBzcGlubmVyLnN1Y2NlZWQoJ1NlcnZpY2Ugd29ya2VyIGdlbmVyYXRpb24gY29tcGxldGUuJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgd2VicGFja1N0YXRzTG9nZ2VyKGNvbnRleHQubG9nZ2VyLCB3ZWJwYWNrU3RhdHMsIGNvbmZpZywgYnVkZ2V0RmFpbHVyZXMpO1xuXG4gICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGJ1aWxkU3VjY2VzcyB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG1hcChcbiAgICAgICAgICAgIChldmVudCkgPT5cbiAgICAgICAgICAgICAgKHtcbiAgICAgICAgICAgICAgICAuLi5ldmVudCxcbiAgICAgICAgICAgICAgICBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgICBvdXRwdXRQYXRoOiBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgICBvdXRwdXRQYXRoczogKG91dHB1dFBhdGhzICYmIEFycmF5LmZyb20ob3V0cHV0UGF0aHMudmFsdWVzKCkpKSB8fCBbYmFzZU91dHB1dFBhdGhdLFxuICAgICAgICAgICAgICAgIG91dHB1dHM6IChvdXRwdXRQYXRocyAmJlxuICAgICAgICAgICAgICAgICAgWy4uLm91dHB1dFBhdGhzLmVudHJpZXMoKV0ubWFwKChbbG9jYWxlLCBwYXRoXSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxlLFxuICAgICAgICAgICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgICAgICAgICBiYXNlSHJlZjogZ2V0TG9jYWxlQmFzZUhyZWYoaTE4biwgbG9jYWxlKSA/PyBkZWZhdWx0QmFzZUhyZWYsXG4gICAgICAgICAgICAgICAgICB9KSkpIHx8IHtcbiAgICAgICAgICAgICAgICAgIHBhdGg6IGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICAgICAgICAgICAgYmFzZUhyZWY6IGRlZmF1bHRCYXNlSHJlZixcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9IGFzIEJyb3dzZXJCdWlsZGVyT3V0cHV0KSxcbiAgICAgICAgICApLFxuICAgICAgICApO1xuICAgICAgfSxcbiAgICApLFxuICApO1xuXG4gIGZ1bmN0aW9uIGdldExvY2FsZUJhc2VIcmVmKGkxOG46IEkxOG5PcHRpb25zLCBsb2NhbGU6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKGkxOG4ubG9jYWxlc1tsb2NhbGVdICYmIGkxOG4ubG9jYWxlc1tsb2NhbGVdPy5iYXNlSHJlZiAhPT0gJycpIHtcbiAgICAgIHJldHVybiB1cmxKb2luKG9wdGlvbnMuYmFzZUhyZWYgfHwgJycsIGkxOG4ubG9jYWxlc1tsb2NhbGVdLmJhc2VIcmVmID8/IGAvJHtsb2NhbGV9L2ApO1xuICAgIH1cblxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gbWFwRXJyb3JUb01lc3NhZ2UoZXJyb3I6IHVua25vd24pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgIHJldHVybiBlcnJvci5tZXNzYWdlO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBlcnJvciA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZXJyb3I7XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBhc3NlcnROZXZlcihpbnB1dDogbmV2ZXIpOiBuZXZlciB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICBgVW5leHBlY3RlZCBjYWxsIHRvIGFzc2VydE5ldmVyKCkgd2l0aCBpbnB1dDogJHtKU09OLnN0cmluZ2lmeShcbiAgICAgIGlucHV0LFxuICAgICAgbnVsbCAvKiByZXBsYWNlciAqLyxcbiAgICAgIDQgLyogdGFiU2l6ZSAqLyxcbiAgICApfWAsXG4gICk7XG59XG5cbmZ1bmN0aW9uIG1hcEVtaXR0ZWRGaWxlc1RvRmlsZUluZm8oZmlsZXM6IEVtaXR0ZWRGaWxlc1tdID0gW10pOiBGaWxlSW5mb1tdIHtcbiAgY29uc3QgZmlsdGVyZWRGaWxlczogRmlsZUluZm9bXSA9IFtdO1xuICBmb3IgKGNvbnN0IHsgZmlsZSwgbmFtZSwgZXh0ZW5zaW9uLCBpbml0aWFsIH0gb2YgZmlsZXMpIHtcbiAgICBpZiAobmFtZSAmJiBpbml0aWFsKSB7XG4gICAgICBmaWx0ZXJlZEZpbGVzLnB1c2goeyBmaWxlLCBleHRlbnNpb24sIG5hbWUgfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZpbHRlcmVkRmlsZXM7XG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50ZXJuZXRFeHBsb3JlclN1cHBvcnQocHJvamVjdFJvb3Q6IHN0cmluZywgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSk6IHZvaWQge1xuICBjb25zdCBzdXBwb3J0ZWRCcm93c2VycyA9IGdldFN1cHBvcnRlZEJyb3dzZXJzKHByb2plY3RSb290KTtcbiAgaWYgKHN1cHBvcnRlZEJyb3dzZXJzLnNvbWUoKGIpID0+IGIgPT09ICdpZSA5JyB8fCBiID09PSAnaWUgMTAnIHx8IGIgPT09ICdpZSAxMScpKSB7XG4gICAgbG9nZ2VyLndhcm4oXG4gICAgICBgV2FybmluZzogU3VwcG9ydCB3YXMgcmVxdWVzdGVkIGZvciBJbnRlcm5ldCBFeHBsb3JlciBpbiB0aGUgcHJvamVjdCdzIGJyb3dzZXJzbGlzdCBjb25maWd1cmF0aW9uLiBgICtcbiAgICAgICAgJ0ludGVybmV0IEV4cGxvcmVyIGlzIG5vIGxvbmdlciBvZmZpY2lhbGx5IHN1cHBvcnRlZC4nICtcbiAgICAgICAgJ1xcbkZvciBtb3JlIGluZm9ybWF0aW9uLCBzZWUgaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2Jyb3dzZXItc3VwcG9ydCcsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyPEJyb3dzZXJCdWlsZGVyU2NoZW1hPihidWlsZFdlYnBhY2tCcm93c2VyKTtcbiJdfQ==