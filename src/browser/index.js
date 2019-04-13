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
const core_1 = require("@angular-devkit/core");
const node_1 = require("@angular-devkit/core/node");
const path = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const analytics_1 = require("../../plugins/webpack/analytics");
const webpack_configs_1 = require("../angular-cli-files/models/webpack-configs");
const service_worker_1 = require("../angular-cli-files/utilities/service-worker");
const stats_1 = require("../angular-cli-files/utilities/stats");
const utils_1 = require("../utils");
const webpack_browser_config_1 = require("../utils/webpack-browser-config");
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
async function buildBrowserWebpackConfigFromContext(options, context, host) {
    return webpack_browser_config_1.generateBrowserWebpackConfigFromContext(options, context, wco => [
        webpack_configs_1.getCommonConfig(wco),
        webpack_configs_1.getBrowserConfig(wco),
        webpack_configs_1.getStylesConfig(wco),
        webpack_configs_1.getStatsConfig(wco),
        getAnalyticsConfig(wco, context),
        getCompilerConfig(wco),
        wco.buildOptions.webWorkerTsConfig ? webpack_configs_1.getWorkerConfig(wco) : {},
    ], host);
}
exports.buildBrowserWebpackConfigFromContext = buildBrowserWebpackConfigFromContext;
function getAnalyticsConfig(wco, context) {
    if (context.analytics) {
        // If there's analytics, add our plugin. Otherwise no need to slow down the build.
        let category = 'build';
        if (context.builder) {
            // We already vetted that this is a "safe" package, otherwise the analytics would be noop.
            category = context.builder.builderName.split(':')[1];
        }
        // The category is the builder name if it's an angular builder.
        return {
            plugins: [
                new analytics_1.NgBuildAnalyticsPlugin(wco.projectRoot, context.analytics, category),
            ],
        };
    }
    return {};
}
function getCompilerConfig(wco) {
    if (wco.buildOptions.main || wco.buildOptions.polyfills) {
        return wco.buildOptions.aot ? webpack_configs_1.getAotConfig(wco) : webpack_configs_1.getNonAotConfig(wco);
    }
    return {};
}
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
            return rxjs_1.combineLatest(config.map(config => configFn(workspace, config))).pipe(operators_1.map(config => ({ workspace, config })));
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
    }), operators_1.switchMap(({ workspace, config: configs }) => {
        const projectName = context.target
            ? context.target.project : workspace.getDefaultProjectName();
        if (!projectName) {
            throw new Error('Must either have a target from the context or a default project.');
        }
        const projectRoot = core_1.resolve(workspace.root, core_1.normalize(workspace.getProject(projectName).root));
        return rxjs_1.combineLatest(configs.map(config => build_webpack_1.runWebpack(config, context, { logging: loggingFn })))
            .pipe(operators_1.switchMap(buildEvents => {
            if (buildEvents.length === 2) {
                // todo implement writing index.html for differential loading in another PR
            }
            return rxjs_1.of(buildEvents);
        }), operators_1.map(buildEvents => ({ success: buildEvents.every(r => r.success) })), operators_1.concatMap(buildEvent => {
            if (buildEvent.success && !options.watch && options.serviceWorker) {
                return rxjs_1.from(service_worker_1.augmentAppWithServiceWorker(host, root, projectRoot, core_1.resolve(root, core_1.normalize(options.outputPath)), options.baseHref || '/', options.ngswConfigPath).then(() => ({ success: true }), () => ({ success: false })));
            }
            else {
                return rxjs_1.of(buildEvent);
            }
        }), operators_1.map(event => ({
            ...event,
            // If we use differential loading, both configs have the same outputs
            outputPath: path.resolve(context.workspaceRoot, options.outputPath),
        })), operators_1.concatMap(output => outputFn ? outputFn(output) : rxjs_1.of(output)));
    }));
}
exports.buildWebpackBrowser = buildWebpackBrowser;
exports.default = architect_1.createBuilder(buildWebpackBrowser);
