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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildServePath = exports.getDevServerConfig = void 0;
const core_1 = require("@angular-devkit/core");
const fs_1 = require("fs");
const path_1 = require("path");
const url_1 = require("url");
const error_1 = require("../../utils/error");
const load_esm_1 = require("../../utils/load-esm");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const hmr_loader_1 = require("../plugins/hmr/hmr-loader");
async function getDevServerConfig(wco) {
    const { buildOptions: { host, port, index, headers, watch, hmr, main, liveReload, proxyConfig }, logger, root, } = wco;
    const servePath = buildServePath(wco.buildOptions, logger);
    const extraRules = [];
    if (hmr) {
        extraRules.push({
            loader: hmr_loader_1.HmrLoader,
            include: [main].map((p) => (0, path_1.resolve)(wco.root, p)),
        });
    }
    const extraPlugins = [];
    if (!watch) {
        // There's no option to turn off file watching in webpack-dev-server, but
        // we can override the file watcher instead.
        extraPlugins.push({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            apply: (compiler) => {
                compiler.hooks.afterEnvironment.tap('angular-cli', () => {
                    // eslint-disable-next-line @typescript-eslint/no-empty-function
                    compiler.watchFileSystem = { watch: () => { } };
                });
            },
        });
    }
    return {
        plugins: extraPlugins,
        module: {
            rules: extraRules,
        },
        devServer: {
            host,
            port,
            headers: {
                'Access-Control-Allow-Origin': '*',
                ...headers,
            },
            historyApiFallback: !!index && {
                index: path_1.posix.join(servePath, (0, webpack_browser_config_1.getIndexOutputFile)(index)),
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
                rewrites: [
                    {
                        from: new RegExp(`^(?!${servePath})/.*`),
                        to: (context) => context.parsedUrl.href,
                    },
                ],
            },
            // When setupExitSignals is enabled webpack-dev-server will shutdown gracefully which would
            // require CTRL+C to be pressed multiple times to exit.
            // See: https://github.com/webpack/webpack-dev-server/blob/c76b6d11a3821436c5e20207c8a38deb6ab7e33c/lib/Server.js#L1801-L1827
            setupExitSignals: false,
            compress: false,
            static: false,
            server: getServerConfig(root, wco.buildOptions),
            allowedHosts: getAllowedHostsConfig(wco.buildOptions),
            devMiddleware: {
                publicPath: servePath,
                stats: false,
            },
            setupMiddlewares: (middlewares, _devServer) => {
                // Temporary workaround for https://github.com/webpack/webpack-dev-server/issues/4180
                middlewares.push({
                    name: 'options-request-response',
                    path: '*',
                    middleware: (req, res, next) => {
                        if (req.method === 'OPTIONS') {
                            res.statusCode = 204;
                            res.setHeader('Content-Length', 0);
                            res.end();
                            return;
                        }
                        next();
                    },
                });
                return middlewares;
            },
            liveReload,
            hot: hmr && !liveReload ? 'only' : hmr,
            proxy: await addProxyConfig(root, proxyConfig),
            ...getWebSocketSettings(wco.buildOptions, servePath),
        },
    };
}
exports.getDevServerConfig = getDevServerConfig;
/**
 * Resolve and build a URL _path_ that will be the root of the server. This resolved base href and
 * deploy URL from the browser options and returns a path from the root.
 */
function buildServePath(options, logger) {
    let servePath = options.servePath;
    if (servePath === undefined) {
        const defaultPath = findDefaultServePath(options.baseHref, options.deployUrl);
        if (defaultPath == null) {
            logger.warn(core_1.tags.oneLine `
        Warning: --deploy-url and/or --base-href contain unsupported values for ng serve. Default
        serve path of '/' used. Use --serve-path to override.
      `);
        }
        servePath = defaultPath || '';
    }
    if (servePath.endsWith('/')) {
        servePath = servePath.slice(0, -1);
    }
    if (!servePath.startsWith('/')) {
        servePath = `/${servePath}`;
    }
    return servePath;
}
exports.buildServePath = buildServePath;
/**
 * Private method to enhance a webpack config with SSL configuration.
 * @private
 */
function getServerConfig(root, options) {
    const { ssl, sslCert, sslKey } = options;
    if (!ssl) {
        return 'http';
    }
    return {
        type: 'https',
        options: sslCert && sslKey
            ? {
                key: (0, path_1.resolve)(root, sslKey),
                cert: (0, path_1.resolve)(root, sslCert),
            }
            : undefined,
    };
}
/**
 * Private method to enhance a webpack config with Proxy configuration.
 * @private
 */
