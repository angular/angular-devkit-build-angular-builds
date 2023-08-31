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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9zc3ItZGV2LXNlcnZlci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUttQztBQUNuQywrQ0FBMkQ7QUFRM0QsK0JBQW9EO0FBQ3BELCtCQUF1RTtBQUN2RSw4Q0Fhd0I7QUFDeEIseUNBQTJCO0FBQzNCLDZDQUFrRDtBQUdsRCxtQ0FBMEY7QUFFMUYsd0RBQXdEO0FBQ3hELE1BQU0sdUJBQXVCLEdBQUc7SUFDOUIscUJBQXFCO0lBQ3JCLDBGQUEwRjtDQUMzRixDQUFDO0FBUUYsU0FBZ0IsT0FBTyxDQUNyQixPQUFtQyxFQUNuQyxPQUF1QjtJQUV2QixNQUFNLGFBQWEsR0FBRyxJQUFBLGtDQUFzQixFQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNwRSxNQUFNLFlBQVksR0FBRyxJQUFBLGtDQUFzQixFQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNsRSxNQUFNLFVBQVUsR0FBRyxDQUFDLEVBQXVCLEVBQUUsRUFBRSxDQUM3QyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7SUFDaEYsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLGFBQWEsRUFBRTtRQUM3RCxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUs7UUFDcEIsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRO1FBQzFCLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTztRQUN4QixvSUFBb0k7UUFDcEksT0FB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R0FBRyxLQUFLLFFBQVEsRUFBRTtnQkFDM0IsY0FBYyxDQUFDLElBQUksQ0FDakIscUJBQXFCLENBQ25CLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDO2dCQUM5Qyw4REFBOEQ7Z0JBQzlELE9BQWMsQ0FDTSxDQUN2QixDQUFDO2FBQ0g7aUJBQU07Z0JBQ0wsY0FBYyxDQUFDLElBQUk7Z0JBQ2pCLDhEQUE4RDtnQkFDOUQscUJBQXFCLENBQUMsR0FBRyxFQUFFLE9BQWMsQ0FBc0IsQ0FDaEUsQ0FBQzthQUNIO1NBQ0Y7S0FDRjtJQUVELE9BQU8sY0FBYyxDQUFDO0FBQ3hCLENBQUM7QUFFRCxrQkFBZSxJQUFBLHlCQUFhLEVBQTRDLE9BQU8sQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkZXJDb250ZXh0LFxuICBCdWlsZGVyT3V0cHV0LFxuICBjcmVhdGVCdWlsZGVyLFxuICB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IGpzb24sIGxvZ2dpbmcsIHRhZ3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgdHlwZSB7XG4gIEJyb3dzZXJTeW5jSW5zdGFuY2UsXG4gIE9wdGlvbnMgYXMgQnJvd3NlclN5bmNPcHRpb25zLFxuICBIdHRwc09wdGlvbnMsXG4gIE1pZGRsZXdhcmVIYW5kbGVyLFxuICBQcm94eU9wdGlvbnMsXG59IGZyb20gJ2Jyb3dzZXItc3luYyc7XG5pbXBvcnQgeyBqb2luLCByZXNvbHZlIGFzIHBhdGhSZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBFTVBUWSwgT2JzZXJ2YWJsZSwgY29tYmluZUxhdGVzdCwgZnJvbSwgb2YsIHppcCB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHtcbiAgY2F0Y2hFcnJvcixcbiAgY29uY2F0TWFwLFxuICBkZWJvdW5jZSxcbiAgZGVib3VuY2VUaW1lLFxuICBkZWxheSxcbiAgZmluYWxpemUsXG4gIGlnbm9yZUVsZW1lbnRzLFxuICBtYXAsXG4gIG1hcFRvLFxuICBzdGFydFdpdGgsXG4gIHN3aXRjaE1hcCxcbiAgdGFwLFxufSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyBTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmltcG9ydCB7IGdldEF2YWlsYWJsZVBvcnQsIHNwYXduQXNPYnNlcnZhYmxlLCB3YWl0VW50aWxTZXJ2ZXJJc0xpc3RlbmluZyB9IGZyb20gJy4vdXRpbHMnO1xuXG4vKiogTG9nIG1lc3NhZ2VzIHRvIGlnbm9yZSBhbmQgbm90IHJlbHkgdG8gdGhlIGxvZ2dlciAqL1xuY29uc3QgSUdOT1JFRF9TVERPVVRfTUVTU0FHRVMgPSBbXG4gICdzZXJ2ZXIgbGlzdGVuaW5nIG9uJyxcbiAgJ0FuZ3VsYXIgaXMgcnVubmluZyBpbiBkZXZlbG9wbWVudCBtb2RlLiBDYWxsIGVuYWJsZVByb2RNb2RlKCkgdG8gZW5hYmxlIHByb2R1Y3Rpb24gbW9kZS4nLFxuXTtcblxudHlwZSBTU1JEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyA9IFNjaGVtYSAmIGpzb24uSnNvbk9iamVjdDtcbmV4cG9ydCB0eXBlIFNTUkRldlNlcnZlckJ1aWxkZXJPdXRwdXQgPSBCdWlsZGVyT3V0cHV0ICYge1xuICBiYXNlVXJsPzogc3RyaW5nO1xuICBwb3J0Pzogc3RyaW5nO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IFNTUkRldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IE9ic2VydmFibGU8U1NSRGV2U2VydmVyQnVpbGRlck91dHB1dD4ge1xuICBjb25zdCBicm93c2VyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLmJyb3dzZXJUYXJnZXQpO1xuICBjb25zdCBzZXJ2ZXJUYXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuc2VydmVyVGFyZ2V0KTtcbiAgY29uc3QgZ2V0QmFzZVVybCA9IChiczogQnJvd3NlclN5bmNJbnN0YW5jZSkgPT5cbiAgICBgJHticy5nZXRPcHRpb24oJ3NjaGVtZScpfTovLyR7YnMuZ2V0T3B0aW9uKCdob3N0Jyl9OiR7YnMuZ2V0T3B0aW9uKCdwb3J0Jyl9YDtcbiAgY29uc3QgYnJvd3NlclRhcmdldFJ1biA9IGNvbnRleHQuc2NoZWR1bGVUYXJnZXQoYnJvd3NlclRhcmdldCwge1xuICAgIHdhdGNoOiBvcHRpb25zLndhdGNoLFxuICAgIHByb2dyZXNzOiBvcHRpb25zLnByb2dyZXNzLFxuICAgIHZlcmJvc2U6IG9wdGlvbnMudmVyYm9zZSxcbiAgICAvLyBEaXNhYmxlIGJ1bmRsZSBidWRnZXRzIGFyZSB0aGVzZSBhcmUgbm90IG1lYW50IHRvIGJlIHVzZWQgd2l0aCBhIGRldi1zZXJ2ZXIgYXMgdGhpcyB3aWxsIGFkZCBleHRyYSBKYXZhU2NyaXB0IGZvciBsaXZlLXJlbG9hZGluZy5cbiAgICBidWRnZXRzOiBbXSxcbiAgfSBhcyBqc29uLkpzb25PYmplY3QpO1xuXG4gIGNvbnN0IHNlcnZlclRhcmdldFJ1biA9IGNvbnRleHQuc2NoZWR1bGVUYXJnZXQoc2VydmVyVGFyZ2V0LCB7XG4gICAgd2F0Y2g6IG9wdGlvbnMud2F0Y2gsXG4gICAgcHJvZ3Jlc3M6IG9wdGlvbnMucHJvZ3Jlc3MsXG4gICAgdmVyYm9zZTogb3B0aW9ucy52ZXJib3NlLFxuICB9IGFzIGpzb24uSnNvbk9iamVjdCk7XG5cbiAgY29uc3QgYnNJbnN0YW5jZSA9IHJlcXVpcmUoJ2Jyb3dzZXItc3luYycpLmNyZWF0ZSgpO1xuXG4gIGNvbnRleHQubG9nZ2VyLmVycm9yKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gIFRoaXMgaXMgYSBzaW1wbGUgc2VydmVyIGZvciB1c2UgaW4gdGVzdGluZyBvciBkZWJ1Z2dpbmcgQW5ndWxhciBhcHBsaWNhdGlvbnMgbG9jYWxseS5cbiAgSXQgaGFzbid0IGJlZW4gcmV2aWV3ZWQgZm9yIHNlY3VyaXR5IGlzc3Vlcy5cblxuICBET04nVCBVU0UgSVQgRk9SIFBST0RVQ1RJT04hXG4gICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiBgKTtcblxuICByZXR1cm4gemlwKGJyb3dzZXJUYXJnZXRSdW4sIHNlcnZlclRhcmdldFJ1biwgZ2V0QXZhaWxhYmxlUG9ydCgpKS5waXBlKFxuICAgIHN3aXRjaE1hcCgoW2JyLCBzciwgbm9kZVNlcnZlclBvcnRdKSA9PiB7XG4gICAgICByZXR1cm4gY29tYmluZUxhdGVzdChbYnIub3V0cHV0LCBzci5vdXRwdXRdKS5waXBlKFxuICAgICAgICAvLyBUaGlzIGlzIG5lZWRlZCBzbyB0aGF0IGlmIGJvdGggc2VydmVyIGFuZCBicm93c2VyIGVtaXQgY2xvc2UgdG8gZWFjaCBvdGhlclxuICAgICAgICAvLyB3ZSBvbmx5IGVtaXQgb25jZS4gVGhpcyB0eXBpY2FsbHkgaGFwcGVucyBvbiB0aGUgZmlyc3QgYnVpbGQuXG4gICAgICAgIGRlYm91bmNlVGltZSgxMjApLFxuICAgICAgICBzd2l0Y2hNYXAoKFtiLCBzXSkgPT4ge1xuICAgICAgICAgIGlmICghcy5zdWNjZXNzIHx8ICFiLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIHJldHVybiBvZihbYiwgc10pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBzdGFydE5vZGVTZXJ2ZXIocywgbm9kZVNlcnZlclBvcnQsIGNvbnRleHQubG9nZ2VyLCAhIW9wdGlvbnMuaW5zcGVjdCkucGlwZShcbiAgICAgICAgICAgIG1hcFRvKFtiLCBzXSksXG4gICAgICAgICAgICBjYXRjaEVycm9yKChlcnIpID0+IHtcbiAgICAgICAgICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoYEEgc2VydmVyIGVycm9yIGhhcyBvY2N1cnJlZC5cXG4ke21hcEVycm9yVG9NZXNzYWdlKGVycil9YCk7XG5cbiAgICAgICAgICAgICAgcmV0dXJuIEVNUFRZO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSksXG4gICAgICAgIG1hcChcbiAgICAgICAgICAoW2IsIHNdKSA9PlxuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogYi5zdWNjZXNzICYmIHMuc3VjY2VzcyxcbiAgICAgICAgICAgICAgICBlcnJvcjogYi5lcnJvciB8fCBzLmVycm9yLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBub2RlU2VydmVyUG9ydCxcbiAgICAgICAgICAgIF0gYXMgW1NTUkRldlNlcnZlckJ1aWxkZXJPdXRwdXQsIG51bWJlcl0sXG4gICAgICAgICksXG4gICAgICAgIHRhcCgoW2J1aWxkZXJPdXRwdXRdKSA9PiB7XG4gICAgICAgICAgaWYgKGJ1aWxkZXJPdXRwdXQuc3VjY2Vzcykge1xuICAgICAgICAgICAgY29udGV4dC5sb2dnZXIuaW5mbygnXFxuQ29tcGlsZWQgc3VjY2Vzc2Z1bGx5LicpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICAgIGRlYm91bmNlKChbYnVpbGRlck91dHB1dF0pID0+XG4gICAgICAgICAgYnVpbGRlck91dHB1dC5zdWNjZXNzICYmICFvcHRpb25zLmluc3BlY3RcbiAgICAgICAgICAgID8gd2FpdFVudGlsU2VydmVySXNMaXN0ZW5pbmcobm9kZVNlcnZlclBvcnQpXG4gICAgICAgICAgICA6IEVNUFRZLFxuICAgICAgICApLFxuICAgICAgICBmaW5hbGl6ZSgoKSA9PiB7XG4gICAgICAgICAgdm9pZCBici5zdG9wKCk7XG4gICAgICAgICAgdm9pZCBzci5zdG9wKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9KSxcbiAgICBjb25jYXRNYXAoKFtidWlsZGVyT3V0cHV0LCBub2RlU2VydmVyUG9ydF0pID0+IHtcbiAgICAgIGlmICghYnVpbGRlck91dHB1dC5zdWNjZXNzKSB7XG4gICAgICAgIHJldHVybiBvZihidWlsZGVyT3V0cHV0KTtcbiAgICAgIH1cblxuICAgICAgaWYgKGJzSW5zdGFuY2UuYWN0aXZlKSB7XG4gICAgICAgIGJzSW5zdGFuY2UucmVsb2FkKCk7XG5cbiAgICAgICAgcmV0dXJuIG9mKGJ1aWxkZXJPdXRwdXQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZyb20oaW5pdEJyb3dzZXJTeW5jKGJzSW5zdGFuY2UsIG5vZGVTZXJ2ZXJQb3J0LCBvcHRpb25zLCBjb250ZXh0KSkucGlwZShcbiAgICAgICAgICB0YXAoKGJzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBiYXNlVXJsID0gZ2V0QmFzZVVybChicyk7XG4gICAgICAgICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKHRhZ3Mub25lTGluZWBcbiAgICAgICAgICAgICAgICAqKlxuICAgICAgICAgICAgICAgIEFuZ3VsYXIgVW5pdmVyc2FsIExpdmUgRGV2ZWxvcG1lbnQgU2VydmVyIGlzIGxpc3RlbmluZyBvbiAke2Jhc2VVcmx9LFxuICAgICAgICAgICAgICAgIG9wZW4geW91ciBicm93c2VyIG9uICR7YmFzZVVybH1cbiAgICAgICAgICAgICAgICAqKlxuICAgICAgICAgICAgICBgKTtcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBtYXBUbyhidWlsZGVyT3V0cHV0KSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICBtYXAoXG4gICAgICAoYnVpbGRlck91dHB1dCkgPT5cbiAgICAgICAgKHtcbiAgICAgICAgICBzdWNjZXNzOiBidWlsZGVyT3V0cHV0LnN1Y2Nlc3MsXG4gICAgICAgICAgZXJyb3I6IGJ1aWxkZXJPdXRwdXQuZXJyb3IsXG4gICAgICAgICAgYmFzZVVybDogZ2V0QmFzZVVybChic0luc3RhbmNlKSxcbiAgICAgICAgICBwb3J0OiBic0luc3RhbmNlLmdldE9wdGlvbigncG9ydCcpLFxuICAgICAgICB9KSBhcyBTU1JEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0LFxuICAgICksXG4gICAgZmluYWxpemUoKCkgPT4ge1xuICAgICAgaWYgKGJzSW5zdGFuY2UpIHtcbiAgICAgICAgYnNJbnN0YW5jZS5leGl0KCk7XG4gICAgICAgIGJzSW5zdGFuY2UuY2xlYW51cCgpO1xuICAgICAgfVxuICAgIH0pLFxuICAgIGNhdGNoRXJyb3IoKGVycm9yKSA9PlxuICAgICAgb2Yoe1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgZXJyb3I6IG1hcEVycm9yVG9NZXNzYWdlKGVycm9yKSxcbiAgICAgIH0pLFxuICAgICksXG4gICk7XG59XG5cbi8vIExvZ3Mgb3V0cHV0IHRvIHRoZSB0ZXJtaW5hbC5cbi8vIFJlbW92ZXMgYW55IHRyYWlsaW5nIG5ldyBsaW5lcyBmcm9tIHRoZSBvdXRwdXQuXG5leHBvcnQgZnVuY3Rpb24gbG9nKFxuICB7IHN0ZGVyciwgc3Rkb3V0IH06IHsgc3RkZXJyOiBzdHJpbmcgfCB1bmRlZmluZWQ7IHN0ZG91dDogc3RyaW5nIHwgdW5kZWZpbmVkIH0sXG4gIGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXJBcGksXG4pIHtcbiAgaWYgKHN0ZGVycikge1xuICAgIC8vIFN0cmlwIHRoZSB3ZWJwYWNrIHNjaGVtZSAod2VicGFjazovLykgZnJvbSBlcnJvciBsb2cuXG4gICAgbG9nZ2VyLmVycm9yKHN0ZGVyci5yZXBsYWNlKC9cXG4/JC8sICcnKS5yZXBsYWNlKC93ZWJwYWNrOlxcL1xcLy9nLCAnLicpKTtcbiAgfVxuXG4gIGlmIChzdGRvdXQgJiYgIUlHTk9SRURfU1RET1VUX01FU1NBR0VTLnNvbWUoKHgpID0+IHN0ZG91dC5pbmNsdWRlcyh4KSkpIHtcbiAgICBsb2dnZXIuaW5mbyhzdGRvdXQucmVwbGFjZSgvXFxuPyQvLCAnJykpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHN0YXJ0Tm9kZVNlcnZlcihcbiAgc2VydmVyT3V0cHV0OiBCdWlsZGVyT3V0cHV0LFxuICBwb3J0OiBudW1iZXIsXG4gIGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXJBcGksXG4gIGluc3BlY3RNb2RlID0gZmFsc2UsXG4pOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgY29uc3Qgb3V0cHV0UGF0aCA9IHNlcnZlck91dHB1dC5vdXRwdXRQYXRoIGFzIHN0cmluZztcbiAgY29uc3QgcGF0aCA9IGpvaW4ob3V0cHV0UGF0aCwgJ21haW4uanMnKTtcbiAgY29uc3QgZW52ID0geyAuLi5wcm9jZXNzLmVudiwgUE9SVDogJycgKyBwb3J0IH07XG5cbiAgY29uc3QgYXJncyA9IFsnLS1lbmFibGUtc291cmNlLW1hcHMnLCBgXCIke3BhdGh9XCJgXTtcbiAgaWYgKGluc3BlY3RNb2RlKSB7XG4gICAgYXJncy51bnNoaWZ0KCctLWluc3BlY3QtYnJrJyk7XG4gIH1cblxuICByZXR1cm4gb2YobnVsbCkucGlwZShcbiAgICBkZWxheSgwKSwgLy8gQXZvaWQgRUFERFJJTlVTRSBlcnJvciBzaW5jZSBpdCB3aWxsIGNhdXNlIHRoZSBraWxsIGV2ZW50IHRvIGJlIGZpbmlzaC5cbiAgICBzd2l0Y2hNYXAoKCkgPT4gc3Bhd25Bc09ic2VydmFibGUoJ25vZGUnLCBhcmdzLCB7IGVudiwgc2hlbGw6IHRydWUgfSkpLFxuICAgIHRhcCgocmVzKSA9PiBsb2coeyBzdGRlcnI6IHJlcy5zdGRlcnIsIHN0ZG91dDogcmVzLnN0ZG91dCB9LCBsb2dnZXIpKSxcbiAgICBpZ25vcmVFbGVtZW50cygpLFxuICAgIC8vIEVtaXQgYSBzaWduYWwgYWZ0ZXIgdGhlIHByb2Nlc3MgaGFzIGJlZW4gc3RhcnRlZFxuICAgIHN0YXJ0V2l0aCh1bmRlZmluZWQpLFxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBpbml0QnJvd3NlclN5bmMoXG4gIGJyb3dzZXJTeW5jSW5zdGFuY2U6IEJyb3dzZXJTeW5jSW5zdGFuY2UsXG4gIG5vZGVTZXJ2ZXJQb3J0OiBudW1iZXIsXG4gIG9wdGlvbnM6IFNTUkRldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IFByb21pc2U8QnJvd3NlclN5bmNJbnN0YW5jZT4ge1xuICBpZiAoYnJvd3NlclN5bmNJbnN0YW5jZS5hY3RpdmUpIHtcbiAgICByZXR1cm4gYnJvd3NlclN5bmNJbnN0YW5jZTtcbiAgfVxuXG4gIGNvbnN0IHsgcG9ydDogYnJvd3NlclN5bmNQb3J0LCBvcGVuLCBob3N0LCBwdWJsaWNIb3N0LCBwcm94eUNvbmZpZyB9ID0gb3B0aW9ucztcbiAgY29uc3QgYnNQb3J0ID0gYnJvd3NlclN5bmNQb3J0IHx8IChhd2FpdCBnZXRBdmFpbGFibGVQb3J0KCkpO1xuICBjb25zdCBic09wdGlvbnM6IEJyb3dzZXJTeW5jT3B0aW9ucyA9IHtcbiAgICBwcm94eToge1xuICAgICAgdGFyZ2V0OiBgbG9jYWxob3N0OiR7bm9kZVNlcnZlclBvcnR9YCxcbiAgICAgIHByb3h5T3B0aW9uczoge1xuICAgICAgICB4ZndkOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHByb3h5UmVzOiBbXG4gICAgICAgIChwcm94eVJlcykgPT4ge1xuICAgICAgICAgIGlmICgnaGVhZGVycycgaW4gcHJveHlSZXMpIHtcbiAgICAgICAgICAgIHByb3h5UmVzLmhlYWRlcnNbJ2NhY2hlLWNvbnRyb2wnXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgLy8gcHJveHlPcHRpb25zIGlzIG5vdCBpbiB0aGUgdHlwaW5nc1xuICAgIH0gYXMgUHJveHlPcHRpb25zICYgeyBwcm94eU9wdGlvbnM6IHsgeGZ3ZDogYm9vbGVhbiB9IH0sXG4gICAgaG9zdCxcbiAgICBwb3J0OiBic1BvcnQsXG4gICAgdWk6IGZhbHNlLFxuICAgIHNlcnZlcjogZmFsc2UsXG4gICAgbm90aWZ5OiBmYWxzZSxcbiAgICBnaG9zdE1vZGU6IGZhbHNlLFxuICAgIGxvZ0xldmVsOiBvcHRpb25zLnZlcmJvc2UgPyAnZGVidWcnIDogJ3NpbGVudCcsXG4gICAgb3BlbixcbiAgICBodHRwczogZ2V0U3NsQ29uZmlnKGNvbnRleHQud29ya3NwYWNlUm9vdCwgb3B0aW9ucyksXG4gIH07XG5cbiAgY29uc3QgcHVibGljSG9zdE5vcm1hbGl6ZWQgPVxuICAgIHB1YmxpY0hvc3QgJiYgcHVibGljSG9zdC5lbmRzV2l0aCgnLycpXG4gICAgICA/IHB1YmxpY0hvc3Quc3Vic3RyaW5nKDAsIHB1YmxpY0hvc3QubGVuZ3RoIC0gMSlcbiAgICAgIDogcHVibGljSG9zdDtcblxuICBpZiAocHVibGljSG9zdE5vcm1hbGl6ZWQpIHtcbiAgICBjb25zdCB7IHByb3RvY29sLCBob3N0bmFtZSwgcG9ydCwgcGF0aG5hbWUgfSA9IHVybC5wYXJzZShwdWJsaWNIb3N0Tm9ybWFsaXplZCk7XG4gICAgY29uc3QgZGVmYXVsdFNvY2tldElvUGF0aCA9ICcvYnJvd3Nlci1zeW5jL3NvY2tldC5pbyc7XG4gICAgY29uc3QgZGVmYXVsdE5hbWVzcGFjZSA9ICcvYnJvd3Nlci1zeW5jJztcbiAgICBjb25zdCBoYXNQYXRobmFtZSA9ICEhKHBhdGhuYW1lICYmIHBhdGhuYW1lICE9PSAnLycpO1xuICAgIGNvbnN0IG5hbWVzcGFjZSA9IGhhc1BhdGhuYW1lID8gcGF0aG5hbWUgKyBkZWZhdWx0TmFtZXNwYWNlIDogZGVmYXVsdE5hbWVzcGFjZTtcbiAgICBjb25zdCBwYXRoID0gaGFzUGF0aG5hbWUgPyBwYXRobmFtZSArIGRlZmF1bHRTb2NrZXRJb1BhdGggOiBkZWZhdWx0U29ja2V0SW9QYXRoO1xuXG4gICAgYnNPcHRpb25zLnNvY2tldCA9IHtcbiAgICAgIG5hbWVzcGFjZSxcbiAgICAgIHBhdGgsXG4gICAgICBkb21haW46IHVybC5mb3JtYXQoe1xuICAgICAgICBwcm90b2NvbCxcbiAgICAgICAgaG9zdG5hbWUsXG4gICAgICAgIHBvcnQsXG4gICAgICB9KSxcbiAgICB9O1xuXG4gICAgLy8gV2hlbiBoYXZpbmcgYSBwYXRobmFtZSB3ZSBhbHNvIG5lZWQgdG8gY3JlYXRlIGEgcmV2ZXJzZSBwcm94eSBiZWNhdXNlIHNvY2tldC5pb1xuICAgIC8vIHdpbGwgYmUgbGlzdGVuaW5nIG9uOiAnaHR0cDovL2xvY2FsaG9zdDo0MjAwL3Nzci9icm93c2VyLXN5bmMvc29ja2V0LmlvJ1xuICAgIC8vIEhvd2V2ZXIgdXNlcnMgd2lsbCB0eXBpY2FsbHkgaGF2ZSBhIHJldmVyc2UgcHJveHkgdGhhdCB3aWxsIHJlZGlyZWN0IGFsbCBtYXRjaGluZyByZXF1ZXN0c1xuICAgIC8vIGV4OiBodHRwOi8vdGVzdGluZ2hvc3QuY29tL3NzciAtPiBodHRwOi8vbG9jYWxob3N0OjQyMDAgd2hpY2ggd2lsbCByZXN1bHQgaW4gYSA0MDQuXG4gICAgaWYgKGhhc1BhdGhuYW1lKSB7XG4gICAgICBjb25zdCB7IGNyZWF0ZVByb3h5TWlkZGxld2FyZSB9ID0gYXdhaXQgaW1wb3J0KCdodHRwLXByb3h5LW1pZGRsZXdhcmUnKTtcblxuICAgICAgLy8gUmVtb3ZlIGxlYWRpbmcgc2xhc2hcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW51c2VkLWV4cHJlc3Npb25zXG4gICAgICAoYnNPcHRpb25zLnNjcmlwdFBhdGggPSAocCkgPT4gcC5zdWJzdHJpbmcoMSkpLFxuICAgICAgICAoYnNPcHRpb25zLm1pZGRsZXdhcmUgPSBbXG4gICAgICAgICAgY3JlYXRlUHJveHlNaWRkbGV3YXJlKGRlZmF1bHRTb2NrZXRJb1BhdGgsIHtcbiAgICAgICAgICAgIHRhcmdldDogdXJsLmZvcm1hdCh7XG4gICAgICAgICAgICAgIHByb3RvY29sOiAnaHR0cCcsXG4gICAgICAgICAgICAgIGhvc3RuYW1lOiBob3N0LFxuICAgICAgICAgICAgICBwb3J0OiBic1BvcnQsXG4gICAgICAgICAgICAgIHBhdGhuYW1lOiBwYXRoLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICB3czogdHJ1ZSxcbiAgICAgICAgICAgIGxvZ0xldmVsOiAnc2lsZW50JyxcbiAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAgICAgfSkgYXMgYW55LFxuICAgICAgICBdKTtcbiAgICB9XG4gIH1cblxuICBpZiAocHJveHlDb25maWcpIHtcbiAgICBpZiAoIWJzT3B0aW9ucy5taWRkbGV3YXJlKSB7XG4gICAgICBic09wdGlvbnMubWlkZGxld2FyZSA9IFtdO1xuICAgIH0gZWxzZSBpZiAoIUFycmF5LmlzQXJyYXkoYnNPcHRpb25zLm1pZGRsZXdhcmUpKSB7XG4gICAgICBic09wdGlvbnMubWlkZGxld2FyZSA9IFtic09wdGlvbnMubWlkZGxld2FyZV07XG4gICAgfVxuXG4gICAgYnNPcHRpb25zLm1pZGRsZXdhcmUgPSBbXG4gICAgICAuLi5ic09wdGlvbnMubWlkZGxld2FyZSxcbiAgICAgIC4uLihhd2FpdCBnZXRQcm94eUNvbmZpZyhjb250ZXh0LndvcmtzcGFjZVJvb3QsIHByb3h5Q29uZmlnKSksXG4gICAgXTtcbiAgfVxuXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgYnJvd3NlclN5bmNJbnN0YW5jZS5pbml0KGJzT3B0aW9ucywgKGVycm9yLCBicykgPT4ge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNvbHZlKGJzKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIG1hcEVycm9yVG9NZXNzYWdlKGVycm9yOiB1bmtub3duKTogc3RyaW5nIHtcbiAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICByZXR1cm4gZXJyb3IubWVzc2FnZTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgZXJyb3IgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGVycm9yO1xuICB9XG5cbiAgcmV0dXJuICcnO1xufVxuXG5mdW5jdGlvbiBnZXRTc2xDb25maWcoXG4gIHJvb3Q6IHN0cmluZyxcbiAgb3B0aW9uczogU1NSRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4pOiBIdHRwc09wdGlvbnMgfCB1bmRlZmluZWQgfCBib29sZWFuIHtcbiAgY29uc3QgeyBzc2wsIHNzbENlcnQsIHNzbEtleSB9ID0gb3B0aW9ucztcbiAgaWYgKHNzbCAmJiBzc2xDZXJ0ICYmIHNzbEtleSkge1xuICAgIHJldHVybiB7XG4gICAgICBrZXk6IHBhdGhSZXNvbHZlKHJvb3QsIHNzbEtleSksXG4gICAgICBjZXJ0OiBwYXRoUmVzb2x2ZShyb290LCBzc2xDZXJ0KSxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHNzbDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0UHJveHlDb25maWcocm9vdDogc3RyaW5nLCBwcm94eUNvbmZpZzogc3RyaW5nKTogUHJvbWlzZTxNaWRkbGV3YXJlSGFuZGxlcltdPiB7XG4gIGNvbnN0IHByb3h5UGF0aCA9IHBhdGhSZXNvbHZlKHJvb3QsIHByb3h5Q29uZmlnKTtcbiAgbGV0IHByb3h5U2V0dGluZ3M6IHVua25vd247XG4gIHRyeSB7XG4gICAgcHJveHlTZXR0aW5ncyA9IHJlcXVpcmUocHJveHlQYXRoKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBhc3NlcnRJc0Vycm9yKGVycm9yKTtcblxuICAgIGlmIChlcnJvci5jb2RlID09PSAnTU9EVUxFX05PVF9GT1VORCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUHJveHkgY29uZmlnIGZpbGUgJHtwcm94eVBhdGh9IGRvZXMgbm90IGV4aXN0LmApO1xuICAgIH1cblxuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgY29uc3QgcHJveGllcyA9IEFycmF5LmlzQXJyYXkocHJveHlTZXR0aW5ncykgPyBwcm94eVNldHRpbmdzIDogW3Byb3h5U2V0dGluZ3NdO1xuICBjb25zdCBjcmVhdGVkUHJveGllcyA9IFtdO1xuICBjb25zdCB7IGNyZWF0ZVByb3h5TWlkZGxld2FyZSB9ID0gYXdhaXQgaW1wb3J0KCdodHRwLXByb3h5LW1pZGRsZXdhcmUnKTtcbiAgZm9yIChjb25zdCBwcm94eSBvZiBwcm94aWVzKSB7XG4gICAgZm9yIChjb25zdCBba2V5LCBjb250ZXh0XSBvZiBPYmplY3QuZW50cmllcyhwcm94eSkpIHtcbiAgICAgIGlmICh0eXBlb2Yga2V5ID09PSAnc3RyaW5nJykge1xuICAgICAgICBjcmVhdGVkUHJveGllcy5wdXNoKFxuICAgICAgICAgIGNyZWF0ZVByb3h5TWlkZGxld2FyZShcbiAgICAgICAgICAgIGtleS5yZXBsYWNlKC9eXFwqJC8sICcqKicpLnJlcGxhY2UoL1xcL1xcKiQvLCAnJyksXG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgICAgICAgY29udGV4dCBhcyBhbnksXG4gICAgICAgICAgKSBhcyBNaWRkbGV3YXJlSGFuZGxlcixcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNyZWF0ZWRQcm94aWVzLnB1c2goXG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICBjcmVhdGVQcm94eU1pZGRsZXdhcmUoa2V5LCBjb250ZXh0IGFzIGFueSkgYXMgTWlkZGxld2FyZUhhbmRsZXIsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGNyZWF0ZWRQcm94aWVzO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyPFNTUkRldlNlcnZlckJ1aWxkZXJPcHRpb25zLCBCdWlsZGVyT3V0cHV0PihleGVjdXRlKTtcbiJdfQ==