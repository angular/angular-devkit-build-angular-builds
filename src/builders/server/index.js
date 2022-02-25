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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUF5RjtBQUN6RixpRUFBMkQ7QUFDM0QsK0NBQTRDO0FBQzVDLDJDQUE2QjtBQUM3QiwrQkFBd0M7QUFDeEMsOENBQWdEO0FBQ2hELDJDQUEwQztBQUcxQyx1Q0FBOEU7QUFDOUUsNkRBQW1FO0FBRW5FLDJEQUE2RDtBQUM3RCx5REFBK0Q7QUFDL0QsaURBQXFFO0FBQ3JFLCtFQUFpRztBQUNqRyxtREFBeUU7QUFDekUscURBQStEO0FBaUIvRDs7R0FFRztBQUNILFNBQWdCLE9BQU8sQ0FDckIsT0FBNkIsRUFDN0IsT0FBdUIsRUFDdkIsYUFFSSxFQUFFO0lBRU4sTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUVuQyx5QkFBeUI7SUFDekIsSUFBQSx3Q0FBOEIsRUFBQyxJQUFJLENBQUMsQ0FBQztJQUVyQyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDOUQsSUFBSSxXQUE0QyxDQUFDO0lBRWpELElBQUksT0FBTyxPQUFPLENBQUMsa0JBQWtCLEtBQUssUUFBUSxFQUFFO1FBQ2xELE9BQU8sQ0FBQyxrQkFBa0IsR0FBRyxPQUFPLENBQUMsa0JBQWtCLEtBQUssS0FBSyxDQUFDO1FBQ2xFLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNqQixzR0FBc0csQ0FDdkcsQ0FBQztLQUNIO0lBRUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRTtRQUMvQiw2REFBNkQ7UUFDN0QsTUFBTSxFQUFF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LENBQUMsQ0FBQztJQUVwQyxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUM7SUFDOUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFBLG9FQUEyQyxFQUNoRjtRQUNFLEdBQUcsT0FBTztRQUNWLGNBQWMsRUFBRSxLQUFLO1FBQ3JCLEdBQUcsRUFBRSxJQUFJO1FBQ1QsUUFBUSxFQUFFLFFBQVE7S0FDZSxFQUNuQyxPQUFPLEVBQ1AsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsQ0FBQyxDQUN0RCxDQUFDO0lBRUYsSUFBSSxpQkFBaUIsQ0FBQztJQUN0QixJQUFJLDZCQUE2QixFQUFFO1FBQ2pDLGlCQUFpQixHQUFHLE1BQU0sNkJBQTZCLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDakU7SUFFRCxJQUFJLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRTtRQUM1QixJQUFBLHVCQUFlLEVBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO0tBQzVEO0lBRUQsT0FBTyxFQUFFLE1BQU0sRUFBRSxpQkFBaUIsSUFBSSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDO0FBQy9ELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IHJ1bldlYnBhY2sgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyB0YWdzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgU2NyaXB0VGFyZ2V0IH0gZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IEV4ZWN1dGlvblRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vdHJhbnNmb3Jtcyc7XG5pbXBvcnQgeyBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsIGRlbGV0ZU91dHB1dERpciB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IGkxOG5JbmxpbmVFbWl0dGVkRmlsZXMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLWlubGluaW5nJztcbmltcG9ydCB7IEkxOG5PcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IGVuc3VyZU91dHB1dFBhdGhzIH0gZnJvbSAnLi4vLi4vdXRpbHMvb3V0cHV0LXBhdGhzJztcbmltcG9ydCB7IHB1cmdlU3RhbGVCdWlsZENhY2hlIH0gZnJvbSAnLi4vLi4vdXRpbHMvcHVyZ2UtY2FjaGUnO1xuaW1wb3J0IHsgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvdmVyc2lvbic7XG5pbXBvcnQgeyBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0IH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBnZXRDb21tb25Db25maWcsIGdldFN0eWxlc0NvbmZpZyB9IGZyb20gJy4uLy4uL3dlYnBhY2svY29uZmlncyc7XG5pbXBvcnQgeyB3ZWJwYWNrU3RhdHNMb2dnZXIgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL3N0YXRzJztcbmltcG9ydCB7IFNjaGVtYSBhcyBTZXJ2ZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4vc2NoZW1hJztcblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIHR5cGUgaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCB0eXBlIFNlcnZlckJ1aWxkZXJPdXRwdXQgPSBCdWlsZGVyT3V0cHV0ICYge1xuICBiYXNlT3V0cHV0UGF0aDogc3RyaW5nO1xuICBvdXRwdXRQYXRoczogc3RyaW5nW107XG4gIC8qKlxuICAgKiBAZGVwcmVjYXRlZCBpbiB2ZXJzaW9uIDkuIFVzZSAnb3V0cHV0UGF0aHMnIGluc3RlYWQuXG4gICAqL1xuICBvdXRwdXRQYXRoOiBzdHJpbmc7XG59O1xuXG5leHBvcnQgeyBTZXJ2ZXJCdWlsZGVyT3B0aW9ucyB9O1xuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleGVjdXRlKFxuICBvcHRpb25zOiBTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHRyYW5zZm9ybXM6IHtcbiAgICB3ZWJwYWNrQ29uZmlndXJhdGlvbj86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPHdlYnBhY2suQ29uZmlndXJhdGlvbj47XG4gIH0gPSB7fSxcbik6IE9ic2VydmFibGU8U2VydmVyQnVpbGRlck91dHB1dD4ge1xuICBjb25zdCByb290ID0gY29udGV4dC53b3Jrc3BhY2VSb290O1xuXG4gIC8vIENoZWNrIEFuZ3VsYXIgdmVyc2lvbi5cbiAgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uKHJvb3QpO1xuXG4gIGNvbnN0IGJhc2VPdXRwdXRQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIG9wdGlvbnMub3V0cHV0UGF0aCk7XG4gIGxldCBvdXRwdXRQYXRoczogdW5kZWZpbmVkIHwgTWFwPHN0cmluZywgc3RyaW5nPjtcblxuICBpZiAodHlwZW9mIG9wdGlvbnMuYnVuZGxlRGVwZW5kZW5jaWVzID09PSAnc3RyaW5nJykge1xuICAgIG9wdGlvbnMuYnVuZGxlRGVwZW5kZW5jaWVzID0gb3B0aW9ucy5idW5kbGVEZXBlbmRlbmNpZXMgPT09ICdhbGwnO1xuICAgIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICBgT3B0aW9uICdidW5kbGVEZXBlbmRlbmNpZXMnIHN0cmluZyB2YWx1ZSBpcyBkZXByZWNhdGVkIHNpbmNlIHZlcnNpb24gOS4gVXNlIGEgYm9vbGVhbiB2YWx1ZSBpbnN0ZWFkLmAsXG4gICAgKTtcbiAgfVxuXG4gIGlmICghb3B0aW9ucy5idW5kbGVEZXBlbmRlbmNpZXMpIHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgaW1wb3J0L25vLWV4dHJhbmVvdXMtZGVwZW5kZW5jaWVzXG4gICAgY29uc3QgeyBfX3Byb2Nlc3NlZF9ieV9pdnlfbmdjY19fLCBtYWluID0gJycgfSA9IHJlcXVpcmUoJ0Bhbmd1bGFyL2NvcmUvcGFja2FnZS5qc29uJyk7XG4gICAgaWYgKFxuICAgICAgIV9fcHJvY2Vzc2VkX2J5X2l2eV9uZ2NjX18gfHxcbiAgICAgICFfX3Byb2Nlc3NlZF9ieV9pdnlfbmdjY19fLm1haW4gfHxcbiAgICAgIChtYWluIGFzIHN0cmluZykuaW5jbHVkZXMoJ19faXZ5X25nY2NfXycpXG4gICAgKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci53YXJuKHRhZ3Muc3RyaXBJbmRlbnRgXG4gICAgICBXYXJuaW5nOiBUdXJuaW5nIG9mZiAnYnVuZGxlRGVwZW5kZW5jaWVzJyB3aXRoIEl2eSBtYXkgcmVzdWx0IGluIHVuZGVmaW5lZCBiZWhhdmlvdXJcbiAgICAgIHVubGVzcyAnbm9kZV9tb2R1bGVzJyBhcmUgdHJhbnNmb3JtZWQgdXNpbmcgdGhlIHN0YW5kYWxvbmUgQW5ndWxhciBjb21wYXRpYmlsaXR5IGNvbXBpbGVyIChOR0NDKS5cbiAgICAgIFNlZTogaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2l2eSNpdnktYW5kLXVuaXZlcnNhbC1hcHAtc2hlbGxcbiAgICBgKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZnJvbShpbml0aWFsaXplKG9wdGlvbnMsIGNvbnRleHQsIHRyYW5zZm9ybXMud2VicGFja0NvbmZpZ3VyYXRpb24pKS5waXBlKFxuICAgIGNvbmNhdE1hcCgoeyBjb25maWcsIGkxOG4sIHRhcmdldCB9KSA9PiB7XG4gICAgICByZXR1cm4gcnVuV2VicGFjayhjb25maWcsIGNvbnRleHQsIHtcbiAgICAgICAgd2VicGFja0ZhY3Rvcnk6IHJlcXVpcmUoJ3dlYnBhY2snKSBhcyB0eXBlb2Ygd2VicGFjayxcbiAgICAgICAgbG9nZ2luZzogKHN0YXRzLCBjb25maWcpID0+IHtcbiAgICAgICAgICBpZiAob3B0aW9ucy52ZXJib3NlKSB7XG4gICAgICAgICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKHN0YXRzLnRvU3RyaW5nKGNvbmZpZy5zdGF0cykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgIH0pLnBpcGUoXG4gICAgICAgIGNvbmNhdE1hcChhc3luYyAob3V0cHV0KSA9PiB7XG4gICAgICAgICAgY29uc3QgeyBlbWl0dGVkRmlsZXMgPSBbXSwgb3V0cHV0UGF0aCwgd2VicGFja1N0YXRzIH0gPSBvdXRwdXQ7XG4gICAgICAgICAgaWYgKCF3ZWJwYWNrU3RhdHMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignV2VicGFjayBzdGF0cyBidWlsZCByZXN1bHQgaXMgcmVxdWlyZWQuJyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGV0IHN1Y2Nlc3MgPSBvdXRwdXQuc3VjY2VzcztcbiAgICAgICAgICBpZiAoc3VjY2VzcyAmJiBpMThuLnNob3VsZElubGluZSkge1xuICAgICAgICAgICAgb3V0cHV0UGF0aHMgPSBlbnN1cmVPdXRwdXRQYXRocyhiYXNlT3V0cHV0UGF0aCwgaTE4bik7XG5cbiAgICAgICAgICAgIHN1Y2Nlc3MgPSBhd2FpdCBpMThuSW5saW5lRW1pdHRlZEZpbGVzKFxuICAgICAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgICAgICBlbWl0dGVkRmlsZXMsXG4gICAgICAgICAgICAgIGkxOG4sXG4gICAgICAgICAgICAgIGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICAgICAgICBBcnJheS5mcm9tKG91dHB1dFBhdGhzLnZhbHVlcygpKSxcbiAgICAgICAgICAgICAgW10sXG4gICAgICAgICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgICAgICAgIHRhcmdldCA8PSBTY3JpcHRUYXJnZXQuRVM1LFxuICAgICAgICAgICAgICBvcHRpb25zLmkxOG5NaXNzaW5nVHJhbnNsYXRpb24sXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHdlYnBhY2tTdGF0c0xvZ2dlcihjb250ZXh0LmxvZ2dlciwgd2VicGFja1N0YXRzLCBjb25maWcpO1xuXG4gICAgICAgICAgcmV0dXJuIHsgLi4ub3V0cHV0LCBzdWNjZXNzIH07XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9KSxcbiAgICBtYXAoKG91dHB1dCkgPT4ge1xuICAgICAgaWYgKCFvdXRwdXQuc3VjY2Vzcykge1xuICAgICAgICByZXR1cm4gb3V0cHV0IGFzIFNlcnZlckJ1aWxkZXJPdXRwdXQ7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIC4uLm91dHB1dCxcbiAgICAgICAgYmFzZU91dHB1dFBhdGgsXG4gICAgICAgIG91dHB1dFBhdGg6IGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICBvdXRwdXRQYXRoczogb3V0cHV0UGF0aHMgfHwgW2Jhc2VPdXRwdXRQYXRoXSxcbiAgICAgIH0gYXMgU2VydmVyQnVpbGRlck91dHB1dDtcbiAgICB9KSxcbiAgKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcjxTZXJ2ZXJCdWlsZGVyT3B0aW9ucywgU2VydmVyQnVpbGRlck91dHB1dD4oZXhlY3V0ZSk7XG5cbmFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemUoXG4gIG9wdGlvbnM6IFNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgd2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm0/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+LFxuKTogUHJvbWlzZTx7XG4gIGNvbmZpZzogd2VicGFjay5Db25maWd1cmF0aW9uO1xuICBpMThuOiBJMThuT3B0aW9ucztcbiAgdGFyZ2V0OiBTY3JpcHRUYXJnZXQ7XG59PiB7XG4gIC8vIFB1cmdlIG9sZCBidWlsZCBkaXNrIGNhY2hlLlxuICBhd2FpdCBwdXJnZVN0YWxlQnVpbGRDYWNoZShjb250ZXh0KTtcblxuICBjb25zdCBvcmlnaW5hbE91dHB1dFBhdGggPSBvcHRpb25zLm91dHB1dFBhdGg7XG4gIGNvbnN0IHsgY29uZmlnLCBpMThuLCB0YXJnZXQgfSA9IGF3YWl0IGdlbmVyYXRlSTE4bkJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQoXG4gICAge1xuICAgICAgLi4ub3B0aW9ucyxcbiAgICAgIGJ1aWxkT3B0aW1pemVyOiBmYWxzZSxcbiAgICAgIGFvdDogdHJ1ZSxcbiAgICAgIHBsYXRmb3JtOiAnc2VydmVyJyxcbiAgICB9IGFzIE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgICBjb250ZXh0LFxuICAgICh3Y28pID0+IFtnZXRDb21tb25Db25maWcod2NvKSwgZ2V0U3R5bGVzQ29uZmlnKHdjbyldLFxuICApO1xuXG4gIGxldCB0cmFuc2Zvcm1lZENvbmZpZztcbiAgaWYgKHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtKSB7XG4gICAgdHJhbnNmb3JtZWRDb25maWcgPSBhd2FpdCB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybShjb25maWcpO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aCkge1xuICAgIGRlbGV0ZU91dHB1dERpcihjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9yaWdpbmFsT3V0cHV0UGF0aCk7XG4gIH1cblxuICByZXR1cm4geyBjb25maWc6IHRyYW5zZm9ybWVkQ29uZmlnIHx8IGNvbmZpZywgaTE4biwgdGFyZ2V0IH07XG59XG4iXX0=