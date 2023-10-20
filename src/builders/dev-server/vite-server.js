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
const mrmime_1 = require("mrmime");
const node_assert_1 = __importDefault(require("node:assert"));
const node_crypto_1 = require("node:crypto");
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
function hashContent(contents) {
    // TODO: Consider xxhash
    return (0, node_crypto_1.createHash)('sha256').update(contents).digest();
}
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
        let fileHash;
        const existingRecord = generatedFiles.get(filePath);
        if (existingRecord && existingRecord.size === file.contents.byteLength) {
            // Only hash existing file when needed
            if (existingRecord.hash === undefined) {
                existingRecord.hash = hashContent(existingRecord.contents);
            }
            // Compare against latest result output
            fileHash = hashContent(file.contents);
            if (fileHash.equals(existingRecord.hash)) {
                // Same file
                existingRecord.updated = false;
                continue;
            }
        }
        generatedFiles.set(filePath, {
            contents: file.contents,
            size: file.contents.byteLength,
            hash: fileHash,
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
                                    loadBundle: (path) => server.ssrLoadModule(path.slice(1)),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3ZpdGUtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0gsbUNBQWtEO0FBQ2xELDhEQUFpQztBQUNqQyw2Q0FBcUQ7QUFDckQsK0NBQTRDO0FBRzVDLDBEQUF3QztBQUV4Qyx5RUFBMkY7QUFDM0YsdUZBQW1GO0FBQ25GLHFEQUFtRztBQUNuRyw0RUFBb0Y7QUFDcEYsMEVBQXFGO0FBQ3JGLHVFQUFzRTtBQUN0RSwrRUFBd0U7QUFDeEUsZ0RBQTBEO0FBQzFELHdEQUF5RDtBQUV6RCwyREFBNkQ7QUFZN0QsU0FBUyxXQUFXLENBQUMsUUFBb0I7SUFDdkMsd0JBQXdCO0lBQ3hCLE9BQU8sSUFBQSx3QkFBVSxFQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUN4RCxDQUFDO0FBRU0sS0FBSyxTQUFTLENBQUMsQ0FBQyxhQUFhLENBQ2xDLGFBQXlDLEVBQ3pDLFdBQW1CLEVBQ25CLE9BQXVCLEVBQ3ZCLE9BQWtCO0lBRWxCLHNEQUFzRDtJQUN0RCxNQUFNLGlCQUFpQixHQUFHLENBQUMsTUFBTSxPQUFPLENBQUMsZ0JBQWdCLENBQ3ZELGFBQWEsQ0FBQyxXQUFXLENBQzFCLENBQTRDLENBQUM7SUFFOUMsTUFBTSxjQUFjLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQ25EO1FBQ0UsR0FBRyxpQkFBaUI7UUFDcEIsS0FBSyxFQUFFLGFBQWEsQ0FBQyxLQUFLO1FBQzFCLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSTtRQUN4QixPQUFPLEVBQUUsYUFBYSxDQUFDLE9BQU87S0FDWSxFQUM1QyxXQUFXLENBQ1osQ0FBNEMsQ0FBQztJQUU5QyxJQUFJLGNBQWMsQ0FBQyxTQUFTLEVBQUU7UUFDNUIsaURBQWlEO1FBQ2pELHNIQUFzSDtRQUN0SCxjQUFjLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQztRQUMxQixjQUFjLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztLQUNsQztJQUVELG1FQUFtRTtJQUNuRSxjQUFjLENBQUMsZ0JBQWdCLEdBQUcsYUFBYSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUM7SUFFckUsSUFBSSxhQUFhLENBQUMsU0FBUyxLQUFLLFNBQVMsSUFBSSxjQUFjLENBQUMsUUFBUSxLQUFLLFNBQVMsRUFBRTtRQUNsRixhQUFhLENBQUMsU0FBUyxHQUFHLGNBQWMsQ0FBQyxRQUFRLENBQUM7S0FDbkQ7SUFFRCxrRkFBa0Y7SUFDbEYseUdBQXlHO0lBQ3pHLElBQ0UsY0FBYyxDQUFDLFFBQVEsS0FBSyxJQUFJO1FBQ2hDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEVBQzlFO1FBQ0EsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2pCLGdJQUFnSSxDQUNqSSxDQUFDO1FBQ0YsY0FBYyxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUM7S0FDakM7U0FBTSxJQUFJLGNBQWMsQ0FBQyxRQUFRLEVBQUU7UUFDbEMsd0lBQXdJO1FBQ3hJLGNBQWMsQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLENBQUM7S0FDM0M7SUFFRCx5RkFBeUY7SUFDekYsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLDhDQUFxQjtJQUNwRCxnRkFBZ0Y7SUFDaEYseUVBQXlFO0lBQ3pFLGdGQUFnRjtJQUNoRixFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxFQUM5QixDQUFDLENBQ0YsQ0FBQztJQUVGLG9DQUFvQztJQUNwQyxpREFBaUQ7SUFDakQsOERBQThEO0lBQzlELE1BQU0sYUFBYSxHQUFHLElBQUEsMkNBQWtCLEVBQUMsY0FBYyxDQUFDLEtBQVksQ0FBQyxDQUFDO0lBRXRFLGdEQUFnRDtJQUNoRCxNQUFNLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxHQUFHLHdEQUFhLE1BQU0sR0FBQyxDQUFDO0lBRTdELElBQUksTUFBaUMsQ0FBQztJQUN0QyxJQUFJLGdCQUF5QyxDQUFDO0lBQzlDLElBQUksUUFBUSxHQUFHLEtBQUssQ0FBQztJQUNyQixNQUFNLGNBQWMsR0FBRyxJQUFJLEdBQUcsRUFBNEIsQ0FBQztJQUMzRCxNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztJQUM3QyxNQUFNLEtBQUssR0FDVCxXQUFXLEtBQUssMkNBQTJDO1FBQ3pELENBQUMsQ0FBQyxzQ0FBd0I7UUFDMUIsQ0FBQyxDQUFDLHFDQUFtQixDQUFDO0lBRTFCLDZGQUE2RjtJQUM3RixJQUFJLEtBQUssRUFBRSxNQUFNLE1BQU0sSUFBSSxLQUFLO0lBQzlCLDhEQUE4RDtJQUM5RCxjQUFxQixFQUNyQixPQUFPLEVBQ1A7UUFDRSxLQUFLLEVBQUUsS0FBSztLQUNiLEVBQ0QsT0FBTyxDQUNSLEVBQUU7UUFDRCxJQUFBLHFCQUFNLEVBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSx1Q0FBdUMsQ0FBQyxDQUFDO1FBRXBFLG9DQUFvQztRQUNwQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtZQUNuQixrREFBa0Q7WUFDbEQsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sSUFBSSxNQUFNLEVBQUU7Z0JBQ25DLFFBQVEsR0FBRyxJQUFJLENBQUM7Z0JBQ2hCLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDO29CQUNiLElBQUksRUFBRSxPQUFPO29CQUNiLEdBQUcsRUFBRTt3QkFDSCxPQUFPLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJO3dCQUM5QixLQUFLLEVBQUUsRUFBRTt3QkFDVCxHQUFHLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRO3FCQUMvQjtpQkFDRixDQUFDLENBQUM7YUFDSjtZQUNELFNBQVM7U0FDVjthQUFNLElBQUksUUFBUSxJQUFJLE1BQU0sRUFBRTtZQUM3QixRQUFRLEdBQUcsS0FBSyxDQUFDO1lBQ2pCLGtEQUFrRDtZQUNsRCxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQztnQkFDYixNQUFNLEVBQUUsUUFBUTtnQkFDaEIsT0FBTyxFQUFFLEVBQUU7YUFDWixDQUFDLENBQUM7U0FDSjtRQUVELG1DQUFtQztRQUNuQyxrQkFBa0IsQ0FBQyxhQUFhLEVBQUUsYUFBYSxFQUFFLE1BQU0sQ0FBQyxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFFckYsVUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ25CLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRTtZQUNyQixLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUU7Z0JBQ3JDLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLGFBQWEsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ3RFO1NBQ0Y7UUFFRCxJQUFJLE1BQU0sRUFBRTtZQUNWLFlBQVksQ0FBQyxjQUFjLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDckU7YUFBTTtZQUNMLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDO1lBQzVDLElBQUksQ0FBQyxXQUFXLEVBQUU7Z0JBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0NBQWdDLENBQUMsQ0FBQzthQUNuRDtZQUVELE1BQU0sRUFBRSxJQUFJLEdBQUcsRUFBRSxFQUFFLEdBQUcsTUFBTSxPQUFPLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDcEUsTUFBTSxXQUFXLEdBQUcsbUJBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxJQUFjLENBQUMsQ0FBQztZQUNyRSxNQUFNLFFBQVEsR0FBRyxJQUFBLHlDQUFvQixFQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDbkUsTUFBTSxNQUFNLEdBQUcsSUFBQSwyQ0FBbUMsRUFBQyxRQUFRLENBQUMsQ0FBQztZQUU3RCxtQ0FBbUM7WUFDbkMsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLFdBQVcsQ0FDM0MsYUFBYSxFQUNiLGNBQWMsRUFDZCxVQUFVLEVBQ1YsY0FBYyxDQUFDLGdCQUFnQixFQUMvQixjQUFjLENBQUMsb0JBQW9CLEVBQ25DLENBQUMsQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUNwQixvQkFBb0IsRUFDcEIsTUFBTSxDQUNQLENBQUM7WUFFRixNQUFNLEdBQUcsTUFBTSxZQUFZLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUVqRCxNQUFNLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN0QixnQkFBZ0IsR0FBRyxNQUFNLENBQUMsVUFBVSxFQUFFLE9BQU8sRUFBaUIsQ0FBQztZQUUvRCw2QkFBNkI7WUFDN0IsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO1NBQ3BCO1FBRUQsa0VBQWtFO1FBQ2xFLE1BQU0sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQXVDLENBQUM7S0FDNUY7SUFFRCwyQ0FBMkM7SUFDM0MsSUFBSSxRQUFvQixDQUFDO0lBQ3pCLE9BQU8sQ0FBQyxXQUFXLENBQUMsS0FBSyxJQUFJLEVBQUU7UUFDN0IsTUFBTSxNQUFNLEVBQUUsS0FBSyxFQUFFLENBQUM7UUFDdEIsTUFBTSxvQkFBb0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNuQyxRQUFRLEVBQUUsRUFBRSxDQUFDO0lBQ2YsQ0FBQyxDQUFDLENBQUM7SUFDSCxNQUFNLElBQUksT0FBTyxDQUFPLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQzdELENBQUM7QUF6S0Qsc0NBeUtDO0FBRUQsU0FBUyxZQUFZLENBQ25CLGNBQTZDLEVBQzdDLE1BQXFCLEVBQ3JCLGFBQXlDLEVBQ3pDLE1BQXlCO0lBRXpCLE1BQU0sWUFBWSxHQUFhLEVBQUUsQ0FBQztJQUVsQywrQkFBK0I7SUFDL0IsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLGNBQWMsRUFBRTtRQUMzQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUU7WUFDbEIsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN4QixNQUFNLGNBQWMsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2pFLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUN6RTtLQUNGO0lBRUQsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUU7UUFDeEIsT0FBTztLQUNSO0lBRUQsSUFBSSxhQUFhLENBQUMsVUFBVSxJQUFJLGFBQWEsQ0FBQyxHQUFHLEVBQUU7UUFDakQsSUFBSSxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUU7WUFDakQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQzdCLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDO2dCQUNiLElBQUksRUFBRSxRQUFRO2dCQUNkLE9BQU8sRUFBRSxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7b0JBQzlCLE1BQU0sUUFBUSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyx3QkFBd0I7b0JBRXJELE9BQU87d0JBQ0wsSUFBSSxFQUFFLFlBQVk7d0JBQ2xCLFNBQVM7d0JBQ1QsSUFBSSxFQUFFLFFBQVE7d0JBQ2QsWUFBWSxFQUFFLFFBQVE7cUJBQ3ZCLENBQUM7Z0JBQ0osQ0FBQyxDQUFDO2FBQ0gsQ0FBQyxDQUFDO1lBRUgsTUFBTSxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1lBRS9DLE9BQU87U0FDUjtLQUNGO0lBRUQsaUNBQWlDO0lBQ2pDLElBQUksYUFBYSxDQUFDLFVBQVUsRUFBRTtRQUM1QixNQUFNLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFFdEMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUM7WUFDYixJQUFJLEVBQUUsYUFBYTtZQUNuQixJQUFJLEVBQUUsR0FBRztTQUNWLENBQUMsQ0FBQztLQUNKO0FBQ0gsQ0FBQztBQUVELFNBQVMsa0JBQWtCLENBQ3pCLGFBQXFDLEVBQ3JDLGFBQXFCLEVBQ3JCLFdBQThCLEVBQzlCLGNBQTZDO0lBRTdDLE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxDQUFTLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztJQUM5QyxLQUFLLE1BQU0sSUFBSSxJQUFJLFdBQVcsRUFBRTtRQUM5QixJQUFJLFFBQVEsQ0FBQztRQUNiLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxhQUFhLEVBQUU7WUFDL0IsZ0ZBQWdGO1lBQ2hGLCtDQUErQztZQUMvQyxRQUFRLEdBQUcsYUFBYSxDQUFDO1NBQzFCO2FBQU07WUFDTCxRQUFRLEdBQUcsR0FBRyxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDM0M7UUFDRCxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRW5CLDhCQUE4QjtRQUM5QixJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDN0IsY0FBYyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUU7Z0JBQzNCLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtnQkFDdkIsUUFBUSxFQUNOLElBQUksQ0FBQyxJQUFJLEtBQUsscUNBQW1CLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUsscUNBQW1CLENBQUMsS0FBSztnQkFDdEYsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVTtnQkFDOUIsT0FBTyxFQUFFLEtBQUs7YUFDZixDQUFDLENBQUM7WUFFSCxTQUFTO1NBQ1Y7UUFFRCxJQUFJLFFBQTRCLENBQUM7UUFDakMsTUFBTSxjQUFjLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNwRCxJQUFJLGNBQWMsSUFBSSxjQUFjLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFO1lBQ3RFLHNDQUFzQztZQUN0QyxJQUFJLGNBQWMsQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFO2dCQUNyQyxjQUFjLENBQUMsSUFBSSxHQUFHLFdBQVcsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDNUQ7WUFFRCx1Q0FBdUM7WUFDdkMsUUFBUSxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDdEMsSUFBSSxRQUFRLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDeEMsWUFBWTtnQkFDWixjQUFjLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQztnQkFDL0IsU0FBUzthQUNWO1NBQ0Y7UUFFRCxjQUFjLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRTtZQUMzQixRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVE7WUFDdkIsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVTtZQUM5QixJQUFJLEVBQUUsUUFBUTtZQUNkLE9BQU8sRUFBRSxJQUFJO1lBQ2IsUUFBUSxFQUNOLElBQUksQ0FBQyxJQUFJLEtBQUsscUNBQW1CLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUsscUNBQW1CLENBQUMsS0FBSztTQUN2RixDQUFDLENBQUM7S0FDSjtJQUVELDJCQUEyQjtJQUMzQixLQUFLLE1BQU0sSUFBSSxJQUFJLGNBQWMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtRQUN4QyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNuQixjQUFjLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzdCO0tBQ0Y7QUFDSCxDQUFDO0FBRUQsa0RBQWtEO0FBQzNDLEtBQUssVUFBVSxXQUFXLENBQy9CLGFBQXlDLEVBQ3pDLFdBQTBDLEVBQzFDLE1BQTJCLEVBQzNCLGdCQUFxQyxFQUNyQyxnQkFBc0MsRUFDdEMsR0FBWSxFQUNaLG9CQUEyQyxFQUMzQyxNQUFnQjtJQUVoQixNQUFNLEtBQUssR0FBRyxNQUFNLElBQUEsMENBQXNCLEVBQ3hDLGFBQWEsQ0FBQyxhQUFhLEVBQzNCLGFBQWEsQ0FBQyxXQUFXLEVBQ3pCLElBQUksQ0FDTCxDQUFDO0lBRUYsZ0RBQWdEO0lBQ2hELE1BQU0sRUFBRSxhQUFhLEVBQUUsR0FBRyx3REFBYSxNQUFNLEdBQUMsQ0FBQztJQUUvQyxNQUFNLGFBQWEsR0FBaUI7UUFDbEMsVUFBVSxFQUFFLEtBQUs7UUFDakIsT0FBTyxFQUFFLEtBQUs7UUFDZCxRQUFRLEVBQUUsbUJBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDO1FBQzVELElBQUksRUFBRSxhQUFhLENBQUMsYUFBYTtRQUNqQyxTQUFTLEVBQUUsS0FBSztRQUNoQixPQUFPLEVBQUUsS0FBSztRQUNkLElBQUksRUFBRSxhQUFhO1FBQ25CLE9BQU8sRUFBRSxLQUFLO1FBQ2QsR0FBRyxFQUFFO1lBQ0gsWUFBWSxFQUFFLElBQUk7U0FDbkI7UUFDRCxJQUFJLEVBQUUsYUFBYSxDQUFDLFNBQVM7UUFDN0IsT0FBTyxFQUFFO1lBQ1AsVUFBVSxFQUFFLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDO1lBQ25ELGdCQUFnQjtTQUNqQjtRQUNELE1BQU0sRUFBRTtZQUNOLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSTtZQUN4QixVQUFVLEVBQUUsSUFBSTtZQUNoQixJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUk7WUFDeEIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJO1lBQ3hCLE9BQU8sRUFBRSxhQUFhLENBQUMsT0FBTztZQUM5QixLQUFLO1lBQ0wsOEZBQThGO1lBQzlGLEtBQUssRUFBRTtnQkFDTCxPQUFPLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDbEI7U0FDRjtRQUNELEdBQUcsRUFBRTtZQUNILHdFQUF3RTtZQUN4RSxRQUFRLEVBQUUsZ0JBQWdCO1NBQzNCO1FBQ0QsT0FBTyxFQUFFO1lBQ1AsSUFBQSxrREFBNkIsR0FBRTtZQUMvQjtnQkFDRSxJQUFJLEVBQUUscUJBQXFCO2dCQUMzQixzREFBc0Q7Z0JBQ3RELE9BQU8sRUFBRSxLQUFLO2dCQUNkLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLFFBQVE7b0JBQzlCLElBQUksUUFBUSxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUU7d0JBQ3RDLDBCQUEwQjt3QkFDMUIsTUFBTSxDQUFDLFlBQVksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUU5QyxNQUFNLEdBQUcsYUFBYSxDQUFDLG1CQUFJLENBQUMsSUFBSSxDQUFDLG1CQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7cUJBQ3ZFO29CQUVELE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDcEMsSUFBSSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO3dCQUN6QixPQUFPLE1BQU0sQ0FBQztxQkFDZjtnQkFDSCxDQUFDO2dCQUNELElBQUksQ0FBQyxFQUFFO29CQUNMLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDaEMsTUFBTSxZQUFZLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxRQUFRLENBQUM7b0JBQ3JELElBQUksWUFBWSxLQUFLLFNBQVMsRUFBRTt3QkFDOUIsT0FBTztxQkFDUjtvQkFFRCxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztvQkFDekQsTUFBTSxXQUFXLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLEVBQUUsUUFBUSxDQUFDO29CQUU3RCxPQUFPO3dCQUNMLDBFQUEwRTt3QkFDMUUsMEVBQTBFO3dCQUMxRSxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLG9DQUFvQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJO3dCQUNqRixHQUFHLEVBQUUsV0FBVyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQztxQkFDL0QsQ0FBQztnQkFDSixDQUFDO2dCQUNELGVBQWUsQ0FBQyxNQUFNO29CQUNwQix5Q0FBeUM7b0JBQ3pDLE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLFNBQVMsdUJBQXVCLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxJQUFJO3dCQUNwRSxJQUFJLEdBQUcsQ0FBQyxHQUFHLEtBQUssU0FBUyxJQUFJLEdBQUcsQ0FBQyxhQUFhLEVBQUU7NEJBQzlDLE9BQU87eUJBQ1I7d0JBRUQsOEJBQThCO3dCQUM5QiwrREFBK0Q7d0JBQy9ELE1BQU0sUUFBUSxHQUFHLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsYUFBYSxDQUFDLENBQUM7d0JBQ2xFLE1BQU0sU0FBUyxHQUFHLG1CQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO3dCQUV6QyxnREFBZ0Q7d0JBQ2hELE1BQU0sZUFBZSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7d0JBQzdDLElBQUksZUFBZSxLQUFLLFNBQVMsRUFBRTs0QkFDakMsMEVBQTBFOzRCQUMxRSw2SUFBNkk7NEJBQzdJLEdBQUcsQ0FBQyxHQUFHLEdBQUcsUUFBUSxTQUFTLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQzs0QkFDL0MsSUFBSSxFQUFFLENBQUM7NEJBRVAsT0FBTzt5QkFDUjt3QkFFRCx1Q0FBdUM7d0JBQ3ZDLGtGQUFrRjt3QkFDbEYsZ0RBQWdEO3dCQUNoRCxJQUFJLFNBQVMsS0FBSyxLQUFLLElBQUksU0FBUyxLQUFLLE9BQU8sRUFBRTs0QkFDaEQsTUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQzs0QkFDN0MsSUFBSSxVQUFVLEVBQUUsUUFBUSxFQUFFO2dDQUN4QixNQUFNLFFBQVEsR0FBRyxJQUFBLGVBQWMsRUFBQyxTQUFTLENBQUMsQ0FBQztnQ0FDM0MsSUFBSSxRQUFRLEVBQUU7b0NBQ1osR0FBRyxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsUUFBUSxDQUFDLENBQUM7aUNBQ3pDO2dDQUNELEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxFQUFFLFVBQVUsQ0FBQyxDQUFDO2dDQUMzQyxJQUFJLGFBQWEsQ0FBQyxPQUFPLEVBQUU7b0NBQ3pCLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FDOUQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQzNCLENBQUM7aUNBQ0g7Z0NBQ0QsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7Z0NBRTdCLE9BQU87NkJBQ1I7eUJBQ0Y7d0JBRUQsSUFBSSxFQUFFLENBQUM7b0JBQ1QsQ0FBQyxDQUFDLENBQUM7b0JBRUgsb0ZBQW9GO29CQUNwRixzQ0FBc0M7b0JBQ3RDLE9BQU8sR0FBRyxFQUFFO3dCQUNWLFNBQVMsb0JBQW9CLENBQzNCLEdBQTRCLEVBQzVCLEdBQW1CLEVBQ25CLElBQTBCOzRCQUUxQixNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsV0FBVyxDQUFDOzRCQUM1QixJQUFJLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUU7Z0NBQ2pDLElBQUksRUFBRSxDQUFDO2dDQUVQLE9BQU87NkJBQ1I7NEJBRUQsTUFBTSxPQUFPLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLFFBQVEsQ0FBQzs0QkFDaEUsSUFBSSxDQUFDLE9BQU8sRUFBRTtnQ0FDWixJQUFJLEVBQUUsQ0FBQztnQ0FFUCxPQUFPOzZCQUNSOzRCQUVELCtCQUErQixDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7Z0NBQ3RFLE1BQU0sRUFBRSxPQUFPLEVBQUUsR0FBRyxNQUFNLElBQUEsd0JBQVUsRUFBQztvQ0FDbkMsUUFBUSxFQUFFLElBQUk7b0NBQ2QsS0FBSyxFQUFFLHdCQUF3QixDQUFDLEdBQUcsRUFBRSxhQUFhLENBQUM7b0NBQ25ELGFBQWEsRUFBRSxLQUFLO29DQUNwQixVQUFVLEVBQUUsQ0FBQyxJQUFZLEVBQUUsRUFBRSxDQUMzQixNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBRWpDO29DQUNILHdEQUF3RDtvQ0FDeEQsV0FBVyxFQUFFLEVBQUU7b0NBQ2YsK0NBQStDO29DQUMvQyxpQkFBaUIsRUFBRSxLQUFLO2lDQUN6QixDQUFDLENBQUM7Z0NBRUgsT0FBTyxPQUFPLENBQUM7NEJBQ2pCLENBQUMsQ0FBQyxDQUFDO3dCQUNMLENBQUM7d0JBRUQsSUFBSSxHQUFHLEVBQUU7NEJBQ1AsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQzt5QkFDOUM7d0JBRUQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsU0FBUyxzQkFBc0IsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUk7NEJBQ25FLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFO2dDQUNaLElBQUksRUFBRSxDQUFDO2dDQUVQLE9BQU87NkJBQ1I7NEJBRUQsOEJBQThCOzRCQUM5QiwrREFBK0Q7NEJBQy9ELE1BQU0sUUFBUSxHQUFHLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsYUFBYSxDQUFDLENBQUM7NEJBRWxFLElBQUksUUFBUSxLQUFLLEdBQUcsSUFBSSxRQUFRLEtBQUssYUFBYSxFQUFFO2dDQUNsRCxNQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLFFBQVEsQ0FBQztnQ0FDekQsSUFBSSxPQUFPLEVBQUU7b0NBQ1gsK0JBQStCLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO29DQUU3RCxPQUFPO2lDQUNSOzZCQUNGOzRCQUVELElBQUksRUFBRSxDQUFDO3dCQUNULENBQUMsQ0FBQyxDQUFDO29CQUNMLENBQUMsQ0FBQztvQkFFRixTQUFTLCtCQUErQixDQUN0QyxHQUFXLEVBQ1gsT0FBbUIsRUFDbkIsR0FBbUQsRUFDbkQsSUFBMEIsRUFDMUIscUJBQXFFO3dCQUVyRSxNQUFNOzZCQUNILGtCQUFrQixDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQzs2QkFDL0QsSUFBSSxDQUFDLEtBQUssRUFBRSxhQUFhLEVBQUUsRUFBRTs0QkFDNUIsSUFBSSxxQkFBcUIsRUFBRTtnQ0FDekIsTUFBTSxPQUFPLEdBQUcsTUFBTSxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsQ0FBQztnQ0FDM0QsSUFBSSxDQUFDLE9BQU8sRUFBRTtvQ0FDWixJQUFJLEVBQUUsQ0FBQztvQ0FFUCxPQUFPO2lDQUNSO2dDQUVELGFBQWEsR0FBRyxPQUFPLENBQUM7NkJBQ3pCOzRCQUVELEdBQUcsQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLFdBQVcsQ0FBQyxDQUFDOzRCQUMzQyxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsRUFBRSxVQUFVLENBQUMsQ0FBQzs0QkFDM0MsSUFBSSxhQUFhLENBQUMsT0FBTyxFQUFFO2dDQUN6QixNQUFNLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLENBQzlELEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUMzQixDQUFDOzZCQUNIOzRCQUNELEdBQUcsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7d0JBQ3pCLENBQUMsQ0FBQzs2QkFDRCxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO29CQUNuQyxDQUFDO2dCQUNILENBQUM7YUFDRjtTQUNGO1FBQ0QsWUFBWSxFQUFFO1lBQ1osK0VBQStFO1lBQy9FLFFBQVEsRUFBRSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsT0FBTztZQUM3Qyx3RUFBd0U7WUFDeEUsT0FBTyxFQUFFLGdCQUFnQjtZQUN6QixrREFBa0Q7WUFDbEQsT0FBTyxFQUFFLEVBQUU7WUFDWCxrRUFBa0U7WUFDbEUsY0FBYyxFQUFFO2dCQUNkLGlDQUFpQztnQkFDakMsTUFBTTtnQkFDTixTQUFTLEVBQUUsSUFBQSx5QkFBaUIsRUFBQyxNQUFNLENBQUM7Z0JBQ3BDLE9BQU8sRUFBRTtvQkFDUDt3QkFDRSxJQUFJLEVBQUUsNEJBQTRCO3dCQUNsQyxLQUFLLENBQUMsS0FBSzs0QkFDVCxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtnQ0FDcEQsT0FBTztvQ0FDTCxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztvQ0FDN0QsTUFBTSxFQUFFLElBQUk7aUNBQ2IsQ0FBQzs0QkFDSixDQUFDLENBQUMsQ0FBQzt3QkFDTCxDQUFDO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRjtLQUNGLENBQUM7SUFFRixJQUFJLGFBQWEsQ0FBQyxHQUFHLEVBQUU7UUFDckIsSUFBSSxhQUFhLENBQUMsT0FBTyxJQUFJLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDakQsd0NBQXdDO1lBQ3hDLG9FQUFvRTtZQUNwRSxhQUFhLENBQUMsTUFBTyxDQUFDLEtBQUssR0FBRztnQkFDNUIsSUFBSSxFQUFFLE1BQU0sSUFBQSxtQkFBUSxFQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUM7Z0JBQzNDLEdBQUcsRUFBRSxNQUFNLElBQUEsbUJBQVEsRUFBQyxhQUFhLENBQUMsTUFBTSxDQUFDO2FBQzFDLENBQUM7U0FDSDthQUFNO1lBQ0wsTUFBTSxFQUFFLE9BQU8sRUFBRSxjQUFjLEVBQUUsR0FBRyx3REFBYSwwQkFBMEIsR0FBQyxDQUFDO1lBQzdFLGFBQWEsQ0FBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQzdCLGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUM7U0FDOUM7S0FDRjtJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUM7QUE3UkQsa0NBNlJDO0FBRUQsU0FBUyx3QkFBd0IsQ0FBQyxHQUFXLEVBQUUsYUFBeUM7SUFDdEYsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLGtCQUFrQixDQUFDLENBQUM7SUFDbkQsSUFBSSxRQUFRLEdBQUcsa0JBQWtCLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3RELElBQUksYUFBYSxDQUFDLFNBQVMsSUFBSSxRQUFRLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsRUFBRTtRQUMzRSxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzFELElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtZQUN2QixRQUFRLEdBQUcsR0FBRyxHQUFHLFFBQVEsQ0FBQztTQUMzQjtLQUNGO0lBRUQsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgdHlwZSB7IGpzb24sIGxvZ2dpbmcgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgdHlwZSB7IFBsdWdpbiB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgbG9va3VwIGFzIGxvb2t1cE1pbWVUeXBlIH0gZnJvbSAnbXJtaW1lJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgQmluYXJ5TGlrZSwgY3JlYXRlSGFzaCB9IGZyb20gJ25vZGU6Y3J5cHRvJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBTZXJ2ZXJSZXNwb25zZSB9IGZyb20gJ25vZGU6aHR0cCc7XG5pbXBvcnQgdHlwZSB7IEFkZHJlc3NJbmZvIH0gZnJvbSAnbm9kZTpuZXQnO1xuaW1wb3J0IHBhdGgsIHsgcG9zaXggfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHR5cGUgeyBDb25uZWN0LCBJbmxpbmVDb25maWcsIFZpdGVEZXZTZXJ2ZXIgfSBmcm9tICd2aXRlJztcbmltcG9ydCB7IEJ1aWxkT3V0cHV0RmlsZSwgQnVpbGRPdXRwdXRGaWxlVHlwZSB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvYnVuZGxlci1jb250ZXh0JztcbmltcG9ydCB7IEphdmFTY3JpcHRUcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvamF2YXNjcmlwdC10cmFuc2Zvcm1lcic7XG5pbXBvcnQgeyBnZXRGZWF0dXJlU3VwcG9ydCwgdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL3V0aWxzJztcbmltcG9ydCB7IGNyZWF0ZUFuZ3VsYXJMb2NhbGVEYXRhUGx1Z2luIH0gZnJvbSAnLi4vLi4vdG9vbHMvdml0ZS9pMThuLWxvY2FsZS1wbHVnaW4nO1xuaW1wb3J0IHsgUmVuZGVyT3B0aW9ucywgcmVuZGVyUGFnZSB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZlci1yZW5kZXJpbmcvcmVuZGVyLXBhZ2UnO1xuaW1wb3J0IHsgZ2V0U3VwcG9ydGVkQnJvd3NlcnMgfSBmcm9tICcuLi8uLi91dGlscy9zdXBwb3J0ZWQtYnJvd3NlcnMnO1xuaW1wb3J0IHsgZ2V0SW5kZXhPdXRwdXRGaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBidWlsZEFwcGxpY2F0aW9uSW50ZXJuYWwgfSBmcm9tICcuLi9hcHBsaWNhdGlvbic7XG5pbXBvcnQgeyBidWlsZEVzYnVpbGRCcm93c2VyIH0gZnJvbSAnLi4vYnJvd3Nlci1lc2J1aWxkJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuLi9icm93c2VyLWVzYnVpbGQvc2NoZW1hJztcbmltcG9ydCB7IGxvYWRQcm94eUNvbmZpZ3VyYXRpb24gfSBmcm9tICcuL2xvYWQtcHJveHktY29uZmlnJztcbmltcG9ydCB0eXBlIHsgTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnO1xuaW1wb3J0IHR5cGUgeyBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0IH0gZnJvbSAnLi93ZWJwYWNrLXNlcnZlcic7XG5cbmludGVyZmFjZSBPdXRwdXRGaWxlUmVjb3JkIHtcbiAgY29udGVudHM6IFVpbnQ4QXJyYXk7XG4gIHNpemU6IG51bWJlcjtcbiAgaGFzaD86IEJ1ZmZlcjtcbiAgdXBkYXRlZDogYm9vbGVhbjtcbiAgc2VydmFibGU6IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIGhhc2hDb250ZW50KGNvbnRlbnRzOiBCaW5hcnlMaWtlKTogQnVmZmVyIHtcbiAgLy8gVE9ETzogQ29uc2lkZXIgeHhoYXNoXG4gIHJldHVybiBjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoY29udGVudHMpLmRpZ2VzdCgpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24qIHNlcnZlV2l0aFZpdGUoXG4gIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zLFxuICBidWlsZGVyTmFtZTogc3RyaW5nLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgcGx1Z2lucz86IFBsdWdpbltdLFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPERldlNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gR2V0IHRoZSBicm93c2VyIGNvbmZpZ3VyYXRpb24gZnJvbSB0aGUgdGFyZ2V0IG5hbWUuXG4gIGNvbnN0IHJhd0Jyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhcbiAgICBzZXJ2ZXJPcHRpb25zLmJ1aWxkVGFyZ2V0LFxuICApKSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG5cbiAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC52YWxpZGF0ZU9wdGlvbnMoXG4gICAge1xuICAgICAgLi4ucmF3QnJvd3Nlck9wdGlvbnMsXG4gICAgICB3YXRjaDogc2VydmVyT3B0aW9ucy53YXRjaCxcbiAgICAgIHBvbGw6IHNlcnZlck9wdGlvbnMucG9sbCxcbiAgICAgIHZlcmJvc2U6IHNlcnZlck9wdGlvbnMudmVyYm9zZSxcbiAgICB9IGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgICBidWlsZGVyTmFtZSxcbiAgKSkgYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zO1xuXG4gIGlmIChicm93c2VyT3B0aW9ucy5wcmVyZW5kZXIpIHtcbiAgICAvLyBEaXNhYmxlIHByZXJlbmRlcmluZyBpZiBlbmFibGVkIGFuZCBmb3JjZSBTU1IuXG4gICAgLy8gVGhpcyBpcyBzbyBpbnN0ZWFkIG9mIHByZXJlbmRlcmluZyBhbGwgdGhlIHJvdXRlcyBmb3IgZXZlcnkgY2hhbmdlLCB0aGUgcGFnZSBpcyBcInByZXJlbmRlcmVkXCIgd2hlbiBpdCBpcyByZXF1ZXN0ZWQuXG4gICAgYnJvd3Nlck9wdGlvbnMuc3NyID0gdHJ1ZTtcbiAgICBicm93c2VyT3B0aW9ucy5wcmVyZW5kZXIgPSBmYWxzZTtcbiAgfVxuXG4gIC8vIFNldCBhbGwgcGFja2FnZXMgYXMgZXh0ZXJuYWwgdG8gc3VwcG9ydCBWaXRlJ3MgcHJlYnVuZGxlIGNhY2hpbmdcbiAgYnJvd3Nlck9wdGlvbnMuZXh0ZXJuYWxQYWNrYWdlcyA9IHNlcnZlck9wdGlvbnMuY2FjaGVPcHRpb25zLmVuYWJsZWQ7XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoID09PSB1bmRlZmluZWQgJiYgYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYgIT09IHVuZGVmaW5lZCkge1xuICAgIHNlcnZlck9wdGlvbnMuc2VydmVQYXRoID0gYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWY7XG4gIH1cblxuICAvLyBUaGUgZGV2ZWxvcG1lbnQgc2VydmVyIGN1cnJlbnRseSBvbmx5IHN1cHBvcnRzIGEgc2luZ2xlIGxvY2FsZSB3aGVuIGxvY2FsaXppbmcuXG4gIC8vIFRoaXMgbWF0Y2hlcyB0aGUgYmVoYXZpb3Igb2YgdGhlIFdlYnBhY2stYmFzZWQgZGV2ZWxvcG1lbnQgc2VydmVyIGJ1dCBjb3VsZCBiZSBleHBhbmRlZCBpbiB0aGUgZnV0dXJlLlxuICBpZiAoXG4gICAgYnJvd3Nlck9wdGlvbnMubG9jYWxpemUgPT09IHRydWUgfHxcbiAgICAoQXJyYXkuaXNBcnJheShicm93c2VyT3B0aW9ucy5sb2NhbGl6ZSkgJiYgYnJvd3Nlck9wdGlvbnMubG9jYWxpemUubGVuZ3RoID4gMSlcbiAgKSB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICdMb2NhbGl6YXRpb24gKGBsb2NhbGl6ZWAgb3B0aW9uKSBoYXMgYmVlbiBkaXNhYmxlZC4gVGhlIGRldmVsb3BtZW50IHNlcnZlciBvbmx5IHN1cHBvcnRzIGxvY2FsaXppbmcgYSBzaW5nbGUgbG9jYWxlIHBlciBidWlsZC4nLFxuICAgICk7XG4gICAgYnJvd3Nlck9wdGlvbnMubG9jYWxpemUgPSBmYWxzZTtcbiAgfSBlbHNlIGlmIChicm93c2VyT3B0aW9ucy5sb2NhbGl6ZSkge1xuICAgIC8vIFdoZW4gbG9jYWxpemF0aW9uIGlzIGVuYWJsZWQgd2l0aCBhIHNpbmdsZSBsb2NhbGUsIGZvcmNlIGEgZmxhdCBwYXRoIHRvIG1haW50YWluIGJlaGF2aW9yIHdpdGggdGhlIGV4aXN0aW5nIFdlYnBhY2stYmFzZWQgZGV2IHNlcnZlci5cbiAgICBicm93c2VyT3B0aW9ucy5mb3JjZUkxOG5GbGF0T3V0cHV0ID0gdHJ1ZTtcbiAgfVxuXG4gIC8vIFNldHVwIHRoZSBwcmVidW5kbGluZyB0cmFuc2Zvcm1lciB0aGF0IHdpbGwgYmUgc2hhcmVkIGFjcm9zcyBWaXRlIHByZWJ1bmRsaW5nIHJlcXVlc3RzXG4gIGNvbnN0IHByZWJ1bmRsZVRyYW5zZm9ybWVyID0gbmV3IEphdmFTY3JpcHRUcmFuc2Zvcm1lcihcbiAgICAvLyBBbHdheXMgZW5hYmxlIEpJVCBsaW5raW5nIHRvIHN1cHBvcnQgYXBwbGljYXRpb25zIGJ1aWx0IHdpdGggYW5kIHdpdGhvdXQgQU9ULlxuICAgIC8vIEluIGEgZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnQgdGhlIGFkZGl0aW9uYWwgc2NvcGUgaW5mb3JtYXRpb24gZG9lcyBub3RcbiAgICAvLyBoYXZlIGEgbmVnYXRpdmUgZWZmZWN0IHVubGlrZSBwcm9kdWN0aW9uIHdoZXJlIGZpbmFsIG91dHB1dCBzaXplIGlzIHJlbGV2YW50LlxuICAgIHsgc291cmNlbWFwOiB0cnVlLCBqaXQ6IHRydWUgfSxcbiAgICAxLFxuICApO1xuXG4gIC8vIEV4dHJhY3Qgb3V0cHV0IGluZGV4IGZyb20gb3B0aW9uc1xuICAvLyBUT0RPOiBQcm92aWRlIHRoaXMgaW5mbyBmcm9tIHRoZSBidWlsZCByZXN1bHRzXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IGh0bWxJbmRleFBhdGggPSBnZXRJbmRleE91dHB1dEZpbGUoYnJvd3Nlck9wdGlvbnMuaW5kZXggYXMgYW55KTtcblxuICAvLyBkeW5hbWljYWxseSBpbXBvcnQgVml0ZSBmb3IgRVNNIGNvbXBhdGliaWxpdHlcbiAgY29uc3QgeyBjcmVhdGVTZXJ2ZXIsIG5vcm1hbGl6ZVBhdGggfSA9IGF3YWl0IGltcG9ydCgndml0ZScpO1xuXG4gIGxldCBzZXJ2ZXI6IFZpdGVEZXZTZXJ2ZXIgfCB1bmRlZmluZWQ7XG4gIGxldCBsaXN0ZW5pbmdBZGRyZXNzOiBBZGRyZXNzSW5mbyB8IHVuZGVmaW5lZDtcbiAgbGV0IGhhZEVycm9yID0gZmFsc2U7XG4gIGNvbnN0IGdlbmVyYXRlZEZpbGVzID0gbmV3IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+KCk7XG4gIGNvbnN0IGFzc2V0RmlsZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBjb25zdCBidWlsZCA9XG4gICAgYnVpbGRlck5hbWUgPT09ICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcjphcHBsaWNhdGlvbidcbiAgICAgID8gYnVpbGRBcHBsaWNhdGlvbkludGVybmFsXG4gICAgICA6IGJ1aWxkRXNidWlsZEJyb3dzZXI7XG5cbiAgLy8gVE9ETzogU3dpdGNoIHRoaXMgdG8gYW4gYXJjaGl0ZWN0IHNjaGVkdWxlIGNhbGwgd2hlbiBpbmZyYXN0cnVjdHVyZSBzZXR0aW5ncyBhcmUgc3VwcG9ydGVkXG4gIGZvciBhd2FpdCAoY29uc3QgcmVzdWx0IG9mIGJ1aWxkKFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgYnJvd3Nlck9wdGlvbnMgYXMgYW55LFxuICAgIGNvbnRleHQsXG4gICAge1xuICAgICAgd3JpdGU6IGZhbHNlLFxuICAgIH0sXG4gICAgcGx1Z2lucyxcbiAgKSkge1xuICAgIGFzc2VydChyZXN1bHQub3V0cHV0RmlsZXMsICdCdWlsZGVyIGRpZCBub3QgcHJvdmlkZSByZXN1bHQgZmlsZXMuJyk7XG5cbiAgICAvLyBJZiBidWlsZCBmYWlsZWQsIG5vdGhpbmcgdG8gc2VydmVcbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAvLyBJZiBzZXJ2ZXIgaXMgYWN0aXZlLCBzZW5kIGFuIGVycm9yIG5vdGlmaWNhdGlvblxuICAgICAgaWYgKHJlc3VsdC5lcnJvcnM/Lmxlbmd0aCAmJiBzZXJ2ZXIpIHtcbiAgICAgICAgaGFkRXJyb3IgPSB0cnVlO1xuICAgICAgICBzZXJ2ZXIud3Muc2VuZCh7XG4gICAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgICBlcnI6IHtcbiAgICAgICAgICAgIG1lc3NhZ2U6IHJlc3VsdC5lcnJvcnNbMF0udGV4dCxcbiAgICAgICAgICAgIHN0YWNrOiAnJyxcbiAgICAgICAgICAgIGxvYzogcmVzdWx0LmVycm9yc1swXS5sb2NhdGlvbixcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGNvbnRpbnVlO1xuICAgIH0gZWxzZSBpZiAoaGFkRXJyb3IgJiYgc2VydmVyKSB7XG4gICAgICBoYWRFcnJvciA9IGZhbHNlO1xuICAgICAgLy8gU2VuZCBhbiBlbXB0eSB1cGRhdGUgdG8gY2xlYXIgdGhlIGVycm9yIG92ZXJsYXlcbiAgICAgIHNlcnZlci53cy5zZW5kKHtcbiAgICAgICAgJ3R5cGUnOiAndXBkYXRlJyxcbiAgICAgICAgdXBkYXRlczogW10sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBbmFseXplIHJlc3VsdCBmaWxlcyBmb3IgY2hhbmdlc1xuICAgIGFuYWx5emVSZXN1bHRGaWxlcyhub3JtYWxpemVQYXRoLCBodG1sSW5kZXhQYXRoLCByZXN1bHQub3V0cHV0RmlsZXMsIGdlbmVyYXRlZEZpbGVzKTtcblxuICAgIGFzc2V0RmlsZXMuY2xlYXIoKTtcbiAgICBpZiAocmVzdWx0LmFzc2V0RmlsZXMpIHtcbiAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgcmVzdWx0LmFzc2V0RmlsZXMpIHtcbiAgICAgICAgYXNzZXRGaWxlcy5zZXQoJy8nICsgbm9ybWFsaXplUGF0aChhc3NldC5kZXN0aW5hdGlvbiksIGFzc2V0LnNvdXJjZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNlcnZlcikge1xuICAgICAgaGFuZGxlVXBkYXRlKGdlbmVyYXRlZEZpbGVzLCBzZXJ2ZXIsIHNlcnZlck9wdGlvbnMsIGNvbnRleHQubG9nZ2VyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgICAgIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldC4nKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgeyByb290ID0gJycgfSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgICAgIGNvbnN0IHByb2plY3RSb290ID0gcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgcm9vdCBhcyBzdHJpbmcpO1xuICAgICAgY29uc3QgYnJvd3NlcnMgPSBnZXRTdXBwb3J0ZWRCcm93c2Vycyhwcm9qZWN0Um9vdCwgY29udGV4dC5sb2dnZXIpO1xuICAgICAgY29uc3QgdGFyZ2V0ID0gdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMoYnJvd3NlcnMpO1xuXG4gICAgICAvLyBTZXR1cCBzZXJ2ZXIgYW5kIHN0YXJ0IGxpc3RlbmluZ1xuICAgICAgY29uc3Qgc2VydmVyQ29uZmlndXJhdGlvbiA9IGF3YWl0IHNldHVwU2VydmVyKFxuICAgICAgICBzZXJ2ZXJPcHRpb25zLFxuICAgICAgICBnZW5lcmF0ZWRGaWxlcyxcbiAgICAgICAgYXNzZXRGaWxlcyxcbiAgICAgICAgYnJvd3Nlck9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgICAgYnJvd3Nlck9wdGlvbnMuZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgICAgICEhYnJvd3Nlck9wdGlvbnMuc3NyLFxuICAgICAgICBwcmVidW5kbGVUcmFuc2Zvcm1lcixcbiAgICAgICAgdGFyZ2V0LFxuICAgICAgKTtcblxuICAgICAgc2VydmVyID0gYXdhaXQgY3JlYXRlU2VydmVyKHNlcnZlckNvbmZpZ3VyYXRpb24pO1xuXG4gICAgICBhd2FpdCBzZXJ2ZXIubGlzdGVuKCk7XG4gICAgICBsaXN0ZW5pbmdBZGRyZXNzID0gc2VydmVyLmh0dHBTZXJ2ZXI/LmFkZHJlc3MoKSBhcyBBZGRyZXNzSW5mbztcblxuICAgICAgLy8gbG9nIGNvbm5lY3Rpb24gaW5mb3JtYXRpb25cbiAgICAgIHNlcnZlci5wcmludFVybHMoKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBhZGp1c3Qgb3V0cHV0IHR5cGluZ3MgdG8gcmVmbGVjdCBib3RoIGRldmVsb3BtZW50IHNlcnZlcnNcbiAgICB5aWVsZCB7IHN1Y2Nlc3M6IHRydWUsIHBvcnQ6IGxpc3RlbmluZ0FkZHJlc3M/LnBvcnQgfSBhcyB1bmtub3duIGFzIERldlNlcnZlckJ1aWxkZXJPdXRwdXQ7XG4gIH1cblxuICAvLyBBZGQgY2xlYW51cCBsb2dpYyB2aWEgYSBidWlsZGVyIHRlYXJkb3duXG4gIGxldCBkZWZlcnJlZDogKCkgPT4gdm9pZDtcbiAgY29udGV4dC5hZGRUZWFyZG93bihhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgc2VydmVyPy5jbG9zZSgpO1xuICAgIGF3YWl0IHByZWJ1bmRsZVRyYW5zZm9ybWVyLmNsb3NlKCk7XG4gICAgZGVmZXJyZWQ/LigpO1xuICB9KTtcbiAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IChkZWZlcnJlZCA9IHJlc29sdmUpKTtcbn1cblxuZnVuY3Rpb24gaGFuZGxlVXBkYXRlKFxuICBnZW5lcmF0ZWRGaWxlczogTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4sXG4gIHNlcnZlcjogVml0ZURldlNlcnZlcixcbiAgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMsXG4gIGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXJBcGksXG4pOiB2b2lkIHtcbiAgY29uc3QgdXBkYXRlZEZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8vIEludmFsaWRhdGUgYW55IHVwZGF0ZWQgZmlsZXNcbiAgZm9yIChjb25zdCBbZmlsZSwgcmVjb3JkXSBvZiBnZW5lcmF0ZWRGaWxlcykge1xuICAgIGlmIChyZWNvcmQudXBkYXRlZCkge1xuICAgICAgdXBkYXRlZEZpbGVzLnB1c2goZmlsZSk7XG4gICAgICBjb25zdCB1cGRhdGVkTW9kdWxlcyA9IHNlcnZlci5tb2R1bGVHcmFwaC5nZXRNb2R1bGVzQnlGaWxlKGZpbGUpO1xuICAgICAgdXBkYXRlZE1vZHVsZXM/LmZvckVhY2goKG0pID0+IHNlcnZlcj8ubW9kdWxlR3JhcGguaW52YWxpZGF0ZU1vZHVsZShtKSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKCF1cGRhdGVkRmlsZXMubGVuZ3RoKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMubGl2ZVJlbG9hZCB8fCBzZXJ2ZXJPcHRpb25zLmhtcikge1xuICAgIGlmICh1cGRhdGVkRmlsZXMuZXZlcnkoKGYpID0+IGYuZW5kc1dpdGgoJy5jc3MnKSkpIHtcbiAgICAgIGNvbnN0IHRpbWVzdGFtcCA9IERhdGUubm93KCk7XG4gICAgICBzZXJ2ZXIud3Muc2VuZCh7XG4gICAgICAgIHR5cGU6ICd1cGRhdGUnLFxuICAgICAgICB1cGRhdGVzOiB1cGRhdGVkRmlsZXMubWFwKChmKSA9PiB7XG4gICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBmLnNsaWNlKDEpOyAvLyBSZW1vdmUgbGVhZGluZyBzbGFzaC5cblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiAnY3NzLXVwZGF0ZScsXG4gICAgICAgICAgICB0aW1lc3RhbXAsXG4gICAgICAgICAgICBwYXRoOiBmaWxlUGF0aCxcbiAgICAgICAgICAgIGFjY2VwdGVkUGF0aDogZmlsZVBhdGgsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSksXG4gICAgICB9KTtcblxuICAgICAgbG9nZ2VyLmluZm8oJ0hNUiB1cGRhdGUgc2VudCB0byBjbGllbnQocykuLi4nKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNlbmQgcmVsb2FkIGNvbW1hbmQgdG8gY2xpZW50c1xuICBpZiAoc2VydmVyT3B0aW9ucy5saXZlUmVsb2FkKSB7XG4gICAgbG9nZ2VyLmluZm8oJ1JlbG9hZGluZyBjbGllbnQocykuLi4nKTtcblxuICAgIHNlcnZlci53cy5zZW5kKHtcbiAgICAgIHR5cGU6ICdmdWxsLXJlbG9hZCcsXG4gICAgICBwYXRoOiAnKicsXG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gYW5hbHl6ZVJlc3VsdEZpbGVzKFxuICBub3JtYWxpemVQYXRoOiAoaWQ6IHN0cmluZykgPT4gc3RyaW5nLFxuICBodG1sSW5kZXhQYXRoOiBzdHJpbmcsXG4gIHJlc3VsdEZpbGVzOiBCdWlsZE91dHB1dEZpbGVbXSxcbiAgZ2VuZXJhdGVkRmlsZXM6IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+LFxuKSB7XG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oWycvaW5kZXguaHRtbCddKTtcbiAgZm9yIChjb25zdCBmaWxlIG9mIHJlc3VsdEZpbGVzKSB7XG4gICAgbGV0IGZpbGVQYXRoO1xuICAgIGlmIChmaWxlLnBhdGggPT09IGh0bWxJbmRleFBhdGgpIHtcbiAgICAgIC8vIENvbnZlcnQgY3VzdG9tIGluZGV4IG91dHB1dCBwYXRoIHRvIHN0YW5kYXJkIGluZGV4IHBhdGggZm9yIGRldi1zZXJ2ZXIgdXNhZ2UuXG4gICAgICAvLyBUaGlzIG1pbWljcyB0aGUgV2VicGFjayBkZXYtc2VydmVyIGJlaGF2aW9yLlxuICAgICAgZmlsZVBhdGggPSAnL2luZGV4Lmh0bWwnO1xuICAgIH0gZWxzZSB7XG4gICAgICBmaWxlUGF0aCA9ICcvJyArIG5vcm1hbGl6ZVBhdGgoZmlsZS5wYXRoKTtcbiAgICB9XG4gICAgc2Vlbi5hZGQoZmlsZVBhdGgpO1xuXG4gICAgLy8gU2tpcCBhbmFseXNpcyBvZiBzb3VyY2VtYXBzXG4gICAgaWYgKGZpbGVQYXRoLmVuZHNXaXRoKCcubWFwJykpIHtcbiAgICAgIGdlbmVyYXRlZEZpbGVzLnNldChmaWxlUGF0aCwge1xuICAgICAgICBjb250ZW50czogZmlsZS5jb250ZW50cyxcbiAgICAgICAgc2VydmFibGU6XG4gICAgICAgICAgZmlsZS50eXBlID09PSBCdWlsZE91dHB1dEZpbGVUeXBlLkJyb3dzZXIgfHwgZmlsZS50eXBlID09PSBCdWlsZE91dHB1dEZpbGVUeXBlLk1lZGlhLFxuICAgICAgICBzaXplOiBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgsXG4gICAgICAgIHVwZGF0ZWQ6IGZhbHNlLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGxldCBmaWxlSGFzaDogQnVmZmVyIHwgdW5kZWZpbmVkO1xuICAgIGNvbnN0IGV4aXN0aW5nUmVjb3JkID0gZ2VuZXJhdGVkRmlsZXMuZ2V0KGZpbGVQYXRoKTtcbiAgICBpZiAoZXhpc3RpbmdSZWNvcmQgJiYgZXhpc3RpbmdSZWNvcmQuc2l6ZSA9PT0gZmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoKSB7XG4gICAgICAvLyBPbmx5IGhhc2ggZXhpc3RpbmcgZmlsZSB3aGVuIG5lZWRlZFxuICAgICAgaWYgKGV4aXN0aW5nUmVjb3JkLmhhc2ggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBleGlzdGluZ1JlY29yZC5oYXNoID0gaGFzaENvbnRlbnQoZXhpc3RpbmdSZWNvcmQuY29udGVudHMpO1xuICAgICAgfVxuXG4gICAgICAvLyBDb21wYXJlIGFnYWluc3QgbGF0ZXN0IHJlc3VsdCBvdXRwdXRcbiAgICAgIGZpbGVIYXNoID0gaGFzaENvbnRlbnQoZmlsZS5jb250ZW50cyk7XG4gICAgICBpZiAoZmlsZUhhc2guZXF1YWxzKGV4aXN0aW5nUmVjb3JkLmhhc2gpKSB7XG4gICAgICAgIC8vIFNhbWUgZmlsZVxuICAgICAgICBleGlzdGluZ1JlY29yZC51cGRhdGVkID0gZmFsc2U7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGdlbmVyYXRlZEZpbGVzLnNldChmaWxlUGF0aCwge1xuICAgICAgY29udGVudHM6IGZpbGUuY29udGVudHMsXG4gICAgICBzaXplOiBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgsXG4gICAgICBoYXNoOiBmaWxlSGFzaCxcbiAgICAgIHVwZGF0ZWQ6IHRydWUsXG4gICAgICBzZXJ2YWJsZTpcbiAgICAgICAgZmlsZS50eXBlID09PSBCdWlsZE91dHB1dEZpbGVUeXBlLkJyb3dzZXIgfHwgZmlsZS50eXBlID09PSBCdWlsZE91dHB1dEZpbGVUeXBlLk1lZGlhLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gQ2xlYXIgc3RhbGUgb3V0cHV0IGZpbGVzXG4gIGZvciAoY29uc3QgZmlsZSBvZiBnZW5lcmF0ZWRGaWxlcy5rZXlzKCkpIHtcbiAgICBpZiAoIXNlZW4uaGFzKGZpbGUpKSB7XG4gICAgICBnZW5lcmF0ZWRGaWxlcy5kZWxldGUoZmlsZSk7XG4gICAgfVxuICB9XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0dXBTZXJ2ZXIoXG4gIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zLFxuICBvdXRwdXRGaWxlczogTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4sXG4gIGFzc2V0czogTWFwPHN0cmluZywgc3RyaW5nPixcbiAgcHJlc2VydmVTeW1saW5rczogYm9vbGVhbiB8IHVuZGVmaW5lZCxcbiAgcHJlYnVuZGxlRXhjbHVkZTogc3RyaW5nW10gfCB1bmRlZmluZWQsXG4gIHNzcjogYm9vbGVhbixcbiAgcHJlYnVuZGxlVHJhbnNmb3JtZXI6IEphdmFTY3JpcHRUcmFuc2Zvcm1lcixcbiAgdGFyZ2V0OiBzdHJpbmdbXSxcbik6IFByb21pc2U8SW5saW5lQ29uZmlnPiB7XG4gIGNvbnN0IHByb3h5ID0gYXdhaXQgbG9hZFByb3h5Q29uZmlndXJhdGlvbihcbiAgICBzZXJ2ZXJPcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgc2VydmVyT3B0aW9ucy5wcm94eUNvbmZpZyxcbiAgICB0cnVlLFxuICApO1xuXG4gIC8vIGR5bmFtaWNhbGx5IGltcG9ydCBWaXRlIGZvciBFU00gY29tcGF0aWJpbGl0eVxuICBjb25zdCB7IG5vcm1hbGl6ZVBhdGggfSA9IGF3YWl0IGltcG9ydCgndml0ZScpO1xuXG4gIGNvbnN0IGNvbmZpZ3VyYXRpb246IElubGluZUNvbmZpZyA9IHtcbiAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICBlbnZGaWxlOiBmYWxzZSxcbiAgICBjYWNoZURpcjogcGF0aC5qb2luKHNlcnZlck9wdGlvbnMuY2FjaGVPcHRpb25zLnBhdGgsICd2aXRlJyksXG4gICAgcm9vdDogc2VydmVyT3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIHB1YmxpY0RpcjogZmFsc2UsXG4gICAgZXNidWlsZDogZmFsc2UsXG4gICAgbW9kZTogJ2RldmVsb3BtZW50JyxcbiAgICBhcHBUeXBlOiAnc3BhJyxcbiAgICBjc3M6IHtcbiAgICAgIGRldlNvdXJjZW1hcDogdHJ1ZSxcbiAgICB9LFxuICAgIGJhc2U6IHNlcnZlck9wdGlvbnMuc2VydmVQYXRoLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgfSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHBvcnQ6IHNlcnZlck9wdGlvbnMucG9ydCxcbiAgICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgICBob3N0OiBzZXJ2ZXJPcHRpb25zLmhvc3QsXG4gICAgICBvcGVuOiBzZXJ2ZXJPcHRpb25zLm9wZW4sXG4gICAgICBoZWFkZXJzOiBzZXJ2ZXJPcHRpb25zLmhlYWRlcnMsXG4gICAgICBwcm94eSxcbiAgICAgIC8vIEN1cnJlbnRseSBkb2VzIG5vdCBhcHBlYXIgdG8gYmUgYSB3YXkgdG8gZGlzYWJsZSBmaWxlIHdhdGNoaW5nIGRpcmVjdGx5IHNvIGlnbm9yZSBhbGwgZmlsZXNcbiAgICAgIHdhdGNoOiB7XG4gICAgICAgIGlnbm9yZWQ6IFsnKiovKiddLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHNzcjoge1xuICAgICAgLy8gRXhjbHVkZSBhbnkgcHJvdmlkZWQgZGVwZW5kZW5jaWVzIChjdXJyZW50bHkgYnVpbGQgZGVmaW5lZCBleHRlcm5hbHMpXG4gICAgICBleHRlcm5hbDogcHJlYnVuZGxlRXhjbHVkZSxcbiAgICB9LFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZUFuZ3VsYXJMb2NhbGVEYXRhUGx1Z2luKCksXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICd2aXRlOmFuZ3VsYXItbWVtb3J5JyxcbiAgICAgICAgLy8gRW5zdXJlcyBwbHVnaW4gaG9va3MgcnVuIGJlZm9yZSBidWlsdC1pbiBWaXRlIGhvb2tzXG4gICAgICAgIGVuZm9yY2U6ICdwcmUnLFxuICAgICAgICBhc3luYyByZXNvbHZlSWQoc291cmNlLCBpbXBvcnRlcikge1xuICAgICAgICAgIGlmIChpbXBvcnRlciAmJiBzb3VyY2Uuc3RhcnRzV2l0aCgnLicpKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgcXVlcnkgaWYgcHJlc2VudFxuICAgICAgICAgICAgY29uc3QgW2ltcG9ydGVyRmlsZV0gPSBpbXBvcnRlci5zcGxpdCgnPycsIDEpO1xuXG4gICAgICAgICAgICBzb3VyY2UgPSBub3JtYWxpemVQYXRoKHBhdGguam9pbihwYXRoLmRpcm5hbWUoaW1wb3J0ZXJGaWxlKSwgc291cmNlKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgW2ZpbGVdID0gc291cmNlLnNwbGl0KCc/JywgMSk7XG4gICAgICAgICAgaWYgKG91dHB1dEZpbGVzLmhhcyhmaWxlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNvdXJjZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGxvYWQoaWQpIHtcbiAgICAgICAgICBjb25zdCBbZmlsZV0gPSBpZC5zcGxpdCgnPycsIDEpO1xuICAgICAgICAgIGNvbnN0IGNvZGVDb250ZW50cyA9IG91dHB1dEZpbGVzLmdldChmaWxlKT8uY29udGVudHM7XG4gICAgICAgICAgaWYgKGNvZGVDb250ZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgY29kZSA9IEJ1ZmZlci5mcm9tKGNvZGVDb250ZW50cykudG9TdHJpbmcoJ3V0Zi04Jyk7XG4gICAgICAgICAgY29uc3QgbWFwQ29udGVudHMgPSBvdXRwdXRGaWxlcy5nZXQoZmlsZSArICcubWFwJyk/LmNvbnRlbnRzO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBzb3VyY2UgbWFwIFVSTCBjb21tZW50cyBmcm9tIHRoZSBjb2RlIGlmIGEgc291cmNlbWFwIGlzIHByZXNlbnQuXG4gICAgICAgICAgICAvLyBWaXRlIHdpbGwgaW5saW5lIGFuZCBhZGQgYW4gYWRkaXRpb25hbCBzb3VyY2VtYXAgVVJMIGZvciB0aGUgc291cmNlbWFwLlxuICAgICAgICAgICAgY29kZTogbWFwQ29udGVudHMgPyBjb2RlLnJlcGxhY2UoL15cXC9cXC8jIHNvdXJjZU1hcHBpbmdVUkw9W15cXHJcXG5dKi9nbSwgJycpIDogY29kZSxcbiAgICAgICAgICAgIG1hcDogbWFwQ29udGVudHMgJiYgQnVmZmVyLmZyb20obWFwQ29udGVudHMpLnRvU3RyaW5nKCd1dGYtOCcpLFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgICAgICAvLyBBc3NldHMgYW5kIHJlc291cmNlcyBnZXQgaGFuZGxlZCBmaXJzdFxuICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoZnVuY3Rpb24gYW5ndWxhckFzc2V0c01pZGRsZXdhcmUocmVxLCByZXMsIG5leHQpIHtcbiAgICAgICAgICAgIGlmIChyZXEudXJsID09PSB1bmRlZmluZWQgfHwgcmVzLndyaXRhYmxlRW5kZWQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBQYXJzZSB0aGUgaW5jb21pbmcgcmVxdWVzdC5cbiAgICAgICAgICAgIC8vIFRoZSBiYXNlIG9mIHRoZSBVUkwgaXMgdW51c2VkIGJ1dCByZXF1aXJlZCB0byBwYXJzZSB0aGUgVVJMLlxuICAgICAgICAgICAgY29uc3QgcGF0aG5hbWUgPSBwYXRobmFtZVdpdGhvdXRTZXJ2ZVBhdGgocmVxLnVybCwgc2VydmVyT3B0aW9ucyk7XG4gICAgICAgICAgICBjb25zdCBleHRlbnNpb24gPSBwYXRoLmV4dG5hbWUocGF0aG5hbWUpO1xuXG4gICAgICAgICAgICAvLyBSZXdyaXRlIGFsbCBidWlsZCBhc3NldHMgdG8gYSB2aXRlIHJhdyBmcyBVUkxcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0U291cmNlUGF0aCA9IGFzc2V0cy5nZXQocGF0aG5hbWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0U291cmNlUGF0aCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIC8vIFRoZSBlbmNvZGluZyBuZWVkcyB0byBtYXRjaCB3aGF0IGhhcHBlbnMgaW4gdGhlIHZpdGUgc3RhdGljIG1pZGRsZXdhcmUuXG4gICAgICAgICAgICAgIC8vIHJlZjogaHR0cHM6Ly9naXRodWIuY29tL3ZpdGVqcy92aXRlL2Jsb2IvZDRmMTNiZDgxNDY4OTYxYzhjOTI2NDM4ZTgxNWFiNmIxYzgyNzM1ZS9wYWNrYWdlcy92aXRlL3NyYy9ub2RlL3NlcnZlci9taWRkbGV3YXJlcy9zdGF0aWMudHMjTDE2M1xuICAgICAgICAgICAgICByZXEudXJsID0gYC9AZnMvJHtlbmNvZGVVUkkoYXNzZXRTb3VyY2VQYXRoKX1gO1xuICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZXNvdXJjZSBmaWxlcyBhcmUgaGFuZGxlZCBkaXJlY3RseS5cbiAgICAgICAgICAgIC8vIEdsb2JhbCBzdHlsZXNoZWV0cyAoQ1NTIGZpbGVzKSBhcmUgY3VycmVudGx5IGNvbnNpZGVyZWQgcmVzb3VyY2VzIHRvIHdvcmthcm91bmRcbiAgICAgICAgICAgIC8vIGRldiBzZXJ2ZXIgc291cmNlbWFwIGlzc3VlcyB3aXRoIHN0eWxlc2hlZXRzLlxuICAgICAgICAgICAgaWYgKGV4dGVuc2lvbiAhPT0gJy5qcycgJiYgZXh0ZW5zaW9uICE9PSAnLmh0bWwnKSB7XG4gICAgICAgICAgICAgIGNvbnN0IG91dHB1dEZpbGUgPSBvdXRwdXRGaWxlcy5nZXQocGF0aG5hbWUpO1xuICAgICAgICAgICAgICBpZiAob3V0cHV0RmlsZT8uc2VydmFibGUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtaW1lVHlwZSA9IGxvb2t1cE1pbWVUeXBlKGV4dGVuc2lvbik7XG4gICAgICAgICAgICAgICAgaWYgKG1pbWVUeXBlKSB7XG4gICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCBtaW1lVHlwZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NhY2hlLUNvbnRyb2wnLCAnbm8tY2FjaGUnKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VydmVyT3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyhzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpLmZvckVhY2goKFtuYW1lLCB2YWx1ZV0pID0+XG4gICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIobmFtZSwgdmFsdWUpLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzLmVuZChvdXRwdXRGaWxlLmNvbnRlbnRzKTtcblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAvLyBSZXR1cm5pbmcgYSBmdW5jdGlvbiwgaW5zdGFsbHMgbWlkZGxld2FyZSBhZnRlciB0aGUgbWFpbiB0cmFuc2Zvcm0gbWlkZGxld2FyZSBidXRcbiAgICAgICAgICAvLyBiZWZvcmUgdGhlIGJ1aWx0LWluIEhUTUwgbWlkZGxld2FyZVxuICAgICAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgICAgICBmdW5jdGlvbiBhbmd1bGFyU1NSTWlkZGxld2FyZShcbiAgICAgICAgICAgICAgcmVxOiBDb25uZWN0LkluY29taW5nTWVzc2FnZSxcbiAgICAgICAgICAgICAgcmVzOiBTZXJ2ZXJSZXNwb25zZSxcbiAgICAgICAgICAgICAgbmV4dDogQ29ubmVjdC5OZXh0RnVuY3Rpb24sXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgY29uc3QgdXJsID0gcmVxLm9yaWdpbmFsVXJsO1xuICAgICAgICAgICAgICBpZiAoIXVybCB8fCB1cmwuZW5kc1dpdGgoJy5odG1sJykpIHtcbiAgICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCByYXdIdG1sID0gb3V0cHV0RmlsZXMuZ2V0KCcvaW5kZXguc2VydmVyLmh0bWwnKT8uY29udGVudHM7XG4gICAgICAgICAgICAgIGlmICghcmF3SHRtbCkge1xuICAgICAgICAgICAgICAgIG5leHQoKTtcblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHRyYW5zZm9ybUluZGV4SHRtbEFuZEFkZEhlYWRlcnModXJsLCByYXdIdG1sLCByZXMsIG5leHQsIGFzeW5jIChodG1sKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBjb250ZW50IH0gPSBhd2FpdCByZW5kZXJQYWdlKHtcbiAgICAgICAgICAgICAgICAgIGRvY3VtZW50OiBodG1sLFxuICAgICAgICAgICAgICAgICAgcm91dGU6IHBhdGhuYW1lV2l0aG91dFNlcnZlUGF0aCh1cmwsIHNlcnZlck9wdGlvbnMpLFxuICAgICAgICAgICAgICAgICAgc2VydmVyQ29udGV4dDogJ3NzcicsXG4gICAgICAgICAgICAgICAgICBsb2FkQnVuZGxlOiAocGF0aDogc3RyaW5nKSA9PlxuICAgICAgICAgICAgICAgICAgICBzZXJ2ZXIuc3NyTG9hZE1vZHVsZShwYXRoLnNsaWNlKDEpKSBhcyBSZXR1cm5UeXBlPFxuICAgICAgICAgICAgICAgICAgICAgIE5vbk51bGxhYmxlPFJlbmRlck9wdGlvbnNbJ2xvYWRCdW5kbGUnXT5cbiAgICAgICAgICAgICAgICAgICAgPixcbiAgICAgICAgICAgICAgICAgIC8vIEZpbGVzIGhlcmUgYXJlIG9ubHkgbmVlZGVkIGZvciBjcml0aWNhbCBDU1MgaW5saW5pbmcuXG4gICAgICAgICAgICAgICAgICBvdXRwdXRGaWxlczoge30sXG4gICAgICAgICAgICAgICAgICAvLyBUT0RPOiBhZGQgc3VwcG9ydCBmb3IgY3JpdGljYWwgY3NzIGlubGluaW5nLlxuICAgICAgICAgICAgICAgICAgaW5saW5lQ3JpdGljYWxDc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3NyKSB7XG4gICAgICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoYW5ndWxhclNTUk1pZGRsZXdhcmUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGZ1bmN0aW9uIGFuZ3VsYXJJbmRleE1pZGRsZXdhcmUocmVxLCByZXMsIG5leHQpIHtcbiAgICAgICAgICAgICAgaWYgKCFyZXEudXJsKSB7XG4gICAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gUGFyc2UgdGhlIGluY29taW5nIHJlcXVlc3QuXG4gICAgICAgICAgICAgIC8vIFRoZSBiYXNlIG9mIHRoZSBVUkwgaXMgdW51c2VkIGJ1dCByZXF1aXJlZCB0byBwYXJzZSB0aGUgVVJMLlxuICAgICAgICAgICAgICBjb25zdCBwYXRobmFtZSA9IHBhdGhuYW1lV2l0aG91dFNlcnZlUGF0aChyZXEudXJsLCBzZXJ2ZXJPcHRpb25zKTtcblxuICAgICAgICAgICAgICBpZiAocGF0aG5hbWUgPT09ICcvJyB8fCBwYXRobmFtZSA9PT0gYC9pbmRleC5odG1sYCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJhd0h0bWwgPSBvdXRwdXRGaWxlcy5nZXQoJy9pbmRleC5odG1sJyk/LmNvbnRlbnRzO1xuICAgICAgICAgICAgICAgIGlmIChyYXdIdG1sKSB7XG4gICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1JbmRleEh0bWxBbmRBZGRIZWFkZXJzKHJlcS51cmwsIHJhd0h0bWwsIHJlcywgbmV4dCk7XG5cbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgZnVuY3Rpb24gdHJhbnNmb3JtSW5kZXhIdG1sQW5kQWRkSGVhZGVycyhcbiAgICAgICAgICAgIHVybDogc3RyaW5nLFxuICAgICAgICAgICAgcmF3SHRtbDogVWludDhBcnJheSxcbiAgICAgICAgICAgIHJlczogU2VydmVyUmVzcG9uc2U8aW1wb3J0KCdodHRwJykuSW5jb21pbmdNZXNzYWdlPixcbiAgICAgICAgICAgIG5leHQ6IENvbm5lY3QuTmV4dEZ1bmN0aW9uLFxuICAgICAgICAgICAgYWRkaXRpb25hbFRyYW5zZm9ybWVyPzogKGh0bWw6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+LFxuICAgICAgICAgICkge1xuICAgICAgICAgICAgc2VydmVyXG4gICAgICAgICAgICAgIC50cmFuc2Zvcm1JbmRleEh0bWwodXJsLCBCdWZmZXIuZnJvbShyYXdIdG1sKS50b1N0cmluZygndXRmLTgnKSlcbiAgICAgICAgICAgICAgLnRoZW4oYXN5bmMgKHByb2Nlc3NlZEh0bWwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoYWRkaXRpb25hbFRyYW5zZm9ybWVyKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgYWRkaXRpb25hbFRyYW5zZm9ybWVyKHByb2Nlc3NlZEh0bWwpO1xuICAgICAgICAgICAgICAgICAgaWYgKCFjb250ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIG5leHQoKTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIHByb2Nlc3NlZEh0bWwgPSBjb250ZW50O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICd0ZXh0L2h0bWwnKTtcbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDYWNoZS1Db250cm9sJywgJ25vLWNhY2hlJyk7XG4gICAgICAgICAgICAgICAgaWYgKHNlcnZlck9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoc2VydmVyT3B0aW9ucy5oZWFkZXJzKS5mb3JFYWNoKChbbmFtZSwgdmFsdWVdKSA9PlxuICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKG5hbWUsIHZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlcy5lbmQocHJvY2Vzc2VkSHRtbCk7XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IG5leHQoZXJyb3IpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIF0sXG4gICAgb3B0aW1pemVEZXBzOiB7XG4gICAgICAvLyBPbmx5IGVuYWJsZSB3aXRoIGNhY2hpbmcgc2luY2UgaXQgY2F1c2VzIHByZWJ1bmRsZSBkZXBlbmRlbmNpZXMgdG8gYmUgY2FjaGVkXG4gICAgICBkaXNhYmxlZDogIXNlcnZlck9wdGlvbnMuY2FjaGVPcHRpb25zLmVuYWJsZWQsXG4gICAgICAvLyBFeGNsdWRlIGFueSBwcm92aWRlZCBkZXBlbmRlbmNpZXMgKGN1cnJlbnRseSBidWlsZCBkZWZpbmVkIGV4dGVybmFscylcbiAgICAgIGV4Y2x1ZGU6IHByZWJ1bmRsZUV4Y2x1ZGUsXG4gICAgICAvLyBTa2lwIGF1dG9tYXRpYyBmaWxlLWJhc2VkIGVudHJ5IHBvaW50IGRpc2NvdmVyeVxuICAgICAgZW50cmllczogW10sXG4gICAgICAvLyBBZGQgYW4gZXNidWlsZCBwbHVnaW4gdG8gcnVuIHRoZSBBbmd1bGFyIGxpbmtlciBvbiBkZXBlbmRlbmNpZXNcbiAgICAgIGVzYnVpbGRPcHRpb25zOiB7XG4gICAgICAgIC8vIFNldCBlc2J1aWxkIHN1cHBvcnRlZCB0YXJnZXRzLlxuICAgICAgICB0YXJnZXQsXG4gICAgICAgIHN1cHBvcnRlZDogZ2V0RmVhdHVyZVN1cHBvcnQodGFyZ2V0KSxcbiAgICAgICAgcGx1Z2luczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdhbmd1bGFyLXZpdGUtb3B0aW1pemUtZGVwcycsXG4gICAgICAgICAgICBzZXR1cChidWlsZCkge1xuICAgICAgICAgICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5bY21dP2pzJC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgY29udGVudHM6IGF3YWl0IHByZWJ1bmRsZVRyYW5zZm9ybWVyLnRyYW5zZm9ybUZpbGUoYXJncy5wYXRoKSxcbiAgICAgICAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcblxuICBpZiAoc2VydmVyT3B0aW9ucy5zc2wpIHtcbiAgICBpZiAoc2VydmVyT3B0aW9ucy5zc2xDZXJ0ICYmIHNlcnZlck9wdGlvbnMuc3NsS2V5KSB7XG4gICAgICAvLyBzZXJ2ZXIgY29uZmlndXJhdGlvbiBpcyBkZWZpbmVkIGFib3ZlXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgY29uZmlndXJhdGlvbi5zZXJ2ZXIhLmh0dHBzID0ge1xuICAgICAgICBjZXJ0OiBhd2FpdCByZWFkRmlsZShzZXJ2ZXJPcHRpb25zLnNzbENlcnQpLFxuICAgICAgICBrZXk6IGF3YWl0IHJlYWRGaWxlKHNlcnZlck9wdGlvbnMuc3NsS2V5KSxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHsgZGVmYXVsdDogYmFzaWNTc2xQbHVnaW4gfSA9IGF3YWl0IGltcG9ydCgnQHZpdGVqcy9wbHVnaW4tYmFzaWMtc3NsJyk7XG4gICAgICBjb25maWd1cmF0aW9uLnBsdWdpbnMgPz89IFtdO1xuICAgICAgY29uZmlndXJhdGlvbi5wbHVnaW5zLnB1c2goYmFzaWNTc2xQbHVnaW4oKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGNvbmZpZ3VyYXRpb247XG59XG5cbmZ1bmN0aW9uIHBhdGhuYW1lV2l0aG91dFNlcnZlUGF0aCh1cmw6IHN0cmluZywgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMpOiBzdHJpbmcge1xuICBjb25zdCBwYXJzZWRVcmwgPSBuZXcgVVJMKHVybCwgJ2h0dHA6Ly9sb2NhbGhvc3QnKTtcbiAgbGV0IHBhdGhuYW1lID0gZGVjb2RlVVJJQ29tcG9uZW50KHBhcnNlZFVybC5wYXRobmFtZSk7XG4gIGlmIChzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCAmJiBwYXRobmFtZS5zdGFydHNXaXRoKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoKSkge1xuICAgIHBhdGhuYW1lID0gcGF0aG5hbWUuc2xpY2Uoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgubGVuZ3RoKTtcbiAgICBpZiAocGF0aG5hbWVbMF0gIT09ICcvJykge1xuICAgICAgcGF0aG5hbWUgPSAnLycgKyBwYXRobmFtZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcGF0aG5hbWU7XG59XG4iXX0=