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
const operators_1 = require("rxjs/operators");
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
    return (0, rxjs_1.from)(initialize(options, context, transforms.webpackConfiguration)).pipe((0, operators_1.concatMap)(({ config, i18n, projectRoot, projectSourceRoot }) => {
        return (0, build_webpack_1.runWebpack)(config, context, {
            webpackFactory: require('webpack'),
            logging: (stats, config) => {
                if (options.verbose) {
                    context.logger.info(stats.toString(config.stats));
                }
            },
        }).pipe((0, operators_1.concatMap)(async (output) => {
            var _a;
            const { emittedFiles = [], outputPath, webpackStats } = output;
            if (!webpackStats) {
                throw new Error('Webpack stats build result is required.');
            }
            if (!output.success) {
                return output;
            }
            const spinner = new spinner_1.Spinner();
            spinner.enabled = options.progress !== false;
            outputPaths = (0, output_paths_1.ensureOutputPaths)(baseOutputPath, i18n);
            // Copy assets
            if (!options.watch && ((_a = options.assets) === null || _a === void 0 ? void 0 : _a.length)) {
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
    }), (0, operators_1.concatMap)(async (output) => {
        if (!output.success) {
            return output;
        }
        return {
            ...output,
            baseOutputPath,
            outputPath: baseOutputPath,
            outputPaths: outputPaths || [baseOutputPath],
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
    var _a;
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
        var _b;
        // We use the platform to determine the JavaScript syntax output.
        (_a = (_b = wco.buildOptions).supportedBrowsers) !== null && _a !== void 0 ? _a : (_b.supportedBrowsers = []);
        wco.buildOptions.supportedBrowsers.push(...browserslist('maintained node versions'));
        return [getPlatformServerExportsConfig(wco), (0, configs_1.getCommonConfig)(wco), (0, configs_1.getStylesConfig)(wco)];
    });
    if (options.deleteOutputPath) {
        (0, utils_1.deleteOutputDir)(context.workspaceRoot, originalOutputPath);
    }
    const transformedConfig = (_a = (await (webpackConfigurationTransform === null || webpackConfigurationTransform === void 0 ? void 0 : webpackConfigurationTransform(config)))) !== null && _a !== void 0 ? _a : config;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsaUVBQTJEO0FBQzNELDJDQUE2QjtBQUM3QiwrQkFBd0M7QUFDeEMsOENBQTJDO0FBRzNDLHVDQUlxQjtBQUNyQiw2Q0FBMkM7QUFDM0MseURBQXFEO0FBQ3JELDZDQUFrRDtBQUNsRCw2REFBbUU7QUFFbkUsMkRBQTZEO0FBQzdELHlEQUErRDtBQUMvRCxpREFBOEM7QUFDOUMsaURBQXFFO0FBQ3JFLCtFQUc0QztBQUM1QyxtREFBeUU7QUFDekUseURBQXdFO0FBQ3hFLHFEQUErRDtBQXlCL0Q7O0dBRUc7QUFDSCxTQUFnQixPQUFPLENBQ3JCLE9BQTZCLEVBQzdCLE9BQXVCLEVBQ3ZCLGFBRUksRUFBRTtJQUVOLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7SUFFbkMseUJBQXlCO0lBQ3pCLElBQUEsd0NBQThCLEVBQUMsSUFBSSxDQUFDLENBQUM7SUFFckMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzlELElBQUksV0FBNEMsQ0FBQztJQUVqRCxPQUFPLElBQUEsV0FBSSxFQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUM3RSxJQUFBLHFCQUFTLEVBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLGlCQUFpQixFQUFFLEVBQUUsRUFBRTtRQUM3RCxPQUFPLElB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RTtnQkFDTixLQUFLLEVBQUU7b0JBQ0w7d0JBQ0UsTUFBTSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsa0NBQWtDLENBQUM7d0JBQzNELE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO3FCQUN6RDtpQkFDRjthQUNGO1NBQ0Y7UUFDSCxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQ1QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgcnVuV2VicGFjayB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBmcm9tIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBjb25jYXRNYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgd2VicGFjaywgeyBDb25maWd1cmF0aW9uIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBFeGVjdXRpb25UcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHtcbiAgTm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICBkZWxldGVPdXRwdXREaXIsXG4gIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMsXG59IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IGNvbG9ycyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvbG9yJztcbmltcG9ydCB7IGNvcHlBc3NldHMgfSBmcm9tICcuLi8uLi91dGlscy9jb3B5LWFzc2V0cyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgaTE4bklubGluZUVtaXR0ZWRGaWxlcyB9IGZyb20gJy4uLy4uL3V0aWxzL2kxOG4taW5saW5pbmcnO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgZW5zdXJlT3V0cHV0UGF0aHMgfSBmcm9tICcuLi8uLi91dGlscy9vdXRwdXQtcGF0aHMnO1xuaW1wb3J0IHsgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUgfSBmcm9tICcuLi8uLi91dGlscy9wdXJnZS1jYWNoZSc7XG5pbXBvcnQgeyBTcGlubmVyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lcic7XG5pbXBvcnQgeyBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24gfSBmcm9tICcuLi8uLi91dGlscy92ZXJzaW9uJztcbmltcG9ydCB7XG4gIEJyb3dzZXJXZWJwYWNrQ29uZmlnT3B0aW9ucyxcbiAgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dCxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBnZXRDb21tb25Db25maWcsIGdldFN0eWxlc0NvbmZpZyB9IGZyb20gJy4uLy4uL3dlYnBhY2svY29uZmlncyc7XG5pbXBvcnQgeyBpc1BsYXRmb3JtU2VydmVySW5zdGFsbGVkIH0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9oZWxwZXJzJztcbmltcG9ydCB7IHdlYnBhY2tTdGF0c0xvZ2dlciB9IGZyb20gJy4uLy4uL3dlYnBhY2svdXRpbHMvc3RhdHMnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIFNlcnZlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgdHlwZSBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuZXhwb3J0IHR5cGUgU2VydmVyQnVpbGRlck91dHB1dCA9IEJ1aWxkZXJPdXRwdXQgJiB7XG4gIGJhc2VPdXRwdXRQYXRoOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBAZGVwcmVjYXRlZCBpbiB2ZXJzaW9uIDE0LiBVc2UgJ291dHB1dHMnIGluc3RlYWQuXG4gICAqL1xuICBvdXRwdXRQYXRoczogc3RyaW5nW107XG4gIC8qKlxuICAgKiBAZGVwcmVjYXRlZCBpbiB2ZXJzaW9uIDkuIFVzZSAnb3V0cHV0cycgaW5zdGVhZC5cbiAgICovXG4gIG91dHB1dFBhdGg6IHN0cmluZztcblxuICBvdXRwdXRzOiB7XG4gICAgbG9jYWxlPzogc3RyaW5nO1xuICAgIHBhdGg6IHN0cmluZztcbiAgfVtdO1xufTtcblxuZXhwb3J0IHsgU2VydmVyQnVpbGRlck9wdGlvbnMgfTtcblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZXhlY3V0ZShcbiAgb3B0aW9uczogU2VydmVyQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zOiB7XG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb24/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+O1xuICB9ID0ge30sXG4pOiBPYnNlcnZhYmxlPFNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3Qgcm9vdCA9IGNvbnRleHQud29ya3NwYWNlUm9vdDtcblxuICAvLyBDaGVjayBBbmd1bGFyIHZlcnNpb24uXG4gIGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbihyb290KTtcblxuICBjb25zdCBiYXNlT3V0cHV0UGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBvcHRpb25zLm91dHB1dFBhdGgpO1xuICBsZXQgb3V0cHV0UGF0aHM6IHVuZGVmaW5lZCB8IE1hcDxzdHJpbmcsIHN0cmluZz47XG5cbiAgcmV0dXJuIGZyb20oaW5pdGlhbGl6ZShvcHRpb25zLCBjb250ZXh0LCB0cmFuc2Zvcm1zLndlYnBhY2tDb25maWd1cmF0aW9uKSkucGlwZShcbiAgICBjb25jYXRNYXAoKHsgY29uZmlnLCBpMThuLCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QgfSkgPT4ge1xuICAgICAgcmV0dXJuIHJ1bldlYnBhY2soY29uZmlnLCBjb250ZXh0LCB7XG4gICAgICAgIHdlYnBhY2tGYWN0b3J5OiByZXF1aXJlKCd3ZWJwYWNrJykgYXMgdHlwZW9mIHdlYnBhY2ssXG4gICAgICAgIGxvZ2dpbmc6IChzdGF0cywgY29uZmlnKSA9PiB7XG4gICAgICAgICAgaWYgKG9wdGlvbnMudmVyYm9zZSkge1xuICAgICAgICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhzdGF0cy50b1N0cmluZyhjb25maWcuc3RhdHMpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9KS5waXBlKFxuICAgICAgICBjb25jYXRNYXAoYXN5bmMgKG91dHB1dCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHsgZW1pdHRlZEZpbGVzID0gW10sIG91dHB1dFBhdGgsIHdlYnBhY2tTdGF0cyB9ID0gb3V0cHV0O1xuICAgICAgICAgIGlmICghd2VicGFja1N0YXRzKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYnBhY2sgc3RhdHMgYnVpbGQgcmVzdWx0IGlzIHJlcXVpcmVkLicpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghb3V0cHV0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKCk7XG4gICAgICAgICAgc3Bpbm5lci5lbmFibGVkID0gb3B0aW9ucy5wcm9ncmVzcyAhPT0gZmFsc2U7XG4gICAgICAgICAgb3V0cHV0UGF0aHMgPSBlbnN1cmVPdXRwdXRQYXRocyhiYXNlT3V0cHV0UGF0aCwgaTE4bik7XG5cbiAgICAgICAgICAvLyBDb3B5IGFzc2V0c1xuICAgICAgICAgIGlmICghb3B0aW9ucy53YXRjaCAmJiBvcHRpb25zLmFzc2V0cz8ubGVuZ3RoKSB7XG4gICAgICAgICAgICBzcGlubmVyLnN0YXJ0KCdDb3B5aW5nIGFzc2V0cy4uLicpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgYXdhaXQgY29weUFzc2V0cyhcbiAgICAgICAgICAgICAgICBub3JtYWxpemVBc3NldFBhdHRlcm5zKFxuICAgICAgICAgICAgICAgICAgb3B0aW9ucy5hc3NldHMsXG4gICAgICAgICAgICAgICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICAgICAgICBwcm9qZWN0Um9vdCxcbiAgICAgICAgICAgICAgICAgIHByb2plY3RTb3VyY2VSb290LFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgQXJyYXkuZnJvbShvdXRwdXRQYXRocy52YWx1ZXMoKSksXG4gICAgICAgICAgICAgICAgY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBzcGlubmVyLnN1Y2NlZWQoJ0NvcHlpbmcgYXNzZXRzIGNvbXBsZXRlLicpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgIHNwaW5uZXIuZmFpbChjb2xvcnMucmVkQnJpZ2h0KCdDb3B5aW5nIG9mIGFzc2V0cyBmYWlsZWQuJykpO1xuICAgICAgICAgICAgICBhc3NlcnRJc0Vycm9yKGVycik7XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAuLi5vdXRwdXQsXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdVbmFibGUgdG8gY29weSBhc3NldHM6ICcgKyBlcnIubWVzc2FnZSxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaTE4bi5zaG91bGRJbmxpbmUpIHtcbiAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBhd2FpdCBpMThuSW5saW5lRW1pdHRlZEZpbGVzKFxuICAgICAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgICAgICBlbWl0dGVkRmlsZXMsXG4gICAgICAgICAgICAgIGkxOG4sXG4gICAgICAgICAgICAgIGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICAgICAgICBBcnJheS5mcm9tKG91dHB1dFBhdGhzLnZhbHVlcygpKSxcbiAgICAgICAgICAgICAgW10sXG4gICAgICAgICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgICAgICAgIG9wdGlvbnMuaTE4bk1pc3NpbmdUcmFuc2xhdGlvbixcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAuLi5vdXRwdXQsXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgd2VicGFja1N0YXRzTG9nZ2VyKGNvbnRleHQubG9nZ2VyLCB3ZWJwYWNrU3RhdHMsIGNvbmZpZyk7XG5cbiAgICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfSksXG4gICAgY29uY2F0TWFwKGFzeW5jIChvdXRwdXQpID0+IHtcbiAgICAgIGlmICghb3V0cHV0LnN1Y2Nlc3MpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dCBhcyBTZXJ2ZXJCdWlsZGVyT3V0cHV0O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi5vdXRwdXQsXG4gICAgICAgIGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICBvdXRwdXRQYXRoOiBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgb3V0cHV0UGF0aHM6IG91dHB1dFBhdGhzIHx8IFtiYXNlT3V0cHV0UGF0aF0sXG4gICAgICAgIG91dHB1dHM6IChvdXRwdXRQYXRocyAmJlxuICAgICAgICAgIFsuLi5vdXRwdXRQYXRocy5lbnRyaWVzKCldLm1hcCgoW2xvY2FsZSwgcGF0aF0pID0+ICh7XG4gICAgICAgICAgICBsb2NhbGUsXG4gICAgICAgICAgICBwYXRoLFxuICAgICAgICAgIH0pKSkgfHwge1xuICAgICAgICAgIHBhdGg6IGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICB9LFxuICAgICAgfSBhcyBTZXJ2ZXJCdWlsZGVyT3V0cHV0O1xuICAgIH0pLFxuICApO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyPFNlcnZlckJ1aWxkZXJPcHRpb25zLCBTZXJ2ZXJCdWlsZGVyT3V0cHV0PihleGVjdXRlKTtcblxuYXN5bmMgZnVuY3Rpb24gaW5pdGlhbGl6ZShcbiAgb3B0aW9uczogU2VydmVyQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybT86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPHdlYnBhY2suQ29uZmlndXJhdGlvbj4sXG4pOiBQcm9taXNlPHtcbiAgY29uZmlnOiB3ZWJwYWNrLkNvbmZpZ3VyYXRpb247XG4gIGkxOG46IEkxOG5PcHRpb25zO1xuICBwcm9qZWN0Um9vdDogc3RyaW5nO1xuICBwcm9qZWN0U291cmNlUm9vdD86IHN0cmluZztcbn0+IHtcbiAgLy8gUHVyZ2Ugb2xkIGJ1aWxkIGRpc2sgY2FjaGUuXG4gIGF3YWl0IHB1cmdlU3RhbGVCdWlsZENhY2hlKGNvbnRleHQpO1xuXG4gIGNvbnN0IGJyb3dzZXJzbGlzdCA9IChhd2FpdCBpbXBvcnQoJ2Jyb3dzZXJzbGlzdCcpKS5kZWZhdWx0O1xuICBjb25zdCBvcmlnaW5hbE91dHB1dFBhdGggPSBvcHRpb25zLm91dHB1dFBhdGg7XG4gIC8vIEFzc2V0cyBhcmUgcHJvY2Vzc2VkIGRpcmVjdGx5IGJ5IHRoZSBidWlsZGVyIGV4Y2VwdCB3aGVuIHdhdGNoaW5nXG4gIGNvbnN0IGFkanVzdGVkT3B0aW9ucyA9IG9wdGlvbnMud2F0Y2ggPyBvcHRpb25zIDogeyAuLi5vcHRpb25zLCBhc3NldHM6IFtdIH07XG5cbiAgY29uc3QgeyBjb25maWcsIHByb2plY3RSb290LCBwcm9qZWN0U291cmNlUm9vdCwgaTE4biB9ID1cbiAgICBhd2FpdCBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KFxuICAgICAge1xuICAgICAgICAuLi5hZGp1c3RlZE9wdGlvbnMsXG4gICAgICAgIGJ1aWxkT3B0aW1pemVyOiBmYWxzZSxcbiAgICAgICAgYW90OiB0cnVlLFxuICAgICAgICBwbGF0Zm9ybTogJ3NlcnZlcicsXG4gICAgICB9IGFzIE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgICAgIGNvbnRleHQsXG4gICAgICAod2NvKSA9PiB7XG4gICAgICAgIC8vIFdlIHVzZSB0aGUgcGxhdGZvcm0gdG8gZGV0ZXJtaW5lIHRoZSBKYXZhU2NyaXB0IHN5bnRheCBvdXRwdXQuXG4gICAgICAgIHdjby5idWlsZE9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMgPz89IFtdO1xuICAgICAgICB3Y28uYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzLnB1c2goLi4uYnJvd3NlcnNsaXN0KCdtYWludGFpbmVkIG5vZGUgdmVyc2lvbnMnKSk7XG5cbiAgICAgICAgcmV0dXJuIFtnZXRQbGF0Zm9ybVNlcnZlckV4cG9ydHNDb25maWcod2NvKSwgZ2V0Q29tbW9uQ29uZmlnKHdjbyksIGdldFN0eWxlc0NvbmZpZyh3Y28pXTtcbiAgICAgIH0sXG4gICAgKTtcblxuICBpZiAob3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoKSB7XG4gICAgZGVsZXRlT3V0cHV0RGlyKGNvbnRleHQud29ya3NwYWNlUm9vdCwgb3JpZ2luYWxPdXRwdXRQYXRoKTtcbiAgfVxuXG4gIGNvbnN0IHRyYW5zZm9ybWVkQ29uZmlnID0gKGF3YWl0IHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtPy4oY29uZmlnKSkgPz8gY29uZmlnO1xuXG4gIHJldHVybiB7IGNvbmZpZzogdHJhbnNmb3JtZWRDb25maWcsIGkxOG4sIHByb2plY3RSb290LCBwcm9qZWN0U291cmNlUm9vdCB9O1xufVxuXG4vKipcbiAqIEFkZCBgQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyYCBleHBvcnRzLlxuICogVGhpcyBpcyBuZWVkZWQgc28gdGhhdCBESSB0b2tlbnMgY2FuIGJlIHJlZmVyZW5jZWQgYW5kIHNldCBhdCBydW50aW1lIG91dHNpZGUgb2YgdGhlIGJ1bmRsZS5cbiAqL1xuZnVuY3Rpb24gZ2V0UGxhdGZvcm1TZXJ2ZXJFeHBvcnRzQ29uZmlnKHdjbzogQnJvd3NlcldlYnBhY2tDb25maWdPcHRpb25zKTogUGFydGlhbDxDb25maWd1cmF0aW9uPiB7XG4gIC8vIEFkZCBgQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyYCBleHBvcnRzLlxuICAvLyBUaGlzIGlzIG5lZWRlZCBzbyB0aGF0IERJIHRva2VucyBjYW4gYmUgcmVmZXJlbmNlZCBhbmQgc2V0IGF0IHJ1bnRpbWUgb3V0c2lkZSBvZiB0aGUgYnVuZGxlLlxuXG4gIC8vIE9ubHkgYWRkIGBAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXJgIGV4cG9ydHMgd2hlbiBpdCBpcyBpbnN0YWxsZWQuXG4gIC8vIEluIHNvbWUgY2FzZXMgdGhpcyBidWlsZGVyIGlzIHVzZWQgd2hlbiBgQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyYCBpcyBub3QgaW5zdGFsbGVkLlxuICAvLyBFeGFtcGxlOiB3aGVuIHVzaW5nIGBAbmd1bml2ZXJzYWwvY29tbW9uL2Nsb3ZlcmAgd2hpY2ggZG9lcyBub3QgbmVlZCBgQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyYC5cblxuICByZXR1cm4gaXNQbGF0Zm9ybVNlcnZlckluc3RhbGxlZCh3Y28ucm9vdClcbiAgICA/IHtcbiAgICAgICAgbW9kdWxlOiB7XG4gICAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbG9hZGVyOiByZXF1aXJlLnJlc29sdmUoJy4vcGxhdGZvcm0tc2VydmVyLWV4cG9ydHMtbG9hZGVyJyksXG4gICAgICAgICAgICAgIGluY2x1ZGU6IFtwYXRoLnJlc29sdmUod2NvLnJvb3QsIHdjby5idWlsZE9wdGlvbnMubWFpbildLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgfVxuICAgIDoge307XG59XG4iXX0=