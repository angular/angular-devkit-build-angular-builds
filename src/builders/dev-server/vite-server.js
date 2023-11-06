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
const remapping_1 = __importDefault(require("@ampproject/remapping"));
const mrmime_1 = require("mrmime");
const node_assert_1 = __importDefault(require("node:assert"));
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const bundler_context_1 = require("../../tools/esbuild/bundler-context");
const javascript_transformer_1 = require("../../tools/esbuild/javascript-transformer");
const rxjs_esm_resolution_plugin_1 = require("../../tools/esbuild/rxjs-esm-resolution-plugin");
const utils_1 = require("../../tools/esbuild/utils");
const i18n_locale_plugin_1 = require("../../tools/vite/i18n-locale-plugin");
const render_page_1 = require("../../utils/server-rendering/render-page");
const supported_browsers_1 = require("../../utils/supported-browsers");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const application_1 = require("../application");
const browser_esbuild_1 = require("../browser-esbuild");
const load_proxy_config_1 = require("./load-proxy-config");
// eslint-disable-next-line max-lines-per-function
async function* serveWithVite(serverOptions, builderName, context, transformers, extensions) {
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
        // https://nodejs.org/api/process.html#processsetsourcemapsenabledval
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        process.setSourceMapsEnabled(true);
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
    { sourcemap: true, jit: true }, 1, true);
    // Extract output index from options
    // TODO: Provide this info from the build results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const htmlIndexPath = (0, webpack_browser_config_1.getIndexOutputFile)(browserOptions.index);
    // dynamically import Vite for ESM compatibility
    const { createServer, normalizePath } = await Promise.resolve().then(() => __importStar(require('vite')));
    let server;
    let serverUrl;
    let hadError = false;
    const generatedFiles = new Map();
    const assetFiles = new Map();
    const externalMetadata = {
        implicitBrowser: [],
        implicitServer: [],
        explicit: [],
    };
    const build = builderName === '@angular-devkit/build-angular:application'
        ? application_1.buildApplicationInternal
        : browser_esbuild_1.buildEsbuildBrowser;
    // TODO: Switch this to an architect schedule call when infrastructure settings are supported
    for await (const result of build(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    browserOptions, context, {
        write: false,
    }, extensions?.buildPlugins)) {
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
            hadError = false;
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
        // To avoid disconnecting the array objects from the option, these arrays need to be mutated instead of replaced.
        if (result.externalMetadata) {
            const { implicitBrowser, implicitServer, explicit } = result.externalMetadata;
            // Empty Arrays to avoid growing unlimited with every re-build.
            externalMetadata.explicit.length = 0;
            externalMetadata.implicitServer.length = 0;
            externalMetadata.implicitBrowser.length = 0;
            externalMetadata.explicit.push(...explicit);
            externalMetadata.implicitServer.push(...implicitServer);
            externalMetadata.implicitBrowser.push(...implicitBrowser);
            // The below needs to be sorted as Vite uses these options are part of the hashing invalidation algorithm.
            // See: https://github.com/vitejs/vite/blob/0873bae0cfe0f0718ad2f5743dd34a17e4ab563d/packages/vite/src/node/optimizer/index.ts#L1203-L1239
            externalMetadata.explicit.sort();
            externalMetadata.implicitServer.sort();
            externalMetadata.implicitBrowser.sort();
        }
        if (server) {
            handleUpdate(normalizePath, generatedFiles, server, serverOptions, context.logger);
        }
        else {
            const projectName = context.target?.project;
            if (!projectName) {
                throw new Error('The builder requires a target.');
            }
            const { root = '' } = await context.getProjectMetadata(projectName);
            const projectRoot = (0, node_path_1.join)(context.workspaceRoot, root);
            const browsers = (0, supported_browsers_1.getSupportedBrowsers)(projectRoot, context.logger);
            const target = (0, utils_1.transformSupportedBrowsersToTargets)(browsers);
            // Setup server and start listening
            const serverConfiguration = await setupServer(serverOptions, generatedFiles, assetFiles, browserOptions.preserveSymlinks, externalMetadata, !!browserOptions.ssr, prebundleTransformer, target, extensions?.middleware, transformers?.indexHtml);
            server = await createServer(serverConfiguration);
            await server.listen();
            if (serverConfiguration.ssr?.optimizeDeps?.disabled === false) {
                /**
                 * Vite will only start dependency optimization of SSR modules when the first request comes in.
                 * In some cases, this causes a long waiting time. To mitigate this, we call `ssrLoadModule` to
                 * initiate this process before the first request.
                 *
                 * NOTE: This will intentionally fail from the unknown module, but currently there is no other way
                 * to initiate the SSR dep optimizer.
                 */
                void server.ssrLoadModule('<deps-caller>').catch(() => { });
            }
            const urls = server.resolvedUrls;
            if (urls && (urls.local.length || urls.network.length)) {
                serverUrl = new URL(urls.local[0] ?? urls.network[0]);
            }
            // log connection information
            server.printUrls();
        }
        // TODO: adjust output typings to reflect both development servers
        yield {
            success: true,
            port: serverUrl?.port,
            baseUrl: serverUrl?.href,
        };
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
function handleUpdate(normalizePath, generatedFiles, server, serverOptions, logger) {
    const updatedFiles = [];
    // Invalidate any updated files
    for (const [file, record] of generatedFiles) {
        if (record.updated) {
            updatedFiles.push(file);
            const updatedModules = server.moduleGraph.getModulesByFile(normalizePath((0, node_path_1.join)(server.config.root, file)));
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
                updates: updatedFiles.map((filePath) => {
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
        const existingRecord = generatedFiles.get(filePath);
        if (existingRecord &&
            existingRecord.size === file.contents.byteLength &&
            existingRecord.hash === file.hash) {
            // Same file
            existingRecord.updated = false;
            continue;
        }
        // New or updated file
        generatedFiles.set(filePath, {
            contents: file.contents,
            size: file.contents.byteLength,
            hash: file.hash,
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
async function setupServer(serverOptions, outputFiles, assets, preserveSymlinks, externalMetadata, ssr, prebundleTransformer, target, extensionMiddleware, indexHtmlTransformer) {
    const proxy = await (0, load_proxy_config_1.loadProxyConfiguration)(serverOptions.workspaceRoot, serverOptions.proxyConfig, true);
    // dynamically import Vite for ESM compatibility
    const { normalizePath } = await Promise.resolve().then(() => __importStar(require('vite')));
    // Path will not exist on disk and only used to provide separate path for Vite requests
    const virtualProjectRoot = normalizePath((0, node_path_1.join)(serverOptions.workspaceRoot, `.angular/vite-root`, serverOptions.buildTarget.project));
    const serverExplicitExternal = [
        ...(await Promise.resolve().then(() => __importStar(require('node:module')))).builtinModules,
        ...externalMetadata.explicit,
    ];
    const configuration = {
        configFile: false,
        envFile: false,
        cacheDir: (0, node_path_1.join)(serverOptions.cacheOptions.path, 'vite'),
        root: virtualProjectRoot,
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
            // This is needed when `externalDependencies` is used to prevent Vite load errors.
            // NOTE: If Vite adds direct support for externals, this can be removed.
            preTransformRequests: externalMetadata.explicit.length === 0,
        },
        ssr: {
            // Note: `true` and `/.*/` have different sematics. When true, the `external` option is ignored.
            noExternal: /.*/,
            // Exclude any Node.js built in module and provided dependencies (currently build defined externals)
            external: serverExplicitExternal,
            optimizeDeps: getDepOptimizationConfig({
                /**
                 * *********************************************
                 * NOTE: Temporary disable 'optimizeDeps' for SSR.
                 * *********************************************
                 *
                 * Currently this causes a number of issues.
                 * - Deps are re-optimized everytime the server is started.
                 * - Added deps after a rebuild are not optimized.
                 * - Breaks RxJs (Unless it is added as external). See: https://github.com/angular/angular-cli/issues/26235
                 */
                // Only enable with caching since it causes prebundle dependencies to be cached
                disabled: true,
                // Exclude any explicitly defined dependencies (currently build defined externals and node.js built-ins)
                exclude: serverExplicitExternal,
                // Include all implict dependencies from the external packages internal option
                include: externalMetadata.implicitServer,
                ssr: true,
                prebundleTransformer,
                target,
            }),
        },
        plugins: [
            (0, i18n_locale_plugin_1.createAngularLocaleDataPlugin)(),
            {
                name: 'vite:angular-memory',
                // Ensures plugin hooks run before built-in Vite hooks
                enforce: 'pre',
                async resolveId(source, importer) {
                    // Prevent vite from resolving an explicit external dependency (`externalDependencies` option)
                    if (externalMetadata.explicit.includes(source)) {
                        // This is still not ideal since Vite will still transform the import specifier to
                        // `/@id/${source}` but is currently closer to a raw external than a resolved file path.
                        return source;
                    }
                    if (importer && source[0] === '.' && importer.startsWith(virtualProjectRoot)) {
                        // Remove query if present
                        const [importerFile] = importer.split('?', 1);
                        source =
                            '/' +
                                normalizePath((0, node_path_1.join)((0, node_path_1.dirname)((0, node_path_1.relative)(virtualProjectRoot, importerFile)), source));
                    }
                    const [file] = source.split('?', 1);
                    if (outputFiles.has(file)) {
                        return (0, node_path_1.join)(virtualProjectRoot, source);
                    }
                },
                load(id) {
                    const [file] = id.split('?', 1);
                    const relativeFile = '/' + normalizePath((0, node_path_1.relative)(virtualProjectRoot, file));
                    const codeContents = outputFiles.get(relativeFile)?.contents;
                    if (codeContents === undefined) {
                        if (relativeFile.endsWith('/node_modules/vite/dist/client/client.mjs')) {
                            return loadViteClientCode(file);
                        }
                        return;
                    }
                    const code = Buffer.from(codeContents).toString('utf-8');
                    const mapContents = outputFiles.get(relativeFile + '.map')?.contents;
                    return {
                        // Remove source map URL comments from the code if a sourcemap is present.
                        // Vite will inline and add an additional sourcemap URL for the sourcemap.
                        code: mapContents ? code.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, '') : code,
                        map: mapContents && Buffer.from(mapContents).toString('utf-8'),
                    };
                },
                configureServer(server) {
                    const originalssrTransform = server.ssrTransform;
                    server.ssrTransform = async (code, map, url, originalCode) => {
                        const result = await originalssrTransform(code, null, url, originalCode);
                        if (!result) {
                            return null;
                        }
                        let transformedCode = result.code;
                        if (result.map && map) {
                            transformedCode +=
                                `\n//# sourceMappingURL=` +
                                    `data:application/json;base64,${Buffer.from(JSON.stringify((0, remapping_1.default)([result.map, map], () => null))).toString('base64')}`;
                        }
                        return {
                            ...result,
                            map: null,
                            code: transformedCode,
                        };
                    };
                    // Assets and resources get handled first
                    server.middlewares.use(function angularAssetsMiddleware(req, res, next) {
                        if (req.url === undefined || res.writableEnded) {
                            return;
                        }
                        // Parse the incoming request.
                        // The base of the URL is unused but required to parse the URL.
                        const pathname = pathnameWithoutServePath(req.url, serverOptions);
                        const extension = (0, node_path_1.extname)(pathname);
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
                    if (extensionMiddleware?.length) {
                        extensionMiddleware.forEach((middleware) => server.middlewares.use(middleware));
                    }
                    // Returning a function, installs middleware after the main transform middleware but
                    // before the built-in HTML middleware
                    return () => {
                        function angularSSRMiddleware(req, res, next) {
                            const url = req.originalUrl;
                            if (
                            // Skip if path is not defined.
                            !url ||
                                // Skip if path is like a file.
                                // NOTE: We use a regexp to mitigate against matching requests like: /browse/pl.0ef59752c0cd457dbf1391f08cbd936f
                                /^\.[a-z]{2,4}$/i.test((0, node_path_1.extname)(url.split('?')[0]))) {
                                next();
                                return;
                            }
                            const rawHtml = outputFiles.get('/index.server.html')?.contents;
                            if (!rawHtml) {
                                next();
                                return;
                            }
                            transformIndexHtmlAndAddHeaders(url, rawHtml, res, next, async (html) => {
                                const protocol = serverOptions.ssl ? 'https' : 'http';
                                const route = `${protocol}://${req.headers.host}${req.originalUrl}`;
                                const { content } = await (0, render_page_1.renderPage)({
                                    document: html,
                                    route,
                                    serverContext: 'ssr',
                                    loadBundle: (uri) => 
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    server.ssrLoadModule(uri.slice(1)),
                                    // Files here are only needed for critical CSS inlining.
                                    outputFiles: {},
                                    // TODO: add support for critical css inlining.
                                    inlineCriticalCss: false,
                                });
                                return indexHtmlTransformer && content
                                    ? await indexHtmlTransformer(content)
                                    : content;
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
                                    transformIndexHtmlAndAddHeaders(req.url, rawHtml, res, next, indexHtmlTransformer);
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
        // Browser only optimizeDeps. (This does not run for SSR dependencies).
        optimizeDeps: getDepOptimizationConfig({
            // Only enable with caching since it causes prebundle dependencies to be cached
            disabled: !serverOptions.cacheOptions.enabled,
            // Exclude any explicitly defined dependencies (currently build defined externals)
            exclude: externalMetadata.explicit,
            // Include all implict dependencies from the external packages internal option
            include: externalMetadata.implicitBrowser,
            ssr: false,
            prebundleTransformer,
            target,
        }),
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
/**
 * Reads the resolved Vite client code from disk and updates the content to remove
 * an unactionable suggestion to update the Vite configuration file to disable the
 * error overlay. The Vite configuration file is not present when used in the Angular
 * CLI.
 * @param file The absolute path to the Vite client code.
 * @returns
 */
async function loadViteClientCode(file) {
    const originalContents = await (0, promises_1.readFile)(file, 'utf-8');
    let contents = originalContents.replace('You can also disable this overlay by setting', '');
    contents = contents.replace(
    // eslint-disable-next-line max-len
    '<code part="config-option-name">server.hmr.overlay</code> to <code part="config-option-value">false</code> in <code part="config-file-name">vite.config.js.</code>', '');
    (0, node_assert_1.default)(originalContents !== contents, 'Failed to update Vite client error overlay text.');
    return contents;
}
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
function getDepOptimizationConfig({ disabled, exclude, include, target, prebundleTransformer, ssr, }) {
    const plugins = [
        {
            name: `angular-vite-optimize-deps${ssr ? '-ssr' : ''}`,
            setup(build) {
                build.onLoad({ filter: /\.[cm]?js$/ }, async (args) => {
                    return {
                        contents: await prebundleTransformer.transformFile(args.path),
                        loader: 'js',
                    };
                });
            },
        },
    ];
    if (ssr) {
        plugins.unshift((0, rxjs_esm_resolution_plugin_1.createRxjsEsmResolutionPlugin)());
    }
    return {
        // Only enable with caching since it causes prebundle dependencies to be cached
        disabled,
        // Exclude any explicitly defined dependencies (currently build defined externals)
        exclude,
        // Include all implict dependencies from the external packages internal option
        include,
        // Add an esbuild plugin to run the Angular linker on dependencies
        esbuildOptions: {
            // Set esbuild supported targets.
            target,
            supported: (0, utils_1.getFeatureSupport)(target),
            plugins,
        },
    };
}
