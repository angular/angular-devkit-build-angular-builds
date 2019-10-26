"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const architect_1 = require("@angular-devkit/architect");
const build_webpack_1 = require("@angular-devkit/build-webpack");
const node_1 = require("@angular-devkit/core/node");
const path = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const typescript_1 = require("typescript");
const webpack_configs_1 = require("../angular-cli-files/models/webpack-configs");
const read_tsconfig_1 = require("../angular-cli-files/utilities/read-tsconfig");
const utils_1 = require("../utils");
const i18n_inlining_1 = require("../utils/i18n-inlining");
const output_paths_1 = require("../utils/output-paths");
const version_1 = require("../utils/version");
const webpack_browser_config_1 = require("../utils/webpack-browser-config");
function execute(options, context, transforms = {}) {
    const host = new node_1.NodeJsSyncHost();
    const root = context.workspaceRoot;
    // Check Angular version.
    version_1.assertCompatibleAngularVersion(context.workspaceRoot, context.logger);
    const tsConfig = read_tsconfig_1.readTsconfig(options.tsConfig, context.workspaceRoot);
    const target = tsConfig.options.target || typescript_1.ScriptTarget.ES5;
    const baseOutputPath = path.resolve(context.workspaceRoot, options.outputPath);
    return rxjs_1.from(initialize(options, context, host, transforms.webpackConfiguration)).pipe(operators_1.concatMap(({ config, i18n }) => {
        return build_webpack_1.runWebpack(config, context).pipe(operators_1.concatMap(async (output) => {
            const { emittedFiles = [], webpackStats } = output;
            if (!output.success || !i18n.shouldInline) {
                return output;
            }
            if (!webpackStats) {
                throw new Error('Webpack stats build result is required.');
            }
            const outputPaths = output_paths_1.ensureOutputPaths(baseOutputPath, i18n);
            const success = await i18n_inlining_1.i18nInlineEmittedFiles(context, emittedFiles, i18n, baseOutputPath, outputPaths, [], 
            // tslint:disable-next-line: no-non-null-assertion
            webpackStats.outputPath, target <= typescript_1.ScriptTarget.ES5, options.i18nMissingTranslation);
            return { output, success };
        }));
    }), operators_1.map(output => {
        if (!output.success) {
            return output;
        }
        return {
            ...output,
            outputPath: path.resolve(root, options.outputPath),
        };
    }));
}
exports.execute = execute;
exports.default = architect_1.createBuilder(execute);
async function initialize(options, context, host, webpackConfigurationTransform) {
    const originalOutputPath = options.outputPath;
    const { config, i18n } = await webpack_browser_config_1.generateI18nBrowserWebpackConfigFromContext({
        ...options,
        buildOptimizer: false,
        aot: true,
        platform: 'server',
    }, context, wco => [
        webpack_configs_1.getCommonConfig(wco),
        webpack_configs_1.getServerConfig(wco),
        webpack_configs_1.getStylesConfig(wco),
        webpack_configs_1.getStatsConfig(wco),
        webpack_configs_1.getAotConfig(wco),
    ]);
    let transformedConfig;
    if (webpackConfigurationTransform) {
        transformedConfig = await webpackConfigurationTransform(config);
    }
    if (options.deleteOutputPath) {
        utils_1.deleteOutputDir(context.workspaceRoot, originalOutputPath);
    }
    return { config: transformedConfig || config, i18n };
}
