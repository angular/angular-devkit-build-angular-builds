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
        const normalizedOptimization = (0, utils_1.normalizeOptimization)(options.optimization);
        return (0, build_webpack_1.runWebpack)(config, context, {
            webpackFactory: require('webpack'),
            logging: transforms.logging ||
                ((stats, config) => {
                    if (options.verbose) {
                        context.logger.info(stats.toString(config.stats));
                    }
                }),
        }).pipe((0, operators_1.concatMap)(async (buildEvent) => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
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
                                    baseHref: (_f = getLocaleBaseHref(i18n, locale)) !== null && _f !== void 0 ? _f : options.baseHref,
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
                                await (0, service_worker_1.augmentAppWithServiceWorker)(projectRoot, context.workspaceRoot, outputPath, (_h = (_g = getLocaleBaseHref(i18n, locale)) !== null && _g !== void 0 ? _g : options.baseHref) !== null && _h !== void 0 ? _h : '/', options.ngswConfigPath);
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
                        baseHref: (_a = getLocaleBaseHref(i18n, locale)) !== null && _a !== void 0 ? _a : options.baseHref,
                    });
                })) || {
                path: baseOutputPath,
                baseHref: options.baseHref,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQXlGO0FBQ3pGLGlFQUFpRztBQUVqRyx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLCtCQUF3QztBQUN4Qyw4Q0FBMkQ7QUFDM0QsMkNBQTBDO0FBRzFDLHVDQUtxQjtBQUNyQixxRUFJdUM7QUFDdkMsNkNBQTJDO0FBQzNDLHlEQUFxRDtBQUNyRCw2REFBbUU7QUFHbkUsc0ZBR3FEO0FBQ3JELGlFQUFvRTtBQUNwRSwyREFBNkQ7QUFDN0QsdUVBQXFFO0FBQ3JFLHlEQUErRDtBQUMvRCwrREFBeUU7QUFDekUsaURBQThDO0FBQzlDLHVFQUFzRTtBQUN0RSxpREFBcUU7QUFDckUsK0VBSTRDO0FBQzVDLG1EQUE2RjtBQUM3RixtRUFBNkU7QUFDN0UseURBQXdFO0FBQ3hFLHFEQU1tQztBQXdCbkM7OztHQUdHO0FBQ1UsUUFBQSxhQUFhLEdBQUcsS0FBTSxDQUFDO0FBRXBDLEtBQUssVUFBVSxVQUFVLENBQ3ZCLE9BQTZCLEVBQzdCLE9BQXVCLEVBQ3ZCLDZCQUEyRTs7SUFRM0UsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDO0lBRTlDLG9FQUFvRTtJQUNwRSxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxDQUFDO0lBRTdFLE1BQU0sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUs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QUFJLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxJQUFJLEtBQUssRUFBRTtRQUN0RCxJQUFJLElBQUksSUFBSSxPQUFPLEVBQUU7WUFDbkIsYUFBYSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztTQUMvQztLQUNGO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQztBQUVELFNBQVMsNEJBQTRCLENBQUMsV0FBbUIsRUFBRSxNQUF5QjtJQUNsRixNQUFNLGlCQUFpQixHQUFHLElBQUEseUNBQW9CLEVBQUMsV0FBVyxDQUFDLENBQUM7SUFDNUQsSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBSyxNQUFNLElBQUksQ0FBQyxLQUFLLE9BQU8sSUFBSSxDQUFDLEtBQUssT0FBTyxDQUFDLEVBQUU7UUFDakYsTUFBTSxDQUFDLElBQUksQ0FDVCxvR0FBb0c7WUFDbEcsc0RBQXNEO1lBQ3RELHNFQUFzRSxDQUN6RSxDQUFDO0tBQ0g7QUFDSCxDQUFDO0FBRUQsa0JBQWUsSUFBQSx5QkFBYSxFQUF1QixtQkFBbUIsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBFbWl0dGVkRmlsZXMsIFdlYnBhY2tMb2dnaW5nQ2FsbGJhY2ssIHJ1bldlYnBhY2sgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyBsb2dnaW5nIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbWFwLCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgRXhlY3V0aW9uVHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7XG4gIGRlbGV0ZU91dHB1dERpcixcbiAgbm9ybWFsaXplQXNzZXRQYXR0ZXJucyxcbiAgbm9ybWFsaXplT3B0aW1pemF0aW9uLFxuICB1cmxKb2luLFxufSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQge1xuICBCdWRnZXRDYWxjdWxhdG9yUmVzdWx0LFxuICBUaHJlc2hvbGRTZXZlcml0eSxcbiAgY2hlY2tCdWRnZXRzLFxufSBmcm9tICcuLi8uLi91dGlscy9idW5kbGUtY2FsY3VsYXRvcic7XG5pbXBvcnQgeyBjb2xvcnMgfSBmcm9tICcuLi8uLi91dGlscy9jb2xvcic7XG5pbXBvcnQgeyBjb3B5QXNzZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29weS1hc3NldHMnO1xuaW1wb3J0IHsgaTE4bklubGluZUVtaXR0ZWRGaWxlcyB9IGZyb20gJy4uLy4uL3V0aWxzL2kxOG4taW5saW5pbmcnO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgRmlsZUluZm8gfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2F1Z21lbnQtaW5kZXgtaHRtbCc7XG5pbXBvcnQge1xuICBJbmRleEh0bWxHZW5lcmF0b3IsXG4gIEluZGV4SHRtbFRyYW5zZm9ybSxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBub3JtYWxpemVDYWNoZU9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9ub3JtYWxpemUtY2FjaGUnO1xuaW1wb3J0IHsgZW5zdXJlT3V0cHV0UGF0aHMgfSBmcm9tICcuLi8uLi91dGlscy9vdXRwdXQtcGF0aHMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cyB9IGZyb20gJy4uLy4uL3V0aWxzL3BhY2thZ2UtY2h1bmstc29ydCc7XG5pbXBvcnQgeyBwdXJnZVN0YWxlQnVpbGRDYWNoZSB9IGZyb20gJy4uLy4uL3V0aWxzL3B1cmdlLWNhY2hlJztcbmltcG9ydCB7IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlciB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IFNwaW5uZXIgfSBmcm9tICcuLi8uLi91dGlscy9zcGlubmVyJztcbmltcG9ydCB7IGdldFN1cHBvcnRlZEJyb3dzZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3VwcG9ydGVkLWJyb3dzZXJzJztcbmltcG9ydCB7IGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbiB9IGZyb20gJy4uLy4uL3V0aWxzL3ZlcnNpb24nO1xuaW1wb3J0IHtcbiAgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dCxcbiAgZ2V0SW5kZXhJbnB1dEZpbGUsXG4gIGdldEluZGV4T3V0cHV0RmlsZSxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBnZXRBbmFseXRpY3NDb25maWcsIGdldENvbW1vbkNvbmZpZywgZ2V0U3R5bGVzQ29uZmlnIH0gZnJvbSAnLi4vLi4vd2VicGFjay9jb25maWdzJztcbmltcG9ydCB7IG1hcmtBc3luY0NodW5rc05vbkluaXRpYWwgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL2FzeW5jLWNodW5rcyc7XG5pbXBvcnQgeyBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzIH0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9oZWxwZXJzJztcbmltcG9ydCB7XG4gIHN0YXRzRXJyb3JzVG9TdHJpbmcsXG4gIHN0YXRzSGFzRXJyb3JzLFxuICBzdGF0c0hhc1dhcm5pbmdzLFxuICBzdGF0c1dhcm5pbmdzVG9TdHJpbmcsXG4gIHdlYnBhY2tTdGF0c0xvZ2dlcixcbn0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyB0eXBlIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgdHlwZSBCcm93c2VyQnVpbGRlck91dHB1dCA9IEJ1aWxkZXJPdXRwdXQgJiB7XG4gIGJhc2VPdXRwdXRQYXRoOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBAZGVwcmVjYXRlZCBpbiB2ZXJzaW9uIDE0LiBVc2UgJ291dHB1dHMnIGluc3RlYWQuXG4gICAqL1xuICBvdXRwdXRQYXRoczogc3RyaW5nW107XG4gIC8qKlxuICAgKiBAZGVwcmVjYXRlZCBpbiB2ZXJzaW9uIDkuIFVzZSAnb3V0cHV0cycgaW5zdGVhZC5cbiAgICovXG4gIG91dHB1dFBhdGg6IHN0cmluZztcblxuICBvdXRwdXRzOiB7XG4gICAgbG9jYWxlPzogc3RyaW5nO1xuICAgIHBhdGg6IHN0cmluZztcbiAgICBiYXNlSHJlZj86IHN0cmluZztcbiAgfVtdO1xufTtcblxuLyoqXG4gKiBNYXhpbXVtIHRpbWUgaW4gbWlsbGlzZWNvbmRzIGZvciBzaW5nbGUgYnVpbGQvcmVidWlsZFxuICogVGhpcyBhY2NvdW50cyBmb3IgQ0kgdmFyaWFiaWxpdHkuXG4gKi9cbmV4cG9ydCBjb25zdCBCVUlMRF9USU1FT1VUID0gMzBfMDAwO1xuXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplKFxuICBvcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8d2VicGFjay5Db25maWd1cmF0aW9uPixcbik6IFByb21pc2U8e1xuICBjb25maWc6IHdlYnBhY2suQ29uZmlndXJhdGlvbjtcbiAgcHJvamVjdFJvb3Q6IHN0cmluZztcbiAgcHJvamVjdFNvdXJjZVJvb3Q/OiBzdHJpbmc7XG4gIGkxOG46IEkxOG5PcHRpb25zO1xuICB0YXJnZXQ6IFNjcmlwdFRhcmdldDtcbn0+IHtcbiAgY29uc3Qgb3JpZ2luYWxPdXRwdXRQYXRoID0gb3B0aW9ucy5vdXRwdXRQYXRoO1xuXG4gIC8vIEFzc2V0cyBhcmUgcHJvY2Vzc2VkIGRpcmVjdGx5IGJ5IHRoZSBidWlsZGVyIGV4Y2VwdCB3aGVuIHdhdGNoaW5nXG4gIGNvbnN0IGFkanVzdGVkT3B0aW9ucyA9IG9wdGlvbnMud2F0Y2ggPyBvcHRpb25zIDogeyAuLi5vcHRpb25zLCBhc3NldHM6IFtdIH07XG5cbiAgY29uc3QgeyBjb25maWcsIHByb2plY3RSb290LCBwcm9qZWN0U291cmNlUm9vdCwgaTE4biwgdGFyZ2V0IH0gPVxuICAgIGF3YWl0IGdlbmVyYXRlSTE4bkJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQoYWRqdXN0ZWRPcHRpb25zLCBjb250ZXh0LCAod2NvKSA9PiBbXG4gICAgICBnZXRDb21tb25Db25maWcod2NvKSxcbiAgICAgIGdldFN0eWxlc0NvbmZpZyh3Y28pLFxuICAgICAgZ2V0QW5hbHl0aWNzQ29uZmlnKHdjbywgY29udGV4dCksXG4gICAgXSk7XG5cbiAgLy8gVmFsaWRhdGUgYXNzZXQgb3B0aW9uIHZhbHVlcyBpZiBwcm9jZXNzZWQgZGlyZWN0bHlcbiAgaWYgKG9wdGlvbnMuYXNzZXRzPy5sZW5ndGggJiYgIWFkanVzdGVkT3B0aW9ucy5hc3NldHM/Lmxlbmd0aCkge1xuICAgIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMoXG4gICAgICBvcHRpb25zLmFzc2V0cyxcbiAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgIHByb2plY3RSb290LFxuICAgICAgcHJvamVjdFNvdXJjZVJvb3QsXG4gICAgKS5mb3JFYWNoKCh7IG91dHB1dCB9KSA9PiB7XG4gICAgICBpZiAob3V0cHV0LnN0YXJ0c1dpdGgoJy4uJykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbiBhc3NldCBjYW5ub3QgYmUgd3JpdHRlbiB0byBhIGxvY2F0aW9uIG91dHNpZGUgb2YgdGhlIG91dHB1dCBwYXRoLicpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgbGV0IHRyYW5zZm9ybWVkQ29uZmlnO1xuICBpZiAod2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm0pIHtcbiAgICB0cmFuc2Zvcm1lZENvbmZpZyA9IGF3YWl0IHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtKGNvbmZpZyk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoKSB7XG4gICAgZGVsZXRlT3V0cHV0RGlyKGNvbnRleHQud29ya3NwYWNlUm9vdCwgb3JpZ2luYWxPdXRwdXRQYXRoKTtcbiAgfVxuXG4gIHJldHVybiB7IGNvbmZpZzogdHJhbnNmb3JtZWRDb25maWcgfHwgY29uZmlnLCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QsIGkxOG4sIHRhcmdldCB9O1xufVxuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRXZWJwYWNrQnJvd3NlcihcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zOiB7XG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb24/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+O1xuICAgIGxvZ2dpbmc/OiBXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrO1xuICAgIGluZGV4SHRtbD86IEluZGV4SHRtbFRyYW5zZm9ybTtcbiAgfSA9IHt9LFxuKTogT2JzZXJ2YWJsZTxCcm93c2VyQnVpbGRlck91dHB1dD4ge1xuICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0Py5wcm9qZWN0O1xuICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldC4nKTtcbiAgfVxuXG4gIGNvbnN0IGJhc2VPdXRwdXRQYXRoID0gcGF0aC5yZXNvbHZlKGNvbnRleHQud29ya3NwYWNlUm9vdCwgb3B0aW9ucy5vdXRwdXRQYXRoKTtcbiAgbGV0IG91dHB1dFBhdGhzOiB1bmRlZmluZWQgfCBNYXA8c3RyaW5nLCBzdHJpbmc+O1xuXG4gIC8vIENoZWNrIEFuZ3VsYXIgdmVyc2lvbi5cbiAgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uKGNvbnRleHQud29ya3NwYWNlUm9vdCk7XG5cbiAgcmV0dXJuIGZyb20oY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpKS5waXBlKFxuICAgIHN3aXRjaE1hcChhc3luYyAocHJvamVjdE1ldGFkYXRhKSA9PiB7XG4gICAgICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgICAgIGF3YWl0IHB1cmdlU3RhbGVCdWlsZENhY2hlKGNvbnRleHQpO1xuXG4gICAgICAvLyBJbml0aWFsaXplIGJ1aWxkZXJcbiAgICAgIGNvbnN0IGluaXRpYWxpemF0aW9uID0gYXdhaXQgaW5pdGlhbGl6ZShvcHRpb25zLCBjb250ZXh0LCB0cmFuc2Zvcm1zLndlYnBhY2tDb25maWd1cmF0aW9uKTtcblxuICAgICAgLy8gQ2hlY2sgYW5kIHdhcm4gYWJvdXQgSUUgYnJvd3NlciBzdXBwb3J0XG4gICAgICBjaGVja0ludGVybmV0RXhwbG9yZXJTdXBwb3J0KGluaXRpYWxpemF0aW9uLnByb2plY3RSb290LCBjb250ZXh0LmxvZ2dlcik7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIC4uLmluaXRpYWxpemF0aW9uLFxuICAgICAgICBjYWNoZU9wdGlvbnM6IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyhwcm9qZWN0TWV0YWRhdGEsIGNvbnRleHQud29ya3NwYWNlUm9vdCksXG4gICAgICB9O1xuICAgIH0pLFxuICAgIHN3aXRjaE1hcChcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG4gICAgICAoeyBjb25maWcsIHByb2plY3RSb290LCBwcm9qZWN0U291cmNlUm9vdCwgaTE4biwgdGFyZ2V0LCBjYWNoZU9wdGlvbnMgfSkgPT4ge1xuICAgICAgICBjb25zdCBub3JtYWxpemVkT3B0aW1pemF0aW9uID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKG9wdGlvbnMub3B0aW1pemF0aW9uKTtcblxuICAgICAgICByZXR1cm4gcnVuV2VicGFjayhjb25maWcsIGNvbnRleHQsIHtcbiAgICAgICAgICB3ZWJwYWNrRmFjdG9yeTogcmVxdWlyZSgnd2VicGFjaycpIGFzIHR5cGVvZiB3ZWJwYWNrLFxuICAgICAgICAgIGxvZ2dpbmc6XG4gICAgICAgICAgICB0cmFuc2Zvcm1zLmxvZ2dpbmcgfHxcbiAgICAgICAgICAgICgoc3RhdHMsIGNvbmZpZykgPT4ge1xuICAgICAgICAgICAgICBpZiAob3B0aW9ucy52ZXJib3NlKSB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhzdGF0cy50b1N0cmluZyhjb25maWcuc3RhdHMpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSksXG4gICAgICAgIH0pLnBpcGUoXG4gICAgICAgICAgY29uY2F0TWFwKGFzeW5jIChidWlsZEV2ZW50KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzcGlubmVyID0gbmV3IFNwaW5uZXIoKTtcbiAgICAgICAgICAgIHNwaW5uZXIuZW5hYmxlZCA9IG9wdGlvbnMucHJvZ3Jlc3MgIT09IGZhbHNlO1xuXG4gICAgICAgICAgICBjb25zdCB7IHN1Y2Nlc3MsIGVtaXR0ZWRGaWxlcyA9IFtdLCBvdXRwdXRQYXRoOiB3ZWJwYWNrT3V0cHV0UGF0aCB9ID0gYnVpbGRFdmVudDtcbiAgICAgICAgICAgIGNvbnN0IHdlYnBhY2tSYXdTdGF0cyA9IGJ1aWxkRXZlbnQud2VicGFja1N0YXRzO1xuICAgICAgICAgICAgaWYgKCF3ZWJwYWNrUmF3U3RhdHMpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdXZWJwYWNrIHN0YXRzIGJ1aWxkIHJlc3VsdCBpcyByZXF1aXJlZC4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRml4IGluY29ycmVjdGx5IHNldCBgaW5pdGlhbGAgdmFsdWUgb24gY2h1bmtzLlxuICAgICAgICAgICAgY29uc3QgZXh0cmFFbnRyeVBvaW50cyA9IFtcbiAgICAgICAgICAgICAgLi4ubm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhvcHRpb25zLnN0eWxlcyB8fCBbXSwgJ3N0eWxlcycpLFxuICAgICAgICAgICAgICAuLi5ub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKG9wdGlvbnMuc2NyaXB0cyB8fCBbXSwgJ3NjcmlwdHMnKSxcbiAgICAgICAgICAgIF07XG5cbiAgICAgICAgICAgIGNvbnN0IHdlYnBhY2tTdGF0cyA9IHtcbiAgICAgICAgICAgICAgLi4ud2VicGFja1Jhd1N0YXRzLFxuICAgICAgICAgICAgICBjaHVua3M6IG1hcmtBc3luY0NodW5rc05vbkluaXRpYWwod2VicGFja1Jhd1N0YXRzLCBleHRyYUVudHJ5UG9pbnRzKSxcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmICghc3VjY2Vzcykge1xuICAgICAgICAgICAgICAvLyBJZiB1c2luZyBidW5kbGUgZG93bmxldmVsaW5nIHRoZW4gdGhlcmUgaXMgb25seSBvbmUgYnVpbGRcbiAgICAgICAgICAgICAgLy8gSWYgaXQgZmFpbHMgc2hvdyBhbnkgZGlhZ25vc3RpYyBtZXNzYWdlcyBhbmQgYmFpbFxuICAgICAgICAgICAgICBpZiAoc3RhdHNIYXNXYXJuaW5ncyh3ZWJwYWNrU3RhdHMpKSB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5sb2dnZXIud2FybihzdGF0c1dhcm5pbmdzVG9TdHJpbmcod2VicGFja1N0YXRzLCB7IGNvbG9yczogdHJ1ZSB9KSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHN0YXRzSGFzRXJyb3JzKHdlYnBhY2tTdGF0cykpIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihzdGF0c0Vycm9yc1RvU3RyaW5nKHdlYnBhY2tTdGF0cywgeyBjb2xvcnM6IHRydWUgfSkpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzcyB9O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgb3V0cHV0UGF0aHMgPSBlbnN1cmVPdXRwdXRQYXRocyhiYXNlT3V0cHV0UGF0aCwgaTE4bik7XG5cbiAgICAgICAgICAgICAgY29uc3Qgc2NyaXB0c0VudHJ5UG9pbnROYW1lID0gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhcbiAgICAgICAgICAgICAgICBvcHRpb25zLnNjcmlwdHMgfHwgW10sXG4gICAgICAgICAgICAgICAgJ3NjcmlwdHMnLFxuICAgICAgICAgICAgICApLm1hcCgoeCkgPT4geC5idW5kbGVOYW1lKTtcblxuICAgICAgICAgICAgICBpZiAoaTE4bi5zaG91bGRJbmxpbmUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdWNjZXNzID0gYXdhaXQgaTE4bklubGluZUVtaXR0ZWRGaWxlcyhcbiAgICAgICAgICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAgICAgICAgICBlbWl0dGVkRmlsZXMsXG4gICAgICAgICAgICAgICAgICBpMThuLFxuICAgICAgICAgICAgICAgICAgYmFzZU91dHB1dFBhdGgsXG4gICAgICAgICAgICAgICAgICBBcnJheS5mcm9tKG91dHB1dFBhdGhzLnZhbHVlcygpKSxcbiAgICAgICAgICAgICAgICAgIHNjcmlwdHNFbnRyeVBvaW50TmFtZSxcbiAgICAgICAgICAgICAgICAgIHdlYnBhY2tPdXRwdXRQYXRoLFxuICAgICAgICAgICAgICAgICAgdGFyZ2V0IDw9IFNjcmlwdFRhcmdldC5FUzUsXG4gICAgICAgICAgICAgICAgICBvcHRpb25zLmkxOG5NaXNzaW5nVHJhbnNsYXRpb24sXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIGJ1ZGdldCBlcnJvcnMgYW5kIGRpc3BsYXkgdGhlbSB0byB0aGUgdXNlci5cbiAgICAgICAgICAgICAgY29uc3QgYnVkZ2V0cyA9IG9wdGlvbnMuYnVkZ2V0cztcbiAgICAgICAgICAgICAgbGV0IGJ1ZGdldEZhaWx1cmVzOiBCdWRnZXRDYWxjdWxhdG9yUmVzdWx0W10gfCB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgIGlmIChidWRnZXRzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBidWRnZXRGYWlsdXJlcyA9IFsuLi5jaGVja0J1ZGdldHMoYnVkZ2V0cywgd2VicGFja1N0YXRzKV07XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB7IHNldmVyaXR5LCBtZXNzYWdlIH0gb2YgYnVkZ2V0RmFpbHVyZXMpIHtcbiAgICAgICAgICAgICAgICAgIHN3aXRjaCAoc2V2ZXJpdHkpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBUaHJlc2hvbGRTZXZlcml0eS5XYXJuaW5nOlxuICAgICAgICAgICAgICAgICAgICAgIHdlYnBhY2tTdGF0cy53YXJuaW5ncz8ucHVzaCh7IG1lc3NhZ2UgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgVGhyZXNob2xkU2V2ZXJpdHkuRXJyb3I6XG4gICAgICAgICAgICAgICAgICAgICAgd2VicGFja1N0YXRzLmVycm9ycz8ucHVzaCh7IG1lc3NhZ2UgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0TmV2ZXIoc2V2ZXJpdHkpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IGJ1aWxkU3VjY2VzcyA9IHN1Y2Nlc3MgJiYgIXN0YXRzSGFzRXJyb3JzKHdlYnBhY2tTdGF0cyk7XG4gICAgICAgICAgICAgIGlmIChidWlsZFN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAvLyBDb3B5IGFzc2V0c1xuICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy53YXRjaCAmJiBvcHRpb25zLmFzc2V0cz8ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICBzcGlubmVyLnN0YXJ0KCdDb3B5aW5nIGFzc2V0cy4uLicpO1xuICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgY29weUFzc2V0cyhcbiAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemVBc3NldFBhdHRlcm5zKFxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5hc3NldHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9qZWN0Um9vdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb2plY3RTb3VyY2VSb290LFxuICAgICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAgICAgQXJyYXkuZnJvbShvdXRwdXRQYXRocy52YWx1ZXMoKSksXG4gICAgICAgICAgICAgICAgICAgICAgY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICBzcGlubmVyLnN1Y2NlZWQoJ0NvcHlpbmcgYXNzZXRzIGNvbXBsZXRlLicpO1xuICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuZmFpbChjb2xvcnMucmVkQnJpZ2h0KCdDb3B5aW5nIG9mIGFzc2V0cyBmYWlsZWQuJykpO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1VuYWJsZSB0byBjb3B5IGFzc2V0czogJyArIGVyci5tZXNzYWdlIH07XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3RhcnQoJ0dlbmVyYXRpbmcgaW5kZXggaHRtbC4uLicpO1xuXG4gICAgICAgICAgICAgICAgICBjb25zdCBlbnRyeXBvaW50cyA9IGdlbmVyYXRlRW50cnlQb2ludHMoe1xuICAgICAgICAgICAgICAgICAgICBzY3JpcHRzOiBvcHRpb25zLnNjcmlwdHMgPz8gW10sXG4gICAgICAgICAgICAgICAgICAgIHN0eWxlczogb3B0aW9ucy5zdHlsZXMgPz8gW10sXG4gICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXhIdG1sR2VuZXJhdG9yID0gbmV3IEluZGV4SHRtbEdlbmVyYXRvcih7XG4gICAgICAgICAgICAgICAgICAgIGNhY2hlOiBjYWNoZU9wdGlvbnMsXG4gICAgICAgICAgICAgICAgICAgIGluZGV4UGF0aDogcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgZ2V0SW5kZXhJbnB1dEZpbGUob3B0aW9ucy5pbmRleCkpLFxuICAgICAgICAgICAgICAgICAgICBlbnRyeXBvaW50cyxcbiAgICAgICAgICAgICAgICAgICAgZGVwbG95VXJsOiBvcHRpb25zLmRlcGxveVVybCxcbiAgICAgICAgICAgICAgICAgICAgc3JpOiBvcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgICAgICAgICAgICAgICAgICBvcHRpbWl6YXRpb246IG5vcm1hbGl6ZWRPcHRpbWl6YXRpb24sXG4gICAgICAgICAgICAgICAgICAgIGNyb3NzT3JpZ2luOiBvcHRpb25zLmNyb3NzT3JpZ2luLFxuICAgICAgICAgICAgICAgICAgICBwb3N0VHJhbnNmb3JtOiB0cmFuc2Zvcm1zLmluZGV4SHRtbCxcbiAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICBsZXQgaGFzRXJyb3JzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtsb2NhbGUsIG91dHB1dFBhdGhdIG9mIG91dHB1dFBhdGhzLmVudHJpZXMoKSkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgY29udGVudCwgd2FybmluZ3MsIGVycm9ycyB9ID0gYXdhaXQgaW5kZXhIdG1sR2VuZXJhdG9yLnByb2Nlc3Moe1xuICAgICAgICAgICAgICAgICAgICAgICAgYmFzZUhyZWY6IGdldExvY2FsZUJhc2VIcmVmKGkxOG4sIGxvY2FsZSkgPz8gb3B0aW9ucy5iYXNlSHJlZixcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGkxOG5Mb2NhbGUgaXMgdXNlZCB3aGVuIEl2eSBpcyBkaXNhYmxlZFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFuZzogbG9jYWxlIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlczogbWFwRW1pdHRlZEZpbGVzVG9GaWxlSW5mbyhlbWl0dGVkRmlsZXMpLFxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHdhcm5pbmdzLmxlbmd0aCB8fCBlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcGlubmVyLnN0b3AoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdhcm5pbmdzLmZvckVhY2goKG0pID0+IGNvbnRleHQubG9nZ2VyLndhcm4obSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLmZvckVhY2goKG0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IobSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGhhc0Vycm9ycyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3RhcnQoKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleE91dHB1dCA9IHBhdGguam9pbihvdXRwdXRQYXRoLCBnZXRJbmRleE91dHB1dEZpbGUob3B0aW9ucy5pbmRleCkpO1xuICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHBhdGguZGlybmFtZShpbmRleE91dHB1dCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLndyaXRlRmlsZShpbmRleE91dHB1dCwgY29udGVudCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5mYWlsKCdJbmRleCBodG1sIGdlbmVyYXRpb24gZmFpbGVkLicpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBtYXBFcnJvclRvTWVzc2FnZShlcnJvcikgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBpZiAoaGFzRXJyb3JzKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuZmFpbCgnSW5kZXggaHRtbCBnZW5lcmF0aW9uIGZhaWxlZC4nKTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdWNjZWVkKCdJbmRleCBodG1sIGdlbmVyYXRpb24gY29tcGxldGUuJyk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuc2VydmljZVdvcmtlcikge1xuICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdGFydCgnR2VuZXJhdGluZyBzZXJ2aWNlIHdvcmtlci4uLicpO1xuICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBbbG9jYWxlLCBvdXRwdXRQYXRoXSBvZiBvdXRwdXRQYXRocy5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIoXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9qZWN0Um9vdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBnZXRMb2NhbGVCYXNlSHJlZihpMThuLCBsb2NhbGUpID8/IG9wdGlvbnMuYmFzZUhyZWYgPz8gJy8nLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5uZ3N3Q29uZmlnUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuZmFpbCgnU2VydmljZSB3b3JrZXIgZ2VuZXJhdGlvbiBmYWlsZWQuJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IG1hcEVycm9yVG9NZXNzYWdlKGVycm9yKSB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3VjY2VlZCgnU2VydmljZSB3b3JrZXIgZ2VuZXJhdGlvbiBjb21wbGV0ZS4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB3ZWJwYWNrU3RhdHNMb2dnZXIoY29udGV4dC5sb2dnZXIsIHdlYnBhY2tTdGF0cywgY29uZmlnLCBidWRnZXRGYWlsdXJlcyk7XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogYnVpbGRTdWNjZXNzIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSksXG4gICAgICAgICAgbWFwKFxuICAgICAgICAgICAgKGV2ZW50KSA9PlxuICAgICAgICAgICAgICAoe1xuICAgICAgICAgICAgICAgIC4uLmV2ZW50LFxuICAgICAgICAgICAgICAgIGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICAgICAgICAgIG91dHB1dFBhdGg6IGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICAgICAgICAgIG91dHB1dFBhdGhzOiAob3V0cHV0UGF0aHMgJiYgQXJyYXkuZnJvbShvdXRwdXRQYXRocy52YWx1ZXMoKSkpIHx8IFtiYXNlT3V0cHV0UGF0aF0sXG4gICAgICAgICAgICAgICAgb3V0cHV0czogKG91dHB1dFBhdGhzICYmXG4gICAgICAgICAgICAgICAgICBbLi4ub3V0cHV0UGF0aHMuZW50cmllcygpXS5tYXAoKFtsb2NhbGUsIHBhdGhdKSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICBsb2NhbGUsXG4gICAgICAgICAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICAgICAgICAgIGJhc2VIcmVmOiBnZXRMb2NhbGVCYXNlSHJlZihpMThuLCBsb2NhbGUpID8/IG9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgICAgICAgICAgICB9KSkpIHx8IHtcbiAgICAgICAgICAgICAgICAgIHBhdGg6IGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICAgICAgICAgICAgYmFzZUhyZWY6IG9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSBhcyBCcm93c2VyQnVpbGRlck91dHB1dCksXG4gICAgICAgICAgKSxcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgKSxcbiAgKTtcblxuICBmdW5jdGlvbiBnZXRMb2NhbGVCYXNlSHJlZihpMThuOiBJMThuT3B0aW9ucywgbG9jYWxlOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGlmIChpMThuLmxvY2FsZXNbbG9jYWxlXSAmJiBpMThuLmxvY2FsZXNbbG9jYWxlXT8uYmFzZUhyZWYgIT09ICcnKSB7XG4gICAgICByZXR1cm4gdXJsSm9pbihvcHRpb25zLmJhc2VIcmVmIHx8ICcnLCBpMThuLmxvY2FsZXNbbG9jYWxlXS5iYXNlSHJlZiA/PyBgLyR7bG9jYWxlfS9gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1hcEVycm9yVG9NZXNzYWdlKGVycm9yOiB1bmtub3duKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICByZXR1cm4gZXJyb3IubWVzc2FnZTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgZXJyb3IgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGVycm9yO1xuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gYXNzZXJ0TmV2ZXIoaW5wdXQ6IG5ldmVyKTogbmV2ZXIge1xuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgYFVuZXhwZWN0ZWQgY2FsbCB0byBhc3NlcnROZXZlcigpIHdpdGggaW5wdXQ6ICR7SlNPTi5zdHJpbmdpZnkoXG4gICAgICBpbnB1dCxcbiAgICAgIG51bGwgLyogcmVwbGFjZXIgKi8sXG4gICAgICA0IC8qIHRhYlNpemUgKi8sXG4gICAgKX1gLFxuICApO1xufVxuXG5mdW5jdGlvbiBtYXBFbWl0dGVkRmlsZXNUb0ZpbGVJbmZvKGZpbGVzOiBFbWl0dGVkRmlsZXNbXSA9IFtdKTogRmlsZUluZm9bXSB7XG4gIGNvbnN0IGZpbHRlcmVkRmlsZXM6IEZpbGVJbmZvW10gPSBbXTtcbiAgZm9yIChjb25zdCB7IGZpbGUsIG5hbWUsIGV4dGVuc2lvbiwgaW5pdGlhbCB9IG9mIGZpbGVzKSB7XG4gICAgaWYgKG5hbWUgJiYgaW5pdGlhbCkge1xuICAgICAgZmlsdGVyZWRGaWxlcy5wdXNoKHsgZmlsZSwgZXh0ZW5zaW9uLCBuYW1lIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmaWx0ZXJlZEZpbGVzO1xufVxuXG5mdW5jdGlvbiBjaGVja0ludGVybmV0RXhwbG9yZXJTdXBwb3J0KHByb2plY3RSb290OiBzdHJpbmcsIGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXJBcGkpOiB2b2lkIHtcbiAgY29uc3Qgc3VwcG9ydGVkQnJvd3NlcnMgPSBnZXRTdXBwb3J0ZWRCcm93c2Vycyhwcm9qZWN0Um9vdCk7XG4gIGlmIChzdXBwb3J0ZWRCcm93c2Vycy5zb21lKChiKSA9PiBiID09PSAnaWUgOScgfHwgYiA9PT0gJ2llIDEwJyB8fCBiID09PSAnaWUgMTEnKSkge1xuICAgIGxvZ2dlci53YXJuKFxuICAgICAgYFdhcm5pbmc6IFN1cHBvcnQgd2FzIHJlcXVlc3RlZCBmb3IgSW50ZXJuZXQgRXhwbG9yZXIgaW4gdGhlIHByb2plY3QncyBicm93c2Vyc2xpc3QgY29uZmlndXJhdGlvbi4gYCArXG4gICAgICAgICdJbnRlcm5ldCBFeHBsb3JlciBpcyBubyBsb25nZXIgb2ZmaWNpYWxseSBzdXBwb3J0ZWQuJyArXG4gICAgICAgICdcXG5Gb3IgbW9yZSBpbmZvcm1hdGlvbiwgc2VlIGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS9icm93c2VyLXN1cHBvcnQnLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcjxCcm93c2VyQnVpbGRlclNjaGVtYT4oYnVpbGRXZWJwYWNrQnJvd3Nlcik7XG4iXX0=