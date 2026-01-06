"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = execute;
const private_1 = require("@angular/build/private");
const path = __importStar(require("node:path"));
const webpack_1 = __importDefault(require("webpack"));
const configs_1 = require("../../tools/webpack/configs");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const schema_1 = require("../browser/schema");
const find_tests_plugin_1 = require("./find-tests-plugin");
function execute(options, context, karmaOptions, transforms = {}) {
    let karmaServer;
    let isCancelled = false;
    return new ReadableStream({
        async start(controller) {
            const [karma, webpackConfig] = await initializeBrowser(options, context, transforms.webpackConfiguration);
            if (isCancelled) {
                return;
            }
            const projectName = context.target?.project;
            if (!projectName) {
                throw new Error(`The 'karma' builder requires a target to be specified.`);
            }
            const projectMetadata = await context.getProjectMetadata(projectName);
            const sourceRoot = (projectMetadata.sourceRoot ?? projectMetadata.root ?? '');
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
            webpackConfig.plugins ??= [];
            webpackConfig.plugins.push(new find_tests_plugin_1.FindTestsPlugin({
                include: options.include,
                exclude: options.exclude,
                workspaceRoot: context.workspaceRoot,
                projectSourceRoot: path.join(context.workspaceRoot, sourceRoot),
            }));
            const KARMA_APPLICATION_PATH = '_karma_webpack_';
            webpackConfig.output ??= {};
            webpackConfig.output.path = `/${KARMA_APPLICATION_PATH}/`;
            webpackConfig.output.publicPath = `/${KARMA_APPLICATION_PATH}/`;
            if (karmaOptions.singleRun) {
                webpackConfig.plugins.unshift({
                    apply: (compiler) => {
                        compiler.hooks.afterEnvironment.tap('karma', () => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            compiler.watchFileSystem = { watch: () => { } };
                        });
                    },
                });
            }
            // Remove the watch option to avoid the [DEP_WEBPACK_WATCH_WITHOUT_CALLBACK] warning.
            // The compiler is initialized in watch mode by webpack-dev-middleware.
            delete webpackConfig.watch;
            const compiler = (0, webpack_1.default)(webpackConfig);
            karmaOptions.buildWebpack = {
                options,
                compiler,
                logger: context.logger,
            };
            const parsedKarmaConfig = await karma.config.parseConfig(options.karmaConfig && path.resolve(context.workspaceRoot, options.karmaConfig), transforms.karmaOptions ? transforms.karmaOptions(karmaOptions) : karmaOptions, { promiseConfig: true, throwErrors: true });
            if (isCancelled) {
                return;
            }
            const enqueue = (value) => {
                try {
                    controller.enqueue(value);
                }
                catch {
                    // Controller is already closed
                }
            };
            const close = () => {
                try {
                    controller.close();
                }
                catch {
                    // Controller is already closed
                }
            };
            // Close the stream once the Karma server returns.
            karmaServer = new karma.Server(parsedKarmaConfig, (exitCode) => {
                enqueue({ success: exitCode === 0 });
                close();
            });
            karmaServer.on('run_complete', (_, results) => {
                enqueue({ success: results.exitCode === 0 });
            });
            await karmaServer.start();
        },
        async cancel() {
            isCancelled = true;
            await karmaServer?.stop();
        },
    });
}
async function initializeBrowser(options, context, webpackConfigurationTransformer) {
    // Purge old build disk cache.
    await (0, private_1.purgeStaleBuildCache)(context);
    const karma = await Promise.resolve().then(() => __importStar(require('karma')));
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
        aot: options.aot,
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
    return [karma, (await webpackConfigurationTransformer?.(config)) ?? config];
}
function getBuiltInMainFile() {
    const content = Buffer.from(`
  import { provideZoneChangeDetection, ɵcompileNgModuleDefs as compileNgModuleDefs } from '@angular/core';
  import { getTestBed } from '@angular/core/testing';
  import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

  const providers = [];
  if (typeof window.Zone !== 'undefined') {
    providers.push(provideZoneChangeDetection());
  }

  export class TestModule {}
  compileNgModuleDefs(TestModule, {providers});

  // Initialize the Angular testing environment.
  getTestBed().initTestEnvironment([BrowserTestingModule, TestModule], platformBrowserTesting(), {
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true
  });
`).toString('base64');
    return `ng-virtual-main.js!=!data:text/javascript;base64,${content}`;
}
//# sourceMappingURL=browser_builder.js.map