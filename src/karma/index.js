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
const node_1 = require("@angular-devkit/core/node");
const path_1 = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const webpack_configs_1 = require("../angular-cli-files/models/webpack-configs");
const webpack_browser_config_1 = require("../utils/webpack-browser-config");
async function initialize(options, context) {
    const host = new node_1.NodeJsSyncHost();
    const { config } = await webpack_browser_config_1.generateBrowserWebpackConfigFromContext(Object.assign({}, options, { outputPath: '' }), context, wco => [
        webpack_configs_1.getCommonConfig(wco),
        webpack_configs_1.getStylesConfig(wco),
        webpack_configs_1.getNonAotConfig(wco),
        webpack_configs_1.getTestConfig(wco),
    ], host);
    // tslint:disable-next-line:no-implicit-dependencies
    const karma = await Promise.resolve().then(() => require('karma'));
    return [karma, config];
}
function runKarma(options, context) {
    const root = context.workspaceRoot;
    return rxjs_1.from(initialize(options, context)).pipe(operators_1.switchMap(([karma, webpackConfig]) => new rxjs_1.Observable(subscriber => {
        const karmaOptions = {};
        if (options.watch !== undefined) {
            karmaOptions.singleRun = !options.watch;
        }
        // Convert browsers from a string to an array
        if (options.browsers) {
            karmaOptions.browsers = options.browsers.split(',');
        }
        if (options.reporters) {
            // Split along commas to make it more natural, and remove empty strings.
            const reporters = options.reporters
                .reduce((acc, curr) => acc.concat(curr.split(/,/)), [])
                .filter(x => !!x);
            if (reporters.length > 0) {
                karmaOptions.reporters = reporters;
            }
        }
        // Assign additional karmaConfig options to the local ngapp config
        karmaOptions.configFile = path_1.resolve(root, options.karmaConfig);
        karmaOptions.buildWebpack = {
            options,
            webpackConfig,
            // Pass onto Karma to emit BuildEvents.
            successCb: () => subscriber.next({ success: true }),
            failureCb: () => subscriber.next({ success: false }),
            // Workaround for https://github.com/karma-runner/karma/issues/3154
            // When this workaround is removed, user projects need to be updated to use a Karma
            // version that has a fix for this issue.
            toJSON: () => { },
            logger: context.logger,
        };
        // Complete the observable once the Karma server returns.
        const karmaServer = new karma.Server(karmaOptions, () => subscriber.complete());
        // karma typings incorrectly define start's return value as void
        // tslint:disable-next-line:no-use-of-empty-return-value
        const karmaStart = karmaServer.start();
        // Cleanup, signal Karma to exit.
        return () => {
            // Karma only has the `stop` method start with 3.1.1, so we must defensively check.
            const karmaServerWithStop = karmaServer;
            if (typeof karmaServerWithStop.stop === 'function') {
                return karmaStart.then(() => karmaServerWithStop.stop());
            }
        };
    })));
}
exports.runKarma = runKarma;
exports.default = architect_1.createBuilder(runKarma);
