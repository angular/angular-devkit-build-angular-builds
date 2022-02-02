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
const core_1 = require("@angular-devkit/core");
const path_1 = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const purge_cache_1 = require("../../utils/purge-cache");
const version_1 = require("../../utils/version");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const configs_1 = require("../../webpack/configs");
const single_test_transform_1 = require("../../webpack/plugins/single-test-transform");
const schema_1 = require("../browser/schema");
const find_tests_1 = require("./find-tests");
async function initialize(options, context, webpackConfigurationTransformer) {
    // Purge old build disk cache.
    await (0, purge_cache_1.purgeStaleBuildCache)(context);
    const { config } = await (0, webpack_browser_config_1.generateBrowserWebpackConfigFromContext)(
    // only two properties are missing:
    // * `outputPath` which is fixed for tests
    // * `budgets` which might be incorrect due to extra dev libs
    {
        ...options,
        outputPath: '',
        budgets: undefined,
        optimization: false,
        buildOptimizer: false,
        aot: false,
        vendorChunk: true,
        namedChunks: true,
        extractLicenses: false,
        outputHashing: schema_1.OutputHashing.None,
        // The webpack tier owns the watch behavior so we want to force it in the config.
        // When not in watch mode, webpack-dev-middleware will call `compiler.watch` anyway.
        // https://github.com/webpack/webpack-dev-middleware/blob/698c9ae5e9bb9a013985add6189ff21c1a1ec185/src/index.js#L65
        // https://github.com/webpack/webpack/blob/cde1b73e12eb8a77eb9ba42e7920c9ec5d29c2c9/lib/Compiler.js#L379-L388
        watch: true,
    }, context, (wco) => [(0, configs_1.getCommonConfig)(wco), (0, configs_1.getStylesConfig)(wco)]);
    const karma = await Promise.resolve().then(() => __importStar(require('karma')));
    return [
        karma,
        webpackConfigurationTransformer ? await webpackConfigurationTransformer(config) : config,
    ];
}
/**
 * @experimental Direct usage of this function is considered experimental.
 */
