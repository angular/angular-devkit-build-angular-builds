"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular-devkit/core");
const fs_1 = require("fs");
const path = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const url = require("url");
const webpack = require("webpack");
const utils_1 = require("../angular-cli-files/models/webpack-configs/utils");
const check_port_1 = require("../angular-cli-files/utilities/check-port");
const stats_1 = require("../angular-cli-files/utilities/stats");
const _1 = require("../browser/");
const utils_2 = require("../utils");
const opn = require('opn');
const WebpackDevServer = require('webpack-dev-server');
class DevServerBuilder {
    constructor(context) {
        this.context = context;
    }
    run(builderConfig) {
        const options = builderConfig.options;
        const root = this.context.workspace.root;
        const projectRoot = core_1.resolve(root, builderConfig.root);
        const host = new core_1.virtualFs.AliasHost(this.context.host);
        let browserOptions;
        return check_port_1.checkPort(options.port, options.host).pipe(operators_1.tap((port) => options.port = port), operators_1.concatMap(() => this._getBrowserOptions(options)), operators_1.tap((opts) => browserOptions = opts), operators_1.concatMap(() => utils_2.addFileReplacements(root, host, browserOptions.fileReplacements)), operators_1.concatMap(() => new rxjs_1.Observable(obs => {
            const browserBuilder = new _1.BrowserBuilder(this.context);
            const webpackConfig = browserBuilder.buildWebpackConfig(root, projectRoot, host, browserOptions);
            const webpackCompiler = webpack(webpackConfig);
            const statsConfig = utils_1.getWebpackStatsConfig(browserOptions.verbose);
            let webpackDevServerConfig;
            try {
                webpackDevServerConfig = this._buildServerConfig(root, projectRoot, options, browserOptions);
            }
            catch (err) {
                obs.error(err);
                return;
            }
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
                port: options.port.toString(),
            });
            // Add live reload config.
            if (options.liveReload) {
                this._addLiveReload(options, browserOptions, webpackConfig, clientAddress);
            }
            else if (options.hmr) {
                this.context.logger.warn('Live reload is disabled. HMR option ignored.');
            }
            if (!options.watch) {
                // There's no option to turn off file watching in webpack-dev-server, but
                // we can override the file watcher instead.
                webpackConfig.plugins.unshift({
                    // tslint:disable-next-line:no-any
                    apply: (compiler) => {
                        compiler.hooks.afterEnvironment.tap('angular-cli', () => {
                            compiler.watchFileSystem = { watch: () => { } };
                        });
                    },
                });
            }
            if (browserOptions.optimization) {
                this.context.logger.error(core_1.tags.stripIndents `
            ****************************************************************************************
            This is a simple server for use in testing or debugging Angular applications locally.
            It hasn't been reviewed for security issues.

            DON'T USE IT FOR PRODUCTION!
            ****************************************************************************************
          `);
            }
            this.context.logger.info(core_1.tags.oneLine `
          **
          Angular Live Development Server is listening on ${options.host}:
          ${options.port}, open your browser on ${serverAddress}${webpackDevServerConfig.publicPath}
          **
        `);
            const server = new WebpackDevServer(webpackCompiler, webpackDevServerConfig);
            let first = true;
            // tslint:disable-next-line:no-any
            webpackCompiler.hooks.done.tap('angular-cli', (stats) => {
                if (!browserOptions.verbose) {
                    const json = stats.toJson(statsConfig);
                    this.context.logger.info(stats_1.statsToString(json, statsConfig));
                    if (stats.hasWarnings()) {
                        this.context.logger.info(stats_1.statsWarningsToString(json, statsConfig));
                    }
                    if (stats.hasErrors()) {
                        this.context.logger.info(stats_1.statsErrorsToString(json, statsConfig));
                    }
                }
                obs.next({ success: true });
                if (first && options.open) {
                    first = false;
                    opn(serverAddress + webpackDevServerConfig.publicPath);
                }
            });
            const httpServer = server.listen(options.port, options.host, (err) => {
                if (err) {
                    obs.error(err);
                }
            });
            // Node 8 has a keepAliveTimeout bug which doesn't respect active connections.
            // Connections will end after ~5 seconds (arbitrary), often not letting the full download
            // of large pieces of content, such as a vendor javascript file.  This results in browsers
            // throwing a "net::ERR_CONTENT_LENGTH_MISMATCH" error.
            // https://github.com/angular/angular-cli/issues/7197
            // https://github.com/nodejs/node/issues/13391
            // https://github.com/nodejs/node/commit/2cb6f2b281eb96a7abe16d58af6ebc9ce23d2e96
            if (/^v8.\d.\d+$/.test(process.version)) {
                httpServer.keepAliveTimeout = 30000; // 30 seconds
            }
            // Teardown logic. Close the server when unsubscribed from.
            return () => server.close();
        })));
    }
    _buildServerConfig(root, projectRoot, options, browserOptions) {
        const systemRoot = core_1.getSystemPath(root);
        if (options.disableHostCheck) {
            this.context.logger.warn(core_1.tags.oneLine `
        WARNING: Running a server with --disable-host-check is a security risk.
        See https://medium.com/webpack/webpack-dev-server-middleware-security-issues-1489d950874a
        for more information.
      `);
        }
        const servePath = this._buildServePath(options, browserOptions);
        const config = {
            headers: { 'Access-Control-Allow-Origin': '*' },
            historyApiFallback: {
                index: `${servePath}/${path.basename(browserOptions.index)}`,
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
            },
            stats: browserOptions.verbose ? utils_1.getWebpackStatsConfig(browserOptions.verbose) : false,
            compress: browserOptions.optimization,
            watchOptions: {
                poll: browserOptions.poll,
            },
            https: options.ssl,
            overlay: {
                errors: !browserOptions.optimization,
                warnings: false,
            },
            contentBase: false,
            public: options.publicHost,
            disableHostCheck: options.disableHostCheck,
            publicPath: servePath,
            hot: options.hmr,
        };
        if (options.ssl) {
            this._addSslConfig(systemRoot, options, config);
        }
        if (options.proxyConfig) {
            this._addProxyConfig(systemRoot, options, config);
        }
        return config;
    }
    _addLiveReload(options, browserOptions, webpackConfig, // tslint:disable-line:no-any
    clientAddress) {
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
            this.context.logger.warn(core_1.tags.oneLine `NOTICE: Hot Module Replacement (HMR) is enabled for the dev server.`);
            const showWarning = options.hmrWarning;
            if (showWarning) {
                this.context.logger.info(core_1.tags.stripIndents `
          The project will still live reload when HMR is enabled,
          but to take advantage of HMR additional application code is required'
          (not included in an Angular CLI project by default).'
          See ${webpackHmrLink}
          for information on working with HMR for Webpack.`);
                this.context.logger.warn(core_1.tags.oneLine `To disable this warning use "ng set warnings.hmrWarning=false".`);
            }
            entryPoints.push('webpack/hot/dev-server');
            webpackConfig.plugins.push(new webpack.HotModuleReplacementPlugin());
            if (browserOptions.extractCss) {
                this.context.logger.warn(core_1.tags.oneLine `NOTICE: (HMR) does not allow for CSS hot reload
                when used together with '--extract-css'.`);
            }
        }
        if (!webpackConfig.entry.main) {
            webpackConfig.entry.main = [];
        }
        webpackConfig.entry.main.unshift(...entryPoints);
    }
    _addSslConfig(root, options, config) {
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
            config.key = sslKey;
            config.cert = sslCert;
        }
    }
    _addProxyConfig(root, options, config) {
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
    _buildServePath(options, browserOptions) {
        let servePath = options.servePath;
        if (!servePath && servePath !== '') {
            const defaultServePath = this._findDefaultServePath(browserOptions.baseHref, browserOptions.deployUrl);
            const showWarning = options.servePathDefaultWarning;
            if (defaultServePath == null && showWarning) {
                this.context.logger.warn(core_1.tags.oneLine `
            WARNING: --deploy-url and/or --base-href contain
            unsupported values for ng serve.  Default serve path of '/' used.
            Use --serve-path to override.
          `);
            }
            servePath = defaultServePath || '';
        }
        if (servePath.endsWith('/')) {
            servePath = servePath.substr(0, servePath.length - 1);
        }
        if (!servePath.startsWith('/')) {
            servePath = `/${servePath}`;
        }
        return servePath;
    }
    _findDefaultServePath(baseHref, deployUrl) {
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
    _getBrowserOptions(options) {
        const architect = this.context.architect;
        const [project, target, configuration] = options.browserTarget.split(':');
        // Override browser build watch setting.
        const overrides = { watch: options.watch };
        const browserTargetSpec = { project, target, configuration, overrides };
        const builderConfig = architect.getBuilderConfiguration(browserTargetSpec);
        return architect.getBuilderDescription(builderConfig).pipe(operators_1.concatMap(browserDescription => architect.validateBuilderOptions(builderConfig, browserDescription)), operators_1.map(browserConfig => browserConfig.options));
    }
}
exports.DevServerBuilder = DevServerBuilder;
exports.default = DevServerBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2Rldi1zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFRSCwrQ0FBcUY7QUFDckYsMkJBQThDO0FBRTlDLDZCQUE2QjtBQUM3QiwrQkFBa0M7QUFDbEMsOENBQXFEO0FBQ3JELDJCQUEyQjtBQUMzQixtQ0FBbUM7QUFDbkMsNkVBQTBGO0FBQzFGLDBFQUFzRTtBQUN0RSxnRUFJOEM7QUFDOUMsa0NBQTZDO0FBRTdDLG9DQUErQztBQUMvQyxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDM0IsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQztBQWdEdkQ7SUFFRSxZQUFtQixPQUF1QjtRQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtJQUFJLENBQUM7SUFFL0MsR0FBRyxDQUFDLGFBQTREO1FBQzlELE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7UUFDdEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3pDLE1BQU0sV0FBVyxHQUFHLGNBQU8sQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELE1BQU0sSUFBSSxHQUFHLElBQUksZ0JBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFnQyxDQUFDLENBQUM7UUFDcEYsSUFBSSxjQUFvQyxDQUFDO1FBRXpDLE1BQU0sQ0FBQyxzQkFBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FDL0MsZUFBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMs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QztRQUN4QyxNQUFNLFNBQVMsR0FBRyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDM0MsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLFNBQVMsRUFBRSxDQUFDO1FBQ3hFLE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQyx1QkFBdUIsQ0FDckQsaUJBQWlCLENBQUMsQ0FBQztRQUVyQixNQUFNLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FDeEQscUJBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLENBQzdCLFNBQVMsQ0FBQyxzQkFBc0IsQ0FBQyxhQUFhLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxFQUN0RSxlQUFHLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQzVDLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFoV0QsNENBZ1dDO0FBR0Qsa0JBQWUsZ0JBQWdCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnQsXG4gIEJ1aWxkZXIsXG4gIEJ1aWxkZXJDb25maWd1cmF0aW9uLFxuICBCdWlsZGVyQ29udGV4dCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBQYXRoLCBnZXRTeXN0ZW1QYXRoLCByZXNvbHZlLCB0YWdzLCB2aXJ0dWFsRnMgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBleGlzdHNTeW5jLCByZWFkRmlsZVN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAsIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHVybCBmcm9tICd1cmwnO1xuaW1wb3J0ICogYXMgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IGdldFdlYnBhY2tTdGF0c0NvbmZpZyB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL21vZGVscy93ZWJwYWNrLWNvbmZpZ3MvdXRpbHMnO1xuaW1wb3J0IHsgY2hlY2tQb3J0IH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL2NoZWNrLXBvcnQnO1xuaW1wb3J0IHtcbiAgc3RhdHNFcnJvcnNUb1N0cmluZyxcbiAgc3RhdHNUb1N0cmluZyxcbiAgc3RhdHNXYXJuaW5nc1RvU3RyaW5nLFxufSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvc3RhdHMnO1xuaW1wb3J0IHsgQnJvd3NlckJ1aWxkZXIgfSBmcm9tICcuLi9icm93c2VyLyc7XG5pbXBvcnQgeyBCcm93c2VyQnVpbGRlclNjaGVtYSB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IGFkZEZpbGVSZXBsYWNlbWVudHMgfSBmcm9tICcuLi91dGlscyc7XG5jb25zdCBvcG4gPSByZXF1aXJlKCdvcG4nKTtcbmNvbnN0IFdlYnBhY2tEZXZTZXJ2ZXIgPSByZXF1aXJlKCd3ZWJwYWNrLWRldi1zZXJ2ZXInKTtcblxuXG5leHBvcnQgaW50ZXJmYWNlIERldlNlcnZlckJ1aWxkZXJPcHRpb25zIHtcbiAgYnJvd3NlclRhcmdldDogc3RyaW5nO1xuICBwb3J0OiBudW1iZXI7XG4gIGhvc3Q6IHN0cmluZztcbiAgcHJveHlDb25maWc/OiBzdHJpbmc7XG4gIHNzbDogYm9vbGVhbjtcbiAgc3NsS2V5Pzogc3RyaW5nO1xuICBzc2xDZXJ0Pzogc3RyaW5nO1xuICBvcGVuOiBib29sZWFuO1xuICBsaXZlUmVsb2FkOiBib29sZWFuO1xuICBwdWJsaWNIb3N0Pzogc3RyaW5nO1xuICBzZXJ2ZVBhdGg/OiBzdHJpbmc7XG4gIGRpc2FibGVIb3N0Q2hlY2s6IGJvb2xlYW47XG4gIGhtcjogYm9vbGVhbjtcbiAgd2F0Y2g6IGJvb2xlYW47XG4gIGhtcldhcm5pbmc6IGJvb2xlYW47XG4gIHNlcnZlUGF0aERlZmF1bHRXYXJuaW5nOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgV2VicGFja0RldlNlcnZlckNvbmZpZ3VyYXRpb25PcHRpb25zIHtcbiAgY29udGVudEJhc2U/OiBib29sZWFuIHwgc3RyaW5nIHwgc3RyaW5nW107XG4gIGhvdD86IGJvb2xlYW47XG4gIGhpc3RvcnlBcGlGYWxsYmFjaz86IHsgW2tleTogc3RyaW5nXTogYW55IH0gfCBib29sZWFuOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuICBjb21wcmVzcz86IGJvb2xlYW47XG4gIHByb3h5PzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfTtcbiAgc3RhdGljT3B0aW9ucz86IGFueTsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1hbnlcbiAgcXVpZXQ/OiBib29sZWFuO1xuICBub0luZm8/OiBib29sZWFuO1xuICBsYXp5PzogYm9vbGVhbjtcbiAgZmlsZW5hbWU/OiBzdHJpbmc7XG4gIHdhdGNoT3B0aW9ucz86IHtcbiAgICBhZ2dyZWdhdGVUaW1lb3V0PzogbnVtYmVyO1xuICAgIHBvbGw/OiBudW1iZXI7XG4gIH07XG4gIHB1YmxpY1BhdGg/OiBzdHJpbmc7XG4gIGhlYWRlcnM/OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9O1xuICBzdGF0cz86IHsgW2tleTogc3RyaW5nXTogYm9vbGVhbiB9IHwgc3RyaW5nIHwgYm9vbGVhbjtcbiAgaHR0cHM/OiBib29sZWFuO1xuICBrZXk/OiBzdHJpbmc7XG4gIGNlcnQ/OiBzdHJpbmc7XG4gIG92ZXJsYXk/OiBib29sZWFuIHwgeyBlcnJvcnM6IGJvb2xlYW4sIHdhcm5pbmdzOiBib29sZWFuIH07XG4gIHB1YmxpYz86IHN0cmluZztcbiAgZGlzYWJsZUhvc3RDaGVjaz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBEZXZTZXJ2ZXJCdWlsZGVyIGltcGxlbWVudHMgQnVpbGRlcjxEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucz4ge1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkgeyB9XG5cbiAgcnVuKGJ1aWxkZXJDb25maWc6IEJ1aWxkZXJDb25maWd1cmF0aW9uPERldlNlcnZlckJ1aWxkZXJPcHRpb25zPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnM7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdDtcbiAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5yb290KTtcbiAgICBjb25zdCBob3N0ID0gbmV3IHZpcnR1YWxGcy5BbGlhc0hvc3QodGhpcy5jb250ZXh0Lmhvc3QgYXMgdmlydHVhbEZzLkhvc3Q8ZnMuU3RhdHM+KTtcbiAgICBsZXQgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hO1xuXG4gICAgcmV0dXJuIGNoZWNrUG9ydChvcHRpb25zLnBvcnQsIG9wdGlvbnMuaG9zdCkucGlwZShcbiAgICAgIHRhcCgocG9ydCkgPT4gb3B0aW9ucy5wb3J0ID0gcG9ydCksXG4gICAgICBjb25jYXRNYXAoKCkgPT4gdGhpcy5fZ2V0QnJvd3Nlck9wdGlvbnMob3B0aW9ucykpLFxuICAgICAgdGFwKChvcHRzKSA9PiBicm93c2VyT3B0aW9ucyA9IG9wdHMpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IGFkZEZpbGVSZXBsYWNlbWVudHMocm9vdCwgaG9zdCwgYnJvd3Nlck9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IG5ldyBPYnNlcnZhYmxlKG9icyA9PiB7XG4gICAgICAgIGNvbnN0IGJyb3dzZXJCdWlsZGVyID0gbmV3IEJyb3dzZXJCdWlsZGVyKHRoaXMuY29udGV4dCk7XG4gICAgICAgIGNvbnN0IHdlYnBhY2tDb25maWcgPSBicm93c2VyQnVpbGRlci5idWlsZFdlYnBhY2tDb25maWcoXG4gICAgICAgICAgcm9vdCwgcHJvamVjdFJvb3QsIGhvc3QsIGJyb3dzZXJPcHRpb25zKTtcbiAgICAgICAgY29uc3Qgd2VicGFja0NvbXBpbGVyID0gd2VicGFjayh3ZWJwYWNrQ29uZmlnKTtcbiAgICAgICAgY29uc3Qgc3RhdHNDb25maWcgPSBnZXRXZWJwYWNrU3RhdHNDb25maWcoYnJvd3Nlck9wdGlvbnMudmVyYm9zZSk7XG5cbiAgICAgICAgbGV0IHdlYnBhY2tEZXZTZXJ2ZXJDb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXJDb25maWd1cmF0aW9uT3B0aW9ucztcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB3ZWJwYWNrRGV2U2VydmVyQ29uZmlnID0gdGhpcy5fYnVpbGRTZXJ2ZXJDb25maWcoXG4gICAgICAgICAgICByb290LCBwcm9qZWN0Um9vdCwgb3B0aW9ucywgYnJvd3Nlck9wdGlvbnMpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBvYnMuZXJyb3IoZXJyKTtcblxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc29sdmUgcHVibGljIGhvc3QgYW5kIGNsaWVudCBhZGRyZXNzLlxuICAgICAgICBsZXQgY2xpZW50QWRkcmVzcyA9IGAke29wdGlvbnMuc3NsID8gJ2h0dHBzJyA6ICdodHRwJ306Ly8wLjAuMC4wOjBgO1xuICAgICAgICBpZiAob3B0aW9ucy5wdWJsaWNIb3N0KSB7XG4gICAgICAgICAgbGV0IHB1YmxpY0hvc3QgPSBvcHRpb25zLnB1YmxpY0hvc3Q7XG4gICAgICAgICAgaWYgKCEvXlxcdys6XFwvXFwvLy50ZXN0KHB1YmxpY0hvc3QpKSB7XG4gICAgICAgICAgICBwdWJsaWNIb3N0ID0gYCR7b3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnfTovLyR7cHVibGljSG9zdH1gO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBjbGllbnRVcmwgPSB1cmwucGFyc2UocHVibGljSG9zdCk7XG4gICAgICAgICAgb3B0aW9ucy5wdWJsaWNIb3N0ID0gY2xpZW50VXJsLmhvc3Q7XG4gICAgICAgICAgY2xpZW50QWRkcmVzcyA9IHVybC5mb3JtYXQoY2xpZW50VXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc29sdmUgc2VydmUgYWRkcmVzcy5cbiAgICAgICAgY29uc3Qgc2VydmVyQWRkcmVzcyA9IHVybC5mb3JtYXQoe1xuICAgICAgICAgIHByb3RvY29sOiBvcHRpb25zLnNzbCA/ICdodHRwcycgOiAnaHR0cCcsXG4gICAgICAgICAgaG9zdG5hbWU6IG9wdGlvbnMuaG9zdCA9PT0gJzAuMC4wLjAnID8gJ2xvY2FsaG9zdCcgOiBvcHRpb25zLmhvc3QsXG4gICAgICAgICAgcG9ydDogb3B0aW9ucy5wb3J0LnRvU3RyaW5nKCksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZCBsaXZlIHJlbG9hZCBjb25maWcuXG4gICAgICAgIGlmIChvcHRpb25zLmxpdmVSZWxvYWQpIHtcbiAgICAgICAgICB0aGlzLl9hZGRMaXZlUmVsb2FkKG9wdGlvbnMsIGJyb3dzZXJPcHRpb25zLCB3ZWJwYWNrQ29uZmlnLCBjbGllbnRBZGRyZXNzKTtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmhtcikge1xuICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2FybignTGl2ZSByZWxvYWQgaXMgZGlzYWJsZWQuIEhNUiBvcHRpb24gaWdub3JlZC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghb3B0aW9ucy53YXRjaCkge1xuICAgICAgICAgIC8vIFRoZXJlJ3Mgbm8gb3B0aW9uIHRvIHR1cm4gb2ZmIGZpbGUgd2F0Y2hpbmcgaW4gd2VicGFjay1kZXYtc2VydmVyLCBidXRcbiAgICAgICAgICAvLyB3ZSBjYW4gb3ZlcnJpZGUgdGhlIGZpbGUgd2F0Y2hlciBpbnN0ZWFkLlxuICAgICAgICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy51bnNoaWZ0KHtcbiAgICAgICAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICAgICAgICAgIGFwcGx5OiAoY29tcGlsZXI6IGFueSkgPT4ge1xuICAgICAgICAgICAgICBjb21waWxlci5ob29rcy5hZnRlckVudmlyb25tZW50LnRhcCgnYW5ndWxhci1jbGknLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29tcGlsZXIud2F0Y2hGaWxlU3lzdGVtID0geyB3YXRjaDogKCkgPT4geyB9IH07XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24pIHtcbiAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmVycm9yKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgICAgVGhpcyBpcyBhIHNpbXBsZSBzZXJ2ZXIgZm9yIHVzZSBpbiB0ZXN0aW5nIG9yIGRlYnVnZ2luZyBBbmd1bGFyIGFwcGxpY2F0aW9ucyBsb2NhbGx5LlxuICAgICAgICAgICAgSXQgaGFzbid0IGJlZW4gcmV2aWV3ZWQgZm9yIHNlY3VyaXR5IGlzc3Vlcy5cblxuICAgICAgICAgICAgRE9OJ1QgVVNFIElUIEZPUiBQUk9EVUNUSU9OIVxuICAgICAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgIGApO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5pbmZvKHRhZ3Mub25lTGluZWBcbiAgICAgICAgICAqKlxuICAgICAgICAgIEFuZ3VsYXIgTGl2ZSBEZXZlbG9wbWVudCBTZXJ2ZXIgaXMgbGlzdGVuaW5nIG9uICR7b3B0aW9ucy5ob3N0fTpcbiAgICAgICAgICAke29wdGlvbnMucG9ydH0sIG9wZW4geW91ciBicm93c2VyIG9uICR7c2VydmVyQWRkcmVzc30ke3dlYnBhY2tEZXZTZXJ2ZXJDb25maWcucHVibGljUGF0aH1cbiAgICAgICAgICAqKlxuICAgICAgICBgKTtcblxuICAgICAgICBjb25zdCBzZXJ2ZXIgPSBuZXcgV2VicGFja0RldlNlcnZlcih3ZWJwYWNrQ29tcGlsZXIsIHdlYnBhY2tEZXZTZXJ2ZXJDb25maWcpO1xuXG4gICAgICAgIGxldCBmaXJzdCA9IHRydWU7XG4gICAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICAgICAgKHdlYnBhY2tDb21waWxlciBhcyBhbnkpLmhvb2tzLmRvbmUudGFwKCdhbmd1bGFyLWNsaScsIChzdGF0czogd2VicGFjay5TdGF0cykgPT4ge1xuICAgICAgICAgIGlmICghYnJvd3Nlck9wdGlvbnMudmVyYm9zZSkge1xuICAgICAgICAgICAgY29uc3QganNvbiA9IHN0YXRzLnRvSnNvbihzdGF0c0NvbmZpZyk7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmluZm8oc3RhdHNUb1N0cmluZyhqc29uLCBzdGF0c0NvbmZpZykpO1xuICAgICAgICAgICAgaWYgKHN0YXRzLmhhc1dhcm5pbmdzKCkpIHtcbiAgICAgICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5pbmZvKHN0YXRzV2FybmluZ3NUb1N0cmluZyhqc29uLCBzdGF0c0NvbmZpZykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0YXRzLmhhc0Vycm9ycygpKSB7XG4gICAgICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbyhzdGF0c0Vycm9yc1RvU3RyaW5nKGpzb24sIHN0YXRzQ29uZmlnKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIG9icy5uZXh0KHsgc3VjY2VzczogdHJ1ZSB9KTtcblxuICAgICAgICAgIGlmIChmaXJzdCAmJiBvcHRpb25zLm9wZW4pIHtcbiAgICAgICAgICAgIGZpcnN0ID0gZmFsc2U7XG4gICAgICAgICAgICBvcG4oc2VydmVyQWRkcmVzcyArIHdlYnBhY2tEZXZTZXJ2ZXJDb25maWcucHVibGljUGF0aCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBodHRwU2VydmVyID0gc2VydmVyLmxpc3RlbihcbiAgICAgICAgICBvcHRpb25zLnBvcnQsXG4gICAgICAgICAgb3B0aW9ucy5ob3N0LFxuICAgICAgICAgIChlcnI6IGFueSkgPT4geyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICBvYnMuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICApO1xuXG4gICAgICAgIC8vIE5vZGUgOCBoYXMgYSBrZWVwQWxpdmVUaW1lb3V0IGJ1ZyB3aGljaCBkb2Vzbid0IHJlc3BlY3QgYWN0aXZlIGNvbm5lY3Rpb25zLlxuICAgICAgICAvLyBDb25uZWN0aW9ucyB3aWxsIGVuZCBhZnRlciB+NSBzZWNvbmRzIChhcmJpdHJhcnkpLCBvZnRlbiBub3QgbGV0dGluZyB0aGUgZnVsbCBkb3dubG9hZFxuICAgICAgICAvLyBvZiBsYXJnZSBwaWVjZXMgb2YgY29udGVudCwgc3VjaCBhcyBhIHZlbmRvciBqYXZhc2NyaXB0IGZpbGUuICBUaGlzIHJlc3VsdHMgaW4gYnJvd3NlcnNcbiAgICAgICAgLy8gdGhyb3dpbmcgYSBcIm5ldDo6RVJSX0NPTlRFTlRfTEVOR1RIX01JU01BVENIXCIgZXJyb3IuXG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy83MTk3XG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9pc3N1ZXMvMTMzOTFcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2NvbW1pdC8yY2I2ZjJiMjgxZWI5NmE3YWJlMTZkNThhZjZlYmM5Y2UyM2QyZTk2XG4gICAgICAgIGlmICgvXnY4LlxcZC5cXGQrJC8udGVzdChwcm9jZXNzLnZlcnNpb24pKSB7XG4gICAgICAgICAgaHR0cFNlcnZlci5rZWVwQWxpdmVUaW1lb3V0ID0gMzAwMDA7IC8vIDMwIHNlY29uZHNcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRlYXJkb3duIGxvZ2ljLiBDbG9zZSB0aGUgc2VydmVyIHdoZW4gdW5zdWJzY3JpYmVkIGZyb20uXG4gICAgICAgIHJldHVybiAoKSA9PiBzZXJ2ZXIuY2xvc2UoKTtcbiAgICAgIH0pKSk7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFNlcnZlckNvbmZpZyhcbiAgICByb290OiBQYXRoLFxuICAgIHByb2plY3RSb290OiBQYXRoLFxuICAgIG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICAgIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgKSB7XG4gICAgY29uc3Qgc3lzdGVtUm9vdCA9IGdldFN5c3RlbVBhdGgocm9vdCk7XG4gICAgaWYgKG9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjaykge1xuICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKHRhZ3Mub25lTGluZWBcbiAgICAgICAgV0FSTklORzogUnVubmluZyBhIHNlcnZlciB3aXRoIC0tZGlzYWJsZS1ob3N0LWNoZWNrIGlzIGEgc2VjdXJpdHkgcmlzay5cbiAgICAgICAgU2VlIGh0dHBzOi8vbWVkaXVtLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LXNlcnZlci1taWRkbGV3YXJlLXNlY3VyaXR5LWlzc3Vlcy0xNDg5ZDk1MDg3NGFcbiAgICAgICAgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gICAgICBgKTtcbiAgICB9XG5cbiAgICBjb25zdCBzZXJ2ZVBhdGggPSB0aGlzLl9idWlsZFNlcnZlUGF0aChvcHRpb25zLCBicm93c2VyT3B0aW9ucyk7XG5cbiAgICBjb25zdCBjb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXJDb25maWd1cmF0aW9uT3B0aW9ucyA9IHtcbiAgICAgIGhlYWRlcnM6IHsgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyB9LFxuICAgICAgaGlzdG9yeUFwaUZhbGxiYWNrOiB7XG4gICAgICAgIGluZGV4OiBgJHtzZXJ2ZVBhdGh9LyR7cGF0aC5iYXNlbmFtZShicm93c2VyT3B0aW9ucy5pbmRleCl9YCxcbiAgICAgICAgZGlzYWJsZURvdFJ1bGU6IHRydWUsXG4gICAgICAgIGh0bWxBY2NlcHRIZWFkZXJzOiBbJ3RleHQvaHRtbCcsICdhcHBsaWNhdGlvbi94aHRtbCt4bWwnXSxcbiAgICAgIH0sXG4gICAgICBzdGF0czogYnJvd3Nlck9wdGlvbnMudmVyYm9zZSA/IGdldFdlYnBhY2tTdGF0c0NvbmZpZyhicm93c2VyT3B0aW9ucy52ZXJib3NlKSA6IGZhbHNlLFxuICAgICAgY29tcHJlc3M6IGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbixcbiAgICAgIHdhdGNoT3B0aW9uczoge1xuICAgICAgICBwb2xsOiBicm93c2VyT3B0aW9ucy5wb2xsLFxuICAgICAgfSxcbiAgICAgIGh0dHBzOiBvcHRpb25zLnNzbCxcbiAgICAgIG92ZXJsYXk6IHtcbiAgICAgICAgZXJyb3JzOiAhYnJvd3Nlck9wdGlvbnMub3B0aW1pemF0aW9uLFxuICAgICAgICB3YXJuaW5nczogZmFsc2UsXG4gICAgICB9LFxuICAgICAgY29udGVudEJhc2U6IGZhbHNlLFxuICAgICAgcHVibGljOiBvcHRpb25zLnB1YmxpY0hvc3QsXG4gICAgICBkaXNhYmxlSG9zdENoZWNrOiBvcHRpb25zLmRpc2FibGVIb3N0Q2hlY2ssXG4gICAgICBwdWJsaWNQYXRoOiBzZXJ2ZVBhdGgsXG4gICAgICBob3Q6IG9wdGlvbnMuaG1yLFxuICAgIH07XG5cbiAgICBpZiAob3B0aW9ucy5zc2wpIHtcbiAgICAgIHRoaXMuX2FkZFNzbENvbmZpZyhzeXN0ZW1Sb290LCBvcHRpb25zLCBjb25maWcpO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLnByb3h5Q29uZmlnKSB7XG4gICAgICB0aGlzLl9hZGRQcm94eUNvbmZpZyhzeXN0ZW1Sb290LCBvcHRpb25zLCBjb25maWcpO1xuICAgIH1cblxuICAgIHJldHVybiBjb25maWc7XG4gIH1cblxuICBwcml2YXRlIF9hZGRMaXZlUmVsb2FkKFxuICAgIG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICAgIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgICB3ZWJwYWNrQ29uZmlnOiBhbnksIC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8tYW55XG4gICAgY2xpZW50QWRkcmVzczogc3RyaW5nLFxuICApIHtcbiAgICAvLyBUaGlzIGFsbG93cyBmb3IgbGl2ZSByZWxvYWQgb2YgcGFnZSB3aGVuIGNoYW5nZXMgYXJlIG1hZGUgdG8gcmVwby5cbiAgICAvLyBodHRwczovL3dlYnBhY2suanMub3JnL2NvbmZpZ3VyYXRpb24vZGV2LXNlcnZlci8jZGV2c2VydmVyLWlubGluZVxuICAgIGxldCB3ZWJwYWNrRGV2U2VydmVyUGF0aDtcbiAgICB0cnkge1xuICAgICAgd2VicGFja0RldlNlcnZlclBhdGggPSByZXF1aXJlLnJlc29sdmUoJ3dlYnBhY2stZGV2LXNlcnZlci9jbGllbnQnKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIFwid2VicGFjay1kZXYtc2VydmVyXCIgcGFja2FnZSBjb3VsZCBub3QgYmUgZm91bmQuJyk7XG4gICAgfVxuICAgIGNvbnN0IGVudHJ5UG9pbnRzID0gW2Ake3dlYnBhY2tEZXZTZXJ2ZXJQYXRofT8ke2NsaWVudEFkZHJlc3N9YF07XG4gICAgaWYgKG9wdGlvbnMuaG1yKSB7XG4gICAgICBjb25zdCB3ZWJwYWNrSG1yTGluayA9ICdodHRwczovL3dlYnBhY2suanMub3JnL2d1aWRlcy9ob3QtbW9kdWxlLXJlcGxhY2VtZW50JztcblxuICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKFxuICAgICAgICB0YWdzLm9uZUxpbmVgTk9USUNFOiBIb3QgTW9kdWxlIFJlcGxhY2VtZW50IChITVIpIGlzIGVuYWJsZWQgZm9yIHRoZSBkZXYgc2VydmVyLmApO1xuXG4gICAgICBjb25zdCBzaG93V2FybmluZyA9IG9wdGlvbnMuaG1yV2FybmluZztcbiAgICAgIGlmIChzaG93V2FybmluZykge1xuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmluZm8odGFncy5zdHJpcEluZGVudHNgXG4gICAgICAgICAgVGhlIHByb2plY3Qgd2lsbCBzdGlsbCBsaXZlIHJlbG9hZCB3aGVuIEhNUiBpcyBlbmFibGVkLFxuICAgICAgICAgIGJ1dCB0byB0YWtlIGFkdmFudGFnZSBvZiBITVIgYWRkaXRpb25hbCBhcHBsaWNhdGlvbiBjb2RlIGlzIHJlcXVpcmVkJ1xuICAgICAgICAgIChub3QgaW5jbHVkZWQgaW4gYW4gQW5ndWxhciBDTEkgcHJvamVjdCBieSBkZWZhdWx0KS4nXG4gICAgICAgICAgU2VlICR7d2VicGFja0htckxpbmt9XG4gICAgICAgICAgZm9yIGluZm9ybWF0aW9uIG9uIHdvcmtpbmcgd2l0aCBITVIgZm9yIFdlYnBhY2suYCxcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKFxuICAgICAgICAgIHRhZ3Mub25lTGluZWBUbyBkaXNhYmxlIHRoaXMgd2FybmluZyB1c2UgXCJuZyBzZXQgd2FybmluZ3MuaG1yV2FybmluZz1mYWxzZVwiLmApO1xuICAgICAgfVxuICAgICAgZW50cnlQb2ludHMucHVzaCgnd2VicGFjay9ob3QvZGV2LXNlcnZlcicpO1xuICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnB1c2gobmV3IHdlYnBhY2suSG90TW9kdWxlUmVwbGFjZW1lbnRQbHVnaW4oKSk7XG4gICAgICBpZiAoYnJvd3Nlck9wdGlvbnMuZXh0cmFjdENzcykge1xuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4odGFncy5vbmVMaW5lYE5PVElDRTogKEhNUikgZG9lcyBub3QgYWxsb3cgZm9yIENTUyBob3QgcmVsb2FkXG4gICAgICAgICAgICAgICAgd2hlbiB1c2VkIHRvZ2V0aGVyIHdpdGggJy0tZXh0cmFjdC1jc3MnLmApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXdlYnBhY2tDb25maWcuZW50cnkubWFpbikgeyB3ZWJwYWNrQ29uZmlnLmVudHJ5Lm1haW4gPSBbXTsgfVxuICAgIHdlYnBhY2tDb25maWcuZW50cnkubWFpbi51bnNoaWZ0KC4uLmVudHJ5UG9pbnRzKTtcbiAgfVxuXG4gIHByaXZhdGUgX2FkZFNzbENvbmZpZyhcbiAgICByb290OiBzdHJpbmcsXG4gICAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gICAgY29uZmlnOiBXZWJwYWNrRGV2U2VydmVyQ29uZmlndXJhdGlvbk9wdGlvbnMsXG4gICkge1xuICAgIGxldCBzc2xLZXk6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBsZXQgc3NsQ2VydDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGlmIChvcHRpb25zLnNzbEtleSkge1xuICAgICAgY29uc3Qga2V5UGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBvcHRpb25zLnNzbEtleSBhcyBzdHJpbmcpO1xuICAgICAgaWYgKGV4aXN0c1N5bmMoa2V5UGF0aCkpIHtcbiAgICAgICAgc3NsS2V5ID0gcmVhZEZpbGVTeW5jKGtleVBhdGgsICd1dGYtOCcpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAob3B0aW9ucy5zc2xDZXJ0KSB7XG4gICAgICBjb25zdCBjZXJ0UGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBvcHRpb25zLnNzbENlcnQgYXMgc3RyaW5nKTtcbiAgICAgIGlmIChleGlzdHNTeW5jKGNlcnRQYXRoKSkge1xuICAgICAgICBzc2xDZXJ0ID0gcmVhZEZpbGVTeW5jKGNlcnRQYXRoLCAndXRmLTgnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25maWcuaHR0cHMgPSB0cnVlO1xuICAgIGlmIChzc2xLZXkgIT0gbnVsbCAmJiBzc2xDZXJ0ICE9IG51bGwpIHtcbiAgICAgIGNvbmZpZy5rZXkgPSBzc2xLZXk7XG4gICAgICBjb25maWcuY2VydCA9IHNzbENlcnQ7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYWRkUHJveHlDb25maWcoXG4gICAgcm9vdDogc3RyaW5nLFxuICAgIG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICAgIGNvbmZpZzogV2VicGFja0RldlNlcnZlckNvbmZpZ3VyYXRpb25PcHRpb25zLFxuICApIHtcbiAgICBsZXQgcHJveHlDb25maWcgPSB7fTtcbiAgICBjb25zdCBwcm94eVBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgb3B0aW9ucy5wcm94eUNvbmZpZyBhcyBzdHJpbmcpO1xuICAgIGlmIChleGlzdHNTeW5jKHByb3h5UGF0aCkpIHtcbiAgICAgIHByb3h5Q29uZmlnID0gcmVxdWlyZShwcm94eVBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gJ1Byb3h5IGNvbmZpZyBmaWxlICcgKyBwcm94eVBhdGggKyAnIGRvZXMgbm90IGV4aXN0Lic7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgfVxuICAgIGNvbmZpZy5wcm94eSA9IHByb3h5Q29uZmlnO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRTZXJ2ZVBhdGgob3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSkge1xuICAgIGxldCBzZXJ2ZVBhdGggPSBvcHRpb25zLnNlcnZlUGF0aDtcbiAgICBpZiAoIXNlcnZlUGF0aCAmJiBzZXJ2ZVBhdGggIT09ICcnKSB7XG4gICAgICBjb25zdCBkZWZhdWx0U2VydmVQYXRoID1cbiAgICAgICAgdGhpcy5fZmluZERlZmF1bHRTZXJ2ZVBhdGgoYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYsIGJyb3dzZXJPcHRpb25zLmRlcGxveVVybCk7XG4gICAgICBjb25zdCBzaG93V2FybmluZyA9IG9wdGlvbnMuc2VydmVQYXRoRGVmYXVsdFdhcm5pbmc7XG4gICAgICBpZiAoZGVmYXVsdFNlcnZlUGF0aCA9PSBudWxsICYmIHNob3dXYXJuaW5nKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2Fybih0YWdzLm9uZUxpbmVgXG4gICAgICAgICAgICBXQVJOSU5HOiAtLWRlcGxveS11cmwgYW5kL29yIC0tYmFzZS1ocmVmIGNvbnRhaW5cbiAgICAgICAgICAgIHVuc3VwcG9ydGVkIHZhbHVlcyBmb3Igbmcgc2VydmUuICBEZWZhdWx0IHNlcnZlIHBhdGggb2YgJy8nIHVzZWQuXG4gICAgICAgICAgICBVc2UgLS1zZXJ2ZS1wYXRoIHRvIG92ZXJyaWRlLlxuICAgICAgICAgIGApO1xuICAgICAgfVxuICAgICAgc2VydmVQYXRoID0gZGVmYXVsdFNlcnZlUGF0aCB8fCAnJztcbiAgICB9XG4gICAgaWYgKHNlcnZlUGF0aC5lbmRzV2l0aCgnLycpKSB7XG4gICAgICBzZXJ2ZVBhdGggPSBzZXJ2ZVBhdGguc3Vic3RyKDAsIHNlcnZlUGF0aC5sZW5ndGggLSAxKTtcbiAgICB9XG4gICAgaWYgKCFzZXJ2ZVBhdGguc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgICBzZXJ2ZVBhdGggPSBgLyR7c2VydmVQYXRofWA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNlcnZlUGF0aDtcbiAgfVxuXG4gIHByaXZhdGUgX2ZpbmREZWZhdWx0U2VydmVQYXRoKGJhc2VIcmVmPzogc3RyaW5nLCBkZXBsb3lVcmw/OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBpZiAoIWJhc2VIcmVmICYmICFkZXBsb3lVcmwpIHtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG5cbiAgICBpZiAoL14oXFx3KzopP1xcL1xcLy8udGVzdChiYXNlSHJlZiB8fCAnJykgfHwgL14oXFx3KzopP1xcL1xcLy8udGVzdChkZXBsb3lVcmwgfHwgJycpKSB7XG4gICAgICAvLyBJZiBiYXNlSHJlZiBvciBkZXBsb3lVcmwgaXMgYWJzb2x1dGUsIHVuc3VwcG9ydGVkIGJ5IG5nIHNlcnZlXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBub3JtYWxpemUgYmFzZUhyZWZcbiAgICAvLyBmb3Igbmcgc2VydmUgdGhlIHN0YXJ0aW5nIGJhc2UgaXMgYWx3YXlzIGAvYCBzbyBhIHJlbGF0aXZlXG4gICAgLy8gYW5kIHJvb3QgcmVsYXRpdmUgdmFsdWUgYXJlIGlkZW50aWNhbFxuICAgIGNvbnN0IGJhc2VIcmVmUGFydHMgPSAoYmFzZUhyZWYgfHwgJycpXG4gICAgICAuc3BsaXQoJy8nKVxuICAgICAgLmZpbHRlcihwYXJ0ID0+IHBhcnQgIT09ICcnKTtcbiAgICBpZiAoYmFzZUhyZWYgJiYgIWJhc2VIcmVmLmVuZHNXaXRoKCcvJykpIHtcbiAgICAgIGJhc2VIcmVmUGFydHMucG9wKCk7XG4gICAgfVxuICAgIGNvbnN0IG5vcm1hbGl6ZWRCYXNlSHJlZiA9IGJhc2VIcmVmUGFydHMubGVuZ3RoID09PSAwID8gJy8nIDogYC8ke2Jhc2VIcmVmUGFydHMuam9pbignLycpfS9gO1xuXG4gICAgaWYgKGRlcGxveVVybCAmJiBkZXBsb3lVcmxbMF0gPT09ICcvJykge1xuICAgICAgaWYgKGJhc2VIcmVmICYmIGJhc2VIcmVmWzBdID09PSAnLycgJiYgbm9ybWFsaXplZEJhc2VIcmVmICE9PSBkZXBsb3lVcmwpIHtcbiAgICAgICAgLy8gSWYgYmFzZUhyZWYgYW5kIGRlcGxveVVybCBhcmUgcm9vdCByZWxhdGl2ZSBhbmQgbm90IGVxdWl2YWxlbnQsIHVuc3VwcG9ydGVkIGJ5IG5nIHNlcnZlXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZGVwbG95VXJsO1xuICAgIH1cblxuICAgIC8vIEpvaW4gdG9nZXRoZXIgYmFzZUhyZWYgYW5kIGRlcGxveVVybFxuICAgIHJldHVybiBgJHtub3JtYWxpemVkQmFzZUhyZWZ9JHtkZXBsb3lVcmwgfHwgJyd9YDtcbiAgfVxuXG4gIHByaXZhdGUgX2dldEJyb3dzZXJPcHRpb25zKG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zKSB7XG4gICAgY29uc3QgYXJjaGl0ZWN0ID0gdGhpcy5jb250ZXh0LmFyY2hpdGVjdDtcbiAgICBjb25zdCBbcHJvamVjdCwgdGFyZ2V0LCBjb25maWd1cmF0aW9uXSA9IG9wdGlvbnMuYnJvd3NlclRhcmdldC5zcGxpdCgnOicpO1xuICAgIC8vIE92ZXJyaWRlIGJyb3dzZXIgYnVpbGQgd2F0Y2ggc2V0dGluZy5cbiAgICBjb25zdCBvdmVycmlkZXMgPSB7IHdhdGNoOiBvcHRpb25zLndhdGNoIH07XG4gICAgY29uc3QgYnJvd3NlclRhcmdldFNwZWMgPSB7IHByb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbiwgb3ZlcnJpZGVzIH07XG4gICAgY29uc3QgYnVpbGRlckNvbmZpZyA9IGFyY2hpdGVjdC5nZXRCdWlsZGVyQ29uZmlndXJhdGlvbjxCcm93c2VyQnVpbGRlclNjaGVtYT4oXG4gICAgICBicm93c2VyVGFyZ2V0U3BlYyk7XG5cbiAgICByZXR1cm4gYXJjaGl0ZWN0LmdldEJ1aWxkZXJEZXNjcmlwdGlvbihidWlsZGVyQ29uZmlnKS5waXBlKFxuICAgICAgY29uY2F0TWFwKGJyb3dzZXJEZXNjcmlwdGlvbiA9PlxuICAgICAgICBhcmNoaXRlY3QudmFsaWRhdGVCdWlsZGVyT3B0aW9ucyhidWlsZGVyQ29uZmlnLCBicm93c2VyRGVzY3JpcHRpb24pKSxcbiAgICAgIG1hcChicm93c2VyQ29uZmlnID0+IGJyb3dzZXJDb25maWcub3B0aW9ucyksXG4gICAgKTtcbiAgfVxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IERldlNlcnZlckJ1aWxkZXI7XG4iXX0=