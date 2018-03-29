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
const Observable_1 = require("rxjs/Observable");
const operators_1 = require("rxjs/operators");
const url = require("url");
const webpack = require("webpack");
const utils_1 = require("../angular-cli-files/models/webpack-configs/utils");
const check_port_1 = require("../angular-cli-files/utilities/check-port");
const stats_1 = require("../angular-cli-files/utilities/stats");
const _1 = require("../browser/");
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
        return check_port_1.checkPort(options.port, options.host).pipe(operators_1.concatMap((port) => {
            options.port = port;
            return this._getBrowserOptions(options);
        }), operators_1.concatMap((browserOptions) => new Observable_1.Observable(obs => {
            const browserBuilder = new _1.BrowserBuilder(this.context);
            const webpackConfig = browserBuilder.buildWebpackConfig(root, projectRoot, browserOptions);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2Rldi1zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFRSCwrQ0FBMEU7QUFDMUUsMkJBQThDO0FBQzlDLDZCQUE2QjtBQUM3QixnREFBNkM7QUFDN0MsOENBQWdEO0FBQ2hELDJCQUEyQjtBQUMzQixtQ0FBbUM7QUFDbkMsNkVBQTBGO0FBQzFGLDBFQUFzRTtBQUN0RSxnRUFJOEM7QUFDOUMsa0NBR3FCO0FBQ3JCLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUMzQixNQUFNLGdCQUFnQixHQUFHLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0FBZ0R2RDtJQUVFLFlBQW1CLE9BQXVCO1FBQXZCLFlBQU8sR0FBUCxPQUFPLENBQWdCO0lBQUksQ0FBQztJQUUvQyxHQUFHLENBQUMsYUFBNEQ7UUFDOUQsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQztRQUN0QyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDekMsTUFBTSxXQUFXLEdBQUcsY0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdEQsTUFBTSxDQUFDLHNCQUFTLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUMvQyxxQkFBUyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUU7WUFDakIsT0FBTyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7WUFFcEIsTUFBTSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMxQyxDQUFDLENBQUMsRUFDRixxQkFBUyxDQUFDLENBQUMsY0FBYyxF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QyxrQkFBa0IsQ0FBQyxFQUFFLENBQzdCLFNBQVMsQ0FBQyxzQkFBc0IsQ0FBQyxhQUFhLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxFQUN0RSxlQUFHLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQzVDLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUE5VkQsNENBOFZDO0FBR0Qsa0JBQWUsZ0JBQWdCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnQsXG4gIEJ1aWxkZXIsXG4gIEJ1aWxkZXJDb25maWd1cmF0aW9uLFxuICBCdWlsZGVyQ29udGV4dCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBQYXRoLCBnZXRTeXN0ZW1QYXRoLCByZXNvbHZlLCB0YWdzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgZXhpc3RzU3luYywgcmVhZEZpbGVTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUgfSBmcm9tICdyeGpzL09ic2VydmFibGUnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcbmltcG9ydCAqIGFzIHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBnZXRXZWJwYWNrU3RhdHNDb25maWcgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3V0aWxzJztcbmltcG9ydCB7IGNoZWNrUG9ydCB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9jaGVjay1wb3J0JztcbmltcG9ydCB7XG4gIHN0YXRzRXJyb3JzVG9TdHJpbmcsXG4gIHN0YXRzVG9TdHJpbmcsXG4gIHN0YXRzV2FybmluZ3NUb1N0cmluZyxcbn0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3N0YXRzJztcbmltcG9ydCB7XG4gIEJyb3dzZXJCdWlsZGVyLFxuICBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG59IGZyb20gJy4uL2Jyb3dzZXIvJztcbmNvbnN0IG9wbiA9IHJlcXVpcmUoJ29wbicpO1xuY29uc3QgV2VicGFja0RldlNlcnZlciA9IHJlcXVpcmUoJ3dlYnBhY2stZGV2LXNlcnZlcicpO1xuXG5cbmV4cG9ydCBpbnRlcmZhY2UgRGV2U2VydmVyQnVpbGRlck9wdGlvbnMge1xuICBicm93c2VyVGFyZ2V0OiBzdHJpbmc7XG4gIHBvcnQ6IG51bWJlcjtcbiAgaG9zdDogc3RyaW5nO1xuICBwcm94eUNvbmZpZz86IHN0cmluZztcbiAgc3NsOiBib29sZWFuO1xuICBzc2xLZXk/OiBzdHJpbmc7XG4gIHNzbENlcnQ/OiBzdHJpbmc7XG4gIG9wZW46IGJvb2xlYW47XG4gIGxpdmVSZWxvYWQ6IGJvb2xlYW47XG4gIHB1YmxpY0hvc3Q/OiBzdHJpbmc7XG4gIHNlcnZlUGF0aD86IHN0cmluZztcbiAgZGlzYWJsZUhvc3RDaGVjazogYm9vbGVhbjtcbiAgaG1yOiBib29sZWFuO1xuICB3YXRjaDogYm9vbGVhbjtcbiAgaG1yV2FybmluZzogYm9vbGVhbjtcbiAgc2VydmVQYXRoRGVmYXVsdFdhcm5pbmc6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBXZWJwYWNrRGV2U2VydmVyQ29uZmlndXJhdGlvbk9wdGlvbnMge1xuICBjb250ZW50QmFzZT86IGJvb2xlYW4gfCBzdHJpbmcgfCBzdHJpbmdbXTtcbiAgaG90PzogYm9vbGVhbjtcbiAgaGlzdG9yeUFwaUZhbGxiYWNrPzogeyBba2V5OiBzdHJpbmddOiBhbnkgfSB8IGJvb2xlYW47IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8tYW55XG4gIGNvbXByZXNzPzogYm9vbGVhbjtcbiAgcHJveHk/OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9O1xuICBzdGF0aWNPcHRpb25zPzogYW55OyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuICBxdWlldD86IGJvb2xlYW47XG4gIG5vSW5mbz86IGJvb2xlYW47XG4gIGxhenk/OiBib29sZWFuO1xuICBmaWxlbmFtZT86IHN0cmluZztcbiAgd2F0Y2hPcHRpb25zPzoge1xuICAgIGFnZ3JlZ2F0ZVRpbWVvdXQ/OiBudW1iZXI7XG4gICAgcG9sbD86IG51bWJlcjtcbiAgfTtcbiAgcHVibGljUGF0aD86IHN0cmluZztcbiAgaGVhZGVycz86IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH07XG4gIHN0YXRzPzogeyBba2V5OiBzdHJpbmddOiBib29sZWFuIH0gfCBzdHJpbmcgfCBib29sZWFuO1xuICBodHRwcz86IGJvb2xlYW47XG4gIGtleT86IHN0cmluZztcbiAgY2VydD86IHN0cmluZztcbiAgb3ZlcmxheT86IGJvb2xlYW4gfCB7IGVycm9yczogYm9vbGVhbiwgd2FybmluZ3M6IGJvb2xlYW4gfTtcbiAgcHVibGljPzogc3RyaW5nO1xuICBkaXNhYmxlSG9zdENoZWNrPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIERldlNlcnZlckJ1aWxkZXIgaW1wbGVtZW50cyBCdWlsZGVyPERldlNlcnZlckJ1aWxkZXJPcHRpb25zPiB7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KSB7IH1cblxuICBydW4oYnVpbGRlckNvbmZpZzogQnVpbGRlckNvbmZpZ3VyYXRpb248RGV2U2VydmVyQnVpbGRlck9wdGlvbnM+KTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGJ1aWxkZXJDb25maWcub3B0aW9ucztcbiAgICBjb25zdCByb290ID0gdGhpcy5jb250ZXh0LndvcmtzcGFjZS5yb290O1xuICAgIGNvbnN0IHByb2plY3RSb290ID0gcmVzb2x2ZShyb290LCBidWlsZGVyQ29uZmlnLnJvb3QpO1xuXG4gICAgcmV0dXJuIGNoZWNrUG9ydChvcHRpb25zLnBvcnQsIG9wdGlvbnMuaG9zdCkucGlwZShcbiAgICAgIGNvbmNhdE1hcCgocG9ydCkgPT4ge1xuICAgICAgICBvcHRpb25zLnBvcnQgPSBwb3J0O1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRCcm93c2VyT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgIH0pLFxuICAgICAgY29uY2F0TWFwKChicm93c2VyT3B0aW9ucykgPT4gbmV3IE9ic2VydmFibGUob2JzID0+IHtcbiAgICAgICAgY29uc3QgYnJvd3NlckJ1aWxkZXIgPSBuZXcgQnJvd3NlckJ1aWxkZXIodGhpcy5jb250ZXh0KTtcbiAgICAgICAgY29uc3Qgd2VicGFja0NvbmZpZyA9IGJyb3dzZXJCdWlsZGVyLmJ1aWxkV2VicGFja0NvbmZpZyhyb290LCBwcm9qZWN0Um9vdCwgYnJvd3Nlck9wdGlvbnMpO1xuICAgICAgICBjb25zdCB3ZWJwYWNrQ29tcGlsZXIgPSB3ZWJwYWNrKHdlYnBhY2tDb25maWcpO1xuICAgICAgICBjb25zdCBzdGF0c0NvbmZpZyA9IGdldFdlYnBhY2tTdGF0c0NvbmZpZyhicm93c2VyT3B0aW9ucy52ZXJib3NlKTtcblxuICAgICAgICBsZXQgd2VicGFja0RldlNlcnZlckNvbmZpZzogV2VicGFja0RldlNlcnZlckNvbmZpZ3VyYXRpb25PcHRpb25zO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHdlYnBhY2tEZXZTZXJ2ZXJDb25maWcgPSB0aGlzLl9idWlsZFNlcnZlckNvbmZpZyhcbiAgICAgICAgICAgIHJvb3QsIHByb2plY3RSb290LCBvcHRpb25zLCBicm93c2VyT3B0aW9ucyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIG9icy5lcnJvcihlcnIpO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzb2x2ZSBwdWJsaWMgaG9zdCBhbmQgY2xpZW50IGFkZHJlc3MuXG4gICAgICAgIGxldCBjbGllbnRBZGRyZXNzID0gYCR7b3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnfTovLzAuMC4wLjA6MGA7XG4gICAgICAgIGlmIChvcHRpb25zLnB1YmxpY0hvc3QpIHtcbiAgICAgICAgICBsZXQgcHVibGljSG9zdCA9IG9wdGlvbnMucHVibGljSG9zdDtcbiAgICAgICAgICBpZiAoIS9eXFx3KzpcXC9cXC8vLnRlc3QocHVibGljSG9zdCkpIHtcbiAgICAgICAgICAgIHB1YmxpY0hvc3QgPSBgJHtvcHRpb25zLnNzbCA/ICdodHRwcycgOiAnaHR0cCd9Oi8vJHtwdWJsaWNIb3N0fWA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGNsaWVudFVybCA9IHVybC5wYXJzZShwdWJsaWNIb3N0KTtcbiAgICAgICAgICBvcHRpb25zLnB1YmxpY0hvc3QgPSBjbGllbnRVcmwuaG9zdDtcbiAgICAgICAgICBjbGllbnRBZGRyZXNzID0gdXJsLmZvcm1hdChjbGllbnRVcmwpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzb2x2ZSBzZXJ2ZSBhZGRyZXNzLlxuICAgICAgICBjb25zdCBzZXJ2ZXJBZGRyZXNzID0gdXJsLmZvcm1hdCh7XG4gICAgICAgICAgcHJvdG9jb2w6IG9wdGlvbnMuc3NsID8gJ2h0dHBzJyA6ICdodHRwJyxcbiAgICAgICAgICBob3N0bmFtZTogb3B0aW9ucy5ob3N0ID09PSAnMC4wLjAuMCcgPyAnbG9jYWxob3N0JyA6IG9wdGlvbnMuaG9zdCxcbiAgICAgICAgICBwb3J0OiBvcHRpb25zLnBvcnQudG9TdHJpbmcoKSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWRkIGxpdmUgcmVsb2FkIGNvbmZpZy5cbiAgICAgICAgaWYgKG9wdGlvbnMubGl2ZVJlbG9hZCkge1xuICAgICAgICAgIHRoaXMuX2FkZExpdmVSZWxvYWQob3B0aW9ucywgYnJvd3Nlck9wdGlvbnMsIHdlYnBhY2tDb25maWcsIGNsaWVudEFkZHJlc3MpO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuaG1yKSB7XG4gICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKCdMaXZlIHJlbG9hZCBpcyBkaXNhYmxlZC4gSE1SIG9wdGlvbiBpZ25vcmVkLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLndhdGNoKSB7XG4gICAgICAgICAgLy8gVGhlcmUncyBubyBvcHRpb24gdG8gdHVybiBvZmYgZmlsZSB3YXRjaGluZyBpbiB3ZWJwYWNrLWRldi1zZXJ2ZXIsIGJ1dFxuICAgICAgICAgIC8vIHdlIGNhbiBvdmVycmlkZSB0aGUgZmlsZSB3YXRjaGVyIGluc3RlYWQuXG4gICAgICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnVuc2hpZnQoe1xuICAgICAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICAgICAgYXBwbHk6IChjb21waWxlcjogYW55KSA9PiB7XG4gICAgICAgICAgICAgIGNvbXBpbGVyLmhvb2tzLmFmdGVyRW52aXJvbm1lbnQudGFwKCdhbmd1bGFyLWNsaScsICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb21waWxlci53YXRjaEZpbGVTeXN0ZW0gPSB7IHdhdGNoOiAoKSA9PiB7IH0gfTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbikge1xuICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuZXJyb3IodGFncy5zdHJpcEluZGVudHNgXG4gICAgICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAgICBUaGlzIGlzIGEgc2ltcGxlIHNlcnZlciBmb3IgdXNlIGluIHRlc3Rpbmcgb3IgZGVidWdnaW5nIEFuZ3VsYXIgYXBwbGljYXRpb25zIGxvY2FsbHkuXG4gICAgICAgICAgICBJdCBoYXNuJ3QgYmVlbiByZXZpZXdlZCBmb3Igc2VjdXJpdHkgaXNzdWVzLlxuXG4gICAgICAgICAgICBET04nVCBVU0UgSVQgRk9SIFBST0RVQ1RJT04hXG4gICAgICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAgYCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmluZm8odGFncy5vbmVMaW5lYFxuICAgICAgICAgICoqXG4gICAgICAgICAgQW5ndWxhciBMaXZlIERldmVsb3BtZW50IFNlcnZlciBpcyBsaXN0ZW5pbmcgb24gJHtvcHRpb25zLmhvc3R9OlxuICAgICAgICAgICR7b3B0aW9ucy5wb3J0fSwgb3BlbiB5b3VyIGJyb3dzZXIgb24gJHtzZXJ2ZXJBZGRyZXNzfSR7d2VicGFja0RldlNlcnZlckNvbmZpZy5wdWJsaWNQYXRofVxuICAgICAgICAgICoqXG4gICAgICAgIGApO1xuXG4gICAgICAgIGNvbnN0IHNlcnZlciA9IG5ldyBXZWJwYWNrRGV2U2VydmVyKHdlYnBhY2tDb21waWxlciwgd2VicGFja0RldlNlcnZlckNvbmZpZyk7XG5cbiAgICAgICAgbGV0IGZpcnN0ID0gdHJ1ZTtcbiAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICAod2VicGFja0NvbXBpbGVyIGFzIGFueSkuaG9va3MuZG9uZS50YXAoJ2FuZ3VsYXItY2xpJywgKHN0YXRzOiB3ZWJwYWNrLlN0YXRzKSA9PiB7XG4gICAgICAgICAgaWYgKCFicm93c2VyT3B0aW9ucy52ZXJib3NlKSB7XG4gICAgICAgICAgICBjb25zdCBqc29uID0gc3RhdHMudG9Kc29uKHN0YXRzQ29uZmlnKTtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbyhzdGF0c1RvU3RyaW5nKGpzb24sIHN0YXRzQ29uZmlnKSk7XG4gICAgICAgICAgICBpZiAoc3RhdHMuaGFzV2FybmluZ3MoKSkge1xuICAgICAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmluZm8oc3RhdHNXYXJuaW5nc1RvU3RyaW5nKGpzb24sIHN0YXRzQ29uZmlnKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3RhdHMuaGFzRXJyb3JzKCkpIHtcbiAgICAgICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5pbmZvKHN0YXRzRXJyb3JzVG9TdHJpbmcoanNvbiwgc3RhdHNDb25maWcpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgb2JzLm5leHQoeyBzdWNjZXNzOiB0cnVlIH0pO1xuXG4gICAgICAgICAgaWYgKGZpcnN0ICYmIG9wdGlvbnMub3Blbikge1xuICAgICAgICAgICAgZmlyc3QgPSBmYWxzZTtcbiAgICAgICAgICAgIG9wbihzZXJ2ZXJBZGRyZXNzICsgd2VicGFja0RldlNlcnZlckNvbmZpZy5wdWJsaWNQYXRoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGh0dHBTZXJ2ZXIgPSBzZXJ2ZXIubGlzdGVuKFxuICAgICAgICAgIG9wdGlvbnMucG9ydCxcbiAgICAgICAgICBvcHRpb25zLmhvc3QsXG4gICAgICAgICAgKGVycjogYW55KSA9PiB7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8tYW55XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIG9icy5lcnJvcihlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gTm9kZSA4IGhhcyBhIGtlZXBBbGl2ZVRpbWVvdXQgYnVnIHdoaWNoIGRvZXNuJ3QgcmVzcGVjdCBhY3RpdmUgY29ubmVjdGlvbnMuXG4gICAgICAgIC8vIENvbm5lY3Rpb25zIHdpbGwgZW5kIGFmdGVyIH41IHNlY29uZHMgKGFyYml0cmFyeSksIG9mdGVuIG5vdCBsZXR0aW5nIHRoZSBmdWxsIGRvd25sb2FkXG4gICAgICAgIC8vIG9mIGxhcmdlIHBpZWNlcyBvZiBjb250ZW50LCBzdWNoIGFzIGEgdmVuZG9yIGphdmFzY3JpcHQgZmlsZS4gIFRoaXMgcmVzdWx0cyBpbiBicm93c2Vyc1xuICAgICAgICAvLyB0aHJvd2luZyBhIFwibmV0OjpFUlJfQ09OVEVOVF9MRU5HVEhfTUlTTUFUQ0hcIiBlcnJvci5cbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzcxOTdcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2lzc3Vlcy8xMzM5MVxuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvY29tbWl0LzJjYjZmMmIyODFlYjk2YTdhYmUxNmQ1OGFmNmViYzljZTIzZDJlOTZcbiAgICAgICAgaWYgKC9edjguXFxkLlxcZCskLy50ZXN0KHByb2Nlc3MudmVyc2lvbikpIHtcbiAgICAgICAgICBodHRwU2VydmVyLmtlZXBBbGl2ZVRpbWVvdXQgPSAzMDAwMDsgLy8gMzAgc2Vjb25kc1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGVhcmRvd24gbG9naWMuIENsb3NlIHRoZSBzZXJ2ZXIgd2hlbiB1bnN1YnNjcmliZWQgZnJvbS5cbiAgICAgICAgcmV0dXJuICgpID0+IHNlcnZlci5jbG9zZSgpO1xuICAgICAgfSkpKTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU2VydmVyQ29uZmlnKFxuICAgIHJvb3Q6IFBhdGgsXG4gICAgcHJvamVjdFJvb3Q6IFBhdGgsXG4gICAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gICAgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgKSB7XG4gICAgY29uc3Qgc3lzdGVtUm9vdCA9IGdldFN5c3RlbVBhdGgocm9vdCk7XG4gICAgaWYgKG9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjaykge1xuICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKHRhZ3Mub25lTGluZWBcbiAgICAgICAgV0FSTklORzogUnVubmluZyBhIHNlcnZlciB3aXRoIC0tZGlzYWJsZS1ob3N0LWNoZWNrIGlzIGEgc2VjdXJpdHkgcmlzay5cbiAgICAgICAgU2VlIGh0dHBzOi8vbWVkaXVtLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LXNlcnZlci1taWRkbGV3YXJlLXNlY3VyaXR5LWlzc3Vlcy0xNDg5ZDk1MDg3NGFcbiAgICAgICAgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gICAgICBgKTtcbiAgICB9XG5cbiAgICBjb25zdCBzZXJ2ZVBhdGggPSB0aGlzLl9idWlsZFNlcnZlUGF0aChvcHRpb25zLCBicm93c2VyT3B0aW9ucyk7XG5cbiAgICBjb25zdCBjb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXJDb25maWd1cmF0aW9uT3B0aW9ucyA9IHtcbiAgICAgIGhlYWRlcnM6IHsgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyB9LFxuICAgICAgaGlzdG9yeUFwaUZhbGxiYWNrOiB7XG4gICAgICAgIGluZGV4OiBgJHtzZXJ2ZVBhdGh9LyR7cGF0aC5iYXNlbmFtZShicm93c2VyT3B0aW9ucy5pbmRleCl9YCxcbiAgICAgICAgZGlzYWJsZURvdFJ1bGU6IHRydWUsXG4gICAgICAgIGh0bWxBY2NlcHRIZWFkZXJzOiBbJ3RleHQvaHRtbCcsICdhcHBsaWNhdGlvbi94aHRtbCt4bWwnXSxcbiAgICAgIH0sXG4gICAgICBzdGF0czogYnJvd3Nlck9wdGlvbnMudmVyYm9zZSA/IGdldFdlYnBhY2tTdGF0c0NvbmZpZyhicm93c2VyT3B0aW9ucy52ZXJib3NlKSA6IGZhbHNlLFxuICAgICAgY29tcHJlc3M6IGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbixcbiAgICAgIHdhdGNoT3B0aW9uczoge1xuICAgICAgICBwb2xsOiBicm93c2VyT3B0aW9ucy5wb2xsLFxuICAgICAgfSxcbiAgICAgIGh0dHBzOiBvcHRpb25zLnNzbCxcbiAgICAgIG92ZXJsYXk6IHtcbiAgICAgICAgZXJyb3JzOiAhYnJvd3Nlck9wdGlvbnMub3B0aW1pemF0aW9uLFxuICAgICAgICB3YXJuaW5nczogZmFsc2UsXG4gICAgICB9LFxuICAgICAgY29udGVudEJhc2U6IGZhbHNlLFxuICAgICAgcHVibGljOiBvcHRpb25zLnB1YmxpY0hvc3QsXG4gICAgICBkaXNhYmxlSG9zdENoZWNrOiBvcHRpb25zLmRpc2FibGVIb3N0Q2hlY2ssXG4gICAgICBwdWJsaWNQYXRoOiBzZXJ2ZVBhdGgsXG4gICAgICBob3Q6IG9wdGlvbnMuaG1yLFxuICAgIH07XG5cbiAgICBpZiAob3B0aW9ucy5zc2wpIHtcbiAgICAgIHRoaXMuX2FkZFNzbENvbmZpZyhzeXN0ZW1Sb290LCBvcHRpb25zLCBjb25maWcpO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLnByb3h5Q29uZmlnKSB7XG4gICAgICB0aGlzLl9hZGRQcm94eUNvbmZpZyhzeXN0ZW1Sb290LCBvcHRpb25zLCBjb25maWcpO1xuICAgIH1cblxuICAgIHJldHVybiBjb25maWc7XG4gIH1cblxuICBwcml2YXRlIF9hZGRMaXZlUmVsb2FkKFxuICAgIG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICAgIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gICAgd2VicGFja0NvbmZpZzogYW55LCAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuICAgIGNsaWVudEFkZHJlc3M6IHN0cmluZyxcbiAgKSB7XG4gICAgLy8gVGhpcyBhbGxvd3MgZm9yIGxpdmUgcmVsb2FkIG9mIHBhZ2Ugd2hlbiBjaGFuZ2VzIGFyZSBtYWRlIHRvIHJlcG8uXG4gICAgLy8gaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9jb25maWd1cmF0aW9uL2Rldi1zZXJ2ZXIvI2RldnNlcnZlci1pbmxpbmVcbiAgICBsZXQgd2VicGFja0RldlNlcnZlclBhdGg7XG4gICAgdHJ5IHtcbiAgICAgIHdlYnBhY2tEZXZTZXJ2ZXJQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCd3ZWJwYWNrLWRldi1zZXJ2ZXIvY2xpZW50Jyk7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBcIndlYnBhY2stZGV2LXNlcnZlclwiIHBhY2thZ2UgY291bGQgbm90IGJlIGZvdW5kLicpO1xuICAgIH1cbiAgICBjb25zdCBlbnRyeVBvaW50cyA9IFtgJHt3ZWJwYWNrRGV2U2VydmVyUGF0aH0/JHtjbGllbnRBZGRyZXNzfWBdO1xuICAgIGlmIChvcHRpb25zLmhtcikge1xuICAgICAgY29uc3Qgd2VicGFja0htckxpbmsgPSAnaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9ndWlkZXMvaG90LW1vZHVsZS1yZXBsYWNlbWVudCc7XG5cbiAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgdGFncy5vbmVMaW5lYE5PVElDRTogSG90IE1vZHVsZSBSZXBsYWNlbWVudCAoSE1SKSBpcyBlbmFibGVkIGZvciB0aGUgZGV2IHNlcnZlci5gKTtcblxuICAgICAgY29uc3Qgc2hvd1dhcm5pbmcgPSBvcHRpb25zLmhtcldhcm5pbmc7XG4gICAgICBpZiAoc2hvd1dhcm5pbmcpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5pbmZvKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgICAgIFRoZSBwcm9qZWN0IHdpbGwgc3RpbGwgbGl2ZSByZWxvYWQgd2hlbiBITVIgaXMgZW5hYmxlZCxcbiAgICAgICAgICBidXQgdG8gdGFrZSBhZHZhbnRhZ2Ugb2YgSE1SIGFkZGl0aW9uYWwgYXBwbGljYXRpb24gY29kZSBpcyByZXF1aXJlZCdcbiAgICAgICAgICAobm90IGluY2x1ZGVkIGluIGFuIEFuZ3VsYXIgQ0xJIHByb2plY3QgYnkgZGVmYXVsdCkuJ1xuICAgICAgICAgIFNlZSAke3dlYnBhY2tIbXJMaW5rfVxuICAgICAgICAgIGZvciBpbmZvcm1hdGlvbiBvbiB3b3JraW5nIHdpdGggSE1SIGZvciBXZWJwYWNrLmAsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgICB0YWdzLm9uZUxpbmVgVG8gZGlzYWJsZSB0aGlzIHdhcm5pbmcgdXNlIFwibmcgc2V0IHdhcm5pbmdzLmhtcldhcm5pbmc9ZmFsc2VcIi5gKTtcbiAgICAgIH1cbiAgICAgIGVudHJ5UG9pbnRzLnB1c2goJ3dlYnBhY2svaG90L2Rldi1zZXJ2ZXInKTtcbiAgICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy5wdXNoKG5ldyB3ZWJwYWNrLkhvdE1vZHVsZVJlcGxhY2VtZW50UGx1Z2luKCkpO1xuICAgICAgaWYgKGJyb3dzZXJPcHRpb25zLmV4dHJhY3RDc3MpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKHRhZ3Mub25lTGluZWBOT1RJQ0U6IChITVIpIGRvZXMgbm90IGFsbG93IGZvciBDU1MgaG90IHJlbG9hZFxuICAgICAgICAgICAgICAgIHdoZW4gdXNlZCB0b2dldGhlciB3aXRoICctLWV4dHJhY3QtY3NzJy5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCF3ZWJwYWNrQ29uZmlnLmVudHJ5Lm1haW4pIHsgd2VicGFja0NvbmZpZy5lbnRyeS5tYWluID0gW107IH1cbiAgICB3ZWJwYWNrQ29uZmlnLmVudHJ5Lm1haW4udW5zaGlmdCguLi5lbnRyeVBvaW50cyk7XG4gIH1cblxuICBwcml2YXRlIF9hZGRTc2xDb25maWcoXG4gICAgcm9vdDogc3RyaW5nLFxuICAgIG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICAgIGNvbmZpZzogV2VicGFja0RldlNlcnZlckNvbmZpZ3VyYXRpb25PcHRpb25zLFxuICApIHtcbiAgICBsZXQgc3NsS2V5OiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgbGV0IHNzbENlcnQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBpZiAob3B0aW9ucy5zc2xLZXkpIHtcbiAgICAgIGNvbnN0IGtleVBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgb3B0aW9ucy5zc2xLZXkgYXMgc3RyaW5nKTtcbiAgICAgIGlmIChleGlzdHNTeW5jKGtleVBhdGgpKSB7XG4gICAgICAgIHNzbEtleSA9IHJlYWRGaWxlU3luYyhrZXlQYXRoLCAndXRmLTgnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG9wdGlvbnMuc3NsQ2VydCkge1xuICAgICAgY29uc3QgY2VydFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgb3B0aW9ucy5zc2xDZXJ0IGFzIHN0cmluZyk7XG4gICAgICBpZiAoZXhpc3RzU3luYyhjZXJ0UGF0aCkpIHtcbiAgICAgICAgc3NsQ2VydCA9IHJlYWRGaWxlU3luYyhjZXJ0UGF0aCwgJ3V0Zi04Jyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uZmlnLmh0dHBzID0gdHJ1ZTtcbiAgICBpZiAoc3NsS2V5ICE9IG51bGwgJiYgc3NsQ2VydCAhPSBudWxsKSB7XG4gICAgICBjb25maWcua2V5ID0gc3NsS2V5O1xuICAgICAgY29uZmlnLmNlcnQgPSBzc2xDZXJ0O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2FkZFByb3h5Q29uZmlnKFxuICAgIHJvb3Q6IHN0cmluZyxcbiAgICBvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgICBjb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXJDb25maWd1cmF0aW9uT3B0aW9ucyxcbiAgKSB7XG4gICAgbGV0IHByb3h5Q29uZmlnID0ge307XG4gICAgY29uc3QgcHJveHlQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIG9wdGlvbnMucHJveHlDb25maWcgYXMgc3RyaW5nKTtcbiAgICBpZiAoZXhpc3RzU3luYyhwcm94eVBhdGgpKSB7XG4gICAgICBwcm94eUNvbmZpZyA9IHJlcXVpcmUocHJveHlQYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbWVzc2FnZSA9ICdQcm94eSBjb25maWcgZmlsZSAnICsgcHJveHlQYXRoICsgJyBkb2VzIG5vdCBleGlzdC4nO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgIH1cbiAgICBjb25maWcucHJveHkgPSBwcm94eUNvbmZpZztcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU2VydmVQYXRoKG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLCBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zKSB7XG4gICAgbGV0IHNlcnZlUGF0aCA9IG9wdGlvbnMuc2VydmVQYXRoO1xuICAgIGlmICghc2VydmVQYXRoICYmIHNlcnZlUGF0aCAhPT0gJycpIHtcbiAgICAgIGNvbnN0IGRlZmF1bHRTZXJ2ZVBhdGggPVxuICAgICAgICB0aGlzLl9maW5kRGVmYXVsdFNlcnZlUGF0aChicm93c2VyT3B0aW9ucy5iYXNlSHJlZiwgYnJvd3Nlck9wdGlvbnMuZGVwbG95VXJsKTtcbiAgICAgIGNvbnN0IHNob3dXYXJuaW5nID0gb3B0aW9ucy5zZXJ2ZVBhdGhEZWZhdWx0V2FybmluZztcbiAgICAgIGlmIChkZWZhdWx0U2VydmVQYXRoID09IG51bGwgJiYgc2hvd1dhcm5pbmcpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKHRhZ3Mub25lTGluZWBcbiAgICAgICAgICAgIFdBUk5JTkc6IC0tZGVwbG95LXVybCBhbmQvb3IgLS1iYXNlLWhyZWYgY29udGFpblxuICAgICAgICAgICAgdW5zdXBwb3J0ZWQgdmFsdWVzIGZvciBuZyBzZXJ2ZS4gIERlZmF1bHQgc2VydmUgcGF0aCBvZiAnLycgdXNlZC5cbiAgICAgICAgICAgIFVzZSAtLXNlcnZlLXBhdGggdG8gb3ZlcnJpZGUuXG4gICAgICAgICAgYCk7XG4gICAgICB9XG4gICAgICBzZXJ2ZVBhdGggPSBkZWZhdWx0U2VydmVQYXRoIHx8ICcnO1xuICAgIH1cbiAgICBpZiAoc2VydmVQYXRoLmVuZHNXaXRoKCcvJykpIHtcbiAgICAgIHNlcnZlUGF0aCA9IHNlcnZlUGF0aC5zdWJzdHIoMCwgc2VydmVQYXRoLmxlbmd0aCAtIDEpO1xuICAgIH1cbiAgICBpZiAoIXNlcnZlUGF0aC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICAgIHNlcnZlUGF0aCA9IGAvJHtzZXJ2ZVBhdGh9YDtcbiAgICB9XG5cbiAgICByZXR1cm4gc2VydmVQYXRoO1xuICB9XG5cbiAgcHJpdmF0ZSBfZmluZERlZmF1bHRTZXJ2ZVBhdGgoYmFzZUhyZWY/OiBzdHJpbmcsIGRlcGxveVVybD86IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmICghYmFzZUhyZWYgJiYgIWRlcGxveVVybCkge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cblxuICAgIGlmICgvXihcXHcrOik/XFwvXFwvLy50ZXN0KGJhc2VIcmVmIHx8ICcnKSB8fCAvXihcXHcrOik/XFwvXFwvLy50ZXN0KGRlcGxveVVybCB8fCAnJykpIHtcbiAgICAgIC8vIElmIGJhc2VIcmVmIG9yIGRlcGxveVVybCBpcyBhYnNvbHV0ZSwgdW5zdXBwb3J0ZWQgYnkgbmcgc2VydmVcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIG5vcm1hbGl6ZSBiYXNlSHJlZlxuICAgIC8vIGZvciBuZyBzZXJ2ZSB0aGUgc3RhcnRpbmcgYmFzZSBpcyBhbHdheXMgYC9gIHNvIGEgcmVsYXRpdmVcbiAgICAvLyBhbmQgcm9vdCByZWxhdGl2ZSB2YWx1ZSBhcmUgaWRlbnRpY2FsXG4gICAgY29uc3QgYmFzZUhyZWZQYXJ0cyA9IChiYXNlSHJlZiB8fCAnJylcbiAgICAgIC5zcGxpdCgnLycpXG4gICAgICAuZmlsdGVyKHBhcnQgPT4gcGFydCAhPT0gJycpO1xuICAgIGlmIChiYXNlSHJlZiAmJiAhYmFzZUhyZWYuZW5kc1dpdGgoJy8nKSkge1xuICAgICAgYmFzZUhyZWZQYXJ0cy5wb3AoKTtcbiAgICB9XG4gICAgY29uc3Qgbm9ybWFsaXplZEJhc2VIcmVmID0gYmFzZUhyZWZQYXJ0cy5sZW5ndGggPT09IDAgPyAnLycgOiBgLyR7YmFzZUhyZWZQYXJ0cy5qb2luKCcvJyl9L2A7XG5cbiAgICBpZiAoZGVwbG95VXJsICYmIGRlcGxveVVybFswXSA9PT0gJy8nKSB7XG4gICAgICBpZiAoYmFzZUhyZWYgJiYgYmFzZUhyZWZbMF0gPT09ICcvJyAmJiBub3JtYWxpemVkQmFzZUhyZWYgIT09IGRlcGxveVVybCkge1xuICAgICAgICAvLyBJZiBiYXNlSHJlZiBhbmQgZGVwbG95VXJsIGFyZSByb290IHJlbGF0aXZlIGFuZCBub3QgZXF1aXZhbGVudCwgdW5zdXBwb3J0ZWQgYnkgbmcgc2VydmVcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBkZXBsb3lVcmw7XG4gICAgfVxuXG4gICAgLy8gSm9pbiB0b2dldGhlciBiYXNlSHJlZiBhbmQgZGVwbG95VXJsXG4gICAgcmV0dXJuIGAke25vcm1hbGl6ZWRCYXNlSHJlZn0ke2RlcGxveVVybCB8fCAnJ31gO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0QnJvd3Nlck9wdGlvbnMob3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMpIHtcbiAgICBjb25zdCBhcmNoaXRlY3QgPSB0aGlzLmNvbnRleHQuYXJjaGl0ZWN0O1xuICAgIGNvbnN0IFtwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb25dID0gb3B0aW9ucy5icm93c2VyVGFyZ2V0LnNwbGl0KCc6Jyk7XG4gICAgLy8gT3ZlcnJpZGUgYnJvd3NlciBidWlsZCB3YXRjaCBzZXR0aW5nLlxuICAgIGNvbnN0IG92ZXJyaWRlcyA9IHsgd2F0Y2g6IG9wdGlvbnMud2F0Y2ggfTtcbiAgICBjb25zdCBicm93c2VyVGFyZ2V0U3BlYyA9IHsgcHJvamVjdCwgdGFyZ2V0LCBjb25maWd1cmF0aW9uLCBvdmVycmlkZXMgfTtcbiAgICBjb25zdCBidWlsZGVyQ29uZmlnID0gYXJjaGl0ZWN0LmdldEJ1aWxkZXJDb25maWd1cmF0aW9uPEJyb3dzZXJCdWlsZGVyT3B0aW9ucz4oXG4gICAgICBicm93c2VyVGFyZ2V0U3BlYyk7XG5cbiAgICByZXR1cm4gYXJjaGl0ZWN0LmdldEJ1aWxkZXJEZXNjcmlwdGlvbihidWlsZGVyQ29uZmlnKS5waXBlKFxuICAgICAgY29uY2F0TWFwKGJyb3dzZXJEZXNjcmlwdGlvbiA9PlxuICAgICAgICBhcmNoaXRlY3QudmFsaWRhdGVCdWlsZGVyT3B0aW9ucyhidWlsZGVyQ29uZmlnLCBicm93c2VyRGVzY3JpcHRpb24pKSxcbiAgICAgIG1hcChicm93c2VyQ29uZmlnID0+IGJyb3dzZXJDb25maWcub3B0aW9ucyksXG4gICAgKTtcbiAgfVxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IERldlNlcnZlckJ1aWxkZXI7XG4iXX0=