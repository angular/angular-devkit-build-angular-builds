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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsaUVBQTJEO0FBQzNELDJDQUE2QjtBQUM3QiwrQkFBbUQ7QUFHbkQsdUNBSXFCO0FBQ3JCLDZDQUEyQztBQUMzQyx5REFBcUQ7QUFDckQsNkNBQWtEO0FBQ2xELDZEQUFtRTtBQUVuRSwyREFBNkQ7QUFDN0QseURBQStEO0FBQy9ELGlEQUE4QztBQUM5QyxpREFBcUU7QUFDckUsK0VBRzRDO0FBQzVDLG1EQUF5RTtBQUN6RSx5REFBd0U7QUFDeEUscURBTW1DO0FBeUJuQzs7R0FFRztBQUNILFNBQWdCLE9BQU8sQ0FDckIsT0FBNkIsRUFDN0IsT0FBdUIsRUFDdkIsYUFFSSxFQUFFO0lBRU4sTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUVuQyx5QkFBeUI7SUFDekIsSUFBQSx3Q0FBOEIsRUFBQyxJQUFJLENBQUMsQ0FBQztJQUVyQyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDOUQsSUFBSSxXQUE0QyxDQUFDO0lBRWpELE9BQU8sSUFBQSxXQUFJLEVBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsVUFBVSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQzdFLElBQUEsZ0JBQVMsRUFBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsaUJBQWlCLEVBQUUsRUFBRSxFQUFFO1FBQzdELE9BQU8sSUFBQSwwQkFBVSxFQUFD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QUFpQixFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQztBQUM3RSxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBUyw4QkFBOEIsQ0FBQyxHQUFnQztJQUN0RSwwQ0FBMEM7SUFDMUMsK0ZBQStGO0lBRS9GLG9FQUFvRTtJQUNwRSx1RkFBdUY7SUFDdkYsbUdBQW1HO0lBRW5HLE9BQU8sSUFBQSxtQ0FBeUIsRUFBQyxHQUFHLENBQUMsSUFBSSxDQUFDO1FBQ3hDLENBQUMsQ0FBQztZQUNFLE1BQU0sRUFBRTtnQkFDTixLQUFLLEVBQUU7b0JBQ0w7d0JBQ0UsTUFBTSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsa0NBQWtDLENBQUM7d0JBQzNELE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO3FCQUN6RDtpQkFDRjthQUNGO1NBQ0Y7UUFDSCxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQ1QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgcnVuV2VicGFjayB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBjb25jYXRNYXAsIGZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB3ZWJwYWNrLCB7IENvbmZpZ3VyYXRpb24gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IEV4ZWN1dGlvblRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vdHJhbnNmb3Jtcyc7XG5pbXBvcnQge1xuICBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIGRlbGV0ZU91dHB1dERpcixcbiAgbm9ybWFsaXplQXNzZXRQYXR0ZXJucyxcbn0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgY29sb3JzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29sb3InO1xuaW1wb3J0IHsgY29weUFzc2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvcHktYXNzZXRzJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyBpMThuSW5saW5lRW1pdHRlZEZpbGVzIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1pbmxpbmluZyc7XG5pbXBvcnQgeyBJMThuT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2kxOG4tb3B0aW9ucyc7XG5pbXBvcnQgeyBlbnN1cmVPdXRwdXRQYXRocyB9IGZyb20gJy4uLy4uL3V0aWxzL291dHB1dC1wYXRocyc7XG5pbXBvcnQgeyBwdXJnZVN0YWxlQnVpbGRDYWNoZSB9IGZyb20gJy4uLy4uL3V0aWxzL3B1cmdlLWNhY2hlJztcbmltcG9ydCB7IFNwaW5uZXIgfSBmcm9tICcuLi8uLi91dGlscy9zcGlubmVyJztcbmltcG9ydCB7IGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbiB9IGZyb20gJy4uLy4uL3V0aWxzL3ZlcnNpb24nO1xuaW1wb3J0IHtcbiAgQnJvd3NlcldlYnBhY2tDb25maWdPcHRpb25zLFxuICBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0LFxufSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IGdldENvbW1vbkNvbmZpZywgZ2V0U3R5bGVzQ29uZmlnIH0gZnJvbSAnLi4vLi4vd2VicGFjay9jb25maWdzJztcbmltcG9ydCB7IGlzUGxhdGZvcm1TZXJ2ZXJJbnN0YWxsZWQgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL2hlbHBlcnMnO1xuaW1wb3J0IHtcbiAgc3RhdHNFcnJvcnNUb1N0cmluZyxcbiAgc3RhdHNIYXNFcnJvcnMsXG4gIHN0YXRzSGFzV2FybmluZ3MsXG4gIHN0YXRzV2FybmluZ3NUb1N0cmluZyxcbiAgd2VicGFja1N0YXRzTG9nZ2VyLFxufSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL3N0YXRzJztcbmltcG9ydCB7IFNjaGVtYSBhcyBTZXJ2ZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4vc2NoZW1hJztcblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIHR5cGUgaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCB0eXBlIFNlcnZlckJ1aWxkZXJPdXRwdXQgPSBCdWlsZGVyT3V0cHV0ICYge1xuICBiYXNlT3V0cHV0UGF0aDogc3RyaW5nO1xuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgaW4gdmVyc2lvbiAxNC4gVXNlICdvdXRwdXRzJyBpbnN0ZWFkLlxuICAgKi9cbiAgb3V0cHV0UGF0aHM6IHN0cmluZ1tdO1xuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgaW4gdmVyc2lvbiA5LiBVc2UgJ291dHB1dHMnIGluc3RlYWQuXG4gICAqL1xuICBvdXRwdXRQYXRoOiBzdHJpbmc7XG5cbiAgb3V0cHV0czoge1xuICAgIGxvY2FsZT86IHN0cmluZztcbiAgICBwYXRoOiBzdHJpbmc7XG4gIH1bXTtcbn07XG5cbmV4cG9ydCB7IFNlcnZlckJ1aWxkZXJPcHRpb25zIH07XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IFNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgdHJhbnNmb3Jtczoge1xuICAgIHdlYnBhY2tDb25maWd1cmF0aW9uPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8d2VicGFjay5Db25maWd1cmF0aW9uPjtcbiAgfSA9IHt9LFxuKTogT2JzZXJ2YWJsZTxTZXJ2ZXJCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnN0IHJvb3QgPSBjb250ZXh0LndvcmtzcGFjZVJvb3Q7XG5cbiAgLy8gQ2hlY2sgQW5ndWxhciB2ZXJzaW9uLlxuICBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24ocm9vdCk7XG5cbiAgY29uc3QgYmFzZU91dHB1dFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgb3B0aW9ucy5vdXRwdXRQYXRoKTtcbiAgbGV0IG91dHB1dFBhdGhzOiB1bmRlZmluZWQgfCBNYXA8c3RyaW5nLCBzdHJpbmc+O1xuXG4gIHJldHVybiBmcm9tKGluaXRpYWxpemUob3B0aW9ucywgY29udGV4dCwgdHJhbnNmb3Jtcy53ZWJwYWNrQ29uZmlndXJhdGlvbikpLnBpcGUoXG4gICAgY29uY2F0TWFwKCh7IGNvbmZpZywgaTE4biwgcHJvamVjdFJvb3QsIHByb2plY3RTb3VyY2VSb290IH0pID0+IHtcbiAgICAgIHJldHVybiBydW5XZWJwYWNrKGNvbmZpZywgY29udGV4dCwge1xuICAgICAgICB3ZWJwYWNrRmFjdG9yeTogcmVxdWlyZSgnd2VicGFjaycpIGFzIHR5cGVvZiB3ZWJwYWNrLFxuICAgICAgICBsb2dnaW5nOiAoc3RhdHMsIGNvbmZpZykgPT4ge1xuICAgICAgICAgIGlmIChvcHRpb25zLnZlcmJvc2UpIHtcbiAgICAgICAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oc3RhdHMudG9TdHJpbmcoY29uZmlnLnN0YXRzKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgfSkucGlwZShcbiAgICAgICAgY29uY2F0TWFwKGFzeW5jIChvdXRwdXQpID0+IHtcbiAgICAgICAgICBjb25zdCB7IGVtaXR0ZWRGaWxlcyA9IFtdLCBvdXRwdXRQYXRoLCB3ZWJwYWNrU3RhdHMsIHN1Y2Nlc3MgfSA9IG91dHB1dDtcbiAgICAgICAgICBpZiAoIXdlYnBhY2tTdGF0cykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdXZWJwYWNrIHN0YXRzIGJ1aWxkIHJlc3VsdCBpcyByZXF1aXJlZC4nKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIGlmIChzdGF0c0hhc1dhcm5pbmdzKHdlYnBhY2tTdGF0cykpIHtcbiAgICAgICAgICAgICAgY29udGV4dC5sb2dnZXIud2FybihzdGF0c1dhcm5pbmdzVG9TdHJpbmcod2VicGFja1N0YXRzLCB7IGNvbG9yczogdHJ1ZSB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3RhdHNIYXNFcnJvcnMod2VicGFja1N0YXRzKSkge1xuICAgICAgICAgICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihzdGF0c0Vycm9yc1RvU3RyaW5nKHdlYnBhY2tTdGF0cywgeyBjb2xvcnM6IHRydWUgfSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcigpO1xuICAgICAgICAgIHNwaW5uZXIuZW5hYmxlZCA9IG9wdGlvbnMucHJvZ3Jlc3MgIT09IGZhbHNlO1xuICAgICAgICAgIG91dHB1dFBhdGhzID0gZW5zdXJlT3V0cHV0UGF0aHMoYmFzZU91dHB1dFBhdGgsIGkxOG4pO1xuXG4gICAgICAgICAgLy8gQ29weSBhc3NldHNcbiAgICAgICAgICBpZiAoIW9wdGlvbnMud2F0Y2ggJiYgb3B0aW9ucy5hc3NldHM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgc3Bpbm5lci5zdGFydCgnQ29weWluZyBhc3NldHMuLi4nKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGF3YWl0IGNvcHlBc3NldHMoXG4gICAgICAgICAgICAgICAgbm9ybWFsaXplQXNzZXRQYXR0ZXJucyhcbiAgICAgICAgICAgICAgICAgIG9wdGlvbnMuYXNzZXRzLFxuICAgICAgICAgICAgICAgICAgY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgICAgICAgICAgICAgcHJvamVjdFJvb3QsXG4gICAgICAgICAgICAgICAgICBwcm9qZWN0U291cmNlUm9vdCxcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIEFycmF5LmZyb20ob3V0cHV0UGF0aHMudmFsdWVzKCkpLFxuICAgICAgICAgICAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgc3Bpbm5lci5zdWNjZWVkKCdDb3B5aW5nIGFzc2V0cyBjb21wbGV0ZS4nKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICBzcGlubmVyLmZhaWwoY29sb3JzLnJlZEJyaWdodCgnQ29weWluZyBvZiBhc3NldHMgZmFpbGVkLicpKTtcbiAgICAgICAgICAgICAgYXNzZXJ0SXNFcnJvcihlcnIpO1xuXG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgLi4ub3V0cHV0LFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiAnVW5hYmxlIHRvIGNvcHkgYXNzZXRzOiAnICsgZXJyLm1lc3NhZ2UsXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGkxOG4uc2hvdWxkSW5saW5lKSB7XG4gICAgICAgICAgICBjb25zdCBzdWNjZXNzID0gYXdhaXQgaTE4bklubGluZUVtaXR0ZWRGaWxlcyhcbiAgICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgICAgZW1pdHRlZEZpbGVzLFxuICAgICAgICAgICAgICBpMThuLFxuICAgICAgICAgICAgICBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgQXJyYXkuZnJvbShvdXRwdXRQYXRocy52YWx1ZXMoKSksXG4gICAgICAgICAgICAgIFtdLFxuICAgICAgICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICAgICAgICBvcHRpb25zLmkxOG5NaXNzaW5nVHJhbnNsYXRpb24sXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgLi4ub3V0cHV0LFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHdlYnBhY2tTdGF0c0xvZ2dlcihjb250ZXh0LmxvZ2dlciwgd2VicGFja1N0YXRzLCBjb25maWcpO1xuXG4gICAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH0pLFxuICAgIGNvbmNhdE1hcChhc3luYyAob3V0cHV0KSA9PiB7XG4gICAgICBpZiAoIW91dHB1dC5zdWNjZXNzKSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQgYXMgU2VydmVyQnVpbGRlck91dHB1dDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4ub3V0cHV0LFxuICAgICAgICBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgb3V0cHV0UGF0aDogYmFzZU91dHB1dFBhdGgsXG4gICAgICAgIG91dHB1dFBhdGhzOiBvdXRwdXRQYXRocyB8fCBbYmFzZU91dHB1dFBhdGhdLFxuICAgICAgICBvdXRwdXRzOiAob3V0cHV0UGF0aHMgJiZcbiAgICAgICAgICBbLi4ub3V0cHV0UGF0aHMuZW50cmllcygpXS5tYXAoKFtsb2NhbGUsIHBhdGhdKSA9PiAoe1xuICAgICAgICAgICAgbG9jYWxlLFxuICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICB9KSkpIHx8IHtcbiAgICAgICAgICBwYXRoOiBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgfSxcbiAgICAgIH0gYXMgU2VydmVyQnVpbGRlck91dHB1dDtcbiAgICB9KSxcbiAgKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcjxTZXJ2ZXJCdWlsZGVyT3B0aW9ucywgU2VydmVyQnVpbGRlck91dHB1dD4oZXhlY3V0ZSk7XG5cbmFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemUoXG4gIG9wdGlvbnM6IFNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgd2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm0/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+LFxuKTogUHJvbWlzZTx7XG4gIGNvbmZpZzogd2VicGFjay5Db25maWd1cmF0aW9uO1xuICBpMThuOiBJMThuT3B0aW9ucztcbiAgcHJvamVjdFJvb3Q6IHN0cmluZztcbiAgcHJvamVjdFNvdXJjZVJvb3Q/OiBzdHJpbmc7XG59PiB7XG4gIC8vIFB1cmdlIG9sZCBidWlsZCBkaXNrIGNhY2hlLlxuICBhd2FpdCBwdXJnZVN0YWxlQnVpbGRDYWNoZShjb250ZXh0KTtcblxuICBjb25zdCBicm93c2Vyc2xpc3QgPSAoYXdhaXQgaW1wb3J0KCdicm93c2Vyc2xpc3QnKSkuZGVmYXVsdDtcbiAgY29uc3Qgb3JpZ2luYWxPdXRwdXRQYXRoID0gb3B0aW9ucy5vdXRwdXRQYXRoO1xuICAvLyBBc3NldHMgYXJlIHByb2Nlc3NlZCBkaXJlY3RseSBieSB0aGUgYnVpbGRlciBleGNlcHQgd2hlbiB3YXRjaGluZ1xuICBjb25zdCBhZGp1c3RlZE9wdGlvbnMgPSBvcHRpb25zLndhdGNoID8gb3B0aW9ucyA6IHsgLi4ub3B0aW9ucywgYXNzZXRzOiBbXSB9O1xuXG4gIGNvbnN0IHsgY29uZmlnLCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QsIGkxOG4gfSA9XG4gICAgYXdhaXQgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChcbiAgICAgIHtcbiAgICAgICAgLi4uYWRqdXN0ZWRPcHRpb25zLFxuICAgICAgICBidWlsZE9wdGltaXplcjogZmFsc2UsXG4gICAgICAgIGFvdDogdHJ1ZSxcbiAgICAgICAgcGxhdGZvcm06ICdzZXJ2ZXInLFxuICAgICAgfSBhcyBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICAgICBjb250ZXh0LFxuICAgICAgKHdjbykgPT4ge1xuICAgICAgICAvLyBXZSB1c2UgdGhlIHBsYXRmb3JtIHRvIGRldGVybWluZSB0aGUgSmF2YVNjcmlwdCBzeW50YXggb3V0cHV0LlxuICAgICAgICB3Y28uYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzID8/PSBbXTtcbiAgICAgICAgd2NvLmJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2Vycy5wdXNoKC4uLmJyb3dzZXJzbGlzdCgnbWFpbnRhaW5lZCBub2RlIHZlcnNpb25zJykpO1xuXG4gICAgICAgIHJldHVybiBbZ2V0UGxhdGZvcm1TZXJ2ZXJFeHBvcnRzQ29uZmlnKHdjbyksIGdldENvbW1vbkNvbmZpZyh3Y28pLCBnZXRTdHlsZXNDb25maWcod2NvKV07XG4gICAgICB9LFxuICAgICk7XG5cbiAgaWYgKG9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aCkge1xuICAgIGRlbGV0ZU91dHB1dERpcihjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9yaWdpbmFsT3V0cHV0UGF0aCk7XG4gIH1cblxuICBjb25zdCB0cmFuc2Zvcm1lZENvbmZpZyA9IChhd2FpdCB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybT8uKGNvbmZpZykpID8/IGNvbmZpZztcblxuICByZXR1cm4geyBjb25maWc6IHRyYW5zZm9ybWVkQ29uZmlnLCBpMThuLCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QgfTtcbn1cblxuLyoqXG4gKiBBZGQgYEBhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcmAgZXhwb3J0cy5cbiAqIFRoaXMgaXMgbmVlZGVkIHNvIHRoYXQgREkgdG9rZW5zIGNhbiBiZSByZWZlcmVuY2VkIGFuZCBzZXQgYXQgcnVudGltZSBvdXRzaWRlIG9mIHRoZSBidW5kbGUuXG4gKi9cbmZ1bmN0aW9uIGdldFBsYXRmb3JtU2VydmVyRXhwb3J0c0NvbmZpZyh3Y286IEJyb3dzZXJXZWJwYWNrQ29uZmlnT3B0aW9ucyk6IFBhcnRpYWw8Q29uZmlndXJhdGlvbj4ge1xuICAvLyBBZGQgYEBhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcmAgZXhwb3J0cy5cbiAgLy8gVGhpcyBpcyBuZWVkZWQgc28gdGhhdCBESSB0b2tlbnMgY2FuIGJlIHJlZmVyZW5jZWQgYW5kIHNldCBhdCBydW50aW1lIG91dHNpZGUgb2YgdGhlIGJ1bmRsZS5cblxuICAvLyBPbmx5IGFkZCBgQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyYCBleHBvcnRzIHdoZW4gaXQgaXMgaW5zdGFsbGVkLlxuICAvLyBJbiBzb21lIGNhc2VzIHRoaXMgYnVpbGRlciBpcyB1c2VkIHdoZW4gYEBhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcmAgaXMgbm90IGluc3RhbGxlZC5cbiAgLy8gRXhhbXBsZTogd2hlbiB1c2luZyBgQG5ndW5pdmVyc2FsL2NvbW1vbi9jbG92ZXJgIHdoaWNoIGRvZXMgbm90IG5lZWQgYEBhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcmAuXG5cbiAgcmV0dXJuIGlzUGxhdGZvcm1TZXJ2ZXJJbnN0YWxsZWQod2NvLnJvb3QpXG4gICAgPyB7XG4gICAgICAgIG1vZHVsZToge1xuICAgICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGxvYWRlcjogcmVxdWlyZS5yZXNvbHZlKCcuL3BsYXRmb3JtLXNlcnZlci1leHBvcnRzLWxvYWRlcicpLFxuICAgICAgICAgICAgICBpbmNsdWRlOiBbcGF0aC5yZXNvbHZlKHdjby5yb290LCB3Y28uYnVpbGRPcHRpb25zLm1haW4pXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICA6IHt9O1xufVxuIl19