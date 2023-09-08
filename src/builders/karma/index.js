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
const configs_1 = require("../../tools/webpack/configs");
const purge_cache_1 = require("../../utils/purge-cache");
const version_1 = require("../../utils/version");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const schema_1 = require("../browser/schema");
const find_tests_plugin_1 = require("./find-tests-plugin");
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
    return [karma, (await webpackConfigurationTransformer?.(config)) ?? config];
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
    return (0, rxjs_1.from)(initialize(options, context, transforms.webpackConfiguration)).pipe((0, rxjs_1.switchMap)(async ([karma, webpackConfig]) => {
        // Determine project name from builder context target
        const projectName = context.target?.project;
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
            webpackConfig.entry ??= {};
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
        const sourceRoot = (projectMetadata.sourceRoot ?? projectMetadata.root ?? '');
        webpackConfig.plugins ??= [];
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
    }), (0, rxjs_1.switchMap)(([karma, karmaConfig]) => new rxjs_1.Observable((subscriber) => {
        // Pass onto Karma to emit BuildEvents.
        karmaConfig.buildWebpack ??= {};
        if (typeof karmaConfig.buildWebpack === 'object') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            karmaConfig.buildWebpack.failureCb ??= () => subscriber.next({ success: false });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            karmaConfig.buildWebpack.successCb ??= () => subscriber.next({ success: true });
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
    })), (0, rxjs_1.defaultIfEmpty)({ success: false }));
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
        customLaunchers: {
            // Chrome configured to run in a bazel sandbox.
            // Disable the use of the gpu and `/dev/shm` because it causes Chrome to
            // crash on some environments.
            // See:
            //   https://github.com/puppeteer/puppeteer/blob/v1.0.0/docs/troubleshooting.md#tips
            //   https://stackoverflow.com/questions/50642308/webdriverexception-unknown-error-devtoolsactiveport-file-doesnt-exist-while-t
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9rYXJtYS9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUF5RjtBQUN6RiwrQ0FBK0M7QUFFL0MsbUNBQXVDO0FBQ3ZDLDJDQUE2QjtBQUM3QiwrQkFBbUU7QUFFbkUseURBQStFO0FBRS9FLHlEQUErRDtBQUMvRCxpREFBcUU7QUFDckUsK0VBQTZGO0FBQzdGLDhDQUFtRjtBQUNuRiwyREFBc0Q7QUFRdEQsS0FBSyxVQUFVLFVBQVUsQ0FDdkIsT0FBNEIsRUFDNUIsT0FBdUIsRUFDdkIsK0JBQXFFO0lBRXJFLDhCQUE4QjtJQUM5QixNQUFNLElBQUEsa0NBQW9CLEVBQUMsT0FBTyxDQUFDLENBQUM7SUFFcEMsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBQSxnRUFBdUM7SUFDOUQsbUNBQW1DO0lBQ25DLDBDQUEwQztJQUMxQyw2REFBNkQ7SUFDN0Q7UUFDRSxHQUFJLE9BQTRDO1FBQ2hELFVBQVUsRUFBRSxFQUFFO1FBQ2QsT0FBTyxFQUFFLFNBQVM7UUFDbEIsWUFBWSxFQUFFLEtBQUs7UUFDbkIsY0FBYyxFQUFFLEtBQUs7UUFDckIsR0FBRyxFQUFFLEtBQUs7UUFDVixXQUFXLEVBQUUsSUFBSTtRQUNqQixXQUFXLEVBQUUsSUFBSTtRQUNqQixlQUFlLEVBQUUsS0FBSztRQUN0QixhQUFhLEVBQUUsc0JBQWEsQ0FBQyxJQUFJO1FBQ2pDLGlGQUFpRjtRQUNqRixvRkFBb0Y7UUFDcEYsbUhBQW1IO1FBQ25ILDZHQUE2RztRQUM3RyxLQUFLLEVBQUUsSUFBSTtLQUNaLEVBQ0QsT0FBTyxFQUNQLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxD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UUFDakMsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO1FBQ3BCLGVBQWUsRUFBRTtZQUNmLCtDQUErQztZQUMvQyx3RUFBd0U7WUFDeEUsOEJBQThCO1lBQzlCLE9BQU87WUFDUCxvRkFBb0Y7WUFDcEYsK0hBQStIO1lBQy9ILHVCQUF1QixFQUFFO2dCQUN2QixJQUFJLEVBQUUsZ0JBQWdCO2dCQUN0QixLQUFLLEVBQUUsQ0FBQyxjQUFjLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSx5QkFBeUIsQ0FBQzthQUNsRjtTQUNGO1FBQ0QsbUJBQW1CLEVBQUUsSUFBSTtLQUMxQixDQUFDO0FBQ0osQ0FBQztBQUdELGtCQUFlLElBQUEseUJBQWEsRUFBK0MsT0FBTyxDQUFDLENBQUM7QUFFcEYsU0FBUyxrQkFBa0I7SUFDekIsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FDekI7Ozs7Ozs7Ozs7OztDQVlILENBQ0UsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFckIsT0FBTyxvREFBb0QsT0FBTyxFQUFFLENBQUM7QUFDdkUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgc3RyaW5ncyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB0eXBlIHsgQ29uZmlnLCBDb25maWdPcHRpb25zIH0gZnJvbSAna2FybWEnO1xuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ21vZHVsZSc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZGVmYXVsdElmRW1wdHksIGZyb20sIHN3aXRjaE1hcCB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgZ2V0Q29tbW9uQ29uZmlnLCBnZXRTdHlsZXNDb25maWcgfSBmcm9tICcuLi8uLi90b29scy93ZWJwYWNrL2NvbmZpZ3MnO1xuaW1wb3J0IHsgRXhlY3V0aW9uVHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7IHB1cmdlU3RhbGVCdWlsZENhY2hlIH0gZnJvbSAnLi4vLi4vdXRpbHMvcHVyZ2UtY2FjaGUnO1xuaW1wb3J0IHsgYXNzZXJ0Q29tcGF0aWJsZUFuZ3VsYXJWZXJzaW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvdmVyc2lvbic7XG5pbXBvcnQgeyBnZW5lcmF0ZUJyb3dzZXJXZWJwYWNrQ29uZmlnRnJvbUNvbnRleHQgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMsIE91dHB1dEhhc2hpbmcgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBGaW5kVGVzdHNQbHVnaW4gfSBmcm9tICcuL2ZpbmQtdGVzdHMtcGx1Z2luJztcbmltcG9ydCB7IFNjaGVtYSBhcyBLYXJtYUJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5leHBvcnQgdHlwZSBLYXJtYUNvbmZpZ09wdGlvbnMgPSBDb25maWdPcHRpb25zICYge1xuICBidWlsZFdlYnBhY2s/OiB1bmtub3duO1xuICBjb25maWdGaWxlPzogc3RyaW5nO1xufTtcblxuYXN5bmMgZnVuY3Rpb24gaW5pdGlhbGl6ZShcbiAgb3B0aW9uczogS2FybWFCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtZXI/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjxDb25maWd1cmF0aW9uPixcbik6IFByb21pc2U8W3R5cGVvZiBpbXBvcnQoJ2thcm1hJyksIENvbmZpZ3VyYXRpb25dPiB7XG4gIC8vIFB1cmdlIG9sZCBidWlsZCBkaXNrIGNhY2hlLlxuICBhd2FpdCBwdXJnZVN0YWxlQnVpbGRDYWNoZShjb250ZXh0KTtcblxuICBjb25zdCB7IGNvbmZpZyB9ID0gYXdhaXQgZ2VuZXJhdGVCcm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KFxuICAgIC8vIG9ubHkgdHdvIHByb3BlcnRpZXMgYXJlIG1pc3Npbmc6XG4gICAgLy8gKiBgb3V0cHV0UGF0aGAgd2hpY2ggaXMgZml4ZWQgZm9yIHRlc3RzXG4gICAgLy8gKiBgYnVkZ2V0c2Agd2hpY2ggbWlnaHQgYmUgaW5jb3JyZWN0IGR1ZSB0byBleHRyYSBkZXYgbGlic1xuICAgIHtcbiAgICAgIC4uLihvcHRpb25zIGFzIHVua25vd24gYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zKSxcbiAgICAgIG91dHB1dFBhdGg6ICcnLFxuICAgICAgYnVkZ2V0czogdW5kZWZpbmVkLFxuICAgICAgb3B0aW1pemF0aW9uOiBmYWxzZSxcbiAgICAgIGJ1aWxkT3B0aW1pemVyOiBmYWxzZSxcbiAgICAgIGFvdDogZmFsc2UsXG4gICAgICB2ZW5kb3JDaHVuazogdHJ1ZSxcbiAgICAgIG5hbWVkQ2h1bmtzOiB0cnVlLFxuICAgICAgZXh0cmFjdExpY2Vuc2VzOiBmYWxzZSxcbiAgICAgIG91dHB1dEhhc2hpbmc6IE91dHB1dEhhc2hpbmcuTm9uZSxcbiAgICAgIC8vIFRoZSB3ZWJwYWNrIHRpZXIgb3ducyB0aGUgd2F0Y2ggYmVoYXZpb3Igc28gd2Ugd2FudCB0byBmb3JjZSBpdCBpbiB0aGUgY29uZmlnLlxuICAgICAgLy8gV2hlbiBub3QgaW4gd2F0Y2ggbW9kZSwgd2VicGFjay1kZXYtbWlkZGxld2FyZSB3aWxsIGNhbGwgYGNvbXBpbGVyLndhdGNoYCBhbnl3YXkuXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay93ZWJwYWNrLWRldi1taWRkbGV3YXJlL2Jsb2IvNjk4YzlhZTVlOWJiOWEwMTM5ODVhZGQ2MTg5ZmYyMWMxYTFlYzE4NS9zcmMvaW5kZXguanMjTDY1XG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay93ZWJwYWNrL2Jsb2IvY2RlMWI3M2UxMmViOGE3N2ViOWJhNDJlNzkyMGM5ZWM1ZDI5YzJjOS9saWIvQ29tcGlsZXIuanMjTDM3OS1MMzg4XG4gICAgICB3YXRjaDogdHJ1ZSxcbiAgICB9LFxuICAgIGNvbnRleHQsXG4gICAgKHdjbykgPT4gW2dldENvbW1vbkNvbmZpZyh3Y28pLCBnZXRTdHlsZXNDb25maWcod2NvKV0sXG4gICk7XG5cbiAgY29uc3Qga2FybWEgPSBhd2FpdCBpbXBvcnQoJ2thcm1hJyk7XG5cbiAgcmV0dXJuIFtrYXJtYSwgKGF3YWl0IHdlYnBhY2tDb25maWd1cmF0aW9uVHJhbnNmb3JtZXI/Lihjb25maWcpKSA/PyBjb25maWddO1xufVxuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleGVjdXRlKFxuICBvcHRpb25zOiBLYXJtYUJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgdHJhbnNmb3Jtczoge1xuICAgIHdlYnBhY2tDb25maWd1cmF0aW9uPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8Q29uZmlndXJhdGlvbj47XG4gICAgLy8gVGhlIGthcm1hIG9wdGlvbnMgdHJhbnNmb3JtIGNhbm5vdCBiZSBhc3luYyB3aXRob3V0IGEgcmVmYWN0b3Igb2YgdGhlIGJ1aWxkZXIgaW1wbGVtZW50YXRpb25cbiAgICBrYXJtYU9wdGlvbnM/OiAob3B0aW9uczogS2FybWFDb25maWdPcHRpb25zKSA9PiBLYXJtYUNvbmZpZ09wdGlvbnM7XG4gIH0gPSB7fSxcbik6IE9ic2VydmFibGU8QnVpbGRlck91dHB1dD4ge1xuICAvLyBDaGVjayBBbmd1bGFyIHZlcnNpb24uXG4gIGFzc2VydENvbXBhdGlibGVBbmd1bGFyVmVyc2lvbihjb250ZXh0LndvcmtzcGFjZVJvb3QpO1xuXG4gIGxldCBzaW5nbGVSdW46IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG4gIGlmIChvcHRpb25zLndhdGNoICE9PSB1bmRlZmluZWQpIHtcbiAgICBzaW5nbGVSdW4gPSAhb3B0aW9ucy53YXRjaDtcbiAgfVxuXG4gIHJldHVybiBmcm9tKGluaXRpYWxpemUob3B0aW9ucywgY29udGV4dCwgdHJhbnNmb3Jtcy53ZWJwYWNrQ29uZmlndXJhdGlvbikpLnBpcGUoXG4gICAgc3dpdGNoTWFwKGFzeW5jIChba2FybWEsIHdlYnBhY2tDb25maWddKSA9PiB7XG4gICAgICAvLyBEZXRlcm1pbmUgcHJvamVjdCBuYW1lIGZyb20gYnVpbGRlciBjb250ZXh0IHRhcmdldFxuICAgICAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgICAgIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJ2thcm1hJyBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0IHRvIGJlIHNwZWNpZmllZC5gKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qga2FybWFPcHRpb25zOiBLYXJtYUNvbmZpZ09wdGlvbnMgPSBvcHRpb25zLmthcm1hQ29uZmlnXG4gICAgICAgID8ge31cbiAgICAgICAgOiBnZXRCdWlsdEluS2FybWFDb25maWcoY29udGV4dC53b3Jrc3BhY2VSb290LCBwcm9qZWN0TmFtZSk7XG5cbiAgICAgIGthcm1hT3B0aW9ucy5zaW5nbGVSdW4gPSBzaW5nbGVSdW47XG5cbiAgICAgIC8vIENvbnZlcnQgYnJvd3NlcnMgZnJvbSBhIHN0cmluZyB0byBhbiBhcnJheVxuICAgICAgaWYgKG9wdGlvbnMuYnJvd3NlcnMpIHtcbiAgICAgICAga2FybWFPcHRpb25zLmJyb3dzZXJzID0gb3B0aW9ucy5icm93c2Vycy5zcGxpdCgnLCcpO1xuICAgICAgfVxuXG4gICAgICBpZiAob3B0aW9ucy5yZXBvcnRlcnMpIHtcbiAgICAgICAgLy8gU3BsaXQgYWxvbmcgY29tbWFzIHRvIG1ha2UgaXQgbW9yZSBuYXR1cmFsLCBhbmQgcmVtb3ZlIGVtcHR5IHN0cmluZ3MuXG4gICAgICAgIGNvbnN0IHJlcG9ydGVycyA9IG9wdGlvbnMucmVwb3J0ZXJzXG4gICAgICAgICAgLnJlZHVjZTxzdHJpbmdbXT4oKGFjYywgY3VycikgPT4gYWNjLmNvbmNhdChjdXJyLnNwbGl0KCcsJykpLCBbXSlcbiAgICAgICAgICAuZmlsdGVyKCh4KSA9PiAhIXgpO1xuXG4gICAgICAgIGlmIChyZXBvcnRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGthcm1hT3B0aW9ucy5yZXBvcnRlcnMgPSByZXBvcnRlcnM7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKCFvcHRpb25zLm1haW4pIHtcbiAgICAgICAgd2VicGFja0NvbmZpZy5lbnRyeSA/Pz0ge307XG4gICAgICAgIGlmICh0eXBlb2Ygd2VicGFja0NvbmZpZy5lbnRyeSA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkod2VicGFja0NvbmZpZy5lbnRyeSkpIHtcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10pKSB7XG4gICAgICAgICAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5WydtYWluJ10ucHVzaChnZXRCdWlsdEluTWFpbkZpbGUoKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdlYnBhY2tDb25maWcuZW50cnlbJ21haW4nXSA9IFtnZXRCdWlsdEluTWFpbkZpbGUoKV07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHByb2plY3RNZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgICAgIGNvbnN0IHNvdXJjZVJvb3QgPSAocHJvamVjdE1ldGFkYXRhLnNvdXJjZVJvb3QgPz8gcHJvamVjdE1ldGFkYXRhLnJvb3QgPz8gJycpIGFzIHN0cmluZztcblxuICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zID8/PSBbXTtcbiAgICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy5wdXNoKFxuICAgICAgICBuZXcgRmluZFRlc3RzUGx1Z2luKHtcbiAgICAgICAgICBpbmNsdWRlOiBvcHRpb25zLmluY2x1ZGUsXG4gICAgICAgICAgZXhjbHVkZTogb3B0aW9ucy5leGNsdWRlLFxuICAgICAgICAgIHdvcmtzcGFjZVJvb3Q6IGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICBwcm9qZWN0U291cmNlUm9vdDogcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgc291cmNlUm9vdCksXG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgICAga2FybWFPcHRpb25zLmJ1aWxkV2VicGFjayA9IHtcbiAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgd2VicGFja0NvbmZpZyxcbiAgICAgICAgbG9nZ2VyOiBjb250ZXh0LmxvZ2dlcixcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHBhcnNlZEthcm1hQ29uZmlnID0gYXdhaXQga2FybWEuY29uZmlnLnBhcnNlQ29uZmlnKFxuICAgICAgICBvcHRpb25zLmthcm1hQ29uZmlnICYmIHBhdGgucmVzb2x2ZShjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9wdGlvbnMua2FybWFDb25maWcpLFxuICAgICAgICB0cmFuc2Zvcm1zLmthcm1hT3B0aW9ucyA/IHRyYW5zZm9ybXMua2FybWFPcHRpb25zKGthcm1hT3B0aW9ucykgOiBrYXJtYU9wdGlvbnMsXG4gICAgICAgIHsgcHJvbWlzZUNvbmZpZzogdHJ1ZSwgdGhyb3dFcnJvcnM6IHRydWUgfSxcbiAgICAgICk7XG5cbiAgICAgIHJldHVybiBba2FybWEsIHBhcnNlZEthcm1hQ29uZmlnXSBhcyBbdHlwZW9mIGthcm1hLCBLYXJtYUNvbmZpZ09wdGlvbnNdO1xuICAgIH0pLFxuICAgIHN3aXRjaE1hcChcbiAgICAgIChba2FybWEsIGthcm1hQ29uZmlnXSkgPT5cbiAgICAgICAgbmV3IE9ic2VydmFibGU8QnVpbGRlck91dHB1dD4oKHN1YnNjcmliZXIpID0+IHtcbiAgICAgICAgICAvLyBQYXNzIG9udG8gS2FybWEgdG8gZW1pdCBCdWlsZEV2ZW50cy5cbiAgICAgICAgICBrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgPz89IHt9O1xuICAgICAgICAgIGlmICh0eXBlb2Yga2FybWFDb25maWcuYnVpbGRXZWJwYWNrID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICAgIChrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgYXMgYW55KS5mYWlsdXJlQ2IgPz89ICgpID0+XG4gICAgICAgICAgICAgIHN1YnNjcmliZXIubmV4dCh7IHN1Y2Nlc3M6IGZhbHNlIH0pO1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICAgIChrYXJtYUNvbmZpZy5idWlsZFdlYnBhY2sgYXMgYW55KS5zdWNjZXNzQ2IgPz89ICgpID0+XG4gICAgICAgICAgICAgIHN1YnNjcmliZXIubmV4dCh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQ29tcGxldGUgdGhlIG9ic2VydmFibGUgb25jZSB0aGUgS2FybWEgc2VydmVyIHJldHVybnMuXG4gICAgICAgICAgY29uc3Qga2FybWFTZXJ2ZXIgPSBuZXcga2FybWEuU2VydmVyKGthcm1hQ29uZmlnIGFzIENvbmZpZywgKGV4aXRDb2RlKSA9PiB7XG4gICAgICAgICAgICBzdWJzY3JpYmVyLm5leHQoeyBzdWNjZXNzOiBleGl0Q29kZSA9PT0gMCB9KTtcbiAgICAgICAgICAgIHN1YnNjcmliZXIuY29tcGxldGUoKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGNvbnN0IGthcm1hU3RhcnQgPSBrYXJtYVNlcnZlci5zdGFydCgpO1xuXG4gICAgICAgICAgLy8gQ2xlYW51cCwgc2lnbmFsIEthcm1hIHRvIGV4aXQuXG4gICAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICAgIHZvaWQga2FybWFTdGFydC50aGVuKCgpID0+IGthcm1hU2VydmVyLnN0b3AoKSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSksXG4gICAgKSxcbiAgICBkZWZhdWx0SWZFbXB0eSh7IHN1Y2Nlc3M6IGZhbHNlIH0pLFxuICApO1xufVxuXG5mdW5jdGlvbiBnZXRCdWlsdEluS2FybWFDb25maWcoXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgcHJvamVjdE5hbWU6IHN0cmluZyxcbik6IENvbmZpZ09wdGlvbnMgJiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGxldCBjb3ZlcmFnZUZvbGRlck5hbWUgPSBwcm9qZWN0TmFtZS5jaGFyQXQoMCkgPT09ICdAJyA/IHByb2plY3ROYW1lLnNsaWNlKDEpIDogcHJvamVjdE5hbWU7XG4gIGlmICgvW0EtWl0vLnRlc3QoY292ZXJhZ2VGb2xkZXJOYW1lKSkge1xuICAgIGNvdmVyYWdlRm9sZGVyTmFtZSA9IHN0cmluZ3MuZGFzaGVyaXplKGNvdmVyYWdlRm9sZGVyTmFtZSk7XG4gIH1cblxuICBjb25zdCB3b3Jrc3BhY2VSb290UmVxdWlyZSA9IGNyZWF0ZVJlcXVpcmUod29ya3NwYWNlUm9vdCArICcvJyk7XG5cbiAgLy8gQW55IGNoYW5nZXMgdG8gdGhlIGNvbmZpZyBoZXJlIG5lZWQgdG8gYmUgc3luY2VkIHRvOiBwYWNrYWdlcy9zY2hlbWF0aWNzL2FuZ3VsYXIvY29uZmlnL2ZpbGVzL2thcm1hLmNvbmYuanMudGVtcGxhdGVcbiAgcmV0dXJuIHtcbiAgICBiYXNlUGF0aDogJycsXG4gICAgZnJhbWV3b3JrczogWydqYXNtaW5lJywgJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyJ10sXG4gICAgcGx1Z2luczogW1xuICAgICAgJ2thcm1hLWphc21pbmUnLFxuICAgICAgJ2thcm1hLWNocm9tZS1sYXVuY2hlcicsXG4gICAgICAna2FybWEtamFzbWluZS1odG1sLXJlcG9ydGVyJyxcbiAgICAgICdrYXJtYS1jb3ZlcmFnZScsXG4gICAgICAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXIvcGx1Z2lucy9rYXJtYScsXG4gICAgXS5tYXAoKHApID0+IHdvcmtzcGFjZVJvb3RSZXF1aXJlKHApKSxcbiAgICBjbGllbnQ6IHtcbiAgICAgIGNsZWFyQ29udGV4dDogZmFsc2UsIC8vIGxlYXZlIEphc21pbmUgU3BlYyBSdW5uZXIgb3V0cHV0IHZpc2libGUgaW4gYnJvd3NlclxuICAgIH0sXG4gICAgamFzbWluZUh0bWxSZXBvcnRlcjoge1xuICAgICAgc3VwcHJlc3NBbGw6IHRydWUsIC8vIHJlbW92ZXMgdGhlIGR1cGxpY2F0ZWQgdHJhY2VzXG4gICAgfSxcbiAgICBjb3ZlcmFnZVJlcG9ydGVyOiB7XG4gICAgICBkaXI6IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCAnY292ZXJhZ2UnLCBjb3ZlcmFnZUZvbGRlck5hbWUpLFxuICAgICAgc3ViZGlyOiAnLicsXG4gICAgICByZXBvcnRlcnM6IFt7IHR5cGU6ICdodG1sJyB9LCB7IHR5cGU6ICd0ZXh0LXN1bW1hcnknIH1dLFxuICAgIH0sXG4gICAgcmVwb3J0ZXJzOiBbJ3Byb2dyZXNzJywgJ2tqaHRtbCddLFxuICAgIGJyb3dzZXJzOiBbJ0Nocm9tZSddLFxuICAgIGN1c3RvbUxhdW5jaGVyczoge1xuICAgICAgLy8gQ2hyb21lIGNvbmZpZ3VyZWQgdG8gcnVuIGluIGEgYmF6ZWwgc2FuZGJveC5cbiAgICAgIC8vIERpc2FibGUgdGhlIHVzZSBvZiB0aGUgZ3B1IGFuZCBgL2Rldi9zaG1gIGJlY2F1c2UgaXQgY2F1c2VzIENocm9tZSB0b1xuICAgICAgLy8gY3Jhc2ggb24gc29tZSBlbnZpcm9ubWVudHMuXG4gICAgICAvLyBTZWU6XG4gICAgICAvLyAgIGh0dHBzOi8vZ2l0aHViLmNvbS9wdXBwZXRlZXIvcHVwcGV0ZWVyL2Jsb2IvdjEuMC4wL2RvY3MvdHJvdWJsZXNob290aW5nLm1kI3RpcHNcbiAgICAgIC8vICAgaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNTA2NDIzMDgvd2ViZHJpdmVyZXhjZXB0aW9uLXVua25vd24tZXJyb3ItZGV2dG9vbHNhY3RpdmVwb3J0LWZpbGUtZG9lc250LWV4aXN0LXdoaWxlLXRcbiAgICAgIENocm9tZUhlYWRsZXNzTm9TYW5kYm94OiB7XG4gICAgICAgIGJhc2U6ICdDaHJvbWVIZWFkbGVzcycsXG4gICAgICAgIGZsYWdzOiBbJy0tbm8tc2FuZGJveCcsICctLWhlYWRsZXNzJywgJy0tZGlzYWJsZS1ncHUnLCAnLS1kaXNhYmxlLWRldi1zaG0tdXNhZ2UnXSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICByZXN0YXJ0T25GaWxlQ2hhbmdlOiB0cnVlLFxuICB9O1xufVxuXG5leHBvcnQgeyBLYXJtYUJ1aWxkZXJPcHRpb25zIH07XG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyPFJlY29yZDxzdHJpbmcsIHN0cmluZz4gJiBLYXJtYUJ1aWxkZXJPcHRpb25zPihleGVjdXRlKTtcblxuZnVuY3Rpb24gZ2V0QnVpbHRJbk1haW5GaWxlKCk6IHN0cmluZyB7XG4gIGNvbnN0IGNvbnRlbnQgPSBCdWZmZXIuZnJvbShcbiAgICBgXG4gIGltcG9ydCB7IGdldFRlc3RCZWQgfSBmcm9tICdAYW5ndWxhci9jb3JlL3Rlc3RpbmcnO1xuICBpbXBvcnQge1xuICAgIEJyb3dzZXJEeW5hbWljVGVzdGluZ01vZHVsZSxcbiAgICBwbGF0Zm9ybUJyb3dzZXJEeW5hbWljVGVzdGluZyxcbiAgIH0gZnJvbSAnQGFuZ3VsYXIvcGxhdGZvcm0tYnJvd3Nlci1keW5hbWljL3Rlc3RpbmcnO1xuXG4gIC8vIEluaXRpYWxpemUgdGhlIEFuZ3VsYXIgdGVzdGluZyBlbnZpcm9ubWVudC5cbiAgZ2V0VGVzdEJlZCgpLmluaXRUZXN0RW52aXJvbm1lbnQoQnJvd3NlckR5bmFtaWNUZXN0aW5nTW9kdWxlLCBwbGF0Zm9ybUJyb3dzZXJEeW5hbWljVGVzdGluZygpLCB7XG4gICAgZXJyb3JPblVua25vd25FbGVtZW50czogdHJ1ZSxcbiAgICBlcnJvck9uVW5rbm93blByb3BlcnRpZXM6IHRydWVcbiAgfSk7XG5gLFxuICApLnRvU3RyaW5nKCdiYXNlNjQnKTtcblxuICByZXR1cm4gYG5nLXZpcnR1YWwtbWFpbi5qcyE9IWRhdGE6dGV4dC9qYXZhc2NyaXB0O2Jhc2U2NCwke2NvbnRlbnR9YDtcbn1cbiJdfQ==