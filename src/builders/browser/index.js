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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQXlGO0FBQ3pGLGlFQUFpRztBQUNqRywrQ0FBMEQ7QUFDMUQsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUM3QiwrQkFBd0M7QUFDeEMsOENBQTJEO0FBQzNELDJDQUEwQztBQUcxQyx1Q0FLcUI7QUFDckIscUVBSXVDO0FBQ3ZDLDZDQUEyQztBQUMzQyx5REFBcUQ7QUFDckQsNkRBQW1FO0FBR25FLHNGQUdxRDtBQUNyRCxpRUFBb0U7QUFDcEUsMkRBQTZEO0FBQzdELHVFQUFxRTtBQUNyRSx5REFBK0Q7QUFDL0QsK0RBQXlFO0FBQ3pFLGlEQUE4QztBQUM5Qyx1RUFBc0U7QUFDdEUsaURBQXFFO0FBQ3JFLCtFQUk0QztBQUM1QyxtREFBNkY7QUFDN0YsbUVBQTZFO0FBQzdFLHlEQUF3RTtBQUN4RSxxREFNbUM7QUFlbkM7OztHQUdHO0FBQ1UsUUFBQSxhQUFhLEdBQUcsS0FBTSxDQUFDO0FBRXBDLEtBQUssVUFBVSxVQUFVLENBQ3ZCLE9BQTZCLEVBQzdCLE9BQXVCLEVBQ3ZCLDZCQUEyRTs7SUFRM0UsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDO0lBRTlDLG9FQUFvRTtJQUNwRSxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxDQUFDO0lBRTdFLE1BQU0sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLGlCQUFpQixFQUFFLElBQUksRUFB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LENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1NBQy9DO0tBQ0Y7SUFFRCxPQUFPLGFBQWEsQ0FBQztBQUN2QixDQUFDO0FBRUQsU0FBUyw0QkFBNEIsQ0FBQyxXQUFtQixFQUFFLE1BQXlCO0lBQ2xGLE1BQU0saUJBQWlCLEdBQUcsSUFBQSx5Q0FBb0IsRUFBQyxXQUFXLENBQUMsQ0FBQztJQUM1RCxJQUFJLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxLQUFLLE1BQU0sSUFBSSxDQUFDLEtBQUssT0FBTyxJQUFJLENBQUMsS0FBSyxPQUFPLENBQUMsRUFBRTtRQUNqRixNQUFNLENBQUMsSUFBSSxDQUNULG9HQUFvRztZQUNsRyxzREFBc0Q7WUFDdEQsc0VBQXNFLENBQ3pFLENBQUM7S0FDSDtBQUNILENBQUM7QUFFRCxrQkFBZSxJQUFBLHlCQUFhLEVBQXVCLG1CQUFtQixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IEVtaXR0ZWRGaWxlcywgV2VicGFja0xvZ2dpbmdDYWxsYmFjaywgcnVuV2VicGFjayB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJztcbmltcG9ydCB7IGxvZ2dpbmcsIG5vcm1hbGl6ZSB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBmcm9tIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBjb25jYXRNYXAsIG1hcCwgc3dpdGNoTWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgU2NyaXB0VGFyZ2V0IH0gZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IEV4ZWN1dGlvblRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vdHJhbnNmb3Jtcyc7XG5pbXBvcnQge1xuICBkZWxldGVPdXRwdXREaXIsXG4gIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMsXG4gIG5vcm1hbGl6ZU9wdGltaXphdGlvbixcbiAgdXJsSm9pbixcbn0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHtcbiAgQnVkZ2V0Q2FsY3VsYXRvclJlc3VsdCxcbiAgVGhyZXNob2xkU2V2ZXJpdHksXG4gIGNoZWNrQnVkZ2V0cyxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvYnVuZGxlLWNhbGN1bGF0b3InO1xuaW1wb3J0IHsgY29sb3JzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29sb3InO1xuaW1wb3J0IHsgY29weUFzc2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvcHktYXNzZXRzJztcbmltcG9ydCB7IGkxOG5JbmxpbmVFbWl0dGVkRmlsZXMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLWlubGluaW5nJztcbmltcG9ydCB7IEkxOG5PcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IEZpbGVJbmZvIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9hdWdtZW50LWluZGV4LWh0bWwnO1xuaW1wb3J0IHtcbiAgSW5kZXhIdG1sR2VuZXJhdG9yLFxuICBJbmRleEh0bWxUcmFuc2Zvcm0sXG59IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgbm9ybWFsaXplQ2FjaGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvbm9ybWFsaXplLWNhY2hlJztcbmltcG9ydCB7IGVuc3VyZU91dHB1dFBhdGhzIH0gZnJvbSAnLi4vLi4vdXRpbHMvb3V0cHV0LXBhdGhzJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMgfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUgfSBmcm9tICcuLi8uLi91dGlscy9wdXJnZS1jYWNoZSc7XG5pbXBvcnQgeyBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIgfSBmcm9tICcuLi8uLi91dGlscy9zZXJ2aWNlLXdvcmtlcic7XG5pbXBvcnQgeyBTcGlubmVyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lcic7XG5pbXBvcnQgeyBnZXRTdXBwb3J0ZWRCcm93c2VycyB9IGZyb20gJy4uLy4uL3V0aWxzL3N1cHBvcnRlZC1icm93c2Vycyc7XG5pbXBvcnQgeyBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24gfSBmcm9tICcuLi8uLi91dGlscy92ZXJzaW9uJztcbmltcG9ydCB7XG4gIGdlbmVyYXRlSTE4bkJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQsXG4gIGdldEluZGV4SW5wdXRGaWxlLFxuICBnZXRJbmRleE91dHB1dEZpbGUsXG59IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgZ2V0QW5hbHl0aWNzQ29uZmlnLCBnZXRDb21tb25Db25maWcsIGdldFN0eWxlc0NvbmZpZyB9IGZyb20gJy4uLy4uL3dlYnBhY2svY29uZmlncyc7XG5pbXBvcnQgeyBtYXJrQXN5bmNDaHVua3NOb25Jbml0aWFsIH0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9hc3luYy1jaHVua3MnO1xuaW1wb3J0IHsgbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyB9IGZyb20gJy4uLy4uL3dlYnBhY2svdXRpbHMvaGVscGVycyc7XG5pbXBvcnQge1xuICBzdGF0c0Vycm9yc1RvU3RyaW5nLFxuICBzdGF0c0hhc0Vycm9ycyxcbiAgc3RhdHNIYXNXYXJuaW5ncyxcbiAgc3RhdHNXYXJuaW5nc1RvU3RyaW5nLFxuICB3ZWJwYWNrU3RhdHNMb2dnZXIsXG59IGZyb20gJy4uLy4uL3dlYnBhY2svdXRpbHMvc3RhdHMnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgdHlwZSBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuZXhwb3J0IHR5cGUgQnJvd3NlckJ1aWxkZXJPdXRwdXQgPSBCdWlsZGVyT3V0cHV0ICYge1xuICBiYXNlT3V0cHV0UGF0aDogc3RyaW5nO1xuICBvdXRwdXRQYXRoczogc3RyaW5nW107XG4gIC8qKlxuICAgKiBAZGVwcmVjYXRlZCBpbiB2ZXJzaW9uIDkuIFVzZSAnb3V0cHV0UGF0aHMnIGluc3RlYWQuXG4gICAqL1xuICBvdXRwdXRQYXRoOiBzdHJpbmc7XG59O1xuXG4vKipcbiAqIE1heGltdW0gdGltZSBpbiBtaWxsaXNlY29uZHMgZm9yIHNpbmdsZSBidWlsZC9yZWJ1aWxkXG4gKiBUaGlzIGFjY291bnRzIGZvciBDSSB2YXJpYWJpbGl0eS5cbiAqL1xuZXhwb3J0IGNvbnN0IEJVSUxEX1RJTUVPVVQgPSAzMF8wMDA7XG5cbmFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemUoXG4gIG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgd2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm0/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+LFxuKTogUHJvbWlzZTx7XG4gIGNvbmZpZzogd2VicGFjay5Db25maWd1cmF0aW9uO1xuICBwcm9qZWN0Um9vdDogc3RyaW5nO1xuICBwcm9qZWN0U291cmNlUm9vdD86IHN0cmluZztcbiAgaTE4bjogSTE4bk9wdGlvbnM7XG4gIHRhcmdldDogU2NyaXB0VGFyZ2V0O1xufT4ge1xuICBjb25zdCBvcmlnaW5hbE91dHB1dFBhdGggPSBvcHRpb25zLm91dHB1dFBhdGg7XG5cbiAgLy8gQXNzZXRzIGFyZSBwcm9jZXNzZWQgZGlyZWN0bHkgYnkgdGhlIGJ1aWxkZXIgZXhjZXB0IHdoZW4gd2F0Y2hpbmdcbiAgY29uc3QgYWRqdXN0ZWRPcHRpb25zID0gb3B0aW9ucy53YXRjaCA/IG9wdGlvbnMgOiB7IC4uLm9wdGlvbnMsIGFzc2V0czogW10gfTtcblxuICBjb25zdCB7IGNvbmZpZywgcHJvamVjdFJvb3QsIHByb2plY3RTb3VyY2VSb290LCBpMThuLCB0YXJnZXQgfSA9XG4gICAgYXdhaXQgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChhZGp1c3RlZE9wdGlvbnMsIGNvbnRleHQsICh3Y28pID0+IFtcbiAgICAgIGdldENvbW1vbkNvbmZpZyh3Y28pLFxuICAgICAgZ2V0U3R5bGVzQ29uZmlnKHdjbyksXG4gICAgICBnZXRBbmFseXRpY3NDb25maWcod2NvLCBjb250ZXh0KSxcbiAgICBdKTtcblxuICAvLyBWYWxpZGF0ZSBhc3NldCBvcHRpb24gdmFsdWVzIGlmIHByb2Nlc3NlZCBkaXJlY3RseVxuICBpZiAob3B0aW9ucy5hc3NldHM/Lmxlbmd0aCAmJiAhYWRqdXN0ZWRPcHRpb25zLmFzc2V0cz8ubGVuZ3RoKSB7XG4gICAgbm9ybWFsaXplQXNzZXRQYXR0ZXJucyhcbiAgICAgIG9wdGlvbnMuYXNzZXRzLFxuICAgICAgbm9ybWFsaXplKGNvbnRleHQud29ya3NwYWNlUm9vdCksXG4gICAgICBub3JtYWxpemUocHJvamVjdFJvb3QpLFxuICAgICAgcHJvamVjdFNvdXJjZVJvb3QgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IG5vcm1hbGl6ZShwcm9qZWN0U291cmNlUm9vdCksXG4gICAgKS5mb3JFYWNoKCh7IG91dHB1dCB9KSA9PiB7XG4gICAgICBpZiAob3V0cHV0LnN0YXJ0c1dpdGgoJy4uJykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbiBhc3NldCBjYW5ub3QgYmUgd3JpdHRlbiB0byBhIGxvY2F0aW9uIG91dHNpZGUgb2YgdGhlIG91dHB1dCBwYXRoLicpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgbGV0IHRyYW5zZm9ybWVkQ29uZmlnO1xuICBpZiAod2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm0pIHtcbiAgICB0cmFuc2Zvcm1lZENvbmZpZyA9IGF3YWl0IHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtKGNvbmZpZyk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoKSB7XG4gICAgZGVsZXRlT3V0cHV0RGlyKGNvbnRleHQud29ya3NwYWNlUm9vdCwgb3JpZ2luYWxPdXRwdXRQYXRoKTtcbiAgfVxuXG4gIHJldHVybiB7IGNvbmZpZzogdHJhbnNmb3JtZWRDb25maWcgfHwgY29uZmlnLCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QsIGkxOG4sIHRhcmdldCB9O1xufVxuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRXZWJwYWNrQnJvd3NlcihcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zOiB7XG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb24/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+O1xuICAgIGxvZ2dpbmc/OiBXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrO1xuICAgIGluZGV4SHRtbD86IEluZGV4SHRtbFRyYW5zZm9ybTtcbiAgfSA9IHt9LFxuKTogT2JzZXJ2YWJsZTxCcm93c2VyQnVpbGRlck91dHB1dD4ge1xuICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0Py5wcm9qZWN0O1xuICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldC4nKTtcbiAgfVxuXG4gIGNvbnN0IGJhc2VPdXRwdXRQYXRoID0gcGF0aC5yZXNvbHZlKGNvbnRleHQud29ya3NwYWNlUm9vdCwgb3B0aW9ucy5vdXRwdXRQYXRoKTtcbiAgbGV0IG91dHB1dFBhdGhzOiB1bmRlZmluZWQgfCBNYXA8c3RyaW5nLCBzdHJpbmc+O1xuXG4gIC8vIENoZWNrIEFuZ3VsYXIgdmVyc2lvbi5cbiAgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uKGNvbnRleHQud29ya3NwYWNlUm9vdCk7XG5cbiAgcmV0dXJuIGZyb20oY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpKS5waXBlKFxuICAgIHN3aXRjaE1hcChhc3luYyAocHJvamVjdE1ldGFkYXRhKSA9PiB7XG4gICAgICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgICAgIGF3YWl0IHB1cmdlU3RhbGVCdWlsZENhY2hlKGNvbnRleHQpO1xuXG4gICAgICAvLyBJbml0aWFsaXplIGJ1aWxkZXJcbiAgICAgIGNvbnN0IGluaXRpYWxpemF0aW9uID0gYXdhaXQgaW5pdGlhbGl6ZShvcHRpb25zLCBjb250ZXh0LCB0cmFuc2Zvcm1zLndlYnBhY2tDb25maWd1cmF0aW9uKTtcblxuICAgICAgLy8gQ2hlY2sgYW5kIHdhcm4gYWJvdXQgSUUgYnJvd3NlciBzdXBwb3J0XG4gICAgICBjaGVja0ludGVybmV0RXhwbG9yZXJTdXBwb3J0KGluaXRpYWxpemF0aW9uLnByb2plY3RSb290LCBjb250ZXh0LmxvZ2dlcik7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIC4uLmluaXRpYWxpemF0aW9uLFxuICAgICAgICBjYWNoZU9wdGlvbnM6IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyhwcm9qZWN0TWV0YWRhdGEsIGNvbnRleHQud29ya3NwYWNlUm9vdCksXG4gICAgICB9O1xuICAgIH0pLFxuICAgIHN3aXRjaE1hcChcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG4gICAgICAoeyBjb25maWcsIHByb2plY3RSb290LCBwcm9qZWN0U291cmNlUm9vdCwgaTE4biwgdGFyZ2V0LCBjYWNoZU9wdGlvbnMgfSkgPT4ge1xuICAgICAgICBjb25zdCBub3JtYWxpemVkT3B0aW1pemF0aW9uID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKG9wdGlvbnMub3B0aW1pemF0aW9uKTtcblxuICAgICAgICByZXR1cm4gcnVuV2VicGFjayhjb25maWcsIGNvbnRleHQsIHtcbiAgICAgICAgICB3ZWJwYWNrRmFjdG9yeTogcmVxdWlyZSgnd2VicGFjaycpIGFzIHR5cGVvZiB3ZWJwYWNrLFxuICAgICAgICAgIGxvZ2dpbmc6XG4gICAgICAgICAgICB0cmFuc2Zvcm1zLmxvZ2dpbmcgfHxcbiAgICAgICAgICAgICgoc3RhdHMsIGNvbmZpZykgPT4ge1xuICAgICAgICAgICAgICBpZiAob3B0aW9ucy52ZXJib3NlKSB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhzdGF0cy50b1N0cmluZyhjb25maWcuc3RhdHMpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSksXG4gICAgICAgIH0pLnBpcGUoXG4gICAgICAgICAgY29uY2F0TWFwKGFzeW5jIChidWlsZEV2ZW50KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzcGlubmVyID0gbmV3IFNwaW5uZXIoKTtcbiAgICAgICAgICAgIHNwaW5uZXIuZW5hYmxlZCA9IG9wdGlvbnMucHJvZ3Jlc3MgIT09IGZhbHNlO1xuXG4gICAgICAgICAgICBjb25zdCB7IHN1Y2Nlc3MsIGVtaXR0ZWRGaWxlcyA9IFtdLCBvdXRwdXRQYXRoOiB3ZWJwYWNrT3V0cHV0UGF0aCB9ID0gYnVpbGRFdmVudDtcbiAgICAgICAgICAgIGNvbnN0IHdlYnBhY2tSYXdTdGF0cyA9IGJ1aWxkRXZlbnQud2VicGFja1N0YXRzO1xuICAgICAgICAgICAgaWYgKCF3ZWJwYWNrUmF3U3RhdHMpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdXZWJwYWNrIHN0YXRzIGJ1aWxkIHJlc3VsdCBpcyByZXF1aXJlZC4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRml4IGluY29ycmVjdGx5IHNldCBgaW5pdGlhbGAgdmFsdWUgb24gY2h1bmtzLlxuICAgICAgICAgICAgY29uc3QgZXh0cmFFbnRyeVBvaW50cyA9IFtcbiAgICAgICAgICAgICAgLi4ubm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhvcHRpb25zLnN0eWxlcyB8fCBbXSwgJ3N0eWxlcycpLFxuICAgICAgICAgICAgICAuLi5ub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKG9wdGlvbnMuc2NyaXB0cyB8fCBbXSwgJ3NjcmlwdHMnKSxcbiAgICAgICAgICAgIF07XG5cbiAgICAgICAgICAgIGNvbnN0IHdlYnBhY2tTdGF0cyA9IHtcbiAgICAgICAgICAgICAgLi4ud2VicGFja1Jhd1N0YXRzLFxuICAgICAgICAgICAgICBjaHVua3M6IG1hcmtBc3luY0NodW5rc05vbkluaXRpYWwod2VicGFja1Jhd1N0YXRzLCBleHRyYUVudHJ5UG9pbnRzKSxcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmICghc3VjY2Vzcykge1xuICAgICAgICAgICAgICAvLyBJZiB1c2luZyBidW5kbGUgZG93bmxldmVsaW5nIHRoZW4gdGhlcmUgaXMgb25seSBvbmUgYnVpbGRcbiAgICAgICAgICAgICAgLy8gSWYgaXQgZmFpbHMgc2hvdyBhbnkgZGlhZ25vc3RpYyBtZXNzYWdlcyBhbmQgYmFpbFxuICAgICAgICAgICAgICBpZiAoc3RhdHNIYXNXYXJuaW5ncyh3ZWJwYWNrU3RhdHMpKSB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5sb2dnZXIud2FybihzdGF0c1dhcm5pbmdzVG9TdHJpbmcod2VicGFja1N0YXRzLCB7IGNvbG9yczogdHJ1ZSB9KSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHN0YXRzSGFzRXJyb3JzKHdlYnBhY2tTdGF0cykpIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihzdGF0c0Vycm9yc1RvU3RyaW5nKHdlYnBhY2tTdGF0cywgeyBjb2xvcnM6IHRydWUgfSkpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzcyB9O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgb3V0cHV0UGF0aHMgPSBlbnN1cmVPdXRwdXRQYXRocyhiYXNlT3V0cHV0UGF0aCwgaTE4bik7XG5cbiAgICAgICAgICAgICAgY29uc3Qgc2NyaXB0c0VudHJ5UG9pbnROYW1lID0gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhcbiAgICAgICAgICAgICAgICBvcHRpb25zLnNjcmlwdHMgfHwgW10sXG4gICAgICAgICAgICAgICAgJ3NjcmlwdHMnLFxuICAgICAgICAgICAgICApLm1hcCgoeCkgPT4geC5idW5kbGVOYW1lKTtcblxuICAgICAgICAgICAgICBpZiAoaTE4bi5zaG91bGRJbmxpbmUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdWNjZXNzID0gYXdhaXQgaTE4bklubGluZUVtaXR0ZWRGaWxlcyhcbiAgICAgICAgICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAgICAgICAgICBlbWl0dGVkRmlsZXMsXG4gICAgICAgICAgICAgICAgICBpMThuLFxuICAgICAgICAgICAgICAgICAgYmFzZU91dHB1dFBhdGgsXG4gICAgICAgICAgICAgICAgICBBcnJheS5mcm9tKG91dHB1dFBhdGhzLnZhbHVlcygpKSxcbiAgICAgICAgICAgICAgICAgIHNjcmlwdHNFbnRyeVBvaW50TmFtZSxcbiAgICAgICAgICAgICAgICAgIHdlYnBhY2tPdXRwdXRQYXRoLFxuICAgICAgICAgICAgICAgICAgdGFyZ2V0IDw9IFNjcmlwdFRhcmdldC5FUzUsXG4gICAgICAgICAgICAgICAgICBvcHRpb25zLmkxOG5NaXNzaW5nVHJhbnNsYXRpb24sXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIGJ1ZGdldCBlcnJvcnMgYW5kIGRpc3BsYXkgdGhlbSB0byB0aGUgdXNlci5cbiAgICAgICAgICAgICAgY29uc3QgYnVkZ2V0cyA9IG9wdGlvbnMuYnVkZ2V0cztcbiAgICAgICAgICAgICAgbGV0IGJ1ZGdldEZhaWx1cmVzOiBCdWRnZXRDYWxjdWxhdG9yUmVzdWx0W10gfCB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgIGlmIChidWRnZXRzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBidWRnZXRGYWlsdXJlcyA9IFsuLi5jaGVja0J1ZGdldHMoYnVkZ2V0cywgd2VicGFja1N0YXRzKV07XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB7IHNldmVyaXR5LCBtZXNzYWdlIH0gb2YgYnVkZ2V0RmFpbHVyZXMpIHtcbiAgICAgICAgICAgICAgICAgIHN3aXRjaCAoc2V2ZXJpdHkpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBUaHJlc2hvbGRTZXZlcml0eS5XYXJuaW5nOlxuICAgICAgICAgICAgICAgICAgICAgIHdlYnBhY2tTdGF0cy53YXJuaW5ncz8ucHVzaCh7IG1lc3NhZ2UgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgVGhyZXNob2xkU2V2ZXJpdHkuRXJyb3I6XG4gICAgICAgICAgICAgICAgICAgICAgd2VicGFja1N0YXRzLmVycm9ycz8ucHVzaCh7IG1lc3NhZ2UgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0TmV2ZXIoc2V2ZXJpdHkpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IGJ1aWxkU3VjY2VzcyA9IHN1Y2Nlc3MgJiYgIXN0YXRzSGFzRXJyb3JzKHdlYnBhY2tTdGF0cyk7XG4gICAgICAgICAgICAgIGlmIChidWlsZFN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAvLyBDb3B5IGFzc2V0c1xuICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy53YXRjaCAmJiBvcHRpb25zLmFzc2V0cz8ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICBzcGlubmVyLnN0YXJ0KCdDb3B5aW5nIGFzc2V0cy4uLicpO1xuICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgY29weUFzc2V0cyhcbiAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemVBc3NldFBhdHRlcm5zKFxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5hc3NldHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemUoY29udGV4dC53b3Jrc3BhY2VSb290KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vcm1hbGl6ZShwcm9qZWN0Um9vdCksXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9qZWN0U291cmNlUm9vdCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogbm9ybWFsaXplKHByb2plY3RTb3VyY2VSb290KSxcbiAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgICAgIEFycmF5LmZyb20ob3V0cHV0UGF0aHMudmFsdWVzKCkpLFxuICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdWNjZWVkKCdDb3B5aW5nIGFzc2V0cyBjb21wbGV0ZS4nKTtcbiAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBzcGlubmVyLmZhaWwoY29sb3JzLnJlZEJyaWdodCgnQ29weWluZyBvZiBhc3NldHMgZmFpbGVkLicpKTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdVbmFibGUgdG8gY29weSBhc3NldHM6ICcgKyBlcnIubWVzc2FnZSB9O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmluZGV4KSB7XG4gICAgICAgICAgICAgICAgICBzcGlubmVyLnN0YXJ0KCdHZW5lcmF0aW5nIGluZGV4IGh0bWwuLi4nKTtcblxuICAgICAgICAgICAgICAgICAgY29uc3QgZW50cnlwb2ludHMgPSBnZW5lcmF0ZUVudHJ5UG9pbnRzKHtcbiAgICAgICAgICAgICAgICAgICAgc2NyaXB0czogb3B0aW9ucy5zY3JpcHRzID8/IFtdLFxuICAgICAgICAgICAgICAgICAgICBzdHlsZXM6IG9wdGlvbnMuc3R5bGVzID8/IFtdLFxuICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4SHRtbEdlbmVyYXRvciA9IG5ldyBJbmRleEh0bWxHZW5lcmF0b3Ioe1xuICAgICAgICAgICAgICAgICAgICBjYWNoZTogY2FjaGVPcHRpb25zLFxuICAgICAgICAgICAgICAgICAgICBpbmRleFBhdGg6IHBhdGguam9pbihjb250ZXh0LndvcmtzcGFjZVJvb3QsIGdldEluZGV4SW5wdXRGaWxlKG9wdGlvbnMuaW5kZXgpKSxcbiAgICAgICAgICAgICAgICAgICAgZW50cnlwb2ludHMsXG4gICAgICAgICAgICAgICAgICAgIGRlcGxveVVybDogb3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgICAgICAgICAgICAgICAgIHNyaTogb3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSxcbiAgICAgICAgICAgICAgICAgICAgb3B0aW1pemF0aW9uOiBub3JtYWxpemVkT3B0aW1pemF0aW9uLFxuICAgICAgICAgICAgICAgICAgICBjcm9zc09yaWdpbjogb3B0aW9ucy5jcm9zc09yaWdpbixcbiAgICAgICAgICAgICAgICAgICAgcG9zdFRyYW5zZm9ybTogdHJhbnNmb3Jtcy5pbmRleEh0bWwsXG4gICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgbGV0IGhhc0Vycm9ycyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBbbG9jYWxlLCBvdXRwdXRQYXRoXSBvZiBvdXRwdXRQYXRocy5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IGluZGV4SHRtbEdlbmVyYXRvci5wcm9jZXNzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJhc2VIcmVmOiBnZXRMb2NhbGVCYXNlSHJlZihpMThuLCBsb2NhbGUpIHx8IG9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpMThuTG9jYWxlIGlzIHVzZWQgd2hlbiBJdnkgaXMgZGlzYWJsZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhbmc6IGxvY2FsZSB8fCB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXM6IG1hcEVtaXR0ZWRGaWxlc1RvRmlsZUluZm8oZW1pdHRlZEZpbGVzKSxcbiAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgIGlmICh3YXJuaW5ncy5sZW5ndGggfHwgZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdG9wKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB3YXJuaW5ncy5mb3JFYWNoKChtKSA9PiBjb250ZXh0LmxvZ2dlci53YXJuKG0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5mb3JFYWNoKChtKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKG0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBoYXNFcnJvcnMgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcGlubmVyLnN0YXJ0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXhPdXRwdXQgPSBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgZ2V0SW5kZXhPdXRwdXRGaWxlKG9wdGlvbnMuaW5kZXgpKTtcbiAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2RpcihwYXRoLmRpcm5hbWUoaW5kZXhPdXRwdXQpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy53cml0ZUZpbGUoaW5kZXhPdXRwdXQsIGNvbnRlbnQpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuZmFpbCgnSW5kZXggaHRtbCBnZW5lcmF0aW9uIGZhaWxlZC4nKTtcblxuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogbWFwRXJyb3JUb01lc3NhZ2UoZXJyb3IpIH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgaWYgKGhhc0Vycm9ycykge1xuICAgICAgICAgICAgICAgICAgICBzcGlubmVyLmZhaWwoJ0luZGV4IGh0bWwgZ2VuZXJhdGlvbiBmYWlsZWQuJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3VjY2VlZCgnSW5kZXggaHRtbCBnZW5lcmF0aW9uIGNvbXBsZXRlLicpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnNlcnZpY2VXb3JrZXIpIHtcbiAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3RhcnQoJ0dlbmVyYXRpbmcgc2VydmljZSB3b3JrZXIuLi4nKTtcbiAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgW2xvY2FsZSwgb3V0cHV0UGF0aF0gb2Ygb3V0cHV0UGF0aHMuZW50cmllcygpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgYXdhaXQgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyKFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9ybWFsaXplKHByb2plY3RSb290KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vcm1hbGl6ZShvdXRwdXRQYXRoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGdldExvY2FsZUJhc2VIcmVmKGkxOG4sIGxvY2FsZSkgfHwgb3B0aW9ucy5iYXNlSHJlZiB8fCAnLycsXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLm5nc3dDb25maWdQYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5mYWlsKCdTZXJ2aWNlIHdvcmtlciBnZW5lcmF0aW9uIGZhaWxlZC4nKTtcblxuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogbWFwRXJyb3JUb01lc3NhZ2UoZXJyb3IpIH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdWNjZWVkKCdTZXJ2aWNlIHdvcmtlciBnZW5lcmF0aW9uIGNvbXBsZXRlLicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHdlYnBhY2tTdGF0c0xvZ2dlcihjb250ZXh0LmxvZ2dlciwgd2VicGFja1N0YXRzLCBjb25maWcsIGJ1ZGdldEZhaWx1cmVzKTtcblxuICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBidWlsZFN1Y2Nlc3MgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KSxcbiAgICAgICAgICBtYXAoXG4gICAgICAgICAgICAoZXZlbnQpID0+XG4gICAgICAgICAgICAgICh7XG4gICAgICAgICAgICAgICAgLi4uZXZlbnQsXG4gICAgICAgICAgICAgICAgYmFzZU91dHB1dFBhdGgsXG4gICAgICAgICAgICAgICAgb3V0cHV0UGF0aDogYmFzZU91dHB1dFBhdGgsXG4gICAgICAgICAgICAgICAgb3V0cHV0UGF0aHM6IChvdXRwdXRQYXRocyAmJiBBcnJheS5mcm9tKG91dHB1dFBhdGhzLnZhbHVlcygpKSkgfHwgW2Jhc2VPdXRwdXRQYXRoXSxcbiAgICAgICAgICAgICAgfSBhcyBCcm93c2VyQnVpbGRlck91dHB1dCksXG4gICAgICAgICAgKSxcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgKSxcbiAgKTtcblxuICBmdW5jdGlvbiBnZXRMb2NhbGVCYXNlSHJlZihpMThuOiBJMThuT3B0aW9ucywgbG9jYWxlOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGlmIChpMThuLmxvY2FsZXNbbG9jYWxlXSAmJiBpMThuLmxvY2FsZXNbbG9jYWxlXT8uYmFzZUhyZWYgIT09ICcnKSB7XG4gICAgICByZXR1cm4gdXJsSm9pbihvcHRpb25zLmJhc2VIcmVmIHx8ICcnLCBpMThuLmxvY2FsZXNbbG9jYWxlXS5iYXNlSHJlZiA/PyBgLyR7bG9jYWxlfS9gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1hcEVycm9yVG9NZXNzYWdlKGVycm9yOiB1bmtub3duKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICByZXR1cm4gZXJyb3IubWVzc2FnZTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgZXJyb3IgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGVycm9yO1xuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gYXNzZXJ0TmV2ZXIoaW5wdXQ6IG5ldmVyKTogbmV2ZXIge1xuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgYFVuZXhwZWN0ZWQgY2FsbCB0byBhc3NlcnROZXZlcigpIHdpdGggaW5wdXQ6ICR7SlNPTi5zdHJpbmdpZnkoXG4gICAgICBpbnB1dCxcbiAgICAgIG51bGwgLyogcmVwbGFjZXIgKi8sXG4gICAgICA0IC8qIHRhYlNpemUgKi8sXG4gICAgKX1gLFxuICApO1xufVxuXG5mdW5jdGlvbiBtYXBFbWl0dGVkRmlsZXNUb0ZpbGVJbmZvKGZpbGVzOiBFbWl0dGVkRmlsZXNbXSA9IFtdKTogRmlsZUluZm9bXSB7XG4gIGNvbnN0IGZpbHRlcmVkRmlsZXM6IEZpbGVJbmZvW10gPSBbXTtcbiAgZm9yIChjb25zdCB7IGZpbGUsIG5hbWUsIGV4dGVuc2lvbiwgaW5pdGlhbCB9IG9mIGZpbGVzKSB7XG4gICAgaWYgKG5hbWUgJiYgaW5pdGlhbCkge1xuICAgICAgZmlsdGVyZWRGaWxlcy5wdXNoKHsgZmlsZSwgZXh0ZW5zaW9uLCBuYW1lIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmaWx0ZXJlZEZpbGVzO1xufVxuXG5mdW5jdGlvbiBjaGVja0ludGVybmV0RXhwbG9yZXJTdXBwb3J0KHByb2plY3RSb290OiBzdHJpbmcsIGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXJBcGkpOiB2b2lkIHtcbiAgY29uc3Qgc3VwcG9ydGVkQnJvd3NlcnMgPSBnZXRTdXBwb3J0ZWRCcm93c2Vycyhwcm9qZWN0Um9vdCk7XG4gIGlmIChzdXBwb3J0ZWRCcm93c2Vycy5zb21lKChiKSA9PiBiID09PSAnaWUgOScgfHwgYiA9PT0gJ2llIDEwJyB8fCBiID09PSAnaWUgMTEnKSkge1xuICAgIGxvZ2dlci53YXJuKFxuICAgICAgYFdhcm5pbmc6IFN1cHBvcnQgd2FzIHJlcXVlc3RlZCBmb3IgSW50ZXJuZXQgRXhwbG9yZXIgaW4gdGhlIHByb2plY3QncyBicm93c2Vyc2xpc3QgY29uZmlndXJhdGlvbi4gYCArXG4gICAgICAgICdJbnRlcm5ldCBFeHBsb3JlciBpcyBubyBsb25nZXIgb2ZmaWNpYWxseSBzdXBwb3J0ZWQuJyArXG4gICAgICAgICdcXG5Gb3IgbW9yZSBpbmZvcm1hdGlvbiwgc2VlIGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS9icm93c2VyLXN1cHBvcnQnLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcjxCcm93c2VyQnVpbGRlclNjaGVtYT4oYnVpbGRXZWJwYWNrQnJvd3Nlcik7XG4iXX0=