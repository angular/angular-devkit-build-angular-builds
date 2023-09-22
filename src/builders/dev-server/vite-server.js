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
const node_path_1 = __importStar(require("node:path"));
const javascript_transformer_1 = require("../../tools/esbuild/javascript-transformer");
const i18n_locale_plugin_1 = require("../../tools/vite/i18n-locale-plugin");
const render_page_1 = require("../../utils/server-rendering/render-page");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const browser_esbuild_1 = require("../browser-esbuild");
const load_proxy_config_1 = require("./load-proxy-config");
const SSG_MARKER_REGEXP = /ng-server-context=["']\w*\|?ssg\|?\w*["']/;
function hashContent(contents) {
    // TODO: Consider xxhash
    return (0, node_crypto_1.createHash)('sha256').update(contents).digest();
}
async function* serveWithVite(serverOptions, builderName, context) {
    // Get the browser configuration from the target name.
    const rawBrowserOptions = (await context.getTargetOptions(serverOptions.browserTarget));
    const browserOptions = (await context.validateOptions({
        ...rawBrowserOptions,
        watch: serverOptions.watch,
        poll: serverOptions.poll,
        verbose: serverOptions.verbose,
    }, builderName));
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
    const generatedFiles = new Map();
    const assetFiles = new Map();
    // TODO: Switch this to an architect schedule call when infrastructure settings are supported
    for await (const result of (0, browser_esbuild_1.buildEsbuildBrowser)(browserOptions, context, {
        write: false,
    })) {
        (0, node_assert_1.default)(result.outputFiles, 'Builder did not provide result files.');
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
            // Setup server and start listening
            const serverConfiguration = await setupServer(serverOptions, generatedFiles, assetFiles, browserOptions.preserveSymlinks, browserOptions.externalDependencies, !!browserOptions.ssr, prebundleTransformer);
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
async function setupServer(serverOptions, outputFiles, assets, preserveSymlinks, prebundleExclude, ssr, prebundleTransformer) {
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
                            if (outputFile) {
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
                            const potentialPrerendered = outputFiles.get(node_path_1.posix.join(url, 'index.html'))?.contents;
                            if (potentialPrerendered) {
                                const content = Buffer.from(potentialPrerendered).toString('utf-8');
                                if (SSG_MARKER_REGEXP.test(content)) {
                                    transformIndexHtmlAndAddHeaders(url, potentialPrerendered, res, next);
                                    return;
                                }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3ZpdGUtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0gsbUNBQWtEO0FBQ2xELDhEQUFpQztBQUNqQyw2Q0FBcUQ7QUFDckQsK0NBQTRDO0FBRzVDLHVEQUF3QztBQUV4Qyx1RkFBbUY7QUFDbkYsNEVBQW9GO0FBQ3BGLDBFQUFxRjtBQUNyRiwrRUFBd0U7QUFDeEUsd0RBQXlEO0FBRXpELDJEQUE2RDtBQVc3RCxNQUFNLGlCQUFpQixHQUFHLDJDQUEyQyxDQUFDO0FBRXRFLFNBQVMsV0FBVyxDQUFDLFFBQW9CO0lBQ3ZDLHdCQUF3QjtJQUN4QixPQUFPLElBQUEsd0JBQVUsRUFBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDeEQsQ0FBQztBQUVNLEtBQUssU0FBUyxDQUFDLENBQUMsYUFBYSxDQUNsQyxhQUF5QyxFQUN6QyxXQUFtQixFQUNuQixPQUF1QjtJQUV2QixzREFBc0Q7SUFDdEQsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUN2RCxhQUFhLENBQUMsYUFBYSxDQUM1QixDQUE0QyxDQUFDO0lBRTlDLE1BQU0sY0FBYyxHQUFHLENBQUMsTUFBTSxPQUFPLENBQUMsZUFBZSxDQUNuRDtRQUNFLEdBQUcsaUJBQWlCO1FBQ3BCLEtBQUssRUFBRSxhQUFhLENBQUMsS0FBSztRQUMxQixJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUk7UUFDeEIsT0FBTyxFQUFFLGFBQWEsQ0FBQyxPQUFPO0tBQ1ksRUFDNUMsV0FBVyxDQUNaLENB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QW9FO1lBQ3BFLGFBQWEsQ0FBQyxNQUFPLENBQUMsS0FBSyxHQUFHO2dCQUM1QixJQUFJLEVBQUUsTUFBTSxJQUFBLG1CQUFRLEVBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQztnQkFDM0MsR0FBRyxFQUFFLE1BQU0sSUFBQSxtQkFBUSxFQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUM7YUFDMUMsQ0FBQztTQUNIO2FBQU07WUFDTCxNQUFNLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxHQUFHLHdEQUFhLDBCQUEwQixHQUFDLENBQUM7WUFDN0UsYUFBYSxDQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDN0IsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQztTQUM5QztLQUNGO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQztBQW5TRCxrQ0FtU0M7QUFFRCxTQUFTLHdCQUF3QixDQUFDLEdBQVcsRUFBRSxhQUF5QztJQUN0RixNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUNuRCxJQUFJLFFBQVEsR0FBRyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDdEQsSUFBSSxhQUFhLENBQUMsU0FBUyxJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1FBQzNFLFFBQVEsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDMUQsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1lBQ3ZCLFFBQVEsR0FBRyxHQUFHLEdBQUcsUUFBUSxDQUFDO1NBQzNCO0tBQ0Y7SUFFRCxPQUFPLFFBQVEsQ0FBQztBQUNsQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB0eXBlIHsganNvbiwgbG9nZ2luZyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB0eXBlIHsgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgbG9va3VwIGFzIGxvb2t1cE1pbWVUeXBlIH0gZnJvbSAnbXJtaW1lJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgQmluYXJ5TGlrZSwgY3JlYXRlSGFzaCB9IGZyb20gJ25vZGU6Y3J5cHRvJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBTZXJ2ZXJSZXNwb25zZSB9IGZyb20gJ25vZGU6aHR0cCc7XG5pbXBvcnQgdHlwZSB7IEFkZHJlc3NJbmZvIH0gZnJvbSAnbm9kZTpuZXQnO1xuaW1wb3J0IHBhdGgsIHsgcG9zaXggfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHR5cGUgeyBDb25uZWN0LCBJbmxpbmVDb25maWcsIFZpdGVEZXZTZXJ2ZXIgfSBmcm9tICd2aXRlJztcbmltcG9ydCB7IEphdmFTY3JpcHRUcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvamF2YXNjcmlwdC10cmFuc2Zvcm1lcic7XG5pbXBvcnQgeyBjcmVhdGVBbmd1bGFyTG9jYWxlRGF0YVBsdWdpbiB9IGZyb20gJy4uLy4uL3Rvb2xzL3ZpdGUvaTE4bi1sb2NhbGUtcGx1Z2luJztcbmltcG9ydCB7IFJlbmRlck9wdGlvbnMsIHJlbmRlclBhZ2UgfSBmcm9tICcuLi8uLi91dGlscy9zZXJ2ZXItcmVuZGVyaW5nL3JlbmRlci1wYWdlJztcbmltcG9ydCB7IGdldEluZGV4T3V0cHV0RmlsZSB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgYnVpbGRFc2J1aWxkQnJvd3NlciB9IGZyb20gJy4uL2Jyb3dzZXItZXNidWlsZCc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi4vYnJvd3Nlci1lc2J1aWxkL3NjaGVtYSc7XG5pbXBvcnQgeyBsb2FkUHJveHlDb25maWd1cmF0aW9uIH0gZnJvbSAnLi9sb2FkLXByb3h5LWNvbmZpZyc7XG5pbXBvcnQgdHlwZSB7IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB0eXBlIHsgRGV2U2VydmVyQnVpbGRlck91dHB1dCB9IGZyb20gJy4vd2VicGFjay1zZXJ2ZXInO1xuXG5pbnRlcmZhY2UgT3V0cHV0RmlsZVJlY29yZCB7XG4gIGNvbnRlbnRzOiBVaW50OEFycmF5O1xuICBzaXplOiBudW1iZXI7XG4gIGhhc2g/OiBCdWZmZXI7XG4gIHVwZGF0ZWQ6IGJvb2xlYW47XG59XG5cbmNvbnN0IFNTR19NQVJLRVJfUkVHRVhQID0gL25nLXNlcnZlci1jb250ZXh0PVtcIiddXFx3KlxcfD9zc2dcXHw/XFx3KltcIiddLztcblxuZnVuY3Rpb24gaGFzaENvbnRlbnQoY29udGVudHM6IEJpbmFyeUxpa2UpOiBCdWZmZXIge1xuICAvLyBUT0RPOiBDb25zaWRlciB4eGhhc2hcbiAgcmV0dXJuIGNyZWF0ZUhhc2goJ3NoYTI1NicpLnVwZGF0ZShjb250ZW50cykuZGlnZXN0KCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogc2VydmVXaXRoVml0ZShcbiAgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMsXG4gIGJ1aWxkZXJOYW1lOiBzdHJpbmcsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPERldlNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gR2V0IHRoZSBicm93c2VyIGNvbmZpZ3VyYXRpb24gZnJvbSB0aGUgdGFyZ2V0IG5hbWUuXG4gIGNvbnN0IHJhd0Jyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhcbiAgICBzZXJ2ZXJPcHRpb25zLmJyb3dzZXJUYXJnZXQsXG4gICkpIGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyT3B0aW9ucztcblxuICBjb25zdCBicm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LnZhbGlkYXRlT3B0aW9ucyhcbiAgICB7XG4gICAgICAuLi5yYXdCcm93c2VyT3B0aW9ucyxcbiAgICAgIHdhdGNoOiBzZXJ2ZXJPcHRpb25zLndhdGNoLFxuICAgICAgcG9sbDogc2VydmVyT3B0aW9ucy5wb2xsLFxuICAgICAgdmVyYm9zZTogc2VydmVyT3B0aW9ucy52ZXJib3NlLFxuICAgIH0gYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICAgIGJ1aWxkZXJOYW1lLFxuICApKSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG4gIC8vIFNldCBhbGwgcGFja2FnZXMgYXMgZXh0ZXJuYWwgdG8gc3VwcG9ydCBWaXRlJ3MgcHJlYnVuZGxlIGNhY2hpbmdcbiAgYnJvd3Nlck9wdGlvbnMuZXh0ZXJuYWxQYWNrYWdlcyA9IHNlcnZlck9wdGlvbnMuY2FjaGVPcHRpb25zLmVuYWJsZWQ7XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoID09PSB1bmRlZmluZWQgJiYgYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYgIT09IHVuZGVmaW5lZCkge1xuICAgIHNlcnZlck9wdGlvbnMuc2VydmVQYXRoID0gYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWY7XG4gIH1cblxuICAvLyBUaGUgZGV2ZWxvcG1lbnQgc2VydmVyIGN1cnJlbnRseSBvbmx5IHN1cHBvcnRzIGEgc2luZ2xlIGxvY2FsZSB3aGVuIGxvY2FsaXppbmcuXG4gIC8vIFRoaXMgbWF0Y2hlcyB0aGUgYmVoYXZpb3Igb2YgdGhlIFdlYnBhY2stYmFzZWQgZGV2ZWxvcG1lbnQgc2VydmVyIGJ1dCBjb3VsZCBiZSBleHBhbmRlZCBpbiB0aGUgZnV0dXJlLlxuICBpZiAoXG4gICAgYnJvd3Nlck9wdGlvbnMubG9jYWxpemUgPT09IHRydWUgfHxcbiAgICAoQXJyYXkuaXNBcnJheShicm93c2VyT3B0aW9ucy5sb2NhbGl6ZSkgJiYgYnJvd3Nlck9wdGlvbnMubG9jYWxpemUubGVuZ3RoID4gMSlcbiAgKSB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICdMb2NhbGl6YXRpb24gKGBsb2NhbGl6ZWAgb3B0aW9uKSBoYXMgYmVlbiBkaXNhYmxlZC4gVGhlIGRldmVsb3BtZW50IHNlcnZlciBvbmx5IHN1cHBvcnRzIGxvY2FsaXppbmcgYSBzaW5nbGUgbG9jYWxlIHBlciBidWlsZC4nLFxuICAgICk7XG4gICAgYnJvd3Nlck9wdGlvbnMubG9jYWxpemUgPSBmYWxzZTtcbiAgfSBlbHNlIGlmIChicm93c2VyT3B0aW9ucy5sb2NhbGl6ZSkge1xuICAgIC8vIFdoZW4gbG9jYWxpemF0aW9uIGlzIGVuYWJsZWQgd2l0aCBhIHNpbmdsZSBsb2NhbGUsIGZvcmNlIGEgZmxhdCBwYXRoIHRvIG1haW50YWluIGJlaGF2aW9yIHdpdGggdGhlIGV4aXN0aW5nIFdlYnBhY2stYmFzZWQgZGV2IHNlcnZlci5cbiAgICBicm93c2VyT3B0aW9ucy5mb3JjZUkxOG5GbGF0T3V0cHV0ID0gdHJ1ZTtcbiAgfVxuXG4gIC8vIFNldHVwIHRoZSBwcmVidW5kbGluZyB0cmFuc2Zvcm1lciB0aGF0IHdpbGwgYmUgc2hhcmVkIGFjcm9zcyBWaXRlIHByZWJ1bmRsaW5nIHJlcXVlc3RzXG4gIGNvbnN0IHByZWJ1bmRsZVRyYW5zZm9ybWVyID0gbmV3IEphdmFTY3JpcHRUcmFuc2Zvcm1lcihcbiAgICAvLyBBbHdheXMgZW5hYmxlIEpJVCBsaW5raW5nIHRvIHN1cHBvcnQgYXBwbGljYXRpb25zIGJ1aWx0IHdpdGggYW5kIHdpdGhvdXQgQU9ULlxuICAgIC8vIEluIGEgZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnQgdGhlIGFkZGl0aW9uYWwgc2NvcGUgaW5mb3JtYXRpb24gZG9lcyBub3RcbiAgICAvLyBoYXZlIGEgbmVnYXRpdmUgZWZmZWN0IHVubGlrZSBwcm9kdWN0aW9uIHdoZXJlIGZpbmFsIG91dHB1dCBzaXplIGlzIHJlbGV2YW50LlxuICAgIHsgc291cmNlbWFwOiB0cnVlLCBqaXQ6IHRydWUgfSxcbiAgICAxLFxuICApO1xuXG4gIC8vIEV4dHJhY3Qgb3V0cHV0IGluZGV4IGZyb20gb3B0aW9uc1xuICAvLyBUT0RPOiBQcm92aWRlIHRoaXMgaW5mbyBmcm9tIHRoZSBidWlsZCByZXN1bHRzXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IGh0bWxJbmRleFBhdGggPSBnZXRJbmRleE91dHB1dEZpbGUoYnJvd3Nlck9wdGlvbnMuaW5kZXggYXMgYW55KTtcblxuICAvLyBkeW5hbWljYWxseSBpbXBvcnQgVml0ZSBmb3IgRVNNIGNvbXBhdGliaWxpdHlcbiAgY29uc3QgeyBjcmVhdGVTZXJ2ZXIsIG5vcm1hbGl6ZVBhdGggfSA9IGF3YWl0IGltcG9ydCgndml0ZScpO1xuXG4gIGxldCBzZXJ2ZXI6IFZpdGVEZXZTZXJ2ZXIgfCB1bmRlZmluZWQ7XG4gIGxldCBsaXN0ZW5pbmdBZGRyZXNzOiBBZGRyZXNzSW5mbyB8IHVuZGVmaW5lZDtcbiAgY29uc3QgZ2VuZXJhdGVkRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4oKTtcbiAgY29uc3QgYXNzZXRGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIC8vIFRPRE86IFN3aXRjaCB0aGlzIHRvIGFuIGFyY2hpdGVjdCBzY2hlZHVsZSBjYWxsIHdoZW4gaW5mcmFzdHJ1Y3R1cmUgc2V0dGluZ3MgYXJlIHN1cHBvcnRlZFxuICBmb3IgYXdhaXQgKGNvbnN0IHJlc3VsdCBvZiBidWlsZEVzYnVpbGRCcm93c2VyKGJyb3dzZXJPcHRpb25zLCBjb250ZXh0LCB7XG4gICAgd3JpdGU6IGZhbHNlLFxuICB9KSkge1xuICAgIGFzc2VydChyZXN1bHQub3V0cHV0RmlsZXMsICdCdWlsZGVyIGRpZCBub3QgcHJvdmlkZSByZXN1bHQgZmlsZXMuJyk7XG5cbiAgICAvLyBBbmFseXplIHJlc3VsdCBmaWxlcyBmb3IgY2hhbmdlc1xuICAgIGFuYWx5emVSZXN1bHRGaWxlcyhub3JtYWxpemVQYXRoLCBodG1sSW5kZXhQYXRoLCByZXN1bHQub3V0cHV0RmlsZXMsIGdlbmVyYXRlZEZpbGVzKTtcblxuICAgIGFzc2V0RmlsZXMuY2xlYXIoKTtcbiAgICBpZiAocmVzdWx0LmFzc2V0RmlsZXMpIHtcbiAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgcmVzdWx0LmFzc2V0RmlsZXMpIHtcbiAgICAgICAgYXNzZXRGaWxlcy5zZXQoJy8nICsgbm9ybWFsaXplUGF0aChhc3NldC5kZXN0aW5hdGlvbiksIGFzc2V0LnNvdXJjZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNlcnZlcikge1xuICAgICAgaGFuZGxlVXBkYXRlKGdlbmVyYXRlZEZpbGVzLCBzZXJ2ZXIsIHNlcnZlck9wdGlvbnMsIGNvbnRleHQubG9nZ2VyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gU2V0dXAgc2VydmVyIGFuZCBzdGFydCBsaXN0ZW5pbmdcbiAgICAgIGNvbnN0IHNlcnZlckNvbmZpZ3VyYXRpb24gPSBhd2FpdCBzZXR1cFNlcnZlcihcbiAgICAgICAgc2VydmVyT3B0aW9ucyxcbiAgICAgICAgZ2VuZXJhdGVkRmlsZXMsXG4gICAgICAgIGFzc2V0RmlsZXMsXG4gICAgICAgIGJyb3dzZXJPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICAgIGJyb3dzZXJPcHRpb25zLmV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgICAgICAhIWJyb3dzZXJPcHRpb25zLnNzcixcbiAgICAgICAgcHJlYnVuZGxlVHJhbnNmb3JtZXIsXG4gICAgICApO1xuXG4gICAgICBzZXJ2ZXIgPSBhd2FpdCBjcmVhdGVTZXJ2ZXIoc2VydmVyQ29uZmlndXJhdGlvbik7XG5cbiAgICAgIGF3YWl0IHNlcnZlci5saXN0ZW4oKTtcbiAgICAgIGxpc3RlbmluZ0FkZHJlc3MgPSBzZXJ2ZXIuaHR0cFNlcnZlcj8uYWRkcmVzcygpIGFzIEFkZHJlc3NJbmZvO1xuXG4gICAgICAvLyBsb2cgY29ubmVjdGlvbiBpbmZvcm1hdGlvblxuICAgICAgc2VydmVyLnByaW50VXJscygpO1xuICAgIH1cblxuICAgIC8vIFRPRE86IGFkanVzdCBvdXRwdXQgdHlwaW5ncyB0byByZWZsZWN0IGJvdGggZGV2ZWxvcG1lbnQgc2VydmVyc1xuICAgIHlpZWxkIHsgc3VjY2VzczogdHJ1ZSwgcG9ydDogbGlzdGVuaW5nQWRkcmVzcz8ucG9ydCB9IGFzIHVua25vd24gYXMgRGV2U2VydmVyQnVpbGRlck91dHB1dDtcbiAgfVxuXG4gIC8vIEFkZCBjbGVhbnVwIGxvZ2ljIHZpYSBhIGJ1aWxkZXIgdGVhcmRvd25cbiAgbGV0IGRlZmVycmVkOiAoKSA9PiB2b2lkO1xuICBjb250ZXh0LmFkZFRlYXJkb3duKGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBzZXJ2ZXI/LmNsb3NlKCk7XG4gICAgYXdhaXQgcHJlYnVuZGxlVHJhbnNmb3JtZXIuY2xvc2UoKTtcbiAgICBkZWZlcnJlZD8uKCk7XG4gIH0pO1xuICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4gKGRlZmVycmVkID0gcmVzb2x2ZSkpO1xufVxuXG5mdW5jdGlvbiBoYW5kbGVVcGRhdGUoXG4gIGdlbmVyYXRlZEZpbGVzOiBNYXA8c3RyaW5nLCBPdXRwdXRGaWxlUmVjb3JkPixcbiAgc2VydmVyOiBWaXRlRGV2U2VydmVyLFxuICBzZXJ2ZXJPcHRpb25zOiBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyxcbiAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSxcbik6IHZvaWQge1xuICBjb25zdCB1cGRhdGVkRmlsZXM6IHN0cmluZ1tdID0gW107XG5cbiAgLy8gSW52YWxpZGF0ZSBhbnkgdXBkYXRlZCBmaWxlc1xuICBmb3IgKGNvbnN0IFtmaWxlLCByZWNvcmRdIG9mIGdlbmVyYXRlZEZpbGVzKSB7XG4gICAgaWYgKHJlY29yZC51cGRhdGVkKSB7XG4gICAgICB1cGRhdGVkRmlsZXMucHVzaChmaWxlKTtcbiAgICAgIGNvbnN0IHVwZGF0ZWRNb2R1bGVzID0gc2VydmVyLm1vZHVsZUdyYXBoLmdldE1vZHVsZXNCeUZpbGUoZmlsZSk7XG4gICAgICB1cGRhdGVkTW9kdWxlcz8uZm9yRWFjaCgobSkgPT4gc2VydmVyPy5tb2R1bGVHcmFwaC5pbnZhbGlkYXRlTW9kdWxlKG0pKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIXVwZGF0ZWRGaWxlcy5sZW5ndGgpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoc2VydmVyT3B0aW9ucy5saXZlUmVsb2FkIHx8IHNlcnZlck9wdGlvbnMuaG1yKSB7XG4gICAgaWYgKHVwZGF0ZWRGaWxlcy5ldmVyeSgoZikgPT4gZi5lbmRzV2l0aCgnLmNzcycpKSkge1xuICAgICAgY29uc3QgdGltZXN0YW1wID0gRGF0ZS5ub3coKTtcbiAgICAgIHNlcnZlci53cy5zZW5kKHtcbiAgICAgICAgdHlwZTogJ3VwZGF0ZScsXG4gICAgICAgIHVwZGF0ZXM6IHVwZGF0ZWRGaWxlcy5tYXAoKGYpID0+IHtcbiAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGYuc2xpY2UoMSk7IC8vIFJlbW92ZSBsZWFkaW5nIHNsYXNoLlxuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6ICdjc3MtdXBkYXRlJyxcbiAgICAgICAgICAgIHRpbWVzdGFtcCxcbiAgICAgICAgICAgIHBhdGg6IGZpbGVQYXRoLFxuICAgICAgICAgICAgYWNjZXB0ZWRQYXRoOiBmaWxlUGF0aCxcbiAgICAgICAgICB9O1xuICAgICAgICB9KSxcbiAgICAgIH0pO1xuXG4gICAgICBsb2dnZXIuaW5mbygnSE1SIHVwZGF0ZSBzZW50IHRvIGNsaWVudChzKS4uLicpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG5cbiAgLy8gU2VuZCByZWxvYWQgY29tbWFuZCB0byBjbGllbnRzXG4gIGlmIChzZXJ2ZXJPcHRpb25zLmxpdmVSZWxvYWQpIHtcbiAgICBsb2dnZXIuaW5mbygnUmVsb2FkaW5nIGNsaWVudChzKS4uLicpO1xuXG4gICAgc2VydmVyLndzLnNlbmQoe1xuICAgICAgdHlwZTogJ2Z1bGwtcmVsb2FkJyxcbiAgICAgIHBhdGg6ICcqJyxcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhbmFseXplUmVzdWx0RmlsZXMoXG4gIG5vcm1hbGl6ZVBhdGg6IChpZDogc3RyaW5nKSA9PiBzdHJpbmcsXG4gIGh0bWxJbmRleFBhdGg6IHN0cmluZyxcbiAgcmVzdWx0RmlsZXM6IE91dHB1dEZpbGVbXSxcbiAgZ2VuZXJhdGVkRmlsZXM6IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+LFxuKSB7XG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oWycvaW5kZXguaHRtbCddKTtcbiAgZm9yIChjb25zdCBmaWxlIG9mIHJlc3VsdEZpbGVzKSB7XG4gICAgbGV0IGZpbGVQYXRoO1xuICAgIGlmIChmaWxlLnBhdGggPT09IGh0bWxJbmRleFBhdGgpIHtcbiAgICAgIC8vIENvbnZlcnQgY3VzdG9tIGluZGV4IG91dHB1dCBwYXRoIHRvIHN0YW5kYXJkIGluZGV4IHBhdGggZm9yIGRldi1zZXJ2ZXIgdXNhZ2UuXG4gICAgICAvLyBUaGlzIG1pbWljcyB0aGUgV2VicGFjayBkZXYtc2VydmVyIGJlaGF2aW9yLlxuICAgICAgZmlsZVBhdGggPSAnL2luZGV4Lmh0bWwnO1xuICAgIH0gZWxzZSB7XG4gICAgICBmaWxlUGF0aCA9ICcvJyArIG5vcm1hbGl6ZVBhdGgoZmlsZS5wYXRoKTtcbiAgICB9XG4gICAgc2Vlbi5hZGQoZmlsZVBhdGgpO1xuXG4gICAgLy8gU2tpcCBhbmFseXNpcyBvZiBzb3VyY2VtYXBzXG4gICAgaWYgKGZpbGVQYXRoLmVuZHNXaXRoKCcubWFwJykpIHtcbiAgICAgIGdlbmVyYXRlZEZpbGVzLnNldChmaWxlUGF0aCwge1xuICAgICAgICBjb250ZW50czogZmlsZS5jb250ZW50cyxcbiAgICAgICAgc2l6ZTogZmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoLFxuICAgICAgICB1cGRhdGVkOiBmYWxzZSxcbiAgICAgIH0pO1xuXG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBsZXQgZmlsZUhhc2g6IEJ1ZmZlciB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCBleGlzdGluZ1JlY29yZCA9IGdlbmVyYXRlZEZpbGVzLmdldChmaWxlUGF0aCk7XG4gICAgaWYgKGV4aXN0aW5nUmVjb3JkICYmIGV4aXN0aW5nUmVjb3JkLnNpemUgPT09IGZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCkge1xuICAgICAgLy8gT25seSBoYXNoIGV4aXN0aW5nIGZpbGUgd2hlbiBuZWVkZWRcbiAgICAgIGlmIChleGlzdGluZ1JlY29yZC5oYXNoID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZXhpc3RpbmdSZWNvcmQuaGFzaCA9IGhhc2hDb250ZW50KGV4aXN0aW5nUmVjb3JkLmNvbnRlbnRzKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ29tcGFyZSBhZ2FpbnN0IGxhdGVzdCByZXN1bHQgb3V0cHV0XG4gICAgICBmaWxlSGFzaCA9IGhhc2hDb250ZW50KGZpbGUuY29udGVudHMpO1xuICAgICAgaWYgKGZpbGVIYXNoLmVxdWFscyhleGlzdGluZ1JlY29yZC5oYXNoKSkge1xuICAgICAgICAvLyBTYW1lIGZpbGVcbiAgICAgICAgZXhpc3RpbmdSZWNvcmQudXBkYXRlZCA9IGZhbHNlO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZWRGaWxlcy5zZXQoZmlsZVBhdGgsIHtcbiAgICAgIGNvbnRlbnRzOiBmaWxlLmNvbnRlbnRzLFxuICAgICAgc2l6ZTogZmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoLFxuICAgICAgaGFzaDogZmlsZUhhc2gsXG4gICAgICB1cGRhdGVkOiB0cnVlLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gQ2xlYXIgc3RhbGUgb3V0cHV0IGZpbGVzXG4gIGZvciAoY29uc3QgZmlsZSBvZiBnZW5lcmF0ZWRGaWxlcy5rZXlzKCkpIHtcbiAgICBpZiAoIXNlZW4uaGFzKGZpbGUpKSB7XG4gICAgICBnZW5lcmF0ZWRGaWxlcy5kZWxldGUoZmlsZSk7XG4gICAgfVxuICB9XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0dXBTZXJ2ZXIoXG4gIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zLFxuICBvdXRwdXRGaWxlczogTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4sXG4gIGFzc2V0czogTWFwPHN0cmluZywgc3RyaW5nPixcbiAgcHJlc2VydmVTeW1saW5rczogYm9vbGVhbiB8IHVuZGVmaW5lZCxcbiAgcHJlYnVuZGxlRXhjbHVkZTogc3RyaW5nW10gfCB1bmRlZmluZWQsXG4gIHNzcjogYm9vbGVhbixcbiAgcHJlYnVuZGxlVHJhbnNmb3JtZXI6IEphdmFTY3JpcHRUcmFuc2Zvcm1lcixcbik6IFByb21pc2U8SW5saW5lQ29uZmlnPiB7XG4gIGNvbnN0IHByb3h5ID0gYXdhaXQgbG9hZFByb3h5Q29uZmlndXJhdGlvbihcbiAgICBzZXJ2ZXJPcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgc2VydmVyT3B0aW9ucy5wcm94eUNvbmZpZyxcbiAgICB0cnVlLFxuICApO1xuXG4gIC8vIGR5bmFtaWNhbGx5IGltcG9ydCBWaXRlIGZvciBFU00gY29tcGF0aWJpbGl0eVxuICBjb25zdCB7IG5vcm1hbGl6ZVBhdGggfSA9IGF3YWl0IGltcG9ydCgndml0ZScpO1xuXG4gIGNvbnN0IGNvbmZpZ3VyYXRpb246IElubGluZUNvbmZpZyA9IHtcbiAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICBlbnZGaWxlOiBmYWxzZSxcbiAgICBjYWNoZURpcjogcGF0aC5qb2luKHNlcnZlck9wdGlvbnMuY2FjaGVPcHRpb25zLnBhdGgsICd2aXRlJyksXG4gICAgcm9vdDogc2VydmVyT3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIHB1YmxpY0RpcjogZmFsc2UsXG4gICAgZXNidWlsZDogZmFsc2UsXG4gICAgbW9kZTogJ2RldmVsb3BtZW50JyxcbiAgICBhcHBUeXBlOiAnc3BhJyxcbiAgICBjc3M6IHtcbiAgICAgIGRldlNvdXJjZW1hcDogdHJ1ZSxcbiAgICB9LFxuICAgIGJhc2U6IHNlcnZlck9wdGlvbnMuc2VydmVQYXRoLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgfSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHBvcnQ6IHNlcnZlck9wdGlvbnMucG9ydCxcbiAgICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgICBob3N0OiBzZXJ2ZXJPcHRpb25zLmhvc3QsXG4gICAgICBvcGVuOiBzZXJ2ZXJPcHRpb25zLm9wZW4sXG4gICAgICBoZWFkZXJzOiBzZXJ2ZXJPcHRpb25zLmhlYWRlcnMsXG4gICAgICBwcm94eSxcbiAgICAgIC8vIEN1cnJlbnRseSBkb2VzIG5vdCBhcHBlYXIgdG8gYmUgYSB3YXkgdG8gZGlzYWJsZSBmaWxlIHdhdGNoaW5nIGRpcmVjdGx5IHNvIGlnbm9yZSBhbGwgZmlsZXNcbiAgICAgIHdhdGNoOiB7XG4gICAgICAgIGlnbm9yZWQ6IFsnKiovKiddLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHNzcjoge1xuICAgICAgLy8gRXhjbHVkZSBhbnkgcHJvdmlkZWQgZGVwZW5kZW5jaWVzIChjdXJyZW50bHkgYnVpbGQgZGVmaW5lZCBleHRlcm5hbHMpXG4gICAgICBleHRlcm5hbDogcHJlYnVuZGxlRXhjbHVkZSxcbiAgICB9LFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZUFuZ3VsYXJMb2NhbGVEYXRhUGx1Z2luKCksXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICd2aXRlOmFuZ3VsYXItbWVtb3J5JyxcbiAgICAgICAgLy8gRW5zdXJlcyBwbHVnaW4gaG9va3MgcnVuIGJlZm9yZSBidWlsdC1pbiBWaXRlIGhvb2tzXG4gICAgICAgIGVuZm9yY2U6ICdwcmUnLFxuICAgICAgICBhc3luYyByZXNvbHZlSWQoc291cmNlLCBpbXBvcnRlcikge1xuICAgICAgICAgIGlmIChpbXBvcnRlciAmJiBzb3VyY2Uuc3RhcnRzV2l0aCgnLicpKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgcXVlcnkgaWYgcHJlc2VudFxuICAgICAgICAgICAgY29uc3QgW2ltcG9ydGVyRmlsZV0gPSBpbXBvcnRlci5zcGxpdCgnPycsIDEpO1xuXG4gICAgICAgICAgICBzb3VyY2UgPSBub3JtYWxpemVQYXRoKHBhdGguam9pbihwYXRoLmRpcm5hbWUoaW1wb3J0ZXJGaWxlKSwgc291cmNlKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgW2ZpbGVdID0gc291cmNlLnNwbGl0KCc/JywgMSk7XG4gICAgICAgICAgaWYgKG91dHB1dEZpbGVzLmhhcyhmaWxlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNvdXJjZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGxvYWQoaWQpIHtcbiAgICAgICAgICBjb25zdCBbZmlsZV0gPSBpZC5zcGxpdCgnPycsIDEpO1xuICAgICAgICAgIGNvbnN0IGNvZGVDb250ZW50cyA9IG91dHB1dEZpbGVzLmdldChmaWxlKT8uY29udGVudHM7XG4gICAgICAgICAgaWYgKGNvZGVDb250ZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgY29kZSA9IEJ1ZmZlci5mcm9tKGNvZGVDb250ZW50cykudG9TdHJpbmcoJ3V0Zi04Jyk7XG4gICAgICAgICAgY29uc3QgbWFwQ29udGVudHMgPSBvdXRwdXRGaWxlcy5nZXQoZmlsZSArICcubWFwJyk/LmNvbnRlbnRzO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBzb3VyY2UgbWFwIFVSTCBjb21tZW50cyBmcm9tIHRoZSBjb2RlIGlmIGEgc291cmNlbWFwIGlzIHByZXNlbnQuXG4gICAgICAgICAgICAvLyBWaXRlIHdpbGwgaW5saW5lIGFuZCBhZGQgYW4gYWRkaXRpb25hbCBzb3VyY2VtYXAgVVJMIGZvciB0aGUgc291cmNlbWFwLlxuICAgICAgICAgICAgY29kZTogbWFwQ29udGVudHMgPyBjb2RlLnJlcGxhY2UoL15cXC9cXC8jIHNvdXJjZU1hcHBpbmdVUkw9W15cXHJcXG5dKi9nbSwgJycpIDogY29kZSxcbiAgICAgICAgICAgIG1hcDogbWFwQ29udGVudHMgJiYgQnVmZmVyLmZyb20obWFwQ29udGVudHMpLnRvU3RyaW5nKCd1dGYtOCcpLFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgICAgICAvLyBBc3NldHMgYW5kIHJlc291cmNlcyBnZXQgaGFuZGxlZCBmaXJzdFxuICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoZnVuY3Rpb24gYW5ndWxhckFzc2V0c01pZGRsZXdhcmUocmVxLCByZXMsIG5leHQpIHtcbiAgICAgICAgICAgIGlmIChyZXEudXJsID09PSB1bmRlZmluZWQgfHwgcmVzLndyaXRhYmxlRW5kZWQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBQYXJzZSB0aGUgaW5jb21pbmcgcmVxdWVzdC5cbiAgICAgICAgICAgIC8vIFRoZSBiYXNlIG9mIHRoZSBVUkwgaXMgdW51c2VkIGJ1dCByZXF1aXJlZCB0byBwYXJzZSB0aGUgVVJMLlxuICAgICAgICAgICAgY29uc3QgcGF0aG5hbWUgPSBwYXRobmFtZVdpdGhvdXRTZXJ2ZVBhdGgocmVxLnVybCwgc2VydmVyT3B0aW9ucyk7XG4gICAgICAgICAgICBjb25zdCBleHRlbnNpb24gPSBwYXRoLmV4dG5hbWUocGF0aG5hbWUpO1xuXG4gICAgICAgICAgICAvLyBSZXdyaXRlIGFsbCBidWlsZCBhc3NldHMgdG8gYSB2aXRlIHJhdyBmcyBVUkxcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0U291cmNlUGF0aCA9IGFzc2V0cy5nZXQocGF0aG5hbWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0U291cmNlUGF0aCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIC8vIFRoZSBlbmNvZGluZyBuZWVkcyB0byBtYXRjaCB3aGF0IGhhcHBlbnMgaW4gdGhlIHZpdGUgc3RhdGljIG1pZGRsZXdhcmUuXG4gICAgICAgICAgICAgIC8vIHJlZjogaHR0cHM6Ly9naXRodWIuY29tL3ZpdGVqcy92aXRlL2Jsb2IvZDRmMTNiZDgxNDY4OTYxYzhjOTI2NDM4ZTgxNWFiNmIxYzgyNzM1ZS9wYWNrYWdlcy92aXRlL3NyYy9ub2RlL3NlcnZlci9taWRkbGV3YXJlcy9zdGF0aWMudHMjTDE2M1xuICAgICAgICAgICAgICByZXEudXJsID0gYC9AZnMvJHtlbmNvZGVVUkkoYXNzZXRTb3VyY2VQYXRoKX1gO1xuICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZXNvdXJjZSBmaWxlcyBhcmUgaGFuZGxlZCBkaXJlY3RseS5cbiAgICAgICAgICAgIC8vIEdsb2JhbCBzdHlsZXNoZWV0cyAoQ1NTIGZpbGVzKSBhcmUgY3VycmVudGx5IGNvbnNpZGVyZWQgcmVzb3VyY2VzIHRvIHdvcmthcm91bmRcbiAgICAgICAgICAgIC8vIGRldiBzZXJ2ZXIgc291cmNlbWFwIGlzc3VlcyB3aXRoIHN0eWxlc2hlZXRzLlxuICAgICAgICAgICAgaWYgKGV4dGVuc2lvbiAhPT0gJy5qcycgJiYgZXh0ZW5zaW9uICE9PSAnLmh0bWwnKSB7XG4gICAgICAgICAgICAgIGNvbnN0IG91dHB1dEZpbGUgPSBvdXRwdXRGaWxlcy5nZXQocGF0aG5hbWUpO1xuICAgICAgICAgICAgICBpZiAob3V0cHV0RmlsZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pbWVUeXBlID0gbG9va3VwTWltZVR5cGUoZXh0ZW5zaW9uKTtcbiAgICAgICAgICAgICAgICBpZiAobWltZVR5cGUpIHtcbiAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsIG1pbWVUeXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ2FjaGUtQ29udHJvbCcsICduby1jYWNoZScpO1xuICAgICAgICAgICAgICAgIGlmIChzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpIHtcbiAgICAgICAgICAgICAgICAgIE9iamVjdC5lbnRyaWVzKHNlcnZlck9wdGlvbnMuaGVhZGVycykuZm9yRWFjaCgoW25hbWUsIHZhbHVlXSkgPT5cbiAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihuYW1lLCB2YWx1ZSksXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMuZW5kKG91dHB1dEZpbGUuY29udGVudHMpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIFJldHVybmluZyBhIGZ1bmN0aW9uLCBpbnN0YWxscyBtaWRkbGV3YXJlIGFmdGVyIHRoZSBtYWluIHRyYW5zZm9ybSBtaWRkbGV3YXJlIGJ1dFxuICAgICAgICAgIC8vIGJlZm9yZSB0aGUgYnVpbHQtaW4gSFRNTCBtaWRkbGV3YXJlXG4gICAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICAgIGZ1bmN0aW9uIGFuZ3VsYXJTU1JNaWRkbGV3YXJlKFxuICAgICAgICAgICAgICByZXE6IENvbm5lY3QuSW5jb21pbmdNZXNzYWdlLFxuICAgICAgICAgICAgICByZXM6IFNlcnZlclJlc3BvbnNlLFxuICAgICAgICAgICAgICBuZXh0OiBDb25uZWN0Lk5leHRGdW5jdGlvbixcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICBjb25zdCB1cmwgPSByZXEub3JpZ2luYWxVcmw7XG4gICAgICAgICAgICAgIGlmICghdXJsIHx8IHVybC5lbmRzV2l0aCgnLmh0bWwnKSkge1xuICAgICAgICAgICAgICAgIG5leHQoKTtcblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IHBvdGVudGlhbFByZXJlbmRlcmVkID0gb3V0cHV0RmlsZXMuZ2V0KHBvc2l4LmpvaW4odXJsLCAnaW5kZXguaHRtbCcpKT8uY29udGVudHM7XG4gICAgICAgICAgICAgIGlmIChwb3RlbnRpYWxQcmVyZW5kZXJlZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBCdWZmZXIuZnJvbShwb3RlbnRpYWxQcmVyZW5kZXJlZCkudG9TdHJpbmcoJ3V0Zi04Jyk7XG4gICAgICAgICAgICAgICAgaWYgKFNTR19NQVJLRVJfUkVHRVhQLnRlc3QoY29udGVudCkpIHtcbiAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybUluZGV4SHRtbEFuZEFkZEhlYWRlcnModXJsLCBwb3RlbnRpYWxQcmVyZW5kZXJlZCwgcmVzLCBuZXh0KTtcblxuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IHJhd0h0bWwgPSBvdXRwdXRGaWxlcy5nZXQoJy9pbmRleC5zZXJ2ZXIuaHRtbCcpPy5jb250ZW50cztcbiAgICAgICAgICAgICAgaWYgKCFyYXdIdG1sKSB7XG4gICAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgdHJhbnNmb3JtSW5kZXhIdG1sQW5kQWRkSGVhZGVycyh1cmwsIHJhd0h0bWwsIHJlcywgbmV4dCwgYXN5bmMgKGh0bWwpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IHJlbmRlclBhZ2Uoe1xuICAgICAgICAgICAgICAgICAgZG9jdW1lbnQ6IGh0bWwsXG4gICAgICAgICAgICAgICAgICByb3V0ZTogcGF0aG5hbWVXaXRob3V0U2VydmVQYXRoKHVybCwgc2VydmVyT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgICBzZXJ2ZXJDb250ZXh0OiAnc3NyJyxcbiAgICAgICAgICAgICAgICAgIGxvYWRCdW5kbGU6IChwYXRoOiBzdHJpbmcpID0+XG4gICAgICAgICAgICAgICAgICAgIHNlcnZlci5zc3JMb2FkTW9kdWxlKHBhdGguc2xpY2UoMSkpIGFzIFJldHVyblR5cGU8XG4gICAgICAgICAgICAgICAgICAgICAgTm9uTnVsbGFibGU8UmVuZGVyT3B0aW9uc1snbG9hZEJ1bmRsZSddPlxuICAgICAgICAgICAgICAgICAgICA+LFxuICAgICAgICAgICAgICAgICAgLy8gRmlsZXMgaGVyZSBhcmUgb25seSBuZWVkZWQgZm9yIGNyaXRpY2FsIENTUyBpbmxpbmluZy5cbiAgICAgICAgICAgICAgICAgIG91dHB1dEZpbGVzOiB7fSxcbiAgICAgICAgICAgICAgICAgIC8vIFRPRE86IGFkZCBzdXBwb3J0IGZvciBjcml0aWNhbCBjc3MgaW5saW5pbmcuXG4gICAgICAgICAgICAgICAgICBpbmxpbmVDcml0aWNhbENzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gY29udGVudDtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzc3IpIHtcbiAgICAgICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShhbmd1bGFyU1NSTWlkZGxld2FyZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoZnVuY3Rpb24gYW5ndWxhckluZGV4TWlkZGxld2FyZShyZXEsIHJlcywgbmV4dCkge1xuICAgICAgICAgICAgICBpZiAoIXJlcS51cmwpIHtcbiAgICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBQYXJzZSB0aGUgaW5jb21pbmcgcmVxdWVzdC5cbiAgICAgICAgICAgICAgLy8gVGhlIGJhc2Ugb2YgdGhlIFVSTCBpcyB1bnVzZWQgYnV0IHJlcXVpcmVkIHRvIHBhcnNlIHRoZSBVUkwuXG4gICAgICAgICAgICAgIGNvbnN0IHBhdGhuYW1lID0gcGF0aG5hbWVXaXRob3V0U2VydmVQYXRoKHJlcS51cmwsIHNlcnZlck9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgIGlmIChwYXRobmFtZSA9PT0gJy8nIHx8IHBhdGhuYW1lID09PSBgL2luZGV4Lmh0bWxgKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3SHRtbCA9IG91dHB1dEZpbGVzLmdldCgnL2luZGV4Lmh0bWwnKT8uY29udGVudHM7XG4gICAgICAgICAgICAgICAgaWYgKHJhd0h0bWwpIHtcbiAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybUluZGV4SHRtbEFuZEFkZEhlYWRlcnMocmVxLnVybCwgcmF3SHRtbCwgcmVzLCBuZXh0KTtcblxuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICBmdW5jdGlvbiB0cmFuc2Zvcm1JbmRleEh0bWxBbmRBZGRIZWFkZXJzKFxuICAgICAgICAgICAgdXJsOiBzdHJpbmcsXG4gICAgICAgICAgICByYXdIdG1sOiBVaW50OEFycmF5LFxuICAgICAgICAgICAgcmVzOiBTZXJ2ZXJSZXNwb25zZTxpbXBvcnQoJ2h0dHAnKS5JbmNvbWluZ01lc3NhZ2U+LFxuICAgICAgICAgICAgbmV4dDogQ29ubmVjdC5OZXh0RnVuY3Rpb24sXG4gICAgICAgICAgICBhZGRpdGlvbmFsVHJhbnNmb3JtZXI/OiAoaHRtbDogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4sXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBzZXJ2ZXJcbiAgICAgICAgICAgICAgLnRyYW5zZm9ybUluZGV4SHRtbCh1cmwsIEJ1ZmZlci5mcm9tKHJhd0h0bWwpLnRvU3RyaW5nKCd1dGYtOCcpKVxuICAgICAgICAgICAgICAudGhlbihhc3luYyAocHJvY2Vzc2VkSHRtbCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChhZGRpdGlvbmFsVHJhbnNmb3JtZXIpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBhZGRpdGlvbmFsVHJhbnNmb3JtZXIocHJvY2Vzc2VkSHRtbCk7XG4gICAgICAgICAgICAgICAgICBpZiAoIWNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgcHJvY2Vzc2VkSHRtbCA9IGNvbnRlbnQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ3RleHQvaHRtbCcpO1xuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NhY2hlLUNvbnRyb2wnLCAnbm8tY2FjaGUnKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VydmVyT3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyhzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpLmZvckVhY2goKFtuYW1lLCB2YWx1ZV0pID0+XG4gICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIobmFtZSwgdmFsdWUpLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzLmVuZChwcm9jZXNzZWRIdG1sKTtcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcikgPT4gbmV4dChlcnJvcikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgXSxcbiAgICBvcHRpbWl6ZURlcHM6IHtcbiAgICAgIC8vIE9ubHkgZW5hYmxlIHdpdGggY2FjaGluZyBzaW5jZSBpdCBjYXVzZXMgcHJlYnVuZGxlIGRlcGVuZGVuY2llcyB0byBiZSBjYWNoZWRcbiAgICAgIGRpc2FibGVkOiAhc2VydmVyT3B0aW9ucy5jYWNoZU9wdGlvbnMuZW5hYmxlZCxcbiAgICAgIC8vIEV4Y2x1ZGUgYW55IHByb3ZpZGVkIGRlcGVuZGVuY2llcyAoY3VycmVudGx5IGJ1aWxkIGRlZmluZWQgZXh0ZXJuYWxzKVxuICAgICAgZXhjbHVkZTogcHJlYnVuZGxlRXhjbHVkZSxcbiAgICAgIC8vIFNraXAgYXV0b21hdGljIGZpbGUtYmFzZWQgZW50cnkgcG9pbnQgZGlzY292ZXJ5XG4gICAgICBlbnRyaWVzOiBbXSxcbiAgICAgIC8vIEFkZCBhbiBlc2J1aWxkIHBsdWdpbiB0byBydW4gdGhlIEFuZ3VsYXIgbGlua2VyIG9uIGRlcGVuZGVuY2llc1xuICAgICAgZXNidWlsZE9wdGlvbnM6IHtcbiAgICAgICAgcGx1Z2luczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdhbmd1bGFyLXZpdGUtb3B0aW1pemUtZGVwcycsXG4gICAgICAgICAgICBzZXR1cChidWlsZCkge1xuICAgICAgICAgICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5bY21dP2pzJC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgY29udGVudHM6IGF3YWl0IHByZWJ1bmRsZVRyYW5zZm9ybWVyLnRyYW5zZm9ybUZpbGUoYXJncy5wYXRoKSxcbiAgICAgICAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcblxuICBpZiAoc2VydmVyT3B0aW9ucy5zc2wpIHtcbiAgICBpZiAoc2VydmVyT3B0aW9ucy5zc2xDZXJ0ICYmIHNlcnZlck9wdGlvbnMuc3NsS2V5KSB7XG4gICAgICAvLyBzZXJ2ZXIgY29uZmlndXJhdGlvbiBpcyBkZWZpbmVkIGFib3ZlXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgY29uZmlndXJhdGlvbi5zZXJ2ZXIhLmh0dHBzID0ge1xuICAgICAgICBjZXJ0OiBhd2FpdCByZWFkRmlsZShzZXJ2ZXJPcHRpb25zLnNzbENlcnQpLFxuICAgICAgICBrZXk6IGF3YWl0IHJlYWRGaWxlKHNlcnZlck9wdGlvbnMuc3NsS2V5KSxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHsgZGVmYXVsdDogYmFzaWNTc2xQbHVnaW4gfSA9IGF3YWl0IGltcG9ydCgnQHZpdGVqcy9wbHVnaW4tYmFzaWMtc3NsJyk7XG4gICAgICBjb25maWd1cmF0aW9uLnBsdWdpbnMgPz89IFtdO1xuICAgICAgY29uZmlndXJhdGlvbi5wbHVnaW5zLnB1c2goYmFzaWNTc2xQbHVnaW4oKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGNvbmZpZ3VyYXRpb247XG59XG5cbmZ1bmN0aW9uIHBhdGhuYW1lV2l0aG91dFNlcnZlUGF0aCh1cmw6IHN0cmluZywgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMpOiBzdHJpbmcge1xuICBjb25zdCBwYXJzZWRVcmwgPSBuZXcgVVJMKHVybCwgJ2h0dHA6Ly9sb2NhbGhvc3QnKTtcbiAgbGV0IHBhdGhuYW1lID0gZGVjb2RlVVJJQ29tcG9uZW50KHBhcnNlZFVybC5wYXRobmFtZSk7XG4gIGlmIChzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCAmJiBwYXRobmFtZS5zdGFydHNXaXRoKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoKSkge1xuICAgIHBhdGhuYW1lID0gcGF0aG5hbWUuc2xpY2Uoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgubGVuZ3RoKTtcbiAgICBpZiAocGF0aG5hbWVbMF0gIT09ICcvJykge1xuICAgICAgcGF0aG5hbWUgPSAnLycgKyBwYXRobmFtZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcGF0aG5hbWU7XG59XG4iXX0=