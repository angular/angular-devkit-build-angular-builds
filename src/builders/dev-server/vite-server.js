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
    let hadError = false;
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
        // If build failed, nothing to serve
        if (!result.success) {
            // If server is active, send an error notification
            if (result.errors?.length && server) {
                hadError = true;
                server.ws.send({
                    type: 'error',
                    err: {
                        message: result.errors[0].text,
                        stack: '',
                        loc: result.errors[0].location,
                    },
                });
            }
            continue;
        }
        else if (hadError && server) {
            // Send an empty update to clear the error overlay
            server.ws.send({
                'type': 'update',
                updates: [],
            });
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS1zZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9kZXYtc2VydmVyL3ZpdGUtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0gsbUNBQWtEO0FBQ2xELDhEQUFpQztBQUNqQyw2Q0FBcUQ7QUFDckQsK0NBQTRDO0FBRzVDLHVEQUF3QztBQUV4Qyx5RUFBMkY7QUFDM0YsdUZBQW1GO0FBQ25GLHFEQUFtRztBQUNuRyw0RUFBb0Y7QUFDcEYsMEVBQXFGO0FBQ3JGLHVFQUFzRTtBQUN0RSwrRUFBd0U7QUFDeEUsZ0RBQTBEO0FBQzFELHdEQUF5RDtBQUV6RCwyREFBNkQ7QUFZN0QsTUFBTSxpQkFBaUIsR0FBRywyQ0FBMkMsQ0FBQztBQUV0RSxTQUFTLFdBQVcsQ0FBQyxRQUFvQjtJQUN2Qyx3QkFBd0I7SUFDeEIsT0FBTyxJQUFBLHdCQUFVLEVBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQ3hELENBQUM7QUFFTSxLQUFLLFNBQVMsQ0FBQyxDQUFDLGFBQWEsQ0FDbEMsYUFBeUMsRUFDekMsV0FBbUIsRUFDbkIsT0FBdUIsRUFDdkIsT0FBa0I7SUFFbEIsc0RBQXNEO0lBQ3RELE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FDdkQsYUFBYSxDQUFDLFdBQVcsQ0FDMUIsQ0FBNEMsQ0FBQztJQUU5QyxNQUFNLGNBQWMsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FDbkQ7UUFDRSxHQUFHLGlCQUFpQjtRQUNwQixLQUFLLEVBQUUsYUFBYSxDQUFDLEtBQUs7UUFDMUIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJO1FBQ3hCLE9BQU8sRUFBRSxhQUFhLENBQUMsT0FBTztLQUNZLEVBQzVDLFdBQVcsQ0FDWixDQUE0QyxDQUFDO0lBRTlDLElBQUksY0FBYyxDQUFDLFNBQVMsRUFBRTtRQUM1QixpREFBaUQ7UUFDakQsc0hBQXNIO1FBQ3RILGNBQWMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDO1FBQzFCLGNBQWMsQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO0tBQ2xDO0lBRUQsbUVBQW1FO0lBQ25FLGNBQWMsQ0FBQyxnQkFBZ0IsR0FBRyxhQUFhLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQztJQUVyRSxJQUFJLGFBQWEsQ0FBQyxTQUFTLEtBQUssU0FBUyxJQUFJLGNBQWMsQ0FBQyxRQUFRLEtBQUssU0FBUyxFQUFFO1FBQ2xGLGFBQWEsQ0FBQyxTQUFTLEdBQUcsY0FBYyxDQUFDLFFBQVEsQ0FBQztLQUNuRDtJQUVELGtGQUFrRjtJQUNsRix5R0FBeUc7SUFDekcsSUFDRSxjQUFjLENBQUMsUUFBUSxLQUFLLElBQUk7UUFDaEMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsSUFBSSxjQUFjLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsRUFDOUU7UUFDQSxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDakIsZ0lBQWdJLENBQ2pJLENBQUM7UUFDRixjQUFjLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQztLQUNqQztTQUFNLElBQUksY0FBYyxDQUFDLFFBQVEsRUFBRTtRQUNsQyx3SUFBd0k7UUFDeEksY0FBYyxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQztLQUMzQztJQUVELHlGQUF5RjtJQUN6RixNQUFNLG9CQUFvQixHQUFHLElBQUksOENBQXFCO0lBQ3BELGdGQUFnRjtJQUNoRix5RUFBeUU7SUFDekUsZ0ZBQWdGO0lBQ2hGLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQzlCLENBQUMsQ0FDRixDQUFDO0lBRUYsb0NBQW9DO0lBQ3BDLGlEQUFpRDtJQUNqRCw4REFBOEQ7SUFDOUQsTUFBTSxhQUFhLEdBQUcsSUFBQSwyQ0FBa0IsRUFBQyxjQUFjLENBQUMsS0FBWSxDQUFDLENBQUM7SUFFdEUsZ0RBQWdEO0lBQ2hELE1BQU0sRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLEdBQUcsd0RBQWEsTUFBTSxHQUFDLENBQUM7SUFFN0QsSUFBSSxNQUFpQyxDQUFDO0lBQ3RDLElBQUksZ0JBQXlDLENBQUM7SUFDOUMsSUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFDO0lBQ3JCLE1BQU0sY0FBYyxHQUFHLElBQUksR0FBRyxFQUE0QixDQUFDO0lBQzNELE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO0lBQzdDLE1BQU0sS0FBSyxHQUNULFdBQVcsS0FBSywyQ0FBMkM7UUFDekQsQ0FBQyxDQUFDLHNDQUF3QjtRQUMxQixDQUFDLENBQUMscUNBQW1CLENBQUM7SUFFMUIsNkZBQTZGO0lBQzdGLElBQUksS0FBSyxFQUFFLE1BQU0sTUFBTSxJQUFJLEtBQUs7SUFDOUIsOERBQThEO0lBQzlELGNBQXFCLEVBQ3JCLE9BQU8sRUFDUDtRQUNFLEtBQUssRUFBRSxLQUFLO0tBQ2IsRUFDRCxPQUFPLENBQ1IsRUFBRTtRQUNELElBQUEscUJBQU0sRUFBQyxNQUFNLENBQUMsV0FBVyxFQUFFLHVDQUF1QyxDQUFDLENBQUM7UUFFcEUsb0NBQW9DO1FBQ3BDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFO1lBQ25CLGtEQUFrRDtZQUNsRCxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUUsTUFBTSxJQUFJLE1BQU0sRUFBRTtnQkFDbkMsUUFBUSxHQUFHLElBQUksQ0FBQztnQkFDaEIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUM7b0JBQ2IsSUFBSSxFQUFFLE9BQU87b0JBQ2IsR0FBRyxFQUFFO3dCQUNILE9BQU8sRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUk7d0JBQzlCLEtBQUssRUFBRSxFQUFFO3dCQUNULEdBQUcsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVE7cUJBQy9CO2lCQUNGLENBQUMsQ0FBQzthQUNKO1lBQ0QsU0FBUztTQUNWO2FBQU0sSUFBSSxRQUFRLElBQUksTUFBTSxFQUFFO1lBQzdCLGtEQUFrRDtZQUNsRCxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQztnQkFDYixNQUFNLEVBQUUsUUFBUTtnQkFDaEIsT0FBTyxFQUFFLEVBQUU7YUFDWixDQUFDLENBQUM7U0FDSjtRQUVELG1DQUFtQztRQUNuQyxrQkFBa0IsQ0FBQyxhQUFhLEVBQUUsYUFBYSxFQUFFLE1BQU0sQ0FBQyxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFFckYsVUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ25CLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRTtZQUNyQixLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUU7Z0JBQ3JDLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLGFBQWEsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ3RFO1NBQ0Y7UUFFRCxJQUFJLE1BQU0sRUFBRTtZQUNWLFlBQVksQ0FBQyxjQUFjLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDckU7YUFBTTtZQUNMLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDO1lBQzVDLElBQUksQ0FBQyxXQUFXLEVBQUU7Z0JBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0NBQWdDLENBQUMsQ0FBQzthQUNuRDtZQUVELE1BQU0sRUFBRSxJQUFJLEdBQUcsRUFBRSxFQUFFLEdBQUcsTUFBTSxPQUFPLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDcEUsTUFBTSxXQUFXLEdBQUcsbUJBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxJQUFjLENBQUMsQ0FBQztZQUNyRSxNQUFNLFFBQVEsR0FBRyxJQUFBLHlDQUFvQixFQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDbkUsTUFBTSxNQUFNLEdBQUcsSUFBQSwyQ0FBbUMsRUFBQyxRQUFRLENBQUMsQ0FBQztZQUU3RCxtQ0FBbUM7WUFDbkMsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLFdBQVcsQ0FDM0MsYUFBYSxFQUNiLGNBQWMsRUFDZCxVQUFVLEVBQ1YsY0FBYyxDQUFDLGdCQUFnQixFQUMvQixjQUFjLENBQUMsb0JBQW9CLEVBQ25DLENBQUMsQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUNwQixvQkFBb0IsRUFDcEIsTUFBTSxDQUNQLENBQUM7WUFFRixNQUFNLEdBQUcsTUFBTSxZQUFZLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUVqRCxNQUFNLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN0QixnQkFBZ0IsR0FBRyxNQUFNLENBQUMsVUFBVSxFQUFFLE9BQU8sRUFBaUIsQ0FBQztZQUUvRCw2QkFBNkI7WUFDN0IsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO1NBQ3BCO1FBRUQsa0VBQWtFO1FBQ2xFLE1BQU0sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQXVDLENBQUM7S0FDNUY7SUFFRCwyQ0FBMkM7SUFDM0MsSUFBSSxRQUFvQixDQUFDO0lBQ3pCLE9BQU8sQ0FBQyxXQUFXLENBQUMsS0FBSyxJQUFJLEVBQUU7UUFDN0IsTUFBTSxNQUFNLEVBQUUsS0FBSyxFQUFFLENBQUM7UUFDdEIsTUFBTSxvQkFBb0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNuQyxRQUFRLEVBQUUsRUFBRSxDQUFDO0lBQ2YsQ0FBQyxDQUFDLENBQUM7SUFDSCxNQUFNLElBQUksT0FBTyxDQUFPLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQzdELENBQUM7QUF4S0Qsc0NBd0tDO0FBRUQsU0FBUyxZQUFZLENBQ25CLGNBQTZDLEVBQzdDLE1BQXFCLEVBQ3JCLGFBQXlDLEVBQ3pDLE1BQXlCO0lBRXpCLE1BQU0sWUFBWSxHQUFhLEVBQUUsQ0FBQztJQUVsQywrQkFBK0I7SUFDL0IsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLGNBQWMsRUFBRTtRQUMzQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUU7WUFDbEIsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN4QixNQUFNLGNBQWMsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2pFLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUN6RTtLQUNGO0lBRUQsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUU7UUFDeEIsT0FBTztLQUNSO0lBRUQsSUFBSSxhQUFhLENBQUMsVUFBVSxJQUFJLGFBQWEsQ0FBQyxHQUFHLEVBQUU7UUFDakQsSUFBSSxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUU7WUFDakQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQzdCLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDO2dCQUNiLElBQUksRUFBRSxRQUFRO2dCQUNkLE9BQU8sRUFBRSxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7b0JBQzlCLE1BQU0sUUFBUSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyx3QkFBd0I7b0JBRXJELE9BQU87d0JBQ0wsSUFBSSxFQUFFLFlBQVk7d0JBQ2xCLFNBQVM7d0JBQ1QsSUFBSSxFQUFFLFFBQVE7d0JBQ2QsWUFBWSxFQUFFLFFBQVE7cUJBQ3ZCLENBQUM7Z0JBQ0osQ0FBQyxDQUFDO2FBQ0gsQ0FBQyxDQUFDO1lBRUgsTUFBTSxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1lBRS9DLE9BQU87U0FDUjtLQUNGO0lBRUQsaUNBQWlDO0lBQ2pDLElBQUksYUFBYSxDQUFDLFVBQVUsRUFBRTtRQUM1QixNQUFNLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFFdEMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUM7WUFDYixJQUFJLEVBQUUsYUFBYTtZQUNuQixJQUFJLEVBQUUsR0FBRztTQUNWLENBQUMsQ0FBQztLQUNKO0FBQ0gsQ0FBQztBQUVELFNBQVMsa0JBQWtCLENBQ3pCLGFBQXFDLEVBQ3JDLGFBQXFCLEVBQ3JCLFdBQThCLEVBQzlCLGNBQTZDO0lBRTdDLE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxDQUFTLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztJQUM5QyxLQUFLLE1BQU0sSUFBSSxJQUFJLFdBQVcsRUFBRTtRQUM5QixJQUFJLFFBQVEsQ0FBQztRQUNiLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxhQUFhLEVBQUU7WUFDL0IsZ0ZBQWdGO1lBQ2hGLCtDQUErQztZQUMvQyxRQUFRLEdBQUcsYUFBYSxDQUFDO1NBQzFCO2FBQU07WUFDTCxRQUFRLEdBQUcsR0FBRyxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDM0M7UUFDRCxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRW5CLDhCQUE4QjtRQUM5QixJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDN0IsY0FBYyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUU7Z0JBQzNCLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtnQkFDdkIsUUFBUSxFQUNOLElBQUksQ0FBQyxJQUFJLEtBQUsscUNBQW1CLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUsscUNBQW1CLENBQUMsS0FBSztnQkFDdEYsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVTtnQkFDOUIsT0FBTyxFQUFFLEtBQUs7YUFDZixDQUFDLENBQUM7WUFFSCxTQUFTO1NBQ1Y7UUFFRCxJQUFJLFFBQTRCLENBQUM7UUFDakMsTUFBTSxjQUFjLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNwRCxJQUFJLGNBQWMsSUFBSSxjQUFjLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFO1lBQ3RFLHNDQUFzQztZQUN0QyxJQUFJLGNBQWMsQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFO2dCQUNyQyxjQUFjLENBQUMsSUFBSSxHQUFHLFdBQVcsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDNUQ7WUFFRCx1Q0FBdUM7WUFDdkMsUUFBUSxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDdEMsSUFBSSxRQUFRLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDeEMsWUFBWTtnQkFDWixjQUFjLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQztnQkFDL0IsU0FBUzthQUNWO1NBQ0Y7UUFFRCxjQUFjLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRTtZQUMzQixRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVE7WUFDdkIsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVTtZQUM5QixJQUFJLEVBQUUsUUFBUTtZQUNkLE9BQU8sRUFBRSxJQUFJO1lBQ2IsUUFBUSxFQUNOLElBQUksQ0FBQyxJQUFJLEtBQUsscUNBQW1CLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUsscUNBQW1CLENBQUMsS0FBSztTQUN2RixDQUFDLENBQUM7S0FDSjtJQUVELDJCQUEyQjtJQUMzQixLQUFLLE1BQU0sSUFBSSxJQUFJLGNBQWMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtRQUN4QyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNuQixjQUFjLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzdCO0tBQ0Y7QUFDSCxDQUFDO0FBRUQsa0RBQWtEO0FBQzNDLEtBQUssVUFBVSxXQUFXLENBQy9CLGFBQXlDLEVBQ3pDLFdBQTBDLEVBQzFDLE1BQTJCLEVBQzNCLGdCQUFxQyxFQUNyQyxnQkFBc0MsRUFDdEMsR0FBWSxFQUNaLG9CQUEyQyxFQUMzQyxNQUFnQjtJQUVoQixNQUFNLEtBQUssR0FBRyxNQUFNLElBQUEsMENBQXNCLEVBQ3hDLGFBQWEsQ0FBQyxhQUFhLEVBQzNCLGFBQWEsQ0FBQyxXQUFXLEVBQ3pCLElBQUksQ0FDTCxDQUFDO0lBRUYsZ0RBQWdEO0lBQ2hELE1BQU0sRUFBRSxhQUFhLEVBQUUsR0FBRyx3REFBYSxNQUFNLEdBQUMsQ0FBQztJQUUvQyxNQUFNLGFBQWEsR0FBaUI7UUFDbEMsVUFBVSxFQUFFLEtBQUs7UUFDakIsT0FBTyxFQUFFLEtBQUs7UUFDZCxRQUFRLEVBQUUsbUJBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDO1FBQzVELElBQUksRUFBRSxhQUFhLENBQUMsYUFBYTtRQUNqQyxTQUFTLEVBQUUsS0FBSztRQUNoQixPQUFPLEVBQUUsS0FBSztRQUNkLElBQUksRUFBRSxhQUFhO1FBQ25CLE9BQU8sRUFBRSxLQUFLO1FBQ2QsR0FBRyxFQUFFO1lBQ0gsWUFBWSxFQUFFLElBQUk7U0FDbkI7UUFDRCxJQUFJLEVBQUUsYUFBYSxDQUFDLFNBQVM7UUFDN0IsT0FBTyxFQUFFO1lBQ1AsVUFBVSxFQUFFLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDO1lBQ25ELGdCQUFnQjtTQUNqQjtRQUNELE1BQU0sRUFBRTtZQUNOLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSTtZQUN4QixVQUFVLEVBQUUsSUFBSTtZQUNoQixJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUk7WUFDeEIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJO1lBQ3hCLE9BQU8sRUFBRSxhQUFhLENBQUMsT0FBTztZQUM5QixLQUFLO1lBQ0wsOEZBQThGO1lBQzlGLEtBQUssRUFBRTtnQkFDTCxPQUFPLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDbEI7U0FDRjtRQUNELEdBQUcsRUFBRTtZQUNILHdFQUF3RTtZQUN4RSxRQUFRLEVBQUUsZ0JBQWdCO1NBQzNCO1FBQ0QsT0FBTyxFQUFFO1lBQ1AsSUFBQSxrREFBNkIsR0FBRTtZQUMvQjtnQkFDRSxJQUFJLEVBQUUscUJBQXFCO2dCQUMzQixzREFBc0Q7Z0JBQ3RELE9BQU8sRUFBRSxLQUFLO2dCQUNkLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLFFBQVE7b0JBQzlCLElBQUksUUFBUSxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUU7d0JBQ3RDLDBCQUEwQjt3QkFDMUIsTUFBTSxDQUFDLFlBQVksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUU5QyxNQUFNLEdBQUcsYUFBYSxDQUFDLG1CQUFJLENBQUMsSUFBSSxDQUFDLG1CQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7cUJBQ3ZFO29CQUVELE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDcEMsSUFBSSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO3dCQUN6QixPQUFPLE1BQU0sQ0FBQztxQkFDZjtnQkFDSCxDQUFDO2dCQUNELElBQUksQ0FBQyxFQUFFO29CQUNMLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDaEMsTUFBTSxZQUFZLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxRQUFRLENBQUM7b0JBQ3JELElBQUksWUFBWSxLQUFLLFNBQVMsRUFBRTt3QkFDOUIsT0FBTztxQkFDUjtvQkFFRCxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztvQkFDekQsTUFBTSxXQUFXLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLEVBQUUsUUFBUSxDQUFDO29CQUU3RCxPQUFPO3dCQUNMLDBFQUEwRTt3QkFDMUUsMEVBQTBFO3dCQUMxRSxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLG9DQUFvQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJO3dCQUNqRixHQUFHLEVBQUUsV0FBVyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQztxQkFDL0QsQ0FBQztnQkFDSixDQUFDO2dCQUNELGVBQWUsQ0FBQyxNQUFNO29CQUNwQix5Q0FBeUM7b0JBQ3pDLE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLFNBQVMsdUJBQXVCLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxJQUFJO3dCQUNwRSxJQUFJLEdBQUcsQ0FBQyxHQUFHLEtBQUssU0FBUyxJQUFJLEdBQUcsQ0FBQyxhQUFhLEVBQUU7NEJBQzlDLE9BQU87eUJBQ1I7d0JBRUQsOEJBQThCO3dCQUM5QiwrREFBK0Q7d0JBQy9ELE1BQU0sUUFBUSxHQUFHLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsYUFBYSxDQUFDLENBQUM7d0JBQ2xFLE1BQU0sU0FBUyxHQUFHLG1CQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO3dCQUV6QyxnREFBZ0Q7d0JBQ2hELE1BQU0sZUFBZSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7d0JBQzdDLElBQUksZUFBZSxLQUFLLFNBQVMsRUFBRTs0QkFDakMsMEVBQTBFOzRCQUMxRSw2SUFBNkk7NEJBQzdJLEdBQUcsQ0FBQyxHQUFHLEdBQUcsUUFBUSxTQUFTLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQzs0QkFDL0MsSUFBSSxFQUFFLENBQUM7NEJBRVAsT0FBTzt5QkFDUjt3QkFFRCx1Q0FBdUM7d0JBQ3ZDLGtGQUFrRjt3QkFDbEYsZ0RBQWdEO3dCQUNoRCxJQUFJLFNBQVMsS0FBSyxLQUFLLElBQUksU0FBUyxLQUFLLE9BQU8sRUFBRTs0QkFDaEQsTUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQzs0QkFDN0MsSUFBSSxVQUFVLEVBQUUsUUFBUSxFQUFFO2dDQUN4QixNQUFNLFFBQVEsR0FBRyxJQUFBLGVBQWMsRUFBQyxTQUFTLENBQUMsQ0FBQztnQ0FDM0MsSUFBSSxRQUFRLEVBQUU7b0NBQ1osR0FBRyxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsUUFBUSxDQUFDLENBQUM7aUNBQ3pDO2dDQUNELEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxFQUFFLFVBQVUsQ0FBQyxDQUFDO2dDQUMzQyxJQUFJLGFBQWEsQ0FBQyxPQUFPLEVBQUU7b0NBQ3pCLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FDOUQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQzNCLENBQUM7aUNBQ0g7Z0NBQ0QsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7Z0NBRTdCLE9BQU87NkJBQ1I7eUJBQ0Y7d0JBRUQsSUFBSSxFQUFFLENBQUM7b0JBQ1QsQ0FBQyxDQUFDLENBQUM7b0JBRUgsb0ZBQW9GO29CQUNwRixzQ0FBc0M7b0JBQ3RDLE9BQU8sR0FBRyxFQUFFO3dCQUNWLFNBQVMsb0JBQW9CLENBQzNCLEdBQTRCLEVBQzVCLEdBQW1CLEVBQ25CLElBQTBCOzRCQUUxQixNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsV0FBVyxDQUFDOzRCQUM1QixJQUFJLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUU7Z0NBQ2pDLElBQUksRUFBRSxDQUFDO2dDQUVQLE9BQU87NkJBQ1I7NEJBRUQsTUFBTSxvQkFBb0IsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLGlCQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxZQUFZLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQzs0QkFDdEYsSUFBSSxvQkFBb0IsRUFBRTtnQ0FDeEIsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztnQ0FDcEUsSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7b0NBQ25DLCtCQUErQixDQUFDLEdBQUcsRUFBRSxvQkFBb0IsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7b0NBRXRFLE9BQU87aUNBQ1I7NkJBQ0Y7NEJBRUQsTUFBTSxPQUFPLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLFFBQVEsQ0FBQzs0QkFDaEUsSUFBSSxDQUFDLE9BQU8sRUFBRTtnQ0FDWixJQUFJLEVBQUUsQ0FBQztnQ0FFUCxPQUFPOzZCQUNSOzRCQUVELCtCQUErQixDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7Z0NBQ3RFLE1BQU0sRUFBRSxPQUFPLEVBQUUsR0FBRyxNQUFNLElBQUEsd0JBQVUsRUFBQztvQ0FDbkMsUUFBUSxFQUFFLElBQUk7b0NBQ2QsS0FBSyxFQUFFLHdCQUF3QixDQUFDLEdBQUcsRUFBRSxhQUFhLENBQUM7b0NBQ25ELGFBQWEsRUFBRSxLQUFLO29DQUNwQixVQUFVLEVBQUUsQ0FBQyxJQUFZLEVBQUUsRUFBRSxDQUMzQixNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBRWpDO29DQUNILHdEQUF3RDtvQ0FDeEQsV0FBVyxFQUFFLEVBQUU7b0NBQ2YsK0NBQStDO29DQUMvQyxpQkFBaUIsRUFBRSxLQUFLO2lDQUN6QixDQUFDLENBQUM7Z0NBRUgsT0FBTyxPQUFPLENBQUM7NEJBQ2pCLENBQUMsQ0FBQyxDQUFDO3dCQUNMLENBQUM7d0JBRUQsSUFBSSxHQUFHLEVBQUU7NEJBQ1AsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQzt5QkFDOUM7d0JBRUQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsU0FBUyxzQkFBc0IsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUk7NEJBQ25FLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFO2dDQUNaLElBQUksRUFBRSxDQUFDO2dDQUVQLE9BQU87NkJBQ1I7NEJBRUQsOEJBQThCOzRCQUM5QiwrREFBK0Q7NEJBQy9ELE1BQU0sUUFBUSxHQUFHLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsYUFBYSxDQUFDLENBQUM7NEJBRWxFLElBQUksUUFBUSxLQUFLLEdBQUcsSUFBSSxRQUFRLEtBQUssYUFBYSxFQUFFO2dDQUNsRCxNQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLFFBQVEsQ0FBQztnQ0FDekQsSUFBSSxPQUFPLEVBQUU7b0NBQ1gsK0JBQStCLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO29DQUU3RCxPQUFPO2lDQUNSOzZCQUNGOzRCQUVELElBQUksRUFBRSxDQUFDO3dCQUNULENBQUMsQ0FBQyxDQUFDO29CQUNMLENBQUMsQ0FBQztvQkFFRixTQUFTLCtCQUErQixDQUN0QyxHQUFXLEVBQ1gsT0FBbUIsRUFDbkIsR0FBbUQsRUFDbkQsSUFBMEIsRUFDMUIscUJBQXFFO3dCQUVyRSxNQUFNOzZCQUNILGtCQUFrQixDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQzs2QkFDL0QsSUFBSSxDQUFDLEtBQUssRUFBRSxhQUFhLEVBQUUsRUFBRTs0QkFDNUIsSUFBSSxxQkFBcUIsRUFBRTtnQ0FDekIsTUFBTSxPQUFPLEdBQUcsTUFBTSxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsQ0FBQztnQ0FDM0QsSUFBSSxDQUFDLE9BQU8sRUFBRTtvQ0FDWixJQUFJLEVBQUUsQ0FBQztvQ0FFUCxPQUFPO2lDQUNSO2dDQUVELGFBQWEsR0FBRyxPQUFPLENBQUM7NkJBQ3pCOzRCQUVELEdBQUcsQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLFdBQVcsQ0FBQyxDQUFDOzRCQUMzQyxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsRUFBRSxVQUFVLENBQUMsQ0FBQzs0QkFDM0MsSUFBSSxhQUFhLENBQUMsT0FBTyxFQUFFO2dDQUN6QixNQUFNLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLENBQzlELEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUMzQixDQUFDOzZCQUNIOzRCQUNELEdBQUcsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7d0JBQ3pCLENBQUMsQ0FBQzs2QkFDRCxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO29CQUNuQyxDQUFDO2dCQUNILENBQUM7YUFDRjtTQUNGO1FBQ0QsWUFBWSxFQUFFO1lBQ1osK0VBQStFO1lBQy9FLFFBQVEsRUFBRSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsT0FBTztZQUM3Qyx3RUFBd0U7WUFDeEUsT0FBTyxFQUFFLGdCQUFnQjtZQUN6QixrREFBa0Q7WUFDbEQsT0FBTyxFQUFFLEVBQUU7WUFDWCxrRUFBa0U7WUFDbEUsY0FBYyxFQUFFO2dCQUNkLGlDQUFpQztnQkFDakMsTUFBTTtnQkFDTixTQUFTLEVBQUUsSUFBQSx5QkFBaUIsRUFBQyxNQUFNLENBQUM7Z0JBQ3BDLE9BQU8sRUFBRTtvQkFDUDt3QkFDRSxJQUFJLEVBQUUsNEJBQTRCO3dCQUNsQyxLQUFLLENBQUMsS0FBSzs0QkFDVCxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtnQ0FDcEQsT0FBTztvQ0FDTCxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztvQ0FDN0QsTUFBTSxFQUFFLElBQUk7aUNBQ2IsQ0FBQzs0QkFDSixDQUFDLENBQUMsQ0FBQzt3QkFDTCxDQUFDO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRjtLQUNGLENBQUM7SUFFRixJQUFJLGFBQWEsQ0FBQyxHQUFHLEVBQUU7UUFDckIsSUFBSSxhQUFhLENBQUMsT0FBTyxJQUFJLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDakQsd0NBQXdDO1lBQ3hDLG9FQUFvRTtZQUNwRSxhQUFhLENBQUMsTUFBTyxDQUFDLEtBQUssR0FBRztnQkFDNUIsSUFBSSxFQUFFLE1BQU0sSUFBQSxtQkFBUSxFQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUM7Z0JBQzNDLEdBQUcsRUFBRSxNQUFNLElBQUEsbUJBQVEsRUFBQyxhQUFhLENBQUMsTUFBTSxDQUFDO2FBQzFDLENBQUM7U0FDSDthQUFNO1lBQ0wsTUFBTSxFQUFFLE9BQU8sRUFBRSxjQUFjLEVBQUUsR0FBRyx3REFBYSwwQkFBMEIsR0FBQyxDQUFDO1lBQzdFLGFBQWEsQ0FBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQzdCLGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUM7U0FDOUM7S0FDRjtJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUM7QUF2U0Qsa0NBdVNDO0FBRUQsU0FBUyx3QkFBd0IsQ0FBQyxHQUFXLEVBQUUsYUFBeUM7SUFDdEYsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLGtCQUFrQixDQUFDLENBQUM7SUFDbkQsSUFBSSxRQUFRLEdBQUcsa0JBQWtCLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3RELElBQUksYUFBYSxDQUFDLFNBQVMsSUFBSSxRQUFRLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsRUFBRTtRQUMzRSxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzFELElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtZQUN2QixRQUFRLEdBQUcsR0FBRyxHQUFHLFFBQVEsQ0FBQztTQUMzQjtLQUNGO0lBRUQsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgdHlwZSB7IGpzb24sIGxvZ2dpbmcgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgdHlwZSB7IFBsdWdpbiB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgbG9va3VwIGFzIGxvb2t1cE1pbWVUeXBlIH0gZnJvbSAnbXJtaW1lJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgQmluYXJ5TGlrZSwgY3JlYXRlSGFzaCB9IGZyb20gJ25vZGU6Y3J5cHRvJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBTZXJ2ZXJSZXNwb25zZSB9IGZyb20gJ25vZGU6aHR0cCc7XG5pbXBvcnQgdHlwZSB7IEFkZHJlc3NJbmZvIH0gZnJvbSAnbm9kZTpuZXQnO1xuaW1wb3J0IHBhdGgsIHsgcG9zaXggfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHR5cGUgeyBDb25uZWN0LCBJbmxpbmVDb25maWcsIFZpdGVEZXZTZXJ2ZXIgfSBmcm9tICd2aXRlJztcbmltcG9ydCB7IEJ1aWxkT3V0cHV0RmlsZSwgQnVpbGRPdXRwdXRGaWxlVHlwZSB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvYnVuZGxlci1jb250ZXh0JztcbmltcG9ydCB7IEphdmFTY3JpcHRUcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvamF2YXNjcmlwdC10cmFuc2Zvcm1lcic7XG5pbXBvcnQgeyBnZXRGZWF0dXJlU3VwcG9ydCwgdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL3V0aWxzJztcbmltcG9ydCB7IGNyZWF0ZUFuZ3VsYXJMb2NhbGVEYXRhUGx1Z2luIH0gZnJvbSAnLi4vLi4vdG9vbHMvdml0ZS9pMThuLWxvY2FsZS1wbHVnaW4nO1xuaW1wb3J0IHsgUmVuZGVyT3B0aW9ucywgcmVuZGVyUGFnZSB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZlci1yZW5kZXJpbmcvcmVuZGVyLXBhZ2UnO1xuaW1wb3J0IHsgZ2V0U3VwcG9ydGVkQnJvd3NlcnMgfSBmcm9tICcuLi8uLi91dGlscy9zdXBwb3J0ZWQtYnJvd3NlcnMnO1xuaW1wb3J0IHsgZ2V0SW5kZXhPdXRwdXRGaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBidWlsZEFwcGxpY2F0aW9uSW50ZXJuYWwgfSBmcm9tICcuLi9hcHBsaWNhdGlvbic7XG5pbXBvcnQgeyBidWlsZEVzYnVpbGRCcm93c2VyIH0gZnJvbSAnLi4vYnJvd3Nlci1lc2J1aWxkJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuLi9icm93c2VyLWVzYnVpbGQvc2NoZW1hJztcbmltcG9ydCB7IGxvYWRQcm94eUNvbmZpZ3VyYXRpb24gfSBmcm9tICcuL2xvYWQtcHJveHktY29uZmlnJztcbmltcG9ydCB0eXBlIHsgTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnO1xuaW1wb3J0IHR5cGUgeyBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0IH0gZnJvbSAnLi93ZWJwYWNrLXNlcnZlcic7XG5cbmludGVyZmFjZSBPdXRwdXRGaWxlUmVjb3JkIHtcbiAgY29udGVudHM6IFVpbnQ4QXJyYXk7XG4gIHNpemU6IG51bWJlcjtcbiAgaGFzaD86IEJ1ZmZlcjtcbiAgdXBkYXRlZDogYm9vbGVhbjtcbiAgc2VydmFibGU6IGJvb2xlYW47XG59XG5cbmNvbnN0IFNTR19NQVJLRVJfUkVHRVhQID0gL25nLXNlcnZlci1jb250ZXh0PVtcIiddXFx3KlxcfD9zc2dcXHw/XFx3KltcIiddLztcblxuZnVuY3Rpb24gaGFzaENvbnRlbnQoY29udGVudHM6IEJpbmFyeUxpa2UpOiBCdWZmZXIge1xuICAvLyBUT0RPOiBDb25zaWRlciB4eGhhc2hcbiAgcmV0dXJuIGNyZWF0ZUhhc2goJ3NoYTI1NicpLnVwZGF0ZShjb250ZW50cykuZGlnZXN0KCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogc2VydmVXaXRoVml0ZShcbiAgc2VydmVyT3B0aW9uczogTm9ybWFsaXplZERldlNlcnZlck9wdGlvbnMsXG4gIGJ1aWxkZXJOYW1lOiBzdHJpbmcsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBwbHVnaW5zPzogUGx1Z2luW10sXG4pOiBBc3luY0l0ZXJhYmxlSXRlcmF0b3I8RGV2U2VydmVyQnVpbGRlck91dHB1dD4ge1xuICAvLyBHZXQgdGhlIGJyb3dzZXIgY29uZmlndXJhdGlvbiBmcm9tIHRoZSB0YXJnZXQgbmFtZS5cbiAgY29uc3QgcmF3QnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC5nZXRUYXJnZXRPcHRpb25zKFxuICAgIHNlcnZlck9wdGlvbnMuYnVpbGRUYXJnZXQsXG4gICkpIGFzIGpzb24uSnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyT3B0aW9ucztcblxuICBjb25zdCBicm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LnZhbGlkYXRlT3B0aW9ucyhcbiAgICB7XG4gICAgICAuLi5yYXdCcm93c2VyT3B0aW9ucyxcbiAgICAgIHdhdGNoOiBzZXJ2ZXJPcHRpb25zLndhdGNoLFxuICAgICAgcG9sbDogc2VydmVyT3B0aW9ucy5wb2xsLFxuICAgICAgdmVyYm9zZTogc2VydmVyT3B0aW9ucy52ZXJib3NlLFxuICAgIH0gYXMganNvbi5Kc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICAgIGJ1aWxkZXJOYW1lLFxuICApKSBhcyBqc29uLkpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG5cbiAgaWYgKGJyb3dzZXJPcHRpb25zLnByZXJlbmRlcikge1xuICAgIC8vIERpc2FibGUgcHJlcmVuZGVyaW5nIGlmIGVuYWJsZWQgYW5kIGZvcmNlIFNTUi5cbiAgICAvLyBUaGlzIGlzIHNvIGluc3RlYWQgb2YgcHJlcmVuZGVyaW5nIGFsbCB0aGUgcm91dGVzIGZvciBldmVyeSBjaGFuZ2UsIHRoZSBwYWdlIGlzIFwicHJlcmVuZGVyZWRcIiB3aGVuIGl0IGlzIHJlcXVlc3RlZC5cbiAgICBicm93c2VyT3B0aW9ucy5zc3IgPSB0cnVlO1xuICAgIGJyb3dzZXJPcHRpb25zLnByZXJlbmRlciA9IGZhbHNlO1xuICB9XG5cbiAgLy8gU2V0IGFsbCBwYWNrYWdlcyBhcyBleHRlcm5hbCB0byBzdXBwb3J0IFZpdGUncyBwcmVidW5kbGUgY2FjaGluZ1xuICBicm93c2VyT3B0aW9ucy5leHRlcm5hbFBhY2thZ2VzID0gc2VydmVyT3B0aW9ucy5jYWNoZU9wdGlvbnMuZW5hYmxlZDtcblxuICBpZiAoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGggPT09IHVuZGVmaW5lZCAmJiBicm93c2VyT3B0aW9ucy5iYXNlSHJlZiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGggPSBicm93c2VyT3B0aW9ucy5iYXNlSHJlZjtcbiAgfVxuXG4gIC8vIFRoZSBkZXZlbG9wbWVudCBzZXJ2ZXIgY3VycmVudGx5IG9ubHkgc3VwcG9ydHMgYSBzaW5nbGUgbG9jYWxlIHdoZW4gbG9jYWxpemluZy5cbiAgLy8gVGhpcyBtYXRjaGVzIHRoZSBiZWhhdmlvciBvZiB0aGUgV2VicGFjay1iYXNlZCBkZXZlbG9wbWVudCBzZXJ2ZXIgYnV0IGNvdWxkIGJlIGV4cGFuZGVkIGluIHRoZSBmdXR1cmUuXG4gIGlmIChcbiAgICBicm93c2VyT3B0aW9ucy5sb2NhbGl6ZSA9PT0gdHJ1ZSB8fFxuICAgIChBcnJheS5pc0FycmF5KGJyb3dzZXJPcHRpb25zLmxvY2FsaXplKSAmJiBicm93c2VyT3B0aW9ucy5sb2NhbGl6ZS5sZW5ndGggPiAxKVxuICApIHtcbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKFxuICAgICAgJ0xvY2FsaXphdGlvbiAoYGxvY2FsaXplYCBvcHRpb24pIGhhcyBiZWVuIGRpc2FibGVkLiBUaGUgZGV2ZWxvcG1lbnQgc2VydmVyIG9ubHkgc3VwcG9ydHMgbG9jYWxpemluZyBhIHNpbmdsZSBsb2NhbGUgcGVyIGJ1aWxkLicsXG4gICAgKTtcbiAgICBicm93c2VyT3B0aW9ucy5sb2NhbGl6ZSA9IGZhbHNlO1xuICB9IGVsc2UgaWYgKGJyb3dzZXJPcHRpb25zLmxvY2FsaXplKSB7XG4gICAgLy8gV2hlbiBsb2NhbGl6YXRpb24gaXMgZW5hYmxlZCB3aXRoIGEgc2luZ2xlIGxvY2FsZSwgZm9yY2UgYSBmbGF0IHBhdGggdG8gbWFpbnRhaW4gYmVoYXZpb3Igd2l0aCB0aGUgZXhpc3RpbmcgV2VicGFjay1iYXNlZCBkZXYgc2VydmVyLlxuICAgIGJyb3dzZXJPcHRpb25zLmZvcmNlSTE4bkZsYXRPdXRwdXQgPSB0cnVlO1xuICB9XG5cbiAgLy8gU2V0dXAgdGhlIHByZWJ1bmRsaW5nIHRyYW5zZm9ybWVyIHRoYXQgd2lsbCBiZSBzaGFyZWQgYWNyb3NzIFZpdGUgcHJlYnVuZGxpbmcgcmVxdWVzdHNcbiAgY29uc3QgcHJlYnVuZGxlVHJhbnNmb3JtZXIgPSBuZXcgSmF2YVNjcmlwdFRyYW5zZm9ybWVyKFxuICAgIC8vIEFsd2F5cyBlbmFibGUgSklUIGxpbmtpbmcgdG8gc3VwcG9ydCBhcHBsaWNhdGlvbnMgYnVpbHQgd2l0aCBhbmQgd2l0aG91dCBBT1QuXG4gICAgLy8gSW4gYSBkZXZlbG9wbWVudCBlbnZpcm9ubWVudCB0aGUgYWRkaXRpb25hbCBzY29wZSBpbmZvcm1hdGlvbiBkb2VzIG5vdFxuICAgIC8vIGhhdmUgYSBuZWdhdGl2ZSBlZmZlY3QgdW5saWtlIHByb2R1Y3Rpb24gd2hlcmUgZmluYWwgb3V0cHV0IHNpemUgaXMgcmVsZXZhbnQuXG4gICAgeyBzb3VyY2VtYXA6IHRydWUsIGppdDogdHJ1ZSB9LFxuICAgIDEsXG4gICk7XG5cbiAgLy8gRXh0cmFjdCBvdXRwdXQgaW5kZXggZnJvbSBvcHRpb25zXG4gIC8vIFRPRE86IFByb3ZpZGUgdGhpcyBpbmZvIGZyb20gdGhlIGJ1aWxkIHJlc3VsdHNcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgY29uc3QgaHRtbEluZGV4UGF0aCA9IGdldEluZGV4T3V0cHV0RmlsZShicm93c2VyT3B0aW9ucy5pbmRleCBhcyBhbnkpO1xuXG4gIC8vIGR5bmFtaWNhbGx5IGltcG9ydCBWaXRlIGZvciBFU00gY29tcGF0aWJpbGl0eVxuICBjb25zdCB7IGNyZWF0ZVNlcnZlciwgbm9ybWFsaXplUGF0aCB9ID0gYXdhaXQgaW1wb3J0KCd2aXRlJyk7XG5cbiAgbGV0IHNlcnZlcjogVml0ZURldlNlcnZlciB8IHVuZGVmaW5lZDtcbiAgbGV0IGxpc3RlbmluZ0FkZHJlc3M6IEFkZHJlc3NJbmZvIHwgdW5kZWZpbmVkO1xuICBsZXQgaGFkRXJyb3IgPSBmYWxzZTtcbiAgY29uc3QgZ2VuZXJhdGVkRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgT3V0cHV0RmlsZVJlY29yZD4oKTtcbiAgY29uc3QgYXNzZXRGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIGNvbnN0IGJ1aWxkID1cbiAgICBidWlsZGVyTmFtZSA9PT0gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOmFwcGxpY2F0aW9uJ1xuICAgICAgPyBidWlsZEFwcGxpY2F0aW9uSW50ZXJuYWxcbiAgICAgIDogYnVpbGRFc2J1aWxkQnJvd3NlcjtcblxuICAvLyBUT0RPOiBTd2l0Y2ggdGhpcyB0byBhbiBhcmNoaXRlY3Qgc2NoZWR1bGUgY2FsbCB3aGVuIGluZnJhc3RydWN0dXJlIHNldHRpbmdzIGFyZSBzdXBwb3J0ZWRcbiAgZm9yIGF3YWl0IChjb25zdCByZXN1bHQgb2YgYnVpbGQoXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBicm93c2VyT3B0aW9ucyBhcyBhbnksXG4gICAgY29udGV4dCxcbiAgICB7XG4gICAgICB3cml0ZTogZmFsc2UsXG4gICAgfSxcbiAgICBwbHVnaW5zLFxuICApKSB7XG4gICAgYXNzZXJ0KHJlc3VsdC5vdXRwdXRGaWxlcywgJ0J1aWxkZXIgZGlkIG5vdCBwcm92aWRlIHJlc3VsdCBmaWxlcy4nKTtcblxuICAgIC8vIElmIGJ1aWxkIGZhaWxlZCwgbm90aGluZyB0byBzZXJ2ZVxuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIC8vIElmIHNlcnZlciBpcyBhY3RpdmUsIHNlbmQgYW4gZXJyb3Igbm90aWZpY2F0aW9uXG4gICAgICBpZiAocmVzdWx0LmVycm9ycz8ubGVuZ3RoICYmIHNlcnZlcikge1xuICAgICAgICBoYWRFcnJvciA9IHRydWU7XG4gICAgICAgIHNlcnZlci53cy5zZW5kKHtcbiAgICAgICAgICB0eXBlOiAnZXJyb3InLFxuICAgICAgICAgIGVycjoge1xuICAgICAgICAgICAgbWVzc2FnZTogcmVzdWx0LmVycm9yc1swXS50ZXh0LFxuICAgICAgICAgICAgc3RhY2s6ICcnLFxuICAgICAgICAgICAgbG9jOiByZXN1bHQuZXJyb3JzWzBdLmxvY2F0aW9uLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29udGludWU7XG4gICAgfSBlbHNlIGlmIChoYWRFcnJvciAmJiBzZXJ2ZXIpIHtcbiAgICAgIC8vIFNlbmQgYW4gZW1wdHkgdXBkYXRlIHRvIGNsZWFyIHRoZSBlcnJvciBvdmVybGF5XG4gICAgICBzZXJ2ZXIud3Muc2VuZCh7XG4gICAgICAgICd0eXBlJzogJ3VwZGF0ZScsXG4gICAgICAgIHVwZGF0ZXM6IFtdLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQW5hbHl6ZSByZXN1bHQgZmlsZXMgZm9yIGNoYW5nZXNcbiAgICBhbmFseXplUmVzdWx0RmlsZXMobm9ybWFsaXplUGF0aCwgaHRtbEluZGV4UGF0aCwgcmVzdWx0Lm91dHB1dEZpbGVzLCBnZW5lcmF0ZWRGaWxlcyk7XG5cbiAgICBhc3NldEZpbGVzLmNsZWFyKCk7XG4gICAgaWYgKHJlc3VsdC5hc3NldEZpbGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IGFzc2V0IG9mIHJlc3VsdC5hc3NldEZpbGVzKSB7XG4gICAgICAgIGFzc2V0RmlsZXMuc2V0KCcvJyArIG5vcm1hbGl6ZVBhdGgoYXNzZXQuZGVzdGluYXRpb24pLCBhc3NldC5zb3VyY2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzZXJ2ZXIpIHtcbiAgICAgIGhhbmRsZVVwZGF0ZShnZW5lcmF0ZWRGaWxlcywgc2VydmVyLCBzZXJ2ZXJPcHRpb25zLCBjb250ZXh0LmxvZ2dlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQ/LnByb2plY3Q7XG4gICAgICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQuJyk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHsgcm9vdCA9ICcnIH0gPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gICAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHBhdGguam9pbihjb250ZXh0LndvcmtzcGFjZVJvb3QsIHJvb3QgYXMgc3RyaW5nKTtcbiAgICAgIGNvbnN0IGJyb3dzZXJzID0gZ2V0U3VwcG9ydGVkQnJvd3NlcnMocHJvamVjdFJvb3QsIGNvbnRleHQubG9nZ2VyKTtcbiAgICAgIGNvbnN0IHRhcmdldCA9IHRyYW5zZm9ybVN1cHBvcnRlZEJyb3dzZXJzVG9UYXJnZXRzKGJyb3dzZXJzKTtcblxuICAgICAgLy8gU2V0dXAgc2VydmVyIGFuZCBzdGFydCBsaXN0ZW5pbmdcbiAgICAgIGNvbnN0IHNlcnZlckNvbmZpZ3VyYXRpb24gPSBhd2FpdCBzZXR1cFNlcnZlcihcbiAgICAgICAgc2VydmVyT3B0aW9ucyxcbiAgICAgICAgZ2VuZXJhdGVkRmlsZXMsXG4gICAgICAgIGFzc2V0RmlsZXMsXG4gICAgICAgIGJyb3dzZXJPcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICAgIGJyb3dzZXJPcHRpb25zLmV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgICAgICAhIWJyb3dzZXJPcHRpb25zLnNzcixcbiAgICAgICAgcHJlYnVuZGxlVHJhbnNmb3JtZXIsXG4gICAgICAgIHRhcmdldCxcbiAgICAgICk7XG5cbiAgICAgIHNlcnZlciA9IGF3YWl0IGNyZWF0ZVNlcnZlcihzZXJ2ZXJDb25maWd1cmF0aW9uKTtcblxuICAgICAgYXdhaXQgc2VydmVyLmxpc3RlbigpO1xuICAgICAgbGlzdGVuaW5nQWRkcmVzcyA9IHNlcnZlci5odHRwU2VydmVyPy5hZGRyZXNzKCkgYXMgQWRkcmVzc0luZm87XG5cbiAgICAgIC8vIGxvZyBjb25uZWN0aW9uIGluZm9ybWF0aW9uXG4gICAgICBzZXJ2ZXIucHJpbnRVcmxzKCk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogYWRqdXN0IG91dHB1dCB0eXBpbmdzIHRvIHJlZmxlY3QgYm90aCBkZXZlbG9wbWVudCBzZXJ2ZXJzXG4gICAgeWllbGQgeyBzdWNjZXNzOiB0cnVlLCBwb3J0OiBsaXN0ZW5pbmdBZGRyZXNzPy5wb3J0IH0gYXMgdW5rbm93biBhcyBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0O1xuICB9XG5cbiAgLy8gQWRkIGNsZWFudXAgbG9naWMgdmlhIGEgYnVpbGRlciB0ZWFyZG93blxuICBsZXQgZGVmZXJyZWQ6ICgpID0+IHZvaWQ7XG4gIGNvbnRleHQuYWRkVGVhcmRvd24oYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IHNlcnZlcj8uY2xvc2UoKTtcbiAgICBhd2FpdCBwcmVidW5kbGVUcmFuc2Zvcm1lci5jbG9zZSgpO1xuICAgIGRlZmVycmVkPy4oKTtcbiAgfSk7XG4gIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiAoZGVmZXJyZWQgPSByZXNvbHZlKSk7XG59XG5cbmZ1bmN0aW9uIGhhbmRsZVVwZGF0ZShcbiAgZ2VuZXJhdGVkRmlsZXM6IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+LFxuICBzZXJ2ZXI6IFZpdGVEZXZTZXJ2ZXIsXG4gIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zLFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuKTogdm9pZCB7XG4gIGNvbnN0IHVwZGF0ZWRGaWxlczogc3RyaW5nW10gPSBbXTtcblxuICAvLyBJbnZhbGlkYXRlIGFueSB1cGRhdGVkIGZpbGVzXG4gIGZvciAoY29uc3QgW2ZpbGUsIHJlY29yZF0gb2YgZ2VuZXJhdGVkRmlsZXMpIHtcbiAgICBpZiAocmVjb3JkLnVwZGF0ZWQpIHtcbiAgICAgIHVwZGF0ZWRGaWxlcy5wdXNoKGZpbGUpO1xuICAgICAgY29uc3QgdXBkYXRlZE1vZHVsZXMgPSBzZXJ2ZXIubW9kdWxlR3JhcGguZ2V0TW9kdWxlc0J5RmlsZShmaWxlKTtcbiAgICAgIHVwZGF0ZWRNb2R1bGVzPy5mb3JFYWNoKChtKSA9PiBzZXJ2ZXI/Lm1vZHVsZUdyYXBoLmludmFsaWRhdGVNb2R1bGUobSkpO1xuICAgIH1cbiAgfVxuXG4gIGlmICghdXBkYXRlZEZpbGVzLmxlbmd0aCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChzZXJ2ZXJPcHRpb25zLmxpdmVSZWxvYWQgfHwgc2VydmVyT3B0aW9ucy5obXIpIHtcbiAgICBpZiAodXBkYXRlZEZpbGVzLmV2ZXJ5KChmKSA9PiBmLmVuZHNXaXRoKCcuY3NzJykpKSB7XG4gICAgICBjb25zdCB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuICAgICAgc2VydmVyLndzLnNlbmQoe1xuICAgICAgICB0eXBlOiAndXBkYXRlJyxcbiAgICAgICAgdXBkYXRlczogdXBkYXRlZEZpbGVzLm1hcCgoZikgPT4ge1xuICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gZi5zbGljZSgxKTsgLy8gUmVtb3ZlIGxlYWRpbmcgc2xhc2guXG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogJ2Nzcy11cGRhdGUnLFxuICAgICAgICAgICAgdGltZXN0YW1wLFxuICAgICAgICAgICAgcGF0aDogZmlsZVBhdGgsXG4gICAgICAgICAgICBhY2NlcHRlZFBhdGg6IGZpbGVQYXRoLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pLFxuICAgICAgfSk7XG5cbiAgICAgIGxvZ2dlci5pbmZvKCdITVIgdXBkYXRlIHNlbnQgdG8gY2xpZW50KHMpLi4uJyk7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cblxuICAvLyBTZW5kIHJlbG9hZCBjb21tYW5kIHRvIGNsaWVudHNcbiAgaWYgKHNlcnZlck9wdGlvbnMubGl2ZVJlbG9hZCkge1xuICAgIGxvZ2dlci5pbmZvKCdSZWxvYWRpbmcgY2xpZW50KHMpLi4uJyk7XG5cbiAgICBzZXJ2ZXIud3Muc2VuZCh7XG4gICAgICB0eXBlOiAnZnVsbC1yZWxvYWQnLFxuICAgICAgcGF0aDogJyonLFxuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFuYWx5emVSZXN1bHRGaWxlcyhcbiAgbm9ybWFsaXplUGF0aDogKGlkOiBzdHJpbmcpID0+IHN0cmluZyxcbiAgaHRtbEluZGV4UGF0aDogc3RyaW5nLFxuICByZXN1bHRGaWxlczogQnVpbGRPdXRwdXRGaWxlW10sXG4gIGdlbmVyYXRlZEZpbGVzOiBNYXA8c3RyaW5nLCBPdXRwdXRGaWxlUmVjb3JkPixcbikge1xuICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KFsnL2luZGV4Lmh0bWwnXSk7XG4gIGZvciAoY29uc3QgZmlsZSBvZiByZXN1bHRGaWxlcykge1xuICAgIGxldCBmaWxlUGF0aDtcbiAgICBpZiAoZmlsZS5wYXRoID09PSBodG1sSW5kZXhQYXRoKSB7XG4gICAgICAvLyBDb252ZXJ0IGN1c3RvbSBpbmRleCBvdXRwdXQgcGF0aCB0byBzdGFuZGFyZCBpbmRleCBwYXRoIGZvciBkZXYtc2VydmVyIHVzYWdlLlxuICAgICAgLy8gVGhpcyBtaW1pY3MgdGhlIFdlYnBhY2sgZGV2LXNlcnZlciBiZWhhdmlvci5cbiAgICAgIGZpbGVQYXRoID0gJy9pbmRleC5odG1sJztcbiAgICB9IGVsc2Uge1xuICAgICAgZmlsZVBhdGggPSAnLycgKyBub3JtYWxpemVQYXRoKGZpbGUucGF0aCk7XG4gICAgfVxuICAgIHNlZW4uYWRkKGZpbGVQYXRoKTtcblxuICAgIC8vIFNraXAgYW5hbHlzaXMgb2Ygc291cmNlbWFwc1xuICAgIGlmIChmaWxlUGF0aC5lbmRzV2l0aCgnLm1hcCcpKSB7XG4gICAgICBnZW5lcmF0ZWRGaWxlcy5zZXQoZmlsZVBhdGgsIHtcbiAgICAgICAgY29udGVudHM6IGZpbGUuY29udGVudHMsXG4gICAgICAgIHNlcnZhYmxlOlxuICAgICAgICAgIGZpbGUudHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5Ccm93c2VyIHx8IGZpbGUudHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5NZWRpYSxcbiAgICAgICAgc2l6ZTogZmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoLFxuICAgICAgICB1cGRhdGVkOiBmYWxzZSxcbiAgICAgIH0pO1xuXG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBsZXQgZmlsZUhhc2g6IEJ1ZmZlciB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCBleGlzdGluZ1JlY29yZCA9IGdlbmVyYXRlZEZpbGVzLmdldChmaWxlUGF0aCk7XG4gICAgaWYgKGV4aXN0aW5nUmVjb3JkICYmIGV4aXN0aW5nUmVjb3JkLnNpemUgPT09IGZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCkge1xuICAgICAgLy8gT25seSBoYXNoIGV4aXN0aW5nIGZpbGUgd2hlbiBuZWVkZWRcbiAgICAgIGlmIChleGlzdGluZ1JlY29yZC5oYXNoID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZXhpc3RpbmdSZWNvcmQuaGFzaCA9IGhhc2hDb250ZW50KGV4aXN0aW5nUmVjb3JkLmNvbnRlbnRzKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ29tcGFyZSBhZ2FpbnN0IGxhdGVzdCByZXN1bHQgb3V0cHV0XG4gICAgICBmaWxlSGFzaCA9IGhhc2hDb250ZW50KGZpbGUuY29udGVudHMpO1xuICAgICAgaWYgKGZpbGVIYXNoLmVxdWFscyhleGlzdGluZ1JlY29yZC5oYXNoKSkge1xuICAgICAgICAvLyBTYW1lIGZpbGVcbiAgICAgICAgZXhpc3RpbmdSZWNvcmQudXBkYXRlZCA9IGZhbHNlO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZWRGaWxlcy5zZXQoZmlsZVBhdGgsIHtcbiAgICAgIGNvbnRlbnRzOiBmaWxlLmNvbnRlbnRzLFxuICAgICAgc2l6ZTogZmlsZS5jb250ZW50cy5ieXRlTGVuZ3RoLFxuICAgICAgaGFzaDogZmlsZUhhc2gsXG4gICAgICB1cGRhdGVkOiB0cnVlLFxuICAgICAgc2VydmFibGU6XG4gICAgICAgIGZpbGUudHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5Ccm93c2VyIHx8IGZpbGUudHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5NZWRpYSxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIENsZWFyIHN0YWxlIG91dHB1dCBmaWxlc1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgZ2VuZXJhdGVkRmlsZXMua2V5cygpKSB7XG4gICAgaWYgKCFzZWVuLmhhcyhmaWxlKSkge1xuICAgICAgZ2VuZXJhdGVkRmlsZXMuZGVsZXRlKGZpbGUpO1xuICAgIH1cbiAgfVxufVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldHVwU2VydmVyKFxuICBzZXJ2ZXJPcHRpb25zOiBOb3JtYWxpemVkRGV2U2VydmVyT3B0aW9ucyxcbiAgb3V0cHV0RmlsZXM6IE1hcDxzdHJpbmcsIE91dHB1dEZpbGVSZWNvcmQ+LFxuICBhc3NldHM6IE1hcDxzdHJpbmcsIHN0cmluZz4sXG4gIHByZXNlcnZlU3ltbGlua3M6IGJvb2xlYW4gfCB1bmRlZmluZWQsXG4gIHByZWJ1bmRsZUV4Y2x1ZGU6IHN0cmluZ1tdIHwgdW5kZWZpbmVkLFxuICBzc3I6IGJvb2xlYW4sXG4gIHByZWJ1bmRsZVRyYW5zZm9ybWVyOiBKYXZhU2NyaXB0VHJhbnNmb3JtZXIsXG4gIHRhcmdldDogc3RyaW5nW10sXG4pOiBQcm9taXNlPElubGluZUNvbmZpZz4ge1xuICBjb25zdCBwcm94eSA9IGF3YWl0IGxvYWRQcm94eUNvbmZpZ3VyYXRpb24oXG4gICAgc2VydmVyT3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIHNlcnZlck9wdGlvbnMucHJveHlDb25maWcsXG4gICAgdHJ1ZSxcbiAgKTtcblxuICAvLyBkeW5hbWljYWxseSBpbXBvcnQgVml0ZSBmb3IgRVNNIGNvbXBhdGliaWxpdHlcbiAgY29uc3QgeyBub3JtYWxpemVQYXRoIH0gPSBhd2FpdCBpbXBvcnQoJ3ZpdGUnKTtcblxuICBjb25zdCBjb25maWd1cmF0aW9uOiBJbmxpbmVDb25maWcgPSB7XG4gICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgZW52RmlsZTogZmFsc2UsXG4gICAgY2FjaGVEaXI6IHBhdGguam9pbihzZXJ2ZXJPcHRpb25zLmNhY2hlT3B0aW9ucy5wYXRoLCAndml0ZScpLFxuICAgIHJvb3Q6IHNlcnZlck9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICBwdWJsaWNEaXI6IGZhbHNlLFxuICAgIGVzYnVpbGQ6IGZhbHNlLFxuICAgIG1vZGU6ICdkZXZlbG9wbWVudCcsXG4gICAgYXBwVHlwZTogJ3NwYScsXG4gICAgY3NzOiB7XG4gICAgICBkZXZTb3VyY2VtYXA6IHRydWUsXG4gICAgfSxcbiAgICBiYXNlOiBzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCxcbiAgICByZXNvbHZlOiB7XG4gICAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIH0sXG4gICAgc2VydmVyOiB7XG4gICAgICBwb3J0OiBzZXJ2ZXJPcHRpb25zLnBvcnQsXG4gICAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgICAgaG9zdDogc2VydmVyT3B0aW9ucy5ob3N0LFxuICAgICAgb3Blbjogc2VydmVyT3B0aW9ucy5vcGVuLFxuICAgICAgaGVhZGVyczogc2VydmVyT3B0aW9ucy5oZWFkZXJzLFxuICAgICAgcHJveHksXG4gICAgICAvLyBDdXJyZW50bHkgZG9lcyBub3QgYXBwZWFyIHRvIGJlIGEgd2F5IHRvIGRpc2FibGUgZmlsZSB3YXRjaGluZyBkaXJlY3RseSBzbyBpZ25vcmUgYWxsIGZpbGVzXG4gICAgICB3YXRjaDoge1xuICAgICAgICBpZ25vcmVkOiBbJyoqLyonXSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBzc3I6IHtcbiAgICAgIC8vIEV4Y2x1ZGUgYW55IHByb3ZpZGVkIGRlcGVuZGVuY2llcyAoY3VycmVudGx5IGJ1aWxkIGRlZmluZWQgZXh0ZXJuYWxzKVxuICAgICAgZXh0ZXJuYWw6IHByZWJ1bmRsZUV4Y2x1ZGUsXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVBbmd1bGFyTG9jYWxlRGF0YVBsdWdpbigpLFxuICAgICAge1xuICAgICAgICBuYW1lOiAndml0ZTphbmd1bGFyLW1lbW9yeScsXG4gICAgICAgIC8vIEVuc3VyZXMgcGx1Z2luIGhvb2tzIHJ1biBiZWZvcmUgYnVpbHQtaW4gVml0ZSBob29rc1xuICAgICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgICAgYXN5bmMgcmVzb2x2ZUlkKHNvdXJjZSwgaW1wb3J0ZXIpIHtcbiAgICAgICAgICBpZiAoaW1wb3J0ZXIgJiYgc291cmNlLnN0YXJ0c1dpdGgoJy4nKSkge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIHF1ZXJ5IGlmIHByZXNlbnRcbiAgICAgICAgICAgIGNvbnN0IFtpbXBvcnRlckZpbGVdID0gaW1wb3J0ZXIuc3BsaXQoJz8nLCAxKTtcblxuICAgICAgICAgICAgc291cmNlID0gbm9ybWFsaXplUGF0aChwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKGltcG9ydGVyRmlsZSksIHNvdXJjZSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IFtmaWxlXSA9IHNvdXJjZS5zcGxpdCgnPycsIDEpO1xuICAgICAgICAgIGlmIChvdXRwdXRGaWxlcy5oYXMoZmlsZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBzb3VyY2U7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBsb2FkKGlkKSB7XG4gICAgICAgICAgY29uc3QgW2ZpbGVdID0gaWQuc3BsaXQoJz8nLCAxKTtcbiAgICAgICAgICBjb25zdCBjb2RlQ29udGVudHMgPSBvdXRwdXRGaWxlcy5nZXQoZmlsZSk/LmNvbnRlbnRzO1xuICAgICAgICAgIGlmIChjb2RlQ29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGNvZGUgPSBCdWZmZXIuZnJvbShjb2RlQ29udGVudHMpLnRvU3RyaW5nKCd1dGYtOCcpO1xuICAgICAgICAgIGNvbnN0IG1hcENvbnRlbnRzID0gb3V0cHV0RmlsZXMuZ2V0KGZpbGUgKyAnLm1hcCcpPy5jb250ZW50cztcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgc291cmNlIG1hcCBVUkwgY29tbWVudHMgZnJvbSB0aGUgY29kZSBpZiBhIHNvdXJjZW1hcCBpcyBwcmVzZW50LlxuICAgICAgICAgICAgLy8gVml0ZSB3aWxsIGlubGluZSBhbmQgYWRkIGFuIGFkZGl0aW9uYWwgc291cmNlbWFwIFVSTCBmb3IgdGhlIHNvdXJjZW1hcC5cbiAgICAgICAgICAgIGNvZGU6IG1hcENvbnRlbnRzID8gY29kZS5yZXBsYWNlKC9eXFwvXFwvIyBzb3VyY2VNYXBwaW5nVVJMPVteXFxyXFxuXSovZ20sICcnKSA6IGNvZGUsXG4gICAgICAgICAgICBtYXA6IG1hcENvbnRlbnRzICYmIEJ1ZmZlci5mcm9tKG1hcENvbnRlbnRzKS50b1N0cmluZygndXRmLTgnKSxcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICAgICAgLy8gQXNzZXRzIGFuZCByZXNvdXJjZXMgZ2V0IGhhbmRsZWQgZmlyc3RcbiAgICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGZ1bmN0aW9uIGFuZ3VsYXJBc3NldHNNaWRkbGV3YXJlKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgICAgICAgICBpZiAocmVxLnVybCA9PT0gdW5kZWZpbmVkIHx8IHJlcy53cml0YWJsZUVuZGVkKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUGFyc2UgdGhlIGluY29taW5nIHJlcXVlc3QuXG4gICAgICAgICAgICAvLyBUaGUgYmFzZSBvZiB0aGUgVVJMIGlzIHVudXNlZCBidXQgcmVxdWlyZWQgdG8gcGFyc2UgdGhlIFVSTC5cbiAgICAgICAgICAgIGNvbnN0IHBhdGhuYW1lID0gcGF0aG5hbWVXaXRob3V0U2VydmVQYXRoKHJlcS51cmwsIHNlcnZlck9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9uID0gcGF0aC5leHRuYW1lKHBhdGhuYW1lKTtcblxuICAgICAgICAgICAgLy8gUmV3cml0ZSBhbGwgYnVpbGQgYXNzZXRzIHRvIGEgdml0ZSByYXcgZnMgVVJMXG4gICAgICAgICAgICBjb25zdCBhc3NldFNvdXJjZVBhdGggPSBhc3NldHMuZ2V0KHBhdGhuYW1lKTtcbiAgICAgICAgICAgIGlmIChhc3NldFNvdXJjZVBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAvLyBUaGUgZW5jb2RpbmcgbmVlZHMgdG8gbWF0Y2ggd2hhdCBoYXBwZW5zIGluIHRoZSB2aXRlIHN0YXRpYyBtaWRkbGV3YXJlLlxuICAgICAgICAgICAgICAvLyByZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS92aXRlanMvdml0ZS9ibG9iL2Q0ZjEzYmQ4MTQ2ODk2MWM4YzkyNjQzOGU4MTVhYjZiMWM4MjczNWUvcGFja2FnZXMvdml0ZS9zcmMvbm9kZS9zZXJ2ZXIvbWlkZGxld2FyZXMvc3RhdGljLnRzI0wxNjNcbiAgICAgICAgICAgICAgcmVxLnVybCA9IGAvQGZzLyR7ZW5jb2RlVVJJKGFzc2V0U291cmNlUGF0aCl9YDtcbiAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVzb3VyY2UgZmlsZXMgYXJlIGhhbmRsZWQgZGlyZWN0bHkuXG4gICAgICAgICAgICAvLyBHbG9iYWwgc3R5bGVzaGVldHMgKENTUyBmaWxlcykgYXJlIGN1cnJlbnRseSBjb25zaWRlcmVkIHJlc291cmNlcyB0byB3b3JrYXJvdW5kXG4gICAgICAgICAgICAvLyBkZXYgc2VydmVyIHNvdXJjZW1hcCBpc3N1ZXMgd2l0aCBzdHlsZXNoZWV0cy5cbiAgICAgICAgICAgIGlmIChleHRlbnNpb24gIT09ICcuanMnICYmIGV4dGVuc2lvbiAhPT0gJy5odG1sJykge1xuICAgICAgICAgICAgICBjb25zdCBvdXRwdXRGaWxlID0gb3V0cHV0RmlsZXMuZ2V0KHBhdGhuYW1lKTtcbiAgICAgICAgICAgICAgaWYgKG91dHB1dEZpbGU/LnNlcnZhYmxlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWltZVR5cGUgPSBsb29rdXBNaW1lVHlwZShleHRlbnNpb24pO1xuICAgICAgICAgICAgICAgIGlmIChtaW1lVHlwZSkge1xuICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgbWltZVR5cGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDYWNoZS1Db250cm9sJywgJ25vLWNhY2hlJyk7XG4gICAgICAgICAgICAgICAgaWYgKHNlcnZlck9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoc2VydmVyT3B0aW9ucy5oZWFkZXJzKS5mb3JFYWNoKChbbmFtZSwgdmFsdWVdKSA9PlxuICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKG5hbWUsIHZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlcy5lbmQob3V0cHV0RmlsZS5jb250ZW50cyk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gUmV0dXJuaW5nIGEgZnVuY3Rpb24sIGluc3RhbGxzIG1pZGRsZXdhcmUgYWZ0ZXIgdGhlIG1haW4gdHJhbnNmb3JtIG1pZGRsZXdhcmUgYnV0XG4gICAgICAgICAgLy8gYmVmb3JlIHRoZSBidWlsdC1pbiBIVE1MIG1pZGRsZXdhcmVcbiAgICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgICAgZnVuY3Rpb24gYW5ndWxhclNTUk1pZGRsZXdhcmUoXG4gICAgICAgICAgICAgIHJlcTogQ29ubmVjdC5JbmNvbWluZ01lc3NhZ2UsXG4gICAgICAgICAgICAgIHJlczogU2VydmVyUmVzcG9uc2UsXG4gICAgICAgICAgICAgIG5leHQ6IENvbm5lY3QuTmV4dEZ1bmN0aW9uLFxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHVybCA9IHJlcS5vcmlnaW5hbFVybDtcbiAgICAgICAgICAgICAgaWYgKCF1cmwgfHwgdXJsLmVuZHNXaXRoKCcuaHRtbCcpKSB7XG4gICAgICAgICAgICAgICAgbmV4dCgpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgcG90ZW50aWFsUHJlcmVuZGVyZWQgPSBvdXRwdXRGaWxlcy5nZXQocG9zaXguam9pbih1cmwsICdpbmRleC5odG1sJykpPy5jb250ZW50cztcbiAgICAgICAgICAgICAgaWYgKHBvdGVudGlhbFByZXJlbmRlcmVkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IEJ1ZmZlci5mcm9tKHBvdGVudGlhbFByZXJlbmRlcmVkKS50b1N0cmluZygndXRmLTgnKTtcbiAgICAgICAgICAgICAgICBpZiAoU1NHX01BUktFUl9SRUdFWFAudGVzdChjb250ZW50KSkge1xuICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtSW5kZXhIdG1sQW5kQWRkSGVhZGVycyh1cmwsIHBvdGVudGlhbFByZXJlbmRlcmVkLCByZXMsIG5leHQpO1xuXG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgcmF3SHRtbCA9IG91dHB1dEZpbGVzLmdldCgnL2luZGV4LnNlcnZlci5odG1sJyk/LmNvbnRlbnRzO1xuICAgICAgICAgICAgICBpZiAoIXJhd0h0bWwpIHtcbiAgICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB0cmFuc2Zvcm1JbmRleEh0bWxBbmRBZGRIZWFkZXJzKHVybCwgcmF3SHRtbCwgcmVzLCBuZXh0LCBhc3luYyAoaHRtbCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgY29udGVudCB9ID0gYXdhaXQgcmVuZGVyUGFnZSh7XG4gICAgICAgICAgICAgICAgICBkb2N1bWVudDogaHRtbCxcbiAgICAgICAgICAgICAgICAgIHJvdXRlOiBwYXRobmFtZVdpdGhvdXRTZXJ2ZVBhdGgodXJsLCBzZXJ2ZXJPcHRpb25zKSxcbiAgICAgICAgICAgICAgICAgIHNlcnZlckNvbnRleHQ6ICdzc3InLFxuICAgICAgICAgICAgICAgICAgbG9hZEJ1bmRsZTogKHBhdGg6IHN0cmluZykgPT5cbiAgICAgICAgICAgICAgICAgICAgc2VydmVyLnNzckxvYWRNb2R1bGUocGF0aC5zbGljZSgxKSkgYXMgUmV0dXJuVHlwZTxcbiAgICAgICAgICAgICAgICAgICAgICBOb25OdWxsYWJsZTxSZW5kZXJPcHRpb25zWydsb2FkQnVuZGxlJ10+XG4gICAgICAgICAgICAgICAgICAgID4sXG4gICAgICAgICAgICAgICAgICAvLyBGaWxlcyBoZXJlIGFyZSBvbmx5IG5lZWRlZCBmb3IgY3JpdGljYWwgQ1NTIGlubGluaW5nLlxuICAgICAgICAgICAgICAgICAgb3V0cHV0RmlsZXM6IHt9LFxuICAgICAgICAgICAgICAgICAgLy8gVE9ETzogYWRkIHN1cHBvcnQgZm9yIGNyaXRpY2FsIGNzcyBpbmxpbmluZy5cbiAgICAgICAgICAgICAgICAgIGlubGluZUNyaXRpY2FsQ3NzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBjb250ZW50O1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNzcikge1xuICAgICAgICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGFuZ3VsYXJTU1JNaWRkbGV3YXJlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShmdW5jdGlvbiBhbmd1bGFySW5kZXhNaWRkbGV3YXJlKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgICAgICAgICAgIGlmICghcmVxLnVybCkge1xuICAgICAgICAgICAgICAgIG5leHQoKTtcblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIFBhcnNlIHRoZSBpbmNvbWluZyByZXF1ZXN0LlxuICAgICAgICAgICAgICAvLyBUaGUgYmFzZSBvZiB0aGUgVVJMIGlzIHVudXNlZCBidXQgcmVxdWlyZWQgdG8gcGFyc2UgdGhlIFVSTC5cbiAgICAgICAgICAgICAgY29uc3QgcGF0aG5hbWUgPSBwYXRobmFtZVdpdGhvdXRTZXJ2ZVBhdGgocmVxLnVybCwgc2VydmVyT3B0aW9ucyk7XG5cbiAgICAgICAgICAgICAgaWYgKHBhdGhuYW1lID09PSAnLycgfHwgcGF0aG5hbWUgPT09IGAvaW5kZXguaHRtbGApIHtcbiAgICAgICAgICAgICAgICBjb25zdCByYXdIdG1sID0gb3V0cHV0RmlsZXMuZ2V0KCcvaW5kZXguaHRtbCcpPy5jb250ZW50cztcbiAgICAgICAgICAgICAgICBpZiAocmF3SHRtbCkge1xuICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtSW5kZXhIdG1sQW5kQWRkSGVhZGVycyhyZXEudXJsLCByYXdIdG1sLCByZXMsIG5leHQpO1xuXG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGZ1bmN0aW9uIHRyYW5zZm9ybUluZGV4SHRtbEFuZEFkZEhlYWRlcnMoXG4gICAgICAgICAgICB1cmw6IHN0cmluZyxcbiAgICAgICAgICAgIHJhd0h0bWw6IFVpbnQ4QXJyYXksXG4gICAgICAgICAgICByZXM6IFNlcnZlclJlc3BvbnNlPGltcG9ydCgnaHR0cCcpLkluY29taW5nTWVzc2FnZT4sXG4gICAgICAgICAgICBuZXh0OiBDb25uZWN0Lk5leHRGdW5jdGlvbixcbiAgICAgICAgICAgIGFkZGl0aW9uYWxUcmFuc2Zvcm1lcj86IChodG1sOiBzdHJpbmcpID0+IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPixcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHNlcnZlclxuICAgICAgICAgICAgICAudHJhbnNmb3JtSW5kZXhIdG1sKHVybCwgQnVmZmVyLmZyb20ocmF3SHRtbCkudG9TdHJpbmcoJ3V0Zi04JykpXG4gICAgICAgICAgICAgIC50aGVuKGFzeW5jIChwcm9jZXNzZWRIdG1sKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGFkZGl0aW9uYWxUcmFuc2Zvcm1lcikge1xuICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGFkZGl0aW9uYWxUcmFuc2Zvcm1lcihwcm9jZXNzZWRIdG1sKTtcbiAgICAgICAgICAgICAgICAgIGlmICghY29udGVudCkge1xuICAgICAgICAgICAgICAgICAgICBuZXh0KCk7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICBwcm9jZXNzZWRIdG1sID0gY29udGVudDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAndGV4dC9odG1sJyk7XG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ2FjaGUtQ29udHJvbCcsICduby1jYWNoZScpO1xuICAgICAgICAgICAgICAgIGlmIChzZXJ2ZXJPcHRpb25zLmhlYWRlcnMpIHtcbiAgICAgICAgICAgICAgICAgIE9iamVjdC5lbnRyaWVzKHNlcnZlck9wdGlvbnMuaGVhZGVycykuZm9yRWFjaCgoW25hbWUsIHZhbHVlXSkgPT5cbiAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcihuYW1lLCB2YWx1ZSksXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXMuZW5kKHByb2Nlc3NlZEh0bWwpO1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yKSA9PiBuZXh0KGVycm9yKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdLFxuICAgIG9wdGltaXplRGVwczoge1xuICAgICAgLy8gT25seSBlbmFibGUgd2l0aCBjYWNoaW5nIHNpbmNlIGl0IGNhdXNlcyBwcmVidW5kbGUgZGVwZW5kZW5jaWVzIHRvIGJlIGNhY2hlZFxuICAgICAgZGlzYWJsZWQ6ICFzZXJ2ZXJPcHRpb25zLmNhY2hlT3B0aW9ucy5lbmFibGVkLFxuICAgICAgLy8gRXhjbHVkZSBhbnkgcHJvdmlkZWQgZGVwZW5kZW5jaWVzIChjdXJyZW50bHkgYnVpbGQgZGVmaW5lZCBleHRlcm5hbHMpXG4gICAgICBleGNsdWRlOiBwcmVidW5kbGVFeGNsdWRlLFxuICAgICAgLy8gU2tpcCBhdXRvbWF0aWMgZmlsZS1iYXNlZCBlbnRyeSBwb2ludCBkaXNjb3ZlcnlcbiAgICAgIGVudHJpZXM6IFtdLFxuICAgICAgLy8gQWRkIGFuIGVzYnVpbGQgcGx1Z2luIHRvIHJ1biB0aGUgQW5ndWxhciBsaW5rZXIgb24gZGVwZW5kZW5jaWVzXG4gICAgICBlc2J1aWxkT3B0aW9uczoge1xuICAgICAgICAvLyBTZXQgZXNidWlsZCBzdXBwb3J0ZWQgdGFyZ2V0cy5cbiAgICAgICAgdGFyZ2V0LFxuICAgICAgICBzdXBwb3J0ZWQ6IGdldEZlYXR1cmVTdXBwb3J0KHRhcmdldCksXG4gICAgICAgIHBsdWdpbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnYW5ndWxhci12aXRlLW9wdGltaXplLWRlcHMnLFxuICAgICAgICAgICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgICAgICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9qcyQvIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgIGNvbnRlbnRzOiBhd2FpdCBwcmVidW5kbGVUcmFuc2Zvcm1lci50cmFuc2Zvcm1GaWxlKGFyZ3MucGF0aCksXG4gICAgICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0sXG4gIH07XG5cbiAgaWYgKHNlcnZlck9wdGlvbnMuc3NsKSB7XG4gICAgaWYgKHNlcnZlck9wdGlvbnMuc3NsQ2VydCAmJiBzZXJ2ZXJPcHRpb25zLnNzbEtleSkge1xuICAgICAgLy8gc2VydmVyIGNvbmZpZ3VyYXRpb24gaXMgZGVmaW5lZCBhYm92ZVxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgIGNvbmZpZ3VyYXRpb24uc2VydmVyIS5odHRwcyA9IHtcbiAgICAgICAgY2VydDogYXdhaXQgcmVhZEZpbGUoc2VydmVyT3B0aW9ucy5zc2xDZXJ0KSxcbiAgICAgICAga2V5OiBhd2FpdCByZWFkRmlsZShzZXJ2ZXJPcHRpb25zLnNzbEtleSksXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7IGRlZmF1bHQ6IGJhc2ljU3NsUGx1Z2luIH0gPSBhd2FpdCBpbXBvcnQoJ0B2aXRlanMvcGx1Z2luLWJhc2ljLXNzbCcpO1xuICAgICAgY29uZmlndXJhdGlvbi5wbHVnaW5zID8/PSBbXTtcbiAgICAgIGNvbmZpZ3VyYXRpb24ucGx1Z2lucy5wdXNoKGJhc2ljU3NsUGx1Z2luKCkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBjb25maWd1cmF0aW9uO1xufVxuXG5mdW5jdGlvbiBwYXRobmFtZVdpdGhvdXRTZXJ2ZVBhdGgodXJsOiBzdHJpbmcsIHNlcnZlck9wdGlvbnM6IE5vcm1hbGl6ZWREZXZTZXJ2ZXJPcHRpb25zKTogc3RyaW5nIHtcbiAgY29uc3QgcGFyc2VkVXJsID0gbmV3IFVSTCh1cmwsICdodHRwOi8vbG9jYWxob3N0Jyk7XG4gIGxldCBwYXRobmFtZSA9IGRlY29kZVVSSUNvbXBvbmVudChwYXJzZWRVcmwucGF0aG5hbWUpO1xuICBpZiAoc2VydmVyT3B0aW9ucy5zZXJ2ZVBhdGggJiYgcGF0aG5hbWUuc3RhcnRzV2l0aChzZXJ2ZXJPcHRpb25zLnNlcnZlUGF0aCkpIHtcbiAgICBwYXRobmFtZSA9IHBhdGhuYW1lLnNsaWNlKHNlcnZlck9wdGlvbnMuc2VydmVQYXRoLmxlbmd0aCk7XG4gICAgaWYgKHBhdGhuYW1lWzBdICE9PSAnLycpIHtcbiAgICAgIHBhdGhuYW1lID0gJy8nICsgcGF0aG5hbWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHBhdGhuYW1lO1xufVxuIl19