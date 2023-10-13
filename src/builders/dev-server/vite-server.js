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
const bundler_context_1 = require("../../tools/esbuild/bundler-context");
const javascript_transformer_1 = require("../../tools/esbuild/javascript-transformer");
const utils_1 = require("../../tools/esbuild/utils");
const i18n_locale_plugin_1 = require("../../tools/vite/i18n-locale-plugin");
const render_page_1 = require("../../utils/server-rendering/render-page");
const supported_browsers_1 = require("../../utils/supported-browsers");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const application_1 = require("../application");
const browser_esbuild_1 = require("../browser-esbuild");
const load_proxy_config_1 = require("./load-proxy-config");
const SSG_MARKER_REGEXP = /ng-server-context=["']\w*\|?ssg\|?\w*["']/;
function hashContent(contents) {
    // TODO: Consider xxhash
    return (0, node_crypto_1.createHash)('sha256').update(contents).digest();
}
async function* serveWithVite(serverOptions, builderName, context, plugins) {
    // Get the browser configuration from the target name.
    const rawBrowserOptions = (await context.getTargetOptions(serverOptions.buildTarget));
    const browserOptions = (await context.validateOptions({
        ...rawBrowserOptions,
        watch: serverOptions.watch,
        poll: serverOptions.poll,
        verbose: serverOptions.verbose,
    }, builderName));
    if (browserOptions.prerender) {
        // Disable prerendering if enabled and force SSR.
        // This is so instead of prerendering all the routes for every change, the page is "prerendered" when it is requested.
        browserOptions.ssr = true;
        browserOptions.prerender = false;
    }
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
    const build = builderName === '@angular-devkit/build-angular:application'
        ? application_1.buildApplicationInternal
        : browser_esbuild_1.buildEsbuildBrowser;
    // TODO: Switch this to an architect schedule call when infrastructure settings are supported
    for await (const result of build(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    browserOptions, context, {
        write: false,
    }, plugins)) {
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
            const projectName = context.target?.project;
            if (!projectName) {
                throw new Error('The builder requires a target.');
            }
            const { root = '' } = await context.getProjectMetadata(projectName);
            const projectRoot = node_path_1.default.join(context.workspaceRoot, root);
            const browsers = (0, supported_browsers_1.getSupportedBrowsers)(projectRoot, context.logger);
            const target = (0, utils_1.transformSupportedBrowsersToTargets)(browsers);
            // Setup server and start listening
            const serverConfiguration = await setupServer(serverOptions, generatedFiles, assetFiles, browserOptions.preserveSymlinks, browserOptions.externalDependencies, !!browserOptions.ssr, prebundleTransformer, target);
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
                servable: file.type === bundler_context_1.BuildOutputFileType.Browser || file.type === bundler_context_1.BuildOutputFileType.Media,
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
            servable: file.type === bundler_context_1.BuildOutputFileType.Browser || file.type === bundler_context_1.BuildOutputFileType.Media,
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
async function setupServer(serverOptions, outputFiles, assets, preserveSymlinks, prebundleExclude, ssr, prebundleTransformer, target) {
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
                            if (outputFile?.servable) {
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
                // Set esbuild supported targets.
                target,
                supported: (0, utils_1.getFeatureSupport)(target),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3ZpdGUtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0gsbUNBQWtEO0FBQ2xELDhEQUFpQztBQUNqQyw2Q0FBcUQ7QUFDckQsK0NBQTRDO0FBRzVDLHVEQUF3QztBQUV4Qyx5RUFBMkY7QUFDM0YsdUZBQW1GO0FBQ25GLHFEQUFtRztBQUNuRyw0RUFBb0Y7QUFDcEYsMEVBQXFGO0FBQ3JGLHVFQUFzRTtBQUN0RSwrRUFBd0U7QUFDeEUsZ0RBQTBEO0FBQzFELHdEQUF5RDtBQUV6RCwyREFBNkQ7QUFZN0QsTUFBTSxpQkFBaUIsR0FBRywyQ0FBMkMsQ0FBQztBQUV0RSxTQUFTLFdBQVcsQ0FBQyxRQUFvQjtJQUN2Qyx3QkFBd0I7SUFDeEIsT0FBTyxJQUFBLHdCQUFVLEVBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQ3hELENBQUM7QUFFTSxLQUFLLFNBQVMsQ0FBQyxDQUFDLGFBQWEsQ0FDbEMsYUFBeUMsRUFDekMsV0FBbUIsRUFDbkIsT0FBdUIsRUFDdkIsT0FBa0I7SUFFbEIsc0RBQXNEO0lBQ3RELE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FDdkQsYUFBYSxDQUFDLFdBQVcsQ0FDMUIsQ0FBNEMsQ0FBQztJQUU5QyxNQUFNLGNBQWMsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FDbkQ7UUFDRSxHQUFHLGlCQUFpQjtRQUNwQixLQUFLLEVBQUUsYUFBYSxDQUFDLEtBQUs7UUFDMUIsSUFBSSxFQUFFLGFBQWEs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LE9BQU8sUUFBUSxDQUFDO0FBQ2xCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHR5cGUgeyBqc29uLCBsb2dnaW5nIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHR5cGUgeyBQbHVnaW4gfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IGxvb2t1cCBhcyBsb29rdXBNaW1lVHlwZSB9IGZyb20gJ21ybWltZSc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IEJpbmFyeUxpa2UsIGNyZWF0ZUhhc2ggfSBmcm9tICdub2RlOmNyeXB0byc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgU2VydmVyUmVzcG9uc2UgfSBmcm9tICdub2RlOmh0dHAnO1xuaW1wb3J0IHR5cGUgeyBBZGRyZXNzSW5mbyB9IGZyb20gJ25vZGU6bmV0JztcbmltcG9ydCBwYXRoLCB7IHBvc2l4IH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB0eXBlIHsgQ29ubmVjdCwgSW5saW5lQ29uZmlnLCBWaXRlRGV2U2VydmVyIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyBCdWlsZE91dHB1dEZpbGUsIEJ1aWxkT3V0cHV0RmlsZVR5cGUgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgeyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2phdmFzY3JpcHQtdHJhbnNmb3JtZXInO1xuaW1wb3J0IHsgZ2V0RmVhdHVyZVN1cHBvcnQsIHRyYW5zZm9ybVN1cHBvcnRlZEJyb3dzZXJzVG9UYXJnZXRzIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC91dGlscyc7XG5pbXBvcnQgeyBjcmVhdGVBbmd1bGFyTG9jYWxlRGF0YVBsdWdpbiB9IGZyb20gJy4uLy4uL3Rvb2xzL3ZpdGUvaTE4bi1sb2NhbGUtcGx1Z2luJztcbmltcG9ydCB7IFJlbmRlck9wdGlvbnMsIHJlbmRlclBhZ2UgfSBmcm9tICcuLi8uLi91dGlscy9zZXJ2ZXItcmVuZGVyaW5nL3JlbmRlci1wYWdlJztcbmltcG9ydCB7IGdldFN1cHBvcnRlZEJyb3dzZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3VwcG9ydGVkLWJyb3dzZXJzJztcbmltcG9ydCB7IGdldEluZGV4T3V0cHV0RmlsZSB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgYnVpbGRBcHBsaWNhdGlvbkludGVybmFsIH0gZnJvbSAnLi4vYXBwbGljYXRpb24nO1xuaW1wb3J0IHsgYnVpbGRFc2J1aWxkQnJvd3NlciB9IGZyb20gJy4uL2Jyb3dzZXItZXNidWlsZCc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi4vYnJvd3Nlci1lc2J1aWxkL3NjaGVtYSc7XG5pbXBvcnQgeyBsb2FkUHJveHlDb25maWd1cmF0aW9uIH0gZnJvbSAnLi9sb2FkLXByb3h5LWNvbmZpZyc7XG5pbXBvcnQgdHlwZSB7IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB0eXBlIHsgRGV2U2VydmVyQnVpbGRlck91dHB1dCB9IGZyb20gJy4vd2VicGFjay1zZXJ2ZXInO1xuXG5pbnRlcmZhY2UgT3V0cHV0RmlsZVJlY29yZCB7XG4gIGNvbnRlbnRzOiBVaW50OEFycmF5O1xuICBzaXplOiBudW1iZXI7XG4gIGhhc2g/OiBCdWZmZXI7XG4gIHVwZGF0ZWQ6IGJvb2xlYW47XG4gIHNlcnZhYmxlOiBib29sZWFuO1xufVxuXG5jb25zdCBTU0dfTUFSS0VSX1JFR0VYUCA9IC9uZy1zZXJ2ZXItY29udGV4dD1bXCInXVxcdypcXHw/c3NnXFx8P1xcdypbXCInXS87XG5cbmZ1bmN0aW9uIGhhc2hDb250ZW50KGNvbnRlbnRzOiBCaW5hcnlMaWtlKTogQnVmZmVyIHtcbiAgLy8gVE9ETzogQ29uc2lkZXIgeHhoYXNoXG4gIHJldHVybiBjcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoY29udGVudHMpLmRpZ2VzdCgpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24qIHNlcnZlV2l0aFZpdGUoXG4gIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zLFxuICBidWlsZGVyTmFtZTogc3RyaW5nLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgcGx1Z2lucz86IFBsdWdpbltdLFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPERldlNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gR2V0IHRoZSBicm93c2VyIGNvbmZpZ3VyYXRpb24gZnJvbSB0aGUgdGFyZ2V0IG5hbWUuXG4gIGNvbnN0IHJhd0Jyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhcbiAgICBzZXJ2ZXJPcHRpb25zLmJ1aWxkVGFyZ2V0LFxuICApKSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG5cbiAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC52YWxpZGF0ZU9wdGlvbnMoXG4gICAge1xuICAgICAgLi4ucmF3QnJvd3Nlck9wdGlvbnMsXG4gICAgICB3YXRjaDogc2VydmVyT3B0aW9ucy53YXRjaCxcbiAgICAgIHBvbGw6IHNlcnZlck9wdGlvbnMucG9sbCxcbiAgICAgIHZlcmJvc2U6IHNlcnZlck9wdGlvbnMudmVyYm9zZSxcbiAgICB9IGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgICBidWlsZGVyTmFtZSxcbiAgKSkgYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zO1xuXG4gIGlmIChicm93c2VyT3B0aW9ucy5wcmVyZW5kZXIpIHtcbiAgICAvLyBEaXNhYmxlIHByZXJlbmRlcmluZyBpZiBlbmFibGVkIGFuZCBmb3JjZSBTU1IuXG4gICAgLy8gVGhpcyBpcyBzbyBpbnN0ZWFkIG9mIHByZXJlbmRlcmluZyBhbGwgdGhlIHJvdXRlcyBmb3IgZXZlcnkgY2hhbmdlLCB0aGUgcGFnZSBpcyBcInByZXJlbmRlcmVkXCIgd2hlbiBpdCBpcyByZXF1ZXN0ZWQuXG4gICAgYnJvd3Nlck9wdGlvbnMuc3NyID0gdHJ1ZTtcbiAgICBicm93c2VyT3B0aW9ucy5wcmVyZW5kZXIgPSBmYWxzZTtcbiAgfVxuXG4gIC8vIFNldCBhbGwgcGFja2FnZXMgYXMgZXh0ZXJuYWwgdG8gc3VwcG9ydCBWaXRlJ3MgcHJlYnVuZGxlIGNhY2hpbmdcbiAgYnJvd3Nlck9wdGlvbnMuZXh0ZXJuYWxQYWNrYWdlcyA9IHNlcnZlck9wdGlvbnMuY2FjaGVPcHRpb25zLmVuYWJsZWQ7XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoID09PSB1bmRlZmluZWQgJiYgYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYgIT09IHVuZGVmaW5lZCkge1xuICAgIHNlcnZlck9wdGlvbnMuc2VydmVQYXRoID0gYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWY7XG4gIH1cblxuICAvLyBUaGUgZGV2ZWxvcG1lbnQgc2VydmVyIGN1cnJlbnRseSBvbmx5IHN1cHBvcnRzIGEgc2luZ2xlIGxvY2FsZSB3aGVuIGxvY2FsaXppbmcuXG4gIC8vIFRoaXMgbWF0Y2hlcyB0aGUgYmVoYXZpb3Igb2YgdGhlIFdlYnBhY2stYmFzZWQgZGV2ZWxvcG1lbnQgc2VydmVyIGJ1dCBjb3VsZCBiZSBleHBhbmRlZCBpbiB0aGUgZnV0dXJlLlxuICBpZiAoXG4gICAgYnJvd3Nlck9wdGlvbnMubG9jYWxpemUgPT09IHRydWUgfHxcbiAgICAoQXJyYXkuaXNBcnJheShicm93c2VyT3B0aW9ucy5sb2NhbGl6ZSkgJiYgYnJvd3Nlck9wdGlvbnMubG9jYWxpemUubGVuZ3RoID4gMSlcbiAgKSB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICdMb2NhbGl6YXRpb24gKGBsb2NhbGl6ZWAgb3B0aW9uKSBoYXMgYmVlbiBkaXNhYmxlZC4gVGhlIGRldmVsb3BtZW50IHNlcnZlciBvbmx5IHN1cHBvcnRzIGxvY2FsaXppbmcgYSBzaW5nbGUgbG9jYWxlIHBlciBidWlsZC4nLFxuICAgICk7XG4gICAgYnJvd3Nlck9wdGlvbnMubG9jYWxpemUgPSBmYWxzZTtcbiAgfSBlbHNlIGlmIChicm93c2VyT3B0aW9ucy5sb2NhbGl6ZSkge1xuICAgIC8vIFdoZW4gbG9jYWxpemF0aW9uIGlzIGVuYWJsZWQgd2l0aCBhIHNpbmdsZSBsb2NhbGUsIGZvcmNlIGEgZmxhdCBwYXRoIHRvIG1haW50YWluIGJlaGF2aW9yIHdpdGggdGhlIGV4aXN0aW5nIFdlYnBhY2stYmFzZWQgZGV2IHNlcnZlci5cbiAgICBicm93c2VyT3B0aW9ucy5mb3JjZUkxOG5GbGF0T3V0cHV0ID0gdHJ1ZTtcbiAgfVxuXG4gIC8vIFNldHVwIHRoZSBwcmVidW5kbGluZyB0cmFuc2Zvcm1lciB0aGF0IHdpbGwgYmUgc2hhcmVkIGFjcm9zcyBWaXRlIHByZWJ1bmRsaW5nIHJlcXVlc3RzXG4gIGNvbnN0IHByZWJ1bmRsZVRyYW5zZm9ybWVyID0gbmV3IEphdmFTY3JpcHRUcmFuc2Zvcm1lcihcbiAgICAvLyBBbHdheXMgZW5hYmxlIEpJVCBsaW5raW5nIHRvIHN1cHBvcnQgYXBwbGljYXRpb25zIGJ1aWx0IHdpdGggYW5kIHdpdGhvdXQgQU9ULlxuICAgIC8vIEluIGEgZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnQgdGhlIGFkZGl0aW9uYWwgc2NvcGUgaW5mb3JtYXRpb24gZG9lcyBub3RcbiAgICAvLyBoYXZlIGEgbmVnYXRpdmUgZWZmZWN0IHVubGlrZSBwcm9kdWN0aW9uIHdoZXJlIGZpbmFsIG91dHB1dCBzaXplIGlzIHJlbGV2YW50LlxuICAgIHsgc291cmNlbWFwOiB0cnVlLCBqaXQ6IHRydWUgfSxcbiAgICAxLFxuICApO1xuXG4gIC8vIEV4dHJhY3Qgb3V0cHV0IGluZGV4IGZyb20gb3B0aW9uc1xuICAvLyBUT0RPOiBQcm92aWRlIHRoaXMgaW5mbyBmcm9tIHRoZSBidWlsZCByZXN1bHRzXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IGh0bWxJbmRleFBhdGggPSBnZXRJbmRleE91dHB1dEZpbGUoYnJvd3Nlck9wdGlvbnMuaW5kZXggYXMgYW55KTtcblxuICAvLyBkeW5hbWljYWxseSBpbXBvcnQgVml0ZSBmb3IgRVNNIGNvbXBhdGliaWxpdHlcbiAgY29uc3QgeyBjcmVhdGVTZXJ2ZXIsIG5vcm1hbGl6ZVBhdGggfSA9IGF3YWl0IGltcG9ydCgndml0ZScpO1xuXG4gIGxldCBzZXJ2ZXI6IFZpdGVEZXZTZXJ2ZXIgfCB1bmRlZmluZWQ7XG4gIGxldCBsaXN0ZW5pbmdBZGRyZXNzOiBBZGRyZXNzSW5mbyB8IHVuZGVmaW5lZDtcbiAgY29uc3QgZ2VuZXJhdGVkRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4oKTtcbiAgY29uc3QgYXNzZXRGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIGNvbnN0IGJ1aWxkID1cbiAgICBidWlsZGVyTmFtZSA9PT0gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOmFwcGxpY2F0aW9uJ1xuICAgICAgPyBidWlsZEFwcGxpY2F0aW9uSW50ZXJuYWxcbiAgICAgIDogYnVpbGRFc2J1aWxkQnJvd3NlcjtcblxuICAvLyBUT0RPOiBTd2l0Y2ggdGhpcyB0byBhbiBhcmNoaXRlY3Qgc2NoZWR1bGUgY2FsbCB3aGVuIGluZnJhc3RydWN0dXJlIHNldHRpbmdzIGFyZSBzdXBwb3J0ZWRcbiAgZm9yIGF3YWl0IChjb25zdCByZXN1bHQgb2YgYnVpbGQoXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBicm93c2VyT3B0aW9ucyBhcyBhbnksXG4gICAgY29udGV4dCxcbiAgICB7XG4gICAgICB3cml0ZTogZmFsc2UsXG4gICAgfSxcbiAgICBwbHVnaW5zLFxuICApKSB7XG4gICAgYXNzZXJ0KHJlc3VsdC5vdXRwdXRGaWxlcywgJ0J1aWxkZXIgZGlkIG5vdCBwcm92aWRlIHJlc3VsdCBmaWxlcy4nKTtcblxuICAgIC8vIEFuYWx5emUgcmVzdWx0IGZpbGVzIGZvciBjaGFuZ2VzXG4gICAgYW5hbHl6ZVJlc3VsdEZpbGVzKG5vcm1hbGl6ZVBhdGgsIGh0bWxJbmRleFBhdGgsIHJlc3VsdC5vdXRwdXRGaWxlcywgZ2VuZXJhdGVkRmlsZXMpO1xuXG4gICAgYXNzZXRGaWxlcy5jbGVhcigpO1xuICAgIGlmIChyZXN1bHQuYXNzZXRGaWxlcykge1xuICAgICAgZm9yIChjb25zdCBhc3NldCBvZiByZXN1bHQuYXNzZXRGaWxlcykge1xuICAgICAgICBhc3NldEZpbGVzLnNldCgnLycgKyBub3JtYWxpemVQYXRoKGFzc2V0LmRlc3RpbmF0aW9uKSwgYXNzZXQuc291cmNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc2VydmVyKSB7XG4gICAgICBoYW5kbGVVcGRhdGUoZ2VuZXJhdGVkRmlsZXMsIHNlcnZlciwgc2VydmVyT3B0aW9ucywgY29udGV4dC5sb2dnZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0Py5wcm9qZWN0O1xuICAgICAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0LicpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB7IHJvb3QgPSAnJyB9ID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICAgICAgY29uc3QgcHJvamVjdFJvb3QgPSBwYXRoLmpvaW4oY29udGV4dC53b3Jrc3BhY2VSb290LCByb290IGFzIHN0cmluZyk7XG4gICAgICBjb25zdCBicm93c2VycyA9IGdldFN1cHBvcnRlZEJyb3dzZXJzKHByb2plY3RSb290LCBjb250ZXh0LmxvZ2dlcik7XG4gICAgICBjb25zdCB0YXJnZXQgPSB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyhicm93c2Vycyk7XG5cbiAgICAgIC8vIFNldHVwIHNlcnZlciBhbmQgc3RhcnQgbGlzdGVuaW5nXG4gICAgICBjb25zdCBzZXJ2ZXJDb25maWd1cmF0aW9uID0gYXdhaXQgc2V0dXBTZXJ2ZXIoXG4gICAgICAgIHNlcnZlck9wdGlvbnMsXG4gICAgICAgIGdlbmVyYXRlZEZpbGVzLFxuICAgICAgICBhc3NldEZpbGVzLFxuICAgICAgICBicm93c2VyT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgICBicm93c2VyT3B0aW9ucy5leHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICAgICAgISFicm93c2VyT3B0aW9ucy5zc3IsXG4gICAgICAgIHByZWJ1bmRsZVRyYW5zZm9ybWVyLFxuICAgICAgICB0YXJnZXQsXG4gICAgICApO1xuXG4gICAgICBzZXJ2ZXIgPSBhd2FpdCBjcmVhdGVTZXJ2ZXIoc2VydmVyQ29uZmlndXJhdGlvbik7XG5cbiAgICAgIGF3YWl0IHNlcnZlci5saXN0ZW4oKTtcbiAgICAgIGxpc3RlbmluZ0FkZHJlc3MgPSBzZXJ2ZXIuaHR0cFNlcnZlcj8uYWRkcmVzcygpIGFzIEFkZHJlc3NJbmZvO1xuXG4gICAgICAvLyBsb2cgY29ubmVjdGlvbiBpbmZvcm1hdGlvblxuICAgICAgc2VydmVyLnByaW50VXJscygpO1xuICAgIH1cblxuICAgIC8vIFRPRE86IGFkanVzdCBvdXRwdXQgdHlwaW5ncyB0byByZWZsZWN0IGJvdGggZGV2ZWxvcG1lbnQgc2VydmVyc1xuICAgIHlpZWxkIHsgc3VjY2VzczogdHJ1ZSwgcG9ydDogbGlzdGVuaW5nQWRkcmVzcz8ucG9ydCB9IGFzIHVua25vd24gYXMgRGV2U2VydmVyQnVpbGRlck91dHB1dDtcbiAgfVxuXG4gIC8vIEFkZCBjbGVhbnVwIGxvZ2ljIHZpYSBhIGJ1aWxkZXIgdGVhcmRvd25cbiAgbGV0IGRlZmVycmVkOiAoKSA9PiB2b2lkO1xuICBjb250ZXh0LmFkZFRlYXJkb3duKGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBzZXJ2ZXI/LmNsb3NlKCk7XG4gICAgYXdhaXQgcHJlYnVuZGxlVHJhbnNmb3JtZXIuY2xvc2UoKTtcbiAgICBkZWZlcnJlZD8uKCk7XG4gIH0pO1xuICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4gKGRlZmVycmVkID0gcmVzb2x2ZSkpO1xufVxuXG5mdW5jdGlvbiBoYW5kbGVVcGRhdGUoXG4gIGdlbmVyYXRlZEZpbGVzOiBNYXA8c3RyaW5nLCBPdXRwdXRGaWxlUmVjb3JkPixcbiAgc2VydmVyOiBWaXRlRGV2U2VydmVyLFxuICBzZXJ2ZXJPcHRpb25zOiBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyxcbiAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSxcbik6IHZvaWQge1xuICBjb25zdCB1cGRhdGVkRmlsZXM6IHN0cmluZ1tdID0gW107XG5cbiAgLy8gSW52YWxpZGF0ZSBhbnkgdXBkYXRlZCBmaWxlc1xuICBmb3IgKGNvbnN0IFtmaWxlLCByZWNvcmRdIG9mIGdlbmVyYXRlZEZpbGVzKSB7XG4gICAgaWYgKHJlY29yZC51cGRhdGVkKSB7XG4gICAgICB1cGRhdGVkRmlsZXMucHVzaChmaWxlKTtcbiAgICAgIGNvbnN0IHVwZGF0ZWRNb2R1bGVzID0gc2VydmVyLm1vZHVsZUdyYXBoLmdldE1vZHVsZXNCeUZpbGUoZmlsZSk7XG4gICAgICB1cGRhdGVkTW9kdWxlcz8uZm9yRWFjaCgobSkgPT4gc2VydmVyPy5tb2R1bGVHcmFwaC5pbnZhbGlkYXRlTW9kdWxlKG0pKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIXVwZGF0ZWRGaWxlcy5sZW5ndGgpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoc2VydmVyT3B0aW9ucy5saXZlUmVsb2FkIHx8IHNlcnZlck9wdGlvbnMuaG1yKSB7XG4gICAgaWYgKHVwZGF0ZWRGaWxlcy5ldmVyeSgoZikgPT4gZi5lbmRzV2l0aCgnLmNzcycpKSkge1xuICAgICAgY29uc3QgdGltZXN0YW1wID0gRGF0ZS5ub3coKTtcbiAgICAgIHNlcnZlci53cy5zZW5kKHtcbiAgICAgICAgdHlwZTogJ3VwZGF0ZScsXG4gICAgICAgIHVwZGF0ZXM6IHVwZGF0ZWRGaWxlcy5tYXAoKGYpID0+IHtcbiAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGYuc2xpY2UoMSk7IC8vIFJlbW92ZSBsZWFkaW5nIHNsYXNoLlxuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6ICdjc3MtdXBkYXRlJyxcbiAgICAgICAgICAgIHRpbWVzdGFtcCxcbiAgICAgICAgICAgIHBhdGg6IGZpbGVQYXRoLFxuICAgICAgICAgICAgYWNjZXB0ZWRQYXRoOiBmaWxlUGF0aCxcbiAgICAgICAgICB9O1xuICAgICAgICB9KSxcbiAgICAgIH0pO1xuXG4gICAgICBsb2dnZXIuaW5mbygnSE1SIHVwZGF0ZSBzZW50IHRvIGNsaWVudChzKS4uLicpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG5cbiAgLy8gU2VuZCByZWxvYWQgY29tbWFuZCB0byBjbGllbnRzXG4gIGlmIChzZXJ2ZXJPcHRpb25zLmxpdmVSZWxvYWQpIHtcbiAgICBsb2dnZXIuaW5mbygnUmVsb2FkaW5nIGNsaWVudChzKS4uLicpO1xuXG4gICAgc2VydmVyLndzLnNlbmQoe1xuICAgICAgdHlwZTogJ2Z1bGwtcmVsb2FkJyxcbiAgICAgIHBhdGg6ICcqJyxcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhbmFseXplUmVzdWx0RmlsZXMoXG4gIG5vcm1hbGl6ZVBhdGg6IChpZDogc3RyaW5nKSA9PiBzdHJpbmcsXG4gIGh0bWxJbmRleFBhdGg6IHN0cmluZyxcbiAgcmVzdWx0RmlsZXM6IEJ1aWxkT3V0cHV0RmlsZVtdLFxuICBnZW5lcmF0ZWRGaWxlczogTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4sXG4pIHtcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPihbJy9pbmRleC5odG1sJ10pO1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgcmVzdWx0RmlsZXMpIHtcbiAgICBsZXQgZmlsZVBhdGg7XG4gICAgaWYgKGZpbGUucGF0aCA9PT0gaHRtbEluZGV4UGF0aCkge1xuICAgICAgLy8gQ29udmVydCBjdXN0b20gaW5kZXggb3V0cHV0IHBhdGggdG8gc3RhbmRhcmQgaW5kZXggcGF0aCBmb3IgZGV2LXNlcnZlciB1c2FnZS5cbiAgICAgIC8vIFRoaXMgbWltaWNzIHRoZSBXZWJwYWNrIGRldi1zZXJ2ZXIgYmVoYXZpb3IuXG4gICAgICBmaWxlUGF0aCA9ICcvaW5kZXguaHRtbCc7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZpbGVQYXRoID0gJy8nICsgbm9ybWFsaXplUGF0aChmaWxlLnBhdGgpO1xuICAgIH1cbiAgICBzZWVuLmFkZChmaWxlUGF0aCk7XG5cbiAgICAvLyBTa2lwIGFuYWx5c2lzIG9mIHNvdXJjZW1hcHNcbiAgICBpZiAoZmlsZVBhdGguZW5kc1dpdGgoJy5tYXAnKSkge1xuICAgICAgZ2VuZXJhdGVkRmlsZXMuc2V0KGZpbGVQYXRoLCB7XG4gICAgICAgIGNvbnRlbnRzOiBmaWxlLmNvbnRlbnRzLFxuICAgICAgICBzZXJ2YWJsZTpcbiAgICAgICAgICBmaWxlLnR5cGUgPT09IEJ1aWxkT3V0cHV0RmlsZVR5cGUuQnJvd3NlciB8fCBmaWxlLnR5cGUgPT09IEJ1aWxkT3V0cHV0RmlsZVR5cGUuTWVkaWEsXG4gICAgICAgIHNpemU6IGZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCxcbiAgICAgICAgdXBkYXRlZDogZmFsc2UsXG4gICAgICB9KTtcblxuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgbGV0IGZpbGVIYXNoOiBCdWZmZXIgfCB1bmRlZmluZWQ7XG4gICAgY29uc3QgZXhpc3RpbmdSZWNvcmQgPSBnZW5lcmF0ZWRGaWxlcy5nZXQoZmlsZVBhdGgpO1xuICAgIGlmIChleGlzdGluZ1JlY29yZCAmJiBleGlzdGluZ1JlY29yZC5zaXplID09PSBmaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgpIHtcbiAgICAgIC8vIE9ubHkgaGFzaCBleGlzdGluZyBmaWxlIHdoZW4gbmVlZGVkXG4gICAgICBpZiAoZXhpc3RpbmdSZWNvcmQuaGFzaCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGV4aXN0aW5nUmVjb3JkLmhhc2ggPSBoYXNoQ29udGVudChleGlzdGluZ1JlY29yZC5jb250ZW50cyk7XG4gICAgICB9XG5cbiAgICAgIC8vIENvbXBhcmUgYWdhaW5zdCBsYXRlc3QgcmVzdWx0IG91dHB1dFxuICAgICAgZmlsZUhhc2ggPSBoYXNoQ29udGVudChmaWxlLmNvbnRlbnRzKTtcbiAgICAgIGlmIChmaWxlSGFzaC5lcXVhbHMoZXhpc3RpbmdSZWNvcmQuaGFzaCkpIHtcbiAgICAgICAgLy8gU2FtZSBmaWxlXG4gICAgICAgIGV4aXN0aW5nUmVjb3JkLnVwZGF0ZWQgPSBmYWxzZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVkRmlsZXMuc2V0KGZpbGVQYXRoLCB7XG4gICAgICBjb250ZW50czogZmlsZS5jb250ZW50cyxcbiAgICAgIHNpemU6IGZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCxcbiAgICAgIGhhc2g6IGZpbGVIYXNoLFxuICAgICAgdXBkYXRlZDogdHJ1ZSxcbiAgICAgIHNlcnZhYmxlOlxuICAgICAgICBmaWxlLnR5cGUgPT09IEJ1aWxkT3V0cHV0RmlsZVR5cGUuQnJvd3NlciB8fCBmaWxlLnR5cGUgPT09IEJ1aWxkT3V0cHV0RmlsZVR5cGUuTWVkaWEsXG4gICAgfSk7XG4gIH1cblxuICAvLyBDbGVhciBzdGFsZSBvdXRwdXQgZmlsZXNcbiAgZm9yIChjb25zdCBmaWxlIG9mIGdlbmVyYXRlZEZpbGVzLmtleXMoKSkge1xuICAgIGlmICghc2Vlbi5oYXMoZmlsZSkpIHtcbiAgICAgIGdlbmVyYXRlZEZpbGVzLmRlbGV0ZShmaWxlKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXR1cFNlcnZlcihcbiAgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMsXG4gIG91dHB1dEZpbGVzOiBNYXA8c3RyaW5nLCBPdXRwdXRGaWxlUmVjb3JkPixcbiAgYXNzZXRzOiBNYXA8c3RyaW5nLCBzdHJpbmc+LFxuICBwcmVzZXJ2ZVN5bWxpbmtzOiBib29sZWFuIHwgdW5kZWZpbmVkLFxuICBwcmVidW5kbGVFeGNsdWRlOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCxcbiAgc3NyOiBib29sZWFuLFxuICBwcmVidW5kbGVUcmFuc2Zvcm1lcjogSmF2YVNjcmlwdFRyYW5zZm9ybWVyLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuKTogUHJvbWlzZTxJbmxpbmVDb25maWc+IHtcbiAgY29uc3QgcHJveHkgPSBhd2FpdCBsb2FkUHJveHlDb25maWd1cmF0aW9uKFxuICAgIHNlcnZlck9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICBzZXJ2ZXJPcHRpb25zLnByb3h5Q29uZmlnLFxuICAgIHRydWUsXG4gICk7XG5cbiAgLy8gZHluYW1pY2FsbHkgaW1wb3J0IFZpdGUgZm9yIEVTTSBjb21wYXRpYmlsaXR5XG4gIGNvbnN0IHsgbm9ybWFsaXplUGF0aCB9ID0gYXdhaXQgaW1wb3J0KCd2aXRlJyk7XG5cbiAgY29uc3QgY29uZmlndXJhdGlvbjogSW5saW5lQ29uZmlnID0ge1xuICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIGVudkZpbGU6IGZhbHNlLFxuICAgIGNhY2hlRGlyOiBwYXRoLmpvaW4oc2VydmVyT3B0aW9ucy5jYWNoZU9wdGlvbnMucGF0aCwgJ3ZpdGUnKSxcbiAgICByb290OiBzZXJ2ZXJPcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgcHVibGljRGlyOiBmYWxzZSxcbiAgICBlc2J1aWxkOiBmYWxzZSxcbiAgICBtb2RlOiAnZGV2ZWxvcG1lbnQnLFxuICAgIGFwcFR5cGU6ICdzcGEnLFxuICAgIGNzczoge1xuICAgICAgZGV2U291cmNlbWFwOiB0cnVlLFxuICAgIH0sXG4gICAgYmFzZTogc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgsXG4gICAgcmVzb2x2ZToge1xuICAgICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICB9LFxuICAgIHNlcnZlcjoge1xuICAgICAgcG9ydDogc2VydmVyT3B0aW9ucy5wb3J0LFxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICAgIGhvc3Q6IHNlcnZlck9wdGlvbnMuaG9zdCxcbiAgICAgIG9wZW46IHNlcnZlck9wdGlvbnMub3BlbixcbiAgICAgIGhlYWRlcnM6IHNlcnZlck9wdGlvbnMuaGVhZGVycyxcbiAgICAgIHByb3h5LFxuICAgICAgLy8gQ3VycmVudGx5IGRvZXMgbm90IGFwcGVhciB0byBiZSBhIHdheSB0byBkaXNhYmxlIGZpbGUgd2F0Y2hpbmcgZGlyZWN0bHkgc28gaWdub3JlIGFsbCBmaWxlc1xuICAgICAgd2F0Y2g6IHtcbiAgICAgICAgaWdub3JlZDogWycqKi8qJ10sXG4gICAgICB9LFxuICAgIH0sXG4gICAgc3NyOiB7XG4gICAgICAvLyBFeGNsdWRlIGFueSBwcm92aWRlZCBkZXBlbmRlbmNpZXMgKGN1cnJlbnRseSBidWlsZCBkZWZpbmVkIGV4dGVybmFscylcbiAgICAgIGV4dGVybmFsOiBwcmVidW5kbGVFeGNsdWRlLFxuICAgIH0sXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlQW5ndWxhckxvY2FsZURhdGFQbHVnaW4oKSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ3ZpdGU6YW5ndWxhci1tZW1vcnknLFxuICAgICAgICAvLyBFbnN1cmVzIHBsdWdpbiBob29rcyBydW4gYmVmb3JlIGJ1aWx0LWluIFZpdGUgaG9va3NcbiAgICAgICAgZW5mb3JjZTogJ3ByZScsXG4gICAgICAgIGFzeW5jIHJlc29sdmVJZChzb3VyY2UsIGltcG9ydGVyKSB7XG4gICAgICAgICAgaWYgKGltcG9ydGVyICYmIHNvdXJjZS5zdGFydHNXaXRoKCcuJykpIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBxdWVyeSBpZiBwcmVzZW50XG4gICAgICAgICAgICBjb25zdCBbaW1wb3J0ZXJGaWxlXSA9IGltcG9ydGVyLnNwbGl0KCc/JywgMSk7XG5cbiAgICAgICAgICAgIHNvdXJjZSA9IG5vcm1hbGl6ZVBhdGgocGF0aC5qb2luKHBhdGguZGlybmFtZShpbXBvcnRlckZpbGUpLCBzb3VyY2UpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBbZmlsZV0gPSBzb3VyY2Uuc3BsaXQoJz8nLCAxKTtcbiAgICAgICAgICBpZiAob3V0cHV0RmlsZXMuaGFzKGZpbGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gc291cmNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgbG9hZChpZCkge1xuICAgICAgICAgIGNvbnN0IFtmaWxlXSA9IGlkLnNwbGl0KCc/JywgMSk7XG4gICAgICAgICAgY29uc3QgY29kZUNvbnRlbnRzID0gb3V0cHV0RmlsZXMuZ2V0KGZpbGUpPy5jb250ZW50cztcbiAgICAgICAgICBpZiAoY29kZUNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBjb2RlID0gQnVmZmVyLmZyb20oY29kZUNvbnRlbnRzKS50b1N0cmluZygndXRmLTgnKTtcbiAgICAgICAgICBjb25zdCBtYXBDb250ZW50cyA9IG91dHB1dEZpbGVzLmdldChmaWxlICsgJy5tYXAnKT8uY29udGVudHM7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIHNvdXJjZSBtYXAgVVJMIGNvbW1lbnRzIGZyb20gdGhlIGNvZGUgaWYgYSBzb3VyY2VtYXAgaXMgcHJlc2VudC5cbiAgICAgICAgICAgIC8vIFZpdGUgd2lsbCBpbmxpbmUgYW5kIGFkZCBhbiBhZGRpdGlvbmFsIHNvdXJjZW1hcCBVUkwgZm9yIHRoZSBzb3VyY2VtYXAuXG4gICAgICAgICAgICBjb2RlOiBtYXBDb250ZW50cyA/IGNvZGUucmVwbGFjZSgvXlxcL1xcLyMgc291cmNlTWFwcGluZ1VSTD1bXlxcclxcbl0qL2dtLCAnJykgOiBjb2RlLFxuICAgICAgICAgICAgbWFwOiBtYXBDb250ZW50cyAmJiBCdWZmZXIuZnJvbShtYXBDb250ZW50cykudG9TdHJpbmcoJ3V0Zi04JyksXG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgICAgIC8vIEFzc2V0cyBhbmQgcmVzb3VyY2VzIGdldCBoYW5kbGVkIGZpcnN0XG4gICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShmdW5jdGlvbiBhbmd1bGFyQXNzZXRzTWlkZGxld2FyZShyZXEsIHJlcywgbmV4dCkge1xuICAgICAgICAgICAgaWYgKHJlcS51cmwgPT09IHVuZGVmaW5lZCB8fCByZXMud3JpdGFibGVFbmRlZCkge1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFBhcnNlIHRoZSBpbmNvbWluZyByZXF1ZXN0LlxuICAgICAgICAgICAgLy8gVGhlIGJhc2Ugb2YgdGhlIFVSTCBpcyB1bnVzZWQgYnV0IHJlcXVpcmVkIHRvIHBhcnNlIHRoZSBVUkwuXG4gICAgICAgICAgICBjb25zdCBwYXRobmFtZSA9IHBhdGhuYW1lV2l0aG91dFNlcnZlUGF0aChyZXEudXJsLCBzZXJ2ZXJPcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IHBhdGguZXh0bmFtZShwYXRobmFtZSk7XG5cbiAgICAgICAgICAgIC8vIFJld3JpdGUgYWxsIGJ1aWxkIGFzc2V0cyB0byBhIHZpdGUgcmF3IGZzIFVSTFxuICAgICAgICAgICAgY29uc3QgYXNzZXRTb3VyY2VQYXRoID0gYXNzZXRzLmdldChwYXRobmFtZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXRTb3VyY2VQYXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgLy8gVGhlIGVuY29kaW5nIG5lZWRzIHRvIG1hdGNoIHdoYXQgaGFwcGVucyBpbiB0aGUgdml0ZSBzdGF0aWMgbWlkZGxld2FyZS5cbiAgICAgICAgICAgICAgLy8gcmVmOiBodHRwczovL2dpdGh1Yi5jb20vdml0ZWpzL3ZpdGUvYmxvYi9kNGYxM2JkODE0Njg5NjFjOGM5MjY0MzhlODE1YWI2YjFjODI3MzVlL3BhY2thZ2VzL3ZpdGUvc3JjL25vZGUvc2VydmVyL21pZGRsZXdhcmVzL3N0YXRpYy50cyNMMTYzXG4gICAgICAgICAgICAgIHJlcS51cmwgPSBgL0Bmcy8ke2VuY29kZVVSSShhc3NldFNvdXJjZVBhdGgpfWA7XG4gICAgICAgICAgICAgIG5leHQoKTtcblxuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJlc291cmNlIGZpbGVzIGFyZSBoYW5kbGVkIGRpcmVjdGx5LlxuICAgICAgICAgICAgLy8gR2xvYmFsIHN0eWxlc2hlZXRzIChDU1MgZmlsZXMpIGFyZSBjdXJyZW50bHkgY29uc2lkZXJlZCByZXNvdXJjZXMgdG8gd29ya2Fyb3VuZFxuICAgICAgICAgICAgLy8gZGV2IHNlcnZlciBzb3VyY2VtYXAgaXNzdWVzIHdpdGggc3R5bGVzaGVldHMuXG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9uICE9PSAnLmpzJyAmJiBleHRlbnNpb24gIT09ICcuaHRtbCcpIHtcbiAgICAgICAgICAgICAgY29uc3Qgb3V0cHV0RmlsZSA9IG91dHB1dEZpbGVzLmdldChwYXRobmFtZSk7XG4gICAgICAgICAgICAgIGlmIChvdXRwdXRGaWxlPy5zZXJ2YWJsZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pbWVUeXBlID0gbG9va3VwTWltZVR5cGUoZXh0ZW5zaW9uKTtcbiAgICAgICAgICAgICAgICBpZiAobWltZVR5cGUpIHtcbiAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsIG1pbWVUeXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ2FjaGUtQ29udHJvbCcsICduby1jYWNoZScpO1xuICAgICAgICAgICAgICAgIGlmIChzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpIHtcbiAgICAgICAgICAgICAgICAgIE9iamVjdC5lbnRyaWVzKHNlcnZlck9wdGlvbnMuaGVhZGVycykuZm9yRWFjaCgoW25hbWUsIHZhbHVlXSkgPT5cbiAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihuYW1lLCB2YWx1ZSksXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMuZW5kKG91dHB1dEZpbGUuY29udGVudHMpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIFJldHVybmluZyBhIGZ1bmN0aW9uLCBpbnN0YWxscyBtaWRkbGV3YXJlIGFmdGVyIHRoZSBtYWluIHRyYW5zZm9ybSBtaWRkbGV3YXJlIGJ1dFxuICAgICAgICAgIC8vIGJlZm9yZSB0aGUgYnVpbHQtaW4gSFRNTCBtaWRkbGV3YXJlXG4gICAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICAgIGZ1bmN0aW9uIGFuZ3VsYXJTU1JNaWRkbGV3YXJlKFxuICAgICAgICAgICAgICByZXE6IENvbm5lY3QuSW5jb21pbmdNZXNzYWdlLFxuICAgICAgICAgICAgICByZXM6IFNlcnZlclJlc3BvbnNlLFxuICAgICAgICAgICAgICBuZXh0OiBDb25uZWN0Lk5leHRGdW5jdGlvbixcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICBjb25zdCB1cmwgPSByZXEub3JpZ2luYWxVcmw7XG4gICAgICAgICAgICAgIGlmICghdXJsIHx8IHVybC5lbmRzV2l0aCgnLmh0bWwnKSkge1xuICAgICAgICAgICAgICAgIG5leHQoKTtcblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IHBvdGVudGlhbFByZXJlbmRlcmVkID0gb3V0cHV0RmlsZXMuZ2V0KHBvc2l4LmpvaW4odXJsLCAnaW5kZXguaHRtbCcpKT8uY29udGVudHM7XG4gICAgICAgICAgICAgIGlmIChwb3RlbnRpYWxQcmVyZW5kZXJlZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBCdWZmZXIuZnJvbShwb3RlbnRpYWxQcmVyZW5kZXJlZCkudG9TdHJpbmcoJ3V0Zi04Jyk7XG4gICAgICAgICAgICAgICAgaWYgKFNTR19NQVJLRVJfUkVHRVhQLnRlc3QoY29udGVudCkpIHtcbiAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybUluZGV4SHRtbEFuZEFkZEhlYWRlcnModXJsLCBwb3RlbnRpYWxQcmVyZW5kZXJlZCwgcmVzLCBuZXh0KTtcblxuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IHJhd0h0bWwgPSBvdXRwdXRGaWxlcy5nZXQoJy9pbmRleC5zZXJ2ZXIuaHRtbCcpPy5jb250ZW50cztcbiAgICAgICAgICAgICAgaWYgKCFyYXdIdG1sKSB7XG4gICAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgdHJhbnNmb3JtSW5kZXhIdG1sQW5kQWRkSGVhZGVycyh1cmwsIHJhd0h0bWwsIHJlcywgbmV4dCwgYXN5bmMgKGh0bWwpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IHJlbmRlclBhZ2Uoe1xuICAgICAgICAgICAgICAgICAgZG9jdW1lbnQ6IGh0bWwsXG4gICAgICAgICAgICAgICAgICByb3V0ZTogcGF0aG5hbWVXaXRob3V0U2VydmVQYXRoKHVybCwgc2VydmVyT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgICBzZXJ2ZXJDb250ZXh0OiAnc3NyJyxcbiAgICAgICAgICAgICAgICAgIGxvYWRCdW5kbGU6IChwYXRoOiBzdHJpbmcpID0+XG4gICAgICAgICAgICAgICAgICAgIHNlcnZlci5zc3JMb2FkTW9kdWxlKHBhdGguc2xpY2UoMSkpIGFzIFJldHVyblR5cGU8XG4gICAgICAgICAgICAgICAgICAgICAgTm9uTnVsbGFibGU8UmVuZGVyT3B0aW9uc1snbG9hZEJ1bmRsZSddPlxuICAgICAgICAgICAgICAgICAgICA+LFxuICAgICAgICAgICAgICAgICAgLy8gRmlsZXMgaGVyZSBhcmUgb25seSBuZWVkZWQgZm9yIGNyaXRpY2FsIENTUyBpbmxpbmluZy5cbiAgICAgICAgICAgICAgICAgIG91dHB1dEZpbGVzOiB7fSxcbiAgICAgICAgICAgICAgICAgIC8vIFRPRE86IGFkZCBzdXBwb3J0IGZvciBjcml0aWNhbCBjc3MgaW5saW5pbmcuXG4gICAgICAgICAgICAgICAgICBpbmxpbmVDcml0aWNhbENzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gY29udGVudDtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzc3IpIHtcbiAgICAgICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShhbmd1bGFyU1NSTWlkZGxld2FyZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoZnVuY3Rpb24gYW5ndWxhckluZGV4TWlkZGxld2FyZShyZXEsIHJlcywgbmV4dCkge1xuICAgICAgICAgICAgICBpZiAoIXJlcS51cmwpIHtcbiAgICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBQYXJzZSB0aGUgaW5jb21pbmcgcmVxdWVzdC5cbiAgICAgICAgICAgICAgLy8gVGhlIGJhc2Ugb2YgdGhlIFVSTCBpcyB1bnVzZWQgYnV0IHJlcXVpcmVkIHRvIHBhcnNlIHRoZSBVUkwuXG4gICAgICAgICAgICAgIGNvbnN0IHBhdGhuYW1lID0gcGF0aG5hbWVXaXRob3V0U2VydmVQYXRoKHJlcS51cmwsIHNlcnZlck9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgIGlmIChwYXRobmFtZSA9PT0gJy8nIHx8IHBhdGhuYW1lID09PSBgL2luZGV4Lmh0bWxgKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3SHRtbCA9IG91dHB1dEZpbGVzLmdldCgnL2luZGV4Lmh0bWwnKT8uY29udGVudHM7XG4gICAgICAgICAgICAgICAgaWYgKHJhd0h0bWwpIHtcbiAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybUluZGV4SHRtbEFuZEFkZEhlYWRlcnMocmVxLnVybCwgcmF3SHRtbCwgcmVzLCBuZXh0KTtcblxuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICBmdW5jdGlvbiB0cmFuc2Zvcm1JbmRleEh0bWxBbmRBZGRIZWFkZXJzKFxuICAgICAgICAgICAgdXJsOiBzdHJpbmcsXG4gICAgICAgICAgICByYXdIdG1sOiBVaW50OEFycmF5LFxuICAgICAgICAgICAgcmVzOiBTZXJ2ZXJSZXNwb25zZTxpbXBvcnQoJ2h0dHAnKS5JbmNvbWluZ01lc3NhZ2U+LFxuICAgICAgICAgICAgbmV4dDogQ29ubmVjdC5OZXh0RnVuY3Rpb24sXG4gICAgICAgICAgICBhZGRpdGlvbmFsVHJhbnNmb3JtZXI/OiAoaHRtbDogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4sXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBzZXJ2ZXJcbiAgICAgICAgICAgICAgLnRyYW5zZm9ybUluZGV4SHRtbCh1cmwsIEJ1ZmZlci5mcm9tKHJhd0h0bWwpLnRvU3RyaW5nKCd1dGYtOCcpKVxuICAgICAgICAgICAgICAudGhlbihhc3luYyAocHJvY2Vzc2VkSHRtbCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChhZGRpdGlvbmFsVHJhbnNmb3JtZXIpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBhZGRpdGlvbmFsVHJhbnNmb3JtZXIocHJvY2Vzc2VkSHRtbCk7XG4gICAgICAgICAgICAgICAgICBpZiAoIWNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgcHJvY2Vzc2VkSHRtbCA9IGNvbnRlbnQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ3RleHQvaHRtbCcpO1xuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NhY2hlLUNvbnRyb2wnLCAnbm8tY2FjaGUnKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VydmVyT3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyhzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpLmZvckVhY2goKFtuYW1lLCB2YWx1ZV0pID0+XG4gICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIobmFtZSwgdmFsdWUpLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzLmVuZChwcm9jZXNzZWRIdG1sKTtcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcikgPT4gbmV4dChlcnJvcikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgXSxcbiAgICBvcHRpbWl6ZURlcHM6IHtcbiAgICAgIC8vIE9ubHkgZW5hYmxlIHdpdGggY2FjaGluZyBzaW5jZSBpdCBjYXVzZXMgcHJlYnVuZGxlIGRlcGVuZGVuY2llcyB0byBiZSBjYWNoZWRcbiAgICAgIGRpc2FibGVkOiAhc2VydmVyT3B0aW9ucy5jYWNoZU9wdGlvbnMuZW5hYmxlZCxcbiAgICAgIC8vIEV4Y2x1ZGUgYW55IHByb3ZpZGVkIGRlcGVuZGVuY2llcyAoY3VycmVudGx5IGJ1aWxkIGRlZmluZWQgZXh0ZXJuYWxzKVxuICAgICAgZXhjbHVkZTogcHJlYnVuZGxlRXhjbHVkZSxcbiAgICAgIC8vIFNraXAgYXV0b21hdGljIGZpbGUtYmFzZWQgZW50cnkgcG9pbnQgZGlzY292ZXJ5XG4gICAgICBlbnRyaWVzOiBbXSxcbiAgICAgIC8vIEFkZCBhbiBlc2J1aWxkIHBsdWdpbiB0byBydW4gdGhlIEFuZ3VsYXIgbGlua2VyIG9uIGRlcGVuZGVuY2llc1xuICAgICAgZXNidWlsZE9wdGlvbnM6IHtcbiAgICAgICAgLy8gU2V0IGVzYnVpbGQgc3VwcG9ydGVkIHRhcmdldHMuXG4gICAgICAgIHRhcmdldCxcbiAgICAgICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgICAgICBwbHVnaW5zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2FuZ3VsYXItdml0ZS1vcHRpbWl6ZS1kZXBzJyxcbiAgICAgICAgICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICAgICAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLltjbV0/anMkLyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICBjb250ZW50czogYXdhaXQgcHJlYnVuZGxlVHJhbnNmb3JtZXIudHJhbnNmb3JtRmlsZShhcmdzLnBhdGgpLFxuICAgICAgICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9LFxuICB9O1xuXG4gIGlmIChzZXJ2ZXJPcHRpb25zLnNzbCkge1xuICAgIGlmIChzZXJ2ZXJPcHRpb25zLnNzbENlcnQgJiYgc2VydmVyT3B0aW9ucy5zc2xLZXkpIHtcbiAgICAgIC8vIHNlcnZlciBjb25maWd1cmF0aW9uIGlzIGRlZmluZWQgYWJvdmVcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gICAgICBjb25maWd1cmF0aW9uLnNlcnZlciEuaHR0cHMgPSB7XG4gICAgICAgIGNlcnQ6IGF3YWl0IHJlYWRGaWxlKHNlcnZlck9wdGlvbnMuc3NsQ2VydCksXG4gICAgICAgIGtleTogYXdhaXQgcmVhZEZpbGUoc2VydmVyT3B0aW9ucy5zc2xLZXkpLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgeyBkZWZhdWx0OiBiYXNpY1NzbFBsdWdpbiB9ID0gYXdhaXQgaW1wb3J0KCdAdml0ZWpzL3BsdWdpbi1iYXNpYy1zc2wnKTtcbiAgICAgIGNvbmZpZ3VyYXRpb24ucGx1Z2lucyA/Pz0gW107XG4gICAgICBjb25maWd1cmF0aW9uLnBsdWdpbnMucHVzaChiYXNpY1NzbFBsdWdpbigpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gY29uZmlndXJhdGlvbjtcbn1cblxuZnVuY3Rpb24gcGF0aG5hbWVXaXRob3V0U2VydmVQYXRoKHVybDogc3RyaW5nLCBzZXJ2ZXJPcHRpb25zOiBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyk6IHN0cmluZyB7XG4gIGNvbnN0IHBhcnNlZFVybCA9IG5ldyBVUkwodXJsLCAnaHR0cDovL2xvY2FsaG9zdCcpO1xuICBsZXQgcGF0aG5hbWUgPSBkZWNvZGVVUklDb21wb25lbnQocGFyc2VkVXJsLnBhdGhuYW1lKTtcbiAgaWYgKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoICYmIHBhdGhuYW1lLnN0YXJ0c1dpdGgoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGgpKSB7XG4gICAgcGF0aG5hbWUgPSBwYXRobmFtZS5zbGljZShzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aC5sZW5ndGgpO1xuICAgIGlmIChwYXRobmFtZVswXSAhPT0gJy8nKSB7XG4gICAgICBwYXRobmFtZSA9ICcvJyArIHBhdGhuYW1lO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYXRobmFtZTtcbn1cbiJdfQ==