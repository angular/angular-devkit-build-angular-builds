"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular-devkit/core");
const node_1 = require("@angular-devkit/core/node");
const path = require("path");
const read_tsconfig_1 = require("../angular-cli-files/utilities/read-tsconfig");
const utils_1 = require("../utils");
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const webpackMerge = require('webpack-merge');
async function generateWebpackConfig(workspaceRoot, projectRoot, sourceRoot, options, webpackPartialGenerator, logger) {
    // Ensure Build Optimizer is only used with AOT.
    if (options.buildOptimizer && !options.aot) {
        throw new Error(`The 'buildOptimizer' option cannot be used without 'aot'.`);
    }
    const tsConfigPath = path.resolve(workspaceRoot, options.tsConfig);
    const tsConfig = read_tsconfig_1.readTsconfig(tsConfigPath);
    // tslint:disable-next-line:no-implicit-dependencies
    const projectTs = await Promise.resolve().then(() => require('typescript'));
    const supportES2015 = tsConfig.options.target !== projectTs.ScriptTarget.ES3
        && tsConfig.options.target !== projectTs.ScriptTarget.ES5;
    const wco = {
        root: workspaceRoot,
        logger: logger.createChild('webpackConfigOptions'),
        projectRoot,
        sourceRoot,
        buildOptions: options,
        tsConfig,
        tsConfigPath,
        supportES2015,
    };
    wco.buildOptions.progress = utils_1.defaultProgress(wco.buildOptions.progress);
    const partials = webpackPartialGenerator(wco);
    const webpackConfig = webpackMerge(partials);
    if (options.profile || process.env['NG_BUILD_PROFILING']) {
        const smp = new SpeedMeasurePlugin({
            outputFormat: 'json',
            outputTarget: path.resolve(workspaceRoot, 'speed-measure-plugin.json'),
        });
        return smp.wrap(webpackConfig);
    }
    return webpackConfig;
}
exports.generateWebpackConfig = generateWebpackConfig;
async function generateBrowserWebpackConfigFromWorkspace(options, projectName, workspace, host, webpackPartialGenerator, logger) {
    // TODO: Use a better interface for workspace access.
    const projectRoot = core_1.resolve(workspace.root, core_1.normalize(workspace.getProject(projectName).root));
    const projectSourceRoot = workspace.getProject(projectName).sourceRoot;
    const sourceRoot = projectSourceRoot
        ? core_1.resolve(workspace.root, core_1.normalize(projectSourceRoot))
        : undefined;
    const normalizedOptions = utils_1.normalizeBrowserSchema(host, workspace.root, projectRoot, sourceRoot, options);
    return generateWebpackConfig(core_1.getSystemPath(workspace.root), core_1.getSystemPath(projectRoot), sourceRoot && core_1.getSystemPath(sourceRoot), normalizedOptions, webpackPartialGenerator, logger);
}
exports.generateBrowserWebpackConfigFromWorkspace = generateBrowserWebpackConfigFromWorkspace;
async function generateBrowserWebpackConfigFromContext(options, context, webpackPartialGenerator, host = new node_1.NodeJsSyncHost()) {
    const registry = new core_1.schema.CoreSchemaRegistry();
    registry.addPostTransform(core_1.schema.transforms.addUndefinedDefaults);
    const workspace = await core_1.experimental.workspace.Workspace.fromPath(host, core_1.normalize(context.workspaceRoot), registry);
    const projectName = context.target ? context.target.project : workspace.getDefaultProjectName();
    if (!projectName) {
        throw new Error('Must either have a target from the context or a default project.');
    }
    const config = await generateBrowserWebpackConfigFromWorkspace(options, projectName, workspace, host, webpackPartialGenerator, context.logger);
    return { workspace, config };
}
exports.generateBrowserWebpackConfigFromContext = generateBrowserWebpackConfigFromContext;
