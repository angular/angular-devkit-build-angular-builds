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
        var _a;
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
        if (options.include && options.include.length > 0) {
            const mainFilePath = (0, core_1.getSystemPath)((0, core_1.join)((0, core_1.normalize)(context.workspaceRoot), options.main));
            const files = (0, find_tests_1.findTests)(options.include, (0, path_1.dirname)(mainFilePath), context.workspaceRoot);
            // early exit, no reason to start karma
            if (!files.length) {
                throw new Error(`Specified patterns: "${options.include.join(', ')}" did not match any spec files.`);
            }
            // Get the rules and ensure the Webpack configuration is setup properly
            const rules = ((_a = webpackConfig.module) === null || _a === void 0 ? void 0 : _a.rules) || [];
            if (!webpackConfig.module) {
                webpackConfig.module = { rules };
            }
            else if (!webpackConfig.module.rules) {
                webpackConfig.module.rules = rules;
            }
            rules.unshift({
                test: mainFilePath,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9rYXJtYS9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUF5RjtBQUN6RiwrQ0FBc0U7QUFFdEUsK0JBQXdDO0FBQ3hDLCtCQUF3QztBQUN4Qyw4Q0FBMkQ7QUFHM0QseURBQStEO0FBQy9ELGlEQUFxRTtBQUNyRSwrRUFBNkY7QUFDN0YsbURBQXlFO0FBQ3pFLHVGQUF3RjtBQUN4Riw4Q0FBbUY7QUFDbkYsNkNBQXlDO0FBUXpDLEtBQUssVUFBVSxVQUFVLENBQ3ZCLE9BQTRCLEVBQzVCLE9BQXVCLEVBQ3ZCLCtCQUFxRTtJQUVyRSw4QkFBOEI7SUFDOUIsTUFBTSxJQUFBLGtDQUFvQixFQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRXBDLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxNQUFNLElBQUEsZ0VBQXVDO0lBQzlELG1DQUFtQztJQUNuQywwQ0FBMEM7SUFDMUMsNkRBQTZEO0lBQzdEO1FBQ0UsR0FBSSxPQUE0QztRQUNoRCxVQUFVLEVBQUUsRUFBRTtRQUNkLE9BQU8sRUFBRSxTQUFTO1FBQ2xCLFlBQVksRUFBRSxLQUFLO1FBQ25CLGNBQWMsRUFBRSxLQUFLO1FBQ3JCLEdBQUcsRUFBRSxLQUFLO1FBQ1YsV0FBVyxFQUFFLElBQUk7UUFDakIsV0FBVyxFQUFFLElBQUk7UUFDakIsZUFBZSxFQUFFLEtBQUs7UUFDdEIsYUFBYSxFQUFFLHNCQUFhLENBQUMsSUFBSTtRQUNqQyxpRkFBaUY7UUFDakYsb0ZBQW9GO1FBQ3BGLG1IQUFtSDtRQUNuSCw2R0FBNkc7UUFDN0csS0FBSyxFQUFFLElBQUk7S0FDWixFQUNELE9BQU8sRUFDUCxDQUFDLEdBQUcsRUFB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QUMsWUFBWSxLQUFLLFFBQVEsRUFBRTtZQUNoRCw4REFBOEQ7WUFDOUQsWUFBQyxXQUFXLENBQUMsWUFBb0IsRUFBQyxTQUFTLHVDQUFULFNBQVMsR0FBSyxHQUFHLEVBQUUsQ0FDbkQsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFDO1lBQ3RDLDhEQUE4RDtZQUM5RCxZQUFDLFdBQVcsQ0FBQyxZQUFvQixFQUFDLFNBQVMsdUNBQVQsU0FBUyxHQUFLLEdBQUcsRUFBRSxDQUNuRCxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUM7U0FDdEM7UUFFRCx5REFBeUQ7UUFDekQsTUFBTSxXQUFXLEdBQUcsSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLFdBQXFCLEVBQUUsQ0FBQyxRQUFRLEVBQUUsRUFBRTtZQUN2RSxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLFFBQVEsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUN4QixDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUV2QyxpQ0FBaUM7UUFDakMsT0FBTyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ3pELENBQUMsQ0FBQyxDQUNMLEVBQ0QsSUFBQSwwQkFBYyxFQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQ25DLENBQUM7QUFDSixDQUFDO0FBakhELDBCQWlIQztBQUdELGtCQUFlLElBQUEseUJBQWEsRUFBK0MsT0FBTyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IGdldFN5c3RlbVBhdGgsIGpvaW4sIG5vcm1hbGl6ZSB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IENvbmZpZywgQ29uZmlnT3B0aW9ucyB9IGZyb20gJ2thcm1hJztcbmltcG9ydCB7IGRpcm5hbWUsIHJlc29sdmUgfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGRlZmF1bHRJZkVtcHR5LCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBFeGVjdXRpb25UcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHsgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUgfSBmcm9tICcuLi8uLi91dGlscy9wdXJnZS1jYWNoZSc7XG5pbXBvcnQgeyBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24gfSBmcm9tICcuLi8uLi91dGlscy92ZXJzaW9uJztcbmltcG9ydCB7IGdlbmVyYXRlQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dCB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgZ2V0Q29tbW9uQ29uZmlnLCBnZXRTdHlsZXNDb25maWcgfSBmcm9tICcuLi8uLi93ZWJwYWNrL2NvbmZpZ3MnO1xuaW1wb3J0IHsgU2luZ2xlVGVzdFRyYW5zZm9ybUxvYWRlciB9IGZyb20gJy4uLy4uL3dlYnBhY2svcGx1Z2lucy9zaW5nbGUtdGVzdC10cmFuc2Zvcm0nO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucywgT3V0cHV0SGFzaGluZyB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IGZpbmRUZXN0cyB9IGZyb20gJy4vZmluZC10ZXN0cyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgS2FybWFCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IHR5cGUgS2FybWFDb25maWdPcHRpb25zID0gQ29uZmlnT3B0aW9ucyAmIHtcbiAgYnVpbGRXZWJwYWNrPzogdW5rbm93bjtcbiAgY29uZmlnRmlsZT86IHN0cmluZztcbn07XG5cbmFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemUoXG4gIG9wdGlvbnM6IEthcm1hQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybWVyPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8Q29uZmlndXJhdGlvbj4sXG4pOiBQcm9taXNlPFt0eXBlb2YgaW1wb3J0KCdrYXJtYScpLCBDb25maWd1cmF0aW9uXT4ge1xuICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgYXdhaXQgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUoY29udGV4dCk7XG5cbiAgY29uc3QgeyBjb25maWcgfSA9IGF3YWl0IGdlbmVyYXRlQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChcbiAgICAvLyBvbmx5IHR3byBwcm9wZXJ0aWVzIGFyZSBtaXNzaW5nOlxuICAgIC8vICogYG91dHB1dFBhdGhgIHdoaWNoIGlzIGZpeGVkIGZvciB0ZXN0c1xuICAgIC8vICogYGJ1ZGdldHNgIHdoaWNoIG1pZ2h0IGJlIGluY29ycmVjdCBkdWUgdG8gZXh0cmEgZGV2IGxpYnNcbiAgICB7XG4gICAgICAuLi4ob3B0aW9ucyBhcyB1bmtub3duIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyksXG4gICAgICBvdXRwdXRQYXRoOiAnJyxcbiAgICAgIGJ1ZGdldHM6IHVuZGVmaW5lZCxcbiAgICAgIG9wdGltaXphdGlvbjogZmFsc2UsXG4gICAgICBidWlsZE9wdGltaXplcjogZmFsc2UsXG4gICAgICBhb3Q6IGZhbHNlLFxuICAgICAgdmVuZG9yQ2h1bms6IHRydWUsXG4gICAgICBuYW1lZENodW5rczogdHJ1ZSxcbiAgICAgIGV4dHJhY3RMaWNlbnNlczogZmFsc2UsXG4gICAgICBvdXRwdXRIYXNoaW5nOiBPdXRwdXRIYXNoaW5nLk5vbmUsXG4gICAgICAvLyBUaGUgd2VicGFjayB0aWVyIG93bnMgdGhlIHdhdGNoIGJlaGF2aW9yIHNvIHdlIHdhbnQgdG8gZm9yY2UgaXQgaW4gdGhlIGNvbmZpZy5cbiAgICAgIC8vIFdoZW4gbm90IGluIHdhdGNoIG1vZGUsIHdlYnBhY2stZGV2LW1pZGRsZXdhcmUgd2lsbCBjYWxsIGBjb21waWxlci53YXRjaGAgYW55d2F5LlxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay1kZXYtbWlkZGxld2FyZS9ibG9iLzY5OGM5YWU1ZTliYjlhMDEzOTg1YWRkNjE4OWZmMjFjMWExZWMxODUvc3JjL2luZGV4LmpzI0w2NVxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay9ibG9iL2NkZTFiNzNlMTJlYjhhNzdlYjliYTQyZTc5MjBjOWVjNWQyOWMyYzkvbGliL0NvbXBpbGVyLmpzI0wzNzktTDM4OFxuICAgICAgd2F0Y2g6IHRydWUsXG4gICAgfSxcbiAgICBjb250ZXh0LFxuICAgICh3Y28pID0+IFtnZXRDb21tb25Db25maWcod2NvKSwgZ2V0U3R5bGVzQ29uZmlnKHdjbyldLFxuICApO1xuXG4gIGNvbnN0IGthcm1hID0gYXdhaXQgaW1wb3J0KCdrYXJtYScpO1xuXG4gIHJldHVybiBbXG4gICAga2FybWEsXG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm1lciA/IGF3YWl0IHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtZXIoY29uZmlnKSA6IGNvbmZpZyxcbiAgXTtcbn1cblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZXhlY3V0ZShcbiAgb3B0aW9uczogS2FybWFCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHRyYW5zZm9ybXM6IHtcbiAgICB3ZWJwYWNrQ29uZmlndXJhdGlvbj86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPENvbmZpZ3VyYXRpb24+O1xuICAgIC8vIFRoZSBrYXJtYSBvcHRpb25zIHRyYW5zZm9ybSBjYW5ub3QgYmUgYXN5bmMgd2l0aG91dCBhIHJlZmFjdG9yIG9mIHRoZSBidWlsZGVyIGltcGxlbWVudGF0aW9uXG4gICAga2FybWFPcHRpb25zPzogKG9wdGlvbnM6IEthcm1hQ29uZmlnT3B0aW9ucykgPT4gS2FybWFDb25maWdPcHRpb25zO1xuICB9ID0ge30sXG4pOiBPYnNlcnZhYmxlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gQ2hlY2sgQW5ndWxhciB2ZXJzaW9uLlxuICBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24oY29udGV4dC53b3Jrc3BhY2VSb290KTtcblxuICBsZXQgc2luZ2xlUnVuOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICBpZiAob3B0aW9ucy53YXRjaCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgc2luZ2xlUnVuID0gIW9wdGlvbnMud2F0Y2g7XG4gIH1cblxuICByZXR1cm4gZnJvbShpbml0aWFsaXplKG9wdGlvbnMsIGNvbnRleHQsIHRyYW5zZm9ybXMud2VicGFja0NvbmZpZ3VyYXRpb24pKS5waXBlKFxuICAgIHN3aXRjaE1hcChhc3luYyAoW2thcm1hLCB3ZWJwYWNrQ29uZmlnXSkgPT4ge1xuICAgICAgY29uc3Qga2FybWFPcHRpb25zOiBLYXJtYUNvbmZpZ09wdGlvbnMgPSB7XG4gICAgICAgIHNpbmdsZVJ1bixcbiAgICAgIH07XG5cbiAgICAgIC8vIENvbnZlcnQgYnJvd3NlcnMgZnJvbSBhIHN0cmluZyB0byBhbiBhcnJheVxuICAgICAgaWYgKG9wdGlvbnMuYnJvd3NlcnMpIHtcbiAgICAgICAga2FybWFPcHRpb25zLmJyb3dzZXJzID0gb3B0aW9ucy5icm93c2Vycy5zcGxpdCgnLCcpO1xuICAgICAgfVxuXG4gICAgICBpZiAob3B0aW9ucy5yZXBvcnRlcnMpIHtcbiAgICAgICAgLy8gU3BsaXQgYWxvbmcgY29tbWFzIHRvIG1ha2UgaXQgbW9yZSBuYXR1cmFsLCBhbmQgcmVtb3ZlIGVtcHR5IHN0cmluZ3MuXG4gICAgICAgIGNvbnN0IHJlcG9ydGVycyA9IG9wdGlvbnMucmVwb3J0ZXJzXG4gICAgICAgICAgLnJlZHVjZTxzdHJpbmdbXT4oKGFjYywgY3VycikgPT4gYWNjLmNvbmNhdChjdXJyLnNwbGl0KCcsJykpLCBbXSlcbiAgICAgICAgICAuZmlsdGVyKCh4KSA9PiAhIXgpO1xuXG4gICAgICAgIGlmIChyZXBvcnRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGthcm1hT3B0aW9ucy5yZXBvcnRlcnMgPSByZXBvcnRlcnM7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gcHJlcGVuZCBzcGVjaWFsIHdlYnBhY2sgbG9hZGVyIHRoYXQgd2lsbCB0cmFuc2Zvcm0gdGVzdC50c1xuICAgICAgaWYgKG9wdGlvbnMuaW5jbHVkZSAmJiBvcHRpb25zLmluY2x1ZGUubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBtYWluRmlsZVBhdGggPSBnZXRTeXN0ZW1QYXRoKGpvaW4obm9ybWFsaXplKGNvbnRleHQud29ya3NwYWNlUm9vdCksIG9wdGlvbnMubWFpbikpO1xuICAgICAgICBjb25zdCBmaWxlcyA9IGZpbmRUZXN0cyhvcHRpb25zLmluY2x1ZGUsIGRpcm5hbWUobWFpbkZpbGVQYXRoKSwgY29udGV4dC53b3Jrc3BhY2VSb290KTtcbiAgICAgICAgLy8gZWFybHkgZXhpdCwgbm8gcmVhc29uIHRvIHN0YXJ0IGthcm1hXG4gICAgICAgIGlmICghZmlsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYFNwZWNpZmllZCBwYXR0ZXJuczogXCIke29wdGlvbnMuaW5jbHVkZS5qb2luKCcsICcpfVwiIGRpZCBub3QgbWF0Y2ggYW55IHNwZWMgZmlsZXMuYCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2V0IHRoZSBydWxlcyBhbmQgZW5zdXJlIHRoZSBXZWJwYWNrIGNvbmZpZ3VyYXRpb24gaXMgc2V0dXAgcHJvcGVybHlcbiAgICAgICAgY29uc3QgcnVsZXMgPSB3ZWJwYWNrQ29uZmlnLm1vZHVsZT8ucnVsZXMgfHwgW107XG4gICAgICAgIGlmICghd2VicGFja0NvbmZpZy5tb2R1bGUpIHtcbiAgICAgICAgICB3ZWJwYWNrQ29uZmlnLm1vZHVsZSA9IHsgcnVsZXMgfTtcbiAgICAgICAgfSBlbHNlIGlmICghd2VicGFja0NvbmZpZy5tb2R1bGUucnVsZXMpIHtcbiAgICAgICAgICB3ZWJwYWNrQ29uZmlnLm1vZHVsZS5ydWxlcyA9IHJ1bGVzO1xuICAgICAgICB9XG5cbiAgICAgICAgcnVsZXMudW5zaGlmdCh7XG4gICAgICAgICAgdGVzdDogbWFpbkZpbGVQYXRoLFxuICAgICAgICAgIHVzZToge1xuICAgICAgICAgICAgLy8gY2Fubm90IGJlIGEgc2ltcGxlIHBhdGggYXMgaXQgZGlmZmVycyBiZXR3ZWVuIGVudmlyb25tZW50c1xuICAgICAgICAgICAgbG9hZGVyOiBTaW5nbGVUZXN0VHJhbnNmb3JtTG9hZGVyLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBmaWxlcyxcbiAgICAgICAgICAgICAgbG9nZ2VyOiBjb250ZXh0LmxvZ2dlcixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGthcm1hT3B0aW9ucy5idWlsZFdlYnBhY2sgPSB7XG4gICAgICAgIG9wdGlvbnMsXG4gICAgICAgIHdlYnBhY2tDb25maWcsXG4gICAgICAgIGxvZ2dlcjogY29udGV4dC5sb2dnZXIsXG4gICAgICB9O1xuXG4gICAgICBjb25zdCBjb25maWcgPSBhd2FpdCBrYXJtYS5jb25maWcucGFyc2VDb25maWcoXG4gICAgICAgIHJlc29sdmUoY29udGV4dC53b3Jrc3BhY2VSb290LCBvcHRpb25zLmthcm1hQ29uZmlnKSxcbiAgICAgICAgdHJhbnNmb3Jtcy5rYXJtYU9wdGlvbnMgPyB0cmFuc2Zvcm1zLmthcm1hT3B0aW9ucyhrYXJtYU9wdGlvbnMpIDoga2FybWFPcHRpb25zLFxuICAgICAgICB7IHByb21pc2VDb25maWc6IHRydWUsIHRocm93RXJyb3JzOiB0cnVlIH0sXG4gICAgICApO1xuXG4gICAgICByZXR1cm4gW2thcm1hLCBjb25maWddIGFzIFt0eXBlb2Yga2FybWEsIEthcm1hQ29uZmlnT3B0aW9uc107XG4gICAgfSksXG4gICAgc3dpdGNoTWFwKFxuICAgICAgKFtrYXJtYSwga2FybWFDb25maWddKSA9PlxuICAgICAgICBuZXcgT2JzZXJ2YWJsZTxCdWlsZGVyT3V0cHV0Pigoc3Vic2NyaWJlcikgPT4ge1xuICAgICAgICAgIC8vIFBhc3Mgb250byBLYXJtYSB0byBlbWl0IEJ1aWxkRXZlbnRzLlxuICAgICAgICAgIGthcm1hQ29uZmlnLmJ1aWxkV2VicGFjayA/Pz0ge307XG4gICAgICAgICAgaWYgKHR5cGVvZiBrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgICAgICAgKGthcm1hQ29uZmlnLmJ1aWxkV2VicGFjayBhcyBhbnkpLmZhaWx1cmVDYiA/Pz0gKCkgPT5cbiAgICAgICAgICAgICAgc3Vic2NyaWJlci5uZXh0KHsgc3VjY2VzczogZmFsc2UgfSk7XG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgICAgICAgKGthcm1hQ29uZmlnLmJ1aWxkV2VicGFjayBhcyBhbnkpLnN1Y2Nlc3NDYiA/Pz0gKCkgPT5cbiAgICAgICAgICAgICAgc3Vic2NyaWJlci5uZXh0KHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBDb21wbGV0ZSB0aGUgb2JzZXJ2YWJsZSBvbmNlIHRoZSBLYXJtYSBzZXJ2ZXIgcmV0dXJucy5cbiAgICAgICAgICBjb25zdCBrYXJtYVNlcnZlciA9IG5ldyBrYXJtYS5TZXJ2ZXIoa2FybWFDb25maWcgYXMgQ29uZmlnLCAoZXhpdENvZGUpID0+IHtcbiAgICAgICAgICAgIHN1YnNjcmliZXIubmV4dCh7IHN1Y2Nlc3M6IGV4aXRDb2RlID09PSAwIH0pO1xuICAgICAgICAgICAgc3Vic2NyaWJlci5jb21wbGV0ZSgpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgY29uc3Qga2FybWFTdGFydCA9IGthcm1hU2VydmVyLnN0YXJ0KCk7XG5cbiAgICAgICAgICAvLyBDbGVhbnVwLCBzaWduYWwgS2FybWEgdG8gZXhpdC5cbiAgICAgICAgICByZXR1cm4gKCkgPT4ga2FybWFTdGFydC50aGVuKCgpID0+IGthcm1hU2VydmVyLnN0b3AoKSk7XG4gICAgICAgIH0pLFxuICAgICksXG4gICAgZGVmYXVsdElmRW1wdHkoeyBzdWNjZXNzOiBmYWxzZSB9KSxcbiAgKTtcbn1cblxuZXhwb3J0IHsgS2FybWFCdWlsZGVyT3B0aW9ucyB9O1xuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcjxSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ICYgS2FybWFCdWlsZGVyT3B0aW9ucz4oZXhlY3V0ZSk7XG4iXX0=