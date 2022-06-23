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
const path = __importStar(require("path"));
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
            const sourceRoot = ((_d = (_c = projectMetadata.sourceRoot) !== null && _c !== void 0 ? _c : projectMetadata.root) !== null && _d !== void 0 ? _d : '');
            const projectSourceRoot = path.join(context.workspaceRoot, sourceRoot);
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
                test: path.resolve(context.workspaceRoot, options.main),
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
        const config = await karma.config.parseConfig(path.resolve(context.workspaceRoot, options.karmaConfig), transforms.karmaOptions ? transforms.karmaOptions(karmaOptions) : karmaOptions, { promiseConfig: true, throwErrors: true });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9rYXJtYS9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUF5RjtBQUV6RiwyQ0FBNkI7QUFDN0IsK0JBQXdDO0FBQ3hDLDhDQUEyRDtBQUczRCx5REFBK0Q7QUFDL0QsaURBQXFFO0FBQ3JFLCtFQUE2RjtBQUM3RixtREFBeUU7QUFDekUsdUZBQXdGO0FBQ3hGLDhDQUFtRjtBQUNuRiw2Q0FBeUM7QUFRekMsS0FBSyxVQUFVLFVBQVUsQ0FDdkIsT0FBNEIsRUFDNUIsT0FBdUIsRUFDdkIsK0JBQXFFO0lBRXJFLDhCQUE4QjtJQUM5QixNQUFNLElBQUEsa0NBQW9CLEVBQUMsT0FBTyxDQUFDLENBQUM7SUFFcEMsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBQSxnRUFBdUM7SUFDOUQsbUNBQW1DO0lBQ25DLDBDQUEwQztJQUMxQyw2REFBNkQ7SUFDN0Q7UUFDRSxHQUFJLE9BQTRDO1FBQ2hELFVBQVUsRUFBRSxFQUFFO1FBQ2QsT0FBTyxFQUFFLFNBQVM7UUFDbEIsWUFBWSxFQUFFLEtBQUs7UUFDbkIsY0FBYyxFQUFFLEtBQUs7UUFDckIsR0FBRyxFQUFFLEtBQUs7UUFDVixXQUFXLEVBQUUsSUFBSTtRQUNqQixXQUFXLEVBQUUsSUFBSTtRQUNqQixlQUFlLEVBQUUsS0FBSztRQUN0QixhQUFhLEVBQUUsc0JBQWEsQ0FBQyxJQUFJO1FBQ2pDLGlGQUFpRjtRQUNqRixvRkFBb0Y7UUFDcEYsbUhBQW1IO1FBQ25ILDZHQUE2RztRQUM3RyxLQUFLLEVBQUUsSUFBSTtLQUNaLEVBQ0QsT0FBTyxFQUNQLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLENBQUMsQ0FDdEQsQ0FBQztJQUVGLE1BQU0sS0FBSyxHQUFHLHdEQUFhLE9BQU8sR0FBQyxDQUFDO0lBRXBDLE9BQU87UUFDTCxLQUFLO1FBQ0wsK0JBQStCLENBQUMsQ0FBQyxDQUFDLE1BQU0sK0JBQStCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU07S0FDekYsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLE9BQU8sQ0FDckIsT0FBNEIsRUFDNUIsT0FBdUIsRUFDdkIsYUFJSSxFQUFFO0lBRU4seUJBQXlCO0lBQ3pCLElBQUEsd0NBQThCLEVBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBRXRELElBQUksU0FBOEIsQ0FBQztJQUNuQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEtBQUssU0FBUyxFQUFFO1FBQy9CLFNBQVMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7S0FDNUI7SUFFRCxPQUFPLElBQUEsV0FBSSxFQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUM3RSxJQUFBLHFCQUFTLEVBQUMsS0FBSyxFQUFFLENBQUMsS0FBSyxFQUFFLGFBQWEsQ0FBQyxFQUFFLEVBQUU7O1FBQ3pDLE1BQU0sWUFBWSxHQUF1QjtZQUN2QyxTQUFTO1NBQ1YsQ0FBQztRQUVGLDZDQUE2QztRQUM3QyxJQUFJLE9BQU8sQ0FBQyxRQUFRLEVBQUU7WUFDcEIsWUFBWSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUNyRDtRQUVELElBQUksT0FBTyxDQUFDLFNBQVMsRUFBRTtZQUNyQix3RUFBd0U7WUFDeEUsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLFNBQVM7aUJBQ2hDLE1BQU0sQ0FBVyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQztpQkFDaEUsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFdEIsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDeEIsWUFBWSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7YUFDcEM7U0FDRjtRQUVELDZEQUE2RDtRQUM3RCxJQUFJLE1BQUEsT0FBTyxDQUFDLE9BQU8sMENBQUUsTUFBTSxFQUFFO1lBQzNCLE1BQU0sV0FBVyxHQUFHLE1BQUEsT0FBTyxDQUFDLE1BQU0sMENBQUUsT0FBTyxDQUFDO1lBQzVDLElBQUksQ0FBQyxXQUFXLEVBQUU7Z0JBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0NBQWdDLENBQUMsQ0FBQzthQUNuRDtZQUVELE1BQU0sZUFBZSxHQUFHLE1BQU0sT0FBTyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3RFLE1BQU0sVUFBVSxHQUFHLENBQUMsTUFBQSxNQUFBLGVBQWUsQ0FBQyxVQUFVLG1DQUFJLGVBQWUsQ0FBQyxJQUFJLG1DQUFJLEVBQUUsQ0FBVyxDQUFDO1lBQ3hGLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBRXZFLE1BQU0sS0FBSyxHQUFHLE1BQU0sSUFBQSxzQkFBUyxFQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLGFBQWEsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1lBQ3pGLHVDQUF1QztZQUN2QyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRTtnQkFDakIsTUFBTSxJQUFJLEtBQUssQ0FDYix3QkFBd0IsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGlDQUFpQyxDQUNwRixDQUFDO2FBQ0g7WUFFRCx1RUFBdUU7WUFDdkUsTUFBTSxLQUFLLEdBQUcsQ0FBQSxNQUFBLGFBQWEsQ0FBQyxNQUFNLDBDQUFFLEtBQUssS0FBSSxFQUFFLENBQUM7WUFDaEQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7Z0JBQ3pCLGFBQWEsQ0FBQyxNQUFNLEdBQUcsRUFBRSxLQUFLLEVBQUUsQ0FBQzthQUNsQztpQkFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUU7Z0JBQ3RDLGFBQWEsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQzthQUNwQztZQUVELEtBQUssQ0FBQyxPQUFPLENBQUM7Z0JBQ1osSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDO2dCQUN2RCxHQUFHLEVBQUU7b0JBQ0gsNkRBQTZEO29CQUM3RCxNQUFNLEVBQUUsaURBQXlCO29CQUNqQyxPQUFPLEVBQUU7d0JBQ1AsS0FBSzt3QkFDTCxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU07cUJBQ3ZCO2lCQUNGO2FBQ0YsQ0FBQyxDQUFDO1NBQ0o7UUFFRCxZQUFZLENBQUMsWUFBWSxHQUFHO1lBQzFCLE9BQU87WUFDUCxhQUFhO1lBQ2IsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNO1NBQ3ZCLENBQUM7UUFFRixNQUFNLE1BQU0sR0FBRyxNQUFNLEtBQUssQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUMzQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUN4RCxVQUFVLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLEVBQzlFLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLENBQzNDLENBQUM7UUFFRixPQUFPLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBdUMsQ0FBQztJQUMvRCxDQUFDLENBQUMsRUFDRixJQUFBLHFCQUFTLEVBQ1AsQ0FBQyxDQUFDLEtBQUssRUFBRSxXQUFXLENBQUMsRUFBRSxFQUFFLENBQ3ZCLElBQUksaUJBQVUsQ0FBZ0IsQ0FBQyxVQUFVLEVBQUUsRUFBRTs7O1FBQzNDLHVDQUF1QztRQUN2QyxNQUFBLFdBQVcsQ0FBQyxZQUFZLG9DQUF4QixXQUFXLENBQUMsWUFBWSxHQUFLLEVBQUUsRUFBQztRQUNoQyxJQUFJLE9BQU8sV0FBVyxDQUFDLFlBQVksS0FBSyxRQUFRLEVBQUU7WUFDaEQsOERBQThEO1lBQzlELFlBQUMsV0FBVyxDQUFDLFlBQW9CLEVBQUMsU0FBUyx1Q0FBVCxTQUFTLEdBQUssR0FBRyxFQUFFLENBQ25ELFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBQztZQUN0Qyw4REFBOEQ7WUFDOUQsWUFBQyxXQUFXLENBQUMsWUFBb0IsRUFBQyxTQUFTLHVDQUFULFNBQVMsR0FBSyxHQUFHLEVBQUUsQ0FDbkQsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFDO1NBQ3RDO1FBRUQseURBQXlEO1FBQ3pELE1BQU0sV0FBVyxHQUFHLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxXQUFxQixFQUFFLENBQUMsUUFBUSxFQUFFLEVBQUU7WUFDdkUsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxRQUFRLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUM3QyxVQUFVLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDeEIsQ0FBQyxDQUFDLENBQUM7UUFFSCxNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFdkMsaUNBQWlDO1FBQ2pDLE9BQU8sR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUN6RCxDQUFDLENBQUMsQ0FDTCxFQUNELElBQUEsMEJBQWMsRUFBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUNuQyxDQUFDO0FBQ0osQ0FBQztBQXpIRCwwQkF5SEM7QUFHRCxrQkFBZSxJQUFBLHlCQUFhLEVBQStDLE9BQU8sQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBDb25maWcsIENvbmZpZ09wdGlvbnMgfSBmcm9tICdrYXJtYSc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgZGVmYXVsdElmRW1wdHksIHN3aXRjaE1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb24gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IEV4ZWN1dGlvblRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vdHJhbnNmb3Jtcyc7XG5pbXBvcnQgeyBwdXJnZVN0YWxlQnVpbGRDYWNoZSB9IGZyb20gJy4uLy4uL3V0aWxzL3B1cmdlLWNhY2hlJztcbmltcG9ydCB7IGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbiB9IGZyb20gJy4uLy4uL3V0aWxzL3ZlcnNpb24nO1xuaW1wb3J0IHsgZ2VuZXJhdGVCcm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0IH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBnZXRDb21tb25Db25maWcsIGdldFN0eWxlc0NvbmZpZyB9IGZyb20gJy4uLy4uL3dlYnBhY2svY29uZmlncyc7XG5pbXBvcnQgeyBTaW5nbGVUZXN0VHJhbnNmb3JtTG9hZGVyIH0gZnJvbSAnLi4vLi4vd2VicGFjay9wbHVnaW5zL3NpbmdsZS10ZXN0LXRyYW5zZm9ybSc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zLCBPdXRwdXRIYXNoaW5nIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgZmluZFRlc3RzIH0gZnJvbSAnLi9maW5kLXRlc3RzJztcbmltcG9ydCB7IFNjaGVtYSBhcyBLYXJtYUJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5leHBvcnQgdHlwZSBLYXJtYUNvbmZpZ09wdGlvbnMgPSBDb25maWdPcHRpb25zICYge1xuICBidWlsZFdlYnBhY2s/OiB1bmtub3duO1xuICBjb25maWdGaWxlPzogc3RyaW5nO1xufTtcblxuYXN5bmMgZnVuY3Rpb24gaW5pdGlhbGl6ZShcbiAgb3B0aW9uczogS2FybWFCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtZXI/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjxDb25maWd1cmF0aW9uPixcbik6IFByb21pc2U8W3R5cGVvZiBpbXBvcnQoJ2thcm1hJyksIENvbmZpZ3VyYXRpb25dPiB7XG4gIC8vIFB1cmdlIG9sZCBidWlsZCBkaXNrIGNhY2hlLlxuICBhd2FpdCBwdXJnZVN0YWxlQnVpbGRDYWNoZShjb250ZXh0KTtcblxuICBjb25zdCB7IGNvbmZpZyB9ID0gYXdhaXQgZ2VuZXJhdGVCcm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KFxuICAgIC8vIG9ubHkgdHdvIHByb3BlcnRpZXMgYXJlIG1pc3Npbmc6XG4gICAgLy8gKiBgb3V0cHV0UGF0aGAgd2hpY2ggaXMgZml4ZWQgZm9yIHRlc3RzXG4gICAgLy8gKiBgYnVkZ2V0c2Agd2hpY2ggbWlnaHQgYmUgaW5jb3JyZWN0IGR1ZSB0byBleHRyYSBkZXYgbGlic1xuICAgIHtcbiAgICAgIC4uLihvcHRpb25zIGFzIHVua25vd24gYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zKSxcbiAgICAgIG91dHB1dFBhdGg6ICcnLFxuICAgICAgYnVkZ2V0czogdW5kZWZpbmVkLFxuICAgICAgb3B0aW1pemF0aW9uOiBmYWxzZSxcbiAgICAgIGJ1aWxkT3B0aW1pemVyOiBmYWxzZSxcbiAgICAgIGFvdDogZmFsc2UsXG4gICAgICB2ZW5kb3JDaHVuazogdHJ1ZSxcbiAgICAgIG5hbWVkQ2h1bmtzOiB0cnVlLFxuICAgICAgZXh0cmFjdExpY2Vuc2VzOiBmYWxzZSxcbiAgICAgIG91dHB1dEhhc2hpbmc6IE91dHB1dEhhc2hpbmcuTm9uZSxcbiAgICAgIC8vIFRoZSB3ZWJwYWNrIHRpZXIgb3ducyB0aGUgd2F0Y2ggYmVoYXZpb3Igc28gd2Ugd2FudCB0byBmb3JjZSBpdCBpbiB0aGUgY29uZmlnLlxuICAgICAgLy8gV2hlbiBub3QgaW4gd2F0Y2ggbW9kZSwgd2VicGFjay1kZXYtbWlkZGxld2FyZSB3aWxsIGNhbGwgYGNvbXBpbGVyLndhdGNoYCBhbnl3YXkuXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay93ZWJwYWNrLWRldi1taWRkbGV3YXJlL2Jsb2IvNjk4YzlhZTVlOWJiOWEwMTM5ODVhZGQ2MTg5ZmYyMWMxYTFlYzE4NS9zcmMvaW5kZXguanMjTDY1XG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay93ZWJwYWNrL2Jsb2IvY2RlMWI3M2UxMmViOGE3N2ViOWJhNDJlNzkyMGM5ZWM1ZDI5YzJjOS9saWIvQ29tcGlsZXIuanMjTDM3OS1MMzg4XG4gICAgICB3YXRjaDogdHJ1ZSxcbiAgICB9LFxuICAgIGNvbnRleHQsXG4gICAgKHdjbykgPT4gW2dldENvbW1vbkNvbmZpZyh3Y28pLCBnZXRTdHlsZXNDb25maWcod2NvKV0sXG4gICk7XG5cbiAgY29uc3Qga2FybWEgPSBhd2FpdCBpbXBvcnQoJ2thcm1hJyk7XG5cbiAgcmV0dXJuIFtcbiAgICBrYXJtYSxcbiAgICB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybWVyID8gYXdhaXQgd2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm1lcihjb25maWcpIDogY29uZmlnLFxuICBdO1xufVxuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleGVjdXRlKFxuICBvcHRpb25zOiBLYXJtYUJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgdHJhbnNmb3Jtczoge1xuICAgIHdlYnBhY2tDb25maWd1cmF0aW9uPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8Q29uZmlndXJhdGlvbj47XG4gICAgLy8gVGhlIGthcm1hIG9wdGlvbnMgdHJhbnNmb3JtIGNhbm5vdCBiZSBhc3luYyB3aXRob3V0IGEgcmVmYWN0b3Igb2YgdGhlIGJ1aWxkZXIgaW1wbGVtZW50YXRpb25cbiAgICBrYXJtYU9wdGlvbnM/OiAob3B0aW9uczogS2FybWFDb25maWdPcHRpb25zKSA9PiBLYXJtYUNvbmZpZ09wdGlvbnM7XG4gIH0gPSB7fSxcbik6IE9ic2VydmFibGU8QnVpbGRlck91dHB1dD4ge1xuICAvLyBDaGVjayBBbmd1bGFyIHZlcnNpb24uXG4gIGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbihjb250ZXh0LndvcmtzcGFjZVJvb3QpO1xuXG4gIGxldCBzaW5nbGVSdW46IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG4gIGlmIChvcHRpb25zLndhdGNoICE9PSB1bmRlZmluZWQpIHtcbiAgICBzaW5nbGVSdW4gPSAhb3B0aW9ucy53YXRjaDtcbiAgfVxuXG4gIHJldHVybiBmcm9tKGluaXRpYWxpemUob3B0aW9ucywgY29udGV4dCwgdHJhbnNmb3Jtcy53ZWJwYWNrQ29uZmlndXJhdGlvbikpLnBpcGUoXG4gICAgc3dpdGNoTWFwKGFzeW5jIChba2FybWEsIHdlYnBhY2tDb25maWddKSA9PiB7XG4gICAgICBjb25zdCBrYXJtYU9wdGlvbnM6IEthcm1hQ29uZmlnT3B0aW9ucyA9IHtcbiAgICAgICAgc2luZ2xlUnVuLFxuICAgICAgfTtcblxuICAgICAgLy8gQ29udmVydCBicm93c2VycyBmcm9tIGEgc3RyaW5nIHRvIGFuIGFycmF5XG4gICAgICBpZiAob3B0aW9ucy5icm93c2Vycykge1xuICAgICAgICBrYXJtYU9wdGlvbnMuYnJvd3NlcnMgPSBvcHRpb25zLmJyb3dzZXJzLnNwbGl0KCcsJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLnJlcG9ydGVycykge1xuICAgICAgICAvLyBTcGxpdCBhbG9uZyBjb21tYXMgdG8gbWFrZSBpdCBtb3JlIG5hdHVyYWwsIGFuZCByZW1vdmUgZW1wdHkgc3RyaW5ncy5cbiAgICAgICAgY29uc3QgcmVwb3J0ZXJzID0gb3B0aW9ucy5yZXBvcnRlcnNcbiAgICAgICAgICAucmVkdWNlPHN0cmluZ1tdPigoYWNjLCBjdXJyKSA9PiBhY2MuY29uY2F0KGN1cnIuc3BsaXQoJywnKSksIFtdKVxuICAgICAgICAgIC5maWx0ZXIoKHgpID0+ICEheCk7XG5cbiAgICAgICAgaWYgKHJlcG9ydGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAga2FybWFPcHRpb25zLnJlcG9ydGVycyA9IHJlcG9ydGVycztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBwcmVwZW5kIHNwZWNpYWwgd2VicGFjayBsb2FkZXIgdGhhdCB3aWxsIHRyYW5zZm9ybSB0ZXN0LnRzXG4gICAgICBpZiAob3B0aW9ucy5pbmNsdWRlPy5sZW5ndGgpIHtcbiAgICAgICAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgICAgICAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQuJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcm9qZWN0TWV0YWRhdGEgPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gICAgICAgIGNvbnN0IHNvdXJjZVJvb3QgPSAocHJvamVjdE1ldGFkYXRhLnNvdXJjZVJvb3QgPz8gcHJvamVjdE1ldGFkYXRhLnJvb3QgPz8gJycpIGFzIHN0cmluZztcbiAgICAgICAgY29uc3QgcHJvamVjdFNvdXJjZVJvb3QgPSBwYXRoLmpvaW4oY29udGV4dC53b3Jrc3BhY2VSb290LCBzb3VyY2VSb290KTtcblxuICAgICAgICBjb25zdCBmaWxlcyA9IGF3YWl0IGZpbmRUZXN0cyhvcHRpb25zLmluY2x1ZGUsIGNvbnRleHQud29ya3NwYWNlUm9vdCwgcHJvamVjdFNvdXJjZVJvb3QpO1xuICAgICAgICAvLyBlYXJseSBleGl0LCBubyByZWFzb24gdG8gc3RhcnQga2FybWFcbiAgICAgICAgaWYgKCFmaWxlcy5sZW5ndGgpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgU3BlY2lmaWVkIHBhdHRlcm5zOiBcIiR7b3B0aW9ucy5pbmNsdWRlLmpvaW4oJywgJyl9XCIgZGlkIG5vdCBtYXRjaCBhbnkgc3BlYyBmaWxlcy5gLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBHZXQgdGhlIHJ1bGVzIGFuZCBlbnN1cmUgdGhlIFdlYnBhY2sgY29uZmlndXJhdGlvbiBpcyBzZXR1cCBwcm9wZXJseVxuICAgICAgICBjb25zdCBydWxlcyA9IHdlYnBhY2tDb25maWcubW9kdWxlPy5ydWxlcyB8fCBbXTtcbiAgICAgICAgaWYgKCF3ZWJwYWNrQ29uZmlnLm1vZHVsZSkge1xuICAgICAgICAgIHdlYnBhY2tDb25maWcubW9kdWxlID0geyBydWxlcyB9O1xuICAgICAgICB9IGVsc2UgaWYgKCF3ZWJwYWNrQ29uZmlnLm1vZHVsZS5ydWxlcykge1xuICAgICAgICAgIHdlYnBhY2tDb25maWcubW9kdWxlLnJ1bGVzID0gcnVsZXM7XG4gICAgICAgIH1cblxuICAgICAgICBydWxlcy51bnNoaWZ0KHtcbiAgICAgICAgICB0ZXN0OiBwYXRoLnJlc29sdmUoY29udGV4dC53b3Jrc3BhY2VSb290LCBvcHRpb25zLm1haW4pLFxuICAgICAgICAgIHVzZToge1xuICAgICAgICAgICAgLy8gY2Fubm90IGJlIGEgc2ltcGxlIHBhdGggYXMgaXQgZGlmZmVycyBiZXR3ZWVuIGVudmlyb25tZW50c1xuICAgICAgICAgICAgbG9hZGVyOiBTaW5nbGVUZXN0VHJhbnNmb3JtTG9hZGVyLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBmaWxlcyxcbiAgICAgICAgICAgICAgbG9nZ2VyOiBjb250ZXh0LmxvZ2dlcixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGthcm1hT3B0aW9ucy5idWlsZFdlYnBhY2sgPSB7XG4gICAgICAgIG9wdGlvbnMsXG4gICAgICAgIHdlYnBhY2tDb25maWcsXG4gICAgICAgIGxvZ2dlcjogY29udGV4dC5sb2dnZXIsXG4gICAgICB9O1xuXG4gICAgICBjb25zdCBjb25maWcgPSBhd2FpdCBrYXJtYS5jb25maWcucGFyc2VDb25maWcoXG4gICAgICAgIHBhdGgucmVzb2x2ZShjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9wdGlvbnMua2FybWFDb25maWcpLFxuICAgICAgICB0cmFuc2Zvcm1zLmthcm1hT3B0aW9ucyA/IHRyYW5zZm9ybXMua2FybWFPcHRpb25zKGthcm1hT3B0aW9ucykgOiBrYXJtYU9wdGlvbnMsXG4gICAgICAgIHsgcHJvbWlzZUNvbmZpZzogdHJ1ZSwgdGhyb3dFcnJvcnM6IHRydWUgfSxcbiAgICAgICk7XG5cbiAgICAgIHJldHVybiBba2FybWEsIGNvbmZpZ10gYXMgW3R5cGVvZiBrYXJtYSwgS2FybWFDb25maWdPcHRpb25zXTtcbiAgICB9KSxcbiAgICBzd2l0Y2hNYXAoXG4gICAgICAoW2thcm1hLCBrYXJtYUNvbmZpZ10pID0+XG4gICAgICAgIG5ldyBPYnNlcnZhYmxlPEJ1aWxkZXJPdXRwdXQ+KChzdWJzY3JpYmVyKSA9PiB7XG4gICAgICAgICAgLy8gUGFzcyBvbnRvIEthcm1hIHRvIGVtaXQgQnVpbGRFdmVudHMuXG4gICAgICAgICAga2FybWFDb25maWcuYnVpbGRXZWJwYWNrID8/PSB7fTtcbiAgICAgICAgICBpZiAodHlwZW9mIGthcm1hQ29uZmlnLmJ1aWxkV2VicGFjayA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAgICAgICAoa2FybWFDb25maWcuYnVpbGRXZWJwYWNrIGFzIGFueSkuZmFpbHVyZUNiID8/PSAoKSA9PlxuICAgICAgICAgICAgICBzdWJzY3JpYmVyLm5leHQoeyBzdWNjZXNzOiBmYWxzZSB9KTtcbiAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAgICAgICAoa2FybWFDb25maWcuYnVpbGRXZWJwYWNrIGFzIGFueSkuc3VjY2Vzc0NiID8/PSAoKSA9PlxuICAgICAgICAgICAgICBzdWJzY3JpYmVyLm5leHQoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIENvbXBsZXRlIHRoZSBvYnNlcnZhYmxlIG9uY2UgdGhlIEthcm1hIHNlcnZlciByZXR1cm5zLlxuICAgICAgICAgIGNvbnN0IGthcm1hU2VydmVyID0gbmV3IGthcm1hLlNlcnZlcihrYXJtYUNvbmZpZyBhcyBDb25maWcsIChleGl0Q29kZSkgPT4ge1xuICAgICAgICAgICAgc3Vic2NyaWJlci5uZXh0KHsgc3VjY2VzczogZXhpdENvZGUgPT09IDAgfSk7XG4gICAgICAgICAgICBzdWJzY3JpYmVyLmNvbXBsZXRlKCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBjb25zdCBrYXJtYVN0YXJ0ID0ga2FybWFTZXJ2ZXIuc3RhcnQoKTtcblxuICAgICAgICAgIC8vIENsZWFudXAsIHNpZ25hbCBLYXJtYSB0byBleGl0LlxuICAgICAgICAgIHJldHVybiAoKSA9PiBrYXJtYVN0YXJ0LnRoZW4oKCkgPT4ga2FybWFTZXJ2ZXIuc3RvcCgpKTtcbiAgICAgICAgfSksXG4gICAgKSxcbiAgICBkZWZhdWx0SWZFbXB0eSh7IHN1Y2Nlc3M6IGZhbHNlIH0pLFxuICApO1xufVxuXG5leHBvcnQgeyBLYXJtYUJ1aWxkZXJPcHRpb25zIH07XG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyPFJlY29yZDxzdHJpbmcsIHN0cmluZz4gJiBLYXJtYUJ1aWxkZXJPcHRpb25zPihleGVjdXRlKTtcbiJdfQ==