async function addProxyConfig(root, proxyConfig) {
    if (!proxyConfig) {
        return undefined;
    }
    const proxyPath = (0, path_1.resolve)(root, proxyConfig);
    if (!(0, fs_1.existsSync)(proxyPath)) {
        throw new Error(`Proxy configuration file ${proxyPath} does not exist.`);
    }
    switch ((0, path_1.extname)(proxyPath)) {
        case '.json': {
            const content = await fs_1.promises.readFile(proxyPath, 'utf-8');
            const { parse, printParseErrorCode } = await Promise.resolve().then(() => __importStar(require('jsonc-parser')));
            const parseErrors = [];
            const proxyConfiguration = parse(content, parseErrors, { allowTrailingComma: true });
            if (parseErrors.length > 0) {
                let errorMessage = `Proxy configuration file ${proxyPath} contains parse errors:`;
                for (const parseError of parseErrors) {
                    const { line, column } = getJsonErrorLineColumn(parseError.offset, content);
                    errorMessage += `\n[${line}, ${column}] ${printParseErrorCode(parseError.error)}`;
                }
                throw new Error(errorMessage);
            }
            return proxyConfiguration;
        }
        case '.mjs':
            // Load the ESM configuration file using the TypeScript dynamic import workaround.
            // Once TypeScript provides support for keeping the dynamic import this workaround can be
            // changed to a direct dynamic import.
            return (await (0, load_esm_1.loadEsmModule)((0, url_1.pathToFileURL)(proxyPath))).default;
        case '.cjs':
            return require(proxyPath);
        default:
            // The file could be either CommonJS or ESM.
            // CommonJS is tried first then ESM if loading fails.
            try {
                return require(proxyPath);
            }
            catch (e) {
                (0, error_1.assertIsError)(e);
                if (e.code === 'ERR_REQUIRE_ESM') {
                    // Load the ESM configuration file using the TypeScript dynamic import workaround.
                    // Once TypeScript provides support for keeping the dynamic import this workaround can be
                    // changed to a direct dynamic import.
                    return (await (0, load_esm_1.loadEsmModule)((0, url_1.pathToFileURL)(proxyPath))).default;
                }
                throw e;
            }
    }
}
/**
 * Calculates the line and column for an error offset in the content of a JSON file.
 * @param location The offset error location from the beginning of the content.
 * @param content The full content of the file containing the error.
 * @returns An object containing the line and column
 */
function getJsonErrorLineColumn(offset, content) {
    if (offset === 0) {
        return { line: 1, column: 1 };
    }
    let line = 0;
    let position = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        ++line;
        const nextNewline = content.indexOf('\n', position);
        if (nextNewline === -1 || nextNewline > offset) {
            break;
        }
        position = nextNewline + 1;
    }
    return { line, column: offset - position + 1 };
}
/**
 * Find the default server path. We don't want to expose baseHref and deployUrl as arguments, only
 * the browser options where needed. This method should stay private (people who want to resolve
 * baseHref and deployUrl should use the buildServePath exported function.
 * @private
 */
