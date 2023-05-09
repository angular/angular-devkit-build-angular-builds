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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3ZpdGUtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0gsbUNBQWtEO0FBQ2xELDhEQUFpQztBQUNqQyw2Q0FBcUQ7QUFDckQsK0NBQTRDO0FBRTVDLDBEQUE2QjtBQUM3QiwrQkFBZ0Y7QUFDaEYsd0RBQXlEO0FBRXpELDJEQUEwRjtBQVcxRixTQUFTLFdBQVcsQ0FBQyxRQUFvQjtJQUN2Qyx3QkFBd0I7SUFDeEIsT0FBTyxJQUFBLHdCQUFVLEVBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQ3hELENBQUM7QUFFTSxLQUFLLFNBQVMsQ0FBQyxDQUFDLGFBQWEsQ0FDbEMsYUFBeUMsRUFDekMsV0FBbUIsRUFDbkIsT0FBdUI7SUFFdkIsc0RBQXNEO0lBQ3RELE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FDdkQsYUFBYSxDQUFDLGFBQWEsQ0FDNUIsQ0FBNEMsQ0FBQztJQUU5QyxNQUFNLGNBQWMsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FDbkQ7UUFDRSxHQUFHLGlCQUFpQjtRQUNwQixLQUFLLEVBQUUsYUFBYSxDQUFDLEtBQUs7UUFDMUIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJO1FBQ3hCLE9BQU8sRUFBRSxhQUFhLENBQUMsT0FBTztLQUNZLEVBQzVDLFdBQVcsQ0FDWixDQUE0QyxDQUFDO0lBRTlDLElBQUksYUFBYSxDQUFDLFNBQVMsS0FBSyxTQUFTLElBQUksY0FBYyxDQUFDLFFBQVEsS0FBSyxTQUFTLEVBQUU7UUFDbEYsYUFBYSxDQUFDLFNBQVMsR0FBRyxjQUFjLENBQUMsUUFBUSxDQUFDO0tBQ25EO0lBRUQsSUFBSSxNQUFpQyxDQUFDO0lBQ3RDLElBQUksZ0JBQXlDLENBQUM7SUFDOUMsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLEVBQTRCLENBQUM7SUFDM0QsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQWtCLENBQUM7SUFDN0MsNkZBQTZGO0lBQzdGLElBQUksS0FBSyxFQUFFLE1BQU0sTUFBTSxJQUFJLElBQUEscUNBQW1CLEVBQUMsY0FBYyxFQUFFLE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFO1FBQ3pGLElBQUEscUJBQU0sRUFBQyxNQUFNLENBQUMsV0FBVyxFQUFFLHVDQUF1QyxDQUFDLENBQUM7UUFFcEUsbUNBQW1DO1FBQ25DLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFFdkQsVUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ25CLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRTtZQUNyQixLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUU7Z0JBQ3JDLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLElBQUEsb0JBQWEsRUFBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ3RFO1NBQ0Y7UUFFRCxJQUFJLE1BQU0sRUFBRTtZQUNWLCtCQUErQjtZQUMvQixLQUFLLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksY0FBYyxFQUFFO2dCQUMzQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUU7b0JBQ2xCLE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2pFLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztpQkFDekU7YUFDRjtZQUVELGlDQUFpQztZQUNqQyxJQUFJLGFBQWEsQ0FBQyxVQUFVLEVBQUU7Z0JBQzVCLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLENBQUM7Z0JBRTlDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDO29CQUNiLElBQUksRUFBRSxhQUFhO29CQUNuQixJQUFJLEVBQUUsR0FBRztpQkFDVixDQUFDLENBQUM7YUFDSjtTQUNGO2FBQU07WUFDTCxtQ0FBbUM7WUFDbkMsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLFdBQVcsQ0FBQyxhQUFhLEVBQUUsY0FBYyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQ3pGLE1BQU0sR0FBRyxNQUFNLElBQUEsbUJBQVksRUFBQyxtQkFBbUIsQ0FBQyxDQUFDO1lBRWpELE1BQU0sTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3RCLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxVQUFVLEVBQUUsT0FBTyxFQUFpQixDQUFDO1lBRS9ELDZCQUE2QjtZQUM3QixNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7U0FDcEI7UUFFRCxrRUFBa0U7UUFDbEUsTUFBTSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBdUMsQ0FBQztLQUM1RjtJQUVELElBQUksTUFBTSxFQUFFO1FBQ1YsSUFBSSxRQUFvQixDQUFDO1FBQ3pCLE9BQU8sQ0FBQyxXQUFXLENBQUMsS0FBSyxJQUFJLEVBQUU7WUFDN0IsTUFBTSxNQUFNLEVBQUUsS0FBSyxFQUFFLENBQUM7WUFDdEIsUUFBUSxFQUFFLEVBQUUsQ0FBQztRQUNmLENBQUMsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxJQUFJLE9BQU8sQ0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQztLQUM1RDtBQUNILENBQUM7QUFwRkQsc0NBb0ZDO0FBRUQsU0FBUyxrQkFBa0IsQ0FDekIsV0FBeUIsRUFDekIsY0FBNkM7SUFFN0MsTUFBTSxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO0lBQzlDLEtBQUssTUFBTSxJQUFJLElBQUksV0FBVyxFQUFFO1FBQzlCLE1BQU0sUUFBUSxHQUFHLEdBQUcsR0FBRyxJQUFBLG9CQUFhLEVBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hELElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFbkIsOEJBQThCO1FBQzlCLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUM3QixjQUFjLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRTtnQkFDM0IsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO2dCQUN2QixJQUFJLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVO2dCQUM5QixPQUFPLEVBQUUsS0FBSzthQUNmLENBQUMsQ0FBQztZQUVILFNBQVM7U0FDVjtRQUVELElBQUksUUFBNEIsQ0FBQztRQUNqQyxNQUFNLGNBQWMsR0FBRyxjQUFjLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3BELElBQUksY0FBYyxJQUFJLGNBQWMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUU7WUFDdEUsc0NBQXNDO1lBQ3RDLElBQUksY0FBYyxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUU7Z0JBQ3JDLGNBQWMsQ0FBQyxJQUFJLEdBQUcsV0FBVyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUM1RDtZQUVELHVDQUF1QztZQUN2QyxRQUFRLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN0QyxJQUFJLFFBQVEsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUN4QyxZQUFZO2dCQUNaLGNBQWMsQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO2dCQUMvQixTQUFTO2FBQ1Y7U0FDRjtRQUVELGNBQWMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFO1lBQzNCLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUN2QixJQUFJLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVO1lBQzlCLElBQUksRUFBRSxRQUFRO1lBQ2QsT0FBTyxFQUFFLElBQUk7U0FDZCxDQUFDLENBQUM7S0FDSjtJQUVELDJCQUEyQjtJQUMzQixLQUFLLE1BQU0sSUFBSSxJQUFJLGNBQWMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtRQUN4QyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNuQixjQUFjLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzdCO0tBQ0Y7QUFDSCxDQUFDO0FBRU0sS0FBSyxVQUFVLFdBQVcsQ0FDL0IsYUFBeUMsRUFDekMsV0FBMEMsRUFDMUMsTUFBMkI7SUFFM0IsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFBLDBDQUFzQixFQUN4QyxhQUFhLENBQUMsYUFBYSxFQUMzQixhQUFhLENBQUMsV0FBVyxDQUMxQixDQUFDO0lBQ0YsSUFBSSxLQUFLLEVBQUU7UUFDVCxJQUFBLCtDQUEyQixFQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ3BDO0lBRUQsTUFBTSxhQUFhLEdBQWlCO1FBQ2xDLFVBQVUsRUFBRSxLQUFLO1FBQ2pCLE9BQU8sRUFBRSxLQUFLO1FBQ2QsUUFBUSxFQUFFLG1CQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQztRQUM1RCxJQUFJLEVBQUUsYUFBYSxDQUFDLGFBQWE7UUFDakMsU0FBUyxFQUFFLEtBQUs7UUFDaEIsT0FBTyxFQUFFLEtBQUs7UUFDZCxJQUFJLEVBQUUsYUFBYTtRQUNuQixPQUFPLEVBQUUsS0FBSztRQUNkLEdBQUcsRUFBRTtZQUNILFlBQVksRUFBRSxJQUFJO1NBQ25CO1FBQ0QsSUFBSSxFQUFFLGFBQWEsQ0FBQyxTQUFTO1FBQzdCLE1BQU0sRUFBRTtZQUNOLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSTtZQUN4QixVQUFVLEVBQUUsSUFBSTtZQUNoQixJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUk7WUFDeEIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJO1lBQ3hCLE9BQU8sRUFBRSxhQUFhLENBQUMsT0FBTztZQUM5QixLQUFLO1lBQ0wsOEZBQThGO1lBQzlGLEtBQUssRUFBRTtnQkFDTCxPQUFPLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDbEI7U0FDRjtRQUNELE9BQU8sRUFBRTtZQUNQO2dCQUNFLElBQUksRUFBRSxxQkFBcUI7Z0JBQzNCLHNEQUFzRDtnQkFDdEQsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsUUFBUTtvQkFDOUIsSUFBSSxRQUFRLElBQUksTUFBTSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRTt3QkFDdEMsMEJBQTBCO3dCQUMxQixNQUFNLENBQUMsWUFBWSxDQUFDLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7d0JBRTlDLE1BQU0sR0FBRyxJQUFBLG9CQUFhLEVBQUMsbUJBQUksQ0FBQyxJQUFJLENBQUMsbUJBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztxQkFDdkU7b0JBRUQsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUNwQyxJQUFJLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7d0JBQ3pCLE9BQU8sTUFBTSxDQUFDO3FCQUNmO2dCQUNILENBQUM7Z0JBQ0QsSUFBSSxDQUFDLEVBQUU7b0JBQ0wsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUNoQyxNQUFNLFlBQVksR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLFFBQVEsQ0FBQztvQkFDckQsSUFBSSxZQUFZLEtBQUssU0FBUyxFQUFFO3dCQUM5QixPQUFPO3FCQUNSO29CQUVELE1BQU0sV0FBVyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQyxFQUFFLFFBQVEsQ0FBQztvQkFFN0QsT0FBTzt3QkFDTCwwRUFBMEU7d0JBQzFFLDBFQUEwRTt3QkFDMUUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQzt3QkFDakQsR0FBRyxFQUFFLFdBQVcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUM7cUJBQy9ELENBQUM7Z0JBQ0osQ0FBQztnQkFDRCxlQUFlLENBQUMsTUFBTTtvQkFDcEIseUNBQXlDO29CQUN6QyxNQUFNLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxTQUFTLHVCQUF1QixDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSTt3QkFDcEUsSUFBSSxHQUFHLENBQUMsR0FBRyxLQUFLLFNBQVMsSUFBSSxHQUFHLENBQUMsYUFBYSxFQUFFOzRCQUM5QyxPQUFPO3lCQUNSO3dCQUVELDhCQUE4Qjt3QkFDOUIsK0RBQStEO3dCQUMvRCxNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLGtCQUFrQixDQUFDLENBQUM7d0JBQ3ZELElBQUksUUFBUSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUM7d0JBQ2xDLElBQUksYUFBYSxDQUFDLFNBQVMsSUFBSSxRQUFRLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsRUFBRTs0QkFDM0UsUUFBUSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQzs0QkFDMUQsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO2dDQUN2QixRQUFRLEdBQUcsR0FBRyxHQUFHLFFBQVEsQ0FBQzs2QkFDM0I7eUJBQ0Y7d0JBQ0QsTUFBTSxTQUFTLEdBQUcsbUJBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7d0JBRXpDLGdEQUFnRDt3QkFDaEQsTUFBTSxlQUFlLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQzt3QkFDN0MsSUFBSSxlQUFlLEtBQUssU0FBUyxFQUFFOzRCQUNqQyxHQUFHLENBQUMsR0FBRyxHQUFHLFFBQVEsZUFBZSxFQUFFLENBQUM7NEJBQ3BDLElBQUksRUFBRSxDQUFDOzRCQUVQLE9BQU87eUJBQ1I7d0JBRUQsdUNBQXVDO3dCQUN2QyxrRkFBa0Y7d0JBQ2xGLGdEQUFnRDt3QkFDaEQsSUFBSSxTQUFTLEtBQUssT0FBTyxFQUFFOzRCQUN6QixNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDOzRCQUM3QyxJQUFJLFVBQVUsRUFBRTtnQ0FDZCxNQUFNLFFBQVEsR0FBRyxJQUFBLGVBQWMsRUFBQyxTQUFTLENBQUMsQ0FBQztnQ0FDM0MsSUFBSSxRQUFRLEVBQUU7b0NBQ1osR0FBRyxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsUUFBUSxDQUFDLENBQUM7aUNBQ3pDO2dDQUNELEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxFQUFFLFVBQVUsQ0FBQyxDQUFDO2dDQUMzQyxJQUFJLGFBQWEsQ0FBQyxPQUFPLEVBQUU7b0NBQ3pCLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FDOUQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQzNCLENBQUM7aUNBQ0g7Z0NBQ0QsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7Z0NBRTdCLE9BQU87NkJBQ1I7eUJBQ0Y7d0JBRUQsSUFBSSxFQUFFLENBQUM7b0JBQ1QsQ0FBQyxDQUFDLENBQUM7b0JBRUgsb0ZBQW9GO29CQUNwRixzQ0FBc0M7b0JBQ3RDLE9BQU8sR0FBRyxFQUFFLENBQ1YsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsU0FBUyxzQkFBc0IsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUk7d0JBQ25FLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFOzRCQUNaLElBQUksRUFBRSxDQUFDOzRCQUVQLE9BQU87eUJBQ1I7d0JBRUQsOEJBQThCO3dCQUM5QiwrREFBK0Q7d0JBQy9ELE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsa0JBQWtCLENBQUMsQ0FBQzt3QkFDdkQsSUFBSSxRQUFRLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQzt3QkFDbEMsSUFBSSxhQUFhLENBQUMsU0FBUyxJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxFQUFFOzRCQUMzRSxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDOzRCQUMxRCxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7Z0NBQ3ZCLFFBQVEsR0FBRyxHQUFHLEdBQUcsUUFBUSxDQUFDOzZCQUMzQjt5QkFDRjt3QkFDRCxJQUFJLFFBQVEsS0FBSyxHQUFHLElBQUksUUFBUSxLQUFLLGFBQWEsRUFBRTs0QkFDbEQsTUFBTSxPQUFPLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsRUFBRSxRQUFRLENBQUM7NEJBQ3pELElBQUksT0FBTyxFQUFFO2dDQUNYLE1BQU07cUNBQ0gsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztxQ0FDbkUsSUFBSSxDQUFDLENBQUMsYUFBYSxFQUFFLEVBQUU7b0NBQ3RCLEdBQUcsQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLFdBQVcsQ0FBQyxDQUFDO29DQUMzQyxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsRUFBRSxVQUFVLENBQUMsQ0FBQztvQ0FDM0MsSUFBSSxhQUFhLENBQUMsT0FBTyxFQUFFO3dDQUN6QixNQUFNLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLENBQzlELEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUMzQixDQUFDO3FDQUNIO29DQUNELEdBQUcsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7Z0NBQ3pCLENBQUMsQ0FBQztxQ0FDRCxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dDQUVqQyxPQUFPOzZCQUNSO3lCQUNGO3dCQUVELElBQUksRUFBRSxDQUFDO29CQUNULENBQUMsQ0FBQyxDQUFDO2dCQUNQLENBQUM7YUFDRjtTQUNGO1FBQ0QsWUFBWSxFQUFFO1lBQ1oscUVBQXFFO1lBQ3JFLFFBQVEsRUFBRSxJQUFJO1NBQ2Y7S0FDRixDQUFDO0lBRUYsSUFBSSxhQUFhLENBQUMsR0FBRyxFQUFFO1FBQ3JCLElBQUksYUFBYSxDQUFDLE9BQU8sSUFBSSxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2pELHdDQUF3QztZQUN4QyxvRUFBb0U7WUFDcEUsYUFBYSxDQUFDLE1BQU8sQ0FBQyxLQUFLLEdBQUc7Z0JBQzVCLElBQUksRUFBRSxNQUFNLElBQUEsbUJBQVEsRUFBQyxhQUFhLENBQUMsT0FBTyxDQUFDO2dCQUMzQyxHQUFHLEVBQUUsTUFBTSxJQUFBLG1CQUFRLEVBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQzthQUMxQyxDQUFDO1NBQ0g7YUFBTTtZQUNMLE1BQU0sRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLEdBQUcsd0RBQWEsMEJBQTBCLEdBQUMsQ0FBQztZQUM3RSxhQUFhLENBQUMsT0FBTyxLQUFyQixhQUFhLENBQUMsT0FBTyxHQUFLLEVBQUUsRUFBQztZQUM3QixhQUFhLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDO1NBQzlDO0tBQ0Y7SUFFRCxPQUFPLGFBQWEsQ0FBQztBQUN2QixDQUFDO0FBak1ELGtDQWlNQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgdHlwZSB7IGpzb24gfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgdHlwZSB7IE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IGxvb2t1cCBhcyBsb29rdXBNaW1lVHlwZSB9IGZyb20gJ21ybWltZSc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IEJpbmFyeUxpa2UsIGNyZWF0ZUhhc2ggfSBmcm9tICdub2RlOmNyeXB0byc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHR5cGUgeyBBZGRyZXNzSW5mbyB9IGZyb20gJ25vZGU6bmV0JztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBJbmxpbmVDb25maWcsIFZpdGVEZXZTZXJ2ZXIsIGNyZWF0ZVNlcnZlciwgbm9ybWFsaXplUGF0aCB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHsgYnVpbGRFc2J1aWxkQnJvd3NlciB9IGZyb20gJy4uL2Jyb3dzZXItZXNidWlsZCc7XG5pbXBvcnQgdHlwZSB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuLi9icm93c2VyLWVzYnVpbGQvc2NoZW1hJztcbmltcG9ydCB7IGxvYWRQcm94eUNvbmZpZ3VyYXRpb24sIG5vcm1hbGl6ZVByb3h5Q29uZmlndXJhdGlvbiB9IGZyb20gJy4vbG9hZC1wcm94eS1jb25maWcnO1xuaW1wb3J0IHR5cGUgeyBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgdHlwZSB7IERldlNlcnZlckJ1aWxkZXJPdXRwdXQgfSBmcm9tICcuL3dlYnBhY2stc2VydmVyJztcblxuaW50ZXJmYWNlIE91dHB1dEZpbGVSZWNvcmQge1xuICBjb250ZW50czogVWludDhBcnJheTtcbiAgc2l6ZTogbnVtYmVyO1xuICBoYXNoPzogQnVmZmVyO1xuICB1cGRhdGVkOiBib29sZWFuO1xufVxuXG5mdW5jdGlvbiBoYXNoQ29udGVudChjb250ZW50czogQmluYXJ5TGlrZSk6IEJ1ZmZlciB7XG4gIC8vIFRPRE86IENvbnNpZGVyIHh4aGFzaFxuICByZXR1cm4gY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGNvbnRlbnRzKS5kaWdlc3QoKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uKiBzZXJ2ZVdpdGhWaXRlKFxuICBzZXJ2ZXJPcHRpb25zOiBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyxcbiAgYnVpbGRlck5hbWU6IHN0cmluZyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBBc3luY0l0ZXJhYmxlSXRlcmF0b3I8RGV2U2VydmVyQnVpbGRlck91dHB1dD4ge1xuICAvLyBHZXQgdGhlIGJyb3dzZXIgY29uZmlndXJhdGlvbiBmcm9tIHRoZSB0YXJnZXQgbmFtZS5cbiAgY29uc3QgcmF3QnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC5nZXRUYXJnZXRPcHRpb25zKFxuICAgIHNlcnZlck9wdGlvbnMuYnJvd3NlclRhcmdldCxcbiAgKSkgYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zO1xuXG4gIGNvbnN0IGJyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQudmFsaWRhdGVPcHRpb25zKFxuICAgIHtcbiAgICAgIC4uLnJhd0Jyb3dzZXJPcHRpb25zLFxuICAgICAgd2F0Y2g6IHNlcnZlck9wdGlvbnMud2F0Y2gsXG4gICAgICBwb2xsOiBzZXJ2ZXJPcHRpb25zLnBvbGwsXG4gICAgICB2ZXJib3NlOiBzZXJ2ZXJPcHRpb25zLnZlcmJvc2UsXG4gICAgfSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gICAgYnVpbGRlck5hbWUsXG4gICkpIGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyT3B0aW9ucztcblxuICBpZiAoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGggPT09IHVuZGVmaW5lZCAmJiBicm93c2VyT3B0aW9ucy5iYXNlSHJlZiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGggPSBicm93c2VyT3B0aW9ucy5iYXNlSHJlZjtcbiAgfVxuXG4gIGxldCBzZXJ2ZXI6IFZpdGVEZXZTZXJ2ZXIgfCB1bmRlZmluZWQ7XG4gIGxldCBsaXN0ZW5pbmdBZGRyZXNzOiBBZGRyZXNzSW5mbyB8IHVuZGVmaW5lZDtcbiAgY29uc3QgZ2VuZXJhdGVkRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4oKTtcbiAgY29uc3QgYXNzZXRGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIC8vIFRPRE86IFN3aXRjaCB0aGlzIHRvIGFuIGFyY2hpdGVjdCBzY2hlZHVsZSBjYWxsIHdoZW4gaW5mcmFzdHJ1Y3R1cmUgc2V0dGluZ3MgYXJlIHN1cHBvcnRlZFxuICBmb3IgYXdhaXQgKGNvbnN0IHJlc3VsdCBvZiBidWlsZEVzYnVpbGRCcm93c2VyKGJyb3dzZXJPcHRpb25zLCBjb250ZXh0LCB7IHdyaXRlOiBmYWxzZSB9KSkge1xuICAgIGFzc2VydChyZXN1bHQub3V0cHV0RmlsZXMsICdCdWlsZGVyIGRpZCBub3QgcHJvdmlkZSByZXN1bHQgZmlsZXMuJyk7XG5cbiAgICAvLyBBbmFseXplIHJlc3VsdCBmaWxlcyBmb3IgY2hhbmdlc1xuICAgIGFuYWx5emVSZXN1bHRGaWxlcyhyZXN1bHQub3V0cHV0RmlsZXMsIGdlbmVyYXRlZEZpbGVzKTtcblxuICAgIGFzc2V0RmlsZXMuY2xlYXIoKTtcbiAgICBpZiAocmVzdWx0LmFzc2V0RmlsZXMpIHtcbiAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgcmVzdWx0LmFzc2V0RmlsZXMpIHtcbiAgICAgICAgYXNzZXRGaWxlcy5zZXQoJy8nICsgbm9ybWFsaXplUGF0aChhc3NldC5kZXN0aW5hdGlvbiksIGFzc2V0LnNvdXJjZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNlcnZlcikge1xuICAgICAgLy8gSW52YWxpZGF0ZSBhbnkgdXBkYXRlZCBmaWxlc1xuICAgICAgZm9yIChjb25zdCBbZmlsZSwgcmVjb3JkXSBvZiBnZW5lcmF0ZWRGaWxlcykge1xuICAgICAgICBpZiAocmVjb3JkLnVwZGF0ZWQpIHtcbiAgICAgICAgICBjb25zdCB1cGRhdGVkTW9kdWxlcyA9IHNlcnZlci5tb2R1bGVHcmFwaC5nZXRNb2R1bGVzQnlGaWxlKGZpbGUpO1xuICAgICAgICAgIHVwZGF0ZWRNb2R1bGVzPy5mb3JFYWNoKChtKSA9PiBzZXJ2ZXI/Lm1vZHVsZUdyYXBoLmludmFsaWRhdGVNb2R1bGUobSkpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFNlbmQgcmVsb2FkIGNvbW1hbmQgdG8gY2xpZW50c1xuICAgICAgaWYgKHNlcnZlck9wdGlvbnMubGl2ZVJlbG9hZCkge1xuICAgICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKCdSZWxvYWRpbmcgY2xpZW50KHMpLi4uJyk7XG5cbiAgICAgICAgc2VydmVyLndzLnNlbmQoe1xuICAgICAgICAgIHR5cGU6ICdmdWxsLXJlbG9hZCcsXG4gICAgICAgICAgcGF0aDogJyonLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gU2V0dXAgc2VydmVyIGFuZCBzdGFydCBsaXN0ZW5pbmdcbiAgICAgIGNvbnN0IHNlcnZlckNvbmZpZ3VyYXRpb24gPSBhd2FpdCBzZXR1cFNlcnZlcihzZXJ2ZXJPcHRpb25zLCBnZW5lcmF0ZWRGaWxlcywgYXNzZXRGaWxlcyk7XG4gICAgICBzZXJ2ZXIgPSBhd2FpdCBjcmVhdGVTZXJ2ZXIoc2VydmVyQ29uZmlndXJhdGlvbik7XG5cbiAgICAgIGF3YWl0IHNlcnZlci5saXN0ZW4oKTtcbiAgICAgIGxpc3RlbmluZ0FkZHJlc3MgPSBzZXJ2ZXIuaHR0cFNlcnZlcj8uYWRkcmVzcygpIGFzIEFkZHJlc3NJbmZvO1xuXG4gICAgICAvLyBsb2cgY29ubmVjdGlvbiBpbmZvcm1hdGlvblxuICAgICAgc2VydmVyLnByaW50VXJscygpO1xuICAgIH1cblxuICAgIC8vIFRPRE86IGFkanVzdCBvdXRwdXQgdHlwaW5ncyB0byByZWZsZWN0IGJvdGggZGV2ZWxvcG1lbnQgc2VydmVyc1xuICAgIHlpZWxkIHsgc3VjY2VzczogdHJ1ZSwgcG9ydDogbGlzdGVuaW5nQWRkcmVzcz8ucG9ydCB9IGFzIHVua25vd24gYXMgRGV2U2VydmVyQnVpbGRlck91dHB1dDtcbiAgfVxuXG4gIGlmIChzZXJ2ZXIpIHtcbiAgICBsZXQgZGVmZXJyZWQ6ICgpID0+IHZvaWQ7XG4gICAgY29udGV4dC5hZGRUZWFyZG93bihhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCBzZXJ2ZXI/LmNsb3NlKCk7XG4gICAgICBkZWZlcnJlZD8uKCk7XG4gICAgfSk7XG4gICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IChkZWZlcnJlZCA9IHJlc29sdmUpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhbmFseXplUmVzdWx0RmlsZXMoXG4gIHJlc3VsdEZpbGVzOiBPdXRwdXRGaWxlW10sXG4gIGdlbmVyYXRlZEZpbGVzOiBNYXA8c3RyaW5nLCBPdXRwdXRGaWxlUmVjb3JkPixcbikge1xuICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KFsnL2luZGV4Lmh0bWwnXSk7XG4gIGZvciAoY29uc3QgZmlsZSBvZiByZXN1bHRGaWxlcykge1xuICAgIGNvbnN0IGZpbGVQYXRoID0gJy8nICsgbm9ybWFsaXplUGF0aChmaWxlLnBhdGgpO1xuICAgIHNlZW4uYWRkKGZpbGVQYXRoKTtcblxuICAgIC8vIFNraXAgYW5hbHlzaXMgb2Ygc291cmNlbWFwc1xuICAgIGlmIChmaWxlUGF0aC5lbmRzV2l0aCgnLm1hcCcpKSB7XG4gICAgICBnZW5lcmF0ZWRGaWxlcy5zZXQoZmlsZVBhdGgsIHtcbiAgICAgICAgY29udGVudHM6IGZpbGUuY29udGVudHMsXG4gICAgICAgIHNpemU6IGZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCxcbiAgICAgICAgdXBkYXRlZDogZmFsc2UsXG4gICAgICB9KTtcblxuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgbGV0IGZpbGVIYXNoOiBCdWZmZXIgfCB1bmRlZmluZWQ7XG4gICAgY29uc3QgZXhpc3RpbmdSZWNvcmQgPSBnZW5lcmF0ZWRGaWxlcy5nZXQoZmlsZVBhdGgpO1xuICAgIGlmIChleGlzdGluZ1JlY29yZCAmJiBleGlzdGluZ1JlY29yZC5zaXplID09PSBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgpIHtcbiAgICAgIC8vIE9ubHkgaGFzaCBleGlzdGluZyBmaWxlIHdoZW4gbmVlZGVkXG4gICAgICBpZiAoZXhpc3RpbmdSZWNvcmQuaGFzaCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGV4aXN0aW5nUmVjb3JkLmhhc2ggPSBoYXNoQ29udGVudChleGlzdGluZ1JlY29yZC5jb250ZW50cyk7XG4gICAgICB9XG5cbiAgICAgIC8vIENvbXBhcmUgYWdhaW5zdCBsYXRlc3QgcmVzdWx0IG91dHB1dFxuICAgICAgZmlsZUhhc2ggPSBoYXNoQ29udGVudChmaWxlLmNvbnRlbnRzKTtcbiAgICAgIGlmIChmaWxlSGFzaC5lcXVhbHMoZXhpc3RpbmdSZWNvcmQuaGFzaCkpIHtcbiAgICAgICAgLy8gU2FtZSBmaWxlXG4gICAgICAgIGV4aXN0aW5nUmVjb3JkLnVwZGF0ZWQgPSBmYWxzZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVkRmlsZXMuc2V0KGZpbGVQYXRoLCB7XG4gICAgICBjb250ZW50czogZmlsZS5jb250ZW50cyxcbiAgICAgIHNpemU6IGZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCxcbiAgICAgIGhhc2g6IGZpbGVIYXNoLFxuICAgICAgdXBkYXRlZDogdHJ1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIENsZWFyIHN0YWxlIG91dHB1dCBmaWxlc1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgZ2VuZXJhdGVkRmlsZXMua2V5cygpKSB7XG4gICAgaWYgKCFzZWVuLmhhcyhmaWxlKSkge1xuICAgICAgZ2VuZXJhdGVkRmlsZXMuZGVsZXRlKGZpbGUpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0dXBTZXJ2ZXIoXG4gIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zLFxuICBvdXRwdXRGaWxlczogTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4sXG4gIGFzc2V0czogTWFwPHN0cmluZywgc3RyaW5nPixcbik6IFByb21pc2U8SW5saW5lQ29uZmlnPiB7XG4gIGNvbnN0IHByb3h5ID0gYXdhaXQgbG9hZFByb3h5Q29uZmlndXJhdGlvbihcbiAgICBzZXJ2ZXJPcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgc2VydmVyT3B0aW9ucy5wcm94eUNvbmZpZyxcbiAgKTtcbiAgaWYgKHByb3h5KSB7XG4gICAgbm9ybWFsaXplUHJveHlDb25maWd1cmF0aW9uKHByb3h5KTtcbiAgfVxuXG4gIGNvbnN0IGNvbmZpZ3VyYXRpb246IElubGluZUNvbmZpZyA9IHtcbiAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICBlbnZGaWxlOiBmYWxzZSxcbiAgICBjYWNoZURpcjogcGF0aC5qb2luKHNlcnZlck9wdGlvbnMuY2FjaGVPcHRpb25zLnBhdGgsICd2aXRlJyksXG4gICAgcm9vdDogc2VydmVyT3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIHB1YmxpY0RpcjogZmFsc2UsXG4gICAgZXNidWlsZDogZmFsc2UsXG4gICAgbW9kZTogJ2RldmVsb3BtZW50JyxcbiAgICBhcHBUeXBlOiAnc3BhJyxcbiAgICBjc3M6IHtcbiAgICAgIGRldlNvdXJjZW1hcDogdHJ1ZSxcbiAgICB9LFxuICAgIGJhc2U6IHNlcnZlck9wdGlvbnMuc2VydmVQYXRoLFxuICAgIHNlcnZlcjoge1xuICAgICAgcG9ydDogc2VydmVyT3B0aW9ucy5wb3J0LFxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICAgIGhvc3Q6IHNlcnZlck9wdGlvbnMuaG9zdCxcbiAgICAgIG9wZW46IHNlcnZlck9wdGlvbnMub3BlbixcbiAgICAgIGhlYWRlcnM6IHNlcnZlck9wdGlvbnMuaGVhZGVycyxcbiAgICAgIHByb3h5LFxuICAgICAgLy8gQ3VycmVudGx5IGRvZXMgbm90IGFwcGVhciB0byBiZSBhIHdheSB0byBkaXNhYmxlIGZpbGUgd2F0Y2hpbmcgZGlyZWN0bHkgc28gaWdub3JlIGFsbCBmaWxlc1xuICAgICAgd2F0Y2g6IHtcbiAgICAgICAgaWdub3JlZDogWycqKi8qJ10sXG4gICAgICB9LFxuICAgIH0sXG4gICAgcGx1Z2luczogW1xuICAgICAge1xuICAgICAgICBuYW1lOiAndml0ZTphbmd1bGFyLW1lbW9yeScsXG4gICAgICAgIC8vIEVuc3VyZXMgcGx1Z2luIGhvb2tzIHJ1biBiZWZvcmUgYnVpbHQtaW4gVml0ZSBob29rc1xuICAgICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgICAgYXN5bmMgcmVzb2x2ZUlkKHNvdXJjZSwgaW1wb3J0ZXIpIHtcbiAgICAgICAgICBpZiAoaW1wb3J0ZXIgJiYgc291cmNlLnN0YXJ0c1dpdGgoJy4nKSkge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIHF1ZXJ5IGlmIHByZXNlbnRcbiAgICAgICAgICAgIGNvbnN0IFtpbXBvcnRlckZpbGVdID0gaW1wb3J0ZXIuc3BsaXQoJz8nLCAxKTtcblxuICAgICAgICAgICAgc291cmNlID0gbm9ybWFsaXplUGF0aChwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKGltcG9ydGVyRmlsZSksIHNvdXJjZSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IFtmaWxlXSA9IHNvdXJjZS5zcGxpdCgnPycsIDEpO1xuICAgICAgICAgIGlmIChvdXRwdXRGaWxlcy5oYXMoZmlsZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBzb3VyY2U7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBsb2FkKGlkKSB7XG4gICAgICAgICAgY29uc3QgW2ZpbGVdID0gaWQuc3BsaXQoJz8nLCAxKTtcbiAgICAgICAgICBjb25zdCBjb2RlQ29udGVudHMgPSBvdXRwdXRGaWxlcy5nZXQoZmlsZSk/LmNvbnRlbnRzO1xuICAgICAgICAgIGlmIChjb2RlQ29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IG1hcENvbnRlbnRzID0gb3V0cHV0RmlsZXMuZ2V0KGZpbGUgKyAnLm1hcCcpPy5jb250ZW50cztcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgc291cmNlIG1hcCBVUkwgY29tbWVudHMgZnJvbSB0aGUgY29kZSBpZiBhIHNvdXJjZW1hcCBpcyBwcmVzZW50LlxuICAgICAgICAgICAgLy8gVml0ZSB3aWxsIGlubGluZSBhbmQgYWRkIGFuIGFkZGl0aW9uYWwgc291cmNlbWFwIFVSTCBmb3IgdGhlIHNvdXJjZW1hcC5cbiAgICAgICAgICAgIGNvZGU6IEJ1ZmZlci5mcm9tKGNvZGVDb250ZW50cykudG9TdHJpbmcoJ3V0Zi04JyksXG4gICAgICAgICAgICBtYXA6IG1hcENvbnRlbnRzICYmIEJ1ZmZlci5mcm9tKG1hcENvbnRlbnRzKS50b1N0cmluZygndXRmLTgnKSxcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICAgICAgLy8gQXNzZXRzIGFuZCByZXNvdXJjZXMgZ2V0IGhhbmRsZWQgZmlyc3RcbiAgICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGZ1bmN0aW9uIGFuZ3VsYXJBc3NldHNNaWRkbGV3YXJlKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgICAgICAgICBpZiAocmVxLnVybCA9PT0gdW5kZWZpbmVkIHx8IHJlcy53cml0YWJsZUVuZGVkKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUGFyc2UgdGhlIGluY29taW5nIHJlcXVlc3QuXG4gICAgICAgICAgICAvLyBUaGUgYmFzZSBvZiB0aGUgVVJMIGlzIHVudXNlZCBidXQgcmVxdWlyZWQgdG8gcGFyc2UgdGhlIFVSTC5cbiAgICAgICAgICAgIGNvbnN0IHBhcnNlZFVybCA9IG5ldyBVUkwocmVxLnVybCwgJ2h0dHA6Ly9sb2NhbGhvc3QnKTtcbiAgICAgICAgICAgIGxldCBwYXRobmFtZSA9IHBhcnNlZFVybC5wYXRobmFtZTtcbiAgICAgICAgICAgIGlmIChzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCAmJiBwYXRobmFtZS5zdGFydHNXaXRoKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoKSkge1xuICAgICAgICAgICAgICBwYXRobmFtZSA9IHBhdGhuYW1lLnNsaWNlKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoLmxlbmd0aCk7XG4gICAgICAgICAgICAgIGlmIChwYXRobmFtZVswXSAhPT0gJy8nKSB7XG4gICAgICAgICAgICAgICAgcGF0aG5hbWUgPSAnLycgKyBwYXRobmFtZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9uID0gcGF0aC5leHRuYW1lKHBhdGhuYW1lKTtcblxuICAgICAgICAgICAgLy8gUmV3cml0ZSBhbGwgYnVpbGQgYXNzZXRzIHRvIGEgdml0ZSByYXcgZnMgVVJMXG4gICAgICAgICAgICBjb25zdCBhc3NldFNvdXJjZVBhdGggPSBhc3NldHMuZ2V0KHBhdGhuYW1lKTtcbiAgICAgICAgICAgIGlmIChhc3NldFNvdXJjZVBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICByZXEudXJsID0gYC9AZnMvJHthc3NldFNvdXJjZVBhdGh9YDtcbiAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVzb3VyY2UgZmlsZXMgYXJlIGhhbmRsZWQgZGlyZWN0bHkuXG4gICAgICAgICAgICAvLyBHbG9iYWwgc3R5bGVzaGVldHMgKENTUyBmaWxlcykgYXJlIGN1cnJlbnRseSBjb25zaWRlcmVkIHJlc291cmNlcyB0byB3b3JrYXJvdW5kXG4gICAgICAgICAgICAvLyBkZXYgc2VydmVyIHNvdXJjZW1hcCBpc3N1ZXMgd2l0aCBzdHlsZXNoZWV0cy5cbiAgICAgICAgICAgIGlmIChleHRlbnNpb24gIT09ICcuaHRtbCcpIHtcbiAgICAgICAgICAgICAgY29uc3Qgb3V0cHV0RmlsZSA9IG91dHB1dEZpbGVzLmdldChwYXRobmFtZSk7XG4gICAgICAgICAgICAgIGlmIChvdXRwdXRGaWxlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWltZVR5cGUgPSBsb29rdXBNaW1lVHlwZShleHRlbnNpb24pO1xuICAgICAgICAgICAgICAgIGlmIChtaW1lVHlwZSkge1xuICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgbWltZVR5cGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDYWNoZS1Db250cm9sJywgJ25vLWNhY2hlJyk7XG4gICAgICAgICAgICAgICAgaWYgKHNlcnZlck9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoc2VydmVyT3B0aW9ucy5oZWFkZXJzKS5mb3JFYWNoKChbbmFtZSwgdmFsdWVdKSA9PlxuICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKG5hbWUsIHZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlcy5lbmQob3V0cHV0RmlsZS5jb250ZW50cyk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gUmV0dXJuaW5nIGEgZnVuY3Rpb24sIGluc3RhbGxzIG1pZGRsZXdhcmUgYWZ0ZXIgdGhlIG1haW4gdHJhbnNmb3JtIG1pZGRsZXdhcmUgYnV0XG4gICAgICAgICAgLy8gYmVmb3JlIHRoZSBidWlsdC1pbiBIVE1MIG1pZGRsZXdhcmVcbiAgICAgICAgICByZXR1cm4gKCkgPT5cbiAgICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoZnVuY3Rpb24gYW5ndWxhckluZGV4TWlkZGxld2FyZShyZXEsIHJlcywgbmV4dCkge1xuICAgICAgICAgICAgICBpZiAoIXJlcS51cmwpIHtcbiAgICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBQYXJzZSB0aGUgaW5jb21pbmcgcmVxdWVzdC5cbiAgICAgICAgICAgICAgLy8gVGhlIGJhc2Ugb2YgdGhlIFVSTCBpcyB1bnVzZWQgYnV0IHJlcXVpcmVkIHRvIHBhcnNlIHRoZSBVUkwuXG4gICAgICAgICAgICAgIGNvbnN0IHBhcnNlZFVybCA9IG5ldyBVUkwocmVxLnVybCwgJ2h0dHA6Ly9sb2NhbGhvc3QnKTtcbiAgICAgICAgICAgICAgbGV0IHBhdGhuYW1lID0gcGFyc2VkVXJsLnBhdGhuYW1lO1xuICAgICAgICAgICAgICBpZiAoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGggJiYgcGF0aG5hbWUuc3RhcnRzV2l0aChzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCkpIHtcbiAgICAgICAgICAgICAgICBwYXRobmFtZSA9IHBhdGhuYW1lLnNsaWNlKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgaWYgKHBhdGhuYW1lWzBdICE9PSAnLycpIHtcbiAgICAgICAgICAgICAgICAgIHBhdGhuYW1lID0gJy8nICsgcGF0aG5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChwYXRobmFtZSA9PT0gJy8nIHx8IHBhdGhuYW1lID09PSBgL2luZGV4Lmh0bWxgKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3SHRtbCA9IG91dHB1dEZpbGVzLmdldCgnL2luZGV4Lmh0bWwnKT8uY29udGVudHM7XG4gICAgICAgICAgICAgICAgaWYgKHJhd0h0bWwpIHtcbiAgICAgICAgICAgICAgICAgIHNlcnZlclxuICAgICAgICAgICAgICAgICAgICAudHJhbnNmb3JtSW5kZXhIdG1sKHJlcS51cmwsIEJ1ZmZlci5mcm9tKHJhd0h0bWwpLnRvU3RyaW5nKCd1dGYtOCcpKVxuICAgICAgICAgICAgICAgICAgICAudGhlbigocHJvY2Vzc2VkSHRtbCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICd0ZXh0L2h0bWwnKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDYWNoZS1Db250cm9sJywgJ25vLWNhY2hlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHNlcnZlck9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoc2VydmVyT3B0aW9ucy5oZWFkZXJzKS5mb3JFYWNoKChbbmFtZSwgdmFsdWVdKSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKG5hbWUsIHZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIHJlcy5lbmQocHJvY2Vzc2VkSHRtbCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IG5leHQoZXJyb3IpKTtcblxuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdLFxuICAgIG9wdGltaXplRGVwczoge1xuICAgICAgLy8gVE9ETzogQ29uc2lkZXIgZW5hYmxpbmcgZm9yIGtub3duIHNhZmUgZGVwZW5kZW5jaWVzIChAYW5ndWxhci8qID8pXG4gICAgICBkaXNhYmxlZDogdHJ1ZSxcbiAgICB9LFxuICB9O1xuXG4gIGlmIChzZXJ2ZXJPcHRpb25zLnNzbCkge1xuICAgIGlmIChzZXJ2ZXJPcHRpb25zLnNzbENlcnQgJiYgc2VydmVyT3B0aW9ucy5zc2xLZXkpIHtcbiAgICAgIC8vIHNlcnZlciBjb25maWd1cmF0aW9uIGlzIGRlZmluZWQgYWJvdmVcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gICAgICBjb25maWd1cmF0aW9uLnNlcnZlciEuaHR0cHMgPSB7XG4gICAgICAgIGNlcnQ6IGF3YWl0IHJlYWRGaWxlKHNlcnZlck9wdGlvbnMuc3NsQ2VydCksXG4gICAgICAgIGtleTogYXdhaXQgcmVhZEZpbGUoc2VydmVyT3B0aW9ucy5zc2xLZXkpLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgeyBkZWZhdWx0OiBiYXNpY1NzbFBsdWdpbiB9ID0gYXdhaXQgaW1wb3J0KCdAdml0ZWpzL3BsdWdpbi1iYXNpYy1zc2wnKTtcbiAgICAgIGNvbmZpZ3VyYXRpb24ucGx1Z2lucyA/Pz0gW107XG4gICAgICBjb25maWd1cmF0aW9uLnBsdWdpbnMucHVzaChiYXNpY1NzbFBsdWdpbigpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gY29uZmlndXJhdGlvbjtcbn1cbiJdfQ==