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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2LXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svY29uZmlncy9kZXYtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsK0NBQXFEO0FBQ3JELDJCQUF3RDtBQUN4RCwrQkFBK0M7QUFDL0MsNkJBQXlDO0FBSXpDLDZDQUFrRDtBQUNsRCxtREFBcUQ7QUFDckQsK0VBQXdFO0FBQ3hFLDBEQUFzRDtBQUUvQyxLQUFLLFVBQVUsa0JBQWtCLENBQ3RDLEdBQWtEO0lBRWxELE1BQU0sRUFDSixZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxFQUN2RixNQUFNLEVBQ04sSUFBSSxHQUNMLEdBQUcsR0FBRyxDQUFDO0lBRVIsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFM0QsTUFBTSxVQUFVLEdBQWtCLEVBQUUsQ0FBQztJQUNyQyxJQUFJLEdBQUcsRUFBRTtRQUNQLFVBQVUsQ0FBQyxJQUFJLENBQUM7WUFDZCxNQUFNLEVBQUUsc0JBQVM7WUFDakIsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFBLGNBQU8sRUFBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1NBQ2pELENBQUMsQ0FBQztLQUNKO0lBRUQsTUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDO0lBQ3hCLElBQUksQ0FBQyxLQUFLLEVBQUU7UUFDVix5RUFB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XG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgbG9nZ2luZywgdGFncyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IGV4aXN0c1N5bmMsIHByb21pc2VzIGFzIGZzUHJvbWlzZXMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBleHRuYW1lLCBwb3NpeCwgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgVVJMLCBwYXRoVG9GaWxlVVJMIH0gZnJvbSAndXJsJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb24sIFJ1bGVTZXRSdWxlIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uIGFzIERldlNlcnZlckNvbmZpZ3VyYXRpb24gfSBmcm9tICd3ZWJwYWNrLWRldi1zZXJ2ZXInO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMsIFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcbmltcG9ydCB7IGdldEluZGV4T3V0cHV0RmlsZSB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgSG1yTG9hZGVyIH0gZnJvbSAnLi4vcGx1Z2lucy9obXIvaG1yLWxvYWRlcic7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXREZXZTZXJ2ZXJDb25maWcoXG4gIHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnM8V2VicGFja0RldlNlcnZlck9wdGlvbnM+LFxuKTogUHJvbWlzZTxDb25maWd1cmF0aW9uPiB7XG4gIGNvbnN0IHtcbiAgICBidWlsZE9wdGlvbnM6IHsgaG9zdCwgcG9ydCwgaW5kZXgsIGhlYWRlcnMsIHdhdGNoLCBobXIsIG1haW4sIGxpdmVSZWxvYWQsIHByb3h5Q29uZmlnIH0sXG4gICAgbG9nZ2VyLFxuICAgIHJvb3QsXG4gIH0gPSB3Y287XG5cbiAgY29uc3Qgc2VydmVQYXRoID0gYnVpbGRTZXJ2ZVBhdGgod2NvLmJ1aWxkT3B0aW9ucywgbG9nZ2VyKTtcblxuICBjb25zdCBleHRyYVJ1bGVzOiBSdWxlU2V0UnVsZVtdID0gW107XG4gIGlmIChobXIpIHtcbiAgICBleHRyYVJ1bGVzLnB1c2goe1xuICAgICAgbG9hZGVyOiBIbXJMb2FkZXIsXG4gICAgICBpbmNsdWRlOiBbbWFpbl0ubWFwKChwKSA9PiByZXNvbHZlKHdjby5yb290LCBwKSksXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBleHRyYVBsdWdpbnMgPSBbXTtcbiAgaWYgKCF3YXRjaCkge1xuICAgIC8vIFRoZXJlJ3Mgbm8gb3B0aW9uIHRvIHR1cm4gb2ZmIGZpbGUgd2F0Y2hpbmcgaW4gd2VicGFjay1kZXYtc2VydmVyLCBidXRcbiAgICAvLyB3ZSBjYW4gb3ZlcnJpZGUgdGhlIGZpbGUgd2F0Y2hlciBpbnN0ZWFkLlxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKHtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICBhcHBseTogKGNvbXBpbGVyOiBhbnkpID0+IHtcbiAgICAgICAgY29tcGlsZXIuaG9va3MuYWZ0ZXJFbnZpcm9ubWVudC50YXAoJ2FuZ3VsYXItY2xpJywgKCkgPT4ge1xuICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZW1wdHktZnVuY3Rpb25cbiAgICAgICAgICBjb21waWxlci53YXRjaEZpbGVTeXN0ZW0gPSB7IHdhdGNoOiAoKSA9PiB7fSB9O1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2lucyxcbiAgICBtb2R1bGU6IHtcbiAgICAgIHJ1bGVzOiBleHRyYVJ1bGVzLFxuICAgIH0sXG4gICAgZGV2U2VydmVyOiB7XG4gICAgICBob3N0LFxuICAgICAgcG9ydCxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAgICAgLi4uaGVhZGVycyxcbiAgICAgIH0sXG4gICAgICBoaXN0b3J5QXBpRmFsbGJhY2s6ICEhaW5kZXggJiYge1xuICAgICAgICBpbmRleDogcG9zaXguam9pbihzZXJ2ZVBhdGgsIGdldEluZGV4T3V0cHV0RmlsZShpbmRleCkpLFxuICAgICAgICBkaXNhYmxlRG90UnVsZTogdHJ1ZSxcbiAgICAgICAgaHRtbEFjY2VwdEhlYWRlcnM6IFsndGV4dC9odG1sJywgJ2FwcGxpY2F0aW9uL3hodG1sK3htbCddLFxuICAgICAgICByZXdyaXRlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGZyb206IG5ldyBSZWdFeHAoYF4oPyEke3NlcnZlUGF0aH0pLy4qYCksXG4gICAgICAgICAgICB0bzogKGNvbnRleHQpID0+IGNvbnRleHQucGFyc2VkVXJsLmhyZWYsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICBjb21wcmVzczogZmFsc2UsXG4gICAgICBzdGF0aWM6IGZhbHNlLFxuICAgICAgc2VydmVyOiBnZXRTZXJ2ZXJDb25maWcocm9vdCwgd2NvLmJ1aWxkT3B0aW9ucyksXG4gICAgICBhbGxvd2VkSG9zdHM6IGdldEFsbG93ZWRIb3N0c0NvbmZpZyh3Y28uYnVpbGRPcHRpb25zKSxcbiAgICAgIGRldk1pZGRsZXdhcmU6IHtcbiAgICAgICAgcHVibGljUGF0aDogc2VydmVQYXRoLFxuICAgICAgICBzdGF0czogZmFsc2UsXG4gICAgICB9LFxuICAgICAgbGl2ZVJlbG9hZCxcbiAgICAgIGhvdDogaG1yICYmICFsaXZlUmVsb2FkID8gJ29ubHknIDogaG1yLFxuICAgICAgcHJveHk6IGF3YWl0IGFkZFByb3h5Q29uZmlnKHJvb3QsIHByb3h5Q29uZmlnKSxcbiAgICAgIC4uLmdldFdlYlNvY2tldFNldHRpbmdzKHdjby5idWlsZE9wdGlvbnMsIHNlcnZlUGF0aCksXG4gICAgfSxcbiAgfTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlIGFuZCBidWlsZCBhIFVSTCBfcGF0aF8gdGhhdCB3aWxsIGJlIHRoZSByb290IG9mIHRoZSBzZXJ2ZXIuIFRoaXMgcmVzb2x2ZWQgYmFzZSBocmVmIGFuZFxuICogZGVwbG95IFVSTCBmcm9tIHRoZSBicm93c2VyIG9wdGlvbnMgYW5kIHJldHVybnMgYSBwYXRoIGZyb20gdGhlIHJvb3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFNlcnZlUGF0aChcbiAgb3B0aW9uczogV2VicGFja0RldlNlcnZlck9wdGlvbnMsXG4gIGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXJBcGksXG4pOiBzdHJpbmcge1xuICBsZXQgc2VydmVQYXRoID0gb3B0aW9ucy5zZXJ2ZVBhdGg7XG4gIGlmIChzZXJ2ZVBhdGggPT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IGRlZmF1bHRQYXRoID0gZmluZERlZmF1bHRTZXJ2ZVBhdGgob3B0aW9ucy5iYXNlSHJlZiwgb3B0aW9ucy5kZXBsb3lVcmwpO1xuICAgIGlmIChkZWZhdWx0UGF0aCA9PSBudWxsKSB7XG4gICAgICBsb2dnZXIud2Fybih0YWdzLm9uZUxpbmVgXG4gICAgICAgIFdhcm5pbmc6IC0tZGVwbG95LXVybCBhbmQvb3IgLS1iYXNlLWhyZWYgY29udGFpbiB1bnN1cHBvcnRlZCB2YWx1ZXMgZm9yIG5nIHNlcnZlLiBEZWZhdWx0XG4gICAgICAgIHNlcnZlIHBhdGggb2YgJy8nIHVzZWQuIFVzZSAtLXNlcnZlLXBhdGggdG8gb3ZlcnJpZGUuXG4gICAgICBgKTtcbiAgICB9XG4gICAgc2VydmVQYXRoID0gZGVmYXVsdFBhdGggfHwgJyc7XG4gIH1cblxuICBpZiAoc2VydmVQYXRoLmVuZHNXaXRoKCcvJykpIHtcbiAgICBzZXJ2ZVBhdGggPSBzZXJ2ZVBhdGguc2xpY2UoMCwgLTEpO1xuICB9XG5cbiAgaWYgKCFzZXJ2ZVBhdGguc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgc2VydmVQYXRoID0gYC8ke3NlcnZlUGF0aH1gO1xuICB9XG5cbiAgcmV0dXJuIHNlcnZlUGF0aDtcbn1cblxuLyoqXG4gKiBQcml2YXRlIG1ldGhvZCB0byBlbmhhbmNlIGEgd2VicGFjayBjb25maWcgd2l0aCBTU0wgY29uZmlndXJhdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGdldFNlcnZlckNvbmZpZyhcbiAgcm9vdDogc3RyaW5nLFxuICBvcHRpb25zOiBXZWJwYWNrRGV2U2VydmVyT3B0aW9ucyxcbik6IERldlNlcnZlckNvbmZpZ3VyYXRpb25bJ3NlcnZlciddIHtcbiAgY29uc3QgeyBzc2wsIHNzbENlcnQsIHNzbEtleSB9ID0gb3B0aW9ucztcbiAgaWYgKCFzc2wpIHtcbiAgICByZXR1cm4gJ2h0dHAnO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnaHR0cHMnLFxuICAgIG9wdGlvbnM6XG4gICAgICBzc2xDZXJ0ICYmIHNzbEtleVxuICAgICAgICA/IHtcbiAgICAgICAgICAgIGtleTogcmVzb2x2ZShyb290LCBzc2xLZXkpLFxuICAgICAgICAgICAgY2VydDogcmVzb2x2ZShyb290LCBzc2xDZXJ0KSxcbiAgICAgICAgICB9XG4gICAgICAgIDogdW5kZWZpbmVkLFxuICB9O1xufVxuXG4vKipcbiAqIFByaXZhdGUgbWV0aG9kIHRvIGVuaGFuY2UgYSB3ZWJwYWNrIGNvbmZpZyB3aXRoIFByb3h5IGNvbmZpZ3VyYXRpb24uXG4gKiBAcHJpdmF0ZVxuICovXG5hc3luYyBmdW5jdGlvbiBhZGRQcm94eUNvbmZpZyhyb290OiBzdHJpbmcsIHByb3h5Q29uZmlnOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcbiAgaWYgKCFwcm94eUNvbmZpZykge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICBjb25zdCBwcm94eVBhdGggPSByZXNvbHZlKHJvb3QsIHByb3h5Q29uZmlnKTtcblxuICBpZiAoIWV4aXN0c1N5bmMocHJveHlQYXRoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgUHJveHkgY29uZmlndXJhdGlvbiBmaWxlICR7cHJveHlQYXRofSBkb2VzIG5vdCBleGlzdC5gKTtcbiAgfVxuXG4gIHN3aXRjaCAoZXh0bmFtZShwcm94eVBhdGgpKSB7XG4gICAgY2FzZSAnLmpzb24nOiB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgZnNQcm9taXNlcy5yZWFkRmlsZShwcm94eVBhdGgsICd1dGYtOCcpO1xuXG4gICAgICBjb25zdCB7IHBhcnNlLCBwcmludFBhcnNlRXJyb3JDb2RlIH0gPSBhd2FpdCBpbXBvcnQoJ2pzb25jLXBhcnNlcicpO1xuICAgICAgY29uc3QgcGFyc2VFcnJvcnM6IGltcG9ydCgnanNvbmMtcGFyc2VyJykuUGFyc2VFcnJvcltdID0gW107XG4gICAgICBjb25zdCBwcm94eUNvbmZpZ3VyYXRpb24gPSBwYXJzZShjb250ZW50LCBwYXJzZUVycm9ycywgeyBhbGxvd1RyYWlsaW5nQ29tbWE6IHRydWUgfSk7XG5cbiAgICAgIGlmIChwYXJzZUVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGxldCBlcnJvck1lc3NhZ2UgPSBgUHJveHkgY29uZmlndXJhdGlvbiBmaWxlICR7cHJveHlQYXRofSBjb250YWlucyBwYXJzZSBlcnJvcnM6YDtcbiAgICAgICAgZm9yIChjb25zdCBwYXJzZUVycm9yIG9mIHBhcnNlRXJyb3JzKSB7XG4gICAgICAgICAgY29uc3QgeyBsaW5lLCBjb2x1bW4gfSA9IGdldEpzb25FcnJvckxpbmVDb2x1bW4ocGFyc2VFcnJvci5vZmZzZXQsIGNvbnRlbnQpO1xuICAgICAgICAgIGVycm9yTWVzc2FnZSArPSBgXFxuWyR7bGluZX0sICR7Y29sdW1ufV0gJHtwcmludFBhcnNlRXJyb3JDb2RlKHBhcnNlRXJyb3IuZXJyb3IpfWA7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9yTWVzc2FnZSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwcm94eUNvbmZpZ3VyYXRpb247XG4gICAgfVxuICAgIGNhc2UgJy5tanMnOlxuICAgICAgLy8gTG9hZCB0aGUgRVNNIGNvbmZpZ3VyYXRpb24gZmlsZSB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgICAgIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gICAgICByZXR1cm4gKGF3YWl0IGxvYWRFc21Nb2R1bGU8eyBkZWZhdWx0OiB1bmtub3duIH0+KHBhdGhUb0ZpbGVVUkwocHJveHlQYXRoKSkpLmRlZmF1bHQ7XG4gICAgY2FzZSAnLmNqcyc6XG4gICAgICByZXR1cm4gcmVxdWlyZShwcm94eVBhdGgpO1xuICAgIGRlZmF1bHQ6XG4gICAgICAvLyBUaGUgZmlsZSBjb3VsZCBiZSBlaXRoZXIgQ29tbW9uSlMgb3IgRVNNLlxuICAgICAgLy8gQ29tbW9uSlMgaXMgdHJpZWQgZmlyc3QgdGhlbiBFU00gaWYgbG9hZGluZyBmYWlscy5cbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiByZXF1aXJlKHByb3h5UGF0aCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGFzc2VydElzRXJyb3IoZSk7XG4gICAgICAgIGlmIChlLmNvZGUgPT09ICdFUlJfUkVRVUlSRV9FU00nKSB7XG4gICAgICAgICAgLy8gTG9hZCB0aGUgRVNNIGNvbmZpZ3VyYXRpb24gZmlsZSB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgICAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgICAgICAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgICAgICAgICByZXR1cm4gKGF3YWl0IGxvYWRFc21Nb2R1bGU8eyBkZWZhdWx0OiB1bmtub3duIH0+KHBhdGhUb0ZpbGVVUkwocHJveHlQYXRoKSkpLmRlZmF1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICB9XG59XG5cbi8qKlxuICogQ2FsY3VsYXRlcyB0aGUgbGluZSBhbmQgY29sdW1uIGZvciBhbiBlcnJvciBvZmZzZXQgaW4gdGhlIGNvbnRlbnQgb2YgYSBKU09OIGZpbGUuXG4gKiBAcGFyYW0gbG9jYXRpb24gVGhlIG9mZnNldCBlcnJvciBsb2NhdGlvbiBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGNvbnRlbnQuXG4gKiBAcGFyYW0gY29udGVudCBUaGUgZnVsbCBjb250ZW50IG9mIHRoZSBmaWxlIGNvbnRhaW5pbmcgdGhlIGVycm9yLlxuICogQHJldHVybnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIGxpbmUgYW5kIGNvbHVtblxuICovXG5mdW5jdGlvbiBnZXRKc29uRXJyb3JMaW5lQ29sdW1uKG9mZnNldDogbnVtYmVyLCBjb250ZW50OiBzdHJpbmcpIHtcbiAgaWYgKG9mZnNldCA9PT0gMCkge1xuICAgIHJldHVybiB7IGxpbmU6IDEsIGNvbHVtbjogMSB9O1xuICB9XG5cbiAgbGV0IGxpbmUgPSAwO1xuICBsZXQgcG9zaXRpb24gPSAwO1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgKytsaW5lO1xuXG4gICAgY29uc3QgbmV4dE5ld2xpbmUgPSBjb250ZW50LmluZGV4T2YoJ1xcbicsIHBvc2l0aW9uKTtcbiAgICBpZiAobmV4dE5ld2xpbmUgPT09IC0xIHx8IG5leHROZXdsaW5lID4gb2Zmc2V0KSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBwb3NpdGlvbiA9IG5leHROZXdsaW5lICsgMTtcbiAgfVxuXG4gIHJldHVybiB7IGxpbmUsIGNvbHVtbjogb2Zmc2V0IC0gcG9zaXRpb24gKyAxIH07XG59XG5cbi8qKlxuICogRmluZCB0aGUgZGVmYXVsdCBzZXJ2ZXIgcGF0aC4gV2UgZG9uJ3Qgd2FudCB0byBleHBvc2UgYmFzZUhyZWYgYW5kIGRlcGxveVVybCBhcyBhcmd1bWVudHMsIG9ubHlcbiAqIHRoZSBicm93c2VyIG9wdGlvbnMgd2hlcmUgbmVlZGVkLiBUaGlzIG1ldGhvZCBzaG91bGQgc3RheSBwcml2YXRlIChwZW9wbGUgd2hvIHdhbnQgdG8gcmVzb2x2ZVxuICogYmFzZUhyZWYgYW5kIGRlcGxveVVybCBzaG91bGQgdXNlIHRoZSBidWlsZFNlcnZlUGF0aCBleHBvcnRlZCBmdW5jdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGZpbmREZWZhdWx0U2VydmVQYXRoKGJhc2VIcmVmPzogc3RyaW5nLCBkZXBsb3lVcmw/OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgaWYgKCFiYXNlSHJlZiAmJiAhZGVwbG95VXJsKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgaWYgKC9eKFxcdys6KT9cXC9cXC8vLnRlc3QoYmFzZUhyZWYgfHwgJycpIHx8IC9eKFxcdys6KT9cXC9cXC8vLnRlc3QoZGVwbG95VXJsIHx8ICcnKSkge1xuICAgIC8vIElmIGJhc2VIcmVmIG9yIGRlcGxveVVybCBpcyBhYnNvbHV0ZSwgdW5zdXBwb3J0ZWQgYnkgbmcgc2VydmVcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIG5vcm1hbGl6ZSBiYXNlSHJlZlxuICAvLyBmb3Igbmcgc2VydmUgdGhlIHN0YXJ0aW5nIGJhc2UgaXMgYWx3YXlzIGAvYCBzbyBhIHJlbGF0aXZlXG4gIC8vIGFuZCByb290IHJlbGF0aXZlIHZhbHVlIGFyZSBpZGVudGljYWxcbiAgY29uc3QgYmFzZUhyZWZQYXJ0cyA9IChiYXNlSHJlZiB8fCAnJykuc3BsaXQoJy8nKS5maWx0ZXIoKHBhcnQpID0+IHBhcnQgIT09ICcnKTtcbiAgaWYgKGJhc2VIcmVmICYmICFiYXNlSHJlZi5lbmRzV2l0aCgnLycpKSB7XG4gICAgYmFzZUhyZWZQYXJ0cy5wb3AoKTtcbiAgfVxuICBjb25zdCBub3JtYWxpemVkQmFzZUhyZWYgPSBiYXNlSHJlZlBhcnRzLmxlbmd0aCA9PT0gMCA/ICcvJyA6IGAvJHtiYXNlSHJlZlBhcnRzLmpvaW4oJy8nKX0vYDtcblxuICBpZiAoZGVwbG95VXJsICYmIGRlcGxveVVybFswXSA9PT0gJy8nKSB7XG4gICAgaWYgKGJhc2VIcmVmICYmIGJhc2VIcmVmWzBdID09PSAnLycgJiYgbm9ybWFsaXplZEJhc2VIcmVmICE9PSBkZXBsb3lVcmwpIHtcbiAgICAgIC8vIElmIGJhc2VIcmVmIGFuZCBkZXBsb3lVcmwgYXJlIHJvb3QgcmVsYXRpdmUgYW5kIG5vdCBlcXVpdmFsZW50LCB1bnN1cHBvcnRlZCBieSBuZyBzZXJ2ZVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlcGxveVVybDtcbiAgfVxuXG4gIC8vIEpvaW4gdG9nZXRoZXIgYmFzZUhyZWYgYW5kIGRlcGxveVVybFxuICByZXR1cm4gYCR7bm9ybWFsaXplZEJhc2VIcmVmfSR7ZGVwbG95VXJsIHx8ICcnfWA7XG59XG5cbmZ1bmN0aW9uIGdldEFsbG93ZWRIb3N0c0NvbmZpZyhcbiAgb3B0aW9uczogV2VicGFja0RldlNlcnZlck9wdGlvbnMsXG4pOiBEZXZTZXJ2ZXJDb25maWd1cmF0aW9uWydhbGxvd2VkSG9zdHMnXSB7XG4gIGlmIChvcHRpb25zLmRpc2FibGVIb3N0Q2hlY2spIHtcbiAgICByZXR1cm4gJ2FsbCc7XG4gIH0gZWxzZSBpZiAob3B0aW9ucy5hbGxvd2VkSG9zdHM/Lmxlbmd0aCkge1xuICAgIHJldHVybiBvcHRpb25zLmFsbG93ZWRIb3N0cztcbiAgfVxuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGdldFdlYlNvY2tldFNldHRpbmdzKFxuICBvcHRpb25zOiBXZWJwYWNrRGV2U2VydmVyT3B0aW9ucyxcbiAgc2VydmVQYXRoOiBzdHJpbmcsXG4pOiB7XG4gIHdlYlNvY2tldFNlcnZlcj86IERldlNlcnZlckNvbmZpZ3VyYXRpb25bJ3dlYlNvY2tldFNlcnZlciddO1xuICBjbGllbnQ/OiBEZXZTZXJ2ZXJDb25maWd1cmF0aW9uWydjbGllbnQnXTtcbn0ge1xuICBjb25zdCB7IGhtciwgbGl2ZVJlbG9hZCB9ID0gb3B0aW9ucztcbiAgaWYgKCFobXIgJiYgIWxpdmVSZWxvYWQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgd2ViU29ja2V0U2VydmVyOiBmYWxzZSxcbiAgICAgIGNsaWVudDogdW5kZWZpbmVkLFxuICAgIH07XG4gIH1cblxuICBjb25zdCB3ZWJTb2NrZXRQYXRoID0gcG9zaXguam9pbihzZXJ2ZVBhdGgsICduZy1jbGktd3MnKTtcblxuICByZXR1cm4ge1xuICAgIHdlYlNvY2tldFNlcnZlcjoge1xuICAgICAgb3B0aW9uczoge1xuICAgICAgICBwYXRoOiB3ZWJTb2NrZXRQYXRoLFxuICAgICAgfSxcbiAgICB9LFxuICAgIGNsaWVudDoge1xuICAgICAgbG9nZ2luZzogJ2luZm8nLFxuICAgICAgd2ViU29ja2V0VVJMOiBnZXRQdWJsaWNIb3N0T3B0aW9ucyhvcHRpb25zLCB3ZWJTb2NrZXRQYXRoKSxcbiAgICAgIG92ZXJsYXk6IHtcbiAgICAgICAgZXJyb3JzOiB0cnVlLFxuICAgICAgICB3YXJuaW5nczogZmFsc2UsXG4gICAgICB9LFxuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGdldFB1YmxpY0hvc3RPcHRpb25zKG9wdGlvbnM6IFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zLCB3ZWJTb2NrZXRQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICBsZXQgcHVibGljSG9zdDogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCA9IG9wdGlvbnMucHVibGljSG9zdDtcbiAgaWYgKHB1YmxpY0hvc3QpIHtcbiAgICBjb25zdCBob3N0V2l0aFByb3RvY29sID0gIS9eXFx3KzpcXC9cXC8vLnRlc3QocHVibGljSG9zdCkgPyBgaHR0cHM6Ly8ke3B1YmxpY0hvc3R9YCA6IHB1YmxpY0hvc3Q7XG4gICAgcHVibGljSG9zdCA9IG5ldyBVUkwoaG9zdFdpdGhQcm90b2NvbCkuaG9zdDtcbiAgfVxuXG4gIHJldHVybiBgYXV0bzovLyR7cHVibGljSG9zdCB8fCAnMC4wLjAuMDowJ30ke3dlYlNvY2tldFBhdGh9YDtcbn1cbiJdfQ==