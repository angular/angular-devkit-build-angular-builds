"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.serveWebpackBrowser = void 0;
const architect_1 = require("@angular-devkit/architect");
const build_webpack_1 = require("@angular-devkit/build-webpack");
const core_1 = require("@angular-devkit/core");
const node_1 = require("@angular-devkit/core/node");
const path = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const ts = require("typescript");
const url = require("url");
const webpackDevServer = require("webpack-dev-server");
const browser_1 = require("../browser");
const schema_1 = require("../browser/schema");
const utils_1 = require("../utils");
const cache_path_1 = require("../utils/cache-path");
const check_port_1 = require("../utils/check-port");
const color_1 = require("../utils/color");
const transforms_1 = require("../utils/index-file/transforms");
const package_chunk_sort_1 = require("../utils/package-chunk-sort");
const process_bundle_1 = require("../utils/process-bundle");
const read_tsconfig_1 = require("../utils/read-tsconfig");
const version_1 = require("../utils/version");
const webpack_browser_config_1 = require("../utils/webpack-browser-config");
const webpack_diagnostics_1 = require("../utils/webpack-diagnostics");
const configs_1 = require("../webpack/configs");
const dev_server_1 = require("../webpack/configs/dev-server");
const index_html_webpack_plugin_1 = require("../webpack/plugins/index-html-webpack-plugin");
const stats_1 = require("../webpack/utils/stats");
const devServerBuildOverriddenKeys = [
    'watch',
    'optimization',
    'aot',
    'sourceMap',
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
// tslint:disable-next-line: no-big-function
function serveWebpackBrowser(options, context, transforms = {}) {
    // Check Angular version.
    const { logger, workspaceRoot } = context;
    version_1.assertCompatibleAngularVersion(workspaceRoot, logger);
    const browserTarget = architect_1.targetFromTargetString(options.browserTarget);
    const host = new node_1.NodeJsSyncHost();
    async function setup() {
        var _a;
        // Get the browser configuration from the target name.
        const rawBrowserOptions = (await context.getTargetOptions(browserTarget));
        options.port = await check_port_1.checkPort((_a = options.port) !== null && _a !== void 0 ? _a : 4200, options.host || 'localhost');
        // Override options we need to override, if defined.
        const overrides = Object.keys(options)
            .filter(key => options[key] !== undefined && devServerBuildOverriddenKeys.includes(key))
            .reduce((previous, key) => ({
            ...previous,
            [key]: options[key],
        }), {});
        // Get dev-server only options.
        const devServerOptions = Object.keys(options)
            .filter(key => !devServerBuildOverriddenKeys.includes(key) && key !== 'browserTarget')
            .reduce((previous, key) => ({
            ...previous,
            [key]: options[key],
        }), {});
        // In dev server we should not have budgets because of extra libs such as socks-js
        overrides.budgets = undefined;
        if (rawBrowserOptions.outputHashing && rawBrowserOptions.outputHashing !== schema_1.OutputHashing.None) {
            // Disable output hashing for dev build as this can cause memory leaks
            // See: https://github.com/webpack/webpack-dev-server/issues/377#issuecomment-241258405
            overrides.outputHashing = schema_1.OutputHashing.None;
            logger.warn(`Warning: 'outputHashing' option is disabled when using the dev-server.`);
        }
        const browserName = await context.getBuilderNameForTarget(browserTarget);
        const browserOptions = await context.validateOptions({ ...rawBrowserOptions, ...overrides }, browserName);
        const { config, projectRoot, i18n } = await webpack_browser_config_1.generateI18nBrowserWebpackConfigFromContext(browserOptions, context, wco => [
            dev_server_1.getDevServerConfig(wco),
            configs_1.getCommonConfig(wco),
            configs_1.getBrowserConfig(wco),
            configs_1.getStylesConfig(wco),
            configs_1.getStatsConfig(wco),
            browser_1.getAnalyticsConfig(wco, context),
            browser_1.getCompilerConfig(wco),
            browserOptions.webWorkerTsConfig ? configs_1.getWorkerConfig(wco) : {},
        ], host, devServerOptions);
        if (!config.devServer) {
            throw new Error('Webpack Dev Server configuration was not set.');
        }
        if (options.liveReload && !options.hmr) {
            // This is needed because we cannot use the inline option directly in the config
            // because of the SuppressExtractedTextChunksWebpackPlugin
            // Consider not using SuppressExtractedTextChunksWebpackPlugin when liveReload is enable.
            webpackDevServer.addDevServerEntrypoints(config, {
                ...config.devServer,
                inline: true,
            });
            // Remove live-reload code from all entrypoints but not main.
            // Otherwise this will break SuppressExtractedTextChunksWebpackPlugin because
            // 'addDevServerEntrypoints' adds addional entry-points to all entries.
            if (config.entry && typeof config.entry === 'object' && !Array.isArray(config.entry) && config.entry.main) {
                for (const [key, value] of Object.entries(config.entry)) {
                    if (key === 'main' || typeof value === 'string') {
                        continue;
                    }
                    const webpackClientScriptIndex = value.findIndex(x => x.includes('webpack-dev-server/client/index.js'));
                    if (webpackClientScriptIndex >= 0) {
                        // Remove the webpack-dev-server/client script from array.
                        value.splice(webpackClientScriptIndex, 1);
                    }
                }
            }
        }
        if (options.hmr) {
            logger.warn(core_1.tags.stripIndents `NOTICE: Hot Module Replacement (HMR) is enabled for the dev server.
      See https://webpack.js.org/guides/hot-module-replacement for information on working with HMR for Webpack.`);
        }
        if (options.host
            && !/^127\.\d+\.\d+\.\d+/g.test(options.host)
            && options.host !== 'localhost') {
            logger.warn(core_1.tags.stripIndent `
        Warning: This is a simple server for use in testing or debugging Angular applications
        locally. It hasn't been reviewed for security issues.

        Binding this server to an open connection can result in compromising your application or
        computer. Using a different host than the one passed to the "--host" flag might result in
        websocket connection issues. You might need to use "--disableHostCheck" if that's the
        case.
      `);
        }
        if (options.disableHostCheck) {
            logger.warn(core_1.tags.oneLine `
        Warning: Running a server with --disable-host-check is a security risk.
        See https://medium.com/webpack/webpack-dev-server-middleware-security-issues-1489d950874a
        for more information.
      `);
        }
        let webpackConfig = config;
        const tsConfig = read_tsconfig_1.readTsconfig(browserOptions.tsConfig, workspaceRoot);
        if (i18n.shouldInline && tsConfig.options.enableIvy !== false) {
            if (i18n.inlineLocales.size > 1) {
                throw new Error('The development server only supports localizing a single locale per build.');
            }
            await setupLocalize(i18n, browserOptions, webpackConfig);
        }
        if (transforms.webpackConfiguration) {
            webpackConfig = await transforms.webpackConfiguration(webpackConfig);
        }
        return {
            browserOptions,
            webpackConfig,
            projectRoot,
            locale: browserOptions.i18nLocale || (i18n.shouldInline ? [...i18n.inlineLocales][0] : undefined),
        };
    }
    return rxjs_1.from(setup()).pipe(operators_1.switchMap(({ browserOptions, webpackConfig, projectRoot, locale }) => {
        const normalizedOptimization = utils_1.normalizeOptimization(browserOptions.optimization);
        if (browserOptions.index) {
            const { scripts = [], styles = [], baseHref, tsConfig } = browserOptions;
            const { options: compilerOptions } = read_tsconfig_1.readTsconfig(tsConfig, workspaceRoot);
            const target = compilerOptions.target || ts.ScriptTarget.ES5;
            const buildBrowserFeatures = new utils_1.BuildBrowserFeatures(projectRoot);
            const entrypoints = package_chunk_sort_1.generateEntryPoints({ scripts, styles });
            const moduleEntrypoints = buildBrowserFeatures.isDifferentialLoadingNeeded(target)
                ? package_chunk_sort_1.generateEntryPoints({ scripts: [], styles })
                : [];
            webpackConfig.plugins = [...(webpackConfig.plugins || [])];
            webpackConfig.plugins.push(new index_html_webpack_plugin_1.IndexHtmlWebpackPlugin({
                input: path.resolve(workspaceRoot, webpack_browser_config_1.getIndexInputFile(browserOptions.index)),
                output: webpack_browser_config_1.getIndexOutputFile(browserOptions.index),
                baseHref,
                moduleEntrypoints,
                entrypoints,
                deployUrl: browserOptions.deployUrl,
                sri: browserOptions.subresourceIntegrity,
                noModuleEntrypoints: ['polyfills-es5'],
                postTransforms: transforms_1.getHtmlTransforms(normalizedOptimization, buildBrowserFeatures, transforms.indexHtml),
                crossOrigin: browserOptions.crossOrigin,
                lang: locale,
            }));
        }
        if (normalizedOptimization.scripts || normalizedOptimization.styles) {
            logger.error(core_1.tags.stripIndents `
          ****************************************************************************************
          This is a simple server for use in testing or debugging Angular applications locally.
          It hasn't been reviewed for security issues.

          DON'T USE IT FOR PRODUCTION!
          ****************************************************************************************
        `);
        }
        return build_webpack_1.runWebpackDevServer(webpackConfig, context, {
            logging: transforms.logging || stats_1.createWebpackLoggingCallback(!!options.verbose, logger),
            webpackFactory: require('webpack'),
            webpackDevServerFactory: require('webpack-dev-server'),
        }).pipe(operators_1.concatMap((buildEvent, index) => {
            var _a;
            // Resolve serve address.
            const serverAddress = url.format({
                protocol: options.ssl ? 'https' : 'http',
                hostname: options.host === '0.0.0.0' ? 'localhost' : options.host,
                pathname: (_a = webpackConfig.devServer) === null || _a === void 0 ? void 0 : _a.publicPath,
                port: buildEvent.port,
            });
            if (index === 0) {
                logger.info('\n' + core_1.tags.oneLine `
              **
              Angular Live Development Server is listening on ${options.host}:${buildEvent.port},
              open your browser on ${serverAddress}
              **
            ` + '\n');
                if (options.open) {
                    const open = require('open');
                    open(serverAddress);
                }
            }
            if (buildEvent.success) {
                logger.info(`\n${color_1.colors.greenBright(color_1.colors.symbols.check)} Compiled successfully.`);
            }
            return rxjs_1.of({ ...buildEvent, baseUrl: serverAddress });
        }));
    }));
}
exports.serveWebpackBrowser = serveWebpackBrowser;
async function setupLocalize(i18n, browserOptions, webpackConfig) {
    var _a;
    const locale = [...i18n.inlineLocales][0];
    const localeDescription = i18n.locales[locale];
    const { plugins, diagnostics } = await process_bundle_1.createI18nPlugins(locale, localeDescription === null || localeDescription === void 0 ? void 0 : localeDescription.translation, browserOptions.i18nMissingTranslation || 'ignore');
    // Modify main entrypoint to include locale data
    if ((localeDescription === null || localeDescription === void 0 ? void 0 : localeDescription.dataPath) &&
        typeof webpackConfig.entry === 'object' &&
        !Array.isArray(webpackConfig.entry) &&
        webpackConfig.entry['main']) {
        if (Array.isArray(webpackConfig.entry['main'])) {
            webpackConfig.entry['main'].unshift(localeDescription.dataPath);
        }
        else {
            webpackConfig.entry['main'] = [localeDescription.dataPath, webpackConfig.entry['main']];
        }
    }
    const i18nRule = {
        test: /\.(?:m?js|ts)$/,
        enforce: 'post',
        use: [
            {
                loader: require.resolve('babel-loader'),
                options: {
                    babelrc: false,
                    configFile: false,
                    compact: false,
                    cacheCompression: false,
                    cacheDirectory: cache_path_1.findCachePath('babel-loader'),
                    cacheIdentifier: JSON.stringify({
                        buildAngular: require('../../package.json').version,
                        locale,
                        translationIntegrity: localeDescription === null || localeDescription === void 0 ? void 0 : localeDescription.files.map((file) => file.integrity),
                    }),
                    plugins,
                },
            },
        ],
    };
    // Get the rules and ensure the Webpack configuration is setup properly
    const rules = ((_a = webpackConfig.module) === null || _a === void 0 ? void 0 : _a.rules) || [];
    if (!webpackConfig.module) {
        webpackConfig.module = { rules };
    }
    else if (!webpackConfig.module.rules) {
        webpackConfig.module.rules = rules;
    }
    rules.push(i18nRule);
    // Add a plugin to inject the i18n diagnostics
    // tslint:disable-next-line: no-non-null-assertion
    webpackConfig.plugins.push({
        apply: (compiler) => {
            compiler.hooks.thisCompilation.tap('build-angular', compilation => {
                compilation.hooks.finishModules.tap('build-angular', () => {
                    if (!diagnostics) {
                        return;
                    }
                    for (const diagnostic of diagnostics.messages) {
                        if (diagnostic.type === 'error') {
                            webpack_diagnostics_1.addError(compilation, diagnostic.message);
                        }
                        else {
                            webpack_diagnostics_1.addWarning(compilation, diagnostic.message);
                        }
                    }
                    diagnostics.messages.length = 0;
                });
            });
        },
    });
}
exports.default = architect_1.createBuilder(serveWebpackBrowser);
