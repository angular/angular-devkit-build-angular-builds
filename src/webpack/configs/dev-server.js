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
        servePath = servePath.substr(0, servePath.length - 1);
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
    const webSocketPath = path_1.posix.join(servePath, 'ws');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2LXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svY29uZmlncy9kZXYtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsK0NBQXFEO0FBQ3JELDJCQUF3RDtBQUN4RCwrQkFBK0M7QUFDL0MsNkJBQXlDO0FBSXpDLG1EQUFxRDtBQUNyRCwrRUFBd0U7QUFDeEUsMERBQXNEO0FBRS9DLEtBQUssVUFBVSxrQkFBa0IsQ0FDdEMsR0FBa0Q7SUFFbEQsTUFBTSxFQUNKLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLEVBQ3ZGLE1BQU0sRUFDTixJQUFJLEdBQ0wsR0FBRyxHQUFHLENBQUM7SUFFUixNQUFNLFNBQVMsR0FBRyxjQUFjLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBQztJQUUzRCxNQUFNLFVBQVUsR0FBa0IsRUFBRSxDQUFDO0lBQ3JDLElBQUksR0FBRyxFQUFFO1FBQ1AsVUFBVSxDQUFDLElBQUksQ0FBQztZQUNkLE1BQU0sRUFBRSxzQkFBUztZQUNqQixPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUEsY0FBTyxFQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDakQsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxNQUFNLFlBQVksR0FBRyxFQUFFLENBQUM7SUFDeEIsSUFBSSxDQUFDLEtBQUssRUFBRTtRQUNWLHlFQUF5RTtRQUN6RSw0Q0FB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QixPQUFnQyxFQUNoQyxTQUFpQjtJQUtqQixNQUFNLEVBQUUsR0FBRyxFQUFFLFVBQVUsRUFBRSxHQUFHLE9BQU8sQ0FBQztJQUNwQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxFQUFFO1FBQ3ZCLE9BQU87WUFDTCxlQUFlLEVBQUUsS0FBSztZQUN0QixNQUFNLEVBQUUsU0FBUztTQUNsQixDQUFDO0tBQ0g7SUFFRCxNQUFNLGFBQWEsR0FBRyxZQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUVsRCxPQUFPO1FBQ0wsZUFBZSxFQUFFO1lBQ2YsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxhQUFhO2FBQ3BCO1NBQ0Y7UUFDRCxNQUFNLEVBQUU7WUFDTixPQUFPLEVBQUUsTUFBTTtZQUNmLFlBQVksRUFBRSxvQkFBb0IsQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDO1lBQzFELE9BQU8sRUFBRTtnQkFDUCxNQUFNLEVBQUUsSUFBSTtnQkFDWixRQUFRLEVBQUUsS0FBSzthQUNoQjtTQUNGO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFFRCxTQUFTLG9CQUFvQixDQUFDLE9BQWdDLEVBQUUsYUFBcUI7SUFDbkYsSUFBSSxVQUFVLEdBQThCLE9BQU8sQ0FBQyxVQUFVLENBQUM7SUFDL0QsSUFBSSxVQUFVLEVBQUU7UUFDZCxNQUFNLGdCQUFnQixHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDO1FBQzlGLFVBQVUsR0FBRyxJQUFJLFNBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLElBQUksQ0FBQztLQUM3QztJQUVELE9BQU8sVUFBVSxVQUFVLElBQUksV0FBVyxHQUFHLGFBQWEsRUFBRSxDQUFDO0FBQy9ELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgbG9nZ2luZywgdGFncyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IGV4aXN0c1N5bmMsIHByb21pc2VzIGFzIGZzUHJvbWlzZXMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBleHRuYW1lLCBwb3NpeCwgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgVVJMLCBwYXRoVG9GaWxlVVJMIH0gZnJvbSAndXJsJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb24sIFJ1bGVTZXRSdWxlIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uIGFzIERldlNlcnZlckNvbmZpZ3VyYXRpb24gfSBmcm9tICd3ZWJwYWNrLWRldi1zZXJ2ZXInO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMsIFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHsgZ2V0SW5kZXhPdXRwdXRGaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBIbXJMb2FkZXIgfSBmcm9tICcuLi9wbHVnaW5zL2htci9obXItbG9hZGVyJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldERldlNlcnZlckNvbmZpZyhcbiAgd2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9uczxXZWJwYWNrRGV2U2VydmVyT3B0aW9ucz4sXG4pOiBQcm9taXNlPENvbmZpZ3VyYXRpb24+IHtcbiAgY29uc3Qge1xuICAgIGJ1aWxkT3B0aW9uczogeyBob3N0LCBwb3J0LCBpbmRleCwgaGVhZGVycywgd2F0Y2gsIGhtciwgbWFpbiwgbGl2ZVJlbG9hZCwgcHJveHlDb25maWcgfSxcbiAgICBsb2dnZXIsXG4gICAgcm9vdCxcbiAgfSA9IHdjbztcblxuICBjb25zdCBzZXJ2ZVBhdGggPSBidWlsZFNlcnZlUGF0aCh3Y28uYnVpbGRPcHRpb25zLCBsb2dnZXIpO1xuXG4gIGNvbnN0IGV4dHJhUnVsZXM6IFJ1bGVTZXRSdWxlW10gPSBbXTtcbiAgaWYgKGhtcikge1xuICAgIGV4dHJhUnVsZXMucHVzaCh7XG4gICAgICBsb2FkZXI6IEhtckxvYWRlcixcbiAgICAgIGluY2x1ZGU6IFttYWluXS5tYXAoKHApID0+IHJlc29sdmUod2NvLnJvb3QsIHApKSxcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IGV4dHJhUGx1Z2lucyA9IFtdO1xuICBpZiAoIXdhdGNoKSB7XG4gICAgLy8gVGhlcmUncyBubyBvcHRpb24gdG8gdHVybiBvZmYgZmlsZSB3YXRjaGluZyBpbiB3ZWJwYWNrLWRldi1zZXJ2ZXIsIGJ1dFxuICAgIC8vIHdlIGNhbiBvdmVycmlkZSB0aGUgZmlsZSB3YXRjaGVyIGluc3RlYWQuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goe1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIGFwcGx5OiAoY29tcGlsZXI6IGFueSkgPT4ge1xuICAgICAgICBjb21waWxlci5ob29rcy5hZnRlckVudmlyb25tZW50LnRhcCgnYW5ndWxhci1jbGknLCAoKSA9PiB7XG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1lbXB0eS1mdW5jdGlvblxuICAgICAgICAgIGNvbXBpbGVyLndhdGNoRmlsZVN5c3RlbSA9IHsgd2F0Y2g6ICgpID0+IHt9IH07XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLFxuICAgIG1vZHVsZToge1xuICAgICAgcnVsZXM6IGV4dHJhUnVsZXMsXG4gICAgfSxcbiAgICBkZXZTZXJ2ZXI6IHtcbiAgICAgIGhvc3QsXG4gICAgICBwb3J0LFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxuICAgICAgICAuLi5oZWFkZXJzLFxuICAgICAgfSxcbiAgICAgIGhpc3RvcnlBcGlGYWxsYmFjazogISFpbmRleCAmJiB7XG4gICAgICAgIGluZGV4OiBwb3NpeC5qb2luKHNlcnZlUGF0aCwgZ2V0SW5kZXhPdXRwdXRGaWxlKGluZGV4KSksXG4gICAgICAgIGRpc2FibGVEb3RSdWxlOiB0cnVlLFxuICAgICAgICBodG1sQWNjZXB0SGVhZGVyczogWyd0ZXh0L2h0bWwnLCAnYXBwbGljYXRpb24veGh0bWwreG1sJ10sXG4gICAgICAgIHJld3JpdGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgZnJvbTogbmV3IFJlZ0V4cChgXig/ISR7c2VydmVQYXRofSkvLipgKSxcbiAgICAgICAgICAgIHRvOiAoY29udGV4dCkgPT4gY29udGV4dC5wYXJzZWRVcmwuaHJlZixcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIGNvbXByZXNzOiBmYWxzZSxcbiAgICAgIHN0YXRpYzogZmFsc2UsXG4gICAgICBzZXJ2ZXI6IGdldFNlcnZlckNvbmZpZyhyb290LCB3Y28uYnVpbGRPcHRpb25zKSxcbiAgICAgIGFsbG93ZWRIb3N0czogZ2V0QWxsb3dlZEhvc3RzQ29uZmlnKHdjby5idWlsZE9wdGlvbnMpLFxuICAgICAgZGV2TWlkZGxld2FyZToge1xuICAgICAgICBwdWJsaWNQYXRoOiBzZXJ2ZVBhdGgsXG4gICAgICAgIHN0YXRzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBsaXZlUmVsb2FkLFxuICAgICAgaG90OiBobXIgJiYgIWxpdmVSZWxvYWQgPyAnb25seScgOiBobXIsXG4gICAgICBwcm94eTogYXdhaXQgYWRkUHJveHlDb25maWcocm9vdCwgcHJveHlDb25maWcpLFxuICAgICAgLi4uZ2V0V2ViU29ja2V0U2V0dGluZ3Mod2NvLmJ1aWxkT3B0aW9ucywgc2VydmVQYXRoKSxcbiAgICB9LFxuICB9O1xufVxuXG4vKipcbiAqIFJlc29sdmUgYW5kIGJ1aWxkIGEgVVJMIF9wYXRoXyB0aGF0IHdpbGwgYmUgdGhlIHJvb3Qgb2YgdGhlIHNlcnZlci4gVGhpcyByZXNvbHZlZCBiYXNlIGhyZWYgYW5kXG4gKiBkZXBsb3kgVVJMIGZyb20gdGhlIGJyb3dzZXIgb3B0aW9ucyBhbmQgcmV0dXJucyBhIHBhdGggZnJvbSB0aGUgcm9vdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkU2VydmVQYXRoKFxuICBvcHRpb25zOiBXZWJwYWNrRGV2U2VydmVyT3B0aW9ucyxcbiAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSxcbik6IHN0cmluZyB7XG4gIGxldCBzZXJ2ZVBhdGggPSBvcHRpb25zLnNlcnZlUGF0aDtcbiAgaWYgKHNlcnZlUGF0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgZGVmYXVsdFBhdGggPSBmaW5kRGVmYXVsdFNlcnZlUGF0aChvcHRpb25zLmJhc2VIcmVmLCBvcHRpb25zLmRlcGxveVVybCk7XG4gICAgaWYgKGRlZmF1bHRQYXRoID09IG51bGwpIHtcbiAgICAgIGxvZ2dlci53YXJuKHRhZ3Mub25lTGluZWBcbiAgICAgICAgV2FybmluZzogLS1kZXBsb3ktdXJsIGFuZC9vciAtLWJhc2UtaHJlZiBjb250YWluIHVuc3VwcG9ydGVkIHZhbHVlcyBmb3Igbmcgc2VydmUuIERlZmF1bHRcbiAgICAgICAgc2VydmUgcGF0aCBvZiAnLycgdXNlZC4gVXNlIC0tc2VydmUtcGF0aCB0byBvdmVycmlkZS5cbiAgICAgIGApO1xuICAgIH1cbiAgICBzZXJ2ZVBhdGggPSBkZWZhdWx0UGF0aCB8fCAnJztcbiAgfVxuXG4gIGlmIChzZXJ2ZVBhdGguZW5kc1dpdGgoJy8nKSkge1xuICAgIHNlcnZlUGF0aCA9IHNlcnZlUGF0aC5zdWJzdHIoMCwgc2VydmVQYXRoLmxlbmd0aCAtIDEpO1xuICB9XG5cbiAgaWYgKCFzZXJ2ZVBhdGguc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgc2VydmVQYXRoID0gYC8ke3NlcnZlUGF0aH1gO1xuICB9XG5cbiAgcmV0dXJuIHNlcnZlUGF0aDtcbn1cblxuLyoqXG4gKiBQcml2YXRlIG1ldGhvZCB0byBlbmhhbmNlIGEgd2VicGFjayBjb25maWcgd2l0aCBTU0wgY29uZmlndXJhdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGdldFNlcnZlckNvbmZpZyhcbiAgcm9vdDogc3RyaW5nLFxuICBvcHRpb25zOiBXZWJwYWNrRGV2U2VydmVyT3B0aW9ucyxcbik6IERldlNlcnZlckNvbmZpZ3VyYXRpb25bJ3NlcnZlciddIHtcbiAgY29uc3QgeyBzc2wsIHNzbENlcnQsIHNzbEtleSB9ID0gb3B0aW9ucztcbiAgaWYgKCFzc2wpIHtcbiAgICByZXR1cm4gJ2h0dHAnO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnaHR0cHMnLFxuICAgIG9wdGlvbnM6XG4gICAgICBzc2xDZXJ0ICYmIHNzbEtleVxuICAgICAgICA/IHtcbiAgICAgICAgICAgIGtleTogcmVzb2x2ZShyb290LCBzc2xLZXkpLFxuICAgICAgICAgICAgY2VydDogcmVzb2x2ZShyb290LCBzc2xDZXJ0KSxcbiAgICAgICAgICB9XG4gICAgICAgIDogdW5kZWZpbmVkLFxuICB9O1xufVxuXG4vKipcbiAqIFByaXZhdGUgbWV0aG9kIHRvIGVuaGFuY2UgYSB3ZWJwYWNrIGNvbmZpZyB3aXRoIFByb3h5IGNvbmZpZ3VyYXRpb24uXG4gKiBAcHJpdmF0ZVxuICovXG5hc3luYyBmdW5jdGlvbiBhZGRQcm94eUNvbmZpZyhyb290OiBzdHJpbmcsIHByb3h5Q29uZmlnOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcbiAgaWYgKCFwcm94eUNvbmZpZykge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICBjb25zdCBwcm94eVBhdGggPSByZXNvbHZlKHJvb3QsIHByb3h5Q29uZmlnKTtcblxuICBpZiAoIWV4aXN0c1N5bmMocHJveHlQYXRoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgUHJveHkgY29uZmlndXJhdGlvbiBmaWxlICR7cHJveHlQYXRofSBkb2VzIG5vdCBleGlzdC5gKTtcbiAgfVxuXG4gIHN3aXRjaCAoZXh0bmFtZShwcm94eVBhdGgpKSB7XG4gICAgY2FzZSAnLmpzb24nOiB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgZnNQcm9taXNlcy5yZWFkRmlsZShwcm94eVBhdGgsICd1dGYtOCcpO1xuXG4gICAgICBjb25zdCB7IHBhcnNlLCBwcmludFBhcnNlRXJyb3JDb2RlIH0gPSBhd2FpdCBpbXBvcnQoJ2pzb25jLXBhcnNlcicpO1xuICAgICAgY29uc3QgcGFyc2VFcnJvcnM6IGltcG9ydCgnanNvbmMtcGFyc2VyJykuUGFyc2VFcnJvcltdID0gW107XG4gICAgICBjb25zdCBwcm94eUNvbmZpZ3VyYXRpb24gPSBwYXJzZShjb250ZW50LCBwYXJzZUVycm9ycywgeyBhbGxvd1RyYWlsaW5nQ29tbWE6IHRydWUgfSk7XG5cbiAgICAgIGlmIChwYXJzZUVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGxldCBlcnJvck1lc3NhZ2UgPSBgUHJveHkgY29uZmlndXJhdGlvbiBmaWxlICR7cHJveHlQYXRofSBjb250YWlucyBwYXJzZSBlcnJvcnM6YDtcbiAgICAgICAgZm9yIChjb25zdCBwYXJzZUVycm9yIG9mIHBhcnNlRXJyb3JzKSB7XG4gICAgICAgICAgY29uc3QgeyBsaW5lLCBjb2x1bW4gfSA9IGdldEpzb25FcnJvckxpbmVDb2x1bW4ocGFyc2VFcnJvci5vZmZzZXQsIGNvbnRlbnQpO1xuICAgICAgICAgIGVycm9yTWVzc2FnZSArPSBgXFxuWyR7bGluZX0sICR7Y29sdW1ufV0gJHtwcmludFBhcnNlRXJyb3JDb2RlKHBhcnNlRXJyb3IuZXJyb3IpfWA7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9yTWVzc2FnZSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwcm94eUNvbmZpZ3VyYXRpb247XG4gICAgfVxuICAgIGNhc2UgJy5tanMnOlxuICAgICAgLy8gTG9hZCB0aGUgRVNNIGNvbmZpZ3VyYXRpb24gZmlsZSB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgICAgIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gICAgICByZXR1cm4gKGF3YWl0IGxvYWRFc21Nb2R1bGU8eyBkZWZhdWx0OiB1bmtub3duIH0+KHBhdGhUb0ZpbGVVUkwocHJveHlQYXRoKSkpLmRlZmF1bHQ7XG4gICAgY2FzZSAnLmNqcyc6XG4gICAgICByZXR1cm4gcmVxdWlyZShwcm94eVBhdGgpO1xuICAgIGRlZmF1bHQ6XG4gICAgICAvLyBUaGUgZmlsZSBjb3VsZCBiZSBlaXRoZXIgQ29tbW9uSlMgb3IgRVNNLlxuICAgICAgLy8gQ29tbW9uSlMgaXMgdHJpZWQgZmlyc3QgdGhlbiBFU00gaWYgbG9hZGluZyBmYWlscy5cbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiByZXF1aXJlKHByb3h5UGF0aCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGlmIChlLmNvZGUgPT09ICdFUlJfUkVRVUlSRV9FU00nKSB7XG4gICAgICAgICAgLy8gTG9hZCB0aGUgRVNNIGNvbmZpZ3VyYXRpb24gZmlsZSB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgICAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgICAgICAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgICAgICAgICByZXR1cm4gKGF3YWl0IGxvYWRFc21Nb2R1bGU8eyBkZWZhdWx0OiB1bmtub3duIH0+KHBhdGhUb0ZpbGVVUkwocHJveHlQYXRoKSkpLmRlZmF1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICB9XG59XG5cbi8qKlxuICogQ2FsY3VsYXRlcyB0aGUgbGluZSBhbmQgY29sdW1uIGZvciBhbiBlcnJvciBvZmZzZXQgaW4gdGhlIGNvbnRlbnQgb2YgYSBKU09OIGZpbGUuXG4gKiBAcGFyYW0gbG9jYXRpb24gVGhlIG9mZnNldCBlcnJvciBsb2NhdGlvbiBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGNvbnRlbnQuXG4gKiBAcGFyYW0gY29udGVudCBUaGUgZnVsbCBjb250ZW50IG9mIHRoZSBmaWxlIGNvbnRhaW5pbmcgdGhlIGVycm9yLlxuICogQHJldHVybnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIGxpbmUgYW5kIGNvbHVtblxuICovXG5mdW5jdGlvbiBnZXRKc29uRXJyb3JMaW5lQ29sdW1uKG9mZnNldDogbnVtYmVyLCBjb250ZW50OiBzdHJpbmcpIHtcbiAgaWYgKG9mZnNldCA9PT0gMCkge1xuICAgIHJldHVybiB7IGxpbmU6IDEsIGNvbHVtbjogMSB9O1xuICB9XG5cbiAgbGV0IGxpbmUgPSAwO1xuICBsZXQgcG9zaXRpb24gPSAwO1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgKytsaW5lO1xuXG4gICAgY29uc3QgbmV4dE5ld2xpbmUgPSBjb250ZW50LmluZGV4T2YoJ1xcbicsIHBvc2l0aW9uKTtcbiAgICBpZiAobmV4dE5ld2xpbmUgPT09IC0xIHx8IG5leHROZXdsaW5lID4gb2Zmc2V0KSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBwb3NpdGlvbiA9IG5leHROZXdsaW5lICsgMTtcbiAgfVxuXG4gIHJldHVybiB7IGxpbmUsIGNvbHVtbjogb2Zmc2V0IC0gcG9zaXRpb24gKyAxIH07XG59XG5cbi8qKlxuICogRmluZCB0aGUgZGVmYXVsdCBzZXJ2ZXIgcGF0aC4gV2UgZG9uJ3Qgd2FudCB0byBleHBvc2UgYmFzZUhyZWYgYW5kIGRlcGxveVVybCBhcyBhcmd1bWVudHMsIG9ubHlcbiAqIHRoZSBicm93c2VyIG9wdGlvbnMgd2hlcmUgbmVlZGVkLiBUaGlzIG1ldGhvZCBzaG91bGQgc3RheSBwcml2YXRlIChwZW9wbGUgd2hvIHdhbnQgdG8gcmVzb2x2ZVxuICogYmFzZUhyZWYgYW5kIGRlcGxveVVybCBzaG91bGQgdXNlIHRoZSBidWlsZFNlcnZlUGF0aCBleHBvcnRlZCBmdW5jdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGZpbmREZWZhdWx0U2VydmVQYXRoKGJhc2VIcmVmPzogc3RyaW5nLCBkZXBsb3lVcmw/OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgaWYgKCFiYXNlSHJlZiAmJiAhZGVwbG95VXJsKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgaWYgKC9eKFxcdys6KT9cXC9cXC8vLnRlc3QoYmFzZUhyZWYgfHwgJycpIHx8IC9eKFxcdys6KT9cXC9cXC8vLnRlc3QoZGVwbG95VXJsIHx8ICcnKSkge1xuICAgIC8vIElmIGJhc2VIcmVmIG9yIGRlcGxveVVybCBpcyBhYnNvbHV0ZSwgdW5zdXBwb3J0ZWQgYnkgbmcgc2VydmVcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIG5vcm1hbGl6ZSBiYXNlSHJlZlxuICAvLyBmb3Igbmcgc2VydmUgdGhlIHN0YXJ0aW5nIGJhc2UgaXMgYWx3YXlzIGAvYCBzbyBhIHJlbGF0aXZlXG4gIC8vIGFuZCByb290IHJlbGF0aXZlIHZhbHVlIGFyZSBpZGVudGljYWxcbiAgY29uc3QgYmFzZUhyZWZQYXJ0cyA9IChiYXNlSHJlZiB8fCAnJykuc3BsaXQoJy8nKS5maWx0ZXIoKHBhcnQpID0+IHBhcnQgIT09ICcnKTtcbiAgaWYgKGJhc2VIcmVmICYmICFiYXNlSHJlZi5lbmRzV2l0aCgnLycpKSB7XG4gICAgYmFzZUhyZWZQYXJ0cy5wb3AoKTtcbiAgfVxuICBjb25zdCBub3JtYWxpemVkQmFzZUhyZWYgPSBiYXNlSHJlZlBhcnRzLmxlbmd0aCA9PT0gMCA/ICcvJyA6IGAvJHtiYXNlSHJlZlBhcnRzLmpvaW4oJy8nKX0vYDtcblxuICBpZiAoZGVwbG95VXJsICYmIGRlcGxveVVybFswXSA9PT0gJy8nKSB7XG4gICAgaWYgKGJhc2VIcmVmICYmIGJhc2VIcmVmWzBdID09PSAnLycgJiYgbm9ybWFsaXplZEJhc2VIcmVmICE9PSBkZXBsb3lVcmwpIHtcbiAgICAgIC8vIElmIGJhc2VIcmVmIGFuZCBkZXBsb3lVcmwgYXJlIHJvb3QgcmVsYXRpdmUgYW5kIG5vdCBlcXVpdmFsZW50LCB1bnN1cHBvcnRlZCBieSBuZyBzZXJ2ZVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlcGxveVVybDtcbiAgfVxuXG4gIC8vIEpvaW4gdG9nZXRoZXIgYmFzZUhyZWYgYW5kIGRlcGxveVVybFxuICByZXR1cm4gYCR7bm9ybWFsaXplZEJhc2VIcmVmfSR7ZGVwbG95VXJsIHx8ICcnfWA7XG59XG5cbmZ1bmN0aW9uIGdldEFsbG93ZWRIb3N0c0NvbmZpZyhcbiAgb3B0aW9uczogV2VicGFja0RldlNlcnZlck9wdGlvbnMsXG4pOiBEZXZTZXJ2ZXJDb25maWd1cmF0aW9uWydhbGxvd2VkSG9zdHMnXSB7XG4gIGlmIChvcHRpb25zLmRpc2FibGVIb3N0Q2hlY2spIHtcbiAgICByZXR1cm4gJ2FsbCc7XG4gIH0gZWxzZSBpZiAob3B0aW9ucy5hbGxvd2VkSG9zdHM/Lmxlbmd0aCkge1xuICAgIHJldHVybiBvcHRpb25zLmFsbG93ZWRIb3N0cztcbiAgfVxuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGdldFdlYlNvY2tldFNldHRpbmdzKFxuICBvcHRpb25zOiBXZWJwYWNrRGV2U2VydmVyT3B0aW9ucyxcbiAgc2VydmVQYXRoOiBzdHJpbmcsXG4pOiB7XG4gIHdlYlNvY2tldFNlcnZlcj86IERldlNlcnZlckNvbmZpZ3VyYXRpb25bJ3dlYlNvY2tldFNlcnZlciddO1xuICBjbGllbnQ/OiBEZXZTZXJ2ZXJDb25maWd1cmF0aW9uWydjbGllbnQnXTtcbn0ge1xuICBjb25zdCB7IGhtciwgbGl2ZVJlbG9hZCB9ID0gb3B0aW9ucztcbiAgaWYgKCFobXIgJiYgIWxpdmVSZWxvYWQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgd2ViU29ja2V0U2VydmVyOiBmYWxzZSxcbiAgICAgIGNsaWVudDogdW5kZWZpbmVkLFxuICAgIH07XG4gIH1cblxuICBjb25zdCB3ZWJTb2NrZXRQYXRoID0gcG9zaXguam9pbihzZXJ2ZVBhdGgsICd3cycpO1xuXG4gIHJldHVybiB7XG4gICAgd2ViU29ja2V0U2VydmVyOiB7XG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIHBhdGg6IHdlYlNvY2tldFBhdGgsXG4gICAgICB9LFxuICAgIH0sXG4gICAgY2xpZW50OiB7XG4gICAgICBsb2dnaW5nOiAnaW5mbycsXG4gICAgICB3ZWJTb2NrZXRVUkw6IGdldFB1YmxpY0hvc3RPcHRpb25zKG9wdGlvbnMsIHdlYlNvY2tldFBhdGgpLFxuICAgICAgb3ZlcmxheToge1xuICAgICAgICBlcnJvcnM6IHRydWUsXG4gICAgICAgIHdhcm5pbmdzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0UHVibGljSG9zdE9wdGlvbnMob3B0aW9uczogV2VicGFja0RldlNlcnZlck9wdGlvbnMsIHdlYlNvY2tldFBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCBwdWJsaWNIb3N0OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkID0gb3B0aW9ucy5wdWJsaWNIb3N0O1xuICBpZiAocHVibGljSG9zdCkge1xuICAgIGNvbnN0IGhvc3RXaXRoUHJvdG9jb2wgPSAhL15cXHcrOlxcL1xcLy8udGVzdChwdWJsaWNIb3N0KSA/IGBodHRwczovLyR7cHVibGljSG9zdH1gIDogcHVibGljSG9zdDtcbiAgICBwdWJsaWNIb3N0ID0gbmV3IFVSTChob3N0V2l0aFByb3RvY29sKS5ob3N0O1xuICB9XG5cbiAgcmV0dXJuIGBhdXRvOi8vJHtwdWJsaWNIb3N0IHx8ICcwLjAuMC4wOjAnfSR7d2ViU29ja2V0UGF0aH1gO1xufVxuIl19