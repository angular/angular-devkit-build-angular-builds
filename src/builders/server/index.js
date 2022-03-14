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
exports.execute = void 0;
const architect_1 = require("@angular-devkit/architect");
const build_webpack_1 = require("@angular-devkit/build-webpack");
const core_1 = require("@angular-devkit/core");
const path = __importStar(require("path"));
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const typescript_1 = require("typescript");
const utils_1 = require("../../utils");
const i18n_inlining_1 = require("../../utils/i18n-inlining");
const output_paths_1 = require("../../utils/output-paths");
const purge_cache_1 = require("../../utils/purge-cache");
const version_1 = require("../../utils/version");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const configs_1 = require("../../webpack/configs");
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
    if (typeof options.bundleDependencies === 'string') {
        options.bundleDependencies = options.bundleDependencies === 'all';
        context.logger.warn(`Option 'bundleDependencies' string value is deprecated since version 9. Use a boolean value instead.`);
    }
    if (!options.bundleDependencies) {
        // eslint-disable-next-line import/no-extraneous-dependencies
        const { __processed_by_ivy_ngcc__, main = '' } = require('@angular/core/package.json');
        if (!__processed_by_ivy_ngcc__ ||
            !__processed_by_ivy_ngcc__.main ||
            main.includes('__ivy_ngcc__')) {
            context.logger.warn(core_1.tags.stripIndent `
      Warning: Turning off 'bundleDependencies' with Ivy may result in undefined behaviour
      unless 'node_modules' are transformed using the standalone Angular compatibility compiler (NGCC).
      See: https://angular.io/guide/ivy#ivy-and-universal-app-shell
    `);
        }
    }
    return (0, rxjs_1.from)(initialize(options, context, transforms.webpackConfiguration)).pipe((0, operators_1.concatMap)(({ config, i18n, target }) => {
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
                success = await (0, i18n_inlining_1.i18nInlineEmittedFiles)(context, emittedFiles, i18n, baseOutputPath, Array.from(outputPaths.values()), [], outputPath, target <= typescript_1.ScriptTarget.ES5, options.i18nMissingTranslation);
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
        };
    }));
}
exports.execute = execute;
exports.default = (0, architect_1.createBuilder)(execute);
async function initialize(options, context, webpackConfigurationTransform) {
    // Purge old build disk cache.
    await (0, purge_cache_1.purgeStaleBuildCache)(context);
    const originalOutputPath = options.outputPath;
    const { config, i18n, target } = await (0, webpack_browser_config_1.generateI18nBrowserWebpackConfigFromContext)({
        ...options,
        buildOptimizer: false,
        aot: true,
        platform: 'server',
    }, context, (wco) => [(0, configs_1.getCommonConfig)(wco), (0, configs_1.getStylesConfig)(wco)]);
    let transformedConfig;
    if (webpackConfigurationTransform) {
        transformedConfig = await webpackConfigurationTransform(config);
    }
    if (options.deleteOutputPath) {
        (0, utils_1.deleteOutputDir)(context.workspaceRoot, originalOutputPath);
    }
    return { config: transformedConfig || config, i18n, target };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUF5RjtBQUN6RixpRUFBMkQ7QUFDM0QsK0NBQWtEO0FBQ2xELDJDQUE2QjtBQUM3QiwrQkFBd0M7QUFDeEMsOENBQWdEO0FBQ2hELDJDQUEwQztBQUcxQyx1Q0FBOEU7QUFDOUUsNkRBQW1FO0FBRW5FLDJEQUE2RDtBQUM3RCx5REFBK0Q7QUFDL0QsaURBQXFFO0FBQ3JFLCtFQUFpRztBQUNqRyxtREFBeUU7QUFDekUscURBQStEO0FBa0IvRDs7R0FFRztBQUNILFNBQWdCLE9BQU8sQ0FDckIsT0FBNkIsRUFDN0IsT0FBdUIsRUFDdkIsYUFFSSxFQUFFO0lBRU4sTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUVuQyx5QkFBeUI7SUFDekIsSUFBQSx3Q0FBOEIsRUFBQyxJQUFJLENBQUMsQ0FBQztJQUVyQyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDOUQsSUFBSSxXQUE0QyxDQUFDO0lBRWpELElBQUksT0FBTyxPQUFPLENBQUMsa0JBQWtCLEtBQUssUUFBUSxFQUFFO1FBQ2xELE9BQU8sQ0FBQyxrQkFBa0IsR0FBRyxPQUFPLENBQUMsa0JBQWtCLEtBQUssS0FBSyxDQUFDO1FBQ2xFLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNqQixzR0FBc0csQ0FDdkcsQ0FBQztLQUNIO0lBRUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRTtRQUMvQiw2REFBNkQ7UUFDN0QsTUFBTSxFQUFF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LENBQUMsQ0FBQztJQUVwQyxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUM7SUFDOUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFBLG9FQUEyQyxFQUNoRjtRQUNFLEdBQUcsT0FBTztRQUNWLGNBQWMsRUFBRSxLQUFLO1FBQ3JCLEdBQUcsRUFBRSxJQUFJO1FBQ1QsUUFBUSxFQUFFLFFBQVE7S0FDZSxFQUNuQyxPQUFPLEVBQ1AsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsQ0FBQyxDQUN0RCxDQUFDO0lBRUYsSUFBSSxpQkFBaUIsQ0FBQztJQUN0QixJQUFJLDZCQUE2QixFQUFFO1FBQ2pDLGlCQUFpQixHQUFHLE1BQU0sNkJBQTZCLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDakU7SUFFRCxJQUFJLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRTtRQUM1QixJQUFBLHVCQUFlLEVBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO0tBQzVEO0lBRUQsT0FBTyxFQUFFLE1BQU0sRUFBRSxpQkFBaUIsSUFBSSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDO0FBQy9ELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IHJ1bldlYnBhY2sgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyBqc29uLCB0YWdzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgU2NyaXB0VGFyZ2V0IH0gZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IEV4ZWN1dGlvblRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vdHJhbnNmb3Jtcyc7XG5pbXBvcnQgeyBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsIGRlbGV0ZU91dHB1dERpciB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IGkxOG5JbmxpbmVFbWl0dGVkRmlsZXMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLWlubGluaW5nJztcbmltcG9ydCB7IEkxOG5PcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IGVuc3VyZU91dHB1dFBhdGhzIH0gZnJvbSAnLi4vLi4vdXRpbHMvb3V0cHV0LXBhdGhzJztcbmltcG9ydCB7IHB1cmdlU3RhbGVCdWlsZENhY2hlIH0gZnJvbSAnLi4vLi4vdXRpbHMvcHVyZ2UtY2FjaGUnO1xuaW1wb3J0IHsgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvdmVyc2lvbic7XG5pbXBvcnQgeyBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0IH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBnZXRDb21tb25Db25maWcsIGdldFN0eWxlc0NvbmZpZyB9IGZyb20gJy4uLy4uL3dlYnBhY2svY29uZmlncyc7XG5pbXBvcnQgeyB3ZWJwYWNrU3RhdHNMb2dnZXIgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL3N0YXRzJztcbmltcG9ydCB7IFNjaGVtYSBhcyBTZXJ2ZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4vc2NoZW1hJztcblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIHR5cGUgaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCB0eXBlIFNlcnZlckJ1aWxkZXJPdXRwdXQgPSBqc29uLkpzb25PYmplY3QgJlxuICBCdWlsZGVyT3V0cHV0ICYge1xuICAgIGJhc2VPdXRwdXRQYXRoOiBzdHJpbmc7XG4gICAgb3V0cHV0UGF0aHM6IHN0cmluZ1tdO1xuICAgIC8qKlxuICAgICAqIEBkZXByZWNhdGVkIGluIHZlcnNpb24gOS4gVXNlICdvdXRwdXRQYXRocycgaW5zdGVhZC5cbiAgICAgKi9cbiAgICBvdXRwdXRQYXRoOiBzdHJpbmc7XG4gIH07XG5cbmV4cG9ydCB7IFNlcnZlckJ1aWxkZXJPcHRpb25zIH07XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IFNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgdHJhbnNmb3Jtczoge1xuICAgIHdlYnBhY2tDb25maWd1cmF0aW9uPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8d2VicGFjay5Db25maWd1cmF0aW9uPjtcbiAgfSA9IHt9LFxuKTogT2JzZXJ2YWJsZTxTZXJ2ZXJCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnN0IHJvb3QgPSBjb250ZXh0LndvcmtzcGFjZVJvb3Q7XG5cbiAgLy8gQ2hlY2sgQW5ndWxhciB2ZXJzaW9uLlxuICBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24ocm9vdCk7XG5cbiAgY29uc3QgYmFzZU91dHB1dFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgb3B0aW9ucy5vdXRwdXRQYXRoKTtcbiAgbGV0IG91dHB1dFBhdGhzOiB1bmRlZmluZWQgfCBNYXA8c3RyaW5nLCBzdHJpbmc+O1xuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucy5idW5kbGVEZXBlbmRlbmNpZXMgPT09ICdzdHJpbmcnKSB7XG4gICAgb3B0aW9ucy5idW5kbGVEZXBlbmRlbmNpZXMgPSBvcHRpb25zLmJ1bmRsZURlcGVuZGVuY2llcyA9PT0gJ2FsbCc7XG4gICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgIGBPcHRpb24gJ2J1bmRsZURlcGVuZGVuY2llcycgc3RyaW5nIHZhbHVlIGlzIGRlcHJlY2F0ZWQgc2luY2UgdmVyc2lvbiA5LiBVc2UgYSBib29sZWFuIHZhbHVlIGluc3RlYWQuYCxcbiAgICApO1xuICB9XG5cbiAgaWYgKCFvcHRpb25zLmJ1bmRsZURlcGVuZGVuY2llcykge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tZXh0cmFuZW91cy1kZXBlbmRlbmNpZXNcbiAgICBjb25zdCB7IF9fcHJvY2Vzc2VkX2J5X2l2eV9uZ2NjX18sIG1haW4gPSAnJyB9ID0gcmVxdWlyZSgnQGFuZ3VsYXIvY29yZS9wYWNrYWdlLmpzb24nKTtcbiAgICBpZiAoXG4gICAgICAhX19wcm9jZXNzZWRfYnlfaXZ5X25nY2NfXyB8fFxuICAgICAgIV9fcHJvY2Vzc2VkX2J5X2l2eV9uZ2NjX18ubWFpbiB8fFxuICAgICAgKG1haW4gYXMgc3RyaW5nKS5pbmNsdWRlcygnX19pdnlfbmdjY19fJylcbiAgICApIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4odGFncy5zdHJpcEluZGVudGBcbiAgICAgIFdhcm5pbmc6IFR1cm5pbmcgb2ZmICdidW5kbGVEZXBlbmRlbmNpZXMnIHdpdGggSXZ5IG1heSByZXN1bHQgaW4gdW5kZWZpbmVkIGJlaGF2aW91clxuICAgICAgdW5sZXNzICdub2RlX21vZHVsZXMnIGFyZSB0cmFuc2Zvcm1lZCB1c2luZyB0aGUgc3RhbmRhbG9uZSBBbmd1bGFyIGNvbXBhdGliaWxpdHkgY29tcGlsZXIgKE5HQ0MpLlxuICAgICAgU2VlOiBodHRwczovL2FuZ3VsYXIuaW8vZ3VpZGUvaXZ5I2l2eS1hbmQtdW5pdmVyc2FsLWFwcC1zaGVsbFxuICAgIGApO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmcm9tKGluaXRpYWxpemUob3B0aW9ucywgY29udGV4dCwgdHJhbnNmb3Jtcy53ZWJwYWNrQ29uZmlndXJhdGlvbikpLnBpcGUoXG4gICAgY29uY2F0TWFwKCh7IGNvbmZpZywgaTE4biwgdGFyZ2V0IH0pID0+IHtcbiAgICAgIHJldHVybiBydW5XZWJwYWNrKGNvbmZpZywgY29udGV4dCwge1xuICAgICAgICB3ZWJwYWNrRmFjdG9yeTogcmVxdWlyZSgnd2VicGFjaycpIGFzIHR5cGVvZiB3ZWJwYWNrLFxuICAgICAgICBsb2dnaW5nOiAoc3RhdHMsIGNvbmZpZykgPT4ge1xuICAgICAgICAgIGlmIChvcHRpb25zLnZlcmJvc2UpIHtcbiAgICAgICAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oc3RhdHMudG9TdHJpbmcoY29uZmlnLnN0YXRzKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgfSkucGlwZShcbiAgICAgICAgY29uY2F0TWFwKGFzeW5jIChvdXRwdXQpID0+IHtcbiAgICAgICAgICBjb25zdCB7IGVtaXR0ZWRGaWxlcyA9IFtdLCBvdXRwdXRQYXRoLCB3ZWJwYWNrU3RhdHMgfSA9IG91dHB1dDtcbiAgICAgICAgICBpZiAoIXdlYnBhY2tTdGF0cykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdXZWJwYWNrIHN0YXRzIGJ1aWxkIHJlc3VsdCBpcyByZXF1aXJlZC4nKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsZXQgc3VjY2VzcyA9IG91dHB1dC5zdWNjZXNzO1xuICAgICAgICAgIGlmIChzdWNjZXNzICYmIGkxOG4uc2hvdWxkSW5saW5lKSB7XG4gICAgICAgICAgICBvdXRwdXRQYXRocyA9IGVuc3VyZU91dHB1dFBhdGhzKGJhc2VPdXRwdXRQYXRoLCBpMThuKTtcblxuICAgICAgICAgICAgc3VjY2VzcyA9IGF3YWl0IGkxOG5JbmxpbmVFbWl0dGVkRmlsZXMoXG4gICAgICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAgICAgIGVtaXR0ZWRGaWxlcyxcbiAgICAgICAgICAgICAgaTE4bixcbiAgICAgICAgICAgICAgYmFzZU91dHB1dFBhdGgsXG4gICAgICAgICAgICAgIEFycmF5LmZyb20ob3V0cHV0UGF0aHMudmFsdWVzKCkpLFxuICAgICAgICAgICAgICBbXSxcbiAgICAgICAgICAgICAgb3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgdGFyZ2V0IDw9IFNjcmlwdFRhcmdldC5FUzUsXG4gICAgICAgICAgICAgIG9wdGlvbnMuaTE4bk1pc3NpbmdUcmFuc2xhdGlvbixcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgd2VicGFja1N0YXRzTG9nZ2VyKGNvbnRleHQubG9nZ2VyLCB3ZWJwYWNrU3RhdHMsIGNvbmZpZyk7XG5cbiAgICAgICAgICByZXR1cm4geyAuLi5vdXRwdXQsIHN1Y2Nlc3MgfTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH0pLFxuICAgIG1hcCgob3V0cHV0KSA9PiB7XG4gICAgICBpZiAoIW91dHB1dC5zdWNjZXNzKSB7XG4gICAgICAgIHJldHVybiBvdXRwdXQgYXMgU2VydmVyQnVpbGRlck91dHB1dDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4ub3V0cHV0LFxuICAgICAgICBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgb3V0cHV0UGF0aDogYmFzZU91dHB1dFBhdGgsXG4gICAgICAgIG91dHB1dFBhdGhzOiBvdXRwdXRQYXRocyB8fCBbYmFzZU91dHB1dFBhdGhdLFxuICAgICAgfSBhcyBTZXJ2ZXJCdWlsZGVyT3V0cHV0O1xuICAgIH0pLFxuICApO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyPFNlcnZlckJ1aWxkZXJPcHRpb25zLCBTZXJ2ZXJCdWlsZGVyT3V0cHV0PihleGVjdXRlKTtcblxuYXN5bmMgZnVuY3Rpb24gaW5pdGlhbGl6ZShcbiAgb3B0aW9uczogU2VydmVyQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybT86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPHdlYnBhY2suQ29uZmlndXJhdGlvbj4sXG4pOiBQcm9taXNlPHtcbiAgY29uZmlnOiB3ZWJwYWNrLkNvbmZpZ3VyYXRpb247XG4gIGkxOG46IEkxOG5PcHRpb25zO1xuICB0YXJnZXQ6IFNjcmlwdFRhcmdldDtcbn0+IHtcbiAgLy8gUHVyZ2Ugb2xkIGJ1aWxkIGRpc2sgY2FjaGUuXG4gIGF3YWl0IHB1cmdlU3RhbGVCdWlsZENhY2hlKGNvbnRleHQpO1xuXG4gIGNvbnN0IG9yaWdpbmFsT3V0cHV0UGF0aCA9IG9wdGlvbnMub3V0cHV0UGF0aDtcbiAgY29uc3QgeyBjb25maWcsIGkxOG4sIHRhcmdldCB9ID0gYXdhaXQgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChcbiAgICB7XG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgYnVpbGRPcHRpbWl6ZXI6IGZhbHNlLFxuICAgICAgYW90OiB0cnVlLFxuICAgICAgcGxhdGZvcm06ICdzZXJ2ZXInLFxuICAgIH0gYXMgTm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICAgIGNvbnRleHQsXG4gICAgKHdjbykgPT4gW2dldENvbW1vbkNvbmZpZyh3Y28pLCBnZXRTdHlsZXNDb25maWcod2NvKV0sXG4gICk7XG5cbiAgbGV0IHRyYW5zZm9ybWVkQ29uZmlnO1xuICBpZiAod2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm0pIHtcbiAgICB0cmFuc2Zvcm1lZENvbmZpZyA9IGF3YWl0IHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtKGNvbmZpZyk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoKSB7XG4gICAgZGVsZXRlT3V0cHV0RGlyKGNvbnRleHQud29ya3NwYWNlUm9vdCwgb3JpZ2luYWxPdXRwdXRQYXRoKTtcbiAgfVxuXG4gIHJldHVybiB7IGNvbmZpZzogdHJhbnNmb3JtZWRDb25maWcgfHwgY29uZmlnLCBpMThuLCB0YXJnZXQgfTtcbn1cbiJdfQ==