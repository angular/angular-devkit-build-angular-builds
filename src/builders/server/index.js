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
const i18n_inlining_1 = require("../../utils/i18n-inlining");
const output_paths_1 = require("../../utils/output-paths");
const purge_cache_1 = require("../../utils/purge-cache");
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
    return (0, rxjs_1.from)(initialize(options, context, transforms.webpackConfiguration)).pipe((0, operators_1.concatMap)(({ config, i18n }) => {
        return (0, build_webpack_1.runWebpack)(config, context, {
            webpackFactory: require('webpack'),
            logging: (stats, config) => {
                if (options.verbose) {
                    context.logger.info(stats.toString(config.stats));
                }
            },
        }).pipe((0, operators_1.concatMap)(async (output) => {
            const { emittedFiles = [], outputPath, webpackStats } = output;
            if (!webpackStats) {
                throw new Error('Webpack stats build result is required.');
            }
            let success = output.success;
            if (success && i18n.shouldInline) {
                outputPaths = (0, output_paths_1.ensureOutputPaths)(baseOutputPath, i18n);
                success = await (0, i18n_inlining_1.i18nInlineEmittedFiles)(context, emittedFiles, i18n, baseOutputPath, Array.from(outputPaths.values()), [], outputPath, options.i18nMissingTranslation);
            }
            (0, stats_1.webpackStatsLogger)(context.logger, webpackStats, config);
            return { ...output, success };
        }));
    }), (0, operators_1.map)((output) => {
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
    const { config, i18n } = await (0, webpack_browser_config_1.generateI18nBrowserWebpackConfigFromContext)({
        ...options,
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
    return { config: transformedConfig, i18n };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsaUVBQTJEO0FBQzNELDJDQUE2QjtBQUM3QiwrQkFBd0M7QUFDeEMsOENBQWdEO0FBR2hELHVDQUE4RTtBQUM5RSw2REFBbUU7QUFFbkUsMkRBQTZEO0FBQzdELHlEQUErRDtBQUMvRCxpREFBcUU7QUFDckUsK0VBRzRDO0FBQzVDLG1EQUF5RTtBQUN6RSx5REFBd0U7QUFDeEUscURBQStEO0FBeUIvRDs7R0FFRztBQUNILFNBQWdCLE9BQU8sQ0FDckIsT0FBNkIsRUFDN0IsT0FBdUIsRUFDdkIsYUFFSSxFQUFFO0lBRU4sTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUVuQyx5QkFBeUI7SUFDekIsSUFBQSx3Q0FBOEIsRUFBQyxJQUFJLENBQUMsQ0FBQztJQUVyQyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDOUQsSUFBSSxXQUE0QyxDQUFDO0lBRWpELE9BQU8sSUFBQSxXQUFJLEVBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsVUFBVSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQzdFLElBQUEscUJBQVMsRUFBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUU7UUFDN0IsT0FBTyxJQUFBLDBCQUFVLEVBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRTtZQUNqQyxjQUFjLEVBQUUsT0FBTyxDQUFDLFNBQVMsQ0FBbUI7WUFD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QUMsQ0FBQztxQkFDekQ7aUJBQ0Y7YUFDRjtTQUNGO1FBQ0gsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUNULENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IHJ1bldlYnBhY2sgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgd2VicGFjaywgeyBDb25maWd1cmF0aW9uIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBFeGVjdXRpb25UcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHsgTm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hLCBkZWxldGVPdXRwdXREaXIgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBpMThuSW5saW5lRW1pdHRlZEZpbGVzIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1pbmxpbmluZyc7XG5pbXBvcnQgeyBJMThuT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2kxOG4tb3B0aW9ucyc7XG5pbXBvcnQgeyBlbnN1cmVPdXRwdXRQYXRocyB9IGZyb20gJy4uLy4uL3V0aWxzL291dHB1dC1wYXRocyc7XG5pbXBvcnQgeyBwdXJnZVN0YWxlQnVpbGRDYWNoZSB9IGZyb20gJy4uLy4uL3V0aWxzL3B1cmdlLWNhY2hlJztcbmltcG9ydCB7IGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbiB9IGZyb20gJy4uLy4uL3V0aWxzL3ZlcnNpb24nO1xuaW1wb3J0IHtcbiAgQnJvd3NlcldlYnBhY2tDb25maWdPcHRpb25zLFxuICBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0LFxufSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IGdldENvbW1vbkNvbmZpZywgZ2V0U3R5bGVzQ29uZmlnIH0gZnJvbSAnLi4vLi4vd2VicGFjay9jb25maWdzJztcbmltcG9ydCB7IGlzUGxhdGZvcm1TZXJ2ZXJJbnN0YWxsZWQgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL2hlbHBlcnMnO1xuaW1wb3J0IHsgd2VicGFja1N0YXRzTG9nZ2VyIH0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgU2VydmVyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyB0eXBlIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgdHlwZSBTZXJ2ZXJCdWlsZGVyT3V0cHV0ID0gQnVpbGRlck91dHB1dCAmIHtcbiAgYmFzZU91dHB1dFBhdGg6IHN0cmluZztcbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIGluIHZlcnNpb24gMTQuIFVzZSAnb3V0cHV0cycgaW5zdGVhZC5cbiAgICovXG4gIG91dHB1dFBhdGhzOiBzdHJpbmdbXTtcbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIGluIHZlcnNpb24gOS4gVXNlICdvdXRwdXRzJyBpbnN0ZWFkLlxuICAgKi9cbiAgb3V0cHV0UGF0aDogc3RyaW5nO1xuXG4gIG91dHB1dHM6IHtcbiAgICBsb2NhbGU/OiBzdHJpbmc7XG4gICAgcGF0aDogc3RyaW5nO1xuICB9W107XG59O1xuXG5leHBvcnQgeyBTZXJ2ZXJCdWlsZGVyT3B0aW9ucyB9O1xuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleGVjdXRlKFxuICBvcHRpb25zOiBTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHRyYW5zZm9ybXM6IHtcbiAgICB3ZWJwYWNrQ29uZmlndXJhdGlvbj86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPHdlYnBhY2suQ29uZmlndXJhdGlvbj47XG4gIH0gPSB7fSxcbik6IE9ic2VydmFibGU8U2VydmVyQnVpbGRlck91dHB1dD4ge1xuICBjb25zdCByb290ID0gY29udGV4dC53b3Jrc3BhY2VSb290O1xuXG4gIC8vIENoZWNrIEFuZ3VsYXIgdmVyc2lvbi5cbiAgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uKHJvb3QpO1xuXG4gIGNvbnN0IGJhc2VPdXRwdXRQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIG9wdGlvbnMub3V0cHV0UGF0aCk7XG4gIGxldCBvdXRwdXRQYXRoczogdW5kZWZpbmVkIHwgTWFwPHN0cmluZywgc3RyaW5nPjtcblxuICByZXR1cm4gZnJvbShpbml0aWFsaXplKG9wdGlvbnMsIGNvbnRleHQsIHRyYW5zZm9ybXMud2VicGFja0NvbmZpZ3VyYXRpb24pKS5waXBlKFxuICAgIGNvbmNhdE1hcCgoeyBjb25maWcsIGkxOG4gfSkgPT4ge1xuICAgICAgcmV0dXJuIHJ1bldlYnBhY2soY29uZmlnLCBjb250ZXh0LCB7XG4gICAgICAgIHdlYnBhY2tGYWN0b3J5OiByZXF1aXJlKCd3ZWJwYWNrJykgYXMgdHlwZW9mIHdlYnBhY2ssXG4gICAgICAgIGxvZ2dpbmc6IChzdGF0cywgY29uZmlnKSA9PiB7XG4gICAgICAgICAgaWYgKG9wdGlvbnMudmVyYm9zZSkge1xuICAgICAgICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhzdGF0cy50b1N0cmluZyhjb25maWcuc3RhdHMpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9KS5waXBlKFxuICAgICAgICBjb25jYXRNYXAoYXN5bmMgKG91dHB1dCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHsgZW1pdHRlZEZpbGVzID0gW10sIG91dHB1dFBhdGgsIHdlYnBhY2tTdGF0cyB9ID0gb3V0cHV0O1xuICAgICAgICAgIGlmICghd2VicGFja1N0YXRzKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYnBhY2sgc3RhdHMgYnVpbGQgcmVzdWx0IGlzIHJlcXVpcmVkLicpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxldCBzdWNjZXNzID0gb3V0cHV0LnN1Y2Nlc3M7XG4gICAgICAgICAgaWYgKHN1Y2Nlc3MgJiYgaTE4bi5zaG91bGRJbmxpbmUpIHtcbiAgICAgICAgICAgIG91dHB1dFBhdGhzID0gZW5zdXJlT3V0cHV0UGF0aHMoYmFzZU91dHB1dFBhdGgsIGkxOG4pO1xuXG4gICAgICAgICAgICBzdWNjZXNzID0gYXdhaXQgaTE4bklubGluZUVtaXR0ZWRGaWxlcyhcbiAgICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgICAgZW1pdHRlZEZpbGVzLFxuICAgICAgICAgICAgICBpMThuLFxuICAgICAgICAgICAgICBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgQXJyYXkuZnJvbShvdXRwdXRQYXRocy52YWx1ZXMoKSksXG4gICAgICAgICAgICAgIFtdLFxuICAgICAgICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICAgICAgICBvcHRpb25zLmkxOG5NaXNzaW5nVHJhbnNsYXRpb24sXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHdlYnBhY2tTdGF0c0xvZ2dlcihjb250ZXh0LmxvZ2dlciwgd2VicGFja1N0YXRzLCBjb25maWcpO1xuXG4gICAgICAgICAgcmV0dXJuIHsgLi4ub3V0cHV0LCBzdWNjZXNzIH07XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9KSxcbiAgICBtYXAoKG91dHB1dCkgPT4ge1xuICAgICAgaWYgKCFvdXRwdXQuc3VjY2Vzcykge1xuICAgICAgICByZXR1cm4gb3V0cHV0IGFzIFNlcnZlckJ1aWxkZXJPdXRwdXQ7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIC4uLm91dHB1dCxcbiAgICAgICAgYmFzZU91dHB1dFBhdGgsXG4gICAgICAgIG91dHB1dFBhdGg6IGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICBvdXRwdXRQYXRoczogb3V0cHV0UGF0aHMgfHwgW2Jhc2VPdXRwdXRQYXRoXSxcbiAgICAgICAgb3V0cHV0czogKG91dHB1dFBhdGhzICYmXG4gICAgICAgICAgWy4uLm91dHB1dFBhdGhzLmVudHJpZXMoKV0ubWFwKChbbG9jYWxlLCBwYXRoXSkgPT4gKHtcbiAgICAgICAgICAgIGxvY2FsZSxcbiAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgfSkpKSB8fCB7XG4gICAgICAgICAgcGF0aDogYmFzZU91dHB1dFBhdGgsXG4gICAgICAgIH0sXG4gICAgICB9IGFzIFNlcnZlckJ1aWxkZXJPdXRwdXQ7XG4gICAgfSksXG4gICk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXI8U2VydmVyQnVpbGRlck9wdGlvbnMsIFNlcnZlckJ1aWxkZXJPdXRwdXQ+KGV4ZWN1dGUpO1xuXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplKFxuICBvcHRpb25zOiBTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8d2VicGFjay5Db25maWd1cmF0aW9uPixcbik6IFByb21pc2U8e1xuICBjb25maWc6IHdlYnBhY2suQ29uZmlndXJhdGlvbjtcbiAgaTE4bjogSTE4bk9wdGlvbnM7XG59PiB7XG4gIC8vIFB1cmdlIG9sZCBidWlsZCBkaXNrIGNhY2hlLlxuICBhd2FpdCBwdXJnZVN0YWxlQnVpbGRDYWNoZShjb250ZXh0KTtcblxuICBjb25zdCBicm93c2Vyc2xpc3QgPSAoYXdhaXQgaW1wb3J0KCdicm93c2Vyc2xpc3QnKSkuZGVmYXVsdDtcbiAgY29uc3Qgb3JpZ2luYWxPdXRwdXRQYXRoID0gb3B0aW9ucy5vdXRwdXRQYXRoO1xuICBjb25zdCB7IGNvbmZpZywgaTE4biB9ID0gYXdhaXQgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChcbiAgICB7XG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgYnVpbGRPcHRpbWl6ZXI6IGZhbHNlLFxuICAgICAgYW90OiB0cnVlLFxuICAgICAgcGxhdGZvcm06ICdzZXJ2ZXInLFxuICAgIH0gYXMgTm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICAgIGNvbnRleHQsXG4gICAgKHdjbykgPT4ge1xuICAgICAgLy8gV2UgdXNlIHRoZSBwbGF0Zm9ybSB0byBkZXRlcm1pbmUgdGhlIEphdmFTY3JpcHQgc3ludGF4IG91dHB1dC5cbiAgICAgIHdjby5idWlsZE9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMgPz89IFtdO1xuICAgICAgd2NvLmJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2Vycy5wdXNoKC4uLmJyb3dzZXJzbGlzdCgnbWFpbnRhaW5lZCBub2RlIHZlcnNpb25zJykpO1xuXG4gICAgICByZXR1cm4gW2dldFBsYXRmb3JtU2VydmVyRXhwb3J0c0NvbmZpZyh3Y28pLCBnZXRDb21tb25Db25maWcod2NvKSwgZ2V0U3R5bGVzQ29uZmlnKHdjbyldO1xuICAgIH0sXG4gICk7XG5cbiAgaWYgKG9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aCkge1xuICAgIGRlbGV0ZU91dHB1dERpcihjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9yaWdpbmFsT3V0cHV0UGF0aCk7XG4gIH1cblxuICBjb25zdCB0cmFuc2Zvcm1lZENvbmZpZyA9IChhd2FpdCB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybT8uKGNvbmZpZykpID8/IGNvbmZpZztcblxuICByZXR1cm4geyBjb25maWc6IHRyYW5zZm9ybWVkQ29uZmlnLCBpMThuIH07XG59XG5cbi8qKlxuICogQWRkIGBAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXJgIGV4cG9ydHMuXG4gKiBUaGlzIGlzIG5lZWRlZCBzbyB0aGF0IERJIHRva2VucyBjYW4gYmUgcmVmZXJlbmNlZCBhbmQgc2V0IGF0IHJ1bnRpbWUgb3V0c2lkZSBvZiB0aGUgYnVuZGxlLlxuICovXG5mdW5jdGlvbiBnZXRQbGF0Zm9ybVNlcnZlckV4cG9ydHNDb25maWcod2NvOiBCcm93c2VyV2VicGFja0NvbmZpZ09wdGlvbnMpOiBQYXJ0aWFsPENvbmZpZ3VyYXRpb24+IHtcbiAgLy8gQWRkIGBAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXJgIGV4cG9ydHMuXG4gIC8vIFRoaXMgaXMgbmVlZGVkIHNvIHRoYXQgREkgdG9rZW5zIGNhbiBiZSByZWZlcmVuY2VkIGFuZCBzZXQgYXQgcnVudGltZSBvdXRzaWRlIG9mIHRoZSBidW5kbGUuXG5cbiAgLy8gT25seSBhZGQgYEBhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcmAgZXhwb3J0cyB3aGVuIGl0IGlzIGluc3RhbGxlZC5cbiAgLy8gSW4gc29tZSBjYXNlcyB0aGlzIGJ1aWxkZXIgaXMgdXNlZCB3aGVuIGBAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXJgIGlzIG5vdCBpbnN0YWxsZWQuXG4gIC8vIEV4YW1wbGU6IHdoZW4gdXNpbmcgYEBuZ3VuaXZlcnNhbC9jb21tb24vY2xvdmVyYCB3aGljaCBkb2VzIG5vdCBuZWVkIGBAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXJgLlxuXG4gIHJldHVybiBpc1BsYXRmb3JtU2VydmVySW5zdGFsbGVkKHdjby5yb290KVxuICAgID8ge1xuICAgICAgICBtb2R1bGU6IHtcbiAgICAgICAgICBydWxlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnLi9wbGF0Zm9ybS1zZXJ2ZXItZXhwb3J0cy1sb2FkZXInKSxcbiAgICAgICAgICAgICAgaW5jbHVkZTogW3BhdGgucmVzb2x2ZSh3Y28ucm9vdCwgd2NvLmJ1aWxkT3B0aW9ucy5tYWluKV0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgOiB7fTtcbn1cbiJdfQ==