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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9rYXJtYS9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUF5RjtBQUN6RiwrQ0FBK0M7QUFFL0MsbUNBQXVDO0FBQ3ZDLDJDQUE2QjtBQUM3QiwrQkFBd0M7QUFDeEMsOENBQTJEO0FBRzNELHlEQUErRDtBQUMvRCxpREFBcUU7QUFDckUsK0VBQTZGO0FBQzdGLG1EQUF5RTtBQUN6RSw4Q0FBbUY7QUFDbkYsMkRBQXNEO0FBUXRELEtBQUssVUFBVSxVQUFVLENBQ3ZCLE9BQTRCLEVBQzVCLE9BQXVCLEVBQ3ZCLCtCQUFxRTs7SUFFckUsOEJBQThCO0lBQzlCLE1BQU0sSUFBQSxrQ0FBb0IsRUFBQyxPQUFPLENBQUMsQ0FBQztJQUVwQyxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFBLGdFQUF1QztJQUM5RCxtQ0FBbUM7SUFDbkMsMENBQTBDO0lBQzFDLDZEQUE2RDtJQUM3RDtRQUNFLEdBQUksT0FBNEM7UUFDaEQsVUFBVSxFQUFFLEVBQUU7UUFDZCxPQUFPLEVBQUUsU0FBUztRQUNsQixZQUFZLEVBQUUsS0FBSztRQUNuQixjQUFjLEVBQUUsS0FBSztRQUNyQixHQUFHLEVBQUUsS0FBSztRQUNWLFdBQVcsRUFBRSxJQUFJO1FBQ2pCLFdBQVcsRUFBRSxJQUFJO1FBQ2pCLGVBQWUsRUFBRSxLQUFLO1FBQ3RCLGFBQWEsRUFBRSxzQkFBYSxDQUFDLElBQUk7UUFDakMsaUZBQWlGO1FBQ2pGLG9GQUFvRjtRQUNwRixtSEFBbUg7UUFDbkgsNkdBQTZHO1FBQzdHLEtBQUssRUFBRSxJQUFJO0tBQ1osRUFDRCxPQUFPLEVBQ1AsQ0FBQyxHQUFHLEVB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SSxDQUFDLGFBQWEsRUFBRSxVQUFVLEVBQUUsa0JBQWtCLENBQUM7WUFDN0QsTUFBTSxFQUFFLEdBQUc7WUFDWCxTQUFTLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxjQUFjLEVBQUUsQ0FBQztTQUN4RDtRQUNELFNBQVMsRUFBRSxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUM7UUFDakMsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO1FBQ3BCLG1CQUFtQixFQUFFLElBQUk7S0FDMUIsQ0FBQztBQUNKLENBQUM7QUFHRCxrQkFBZSxJQUFBLHlCQUFhLEVBQStDLE9BQU8sQ0FBQyxDQUFDO0FBRXBGLFNBQVMsa0JBQWtCO0lBQ3pCLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQ3pCOzs7Ozs7Ozs7Ozs7Q0FZSCxDQUNFLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRXJCLE9BQU8sb0RBQW9ELE9BQU8sRUFBRSxDQUFDO0FBQ3ZFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IHN0cmluZ3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgdHlwZSB7IENvbmZpZywgQ29uZmlnT3B0aW9ucyB9IGZyb20gJ2thcm1hJztcbmltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdtb2R1bGUnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGRlZmF1bHRJZkVtcHR5LCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBFeGVjdXRpb25UcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHsgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUgfSBmcm9tICcuLi8uLi91dGlscy9wdXJnZS1jYWNoZSc7XG5pbXBvcnQgeyBhc3NlcnRDb21wYXRpYmxlQW5ndWxhclZlcnNpb24gfSBmcm9tICcuLi8uLi91dGlscy92ZXJzaW9uJztcbmltcG9ydCB7IGdlbmVyYXRlQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dCB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgZ2V0Q29tbW9uQ29uZmlnLCBnZXRTdHlsZXNDb25maWcgfSBmcm9tICcuLi8uLi93ZWJwYWNrL2NvbmZpZ3MnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucywgT3V0cHV0SGFzaGluZyB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IEZpbmRUZXN0c1BsdWdpbiB9IGZyb20gJy4vZmluZC10ZXN0cy1wbHVnaW4nO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEthcm1hQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmV4cG9ydCB0eXBlIEthcm1hQ29uZmlnT3B0aW9ucyA9IENvbmZpZ09wdGlvbnMgJiB7XG4gIGJ1aWxkV2VicGFjaz86IHVua25vd247XG4gIGNvbmZpZ0ZpbGU/OiBzdHJpbmc7XG59O1xuXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplKFxuICBvcHRpb25zOiBLYXJtYUJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgd2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm1lcj86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPENvbmZpZ3VyYXRpb24+LFxuKTogUHJvbWlzZTxbdHlwZW9mIGltcG9ydCgna2FybWEnKSwgQ29uZmlndXJhdGlvbl0+IHtcbiAgLy8gUHVyZ2Ugb2xkIGJ1aWxkIGRpc2sgY2FjaGUuXG4gIGF3YWl0IHB1cmdlU3RhbGVCdWlsZENhY2hlKGNvbnRleHQpO1xuXG4gIGNvbnN0IHsgY29uZmlnIH0gPSBhd2FpdCBnZW5lcmF0ZUJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQoXG4gICAgLy8gb25seSB0d28gcHJvcGVydGllcyBhcmUgbWlzc2luZzpcbiAgICAvLyAqIGBvdXRwdXRQYXRoYCB3aGljaCBpcyBmaXhlZCBmb3IgdGVzdHNcbiAgICAvLyAqIGBidWRnZXRzYCB3aGljaCBtaWdodCBiZSBpbmNvcnJlY3QgZHVlIHRvIGV4dHJhIGRldiBsaWJzXG4gICAge1xuICAgICAgLi4uKG9wdGlvbnMgYXMgdW5rbm93biBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMpLFxuICAgICAgb3V0cHV0UGF0aDogJycsXG4gICAgICBidWRnZXRzOiB1bmRlZmluZWQsXG4gICAgICBvcHRpbWl6YXRpb246IGZhbHNlLFxuICAgICAgYnVpbGRPcHRpbWl6ZXI6IGZhbHNlLFxuICAgICAgYW90OiBmYWxzZSxcbiAgICAgIHZlbmRvckNodW5rOiB0cnVlLFxuICAgICAgbmFtZWRDaHVua3M6IHRydWUsXG4gICAgICBleHRyYWN0TGljZW5zZXM6IGZhbHNlLFxuICAgICAgb3V0cHV0SGFzaGluZzogT3V0cHV0SGFzaGluZy5Ob25lLFxuICAgICAgLy8gVGhlIHdlYnBhY2sgdGllciBvd25zIHRoZSB3YXRjaCBiZWhhdmlvciBzbyB3ZSB3YW50IHRvIGZvcmNlIGl0IGluIHRoZSBjb25maWcuXG4gICAgICAvLyBXaGVuIG5vdCBpbiB3YXRjaCBtb2RlLCB3ZWJwYWNrLWRldi1taWRkbGV3YXJlIHdpbGwgY2FsbCBgY29tcGlsZXIud2F0Y2hgIGFueXdheS5cbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LW1pZGRsZXdhcmUvYmxvYi82OThjOWFlNWU5YmI5YTAxMzk4NWFkZDYxODlmZjIxYzFhMWVjMTg1L3NyYy9pbmRleC5qcyNMNjVcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrL3dlYnBhY2svYmxvYi9jZGUxYjczZTEyZWI4YTc3ZWI5YmE0MmU3OTIwYzllYzVkMjljMmM5L2xpYi9Db21waWxlci5qcyNMMzc5LUwzODhcbiAgICAgIHdhdGNoOiB0cnVlLFxuICAgIH0sXG4gICAgY29udGV4dCxcbiAgICAod2NvKSA9PiBbZ2V0Q29tbW9uQ29uZmlnKHdjbyksIGdldFN0eWxlc0NvbmZpZyh3Y28pXSxcbiAgKTtcblxuICBjb25zdCBrYXJtYSA9IGF3YWl0IGltcG9ydCgna2FybWEnKTtcblxuICByZXR1cm4gW2thcm1hLCAoYXdhaXQgd2VicGFja0NvbmZpZ3VyYXRpb25UcmFuc2Zvcm1lcj8uKGNvbmZpZykpID8/IGNvbmZpZ107XG59XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IEthcm1hQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zOiB7XG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb24/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjxDb25maWd1cmF0aW9uPjtcbiAgICAvLyBUaGUga2FybWEgb3B0aW9ucyB0cmFuc2Zvcm0gY2Fubm90IGJlIGFzeW5jIHdpdGhvdXQgYSByZWZhY3RvciBvZiB0aGUgYnVpbGRlciBpbXBsZW1lbnRhdGlvblxuICAgIGthcm1hT3B0aW9ucz86IChvcHRpb25zOiBLYXJtYUNvbmZpZ09wdGlvbnMpID0+IEthcm1hQ29uZmlnT3B0aW9ucztcbiAgfSA9IHt9LFxuKTogT2JzZXJ2YWJsZTxCdWlsZGVyT3V0cHV0PiB7XG4gIC8vIENoZWNrIEFuZ3VsYXIgdmVyc2lvbi5cbiAgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uKGNvbnRleHQud29ya3NwYWNlUm9vdCk7XG5cbiAgbGV0IHNpbmdsZVJ1bjogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbiAgaWYgKG9wdGlvbnMud2F0Y2ggIT09IHVuZGVmaW5lZCkge1xuICAgIHNpbmdsZVJ1biA9ICFvcHRpb25zLndhdGNoO1xuICB9XG5cbiAgcmV0dXJuIGZyb20oaW5pdGlhbGl6ZShvcHRpb25zLCBjb250ZXh0LCB0cmFuc2Zvcm1zLndlYnBhY2tDb25maWd1cmF0aW9uKSkucGlwZShcbiAgICBzd2l0Y2hNYXAoYXN5bmMgKFtrYXJtYSwgd2VicGFja0NvbmZpZ10pID0+IHtcbiAgICAgIC8vIERldGVybWluZSBwcm9qZWN0IG5hbWUgZnJvbSBidWlsZGVyIGNvbnRleHQgdGFyZ2V0XG4gICAgICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0Py5wcm9qZWN0O1xuICAgICAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSAna2FybWEnIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQgdG8gYmUgc3BlY2lmaWVkLmApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBrYXJtYU9wdGlvbnM6IEthcm1hQ29uZmlnT3B0aW9ucyA9IG9wdGlvbnMua2FybWFDb25maWdcbiAgICAgICAgPyB7fVxuICAgICAgICA6IGdldEJ1aWx0SW5LYXJtYUNvbmZpZyhjb250ZXh0LndvcmtzcGFjZVJvb3QsIHByb2plY3ROYW1lKTtcblxuICAgICAga2FybWFPcHRpb25zLnNpbmdsZVJ1biA9IHNpbmdsZVJ1bjtcblxuICAgICAgLy8gQ29udmVydCBicm93c2VycyBmcm9tIGEgc3RyaW5nIHRvIGFuIGFycmF5XG4gICAgICBpZiAob3B0aW9ucy5icm93c2Vycykge1xuICAgICAgICBrYXJtYU9wdGlvbnMuYnJvd3NlcnMgPSBvcHRpb25zLmJyb3dzZXJzLnNwbGl0KCcsJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLnJlcG9ydGVycykge1xuICAgICAgICAvLyBTcGxpdCBhbG9uZyBjb21tYXMgdG8gbWFrZSBpdCBtb3JlIG5hdHVyYWwsIGFuZCByZW1vdmUgZW1wdHkgc3RyaW5ncy5cbiAgICAgICAgY29uc3QgcmVwb3J0ZXJzID0gb3B0aW9ucy5yZXBvcnRlcnNcbiAgICAgICAgICAucmVkdWNlPHN0cmluZ1tdPigoYWNjLCBjdXJyKSA9PiBhY2MuY29uY2F0KGN1cnIuc3BsaXQoJywnKSksIFtdKVxuICAgICAgICAgIC5maWx0ZXIoKHgpID0+ICEheCk7XG5cbiAgICAgICAgaWYgKHJlcG9ydGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAga2FybWFPcHRpb25zLnJlcG9ydGVycyA9IHJlcG9ydGVycztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIW9wdGlvbnMubWFpbikge1xuICAgICAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5ID8/PSB7fTtcbiAgICAgICAgaWYgKHR5cGVvZiB3ZWJwYWNrQ29uZmlnLmVudHJ5ID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheSh3ZWJwYWNrQ29uZmlnLmVudHJ5KSkge1xuICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXSkpIHtcbiAgICAgICAgICAgIHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXS5wdXNoKGdldEJ1aWx0SW5NYWluRmlsZSgpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgd2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddID0gW2dldEJ1aWx0SW5NYWluRmlsZSgpXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgcHJvamVjdE1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICAgICAgY29uc3Qgc291cmNlUm9vdCA9IChwcm9qZWN0TWV0YWRhdGEuc291cmNlUm9vdCA/PyBwcm9qZWN0TWV0YWRhdGEucm9vdCA/PyAnJykgYXMgc3RyaW5nO1xuXG4gICAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMgPz89IFtdO1xuICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnB1c2goXG4gICAgICAgIG5ldyBGaW5kVGVzdHNQbHVnaW4oe1xuICAgICAgICAgIGluY2x1ZGU6IG9wdGlvbnMuaW5jbHVkZSxcbiAgICAgICAgICBleGNsdWRlOiBvcHRpb25zLmV4Y2x1ZGUsXG4gICAgICAgICAgd29ya3NwYWNlUm9vdDogY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgICAgIHByb2plY3RTb3VyY2VSb290OiBwYXRoLmpvaW4oY29udGV4dC53b3Jrc3BhY2VSb290LCBzb3VyY2VSb290KSxcbiAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgICBrYXJtYU9wdGlvbnMuYnVpbGRXZWJwYWNrID0ge1xuICAgICAgICBvcHRpb25zLFxuICAgICAgICB3ZWJwYWNrQ29uZmlnLFxuICAgICAgICBsb2dnZXI6IGNvbnRleHQubG9nZ2VyLFxuICAgICAgfTtcblxuICAgICAgY29uc3QgcGFyc2VkS2FybWFDb25maWcgPSBhd2FpdCBrYXJtYS5jb25maWcucGFyc2VDb25maWcoXG4gICAgICAgIG9wdGlvbnMua2FybWFDb25maWcgJiYgcGF0aC5yZXNvbHZlKGNvbnRleHQud29ya3NwYWNlUm9vdCwgb3B0aW9ucy5rYXJtYUNvbmZpZyksXG4gICAgICAgIHRyYW5zZm9ybXMua2FybWFPcHRpb25zID8gdHJhbnNmb3Jtcy5rYXJtYU9wdGlvbnMoa2FybWFPcHRpb25zKSA6IGthcm1hT3B0aW9ucyxcbiAgICAgICAgeyBwcm9taXNlQ29uZmlnOiB0cnVlLCB0aHJvd0Vycm9yczogdHJ1ZSB9LFxuICAgICAgKTtcblxuICAgICAgcmV0dXJuIFtrYXJtYSwgcGFyc2VkS2FybWFDb25maWddIGFzIFt0eXBlb2Yga2FybWEsIEthcm1hQ29uZmlnT3B0aW9uc107XG4gICAgfSksXG4gICAgc3dpdGNoTWFwKFxuICAgICAgKFtrYXJtYSwga2FybWFDb25maWddKSA9PlxuICAgICAgICBuZXcgT2JzZXJ2YWJsZTxCdWlsZGVyT3V0cHV0Pigoc3Vic2NyaWJlcikgPT4ge1xuICAgICAgICAgIC8vIFBhc3Mgb250byBLYXJtYSB0byBlbWl0IEJ1aWxkRXZlbnRzLlxuICAgICAgICAgIGthcm1hQ29uZmlnLmJ1aWxkV2VicGFjayA/Pz0ge307XG4gICAgICAgICAgaWYgKHR5cGVvZiBrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgICAgICAgKGthcm1hQ29uZmlnLmJ1aWxkV2VicGFjayBhcyBhbnkpLmZhaWx1cmVDYiA/Pz0gKCkgPT5cbiAgICAgICAgICAgICAgc3Vic2NyaWJlci5uZXh0KHsgc3VjY2VzczogZmFsc2UgfSk7XG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgICAgICAgKGthcm1hQ29uZmlnLmJ1aWxkV2VicGFjayBhcyBhbnkpLnN1Y2Nlc3NDYiA/Pz0gKCkgPT5cbiAgICAgICAgICAgICAgc3Vic2NyaWJlci5uZXh0KHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBDb21wbGV0ZSB0aGUgb2JzZXJ2YWJsZSBvbmNlIHRoZSBLYXJtYSBzZXJ2ZXIgcmV0dXJucy5cbiAgICAgICAgICBjb25zdCBrYXJtYVNlcnZlciA9IG5ldyBrYXJtYS5TZXJ2ZXIoa2FybWFDb25maWcgYXMgQ29uZmlnLCAoZXhpdENvZGUpID0+IHtcbiAgICAgICAgICAgIHN1YnNjcmliZXIubmV4dCh7IHN1Y2Nlc3M6IGV4aXRDb2RlID09PSAwIH0pO1xuICAgICAgICAgICAgc3Vic2NyaWJlci5jb21wbGV0ZSgpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgY29uc3Qga2FybWFTdGFydCA9IGthcm1hU2VydmVyLnN0YXJ0KCk7XG5cbiAgICAgICAgICAvLyBDbGVhbnVwLCBzaWduYWwgS2FybWEgdG8gZXhpdC5cbiAgICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgICAgdm9pZCBrYXJtYVN0YXJ0LnRoZW4oKCkgPT4ga2FybWFTZXJ2ZXIuc3RvcCgpKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSxcbiAgICApLFxuICAgIGRlZmF1bHRJZkVtcHR5KHsgc3VjY2VzczogZmFsc2UgfSksXG4gICk7XG59XG5cbmZ1bmN0aW9uIGdldEJ1aWx0SW5LYXJtYUNvbmZpZyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuKTogQ29uZmlnT3B0aW9ucyAmIFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgbGV0IGNvdmVyYWdlRm9sZGVyTmFtZSA9IHByb2plY3ROYW1lLmNoYXJBdCgwKSA9PT0gJ0AnID8gcHJvamVjdE5hbWUuc2xpY2UoMSkgOiBwcm9qZWN0TmFtZTtcbiAgaWYgKC9bQS1aXS8udGVzdChjb3ZlcmFnZUZvbGRlck5hbWUpKSB7XG4gICAgY292ZXJhZ2VGb2xkZXJOYW1lID0gc3RyaW5ncy5kYXNoZXJpemUoY292ZXJhZ2VGb2xkZXJOYW1lKTtcbiAgfVxuXG4gIGNvbnN0IHdvcmtzcGFjZVJvb3RSZXF1aXJlID0gY3JlYXRlUmVxdWlyZSh3b3Jrc3BhY2VSb290ICsgJy8nKTtcblxuICAvLyBBbnkgY2hhbmdlcyB0byB0aGUgY29uZmlnIGhlcmUgbmVlZCB0byBiZSBzeW5jZWQgdG86IHBhY2thZ2VzL3NjaGVtYXRpY3MvYW5ndWxhci9jb25maWcvZmlsZXMva2FybWEuY29uZi5qcy50ZW1wbGF0ZVxuICByZXR1cm4ge1xuICAgIGJhc2VQYXRoOiAnJyxcbiAgICBmcmFtZXdvcmtzOiBbJ2phc21pbmUnLCAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXInXSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICAna2FybWEtamFzbWluZScsXG4gICAgICAna2FybWEtY2hyb21lLWxhdW5jaGVyJyxcbiAgICAgICdrYXJtYS1qYXNtaW5lLWh0bWwtcmVwb3J0ZXInLFxuICAgICAgJ2thcm1hLWNvdmVyYWdlJyxcbiAgICAgICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhci9wbHVnaW5zL2thcm1hJyxcbiAgICBdLm1hcCgocCkgPT4gd29ya3NwYWNlUm9vdFJlcXVpcmUocCkpLFxuICAgIGNsaWVudDoge1xuICAgICAgY2xlYXJDb250ZXh0OiBmYWxzZSwgLy8gbGVhdmUgSmFzbWluZSBTcGVjIFJ1bm5lciBvdXRwdXQgdmlzaWJsZSBpbiBicm93c2VyXG4gICAgfSxcbiAgICBqYXNtaW5lSHRtbFJlcG9ydGVyOiB7XG4gICAgICBzdXBwcmVzc0FsbDogdHJ1ZSwgLy8gcmVtb3ZlcyB0aGUgZHVwbGljYXRlZCB0cmFjZXNcbiAgICB9LFxuICAgIGNvdmVyYWdlUmVwb3J0ZXI6IHtcbiAgICAgIGRpcjogcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsICdjb3ZlcmFnZScsIGNvdmVyYWdlRm9sZGVyTmFtZSksXG4gICAgICBzdWJkaXI6ICcuJyxcbiAgICAgIHJlcG9ydGVyczogW3sgdHlwZTogJ2h0bWwnIH0sIHsgdHlwZTogJ3RleHQtc3VtbWFyeScgfV0sXG4gICAgfSxcbiAgICByZXBvcnRlcnM6IFsncHJvZ3Jlc3MnLCAna2podG1sJ10sXG4gICAgYnJvd3NlcnM6IFsnQ2hyb21lJ10sXG4gICAgcmVzdGFydE9uRmlsZUNoYW5nZTogdHJ1ZSxcbiAgfTtcbn1cblxuZXhwb3J0IHsgS2FybWFCdWlsZGVyT3B0aW9ucyB9O1xuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcjxSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ICYgS2FybWFCdWlsZGVyT3B0aW9ucz4oZXhlY3V0ZSk7XG5cbmZ1bmN0aW9uIGdldEJ1aWx0SW5NYWluRmlsZSgpOiBzdHJpbmcge1xuICBjb25zdCBjb250ZW50ID0gQnVmZmVyLmZyb20oXG4gICAgYFxuICBpbXBvcnQgeyBnZXRUZXN0QmVkIH0gZnJvbSAnQGFuZ3VsYXIvY29yZS90ZXN0aW5nJztcbiAgaW1wb3J0IHtcbiAgICBCcm93c2VyRHluYW1pY1Rlc3RpbmdNb2R1bGUsXG4gICAgcGxhdGZvcm1Ccm93c2VyRHluYW1pY1Rlc3RpbmcsXG4gICB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLWJyb3dzZXItZHluYW1pYy90ZXN0aW5nJztcblxuICAvLyBJbml0aWFsaXplIHRoZSBBbmd1bGFyIHRlc3RpbmcgZW52aXJvbm1lbnQuXG4gIGdldFRlc3RCZWQoKS5pbml0VGVzdEVudmlyb25tZW50KEJyb3dzZXJEeW5hbWljVGVzdGluZ01vZHVsZSwgcGxhdGZvcm1Ccm93c2VyRHluYW1pY1Rlc3RpbmcoKSwge1xuICAgIGVycm9yT25Vbmtub3duRWxlbWVudHM6IHRydWUsXG4gICAgZXJyb3JPblVua25vd25Qcm9wZXJ0aWVzOiB0cnVlXG4gIH0pO1xuYCxcbiAgKS50b1N0cmluZygnYmFzZTY0Jyk7XG5cbiAgcmV0dXJuIGBuZy12aXJ0dWFsLW1haW4uanMhPSFkYXRhOnRleHQvamF2YXNjcmlwdDtiYXNlNjQsJHtjb250ZW50fWA7XG59XG4iXX0=