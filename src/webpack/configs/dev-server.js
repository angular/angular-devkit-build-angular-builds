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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2LXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svY29uZmlncy9kZXYtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsK0NBQXFEO0FBQ3JELDJCQUF3RDtBQUN4RCwrQkFBK0M7QUFDL0MsNkJBQXlDO0FBU3pDLDZDQUFrRDtBQUNsRCxtREFBcUQ7QUFDckQsK0VBQXdFO0FBQ3hFLDBEQUFzRDtBQUUvQyxLQUFLLFVBQVUsa0JBQWtCLENBQ3RDLEdBQWtEO0lBRWxELE1BQU0sRUFDSixZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxFQUN2RixNQUFNLEVBQ04sSUFBSSxHQUNMLEdBQUcsR0FBRyxDQUFDO0lBRVIsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFM0QsTUFBTSxVQUFVLEdBQWtCLEVBQUUsQ0FBQztJQUNyQyxJQUFJLEdBQUcsRUFBRTtRQUNQLFVBQVUsQ0FBQyxJQUFJLENBQUM7WUFDZCxNQUFNLEVBQUUsc0JBQVM7WUFDakIsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFBLGNBQU8sRUFBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1NBQ2pELENBQUMsQ0FBQztLQUNKO0lBRUQsTUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDO0lBQ3hCLElBQUksQ0FBQyxLQUFLLEVBQUU7UUFDVix5RUFB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YUFBYSxFQUFFLENBQUM7QUFDL0QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBsb2dnaW5nLCB0YWdzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgZXhpc3RzU3luYywgcHJvbWlzZXMgYXMgZnNQcm9taXNlcyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IGV4dG5hbWUsIHBvc2l4LCByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBVUkwsIHBhdGhUb0ZpbGVVUkwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiwgUnVsZVNldFJ1bGUgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB0eXBlIHtcbiAgQ29uZmlndXJhdGlvbiBhcyBEZXZTZXJ2ZXJDb25maWd1cmF0aW9uLFxuICBOZXh0RnVuY3Rpb24sXG4gIFJlcXVlc3QsXG4gIFJlc3BvbnNlLFxufSBmcm9tICd3ZWJwYWNrLWRldi1zZXJ2ZXInO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMsIFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcbmltcG9ydCB7IGdldEluZGV4T3V0cHV0RmlsZSB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgSG1yTG9hZGVyIH0gZnJvbSAnLi4vcGx1Z2lucy9obXIvaG1yLWxvYWRlcic7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXREZXZTZXJ2ZXJDb25maWcoXG4gIHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnM8V2VicGFja0RldlNlcnZlck9wdGlvbnM+LFxuKTogUHJvbWlzZTxDb25maWd1cmF0aW9uPiB7XG4gIGNvbnN0IHtcbiAgICBidWlsZE9wdGlvbnM6IHsgaG9zdCwgcG9ydCwgaW5kZXgsIGhlYWRlcnMsIHdhdGNoLCBobXIsIG1haW4sIGxpdmVSZWxvYWQsIHByb3h5Q29uZmlnIH0sXG4gICAgbG9nZ2VyLFxuICAgIHJvb3QsXG4gIH0gPSB3Y287XG5cbiAgY29uc3Qgc2VydmVQYXRoID0gYnVpbGRTZXJ2ZVBhdGgod2NvLmJ1aWxkT3B0aW9ucywgbG9nZ2VyKTtcblxuICBjb25zdCBleHRyYVJ1bGVzOiBSdWxlU2V0UnVsZVtdID0gW107XG4gIGlmIChobXIpIHtcbiAgICBleHRyYVJ1bGVzLnB1c2goe1xuICAgICAgbG9hZGVyOiBIbXJMb2FkZXIsXG4gICAgICBpbmNsdWRlOiBbbWFpbl0ubWFwKChwKSA9PiByZXNvbHZlKHdjby5yb290LCBwKSksXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBleHRyYVBsdWdpbnMgPSBbXTtcbiAgaWYgKCF3YXRjaCkge1xuICAgIC8vIFRoZXJlJ3Mgbm8gb3B0aW9uIHRvIHR1cm4gb2ZmIGZpbGUgd2F0Y2hpbmcgaW4gd2VicGFjay1kZXYtc2VydmVyLCBidXRcbiAgICAvLyB3ZSBjYW4gb3ZlcnJpZGUgdGhlIGZpbGUgd2F0Y2hlciBpbnN0ZWFkLlxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKHtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICBhcHBseTogKGNvbXBpbGVyOiBhbnkpID0+IHtcbiAgICAgICAgY29tcGlsZXIuaG9va3MuYWZ0ZXJFbnZpcm9ubWVudC50YXAoJ2FuZ3VsYXItY2xpJywgKCkgPT4ge1xuICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZW1wdHktZnVuY3Rpb25cbiAgICAgICAgICBjb21waWxlci53YXRjaEZpbGVTeXN0ZW0gPSB7IHdhdGNoOiAoKSA9PiB7fSB9O1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2lucyxcbiAgICBtb2R1bGU6IHtcbiAgICAgIHJ1bGVzOiBleHRyYVJ1bGVzLFxuICAgIH0sXG4gICAgZGV2U2VydmVyOiB7XG4gICAgICBob3N0LFxuICAgICAgcG9ydCxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAgICAgLi4uaGVhZGVycyxcbiAgICAgIH0sXG4gICAgICBoaXN0b3J5QXBpRmFsbGJhY2s6ICEhaW5kZXggJiYge1xuICAgICAgICBpbmRleDogcG9zaXguam9pbihzZXJ2ZVBhdGgsIGdldEluZGV4T3V0cHV0RmlsZShpbmRleCkpLFxuICAgICAgICBkaXNhYmxlRG90UnVsZTogdHJ1ZSxcbiAgICAgICAgaHRtbEFjY2VwdEhlYWRlcnM6IFsndGV4dC9odG1sJywgJ2FwcGxpY2F0aW9uL3hodG1sK3htbCddLFxuICAgICAgICByZXdyaXRlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGZyb206IG5ldyBSZWdFeHAoYF4oPyEke3NlcnZlUGF0aH0pLy4qYCksXG4gICAgICAgICAgICB0bzogKGNvbnRleHQpID0+IGNvbnRleHQucGFyc2VkVXJsLmhyZWYsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICAvLyBXaGVuIHNldHVwRXhpdFNpZ25hbHMgaXMgZW5hYmxlZCB3ZWJwYWNrLWRldi1zZXJ2ZXIgd2lsbCBzaHV0ZG93biBncmFjZWZ1bGx5IHdoaWNoIHdvdWxkXG4gICAgICAvLyByZXF1aXJlIENUUkwrQyB0byBiZSBwcmVzc2VkIG11bHRpcGxlIHRpbWVzIHRvIGV4aXQuXG4gICAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LXNlcnZlci9ibG9iL2M3NmI2ZDExYTM4MjE0MzZjNWUyMDIwN2M4YTM4ZGViNmFiN2UzM2MvbGliL1NlcnZlci5qcyNMMTgwMS1MMTgyN1xuICAgICAgc2V0dXBFeGl0U2lnbmFsczogZmFsc2UsXG4gICAgICBjb21wcmVzczogZmFsc2UsXG4gICAgICBzdGF0aWM6IGZhbHNlLFxuICAgICAgc2VydmVyOiBnZXRTZXJ2ZXJDb25maWcocm9vdCwgd2NvLmJ1aWxkT3B0aW9ucyksXG4gICAgICBhbGxvd2VkSG9zdHM6IGdldEFsbG93ZWRIb3N0c0NvbmZpZyh3Y28uYnVpbGRPcHRpb25zKSxcbiAgICAgIGRldk1pZGRsZXdhcmU6IHtcbiAgICAgICAgcHVibGljUGF0aDogc2VydmVQYXRoLFxuICAgICAgICBzdGF0czogZmFsc2UsXG4gICAgICB9LFxuICAgICAgbGl2ZVJlbG9hZCxcbiAgICAgIGhvdDogaG1yICYmICFsaXZlUmVsb2FkID8gJ29ubHknIDogaG1yLFxuICAgICAgcHJveHk6IGF3YWl0IGFkZFByb3h5Q29uZmlnKHJvb3QsIHByb3h5Q29uZmlnKSxcbiAgICAgIC4uLmdldFdlYlNvY2tldFNldHRpbmdzKHdjby5idWlsZE9wdGlvbnMsIHNlcnZlUGF0aCksXG4gICAgfSxcbiAgfTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlIGFuZCBidWlsZCBhIFVSTCBfcGF0aF8gdGhhdCB3aWxsIGJlIHRoZSByb290IG9mIHRoZSBzZXJ2ZXIuIFRoaXMgcmVzb2x2ZWQgYmFzZSBocmVmIGFuZFxuICogZGVwbG95IFVSTCBmcm9tIHRoZSBicm93c2VyIG9wdGlvbnMgYW5kIHJldHVybnMgYSBwYXRoIGZyb20gdGhlIHJvb3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFNlcnZlUGF0aChcbiAgb3B0aW9uczogV2VicGFja0RldlNlcnZlck9wdGlvbnMsXG4gIGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXJBcGksXG4pOiBzdHJpbmcge1xuICBsZXQgc2VydmVQYXRoID0gb3B0aW9ucy5zZXJ2ZVBhdGg7XG4gIGlmIChzZXJ2ZVBhdGggPT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IGRlZmF1bHRQYXRoID0gZmluZERlZmF1bHRTZXJ2ZVBhdGgob3B0aW9ucy5iYXNlSHJlZiwgb3B0aW9ucy5kZXBsb3lVcmwpO1xuICAgIGlmIChkZWZhdWx0UGF0aCA9PSBudWxsKSB7XG4gICAgICBsb2dnZXIud2Fybih0YWdzLm9uZUxpbmVgXG4gICAgICAgIFdhcm5pbmc6IC0tZGVwbG95LXVybCBhbmQvb3IgLS1iYXNlLWhyZWYgY29udGFpbiB1bnN1cHBvcnRlZCB2YWx1ZXMgZm9yIG5nIHNlcnZlLiBEZWZhdWx0XG4gICAgICAgIHNlcnZlIHBhdGggb2YgJy8nIHVzZWQuIFVzZSAtLXNlcnZlLXBhdGggdG8gb3ZlcnJpZGUuXG4gICAgICBgKTtcbiAgICB9XG4gICAgc2VydmVQYXRoID0gZGVmYXVsdFBhdGggfHwgJyc7XG4gIH1cblxuICBpZiAoc2VydmVQYXRoLmVuZHNXaXRoKCcvJykpIHtcbiAgICBzZXJ2ZVBhdGggPSBzZXJ2ZVBhdGguc2xpY2UoMCwgLTEpO1xuICB9XG5cbiAgaWYgKCFzZXJ2ZVBhdGguc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgc2VydmVQYXRoID0gYC8ke3NlcnZlUGF0aH1gO1xuICB9XG5cbiAgcmV0dXJuIHNlcnZlUGF0aDtcbn1cblxuLyoqXG4gKiBQcml2YXRlIG1ldGhvZCB0byBlbmhhbmNlIGEgd2VicGFjayBjb25maWcgd2l0aCBTU0wgY29uZmlndXJhdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGdldFNlcnZlckNvbmZpZyhcbiAgcm9vdDogc3RyaW5nLFxuICBvcHRpb25zOiBXZWJwYWNrRGV2U2VydmVyT3B0aW9ucyxcbik6IERldlNlcnZlckNvbmZpZ3VyYXRpb25bJ3NlcnZlciddIHtcbiAgY29uc3QgeyBzc2wsIHNzbENlcnQsIHNzbEtleSB9ID0gb3B0aW9ucztcbiAgaWYgKCFzc2wpIHtcbiAgICByZXR1cm4gJ2h0dHAnO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnaHR0cHMnLFxuICAgIG9wdGlvbnM6XG4gICAgICBzc2xDZXJ0ICYmIHNzbEtleVxuICAgICAgICA/IHtcbiAgICAgICAgICAgIGtleTogcmVzb2x2ZShyb290LCBzc2xLZXkpLFxuICAgICAgICAgICAgY2VydDogcmVzb2x2ZShyb290LCBzc2xDZXJ0KSxcbiAgICAgICAgICB9XG4gICAgICAgIDogdW5kZWZpbmVkLFxuICB9O1xufVxuXG4vKipcbiAqIFByaXZhdGUgbWV0aG9kIHRvIGVuaGFuY2UgYSB3ZWJwYWNrIGNvbmZpZyB3aXRoIFByb3h5IGNvbmZpZ3VyYXRpb24uXG4gKiBAcHJpdmF0ZVxuICovXG5hc3luYyBmdW5jdGlvbiBhZGRQcm94eUNvbmZpZyhyb290OiBzdHJpbmcsIHByb3h5Q29uZmlnOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcbiAgaWYgKCFwcm94eUNvbmZpZykge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICBjb25zdCBwcm94eVBhdGggPSByZXNvbHZlKHJvb3QsIHByb3h5Q29uZmlnKTtcblxuICBpZiAoIWV4aXN0c1N5bmMocHJveHlQYXRoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgUHJveHkgY29uZmlndXJhdGlvbiBmaWxlICR7cHJveHlQYXRofSBkb2VzIG5vdCBleGlzdC5gKTtcbiAgfVxuXG4gIHN3aXRjaCAoZXh0bmFtZShwcm94eVBhdGgpKSB7XG4gICAgY2FzZSAnLmpzb24nOiB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgZnNQcm9taXNlcy5yZWFkRmlsZShwcm94eVBhdGgsICd1dGYtOCcpO1xuXG4gICAgICBjb25zdCB7IHBhcnNlLCBwcmludFBhcnNlRXJyb3JDb2RlIH0gPSBhd2FpdCBpbXBvcnQoJ2pzb25jLXBhcnNlcicpO1xuICAgICAgY29uc3QgcGFyc2VFcnJvcnM6IGltcG9ydCgnanNvbmMtcGFyc2VyJykuUGFyc2VFcnJvcltdID0gW107XG4gICAgICBjb25zdCBwcm94eUNvbmZpZ3VyYXRpb24gPSBwYXJzZShjb250ZW50LCBwYXJzZUVycm9ycywgeyBhbGxvd1RyYWlsaW5nQ29tbWE6IHRydWUgfSk7XG5cbiAgICAgIGlmIChwYXJzZUVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGxldCBlcnJvck1lc3NhZ2UgPSBgUHJveHkgY29uZmlndXJhdGlvbiBmaWxlICR7cHJveHlQYXRofSBjb250YWlucyBwYXJzZSBlcnJvcnM6YDtcbiAgICAgICAgZm9yIChjb25zdCBwYXJzZUVycm9yIG9mIHBhcnNlRXJyb3JzKSB7XG4gICAgICAgICAgY29uc3QgeyBsaW5lLCBjb2x1bW4gfSA9IGdldEpzb25FcnJvckxpbmVDb2x1bW4ocGFyc2VFcnJvci5vZmZzZXQsIGNvbnRlbnQpO1xuICAgICAgICAgIGVycm9yTWVzc2FnZSArPSBgXFxuWyR7bGluZX0sICR7Y29sdW1ufV0gJHtwcmludFBhcnNlRXJyb3JDb2RlKHBhcnNlRXJyb3IuZXJyb3IpfWA7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9yTWVzc2FnZSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwcm94eUNvbmZpZ3VyYXRpb247XG4gICAgfVxuICAgIGNhc2UgJy5tanMnOlxuICAgICAgLy8gTG9hZCB0aGUgRVNNIGNvbmZpZ3VyYXRpb24gZmlsZSB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgICAgIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gICAgICByZXR1cm4gKGF3YWl0IGxvYWRFc21Nb2R1bGU8eyBkZWZhdWx0OiB1bmtub3duIH0+KHBhdGhUb0ZpbGVVUkwocHJveHlQYXRoKSkpLmRlZmF1bHQ7XG4gICAgY2FzZSAnLmNqcyc6XG4gICAgICByZXR1cm4gcmVxdWlyZShwcm94eVBhdGgpO1xuICAgIGRlZmF1bHQ6XG4gICAgICAvLyBUaGUgZmlsZSBjb3VsZCBiZSBlaXRoZXIgQ29tbW9uSlMgb3IgRVNNLlxuICAgICAgLy8gQ29tbW9uSlMgaXMgdHJpZWQgZmlyc3QgdGhlbiBFU00gaWYgbG9hZGluZyBmYWlscy5cbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiByZXF1aXJlKHByb3h5UGF0aCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGFzc2VydElzRXJyb3IoZSk7XG4gICAgICAgIGlmIChlLmNvZGUgPT09ICdFUlJfUkVRVUlSRV9FU00nKSB7XG4gICAgICAgICAgLy8gTG9hZCB0aGUgRVNNIGNvbmZpZ3VyYXRpb24gZmlsZSB1c2luZyB0aGUgVHlwZVNjcmlwdCBkeW5hbWljIGltcG9ydCB3b3JrYXJvdW5kLlxuICAgICAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgICAgICAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgICAgICAgICByZXR1cm4gKGF3YWl0IGxvYWRFc21Nb2R1bGU8eyBkZWZhdWx0OiB1bmtub3duIH0+KHBhdGhUb0ZpbGVVUkwocHJveHlQYXRoKSkpLmRlZmF1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICB9XG59XG5cbi8qKlxuICogQ2FsY3VsYXRlcyB0aGUgbGluZSBhbmQgY29sdW1uIGZvciBhbiBlcnJvciBvZmZzZXQgaW4gdGhlIGNvbnRlbnQgb2YgYSBKU09OIGZpbGUuXG4gKiBAcGFyYW0gbG9jYXRpb24gVGhlIG9mZnNldCBlcnJvciBsb2NhdGlvbiBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGNvbnRlbnQuXG4gKiBAcGFyYW0gY29udGVudCBUaGUgZnVsbCBjb250ZW50IG9mIHRoZSBmaWxlIGNvbnRhaW5pbmcgdGhlIGVycm9yLlxuICogQHJldHVybnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIGxpbmUgYW5kIGNvbHVtblxuICovXG5mdW5jdGlvbiBnZXRKc29uRXJyb3JMaW5lQ29sdW1uKG9mZnNldDogbnVtYmVyLCBjb250ZW50OiBzdHJpbmcpIHtcbiAgaWYgKG9mZnNldCA9PT0gMCkge1xuICAgIHJldHVybiB7IGxpbmU6IDEsIGNvbHVtbjogMSB9O1xuICB9XG5cbiAgbGV0IGxpbmUgPSAwO1xuICBsZXQgcG9zaXRpb24gPSAwO1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgKytsaW5lO1xuXG4gICAgY29uc3QgbmV4dE5ld2xpbmUgPSBjb250ZW50LmluZGV4T2YoJ1xcbicsIHBvc2l0aW9uKTtcbiAgICBpZiAobmV4dE5ld2xpbmUgPT09IC0xIHx8IG5leHROZXdsaW5lID4gb2Zmc2V0KSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBwb3NpdGlvbiA9IG5leHROZXdsaW5lICsgMTtcbiAgfVxuXG4gIHJldHVybiB7IGxpbmUsIGNvbHVtbjogb2Zmc2V0IC0gcG9zaXRpb24gKyAxIH07XG59XG5cbi8qKlxuICogRmluZCB0aGUgZGVmYXVsdCBzZXJ2ZXIgcGF0aC4gV2UgZG9uJ3Qgd2FudCB0byBleHBvc2UgYmFzZUhyZWYgYW5kIGRlcGxveVVybCBhcyBhcmd1bWVudHMsIG9ubHlcbiAqIHRoZSBicm93c2VyIG9wdGlvbnMgd2hlcmUgbmVlZGVkLiBUaGlzIG1ldGhvZCBzaG91bGQgc3RheSBwcml2YXRlIChwZW9wbGUgd2hvIHdhbnQgdG8gcmVzb2x2ZVxuICogYmFzZUhyZWYgYW5kIGRlcGxveVVybCBzaG91bGQgdXNlIHRoZSBidWlsZFNlcnZlUGF0aCBleHBvcnRlZCBmdW5jdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGZpbmREZWZhdWx0U2VydmVQYXRoKGJhc2VIcmVmPzogc3RyaW5nLCBkZXBsb3lVcmw/OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgaWYgKCFiYXNlSHJlZiAmJiAhZGVwbG95VXJsKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgaWYgKC9eKFxcdys6KT9cXC9cXC8vLnRlc3QoYmFzZUhyZWYgfHwgJycpIHx8IC9eKFxcdys6KT9cXC9cXC8vLnRlc3QoZGVwbG95VXJsIHx8ICcnKSkge1xuICAgIC8vIElmIGJhc2VIcmVmIG9yIGRlcGxveVVybCBpcyBhYnNvbHV0ZSwgdW5zdXBwb3J0ZWQgYnkgbmcgc2VydmVcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIG5vcm1hbGl6ZSBiYXNlSHJlZlxuICAvLyBmb3Igbmcgc2VydmUgdGhlIHN0YXJ0aW5nIGJhc2UgaXMgYWx3YXlzIGAvYCBzbyBhIHJlbGF0aXZlXG4gIC8vIGFuZCByb290IHJlbGF0aXZlIHZhbHVlIGFyZSBpZGVudGljYWxcbiAgY29uc3QgYmFzZUhyZWZQYXJ0cyA9IChiYXNlSHJlZiB8fCAnJykuc3BsaXQoJy8nKS5maWx0ZXIoKHBhcnQpID0+IHBhcnQgIT09ICcnKTtcbiAgaWYgKGJhc2VIcmVmICYmICFiYXNlSHJlZi5lbmRzV2l0aCgnLycpKSB7XG4gICAgYmFzZUhyZWZQYXJ0cy5wb3AoKTtcbiAgfVxuICBjb25zdCBub3JtYWxpemVkQmFzZUhyZWYgPSBiYXNlSHJlZlBhcnRzLmxlbmd0aCA9PT0gMCA/ICcvJyA6IGAvJHtiYXNlSHJlZlBhcnRzLmpvaW4oJy8nKX0vYDtcblxuICBpZiAoZGVwbG95VXJsICYmIGRlcGxveVVybFswXSA9PT0gJy8nKSB7XG4gICAgaWYgKGJhc2VIcmVmICYmIGJhc2VIcmVmWzBdID09PSAnLycgJiYgbm9ybWFsaXplZEJhc2VIcmVmICE9PSBkZXBsb3lVcmwpIHtcbiAgICAgIC8vIElmIGJhc2VIcmVmIGFuZCBkZXBsb3lVcmwgYXJlIHJvb3QgcmVsYXRpdmUgYW5kIG5vdCBlcXVpdmFsZW50LCB1bnN1cHBvcnRlZCBieSBuZyBzZXJ2ZVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlcGxveVVybDtcbiAgfVxuXG4gIC8vIEpvaW4gdG9nZXRoZXIgYmFzZUhyZWYgYW5kIGRlcGxveVVybFxuICByZXR1cm4gYCR7bm9ybWFsaXplZEJhc2VIcmVmfSR7ZGVwbG95VXJsIHx8ICcnfWA7XG59XG5cbmZ1bmN0aW9uIGdldEFsbG93ZWRIb3N0c0NvbmZpZyhcbiAgb3B0aW9uczogV2VicGFja0RldlNlcnZlck9wdGlvbnMsXG4pOiBEZXZTZXJ2ZXJDb25maWd1cmF0aW9uWydhbGxvd2VkSG9zdHMnXSB7XG4gIGlmIChvcHRpb25zLmRpc2FibGVIb3N0Q2hlY2spIHtcbiAgICByZXR1cm4gJ2FsbCc7XG4gIH0gZWxzZSBpZiAob3B0aW9ucy5hbGxvd2VkSG9zdHM/Lmxlbmd0aCkge1xuICAgIHJldHVybiBvcHRpb25zLmFsbG93ZWRIb3N0cztcbiAgfVxuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGdldFdlYlNvY2tldFNldHRpbmdzKFxuICBvcHRpb25zOiBXZWJwYWNrRGV2U2VydmVyT3B0aW9ucyxcbiAgc2VydmVQYXRoOiBzdHJpbmcsXG4pOiB7XG4gIHdlYlNvY2tldFNlcnZlcj86IERldlNlcnZlckNvbmZpZ3VyYXRpb25bJ3dlYlNvY2tldFNlcnZlciddO1xuICBjbGllbnQ/OiBEZXZTZXJ2ZXJDb25maWd1cmF0aW9uWydjbGllbnQnXTtcbn0ge1xuICBjb25zdCB7IGhtciwgbGl2ZVJlbG9hZCB9ID0gb3B0aW9ucztcbiAgaWYgKCFobXIgJiYgIWxpdmVSZWxvYWQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgd2ViU29ja2V0U2VydmVyOiBmYWxzZSxcbiAgICAgIGNsaWVudDogdW5kZWZpbmVkLFxuICAgIH07XG4gIH1cblxuICBjb25zdCB3ZWJTb2NrZXRQYXRoID0gcG9zaXguam9pbihzZXJ2ZVBhdGgsICduZy1jbGktd3MnKTtcblxuICByZXR1cm4ge1xuICAgIHdlYlNvY2tldFNlcnZlcjoge1xuICAgICAgb3B0aW9uczoge1xuICAgICAgICBwYXRoOiB3ZWJTb2NrZXRQYXRoLFxuICAgICAgfSxcbiAgICB9LFxuICAgIGNsaWVudDoge1xuICAgICAgbG9nZ2luZzogJ2luZm8nLFxuICAgICAgd2ViU29ja2V0VVJMOiBnZXRQdWJsaWNIb3N0T3B0aW9ucyhvcHRpb25zLCB3ZWJTb2NrZXRQYXRoKSxcbiAgICAgIG92ZXJsYXk6IHtcbiAgICAgICAgZXJyb3JzOiB0cnVlLFxuICAgICAgICB3YXJuaW5nczogZmFsc2UsXG4gICAgICB9LFxuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGdldFB1YmxpY0hvc3RPcHRpb25zKG9wdGlvbnM6IFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zLCB3ZWJTb2NrZXRQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICBsZXQgcHVibGljSG9zdDogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCA9IG9wdGlvbnMucHVibGljSG9zdDtcbiAgaWYgKHB1YmxpY0hvc3QpIHtcbiAgICBjb25zdCBob3N0V2l0aFByb3RvY29sID0gIS9eXFx3KzpcXC9cXC8vLnRlc3QocHVibGljSG9zdCkgPyBgaHR0cHM6Ly8ke3B1YmxpY0hvc3R9YCA6IHB1YmxpY0hvc3Q7XG4gICAgcHVibGljSG9zdCA9IG5ldyBVUkwoaG9zdFdpdGhQcm90b2NvbCkuaG9zdDtcbiAgfVxuXG4gIHJldHVybiBgYXV0bzovLyR7cHVibGljSG9zdCB8fCAnMC4wLjAuMDowJ30ke3dlYlNvY2tldFBhdGh9YDtcbn1cbiJdfQ==