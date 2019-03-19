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
const browser_1 = require("../browser");
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
        return rxjs_1.from(check_port_1.checkPort(options.port || 0, options.host || 'localhost', 4200)).pipe(operators_1.tap((port) => options.port = port), operators_1.concatMap(() => this._getBrowserOptions(options)), operators_1.tap(opts => browserOptions = utils_1.normalizeBrowserSchema(host, root, core_1.resolve(root, builderConfig.root), builderConfig.sourceRoot, opts.options)), operators_1.concatMap(() => {
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
                // Port cannot be undefined here since we have a step that sets it back in options above.
                // tslint:disable-next-line:no-non-null-assertion
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
            if (browserOptions.optimization.scripts || browserOptions.optimization.styles) {
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
            return webpackDevServerBuilder.runWebpackDevServer(webpackConfig, undefined, browser_1.getBrowserLoggingCb(browserOptions.verbose || false));
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
        return browserBuilder.buildWebpackConfig(root, projectRoot, host, browserOptions);
    }
    _buildServerConfig(root, options, browserOptions) {
        const systemRoot = core_1.getSystemPath(root);
        if (options.host) {
            // Check that the host is either localhost or prints out a message.
            if (!/^127\.\d+\.\d+\.\d+/g.test(options.host) && options.host !== 'localhost') {
                this.context.logger.warn(core_1.tags.stripIndent `
          WARNING: This is a simple server for use in testing or debugging Angular applications
          locally. It hasn't been reviewed for security issues.

          Binding this server to an open connection can result in compromising your application or
          computer. Using a different host than the one passed to the "--host" flag might result in
          websocket connection issues. You might need to use "--disableHostCheck" if that's the
          case.
        `);
            }
        }
        if (options.disableHostCheck) {
            this.context.logger.warn(core_1.tags.oneLine `
        WARNING: Running a server with --disable-host-check is a security risk.
        See https://medium.com/webpack/webpack-dev-server-middleware-security-issues-1489d950874a
        for more information.
      `);
        }
        const servePath = this._buildServePath(options, browserOptions);
        const { styles, scripts } = browserOptions.optimization;
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
            compress: styles || scripts,
            watchOptions: {
                poll: browserOptions.poll,
            },
            https: options.ssl,
            overlay: {
                errors: !(styles || scripts),
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
        return architect.getBuilderDescription(builderConfig).pipe(operators_1.concatMap(browserDescription => architect.validateBuilderOptions(builderConfig, browserDescription)));
    }
}
exports.DevServerBuilder = DevServerBuilder;
exports.default = DevServerBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2Rldi1zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFRSCxpRUFBd0U7QUFDeEUsK0NBQXFGO0FBQ3JGLDJCQUFxRDtBQUNyRCw2QkFBNkI7QUFDN0IsK0JBQW9EO0FBQ3BELDhDQUFxRDtBQUNyRCwyQkFBMkI7QUFDM0IsbUNBQW1DO0FBRW5DLDBFQUFzRTtBQUN0RSx3Q0FBaUU7QUFFakUsb0NBR2tCO0FBRWxCLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUszQixNQUFhLGdCQUFnQjtJQUUzQixZQUFtQixPQUF1QjtRQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtJQUFJLENBQUM7SUFFL0MsR0FBRyxDQUFDLGFBQTJEO1FBQzdELE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7UUFDdEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3pDLE1BQU0sV0FBVyxHQUFHLGNBQU8sQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELE1BQU0sSUFBSSxHQUFHLElBQUksZ0JBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUE2QixDQUFDLENBQUM7UUFDakYsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLHVDQUF1QixtQkFBTSxJQUFJLENBQUMsT0FBTyxJQUFFLElBQUksSUFBRyxDQUFDO1FBQ3ZGLElBQUksY0FBOEMsQ0FBQztRQUNuRCxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUM7UUFDakIsSUFBSSxVQUFrQixDQUFDO1FBRXZCLE9BQU8sV0FBSSxDQUFDLHNCQUFTLENBQUMsT0FBTyxDQUFDLElBQUksSUFB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LENBQ3JELGlCQUFpQixDQUFDLENBQUM7UUFFckIsT0FBTyxTQUFTLENBQUMscUJBQXFCLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUN4RCxxQkFBUyxDQUFDLGtCQUFrQixDQUFDLEVBQUUsQ0FDN0IsU0FBUyxDQUFDLHNCQUFzQixDQUFDLGFBQWEsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDLENBQ3ZFLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFuWUQsNENBbVlDO0FBRUQsa0JBQWUsZ0JBQWdCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnQsXG4gIEJ1aWxkZXIsXG4gIEJ1aWxkZXJDb25maWd1cmF0aW9uLFxuICBCdWlsZGVyQ29udGV4dCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBXZWJwYWNrRGV2U2VydmVyQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJztcbmltcG9ydCB7IFBhdGgsIGdldFN5c3RlbVBhdGgsIHJlc29sdmUsIHRhZ3MsIHZpcnR1YWxGcyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IFN0YXRzLCBleGlzdHNTeW5jLCByZWFkRmlsZVN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSwgdGhyb3dFcnJvciB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAsIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHVybCBmcm9tICd1cmwnO1xuaW1wb3J0ICogYXMgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCAqIGFzIFdlYnBhY2tEZXZTZXJ2ZXIgZnJvbSAnd2VicGFjay1kZXYtc2VydmVyJztcbmltcG9ydCB7IGNoZWNrUG9ydCB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9jaGVjay1wb3J0JztcbmltcG9ydCB7IEJyb3dzZXJCdWlsZGVyLCBnZXRCcm93c2VyTG9nZ2luZ0NiIH0gZnJvbSAnLi4vYnJvd3Nlcic7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQge1xuICBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gIG5vcm1hbGl6ZUJyb3dzZXJTY2hlbWEsXG59IGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCB7IFNjaGVtYSBhcyBEZXZTZXJ2ZXJCdWlsZGVyU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuY29uc3Qgb3BuID0gcmVxdWlyZSgnb3BuJyk7XG5cblxudHlwZSBEZXZTZXJ2ZXJCdWlsZGVyU2NoZW1hS2V5cyA9IEV4dHJhY3Q8a2V5b2YgRGV2U2VydmVyQnVpbGRlclNjaGVtYSwgc3RyaW5nPjtcblxuZXhwb3J0IGNsYXNzIERldlNlcnZlckJ1aWxkZXIgaW1wbGVtZW50cyBCdWlsZGVyPERldlNlcnZlckJ1aWxkZXJTY2hlbWE+IHtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHsgfVxuXG4gIHJ1bihidWlsZGVyQ29uZmlnOiBCdWlsZGVyQ29uZmlndXJhdGlvbjxEZXZTZXJ2ZXJCdWlsZGVyU2NoZW1hPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnM7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdDtcbiAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5yb290KTtcbiAgICBjb25zdCBob3N0ID0gbmV3IHZpcnR1YWxGcy5BbGlhc0hvc3QodGhpcy5jb250ZXh0Lmhvc3QgYXMgdmlydHVhbEZzLkhvc3Q8U3RhdHM+KTtcbiAgICBjb25zdCB3ZWJwYWNrRGV2U2VydmVyQnVpbGRlciA9IG5ldyBXZWJwYWNrRGV2U2VydmVyQnVpbGRlcih7IC4uLnRoaXMuY29udGV4dCwgaG9zdCB9KTtcbiAgICBsZXQgYnJvd3Nlck9wdGlvbnM6IE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYTtcbiAgICBsZXQgZmlyc3QgPSB0cnVlO1xuICAgIGxldCBvcG5BZGRyZXNzOiBzdHJpbmc7XG5cbiAgICByZXR1cm4gZnJvbShjaGVja1BvcnQob3B0aW9ucy5wb3J0IHx8IDAsIG9wdGlvbnMuaG9zdCB8fCAnbG9jYWxob3N0JywgNDIwMCkpLnBpcGUoXG4gICAgICB0YXAoKHBvcnQpID0+IG9wdGlvbnMucG9ydCA9IHBvcnQpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IHRoaXMuX2dldEJyb3dzZXJPcHRpb25zKG9wdGlvbnMpKSxcbiAgICAgIHRhcChvcHRzID0+IGJyb3dzZXJPcHRpb25zID0gbm9ybWFsaXplQnJvd3NlclNjaGVtYShcbiAgICAgICAgaG9zdCxcbiAgICAgICAgcm9vdCxcbiAgICAgICAgcmVzb2x2ZShyb290LCBidWlsZGVyQ29uZmlnLnJvb3QpLFxuICAgICAgICBidWlsZGVyQ29uZmlnLnNvdXJjZVJvb3QsXG4gICAgICAgIG9wdHMub3B0aW9ucyxcbiAgICAgICkpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IHtcbiAgICAgICAgY29uc3Qgd2VicGFja0NvbmZpZyA9IHRoaXMuYnVpbGRXZWJwYWNrQ29uZmlnKHJvb3QsIHByb2plY3RSb290LCBob3N0LCBicm93c2VyT3B0aW9ucyk7XG5cbiAgICAgICAgbGV0IHdlYnBhY2tEZXZTZXJ2ZXJDb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXIuQ29uZmlndXJhdGlvbjtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB3ZWJwYWNrRGV2U2VydmVyQ29uZmlnID0gdGhpcy5fYnVpbGRTZXJ2ZXJDb25maWcoXG4gICAgICAgICAgICByb290LFxuICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgIGJyb3dzZXJPcHRpb25zLFxuICAgICAgICAgICk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIHJldHVybiB0aHJvd0Vycm9yKGVycik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXNvbHZlIHB1YmxpYyBob3N0IGFuZCBjbGllbnQgYWRkcmVzcy5cbiAgICAgICAgbGV0IGNsaWVudEFkZHJlc3MgPSBgJHtvcHRpb25zLnNzbCA/ICdodHRwcycgOiAnaHR0cCd9Oi8vMC4wLjAuMDowYDtcbiAgICAgICAgaWYgKG9wdGlvbnMucHVibGljSG9zdCkge1xuICAgICAgICAgIGxldCBwdWJsaWNIb3N0ID0gb3B0aW9ucy5wdWJsaWNIb3N0O1xuICAgICAgICAgIGlmICghL15cXHcrOlxcL1xcLy8udGVzdChwdWJsaWNIb3N0KSkge1xuICAgICAgICAgICAgcHVibGljSG9zdCA9IGAke29wdGlvbnMuc3NsID8gJ2h0dHBzJyA6ICdodHRwJ306Ly8ke3B1YmxpY0hvc3R9YDtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgY2xpZW50VXJsID0gdXJsLnBhcnNlKHB1YmxpY0hvc3QpO1xuICAgICAgICAgIG9wdGlvbnMucHVibGljSG9zdCA9IGNsaWVudFVybC5ob3N0O1xuICAgICAgICAgIGNsaWVudEFkZHJlc3MgPSB1cmwuZm9ybWF0KGNsaWVudFVybCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXNvbHZlIHNlcnZlIGFkZHJlc3MuXG4gICAgICAgIGNvbnN0IHNlcnZlckFkZHJlc3MgPSB1cmwuZm9ybWF0KHtcbiAgICAgICAgICBwcm90b2NvbDogb3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnLFxuICAgICAgICAgIGhvc3RuYW1lOiBvcHRpb25zLmhvc3QgPT09ICcwLjAuMC4wJyA/ICdsb2NhbGhvc3QnIDogb3B0aW9ucy5ob3N0LFxuICAgICAgICAgIC8vIFBvcnQgY2Fubm90IGJlIHVuZGVmaW5lZCBoZXJlIHNpbmNlIHdlIGhhdmUgYSBzdGVwIHRoYXQgc2V0cyBpdCBiYWNrIGluIG9wdGlvbnMgYWJvdmUuXG4gICAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgICAgIHBvcnQ6IG9wdGlvbnMucG9ydCAhLnRvU3RyaW5nKCksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZCBsaXZlIHJlbG9hZCBjb25maWcuXG4gICAgICAgIGlmIChvcHRpb25zLmxpdmVSZWxvYWQpIHtcbiAgICAgICAgICB0aGlzLl9hZGRMaXZlUmVsb2FkKG9wdGlvbnMsIGJyb3dzZXJPcHRpb25zLCB3ZWJwYWNrQ29uZmlnLCBjbGllbnRBZGRyZXNzKTtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmhtcikge1xuICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2FybignTGl2ZSByZWxvYWQgaXMgZGlzYWJsZWQuIEhNUiBvcHRpb24gaWdub3JlZC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghb3B0aW9ucy53YXRjaCkge1xuICAgICAgICAgIC8vIFRoZXJlJ3Mgbm8gb3B0aW9uIHRvIHR1cm4gb2ZmIGZpbGUgd2F0Y2hpbmcgaW4gd2VicGFjay1kZXYtc2VydmVyLCBidXRcbiAgICAgICAgICAvLyB3ZSBjYW4gb3ZlcnJpZGUgdGhlIGZpbGUgd2F0Y2hlciBpbnN0ZWFkLlxuICAgICAgICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy51bnNoaWZ0KHtcbiAgICAgICAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICAgICAgICAgIGFwcGx5OiAoY29tcGlsZXI6IGFueSkgPT4ge1xuICAgICAgICAgICAgICBjb21waWxlci5ob29rcy5hZnRlckVudmlyb25tZW50LnRhcCgnYW5ndWxhci1jbGknLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29tcGlsZXIud2F0Y2hGaWxlU3lzdGVtID0geyB3YXRjaDogKCkgPT4geyB9IH07XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24uc2NyaXB0cyB8fCBicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24uc3R5bGVzKSB7XG4gICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5lcnJvcih0YWdzLnN0cmlwSW5kZW50c2BcbiAgICAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICAgIFRoaXMgaXMgYSBzaW1wbGUgc2VydmVyIGZvciB1c2UgaW4gdGVzdGluZyBvciBkZWJ1Z2dpbmcgQW5ndWxhciBhcHBsaWNhdGlvbnMgbG9jYWxseS5cbiAgICAgICAgICAgIEl0IGhhc24ndCBiZWVuIHJldmlld2VkIGZvciBzZWN1cml0eSBpc3N1ZXMuXG5cbiAgICAgICAgICAgIERPTidUIFVTRSBJVCBGT1IgUFJPRFVDVElPTiFcbiAgICAgICAgICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgICBgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbyh0YWdzLm9uZUxpbmVgXG4gICAgICAgICAgKipcbiAgICAgICAgICBBbmd1bGFyIExpdmUgRGV2ZWxvcG1lbnQgU2VydmVyIGlzIGxpc3RlbmluZyBvbiAke29wdGlvbnMuaG9zdH06JHtvcHRpb25zLnBvcnR9LFxuICAgICAgICAgIG9wZW4geW91ciBicm93c2VyIG9uICR7c2VydmVyQWRkcmVzc30ke3dlYnBhY2tEZXZTZXJ2ZXJDb25maWcucHVibGljUGF0aH1cbiAgICAgICAgICAqKlxuICAgICAgICBgKTtcblxuICAgICAgICBvcG5BZGRyZXNzID0gc2VydmVyQWRkcmVzcyArIHdlYnBhY2tEZXZTZXJ2ZXJDb25maWcucHVibGljUGF0aDtcbiAgICAgICAgd2VicGFja0NvbmZpZy5kZXZTZXJ2ZXIgPSB3ZWJwYWNrRGV2U2VydmVyQ29uZmlnO1xuXG4gICAgICAgIHJldHVybiB3ZWJwYWNrRGV2U2VydmVyQnVpbGRlci5ydW5XZWJwYWNrRGV2U2VydmVyKFxuICAgICAgICAgIHdlYnBhY2tDb25maWcsIHVuZGVmaW5lZCwgZ2V0QnJvd3NlckxvZ2dpbmdDYihicm93c2VyT3B0aW9ucy52ZXJib3NlIHx8IGZhbHNlKSxcbiAgICAgICAgKTtcbiAgICAgIH0pLFxuICAgICAgbWFwKGJ1aWxkRXZlbnQgPT4ge1xuICAgICAgICBpZiAoZmlyc3QgJiYgb3B0aW9ucy5vcGVuKSB7XG4gICAgICAgICAgZmlyc3QgPSBmYWxzZTtcbiAgICAgICAgICBvcG4ob3BuQWRkcmVzcyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYnVpbGRFdmVudDtcbiAgICAgIH0pLFxuICAgICAgLy8gdXNpbmcgbW9yZSB0aGFuIDEwIG9wZXJhdG9ycyB3aWxsIGNhdXNlIHJ4anMgdG8gbG9vc2UgdGhlIHR5cGVzXG4gICAgKSBhcyBPYnNlcnZhYmxlPEJ1aWxkRXZlbnQ+O1xuICB9XG5cbiAgYnVpbGRXZWJwYWNrQ29uZmlnKFxuICAgIHJvb3Q6IFBhdGgsXG4gICAgcHJvamVjdFJvb3Q6IFBhdGgsXG4gICAgaG9zdDogdmlydHVhbEZzLkhvc3Q8U3RhdHM+LFxuICAgIGJyb3dzZXJPcHRpb25zOiBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICkge1xuICAgIGNvbnN0IGJyb3dzZXJCdWlsZGVyID0gbmV3IEJyb3dzZXJCdWlsZGVyKHRoaXMuY29udGV4dCk7XG5cbiAgICByZXR1cm4gYnJvd3NlckJ1aWxkZXIuYnVpbGRXZWJwYWNrQ29uZmlnKHJvb3QsIHByb2plY3RSb290LCBob3N0LCBicm93c2VyT3B0aW9ucyk7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFNlcnZlckNvbmZpZyhcbiAgICByb290OiBQYXRoLFxuICAgIG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJTY2hlbWEsXG4gICAgYnJvd3Nlck9wdGlvbnM6IE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgKSB7XG4gICAgY29uc3Qgc3lzdGVtUm9vdCA9IGdldFN5c3RlbVBhdGgocm9vdCk7XG4gICAgaWYgKG9wdGlvbnMuaG9zdCkge1xuICAgICAgLy8gQ2hlY2sgdGhhdCB0aGUgaG9zdCBpcyBlaXRoZXIgbG9jYWxob3N0IG9yIHByaW50cyBvdXQgYSBtZXNzYWdlLlxuICAgICAgaWYgKCEvXjEyN1xcLlxcZCtcXC5cXGQrXFwuXFxkKy9nLnRlc3Qob3B0aW9ucy5ob3N0KSAmJiBvcHRpb25zLmhvc3QgIT09ICdsb2NhbGhvc3QnKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2Fybih0YWdzLnN0cmlwSW5kZW50YFxuICAgICAgICAgIFdBUk5JTkc6IFRoaXMgaXMgYSBzaW1wbGUgc2VydmVyIGZvciB1c2UgaW4gdGVzdGluZyBvciBkZWJ1Z2dpbmcgQW5ndWxhciBhcHBsaWNhdGlvbnNcbiAgICAgICAgICBsb2NhbGx5LiBJdCBoYXNuJ3QgYmVlbiByZXZpZXdlZCBmb3Igc2VjdXJpdHkgaXNzdWVzLlxuXG4gICAgICAgICAgQmluZGluZyB0aGlzIHNlcnZlciB0byBhbiBvcGVuIGNvbm5lY3Rpb24gY2FuIHJlc3VsdCBpbiBjb21wcm9taXNpbmcgeW91ciBhcHBsaWNhdGlvbiBvclxuICAgICAgICAgIGNvbXB1dGVyLiBVc2luZyBhIGRpZmZlcmVudCBob3N0IHRoYW4gdGhlIG9uZSBwYXNzZWQgdG8gdGhlIFwiLS1ob3N0XCIgZmxhZyBtaWdodCByZXN1bHQgaW5cbiAgICAgICAgICB3ZWJzb2NrZXQgY29ubmVjdGlvbiBpc3N1ZXMuIFlvdSBtaWdodCBuZWVkIHRvIHVzZSBcIi0tZGlzYWJsZUhvc3RDaGVja1wiIGlmIHRoYXQncyB0aGVcbiAgICAgICAgICBjYXNlLlxuICAgICAgICBgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjaykge1xuICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKHRhZ3Mub25lTGluZWBcbiAgICAgICAgV0FSTklORzogUnVubmluZyBhIHNlcnZlciB3aXRoIC0tZGlzYWJsZS1ob3N0LWNoZWNrIGlzIGEgc2VjdXJpdHkgcmlzay5cbiAgICAgICAgU2VlIGh0dHBzOi8vbWVkaXVtLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LXNlcnZlci1taWRkbGV3YXJlLXNlY3VyaXR5LWlzc3Vlcy0xNDg5ZDk1MDg3NGFcbiAgICAgICAgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gICAgICBgKTtcbiAgICB9XG5cbiAgICBjb25zdCBzZXJ2ZVBhdGggPSB0aGlzLl9idWlsZFNlcnZlUGF0aChvcHRpb25zLCBicm93c2VyT3B0aW9ucyk7XG4gICAgY29uc3QgeyBzdHlsZXMsIHNjcmlwdHMgfSA9IGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbjtcblxuICAgIGNvbnN0IGNvbmZpZzogV2VicGFja0RldlNlcnZlci5Db25maWd1cmF0aW9uID0ge1xuICAgICAgaG9zdDogb3B0aW9ucy5ob3N0LFxuICAgICAgcG9ydDogb3B0aW9ucy5wb3J0LFxuICAgICAgaGVhZGVyczogeyAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonIH0sXG4gICAgICBoaXN0b3J5QXBpRmFsbGJhY2s6IHtcbiAgICAgICAgaW5kZXg6IGAke3NlcnZlUGF0aH0vJHtwYXRoLmJhc2VuYW1lKGJyb3dzZXJPcHRpb25zLmluZGV4KX1gLFxuICAgICAgICBkaXNhYmxlRG90UnVsZTogdHJ1ZSxcbiAgICAgICAgaHRtbEFjY2VwdEhlYWRlcnM6IFsndGV4dC9odG1sJywgJ2FwcGxpY2F0aW9uL3hodG1sK3htbCddLFxuICAgICAgfSBhcyBXZWJwYWNrRGV2U2VydmVyLkhpc3RvcnlBcGlGYWxsYmFja0NvbmZpZyxcbiAgICAgIHN0YXRzOiBmYWxzZSxcbiAgICAgIGNvbXByZXNzOiBzdHlsZXMgfHwgc2NyaXB0cyxcbiAgICAgIHdhdGNoT3B0aW9uczoge1xuICAgICAgICBwb2xsOiBicm93c2VyT3B0aW9ucy5wb2xsLFxuICAgICAgfSxcbiAgICAgIGh0dHBzOiBvcHRpb25zLnNzbCxcbiAgICAgIG92ZXJsYXk6IHtcbiAgICAgICAgZXJyb3JzOiAhKHN0eWxlcyB8fCBzY3JpcHRzKSxcbiAgICAgICAgd2FybmluZ3M6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHB1YmxpYzogb3B0aW9ucy5wdWJsaWNIb3N0LFxuICAgICAgZGlzYWJsZUhvc3RDaGVjazogb3B0aW9ucy5kaXNhYmxlSG9zdENoZWNrLFxuICAgICAgcHVibGljUGF0aDogc2VydmVQYXRoLFxuICAgICAgaG90OiBvcHRpb25zLmhtcixcbiAgICAgIGNvbnRlbnRCYXNlOiBmYWxzZSxcbiAgICB9O1xuXG4gICAgaWYgKG9wdGlvbnMuc3NsKSB7XG4gICAgICB0aGlzLl9hZGRTc2xDb25maWcoc3lzdGVtUm9vdCwgb3B0aW9ucywgY29uZmlnKTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5wcm94eUNvbmZpZykge1xuICAgICAgdGhpcy5fYWRkUHJveHlDb25maWcoc3lzdGVtUm9vdCwgb3B0aW9ucywgY29uZmlnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29uZmlnO1xuICB9XG5cbiAgcHJpdmF0ZSBfYWRkTGl2ZVJlbG9hZChcbiAgICBvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyU2NoZW1hLFxuICAgIGJyb3dzZXJPcHRpb25zOiBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICAgd2VicGFja0NvbmZpZzogYW55LCAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuICAgIGNsaWVudEFkZHJlc3M6IHN0cmluZyxcbiAgKSB7XG4gICAgLy8gVGhpcyBhbGxvd3MgZm9yIGxpdmUgcmVsb2FkIG9mIHBhZ2Ugd2hlbiBjaGFuZ2VzIGFyZSBtYWRlIHRvIHJlcG8uXG4gICAgLy8gaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9jb25maWd1cmF0aW9uL2Rldi1zZXJ2ZXIvI2RldnNlcnZlci1pbmxpbmVcbiAgICBsZXQgd2VicGFja0RldlNlcnZlclBhdGg7XG4gICAgdHJ5IHtcbiAgICAgIHdlYnBhY2tEZXZTZXJ2ZXJQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCd3ZWJwYWNrLWRldi1zZXJ2ZXIvY2xpZW50Jyk7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBcIndlYnBhY2stZGV2LXNlcnZlclwiIHBhY2thZ2UgY291bGQgbm90IGJlIGZvdW5kLicpO1xuICAgIH1cbiAgICBjb25zdCBlbnRyeVBvaW50cyA9IFtgJHt3ZWJwYWNrRGV2U2VydmVyUGF0aH0/JHtjbGllbnRBZGRyZXNzfWBdO1xuICAgIGlmIChvcHRpb25zLmhtcikge1xuICAgICAgY29uc3Qgd2VicGFja0htckxpbmsgPSAnaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9ndWlkZXMvaG90LW1vZHVsZS1yZXBsYWNlbWVudCc7XG5cbiAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgdGFncy5vbmVMaW5lYE5PVElDRTogSG90IE1vZHVsZSBSZXBsYWNlbWVudCAoSE1SKSBpcyBlbmFibGVkIGZvciB0aGUgZGV2IHNlcnZlci5gKTtcblxuICAgICAgY29uc3Qgc2hvd1dhcm5pbmcgPSBvcHRpb25zLmhtcldhcm5pbmc7XG4gICAgICBpZiAoc2hvd1dhcm5pbmcpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5pbmZvKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgICAgIFRoZSBwcm9qZWN0IHdpbGwgc3RpbGwgbGl2ZSByZWxvYWQgd2hlbiBITVIgaXMgZW5hYmxlZCxcbiAgICAgICAgICBidXQgdG8gdGFrZSBhZHZhbnRhZ2Ugb2YgSE1SIGFkZGl0aW9uYWwgYXBwbGljYXRpb24gY29kZSBpcyByZXF1aXJlZCdcbiAgICAgICAgICAobm90IGluY2x1ZGVkIGluIGFuIEFuZ3VsYXIgQ0xJIHByb2plY3QgYnkgZGVmYXVsdCkuJ1xuICAgICAgICAgIFNlZSAke3dlYnBhY2tIbXJMaW5rfVxuICAgICAgICAgIGZvciBpbmZvcm1hdGlvbiBvbiB3b3JraW5nIHdpdGggSE1SIGZvciBXZWJwYWNrLmAsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgICB0YWdzLm9uZUxpbmVgVG8gZGlzYWJsZSB0aGlzIHdhcm5pbmcgdXNlIFwiaG1yV2FybmluZzogZmFsc2VcIiB1bmRlciBcInNlcnZlXCJcbiAgICAgICAgICAgb3B0aW9ucyBpbiBcImFuZ3VsYXIuanNvblwiLmAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBlbnRyeVBvaW50cy5wdXNoKCd3ZWJwYWNrL2hvdC9kZXYtc2VydmVyJyk7XG4gICAgICB3ZWJwYWNrQ29uZmlnLnBsdWdpbnMucHVzaChuZXcgd2VicGFjay5Ib3RNb2R1bGVSZXBsYWNlbWVudFBsdWdpbigpKTtcbiAgICAgIGlmIChicm93c2VyT3B0aW9ucy5leHRyYWN0Q3NzKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2Fybih0YWdzLm9uZUxpbmVgTk9USUNFOiAoSE1SKSBkb2VzIG5vdCBhbGxvdyBmb3IgQ1NTIGhvdCByZWxvYWRcbiAgICAgICAgICAgICAgICB3aGVuIHVzZWQgdG9nZXRoZXIgd2l0aCAnLS1leHRyYWN0LWNzcycuYCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghd2VicGFja0NvbmZpZy5lbnRyeS5tYWluKSB7IHdlYnBhY2tDb25maWcuZW50cnkubWFpbiA9IFtdOyB9XG4gICAgd2VicGFja0NvbmZpZy5lbnRyeS5tYWluLnVuc2hpZnQoLi4uZW50cnlQb2ludHMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfYWRkU3NsQ29uZmlnKFxuICAgIHJvb3Q6IHN0cmluZyxcbiAgICBvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyU2NoZW1hLFxuICAgIGNvbmZpZzogV2VicGFja0RldlNlcnZlci5Db25maWd1cmF0aW9uLFxuICApIHtcbiAgICBsZXQgc3NsS2V5OiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgbGV0IHNzbENlcnQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBpZiAob3B0aW9ucy5zc2xLZXkpIHtcbiAgICAgIGNvbnN0IGtleVBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgb3B0aW9ucy5zc2xLZXkpO1xuICAgICAgaWYgKGV4aXN0c1N5bmMoa2V5UGF0aCkpIHtcbiAgICAgICAgc3NsS2V5ID0gcmVhZEZpbGVTeW5jKGtleVBhdGgsICd1dGYtOCcpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAob3B0aW9ucy5zc2xDZXJ0KSB7XG4gICAgICBjb25zdCBjZXJ0UGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBvcHRpb25zLnNzbENlcnQpO1xuICAgICAgaWYgKGV4aXN0c1N5bmMoY2VydFBhdGgpKSB7XG4gICAgICAgIHNzbENlcnQgPSByZWFkRmlsZVN5bmMoY2VydFBhdGgsICd1dGYtOCcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbmZpZy5odHRwcyA9IHRydWU7XG4gICAgaWYgKHNzbEtleSAhPSBudWxsICYmIHNzbENlcnQgIT0gbnVsbCkge1xuICAgICAgY29uZmlnLmh0dHBzID0ge1xuICAgICAgICBrZXk6IHNzbEtleSxcbiAgICAgICAgY2VydDogc3NsQ2VydCxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYWRkUHJveHlDb25maWcoXG4gICAgcm9vdDogc3RyaW5nLFxuICAgIG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJTY2hlbWEsXG4gICAgY29uZmlnOiBXZWJwYWNrRGV2U2VydmVyLkNvbmZpZ3VyYXRpb24sXG4gICkge1xuICAgIGxldCBwcm94eUNvbmZpZyA9IHt9O1xuICAgIGNvbnN0IHByb3h5UGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBvcHRpb25zLnByb3h5Q29uZmlnIGFzIHN0cmluZyk7XG4gICAgaWYgKGV4aXN0c1N5bmMocHJveHlQYXRoKSkge1xuICAgICAgcHJveHlDb25maWcgPSByZXF1aXJlKHByb3h5UGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSAnUHJveHkgY29uZmlnIGZpbGUgJyArIHByb3h5UGF0aCArICcgZG9lcyBub3QgZXhpc3QuJztcbiAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICB9XG4gICAgY29uZmlnLnByb3h5ID0gcHJveHlDb25maWc7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFNlcnZlUGF0aChcbiAgICBvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyU2NoZW1hLFxuICAgIGJyb3dzZXJPcHRpb25zOiBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICkge1xuICAgIGxldCBzZXJ2ZVBhdGggPSBvcHRpb25zLnNlcnZlUGF0aDtcbiAgICBpZiAoIXNlcnZlUGF0aCAmJiBzZXJ2ZVBhdGggIT09ICcnKSB7XG4gICAgICBjb25zdCBkZWZhdWx0U2VydmVQYXRoID1cbiAgICAgICAgdGhpcy5fZmluZERlZmF1bHRTZXJ2ZVBhdGgoYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYsIGJyb3dzZXJPcHRpb25zLmRlcGxveVVybCk7XG4gICAgICBjb25zdCBzaG93V2FybmluZyA9IG9wdGlvbnMuc2VydmVQYXRoRGVmYXVsdFdhcm5pbmc7XG4gICAgICBpZiAoZGVmYXVsdFNlcnZlUGF0aCA9PSBudWxsICYmIHNob3dXYXJuaW5nKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2Fybih0YWdzLm9uZUxpbmVgXG4gICAgICAgICAgICBXQVJOSU5HOiAtLWRlcGxveS11cmwgYW5kL29yIC0tYmFzZS1ocmVmIGNvbnRhaW5cbiAgICAgICAgICAgIHVuc3VwcG9ydGVkIHZhbHVlcyBmb3Igbmcgc2VydmUuICBEZWZhdWx0IHNlcnZlIHBhdGggb2YgJy8nIHVzZWQuXG4gICAgICAgICAgICBVc2UgLS1zZXJ2ZS1wYXRoIHRvIG92ZXJyaWRlLlxuICAgICAgICAgIGApO1xuICAgICAgfVxuICAgICAgc2VydmVQYXRoID0gZGVmYXVsdFNlcnZlUGF0aCB8fCAnJztcbiAgICB9XG4gICAgaWYgKHNlcnZlUGF0aC5lbmRzV2l0aCgnLycpKSB7XG4gICAgICBzZXJ2ZVBhdGggPSBzZXJ2ZVBhdGguc3Vic3RyKDAsIHNlcnZlUGF0aC5sZW5ndGggLSAxKTtcbiAgICB9XG4gICAgaWYgKCFzZXJ2ZVBhdGguc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgICBzZXJ2ZVBhdGggPSBgLyR7c2VydmVQYXRofWA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNlcnZlUGF0aDtcbiAgfVxuXG4gIHByaXZhdGUgX2ZpbmREZWZhdWx0U2VydmVQYXRoKGJhc2VIcmVmPzogc3RyaW5nLCBkZXBsb3lVcmw/OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBpZiAoIWJhc2VIcmVmICYmICFkZXBsb3lVcmwpIHtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG5cbiAgICBpZiAoL14oXFx3KzopP1xcL1xcLy8udGVzdChiYXNlSHJlZiB8fCAnJykgfHwgL14oXFx3KzopP1xcL1xcLy8udGVzdChkZXBsb3lVcmwgfHwgJycpKSB7XG4gICAgICAvLyBJZiBiYXNlSHJlZiBvciBkZXBsb3lVcmwgaXMgYWJzb2x1dGUsIHVuc3VwcG9ydGVkIGJ5IG5nIHNlcnZlXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBub3JtYWxpemUgYmFzZUhyZWZcbiAgICAvLyBmb3Igbmcgc2VydmUgdGhlIHN0YXJ0aW5nIGJhc2UgaXMgYWx3YXlzIGAvYCBzbyBhIHJlbGF0aXZlXG4gICAgLy8gYW5kIHJvb3QgcmVsYXRpdmUgdmFsdWUgYXJlIGlkZW50aWNhbFxuICAgIGNvbnN0IGJhc2VIcmVmUGFydHMgPSAoYmFzZUhyZWYgfHwgJycpXG4gICAgICAuc3BsaXQoJy8nKVxuICAgICAgLmZpbHRlcihwYXJ0ID0+IHBhcnQgIT09ICcnKTtcbiAgICBpZiAoYmFzZUhyZWYgJiYgIWJhc2VIcmVmLmVuZHNXaXRoKCcvJykpIHtcbiAgICAgIGJhc2VIcmVmUGFydHMucG9wKCk7XG4gICAgfVxuICAgIGNvbnN0IG5vcm1hbGl6ZWRCYXNlSHJlZiA9IGJhc2VIcmVmUGFydHMubGVuZ3RoID09PSAwID8gJy8nIDogYC8ke2Jhc2VIcmVmUGFydHMuam9pbignLycpfS9gO1xuXG4gICAgaWYgKGRlcGxveVVybCAmJiBkZXBsb3lVcmxbMF0gPT09ICcvJykge1xuICAgICAgaWYgKGJhc2VIcmVmICYmIGJhc2VIcmVmWzBdID09PSAnLycgJiYgbm9ybWFsaXplZEJhc2VIcmVmICE9PSBkZXBsb3lVcmwpIHtcbiAgICAgICAgLy8gSWYgYmFzZUhyZWYgYW5kIGRlcGxveVVybCBhcmUgcm9vdCByZWxhdGl2ZSBhbmQgbm90IGVxdWl2YWxlbnQsIHVuc3VwcG9ydGVkIGJ5IG5nIHNlcnZlXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZGVwbG95VXJsO1xuICAgIH1cblxuICAgIC8vIEpvaW4gdG9nZXRoZXIgYmFzZUhyZWYgYW5kIGRlcGxveVVybFxuICAgIHJldHVybiBgJHtub3JtYWxpemVkQmFzZUhyZWZ9JHtkZXBsb3lVcmwgfHwgJyd9YDtcbiAgfVxuXG4gIHByaXZhdGUgX2dldEJyb3dzZXJPcHRpb25zKG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJTY2hlbWEpIHtcbiAgICBjb25zdCBhcmNoaXRlY3QgPSB0aGlzLmNvbnRleHQuYXJjaGl0ZWN0O1xuICAgIGNvbnN0IFtwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb25dID0gb3B0aW9ucy5icm93c2VyVGFyZ2V0LnNwbGl0KCc6Jyk7XG5cbiAgICBjb25zdCBvdmVycmlkZXNPcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyU2NoZW1hS2V5c1tdID0gW1xuICAgICAgJ3dhdGNoJyxcbiAgICAgICdvcHRpbWl6YXRpb24nLFxuICAgICAgJ2FvdCcsXG4gICAgICAnc291cmNlTWFwJyxcbiAgICAgICd2ZW5kb3JTb3VyY2VNYXAnLFxuICAgICAgJ2V2YWxTb3VyY2VNYXAnLFxuICAgICAgJ3ZlbmRvckNodW5rJyxcbiAgICAgICdjb21tb25DaHVuaycsXG4gICAgICAnYmFzZUhyZWYnLFxuICAgICAgJ3Byb2dyZXNzJyxcbiAgICAgICdwb2xsJyxcbiAgICAgICd2ZXJib3NlJyxcbiAgICAgICdkZXBsb3lVcmwnLFxuICAgIF07XG5cbiAgICAvLyByZW1vdmUgb3B0aW9ucyB0aGF0IGFyZSB1bmRlZmluZWQgb3Igbm90IHRvIGJlIG92ZXJycmlkZW5cbiAgICBjb25zdCBvdmVycmlkZXMgPSAoT2JqZWN0LmtleXMob3B0aW9ucykgYXMgRGV2U2VydmVyQnVpbGRlclNjaGVtYUtleXNbXSlcbiAgICAgIC5maWx0ZXIoa2V5ID0+IG9wdGlvbnNba2V5XSAhPT0gdW5kZWZpbmVkICYmIG92ZXJyaWRlc09wdGlvbnMuaW5jbHVkZXMoa2V5KSlcbiAgICAgIC5yZWR1Y2U8UGFydGlhbDxCcm93c2VyQnVpbGRlclNjaGVtYT4+KChwcmV2aW91cywga2V5KSA9PiAoXG4gICAgICAgIHtcbiAgICAgICAgICAuLi5wcmV2aW91cyxcbiAgICAgICAgICBba2V5XTogb3B0aW9uc1trZXldLFxuICAgICAgICB9XG4gICAgICApLCB7fSk7XG5cbiAgICBjb25zdCBicm93c2VyVGFyZ2V0U3BlYyA9IHsgcHJvamVjdCwgdGFyZ2V0LCBjb25maWd1cmF0aW9uLCBvdmVycmlkZXMgfTtcbiAgICBjb25zdCBidWlsZGVyQ29uZmlnID0gYXJjaGl0ZWN0LmdldEJ1aWxkZXJDb25maWd1cmF0aW9uPEJyb3dzZXJCdWlsZGVyU2NoZW1hPihcbiAgICAgIGJyb3dzZXJUYXJnZXRTcGVjKTtcblxuICAgIHJldHVybiBhcmNoaXRlY3QuZ2V0QnVpbGRlckRlc2NyaXB0aW9uKGJ1aWxkZXJDb25maWcpLnBpcGUoXG4gICAgICBjb25jYXRNYXAoYnJvd3NlckRlc2NyaXB0aW9uID0+XG4gICAgICAgIGFyY2hpdGVjdC52YWxpZGF0ZUJ1aWxkZXJPcHRpb25zKGJ1aWxkZXJDb25maWcsIGJyb3dzZXJEZXNjcmlwdGlvbikpLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRGV2U2VydmVyQnVpbGRlcjtcbiJdfQ==