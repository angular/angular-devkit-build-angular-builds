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
const configs_1 = require("../../tools/webpack/configs");
const async_chunks_1 = require("../../tools/webpack/utils/async-chunks");
const helpers_1 = require("../../tools/webpack/utils/helpers");
const stats_1 = require("../../tools/webpack/utils/stats");
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
const version_1 = require("../../utils/version");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
/**
 * Maximum time in milliseconds for single build/rebuild
 * This accounts for CI variability.
 */
exports.BUILD_TIMEOUT = 30000;
async function initialize(options, context, webpackConfigurationTransform) {
    const originalOutputPath = options.outputPath;
    // Assets are processed directly by the builder except when watching
    const adjustedOptions = options.watch ? options : { ...options, assets: [] };
    const { config, projectRoot, projectSourceRoot, i18n } = await (0, webpack_browser_config_1.generateI18nBrowserWebpackConfigFromContext)(adjustedOptions, context, (wco) => [
        (0, configs_1.getCommonConfig)(wco),
        (0, configs_1.getStylesConfig)(wco),
    ]);
    let transformedConfig;
    if (webpackConfigurationTransform) {
        transformedConfig = await webpackConfigurationTransform(config);
    }
    if (options.deleteOutputPath) {
        (0, utils_1.deleteOutputDir)(context.workspaceRoot, originalOutputPath);
    }
    return { config: transformedConfig || config, projectRoot, projectSourceRoot, i18n };
}
/**
 * @experimental Direct usage of this function is considered experimental.
 */
