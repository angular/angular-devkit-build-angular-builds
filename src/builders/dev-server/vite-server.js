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
const vite_1 = require("vite");
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
        analyzeResultFiles(result.outputFiles, generatedFiles);
        assetFiles.clear();
        if (result.assetFiles) {
            for (const asset of result.assetFiles) {
                assetFiles.set('/' + (0, vite_1.normalizePath)(asset.destination), asset.source);
            }
        }
        if (server) {
            handleUpdate(generatedFiles, server, serverOptions, context.logger);
        }
        else {
            // Setup server and start listening
            const serverConfiguration = await setupServer(serverOptions, generatedFiles, assetFiles, browserOptions.preserveSymlinks, browserOptions.externalDependencies, !!browserOptions.ssr);
            server = await (0, vite_1.createServer)(serverConfiguration);
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
function analyzeResultFiles(resultFiles, generatedFiles) {
    const seen = new Set(['/index.html']);
    for (const file of resultFiles) {
        const filePath = '/' + (0, vite_1.normalizePath)(file.path);
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
                        source = (0, vite_1.normalizePath)(node_path_1.default.join(node_path_1.default.dirname(importerFile), source));
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
                                /* eslint-disable no-console */
                                const originalConsoleLog = console.log;
                                console.log = (...args) => {
                                    if (args[0] !== 'Angular is running in development mode.') {
                                        originalConsoleLog.apply(args);
                                    }
                                };
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
                                console.log = originalConsoleLog;
                                /* eslint-enable no-console */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3ZpdGUtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0gsbUNBQWtEO0FBQ2xELDhEQUFpQztBQUNqQyw2Q0FBcUQ7QUFDckQsK0NBQTRDO0FBRzVDLHVEQUF3QztBQUN4QywrQkFBeUY7QUFDekYsdUZBQW1GO0FBQ25GLDBFQUFxRjtBQUNyRix3REFBeUQ7QUFFekQsMkRBQTZEO0FBVzdELE1BQU0saUJBQWlCLEdBQUcsMkNBQTJDLENBQUM7QUFFdEUsU0FBUyxXQUFXLENBQUMsUUFBb0I7SUFDdkMsd0JBQXdCO0lBQ3hCLE9BQU8sSUFBQSx3QkFBVSxFQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUN4RCxDQUFDO0FBRU0sS0FBSyxTQUFTLENBQUMsQ0FBQyxhQUFhLENBQ2xDLGFBQXlDLEVBQ3pDLFdBQW1CLEVBQ25CLE9BQXVCO0lBRXZCLHNEQUFzRDtJQUN0RCxNQUFNLGlCQUFpQixHQUFHLENBQUMsTUFBTSxPQUFPLENBQUMsZ0JBQWdCLENBQ3ZELGFBQWEsQ0FBQyxhQUFhLENBQzVCLENBQTRDLENBQUM7SUFFOUMsTUFBTSxjQUFjLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQ25EO1FBQ0UsR0FBRyxpQkFBaUI7UUFDcEIsS0FBSyxFQUFFLGFBQWEsQ0FBQyxLQUFLO1FBQzFCLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSTtRQUN4QixPQUFPLEVBQUUsYUFBYSxDQUFDLE9BQU87S0FDWSxFQUM1QyxXQUFXLENBQ1osQ0FBNEMsQ0FBQztJQUM5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SSxHQUFHLENBQUMsR0FBRyxFQUFFLGtCQUFrQixDQUFDLENBQUM7SUFDbkQsSUFBSSxRQUFRLEdBQUcsa0JBQWtCLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3RELElBQUksYUFBYSxDQUFDLFNBQVMsSUFBSSxRQUFRLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsRUFBRTtRQUMzRSxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzFELElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtZQUN2QixRQUFRLEdBQUcsR0FBRyxHQUFHLFFBQVEsQ0FBQztTQUMzQjtLQUNGO0lBRUQsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgdHlwZSB7IGpzb24sIGxvZ2dpbmcgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgdHlwZSB7IE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IGxvb2t1cCBhcyBsb29rdXBNaW1lVHlwZSB9IGZyb20gJ21ybWltZSc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IEJpbmFyeUxpa2UsIGNyZWF0ZUhhc2ggfSBmcm9tICdub2RlOmNyeXB0byc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgU2VydmVyUmVzcG9uc2UgfSBmcm9tICdub2RlOmh0dHAnO1xuaW1wb3J0IHR5cGUgeyBBZGRyZXNzSW5mbyB9IGZyb20gJ25vZGU6bmV0JztcbmltcG9ydCBwYXRoLCB7IHBvc2l4IH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IENvbm5lY3QsIElubGluZUNvbmZpZywgVml0ZURldlNlcnZlciwgY3JlYXRlU2VydmVyLCBub3JtYWxpemVQYXRoIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2phdmFzY3JpcHQtdHJhbnNmb3JtZXInO1xuaW1wb3J0IHsgUmVuZGVyT3B0aW9ucywgcmVuZGVyUGFnZSB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZlci1yZW5kZXJpbmcvcmVuZGVyLXBhZ2UnO1xuaW1wb3J0IHsgYnVpbGRFc2J1aWxkQnJvd3NlciB9IGZyb20gJy4uL2Jyb3dzZXItZXNidWlsZCc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi4vYnJvd3Nlci1lc2J1aWxkL3NjaGVtYSc7XG5pbXBvcnQgeyBsb2FkUHJveHlDb25maWd1cmF0aW9uIH0gZnJvbSAnLi9sb2FkLXByb3h5LWNvbmZpZyc7XG5pbXBvcnQgdHlwZSB7IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB0eXBlIHsgRGV2U2VydmVyQnVpbGRlck91dHB1dCB9IGZyb20gJy4vd2VicGFjay1zZXJ2ZXInO1xuXG5pbnRlcmZhY2UgT3V0cHV0RmlsZVJlY29yZCB7XG4gIGNvbnRlbnRzOiBVaW50OEFycmF5O1xuICBzaXplOiBudW1iZXI7XG4gIGhhc2g/OiBCdWZmZXI7XG4gIHVwZGF0ZWQ6IGJvb2xlYW47XG59XG5cbmNvbnN0IFNTR19NQVJLRVJfUkVHRVhQID0gL25nLXNlcnZlci1jb250ZXh0PVtcIiddXFx3KlxcfD9zc2dcXHw/XFx3KltcIiddLztcblxuZnVuY3Rpb24gaGFzaENvbnRlbnQoY29udGVudHM6IEJpbmFyeUxpa2UpOiBCdWZmZXIge1xuICAvLyBUT0RPOiBDb25zaWRlciB4eGhhc2hcbiAgcmV0dXJuIGNyZWF0ZUhhc2goJ3NoYTI1NicpLnVwZGF0ZShjb250ZW50cykuZGlnZXN0KCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogc2VydmVXaXRoVml0ZShcbiAgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMsXG4gIGJ1aWxkZXJOYW1lOiBzdHJpbmcsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPERldlNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gR2V0IHRoZSBicm93c2VyIGNvbmZpZ3VyYXRpb24gZnJvbSB0aGUgdGFyZ2V0IG5hbWUuXG4gIGNvbnN0IHJhd0Jyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhcbiAgICBzZXJ2ZXJPcHRpb25zLmJyb3dzZXJUYXJnZXQsXG4gICkpIGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyT3B0aW9ucztcblxuICBjb25zdCBicm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LnZhbGlkYXRlT3B0aW9ucyhcbiAgICB7XG4gICAgICAuLi5yYXdCcm93c2VyT3B0aW9ucyxcbiAgICAgIHdhdGNoOiBzZXJ2ZXJPcHRpb25zLndhdGNoLFxuICAgICAgcG9sbDogc2VydmVyT3B0aW9ucy5wb2xsLFxuICAgICAgdmVyYm9zZTogc2VydmVyT3B0aW9ucy52ZXJib3NlLFxuICAgIH0gYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICAgIGJ1aWxkZXJOYW1lLFxuICApKSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG4gIC8vIFNldCBhbGwgcGFja2FnZXMgYXMgZXh0ZXJuYWwgdG8gc3VwcG9ydCBWaXRlJ3MgcHJlYnVuZGxlIGNhY2hpbmdcbiAgYnJvd3Nlck9wdGlvbnMuZXh0ZXJuYWxQYWNrYWdlcyA9IHNlcnZlck9wdGlvbnMuY2FjaGVPcHRpb25zLmVuYWJsZWQ7XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoID09PSB1bmRlZmluZWQgJiYgYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYgIT09IHVuZGVmaW5lZCkge1xuICAgIHNlcnZlck9wdGlvbnMuc2VydmVQYXRoID0gYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWY7XG4gIH1cblxuICBsZXQgc2VydmVyOiBWaXRlRGV2U2VydmVyIHwgdW5kZWZpbmVkO1xuICBsZXQgbGlzdGVuaW5nQWRkcmVzczogQWRkcmVzc0luZm8gfCB1bmRlZmluZWQ7XG4gIGNvbnN0IGdlbmVyYXRlZEZpbGVzID0gbmV3IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+KCk7XG4gIGNvbnN0IGFzc2V0RmlsZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAvLyBUT0RPOiBTd2l0Y2ggdGhpcyB0byBhbiBhcmNoaXRlY3Qgc2NoZWR1bGUgY2FsbCB3aGVuIGluZnJhc3RydWN0dXJlIHNldHRpbmdzIGFyZSBzdXBwb3J0ZWRcbiAgZm9yIGF3YWl0IChjb25zdCByZXN1bHQgb2YgYnVpbGRFc2J1aWxkQnJvd3Nlcihicm93c2VyT3B0aW9ucywgY29udGV4dCwge1xuICAgIHdyaXRlOiBmYWxzZSxcbiAgfSkpIHtcbiAgICBhc3NlcnQocmVzdWx0Lm91dHB1dEZpbGVzLCAnQnVpbGRlciBkaWQgbm90IHByb3ZpZGUgcmVzdWx0IGZpbGVzLicpO1xuXG4gICAgLy8gQW5hbHl6ZSByZXN1bHQgZmlsZXMgZm9yIGNoYW5nZXNcbiAgICBhbmFseXplUmVzdWx0RmlsZXMocmVzdWx0Lm91dHB1dEZpbGVzLCBnZW5lcmF0ZWRGaWxlcyk7XG5cbiAgICBhc3NldEZpbGVzLmNsZWFyKCk7XG4gICAgaWYgKHJlc3VsdC5hc3NldEZpbGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IGFzc2V0IG9mIHJlc3VsdC5hc3NldEZpbGVzKSB7XG4gICAgICAgIGFzc2V0RmlsZXMuc2V0KCcvJyArIG5vcm1hbGl6ZVBhdGgoYXNzZXQuZGVzdGluYXRpb24pLCBhc3NldC5zb3VyY2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzZXJ2ZXIpIHtcbiAgICAgIGhhbmRsZVVwZGF0ZShnZW5lcmF0ZWRGaWxlcywgc2VydmVyLCBzZXJ2ZXJPcHRpb25zLCBjb250ZXh0LmxvZ2dlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFNldHVwIHNlcnZlciBhbmQgc3RhcnQgbGlzdGVuaW5nXG4gICAgICBjb25zdCBzZXJ2ZXJDb25maWd1cmF0aW9uID0gYXdhaXQgc2V0dXBTZXJ2ZXIoXG4gICAgICAgIHNlcnZlck9wdGlvbnMsXG4gICAgICAgIGdlbmVyYXRlZEZpbGVzLFxuICAgICAgICBhc3NldEZpbGVzLFxuICAgICAgICBicm93c2VyT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgICBicm93c2VyT3B0aW9ucy5leHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICAgICAgISFicm93c2VyT3B0aW9ucy5zc3IsXG4gICAgICApO1xuXG4gICAgICBzZXJ2ZXIgPSBhd2FpdCBjcmVhdGVTZXJ2ZXIoc2VydmVyQ29uZmlndXJhdGlvbik7XG5cbiAgICAgIGF3YWl0IHNlcnZlci5saXN0ZW4oKTtcbiAgICAgIGxpc3RlbmluZ0FkZHJlc3MgPSBzZXJ2ZXIuaHR0cFNlcnZlcj8uYWRkcmVzcygpIGFzIEFkZHJlc3NJbmZvO1xuXG4gICAgICAvLyBsb2cgY29ubmVjdGlvbiBpbmZvcm1hdGlvblxuICAgICAgc2VydmVyLnByaW50VXJscygpO1xuICAgIH1cblxuICAgIC8vIFRPRE86IGFkanVzdCBvdXRwdXQgdHlwaW5ncyB0byByZWZsZWN0IGJvdGggZGV2ZWxvcG1lbnQgc2VydmVyc1xuICAgIHlpZWxkIHsgc3VjY2VzczogdHJ1ZSwgcG9ydDogbGlzdGVuaW5nQWRkcmVzcz8ucG9ydCB9IGFzIHVua25vd24gYXMgRGV2U2VydmVyQnVpbGRlck91dHB1dDtcbiAgfVxuXG4gIGlmIChzZXJ2ZXIpIHtcbiAgICBsZXQgZGVmZXJyZWQ6ICgpID0+IHZvaWQ7XG4gICAgY29udGV4dC5hZGRUZWFyZG93bihhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCBzZXJ2ZXI/LmNsb3NlKCk7XG4gICAgICBkZWZlcnJlZD8uKCk7XG4gICAgfSk7XG4gICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IChkZWZlcnJlZCA9IHJlc29sdmUpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBoYW5kbGVVcGRhdGUoXG4gIGdlbmVyYXRlZEZpbGVzOiBNYXA8c3RyaW5nLCBPdXRwdXRGaWxlUmVjb3JkPixcbiAgc2VydmVyOiBWaXRlRGV2U2VydmVyLFxuICBzZXJ2ZXJPcHRpb25zOiBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyxcbiAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSxcbik6IHZvaWQge1xuICBjb25zdCB1cGRhdGVkRmlsZXM6IHN0cmluZ1tdID0gW107XG5cbiAgLy8gSW52YWxpZGF0ZSBhbnkgdXBkYXRlZCBmaWxlc1xuICBmb3IgKGNvbnN0IFtmaWxlLCByZWNvcmRdIG9mIGdlbmVyYXRlZEZpbGVzKSB7XG4gICAgaWYgKHJlY29yZC51cGRhdGVkKSB7XG4gICAgICB1cGRhdGVkRmlsZXMucHVzaChmaWxlKTtcbiAgICAgIGNvbnN0IHVwZGF0ZWRNb2R1bGVzID0gc2VydmVyLm1vZHVsZUdyYXBoLmdldE1vZHVsZXNCeUZpbGUoZmlsZSk7XG4gICAgICB1cGRhdGVkTW9kdWxlcz8uZm9yRWFjaCgobSkgPT4gc2VydmVyPy5tb2R1bGVHcmFwaC5pbnZhbGlkYXRlTW9kdWxlKG0pKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIXVwZGF0ZWRGaWxlcy5sZW5ndGgpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoc2VydmVyT3B0aW9ucy5obXIpIHtcbiAgICBpZiAodXBkYXRlZEZpbGVzLmV2ZXJ5KChmKSA9PiBmLmVuZHNXaXRoKCcuY3NzJykpKSB7XG4gICAgICBjb25zdCB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuICAgICAgc2VydmVyLndzLnNlbmQoe1xuICAgICAgICB0eXBlOiAndXBkYXRlJyxcbiAgICAgICAgdXBkYXRlczogdXBkYXRlZEZpbGVzLm1hcCgoZikgPT4ge1xuICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gZi5zbGljZSgxKTsgLy8gUmVtb3ZlIGxlYWRpbmcgc2xhc2guXG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogJ2Nzcy11cGRhdGUnLFxuICAgICAgICAgICAgdGltZXN0YW1wLFxuICAgICAgICAgICAgcGF0aDogZmlsZVBhdGgsXG4gICAgICAgICAgICBhY2NlcHRlZFBhdGg6IGZpbGVQYXRoLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pLFxuICAgICAgfSk7XG5cbiAgICAgIGxvZ2dlci5pbmZvKCdITVIgdXBkYXRlIHNlbnQgdG8gY2xpZW50KHMpLi4uJyk7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cblxuICAvLyBTZW5kIHJlbG9hZCBjb21tYW5kIHRvIGNsaWVudHNcbiAgaWYgKHNlcnZlck9wdGlvbnMubGl2ZVJlbG9hZCkge1xuICAgIGxvZ2dlci5pbmZvKCdSZWxvYWRpbmcgY2xpZW50KHMpLi4uJyk7XG5cbiAgICBzZXJ2ZXIud3Muc2VuZCh7XG4gICAgICB0eXBlOiAnZnVsbC1yZWxvYWQnLFxuICAgICAgcGF0aDogJyonLFxuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFuYWx5emVSZXN1bHRGaWxlcyhcbiAgcmVzdWx0RmlsZXM6IE91dHB1dEZpbGVbXSxcbiAgZ2VuZXJhdGVkRmlsZXM6IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+LFxuKSB7XG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oWycvaW5kZXguaHRtbCddKTtcbiAgZm9yIChjb25zdCBmaWxlIG9mIHJlc3VsdEZpbGVzKSB7XG4gICAgY29uc3QgZmlsZVBhdGggPSAnLycgKyBub3JtYWxpemVQYXRoKGZpbGUucGF0aCk7XG4gICAgc2Vlbi5hZGQoZmlsZVBhdGgpO1xuXG4gICAgLy8gU2tpcCBhbmFseXNpcyBvZiBzb3VyY2VtYXBzXG4gICAgaWYgKGZpbGVQYXRoLmVuZHNXaXRoKCcubWFwJykpIHtcbiAgICAgIGdlbmVyYXRlZEZpbGVzLnNldChmaWxlUGF0aCwge1xuICAgICAgICBjb250ZW50czogZmlsZS5jb250ZW50cyxcbiAgICAgICAgc2l6ZTogZmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoLFxuICAgICAgICB1cGRhdGVkOiBmYWxzZSxcbiAgICAgIH0pO1xuXG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBsZXQgZmlsZUhhc2g6IEJ1ZmZlciB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCBleGlzdGluZ1JlY29yZCA9IGdlbmVyYXRlZEZpbGVzLmdldChmaWxlUGF0aCk7XG4gICAgaWYgKGV4aXN0aW5nUmVjb3JkICYmIGV4aXN0aW5nUmVjb3JkLnNpemUgPT09IGZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCkge1xuICAgICAgLy8gT25seSBoYXNoIGV4aXN0aW5nIGZpbGUgd2hlbiBuZWVkZWRcbiAgICAgIGlmIChleGlzdGluZ1JlY29yZC5oYXNoID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZXhpc3RpbmdSZWNvcmQuaGFzaCA9IGhhc2hDb250ZW50KGV4aXN0aW5nUmVjb3JkLmNvbnRlbnRzKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ29tcGFyZSBhZ2FpbnN0IGxhdGVzdCByZXN1bHQgb3V0cHV0XG4gICAgICBmaWxlSGFzaCA9IGhhc2hDb250ZW50KGZpbGUuY29udGVudHMpO1xuICAgICAgaWYgKGZpbGVIYXNoLmVxdWFscyhleGlzdGluZ1JlY29yZC5oYXNoKSkge1xuICAgICAgICAvLyBTYW1lIGZpbGVcbiAgICAgICAgZXhpc3RpbmdSZWNvcmQudXBkYXRlZCA9IGZhbHNlO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZWRGaWxlcy5zZXQoZmlsZVBhdGgsIHtcbiAgICAgIGNvbnRlbnRzOiBmaWxlLmNvbnRlbnRzLFxuICAgICAgc2l6ZTogZmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoLFxuICAgICAgaGFzaDogZmlsZUhhc2gsXG4gICAgICB1cGRhdGVkOiB0cnVlLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gQ2xlYXIgc3RhbGUgb3V0cHV0IGZpbGVzXG4gIGZvciAoY29uc3QgZmlsZSBvZiBnZW5lcmF0ZWRGaWxlcy5rZXlzKCkpIHtcbiAgICBpZiAoIXNlZW4uaGFzKGZpbGUpKSB7XG4gICAgICBnZW5lcmF0ZWRGaWxlcy5kZWxldGUoZmlsZSk7XG4gICAgfVxuICB9XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0dXBTZXJ2ZXIoXG4gIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zLFxuICBvdXRwdXRGaWxlczogTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4sXG4gIGFzc2V0czogTWFwPHN0cmluZywgc3RyaW5nPixcbiAgcHJlc2VydmVTeW1saW5rczogYm9vbGVhbiB8IHVuZGVmaW5lZCxcbiAgcHJlYnVuZGxlRXhjbHVkZTogc3RyaW5nW10gfCB1bmRlZmluZWQsXG4gIHNzcjogYm9vbGVhbixcbik6IFByb21pc2U8SW5saW5lQ29uZmlnPiB7XG4gIGNvbnN0IHByb3h5ID0gYXdhaXQgbG9hZFByb3h5Q29uZmlndXJhdGlvbihcbiAgICBzZXJ2ZXJPcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgc2VydmVyT3B0aW9ucy5wcm94eUNvbmZpZyxcbiAgICB0cnVlLFxuICApO1xuXG4gIGNvbnN0IGNvbmZpZ3VyYXRpb246IElubGluZUNvbmZpZyA9IHtcbiAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICBlbnZGaWxlOiBmYWxzZSxcbiAgICBjYWNoZURpcjogcGF0aC5qb2luKHNlcnZlck9wdGlvbnMuY2FjaGVPcHRpb25zLnBhdGgsICd2aXRlJyksXG4gICAgcm9vdDogc2VydmVyT3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIHB1YmxpY0RpcjogZmFsc2UsXG4gICAgZXNidWlsZDogZmFsc2UsXG4gICAgbW9kZTogJ2RldmVsb3BtZW50JyxcbiAgICBhcHBUeXBlOiAnc3BhJyxcbiAgICBjc3M6IHtcbiAgICAgIGRldlNvdXJjZW1hcDogdHJ1ZSxcbiAgICB9LFxuICAgIGJhc2U6IHNlcnZlck9wdGlvbnMuc2VydmVQYXRoLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgfSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHBvcnQ6IHNlcnZlck9wdGlvbnMucG9ydCxcbiAgICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgICBob3N0OiBzZXJ2ZXJPcHRpb25zLmhvc3QsXG4gICAgICBvcGVuOiBzZXJ2ZXJPcHRpb25zLm9wZW4sXG4gICAgICBoZWFkZXJzOiBzZXJ2ZXJPcHRpb25zLmhlYWRlcnMsXG4gICAgICBwcm94eSxcbiAgICAgIC8vIEN1cnJlbnRseSBkb2VzIG5vdCBhcHBlYXIgdG8gYmUgYSB3YXkgdG8gZGlzYWJsZSBmaWxlIHdhdGNoaW5nIGRpcmVjdGx5IHNvIGlnbm9yZSBhbGwgZmlsZXNcbiAgICAgIHdhdGNoOiB7XG4gICAgICAgIGlnbm9yZWQ6IFsnKiovKiddLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHNzcjoge1xuICAgICAgLy8gRXhjbHVkZSBhbnkgcHJvdmlkZWQgZGVwZW5kZW5jaWVzIChjdXJyZW50bHkgYnVpbGQgZGVmaW5lZCBleHRlcm5hbHMpXG4gICAgICBleHRlcm5hbDogcHJlYnVuZGxlRXhjbHVkZSxcbiAgICB9LFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ3ZpdGU6YW5ndWxhci1tZW1vcnknLFxuICAgICAgICAvLyBFbnN1cmVzIHBsdWdpbiBob29rcyBydW4gYmVmb3JlIGJ1aWx0LWluIFZpdGUgaG9va3NcbiAgICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICAgIGFzeW5jIHJlc29sdmVJZChzb3VyY2UsIGltcG9ydGVyKSB7XG4gICAgICAgICAgaWYgKGltcG9ydGVyICYmIHNvdXJjZS5zdGFydHNXaXRoKCcuJykpIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBxdWVyeSBpZiBwcmVzZW50XG4gICAgICAgICAgICBjb25zdCBbaW1wb3J0ZXJGaWxlXSA9IGltcG9ydGVyLnNwbGl0KCc/JywgMSk7XG5cbiAgICAgICAgICAgIHNvdXJjZSA9IG5vcm1hbGl6ZVBhdGgocGF0aC5qb2luKHBhdGguZGlybmFtZShpbXBvcnRlckZpbGUpLCBzb3VyY2UpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBbZmlsZV0gPSBzb3VyY2Uuc3BsaXQoJz8nLCAxKTtcbiAgICAgICAgICBpZiAob3V0cHV0RmlsZXMuaGFzKGZpbGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gc291cmNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgbG9hZChpZCkge1xuICAgICAgICAgIGNvbnN0IFtmaWxlXSA9IGlkLnNwbGl0KCc/JywgMSk7XG4gICAgICAgICAgY29uc3QgY29kZUNvbnRlbnRzID0gb3V0cHV0RmlsZXMuZ2V0KGZpbGUpPy5jb250ZW50cztcbiAgICAgICAgICBpZiAoY29kZUNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBjb2RlID0gQnVmZmVyLmZyb20oY29kZUNvbnRlbnRzKS50b1N0cmluZygndXRmLTgnKTtcbiAgICAgICAgICBjb25zdCBtYXBDb250ZW50cyA9IG91dHB1dEZpbGVzLmdldChmaWxlICsgJy5tYXAnKT8uY29udGVudHM7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIHNvdXJjZSBtYXAgVVJMIGNvbW1lbnRzIGZyb20gdGhlIGNvZGUgaWYgYSBzb3VyY2VtYXAgaXMgcHJlc2VudC5cbiAgICAgICAgICAgIC8vIFZpdGUgd2lsbCBpbmxpbmUgYW5kIGFkZCBhbiBhZGRpdGlvbmFsIHNvdXJjZW1hcCBVUkwgZm9yIHRoZSBzb3VyY2VtYXAuXG4gICAgICAgICAgICBjb2RlOiBtYXBDb250ZW50cyA/IGNvZGUucmVwbGFjZSgvXlxcL1xcLyMgc291cmNlTWFwcGluZ1VSTD1bXlxcclxcbl0qL2dtLCAnJykgOiBjb2RlLFxuICAgICAgICAgICAgbWFwOiBtYXBDb250ZW50cyAmJiBCdWZmZXIuZnJvbShtYXBDb250ZW50cykudG9TdHJpbmcoJ3V0Zi04JyksXG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgICAgIC8vIEFzc2V0cyBhbmQgcmVzb3VyY2VzIGdldCBoYW5kbGVkIGZpcnN0XG4gICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShmdW5jdGlvbiBhbmd1bGFyQXNzZXRzTWlkZGxld2FyZShyZXEsIHJlcywgbmV4dCkge1xuICAgICAgICAgICAgaWYgKHJlcS51cmwgPT09IHVuZGVmaW5lZCB8fCByZXMud3JpdGFibGVFbmRlZCkge1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFBhcnNlIHRoZSBpbmNvbWluZyByZXF1ZXN0LlxuICAgICAgICAgICAgLy8gVGhlIGJhc2Ugb2YgdGhlIFVSTCBpcyB1bnVzZWQgYnV0IHJlcXVpcmVkIHRvIHBhcnNlIHRoZSBVUkwuXG4gICAgICAgICAgICBjb25zdCBwYXRobmFtZSA9IHBhdGhuYW1lV2l0aG91dFNlcnZlUGF0aChyZXEudXJsLCBzZXJ2ZXJPcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IHBhdGguZXh0bmFtZShwYXRobmFtZSk7XG5cbiAgICAgICAgICAgIC8vIFJld3JpdGUgYWxsIGJ1aWxkIGFzc2V0cyB0byBhIHZpdGUgcmF3IGZzIFVSTFxuICAgICAgICAgICAgY29uc3QgYXNzZXRTb3VyY2VQYXRoID0gYXNzZXRzLmdldChwYXRobmFtZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXRTb3VyY2VQYXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgLy8gVGhlIGVuY29kaW5nIG5lZWRzIHRvIG1hdGNoIHdoYXQgaGFwcGVucyBpbiB0aGUgdml0ZSBzdGF0aWMgbWlkZGxld2FyZS5cbiAgICAgICAgICAgICAgLy8gcmVmOiBodHRwczovL2dpdGh1Yi5jb20vdml0ZWpzL3ZpdGUvYmxvYi9kNGYxM2JkODE0Njg5NjFjOGM5MjY0MzhlODE1YWI2YjFjODI3MzVlL3BhY2thZ2VzL3ZpdGUvc3JjL25vZGUvc2VydmVyL21pZGRsZXdhcmVzL3N0YXRpYy50cyNMMTYzXG4gICAgICAgICAgICAgIHJlcS51cmwgPSBgL0Bmcy8ke2VuY29kZVVSSShhc3NldFNvdXJjZVBhdGgpfWA7XG4gICAgICAgICAgICAgIG5leHQoKTtcblxuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJlc291cmNlIGZpbGVzIGFyZSBoYW5kbGVkIGRpcmVjdGx5LlxuICAgICAgICAgICAgLy8gR2xvYmFsIHN0eWxlc2hlZXRzIChDU1MgZmlsZXMpIGFyZSBjdXJyZW50bHkgY29uc2lkZXJlZCByZXNvdXJjZXMgdG8gd29ya2Fyb3VuZFxuICAgICAgICAgICAgLy8gZGV2IHNlcnZlciBzb3VyY2VtYXAgaXNzdWVzIHdpdGggc3R5bGVzaGVldHMuXG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9uICE9PSAnLmpzJyAmJiBleHRlbnNpb24gIT09ICcuaHRtbCcpIHtcbiAgICAgICAgICAgICAgY29uc3Qgb3V0cHV0RmlsZSA9IG91dHB1dEZpbGVzLmdldChwYXRobmFtZSk7XG4gICAgICAgICAgICAgIGlmIChvdXRwdXRGaWxlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWltZVR5cGUgPSBsb29rdXBNaW1lVHlwZShleHRlbnNpb24pO1xuICAgICAgICAgICAgICAgIGlmIChtaW1lVHlwZSkge1xuICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgbWltZVR5cGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDYWNoZS1Db250cm9sJywgJ25vLWNhY2hlJyk7XG4gICAgICAgICAgICAgICAgaWYgKHNlcnZlck9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoc2VydmVyT3B0aW9ucy5oZWFkZXJzKS5mb3JFYWNoKChbbmFtZSwgdmFsdWVdKSA9PlxuICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKG5hbWUsIHZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlcy5lbmQob3V0cHV0RmlsZS5jb250ZW50cyk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gUmV0dXJuaW5nIGEgZnVuY3Rpb24sIGluc3RhbGxzIG1pZGRsZXdhcmUgYWZ0ZXIgdGhlIG1haW4gdHJhbnNmb3JtIG1pZGRsZXdhcmUgYnV0XG4gICAgICAgICAgLy8gYmVmb3JlIHRoZSBidWlsdC1pbiBIVE1MIG1pZGRsZXdhcmVcbiAgICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgICAgZnVuY3Rpb24gYW5ndWxhclNTUk1pZGRsZXdhcmUoXG4gICAgICAgICAgICAgIHJlcTogQ29ubmVjdC5JbmNvbWluZ01lc3NhZ2UsXG4gICAgICAgICAgICAgIHJlczogU2VydmVyUmVzcG9uc2UsXG4gICAgICAgICAgICAgIG5leHQ6IENvbm5lY3QuTmV4dEZ1bmN0aW9uLFxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHVybCA9IHJlcS5vcmlnaW5hbFVybDtcbiAgICAgICAgICAgICAgaWYgKCF1cmwgfHwgdXJsLmVuZHNXaXRoKCcuaHRtbCcpKSB7XG4gICAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgcG90ZW50aWFsUHJlcmVuZGVyZWQgPSBvdXRwdXRGaWxlcy5nZXQocG9zaXguam9pbih1cmwsICdpbmRleC5odG1sJykpPy5jb250ZW50cztcbiAgICAgICAgICAgICAgaWYgKHBvdGVudGlhbFByZXJlbmRlcmVkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IEJ1ZmZlci5mcm9tKHBvdGVudGlhbFByZXJlbmRlcmVkKS50b1N0cmluZygndXRmLTgnKTtcbiAgICAgICAgICAgICAgICBpZiAoU1NHX01BUktFUl9SRUdFWFAudGVzdChjb250ZW50KSkge1xuICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtSW5kZXhIdG1sQW5kQWRkSGVhZGVycyh1cmwsIHBvdGVudGlhbFByZXJlbmRlcmVkLCByZXMsIG5leHQpO1xuXG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgcmF3SHRtbCA9IG91dHB1dEZpbGVzLmdldCgnL2luZGV4LnNlcnZlci5odG1sJyk/LmNvbnRlbnRzO1xuICAgICAgICAgICAgICBpZiAoIXJhd0h0bWwpIHtcbiAgICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB0cmFuc2Zvcm1JbmRleEh0bWxBbmRBZGRIZWFkZXJzKHVybCwgcmF3SHRtbCwgcmVzLCBuZXh0LCBhc3luYyAoaHRtbCkgPT4ge1xuICAgICAgICAgICAgICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cbiAgICAgICAgICAgICAgICBjb25zdCBvcmlnaW5hbENvbnNvbGVMb2cgPSBjb25zb2xlLmxvZztcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgICAgICAgICAgICBpZiAoYXJnc1swXSAhPT0gJ0FuZ3VsYXIgaXMgcnVubmluZyBpbiBkZXZlbG9wbWVudCBtb2RlLicpIHtcbiAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWxDb25zb2xlTG9nLmFwcGx5KGFyZ3MpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IHJlbmRlclBhZ2Uoe1xuICAgICAgICAgICAgICAgICAgZG9jdW1lbnQ6IGh0bWwsXG4gICAgICAgICAgICAgICAgICByb3V0ZTogcGF0aG5hbWVXaXRob3V0U2VydmVQYXRoKHVybCwgc2VydmVyT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgICBzZXJ2ZXJDb250ZXh0OiAnc3NyJyxcbiAgICAgICAgICAgICAgICAgIGxvYWRCdW5kbGU6IChwYXRoOiBzdHJpbmcpID0+XG4gICAgICAgICAgICAgICAgICAgIHNlcnZlci5zc3JMb2FkTW9kdWxlKHBhdGguc2xpY2UoMSkpIGFzIFJldHVyblR5cGU8XG4gICAgICAgICAgICAgICAgICAgICAgTm9uTnVsbGFibGU8UmVuZGVyT3B0aW9uc1snbG9hZEJ1bmRsZSddPlxuICAgICAgICAgICAgICAgICAgICA+LFxuICAgICAgICAgICAgICAgICAgLy8gRmlsZXMgaGVyZSBhcmUgb25seSBuZWVkZWQgZm9yIGNyaXRpY2FsIENTUyBpbmxpbmluZy5cbiAgICAgICAgICAgICAgICAgIG91dHB1dEZpbGVzOiB7fSxcbiAgICAgICAgICAgICAgICAgIC8vIFRPRE86IGFkZCBzdXBwb3J0IGZvciBjcml0aWNhbCBjc3MgaW5saW5pbmcuXG4gICAgICAgICAgICAgICAgICBpbmxpbmVDcml0aWNhbENzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyA9IG9yaWdpbmFsQ29uc29sZUxvZztcbiAgICAgICAgICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLWNvbnNvbGUgKi9cblxuICAgICAgICAgICAgICAgIHJldHVybiBjb250ZW50O1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNzcikge1xuICAgICAgICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGFuZ3VsYXJTU1JNaWRkbGV3YXJlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShmdW5jdGlvbiBhbmd1bGFySW5kZXhNaWRkbGV3YXJlKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgICAgICAgICAgIGlmICghcmVxLnVybCkge1xuICAgICAgICAgICAgICAgIG5leHQoKTtcblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIFBhcnNlIHRoZSBpbmNvbWluZyByZXF1ZXN0LlxuICAgICAgICAgICAgICAvLyBUaGUgYmFzZSBvZiB0aGUgVVJMIGlzIHVudXNlZCBidXQgcmVxdWlyZWQgdG8gcGFyc2UgdGhlIFVSTC5cbiAgICAgICAgICAgICAgY29uc3QgcGF0aG5hbWUgPSBwYXRobmFtZVdpdGhvdXRTZXJ2ZVBhdGgocmVxLnVybCwgc2VydmVyT3B0aW9ucyk7XG5cbiAgICAgICAgICAgICAgaWYgKHBhdGhuYW1lID09PSAnLycgfHwgcGF0aG5hbWUgPT09IGAvaW5kZXguaHRtbGApIHtcbiAgICAgICAgICAgICAgICBjb25zdCByYXdIdG1sID0gb3V0cHV0RmlsZXMuZ2V0KCcvaW5kZXguaHRtbCcpPy5jb250ZW50cztcbiAgICAgICAgICAgICAgICBpZiAocmF3SHRtbCkge1xuICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtSW5kZXhIdG1sQW5kQWRkSGVhZGVycyhyZXEudXJsLCByYXdIdG1sLCByZXMsIG5leHQpO1xuXG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGZ1bmN0aW9uIHRyYW5zZm9ybUluZGV4SHRtbEFuZEFkZEhlYWRlcnMoXG4gICAgICAgICAgICB1cmw6IHN0cmluZyxcbiAgICAgICAgICAgIHJhd0h0bWw6IFVpbnQ4QXJyYXksXG4gICAgICAgICAgICByZXM6IFNlcnZlclJlc3BvbnNlPGltcG9ydCgnaHR0cCcpLkluY29taW5nTWVzc2FnZT4sXG4gICAgICAgICAgICBuZXh0OiBDb25uZWN0Lk5leHRGdW5jdGlvbixcbiAgICAgICAgICAgIGFkZGl0aW9uYWxUcmFuc2Zvcm1lcj86IChodG1sOiBzdHJpbmcpID0+IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPixcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHNlcnZlclxuICAgICAgICAgICAgICAudHJhbnNmb3JtSW5kZXhIdG1sKHVybCwgQnVmZmVyLmZyb20ocmF3SHRtbCkudG9TdHJpbmcoJ3V0Zi04JykpXG4gICAgICAgICAgICAgIC50aGVuKGFzeW5jIChwcm9jZXNzZWRIdG1sKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGFkZGl0aW9uYWxUcmFuc2Zvcm1lcikge1xuICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGFkZGl0aW9uYWxUcmFuc2Zvcm1lcihwcm9jZXNzZWRIdG1sKTtcbiAgICAgICAgICAgICAgICAgIGlmICghY29udGVudCkge1xuICAgICAgICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBwcm9jZXNzZWRIdG1sID0gY29udGVudDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAndGV4dC9odG1sJyk7XG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ2FjaGUtQ29udHJvbCcsICduby1jYWNoZScpO1xuICAgICAgICAgICAgICAgIGlmIChzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpIHtcbiAgICAgICAgICAgICAgICAgIE9iamVjdC5lbnRyaWVzKHNlcnZlck9wdGlvbnMuaGVhZGVycykuZm9yRWFjaCgoW25hbWUsIHZhbHVlXSkgPT5cbiAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihuYW1lLCB2YWx1ZSksXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMuZW5kKHByb2Nlc3NlZEh0bWwpO1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yKSA9PiBuZXh0KGVycm9yKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdLFxuICAgIG9wdGltaXplRGVwczoge1xuICAgICAgLy8gT25seSBlbmFibGUgd2l0aCBjYWNoaW5nIHNpbmNlIGl0IGNhdXNlcyBwcmVidW5kbGUgZGVwZW5kZW5jaWVzIHRvIGJlIGNhY2hlZFxuICAgICAgZGlzYWJsZWQ6ICFzZXJ2ZXJPcHRpb25zLmNhY2hlT3B0aW9ucy5lbmFibGVkLFxuICAgICAgLy8gRXhjbHVkZSBhbnkgcHJvdmlkZWQgZGVwZW5kZW5jaWVzIChjdXJyZW50bHkgYnVpbGQgZGVmaW5lZCBleHRlcm5hbHMpXG4gICAgICBleGNsdWRlOiBwcmVidW5kbGVFeGNsdWRlLFxuICAgICAgLy8gU2tpcCBhdXRvbWF0aWMgZmlsZS1iYXNlZCBlbnRyeSBwb2ludCBkaXNjb3ZlcnlcbiAgICAgIGVudHJpZXM6IFtdLFxuICAgICAgLy8gQWRkIGFuIGVzYnVpbGQgcGx1Z2luIHRvIHJ1biB0aGUgQW5ndWxhciBsaW5rZXIgb24gZGVwZW5kZW5jaWVzXG4gICAgICBlc2J1aWxkT3B0aW9uczoge1xuICAgICAgICBwbHVnaW5zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2FuZ3VsYXItdml0ZS1vcHRpbWl6ZS1kZXBzJyxcbiAgICAgICAgICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHRyYW5zZm9ybWVyID0gbmV3IEphdmFTY3JpcHRUcmFuc2Zvcm1lcihcbiAgICAgICAgICAgICAgICAvLyBBbHdheXMgZW5hYmxlIEpJVCBsaW5raW5nIHRvIHN1cHBvcnQgYXBwbGljYXRpb25zIGJ1aWx0IHdpdGggYW5kIHdpdGhvdXQgQU9ULlxuICAgICAgICAgICAgICAgIC8vIEluIGEgZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnQgdGhlIGFkZGl0aW9uYWwgc2NvcGUgaW5mb3JtYXRpb24gZG9lcyBub3RcbiAgICAgICAgICAgICAgICAvLyBoYXZlIGEgbmVnYXRpdmUgZWZmZWN0IHVubGlrZSBwcm9kdWN0aW9uIHdoZXJlIGZpbmFsIG91dHB1dCBzaXplIGlzIHJlbGV2YW50LlxuICAgICAgICAgICAgICAgIHsgc291cmNlbWFwOiAhIWJ1aWxkLmluaXRpYWxPcHRpb25zLnNvdXJjZW1hcCwgaml0OiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgMSxcbiAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5bY21dP2pzJC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgY29udGVudHM6IGF3YWl0IHRyYW5zZm9ybWVyLnRyYW5zZm9ybUZpbGUoYXJncy5wYXRoKSxcbiAgICAgICAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgYnVpbGQub25FbmQoKCkgPT4gdHJhbnNmb3JtZXIuY2xvc2UoKSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0sXG4gIH07XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMuc3NsKSB7XG4gICAgaWYgKHNlcnZlck9wdGlvbnMuc3NsQ2VydCAmJiBzZXJ2ZXJPcHRpb25zLnNzbEtleSkge1xuICAgICAgLy8gc2VydmVyIGNvbmZpZ3VyYXRpb24gaXMgZGVmaW5lZCBhYm92ZVxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgIGNvbmZpZ3VyYXRpb24uc2VydmVyIS5odHRwcyA9IHtcbiAgICAgICAgY2VydDogYXdhaXQgcmVhZEZpbGUoc2VydmVyT3B0aW9ucy5zc2xDZXJ0KSxcbiAgICAgICAga2V5OiBhd2FpdCByZWFkRmlsZShzZXJ2ZXJPcHRpb25zLnNzbEtleSksXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7IGRlZmF1bHQ6IGJhc2ljU3NsUGx1Z2luIH0gPSBhd2FpdCBpbXBvcnQoJ0B2aXRlanMvcGx1Z2luLWJhc2ljLXNzbCcpO1xuICAgICAgY29uZmlndXJhdGlvbi5wbHVnaW5zID8/PSBbXTtcbiAgICAgIGNvbmZpZ3VyYXRpb24ucGx1Z2lucy5wdXNoKGJhc2ljU3NsUGx1Z2luKCkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBjb25maWd1cmF0aW9uO1xufVxuXG5mdW5jdGlvbiBwYXRobmFtZVdpdGhvdXRTZXJ2ZVBhdGgodXJsOiBzdHJpbmcsIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zKTogc3RyaW5nIHtcbiAgY29uc3QgcGFyc2VkVXJsID0gbmV3IFVSTCh1cmwsICdodHRwOi8vbG9jYWxob3N0Jyk7XG4gIGxldCBwYXRobmFtZSA9IGRlY29kZVVSSUNvbXBvbmVudChwYXJzZWRVcmwucGF0aG5hbWUpO1xuICBpZiAoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGggJiYgcGF0aG5hbWUuc3RhcnRzV2l0aChzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCkpIHtcbiAgICBwYXRobmFtZSA9IHBhdGhuYW1lLnNsaWNlKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoLmxlbmd0aCk7XG4gICAgaWYgKHBhdGhuYW1lWzBdICE9PSAnLycpIHtcbiAgICAgIHBhdGhuYW1lID0gJy8nICsgcGF0aG5hbWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHBhdGhuYW1lO1xufVxuIl19