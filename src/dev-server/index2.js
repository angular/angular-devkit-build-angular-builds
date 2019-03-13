"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index2_1 = require("@angular-devkit/architect/src/index2");
const index2_2 = require("@angular-devkit/build-webpack/src/webpack-dev-server/index2");
const core_1 = require("@angular-devkit/core");
const node_1 = require("@angular-devkit/core/node");
const fs_1 = require("fs");
const path = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const url = require("url");
const webpack = require("webpack");
const check_port_1 = require("../angular-cli-files/utilities/check-port");
const index2_3 = require("../browser/index2");
const utils_1 = require("../utils");
const opn = require('opn');
exports.devServerBuildOverriddenKeys = [
    'watch',
    'optimization',
    'aot',
    'sourceMap',
    'vendorSourceMap',
    'evalSourceMap',
    'vendorChunk',
    'commonChunk',
    'baseHref',
    'progress',
    'poll',
    'verbose',
    'deployUrl',
];
/**
 * Reusable implementation of the build angular webpack dev server builder.
 * @param options Dev Server options.
 * @param context The build context.
 * @param transforms A map of transforms that can be used to hook into some logic (such as
 *     transforming webpack configuration before passing it to webpack).
 */
function serveWebpackBrowser(options, context, transforms = {}) {
    const browserTarget = index2_1.targetFromTargetString(options.browserTarget);
    const root = context.workspaceRoot;
    let first = true;
    let opnAddress;
    const host = new node_1.NodeJsSyncHost();
    const loggingFn = transforms.logging
        || index2_3.createBrowserLoggingCallback(!!options.verbose, context.logger);
    async function setup() {
        // Get the browser configuration from the target name.
        const rawBrowserOptions = await context.getTargetOptions(browserTarget);
        // Override options we need to override, if defined.
        const overrides = Object.keys(options)
            .filter(key => options[key] !== undefined && exports.devServerBuildOverriddenKeys.includes(key))
            .reduce((previous, key) => (Object.assign({}, previous, { [key]: options[key] })), {});
        const browserName = await context.getBuilderNameForTarget(browserTarget);
        const browserOptions = await context.validateOptions(Object.assign({}, rawBrowserOptions, overrides), browserName);
        const webpackConfigResult = await index2_3.buildBrowserWebpackConfigFromContext(browserOptions, context, host);
        let webpackConfig = webpackConfigResult.config;
        const workspace = webpackConfigResult.workspace;
        if (transforms.browserConfig) {
            webpackConfig = await transforms.browserConfig(workspace, webpackConfig).toPromise();
        }
        const port = await check_port_1.checkPort(options.port || 0, options.host || 'localhost', 4200);
        let webpackDevServerConfig = buildServerConfig(root, options, browserOptions, context.logger);
        if (transforms.serverConfig) {
            webpackDevServerConfig = await transforms.serverConfig(workspace, webpackConfig).toPromise();
        }
        return { browserOptions, webpackConfig, webpackDevServerConfig, port };
    }
    return rxjs_1.from(setup()).pipe(operators_1.switchMap(({ browserOptions, webpackConfig, webpackDevServerConfig, port }) => {
        options.port = port;
        // Resolve public host and client address.
        let clientAddress = `${options.ssl ? 'https' : 'http'}://0.0.0.0:0`;
        if (options.publicHost) {
            let publicHost = options.publicHost;
            if (!/^\w+:\/\//.test(publicHost)) {
                publicHost = `${options.ssl ? 'https' : 'http'}://${publicHost}`;
            }
            const clientUrl = url.parse(publicHost);
            options.publicHost = clientUrl.host;
            clientAddress = url.format(clientUrl);
        }
        // Resolve serve address.
        const serverAddress = url.format({
            protocol: options.ssl ? 'https' : 'http',
            hostname: options.host === '0.0.0.0' ? 'localhost' : options.host,
            // Port cannot be undefined here since we have a step that sets it back in options above.
            // tslint:disable-next-line:no-non-null-assertion
            port: options.port.toString(),
        });
        // Add live reload config.
        if (options.liveReload) {
            _addLiveReload(options, browserOptions, webpackConfig, clientAddress, context.logger);
        }
        else if (options.hmr) {
            context.logger.warn('Live reload is disabled. HMR option ignored.');
        }
        if (!options.watch) {
            // There's no option to turn off file watching in webpack-dev-server, but
            // we can override the file watcher instead.
            webpackConfig.plugins = [...(webpackConfig.plugins || []), {
                    // tslint:disable-next-line:no-any
                    apply: (compiler) => {
                        compiler.hooks.afterEnvironment.tap('angular-cli', () => {
                            compiler.watchFileSystem = { watch: () => { } };
                        });
                    },
                }];
        }
        const normalizedOptimization = utils_1.normalizeOptimization(browserOptions.optimization);
        if (normalizedOptimization.scripts || normalizedOptimization.styles) {
            context.logger.error(core_1.tags.stripIndents `
          ****************************************************************************************
          This is a simple server for use in testing or debugging Angular applications locally.
          It hasn't been reviewed for security issues.

          DON'T USE IT FOR PRODUCTION!
          ****************************************************************************************
        `);
        }
        context.logger.info(core_1.tags.oneLine `
        **
        Angular Live Development Server is listening on ${options.host}:${options.port},
        open your browser on ${serverAddress}${webpackDevServerConfig.publicPath}
        **
      `);
        opnAddress = serverAddress + webpackDevServerConfig.publicPath;
        webpackConfig.devServer = webpackDevServerConfig;
        return index2_2.runWebpackDevServer(webpackConfig, context, { logging: loggingFn });
    }), operators_1.map(buildEvent => {
        if (first && options.open) {
            first = false;
            opn(opnAddress);
        }
        return Object.assign({}, buildEvent, { baseUrl: opnAddress });
    }));
}
exports.serveWebpackBrowser = serveWebpackBrowser;
/**
 * Create a webpack configuration for the dev server.
 * @param workspaceRoot The root of the workspace. This comes from the context.
 * @param serverOptions DevServer options, based on the dev server input schema.
 * @param browserOptions Browser builder options. See the browser builder from this package.
 * @param logger A generic logger to use for showing warnings.
 * @returns A webpack dev-server configuration.
 */
function buildServerConfig(workspaceRoot, serverOptions, browserOptions, logger) {
    if (serverOptions.host) {
        // Check that the host is either localhost or prints out a message.
        if (!/^127\.\d+\.\d+\.\d+/g.test(serverOptions.host) && serverOptions.host !== 'localhost') {
            logger.warn(core_1.tags.stripIndent `
          WARNING: This is a simple server for use in testing or debugging Angular applications
          locally. It hasn't been reviewed for security issues.

          Binding this server to an open connection can result in compromising your application or
          computer. Using a different host than the one passed to the "--host" flag might result in
          websocket connection issues. You might need to use "--disableHostCheck" if that's the
          case.
        `);
        }
    }
    if (serverOptions.disableHostCheck) {
        logger.warn(core_1.tags.oneLine `
        WARNING: Running a server with --disable-host-check is a security risk.
        See https://medium.com/webpack/webpack-dev-server-middleware-security-issues-1489d950874a
        for more information.
      `);
    }
    const servePath = buildServePath(serverOptions, browserOptions, logger);
    const { styles, scripts } = utils_1.normalizeOptimization(browserOptions.optimization);
    const config = {
        host: serverOptions.host,
        port: serverOptions.port,
        headers: { 'Access-Control-Allow-Origin': '*' },
        historyApiFallback: {
            index: `${servePath}/${path.basename(browserOptions.index)}`,
            disableDotRule: true,
            htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
        },
        stats: false,
        compress: styles || scripts,
        watchOptions: {
            poll: browserOptions.poll,
        },
        https: serverOptions.ssl,
        overlay: {
            errors: !(styles || scripts),
            warnings: false,
        },
        public: serverOptions.publicHost,
        disableHostCheck: serverOptions.disableHostCheck,
        publicPath: servePath,
        hot: serverOptions.hmr,
        contentBase: false,
    };
    if (serverOptions.ssl) {
        _addSslConfig(workspaceRoot, serverOptions, config);
    }
    if (serverOptions.proxyConfig) {
        _addProxyConfig(workspaceRoot, serverOptions, config);
    }
    return config;
}
exports.buildServerConfig = buildServerConfig;
/**
 * Resolve and build a URL _path_ that will be the root of the server. This resolved base href and
 * deploy URL from the browser options and returns a path from the root.
 * @param serverOptions The server options that were passed to the server builder.
 * @param browserOptions The browser options that were passed to the browser builder.
 * @param logger A generic logger to use for showing warnings.
 */
