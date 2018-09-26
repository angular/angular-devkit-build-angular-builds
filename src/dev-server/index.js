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
            watch: options.watch }, (options.optimization !== undefined ? { optimization: options.optimization } : {}), (options.aot !== undefined ? { aot: options.aot } : {}), (options.sourceMap !== undefined ? { sourceMap: options.sourceMap } : {}), (options.vendorSourceMap !== undefined ?
            { vendorSourceMap: options.vendorSourceMap } : {}), (options.evalSourceMap !== undefined ? { evalSourceMap: options.evalSourceMap } : {}), (options.vendorChunk !== undefined ? { vendorChunk: options.vendorChunk } : {}), (options.commonChunk !== undefined ? { commonChunk: options.commonChunk } : {}), (options.baseHref !== undefined ? { baseHref: options.baseHref } : {}), (options.progress !== undefined ? { progress: options.progress } : {}), (options.poll !== undefined ? { poll: options.poll } : {}), (options.verbose !== undefined ? { verbose: options.verbose } : {}));
        const browserTargetSpec = { project, target, configuration, overrides };
        const builderConfig = architect.getBuilderConfiguration(browserTargetSpec);
        return architect.getBuilderDescription(builderConfig).pipe(operators_1.concatMap(browserDescription => architect.validateBuilderOptions(builderConfig, browserDescription)), operators_1.map(browserConfig => browserConfig.options));
    }
}
exports.DevServerBuilder = DevServerBuilder;
exports.default = DevServerBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2Rldi1zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFRSCxpRUFBd0U7QUFDeEUsK0NBQXFGO0FBQ3JGLDJCQUFxRDtBQUNyRCw2QkFBNkI7QUFDN0IsK0JBQThDO0FBQzlDLDhDQUFxRDtBQUNyRCwyQkFBMkI7QUFDM0IsbUNBQW1DO0FBRW5DLDBFQUFzRTtBQUN0RSx5Q0FBa0c7QUFFbEcsb0NBQTZFO0FBQzdFLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQW9DM0IsTUFBYSxnQkFBZ0I7SUFFM0IsWUFBbUIsT0FBdUI7UUFBdkIsWUFBTyxHQUFQLE9BQU8sQ0FBZ0I7SUFBSSxDQUFDO0lBRS9DLEdBQUcsQ0FBQyxhQUE0RDtRQUM5RCxNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDO1FBQ3RDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztRQUN6QyxNQUFNLFdBQVcsR0FBRyxjQUFPLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxNQUFNLElBQUksR0FBRyxJQUFJLGdCQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBNkIsQ0FBQyxDQUFDO1FBQ2pGLE1BQU0sdUJBQXVCLEdBQUcsSUFBSSx1Q0FBdUIsbUJBQU0sSUFBSSxDQUFDLE9BQU8sSUFBRSxJQUFJLElBQUcsQ0FBQztRQUN2RixJQUFJLGNBQW9DLENBQUM7UUFDekMsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksVUFBa0IsQ0FBQztRQUV2QixPQUFPLHNCQUFTLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENB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T0FBTyxDQUFDLENBQzVDLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUF4V0QsNENBd1dDO0FBRUQsa0JBQWUsZ0JBQWdCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnQsXG4gIEJ1aWxkZXIsXG4gIEJ1aWxkZXJDb25maWd1cmF0aW9uLFxuICBCdWlsZGVyQ29udGV4dCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBXZWJwYWNrRGV2U2VydmVyQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJztcbmltcG9ydCB7IFBhdGgsIGdldFN5c3RlbVBhdGgsIHJlc29sdmUsIHRhZ3MsIHZpcnR1YWxGcyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IFN0YXRzLCBleGlzdHNTeW5jLCByZWFkRmlsZVN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgdGhyb3dFcnJvciB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAsIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHVybCBmcm9tICd1cmwnO1xuaW1wb3J0ICogYXMgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCAqIGFzIFdlYnBhY2tEZXZTZXJ2ZXIgZnJvbSAnd2VicGFjay1kZXYtc2VydmVyJztcbmltcG9ydCB7IGNoZWNrUG9ydCB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9jaGVjay1wb3J0JztcbmltcG9ydCB7IEJyb3dzZXJCdWlsZGVyLCBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsIGdldEJyb3dzZXJMb2dnaW5nQ2IgfSBmcm9tICcuLi9icm93c2VyLyc7XG5pbXBvcnQgeyBCcm93c2VyQnVpbGRlclNjaGVtYSB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMsIG5vcm1hbGl6ZUZpbGVSZXBsYWNlbWVudHMgfSBmcm9tICcuLi91dGlscyc7XG5jb25zdCBvcG4gPSByZXF1aXJlKCdvcG4nKTtcblxuXG5leHBvcnQgaW50ZXJmYWNlIERldlNlcnZlckJ1aWxkZXJPcHRpb25zIHtcbiAgYnJvd3NlclRhcmdldDogc3RyaW5nO1xuICBwb3J0OiBudW1iZXI7XG4gIGhvc3Q6IHN0cmluZztcbiAgcHJveHlDb25maWc/OiBzdHJpbmc7XG4gIHNzbDogYm9vbGVhbjtcbiAgc3NsS2V5Pzogc3RyaW5nO1xuICBzc2xDZXJ0Pzogc3RyaW5nO1xuICBvcGVuOiBib29sZWFuO1xuICBsaXZlUmVsb2FkOiBib29sZWFuO1xuICBwdWJsaWNIb3N0Pzogc3RyaW5nO1xuICBzZXJ2ZVBhdGg/OiBzdHJpbmc7XG4gIGRpc2FibGVIb3N0Q2hlY2s6IGJvb2xlYW47XG4gIGhtcjogYm9vbGVhbjtcbiAgd2F0Y2g6IGJvb2xlYW47XG4gIGhtcldhcm5pbmc6IGJvb2xlYW47XG4gIHNlcnZlUGF0aERlZmF1bHRXYXJuaW5nOiBib29sZWFuO1xuXG4gIC8vIFRoZXNlIG9wdGlvbnMgY29tZSBmcm9tIHRoZSBicm93c2VyIGJ1aWxkZXIgYW5kIGFyZSBwcm92aWRlZCBoZXJlIGZvciBjb252ZW5pZW5jZS5cbiAgb3B0aW1pemF0aW9uPzogYm9vbGVhbjtcbiAgYW90PzogYm9vbGVhbjtcbiAgc291cmNlTWFwPzogYm9vbGVhbjtcbiAgdmVuZG9yU291cmNlTWFwPzogYm9vbGVhbjtcbiAgZXZhbFNvdXJjZU1hcD86IGJvb2xlYW47XG4gIHZlbmRvckNodW5rPzogYm9vbGVhbjtcbiAgY29tbW9uQ2h1bms/OiBib29sZWFuO1xuICBiYXNlSHJlZj86IHN0cmluZztcbiAgcHJvZ3Jlc3M/OiBib29sZWFuO1xuICBwb2xsPzogbnVtYmVyO1xuICB2ZXJib3NlPzogYm9vbGVhbjtcbn1cblxuXG5leHBvcnQgY2xhc3MgRGV2U2VydmVyQnVpbGRlciBpbXBsZW1lbnRzIEJ1aWxkZXI8RGV2U2VydmVyQnVpbGRlck9wdGlvbnM+IHtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHsgfVxuXG4gIHJ1bihidWlsZGVyQ29uZmlnOiBCdWlsZGVyQ29uZmlndXJhdGlvbjxEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucz4pOiBPYnNlcnZhYmxlPEJ1aWxkRXZlbnQ+IHtcbiAgICBjb25zdCBvcHRpb25zID0gYnVpbGRlckNvbmZpZy5vcHRpb25zO1xuICAgIGNvbnN0IHJvb3QgPSB0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3Q7XG4gICAgY29uc3QgcHJvamVjdFJvb3QgPSByZXNvbHZlKHJvb3QsIGJ1aWxkZXJDb25maWcucm9vdCk7XG4gICAgY29uc3QgaG9zdCA9IG5ldyB2aXJ0dWFsRnMuQWxpYXNIb3N0KHRoaXMuY29udGV4dC5ob3N0IGFzIHZpcnR1YWxGcy5Ib3N0PFN0YXRzPik7XG4gICAgY29uc3Qgd2VicGFja0RldlNlcnZlckJ1aWxkZXIgPSBuZXcgV2VicGFja0RldlNlcnZlckJ1aWxkZXIoeyAuLi50aGlzLmNvbnRleHQsIGhvc3QgfSk7XG4gICAgbGV0IGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYTtcbiAgICBsZXQgZmlyc3QgPSB0cnVlO1xuICAgIGxldCBvcG5BZGRyZXNzOiBzdHJpbmc7XG5cbiAgICByZXR1cm4gY2hlY2tQb3J0KG9wdGlvbnMucG9ydCwgb3B0aW9ucy5ob3N0KS5waXBlKFxuICAgICAgdGFwKChwb3J0KSA9PiBvcHRpb25zLnBvcnQgPSBwb3J0KSxcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiB0aGlzLl9nZXRCcm93c2VyT3B0aW9ucyhvcHRpb25zKSksXG4gICAgICB0YXAoKG9wdHMpID0+IGJyb3dzZXJPcHRpb25zID0gb3B0cyksXG4gICAgICBjb25jYXRNYXAoKCkgPT4gbm9ybWFsaXplRmlsZVJlcGxhY2VtZW50cyhicm93c2VyT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzLCBob3N0LCByb290KSksXG4gICAgICB0YXAoZmlsZVJlcGxhY2VtZW50cyA9PiBicm93c2VyT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzID0gZmlsZVJlcGxhY2VtZW50cyksXG4gICAgICBjb25jYXRNYXAoKCkgPT4gbm9ybWFsaXplQXNzZXRQYXR0ZXJucyhcbiAgICAgICAgYnJvd3Nlck9wdGlvbnMuYXNzZXRzLCBob3N0LCByb290LCBwcm9qZWN0Um9vdCwgYnVpbGRlckNvbmZpZy5zb3VyY2VSb290KSksXG4gICAgICAvLyBSZXBsYWNlIHRoZSBhc3NldHMgaW4gb3B0aW9ucyB3aXRoIHRoZSBub3JtYWxpemVkIHZlcnNpb24uXG4gICAgICB0YXAoKGFzc2V0UGF0dGVybk9iamVjdHMgPT4gYnJvd3Nlck9wdGlvbnMuYXNzZXRzID0gYXNzZXRQYXR0ZXJuT2JqZWN0cykpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IHtcbiAgICAgICAgY29uc3Qgd2VicGFja0NvbmZpZyA9IHRoaXMuYnVpbGRXZWJwYWNrQ29uZmlnKFxuICAgICAgICAgIHJvb3QsIHByb2plY3RSb290LCBob3N0LCBicm93c2VyT3B0aW9ucyBhcyBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEpO1xuXG4gICAgICAgIGxldCB3ZWJwYWNrRGV2U2VydmVyQ29uZmlnOiBXZWJwYWNrRGV2U2VydmVyLkNvbmZpZ3VyYXRpb247XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgd2VicGFja0RldlNlcnZlckNvbmZpZyA9IHRoaXMuX2J1aWxkU2VydmVyQ29uZmlnKFxuICAgICAgICAgICAgcm9vdCwgcHJvamVjdFJvb3QsIG9wdGlvbnMsIGJyb3dzZXJPcHRpb25zKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIHRocm93RXJyb3IoZXJyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc29sdmUgcHVibGljIGhvc3QgYW5kIGNsaWVudCBhZGRyZXNzLlxuICAgICAgICBsZXQgY2xpZW50QWRkcmVzcyA9IGAke29wdGlvbnMuc3NsID8gJ2h0dHBzJyA6ICdodHRwJ306Ly8wLjAuMC4wOjBgO1xuICAgICAgICBpZiAob3B0aW9ucy5wdWJsaWNIb3N0KSB7XG4gICAgICAgICAgbGV0IHB1YmxpY0hvc3QgPSBvcHRpb25zLnB1YmxpY0hvc3Q7XG4gICAgICAgICAgaWYgKCEvXlxcdys6XFwvXFwvLy50ZXN0KHB1YmxpY0hvc3QpKSB7XG4gICAgICAgICAgICBwdWJsaWNIb3N0ID0gYCR7b3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnfTovLyR7cHVibGljSG9zdH1gO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBjbGllbnRVcmwgPSB1cmwucGFyc2UocHVibGljSG9zdCk7XG4gICAgICAgICAgb3B0aW9ucy5wdWJsaWNIb3N0ID0gY2xpZW50VXJsLmhvc3Q7XG4gICAgICAgICAgY2xpZW50QWRkcmVzcyA9IHVybC5mb3JtYXQoY2xpZW50VXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc29sdmUgc2VydmUgYWRkcmVzcy5cbiAgICAgICAgY29uc3Qgc2VydmVyQWRkcmVzcyA9IHVybC5mb3JtYXQoe1xuICAgICAgICAgIHByb3RvY29sOiBvcHRpb25zLnNzbCA/ICdodHRwcycgOiAnaHR0cCcsXG4gICAgICAgICAgaG9zdG5hbWU6IG9wdGlvbnMuaG9zdCA9PT0gJzAuMC4wLjAnID8gJ2xvY2FsaG9zdCcgOiBvcHRpb25zLmhvc3QsXG4gICAgICAgICAgcG9ydDogb3B0aW9ucy5wb3J0LnRvU3RyaW5nKCksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZCBsaXZlIHJlbG9hZCBjb25maWcuXG4gICAgICAgIGlmIChvcHRpb25zLmxpdmVSZWxvYWQpIHtcbiAgICAgICAgICB0aGlzLl9hZGRMaXZlUmVsb2FkKG9wdGlvbnMsIGJyb3dzZXJPcHRpb25zLCB3ZWJwYWNrQ29uZmlnLCBjbGllbnRBZGRyZXNzKTtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmhtcikge1xuICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2FybignTGl2ZSByZWxvYWQgaXMgZGlzYWJsZWQuIEhNUiBvcHRpb24gaWdub3JlZC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghb3B0aW9ucy53YXRjaCkge1xuICAgICAgICAgIC8vIFRoZXJlJ3Mgbm8gb3B0aW9uIHRvIHR1cm4gb2ZmIGZpbGUgd2F0Y2hpbmcgaW4gd2VicGFjay1kZXYtc2VydmVyLCBidXRcbiAgICAgICAgICAvLyB3ZSBjYW4gb3ZlcnJpZGUgdGhlIGZpbGUgd2F0Y2hlciBpbnN0ZWFkLlxuICAgICAgICAgIHdlYnBhY2tDb25maWcucGx1Z2lucy51bnNoaWZ0KHtcbiAgICAgICAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICAgICAgICAgIGFwcGx5OiAoY29tcGlsZXI6IGFueSkgPT4ge1xuICAgICAgICAgICAgICBjb21waWxlci5ob29rcy5hZnRlckVudmlyb25tZW50LnRhcCgnYW5ndWxhci1jbGknLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29tcGlsZXIud2F0Y2hGaWxlU3lzdGVtID0geyB3YXRjaDogKCkgPT4geyB9IH07XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24pIHtcbiAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmVycm9yKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgICAgVGhpcyBpcyBhIHNpbXBsZSBzZXJ2ZXIgZm9yIHVzZSBpbiB0ZXN0aW5nIG9yIGRlYnVnZ2luZyBBbmd1bGFyIGFwcGxpY2F0aW9ucyBsb2NhbGx5LlxuICAgICAgICAgICAgSXQgaGFzbid0IGJlZW4gcmV2aWV3ZWQgZm9yIHNlY3VyaXR5IGlzc3Vlcy5cblxuICAgICAgICAgICAgRE9OJ1QgVVNFIElUIEZPUiBQUk9EVUNUSU9OIVxuICAgICAgICAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICAgIGApO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5pbmZvKHRhZ3Mub25lTGluZWBcbiAgICAgICAgICAqKlxuICAgICAgICAgIEFuZ3VsYXIgTGl2ZSBEZXZlbG9wbWVudCBTZXJ2ZXIgaXMgbGlzdGVuaW5nIG9uICR7b3B0aW9ucy5ob3N0fToke29wdGlvbnMucG9ydH0sXG4gICAgICAgICAgb3BlbiB5b3VyIGJyb3dzZXIgb24gJHtzZXJ2ZXJBZGRyZXNzfSR7d2VicGFja0RldlNlcnZlckNvbmZpZy5wdWJsaWNQYXRofVxuICAgICAgICAgICoqXG4gICAgICAgIGApO1xuXG4gICAgICAgIG9wbkFkZHJlc3MgPSBzZXJ2ZXJBZGRyZXNzICsgd2VicGFja0RldlNlcnZlckNvbmZpZy5wdWJsaWNQYXRoO1xuICAgICAgICB3ZWJwYWNrQ29uZmlnLmRldlNlcnZlciA9IHdlYnBhY2tEZXZTZXJ2ZXJDb25maWc7XG5cbiAgICAgICAgcmV0dXJuIHdlYnBhY2tEZXZTZXJ2ZXJCdWlsZGVyLnJ1bldlYnBhY2tEZXZTZXJ2ZXIoXG4gICAgICAgICAgd2VicGFja0NvbmZpZywgdW5kZWZpbmVkLCBnZXRCcm93c2VyTG9nZ2luZ0NiKGJyb3dzZXJPcHRpb25zLnZlcmJvc2UpLFxuICAgICAgICApO1xuICAgICAgfSksXG4gICAgICBtYXAoYnVpbGRFdmVudCA9PiB7XG4gICAgICAgIGlmIChmaXJzdCAmJiBvcHRpb25zLm9wZW4pIHtcbiAgICAgICAgICBmaXJzdCA9IGZhbHNlO1xuICAgICAgICAgIG9wbihvcG5BZGRyZXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBidWlsZEV2ZW50O1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGJ1aWxkV2VicGFja0NvbmZpZyhcbiAgICByb290OiBQYXRoLFxuICAgIHByb2plY3RSb290OiBQYXRoLFxuICAgIGhvc3Q6IHZpcnR1YWxGcy5Ib3N0PFN0YXRzPixcbiAgICBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICkge1xuICAgIGNvbnN0IGJyb3dzZXJCdWlsZGVyID0gbmV3IEJyb3dzZXJCdWlsZGVyKHRoaXMuY29udGV4dCk7XG4gICAgY29uc3Qgd2VicGFja0NvbmZpZyA9IGJyb3dzZXJCdWlsZGVyLmJ1aWxkV2VicGFja0NvbmZpZyhcbiAgICAgIHJvb3QsIHByb2plY3RSb290LCBob3N0LCBicm93c2VyT3B0aW9ucyBhcyBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEpO1xuXG4gICAgcmV0dXJuIHdlYnBhY2tDb25maWc7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFNlcnZlckNvbmZpZyhcbiAgICByb290OiBQYXRoLFxuICAgIHByb2plY3RSb290OiBQYXRoLFxuICAgIG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICAgIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgKSB7XG4gICAgY29uc3Qgc3lzdGVtUm9vdCA9IGdldFN5c3RlbVBhdGgocm9vdCk7XG4gICAgaWYgKG9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjaykge1xuICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKHRhZ3Mub25lTGluZWBcbiAgICAgICAgV0FSTklORzogUnVubmluZyBhIHNlcnZlciB3aXRoIC0tZGlzYWJsZS1ob3N0LWNoZWNrIGlzIGEgc2VjdXJpdHkgcmlzay5cbiAgICAgICAgU2VlIGh0dHBzOi8vbWVkaXVtLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LXNlcnZlci1taWRkbGV3YXJlLXNlY3VyaXR5LWlzc3Vlcy0xNDg5ZDk1MDg3NGFcbiAgICAgICAgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gICAgICBgKTtcbiAgICB9XG5cbiAgICBjb25zdCBzZXJ2ZVBhdGggPSB0aGlzLl9idWlsZFNlcnZlUGF0aChvcHRpb25zLCBicm93c2VyT3B0aW9ucyk7XG5cbiAgICBjb25zdCBjb25maWc6IFdlYnBhY2tEZXZTZXJ2ZXIuQ29uZmlndXJhdGlvbiA9IHtcbiAgICAgIGhvc3Q6IG9wdGlvbnMuaG9zdCxcbiAgICAgIHBvcnQ6IG9wdGlvbnMucG9ydCxcbiAgICAgIGhlYWRlcnM6IHsgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyB9LFxuICAgICAgaGlzdG9yeUFwaUZhbGxiYWNrOiB7XG4gICAgICAgIGluZGV4OiBgJHtzZXJ2ZVBhdGh9LyR7cGF0aC5iYXNlbmFtZShicm93c2VyT3B0aW9ucy5pbmRleCl9YCxcbiAgICAgICAgZGlzYWJsZURvdFJ1bGU6IHRydWUsXG4gICAgICAgIGh0bWxBY2NlcHRIZWFkZXJzOiBbJ3RleHQvaHRtbCcsICdhcHBsaWNhdGlvbi94aHRtbCt4bWwnXSxcbiAgICAgIH0gYXMgV2VicGFja0RldlNlcnZlci5IaXN0b3J5QXBpRmFsbGJhY2tDb25maWcsXG4gICAgICBzdGF0czogZmFsc2UsXG4gICAgICBjb21wcmVzczogYnJvd3Nlck9wdGlvbnMub3B0aW1pemF0aW9uLFxuICAgICAgd2F0Y2hPcHRpb25zOiB7XG4gICAgICAgIHBvbGw6IGJyb3dzZXJPcHRpb25zLnBvbGwsXG4gICAgICB9LFxuICAgICAgaHR0cHM6IG9wdGlvbnMuc3NsLFxuICAgICAgb3ZlcmxheToge1xuICAgICAgICBlcnJvcnM6ICFicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24sXG4gICAgICAgIHdhcm5pbmdzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBwdWJsaWM6IG9wdGlvbnMucHVibGljSG9zdCxcbiAgICAgIGRpc2FibGVIb3N0Q2hlY2s6IG9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjayxcbiAgICAgIHB1YmxpY1BhdGg6IHNlcnZlUGF0aCxcbiAgICAgIGhvdDogb3B0aW9ucy5obXIsXG4gICAgfTtcblxuICAgIGlmIChvcHRpb25zLnNzbCkge1xuICAgICAgdGhpcy5fYWRkU3NsQ29uZmlnKHN5c3RlbVJvb3QsIG9wdGlvbnMsIGNvbmZpZyk7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMucHJveHlDb25maWcpIHtcbiAgICAgIHRoaXMuX2FkZFByb3h5Q29uZmlnKHN5c3RlbVJvb3QsIG9wdGlvbnMsIGNvbmZpZyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbmZpZztcbiAgfVxuXG4gIHByaXZhdGUgX2FkZExpdmVSZWxvYWQoXG4gICAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gICAgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICAgIHdlYnBhY2tDb25maWc6IGFueSwgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1hbnlcbiAgICBjbGllbnRBZGRyZXNzOiBzdHJpbmcsXG4gICkge1xuICAgIC8vIFRoaXMgYWxsb3dzIGZvciBsaXZlIHJlbG9hZCBvZiBwYWdlIHdoZW4gY2hhbmdlcyBhcmUgbWFkZSB0byByZXBvLlxuICAgIC8vIGh0dHBzOi8vd2VicGFjay5qcy5vcmcvY29uZmlndXJhdGlvbi9kZXYtc2VydmVyLyNkZXZzZXJ2ZXItaW5saW5lXG4gICAgbGV0IHdlYnBhY2tEZXZTZXJ2ZXJQYXRoO1xuICAgIHRyeSB7XG4gICAgICB3ZWJwYWNrRGV2U2VydmVyUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgnd2VicGFjay1kZXYtc2VydmVyL2NsaWVudCcpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgXCJ3ZWJwYWNrLWRldi1zZXJ2ZXJcIiBwYWNrYWdlIGNvdWxkIG5vdCBiZSBmb3VuZC4nKTtcbiAgICB9XG4gICAgY29uc3QgZW50cnlQb2ludHMgPSBbYCR7d2VicGFja0RldlNlcnZlclBhdGh9PyR7Y2xpZW50QWRkcmVzc31gXTtcbiAgICBpZiAob3B0aW9ucy5obXIpIHtcbiAgICAgIGNvbnN0IHdlYnBhY2tIbXJMaW5rID0gJ2h0dHBzOi8vd2VicGFjay5qcy5vcmcvZ3VpZGVzL2hvdC1tb2R1bGUtcmVwbGFjZW1lbnQnO1xuXG4gICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICAgIHRhZ3Mub25lTGluZWBOT1RJQ0U6IEhvdCBNb2R1bGUgUmVwbGFjZW1lbnQgKEhNUikgaXMgZW5hYmxlZCBmb3IgdGhlIGRldiBzZXJ2ZXIuYCk7XG5cbiAgICAgIGNvbnN0IHNob3dXYXJuaW5nID0gb3B0aW9ucy5obXJXYXJuaW5nO1xuICAgICAgaWYgKHNob3dXYXJuaW5nKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbyh0YWdzLnN0cmlwSW5kZW50c2BcbiAgICAgICAgICBUaGUgcHJvamVjdCB3aWxsIHN0aWxsIGxpdmUgcmVsb2FkIHdoZW4gSE1SIGlzIGVuYWJsZWQsXG4gICAgICAgICAgYnV0IHRvIHRha2UgYWR2YW50YWdlIG9mIEhNUiBhZGRpdGlvbmFsIGFwcGxpY2F0aW9uIGNvZGUgaXMgcmVxdWlyZWQnXG4gICAgICAgICAgKG5vdCBpbmNsdWRlZCBpbiBhbiBBbmd1bGFyIENMSSBwcm9qZWN0IGJ5IGRlZmF1bHQpLidcbiAgICAgICAgICBTZWUgJHt3ZWJwYWNrSG1yTGlua31cbiAgICAgICAgICBmb3IgaW5mb3JtYXRpb24gb24gd29ya2luZyB3aXRoIEhNUiBmb3IgV2VicGFjay5gLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICAgICAgdGFncy5vbmVMaW5lYFRvIGRpc2FibGUgdGhpcyB3YXJuaW5nIHVzZSBcImhtcldhcm5pbmc6IGZhbHNlXCIgdW5kZXIgXCJzZXJ2ZVwiXG4gICAgICAgICAgIG9wdGlvbnMgaW4gXCJhbmd1bGFyLmpzb25cIi5gLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgZW50cnlQb2ludHMucHVzaCgnd2VicGFjay9ob3QvZGV2LXNlcnZlcicpO1xuICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnB1c2gobmV3IHdlYnBhY2suSG90TW9kdWxlUmVwbGFjZW1lbnRQbHVnaW4oKSk7XG4gICAgICBpZiAoYnJvd3Nlck9wdGlvbnMuZXh0cmFjdENzcykge1xuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4odGFncy5vbmVMaW5lYE5PVElDRTogKEhNUikgZG9lcyBub3QgYWxsb3cgZm9yIENTUyBob3QgcmVsb2FkXG4gICAgICAgICAgICAgICAgd2hlbiB1c2VkIHRvZ2V0aGVyIHdpdGggJy0tZXh0cmFjdC1jc3MnLmApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXdlYnBhY2tDb25maWcuZW50cnkubWFpbikgeyB3ZWJwYWNrQ29uZmlnLmVudHJ5Lm1haW4gPSBbXTsgfVxuICAgIHdlYnBhY2tDb25maWcuZW50cnkubWFpbi51bnNoaWZ0KC4uLmVudHJ5UG9pbnRzKTtcbiAgfVxuXG4gIHByaXZhdGUgX2FkZFNzbENvbmZpZyhcbiAgICByb290OiBzdHJpbmcsXG4gICAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gICAgY29uZmlnOiBXZWJwYWNrRGV2U2VydmVyLkNvbmZpZ3VyYXRpb24sXG4gICkge1xuICAgIGxldCBzc2xLZXk6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBsZXQgc3NsQ2VydDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGlmIChvcHRpb25zLnNzbEtleSkge1xuICAgICAgY29uc3Qga2V5UGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBvcHRpb25zLnNzbEtleSk7XG4gICAgICBpZiAoZXhpc3RzU3luYyhrZXlQYXRoKSkge1xuICAgICAgICBzc2xLZXkgPSByZWFkRmlsZVN5bmMoa2V5UGF0aCwgJ3V0Zi04Jyk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChvcHRpb25zLnNzbENlcnQpIHtcbiAgICAgIGNvbnN0IGNlcnRQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIG9wdGlvbnMuc3NsQ2VydCk7XG4gICAgICBpZiAoZXhpc3RzU3luYyhjZXJ0UGF0aCkpIHtcbiAgICAgICAgc3NsQ2VydCA9IHJlYWRGaWxlU3luYyhjZXJ0UGF0aCwgJ3V0Zi04Jyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uZmlnLmh0dHBzID0gdHJ1ZTtcbiAgICBpZiAoc3NsS2V5ICE9IG51bGwgJiYgc3NsQ2VydCAhPSBudWxsKSB7XG4gICAgICBjb25maWcuaHR0cHMgPSB7XG4gICAgICAgIGtleTogc3NsS2V5LFxuICAgICAgICBjZXJ0OiBzc2xDZXJ0LFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9hZGRQcm94eUNvbmZpZyhcbiAgICByb290OiBzdHJpbmcsXG4gICAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gICAgY29uZmlnOiBXZWJwYWNrRGV2U2VydmVyLkNvbmZpZ3VyYXRpb24sXG4gICkge1xuICAgIGxldCBwcm94eUNvbmZpZyA9IHt9O1xuICAgIGNvbnN0IHByb3h5UGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBvcHRpb25zLnByb3h5Q29uZmlnIGFzIHN0cmluZyk7XG4gICAgaWYgKGV4aXN0c1N5bmMocHJveHlQYXRoKSkge1xuICAgICAgcHJveHlDb25maWcgPSByZXF1aXJlKHByb3h5UGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSAnUHJveHkgY29uZmlnIGZpbGUgJyArIHByb3h5UGF0aCArICcgZG9lcyBub3QgZXhpc3QuJztcbiAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICB9XG4gICAgY29uZmlnLnByb3h5ID0gcHJveHlDb25maWc7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFNlcnZlUGF0aChvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucywgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hKSB7XG4gICAgbGV0IHNlcnZlUGF0aCA9IG9wdGlvbnMuc2VydmVQYXRoO1xuICAgIGlmICghc2VydmVQYXRoICYmIHNlcnZlUGF0aCAhPT0gJycpIHtcbiAgICAgIGNvbnN0IGRlZmF1bHRTZXJ2ZVBhdGggPVxuICAgICAgICB0aGlzLl9maW5kRGVmYXVsdFNlcnZlUGF0aChicm93c2VyT3B0aW9ucy5iYXNlSHJlZiwgYnJvd3Nlck9wdGlvbnMuZGVwbG95VXJsKTtcbiAgICAgIGNvbnN0IHNob3dXYXJuaW5nID0gb3B0aW9ucy5zZXJ2ZVBhdGhEZWZhdWx0V2FybmluZztcbiAgICAgIGlmIChkZWZhdWx0U2VydmVQYXRoID09IG51bGwgJiYgc2hvd1dhcm5pbmcpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKHRhZ3Mub25lTGluZWBcbiAgICAgICAgICAgIFdBUk5JTkc6IC0tZGVwbG95LXVybCBhbmQvb3IgLS1iYXNlLWhyZWYgY29udGFpblxuICAgICAgICAgICAgdW5zdXBwb3J0ZWQgdmFsdWVzIGZvciBuZyBzZXJ2ZS4gIERlZmF1bHQgc2VydmUgcGF0aCBvZiAnLycgdXNlZC5cbiAgICAgICAgICAgIFVzZSAtLXNlcnZlLXBhdGggdG8gb3ZlcnJpZGUuXG4gICAgICAgICAgYCk7XG4gICAgICB9XG4gICAgICBzZXJ2ZVBhdGggPSBkZWZhdWx0U2VydmVQYXRoIHx8ICcnO1xuICAgIH1cbiAgICBpZiAoc2VydmVQYXRoLmVuZHNXaXRoKCcvJykpIHtcbiAgICAgIHNlcnZlUGF0aCA9IHNlcnZlUGF0aC5zdWJzdHIoMCwgc2VydmVQYXRoLmxlbmd0aCAtIDEpO1xuICAgIH1cbiAgICBpZiAoIXNlcnZlUGF0aC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICAgIHNlcnZlUGF0aCA9IGAvJHtzZXJ2ZVBhdGh9YDtcbiAgICB9XG5cbiAgICByZXR1cm4gc2VydmVQYXRoO1xuICB9XG5cbiAgcHJpdmF0ZSBfZmluZERlZmF1bHRTZXJ2ZVBhdGgoYmFzZUhyZWY/OiBzdHJpbmcsIGRlcGxveVVybD86IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmICghYmFzZUhyZWYgJiYgIWRlcGxveVVybCkge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cblxuICAgIGlmICgvXihcXHcrOik/XFwvXFwvLy50ZXN0KGJhc2VIcmVmIHx8ICcnKSB8fCAvXihcXHcrOik/XFwvXFwvLy50ZXN0KGRlcGxveVVybCB8fCAnJykpIHtcbiAgICAgIC8vIElmIGJhc2VIcmVmIG9yIGRlcGxveVVybCBpcyBhYnNvbHV0ZSwgdW5zdXBwb3J0ZWQgYnkgbmcgc2VydmVcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIG5vcm1hbGl6ZSBiYXNlSHJlZlxuICAgIC8vIGZvciBuZyBzZXJ2ZSB0aGUgc3RhcnRpbmcgYmFzZSBpcyBhbHdheXMgYC9gIHNvIGEgcmVsYXRpdmVcbiAgICAvLyBhbmQgcm9vdCByZWxhdGl2ZSB2YWx1ZSBhcmUgaWRlbnRpY2FsXG4gICAgY29uc3QgYmFzZUhyZWZQYXJ0cyA9IChiYXNlSHJlZiB8fCAnJylcbiAgICAgIC5zcGxpdCgnLycpXG4gICAgICAuZmlsdGVyKHBhcnQgPT4gcGFydCAhPT0gJycpO1xuICAgIGlmIChiYXNlSHJlZiAmJiAhYmFzZUhyZWYuZW5kc1dpdGgoJy8nKSkge1xuICAgICAgYmFzZUhyZWZQYXJ0cy5wb3AoKTtcbiAgICB9XG4gICAgY29uc3Qgbm9ybWFsaXplZEJhc2VIcmVmID0gYmFzZUhyZWZQYXJ0cy5sZW5ndGggPT09IDAgPyAnLycgOiBgLyR7YmFzZUhyZWZQYXJ0cy5qb2luKCcvJyl9L2A7XG5cbiAgICBpZiAoZGVwbG95VXJsICYmIGRlcGxveVVybFswXSA9PT0gJy8nKSB7XG4gICAgICBpZiAoYmFzZUhyZWYgJiYgYmFzZUhyZWZbMF0gPT09ICcvJyAmJiBub3JtYWxpemVkQmFzZUhyZWYgIT09IGRlcGxveVVybCkge1xuICAgICAgICAvLyBJZiBiYXNlSHJlZiBhbmQgZGVwbG95VXJsIGFyZSByb290IHJlbGF0aXZlIGFuZCBub3QgZXF1aXZhbGVudCwgdW5zdXBwb3J0ZWQgYnkgbmcgc2VydmVcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBkZXBsb3lVcmw7XG4gICAgfVxuXG4gICAgLy8gSm9pbiB0b2dldGhlciBiYXNlSHJlZiBhbmQgZGVwbG95VXJsXG4gICAgcmV0dXJuIGAke25vcm1hbGl6ZWRCYXNlSHJlZn0ke2RlcGxveVVybCB8fCAnJ31gO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0QnJvd3Nlck9wdGlvbnMob3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMpIHtcbiAgICBjb25zdCBhcmNoaXRlY3QgPSB0aGlzLmNvbnRleHQuYXJjaGl0ZWN0O1xuICAgIGNvbnN0IFtwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb25dID0gb3B0aW9ucy5icm93c2VyVGFyZ2V0LnNwbGl0KCc6Jyk7XG5cbiAgICBjb25zdCBvdmVycmlkZXMgPSB7XG4gICAgICAvLyBPdmVycmlkZSBicm93c2VyIGJ1aWxkIHdhdGNoIHNldHRpbmcuXG4gICAgICB3YXRjaDogb3B0aW9ucy53YXRjaCxcblxuICAgICAgLy8gVXBkYXRlIHRoZSBicm93c2VyIG9wdGlvbnMgd2l0aCB0aGUgc2FtZSBvcHRpb25zIHdlIHN1cHBvcnQgaW4gc2VydmUsIGlmIGRlZmluZWQuXG4gICAgICAuLi4ob3B0aW9ucy5vcHRpbWl6YXRpb24gIT09IHVuZGVmaW5lZCA/IHsgb3B0aW1pemF0aW9uOiBvcHRpb25zLm9wdGltaXphdGlvbiB9IDoge30pLFxuICAgICAgLi4uKG9wdGlvbnMuYW90ICE9PSB1bmRlZmluZWQgPyB7IGFvdDogb3B0aW9ucy5hb3QgfSA6IHt9KSxcbiAgICAgIC4uLihvcHRpb25zLnNvdXJjZU1hcCAhPT0gdW5kZWZpbmVkID8geyBzb3VyY2VNYXA6IG9wdGlvbnMuc291cmNlTWFwIH0gOiB7fSksXG4gICAgICAuLi4ob3B0aW9ucy52ZW5kb3JTb3VyY2VNYXAgIT09IHVuZGVmaW5lZCA/XG4gICAgICAgICB7IHZlbmRvclNvdXJjZU1hcDogb3B0aW9ucy52ZW5kb3JTb3VyY2VNYXAgfSA6IHt9KSxcbiAgICAgIC4uLihvcHRpb25zLmV2YWxTb3VyY2VNYXAgIT09IHVuZGVmaW5lZCA/IHsgZXZhbFNvdXJjZU1hcDogb3B0aW9ucy5ldmFsU291cmNlTWFwIH0gOiB7fSksXG4gICAgICAuLi4ob3B0aW9ucy52ZW5kb3JDaHVuayAhPT0gdW5kZWZpbmVkID8geyB2ZW5kb3JDaHVuazogb3B0aW9ucy52ZW5kb3JDaHVuayB9IDoge30pLFxuICAgICAgLi4uKG9wdGlvbnMuY29tbW9uQ2h1bmsgIT09IHVuZGVmaW5lZCA/IHsgY29tbW9uQ2h1bms6IG9wdGlvbnMuY29tbW9uQ2h1bmsgfSA6IHt9KSxcbiAgICAgIC4uLihvcHRpb25zLmJhc2VIcmVmICE9PSB1bmRlZmluZWQgPyB7IGJhc2VIcmVmOiBvcHRpb25zLmJhc2VIcmVmIH0gOiB7fSksXG4gICAgICAuLi4ob3B0aW9ucy5wcm9ncmVzcyAhPT0gdW5kZWZpbmVkID8geyBwcm9ncmVzczogb3B0aW9ucy5wcm9ncmVzcyB9IDoge30pLFxuICAgICAgLi4uKG9wdGlvbnMucG9sbCAhPT0gdW5kZWZpbmVkID8geyBwb2xsOiBvcHRpb25zLnBvbGwgfSA6IHt9KSxcbiAgICAgIC4uLihvcHRpb25zLnZlcmJvc2UgIT09IHVuZGVmaW5lZCA/IHsgdmVyYm9zZTogb3B0aW9ucy52ZXJib3NlIH0gOiB7fSksXG4gICAgfTtcblxuICAgIGNvbnN0IGJyb3dzZXJUYXJnZXRTcGVjID0geyBwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb24sIG92ZXJyaWRlcyB9O1xuICAgIGNvbnN0IGJ1aWxkZXJDb25maWcgPSBhcmNoaXRlY3QuZ2V0QnVpbGRlckNvbmZpZ3VyYXRpb248QnJvd3NlckJ1aWxkZXJTY2hlbWE+KFxuICAgICAgYnJvd3NlclRhcmdldFNwZWMpO1xuXG4gICAgcmV0dXJuIGFyY2hpdGVjdC5nZXRCdWlsZGVyRGVzY3JpcHRpb24oYnVpbGRlckNvbmZpZykucGlwZShcbiAgICAgIGNvbmNhdE1hcChicm93c2VyRGVzY3JpcHRpb24gPT5cbiAgICAgICAgYXJjaGl0ZWN0LnZhbGlkYXRlQnVpbGRlck9wdGlvbnMoYnVpbGRlckNvbmZpZywgYnJvd3NlckRlc2NyaXB0aW9uKSksXG4gICAgICBtYXAoYnJvd3NlckNvbmZpZyA9PiBicm93c2VyQ29uZmlnLm9wdGlvbnMpLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRGV2U2VydmVyQnVpbGRlcjtcbiJdfQ==