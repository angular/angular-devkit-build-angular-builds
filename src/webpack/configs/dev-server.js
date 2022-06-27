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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2LXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svY29uZmlncy9kZXYtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsK0NBQXFEO0FBQ3JELDJCQUF3RDtBQUN4RCwrQkFBK0M7QUFDL0MsNkJBQXlDO0FBSXpDLG1EQUFxRDtBQUNyRCwrRUFBd0U7QUFDeEUsMERBQXNEO0FBRS9DLEtBQUssVUFBVSxrQkFBa0IsQ0FDdEMsR0FBa0Q7SUFFbEQsTUFBTSxFQUNKLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLEVBQ3ZGLE1BQU0sRUFDTixJQUFJLEdBQ0wsR0FBRyxHQUFHLENBQUM7SUFFUixNQUFNLFNBQVMsR0FBRyxjQUFjLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBQztJQUUzRCxNQUFNLFVBQVUsR0FBa0IsRUFBRSxDQUFDO0lBQ3JDLElBQUksR0FBRyxFQUFFO1FBQ1AsVUFBVSxDQUFDLElBQUksQ0FBQztZQUNkLE1BQU0sRUFBRSxzQkFBUztZQUNqQixPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUEsY0FBTyxFQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDakQsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxNQUFNLFlBQVksR0FBRyxFQUFFLENBQUM7SUFDeEIsSUFBSSxDQUFDLEtBQUssRUFBRTtRQUNWLHlFQUF5RTtRQUN6RSw0Q0FB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ICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBsb2dnaW5nLCB0YWdzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgZXhpc3RzU3luYywgcHJvbWlzZXMgYXMgZnNQcm9taXNlcyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IGV4dG5hbWUsIHBvc2l4LCByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBVUkwsIHBhdGhUb0ZpbGVVUkwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiwgUnVsZVNldFJ1bGUgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb24gYXMgRGV2U2VydmVyQ29uZmlndXJhdGlvbiB9IGZyb20gJ3dlYnBhY2stZGV2LXNlcnZlcic7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucywgV2VicGFja0RldlNlcnZlck9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi8uLi91dGlscy9sb2FkLWVzbSc7XG5pbXBvcnQgeyBnZXRJbmRleE91dHB1dEZpbGUgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IEhtckxvYWRlciB9IGZyb20gJy4uL3BsdWdpbnMvaG1yL2htci1sb2FkZXInO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RGV2U2VydmVyQ29uZmlnKFxuICB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zPFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zPixcbik6IFByb21pc2U8Q29uZmlndXJhdGlvbj4ge1xuICBjb25zdCB7XG4gICAgYnVpbGRPcHRpb25zOiB7IGhvc3QsIHBvcnQsIGluZGV4LCBoZWFkZXJzLCB3YXRjaCwgaG1yLCBtYWluLCBsaXZlUmVsb2FkLCBwcm94eUNvbmZpZyB9LFxuICAgIGxvZ2dlcixcbiAgICByb290LFxuICB9ID0gd2NvO1xuXG4gIGNvbnN0IHNlcnZlUGF0aCA9IGJ1aWxkU2VydmVQYXRoKHdjby5idWlsZE9wdGlvbnMsIGxvZ2dlcik7XG5cbiAgY29uc3QgZXh0cmFSdWxlczogUnVsZVNldFJ1bGVbXSA9IFtdO1xuICBpZiAoaG1yKSB7XG4gICAgZXh0cmFSdWxlcy5wdXNoKHtcbiAgICAgIGxvYWRlcjogSG1yTG9hZGVyLFxuICAgICAgaW5jbHVkZTogW21haW5dLm1hcCgocCkgPT4gcmVzb2x2ZSh3Y28ucm9vdCwgcCkpLFxuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgZXh0cmFQbHVnaW5zID0gW107XG4gIGlmICghd2F0Y2gpIHtcbiAgICAvLyBUaGVyZSdzIG5vIG9wdGlvbiB0byB0dXJuIG9mZiBmaWxlIHdhdGNoaW5nIGluIHdlYnBhY2stZGV2LXNlcnZlciwgYnV0XG4gICAgLy8gd2UgY2FuIG92ZXJyaWRlIHRoZSBmaWxlIHdhdGNoZXIgaW5zdGVhZC5cbiAgICBleHRyYVBsdWdpbnMucHVzaCh7XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgYXBwbHk6IChjb21waWxlcjogYW55KSA9PiB7XG4gICAgICAgIGNvbXBpbGVyLmhvb2tzLmFmdGVyRW52aXJvbm1lbnQudGFwKCdhbmd1bGFyLWNsaScsICgpID0+IHtcbiAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWVtcHR5LWZ1bmN0aW9uXG4gICAgICAgICAgY29tcGlsZXIud2F0Y2hGaWxlU3lzdGVtID0geyB3YXRjaDogKCkgPT4ge30gfTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gICAgbW9kdWxlOiB7XG4gICAgICBydWxlczogZXh0cmFSdWxlcyxcbiAgICB9LFxuICAgIGRldlNlcnZlcjoge1xuICAgICAgaG9zdCxcbiAgICAgIHBvcnQsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAgIC4uLmhlYWRlcnMsXG4gICAgICB9LFxuICAgICAgaGlzdG9yeUFwaUZhbGxiYWNrOiAhIWluZGV4ICYmIHtcbiAgICAgICAgaW5kZXg6IHBvc2l4LmpvaW4oc2VydmVQYXRoLCBnZXRJbmRleE91dHB1dEZpbGUoaW5kZXgpKSxcbiAgICAgICAgZGlzYWJsZURvdFJ1bGU6IHRydWUsXG4gICAgICAgIGh0bWxBY2NlcHRIZWFkZXJzOiBbJ3RleHQvaHRtbCcsICdhcHBsaWNhdGlvbi94aHRtbCt4bWwnXSxcbiAgICAgICAgcmV3cml0ZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBmcm9tOiBuZXcgUmVnRXhwKGBeKD8hJHtzZXJ2ZVBhdGh9KS8uKmApLFxuICAgICAgICAgICAgdG86IChjb250ZXh0KSA9PiBjb250ZXh0LnBhcnNlZFVybC5ocmVmLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAgLy8gV2hlbiBzZXR1cEV4aXRTaWduYWxzIGlzIGVuYWJsZWQgd2VicGFjay1kZXYtc2VydmVyIHdpbGwgc2h1dGRvd24gZ3JhY2VmdWxseSB3aGljaCB3b3VsZFxuICAgICAgLy8gcmVxdWlyZSBDVFJMK0MgdG8gYmUgcHJlc3NlZCBtdWx0aXBsZSB0aW1lcyB0byBleGl0LlxuICAgICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay93ZWJwYWNrLWRldi1zZXJ2ZXIvYmxvYi9jNzZiNmQxMWEzODIxNDM2YzVlMjAyMDdjOGEzOGRlYjZhYjdlMzNjL2xpYi9TZXJ2ZXIuanMjTDE4MDEtTDE4MjdcbiAgICAgIHNldHVwRXhpdFNpZ25hbHM6IGZhbHNlLFxuICAgICAgY29tcHJlc3M6IGZhbHNlLFxuICAgICAgc3RhdGljOiBmYWxzZSxcbiAgICAgIHNlcnZlcjogZ2V0U2VydmVyQ29uZmlnKHJvb3QsIHdjby5idWlsZE9wdGlvbnMpLFxuICAgICAgYWxsb3dlZEhvc3RzOiBnZXRBbGxvd2VkSG9zdHNDb25maWcod2NvLmJ1aWxkT3B0aW9ucyksXG4gICAgICBkZXZNaWRkbGV3YXJlOiB7XG4gICAgICAgIHB1YmxpY1BhdGg6IHNlcnZlUGF0aCxcbiAgICAgICAgc3RhdHM6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGxpdmVSZWxvYWQsXG4gICAgICBob3Q6IGhtciAmJiAhbGl2ZVJlbG9hZCA/ICdvbmx5JyA6IGhtcixcbiAgICAgIHByb3h5OiBhd2FpdCBhZGRQcm94eUNvbmZpZyhyb290LCBwcm94eUNvbmZpZyksXG4gICAgICAuLi5nZXRXZWJTb2NrZXRTZXR0aW5ncyh3Y28uYnVpbGRPcHRpb25zLCBzZXJ2ZVBhdGgpLFxuICAgIH0sXG4gIH07XG59XG5cbi8qKlxuICogUmVzb2x2ZSBhbmQgYnVpbGQgYSBVUkwgX3BhdGhfIHRoYXQgd2lsbCBiZSB0aGUgcm9vdCBvZiB0aGUgc2VydmVyLiBUaGlzIHJlc29sdmVkIGJhc2UgaHJlZiBhbmRcbiAqIGRlcGxveSBVUkwgZnJvbSB0aGUgYnJvd3NlciBvcHRpb25zIGFuZCByZXR1cm5zIGEgcGF0aCBmcm9tIHRoZSByb290LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRTZXJ2ZVBhdGgoXG4gIG9wdGlvbnM6IFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zLFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuKTogc3RyaW5nIHtcbiAgbGV0IHNlcnZlUGF0aCA9IG9wdGlvbnMuc2VydmVQYXRoO1xuICBpZiAoc2VydmVQYXRoID09PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBkZWZhdWx0UGF0aCA9IGZpbmREZWZhdWx0U2VydmVQYXRoKG9wdGlvbnMuYmFzZUhyZWYsIG9wdGlvbnMuZGVwbG95VXJsKTtcbiAgICBpZiAoZGVmYXVsdFBhdGggPT0gbnVsbCkge1xuICAgICAgbG9nZ2VyLndhcm4odGFncy5vbmVMaW5lYFxuICAgICAgICBXYXJuaW5nOiAtLWRlcGxveS11cmwgYW5kL29yIC0tYmFzZS1ocmVmIGNvbnRhaW4gdW5zdXBwb3J0ZWQgdmFsdWVzIGZvciBuZyBzZXJ2ZS4gRGVmYXVsdFxuICAgICAgICBzZXJ2ZSBwYXRoIG9mICcvJyB1c2VkLiBVc2UgLS1zZXJ2ZS1wYXRoIHRvIG92ZXJyaWRlLlxuICAgICAgYCk7XG4gICAgfVxuICAgIHNlcnZlUGF0aCA9IGRlZmF1bHRQYXRoIHx8ICcnO1xuICB9XG5cbiAgaWYgKHNlcnZlUGF0aC5lbmRzV2l0aCgnLycpKSB7XG4gICAgc2VydmVQYXRoID0gc2VydmVQYXRoLnNsaWNlKDAsIC0xKTtcbiAgfVxuXG4gIGlmICghc2VydmVQYXRoLnN0YXJ0c1dpdGgoJy8nKSkge1xuICAgIHNlcnZlUGF0aCA9IGAvJHtzZXJ2ZVBhdGh9YDtcbiAgfVxuXG4gIHJldHVybiBzZXJ2ZVBhdGg7XG59XG5cbi8qKlxuICogUHJpdmF0ZSBtZXRob2QgdG8gZW5oYW5jZSBhIHdlYnBhY2sgY29uZmlnIHdpdGggU1NMIGNvbmZpZ3VyYXRpb24uXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBnZXRTZXJ2ZXJDb25maWcoXG4gIHJvb3Q6IHN0cmluZyxcbiAgb3B0aW9uczogV2VicGFja0RldlNlcnZlck9wdGlvbnMsXG4pOiBEZXZTZXJ2ZXJDb25maWd1cmF0aW9uWydzZXJ2ZXInXSB7XG4gIGNvbnN0IHsgc3NsLCBzc2xDZXJ0LCBzc2xLZXkgfSA9IG9wdGlvbnM7XG4gIGlmICghc3NsKSB7XG4gICAgcmV0dXJuICdodHRwJztcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgdHlwZTogJ2h0dHBzJyxcbiAgICBvcHRpb25zOlxuICAgICAgc3NsQ2VydCAmJiBzc2xLZXlcbiAgICAgICAgPyB7XG4gICAgICAgICAgICBrZXk6IHJlc29sdmUocm9vdCwgc3NsS2V5KSxcbiAgICAgICAgICAgIGNlcnQ6IHJlc29sdmUocm9vdCwgc3NsQ2VydCksXG4gICAgICAgICAgfVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgfTtcbn1cblxuLyoqXG4gKiBQcml2YXRlIG1ldGhvZCB0byBlbmhhbmNlIGEgd2VicGFjayBjb25maWcgd2l0aCBQcm94eSBjb25maWd1cmF0aW9uLlxuICogQHByaXZhdGVcbiAqL1xuYXN5bmMgZnVuY3Rpb24gYWRkUHJveHlDb25maWcocm9vdDogc3RyaW5nLCBwcm94eUNvbmZpZzogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG4gIGlmICghcHJveHlDb25maWcpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgY29uc3QgcHJveHlQYXRoID0gcmVzb2x2ZShyb290LCBwcm94eUNvbmZpZyk7XG5cbiAgaWYgKCFleGlzdHNTeW5jKHByb3h5UGF0aCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3h5IGNvbmZpZ3VyYXRpb24gZmlsZSAke3Byb3h5UGF0aH0gZG9lcyBub3QgZXhpc3QuYCk7XG4gIH1cblxuICBzd2l0Y2ggKGV4dG5hbWUocHJveHlQYXRoKSkge1xuICAgIGNhc2UgJy5qc29uJzoge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzUHJvbWlzZXMucmVhZEZpbGUocHJveHlQYXRoLCAndXRmLTgnKTtcblxuICAgICAgY29uc3QgeyBwYXJzZSwgcHJpbnRQYXJzZUVycm9yQ29kZSB9ID0gYXdhaXQgaW1wb3J0KCdqc29uYy1wYXJzZXInKTtcbiAgICAgIGNvbnN0IHBhcnNlRXJyb3JzOiBpbXBvcnQoJ2pzb25jLXBhcnNlcicpLlBhcnNlRXJyb3JbXSA9IFtdO1xuICAgICAgY29uc3QgcHJveHlDb25maWd1cmF0aW9uID0gcGFyc2UoY29udGVudCwgcGFyc2VFcnJvcnMsIHsgYWxsb3dUcmFpbGluZ0NvbW1hOiB0cnVlIH0pO1xuXG4gICAgICBpZiAocGFyc2VFcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgICBsZXQgZXJyb3JNZXNzYWdlID0gYFByb3h5IGNvbmZpZ3VyYXRpb24gZmlsZSAke3Byb3h5UGF0aH0gY29udGFpbnMgcGFyc2UgZXJyb3JzOmA7XG4gICAgICAgIGZvciAoY29uc3QgcGFyc2VFcnJvciBvZiBwYXJzZUVycm9ycykge1xuICAgICAgICAgIGNvbnN0IHsgbGluZSwgY29sdW1uIH0gPSBnZXRKc29uRXJyb3JMaW5lQ29sdW1uKHBhcnNlRXJyb3Iub2Zmc2V0LCBjb250ZW50KTtcbiAgICAgICAgICBlcnJvck1lc3NhZ2UgKz0gYFxcblske2xpbmV9LCAke2NvbHVtbn1dICR7cHJpbnRQYXJzZUVycm9yQ29kZShwYXJzZUVycm9yLmVycm9yKX1gO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvck1lc3NhZ2UpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcHJveHlDb25maWd1cmF0aW9uO1xuICAgIH1cbiAgICBjYXNlICcubWpzJzpcbiAgICAgIC8vIExvYWQgdGhlIEVTTSBjb25maWd1cmF0aW9uIGZpbGUgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciBrZWVwaW5nIHRoZSBkeW5hbWljIGltcG9ydCB0aGlzIHdvcmthcm91bmQgY2FuIGJlXG4gICAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgICAgcmV0dXJuIChhd2FpdCBsb2FkRXNtTW9kdWxlPHsgZGVmYXVsdDogdW5rbm93biB9PihwYXRoVG9GaWxlVVJMKHByb3h5UGF0aCkpKS5kZWZhdWx0O1xuICAgIGNhc2UgJy5janMnOlxuICAgICAgcmV0dXJuIHJlcXVpcmUocHJveHlQYXRoKTtcbiAgICBkZWZhdWx0OlxuICAgICAgLy8gVGhlIGZpbGUgY291bGQgYmUgZWl0aGVyIENvbW1vbkpTIG9yIEVTTS5cbiAgICAgIC8vIENvbW1vbkpTIGlzIHRyaWVkIGZpcnN0IHRoZW4gRVNNIGlmIGxvYWRpbmcgZmFpbHMuXG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gcmVxdWlyZShwcm94eVBhdGgpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAoZS5jb2RlID09PSAnRVJSX1JFUVVJUkVfRVNNJykge1xuICAgICAgICAgIC8vIExvYWQgdGhlIEVTTSBjb25maWd1cmF0aW9uIGZpbGUgdXNpbmcgdGhlIFR5cGVTY3JpcHQgZHluYW1pYyBpbXBvcnQgd29ya2Fyb3VuZC5cbiAgICAgICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAgICAgICAgIC8vIGNoYW5nZWQgdG8gYSBkaXJlY3QgZHluYW1pYyBpbXBvcnQuXG4gICAgICAgICAgcmV0dXJuIChhd2FpdCBsb2FkRXNtTW9kdWxlPHsgZGVmYXVsdDogdW5rbm93biB9PihwYXRoVG9GaWxlVVJMKHByb3h5UGF0aCkpKS5kZWZhdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENhbGN1bGF0ZXMgdGhlIGxpbmUgYW5kIGNvbHVtbiBmb3IgYW4gZXJyb3Igb2Zmc2V0IGluIHRoZSBjb250ZW50IG9mIGEgSlNPTiBmaWxlLlxuICogQHBhcmFtIGxvY2F0aW9uIFRoZSBvZmZzZXQgZXJyb3IgbG9jYXRpb24gZnJvbSB0aGUgYmVnaW5uaW5nIG9mIHRoZSBjb250ZW50LlxuICogQHBhcmFtIGNvbnRlbnQgVGhlIGZ1bGwgY29udGVudCBvZiB0aGUgZmlsZSBjb250YWluaW5nIHRoZSBlcnJvci5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBsaW5lIGFuZCBjb2x1bW5cbiAqL1xuZnVuY3Rpb24gZ2V0SnNvbkVycm9yTGluZUNvbHVtbihvZmZzZXQ6IG51bWJlciwgY29udGVudDogc3RyaW5nKSB7XG4gIGlmIChvZmZzZXQgPT09IDApIHtcbiAgICByZXR1cm4geyBsaW5lOiAxLCBjb2x1bW46IDEgfTtcbiAgfVxuXG4gIGxldCBsaW5lID0gMDtcbiAgbGV0IHBvc2l0aW9uID0gMDtcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnN0YW50LWNvbmRpdGlvblxuICB3aGlsZSAodHJ1ZSkge1xuICAgICsrbGluZTtcblxuICAgIGNvbnN0IG5leHROZXdsaW5lID0gY29udGVudC5pbmRleE9mKCdcXG4nLCBwb3NpdGlvbik7XG4gICAgaWYgKG5leHROZXdsaW5lID09PSAtMSB8fCBuZXh0TmV3bGluZSA+IG9mZnNldCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgcG9zaXRpb24gPSBuZXh0TmV3bGluZSArIDE7XG4gIH1cblxuICByZXR1cm4geyBsaW5lLCBjb2x1bW46IG9mZnNldCAtIHBvc2l0aW9uICsgMSB9O1xufVxuXG4vKipcbiAqIEZpbmQgdGhlIGRlZmF1bHQgc2VydmVyIHBhdGguIFdlIGRvbid0IHdhbnQgdG8gZXhwb3NlIGJhc2VIcmVmIGFuZCBkZXBsb3lVcmwgYXMgYXJndW1lbnRzLCBvbmx5XG4gKiB0aGUgYnJvd3NlciBvcHRpb25zIHdoZXJlIG5lZWRlZC4gVGhpcyBtZXRob2Qgc2hvdWxkIHN0YXkgcHJpdmF0ZSAocGVvcGxlIHdobyB3YW50IHRvIHJlc29sdmVcbiAqIGJhc2VIcmVmIGFuZCBkZXBsb3lVcmwgc2hvdWxkIHVzZSB0aGUgYnVpbGRTZXJ2ZVBhdGggZXhwb3J0ZWQgZnVuY3Rpb24uXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBmaW5kRGVmYXVsdFNlcnZlUGF0aChiYXNlSHJlZj86IHN0cmluZywgZGVwbG95VXJsPzogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gIGlmICghYmFzZUhyZWYgJiYgIWRlcGxveVVybCkge1xuICAgIHJldHVybiAnJztcbiAgfVxuXG4gIGlmICgvXihcXHcrOik/XFwvXFwvLy50ZXN0KGJhc2VIcmVmIHx8ICcnKSB8fCAvXihcXHcrOik/XFwvXFwvLy50ZXN0KGRlcGxveVVybCB8fCAnJykpIHtcbiAgICAvLyBJZiBiYXNlSHJlZiBvciBkZXBsb3lVcmwgaXMgYWJzb2x1dGUsIHVuc3VwcG9ydGVkIGJ5IG5nIHNlcnZlXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBub3JtYWxpemUgYmFzZUhyZWZcbiAgLy8gZm9yIG5nIHNlcnZlIHRoZSBzdGFydGluZyBiYXNlIGlzIGFsd2F5cyBgL2Agc28gYSByZWxhdGl2ZVxuICAvLyBhbmQgcm9vdCByZWxhdGl2ZSB2YWx1ZSBhcmUgaWRlbnRpY2FsXG4gIGNvbnN0IGJhc2VIcmVmUGFydHMgPSAoYmFzZUhyZWYgfHwgJycpLnNwbGl0KCcvJykuZmlsdGVyKChwYXJ0KSA9PiBwYXJ0ICE9PSAnJyk7XG4gIGlmIChiYXNlSHJlZiAmJiAhYmFzZUhyZWYuZW5kc1dpdGgoJy8nKSkge1xuICAgIGJhc2VIcmVmUGFydHMucG9wKCk7XG4gIH1cbiAgY29uc3Qgbm9ybWFsaXplZEJhc2VIcmVmID0gYmFzZUhyZWZQYXJ0cy5sZW5ndGggPT09IDAgPyAnLycgOiBgLyR7YmFzZUhyZWZQYXJ0cy5qb2luKCcvJyl9L2A7XG5cbiAgaWYgKGRlcGxveVVybCAmJiBkZXBsb3lVcmxbMF0gPT09ICcvJykge1xuICAgIGlmIChiYXNlSHJlZiAmJiBiYXNlSHJlZlswXSA9PT0gJy8nICYmIG5vcm1hbGl6ZWRCYXNlSHJlZiAhPT0gZGVwbG95VXJsKSB7XG4gICAgICAvLyBJZiBiYXNlSHJlZiBhbmQgZGVwbG95VXJsIGFyZSByb290IHJlbGF0aXZlIGFuZCBub3QgZXF1aXZhbGVudCwgdW5zdXBwb3J0ZWQgYnkgbmcgc2VydmVcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBkZXBsb3lVcmw7XG4gIH1cblxuICAvLyBKb2luIHRvZ2V0aGVyIGJhc2VIcmVmIGFuZCBkZXBsb3lVcmxcbiAgcmV0dXJuIGAke25vcm1hbGl6ZWRCYXNlSHJlZn0ke2RlcGxveVVybCB8fCAnJ31gO1xufVxuXG5mdW5jdGlvbiBnZXRBbGxvd2VkSG9zdHNDb25maWcoXG4gIG9wdGlvbnM6IFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zLFxuKTogRGV2U2VydmVyQ29uZmlndXJhdGlvblsnYWxsb3dlZEhvc3RzJ10ge1xuICBpZiAob3B0aW9ucy5kaXNhYmxlSG9zdENoZWNrKSB7XG4gICAgcmV0dXJuICdhbGwnO1xuICB9IGVsc2UgaWYgKG9wdGlvbnMuYWxsb3dlZEhvc3RzPy5sZW5ndGgpIHtcbiAgICByZXR1cm4gb3B0aW9ucy5hbGxvd2VkSG9zdHM7XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBnZXRXZWJTb2NrZXRTZXR0aW5ncyhcbiAgb3B0aW9uczogV2VicGFja0RldlNlcnZlck9wdGlvbnMsXG4gIHNlcnZlUGF0aDogc3RyaW5nLFxuKToge1xuICB3ZWJTb2NrZXRTZXJ2ZXI/OiBEZXZTZXJ2ZXJDb25maWd1cmF0aW9uWyd3ZWJTb2NrZXRTZXJ2ZXInXTtcbiAgY2xpZW50PzogRGV2U2VydmVyQ29uZmlndXJhdGlvblsnY2xpZW50J107XG59IHtcbiAgY29uc3QgeyBobXIsIGxpdmVSZWxvYWQgfSA9IG9wdGlvbnM7XG4gIGlmICghaG1yICYmICFsaXZlUmVsb2FkKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHdlYlNvY2tldFNlcnZlcjogZmFsc2UsXG4gICAgICBjbGllbnQ6IHVuZGVmaW5lZCxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgd2ViU29ja2V0UGF0aCA9IHBvc2l4LmpvaW4oc2VydmVQYXRoLCAnbmctY2xpLXdzJyk7XG5cbiAgcmV0dXJuIHtcbiAgICB3ZWJTb2NrZXRTZXJ2ZXI6IHtcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgcGF0aDogd2ViU29ja2V0UGF0aCxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBjbGllbnQ6IHtcbiAgICAgIGxvZ2dpbmc6ICdpbmZvJyxcbiAgICAgIHdlYlNvY2tldFVSTDogZ2V0UHVibGljSG9zdE9wdGlvbnMob3B0aW9ucywgd2ViU29ja2V0UGF0aCksXG4gICAgICBvdmVybGF5OiB7XG4gICAgICAgIGVycm9yczogdHJ1ZSxcbiAgICAgICAgd2FybmluZ3M6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRQdWJsaWNIb3N0T3B0aW9ucyhvcHRpb25zOiBXZWJwYWNrRGV2U2VydmVyT3B0aW9ucywgd2ViU29ja2V0UGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHB1YmxpY0hvc3Q6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQgPSBvcHRpb25zLnB1YmxpY0hvc3Q7XG4gIGlmIChwdWJsaWNIb3N0KSB7XG4gICAgY29uc3QgaG9zdFdpdGhQcm90b2NvbCA9ICEvXlxcdys6XFwvXFwvLy50ZXN0KHB1YmxpY0hvc3QpID8gYGh0dHBzOi8vJHtwdWJsaWNIb3N0fWAgOiBwdWJsaWNIb3N0O1xuICAgIHB1YmxpY0hvc3QgPSBuZXcgVVJMKGhvc3RXaXRoUHJvdG9jb2wpLmhvc3Q7XG4gIH1cblxuICByZXR1cm4gYGF1dG86Ly8ke3B1YmxpY0hvc3QgfHwgJzAuMC4wLjA6MCd9JHt3ZWJTb2NrZXRQYXRofWA7XG59XG4iXX0=