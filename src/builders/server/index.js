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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsaUVBQTJEO0FBQzNELCtDQUE0QztBQUM1QywyQ0FBNkI7QUFDN0IsK0JBQXdDO0FBQ3hDLDhDQUFnRDtBQUNoRCwyQ0FBMEM7QUFHMUMsdUNBQThFO0FBQzlFLDZEQUFtRTtBQUVuRSwyREFBNkQ7QUFDN0QseURBQStEO0FBQy9ELGlEQUFxRTtBQUNyRSwrRUFBaUc7QUFDakcsbURBQXlFO0FBQ3pFLHFEQUErRDtBQWlCL0Q7O0dBRUc7QUFDSCxTQUFnQixPQUFPLENBQ3JCLE9BQTZCLEVBQzdCLE9BQXVCLEVBQ3ZCLGFBRUksRUFBRTtJQUVOLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7SUFFbkMseUJBQXlCO0lBQ3pCLElBQUEsd0NBQThCLEVBQUMsSUFBSSxDQUFDLENBQUM7SUFFckMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzlELElBQUksV0FBNEMsQ0FBQztJQUVqRCxJQUFJLE9BQU8sT0FBTyxDQUFDLGtCQUFrQixLQUFLLFFBQVEsRUFBRTtRQUNsRCxPQUFPLENBQUMsa0JBQWtCLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixLQUFLLEtBQUssQ0FBQztRQUNsRSxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDakIsc0dBQXNHLENBQ3ZHLENBQUM7S0FDSDtJQUVELElBQUksQ0FBQyxPQUFPLENBQUMsa0JBQWtCLEVBQUU7UUFDL0IsNkRBQTZEO1FBQzdELE1BQU0sRUFBRSx5QkFBeUIsRUFBRSxJQUFJLEdBQUcsRUFBRSxFQUFFLEdBQUcsT0FBTyxDQUFDLDRCQUE0QixDQUFDLENBQUM7UUFDdkYsSUFDRSxDQUFDLHlCQUF5QjtZQUMxQixDQUFDLHlCQUF5QixDQUFDLElBQUk7WUFDOUIsSUFBZSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsRUFDekM7WUFDQSxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFJLENBQUMsV0FBVyxDQUFBOzs7O0tBSXJDLENBQUMsQ0FBQztTQUNGO0tBQ0Y7SUFFRCxPQUFPLElBQUEsV0FBSSxFQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUM3RSxJQUFBLHFCQUFTLEVBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRTtRQUNyQyxPQUFPLElBQUEsMEJBQVUsRUFBQyxNQUFNLEVBQUUsT0FBTyxFQUFFO1lBQ2pDLGNBQWMsRUFBRSxPQUFPLENBQUMsU0FBUyxDQUFtQjtZQUNwRCxPQUFPLEVBQUUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEVBQUU7Z0JBQ3pCLElBQUksT0FBTyxDQUFDLE9BQU8sRUFBRTtvQkFDbkIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztpQkFDbkQ7WUFDSCxDQUFDO1NBQ0YsQ0FBQyxDQUFDLElBQUksQ0FDTCxJQUFBLHFCQUFTLEVBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3pCLE1BQU0sRUFBRSxZQUFZLEdBQUcsRUFBRSxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsR0FBRyxNQUFNLENBQUM7WUFDL0QsSUFBSSxDQUFDLFlBQVksRUFBRTtnQkFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDO2FBQzVEO1lBRUQsSUFBSSxPQUFPLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQztZQUM3QixJQUFJLE9BQU8sSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFO2dCQUNoQyxXQUFXLEdBQUcsSUFBQSxnQ0FBaUIsRUFBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBRXRELE9BQU8sR0FBRyxNQUFNLElBQUEsc0NBQXNCLEVBQ3BDLE9BQU8sRUFDUCxZQUFZLEVBQ1osSUFBSSxFQUNKLGNBQWMsRUFDZCxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUNoQyxFQUFFLEVBQ0YsVUFBVSxFQUNWLE1BQU0sSUFBSSx5QkFBWSxDQUFDLEdBQUcsRUFDMUIsT0FBTyxDQUFDLHNCQUFzQixDQUMvQixDQUFDO2FBQ0g7WUFFRCxJQUFBLDBCQUFrQixFQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBRXpELE9BQU8sRUFBRSxHQUFHLE1BQU0sRUFBRSxPQUFPLEVBQUUsQ0FBQztRQUNoQyxDQUFDLENBQUMsQ0FDSCxDQUFDO0lBQ0osQ0FBQyxDQUFDLEVBQ0YsSUFBQSxlQUFHLEVBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRTtRQUNiLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFO1lBQ25CLE9BQU8sTUFBNkIsQ0FBQztTQUN0QztRQUVELE9BQU87WUFDTCxHQUFHLE1BQU07WUFDVCxjQUFjO1lBQ2QsVUFBVSxFQUFFLGNBQWM7WUFDMUIsV0FBVyxFQUFFLFdBQVcsSUFBSSxDQUFDLGNBQWMsQ0FBQztTQUN0QixDQUFDO0lBQzNCLENBQUMsQ0FBQyxDQUNILENBQUM7QUFDSixDQUFDO0FBMUZELDBCQTBGQztBQUVELGtCQUFlLElBQUEseUJBQWEsRUFBNEMsT0FBTyxDQUFDLENBQUM7QUFFakYsS0FBSyxVQUFVLFVBQVUsQ0FDdkIsT0FBNkIsRUFDN0IsT0FBdUIsRUFDdkIsNkJBQTJFO0lBTTNFLDhCQUE4QjtJQUM5QixNQUFNLElBQUEsa0NBQW9CLEVBQUMsT0FBTyxDQUFDLENBQUM7SUFFcEMsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDO0lBQzlDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBQSxvRUFBMkMsRUFDaEY7UUFDRSxHQUFHLE9BQU87UUFDVixjQUFjLEVBQUUsS0FBSztRQUNyQixHQUFHLEVBQUUsSUFBSTtRQUNULFFBQVEsRUFBRSxRQUFRO0tBQ2UsRUFDbkMsT0FBTyxFQUNQLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLENBQUMsQ0FDdEQsQ0FBQztJQUVGLElBQUksaUJBQWlCLENBQUM7SUFDdEIsSUFBSSw2QkFBNkIsRUFBRTtRQUNqQyxpQkFBaUIsR0FBRyxNQUFNLDZCQUE2QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQ2pFO0lBRUQsSUFBSSxPQUFPLENBQUMsZ0JBQWdCLEVBQUU7UUFDNUIsSUFBQSx1QkFBZSxFQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztLQUM1RDtJQUVELE9BQU8sRUFBRSxNQUFNLEVBQUUsaUJBQWlCLElBQUksTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQztBQUMvRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBydW5XZWJwYWNrIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLXdlYnBhY2snO1xuaW1wb3J0IHsgdGFncyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBmcm9tIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBjb25jYXRNYXAsIG1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IFNjcmlwdFRhcmdldCB9IGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBFeGVjdXRpb25UcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHsgTm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hLCBkZWxldGVPdXRwdXREaXIgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBpMThuSW5saW5lRW1pdHRlZEZpbGVzIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1pbmxpbmluZyc7XG5pbXBvcnQgeyBJMThuT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2kxOG4tb3B0aW9ucyc7XG5pbXBvcnQgeyBlbnN1cmVPdXRwdXRQYXRocyB9IGZyb20gJy4uLy4uL3V0aWxzL291dHB1dC1wYXRocyc7XG5pbXBvcnQgeyBwdXJnZVN0YWxlQnVpbGRDYWNoZSB9IGZyb20gJy4uLy4uL3V0aWxzL3B1cmdlLWNhY2hlJztcbmltcG9ydCB7IGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbiB9IGZyb20gJy4uLy4uL3V0aWxzL3ZlcnNpb24nO1xuaW1wb3J0IHsgZ2VuZXJhdGVJMThuQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dCB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgZ2V0Q29tbW9uQ29uZmlnLCBnZXRTdHlsZXNDb25maWcgfSBmcm9tICcuLi8uLi93ZWJwYWNrL2NvbmZpZ3MnO1xuaW1wb3J0IHsgd2VicGFja1N0YXRzTG9nZ2VyIH0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9zdGF0cyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgU2VydmVyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyB0eXBlIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgdHlwZSBTZXJ2ZXJCdWlsZGVyT3V0cHV0ID0gQnVpbGRlck91dHB1dCAmIHtcbiAgYmFzZU91dHB1dFBhdGg6IHN0cmluZztcbiAgb3V0cHV0UGF0aHM6IHN0cmluZ1tdO1xuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgaW4gdmVyc2lvbiA5LiBVc2UgJ291dHB1dFBhdGhzJyBpbnN0ZWFkLlxuICAgKi9cbiAgb3V0cHV0UGF0aDogc3RyaW5nO1xufTtcblxuZXhwb3J0IHsgU2VydmVyQnVpbGRlck9wdGlvbnMgfTtcblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZXhlY3V0ZShcbiAgb3B0aW9uczogU2VydmVyQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zOiB7XG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb24/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjx3ZWJwYWNrLkNvbmZpZ3VyYXRpb24+O1xuICB9ID0ge30sXG4pOiBPYnNlcnZhYmxlPFNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3Qgcm9vdCA9IGNvbnRleHQud29ya3NwYWNlUm9vdDtcblxuICAvLyBDaGVjayBBbmd1bGFyIHZlcnNpb24uXG4gIGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbihyb290KTtcblxuICBjb25zdCBiYXNlT3V0cHV0UGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBvcHRpb25zLm91dHB1dFBhdGgpO1xuICBsZXQgb3V0cHV0UGF0aHM6IHVuZGVmaW5lZCB8IE1hcDxzdHJpbmcsIHN0cmluZz47XG5cbiAgaWYgKHR5cGVvZiBvcHRpb25zLmJ1bmRsZURlcGVuZGVuY2llcyA9PT0gJ3N0cmluZycpIHtcbiAgICBvcHRpb25zLmJ1bmRsZURlcGVuZGVuY2llcyA9IG9wdGlvbnMuYnVuZGxlRGVwZW5kZW5jaWVzID09PSAnYWxsJztcbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKFxuICAgICAgYE9wdGlvbiAnYnVuZGxlRGVwZW5kZW5jaWVzJyBzdHJpbmcgdmFsdWUgaXMgZGVwcmVjYXRlZCBzaW5jZSB2ZXJzaW9uIDkuIFVzZSBhIGJvb2xlYW4gdmFsdWUgaW5zdGVhZC5gLFxuICAgICk7XG4gIH1cblxuICBpZiAoIW9wdGlvbnMuYnVuZGxlRGVwZW5kZW5jaWVzKSB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby1leHRyYW5lb3VzLWRlcGVuZGVuY2llc1xuICAgIGNvbnN0IHsgX19wcm9jZXNzZWRfYnlfaXZ5X25nY2NfXywgbWFpbiA9ICcnIH0gPSByZXF1aXJlKCdAYW5ndWxhci9jb3JlL3BhY2thZ2UuanNvbicpO1xuICAgIGlmIChcbiAgICAgICFfX3Byb2Nlc3NlZF9ieV9pdnlfbmdjY19fIHx8XG4gICAgICAhX19wcm9jZXNzZWRfYnlfaXZ5X25nY2NfXy5tYWluIHx8XG4gICAgICAobWFpbiBhcyBzdHJpbmcpLmluY2x1ZGVzKCdfX2l2eV9uZ2NjX18nKVxuICAgICkge1xuICAgICAgY29udGV4dC5sb2dnZXIud2Fybih0YWdzLnN0cmlwSW5kZW50YFxuICAgICAgV2FybmluZzogVHVybmluZyBvZmYgJ2J1bmRsZURlcGVuZGVuY2llcycgd2l0aCBJdnkgbWF5IHJlc3VsdCBpbiB1bmRlZmluZWQgYmVoYXZpb3VyXG4gICAgICB1bmxlc3MgJ25vZGVfbW9kdWxlcycgYXJlIHRyYW5zZm9ybWVkIHVzaW5nIHRoZSBzdGFuZGFsb25lIEFuZ3VsYXIgY29tcGF0aWJpbGl0eSBjb21waWxlciAoTkdDQykuXG4gICAgICBTZWU6IGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS9pdnkjaXZ5LWFuZC11bml2ZXJzYWwtYXBwLXNoZWxsXG4gICAgYCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZyb20oaW5pdGlhbGl6ZShvcHRpb25zLCBjb250ZXh0LCB0cmFuc2Zvcm1zLndlYnBhY2tDb25maWd1cmF0aW9uKSkucGlwZShcbiAgICBjb25jYXRNYXAoKHsgY29uZmlnLCBpMThuLCB0YXJnZXQgfSkgPT4ge1xuICAgICAgcmV0dXJuIHJ1bldlYnBhY2soY29uZmlnLCBjb250ZXh0LCB7XG4gICAgICAgIHdlYnBhY2tGYWN0b3J5OiByZXF1aXJlKCd3ZWJwYWNrJykgYXMgdHlwZW9mIHdlYnBhY2ssXG4gICAgICAgIGxvZ2dpbmc6IChzdGF0cywgY29uZmlnKSA9PiB7XG4gICAgICAgICAgaWYgKG9wdGlvbnMudmVyYm9zZSkge1xuICAgICAgICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhzdGF0cy50b1N0cmluZyhjb25maWcuc3RhdHMpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9KS5waXBlKFxuICAgICAgICBjb25jYXRNYXAoYXN5bmMgKG91dHB1dCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHsgZW1pdHRlZEZpbGVzID0gW10sIG91dHB1dFBhdGgsIHdlYnBhY2tTdGF0cyB9ID0gb3V0cHV0O1xuICAgICAgICAgIGlmICghd2VicGFja1N0YXRzKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYnBhY2sgc3RhdHMgYnVpbGQgcmVzdWx0IGlzIHJlcXVpcmVkLicpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxldCBzdWNjZXNzID0gb3V0cHV0LnN1Y2Nlc3M7XG4gICAgICAgICAgaWYgKHN1Y2Nlc3MgJiYgaTE4bi5zaG91bGRJbmxpbmUpIHtcbiAgICAgICAgICAgIG91dHB1dFBhdGhzID0gZW5zdXJlT3V0cHV0UGF0aHMoYmFzZU91dHB1dFBhdGgsIGkxOG4pO1xuXG4gICAgICAgICAgICBzdWNjZXNzID0gYXdhaXQgaTE4bklubGluZUVtaXR0ZWRGaWxlcyhcbiAgICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgICAgZW1pdHRlZEZpbGVzLFxuICAgICAgICAgICAgICBpMThuLFxuICAgICAgICAgICAgICBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgICAgICAgQXJyYXkuZnJvbShvdXRwdXRQYXRocy52YWx1ZXMoKSksXG4gICAgICAgICAgICAgIFtdLFxuICAgICAgICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICAgICAgICB0YXJnZXQgPD0gU2NyaXB0VGFyZ2V0LkVTNSxcbiAgICAgICAgICAgICAgb3B0aW9ucy5pMThuTWlzc2luZ1RyYW5zbGF0aW9uLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB3ZWJwYWNrU3RhdHNMb2dnZXIoY29udGV4dC5sb2dnZXIsIHdlYnBhY2tTdGF0cywgY29uZmlnKTtcblxuICAgICAgICAgIHJldHVybiB7IC4uLm91dHB1dCwgc3VjY2VzcyB9O1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfSksXG4gICAgbWFwKChvdXRwdXQpID0+IHtcbiAgICAgIGlmICghb3V0cHV0LnN1Y2Nlc3MpIHtcbiAgICAgICAgcmV0dXJuIG91dHB1dCBhcyBTZXJ2ZXJCdWlsZGVyT3V0cHV0O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi5vdXRwdXQsXG4gICAgICAgIGJhc2VPdXRwdXRQYXRoLFxuICAgICAgICBvdXRwdXRQYXRoOiBiYXNlT3V0cHV0UGF0aCxcbiAgICAgICAgb3V0cHV0UGF0aHM6IG91dHB1dFBhdGhzIHx8IFtiYXNlT3V0cHV0UGF0aF0sXG4gICAgICB9IGFzIFNlcnZlckJ1aWxkZXJPdXRwdXQ7XG4gICAgfSksXG4gICk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXI8U2VydmVyQnVpbGRlck9wdGlvbnMsIFNlcnZlckJ1aWxkZXJPdXRwdXQ+KGV4ZWN1dGUpO1xuXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplKFxuICBvcHRpb25zOiBTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8d2VicGFjay5Db25maWd1cmF0aW9uPixcbik6IFByb21pc2U8e1xuICBjb25maWc6IHdlYnBhY2suQ29uZmlndXJhdGlvbjtcbiAgaTE4bjogSTE4bk9wdGlvbnM7XG4gIHRhcmdldDogU2NyaXB0VGFyZ2V0O1xufT4ge1xuICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgYXdhaXQgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUoY29udGV4dCk7XG5cbiAgY29uc3Qgb3JpZ2luYWxPdXRwdXRQYXRoID0gb3B0aW9ucy5vdXRwdXRQYXRoO1xuICBjb25zdCB7IGNvbmZpZywgaTE4biwgdGFyZ2V0IH0gPSBhd2FpdCBnZW5lcmF0ZUkxOG5Ccm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KFxuICAgIHtcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgICBidWlsZE9wdGltaXplcjogZmFsc2UsXG4gICAgICBhb3Q6IHRydWUsXG4gICAgICBwbGF0Zm9ybTogJ3NlcnZlcicsXG4gICAgfSBhcyBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICAgY29udGV4dCxcbiAgICAod2NvKSA9PiBbZ2V0Q29tbW9uQ29uZmlnKHdjbyksIGdldFN0eWxlc0NvbmZpZyh3Y28pXSxcbiAgKTtcblxuICBsZXQgdHJhbnNmb3JtZWRDb25maWc7XG4gIGlmICh3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybSkge1xuICAgIHRyYW5zZm9ybWVkQ29uZmlnID0gYXdhaXQgd2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm0oY29uZmlnKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLmRlbGV0ZU91dHB1dFBhdGgpIHtcbiAgICBkZWxldGVPdXRwdXREaXIoY29udGV4dC53b3Jrc3BhY2VSb290LCBvcmlnaW5hbE91dHB1dFBhdGgpO1xuICB9XG5cbiAgcmV0dXJuIHsgY29uZmlnOiB0cmFuc2Zvcm1lZENvbmZpZyB8fCBjb25maWcsIGkxOG4sIHRhcmdldCB9O1xufVxuIl19