function findDefaultServePath(baseHref, deployUrl) {
    if (!baseHref && !deployUrl) {
        return '';
    }
    if (/^(\w+:)?\/\//.test(baseHref || '') || /^(\w+:)?\/\//.test(deployUrl || '')) {
        // If baseHref or deployUrl is absolute, unsupported by ng serve
        return null;
    }
    // normalize baseHref
    // for ng serve the starting base is always `/` so a relative
    // and root relative value are identical
    const baseHrefParts = (baseHref || '').split('/').filter((part) => part !== '');
    if (baseHref && !baseHref.endsWith('/')) {
        baseHrefParts.pop();
    }
    const normalizedBaseHref = baseHrefParts.length === 0 ? '/' : `/${baseHrefParts.join('/')}/`;
    if (deployUrl && deployUrl[0] === '/') {
        if (baseHref && baseHref[0] === '/' && normalizedBaseHref !== deployUrl) {
            // If baseHref and deployUrl are root relative and not equivalent, unsupported by ng serve
            return null;
        }
        return deployUrl;
    }
    // Join together baseHref and deployUrl
    return `${normalizedBaseHref}${deployUrl || ''}`;
}
function getAllowedHostsConfig(options) {
    var _a;
    if (options.disableHostCheck) {
        return 'all';
    }
    else if ((_a = options.allowedHosts) === null || _a === void 0 ? void 0 : _a.length) {
        return options.allowedHosts;
    }
    return undefined;
}
function getWebSocketSettings(options, servePath) {
    const { hmr, liveReload } = options;
    if (!hmr && !liveReload) {
        return {
            webSocketServer: false,
            client: undefined,
        };
    }
    const webSocketPath = path_1.posix.join(servePath, 'ng-cli-ws');
    return {
        webSocketServer: {
            options: {
                path: webSocketPath,
            },
        },
        client: {
            logging: 'info',
            webSocketURL: getPublicHostOptions(options, webSocketPath),
            overlay: {
                errors: true,
                warnings: false,
            },
        },
    };
}
function getPublicHostOptions(options, webSocketPath) {
    let publicHost = options.publicHost;
    if (publicHost) {
        const hostWithProtocol = !/^\w+:\/\//.test(publicHost) ? `https://${publicHost}` : publicHost;
        publicHost = new url_1.URL(hostWithProtocol).host;
    }
    return `auto://${publicHost || '0.0.0.0:0'}${webSocketPath}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2LXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svY29uZmlncy9kZXYtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsK0NBQXFEO0FBQ3JELDJCQUF3RDtBQUN4RCwrQkFBK0M7QUFDL0MsNkJBQXlDO0FBU3pDLDZDQUFrRDtBQUNsRCxtREFBcUQ7QUFDckQsK0VBQXdFO0FBQ3hFLDBEQUFzRDtBQUUvQyxLQUFLLFVBQVUsa0JBQWtCLENBQ3RDLEdBQWtEO0lBRWxELE1BQU0sRUFDSixZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxFQUN2RixNQUFNLEVBQ04sSUFBSSxHQUNMLEdBQUcsR0FBRyxDQUFDO0lBRVIsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFM0QsTUFBTSxVQUFVLEdBQWtCLEVBQUUsQ0FBQztJQUNyQyxJQUFJLEdBQUcsRUFBRTtRQUNQLFVBQVUsQ0FBQyxJQUFJLENBQUM7WUFDZCxNQUFNLEVBQUUsc0JBQVM7WUFDakIsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFBLGNBQU8sRUFBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1NBQ2pELENBQUMsQ0FBQztLQUNKO0lBRUQsTUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDO0lBQ3hCLElBQUksQ0FBQyxLQUFLLEVBQUU7UUFDVix5RUFB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QU07WUFDZixZQUFZLEVBQUUsb0JBQW9CLENBQUMsT0FBTyxFQUFFLGFBQWEsQ0FBQztZQUMxRCxPQUFPLEVBQUU7Z0JBQ1AsTUFBTSxFQUFFLElBQUk7Z0JBQ1osUUFBUSxFQUFFLEtBQUs7YUFDaEI7U0FDRjtLQUNGLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyxvQkFBb0IsQ0FBQyxPQUFnQyxFQUFFLGFBQXFCO0lBQ25GLElBQUksVUFBVSxHQUE4QixPQUFPLENBQUMsVUFBVSxDQUFDO0lBQy9ELElBQUksVUFBVSxFQUFFO1FBQ2QsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQztRQUM5RixVQUFVLEdBQUcsSUFBSSxTQUFHLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxJQUFJLENBQUM7S0FDN0M7SUFFRCxPQUFPLFVBQVUsVUFBVSxJQUFJLFdBQVcsR0FBRyxhQUFhLEVBQUUsQ0FBQztBQUMvRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IGxvZ2dpbmcsIHRhZ3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBleGlzdHNTeW5jLCBwcm9taXNlcyBhcyBmc1Byb21pc2VzIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgcG9zaXgsIHJlc29sdmUgfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IFVSTCwgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uLCBSdWxlU2V0UnVsZSB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHR5cGUge1xuICBDb25maWd1cmF0aW9uIGFzIERldlNlcnZlckNvbmZpZ3VyYXRpb24sXG4gIE5leHRGdW5jdGlvbixcbiAgUmVxdWVzdCxcbiAgUmVzcG9uc2UsXG59IGZyb20gJ3dlYnBhY2stZGV2LXNlcnZlcic7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucywgV2VicGFja0RldlNlcnZlck9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHsgZ2V0SW5kZXhPdXRwdXRGaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBIbXJMb2FkZXIgfSBmcm9tICcuLi9wbHVnaW5zL2htci9obXItbG9hZGVyJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldERldlNlcnZlckNvbmZpZyhcbiAgd2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9uczxXZWJwYWNrRGV2U2VydmVyT3B0aW9ucz4sXG4pOiBQcm9taXNlPENvbmZpZ3VyYXRpb24+IHtcbiAgY29uc3Qge1xuICAgIGJ1aWxkT3B0aW9uczogeyBob3N0LCBwb3J0LCBpbmRleCwgaGVhZGVycywgd2F0Y2gsIGhtciwgbWFpbiwgbGl2ZVJlbG9hZCwgcHJveHlDb25maWcgfSxcbiAgICBsb2dnZXIsXG4gICAgcm9vdCxcbiAgfSA9IHdjbztcblxuICBjb25zdCBzZXJ2ZVBhdGggPSBidWlsZFNlcnZlUGF0aCh3Y28uYnVpbGRPcHRpb25zLCBsb2dnZXIpO1xuXG4gIGNvbnN0IGV4dHJhUnVsZXM6IFJ1bGVTZXRSdWxlW10gPSBbXTtcbiAgaWYgKGhtcikge1xuICAgIGV4dHJhUnVsZXMucHVzaCh7XG4gICAgICBsb2FkZXI6IEhtckxvYWRlcixcbiAgICAgIGluY2x1ZGU6IFttYWluXS5tYXAoKHApID0+IHJlc29sdmUod2NvLnJvb3QsIHApKSxcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IGV4dHJhUGx1Z2lucyA9IFtdO1xuICBpZiAoIXdhdGNoKSB7XG4gICAgLy8gVGhlcmUncyBubyBvcHRpb24gdG8gdHVybiBvZmYgZmlsZSB3YXRjaGluZyBpbiB3ZWJwYWNrLWRldi1zZXJ2ZXIsIGJ1dFxuICAgIC8vIHdlIGNhbiBvdmVycmlkZSB0aGUgZmlsZSB3YXRjaGVyIGluc3RlYWQuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goe1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIGFwcGx5OiAoY29tcGlsZXI6IGFueSkgPT4ge1xuICAgICAgICBjb21waWxlci5ob29rcy5hZnRlckVudmlyb25tZW50LnRhcCgnYW5ndWxhci1jbGknLCAoKSA9PiB7XG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1lbXB0eS1mdW5jdGlvblxuICAgICAgICAgIGNvbXBpbGVyLndhdGNoRmlsZVN5c3RlbSA9IHsgd2F0Y2g6ICgpID0+IHt9IH07XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLFxuICAgIG1vZHVsZToge1xuICAgICAgcnVsZXM6IGV4dHJhUnVsZXMsXG4gICAgfSxcbiAgICBkZXZTZXJ2ZXI6IHtcbiAgICAgIGhvc3QsXG4gICAgICBwb3J0LFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxuICAgICAgICAuLi5oZWFkZXJzLFxuICAgICAgfSxcbiAgICAgIGhpc3RvcnlBcGlGYWxsYmFjazogISFpbmRleCAmJiB7XG4gICAgICAgIGluZGV4OiBwb3NpeC5qb2luKHNlcnZlUGF0aCwgZ2V0SW5kZXhPdXRwdXRGaWxlKGluZGV4KSksXG4gICAgICAgIGRpc2FibGVEb3RSdWxlOiB0cnVlLFxuICAgICAgICBodG1sQWNjZXB0SGVhZGVyczogWyd0ZXh0L2h0bWwnLCAnYXBwbGljYXRpb24veGh0bWwreG1sJ10sXG4gICAgICAgIHJld3JpdGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgZnJvbTogbmV3IFJlZ0V4cChgXig/ISR7c2VydmVQYXRofSkvLipgKSxcbiAgICAgICAgICAgIHRvOiAoY29udGV4dCkgPT4gY29udGV4dC5wYXJzZWRVcmwuaHJlZixcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIC8vIFdoZW4gc2V0dXBFeGl0U2lnbmFscyBpcyBlbmFibGVkIHdlYnBhY2stZGV2LXNlcnZlciB3aWxsIHNodXRkb3duIGdyYWNlZnVsbHkgd2hpY2ggd291bGRcbiAgICAgIC8vIHJlcXVpcmUgQ1RSTCtDIHRvIGJlIHByZXNzZWQgbXVsdGlwbGUgdGltZXMgdG8gZXhpdC5cbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay1kZXYtc2VydmVyL2Jsb2IvYzc2YjZkMTFhMzgyMTQzNmM1ZTIwMjA3YzhhMzhkZWI2YWI3ZTMzYy9saWIvU2VydmVyLmpzI0wxODAxLUwxODI3XG4gICAgICBzZXR1cEV4aXRTaWduYWxzOiBmYWxzZSxcbiAgICAgIGNvbXByZXNzOiBmYWxzZSxcbiAgICAgIHN0YXRpYzogZmFsc2UsXG4gICAgICBzZXJ2ZXI6IGdldFNlcnZlckNvbmZpZyhyb290LCB3Y28uYnVpbGRPcHRpb25zKSxcbiAgICAgIGFsbG93ZWRIb3N0czogZ2V0QWxsb3dlZEhvc3RzQ29uZmlnKHdjby5idWlsZE9wdGlvbnMpLFxuICAgICAgZGV2TWlkZGxld2FyZToge1xuICAgICAgICBwdWJsaWNQYXRoOiBzZXJ2ZVBhdGgsXG4gICAgICAgIHN0YXRzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBzZXR1cE1pZGRsZXdhcmVzOiAobWlkZGxld2FyZXMsIF9kZXZTZXJ2ZXIpID0+IHtcbiAgICAgICAgLy8gVGVtcG9yYXJ5IHdvcmthcm91bmQgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LXNlcnZlci9pc3N1ZXMvNDE4MFxuICAgICAgICBtaWRkbGV3YXJlcy5wdXNoKHtcbiAgICAgICAgICBuYW1lOiAnb3B0aW9ucy1yZXF1ZXN0LXJlc3BvbnNlJyxcbiAgICAgICAgICBwYXRoOiAnKicsXG4gICAgICAgICAgbWlkZGxld2FyZTogKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ09QVElPTlMnKSB7XG4gICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjA0O1xuICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LUxlbmd0aCcsIDApO1xuICAgICAgICAgICAgICByZXMuZW5kKCk7XG5cbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIG1pZGRsZXdhcmVzO1xuICAgICAgfSxcbiAgICAgIGxpdmVSZWxvYWQsXG4gICAgICBob3Q6IGhtciAmJiAhbGl2ZVJlbG9hZCA/ICdvbmx5JyA6IGhtcixcbiAgICAgIHByb3h5OiBhd2FpdCBhZGRQcm94eUNvbmZpZyhyb290LCBwcm94eUNvbmZpZyksXG4gICAgICAuLi5nZXRXZWJTb2NrZXRTZXR0aW5ncyh3Y28uYnVpbGRPcHRpb25zLCBzZXJ2ZVBhdGgpLFxuICAgIH0sXG4gIH07XG59XG5cbi8qKlxuICogUmVzb2x2ZSBhbmQgYnVpbGQgYSBVUkwgX3BhdGhfIHRoYXQgd2lsbCBiZSB0aGUgcm9vdCBvZiB0aGUgc2VydmVyLiBUaGlzIHJlc29sdmVkIGJhc2UgaHJlZiBhbmRcbiAqIGRlcGxveSBVUkwgZnJvbSB0aGUgYnJvd3NlciBvcHRpb25zIGFuZCByZXR1cm5zIGEgcGF0aCBmcm9tIHRoZSByb290LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRTZXJ2ZVBhdGgoXG4gIG9wdGlvbnM6IFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zLFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuKTogc3RyaW5nIHtcbiAgbGV0IHNlcnZlUGF0aCA9IG9wdGlvbnMuc2VydmVQYXRoO1xuICBpZiAoc2VydmVQYXRoID09PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBkZWZhdWx0UGF0aCA9IGZpbmREZWZhdWx0U2VydmVQYXRoKG9wdGlvbnMuYmFzZUhyZWYsIG9wdGlvbnMuZGVwbG95VXJsKTtcbiAgICBpZiAoZGVmYXVsdFBhdGggPT0gbnVsbCkge1xuICAgICAgbG9nZ2VyLndhcm4odGFncy5vbmVMaW5lYFxuICAgICAgICBXYXJuaW5nOiAtLWRlcGxveS11cmwgYW5kL29yIC0tYmFzZS1ocmVmIGNvbnRhaW4gdW5zdXBwb3J0ZWQgdmFsdWVzIGZvciBuZyBzZXJ2ZS4gRGVmYXVsdFxuICAgICAgICBzZXJ2ZSBwYXRoIG9mICcvJyB1c2VkLiBVc2UgLS1zZXJ2ZS1wYXRoIHRvIG92ZXJyaWRlLlxuICAgICAgYCk7XG4gICAgfVxuICAgIHNlcnZlUGF0aCA9IGRlZmF1bHRQYXRoIHx8ICcnO1xuICB9XG5cbiAgaWYgKHNlcnZlUGF0aC5lbmRzV2l0aCgnLycpKSB7XG4gICAgc2VydmVQYXRoID0gc2VydmVQYXRoLnNsaWNlKDAsIC0xKTtcbiAgfVxuXG4gIGlmICghc2VydmVQYXRoLnN0YXJ0c1dpdGgoJy8nKSkge1xuICAgIHNlcnZlUGF0aCA9IGAvJHtzZXJ2ZVBhdGh9YDtcbiAgfVxuXG4gIHJldHVybiBzZXJ2ZVBhdGg7XG59XG5cbi8qKlxuICogUHJpdmF0ZSBtZXRob2QgdG8gZW5oYW5jZSBhIHdlYnBhY2sgY29uZmlnIHdpdGggU1NMIGNvbmZpZ3VyYXRpb24uXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBnZXRTZXJ2ZXJDb25maWcoXG4gIHJvb3Q6IHN0cmluZyxcbiAgb3B0aW9uczogV2VicGFja0RldlNlcnZlck9wdGlvbnMsXG4pOiBEZXZTZXJ2ZXJDb25maWd1cmF0aW9uWydzZXJ2ZXInXSB7XG4gIGNvbnN0IHsgc3NsLCBzc2xDZXJ0LCBzc2xLZXkgfSA9IG9wdGlvbnM7XG4gIGlmICghc3NsKSB7XG4gICAgcmV0dXJuICdodHRwJztcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgdHlwZTogJ2h0dHBzJyxcbiAgICBvcHRpb25zOlxuICAgICAgc3NsQ2VydCAmJiBzc2xLZXlcbiAgICAgICAgPyB7XG4gICAgICAgICAgICBrZXk6IHJlc29sdmUocm9vdCwgc3NsS2V5KSxcbiAgICAgICAgICAgIGNlcnQ6IHJlc29sdmUocm9vdCwgc3NsQ2VydCksXG4gICAgICAgICAgfVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgfTtcbn1cblxuLyoqXG4gKiBQcml2YXRlIG1ldGhvZCB0byBlbmhhbmNlIGEgd2VicGFjayBjb25maWcgd2l0aCBQcm94eSBjb25maWd1cmF0aW9uLlxuICogQHByaXZhdGVcbiAqL1xuYXN5bmMgZnVuY3Rpb24gYWRkUHJveHlDb25maWcocm9vdDogc3RyaW5nLCBwcm94eUNvbmZpZzogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG4gIGlmICghcHJveHlDb25maWcpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgY29uc3QgcHJveHlQYXRoID0gcmVzb2x2ZShyb290LCBwcm94eUNvbmZpZyk7XG5cbiAgaWYgKCFleGlzdHNTeW5jKHByb3h5UGF0aCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3h5IGNvbmZpZ3VyYXRpb24gZmlsZSAke3Byb3h5UGF0aH0gZG9lcyBub3QgZXhpc3QuYCk7XG4gIH1cblxuICBzd2l0Y2ggKGV4dG5hbWUocHJveHlQYXRoKSkge1xuICAgIGNhc2UgJy5qc29uJzoge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzUHJvbWlzZXMucmVhZEZpbGUocHJveHlQYXRoLCAndXRmLTgnKTtcblxuICAgICAgY29uc3QgeyBwYXJzZSwgcHJpbnRQYXJzZUVycm9yQ29kZSB9ID0gYXdhaXQgaW1wb3J0KCdqc29uYy1wYXJzZXInKTtcbiAgICAgIGNvbnN0IHBhcnNlRXJyb3JzOiBpbXBvcnQoJ2pzb25jLXBhcnNlcicpLlBhcnNlRXJyb3JbXSA9IFtdO1xuICAgICAgY29uc3QgcHJveHlDb25maWd1cmF0aW9uID0gcGFyc2UoY29udGVudCwgcGFyc2VFcnJvcnMsIHsgYWxsb3dUcmFpbGluZ0NvbW1hOiB0cnVlIH0pO1xuXG4gICAgICBpZiAocGFyc2VFcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgICBsZXQgZXJyb3JNZXNzYWdlID0gYFByb3h5IGNvbmZpZ3VyYXRpb24gZmlsZSAke3Byb3h5UGF0aH0gY29udGFpbnMgcGFyc2UgZXJyb3JzOmA7XG4gICAgICAgIGZvciAoY29uc3QgcGFyc2VFcnJvciBvZiBwYXJzZUVycm9ycykge1xuICAgICAgICAgIGNvbnN0IHsgbGluZSwgY29sdW1uIH0gPSBnZXRKc29uRXJyb3JMaW5lQ29sdW1uKHBhcnNlRXJyb3Iub2Zmc2V0LCBjb250ZW50KTtcbiAgICAgICAgICBlcnJvck1lc3NhZ2UgKz0gYFxcblske2xpbmV9LCAke2NvbHVtbn1dICR7cHJpbnRQYXJzZUVycm9yQ29kZShwYXJzZUVycm9yLmVycm9yKX1gO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvck1lc3NhZ2UpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcHJveHlDb25maWd1cmF0aW9uO1xuICAgIH1cbiAgICBjYXNlICcubWpzJzpcbiAgICAgIC8vIExvYWQgdGhlIEVTTSBjb25maWd1cmF0aW9uIGZpbGUgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgICAgcmV0dXJuIChhd2FpdCBsb2FkRXNtTW9kdWxlPHsgZGVmYXVsdDogdW5rbm93biB9PihwYXRoVG9GaWxlVVJMKHByb3h5UGF0aCkpKS5kZWZhdWx0O1xuICAgIGNhc2UgJy5janMnOlxuICAgICAgcmV0dXJuIHJlcXVpcmUocHJveHlQYXRoKTtcbiAgICBkZWZhdWx0OlxuICAgICAgLy8gVGhlIGZpbGUgY291bGQgYmUgZWl0aGVyIENvbW1vbkpTIG9yIEVTTS5cbiAgICAgIC8vIENvbW1vbkpTIGlzIHRyaWVkIGZpcnN0IHRoZW4gRVNNIGlmIGxvYWRpbmcgZmFpbHMuXG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gcmVxdWlyZShwcm94eVBhdGgpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBhc3NlcnRJc0Vycm9yKGUpO1xuICAgICAgICBpZiAoZS5jb2RlID09PSAnRVJSX1JFUVVJUkVfRVNNJykge1xuICAgICAgICAgIC8vIExvYWQgdGhlIEVTTSBjb25maWd1cmF0aW9uIGZpbGUgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgICAgICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAgICAgICAgIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gICAgICAgICAgcmV0dXJuIChhd2FpdCBsb2FkRXNtTW9kdWxlPHsgZGVmYXVsdDogdW5rbm93biB9PihwYXRoVG9GaWxlVVJMKHByb3h5UGF0aCkpKS5kZWZhdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENhbGN1bGF0ZXMgdGhlIGxpbmUgYW5kIGNvbHVtbiBmb3IgYW4gZXJyb3Igb2Zmc2V0IGluIHRoZSBjb250ZW50IG9mIGEgSlNPTiBmaWxlLlxuICogQHBhcmFtIGxvY2F0aW9uIFRoZSBvZmZzZXQgZXJyb3IgbG9jYXRpb24gZnJvbSB0aGUgYmVnaW5uaW5nIG9mIHRoZSBjb250ZW50LlxuICogQHBhcmFtIGNvbnRlbnQgVGhlIGZ1bGwgY29udGVudCBvZiB0aGUgZmlsZSBjb250YWluaW5nIHRoZSBlcnJvci5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBsaW5lIGFuZCBjb2x1bW5cbiAqL1xuZnVuY3Rpb24gZ2V0SnNvbkVycm9yTGluZUNvbHVtbihvZmZzZXQ6IG51bWJlciwgY29udGVudDogc3RyaW5nKSB7XG4gIGlmIChvZmZzZXQgPT09IDApIHtcbiAgICByZXR1cm4geyBsaW5lOiAxLCBjb2x1bW46IDEgfTtcbiAgfVxuXG4gIGxldCBsaW5lID0gMDtcbiAgbGV0IHBvc2l0aW9uID0gMDtcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnN0YW50LWNvbmRpdGlvblxuICB3aGlsZSAodHJ1ZSkge1xuICAgICsrbGluZTtcblxuICAgIGNvbnN0IG5leHROZXdsaW5lID0gY29udGVudC5pbmRleE9mKCdcXG4nLCBwb3NpdGlvbik7XG4gICAgaWYgKG5leHROZXdsaW5lID09PSAtMSB8fCBuZXh0TmV3bGluZSA+IG9mZnNldCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgcG9zaXRpb24gPSBuZXh0TmV3bGluZSArIDE7XG4gIH1cblxuICByZXR1cm4geyBsaW5lLCBjb2x1bW46IG9mZnNldCAtIHBvc2l0aW9uICsgMSB9O1xufVxuXG4vKipcbiAqIEZpbmQgdGhlIGRlZmF1bHQgc2VydmVyIHBhdGguIFdlIGRvbid0IHdhbnQgdG8gZXhwb3NlIGJhc2VIcmVmIGFuZCBkZXBsb3lVcmwgYXMgYXJndW1lbnRzLCBvbmx5XG4gKiB0aGUgYnJvd3NlciBvcHRpb25zIHdoZXJlIG5lZWRlZC4gVGhpcyBtZXRob2Qgc2hvdWxkIHN0YXkgcHJpdmF0ZSAocGVvcGxlIHdobyB3YW50IHRvIHJlc29sdmVcbiAqIGJhc2VIcmVmIGFuZCBkZXBsb3lVcmwgc2hvdWxkIHVzZSB0aGUgYnVpbGRTZXJ2ZVBhdGggZXhwb3J0ZWQgZnVuY3Rpb24uXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBmaW5kRGVmYXVsdFNlcnZlUGF0aChiYXNlSHJlZj86IHN0cmluZywgZGVwbG95VXJsPzogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gIGlmICghYmFzZUhyZWYgJiYgIWRlcGxveVVybCkge1xuICAgIHJldHVybiAnJztcbiAgfVxuXG4gIGlmICgvXihcXHcrOik/XFwvXFwvLy50ZXN0KGJhc2VIcmVmIHx8ICcnKSB8fCAvXihcXHcrOik/XFwvXFwvLy50ZXN0KGRlcGxveVVybCB8fCAnJykpIHtcbiAgICAvLyBJZiBiYXNlSHJlZiBvciBkZXBsb3lVcmwgaXMgYWJzb2x1dGUsIHVuc3VwcG9ydGVkIGJ5IG5nIHNlcnZlXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBub3JtYWxpemUgYmFzZUhyZWZcbiAgLy8gZm9yIG5nIHNlcnZlIHRoZSBzdGFydGluZyBiYXNlIGlzIGFsd2F5cyBgL2Agc28gYSByZWxhdGl2ZVxuICAvLyBhbmQgcm9vdCByZWxhdGl2ZSB2YWx1ZSBhcmUgaWRlbnRpY2FsXG4gIGNvbnN0IGJhc2VIcmVmUGFydHMgPSAoYmFzZUhyZWYgfHwgJycpLnNwbGl0KCcvJykuZmlsdGVyKChwYXJ0KSA9PiBwYXJ0ICE9PSAnJyk7XG4gIGlmIChiYXNlSHJlZiAmJiAhYmFzZUhyZWYuZW5kc1dpdGgoJy8nKSkge1xuICAgIGJhc2VIcmVmUGFydHMucG9wKCk7XG4gIH1cbiAgY29uc3Qgbm9ybWFsaXplZEJhc2VIcmVmID0gYmFzZUhyZWZQYXJ0cy5sZW5ndGggPT09IDAgPyAnLycgOiBgLyR7YmFzZUhyZWZQYXJ0cy5qb2luKCcvJyl9L2A7XG5cbiAgaWYgKGRlcGxveVVybCAmJiBkZXBsb3lVcmxbMF0gPT09ICcvJykge1xuICAgIGlmIChiYXNlSHJlZiAmJiBiYXNlSHJlZlswXSA9PT0gJy8nICYmIG5vcm1hbGl6ZWRCYXNlSHJlZiAhPT0gZGVwbG95VXJsKSB7XG4gICAgICAvLyBJZiBiYXNlSHJlZiBhbmQgZGVwbG95VXJsIGFyZSByb290IHJlbGF0aXZlIGFuZCBub3QgZXF1aXZhbGVudCwgdW5zdXBwb3J0ZWQgYnkgbmcgc2VydmVcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBkZXBsb3lVcmw7XG4gIH1cblxuICAvLyBKb2luIHRvZ2V0aGVyIGJhc2VIcmVmIGFuZCBkZXBsb3lVcmxcbiAgcmV0dXJuIGAke25vcm1hbGl6ZWRCYXNlSHJlZn0ke2RlcGxveVVybCB8fCAnJ31gO1xufVxuXG5mdW5jdGlvbiBnZXRBbGxvd2VkSG9zdHNDb25maWcoXG4gIG9wdGlvbnM6IFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zLFxuKTogRGV2U2VydmVyQ29uZmlndXJhdGlvblsnYWxsb3dlZEhvc3RzJ10ge1xuICBpZiAob3B0aW9ucy5kaXNhYmxlSG9zdENoZWNrKSB7XG4gICAgcmV0dXJuICdhbGwnO1xuICB9IGVsc2UgaWYgKG9wdGlvbnMuYWxsb3dlZEhvc3RzPy5sZW5ndGgpIHtcbiAgICByZXR1cm4gb3B0aW9ucy5hbGxvd2VkSG9zdHM7XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBnZXRXZWJTb2NrZXRTZXR0aW5ncyhcbiAgb3B0aW9uczogV2VicGFja0RldlNlcnZlck9wdGlvbnMsXG4gIHNlcnZlUGF0aDogc3RyaW5nLFxuKToge1xuICB3ZWJTb2NrZXRTZXJ2ZXI/OiBEZXZTZXJ2ZXJDb25maWd1cmF0aW9uWyd3ZWJTb2NrZXRTZXJ2ZXInXTtcbiAgY2xpZW50PzogRGV2U2VydmVyQ29uZmlndXJhdGlvblsnY2xpZW50J107XG59IHtcbiAgY29uc3QgeyBobXIsIGxpdmVSZWxvYWQgfSA9IG9wdGlvbnM7XG4gIGlmICghaG1yICYmICFsaXZlUmVsb2FkKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHdlYlNvY2tldFNlcnZlcjogZmFsc2UsXG4gICAgICBjbGllbnQ6IHVuZGVmaW5lZCxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgd2ViU29ja2V0UGF0aCA9IHBvc2l4LmpvaW4oc2VydmVQYXRoLCAnbmctY2xpLXdzJyk7XG5cbiAgcmV0dXJuIHtcbiAgICB3ZWJTb2NrZXRTZXJ2ZXI6IHtcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgcGF0aDogd2ViU29ja2V0UGF0aCxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBjbGllbnQ6IHtcbiAgICAgIGxvZ2dpbmc6ICdpbmZvJyxcbiAgICAgIHdlYlNvY2tldFVSTDogZ2V0UHVibGljSG9zdE9wdGlvbnMob3B0aW9ucywgd2ViU29ja2V0UGF0aCksXG4gICAgICBvdmVybGF5OiB7XG4gICAgICAgIGVycm9yczogdHJ1ZSxcbiAgICAgICAgd2FybmluZ3M6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRQdWJsaWNIb3N0T3B0aW9ucyhvcHRpb25zOiBXZWJwYWNrRGV2U2VydmVyT3B0aW9ucywgd2ViU29ja2V0UGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHB1YmxpY0hvc3Q6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQgPSBvcHRpb25zLnB1YmxpY0hvc3Q7XG4gIGlmIChwdWJsaWNIb3N0KSB7XG4gICAgY29uc3QgaG9zdFdpdGhQcm90b2NvbCA9ICEvXlxcdys6XFwvXFwvLy50ZXN0KHB1YmxpY0hvc3QpID8gYGh0dHBzOi8vJHtwdWJsaWNIb3N0fWAgOiBwdWJsaWNIb3N0O1xuICAgIHB1YmxpY0hvc3QgPSBuZXcgVVJMKGhvc3RXaXRoUHJvdG9jb2wpLmhvc3Q7XG4gIH1cblxuICByZXR1cm4gYGF1dG86Ly8ke3B1YmxpY0hvc3QgfHwgJzAuMC4wLjA6MCd9JHt3ZWJTb2NrZXRQYXRofWA7XG59XG4iXX0=