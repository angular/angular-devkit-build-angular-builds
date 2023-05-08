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
    if (serverOptions.servePath === undefined && browserOptions.baseHref !== undefined) {
        serverOptions.servePath = browserOptions.baseHref;
    }
    let server;
    let listeningAddress;
    const generatedFiles = new Map();
    const assetFiles = new Map();
    // TODO: Switch this to an architect schedule call when infrastructure settings are supported
    for await (const result of (0, browser_esbuild_1.buildEsbuildBrowser)(browserOptions, context, { write: false })) {
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
            const serverConfiguration = await setupServer(serverOptions, generatedFiles, assetFiles);
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
async function setupServer(serverOptions, outputFiles, assets) {
    const proxy = await (0, load_proxy_config_1.loadProxyConfiguration)(serverOptions.workspaceRoot, serverOptions.proxyConfig);
    if (proxy) {
        (0, load_proxy_config_1.normalizeProxyConfiguration)(proxy);
    }
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
                    const mapContents = outputFiles.get(file + '.map')?.contents;
                    return {
                        // Remove source map URL comments from the code if a sourcemap is present.
                        // Vite will inline and add an additional sourcemap URL for the sourcemap.
                        code: Buffer.from(codeContents).toString('utf-8'),
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
                        let pathname = parsedUrl.pathname;
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
                            req.url = `/@fs/${assetSourcePath}`;
                            next();
                            return;
                        }
                        // Resource files are handled directly.
                        // Global stylesheets (CSS files) are currently considered resources to workaround
                        // dev server sourcemap issues with stylesheets.
                        if (extension !== '.html') {
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
    return configuration;
}
exports.setupServer = setupServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3ZpdGUtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0gsbUNBQWtEO0FBQ2xELDhEQUFpQztBQUNqQyw2Q0FBcUQ7QUFDckQsK0NBQTRDO0FBRTVDLDBEQUE2QjtBQUM3QiwrQkFBZ0Y7QUFDaEYsd0RBQXlEO0FBRXpELDJEQUEwRjtBQVcxRixTQUFTLFdBQVcsQ0FBQyxRQUFvQjtJQUN2Qyx3QkFBd0I7SUFDeEIsT0FBTyxJQUFBLHdCQUFVLEVBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQ3hELENBQUM7QUFFTSxLQUFLLFNBQVMsQ0FBQyxDQUFDLGFBQWEsQ0FDbEMsYUFBeUMsRUFDekMsV0FBbUIsRUFDbkIsT0FBdUI7SUFFdkIsc0RBQXNEO0lBQ3RELE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FDdkQsYUFBYSxDQUFDLGFBQWEsQ0FDNUIsQ0FBNEMsQ0FBQztJQUU5QyxNQUFNLGNBQWMsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FDbkQ7UUFDRSxHQUFHLGlCQUFpQjtRQUNwQixLQUFLLEVBQUUsYUFBYSxDQUFDLEtBQUs7UUFDMUIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJO1FBQ3hCLE9BQU8sRUFBRSxhQUFhLENBQUMsT0FBTztLQUNZLEVBQzVDLFdBQVcsQ0FDWixDQUE0QyxDQUFDO0lBRTlDLElBQUksYUFBYSxDQUFDLFNBQVMsS0FBSyxTQUFTLElBQUksY0FBYyxDQUFDLFFBQVEsS0FBSyxTQUFT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Q0FBQyxDQUFDO3FDQUNELEtBQUssQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0NBRWpDLE9BQU87NkJBQ1I7eUJBQ0Y7d0JBRUQsSUFBSSxFQUFFLENBQUM7b0JBQ1QsQ0FBQyxDQUFDLENBQUM7Z0JBQ1AsQ0FBQzthQUNGO1NBQ0Y7UUFDRCxZQUFZLEVBQUU7WUFDWixxRUFBcUU7WUFDckUsUUFBUSxFQUFFLElBQUk7U0FDZjtLQUNGLENBQUM7SUFFRixJQUFJLGFBQWEsQ0FBQyxHQUFHLEVBQUU7UUFDckIsSUFBSSxhQUFhLENBQUMsT0FBTyxJQUFJLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDakQsd0NBQXdDO1lBQ3hDLG9FQUFvRTtZQUNwRSxhQUFhLENBQUMsTUFBTyxDQUFDLEtBQUssR0FBRztnQkFDNUIsSUFBSSxFQUFFLE1BQU0sSUFBQSxtQkFBUSxFQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUM7Z0JBQzNDLEdBQUcsRUFBRSxNQUFNLElBQUEsbUJBQVEsRUFBQyxhQUFhLENBQUMsTUFBTSxDQUFDO2FBQzFDLENBQUM7U0FDSDthQUFNO1lBQ0wsTUFBTSxFQUFFLE9BQU8sRUFBRSxjQUFjLEVBQUUsR0FBRyx3REFBYSwwQkFBMEIsR0FBQyxDQUFDO1lBQzdFLGFBQWEsQ0FBQyxPQUFPLEtBQXJCLGFBQWEsQ0FBQyxPQUFPLEdBQUssRUFBRSxFQUFDO1lBQzdCLGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUM7U0FDOUM7S0FDRjtJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUM7QUFyTEQsa0NBcUxDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB0eXBlIHsganNvbiB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB0eXBlIHsgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgbG9va3VwIGFzIGxvb2t1cE1pbWVUeXBlIH0gZnJvbSAnbXJtaW1lJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgQmluYXJ5TGlrZSwgY3JlYXRlSGFzaCB9IGZyb20gJ25vZGU6Y3J5cHRvJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgdHlwZSB7IEFkZHJlc3NJbmZvIH0gZnJvbSAnbm9kZTpuZXQnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IElubGluZUNvbmZpZywgVml0ZURldlNlcnZlciwgY3JlYXRlU2VydmVyLCBub3JtYWxpemVQYXRoIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyBidWlsZEVzYnVpbGRCcm93c2VyIH0gZnJvbSAnLi4vYnJvd3Nlci1lc2J1aWxkJztcbmltcG9ydCB0eXBlIHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4uL2Jyb3dzZXItZXNidWlsZC9zY2hlbWEnO1xuaW1wb3J0IHsgbG9hZFByb3h5Q29uZmlndXJhdGlvbiwgbm9ybWFsaXplUHJveHlDb25maWd1cmF0aW9uIH0gZnJvbSAnLi9sb2FkLXByb3h5LWNvbmZpZyc7XG5pbXBvcnQgdHlwZSB7IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB0eXBlIHsgRGV2U2VydmVyQnVpbGRlck91dHB1dCB9IGZyb20gJy4vd2VicGFjay1zZXJ2ZXInO1xuXG5pbnRlcmZhY2UgT3V0cHV0RmlsZVJlY29yZCB7XG4gIGNvbnRlbnRzOiBVaW50OEFycmF5O1xuICBzaXplOiBudW1iZXI7XG4gIGhhc2g/OiBCdWZmZXI7XG4gIHVwZGF0ZWQ6IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIGhhc2hDb250ZW50KGNvbnRlbnRzOiBCaW5hcnlMaWtlKTogQnVmZmVyIHtcbiAgLy8gVE9ETzogQ29uc2lkZXIgeHhoYXNoXG4gIHJldHVybiBjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoY29udGVudHMpLmRpZ2VzdCgpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24qIHNlcnZlV2l0aFZpdGUoXG4gIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zLFxuICBidWlsZGVyTmFtZTogc3RyaW5nLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IEFzeW5jSXRlcmFibGVJdGVyYXRvcjxEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0PiB7XG4gIC8vIEdldCB0aGUgYnJvd3NlciBjb25maWd1cmF0aW9uIGZyb20gdGhlIHRhcmdldCBuYW1lLlxuICBjb25zdCByYXdCcm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMoXG4gICAgc2VydmVyT3B0aW9ucy5icm93c2VyVGFyZ2V0LFxuICApKSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG5cbiAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC52YWxpZGF0ZU9wdGlvbnMoXG4gICAge1xuICAgICAgLi4ucmF3QnJvd3Nlck9wdGlvbnMsXG4gICAgICB3YXRjaDogc2VydmVyT3B0aW9ucy53YXRjaCxcbiAgICAgIHBvbGw6IHNlcnZlck9wdGlvbnMucG9sbCxcbiAgICAgIHZlcmJvc2U6IHNlcnZlck9wdGlvbnMudmVyYm9zZSxcbiAgICB9IGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgICBidWlsZGVyTmFtZSxcbiAgKSkgYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zO1xuXG4gIGlmIChzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCA9PT0gdW5kZWZpbmVkICYmIGJyb3dzZXJPcHRpb25zLmJhc2VIcmVmICE9PSB1bmRlZmluZWQpIHtcbiAgICBzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCA9IGJyb3dzZXJPcHRpb25zLmJhc2VIcmVmO1xuICB9XG5cbiAgbGV0IHNlcnZlcjogVml0ZURldlNlcnZlciB8IHVuZGVmaW5lZDtcbiAgbGV0IGxpc3RlbmluZ0FkZHJlc3M6IEFkZHJlc3NJbmZvIHwgdW5kZWZpbmVkO1xuICBjb25zdCBnZW5lcmF0ZWRGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBPdXRwdXRGaWxlUmVjb3JkPigpO1xuICBjb25zdCBhc3NldEZpbGVzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgLy8gVE9ETzogU3dpdGNoIHRoaXMgdG8gYW4gYXJjaGl0ZWN0IHNjaGVkdWxlIGNhbGwgd2hlbiBpbmZyYXN0cnVjdHVyZSBzZXR0aW5ncyBhcmUgc3VwcG9ydGVkXG4gIGZvciBhd2FpdCAoY29uc3QgcmVzdWx0IG9mIGJ1aWxkRXNidWlsZEJyb3dzZXIoYnJvd3Nlck9wdGlvbnMsIGNvbnRleHQsIHsgd3JpdGU6IGZhbHNlIH0pKSB7XG4gICAgYXNzZXJ0KHJlc3VsdC5vdXRwdXRGaWxlcywgJ0J1aWxkZXIgZGlkIG5vdCBwcm92aWRlIHJlc3VsdCBmaWxlcy4nKTtcblxuICAgIC8vIEFuYWx5emUgcmVzdWx0IGZpbGVzIGZvciBjaGFuZ2VzXG4gICAgYW5hbHl6ZVJlc3VsdEZpbGVzKHJlc3VsdC5vdXRwdXRGaWxlcywgZ2VuZXJhdGVkRmlsZXMpO1xuXG4gICAgYXNzZXRGaWxlcy5jbGVhcigpO1xuICAgIGlmIChyZXN1bHQuYXNzZXRGaWxlcykge1xuICAgICAgZm9yIChjb25zdCBhc3NldCBvZiByZXN1bHQuYXNzZXRGaWxlcykge1xuICAgICAgICBhc3NldEZpbGVzLnNldCgnLycgKyBub3JtYWxpemVQYXRoKGFzc2V0LmRlc3RpbmF0aW9uKSwgYXNzZXQuc291cmNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc2VydmVyKSB7XG4gICAgICAvLyBJbnZhbGlkYXRlIGFueSB1cGRhdGVkIGZpbGVzXG4gICAgICBmb3IgKGNvbnN0IFtmaWxlLCByZWNvcmRdIG9mIGdlbmVyYXRlZEZpbGVzKSB7XG4gICAgICAgIGlmIChyZWNvcmQudXBkYXRlZCkge1xuICAgICAgICAgIGNvbnN0IHVwZGF0ZWRNb2R1bGVzID0gc2VydmVyLm1vZHVsZUdyYXBoLmdldE1vZHVsZXNCeUZpbGUoZmlsZSk7XG4gICAgICAgICAgdXBkYXRlZE1vZHVsZXM/LmZvckVhY2goKG0pID0+IHNlcnZlcj8ubW9kdWxlR3JhcGguaW52YWxpZGF0ZU1vZHVsZShtKSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gU2VuZCByZWxvYWQgY29tbWFuZCB0byBjbGllbnRzXG4gICAgICBpZiAoc2VydmVyT3B0aW9ucy5saXZlUmVsb2FkKSB7XG4gICAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oJ1JlbG9hZGluZyBjbGllbnQocykuLi4nKTtcblxuICAgICAgICBzZXJ2ZXIud3Muc2VuZCh7XG4gICAgICAgICAgdHlwZTogJ2Z1bGwtcmVsb2FkJyxcbiAgICAgICAgICBwYXRoOiAnKicsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTZXR1cCBzZXJ2ZXIgYW5kIHN0YXJ0IGxpc3RlbmluZ1xuICAgICAgY29uc3Qgc2VydmVyQ29uZmlndXJhdGlvbiA9IGF3YWl0IHNldHVwU2VydmVyKHNlcnZlck9wdGlvbnMsIGdlbmVyYXRlZEZpbGVzLCBhc3NldEZpbGVzKTtcbiAgICAgIHNlcnZlciA9IGF3YWl0IGNyZWF0ZVNlcnZlcihzZXJ2ZXJDb25maWd1cmF0aW9uKTtcblxuICAgICAgYXdhaXQgc2VydmVyLmxpc3RlbigpO1xuICAgICAgbGlzdGVuaW5nQWRkcmVzcyA9IHNlcnZlci5odHRwU2VydmVyPy5hZGRyZXNzKCkgYXMgQWRkcmVzc0luZm87XG5cbiAgICAgIC8vIGxvZyBjb25uZWN0aW9uIGluZm9ybWF0aW9uXG4gICAgICBzZXJ2ZXIucHJpbnRVcmxzKCk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogYWRqdXN0IG91dHB1dCB0eXBpbmdzIHRvIHJlZmxlY3QgYm90aCBkZXZlbG9wbWVudCBzZXJ2ZXJzXG4gICAgeWllbGQgeyBzdWNjZXNzOiB0cnVlLCBwb3J0OiBsaXN0ZW5pbmdBZGRyZXNzPy5wb3J0IH0gYXMgdW5rbm93biBhcyBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0O1xuICB9XG5cbiAgaWYgKHNlcnZlcikge1xuICAgIGxldCBkZWZlcnJlZDogKCkgPT4gdm9pZDtcbiAgICBjb250ZXh0LmFkZFRlYXJkb3duKGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IHNlcnZlcj8uY2xvc2UoKTtcbiAgICAgIGRlZmVycmVkPy4oKTtcbiAgICB9KTtcbiAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4gKGRlZmVycmVkID0gcmVzb2x2ZSkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFuYWx5emVSZXN1bHRGaWxlcyhcbiAgcmVzdWx0RmlsZXM6IE91dHB1dEZpbGVbXSxcbiAgZ2VuZXJhdGVkRmlsZXM6IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+LFxuKSB7XG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oWycvaW5kZXguaHRtbCddKTtcbiAgZm9yIChjb25zdCBmaWxlIG9mIHJlc3VsdEZpbGVzKSB7XG4gICAgY29uc3QgZmlsZVBhdGggPSAnLycgKyBub3JtYWxpemVQYXRoKGZpbGUucGF0aCk7XG4gICAgc2Vlbi5hZGQoZmlsZVBhdGgpO1xuXG4gICAgLy8gU2tpcCBhbmFseXNpcyBvZiBzb3VyY2VtYXBzXG4gICAgaWYgKGZpbGVQYXRoLmVuZHNXaXRoKCcubWFwJykpIHtcbiAgICAgIGdlbmVyYXRlZEZpbGVzLnNldChmaWxlUGF0aCwge1xuICAgICAgICBjb250ZW50czogZmlsZS5jb250ZW50cyxcbiAgICAgICAgc2l6ZTogZmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoLFxuICAgICAgICB1cGRhdGVkOiBmYWxzZSxcbiAgICAgIH0pO1xuXG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBsZXQgZmlsZUhhc2g6IEJ1ZmZlciB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCBleGlzdGluZ1JlY29yZCA9IGdlbmVyYXRlZEZpbGVzLmdldChmaWxlUGF0aCk7XG4gICAgaWYgKGV4aXN0aW5nUmVjb3JkICYmIGV4aXN0aW5nUmVjb3JkLnNpemUgPT09IGZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCkge1xuICAgICAgLy8gT25seSBoYXNoIGV4aXN0aW5nIGZpbGUgd2hlbiBuZWVkZWRcbiAgICAgIGlmIChleGlzdGluZ1JlY29yZC5oYXNoID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZXhpc3RpbmdSZWNvcmQuaGFzaCA9IGhhc2hDb250ZW50KGV4aXN0aW5nUmVjb3JkLmNvbnRlbnRzKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ29tcGFyZSBhZ2FpbnN0IGxhdGVzdCByZXN1bHQgb3V0cHV0XG4gICAgICBmaWxlSGFzaCA9IGhhc2hDb250ZW50KGZpbGUuY29udGVudHMpO1xuICAgICAgaWYgKGZpbGVIYXNoLmVxdWFscyhleGlzdGluZ1JlY29yZC5oYXNoKSkge1xuICAgICAgICAvLyBTYW1lIGZpbGVcbiAgICAgICAgZXhpc3RpbmdSZWNvcmQudXBkYXRlZCA9IGZhbHNlO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZWRGaWxlcy5zZXQoZmlsZVBhdGgsIHtcbiAgICAgIGNvbnRlbnRzOiBmaWxlLmNvbnRlbnRzLFxuICAgICAgc2l6ZTogZmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoLFxuICAgICAgaGFzaDogZmlsZUhhc2gsXG4gICAgICB1cGRhdGVkOiB0cnVlLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gQ2xlYXIgc3RhbGUgb3V0cHV0IGZpbGVzXG4gIGZvciAoY29uc3QgZmlsZSBvZiBnZW5lcmF0ZWRGaWxlcy5rZXlzKCkpIHtcbiAgICBpZiAoIXNlZW4uaGFzKGZpbGUpKSB7XG4gICAgICBnZW5lcmF0ZWRGaWxlcy5kZWxldGUoZmlsZSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXR1cFNlcnZlcihcbiAgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMsXG4gIG91dHB1dEZpbGVzOiBNYXA8c3RyaW5nLCBPdXRwdXRGaWxlUmVjb3JkPixcbiAgYXNzZXRzOiBNYXA8c3RyaW5nLCBzdHJpbmc+LFxuKTogUHJvbWlzZTxJbmxpbmVDb25maWc+IHtcbiAgY29uc3QgcHJveHkgPSBhd2FpdCBsb2FkUHJveHlDb25maWd1cmF0aW9uKFxuICAgIHNlcnZlck9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICBzZXJ2ZXJPcHRpb25zLnByb3h5Q29uZmlnLFxuICApO1xuICBpZiAocHJveHkpIHtcbiAgICBub3JtYWxpemVQcm94eUNvbmZpZ3VyYXRpb24ocHJveHkpO1xuICB9XG5cbiAgY29uc3QgY29uZmlndXJhdGlvbjogSW5saW5lQ29uZmlnID0ge1xuICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIGVudkZpbGU6IGZhbHNlLFxuICAgIGNhY2hlRGlyOiBwYXRoLmpvaW4oc2VydmVyT3B0aW9ucy5jYWNoZU9wdGlvbnMucGF0aCwgJ3ZpdGUnKSxcbiAgICByb290OiBzZXJ2ZXJPcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgcHVibGljRGlyOiBmYWxzZSxcbiAgICBlc2J1aWxkOiBmYWxzZSxcbiAgICBtb2RlOiAnZGV2ZWxvcG1lbnQnLFxuICAgIGFwcFR5cGU6ICdzcGEnLFxuICAgIGNzczoge1xuICAgICAgZGV2U291cmNlbWFwOiB0cnVlLFxuICAgIH0sXG4gICAgYmFzZTogc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgsXG4gICAgc2VydmVyOiB7XG4gICAgICBwb3J0OiBzZXJ2ZXJPcHRpb25zLnBvcnQsXG4gICAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgICAgaG9zdDogc2VydmVyT3B0aW9ucy5ob3N0LFxuICAgICAgb3Blbjogc2VydmVyT3B0aW9ucy5vcGVuLFxuICAgICAgaGVhZGVyczogc2VydmVyT3B0aW9ucy5oZWFkZXJzLFxuICAgICAgcHJveHksXG4gICAgICAvLyBDdXJyZW50bHkgZG9lcyBub3QgYXBwZWFyIHRvIGJlIGEgd2F5IHRvIGRpc2FibGUgZmlsZSB3YXRjaGluZyBkaXJlY3RseSBzbyBpZ25vcmUgYWxsIGZpbGVzXG4gICAgICB3YXRjaDoge1xuICAgICAgICBpZ25vcmVkOiBbJyoqLyonXSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICd2aXRlOmFuZ3VsYXItbWVtb3J5JyxcbiAgICAgICAgLy8gRW5zdXJlcyBwbHVnaW4gaG9va3MgcnVuIGJlZm9yZSBidWlsdC1pbiBWaXRlIGhvb2tzXG4gICAgICAgIGVuZm9yY2U6ICdwcmUnLFxuICAgICAgICBhc3luYyByZXNvbHZlSWQoc291cmNlLCBpbXBvcnRlcikge1xuICAgICAgICAgIGlmIChpbXBvcnRlciAmJiBzb3VyY2Uuc3RhcnRzV2l0aCgnLicpKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgcXVlcnkgaWYgcHJlc2VudFxuICAgICAgICAgICAgY29uc3QgW2ltcG9ydGVyRmlsZV0gPSBpbXBvcnRlci5zcGxpdCgnPycsIDEpO1xuXG4gICAgICAgICAgICBzb3VyY2UgPSBub3JtYWxpemVQYXRoKHBhdGguam9pbihwYXRoLmRpcm5hbWUoaW1wb3J0ZXJGaWxlKSwgc291cmNlKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgW2ZpbGVdID0gc291cmNlLnNwbGl0KCc/JywgMSk7XG4gICAgICAgICAgaWYgKG91dHB1dEZpbGVzLmhhcyhmaWxlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNvdXJjZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGxvYWQoaWQpIHtcbiAgICAgICAgICBjb25zdCBbZmlsZV0gPSBpZC5zcGxpdCgnPycsIDEpO1xuICAgICAgICAgIGNvbnN0IGNvZGVDb250ZW50cyA9IG91dHB1dEZpbGVzLmdldChmaWxlKT8uY29udGVudHM7XG4gICAgICAgICAgaWYgKGNvZGVDb250ZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgbWFwQ29udGVudHMgPSBvdXRwdXRGaWxlcy5nZXQoZmlsZSArICcubWFwJyk/LmNvbnRlbnRzO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBzb3VyY2UgbWFwIFVSTCBjb21tZW50cyBmcm9tIHRoZSBjb2RlIGlmIGEgc291cmNlbWFwIGlzIHByZXNlbnQuXG4gICAgICAgICAgICAvLyBWaXRlIHdpbGwgaW5saW5lIGFuZCBhZGQgYW4gYWRkaXRpb25hbCBzb3VyY2VtYXAgVVJMIGZvciB0aGUgc291cmNlbWFwLlxuICAgICAgICAgICAgY29kZTogQnVmZmVyLmZyb20oY29kZUNvbnRlbnRzKS50b1N0cmluZygndXRmLTgnKSxcbiAgICAgICAgICAgIG1hcDogbWFwQ29udGVudHMgJiYgQnVmZmVyLmZyb20obWFwQ29udGVudHMpLnRvU3RyaW5nKCd1dGYtOCcpLFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgICAgICAvLyBBc3NldHMgYW5kIHJlc291cmNlcyBnZXQgaGFuZGxlZCBmaXJzdFxuICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoZnVuY3Rpb24gYW5ndWxhckFzc2V0c01pZGRsZXdhcmUocmVxLCByZXMsIG5leHQpIHtcbiAgICAgICAgICAgIGlmIChyZXEudXJsID09PSB1bmRlZmluZWQgfHwgcmVzLndyaXRhYmxlRW5kZWQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBQYXJzZSB0aGUgaW5jb21pbmcgcmVxdWVzdC5cbiAgICAgICAgICAgIC8vIFRoZSBiYXNlIG9mIHRoZSBVUkwgaXMgdW51c2VkIGJ1dCByZXF1aXJlZCB0byBwYXJzZSB0aGUgVVJMLlxuICAgICAgICAgICAgY29uc3QgcGFyc2VkVXJsID0gbmV3IFVSTChyZXEudXJsLCAnaHR0cDovL2xvY2FsaG9zdCcpO1xuICAgICAgICAgICAgbGV0IHBhdGhuYW1lID0gcGFyc2VkVXJsLnBhdGhuYW1lO1xuICAgICAgICAgICAgaWYgKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoICYmIHBhdGhuYW1lLnN0YXJ0c1dpdGgoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgpKSB7XG4gICAgICAgICAgICAgIHBhdGhuYW1lID0gcGF0aG5hbWUuc2xpY2Uoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgubGVuZ3RoKTtcbiAgICAgICAgICAgICAgaWYgKHBhdGhuYW1lWzBdICE9PSAnLycpIHtcbiAgICAgICAgICAgICAgICBwYXRobmFtZSA9ICcvJyArIHBhdGhuYW1lO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBleHRlbnNpb24gPSBwYXRoLmV4dG5hbWUocGF0aG5hbWUpO1xuXG4gICAgICAgICAgICAvLyBSZXdyaXRlIGFsbCBidWlsZCBhc3NldHMgdG8gYSB2aXRlIHJhdyBmcyBVUkxcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0U291cmNlUGF0aCA9IGFzc2V0cy5nZXQocGF0aG5hbWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0U291cmNlUGF0aCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHJlcS51cmwgPSBgL0Bmcy8ke2Fzc2V0U291cmNlUGF0aH1gO1xuICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZXNvdXJjZSBmaWxlcyBhcmUgaGFuZGxlZCBkaXJlY3RseS5cbiAgICAgICAgICAgIC8vIEdsb2JhbCBzdHlsZXNoZWV0cyAoQ1NTIGZpbGVzKSBhcmUgY3VycmVudGx5IGNvbnNpZGVyZWQgcmVzb3VyY2VzIHRvIHdvcmthcm91bmRcbiAgICAgICAgICAgIC8vIGRldiBzZXJ2ZXIgc291cmNlbWFwIGlzc3VlcyB3aXRoIHN0eWxlc2hlZXRzLlxuICAgICAgICAgICAgaWYgKGV4dGVuc2lvbiAhPT0gJy5odG1sJykge1xuICAgICAgICAgICAgICBjb25zdCBvdXRwdXRGaWxlID0gb3V0cHV0RmlsZXMuZ2V0KHBhdGhuYW1lKTtcbiAgICAgICAgICAgICAgaWYgKG91dHB1dEZpbGUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtaW1lVHlwZSA9IGxvb2t1cE1pbWVUeXBlKGV4dGVuc2lvbik7XG4gICAgICAgICAgICAgICAgaWYgKG1pbWVUeXBlKSB7XG4gICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCBtaW1lVHlwZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NhY2hlLUNvbnRyb2wnLCAnbm8tY2FjaGUnKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VydmVyT3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyhzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpLmZvckVhY2goKFtuYW1lLCB2YWx1ZV0pID0+XG4gICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIobmFtZSwgdmFsdWUpLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzLmVuZChvdXRwdXRGaWxlLmNvbnRlbnRzKTtcblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAvLyBSZXR1cm5pbmcgYSBmdW5jdGlvbiwgaW5zdGFsbHMgbWlkZGxld2FyZSBhZnRlciB0aGUgbWFpbiB0cmFuc2Zvcm0gbWlkZGxld2FyZSBidXRcbiAgICAgICAgICAvLyBiZWZvcmUgdGhlIGJ1aWx0LWluIEhUTUwgbWlkZGxld2FyZVxuICAgICAgICAgIHJldHVybiAoKSA9PlxuICAgICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShmdW5jdGlvbiBhbmd1bGFySW5kZXhNaWRkbGV3YXJlKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgICAgICAgICAgIGlmIChyZXEudXJsID09PSAnLycgfHwgcmVxLnVybCA9PT0gYC9pbmRleC5odG1sYCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJhd0h0bWwgPSBvdXRwdXRGaWxlcy5nZXQoJy9pbmRleC5odG1sJyk/LmNvbnRlbnRzO1xuICAgICAgICAgICAgICAgIGlmIChyYXdIdG1sKSB7XG4gICAgICAgICAgICAgICAgICBzZXJ2ZXJcbiAgICAgICAgICAgICAgICAgICAgLnRyYW5zZm9ybUluZGV4SHRtbChcbiAgICAgICAgICAgICAgICAgICAgICByZXEudXJsLFxuICAgICAgICAgICAgICAgICAgICAgIEJ1ZmZlci5mcm9tKHJhd0h0bWwpLnRvU3RyaW5nKCd1dGYtOCcpLFxuICAgICAgICAgICAgICAgICAgICAgIHJlcS5vcmlnaW5hbFVybCxcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAudGhlbigocHJvY2Vzc2VkSHRtbCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICd0ZXh0L2h0bWwnKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDYWNoZS1Db250cm9sJywgJ25vLWNhY2hlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHNlcnZlck9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoc2VydmVyT3B0aW9ucy5oZWFkZXJzKS5mb3JFYWNoKChbbmFtZSwgdmFsdWVdKSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKG5hbWUsIHZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIHJlcy5lbmQocHJvY2Vzc2VkSHRtbCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IG5leHQoZXJyb3IpKTtcblxuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdLFxuICAgIG9wdGltaXplRGVwczoge1xuICAgICAgLy8gVE9ETzogQ29uc2lkZXIgZW5hYmxpbmcgZm9yIGtub3duIHNhZmUgZGVwZW5kZW5jaWVzIChAYW5ndWxhci8qID8pXG4gICAgICBkaXNhYmxlZDogdHJ1ZSxcbiAgICB9LFxuICB9O1xuXG4gIGlmIChzZXJ2ZXJPcHRpb25zLnNzbCkge1xuICAgIGlmIChzZXJ2ZXJPcHRpb25zLnNzbENlcnQgJiYgc2VydmVyT3B0aW9ucy5zc2xLZXkpIHtcbiAgICAgIC8vIHNlcnZlciBjb25maWd1cmF0aW9uIGlzIGRlZmluZWQgYWJvdmVcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gICAgICBjb25maWd1cmF0aW9uLnNlcnZlciEuaHR0cHMgPSB7XG4gICAgICAgIGNlcnQ6IGF3YWl0IHJlYWRGaWxlKHNlcnZlck9wdGlvbnMuc3NsQ2VydCksXG4gICAgICAgIGtleTogYXdhaXQgcmVhZEZpbGUoc2VydmVyT3B0aW9ucy5zc2xLZXkpLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgeyBkZWZhdWx0OiBiYXNpY1NzbFBsdWdpbiB9ID0gYXdhaXQgaW1wb3J0KCdAdml0ZWpzL3BsdWdpbi1iYXNpYy1zc2wnKTtcbiAgICAgIGNvbmZpZ3VyYXRpb24ucGx1Z2lucyA/Pz0gW107XG4gICAgICBjb25maWd1cmF0aW9uLnBsdWdpbnMucHVzaChiYXNpY1NzbFBsdWdpbigpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gY29uZmlndXJhdGlvbjtcbn1cbiJdfQ==