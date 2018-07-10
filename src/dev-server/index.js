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
const _1 = require("../browser/");
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
        return check_port_1.checkPort(options.port, options.host).pipe(operators_1.tap((port) => options.port = port), operators_1.concatMap(() => this._getBrowserOptions(options)), operators_1.tap((opts) => browserOptions = opts), operators_1.concatMap(() => utils_1.addFileReplacements(root, host, browserOptions.fileReplacements)), operators_1.concatMap(() => utils_1.normalizeAssetPatterns(browserOptions.assets, host, root, projectRoot, builderConfig.sourceRoot)), 
        // Replace the assets in options with the normalized version.
        operators_1.tap((assetPatternObjects => browserOptions.assets = assetPatternObjects)), operators_1.concatMap(() => {
            const webpackConfig = this.buildWebpackConfig(root, projectRoot, host, browserOptions);
            let webpackDevServerConfig;
            try {
                webpackDevServerConfig = this._buildServerConfig(root, projectRoot, options, browserOptions);
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
            return webpackDevServerBuilder.runWebpackDevServer(webpackConfig, undefined, _1.getBrowserLoggingCb(browserOptions.verbose));
        }), operators_1.map(buildEvent => {
            if (first && options.open) {
                first = false;
                opn(opnAddress);
            }
            return buildEvent;
        }));
    }
    buildWebpackConfig(root, projectRoot, host, browserOptions) {
        const browserBuilder = new _1.BrowserBuilder(this.context);
        const webpackConfig = browserBuilder.buildWebpackConfig(root, projectRoot, host, browserOptions);
        return webpackConfig;
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
        const overrides = Object.assign({ 
            // Override browser build watch setting.
            watch: options.watch }, (options.optimization !== undefined ? { optimization: options.optimization } : {}), (options.aot !== undefined ? { aot: options.aot } : {}), (options.sourceMap !== undefined ? { sourceMap: options.sourceMap } : {}), (options.evalSourceMap !== undefined ? { evalSourceMap: options.evalSourceMap } : {}), (options.vendorChunk !== undefined ? { vendorChunk: options.vendorChunk } : {}), (options.commonChunk !== undefined ? { commonChunk: options.commonChunk } : {}), (options.baseHref !== undefined ? { baseHref: options.baseHref } : {}), (options.progress !== undefined ? { progress: options.progress } : {}), (options.poll !== undefined ? { poll: options.poll } : {}));
        const browserTargetSpec = { project, target, configuration, overrides };
        const builderConfig = architect.getBuilderConfiguration(browserTargetSpec);
        return architect.getBuilderDescription(builderConfig).pipe(operators_1.concatMap(browserDescription => architect.validateBuilderOptions(builderConfig, browserDescription)), operators_1.map(browserConfig => browserConfig.options));
    }
}
exports.DevServerBuilder = DevServerBuilder;
exports.default = DevServerBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2Rldi1zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFRSCxpRUFBd0U7QUFDeEUsK0NBQXFGO0FBQ3JGLDJCQUE4QztBQUU5Qyw2QkFBNkI7QUFDN0IsK0JBQThDO0FBQzlDLDhDQUFxRDtBQUNyRCwyQkFBMkI7QUFDM0IsbUNBQW1DO0FBRW5DLDBFQUFzRTtBQUN0RSxrQ0FBa0c7QUFFbEcsb0NBQXVFO0FBQ3ZFLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQWtDM0I7SUFFRSxZQUFtQixPQUF1QjtRQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtJQUFJLENBQUM7SUFFL0MsR0FBRyxDQUFDLGFBQTREO1FBQzlELE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7UUFDdEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3pDLE1BQU0sV0FBVyxHQUFHLGNBQU8sQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELE1BQU0sSUFBSSxHQUFHLElBQUksZ0JBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFnQyxDQUFDLENBQUM7UUFDcEYsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLHVDQUF1QixtQkFBTSxJQUFJLENBQUMsT0FBTyxJQUFFLElBQUksSUFBRyxDQUFDO1FBQ3ZGLElBQUksY0FBb0MsQ0FBQztRQUN6QyxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUM7UUFDakIsSUFBSSxVQUFrQixDQUFDO1FBRXZCLE1BQU0sQ0FBQyxzQkFBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUks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RSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFDdEUsQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFDdEUsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FDOUQsQ0FBQztRQUVGLE1BQU0saUJBQWlCLEdBQUcsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxTQUFTLEVBQUUsQ0FBQztRQUN4RSxNQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsdUJBQXVCLENBQ3JELGlCQUFpQixDQUFDLENBQUM7UUFFckIsTUFBTSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQ3hELHFCQUFTLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUM3QixTQUFTLENBQUMsc0JBQXNCLENBQUMsYUFBYSxFQUFFLGtCQUFrQixDQUFDLENBQUMsRUFDdEUsZUFBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUM1QyxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBcFdELDRDQW9XQztBQUVELGtCQUFlLGdCQUFnQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZEV2ZW50LFxuICBCdWlsZGVyLFxuICBCdWlsZGVyQ29uZmlndXJhdGlvbixcbiAgQnVpbGRlckNvbnRleHQsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgV2VicGFja0RldlNlcnZlckJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyBQYXRoLCBnZXRTeXN0ZW1QYXRoLCByZXNvbHZlLCB0YWdzLCB2aXJ0dWFsRnMgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBleGlzdHNTeW5jLCByZWFkRmlsZVN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgdGhyb3dFcnJvciB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAsIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHVybCBmcm9tICd1cmwnO1xuaW1wb3J0ICogYXMgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCAqIGFzIFdlYnBhY2tEZXZTZXJ2ZXIgZnJvbSAnd2VicGFjay1kZXYtc2VydmVyJztcbmltcG9ydCB7IGNoZWNrUG9ydCB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9jaGVjay1wb3J0JztcbmltcG9ydCB7IEJyb3dzZXJCdWlsZGVyLCBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsIGdldEJyb3dzZXJMb2dnaW5nQ2IgfSBmcm9tICcuLi9icm93c2VyLyc7XG5pbXBvcnQgeyBCcm93c2VyQnVpbGRlclNjaGVtYSB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IGFkZEZpbGVSZXBsYWNlbWVudHMsIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMgfSBmcm9tICcuLi91dGlscyc7XG5jb25zdCBvcG4gPSByZXF1aXJlKCdvcG4nKTtcblxuXG5leHBvcnQgaW50ZXJmYWNlIERldlNlcnZlckJ1aWxkZXJPcHRpb25zIHtcbiAgYnJvd3NlclRhcmdldDogc3RyaW5nO1xuICBwb3J0OiBudW1iZXI7XG4gIGhvc3Q6IHN0cmluZztcbiAgcHJveHlDb25maWc/OiBzdHJpbmc7XG4gIHNzbDogYm9vbGVhbjtcbiAgc3NsS2V5Pzogc3RyaW5nO1xuICBzc2xDZXJ0Pzogc3RyaW5nO1xuICBvcGVuOiBib29sZWFuO1xuICBsaXZlUmVsb2FkOiBib29sZWFuO1xuICBwdWJsaWNIb3N0Pzogc3RyaW5nO1xuICBzZXJ2ZVBhdGg/OiBzdHJpbmc7XG4gIGRpc2FibGVIb3N0Q2hlY2s6IGJvb2xlYW47XG4gIGhtcjogYm9vbGVhbjtcbiAgd2F0Y2g6IGJvb2xlYW47XG4gIGhtcldhcm5pbmc6IGJvb2xlYW47XG4gIHNlcnZlUGF0aERlZmF1bHRXYXJuaW5nOiBib29sZWFuO1xuXG4gIC8vIFRoZXNlIG9wdGlvbnMgY29tZSBmcm9tIHRoZSBicm93c2VyIGJ1aWxkZXIgYW5kIGFyZSBwcm92aWRlZCBoZXJlIGZvciBjb252ZW5pZW5jZS5cbiAgb3B0aW1pemF0aW9uPzogYm9vbGVhbjtcbiAgYW90PzogYm9vbGVhbjtcbiAgc291cmNlTWFwPzogYm9vbGVhbjtcbiAgZXZhbFNvdXJjZU1hcD86IGJvb2xlYW47XG4gIHZlbmRvckNodW5rPzogYm9vbGVhbjtcbiAgY29tbW9uQ2h1bms/OiBib29sZWFuO1xuICBiYXNlSHJlZj86IHN0cmluZztcbiAgcHJvZ3Jlc3M/OiBib29sZWFuO1xuICBwb2xsPzogbnVtYmVyO1xufVxuXG5cbmV4cG9ydCBjbGFzcyBEZXZTZXJ2ZXJCdWlsZGVyIGltcGxlbWVudHMgQnVpbGRlcjxEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucz4ge1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkgeyB9XG5cbiAgcnVuKGJ1aWxkZXJDb25maWc6IEJ1aWxkZXJDb25maWd1cmF0aW9uPERldlNlcnZlckJ1aWxkZXJPcHRpb25zPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnM7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdDtcbiAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5yb290KTtcbiAgICBjb25zdCBob3N0ID0gbmV3IHZpcnR1YWxGcy5BbGlhc0hvc3QodGhpcy5jb250ZXh0Lmhvc3QgYXMgdmlydHVhbEZzLkhvc3Q8ZnMuU3RhdHM+KTtcbiAgICBjb25zdCB3ZWJwYWNrRGV2U2VydmVyQnVpbGRlciA9IG5ldyBXZWJwYWNrRGV2U2VydmVyQnVpbGRlcih7IC4uLnRoaXMuY29udGV4dCwgaG9zdCB9KTtcbiAgICBsZXQgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hO1xuICAgIGxldCBmaXJzdCA9IHRydWU7XG4gICAgbGV0IG9wbkFkZHJlc3M6IHN0cmluZztcblxuICAgIHJldHVybiBjaGVja1BvcnQob3B0aW9ucy5wb3J0LCBvcHRpb25zLmhvc3QpLnBpcGUoXG4gICAgICB0YXAoKHBvcnQpID0+IG9wdGlvbnMucG9ydCA9IHBvcnQpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IHRoaXMuX2dldEJyb3dzZXJPcHRpb25zKG9wdGlvbnMpKSxcbiAgICAgIHRhcCgob3B0cykgPT4gYnJvd3Nlck9wdGlvbnMgPSBvcHRzKSxcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiBhZGRGaWxlUmVwbGFjZW1lbnRzKHJvb3QsIGhvc3QsIGJyb3dzZXJPcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpKSxcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiBub3JtYWxpemVBc3NldFBhdHRlcm5zKFxuICAgICAgICBicm93c2VyT3B0aW9ucy5hc3NldHMsIGhvc3QsIHJvb3QsIHByb2plY3RSb290LCBidWlsZGVyQ29uZmlnLnNvdXJjZVJvb3QpKSxcbiAgICAgIC8vIFJlcGxhY2UgdGhlIGFzc2V0cyBpbiBvcHRpb25zIHdpdGggdGhlIG5vcm1hbGl6ZWQgdmVyc2lvbi5cbiAgICAgIHRhcCgoYXNzZXRQYXR0ZXJuT2JqZWN0cyA9PiBicm93c2VyT3B0aW9ucy5hc3NldHMgPSBhc3NldFBhdHRlcm5PYmplY3RzKSksXG4gICAgICBjb25jYXRNYXAoKCkgPT4ge1xuICAgICAgICBjb25zdCB3ZWJwYWNrQ29uZmlnID0gdGhpcy5idWlsZFdlYnBhY2tDb25maWcoXG4gICAgICAgICAgcm9vdCwgcHJvamVjdFJvb3QsIGhvc3QsIGJyb3dzZXJPcHRpb25zIGFzIE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYSk7XG5cbiAgICAgICAgbGV0IHdlYnBhY2tEZXZTZXJ2ZXJDb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXIuQ29uZmlndXJhdGlvbjtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB3ZWJwYWNrRGV2U2VydmVyQ29uZmlnID0gdGhpcy5fYnVpbGRTZXJ2ZXJDb25maWcoXG4gICAgICAgICAgICByb290LCBwcm9qZWN0Um9vdCwgb3B0aW9ucywgYnJvd3Nlck9wdGlvbnMpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gdGhyb3dFcnJvcihlcnIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzb2x2ZSBwdWJsaWMgaG9zdCBhbmQgY2xpZW50IGFkZHJlc3MuXG4gICAgICAgIGxldCBjbGllbnRBZGRyZXNzID0gYCR7b3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnfTovLzAuMC4wLjA6MGA7XG4gICAgICAgIGlmIChvcHRpb25zLnB1YmxpY0hvc3QpIHtcbiAgICAgICAgICBsZXQgcHVibGljSG9zdCA9IG9wdGlvbnMucHVibGljSG9zdDtcbiAgICAgICAgICBpZiAoIS9eXFx3KzpcXC9cXC8vLnRlc3QocHVibGljSG9zdCkpIHtcbiAgICAgICAgICAgIHB1YmxpY0hvc3QgPSBgJHtvcHRpb25zLnNzbCA/ICdodHRwcycgOiAnaHR0cCd9Oi8vJHtwdWJsaWNIb3N0fWA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGNsaWVudFVybCA9IHVybC5wYXJzZShwdWJsaWNIb3N0KTtcbiAgICAgICAgICBvcHRpb25zLnB1YmxpY0hvc3QgPSBjbGllbnRVcmwuaG9zdDtcbiAgICAgICAgICBjbGllbnRBZGRyZXNzID0gdXJsLmZvcm1hdChjbGllbnRVcmwpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzb2x2ZSBzZXJ2ZSBhZGRyZXNzLlxuICAgICAgICBjb25zdCBzZXJ2ZXJBZGRyZXNzID0gdXJsLmZvcm1hdCh7XG4gICAgICAgICAgcHJvdG9jb2w6IG9wdGlvbnMuc3NsID8gJ2h0dHBzJyA6ICdodHRwJyxcbiAgICAgICAgICBob3N0bmFtZTogb3B0aW9ucy5ob3N0ID09PSAnMC4wLjAuMCcgPyAnbG9jYWxob3N0JyA6IG9wdGlvbnMuaG9zdCxcbiAgICAgICAgICBwb3J0OiBvcHRpb25zLnBvcnQudG9TdHJpbmcoKSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWRkIGxpdmUgcmVsb2FkIGNvbmZpZy5cbiAgICAgICAgaWYgKG9wdGlvbnMubGl2ZVJlbG9hZCkge1xuICAgICAgICAgIHRoaXMuX2FkZExpdmVSZWxvYWQob3B0aW9ucywgYnJvd3Nlck9wdGlvbnMsIHdlYnBhY2tDb25maWcsIGNsaWVudEFkZHJlc3MpO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuaG1yKSB7XG4gICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKCdMaXZlIHJlbG9hZCBpcyBkaXNhYmxlZC4gSE1SIG9wdGlvbiBpZ25vcmVkLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLndhdGNoKSB7XG4gICAgICAgICAgLy8gVGhlcmUncyBubyBvcHRpb24gdG8gdHVybiBvZmYgZmlsZSB3YXRjaGluZyBpbiB3ZWJwYWNrLWRldi1zZXJ2ZXIsIGJ1dFxuICAgICAgICAgIC8vIHdlIGNhbiBvdmVycmlkZSB0aGUgZmlsZSB3YXRjaGVyIGluc3RlYWQuXG4gICAgICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnVuc2hpZnQoe1xuICAgICAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICAgICAgYXBwbHk6IChjb21waWxlcjogYW55KSA9PiB7XG4gICAgICAgICAgICAgIGNvbXBpbGVyLmhvb2tzLmFmdGVyRW52aXJvbm1lbnQudGFwKCdhbmd1bGFyLWNsaScsICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb21waWxlci53YXRjaEZpbGVTeXN0ZW0gPSB7IHdhdGNoOiAoKSA9PiB7IH0gfTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbikge1xuICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuZXJyb3IodGFncy5zdHJpcEluZGVudHNgXG4gICAgICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAgICBUaGlzIGlzIGEgc2ltcGxlIHNlcnZlciBmb3IgdXNlIGluIHRlc3Rpbmcgb3IgZGVidWdnaW5nIEFuZ3VsYXIgYXBwbGljYXRpb25zIGxvY2FsbHkuXG4gICAgICAgICAgICBJdCBoYXNuJ3QgYmVlbiByZXZpZXdlZCBmb3Igc2VjdXJpdHkgaXNzdWVzLlxuXG4gICAgICAgICAgICBET04nVCBVU0UgSVQgRk9SIFBST0RVQ1RJT04hXG4gICAgICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAgYCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmluZm8odGFncy5vbmVMaW5lYFxuICAgICAgICAgICoqXG4gICAgICAgICAgQW5ndWxhciBMaXZlIERldmVsb3BtZW50IFNlcnZlciBpcyBsaXN0ZW5pbmcgb24gJHtvcHRpb25zLmhvc3R9OiR7b3B0aW9ucy5wb3J0fSxcbiAgICAgICAgICBvcGVuIHlvdXIgYnJvd3NlciBvbiAke3NlcnZlckFkZHJlc3N9JHt3ZWJwYWNrRGV2U2VydmVyQ29uZmlnLnB1YmxpY1BhdGh9XG4gICAgICAgICAgKipcbiAgICAgICAgYCk7XG5cbiAgICAgICAgb3BuQWRkcmVzcyA9IHNlcnZlckFkZHJlc3MgKyB3ZWJwYWNrRGV2U2VydmVyQ29uZmlnLnB1YmxpY1BhdGg7XG4gICAgICAgIHdlYnBhY2tDb25maWcuZGV2U2VydmVyID0gd2VicGFja0RldlNlcnZlckNvbmZpZztcblxuICAgICAgICByZXR1cm4gd2VicGFja0RldlNlcnZlckJ1aWxkZXIucnVuV2VicGFja0RldlNlcnZlcihcbiAgICAgICAgICB3ZWJwYWNrQ29uZmlnLCB1bmRlZmluZWQsIGdldEJyb3dzZXJMb2dnaW5nQ2IoYnJvd3Nlck9wdGlvbnMudmVyYm9zZSksXG4gICAgICAgICk7XG4gICAgICB9KSxcbiAgICAgIG1hcChidWlsZEV2ZW50ID0+IHtcbiAgICAgICAgaWYgKGZpcnN0ICYmIG9wdGlvbnMub3Blbikge1xuICAgICAgICAgIGZpcnN0ID0gZmFsc2U7XG4gICAgICAgICAgb3BuKG9wbkFkZHJlc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJ1aWxkRXZlbnQ7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgYnVpbGRXZWJwYWNrQ29uZmlnKFxuICAgIHJvb3Q6IFBhdGgsXG4gICAgcHJvamVjdFJvb3Q6IFBhdGgsXG4gICAgaG9zdDogdmlydHVhbEZzLkhvc3Q8ZnMuU3RhdHM+LFxuICAgIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgKSB7XG4gICAgY29uc3QgYnJvd3NlckJ1aWxkZXIgPSBuZXcgQnJvd3NlckJ1aWxkZXIodGhpcy5jb250ZXh0KTtcbiAgICBjb25zdCB3ZWJwYWNrQ29uZmlnID0gYnJvd3NlckJ1aWxkZXIuYnVpbGRXZWJwYWNrQ29uZmlnKFxuICAgICAgcm9vdCwgcHJvamVjdFJvb3QsIGhvc3QsIGJyb3dzZXJPcHRpb25zIGFzIE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYSk7XG5cbiAgICByZXR1cm4gd2VicGFja0NvbmZpZztcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU2VydmVyQ29uZmlnKFxuICAgIHJvb3Q6IFBhdGgsXG4gICAgcHJvamVjdFJvb3Q6IFBhdGgsXG4gICAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gICAgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICApIHtcbiAgICBjb25zdCBzeXN0ZW1Sb290ID0gZ2V0U3lzdGVtUGF0aChyb290KTtcbiAgICBpZiAob3B0aW9ucy5kaXNhYmxlSG9zdENoZWNrKSB7XG4gICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4odGFncy5vbmVMaW5lYFxuICAgICAgICBXQVJOSU5HOiBSdW5uaW5nIGEgc2VydmVyIHdpdGggLS1kaXNhYmxlLWhvc3QtY2hlY2sgaXMgYSBzZWN1cml0eSByaXNrLlxuICAgICAgICBTZWUgaHR0cHM6Ly9tZWRpdW0uY29tL3dlYnBhY2svd2VicGFjay1kZXYtc2VydmVyLW1pZGRsZXdhcmUtc2VjdXJpdHktaXNzdWVzLTE0ODlkOTUwODc0YVxuICAgICAgICBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cbiAgICAgIGApO1xuICAgIH1cblxuICAgIGNvbnN0IHNlcnZlUGF0aCA9IHRoaXMuX2J1aWxkU2VydmVQYXRoKG9wdGlvbnMsIGJyb3dzZXJPcHRpb25zKTtcblxuICAgIGNvbnN0IGNvbmZpZzogV2VicGFja0RldlNlcnZlci5Db25maWd1cmF0aW9uID0ge1xuICAgICAgaG9zdDogb3B0aW9ucy5ob3N0LFxuICAgICAgcG9ydDogb3B0aW9ucy5wb3J0LFxuICAgICAgaGVhZGVyczogeyAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonIH0sXG4gICAgICBoaXN0b3J5QXBpRmFsbGJhY2s6IHtcbiAgICAgICAgaW5kZXg6IGAke3NlcnZlUGF0aH0vJHtwYXRoLmJhc2VuYW1lKGJyb3dzZXJPcHRpb25zLmluZGV4KX1gLFxuICAgICAgICBkaXNhYmxlRG90UnVsZTogdHJ1ZSxcbiAgICAgICAgaHRtbEFjY2VwdEhlYWRlcnM6IFsndGV4dC9odG1sJywgJ2FwcGxpY2F0aW9uL3hodG1sK3htbCddLFxuICAgICAgfSxcbiAgICAgIHN0YXRzOiBmYWxzZSxcbiAgICAgIGNvbXByZXNzOiBicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24sXG4gICAgICB3YXRjaE9wdGlvbnM6IHtcbiAgICAgICAgcG9sbDogYnJvd3Nlck9wdGlvbnMucG9sbCxcbiAgICAgIH0sXG4gICAgICBodHRwczogb3B0aW9ucy5zc2wsXG4gICAgICBvdmVybGF5OiB7XG4gICAgICAgIGVycm9yczogIWJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbixcbiAgICAgICAgd2FybmluZ3M6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHB1YmxpYzogb3B0aW9ucy5wdWJsaWNIb3N0LFxuICAgICAgZGlzYWJsZUhvc3RDaGVjazogb3B0aW9ucy5kaXNhYmxlSG9zdENoZWNrLFxuICAgICAgcHVibGljUGF0aDogc2VydmVQYXRoLFxuICAgICAgaG90OiBvcHRpb25zLmhtcixcbiAgICB9O1xuXG4gICAgaWYgKG9wdGlvbnMuc3NsKSB7XG4gICAgICB0aGlzLl9hZGRTc2xDb25maWcoc3lzdGVtUm9vdCwgb3B0aW9ucywgY29uZmlnKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5wcm94eUNvbmZpZykge1xuICAgICAgdGhpcy5fYWRkUHJveHlDb25maWcoc3lzdGVtUm9vdCwgb3B0aW9ucywgY29uZmlnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29uZmlnO1xuICB9XG5cbiAgcHJpdmF0ZSBfYWRkTGl2ZVJlbG9hZChcbiAgICBvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgICBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICAgd2VicGFja0NvbmZpZzogYW55LCAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuICAgIGNsaWVudEFkZHJlc3M6IHN0cmluZyxcbiAgKSB7XG4gICAgLy8gVGhpcyBhbGxvd3MgZm9yIGxpdmUgcmVsb2FkIG9mIHBhZ2Ugd2hlbiBjaGFuZ2VzIGFyZSBtYWRlIHRvIHJlcG8uXG4gICAgLy8gaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9jb25maWd1cmF0aW9uL2Rldi1zZXJ2ZXIvI2RldnNlcnZlci1pbmxpbmVcbiAgICBsZXQgd2VicGFja0RldlNlcnZlclBhdGg7XG4gICAgdHJ5IHtcbiAgICAgIHdlYnBhY2tEZXZTZXJ2ZXJQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCd3ZWJwYWNrLWRldi1zZXJ2ZXIvY2xpZW50Jyk7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBcIndlYnBhY2stZGV2LXNlcnZlclwiIHBhY2thZ2UgY291bGQgbm90IGJlIGZvdW5kLicpO1xuICAgIH1cbiAgICBjb25zdCBlbnRyeVBvaW50cyA9IFtgJHt3ZWJwYWNrRGV2U2VydmVyUGF0aH0/JHtjbGllbnRBZGRyZXNzfWBdO1xuICAgIGlmIChvcHRpb25zLmhtcikge1xuICAgICAgY29uc3Qgd2VicGFja0htckxpbmsgPSAnaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9ndWlkZXMvaG90LW1vZHVsZS1yZXBsYWNlbWVudCc7XG5cbiAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgdGFncy5vbmVMaW5lYE5PVElDRTogSG90IE1vZHVsZSBSZXBsYWNlbWVudCAoSE1SKSBpcyBlbmFibGVkIGZvciB0aGUgZGV2IHNlcnZlci5gKTtcblxuICAgICAgY29uc3Qgc2hvd1dhcm5pbmcgPSBvcHRpb25zLmhtcldhcm5pbmc7XG4gICAgICBpZiAoc2hvd1dhcm5pbmcpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5pbmZvKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgICAgIFRoZSBwcm9qZWN0IHdpbGwgc3RpbGwgbGl2ZSByZWxvYWQgd2hlbiBITVIgaXMgZW5hYmxlZCxcbiAgICAgICAgICBidXQgdG8gdGFrZSBhZHZhbnRhZ2Ugb2YgSE1SIGFkZGl0aW9uYWwgYXBwbGljYXRpb24gY29kZSBpcyByZXF1aXJlZCdcbiAgICAgICAgICAobm90IGluY2x1ZGVkIGluIGFuIEFuZ3VsYXIgQ0xJIHByb2plY3QgYnkgZGVmYXVsdCkuJ1xuICAgICAgICAgIFNlZSAke3dlYnBhY2tIbXJMaW5rfVxuICAgICAgICAgIGZvciBpbmZvcm1hdGlvbiBvbiB3b3JraW5nIHdpdGggSE1SIGZvciBXZWJwYWNrLmAsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgICB0YWdzLm9uZUxpbmVgVG8gZGlzYWJsZSB0aGlzIHdhcm5pbmcgdXNlIFwiaG1yV2FybmluZzogZmFsc2VcIiB1bmRlciBcInNlcnZlXCJcbiAgICAgICAgICAgb3B0aW9ucyBpbiBcImFuZ3VsYXIuanNvblwiLmAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBlbnRyeVBvaW50cy5wdXNoKCd3ZWJwYWNrL2hvdC9kZXYtc2VydmVyJyk7XG4gICAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMucHVzaChuZXcgd2VicGFjay5Ib3RNb2R1bGVSZXBsYWNlbWVudFBsdWdpbigpKTtcbiAgICAgIGlmIChicm93c2VyT3B0aW9ucy5leHRyYWN0Q3NzKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2Fybih0YWdzLm9uZUxpbmVgTk9USUNFOiAoSE1SKSBkb2VzIG5vdCBhbGxvdyBmb3IgQ1NTIGhvdCByZWxvYWRcbiAgICAgICAgICAgICAgICB3aGVuIHVzZWQgdG9nZXRoZXIgd2l0aCAnLS1leHRyYWN0LWNzcycuYCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghd2VicGFja0NvbmZpZy5lbnRyeS5tYWluKSB7IHdlYnBhY2tDb25maWcuZW50cnkubWFpbiA9IFtdOyB9XG4gICAgd2VicGFja0NvbmZpZy5lbnRyeS5tYWluLnVuc2hpZnQoLi4uZW50cnlQb2ludHMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfYWRkU3NsQ29uZmlnKFxuICAgIHJvb3Q6IHN0cmluZyxcbiAgICBvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgICBjb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXIuQ29uZmlndXJhdGlvbixcbiAgKSB7XG4gICAgbGV0IHNzbEtleTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGxldCBzc2xDZXJ0OiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgaWYgKG9wdGlvbnMuc3NsS2V5KSB7XG4gICAgICBjb25zdCBrZXlQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIG9wdGlvbnMuc3NsS2V5IGFzIHN0cmluZyk7XG4gICAgICBpZiAoZXhpc3RzU3luYyhrZXlQYXRoKSkge1xuICAgICAgICBzc2xLZXkgPSByZWFkRmlsZVN5bmMoa2V5UGF0aCwgJ3V0Zi04Jyk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChvcHRpb25zLnNzbENlcnQpIHtcbiAgICAgIGNvbnN0IGNlcnRQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIG9wdGlvbnMuc3NsQ2VydCBhcyBzdHJpbmcpO1xuICAgICAgaWYgKGV4aXN0c1N5bmMoY2VydFBhdGgpKSB7XG4gICAgICAgIHNzbENlcnQgPSByZWFkRmlsZVN5bmMoY2VydFBhdGgsICd1dGYtOCcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbmZpZy5odHRwcyA9IHRydWU7XG4gICAgaWYgKHNzbEtleSAhPSBudWxsICYmIHNzbENlcnQgIT0gbnVsbCkge1xuICAgICAgY29uZmlnLmh0dHBzID0ge1xuICAgICAgICBrZXk6IHNzbEtleSxcbiAgICAgICAgY2VydDogc3NsQ2VydCxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYWRkUHJveHlDb25maWcoXG4gICAgcm9vdDogc3RyaW5nLFxuICAgIG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICAgIGNvbmZpZzogV2VicGFja0RldlNlcnZlci5Db25maWd1cmF0aW9uLFxuICApIHtcbiAgICBsZXQgcHJveHlDb25maWcgPSB7fTtcbiAgICBjb25zdCBwcm94eVBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgb3B0aW9ucy5wcm94eUNvbmZpZyBhcyBzdHJpbmcpO1xuICAgIGlmIChleGlzdHNTeW5jKHByb3h5UGF0aCkpIHtcbiAgICAgIHByb3h5Q29uZmlnID0gcmVxdWlyZShwcm94eVBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gJ1Byb3h5IGNvbmZpZyBmaWxlICcgKyBwcm94eVBhdGggKyAnIGRvZXMgbm90IGV4aXN0Lic7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgfVxuICAgIGNvbmZpZy5wcm94eSA9IHByb3h5Q29uZmlnO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRTZXJ2ZVBhdGgob3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSkge1xuICAgIGxldCBzZXJ2ZVBhdGggPSBvcHRpb25zLnNlcnZlUGF0aDtcbiAgICBpZiAoIXNlcnZlUGF0aCAmJiBzZXJ2ZVBhdGggIT09ICcnKSB7XG4gICAgICBjb25zdCBkZWZhdWx0U2VydmVQYXRoID1cbiAgICAgICAgdGhpcy5fZmluZERlZmF1bHRTZXJ2ZVBhdGgoYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYsIGJyb3dzZXJPcHRpb25zLmRlcGxveVVybCk7XG4gICAgICBjb25zdCBzaG93V2FybmluZyA9IG9wdGlvbnMuc2VydmVQYXRoRGVmYXVsdFdhcm5pbmc7XG4gICAgICBpZiAoZGVmYXVsdFNlcnZlUGF0aCA9PSBudWxsICYmIHNob3dXYXJuaW5nKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2Fybih0YWdzLm9uZUxpbmVgXG4gICAgICAgICAgICBXQVJOSU5HOiAtLWRlcGxveS11cmwgYW5kL29yIC0tYmFzZS1ocmVmIGNvbnRhaW5cbiAgICAgICAgICAgIHVuc3VwcG9ydGVkIHZhbHVlcyBmb3Igbmcgc2VydmUuICBEZWZhdWx0IHNlcnZlIHBhdGggb2YgJy8nIHVzZWQuXG4gICAgICAgICAgICBVc2UgLS1zZXJ2ZS1wYXRoIHRvIG92ZXJyaWRlLlxuICAgICAgICAgIGApO1xuICAgICAgfVxuICAgICAgc2VydmVQYXRoID0gZGVmYXVsdFNlcnZlUGF0aCB8fCAnJztcbiAgICB9XG4gICAgaWYgKHNlcnZlUGF0aC5lbmRzV2l0aCgnLycpKSB7XG4gICAgICBzZXJ2ZVBhdGggPSBzZXJ2ZVBhdGguc3Vic3RyKDAsIHNlcnZlUGF0aC5sZW5ndGggLSAxKTtcbiAgICB9XG4gICAgaWYgKCFzZXJ2ZVBhdGguc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgICBzZXJ2ZVBhdGggPSBgLyR7c2VydmVQYXRofWA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNlcnZlUGF0aDtcbiAgfVxuXG4gIHByaXZhdGUgX2ZpbmREZWZhdWx0U2VydmVQYXRoKGJhc2VIcmVmPzogc3RyaW5nLCBkZXBsb3lVcmw/OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBpZiAoIWJhc2VIcmVmICYmICFkZXBsb3lVcmwpIHtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG5cbiAgICBpZiAoL14oXFx3KzopP1xcL1xcLy8udGVzdChiYXNlSHJlZiB8fCAnJykgfHwgL14oXFx3KzopP1xcL1xcLy8udGVzdChkZXBsb3lVcmwgfHwgJycpKSB7XG4gICAgICAvLyBJZiBiYXNlSHJlZiBvciBkZXBsb3lVcmwgaXMgYWJzb2x1dGUsIHVuc3VwcG9ydGVkIGJ5IG5nIHNlcnZlXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBub3JtYWxpemUgYmFzZUhyZWZcbiAgICAvLyBmb3Igbmcgc2VydmUgdGhlIHN0YXJ0aW5nIGJhc2UgaXMgYWx3YXlzIGAvYCBzbyBhIHJlbGF0aXZlXG4gICAgLy8gYW5kIHJvb3QgcmVsYXRpdmUgdmFsdWUgYXJlIGlkZW50aWNhbFxuICAgIGNvbnN0IGJhc2VIcmVmUGFydHMgPSAoYmFzZUhyZWYgfHwgJycpXG4gICAgICAuc3BsaXQoJy8nKVxuICAgICAgLmZpbHRlcihwYXJ0ID0+IHBhcnQgIT09ICcnKTtcbiAgICBpZiAoYmFzZUhyZWYgJiYgIWJhc2VIcmVmLmVuZHNXaXRoKCcvJykpIHtcbiAgICAgIGJhc2VIcmVmUGFydHMucG9wKCk7XG4gICAgfVxuICAgIGNvbnN0IG5vcm1hbGl6ZWRCYXNlSHJlZiA9IGJhc2VIcmVmUGFydHMubGVuZ3RoID09PSAwID8gJy8nIDogYC8ke2Jhc2VIcmVmUGFydHMuam9pbignLycpfS9gO1xuXG4gICAgaWYgKGRlcGxveVVybCAmJiBkZXBsb3lVcmxbMF0gPT09ICcvJykge1xuICAgICAgaWYgKGJhc2VIcmVmICYmIGJhc2VIcmVmWzBdID09PSAnLycgJiYgbm9ybWFsaXplZEJhc2VIcmVmICE9PSBkZXBsb3lVcmwpIHtcbiAgICAgICAgLy8gSWYgYmFzZUhyZWYgYW5kIGRlcGxveVVybCBhcmUgcm9vdCByZWxhdGl2ZSBhbmQgbm90IGVxdWl2YWxlbnQsIHVuc3VwcG9ydGVkIGJ5IG5nIHNlcnZlXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZGVwbG95VXJsO1xuICAgIH1cblxuICAgIC8vIEpvaW4gdG9nZXRoZXIgYmFzZUhyZWYgYW5kIGRlcGxveVVybFxuICAgIHJldHVybiBgJHtub3JtYWxpemVkQmFzZUhyZWZ9JHtkZXBsb3lVcmwgfHwgJyd9YDtcbiAgfVxuXG4gIHByaXZhdGUgX2dldEJyb3dzZXJPcHRpb25zKG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zKSB7XG4gICAgY29uc3QgYXJjaGl0ZWN0ID0gdGhpcy5jb250ZXh0LmFyY2hpdGVjdDtcbiAgICBjb25zdCBbcHJvamVjdCwgdGFyZ2V0LCBjb25maWd1cmF0aW9uXSA9IG9wdGlvbnMuYnJvd3NlclRhcmdldC5zcGxpdCgnOicpO1xuXG4gICAgY29uc3Qgb3ZlcnJpZGVzID0ge1xuICAgICAgLy8gT3ZlcnJpZGUgYnJvd3NlciBidWlsZCB3YXRjaCBzZXR0aW5nLlxuICAgICAgd2F0Y2g6IG9wdGlvbnMud2F0Y2gsXG5cbiAgICAgIC8vIFVwZGF0ZSB0aGUgYnJvd3NlciBvcHRpb25zIHdpdGggdGhlIHNhbWUgb3B0aW9ucyB3ZSBzdXBwb3J0IGluIHNlcnZlLCBpZiBkZWZpbmVkLlxuICAgICAgLi4uKG9wdGlvbnMub3B0aW1pemF0aW9uICE9PSB1bmRlZmluZWQgPyB7IG9wdGltaXphdGlvbjogb3B0aW9ucy5vcHRpbWl6YXRpb24gfSA6IHt9KSxcbiAgICAgIC4uLihvcHRpb25zLmFvdCAhPT0gdW5kZWZpbmVkID8geyBhb3Q6IG9wdGlvbnMuYW90IH0gOiB7fSksXG4gICAgICAuLi4ob3B0aW9ucy5zb3VyY2VNYXAgIT09IHVuZGVmaW5lZCA/IHsgc291cmNlTWFwOiBvcHRpb25zLnNvdXJjZU1hcCB9IDoge30pLFxuICAgICAgLi4uKG9wdGlvbnMuZXZhbFNvdXJjZU1hcCAhPT0gdW5kZWZpbmVkID8geyBldmFsU291cmNlTWFwOiBvcHRpb25zLmV2YWxTb3VyY2VNYXAgfSA6IHt9KSxcbiAgICAgIC4uLihvcHRpb25zLnZlbmRvckNodW5rICE9PSB1bmRlZmluZWQgPyB7IHZlbmRvckNodW5rOiBvcHRpb25zLnZlbmRvckNodW5rIH0gOiB7fSksXG4gICAgICAuLi4ob3B0aW9ucy5jb21tb25DaHVuayAhPT0gdW5kZWZpbmVkID8geyBjb21tb25DaHVuazogb3B0aW9ucy5jb21tb25DaHVuayB9IDoge30pLFxuICAgICAgLi4uKG9wdGlvbnMuYmFzZUhyZWYgIT09IHVuZGVmaW5lZCA/IHsgYmFzZUhyZWY6IG9wdGlvbnMuYmFzZUhyZWYgfSA6IHt9KSxcbiAgICAgIC4uLihvcHRpb25zLnByb2dyZXNzICE9PSB1bmRlZmluZWQgPyB7IHByb2dyZXNzOiBvcHRpb25zLnByb2dyZXNzIH0gOiB7fSksXG4gICAgICAuLi4ob3B0aW9ucy5wb2xsICE9PSB1bmRlZmluZWQgPyB7IHBvbGw6IG9wdGlvbnMucG9sbCB9IDoge30pLFxuICAgIH07XG5cbiAgICBjb25zdCBicm93c2VyVGFyZ2V0U3BlYyA9IHsgcHJvamVjdCwgdGFyZ2V0LCBjb25maWd1cmF0aW9uLCBvdmVycmlkZXMgfTtcbiAgICBjb25zdCBidWlsZGVyQ29uZmlnID0gYXJjaGl0ZWN0LmdldEJ1aWxkZXJDb25maWd1cmF0aW9uPEJyb3dzZXJCdWlsZGVyU2NoZW1hPihcbiAgICAgIGJyb3dzZXJUYXJnZXRTcGVjKTtcblxuICAgIHJldHVybiBhcmNoaXRlY3QuZ2V0QnVpbGRlckRlc2NyaXB0aW9uKGJ1aWxkZXJDb25maWcpLnBpcGUoXG4gICAgICBjb25jYXRNYXAoYnJvd3NlckRlc2NyaXB0aW9uID0+XG4gICAgICAgIGFyY2hpdGVjdC52YWxpZGF0ZUJ1aWxkZXJPcHRpb25zKGJ1aWxkZXJDb25maWcsIGJyb3dzZXJEZXNjcmlwdGlvbikpLFxuICAgICAgbWFwKGJyb3dzZXJDb25maWcgPT4gYnJvd3NlckNvbmZpZy5vcHRpb25zKSxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IERldlNlcnZlckJ1aWxkZXI7XG4iXX0=