function execute(options, context, transforms = {}) {
    // Check Angular version.
    (0, version_1.assertCompatibleAngularVersion)(context.workspaceRoot);
    let singleRun;
    if (options.watch !== undefined) {
        singleRun = !options.watch;
    }
    return (0, rxjs_1.from)(initialize(options, context, transforms.webpackConfiguration)).pipe((0, operators_1.switchMap)(async ([karma, webpackConfig]) => {
        var _a, _b, _c, _d, _e;
        const karmaOptions = {
            singleRun,
        };
        // Convert browsers from a string to an array
        if (options.browsers) {
            karmaOptions.browsers = options.browsers.split(',');
        }
        if (options.reporters) {
            // Split along commas to make it more natural, and remove empty strings.
            const reporters = options.reporters
                .reduce((acc, curr) => acc.concat(curr.split(',')), [])
                .filter((x) => !!x);
            if (reporters.length > 0) {
                karmaOptions.reporters = reporters;
            }
        }
        // prepend special webpack loader that will transform test.ts
        if ((_a = options.include) === null || _a === void 0 ? void 0 : _a.length) {
            const projectName = (_b = context.target) === null || _b === void 0 ? void 0 : _b.project;
            if (!projectName) {
                throw new Error('The builder requires a target.');
            }
            const projectMetadata = await context.getProjectMetadata(projectName);
            const projectSourceRoot = (0, core_1.getSystemPath)((0, core_1.join)((0, core_1.normalize)(context.workspaceRoot), (_c = projectMetadata.root) !== null && _c !== void 0 ? _c : '', (_d = projectMetadata.sourceRoot) !== null && _d !== void 0 ? _d : ''));
            const files = await (0, find_tests_1.findTests)(options.include, context.workspaceRoot, projectSourceRoot);
            // early exit, no reason to start karma
            if (!files.length) {
                throw new Error(`Specified patterns: "${options.include.join(', ')}" did not match any spec files.`);
            }
            // Get the rules and ensure the Webpack configuration is setup properly
            const rules = ((_e = webpackConfig.module) === null || _e === void 0 ? void 0 : _e.rules) || [];
            if (!webpackConfig.module) {
                webpackConfig.module = { rules };
            }
            else if (!webpackConfig.module.rules) {
                webpackConfig.module.rules = rules;
            }
            rules.unshift({
                test: (0, path_1.resolve)(context.workspaceRoot, options.main),
                use: {
                    // cannot be a simple path as it differs between environments
                    loader: single_test_transform_1.SingleTestTransformLoader,
                    options: {
                        files,
                        logger: context.logger,
                    },
                },
            });
        }
        karmaOptions.buildWebpack = {
            options,
            webpackConfig,
            logger: context.logger,
        };
        const config = await karma.config.parseConfig((0, path_1.resolve)(context.workspaceRoot, options.karmaConfig), transforms.karmaOptions ? transforms.karmaOptions(karmaOptions) : karmaOptions, { promiseConfig: true, throwErrors: true });
        return [karma, config];
    }), (0, operators_1.switchMap)(([karma, karmaConfig]) => new rxjs_1.Observable((subscriber) => {
        var _a, _b, _c;
        var _d, _e;
        // Pass onto Karma to emit BuildEvents.
        (_a = karmaConfig.buildWebpack) !== null && _a !== void 0 ? _a : (karmaConfig.buildWebpack = {});
        if (typeof karmaConfig.buildWebpack === 'object') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (_b = (_d = karmaConfig.buildWebpack).failureCb) !== null && _b !== void 0 ? _b : (_d.failureCb = () => subscriber.next({ success: false }));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (_c = (_e = karmaConfig.buildWebpack).successCb) !== null && _c !== void 0 ? _c : (_e.successCb = () => subscriber.next({ success: true }));
        }
        // Complete the observable once the Karma server returns.
        const karmaServer = new karma.Server(karmaConfig, (exitCode) => {
            subscriber.next({ success: exitCode === 0 });
            subscriber.complete();
        });
        const karmaStart = karmaServer.start();
        // Cleanup, signal Karma to exit.
        return () => karmaStart.then(() => karmaServer.stop());
    })), (0, operators_1.defaultIfEmpty)({ success: false }));
}
exports.execute = execute;
exports.default = (0, architect_1.createBuilder)(execute);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9rYXJtYS9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQXlGO0FBQ3pGLCtDQUFzRTtBQUV0RSwrQkFBNEM7QUFDNUMsK0JBQXdDO0FBQ3hDLDhDQUEyRDtBQUczRCx5REFBK0Q7QUFDL0QsaURBQXFFO0FBQ3JFLCtFQUE2RjtBQUM3RixtREFBeUU7QUFDekUsdUZBQXdGO0FBQ3hGLDhDQUFtRjtBQUNuRiw2Q0FBeUM7QUFRekMsS0FBSyxVQUFVLFVBQVUsQ0FDdkIsT0FBNEIsRUFDNUIsT0FBdUIsRUFDdkIsK0JBQXFFO0lBRXJFLDhCQUE4QjtJQUM5QixNQUFNLElBQUEsa0NBQW9CLEVBQUMsT0FBTyxDQUFDLENBQUM7SUFFcEMsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBQSxnRUFBdUM7SUFDOUQsbUNBQW1DO0lBQ25DLDBDQUEwQztJQUMxQyw2REFBNkQ7SUFDN0Q7UUFDRSxHQUFJLE9BQTRDO1FBQ2hELFVBQVUsRUFBRSxFQUFFO1FBQ2QsT0FBTyxFQUFFLFNBQVM7UUFDbEIsWUFBWSxFQUFFLEtBQUs7UUFDbkIsY0FBYyxFQUFFLEtBQUs7UUFDckIsR0FBRyxFQUFFLEtBQUs7UUFDVixXQUFXLEVBQUUsSUFBSTtRQUNqQixXQUFXLEVBQUUsSUFBSTtRQUNqQixlQUFlLEVBQUUsS0FBSztRQUN0QixhQUFhLEVBQUUsc0JBQWEsQ0FBQyxJQUFJO1FBQ2pDLGlGQUFpRjtRQUNqRixvRkFBb0Y7UUFDcEYsbUhBQW1IO1FBQ25ILDZHQUE2RztRQUM3RyxLQUFLLEVBQUUsSUFBSTtLQUNaLEVBQ0QsT0FBTyxFQUNQLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLENBQUMsQ0FDdEQsQ0FBQztJQUVGLE1BQU0sS0FBSyxHQUFHLHdEQUFhLE9BQU8sR0FBQyxDQUFDO0lBRXBDLE9BQU87UUFDTCxLQUFLO1FBQ0wsK0JBQStCLENBQUMsQ0FBQyxDQUFDLE1BQU0sK0JBQStCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU07S0FDekYsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLE9BQU8sQ0FDckIsT0FBNEIsRUFDNUIsT0FBdUIsRUFDdkIsYUFJSSxFQUFFO0lBRU4seUJBQXlCO0lBQ3pCLElBQUEsd0NBQThCLEVBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBRXRELElBQUksU0FBOEIsQ0FBQztJQUNuQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEtBQUssU0FBUyxFQUFFO1FBQy9CLFNBQVMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7S0FDNUI7SUFFRCxPQUFPLElBQUEsV0FBSSxFQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUM3RSxJQUFBLHFCQUFTLEVBQUMsS0FBSyxFQUFFLENBQUMsS0FBSyxFQUFFLGFBQWEsQ0FBQyxFQUFFLEVBQUU7O1FBQ3pDLE1BQU0sWUFBWSxHQUF1QjtZQUN2QyxTQUFTO1NBQ1YsQ0FBQztRQUVGLDZDQUE2QztRQUM3QyxJQUFJLE9BQU8sQ0FBQyxRQUFRLEVBQUU7WUFDcEIsWUFBWSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUNyRDtRQUVELElBQUksT0FBTyxDQUFDLFNBQVMsRUFBRTtZQUNyQix3RUFBd0U7WUFDeEUsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLFNBQVM7aUJBQ2hDLE1BQU0sQ0FBVyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQztpQkFDaEUsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFdEIsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDeEIsWUFBWSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7YUFDcEM7U0FDRjtRQUVELDZEQUE2RDtRQUM3RCxJQUFJLE1BQUEsT0FBTyxDQUFDLE9BQU8sMENBQUUsTUFBTSxFQUFFO1lBQzNCLE1BQU0sV0FBVyxHQUFHLE1BQUEsT0FBTyxDQUFDLE1BQU0sMENBQUUsT0FBTyxDQUFDO1lBQzVDLElBQUksQ0FBQyxXQUFXLEVBQUU7Z0JBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0NBQWdDLENBQUMsQ0FBQzthQUNuRDtZQUVELE1BQU0sZUFBZSxHQUFHLE1BQU0sT0FBTyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3RFLE1BQU0saUJBQWlCLEdBQUcsSUFBQSxvQkFBYSxFQUNyQyxJQUFBLFdBQUksRUFDRixJQUFBLGdCQUFTLEVBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxFQUNoQyxNQUFDLGVBQWUsQ0FBQyxJQUEyQixtQ0FBSSxFQUFFLEVBQ2xELE1BQUMsZUFBZSxDQUFDLFVBQWlDLG1DQUFJLEVBQUUsQ0FDekQsQ0FDRixDQUFDO1lBRUYsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFBLHNCQUFTLEVBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsYUFBYSxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFDekYsdUNBQXVDO1lBQ3ZDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFO2dCQUNqQixNQUFNLElBQUksS0FBSyxDQUNiLHdCQUF3QixPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsaUNBQWlDLENBQ3BGLENBQUM7YUFDSDtZQUVELHVFQUF1RTtZQUN2RSxNQUFNLEtBQUssR0FBRyxDQUFBLE1BQUEsYUFBYSxDQUFDLE1BQU0sMENBQUUsS0FBSyxLQUFJLEVBQUUsQ0FBQztZQUNoRCxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtnQkFDekIsYUFBYSxDQUFDLE1BQU0sR0FBRyxFQUFFLEtBQUssRUFBRSxDQUFDO2FBQ2xDO2lCQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRTtnQkFDdEMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO2FBQ3BDO1lBRUQsS0FBSyxDQUFDLE9BQU8sQ0FBQztnQkFDWixJQUFJLEVBQUUsSUFBQSxjQUFTLEVBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDO2dCQUNwRCxHQUFHLEVBQUU7b0JBQ0gsNkRBQTZEO29CQUM3RCxNQUFNLEVBQUUsaURBQXlCO29CQUNqQyxPQUFPLEVBQUU7d0JBQ1AsS0FBSzt3QkFDTCxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU07cUJBQ3ZCO2lCQUNGO2FBQ0YsQ0FBQyxDQUFDO1NBQ0o7UUFFRCxZQUFZLENBQUMsWUFBWSxHQUFHO1lBQzFCLE9BQU87WUFDUCxhQUFhO1lBQ2IsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNO1NBQ3ZCLENBQUM7UUFFRixNQUFNLE1BQU0sR0FBRyxNQUFNLEtBQUssQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUMzQyxJQUFBLGNBQVMsRUFBQyxPQUFPLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFDckQsVUFBVSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxFQUM5RSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxDQUMzQyxDQUFDO1FBRUYsT0FBTyxDQUFDLEtBQUssRUFBRSxNQUFNLENBQXVDLENBQUM7SUFDL0QsQ0FBQyxDQUFDLEVBQ0YsSUFBQSxxQkFBUyxFQUNQLENBQUMsQ0FBQyxLQUFLLEVBQUUsV0FBVyxDQUFDLEVBQUUsRUFBRSxDQUN2QixJQUFJLGlCQUFVLENBQWdCLENBQUMsVUFBVSxFQUFFLEVBQUU7OztRQUMzQyx1Q0FBdUM7UUFDdkMsTUFBQSxXQUFXLENBQUMsWUFBWSxvQ0FBeEIsV0FBVyxDQUFDLFlBQVksR0FBSyxFQUFFLEVBQUM7UUFDaEMsSUFBSSxPQUFPLFdBQVcsQ0FBQyxZQUFZLEtBQUssUUFBUSxFQUFFO1lBQ2hELDhEQUE4RDtZQUM5RCxZQUFDLFdBQVcsQ0FBQyxZQUFvQixFQUFDLFNBQVMsdUNBQVQsU0FBUyxHQUFLLEdBQUcsRUFBRSxDQUNuRCxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUM7WUFDdEMsOERBQThEO1lBQzlELFlBQUMsV0FBVyxDQUFDLFlBQW9CLEVBQUMsU0FBUyx1Q0FBVCxTQUFTLEdBQUssR0FBRyxFQUFFLENBQ25ELFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBQztTQUN0QztRQUVELHlEQUF5RDtRQUN6RCxNQUFNLFdBQVcsR0FBRyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsV0FBcUIsRUFBRSxDQUFDLFFBQVEsRUFBRSxFQUFFO1lBQ3ZFLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsUUFBUSxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDN0MsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3hCLENBQUMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBRXZDLGlDQUFpQztRQUNqQyxPQUFPLEdBQUcsRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFDekQsQ0FBQyxDQUFDLENBQ0wsRUFDRCxJQUFBLDBCQUFjLEVBQUMsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FDbkMsQ0FBQztBQUNKLENBQUM7QUE5SEQsMEJBOEhDO0FBR0Qsa0JBQWUsSUFBQSx5QkFBYSxFQUErQyxPQUFPLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgZ2V0U3lzdGVtUGF0aCwgam9pbiwgbm9ybWFsaXplIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgQ29uZmlnLCBDb25maWdPcHRpb25zIH0gZnJvbSAna2FybWEnO1xuaW1wb3J0IHsgcmVzb2x2ZSBhcyBmc1Jlc29sdmUgfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGRlZmF1bHRJZkVtcHR5LCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBFeGVjdXRpb25UcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHsgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUgfSBmcm9tICcuLi8uLi91dGlscy9wdXJnZS1jYWNoZSc7XG5pbXBvcnQgeyBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24gfSBmcm9tICcuLi8uLi91dGlscy92ZXJzaW9uJztcbmltcG9ydCB7IGdlbmVyYXRlQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dCB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgZ2V0Q29tbW9uQ29uZmlnLCBnZXRTdHlsZXNDb25maWcgfSBmcm9tICcuLi8uLi93ZWJwYWNrL2NvbmZpZ3MnO1xuaW1wb3J0IHsgU2luZ2xlVGVzdFRyYW5zZm9ybUxvYWRlciB9IGZyb20gJy4uLy4uL3dlYnBhY2svcGx1Z2lucy9zaW5nbGUtdGVzdC10cmFuc2Zvcm0nO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucywgT3V0cHV0SGFzaGluZyB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IGZpbmRUZXN0cyB9IGZyb20gJy4vZmluZC10ZXN0cyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgS2FybWFCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IHR5cGUgS2FybWFDb25maWdPcHRpb25zID0gQ29uZmlnT3B0aW9ucyAmIHtcbiAgYnVpbGRXZWJwYWNrPzogdW5rbm93bjtcbiAgY29uZmlnRmlsZT86IHN0cmluZztcbn07XG5cbmFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemUoXG4gIG9wdGlvbnM6IEthcm1hQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybWVyPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8Q29uZmlndXJhdGlvbj4sXG4pOiBQcm9taXNlPFt0eXBlb2YgaW1wb3J0KCdrYXJtYScpLCBDb25maWd1cmF0aW9uXT4ge1xuICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgYXdhaXQgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUoY29udGV4dCk7XG5cbiAgY29uc3QgeyBjb25maWcgfSA9IGF3YWl0IGdlbmVyYXRlQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChcbiAgICAvLyBvbmx5IHR3byBwcm9wZXJ0aWVzIGFyZSBtaXNzaW5nOlxuICAgIC8vICogYG91dHB1dFBhdGhgIHdoaWNoIGlzIGZpeGVkIGZvciB0ZXN0c1xuICAgIC8vICogYGJ1ZGdldHNgIHdoaWNoIG1pZ2h0IGJlIGluY29ycmVjdCBkdWUgdG8gZXh0cmEgZGV2IGxpYnNcbiAgICB7XG4gICAgICAuLi4ob3B0aW9ucyBhcyB1bmtub3duIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyksXG4gICAgICBvdXRwdXRQYXRoOiAnJyxcbiAgICAgIGJ1ZGdldHM6IHVuZGVmaW5lZCxcbiAgICAgIG9wdGltaXphdGlvbjogZmFsc2UsXG4gICAgICBidWlsZE9wdGltaXplcjogZmFsc2UsXG4gICAgICBhb3Q6IGZhbHNlLFxuICAgICAgdmVuZG9yQ2h1bms6IHRydWUsXG4gICAgICBuYW1lZENodW5rczogdHJ1ZSxcbiAgICAgIGV4dHJhY3RMaWNlbnNlczogZmFsc2UsXG4gICAgICBvdXRwdXRIYXNoaW5nOiBPdXRwdXRIYXNoaW5nLk5vbmUsXG4gICAgICAvLyBUaGUgd2VicGFjayB0aWVyIG93bnMgdGhlIHdhdGNoIGJlaGF2aW9yIHNvIHdlIHdhbnQgdG8gZm9yY2UgaXQgaW4gdGhlIGNvbmZpZy5cbiAgICAgIC8vIFdoZW4gbm90IGluIHdhdGNoIG1vZGUsIHdlYnBhY2stZGV2LW1pZGRsZXdhcmUgd2lsbCBjYWxsIGBjb21waWxlci53YXRjaGAgYW55d2F5LlxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay1kZXYtbWlkZGxld2FyZS9ibG9iLzY5OGM5YWU1ZTliYjlhMDEzOTg1YWRkNjE4OWZmMjFjMWExZWMxODUvc3JjL2luZGV4LmpzI0w2NVxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay9ibG9iL2NkZTFiNzNlMTJlYjhhNzdlYjliYTQyZTc5MjBjOWVjNWQyOWMyYzkvbGliL0NvbXBpbGVyLmpzI0wzNzktTDM4OFxuICAgICAgd2F0Y2g6IHRydWUsXG4gICAgfSxcbiAgICBjb250ZXh0LFxuICAgICh3Y28pID0+IFtnZXRDb21tb25Db25maWcod2NvKSwgZ2V0U3R5bGVzQ29uZmlnKHdjbyldLFxuICApO1xuXG4gIGNvbnN0IGthcm1hID0gYXdhaXQgaW1wb3J0KCdrYXJtYScpO1xuXG4gIHJldHVybiBbXG4gICAga2FybWEsXG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm1lciA/IGF3YWl0IHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtZXIoY29uZmlnKSA6IGNvbmZpZyxcbiAgXTtcbn1cblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZXhlY3V0ZShcbiAgb3B0aW9uczogS2FybWFCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHRyYW5zZm9ybXM6IHtcbiAgICB3ZWJwYWNrQ29uZmlndXJhdGlvbj86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPENvbmZpZ3VyYXRpb24+O1xuICAgIC8vIFRoZSBrYXJtYSBvcHRpb25zIHRyYW5zZm9ybSBjYW5ub3QgYmUgYXN5bmMgd2l0aG91dCBhIHJlZmFjdG9yIG9mIHRoZSBidWlsZGVyIGltcGxlbWVudGF0aW9uXG4gICAga2FybWFPcHRpb25zPzogKG9wdGlvbnM6IEthcm1hQ29uZmlnT3B0aW9ucykgPT4gS2FybWFDb25maWdPcHRpb25zO1xuICB9ID0ge30sXG4pOiBPYnNlcnZhYmxlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gQ2hlY2sgQW5ndWxhciB2ZXJzaW9uLlxuICBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24oY29udGV4dC53b3Jrc3BhY2VSb290KTtcblxuICBsZXQgc2luZ2xlUnVuOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICBpZiAob3B0aW9ucy53YXRjaCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgc2luZ2xlUnVuID0gIW9wdGlvbnMud2F0Y2g7XG4gIH1cblxuICByZXR1cm4gZnJvbShpbml0aWFsaXplKG9wdGlvbnMsIGNvbnRleHQsIHRyYW5zZm9ybXMud2VicGFja0NvbmZpZ3VyYXRpb24pKS5waXBlKFxuICAgIHN3aXRjaE1hcChhc3luYyAoW2thcm1hLCB3ZWJwYWNrQ29uZmlnXSkgPT4ge1xuICAgICAgY29uc3Qga2FybWFPcHRpb25zOiBLYXJtYUNvbmZpZ09wdGlvbnMgPSB7XG4gICAgICAgIHNpbmdsZVJ1bixcbiAgICAgIH07XG5cbiAgICAgIC8vIENvbnZlcnQgYnJvd3NlcnMgZnJvbSBhIHN0cmluZyB0byBhbiBhcnJheVxuICAgICAgaWYgKG9wdGlvbnMuYnJvd3NlcnMpIHtcbiAgICAgICAga2FybWFPcHRpb25zLmJyb3dzZXJzID0gb3B0aW9ucy5icm93c2Vycy5zcGxpdCgnLCcpO1xuICAgICAgfVxuXG4gICAgICBpZiAob3B0aW9ucy5yZXBvcnRlcnMpIHtcbiAgICAgICAgLy8gU3BsaXQgYWxvbmcgY29tbWFzIHRvIG1ha2UgaXQgbW9yZSBuYXR1cmFsLCBhbmQgcmVtb3ZlIGVtcHR5IHN0cmluZ3MuXG4gICAgICAgIGNvbnN0IHJlcG9ydGVycyA9IG9wdGlvbnMucmVwb3J0ZXJzXG4gICAgICAgICAgLnJlZHVjZTxzdHJpbmdbXT4oKGFjYywgY3VycikgPT4gYWNjLmNvbmNhdChjdXJyLnNwbGl0KCcsJykpLCBbXSlcbiAgICAgICAgICAuZmlsdGVyKCh4KSA9PiAhIXgpO1xuXG4gICAgICAgIGlmIChyZXBvcnRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGthcm1hT3B0aW9ucy5yZXBvcnRlcnMgPSByZXBvcnRlcnM7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gcHJlcGVuZCBzcGVjaWFsIHdlYnBhY2sgbG9hZGVyIHRoYXQgd2lsbCB0cmFuc2Zvcm0gdGVzdC50c1xuICAgICAgaWYgKG9wdGlvbnMuaW5jbHVkZT8ubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQ/LnByb2plY3Q7XG4gICAgICAgIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0LicpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcHJvamVjdE1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICAgICAgICBjb25zdCBwcm9qZWN0U291cmNlUm9vdCA9IGdldFN5c3RlbVBhdGgoXG4gICAgICAgICAgam9pbihcbiAgICAgICAgICAgIG5vcm1hbGl6ZShjb250ZXh0LndvcmtzcGFjZVJvb3QpLFxuICAgICAgICAgICAgKHByb2plY3RNZXRhZGF0YS5yb290IGFzIHN0cmluZyB8IHVuZGVmaW5lZCkgPz8gJycsXG4gICAgICAgICAgICAocHJvamVjdE1ldGFkYXRhLnNvdXJjZVJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnJyxcbiAgICAgICAgICApLFxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IGZpbGVzID0gYXdhaXQgZmluZFRlc3RzKG9wdGlvbnMuaW5jbHVkZSwgY29udGV4dC53b3Jrc3BhY2VSb290LCBwcm9qZWN0U291cmNlUm9vdCk7XG4gICAgICAgIC8vIGVhcmx5IGV4aXQsIG5vIHJlYXNvbiB0byBzdGFydCBrYXJtYVxuICAgICAgICBpZiAoIWZpbGVzLmxlbmd0aCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBTcGVjaWZpZWQgcGF0dGVybnM6IFwiJHtvcHRpb25zLmluY2x1ZGUuam9pbignLCAnKX1cIiBkaWQgbm90IG1hdGNoIGFueSBzcGVjIGZpbGVzLmAsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdldCB0aGUgcnVsZXMgYW5kIGVuc3VyZSB0aGUgV2VicGFjayBjb25maWd1cmF0aW9uIGlzIHNldHVwIHByb3Blcmx5XG4gICAgICAgIGNvbnN0IHJ1bGVzID0gd2VicGFja0NvbmZpZy5tb2R1bGU/LnJ1bGVzIHx8IFtdO1xuICAgICAgICBpZiAoIXdlYnBhY2tDb25maWcubW9kdWxlKSB7XG4gICAgICAgICAgd2VicGFja0NvbmZpZy5tb2R1bGUgPSB7IHJ1bGVzIH07XG4gICAgICAgIH0gZWxzZSBpZiAoIXdlYnBhY2tDb25maWcubW9kdWxlLnJ1bGVzKSB7XG4gICAgICAgICAgd2VicGFja0NvbmZpZy5tb2R1bGUucnVsZXMgPSBydWxlcztcbiAgICAgICAgfVxuXG4gICAgICAgIHJ1bGVzLnVuc2hpZnQoe1xuICAgICAgICAgIHRlc3Q6IGZzUmVzb2x2ZShjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9wdGlvbnMubWFpbiksXG4gICAgICAgICAgdXNlOiB7XG4gICAgICAgICAgICAvLyBjYW5ub3QgYmUgYSBzaW1wbGUgcGF0aCBhcyBpdCBkaWZmZXJzIGJldHdlZW4gZW52aXJvbm1lbnRzXG4gICAgICAgICAgICBsb2FkZXI6IFNpbmdsZVRlc3RUcmFuc2Zvcm1Mb2FkZXIsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGZpbGVzLFxuICAgICAgICAgICAgICBsb2dnZXI6IGNvbnRleHQubG9nZ2VyLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAga2FybWFPcHRpb25zLmJ1aWxkV2VicGFjayA9IHtcbiAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgd2VicGFja0NvbmZpZyxcbiAgICAgICAgbG9nZ2VyOiBjb250ZXh0LmxvZ2dlcixcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IGthcm1hLmNvbmZpZy5wYXJzZUNvbmZpZyhcbiAgICAgICAgZnNSZXNvbHZlKGNvbnRleHQud29ya3NwYWNlUm9vdCwgb3B0aW9ucy5rYXJtYUNvbmZpZyksXG4gICAgICAgIHRyYW5zZm9ybXMua2FybWFPcHRpb25zID8gdHJhbnNmb3Jtcy5rYXJtYU9wdGlvbnMoa2FybWFPcHRpb25zKSA6IGthcm1hT3B0aW9ucyxcbiAgICAgICAgeyBwcm9taXNlQ29uZmlnOiB0cnVlLCB0aHJvd0Vycm9yczogdHJ1ZSB9LFxuICAgICAgKTtcblxuICAgICAgcmV0dXJuIFtrYXJtYSwgY29uZmlnXSBhcyBbdHlwZW9mIGthcm1hLCBLYXJtYUNvbmZpZ09wdGlvbnNdO1xuICAgIH0pLFxuICAgIHN3aXRjaE1hcChcbiAgICAgIChba2FybWEsIGthcm1hQ29uZmlnXSkgPT5cbiAgICAgICAgbmV3IE9ic2VydmFibGU8QnVpbGRlck91dHB1dD4oKHN1YnNjcmliZXIpID0+IHtcbiAgICAgICAgICAvLyBQYXNzIG9udG8gS2FybWEgdG8gZW1pdCBCdWlsZEV2ZW50cy5cbiAgICAgICAgICBrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgPz89IHt9O1xuICAgICAgICAgIGlmICh0eXBlb2Yga2FybWFDb25maWcuYnVpbGRXZWJwYWNrID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICAgIChrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgYXMgYW55KS5mYWlsdXJlQ2IgPz89ICgpID0+XG4gICAgICAgICAgICAgIHN1YnNjcmliZXIubmV4dCh7IHN1Y2Nlc3M6IGZhbHNlIH0pO1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICAgIChrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgYXMgYW55KS5zdWNjZXNzQ2IgPz89ICgpID0+XG4gICAgICAgICAgICAgIHN1YnNjcmliZXIubmV4dCh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQ29tcGxldGUgdGhlIG9ic2VydmFibGUgb25jZSB0aGUgS2FybWEgc2VydmVyIHJldHVybnMuXG4gICAgICAgICAgY29uc3Qga2FybWFTZXJ2ZXIgPSBuZXcga2FybWEuU2VydmVyKGthcm1hQ29uZmlnIGFzIENvbmZpZywgKGV4aXRDb2RlKSA9PiB7XG4gICAgICAgICAgICBzdWJzY3JpYmVyLm5leHQoeyBzdWNjZXNzOiBleGl0Q29kZSA9PT0gMCB9KTtcbiAgICAgICAgICAgIHN1YnNjcmliZXIuY29tcGxldGUoKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGNvbnN0IGthcm1hU3RhcnQgPSBrYXJtYVNlcnZlci5zdGFydCgpO1xuXG4gICAgICAgICAgLy8gQ2xlYW51cCwgc2lnbmFsIEthcm1hIHRvIGV4aXQuXG4gICAgICAgICAgcmV0dXJuICgpID0+IGthcm1hU3RhcnQudGhlbigoKSA9PiBrYXJtYVNlcnZlci5zdG9wKCkpO1xuICAgICAgICB9KSxcbiAgICApLFxuICAgIGRlZmF1bHRJZkVtcHR5KHsgc3VjY2VzczogZmFsc2UgfSksXG4gICk7XG59XG5cbmV4cG9ydCB7IEthcm1hQnVpbGRlck9wdGlvbnMgfTtcbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXI8UmVjb3JkPHN0cmluZywgc3RyaW5nPiAmIEthcm1hQnVpbGRlck9wdGlvbnM+KGV4ZWN1dGUpO1xuIl19