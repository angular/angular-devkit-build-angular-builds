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
const promises_1 = require("node:fs/promises");
const path = __importStar(require("node:path"));
const rxjs_1 = require("rxjs");
const configs_1 = require("../../tools/webpack/configs");
const helpers_1 = require("../../tools/webpack/utils/helpers");
const stats_1 = require("../../tools/webpack/utils/stats");
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
    await checkTsConfigForPreserveWhitespacesSetting(context, options.tsConfig);
    const browserslist = (await Promise.resolve().then(() => __importStar(require('browserslist')))).default;
    const originalOutputPath = options.outputPath;
    // Assets are processed directly by the builder except when watching
    const adjustedOptions = options.watch ? options : { ...options, assets: [] };
    const { config, projectRoot, projectSourceRoot, i18n } = await (0, webpack_browser_config_1.generateI18nBrowserWebpackConfigFromContext)({
        ...adjustedOptions,
        aot: true,
        platform: 'server',
    }, context, (wco) => {
        // We use the platform to determine the JavaScript syntax output.
        wco.buildOptions.supportedBrowsers ??= [];
        wco.buildOptions.supportedBrowsers.push(...browserslist('maintained node versions'));
        return [getPlatformServerExportsConfig(wco), (0, configs_1.getCommonConfig)(wco), (0, configs_1.getStylesConfig)(wco)];
    });
    if (options.deleteOutputPath) {
        (0, utils_1.deleteOutputDir)(context.workspaceRoot, originalOutputPath);
    }
    const transformedConfig = (await webpackConfigurationTransform?.(config)) ?? config;
    return { config: transformedConfig, i18n, projectRoot, projectSourceRoot };
}
async function checkTsConfigForPreserveWhitespacesSetting(context, tsConfigPath) {
    // We don't use the `readTsConfig` method on purpose here.
    // To only catch cases were `preserveWhitespaces` is set directly in the `tsconfig.server.json`,
    // which in the majority of cases will cause a mistmatch between client and server builds.
    // Technically we should check if `tsconfig.server.json` and `tsconfig.app.json` values match.
    // But:
    // 1. It is not guaranteed that `tsconfig.app.json` is used to build the client side of this app.
    // 2. There is no easy way to access the build build config from the server builder.
    // 4. This will no longer be an issue with a single compilation model were the same tsconfig is used for both browser and server builds.
    const content = await (0, promises_1.readFile)(path.join(context.workspaceRoot, tsConfigPath), 'utf-8');
    const { parse } = await Promise.resolve().then(() => __importStar(require('jsonc-parser')));
    const tsConfig = parse(content, [], { allowTrailingComma: true });
    if (tsConfig.angularCompilerOptions?.preserveWhitespaces !== undefined) {
        context.logger.warn(`"preserveWhitespaces" was set in "${tsConfigPath}". ` +
            'Make sure that this setting is set consistently in both "tsconfig.server.json" for your server side ' +
            'and "tsconfig.app.json" for your client side. A mismatched value will cause hydration to break.\n' +
            'For more information see: https://angular.io/guide/hydration#preserve-whitespaces');
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsaUVBQTJEO0FBQzNELCtDQUE0QztBQUM1QyxnREFBa0M7QUFDbEMsK0JBQW1EO0FBRW5ELHlEQUErRTtBQUMvRSwrREFBOEU7QUFDOUUsMkRBTXlDO0FBRXpDLHVDQUlxQjtBQUNyQiw2Q0FBMkM7QUFDM0MseURBQXFEO0FBQ3JELDZDQUFrRDtBQUNsRCw2REFBbUU7QUFFbkUsMkRBQTZEO0FBQzdELHlEQUErRDtBQUMvRCxpREFBOEM7QUFDOUMsaURBQXFFO0FBQ3JFLCtFQUc0QztBQWlCNUM7O0dBRUc7QUFDSCxTQUFnQixPQUFPLENBQ3JCLE9BQTZCLEVBQzdCLE9BQXVCLEVBQ3ZCLGFBRUksRUFBRTtJQUVOLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7SUFFbkMseUJBQXlCO0lBQ3pCLElBQUEsd0NBQThCLEVBQUMsSUFBSSxDQUFDLENBQUM7SUFFckMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzlELElBQUksV0FBNEMsQ0FBQztJQUVqRCxPQUFPLElBQUEsV0FBSSxFQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUM3RSxJQUFBLGdCQUFTLEVBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLGlCQUFpQixFQUFFLEVBQUUsRUFBRTtRQUM3RCxPQUFPLElB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LENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7cUJBQ3pEO2lCQUNGO2FBQ0Y7U0FDRjtRQUNILENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDVCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBydW5XZWJwYWNrIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLXdlYnBhY2snO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGNvbmNhdE1hcCwgZnJvbSB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHdlYnBhY2ssIHsgQ29uZmlndXJhdGlvbiB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgZ2V0Q29tbW9uQ29uZmlnLCBnZXRTdHlsZXNDb25maWcgfSBmcm9tICcuLi8uLi90b29scy93ZWJwYWNrL2NvbmZpZ3MnO1xuaW1wb3J0IHsgaXNQbGF0Zm9ybVNlcnZlckluc3RhbGxlZCB9IGZyb20gJy4uLy4uL3Rvb2xzL3dlYnBhY2svdXRpbHMvaGVscGVycyc7XG5pbXBvcnQge1xuICBzdGF0c0Vycm9yc1RvU3RyaW5nLFxuICBzdGF0c0hhc0Vycm9ycyxcbiAgc3RhdHNIYXNXYXJuaW5ncyxcbiAgc3RhdHNXYXJuaW5nc1RvU3RyaW5nLFxuICB3ZWJwYWNrU3RhdHNMb2dnZXIsXG59IGZyb20gJy4uLy4uL3Rvb2xzL3dlYnBhY2svdXRpbHMvc3RhdHMnO1xuaW1wb3J0IHsgRXhlY3V0aW9uVHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7XG4gIE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgZGVsZXRlT3V0cHV0RGlyLFxuICBub3JtYWxpemVBc3NldFBhdHRlcm5zLFxufSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBjb2xvcnMgfSBmcm9tICcuLi8uLi91dGlscy9jb2xvcic7XG5pbXBvcnQgeyBjb3B5QXNzZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29weS1hc3NldHMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNFcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9yJztcbmltcG9ydCB7IGkxOG5JbmxpbmVFbWl0dGVkRmlsZXMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLWlubGluaW5nJztcbmltcG9ydCB7IEkxOG5PcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IGVuc3VyZU91dHB1dFBhdGhzIH0gZnJvbSAnLi4vLi4vdXRpbHMvb3V0cHV0LXBhdGhzJztcbmltcG9ydCB7IHB1cmdlU3RhbGVCdWlsZENhY2hlIH0gZnJvbSAnLi4vLi4vdXRpbHMvcHVyZ2UtY2FjaGUnO1xuaW1wb3J0IHsgU3Bpbm5lciB9IGZyb20gJy4uLy4uL3V0aWxzL3NwaW5uZXInO1xuaW1wb3J0IHsgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvdmVyc2lvbic7XG5pbXBvcnQge1xuICBCcm93c2VyV2VicGFja0NvbmZpZ09wdGlvbnMsXG4gIGdlbmVyYXRlSTE4bkJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQsXG59IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIFNlcnZlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgdHlwZSBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuZXhwb3J0IHR5cGUgU2VydmVyQnVpbGRlck91dHB1dCA9IEJ1aWxkZXJPdXRwdXQgJiB7XG4gIGJhc2VPdXRwdXRQYXRoOiBzdHJpbmc7XG4gIG91dHB1dFBhdGg6IHN0cmluZztcbiAgb3V0cHV0czoge1xuICAgIGxvY2FsZT86IHN0cmluZztcbiAgICBwYXRoOiBzdHJpbmc7XG4gIH1bXTtcbn07XG5cbmV4cG9ydCB7IFNlcnZlckJ1aWxkZXJPcHRpb25zIH07XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IFNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgdHJhbnNmb3Jtczoge1xuICAgIHdlYnBhY2tDb25maWd1cmF0aW9uPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8d2VicGFjay5Db25maWd1cmF0aW9uPjtcbiAgfSA9IHt9LFxuKTogT2JzZXJ2YWJsZTxTZXJ2ZXJCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnN0IHJvb3QgPSBjb250ZXh0LndvcmtzcGFjZVJvb3Q7XG5cbiAgLy8gQ2hlY2sgQW5ndWxhciB2ZXJzaW9uLlxuICBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24ocm9vdCk7XG5cbiAgY29uc3QgYmFzZU91dHB1dFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgb3B0aW9ucy5vdXRwdXRQYXRoKTtcbiAgbGV0IG91dHB1dFBhdGhzOiB1bmRlZmluZWQgfCBNYXA8c3RyaW5nLCBzdHJpbmc+O1xuXG4gIHJldHVybiBmcm9tKGluaXRpYWxpemUob3B0aW9ucywgY29udGV4dCwgdHJhbnNmb3Jtcy53ZWJwYWNrQ29uZmlndXJhdGlvbikpLnBpcGUoXG4gICAgY29uY2F0TWFwKCh7IGNvbmZpZywgaTE4biwgcHJvamVjdFJvb3QsIHByb2plY3RTb3VyY2VSb290IH0pID0+IHtcbiAgICAgIHJldHVybiBydW5XZWJwYWNrKGNvbmZpZywgY29udGV4dCwge1xuICAgICAgICB3ZWJwYWNrRmFjdG9yeTogcmVxdWlyZSgnd2VicGFjaycpIGFzIHR5cGVvZiB3ZWJwYWNrLFxuICAgICAgICBsb2dnaW5nOiAoc3RhdHMsIGNvbmZpZykgPT4ge1xuICAgICAgICAgIGlmIChvcHRpb25zLnZlcmJvc2UpIHtcbiAgICAgICAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oc3RhdHMudG9TdHJpbmcoY29uZmlnLnN0YXRzKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgfSkucGlwZShcbiAgICAgICAgY29uY2F0TWFwKGFzeW5jIChvdXRwdXQpID0+IHtcbiAgICAgICAgICBjb25zdCB7IGVtaXR0ZWRGaWxlcyA9IFtdLCBvdXRwdXRQYXRoLCB3ZWJwYWNrU3RhdHMsIHN1Y2Nlc3MgfSA9IG91dHB1dDtcbiAgICAgICAgICBpZiAoIXdlYnBhY2tTdGF0cykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdXZWJwYWNrIHN0YXRzIGJ1aWxkIHJlc3VsdCBpcyByZXF1aXJlZC4nKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIGlmIChzdGF0c0hhc1dhcm5pbmdzKHdlYnBhY2tTdGF0cykpIHtcbiAgICAgICAgICAgICAgY29udGV4dC5sb2dnZXIud2FybihzdGF0c1dhcm5pbmdzVG9TdHJpbmcod2VicGFja1N0YXRzLCB7IGNvbG9yczogdHJ1ZSB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3RhdHNIYXNFcnJvcnMod2VicGFja1N0YXRzKSkge1xuICAgICAgICAgICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihzdGF0c0Vycm9yc1RvU3RyaW5nKHdlYnBhY2tTdGF0cywgeyBjb2xvcnM6IHRydWUgfSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcigpO1xuICAgICAgICAgIHNwaW5uZXIuZW5hYmxlZCA9IG9wdGlvbnMucHJvZ3Jlc3MgIT09IGZhbHNlO1xuICAgICAgICAgIG91dHB1dFBhdGhzID0gZW5zdXJlT3V0cHV0UGF0aHMoYmFzZU91dHB1dFBhdGgsIGkxOG4pO1xuXG4gICAgICAgICAgLy8gQ29weSBhc3NldHNcbiAgICAgICAgICBpZiAoIW9wdGlvbnMud2F0Y2ggJiYgb3B0aW9ucy5hc3NldHM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgc3Bpbm5lci5zdGFydCgnQ29weWluZyBhc3NldHMuLi4nKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGF3YWl0IGNvcHlBc3NldHMoXG4gICAgICAgICAgICAgICAgbm9ybWFsaXplQXNzZXRQYXR0ZXJucyhcbiAgICAgICAgICAgICAgICAgIG9wdGlvbnMuYXNzZXRzLFxuICAgICAgICAgICAgICAgICAgY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgICAgICAgICAgICAgcHJvamVjdFJvb3QsXG4gICAgICAgICAgICAgICAgICBwcm9qZWN0U291cmNlUm9vdCxcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIEFycmF5LmZyb20ob3V0cHV0UGF0aHMudmFsdWVzKCkpLFxuICAgICAgICAgICAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgc3Bpbm5lci5zdWNjZWVkKCdDb3B5aW5nIGFzc2V0cyBjb21wbGV0ZS4nKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICBzcGlubmVyLmZhaWwoY29sb3JzLnJlZEJyaWdodCgnQ29weWluZyBvZiBhc3NldHMgZmFpbGVkLicpKTtcbiAgICAgICAgICAgICAgYXNzZXJ0SXNFcnJvcihlcnIpO1xuXG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgLi4ub3V0cHV0LFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiAnVW5hYmxlIHRvIGNvcHkgYXNzZXRzOiAnICsgZXJyLm1lc3NhZ2UsXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGkxOG4uc2hvdWxkSW5saW5lKSB7XG4gICAgICAgICAgICBjb25zdCBzdWNjZXNzID0gYXdhaXQgaTE4bklubGluZUVtaXR0ZWRGaWxlcyhcbiAgICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgICAgZW1pdHRlZEZpbGVzLFxuICAgICAgICAgICAgICBpMThuLFxuICAgICAgICAgICAgICBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgQXJyYXkuZnJvbShvdXRwdXRQYXRocy52YWx1ZXMoKSksXG4gICAgICAgICAgICAgIFtdLFxuICAgICAgICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICAgICAgICBvcHRpb25zLmkxOG5NaXNzaW5nVHJhbnNsYXRpb24sXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgLi4ub3V0cHV0LFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHdlYnBhY2tTdGF0c0xvZ2dlcihjb250ZXh0LmxvZ2dlciwgd2VicGFja1N0YXRzLCBjb25maWcpO1xuXG4gICAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH0pLFxuICAgIGNvbmNhdE1hcChhc3luYyAob3V0cHV0KSA9PiB7XG4gICAgICBpZiAoIW91dHB1dC5zdWNjZXNzKSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQgYXMgU2VydmVyQnVpbGRlck91dHB1dDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4ub3V0cHV0LFxuICAgICAgICBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgb3V0cHV0czogKG91dHB1dFBhdGhzICYmXG4gICAgICAgICAgWy4uLm91dHB1dFBhdGhzLmVudHJpZXMoKV0ubWFwKChbbG9jYWxlLCBwYXRoXSkgPT4gKHtcbiAgICAgICAgICAgIGxvY2FsZSxcbiAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgfSkpKSB8fCB7XG4gICAgICAgICAgcGF0aDogYmFzZU91dHB1dFBhdGgsXG4gICAgICAgIH0sXG4gICAgICB9IGFzIFNlcnZlckJ1aWxkZXJPdXRwdXQ7XG4gICAgfSksXG4gICk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXI8U2VydmVyQnVpbGRlck9wdGlvbnMsIFNlcnZlckJ1aWxkZXJPdXRwdXQ+KGV4ZWN1dGUpO1xuXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplKFxuICBvcHRpb25zOiBTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8d2VicGFjay5Db25maWd1cmF0aW9uPixcbik6IFByb21pc2U8e1xuICBjb25maWc6IHdlYnBhY2suQ29uZmlndXJhdGlvbjtcbiAgaTE4bjogSTE4bk9wdGlvbnM7XG4gIHByb2plY3RSb290OiBzdHJpbmc7XG4gIHByb2plY3RTb3VyY2VSb290Pzogc3RyaW5nO1xufT4ge1xuICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgYXdhaXQgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUoY29udGV4dCk7XG5cbiAgYXdhaXQgY2hlY2tUc0NvbmZpZ0ZvclByZXNlcnZlV2hpdGVzcGFjZXNTZXR0aW5nKGNvbnRleHQsIG9wdGlvbnMudHNDb25maWcpO1xuXG4gIGNvbnN0IGJyb3dzZXJzbGlzdCA9IChhd2FpdCBpbXBvcnQoJ2Jyb3dzZXJzbGlzdCcpKS5kZWZhdWx0O1xuICBjb25zdCBvcmlnaW5hbE91dHB1dFBhdGggPSBvcHRpb25zLm91dHB1dFBhdGg7XG4gIC8vIEFzc2V0cyBhcmUgcHJvY2Vzc2VkIGRpcmVjdGx5IGJ5IHRoZSBidWlsZGVyIGV4Y2VwdCB3aGVuIHdhdGNoaW5nXG4gIGNvbnN0IGFkanVzdGVkT3B0aW9ucyA9IG9wdGlvbnMud2F0Y2ggPyBvcHRpb25zIDogeyAuLi5vcHRpb25zLCBhc3NldHM6IFtdIH07XG5cbiAgY29uc3QgeyBjb25maWcsIHByb2plY3RSb290LCBwcm9qZWN0U291cmNlUm9vdCwgaTE4biB9ID1cbiAgICBhd2FpdCBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KFxuICAgICAge1xuICAgICAgICAuLi5hZGp1c3RlZE9wdGlvbnMsXG4gICAgICAgIGFvdDogdHJ1ZSxcbiAgICAgICAgcGxhdGZvcm06ICdzZXJ2ZXInLFxuICAgICAgfSBhcyBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICAgICBjb250ZXh0LFxuICAgICAgKHdjbykgPT4ge1xuICAgICAgICAvLyBXZSB1c2UgdGhlIHBsYXRmb3JtIHRvIGRldGVybWluZSB0aGUgSmF2YVNjcmlwdCBzeW50YXggb3V0cHV0LlxuICAgICAgICB3Y28uYnVpbGRPcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzID8/PSBbXTtcbiAgICAgICAgd2NvLmJ1aWxkT3B0aW9ucy5zdXBwb3J0ZWRCcm93c2Vycy5wdXNoKC4uLmJyb3dzZXJzbGlzdCgnbWFpbnRhaW5lZCBub2RlIHZlcnNpb25zJykpO1xuXG4gICAgICAgIHJldHVybiBbZ2V0UGxhdGZvcm1TZXJ2ZXJFeHBvcnRzQ29uZmlnKHdjbyksIGdldENvbW1vbkNvbmZpZyh3Y28pLCBnZXRTdHlsZXNDb25maWcod2NvKV07XG4gICAgICB9LFxuICAgICk7XG5cbiAgaWYgKG9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aCkge1xuICAgIGRlbGV0ZU91dHB1dERpcihjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9yaWdpbmFsT3V0cHV0UGF0aCk7XG4gIH1cblxuICBjb25zdCB0cmFuc2Zvcm1lZENvbmZpZyA9IChhd2FpdCB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybT8uKGNvbmZpZykpID8/IGNvbmZpZztcblxuICByZXR1cm4geyBjb25maWc6IHRyYW5zZm9ybWVkQ29uZmlnLCBpMThuLCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tUc0NvbmZpZ0ZvclByZXNlcnZlV2hpdGVzcGFjZXNTZXR0aW5nKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgdHNDb25maWdQYXRoOiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgLy8gV2UgZG9uJ3QgdXNlIHRoZSBgcmVhZFRzQ29uZmlnYCBtZXRob2Qgb24gcHVycG9zZSBoZXJlLlxuICAvLyBUbyBvbmx5IGNhdGNoIGNhc2VzIHdlcmUgYHByZXNlcnZlV2hpdGVzcGFjZXNgIGlzIHNldCBkaXJlY3RseSBpbiB0aGUgYHRzY29uZmlnLnNlcnZlci5qc29uYCxcbiAgLy8gd2hpY2ggaW4gdGhlIG1ham9yaXR5IG9mIGNhc2VzIHdpbGwgY2F1c2UgYSBtaXN0bWF0Y2ggYmV0d2VlbiBjbGllbnQgYW5kIHNlcnZlciBidWlsZHMuXG4gIC8vIFRlY2huaWNhbGx5IHdlIHNob3VsZCBjaGVjayBpZiBgdHNjb25maWcuc2VydmVyLmpzb25gIGFuZCBgdHNjb25maWcuYXBwLmpzb25gIHZhbHVlcyBtYXRjaC5cblxuICAvLyBCdXQ6XG4gIC8vIDEuIEl0IGlzIG5vdCBndWFyYW50ZWVkIHRoYXQgYHRzY29uZmlnLmFwcC5qc29uYCBpcyB1c2VkIHRvIGJ1aWxkIHRoZSBjbGllbnQgc2lkZSBvZiB0aGlzIGFwcC5cbiAgLy8gMi4gVGhlcmUgaXMgbm8gZWFzeSB3YXkgdG8gYWNjZXNzIHRoZSBidWlsZCBidWlsZCBjb25maWcgZnJvbSB0aGUgc2VydmVyIGJ1aWxkZXIuXG4gIC8vIDQuIFRoaXMgd2lsbCBubyBsb25nZXIgYmUgYW4gaXNzdWUgd2l0aCBhIHNpbmdsZSBjb21waWxhdGlvbiBtb2RlbCB3ZXJlIHRoZSBzYW1lIHRzY29uZmlnIGlzIHVzZWQgZm9yIGJvdGggYnJvd3NlciBhbmQgc2VydmVyIGJ1aWxkcy5cbiAgY29uc3QgY29udGVudCA9IGF3YWl0IHJlYWRGaWxlKHBhdGguam9pbihjb250ZXh0LndvcmtzcGFjZVJvb3QsIHRzQ29uZmlnUGF0aCksICd1dGYtOCcpO1xuICBjb25zdCB7IHBhcnNlIH0gPSBhd2FpdCBpbXBvcnQoJ2pzb25jLXBhcnNlcicpO1xuICBjb25zdCB0c0NvbmZpZyA9IHBhcnNlKGNvbnRlbnQsIFtdLCB7IGFsbG93VHJhaWxpbmdDb21tYTogdHJ1ZSB9KTtcbiAgaWYgKHRzQ29uZmlnLmFuZ3VsYXJDb21waWxlck9wdGlvbnM/LnByZXNlcnZlV2hpdGVzcGFjZXMgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICBgXCJwcmVzZXJ2ZVdoaXRlc3BhY2VzXCIgd2FzIHNldCBpbiBcIiR7dHNDb25maWdQYXRofVwiLiBgICtcbiAgICAgICAgJ01ha2Ugc3VyZSB0aGF0IHRoaXMgc2V0dGluZyBpcyBzZXQgY29uc2lzdGVudGx5IGluIGJvdGggXCJ0c2NvbmZpZy5zZXJ2ZXIuanNvblwiIGZvciB5b3VyIHNlcnZlciBzaWRlICcgK1xuICAgICAgICAnYW5kIFwidHNjb25maWcuYXBwLmpzb25cIiBmb3IgeW91ciBjbGllbnQgc2lkZS4gQSBtaXNtYXRjaGVkIHZhbHVlIHdpbGwgY2F1c2UgaHlkcmF0aW9uIHRvIGJyZWFrLlxcbicgK1xuICAgICAgICAnRm9yIG1vcmUgaW5mb3JtYXRpb24gc2VlOiBodHRwczovL2FuZ3VsYXIuaW8vZ3VpZGUvaHlkcmF0aW9uI3ByZXNlcnZlLXdoaXRlc3BhY2VzJyxcbiAgICApO1xuICB9XG59XG5cbi8qKlxuICogQWRkIGBAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXJgIGV4cG9ydHMuXG4gKiBUaGlzIGlzIG5lZWRlZCBzbyB0aGF0IERJIHRva2VucyBjYW4gYmUgcmVmZXJlbmNlZCBhbmQgc2V0IGF0IHJ1bnRpbWUgb3V0c2lkZSBvZiB0aGUgYnVuZGxlLlxuICovXG5mdW5jdGlvbiBnZXRQbGF0Zm9ybVNlcnZlckV4cG9ydHNDb25maWcod2NvOiBCcm93c2VyV2VicGFja0NvbmZpZ09wdGlvbnMpOiBQYXJ0aWFsPENvbmZpZ3VyYXRpb24+IHtcbiAgLy8gQWRkIGBAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXJgIGV4cG9ydHMuXG4gIC8vIFRoaXMgaXMgbmVlZGVkIHNvIHRoYXQgREkgdG9rZW5zIGNhbiBiZSByZWZlcmVuY2VkIGFuZCBzZXQgYXQgcnVudGltZSBvdXRzaWRlIG9mIHRoZSBidW5kbGUuXG5cbiAgLy8gT25seSBhZGQgYEBhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcmAgZXhwb3J0cyB3aGVuIGl0IGlzIGluc3RhbGxlZC5cbiAgLy8gSW4gc29tZSBjYXNlcyB0aGlzIGJ1aWxkZXIgaXMgdXNlZCB3aGVuIGBAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXJgIGlzIG5vdCBpbnN0YWxsZWQuXG4gIC8vIEV4YW1wbGU6IHdoZW4gdXNpbmcgYEBuZ3VuaXZlcnNhbC9jb21tb24vY2xvdmVyYCB3aGljaCBkb2VzIG5vdCBuZWVkIGBAYW5ndWxhci9wbGF0Zm9ybS1zZXJ2ZXJgLlxuXG4gIHJldHVybiBpc1BsYXRmb3JtU2VydmVySW5zdGFsbGVkKHdjby5yb290KVxuICAgID8ge1xuICAgICAgICBtb2R1bGU6IHtcbiAgICAgICAgICBydWxlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBsb2FkZXI6IHJlcXVpcmUucmVzb2x2ZSgnLi9wbGF0Zm9ybS1zZXJ2ZXItZXhwb3J0cy1sb2FkZXInKSxcbiAgICAgICAgICAgICAgaW5jbHVkZTogW3BhdGgucmVzb2x2ZSh3Y28ucm9vdCwgd2NvLmJ1aWxkT3B0aW9ucy5tYWluKV0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgOiB7fTtcbn1cbiJdfQ==