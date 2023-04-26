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
exports.serveWithVite = void 0;
const mrmime_1 = require("mrmime");
const node_assert_1 = __importDefault(require("node:assert"));
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const vite_1 = require("vite");
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
    let server;
    let listeningAddress;
    const outputFiles = new Map();
    const assets = new Map();
    // TODO: Switch this to an architect schedule call when infrastructure settings are supported
    for await (const result of (0, browser_esbuild_1.buildEsbuildBrowser)(browserOptions, context, { write: false })) {
        (0, node_assert_1.default)(result.outputFiles, 'Builder did not provide result files.');
        // Analyze result files for changes
        const seen = new Set(['/index.html']);
        for (const file of result.outputFiles) {
            const filePath = '/' + (0, vite_1.normalizePath)(file.path);
            seen.add(filePath);
            // Skip analysis of sourcemaps
            if (filePath.endsWith('.map')) {
                outputFiles.set(filePath, {
                    contents: file.contents,
                    size: file.contents.byteLength,
                    updated: false,
                });
                continue;
            }
            let fileHash;
            const existingRecord = outputFiles.get(filePath);
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
            outputFiles.set(filePath, {
                contents: file.contents,
                size: file.contents.byteLength,
                hash: fileHash,
                updated: true,
            });
        }
        // Clear stale output files
        for (const file of outputFiles.keys()) {
            if (!seen.has(file)) {
                outputFiles.delete(file);
            }
        }
        assets.clear();
        if (result.assetFiles) {
            for (const asset of result.assetFiles) {
                assets.set('/' + (0, vite_1.normalizePath)(asset.destination), asset.source);
            }
        }
        if (server) {
            // Invalidate any updated files
            for (const [file, record] of outputFiles) {
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
            server = await setupServer(serverOptions, outputFiles, assets);
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
async function setupServer(serverOptions, outputFiles, assets) {
    const proxy = await (0, load_proxy_config_1.loadProxyConfiguration)(serverOptions.workspaceRoot, serverOptions.proxyConfig);
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
                        const extension = node_path_1.default.extname(parsedUrl.pathname);
                        // Rewrite all build assets to a vite raw fs URL
                        const assetSourcePath = assets.get(parsedUrl.pathname);
                        if (assetSourcePath !== undefined) {
                            req.url = `/@fs/${assetSourcePath}`;
                            next();
                            return;
                        }
                        // Resource files are handled directly.
                        // Global stylesheets (CSS files) are currently considered resources to workaround
                        // dev server sourcemap issues with stylesheets.
                        if (extension !== '.js' && extension !== '.html') {
                            const outputFile = outputFiles.get(parsedUrl.pathname);
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
                        if (req.url === '/' || req.url === `/index.html`) {
                            const rawHtml = outputFiles.get('/index.html')?.contents;
                            if (rawHtml) {
                                server
                                    .transformIndexHtml(req.url, Buffer.from(rawHtml).toString('utf-8'), req.originalUrl)
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
            // TODO: Consider enabling for known safe dependencies (@angular/* ?)
            disabled: true,
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
    const server = await (0, vite_1.createServer)(configuration);
    return server;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3ZpdGUtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBSUgsbUNBQWtEO0FBQ2xELDhEQUFpQztBQUNqQyw2Q0FBcUQ7QUFDckQsK0NBQTRDO0FBRTVDLDBEQUE2QjtBQUM3QiwrQkFBZ0Y7QUFDaEYsd0RBQXlEO0FBRXpELDJEQUE2RDtBQVc3RCxTQUFTLFdBQVcsQ0FBQyxRQUFvQjtJQUN2Qyx3QkFBd0I7SUFDeEIsT0FBTyxJQUFBLHdCQUFVLEVBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQ3hELENBQUM7QUFFTSxLQUFLLFNBQVMsQ0FBQyxDQUFDLGFBQWEsQ0FDbEMsYUFBeUMsRUFDekMsV0FBbUIsRUFDbkIsT0FBdUI7SUFFdkIsc0RBQXNEO0lBQ3RELE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FDdkQsYUFBYSxDQUFDLGFBQWEsQ0FDNUIsQ0FBNEMsQ0FBQztJQUU5QyxNQUFNLGNBQWMsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FDbkQ7UUFDRSxHQUFHLGlCQUFpQjtRQUNwQixLQUFLLEVBQUUsYUFBYSxDQUFDLEtBQUs7UUFDMUIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJO1FBQ3hCLE9BQU8sRUFBRSxhQUFhLENBQUMsT0FBTztLQUNZLEVBQzVDLFdBQVcsQ0FDWixDQUE0QyxDQUFDO0lBRTlDLElBQUksTUFBaUMsQ0FBQztJQUN0QyxJQUFJLGdCQUF5QyxDQUFDO0lBQzlDLE1BQU0sV0FBVyxHQUFH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QUFDO2FBQzFDLENBQUM7U0FDSDthQUFNO1lBQ0wsTUFBTSxFQUFFLE9BQU8sRUFBRSxjQUFjLEVBQUUsR0FBRyx3REFBYSwwQkFBMEIsR0FBQyxDQUFDO1lBQzdFLGFBQWEsQ0FBQyxPQUFPLEtBQXJCLGFBQWEsQ0FBQyxPQUFPLEdBQUssRUFBRSxFQUFDO1lBQzdCLGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUM7U0FDOUM7S0FDRjtJQUVELE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBQSxtQkFBWSxFQUFDLGFBQWEsQ0FBQyxDQUFDO0lBRWpELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHR5cGUgeyBqc29uIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgbG9va3VwIGFzIGxvb2t1cE1pbWVUeXBlIH0gZnJvbSAnbXJtaW1lJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgQmluYXJ5TGlrZSwgY3JlYXRlSGFzaCB9IGZyb20gJ25vZGU6Y3J5cHRvJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgdHlwZSB7IEFkZHJlc3NJbmZvIH0gZnJvbSAnbm9kZTpuZXQnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IElubGluZUNvbmZpZywgVml0ZURldlNlcnZlciwgY3JlYXRlU2VydmVyLCBub3JtYWxpemVQYXRoIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyBidWlsZEVzYnVpbGRCcm93c2VyIH0gZnJvbSAnLi4vYnJvd3Nlci1lc2J1aWxkJztcbmltcG9ydCB0eXBlIHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4uL2Jyb3dzZXItZXNidWlsZC9zY2hlbWEnO1xuaW1wb3J0IHsgbG9hZFByb3h5Q29uZmlndXJhdGlvbiB9IGZyb20gJy4vbG9hZC1wcm94eS1jb25maWcnO1xuaW1wb3J0IHR5cGUgeyBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgdHlwZSB7IERldlNlcnZlckJ1aWxkZXJPdXRwdXQgfSBmcm9tICcuL3dlYnBhY2stc2VydmVyJztcblxuaW50ZXJmYWNlIE91dHB1dEZpbGVSZWNvcmQge1xuICBjb250ZW50czogVWludDhBcnJheTtcbiAgc2l6ZTogbnVtYmVyO1xuICBoYXNoPzogQnVmZmVyO1xuICB1cGRhdGVkOiBib29sZWFuO1xufVxuXG5mdW5jdGlvbiBoYXNoQ29udGVudChjb250ZW50czogQmluYXJ5TGlrZSk6IEJ1ZmZlciB7XG4gIC8vIFRPRE86IENvbnNpZGVyIHh4aGFzaFxuICByZXR1cm4gY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGNvbnRlbnRzKS5kaWdlc3QoKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uKiBzZXJ2ZVdpdGhWaXRlKFxuICBzZXJ2ZXJPcHRpb25zOiBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyxcbiAgYnVpbGRlck5hbWU6IHN0cmluZyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBBc3luY0l0ZXJhYmxlSXRlcmF0b3I8RGV2U2VydmVyQnVpbGRlck91dHB1dD4ge1xuICAvLyBHZXQgdGhlIGJyb3dzZXIgY29uZmlndXJhdGlvbiBmcm9tIHRoZSB0YXJnZXQgbmFtZS5cbiAgY29uc3QgcmF3QnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC5nZXRUYXJnZXRPcHRpb25zKFxuICAgIHNlcnZlck9wdGlvbnMuYnJvd3NlclRhcmdldCxcbiAgKSkgYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zO1xuXG4gIGNvbnN0IGJyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQudmFsaWRhdGVPcHRpb25zKFxuICAgIHtcbiAgICAgIC4uLnJhd0Jyb3dzZXJPcHRpb25zLFxuICAgICAgd2F0Y2g6IHNlcnZlck9wdGlvbnMud2F0Y2gsXG4gICAgICBwb2xsOiBzZXJ2ZXJPcHRpb25zLnBvbGwsXG4gICAgICB2ZXJib3NlOiBzZXJ2ZXJPcHRpb25zLnZlcmJvc2UsXG4gICAgfSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gICAgYnVpbGRlck5hbWUsXG4gICkpIGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyT3B0aW9ucztcblxuICBsZXQgc2VydmVyOiBWaXRlRGV2U2VydmVyIHwgdW5kZWZpbmVkO1xuICBsZXQgbGlzdGVuaW5nQWRkcmVzczogQWRkcmVzc0luZm8gfCB1bmRlZmluZWQ7XG4gIGNvbnN0IG91dHB1dEZpbGVzID0gbmV3IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+KCk7XG4gIGNvbnN0IGFzc2V0cyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIC8vIFRPRE86IFN3aXRjaCB0aGlzIHRvIGFuIGFyY2hpdGVjdCBzY2hlZHVsZSBjYWxsIHdoZW4gaW5mcmFzdHJ1Y3R1cmUgc2V0dGluZ3MgYXJlIHN1cHBvcnRlZFxuICBmb3IgYXdhaXQgKGNvbnN0IHJlc3VsdCBvZiBidWlsZEVzYnVpbGRCcm93c2VyKGJyb3dzZXJPcHRpb25zLCBjb250ZXh0LCB7IHdyaXRlOiBmYWxzZSB9KSkge1xuICAgIGFzc2VydChyZXN1bHQub3V0cHV0RmlsZXMsICdCdWlsZGVyIGRpZCBub3QgcHJvdmlkZSByZXN1bHQgZmlsZXMuJyk7XG5cbiAgICAvLyBBbmFseXplIHJlc3VsdCBmaWxlcyBmb3IgY2hhbmdlc1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oWycvaW5kZXguaHRtbCddKTtcbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgcmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgICBjb25zdCBmaWxlUGF0aCA9ICcvJyArIG5vcm1hbGl6ZVBhdGgoZmlsZS5wYXRoKTtcbiAgICAgIHNlZW4uYWRkKGZpbGVQYXRoKTtcblxuICAgICAgLy8gU2tpcCBhbmFseXNpcyBvZiBzb3VyY2VtYXBzXG4gICAgICBpZiAoZmlsZVBhdGguZW5kc1dpdGgoJy5tYXAnKSkge1xuICAgICAgICBvdXRwdXRGaWxlcy5zZXQoZmlsZVBhdGgsIHtcbiAgICAgICAgICBjb250ZW50czogZmlsZS5jb250ZW50cyxcbiAgICAgICAgICBzaXplOiBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgsXG4gICAgICAgICAgdXBkYXRlZDogZmFsc2UsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBsZXQgZmlsZUhhc2g6IEJ1ZmZlciB8IHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IGV4aXN0aW5nUmVjb3JkID0gb3V0cHV0RmlsZXMuZ2V0KGZpbGVQYXRoKTtcbiAgICAgIGlmIChleGlzdGluZ1JlY29yZCAmJiBleGlzdGluZ1JlY29yZC5zaXplID09PSBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgLy8gT25seSBoYXNoIGV4aXN0aW5nIGZpbGUgd2hlbiBuZWVkZWRcbiAgICAgICAgaWYgKGV4aXN0aW5nUmVjb3JkLmhhc2ggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGV4aXN0aW5nUmVjb3JkLmhhc2ggPSBoYXNoQ29udGVudChleGlzdGluZ1JlY29yZC5jb250ZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb21wYXJlIGFnYWluc3QgbGF0ZXN0IHJlc3VsdCBvdXRwdXRcbiAgICAgICAgZmlsZUhhc2ggPSBoYXNoQ29udGVudChmaWxlLmNvbnRlbnRzKTtcbiAgICAgICAgaWYgKGZpbGVIYXNoLmVxdWFscyhleGlzdGluZ1JlY29yZC5oYXNoKSkge1xuICAgICAgICAgIC8vIFNhbWUgZmlsZVxuICAgICAgICAgIGV4aXN0aW5nUmVjb3JkLnVwZGF0ZWQgPSBmYWxzZTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBvdXRwdXRGaWxlcy5zZXQoZmlsZVBhdGgsIHtcbiAgICAgICAgY29udGVudHM6IGZpbGUuY29udGVudHMsXG4gICAgICAgIHNpemU6IGZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCxcbiAgICAgICAgaGFzaDogZmlsZUhhc2gsXG4gICAgICAgIHVwZGF0ZWQ6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBDbGVhciBzdGFsZSBvdXRwdXQgZmlsZXNcbiAgICBmb3IgKGNvbnN0IGZpbGUgb2Ygb3V0cHV0RmlsZXMua2V5cygpKSB7XG4gICAgICBpZiAoIXNlZW4uaGFzKGZpbGUpKSB7XG4gICAgICAgIG91dHB1dEZpbGVzLmRlbGV0ZShmaWxlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhc3NldHMuY2xlYXIoKTtcbiAgICBpZiAocmVzdWx0LmFzc2V0RmlsZXMpIHtcbiAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgcmVzdWx0LmFzc2V0RmlsZXMpIHtcbiAgICAgICAgYXNzZXRzLnNldCgnLycgKyBub3JtYWxpemVQYXRoKGFzc2V0LmRlc3RpbmF0aW9uKSwgYXNzZXQuc291cmNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc2VydmVyKSB7XG4gICAgICAvLyBJbnZhbGlkYXRlIGFueSB1cGRhdGVkIGZpbGVzXG4gICAgICBmb3IgKGNvbnN0IFtmaWxlLCByZWNvcmRdIG9mIG91dHB1dEZpbGVzKSB7XG4gICAgICAgIGlmIChyZWNvcmQudXBkYXRlZCkge1xuICAgICAgICAgIGNvbnN0IHVwZGF0ZWRNb2R1bGVzID0gc2VydmVyLm1vZHVsZUdyYXBoLmdldE1vZHVsZXNCeUZpbGUoZmlsZSk7XG4gICAgICAgICAgdXBkYXRlZE1vZHVsZXM/LmZvckVhY2goKG0pID0+IHNlcnZlcj8ubW9kdWxlR3JhcGguaW52YWxpZGF0ZU1vZHVsZShtKSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gU2VuZCByZWxvYWQgY29tbWFuZCB0byBjbGllbnRzXG4gICAgICBpZiAoc2VydmVyT3B0aW9ucy5saXZlUmVsb2FkKSB7XG4gICAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oJ1JlbG9hZGluZyBjbGllbnQocykuLi4nKTtcblxuICAgICAgICBzZXJ2ZXIud3Muc2VuZCh7XG4gICAgICAgICAgdHlwZTogJ2Z1bGwtcmVsb2FkJyxcbiAgICAgICAgICBwYXRoOiAnKicsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTZXR1cCBzZXJ2ZXIgYW5kIHN0YXJ0IGxpc3RlbmluZ1xuICAgICAgc2VydmVyID0gYXdhaXQgc2V0dXBTZXJ2ZXIoc2VydmVyT3B0aW9ucywgb3V0cHV0RmlsZXMsIGFzc2V0cyk7XG5cbiAgICAgIGF3YWl0IHNlcnZlci5saXN0ZW4oKTtcbiAgICAgIGxpc3RlbmluZ0FkZHJlc3MgPSBzZXJ2ZXIuaHR0cFNlcnZlcj8uYWRkcmVzcygpIGFzIEFkZHJlc3NJbmZvO1xuXG4gICAgICAvLyBsb2cgY29ubmVjdGlvbiBpbmZvcm1hdGlvblxuICAgICAgc2VydmVyLnByaW50VXJscygpO1xuICAgIH1cblxuICAgIC8vIFRPRE86IGFkanVzdCBvdXRwdXQgdHlwaW5ncyB0byByZWZsZWN0IGJvdGggZGV2ZWxvcG1lbnQgc2VydmVyc1xuICAgIHlpZWxkIHsgc3VjY2VzczogdHJ1ZSwgcG9ydDogbGlzdGVuaW5nQWRkcmVzcz8ucG9ydCB9IGFzIHVua25vd24gYXMgRGV2U2VydmVyQnVpbGRlck91dHB1dDtcbiAgfVxuXG4gIGlmIChzZXJ2ZXIpIHtcbiAgICBsZXQgZGVmZXJyZWQ6ICgpID0+IHZvaWQ7XG4gICAgY29udGV4dC5hZGRUZWFyZG93bihhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCBzZXJ2ZXI/LmNsb3NlKCk7XG4gICAgICBkZWZlcnJlZD8uKCk7XG4gICAgfSk7XG4gICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IChkZWZlcnJlZCA9IHJlc29sdmUpKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzZXR1cFNlcnZlcihcbiAgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMsXG4gIG91dHB1dEZpbGVzOiBNYXA8c3RyaW5nLCBPdXRwdXRGaWxlUmVjb3JkPixcbiAgYXNzZXRzOiBNYXA8c3RyaW5nLCBzdHJpbmc+LFxuKTogUHJvbWlzZTxWaXRlRGV2U2VydmVyPiB7XG4gIGNvbnN0IHByb3h5ID0gYXdhaXQgbG9hZFByb3h5Q29uZmlndXJhdGlvbihcbiAgICBzZXJ2ZXJPcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgc2VydmVyT3B0aW9ucy5wcm94eUNvbmZpZyxcbiAgKTtcblxuICBjb25zdCBjb25maWd1cmF0aW9uOiBJbmxpbmVDb25maWcgPSB7XG4gICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgZW52RmlsZTogZmFsc2UsXG4gICAgY2FjaGVEaXI6IHBhdGguam9pbihzZXJ2ZXJPcHRpb25zLmNhY2hlT3B0aW9ucy5wYXRoLCAndml0ZScpLFxuICAgIHJvb3Q6IHNlcnZlck9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICBwdWJsaWNEaXI6IGZhbHNlLFxuICAgIGVzYnVpbGQ6IGZhbHNlLFxuICAgIG1vZGU6ICdkZXZlbG9wbWVudCcsXG4gICAgYXBwVHlwZTogJ3NwYScsXG4gICAgY3NzOiB7XG4gICAgICBkZXZTb3VyY2VtYXA6IHRydWUsXG4gICAgfSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHBvcnQ6IHNlcnZlck9wdGlvbnMucG9ydCxcbiAgICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgICBob3N0OiBzZXJ2ZXJPcHRpb25zLmhvc3QsXG4gICAgICBvcGVuOiBzZXJ2ZXJPcHRpb25zLm9wZW4sXG4gICAgICBoZWFkZXJzOiBzZXJ2ZXJPcHRpb25zLmhlYWRlcnMsXG4gICAgICBwcm94eSxcbiAgICAgIC8vIEN1cnJlbnRseSBkb2VzIG5vdCBhcHBlYXIgdG8gYmUgYSB3YXkgdG8gZGlzYWJsZSBmaWxlIHdhdGNoaW5nIGRpcmVjdGx5IHNvIGlnbm9yZSBhbGwgZmlsZXNcbiAgICAgIHdhdGNoOiB7XG4gICAgICAgIGlnbm9yZWQ6IFsnKiovKiddLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ3ZpdGU6YW5ndWxhci1tZW1vcnknLFxuICAgICAgICAvLyBFbnN1cmVzIHBsdWdpbiBob29rcyBydW4gYmVmb3JlIGJ1aWx0LWluIFZpdGUgaG9va3NcbiAgICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICAgIGFzeW5jIHJlc29sdmVJZChzb3VyY2UsIGltcG9ydGVyKSB7XG4gICAgICAgICAgaWYgKGltcG9ydGVyICYmIHNvdXJjZS5zdGFydHNXaXRoKCcuJykpIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBxdWVyeSBpZiBwcmVzZW50XG4gICAgICAgICAgICBjb25zdCBbaW1wb3J0ZXJGaWxlXSA9IGltcG9ydGVyLnNwbGl0KCc/JywgMSk7XG5cbiAgICAgICAgICAgIHNvdXJjZSA9IG5vcm1hbGl6ZVBhdGgocGF0aC5qb2luKHBhdGguZGlybmFtZShpbXBvcnRlckZpbGUpLCBzb3VyY2UpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBbZmlsZV0gPSBzb3VyY2Uuc3BsaXQoJz8nLCAxKTtcbiAgICAgICAgICBpZiAob3V0cHV0RmlsZXMuaGFzKGZpbGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gc291cmNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgbG9hZChpZCkge1xuICAgICAgICAgIGNvbnN0IFtmaWxlXSA9IGlkLnNwbGl0KCc/JywgMSk7XG4gICAgICAgICAgY29uc3QgY29kZUNvbnRlbnRzID0gb3V0cHV0RmlsZXMuZ2V0KGZpbGUpPy5jb250ZW50cztcbiAgICAgICAgICBpZiAoY29kZUNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBjb2RlID0gQnVmZmVyLmZyb20oY29kZUNvbnRlbnRzKS50b1N0cmluZygndXRmLTgnKTtcbiAgICAgICAgICBjb25zdCBtYXBDb250ZW50cyA9IG91dHB1dEZpbGVzLmdldChmaWxlICsgJy5tYXAnKT8uY29udGVudHM7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIHNvdXJjZSBtYXAgVVJMIGNvbW1lbnRzIGZyb20gdGhlIGNvZGUgaWYgYSBzb3VyY2VtYXAgaXMgcHJlc2VudC5cbiAgICAgICAgICAgIC8vIFZpdGUgd2lsbCBpbmxpbmUgYW5kIGFkZCBhbiBhZGRpdGlvbmFsIHNvdXJjZW1hcCBVUkwgZm9yIHRoZSBzb3VyY2VtYXAuXG4gICAgICAgICAgICBjb2RlOiBtYXBDb250ZW50cyA/IGNvZGUucmVwbGFjZSgvXlxcL1xcLyMgc291cmNlTWFwcGluZ1VSTD1bXlxcclxcbl0qL2dtLCAnJykgOiBjb2RlLFxuICAgICAgICAgICAgbWFwOiBtYXBDb250ZW50cyAmJiBCdWZmZXIuZnJvbShtYXBDb250ZW50cykudG9TdHJpbmcoJ3V0Zi04JyksXG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgICAgIC8vIEFzc2V0cyBhbmQgcmVzb3VyY2VzIGdldCBoYW5kbGVkIGZpcnN0XG4gICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShmdW5jdGlvbiBhbmd1bGFyQXNzZXRzTWlkZGxld2FyZShyZXEsIHJlcywgbmV4dCkge1xuICAgICAgICAgICAgaWYgKHJlcS51cmwgPT09IHVuZGVmaW5lZCB8fCByZXMud3JpdGFibGVFbmRlZCkge1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFBhcnNlIHRoZSBpbmNvbWluZyByZXF1ZXN0LlxuICAgICAgICAgICAgLy8gVGhlIGJhc2Ugb2YgdGhlIFVSTCBpcyB1bnVzZWQgYnV0IHJlcXVpcmVkIHRvIHBhcnNlIHRoZSBVUkwuXG4gICAgICAgICAgICBjb25zdCBwYXJzZWRVcmwgPSBuZXcgVVJMKHJlcS51cmwsICdodHRwOi8vbG9jYWxob3N0Jyk7XG4gICAgICAgICAgICBjb25zdCBleHRlbnNpb24gPSBwYXRoLmV4dG5hbWUocGFyc2VkVXJsLnBhdGhuYW1lKTtcblxuICAgICAgICAgICAgLy8gUmV3cml0ZSBhbGwgYnVpbGQgYXNzZXRzIHRvIGEgdml0ZSByYXcgZnMgVVJMXG4gICAgICAgICAgICBjb25zdCBhc3NldFNvdXJjZVBhdGggPSBhc3NldHMuZ2V0KHBhcnNlZFVybC5wYXRobmFtZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXRTb3VyY2VQYXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgcmVxLnVybCA9IGAvQGZzLyR7YXNzZXRTb3VyY2VQYXRofWA7XG4gICAgICAgICAgICAgIG5leHQoKTtcblxuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJlc291cmNlIGZpbGVzIGFyZSBoYW5kbGVkIGRpcmVjdGx5LlxuICAgICAgICAgICAgLy8gR2xvYmFsIHN0eWxlc2hlZXRzIChDU1MgZmlsZXMpIGFyZSBjdXJyZW50bHkgY29uc2lkZXJlZCByZXNvdXJjZXMgdG8gd29ya2Fyb3VuZFxuICAgICAgICAgICAgLy8gZGV2IHNlcnZlciBzb3VyY2VtYXAgaXNzdWVzIHdpdGggc3R5bGVzaGVldHMuXG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9uICE9PSAnLmpzJyAmJiBleHRlbnNpb24gIT09ICcuaHRtbCcpIHtcbiAgICAgICAgICAgICAgY29uc3Qgb3V0cHV0RmlsZSA9IG91dHB1dEZpbGVzLmdldChwYXJzZWRVcmwucGF0aG5hbWUpO1xuICAgICAgICAgICAgICBpZiAob3V0cHV0RmlsZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pbWVUeXBlID0gbG9va3VwTWltZVR5cGUoZXh0ZW5zaW9uKTtcbiAgICAgICAgICAgICAgICBpZiAobWltZVR5cGUpIHtcbiAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsIG1pbWVUeXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ2FjaGUtQ29udHJvbCcsICduby1jYWNoZScpO1xuICAgICAgICAgICAgICAgIGlmIChzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpIHtcbiAgICAgICAgICAgICAgICAgIE9iamVjdC5lbnRyaWVzKHNlcnZlck9wdGlvbnMuaGVhZGVycykuZm9yRWFjaCgoW25hbWUsIHZhbHVlXSkgPT5cbiAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihuYW1lLCB2YWx1ZSksXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMuZW5kKG91dHB1dEZpbGUuY29udGVudHMpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIFJldHVybmluZyBhIGZ1bmN0aW9uLCBpbnN0YWxscyBtaWRkbGV3YXJlIGFmdGVyIHRoZSBtYWluIHRyYW5zZm9ybSBtaWRkbGV3YXJlIGJ1dFxuICAgICAgICAgIC8vIGJlZm9yZSB0aGUgYnVpbHQtaW4gSFRNTCBtaWRkbGV3YXJlXG4gICAgICAgICAgcmV0dXJuICgpID0+XG4gICAgICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGZ1bmN0aW9uIGFuZ3VsYXJJbmRleE1pZGRsZXdhcmUocmVxLCByZXMsIG5leHQpIHtcbiAgICAgICAgICAgICAgaWYgKHJlcS51cmwgPT09ICcvJyB8fCByZXEudXJsID09PSBgL2luZGV4Lmh0bWxgKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3SHRtbCA9IG91dHB1dEZpbGVzLmdldCgnL2luZGV4Lmh0bWwnKT8uY29udGVudHM7XG4gICAgICAgICAgICAgICAgaWYgKHJhd0h0bWwpIHtcbiAgICAgICAgICAgICAgICAgIHNlcnZlclxuICAgICAgICAgICAgICAgICAgICAudHJhbnNmb3JtSW5kZXhIdG1sKFxuICAgICAgICAgICAgICAgICAgICAgIHJlcS51cmwsXG4gICAgICAgICAgICAgICAgICAgICAgQnVmZmVyLmZyb20ocmF3SHRtbCkudG9TdHJpbmcoJ3V0Zi04JyksXG4gICAgICAgICAgICAgICAgICAgICAgcmVxLm9yaWdpbmFsVXJsLFxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKChwcm9jZXNzZWRIdG1sKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ3RleHQvaHRtbCcpO1xuICAgICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NhY2hlLUNvbnRyb2wnLCAnbm8tY2FjaGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoc2VydmVyT3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyhzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpLmZvckVhY2goKFtuYW1lLCB2YWx1ZV0pID0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIobmFtZSwgdmFsdWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChwcm9jZXNzZWRIdG1sKTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcikgPT4gbmV4dChlcnJvcikpO1xuXG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIF0sXG4gICAgb3B0aW1pemVEZXBzOiB7XG4gICAgICAvLyBUT0RPOiBDb25zaWRlciBlbmFibGluZyBmb3Iga25vd24gc2FmZSBkZXBlbmRlbmNpZXMgKEBhbmd1bGFyLyogPylcbiAgICAgIGRpc2FibGVkOiB0cnVlLFxuICAgIH0sXG4gIH07XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMuc3NsKSB7XG4gICAgaWYgKHNlcnZlck9wdGlvbnMuc3NsQ2VydCAmJiBzZXJ2ZXJPcHRpb25zLnNzbEtleSkge1xuICAgICAgLy8gc2VydmVyIGNvbmZpZ3VyYXRpb24gaXMgZGVmaW5lZCBhYm92ZVxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgIGNvbmZpZ3VyYXRpb24uc2VydmVyIS5odHRwcyA9IHtcbiAgICAgICAgY2VydDogYXdhaXQgcmVhZEZpbGUoc2VydmVyT3B0aW9ucy5zc2xDZXJ0KSxcbiAgICAgICAga2V5OiBhd2FpdCByZWFkRmlsZShzZXJ2ZXJPcHRpb25zLnNzbEtleSksXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7IGRlZmF1bHQ6IGJhc2ljU3NsUGx1Z2luIH0gPSBhd2FpdCBpbXBvcnQoJ0B2aXRlanMvcGx1Z2luLWJhc2ljLXNzbCcpO1xuICAgICAgY29uZmlndXJhdGlvbi5wbHVnaW5zID8/PSBbXTtcbiAgICAgIGNvbmZpZ3VyYXRpb24ucGx1Z2lucy5wdXNoKGJhc2ljU3NsUGx1Z2luKCkpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHNlcnZlciA9IGF3YWl0IGNyZWF0ZVNlcnZlcihjb25maWd1cmF0aW9uKTtcblxuICByZXR1cm4gc2VydmVyO1xufVxuIl19