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
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = execute;
const architect_1 = require("@angular-devkit/architect");
const core_1 = require("@angular-devkit/core");
const node_path_1 = require("node:path");
const url = __importStar(require("node:url"));
const utils_1 = require("../../utils");
const error_1 = require("../../utils/error");
function runProtractor(root, options) {
    const additionalProtractorConfig = {
        baseUrl: options.baseUrl,
        specs: options.specs && options.specs.length ? options.specs : undefined,
        suite: options.suite,
        jasmineNodeOpts: {
            grep: options.grep,
            invertGrep: options.invertGrep,
        },
    };
    // TODO: Protractor manages process.exit itself, so this target will allways quit the
    // process. To work around this we run it in a subprocess.
    // https://github.com/angular/protractor/issues/4160
    return (0, utils_1.runModuleAsObservableFork)(root, 'protractor/built/launcher', 'init', [
        (0, node_path_1.resolve)(root, options.protractorConfig),
        additionalProtractorConfig,
    ]).toPromise();
}
async function updateWebdriver() {
    // The webdriver-manager update command can only be accessed via a deep import.
    const webdriverDeepImport = 'webdriver-manager/built/lib/cmds/update';
    let path;
    try {
        const protractorPath = require.resolve('protractor');
        path = require.resolve(webdriverDeepImport, { paths: [protractorPath] });
    }
    catch (error) {
        (0, error_1.assertIsError)(error);
        if (error.code !== 'MODULE_NOT_FOUND') {
            throw error;
        }
    }
    if (!path) {
        throw new Error(core_1.tags.stripIndents `
      Cannot automatically find webdriver-manager to update.
      Update webdriver-manager manually and run 'ng e2e --no-webdriver-update' instead.
    `);
    }
    const webdriverUpdate = await Promise.resolve(`${path}`).then(s => __importStar(require(s)));
    // const webdriverUpdate = await import(path) as typeof import ('webdriver-manager/built/lib/cmds/update');
    // run `webdriver-manager update --standalone false --gecko false --quiet`
    // if you change this, update the command comment in prev line
    return webdriverUpdate.program.run({
        standalone: false,
        gecko: false,
        quiet: true,
    });
}
/**
 * @experimental Direct usage of this function is considered experimental.
 */
async function execute(options, context) {
    context.logger.warn('Protractor has reached end-of-life and is no longer supported by the Angular team. The `protractor` builder will be removed in a future Angular major version. For additional information and alternatives, please see https://blog.angular.dev/protractor-deprecation-update-august-2023-2beac7402ce0.');
    // ensure that only one of these options is used
    if (options.devServerTarget && options.baseUrl) {
        throw new Error(core_1.tags.stripIndents `
    The 'baseUrl' option cannot be used with 'devServerTarget'.
    When present, 'devServerTarget' will be used to automatically setup 'baseUrl' for Protractor.
    `);
    }
    if (options.webdriverUpdate) {
        await updateWebdriver();
    }
    let baseUrl = options.baseUrl;
    let server;
    try {
        if (options.devServerTarget) {
            const target = (0, architect_1.targetFromTargetString)(options.devServerTarget);
            const serverOptions = await context.getTargetOptions(target);
            const overrides = {
                watch: false,
                liveReload: false,
            };
            if (options.host !== undefined) {
                overrides.host = options.host;
            }
            else if (typeof serverOptions.host === 'string') {
                options.host = serverOptions.host;
            }
            else {
                options.host = overrides.host = 'localhost';
            }
            if (options.port !== undefined) {
                overrides.port = options.port;
            }
            else if (typeof serverOptions.port === 'number') {
                options.port = serverOptions.port;
            }
            server = await context.scheduleTarget(target, overrides);
            const result = await server.result;
            if (!result.success) {
                return { success: false };
            }
            if (typeof serverOptions.publicHost === 'string') {
                let publicHost = serverOptions.publicHost;
                if (!/^\w+:\/\//.test(publicHost)) {
                    publicHost = `${serverOptions.ssl ? 'https' : 'http'}://${publicHost}`;
                }
                const clientUrl = url.parse(publicHost);
                baseUrl = url.format(clientUrl);
            }
            else if (typeof result.baseUrl === 'string') {
                baseUrl = result.baseUrl;
            }
            else if (typeof result.port === 'number') {
                baseUrl = url.format({
                    protocol: serverOptions.ssl ? 'https' : 'http',
                    hostname: options.host,
                    port: result.port.toString(),
                });
            }
        }
        // Like the baseUrl in protractor config file when using the API we need to add
        // a trailing slash when provide to the baseUrl.
        if (baseUrl && !baseUrl.endsWith('/')) {
            baseUrl += '/';
        }
        return await runProtractor(context.workspaceRoot, { ...options, baseUrl });
    }
    catch {
        return { success: false };
    }
    finally {
        await server?.stop();
    }
}
exports.default = (0, architect_1.createBuilder)(execute);
