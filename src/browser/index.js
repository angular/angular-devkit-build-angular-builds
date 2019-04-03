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
const webpack_1 = require("@angular-devkit/build-webpack/src/webpack");
const core_1 = require("@angular-devkit/core");
const node_1 = require("@angular-devkit/core/node");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const analytics_1 = require("../../plugins/webpack/analytics");
const webpack_configs_1 = require("../angular-cli-files/models/webpack-configs");
const read_tsconfig_1 = require("../angular-cli-files/utilities/read-tsconfig");
const require_project_module_1 = require("../angular-cli-files/utilities/require-project-module");
const service_worker_1 = require("../angular-cli-files/utilities/service-worker");
const stats_1 = require("../angular-cli-files/utilities/stats");
const utils_1 = require("../utils");
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const webpackMerge = require('webpack-merge');
function createBrowserLoggingCallback(verbose, logger) {
    return (stats, config) => {
        // config.stats contains our own stats settings, added during buildWebpackConfig().
        const json = stats.toJson(config.stats);
        if (verbose) {
            logger.info(stats.toString(config.stats));
        }
        else {
            logger.info(stats_1.statsToString(json, config.stats));
        }
        if (stats.hasWarnings()) {
            logger.warn(stats_1.statsWarningsToString(json, config.stats));
        }
        if (stats.hasErrors()) {
            logger.error(stats_1.statsErrorsToString(json, config.stats));
        }
    };
}
exports.createBrowserLoggingCallback = createBrowserLoggingCallback;
function buildWebpackConfig(root, projectRoot, options, additionalOptions = {}) {
    // Ensure Build Optimizer is only used with AOT.
    if (options.buildOptimizer && !options.aot) {
        throw new Error(`The 'buildOptimizer' option cannot be used without 'aot'.`);
    }
    let wco;
    const tsConfigPath = core_1.getSystemPath(core_1.normalize(core_1.resolve(root, core_1.normalize(options.tsConfig))));
    const tsConfig = read_tsconfig_1.readTsconfig(tsConfigPath);
    const projectTs = require_project_module_1.requireProjectModule(core_1.getSystemPath(projectRoot), 'typescript');
    const supportES2015 = tsConfig.options.target !== projectTs.ScriptTarget.ES3
        && tsConfig.options.target !== projectTs.ScriptTarget.ES5;
    const logger = additionalOptions.logger
        ? additionalOptions.logger.createChild('webpackConfigOptions')
        : new core_1.logging.NullLogger();
    wco = {
        root: core_1.getSystemPath(root),
        logger,
        projectRoot: core_1.getSystemPath(projectRoot),
        buildOptions: options,
        tsConfig,
        tsConfigPath,
        supportES2015,
    };
    wco.buildOptions.progress = utils_1.defaultProgress(wco.buildOptions.progress);
    const webpackConfigs = [
        webpack_configs_1.getCommonConfig(wco),
        webpack_configs_1.getBrowserConfig(wco),
        webpack_configs_1.getStylesConfig(wco),
        webpack_configs_1.getStatsConfig(wco),
    ];
    if (additionalOptions.analytics) {
        // If there's analytics, add our plugin. Otherwise no need to slow down the build.
        let category = 'build';
        if (additionalOptions.builderInfo) {
            // We already vetted that this is a "safe" package, otherwise the analytics would be noop.
            category = additionalOptions.builderInfo.builderName.split(':')[1];
        }
        // The category is the builder name if it's an angular builder.
        webpackConfigs.push({
            plugins: [
                new analytics_1.NgBuildAnalyticsPlugin(wco.projectRoot, additionalOptions.analytics, category),
            ],
        });
    }
    if (wco.buildOptions.main || wco.buildOptions.polyfills) {
        const typescriptConfigPartial = wco.buildOptions.aot
            ? webpack_configs_1.getAotConfig(wco)
            : webpack_configs_1.getNonAotConfig(wco);
        webpackConfigs.push(typescriptConfigPartial);
    }
    if (wco.buildOptions.webWorkerTsConfig) {
        webpackConfigs.push(webpack_configs_1.getWorkerConfig(wco));
    }
    const webpackConfig = webpackMerge(webpackConfigs);
    if (options.profile || process.env['NG_BUILD_PROFILING']) {
        const smp = new SpeedMeasurePlugin({
            outputFormat: 'json',
            outputTarget: core_1.getSystemPath(core_1.join(root, 'speed-measure-plugin.json')),
        });
        return smp.wrap(webpackConfig);
    }
    return webpackConfig;
}
exports.buildWebpackConfig = buildWebpackConfig;
async function buildBrowserWebpackConfigFromWorkspace(options, projectName, workspace, host, additionalOptions = {}) {
    // TODO: Use a better interface for workspace access.
    const projectRoot = core_1.resolve(workspace.root, core_1.normalize(workspace.getProject(projectName).root));
    const sourceRoot = workspace.getProject(projectName).sourceRoot;
    const normalizedOptions = utils_1.normalizeBrowserSchema(host, workspace.root, projectRoot, sourceRoot ? core_1.resolve(workspace.root, core_1.normalize(sourceRoot)) : undefined, options);
    return buildWebpackConfig(workspace.root, projectRoot, normalizedOptions, additionalOptions);
}
exports.buildBrowserWebpackConfigFromWorkspace = buildBrowserWebpackConfigFromWorkspace;
async function buildBrowserWebpackConfigFromContext(options, context, host) {
    const registry = new core_1.schema.CoreSchemaRegistry();
    registry.addPostTransform(core_1.schema.transforms.addUndefinedDefaults);
    const workspace = await core_1.experimental.workspace.Workspace.fromPath(host, core_1.normalize(context.workspaceRoot), registry);
    const projectName = context.target ? context.target.project : workspace.getDefaultProjectName();
    if (!projectName) {
        throw new Error('Must either have a target from the context or a default project.');
    }
    const config = await buildBrowserWebpackConfigFromWorkspace(options, projectName, workspace, host, {
        logger: context.logger,
        analytics: context.analytics,
        builderInfo: context.builder,
    });
    return { workspace, config };
}
exports.buildBrowserWebpackConfigFromContext = buildBrowserWebpackConfigFromContext;
function buildWebpackBrowser(options, context, transforms = {}) {
    const host = new node_1.NodeJsSyncHost();
    const root = core_1.normalize(context.workspaceRoot);
    const configFn = transforms.config;
    const outputFn = transforms.output;
    const loggingFn = transforms.logging
        || createBrowserLoggingCallback(!!options.verbose, context.logger);
    // This makes a host observable into a cold one. This is because we want to wait until
    // subscription before calling buildBrowserWebpackConfigFromContext, which can throw.
    return rxjs_1.of(null).pipe(operators_1.switchMap(() => rxjs_1.from(buildBrowserWebpackConfigFromContext(options, context, host))), operators_1.switchMap(({ workspace, config }) => {
        if (configFn) {
            return configFn(workspace, config).pipe(operators_1.map(config => ({ workspace, config })));
        }
        else {
            return rxjs_1.of({ workspace, config });
        }
    }), operators_1.switchMap(({ workspace, config }) => {
        if (options.deleteOutputPath) {
            return utils_1.deleteOutputDir(core_1.normalize(context.workspaceRoot), core_1.normalize(options.outputPath), host).pipe(operators_1.map(() => ({ workspace, config })));
        }
        else {
            return rxjs_1.of({ workspace, config });
        }
    }), operators_1.switchMap(({ workspace, config }) => {
        const projectName = context.target
            ? context.target.project : workspace.getDefaultProjectName();
        if (!projectName) {
            throw new Error('Must either have a target from the context or a default project.');
        }
        const projectRoot = core_1.resolve(workspace.root, core_1.normalize(workspace.getProject(projectName).root));
        return webpack_1.runWebpack(config, context, { logging: loggingFn }).pipe(operators_1.concatMap(buildEvent => {
            if (buildEvent.success && !options.watch && options.serviceWorker) {
                return rxjs_1.from(service_worker_1.augmentAppWithServiceWorker(host, root, projectRoot, core_1.resolve(root, core_1.normalize(options.outputPath)), options.baseHref || '/', options.ngswConfigPath).then(() => ({ success: true }), () => ({ success: false })));
            }
            else {
                return rxjs_1.of(buildEvent);
            }
        }), operators_1.map(event => (Object.assign({}, event, { outputPath: config.output && config.output.path || '' }))), operators_1.concatMap(output => outputFn ? outputFn(output) : rxjs_1.of(output)));
    }));
}
exports.buildWebpackBrowser = buildWebpackBrowser;
exports.default = index2_1.createBuilder(buildWebpackBrowser);
