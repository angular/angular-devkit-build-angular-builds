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
exports.execute = void 0;
const architect_1 = require("@angular-devkit/architect");
const build_webpack_1 = require("@angular-devkit/build-webpack");
const path = __importStar(require("path"));
const rxjs_1 = require("rxjs");
const utils_1 = require("../../utils");
const color_1 = require("../../utils/color");
const copy_assets_1 = require("../../utils/copy-assets");
const error_1 = require("../../utils/error");
const i18n_inlining_1 = require("../../utils/i18n-inlining");
const output_paths_1 = require("../../utils/output-paths");
const purge_cache_1 = require("../../utils/purge-cache");
const spinner_1 = require("../../utils/spinner");
const version_1 = require("../../utils/version");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const configs_1 = require("../../webpack/configs");
const helpers_1 = require("../../webpack/utils/helpers");
const stats_1 = require("../../webpack/utils/stats");
/**
 * @experimental Direct usage of this function is considered experimental.
 */
function execute(options, context, transforms = {}) {
    const root = context.workspaceRoot;
    // Check Angular version.
    (0, version_1.assertCompatibleAngularVersion)(root);
    const baseOutputPath = path.resolve(root, options.outputPath);
    let outputPaths;
    return (0, rxjs_1.from)(initialize(options, context, transforms.webpackConfiguration)).pipe((0, rxjs_1.concatMap)(({ config, i18n, projectRoot, projectSourceRoot }) => {
        return (0, build_webpack_1.runWebpack)(config, context, {
            webpackFactory: require('webpack'),
            logging: (stats, config) => {
                if (options.verbose) {
                    context.logger.info(stats.toString(config.stats));
                }
            },
        }).pipe((0, rxjs_1.concatMap)(async (output) => {
            const { emittedFiles = [], outputPath, webpackStats, success } = output;
            if (!webpackStats) {
                throw new Error('Webpack stats build result is required.');
            }
            if (!success) {
                if ((0, stats_1.statsHasWarnings)(webpackStats)) {
                    context.logger.warn((0, stats_1.statsWarningsToString)(webpackStats, { colors: true }));
                }
                if ((0, stats_1.statsHasErrors)(webpackStats)) {
                    context.logger.error((0, stats_1.statsErrorsToString)(webpackStats, { colors: true }));
                }
                return output;
            }
            const spinner = new spinner_1.Spinner();
            spinner.enabled = options.progress !== false;
            outputPaths = (0, output_paths_1.ensureOutputPaths)(baseOutputPath, i18n);
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
                        ...output,
                        success: false,
                        error: 'Unable to copy assets: ' + err.message,
                    };
                }
            }
            if (i18n.shouldInline) {
                const success = await (0, i18n_inlining_1.i18nInlineEmittedFiles)(context, emittedFiles, i18n, baseOutputPath, Array.from(outputPaths.values()), [], outputPath, options.i18nMissingTranslation);
                if (!success) {
                    return {
                        ...output,
                        success: false,
                    };
                }
            }
            (0, stats_1.webpackStatsLogger)(context.logger, webpackStats, config);
            return output;
        }));
    }), (0, rxjs_1.concatMap)(async (output) => {
        if (!output.success) {
            return output;
        }
        return {
            ...output,
            baseOutputPath,
            outputs: (outputPaths &&
                [...outputPaths.entries()].map(([locale, path]) => ({
                    locale,
                    path,
                }))) || {
                path: baseOutputPath,
            },
        };
    }));
}
exports.execute = execute;
exports.default = (0, architect_1.createBuilder)(execute);
async function initialize(options, context, webpackConfigurationTransform) {
    // Purge old build disk cache.
    await (0, purge_cache_1.purgeStaleBuildCache)(context);
    const browserslist = (await Promise.resolve().then(() => __importStar(require('browserslist')))).default;
    const originalOutputPath = options.outputPath;
    // Assets are processed directly by the builder except when watching
    const adjustedOptions = options.watch ? options : { ...options, assets: [] };
    const { config, projectRoot, projectSourceRoot, i18n } = await (0, webpack_browser_config_1.generateI18nBrowserWebpackConfigFromContext)({
        ...adjustedOptions,
        buildOptimizer: false,
        aot: true,
        platform: 'server',
    }, context, (wco) => {
        var _a;
        // We use the platform to determine the JavaScript syntax output.
        (_a = wco.buildOptions).supportedBrowsers ?? (_a.supportedBrowsers = []);
        wco.buildOptions.supportedBrowsers.push(...browserslist('maintained node versions'));
        return [getPlatformServerExportsConfig(wco), (0, configs_1.getCommonConfig)(wco), (0, configs_1.getStylesConfig)(wco)];
    });
    if (options.deleteOutputPath) {
        (0, utils_1.deleteOutputDir)(context.workspaceRoot, originalOutputPath);
    }
    const transformedConfig = (await webpackConfigurationTransform?.(config)) ?? config;
    return { config: transformedConfig, i18n, projectRoot, projectSourceRoot };
}
/**
 * Add `@angular/platform-server` exports.
 * This is needed so that DI tokens can be referenced and set at runtime outside of the bundle.
 */
