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
    const root = (0, core_1.normalize)(context.workspaceRoot);
    const projectName = (_a = context.target) === null || _a === void 0 ? void 0 : _a.project;
    if (!projectName) {
        throw new Error('The builder requires a target.');
    }
    const baseOutputPath = path.resolve(context.workspaceRoot, options.outputPath);
    let outputPaths;
    // Check Angular version.
    (0, version_1.assertCompatibleAngularVersion)(context.workspaceRoot);
    return (0, rxjs_1.from)(context.getProjectMetadata(projectName)).pipe((0, operators_1.switchMap)(async (projectMetadata) => {
        var _a;
        const sysProjectRoot = (0, core_1.getSystemPath)((0, core_1.resolve)((0, core_1.normalize)(context.workspaceRoot), (0, core_1.normalize)((_a = projectMetadata.root) !== null && _a !== void 0 ? _a : '')));
        // Purge old build disk cache.
        await (0, purge_cache_1.purgeStaleBuildCache)(context);
        checkInternetExplorerSupport(sysProjectRoot, context.logger);
        return {
            ...(await initialize(options, context, transforms.webpackConfiguration)),
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
                            await (0, copy_assets_1.copyAssets)((0, utils_1.normalizeAssetPatterns)(options.assets, root, (0, core_1.normalize)(projectRoot), projectSourceRoot === undefined ? undefined : (0, core_1.normalize)(projectSourceRoot)), Array.from(outputPaths.values()), context.workspaceRoot);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQXlGO0FBQ3pGLGlFQUFpRztBQUNqRywrQ0FBd0Y7QUFDeEYsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUM3QiwrQkFBd0M7QUFDeEMsOENBQTJEO0FBQzNELDJDQUEwQztBQUcxQyx1Q0FLcUI7QUFDckIscUVBSXVDO0FBQ3ZDLDZDQUEyQztBQUMzQyx5REFBcUQ7QUFDckQsNkRBQW1FO0FBR25FLHNGQUdxRDtBQUNyRCxpRUFBb0U7QUFDcEUsMkRBQTZEO0FBQzdELHVFQUFxRTtBQUNyRSx5REFBK0Q7QUFDL0QsK0RBQXlFO0FBQ3pFLGlEQUE4QztBQUM5Qyx1RUFBc0U7QUFDdEUsaURBQXFFO0FBQ3JFLCtFQUk0QztBQUM1QyxtREFBNkY7QUFDN0YsbUVBQTZFO0FBQzdFLHlEQUF3RTtBQUN4RSxxREFNbUM7QUFnQm5DOzs7R0FHRztBQUNVLFFBQUEsYUFBYSxHQUFHLEtBQU0sQ0FBQztBQUVwQyxLQUFLLFVBQVUsVUFBVSxDQUN2QixPQUE2QixFQUM3QixPQUF1QixFQUN2Qiw2QkFBMkU7O0lBUTNFLE1BQU0sa0JBQWtCLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQztJQUU5QyxvRUFBb0U7SUFDcEUsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsQ0FBQztJQUU3RSxNQUFNLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVB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YUFBYSxHQUFlLEVBQUUsQ0FBQztJQUNyQyxLQUFLLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsSUFBSSxLQUFLLEVBQUU7UUFDdEQsSUFBSSxJQUFJLElBQUksT0FBTyxFQUFFO1lBQ25CLGFBQWEsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7U0FDL0M7S0FDRjtJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUM7QUFFRCxTQUFTLDRCQUE0QixDQUFDLFdBQW1CLEVBQUUsTUFBeUI7SUFDbEYsTUFBTSxpQkFBaUIsR0FBRyxJQUFBLHlDQUFvQixFQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQzVELElBQUksaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssTUFBTSxJQUFJLENBQUMsS0FBSyxPQUFPLElBQUksQ0FBQyxLQUFLLE9BQU8sQ0FBQyxFQUFFO1FBQ2pGLE1BQU0sQ0FBQyxJQUFJLENBQ1Qsb0dBQW9HO1lBQ2xHLHNEQUFzRDtZQUN0RCxzRUFBc0UsQ0FDekUsQ0FBQztLQUNIO0FBQ0gsQ0FBQztBQUVELGtCQUFlLElBQUEseUJBQWEsRUFBeUMsbUJBQW1CLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgRW1pdHRlZEZpbGVzLCBXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrLCBydW5XZWJwYWNrIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLXdlYnBhY2snO1xuaW1wb3J0IHsgZ2V0U3lzdGVtUGF0aCwganNvbiwgbG9nZ2luZywgbm9ybWFsaXplLCByZXNvbHZlIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbWFwLCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgRXhlY3V0aW9uVHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7XG4gIGRlbGV0ZU91dHB1dERpcixcbiAgbm9ybWFsaXplQXNzZXRQYXR0ZXJucyxcbiAgbm9ybWFsaXplT3B0aW1pemF0aW9uLFxuICB1cmxKb2luLFxufSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQge1xuICBCdWRnZXRDYWxjdWxhdG9yUmVzdWx0LFxuICBUaHJlc2hvbGRTZXZlcml0eSxcbiAgY2hlY2tCdWRnZXRzLFxufSBmcm9tICcuLi8uLi91dGlscy9idW5kbGUtY2FsY3VsYXRvcic7XG5pbXBvcnQgeyBjb2xvcnMgfSBmcm9tICcuLi8uLi91dGlscy9jb2xvcic7XG5pbXBvcnQgeyBjb3B5QXNzZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29weS1hc3NldHMnO1xuaW1wb3J0IHsgaTE4bklubGluZUVtaXR0ZWRGaWxlcyB9IGZyb20gJy4uLy4uL3V0aWxzL2kxOG4taW5saW5pbmcnO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgRmlsZUluZm8gfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2F1Z21lbnQtaW5kZXgtaHRtbCc7XG5pbXBvcnQge1xuICBJbmRleEh0bWxHZW5lcmF0b3IsXG4gIEluZGV4SHRtbFRyYW5zZm9ybSxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBub3JtYWxpemVDYWNoZU9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9ub3JtYWxpemUtY2FjaGUnO1xuaW1wb3J0IHsgZW5zdXJlT3V0cHV0UGF0aHMgfSBmcm9tICcuLi8uLi91dGlscy9vdXRwdXQtcGF0aHMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cyB9IGZyb20gJy4uLy4uL3V0aWxzL3BhY2thZ2UtY2h1bmstc29ydCc7XG5pbXBvcnQgeyBwdXJnZVN0YWxlQnVpbGRDYWNoZSB9IGZyb20gJy4uLy4uL3V0aWxzL3B1cmdlLWNhY2hlJztcbmltcG9ydCB7IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlciB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IFNwaW5uZXIgfSBmcm9tICcuLi8uLi91dGlscy9zcGlubmVyJztcbmltcG9ydCB7IGdldFN1cHBvcnRlZEJyb3dzZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3VwcG9ydGVkLWJyb3dzZXJzJztcbmltcG9ydCB7IGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbiB9IGZyb20gJy4uLy4uL3V0aWxzL3ZlcnNpb24nO1xuaW1wb3J0IHtcbiAgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dCxcbiAgZ2V0SW5kZXhJbnB1dEZpbGUsXG4gIGdldEluZGV4T3V0cHV0RmlsZSxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBnZXRBbmFseXRpY3NDb25maWcsIGdldENvbW1vbkNvbmZpZywgZ2V0U3R5bGVzQ29uZmlnIH0gZnJvbSAnLi4vLi4vd2VicGFjay9jb25maWdzJztcbmltcG9ydCB7IG1hcmtBc3luY0NodW5rc05vbkluaXRpYWwgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL2FzeW5jLWNodW5rcyc7XG5pbXBvcnQgeyBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzIH0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9oZWxwZXJzJztcbmltcG9ydCB7XG4gIHN0YXRzRXJyb3JzVG9TdHJpbmcsXG4gIHN0YXRzSGFzRXJyb3JzLFxuICBzdGF0c0hhc1dhcm5pbmdzLFxuICBzdGF0c1dhcm5pbmdzVG9TdHJpbmcsXG4gIHdlYnBhY2tTdGF0c0xvZ2dlcixcbn0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyB0eXBlIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgdHlwZSBCcm93c2VyQnVpbGRlck91dHB1dCA9IGpzb24uSnNvbk9iamVjdCAmXG4gIEJ1aWxkZXJPdXRwdXQgJiB7XG4gICAgYmFzZU91dHB1dFBhdGg6IHN0cmluZztcbiAgICBvdXRwdXRQYXRoczogc3RyaW5nW107XG4gICAgLyoqXG4gICAgICogQGRlcHJlY2F0ZWQgaW4gdmVyc2lvbiA5LiBVc2UgJ291dHB1dFBhdGhzJyBpbnN0ZWFkLlxuICAgICAqL1xuICAgIG91dHB1dFBhdGg6IHN0cmluZztcbiAgfTtcblxuLyoqXG4gKiBNYXhpbXVtIHRpbWUgaW4gbWlsbGlzZWNvbmRzIGZvciBzaW5nbGUgYnVpbGQvcmVidWlsZFxuICogVGhpcyBhY2NvdW50cyBmb3IgQ0kgdmFyaWFiaWxpdHkuXG4gKi9cbmV4cG9ydCBjb25zdCBCVUlMRF9USU1FT1VUID0gMzBfMDAwO1xuXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplKFxuICBvcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8d2VicGFjay5Db25maWd1cmF0aW9uPixcbik6IFByb21pc2U8e1xuICBjb25maWc6IHdlYnBhY2suQ29uZmlndXJhdGlvbjtcbiAgcHJvamVjdFJvb3Q6IHN0cmluZztcbiAgcHJvamVjdFNvdXJjZVJvb3Q/OiBzdHJpbmc7XG4gIGkxOG46IEkxOG5PcHRpb25zO1xuICB0YXJnZXQ6IFNjcmlwdFRhcmdldDtcbn0+IHtcbiAgY29uc3Qgb3JpZ2luYWxPdXRwdXRQYXRoID0gb3B0aW9ucy5vdXRwdXRQYXRoO1xuXG4gIC8vIEFzc2V0cyBhcmUgcHJvY2Vzc2VkIGRpcmVjdGx5IGJ5IHRoZSBidWlsZGVyIGV4Y2VwdCB3aGVuIHdhdGNoaW5nXG4gIGNvbnN0IGFkanVzdGVkT3B0aW9ucyA9IG9wdGlvbnMud2F0Y2ggPyBvcHRpb25zIDogeyAuLi5vcHRpb25zLCBhc3NldHM6IFtdIH07XG5cbiAgY29uc3QgeyBjb25maWcsIHByb2plY3RSb290LCBwcm9qZWN0U291cmNlUm9vdCwgaTE4biwgdGFyZ2V0IH0gPVxuICAgIGF3YWl0IGdlbmVyYXRlSTE4bkJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQoYWRqdXN0ZWRPcHRpb25zLCBjb250ZXh0LCAod2NvKSA9PiBbXG4gICAgICBnZXRDb21tb25Db25maWcod2NvKSxcbiAgICAgIGdldFN0eWxlc0NvbmZpZyh3Y28pLFxuICAgICAgZ2V0QW5hbHl0aWNzQ29uZmlnKHdjbywgY29udGV4dCksXG4gICAgXSk7XG5cbiAgLy8gVmFsaWRhdGUgYXNzZXQgb3B0aW9uIHZhbHVlcyBpZiBwcm9jZXNzZWQgZGlyZWN0bHlcbiAgaWYgKG9wdGlvbnMuYXNzZXRzPy5sZW5ndGggJiYgIWFkanVzdGVkT3B0aW9ucy5hc3NldHM/Lmxlbmd0aCkge1xuICAgIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMoXG4gICAgICBvcHRpb25zLmFzc2V0cyxcbiAgICAgIG5vcm1hbGl6ZShjb250ZXh0LndvcmtzcGFjZVJvb3QpLFxuICAgICAgbm9ybWFsaXplKHByb2plY3RSb290KSxcbiAgICAgIHByb2plY3RTb3VyY2VSb290ID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBub3JtYWxpemUocHJvamVjdFNvdXJjZVJvb3QpLFxuICAgICkuZm9yRWFjaCgoeyBvdXRwdXQgfSkgPT4ge1xuICAgICAgaWYgKG91dHB1dC5zdGFydHNXaXRoKCcuLicpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQW4gYXNzZXQgY2Fubm90IGJlIHdyaXR0ZW4gdG8gYSBsb2NhdGlvbiBvdXRzaWRlIG9mIHRoZSBvdXRwdXQgcGF0aC4nKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGxldCB0cmFuc2Zvcm1lZENvbmZpZztcbiAgaWYgKHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtKSB7XG4gICAgdHJhbnNmb3JtZWRDb25maWcgPSBhd2FpdCB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybShjb25maWcpO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aCkge1xuICAgIGRlbGV0ZU91dHB1dERpcihjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9yaWdpbmFsT3V0cHV0UGF0aCk7XG4gIH1cblxuICByZXR1cm4geyBjb25maWc6IHRyYW5zZm9ybWVkQ29uZmlnIHx8IGNvbmZpZywgcHJvamVjdFJvb3QsIHByb2plY3RTb3VyY2VSb290LCBpMThuLCB0YXJnZXQgfTtcbn1cblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkV2VicGFja0Jyb3dzZXIoXG4gIG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgdHJhbnNmb3Jtczoge1xuICAgIHdlYnBhY2tDb25maWd1cmF0aW9uPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8d2VicGFjay5Db25maWd1cmF0aW9uPjtcbiAgICBsb2dnaW5nPzogV2VicGFja0xvZ2dpbmdDYWxsYmFjaztcbiAgICBpbmRleEh0bWw/OiBJbmRleEh0bWxUcmFuc2Zvcm07XG4gIH0gPSB7fSxcbik6IE9ic2VydmFibGU8QnJvd3NlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3Qgcm9vdCA9IG5vcm1hbGl6ZShjb250ZXh0LndvcmtzcGFjZVJvb3QpO1xuXG4gIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQ/LnByb2plY3Q7XG4gIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0LicpO1xuICB9XG5cbiAgY29uc3QgYmFzZU91dHB1dFBhdGggPSBwYXRoLnJlc29sdmUoY29udGV4dC53b3Jrc3BhY2VSb290LCBvcHRpb25zLm91dHB1dFBhdGgpO1xuICBsZXQgb3V0cHV0UGF0aHM6IHVuZGVmaW5lZCB8IE1hcDxzdHJpbmcsIHN0cmluZz47XG5cbiAgLy8gQ2hlY2sgQW5ndWxhciB2ZXJzaW9uLlxuICBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24oY29udGV4dC53b3Jrc3BhY2VSb290KTtcblxuICByZXR1cm4gZnJvbShjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSkpLnBpcGUoXG4gICAgc3dpdGNoTWFwKGFzeW5jIChwcm9qZWN0TWV0YWRhdGEpID0+IHtcbiAgICAgIGNvbnN0IHN5c1Byb2plY3RSb290ID0gZ2V0U3lzdGVtUGF0aChcbiAgICAgICAgcmVzb2x2ZShcbiAgICAgICAgICBub3JtYWxpemUoY29udGV4dC53b3Jrc3BhY2VSb290KSxcbiAgICAgICAgICBub3JtYWxpemUoKHByb2plY3RNZXRhZGF0YS5yb290IGFzIHN0cmluZykgPz8gJycpLFxuICAgICAgICApLFxuICAgICAgKTtcblxuICAgICAgLy8gUHVyZ2Ugb2xkIGJ1aWxkIGRpc2sgY2FjaGUuXG4gICAgICBhd2FpdCBwdXJnZVN0YWxlQnVpbGRDYWNoZShjb250ZXh0KTtcblxuICAgICAgY2hlY2tJbnRlcm5ldEV4cGxvcmVyU3VwcG9ydChzeXNQcm9qZWN0Um9vdCwgY29udGV4dC5sb2dnZXIpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi4oYXdhaXQgaW5pdGlhbGl6ZShvcHRpb25zLCBjb250ZXh0LCB0cmFuc2Zvcm1zLndlYnBhY2tDb25maWd1cmF0aW9uKSksXG4gICAgICAgIGNhY2hlT3B0aW9uczogbm9ybWFsaXplQ2FjaGVPcHRpb25zKHByb2plY3RNZXRhZGF0YSwgY29udGV4dC53b3Jrc3BhY2VSb290KSxcbiAgICAgIH07XG4gICAgfSksXG4gICAgc3dpdGNoTWFwKFxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbiAgICAgICh7IGNvbmZpZywgcHJvamVjdFJvb3QsIHByb2plY3RTb3VyY2VSb290LCBpMThuLCB0YXJnZXQsIGNhY2hlT3B0aW9ucyB9KSA9PiB7XG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWRPcHRpbWl6YXRpb24gPSBub3JtYWxpemVPcHRpbWl6YXRpb24ob3B0aW9ucy5vcHRpbWl6YXRpb24pO1xuXG4gICAgICAgIHJldHVybiBydW5XZWJwYWNrKGNvbmZpZywgY29udGV4dCwge1xuICAgICAgICAgIHdlYnBhY2tGYWN0b3J5OiByZXF1aXJlKCd3ZWJwYWNrJykgYXMgdHlwZW9mIHdlYnBhY2ssXG4gICAgICAgICAgbG9nZ2luZzpcbiAgICAgICAgICAgIHRyYW5zZm9ybXMubG9nZ2luZyB8fFxuICAgICAgICAgICAgKChzdGF0cywgY29uZmlnKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChvcHRpb25zLnZlcmJvc2UpIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKHN0YXRzLnRvU3RyaW5nKGNvbmZpZy5zdGF0cykpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgfSkucGlwZShcbiAgICAgICAgICBjb25jYXRNYXAoYXN5bmMgKGJ1aWxkRXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcigpO1xuICAgICAgICAgICAgc3Bpbm5lci5lbmFibGVkID0gb3B0aW9ucy5wcm9ncmVzcyAhPT0gZmFsc2U7XG5cbiAgICAgICAgICAgIGNvbnN0IHsgc3VjY2VzcywgZW1pdHRlZEZpbGVzID0gW10sIG91dHB1dFBhdGg6IHdlYnBhY2tPdXRwdXRQYXRoIH0gPSBidWlsZEV2ZW50O1xuICAgICAgICAgICAgY29uc3Qgd2VicGFja1Jhd1N0YXRzID0gYnVpbGRFdmVudC53ZWJwYWNrU3RhdHM7XG4gICAgICAgICAgICBpZiAoIXdlYnBhY2tSYXdTdGF0cykge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYnBhY2sgc3RhdHMgYnVpbGQgcmVzdWx0IGlzIHJlcXVpcmVkLicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBGaXggaW5jb3JyZWN0bHkgc2V0IGBpbml0aWFsYCB2YWx1ZSBvbiBjaHVua3MuXG4gICAgICAgICAgICBjb25zdCBleHRyYUVudHJ5UG9pbnRzID0gW1xuICAgICAgICAgICAgICAuLi5ub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKG9wdGlvbnMuc3R5bGVzIHx8IFtdLCAnc3R5bGVzJyksXG4gICAgICAgICAgICAgIC4uLm5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMob3B0aW9ucy5zY3JpcHRzIHx8IFtdLCAnc2NyaXB0cycpLFxuICAgICAgICAgICAgXTtcblxuICAgICAgICAgICAgY29uc3Qgd2VicGFja1N0YXRzID0ge1xuICAgICAgICAgICAgICAuLi53ZWJwYWNrUmF3U3RhdHMsXG4gICAgICAgICAgICAgIGNodW5rczogbWFya0FzeW5jQ2h1bmtzTm9uSW5pdGlhbCh3ZWJwYWNrUmF3U3RhdHMsIGV4dHJhRW50cnlQb2ludHMpLFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICAgICAgICAgIC8vIElmIHVzaW5nIGJ1bmRsZSBkb3dubGV2ZWxpbmcgdGhlbiB0aGVyZSBpcyBvbmx5IG9uZSBidWlsZFxuICAgICAgICAgICAgICAvLyBJZiBpdCBmYWlscyBzaG93IGFueSBkaWFnbm9zdGljIG1lc3NhZ2VzIGFuZCBiYWlsXG4gICAgICAgICAgICAgIGlmIChzdGF0c0hhc1dhcm5pbmdzKHdlYnBhY2tTdGF0cykpIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmxvZ2dlci53YXJuKHN0YXRzV2FybmluZ3NUb1N0cmluZyh3ZWJwYWNrU3RhdHMsIHsgY29sb3JzOiB0cnVlIH0pKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoc3RhdHNIYXNFcnJvcnMod2VicGFja1N0YXRzKSkge1xuICAgICAgICAgICAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKHN0YXRzRXJyb3JzVG9TdHJpbmcod2VicGFja1N0YXRzLCB7IGNvbG9yczogdHJ1ZSB9KSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzIH07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvdXRwdXRQYXRocyA9IGVuc3VyZU91dHB1dFBhdGhzKGJhc2VPdXRwdXRQYXRoLCBpMThuKTtcblxuICAgICAgICAgICAgICBjb25zdCBzY3JpcHRzRW50cnlQb2ludE5hbWUgPSBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKFxuICAgICAgICAgICAgICAgIG9wdGlvbnMuc2NyaXB0cyB8fCBbXSxcbiAgICAgICAgICAgICAgICAnc2NyaXB0cycsXG4gICAgICAgICAgICAgICkubWFwKCh4KSA9PiB4LmJ1bmRsZU5hbWUpO1xuXG4gICAgICAgICAgICAgIGlmIChpMThuLnNob3VsZElubGluZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBhd2FpdCBpMThuSW5saW5lRW1pdHRlZEZpbGVzKFxuICAgICAgICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgICAgICAgIGVtaXR0ZWRGaWxlcyxcbiAgICAgICAgICAgICAgICAgIGkxOG4sXG4gICAgICAgICAgICAgICAgICBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgICAgIEFycmF5LmZyb20ob3V0cHV0UGF0aHMudmFsdWVzKCkpLFxuICAgICAgICAgICAgICAgICAgc2NyaXB0c0VudHJ5UG9pbnROYW1lLFxuICAgICAgICAgICAgICAgICAgd2VicGFja091dHB1dFBhdGgsXG4gICAgICAgICAgICAgICAgICB0YXJnZXQgPD0gU2NyaXB0VGFyZ2V0LkVTNSxcbiAgICAgICAgICAgICAgICAgIG9wdGlvbnMuaTE4bk1pc3NpbmdUcmFuc2xhdGlvbixcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGlmICghc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBDaGVjayBmb3IgYnVkZ2V0IGVycm9ycyBhbmQgZGlzcGxheSB0aGVtIHRvIHRoZSB1c2VyLlxuICAgICAgICAgICAgICBjb25zdCBidWRnZXRzID0gb3B0aW9ucy5idWRnZXRzO1xuICAgICAgICAgICAgICBsZXQgYnVkZ2V0RmFpbHVyZXM6IEJ1ZGdldENhbGN1bGF0b3JSZXN1bHRbXSB8IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgaWYgKGJ1ZGdldHM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGJ1ZGdldEZhaWx1cmVzID0gWy4uLmNoZWNrQnVkZ2V0cyhidWRnZXRzLCB3ZWJwYWNrU3RhdHMpXTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHsgc2V2ZXJpdHksIG1lc3NhZ2UgfSBvZiBidWRnZXRGYWlsdXJlcykge1xuICAgICAgICAgICAgICAgICAgc3dpdGNoIChzZXZlcml0eSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFRocmVzaG9sZFNldmVyaXR5Lldhcm5pbmc6XG4gICAgICAgICAgICAgICAgICAgICAgd2VicGFja1N0YXRzLndhcm5pbmdzPy5wdXNoKHsgbWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBUaHJlc2hvbGRTZXZlcml0eS5FcnJvcjpcbiAgICAgICAgICAgICAgICAgICAgICB3ZWJwYWNrU3RhdHMuZXJyb3JzPy5wdXNoKHsgbWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICBhc3NlcnROZXZlcihzZXZlcml0eSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgYnVpbGRTdWNjZXNzID0gc3VjY2VzcyAmJiAhc3RhdHNIYXNFcnJvcnMod2VicGFja1N0YXRzKTtcbiAgICAgICAgICAgICAgaWYgKGJ1aWxkU3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIC8vIENvcHkgYXNzZXRzXG4gICAgICAgICAgICAgICAgaWYgKCFvcHRpb25zLndhdGNoICYmIG9wdGlvbnMuYXNzZXRzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3RhcnQoJ0NvcHlpbmcgYXNzZXRzLi4uJyk7XG4gICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBjb3B5QXNzZXRzKFxuICAgICAgICAgICAgICAgICAgICAgIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMoXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmFzc2V0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemUocHJvamVjdFJvb3QpLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvamVjdFNvdXJjZVJvb3QgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IG5vcm1hbGl6ZShwcm9qZWN0U291cmNlUm9vdCksXG4gICAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgICBBcnJheS5mcm9tKG91dHB1dFBhdGhzLnZhbHVlcygpKSxcbiAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3VjY2VlZCgnQ29weWluZyBhc3NldHMgY29tcGxldGUuJyk7XG4gICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5mYWlsKGNvbG9ycy5yZWRCcmlnaHQoJ0NvcHlpbmcgb2YgYXNzZXRzIGZhaWxlZC4nKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVW5hYmxlIHRvIGNvcHkgYXNzZXRzOiAnICsgZXJyLm1lc3NhZ2UgfTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5pbmRleCkge1xuICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdGFydCgnR2VuZXJhdGluZyBpbmRleCBodG1sLi4uJyk7XG5cbiAgICAgICAgICAgICAgICAgIGNvbnN0IGVudHJ5cG9pbnRzID0gZ2VuZXJhdGVFbnRyeVBvaW50cyh7XG4gICAgICAgICAgICAgICAgICAgIHNjcmlwdHM6IG9wdGlvbnMuc2NyaXB0cyA/PyBbXSxcbiAgICAgICAgICAgICAgICAgICAgc3R5bGVzOiBvcHRpb25zLnN0eWxlcyA/PyBbXSxcbiAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICBjb25zdCBpbmRleEh0bWxHZW5lcmF0b3IgPSBuZXcgSW5kZXhIdG1sR2VuZXJhdG9yKHtcbiAgICAgICAgICAgICAgICAgICAgY2FjaGU6IGNhY2hlT3B0aW9ucyxcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhQYXRoOiBwYXRoLmpvaW4oY29udGV4dC53b3Jrc3BhY2VSb290LCBnZXRJbmRleElucHV0RmlsZShvcHRpb25zLmluZGV4KSksXG4gICAgICAgICAgICAgICAgICAgIGVudHJ5cG9pbnRzLFxuICAgICAgICAgICAgICAgICAgICBkZXBsb3lVcmw6IG9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgICAgICAgICAgICAgICBzcmk6IG9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgICAgICAgICAgICAgICAgIG9wdGltaXphdGlvbjogbm9ybWFsaXplZE9wdGltaXphdGlvbixcbiAgICAgICAgICAgICAgICAgICAgY3Jvc3NPcmlnaW46IG9wdGlvbnMuY3Jvc3NPcmlnaW4sXG4gICAgICAgICAgICAgICAgICAgIHBvc3RUcmFuc2Zvcm06IHRyYW5zZm9ybXMuaW5kZXhIdG1sLFxuICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgIGxldCBoYXNFcnJvcnMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgW2xvY2FsZSwgb3V0cHV0UGF0aF0gb2Ygb3V0cHV0UGF0aHMuZW50cmllcygpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBjb250ZW50LCB3YXJuaW5ncywgZXJyb3JzIH0gPSBhd2FpdCBpbmRleEh0bWxHZW5lcmF0b3IucHJvY2Vzcyh7XG4gICAgICAgICAgICAgICAgICAgICAgICBiYXNlSHJlZjogZ2V0TG9jYWxlQmFzZUhyZWYoaTE4biwgbG9jYWxlKSB8fCBvcHRpb25zLmJhc2VIcmVmLFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaTE4bkxvY2FsZSBpcyB1c2VkIHdoZW4gSXZ5IGlzIGRpc2FibGVkXG4gICAgICAgICAgICAgICAgICAgICAgICBsYW5nOiBsb2NhbGUgfHwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzOiBtYXBFbWl0dGVkRmlsZXNUb0ZpbGVJbmZvKGVtaXR0ZWRGaWxlcyksXG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICBpZiAod2FybmluZ3MubGVuZ3RoIHx8IGVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3RvcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgd2FybmluZ3MuZm9yRWFjaCgobSkgPT4gY29udGV4dC5sb2dnZXIud2FybihtKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcnMuZm9yRWFjaCgobSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaGFzRXJyb3JzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdGFydCgpO1xuICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4T3V0cHV0ID0gcGF0aC5qb2luKG91dHB1dFBhdGgsIGdldEluZGV4T3V0cHV0RmlsZShvcHRpb25zLmluZGV4KSk7XG4gICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMubWtkaXIocGF0aC5kaXJuYW1lKGluZGV4T3V0cHV0KSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMud3JpdGVGaWxlKGluZGV4T3V0cHV0LCBjb250ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzcGlubmVyLmZhaWwoJ0luZGV4IGh0bWwgZ2VuZXJhdGlvbiBmYWlsZWQuJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IG1hcEVycm9yVG9NZXNzYWdlKGVycm9yKSB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIGlmIChoYXNFcnJvcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5mYWlsKCdJbmRleCBodG1sIGdlbmVyYXRpb24gZmFpbGVkLicpO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzcGlubmVyLnN1Y2NlZWQoJ0luZGV4IGh0bWwgZ2VuZXJhdGlvbiBjb21wbGV0ZS4nKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgICAgICAgICAgICAgICBzcGlubmVyLnN0YXJ0KCdHZW5lcmF0aW5nIHNlcnZpY2Ugd29ya2VyLi4uJyk7XG4gICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtsb2NhbGUsIG91dHB1dFBhdGhdIG9mIG91dHB1dFBhdGhzLmVudHJpZXMoKSkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlcihcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vcm1hbGl6ZShwcm9qZWN0Um9vdCksXG4gICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemUob3V0cHV0UGF0aCksXG4gICAgICAgICAgICAgICAgICAgICAgICBnZXRMb2NhbGVCYXNlSHJlZihpMThuLCBsb2NhbGUpIHx8IG9wdGlvbnMuYmFzZUhyZWYgfHwgJy8nLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5uZ3N3Q29uZmlnUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuZmFpbCgnU2VydmljZSB3b3JrZXIgZ2VuZXJhdGlvbiBmYWlsZWQuJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IG1hcEVycm9yVG9NZXNzYWdlKGVycm9yKSB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3VjY2VlZCgnU2VydmljZSB3b3JrZXIgZ2VuZXJhdGlvbiBjb21wbGV0ZS4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB3ZWJwYWNrU3RhdHNMb2dnZXIoY29udGV4dC5sb2dnZXIsIHdlYnBhY2tTdGF0cywgY29uZmlnLCBidWRnZXRGYWlsdXJlcyk7XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogYnVpbGRTdWNjZXNzIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSksXG4gICAgICAgICAgbWFwKFxuICAgICAgICAgICAgKGV2ZW50KSA9PlxuICAgICAgICAgICAgICAoe1xuICAgICAgICAgICAgICAgIC4uLmV2ZW50LFxuICAgICAgICAgICAgICAgIGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICAgICAgICAgIG91dHB1dFBhdGg6IGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICAgICAgICAgIG91dHB1dFBhdGhzOiAob3V0cHV0UGF0aHMgJiYgQXJyYXkuZnJvbShvdXRwdXRQYXRocy52YWx1ZXMoKSkpIHx8IFtiYXNlT3V0cHV0UGF0aF0sXG4gICAgICAgICAgICAgIH0gYXMgQnJvd3NlckJ1aWxkZXJPdXRwdXQpLFxuICAgICAgICAgICksXG4gICAgICAgICk7XG4gICAgICB9LFxuICAgICksXG4gICk7XG5cbiAgZnVuY3Rpb24gZ2V0TG9jYWxlQmFzZUhyZWYoaTE4bjogSTE4bk9wdGlvbnMsIGxvY2FsZTogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoaTE4bi5sb2NhbGVzW2xvY2FsZV0gJiYgaTE4bi5sb2NhbGVzW2xvY2FsZV0/LmJhc2VIcmVmICE9PSAnJykge1xuICAgICAgcmV0dXJuIHVybEpvaW4ob3B0aW9ucy5iYXNlSHJlZiB8fCAnJywgaTE4bi5sb2NhbGVzW2xvY2FsZV0uYmFzZUhyZWYgPz8gYC8ke2xvY2FsZX0vYCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG5mdW5jdGlvbiBtYXBFcnJvclRvTWVzc2FnZShlcnJvcjogdW5rbm93bik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgcmV0dXJuIGVycm9yLm1lc3NhZ2U7XG4gIH1cblxuICBpZiAodHlwZW9mIGVycm9yID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBlcnJvcjtcbiAgfVxuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGFzc2VydE5ldmVyKGlucHV0OiBuZXZlcik6IG5ldmVyIHtcbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgIGBVbmV4cGVjdGVkIGNhbGwgdG8gYXNzZXJ0TmV2ZXIoKSB3aXRoIGlucHV0OiAke0pTT04uc3RyaW5naWZ5KFxuICAgICAgaW5wdXQsXG4gICAgICBudWxsIC8qIHJlcGxhY2VyICovLFxuICAgICAgNCAvKiB0YWJTaXplICovLFxuICAgICl9YCxcbiAgKTtcbn1cblxuZnVuY3Rpb24gbWFwRW1pdHRlZEZpbGVzVG9GaWxlSW5mbyhmaWxlczogRW1pdHRlZEZpbGVzW10gPSBbXSk6IEZpbGVJbmZvW10ge1xuICBjb25zdCBmaWx0ZXJlZEZpbGVzOiBGaWxlSW5mb1tdID0gW107XG4gIGZvciAoY29uc3QgeyBmaWxlLCBuYW1lLCBleHRlbnNpb24sIGluaXRpYWwgfSBvZiBmaWxlcykge1xuICAgIGlmIChuYW1lICYmIGluaXRpYWwpIHtcbiAgICAgIGZpbHRlcmVkRmlsZXMucHVzaCh7IGZpbGUsIGV4dGVuc2lvbiwgbmFtZSB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmlsdGVyZWRGaWxlcztcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnRlcm5ldEV4cGxvcmVyU3VwcG9ydChwcm9qZWN0Um9vdDogc3RyaW5nLCBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpKTogdm9pZCB7XG4gIGNvbnN0IHN1cHBvcnRlZEJyb3dzZXJzID0gZ2V0U3VwcG9ydGVkQnJvd3NlcnMocHJvamVjdFJvb3QpO1xuICBpZiAoc3VwcG9ydGVkQnJvd3NlcnMuc29tZSgoYikgPT4gYiA9PT0gJ2llIDknIHx8IGIgPT09ICdpZSAxMCcgfHwgYiA9PT0gJ2llIDExJykpIHtcbiAgICBsb2dnZXIud2FybihcbiAgICAgIGBXYXJuaW5nOiBTdXBwb3J0IHdhcyByZXF1ZXN0ZWQgZm9yIEludGVybmV0IEV4cGxvcmVyIGluIHRoZSBwcm9qZWN0J3MgYnJvd3NlcnNsaXN0IGNvbmZpZ3VyYXRpb24uIGAgK1xuICAgICAgICAnSW50ZXJuZXQgRXhwbG9yZXIgaXMgbm8gbG9uZ2VyIG9mZmljaWFsbHkgc3VwcG9ydGVkLicgK1xuICAgICAgICAnXFxuRm9yIG1vcmUgaW5mb3JtYXRpb24sIHNlZSBodHRwczovL2FuZ3VsYXIuaW8vZ3VpZGUvYnJvd3Nlci1zdXBwb3J0JyxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXI8anNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJTY2hlbWE+KGJ1aWxkV2VicGFja0Jyb3dzZXIpO1xuIl19