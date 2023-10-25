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
exports.log = exports.execute = void 0;
const architect_1 = require("@angular-devkit/architect");
const core_1 = require("@angular-devkit/core");
const path_1 = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const url = __importStar(require("url"));
const error_1 = require("../../utils/error");
const utils_1 = require("./utils");
/** Log messages to ignore and not rely to the logger */
const IGNORED_STDOUT_MESSAGES = [
    'server listening on',
    'Angular is running in development mode. Call enableProdMode() to enable production mode.',
];
function execute(options, context) {
    const browserTarget = (0, architect_1.targetFromTargetString)(options.browserTarget);
    const serverTarget = (0, architect_1.targetFromTargetString)(options.serverTarget);
    const getBaseUrl = (bs) => `${bs.getOption('scheme')}://${bs.getOption('host')}:${bs.getOption('port')}`;
    const browserTargetRun = context.scheduleTarget(browserTarget, {
        watch: options.watch,
        progress: options.progress,
        verbose: options.verbose,
        // Disable bundle budgets are these are not meant to be used with a dev-server as this will add extra JavaScript for live-reloading.
        budgets: [],
    });
    const serverTargetRun = context.scheduleTarget(serverTarget, {
        watch: options.watch,
        progress: options.progress,
        verbose: options.verbose,
    });
    const bsInstance = require('browser-sync').create();
    context.logger.error(core_1.tags.stripIndents `
  ****************************************************************************************
  This is a simple server for use in testing or debugging Angular applications locally.
  It hasn't been reviewed for security issues.

  DON'T USE IT FOR PRODUCTION!
  ****************************************************************************************
 `);
    return (0, rxjs_1.zip)(browserTargetRun, serverTargetRun, (0, utils_1.getAvailablePort)()).pipe((0, operators_1.switchMap)(([br, sr, nodeServerPort]) => {
        return (0, rxjs_1.combineLatest)([br.output, sr.output]).pipe(
        // This is needed so that if both server and browser emit close to each other
        // we only emit once. This typically happens on the first build.
        (0, operators_1.debounceTime)(120), (0, operators_1.switchMap)(([b, s]) => {
            if (!s.success || !b.success) {
                return (0, rxjs_1.of)([b, s]);
            }
            return startNodeServer(s, nodeServerPort, context.logger, !!options.inspect).pipe((0, operators_1.mapTo)([b, s]), (0, operators_1.catchError)((err) => {
                context.logger.error(`A server error has occurred.\n${mapErrorToMessage(err)}`);
                return rxjs_1.EMPTY;
            }));
        }), (0, operators_1.map)(([b, s]) => [
            {
                success: b.success && s.success,
                error: b.error || s.error,
            },
            nodeServerPort,
        ]), (0, operators_1.tap)(([builderOutput]) => {
            if (builderOutput.success) {
                context.logger.info('\nCompiled successfully.');
            }
        }), (0, operators_1.debounce)(([builderOutput]) => builderOutput.success && !options.inspect
            ? (0, utils_1.waitUntilServerIsListening)(nodeServerPort)
            : rxjs_1.EMPTY), (0, operators_1.finalize)(() => {
            void br.stop();
            void sr.stop();
        }));
    }), (0, operators_1.concatMap)(([builderOutput, nodeServerPort]) => {
        if (!builderOutput.success) {
            return (0, rxjs_1.of)(builderOutput);
        }
        if (bsInstance.active) {
            bsInstance.reload();
            return (0, rxjs_1.of)(builderOutput);
        }
        else {
            return (0, rxjs_1.from)(initBrowserSync(bsInstance, nodeServerPort, options, context)).pipe((0, operators_1.tap)((bs) => {
                const baseUrl = getBaseUrl(bs);
                context.logger.info(core_1.tags.oneLine `
                **
                Angular Universal Live Development Server is listening on ${baseUrl},
                open your browser on ${baseUrl}
                **
              `);
            }), (0, operators_1.mapTo)(builderOutput));
        }
    }), (0, operators_1.map)((builderOutput) => ({
        success: builderOutput.success,
        error: builderOutput.error,
        baseUrl: getBaseUrl(bsInstance),
        port: bsInstance.getOption('port'),
    })), (0, operators_1.finalize)(() => {
        if (bsInstance) {
            bsInstance.exit();
            bsInstance.cleanup();
        }
    }), (0, operators_1.catchError)((error) => (0, rxjs_1.of)({
        success: false,
        error: mapErrorToMessage(error),
    })));
}
exports.execute = execute;
// Logs output to the terminal.
// Removes any trailing new lines from the output.
function log({ stderr, stdout }, logger) {
    if (stderr) {
        // Strip the webpack scheme (webpack://) from error log.
        logger.error(stderr.replace(/\n?$/, '').replace(/webpack:\/\//g, '.'));
    }
    if (stdout && !IGNORED_STDOUT_MESSAGES.some((x) => stdout.includes(x))) {
        logger.info(stdout.replace(/\n?$/, ''));
    }
}
exports.log = log;
function startNodeServer(serverOutput, port, logger, inspectMode = false) {
    const outputPath = serverOutput.outputPath;
    const path = (0, path_1.join)(outputPath, 'main.js');
    const env = { ...process.env, PORT: '' + port };
    const args = ['--enable-source-maps', `"${path}"`];
    if (inspectMode) {
        args.unshift('--inspect-brk');
    }
    return (0, rxjs_1.of)(null).pipe((0, operators_1.delay)(0), // Avoid EADDRINUSE error since it will cause the kill event to be finish.
    (0, operators_1.switchMap)(() => (0, utils_1.spawnAsObservable)('node', args, { env, shell: true })), (0, operators_1.tap)((res) => log({ stderr: res.stderr, stdout: res.stdout }, logger)), (0, operators_1.ignoreElements)(), 
    // Emit a signal after the process has been started
    (0, operators_1.startWith)(undefined));
}
async function initBrowserSync(browserSyncInstance, nodeServerPort, options, context) {
    if (browserSyncInstance.active) {
        return browserSyncInstance;
    }
    const { port: browserSyncPort, open, host, publicHost, proxyConfig } = options;
    const bsPort = browserSyncPort || (await (0, utils_1.getAvailablePort)());
    const bsOptions = {
        proxy: {
            target: `localhost:${nodeServerPort}`,
            proxyOptions: {
                xfwd: true,
            },
            proxyRes: [
                (proxyRes) => {
                    if ('headers' in proxyRes) {
                        proxyRes.headers['cache-control'] = undefined;
                    }
                },
            ],
            // proxyOptions is not in the typings
        },
        host,
        port: bsPort,
        ui: false,
        server: false,
        notify: false,
        ghostMode: false,
        logLevel: options.verbose ? 'debug' : 'silent',
        open,
        https: getSslConfig(context.workspaceRoot, options),
    };
    const publicHostNormalized = publicHost && publicHost.endsWith('/')
        ? publicHost.substring(0, publicHost.length - 1)
        : publicHost;
    if (publicHostNormalized) {
        const { protocol, hostname, port, pathname } = url.parse(publicHostNormalized);
        const defaultSocketIoPath = '/browser-sync/socket.io';
        const defaultNamespace = '/browser-sync';
        const hasPathname = !!(pathname && pathname !== '/');
        const namespace = hasPathname ? pathname + defaultNamespace : defaultNamespace;
        const path = hasPathname ? pathname + defaultSocketIoPath : defaultSocketIoPath;
        bsOptions.socket = {
            namespace,
            path,
            domain: url.format({
                protocol,
                hostname,
                port,
            }),
        };
        // When having a pathname we also need to create a reverse proxy because socket.io
        // will be listening on: 'http://localhost:4200/ssr/browser-sync/socket.io'
        // However users will typically have a reverse proxy that will redirect all matching requests
        // ex: http://testinghost.com/ssr -> http://localhost:4200 which will result in a 404.
        if (hasPathname) {
            const { createProxyMiddleware } = await Promise.resolve().then(() => __importStar(require('http-proxy-middleware')));
            // Remove leading slash
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            (bsOptions.scriptPath = (p) => p.substring(1)),
                (bsOptions.middleware = [
                    createProxyMiddleware(defaultSocketIoPath, {
                        target: url.format({
                            protocol: 'http',
                            hostname: host,
                            port: bsPort,
                            pathname: path,
                        }),
                        ws: true,
                        logLevel: 'silent',
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    }),
                ]);
        }
    }
    if (proxyConfig) {
        if (!bsOptions.middleware) {
            bsOptions.middleware = [];
        }
        else if (!Array.isArray(bsOptions.middleware)) {
            bsOptions.middleware = [bsOptions.middleware];
        }
        bsOptions.middleware = [
            ...bsOptions.middleware,
            ...(await getProxyConfig(context.workspaceRoot, proxyConfig)),
        ];
    }
    return new Promise((resolve, reject) => {
        browserSyncInstance.init(bsOptions, (error, bs) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(bs);
            }
        });
    });
}
function mapErrorToMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return '';
}
function getSslConfig(root, options) {
    const { ssl, sslCert, sslKey } = options;
    if (ssl && sslCert && sslKey) {
        return {
            key: (0, path_1.resolve)(root, sslKey),
            cert: (0, path_1.resolve)(root, sslCert),
        };
    }
    return ssl;
}
async function getProxyConfig(root, proxyConfig) {
    const proxyPath = (0, path_1.resolve)(root, proxyConfig);
    let proxySettings;
    try {
        proxySettings = require(proxyPath);
    }
    catch (error) {
        (0, error_1.assertIsError)(error);
        if (error.code === 'MODULE_NOT_FOUND') {
            throw new Error(`Proxy config file ${proxyPath} does not exist.`);
        }
        throw error;
    }
    const proxies = Array.isArray(proxySettings) ? proxySettings : [proxySettings];
    const createdProxies = [];
    const { createProxyMiddleware } = await Promise.resolve().then(() => __importStar(require('http-proxy-middleware')));
    for (const proxy of proxies) {
        for (const [key, context] of Object.entries(proxy)) {
            if (typeof key === 'string') {
                createdProxies.push(createProxyMiddleware(key.replace(/^\*$/, '**').replace(/\/\*$/, ''), 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                context));
            }
            else {
                createdProxies.push(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                createProxyMiddleware(key, context));
            }
        }
    }
    return createdProxies;
}
exports.default = (0, architect_1.createBuilder)(execute);
