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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3ZpdGUtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0gsbUNBQWtEO0FBQ2xELDhEQUFpQztBQUNqQyw2Q0FBcUQ7QUFDckQsK0NBQTRDO0FBRTVDLDBEQUE2QjtBQUM3QiwrQkFBZ0Y7QUFDaEYsdUZBQW1GO0FBQ25GLHdEQUF5RDtBQUV6RCwyREFBNkQ7QUFXN0QsU0FBUyxXQUFXLENBQUMsUUFBb0I7SUFDdkMsd0JBQXdCO0lBQ3hCLE9BQU8sSUFBQSx3QkFBVSxFQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUN4RCxDQUFDO0FBRU0sS0FBSyxTQUFTLENBQUMsQ0FBQyxhQUFhLENBQ2xDLGFBQXlDLEVBQ3pDLFdBQW1CLEVBQ25CLE9BQXVCO0lBRXZCLHNEQUFzRDtJQUN0RCxNQUFNLGlCQUFpQixHQUFHLENBQUMsTUFBTSxPQUFPLENBQUMsZ0JBQWdCLENBQ3ZELGFBQWEsQ0FBQyxhQUFhLENBQzVCLENBQTRDLENBQUM7SUFFOUMsTUFBTSxjQUFjLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQ25EO1FBQ0UsR0FBRyxpQkFBaUI7UUFDcEIsS0FBSyxFQUFFLGFBQWEsQ0FBQyxLQUFLO1FBQzFCLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSTtRQUN4QixPQUFPLEVBQUUsYUFBYSxDQUFDLE9BQU87S0FDWSxFQUM1QyxXQUFXLENBQ1osQ0FBNEMsQ0FBQztJQUM5QyxtRUFBbUU7SUFDbkUsY0FBYyxDQUFDLGdCQUFnQixHQUFHLGFBQWEsQ0FBQyxZ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LG9FQUFvRTtZQUNwRSxhQUFhLENBQUMsTUFBTyxDQUFDLEtBQUssR0FBRztnQkFDNUIsSUFBSSxFQUFFLE1BQU0sSUFBQSxtQkFBUSxFQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUM7Z0JBQzNDLEdBQUcsRUFBRSxNQUFNLElBQUEsbUJBQVEsRUFBQyxhQUFhLENBQUMsTUFBTSxDQUFDO2FBQzFDLENBQUM7U0FDSDthQUFNO1lBQ0wsTUFBTSxFQUFFLE9BQU8sRUFBRSxjQUFjLEVBQUUsR0FBRyx3REFBYSwwQkFBMEIsR0FBQyxDQUFDO1lBQzdFLGFBQWEsQ0FBQyxPQUFPLEtBQXJCLGFBQWEsQ0FBQyxPQUFPLEdBQUssRUFBRSxFQUFDO1lBQzdCLGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUM7U0FDOUM7S0FDRjtJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUM7QUFuT0Qsa0NBbU9DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB0eXBlIHsganNvbiB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB0eXBlIHsgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgbG9va3VwIGFzIGxvb2t1cE1pbWVUeXBlIH0gZnJvbSAnbXJtaW1lJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgQmluYXJ5TGlrZSwgY3JlYXRlSGFzaCB9IGZyb20gJ25vZGU6Y3J5cHRvJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgdHlwZSB7IEFkZHJlc3NJbmZvIH0gZnJvbSAnbm9kZTpuZXQnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IElubGluZUNvbmZpZywgVml0ZURldlNlcnZlciwgY3JlYXRlU2VydmVyLCBub3JtYWxpemVQYXRoIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2phdmFzY3JpcHQtdHJhbnNmb3JtZXInO1xuaW1wb3J0IHsgYnVpbGRFc2J1aWxkQnJvd3NlciB9IGZyb20gJy4uL2Jyb3dzZXItZXNidWlsZCc7XG5pbXBvcnQgdHlwZSB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuLi9icm93c2VyLWVzYnVpbGQvc2NoZW1hJztcbmltcG9ydCB7IGxvYWRQcm94eUNvbmZpZ3VyYXRpb24gfSBmcm9tICcuL2xvYWQtcHJveHktY29uZmlnJztcbmltcG9ydCB0eXBlIHsgTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnO1xuaW1wb3J0IHR5cGUgeyBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0IH0gZnJvbSAnLi93ZWJwYWNrLXNlcnZlcic7XG5cbmludGVyZmFjZSBPdXRwdXRGaWxlUmVjb3JkIHtcbiAgY29udGVudHM6IFVpbnQ4QXJyYXk7XG4gIHNpemU6IG51bWJlcjtcbiAgaGFzaD86IEJ1ZmZlcjtcbiAgdXBkYXRlZDogYm9vbGVhbjtcbn1cblxuZnVuY3Rpb24gaGFzaENvbnRlbnQoY29udGVudHM6IEJpbmFyeUxpa2UpOiBCdWZmZXIge1xuICAvLyBUT0RPOiBDb25zaWRlciB4eGhhc2hcbiAgcmV0dXJuIGNyZWF0ZUhhc2goJ3NoYTI1NicpLnVwZGF0ZShjb250ZW50cykuZGlnZXN0KCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogc2VydmVXaXRoVml0ZShcbiAgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMsXG4gIGJ1aWxkZXJOYW1lOiBzdHJpbmcsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPERldlNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gR2V0IHRoZSBicm93c2VyIGNvbmZpZ3VyYXRpb24gZnJvbSB0aGUgdGFyZ2V0IG5hbWUuXG4gIGNvbnN0IHJhd0Jyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhcbiAgICBzZXJ2ZXJPcHRpb25zLmJyb3dzZXJUYXJnZXQsXG4gICkpIGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyT3B0aW9ucztcblxuICBjb25zdCBicm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LnZhbGlkYXRlT3B0aW9ucyhcbiAgICB7XG4gICAgICAuLi5yYXdCcm93c2VyT3B0aW9ucyxcbiAgICAgIHdhdGNoOiBzZXJ2ZXJPcHRpb25zLndhdGNoLFxuICAgICAgcG9sbDogc2VydmVyT3B0aW9ucy5wb2xsLFxuICAgICAgdmVyYm9zZTogc2VydmVyT3B0aW9ucy52ZXJib3NlLFxuICAgIH0gYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICAgIGJ1aWxkZXJOYW1lLFxuICApKSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG4gIC8vIFNldCBhbGwgcGFja2FnZXMgYXMgZXh0ZXJuYWwgdG8gc3VwcG9ydCBWaXRlJ3MgcHJlYnVuZGxlIGNhY2hpbmdcbiAgYnJvd3Nlck9wdGlvbnMuZXh0ZXJuYWxQYWNrYWdlcyA9IHNlcnZlck9wdGlvbnMuY2FjaGVPcHRpb25zLmVuYWJsZWQ7XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoID09PSB1bmRlZmluZWQgJiYgYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYgIT09IHVuZGVmaW5lZCkge1xuICAgIHNlcnZlck9wdGlvbnMuc2VydmVQYXRoID0gYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWY7XG4gIH1cblxuICBsZXQgc2VydmVyOiBWaXRlRGV2U2VydmVyIHwgdW5kZWZpbmVkO1xuICBsZXQgbGlzdGVuaW5nQWRkcmVzczogQWRkcmVzc0luZm8gfCB1bmRlZmluZWQ7XG4gIGNvbnN0IGdlbmVyYXRlZEZpbGVzID0gbmV3IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+KCk7XG4gIGNvbnN0IGFzc2V0RmlsZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAvLyBUT0RPOiBTd2l0Y2ggdGhpcyB0byBhbiBhcmNoaXRlY3Qgc2NoZWR1bGUgY2FsbCB3aGVuIGluZnJhc3RydWN0dXJlIHNldHRpbmdzIGFyZSBzdXBwb3J0ZWRcbiAgZm9yIGF3YWl0IChjb25zdCByZXN1bHQgb2YgYnVpbGRFc2J1aWxkQnJvd3Nlcihicm93c2VyT3B0aW9ucywgY29udGV4dCwge1xuICAgIHdyaXRlOiBmYWxzZSxcbiAgfSkpIHtcbiAgICBhc3NlcnQocmVzdWx0Lm91dHB1dEZpbGVzLCAnQnVpbGRlciBkaWQgbm90IHByb3ZpZGUgcmVzdWx0IGZpbGVzLicpO1xuXG4gICAgLy8gQW5hbHl6ZSByZXN1bHQgZmlsZXMgZm9yIGNoYW5nZXNcbiAgICBhbmFseXplUmVzdWx0RmlsZXMocmVzdWx0Lm91dHB1dEZpbGVzLCBnZW5lcmF0ZWRGaWxlcyk7XG5cbiAgICBhc3NldEZpbGVzLmNsZWFyKCk7XG4gICAgaWYgKHJlc3VsdC5hc3NldEZpbGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IGFzc2V0IG9mIHJlc3VsdC5hc3NldEZpbGVzKSB7XG4gICAgICAgIGFzc2V0RmlsZXMuc2V0KCcvJyArIG5vcm1hbGl6ZVBhdGgoYXNzZXQuZGVzdGluYXRpb24pLCBhc3NldC5zb3VyY2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzZXJ2ZXIpIHtcbiAgICAgIC8vIEludmFsaWRhdGUgYW55IHVwZGF0ZWQgZmlsZXNcbiAgICAgIGZvciAoY29uc3QgW2ZpbGUsIHJlY29yZF0gb2YgZ2VuZXJhdGVkRmlsZXMpIHtcbiAgICAgICAgaWYgKHJlY29yZC51cGRhdGVkKSB7XG4gICAgICAgICAgY29uc3QgdXBkYXRlZE1vZHVsZXMgPSBzZXJ2ZXIubW9kdWxlR3JhcGguZ2V0TW9kdWxlc0J5RmlsZShmaWxlKTtcbiAgICAgICAgICB1cGRhdGVkTW9kdWxlcz8uZm9yRWFjaCgobSkgPT4gc2VydmVyPy5tb2R1bGVHcmFwaC5pbnZhbGlkYXRlTW9kdWxlKG0pKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBTZW5kIHJlbG9hZCBjb21tYW5kIHRvIGNsaWVudHNcbiAgICAgIGlmIChzZXJ2ZXJPcHRpb25zLmxpdmVSZWxvYWQpIHtcbiAgICAgICAgY29udGV4dC5sb2dnZXIuaW5mbygnUmVsb2FkaW5nIGNsaWVudChzKS4uLicpO1xuXG4gICAgICAgIHNlcnZlci53cy5zZW5kKHtcbiAgICAgICAgICB0eXBlOiAnZnVsbC1yZWxvYWQnLFxuICAgICAgICAgIHBhdGg6ICcqJyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFNldHVwIHNlcnZlciBhbmQgc3RhcnQgbGlzdGVuaW5nXG4gICAgICBjb25zdCBzZXJ2ZXJDb25maWd1cmF0aW9uID0gYXdhaXQgc2V0dXBTZXJ2ZXIoXG4gICAgICAgIHNlcnZlck9wdGlvbnMsXG4gICAgICAgIGdlbmVyYXRlZEZpbGVzLFxuICAgICAgICBhc3NldEZpbGVzLFxuICAgICAgICBicm93c2VyT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgICBicm93c2VyT3B0aW9ucy5leHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICAgICk7XG4gICAgICBzZXJ2ZXIgPSBhd2FpdCBjcmVhdGVTZXJ2ZXIoc2VydmVyQ29uZmlndXJhdGlvbik7XG5cbiAgICAgIGF3YWl0IHNlcnZlci5saXN0ZW4oKTtcbiAgICAgIGxpc3RlbmluZ0FkZHJlc3MgPSBzZXJ2ZXIuaHR0cFNlcnZlcj8uYWRkcmVzcygpIGFzIEFkZHJlc3NJbmZvO1xuXG4gICAgICAvLyBsb2cgY29ubmVjdGlvbiBpbmZvcm1hdGlvblxuICAgICAgc2VydmVyLnByaW50VXJscygpO1xuICAgIH1cblxuICAgIC8vIFRPRE86IGFkanVzdCBvdXRwdXQgdHlwaW5ncyB0byByZWZsZWN0IGJvdGggZGV2ZWxvcG1lbnQgc2VydmVyc1xuICAgIHlpZWxkIHsgc3VjY2VzczogdHJ1ZSwgcG9ydDogbGlzdGVuaW5nQWRkcmVzcz8ucG9ydCB9IGFzIHVua25vd24gYXMgRGV2U2VydmVyQnVpbGRlck91dHB1dDtcbiAgfVxuXG4gIGlmIChzZXJ2ZXIpIHtcbiAgICBsZXQgZGVmZXJyZWQ6ICgpID0+IHZvaWQ7XG4gICAgY29udGV4dC5hZGRUZWFyZG93bihhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCBzZXJ2ZXI/LmNsb3NlKCk7XG4gICAgICBkZWZlcnJlZD8uKCk7XG4gICAgfSk7XG4gICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IChkZWZlcnJlZCA9IHJlc29sdmUpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhbmFseXplUmVzdWx0RmlsZXMoXG4gIHJlc3VsdEZpbGVzOiBPdXRwdXRGaWxlW10sXG4gIGdlbmVyYXRlZEZpbGVzOiBNYXA8c3RyaW5nLCBPdXRwdXRGaWxlUmVjb3JkPixcbikge1xuICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KFsnL2luZGV4Lmh0bWwnXSk7XG4gIGZvciAoY29uc3QgZmlsZSBvZiByZXN1bHRGaWxlcykge1xuICAgIGNvbnN0IGZpbGVQYXRoID0gJy8nICsgbm9ybWFsaXplUGF0aChmaWxlLnBhdGgpO1xuICAgIHNlZW4uYWRkKGZpbGVQYXRoKTtcblxuICAgIC8vIFNraXAgYW5hbHlzaXMgb2Ygc291cmNlbWFwc1xuICAgIGlmIChmaWxlUGF0aC5lbmRzV2l0aCgnLm1hcCcpKSB7XG4gICAgICBnZW5lcmF0ZWRGaWxlcy5zZXQoZmlsZVBhdGgsIHtcbiAgICAgICAgY29udGVudHM6IGZpbGUuY29udGVudHMsXG4gICAgICAgIHNpemU6IGZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCxcbiAgICAgICAgdXBkYXRlZDogZmFsc2UsXG4gICAgICB9KTtcblxuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgbGV0IGZpbGVIYXNoOiBCdWZmZXIgfCB1bmRlZmluZWQ7XG4gICAgY29uc3QgZXhpc3RpbmdSZWNvcmQgPSBnZW5lcmF0ZWRGaWxlcy5nZXQoZmlsZVBhdGgpO1xuICAgIGlmIChleGlzdGluZ1JlY29yZCAmJiBleGlzdGluZ1JlY29yZC5zaXplID09PSBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgpIHtcbiAgICAgIC8vIE9ubHkgaGFzaCBleGlzdGluZyBmaWxlIHdoZW4gbmVlZGVkXG4gICAgICBpZiAoZXhpc3RpbmdSZWNvcmQuaGFzaCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGV4aXN0aW5nUmVjb3JkLmhhc2ggPSBoYXNoQ29udGVudChleGlzdGluZ1JlY29yZC5jb250ZW50cyk7XG4gICAgICB9XG5cbiAgICAgIC8vIENvbXBhcmUgYWdhaW5zdCBsYXRlc3QgcmVzdWx0IG91dHB1dFxuICAgICAgZmlsZUhhc2ggPSBoYXNoQ29udGVudChmaWxlLmNvbnRlbnRzKTtcbiAgICAgIGlmIChmaWxlSGFzaC5lcXVhbHMoZXhpc3RpbmdSZWNvcmQuaGFzaCkpIHtcbiAgICAgICAgLy8gU2FtZSBmaWxlXG4gICAgICAgIGV4aXN0aW5nUmVjb3JkLnVwZGF0ZWQgPSBmYWxzZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVkRmlsZXMuc2V0KGZpbGVQYXRoLCB7XG4gICAgICBjb250ZW50czogZmlsZS5jb250ZW50cyxcbiAgICAgIHNpemU6IGZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCxcbiAgICAgIGhhc2g6IGZpbGVIYXNoLFxuICAgICAgdXBkYXRlZDogdHJ1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIENsZWFyIHN0YWxlIG91dHB1dCBmaWxlc1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgZ2VuZXJhdGVkRmlsZXMua2V5cygpKSB7XG4gICAgaWYgKCFzZWVuLmhhcyhmaWxlKSkge1xuICAgICAgZ2VuZXJhdGVkRmlsZXMuZGVsZXRlKGZpbGUpO1xuICAgIH1cbiAgfVxufVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldHVwU2VydmVyKFxuICBzZXJ2ZXJPcHRpb25zOiBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyxcbiAgb3V0cHV0RmlsZXM6IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+LFxuICBhc3NldHM6IE1hcDxzdHJpbmcsIHN0cmluZz4sXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4gfCB1bmRlZmluZWQsXG4gIHByZWJ1bmRsZUV4Y2x1ZGU6IHN0cmluZ1tdIHwgdW5kZWZpbmVkLFxuKTogUHJvbWlzZTxJbmxpbmVDb25maWc+IHtcbiAgY29uc3QgcHJveHkgPSBhd2FpdCBsb2FkUHJveHlDb25maWd1cmF0aW9uKFxuICAgIHNlcnZlck9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICBzZXJ2ZXJPcHRpb25zLnByb3h5Q29uZmlnLFxuICAgIHRydWUsXG4gICk7XG5cbiAgY29uc3QgY29uZmlndXJhdGlvbjogSW5saW5lQ29uZmlnID0ge1xuICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIGVudkZpbGU6IGZhbHNlLFxuICAgIGNhY2hlRGlyOiBwYXRoLmpvaW4oc2VydmVyT3B0aW9ucy5jYWNoZU9wdGlvbnMucGF0aCwgJ3ZpdGUnKSxcbiAgICByb290OiBzZXJ2ZXJPcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgcHVibGljRGlyOiBmYWxzZSxcbiAgICBlc2J1aWxkOiBmYWxzZSxcbiAgICBtb2RlOiAnZGV2ZWxvcG1lbnQnLFxuICAgIGFwcFR5cGU6ICdzcGEnLFxuICAgIGNzczoge1xuICAgICAgZGV2U291cmNlbWFwOiB0cnVlLFxuICAgIH0sXG4gICAgYmFzZTogc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgsXG4gICAgcmVzb2x2ZToge1xuICAgICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICB9LFxuICAgIHNlcnZlcjoge1xuICAgICAgcG9ydDogc2VydmVyT3B0aW9ucy5wb3J0LFxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICAgIGhvc3Q6IHNlcnZlck9wdGlvbnMuaG9zdCxcbiAgICAgIG9wZW46IHNlcnZlck9wdGlvbnMub3BlbixcbiAgICAgIGhlYWRlcnM6IHNlcnZlck9wdGlvbnMuaGVhZGVycyxcbiAgICAgIHByb3h5LFxuICAgICAgLy8gQ3VycmVudGx5IGRvZXMgbm90IGFwcGVhciB0byBiZSBhIHdheSB0byBkaXNhYmxlIGZpbGUgd2F0Y2hpbmcgZGlyZWN0bHkgc28gaWdub3JlIGFsbCBmaWxlc1xuICAgICAgd2F0Y2g6IHtcbiAgICAgICAgaWdub3JlZDogWycqKi8qJ10sXG4gICAgICB9LFxuICAgIH0sXG4gICAgcGx1Z2luczogW1xuICAgICAge1xuICAgICAgICBuYW1lOiAndml0ZTphbmd1bGFyLW1lbW9yeScsXG4gICAgICAgIC8vIEVuc3VyZXMgcGx1Z2luIGhvb2tzIHJ1biBiZWZvcmUgYnVpbHQtaW4gVml0ZSBob29rc1xuICAgICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgICAgYXN5bmMgcmVzb2x2ZUlkKHNvdXJjZSwgaW1wb3J0ZXIpIHtcbiAgICAgICAgICBpZiAoaW1wb3J0ZXIgJiYgc291cmNlLnN0YXJ0c1dpdGgoJy4nKSkge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIHF1ZXJ5IGlmIHByZXNlbnRcbiAgICAgICAgICAgIGNvbnN0IFtpbXBvcnRlckZpbGVdID0gaW1wb3J0ZXIuc3BsaXQoJz8nLCAxKTtcblxuICAgICAgICAgICAgc291cmNlID0gbm9ybWFsaXplUGF0aChwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKGltcG9ydGVyRmlsZSksIHNvdXJjZSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IFtmaWxlXSA9IHNvdXJjZS5zcGxpdCgnPycsIDEpO1xuICAgICAgICAgIGlmIChvdXRwdXRGaWxlcy5oYXMoZmlsZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBzb3VyY2U7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBsb2FkKGlkKSB7XG4gICAgICAgICAgY29uc3QgW2ZpbGVdID0gaWQuc3BsaXQoJz8nLCAxKTtcbiAgICAgICAgICBjb25zdCBjb2RlQ29udGVudHMgPSBvdXRwdXRGaWxlcy5nZXQoZmlsZSk/LmNvbnRlbnRzO1xuICAgICAgICAgIGlmIChjb2RlQ29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGNvZGUgPSBCdWZmZXIuZnJvbShjb2RlQ29udGVudHMpLnRvU3RyaW5nKCd1dGYtOCcpO1xuICAgICAgICAgIGNvbnN0IG1hcENvbnRlbnRzID0gb3V0cHV0RmlsZXMuZ2V0KGZpbGUgKyAnLm1hcCcpPy5jb250ZW50cztcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgc291cmNlIG1hcCBVUkwgY29tbWVudHMgZnJvbSB0aGUgY29kZSBpZiBhIHNvdXJjZW1hcCBpcyBwcmVzZW50LlxuICAgICAgICAgICAgLy8gVml0ZSB3aWxsIGlubGluZSBhbmQgYWRkIGFuIGFkZGl0aW9uYWwgc291cmNlbWFwIFVSTCBmb3IgdGhlIHNvdXJjZW1hcC5cbiAgICAgICAgICAgIGNvZGU6IG1hcENvbnRlbnRzID8gY29kZS5yZXBsYWNlKC9eXFwvXFwvIyBzb3VyY2VNYXBwaW5nVVJMPVteXFxyXFxuXSovZ20sICcnKSA6IGNvZGUsXG4gICAgICAgICAgICBtYXA6IG1hcENvbnRlbnRzICYmIEJ1ZmZlci5mcm9tKG1hcENvbnRlbnRzKS50b1N0cmluZygndXRmLTgnKSxcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICAgICAgLy8gQXNzZXRzIGFuZCByZXNvdXJjZXMgZ2V0IGhhbmRsZWQgZmlyc3RcbiAgICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGZ1bmN0aW9uIGFuZ3VsYXJBc3NldHNNaWRkbGV3YXJlKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgICAgICAgICBpZiAocmVxLnVybCA9PT0gdW5kZWZpbmVkIHx8IHJlcy53cml0YWJsZUVuZGVkKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUGFyc2UgdGhlIGluY29taW5nIHJlcXVlc3QuXG4gICAgICAgICAgICAvLyBUaGUgYmFzZSBvZiB0aGUgVVJMIGlzIHVudXNlZCBidXQgcmVxdWlyZWQgdG8gcGFyc2UgdGhlIFVSTC5cbiAgICAgICAgICAgIGNvbnN0IHBhcnNlZFVybCA9IG5ldyBVUkwocmVxLnVybCwgJ2h0dHA6Ly9sb2NhbGhvc3QnKTtcbiAgICAgICAgICAgIGxldCBwYXRobmFtZSA9IGRlY29kZVVSSUNvbXBvbmVudChwYXJzZWRVcmwucGF0aG5hbWUpO1xuICAgICAgICAgICAgaWYgKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoICYmIHBhdGhuYW1lLnN0YXJ0c1dpdGgoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgpKSB7XG4gICAgICAgICAgICAgIHBhdGhuYW1lID0gcGF0aG5hbWUuc2xpY2Uoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgubGVuZ3RoKTtcbiAgICAgICAgICAgICAgaWYgKHBhdGhuYW1lWzBdICE9PSAnLycpIHtcbiAgICAgICAgICAgICAgICBwYXRobmFtZSA9ICcvJyArIHBhdGhuYW1lO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBleHRlbnNpb24gPSBwYXRoLmV4dG5hbWUocGF0aG5hbWUpO1xuXG4gICAgICAgICAgICAvLyBSZXdyaXRlIGFsbCBidWlsZCBhc3NldHMgdG8gYSB2aXRlIHJhdyBmcyBVUkxcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0U291cmNlUGF0aCA9IGFzc2V0cy5nZXQocGF0aG5hbWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0U291cmNlUGF0aCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHJlcS51cmwgPSBgL0Bmcy8ke2VuY29kZVVSSUNvbXBvbmVudChhc3NldFNvdXJjZVBhdGgpfWA7XG4gICAgICAgICAgICAgIG5leHQoKTtcblxuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJlc291cmNlIGZpbGVzIGFyZSBoYW5kbGVkIGRpcmVjdGx5LlxuICAgICAgICAgICAgLy8gR2xvYmFsIHN0eWxlc2hlZXRzIChDU1MgZmlsZXMpIGFyZSBjdXJyZW50bHkgY29uc2lkZXJlZCByZXNvdXJjZXMgdG8gd29ya2Fyb3VuZFxuICAgICAgICAgICAgLy8gZGV2IHNlcnZlciBzb3VyY2VtYXAgaXNzdWVzIHdpdGggc3R5bGVzaGVldHMuXG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9uICE9PSAnLmpzJyAmJiBleHRlbnNpb24gIT09ICcuaHRtbCcpIHtcbiAgICAgICAgICAgICAgY29uc3Qgb3V0cHV0RmlsZSA9IG91dHB1dEZpbGVzLmdldChwYXRobmFtZSk7XG4gICAgICAgICAgICAgIGlmIChvdXRwdXRGaWxlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWltZVR5cGUgPSBsb29rdXBNaW1lVHlwZShleHRlbnNpb24pO1xuICAgICAgICAgICAgICAgIGlmIChtaW1lVHlwZSkge1xuICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgbWltZVR5cGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDYWNoZS1Db250cm9sJywgJ25vLWNhY2hlJyk7XG4gICAgICAgICAgICAgICAgaWYgKHNlcnZlck9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoc2VydmVyT3B0aW9ucy5oZWFkZXJzKS5mb3JFYWNoKChbbmFtZSwgdmFsdWVdKSA9PlxuICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKG5hbWUsIHZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlcy5lbmQob3V0cHV0RmlsZS5jb250ZW50cyk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gUmV0dXJuaW5nIGEgZnVuY3Rpb24sIGluc3RhbGxzIG1pZGRsZXdhcmUgYWZ0ZXIgdGhlIG1haW4gdHJhbnNmb3JtIG1pZGRsZXdhcmUgYnV0XG4gICAgICAgICAgLy8gYmVmb3JlIHRoZSBidWlsdC1pbiBIVE1MIG1pZGRsZXdhcmVcbiAgICAgICAgICByZXR1cm4gKCkgPT5cbiAgICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoZnVuY3Rpb24gYW5ndWxhckluZGV4TWlkZGxld2FyZShyZXEsIHJlcywgbmV4dCkge1xuICAgICAgICAgICAgICBpZiAoIXJlcS51cmwpIHtcbiAgICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBQYXJzZSB0aGUgaW5jb21pbmcgcmVxdWVzdC5cbiAgICAgICAgICAgICAgLy8gVGhlIGJhc2Ugb2YgdGhlIFVSTCBpcyB1bnVzZWQgYnV0IHJlcXVpcmVkIHRvIHBhcnNlIHRoZSBVUkwuXG4gICAgICAgICAgICAgIGNvbnN0IHBhcnNlZFVybCA9IG5ldyBVUkwocmVxLnVybCwgJ2h0dHA6Ly9sb2NhbGhvc3QnKTtcbiAgICAgICAgICAgICAgbGV0IHBhdGhuYW1lID0gcGFyc2VkVXJsLnBhdGhuYW1lO1xuICAgICAgICAgICAgICBpZiAoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGggJiYgcGF0aG5hbWUuc3RhcnRzV2l0aChzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCkpIHtcbiAgICAgICAgICAgICAgICBwYXRobmFtZSA9IHBhdGhuYW1lLnNsaWNlKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgaWYgKHBhdGhuYW1lWzBdICE9PSAnLycpIHtcbiAgICAgICAgICAgICAgICAgIHBhdGhuYW1lID0gJy8nICsgcGF0aG5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChwYXRobmFtZSA9PT0gJy8nIHx8IHBhdGhuYW1lID09PSBgL2luZGV4Lmh0bWxgKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3SHRtbCA9IG91dHB1dEZpbGVzLmdldCgnL2luZGV4Lmh0bWwnKT8uY29udGVudHM7XG4gICAgICAgICAgICAgICAgaWYgKHJhd0h0bWwpIHtcbiAgICAgICAgICAgICAgICAgIHNlcnZlclxuICAgICAgICAgICAgICAgICAgICAudHJhbnNmb3JtSW5kZXhIdG1sKHJlcS51cmwsIEJ1ZmZlci5mcm9tKHJhd0h0bWwpLnRvU3RyaW5nKCd1dGYtOCcpKVxuICAgICAgICAgICAgICAgICAgICAudGhlbigocHJvY2Vzc2VkSHRtbCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICd0ZXh0L2h0bWwnKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDYWNoZS1Db250cm9sJywgJ25vLWNhY2hlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHNlcnZlck9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoc2VydmVyT3B0aW9ucy5oZWFkZXJzKS5mb3JFYWNoKChbbmFtZSwgdmFsdWVdKSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKG5hbWUsIHZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIHJlcy5lbmQocHJvY2Vzc2VkSHRtbCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IG5leHQoZXJyb3IpKTtcblxuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdLFxuICAgIG9wdGltaXplRGVwczoge1xuICAgICAgLy8gT25seSBlbmFibGUgd2l0aCBjYWNoaW5nIHNpbmNlIGl0IGNhdXNlcyBwcmVidW5kbGUgZGVwZW5kZW5jaWVzIHRvIGJlIGNhY2hlZFxuICAgICAgZGlzYWJsZWQ6ICFzZXJ2ZXJPcHRpb25zLmNhY2hlT3B0aW9ucy5lbmFibGVkLFxuICAgICAgLy8gRXhjbHVkZSBhbnkgcHJvdmlkZWQgZGVwZW5kZW5jaWVzIChjdXJyZW50bHkgYnVpbGQgZGVmaW5lZCBleHRlcm5hbHMpXG4gICAgICBleGNsdWRlOiBwcmVidW5kbGVFeGNsdWRlLFxuICAgICAgLy8gU2tpcCBhdXRvbWF0aWMgZmlsZS1iYXNlZCBlbnRyeSBwb2ludCBkaXNjb3ZlcnlcbiAgICAgIGVudHJpZXM6IFtdLFxuICAgICAgLy8gQWRkIGFuIGVzYnVpbGQgcGx1Z2luIHRvIHJ1biB0aGUgQW5ndWxhciBsaW5rZXIgb24gZGVwZW5kZW5jaWVzXG4gICAgICBlc2J1aWxkT3B0aW9uczoge1xuICAgICAgICBwbHVnaW5zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2FuZ3VsYXItdml0ZS1vcHRpbWl6ZS1kZXBzJyxcbiAgICAgICAgICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHRyYW5zZm9ybWVyID0gbmV3IEphdmFTY3JpcHRUcmFuc2Zvcm1lcihcbiAgICAgICAgICAgICAgICAvLyBBbHdheXMgZW5hYmxlIEpJVCBsaW5raW5nIHRvIHN1cHBvcnQgYXBwbGljYXRpb25zIGJ1aWx0IHdpdGggYW5kIHdpdGhvdXQgQU9ULlxuICAgICAgICAgICAgICAgIC8vIEluIGEgZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnQgdGhlIGFkZGl0aW9uYWwgc2NvcGUgaW5mb3JtYXRpb24gZG9lcyBub3RcbiAgICAgICAgICAgICAgICAvLyBoYXZlIGEgbmVnYXRpdmUgZWZmZWN0IHVubGlrZSBwcm9kdWN0aW9uIHdoZXJlIGZpbmFsIG91dHB1dCBzaXplIGlzIHJlbGV2YW50LlxuICAgICAgICAgICAgICAgIHsgc291cmNlbWFwOiAhIWJ1aWxkLmluaXRpYWxPcHRpb25zLnNvdXJjZW1hcCwgaml0OiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgMSxcbiAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5bY21dP2pzJC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgY29udGVudHM6IGF3YWl0IHRyYW5zZm9ybWVyLnRyYW5zZm9ybUZpbGUoYXJncy5wYXRoKSxcbiAgICAgICAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgYnVpbGQub25FbmQoKCkgPT4gdHJhbnNmb3JtZXIuY2xvc2UoKSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0sXG4gIH07XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMuc3NsKSB7XG4gICAgaWYgKHNlcnZlck9wdGlvbnMuc3NsQ2VydCAmJiBzZXJ2ZXJPcHRpb25zLnNzbEtleSkge1xuICAgICAgLy8gc2VydmVyIGNvbmZpZ3VyYXRpb24gaXMgZGVmaW5lZCBhYm92ZVxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgIGNvbmZpZ3VyYXRpb24uc2VydmVyIS5odHRwcyA9IHtcbiAgICAgICAgY2VydDogYXdhaXQgcmVhZEZpbGUoc2VydmVyT3B0aW9ucy5zc2xDZXJ0KSxcbiAgICAgICAga2V5OiBhd2FpdCByZWFkRmlsZShzZXJ2ZXJPcHRpb25zLnNzbEtleSksXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7IGRlZmF1bHQ6IGJhc2ljU3NsUGx1Z2luIH0gPSBhd2FpdCBpbXBvcnQoJ0B2aXRlanMvcGx1Z2luLWJhc2ljLXNzbCcpO1xuICAgICAgY29uZmlndXJhdGlvbi5wbHVnaW5zID8/PSBbXTtcbiAgICAgIGNvbmZpZ3VyYXRpb24ucGx1Z2lucy5wdXNoKGJhc2ljU3NsUGx1Z2luKCkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBjb25maWd1cmF0aW9uO1xufVxuIl19