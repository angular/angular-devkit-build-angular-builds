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
        customLaunchers: {
            ChromeHeadlessNoSandbox: {
                base: 'ChromeHeadless',
                flags: ['--no-sandbox', '--headless', '--disable-gpu', '--disable-dev-shm-usage'],
            },
        },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9rYXJtYS9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUF5RjtBQUN6RiwrQ0FBK0M7QUFFL0MsbUNBQXVDO0FBQ3ZDLDJDQUE2QjtBQUM3QiwrQkFBd0M7QUFDeEMsOENBQTJEO0FBRzNELHlEQUErRDtBQUMvRCxpREFBcUU7QUFDckUsK0VBQTZGO0FBQzdGLG1EQUF5RTtBQUN6RSw4Q0FBbUY7QUFDbkYsMkRBQXNEO0FBUXRELEtBQUssVUFBVSxVQUFVLENBQ3ZCLE9BQTRCLEVBQzVCLE9BQXVCLEVBQ3ZCLCtCQUFxRTs7SUFFckUsOEJBQThCO0lBQzlCLE1BQU0sSUFBQSxrQ0FBb0IsRUFBQyxPQUFPLENBQUMsQ0FBQztJQUVwQyxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFBLGdFQUF1QztJQUM5RCxtQ0FBbUM7SUFDbkMsMENBQTBDO0lBQzFDLDZEQUE2RDtJQUM3RDtRQUNFLEdBQUksT0FBNEM7UUFDaEQsVUFBVSxFQUFFLEVBQUU7UUFDZCxPQUFPLEVBQUUsU0FBUztRQUNsQixZQUFZLEVBQUUsS0FBSztRQUNuQixjQUFjLEVBQUUsS0FBSztRQUNyQixHQUFHLEVBQUUsS0FBSztRQUNWLFdBQVcsRUFBRSxJQUFJO1FBQ2pCLFdBQVcsRUFBRSxJQUFJO1FBQ2pCLGVBQWUsRUFBRSxLQUFLO1FBQ3RCLGFBQWEsRUFBRSxzQkFBYSxDQUFDLElBQUk7UUFDakMsaUZBQWlGO1FBQ2pGLG9GQUFvRjtRQUNwRixtSEFBbUg7UUFDbkgsNkdBQTZHO1FBQzdHLEtBQUssRUFBRSxJQUFJO0tBQ1osRUFDRCxPQUFPLEVBQ1AsQ0FBQyxHQUFHLEVB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N0QsTUFBTSxFQUFFLEdBQUc7WUFDWCxTQUFTLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxjQUFjLEVBQUUsQ0FBQztTQUN4RDtRQUNELFNBQVMsRUFBRSxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUM7UUFDakMsSUFBSSxFQUFFLElBQUk7UUFDVixNQUFNLEVBQUUsSUFBSTtRQUNaLFFBQVEsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLFFBQVE7UUFDbEMsU0FBUyxFQUFFLElBQUk7UUFDZixRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7UUFDcEIsZUFBZSxFQUFFO1lBQ2YsdUJBQXVCLEVBQUU7Z0JBQ3ZCLElBQUksRUFBRSxnQkFBZ0I7Z0JBQ3RCLEtBQUssRUFBRSxDQUFDLGNBQWMsRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLHlCQUF5QixDQUFDO2FBQ2xGO1NBQ0Y7UUFDRCxtQkFBbUIsRUFBRSxJQUFJO0tBQzFCLENBQUM7QUFDSixDQUFDO0FBR0Qsa0JBQWUsSUFBQSx5QkFBYSxFQUErQyxPQUFPLENBQUMsQ0FBQztBQUVwRixTQUFTLGtCQUFrQjtJQUN6QixNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsSUFBSSxDQUN6Qjs7Ozs7Ozs7Ozs7O0NBWUgsQ0FDRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUVyQixPQUFPLG9EQUFvRCxPQUFPLEVBQUUsQ0FBQztBQUN2RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBzdHJpbmdzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHR5cGUgeyBDb25maWcsIENvbmZpZ09wdGlvbnMgfSBmcm9tICdrYXJtYSc7XG5pbXBvcnQgeyBjcmVhdGVSZXF1aXJlIH0gZnJvbSAnbW9kdWxlJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBmcm9tIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBkZWZhdWx0SWZFbXB0eSwgc3dpdGNoTWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgRXhlY3V0aW9uVHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7IHB1cmdlU3RhbGVCdWlsZENhY2hlIH0gZnJvbSAnLi4vLi4vdXRpbHMvcHVyZ2UtY2FjaGUnO1xuaW1wb3J0IHsgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvdmVyc2lvbic7XG5pbXBvcnQgeyBnZW5lcmF0ZUJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IGdldENvbW1vbkNvbmZpZywgZ2V0U3R5bGVzQ29uZmlnIH0gZnJvbSAnLi4vLi4vd2VicGFjay9jb25maWdzJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMsIE91dHB1dEhhc2hpbmcgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBGaW5kVGVzdHNQbHVnaW4gfSBmcm9tICcuL2ZpbmQtdGVzdHMtcGx1Z2luJztcbmltcG9ydCB7IFNjaGVtYSBhcyBLYXJtYUJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5leHBvcnQgdHlwZSBLYXJtYUNvbmZpZ09wdGlvbnMgPSBDb25maWdPcHRpb25zICYge1xuICBidWlsZFdlYnBhY2s/OiB1bmtub3duO1xuICBjb25maWdGaWxlPzogc3RyaW5nO1xufTtcblxuYXN5bmMgZnVuY3Rpb24gaW5pdGlhbGl6ZShcbiAgb3B0aW9uczogS2FybWFCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtZXI/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjxDb25maWd1cmF0aW9uPixcbik6IFByb21pc2U8W3R5cGVvZiBpbXBvcnQoJ2thcm1hJyksIENvbmZpZ3VyYXRpb25dPiB7XG4gIC8vIFB1cmdlIG9sZCBidWlsZCBkaXNrIGNhY2hlLlxuICBhd2FpdCBwdXJnZVN0YWxlQnVpbGRDYWNoZShjb250ZXh0KTtcblxuICBjb25zdCB7IGNvbmZpZyB9ID0gYXdhaXQgZ2VuZXJhdGVCcm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KFxuICAgIC8vIG9ubHkgdHdvIHByb3BlcnRpZXMgYXJlIG1pc3Npbmc6XG4gICAgLy8gKiBgb3V0cHV0UGF0aGAgd2hpY2ggaXMgZml4ZWQgZm9yIHRlc3RzXG4gICAgLy8gKiBgYnVkZ2V0c2Agd2hpY2ggbWlnaHQgYmUgaW5jb3JyZWN0IGR1ZSB0byBleHRyYSBkZXYgbGlic1xuICAgIHtcbiAgICAgIC4uLihvcHRpb25zIGFzIHVua25vd24gYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zKSxcbiAgICAgIG91dHB1dFBhdGg6ICcnLFxuICAgICAgYnVkZ2V0czogdW5kZWZpbmVkLFxuICAgICAgb3B0aW1pemF0aW9uOiBmYWxzZSxcbiAgICAgIGJ1aWxkT3B0aW1pemVyOiBmYWxzZSxcbiAgICAgIGFvdDogZmFsc2UsXG4gICAgICB2ZW5kb3JDaHVuazogdHJ1ZSxcbiAgICAgIG5hbWVkQ2h1bmtzOiB0cnVlLFxuICAgICAgZXh0cmFjdExpY2Vuc2VzOiBmYWxzZSxcbiAgICAgIG91dHB1dEhhc2hpbmc6IE91dHB1dEhhc2hpbmcuTm9uZSxcbiAgICAgIC8vIFRoZSB3ZWJwYWNrIHRpZXIgb3ducyB0aGUgd2F0Y2ggYmVoYXZpb3Igc28gd2Ugd2FudCB0byBmb3JjZSBpdCBpbiB0aGUgY29uZmlnLlxuICAgICAgLy8gV2hlbiBub3QgaW4gd2F0Y2ggbW9kZSwgd2VicGFjay1kZXYtbWlkZGxld2FyZSB3aWxsIGNhbGwgYGNvbXBpbGVyLndhdGNoYCBhbnl3YXkuXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay93ZWJwYWNrLWRldi1taWRkbGV3YXJlL2Jsb2IvNjk4YzlhZTVlOWJiOWEwMTM5ODVhZGQ2MTg5ZmYyMWMxYTFlYzE4NS9zcmMvaW5kZXguanMjTDY1XG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay93ZWJwYWNrL2Jsb2IvY2RlMWI3M2UxMmViOGE3N2ViOWJhNDJlNzkyMGM5ZWM1ZDI5YzJjOS9saWIvQ29tcGlsZXIuanMjTDM3OS1MMzg4XG4gICAgICB3YXRjaDogdHJ1ZSxcbiAgICB9LFxuICAgIGNvbnRleHQsXG4gICAgKHdjbykgPT4gW2dldENvbW1vbkNvbmZpZyh3Y28pLCBnZXRTdHlsZXNDb25maWcod2NvKV0sXG4gICk7XG5cbiAgY29uc3Qga2FybWEgPSBhd2FpdCBpbXBvcnQoJ2thcm1hJyk7XG5cbiAgcmV0dXJuIFtrYXJtYSwgKGF3YWl0IHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtZXI/Lihjb25maWcpKSA/PyBjb25maWddO1xufVxuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleGVjdXRlKFxuICBvcHRpb25zOiBLYXJtYUJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgdHJhbnNmb3Jtczoge1xuICAgIHdlYnBhY2tDb25maWd1cmF0aW9uPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8Q29uZmlndXJhdGlvbj47XG4gICAgLy8gVGhlIGthcm1hIG9wdGlvbnMgdHJhbnNmb3JtIGNhbm5vdCBiZSBhc3luYyB3aXRob3V0IGEgcmVmYWN0b3Igb2YgdGhlIGJ1aWxkZXIgaW1wbGVtZW50YXRpb25cbiAgICBrYXJtYU9wdGlvbnM/OiAob3B0aW9uczogS2FybWFDb25maWdPcHRpb25zKSA9PiBLYXJtYUNvbmZpZ09wdGlvbnM7XG4gIH0gPSB7fSxcbik6IE9ic2VydmFibGU8QnVpbGRlck91dHB1dD4ge1xuICAvLyBDaGVjayBBbmd1bGFyIHZlcnNpb24uXG4gIGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbihjb250ZXh0LndvcmtzcGFjZVJvb3QpO1xuXG4gIGxldCBzaW5nbGVSdW46IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG4gIGlmIChvcHRpb25zLndhdGNoICE9PSB1bmRlZmluZWQpIHtcbiAgICBzaW5nbGVSdW4gPSAhb3B0aW9ucy53YXRjaDtcbiAgfVxuXG4gIHJldHVybiBmcm9tKGluaXRpYWxpemUob3B0aW9ucywgY29udGV4dCwgdHJhbnNmb3Jtcy53ZWJwYWNrQ29uZmlndXJhdGlvbikpLnBpcGUoXG4gICAgc3dpdGNoTWFwKGFzeW5jIChba2FybWEsIHdlYnBhY2tDb25maWddKSA9PiB7XG4gICAgICAvLyBEZXRlcm1pbmUgcHJvamVjdCBuYW1lIGZyb20gYnVpbGRlciBjb250ZXh0IHRhcmdldFxuICAgICAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgICAgIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJ2thcm1hJyBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0IHRvIGJlIHNwZWNpZmllZC5gKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qga2FybWFPcHRpb25zOiBLYXJtYUNvbmZpZ09wdGlvbnMgPSBvcHRpb25zLmthcm1hQ29uZmlnXG4gICAgICAgID8ge31cbiAgICAgICAgOiBnZXRCdWlsdEluS2FybWFDb25maWcoa2FybWEsIGNvbnRleHQud29ya3NwYWNlUm9vdCwgcHJvamVjdE5hbWUpO1xuXG4gICAgICBrYXJtYU9wdGlvbnMuc2luZ2xlUnVuID0gc2luZ2xlUnVuO1xuXG4gICAgICAvLyBDb252ZXJ0IGJyb3dzZXJzIGZyb20gYSBzdHJpbmcgdG8gYW4gYXJyYXlcbiAgICAgIGlmIChvcHRpb25zLmJyb3dzZXJzKSB7XG4gICAgICAgIGthcm1hT3B0aW9ucy5icm93c2VycyA9IG9wdGlvbnMuYnJvd3NlcnMuc3BsaXQoJywnKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMucmVwb3J0ZXJzKSB7XG4gICAgICAgIC8vIFNwbGl0IGFsb25nIGNvbW1hcyB0byBtYWtlIGl0IG1vcmUgbmF0dXJhbCwgYW5kIHJlbW92ZSBlbXB0eSBzdHJpbmdzLlxuICAgICAgICBjb25zdCByZXBvcnRlcnMgPSBvcHRpb25zLnJlcG9ydGVyc1xuICAgICAgICAgIC5yZWR1Y2U8c3RyaW5nW10+KChhY2MsIGN1cnIpID0+IGFjYy5jb25jYXQoY3Vyci5zcGxpdCgnLCcpKSwgW10pXG4gICAgICAgICAgLmZpbHRlcigoeCkgPT4gISF4KTtcblxuICAgICAgICBpZiAocmVwb3J0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBrYXJtYU9wdGlvbnMucmVwb3J0ZXJzID0gcmVwb3J0ZXJzO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghb3B0aW9ucy5tYWluKSB7XG4gICAgICAgIHdlYnBhY2tDb25maWcuZW50cnkgPz89IHt9O1xuICAgICAgICBpZiAodHlwZW9mIHdlYnBhY2tDb25maWcuZW50cnkgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHdlYnBhY2tDb25maWcuZW50cnkpKSB7XG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkod2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddKSkge1xuICAgICAgICAgICAgd2VicGFja0NvbmZpZy5lbnRyeVsnbWFpbiddLnB1c2goZ2V0QnVpbHRJbk1haW5GaWxlKCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10gPSBbZ2V0QnVpbHRJbk1haW5GaWxlKCldO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBwcm9qZWN0TWV0YWRhdGEgPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gICAgICBjb25zdCBzb3VyY2VSb290ID0gKHByb2plY3RNZXRhZGF0YS5zb3VyY2VSb290ID8/IHByb2plY3RNZXRhZGF0YS5yb290ID8/ICcnKSBhcyBzdHJpbmc7XG5cbiAgICAgIHdlYnBhY2tDb25maWcucGx1Z2lucyA/Pz0gW107XG4gICAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMucHVzaChcbiAgICAgICAgbmV3IEZpbmRUZXN0c1BsdWdpbih7XG4gICAgICAgICAgaW5jbHVkZTogb3B0aW9ucy5pbmNsdWRlLFxuICAgICAgICAgIHdvcmtzcGFjZVJvb3Q6IGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICBwcm9qZWN0U291cmNlUm9vdDogcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgc291cmNlUm9vdCksXG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgICAga2FybWFPcHRpb25zLmJ1aWxkV2VicGFjayA9IHtcbiAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgd2VicGFja0NvbmZpZyxcbiAgICAgICAgbG9nZ2VyOiBjb250ZXh0LmxvZ2dlcixcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHBhcnNlZEthcm1hQ29uZmlnID0gYXdhaXQga2FybWEuY29uZmlnLnBhcnNlQ29uZmlnKFxuICAgICAgICBvcHRpb25zLmthcm1hQ29uZmlnICYmIHBhdGgucmVzb2x2ZShjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9wdGlvbnMua2FybWFDb25maWcpLFxuICAgICAgICB0cmFuc2Zvcm1zLmthcm1hT3B0aW9ucyA/IHRyYW5zZm9ybXMua2FybWFPcHRpb25zKGthcm1hT3B0aW9ucykgOiBrYXJtYU9wdGlvbnMsXG4gICAgICAgIHsgcHJvbWlzZUNvbmZpZzogdHJ1ZSwgdGhyb3dFcnJvcnM6IHRydWUgfSxcbiAgICAgICk7XG5cbiAgICAgIHJldHVybiBba2FybWEsIHBhcnNlZEthcm1hQ29uZmlnXSBhcyBbdHlwZW9mIGthcm1hLCBLYXJtYUNvbmZpZ09wdGlvbnNdO1xuICAgIH0pLFxuICAgIHN3aXRjaE1hcChcbiAgICAgIChba2FybWEsIGthcm1hQ29uZmlnXSkgPT5cbiAgICAgICAgbmV3IE9ic2VydmFibGU8QnVpbGRlck91dHB1dD4oKHN1YnNjcmliZXIpID0+IHtcbiAgICAgICAgICAvLyBQYXNzIG9udG8gS2FybWEgdG8gZW1pdCBCdWlsZEV2ZW50cy5cbiAgICAgICAgICBrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgPz89IHt9O1xuICAgICAgICAgIGlmICh0eXBlb2Yga2FybWFDb25maWcuYnVpbGRXZWJwYWNrID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICAgIChrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgYXMgYW55KS5mYWlsdXJlQ2IgPz89ICgpID0+XG4gICAgICAgICAgICAgIHN1YnNjcmliZXIubmV4dCh7IHN1Y2Nlc3M6IGZhbHNlIH0pO1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICAgIChrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgYXMgYW55KS5zdWNjZXNzQ2IgPz89ICgpID0+XG4gICAgICAgICAgICAgIHN1YnNjcmliZXIubmV4dCh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQ29tcGxldGUgdGhlIG9ic2VydmFibGUgb25jZSB0aGUgS2FybWEgc2VydmVyIHJldHVybnMuXG4gICAgICAgICAgY29uc3Qga2FybWFTZXJ2ZXIgPSBuZXcga2FybWEuU2VydmVyKGthcm1hQ29uZmlnIGFzIENvbmZpZywgKGV4aXRDb2RlKSA9PiB7XG4gICAgICAgICAgICBzdWJzY3JpYmVyLm5leHQoeyBzdWNjZXNzOiBleGl0Q29kZSA9PT0gMCB9KTtcbiAgICAgICAgICAgIHN1YnNjcmliZXIuY29tcGxldGUoKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGNvbnN0IGthcm1hU3RhcnQgPSBrYXJtYVNlcnZlci5zdGFydCgpO1xuXG4gICAgICAgICAgLy8gQ2xlYW51cCwgc2lnbmFsIEthcm1hIHRvIGV4aXQuXG4gICAgICAgICAgcmV0dXJuICgpID0+IGthcm1hU3RhcnQudGhlbigoKSA9PiBrYXJtYVNlcnZlci5zdG9wKCkpO1xuICAgICAgICB9KSxcbiAgICApLFxuICAgIGRlZmF1bHRJZkVtcHR5KHsgc3VjY2VzczogZmFsc2UgfSksXG4gICk7XG59XG5cbmZ1bmN0aW9uIGdldEJ1aWx0SW5LYXJtYUNvbmZpZyhcbiAga2FybWE6IHR5cGVvZiBpbXBvcnQoJ2thcm1hJyksXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgcHJvamVjdE5hbWU6IHN0cmluZyxcbik6IENvbmZpZ09wdGlvbnMgJiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGxldCBjb3ZlcmFnZUZvbGRlck5hbWUgPSBwcm9qZWN0TmFtZS5jaGFyQXQoMCkgPT09ICdAJyA/IHByb2plY3ROYW1lLnNsaWNlKDEpIDogcHJvamVjdE5hbWU7XG4gIGlmICgvW0EtWl0vLnRlc3QoY292ZXJhZ2VGb2xkZXJOYW1lKSkge1xuICAgIGNvdmVyYWdlRm9sZGVyTmFtZSA9IHN0cmluZ3MuZGFzaGVyaXplKGNvdmVyYWdlRm9sZGVyTmFtZSk7XG4gIH1cblxuICBjb25zdCB3b3Jrc3BhY2VSb290UmVxdWlyZSA9IGNyZWF0ZVJlcXVpcmUod29ya3NwYWNlUm9vdCArICcvJyk7XG5cbiAgcmV0dXJuIHtcbiAgICBiYXNlUGF0aDogJycsXG4gICAgZnJhbWV3b3JrczogWydqYXNtaW5lJywgJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyJ10sXG4gICAgcGx1Z2luczogW1xuICAgICAgJ2thcm1hLWphc21pbmUnLFxuICAgICAgJ2thcm1hLWNocm9tZS1sYXVuY2hlcicsXG4gICAgICAna2FybWEtamFzbWluZS1odG1sLXJlcG9ydGVyJyxcbiAgICAgICdrYXJtYS1jb3ZlcmFnZScsXG4gICAgICAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXIvcGx1Z2lucy9rYXJtYScsXG4gICAgXS5tYXAoKHApID0+IHdvcmtzcGFjZVJvb3RSZXF1aXJlKHApKSxcbiAgICBjbGllbnQ6IHtcbiAgICAgIGNsZWFyQ29udGV4dDogZmFsc2UsIC8vIGxlYXZlIEphc21pbmUgU3BlYyBSdW5uZXIgb3V0cHV0IHZpc2libGUgaW4gYnJvd3NlclxuICAgIH0sXG4gICAgamFzbWluZUh0bWxSZXBvcnRlcjoge1xuICAgICAgc3VwcHJlc3NBbGw6IHRydWUsIC8vIHJlbW92ZXMgdGhlIGR1cGxpY2F0ZWQgdHJhY2VzXG4gICAgfSxcbiAgICBjb3ZlcmFnZVJlcG9ydGVyOiB7XG4gICAgICBkaXI6IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCAnY292ZXJhZ2UnLCBjb3ZlcmFnZUZvbGRlck5hbWUpLFxuICAgICAgc3ViZGlyOiAnLicsXG4gICAgICByZXBvcnRlcnM6IFt7IHR5cGU6ICdodG1sJyB9LCB7IHR5cGU6ICd0ZXh0LXN1bW1hcnknIH1dLFxuICAgIH0sXG4gICAgcmVwb3J0ZXJzOiBbJ3Byb2dyZXNzJywgJ2tqaHRtbCddLFxuICAgIHBvcnQ6IDk4NzYsXG4gICAgY29sb3JzOiB0cnVlLFxuICAgIGxvZ0xldmVsOiBrYXJtYS5jb25zdGFudHMuTE9HX0lORk8sXG4gICAgYXV0b1dhdGNoOiB0cnVlLFxuICAgIGJyb3dzZXJzOiBbJ0Nocm9tZSddLFxuICAgIGN1c3RvbUxhdW5jaGVyczoge1xuICAgICAgQ2hyb21lSGVhZGxlc3NOb1NhbmRib3g6IHtcbiAgICAgICAgYmFzZTogJ0Nocm9tZUhlYWRsZXNzJyxcbiAgICAgICAgZmxhZ3M6IFsnLS1uby1zYW5kYm94JywgJy0taGVhZGxlc3MnLCAnLS1kaXNhYmxlLWdwdScsICctLWRpc2FibGUtZGV2LXNobS11c2FnZSddLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHJlc3RhcnRPbkZpbGVDaGFuZ2U6IHRydWUsXG4gIH07XG59XG5cbmV4cG9ydCB7IEthcm1hQnVpbGRlck9wdGlvbnMgfTtcbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXI8UmVjb3JkPHN0cmluZywgc3RyaW5nPiAmIEthcm1hQnVpbGRlck9wdGlvbnM+KGV4ZWN1dGUpO1xuXG5mdW5jdGlvbiBnZXRCdWlsdEluTWFpbkZpbGUoKTogc3RyaW5nIHtcbiAgY29uc3QgY29udGVudCA9IEJ1ZmZlci5mcm9tKFxuICAgIGBcbiAgaW1wb3J0IHsgZ2V0VGVzdEJlZCB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUvdGVzdGluZyc7XG4gIGltcG9ydCB7XG4gICAgQnJvd3NlckR5bmFtaWNUZXN0aW5nTW9kdWxlLFxuICAgIHBsYXRmb3JtQnJvd3NlckR5bmFtaWNUZXN0aW5nLFxuICAgfSBmcm9tICdAYW5ndWxhci9wbGF0Zm9ybS1icm93c2VyLWR5bmFtaWMvdGVzdGluZyc7XG5cbiAgLy8gSW5pdGlhbGl6ZSB0aGUgQW5ndWxhciB0ZXN0aW5nIGVudmlyb25tZW50LlxuICBnZXRUZXN0QmVkKCkuaW5pdFRlc3RFbnZpcm9ubWVudChCcm93c2VyRHluYW1pY1Rlc3RpbmdNb2R1bGUsIHBsYXRmb3JtQnJvd3NlckR5bmFtaWNUZXN0aW5nKCksIHtcbiAgICBlcnJvck9uVW5rbm93bkVsZW1lbnRzOiB0cnVlLFxuICAgIGVycm9yT25Vbmtub3duUHJvcGVydGllczogdHJ1ZVxuICB9KTtcbmAsXG4gICkudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuXG4gIHJldHVybiBgbmctdmlydHVhbC1tYWluLmpzIT0hZGF0YTp0ZXh0L2phdmFzY3JpcHQ7YmFzZTY0LCR7Y29udGVudH1gO1xufVxuIl19