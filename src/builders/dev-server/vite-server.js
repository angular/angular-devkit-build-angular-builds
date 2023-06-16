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
const vite_1 = require("vite");
const javascript_transformer_1 = require("../../tools/esbuild/javascript-transformer");
const browser_esbuild_1 = require("../browser-esbuild");
const load_proxy_config_1 = require("./load-proxy-config");
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
    for await (const result of (0, browser_esbuild_1.buildEsbuildBrowserInternal)(browserOptions, context, {
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
            // Invalidate any updated files
            for (const [file, record] of generatedFiles) {
                if (record.updated) {
                    const updatedModules = server.moduleGraph.getModulesByFile(file);
                    updatedModules?.forEach((m) => server?.moduleGraph.invalidateModule(m));
                }
            }
            // Send reload command to clients
            if (serverOptions.liveReload) {
                context.logger.info('Reloading client(s)...');
                server.ws.send({
                    type: 'full-reload',
                    path: '*',
                });
            }
        }
        else {
            // Setup server and start listening
            const serverConfiguration = await setupServer(serverOptions, generatedFiles, assetFiles, browserOptions.preserveSymlinks, browserOptions.externalDependencies);
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
async function setupServer(serverOptions, outputFiles, assets, preserveSymlinks, prebundleExclude) {
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
                        const parsedUrl = new URL(req.url, 'http://localhost');
                        let pathname = decodeURIComponent(parsedUrl.pathname);
                        if (serverOptions.servePath && pathname.startsWith(serverOptions.servePath)) {
                            pathname = pathname.slice(serverOptions.servePath.length);
                            if (pathname[0] !== '/') {
                                pathname = '/' + pathname;
                            }
                        }
                        const extension = node_path_1.default.extname(pathname);
                        // Rewrite all build assets to a vite raw fs URL
                        const assetSourcePath = assets.get(pathname);
                        if (assetSourcePath !== undefined) {
                            req.url = `/@fs/${encodeURIComponent(assetSourcePath)}`;
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
                    return () => server.middlewares.use(function angularIndexMiddleware(req, res, next) {
                        if (!req.url) {
                            next();
                            return;
                        }
                        // Parse the incoming request.
                        // The base of the URL is unused but required to parse the URL.
                        const parsedUrl = new URL(req.url, 'http://localhost');
                        let pathname = parsedUrl.pathname;
                        if (serverOptions.servePath && pathname.startsWith(serverOptions.servePath)) {
                            pathname = pathname.slice(serverOptions.servePath.length);
                            if (pathname[0] !== '/') {
                                pathname = '/' + pathname;
                            }
                        }
                        if (pathname === '/' || pathname === `/index.html`) {
                            const rawHtml = outputFiles.get('/index.html')?.contents;
                            if (rawHtml) {
                                server
                                    .transformIndexHtml(req.url, Buffer.from(rawHtml).toString('utf-8'))
                                    .then((processedHtml) => {
                                    res.setHeader('Content-Type', 'text/html');
                                    res.setHeader('Cache-Control', 'no-cache');
                                    if (serverOptions.headers) {
                                        Object.entries(serverOptions.headers).forEach(([name, value]) => res.setHeader(name, value));
                                    }
                                    res.end(processedHtml);
                                })
                                    .catch((error) => next(error));
                                return;
                            }
                        }
                        next();
                    });
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
                            const transformer = new javascript_transformer_1.JavaScriptTransformer({ sourcemap: !!build.initialOptions.sourcemap }, 1);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3ZpdGUtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0gsbUNBQWtEO0FBQ2xELDhEQUFpQztBQUNqQyw2Q0FBcUQ7QUFDckQsK0NBQTRDO0FBRTVDLDBEQUE2QjtBQUM3QiwrQkFBZ0Y7QUFDaEYsdUZBQW1GO0FBQ25GLHdEQUFpRTtBQUdqRSwyREFBNkQ7QUFXN0QsU0FBUyxXQUFXLENBQUMsUUFBb0I7SUFDdkMsd0JBQXdCO0lBQ3hCLE9BQU8sSUFBQSx3QkFBVSxFQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUN4RCxDQUFDO0FBRU0sS0FBSyxTQUFTLENBQUMsQ0FBQyxhQUFhLENBQ2xDLGFBQXlDLEVBQ3pDLFdBQW1CLEVBQ25CLE9BQXVCO0lBRXZCLHNEQUFzRDtJQUN0RCxNQUFNLGlCQUFpQixHQUFHLENBQUMsTUFBTSxPQUFPLENBQUMsZ0JBQWdCLENBQ3ZELGFBQWEsQ0FBQyxhQUFhLENBQzVCLENBQTRDLENBQUM7SUFFOUMsTUFBTSxjQUFjLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQ25EO1FBQ0UsR0FBRyxpQkFBaUI7UUFDcEIsS0FBSyxFQUFFLGFBQWEsQ0FBQyxLQUFLO1FBQzFCLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSTtRQUN4QixPQUFPLEVBQUUsYUFBYSxDQUFDLE9BQU87S0FDWSxFQUM1QyxXQUFXLENBQ1osQ0FBNEMsQ0FBQztJQUM5QyxtRUFBbUU7SUFDbkUsY0FBYyxDQUFDLGdCQUFnQixHQUFHLGFBQWEsQ0FBQyxZ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QU0sSUFBQSxtQkFBUSxFQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUM7Z0JBQzNDLEdBQUcsRUFBRSxNQUFNLElBQUEsbUJBQVEsRUFBQyxhQUFhLENBQUMsTUFBTSxDQUFDO2FBQzFDLENBQUM7U0FDSDthQUFNO1lBQ0wsTUFBTSxFQUFFLE9BQU8sRUFBRSxjQUFjLEVBQUUsR0FBRyx3REFBYSwwQkFBMEIsR0FBQyxDQUFDO1lBQzdFLGFBQWEsQ0FBQyxPQUFPLEtBQXJCLGFBQWEsQ0FBQyxPQUFPLEdBQUssRUFBRSxFQUFDO1lBQzdCLGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUM7U0FDOUM7S0FDRjtJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUM7QUFoT0Qsa0NBZ09DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB0eXBlIHsganNvbiB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB0eXBlIHsgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgbG9va3VwIGFzIGxvb2t1cE1pbWVUeXBlIH0gZnJvbSAnbXJtaW1lJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgQmluYXJ5TGlrZSwgY3JlYXRlSGFzaCB9IGZyb20gJ25vZGU6Y3J5cHRvJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgdHlwZSB7IEFkZHJlc3NJbmZvIH0gZnJvbSAnbm9kZTpuZXQnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IElubGluZUNvbmZpZywgVml0ZURldlNlcnZlciwgY3JlYXRlU2VydmVyLCBub3JtYWxpemVQYXRoIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2phdmFzY3JpcHQtdHJhbnNmb3JtZXInO1xuaW1wb3J0IHsgYnVpbGRFc2J1aWxkQnJvd3NlckludGVybmFsIH0gZnJvbSAnLi4vYnJvd3Nlci1lc2J1aWxkJztcbmltcG9ydCB7IEJyb3dzZXJFc2J1aWxkT3B0aW9ucyB9IGZyb20gJy4uL2Jyb3dzZXItZXNidWlsZC9vcHRpb25zJztcbmltcG9ydCB0eXBlIHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4uL2Jyb3dzZXItZXNidWlsZC9zY2hlbWEnO1xuaW1wb3J0IHsgbG9hZFByb3h5Q29uZmlndXJhdGlvbiB9IGZyb20gJy4vbG9hZC1wcm94eS1jb25maWcnO1xuaW1wb3J0IHR5cGUgeyBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgdHlwZSB7IERldlNlcnZlckJ1aWxkZXJPdXRwdXQgfSBmcm9tICcuL3dlYnBhY2stc2VydmVyJztcblxuaW50ZXJmYWNlIE91dHB1dEZpbGVSZWNvcmQge1xuICBjb250ZW50czogVWludDhBcnJheTtcbiAgc2l6ZTogbnVtYmVyO1xuICBoYXNoPzogQnVmZmVyO1xuICB1cGRhdGVkOiBib29sZWFuO1xufVxuXG5mdW5jdGlvbiBoYXNoQ29udGVudChjb250ZW50czogQmluYXJ5TGlrZSk6IEJ1ZmZlciB7XG4gIC8vIFRPRE86IENvbnNpZGVyIHh4aGFzaFxuICByZXR1cm4gY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGNvbnRlbnRzKS5kaWdlc3QoKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uKiBzZXJ2ZVdpdGhWaXRlKFxuICBzZXJ2ZXJPcHRpb25zOiBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyxcbiAgYnVpbGRlck5hbWU6IHN0cmluZyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBBc3luY0l0ZXJhYmxlSXRlcmF0b3I8RGV2U2VydmVyQnVpbGRlck91dHB1dD4ge1xuICAvLyBHZXQgdGhlIGJyb3dzZXIgY29uZmlndXJhdGlvbiBmcm9tIHRoZSB0YXJnZXQgbmFtZS5cbiAgY29uc3QgcmF3QnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC5nZXRUYXJnZXRPcHRpb25zKFxuICAgIHNlcnZlck9wdGlvbnMuYnJvd3NlclRhcmdldCxcbiAgKSkgYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zO1xuXG4gIGNvbnN0IGJyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQudmFsaWRhdGVPcHRpb25zKFxuICAgIHtcbiAgICAgIC4uLnJhd0Jyb3dzZXJPcHRpb25zLFxuICAgICAgd2F0Y2g6IHNlcnZlck9wdGlvbnMud2F0Y2gsXG4gICAgICBwb2xsOiBzZXJ2ZXJPcHRpb25zLnBvbGwsXG4gICAgICB2ZXJib3NlOiBzZXJ2ZXJPcHRpb25zLnZlcmJvc2UsXG4gICAgfSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gICAgYnVpbGRlck5hbWUsXG4gICkpIGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJFc2J1aWxkT3B0aW9ucztcbiAgLy8gU2V0IGFsbCBwYWNrYWdlcyBhcyBleHRlcm5hbCB0byBzdXBwb3J0IFZpdGUncyBwcmVidW5kbGUgY2FjaGluZ1xuICBicm93c2VyT3B0aW9ucy5leHRlcm5hbFBhY2thZ2VzID0gc2VydmVyT3B0aW9ucy5jYWNoZU9wdGlvbnMuZW5hYmxlZDtcblxuICBpZiAoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGggPT09IHVuZGVmaW5lZCAmJiBicm93c2VyT3B0aW9ucy5iYXNlSHJlZiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGggPSBicm93c2VyT3B0aW9ucy5iYXNlSHJlZjtcbiAgfVxuXG4gIGxldCBzZXJ2ZXI6IFZpdGVEZXZTZXJ2ZXIgfCB1bmRlZmluZWQ7XG4gIGxldCBsaXN0ZW5pbmdBZGRyZXNzOiBBZGRyZXNzSW5mbyB8IHVuZGVmaW5lZDtcbiAgY29uc3QgZ2VuZXJhdGVkRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4oKTtcbiAgY29uc3QgYXNzZXRGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIC8vIFRPRE86IFN3aXRjaCB0aGlzIHRvIGFuIGFyY2hpdGVjdCBzY2hlZHVsZSBjYWxsIHdoZW4gaW5mcmFzdHJ1Y3R1cmUgc2V0dGluZ3MgYXJlIHN1cHBvcnRlZFxuICBmb3IgYXdhaXQgKGNvbnN0IHJlc3VsdCBvZiBidWlsZEVzYnVpbGRCcm93c2VySW50ZXJuYWwoYnJvd3Nlck9wdGlvbnMsIGNvbnRleHQsIHtcbiAgICB3cml0ZTogZmFsc2UsXG4gIH0pKSB7XG4gICAgYXNzZXJ0KHJlc3VsdC5vdXRwdXRGaWxlcywgJ0J1aWxkZXIgZGlkIG5vdCBwcm92aWRlIHJlc3VsdCBmaWxlcy4nKTtcblxuICAgIC8vIEFuYWx5emUgcmVzdWx0IGZpbGVzIGZvciBjaGFuZ2VzXG4gICAgYW5hbHl6ZVJlc3VsdEZpbGVzKHJlc3VsdC5vdXRwdXRGaWxlcywgZ2VuZXJhdGVkRmlsZXMpO1xuXG4gICAgYXNzZXRGaWxlcy5jbGVhcigpO1xuICAgIGlmIChyZXN1bHQuYXNzZXRGaWxlcykge1xuICAgICAgZm9yIChjb25zdCBhc3NldCBvZiByZXN1bHQuYXNzZXRGaWxlcykge1xuICAgICAgICBhc3NldEZpbGVzLnNldCgnLycgKyBub3JtYWxpemVQYXRoKGFzc2V0LmRlc3RpbmF0aW9uKSwgYXNzZXQuc291cmNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc2VydmVyKSB7XG4gICAgICAvLyBJbnZhbGlkYXRlIGFueSB1cGRhdGVkIGZpbGVzXG4gICAgICBmb3IgKGNvbnN0IFtmaWxlLCByZWNvcmRdIG9mIGdlbmVyYXRlZEZpbGVzKSB7XG4gICAgICAgIGlmIChyZWNvcmQudXBkYXRlZCkge1xuICAgICAgICAgIGNvbnN0IHVwZGF0ZWRNb2R1bGVzID0gc2VydmVyLm1vZHVsZUdyYXBoLmdldE1vZHVsZXNCeUZpbGUoZmlsZSk7XG4gICAgICAgICAgdXBkYXRlZE1vZHVsZXM/LmZvckVhY2goKG0pID0+IHNlcnZlcj8ubW9kdWxlR3JhcGguaW52YWxpZGF0ZU1vZHVsZShtKSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gU2VuZCByZWxvYWQgY29tbWFuZCB0byBjbGllbnRzXG4gICAgICBpZiAoc2VydmVyT3B0aW9ucy5saXZlUmVsb2FkKSB7XG4gICAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oJ1JlbG9hZGluZyBjbGllbnQocykuLi4nKTtcblxuICAgICAgICBzZXJ2ZXIud3Muc2VuZCh7XG4gICAgICAgICAgdHlwZTogJ2Z1bGwtcmVsb2FkJyxcbiAgICAgICAgICBwYXRoOiAnKicsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTZXR1cCBzZXJ2ZXIgYW5kIHN0YXJ0IGxpc3RlbmluZ1xuICAgICAgY29uc3Qgc2VydmVyQ29uZmlndXJhdGlvbiA9IGF3YWl0IHNldHVwU2VydmVyKFxuICAgICAgICBzZXJ2ZXJPcHRpb25zLFxuICAgICAgICBnZW5lcmF0ZWRGaWxlcyxcbiAgICAgICAgYXNzZXRGaWxlcyxcbiAgICAgICAgYnJvd3Nlck9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgICAgYnJvd3Nlck9wdGlvbnMuZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgICApO1xuICAgICAgc2VydmVyID0gYXdhaXQgY3JlYXRlU2VydmVyKHNlcnZlckNvbmZpZ3VyYXRpb24pO1xuXG4gICAgICBhd2FpdCBzZXJ2ZXIubGlzdGVuKCk7XG4gICAgICBsaXN0ZW5pbmdBZGRyZXNzID0gc2VydmVyLmh0dHBTZXJ2ZXI/LmFkZHJlc3MoKSBhcyBBZGRyZXNzSW5mbztcblxuICAgICAgLy8gbG9nIGNvbm5lY3Rpb24gaW5mb3JtYXRpb25cbiAgICAgIHNlcnZlci5wcmludFVybHMoKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBhZGp1c3Qgb3V0cHV0IHR5cGluZ3MgdG8gcmVmbGVjdCBib3RoIGRldmVsb3BtZW50IHNlcnZlcnNcbiAgICB5aWVsZCB7IHN1Y2Nlc3M6IHRydWUsIHBvcnQ6IGxpc3RlbmluZ0FkZHJlc3M/LnBvcnQgfSBhcyB1bmtub3duIGFzIERldlNlcnZlckJ1aWxkZXJPdXRwdXQ7XG4gIH1cblxuICBpZiAoc2VydmVyKSB7XG4gICAgbGV0IGRlZmVycmVkOiAoKSA9PiB2b2lkO1xuICAgIGNvbnRleHQuYWRkVGVhcmRvd24oYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgc2VydmVyPy5jbG9zZSgpO1xuICAgICAgZGVmZXJyZWQ/LigpO1xuICAgIH0pO1xuICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiAoZGVmZXJyZWQgPSByZXNvbHZlKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gYW5hbHl6ZVJlc3VsdEZpbGVzKFxuICByZXN1bHRGaWxlczogT3V0cHV0RmlsZVtdLFxuICBnZW5lcmF0ZWRGaWxlczogTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4sXG4pIHtcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPihbJy9pbmRleC5odG1sJ10pO1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgcmVzdWx0RmlsZXMpIHtcbiAgICBjb25zdCBmaWxlUGF0aCA9ICcvJyArIG5vcm1hbGl6ZVBhdGgoZmlsZS5wYXRoKTtcbiAgICBzZWVuLmFkZChmaWxlUGF0aCk7XG5cbiAgICAvLyBTa2lwIGFuYWx5c2lzIG9mIHNvdXJjZW1hcHNcbiAgICBpZiAoZmlsZVBhdGguZW5kc1dpdGgoJy5tYXAnKSkge1xuICAgICAgZ2VuZXJhdGVkRmlsZXMuc2V0KGZpbGVQYXRoLCB7XG4gICAgICAgIGNvbnRlbnRzOiBmaWxlLmNvbnRlbnRzLFxuICAgICAgICBzaXplOiBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgsXG4gICAgICAgIHVwZGF0ZWQ6IGZhbHNlLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGxldCBmaWxlSGFzaDogQnVmZmVyIHwgdW5kZWZpbmVkO1xuICAgIGNvbnN0IGV4aXN0aW5nUmVjb3JkID0gZ2VuZXJhdGVkRmlsZXMuZ2V0KGZpbGVQYXRoKTtcbiAgICBpZiAoZXhpc3RpbmdSZWNvcmQgJiYgZXhpc3RpbmdSZWNvcmQuc2l6ZSA9PT0gZmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoKSB7XG4gICAgICAvLyBPbmx5IGhhc2ggZXhpc3RpbmcgZmlsZSB3aGVuIG5lZWRlZFxuICAgICAgaWYgKGV4aXN0aW5nUmVjb3JkLmhhc2ggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBleGlzdGluZ1JlY29yZC5oYXNoID0gaGFzaENvbnRlbnQoZXhpc3RpbmdSZWNvcmQuY29udGVudHMpO1xuICAgICAgfVxuXG4gICAgICAvLyBDb21wYXJlIGFnYWluc3QgbGF0ZXN0IHJlc3VsdCBvdXRwdXRcbiAgICAgIGZpbGVIYXNoID0gaGFzaENvbnRlbnQoZmlsZS5jb250ZW50cyk7XG4gICAgICBpZiAoZmlsZUhhc2guZXF1YWxzKGV4aXN0aW5nUmVjb3JkLmhhc2gpKSB7XG4gICAgICAgIC8vIFNhbWUgZmlsZVxuICAgICAgICBleGlzdGluZ1JlY29yZC51cGRhdGVkID0gZmFsc2U7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGdlbmVyYXRlZEZpbGVzLnNldChmaWxlUGF0aCwge1xuICAgICAgY29udGVudHM6IGZpbGUuY29udGVudHMsXG4gICAgICBzaXplOiBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgsXG4gICAgICBoYXNoOiBmaWxlSGFzaCxcbiAgICAgIHVwZGF0ZWQ6IHRydWUsXG4gICAgfSk7XG4gIH1cblxuICAvLyBDbGVhciBzdGFsZSBvdXRwdXQgZmlsZXNcbiAgZm9yIChjb25zdCBmaWxlIG9mIGdlbmVyYXRlZEZpbGVzLmtleXMoKSkge1xuICAgIGlmICghc2Vlbi5oYXMoZmlsZSkpIHtcbiAgICAgIGdlbmVyYXRlZEZpbGVzLmRlbGV0ZShmaWxlKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXR1cFNlcnZlcihcbiAgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMsXG4gIG91dHB1dEZpbGVzOiBNYXA8c3RyaW5nLCBPdXRwdXRGaWxlUmVjb3JkPixcbiAgYXNzZXRzOiBNYXA8c3RyaW5nLCBzdHJpbmc+LFxuICBwcmVzZXJ2ZVN5bWxpbmtzOiBib29sZWFuIHwgdW5kZWZpbmVkLFxuICBwcmVidW5kbGVFeGNsdWRlOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCxcbik6IFByb21pc2U8SW5saW5lQ29uZmlnPiB7XG4gIGNvbnN0IHByb3h5ID0gYXdhaXQgbG9hZFByb3h5Q29uZmlndXJhdGlvbihcbiAgICBzZXJ2ZXJPcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgc2VydmVyT3B0aW9ucy5wcm94eUNvbmZpZyxcbiAgICB0cnVlLFxuICApO1xuXG4gIGNvbnN0IGNvbmZpZ3VyYXRpb246IElubGluZUNvbmZpZyA9IHtcbiAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICBlbnZGaWxlOiBmYWxzZSxcbiAgICBjYWNoZURpcjogcGF0aC5qb2luKHNlcnZlck9wdGlvbnMuY2FjaGVPcHRpb25zLnBhdGgsICd2aXRlJyksXG4gICAgcm9vdDogc2VydmVyT3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIHB1YmxpY0RpcjogZmFsc2UsXG4gICAgZXNidWlsZDogZmFsc2UsXG4gICAgbW9kZTogJ2RldmVsb3BtZW50JyxcbiAgICBhcHBUeXBlOiAnc3BhJyxcbiAgICBjc3M6IHtcbiAgICAgIGRldlNvdXJjZW1hcDogdHJ1ZSxcbiAgICB9LFxuICAgIGJhc2U6IHNlcnZlck9wdGlvbnMuc2VydmVQYXRoLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgfSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHBvcnQ6IHNlcnZlck9wdGlvbnMucG9ydCxcbiAgICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgICBob3N0OiBzZXJ2ZXJPcHRpb25zLmhvc3QsXG4gICAgICBvcGVuOiBzZXJ2ZXJPcHRpb25zLm9wZW4sXG4gICAgICBoZWFkZXJzOiBzZXJ2ZXJPcHRpb25zLmhlYWRlcnMsXG4gICAgICBwcm94eSxcbiAgICAgIC8vIEN1cnJlbnRseSBkb2VzIG5vdCBhcHBlYXIgdG8gYmUgYSB3YXkgdG8gZGlzYWJsZSBmaWxlIHdhdGNoaW5nIGRpcmVjdGx5IHNvIGlnbm9yZSBhbGwgZmlsZXNcbiAgICAgIHdhdGNoOiB7XG4gICAgICAgIGlnbm9yZWQ6IFsnKiovKiddLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ3ZpdGU6YW5ndWxhci1tZW1vcnknLFxuICAgICAgICAvLyBFbnN1cmVzIHBsdWdpbiBob29rcyBydW4gYmVmb3JlIGJ1aWx0LWluIFZpdGUgaG9va3NcbiAgICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICAgIGFzeW5jIHJlc29sdmVJZChzb3VyY2UsIGltcG9ydGVyKSB7XG4gICAgICAgICAgaWYgKGltcG9ydGVyICYmIHNvdXJjZS5zdGFydHNXaXRoKCcuJykpIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBxdWVyeSBpZiBwcmVzZW50XG4gICAgICAgICAgICBjb25zdCBbaW1wb3J0ZXJGaWxlXSA9IGltcG9ydGVyLnNwbGl0KCc/JywgMSk7XG5cbiAgICAgICAgICAgIHNvdXJjZSA9IG5vcm1hbGl6ZVBhdGgocGF0aC5qb2luKHBhdGguZGlybmFtZShpbXBvcnRlckZpbGUpLCBzb3VyY2UpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBbZmlsZV0gPSBzb3VyY2Uuc3BsaXQoJz8nLCAxKTtcbiAgICAgICAgICBpZiAob3V0cHV0RmlsZXMuaGFzKGZpbGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gc291cmNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgbG9hZChpZCkge1xuICAgICAgICAgIGNvbnN0IFtmaWxlXSA9IGlkLnNwbGl0KCc/JywgMSk7XG4gICAgICAgICAgY29uc3QgY29kZUNvbnRlbnRzID0gb3V0cHV0RmlsZXMuZ2V0KGZpbGUpPy5jb250ZW50cztcbiAgICAgICAgICBpZiAoY29kZUNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBjb2RlID0gQnVmZmVyLmZyb20oY29kZUNvbnRlbnRzKS50b1N0cmluZygndXRmLTgnKTtcbiAgICAgICAgICBjb25zdCBtYXBDb250ZW50cyA9IG91dHB1dEZpbGVzLmdldChmaWxlICsgJy5tYXAnKT8uY29udGVudHM7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIHNvdXJjZSBtYXAgVVJMIGNvbW1lbnRzIGZyb20gdGhlIGNvZGUgaWYgYSBzb3VyY2VtYXAgaXMgcHJlc2VudC5cbiAgICAgICAgICAgIC8vIFZpdGUgd2lsbCBpbmxpbmUgYW5kIGFkZCBhbiBhZGRpdGlvbmFsIHNvdXJjZW1hcCBVUkwgZm9yIHRoZSBzb3VyY2VtYXAuXG4gICAgICAgICAgICBjb2RlOiBtYXBDb250ZW50cyA/IGNvZGUucmVwbGFjZSgvXlxcL1xcLyMgc291cmNlTWFwcGluZ1VSTD1bXlxcclxcbl0qL2dtLCAnJykgOiBjb2RlLFxuICAgICAgICAgICAgbWFwOiBtYXBDb250ZW50cyAmJiBCdWZmZXIuZnJvbShtYXBDb250ZW50cykudG9TdHJpbmcoJ3V0Zi04JyksXG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgICAgIC8vIEFzc2V0cyBhbmQgcmVzb3VyY2VzIGdldCBoYW5kbGVkIGZpcnN0XG4gICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShmdW5jdGlvbiBhbmd1bGFyQXNzZXRzTWlkZGxld2FyZShyZXEsIHJlcywgbmV4dCkge1xuICAgICAgICAgICAgaWYgKHJlcS51cmwgPT09IHVuZGVmaW5lZCB8fCByZXMud3JpdGFibGVFbmRlZCkge1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFBhcnNlIHRoZSBpbmNvbWluZyByZXF1ZXN0LlxuICAgICAgICAgICAgLy8gVGhlIGJhc2Ugb2YgdGhlIFVSTCBpcyB1bnVzZWQgYnV0IHJlcXVpcmVkIHRvIHBhcnNlIHRoZSBVUkwuXG4gICAgICAgICAgICBjb25zdCBwYXJzZWRVcmwgPSBuZXcgVVJMKHJlcS51cmwsICdodHRwOi8vbG9jYWxob3N0Jyk7XG4gICAgICAgICAgICBsZXQgcGF0aG5hbWUgPSBkZWNvZGVVUklDb21wb25lbnQocGFyc2VkVXJsLnBhdGhuYW1lKTtcbiAgICAgICAgICAgIGlmIChzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCAmJiBwYXRobmFtZS5zdGFydHNXaXRoKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoKSkge1xuICAgICAgICAgICAgICBwYXRobmFtZSA9IHBhdGhuYW1lLnNsaWNlKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoLmxlbmd0aCk7XG4gICAgICAgICAgICAgIGlmIChwYXRobmFtZVswXSAhPT0gJy8nKSB7XG4gICAgICAgICAgICAgICAgcGF0aG5hbWUgPSAnLycgKyBwYXRobmFtZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9uID0gcGF0aC5leHRuYW1lKHBhdGhuYW1lKTtcblxuICAgICAgICAgICAgLy8gUmV3cml0ZSBhbGwgYnVpbGQgYXNzZXRzIHRvIGEgdml0ZSByYXcgZnMgVVJMXG4gICAgICAgICAgICBjb25zdCBhc3NldFNvdXJjZVBhdGggPSBhc3NldHMuZ2V0KHBhdGhuYW1lKTtcbiAgICAgICAgICAgIGlmIChhc3NldFNvdXJjZVBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICByZXEudXJsID0gYC9AZnMvJHtlbmNvZGVVUklDb21wb25lbnQoYXNzZXRTb3VyY2VQYXRoKX1gO1xuICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZXNvdXJjZSBmaWxlcyBhcmUgaGFuZGxlZCBkaXJlY3RseS5cbiAgICAgICAgICAgIC8vIEdsb2JhbCBzdHlsZXNoZWV0cyAoQ1NTIGZpbGVzKSBhcmUgY3VycmVudGx5IGNvbnNpZGVyZWQgcmVzb3VyY2VzIHRvIHdvcmthcm91bmRcbiAgICAgICAgICAgIC8vIGRldiBzZXJ2ZXIgc291cmNlbWFwIGlzc3VlcyB3aXRoIHN0eWxlc2hlZXRzLlxuICAgICAgICAgICAgaWYgKGV4dGVuc2lvbiAhPT0gJy5qcycgJiYgZXh0ZW5zaW9uICE9PSAnLmh0bWwnKSB7XG4gICAgICAgICAgICAgIGNvbnN0IG91dHB1dEZpbGUgPSBvdXRwdXRGaWxlcy5nZXQocGF0aG5hbWUpO1xuICAgICAgICAgICAgICBpZiAob3V0cHV0RmlsZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pbWVUeXBlID0gbG9va3VwTWltZVR5cGUoZXh0ZW5zaW9uKTtcbiAgICAgICAgICAgICAgICBpZiAobWltZVR5cGUpIHtcbiAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsIG1pbWVUeXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ2FjaGUtQ29udHJvbCcsICduby1jYWNoZScpO1xuICAgICAgICAgICAgICAgIGlmIChzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpIHtcbiAgICAgICAgICAgICAgICAgIE9iamVjdC5lbnRyaWVzKHNlcnZlck9wdGlvbnMuaGVhZGVycykuZm9yRWFjaCgoW25hbWUsIHZhbHVlXSkgPT5cbiAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihuYW1lLCB2YWx1ZSksXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMuZW5kKG91dHB1dEZpbGUuY29udGVudHMpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIFJldHVybmluZyBhIGZ1bmN0aW9uLCBpbnN0YWxscyBtaWRkbGV3YXJlIGFmdGVyIHRoZSBtYWluIHRyYW5zZm9ybSBtaWRkbGV3YXJlIGJ1dFxuICAgICAgICAgIC8vIGJlZm9yZSB0aGUgYnVpbHQtaW4gSFRNTCBtaWRkbGV3YXJlXG4gICAgICAgICAgcmV0dXJuICgpID0+XG4gICAgICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGZ1bmN0aW9uIGFuZ3VsYXJJbmRleE1pZGRsZXdhcmUocmVxLCByZXMsIG5leHQpIHtcbiAgICAgICAgICAgICAgaWYgKCFyZXEudXJsKSB7XG4gICAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gUGFyc2UgdGhlIGluY29taW5nIHJlcXVlc3QuXG4gICAgICAgICAgICAgIC8vIFRoZSBiYXNlIG9mIHRoZSBVUkwgaXMgdW51c2VkIGJ1dCByZXF1aXJlZCB0byBwYXJzZSB0aGUgVVJMLlxuICAgICAgICAgICAgICBjb25zdCBwYXJzZWRVcmwgPSBuZXcgVVJMKHJlcS51cmwsICdodHRwOi8vbG9jYWxob3N0Jyk7XG4gICAgICAgICAgICAgIGxldCBwYXRobmFtZSA9IHBhcnNlZFVybC5wYXRobmFtZTtcbiAgICAgICAgICAgICAgaWYgKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoICYmIHBhdGhuYW1lLnN0YXJ0c1dpdGgoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgpKSB7XG4gICAgICAgICAgICAgICAgcGF0aG5hbWUgPSBwYXRobmFtZS5zbGljZShzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aC5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIGlmIChwYXRobmFtZVswXSAhPT0gJy8nKSB7XG4gICAgICAgICAgICAgICAgICBwYXRobmFtZSA9ICcvJyArIHBhdGhuYW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAocGF0aG5hbWUgPT09ICcvJyB8fCBwYXRobmFtZSA9PT0gYC9pbmRleC5odG1sYCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJhd0h0bWwgPSBvdXRwdXRGaWxlcy5nZXQoJy9pbmRleC5odG1sJyk/LmNvbnRlbnRzO1xuICAgICAgICAgICAgICAgIGlmIChyYXdIdG1sKSB7XG4gICAgICAgICAgICAgICAgICBzZXJ2ZXJcbiAgICAgICAgICAgICAgICAgICAgLnRyYW5zZm9ybUluZGV4SHRtbChyZXEudXJsLCBCdWZmZXIuZnJvbShyYXdIdG1sKS50b1N0cmluZygndXRmLTgnKSlcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oKHByb2Nlc3NlZEh0bWwpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAndGV4dC9odG1sJyk7XG4gICAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ2FjaGUtQ29udHJvbCcsICduby1jYWNoZScpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5lbnRyaWVzKHNlcnZlck9wdGlvbnMuaGVhZGVycykuZm9yRWFjaCgoW25hbWUsIHZhbHVlXSkgPT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihuYW1lLCB2YWx1ZSksXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICByZXMuZW5kKHByb2Nlc3NlZEh0bWwpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yKSA9PiBuZXh0KGVycm9yKSk7XG5cbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgXSxcbiAgICBvcHRpbWl6ZURlcHM6IHtcbiAgICAgIC8vIE9ubHkgZW5hYmxlIHdpdGggY2FjaGluZyBzaW5jZSBpdCBjYXVzZXMgcHJlYnVuZGxlIGRlcGVuZGVuY2llcyB0byBiZSBjYWNoZWRcbiAgICAgIGRpc2FibGVkOiAhc2VydmVyT3B0aW9ucy5jYWNoZU9wdGlvbnMuZW5hYmxlZCxcbiAgICAgIC8vIEV4Y2x1ZGUgYW55IHByb3ZpZGVkIGRlcGVuZGVuY2llcyAoY3VycmVudGx5IGJ1aWxkIGRlZmluZWQgZXh0ZXJuYWxzKVxuICAgICAgZXhjbHVkZTogcHJlYnVuZGxlRXhjbHVkZSxcbiAgICAgIC8vIFNraXAgYXV0b21hdGljIGZpbGUtYmFzZWQgZW50cnkgcG9pbnQgZGlzY292ZXJ5XG4gICAgICBlbnRyaWVzOiBbXSxcbiAgICAgIC8vIEFkZCBhbiBlc2J1aWxkIHBsdWdpbiB0byBydW4gdGhlIEFuZ3VsYXIgbGlua2VyIG9uIGRlcGVuZGVuY2llc1xuICAgICAgZXNidWlsZE9wdGlvbnM6IHtcbiAgICAgICAgcGx1Z2luczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdhbmd1bGFyLXZpdGUtb3B0aW1pemUtZGVwcycsXG4gICAgICAgICAgICBzZXR1cChidWlsZCkge1xuICAgICAgICAgICAgICBjb25zdCB0cmFuc2Zvcm1lciA9IG5ldyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIoXG4gICAgICAgICAgICAgICAgeyBzb3VyY2VtYXA6ICEhYnVpbGQuaW5pdGlhbE9wdGlvbnMuc291cmNlbWFwIH0sXG4gICAgICAgICAgICAgICAgMSxcbiAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5bY21dP2pzJC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgY29udGVudHM6IGF3YWl0IHRyYW5zZm9ybWVyLnRyYW5zZm9ybUZpbGUoYXJncy5wYXRoKSxcbiAgICAgICAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgYnVpbGQub25FbmQoKCkgPT4gdHJhbnNmb3JtZXIuY2xvc2UoKSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0sXG4gIH07XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMuc3NsKSB7XG4gICAgaWYgKHNlcnZlck9wdGlvbnMuc3NsQ2VydCAmJiBzZXJ2ZXJPcHRpb25zLnNzbEtleSkge1xuICAgICAgLy8gc2VydmVyIGNvbmZpZ3VyYXRpb24gaXMgZGVmaW5lZCBhYm92ZVxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgIGNvbmZpZ3VyYXRpb24uc2VydmVyIS5odHRwcyA9IHtcbiAgICAgICAgY2VydDogYXdhaXQgcmVhZEZpbGUoc2VydmVyT3B0aW9ucy5zc2xDZXJ0KSxcbiAgICAgICAga2V5OiBhd2FpdCByZWFkRmlsZShzZXJ2ZXJPcHRpb25zLnNzbEtleSksXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7IGRlZmF1bHQ6IGJhc2ljU3NsUGx1Z2luIH0gPSBhd2FpdCBpbXBvcnQoJ0B2aXRlanMvcGx1Z2luLWJhc2ljLXNzbCcpO1xuICAgICAgY29uZmlndXJhdGlvbi5wbHVnaW5zID8/PSBbXTtcbiAgICAgIGNvbmZpZ3VyYXRpb24ucGx1Z2lucy5wdXNoKGJhc2ljU3NsUGx1Z2luKCkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBjb25maWd1cmF0aW9uO1xufVxuIl19