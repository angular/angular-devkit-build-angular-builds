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
    // Setup the prebundling transformer that will be shared across Vite prebundling requests
    const prebundleTransformer = new javascript_transformer_1.JavaScriptTransformer(
    // Always enable JIT linking to support applications built with and without AOT.
    // In a development environment the additional scope information does not
    // have a negative effect unlike production where final output size is relevant.
    { sourcemap: true, jit: true }, 1);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3ZpdGUtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0gsbUNBQWtEO0FBQ2xELDhEQUFpQztBQUNqQyw2Q0FBcUQ7QUFDckQsK0NBQTRDO0FBRzVDLHVEQUF3QztBQUV4Qyx1RkFBbUY7QUFDbkYsMEVBQXFGO0FBQ3JGLHdEQUF5RDtBQUV6RCwyREFBNkQ7QUFXN0QsTUFBTSxpQkFBaUIsR0FBRywyQ0FBMkMsQ0FBQztBQUV0RSxTQUFTLFdBQVcsQ0FBQyxRQUFvQjtJQUN2Qyx3QkFBd0I7SUFDeEIsT0FBTyxJQUFBLHdCQUFVLEVBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQ3hELENBQUM7QUFFTSxLQUFLLFNBQVMsQ0FBQyxDQUFDLGFBQWEsQ0FDbEMsYUFBeUMsRUFDekMsV0FBbUIsRUFDbkIsT0FBdUI7SUFFdkIsc0RBQXNEO0lBQ3RELE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FDdkQsYUFBYSxDQUFDLGFBQWEsQ0FDNUIsQ0FBNEMsQ0FBQztJQUU5QyxNQUFNLGNBQWMsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FDbkQ7UUFDRSxHQUFHLGlCQUFpQjtRQUNwQixLQUFLLEVBQUUsYUFBYSxDQUFDLEtBQUs7UUFDMUIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJO1FBQ3hCLE9BQU8sRUFBRSxhQUFhLENBQUMsT0FBTztLQUNZLEVBQzVDLFdBQVcsQ0FDWixDQUE0QyxDQUFDO0lBQzlDLG1FQUFtRTtJQUNu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QVEsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMxRCxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7WUFDdkIsUUFBUSxHQUFHLEdBQUcsR0FBRyxRQUFRLENBQUM7U0FDM0I7S0FDRjtJQUVELE9BQU8sUUFBUSxDQUFDO0FBQ2xCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHR5cGUgeyBqc29uLCBsb2dnaW5nIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHR5cGUgeyBPdXRwdXRGaWxlIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBsb29rdXAgYXMgbG9va3VwTWltZVR5cGUgfSBmcm9tICdtcm1pbWUnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyBCaW5hcnlMaWtlLCBjcmVhdGVIYXNoIH0gZnJvbSAnbm9kZTpjcnlwdG8nO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IFNlcnZlclJlc3BvbnNlIH0gZnJvbSAnbm9kZTpodHRwJztcbmltcG9ydCB0eXBlIHsgQWRkcmVzc0luZm8gfSBmcm9tICdub2RlOm5ldCc7XG5pbXBvcnQgcGF0aCwgeyBwb3NpeCB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgdHlwZSB7IENvbm5lY3QsIElubGluZUNvbmZpZywgVml0ZURldlNlcnZlciB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHsgSmF2YVNjcmlwdFRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9qYXZhc2NyaXB0LXRyYW5zZm9ybWVyJztcbmltcG9ydCB7IFJlbmRlck9wdGlvbnMsIHJlbmRlclBhZ2UgfSBmcm9tICcuLi8uLi91dGlscy9zZXJ2ZXItcmVuZGVyaW5nL3JlbmRlci1wYWdlJztcbmltcG9ydCB7IGJ1aWxkRXNidWlsZEJyb3dzZXIgfSBmcm9tICcuLi9icm93c2VyLWVzYnVpbGQnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4uL2Jyb3dzZXItZXNidWlsZC9zY2hlbWEnO1xuaW1wb3J0IHsgbG9hZFByb3h5Q29uZmlndXJhdGlvbiB9IGZyb20gJy4vbG9hZC1wcm94eS1jb25maWcnO1xuaW1wb3J0IHR5cGUgeyBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgdHlwZSB7IERldlNlcnZlckJ1aWxkZXJPdXRwdXQgfSBmcm9tICcuL3dlYnBhY2stc2VydmVyJztcblxuaW50ZXJmYWNlIE91dHB1dEZpbGVSZWNvcmQge1xuICBjb250ZW50czogVWludDhBcnJheTtcbiAgc2l6ZTogbnVtYmVyO1xuICBoYXNoPzogQnVmZmVyO1xuICB1cGRhdGVkOiBib29sZWFuO1xufVxuXG5jb25zdCBTU0dfTUFSS0VSX1JFR0VYUCA9IC9uZy1zZXJ2ZXItY29udGV4dD1bXCInXVxcdypcXHw/c3NnXFx8P1xcdypbXCInXS87XG5cbmZ1bmN0aW9uIGhhc2hDb250ZW50KGNvbnRlbnRzOiBCaW5hcnlMaWtlKTogQnVmZmVyIHtcbiAgLy8gVE9ETzogQ29uc2lkZXIgeHhoYXNoXG4gIHJldHVybiBjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoY29udGVudHMpLmRpZ2VzdCgpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24qIHNlcnZlV2l0aFZpdGUoXG4gIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zLFxuICBidWlsZGVyTmFtZTogc3RyaW5nLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IEFzeW5jSXRlcmFibGVJdGVyYXRvcjxEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0PiB7XG4gIC8vIEdldCB0aGUgYnJvd3NlciBjb25maWd1cmF0aW9uIGZyb20gdGhlIHRhcmdldCBuYW1lLlxuICBjb25zdCByYXdCcm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMoXG4gICAgc2VydmVyT3B0aW9ucy5icm93c2VyVGFyZ2V0LFxuICApKSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG5cbiAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC52YWxpZGF0ZU9wdGlvbnMoXG4gICAge1xuICAgICAgLi4ucmF3QnJvd3Nlck9wdGlvbnMsXG4gICAgICB3YXRjaDogc2VydmVyT3B0aW9ucy53YXRjaCxcbiAgICAgIHBvbGw6IHNlcnZlck9wdGlvbnMucG9sbCxcbiAgICAgIHZlcmJvc2U6IHNlcnZlck9wdGlvbnMudmVyYm9zZSxcbiAgICB9IGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgICBidWlsZGVyTmFtZSxcbiAgKSkgYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zO1xuICAvLyBTZXQgYWxsIHBhY2thZ2VzIGFzIGV4dGVybmFsIHRvIHN1cHBvcnQgVml0ZSdzIHByZWJ1bmRsZSBjYWNoaW5nXG4gIGJyb3dzZXJPcHRpb25zLmV4dGVybmFsUGFja2FnZXMgPSBzZXJ2ZXJPcHRpb25zLmNhY2hlT3B0aW9ucy5lbmFibGVkO1xuXG4gIGlmIChzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCA9PT0gdW5kZWZpbmVkICYmIGJyb3dzZXJPcHRpb25zLmJhc2VIcmVmICE9PSB1bmRlZmluZWQpIHtcbiAgICBzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCA9IGJyb3dzZXJPcHRpb25zLmJhc2VIcmVmO1xuICB9XG5cbiAgLy8gU2V0dXAgdGhlIHByZWJ1bmRsaW5nIHRyYW5zZm9ybWVyIHRoYXQgd2lsbCBiZSBzaGFyZWQgYWNyb3NzIFZpdGUgcHJlYnVuZGxpbmcgcmVxdWVzdHNcbiAgY29uc3QgcHJlYnVuZGxlVHJhbnNmb3JtZXIgPSBuZXcgSmF2YVNjcmlwdFRyYW5zZm9ybWVyKFxuICAgIC8vIEFsd2F5cyBlbmFibGUgSklUIGxpbmtpbmcgdG8gc3VwcG9ydCBhcHBsaWNhdGlvbnMgYnVpbHQgd2l0aCBhbmQgd2l0aG91dCBBT1QuXG4gICAgLy8gSW4gYSBkZXZlbG9wbWVudCBlbnZpcm9ubWVudCB0aGUgYWRkaXRpb25hbCBzY29wZSBpbmZvcm1hdGlvbiBkb2VzIG5vdFxuICAgIC8vIGhhdmUgYSBuZWdhdGl2ZSBlZmZlY3QgdW5saWtlIHByb2R1Y3Rpb24gd2hlcmUgZmluYWwgb3V0cHV0IHNpemUgaXMgcmVsZXZhbnQuXG4gICAgeyBzb3VyY2VtYXA6IHRydWUsIGppdDogdHJ1ZSB9LFxuICAgIDEsXG4gICk7XG5cbiAgLy8gZHluYW1pY2FsbHkgaW1wb3J0IFZpdGUgZm9yIEVTTSBjb21wYXRpYmlsaXR5XG4gIGNvbnN0IHsgY3JlYXRlU2VydmVyLCBub3JtYWxpemVQYXRoIH0gPSBhd2FpdCBpbXBvcnQoJ3ZpdGUnKTtcblxuICBsZXQgc2VydmVyOiBWaXRlRGV2U2VydmVyIHwgdW5kZWZpbmVkO1xuICBsZXQgbGlzdGVuaW5nQWRkcmVzczogQWRkcmVzc0luZm8gfCB1bmRlZmluZWQ7XG4gIGNvbnN0IGdlbmVyYXRlZEZpbGVzID0gbmV3IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+KCk7XG4gIGNvbnN0IGFzc2V0RmlsZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAvLyBUT0RPOiBTd2l0Y2ggdGhpcyB0byBhbiBhcmNoaXRlY3Qgc2NoZWR1bGUgY2FsbCB3aGVuIGluZnJhc3RydWN0dXJlIHNldHRpbmdzIGFyZSBzdXBwb3J0ZWRcbiAgZm9yIGF3YWl0IChjb25zdCByZXN1bHQgb2YgYnVpbGRFc2J1aWxkQnJvd3Nlcihicm93c2VyT3B0aW9ucywgY29udGV4dCwge1xuICAgIHdyaXRlOiBmYWxzZSxcbiAgfSkpIHtcbiAgICBhc3NlcnQocmVzdWx0Lm91dHB1dEZpbGVzLCAnQnVpbGRlciBkaWQgbm90IHByb3ZpZGUgcmVzdWx0IGZpbGVzLicpO1xuXG4gICAgLy8gQW5hbHl6ZSByZXN1bHQgZmlsZXMgZm9yIGNoYW5nZXNcbiAgICBhbmFseXplUmVzdWx0RmlsZXMobm9ybWFsaXplUGF0aCwgcmVzdWx0Lm91dHB1dEZpbGVzLCBnZW5lcmF0ZWRGaWxlcyk7XG5cbiAgICBhc3NldEZpbGVzLmNsZWFyKCk7XG4gICAgaWYgKHJlc3VsdC5hc3NldEZpbGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IGFzc2V0IG9mIHJlc3VsdC5hc3NldEZpbGVzKSB7XG4gICAgICAgIGFzc2V0RmlsZXMuc2V0KCcvJyArIG5vcm1hbGl6ZVBhdGgoYXNzZXQuZGVzdGluYXRpb24pLCBhc3NldC5zb3VyY2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzZXJ2ZXIpIHtcbiAgICAgIGhhbmRsZVVwZGF0ZShnZW5lcmF0ZWRGaWxlcywgc2VydmVyLCBzZXJ2ZXJPcHRpb25zLCBjb250ZXh0LmxvZ2dlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFNldHVwIHNlcnZlciBhbmQgc3RhcnQgbGlzdGVuaW5nXG4gICAgICBjb25zdCBzZXJ2ZXJDb25maWd1cmF0aW9uID0gYXdhaXQgc2V0dXBTZXJ2ZXIoXG4gICAgICAgIHNlcnZlck9wdGlvbnMsXG4gICAgICAgIGdlbmVyYXRlZEZpbGVzLFxuICAgICAgICBhc3NldEZpbGVzLFxuICAgICAgICBicm93c2VyT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgICBicm93c2VyT3B0aW9ucy5leHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICAgICAgISFicm93c2VyT3B0aW9ucy5zc3IsXG4gICAgICAgIHByZWJ1bmRsZVRyYW5zZm9ybWVyLFxuICAgICAgKTtcblxuICAgICAgc2VydmVyID0gYXdhaXQgY3JlYXRlU2VydmVyKHNlcnZlckNvbmZpZ3VyYXRpb24pO1xuXG4gICAgICBhd2FpdCBzZXJ2ZXIubGlzdGVuKCk7XG4gICAgICBsaXN0ZW5pbmdBZGRyZXNzID0gc2VydmVyLmh0dHBTZXJ2ZXI/LmFkZHJlc3MoKSBhcyBBZGRyZXNzSW5mbztcblxuICAgICAgLy8gbG9nIGNvbm5lY3Rpb24gaW5mb3JtYXRpb25cbiAgICAgIHNlcnZlci5wcmludFVybHMoKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBhZGp1c3Qgb3V0cHV0IHR5cGluZ3MgdG8gcmVmbGVjdCBib3RoIGRldmVsb3BtZW50IHNlcnZlcnNcbiAgICB5aWVsZCB7IHN1Y2Nlc3M6IHRydWUsIHBvcnQ6IGxpc3RlbmluZ0FkZHJlc3M/LnBvcnQgfSBhcyB1bmtub3duIGFzIERldlNlcnZlckJ1aWxkZXJPdXRwdXQ7XG4gIH1cblxuICAvLyBBZGQgY2xlYW51cCBsb2dpYyB2aWEgYSBidWlsZGVyIHRlYXJkb3duXG4gIGxldCBkZWZlcnJlZDogKCkgPT4gdm9pZDtcbiAgY29udGV4dC5hZGRUZWFyZG93bihhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgc2VydmVyPy5jbG9zZSgpO1xuICAgIGF3YWl0IHByZWJ1bmRsZVRyYW5zZm9ybWVyLmNsb3NlKCk7XG4gICAgZGVmZXJyZWQ/LigpO1xuICB9KTtcbiAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IChkZWZlcnJlZCA9IHJlc29sdmUpKTtcbn1cblxuZnVuY3Rpb24gaGFuZGxlVXBkYXRlKFxuICBnZW5lcmF0ZWRGaWxlczogTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4sXG4gIHNlcnZlcjogVml0ZURldlNlcnZlcixcbiAgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMsXG4gIGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXJBcGksXG4pOiB2b2lkIHtcbiAgY29uc3QgdXBkYXRlZEZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8vIEludmFsaWRhdGUgYW55IHVwZGF0ZWQgZmlsZXNcbiAgZm9yIChjb25zdCBbZmlsZSwgcmVjb3JkXSBvZiBnZW5lcmF0ZWRGaWxlcykge1xuICAgIGlmIChyZWNvcmQudXBkYXRlZCkge1xuICAgICAgdXBkYXRlZEZpbGVzLnB1c2goZmlsZSk7XG4gICAgICBjb25zdCB1cGRhdGVkTW9kdWxlcyA9IHNlcnZlci5tb2R1bGVHcmFwaC5nZXRNb2R1bGVzQnlGaWxlKGZpbGUpO1xuICAgICAgdXBkYXRlZE1vZHVsZXM/LmZvckVhY2goKG0pID0+IHNlcnZlcj8ubW9kdWxlR3JhcGguaW52YWxpZGF0ZU1vZHVsZShtKSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKCF1cGRhdGVkRmlsZXMubGVuZ3RoKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMuaG1yKSB7XG4gICAgaWYgKHVwZGF0ZWRGaWxlcy5ldmVyeSgoZikgPT4gZi5lbmRzV2l0aCgnLmNzcycpKSkge1xuICAgICAgY29uc3QgdGltZXN0YW1wID0gRGF0ZS5ub3coKTtcbiAgICAgIHNlcnZlci53cy5zZW5kKHtcbiAgICAgICAgdHlwZTogJ3VwZGF0ZScsXG4gICAgICAgIHVwZGF0ZXM6IHVwZGF0ZWRGaWxlcy5tYXAoKGYpID0+IHtcbiAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGYuc2xpY2UoMSk7IC8vIFJlbW92ZSBsZWFkaW5nIHNsYXNoLlxuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6ICdjc3MtdXBkYXRlJyxcbiAgICAgICAgICAgIHRpbWVzdGFtcCxcbiAgICAgICAgICAgIHBhdGg6IGZpbGVQYXRoLFxuICAgICAgICAgICAgYWNjZXB0ZWRQYXRoOiBmaWxlUGF0aCxcbiAgICAgICAgICB9O1xuICAgICAgICB9KSxcbiAgICAgIH0pO1xuXG4gICAgICBsb2dnZXIuaW5mbygnSE1SIHVwZGF0ZSBzZW50IHRvIGNsaWVudChzKS4uLicpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG5cbiAgLy8gU2VuZCByZWxvYWQgY29tbWFuZCB0byBjbGllbnRzXG4gIGlmIChzZXJ2ZXJPcHRpb25zLmxpdmVSZWxvYWQpIHtcbiAgICBsb2dnZXIuaW5mbygnUmVsb2FkaW5nIGNsaWVudChzKS4uLicpO1xuXG4gICAgc2VydmVyLndzLnNlbmQoe1xuICAgICAgdHlwZTogJ2Z1bGwtcmVsb2FkJyxcbiAgICAgIHBhdGg6ICcqJyxcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhbmFseXplUmVzdWx0RmlsZXMoXG4gIG5vcm1hbGl6ZVBhdGg6IChpZDogc3RyaW5nKSA9PiBzdHJpbmcsXG4gIHJlc3VsdEZpbGVzOiBPdXRwdXRGaWxlW10sXG4gIGdlbmVyYXRlZEZpbGVzOiBNYXA8c3RyaW5nLCBPdXRwdXRGaWxlUmVjb3JkPixcbikge1xuICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KFsnL2luZGV4Lmh0bWwnXSk7XG4gIGZvciAoY29uc3QgZmlsZSBvZiByZXN1bHRGaWxlcykge1xuICAgIGNvbnN0IGZpbGVQYXRoID0gJy8nICsgbm9ybWFsaXplUGF0aChmaWxlLnBhdGgpO1xuICAgIHNlZW4uYWRkKGZpbGVQYXRoKTtcblxuICAgIC8vIFNraXAgYW5hbHlzaXMgb2Ygc291cmNlbWFwc1xuICAgIGlmIChmaWxlUGF0aC5lbmRzV2l0aCgnLm1hcCcpKSB7XG4gICAgICBnZW5lcmF0ZWRGaWxlcy5zZXQoZmlsZVBhdGgsIHtcbiAgICAgICAgY29udGVudHM6IGZpbGUuY29udGVudHMsXG4gICAgICAgIHNpemU6IGZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCxcbiAgICAgICAgdXBkYXRlZDogZmFsc2UsXG4gICAgICB9KTtcblxuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgbGV0IGZpbGVIYXNoOiBCdWZmZXIgfCB1bmRlZmluZWQ7XG4gICAgY29uc3QgZXhpc3RpbmdSZWNvcmQgPSBnZW5lcmF0ZWRGaWxlcy5nZXQoZmlsZVBhdGgpO1xuICAgIGlmIChleGlzdGluZ1JlY29yZCAmJiBleGlzdGluZ1JlY29yZC5zaXplID09PSBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgpIHtcbiAgICAgIC8vIE9ubHkgaGFzaCBleGlzdGluZyBmaWxlIHdoZW4gbmVlZGVkXG4gICAgICBpZiAoZXhpc3RpbmdSZWNvcmQuaGFzaCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGV4aXN0aW5nUmVjb3JkLmhhc2ggPSBoYXNoQ29udGVudChleGlzdGluZ1JlY29yZC5jb250ZW50cyk7XG4gICAgICB9XG5cbiAgICAgIC8vIENvbXBhcmUgYWdhaW5zdCBsYXRlc3QgcmVzdWx0IG91dHB1dFxuICAgICAgZmlsZUhhc2ggPSBoYXNoQ29udGVudChmaWxlLmNvbnRlbnRzKTtcbiAgICAgIGlmIChmaWxlSGFzaC5lcXVhbHMoZXhpc3RpbmdSZWNvcmQuaGFzaCkpIHtcbiAgICAgICAgLy8gU2FtZSBmaWxlXG4gICAgICAgIGV4aXN0aW5nUmVjb3JkLnVwZGF0ZWQgPSBmYWxzZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVkRmlsZXMuc2V0KGZpbGVQYXRoLCB7XG4gICAgICBjb250ZW50czogZmlsZS5jb250ZW50cyxcbiAgICAgIHNpemU6IGZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCxcbiAgICAgIGhhc2g6IGZpbGVIYXNoLFxuICAgICAgdXBkYXRlZDogdHJ1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIENsZWFyIHN0YWxlIG91dHB1dCBmaWxlc1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgZ2VuZXJhdGVkRmlsZXMua2V5cygpKSB7XG4gICAgaWYgKCFzZWVuLmhhcyhmaWxlKSkge1xuICAgICAgZ2VuZXJhdGVkRmlsZXMuZGVsZXRlKGZpbGUpO1xuICAgIH1cbiAgfVxufVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldHVwU2VydmVyKFxuICBzZXJ2ZXJPcHRpb25zOiBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyxcbiAgb3V0cHV0RmlsZXM6IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+LFxuICBhc3NldHM6IE1hcDxzdHJpbmcsIHN0cmluZz4sXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4gfCB1bmRlZmluZWQsXG4gIHByZWJ1bmRsZUV4Y2x1ZGU6IHN0cmluZ1tdIHwgdW5kZWZpbmVkLFxuICBzc3I6IGJvb2xlYW4sXG4gIHByZWJ1bmRsZVRyYW5zZm9ybWVyOiBKYXZhU2NyaXB0VHJhbnNmb3JtZXIsXG4pOiBQcm9taXNlPElubGluZUNvbmZpZz4ge1xuICBjb25zdCBwcm94eSA9IGF3YWl0IGxvYWRQcm94eUNvbmZpZ3VyYXRpb24oXG4gICAgc2VydmVyT3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIHNlcnZlck9wdGlvbnMucHJveHlDb25maWcsXG4gICAgdHJ1ZSxcbiAgKTtcblxuICAvLyBkeW5hbWljYWxseSBpbXBvcnQgVml0ZSBmb3IgRVNNIGNvbXBhdGliaWxpdHlcbiAgY29uc3QgeyBub3JtYWxpemVQYXRoIH0gPSBhd2FpdCBpbXBvcnQoJ3ZpdGUnKTtcblxuICBjb25zdCBjb25maWd1cmF0aW9uOiBJbmxpbmVDb25maWcgPSB7XG4gICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgZW52RmlsZTogZmFsc2UsXG4gICAgY2FjaGVEaXI6IHBhdGguam9pbihzZXJ2ZXJPcHRpb25zLmNhY2hlT3B0aW9ucy5wYXRoLCAndml0ZScpLFxuICAgIHJvb3Q6IHNlcnZlck9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICBwdWJsaWNEaXI6IGZhbHNlLFxuICAgIGVzYnVpbGQ6IGZhbHNlLFxuICAgIG1vZGU6ICdkZXZlbG9wbWVudCcsXG4gICAgYXBwVHlwZTogJ3NwYScsXG4gICAgY3NzOiB7XG4gICAgICBkZXZTb3VyY2VtYXA6IHRydWUsXG4gICAgfSxcbiAgICBiYXNlOiBzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCxcbiAgICByZXNvbHZlOiB7XG4gICAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIH0sXG4gICAgc2VydmVyOiB7XG4gICAgICBwb3J0OiBzZXJ2ZXJPcHRpb25zLnBvcnQsXG4gICAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgICAgaG9zdDogc2VydmVyT3B0aW9ucy5ob3N0LFxuICAgICAgb3Blbjogc2VydmVyT3B0aW9ucy5vcGVuLFxuICAgICAgaGVhZGVyczogc2VydmVyT3B0aW9ucy5oZWFkZXJzLFxuICAgICAgcHJveHksXG4gICAgICAvLyBDdXJyZW50bHkgZG9lcyBub3QgYXBwZWFyIHRvIGJlIGEgd2F5IHRvIGRpc2FibGUgZmlsZSB3YXRjaGluZyBkaXJlY3RseSBzbyBpZ25vcmUgYWxsIGZpbGVzXG4gICAgICB3YXRjaDoge1xuICAgICAgICBpZ25vcmVkOiBbJyoqLyonXSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBzc3I6IHtcbiAgICAgIC8vIEV4Y2x1ZGUgYW55IHByb3ZpZGVkIGRlcGVuZGVuY2llcyAoY3VycmVudGx5IGJ1aWxkIGRlZmluZWQgZXh0ZXJuYWxzKVxuICAgICAgZXh0ZXJuYWw6IHByZWJ1bmRsZUV4Y2x1ZGUsXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICd2aXRlOmFuZ3VsYXItbWVtb3J5JyxcbiAgICAgICAgLy8gRW5zdXJlcyBwbHVnaW4gaG9va3MgcnVuIGJlZm9yZSBidWlsdC1pbiBWaXRlIGhvb2tzXG4gICAgICAgIGVuZm9yY2U6ICdwcmUnLFxuICAgICAgICBhc3luYyByZXNvbHZlSWQoc291cmNlLCBpbXBvcnRlcikge1xuICAgICAgICAgIGlmIChpbXBvcnRlciAmJiBzb3VyY2Uuc3RhcnRzV2l0aCgnLicpKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgcXVlcnkgaWYgcHJlc2VudFxuICAgICAgICAgICAgY29uc3QgW2ltcG9ydGVyRmlsZV0gPSBpbXBvcnRlci5zcGxpdCgnPycsIDEpO1xuXG4gICAgICAgICAgICBzb3VyY2UgPSBub3JtYWxpemVQYXRoKHBhdGguam9pbihwYXRoLmRpcm5hbWUoaW1wb3J0ZXJGaWxlKSwgc291cmNlKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgW2ZpbGVdID0gc291cmNlLnNwbGl0KCc/JywgMSk7XG4gICAgICAgICAgaWYgKG91dHB1dEZpbGVzLmhhcyhmaWxlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNvdXJjZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGxvYWQoaWQpIHtcbiAgICAgICAgICBjb25zdCBbZmlsZV0gPSBpZC5zcGxpdCgnPycsIDEpO1xuICAgICAgICAgIGNvbnN0IGNvZGVDb250ZW50cyA9IG91dHB1dEZpbGVzLmdldChmaWxlKT8uY29udGVudHM7XG4gICAgICAgICAgaWYgKGNvZGVDb250ZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgY29kZSA9IEJ1ZmZlci5mcm9tKGNvZGVDb250ZW50cykudG9TdHJpbmcoJ3V0Zi04Jyk7XG4gICAgICAgICAgY29uc3QgbWFwQ29udGVudHMgPSBvdXRwdXRGaWxlcy5nZXQoZmlsZSArICcubWFwJyk/LmNvbnRlbnRzO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBzb3VyY2UgbWFwIFVSTCBjb21tZW50cyBmcm9tIHRoZSBjb2RlIGlmIGEgc291cmNlbWFwIGlzIHByZXNlbnQuXG4gICAgICAgICAgICAvLyBWaXRlIHdpbGwgaW5saW5lIGFuZCBhZGQgYW4gYWRkaXRpb25hbCBzb3VyY2VtYXAgVVJMIGZvciB0aGUgc291cmNlbWFwLlxuICAgICAgICAgICAgY29kZTogbWFwQ29udGVudHMgPyBjb2RlLnJlcGxhY2UoL15cXC9cXC8jIHNvdXJjZU1hcHBpbmdVUkw9W15cXHJcXG5dKi9nbSwgJycpIDogY29kZSxcbiAgICAgICAgICAgIG1hcDogbWFwQ29udGVudHMgJiYgQnVmZmVyLmZyb20obWFwQ29udGVudHMpLnRvU3RyaW5nKCd1dGYtOCcpLFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgICAgICAvLyBBc3NldHMgYW5kIHJlc291cmNlcyBnZXQgaGFuZGxlZCBmaXJzdFxuICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoZnVuY3Rpb24gYW5ndWxhckFzc2V0c01pZGRsZXdhcmUocmVxLCByZXMsIG5leHQpIHtcbiAgICAgICAgICAgIGlmIChyZXEudXJsID09PSB1bmRlZmluZWQgfHwgcmVzLndyaXRhYmxlRW5kZWQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBQYXJzZSB0aGUgaW5jb21pbmcgcmVxdWVzdC5cbiAgICAgICAgICAgIC8vIFRoZSBiYXNlIG9mIHRoZSBVUkwgaXMgdW51c2VkIGJ1dCByZXF1aXJlZCB0byBwYXJzZSB0aGUgVVJMLlxuICAgICAgICAgICAgY29uc3QgcGF0aG5hbWUgPSBwYXRobmFtZVdpdGhvdXRTZXJ2ZVBhdGgocmVxLnVybCwgc2VydmVyT3B0aW9ucyk7XG4gICAgICAgICAgICBjb25zdCBleHRlbnNpb24gPSBwYXRoLmV4dG5hbWUocGF0aG5hbWUpO1xuXG4gICAgICAgICAgICAvLyBSZXdyaXRlIGFsbCBidWlsZCBhc3NldHMgdG8gYSB2aXRlIHJhdyBmcyBVUkxcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0U291cmNlUGF0aCA9IGFzc2V0cy5nZXQocGF0aG5hbWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0U291cmNlUGF0aCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIC8vIFRoZSBlbmNvZGluZyBuZWVkcyB0byBtYXRjaCB3aGF0IGhhcHBlbnMgaW4gdGhlIHZpdGUgc3RhdGljIG1pZGRsZXdhcmUuXG4gICAgICAgICAgICAgIC8vIHJlZjogaHR0cHM6Ly9naXRodWIuY29tL3ZpdGVqcy92aXRlL2Jsb2IvZDRmMTNiZDgxNDY4OTYxYzhjOTI2NDM4ZTgxNWFiNmIxYzgyNzM1ZS9wYWNrYWdlcy92aXRlL3NyYy9ub2RlL3NlcnZlci9taWRkbGV3YXJlcy9zdGF0aWMudHMjTDE2M1xuICAgICAgICAgICAgICByZXEudXJsID0gYC9AZnMvJHtlbmNvZGVVUkkoYXNzZXRTb3VyY2VQYXRoKX1gO1xuICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZXNvdXJjZSBmaWxlcyBhcmUgaGFuZGxlZCBkaXJlY3RseS5cbiAgICAgICAgICAgIC8vIEdsb2JhbCBzdHlsZXNoZWV0cyAoQ1NTIGZpbGVzKSBhcmUgY3VycmVudGx5IGNvbnNpZGVyZWQgcmVzb3VyY2VzIHRvIHdvcmthcm91bmRcbiAgICAgICAgICAgIC8vIGRldiBzZXJ2ZXIgc291cmNlbWFwIGlzc3VlcyB3aXRoIHN0eWxlc2hlZXRzLlxuICAgICAgICAgICAgaWYgKGV4dGVuc2lvbiAhPT0gJy5qcycgJiYgZXh0ZW5zaW9uICE9PSAnLmh0bWwnKSB7XG4gICAgICAgICAgICAgIGNvbnN0IG91dHB1dEZpbGUgPSBvdXRwdXRGaWxlcy5nZXQocGF0aG5hbWUpO1xuICAgICAgICAgICAgICBpZiAob3V0cHV0RmlsZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pbWVUeXBlID0gbG9va3VwTWltZVR5cGUoZXh0ZW5zaW9uKTtcbiAgICAgICAgICAgICAgICBpZiAobWltZVR5cGUpIHtcbiAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsIG1pbWVUeXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ2FjaGUtQ29udHJvbCcsICduby1jYWNoZScpO1xuICAgICAgICAgICAgICAgIGlmIChzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpIHtcbiAgICAgICAgICAgICAgICAgIE9iamVjdC5lbnRyaWVzKHNlcnZlck9wdGlvbnMuaGVhZGVycykuZm9yRWFjaCgoW25hbWUsIHZhbHVlXSkgPT5cbiAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihuYW1lLCB2YWx1ZSksXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMuZW5kKG91dHB1dEZpbGUuY29udGVudHMpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIFJldHVybmluZyBhIGZ1bmN0aW9uLCBpbnN0YWxscyBtaWRkbGV3YXJlIGFmdGVyIHRoZSBtYWluIHRyYW5zZm9ybSBtaWRkbGV3YXJlIGJ1dFxuICAgICAgICAgIC8vIGJlZm9yZSB0aGUgYnVpbHQtaW4gSFRNTCBtaWRkbGV3YXJlXG4gICAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICAgIGZ1bmN0aW9uIGFuZ3VsYXJTU1JNaWRkbGV3YXJlKFxuICAgICAgICAgICAgICByZXE6IENvbm5lY3QuSW5jb21pbmdNZXNzYWdlLFxuICAgICAgICAgICAgICByZXM6IFNlcnZlclJlc3BvbnNlLFxuICAgICAgICAgICAgICBuZXh0OiBDb25uZWN0Lk5leHRGdW5jdGlvbixcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICBjb25zdCB1cmwgPSByZXEub3JpZ2luYWxVcmw7XG4gICAgICAgICAgICAgIGlmICghdXJsIHx8IHVybC5lbmRzV2l0aCgnLmh0bWwnKSkge1xuICAgICAgICAgICAgICAgIG5leHQoKTtcblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IHBvdGVudGlhbFByZXJlbmRlcmVkID0gb3V0cHV0RmlsZXMuZ2V0KHBvc2l4LmpvaW4odXJsLCAnaW5kZXguaHRtbCcpKT8uY29udGVudHM7XG4gICAgICAgICAgICAgIGlmIChwb3RlbnRpYWxQcmVyZW5kZXJlZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBCdWZmZXIuZnJvbShwb3RlbnRpYWxQcmVyZW5kZXJlZCkudG9TdHJpbmcoJ3V0Zi04Jyk7XG4gICAgICAgICAgICAgICAgaWYgKFNTR19NQVJLRVJfUkVHRVhQLnRlc3QoY29udGVudCkpIHtcbiAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybUluZGV4SHRtbEFuZEFkZEhlYWRlcnModXJsLCBwb3RlbnRpYWxQcmVyZW5kZXJlZCwgcmVzLCBuZXh0KTtcblxuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IHJhd0h0bWwgPSBvdXRwdXRGaWxlcy5nZXQoJy9pbmRleC5zZXJ2ZXIuaHRtbCcpPy5jb250ZW50cztcbiAgICAgICAgICAgICAgaWYgKCFyYXdIdG1sKSB7XG4gICAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgdHJhbnNmb3JtSW5kZXhIdG1sQW5kQWRkSGVhZGVycyh1cmwsIHJhd0h0bWwsIHJlcywgbmV4dCwgYXN5bmMgKGh0bWwpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IHJlbmRlclBhZ2Uoe1xuICAgICAgICAgICAgICAgICAgZG9jdW1lbnQ6IGh0bWwsXG4gICAgICAgICAgICAgICAgICByb3V0ZTogcGF0aG5hbWVXaXRob3V0U2VydmVQYXRoKHVybCwgc2VydmVyT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgICBzZXJ2ZXJDb250ZXh0OiAnc3NyJyxcbiAgICAgICAgICAgICAgICAgIGxvYWRCdW5kbGU6IChwYXRoOiBzdHJpbmcpID0+XG4gICAgICAgICAgICAgICAgICAgIHNlcnZlci5zc3JMb2FkTW9kdWxlKHBhdGguc2xpY2UoMSkpIGFzIFJldHVyblR5cGU8XG4gICAgICAgICAgICAgICAgICAgICAgTm9uTnVsbGFibGU8UmVuZGVyT3B0aW9uc1snbG9hZEJ1bmRsZSddPlxuICAgICAgICAgICAgICAgICAgICA+LFxuICAgICAgICAgICAgICAgICAgLy8gRmlsZXMgaGVyZSBhcmUgb25seSBuZWVkZWQgZm9yIGNyaXRpY2FsIENTUyBpbmxpbmluZy5cbiAgICAgICAgICAgICAgICAgIG91dHB1dEZpbGVzOiB7fSxcbiAgICAgICAgICAgICAgICAgIC8vIFRPRE86IGFkZCBzdXBwb3J0IGZvciBjcml0aWNhbCBjc3MgaW5saW5pbmcuXG4gICAgICAgICAgICAgICAgICBpbmxpbmVDcml0aWNhbENzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gY29udGVudDtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzc3IpIHtcbiAgICAgICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShhbmd1bGFyU1NSTWlkZGxld2FyZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoZnVuY3Rpb24gYW5ndWxhckluZGV4TWlkZGxld2FyZShyZXEsIHJlcywgbmV4dCkge1xuICAgICAgICAgICAgICBpZiAoIXJlcS51cmwpIHtcbiAgICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBQYXJzZSB0aGUgaW5jb21pbmcgcmVxdWVzdC5cbiAgICAgICAgICAgICAgLy8gVGhlIGJhc2Ugb2YgdGhlIFVSTCBpcyB1bnVzZWQgYnV0IHJlcXVpcmVkIHRvIHBhcnNlIHRoZSBVUkwuXG4gICAgICAgICAgICAgIGNvbnN0IHBhdGhuYW1lID0gcGF0aG5hbWVXaXRob3V0U2VydmVQYXRoKHJlcS51cmwsIHNlcnZlck9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgIGlmIChwYXRobmFtZSA9PT0gJy8nIHx8IHBhdGhuYW1lID09PSBgL2luZGV4Lmh0bWxgKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3SHRtbCA9IG91dHB1dEZpbGVzLmdldCgnL2luZGV4Lmh0bWwnKT8uY29udGVudHM7XG4gICAgICAgICAgICAgICAgaWYgKHJhd0h0bWwpIHtcbiAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybUluZGV4SHRtbEFuZEFkZEhlYWRlcnMocmVxLnVybCwgcmF3SHRtbCwgcmVzLCBuZXh0KTtcblxuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICBmdW5jdGlvbiB0cmFuc2Zvcm1JbmRleEh0bWxBbmRBZGRIZWFkZXJzKFxuICAgICAgICAgICAgdXJsOiBzdHJpbmcsXG4gICAgICAgICAgICByYXdIdG1sOiBVaW50OEFycmF5LFxuICAgICAgICAgICAgcmVzOiBTZXJ2ZXJSZXNwb25zZTxpbXBvcnQoJ2h0dHAnKS5JbmNvbWluZ01lc3NhZ2U+LFxuICAgICAgICAgICAgbmV4dDogQ29ubmVjdC5OZXh0RnVuY3Rpb24sXG4gICAgICAgICAgICBhZGRpdGlvbmFsVHJhbnNmb3JtZXI/OiAoaHRtbDogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4sXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBzZXJ2ZXJcbiAgICAgICAgICAgICAgLnRyYW5zZm9ybUluZGV4SHRtbCh1cmwsIEJ1ZmZlci5mcm9tKHJhd0h0bWwpLnRvU3RyaW5nKCd1dGYtOCcpKVxuICAgICAgICAgICAgICAudGhlbihhc3luYyAocHJvY2Vzc2VkSHRtbCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChhZGRpdGlvbmFsVHJhbnNmb3JtZXIpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBhZGRpdGlvbmFsVHJhbnNmb3JtZXIocHJvY2Vzc2VkSHRtbCk7XG4gICAgICAgICAgICAgICAgICBpZiAoIWNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgcHJvY2Vzc2VkSHRtbCA9IGNvbnRlbnQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ3RleHQvaHRtbCcpO1xuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NhY2hlLUNvbnRyb2wnLCAnbm8tY2FjaGUnKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VydmVyT3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyhzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpLmZvckVhY2goKFtuYW1lLCB2YWx1ZV0pID0+XG4gICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIobmFtZSwgdmFsdWUpLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzLmVuZChwcm9jZXNzZWRIdG1sKTtcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcikgPT4gbmV4dChlcnJvcikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgXSxcbiAgICBvcHRpbWl6ZURlcHM6IHtcbiAgICAgIC8vIE9ubHkgZW5hYmxlIHdpdGggY2FjaGluZyBzaW5jZSBpdCBjYXVzZXMgcHJlYnVuZGxlIGRlcGVuZGVuY2llcyB0byBiZSBjYWNoZWRcbiAgICAgIGRpc2FibGVkOiAhc2VydmVyT3B0aW9ucy5jYWNoZU9wdGlvbnMuZW5hYmxlZCxcbiAgICAgIC8vIEV4Y2x1ZGUgYW55IHByb3ZpZGVkIGRlcGVuZGVuY2llcyAoY3VycmVudGx5IGJ1aWxkIGRlZmluZWQgZXh0ZXJuYWxzKVxuICAgICAgZXhjbHVkZTogcHJlYnVuZGxlRXhjbHVkZSxcbiAgICAgIC8vIFNraXAgYXV0b21hdGljIGZpbGUtYmFzZWQgZW50cnkgcG9pbnQgZGlzY292ZXJ5XG4gICAgICBlbnRyaWVzOiBbXSxcbiAgICAgIC8vIEFkZCBhbiBlc2J1aWxkIHBsdWdpbiB0byBydW4gdGhlIEFuZ3VsYXIgbGlua2VyIG9uIGRlcGVuZGVuY2llc1xuICAgICAgZXNidWlsZE9wdGlvbnM6IHtcbiAgICAgICAgcGx1Z2luczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdhbmd1bGFyLXZpdGUtb3B0aW1pemUtZGVwcycsXG4gICAgICAgICAgICBzZXR1cChidWlsZCkge1xuICAgICAgICAgICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5bY21dP2pzJC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgY29udGVudHM6IGF3YWl0IHByZWJ1bmRsZVRyYW5zZm9ybWVyLnRyYW5zZm9ybUZpbGUoYXJncy5wYXRoKSxcbiAgICAgICAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcblxuICBpZiAoc2VydmVyT3B0aW9ucy5zc2wpIHtcbiAgICBpZiAoc2VydmVyT3B0aW9ucy5zc2xDZXJ0ICYmIHNlcnZlck9wdGlvbnMuc3NsS2V5KSB7XG4gICAgICAvLyBzZXJ2ZXIgY29uZmlndXJhdGlvbiBpcyBkZWZpbmVkIGFib3ZlXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgY29uZmlndXJhdGlvbi5zZXJ2ZXIhLmh0dHBzID0ge1xuICAgICAgICBjZXJ0OiBhd2FpdCByZWFkRmlsZShzZXJ2ZXJPcHRpb25zLnNzbENlcnQpLFxuICAgICAgICBrZXk6IGF3YWl0IHJlYWRGaWxlKHNlcnZlck9wdGlvbnMuc3NsS2V5KSxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHsgZGVmYXVsdDogYmFzaWNTc2xQbHVnaW4gfSA9IGF3YWl0IGltcG9ydCgnQHZpdGVqcy9wbHVnaW4tYmFzaWMtc3NsJyk7XG4gICAgICBjb25maWd1cmF0aW9uLnBsdWdpbnMgPz89IFtdO1xuICAgICAgY29uZmlndXJhdGlvbi5wbHVnaW5zLnB1c2goYmFzaWNTc2xQbHVnaW4oKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGNvbmZpZ3VyYXRpb247XG59XG5cbmZ1bmN0aW9uIHBhdGhuYW1lV2l0aG91dFNlcnZlUGF0aCh1cmw6IHN0cmluZywgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMpOiBzdHJpbmcge1xuICBjb25zdCBwYXJzZWRVcmwgPSBuZXcgVVJMKHVybCwgJ2h0dHA6Ly9sb2NhbGhvc3QnKTtcbiAgbGV0IHBhdGhuYW1lID0gZGVjb2RlVVJJQ29tcG9uZW50KHBhcnNlZFVybC5wYXRobmFtZSk7XG4gIGlmIChzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCAmJiBwYXRobmFtZS5zdGFydHNXaXRoKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoKSkge1xuICAgIHBhdGhuYW1lID0gcGF0aG5hbWUuc2xpY2Uoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgubGVuZ3RoKTtcbiAgICBpZiAocGF0aG5hbWVbMF0gIT09ICcvJykge1xuICAgICAgcGF0aG5hbWUgPSAnLycgKyBwYXRobmFtZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcGF0aG5hbWU7XG59XG4iXX0=