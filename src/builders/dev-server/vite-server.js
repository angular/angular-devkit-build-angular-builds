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
        analyzeResultFiles(normalizePath, result.outputFiles, generatedFiles);
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
            const serverConfiguration = await setupServer(serverOptions, generatedFiles, assetFiles, browserOptions.preserveSymlinks, browserOptions.externalDependencies, !!browserOptions.ssr);
            server = await createServer(serverConfiguration);
            await server.listen();
            listeningAddress = server.httpServer?.address();
            // log connection information
            server.printUrls();
        }
        // TODO: adjust output typings to reflect both development servers
        yield { success: true, port: listeningAddress?.port };
    }
    if (server) {
        let deferred;
        context.addTeardown(async () => {
            await server?.close();
            deferred?.();
        });
        await new Promise((resolve) => (deferred = resolve));
    }
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
    if (serverOptions.hmr) {
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
function analyzeResultFiles(normalizePath, resultFiles, generatedFiles) {
    const seen = new Set(['/index.html']);
    for (const file of resultFiles) {
        const filePath = '/' + normalizePath(file.path);
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
async function setupServer(serverOptions, outputFiles, assets, preserveSymlinks, prebundleExclude, ssr) {
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
                            const transformer = new javascript_transformer_1.JavaScriptTransformer(
                            // Always enable JIT linking to support applications built with and without AOT.
                            // In a development environment the additional scope information does not
                            // have a negative effect unlike production where final output size is relevant.
                            { sourcemap: !!build.initialOptions.sourcemap, jit: true }, 1);
                            build.onLoad({ filter: /\.[cm]?js$/ }, async (args) => {
                                return {
                                    contents: await transformer.transformFile(args.path),
                                    loader: 'js',
                                };
                            });
                            build.onEnd(() => transformer.close());
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
            configuration.plugins ?? (configuration.plugins = []);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3ZpdGUtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0gsbUNBQWtEO0FBQ2xELDhEQUFpQztBQUNqQyw2Q0FBcUQ7QUFDckQsK0NBQTRDO0FBRzVDLHVEQUF3QztBQUV4Qyx1RkFBbUY7QUFDbkYsMEVBQXFGO0FBQ3JGLHdEQUF5RDtBQUV6RCwyREFBNkQ7QUFXN0QsTUFBTSxpQkFBaUIsR0FBRywyQ0FBMkMsQ0FBQztBQUV0RSxTQUFTLFdBQVcsQ0FBQyxRQUFvQjtJQUN2Qyx3QkFBd0I7SUFDeEIsT0FBTyxJQUFBLHdCQUFVLEVBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQ3hELENBQUM7QUFFTSxLQUFLLFNBQVMsQ0FBQyxDQUFDLGFBQWEsQ0FDbEMsYUFBeUMsRUFDekMsV0FBbUIsRUFDbkIsT0FBdUI7SUFFdkIsc0RBQXNEO0lBQ3RELE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FDdkQsYUFBYSxDQUFDLGFBQWEsQ0FDNUIsQ0FBNEMsQ0FBQztJQUU5QyxNQUFNLGNBQWMsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FDbkQ7UUFDRSxHQUFHLGlCQUFpQjtRQUNwQixLQUFLLEVBQUUsYUFBYSxDQUFDLEtBQUs7UUFDMUIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJO1FBQ3hCLE9BQU8sRUFBRSxhQUFhLENBQUMsT0FBTztLQUNZLEVBQzVDLFdBQVcsQ0FDWixDQUE0QyxDQUFDO0lBQzlDLG1FQUFtRTtJQUNu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Q0FBQyxTQUFTLENBQUMsRUFBRTtRQUMzRSxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzFELElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtZQUN2QixRQUFRLEdBQUcsR0FBRyxHQUFHLFFBQVEsQ0FBQztTQUMzQjtLQUNGO0lBRUQsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgdHlwZSB7IGpzb24sIGxvZ2dpbmcgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgdHlwZSB7IE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IGxvb2t1cCBhcyBsb29rdXBNaW1lVHlwZSB9IGZyb20gJ21ybWltZSc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IEJpbmFyeUxpa2UsIGNyZWF0ZUhhc2ggfSBmcm9tICdub2RlOmNyeXB0byc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgU2VydmVyUmVzcG9uc2UgfSBmcm9tICdub2RlOmh0dHAnO1xuaW1wb3J0IHR5cGUgeyBBZGRyZXNzSW5mbyB9IGZyb20gJ25vZGU6bmV0JztcbmltcG9ydCBwYXRoLCB7IHBvc2l4IH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB0eXBlIHsgQ29ubmVjdCwgSW5saW5lQ29uZmlnLCBWaXRlRGV2U2VydmVyIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2phdmFzY3JpcHQtdHJhbnNmb3JtZXInO1xuaW1wb3J0IHsgUmVuZGVyT3B0aW9ucywgcmVuZGVyUGFnZSB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZlci1yZW5kZXJpbmcvcmVuZGVyLXBhZ2UnO1xuaW1wb3J0IHsgYnVpbGRFc2J1aWxkQnJvd3NlciB9IGZyb20gJy4uL2Jyb3dzZXItZXNidWlsZCc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi4vYnJvd3Nlci1lc2J1aWxkL3NjaGVtYSc7XG5pbXBvcnQgeyBsb2FkUHJveHlDb25maWd1cmF0aW9uIH0gZnJvbSAnLi9sb2FkLXByb3h5LWNvbmZpZyc7XG5pbXBvcnQgdHlwZSB7IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB0eXBlIHsgRGV2U2VydmVyQnVpbGRlck91dHB1dCB9IGZyb20gJy4vd2VicGFjay1zZXJ2ZXInO1xuXG5pbnRlcmZhY2UgT3V0cHV0RmlsZVJlY29yZCB7XG4gIGNvbnRlbnRzOiBVaW50OEFycmF5O1xuICBzaXplOiBudW1iZXI7XG4gIGhhc2g/OiBCdWZmZXI7XG4gIHVwZGF0ZWQ6IGJvb2xlYW47XG59XG5cbmNvbnN0IFNTR19NQVJLRVJfUkVHRVhQID0gL25nLXNlcnZlci1jb250ZXh0PVtcIiddXFx3KlxcfD9zc2dcXHw/XFx3KltcIiddLztcblxuZnVuY3Rpb24gaGFzaENvbnRlbnQoY29udGVudHM6IEJpbmFyeUxpa2UpOiBCdWZmZXIge1xuICAvLyBUT0RPOiBDb25zaWRlciB4eGhhc2hcbiAgcmV0dXJuIGNyZWF0ZUhhc2goJ3NoYTI1NicpLnVwZGF0ZShjb250ZW50cykuZGlnZXN0KCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogc2VydmVXaXRoVml0ZShcbiAgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMsXG4gIGJ1aWxkZXJOYW1lOiBzdHJpbmcsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPERldlNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gR2V0IHRoZSBicm93c2VyIGNvbmZpZ3VyYXRpb24gZnJvbSB0aGUgdGFyZ2V0IG5hbWUuXG4gIGNvbnN0IHJhd0Jyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhcbiAgICBzZXJ2ZXJPcHRpb25zLmJyb3dzZXJUYXJnZXQsXG4gICkpIGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyT3B0aW9ucztcblxuICBjb25zdCBicm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LnZhbGlkYXRlT3B0aW9ucyhcbiAgICB7XG4gICAgICAuLi5yYXdCcm93c2VyT3B0aW9ucyxcbiAgICAgIHdhdGNoOiBzZXJ2ZXJPcHRpb25zLndhdGNoLFxuICAgICAgcG9sbDogc2VydmVyT3B0aW9ucy5wb2xsLFxuICAgICAgdmVyYm9zZTogc2VydmVyT3B0aW9ucy52ZXJib3NlLFxuICAgIH0gYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICAgIGJ1aWxkZXJOYW1lLFxuICApKSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG4gIC8vIFNldCBhbGwgcGFja2FnZXMgYXMgZXh0ZXJuYWwgdG8gc3VwcG9ydCBWaXRlJ3MgcHJlYnVuZGxlIGNhY2hpbmdcbiAgYnJvd3Nlck9wdGlvbnMuZXh0ZXJuYWxQYWNrYWdlcyA9IHNlcnZlck9wdGlvbnMuY2FjaGVPcHRpb25zLmVuYWJsZWQ7XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoID09PSB1bmRlZmluZWQgJiYgYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYgIT09IHVuZGVmaW5lZCkge1xuICAgIHNlcnZlck9wdGlvbnMuc2VydmVQYXRoID0gYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWY7XG4gIH1cblxuICAvLyBkeW5hbWljYWxseSBpbXBvcnQgVml0ZSBmb3IgRVNNIGNvbXBhdGliaWxpdHlcbiAgY29uc3QgeyBjcmVhdGVTZXJ2ZXIsIG5vcm1hbGl6ZVBhdGggfSA9IGF3YWl0IGltcG9ydCgndml0ZScpO1xuXG4gIGxldCBzZXJ2ZXI6IFZpdGVEZXZTZXJ2ZXIgfCB1bmRlZmluZWQ7XG4gIGxldCBsaXN0ZW5pbmdBZGRyZXNzOiBBZGRyZXNzSW5mbyB8IHVuZGVmaW5lZDtcbiAgY29uc3QgZ2VuZXJhdGVkRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4oKTtcbiAgY29uc3QgYXNzZXRGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIC8vIFRPRE86IFN3aXRjaCB0aGlzIHRvIGFuIGFyY2hpdGVjdCBzY2hlZHVsZSBjYWxsIHdoZW4gaW5mcmFzdHJ1Y3R1cmUgc2V0dGluZ3MgYXJlIHN1cHBvcnRlZFxuICBmb3IgYXdhaXQgKGNvbnN0IHJlc3VsdCBvZiBidWlsZEVzYnVpbGRCcm93c2VyKGJyb3dzZXJPcHRpb25zLCBjb250ZXh0LCB7XG4gICAgd3JpdGU6IGZhbHNlLFxuICB9KSkge1xuICAgIGFzc2VydChyZXN1bHQub3V0cHV0RmlsZXMsICdCdWlsZGVyIGRpZCBub3QgcHJvdmlkZSByZXN1bHQgZmlsZXMuJyk7XG5cbiAgICAvLyBBbmFseXplIHJlc3VsdCBmaWxlcyBmb3IgY2hhbmdlc1xuICAgIGFuYWx5emVSZXN1bHRGaWxlcyhub3JtYWxpemVQYXRoLCByZXN1bHQub3V0cHV0RmlsZXMsIGdlbmVyYXRlZEZpbGVzKTtcblxuICAgIGFzc2V0RmlsZXMuY2xlYXIoKTtcbiAgICBpZiAocmVzdWx0LmFzc2V0RmlsZXMpIHtcbiAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgcmVzdWx0LmFzc2V0RmlsZXMpIHtcbiAgICAgICAgYXNzZXRGaWxlcy5zZXQoJy8nICsgbm9ybWFsaXplUGF0aChhc3NldC5kZXN0aW5hdGlvbiksIGFzc2V0LnNvdXJjZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNlcnZlcikge1xuICAgICAgaGFuZGxlVXBkYXRlKGdlbmVyYXRlZEZpbGVzLCBzZXJ2ZXIsIHNlcnZlck9wdGlvbnMsIGNvbnRleHQubG9nZ2VyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gU2V0dXAgc2VydmVyIGFuZCBzdGFydCBsaXN0ZW5pbmdcbiAgICAgIGNvbnN0IHNlcnZlckNvbmZpZ3VyYXRpb24gPSBhd2FpdCBzZXR1cFNlcnZlcihcbiAgICAgICAgc2VydmVyT3B0aW9ucyxcbiAgICAgICAgZ2VuZXJhdGVkRmlsZXMsXG4gICAgICAgIGFzc2V0RmlsZXMsXG4gICAgICAgIGJyb3dzZXJPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICAgIGJyb3dzZXJPcHRpb25zLmV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgICAgICAhIWJyb3dzZXJPcHRpb25zLnNzcixcbiAgICAgICk7XG5cbiAgICAgIHNlcnZlciA9IGF3YWl0IGNyZWF0ZVNlcnZlcihzZXJ2ZXJDb25maWd1cmF0aW9uKTtcblxuICAgICAgYXdhaXQgc2VydmVyLmxpc3RlbigpO1xuICAgICAgbGlzdGVuaW5nQWRkcmVzcyA9IHNlcnZlci5odHRwU2VydmVyPy5hZGRyZXNzKCkgYXMgQWRkcmVzc0luZm87XG5cbiAgICAgIC8vIGxvZyBjb25uZWN0aW9uIGluZm9ybWF0aW9uXG4gICAgICBzZXJ2ZXIucHJpbnRVcmxzKCk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogYWRqdXN0IG91dHB1dCB0eXBpbmdzIHRvIHJlZmxlY3QgYm90aCBkZXZlbG9wbWVudCBzZXJ2ZXJzXG4gICAgeWllbGQgeyBzdWNjZXNzOiB0cnVlLCBwb3J0OiBsaXN0ZW5pbmdBZGRyZXNzPy5wb3J0IH0gYXMgdW5rbm93biBhcyBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0O1xuICB9XG5cbiAgaWYgKHNlcnZlcikge1xuICAgIGxldCBkZWZlcnJlZDogKCkgPT4gdm9pZDtcbiAgICBjb250ZXh0LmFkZFRlYXJkb3duKGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IHNlcnZlcj8uY2xvc2UoKTtcbiAgICAgIGRlZmVycmVkPy4oKTtcbiAgICB9KTtcbiAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4gKGRlZmVycmVkID0gcmVzb2x2ZSkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZVVwZGF0ZShcbiAgZ2VuZXJhdGVkRmlsZXM6IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+LFxuICBzZXJ2ZXI6IFZpdGVEZXZTZXJ2ZXIsXG4gIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zLFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuKTogdm9pZCB7XG4gIGNvbnN0IHVwZGF0ZWRGaWxlczogc3RyaW5nW10gPSBbXTtcblxuICAvLyBJbnZhbGlkYXRlIGFueSB1cGRhdGVkIGZpbGVzXG4gIGZvciAoY29uc3QgW2ZpbGUsIHJlY29yZF0gb2YgZ2VuZXJhdGVkRmlsZXMpIHtcbiAgICBpZiAocmVjb3JkLnVwZGF0ZWQpIHtcbiAgICAgIHVwZGF0ZWRGaWxlcy5wdXNoKGZpbGUpO1xuICAgICAgY29uc3QgdXBkYXRlZE1vZHVsZXMgPSBzZXJ2ZXIubW9kdWxlR3JhcGguZ2V0TW9kdWxlc0J5RmlsZShmaWxlKTtcbiAgICAgIHVwZGF0ZWRNb2R1bGVzPy5mb3JFYWNoKChtKSA9PiBzZXJ2ZXI/Lm1vZHVsZUdyYXBoLmludmFsaWRhdGVNb2R1bGUobSkpO1xuICAgIH1cbiAgfVxuXG4gIGlmICghdXBkYXRlZEZpbGVzLmxlbmd0aCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChzZXJ2ZXJPcHRpb25zLmhtcikge1xuICAgIGlmICh1cGRhdGVkRmlsZXMuZXZlcnkoKGYpID0+IGYuZW5kc1dpdGgoJy5jc3MnKSkpIHtcbiAgICAgIGNvbnN0IHRpbWVzdGFtcCA9IERhdGUubm93KCk7XG4gICAgICBzZXJ2ZXIud3Muc2VuZCh7XG4gICAgICAgIHR5cGU6ICd1cGRhdGUnLFxuICAgICAgICB1cGRhdGVzOiB1cGRhdGVkRmlsZXMubWFwKChmKSA9PiB7XG4gICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBmLnNsaWNlKDEpOyAvLyBSZW1vdmUgbGVhZGluZyBzbGFzaC5cblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiAnY3NzLXVwZGF0ZScsXG4gICAgICAgICAgICB0aW1lc3RhbXAsXG4gICAgICAgICAgICBwYXRoOiBmaWxlUGF0aCxcbiAgICAgICAgICAgIGFjY2VwdGVkUGF0aDogZmlsZVBhdGgsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSksXG4gICAgICB9KTtcblxuICAgICAgbG9nZ2VyLmluZm8oJ0hNUiB1cGRhdGUgc2VudCB0byBjbGllbnQocykuLi4nKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNlbmQgcmVsb2FkIGNvbW1hbmQgdG8gY2xpZW50c1xuICBpZiAoc2VydmVyT3B0aW9ucy5saXZlUmVsb2FkKSB7XG4gICAgbG9nZ2VyLmluZm8oJ1JlbG9hZGluZyBjbGllbnQocykuLi4nKTtcblxuICAgIHNlcnZlci53cy5zZW5kKHtcbiAgICAgIHR5cGU6ICdmdWxsLXJlbG9hZCcsXG4gICAgICBwYXRoOiAnKicsXG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gYW5hbHl6ZVJlc3VsdEZpbGVzKFxuICBub3JtYWxpemVQYXRoOiAoaWQ6IHN0cmluZykgPT4gc3RyaW5nLFxuICByZXN1bHRGaWxlczogT3V0cHV0RmlsZVtdLFxuICBnZW5lcmF0ZWRGaWxlczogTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4sXG4pIHtcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPihbJy9pbmRleC5odG1sJ10pO1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgcmVzdWx0RmlsZXMpIHtcbiAgICBjb25zdCBmaWxlUGF0aCA9ICcvJyArIG5vcm1hbGl6ZVBhdGgoZmlsZS5wYXRoKTtcbiAgICBzZWVuLmFkZChmaWxlUGF0aCk7XG5cbiAgICAvLyBTa2lwIGFuYWx5c2lzIG9mIHNvdXJjZW1hcHNcbiAgICBpZiAoZmlsZVBhdGguZW5kc1dpdGgoJy5tYXAnKSkge1xuICAgICAgZ2VuZXJhdGVkRmlsZXMuc2V0KGZpbGVQYXRoLCB7XG4gICAgICAgIGNvbnRlbnRzOiBmaWxlLmNvbnRlbnRzLFxuICAgICAgICBzaXplOiBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgsXG4gICAgICAgIHVwZGF0ZWQ6IGZhbHNlLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGxldCBmaWxlSGFzaDogQnVmZmVyIHwgdW5kZWZpbmVkO1xuICAgIGNvbnN0IGV4aXN0aW5nUmVjb3JkID0gZ2VuZXJhdGVkRmlsZXMuZ2V0KGZpbGVQYXRoKTtcbiAgICBpZiAoZXhpc3RpbmdSZWNvcmQgJiYgZXhpc3RpbmdSZWNvcmQuc2l6ZSA9PT0gZmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoKSB7XG4gICAgICAvLyBPbmx5IGhhc2ggZXhpc3RpbmcgZmlsZSB3aGVuIG5lZWRlZFxuICAgICAgaWYgKGV4aXN0aW5nUmVjb3JkLmhhc2ggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBleGlzdGluZ1JlY29yZC5oYXNoID0gaGFzaENvbnRlbnQoZXhpc3RpbmdSZWNvcmQuY29udGVudHMpO1xuICAgICAgfVxuXG4gICAgICAvLyBDb21wYXJlIGFnYWluc3QgbGF0ZXN0IHJlc3VsdCBvdXRwdXRcbiAgICAgIGZpbGVIYXNoID0gaGFzaENvbnRlbnQoZmlsZS5jb250ZW50cyk7XG4gICAgICBpZiAoZmlsZUhhc2guZXF1YWxzKGV4aXN0aW5nUmVjb3JkLmhhc2gpKSB7XG4gICAgICAgIC8vIFNhbWUgZmlsZVxuICAgICAgICBleGlzdGluZ1JlY29yZC51cGRhdGVkID0gZmFsc2U7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGdlbmVyYXRlZEZpbGVzLnNldChmaWxlUGF0aCwge1xuICAgICAgY29udGVudHM6IGZpbGUuY29udGVudHMsXG4gICAgICBzaXplOiBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgsXG4gICAgICBoYXNoOiBmaWxlSGFzaCxcbiAgICAgIHVwZGF0ZWQ6IHRydWUsXG4gICAgfSk7XG4gIH1cblxuICAvLyBDbGVhciBzdGFsZSBvdXRwdXQgZmlsZXNcbiAgZm9yIChjb25zdCBmaWxlIG9mIGdlbmVyYXRlZEZpbGVzLmtleXMoKSkge1xuICAgIGlmICghc2Vlbi5oYXMoZmlsZSkpIHtcbiAgICAgIGdlbmVyYXRlZEZpbGVzLmRlbGV0ZShmaWxlKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXR1cFNlcnZlcihcbiAgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMsXG4gIG91dHB1dEZpbGVzOiBNYXA8c3RyaW5nLCBPdXRwdXRGaWxlUmVjb3JkPixcbiAgYXNzZXRzOiBNYXA8c3RyaW5nLCBzdHJpbmc+LFxuICBwcmVzZXJ2ZVN5bWxpbmtzOiBib29sZWFuIHwgdW5kZWZpbmVkLFxuICBwcmVidW5kbGVFeGNsdWRlOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCxcbiAgc3NyOiBib29sZWFuLFxuKTogUHJvbWlzZTxJbmxpbmVDb25maWc+IHtcbiAgY29uc3QgcHJveHkgPSBhd2FpdCBsb2FkUHJveHlDb25maWd1cmF0aW9uKFxuICAgIHNlcnZlck9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICBzZXJ2ZXJPcHRpb25zLnByb3h5Q29uZmlnLFxuICAgIHRydWUsXG4gICk7XG5cbiAgLy8gZHluYW1pY2FsbHkgaW1wb3J0IFZpdGUgZm9yIEVTTSBjb21wYXRpYmlsaXR5XG4gIGNvbnN0IHsgbm9ybWFsaXplUGF0aCB9ID0gYXdhaXQgaW1wb3J0KCd2aXRlJyk7XG5cbiAgY29uc3QgY29uZmlndXJhdGlvbjogSW5saW5lQ29uZmlnID0ge1xuICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIGVudkZpbGU6IGZhbHNlLFxuICAgIGNhY2hlRGlyOiBwYXRoLmpvaW4oc2VydmVyT3B0aW9ucy5jYWNoZU9wdGlvbnMucGF0aCwgJ3ZpdGUnKSxcbiAgICByb290OiBzZXJ2ZXJPcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgcHVibGljRGlyOiBmYWxzZSxcbiAgICBlc2J1aWxkOiBmYWxzZSxcbiAgICBtb2RlOiAnZGV2ZWxvcG1lbnQnLFxuICAgIGFwcFR5cGU6ICdzcGEnLFxuICAgIGNzczoge1xuICAgICAgZGV2U291cmNlbWFwOiB0cnVlLFxuICAgIH0sXG4gICAgYmFzZTogc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgsXG4gICAgcmVzb2x2ZToge1xuICAgICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICB9LFxuICAgIHNlcnZlcjoge1xuICAgICAgcG9ydDogc2VydmVyT3B0aW9ucy5wb3J0LFxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICAgIGhvc3Q6IHNlcnZlck9wdGlvbnMuaG9zdCxcbiAgICAgIG9wZW46IHNlcnZlck9wdGlvbnMub3BlbixcbiAgICAgIGhlYWRlcnM6IHNlcnZlck9wdGlvbnMuaGVhZGVycyxcbiAgICAgIHByb3h5LFxuICAgICAgLy8gQ3VycmVudGx5IGRvZXMgbm90IGFwcGVhciB0byBiZSBhIHdheSB0byBkaXNhYmxlIGZpbGUgd2F0Y2hpbmcgZGlyZWN0bHkgc28gaWdub3JlIGFsbCBmaWxlc1xuICAgICAgd2F0Y2g6IHtcbiAgICAgICAgaWdub3JlZDogWycqKi8qJ10sXG4gICAgICB9LFxuICAgIH0sXG4gICAgc3NyOiB7XG4gICAgICAvLyBFeGNsdWRlIGFueSBwcm92aWRlZCBkZXBlbmRlbmNpZXMgKGN1cnJlbnRseSBidWlsZCBkZWZpbmVkIGV4dGVybmFscylcbiAgICAgIGV4dGVybmFsOiBwcmVidW5kbGVFeGNsdWRlLFxuICAgIH0sXG4gICAgcGx1Z2luczogW1xuICAgICAge1xuICAgICAgICBuYW1lOiAndml0ZTphbmd1bGFyLW1lbW9yeScsXG4gICAgICAgIC8vIEVuc3VyZXMgcGx1Z2luIGhvb2tzIHJ1biBiZWZvcmUgYnVpbHQtaW4gVml0ZSBob29rc1xuICAgICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgICAgYXN5bmMgcmVzb2x2ZUlkKHNvdXJjZSwgaW1wb3J0ZXIpIHtcbiAgICAgICAgICBpZiAoaW1wb3J0ZXIgJiYgc291cmNlLnN0YXJ0c1dpdGgoJy4nKSkge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIHF1ZXJ5IGlmIHByZXNlbnRcbiAgICAgICAgICAgIGNvbnN0IFtpbXBvcnRlckZpbGVdID0gaW1wb3J0ZXIuc3BsaXQoJz8nLCAxKTtcblxuICAgICAgICAgICAgc291cmNlID0gbm9ybWFsaXplUGF0aChwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKGltcG9ydGVyRmlsZSksIHNvdXJjZSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IFtmaWxlXSA9IHNvdXJjZS5zcGxpdCgnPycsIDEpO1xuICAgICAgICAgIGlmIChvdXRwdXRGaWxlcy5oYXMoZmlsZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBzb3VyY2U7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBsb2FkKGlkKSB7XG4gICAgICAgICAgY29uc3QgW2ZpbGVdID0gaWQuc3BsaXQoJz8nLCAxKTtcbiAgICAgICAgICBjb25zdCBjb2RlQ29udGVudHMgPSBvdXRwdXRGaWxlcy5nZXQoZmlsZSk/LmNvbnRlbnRzO1xuICAgICAgICAgIGlmIChjb2RlQ29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGNvZGUgPSBCdWZmZXIuZnJvbShjb2RlQ29udGVudHMpLnRvU3RyaW5nKCd1dGYtOCcpO1xuICAgICAgICAgIGNvbnN0IG1hcENvbnRlbnRzID0gb3V0cHV0RmlsZXMuZ2V0KGZpbGUgKyAnLm1hcCcpPy5jb250ZW50cztcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgc291cmNlIG1hcCBVUkwgY29tbWVudHMgZnJvbSB0aGUgY29kZSBpZiBhIHNvdXJjZW1hcCBpcyBwcmVzZW50LlxuICAgICAgICAgICAgLy8gVml0ZSB3aWxsIGlubGluZSBhbmQgYWRkIGFuIGFkZGl0aW9uYWwgc291cmNlbWFwIFVSTCBmb3IgdGhlIHNvdXJjZW1hcC5cbiAgICAgICAgICAgIGNvZGU6IG1hcENvbnRlbnRzID8gY29kZS5yZXBsYWNlKC9eXFwvXFwvIyBzb3VyY2VNYXBwaW5nVVJMPVteXFxyXFxuXSovZ20sICcnKSA6IGNvZGUsXG4gICAgICAgICAgICBtYXA6IG1hcENvbnRlbnRzICYmIEJ1ZmZlci5mcm9tKG1hcENvbnRlbnRzKS50b1N0cmluZygndXRmLTgnKSxcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICAgICAgLy8gQXNzZXRzIGFuZCByZXNvdXJjZXMgZ2V0IGhhbmRsZWQgZmlyc3RcbiAgICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGZ1bmN0aW9uIGFuZ3VsYXJBc3NldHNNaWRkbGV3YXJlKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgICAgICAgICBpZiAocmVxLnVybCA9PT0gdW5kZWZpbmVkIHx8IHJlcy53cml0YWJsZUVuZGVkKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUGFyc2UgdGhlIGluY29taW5nIHJlcXVlc3QuXG4gICAgICAgICAgICAvLyBUaGUgYmFzZSBvZiB0aGUgVVJMIGlzIHVudXNlZCBidXQgcmVxdWlyZWQgdG8gcGFyc2UgdGhlIFVSTC5cbiAgICAgICAgICAgIGNvbnN0IHBhdGhuYW1lID0gcGF0aG5hbWVXaXRob3V0U2VydmVQYXRoKHJlcS51cmwsIHNlcnZlck9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9uID0gcGF0aC5leHRuYW1lKHBhdGhuYW1lKTtcblxuICAgICAgICAgICAgLy8gUmV3cml0ZSBhbGwgYnVpbGQgYXNzZXRzIHRvIGEgdml0ZSByYXcgZnMgVVJMXG4gICAgICAgICAgICBjb25zdCBhc3NldFNvdXJjZVBhdGggPSBhc3NldHMuZ2V0KHBhdGhuYW1lKTtcbiAgICAgICAgICAgIGlmIChhc3NldFNvdXJjZVBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAvLyBUaGUgZW5jb2RpbmcgbmVlZHMgdG8gbWF0Y2ggd2hhdCBoYXBwZW5zIGluIHRoZSB2aXRlIHN0YXRpYyBtaWRkbGV3YXJlLlxuICAgICAgICAgICAgICAvLyByZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS92aXRlanMvdml0ZS9ibG9iL2Q0ZjEzYmQ4MTQ2ODk2MWM4YzkyNjQzOGU4MTVhYjZiMWM4MjczNWUvcGFja2FnZXMvdml0ZS9zcmMvbm9kZS9zZXJ2ZXIvbWlkZGxld2FyZXMvc3RhdGljLnRzI0wxNjNcbiAgICAgICAgICAgICAgcmVxLnVybCA9IGAvQGZzLyR7ZW5jb2RlVVJJKGFzc2V0U291cmNlUGF0aCl9YDtcbiAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVzb3VyY2UgZmlsZXMgYXJlIGhhbmRsZWQgZGlyZWN0bHkuXG4gICAgICAgICAgICAvLyBHbG9iYWwgc3R5bGVzaGVldHMgKENTUyBmaWxlcykgYXJlIGN1cnJlbnRseSBjb25zaWRlcmVkIHJlc291cmNlcyB0byB3b3JrYXJvdW5kXG4gICAgICAgICAgICAvLyBkZXYgc2VydmVyIHNvdXJjZW1hcCBpc3N1ZXMgd2l0aCBzdHlsZXNoZWV0cy5cbiAgICAgICAgICAgIGlmIChleHRlbnNpb24gIT09ICcuanMnICYmIGV4dGVuc2lvbiAhPT0gJy5odG1sJykge1xuICAgICAgICAgICAgICBjb25zdCBvdXRwdXRGaWxlID0gb3V0cHV0RmlsZXMuZ2V0KHBhdGhuYW1lKTtcbiAgICAgICAgICAgICAgaWYgKG91dHB1dEZpbGUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtaW1lVHlwZSA9IGxvb2t1cE1pbWVUeXBlKGV4dGVuc2lvbik7XG4gICAgICAgICAgICAgICAgaWYgKG1pbWVUeXBlKSB7XG4gICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCBtaW1lVHlwZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NhY2hlLUNvbnRyb2wnLCAnbm8tY2FjaGUnKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VydmVyT3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyhzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpLmZvckVhY2goKFtuYW1lLCB2YWx1ZV0pID0+XG4gICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIobmFtZSwgdmFsdWUpLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzLmVuZChvdXRwdXRGaWxlLmNvbnRlbnRzKTtcblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAvLyBSZXR1cm5pbmcgYSBmdW5jdGlvbiwgaW5zdGFsbHMgbWlkZGxld2FyZSBhZnRlciB0aGUgbWFpbiB0cmFuc2Zvcm0gbWlkZGxld2FyZSBidXRcbiAgICAgICAgICAvLyBiZWZvcmUgdGhlIGJ1aWx0LWluIEhUTUwgbWlkZGxld2FyZVxuICAgICAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgICAgICBmdW5jdGlvbiBhbmd1bGFyU1NSTWlkZGxld2FyZShcbiAgICAgICAgICAgICAgcmVxOiBDb25uZWN0LkluY29taW5nTWVzc2FnZSxcbiAgICAgICAgICAgICAgcmVzOiBTZXJ2ZXJSZXNwb25zZSxcbiAgICAgICAgICAgICAgbmV4dDogQ29ubmVjdC5OZXh0RnVuY3Rpb24sXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgY29uc3QgdXJsID0gcmVxLm9yaWdpbmFsVXJsO1xuICAgICAgICAgICAgICBpZiAoIXVybCB8fCB1cmwuZW5kc1dpdGgoJy5odG1sJykpIHtcbiAgICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBwb3RlbnRpYWxQcmVyZW5kZXJlZCA9IG91dHB1dEZpbGVzLmdldChwb3NpeC5qb2luKHVybCwgJ2luZGV4Lmh0bWwnKSk/LmNvbnRlbnRzO1xuICAgICAgICAgICAgICBpZiAocG90ZW50aWFsUHJlcmVuZGVyZWQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gQnVmZmVyLmZyb20ocG90ZW50aWFsUHJlcmVuZGVyZWQpLnRvU3RyaW5nKCd1dGYtOCcpO1xuICAgICAgICAgICAgICAgIGlmIChTU0dfTUFSS0VSX1JFR0VYUC50ZXN0KGNvbnRlbnQpKSB7XG4gICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1JbmRleEh0bWxBbmRBZGRIZWFkZXJzKHVybCwgcG90ZW50aWFsUHJlcmVuZGVyZWQsIHJlcywgbmV4dCk7XG5cbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCByYXdIdG1sID0gb3V0cHV0RmlsZXMuZ2V0KCcvaW5kZXguc2VydmVyLmh0bWwnKT8uY29udGVudHM7XG4gICAgICAgICAgICAgIGlmICghcmF3SHRtbCkge1xuICAgICAgICAgICAgICAgIG5leHQoKTtcblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHRyYW5zZm9ybUluZGV4SHRtbEFuZEFkZEhlYWRlcnModXJsLCByYXdIdG1sLCByZXMsIG5leHQsIGFzeW5jIChodG1sKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBjb250ZW50IH0gPSBhd2FpdCByZW5kZXJQYWdlKHtcbiAgICAgICAgICAgICAgICAgIGRvY3VtZW50OiBodG1sLFxuICAgICAgICAgICAgICAgICAgcm91dGU6IHBhdGhuYW1lV2l0aG91dFNlcnZlUGF0aCh1cmwsIHNlcnZlck9wdGlvbnMpLFxuICAgICAgICAgICAgICAgICAgc2VydmVyQ29udGV4dDogJ3NzcicsXG4gICAgICAgICAgICAgICAgICBsb2FkQnVuZGxlOiAocGF0aDogc3RyaW5nKSA9PlxuICAgICAgICAgICAgICAgICAgICBzZXJ2ZXIuc3NyTG9hZE1vZHVsZShwYXRoLnNsaWNlKDEpKSBhcyBSZXR1cm5UeXBlPFxuICAgICAgICAgICAgICAgICAgICAgIE5vbk51bGxhYmxlPFJlbmRlck9wdGlvbnNbJ2xvYWRCdW5kbGUnXT5cbiAgICAgICAgICAgICAgICAgICAgPixcbiAgICAgICAgICAgICAgICAgIC8vIEZpbGVzIGhlcmUgYXJlIG9ubHkgbmVlZGVkIGZvciBjcml0aWNhbCBDU1MgaW5saW5pbmcuXG4gICAgICAgICAgICAgICAgICBvdXRwdXRGaWxlczoge30sXG4gICAgICAgICAgICAgICAgICAvLyBUT0RPOiBhZGQgc3VwcG9ydCBmb3IgY3JpdGljYWwgY3NzIGlubGluaW5nLlxuICAgICAgICAgICAgICAgICAgaW5saW5lQ3JpdGljYWxDc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3NyKSB7XG4gICAgICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoYW5ndWxhclNTUk1pZGRsZXdhcmUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGZ1bmN0aW9uIGFuZ3VsYXJJbmRleE1pZGRsZXdhcmUocmVxLCByZXMsIG5leHQpIHtcbiAgICAgICAgICAgICAgaWYgKCFyZXEudXJsKSB7XG4gICAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gUGFyc2UgdGhlIGluY29taW5nIHJlcXVlc3QuXG4gICAgICAgICAgICAgIC8vIFRoZSBiYXNlIG9mIHRoZSBVUkwgaXMgdW51c2VkIGJ1dCByZXF1aXJlZCB0byBwYXJzZSB0aGUgVVJMLlxuICAgICAgICAgICAgICBjb25zdCBwYXRobmFtZSA9IHBhdGhuYW1lV2l0aG91dFNlcnZlUGF0aChyZXEudXJsLCBzZXJ2ZXJPcHRpb25zKTtcblxuICAgICAgICAgICAgICBpZiAocGF0aG5hbWUgPT09ICcvJyB8fCBwYXRobmFtZSA9PT0gYC9pbmRleC5odG1sYCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJhd0h0bWwgPSBvdXRwdXRGaWxlcy5nZXQoJy9pbmRleC5odG1sJyk/LmNvbnRlbnRzO1xuICAgICAgICAgICAgICAgIGlmIChyYXdIdG1sKSB7XG4gICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1JbmRleEh0bWxBbmRBZGRIZWFkZXJzKHJlcS51cmwsIHJhd0h0bWwsIHJlcywgbmV4dCk7XG5cbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgZnVuY3Rpb24gdHJhbnNmb3JtSW5kZXhIdG1sQW5kQWRkSGVhZGVycyhcbiAgICAgICAgICAgIHVybDogc3RyaW5nLFxuICAgICAgICAgICAgcmF3SHRtbDogVWludDhBcnJheSxcbiAgICAgICAgICAgIHJlczogU2VydmVyUmVzcG9uc2U8aW1wb3J0KCdodHRwJykuSW5jb21pbmdNZXNzYWdlPixcbiAgICAgICAgICAgIG5leHQ6IENvbm5lY3QuTmV4dEZ1bmN0aW9uLFxuICAgICAgICAgICAgYWRkaXRpb25hbFRyYW5zZm9ybWVyPzogKGh0bWw6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+LFxuICAgICAgICAgICkge1xuICAgICAgICAgICAgc2VydmVyXG4gICAgICAgICAgICAgIC50cmFuc2Zvcm1JbmRleEh0bWwodXJsLCBCdWZmZXIuZnJvbShyYXdIdG1sKS50b1N0cmluZygndXRmLTgnKSlcbiAgICAgICAgICAgICAgLnRoZW4oYXN5bmMgKHByb2Nlc3NlZEh0bWwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoYWRkaXRpb25hbFRyYW5zZm9ybWVyKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgYWRkaXRpb25hbFRyYW5zZm9ybWVyKHByb2Nlc3NlZEh0bWwpO1xuICAgICAgICAgICAgICAgICAgaWYgKCFjb250ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIG5leHQoKTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIHByb2Nlc3NlZEh0bWwgPSBjb250ZW50O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICd0ZXh0L2h0bWwnKTtcbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDYWNoZS1Db250cm9sJywgJ25vLWNhY2hlJyk7XG4gICAgICAgICAgICAgICAgaWYgKHNlcnZlck9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoc2VydmVyT3B0aW9ucy5oZWFkZXJzKS5mb3JFYWNoKChbbmFtZSwgdmFsdWVdKSA9PlxuICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKG5hbWUsIHZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlcy5lbmQocHJvY2Vzc2VkSHRtbCk7XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IG5leHQoZXJyb3IpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIF0sXG4gICAgb3B0aW1pemVEZXBzOiB7XG4gICAgICAvLyBPbmx5IGVuYWJsZSB3aXRoIGNhY2hpbmcgc2luY2UgaXQgY2F1c2VzIHByZWJ1bmRsZSBkZXBlbmRlbmNpZXMgdG8gYmUgY2FjaGVkXG4gICAgICBkaXNhYmxlZDogIXNlcnZlck9wdGlvbnMuY2FjaGVPcHRpb25zLmVuYWJsZWQsXG4gICAgICAvLyBFeGNsdWRlIGFueSBwcm92aWRlZCBkZXBlbmRlbmNpZXMgKGN1cnJlbnRseSBidWlsZCBkZWZpbmVkIGV4dGVybmFscylcbiAgICAgIGV4Y2x1ZGU6IHByZWJ1bmRsZUV4Y2x1ZGUsXG4gICAgICAvLyBTa2lwIGF1dG9tYXRpYyBmaWxlLWJhc2VkIGVudHJ5IHBvaW50IGRpc2NvdmVyeVxuICAgICAgZW50cmllczogW10sXG4gICAgICAvLyBBZGQgYW4gZXNidWlsZCBwbHVnaW4gdG8gcnVuIHRoZSBBbmd1bGFyIGxpbmtlciBvbiBkZXBlbmRlbmNpZXNcbiAgICAgIGVzYnVpbGRPcHRpb25zOiB7XG4gICAgICAgIHBsdWdpbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYW5ndWxhci12aXRlLW9wdGltaXplLWRlcHMnLFxuICAgICAgICAgICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgICAgICAgICAgY29uc3QgdHJhbnNmb3JtZXIgPSBuZXcgSmF2YVNjcmlwdFRyYW5zZm9ybWVyKFxuICAgICAgICAgICAgICAgIC8vIEFsd2F5cyBlbmFibGUgSklUIGxpbmtpbmcgdG8gc3VwcG9ydCBhcHBsaWNhdGlvbnMgYnVpbHQgd2l0aCBhbmQgd2l0aG91dCBBT1QuXG4gICAgICAgICAgICAgICAgLy8gSW4gYSBkZXZlbG9wbWVudCBlbnZpcm9ubWVudCB0aGUgYWRkaXRpb25hbCBzY29wZSBpbmZvcm1hdGlvbiBkb2VzIG5vdFxuICAgICAgICAgICAgICAgIC8vIGhhdmUgYSBuZWdhdGl2ZSBlZmZlY3QgdW5saWtlIHByb2R1Y3Rpb24gd2hlcmUgZmluYWwgb3V0cHV0IHNpemUgaXMgcmVsZXZhbnQuXG4gICAgICAgICAgICAgICAgeyBzb3VyY2VtYXA6ICEhYnVpbGQuaW5pdGlhbE9wdGlvbnMuc291cmNlbWFwLCBqaXQ6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAxLFxuICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLltjbV0/anMkLyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICBjb250ZW50czogYXdhaXQgdHJhbnNmb3JtZXIudHJhbnNmb3JtRmlsZShhcmdzLnBhdGgpLFxuICAgICAgICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBidWlsZC5vbkVuZCgoKSA9PiB0cmFuc2Zvcm1lci5jbG9zZSgpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcblxuICBpZiAoc2VydmVyT3B0aW9ucy5zc2wpIHtcbiAgICBpZiAoc2VydmVyT3B0aW9ucy5zc2xDZXJ0ICYmIHNlcnZlck9wdGlvbnMuc3NsS2V5KSB7XG4gICAgICAvLyBzZXJ2ZXIgY29uZmlndXJhdGlvbiBpcyBkZWZpbmVkIGFib3ZlXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgY29uZmlndXJhdGlvbi5zZXJ2ZXIhLmh0dHBzID0ge1xuICAgICAgICBjZXJ0OiBhd2FpdCByZWFkRmlsZShzZXJ2ZXJPcHRpb25zLnNzbENlcnQpLFxuICAgICAgICBrZXk6IGF3YWl0IHJlYWRGaWxlKHNlcnZlck9wdGlvbnMuc3NsS2V5KSxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHsgZGVmYXVsdDogYmFzaWNTc2xQbHVnaW4gfSA9IGF3YWl0IGltcG9ydCgnQHZpdGVqcy9wbHVnaW4tYmFzaWMtc3NsJyk7XG4gICAgICBjb25maWd1cmF0aW9uLnBsdWdpbnMgPz89IFtdO1xuICAgICAgY29uZmlndXJhdGlvbi5wbHVnaW5zLnB1c2goYmFzaWNTc2xQbHVnaW4oKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGNvbmZpZ3VyYXRpb247XG59XG5cbmZ1bmN0aW9uIHBhdGhuYW1lV2l0aG91dFNlcnZlUGF0aCh1cmw6IHN0cmluZywgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMpOiBzdHJpbmcge1xuICBjb25zdCBwYXJzZWRVcmwgPSBuZXcgVVJMKHVybCwgJ2h0dHA6Ly9sb2NhbGhvc3QnKTtcbiAgbGV0IHBhdGhuYW1lID0gZGVjb2RlVVJJQ29tcG9uZW50KHBhcnNlZFVybC5wYXRobmFtZSk7XG4gIGlmIChzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCAmJiBwYXRobmFtZS5zdGFydHNXaXRoKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoKSkge1xuICAgIHBhdGhuYW1lID0gcGF0aG5hbWUuc2xpY2Uoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgubGVuZ3RoKTtcbiAgICBpZiAocGF0aG5hbWVbMF0gIT09ICcvJykge1xuICAgICAgcGF0aG5hbWUgPSAnLycgKyBwYXRobmFtZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcGF0aG5hbWU7XG59XG4iXX0=