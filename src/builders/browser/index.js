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
const error_1 = require("../../utils/error");
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
        var _a;
        var _b;
        // Purge old build disk cache.
        await (0, purge_cache_1.purgeStaleBuildCache)(context);
        // Initialize builder
        const initialization = await initialize(options, context, transforms.webpackConfiguration);
        // Check and warn about IE browser support
        checkInternetExplorerSupport(initialization.projectRoot, context.logger);
        // Add index file to watched files.
        if (options.watch) {
            const indexInputFile = path.join(context.workspaceRoot, (0, webpack_browser_config_1.getIndexInputFile)(options.index));
            (_a = (_b = initialization.config).plugins) !== null && _a !== void 0 ? _a : (_b.plugins = []);
            initialization.config.plugins.push({
                apply: (compiler) => {
                    compiler.hooks.thisCompilation.tap('build-angular', (compilation) => {
                        compilation.fileDependencies.add(indexInputFile);
                    });
                },
            });
        }
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
                            (0, error_1.assertIsError)(err);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQXlGO0FBQ3pGLGlFQUFpRztBQUVqRyx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLCtCQUF3QztBQUN4Qyw4Q0FBMkQ7QUFDM0QsMkNBQTBDO0FBRzFDLHVDQUtxQjtBQUNyQixxRUFJdUM7QUFDdkMsNkNBQTJDO0FBQzNDLHlEQUFxRDtBQUNyRCw2Q0FBa0Q7QUFDbEQsNkRBQW1FO0FBR25FLHNGQUdxRDtBQUNyRCxpRUFBb0U7QUFDcEUsMkRBQTZEO0FBQzdELHVFQUFxRTtBQUNyRSx5REFBK0Q7QUFDL0QsK0RBQXlFO0FBQ3pFLGlEQUE4QztBQUM5Qyx1RUFBc0U7QUFDdEUsaURBQXFFO0FBQ3JFLCtFQUk0QztBQUM1QyxtREFBNkY7QUFDN0YsbUVBQTZFO0FBQzdFLHlEQUF3RTtBQUN4RSxxREFNbUM7QUF3Qm5DOzs7R0FHRztBQUNVLFFBQUEsYUFBYSxHQUFHLEtBQU0sQ0FBQztBQUVwQyxLQUFLLFVBQVUsVUFBVSxDQUN2QixPQUE2QixFQUM3QixPQUF1QixFQUN2Qiw2QkFBMkU7O0lBUTNFLE1BQU0sa0JBQWtCLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQztJQUU5QyxvRUFBb0U7SUFDcEUsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsQ0FBQztJQUU3RSxNQUFNLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVB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QUFLLE9BQU8sSUFBSSxDQUFDLEtBQUssT0FBTyxDQUFDLEVBQUU7UUFDakYsTUFBTSxDQUFDLElBQUksQ0FDVCxvR0FBb0c7WUFDbEcsc0RBQXNEO1lBQ3RELHNFQUFzRSxDQUN6RSxDQUFDO0tBQ0g7QUFDSCxDQUFDO0FBRUQsa0JBQWUsSUFBQSx5QkFBYSxFQUF1QixtQkFBbUIsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBFbWl0dGVkRmlsZXMsIFdlYnBhY2tMb2dnaW5nQ2FsbGJhY2ssIHJ1bldlYnBhY2sgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyBsb2dnaW5nIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbWFwLCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBTY3JpcHRUYXJnZXQgfSBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgRXhlY3V0aW9uVHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7XG4gIGRlbGV0ZU91dHB1dERpcixcbiAgbm9ybWFsaXplQXNzZXRQYXR0ZXJucyxcbiAgbm9ybWFsaXplT3B0aW1pemF0aW9uLFxuICB1cmxKb2luLFxufSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQge1xuICBCdWRnZXRDYWxjdWxhdG9yUmVzdWx0LFxuICBUaHJlc2hvbGRTZXZlcml0eSxcbiAgY2hlY2tCdWRnZXRzLFxufSBmcm9tICcuLi8uLi91dGlscy9idW5kbGUtY2FsY3VsYXRvcic7XG5pbXBvcnQgeyBjb2xvcnMgfSBmcm9tICcuLi8uLi91dGlscy9jb2xvcic7XG5pbXBvcnQgeyBjb3B5QXNzZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29weS1hc3NldHMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNFcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9yJztcbmltcG9ydCB7IGkxOG5JbmxpbmVFbWl0dGVkRmlsZXMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLWlubGluaW5nJztcbmltcG9ydCB7IEkxOG5PcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IEZpbGVJbmZvIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9hdWdtZW50LWluZGV4LWh0bWwnO1xuaW1wb3J0IHtcbiAgSW5kZXhIdG1sR2VuZXJhdG9yLFxuICBJbmRleEh0bWxUcmFuc2Zvcm0sXG59IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgbm9ybWFsaXplQ2FjaGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvbm9ybWFsaXplLWNhY2hlJztcbmltcG9ydCB7IGVuc3VyZU91dHB1dFBhdGhzIH0gZnJvbSAnLi4vLi4vdXRpbHMvb3V0cHV0LXBhdGhzJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMgfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUgfSBmcm9tICcuLi8uLi91dGlscy9wdXJnZS1jYWNoZSc7XG5pbXBvcnQgeyBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIgfSBmcm9tICcuLi8uLi91dGlscy9zZXJ2aWNlLXdvcmtlcic7XG5pbXBvcnQgeyBTcGlubmVyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lcic7XG5pbXBvcnQgeyBnZXRTdXBwb3J0ZWRCcm93c2VycyB9IGZyb20gJy4uLy4uL3V0aWxzL3N1cHBvcnRlZC1icm93c2Vycyc7XG5pbXBvcnQgeyBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24gfSBmcm9tICcuLi8uLi91dGlscy92ZXJzaW9uJztcbmltcG9ydCB7XG4gIGdlbmVyYXRlSTE4bkJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQsXG4gIGdldEluZGV4SW5wdXRGaWxlLFxuICBnZXRJbmRleE91dHB1dEZpbGUsXG59IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgZ2V0QW5hbHl0aWNzQ29uZmlnLCBnZXRDb21tb25Db25maWcsIGdldFN0eWxlc0NvbmZpZyB9IGZyb20gJy4uLy4uL3dlYnBhY2svY29uZmlncyc7XG5pbXBvcnQgeyBtYXJrQXN5bmNDaHVua3NOb25Jbml0aWFsIH0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9hc3luYy1jaHVua3MnO1xuaW1wb3J0IHsgbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyB9IGZyb20gJy4uLy4uL3dlYnBhY2svdXRpbHMvaGVscGVycyc7XG5pbXBvcnQge1xuICBzdGF0c0Vycm9yc1RvU3RyaW5nLFxuICBzdGF0c0hhc0Vycm9ycyxcbiAgc3RhdHNIYXNXYXJuaW5ncyxcbiAgc3RhdHNXYXJuaW5nc1RvU3RyaW5nLFxuICB3ZWJwYWNrU3RhdHNMb2dnZXIsXG59IGZyb20gJy4uLy4uL3dlYnBhY2svdXRpbHMvc3RhdHMnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgdHlwZSBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuZXhwb3J0IHR5cGUgQnJvd3NlckJ1aWxkZXJPdXRwdXQgPSBCdWlsZGVyT3V0cHV0ICYge1xuICBiYXNlT3V0cHV0UGF0aDogc3RyaW5nO1xuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgaW4gdmVyc2lvbiAxNC4gVXNlICdvdXRwdXRzJyBpbnN0ZWFkLlxuICAgKi9cbiAgb3V0cHV0UGF0aHM6IHN0cmluZ1tdO1xuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgaW4gdmVyc2lvbiA5LiBVc2UgJ291dHB1dHMnIGluc3RlYWQuXG4gICAqL1xuICBvdXRwdXRQYXRoOiBzdHJpbmc7XG5cbiAgb3V0cHV0czoge1xuICAgIGxvY2FsZT86IHN0cmluZztcbiAgICBwYXRoOiBzdHJpbmc7XG4gICAgYmFzZUhyZWY/OiBzdHJpbmc7XG4gIH1bXTtcbn07XG5cbi8qKlxuICogTWF4aW11bSB0aW1lIGluIG1pbGxpc2Vjb25kcyBmb3Igc2luZ2xlIGJ1aWxkL3JlYnVpbGRcbiAqIFRoaXMgYWNjb3VudHMgZm9yIENJIHZhcmlhYmlsaXR5LlxuICovXG5leHBvcnQgY29uc3QgQlVJTERfVElNRU9VVCA9IDMwXzAwMDtcblxuYXN5bmMgZnVuY3Rpb24gaW5pdGlhbGl6ZShcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybT86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPHdlYnBhY2suQ29uZmlndXJhdGlvbj4sXG4pOiBQcm9taXNlPHtcbiAgY29uZmlnOiB3ZWJwYWNrLkNvbmZpZ3VyYXRpb247XG4gIHByb2plY3RSb290OiBzdHJpbmc7XG4gIHByb2plY3RTb3VyY2VSb290Pzogc3RyaW5nO1xuICBpMThuOiBJMThuT3B0aW9ucztcbiAgdGFyZ2V0OiBTY3JpcHRUYXJnZXQ7XG59PiB7XG4gIGNvbnN0IG9yaWdpbmFsT3V0cHV0UGF0aCA9IG9wdGlvbnMub3V0cHV0UGF0aDtcblxuICAvLyBBc3NldHMgYXJlIHByb2Nlc3NlZCBkaXJlY3RseSBieSB0aGUgYnVpbGRlciBleGNlcHQgd2hlbiB3YXRjaGluZ1xuICBjb25zdCBhZGp1c3RlZE9wdGlvbnMgPSBvcHRpb25zLndhdGNoID8gb3B0aW9ucyA6IHsgLi4ub3B0aW9ucywgYXNzZXRzOiBbXSB9O1xuXG4gIGNvbnN0IHsgY29uZmlnLCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QsIGkxOG4sIHRhcmdldCB9ID1cbiAgICBhd2FpdCBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KGFkanVzdGVkT3B0aW9ucywgY29udGV4dCwgKHdjbykgPT4gW1xuICAgICAgZ2V0Q29tbW9uQ29uZmlnKHdjbyksXG4gICAgICBnZXRTdHlsZXNDb25maWcod2NvKSxcbiAgICAgIGdldEFuYWx5dGljc0NvbmZpZyh3Y28sIGNvbnRleHQpLFxuICAgIF0pO1xuXG4gIC8vIFZhbGlkYXRlIGFzc2V0IG9wdGlvbiB2YWx1ZXMgaWYgcHJvY2Vzc2VkIGRpcmVjdGx5XG4gIGlmIChvcHRpb25zLmFzc2V0cz8ubGVuZ3RoICYmICFhZGp1c3RlZE9wdGlvbnMuYXNzZXRzPy5sZW5ndGgpIHtcbiAgICBub3JtYWxpemVBc3NldFBhdHRlcm5zKFxuICAgICAgb3B0aW9ucy5hc3NldHMsXG4gICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICBwcm9qZWN0Um9vdCxcbiAgICAgIHByb2plY3RTb3VyY2VSb290LFxuICAgICkuZm9yRWFjaCgoeyBvdXRwdXQgfSkgPT4ge1xuICAgICAgaWYgKG91dHB1dC5zdGFydHNXaXRoKCcuLicpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQW4gYXNzZXQgY2Fubm90IGJlIHdyaXR0ZW4gdG8gYSBsb2NhdGlvbiBvdXRzaWRlIG9mIHRoZSBvdXRwdXQgcGF0aC4nKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGxldCB0cmFuc2Zvcm1lZENvbmZpZztcbiAgaWYgKHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtKSB7XG4gICAgdHJhbnNmb3JtZWRDb25maWcgPSBhd2FpdCB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybShjb25maWcpO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aCkge1xuICAgIGRlbGV0ZU91dHB1dERpcihjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9yaWdpbmFsT3V0cHV0UGF0aCk7XG4gIH1cblxuICByZXR1cm4geyBjb25maWc6IHRyYW5zZm9ybWVkQ29uZmlnIHx8IGNvbmZpZywgcHJvamVjdFJvb3QsIHByb2plY3RTb3VyY2VSb290LCBpMThuLCB0YXJnZXQgfTtcbn1cblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkV2VicGFja0Jyb3dzZXIoXG4gIG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgdHJhbnNmb3Jtczoge1xuICAgIHdlYnBhY2tDb25maWd1cmF0aW9uPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8d2VicGFjay5Db25maWd1cmF0aW9uPjtcbiAgICBsb2dnaW5nPzogV2VicGFja0xvZ2dpbmdDYWxsYmFjaztcbiAgICBpbmRleEh0bWw/OiBJbmRleEh0bWxUcmFuc2Zvcm07XG4gIH0gPSB7fSxcbik6IE9ic2VydmFibGU8QnJvd3NlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVGhlIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQuJyk7XG4gIH1cblxuICBjb25zdCBiYXNlT3V0cHV0UGF0aCA9IHBhdGgucmVzb2x2ZShjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9wdGlvbnMub3V0cHV0UGF0aCk7XG4gIGxldCBvdXRwdXRQYXRoczogdW5kZWZpbmVkIHwgTWFwPHN0cmluZywgc3RyaW5nPjtcblxuICAvLyBDaGVjayBBbmd1bGFyIHZlcnNpb24uXG4gIGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbihjb250ZXh0LndvcmtzcGFjZVJvb3QpO1xuXG4gIHJldHVybiBmcm9tKGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKSkucGlwZShcbiAgICBzd2l0Y2hNYXAoYXN5bmMgKHByb2plY3RNZXRhZGF0YSkgPT4ge1xuICAgICAgLy8gUHVyZ2Ugb2xkIGJ1aWxkIGRpc2sgY2FjaGUuXG4gICAgICBhd2FpdCBwdXJnZVN0YWxlQnVpbGRDYWNoZShjb250ZXh0KTtcblxuICAgICAgLy8gSW5pdGlhbGl6ZSBidWlsZGVyXG4gICAgICBjb25zdCBpbml0aWFsaXphdGlvbiA9IGF3YWl0IGluaXRpYWxpemUob3B0aW9ucywgY29udGV4dCwgdHJhbnNmb3Jtcy53ZWJwYWNrQ29uZmlndXJhdGlvbik7XG5cbiAgICAgIC8vIENoZWNrIGFuZCB3YXJuIGFib3V0IElFIGJyb3dzZXIgc3VwcG9ydFxuICAgICAgY2hlY2tJbnRlcm5ldEV4cGxvcmVyU3VwcG9ydChpbml0aWFsaXphdGlvbi5wcm9qZWN0Um9vdCwgY29udGV4dC5sb2dnZXIpO1xuXG4gICAgICAvLyBBZGQgaW5kZXggZmlsZSB0byB3YXRjaGVkIGZpbGVzLlxuICAgICAgaWYgKG9wdGlvbnMud2F0Y2gpIHtcbiAgICAgICAgY29uc3QgaW5kZXhJbnB1dEZpbGUgPSBwYXRoLmpvaW4oY29udGV4dC53b3Jrc3BhY2VSb290LCBnZXRJbmRleElucHV0RmlsZShvcHRpb25zLmluZGV4KSk7XG4gICAgICAgIGluaXRpYWxpemF0aW9uLmNvbmZpZy5wbHVnaW5zID8/PSBbXTtcbiAgICAgICAgaW5pdGlhbGl6YXRpb24uY29uZmlnLnBsdWdpbnMucHVzaCh7XG4gICAgICAgICAgYXBwbHk6IChjb21waWxlcjogd2VicGFjay5Db21waWxlcikgPT4ge1xuICAgICAgICAgICAgY29tcGlsZXIuaG9va3MudGhpc0NvbXBpbGF0aW9uLnRhcCgnYnVpbGQtYW5ndWxhcicsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgICAgICAgICBjb21waWxhdGlvbi5maWxlRGVwZW5kZW5jaWVzLmFkZChpbmRleElucHV0RmlsZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4uaW5pdGlhbGl6YXRpb24sXG4gICAgICAgIGNhY2hlT3B0aW9uczogbm9ybWFsaXplQ2FjaGVPcHRpb25zKHByb2plY3RNZXRhZGF0YSwgY29udGV4dC53b3Jrc3BhY2VSb290KSxcbiAgICAgIH07XG4gICAgfSksXG4gICAgc3dpdGNoTWFwKFxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbiAgICAgICh7IGNvbmZpZywgcHJvamVjdFJvb3QsIHByb2plY3RTb3VyY2VSb290LCBpMThuLCB0YXJnZXQsIGNhY2hlT3B0aW9ucyB9KSA9PiB7XG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWRPcHRpbWl6YXRpb24gPSBub3JtYWxpemVPcHRpbWl6YXRpb24ob3B0aW9ucy5vcHRpbWl6YXRpb24pO1xuXG4gICAgICAgIHJldHVybiBydW5XZWJwYWNrKGNvbmZpZywgY29udGV4dCwge1xuICAgICAgICAgIHdlYnBhY2tGYWN0b3J5OiByZXF1aXJlKCd3ZWJwYWNrJykgYXMgdHlwZW9mIHdlYnBhY2ssXG4gICAgICAgICAgbG9nZ2luZzpcbiAgICAgICAgICAgIHRyYW5zZm9ybXMubG9nZ2luZyB8fFxuICAgICAgICAgICAgKChzdGF0cywgY29uZmlnKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChvcHRpb25zLnZlcmJvc2UpIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKHN0YXRzLnRvU3RyaW5nKGNvbmZpZy5zdGF0cykpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgfSkucGlwZShcbiAgICAgICAgICBjb25jYXRNYXAoYXN5bmMgKGJ1aWxkRXZlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcigpO1xuICAgICAgICAgICAgc3Bpbm5lci5lbmFibGVkID0gb3B0aW9ucy5wcm9ncmVzcyAhPT0gZmFsc2U7XG5cbiAgICAgICAgICAgIGNvbnN0IHsgc3VjY2VzcywgZW1pdHRlZEZpbGVzID0gW10sIG91dHB1dFBhdGg6IHdlYnBhY2tPdXRwdXRQYXRoIH0gPSBidWlsZEV2ZW50O1xuICAgICAgICAgICAgY29uc3Qgd2VicGFja1Jhd1N0YXRzID0gYnVpbGRFdmVudC53ZWJwYWNrU3RhdHM7XG4gICAgICAgICAgICBpZiAoIXdlYnBhY2tSYXdTdGF0cykge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYnBhY2sgc3RhdHMgYnVpbGQgcmVzdWx0IGlzIHJlcXVpcmVkLicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBGaXggaW5jb3JyZWN0bHkgc2V0IGBpbml0aWFsYCB2YWx1ZSBvbiBjaHVua3MuXG4gICAgICAgICAgICBjb25zdCBleHRyYUVudHJ5UG9pbnRzID0gW1xuICAgICAgICAgICAgICAuLi5ub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKG9wdGlvbnMuc3R5bGVzIHx8IFtdLCAnc3R5bGVzJyksXG4gICAgICAgICAgICAgIC4uLm5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMob3B0aW9ucy5zY3JpcHRzIHx8IFtdLCAnc2NyaXB0cycpLFxuICAgICAgICAgICAgXTtcblxuICAgICAgICAgICAgY29uc3Qgd2VicGFja1N0YXRzID0ge1xuICAgICAgICAgICAgICAuLi53ZWJwYWNrUmF3U3RhdHMsXG4gICAgICAgICAgICAgIGNodW5rczogbWFya0FzeW5jQ2h1bmtzTm9uSW5pdGlhbCh3ZWJwYWNrUmF3U3RhdHMsIGV4dHJhRW50cnlQb2ludHMpLFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICAgICAgICAgIC8vIElmIHVzaW5nIGJ1bmRsZSBkb3dubGV2ZWxpbmcgdGhlbiB0aGVyZSBpcyBvbmx5IG9uZSBidWlsZFxuICAgICAgICAgICAgICAvLyBJZiBpdCBmYWlscyBzaG93IGFueSBkaWFnbm9zdGljIG1lc3NhZ2VzIGFuZCBiYWlsXG4gICAgICAgICAgICAgIGlmIChzdGF0c0hhc1dhcm5pbmdzKHdlYnBhY2tTdGF0cykpIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmxvZ2dlci53YXJuKHN0YXRzV2FybmluZ3NUb1N0cmluZyh3ZWJwYWNrU3RhdHMsIHsgY29sb3JzOiB0cnVlIH0pKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoc3RhdHNIYXNFcnJvcnMod2VicGFja1N0YXRzKSkge1xuICAgICAgICAgICAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKHN0YXRzRXJyb3JzVG9TdHJpbmcod2VicGFja1N0YXRzLCB7IGNvbG9yczogdHJ1ZSB9KSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzIH07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvdXRwdXRQYXRocyA9IGVuc3VyZU91dHB1dFBhdGhzKGJhc2VPdXRwdXRQYXRoLCBpMThuKTtcblxuICAgICAgICAgICAgICBjb25zdCBzY3JpcHRzRW50cnlQb2ludE5hbWUgPSBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKFxuICAgICAgICAgICAgICAgIG9wdGlvbnMuc2NyaXB0cyB8fCBbXSxcbiAgICAgICAgICAgICAgICAnc2NyaXB0cycsXG4gICAgICAgICAgICAgICkubWFwKCh4KSA9PiB4LmJ1bmRsZU5hbWUpO1xuXG4gICAgICAgICAgICAgIGlmIChpMThuLnNob3VsZElubGluZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBhd2FpdCBpMThuSW5saW5lRW1pdHRlZEZpbGVzKFxuICAgICAgICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgICAgICAgIGVtaXR0ZWRGaWxlcyxcbiAgICAgICAgICAgICAgICAgIGkxOG4sXG4gICAgICAgICAgICAgICAgICBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgICAgIEFycmF5LmZyb20ob3V0cHV0UGF0aHMudmFsdWVzKCkpLFxuICAgICAgICAgICAgICAgICAgc2NyaXB0c0VudHJ5UG9pbnROYW1lLFxuICAgICAgICAgICAgICAgICAgd2VicGFja091dHB1dFBhdGgsXG4gICAgICAgICAgICAgICAgICB0YXJnZXQgPD0gU2NyaXB0VGFyZ2V0LkVTNSxcbiAgICAgICAgICAgICAgICAgIG9wdGlvbnMuaTE4bk1pc3NpbmdUcmFuc2xhdGlvbixcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGlmICghc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBDaGVjayBmb3IgYnVkZ2V0IGVycm9ycyBhbmQgZGlzcGxheSB0aGVtIHRvIHRoZSB1c2VyLlxuICAgICAgICAgICAgICBjb25zdCBidWRnZXRzID0gb3B0aW9ucy5idWRnZXRzO1xuICAgICAgICAgICAgICBsZXQgYnVkZ2V0RmFpbHVyZXM6IEJ1ZGdldENhbGN1bGF0b3JSZXN1bHRbXSB8IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgaWYgKGJ1ZGdldHM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGJ1ZGdldEZhaWx1cmVzID0gWy4uLmNoZWNrQnVkZ2V0cyhidWRnZXRzLCB3ZWJwYWNrU3RhdHMpXTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHsgc2V2ZXJpdHksIG1lc3NhZ2UgfSBvZiBidWRnZXRGYWlsdXJlcykge1xuICAgICAgICAgICAgICAgICAgc3dpdGNoIChzZXZlcml0eSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFRocmVzaG9sZFNldmVyaXR5Lldhcm5pbmc6XG4gICAgICAgICAgICAgICAgICAgICAgd2VicGFja1N0YXRzLndhcm5pbmdzPy5wdXNoKHsgbWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBUaHJlc2hvbGRTZXZlcml0eS5FcnJvcjpcbiAgICAgICAgICAgICAgICAgICAgICB3ZWJwYWNrU3RhdHMuZXJyb3JzPy5wdXNoKHsgbWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICBhc3NlcnROZXZlcihzZXZlcml0eSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgYnVpbGRTdWNjZXNzID0gc3VjY2VzcyAmJiAhc3RhdHNIYXNFcnJvcnMod2VicGFja1N0YXRzKTtcbiAgICAgICAgICAgICAgaWYgKGJ1aWxkU3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIC8vIENvcHkgYXNzZXRzXG4gICAgICAgICAgICAgICAgaWYgKCFvcHRpb25zLndhdGNoICYmIG9wdGlvbnMuYXNzZXRzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3RhcnQoJ0NvcHlpbmcgYXNzZXRzLi4uJyk7XG4gICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBjb3B5QXNzZXRzKFxuICAgICAgICAgICAgICAgICAgICAgIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMoXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmFzc2V0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb2plY3RSb290LFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvamVjdFNvdXJjZVJvb3QsXG4gICAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgICBBcnJheS5mcm9tKG91dHB1dFBhdGhzLnZhbHVlcygpKSxcbiAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3VjY2VlZCgnQ29weWluZyBhc3NldHMgY29tcGxldGUuJyk7XG4gICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5mYWlsKGNvbG9ycy5yZWRCcmlnaHQoJ0NvcHlpbmcgb2YgYXNzZXRzIGZhaWxlZC4nKSk7XG4gICAgICAgICAgICAgICAgICAgIGFzc2VydElzRXJyb3IoZXJyKTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdVbmFibGUgdG8gY29weSBhc3NldHM6ICcgKyBlcnIubWVzc2FnZSB9O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmluZGV4KSB7XG4gICAgICAgICAgICAgICAgICBzcGlubmVyLnN0YXJ0KCdHZW5lcmF0aW5nIGluZGV4IGh0bWwuLi4nKTtcblxuICAgICAgICAgICAgICAgICAgY29uc3QgZW50cnlwb2ludHMgPSBnZW5lcmF0ZUVudHJ5UG9pbnRzKHtcbiAgICAgICAgICAgICAgICAgICAgc2NyaXB0czogb3B0aW9ucy5zY3JpcHRzID8/IFtdLFxuICAgICAgICAgICAgICAgICAgICBzdHlsZXM6IG9wdGlvbnMuc3R5bGVzID8/IFtdLFxuICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4SHRtbEdlbmVyYXRvciA9IG5ldyBJbmRleEh0bWxHZW5lcmF0b3Ioe1xuICAgICAgICAgICAgICAgICAgICBjYWNoZTogY2FjaGVPcHRpb25zLFxuICAgICAgICAgICAgICAgICAgICBpbmRleFBhdGg6IHBhdGguam9pbihjb250ZXh0LndvcmtzcGFjZVJvb3QsIGdldEluZGV4SW5wdXRGaWxlKG9wdGlvbnMuaW5kZXgpKSxcbiAgICAgICAgICAgICAgICAgICAgZW50cnlwb2ludHMsXG4gICAgICAgICAgICAgICAgICAgIGRlcGxveVVybDogb3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgICAgICAgICAgICAgICAgIHNyaTogb3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSxcbiAgICAgICAgICAgICAgICAgICAgb3B0aW1pemF0aW9uOiBub3JtYWxpemVkT3B0aW1pemF0aW9uLFxuICAgICAgICAgICAgICAgICAgICBjcm9zc09yaWdpbjogb3B0aW9ucy5jcm9zc09yaWdpbixcbiAgICAgICAgICAgICAgICAgICAgcG9zdFRyYW5zZm9ybTogdHJhbnNmb3Jtcy5pbmRleEh0bWwsXG4gICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgbGV0IGhhc0Vycm9ycyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBbbG9jYWxlLCBvdXRwdXRQYXRoXSBvZiBvdXRwdXRQYXRocy5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IGluZGV4SHRtbEdlbmVyYXRvci5wcm9jZXNzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJhc2VIcmVmOiBnZXRMb2NhbGVCYXNlSHJlZihpMThuLCBsb2NhbGUpID8/IG9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpMThuTG9jYWxlIGlzIHVzZWQgd2hlbiBJdnkgaXMgZGlzYWJsZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhbmc6IGxvY2FsZSB8fCB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXM6IG1hcEVtaXR0ZWRGaWxlc1RvRmlsZUluZm8oZW1pdHRlZEZpbGVzKSxcbiAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgIGlmICh3YXJuaW5ncy5sZW5ndGggfHwgZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdG9wKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB3YXJuaW5ncy5mb3JFYWNoKChtKSA9PiBjb250ZXh0LmxvZ2dlci53YXJuKG0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9ycy5mb3JFYWNoKChtKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKG0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBoYXNFcnJvcnMgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcGlubmVyLnN0YXJ0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXhPdXRwdXQgPSBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgZ2V0SW5kZXhPdXRwdXRGaWxlKG9wdGlvbnMuaW5kZXgpKTtcbiAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy5ta2RpcihwYXRoLmRpcm5hbWUoaW5kZXhPdXRwdXQpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBmcy5wcm9taXNlcy53cml0ZUZpbGUoaW5kZXhPdXRwdXQsIGNvbnRlbnQpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuZmFpbCgnSW5kZXggaHRtbCBnZW5lcmF0aW9uIGZhaWxlZC4nKTtcblxuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogbWFwRXJyb3JUb01lc3NhZ2UoZXJyb3IpIH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgaWYgKGhhc0Vycm9ycykge1xuICAgICAgICAgICAgICAgICAgICBzcGlubmVyLmZhaWwoJ0luZGV4IGh0bWwgZ2VuZXJhdGlvbiBmYWlsZWQuJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3VjY2VlZCgnSW5kZXggaHRtbCBnZW5lcmF0aW9uIGNvbXBsZXRlLicpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnNlcnZpY2VXb3JrZXIpIHtcbiAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3RhcnQoJ0dlbmVyYXRpbmcgc2VydmljZSB3b3JrZXIuLi4nKTtcbiAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgW2xvY2FsZSwgb3V0cHV0UGF0aF0gb2Ygb3V0cHV0UGF0aHMuZW50cmllcygpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgYXdhaXQgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyKFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvamVjdFJvb3QsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgZ2V0TG9jYWxlQmFzZUhyZWYoaTE4biwgbG9jYWxlKSA/PyBvcHRpb25zLmJhc2VIcmVmID8/ICcvJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMubmdzd0NvbmZpZ1BhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzcGlubmVyLmZhaWwoJ1NlcnZpY2Ugd29ya2VyIGdlbmVyYXRpb24gZmFpbGVkLicpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBtYXBFcnJvclRvTWVzc2FnZShlcnJvcikgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBzcGlubmVyLnN1Y2NlZWQoJ1NlcnZpY2Ugd29ya2VyIGdlbmVyYXRpb24gY29tcGxldGUuJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgd2VicGFja1N0YXRzTG9nZ2VyKGNvbnRleHQubG9nZ2VyLCB3ZWJwYWNrU3RhdHMsIGNvbmZpZywgYnVkZ2V0RmFpbHVyZXMpO1xuXG4gICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGJ1aWxkU3VjY2VzcyB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG1hcChcbiAgICAgICAgICAgIChldmVudCkgPT5cbiAgICAgICAgICAgICAgKHtcbiAgICAgICAgICAgICAgICAuLi5ldmVudCxcbiAgICAgICAgICAgICAgICBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgICBvdXRwdXRQYXRoOiBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgICBvdXRwdXRQYXRoczogKG91dHB1dFBhdGhzICYmIEFycmF5LmZyb20ob3V0cHV0UGF0aHMudmFsdWVzKCkpKSB8fCBbYmFzZU91dHB1dFBhdGhdLFxuICAgICAgICAgICAgICAgIG91dHB1dHM6IChvdXRwdXRQYXRocyAmJlxuICAgICAgICAgICAgICAgICAgWy4uLm91dHB1dFBhdGhzLmVudHJpZXMoKV0ubWFwKChbbG9jYWxlLCBwYXRoXSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxlLFxuICAgICAgICAgICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgICAgICAgICBiYXNlSHJlZjogZ2V0TG9jYWxlQmFzZUhyZWYoaTE4biwgbG9jYWxlKSA/PyBvcHRpb25zLmJhc2VIcmVmLFxuICAgICAgICAgICAgICAgICAgfSkpKSB8fCB7XG4gICAgICAgICAgICAgICAgICBwYXRoOiBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgICAgIGJhc2VIcmVmOiBvcHRpb25zLmJhc2VIcmVmLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0gYXMgQnJvd3NlckJ1aWxkZXJPdXRwdXQpLFxuICAgICAgICAgICksXG4gICAgICAgICk7XG4gICAgICB9LFxuICAgICksXG4gICk7XG5cbiAgZnVuY3Rpb24gZ2V0TG9jYWxlQmFzZUhyZWYoaTE4bjogSTE4bk9wdGlvbnMsIGxvY2FsZTogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoaTE4bi5sb2NhbGVzW2xvY2FsZV0gJiYgaTE4bi5sb2NhbGVzW2xvY2FsZV0/LmJhc2VIcmVmICE9PSAnJykge1xuICAgICAgcmV0dXJuIHVybEpvaW4ob3B0aW9ucy5iYXNlSHJlZiB8fCAnJywgaTE4bi5sb2NhbGVzW2xvY2FsZV0uYmFzZUhyZWYgPz8gYC8ke2xvY2FsZX0vYCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG5mdW5jdGlvbiBtYXBFcnJvclRvTWVzc2FnZShlcnJvcjogdW5rbm93bik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgcmV0dXJuIGVycm9yLm1lc3NhZ2U7XG4gIH1cblxuICBpZiAodHlwZW9mIGVycm9yID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBlcnJvcjtcbiAgfVxuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGFzc2VydE5ldmVyKGlucHV0OiBuZXZlcik6IG5ldmVyIHtcbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgIGBVbmV4cGVjdGVkIGNhbGwgdG8gYXNzZXJ0TmV2ZXIoKSB3aXRoIGlucHV0OiAke0pTT04uc3RyaW5naWZ5KFxuICAgICAgaW5wdXQsXG4gICAgICBudWxsIC8qIHJlcGxhY2VyICovLFxuICAgICAgNCAvKiB0YWJTaXplICovLFxuICAgICl9YCxcbiAgKTtcbn1cblxuZnVuY3Rpb24gbWFwRW1pdHRlZEZpbGVzVG9GaWxlSW5mbyhmaWxlczogRW1pdHRlZEZpbGVzW10gPSBbXSk6IEZpbGVJbmZvW10ge1xuICBjb25zdCBmaWx0ZXJlZEZpbGVzOiBGaWxlSW5mb1tdID0gW107XG4gIGZvciAoY29uc3QgeyBmaWxlLCBuYW1lLCBleHRlbnNpb24sIGluaXRpYWwgfSBvZiBmaWxlcykge1xuICAgIGlmIChuYW1lICYmIGluaXRpYWwpIHtcbiAgICAgIGZpbHRlcmVkRmlsZXMucHVzaCh7IGZpbGUsIGV4dGVuc2lvbiwgbmFtZSB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmlsdGVyZWRGaWxlcztcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnRlcm5ldEV4cGxvcmVyU3VwcG9ydChwcm9qZWN0Um9vdDogc3RyaW5nLCBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpKTogdm9pZCB7XG4gIGNvbnN0IHN1cHBvcnRlZEJyb3dzZXJzID0gZ2V0U3VwcG9ydGVkQnJvd3NlcnMocHJvamVjdFJvb3QpO1xuICBpZiAoc3VwcG9ydGVkQnJvd3NlcnMuc29tZSgoYikgPT4gYiA9PT0gJ2llIDknIHx8IGIgPT09ICdpZSAxMCcgfHwgYiA9PT0gJ2llIDExJykpIHtcbiAgICBsb2dnZXIud2FybihcbiAgICAgIGBXYXJuaW5nOiBTdXBwb3J0IHdhcyByZXF1ZXN0ZWQgZm9yIEludGVybmV0IEV4cGxvcmVyIGluIHRoZSBwcm9qZWN0J3MgYnJvd3NlcnNsaXN0IGNvbmZpZ3VyYXRpb24uIGAgK1xuICAgICAgICAnSW50ZXJuZXQgRXhwbG9yZXIgaXMgbm8gbG9uZ2VyIG9mZmljaWFsbHkgc3VwcG9ydGVkLicgK1xuICAgICAgICAnXFxuRm9yIG1vcmUgaW5mb3JtYXRpb24sIHNlZSBodHRwczovL2FuZ3VsYXIuaW8vZ3VpZGUvYnJvd3Nlci1zdXBwb3J0JyxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXI8QnJvd3NlckJ1aWxkZXJTY2hlbWE+KGJ1aWxkV2VicGFja0Jyb3dzZXIpO1xuIl19