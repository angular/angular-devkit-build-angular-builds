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
exports.buildWebpackBrowser = exports.BUILD_TIMEOUT = void 0;
const architect_1 = require("@angular-devkit/architect");
const build_webpack_1 = require("@angular-devkit/build-webpack");
const core_1 = require("@angular-devkit/core");
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
        (0, utils_1.normalizeAssetPatterns)(options.assets, (0, core_1.normalize)(context.workspaceRoot), (0, core_1.normalize)(projectRoot), projectSourceRoot === undefined ? undefined : (0, core_1.normalize)(projectSourceRoot)).forEach(({ output }) => {
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
            var _a, _b, _c, _d, _e;
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
                            await (0, copy_assets_1.copyAssets)((0, utils_1.normalizeAssetPatterns)(options.assets, (0, core_1.normalize)(context.workspaceRoot), (0, core_1.normalize)(projectRoot), projectSourceRoot === undefined ? undefined : (0, core_1.normalize)(projectSourceRoot)), Array.from(outputPaths.values()), context.workspaceRoot);
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
                                    baseHref: getLocaleBaseHref(i18n, locale) || options.baseHref,
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
                                await (0, service_worker_1.augmentAppWithServiceWorker)((0, core_1.normalize)(projectRoot), (0, core_1.normalize)(outputPath), getLocaleBaseHref(i18n, locale) || options.baseHref || '/', options.ngswConfigPath);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsaUVBQWlHO0FBQ2pHLCtDQUEwRDtBQUMxRCx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLCtCQUF3QztBQUN4Qyw4Q0FBMkQ7QUFDM0QsMkNBQTBDO0FBRzFDLHVDQUtxQjtBQUNyQixxRUFJdUM7QUFDdkMsNkNBQTJDO0FBQzNDLHlEQUFxRDtBQUNyRCw2REFBbUU7QUFHbkUsc0ZBR3FEO0FBQ3JELGlFQUFvRTtBQUNwRSwyREFBNkQ7QUFDN0QsdUVBQXFFO0FBQ3JFLHlEQUErRDtBQUMvRCwrREFBeUU7QUFDekUsaURBQThDO0FBQzlDLHVFQUFzRTtBQUN0RSxpREFBcUU7QUFDckUsK0VBSTRDO0FBQzVDLG1EQUE2RjtBQUM3RixtRUFBNkU7QUFDN0UseURBQXdFO0FBQ3hFLHFEQU1tQztBQWVuQzs7O0dBR0c7QUFDVSxRQUFBLGFBQWEsR0FBRyxLQUFNLENBQUM7QUFFcEMsS0FBSyxVQUFVLFVBQVUsQ0FDdkIsT0FBNkIsRUFDN0IsT0FBdUIsRUFDdkIsNkJBQTJFOztJQVEzRSxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUM7SUFFOUMsb0VBQW9FO0lBQ3BFLE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLENBQUM7SUFFN0UsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLE1B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QyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7U0FDL0M7S0FDRjtJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUM7QUFFRCxTQUFTLDRCQUE0QixDQUFDLFdBQW1CLEVBQUUsTUFBeUI7SUFDbEYsTUFBTSxpQkFBaUIsR0FBRyxJQUFBLHlDQUFvQixFQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQzVELElBQUksaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssTUFBTSxJQUFJLENBQUMsS0FBSyxPQUFPLElBQUksQ0FBQyxLQUFLLE9BQU8sQ0FBQyxFQUFFO1FBQ2pGLE1BQU0sQ0FBQyxJQUFJLENBQ1Qsb0dBQW9HO1lBQ2xHLHNEQUFzRDtZQUN0RCxzRUFBc0UsQ0FDekUsQ0FBQztLQUNIO0FBQ0gsQ0FBQztBQUVELGtCQUFlLElBQUEseUJBQWEsRUFBdUIsbUJBQW1CLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgRW1pdHRlZEZpbGVzLCBXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrLCBydW5XZWJwYWNrIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLXdlYnBhY2snO1xuaW1wb3J0IHsgbG9nZ2luZywgbm9ybWFsaXplIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbWFwLCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgRXhlY3V0aW9uVHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7XG4gIGRlbGV0ZU91dHB1dERpcixcbiAgbm9ybWFsaXplQXNzZXRQYXR0ZXJucyxcbiAgbm9ybWFsaXplT3B0aW1pemF0aW9uLFxuICB1cmxKb2luLFxufSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQge1xuICBCdWRnZXRDYWxjdWxhdG9yUmVzdWx0LFxuICBUaHJlc2hvbGRTZXZlcml0eSxcbiAgY2hlY2tCdWRnZXRzLFxufSBmcm9tICcuLi8uLi91dGlscy9idW5kbGUtY2FsY3VsYXRvcic7XG5pbXBvcnQgeyBjb2xvcnMgfSBmcm9tICcuLi8uLi91dGlscy9jb2xvcic7XG5pbXBvcnQgeyBjb3B5QXNzZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29weS1hc3NldHMnO1xuaW1wb3J0IHsgaTE4bklubGluZUVtaXR0ZWRGaWxlcyB9IGZyb20gJy4uLy4uL3V0aWxzL2kxOG4taW5saW5pbmcnO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgRmlsZUluZm8gfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2F1Z21lbnQtaW5kZXgtaHRtbCc7XG5pbXBvcnQge1xuICBJbmRleEh0bWxHZW5lcmF0b3IsXG4gIEluZGV4SHRtbFRyYW5zZm9ybSxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBub3JtYWxpemVDYWNoZU9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9ub3JtYWxpemUtY2FjaGUnO1xuaW1wb3J0IHsgZW5zdXJlT3V0cHV0UGF0aHMgfSBmcm9tICcuLi8uLi91dGlscy9vdXRwdXQtcGF0aHMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cyB9IGZyb20gJy4uLy4uL3V0aWxzL3BhY2thZ2UtY2h1bmstc29ydCc7XG5pbXBvcnQgeyBwdXJnZVN0YWxlQnVpbGRDYWNoZSB9IGZyb20gJy4uLy4uL3V0aWxzL3B1cmdlLWNhY2hlJztcbmltcG9ydCB7IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlciB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IFNwaW5uZXIgfSBmcm9tICcuLi8uLi91dGlscy9zcGlubmVyJztcbmltcG9ydCB7IGdldFN1cHBvcnRlZEJyb3dzZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3VwcG9ydGVkLWJyb3dzZXJzJztcbmltcG9ydCB7IGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbiB9IGZyb20gJy4uLy4uL3V0aWxzL3ZlcnNpb24nO1xuaW1wb3J0IHtcbiAgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dCxcbiAgZ2V0SW5kZXhJbnB1dEZpbGUsXG4gIGdldEluZGV4T3V0cHV0RmlsZSxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBnZXRBbmFseXRpY3NDb25maWcsIGdldENvbW1vbkNvbmZpZywgZ2V0U3R5bGVzQ29uZmlnIH0gZnJvbSAnLi4vLi4vd2VicGFjay9jb25maWdzJztcbmltcG9ydCB7IG1hcmtBc3luY0NodW5rc05vbkluaXRpYWwgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL2FzeW5jLWNodW5rcyc7XG5pbXBvcnQgeyBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzIH0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9oZWxwZXJzJztcbmltcG9ydCB7XG4gIHN0YXRzRXJyb3JzVG9TdHJpbmcsXG4gIHN0YXRzSGFzRXJyb3JzLFxuICBzdGF0c0hhc1dhcm5pbmdzLFxuICBzdGF0c1dhcm5pbmdzVG9TdHJpbmcsXG4gIHdlYnBhY2tTdGF0c0xvZ2dlcixcbn0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyB0eXBlIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgdHlwZSBCcm93c2VyQnVpbGRlck91dHB1dCA9IEJ1aWxkZXJPdXRwdXQgJiB7XG4gIGJhc2VPdXRwdXRQYXRoOiBzdHJpbmc7XG4gIG91dHB1dFBhdGhzOiBzdHJpbmdbXTtcbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIGluIHZlcnNpb24gOS4gVXNlICdvdXRwdXRQYXRocycgaW5zdGVhZC5cbiAgICovXG4gIG91dHB1dFBhdGg6IHN0cmluZztcbn07XG5cbi8qKlxuICogTWF4aW11bSB0aW1lIGluIG1pbGxpc2Vjb25kcyBmb3Igc2luZ2xlIGJ1aWxkL3JlYnVpbGRcbiAqIFRoaXMgYWNjb3VudHMgZm9yIENJIHZhcmlhYmlsaXR5LlxuICovXG5leHBvcnQgY29uc3QgQlVJTERfVElNRU9VVCA9IDMwXzAwMDtcblxuYXN5bmMgZnVuY3Rpb24gaW5pdGlhbGl6ZShcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybT86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPHdlYnBhY2suQ29uZmlndXJhdGlvbj4sXG4pOiBQcm9taXNlPHtcbiAgY29uZmlnOiB3ZWJwYWNrLkNvbmZpZ3VyYXRpb247XG4gIHByb2plY3RSb290OiBzdHJpbmc7XG4gIHByb2plY3RTb3VyY2VSb290Pzogc3RyaW5nO1xuICBpMThuOiBJMThuT3B0aW9ucztcbiAgdGFyZ2V0OiBTY3JpcHRUYXJnZXQ7XG59PiB7XG4gIGNvbnN0IG9yaWdpbmFsT3V0cHV0UGF0aCA9IG9wdGlvbnMub3V0cHV0UGF0aDtcblxuICAvLyBBc3NldHMgYXJlIHByb2Nlc3NlZCBkaXJlY3RseSBieSB0aGUgYnVpbGRlciBleGNlcHQgd2hlbiB3YXRjaGluZ1xuICBjb25zdCBhZGp1c3RlZE9wdGlvbnMgPSBvcHRpb25zLndhdGNoID8gb3B0aW9ucyA6IHsgLi4ub3B0aW9ucywgYXNzZXRzOiBbXSB9O1xuXG4gIGNvbnN0IHsgY29uZmlnLCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QsIGkxOG4sIHRhcmdldCB9ID1cbiAgICBhd2FpdCBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KGFkanVzdGVkT3B0aW9ucywgY29udGV4dCwgKHdjbykgPT4gW1xuICAgICAgZ2V0Q29tbW9uQ29uZmlnKHdjbyksXG4gICAgICBnZXRTdHlsZXNDb25maWcod2NvKSxcbiAgICAgIGdldEFuYWx5dGljc0NvbmZpZyh3Y28sIGNvbnRleHQpLFxuICAgIF0pO1xuXG4gIC8vIFZhbGlkYXRlIGFzc2V0IG9wdGlvbiB2YWx1ZXMgaWYgcHJvY2Vzc2VkIGRpcmVjdGx5XG4gIGlmIChvcHRpb25zLmFzc2V0cz8ubGVuZ3RoICYmICFhZGp1c3RlZE9wdGlvbnMuYXNzZXRzPy5sZW5ndGgpIHtcbiAgICBub3JtYWxpemVBc3NldFBhdHRlcm5zKFxuICAgICAgb3B0aW9ucy5hc3NldHMsXG4gICAgICBub3JtYWxpemUoY29udGV4dC53b3Jrc3BhY2VSb290KSxcbiAgICAgIG5vcm1hbGl6ZShwcm9qZWN0Um9vdCksXG4gICAgICBwcm9qZWN0U291cmNlUm9vdCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogbm9ybWFsaXplKHByb2plY3RTb3VyY2VSb290KSxcbiAgICApLmZvckVhY2goKHsgb3V0cHV0IH0pID0+IHtcbiAgICAgIGlmIChvdXRwdXQuc3RhcnRzV2l0aCgnLi4nKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FuIGFzc2V0IGNhbm5vdCBiZSB3cml0dGVuIHRvIGEgbG9jYXRpb24gb3V0c2lkZSBvZiB0aGUgb3V0cHV0IHBhdGguJyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBsZXQgdHJhbnNmb3JtZWRDb25maWc7XG4gIGlmICh3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybSkge1xuICAgIHRyYW5zZm9ybWVkQ29uZmlnID0gYXdhaXQgd2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm0oY29uZmlnKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLmRlbGV0ZU91dHB1dFBhdGgpIHtcbiAgICBkZWxldGVPdXRwdXREaXIoY29udGV4dC53b3Jrc3BhY2VSb290LCBvcmlnaW5hbE91dHB1dFBhdGgpO1xuICB9XG5cbiAgcmV0dXJuIHsgY29uZmlnOiB0cmFuc2Zvcm1lZENvbmZpZyB8fCBjb25maWcsIHByb2plY3RSb290LCBwcm9qZWN0U291cmNlUm9vdCwgaTE4biwgdGFyZ2V0IH07XG59XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFdlYnBhY2tCcm93c2VyKFxuICBvcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHRyYW5zZm9ybXM6IHtcbiAgICB3ZWJwYWNrQ29uZmlndXJhdGlvbj86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPHdlYnBhY2suQ29uZmlndXJhdGlvbj47XG4gICAgbG9nZ2luZz86IFdlYnBhY2tMb2dnaW5nQ2FsbGJhY2s7XG4gICAgaW5kZXhIdG1sPzogSW5kZXhIdG1sVHJhbnNmb3JtO1xuICB9ID0ge30sXG4pOiBPYnNlcnZhYmxlPEJyb3dzZXJCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQ/LnByb2plY3Q7XG4gIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0LicpO1xuICB9XG5cbiAgY29uc3QgYmFzZU91dHB1dFBhdGggPSBwYXRoLnJlc29sdmUoY29udGV4dC53b3Jrc3BhY2VSb290LCBvcHRpb25zLm91dHB1dFBhdGgpO1xuICBsZXQgb3V0cHV0UGF0aHM6IHVuZGVmaW5lZCB8IE1hcDxzdHJpbmcsIHN0cmluZz47XG5cbiAgLy8gQ2hlY2sgQW5ndWxhciB2ZXJzaW9uLlxuICBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24oY29udGV4dC53b3Jrc3BhY2VSb290KTtcblxuICByZXR1cm4gZnJvbShjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSkpLnBpcGUoXG4gICAgc3dpdGNoTWFwKGFzeW5jIChwcm9qZWN0TWV0YWRhdGEpID0+IHtcbiAgICAgIC8vIFB1cmdlIG9sZCBidWlsZCBkaXNrIGNhY2hlLlxuICAgICAgYXdhaXQgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUoY29udGV4dCk7XG5cbiAgICAgIC8vIEluaXRpYWxpemUgYnVpbGRlclxuICAgICAgY29uc3QgaW5pdGlhbGl6YXRpb24gPSBhd2FpdCBpbml0aWFsaXplKG9wdGlvbnMsIGNvbnRleHQsIHRyYW5zZm9ybXMud2VicGFja0NvbmZpZ3VyYXRpb24pO1xuXG4gICAgICAvLyBDaGVjayBhbmQgd2FybiBhYm91dCBJRSBicm93c2VyIHN1cHBvcnRcbiAgICAgIGNoZWNrSW50ZXJuZXRFeHBsb3JlclN1cHBvcnQoaW5pdGlhbGl6YXRpb24ucHJvamVjdFJvb3QsIGNvbnRleHQubG9nZ2VyKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4uaW5pdGlhbGl6YXRpb24sXG4gICAgICAgIGNhY2hlT3B0aW9uczogbm9ybWFsaXplQ2FjaGVPcHRpb25zKHByb2plY3RNZXRhZGF0YSwgY29udGV4dC53b3Jrc3BhY2VSb290KSxcbiAgICAgIH07XG4gICAgfSksXG4gICAgc3dpdGNoTWFwKFxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbiAgICAgICh7IGNvbmZpZywgcHJvamVjdFJvb3QsIHByb2plY3RTb3VyY2VSb290LCBpMThuLCB0YXJnZXQsIGNhY2hlT3B0aW9ucyB9KSA9PiB7XG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWRPcHRpbWl6YXRpb24gPSBub3JtYWxpemVPcHRpbWl6YXRpb24ob3B0aW9ucy5vcHRpbWl6YXRpb24pO1xuXG4gICAgICAgIHJldHVybiBydW5XZWJwYWNrKGNvbmZpZywgY29udGV4dCwge1xuICAgICAgICAgIHdlYnBhY2tGYWN0b3J5OiByZXF1aXJlKCd3ZWJwYWNrJykgYXMgdHlwZW9mIHdlYnBhY2ssXG4gICAgICAgICAgbG9nZ2luZzpcbiAgICAgICAgICAgIHRyYW5zZm9ybXMubG9nZ2luZyB8fFxuICAgICAgICAgICAgKChzdGF0cywgY29uZmlnKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChvcHRpb25zLnZlcmJvc2UpIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKHN0YXRzLnRvU3RyaW5nKGNvbmZpZy5zdGF0cykpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgfSkucGlwZShcbiAgICAgICAgICBjb25jYXRNYXAoYXN5bmMgKGJ1aWxkRXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcigpO1xuICAgICAgICAgICAgc3Bpbm5lci5lbmFibGVkID0gb3B0aW9ucy5wcm9ncmVzcyAhPT0gZmFsc2U7XG5cbiAgICAgICAgICAgIGNvbnN0IHsgc3VjY2VzcywgZW1pdHRlZEZpbGVzID0gW10sIG91dHB1dFBhdGg6IHdlYnBhY2tPdXRwdXRQYXRoIH0gPSBidWlsZEV2ZW50O1xuICAgICAgICAgICAgY29uc3Qgd2VicGFja1Jhd1N0YXRzID0gYnVpbGRFdmVudC53ZWJwYWNrU3RhdHM7XG4gICAgICAgICAgICBpZiAoIXdlYnBhY2tSYXdTdGF0cykge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYnBhY2sgc3RhdHMgYnVpbGQgcmVzdWx0IGlzIHJlcXVpcmVkLicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBGaXggaW5jb3JyZWN0bHkgc2V0IGBpbml0aWFsYCB2YWx1ZSBvbiBjaHVua3MuXG4gICAgICAgICAgICBjb25zdCBleHRyYUVudHJ5UG9pbnRzID0gW1xuICAgICAgICAgICAgICAuLi5ub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKG9wdGlvbnMuc3R5bGVzIHx8IFtdLCAnc3R5bGVzJyksXG4gICAgICAgICAgICAgIC4uLm5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMob3B0aW9ucy5zY3JpcHRzIHx8IFtdLCAnc2NyaXB0cycpLFxuICAgICAgICAgICAgXTtcblxuICAgICAgICAgICAgY29uc3Qgd2VicGFja1N0YXRzID0ge1xuICAgICAgICAgICAgICAuLi53ZWJwYWNrUmF3U3RhdHMsXG4gICAgICAgICAgICAgIGNodW5rczogbWFya0FzeW5jQ2h1bmtzTm9uSW5pdGlhbCh3ZWJwYWNrUmF3U3RhdHMsIGV4dHJhRW50cnlQb2ludHMpLFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICAgICAgICAgIC8vIElmIHVzaW5nIGJ1bmRsZSBkb3dubGV2ZWxpbmcgdGhlbiB0aGVyZSBpcyBvbmx5IG9uZSBidWlsZFxuICAgICAgICAgICAgICAvLyBJZiBpdCBmYWlscyBzaG93IGFueSBkaWFnbm9zdGljIG1lc3NhZ2VzIGFuZCBiYWlsXG4gICAgICAgICAgICAgIGlmIChzdGF0c0hhc1dhcm5pbmdzKHdlYnBhY2tTdGF0cykpIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmxvZ2dlci53YXJuKHN0YXRzV2FybmluZ3NUb1N0cmluZyh3ZWJwYWNrU3RhdHMsIHsgY29sb3JzOiB0cnVlIH0pKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoc3RhdHNIYXNFcnJvcnMod2VicGFja1N0YXRzKSkge1xuICAgICAgICAgICAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKHN0YXRzRXJyb3JzVG9TdHJpbmcod2VicGFja1N0YXRzLCB7IGNvbG9yczogdHJ1ZSB9KSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzIH07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvdXRwdXRQYXRocyA9IGVuc3VyZU91dHB1dFBhdGhzKGJhc2VPdXRwdXRQYXRoLCBpMThuKTtcblxuICAgICAgICAgICAgICBjb25zdCBzY3JpcHRzRW50cnlQb2ludE5hbWUgPSBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKFxuICAgICAgICAgICAgICAgIG9wdGlvbnMuc2NyaXB0cyB8fCBbXSxcbiAgICAgICAgICAgICAgICAnc2NyaXB0cycsXG4gICAgICAgICAgICAgICkubWFwKCh4KSA9PiB4LmJ1bmRsZU5hbWUpO1xuXG4gICAgICAgICAgICAgIGlmIChpMThuLnNob3VsZElubGluZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBhd2FpdCBpMThuSW5saW5lRW1pdHRlZEZpbGVzKFxuICAgICAgICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgICAgICAgIGVtaXR0ZWRGaWxlcyxcbiAgICAgICAgICAgICAgICAgIGkxOG4sXG4gICAgICAgICAgICAgICAgICBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgICAgIEFycmF5LmZyb20ob3V0cHV0UGF0aHMudmFsdWVzKCkpLFxuICAgICAgICAgICAgICAgICAgc2NyaXB0c0VudHJ5UG9pbnROYW1lLFxuICAgICAgICAgICAgICAgICAgd2VicGFja091dHB1dFBhdGgsXG4gICAgICAgICAgICAgICAgICB0YXJnZXQgPD0gU2NyaXB0VGFyZ2V0LkVTNSxcbiAgICAgICAgICAgICAgICAgIG9wdGlvbnMuaTE4bk1pc3NpbmdUcmFuc2xhdGlvbixcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGlmICghc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBDaGVjayBmb3IgYnVkZ2V0IGVycm9ycyBhbmQgZGlzcGxheSB0aGVtIHRvIHRoZSB1c2VyLlxuICAgICAgICAgICAgICBjb25zdCBidWRnZXRzID0gb3B0aW9ucy5idWRnZXRzO1xuICAgICAgICAgICAgICBsZXQgYnVkZ2V0RmFpbHVyZXM6IEJ1ZGdldENhbGN1bGF0b3JSZXN1bHRbXSB8IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgaWYgKGJ1ZGdldHM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGJ1ZGdldEZhaWx1cmVzID0gWy4uLmNoZWNrQnVkZ2V0cyhidWRnZXRzLCB3ZWJwYWNrU3RhdHMpXTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHsgc2V2ZXJpdHksIG1lc3NhZ2UgfSBvZiBidWRnZXRGYWlsdXJlcykge1xuICAgICAgICAgICAgICAgICAgc3dpdGNoIChzZXZlcml0eSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFRocmVzaG9sZFNldmVyaXR5Lldhcm5pbmc6XG4gICAgICAgICAgICAgICAgICAgICAgd2VicGFja1N0YXRzLndhcm5pbmdzPy5wdXNoKHsgbWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBUaHJlc2hvbGRTZXZlcml0eS5FcnJvcjpcbiAgICAgICAgICAgICAgICAgICAgICB3ZWJwYWNrU3RhdHMuZXJyb3JzPy5wdXNoKHsgbWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICBhc3NlcnROZXZlcihzZXZlcml0eSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgYnVpbGRTdWNjZXNzID0gc3VjY2VzcyAmJiAhc3RhdHNIYXNFcnJvcnMod2VicGFja1N0YXRzKTtcbiAgICAgICAgICAgICAgaWYgKGJ1aWxkU3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIC8vIENvcHkgYXNzZXRzXG4gICAgICAgICAgICAgICAgaWYgKCFvcHRpb25zLndhdGNoICYmIG9wdGlvbnMuYXNzZXRzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3RhcnQoJ0NvcHlpbmcgYXNzZXRzLi4uJyk7XG4gICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBjb3B5QXNzZXRzKFxuICAgICAgICAgICAgICAgICAgICAgIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMoXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmFzc2V0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vcm1hbGl6ZShjb250ZXh0LndvcmtzcGFjZVJvb3QpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9ybWFsaXplKHByb2plY3RSb290KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb2plY3RTb3VyY2VSb290ID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBub3JtYWxpemUocHJvamVjdFNvdXJjZVJvb3QpLFxuICAgICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAgICAgQXJyYXkuZnJvbShvdXRwdXRQYXRocy52YWx1ZXMoKSksXG4gICAgICAgICAgICAgICAgICAgICAgY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICBzcGlubmVyLnN1Y2NlZWQoJ0NvcHlpbmcgYXNzZXRzIGNvbXBsZXRlLicpO1xuICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuZmFpbChjb2xvcnMucmVkQnJpZ2h0KCdDb3B5aW5nIG9mIGFzc2V0cyBmYWlsZWQuJykpO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1VuYWJsZSB0byBjb3B5IGFzc2V0czogJyArIGVyci5tZXNzYWdlIH07XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3RhcnQoJ0dlbmVyYXRpbmcgaW5kZXggaHRtbC4uLicpO1xuXG4gICAgICAgICAgICAgICAgICBjb25zdCBlbnRyeXBvaW50cyA9IGdlbmVyYXRlRW50cnlQb2ludHMoe1xuICAgICAgICAgICAgICAgICAgICBzY3JpcHRzOiBvcHRpb25zLnNjcmlwdHMgPz8gW10sXG4gICAgICAgICAgICAgICAgICAgIHN0eWxlczogb3B0aW9ucy5zdHlsZXMgPz8gW10sXG4gICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXhIdG1sR2VuZXJhdG9yID0gbmV3IEluZGV4SHRtbEdlbmVyYXRvcih7XG4gICAgICAgICAgICAgICAgICAgIGNhY2hlOiBjYWNoZU9wdGlvbnMsXG4gICAgICAgICAgICAgICAgICAgIGluZGV4UGF0aDogcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgZ2V0SW5kZXhJbnB1dEZpbGUob3B0aW9ucy5pbmRleCkpLFxuICAgICAgICAgICAgICAgICAgICBlbnRyeXBvaW50cyxcbiAgICAgICAgICAgICAgICAgICAgZGVwbG95VXJsOiBvcHRpb25zLmRlcGxveVVybCxcbiAgICAgICAgICAgICAgICAgICAgc3JpOiBvcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgICAgICAgICAgICAgICAgICBvcHRpbWl6YXRpb246IG5vcm1hbGl6ZWRPcHRpbWl6YXRpb24sXG4gICAgICAgICAgICAgICAgICAgIGNyb3NzT3JpZ2luOiBvcHRpb25zLmNyb3NzT3JpZ2luLFxuICAgICAgICAgICAgICAgICAgICBwb3N0VHJhbnNmb3JtOiB0cmFuc2Zvcm1zLmluZGV4SHRtbCxcbiAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICBsZXQgaGFzRXJyb3JzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtsb2NhbGUsIG91dHB1dFBhdGhdIG9mIG91dHB1dFBhdGhzLmVudHJpZXMoKSkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgY29udGVudCwgd2FybmluZ3MsIGVycm9ycyB9ID0gYXdhaXQgaW5kZXhIdG1sR2VuZXJhdG9yLnByb2Nlc3Moe1xuICAgICAgICAgICAgICAgICAgICAgICAgYmFzZUhyZWY6IGdldExvY2FsZUJhc2VIcmVmKGkxOG4sIGxvY2FsZSkgfHwgb3B0aW9ucy5iYXNlSHJlZixcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGkxOG5Mb2NhbGUgaXMgdXNlZCB3aGVuIEl2eSBpcyBkaXNhYmxlZFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFuZzogbG9jYWxlIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlczogbWFwRW1pdHRlZEZpbGVzVG9GaWxlSW5mbyhlbWl0dGVkRmlsZXMpLFxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHdhcm5pbmdzLmxlbmd0aCB8fCBlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcGlubmVyLnN0b3AoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdhcm5pbmdzLmZvckVhY2goKG0pID0+IGNvbnRleHQubG9nZ2VyLndhcm4obSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLmZvckVhY2goKG0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IobSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGhhc0Vycm9ycyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3RhcnQoKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleE91dHB1dCA9IHBhdGguam9pbihvdXRwdXRQYXRoLCBnZXRJbmRleE91dHB1dEZpbGUob3B0aW9ucy5pbmRleCkpO1xuICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHBhdGguZGlybmFtZShpbmRleE91dHB1dCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLndyaXRlRmlsZShpbmRleE91dHB1dCwgY29udGVudCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5mYWlsKCdJbmRleCBodG1sIGdlbmVyYXRpb24gZmFpbGVkLicpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBtYXBFcnJvclRvTWVzc2FnZShlcnJvcikgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBpZiAoaGFzRXJyb3JzKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuZmFpbCgnSW5kZXggaHRtbCBnZW5lcmF0aW9uIGZhaWxlZC4nKTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdWNjZWVkKCdJbmRleCBodG1sIGdlbmVyYXRpb24gY29tcGxldGUuJyk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuc2VydmljZVdvcmtlcikge1xuICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdGFydCgnR2VuZXJhdGluZyBzZXJ2aWNlIHdvcmtlci4uLicpO1xuICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBbbG9jYWxlLCBvdXRwdXRQYXRoXSBvZiBvdXRwdXRQYXRocy5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIoXG4gICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemUocHJvamVjdFJvb3QpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9ybWFsaXplKG91dHB1dFBhdGgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgZ2V0TG9jYWxlQmFzZUhyZWYoaTE4biwgbG9jYWxlKSB8fCBvcHRpb25zLmJhc2VIcmVmIHx8ICcvJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMubmdzd0NvbmZpZ1BhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzcGlubmVyLmZhaWwoJ1NlcnZpY2Ugd29ya2VyIGdlbmVyYXRpb24gZmFpbGVkLicpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBtYXBFcnJvclRvTWVzc2FnZShlcnJvcikgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBzcGlubmVyLnN1Y2NlZWQoJ1NlcnZpY2Ugd29ya2VyIGdlbmVyYXRpb24gY29tcGxldGUuJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgd2VicGFja1N0YXRzTG9nZ2VyKGNvbnRleHQubG9nZ2VyLCB3ZWJwYWNrU3RhdHMsIGNvbmZpZywgYnVkZ2V0RmFpbHVyZXMpO1xuXG4gICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGJ1aWxkU3VjY2VzcyB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG1hcChcbiAgICAgICAgICAgIChldmVudCkgPT5cbiAgICAgICAgICAgICAgKHtcbiAgICAgICAgICAgICAgICAuLi5ldmVudCxcbiAgICAgICAgICAgICAgICBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgICBvdXRwdXRQYXRoOiBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgICBvdXRwdXRQYXRoczogKG91dHB1dFBhdGhzICYmIEFycmF5LmZyb20ob3V0cHV0UGF0aHMudmFsdWVzKCkpKSB8fCBbYmFzZU91dHB1dFBhdGhdLFxuICAgICAgICAgICAgICB9IGFzIEJyb3dzZXJCdWlsZGVyT3V0cHV0KSxcbiAgICAgICAgICApLFxuICAgICAgICApO1xuICAgICAgfSxcbiAgICApLFxuICApO1xuXG4gIGZ1bmN0aW9uIGdldExvY2FsZUJhc2VIcmVmKGkxOG46IEkxOG5PcHRpb25zLCBsb2NhbGU6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKGkxOG4ubG9jYWxlc1tsb2NhbGVdICYmIGkxOG4ubG9jYWxlc1tsb2NhbGVdPy5iYXNlSHJlZiAhPT0gJycpIHtcbiAgICAgIHJldHVybiB1cmxKb2luKG9wdGlvbnMuYmFzZUhyZWYgfHwgJycsIGkxOG4ubG9jYWxlc1tsb2NhbGVdLmJhc2VIcmVmID8/IGAvJHtsb2NhbGV9L2ApO1xuICAgIH1cblxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gbWFwRXJyb3JUb01lc3NhZ2UoZXJyb3I6IHVua25vd24pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgIHJldHVybiBlcnJvci5tZXNzYWdlO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBlcnJvciA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZXJyb3I7XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBhc3NlcnROZXZlcihpbnB1dDogbmV2ZXIpOiBuZXZlciB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICBgVW5leHBlY3RlZCBjYWxsIHRvIGFzc2VydE5ldmVyKCkgd2l0aCBpbnB1dDogJHtKU09OLnN0cmluZ2lmeShcbiAgICAgIGlucHV0LFxuICAgICAgbnVsbCAvKiByZXBsYWNlciAqLyxcbiAgICAgIDQgLyogdGFiU2l6ZSAqLyxcbiAgICApfWAsXG4gICk7XG59XG5cbmZ1bmN0aW9uIG1hcEVtaXR0ZWRGaWxlc1RvRmlsZUluZm8oZmlsZXM6IEVtaXR0ZWRGaWxlc1tdID0gW10pOiBGaWxlSW5mb1tdIHtcbiAgY29uc3QgZmlsdGVyZWRGaWxlczogRmlsZUluZm9bXSA9IFtdO1xuICBmb3IgKGNvbnN0IHsgZmlsZSwgbmFtZSwgZXh0ZW5zaW9uLCBpbml0aWFsIH0gb2YgZmlsZXMpIHtcbiAgICBpZiAobmFtZSAmJiBpbml0aWFsKSB7XG4gICAgICBmaWx0ZXJlZEZpbGVzLnB1c2goeyBmaWxlLCBleHRlbnNpb24sIG5hbWUgfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZpbHRlcmVkRmlsZXM7XG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50ZXJuZXRFeHBsb3JlclN1cHBvcnQocHJvamVjdFJvb3Q6IHN0cmluZywgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSk6IHZvaWQge1xuICBjb25zdCBzdXBwb3J0ZWRCcm93c2VycyA9IGdldFN1cHBvcnRlZEJyb3dzZXJzKHByb2plY3RSb290KTtcbiAgaWYgKHN1cHBvcnRlZEJyb3dzZXJzLnNvbWUoKGIpID0+IGIgPT09ICdpZSA5JyB8fCBiID09PSAnaWUgMTAnIHx8IGIgPT09ICdpZSAxMScpKSB7XG4gICAgbG9nZ2VyLndhcm4oXG4gICAgICBgV2FybmluZzogU3VwcG9ydCB3YXMgcmVxdWVzdGVkIGZvciBJbnRlcm5ldCBFeHBsb3JlciBpbiB0aGUgcHJvamVjdCdzIGJyb3dzZXJzbGlzdCBjb25maWd1cmF0aW9uLiBgICtcbiAgICAgICAgJ0ludGVybmV0IEV4cGxvcmVyIGlzIG5vIGxvbmdlciBvZmZpY2lhbGx5IHN1cHBvcnRlZC4nICtcbiAgICAgICAgJ1xcbkZvciBtb3JlIGluZm9ybWF0aW9uLCBzZWUgaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2Jyb3dzZXItc3VwcG9ydCcsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyPEJyb3dzZXJCdWlsZGVyU2NoZW1hPihidWlsZFdlYnBhY2tCcm93c2VyKTtcbiJdfQ==