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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = execute;
const private_1 = require("@angular/build/private");
const architect_1 = require("@angular-devkit/architect");
const core_1 = require("@angular-devkit/core");
const module_1 = require("module");
const path = __importStar(require("path"));
const rxjs_1 = require("rxjs");
const schema_1 = require("./schema");
/**
 * @experimental Direct usage of this function is considered experimental.
 */
function execute(options, context, transforms = {}) {
    // Check Angular version.
    (0, private_1.assertCompatibleAngularVersion)(context.workspaceRoot);
    return (0, rxjs_1.from)(getExecuteWithBuilder(options, context)).pipe((0, rxjs_1.mergeMap)(([useEsbuild, executeWithBuilder]) => {
        const karmaOptions = getBaseKarmaOptions(options, context, useEsbuild);
        return executeWithBuilder.execute(options, context, karmaOptions, transforms);
    }));
}
function getBaseKarmaOptions(options, context, useEsbuild) {
    let singleRun;
    if (options.watch !== undefined) {
        singleRun = !options.watch;
    }
    // Determine project name from builder context target
    const projectName = context.target?.project;
    if (!projectName) {
        throw new Error(`The 'karma' builder requires a target to be specified.`);
    }
    const karmaOptions = options.karmaConfig
        ? {}
        : getBuiltInKarmaConfig(context.workspaceRoot, projectName, useEsbuild);
    karmaOptions.singleRun = singleRun;
    // Workaround https://github.com/angular/angular-cli/issues/28271, by clearing context by default
    // for single run executions. Not clearing context for multi-run (watched) builds allows the
    // Jasmine Spec Runner to be visible in the browser after test execution.
    karmaOptions.client ??= {};
    karmaOptions.client.clearContext ??= singleRun ?? false; // `singleRun` defaults to `false` per Karma docs.
    // Convert browsers from a string to an array
    if (typeof options.browsers === 'string' && options.browsers) {
        karmaOptions.browsers = options.browsers.split(',');
    }
    else if (options.browsers === false) {
        karmaOptions.browsers = [];
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
    return karmaOptions;
}
function getBuiltInKarmaConfig(workspaceRoot, projectName, useEsbuild) {
    let coverageFolderName = projectName.charAt(0) === '@' ? projectName.slice(1) : projectName;
    if (/[A-Z]/.test(coverageFolderName)) {
        coverageFolderName = core_1.strings.dasherize(coverageFolderName);
    }
    const workspaceRootRequire = (0, module_1.createRequire)(workspaceRoot + '/');
    // Any changes to the config here need to be synced to: packages/schematics/angular/config/files/karma.conf.js.template
    return {
        basePath: '',
        frameworks: ['jasmine', ...(useEsbuild ? [] : ['@angular-devkit/build-angular'])],
        plugins: [
            'karma-jasmine',
            'karma-chrome-launcher',
            'karma-jasmine-html-reporter',
            'karma-coverage',
            ...(useEsbuild ? [] : ['@angular-devkit/build-angular/plugins/karma']),
        ].map((p) => workspaceRootRequire(p)),
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
async function getExecuteWithBuilder(options, context) {
    const useEsbuild = await checkForEsbuild(options, context);
    const executeWithBuilderModule = useEsbuild
        ? Promise.resolve().then(() => __importStar(require('./application_builder'))) : Promise.resolve().then(() => __importStar(require('./browser_builder')));
    return [useEsbuild, await executeWithBuilderModule];
}
async function checkForEsbuild(options, context) {
    if (options.builderMode !== schema_1.BuilderMode.Detect) {
        return options.builderMode === schema_1.BuilderMode.Application;
    }
    // Look up the current project's build target using a development configuration.
    const buildTargetSpecifier = `::development`;
    const buildTarget = (0, architect_1.targetFromTargetString)(buildTargetSpecifier, context.target?.project, 'build');
    try {
        const developmentBuilderName = await context.getBuilderNameForTarget(buildTarget);
        return isEsbuildBased(developmentBuilderName);
    }
    catch (e) {
        if (!(e instanceof Error) || e.message !== 'Project target does not exist.') {
            throw e;
        }
        // If we can't find a development builder, we can't use 'detect'.
        throw new Error('Failed to detect the builder used by the application. Please set builderMode explicitly.');
    }
}
function isEsbuildBased(builderName) {
    if (builderName === '@angular/build:application' ||
        builderName === '@angular-devkit/build-angular:application' ||
        builderName === '@angular-devkit/build-angular:browser-esbuild') {
        return true;
    }
    return false;
}