function getPlatformServerExportsConfig(wco) {
    // Add `@angular/platform-server` exports.
    // This is needed so that DI tokens can be referenced and set at runtime outside of the bundle.
    // Only add `@angular/platform-server` exports when it is installed.
    // In some cases this builder is used when `@angular/platform-server` is not installed.
    // Example: when using `@nguniversal/common/clover` which does not need `@angular/platform-server`.
    return (0, helpers_1.isPlatformServerInstalled)(wco.root)
        ? {
            module: {
                rules: [
                    {
                        loader: require.resolve('./platform-server-exports-loader'),
                        include: [path.resolve(wco.root, wco.buildOptions.main)],
                    },
                ],
            },
        }
        : {};
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsaUVBQTJEO0FBQzNELDJDQUE2QjtBQUM3QiwrQkFBbUQ7QUFHbkQsdUNBSXFCO0FBQ3JCLDZDQUEyQztBQUMzQyx5REFBcUQ7QUFDckQsNkNBQWtEO0FBQ2xELDZEQUFtRTtBQUVuRSwyREFBNkQ7QUFDN0QseURBQStEO0FBQy9ELGlEQUE4QztBQUM5QyxpREFBcUU7QUFDckUsK0VBRzRDO0FBQzVDLG1EQUF5RTtBQUN6RSx5REFBd0U7QUFDeEUscURBTW1DO0FBaUJuQzs7R0FFRztBQUNILFNBQWdCLE9BQU8sQ0FDckIsT0FBNkIsRUFDN0IsT0FBdUIsRUFDdkIsYUFFSSxFQUFFO0lBRU4sTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUVuQyx5QkFBeUI7SUFDekIsSUFBQSx3Q0FBOEIsRUFBQyxJQUFJLENBQUMsQ0FBQztJQUVyQyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDOUQsSUFBSSxXQUE0QyxDQUFDO0lBRWpELE9BQU8sSUFBQSxXQUFJLEVBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsVUFBVSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQzdFLElBQUEsZ0JBQVMsRUFBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsaUJBQWlCLEVBQUUsRUFBRSxFQUFFO1FBQzdELE9BQU8sSUFBQSwwQkFBVSxFQUFD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Ozs7R0FHRztBQUNILFNBQVMsOEJBQThCLENBQUMsR0FBZ0M7SUFDdEUsMENBQTBDO0lBQzFDLCtGQUErRjtJQUUvRixvRUFBb0U7SUFDcEUsdUZBQXVGO0lBQ3ZGLG1HQUFtRztJQUVuRyxPQUFPLElBQUEsbUNBQXlCLEVBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztRQUN4QyxDQUFDLENBQUM7WUFDRSxNQUFNLEVBQUU7Z0JBQ04sS0FBSyxFQUFFO29CQUNMO3dCQUNFLE1BQU0sRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLGtDQUFrQyxDQUFDO3dCQUMzRCxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztxQkFDekQ7aUJBQ0Y7YUFDRjtTQUNGO1FBQ0gsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUNULENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IHJ1bldlYnBhY2sgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgY29uY2F0TWFwLCBmcm9tIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgd2VicGFjaywgeyBDb25maWd1cmF0aW9uIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBFeGVjdXRpb25UcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHtcbiAgTm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICBkZWxldGVPdXRwdXREaXIsXG4gIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMsXG59IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IGNvbG9ycyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvbG9yJztcbmltcG9ydCB7IGNvcHlBc3NldHMgfSBmcm9tICcuLi8uLi91dGlscy9jb3B5LWFzc2V0cyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgaTE4bklubGluZUVtaXR0ZWRGaWxlcyB9IGZyb20gJy4uLy4uL3V0aWxzL2kxOG4taW5saW5pbmcnO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgZW5zdXJlT3V0cHV0UGF0aHMgfSBmcm9tICcuLi8uLi91dGlscy9vdXRwdXQtcGF0aHMnO1xuaW1wb3J0IHsgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUgfSBmcm9tICcuLi8uLi91dGlscy9wdXJnZS1jYWNoZSc7XG5pbXBvcnQgeyBTcGlubmVyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lcic7XG5pbXBvcnQgeyBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24gfSBmcm9tICcuLi8uLi91dGlscy92ZXJzaW9uJztcbmltcG9ydCB7XG4gIEJyb3dzZXJXZWJwYWNrQ29uZmlnT3B0aW9ucyxcbiAgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dCxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBnZXRDb21tb25Db25maWcsIGdldFN0eWxlc0NvbmZpZyB9IGZyb20gJy4uLy4uL3dlYnBhY2svY29uZmlncyc7XG5pbXBvcnQgeyBpc1BsYXRmb3JtU2VydmVySW5zdGFsbGVkIH0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9oZWxwZXJzJztcbmltcG9ydCB7XG4gIHN0YXRzRXJyb3JzVG9TdHJpbmcsXG4gIHN0YXRzSGFzRXJyb3JzLFxuICBzdGF0c0hhc1dhcm5pbmdzLFxuICBzdGF0c1dhcm5pbmdzVG9TdHJpbmcsXG4gIHdlYnBhY2tTdGF0c0xvZ2dlcixcbn0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgU2VydmVyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyB0eXBlIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgdHlwZSBTZXJ2ZXJCdWlsZGVyT3V0cHV0ID0gQnVpbGRlck91dHB1dCAmIHtcbiAgYmFzZU91dHB1dFBhdGg6IHN0cmluZztcbiAgb3V0cHV0UGF0aDogc3RyaW5nO1xuICBvdXRwdXRzOiB7XG4gICAgbG9jYWxlPzogc3RyaW5nO1xuICAgIHBhdGg6IHN0cmluZztcbiAgfVtdO1xufTtcblxuZXhwb3J0IHsgU2VydmVyQnVpbGRlck9wdGlvbnMgfTtcblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZXhlY3V0ZShcbiAgb3B0aW9uczogU2VydmVyQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zOiB7XG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb24/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+O1xuICB9ID0ge30sXG4pOiBPYnNlcnZhYmxlPFNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3Qgcm9vdCA9IGNvbnRleHQud29ya3NwYWNlUm9vdDtcblxuICAvLyBDaGVjayBBbmd1bGFyIHZlcnNpb24uXG4gIGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbihyb290KTtcblxuICBjb25zdCBiYXNlT3V0cHV0UGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBvcHRpb25zLm91dHB1dFBhdGgpO1xuICBsZXQgb3V0cHV0UGF0aHM6IHVuZGVmaW5lZCB8IE1hcDxzdHJpbmcsIHN0cmluZz47XG5cbiAgcmV0dXJuIGZyb20oaW5pdGlhbGl6ZShvcHRpb25zLCBjb250ZXh0LCB0cmFuc2Zvcm1zLndlYnBhY2tDb25maWd1cmF0aW9uKSkucGlwZShcbiAgICBjb25jYXRNYXAoKHsgY29uZmlnLCBpMThuLCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QgfSkgPT4ge1xuICAgICAgcmV0dXJuIHJ1bldlYnBhY2soY29uZmlnLCBjb250ZXh0LCB7XG4gICAgICAgIHdlYnBhY2tGYWN0b3J5OiByZXF1aXJlKCd3ZWJwYWNrJykgYXMgdHlwZW9mIHdlYnBhY2ssXG4gICAgICAgIGxvZ2dpbmc6IChzdGF0cywgY29uZmlnKSA9PiB7XG4gICAgICAgICAgaWYgKG9wdGlvbnMudmVyYm9zZSkge1xuICAgICAgICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhzdGF0cy50b1N0cmluZyhjb25maWcuc3RhdHMpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9KS5waXBlKFxuICAgICAgICBjb25jYXRNYXAoYXN5bmMgKG91dHB1dCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHsgZW1pdHRlZEZpbGVzID0gW10sIG91dHB1dFBhdGgsIHdlYnBhY2tTdGF0cywgc3VjY2VzcyB9ID0gb3V0cHV0O1xuICAgICAgICAgIGlmICghd2VicGFja1N0YXRzKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYnBhY2sgc3RhdHMgYnVpbGQgcmVzdWx0IGlzIHJlcXVpcmVkLicpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghc3VjY2Vzcykge1xuICAgICAgICAgICAgaWYgKHN0YXRzSGFzV2FybmluZ3Mod2VicGFja1N0YXRzKSkge1xuICAgICAgICAgICAgICBjb250ZXh0LmxvZ2dlci53YXJuKHN0YXRzV2FybmluZ3NUb1N0cmluZyh3ZWJwYWNrU3RhdHMsIHsgY29sb3JzOiB0cnVlIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdGF0c0hhc0Vycm9ycyh3ZWJwYWNrU3RhdHMpKSB7XG4gICAgICAgICAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKHN0YXRzRXJyb3JzVG9TdHJpbmcod2VicGFja1N0YXRzLCB7IGNvbG9yczogdHJ1ZSB9KSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKCk7XG4gICAgICAgICAgc3Bpbm5lci5lbmFibGVkID0gb3B0aW9ucy5wcm9ncmVzcyAhPT0gZmFsc2U7XG4gICAgICAgICAgb3V0cHV0UGF0aHMgPSBlbnN1cmVPdXRwdXRQYXRocyhiYXNlT3V0cHV0UGF0aCwgaTE4bik7XG5cbiAgICAgICAgICAvLyBDb3B5IGFzc2V0c1xuICAgICAgICAgIGlmICghb3B0aW9ucy53YXRjaCAmJiBvcHRpb25zLmFzc2V0cz8ubGVuZ3RoKSB7XG4gICAgICAgICAgICBzcGlubmVyLnN0YXJ0KCdDb3B5aW5nIGFzc2V0cy4uLicpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgYXdhaXQgY29weUFzc2V0cyhcbiAgICAgICAgICAgICAgICBub3JtYWxpemVBc3NldFBhdHRlcm5zKFxuICAgICAgICAgICAgICAgICAgb3B0aW9ucy5hc3NldHMsXG4gICAgICAgICAgICAgICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICAgICAgICBwcm9qZWN0Um9vdCxcbiAgICAgICAgICAgICAgICAgIHByb2plY3RTb3VyY2VSb290LFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgQXJyYXkuZnJvbShvdXRwdXRQYXRocy52YWx1ZXMoKSksXG4gICAgICAgICAgICAgICAgY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBzcGlubmVyLnN1Y2NlZWQoJ0NvcHlpbmcgYXNzZXRzIGNvbXBsZXRlLicpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgIHNwaW5uZXIuZmFpbChjb2xvcnMucmVkQnJpZ2h0KCdDb3B5aW5nIG9mIGFzc2V0cyBmYWlsZWQuJykpO1xuICAgICAgICAgICAgICBhc3NlcnRJc0Vycm9yKGVycik7XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAuLi5vdXRwdXQsXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdVbmFibGUgdG8gY29weSBhc3NldHM6ICcgKyBlcnIubWVzc2FnZSxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaTE4bi5zaG91bGRJbmxpbmUpIHtcbiAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBhd2FpdCBpMThuSW5saW5lRW1pdHRlZEZpbGVzKFxuICAgICAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgICAgICBlbWl0dGVkRmlsZXMsXG4gICAgICAgICAgICAgIGkxOG4sXG4gICAgICAgICAgICAgIGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICAgICAgICBBcnJheS5mcm9tKG91dHB1dFBhdGhzLnZhbHVlcygpKSxcbiAgICAgICAgICAgICAgW10sXG4gICAgICAgICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgICAgICAgIG9wdGlvbnMuaTE4bk1pc3NpbmdUcmFuc2xhdGlvbixcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAuLi5vdXRwdXQsXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgd2VicGFja1N0YXRzTG9nZ2VyKGNvbnRleHQubG9nZ2VyLCB3ZWJwYWNrU3RhdHMsIGNvbmZpZyk7XG5cbiAgICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfSksXG4gICAgY29uY2F0TWFwKGFzeW5jIChvdXRwdXQpID0+IHtcbiAgICAgIGlmICghb3V0cHV0LnN1Y2Nlc3MpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dCBhcyBTZXJ2ZXJCdWlsZGVyT3V0cHV0O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi5vdXRwdXQsXG4gICAgICAgIGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICBvdXRwdXRzOiAob3V0cHV0UGF0aHMgJiZcbiAgICAgICAgICBbLi4ub3V0cHV0UGF0aHMuZW50cmllcygpXS5tYXAoKFtsb2NhbGUsIHBhdGhdKSA9PiAoe1xuICAgICAgICAgICAgbG9jYWxlLFxuICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICB9KSkpIHx8IHtcbiAgICAgICAgICBwYXRoOiBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgfSxcbiAgICAgIH0gYXMgU2VydmVyQnVpbGRlck91dHB1dDtcbiAgICB9KSxcbiAgKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcjxTZXJ2ZXJCdWlsZGVyT3B0aW9ucywgU2VydmVyQnVpbGRlck91dHB1dD4oZXhlY3V0ZSk7XG5cbmFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemUoXG4gIG9wdGlvbnM6IFNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgd2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm0/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+LFxuKTogUHJvbWlzZTx7XG4gIGNvbmZpZzogd2VicGFjay5Db25maWd1cmF0aW9uO1xuICBpMThuOiBJMThuT3B0aW9ucztcbiAgcHJvamVjdFJvb3Q6IHN0cmluZztcbiAgcHJvamVjdFNvdXJjZVJvb3Q/OiBzdHJpbmc7XG59PiB7XG4gIC8vIFB1cmdlIG9sZCBidWlsZCBkaXNrIGNhY2hlLlxuICBhd2FpdCBwdXJnZVN0YWxlQnVpbGRDYWNoZShjb250ZXh0KTtcblxuICBjb25zdCBicm93c2Vyc2xpc3QgPSAoYXdhaXQgaW1wb3J0KCdicm93c2Vyc2xpc3QnKSkuZGVmYXVsdDtcbiAgY29uc3Qgb3JpZ2luYWxPdXRwdXRQYXRoID0gb3B0aW9ucy5vdXRwdXRQYXRoO1xuICAvLyBBc3NldHMgYXJlIHByb2Nlc3NlZCBkaXJlY3RseSBieSB0aGUgYnVpbGRlciBleGNlcHQgd2hlbiB3YXRjaGluZ1xuICBjb25zdCBhZGp1c3RlZE9wdGlvbnMgPSBvcHRpb25zLndhdGNoID8gb3B0aW9ucyA6IHsgLi4ub3B0aW9ucywgYXNzZXRzOiBbXSB9O1xuXG4gIGNvbnN0IHsgY29uZmlnLCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QsIGkxOG4gfSA9XG4gICAgYXdhaXQgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChcbiAgICAgIHtcbiAgICAgICAgLi4uYWRqdXN0ZWRPcHRpb25zLFxuICAgICAgICBidWlsZE9wdGltaXplcjogZmFsc2UsXG4gICAgICAgIGFvdDogdHJ1ZSxcbiAgICAgICAgcGxhdGZvcm06ICdzZXJ2ZXInLFxuICAgICAgfSBhcyBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICAgICBjb250ZXh0LFxuICAgICAgKHdjbykgPT4ge1xuICAgICAgICAvLyBXZSB1c2UgdGhlIHBsYXRmb3JtIHRvIGRldGVybWluZSB0aGUgSmF2YVNjcmlwdCBzeW50YXggb3V0cHV0LlxuICAgICAgICB3Y28uYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzID8/PSBbXTtcbiAgICAgICAgd2NvLmJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2Vycy5wdXNoKC4uLmJyb3dzZXJzbGlzdCgnbWFpbnRhaW5lZCBub2RlIHZlcnNpb25zJykpO1xuXG4gICAgICAgIHJldHVybiBbZ2V0UGxhdGZvcm1TZXJ2ZXJFeHBvcnRzQ29uZmlnKHdjbyksIGdldENvbW1vbkNvbmZpZyh3Y28pLCBnZXRTdHlsZXNDb25maWcod2NvKV07XG4gICAgICB9LFxuICAgICk7XG5cbiAgaWYgKG9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aCkge1xuICAgIGRlbGV0ZU91dHB1dERpcihjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9yaWdpbmFsT3V0cHV0UGF0aCk7XG4gIH1cblxuICBjb25zdCB0cmFuc2Zvcm1lZENvbmZpZyA9IChhd2FpdCB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybT8uKGNvbmZpZykpID8/IGNvbmZpZztcblxuICByZXR1cm4geyBjb25maWc6IHRyYW5zZm9ybWVkQ29uZmlnLCBpMThuLCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QgfTtcbn1cblxuLyoqXG4gKiBBZGQgYEBhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcmAgZXhwb3J0cy5cbiAqIFRoaXMgaXMgbmVlZGVkIHNvIHRoYXQgREkgdG9rZW5zIGNhbiBiZSByZWZlcmVuY2VkIGFuZCBzZXQgYXQgcnVudGltZSBvdXRzaWRlIG9mIHRoZSBidW5kbGUuXG4gKi9cbmZ1bmN0aW9uIGdldFBsYXRmb3JtU2VydmVyRXhwb3J0c0NvbmZpZyh3Y286IEJyb3dzZXJXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IFBhcnRpYWw8Q29uZmlndXJhdGlvbj4ge1xuICAvLyBBZGQgYEBhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcmAgZXhwb3J0cy5cbiAgLy8gVGhpcyBpcyBuZWVkZWQgc28gdGhhdCBESSB0b2tlbnMgY2FuIGJlIHJlZmVyZW5jZWQgYW5kIHNldCBhdCBydW50aW1lIG91dHNpZGUgb2YgdGhlIGJ1bmRsZS5cblxuICAvLyBPbmx5IGFkZCBgQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyYCBleHBvcnRzIHdoZW4gaXQgaXMgaW5zdGFsbGVkLlxuICAvLyBJbiBzb21lIGNhc2VzIHRoaXMgYnVpbGRlciBpcyB1c2VkIHdoZW4gYEBhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcmAgaXMgbm90IGluc3RhbGxlZC5cbiAgLy8gRXhhbXBsZTogd2hlbiB1c2luZyBgQG5ndW5pdmVyc2FsL2NvbW1vbi9jbG92ZXJgIHdoaWNoIGRvZXMgbm90IG5lZWQgYEBhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcmAuXG5cbiAgcmV0dXJuIGlzUGxhdGZvcm1TZXJ2ZXJJbnN0YWxsZWQod2NvLnJvb3QpXG4gICAgPyB7XG4gICAgICAgIG1vZHVsZToge1xuICAgICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCcuL3BsYXRmb3JtLXNlcnZlci1leHBvcnRzLWxvYWRlcicpLFxuICAgICAgICAgICAgICBpbmNsdWRlOiBbcGF0aC5yZXNvbHZlKHdjby5yb290LCB3Y28uYnVpbGRPcHRpb25zLm1haW4pXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICA6IHt9O1xufVxuIl19