function buildServePath(serverOptions, browserOptions, logger) {
    let servePath = serverOptions.servePath;
    if (!servePath && servePath !== '') {
        const defaultPath = _findDefaultServePath(browserOptions.baseHref, browserOptions.deployUrl);
        const showWarning = serverOptions.servePathDefaultWarning;
        if (defaultPath == null && showWarning) {
            logger.warn(core_1.tags.oneLine `
        WARNING: --deploy-url and/or --base-href contain unsupported values for ng serve. Default
        serve path of '/' used. Use --serve-path to override.
      `);
        }
        servePath = defaultPath || '';
    }
    if (servePath.endsWith('/')) {
        servePath = servePath.substr(0, servePath.length - 1);
    }
    if (!servePath.startsWith('/')) {
        servePath = `/${servePath}`;
    }
    return servePath;
}
exports.buildServePath = buildServePath;
/**
 * Private method to enhance a webpack config with live reload configuration.
 * @private
 */
function _addLiveReload(options, browserOptions, webpackConfig, clientAddress, logger) {
    if (webpackConfig.plugins === undefined) {
        webpackConfig.plugins = [];
    }
    // This allows for live reload of page when changes are made to repo.
    // https://webpack.js.org/configuration/dev-server/#devserver-inline
    let webpackDevServerPath;
    try {
        webpackDevServerPath = require.resolve('webpack-dev-server/client');
    }
    catch (_a) {
        throw new Error('The "webpack-dev-server" package could not be found.');
    }
    const entryPoints = [`${webpackDevServerPath}?${clientAddress}`];
    if (options.hmr) {
        const webpackHmrLink = 'https://webpack.js.org/guides/hot-module-replacement';
        logger.warn(core_1.tags.oneLine `NOTICE: Hot Module Replacement (HMR) is enabled for the dev server.`);
        const showWarning = options.hmrWarning;
        if (showWarning) {
            logger.info(core_1.tags.stripIndents `
          The project will still live reload when HMR is enabled,
          but to take advantage of HMR additional application code is required'
          (not included in an Angular CLI project by default).'
          See ${webpackHmrLink}
          for information on working with HMR for Webpack.`);
            logger.warn(core_1.tags.oneLine `To disable this warning use "hmrWarning: false" under "serve"
           options in "angular.json".`);
        }
        entryPoints.push('webpack/hot/dev-server');
        webpackConfig.plugins.push(new webpack.HotModuleReplacementPlugin());
        if (browserOptions.extractCss) {
            logger.warn(core_1.tags.oneLine `NOTICE: (HMR) does not allow for CSS hot reload
                when used together with '--extract-css'.`);
        }
    }
    if (typeof webpackConfig.entry !== 'object' || Array.isArray(webpackConfig.entry)) {
        webpackConfig.entry = {};
    }
    if (!Array.isArray(webpackConfig.entry.main)) {
        webpackConfig.entry.main = [];
    }
    webpackConfig.entry.main.unshift(...entryPoints);
}
/**
 * Private method to enhance a webpack config with SSL configuration.
 * @private
 */
function _addSslConfig(root, options, config) {
    let sslKey = undefined;
    let sslCert = undefined;
    if (options.sslKey) {
        const keyPath = path.resolve(root, options.sslKey);
        if (fs_1.existsSync(keyPath)) {
            sslKey = fs_1.readFileSync(keyPath, 'utf-8');
        }
    }
    if (options.sslCert) {
        const certPath = path.resolve(root, options.sslCert);
        if (fs_1.existsSync(certPath)) {
            sslCert = fs_1.readFileSync(certPath, 'utf-8');
        }
    }
    config.https = true;
    if (sslKey != null && sslCert != null) {
        config.https = {
            key: sslKey,
            cert: sslCert,
        };
    }
}
/**
 * Private method to enhance a webpack config with Proxy configuration.
 * @private
 */
function _addProxyConfig(root, options, config) {
    let proxyConfig = {};
    const proxyPath = path.resolve(root, options.proxyConfig);
    if (fs_1.existsSync(proxyPath)) {
        proxyConfig = require(proxyPath);
    }
    else {
        const message = 'Proxy config file ' + proxyPath + ' does not exist.';
        throw new Error(message);
    }
    config.proxy = proxyConfig;
}
/**
 * Find the default server path. We don't want to expose baseHref and deployUrl as arguments, only
 * the browser options where needed. This method should stay private (people who want to resolve
 * baseHref and deployUrl should use the buildServePath exported function.
 * @private
 */
