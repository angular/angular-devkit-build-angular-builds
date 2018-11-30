"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const build_webpack_1 = require("@angular-devkit/build-webpack");
const core_1 = require("@angular-devkit/core");
const fs_1 = require("fs");
const path = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const url = require("url");
const webpack = require("webpack");
const check_port_1 = require("../angular-cli-files/utilities/check-port");
const browser_1 = require("../browser/");
const utils_1 = require("../utils");
const opn = require('opn');
class DevServerBuilder {
    constructor(context) {
        this.context = context;
    }
    run(builderConfig) {
        const options = builderConfig.options;
        const root = this.context.workspace.root;
        const projectRoot = core_1.resolve(root, builderConfig.root);
        const host = new core_1.virtualFs.AliasHost(this.context.host);
        const webpackDevServerBuilder = new build_webpack_1.WebpackDevServerBuilder(Object.assign({}, this.context, { host }));
        let browserOptions;
        let first = true;
        let opnAddress;
        return check_port_1.checkPort(options.port, options.host).pipe(operators_1.tap((port) => options.port = port), operators_1.concatMap(() => this._getBrowserOptions(options)), operators_1.tap((opts) => browserOptions = opts), operators_1.concatMap(() => utils_1.normalizeFileReplacements(browserOptions.fileReplacements, host, root)), operators_1.tap(fileReplacements => browserOptions.fileReplacements = fileReplacements), operators_1.concatMap(() => utils_1.normalizeAssetPatterns(browserOptions.assets, host, root, projectRoot, builderConfig.sourceRoot)), 
        // Replace the assets in options with the normalized version.
        operators_1.tap((assetPatternObjects => browserOptions.assets = assetPatternObjects)), operators_1.tap(() => {
            const normalizedOptions = utils_1.normalizeSourceMaps(browserOptions.sourceMap);
            // todo: remove when removing the deprecations
            normalizedOptions.vendorSourceMap
                = normalizedOptions.vendorSourceMap || !!browserOptions.vendorSourceMap;
            browserOptions = Object.assign({}, browserOptions, normalizedOptions);
        }), operators_1.concatMap(() => {
            const webpackConfig = this.buildWebpackConfig(root, projectRoot, host, browserOptions);
            let webpackDevServerConfig;
            try {
                webpackDevServerConfig = this._buildServerConfig(root, options, browserOptions);
            }
            catch (err) {
                return rxjs_1.throwError(err);
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
          Angular Live Development Server is listening on ${options.host}:${options.port},
          open your browser on ${serverAddress}${webpackDevServerConfig.publicPath}
          **
        `);
            opnAddress = serverAddress + webpackDevServerConfig.publicPath;
            webpackConfig.devServer = webpackDevServerConfig;
            return webpackDevServerBuilder.runWebpackDevServer(webpackConfig, undefined, browser_1.getBrowserLoggingCb(browserOptions.verbose));
        }), operators_1.map(buildEvent => {
            if (first && options.open) {
                first = false;
                opn(opnAddress);
            }
            return buildEvent;
        }));
    }
    buildWebpackConfig(root, projectRoot, host, browserOptions) {
        const browserBuilder = new browser_1.BrowserBuilder(this.context);
        const webpackConfig = browserBuilder.buildWebpackConfig(root, projectRoot, host, browserOptions);
        return webpackConfig;
    }
    _buildServerConfig(root, options, browserOptions) {
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
            host: options.host,
            port: options.port,
            headers: { 'Access-Control-Allow-Origin': '*' },
            historyApiFallback: {
                index: `${servePath}/${path.basename(browserOptions.index)}`,
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
            },
            stats: false,
            compress: browserOptions.optimization,
            watchOptions: {
                poll: browserOptions.poll,
            },
            https: options.ssl,
            overlay: {
                errors: !browserOptions.optimization,
                warnings: false,
            },
            public: options.publicHost,
            disableHostCheck: options.disableHostCheck,
            publicPath: servePath,
            hot: options.hmr,
            contentBase: false,
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
                this.context.logger.warn(core_1.tags.oneLine `To disable this warning use "hmrWarning: false" under "serve"
           options in "angular.json".`);
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
            config.https = {
                key: sslKey,
                cert: sslCert,
            };
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
        const overridesOptions = [
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
        // remove options that are undefined or not to be overrriden
        const overrides = Object.keys(options)
            .filter(key => options[key] !== undefined && overridesOptions.includes(key))
            .reduce((previous, key) => (Object.assign({}, previous, { [key]: options[key] })), {});
        const browserTargetSpec = { project, target, configuration, overrides };
        const builderConfig = architect.getBuilderConfiguration(browserTargetSpec);
        return architect.getBuilderDescription(builderConfig).pipe(operators_1.concatMap(browserDescription => architect.validateBuilderOptions(builderConfig, browserDescription)), operators_1.map(browserConfig => browserConfig.options));
    }
}
exports.DevServerBuilder = DevServerBuilder;
exports.default = DevServerBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2Rldi1zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFRSCxpRUFBd0U7QUFDeEUsK0NBQXFGO0FBQ3JGLDJCQUFxRDtBQUNyRCw2QkFBNkI7QUFDN0IsK0JBQThDO0FBQzlDLDhDQUFxRDtBQUNyRCwyQkFBMkI7QUFDM0IsbUNBQW1DO0FBRW5DLDBFQUFzRTtBQUN0RSx5Q0FBa0c7QUFFbEcsb0NBQWtHO0FBQ2xHLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQTRCM0IsTUFBYSxnQkFBZ0I7SUFFM0IsWUFBbUIsT0FBdUI7UUFBdkIsWUFBTyxHQUFQLE9BQU8sQ0FBZ0I7SUFBSSxDQUFDO0lBRS9DLEdBQUcsQ0FBQyxhQUE0RDtRQUM5RCxNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDO1FBQ3RDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztRQUN6QyxNQUFNLFdBQVcsR0FBRyxjQUFPLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxNQUFNLElBQUksR0FBRyxJQUFJLGdCQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBNkIsQ0FBQyxDQUFDO1FBQ2pGLE1BQU0sdUJBQXVCLEdBQUcsSUFBSSx1Q0FBdUIsbUJBQU0sSUFBSSxDQUFDLE9BQU8sSUFBRSxJQUFJLElBQUcsQ0FBQztRQUN2RixJQUFJLGNBQW9DLENBQUM7UUFDekMsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksVUFBa0IsQ0FBQztRQUV2QixPQUFPLHNCQUFTLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENB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O1FBRVQsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLFNBQVMsRUFBRSxDQUFDO1FBQ3hFLE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQyx1QkFBdUIsQ0FDckQsaUJBQWlCLENBQUMsQ0FBQztRQUVyQixPQUFPLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQ3hELHFCQUFTLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUM3QixTQUFTLENBQUMsc0JBQXNCLENBQUMsYUFBYSxFQUFFLGtCQUFrQixDQUFDLENBQUMsRUFDdEUsZUFBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUM1QyxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBMVhELDRDQTBYQztBQUVELGtCQUFlLGdCQUFnQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZEV2ZW50LFxuICBCdWlsZGVyLFxuICBCdWlsZGVyQ29uZmlndXJhdGlvbixcbiAgQnVpbGRlckNvbnRleHQsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgV2VicGFja0RldlNlcnZlckJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyBQYXRoLCBnZXRTeXN0ZW1QYXRoLCByZXNvbHZlLCB0YWdzLCB2aXJ0dWFsRnMgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBTdGF0cywgZXhpc3RzU3luYywgcmVhZEZpbGVTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIHRocm93RXJyb3IgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbWFwLCB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcbmltcG9ydCAqIGFzIHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgKiBhcyBXZWJwYWNrRGV2U2VydmVyIGZyb20gJ3dlYnBhY2stZGV2LXNlcnZlcic7XG5pbXBvcnQgeyBjaGVja1BvcnQgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvY2hlY2stcG9ydCc7XG5pbXBvcnQgeyBCcm93c2VyQnVpbGRlciwgTm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hLCBnZXRCcm93c2VyTG9nZ2luZ0NiIH0gZnJvbSAnLi4vYnJvd3Nlci8nO1xuaW1wb3J0IHsgQnJvd3NlckJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBub3JtYWxpemVBc3NldFBhdHRlcm5zLCBub3JtYWxpemVGaWxlUmVwbGFjZW1lbnRzLCBub3JtYWxpemVTb3VyY2VNYXBzIH0gZnJvbSAnLi4vdXRpbHMnO1xuY29uc3Qgb3BuID0gcmVxdWlyZSgnb3BuJyk7XG5cblxuZXhwb3J0IGludGVyZmFjZSBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyBleHRlbmRzIFBpY2s8QnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICdvcHRpbWl6YXRpb24nIHwgJ2FvdCcgfCAnc291cmNlTWFwJyB8ICd2ZW5kb3JTb3VyY2VNYXAnXG4gIHwgJ2V2YWxTb3VyY2VNYXAnIHwgJ3ZlbmRvckNodW5rJyB8ICdjb21tb25DaHVuaycgfCAncG9sbCdcbiAgfCAnYmFzZUhyZWYnIHwgJ2RlcGxveVVybCcgfCAncHJvZ3Jlc3MnIHwgJ3ZlcmJvc2UnXG4gID4ge1xuICBicm93c2VyVGFyZ2V0OiBzdHJpbmc7XG4gIHBvcnQ6IG51bWJlcjtcbiAgaG9zdDogc3RyaW5nO1xuICBwcm94eUNvbmZpZz86IHN0cmluZztcbiAgc3NsOiBib29sZWFuO1xuICBzc2xLZXk/OiBzdHJpbmc7XG4gIHNzbENlcnQ/OiBzdHJpbmc7XG4gIG9wZW46IGJvb2xlYW47XG4gIGxpdmVSZWxvYWQ6IGJvb2xlYW47XG4gIHB1YmxpY0hvc3Q/OiBzdHJpbmc7XG4gIHNlcnZlUGF0aD86IHN0cmluZztcbiAgZGlzYWJsZUhvc3RDaGVjazogYm9vbGVhbjtcbiAgaG1yOiBib29sZWFuO1xuICB3YXRjaDogYm9vbGVhbjtcbiAgaG1yV2FybmluZzogYm9vbGVhbjtcbiAgc2VydmVQYXRoRGVmYXVsdFdhcm5pbmc6IGJvb2xlYW47XG59XG5cbnR5cGUgRGV2U2VydmVyQnVpbGRlck9wdGlvbnNLZXlzID0gRXh0cmFjdDxrZXlvZiBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucywgc3RyaW5nPjtcblxuZXhwb3J0IGNsYXNzIERldlNlcnZlckJ1aWxkZXIgaW1wbGVtZW50cyBCdWlsZGVyPERldlNlcnZlckJ1aWxkZXJPcHRpb25zPiB7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KSB7IH1cblxuICBydW4oYnVpbGRlckNvbmZpZzogQnVpbGRlckNvbmZpZ3VyYXRpb248RGV2U2VydmVyQnVpbGRlck9wdGlvbnM+KTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGJ1aWxkZXJDb25maWcub3B0aW9ucztcbiAgICBjb25zdCByb290ID0gdGhpcy5jb250ZXh0LndvcmtzcGFjZS5yb290O1xuICAgIGNvbnN0IHByb2plY3RSb290ID0gcmVzb2x2ZShyb290LCBidWlsZGVyQ29uZmlnLnJvb3QpO1xuICAgIGNvbnN0IGhvc3QgPSBuZXcgdmlydHVhbEZzLkFsaWFzSG9zdCh0aGlzLmNvbnRleHQuaG9zdCBhcyB2aXJ0dWFsRnMuSG9zdDxTdGF0cz4pO1xuICAgIGNvbnN0IHdlYnBhY2tEZXZTZXJ2ZXJCdWlsZGVyID0gbmV3IFdlYnBhY2tEZXZTZXJ2ZXJCdWlsZGVyKHsgLi4udGhpcy5jb250ZXh0LCBob3N0IH0pO1xuICAgIGxldCBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWE7XG4gICAgbGV0IGZpcnN0ID0gdHJ1ZTtcbiAgICBsZXQgb3BuQWRkcmVzczogc3RyaW5nO1xuXG4gICAgcmV0dXJuIGNoZWNrUG9ydChvcHRpb25zLnBvcnQsIG9wdGlvbnMuaG9zdCkucGlwZShcbiAgICAgIHRhcCgocG9ydCkgPT4gb3B0aW9ucy5wb3J0ID0gcG9ydCksXG4gICAgICBjb25jYXRNYXAoKCkgPT4gdGhpcy5fZ2V0QnJvd3Nlck9wdGlvbnMob3B0aW9ucykpLFxuICAgICAgdGFwKChvcHRzKSA9PiBicm93c2VyT3B0aW9ucyA9IG9wdHMpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IG5vcm1hbGl6ZUZpbGVSZXBsYWNlbWVudHMoYnJvd3Nlck9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cywgaG9zdCwgcm9vdCkpLFxuICAgICAgdGFwKGZpbGVSZXBsYWNlbWVudHMgPT4gYnJvd3Nlck9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cyA9IGZpbGVSZXBsYWNlbWVudHMpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMoXG4gICAgICAgIGJyb3dzZXJPcHRpb25zLmFzc2V0cywgaG9zdCwgcm9vdCwgcHJvamVjdFJvb3QsIGJ1aWxkZXJDb25maWcuc291cmNlUm9vdCkpLFxuICAgICAgLy8gUmVwbGFjZSB0aGUgYXNzZXRzIGluIG9wdGlvbnMgd2l0aCB0aGUgbm9ybWFsaXplZCB2ZXJzaW9uLlxuICAgICAgdGFwKChhc3NldFBhdHRlcm5PYmplY3RzID0+IGJyb3dzZXJPcHRpb25zLmFzc2V0cyA9IGFzc2V0UGF0dGVybk9iamVjdHMpKSxcbiAgICAgIHRhcCgoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWRPcHRpb25zID0gbm9ybWFsaXplU291cmNlTWFwcyhicm93c2VyT3B0aW9ucy5zb3VyY2VNYXApO1xuICAgICAgICAvLyB0b2RvOiByZW1vdmUgd2hlbiByZW1vdmluZyB0aGUgZGVwcmVjYXRpb25zXG4gICAgICAgIG5vcm1hbGl6ZWRPcHRpb25zLnZlbmRvclNvdXJjZU1hcFxuICAgICAgICAgID0gbm9ybWFsaXplZE9wdGlvbnMudmVuZG9yU291cmNlTWFwIHx8ICEhYnJvd3Nlck9wdGlvbnMudmVuZG9yU291cmNlTWFwO1xuXG4gICAgICAgIGJyb3dzZXJPcHRpb25zID0ge1xuICAgICAgICAgIC4uLmJyb3dzZXJPcHRpb25zLFxuICAgICAgICAgIC4uLm5vcm1hbGl6ZWRPcHRpb25zLFxuICAgICAgICB9O1xuICAgICAgfSksXG4gICAgICBjb25jYXRNYXAoKCkgPT4ge1xuICAgICAgICBjb25zdCB3ZWJwYWNrQ29uZmlnID0gdGhpcy5idWlsZFdlYnBhY2tDb25maWcoXG4gICAgICAgICAgcm9vdCwgcHJvamVjdFJvb3QsIGhvc3QsIGJyb3dzZXJPcHRpb25zIGFzIE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYSk7XG5cbiAgICAgICAgbGV0IHdlYnBhY2tEZXZTZXJ2ZXJDb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXIuQ29uZmlndXJhdGlvbjtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB3ZWJwYWNrRGV2U2VydmVyQ29uZmlnID0gdGhpcy5fYnVpbGRTZXJ2ZXJDb25maWcocm9vdCwgb3B0aW9ucywgYnJvd3Nlck9wdGlvbnMpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gdGhyb3dFcnJvcihlcnIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzb2x2ZSBwdWJsaWMgaG9zdCBhbmQgY2xpZW50IGFkZHJlc3MuXG4gICAgICAgIGxldCBjbGllbnRBZGRyZXNzID0gYCR7b3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnfTovLzAuMC4wLjA6MGA7XG4gICAgICAgIGlmIChvcHRpb25zLnB1YmxpY0hvc3QpIHtcbiAgICAgICAgICBsZXQgcHVibGljSG9zdCA9IG9wdGlvbnMucHVibGljSG9zdDtcbiAgICAgICAgICBpZiAoIS9eXFx3KzpcXC9cXC8vLnRlc3QocHVibGljSG9zdCkpIHtcbiAgICAgICAgICAgIHB1YmxpY0hvc3QgPSBgJHtvcHRpb25zLnNzbCA/ICdodHRwcycgOiAnaHR0cCd9Oi8vJHtwdWJsaWNIb3N0fWA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGNsaWVudFVybCA9IHVybC5wYXJzZShwdWJsaWNIb3N0KTtcbiAgICAgICAgICBvcHRpb25zLnB1YmxpY0hvc3QgPSBjbGllbnRVcmwuaG9zdDtcbiAgICAgICAgICBjbGllbnRBZGRyZXNzID0gdXJsLmZvcm1hdChjbGllbnRVcmwpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzb2x2ZSBzZXJ2ZSBhZGRyZXNzLlxuICAgICAgICBjb25zdCBzZXJ2ZXJBZGRyZXNzID0gdXJsLmZvcm1hdCh7XG4gICAgICAgICAgcHJvdG9jb2w6IG9wdGlvbnMuc3NsID8gJ2h0dHBzJyA6ICdodHRwJyxcbiAgICAgICAgICBob3N0bmFtZTogb3B0aW9ucy5ob3N0ID09PSAnMC4wLjAuMCcgPyAnbG9jYWxob3N0JyA6IG9wdGlvbnMuaG9zdCxcbiAgICAgICAgICBwb3J0OiBvcHRpb25zLnBvcnQudG9TdHJpbmcoKSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWRkIGxpdmUgcmVsb2FkIGNvbmZpZy5cbiAgICAgICAgaWYgKG9wdGlvbnMubGl2ZVJlbG9hZCkge1xuICAgICAgICAgIHRoaXMuX2FkZExpdmVSZWxvYWQob3B0aW9ucywgYnJvd3Nlck9wdGlvbnMsIHdlYnBhY2tDb25maWcsIGNsaWVudEFkZHJlc3MpO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuaG1yKSB7XG4gICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKCdMaXZlIHJlbG9hZCBpcyBkaXNhYmxlZC4gSE1SIG9wdGlvbiBpZ25vcmVkLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLndhdGNoKSB7XG4gICAgICAgICAgLy8gVGhlcmUncyBubyBvcHRpb24gdG8gdHVybiBvZmYgZmlsZSB3YXRjaGluZyBpbiB3ZWJwYWNrLWRldi1zZXJ2ZXIsIGJ1dFxuICAgICAgICAgIC8vIHdlIGNhbiBvdmVycmlkZSB0aGUgZmlsZSB3YXRjaGVyIGluc3RlYWQuXG4gICAgICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnVuc2hpZnQoe1xuICAgICAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICAgICAgYXBwbHk6IChjb21waWxlcjogYW55KSA9PiB7XG4gICAgICAgICAgICAgIGNvbXBpbGVyLmhvb2tzLmFmdGVyRW52aXJvbm1lbnQudGFwKCdhbmd1bGFyLWNsaScsICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb21waWxlci53YXRjaEZpbGVTeXN0ZW0gPSB7IHdhdGNoOiAoKSA9PiB7IH0gfTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbikge1xuICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuZXJyb3IodGFncy5zdHJpcEluZGVudHNgXG4gICAgICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAgICBUaGlzIGlzIGEgc2ltcGxlIHNlcnZlciBmb3IgdXNlIGluIHRlc3Rpbmcgb3IgZGVidWdnaW5nIEFuZ3VsYXIgYXBwbGljYXRpb25zIGxvY2FsbHkuXG4gICAgICAgICAgICBJdCBoYXNuJ3QgYmVlbiByZXZpZXdlZCBmb3Igc2VjdXJpdHkgaXNzdWVzLlxuXG4gICAgICAgICAgICBET04nVCBVU0UgSVQgRk9SIFBST0RVQ1RJT04hXG4gICAgICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAgYCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmluZm8odGFncy5vbmVMaW5lYFxuICAgICAgICAgICoqXG4gICAgICAgICAgQW5ndWxhciBMaXZlIERldmVsb3BtZW50IFNlcnZlciBpcyBsaXN0ZW5pbmcgb24gJHtvcHRpb25zLmhvc3R9OiR7b3B0aW9ucy5wb3J0fSxcbiAgICAgICAgICBvcGVuIHlvdXIgYnJvd3NlciBvbiAke3NlcnZlckFkZHJlc3N9JHt3ZWJwYWNrRGV2U2VydmVyQ29uZmlnLnB1YmxpY1BhdGh9XG4gICAgICAgICAgKipcbiAgICAgICAgYCk7XG5cbiAgICAgICAgb3BuQWRkcmVzcyA9IHNlcnZlckFkZHJlc3MgKyB3ZWJwYWNrRGV2U2VydmVyQ29uZmlnLnB1YmxpY1BhdGg7XG4gICAgICAgIHdlYnBhY2tDb25maWcuZGV2U2VydmVyID0gd2VicGFja0RldlNlcnZlckNvbmZpZztcblxuICAgICAgICByZXR1cm4gd2VicGFja0RldlNlcnZlckJ1aWxkZXIucnVuV2VicGFja0RldlNlcnZlcihcbiAgICAgICAgICB3ZWJwYWNrQ29uZmlnLCB1bmRlZmluZWQsIGdldEJyb3dzZXJMb2dnaW5nQ2IoYnJvd3Nlck9wdGlvbnMudmVyYm9zZSksXG4gICAgICAgICk7XG4gICAgICB9KSxcbiAgICAgIG1hcChidWlsZEV2ZW50ID0+IHtcbiAgICAgICAgaWYgKGZpcnN0ICYmIG9wdGlvbnMub3Blbikge1xuICAgICAgICAgIGZpcnN0ID0gZmFsc2U7XG4gICAgICAgICAgb3BuKG9wbkFkZHJlc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJ1aWxkRXZlbnQ7XG4gICAgICB9KSxcbiAgICAgLy8gdXNpbmcgbW9yZSB0aGFuIDEwIG9wZXJhdG9ycyB3aWxsIGNhdXNlIHJ4anMgdG8gbG9vc2UgdGhlIHR5cGVzXG4gICAgKSBhcyBPYnNlcnZhYmxlPEJ1aWxkRXZlbnQ+O1xuICB9XG5cbiAgYnVpbGRXZWJwYWNrQ29uZmlnKFxuICAgIHJvb3Q6IFBhdGgsXG4gICAgcHJvamVjdFJvb3Q6IFBhdGgsXG4gICAgaG9zdDogdmlydHVhbEZzLkhvc3Q8U3RhdHM+LFxuICAgIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgKSB7XG4gICAgY29uc3QgYnJvd3NlckJ1aWxkZXIgPSBuZXcgQnJvd3NlckJ1aWxkZXIodGhpcy5jb250ZXh0KTtcbiAgICBjb25zdCB3ZWJwYWNrQ29uZmlnID0gYnJvd3NlckJ1aWxkZXIuYnVpbGRXZWJwYWNrQ29uZmlnKFxuICAgICAgcm9vdCwgcHJvamVjdFJvb3QsIGhvc3QsIGJyb3dzZXJPcHRpb25zIGFzIE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYSk7XG5cbiAgICByZXR1cm4gd2VicGFja0NvbmZpZztcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU2VydmVyQ29uZmlnKFxuICAgIHJvb3Q6IFBhdGgsXG4gICAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gICAgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICApIHtcbiAgICBjb25zdCBzeXN0ZW1Sb290ID0gZ2V0U3lzdGVtUGF0aChyb290KTtcbiAgICBpZiAob3B0aW9ucy5kaXNhYmxlSG9zdENoZWNrKSB7XG4gICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4odGFncy5vbmVMaW5lYFxuICAgICAgICBXQVJOSU5HOiBSdW5uaW5nIGEgc2VydmVyIHdpdGggLS1kaXNhYmxlLWhvc3QtY2hlY2sgaXMgYSBzZWN1cml0eSByaXNrLlxuICAgICAgICBTZWUgaHR0cHM6Ly9tZWRpdW0uY29tL3dlYnBhY2svd2VicGFjay1kZXYtc2VydmVyLW1pZGRsZXdhcmUtc2VjdXJpdHktaXNzdWVzLTE0ODlkOTUwODc0YVxuICAgICAgICBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cbiAgICAgIGApO1xuICAgIH1cblxuICAgIGNvbnN0IHNlcnZlUGF0aCA9IHRoaXMuX2J1aWxkU2VydmVQYXRoKG9wdGlvbnMsIGJyb3dzZXJPcHRpb25zKTtcblxuICAgIGNvbnN0IGNvbmZpZzogV2VicGFja0RldlNlcnZlci5Db25maWd1cmF0aW9uID0ge1xuICAgICAgaG9zdDogb3B0aW9ucy5ob3N0LFxuICAgICAgcG9ydDogb3B0aW9ucy5wb3J0LFxuICAgICAgaGVhZGVyczogeyAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonIH0sXG4gICAgICBoaXN0b3J5QXBpRmFsbGJhY2s6IHtcbiAgICAgICAgaW5kZXg6IGAke3NlcnZlUGF0aH0vJHtwYXRoLmJhc2VuYW1lKGJyb3dzZXJPcHRpb25zLmluZGV4KX1gLFxuICAgICAgICBkaXNhYmxlRG90UnVsZTogdHJ1ZSxcbiAgICAgICAgaHRtbEFjY2VwdEhlYWRlcnM6IFsndGV4dC9odG1sJywgJ2FwcGxpY2F0aW9uL3hodG1sK3htbCddLFxuICAgICAgfSBhcyBXZWJwYWNrRGV2U2VydmVyLkhpc3RvcnlBcGlGYWxsYmFja0NvbmZpZyxcbiAgICAgIHN0YXRzOiBmYWxzZSxcbiAgICAgIGNvbXByZXNzOiBicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24sXG4gICAgICB3YXRjaE9wdGlvbnM6IHtcbiAgICAgICAgcG9sbDogYnJvd3Nlck9wdGlvbnMucG9sbCxcbiAgICAgIH0sXG4gICAgICBodHRwczogb3B0aW9ucy5zc2wsXG4gICAgICBvdmVybGF5OiB7XG4gICAgICAgIGVycm9yczogIWJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbixcbiAgICAgICAgd2FybmluZ3M6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHB1YmxpYzogb3B0aW9ucy5wdWJsaWNIb3N0LFxuICAgICAgZGlzYWJsZUhvc3RDaGVjazogb3B0aW9ucy5kaXNhYmxlSG9zdENoZWNrLFxuICAgICAgcHVibGljUGF0aDogc2VydmVQYXRoLFxuICAgICAgaG90OiBvcHRpb25zLmhtcixcbiAgICAgIGNvbnRlbnRCYXNlOiBmYWxzZSxcbiAgICB9O1xuXG4gICAgaWYgKG9wdGlvbnMuc3NsKSB7XG4gICAgICB0aGlzLl9hZGRTc2xDb25maWcoc3lzdGVtUm9vdCwgb3B0aW9ucywgY29uZmlnKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5wcm94eUNvbmZpZykge1xuICAgICAgdGhpcy5fYWRkUHJveHlDb25maWcoc3lzdGVtUm9vdCwgb3B0aW9ucywgY29uZmlnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29uZmlnO1xuICB9XG5cbiAgcHJpdmF0ZSBfYWRkTGl2ZVJlbG9hZChcbiAgICBvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgICBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICAgd2VicGFja0NvbmZpZzogYW55LCAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuICAgIGNsaWVudEFkZHJlc3M6IHN0cmluZyxcbiAgKSB7XG4gICAgLy8gVGhpcyBhbGxvd3MgZm9yIGxpdmUgcmVsb2FkIG9mIHBhZ2Ugd2hlbiBjaGFuZ2VzIGFyZSBtYWRlIHRvIHJlcG8uXG4gICAgLy8gaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9jb25maWd1cmF0aW9uL2Rldi1zZXJ2ZXIvI2RldnNlcnZlci1pbmxpbmVcbiAgICBsZXQgd2VicGFja0RldlNlcnZlclBhdGg7XG4gICAgdHJ5IHtcbiAgICAgIHdlYnBhY2tEZXZTZXJ2ZXJQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCd3ZWJwYWNrLWRldi1zZXJ2ZXIvY2xpZW50Jyk7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBcIndlYnBhY2stZGV2LXNlcnZlclwiIHBhY2thZ2UgY291bGQgbm90IGJlIGZvdW5kLicpO1xuICAgIH1cbiAgICBjb25zdCBlbnRyeVBvaW50cyA9IFtgJHt3ZWJwYWNrRGV2U2VydmVyUGF0aH0/JHtjbGllbnRBZGRyZXNzfWBdO1xuICAgIGlmIChvcHRpb25zLmhtcikge1xuICAgICAgY29uc3Qgd2VicGFja0htckxpbmsgPSAnaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9ndWlkZXMvaG90LW1vZHVsZS1yZXBsYWNlbWVudCc7XG5cbiAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgdGFncy5vbmVMaW5lYE5PVElDRTogSG90IE1vZHVsZSBSZXBsYWNlbWVudCAoSE1SKSBpcyBlbmFibGVkIGZvciB0aGUgZGV2IHNlcnZlci5gKTtcblxuICAgICAgY29uc3Qgc2hvd1dhcm5pbmcgPSBvcHRpb25zLmhtcldhcm5pbmc7XG4gICAgICBpZiAoc2hvd1dhcm5pbmcpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5pbmZvKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgICAgIFRoZSBwcm9qZWN0IHdpbGwgc3RpbGwgbGl2ZSByZWxvYWQgd2hlbiBITVIgaXMgZW5hYmxlZCxcbiAgICAgICAgICBidXQgdG8gdGFrZSBhZHZhbnRhZ2Ugb2YgSE1SIGFkZGl0aW9uYWwgYXBwbGljYXRpb24gY29kZSBpcyByZXF1aXJlZCdcbiAgICAgICAgICAobm90IGluY2x1ZGVkIGluIGFuIEFuZ3VsYXIgQ0xJIHByb2plY3QgYnkgZGVmYXVsdCkuJ1xuICAgICAgICAgIFNlZSAke3dlYnBhY2tIbXJMaW5rfVxuICAgICAgICAgIGZvciBpbmZvcm1hdGlvbiBvbiB3b3JraW5nIHdpdGggSE1SIGZvciBXZWJwYWNrLmAsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgICB0YWdzLm9uZUxpbmVgVG8gZGlzYWJsZSB0aGlzIHdhcm5pbmcgdXNlIFwiaG1yV2FybmluZzogZmFsc2VcIiB1bmRlciBcInNlcnZlXCJcbiAgICAgICAgICAgb3B0aW9ucyBpbiBcImFuZ3VsYXIuanNvblwiLmAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBlbnRyeVBvaW50cy5wdXNoKCd3ZWJwYWNrL2hvdC9kZXYtc2VydmVyJyk7XG4gICAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMucHVzaChuZXcgd2VicGFjay5Ib3RNb2R1bGVSZXBsYWNlbWVudFBsdWdpbigpKTtcbiAgICAgIGlmIChicm93c2VyT3B0aW9ucy5leHRyYWN0Q3NzKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2Fybih0YWdzLm9uZUxpbmVgTk9USUNFOiAoSE1SKSBkb2VzIG5vdCBhbGxvdyBmb3IgQ1NTIGhvdCByZWxvYWRcbiAgICAgICAgICAgICAgICB3aGVuIHVzZWQgdG9nZXRoZXIgd2l0aCAnLS1leHRyYWN0LWNzcycuYCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghd2VicGFja0NvbmZpZy5lbnRyeS5tYWluKSB7IHdlYnBhY2tDb25maWcuZW50cnkubWFpbiA9IFtdOyB9XG4gICAgd2VicGFja0NvbmZpZy5lbnRyeS5tYWluLnVuc2hpZnQoLi4uZW50cnlQb2ludHMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfYWRkU3NsQ29uZmlnKFxuICAgIHJvb3Q6IHN0cmluZyxcbiAgICBvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgICBjb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXIuQ29uZmlndXJhdGlvbixcbiAgKSB7XG4gICAgbGV0IHNzbEtleTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGxldCBzc2xDZXJ0OiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgaWYgKG9wdGlvbnMuc3NsS2V5KSB7XG4gICAgICBjb25zdCBrZXlQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIG9wdGlvbnMuc3NsS2V5KTtcbiAgICAgIGlmIChleGlzdHNTeW5jKGtleVBhdGgpKSB7XG4gICAgICAgIHNzbEtleSA9IHJlYWRGaWxlU3luYyhrZXlQYXRoLCAndXRmLTgnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG9wdGlvbnMuc3NsQ2VydCkge1xuICAgICAgY29uc3QgY2VydFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgb3B0aW9ucy5zc2xDZXJ0KTtcbiAgICAgIGlmIChleGlzdHNTeW5jKGNlcnRQYXRoKSkge1xuICAgICAgICBzc2xDZXJ0ID0gcmVhZEZpbGVTeW5jKGNlcnRQYXRoLCAndXRmLTgnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25maWcuaHR0cHMgPSB0cnVlO1xuICAgIGlmIChzc2xLZXkgIT0gbnVsbCAmJiBzc2xDZXJ0ICE9IG51bGwpIHtcbiAgICAgIGNvbmZpZy5odHRwcyA9IHtcbiAgICAgICAga2V5OiBzc2xLZXksXG4gICAgICAgIGNlcnQ6IHNzbENlcnQsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2FkZFByb3h5Q29uZmlnKFxuICAgIHJvb3Q6IHN0cmluZyxcbiAgICBvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgICBjb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXIuQ29uZmlndXJhdGlvbixcbiAgKSB7XG4gICAgbGV0IHByb3h5Q29uZmlnID0ge307XG4gICAgY29uc3QgcHJveHlQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIG9wdGlvbnMucHJveHlDb25maWcgYXMgc3RyaW5nKTtcbiAgICBpZiAoZXhpc3RzU3luYyhwcm94eVBhdGgpKSB7XG4gICAgICBwcm94eUNvbmZpZyA9IHJlcXVpcmUocHJveHlQYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbWVzc2FnZSA9ICdQcm94eSBjb25maWcgZmlsZSAnICsgcHJveHlQYXRoICsgJyBkb2VzIG5vdCBleGlzdC4nO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgIH1cbiAgICBjb25maWcucHJveHkgPSBwcm94eUNvbmZpZztcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU2VydmVQYXRoKG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLCBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEpIHtcbiAgICBsZXQgc2VydmVQYXRoID0gb3B0aW9ucy5zZXJ2ZVBhdGg7XG4gICAgaWYgKCFzZXJ2ZVBhdGggJiYgc2VydmVQYXRoICE9PSAnJykge1xuICAgICAgY29uc3QgZGVmYXVsdFNlcnZlUGF0aCA9XG4gICAgICAgIHRoaXMuX2ZpbmREZWZhdWx0U2VydmVQYXRoKGJyb3dzZXJPcHRpb25zLmJhc2VIcmVmLCBicm93c2VyT3B0aW9ucy5kZXBsb3lVcmwpO1xuICAgICAgY29uc3Qgc2hvd1dhcm5pbmcgPSBvcHRpb25zLnNlcnZlUGF0aERlZmF1bHRXYXJuaW5nO1xuICAgICAgaWYgKGRlZmF1bHRTZXJ2ZVBhdGggPT0gbnVsbCAmJiBzaG93V2FybmluZykge1xuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4odGFncy5vbmVMaW5lYFxuICAgICAgICAgICAgV0FSTklORzogLS1kZXBsb3ktdXJsIGFuZC9vciAtLWJhc2UtaHJlZiBjb250YWluXG4gICAgICAgICAgICB1bnN1cHBvcnRlZCB2YWx1ZXMgZm9yIG5nIHNlcnZlLiAgRGVmYXVsdCBzZXJ2ZSBwYXRoIG9mICcvJyB1c2VkLlxuICAgICAgICAgICAgVXNlIC0tc2VydmUtcGF0aCB0byBvdmVycmlkZS5cbiAgICAgICAgICBgKTtcbiAgICAgIH1cbiAgICAgIHNlcnZlUGF0aCA9IGRlZmF1bHRTZXJ2ZVBhdGggfHwgJyc7XG4gICAgfVxuICAgIGlmIChzZXJ2ZVBhdGguZW5kc1dpdGgoJy8nKSkge1xuICAgICAgc2VydmVQYXRoID0gc2VydmVQYXRoLnN1YnN0cigwLCBzZXJ2ZVBhdGgubGVuZ3RoIC0gMSk7XG4gICAgfVxuICAgIGlmICghc2VydmVQYXRoLnN0YXJ0c1dpdGgoJy8nKSkge1xuICAgICAgc2VydmVQYXRoID0gYC8ke3NlcnZlUGF0aH1gO1xuICAgIH1cblxuICAgIHJldHVybiBzZXJ2ZVBhdGg7XG4gIH1cblxuICBwcml2YXRlIF9maW5kRGVmYXVsdFNlcnZlUGF0aChiYXNlSHJlZj86IHN0cmluZywgZGVwbG95VXJsPzogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgaWYgKCFiYXNlSHJlZiAmJiAhZGVwbG95VXJsKSB7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuXG4gICAgaWYgKC9eKFxcdys6KT9cXC9cXC8vLnRlc3QoYmFzZUhyZWYgfHwgJycpIHx8IC9eKFxcdys6KT9cXC9cXC8vLnRlc3QoZGVwbG95VXJsIHx8ICcnKSkge1xuICAgICAgLy8gSWYgYmFzZUhyZWYgb3IgZGVwbG95VXJsIGlzIGFic29sdXRlLCB1bnN1cHBvcnRlZCBieSBuZyBzZXJ2ZVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gbm9ybWFsaXplIGJhc2VIcmVmXG4gICAgLy8gZm9yIG5nIHNlcnZlIHRoZSBzdGFydGluZyBiYXNlIGlzIGFsd2F5cyBgL2Agc28gYSByZWxhdGl2ZVxuICAgIC8vIGFuZCByb290IHJlbGF0aXZlIHZhbHVlIGFyZSBpZGVudGljYWxcbiAgICBjb25zdCBiYXNlSHJlZlBhcnRzID0gKGJhc2VIcmVmIHx8ICcnKVxuICAgICAgLnNwbGl0KCcvJylcbiAgICAgIC5maWx0ZXIocGFydCA9PiBwYXJ0ICE9PSAnJyk7XG4gICAgaWYgKGJhc2VIcmVmICYmICFiYXNlSHJlZi5lbmRzV2l0aCgnLycpKSB7XG4gICAgICBiYXNlSHJlZlBhcnRzLnBvcCgpO1xuICAgIH1cbiAgICBjb25zdCBub3JtYWxpemVkQmFzZUhyZWYgPSBiYXNlSHJlZlBhcnRzLmxlbmd0aCA9PT0gMCA/ICcvJyA6IGAvJHtiYXNlSHJlZlBhcnRzLmpvaW4oJy8nKX0vYDtcblxuICAgIGlmIChkZXBsb3lVcmwgJiYgZGVwbG95VXJsWzBdID09PSAnLycpIHtcbiAgICAgIGlmIChiYXNlSHJlZiAmJiBiYXNlSHJlZlswXSA9PT0gJy8nICYmIG5vcm1hbGl6ZWRCYXNlSHJlZiAhPT0gZGVwbG95VXJsKSB7XG4gICAgICAgIC8vIElmIGJhc2VIcmVmIGFuZCBkZXBsb3lVcmwgYXJlIHJvb3QgcmVsYXRpdmUgYW5kIG5vdCBlcXVpdmFsZW50LCB1bnN1cHBvcnRlZCBieSBuZyBzZXJ2ZVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGRlcGxveVVybDtcbiAgICB9XG5cbiAgICAvLyBKb2luIHRvZ2V0aGVyIGJhc2VIcmVmIGFuZCBkZXBsb3lVcmxcbiAgICByZXR1cm4gYCR7bm9ybWFsaXplZEJhc2VIcmVmfSR7ZGVwbG95VXJsIHx8ICcnfWA7XG4gIH1cblxuICBwcml2YXRlIF9nZXRCcm93c2VyT3B0aW9ucyhvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucykge1xuICAgIGNvbnN0IGFyY2hpdGVjdCA9IHRoaXMuY29udGV4dC5hcmNoaXRlY3Q7XG4gICAgY29uc3QgW3Byb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbl0gPSBvcHRpb25zLmJyb3dzZXJUYXJnZXQuc3BsaXQoJzonKTtcblxuICAgIGNvbnN0IG92ZXJyaWRlc09wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zS2V5c1tdID0gW1xuICAgICAgJ3dhdGNoJyxcbiAgICAgICdvcHRpbWl6YXRpb24nLFxuICAgICAgJ2FvdCcsXG4gICAgICAnc291cmNlTWFwJyxcbiAgICAgICd2ZW5kb3JTb3VyY2VNYXAnLFxuICAgICAgJ2V2YWxTb3VyY2VNYXAnLFxuICAgICAgJ3ZlbmRvckNodW5rJyxcbiAgICAgICdjb21tb25DaHVuaycsXG4gICAgICAnYmFzZUhyZWYnLFxuICAgICAgJ3Byb2dyZXNzJyxcbiAgICAgICdwb2xsJyxcbiAgICAgICd2ZXJib3NlJyxcbiAgICAgICdkZXBsb3lVcmwnLFxuICAgIF07XG5cbiAgICAvLyByZW1vdmUgb3B0aW9ucyB0aGF0IGFyZSB1bmRlZmluZWQgb3Igbm90IHRvIGJlIG92ZXJycmlkZW5cbiAgICBjb25zdCBvdmVycmlkZXMgPSAoT2JqZWN0LmtleXMob3B0aW9ucykgYXMgRGV2U2VydmVyQnVpbGRlck9wdGlvbnNLZXlzW10pXG4gICAgICAuZmlsdGVyKGtleSA9PiBvcHRpb25zW2tleV0gIT09IHVuZGVmaW5lZCAmJiBvdmVycmlkZXNPcHRpb25zLmluY2x1ZGVzKGtleSkpXG4gICAgICAucmVkdWNlPFBhcnRpYWw8QnJvd3NlckJ1aWxkZXJTY2hlbWE+PigocHJldmlvdXMsIGtleSkgPT4gKFxuICAgICAgICB7XG4gICAgICAgICAgLi4ucHJldmlvdXMsXG4gICAgICAgICAgW2tleV06IG9wdGlvbnNba2V5XSxcbiAgICAgICAgfVxuICAgICAgKSwge30pO1xuXG4gICAgY29uc3QgYnJvd3NlclRhcmdldFNwZWMgPSB7IHByb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbiwgb3ZlcnJpZGVzIH07XG4gICAgY29uc3QgYnVpbGRlckNvbmZpZyA9IGFyY2hpdGVjdC5nZXRCdWlsZGVyQ29uZmlndXJhdGlvbjxCcm93c2VyQnVpbGRlclNjaGVtYT4oXG4gICAgICBicm93c2VyVGFyZ2V0U3BlYyk7XG5cbiAgICByZXR1cm4gYXJjaGl0ZWN0LmdldEJ1aWxkZXJEZXNjcmlwdGlvbihidWlsZGVyQ29uZmlnKS5waXBlKFxuICAgICAgY29uY2F0TWFwKGJyb3dzZXJEZXNjcmlwdGlvbiA9PlxuICAgICAgICBhcmNoaXRlY3QudmFsaWRhdGVCdWlsZGVyT3B0aW9ucyhidWlsZGVyQ29uZmlnLCBicm93c2VyRGVzY3JpcHRpb24pKSxcbiAgICAgIG1hcChicm93c2VyQ29uZmlnID0+IGJyb3dzZXJDb25maWcub3B0aW9ucyksXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBEZXZTZXJ2ZXJCdWlsZGVyO1xuIl19