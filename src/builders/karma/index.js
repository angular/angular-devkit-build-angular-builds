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
const module_1 = require("module");
const path = __importStar(require("path"));
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const purge_cache_1 = require("../../utils/purge-cache");
const version_1 = require("../../utils/version");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const configs_1 = require("../../webpack/configs");
const schema_1 = require("../browser/schema");
const find_tests_plugin_1 = require("./find-tests-plugin");
async function initialize(options, context, webpackConfigurationTransformer) {
    var _a;
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
    return [karma, (_a = (await (webpackConfigurationTransformer === null || webpackConfigurationTransformer === void 0 ? void 0 : webpackConfigurationTransformer(config)))) !== null && _a !== void 0 ? _a : config];
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
        // Determine project name from builder context target
        const projectName = (_a = context.target) === null || _a === void 0 ? void 0 : _a.project;
        if (!projectName) {
            throw new Error(`The 'karma' builder requires a target to be specified.`);
        }
        const karmaOptions = options.karmaConfig
            ? {}
            : getBuiltInKarmaConfig(karma, context.workspaceRoot, projectName);
        karmaOptions.singleRun = singleRun;
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
        if (!options.main) {
            (_b = webpackConfig.entry) !== null && _b !== void 0 ? _b : (webpackConfig.entry = {});
            if (typeof webpackConfig.entry === 'object' && !Array.isArray(webpackConfig.entry)) {
                if (Array.isArray(webpackConfig.entry['main'])) {
                    webpackConfig.entry['main'].push(getBuiltInMainFile());
                }
                else {
                    webpackConfig.entry['main'] = [getBuiltInMainFile()];
                }
            }
        }
        const projectMetadata = await context.getProjectMetadata(projectName);
        const sourceRoot = ((_d = (_c = projectMetadata.sourceRoot) !== null && _c !== void 0 ? _c : projectMetadata.root) !== null && _d !== void 0 ? _d : '');
        (_e = webpackConfig.plugins) !== null && _e !== void 0 ? _e : (webpackConfig.plugins = []);
        webpackConfig.plugins.push(new find_tests_plugin_1.FindTestsPlugin({
            include: options.include,
            exclude: options.exclude,
            workspaceRoot: context.workspaceRoot,
            projectSourceRoot: path.join(context.workspaceRoot, sourceRoot),
        }));
        karmaOptions.buildWebpack = {
            options,
            webpackConfig,
            logger: context.logger,
        };
        const parsedKarmaConfig = await karma.config.parseConfig(options.karmaConfig && path.resolve(context.workspaceRoot, options.karmaConfig), transforms.karmaOptions ? transforms.karmaOptions(karmaOptions) : karmaOptions, { promiseConfig: true, throwErrors: true });
        return [karma, parsedKarmaConfig];
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
function getBuiltInKarmaConfig(karma, workspaceRoot, projectName) {
    let coverageFolderName = projectName.charAt(0) === '@' ? projectName.slice(1) : projectName;
    if (/[A-Z]/.test(coverageFolderName)) {
        coverageFolderName = core_1.strings.dasherize(coverageFolderName);
    }
    const workspaceRootRequire = (0, module_1.createRequire)(workspaceRoot + '/');
    return {
        basePath: '',
        frameworks: ['jasmine', '@angular-devkit/build-angular'],
        plugins: [
            'karma-jasmine',
            'karma-chrome-launcher',
            'karma-jasmine-html-reporter',
            'karma-coverage',
            '@angular-devkit/build-angular/plugins/karma',
        ].map((p) => workspaceRootRequire(p)),
        client: {
            clearContext: false, // leave Jasmine Spec Runner output visible in browser
        },
        jasmineHtmlReporter: {
            suppressAll: true, // removes the duplicated traces
        },
        coverageReporter: {
            dir: path.join(workspaceRoot, 'coverage', coverageFolderName),
            subdir: '.',
            reporters: [{ type: 'html' }, { type: 'text-summary' }],
        },
        reporters: ['progress', 'kjhtml'],
        port: 9876,
        colors: true,
        logLevel: karma.constants.LOG_INFO,
        autoWatch: true,
        browsers: ['Chrome'],
        restartOnFileChange: true,
    };
}
exports.default = (0, architect_1.createBuilder)(execute);
function getBuiltInMainFile() {
    const content = Buffer.from(`
  import { getTestBed } from '@angular/core/testing';
  import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
   } from '@angular/platform-browser-dynamic/testing';

  // Initialize the Angular testing environment.
  getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true
  });
`).toString('base64');
    return `ng-virtual-main.js!=!data:text/javascript;base64,${content}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9rYXJtYS9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUF5RjtBQUN6RiwrQ0FBK0M7QUFFL0MsbUNBQXVDO0FBQ3ZDLDJDQUE2QjtBQUM3QiwrQkFBd0M7QUFDeEMsOENBQTJEO0FBRzNELHlEQUErRDtBQUMvRCxpREFBcUU7QUFDckUsK0VBQTZGO0FBQzdGLG1EQUF5RTtBQUN6RSw4Q0FBbUY7QUFDbkYsMkRBQXNEO0FBUXRELEtBQUssVUFBVSxVQUFVLENBQ3ZCLE9BQTRCLEVBQzVCLE9BQXVCLEVBQ3ZCLCtCQUFxRTs7SUFFckUsOEJBQThCO0lBQzlCLE1BQU0sSUFBQSxrQ0FBb0IsRUFBQyxPQUFPLENBQUMsQ0FBQztJQUVwQyxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFBLGdFQUF1QztJQUM5RCxtQ0FBbUM7SUFDbkMsMENBQTBDO0lBQzFDLDZEQUE2RDtJQUM3RDtRQUNFLEdBQUksT0FBNEM7UUFDaEQsVUFBVSxFQUFFLEVBQUU7UUFDZCxPQUFPLEVBQUUsU0FBUztRQUNsQixZQUFZLEVBQUUsS0FBSztRQUNuQixjQUFjLEVBQUUsS0FBSztRQUNyQixHQUFHLEVBQUUsS0FBSztRQUNWLFdBQVcsRUFBRSxJQUFJO1FBQ2pCLFdBQVcsRUFBRSxJQUFJO1FBQ2pCLGVBQWUsRUFBRSxLQUFLO1FBQ3RCLGFBQWEsRUFBRSxzQkFBYSxDQUFDLElBQUk7UUFDakMsaUZBQWlGO1FBQ2pGLG9GQUFvRjtRQUNwRixtSEFBbUg7UUFDbkgsNkdBQTZHO1FBQzdHLEtBQUssRUFBRSxJQUFJO0tBQ1osRUFDRCxPQUFPLEVBQ1AsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsQ0FBQyxDQUN0RCxDQUFDO0lBRUYsTUFBTSxLQUFLLEdBQUcsd0RBQWEsT0FBTyxHQUFDLENBQUM7SUFFcEMsT0FBTyxDQUFDLEtBQUssRUFBRSxNQUFBLENBQUMsTUFBTSxDQUFBLCtCQUErQixhQUEvQiwrQkFBK0IsdUJBQS9CLCtCQUErQixDQUFHLE1BQU0sQ0FBQyxDQUFBLENBQUMsbUNBQUksTUFBTSxDQUFDLENBQUM7QUFDOUUsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsT0FBTyxDQUNyQixPQUE0QixFQUM1QixPQUF1QixFQUN2QixhQUlJLEVBQUU7SUFFTix5QkFBeUI7SUFDekIsSUFBQSx3Q0FBOEIsRUFBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7SUFFdEQsSUFBSSxTQUE4QixDQUFDO0lBQ25DLElBQUksT0FBTyxDQUFDLEtBQUssS0FBSyxTQUFTLEVBQUU7UUFDL0IsU0FBUyxHQUFHLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztLQUM1QjtJQUVELE9BQU8sSUFBQSxXQUFJLEVBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsVUFBVSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQzdFLElBQUEscUJBQVMsRUFBQyxLQUFLLEVBQUUsQ0FBQyxLQUFLLEVBQUUsYUFBYSxDQUFDLEVBQUUsRUFBRTs7UUFDekMscURBQXFEO1FBQ3JELE1BQU0sV0FBVyxHQUFHLE1BQUEsT0FBTyxDQUFDLE1BQU0sMENBQUUsT0FBTyxDQUFDO1FBQzVDLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyx3REFBd0QsQ0FBQyxDQUFDO1NBQzNFO1FBRUQsTUFBTSxZQUFZLEdBQXVCLE9BQU8sQ0FBQyxXQUFXO1lBQzFELENBQUMsQ0FBQyxFQUFFO1lBQ0osQ0FBQyxDQUFDLHFCQUFxQixDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBRXJFLFlBQVksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO1FBRW5DLDZDQUE2QztRQUM3QyxJQUFJLE9BQU8sQ0FBQyxRQUFRLEVBQUU7WUFDcEIsWUFBWSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUNyRDtRQUVELElBQUksT0FBTyxDQUFDLFNBQVMsRUFBRTtZQUNyQix3RUFBd0U7WUFDeEUsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLFNBQVM7aUJBQ2hDLE1BQU0sQ0FBVyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQztpQkFDaEUsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFdEIsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDeEIsWUFBWSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7YUFDcEM7U0FDRjtRQUVELElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFO1lBQ2pCLE1BQUEsYUFBYSxDQUFDLEtBQUssb0NBQW5CLGFBQWEsQ0FBQyxLQUFLLEdBQUssRUFBRSxFQUFDO1lBQzNCLElBQUksT0FBTyxhQUFhLENBQUMsS0FBSyxLQUFLLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUNsRixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFO29CQUM5QyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUM7aUJBQ3hEO3FCQUFNO29CQUNMLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUM7aUJBQ3REO2FBQ0Y7U0FDRjtRQUVELE1BQU0sZUFBZSxHQUFHLE1BQU0sT0FBTyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3RFLE1BQU0sVUFBVSxHQUFHLENBQUMsTUFBQSxNQUFBLGVBQWUsQ0FBQyxVQUFVLG1DQUFJLGVBQWUsQ0FBQyxJQUFJLG1DQUFJLEVBQUUsQ0FBVyxDQUFDO1FBRXhGLE1BQUEsYUFBYSxDQUFDLE9BQU8sb0NBQXJCLGFBQWEsQ0FBQyxPQUFPLEdBQUssRUFBRSxFQUFDO1FBQzdCLGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUN4QixJQUFJLG1DQUFlLENBQUM7WUFDbEIsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPO1lBQ3hCLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTztZQUN4QixhQUFhLEVBQUUsT0FBTyxDQUFDLGFBQWE7WUFDcEMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLFVBQVUsQ0FBQztTQUNoRSxDQUFDLENBQ0gsQ0FBQztRQUVGLFlBQVksQ0FBQyxZQUFZLEdBQUc7WUFDMUIsT0FBTztZQUNQLGFBQWE7WUFDYixNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU07U0FDdkIsQ0FBQztRQUVGLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxLQUFLLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FDdEQsT0FBTyxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUMvRSxVQUFVLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLEVBQzlFLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLENBQzNDLENBQUM7UUFFRixPQUFPLENBQUMsS0FBSyxFQUFFLGlCQUFpQixDQUF1QyxDQUFDO0lBQzFFLENBQUMsQ0FBQyxFQUNGLElBQUEscUJBQVMsRUFDUCxDQUFDLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxFQUFFLEVBQUUsQ0FDdkIsSUFBSSxpQkFBVSxDQUFnQixDQUFDLFVBQVUsRUFBRSxFQUFFOzs7UUFDM0MsdUNBQXVDO1FBQ3ZDLE1BQUEsV0FBVyxDQUFDLFlBQVksb0NBQXhCLFdBQVcsQ0FBQyxZQUFZLEdBQUssRUFBRSxFQUFDO1FBQ2hDLElBQUksT0FBTyxXQUFXLENBQUMsWUFBWSxLQUFLLFFBQVEsRUFBRTtZQUNoRCw4REFBOEQ7WUFDOUQsWUFBQyxXQUFXLENBQUMsWUFBb0IsRUFBQyxTQUFTLHVDQUFULFNBQVMsR0FBSyxHQUFHLEVBQUUsQ0FDbkQsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFDO1lBQ3RDLDhEQUE4RDtZQUM5RCxZQUFDLFdBQVcsQ0FBQyxZQUFvQixFQUFDLFNBQVMsdUNBQVQsU0FBUyxHQUFLLEdBQUcsRUFBRSxDQUNuRCxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUM7U0FDdEM7UUFFRCx5REFBeUQ7UUFDekQsTUFBTSxXQUFXLEdBQUcsSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLFdBQXFCLEVBQUUsQ0FBQyxRQUFRLEVBQUUsRUFBRTtZQUN2RSxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLFFBQVEsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUN4QixDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUV2QyxpQ0FBaUM7UUFDakMsT0FBTyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ3pELENBQUMsQ0FBQyxDQUNMLEVBQ0QsSUFBQSwwQkFBYyxFQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQ25DLENBQUM7QUFDSixDQUFDO0FBakhELDBCQWlIQztBQUVELFNBQVMscUJBQXFCLENBQzVCLEtBQTZCLEVBQzdCLGFBQXFCLEVBQ3JCLFdBQW1CO0lBRW5CLElBQUksa0JBQWtCLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQztJQUM1RixJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsRUFBRTtRQUNwQyxrQkFBa0IsR0FBRyxjQUFPLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLENBQUM7S0FDNUQ7SUFFRCxNQUFNLG9CQUFvQixHQUFHLElBQUEsc0JBQWEsRUFBQyxhQUFhLEdBQUcsR0FBRyxDQUFDLENBQUM7SUFFaEUsT0FBTztRQUNMLFFBQVEsRUFBRSxFQUFFO1FBQ1osVUFBVSxFQUFFLENBQUMsU0FBUyxFQUFFLCtCQUErQixDQUFDO1FBQ3hELE9BQU8sRUFBRTtZQUNQLGVBQWU7WUFDZix1QkFBdUI7WUFDdkIsNkJBQTZCO1lBQzdCLGdCQUFnQjtZQUNoQiw2Q0FBNkM7U0FDOUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sRUFBRTtZQUNOLFlBQVksRUFBRSxLQUFLLEVBQUUsc0RBQXNEO1NBQzVFO1FBQ0QsbUJBQW1CLEVBQUU7WUFDbkIsV0FBVyxFQUFFLElBQUksRUFBRSxnQ0FBZ0M7U0FDcEQ7UUFDRCxnQkFBZ0IsRUFBRTtZQUNoQixHQUFHLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsVUFBVSxFQUFFLGtCQUFrQixDQUFDO1lBQzdELE1BQU0sRUFBRSxHQUFHO1lBQ1gsU0FBUyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLENBQUM7U0FDeEQ7UUFDRCxTQUFTLEVBQUUsQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDO1FBQ2pDLElBQUksRUFBRSxJQUFJO1FBQ1YsTUFBTSxFQUFFLElBQUk7UUFDWixRQUFRLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxRQUFRO1FBQ2xDLFNBQVMsRUFBRSxJQUFJO1FBQ2YsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO1FBQ3BCLG1CQUFtQixFQUFFLElBQUk7S0FDMUIsQ0FBQztBQUNKLENBQUM7QUFHRCxrQkFBZSxJQUFBLHlCQUFhLEVBQStDLE9BQU8sQ0FBQyxDQUFDO0FBRXBGLFNBQVMsa0JBQWtCO0lBQ3pCLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQ3pCOzs7Ozs7Ozs7Ozs7Q0FZSCxDQUNFLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRXJCLE9BQU8sb0RBQW9ELE9BQU8sRUFBRSxDQUFDO0FBQ3ZFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IHN0cmluZ3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgdHlwZSB7IENvbmZpZywgQ29uZmlnT3B0aW9ucyB9IGZyb20gJ2thcm1hJztcbmltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdtb2R1bGUnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGRlZmF1bHRJZkVtcHR5LCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBFeGVjdXRpb25UcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHsgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUgfSBmcm9tICcuLi8uLi91dGlscy9wdXJnZS1jYWNoZSc7XG5pbXBvcnQgeyBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24gfSBmcm9tICcuLi8uLi91dGlscy92ZXJzaW9uJztcbmltcG9ydCB7IGdlbmVyYXRlQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dCB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgZ2V0Q29tbW9uQ29uZmlnLCBnZXRTdHlsZXNDb25maWcgfSBmcm9tICcuLi8uLi93ZWJwYWNrL2NvbmZpZ3MnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucywgT3V0cHV0SGFzaGluZyB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IEZpbmRUZXN0c1BsdWdpbiB9IGZyb20gJy4vZmluZC10ZXN0cy1wbHVnaW4nO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEthcm1hQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmV4cG9ydCB0eXBlIEthcm1hQ29uZmlnT3B0aW9ucyA9IENvbmZpZ09wdGlvbnMgJiB7XG4gIGJ1aWxkV2VicGFjaz86IHVua25vd247XG4gIGNvbmZpZ0ZpbGU/OiBzdHJpbmc7XG59O1xuXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplKFxuICBvcHRpb25zOiBLYXJtYUJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgd2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm1lcj86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPENvbmZpZ3VyYXRpb24+LFxuKTogUHJvbWlzZTxbdHlwZW9mIGltcG9ydCgna2FybWEnKSwgQ29uZmlndXJhdGlvbl0+IHtcbiAgLy8gUHVyZ2Ugb2xkIGJ1aWxkIGRpc2sgY2FjaGUuXG4gIGF3YWl0IHB1cmdlU3RhbGVCdWlsZENhY2hlKGNvbnRleHQpO1xuXG4gIGNvbnN0IHsgY29uZmlnIH0gPSBhd2FpdCBnZW5lcmF0ZUJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQoXG4gICAgLy8gb25seSB0d28gcHJvcGVydGllcyBhcmUgbWlzc2luZzpcbiAgICAvLyAqIGBvdXRwdXRQYXRoYCB3aGljaCBpcyBmaXhlZCBmb3IgdGVzdHNcbiAgICAvLyAqIGBidWRnZXRzYCB3aGljaCBtaWdodCBiZSBpbmNvcnJlY3QgZHVlIHRvIGV4dHJhIGRldiBsaWJzXG4gICAge1xuICAgICAgLi4uKG9wdGlvbnMgYXMgdW5rbm93biBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMpLFxuICAgICAgb3V0cHV0UGF0aDogJycsXG4gICAgICBidWRnZXRzOiB1bmRlZmluZWQsXG4gICAgICBvcHRpbWl6YXRpb246IGZhbHNlLFxuICAgICAgYnVpbGRPcHRpbWl6ZXI6IGZhbHNlLFxuICAgICAgYW90OiBmYWxzZSxcbiAgICAgIHZlbmRvckNodW5rOiB0cnVlLFxuICAgICAgbmFtZWRDaHVua3M6IHRydWUsXG4gICAgICBleHRyYWN0TGljZW5zZXM6IGZhbHNlLFxuICAgICAgb3V0cHV0SGFzaGluZzogT3V0cHV0SGFzaGluZy5Ob25lLFxuICAgICAgLy8gVGhlIHdlYnBhY2sgdGllciBvd25zIHRoZSB3YXRjaCBiZWhhdmlvciBzbyB3ZSB3YW50IHRvIGZvcmNlIGl0IGluIHRoZSBjb25maWcuXG4gICAgICAvLyBXaGVuIG5vdCBpbiB3YXRjaCBtb2RlLCB3ZWJwYWNrLWRldi1taWRkbGV3YXJlIHdpbGwgY2FsbCBgY29tcGlsZXIud2F0Y2hgIGFueXdheS5cbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LW1pZGRsZXdhcmUvYmxvYi82OThjOWFlNWU5YmI5YTAxMzk4NWFkZDYxODlmZjIxYzFhMWVjMTg1L3NyYy9pbmRleC5qcyNMNjVcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrL3dlYnBhY2svYmxvYi9jZGUxYjczZTEyZWI4YTc3ZWI5YmE0MmU3OTIwYzllYzVkMjljMmM5L2xpYi9Db21waWxlci5qcyNMMzc5LUwzODhcbiAgICAgIHdhdGNoOiB0cnVlLFxuICAgIH0sXG4gICAgY29udGV4dCxcbiAgICAod2NvKSA9PiBbZ2V0Q29tbW9uQ29uZmlnKHdjbyksIGdldFN0eWxlc0NvbmZpZyh3Y28pXSxcbiAgKTtcblxuICBjb25zdCBrYXJtYSA9IGF3YWl0IGltcG9ydCgna2FybWEnKTtcblxuICByZXR1cm4gW2thcm1hLCAoYXdhaXQgd2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm1lcj8uKGNvbmZpZykpID8/IGNvbmZpZ107XG59XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IEthcm1hQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zOiB7XG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb24/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjxDb25maWd1cmF0aW9uPjtcbiAgICAvLyBUaGUga2FybWEgb3B0aW9ucyB0cmFuc2Zvcm0gY2Fubm90IGJlIGFzeW5jIHdpdGhvdXQgYSByZWZhY3RvciBvZiB0aGUgYnVpbGRlciBpbXBsZW1lbnRhdGlvblxuICAgIGthcm1hT3B0aW9ucz86IChvcHRpb25zOiBLYXJtYUNvbmZpZ09wdGlvbnMpID0+IEthcm1hQ29uZmlnT3B0aW9ucztcbiAgfSA9IHt9LFxuKTogT2JzZXJ2YWJsZTxCdWlsZGVyT3V0cHV0PiB7XG4gIC8vIENoZWNrIEFuZ3VsYXIgdmVyc2lvbi5cbiAgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uKGNvbnRleHQud29ya3NwYWNlUm9vdCk7XG5cbiAgbGV0IHNpbmdsZVJ1bjogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbiAgaWYgKG9wdGlvbnMud2F0Y2ggIT09IHVuZGVmaW5lZCkge1xuICAgIHNpbmdsZVJ1biA9ICFvcHRpb25zLndhdGNoO1xuICB9XG5cbiAgcmV0dXJuIGZyb20oaW5pdGlhbGl6ZShvcHRpb25zLCBjb250ZXh0LCB0cmFuc2Zvcm1zLndlYnBhY2tDb25maWd1cmF0aW9uKSkucGlwZShcbiAgICBzd2l0Y2hNYXAoYXN5bmMgKFtrYXJtYSwgd2VicGFja0NvbmZpZ10pID0+IHtcbiAgICAgIC8vIERldGVybWluZSBwcm9qZWN0IG5hbWUgZnJvbSBidWlsZGVyIGNvbnRleHQgdGFyZ2V0XG4gICAgICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0Py5wcm9qZWN0O1xuICAgICAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSAna2FybWEnIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQgdG8gYmUgc3BlY2lmaWVkLmApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBrYXJtYU9wdGlvbnM6IEthcm1hQ29uZmlnT3B0aW9ucyA9IG9wdGlvbnMua2FybWFDb25maWdcbiAgICAgICAgPyB7fVxuICAgICAgICA6IGdldEJ1aWx0SW5LYXJtYUNvbmZpZyhrYXJtYSwgY29udGV4dC53b3Jrc3BhY2VSb290LCBwcm9qZWN0TmFtZSk7XG5cbiAgICAgIGthcm1hT3B0aW9ucy5zaW5nbGVSdW4gPSBzaW5nbGVSdW47XG5cbiAgICAgIC8vIENvbnZlcnQgYnJvd3NlcnMgZnJvbSBhIHN0cmluZyB0byBhbiBhcnJheVxuICAgICAgaWYgKG9wdGlvbnMuYnJvd3NlcnMpIHtcbiAgICAgICAga2FybWFPcHRpb25zLmJyb3dzZXJzID0gb3B0aW9ucy5icm93c2Vycy5zcGxpdCgnLCcpO1xuICAgICAgfVxuXG4gICAgICBpZiAob3B0aW9ucy5yZXBvcnRlcnMpIHtcbiAgICAgICAgLy8gU3BsaXQgYWxvbmcgY29tbWFzIHRvIG1ha2UgaXQgbW9yZSBuYXR1cmFsLCBhbmQgcmVtb3ZlIGVtcHR5IHN0cmluZ3MuXG4gICAgICAgIGNvbnN0IHJlcG9ydGVycyA9IG9wdGlvbnMucmVwb3J0ZXJzXG4gICAgICAgICAgLnJlZHVjZTxzdHJpbmdbXT4oKGFjYywgY3VycikgPT4gYWNjLmNvbmNhdChjdXJyLnNwbGl0KCcsJykpLCBbXSlcbiAgICAgICAgICAuZmlsdGVyKCh4KSA9PiAhIXgpO1xuXG4gICAgICAgIGlmIChyZXBvcnRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGthcm1hT3B0aW9ucy5yZXBvcnRlcnMgPSByZXBvcnRlcnM7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKCFvcHRpb25zLm1haW4pIHtcbiAgICAgICAgd2VicGFja0NvbmZpZy5lbnRyeSA/Pz0ge307XG4gICAgICAgIGlmICh0eXBlb2Ygd2VicGFja0NvbmZpZy5lbnRyeSA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkod2VicGFja0NvbmZpZy5lbnRyeSkpIHtcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10pKSB7XG4gICAgICAgICAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10ucHVzaChnZXRCdWlsdEluTWFpbkZpbGUoKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXSA9IFtnZXRCdWlsdEluTWFpbkZpbGUoKV07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHByb2plY3RNZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgICAgIGNvbnN0IHNvdXJjZVJvb3QgPSAocHJvamVjdE1ldGFkYXRhLnNvdXJjZVJvb3QgPz8gcHJvamVjdE1ldGFkYXRhLnJvb3QgPz8gJycpIGFzIHN0cmluZztcblxuICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zID8/PSBbXTtcbiAgICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy5wdXNoKFxuICAgICAgICBuZXcgRmluZFRlc3RzUGx1Z2luKHtcbiAgICAgICAgICBpbmNsdWRlOiBvcHRpb25zLmluY2x1ZGUsXG4gICAgICAgICAgZXhjbHVkZTogb3B0aW9ucy5leGNsdWRlLFxuICAgICAgICAgIHdvcmtzcGFjZVJvb3Q6IGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICBwcm9qZWN0U291cmNlUm9vdDogcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgc291cmNlUm9vdCksXG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgICAga2FybWFPcHRpb25zLmJ1aWxkV2VicGFjayA9IHtcbiAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgd2VicGFja0NvbmZpZyxcbiAgICAgICAgbG9nZ2VyOiBjb250ZXh0LmxvZ2dlcixcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHBhcnNlZEthcm1hQ29uZmlnID0gYXdhaXQga2FybWEuY29uZmlnLnBhcnNlQ29uZmlnKFxuICAgICAgICBvcHRpb25zLmthcm1hQ29uZmlnICYmIHBhdGgucmVzb2x2ZShjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9wdGlvbnMua2FybWFDb25maWcpLFxuICAgICAgICB0cmFuc2Zvcm1zLmthcm1hT3B0aW9ucyA/IHRyYW5zZm9ybXMua2FybWFPcHRpb25zKGthcm1hT3B0aW9ucykgOiBrYXJtYU9wdGlvbnMsXG4gICAgICAgIHsgcHJvbWlzZUNvbmZpZzogdHJ1ZSwgdGhyb3dFcnJvcnM6IHRydWUgfSxcbiAgICAgICk7XG5cbiAgICAgIHJldHVybiBba2FybWEsIHBhcnNlZEthcm1hQ29uZmlnXSBhcyBbdHlwZW9mIGthcm1hLCBLYXJtYUNvbmZpZ09wdGlvbnNdO1xuICAgIH0pLFxuICAgIHN3aXRjaE1hcChcbiAgICAgIChba2FybWEsIGthcm1hQ29uZmlnXSkgPT5cbiAgICAgICAgbmV3IE9ic2VydmFibGU8QnVpbGRlck91dHB1dD4oKHN1YnNjcmliZXIpID0+IHtcbiAgICAgICAgICAvLyBQYXNzIG9udG8gS2FybWEgdG8gZW1pdCBCdWlsZEV2ZW50cy5cbiAgICAgICAgICBrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgPz89IHt9O1xuICAgICAgICAgIGlmICh0eXBlb2Yga2FybWFDb25maWcuYnVpbGRXZWJwYWNrID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICAgIChrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgYXMgYW55KS5mYWlsdXJlQ2IgPz89ICgpID0+XG4gICAgICAgICAgICAgIHN1YnNjcmliZXIubmV4dCh7IHN1Y2Nlc3M6IGZhbHNlIH0pO1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICAgIChrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgYXMgYW55KS5zdWNjZXNzQ2IgPz89ICgpID0+XG4gICAgICAgICAgICAgIHN1YnNjcmliZXIubmV4dCh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQ29tcGxldGUgdGhlIG9ic2VydmFibGUgb25jZSB0aGUgS2FybWEgc2VydmVyIHJldHVybnMuXG4gICAgICAgICAgY29uc3Qga2FybWFTZXJ2ZXIgPSBuZXcga2FybWEuU2VydmVyKGthcm1hQ29uZmlnIGFzIENvbmZpZywgKGV4aXRDb2RlKSA9PiB7XG4gICAgICAgICAgICBzdWJzY3JpYmVyLm5leHQoeyBzdWNjZXNzOiBleGl0Q29kZSA9PT0gMCB9KTtcbiAgICAgICAgICAgIHN1YnNjcmliZXIuY29tcGxldGUoKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGNvbnN0IGthcm1hU3RhcnQgPSBrYXJtYVNlcnZlci5zdGFydCgpO1xuXG4gICAgICAgICAgLy8gQ2xlYW51cCwgc2lnbmFsIEthcm1hIHRvIGV4aXQuXG4gICAgICAgICAgcmV0dXJuICgpID0+IGthcm1hU3RhcnQudGhlbigoKSA9PiBrYXJtYVNlcnZlci5zdG9wKCkpO1xuICAgICAgICB9KSxcbiAgICApLFxuICAgIGRlZmF1bHRJZkVtcHR5KHsgc3VjY2VzczogZmFsc2UgfSksXG4gICk7XG59XG5cbmZ1bmN0aW9uIGdldEJ1aWx0SW5LYXJtYUNvbmZpZyhcbiAga2FybWE6IHR5cGVvZiBpbXBvcnQoJ2thcm1hJyksXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgcHJvamVjdE5hbWU6IHN0cmluZyxcbik6IENvbmZpZ09wdGlvbnMgJiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGxldCBjb3ZlcmFnZUZvbGRlck5hbWUgPSBwcm9qZWN0TmFtZS5jaGFyQXQoMCkgPT09ICdAJyA/IHByb2plY3ROYW1lLnNsaWNlKDEpIDogcHJvamVjdE5hbWU7XG4gIGlmICgvW0EtWl0vLnRlc3QoY292ZXJhZ2VGb2xkZXJOYW1lKSkge1xuICAgIGNvdmVyYWdlRm9sZGVyTmFtZSA9IHN0cmluZ3MuZGFzaGVyaXplKGNvdmVyYWdlRm9sZGVyTmFtZSk7XG4gIH1cblxuICBjb25zdCB3b3Jrc3BhY2VSb290UmVxdWlyZSA9IGNyZWF0ZVJlcXVpcmUod29ya3NwYWNlUm9vdCArICcvJyk7XG5cbiAgcmV0dXJuIHtcbiAgICBiYXNlUGF0aDogJycsXG4gICAgZnJhbWV3b3JrczogWydqYXNtaW5lJywgJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyJ10sXG4gICAgcGx1Z2luczogW1xuICAgICAgJ2thcm1hLWphc21pbmUnLFxuICAgICAgJ2thcm1hLWNocm9tZS1sYXVuY2hlcicsXG4gICAgICAna2FybWEtamFzbWluZS1odG1sLXJlcG9ydGVyJyxcbiAgICAgICdrYXJtYS1jb3ZlcmFnZScsXG4gICAgICAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXIvcGx1Z2lucy9rYXJtYScsXG4gICAgXS5tYXAoKHApID0+IHdvcmtzcGFjZVJvb3RSZXF1aXJlKHApKSxcbiAgICBjbGllbnQ6IHtcbiAgICAgIGNsZWFyQ29udGV4dDogZmFsc2UsIC8vIGxlYXZlIEphc21pbmUgU3BlYyBSdW5uZXIgb3V0cHV0IHZpc2libGUgaW4gYnJvd3NlclxuICAgIH0sXG4gICAgamFzbWluZUh0bWxSZXBvcnRlcjoge1xuICAgICAgc3VwcHJlc3NBbGw6IHRydWUsIC8vIHJlbW92ZXMgdGhlIGR1cGxpY2F0ZWQgdHJhY2VzXG4gICAgfSxcbiAgICBjb3ZlcmFnZVJlcG9ydGVyOiB7XG4gICAgICBkaXI6IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCAnY292ZXJhZ2UnLCBjb3ZlcmFnZUZvbGRlck5hbWUpLFxuICAgICAgc3ViZGlyOiAnLicsXG4gICAgICByZXBvcnRlcnM6IFt7IHR5cGU6ICdodG1sJyB9LCB7IHR5cGU6ICd0ZXh0LXN1bW1hcnknIH1dLFxuICAgIH0sXG4gICAgcmVwb3J0ZXJzOiBbJ3Byb2dyZXNzJywgJ2tqaHRtbCddLFxuICAgIHBvcnQ6IDk4NzYsXG4gICAgY29sb3JzOiB0cnVlLFxuICAgIGxvZ0xldmVsOiBrYXJtYS5jb25zdGFudHMuTE9HX0lORk8sXG4gICAgYXV0b1dhdGNoOiB0cnVlLFxuICAgIGJyb3dzZXJzOiBbJ0Nocm9tZSddLFxuICAgIHJlc3RhcnRPbkZpbGVDaGFuZ2U6IHRydWUsXG4gIH07XG59XG5cbmV4cG9ydCB7IEthcm1hQnVpbGRlck9wdGlvbnMgfTtcbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXI8UmVjb3JkPHN0cmluZywgc3RyaW5nPiAmIEthcm1hQnVpbGRlck9wdGlvbnM+KGV4ZWN1dGUpO1xuXG5mdW5jdGlvbiBnZXRCdWlsdEluTWFpbkZpbGUoKTogc3RyaW5nIHtcbiAgY29uc3QgY29udGVudCA9IEJ1ZmZlci5mcm9tKFxuICAgIGBcbiAgaW1wb3J0IHsgZ2V0VGVzdEJlZCB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUvdGVzdGluZyc7XG4gIGltcG9ydCB7XG4gICAgQnJvd3NlckR5bmFtaWNUZXN0aW5nTW9kdWxlLFxuICAgIHBsYXRmb3JtQnJvd3NlckR5bmFtaWNUZXN0aW5nLFxuICAgfSBmcm9tICdAYW5ndWxhci9wbGF0Zm9ybS1icm93c2VyLWR5bmFtaWMvdGVzdGluZyc7XG5cbiAgLy8gSW5pdGlhbGl6ZSB0aGUgQW5ndWxhciB0ZXN0aW5nIGVudmlyb25tZW50LlxuICBnZXRUZXN0QmVkKCkuaW5pdFRlc3RFbnZpcm9ubWVudChCcm93c2VyRHluYW1pY1Rlc3RpbmdNb2R1bGUsIHBsYXRmb3JtQnJvd3NlckR5bmFtaWNUZXN0aW5nKCksIHtcbiAgICBlcnJvck9uVW5rbm93bkVsZW1lbnRzOiB0cnVlLFxuICAgIGVycm9yT25Vbmtub3duUHJvcGVydGllczogdHJ1ZVxuICB9KTtcbmAsXG4gICkudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuXG4gIHJldHVybiBgbmctdmlydHVhbC1tYWluLmpzIT0hZGF0YTp0ZXh0L2phdmFzY3JpcHQ7YmFzZTY0LCR7Y29udGVudH1gO1xufVxuIl19