function _findDefaultServePath(baseHref, deployUrl) {
    if (!baseHref && !deployUrl) {
        return '';
    }
    if (/^(\w+:)?\/\//.test(baseHref || '') || /^(\w+:)?\/\//.test(deployUrl || '')) {
        // If baseHref or deployUrl is absolute, unsupported by ng serve
        return null;
    }
    // normalize baseHref
    // for ng serve the starting base is always `/` so a relative
    // and root relative value are identical
    const baseHrefParts = (baseHref || '')
        .split('/')
        .filter(part => part !== '');
    if (baseHref && !baseHref.endsWith('/')) {
        baseHrefParts.pop();
    }
    const normalizedBaseHref = baseHrefParts.length === 0 ? '/' : `/${baseHrefParts.join('/')}/`;
    if (deployUrl && deployUrl[0] === '/') {
        if (baseHref && baseHref[0] === '/' && normalizedBaseHref !== deployUrl) {
            // If baseHref and deployUrl are root relative and not equivalent, unsupported by ng serve
            return null;
        }
        return deployUrl;
    }
    // Join together baseHref and deployUrl
    return `${normalizedBaseHref}${deployUrl || ''}`;
}
exports.default = index2_1.createBuilder(serveWebpackBrowser);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9kZXYtc2VydmVyL2luZGV4Mi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOztBQUVILGlFQUk4QztBQUM5Qyx3RkFHcUU7QUFFckUsK0NBQXlFO0FBQ3pFLG9EQUEyRDtBQUMzRCwyQkFBOEM7QUFDOUMsNkJBQTZCO0FBQzdCLCtCQUF3QztBQUN4Qyw4Q0FBZ0Q7QUFDaEQsMkJBQTJCO0FBQzNCLG1DQUFtQztBQUVuQywwRUFBc0U7QUFDdEUsOENBSTJCO0FBRTNCLG9DQUFpRDtBQUVqRCxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7QUFJZCxRQUFBLDRCQUE0QixHQUFxQztJQUM1RSxPQUFPO0lBQ1AsY0FBYztJQUNkLEtBQUs7SUFDTCxXQUFXO0lBQ1gsaUJBQWlCO0lBQ2pCLGVBQWU7SUFDZixhQUFhO0lBQ2IsYUFBYTtJQUNiLFVBQVU7SUFDVixVQUFVO0lBQ1YsTUFBTTtJQUNOLFNBQVM7SUFDVCxXQUFXO0NBQ1osQ0FBQztBQVlGOzs7Ozs7R0FNRztBQUNILFNBQWdCLG1CQUFtQixDQUNqQyxPQUErQixFQUMvQixPQUF1QixFQUN2QixhQUlJLEVBQUU7SUFFTixNQUFNLGFBQWEsR0FBRywrQkFBc0IsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDcEUsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUNuQyxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUM7SUFDakIsSUFBSSxVQUFrQixDQUFDO0lBQ3ZCLE1BQU0sSUFBSSxHQUFHLElBQUkscUJBQWMsRUFBRSxDQUFDO0lBRWxDLE1BQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQyxPQUFPO1dBQy9CLHFDQUE0QixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLE9B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RSxDQUFDO0FBQ25ELENBQUM7QUFHRCxrQkFBZSxzQkFBYSxDQUFpRCxtQkFBbUIsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZGVyQ29udGV4dCxcbiAgY3JlYXRlQnVpbGRlcixcbiAgdGFyZ2V0RnJvbVRhcmdldFN0cmluZyxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdC9zcmMvaW5kZXgyJztcbmltcG9ydCB7XG4gIERldlNlcnZlckJ1aWxkT3V0cHV0LFxuICBydW5XZWJwYWNrRGV2U2VydmVyLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjay9zcmMvd2VicGFjay1kZXYtc2VydmVyL2luZGV4Mic7XG5pbXBvcnQgeyBXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLXdlYnBhY2svc3JjL3dlYnBhY2svaW5kZXgyJztcbmltcG9ydCB7IGV4cGVyaW1lbnRhbCwganNvbiwgbG9nZ2luZywgdGFncyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IE5vZGVKc1N5bmNIb3N0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUvbm9kZSc7XG5pbXBvcnQgeyBleGlzdHNTeW5jLCByZWFkRmlsZVN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgbWFwLCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcbmltcG9ydCAqIGFzIHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgKiBhcyBXZWJwYWNrRGV2U2VydmVyIGZyb20gJ3dlYnBhY2stZGV2LXNlcnZlcic7XG5pbXBvcnQgeyBjaGVja1BvcnQgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvY2hlY2stcG9ydCc7XG5pbXBvcnQge1xuICBCcm93c2VyQ29uZmlnVHJhbnNmb3JtRm4sXG4gIGJ1aWxkQnJvd3NlcldlYnBhY2tDb25maWdGcm9tQ29udGV4dCxcbiAgY3JlYXRlQnJvd3NlckxvZ2dpbmdDYWxsYmFjayxcbn0gZnJvbSAnLi4vYnJvd3Nlci9pbmRleDInO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyU2NoZW1hIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgbm9ybWFsaXplT3B0aW1pemF0aW9uIH0gZnJvbSAnLi4vdXRpbHMnO1xuaW1wb3J0IHsgU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuY29uc3Qgb3BuID0gcmVxdWlyZSgnb3BuJyk7XG5cbmV4cG9ydCB0eXBlIERldlNlcnZlckJ1aWxkZXJTY2hlbWEgPSBTY2hlbWEgJiBqc29uLkpzb25PYmplY3Q7XG5cbmV4cG9ydCBjb25zdCBkZXZTZXJ2ZXJCdWlsZE92ZXJyaWRkZW5LZXlzOiAoa2V5b2YgRGV2U2VydmVyQnVpbGRlclNjaGVtYSlbXSA9IFtcbiAgJ3dhdGNoJyxcbiAgJ29wdGltaXphdGlvbicsXG4gICdhb3QnLFxuICAnc291cmNlTWFwJyxcbiAgJ3ZlbmRvclNvdXJjZU1hcCcsXG4gICdldmFsU291cmNlTWFwJyxcbiAgJ3ZlbmRvckNodW5rJyxcbiAgJ2NvbW1vbkNodW5rJyxcbiAgJ2Jhc2VIcmVmJyxcbiAgJ3Byb2dyZXNzJyxcbiAgJ3BvbGwnLFxuICAndmVyYm9zZScsXG4gICdkZXBsb3lVcmwnLFxuXTtcblxuXG5leHBvcnQgdHlwZSBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0ID0gRGV2U2VydmVyQnVpbGRPdXRwdXQgJiB7XG4gIGJhc2VVcmw6IHN0cmluZztcbn07XG5cbmV4cG9ydCB0eXBlIFNlcnZlckNvbmZpZ1RyYW5zZm9ybUZuID0gKFxuICB3b3Jrc3BhY2U6IGV4cGVyaW1lbnRhbC53b3Jrc3BhY2UuV29ya3NwYWNlLFxuICBjb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXIuQ29uZmlndXJhdGlvbixcbikgPT4gT2JzZXJ2YWJsZTxXZWJwYWNrRGV2U2VydmVyLkNvbmZpZ3VyYXRpb24+O1xuXG4vKipcbiAqIFJldXNhYmxlIGltcGxlbWVudGF0aW9uIG9mIHRoZSBidWlsZCBhbmd1bGFyIHdlYnBhY2sgZGV2IHNlcnZlciBidWlsZGVyLlxuICogQHBhcmFtIG9wdGlvbnMgRGV2IFNlcnZlciBvcHRpb25zLlxuICogQHBhcmFtIGNvbnRleHQgVGhlIGJ1aWxkIGNvbnRleHQuXG4gKiBAcGFyYW0gdHJhbnNmb3JtcyBBIG1hcCBvZiB0cmFuc2Zvcm1zIHRoYXQgY2FuIGJlIHVzZWQgdG8gaG9vayBpbnRvIHNvbWUgbG9naWMgKHN1Y2ggYXNcbiAqICAgICB0cmFuc2Zvcm1pbmcgd2VicGFjayBjb25maWd1cmF0aW9uIGJlZm9yZSBwYXNzaW5nIGl0IHRvIHdlYnBhY2spLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2VydmVXZWJwYWNrQnJvd3NlcihcbiAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlclNjaGVtYSxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHRyYW5zZm9ybXM6IHtcbiAgICBicm93c2VyQ29uZmlnPzogQnJvd3NlckNvbmZpZ1RyYW5zZm9ybUZuLFxuICAgIHNlcnZlckNvbmZpZz86IFNlcnZlckNvbmZpZ1RyYW5zZm9ybUZuLFxuICAgIGxvZ2dpbmc/OiBXZWJwYWNrTG9nZ2luZ0NhbGxiYWNrLFxuICB9ID0ge30sXG4pOiBPYnNlcnZhYmxlPERldlNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3QgYnJvd3NlclRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5icm93c2VyVGFyZ2V0KTtcbiAgY29uc3Qgcm9vdCA9IGNvbnRleHQud29ya3NwYWNlUm9vdDtcbiAgbGV0IGZpcnN0ID0gdHJ1ZTtcbiAgbGV0IG9wbkFkZHJlc3M6IHN0cmluZztcbiAgY29uc3QgaG9zdCA9IG5ldyBOb2RlSnNTeW5jSG9zdCgpO1xuXG4gIGNvbnN0IGxvZ2dpbmdGbiA9IHRyYW5zZm9ybXMubG9nZ2luZ1xuICAgIHx8IGNyZWF0ZUJyb3dzZXJMb2dnaW5nQ2FsbGJhY2soISFvcHRpb25zLnZlcmJvc2UsIGNvbnRleHQubG9nZ2VyKTtcblxuICBhc3luYyBmdW5jdGlvbiBzZXR1cCgpOiBQcm9taXNlPHtcbiAgICBicm93c2VyT3B0aW9uczoganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICAgd2VicGFja0NvbmZpZzogd2VicGFjay5Db25maWd1cmF0aW9uLFxuICAgIHdlYnBhY2tEZXZTZXJ2ZXJDb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXIuQ29uZmlndXJhdGlvbixcbiAgICBwb3J0OiBudW1iZXIsXG4gIH0+IHtcbiAgICAvLyBHZXQgdGhlIGJyb3dzZXIgY29uZmlndXJhdGlvbiBmcm9tIHRoZSB0YXJnZXQgbmFtZS5cbiAgICBjb25zdCByYXdCcm93c2VyT3B0aW9ucyA9IGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhicm93c2VyVGFyZ2V0KTtcblxuICAgIC8vIE92ZXJyaWRlIG9wdGlvbnMgd2UgbmVlZCB0byBvdmVycmlkZSwgaWYgZGVmaW5lZC5cbiAgICBjb25zdCBvdmVycmlkZXMgPSAoT2JqZWN0LmtleXMob3B0aW9ucykgYXMgKGtleW9mIERldlNlcnZlckJ1aWxkZXJTY2hlbWEpW10pXG4gICAgLmZpbHRlcihrZXkgPT4gb3B0aW9uc1trZXldICE9PSB1bmRlZmluZWQgJiYgZGV2U2VydmVyQnVpbGRPdmVycmlkZGVuS2V5cy5pbmNsdWRlcyhrZXkpKVxuICAgIC5yZWR1Y2U8anNvbi5Kc29uT2JqZWN0ICYgUGFydGlhbDxCcm93c2VyQnVpbGRlclNjaGVtYT4+KChwcmV2aW91cywga2V5KSA9PiAoe1xuICAgICAgLi4ucHJldmlvdXMsXG4gICAgICBba2V5XTogb3B0aW9uc1trZXldLFxuICAgIH0pLCB7fSk7XG5cbiAgICBjb25zdCBicm93c2VyTmFtZSA9IGF3YWl0IGNvbnRleHQuZ2V0QnVpbGRlck5hbWVGb3JUYXJnZXQoYnJvd3NlclRhcmdldCk7XG4gICAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSBhd2FpdCBjb250ZXh0LnZhbGlkYXRlT3B0aW9uczxqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlclNjaGVtYT4oXG4gICAgICB7IC4uLnJhd0Jyb3dzZXJPcHRpb25zLCAuLi5vdmVycmlkZXMgfSxcbiAgICAgIGJyb3dzZXJOYW1lLFxuICAgICk7XG5cbiAgICBjb25zdCB3ZWJwYWNrQ29uZmlnUmVzdWx0ID0gYXdhaXQgYnVpbGRCcm93c2VyV2VicGFja0NvbmZpZ0Zyb21Db250ZXh0KFxuICAgICAgYnJvd3Nlck9wdGlvbnMsXG4gICAgICBjb250ZXh0LFxuICAgICAgaG9zdCxcbiAgICApO1xuICAgIGxldCB3ZWJwYWNrQ29uZmlnID0gd2VicGFja0NvbmZpZ1Jlc3VsdC5jb25maWc7XG4gICAgY29uc3Qgd29ya3NwYWNlID0gd2VicGFja0NvbmZpZ1Jlc3VsdC53b3Jrc3BhY2U7XG5cbiAgICBpZiAodHJhbnNmb3Jtcy5icm93c2VyQ29uZmlnKSB7XG4gICAgICB3ZWJwYWNrQ29uZmlnID0gYXdhaXQgdHJhbnNmb3Jtcy5icm93c2VyQ29uZmlnKHdvcmtzcGFjZSwgd2VicGFja0NvbmZpZykudG9Qcm9taXNlKCk7XG4gICAgfVxuXG4gICAgY29uc3QgcG9ydCA9IGF3YWl0IGNoZWNrUG9ydChvcHRpb25zLnBvcnQgfHwgMCwgb3B0aW9ucy5ob3N0IHx8ICdsb2NhbGhvc3QnLCA0MjAwKTtcbiAgICBsZXQgd2VicGFja0RldlNlcnZlckNvbmZpZyA9IGJ1aWxkU2VydmVyQ29uZmlnKFxuICAgICAgcm9vdCxcbiAgICAgIG9wdGlvbnMsXG4gICAgICBicm93c2VyT3B0aW9ucyxcbiAgICAgIGNvbnRleHQubG9nZ2VyLFxuICAgICk7XG5cbiAgICBpZiAodHJhbnNmb3Jtcy5zZXJ2ZXJDb25maWcpIHtcbiAgICAgIHdlYnBhY2tEZXZTZXJ2ZXJDb25maWcgPSBhd2FpdCB0cmFuc2Zvcm1zLnNlcnZlckNvbmZpZyh3b3Jrc3BhY2UsIHdlYnBhY2tDb25maWcpLnRvUHJvbWlzZSgpO1xuICAgIH1cblxuICAgIHJldHVybiB7IGJyb3dzZXJPcHRpb25zLCB3ZWJwYWNrQ29uZmlnLCB3ZWJwYWNrRGV2U2VydmVyQ29uZmlnLCBwb3J0IH07XG4gIH1cblxuICByZXR1cm4gZnJvbShzZXR1cCgpKS5waXBlKFxuICAgIHN3aXRjaE1hcCgoeyBicm93c2VyT3B0aW9ucywgd2VicGFja0NvbmZpZywgd2VicGFja0RldlNlcnZlckNvbmZpZywgcG9ydCB9KSA9PiB7XG4gICAgICBvcHRpb25zLnBvcnQgPSBwb3J0O1xuXG4gICAgICAvLyBSZXNvbHZlIHB1YmxpYyBob3N0IGFuZCBjbGllbnQgYWRkcmVzcy5cbiAgICAgIGxldCBjbGllbnRBZGRyZXNzID0gYCR7b3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnfTovLzAuMC4wLjA6MGA7XG4gICAgICBpZiAob3B0aW9ucy5wdWJsaWNIb3N0KSB7XG4gICAgICAgIGxldCBwdWJsaWNIb3N0ID0gb3B0aW9ucy5wdWJsaWNIb3N0O1xuICAgICAgICBpZiAoIS9eXFx3KzpcXC9cXC8vLnRlc3QocHVibGljSG9zdCkpIHtcbiAgICAgICAgICBwdWJsaWNIb3N0ID0gYCR7b3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnfTovLyR7cHVibGljSG9zdH1gO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNsaWVudFVybCA9IHVybC5wYXJzZShwdWJsaWNIb3N0KTtcbiAgICAgICAgb3B0aW9ucy5wdWJsaWNIb3N0ID0gY2xpZW50VXJsLmhvc3Q7XG4gICAgICAgIGNsaWVudEFkZHJlc3MgPSB1cmwuZm9ybWF0KGNsaWVudFVybCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJlc29sdmUgc2VydmUgYWRkcmVzcy5cbiAgICAgIGNvbnN0IHNlcnZlckFkZHJlc3MgPSB1cmwuZm9ybWF0KHtcbiAgICAgICAgcHJvdG9jb2w6IG9wdGlvbnMuc3NsID8gJ2h0dHBzJyA6ICdodHRwJyxcbiAgICAgICAgaG9zdG5hbWU6IG9wdGlvbnMuaG9zdCA9PT0gJzAuMC4wLjAnID8gJ2xvY2FsaG9zdCcgOiBvcHRpb25zLmhvc3QsXG4gICAgICAgIC8vIFBvcnQgY2Fubm90IGJlIHVuZGVmaW5lZCBoZXJlIHNpbmNlIHdlIGhhdmUgYSBzdGVwIHRoYXQgc2V0cyBpdCBiYWNrIGluIG9wdGlvbnMgYWJvdmUuXG4gICAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgcG9ydDogb3B0aW9ucy5wb3J0ICEudG9TdHJpbmcoKSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBBZGQgbGl2ZSByZWxvYWQgY29uZmlnLlxuICAgICAgaWYgKG9wdGlvbnMubGl2ZVJlbG9hZCkge1xuICAgICAgICBfYWRkTGl2ZVJlbG9hZChvcHRpb25zLCBicm93c2VyT3B0aW9ucywgd2VicGFja0NvbmZpZywgY2xpZW50QWRkcmVzcywgY29udGV4dC5sb2dnZXIpO1xuICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmhtcikge1xuICAgICAgICBjb250ZXh0LmxvZ2dlci53YXJuKCdMaXZlIHJlbG9hZCBpcyBkaXNhYmxlZC4gSE1SIG9wdGlvbiBpZ25vcmVkLicpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIW9wdGlvbnMud2F0Y2gpIHtcbiAgICAgICAgLy8gVGhlcmUncyBubyBvcHRpb24gdG8gdHVybiBvZmYgZmlsZSB3YXRjaGluZyBpbiB3ZWJwYWNrLWRldi1zZXJ2ZXIsIGJ1dFxuICAgICAgICAvLyB3ZSBjYW4gb3ZlcnJpZGUgdGhlIGZpbGUgd2F0Y2hlciBpbnN0ZWFkLlxuICAgICAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMgPSBbLi4uKHdlYnBhY2tDb25maWcucGx1Z2lucyB8fCBbXSksICB7XG4gICAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICAgIGFwcGx5OiAoY29tcGlsZXI6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29tcGlsZXIuaG9va3MuYWZ0ZXJFbnZpcm9ubWVudC50YXAoJ2FuZ3VsYXItY2xpJywgKCkgPT4ge1xuICAgICAgICAgICAgICBjb21waWxlci53YXRjaEZpbGVTeXN0ZW0gPSB7IHdhdGNoOiAoKSA9PiB7IH0gfTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sXG4gICAgICAgIH1dO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBub3JtYWxpemVkT3B0aW1pemF0aW9uID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbik7XG4gICAgICBpZiAobm9ybWFsaXplZE9wdGltaXphdGlvbi5zY3JpcHRzIHx8IG5vcm1hbGl6ZWRPcHRpbWl6YXRpb24uc3R5bGVzKSB7XG4gICAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICBUaGlzIGlzIGEgc2ltcGxlIHNlcnZlciBmb3IgdXNlIGluIHRlc3Rpbmcgb3IgZGVidWdnaW5nIEFuZ3VsYXIgYXBwbGljYXRpb25zIGxvY2FsbHkuXG4gICAgICAgICAgSXQgaGFzbid0IGJlZW4gcmV2aWV3ZWQgZm9yIHNlY3VyaXR5IGlzc3Vlcy5cblxuICAgICAgICAgIERPTidUIFVTRSBJVCBGT1IgUFJPRFVDVElPTiFcbiAgICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgIGApO1xuICAgICAgfVxuXG4gICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKHRhZ3Mub25lTGluZWBcbiAgICAgICAgKipcbiAgICAgICAgQW5ndWxhciBMaXZlIERldmVsb3BtZW50IFNlcnZlciBpcyBsaXN0ZW5pbmcgb24gJHtvcHRpb25zLmhvc3R9OiR7b3B0aW9ucy5wb3J0fSxcbiAgICAgICAgb3BlbiB5b3VyIGJyb3dzZXIgb24gJHtzZXJ2ZXJBZGRyZXNzfSR7d2VicGFja0RldlNlcnZlckNvbmZpZy5wdWJsaWNQYXRofVxuICAgICAgICAqKlxuICAgICAgYCk7XG5cbiAgICAgIG9wbkFkZHJlc3MgPSBzZXJ2ZXJBZGRyZXNzICsgd2VicGFja0RldlNlcnZlckNvbmZpZy5wdWJsaWNQYXRoO1xuICAgICAgd2VicGFja0NvbmZpZy5kZXZTZXJ2ZXIgPSB3ZWJwYWNrRGV2U2VydmVyQ29uZmlnO1xuXG4gICAgICByZXR1cm4gcnVuV2VicGFja0RldlNlcnZlcih3ZWJwYWNrQ29uZmlnLCBjb250ZXh0LCB7IGxvZ2dpbmc6IGxvZ2dpbmdGbiB9KTtcbiAgICB9KSxcbiAgICBtYXAoYnVpbGRFdmVudCA9PiB7XG4gICAgICBpZiAoZmlyc3QgJiYgb3B0aW9ucy5vcGVuKSB7XG4gICAgICAgIGZpcnN0ID0gZmFsc2U7XG4gICAgICAgIG9wbihvcG5BZGRyZXNzKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHsgLi4uYnVpbGRFdmVudCwgYmFzZVVybDogb3BuQWRkcmVzcyB9IGFzIERldlNlcnZlckJ1aWxkZXJPdXRwdXQ7XG4gICAgfSksXG4gICk7XG59XG5cblxuLyoqXG4gKiBDcmVhdGUgYSB3ZWJwYWNrIGNvbmZpZ3VyYXRpb24gZm9yIHRoZSBkZXYgc2VydmVyLlxuICogQHBhcmFtIHdvcmtzcGFjZVJvb3QgVGhlIHJvb3Qgb2YgdGhlIHdvcmtzcGFjZS4gVGhpcyBjb21lcyBmcm9tIHRoZSBjb250ZXh0LlxuICogQHBhcmFtIHNlcnZlck9wdGlvbnMgRGV2U2VydmVyIG9wdGlvbnMsIGJhc2VkIG9uIHRoZSBkZXYgc2VydmVyIGlucHV0IHNjaGVtYS5cbiAqIEBwYXJhbSBicm93c2VyT3B0aW9ucyBCcm93c2VyIGJ1aWxkZXIgb3B0aW9ucy4gU2VlIHRoZSBicm93c2VyIGJ1aWxkZXIgZnJvbSB0aGlzIHBhY2thZ2UuXG4gKiBAcGFyYW0gbG9nZ2VyIEEgZ2VuZXJpYyBsb2dnZXIgdG8gdXNlIGZvciBzaG93aW5nIHdhcm5pbmdzLlxuICogQHJldHVybnMgQSB3ZWJwYWNrIGRldi1zZXJ2ZXIgY29uZmlndXJhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkU2VydmVyQ29uZmlnKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIHNlcnZlck9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJTY2hlbWEsXG4gIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSxcbik6IFdlYnBhY2tEZXZTZXJ2ZXIuQ29uZmlndXJhdGlvbiB7XG4gIGlmIChzZXJ2ZXJPcHRpb25zLmhvc3QpIHtcbiAgICAvLyBDaGVjayB0aGF0IHRoZSBob3N0IGlzIGVpdGhlciBsb2NhbGhvc3Qgb3IgcHJpbnRzIG91dCBhIG1lc3NhZ2UuXG4gICAgaWYgKCEvXjEyN1xcLlxcZCtcXC5cXGQrXFwuXFxkKy9nLnRlc3Qoc2VydmVyT3B0aW9ucy5ob3N0KSAmJiBzZXJ2ZXJPcHRpb25zLmhvc3QgIT09ICdsb2NhbGhvc3QnKSB7XG4gICAgICBsb2dnZXIud2Fybih0YWdzLnN0cmlwSW5kZW50YFxuICAgICAgICAgIFdBUk5JTkc6IFRoaXMgaXMgYSBzaW1wbGUgc2VydmVyIGZvciB1c2UgaW4gdGVzdGluZyBvciBkZWJ1Z2dpbmcgQW5ndWxhciBhcHBsaWNhdGlvbnNcbiAgICAgICAgICBsb2NhbGx5LiBJdCBoYXNuJ3QgYmVlbiByZXZpZXdlZCBmb3Igc2VjdXJpdHkgaXNzdWVzLlxuXG4gICAgICAgICAgQmluZGluZyB0aGlzIHNlcnZlciB0byBhbiBvcGVuIGNvbm5lY3Rpb24gY2FuIHJlc3VsdCBpbiBjb21wcm9taXNpbmcgeW91ciBhcHBsaWNhdGlvbiBvclxuICAgICAgICAgIGNvbXB1dGVyLiBVc2luZyBhIGRpZmZlcmVudCBob3N0IHRoYW4gdGhlIG9uZSBwYXNzZWQgdG8gdGhlIFwiLS1ob3N0XCIgZmxhZyBtaWdodCByZXN1bHQgaW5cbiAgICAgICAgICB3ZWJzb2NrZXQgY29ubmVjdGlvbiBpc3N1ZXMuIFlvdSBtaWdodCBuZWVkIHRvIHVzZSBcIi0tZGlzYWJsZUhvc3RDaGVja1wiIGlmIHRoYXQncyB0aGVcbiAgICAgICAgICBjYXNlLlxuICAgICAgICBgKTtcbiAgICB9XG4gIH1cbiAgaWYgKHNlcnZlck9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjaykge1xuICAgIGxvZ2dlci53YXJuKHRhZ3Mub25lTGluZWBcbiAgICAgICAgV0FSTklORzogUnVubmluZyBhIHNlcnZlciB3aXRoIC0tZGlzYWJsZS1ob3N0LWNoZWNrIGlzIGEgc2VjdXJpdHkgcmlzay5cbiAgICAgICAgU2VlIGh0dHBzOi8vbWVkaXVtLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LXNlcnZlci1taWRkbGV3YXJlLXNlY3VyaXR5LWlzc3Vlcy0xNDg5ZDk1MDg3NGFcbiAgICAgICAgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gICAgICBgKTtcbiAgfVxuXG4gIGNvbnN0IHNlcnZlUGF0aCA9IGJ1aWxkU2VydmVQYXRoKHNlcnZlck9wdGlvbnMsIGJyb3dzZXJPcHRpb25zLCBsb2dnZXIpO1xuICBjb25zdCB7IHN0eWxlcywgc2NyaXB0cyB9ID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbik7XG5cbiAgY29uc3QgY29uZmlnOiBXZWJwYWNrRGV2U2VydmVyLkNvbmZpZ3VyYXRpb24gPSB7XG4gICAgaG9zdDogc2VydmVyT3B0aW9ucy5ob3N0LFxuICAgIHBvcnQ6IHNlcnZlck9wdGlvbnMucG9ydCxcbiAgICBoZWFkZXJzOiB7ICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicgfSxcbiAgICBoaXN0b3J5QXBpRmFsbGJhY2s6IHtcbiAgICAgIGluZGV4OiBgJHtzZXJ2ZVBhdGh9LyR7cGF0aC5iYXNlbmFtZShicm93c2VyT3B0aW9ucy5pbmRleCl9YCxcbiAgICAgIGRpc2FibGVEb3RSdWxlOiB0cnVlLFxuICAgICAgaHRtbEFjY2VwdEhlYWRlcnM6IFsndGV4dC9odG1sJywgJ2FwcGxpY2F0aW9uL3hodG1sK3htbCddLFxuICAgIH0gYXMgV2VicGFja0RldlNlcnZlci5IaXN0b3J5QXBpRmFsbGJhY2tDb25maWcsXG4gICAgc3RhdHM6IGZhbHNlLFxuICAgIGNvbXByZXNzOiBzdHlsZXMgfHwgc2NyaXB0cyxcbiAgICB3YXRjaE9wdGlvbnM6IHtcbiAgICAgIHBvbGw6IGJyb3dzZXJPcHRpb25zLnBvbGwsXG4gICAgfSxcbiAgICBodHRwczogc2VydmVyT3B0aW9ucy5zc2wsXG4gICAgb3ZlcmxheToge1xuICAgICAgZXJyb3JzOiAhKHN0eWxlcyB8fCBzY3JpcHRzKSxcbiAgICAgIHdhcm5pbmdzOiBmYWxzZSxcbiAgICB9LFxuICAgIHB1YmxpYzogc2VydmVyT3B0aW9ucy5wdWJsaWNIb3N0LFxuICAgIGRpc2FibGVIb3N0Q2hlY2s6IHNlcnZlck9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjayxcbiAgICBwdWJsaWNQYXRoOiBzZXJ2ZVBhdGgsXG4gICAgaG90OiBzZXJ2ZXJPcHRpb25zLmhtcixcbiAgICBjb250ZW50QmFzZTogZmFsc2UsXG4gIH07XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMuc3NsKSB7XG4gICAgX2FkZFNzbENvbmZpZyh3b3Jrc3BhY2VSb290LCBzZXJ2ZXJPcHRpb25zLCBjb25maWcpO1xuICB9XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMucHJveHlDb25maWcpIHtcbiAgICBfYWRkUHJveHlDb25maWcod29ya3NwYWNlUm9vdCwgc2VydmVyT3B0aW9ucywgY29uZmlnKTtcbiAgfVxuXG4gIHJldHVybiBjb25maWc7XG59XG5cbi8qKlxuICogUmVzb2x2ZSBhbmQgYnVpbGQgYSBVUkwgX3BhdGhfIHRoYXQgd2lsbCBiZSB0aGUgcm9vdCBvZiB0aGUgc2VydmVyLiBUaGlzIHJlc29sdmVkIGJhc2UgaHJlZiBhbmRcbiAqIGRlcGxveSBVUkwgZnJvbSB0aGUgYnJvd3NlciBvcHRpb25zIGFuZCByZXR1cm5zIGEgcGF0aCBmcm9tIHRoZSByb290LlxuICogQHBhcmFtIHNlcnZlck9wdGlvbnMgVGhlIHNlcnZlciBvcHRpb25zIHRoYXQgd2VyZSBwYXNzZWQgdG8gdGhlIHNlcnZlciBidWlsZGVyLlxuICogQHBhcmFtIGJyb3dzZXJPcHRpb25zIFRoZSBicm93c2VyIG9wdGlvbnMgdGhhdCB3ZXJlIHBhc3NlZCB0byB0aGUgYnJvd3NlciBidWlsZGVyLlxuICogQHBhcmFtIGxvZ2dlciBBIGdlbmVyaWMgbG9nZ2VyIHRvIHVzZSBmb3Igc2hvd2luZyB3YXJuaW5ncy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkU2VydmVQYXRoKFxuICBzZXJ2ZXJPcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyU2NoZW1hLFxuICBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXJBcGksXG4pOiBzdHJpbmcge1xuICBsZXQgc2VydmVQYXRoID0gc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGg7XG4gIGlmICghc2VydmVQYXRoICYmIHNlcnZlUGF0aCAhPT0gJycpIHtcbiAgICBjb25zdCBkZWZhdWx0UGF0aCA9IF9maW5kRGVmYXVsdFNlcnZlUGF0aChicm93c2VyT3B0aW9ucy5iYXNlSHJlZiwgYnJvd3Nlck9wdGlvbnMuZGVwbG95VXJsKTtcbiAgICBjb25zdCBzaG93V2FybmluZyA9IHNlcnZlck9wdGlvbnMuc2VydmVQYXRoRGVmYXVsdFdhcm5pbmc7XG4gICAgaWYgKGRlZmF1bHRQYXRoID09IG51bGwgJiYgc2hvd1dhcm5pbmcpIHtcbiAgICAgIGxvZ2dlci53YXJuKHRhZ3Mub25lTGluZWBcbiAgICAgICAgV0FSTklORzogLS1kZXBsb3ktdXJsIGFuZC9vciAtLWJhc2UtaHJlZiBjb250YWluIHVuc3VwcG9ydGVkIHZhbHVlcyBmb3Igbmcgc2VydmUuIERlZmF1bHRcbiAgICAgICAgc2VydmUgcGF0aCBvZiAnLycgdXNlZC4gVXNlIC0tc2VydmUtcGF0aCB0byBvdmVycmlkZS5cbiAgICAgIGApO1xuICAgIH1cbiAgICBzZXJ2ZVBhdGggPSBkZWZhdWx0UGF0aCB8fCAnJztcbiAgfVxuICBpZiAoc2VydmVQYXRoLmVuZHNXaXRoKCcvJykpIHtcbiAgICBzZXJ2ZVBhdGggPSBzZXJ2ZVBhdGguc3Vic3RyKDAsIHNlcnZlUGF0aC5sZW5ndGggLSAxKTtcbiAgfVxuICBpZiAoIXNlcnZlUGF0aC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICBzZXJ2ZVBhdGggPSBgLyR7c2VydmVQYXRofWA7XG4gIH1cblxuICByZXR1cm4gc2VydmVQYXRoO1xufVxuXG4vKipcbiAqIFByaXZhdGUgbWV0aG9kIHRvIGVuaGFuY2UgYSB3ZWJwYWNrIGNvbmZpZyB3aXRoIGxpdmUgcmVsb2FkIGNvbmZpZ3VyYXRpb24uXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfYWRkTGl2ZVJlbG9hZChcbiAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlclNjaGVtYSxcbiAgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICB3ZWJwYWNrQ29uZmlnOiB3ZWJwYWNrLkNvbmZpZ3VyYXRpb24sXG4gIGNsaWVudEFkZHJlc3M6IHN0cmluZyxcbiAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSxcbikge1xuICBpZiAod2VicGFja0NvbmZpZy5wbHVnaW5zID09PSB1bmRlZmluZWQpIHtcbiAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMgPSBbXTtcbiAgfVxuXG4gIC8vIFRoaXMgYWxsb3dzIGZvciBsaXZlIHJlbG9hZCBvZiBwYWdlIHdoZW4gY2hhbmdlcyBhcmUgbWFkZSB0byByZXBvLlxuICAvLyBodHRwczovL3dlYnBhY2suanMub3JnL2NvbmZpZ3VyYXRpb24vZGV2LXNlcnZlci8jZGV2c2VydmVyLWlubGluZVxuICBsZXQgd2VicGFja0RldlNlcnZlclBhdGg7XG4gIHRyeSB7XG4gICAgd2VicGFja0RldlNlcnZlclBhdGggPSByZXF1aXJlLnJlc29sdmUoJ3dlYnBhY2stZGV2LXNlcnZlci9jbGllbnQnKTtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgXCJ3ZWJwYWNrLWRldi1zZXJ2ZXJcIiBwYWNrYWdlIGNvdWxkIG5vdCBiZSBmb3VuZC4nKTtcbiAgfVxuICBjb25zdCBlbnRyeVBvaW50cyA9IFtgJHt3ZWJwYWNrRGV2U2VydmVyUGF0aH0/JHtjbGllbnRBZGRyZXNzfWBdO1xuICBpZiAob3B0aW9ucy5obXIpIHtcbiAgICBjb25zdCB3ZWJwYWNrSG1yTGluayA9ICdodHRwczovL3dlYnBhY2suanMub3JnL2d1aWRlcy9ob3QtbW9kdWxlLXJlcGxhY2VtZW50JztcblxuICAgIGxvZ2dlci53YXJuKFxuICAgICAgdGFncy5vbmVMaW5lYE5PVElDRTogSG90IE1vZHVsZSBSZXBsYWNlbWVudCAoSE1SKSBpcyBlbmFibGVkIGZvciB0aGUgZGV2IHNlcnZlci5gKTtcblxuICAgIGNvbnN0IHNob3dXYXJuaW5nID0gb3B0aW9ucy5obXJXYXJuaW5nO1xuICAgIGlmIChzaG93V2FybmluZykge1xuICAgICAgbG9nZ2VyLmluZm8odGFncy5zdHJpcEluZGVudHNgXG4gICAgICAgICAgVGhlIHByb2plY3Qgd2lsbCBzdGlsbCBsaXZlIHJlbG9hZCB3aGVuIEhNUiBpcyBlbmFibGVkLFxuICAgICAgICAgIGJ1dCB0byB0YWtlIGFkdmFudGFnZSBvZiBITVIgYWRkaXRpb25hbCBhcHBsaWNhdGlvbiBjb2RlIGlzIHJlcXVpcmVkJ1xuICAgICAgICAgIChub3QgaW5jbHVkZWQgaW4gYW4gQW5ndWxhciBDTEkgcHJvamVjdCBieSBkZWZhdWx0KS4nXG4gICAgICAgICAgU2VlICR7d2VicGFja0htckxpbmt9XG4gICAgICAgICAgZm9yIGluZm9ybWF0aW9uIG9uIHdvcmtpbmcgd2l0aCBITVIgZm9yIFdlYnBhY2suYCxcbiAgICAgICk7XG4gICAgICBsb2dnZXIud2FybihcbiAgICAgICAgdGFncy5vbmVMaW5lYFRvIGRpc2FibGUgdGhpcyB3YXJuaW5nIHVzZSBcImhtcldhcm5pbmc6IGZhbHNlXCIgdW5kZXIgXCJzZXJ2ZVwiXG4gICAgICAgICAgIG9wdGlvbnMgaW4gXCJhbmd1bGFyLmpzb25cIi5gLFxuICAgICAgKTtcbiAgICB9XG4gICAgZW50cnlQb2ludHMucHVzaCgnd2VicGFjay9ob3QvZGV2LXNlcnZlcicpO1xuICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy5wdXNoKG5ldyB3ZWJwYWNrLkhvdE1vZHVsZVJlcGxhY2VtZW50UGx1Z2luKCkpO1xuICAgIGlmIChicm93c2VyT3B0aW9ucy5leHRyYWN0Q3NzKSB7XG4gICAgICBsb2dnZXIud2Fybih0YWdzLm9uZUxpbmVgTk9USUNFOiAoSE1SKSBkb2VzIG5vdCBhbGxvdyBmb3IgQ1NTIGhvdCByZWxvYWRcbiAgICAgICAgICAgICAgICB3aGVuIHVzZWQgdG9nZXRoZXIgd2l0aCAnLS1leHRyYWN0LWNzcycuYCk7XG4gICAgfVxuICB9XG4gIGlmICh0eXBlb2Ygd2VicGFja0NvbmZpZy5lbnRyeSAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheSh3ZWJwYWNrQ29uZmlnLmVudHJ5KSkge1xuICAgIHdlYnBhY2tDb25maWcuZW50cnkgPSB7fSBhcyB3ZWJwYWNrLkVudHJ5O1xuICB9XG4gIGlmICghQXJyYXkuaXNBcnJheSh3ZWJwYWNrQ29uZmlnLmVudHJ5Lm1haW4pKSB7XG4gICAgd2VicGFja0NvbmZpZy5lbnRyeS5tYWluID0gW107XG4gIH1cbiAgd2VicGFja0NvbmZpZy5lbnRyeS5tYWluLnVuc2hpZnQoLi4uZW50cnlQb2ludHMpO1xufVxuXG4vKipcbiAqIFByaXZhdGUgbWV0aG9kIHRvIGVuaGFuY2UgYSB3ZWJwYWNrIGNvbmZpZyB3aXRoIFNTTCBjb25maWd1cmF0aW9uLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX2FkZFNzbENvbmZpZyhcbiAgcm9vdDogc3RyaW5nLFxuICBvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyU2NoZW1hLFxuICBjb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXIuQ29uZmlndXJhdGlvbixcbikge1xuICBsZXQgc3NsS2V5OiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGxldCBzc2xDZXJ0OiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGlmIChvcHRpb25zLnNzbEtleSkge1xuICAgIGNvbnN0IGtleVBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgb3B0aW9ucy5zc2xLZXkpO1xuICAgIGlmIChleGlzdHNTeW5jKGtleVBhdGgpKSB7XG4gICAgICBzc2xLZXkgPSByZWFkRmlsZVN5bmMoa2V5UGF0aCwgJ3V0Zi04Jyk7XG4gICAgfVxuICB9XG4gIGlmIChvcHRpb25zLnNzbENlcnQpIHtcbiAgICBjb25zdCBjZXJ0UGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBvcHRpb25zLnNzbENlcnQpO1xuICAgIGlmIChleGlzdHNTeW5jKGNlcnRQYXRoKSkge1xuICAgICAgc3NsQ2VydCA9IHJlYWRGaWxlU3luYyhjZXJ0UGF0aCwgJ3V0Zi04Jyk7XG4gICAgfVxuICB9XG5cbiAgY29uZmlnLmh0dHBzID0gdHJ1ZTtcbiAgaWYgKHNzbEtleSAhPSBudWxsICYmIHNzbENlcnQgIT0gbnVsbCkge1xuICAgIGNvbmZpZy5odHRwcyA9IHtcbiAgICAgIGtleTogc3NsS2V5LFxuICAgICAgY2VydDogc3NsQ2VydCxcbiAgICB9O1xuICB9XG59XG5cbi8qKlxuICogUHJpdmF0ZSBtZXRob2QgdG8gZW5oYW5jZSBhIHdlYnBhY2sgY29uZmlnIHdpdGggUHJveHkgY29uZmlndXJhdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9hZGRQcm94eUNvbmZpZyhcbiAgcm9vdDogc3RyaW5nLFxuICBvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyU2NoZW1hLFxuICBjb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXIuQ29uZmlndXJhdGlvbixcbikge1xuICBsZXQgcHJveHlDb25maWcgPSB7fTtcbiAgY29uc3QgcHJveHlQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIG9wdGlvbnMucHJveHlDb25maWcgYXMgc3RyaW5nKTtcbiAgaWYgKGV4aXN0c1N5bmMocHJveHlQYXRoKSkge1xuICAgIHByb3h5Q29uZmlnID0gcmVxdWlyZShwcm94eVBhdGgpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSAnUHJveHkgY29uZmlnIGZpbGUgJyArIHByb3h5UGF0aCArICcgZG9lcyBub3QgZXhpc3QuJztcbiAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gIH1cbiAgY29uZmlnLnByb3h5ID0gcHJveHlDb25maWc7XG59XG5cbi8qKlxuICogRmluZCB0aGUgZGVmYXVsdCBzZXJ2ZXIgcGF0aC4gV2UgZG9uJ3Qgd2FudCB0byBleHBvc2UgYmFzZUhyZWYgYW5kIGRlcGxveVVybCBhcyBhcmd1bWVudHMsIG9ubHlcbiAqIHRoZSBicm93c2VyIG9wdGlvbnMgd2hlcmUgbmVlZGVkLiBUaGlzIG1ldGhvZCBzaG91bGQgc3RheSBwcml2YXRlIChwZW9wbGUgd2hvIHdhbnQgdG8gcmVzb2x2ZVxuICogYmFzZUhyZWYgYW5kIGRlcGxveVVybCBzaG91bGQgdXNlIHRoZSBidWlsZFNlcnZlUGF0aCBleHBvcnRlZCBmdW5jdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9maW5kRGVmYXVsdFNlcnZlUGF0aChiYXNlSHJlZj86IHN0cmluZywgZGVwbG95VXJsPzogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gIGlmICghYmFzZUhyZWYgJiYgIWRlcGxveVVybCkge1xuICAgIHJldHVybiAnJztcbiAgfVxuXG4gIGlmICgvXihcXHcrOik/XFwvXFwvLy50ZXN0KGJhc2VIcmVmIHx8ICcnKSB8fCAvXihcXHcrOik/XFwvXFwvLy50ZXN0KGRlcGxveVVybCB8fCAnJykpIHtcbiAgICAvLyBJZiBiYXNlSHJlZiBvciBkZXBsb3lVcmwgaXMgYWJzb2x1dGUsIHVuc3VwcG9ydGVkIGJ5IG5nIHNlcnZlXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBub3JtYWxpemUgYmFzZUhyZWZcbiAgLy8gZm9yIG5nIHNlcnZlIHRoZSBzdGFydGluZyBiYXNlIGlzIGFsd2F5cyBgL2Agc28gYSByZWxhdGl2ZVxuICAvLyBhbmQgcm9vdCByZWxhdGl2ZSB2YWx1ZSBhcmUgaWRlbnRpY2FsXG4gIGNvbnN0IGJhc2VIcmVmUGFydHMgPSAoYmFzZUhyZWYgfHwgJycpXG4gICAgLnNwbGl0KCcvJylcbiAgICAuZmlsdGVyKHBhcnQgPT4gcGFydCAhPT0gJycpO1xuICBpZiAoYmFzZUhyZWYgJiYgIWJhc2VIcmVmLmVuZHNXaXRoKCcvJykpIHtcbiAgICBiYXNlSHJlZlBhcnRzLnBvcCgpO1xuICB9XG4gIGNvbnN0IG5vcm1hbGl6ZWRCYXNlSHJlZiA9IGJhc2VIcmVmUGFydHMubGVuZ3RoID09PSAwID8gJy8nIDogYC8ke2Jhc2VIcmVmUGFydHMuam9pbignLycpfS9gO1xuXG4gIGlmIChkZXBsb3lVcmwgJiYgZGVwbG95VXJsWzBdID09PSAnLycpIHtcbiAgICBpZiAoYmFzZUhyZWYgJiYgYmFzZUhyZWZbMF0gPT09ICcvJyAmJiBub3JtYWxpemVkQmFzZUhyZWYgIT09IGRlcGxveVVybCkge1xuICAgICAgLy8gSWYgYmFzZUhyZWYgYW5kIGRlcGxveVVybCBhcmUgcm9vdCByZWxhdGl2ZSBhbmQgbm90IGVxdWl2YWxlbnQsIHVuc3VwcG9ydGVkIGJ5IG5nIHNlcnZlXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVwbG95VXJsO1xuICB9XG5cbiAgLy8gSm9pbiB0b2dldGhlciBiYXNlSHJlZiBhbmQgZGVwbG95VXJsXG4gIHJldHVybiBgJHtub3JtYWxpemVkQmFzZUhyZWZ9JHtkZXBsb3lVcmwgfHwgJyd9YDtcbn1cblxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyPERldlNlcnZlckJ1aWxkZXJTY2hlbWEsIERldlNlcnZlckJ1aWxkZXJPdXRwdXQ+KHNlcnZlV2VicGFja0Jyb3dzZXIpO1xuIl19