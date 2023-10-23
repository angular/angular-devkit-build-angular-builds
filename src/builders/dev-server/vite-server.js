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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupServer = exports.serveWithVite = void 0;
const remapping_1 = __importDefault(require("@ampproject/remapping"));
const mrmime_1 = require("mrmime");
const node_assert_1 = __importDefault(require("node:assert"));
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const bundler_context_1 = require("../../tools/esbuild/bundler-context");
const javascript_transformer_1 = require("../../tools/esbuild/javascript-transformer");
const utils_1 = require("../../tools/esbuild/utils");
const i18n_locale_plugin_1 = require("../../tools/vite/i18n-locale-plugin");
const render_page_1 = require("../../utils/server-rendering/render-page");
const supported_browsers_1 = require("../../utils/supported-browsers");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const application_1 = require("../application");
const browser_esbuild_1 = require("../browser-esbuild");
const load_proxy_config_1 = require("./load-proxy-config");
async function* serveWithVite(serverOptions, builderName, context, plugins) {
    // Get the browser configuration from the target name.
    const rawBrowserOptions = (await context.getTargetOptions(serverOptions.buildTarget));
    const browserOptions = (await context.validateOptions({
        ...rawBrowserOptions,
        watch: serverOptions.watch,
        poll: serverOptions.poll,
        verbose: serverOptions.verbose,
    }, builderName));
    if (browserOptions.prerender) {
        // Disable prerendering if enabled and force SSR.
        // This is so instead of prerendering all the routes for every change, the page is "prerendered" when it is requested.
        browserOptions.ssr = true;
        browserOptions.prerender = false;
        // https://nodejs.org/api/process.html#processsetsourcemapsenabledval
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        process.setSourceMapsEnabled(true);
    }
    // Set all packages as external to support Vite's prebundle caching
    browserOptions.externalPackages = serverOptions.cacheOptions.enabled;
    if (serverOptions.servePath === undefined && browserOptions.baseHref !== undefined) {
        serverOptions.servePath = browserOptions.baseHref;
    }
    // The development server currently only supports a single locale when localizing.
    // This matches the behavior of the Webpack-based development server but could be expanded in the future.
    if (browserOptions.localize === true ||
        (Array.isArray(browserOptions.localize) && browserOptions.localize.length > 1)) {
        context.logger.warn('Localization (`localize` option) has been disabled. The development server only supports localizing a single locale per build.');
        browserOptions.localize = false;
    }
    else if (browserOptions.localize) {
        // When localization is enabled with a single locale, force a flat path to maintain behavior with the existing Webpack-based dev server.
        browserOptions.forceI18nFlatOutput = true;
    }
    // Setup the prebundling transformer that will be shared across Vite prebundling requests
    const prebundleTransformer = new javascript_transformer_1.JavaScriptTransformer(
    // Always enable JIT linking to support applications built with and without AOT.
    // In a development environment the additional scope information does not
    // have a negative effect unlike production where final output size is relevant.
    { sourcemap: true, jit: true }, 1);
    // Extract output index from options
    // TODO: Provide this info from the build results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const htmlIndexPath = (0, webpack_browser_config_1.getIndexOutputFile)(browserOptions.index);
    // dynamically import Vite for ESM compatibility
    const { createServer, normalizePath } = await Promise.resolve().then(() => __importStar(require('vite')));
    let server;
    let listeningAddress;
    let hadError = false;
    const generatedFiles = new Map();
    const assetFiles = new Map();
    const build = builderName === '@angular-devkit/build-angular:application'
        ? application_1.buildApplicationInternal
        : browser_esbuild_1.buildEsbuildBrowser;
    // TODO: Switch this to an architect schedule call when infrastructure settings are supported
    for await (const result of build(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    browserOptions, context, {
        write: false,
    }, plugins)) {
        (0, node_assert_1.default)(result.outputFiles, 'Builder did not provide result files.');
        // If build failed, nothing to serve
        if (!result.success) {
            // If server is active, send an error notification
            if (result.errors?.length && server) {
                hadError = true;
                server.ws.send({
                    type: 'error',
                    err: {
                        message: result.errors[0].text,
                        stack: '',
                        loc: result.errors[0].location,
                    },
                });
            }
            continue;
        }
        else if (hadError && server) {
            hadError = false;
            // Send an empty update to clear the error overlay
            server.ws.send({
                'type': 'update',
                updates: [],
            });
        }
        // Analyze result files for changes
        analyzeResultFiles(normalizePath, htmlIndexPath, result.outputFiles, generatedFiles);
        assetFiles.clear();
        if (result.assetFiles) {
            for (const asset of result.assetFiles) {
                assetFiles.set('/' + normalizePath(asset.destination), asset.source);
            }
        }
        if (server) {
            handleUpdate(generatedFiles, server, serverOptions, context.logger);
        }
        else {
            const projectName = context.target?.project;
            if (!projectName) {
                throw new Error('The builder requires a target.');
            }
            const { root = '' } = await context.getProjectMetadata(projectName);
            const projectRoot = node_path_1.default.join(context.workspaceRoot, root);
            const browsers = (0, supported_browsers_1.getSupportedBrowsers)(projectRoot, context.logger);
            const target = (0, utils_1.transformSupportedBrowsersToTargets)(browsers);
            // Setup server and start listening
            const serverConfiguration = await setupServer(serverOptions, generatedFiles, assetFiles, browserOptions.preserveSymlinks, browserOptions.externalDependencies, !!browserOptions.ssr, prebundleTransformer, target);
            server = await createServer(serverConfiguration);
            await server.listen();
            listeningAddress = server.httpServer?.address();
            // log connection information
            server.printUrls();
        }
        // TODO: adjust output typings to reflect both development servers
        yield { success: true, port: listeningAddress?.port };
    }
    // Add cleanup logic via a builder teardown
    let deferred;
    context.addTeardown(async () => {
        await server?.close();
        await prebundleTransformer.close();
        deferred?.();
    });
    await new Promise((resolve) => (deferred = resolve));
}
exports.serveWithVite = serveWithVite;
function handleUpdate(generatedFiles, server, serverOptions, logger) {
    const updatedFiles = [];
    // Invalidate any updated files
    for (const [file, record] of generatedFiles) {
        if (record.updated) {
            updatedFiles.push(file);
            const updatedModules = server.moduleGraph.getModulesByFile(file);
            updatedModules?.forEach((m) => server?.moduleGraph.invalidateModule(m));
        }
    }
    if (!updatedFiles.length) {
        return;
    }
    if (serverOptions.liveReload || serverOptions.hmr) {
        if (updatedFiles.every((f) => f.endsWith('.css'))) {
            const timestamp = Date.now();
            server.ws.send({
                type: 'update',
                updates: updatedFiles.map((f) => {
                    const filePath = f.slice(1); // Remove leading slash.
                    return {
                        type: 'css-update',
                        timestamp,
                        path: filePath,
                        acceptedPath: filePath,
                    };
                }),
            });
            logger.info('HMR update sent to client(s)...');
            return;
        }
    }
    // Send reload command to clients
    if (serverOptions.liveReload) {
        logger.info('Reloading client(s)...');
        server.ws.send({
            type: 'full-reload',
            path: '*',
        });
    }
}
function analyzeResultFiles(normalizePath, htmlIndexPath, resultFiles, generatedFiles) {
    const seen = new Set(['/index.html']);
    for (const file of resultFiles) {
        let filePath;
        if (file.path === htmlIndexPath) {
            // Convert custom index output path to standard index path for dev-server usage.
            // This mimics the Webpack dev-server behavior.
            filePath = '/index.html';
        }
        else {
            filePath = '/' + normalizePath(file.path);
        }
        seen.add(filePath);
        // Skip analysis of sourcemaps
        if (filePath.endsWith('.map')) {
            generatedFiles.set(filePath, {
                contents: file.contents,
                servable: file.type === bundler_context_1.BuildOutputFileType.Browser || file.type === bundler_context_1.BuildOutputFileType.Media,
                size: file.contents.byteLength,
                updated: false,
            });
            continue;
        }
        const existingRecord = generatedFiles.get(filePath);
        if (existingRecord &&
            existingRecord.size === file.contents.byteLength &&
            existingRecord.hash === file.hash) {
            // Same file
            existingRecord.updated = false;
            continue;
        }
        // New or updated file
        generatedFiles.set(filePath, {
            contents: file.contents,
            size: file.contents.byteLength,
            hash: file.hash,
            updated: true,
            servable: file.type === bundler_context_1.BuildOutputFileType.Browser || file.type === bundler_context_1.BuildOutputFileType.Media,
        });
    }
    // Clear stale output files
    for (const file of generatedFiles.keys()) {
        if (!seen.has(file)) {
            generatedFiles.delete(file);
        }
    }
}
// eslint-disable-next-line max-lines-per-function
async function setupServer(serverOptions, outputFiles, assets, preserveSymlinks, prebundleExclude, ssr, prebundleTransformer, target) {
    const proxy = await (0, load_proxy_config_1.loadProxyConfiguration)(serverOptions.workspaceRoot, serverOptions.proxyConfig, true);
    // dynamically import Vite for ESM compatibility
    const { normalizePath } = await Promise.resolve().then(() => __importStar(require('vite')));
    const configuration = {
        configFile: false,
        envFile: false,
        cacheDir: node_path_1.default.join(serverOptions.cacheOptions.path, 'vite'),
        root: serverOptions.workspaceRoot,
        publicDir: false,
        esbuild: false,
        mode: 'development',
        appType: 'spa',
        css: {
            devSourcemap: true,
        },
        base: serverOptions.servePath,
        resolve: {
            mainFields: ['es2020', 'browser', 'module', 'main'],
            preserveSymlinks,
        },
        server: {
            port: serverOptions.port,
            strictPort: true,
            host: serverOptions.host,
            open: serverOptions.open,
            headers: serverOptions.headers,
            proxy,
            // Currently does not appear to be a way to disable file watching directly so ignore all files
            watch: {
                ignored: ['**/*'],
            },
        },
        ssr: {
            // Exclude any provided dependencies (currently build defined externals)
            external: prebundleExclude,
        },
        plugins: [
            (0, i18n_locale_plugin_1.createAngularLocaleDataPlugin)(),
            {
                name: 'vite:angular-memory',
                // Ensures plugin hooks run before built-in Vite hooks
                enforce: 'pre',
                async resolveId(source, importer) {
                    if (importer && source.startsWith('.')) {
                        // Remove query if present
                        const [importerFile] = importer.split('?', 1);
                        source = normalizePath(node_path_1.default.join(node_path_1.default.dirname(importerFile), source));
                    }
                    const [file] = source.split('?', 1);
                    if (outputFiles.has(file)) {
                        return source;
                    }
                },
                load(id) {
                    const [file] = id.split('?', 1);
                    const codeContents = outputFiles.get(file)?.contents;
                    if (codeContents === undefined) {
                        return;
                    }
                    const code = Buffer.from(codeContents).toString('utf-8');
                    const mapContents = outputFiles.get(file + '.map')?.contents;
                    return {
                        // Remove source map URL comments from the code if a sourcemap is present.
                        // Vite will inline and add an additional sourcemap URL for the sourcemap.
                        code: mapContents ? code.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, '') : code,
                        map: mapContents && Buffer.from(mapContents).toString('utf-8'),
                    };
                },
                configureServer(server) {
                    const originalssrTransform = server.ssrTransform;
                    server.ssrTransform = async (code, map, url, originalCode) => {
                        const result = await originalssrTransform(code, null, url, originalCode);
                        if (!result) {
                            return null;
                        }
                        let transformedCode = result.code;
                        if (result.map && map) {
                            transformedCode +=
                                `\n//# sourceMappingURL=` +
                                    `data:application/json;base64,${Buffer.from(JSON.stringify((0, remapping_1.default)([result.map, map], () => null))).toString('base64')}`;
                        }
                        return {
                            ...result,
                            map: null,
                            code: transformedCode,
                        };
                    };
                    // Assets and resources get handled first
                    server.middlewares.use(function angularAssetsMiddleware(req, res, next) {
                        if (req.url === undefined || res.writableEnded) {
                            return;
                        }
                        // Parse the incoming request.
                        // The base of the URL is unused but required to parse the URL.
                        const pathname = pathnameWithoutServePath(req.url, serverOptions);
                        const extension = node_path_1.default.extname(pathname);
                        // Rewrite all build assets to a vite raw fs URL
                        const assetSourcePath = assets.get(pathname);
                        if (assetSourcePath !== undefined) {
                            // The encoding needs to match what happens in the vite static middleware.
                            // ref: https://github.com/vitejs/vite/blob/d4f13bd81468961c8c926438e815ab6b1c82735e/packages/vite/src/node/server/middlewares/static.ts#L163
                            req.url = `/@fs/${encodeURI(assetSourcePath)}`;
                            next();
                            return;
                        }
                        // Resource files are handled directly.
                        // Global stylesheets (CSS files) are currently considered resources to workaround
                        // dev server sourcemap issues with stylesheets.
                        if (extension !== '.js' && extension !== '.html') {
                            const outputFile = outputFiles.get(pathname);
                            if (outputFile?.servable) {
                                const mimeType = (0, mrmime_1.lookup)(extension);
                                if (mimeType) {
                                    res.setHeader('Content-Type', mimeType);
                                }
                                res.setHeader('Cache-Control', 'no-cache');
                                if (serverOptions.headers) {
                                    Object.entries(serverOptions.headers).forEach(([name, value]) => res.setHeader(name, value));
                                }
                                res.end(outputFile.contents);
                                return;
                            }
                        }
                        next();
                    });
                    // Returning a function, installs middleware after the main transform middleware but
                    // before the built-in HTML middleware
                    return () => {
                        function angularSSRMiddleware(req, res, next) {
                            const url = req.originalUrl;
                            if (!url || url.endsWith('.html')) {
                                next();
                                return;
                            }
                            const rawHtml = outputFiles.get('/index.server.html')?.contents;
                            if (!rawHtml) {
                                next();
                                return;
                            }
                            transformIndexHtmlAndAddHeaders(url, rawHtml, res, next, async (html) => {
                                const { content } = await (0, render_page_1.renderPage)({
                                    document: html,
                                    route: pathnameWithoutServePath(url, serverOptions),
                                    serverContext: 'ssr',
                                    loadBundle: (path) => 
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    server.ssrLoadModule(path.slice(1)),
                                    // Files here are only needed for critical CSS inlining.
                                    outputFiles: {},
                                    // TODO: add support for critical css inlining.
                                    inlineCriticalCss: false,
                                });
                                return content;
                            });
                        }
                        if (ssr) {
                            server.middlewares.use(angularSSRMiddleware);
                        }
                        server.middlewares.use(function angularIndexMiddleware(req, res, next) {
                            if (!req.url) {
                                next();
                                return;
                            }
                            // Parse the incoming request.
                            // The base of the URL is unused but required to parse the URL.
                            const pathname = pathnameWithoutServePath(req.url, serverOptions);
                            if (pathname === '/' || pathname === `/index.html`) {
                                const rawHtml = outputFiles.get('/index.html')?.contents;
                                if (rawHtml) {
                                    transformIndexHtmlAndAddHeaders(req.url, rawHtml, res, next);
                                    return;
                                }
                            }
                            next();
                        });
                    };
                    function transformIndexHtmlAndAddHeaders(url, rawHtml, res, next, additionalTransformer) {
                        server
                            .transformIndexHtml(url, Buffer.from(rawHtml).toString('utf-8'))
                            .then(async (processedHtml) => {
                            if (additionalTransformer) {
                                const content = await additionalTransformer(processedHtml);
                                if (!content) {
                                    next();
                                    return;
                                }
                                processedHtml = content;
                            }
                            res.setHeader('Content-Type', 'text/html');
                            res.setHeader('Cache-Control', 'no-cache');
                            if (serverOptions.headers) {
                                Object.entries(serverOptions.headers).forEach(([name, value]) => res.setHeader(name, value));
                            }
                            res.end(processedHtml);
                        })
                            .catch((error) => next(error));
                    }
                },
            },
        ],
        optimizeDeps: {
            // Only enable with caching since it causes prebundle dependencies to be cached
            disabled: !serverOptions.cacheOptions.enabled,
            // Exclude any provided dependencies (currently build defined externals)
            exclude: prebundleExclude,
            // Skip automatic file-based entry point discovery
            entries: [],
            // Add an esbuild plugin to run the Angular linker on dependencies
            esbuildOptions: {
                // Set esbuild supported targets.
                target,
                supported: (0, utils_1.getFeatureSupport)(target),
                plugins: [
                    {
                        name: 'angular-vite-optimize-deps',
                        setup(build) {
                            build.onLoad({ filter: /\.[cm]?js$/ }, async (args) => {
                                return {
                                    contents: await prebundleTransformer.transformFile(args.path),
                                    loader: 'js',
                                };
                            });
                        },
                    },
                ],
            },
        },
    };
    if (serverOptions.ssl) {
        if (serverOptions.sslCert && serverOptions.sslKey) {
            // server configuration is defined above
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            configuration.server.https = {
                cert: await (0, promises_1.readFile)(serverOptions.sslCert),
                key: await (0, promises_1.readFile)(serverOptions.sslKey),
            };
        }
        else {
            const { default: basicSslPlugin } = await Promise.resolve().then(() => __importStar(require('@vitejs/plugin-basic-ssl')));
            configuration.plugins ??= [];
            configuration.plugins.push(basicSslPlugin());
        }
    }
    return configuration;
}
exports.setupServer = setupServer;
function pathnameWithoutServePath(url, serverOptions) {
    const parsedUrl = new URL(url, 'http://localhost');
    let pathname = decodeURIComponent(parsedUrl.pathname);
    if (serverOptions.servePath && pathname.startsWith(serverOptions.servePath)) {
        pathname = pathname.slice(serverOptions.servePath.length);
        if (pathname[0] !== '/') {
            pathname = '/' + pathname;
        }
    }
    return pathname;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3ZpdGUtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsc0VBQWtFO0FBSWxFLG1DQUFrRDtBQUNsRCw4REFBaUM7QUFDakMsK0NBQTRDO0FBRzVDLDBEQUE2QjtBQUU3Qix5RUFBMkY7QUFDM0YsdUZBQW1GO0FBQ25GLHFEQUFtRztBQUNuRyw0RUFBb0Y7QUFDcEYsMEVBQXNFO0FBQ3RFLHVFQUFzRTtBQUN0RSwrRUFBd0U7QUFDeEUsZ0RBQTBEO0FBQzFELHdEQUF5RDtBQUV6RCwyREFBNkQ7QUFZdEQsS0FBSyxTQUFTLENBQUMsQ0FBQyxhQUFhLENBQ2xDLGFBQXlDLEVBQ3pDLFdBQW1CLEVBQ25CLE9BQXVCLEVBQ3ZCLE9BQWtCO0lBRWxCLHNEQUFzRDtJQUN0RCxNQUFNLGlCQUFpQixHQUFHLENBQUMsTUFBTSxPQUFPLENBQUMsZ0JBQWdCLENBQ3ZELGFBQWEsQ0FBQyxXQUFXLENBQzFCLENBQTRDLENBQUM7SUFFOUMsTUFBTSxjQUFjLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQ25EO1FBQ0UsR0FBRyxpQkFBaUI7UUFDcEIsS0FBSyxFQUFFLGFBQWEsQ0FBQyxLQUFLO1FBQzFCLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSTtRQUN4QixPQUFPLEVBQUUsYUFBYSxDQUFDLE9BQU87S0FDWSxFQUM1QyxXQUFXLENBQ1osQ0FBNEMsQ0FBQztJQUU5QyxJQUFJLGNBQWMsQ0FBQyxTQUFTLEVBQUU7UUFDNUIsaURBQWlEO1FBQ2pELHNIQUFzSDtRQUN0SCxjQUFjLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQztR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QUFNLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxHQUFHLHdEQUFhLDBCQUEwQixHQUFDLENBQUM7WUFDN0UsYUFBYSxDQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDN0IsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQztTQUM5QztLQUNGO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQztBQXJURCxrQ0FxVEM7QUFFRCxTQUFTLHdCQUF3QixDQUFDLEdBQVcsRUFBRSxhQUF5QztJQUN0RixNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUNuRCxJQUFJLFFBQVEsR0FBRyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDdEQsSUFBSSxhQUFhLENBQUMsU0FBUyxJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1FBQzNFLFFBQVEsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDMUQsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1lBQ3ZCLFFBQVEsR0FBRyxHQUFHLEdBQUcsUUFBUSxDQUFDO1NBQzNCO0tBQ0Y7SUFFRCxPQUFPLFFBQVEsQ0FBQztBQUNsQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCByZW1hcHBpbmcsIHsgU291cmNlTWFwSW5wdXQgfSBmcm9tICdAYW1wcHJvamVjdC9yZW1hcHBpbmcnO1xuaW1wb3J0IHR5cGUgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHR5cGUgeyBqc29uLCBsb2dnaW5nIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHR5cGUgeyBQbHVnaW4gfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IGxvb2t1cCBhcyBsb29rdXBNaW1lVHlwZSB9IGZyb20gJ21ybWltZSc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBTZXJ2ZXJSZXNwb25zZSB9IGZyb20gJ25vZGU6aHR0cCc7XG5pbXBvcnQgdHlwZSB7IEFkZHJlc3NJbmZvIH0gZnJvbSAnbm9kZTpuZXQnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB0eXBlIHsgQ29ubmVjdCwgSW5saW5lQ29uZmlnLCBWaXRlRGV2U2VydmVyIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyBCdWlsZE91dHB1dEZpbGUsIEJ1aWxkT3V0cHV0RmlsZVR5cGUgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgeyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2phdmFzY3JpcHQtdHJhbnNmb3JtZXInO1xuaW1wb3J0IHsgZ2V0RmVhdHVyZVN1cHBvcnQsIHRyYW5zZm9ybVN1cHBvcnRlZEJyb3dzZXJzVG9UYXJnZXRzIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC91dGlscyc7XG5pbXBvcnQgeyBjcmVhdGVBbmd1bGFyTG9jYWxlRGF0YVBsdWdpbiB9IGZyb20gJy4uLy4uL3Rvb2xzL3ZpdGUvaTE4bi1sb2NhbGUtcGx1Z2luJztcbmltcG9ydCB7IHJlbmRlclBhZ2UgfSBmcm9tICcuLi8uLi91dGlscy9zZXJ2ZXItcmVuZGVyaW5nL3JlbmRlci1wYWdlJztcbmltcG9ydCB7IGdldFN1cHBvcnRlZEJyb3dzZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3VwcG9ydGVkLWJyb3dzZXJzJztcbmltcG9ydCB7IGdldEluZGV4T3V0cHV0RmlsZSB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgYnVpbGRBcHBsaWNhdGlvbkludGVybmFsIH0gZnJvbSAnLi4vYXBwbGljYXRpb24nO1xuaW1wb3J0IHsgYnVpbGRFc2J1aWxkQnJvd3NlciB9IGZyb20gJy4uL2Jyb3dzZXItZXNidWlsZCc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi4vYnJvd3Nlci1lc2J1aWxkL3NjaGVtYSc7XG5pbXBvcnQgeyBsb2FkUHJveHlDb25maWd1cmF0aW9uIH0gZnJvbSAnLi9sb2FkLXByb3h5LWNvbmZpZyc7XG5pbXBvcnQgdHlwZSB7IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB0eXBlIHsgRGV2U2VydmVyQnVpbGRlck91dHB1dCB9IGZyb20gJy4vd2VicGFjay1zZXJ2ZXInO1xuXG5pbnRlcmZhY2UgT3V0cHV0RmlsZVJlY29yZCB7XG4gIGNvbnRlbnRzOiBVaW50OEFycmF5O1xuICBzaXplOiBudW1iZXI7XG4gIGhhc2g/OiBzdHJpbmc7XG4gIHVwZGF0ZWQ6IGJvb2xlYW47XG4gIHNlcnZhYmxlOiBib29sZWFuO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24qIHNlcnZlV2l0aFZpdGUoXG4gIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zLFxuICBidWlsZGVyTmFtZTogc3RyaW5nLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgcGx1Z2lucz86IFBsdWdpbltdLFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPERldlNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gR2V0IHRoZSBicm93c2VyIGNvbmZpZ3VyYXRpb24gZnJvbSB0aGUgdGFyZ2V0IG5hbWUuXG4gIGNvbnN0IHJhd0Jyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhcbiAgICBzZXJ2ZXJPcHRpb25zLmJ1aWxkVGFyZ2V0LFxuICApKSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG5cbiAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC52YWxpZGF0ZU9wdGlvbnMoXG4gICAge1xuICAgICAgLi4ucmF3QnJvd3Nlck9wdGlvbnMsXG4gICAgICB3YXRjaDogc2VydmVyT3B0aW9ucy53YXRjaCxcbiAgICAgIHBvbGw6IHNlcnZlck9wdGlvbnMucG9sbCxcbiAgICAgIHZlcmJvc2U6IHNlcnZlck9wdGlvbnMudmVyYm9zZSxcbiAgICB9IGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgICBidWlsZGVyTmFtZSxcbiAgKSkgYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zO1xuXG4gIGlmIChicm93c2VyT3B0aW9ucy5wcmVyZW5kZXIpIHtcbiAgICAvLyBEaXNhYmxlIHByZXJlbmRlcmluZyBpZiBlbmFibGVkIGFuZCBmb3JjZSBTU1IuXG4gICAgLy8gVGhpcyBpcyBzbyBpbnN0ZWFkIG9mIHByZXJlbmRlcmluZyBhbGwgdGhlIHJvdXRlcyBmb3IgZXZlcnkgY2hhbmdlLCB0aGUgcGFnZSBpcyBcInByZXJlbmRlcmVkXCIgd2hlbiBpdCBpcyByZXF1ZXN0ZWQuXG4gICAgYnJvd3Nlck9wdGlvbnMuc3NyID0gdHJ1ZTtcbiAgICBicm93c2VyT3B0aW9ucy5wcmVyZW5kZXIgPSBmYWxzZTtcblxuICAgIC8vIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvcHJvY2Vzcy5odG1sI3Byb2Nlc3NzZXRzb3VyY2VtYXBzZW5hYmxlZHZhbFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgKHByb2Nlc3MgYXMgYW55KS5zZXRTb3VyY2VNYXBzRW5hYmxlZCh0cnVlKTtcbiAgfVxuXG4gIC8vIFNldCBhbGwgcGFja2FnZXMgYXMgZXh0ZXJuYWwgdG8gc3VwcG9ydCBWaXRlJ3MgcHJlYnVuZGxlIGNhY2hpbmdcbiAgYnJvd3Nlck9wdGlvbnMuZXh0ZXJuYWxQYWNrYWdlcyA9IHNlcnZlck9wdGlvbnMuY2FjaGVPcHRpb25zLmVuYWJsZWQ7XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoID09PSB1bmRlZmluZWQgJiYgYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYgIT09IHVuZGVmaW5lZCkge1xuICAgIHNlcnZlck9wdGlvbnMuc2VydmVQYXRoID0gYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWY7XG4gIH1cblxuICAvLyBUaGUgZGV2ZWxvcG1lbnQgc2VydmVyIGN1cnJlbnRseSBvbmx5IHN1cHBvcnRzIGEgc2luZ2xlIGxvY2FsZSB3aGVuIGxvY2FsaXppbmcuXG4gIC8vIFRoaXMgbWF0Y2hlcyB0aGUgYmVoYXZpb3Igb2YgdGhlIFdlYnBhY2stYmFzZWQgZGV2ZWxvcG1lbnQgc2VydmVyIGJ1dCBjb3VsZCBiZSBleHBhbmRlZCBpbiB0aGUgZnV0dXJlLlxuICBpZiAoXG4gICAgYnJvd3Nlck9wdGlvbnMubG9jYWxpemUgPT09IHRydWUgfHxcbiAgICAoQXJyYXkuaXNBcnJheShicm93c2VyT3B0aW9ucy5sb2NhbGl6ZSkgJiYgYnJvd3Nlck9wdGlvbnMubG9jYWxpemUubGVuZ3RoID4gMSlcbiAgKSB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICdMb2NhbGl6YXRpb24gKGBsb2NhbGl6ZWAgb3B0aW9uKSBoYXMgYmVlbiBkaXNhYmxlZC4gVGhlIGRldmVsb3BtZW50IHNlcnZlciBvbmx5IHN1cHBvcnRzIGxvY2FsaXppbmcgYSBzaW5nbGUgbG9jYWxlIHBlciBidWlsZC4nLFxuICAgICk7XG4gICAgYnJvd3Nlck9wdGlvbnMubG9jYWxpemUgPSBmYWxzZTtcbiAgfSBlbHNlIGlmIChicm93c2VyT3B0aW9ucy5sb2NhbGl6ZSkge1xuICAgIC8vIFdoZW4gbG9jYWxpemF0aW9uIGlzIGVuYWJsZWQgd2l0aCBhIHNpbmdsZSBsb2NhbGUsIGZvcmNlIGEgZmxhdCBwYXRoIHRvIG1haW50YWluIGJlaGF2aW9yIHdpdGggdGhlIGV4aXN0aW5nIFdlYnBhY2stYmFzZWQgZGV2IHNlcnZlci5cbiAgICBicm93c2VyT3B0aW9ucy5mb3JjZUkxOG5GbGF0T3V0cHV0ID0gdHJ1ZTtcbiAgfVxuXG4gIC8vIFNldHVwIHRoZSBwcmVidW5kbGluZyB0cmFuc2Zvcm1lciB0aGF0IHdpbGwgYmUgc2hhcmVkIGFjcm9zcyBWaXRlIHByZWJ1bmRsaW5nIHJlcXVlc3RzXG4gIGNvbnN0IHByZWJ1bmRsZVRyYW5zZm9ybWVyID0gbmV3IEphdmFTY3JpcHRUcmFuc2Zvcm1lcihcbiAgICAvLyBBbHdheXMgZW5hYmxlIEpJVCBsaW5raW5nIHRvIHN1cHBvcnQgYXBwbGljYXRpb25zIGJ1aWx0IHdpdGggYW5kIHdpdGhvdXQgQU9ULlxuICAgIC8vIEluIGEgZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnQgdGhlIGFkZGl0aW9uYWwgc2NvcGUgaW5mb3JtYXRpb24gZG9lcyBub3RcbiAgICAvLyBoYXZlIGEgbmVnYXRpdmUgZWZmZWN0IHVubGlrZSBwcm9kdWN0aW9uIHdoZXJlIGZpbmFsIG91dHB1dCBzaXplIGlzIHJlbGV2YW50LlxuICAgIHsgc291cmNlbWFwOiB0cnVlLCBqaXQ6IHRydWUgfSxcbiAgICAxLFxuICApO1xuXG4gIC8vIEV4dHJhY3Qgb3V0cHV0IGluZGV4IGZyb20gb3B0aW9uc1xuICAvLyBUT0RPOiBQcm92aWRlIHRoaXMgaW5mbyBmcm9tIHRoZSBidWlsZCByZXN1bHRzXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IGh0bWxJbmRleFBhdGggPSBnZXRJbmRleE91dHB1dEZpbGUoYnJvd3Nlck9wdGlvbnMuaW5kZXggYXMgYW55KTtcblxuICAvLyBkeW5hbWljYWxseSBpbXBvcnQgVml0ZSBmb3IgRVNNIGNvbXBhdGliaWxpdHlcbiAgY29uc3QgeyBjcmVhdGVTZXJ2ZXIsIG5vcm1hbGl6ZVBhdGggfSA9IGF3YWl0IGltcG9ydCgndml0ZScpO1xuXG4gIGxldCBzZXJ2ZXI6IFZpdGVEZXZTZXJ2ZXIgfCB1bmRlZmluZWQ7XG4gIGxldCBsaXN0ZW5pbmdBZGRyZXNzOiBBZGRyZXNzSW5mbyB8IHVuZGVmaW5lZDtcbiAgbGV0IGhhZEVycm9yID0gZmFsc2U7XG4gIGNvbnN0IGdlbmVyYXRlZEZpbGVzID0gbmV3IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+KCk7XG4gIGNvbnN0IGFzc2V0RmlsZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBjb25zdCBidWlsZCA9XG4gICAgYnVpbGRlck5hbWUgPT09ICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcjphcHBsaWNhdGlvbidcbiAgICAgID8gYnVpbGRBcHBsaWNhdGlvbkludGVybmFsXG4gICAgICA6IGJ1aWxkRXNidWlsZEJyb3dzZXI7XG5cbiAgLy8gVE9ETzogU3dpdGNoIHRoaXMgdG8gYW4gYXJjaGl0ZWN0IHNjaGVkdWxlIGNhbGwgd2hlbiBpbmZyYXN0cnVjdHVyZSBzZXR0aW5ncyBhcmUgc3VwcG9ydGVkXG4gIGZvciBhd2FpdCAoY29uc3QgcmVzdWx0IG9mIGJ1aWxkKFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgYnJvd3Nlck9wdGlvbnMgYXMgYW55LFxuICAgIGNvbnRleHQsXG4gICAge1xuICAgICAgd3JpdGU6IGZhbHNlLFxuICAgIH0sXG4gICAgcGx1Z2lucyxcbiAgKSkge1xuICAgIGFzc2VydChyZXN1bHQub3V0cHV0RmlsZXMsICdCdWlsZGVyIGRpZCBub3QgcHJvdmlkZSByZXN1bHQgZmlsZXMuJyk7XG5cbiAgICAvLyBJZiBidWlsZCBmYWlsZWQsIG5vdGhpbmcgdG8gc2VydmVcbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAvLyBJZiBzZXJ2ZXIgaXMgYWN0aXZlLCBzZW5kIGFuIGVycm9yIG5vdGlmaWNhdGlvblxuICAgICAgaWYgKHJlc3VsdC5lcnJvcnM/Lmxlbmd0aCAmJiBzZXJ2ZXIpIHtcbiAgICAgICAgaGFkRXJyb3IgPSB0cnVlO1xuICAgICAgICBzZXJ2ZXIud3Muc2VuZCh7XG4gICAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgICBlcnI6IHtcbiAgICAgICAgICAgIG1lc3NhZ2U6IHJlc3VsdC5lcnJvcnNbMF0udGV4dCxcbiAgICAgICAgICAgIHN0YWNrOiAnJyxcbiAgICAgICAgICAgIGxvYzogcmVzdWx0LmVycm9yc1swXS5sb2NhdGlvbixcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGNvbnRpbnVlO1xuICAgIH0gZWxzZSBpZiAoaGFkRXJyb3IgJiYgc2VydmVyKSB7XG4gICAgICBoYWRFcnJvciA9IGZhbHNlO1xuICAgICAgLy8gU2VuZCBhbiBlbXB0eSB1cGRhdGUgdG8gY2xlYXIgdGhlIGVycm9yIG92ZXJsYXlcbiAgICAgIHNlcnZlci53cy5zZW5kKHtcbiAgICAgICAgJ3R5cGUnOiAndXBkYXRlJyxcbiAgICAgICAgdXBkYXRlczogW10sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBbmFseXplIHJlc3VsdCBmaWxlcyBmb3IgY2hhbmdlc1xuICAgIGFuYWx5emVSZXN1bHRGaWxlcyhub3JtYWxpemVQYXRoLCBodG1sSW5kZXhQYXRoLCByZXN1bHQub3V0cHV0RmlsZXMsIGdlbmVyYXRlZEZpbGVzKTtcblxuICAgIGFzc2V0RmlsZXMuY2xlYXIoKTtcbiAgICBpZiAocmVzdWx0LmFzc2V0RmlsZXMpIHtcbiAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgcmVzdWx0LmFzc2V0RmlsZXMpIHtcbiAgICAgICAgYXNzZXRGaWxlcy5zZXQoJy8nICsgbm9ybWFsaXplUGF0aChhc3NldC5kZXN0aW5hdGlvbiksIGFzc2V0LnNvdXJjZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNlcnZlcikge1xuICAgICAgaGFuZGxlVXBkYXRlKGdlbmVyYXRlZEZpbGVzLCBzZXJ2ZXIsIHNlcnZlck9wdGlvbnMsIGNvbnRleHQubG9nZ2VyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgICAgIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldC4nKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgeyByb290ID0gJycgfSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgICAgIGNvbnN0IHByb2plY3RSb290ID0gcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgcm9vdCBhcyBzdHJpbmcpO1xuICAgICAgY29uc3QgYnJvd3NlcnMgPSBnZXRTdXBwb3J0ZWRCcm93c2Vycyhwcm9qZWN0Um9vdCwgY29udGV4dC5sb2dnZXIpO1xuICAgICAgY29uc3QgdGFyZ2V0ID0gdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMoYnJvd3NlcnMpO1xuXG4gICAgICAvLyBTZXR1cCBzZXJ2ZXIgYW5kIHN0YXJ0IGxpc3RlbmluZ1xuICAgICAgY29uc3Qgc2VydmVyQ29uZmlndXJhdGlvbiA9IGF3YWl0IHNldHVwU2VydmVyKFxuICAgICAgICBzZXJ2ZXJPcHRpb25zLFxuICAgICAgICBnZW5lcmF0ZWRGaWxlcyxcbiAgICAgICAgYXNzZXRGaWxlcyxcbiAgICAgICAgYnJvd3Nlck9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgICAgYnJvd3Nlck9wdGlvbnMuZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgICAgICEhYnJvd3Nlck9wdGlvbnMuc3NyLFxuICAgICAgICBwcmVidW5kbGVUcmFuc2Zvcm1lcixcbiAgICAgICAgdGFyZ2V0LFxuICAgICAgKTtcblxuICAgICAgc2VydmVyID0gYXdhaXQgY3JlYXRlU2VydmVyKHNlcnZlckNvbmZpZ3VyYXRpb24pO1xuXG4gICAgICBhd2FpdCBzZXJ2ZXIubGlzdGVuKCk7XG4gICAgICBsaXN0ZW5pbmdBZGRyZXNzID0gc2VydmVyLmh0dHBTZXJ2ZXI/LmFkZHJlc3MoKSBhcyBBZGRyZXNzSW5mbztcblxuICAgICAgLy8gbG9nIGNvbm5lY3Rpb24gaW5mb3JtYXRpb25cbiAgICAgIHNlcnZlci5wcmludFVybHMoKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBhZGp1c3Qgb3V0cHV0IHR5cGluZ3MgdG8gcmVmbGVjdCBib3RoIGRldmVsb3BtZW50IHNlcnZlcnNcbiAgICB5aWVsZCB7IHN1Y2Nlc3M6IHRydWUsIHBvcnQ6IGxpc3RlbmluZ0FkZHJlc3M/LnBvcnQgfSBhcyB1bmtub3duIGFzIERldlNlcnZlckJ1aWxkZXJPdXRwdXQ7XG4gIH1cblxuICAvLyBBZGQgY2xlYW51cCBsb2dpYyB2aWEgYSBidWlsZGVyIHRlYXJkb3duXG4gIGxldCBkZWZlcnJlZDogKCkgPT4gdm9pZDtcbiAgY29udGV4dC5hZGRUZWFyZG93bihhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgc2VydmVyPy5jbG9zZSgpO1xuICAgIGF3YWl0IHByZWJ1bmRsZVRyYW5zZm9ybWVyLmNsb3NlKCk7XG4gICAgZGVmZXJyZWQ/LigpO1xuICB9KTtcbiAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IChkZWZlcnJlZCA9IHJlc29sdmUpKTtcbn1cblxuZnVuY3Rpb24gaGFuZGxlVXBkYXRlKFxuICBnZW5lcmF0ZWRGaWxlczogTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4sXG4gIHNlcnZlcjogVml0ZURldlNlcnZlcixcbiAgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMsXG4gIGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXJBcGksXG4pOiB2b2lkIHtcbiAgY29uc3QgdXBkYXRlZEZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8vIEludmFsaWRhdGUgYW55IHVwZGF0ZWQgZmlsZXNcbiAgZm9yIChjb25zdCBbZmlsZSwgcmVjb3JkXSBvZiBnZW5lcmF0ZWRGaWxlcykge1xuICAgIGlmIChyZWNvcmQudXBkYXRlZCkge1xuICAgICAgdXBkYXRlZEZpbGVzLnB1c2goZmlsZSk7XG4gICAgICBjb25zdCB1cGRhdGVkTW9kdWxlcyA9IHNlcnZlci5tb2R1bGVHcmFwaC5nZXRNb2R1bGVzQnlGaWxlKGZpbGUpO1xuICAgICAgdXBkYXRlZE1vZHVsZXM/LmZvckVhY2goKG0pID0+IHNlcnZlcj8ubW9kdWxlR3JhcGguaW52YWxpZGF0ZU1vZHVsZShtKSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKCF1cGRhdGVkRmlsZXMubGVuZ3RoKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMubGl2ZVJlbG9hZCB8fCBzZXJ2ZXJPcHRpb25zLmhtcikge1xuICAgIGlmICh1cGRhdGVkRmlsZXMuZXZlcnkoKGYpID0+IGYuZW5kc1dpdGgoJy5jc3MnKSkpIHtcbiAgICAgIGNvbnN0IHRpbWVzdGFtcCA9IERhdGUubm93KCk7XG4gICAgICBzZXJ2ZXIud3Muc2VuZCh7XG4gICAgICAgIHR5cGU6ICd1cGRhdGUnLFxuICAgICAgICB1cGRhdGVzOiB1cGRhdGVkRmlsZXMubWFwKChmKSA9PiB7XG4gICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBmLnNsaWNlKDEpOyAvLyBSZW1vdmUgbGVhZGluZyBzbGFzaC5cblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiAnY3NzLXVwZGF0ZScsXG4gICAgICAgICAgICB0aW1lc3RhbXAsXG4gICAgICAgICAgICBwYXRoOiBmaWxlUGF0aCxcbiAgICAgICAgICAgIGFjY2VwdGVkUGF0aDogZmlsZVBhdGgsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSksXG4gICAgICB9KTtcblxuICAgICAgbG9nZ2VyLmluZm8oJ0hNUiB1cGRhdGUgc2VudCB0byBjbGllbnQocykuLi4nKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNlbmQgcmVsb2FkIGNvbW1hbmQgdG8gY2xpZW50c1xuICBpZiAoc2VydmVyT3B0aW9ucy5saXZlUmVsb2FkKSB7XG4gICAgbG9nZ2VyLmluZm8oJ1JlbG9hZGluZyBjbGllbnQocykuLi4nKTtcblxuICAgIHNlcnZlci53cy5zZW5kKHtcbiAgICAgIHR5cGU6ICdmdWxsLXJlbG9hZCcsXG4gICAgICBwYXRoOiAnKicsXG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gYW5hbHl6ZVJlc3VsdEZpbGVzKFxuICBub3JtYWxpemVQYXRoOiAoaWQ6IHN0cmluZykgPT4gc3RyaW5nLFxuICBodG1sSW5kZXhQYXRoOiBzdHJpbmcsXG4gIHJlc3VsdEZpbGVzOiBCdWlsZE91dHB1dEZpbGVbXSxcbiAgZ2VuZXJhdGVkRmlsZXM6IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+LFxuKSB7XG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oWycvaW5kZXguaHRtbCddKTtcbiAgZm9yIChjb25zdCBmaWxlIG9mIHJlc3VsdEZpbGVzKSB7XG4gICAgbGV0IGZpbGVQYXRoO1xuICAgIGlmIChmaWxlLnBhdGggPT09IGh0bWxJbmRleFBhdGgpIHtcbiAgICAgIC8vIENvbnZlcnQgY3VzdG9tIGluZGV4IG91dHB1dCBwYXRoIHRvIHN0YW5kYXJkIGluZGV4IHBhdGggZm9yIGRldi1zZXJ2ZXIgdXNhZ2UuXG4gICAgICAvLyBUaGlzIG1pbWljcyB0aGUgV2VicGFjayBkZXYtc2VydmVyIGJlaGF2aW9yLlxuICAgICAgZmlsZVBhdGggPSAnL2luZGV4Lmh0bWwnO1xuICAgIH0gZWxzZSB7XG4gICAgICBmaWxlUGF0aCA9ICcvJyArIG5vcm1hbGl6ZVBhdGgoZmlsZS5wYXRoKTtcbiAgICB9XG4gICAgc2Vlbi5hZGQoZmlsZVBhdGgpO1xuXG4gICAgLy8gU2tpcCBhbmFseXNpcyBvZiBzb3VyY2VtYXBzXG4gICAgaWYgKGZpbGVQYXRoLmVuZHNXaXRoKCcubWFwJykpIHtcbiAgICAgIGdlbmVyYXRlZEZpbGVzLnNldChmaWxlUGF0aCwge1xuICAgICAgICBjb250ZW50czogZmlsZS5jb250ZW50cyxcbiAgICAgICAgc2VydmFibGU6XG4gICAgICAgICAgZmlsZS50eXBlID09PSBCdWlsZE91dHB1dEZpbGVUeXBlLkJyb3dzZXIgfHwgZmlsZS50eXBlID09PSBCdWlsZE91dHB1dEZpbGVUeXBlLk1lZGlhLFxuICAgICAgICBzaXplOiBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgsXG4gICAgICAgIHVwZGF0ZWQ6IGZhbHNlLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGV4aXN0aW5nUmVjb3JkID0gZ2VuZXJhdGVkRmlsZXMuZ2V0KGZpbGVQYXRoKTtcbiAgICBpZiAoXG4gICAgICBleGlzdGluZ1JlY29yZCAmJlxuICAgICAgZXhpc3RpbmdSZWNvcmQuc2l6ZSA9PT0gZmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoICYmXG4gICAgICBleGlzdGluZ1JlY29yZC5oYXNoID09PSBmaWxlLmhhc2hcbiAgICApIHtcbiAgICAgIC8vIFNhbWUgZmlsZVxuICAgICAgZXhpc3RpbmdSZWNvcmQudXBkYXRlZCA9IGZhbHNlO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gTmV3IG9yIHVwZGF0ZWQgZmlsZVxuICAgIGdlbmVyYXRlZEZpbGVzLnNldChmaWxlUGF0aCwge1xuICAgICAgY29udGVudHM6IGZpbGUuY29udGVudHMsXG4gICAgICBzaXplOiBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgsXG4gICAgICBoYXNoOiBmaWxlLmhhc2gsXG4gICAgICB1cGRhdGVkOiB0cnVlLFxuICAgICAgc2VydmFibGU6XG4gICAgICAgIGZpbGUudHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5Ccm93c2VyIHx8IGZpbGUudHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5NZWRpYSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIENsZWFyIHN0YWxlIG91dHB1dCBmaWxlc1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgZ2VuZXJhdGVkRmlsZXMua2V5cygpKSB7XG4gICAgaWYgKCFzZWVuLmhhcyhmaWxlKSkge1xuICAgICAgZ2VuZXJhdGVkRmlsZXMuZGVsZXRlKGZpbGUpO1xuICAgIH1cbiAgfVxufVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldHVwU2VydmVyKFxuICBzZXJ2ZXJPcHRpb25zOiBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyxcbiAgb3V0cHV0RmlsZXM6IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+LFxuICBhc3NldHM6IE1hcDxzdHJpbmcsIHN0cmluZz4sXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4gfCB1bmRlZmluZWQsXG4gIHByZWJ1bmRsZUV4Y2x1ZGU6IHN0cmluZ1tdIHwgdW5kZWZpbmVkLFxuICBzc3I6IGJvb2xlYW4sXG4gIHByZWJ1bmRsZVRyYW5zZm9ybWVyOiBKYXZhU2NyaXB0VHJhbnNmb3JtZXIsXG4gIHRhcmdldDogc3RyaW5nW10sXG4pOiBQcm9taXNlPElubGluZUNvbmZpZz4ge1xuICBjb25zdCBwcm94eSA9IGF3YWl0IGxvYWRQcm94eUNvbmZpZ3VyYXRpb24oXG4gICAgc2VydmVyT3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIHNlcnZlck9wdGlvbnMucHJveHlDb25maWcsXG4gICAgdHJ1ZSxcbiAgKTtcblxuICAvLyBkeW5hbWljYWxseSBpbXBvcnQgVml0ZSBmb3IgRVNNIGNvbXBhdGliaWxpdHlcbiAgY29uc3QgeyBub3JtYWxpemVQYXRoIH0gPSBhd2FpdCBpbXBvcnQoJ3ZpdGUnKTtcblxuICBjb25zdCBjb25maWd1cmF0aW9uOiBJbmxpbmVDb25maWcgPSB7XG4gICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgZW52RmlsZTogZmFsc2UsXG4gICAgY2FjaGVEaXI6IHBhdGguam9pbihzZXJ2ZXJPcHRpb25zLmNhY2hlT3B0aW9ucy5wYXRoLCAndml0ZScpLFxuICAgIHJvb3Q6IHNlcnZlck9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICBwdWJsaWNEaXI6IGZhbHNlLFxuICAgIGVzYnVpbGQ6IGZhbHNlLFxuICAgIG1vZGU6ICdkZXZlbG9wbWVudCcsXG4gICAgYXBwVHlwZTogJ3NwYScsXG4gICAgY3NzOiB7XG4gICAgICBkZXZTb3VyY2VtYXA6IHRydWUsXG4gICAgfSxcbiAgICBiYXNlOiBzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCxcbiAgICByZXNvbHZlOiB7XG4gICAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIH0sXG4gICAgc2VydmVyOiB7XG4gICAgICBwb3J0OiBzZXJ2ZXJPcHRpb25zLnBvcnQsXG4gICAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgICAgaG9zdDogc2VydmVyT3B0aW9ucy5ob3N0LFxuICAgICAgb3Blbjogc2VydmVyT3B0aW9ucy5vcGVuLFxuICAgICAgaGVhZGVyczogc2VydmVyT3B0aW9ucy5oZWFkZXJzLFxuICAgICAgcHJveHksXG4gICAgICAvLyBDdXJyZW50bHkgZG9lcyBub3QgYXBwZWFyIHRvIGJlIGEgd2F5IHRvIGRpc2FibGUgZmlsZSB3YXRjaGluZyBkaXJlY3RseSBzbyBpZ25vcmUgYWxsIGZpbGVzXG4gICAgICB3YXRjaDoge1xuICAgICAgICBpZ25vcmVkOiBbJyoqLyonXSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBzc3I6IHtcbiAgICAgIC8vIEV4Y2x1ZGUgYW55IHByb3ZpZGVkIGRlcGVuZGVuY2llcyAoY3VycmVudGx5IGJ1aWxkIGRlZmluZWQgZXh0ZXJuYWxzKVxuICAgICAgZXh0ZXJuYWw6IHByZWJ1bmRsZUV4Y2x1ZGUsXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVBbmd1bGFyTG9jYWxlRGF0YVBsdWdpbigpLFxuICAgICAge1xuICAgICAgICBuYW1lOiAndml0ZTphbmd1bGFyLW1lbW9yeScsXG4gICAgICAgIC8vIEVuc3VyZXMgcGx1Z2luIGhvb2tzIHJ1biBiZWZvcmUgYnVpbHQtaW4gVml0ZSBob29rc1xuICAgICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgICAgYXN5bmMgcmVzb2x2ZUlkKHNvdXJjZSwgaW1wb3J0ZXIpIHtcbiAgICAgICAgICBpZiAoaW1wb3J0ZXIgJiYgc291cmNlLnN0YXJ0c1dpdGgoJy4nKSkge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIHF1ZXJ5IGlmIHByZXNlbnRcbiAgICAgICAgICAgIGNvbnN0IFtpbXBvcnRlckZpbGVdID0gaW1wb3J0ZXIuc3BsaXQoJz8nLCAxKTtcblxuICAgICAgICAgICAgc291cmNlID0gbm9ybWFsaXplUGF0aChwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKGltcG9ydGVyRmlsZSksIHNvdXJjZSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IFtmaWxlXSA9IHNvdXJjZS5zcGxpdCgnPycsIDEpO1xuICAgICAgICAgIGlmIChvdXRwdXRGaWxlcy5oYXMoZmlsZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBzb3VyY2U7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBsb2FkKGlkKSB7XG4gICAgICAgICAgY29uc3QgW2ZpbGVdID0gaWQuc3BsaXQoJz8nLCAxKTtcbiAgICAgICAgICBjb25zdCBjb2RlQ29udGVudHMgPSBvdXRwdXRGaWxlcy5nZXQoZmlsZSk/LmNvbnRlbnRzO1xuICAgICAgICAgIGlmIChjb2RlQ29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGNvZGUgPSBCdWZmZXIuZnJvbShjb2RlQ29udGVudHMpLnRvU3RyaW5nKCd1dGYtOCcpO1xuICAgICAgICAgIGNvbnN0IG1hcENvbnRlbnRzID0gb3V0cHV0RmlsZXMuZ2V0KGZpbGUgKyAnLm1hcCcpPy5jb250ZW50cztcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgc291cmNlIG1hcCBVUkwgY29tbWVudHMgZnJvbSB0aGUgY29kZSBpZiBhIHNvdXJjZW1hcCBpcyBwcmVzZW50LlxuICAgICAgICAgICAgLy8gVml0ZSB3aWxsIGlubGluZSBhbmQgYWRkIGFuIGFkZGl0aW9uYWwgc291cmNlbWFwIFVSTCBmb3IgdGhlIHNvdXJjZW1hcC5cbiAgICAgICAgICAgIGNvZGU6IG1hcENvbnRlbnRzID8gY29kZS5yZXBsYWNlKC9eXFwvXFwvIyBzb3VyY2VNYXBwaW5nVVJMPVteXFxyXFxuXSovZ20sICcnKSA6IGNvZGUsXG4gICAgICAgICAgICBtYXA6IG1hcENvbnRlbnRzICYmIEJ1ZmZlci5mcm9tKG1hcENvbnRlbnRzKS50b1N0cmluZygndXRmLTgnKSxcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICAgICAgY29uc3Qgb3JpZ2luYWxzc3JUcmFuc2Zvcm0gPSBzZXJ2ZXIuc3NyVHJhbnNmb3JtO1xuICAgICAgICAgIHNlcnZlci5zc3JUcmFuc2Zvcm0gPSBhc3luYyAoY29kZSwgbWFwLCB1cmwsIG9yaWdpbmFsQ29kZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgb3JpZ2luYWxzc3JUcmFuc2Zvcm0oY29kZSwgbnVsbCwgdXJsLCBvcmlnaW5hbENvZGUpO1xuICAgICAgICAgICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCB0cmFuc2Zvcm1lZENvZGUgPSByZXN1bHQuY29kZTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQubWFwICYmIG1hcCkge1xuICAgICAgICAgICAgICB0cmFuc2Zvcm1lZENvZGUgKz1cbiAgICAgICAgICAgICAgICBgXFxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YCArXG4gICAgICAgICAgICAgICAgYGRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsJHtCdWZmZXIuZnJvbShcbiAgICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KFxuICAgICAgICAgICAgICAgICAgICByZW1hcHBpbmcoW3Jlc3VsdC5tYXAgYXMgU291cmNlTWFwSW5wdXQsIG1hcCBhcyBTb3VyY2VNYXBJbnB1dF0sICgpID0+IG51bGwpLFxuICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICApLnRvU3RyaW5nKCdiYXNlNjQnKX1gO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAuLi5yZXN1bHQsXG4gICAgICAgICAgICAgIG1hcDogbnVsbCxcbiAgICAgICAgICAgICAgY29kZTogdHJhbnNmb3JtZWRDb2RlLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8gQXNzZXRzIGFuZCByZXNvdXJjZXMgZ2V0IGhhbmRsZWQgZmlyc3RcbiAgICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGZ1bmN0aW9uIGFuZ3VsYXJBc3NldHNNaWRkbGV3YXJlKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgICAgICAgICBpZiAocmVxLnVybCA9PT0gdW5kZWZpbmVkIHx8IHJlcy53cml0YWJsZUVuZGVkKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUGFyc2UgdGhlIGluY29taW5nIHJlcXVlc3QuXG4gICAgICAgICAgICAvLyBUaGUgYmFzZSBvZiB0aGUgVVJMIGlzIHVudXNlZCBidXQgcmVxdWlyZWQgdG8gcGFyc2UgdGhlIFVSTC5cbiAgICAgICAgICAgIGNvbnN0IHBhdGhuYW1lID0gcGF0aG5hbWVXaXRob3V0U2VydmVQYXRoKHJlcS51cmwsIHNlcnZlck9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9uID0gcGF0aC5leHRuYW1lKHBhdGhuYW1lKTtcblxuICAgICAgICAgICAgLy8gUmV3cml0ZSBhbGwgYnVpbGQgYXNzZXRzIHRvIGEgdml0ZSByYXcgZnMgVVJMXG4gICAgICAgICAgICBjb25zdCBhc3NldFNvdXJjZVBhdGggPSBhc3NldHMuZ2V0KHBhdGhuYW1lKTtcbiAgICAgICAgICAgIGlmIChhc3NldFNvdXJjZVBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAvLyBUaGUgZW5jb2RpbmcgbmVlZHMgdG8gbWF0Y2ggd2hhdCBoYXBwZW5zIGluIHRoZSB2aXRlIHN0YXRpYyBtaWRkbGV3YXJlLlxuICAgICAgICAgICAgICAvLyByZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS92aXRlanMvdml0ZS9ibG9iL2Q0ZjEzYmQ4MTQ2ODk2MWM4YzkyNjQzOGU4MTVhYjZiMWM4MjczNWUvcGFja2FnZXMvdml0ZS9zcmMvbm9kZS9zZXJ2ZXIvbWlkZGxld2FyZXMvc3RhdGljLnRzI0wxNjNcbiAgICAgICAgICAgICAgcmVxLnVybCA9IGAvQGZzLyR7ZW5jb2RlVVJJKGFzc2V0U291cmNlUGF0aCl9YDtcbiAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVzb3VyY2UgZmlsZXMgYXJlIGhhbmRsZWQgZGlyZWN0bHkuXG4gICAgICAgICAgICAvLyBHbG9iYWwgc3R5bGVzaGVldHMgKENTUyBmaWxlcykgYXJlIGN1cnJlbnRseSBjb25zaWRlcmVkIHJlc291cmNlcyB0byB3b3JrYXJvdW5kXG4gICAgICAgICAgICAvLyBkZXYgc2VydmVyIHNvdXJjZW1hcCBpc3N1ZXMgd2l0aCBzdHlsZXNoZWV0cy5cbiAgICAgICAgICAgIGlmIChleHRlbnNpb24gIT09ICcuanMnICYmIGV4dGVuc2lvbiAhPT0gJy5odG1sJykge1xuICAgICAgICAgICAgICBjb25zdCBvdXRwdXRGaWxlID0gb3V0cHV0RmlsZXMuZ2V0KHBhdGhuYW1lKTtcbiAgICAgICAgICAgICAgaWYgKG91dHB1dEZpbGU/LnNlcnZhYmxlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWltZVR5cGUgPSBsb29rdXBNaW1lVHlwZShleHRlbnNpb24pO1xuICAgICAgICAgICAgICAgIGlmIChtaW1lVHlwZSkge1xuICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgbWltZVR5cGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDYWNoZS1Db250cm9sJywgJ25vLWNhY2hlJyk7XG4gICAgICAgICAgICAgICAgaWYgKHNlcnZlck9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoc2VydmVyT3B0aW9ucy5oZWFkZXJzKS5mb3JFYWNoKChbbmFtZSwgdmFsdWVdKSA9PlxuICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKG5hbWUsIHZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlcy5lbmQob3V0cHV0RmlsZS5jb250ZW50cyk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gUmV0dXJuaW5nIGEgZnVuY3Rpb24sIGluc3RhbGxzIG1pZGRsZXdhcmUgYWZ0ZXIgdGhlIG1haW4gdHJhbnNmb3JtIG1pZGRsZXdhcmUgYnV0XG4gICAgICAgICAgLy8gYmVmb3JlIHRoZSBidWlsdC1pbiBIVE1MIG1pZGRsZXdhcmVcbiAgICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgICAgZnVuY3Rpb24gYW5ndWxhclNTUk1pZGRsZXdhcmUoXG4gICAgICAgICAgICAgIHJlcTogQ29ubmVjdC5JbmNvbWluZ01lc3NhZ2UsXG4gICAgICAgICAgICAgIHJlczogU2VydmVyUmVzcG9uc2UsXG4gICAgICAgICAgICAgIG5leHQ6IENvbm5lY3QuTmV4dEZ1bmN0aW9uLFxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHVybCA9IHJlcS5vcmlnaW5hbFVybDtcbiAgICAgICAgICAgICAgaWYgKCF1cmwgfHwgdXJsLmVuZHNXaXRoKCcuaHRtbCcpKSB7XG4gICAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgcmF3SHRtbCA9IG91dHB1dEZpbGVzLmdldCgnL2luZGV4LnNlcnZlci5odG1sJyk/LmNvbnRlbnRzO1xuICAgICAgICAgICAgICBpZiAoIXJhd0h0bWwpIHtcbiAgICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB0cmFuc2Zvcm1JbmRleEh0bWxBbmRBZGRIZWFkZXJzKHVybCwgcmF3SHRtbCwgcmVzLCBuZXh0LCBhc3luYyAoaHRtbCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgY29udGVudCB9ID0gYXdhaXQgcmVuZGVyUGFnZSh7XG4gICAgICAgICAgICAgICAgICBkb2N1bWVudDogaHRtbCxcbiAgICAgICAgICAgICAgICAgIHJvdXRlOiBwYXRobmFtZVdpdGhvdXRTZXJ2ZVBhdGgodXJsLCBzZXJ2ZXJPcHRpb25zKSxcbiAgICAgICAgICAgICAgICAgIHNlcnZlckNvbnRleHQ6ICdzc3InLFxuICAgICAgICAgICAgICAgICAgbG9hZEJ1bmRsZTogKHBhdGg6IHN0cmluZykgPT5cbiAgICAgICAgICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgICAgICAgICAgICAgc2VydmVyLnNzckxvYWRNb2R1bGUocGF0aC5zbGljZSgxKSkgYXMgYW55LFxuICAgICAgICAgICAgICAgICAgLy8gRmlsZXMgaGVyZSBhcmUgb25seSBuZWVkZWQgZm9yIGNyaXRpY2FsIENTUyBpbmxpbmluZy5cbiAgICAgICAgICAgICAgICAgIG91dHB1dEZpbGVzOiB7fSxcbiAgICAgICAgICAgICAgICAgIC8vIFRPRE86IGFkZCBzdXBwb3J0IGZvciBjcml0aWNhbCBjc3MgaW5saW5pbmcuXG4gICAgICAgICAgICAgICAgICBpbmxpbmVDcml0aWNhbENzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gY29udGVudDtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzc3IpIHtcbiAgICAgICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShhbmd1bGFyU1NSTWlkZGxld2FyZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoZnVuY3Rpb24gYW5ndWxhckluZGV4TWlkZGxld2FyZShyZXEsIHJlcywgbmV4dCkge1xuICAgICAgICAgICAgICBpZiAoIXJlcS51cmwpIHtcbiAgICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBQYXJzZSB0aGUgaW5jb21pbmcgcmVxdWVzdC5cbiAgICAgICAgICAgICAgLy8gVGhlIGJhc2Ugb2YgdGhlIFVSTCBpcyB1bnVzZWQgYnV0IHJlcXVpcmVkIHRvIHBhcnNlIHRoZSBVUkwuXG4gICAgICAgICAgICAgIGNvbnN0IHBhdGhuYW1lID0gcGF0aG5hbWVXaXRob3V0U2VydmVQYXRoKHJlcS51cmwsIHNlcnZlck9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgIGlmIChwYXRobmFtZSA9PT0gJy8nIHx8IHBhdGhuYW1lID09PSBgL2luZGV4Lmh0bWxgKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3SHRtbCA9IG91dHB1dEZpbGVzLmdldCgnL2luZGV4Lmh0bWwnKT8uY29udGVudHM7XG4gICAgICAgICAgICAgICAgaWYgKHJhd0h0bWwpIHtcbiAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybUluZGV4SHRtbEFuZEFkZEhlYWRlcnMocmVxLnVybCwgcmF3SHRtbCwgcmVzLCBuZXh0KTtcblxuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICBmdW5jdGlvbiB0cmFuc2Zvcm1JbmRleEh0bWxBbmRBZGRIZWFkZXJzKFxuICAgICAgICAgICAgdXJsOiBzdHJpbmcsXG4gICAgICAgICAgICByYXdIdG1sOiBVaW50OEFycmF5LFxuICAgICAgICAgICAgcmVzOiBTZXJ2ZXJSZXNwb25zZTxpbXBvcnQoJ2h0dHAnKS5JbmNvbWluZ01lc3NhZ2U+LFxuICAgICAgICAgICAgbmV4dDogQ29ubmVjdC5OZXh0RnVuY3Rpb24sXG4gICAgICAgICAgICBhZGRpdGlvbmFsVHJhbnNmb3JtZXI/OiAoaHRtbDogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4sXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBzZXJ2ZXJcbiAgICAgICAgICAgICAgLnRyYW5zZm9ybUluZGV4SHRtbCh1cmwsIEJ1ZmZlci5mcm9tKHJhd0h0bWwpLnRvU3RyaW5nKCd1dGYtOCcpKVxuICAgICAgICAgICAgICAudGhlbihhc3luYyAocHJvY2Vzc2VkSHRtbCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChhZGRpdGlvbmFsVHJhbnNmb3JtZXIpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBhZGRpdGlvbmFsVHJhbnNmb3JtZXIocHJvY2Vzc2VkSHRtbCk7XG4gICAgICAgICAgICAgICAgICBpZiAoIWNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgcHJvY2Vzc2VkSHRtbCA9IGNvbnRlbnQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ3RleHQvaHRtbCcpO1xuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NhY2hlLUNvbnRyb2wnLCAnbm8tY2FjaGUnKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VydmVyT3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyhzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpLmZvckVhY2goKFtuYW1lLCB2YWx1ZV0pID0+XG4gICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIobmFtZSwgdmFsdWUpLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzLmVuZChwcm9jZXNzZWRIdG1sKTtcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcikgPT4gbmV4dChlcnJvcikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgXSxcbiAgICBvcHRpbWl6ZURlcHM6IHtcbiAgICAgIC8vIE9ubHkgZW5hYmxlIHdpdGggY2FjaGluZyBzaW5jZSBpdCBjYXVzZXMgcHJlYnVuZGxlIGRlcGVuZGVuY2llcyB0byBiZSBjYWNoZWRcbiAgICAgIGRpc2FibGVkOiAhc2VydmVyT3B0aW9ucy5jYWNoZU9wdGlvbnMuZW5hYmxlZCxcbiAgICAgIC8vIEV4Y2x1ZGUgYW55IHByb3ZpZGVkIGRlcGVuZGVuY2llcyAoY3VycmVudGx5IGJ1aWxkIGRlZmluZWQgZXh0ZXJuYWxzKVxuICAgICAgZXhjbHVkZTogcHJlYnVuZGxlRXhjbHVkZSxcbiAgICAgIC8vIFNraXAgYXV0b21hdGljIGZpbGUtYmFzZWQgZW50cnkgcG9pbnQgZGlzY292ZXJ5XG4gICAgICBlbnRyaWVzOiBbXSxcbiAgICAgIC8vIEFkZCBhbiBlc2J1aWxkIHBsdWdpbiB0byBydW4gdGhlIEFuZ3VsYXIgbGlua2VyIG9uIGRlcGVuZGVuY2llc1xuICAgICAgZXNidWlsZE9wdGlvbnM6IHtcbiAgICAgICAgLy8gU2V0IGVzYnVpbGQgc3VwcG9ydGVkIHRhcmdldHMuXG4gICAgICAgIHRhcmdldCxcbiAgICAgICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgICAgICBwbHVnaW5zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2FuZ3VsYXItdml0ZS1vcHRpbWl6ZS1kZXBzJyxcbiAgICAgICAgICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICAgICAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLltjbV0/anMkLyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICBjb250ZW50czogYXdhaXQgcHJlYnVuZGxlVHJhbnNmb3JtZXIudHJhbnNmb3JtRmlsZShhcmdzLnBhdGgpLFxuICAgICAgICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9LFxuICB9O1xuXG4gIGlmIChzZXJ2ZXJPcHRpb25zLnNzbCkge1xuICAgIGlmIChzZXJ2ZXJPcHRpb25zLnNzbENlcnQgJiYgc2VydmVyT3B0aW9ucy5zc2xLZXkpIHtcbiAgICAgIC8vIHNlcnZlciBjb25maWd1cmF0aW9uIGlzIGRlZmluZWQgYWJvdmVcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gICAgICBjb25maWd1cmF0aW9uLnNlcnZlciEuaHR0cHMgPSB7XG4gICAgICAgIGNlcnQ6IGF3YWl0IHJlYWRGaWxlKHNlcnZlck9wdGlvbnMuc3NsQ2VydCksXG4gICAgICAgIGtleTogYXdhaXQgcmVhZEZpbGUoc2VydmVyT3B0aW9ucy5zc2xLZXkpLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgeyBkZWZhdWx0OiBiYXNpY1NzbFBsdWdpbiB9ID0gYXdhaXQgaW1wb3J0KCdAdml0ZWpzL3BsdWdpbi1iYXNpYy1zc2wnKTtcbiAgICAgIGNvbmZpZ3VyYXRpb24ucGx1Z2lucyA/Pz0gW107XG4gICAgICBjb25maWd1cmF0aW9uLnBsdWdpbnMucHVzaChiYXNpY1NzbFBsdWdpbigpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gY29uZmlndXJhdGlvbjtcbn1cblxuZnVuY3Rpb24gcGF0aG5hbWVXaXRob3V0U2VydmVQYXRoKHVybDogc3RyaW5nLCBzZXJ2ZXJPcHRpb25zOiBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyk6IHN0cmluZyB7XG4gIGNvbnN0IHBhcnNlZFVybCA9IG5ldyBVUkwodXJsLCAnaHR0cDovL2xvY2FsaG9zdCcpO1xuICBsZXQgcGF0aG5hbWUgPSBkZWNvZGVVUklDb21wb25lbnQocGFyc2VkVXJsLnBhdGhuYW1lKTtcbiAgaWYgKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoICYmIHBhdGhuYW1lLnN0YXJ0c1dpdGgoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgpKSB7XG4gICAgcGF0aG5hbWUgPSBwYXRobmFtZS5zbGljZShzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aC5sZW5ndGgpO1xuICAgIGlmIChwYXRobmFtZVswXSAhPT0gJy8nKSB7XG4gICAgICBwYXRobmFtZSA9ICcvJyArIHBhdGhuYW1lO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYXRobmFtZTtcbn1cbiJdfQ==