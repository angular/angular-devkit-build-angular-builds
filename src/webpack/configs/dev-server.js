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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2LXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svY29uZmlncy9kZXYtc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCwrQ0FBcUQ7QUFDckQsMkJBQXdEO0FBQ3hELCtCQUErQztBQUMvQyw2QkFBeUM7QUFJekMsbURBQXFEO0FBQ3JELCtFQUF3RTtBQUN4RSwwREFBc0Q7QUFFL0MsS0FBSyxVQUFVLGtCQUFrQixDQUN0QyxHQUFrRDtJQUVsRCxNQUFNLEVBQ0osWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsRUFDdkYsTUFBTSxFQUNOLElBQUksR0FDTCxHQUFHLEdBQUcsQ0FBQztJQUVSLE1BQU0sU0FBUyxHQUFHLGNBQWMsQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBRTNELE1BQU0sVUFBVSxHQUFrQixFQUFFLENBQUM7SUFDckMsSUFBSSxHQUFHLEVBQUU7UUFDUCxVQUFVLENBQUMsSUFBSSxDQUFDO1lBQ2QsTUFBTSxFQUFFLHNCQUFTO1lBQ2pCLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBQSxjQUFPLEVBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztTQUNqRCxDQUFDLENBQUM7S0FDSjtJQUVELE1BQU0sWUFBWSxHQUFHLEVBQUUsQ0FBQztJQUN4QixJQUFJLENBQUMsS0FBSyxFQUFFO1FBQ1YseUVBQXlFO1FBQ3pFLDRDQUE0QztR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QWdDLEVBQ2hDLFNBQWlCO0lBS2pCLE1BQU0sRUFBRSxHQUFHLEVBQUUsVUFBVSxFQUFFLEdBQUcsT0FBTyxDQUFDO0lBQ3BDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxVQUFVLEVBQUU7UUFDdkIsT0FBTztZQUNMLGVBQWUsRUFBRSxLQUFLO1lBQ3RCLE1BQU0sRUFBRSxTQUFTO1NBQ2xCLENBQUM7S0FDSDtJQUVELE1BQU0sYUFBYSxHQUFHLFlBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBRWxELE9BQU87UUFDTCxlQUFlLEVBQUU7WUFDZixPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLGFBQWE7YUFDcEI7U0FDRjtRQUNELE1BQU0sRUFBRTtZQUNOLE9BQU8sRUFBRSxNQUFNO1lBQ2YsWUFBWSxFQUFFLG9CQUFvQixDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUM7WUFDMUQsT0FBTyxFQUFFO2dCQUNQLE1BQU0sRUFBRSxJQUFJO2dCQUNaLFFBQVEsRUFBRSxLQUFLO2FBQ2hCO1NBQ0Y7S0FDRixDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMsb0JBQW9CLENBQUMsT0FBZ0MsRUFBRSxhQUFxQjtJQUNuRixJQUFJLFVBQVUsR0FBOEIsT0FBTyxDQUFDLFVBQVUsQ0FBQztJQUMvRCxJQUFJLFVBQVUsRUFBRTtRQUNkLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUM7UUFDOUYsVUFBVSxHQUFHLElBQUksU0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUMsSUFBSSxDQUFDO0tBQzdDO0lBRUQsT0FBTyxVQUFVLFVBQVUsSUFBSSxXQUFXLEdBQUcsYUFBYSxFQUFFLENBQUM7QUFDL0QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBsb2dnaW5nLCB0YWdzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgZXhpc3RzU3luYywgcHJvbWlzZXMgYXMgZnNQcm9taXNlcyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IGV4dG5hbWUsIHBvc2l4LCByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBVUkwsIHBhdGhUb0ZpbGVVUkwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiwgUnVsZVNldFJ1bGUgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb24gYXMgRGV2U2VydmVyQ29uZmlndXJhdGlvbiB9IGZyb20gJ3dlYnBhY2stZGV2LXNlcnZlcic7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucywgV2VicGFja0RldlNlcnZlck9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi8uLi91dGlscy9sb2FkLWVzbSc7XG5pbXBvcnQgeyBnZXRJbmRleE91dHB1dEZpbGUgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IEhtckxvYWRlciB9IGZyb20gJy4uL3BsdWdpbnMvaG1yL2htci1sb2FkZXInO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RGV2U2VydmVyQ29uZmlnKFxuICB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zPFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zPixcbik6IFByb21pc2U8Q29uZmlndXJhdGlvbj4ge1xuICBjb25zdCB7XG4gICAgYnVpbGRPcHRpb25zOiB7IGhvc3QsIHBvcnQsIGluZGV4LCBoZWFkZXJzLCB3YXRjaCwgaG1yLCBtYWluLCBsaXZlUmVsb2FkLCBwcm94eUNvbmZpZyB9LFxuICAgIGxvZ2dlcixcbiAgICByb290LFxuICB9ID0gd2NvO1xuXG4gIGNvbnN0IHNlcnZlUGF0aCA9IGJ1aWxkU2VydmVQYXRoKHdjby5idWlsZE9wdGlvbnMsIGxvZ2dlcik7XG5cbiAgY29uc3QgZXh0cmFSdWxlczogUnVsZVNldFJ1bGVbXSA9IFtdO1xuICBpZiAoaG1yKSB7XG4gICAgZXh0cmFSdWxlcy5wdXNoKHtcbiAgICAgIGxvYWRlcjogSG1yTG9hZGVyLFxuICAgICAgaW5jbHVkZTogW21haW5dLm1hcCgocCkgPT4gcmVzb2x2ZSh3Y28ucm9vdCwgcCkpLFxuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgZXh0cmFQbHVnaW5zID0gW107XG4gIGlmICghd2F0Y2gpIHtcbiAgICAvLyBUaGVyZSdzIG5vIG9wdGlvbiB0byB0dXJuIG9mZiBmaWxlIHdhdGNoaW5nIGluIHdlYnBhY2stZGV2LXNlcnZlciwgYnV0XG4gICAgLy8gd2UgY2FuIG92ZXJyaWRlIHRoZSBmaWxlIHdhdGNoZXIgaW5zdGVhZC5cbiAgICBleHRyYVBsdWdpbnMucHVzaCh7XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgYXBwbHk6IChjb21waWxlcjogYW55KSA9PiB7XG4gICAgICAgIGNvbXBpbGVyLmhvb2tzLmFmdGVyRW52aXJvbm1lbnQudGFwKCdhbmd1bGFyLWNsaScsICgpID0+IHtcbiAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWVtcHR5LWZ1bmN0aW9uXG4gICAgICAgICAgY29tcGlsZXIud2F0Y2hGaWxlU3lzdGVtID0geyB3YXRjaDogKCkgPT4ge30gfTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gICAgbW9kdWxlOiB7XG4gICAgICBydWxlczogZXh0cmFSdWxlcyxcbiAgICB9LFxuICAgIGRldlNlcnZlcjoge1xuICAgICAgaG9zdCxcbiAgICAgIHBvcnQsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAgIC4uLmhlYWRlcnMsXG4gICAgICB9LFxuICAgICAgaGlzdG9yeUFwaUZhbGxiYWNrOiAhIWluZGV4ICYmIHtcbiAgICAgICAgaW5kZXg6IHBvc2l4LmpvaW4oc2VydmVQYXRoLCBnZXRJbmRleE91dHB1dEZpbGUoaW5kZXgpKSxcbiAgICAgICAgZGlzYWJsZURvdFJ1bGU6IHRydWUsXG4gICAgICAgIGh0bWxBY2NlcHRIZWFkZXJzOiBbJ3RleHQvaHRtbCcsICdhcHBsaWNhdGlvbi94aHRtbCt4bWwnXSxcbiAgICAgICAgcmV3cml0ZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBmcm9tOiBuZXcgUmVnRXhwKGBeKD8hJHtzZXJ2ZVBhdGh9KS8uKmApLFxuICAgICAgICAgICAgdG86IChjb250ZXh0KSA9PiBjb250ZXh0LnBhcnNlZFVybC5ocmVmLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAgY29tcHJlc3M6IGZhbHNlLFxuICAgICAgc3RhdGljOiBmYWxzZSxcbiAgICAgIHNlcnZlcjogZ2V0U2VydmVyQ29uZmlnKHJvb3QsIHdjby5idWlsZE9wdGlvbnMpLFxuICAgICAgYWxsb3dlZEhvc3RzOiBnZXRBbGxvd2VkSG9zdHNDb25maWcod2NvLmJ1aWxkT3B0aW9ucyksXG4gICAgICBkZXZNaWRkbGV3YXJlOiB7XG4gICAgICAgIHB1YmxpY1BhdGg6IHNlcnZlUGF0aCxcbiAgICAgICAgc3RhdHM6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGxpdmVSZWxvYWQsXG4gICAgICBob3Q6IGhtciAmJiAhbGl2ZVJlbG9hZCA/ICdvbmx5JyA6IGhtcixcbiAgICAgIHByb3h5OiBhd2FpdCBhZGRQcm94eUNvbmZpZyhyb290LCBwcm94eUNvbmZpZyksXG4gICAgICAuLi5nZXRXZWJTb2NrZXRTZXR0aW5ncyh3Y28uYnVpbGRPcHRpb25zLCBzZXJ2ZVBhdGgpLFxuICAgIH0sXG4gIH07XG59XG5cbi8qKlxuICogUmVzb2x2ZSBhbmQgYnVpbGQgYSBVUkwgX3BhdGhfIHRoYXQgd2lsbCBiZSB0aGUgcm9vdCBvZiB0aGUgc2VydmVyLiBUaGlzIHJlc29sdmVkIGJhc2UgaHJlZiBhbmRcbiAqIGRlcGxveSBVUkwgZnJvbSB0aGUgYnJvd3NlciBvcHRpb25zIGFuZCByZXR1cm5zIGEgcGF0aCBmcm9tIHRoZSByb290LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRTZXJ2ZVBhdGgoXG4gIG9wdGlvbnM6IFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zLFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuKTogc3RyaW5nIHtcbiAgbGV0IHNlcnZlUGF0aCA9IG9wdGlvbnMuc2VydmVQYXRoO1xuICBpZiAoc2VydmVQYXRoID09PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBkZWZhdWx0UGF0aCA9IGZpbmREZWZhdWx0U2VydmVQYXRoKG9wdGlvbnMuYmFzZUhyZWYsIG9wdGlvbnMuZGVwbG95VXJsKTtcbiAgICBpZiAoZGVmYXVsdFBhdGggPT0gbnVsbCkge1xuICAgICAgbG9nZ2VyLndhcm4odGFncy5vbmVMaW5lYFxuICAgICAgICBXYXJuaW5nOiAtLWRlcGxveS11cmwgYW5kL29yIC0tYmFzZS1ocmVmIGNvbnRhaW4gdW5zdXBwb3J0ZWQgdmFsdWVzIGZvciBuZyBzZXJ2ZS4gRGVmYXVsdFxuICAgICAgICBzZXJ2ZSBwYXRoIG9mICcvJyB1c2VkLiBVc2UgLS1zZXJ2ZS1wYXRoIHRvIG92ZXJyaWRlLlxuICAgICAgYCk7XG4gICAgfVxuICAgIHNlcnZlUGF0aCA9IGRlZmF1bHRQYXRoIHx8ICcnO1xuICB9XG5cbiAgaWYgKHNlcnZlUGF0aC5lbmRzV2l0aCgnLycpKSB7XG4gICAgc2VydmVQYXRoID0gc2VydmVQYXRoLnN1YnN0cigwLCBzZXJ2ZVBhdGgubGVuZ3RoIC0gMSk7XG4gIH1cblxuICBpZiAoIXNlcnZlUGF0aC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICBzZXJ2ZVBhdGggPSBgLyR7c2VydmVQYXRofWA7XG4gIH1cblxuICByZXR1cm4gc2VydmVQYXRoO1xufVxuXG4vKipcbiAqIFByaXZhdGUgbWV0aG9kIHRvIGVuaGFuY2UgYSB3ZWJwYWNrIGNvbmZpZyB3aXRoIFNTTCBjb25maWd1cmF0aW9uLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gZ2V0U2VydmVyQ29uZmlnKFxuICByb290OiBzdHJpbmcsXG4gIG9wdGlvbnM6IFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zLFxuKTogRGV2U2VydmVyQ29uZmlndXJhdGlvblsnc2VydmVyJ10ge1xuICBjb25zdCB7IHNzbCwgc3NsQ2VydCwgc3NsS2V5IH0gPSBvcHRpb25zO1xuICBpZiAoIXNzbCkge1xuICAgIHJldHVybiAnaHR0cCc7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHR5cGU6ICdodHRwcycsXG4gICAgb3B0aW9uczpcbiAgICAgIHNzbENlcnQgJiYgc3NsS2V5XG4gICAgICAgID8ge1xuICAgICAgICAgICAga2V5OiByZXNvbHZlKHJvb3QsIHNzbEtleSksXG4gICAgICAgICAgICBjZXJ0OiByZXNvbHZlKHJvb3QsIHNzbENlcnQpLFxuICAgICAgICAgIH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gIH07XG59XG5cbi8qKlxuICogUHJpdmF0ZSBtZXRob2QgdG8gZW5oYW5jZSBhIHdlYnBhY2sgY29uZmlnIHdpdGggUHJveHkgY29uZmlndXJhdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGFkZFByb3h5Q29uZmlnKHJvb3Q6IHN0cmluZywgcHJveHlDb25maWc6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuICBpZiAoIXByb3h5Q29uZmlnKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGNvbnN0IHByb3h5UGF0aCA9IHJlc29sdmUocm9vdCwgcHJveHlDb25maWcpO1xuXG4gIGlmICghZXhpc3RzU3luYyhwcm94eVBhdGgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBQcm94eSBjb25maWd1cmF0aW9uIGZpbGUgJHtwcm94eVBhdGh9IGRvZXMgbm90IGV4aXN0LmApO1xuICB9XG5cbiAgc3dpdGNoIChleHRuYW1lKHByb3h5UGF0aCkpIHtcbiAgICBjYXNlICcuanNvbic6IHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBmc1Byb21pc2VzLnJlYWRGaWxlKHByb3h5UGF0aCwgJ3V0Zi04Jyk7XG5cbiAgICAgIGNvbnN0IHsgcGFyc2UsIHByaW50UGFyc2VFcnJvckNvZGUgfSA9IGF3YWl0IGltcG9ydCgnanNvbmMtcGFyc2VyJyk7XG4gICAgICBjb25zdCBwYXJzZUVycm9yczogaW1wb3J0KCdqc29uYy1wYXJzZXInKS5QYXJzZUVycm9yW10gPSBbXTtcbiAgICAgIGNvbnN0IHByb3h5Q29uZmlndXJhdGlvbiA9IHBhcnNlKGNvbnRlbnQsIHBhcnNlRXJyb3JzLCB7IGFsbG93VHJhaWxpbmdDb21tYTogdHJ1ZSB9KTtcblxuICAgICAgaWYgKHBhcnNlRXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbGV0IGVycm9yTWVzc2FnZSA9IGBQcm94eSBjb25maWd1cmF0aW9uIGZpbGUgJHtwcm94eVBhdGh9IGNvbnRhaW5zIHBhcnNlIGVycm9yczpgO1xuICAgICAgICBmb3IgKGNvbnN0IHBhcnNlRXJyb3Igb2YgcGFyc2VFcnJvcnMpIHtcbiAgICAgICAgICBjb25zdCB7IGxpbmUsIGNvbHVtbiB9ID0gZ2V0SnNvbkVycm9yTGluZUNvbHVtbihwYXJzZUVycm9yLm9mZnNldCwgY29udGVudCk7XG4gICAgICAgICAgZXJyb3JNZXNzYWdlICs9IGBcXG5bJHtsaW5lfSwgJHtjb2x1bW59XSAke3ByaW50UGFyc2VFcnJvckNvZGUocGFyc2VFcnJvci5lcnJvcil9YDtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JNZXNzYWdlKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHByb3h5Q29uZmlndXJhdGlvbjtcbiAgICB9XG4gICAgY2FzZSAnLm1qcyc6XG4gICAgICAvLyBMb2FkIHRoZSBFU00gY29uZmlndXJhdGlvbiBmaWxlIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3Iga2VlcGluZyB0aGUgZHluYW1pYyBpbXBvcnQgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZVxuICAgICAgLy8gY2hhbmdlZCB0byBhIGRpcmVjdCBkeW5hbWljIGltcG9ydC5cbiAgICAgIHJldHVybiAoYXdhaXQgbG9hZEVzbU1vZHVsZTx7IGRlZmF1bHQ6IHVua25vd24gfT4ocGF0aFRvRmlsZVVSTChwcm94eVBhdGgpKSkuZGVmYXVsdDtcbiAgICBjYXNlICcuY2pzJzpcbiAgICAgIHJldHVybiByZXF1aXJlKHByb3h5UGF0aCk7XG4gICAgZGVmYXVsdDpcbiAgICAgIC8vIFRoZSBmaWxlIGNvdWxkIGJlIGVpdGhlciBDb21tb25KUyBvciBFU00uXG4gICAgICAvLyBDb21tb25KUyBpcyB0cmllZCBmaXJzdCB0aGVuIEVTTSBpZiBsb2FkaW5nIGZhaWxzLlxuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHJlcXVpcmUocHJveHlQYXRoKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaWYgKGUuY29kZSA9PT0gJ0VSUl9SRVFVSVJFX0VTTScpIHtcbiAgICAgICAgICAvLyBMb2FkIHRoZSBFU00gY29uZmlndXJhdGlvbiBmaWxlIHVzaW5nIHRoZSBUeXBlU2NyaXB0IGR5bmFtaWMgaW1wb3J0IHdvcmthcm91bmQuXG4gICAgICAgICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIGtlZXBpbmcgdGhlIGR5bmFtaWMgaW1wb3J0IHRoaXMgd29ya2Fyb3VuZCBjYW4gYmVcbiAgICAgICAgICAvLyBjaGFuZ2VkIHRvIGEgZGlyZWN0IGR5bmFtaWMgaW1wb3J0LlxuICAgICAgICAgIHJldHVybiAoYXdhaXQgbG9hZEVzbU1vZHVsZTx7IGRlZmF1bHQ6IHVua25vd24gfT4ocGF0aFRvRmlsZVVSTChwcm94eVBhdGgpKSkuZGVmYXVsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSBsaW5lIGFuZCBjb2x1bW4gZm9yIGFuIGVycm9yIG9mZnNldCBpbiB0aGUgY29udGVudCBvZiBhIEpTT04gZmlsZS5cbiAqIEBwYXJhbSBsb2NhdGlvbiBUaGUgb2Zmc2V0IGVycm9yIGxvY2F0aW9uIGZyb20gdGhlIGJlZ2lubmluZyBvZiB0aGUgY29udGVudC5cbiAqIEBwYXJhbSBjb250ZW50IFRoZSBmdWxsIGNvbnRlbnQgb2YgdGhlIGZpbGUgY29udGFpbmluZyB0aGUgZXJyb3IuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgbGluZSBhbmQgY29sdW1uXG4gKi9cbmZ1bmN0aW9uIGdldEpzb25FcnJvckxpbmVDb2x1bW4ob2Zmc2V0OiBudW1iZXIsIGNvbnRlbnQ6IHN0cmluZykge1xuICBpZiAob2Zmc2V0ID09PSAwKSB7XG4gICAgcmV0dXJuIHsgbGluZTogMSwgY29sdW1uOiAxIH07XG4gIH1cblxuICBsZXQgbGluZSA9IDA7XG4gIGxldCBwb3NpdGlvbiA9IDA7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zdGFudC1jb25kaXRpb25cbiAgd2hpbGUgKHRydWUpIHtcbiAgICArK2xpbmU7XG5cbiAgICBjb25zdCBuZXh0TmV3bGluZSA9IGNvbnRlbnQuaW5kZXhPZignXFxuJywgcG9zaXRpb24pO1xuICAgIGlmIChuZXh0TmV3bGluZSA9PT0gLTEgfHwgbmV4dE5ld2xpbmUgPiBvZmZzZXQpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHBvc2l0aW9uID0gbmV4dE5ld2xpbmUgKyAxO1xuICB9XG5cbiAgcmV0dXJuIHsgbGluZSwgY29sdW1uOiBvZmZzZXQgLSBwb3NpdGlvbiArIDEgfTtcbn1cblxuLyoqXG4gKiBGaW5kIHRoZSBkZWZhdWx0IHNlcnZlciBwYXRoLiBXZSBkb24ndCB3YW50IHRvIGV4cG9zZSBiYXNlSHJlZiBhbmQgZGVwbG95VXJsIGFzIGFyZ3VtZW50cywgb25seVxuICogdGhlIGJyb3dzZXIgb3B0aW9ucyB3aGVyZSBuZWVkZWQuIFRoaXMgbWV0aG9kIHNob3VsZCBzdGF5IHByaXZhdGUgKHBlb3BsZSB3aG8gd2FudCB0byByZXNvbHZlXG4gKiBiYXNlSHJlZiBhbmQgZGVwbG95VXJsIHNob3VsZCB1c2UgdGhlIGJ1aWxkU2VydmVQYXRoIGV4cG9ydGVkIGZ1bmN0aW9uLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gZmluZERlZmF1bHRTZXJ2ZVBhdGgoYmFzZUhyZWY/OiBzdHJpbmcsIGRlcGxveVVybD86IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICBpZiAoIWJhc2VIcmVmICYmICFkZXBsb3lVcmwpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cblxuICBpZiAoL14oXFx3KzopP1xcL1xcLy8udGVzdChiYXNlSHJlZiB8fCAnJykgfHwgL14oXFx3KzopP1xcL1xcLy8udGVzdChkZXBsb3lVcmwgfHwgJycpKSB7XG4gICAgLy8gSWYgYmFzZUhyZWYgb3IgZGVwbG95VXJsIGlzIGFic29sdXRlLCB1bnN1cHBvcnRlZCBieSBuZyBzZXJ2ZVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gbm9ybWFsaXplIGJhc2VIcmVmXG4gIC8vIGZvciBuZyBzZXJ2ZSB0aGUgc3RhcnRpbmcgYmFzZSBpcyBhbHdheXMgYC9gIHNvIGEgcmVsYXRpdmVcbiAgLy8gYW5kIHJvb3QgcmVsYXRpdmUgdmFsdWUgYXJlIGlkZW50aWNhbFxuICBjb25zdCBiYXNlSHJlZlBhcnRzID0gKGJhc2VIcmVmIHx8ICcnKS5zcGxpdCgnLycpLmZpbHRlcigocGFydCkgPT4gcGFydCAhPT0gJycpO1xuICBpZiAoYmFzZUhyZWYgJiYgIWJhc2VIcmVmLmVuZHNXaXRoKCcvJykpIHtcbiAgICBiYXNlSHJlZlBhcnRzLnBvcCgpO1xuICB9XG4gIGNvbnN0IG5vcm1hbGl6ZWRCYXNlSHJlZiA9IGJhc2VIcmVmUGFydHMubGVuZ3RoID09PSAwID8gJy8nIDogYC8ke2Jhc2VIcmVmUGFydHMuam9pbignLycpfS9gO1xuXG4gIGlmIChkZXBsb3lVcmwgJiYgZGVwbG95VXJsWzBdID09PSAnLycpIHtcbiAgICBpZiAoYmFzZUhyZWYgJiYgYmFzZUhyZWZbMF0gPT09ICcvJyAmJiBub3JtYWxpemVkQmFzZUhyZWYgIT09IGRlcGxveVVybCkge1xuICAgICAgLy8gSWYgYmFzZUhyZWYgYW5kIGRlcGxveVVybCBhcmUgcm9vdCByZWxhdGl2ZSBhbmQgbm90IGVxdWl2YWxlbnQsIHVuc3VwcG9ydGVkIGJ5IG5nIHNlcnZlXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVwbG95VXJsO1xuICB9XG5cbiAgLy8gSm9pbiB0b2dldGhlciBiYXNlSHJlZiBhbmQgZGVwbG95VXJsXG4gIHJldHVybiBgJHtub3JtYWxpemVkQmFzZUhyZWZ9JHtkZXBsb3lVcmwgfHwgJyd9YDtcbn1cblxuZnVuY3Rpb24gZ2V0QWxsb3dlZEhvc3RzQ29uZmlnKFxuICBvcHRpb25zOiBXZWJwYWNrRGV2U2VydmVyT3B0aW9ucyxcbik6IERldlNlcnZlckNvbmZpZ3VyYXRpb25bJ2FsbG93ZWRIb3N0cyddIHtcbiAgaWYgKG9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjaykge1xuICAgIHJldHVybiAnYWxsJztcbiAgfSBlbHNlIGlmIChvcHRpb25zLmFsbG93ZWRIb3N0cz8ubGVuZ3RoKSB7XG4gICAgcmV0dXJuIG9wdGlvbnMuYWxsb3dlZEhvc3RzO1xuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZ2V0V2ViU29ja2V0U2V0dGluZ3MoXG4gIG9wdGlvbnM6IFdlYnBhY2tEZXZTZXJ2ZXJPcHRpb25zLFxuICBzZXJ2ZVBhdGg6IHN0cmluZyxcbik6IHtcbiAgd2ViU29ja2V0U2VydmVyPzogRGV2U2VydmVyQ29uZmlndXJhdGlvblsnd2ViU29ja2V0U2VydmVyJ107XG4gIGNsaWVudD86IERldlNlcnZlckNvbmZpZ3VyYXRpb25bJ2NsaWVudCddO1xufSB7XG4gIGNvbnN0IHsgaG1yLCBsaXZlUmVsb2FkIH0gPSBvcHRpb25zO1xuICBpZiAoIWhtciAmJiAhbGl2ZVJlbG9hZCkge1xuICAgIHJldHVybiB7XG4gICAgICB3ZWJTb2NrZXRTZXJ2ZXI6IGZhbHNlLFxuICAgICAgY2xpZW50OiB1bmRlZmluZWQsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHdlYlNvY2tldFBhdGggPSBwb3NpeC5qb2luKHNlcnZlUGF0aCwgJ3dzJyk7XG5cbiAgcmV0dXJuIHtcbiAgICB3ZWJTb2NrZXRTZXJ2ZXI6IHtcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgcGF0aDogd2ViU29ja2V0UGF0aCxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBjbGllbnQ6IHtcbiAgICAgIGxvZ2dpbmc6ICdpbmZvJyxcbiAgICAgIHdlYlNvY2tldFVSTDogZ2V0UHVibGljSG9zdE9wdGlvbnMob3B0aW9ucywgd2ViU29ja2V0UGF0aCksXG4gICAgICBvdmVybGF5OiB7XG4gICAgICAgIGVycm9yczogdHJ1ZSxcbiAgICAgICAgd2FybmluZ3M6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRQdWJsaWNIb3N0T3B0aW9ucyhvcHRpb25zOiBXZWJwYWNrRGV2U2VydmVyT3B0aW9ucywgd2ViU29ja2V0UGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHB1YmxpY0hvc3Q6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQgPSBvcHRpb25zLnB1YmxpY0hvc3Q7XG4gIGlmIChwdWJsaWNIb3N0KSB7XG4gICAgY29uc3QgaG9zdFdpdGhQcm90b2NvbCA9ICEvXlxcdys6XFwvXFwvLy50ZXN0KHB1YmxpY0hvc3QpID8gYGh0dHBzOi8vJHtwdWJsaWNIb3N0fWAgOiBwdWJsaWNIb3N0O1xuICAgIHB1YmxpY0hvc3QgPSBuZXcgVVJMKGhvc3RXaXRoUHJvdG9jb2wpLmhvc3Q7XG4gIH1cblxuICByZXR1cm4gYGF1dG86Ly8ke3B1YmxpY0hvc3QgfHwgJzAuMC4wLjA6MCd9JHt3ZWJTb2NrZXRQYXRofWA7XG59XG4iXX0=