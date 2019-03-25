"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const index2_1 = require("@angular-devkit/architect/src/index2");
const core_1 = require("@angular-devkit/core");
const node_1 = require("@angular-devkit/core/node");
const path = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const index2_2 = require("../../../build_webpack/src/webpack/index2");
const webpack_configs_1 = require("../angular-cli-files/models/webpack-configs");
const read_tsconfig_1 = require("../angular-cli-files/utilities/read-tsconfig");
const require_project_module_1 = require("../angular-cli-files/utilities/require-project-module");
const utils_1 = require("../utils");
const webpackMerge = require('webpack-merge');
exports.default = index2_1.createBuilder((options, context) => {
    const host = new core_1.virtualFs.AliasHost(new node_1.NodeJsSyncHost());
    const root = context.workspaceRoot;
    async function setup() {
        const registry = new core_1.schema.CoreSchemaRegistry();
        registry.addPostTransform(core_1.schema.transforms.addUndefinedDefaults);
        const workspace = await core_1.experimental.workspace.Workspace.fromPath(host, core_1.normalize(context.workspaceRoot), registry);
        const projectName = context.target ? context.target.project : workspace.getDefaultProjectName();
        if (!projectName) {
            throw new Error('Must either have a target from the context or a default project.');
        }
        const projectRoot = core_1.resolve(workspace.root, core_1.normalize(workspace.getProject(projectName).root));
        const workspaceSourceRoot = workspace.getProject(projectName).sourceRoot;
        const sourceRoot = workspaceSourceRoot !== undefined ? core_1.resolve(workspace.root, core_1.normalize(workspaceSourceRoot)) : undefined;
        const normalizedOptions = utils_1.normalizeWebpackServerSchema(host, core_1.normalize(root), projectRoot, sourceRoot, options);
        return { normalizedOptions, projectRoot };
    }
    return rxjs_1.from(setup()).pipe(operators_1.concatMap(v => {
        if (options.deleteOutputPath) {
            return utils_1.deleteOutputDir(core_1.normalize(root), core_1.normalize(options.outputPath), host).pipe(operators_1.map(() => v));
        }
        else {
            return rxjs_1.of(v);
        }
    }), operators_1.concatMap(({ normalizedOptions, projectRoot }) => {
        const webpackConfig = buildServerWebpackConfig(core_1.normalize(root), projectRoot, host, normalizedOptions, context.logger.createChild('webpack'));
        return index2_2.runWebpack(webpackConfig, context);
    }), operators_1.map(output => {
        if (output.success === false) {
            return output;
        }
        return Object.assign({}, output, { outputPath: path.resolve(root, options.outputPath) });
    }));
});
function buildServerWebpackConfig(root, projectRoot, _host, options, logger) {
    let wco;
    // TODO: make target defaults into configurations instead
    // options = this.addTargetDefaults(options);
    const tsConfigPath = core_1.getSystemPath(core_1.normalize(core_1.resolve(root, core_1.normalize(options.tsConfig))));
    const tsConfig = read_tsconfig_1.readTsconfig(tsConfigPath);
    const projectTs = require_project_module_1.requireProjectModule(core_1.getSystemPath(projectRoot), 'typescript');
    const supportES2015 = tsConfig.options.target !== projectTs.ScriptTarget.ES3
        && tsConfig.options.target !== projectTs.ScriptTarget.ES5;
    const buildOptions = Object.assign({}, options);
    wco = {
        root: core_1.getSystemPath(root),
        projectRoot: core_1.getSystemPath(projectRoot),
        // TODO: use only this.options, it contains all flags and configs items already.
        buildOptions: Object.assign({}, buildOptions, { buildOptimizer: false, aot: true, platform: 'server', scripts: [], styles: [] }),
        tsConfig,
        tsConfigPath,
        supportES2015,
        logger,
    };
    wco.buildOptions.progress = utils_1.defaultProgress(wco.buildOptions.progress);
    const webpackConfigs = [
        webpack_configs_1.getCommonConfig(wco),
        webpack_configs_1.getServerConfig(wco),
        webpack_configs_1.getStylesConfig(wco),
        webpack_configs_1.getStatsConfig(wco),
    ];
    if (wco.buildOptions.main || wco.buildOptions.polyfills) {
        const typescriptConfigPartial = wco.buildOptions.aot
            ? webpack_configs_1.getAotConfig(wco)
            : webpack_configs_1.getNonAotConfig(wco);
        webpackConfigs.push(typescriptConfigPartial);
    }
    return webpackMerge(webpackConfigs);
}
exports.buildServerWebpackConfig = buildServerWebpackConfig;
