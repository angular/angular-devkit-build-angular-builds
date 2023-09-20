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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3ZpdGUtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0gsbUNBQWtEO0FBQ2xELDhEQUFpQztBQUNqQyw2Q0FBcUQ7QUFDckQsK0NBQTRDO0FBRzVDLHVEQUF3QztBQUV4Qyx1RkFBbUY7QUFDbkYsMEVBQXFGO0FBQ3JGLCtFQUF3RTtBQUN4RSx3REFBeUQ7QUFFekQsMkRBQTZEO0FBVzdELE1BQU0saUJBQWlCLEdBQUcsMkNBQTJDLENBQUM7QUFFdEUsU0FBUyxXQUFXLENBQUMsUUFBb0I7SUFDdkMsd0JBQXdCO0lBQ3hCLE9BQU8sSUFBQSx3QkFBVSxFQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUN4RCxDQUFDO0FBRU0sS0FBSyxTQUFTLENBQUMsQ0FBQyxhQUFhLENBQ2xDLGFBQXlDLEVBQ3pDLFdBQW1CLEVBQ25CLE9BQXVCO0lBRXZCLHNEQUFzRDtJQUN0RCxNQUFNLGlCQUFpQixHQUFHLENBQUMsTUFBTSxPQUFPLENBQUMsZ0JBQWdCLENBQ3ZELGFBQWEsQ0FBQyxhQUFhLENBQzVCLENBQTRDLENBQUM7SUFFOUMsTUFBTSxjQUFjLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQ25EO1FBQ0UsR0FBRyxpQkFBaUI7UUFDcEIsS0FBSyxFQUFFLGFBQWEsQ0FBQyxLQUFLO1FBQzFCLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSTtRQUN4QixPQUFPLEVBQUUsYUFBYSxDQUFDLE9BQU87S0FDWSxFQUM1QyxXQUFXLENBQ1osQ0FBNEMsQ0FBQztJQUM5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Q0FrU0M7QUFFRCxTQUFTLHdCQUF3QixDQUFDLEdBQVcsRUFBRSxhQUF5QztJQUN0RixNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUNuRCxJQUFJLFFBQVEsR0FBRyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDdEQsSUFBSSxhQUFhLENBQUMsU0FBUyxJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1FBQzNFLFFBQVEsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDMUQsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1lBQ3ZCLFFBQVEsR0FBRyxHQUFHLEdBQUcsUUFBUSxDQUFDO1NBQzNCO0tBQ0Y7SUFFRCxPQUFPLFFBQVEsQ0FBQztBQUNsQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB0eXBlIHsganNvbiwgbG9nZ2luZyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB0eXBlIHsgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgbG9va3VwIGFzIGxvb2t1cE1pbWVUeXBlIH0gZnJvbSAnbXJtaW1lJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgQmluYXJ5TGlrZSwgY3JlYXRlSGFzaCB9IGZyb20gJ25vZGU6Y3J5cHRvJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBTZXJ2ZXJSZXNwb25zZSB9IGZyb20gJ25vZGU6aHR0cCc7XG5pbXBvcnQgdHlwZSB7IEFkZHJlc3NJbmZvIH0gZnJvbSAnbm9kZTpuZXQnO1xuaW1wb3J0IHBhdGgsIHsgcG9zaXggfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHR5cGUgeyBDb25uZWN0LCBJbmxpbmVDb25maWcsIFZpdGVEZXZTZXJ2ZXIgfSBmcm9tICd2aXRlJztcbmltcG9ydCB7IEphdmFTY3JpcHRUcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvamF2YXNjcmlwdC10cmFuc2Zvcm1lcic7XG5pbXBvcnQgeyBSZW5kZXJPcHRpb25zLCByZW5kZXJQYWdlIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2VydmVyLXJlbmRlcmluZy9yZW5kZXItcGFnZSc7XG5pbXBvcnQgeyBnZXRJbmRleE91dHB1dEZpbGUgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IGJ1aWxkRXNidWlsZEJyb3dzZXIgfSBmcm9tICcuLi9icm93c2VyLWVzYnVpbGQnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4uL2Jyb3dzZXItZXNidWlsZC9zY2hlbWEnO1xuaW1wb3J0IHsgbG9hZFByb3h5Q29uZmlndXJhdGlvbiB9IGZyb20gJy4vbG9hZC1wcm94eS1jb25maWcnO1xuaW1wb3J0IHR5cGUgeyBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgdHlwZSB7IERldlNlcnZlckJ1aWxkZXJPdXRwdXQgfSBmcm9tICcuL3dlYnBhY2stc2VydmVyJztcblxuaW50ZXJmYWNlIE91dHB1dEZpbGVSZWNvcmQge1xuICBjb250ZW50czogVWludDhBcnJheTtcbiAgc2l6ZTogbnVtYmVyO1xuICBoYXNoPzogQnVmZmVyO1xuICB1cGRhdGVkOiBib29sZWFuO1xufVxuXG5jb25zdCBTU0dfTUFSS0VSX1JFR0VYUCA9IC9uZy1zZXJ2ZXItY29udGV4dD1bXCInXVxcdypcXHw/c3NnXFx8P1xcdypbXCInXS87XG5cbmZ1bmN0aW9uIGhhc2hDb250ZW50KGNvbnRlbnRzOiBCaW5hcnlMaWtlKTogQnVmZmVyIHtcbiAgLy8gVE9ETzogQ29uc2lkZXIgeHhoYXNoXG4gIHJldHVybiBjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoY29udGVudHMpLmRpZ2VzdCgpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24qIHNlcnZlV2l0aFZpdGUoXG4gIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zLFxuICBidWlsZGVyTmFtZTogc3RyaW5nLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IEFzeW5jSXRlcmFibGVJdGVyYXRvcjxEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0PiB7XG4gIC8vIEdldCB0aGUgYnJvd3NlciBjb25maWd1cmF0aW9uIGZyb20gdGhlIHRhcmdldCBuYW1lLlxuICBjb25zdCByYXdCcm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMoXG4gICAgc2VydmVyT3B0aW9ucy5icm93c2VyVGFyZ2V0LFxuICApKSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG5cbiAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC52YWxpZGF0ZU9wdGlvbnMoXG4gICAge1xuICAgICAgLi4ucmF3QnJvd3Nlck9wdGlvbnMsXG4gICAgICB3YXRjaDogc2VydmVyT3B0aW9ucy53YXRjaCxcbiAgICAgIHBvbGw6IHNlcnZlck9wdGlvbnMucG9sbCxcbiAgICAgIHZlcmJvc2U6IHNlcnZlck9wdGlvbnMudmVyYm9zZSxcbiAgICB9IGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgICBidWlsZGVyTmFtZSxcbiAgKSkgYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zO1xuICAvLyBTZXQgYWxsIHBhY2thZ2VzIGFzIGV4dGVybmFsIHRvIHN1cHBvcnQgVml0ZSdzIHByZWJ1bmRsZSBjYWNoaW5nXG4gIGJyb3dzZXJPcHRpb25zLmV4dGVybmFsUGFja2FnZXMgPSBzZXJ2ZXJPcHRpb25zLmNhY2hlT3B0aW9ucy5lbmFibGVkO1xuXG4gIGlmIChzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCA9PT0gdW5kZWZpbmVkICYmIGJyb3dzZXJPcHRpb25zLmJhc2VIcmVmICE9PSB1bmRlZmluZWQpIHtcbiAgICBzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCA9IGJyb3dzZXJPcHRpb25zLmJhc2VIcmVmO1xuICB9XG5cbiAgLy8gU2V0dXAgdGhlIHByZWJ1bmRsaW5nIHRyYW5zZm9ybWVyIHRoYXQgd2lsbCBiZSBzaGFyZWQgYWNyb3NzIFZpdGUgcHJlYnVuZGxpbmcgcmVxdWVzdHNcbiAgY29uc3QgcHJlYnVuZGxlVHJhbnNmb3JtZXIgPSBuZXcgSmF2YVNjcmlwdFRyYW5zZm9ybWVyKFxuICAgIC8vIEFsd2F5cyBlbmFibGUgSklUIGxpbmtpbmcgdG8gc3VwcG9ydCBhcHBsaWNhdGlvbnMgYnVpbHQgd2l0aCBhbmQgd2l0aG91dCBBT1QuXG4gICAgLy8gSW4gYSBkZXZlbG9wbWVudCBlbnZpcm9ubWVudCB0aGUgYWRkaXRpb25hbCBzY29wZSBpbmZvcm1hdGlvbiBkb2VzIG5vdFxuICAgIC8vIGhhdmUgYSBuZWdhdGl2ZSBlZmZlY3QgdW5saWtlIHByb2R1Y3Rpb24gd2hlcmUgZmluYWwgb3V0cHV0IHNpemUgaXMgcmVsZXZhbnQuXG4gICAgeyBzb3VyY2VtYXA6IHRydWUsIGppdDogdHJ1ZSB9LFxuICAgIDEsXG4gICk7XG5cbiAgLy8gRXh0cmFjdCBvdXRwdXQgaW5kZXggZnJvbSBvcHRpb25zXG4gIC8vIFRPRE86IFByb3ZpZGUgdGhpcyBpbmZvIGZyb20gdGhlIGJ1aWxkIHJlc3VsdHNcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgY29uc3QgaHRtbEluZGV4UGF0aCA9IGdldEluZGV4T3V0cHV0RmlsZShicm93c2VyT3B0aW9ucy5pbmRleCBhcyBhbnkpO1xuXG4gIC8vIGR5bmFtaWNhbGx5IGltcG9ydCBWaXRlIGZvciBFU00gY29tcGF0aWJpbGl0eVxuICBjb25zdCB7IGNyZWF0ZVNlcnZlciwgbm9ybWFsaXplUGF0aCB9ID0gYXdhaXQgaW1wb3J0KCd2aXRlJyk7XG5cbiAgbGV0IHNlcnZlcjogVml0ZURldlNlcnZlciB8IHVuZGVmaW5lZDtcbiAgbGV0IGxpc3RlbmluZ0FkZHJlc3M6IEFkZHJlc3NJbmZvIHwgdW5kZWZpbmVkO1xuICBjb25zdCBnZW5lcmF0ZWRGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBPdXRwdXRGaWxlUmVjb3JkPigpO1xuICBjb25zdCBhc3NldEZpbGVzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgLy8gVE9ETzogU3dpdGNoIHRoaXMgdG8gYW4gYXJjaGl0ZWN0IHNjaGVkdWxlIGNhbGwgd2hlbiBpbmZyYXN0cnVjdHVyZSBzZXR0aW5ncyBhcmUgc3VwcG9ydGVkXG4gIGZvciBhd2FpdCAoY29uc3QgcmVzdWx0IG9mIGJ1aWxkRXNidWlsZEJyb3dzZXIoYnJvd3Nlck9wdGlvbnMsIGNvbnRleHQsIHtcbiAgICB3cml0ZTogZmFsc2UsXG4gIH0pKSB7XG4gICAgYXNzZXJ0KHJlc3VsdC5vdXRwdXRGaWxlcywgJ0J1aWxkZXIgZGlkIG5vdCBwcm92aWRlIHJlc3VsdCBmaWxlcy4nKTtcblxuICAgIC8vIEFuYWx5emUgcmVzdWx0IGZpbGVzIGZvciBjaGFuZ2VzXG4gICAgYW5hbHl6ZVJlc3VsdEZpbGVzKG5vcm1hbGl6ZVBhdGgsIGh0bWxJbmRleFBhdGgsIHJlc3VsdC5vdXRwdXRGaWxlcywgZ2VuZXJhdGVkRmlsZXMpO1xuXG4gICAgYXNzZXRGaWxlcy5jbGVhcigpO1xuICAgIGlmIChyZXN1bHQuYXNzZXRGaWxlcykge1xuICAgICAgZm9yIChjb25zdCBhc3NldCBvZiByZXN1bHQuYXNzZXRGaWxlcykge1xuICAgICAgICBhc3NldEZpbGVzLnNldCgnLycgKyBub3JtYWxpemVQYXRoKGFzc2V0LmRlc3RpbmF0aW9uKSwgYXNzZXQuc291cmNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc2VydmVyKSB7XG4gICAgICBoYW5kbGVVcGRhdGUoZ2VuZXJhdGVkRmlsZXMsIHNlcnZlciwgc2VydmVyT3B0aW9ucywgY29udGV4dC5sb2dnZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTZXR1cCBzZXJ2ZXIgYW5kIHN0YXJ0IGxpc3RlbmluZ1xuICAgICAgY29uc3Qgc2VydmVyQ29uZmlndXJhdGlvbiA9IGF3YWl0IHNldHVwU2VydmVyKFxuICAgICAgICBzZXJ2ZXJPcHRpb25zLFxuICAgICAgICBnZW5lcmF0ZWRGaWxlcyxcbiAgICAgICAgYXNzZXRGaWxlcyxcbiAgICAgICAgYnJvd3Nlck9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgICAgYnJvd3Nlck9wdGlvbnMuZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgICAgICEhYnJvd3Nlck9wdGlvbnMuc3NyLFxuICAgICAgICBwcmVidW5kbGVUcmFuc2Zvcm1lcixcbiAgICAgICk7XG5cbiAgICAgIHNlcnZlciA9IGF3YWl0IGNyZWF0ZVNlcnZlcihzZXJ2ZXJDb25maWd1cmF0aW9uKTtcblxuICAgICAgYXdhaXQgc2VydmVyLmxpc3RlbigpO1xuICAgICAgbGlzdGVuaW5nQWRkcmVzcyA9IHNlcnZlci5odHRwU2VydmVyPy5hZGRyZXNzKCkgYXMgQWRkcmVzc0luZm87XG5cbiAgICAgIC8vIGxvZyBjb25uZWN0aW9uIGluZm9ybWF0aW9uXG4gICAgICBzZXJ2ZXIucHJpbnRVcmxzKCk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogYWRqdXN0IG91dHB1dCB0eXBpbmdzIHRvIHJlZmxlY3QgYm90aCBkZXZlbG9wbWVudCBzZXJ2ZXJzXG4gICAgeWllbGQgeyBzdWNjZXNzOiB0cnVlLCBwb3J0OiBsaXN0ZW5pbmdBZGRyZXNzPy5wb3J0IH0gYXMgdW5rbm93biBhcyBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0O1xuICB9XG5cbiAgLy8gQWRkIGNsZWFudXAgbG9naWMgdmlhIGEgYnVpbGRlciB0ZWFyZG93blxuICBsZXQgZGVmZXJyZWQ6ICgpID0+IHZvaWQ7XG4gIGNvbnRleHQuYWRkVGVhcmRvd24oYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IHNlcnZlcj8uY2xvc2UoKTtcbiAgICBhd2FpdCBwcmVidW5kbGVUcmFuc2Zvcm1lci5jbG9zZSgpO1xuICAgIGRlZmVycmVkPy4oKTtcbiAgfSk7XG4gIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiAoZGVmZXJyZWQgPSByZXNvbHZlKSk7XG59XG5cbmZ1bmN0aW9uIGhhbmRsZVVwZGF0ZShcbiAgZ2VuZXJhdGVkRmlsZXM6IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+LFxuICBzZXJ2ZXI6IFZpdGVEZXZTZXJ2ZXIsXG4gIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zLFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuKTogdm9pZCB7XG4gIGNvbnN0IHVwZGF0ZWRGaWxlczogc3RyaW5nW10gPSBbXTtcblxuICAvLyBJbnZhbGlkYXRlIGFueSB1cGRhdGVkIGZpbGVzXG4gIGZvciAoY29uc3QgW2ZpbGUsIHJlY29yZF0gb2YgZ2VuZXJhdGVkRmlsZXMpIHtcbiAgICBpZiAocmVjb3JkLnVwZGF0ZWQpIHtcbiAgICAgIHVwZGF0ZWRGaWxlcy5wdXNoKGZpbGUpO1xuICAgICAgY29uc3QgdXBkYXRlZE1vZHVsZXMgPSBzZXJ2ZXIubW9kdWxlR3JhcGguZ2V0TW9kdWxlc0J5RmlsZShmaWxlKTtcbiAgICAgIHVwZGF0ZWRNb2R1bGVzPy5mb3JFYWNoKChtKSA9PiBzZXJ2ZXI/Lm1vZHVsZUdyYXBoLmludmFsaWRhdGVNb2R1bGUobSkpO1xuICAgIH1cbiAgfVxuXG4gIGlmICghdXBkYXRlZEZpbGVzLmxlbmd0aCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChzZXJ2ZXJPcHRpb25zLmxpdmVSZWxvYWQgfHwgc2VydmVyT3B0aW9ucy5obXIpIHtcbiAgICBpZiAodXBkYXRlZEZpbGVzLmV2ZXJ5KChmKSA9PiBmLmVuZHNXaXRoKCcuY3NzJykpKSB7XG4gICAgICBjb25zdCB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuICAgICAgc2VydmVyLndzLnNlbmQoe1xuICAgICAgICB0eXBlOiAndXBkYXRlJyxcbiAgICAgICAgdXBkYXRlczogdXBkYXRlZEZpbGVzLm1hcCgoZikgPT4ge1xuICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gZi5zbGljZSgxKTsgLy8gUmVtb3ZlIGxlYWRpbmcgc2xhc2guXG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogJ2Nzcy11cGRhdGUnLFxuICAgICAgICAgICAgdGltZXN0YW1wLFxuICAgICAgICAgICAgcGF0aDogZmlsZVBhdGgsXG4gICAgICAgICAgICBhY2NlcHRlZFBhdGg6IGZpbGVQYXRoLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pLFxuICAgICAgfSk7XG5cbiAgICAgIGxvZ2dlci5pbmZvKCdITVIgdXBkYXRlIHNlbnQgdG8gY2xpZW50KHMpLi4uJyk7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cblxuICAvLyBTZW5kIHJlbG9hZCBjb21tYW5kIHRvIGNsaWVudHNcbiAgaWYgKHNlcnZlck9wdGlvbnMubGl2ZVJlbG9hZCkge1xuICAgIGxvZ2dlci5pbmZvKCdSZWxvYWRpbmcgY2xpZW50KHMpLi4uJyk7XG5cbiAgICBzZXJ2ZXIud3Muc2VuZCh7XG4gICAgICB0eXBlOiAnZnVsbC1yZWxvYWQnLFxuICAgICAgcGF0aDogJyonLFxuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFuYWx5emVSZXN1bHRGaWxlcyhcbiAgbm9ybWFsaXplUGF0aDogKGlkOiBzdHJpbmcpID0+IHN0cmluZyxcbiAgaHRtbEluZGV4UGF0aDogc3RyaW5nLFxuICByZXN1bHRGaWxlczogT3V0cHV0RmlsZVtdLFxuICBnZW5lcmF0ZWRGaWxlczogTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4sXG4pIHtcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPihbJy9pbmRleC5odG1sJ10pO1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgcmVzdWx0RmlsZXMpIHtcbiAgICBsZXQgZmlsZVBhdGg7XG4gICAgaWYgKGZpbGUucGF0aCA9PT0gaHRtbEluZGV4UGF0aCkge1xuICAgICAgLy8gQ29udmVydCBjdXN0b20gaW5kZXggb3V0cHV0IHBhdGggdG8gc3RhbmRhcmQgaW5kZXggcGF0aCBmb3IgZGV2LXNlcnZlciB1c2FnZS5cbiAgICAgIC8vIFRoaXMgbWltaWNzIHRoZSBXZWJwYWNrIGRldi1zZXJ2ZXIgYmVoYXZpb3IuXG4gICAgICBmaWxlUGF0aCA9ICcvaW5kZXguaHRtbCc7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZpbGVQYXRoID0gJy8nICsgbm9ybWFsaXplUGF0aChmaWxlLnBhdGgpO1xuICAgIH1cbiAgICBzZWVuLmFkZChmaWxlUGF0aCk7XG5cbiAgICAvLyBTa2lwIGFuYWx5c2lzIG9mIHNvdXJjZW1hcHNcbiAgICBpZiAoZmlsZVBhdGguZW5kc1dpdGgoJy5tYXAnKSkge1xuICAgICAgZ2VuZXJhdGVkRmlsZXMuc2V0KGZpbGVQYXRoLCB7XG4gICAgICAgIGNvbnRlbnRzOiBmaWxlLmNvbnRlbnRzLFxuICAgICAgICBzaXplOiBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgsXG4gICAgICAgIHVwZGF0ZWQ6IGZhbHNlLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGxldCBmaWxlSGFzaDogQnVmZmVyIHwgdW5kZWZpbmVkO1xuICAgIGNvbnN0IGV4aXN0aW5nUmVjb3JkID0gZ2VuZXJhdGVkRmlsZXMuZ2V0KGZpbGVQYXRoKTtcbiAgICBpZiAoZXhpc3RpbmdSZWNvcmQgJiYgZXhpc3RpbmdSZWNvcmQuc2l6ZSA9PT0gZmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoKSB7XG4gICAgICAvLyBPbmx5IGhhc2ggZXhpc3RpbmcgZmlsZSB3aGVuIG5lZWRlZFxuICAgICAgaWYgKGV4aXN0aW5nUmVjb3JkLmhhc2ggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBleGlzdGluZ1JlY29yZC5oYXNoID0gaGFzaENvbnRlbnQoZXhpc3RpbmdSZWNvcmQuY29udGVudHMpO1xuICAgICAgfVxuXG4gICAgICAvLyBDb21wYXJlIGFnYWluc3QgbGF0ZXN0IHJlc3VsdCBvdXRwdXRcbiAgICAgIGZpbGVIYXNoID0gaGFzaENvbnRlbnQoZmlsZS5jb250ZW50cyk7XG4gICAgICBpZiAoZmlsZUhhc2guZXF1YWxzKGV4aXN0aW5nUmVjb3JkLmhhc2gpKSB7XG4gICAgICAgIC8vIFNhbWUgZmlsZVxuICAgICAgICBleGlzdGluZ1JlY29yZC51cGRhdGVkID0gZmFsc2U7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGdlbmVyYXRlZEZpbGVzLnNldChmaWxlUGF0aCwge1xuICAgICAgY29udGVudHM6IGZpbGUuY29udGVudHMsXG4gICAgICBzaXplOiBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgsXG4gICAgICBoYXNoOiBmaWxlSGFzaCxcbiAgICAgIHVwZGF0ZWQ6IHRydWUsXG4gICAgfSk7XG4gIH1cblxuICAvLyBDbGVhciBzdGFsZSBvdXRwdXQgZmlsZXNcbiAgZm9yIChjb25zdCBmaWxlIG9mIGdlbmVyYXRlZEZpbGVzLmtleXMoKSkge1xuICAgIGlmICghc2Vlbi5oYXMoZmlsZSkpIHtcbiAgICAgIGdlbmVyYXRlZEZpbGVzLmRlbGV0ZShmaWxlKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXR1cFNlcnZlcihcbiAgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMsXG4gIG91dHB1dEZpbGVzOiBNYXA8c3RyaW5nLCBPdXRwdXRGaWxlUmVjb3JkPixcbiAgYXNzZXRzOiBNYXA8c3RyaW5nLCBzdHJpbmc+LFxuICBwcmVzZXJ2ZVN5bWxpbmtzOiBib29sZWFuIHwgdW5kZWZpbmVkLFxuICBwcmVidW5kbGVFeGNsdWRlOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCxcbiAgc3NyOiBib29sZWFuLFxuICBwcmVidW5kbGVUcmFuc2Zvcm1lcjogSmF2YVNjcmlwdFRyYW5zZm9ybWVyLFxuKTogUHJvbWlzZTxJbmxpbmVDb25maWc+IHtcbiAgY29uc3QgcHJveHkgPSBhd2FpdCBsb2FkUHJveHlDb25maWd1cmF0aW9uKFxuICAgIHNlcnZlck9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICBzZXJ2ZXJPcHRpb25zLnByb3h5Q29uZmlnLFxuICAgIHRydWUsXG4gICk7XG5cbiAgLy8gZHluYW1pY2FsbHkgaW1wb3J0IFZpdGUgZm9yIEVTTSBjb21wYXRpYmlsaXR5XG4gIGNvbnN0IHsgbm9ybWFsaXplUGF0aCB9ID0gYXdhaXQgaW1wb3J0KCd2aXRlJyk7XG5cbiAgY29uc3QgY29uZmlndXJhdGlvbjogSW5saW5lQ29uZmlnID0ge1xuICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIGVudkZpbGU6IGZhbHNlLFxuICAgIGNhY2hlRGlyOiBwYXRoLmpvaW4oc2VydmVyT3B0aW9ucy5jYWNoZU9wdGlvbnMucGF0aCwgJ3ZpdGUnKSxcbiAgICByb290OiBzZXJ2ZXJPcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgcHVibGljRGlyOiBmYWxzZSxcbiAgICBlc2J1aWxkOiBmYWxzZSxcbiAgICBtb2RlOiAnZGV2ZWxvcG1lbnQnLFxuICAgIGFwcFR5cGU6ICdzcGEnLFxuICAgIGNzczoge1xuICAgICAgZGV2U291cmNlbWFwOiB0cnVlLFxuICAgIH0sXG4gICAgYmFzZTogc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgsXG4gICAgcmVzb2x2ZToge1xuICAgICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICB9LFxuICAgIHNlcnZlcjoge1xuICAgICAgcG9ydDogc2VydmVyT3B0aW9ucy5wb3J0LFxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICAgIGhvc3Q6IHNlcnZlck9wdGlvbnMuaG9zdCxcbiAgICAgIG9wZW46IHNlcnZlck9wdGlvbnMub3BlbixcbiAgICAgIGhlYWRlcnM6IHNlcnZlck9wdGlvbnMuaGVhZGVycyxcbiAgICAgIHByb3h5LFxuICAgICAgLy8gQ3VycmVudGx5IGRvZXMgbm90IGFwcGVhciB0byBiZSBhIHdheSB0byBkaXNhYmxlIGZpbGUgd2F0Y2hpbmcgZGlyZWN0bHkgc28gaWdub3JlIGFsbCBmaWxlc1xuICAgICAgd2F0Y2g6IHtcbiAgICAgICAgaWdub3JlZDogWycqKi8qJ10sXG4gICAgICB9LFxuICAgIH0sXG4gICAgc3NyOiB7XG4gICAgICAvLyBFeGNsdWRlIGFueSBwcm92aWRlZCBkZXBlbmRlbmNpZXMgKGN1cnJlbnRseSBidWlsZCBkZWZpbmVkIGV4dGVybmFscylcbiAgICAgIGV4dGVybmFsOiBwcmVidW5kbGVFeGNsdWRlLFxuICAgIH0sXG4gICAgcGx1Z2luczogW1xuICAgICAge1xuICAgICAgICBuYW1lOiAndml0ZTphbmd1bGFyLW1lbW9yeScsXG4gICAgICAgIC8vIEVuc3VyZXMgcGx1Z2luIGhvb2tzIHJ1biBiZWZvcmUgYnVpbHQtaW4gVml0ZSBob29rc1xuICAgICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgICAgYXN5bmMgcmVzb2x2ZUlkKHNvdXJjZSwgaW1wb3J0ZXIpIHtcbiAgICAgICAgICBpZiAoaW1wb3J0ZXIgJiYgc291cmNlLnN0YXJ0c1dpdGgoJy4nKSkge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIHF1ZXJ5IGlmIHByZXNlbnRcbiAgICAgICAgICAgIGNvbnN0IFtpbXBvcnRlckZpbGVdID0gaW1wb3J0ZXIuc3BsaXQoJz8nLCAxKTtcblxuICAgICAgICAgICAgc291cmNlID0gbm9ybWFsaXplUGF0aChwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKGltcG9ydGVyRmlsZSksIHNvdXJjZSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IFtmaWxlXSA9IHNvdXJjZS5zcGxpdCgnPycsIDEpO1xuICAgICAgICAgIGlmIChvdXRwdXRGaWxlcy5oYXMoZmlsZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBzb3VyY2U7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBsb2FkKGlkKSB7XG4gICAgICAgICAgY29uc3QgW2ZpbGVdID0gaWQuc3BsaXQoJz8nLCAxKTtcbiAgICAgICAgICBjb25zdCBjb2RlQ29udGVudHMgPSBvdXRwdXRGaWxlcy5nZXQoZmlsZSk/LmNvbnRlbnRzO1xuICAgICAgICAgIGlmIChjb2RlQ29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGNvZGUgPSBCdWZmZXIuZnJvbShjb2RlQ29udGVudHMpLnRvU3RyaW5nKCd1dGYtOCcpO1xuICAgICAgICAgIGNvbnN0IG1hcENvbnRlbnRzID0gb3V0cHV0RmlsZXMuZ2V0KGZpbGUgKyAnLm1hcCcpPy5jb250ZW50cztcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgc291cmNlIG1hcCBVUkwgY29tbWVudHMgZnJvbSB0aGUgY29kZSBpZiBhIHNvdXJjZW1hcCBpcyBwcmVzZW50LlxuICAgICAgICAgICAgLy8gVml0ZSB3aWxsIGlubGluZSBhbmQgYWRkIGFuIGFkZGl0aW9uYWwgc291cmNlbWFwIFVSTCBmb3IgdGhlIHNvdXJjZW1hcC5cbiAgICAgICAgICAgIGNvZGU6IG1hcENvbnRlbnRzID8gY29kZS5yZXBsYWNlKC9eXFwvXFwvIyBzb3VyY2VNYXBwaW5nVVJMPVteXFxyXFxuXSovZ20sICcnKSA6IGNvZGUsXG4gICAgICAgICAgICBtYXA6IG1hcENvbnRlbnRzICYmIEJ1ZmZlci5mcm9tKG1hcENvbnRlbnRzKS50b1N0cmluZygndXRmLTgnKSxcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICAgICAgLy8gQXNzZXRzIGFuZCByZXNvdXJjZXMgZ2V0IGhhbmRsZWQgZmlyc3RcbiAgICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGZ1bmN0aW9uIGFuZ3VsYXJBc3NldHNNaWRkbGV3YXJlKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgICAgICAgICBpZiAocmVxLnVybCA9PT0gdW5kZWZpbmVkIHx8IHJlcy53cml0YWJsZUVuZGVkKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUGFyc2UgdGhlIGluY29taW5nIHJlcXVlc3QuXG4gICAgICAgICAgICAvLyBUaGUgYmFzZSBvZiB0aGUgVVJMIGlzIHVudXNlZCBidXQgcmVxdWlyZWQgdG8gcGFyc2UgdGhlIFVSTC5cbiAgICAgICAgICAgIGNvbnN0IHBhdGhuYW1lID0gcGF0aG5hbWVXaXRob3V0U2VydmVQYXRoKHJlcS51cmwsIHNlcnZlck9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9uID0gcGF0aC5leHRuYW1lKHBhdGhuYW1lKTtcblxuICAgICAgICAgICAgLy8gUmV3cml0ZSBhbGwgYnVpbGQgYXNzZXRzIHRvIGEgdml0ZSByYXcgZnMgVVJMXG4gICAgICAgICAgICBjb25zdCBhc3NldFNvdXJjZVBhdGggPSBhc3NldHMuZ2V0KHBhdGhuYW1lKTtcbiAgICAgICAgICAgIGlmIChhc3NldFNvdXJjZVBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAvLyBUaGUgZW5jb2RpbmcgbmVlZHMgdG8gbWF0Y2ggd2hhdCBoYXBwZW5zIGluIHRoZSB2aXRlIHN0YXRpYyBtaWRkbGV3YXJlLlxuICAgICAgICAgICAgICAvLyByZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS92aXRlanMvdml0ZS9ibG9iL2Q0ZjEzYmQ4MTQ2ODk2MWM4YzkyNjQzOGU4MTVhYjZiMWM4MjczNWUvcGFja2FnZXMvdml0ZS9zcmMvbm9kZS9zZXJ2ZXIvbWlkZGxld2FyZXMvc3RhdGljLnRzI0wxNjNcbiAgICAgICAgICAgICAgcmVxLnVybCA9IGAvQGZzLyR7ZW5jb2RlVVJJKGFzc2V0U291cmNlUGF0aCl9YDtcbiAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVzb3VyY2UgZmlsZXMgYXJlIGhhbmRsZWQgZGlyZWN0bHkuXG4gICAgICAgICAgICAvLyBHbG9iYWwgc3R5bGVzaGVldHMgKENTUyBmaWxlcykgYXJlIGN1cnJlbnRseSBjb25zaWRlcmVkIHJlc291cmNlcyB0byB3b3JrYXJvdW5kXG4gICAgICAgICAgICAvLyBkZXYgc2VydmVyIHNvdXJjZW1hcCBpc3N1ZXMgd2l0aCBzdHlsZXNoZWV0cy5cbiAgICAgICAgICAgIGlmIChleHRlbnNpb24gIT09ICcuanMnICYmIGV4dGVuc2lvbiAhPT0gJy5odG1sJykge1xuICAgICAgICAgICAgICBjb25zdCBvdXRwdXRGaWxlID0gb3V0cHV0RmlsZXMuZ2V0KHBhdGhuYW1lKTtcbiAgICAgICAgICAgICAgaWYgKG91dHB1dEZpbGUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtaW1lVHlwZSA9IGxvb2t1cE1pbWVUeXBlKGV4dGVuc2lvbik7XG4gICAgICAgICAgICAgICAgaWYgKG1pbWVUeXBlKSB7XG4gICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCBtaW1lVHlwZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NhY2hlLUNvbnRyb2wnLCAnbm8tY2FjaGUnKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VydmVyT3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyhzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpLmZvckVhY2goKFtuYW1lLCB2YWx1ZV0pID0+XG4gICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIobmFtZSwgdmFsdWUpLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzLmVuZChvdXRwdXRGaWxlLmNvbnRlbnRzKTtcblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAvLyBSZXR1cm5pbmcgYSBmdW5jdGlvbiwgaW5zdGFsbHMgbWlkZGxld2FyZSBhZnRlciB0aGUgbWFpbiB0cmFuc2Zvcm0gbWlkZGxld2FyZSBidXRcbiAgICAgICAgICAvLyBiZWZvcmUgdGhlIGJ1aWx0LWluIEhUTUwgbWlkZGxld2FyZVxuICAgICAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgICAgICBmdW5jdGlvbiBhbmd1bGFyU1NSTWlkZGxld2FyZShcbiAgICAgICAgICAgICAgcmVxOiBDb25uZWN0LkluY29taW5nTWVzc2FnZSxcbiAgICAgICAgICAgICAgcmVzOiBTZXJ2ZXJSZXNwb25zZSxcbiAgICAgICAgICAgICAgbmV4dDogQ29ubmVjdC5OZXh0RnVuY3Rpb24sXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgY29uc3QgdXJsID0gcmVxLm9yaWdpbmFsVXJsO1xuICAgICAgICAgICAgICBpZiAoIXVybCB8fCB1cmwuZW5kc1dpdGgoJy5odG1sJykpIHtcbiAgICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBwb3RlbnRpYWxQcmVyZW5kZXJlZCA9IG91dHB1dEZpbGVzLmdldChwb3NpeC5qb2luKHVybCwgJ2luZGV4Lmh0bWwnKSk/LmNvbnRlbnRzO1xuICAgICAgICAgICAgICBpZiAocG90ZW50aWFsUHJlcmVuZGVyZWQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gQnVmZmVyLmZyb20ocG90ZW50aWFsUHJlcmVuZGVyZWQpLnRvU3RyaW5nKCd1dGYtOCcpO1xuICAgICAgICAgICAgICAgIGlmIChTU0dfTUFSS0VSX1JFR0VYUC50ZXN0KGNvbnRlbnQpKSB7XG4gICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1JbmRleEh0bWxBbmRBZGRIZWFkZXJzKHVybCwgcG90ZW50aWFsUHJlcmVuZGVyZWQsIHJlcywgbmV4dCk7XG5cbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCByYXdIdG1sID0gb3V0cHV0RmlsZXMuZ2V0KCcvaW5kZXguc2VydmVyLmh0bWwnKT8uY29udGVudHM7XG4gICAgICAgICAgICAgIGlmICghcmF3SHRtbCkge1xuICAgICAgICAgICAgICAgIG5leHQoKTtcblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHRyYW5zZm9ybUluZGV4SHRtbEFuZEFkZEhlYWRlcnModXJsLCByYXdIdG1sLCByZXMsIG5leHQsIGFzeW5jIChodG1sKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBjb250ZW50IH0gPSBhd2FpdCByZW5kZXJQYWdlKHtcbiAgICAgICAgICAgICAgICAgIGRvY3VtZW50OiBodG1sLFxuICAgICAgICAgICAgICAgICAgcm91dGU6IHBhdGhuYW1lV2l0aG91dFNlcnZlUGF0aCh1cmwsIHNlcnZlck9wdGlvbnMpLFxuICAgICAgICAgICAgICAgICAgc2VydmVyQ29udGV4dDogJ3NzcicsXG4gICAgICAgICAgICAgICAgICBsb2FkQnVuZGxlOiAocGF0aDogc3RyaW5nKSA9PlxuICAgICAgICAgICAgICAgICAgICBzZXJ2ZXIuc3NyTG9hZE1vZHVsZShwYXRoLnNsaWNlKDEpKSBhcyBSZXR1cm5UeXBlPFxuICAgICAgICAgICAgICAgICAgICAgIE5vbk51bGxhYmxlPFJlbmRlck9wdGlvbnNbJ2xvYWRCdW5kbGUnXT5cbiAgICAgICAgICAgICAgICAgICAgPixcbiAgICAgICAgICAgICAgICAgIC8vIEZpbGVzIGhlcmUgYXJlIG9ubHkgbmVlZGVkIGZvciBjcml0aWNhbCBDU1MgaW5saW5pbmcuXG4gICAgICAgICAgICAgICAgICBvdXRwdXRGaWxlczoge30sXG4gICAgICAgICAgICAgICAgICAvLyBUT0RPOiBhZGQgc3VwcG9ydCBmb3IgY3JpdGljYWwgY3NzIGlubGluaW5nLlxuICAgICAgICAgICAgICAgICAgaW5saW5lQ3JpdGljYWxDc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3NyKSB7XG4gICAgICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoYW5ndWxhclNTUk1pZGRsZXdhcmUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGZ1bmN0aW9uIGFuZ3VsYXJJbmRleE1pZGRsZXdhcmUocmVxLCByZXMsIG5leHQpIHtcbiAgICAgICAgICAgICAgaWYgKCFyZXEudXJsKSB7XG4gICAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gUGFyc2UgdGhlIGluY29taW5nIHJlcXVlc3QuXG4gICAgICAgICAgICAgIC8vIFRoZSBiYXNlIG9mIHRoZSBVUkwgaXMgdW51c2VkIGJ1dCByZXF1aXJlZCB0byBwYXJzZSB0aGUgVVJMLlxuICAgICAgICAgICAgICBjb25zdCBwYXRobmFtZSA9IHBhdGhuYW1lV2l0aG91dFNlcnZlUGF0aChyZXEudXJsLCBzZXJ2ZXJPcHRpb25zKTtcblxuICAgICAgICAgICAgICBpZiAocGF0aG5hbWUgPT09ICcvJyB8fCBwYXRobmFtZSA9PT0gYC9pbmRleC5odG1sYCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJhd0h0bWwgPSBvdXRwdXRGaWxlcy5nZXQoJy9pbmRleC5odG1sJyk/LmNvbnRlbnRzO1xuICAgICAgICAgICAgICAgIGlmIChyYXdIdG1sKSB7XG4gICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1JbmRleEh0bWxBbmRBZGRIZWFkZXJzKHJlcS51cmwsIHJhd0h0bWwsIHJlcywgbmV4dCk7XG5cbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgZnVuY3Rpb24gdHJhbnNmb3JtSW5kZXhIdG1sQW5kQWRkSGVhZGVycyhcbiAgICAgICAgICAgIHVybDogc3RyaW5nLFxuICAgICAgICAgICAgcmF3SHRtbDogVWludDhBcnJheSxcbiAgICAgICAgICAgIHJlczogU2VydmVyUmVzcG9uc2U8aW1wb3J0KCdodHRwJykuSW5jb21pbmdNZXNzYWdlPixcbiAgICAgICAgICAgIG5leHQ6IENvbm5lY3QuTmV4dEZ1bmN0aW9uLFxuICAgICAgICAgICAgYWRkaXRpb25hbFRyYW5zZm9ybWVyPzogKGh0bWw6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+LFxuICAgICAgICAgICkge1xuICAgICAgICAgICAgc2VydmVyXG4gICAgICAgICAgICAgIC50cmFuc2Zvcm1JbmRleEh0bWwodXJsLCBCdWZmZXIuZnJvbShyYXdIdG1sKS50b1N0cmluZygndXRmLTgnKSlcbiAgICAgICAgICAgICAgLnRoZW4oYXN5bmMgKHByb2Nlc3NlZEh0bWwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoYWRkaXRpb25hbFRyYW5zZm9ybWVyKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgYWRkaXRpb25hbFRyYW5zZm9ybWVyKHByb2Nlc3NlZEh0bWwpO1xuICAgICAgICAgICAgICAgICAgaWYgKCFjb250ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIG5leHQoKTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIHByb2Nlc3NlZEh0bWwgPSBjb250ZW50O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICd0ZXh0L2h0bWwnKTtcbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDYWNoZS1Db250cm9sJywgJ25vLWNhY2hlJyk7XG4gICAgICAgICAgICAgICAgaWYgKHNlcnZlck9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoc2VydmVyT3B0aW9ucy5oZWFkZXJzKS5mb3JFYWNoKChbbmFtZSwgdmFsdWVdKSA9PlxuICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKG5hbWUsIHZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlcy5lbmQocHJvY2Vzc2VkSHRtbCk7XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IG5leHQoZXJyb3IpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIF0sXG4gICAgb3B0aW1pemVEZXBzOiB7XG4gICAgICAvLyBPbmx5IGVuYWJsZSB3aXRoIGNhY2hpbmcgc2luY2UgaXQgY2F1c2VzIHByZWJ1bmRsZSBkZXBlbmRlbmNpZXMgdG8gYmUgY2FjaGVkXG4gICAgICBkaXNhYmxlZDogIXNlcnZlck9wdGlvbnMuY2FjaGVPcHRpb25zLmVuYWJsZWQsXG4gICAgICAvLyBFeGNsdWRlIGFueSBwcm92aWRlZCBkZXBlbmRlbmNpZXMgKGN1cnJlbnRseSBidWlsZCBkZWZpbmVkIGV4dGVybmFscylcbiAgICAgIGV4Y2x1ZGU6IHByZWJ1bmRsZUV4Y2x1ZGUsXG4gICAgICAvLyBTa2lwIGF1dG9tYXRpYyBmaWxlLWJhc2VkIGVudHJ5IHBvaW50IGRpc2NvdmVyeVxuICAgICAgZW50cmllczogW10sXG4gICAgICAvLyBBZGQgYW4gZXNidWlsZCBwbHVnaW4gdG8gcnVuIHRoZSBBbmd1bGFyIGxpbmtlciBvbiBkZXBlbmRlbmNpZXNcbiAgICAgIGVzYnVpbGRPcHRpb25zOiB7XG4gICAgICAgIHBsdWdpbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYW5ndWxhci12aXRlLW9wdGltaXplLWRlcHMnLFxuICAgICAgICAgICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgICAgICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9qcyQvIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgIGNvbnRlbnRzOiBhd2FpdCBwcmVidW5kbGVUcmFuc2Zvcm1lci50cmFuc2Zvcm1GaWxlKGFyZ3MucGF0aCksXG4gICAgICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0sXG4gIH07XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMuc3NsKSB7XG4gICAgaWYgKHNlcnZlck9wdGlvbnMuc3NsQ2VydCAmJiBzZXJ2ZXJPcHRpb25zLnNzbEtleSkge1xuICAgICAgLy8gc2VydmVyIGNvbmZpZ3VyYXRpb24gaXMgZGVmaW5lZCBhYm92ZVxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgIGNvbmZpZ3VyYXRpb24uc2VydmVyIS5odHRwcyA9IHtcbiAgICAgICAgY2VydDogYXdhaXQgcmVhZEZpbGUoc2VydmVyT3B0aW9ucy5zc2xDZXJ0KSxcbiAgICAgICAga2V5OiBhd2FpdCByZWFkRmlsZShzZXJ2ZXJPcHRpb25zLnNzbEtleSksXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7IGRlZmF1bHQ6IGJhc2ljU3NsUGx1Z2luIH0gPSBhd2FpdCBpbXBvcnQoJ0B2aXRlanMvcGx1Z2luLWJhc2ljLXNzbCcpO1xuICAgICAgY29uZmlndXJhdGlvbi5wbHVnaW5zID8/PSBbXTtcbiAgICAgIGNvbmZpZ3VyYXRpb24ucGx1Z2lucy5wdXNoKGJhc2ljU3NsUGx1Z2luKCkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBjb25maWd1cmF0aW9uO1xufVxuXG5mdW5jdGlvbiBwYXRobmFtZVdpdGhvdXRTZXJ2ZVBhdGgodXJsOiBzdHJpbmcsIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zKTogc3RyaW5nIHtcbiAgY29uc3QgcGFyc2VkVXJsID0gbmV3IFVSTCh1cmwsICdodHRwOi8vbG9jYWxob3N0Jyk7XG4gIGxldCBwYXRobmFtZSA9IGRlY29kZVVSSUNvbXBvbmVudChwYXJzZWRVcmwucGF0aG5hbWUpO1xuICBpZiAoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGggJiYgcGF0aG5hbWUuc3RhcnRzV2l0aChzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCkpIHtcbiAgICBwYXRobmFtZSA9IHBhdGhuYW1lLnNsaWNlKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoLmxlbmd0aCk7XG4gICAgaWYgKHBhdGhuYW1lWzBdICE9PSAnLycpIHtcbiAgICAgIHBhdGhuYW1lID0gJy8nICsgcGF0aG5hbWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHBhdGhuYW1lO1xufVxuIl19