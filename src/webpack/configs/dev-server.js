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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2LXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svY29uZmlncy9kZXYtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsK0NBQXFEO0FBQ3JELDJCQUF3RDtBQUN4RCwrQkFBK0M7QUFDL0MsNkJBQXlDO0FBSXpDLDZDQUFrRDtBQUNsRCxtREFBcUQ7QUFDckQsK0VBQXdFO0FBQ3hFLDBEQUFzRDtBQUUvQyxLQUFLLFVBQVUsa0JBQWtCLENBQ3RDLEdBQWtEO0lBRWxELE1BQU0sRUFDSixZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxFQUN2RixNQUFNLEVBQ04sSUFBSSxHQUNMLEdBQUcsR0FBRyxDQUFDO0lBRVIsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFM0QsTUFBTSxVQUFVLEdBQWtCLEVBQUUsQ0FBQztJQUNyQyxJQUFJLEdBQUcsRUFBRTtRQUNQLFVBQVUsQ0FBQyxJQUFJLENBQUM7WUFDZCxNQUFNLEVBQUUsc0JBQVM7WUFDakIsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFBLGNBQU8sRUFBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1NBQ2pELENBQUMsQ0FBQztLQUNKO0lBRUQsTUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDO0lBQ3hCLElBQUksQ0FBQyxLQUFLLEVBQUU7UUFDVix5RUFB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YUFBYSxFQUFFLENBQUM7QUFDL0QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBsb2dnaW5nLCB0YWdzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgZXhpc3RzU3luYywgcHJvbWlzZXMgYXMgZnNQcm9taXNlcyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IGV4dG5hbWUsIHBvc2l4LCByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBVUkwsIHBhdGhUb0ZpbGVVUkwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiwgUnVsZVNldFJ1bGUgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb24gYXMgRGV2U2VydmVyQ29uZmlndXJhdGlvbiB9IGZyb20gJ3dlYnBhY2stZGV2LXNlcnZlcic7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucywgV2VicGFja0RldlNlcnZlck9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHsgZ2V0SW5kZXhPdXRwdXRGaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBIbXJMb2FkZXIgfSBmcm9tICcuLi9wbHVnaW5zL2htci9obXItbG9hZGVyJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldERldlNlcnZlckNvbmZpZyhcbiAgd2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9uczxXZWJwYWNrRGV2U2VydmVyT3B0aW9ucz4sXG4pOiBQcm9taXNlPENvbmZpZ3VyYXRpb24+IHtcbiAgY29uc3Qge1xuICAgIGJ1aWxkT3B0aW9uczogeyBob3N0LCBwb3J0LCBpbmRleCwgaGVhZGVycywgd2F0Y2gsIGhtciwgbWFpbiwgbGl2ZVJlbG9hZCwgcHJveHlDb25maWcgfSxcbiAgICBsb2dnZXIsXG4gICAgcm9vdCxcbiAgfSA9IHdjbztcblxuICBjb25zdCBzZXJ2ZVBhdGggPSBidWlsZFNlcnZlUGF0aCh3Y28uYnVpbGRPcHRpb25zLCBsb2dnZXIpO1xuXG4gIGNvbnN0IGV4dHJhUnVsZXM6IFJ1bGVTZXRSdWxlW10gPSBbXTtcbiAgaWYgKGhtcikge1xuICAgIGV4dHJhUnVsZXMucHVzaCh7XG4gICAgICBsb2FkZXI6IEhtckxvYWRlcixcbiAgICAgIGluY2x1ZGU6IFttYWluXS5tYXAoKHApID0+IHJlc29sdmUod2NvLnJvb3QsIHApKSxcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IGV4dHJhUGx1Z2lucyA9IFtdO1xuICBpZiAoIXdhdGNoKSB7XG4gICAgLy8gVGhlcmUncyBubyBvcHRpb24gdG8gdHVybiBvZmYgZmlsZSB3YXRjaGluZyBpbiB3ZWJwYWNrLWRldi1zZXJ2ZXIsIGJ1dFxuICAgIC8vIHdlIGNhbiBvdmVycmlkZSB0aGUgZmlsZSB3YXRjaGVyIGluc3RlYWQuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goe1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIGFwcGx5OiAoY29tcGlsZXI6IGFueSkgPT4ge1xuICAgICAgICBjb21waWxlci5ob29rcy5hZnRlckVudmlyb25tZW50LnRhcCgnYW5ndWxhci1jbGknLCAoKSA9PiB7XG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1lbXB0eS1mdW5jdGlvblxuICAgICAgICAgIGNvbXBpbGVyLndhdGNoRmlsZVN5c3RlbSA9IHsgd2F0Y2g6ICgpID0+IHt9IH07XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLFxuICAgIG1vZHVsZToge1xuICAgICAgcnVsZXM6IGV4dHJhUnVsZXMsXG4gICAgfSxcbiAgICBkZXZTZXJ2ZXI6IHtcbiAgICAgIGhvc3QsXG4gICAgICBwb3J0LFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxuICAgICAgICAuLi5oZWFkZXJzLFxuICAgICAgfSxcbiAgICAgIGhpc3RvcnlBcGlGYWxsYmFjazogISFpbmRleCAmJiB7XG4gICAgICAgIGluZGV4OiBwb3NpeC5qb2luKHNlcnZlUGF0aCwgZ2V0SW5kZXhPdXRwdXRGaWxlKGluZGV4KSksXG4gICAgICAgIGRpc2FibGVEb3RSdWxlOiB0cnVlLFxuICAgICAgICBodG1sQWNjZXB0SGVhZGVyczogWyd0ZXh0L2h0bWwnLCAnYXBwbGljYXRpb24veGh0bWwreG1sJ10sXG4gICAgICAgIHJld3JpdGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgZnJvbTogbmV3IFJlZ0V4cChgXig/ISR7c2VydmVQYXRofSkvLipgKSxcbiAgICAgICAgICAgIHRvOiAoY29udGV4dCkgPT4gY29udGV4dC5wYXJzZWRVcmwuaHJlZixcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIC8vIFdoZW4gc2V0dXBFeGl0U2lnbmFscyBpcyBlbmFibGVkIHdlYnBhY2stZGV2LXNlcnZlciB3aWxsIHNodXRkb3duIGdyYWNlZnVsbHkgd2hpY2ggd291bGRcbiAgICAgIC8vIHJlcXVpcmUgQ1RSTCtDIHRvIGJlIHByZXNzZWQgbXVsdGlwbGUgdGltZXMgdG8gZXhpdC5cbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2svd2VicGFjay1kZXYtc2VydmVyL2Jsb2IvYzc2YjZkMTFhMzgyMTQzNmM1ZTIwMjA3YzhhMzhkZWI2YWI3ZTMzYy9saWIvU2VydmVyLmpzI0wxODAxLUwxODI3XG4gICAgICBzZXR1cEV4aXRTaWduYWxzOiBmYWxzZSxcbiAgICAgIGNvbXByZXNzOiBmYWxzZSxcbiAgICAgIHN0YXRpYzogZmFsc2UsXG4gICAgICBzZXJ2ZXI6IGdldFNlcnZlckNvbmZpZyhyb290LCB3Y28uYnVpbGRPcHRpb25zKSxcbiAgICAgIGFsbG93ZWRIb3N0czogZ2V0QWxsb3dlZEhvc3RzQ29uZmlnKHdjby5idWlsZE9wdGlvbnMpLFxuICAgICAgZGV2TWlkZGxld2FyZToge1xuICAgICAgICBwdWJsaWNQYXRoOiBzZXJ2ZVBhdGgsXG4gICAgICAgIHN0YXRzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBsaXZlUmVsb2FkLFxuICAgICAgaG90OiBobXIgJiYgIWxpdmVSZWxvYWQgPyAnb25seScgOiBobXIsXG4gICAgICBwcm94eTogYXdhaXQgYWRkUHJveHlDb25maWcocm9vdCwgcHJveHlDb25maWcpLFxuICAgICAgLi4uZ2V0V2ViU29ja2V0U2V0dGluZ3Mod2NvLmJ1aWxkT3B0aW9ucywgc2VydmVQYXRoKSxcbiAgICB9LFxuICB9O1xufVxuXG4vKipcbiAqIFJlc29sdmUgYW5kIGJ1aWxkIGEgVVJMIF9wYXRoXyB0aGF0IHdpbGwgYmUgdGhlIHJvb3Qgb2YgdGhlIHNlcnZlci4gVGhpcyByZXNvbHZlZCBiYXNlIGhyZWYgYW5kXG4gKiBkZXBsb3kgVVJMIGZyb20gdGhlIGJyb3dzZXIgb3B0aW9ucyBhbmQgcmV0dXJucyBhIHBhdGggZnJvbSB0aGUgcm9vdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkU2VydmVQYXRoKFxuICBvcHRpb25zOiBXZWJwYWNrRGV2U2VydmVyT3B0aW9ucyxcbiAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSxcbik6IHN0cmluZyB7XG4gIGxldCBzZXJ2ZVBhdGggPSBvcHRpb25zLnNlcnZlUGF0aDtcbiAgaWYgKHNlcnZlUGF0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgZGVmYXVsdFBhdGggPSBmaW5kRGVmYXVsdFNlcnZlUGF0aChvcHRpb25zLmJhc2VIcmVmLCBvcHRpb25zLmRlcGxveVVybCk7XG4gICAgaWYgKGRlZmF1bHRQYXRoID09IG51bGwpIHtcbiAgICAgIGxvZ2dlci53YXJuKHRhZ3Mub25lTGluZWBcbiAgICAgICAgV2FybmluZzogLS1kZXBsb3ktdXJsIGFuZC9vciAtLWJhc2UtaHJlZiBjb250YWluIHVuc3VwcG9ydGVkIHZhbHVlcyBmb3Igbmcgc2VydmUuIERlZmF1bHRcbiAgICAgICAgc2VydmUgcGF0aCBvZiAnLycgdXNlZC4gVXNlIC0tc2VydmUtcGF0aCB0byBvdmVycmlkZS5cbiAgICAgIGApO1xuICAgIH1cbiAgICBzZXJ2ZVBhdGggPSBkZWZhdWx0UGF0aCB8fCAnJztcbiAgfVxuXG4gIGlmIChzZXJ2ZVBhdGguZW5kc1dpdGgoJy8nKSkge1xuICAgIHNlcnZlUGF0aCA9IHNlcnZlUGF0aC5zbGljZSgwLCAtMSk7XG4gIH1cblxuICBpZiAoIXNlcnZlUGF0aC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICBzZXJ2ZVBhdGggPSBgLyR7c2VydmVQYXRofWA7XG4gIH1cblxuICByZXR1cm4gc2VydmVQYXRoO1xufVxuXG4vKipcbiAqIFByaXZhdGUgbWV0aG9kIHRvIGVuaGFuY2UgYSB3ZWJwYWNrIGNvbmZpZyB3aXRoIFNTTCBjb25maWd1cmF0aW9uLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gZ2V0U2VydmVyQ29uZmlnKFxuICByb290OiBzdHJpbmcsXG4gIG9wdGlvbnM6IFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zLFxuKTogRGV2U2VydmVyQ29uZmlndXJhdGlvblsnc2VydmVyJ10ge1xuICBjb25zdCB7IHNzbCwgc3NsQ2VydCwgc3NsS2V5IH0gPSBvcHRpb25zO1xuICBpZiAoIXNzbCkge1xuICAgIHJldHVybiAnaHR0cCc7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHR5cGU6ICdodHRwcycsXG4gICAgb3B0aW9uczpcbiAgICAgIHNzbENlcnQgJiYgc3NsS2V5XG4gICAgICAgID8ge1xuICAgICAgICAgICAga2V5OiByZXNvbHZlKHJvb3QsIHNzbEtleSksXG4gICAgICAgICAgICBjZXJ0OiByZXNvbHZlKHJvb3QsIHNzbENlcnQpLFxuICAgICAgICAgIH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gIH07XG59XG5cbi8qKlxuICogUHJpdmF0ZSBtZXRob2QgdG8gZW5oYW5jZSBhIHdlYnBhY2sgY29uZmlnIHdpdGggUHJveHkgY29uZmlndXJhdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGFkZFByb3h5Q29uZmlnKHJvb3Q6IHN0cmluZywgcHJveHlDb25maWc6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuICBpZiAoIXByb3h5Q29uZmlnKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGNvbnN0IHByb3h5UGF0aCA9IHJlc29sdmUocm9vdCwgcHJveHlDb25maWcpO1xuXG4gIGlmICghZXhpc3RzU3luYyhwcm94eVBhdGgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBQcm94eSBjb25maWd1cmF0aW9uIGZpbGUgJHtwcm94eVBhdGh9IGRvZXMgbm90IGV4aXN0LmApO1xuICB9XG5cbiAgc3dpdGNoIChleHRuYW1lKHByb3h5UGF0aCkpIHtcbiAgICBjYXNlICcuanNvbic6IHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBmc1Byb21pc2VzLnJlYWRGaWxlKHByb3h5UGF0aCwgJ3V0Zi04Jyk7XG5cbiAgICAgIGNvbnN0IHsgcGFyc2UsIHByaW50UGFyc2VFcnJvckNvZGUgfSA9IGF3YWl0IGltcG9ydCgnanNvbmMtcGFyc2VyJyk7XG4gICAgICBjb25zdCBwYXJzZUVycm9yczogaW1wb3J0KCdqc29uYy1wYXJzZXInKS5QYXJzZUVycm9yW10gPSBbXTtcbiAgICAgIGNvbnN0IHByb3h5Q29uZmlndXJhdGlvbiA9IHBhcnNlKGNvbnRlbnQsIHBhcnNlRXJyb3JzLCB7IGFsbG93VHJhaWxpbmdDb21tYTogdHJ1ZSB9KTtcblxuICAgICAgaWYgKHBhcnNlRXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbGV0IGVycm9yTWVzc2FnZSA9IGBQcm94eSBjb25maWd1cmF0aW9uIGZpbGUgJHtwcm94eVBhdGh9IGNvbnRhaW5zIHBhcnNlIGVycm9yczpgO1xuICAgICAgICBmb3IgKGNvbnN0IHBhcnNlRXJyb3Igb2YgcGFyc2VFcnJvcnMpIHtcbiAgICAgICAgICBjb25zdCB7IGxpbmUsIGNvbHVtbiB9ID0gZ2V0SnNvbkVycm9yTGluZUNvbHVtbihwYXJzZUVycm9yLm9mZnNldCwgY29udGVudCk7XG4gICAgICAgICAgZXJyb3JNZXNzYWdlICs9IGBcXG5bJHtsaW5lfSwgJHtjb2x1bW59XSAke3ByaW50UGFyc2VFcnJvckNvZGUocGFyc2VFcnJvci5lcnJvcil9YDtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JNZXNzYWdlKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHByb3h5Q29uZmlndXJhdGlvbjtcbiAgICB9XG4gICAgY2FzZSAnLm1qcyc6XG4gICAgICAvLyBMb2FkIHRoZSBFU00gY29uZmlndXJhdGlvbiBmaWxlIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAgICAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgICAgIHJldHVybiAoYXdhaXQgbG9hZEVzbU1vZHVsZTx7IGRlZmF1bHQ6IHVua25vd24gfT4ocGF0aFRvRmlsZVVSTChwcm94eVBhdGgpKSkuZGVmYXVsdDtcbiAgICBjYXNlICcuY2pzJzpcbiAgICAgIHJldHVybiByZXF1aXJlKHByb3h5UGF0aCk7XG4gICAgZGVmYXVsdDpcbiAgICAgIC8vIFRoZSBmaWxlIGNvdWxkIGJlIGVpdGhlciBDb21tb25KUyBvciBFU00uXG4gICAgICAvLyBDb21tb25KUyBpcyB0cmllZCBmaXJzdCB0aGVuIEVTTSBpZiBsb2FkaW5nIGZhaWxzLlxuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHJlcXVpcmUocHJveHlQYXRoKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgYXNzZXJ0SXNFcnJvcihlKTtcbiAgICAgICAgaWYgKGUuY29kZSA9PT0gJ0VSUl9SRVFVSVJFX0VTTScpIHtcbiAgICAgICAgICAvLyBMb2FkIHRoZSBFU00gY29uZmlndXJhdGlvbiBmaWxlIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gICAgICAgICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgICAgICAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgICAgICAgIHJldHVybiAoYXdhaXQgbG9hZEVzbU1vZHVsZTx7IGRlZmF1bHQ6IHVua25vd24gfT4ocGF0aFRvRmlsZVVSTChwcm94eVBhdGgpKSkuZGVmYXVsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSBsaW5lIGFuZCBjb2x1bW4gZm9yIGFuIGVycm9yIG9mZnNldCBpbiB0aGUgY29udGVudCBvZiBhIEpTT04gZmlsZS5cbiAqIEBwYXJhbSBsb2NhdGlvbiBUaGUgb2Zmc2V0IGVycm9yIGxvY2F0aW9uIGZyb20gdGhlIGJlZ2lubmluZyBvZiB0aGUgY29udGVudC5cbiAqIEBwYXJhbSBjb250ZW50IFRoZSBmdWxsIGNvbnRlbnQgb2YgdGhlIGZpbGUgY29udGFpbmluZyB0aGUgZXJyb3IuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgbGluZSBhbmQgY29sdW1uXG4gKi9cbmZ1bmN0aW9uIGdldEpzb25FcnJvckxpbmVDb2x1bW4ob2Zmc2V0OiBudW1iZXIsIGNvbnRlbnQ6IHN0cmluZykge1xuICBpZiAob2Zmc2V0ID09PSAwKSB7XG4gICAgcmV0dXJuIHsgbGluZTogMSwgY29sdW1uOiAxIH07XG4gIH1cblxuICBsZXQgbGluZSA9IDA7XG4gIGxldCBwb3NpdGlvbiA9IDA7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zdGFudC1jb25kaXRpb25cbiAgd2hpbGUgKHRydWUpIHtcbiAgICArK2xpbmU7XG5cbiAgICBjb25zdCBuZXh0TmV3bGluZSA9IGNvbnRlbnQuaW5kZXhPZignXFxuJywgcG9zaXRpb24pO1xuICAgIGlmIChuZXh0TmV3bGluZSA9PT0gLTEgfHwgbmV4dE5ld2xpbmUgPiBvZmZzZXQpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHBvc2l0aW9uID0gbmV4dE5ld2xpbmUgKyAxO1xuICB9XG5cbiAgcmV0dXJuIHsgbGluZSwgY29sdW1uOiBvZmZzZXQgLSBwb3NpdGlvbiArIDEgfTtcbn1cblxuLyoqXG4gKiBGaW5kIHRoZSBkZWZhdWx0IHNlcnZlciBwYXRoLiBXZSBkb24ndCB3YW50IHRvIGV4cG9zZSBiYXNlSHJlZiBhbmQgZGVwbG95VXJsIGFzIGFyZ3VtZW50cywgb25seVxuICogdGhlIGJyb3dzZXIgb3B0aW9ucyB3aGVyZSBuZWVkZWQuIFRoaXMgbWV0aG9kIHNob3VsZCBzdGF5IHByaXZhdGUgKHBlb3BsZSB3aG8gd2FudCB0byByZXNvbHZlXG4gKiBiYXNlSHJlZiBhbmQgZGVwbG95VXJsIHNob3VsZCB1c2UgdGhlIGJ1aWxkU2VydmVQYXRoIGV4cG9ydGVkIGZ1bmN0aW9uLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gZmluZERlZmF1bHRTZXJ2ZVBhdGgoYmFzZUhyZWY/OiBzdHJpbmcsIGRlcGxveVVybD86IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICBpZiAoIWJhc2VIcmVmICYmICFkZXBsb3lVcmwpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cblxuICBpZiAoL14oXFx3KzopP1xcL1xcLy8udGVzdChiYXNlSHJlZiB8fCAnJykgfHwgL14oXFx3KzopP1xcL1xcLy8udGVzdChkZXBsb3lVcmwgfHwgJycpKSB7XG4gICAgLy8gSWYgYmFzZUhyZWYgb3IgZGVwbG95VXJsIGlzIGFic29sdXRlLCB1bnN1cHBvcnRlZCBieSBuZyBzZXJ2ZVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gbm9ybWFsaXplIGJhc2VIcmVmXG4gIC8vIGZvciBuZyBzZXJ2ZSB0aGUgc3RhcnRpbmcgYmFzZSBpcyBhbHdheXMgYC9gIHNvIGEgcmVsYXRpdmVcbiAgLy8gYW5kIHJvb3QgcmVsYXRpdmUgdmFsdWUgYXJlIGlkZW50aWNhbFxuICBjb25zdCBiYXNlSHJlZlBhcnRzID0gKGJhc2VIcmVmIHx8ICcnKS5zcGxpdCgnLycpLmZpbHRlcigocGFydCkgPT4gcGFydCAhPT0gJycpO1xuICBpZiAoYmFzZUhyZWYgJiYgIWJhc2VIcmVmLmVuZHNXaXRoKCcvJykpIHtcbiAgICBiYXNlSHJlZlBhcnRzLnBvcCgpO1xuICB9XG4gIGNvbnN0IG5vcm1hbGl6ZWRCYXNlSHJlZiA9IGJhc2VIcmVmUGFydHMubGVuZ3RoID09PSAwID8gJy8nIDogYC8ke2Jhc2VIcmVmUGFydHMuam9pbignLycpfS9gO1xuXG4gIGlmIChkZXBsb3lVcmwgJiYgZGVwbG95VXJsWzBdID09PSAnLycpIHtcbiAgICBpZiAoYmFzZUhyZWYgJiYgYmFzZUhyZWZbMF0gPT09ICcvJyAmJiBub3JtYWxpemVkQmFzZUhyZWYgIT09IGRlcGxveVVybCkge1xuICAgICAgLy8gSWYgYmFzZUhyZWYgYW5kIGRlcGxveVVybCBhcmUgcm9vdCByZWxhdGl2ZSBhbmQgbm90IGVxdWl2YWxlbnQsIHVuc3VwcG9ydGVkIGJ5IG5nIHNlcnZlXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVwbG95VXJsO1xuICB9XG5cbiAgLy8gSm9pbiB0b2dldGhlciBiYXNlSHJlZiBhbmQgZGVwbG95VXJsXG4gIHJldHVybiBgJHtub3JtYWxpemVkQmFzZUhyZWZ9JHtkZXBsb3lVcmwgfHwgJyd9YDtcbn1cblxuZnVuY3Rpb24gZ2V0QWxsb3dlZEhvc3RzQ29uZmlnKFxuICBvcHRpb25zOiBXZWJwYWNrRGV2U2VydmVyT3B0aW9ucyxcbik6IERldlNlcnZlckNvbmZpZ3VyYXRpb25bJ2FsbG93ZWRIb3N0cyddIHtcbiAgaWYgKG9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjaykge1xuICAgIHJldHVybiAnYWxsJztcbiAgfSBlbHNlIGlmIChvcHRpb25zLmFsbG93ZWRIb3N0cz8ubGVuZ3RoKSB7XG4gICAgcmV0dXJuIG9wdGlvbnMuYWxsb3dlZEhvc3RzO1xuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZ2V0V2ViU29ja2V0U2V0dGluZ3MoXG4gIG9wdGlvbnM6IFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zLFxuICBzZXJ2ZVBhdGg6IHN0cmluZyxcbik6IHtcbiAgd2ViU29ja2V0U2VydmVyPzogRGV2U2VydmVyQ29uZmlndXJhdGlvblsnd2ViU29ja2V0U2VydmVyJ107XG4gIGNsaWVudD86IERldlNlcnZlckNvbmZpZ3VyYXRpb25bJ2NsaWVudCddO1xufSB7XG4gIGNvbnN0IHsgaG1yLCBsaXZlUmVsb2FkIH0gPSBvcHRpb25zO1xuICBpZiAoIWhtciAmJiAhbGl2ZVJlbG9hZCkge1xuICAgIHJldHVybiB7XG4gICAgICB3ZWJTb2NrZXRTZXJ2ZXI6IGZhbHNlLFxuICAgICAgY2xpZW50OiB1bmRlZmluZWQsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHdlYlNvY2tldFBhdGggPSBwb3NpeC5qb2luKHNlcnZlUGF0aCwgJ25nLWNsaS13cycpO1xuXG4gIHJldHVybiB7XG4gICAgd2ViU29ja2V0U2VydmVyOiB7XG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIHBhdGg6IHdlYlNvY2tldFBhdGgsXG4gICAgICB9LFxuICAgIH0sXG4gICAgY2xpZW50OiB7XG4gICAgICBsb2dnaW5nOiAnaW5mbycsXG4gICAgICB3ZWJTb2NrZXRVUkw6IGdldFB1YmxpY0hvc3RPcHRpb25zKG9wdGlvbnMsIHdlYlNvY2tldFBhdGgpLFxuICAgICAgb3ZlcmxheToge1xuICAgICAgICBlcnJvcnM6IHRydWUsXG4gICAgICAgIHdhcm5pbmdzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0UHVibGljSG9zdE9wdGlvbnMob3B0aW9uczogV2VicGFja0RldlNlcnZlck9wdGlvbnMsIHdlYlNvY2tldFBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCBwdWJsaWNIb3N0OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkID0gb3B0aW9ucy5wdWJsaWNIb3N0O1xuICBpZiAocHVibGljSG9zdCkge1xuICAgIGNvbnN0IGhvc3RXaXRoUHJvdG9jb2wgPSAhL15cXHcrOlxcL1xcLy8udGVzdChwdWJsaWNIb3N0KSA/IGBodHRwczovLyR7cHVibGljSG9zdH1gIDogcHVibGljSG9zdDtcbiAgICBwdWJsaWNIb3N0ID0gbmV3IFVSTChob3N0V2l0aFByb3RvY29sKS5ob3N0O1xuICB9XG5cbiAgcmV0dXJuIGBhdXRvOi8vJHtwdWJsaWNIb3N0IHx8ICcwLjAuMC4wOjAnfSR7d2ViU29ja2V0UGF0aH1gO1xufVxuIl19