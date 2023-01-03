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
            : getBuiltInKarmaConfig(context.workspaceRoot, projectName);
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
        return () => {
            void karmaStart.then(() => karmaServer.stop());
        };
    })), (0, operators_1.defaultIfEmpty)({ success: false }));
}
exports.execute = execute;
function getBuiltInKarmaConfig(workspaceRoot, projectName) {
    let coverageFolderName = projectName.charAt(0) === '@' ? projectName.slice(1) : projectName;
    if (/[A-Z]/.test(coverageFolderName)) {
        coverageFolderName = core_1.strings.dasherize(coverageFolderName);
    }
    const workspaceRootRequire = (0, module_1.createRequire)(workspaceRoot + '/');
    // Any changes to the config here need to be synced to: packages/schematics/angular/config/files/karma.conf.js.template
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9rYXJtYS9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUF5RjtBQUN6RiwrQ0FBK0M7QUFFL0MsbUNBQXVDO0FBQ3ZDLDJDQUE2QjtBQUM3QiwrQkFBd0M7QUFDeEMsOENBQTJEO0FBRzNELHlEQUErRDtBQUMvRCxpREFBcUU7QUFDckUsK0VBQTZGO0FBQzdGLG1EQUF5RTtBQUN6RSw4Q0FBbUY7QUFDbkYsMkRBQXNEO0FBUXRELEtBQUssVUFBVSxVQUFVLENBQ3ZCLE9BQTRCLEVBQzVCLE9BQXVCLEVBQ3ZCLCtCQUFxRTs7SUFFckUsOEJBQThCO0lBQzlCLE1BQU0sSUFBQSxrQ0FBb0IsRUFBQyxPQUFPLENBQUMsQ0FBQztJQUVwQyxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFBLGdFQUF1QztJQUM5RCxtQ0FBbUM7SUFDbkMsMENBQTBDO0lBQzFDLDZEQUE2RDtJQUM3RDtRQUNFLEdBQUksT0FBNEM7UUFDaEQsVUFBVSxFQUFFLEVBQUU7UUFDZCxPQUFPLEVBQUUsU0FBUztRQUNsQixZQUFZLEVBQUUsS0FBSztRQUNuQixjQUFjLEVBQUUsS0FBSztRQUNyQixHQUFHLEVBQUUsS0FBSztRQUNWLFdBQVcsRUFBRSxJQUFJO1FBQ2pCLFdBQVcsRUFBRSxJQUFJO1FBQ2pCLGVBQWUsRUFBRSxLQUFLO1FBQ3RCLGFBQWEsRUFBRSxzQkFBYSxDQUFDLElBQUk7UUFDakMsaUZBQWlGO1FBQ2pGLG9GQUFvRjtRQUNwRixtSEFBbUg7UUFDbkgsNkdBQTZHO1FBQzdHLEtBQUssRUFBRSxJQUFJO0tBQ1osRUFDRCxPQUFPLEVBQ1AsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsQ0FBQyxDQUN0RCxDQUFDO0lBRUYsTUFBTSxLQUFLLEdBQUcsd0RBQWEsT0FBTyxHQUFDLENBQUM7SUFFcEMsT0FBTyxDQUFDLEtBQUssRUFBRSxNQUFBLENBQUMsTUFBTSxDQUFBLCtCQUErQixhQUEvQiwrQkFBK0IsdUJBQS9CLCtCQUErQixDQUFHLE1BQU0sQ0FBQyxDQUFBLENBQUMsbUNBQUksTUFBTSxDQUFDLENBQUM7QUFDOUUsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsT0FBTyxDQUNyQixPQUE0QixFQUM1QixPQUF1QixFQUN2QixhQUlJLEVBQUU7SUFFTix5QkFBeUI7SUFDekIsSUFBQSx3Q0FBOEIsRUFBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7SUFFdEQsSUFBSSxTQUE4QixDQUFDO0lBQ25DLElBQUksT0FBTyxDQUFDLEtBQUssS0FBSyxTQUFTLEVBQUU7UUFDL0IsU0FBUyxHQUFHLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztLQUM1QjtJQUVELE9BQU8sSUFBQSxXQUFJLEVBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsVUFBVSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQzdFLElBQUEscUJBQVMsRUFBQyxLQUFLLEVBQUUsQ0FBQyxLQUFLLEVBQUUsYUFBYSxDQUFDLEVBQUUsRUFBRTs7UUFDekMscURBQXFEO1FBQ3JELE1BQU0sV0FBVyxHQUFHLE1BQUEsT0FBTyxDQUFDLE1BQU0sMENBQUUsT0FBTyxDQUFDO1FBQzVDLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyx3REFBd0QsQ0FBQyxDQUFDO1NBQzNFO1FBRUQsTUFBTSxZQUFZLEdBQXVCLE9BQU8sQ0FBQyxXQUFXO1lBQzFELENBQUMsQ0FBQyxFQUFFO1lBQ0osQ0FBQyxDQUFDLHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFFOUQsWUFBWSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFFbkMsNkNBQTZDO1FBQzdDLElBQUksT0FBTyxDQUFDLFFBQVEsRUFBRTtZQUNwQixZQUFZLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ3JEO1FBRUQsSUFBSSxPQUFPLENBQUMsU0FBUyxFQUFFO1lBQ3JCLHdFQUF3RTtZQUN4RSxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsU0FBUztpQkFDaEMsTUFBTSxDQUFXLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDO2lCQUNoRSxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUV0QixJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUN4QixZQUFZLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQzthQUNwQztTQUNGO1FBRUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7WUFDakIsTUFBQSxhQUFhLENBQUMsS0FBSyxvQ0FBbkIsYUFBYSxDQUFDLEtBQUssR0FBSyxFQUFFLEVBQUM7WUFDM0IsSUFBSSxPQUFPLGFBQWEsQ0FBQyxLQUFLLEtBQUssUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQ2xGLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUU7b0JBQzlDLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQztpQkFDeEQ7cUJBQU07b0JBQ0wsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQztpQkFDdEQ7YUFDRjtTQUNGO1FBRUQsTUFBTSxlQUFlLEdBQUcsTUFBTSxPQUFPLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDdEUsTUFBTSxVQUFVLEdBQUcsQ0FBQyxNQUFBLE1BQUEsZUFBZSxDQUFDLFVBQVUsbUNBQUksZUFBZSxDQUFDLElBQUksbUNBQUksRUFBRSxDQUFXLENBQUM7UUFFeEYsTUFBQSxhQUFhLENBQUMsT0FBTyxvQ0FBckIsYUFBYSxDQUFDLE9BQU8sR0FBSyxFQUFFLEVBQUM7UUFDN0IsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQ3hCLElBQUksbUNBQWUsQ0FBQztZQUNsQixPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU87WUFDeEIsYUFBYSxFQUFFLE9BQU8sQ0FBQyxhQUFhO1lBQ3BDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxVQUFVLENBQUM7U0FDaEUsQ0FBQyxDQUNILENBQUM7UUFFRixZQUFZLENBQUMsWUFBWSxHQUFHO1lBQzFCLE9BQU87WUFDUCxhQUFhO1lBQ2IsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNO1NBQ3ZCLENBQUM7UUFFRixNQUFNLGlCQUFpQixHQUFHLE1BQU0sS0FBSyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQ3RELE9BQU8sQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFDL0UsVUFBVSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxFQUM5RSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxDQUMzQyxDQUFDO1FBRUYsT0FBTyxDQUFDLEtBQUssRUFBRSxpQkFBaUIsQ0FBdUMsQ0FBQztJQUMxRSxDQUFDLENBQUMsRUFDRixJQUFBLHFCQUFTLEVBQ1AsQ0FBQyxDQUFDLEtBQUssRUFBRSxXQUFXLENBQUMsRUFBRSxFQUFFLENBQ3ZCLElBQUksaUJBQVUsQ0FBZ0IsQ0FBQyxVQUFVLEVBQUUsRUFBRTs7O1FBQzNDLHVDQUF1QztRQUN2QyxNQUFBLFdBQVcsQ0FBQyxZQUFZLG9DQUF4QixXQUFXLENBQUMsWUFBWSxHQUFLLEVBQUUsRUFBQztRQUNoQyxJQUFJLE9BQU8sV0FBVyxDQUFDLFlBQVksS0FBSyxRQUFRLEVBQUU7WUFDaEQsOERBQThEO1lBQzlELFlBQUMsV0FBVyxDQUFDLFlBQW9CLEVBQUMsU0FBUyx1Q0FBVCxTQUFTLEdBQUssR0FBRyxFQUFFLENBQ25ELFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBQztZQUN0Qyw4REFBOEQ7WUFDOUQsWUFBQyxXQUFXLENBQUMsWUFBb0IsRUFBQyxTQUFTLHVDQUFULFNBQVMsR0FBSyxHQUFHLEVBQUUsQ0FDbkQsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFDO1NBQ3RDO1FBRUQseURBQXlEO1FBQ3pELE1BQU0sV0FBVyxHQUFHLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxXQUFxQixFQUFFLENBQUMsUUFBUSxFQUFFLEVBQUU7WUFDdkUsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxRQUFRLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUM3QyxVQUFVLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDeEIsQ0FBQyxDQUFDLENBQUM7UUFFSCxNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFdkMsaUNBQWlDO1FBQ2pDLE9BQU8sR0FBRyxFQUFFO1lBQ1YsS0FBSyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ2pELENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUNMLEVBQ0QsSUFBQSwwQkFBYyxFQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQ25DLENBQUM7QUFDSixDQUFDO0FBbEhELDBCQWtIQztBQUVELFNBQVMscUJBQXFCLENBQzVCLGFBQXFCLEVBQ3JCLFdBQW1CO0lBRW5CLElBQUksa0JBQWtCLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQztJQUM1RixJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsRUFBRTtRQUNwQyxrQkFBa0IsR0FBRyxjQUFPLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLENBQUM7S0FDNUQ7SUFFRCxNQUFNLG9CQUFvQixHQUFHLElBQUEsc0JBQWEsRUFBQyxhQUFhLEdBQUcsR0FBRyxDQUFDLENBQUM7SUFFaEUsdUhBQXVIO0lBQ3ZILE9BQU87UUFDTCxRQUFRLEVBQUUsRUFBRTtRQUNaLFVBQVUsRUFBRSxDQUFDLFNBQVMsRUFBRSwrQkFBK0IsQ0FBQztRQUN4RCxPQUFPLEVBQUU7WUFDUCxlQUFlO1lBQ2YsdUJBQXVCO1lBQ3ZCLDZCQUE2QjtZQUM3QixnQkFBZ0I7WUFDaEIsNkNBQTZDO1NBQzlDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyQyxNQUFNLEVBQUU7WUFDTixZQUFZLEVBQUUsS0FBSyxFQUFFLHNEQUFzRDtTQUM1RTtRQUNELG1CQUFtQixFQUFFO1lBQ25CLFdBQVcsRUFBRSxJQUFJLEVBQUUsZ0NBQWdDO1NBQ3BEO1FBQ0QsZ0JBQWdCLEVBQUU7WUFDaEIsR0FBRyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLFVBQVUsRUFBRSxrQkFBa0IsQ0FBQztZQUM3RCxNQUFNLEVBQUUsR0FBRztZQUNYLFNBQVMsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxDQUFDO1NBQ3hEO1FBQ0QsU0FBUyxFQUFFLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQztRQUNqQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7UUFDcEIsbUJBQW1CLEVBQUUsSUFBSTtLQUMxQixDQUFDO0FBQ0osQ0FBQztBQUdELGtCQUFlLElBQUEseUJBQWEsRUFBK0MsT0FBTyxDQUFDLENBQUM7QUFFcEYsU0FBUyxrQkFBa0I7SUFDekIsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FDekI7Ozs7Ozs7Ozs7OztDQVlILENBQ0UsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFckIsT0FBTyxvREFBb0QsT0FBTyxFQUFFLENBQUM7QUFDdkUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgc3RyaW5ncyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB0eXBlIHsgQ29uZmlnLCBDb25maWdPcHRpb25zIH0gZnJvbSAna2FybWEnO1xuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ21vZHVsZSc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgZGVmYXVsdElmRW1wdHksIHN3aXRjaE1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb24gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IEV4ZWN1dGlvblRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vdHJhbnNmb3Jtcyc7XG5pbXBvcnQgeyBwdXJnZVN0YWxlQnVpbGRDYWNoZSB9IGZyb20gJy4uLy4uL3V0aWxzL3B1cmdlLWNhY2hlJztcbmltcG9ydCB7IGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbiB9IGZyb20gJy4uLy4uL3V0aWxzL3ZlcnNpb24nO1xuaW1wb3J0IHsgZ2VuZXJhdGVCcm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0IH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBnZXRDb21tb25Db25maWcsIGdldFN0eWxlc0NvbmZpZyB9IGZyb20gJy4uLy4uL3dlYnBhY2svY29uZmlncyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zLCBPdXRwdXRIYXNoaW5nIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgRmluZFRlc3RzUGx1Z2luIH0gZnJvbSAnLi9maW5kLXRlc3RzLXBsdWdpbic7XG5pbXBvcnQgeyBTY2hlbWEgYXMgS2FybWFCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IHR5cGUgS2FybWFDb25maWdPcHRpb25zID0gQ29uZmlnT3B0aW9ucyAmIHtcbiAgYnVpbGRXZWJwYWNrPzogdW5rbm93bjtcbiAgY29uZmlnRmlsZT86IHN0cmluZztcbn07XG5cbmFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemUoXG4gIG9wdGlvbnM6IEthcm1hQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybWVyPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8Q29uZmlndXJhdGlvbj4sXG4pOiBQcm9taXNlPFt0eXBlb2YgaW1wb3J0KCdrYXJtYScpLCBDb25maWd1cmF0aW9uXT4ge1xuICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgYXdhaXQgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUoY29udGV4dCk7XG5cbiAgY29uc3QgeyBjb25maWcgfSA9IGF3YWl0IGdlbmVyYXRlQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dChcbiAgICAvLyBvbmx5IHR3byBwcm9wZXJ0aWVzIGFyZSBtaXNzaW5nOlxuICAgIC8vICogYG91dHB1dFBhdGhgIHdoaWNoIGlzIGZpeGVkIGZvciB0ZXN0c1xuICAgIC8vICogYGJ1ZGdldHNgIHdoaWNoIG1pZ2h0IGJlIGluY29ycmVjdCBkdWUgdG8gZXh0cmEgZGV2IGxpYnNcbiAgICB7XG4gICAgICAuLi4ob3B0aW9ucyBhcyB1bmtub3duIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyksXG4gICAgICBvdXRwdXRQYXRoOiAnJyxcbiAgICAgIGJ1ZGdldHM6IHVuZGVmaW5lZCxcbiAgICAgIG9wdGltaXphdGlvbjogZmFsc2UsXG4gICAgICBidWlsZE9wdGltaXplcjogZmFsc2UsXG4gICAgICBhb3Q6IGZhbHNlLFxuICAgICAgdmVuZG9yQ2h1bms6IHRydWUsXG4gICAgICBuYW1lZENodW5rczogdHJ1ZSxcbiAgICAgIGV4dHJhY3RMaWNlbnNlczogZmFsc2UsXG4gICAgICBvdXRwdXRIYXNoaW5nOiBPdXRwdXRIYXNoaW5nLk5vbmUsXG4gICAgICAvLyBUaGUgd2VicGFjayB0aWVyIG93bnMgdGhlIHdhdGNoIGJlaGF2aW9yIHNvIHdlIHdhbnQgdG8gZm9yY2UgaXQgaW4gdGhlIGNvbmZpZy5cbiAgICAgIC8vIFdoZW4gbm90IGluIHdhdGNoIG1vZGUsIHdlYnBhY2stZGV2LW1pZGRsZXdhcmUgd2lsbCBjYWxsIGBjb21waWxlci53YXRjaGAgYW55d2F5LlxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay1kZXYtbWlkZGxld2FyZS9ibG9iLzY5OGM5YWU1ZTliYjlhMDEzOTg1YWRkNjE4OWZmMjFjMWExZWMxODUvc3JjL2luZGV4LmpzI0w2NVxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay9ibG9iL2NkZTFiNzNlMTJlYjhhNzdlYjliYTQyZTc5MjBjOWVjNWQyOWMyYzkvbGliL0NvbXBpbGVyLmpzI0wzNzktTDM4OFxuICAgICAgd2F0Y2g6IHRydWUsXG4gICAgfSxcbiAgICBjb250ZXh0LFxuICAgICh3Y28pID0+IFtnZXRDb21tb25Db25maWcod2NvKSwgZ2V0U3R5bGVzQ29uZmlnKHdjbyldLFxuICApO1xuXG4gIGNvbnN0IGthcm1hID0gYXdhaXQgaW1wb3J0KCdrYXJtYScpO1xuXG4gIHJldHVybiBba2FybWEsIChhd2FpdCB3ZWJwYWNrQ29uZmlndXJhdGlvblRyYW5zZm9ybWVyPy4oY29uZmlnKSkgPz8gY29uZmlnXTtcbn1cblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZXhlY3V0ZShcbiAgb3B0aW9uczogS2FybWFCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHRyYW5zZm9ybXM6IHtcbiAgICB3ZWJwYWNrQ29uZmlndXJhdGlvbj86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPENvbmZpZ3VyYXRpb24+O1xuICAgIC8vIFRoZSBrYXJtYSBvcHRpb25zIHRyYW5zZm9ybSBjYW5ub3QgYmUgYXN5bmMgd2l0aG91dCBhIHJlZmFjdG9yIG9mIHRoZSBidWlsZGVyIGltcGxlbWVudGF0aW9uXG4gICAga2FybWFPcHRpb25zPzogKG9wdGlvbnM6IEthcm1hQ29uZmlnT3B0aW9ucykgPT4gS2FybWFDb25maWdPcHRpb25zO1xuICB9ID0ge30sXG4pOiBPYnNlcnZhYmxlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gQ2hlY2sgQW5ndWxhciB2ZXJzaW9uLlxuICBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24oY29udGV4dC53b3Jrc3BhY2VSb290KTtcblxuICBsZXQgc2luZ2xlUnVuOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICBpZiAob3B0aW9ucy53YXRjaCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgc2luZ2xlUnVuID0gIW9wdGlvbnMud2F0Y2g7XG4gIH1cblxuICByZXR1cm4gZnJvbShpbml0aWFsaXplKG9wdGlvbnMsIGNvbnRleHQsIHRyYW5zZm9ybXMud2VicGFja0NvbmZpZ3VyYXRpb24pKS5waXBlKFxuICAgIHN3aXRjaE1hcChhc3luYyAoW2thcm1hLCB3ZWJwYWNrQ29uZmlnXSkgPT4ge1xuICAgICAgLy8gRGV0ZXJtaW5lIHByb2plY3QgbmFtZSBmcm9tIGJ1aWxkZXIgY29udGV4dCB0YXJnZXRcbiAgICAgIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQ/LnByb2plY3Q7XG4gICAgICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlICdrYXJtYScgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldCB0byBiZSBzcGVjaWZpZWQuYCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGthcm1hT3B0aW9uczogS2FybWFDb25maWdPcHRpb25zID0gb3B0aW9ucy5rYXJtYUNvbmZpZ1xuICAgICAgICA/IHt9XG4gICAgICAgIDogZ2V0QnVpbHRJbkthcm1hQ29uZmlnKGNvbnRleHQud29ya3NwYWNlUm9vdCwgcHJvamVjdE5hbWUpO1xuXG4gICAgICBrYXJtYU9wdGlvbnMuc2luZ2xlUnVuID0gc2luZ2xlUnVuO1xuXG4gICAgICAvLyBDb252ZXJ0IGJyb3dzZXJzIGZyb20gYSBzdHJpbmcgdG8gYW4gYXJyYXlcbiAgICAgIGlmIChvcHRpb25zLmJyb3dzZXJzKSB7XG4gICAgICAgIGthcm1hT3B0aW9ucy5icm93c2VycyA9IG9wdGlvbnMuYnJvd3NlcnMuc3BsaXQoJywnKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMucmVwb3J0ZXJzKSB7XG4gICAgICAgIC8vIFNwbGl0IGFsb25nIGNvbW1hcyB0byBtYWtlIGl0IG1vcmUgbmF0dXJhbCwgYW5kIHJlbW92ZSBlbXB0eSBzdHJpbmdzLlxuICAgICAgICBjb25zdCByZXBvcnRlcnMgPSBvcHRpb25zLnJlcG9ydGVyc1xuICAgICAgICAgIC5yZWR1Y2U8c3RyaW5nW10+KChhY2MsIGN1cnIpID0+IGFjYy5jb25jYXQoY3Vyci5zcGxpdCgnLCcpKSwgW10pXG4gICAgICAgICAgLmZpbHRlcigoeCkgPT4gISF4KTtcblxuICAgICAgICBpZiAocmVwb3J0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBrYXJtYU9wdGlvbnMucmVwb3J0ZXJzID0gcmVwb3J0ZXJzO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghb3B0aW9ucy5tYWluKSB7XG4gICAgICAgIHdlYnBhY2tDb25maWcuZW50cnkgPz89IHt9O1xuICAgICAgICBpZiAodHlwZW9mIHdlYnBhY2tDb25maWcuZW50cnkgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHdlYnBhY2tDb25maWcuZW50cnkpKSB7XG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkod2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddKSkge1xuICAgICAgICAgICAgd2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddLnB1c2goZ2V0QnVpbHRJbk1haW5GaWxlKCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10gPSBbZ2V0QnVpbHRJbk1haW5GaWxlKCldO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBwcm9qZWN0TWV0YWRhdGEgPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gICAgICBjb25zdCBzb3VyY2VSb290ID0gKHByb2plY3RNZXRhZGF0YS5zb3VyY2VSb290ID8/IHByb2plY3RNZXRhZGF0YS5yb290ID8/ICcnKSBhcyBzdHJpbmc7XG5cbiAgICAgIHdlYnBhY2tDb25maWcucGx1Z2lucyA/Pz0gW107XG4gICAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMucHVzaChcbiAgICAgICAgbmV3IEZpbmRUZXN0c1BsdWdpbih7XG4gICAgICAgICAgaW5jbHVkZTogb3B0aW9ucy5pbmNsdWRlLFxuICAgICAgICAgIHdvcmtzcGFjZVJvb3Q6IGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICBwcm9qZWN0U291cmNlUm9vdDogcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgc291cmNlUm9vdCksXG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgICAga2FybWFPcHRpb25zLmJ1aWxkV2VicGFjayA9IHtcbiAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgd2VicGFja0NvbmZpZyxcbiAgICAgICAgbG9nZ2VyOiBjb250ZXh0LmxvZ2dlcixcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHBhcnNlZEthcm1hQ29uZmlnID0gYXdhaXQga2FybWEuY29uZmlnLnBhcnNlQ29uZmlnKFxuICAgICAgICBvcHRpb25zLmthcm1hQ29uZmlnICYmIHBhdGgucmVzb2x2ZShjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9wdGlvbnMua2FybWFDb25maWcpLFxuICAgICAgICB0cmFuc2Zvcm1zLmthcm1hT3B0aW9ucyA/IHRyYW5zZm9ybXMua2FybWFPcHRpb25zKGthcm1hT3B0aW9ucykgOiBrYXJtYU9wdGlvbnMsXG4gICAgICAgIHsgcHJvbWlzZUNvbmZpZzogdHJ1ZSwgdGhyb3dFcnJvcnM6IHRydWUgfSxcbiAgICAgICk7XG5cbiAgICAgIHJldHVybiBba2FybWEsIHBhcnNlZEthcm1hQ29uZmlnXSBhcyBbdHlwZW9mIGthcm1hLCBLYXJtYUNvbmZpZ09wdGlvbnNdO1xuICAgIH0pLFxuICAgIHN3aXRjaE1hcChcbiAgICAgIChba2FybWEsIGthcm1hQ29uZmlnXSkgPT5cbiAgICAgICAgbmV3IE9ic2VydmFibGU8QnVpbGRlck91dHB1dD4oKHN1YnNjcmliZXIpID0+IHtcbiAgICAgICAgICAvLyBQYXNzIG9udG8gS2FybWEgdG8gZW1pdCBCdWlsZEV2ZW50cy5cbiAgICAgICAgICBrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgPz89IHt9O1xuICAgICAgICAgIGlmICh0eXBlb2Yga2FybWFDb25maWcuYnVpbGRXZWJwYWNrID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICAgIChrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgYXMgYW55KS5mYWlsdXJlQ2IgPz89ICgpID0+XG4gICAgICAgICAgICAgIHN1YnNjcmliZXIubmV4dCh7IHN1Y2Nlc3M6IGZhbHNlIH0pO1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICAgIChrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgYXMgYW55KS5zdWNjZXNzQ2IgPz89ICgpID0+XG4gICAgICAgICAgICAgIHN1YnNjcmliZXIubmV4dCh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQ29tcGxldGUgdGhlIG9ic2VydmFibGUgb25jZSB0aGUgS2FybWEgc2VydmVyIHJldHVybnMuXG4gICAgICAgICAgY29uc3Qga2FybWFTZXJ2ZXIgPSBuZXcga2FybWEuU2VydmVyKGthcm1hQ29uZmlnIGFzIENvbmZpZywgKGV4aXRDb2RlKSA9PiB7XG4gICAgICAgICAgICBzdWJzY3JpYmVyLm5leHQoeyBzdWNjZXNzOiBleGl0Q29kZSA9PT0gMCB9KTtcbiAgICAgICAgICAgIHN1YnNjcmliZXIuY29tcGxldGUoKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGNvbnN0IGthcm1hU3RhcnQgPSBrYXJtYVNlcnZlci5zdGFydCgpO1xuXG4gICAgICAgICAgLy8gQ2xlYW51cCwgc2lnbmFsIEthcm1hIHRvIGV4aXQuXG4gICAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICAgIHZvaWQga2FybWFTdGFydC50aGVuKCgpID0+IGthcm1hU2VydmVyLnN0b3AoKSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSksXG4gICAgKSxcbiAgICBkZWZhdWx0SWZFbXB0eSh7IHN1Y2Nlc3M6IGZhbHNlIH0pLFxuICApO1xufVxuXG5mdW5jdGlvbiBnZXRCdWlsdEluS2FybWFDb25maWcoXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgcHJvamVjdE5hbWU6IHN0cmluZyxcbik6IENvbmZpZ09wdGlvbnMgJiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGxldCBjb3ZlcmFnZUZvbGRlck5hbWUgPSBwcm9qZWN0TmFtZS5jaGFyQXQoMCkgPT09ICdAJyA/IHByb2plY3ROYW1lLnNsaWNlKDEpIDogcHJvamVjdE5hbWU7XG4gIGlmICgvW0EtWl0vLnRlc3QoY292ZXJhZ2VGb2xkZXJOYW1lKSkge1xuICAgIGNvdmVyYWdlRm9sZGVyTmFtZSA9IHN0cmluZ3MuZGFzaGVyaXplKGNvdmVyYWdlRm9sZGVyTmFtZSk7XG4gIH1cblxuICBjb25zdCB3b3Jrc3BhY2VSb290UmVxdWlyZSA9IGNyZWF0ZVJlcXVpcmUod29ya3NwYWNlUm9vdCArICcvJyk7XG5cbiAgLy8gQW55IGNoYW5nZXMgdG8gdGhlIGNvbmZpZyBoZXJlIG5lZWQgdG8gYmUgc3luY2VkIHRvOiBwYWNrYWdlcy9zY2hlbWF0aWNzL2FuZ3VsYXIvY29uZmlnL2ZpbGVzL2thcm1hLmNvbmYuanMudGVtcGxhdGVcbiAgcmV0dXJuIHtcbiAgICBiYXNlUGF0aDogJycsXG4gICAgZnJhbWV3b3JrczogWydqYXNtaW5lJywgJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyJ10sXG4gICAgcGx1Z2luczogW1xuICAgICAgJ2thcm1hLWphc21pbmUnLFxuICAgICAgJ2thcm1hLWNocm9tZS1sYXVuY2hlcicsXG4gICAgICAna2FybWEtamFzbWluZS1odG1sLXJlcG9ydGVyJyxcbiAgICAgICdrYXJtYS1jb3ZlcmFnZScsXG4gICAgICAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXIvcGx1Z2lucy9rYXJtYScsXG4gICAgXS5tYXAoKHApID0+IHdvcmtzcGFjZVJvb3RSZXF1aXJlKHApKSxcbiAgICBjbGllbnQ6IHtcbiAgICAgIGNsZWFyQ29udGV4dDogZmFsc2UsIC8vIGxlYXZlIEphc21pbmUgU3BlYyBSdW5uZXIgb3V0cHV0IHZpc2libGUgaW4gYnJvd3NlclxuICAgIH0sXG4gICAgamFzbWluZUh0bWxSZXBvcnRlcjoge1xuICAgICAgc3VwcHJlc3NBbGw6IHRydWUsIC8vIHJlbW92ZXMgdGhlIGR1cGxpY2F0ZWQgdHJhY2VzXG4gICAgfSxcbiAgICBjb3ZlcmFnZVJlcG9ydGVyOiB7XG4gICAgICBkaXI6IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCAnY292ZXJhZ2UnLCBjb3ZlcmFnZUZvbGRlck5hbWUpLFxuICAgICAgc3ViZGlyOiAnLicsXG4gICAgICByZXBvcnRlcnM6IFt7IHR5cGU6ICdodG1sJyB9LCB7IHR5cGU6ICd0ZXh0LXN1bW1hcnknIH1dLFxuICAgIH0sXG4gICAgcmVwb3J0ZXJzOiBbJ3Byb2dyZXNzJywgJ2tqaHRtbCddLFxuICAgIGJyb3dzZXJzOiBbJ0Nocm9tZSddLFxuICAgIHJlc3RhcnRPbkZpbGVDaGFuZ2U6IHRydWUsXG4gIH07XG59XG5cbmV4cG9ydCB7IEthcm1hQnVpbGRlck9wdGlvbnMgfTtcbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXI8UmVjb3JkPHN0cmluZywgc3RyaW5nPiAmIEthcm1hQnVpbGRlck9wdGlvbnM+KGV4ZWN1dGUpO1xuXG5mdW5jdGlvbiBnZXRCdWlsdEluTWFpbkZpbGUoKTogc3RyaW5nIHtcbiAgY29uc3QgY29udGVudCA9IEJ1ZmZlci5mcm9tKFxuICAgIGBcbiAgaW1wb3J0IHsgZ2V0VGVzdEJlZCB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUvdGVzdGluZyc7XG4gIGltcG9ydCB7XG4gICAgQnJvd3NlckR5bmFtaWNUZXN0aW5nTW9kdWxlLFxuICAgIHBsYXRmb3JtQnJvd3NlckR5bmFtaWNUZXN0aW5nLFxuICAgfSBmcm9tICdAYW5ndWxhci9wbGF0Zm9ybS1icm93c2VyLWR5bmFtaWMvdGVzdGluZyc7XG5cbiAgLy8gSW5pdGlhbGl6ZSB0aGUgQW5ndWxhciB0ZXN0aW5nIGVudmlyb25tZW50LlxuICBnZXRUZXN0QmVkKCkuaW5pdFRlc3RFbnZpcm9ubWVudChCcm93c2VyRHluYW1pY1Rlc3RpbmdNb2R1bGUsIHBsYXRmb3JtQnJvd3NlckR5bmFtaWNUZXN0aW5nKCksIHtcbiAgICBlcnJvck9uVW5rbm93bkVsZW1lbnRzOiB0cnVlLFxuICAgIGVycm9yT25Vbmtub3duUHJvcGVydGllczogdHJ1ZVxuICB9KTtcbmAsXG4gICkudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuXG4gIHJldHVybiBgbmctdmlydHVhbC1tYWluLmpzIT0hZGF0YTp0ZXh0L2phdmFzY3JpcHQ7YmFzZTY0LCR7Y29udGVudH1gO1xufVxuIl19