// eslint-disable-next-line max-lines-per-function
function buildWebpackBrowser(options, context, transforms = {}) {
    const projectName = context.target?.project;
    if (!projectName) {
        throw new Error('The builder requires a target.');
    }
    const baseOutputPath = path.resolve(context.workspaceRoot, options.outputPath);
    let outputPaths;
    // Check Angular version.
    (0, version_1.assertCompatibleAngularVersion)(context.workspaceRoot);
    return (0, rxjs_1.from)(context.getProjectMetadata(projectName)).pipe((0, rxjs_1.switchMap)(async (projectMetadata) => {
        // Purge old build disk cache.
        await (0, purge_cache_1.purgeStaleBuildCache)(context);
        // Initialize builder
        const initialization = await initialize(options, context, transforms.webpackConfiguration);
        // Add index file to watched files.
        if (options.watch) {
            const indexInputFile = path.join(context.workspaceRoot, (0, webpack_browser_config_1.getIndexInputFile)(options.index));
            initialization.config.plugins ??= [];
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
    }), (0, rxjs_1.switchMap)(
    // eslint-disable-next-line max-lines-per-function
    ({ config, projectRoot, projectSourceRoot, i18n, cacheOptions }) => {
        const normalizedOptimization = (0, utils_1.normalizeOptimization)(options.optimization);
        return (0, build_webpack_1.runWebpack)(config, context, {
            webpackFactory: require('webpack'),
            logging: transforms.logging ||
                ((stats, config) => {
                    if (options.verbose) {
                        context.logger.info(stats.toString(config.stats));
                    }
                }),
        }).pipe((0, rxjs_1.concatMap)(
        // eslint-disable-next-line max-lines-per-function
        async (buildEvent) => {
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
                return {
                    webpackStats: webpackRawStats,
                    output: { success: false },
                };
            }
            else {
                outputPaths = (0, output_paths_1.ensureOutputPaths)(baseOutputPath, i18n);
                const scriptsEntryPointName = (0, helpers_1.normalizeExtraEntryPoints)(options.scripts || [], 'scripts').map((x) => x.bundleName);
                if (i18n.shouldInline) {
                    const success = await (0, i18n_inlining_1.i18nInlineEmittedFiles)(context, emittedFiles, i18n, baseOutputPath, Array.from(outputPaths.values()), scriptsEntryPointName, webpackOutputPath, options.i18nMissingTranslation);
                    if (!success) {
                        return {
                            webpackStats: webpackRawStats,
                            output: { success: false },
                        };
                    }
                }
                // Check for budget errors and display them to the user.
                const budgets = options.budgets;
                let budgetFailures;
                if (budgets?.length) {
                    budgetFailures = [...(0, bundle_calculator_1.checkBudgets)(budgets, webpackStats)];
                    for (const { severity, message } of budgetFailures) {
                        switch (severity) {
                            case bundle_calculator_1.ThresholdSeverity.Warning:
                                webpackStats.warnings?.push({ message });
                                break;
                            case bundle_calculator_1.ThresholdSeverity.Error:
                                webpackStats.errors?.push({ message });
                                break;
                            default:
                                assertNever(severity);
                        }
                    }
                }
                const buildSuccess = success && !(0, stats_1.statsHasErrors)(webpackStats);
                if (buildSuccess) {
                    // Copy assets
                    if (!options.watch && options.assets?.length) {
                        spinner.start('Copying assets...');
                        try {
                            await (0, copy_assets_1.copyAssets)((0, utils_1.normalizeAssetPatterns)(options.assets, context.workspaceRoot, projectRoot, projectSourceRoot), Array.from(outputPaths.values()), context.workspaceRoot);
                            spinner.succeed('Copying assets complete.');
                        }
                        catch (err) {
                            spinner.fail(color_1.colors.redBright('Copying of assets failed.'));
                            (0, error_1.assertIsError)(err);
                            return {
                                output: {
                                    success: false,
                                    error: 'Unable to copy assets: ' + err.message,
                                },
                                webpackStats: webpackRawStats,
                            };
                        }
                    }
                    if (options.index) {
                        spinner.start('Generating index html...');
                        const entrypoints = (0, package_chunk_sort_1.generateEntryPoints)({
                            scripts: options.scripts ?? [],
                            styles: options.styles ?? [],
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
                                    baseHref: getLocaleBaseHref(i18n, locale) ?? options.baseHref,
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
                                (0, error_1.assertIsError)(error);
                                return {
                                    webpackStats: webpackRawStats,
                                    output: { success: false, error: error.message },
                                };
                            }
                        }
                        if (hasErrors) {
                            spinner.fail('Index html generation failed.');
                            return {
                                webpackStats: webpackRawStats,
                                output: { success: false },
                            };
                        }
                        else {
                            spinner.succeed('Index html generation complete.');
                        }
                    }
                    if (options.serviceWorker) {
                        spinner.start('Generating service worker...');
                        for (const [locale, outputPath] of outputPaths.entries()) {
                            try {
                                await (0, service_worker_1.augmentAppWithServiceWorker)(projectRoot, context.workspaceRoot, outputPath, getLocaleBaseHref(i18n, locale) ?? options.baseHref ?? '/', options.ngswConfigPath);
                            }
                            catch (error) {
                                spinner.fail('Service worker generation failed.');
                                (0, error_1.assertIsError)(error);
                                return {
                                    webpackStats: webpackRawStats,
                                    output: { success: false, error: error.message },
                                };
                            }
                        }
                        spinner.succeed('Service worker generation complete.');
                    }
                }
                (0, stats_1.webpackStatsLogger)(context.logger, webpackStats, config, budgetFailures);
                return {
                    webpackStats: webpackRawStats,
                    output: { success: buildSuccess },
                };
            }
        }), (0, rxjs_1.map)(({ output: event, webpackStats }) => ({
            ...event,
            stats: (0, stats_1.generateBuildEventStats)(webpackStats, options),
            baseOutputPath,
            outputs: (outputPaths &&
                [...outputPaths.entries()].map(([locale, path]) => ({
                    locale,
                    path,
                    baseHref: getLocaleBaseHref(i18n, locale) ?? options.baseHref,
                }))) || {
                path: baseOutputPath,
                baseHref: options.baseHref,
            },
        })));
    }));
    function getLocaleBaseHref(i18n, locale) {
        if (i18n.locales[locale] && i18n.locales[locale]?.baseHref !== '') {
            return (0, utils_1.urlJoin)(options.baseHref || '', i18n.locales[locale].baseHref ?? `/${locale}/`);
        }
        return undefined;
    }
}
exports.buildWebpackBrowser = buildWebpackBrowser;
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
exports.default = (0, architect_1.createBuilder)(buildWebpackBrowser);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQXlGO0FBQ3pGLGlFQUFpRztBQUNqRyx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLCtCQUFtRTtBQUVuRSx5REFBK0U7QUFDL0UseUVBQW1GO0FBQ25GLCtEQUE4RTtBQUM5RSwyREFReUM7QUFFekMsdUNBS3FCO0FBQ3JCLHFFQUl1QztBQUN2Qyw2Q0FBMkM7QUFDM0MseURBQXFEO0FBQ3JELDZDQUFrRDtBQUNsRCw2REFBbUU7QUFHbkUsc0ZBR3FEO0FBQ3JELGlFQUFvRTtBQUNwRSwyREFBNkQ7QUFDN0QsdUVBQXFFO0FBQ3JFLHlEQUErRDtBQUMvRCwrREFBeUU7QUFDekUsaURBQThDO0FBQzlDLGlEQUFxRTtBQUNyRSwrRUFJNEM7QUFnQjVDOzs7R0FHRztBQUNVLFFBQUEsYUFBYSxHQUFHLEtBQU0sQ0FBQztBQUVwQyxLQUFLLFVBQVUsVUFBVSxDQUN2QixPQUE2QixFQUM3QixPQUF1QixFQUN2Qiw2QkFBMkU7SUFPM0UsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDO0lBRTlDLG9FQUFvRTtJQUNwRSxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxDQUFDO0lBRTdFLE1BQU0sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBRSxHQUNwRCxNQUFNLElBQUEsb0VBQTJDLEVBQUMsZUFBZSxFQUFF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QUFFLElBQUksS0FBSyxFQUFFO1FBQ3RELElBQUksSUFBSSxJQUFJLE9BQU8sRUFBRTtZQUNuQixhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1NBQy9DO0tBQ0Y7SUFFRCxPQUFPLGFBQWEsQ0FBQztBQUN2QixDQUFDO0FBRUQsa0JBQWUsSUFBQSx5QkFBYSxFQUF1QixtQkFBbUIsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBFbWl0dGVkRmlsZXMsIFdlYnBhY2tMb2dnaW5nQ2FsbGJhY2ssIHJ1bldlYnBhY2sgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgY29uY2F0TWFwLCBmcm9tLCBtYXAsIHN3aXRjaE1hcCB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHdlYnBhY2ssIHsgU3RhdHNDb21waWxhdGlvbiB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgZ2V0Q29tbW9uQ29uZmlnLCBnZXRTdHlsZXNDb25maWcgfSBmcm9tICcuLi8uLi90b29scy93ZWJwYWNrL2NvbmZpZ3MnO1xuaW1wb3J0IHsgbWFya0FzeW5jQ2h1bmtzTm9uSW5pdGlhbCB9IGZyb20gJy4uLy4uL3Rvb2xzL3dlYnBhY2svdXRpbHMvYXN5bmMtY2h1bmtzJztcbmltcG9ydCB7IG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMgfSBmcm9tICcuLi8uLi90b29scy93ZWJwYWNrL3V0aWxzL2hlbHBlcnMnO1xuaW1wb3J0IHtcbiAgQnVpbGRFdmVudFN0YXRzLFxuICBnZW5lcmF0ZUJ1aWxkRXZlbnRTdGF0cyxcbiAgc3RhdHNFcnJvcnNUb1N0cmluZyxcbiAgc3RhdHNIYXNFcnJvcnMsXG4gIHN0YXRzSGFzV2FybmluZ3MsXG4gIHN0YXRzV2FybmluZ3NUb1N0cmluZyxcbiAgd2VicGFja1N0YXRzTG9nZ2VyLFxufSBmcm9tICcuLi8uLi90b29scy93ZWJwYWNrL3V0aWxzL3N0YXRzJztcbmltcG9ydCB7IEV4ZWN1dGlvblRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vdHJhbnNmb3Jtcyc7XG5pbXBvcnQge1xuICBkZWxldGVPdXRwdXREaXIsXG4gIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMsXG4gIG5vcm1hbGl6ZU9wdGltaXphdGlvbixcbiAgdXJsSm9pbixcbn0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHtcbiAgQnVkZ2V0Q2FsY3VsYXRvclJlc3VsdCxcbiAgVGhyZXNob2xkU2V2ZXJpdHksXG4gIGNoZWNrQnVkZ2V0cyxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvYnVuZGxlLWNhbGN1bGF0b3InO1xuaW1wb3J0IHsgY29sb3JzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29sb3InO1xuaW1wb3J0IHsgY29weUFzc2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvcHktYXNzZXRzJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyBpMThuSW5saW5lRW1pdHRlZEZpbGVzIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1pbmxpbmluZyc7XG5pbXBvcnQgeyBJMThuT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2kxOG4tb3B0aW9ucyc7XG5pbXBvcnQgeyBGaWxlSW5mbyB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvYXVnbWVudC1pbmRleC1odG1sJztcbmltcG9ydCB7XG4gIEluZGV4SHRtbEdlbmVyYXRvcixcbiAgSW5kZXhIdG1sVHJhbnNmb3JtLFxufSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2luZGV4LWh0bWwtZ2VuZXJhdG9yJztcbmltcG9ydCB7IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL25vcm1hbGl6ZS1jYWNoZSc7XG5pbXBvcnQgeyBlbnN1cmVPdXRwdXRQYXRocyB9IGZyb20gJy4uLy4uL3V0aWxzL291dHB1dC1wYXRocyc7XG5pbXBvcnQgeyBnZW5lcmF0ZUVudHJ5UG9pbnRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGFja2FnZS1jaHVuay1zb3J0JztcbmltcG9ydCB7IHB1cmdlU3RhbGVCdWlsZENhY2hlIH0gZnJvbSAnLi4vLi4vdXRpbHMvcHVyZ2UtY2FjaGUnO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2VydmljZS13b3JrZXInO1xuaW1wb3J0IHsgU3Bpbm5lciB9IGZyb20gJy4uLy4uL3V0aWxzL3NwaW5uZXInO1xuaW1wb3J0IHsgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvdmVyc2lvbic7XG5pbXBvcnQge1xuICBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0LFxuICBnZXRJbmRleElucHV0RmlsZSxcbiAgZ2V0SW5kZXhPdXRwdXRGaWxlLFxufSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlclNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIHR5cGUgaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCB0eXBlIEJyb3dzZXJCdWlsZGVyT3V0cHV0ID0gQnVpbGRlck91dHB1dCAmIHtcbiAgc3RhdHM6IEJ1aWxkRXZlbnRTdGF0cztcbiAgYmFzZU91dHB1dFBhdGg6IHN0cmluZztcbiAgb3V0cHV0czoge1xuICAgIGxvY2FsZT86IHN0cmluZztcbiAgICBwYXRoOiBzdHJpbmc7XG4gICAgYmFzZUhyZWY/OiBzdHJpbmc7XG4gIH1bXTtcbn07XG5cbi8qKlxuICogTWF4aW11bSB0aW1lIGluIG1pbGxpc2Vjb25kcyBmb3Igc2luZ2xlIGJ1aWxkL3JlYnVpbGRcbiAqIFRoaXMgYWNjb3VudHMgZm9yIENJIHZhcmlhYmlsaXR5LlxuICovXG5leHBvcnQgY29uc3QgQlVJTERfVElNRU9VVCA9IDMwXzAwMDtcblxuYXN5bmMgZnVuY3Rpb24gaW5pdGlhbGl6ZShcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybT86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPHdlYnBhY2suQ29uZmlndXJhdGlvbj4sXG4pOiBQcm9taXNlPHtcbiAgY29uZmlnOiB3ZWJwYWNrLkNvbmZpZ3VyYXRpb247XG4gIHByb2plY3RSb290OiBzdHJpbmc7XG4gIHByb2plY3RTb3VyY2VSb290Pzogc3RyaW5nO1xuICBpMThuOiBJMThuT3B0aW9ucztcbn0+IHtcbiAgY29uc3Qgb3JpZ2luYWxPdXRwdXRQYXRoID0gb3B0aW9ucy5vdXRwdXRQYXRoO1xuXG4gIC8vIEFzc2V0cyBhcmUgcHJvY2Vzc2VkIGRpcmVjdGx5IGJ5IHRoZSBidWlsZGVyIGV4Y2VwdCB3aGVuIHdhdGNoaW5nXG4gIGNvbnN0IGFkanVzdGVkT3B0aW9ucyA9IG9wdGlvbnMud2F0Y2ggPyBvcHRpb25zIDogeyAuLi5vcHRpb25zLCBhc3NldHM6IFtdIH07XG5cbiAgY29uc3QgeyBjb25maWcsIHByb2plY3RSb290LCBwcm9qZWN0U291cmNlUm9vdCwgaTE4biB9ID1cbiAgICBhd2FpdCBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KGFkanVzdGVkT3B0aW9ucywgY29udGV4dCwgKHdjbykgPT4gW1xuICAgICAgZ2V0Q29tbW9uQ29uZmlnKHdjbyksXG4gICAgICBnZXRTdHlsZXNDb25maWcod2NvKSxcbiAgICBdKTtcblxuICBsZXQgdHJhbnNmb3JtZWRDb25maWc7XG4gIGlmICh3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybSkge1xuICAgIHRyYW5zZm9ybWVkQ29uZmlnID0gYXdhaXQgd2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm0oY29uZmlnKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLmRlbGV0ZU91dHB1dFBhdGgpIHtcbiAgICBkZWxldGVPdXRwdXREaXIoY29udGV4dC53b3Jrc3BhY2VSb290LCBvcmlnaW5hbE91dHB1dFBhdGgpO1xuICB9XG5cbiAgcmV0dXJuIHsgY29uZmlnOiB0cmFuc2Zvcm1lZENvbmZpZyB8fCBjb25maWcsIHByb2plY3RSb290LCBwcm9qZWN0U291cmNlUm9vdCwgaTE4biB9O1xufVxuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRXZWJwYWNrQnJvd3NlcihcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zOiB7XG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb24/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+O1xuICAgIGxvZ2dpbmc/OiBXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrO1xuICAgIGluZGV4SHRtbD86IEluZGV4SHRtbFRyYW5zZm9ybTtcbiAgfSA9IHt9LFxuKTogT2JzZXJ2YWJsZTxCcm93c2VyQnVpbGRlck91dHB1dD4ge1xuICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0Py5wcm9qZWN0O1xuICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldC4nKTtcbiAgfVxuXG4gIGNvbnN0IGJhc2VPdXRwdXRQYXRoID0gcGF0aC5yZXNvbHZlKGNvbnRleHQud29ya3NwYWNlUm9vdCwgb3B0aW9ucy5vdXRwdXRQYXRoKTtcbiAgbGV0IG91dHB1dFBhdGhzOiB1bmRlZmluZWQgfCBNYXA8c3RyaW5nLCBzdHJpbmc+O1xuXG4gIC8vIENoZWNrIEFuZ3VsYXIgdmVyc2lvbi5cbiAgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uKGNvbnRleHQud29ya3NwYWNlUm9vdCk7XG5cbiAgcmV0dXJuIGZyb20oY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpKS5waXBlKFxuICAgIHN3aXRjaE1hcChhc3luYyAocHJvamVjdE1ldGFkYXRhKSA9PiB7XG4gICAgICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgICAgIGF3YWl0IHB1cmdlU3RhbGVCdWlsZENhY2hlKGNvbnRleHQpO1xuXG4gICAgICAvLyBJbml0aWFsaXplIGJ1aWxkZXJcbiAgICAgIGNvbnN0IGluaXRpYWxpemF0aW9uID0gYXdhaXQgaW5pdGlhbGl6ZShvcHRpb25zLCBjb250ZXh0LCB0cmFuc2Zvcm1zLndlYnBhY2tDb25maWd1cmF0aW9uKTtcblxuICAgICAgLy8gQWRkIGluZGV4IGZpbGUgdG8gd2F0Y2hlZCBmaWxlcy5cbiAgICAgIGlmIChvcHRpb25zLndhdGNoKSB7XG4gICAgICAgIGNvbnN0IGluZGV4SW5wdXRGaWxlID0gcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgZ2V0SW5kZXhJbnB1dEZpbGUob3B0aW9ucy5pbmRleCkpO1xuICAgICAgICBpbml0aWFsaXphdGlvbi5jb25maWcucGx1Z2lucyA/Pz0gW107XG4gICAgICAgIGluaXRpYWxpemF0aW9uLmNvbmZpZy5wbHVnaW5zLnB1c2goe1xuICAgICAgICAgIGFwcGx5OiAoY29tcGlsZXI6IHdlYnBhY2suQ29tcGlsZXIpID0+IHtcbiAgICAgICAgICAgIGNvbXBpbGVyLmhvb2tzLnRoaXNDb21waWxhdGlvbi50YXAoJ2J1aWxkLWFuZ3VsYXInLCAoY29tcGlsYXRpb24pID0+IHtcbiAgICAgICAgICAgICAgY29tcGlsYXRpb24uZmlsZURlcGVuZGVuY2llcy5hZGQoaW5kZXhJbnB1dEZpbGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIC4uLmluaXRpYWxpemF0aW9uLFxuICAgICAgICBjYWNoZU9wdGlvbnM6IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyhwcm9qZWN0TWV0YWRhdGEsIGNvbnRleHQud29ya3NwYWNlUm9vdCksXG4gICAgICB9O1xuICAgIH0pLFxuICAgIHN3aXRjaE1hcChcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG4gICAgICAoeyBjb25maWcsIHByb2plY3RSb290LCBwcm9qZWN0U291cmNlUm9vdCwgaTE4biwgY2FjaGVPcHRpb25zIH0pID0+IHtcbiAgICAgICAgY29uc3Qgbm9ybWFsaXplZE9wdGltaXphdGlvbiA9IG5vcm1hbGl6ZU9wdGltaXphdGlvbihvcHRpb25zLm9wdGltaXphdGlvbik7XG5cbiAgICAgICAgcmV0dXJuIHJ1bldlYnBhY2soY29uZmlnLCBjb250ZXh0LCB7XG4gICAgICAgICAgd2VicGFja0ZhY3Rvcnk6IHJlcXVpcmUoJ3dlYnBhY2snKSBhcyB0eXBlb2Ygd2VicGFjayxcbiAgICAgICAgICBsb2dnaW5nOlxuICAgICAgICAgICAgdHJhbnNmb3Jtcy5sb2dnaW5nIHx8XG4gICAgICAgICAgICAoKHN0YXRzLCBjb25maWcpID0+IHtcbiAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudmVyYm9zZSkge1xuICAgICAgICAgICAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oc3RhdHMudG9TdHJpbmcoY29uZmlnLnN0YXRzKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLFxuICAgICAgICB9KS5waXBlKFxuICAgICAgICAgIGNvbmNhdE1hcChcbiAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG4gICAgICAgICAgICBhc3luYyAoXG4gICAgICAgICAgICAgIGJ1aWxkRXZlbnQsXG4gICAgICAgICAgICApOiBQcm9taXNlPHsgb3V0cHV0OiBCdWlsZGVyT3V0cHV0OyB3ZWJwYWNrU3RhdHM6IFN0YXRzQ29tcGlsYXRpb24gfT4gPT4ge1xuICAgICAgICAgICAgICBjb25zdCBzcGlubmVyID0gbmV3IFNwaW5uZXIoKTtcbiAgICAgICAgICAgICAgc3Bpbm5lci5lbmFibGVkID0gb3B0aW9ucy5wcm9ncmVzcyAhPT0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgY29uc3QgeyBzdWNjZXNzLCBlbWl0dGVkRmlsZXMgPSBbXSwgb3V0cHV0UGF0aDogd2VicGFja091dHB1dFBhdGggfSA9IGJ1aWxkRXZlbnQ7XG4gICAgICAgICAgICAgIGNvbnN0IHdlYnBhY2tSYXdTdGF0cyA9IGJ1aWxkRXZlbnQud2VicGFja1N0YXRzO1xuICAgICAgICAgICAgICBpZiAoIXdlYnBhY2tSYXdTdGF0cykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignV2VicGFjayBzdGF0cyBidWlsZCByZXN1bHQgaXMgcmVxdWlyZWQuJyk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBGaXggaW5jb3JyZWN0bHkgc2V0IGBpbml0aWFsYCB2YWx1ZSBvbiBjaHVua3MuXG4gICAgICAgICAgICAgIGNvbnN0IGV4dHJhRW50cnlQb2ludHMgPSBbXG4gICAgICAgICAgICAgICAgLi4ubm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhvcHRpb25zLnN0eWxlcyB8fCBbXSwgJ3N0eWxlcycpLFxuICAgICAgICAgICAgICAgIC4uLm5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMob3B0aW9ucy5zY3JpcHRzIHx8IFtdLCAnc2NyaXB0cycpLFxuICAgICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICAgIGNvbnN0IHdlYnBhY2tTdGF0cyA9IHtcbiAgICAgICAgICAgICAgICAuLi53ZWJwYWNrUmF3U3RhdHMsXG4gICAgICAgICAgICAgICAgY2h1bmtzOiBtYXJrQXN5bmNDaHVua3NOb25Jbml0aWFsKHdlYnBhY2tSYXdTdGF0cywgZXh0cmFFbnRyeVBvaW50cyksXG4gICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdXNpbmcgYnVuZGxlIGRvd25sZXZlbGluZyB0aGVuIHRoZXJlIGlzIG9ubHkgb25lIGJ1aWxkXG4gICAgICAgICAgICAgICAgLy8gSWYgaXQgZmFpbHMgc2hvdyBhbnkgZGlhZ25vc3RpYyBtZXNzYWdlcyBhbmQgYmFpbFxuICAgICAgICAgICAgICAgIGlmIChzdGF0c0hhc1dhcm5pbmdzKHdlYnBhY2tTdGF0cykpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4oc3RhdHNXYXJuaW5nc1RvU3RyaW5nKHdlYnBhY2tTdGF0cywgeyBjb2xvcnM6IHRydWUgfSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc3RhdHNIYXNFcnJvcnMod2VicGFja1N0YXRzKSkge1xuICAgICAgICAgICAgICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3Ioc3RhdHNFcnJvcnNUb1N0cmluZyh3ZWJwYWNrU3RhdHMsIHsgY29sb3JzOiB0cnVlIH0pKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgd2VicGFja1N0YXRzOiB3ZWJwYWNrUmF3U3RhdHMsXG4gICAgICAgICAgICAgICAgICBvdXRwdXQ6IHsgc3VjY2VzczogZmFsc2UgfSxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG91dHB1dFBhdGhzID0gZW5zdXJlT3V0cHV0UGF0aHMoYmFzZU91dHB1dFBhdGgsIGkxOG4pO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgc2NyaXB0c0VudHJ5UG9pbnROYW1lID0gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhcbiAgICAgICAgICAgICAgICAgIG9wdGlvbnMuc2NyaXB0cyB8fCBbXSxcbiAgICAgICAgICAgICAgICAgICdzY3JpcHRzJyxcbiAgICAgICAgICAgICAgICApLm1hcCgoeCkgPT4geC5idW5kbGVOYW1lKTtcblxuICAgICAgICAgICAgICAgIGlmIChpMThuLnNob3VsZElubGluZSkge1xuICAgICAgICAgICAgICAgICAgY29uc3Qgc3VjY2VzcyA9IGF3YWl0IGkxOG5JbmxpbmVFbWl0dGVkRmlsZXMoXG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgIGVtaXR0ZWRGaWxlcyxcbiAgICAgICAgICAgICAgICAgICAgaTE4bixcbiAgICAgICAgICAgICAgICAgICAgYmFzZU91dHB1dFBhdGgsXG4gICAgICAgICAgICAgICAgICAgIEFycmF5LmZyb20ob3V0cHV0UGF0aHMudmFsdWVzKCkpLFxuICAgICAgICAgICAgICAgICAgICBzY3JpcHRzRW50cnlQb2ludE5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHdlYnBhY2tPdXRwdXRQYXRoLFxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmkxOG5NaXNzaW5nVHJhbnNsYXRpb24sXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgd2VicGFja1N0YXRzOiB3ZWJwYWNrUmF3U3RhdHMsXG4gICAgICAgICAgICAgICAgICAgICAgb3V0cHV0OiB7IHN1Y2Nlc3M6IGZhbHNlIH0sXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIGJ1ZGdldCBlcnJvcnMgYW5kIGRpc3BsYXkgdGhlbSB0byB0aGUgdXNlci5cbiAgICAgICAgICAgICAgICBjb25zdCBidWRnZXRzID0gb3B0aW9ucy5idWRnZXRzO1xuICAgICAgICAgICAgICAgIGxldCBidWRnZXRGYWlsdXJlczogQnVkZ2V0Q2FsY3VsYXRvclJlc3VsdFtdIHwgdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIGlmIChidWRnZXRzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgIGJ1ZGdldEZhaWx1cmVzID0gWy4uLmNoZWNrQnVkZ2V0cyhidWRnZXRzLCB3ZWJwYWNrU3RhdHMpXTtcbiAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgeyBzZXZlcml0eSwgbWVzc2FnZSB9IG9mIGJ1ZGdldEZhaWx1cmVzKSB7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoc2V2ZXJpdHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlIFRocmVzaG9sZFNldmVyaXR5Lldhcm5pbmc6XG4gICAgICAgICAgICAgICAgICAgICAgICB3ZWJwYWNrU3RhdHMud2FybmluZ3M/LnB1c2goeyBtZXNzYWdlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgY2FzZSBUaHJlc2hvbGRTZXZlcml0eS5FcnJvcjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHdlYnBhY2tTdGF0cy5lcnJvcnM/LnB1c2goeyBtZXNzYWdlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2VydE5ldmVyKHNldmVyaXR5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGJ1aWxkU3VjY2VzcyA9IHN1Y2Nlc3MgJiYgIXN0YXRzSGFzRXJyb3JzKHdlYnBhY2tTdGF0cyk7XG4gICAgICAgICAgICAgICAgaWYgKGJ1aWxkU3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgLy8gQ29weSBhc3NldHNcbiAgICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy53YXRjaCAmJiBvcHRpb25zLmFzc2V0cz8ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3RhcnQoJ0NvcHlpbmcgYXNzZXRzLi4uJyk7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgYXdhaXQgY29weUFzc2V0cyhcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuYXNzZXRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHByb2plY3RSb290LFxuICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9qZWN0U291cmNlUm9vdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAgICAgICBBcnJheS5mcm9tKG91dHB1dFBhdGhzLnZhbHVlcygpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3VjY2VlZCgnQ29weWluZyBhc3NldHMgY29tcGxldGUuJyk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuZmFpbChjb2xvcnMucmVkQnJpZ2h0KCdDb3B5aW5nIG9mIGFzc2V0cyBmYWlsZWQuJykpO1xuICAgICAgICAgICAgICAgICAgICAgIGFzc2VydElzRXJyb3IoZXJyKTtcblxuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiAnVW5hYmxlIHRvIGNvcHkgYXNzZXRzOiAnICsgZXJyLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgd2VicGFja1N0YXRzOiB3ZWJwYWNrUmF3U3RhdHMsXG4gICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5pbmRleCkge1xuICAgICAgICAgICAgICAgICAgICBzcGlubmVyLnN0YXJ0KCdHZW5lcmF0aW5nIGluZGV4IGh0bWwuLi4nKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbnRyeXBvaW50cyA9IGdlbmVyYXRlRW50cnlQb2ludHMoe1xuICAgICAgICAgICAgICAgICAgICAgIHNjcmlwdHM6IG9wdGlvbnMuc2NyaXB0cyA/PyBbXSxcbiAgICAgICAgICAgICAgICAgICAgICBzdHlsZXM6IG9wdGlvbnMuc3R5bGVzID8/IFtdLFxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleEh0bWxHZW5lcmF0b3IgPSBuZXcgSW5kZXhIdG1sR2VuZXJhdG9yKHtcbiAgICAgICAgICAgICAgICAgICAgICBjYWNoZTogY2FjaGVPcHRpb25zLFxuICAgICAgICAgICAgICAgICAgICAgIGluZGV4UGF0aDogcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgZ2V0SW5kZXhJbnB1dEZpbGUob3B0aW9ucy5pbmRleCkpLFxuICAgICAgICAgICAgICAgICAgICAgIGVudHJ5cG9pbnRzLFxuICAgICAgICAgICAgICAgICAgICAgIGRlcGxveVVybDogb3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgICAgICAgICAgICAgICAgICAgc3JpOiBvcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgICAgICAgICAgICAgICAgICAgIG9wdGltaXphdGlvbjogbm9ybWFsaXplZE9wdGltaXphdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICBjcm9zc09yaWdpbjogb3B0aW9ucy5jcm9zc09yaWdpbixcbiAgICAgICAgICAgICAgICAgICAgICBwb3N0VHJhbnNmb3JtOiB0cmFuc2Zvcm1zLmluZGV4SHRtbCxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgbGV0IGhhc0Vycm9ycyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtsb2NhbGUsIG91dHB1dFBhdGhdIG9mIG91dHB1dFBhdGhzLmVudHJpZXMoKSkge1xuICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IGluZGV4SHRtbEdlbmVyYXRvci5wcm9jZXNzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYmFzZUhyZWY6IGdldExvY2FsZUJhc2VIcmVmKGkxOG4sIGxvY2FsZSkgPz8gb3B0aW9ucy5iYXNlSHJlZixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaTE4bkxvY2FsZSBpcyB1c2VkIHdoZW4gSXZ5IGlzIGRpc2FibGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxhbmc6IGxvY2FsZSB8fCB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzOiBtYXBFbWl0dGVkRmlsZXNUb0ZpbGVJbmZvKGVtaXR0ZWRGaWxlcyksXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHdhcm5pbmdzLmxlbmd0aCB8fCBlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3RvcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB3YXJuaW5ncy5mb3JFYWNoKChtKSA9PiBjb250ZXh0LmxvZ2dlci53YXJuKG0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JzLmZvckVhY2goKG0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoYXNFcnJvcnMgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdGFydCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleE91dHB1dCA9IHBhdGguam9pbihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZ2V0SW5kZXhPdXRwdXRGaWxlKG9wdGlvbnMuaW5kZXgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHBhdGguZGlybmFtZShpbmRleE91dHB1dCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZnMucHJvbWlzZXMud3JpdGVGaWxlKGluZGV4T3V0cHV0LCBjb250ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5mYWlsKCdJbmRleCBodG1sIGdlbmVyYXRpb24gZmFpbGVkLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0SXNFcnJvcihlcnJvcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHdlYnBhY2tTdGF0czogd2VicGFja1Jhd1N0YXRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXQ6IHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChoYXNFcnJvcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzcGlubmVyLmZhaWwoJ0luZGV4IGh0bWwgZ2VuZXJhdGlvbiBmYWlsZWQuJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgd2VicGFja1N0YXRzOiB3ZWJwYWNrUmF3U3RhdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXQ6IHsgc3VjY2VzczogZmFsc2UgfSxcbiAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3VjY2VlZCgnSW5kZXggaHRtbCBnZW5lcmF0aW9uIGNvbXBsZXRlLicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnNlcnZpY2VXb3JrZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgc3Bpbm5lci5zdGFydCgnR2VuZXJhdGluZyBzZXJ2aWNlIHdvcmtlci4uLicpO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtsb2NhbGUsIG91dHB1dFBhdGhdIG9mIG91dHB1dFBhdGhzLmVudHJpZXMoKSkge1xuICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHByb2plY3RSb290LFxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGdldExvY2FsZUJhc2VIcmVmKGkxOG4sIGxvY2FsZSkgPz8gb3B0aW9ucy5iYXNlSHJlZiA/PyAnLycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMubmdzd0NvbmZpZ1BhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcGlubmVyLmZhaWwoJ1NlcnZpY2Ugd29ya2VyIGdlbmVyYXRpb24gZmFpbGVkLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0SXNFcnJvcihlcnJvcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHdlYnBhY2tTdGF0czogd2VicGFja1Jhd1N0YXRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXQ6IHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHNwaW5uZXIuc3VjY2VlZCgnU2VydmljZSB3b3JrZXIgZ2VuZXJhdGlvbiBjb21wbGV0ZS4nKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB3ZWJwYWNrU3RhdHNMb2dnZXIoY29udGV4dC5sb2dnZXIsIHdlYnBhY2tTdGF0cywgY29uZmlnLCBidWRnZXRGYWlsdXJlcyk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgd2VicGFja1N0YXRzOiB3ZWJwYWNrUmF3U3RhdHMsXG4gICAgICAgICAgICAgICAgICBvdXRwdXQ6IHsgc3VjY2VzczogYnVpbGRTdWNjZXNzIH0sXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICApLFxuICAgICAgICAgIG1hcChcbiAgICAgICAgICAgICh7IG91dHB1dDogZXZlbnQsIHdlYnBhY2tTdGF0cyB9KSA9PlxuICAgICAgICAgICAgICAoe1xuICAgICAgICAgICAgICAgIC4uLmV2ZW50LFxuICAgICAgICAgICAgICAgIHN0YXRzOiBnZW5lcmF0ZUJ1aWxkRXZlbnRTdGF0cyh3ZWJwYWNrU3RhdHMsIG9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICAgICAgICAgIG91dHB1dHM6IChvdXRwdXRQYXRocyAmJlxuICAgICAgICAgICAgICAgICAgWy4uLm91dHB1dFBhdGhzLmVudHJpZXMoKV0ubWFwKChbbG9jYWxlLCBwYXRoXSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxlLFxuICAgICAgICAgICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgICAgICAgICBiYXNlSHJlZjogZ2V0TG9jYWxlQmFzZUhyZWYoaTE4biwgbG9jYWxlKSA/PyBvcHRpb25zLmJhc2VIcmVmLFxuICAgICAgICAgICAgICAgICAgfSkpKSB8fCB7XG4gICAgICAgICAgICAgICAgICBwYXRoOiBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgICAgIGJhc2VIcmVmOiBvcHRpb25zLmJhc2VIcmVmLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0gYXMgQnJvd3NlckJ1aWxkZXJPdXRwdXQpLFxuICAgICAgICAgICksXG4gICAgICAgICk7XG4gICAgICB9LFxuICAgICksXG4gICk7XG5cbiAgZnVuY3Rpb24gZ2V0TG9jYWxlQmFzZUhyZWYoaTE4bjogSTE4bk9wdGlvbnMsIGxvY2FsZTogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoaTE4bi5sb2NhbGVzW2xvY2FsZV0gJiYgaTE4bi5sb2NhbGVzW2xvY2FsZV0/LmJhc2VIcmVmICE9PSAnJykge1xuICAgICAgcmV0dXJuIHVybEpvaW4ob3B0aW9ucy5iYXNlSHJlZiB8fCAnJywgaTE4bi5sb2NhbGVzW2xvY2FsZV0uYmFzZUhyZWYgPz8gYC8ke2xvY2FsZX0vYCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG5mdW5jdGlvbiBhc3NlcnROZXZlcihpbnB1dDogbmV2ZXIpOiBuZXZlciB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICBgVW5leHBlY3RlZCBjYWxsIHRvIGFzc2VydE5ldmVyKCkgd2l0aCBpbnB1dDogJHtKU09OLnN0cmluZ2lmeShcbiAgICAgIGlucHV0LFxuICAgICAgbnVsbCAvKiByZXBsYWNlciAqLyxcbiAgICAgIDQgLyogdGFiU2l6ZSAqLyxcbiAgICApfWAsXG4gICk7XG59XG5cbmZ1bmN0aW9uIG1hcEVtaXR0ZWRGaWxlc1RvRmlsZUluZm8oZmlsZXM6IEVtaXR0ZWRGaWxlc1tdID0gW10pOiBGaWxlSW5mb1tdIHtcbiAgY29uc3QgZmlsdGVyZWRGaWxlczogRmlsZUluZm9bXSA9IFtdO1xuICBmb3IgKGNvbnN0IHsgZmlsZSwgbmFtZSwgZXh0ZW5zaW9uLCBpbml0aWFsIH0gb2YgZmlsZXMpIHtcbiAgICBpZiAobmFtZSAmJiBpbml0aWFsKSB7XG4gICAgICBmaWx0ZXJlZEZpbGVzLnB1c2goeyBmaWxlLCBleHRlbnNpb24sIG5hbWUgfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZpbHRlcmVkRmlsZXM7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXI8QnJvd3NlckJ1aWxkZXJTY2hlbWE+KGJ1aWxkV2VicGFja0Jyb3dzZXIpO1xuIl19