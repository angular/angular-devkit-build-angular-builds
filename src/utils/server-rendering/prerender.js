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
exports.prerenderPages = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const piscina_1 = __importDefault(require("piscina"));
async function prerenderPages(tsConfigPath, appShellOptions = {}, prerenderOptions = {}, outputFiles, document, inlineCriticalCss, maxThreads = 1) {
    const allRoutes = await getAllRoutes(tsConfigPath, appShellOptions, prerenderOptions);
    const outputFilesForWorker = {};
    for (const { text, path } of outputFiles) {
        switch ((0, node_path_1.extname)(path)) {
            case '.mjs': // Contains the server runnable application code.
            case '.css': // Global styles for critical CSS inlining.
                outputFilesForWorker[path] = text;
                break;
        }
    }
    const renderWorker = new piscina_1.default({
        filename: require.resolve('./render-worker'),
        maxThreads: Math.min(allRoutes.size, maxThreads),
        workerData: {
            outputFiles: outputFilesForWorker,
            inlineCriticalCss,
            document,
        },
        execArgv: [
            '--no-warnings',
            '--loader',
            require.resolve('./esm-in-memory-file-loader.js'),
        ],
    });
    const output = {};
    const warnings = [];
    const errors = [];
    try {
        const renderingPromises = [];
        for (const route of allRoutes) {
            const isAppShellRoute = appShellOptions.route === route;
            const serverContext = isAppShellRoute ? 'app-shell' : 'ssg';
            const render = renderWorker.run({ route, serverContext });
            const renderResult = render.then(({ content, warnings, errors }) => {
                if (content !== undefined) {
                    const outPath = isAppShellRoute ? 'index.html' : node_path_1.posix.join(route, 'index.html');
                    output[outPath] = content;
                }
                if (warnings) {
                    warnings.push(...warnings);
                }
                if (errors) {
                    errors.push(...errors);
                }
            });
            renderingPromises.push(renderResult);
        }
        await Promise.all(renderingPromises);
    }
    finally {
        void renderWorker.destroy();
    }
    return {
        errors,
        warnings,
        output,
    };
}
exports.prerenderPages = prerenderPages;
async function getAllRoutes(tsConfigPath, appShellOptions, prerenderOptions) {
    const { routesFile, discoverRoutes, routes: existingRoutes } = prerenderOptions;
    const routes = new Set(existingRoutes);
    const { route: appShellRoute } = appShellOptions;
    if (appShellRoute !== undefined) {
        routes.add(appShellRoute);
    }
    if (routesFile) {
        const routesFromFile = (await (0, promises_1.readFile)(routesFile, 'utf8')).split(/\r?\n/);
        for (let route of routesFromFile) {
            route = route.trim();
            if (route) {
                routes.add(route);
            }
        }
    }
    if (discoverRoutes) {
        const { parseAngularRoutes } = await Promise.resolve().then(() => __importStar(require('guess-parser')));
        for (const { path } of parseAngularRoutes(tsConfigPath)) {
            // Exclude dynamic routes as these cannot be pre-rendered.
            if (!/[*:]/.test(path)) {
                routes.add(path);
            }
        }
    }
    return routes;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlcmVuZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvc2VydmVyLXJlbmRlcmluZy9wcmVyZW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCwrQ0FBNEM7QUFDNUMseUNBQTJDO0FBQzNDLHNEQUE4QjtBQWN2QixLQUFLLFVBQVUsY0FBYyxDQUNsQyxZQUFvQixFQUNwQixrQkFBbUMsRUFBRSxFQUNyQyxtQkFBcUMsRUFBRSxFQUN2QyxXQUFtQyxFQUNuQyxRQUFnQixFQUNoQixpQkFBMkIsRUFDM0IsVUFBVSxHQUFHLENBQUM7SUFNZCxNQUFNLFNBQVMsR0FBRyxNQUFNLFlBQVksQ0FBQyxZQUFZLEVBQUUsZUFBZSxFQUFFLGdCQUFnQixDQUFDLENBQUM7SUFDdEYsTUFBTSxvQkFBb0IsR0FBMkIsRUFBRSxDQUFDO0lBRXhELEtBQUssTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxXQUFXLEVBQUU7UUFDeEMsUUFBUSxJQUFBLG1CQUFPLEVBQUMsSUFBSSxDQUFDLEVBQUU7WUFDckIsS0FBSyxNQUFNLENBQUMsQ0FBQyxpREFBaUQ7WUFDOUQsS0FBSyxNQUFNLEVBQUUsMkNBQTJDO2dCQUN0RCxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUM7Z0JBQ2xDLE1BQU07U0FDVDtLQUNGO0lBRUQsTUFBTSxZQUFZLEdBQUcsSUFBSSxpQkFBTyxDQUFDO1FBQy9CLFFBQVEsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDO1FBQzVDLFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDO1FBQ2hELFVBQVUsRUFBRTtZ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TSxFQUFFLGtCQUFrQixFQUFFLEdBQUcsd0RBQWEsY0FBYyxHQUFDLENBQUM7UUFDNUQsS0FBSyxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksa0JBQWtCLENBQUMsWUFBWSxDQUFDLEVBQUU7WUFDdkQsMERBQTBEO1lBQzFELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUN0QixNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ2xCO1NBQ0Y7S0FDRjtJQUVELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IGV4dG5hbWUsIHBvc2l4IH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCBQaXNjaW5hIGZyb20gJ3Bpc2NpbmEnO1xuaW1wb3J0IHR5cGUgeyBSZW5kZXJSZXN1bHQsIFNlcnZlckNvbnRleHQgfSBmcm9tICcuL3JlbmRlci1wYWdlJztcbmltcG9ydCB0eXBlIHsgV29ya2VyRGF0YSB9IGZyb20gJy4vcmVuZGVyLXdvcmtlcic7XG5cbmludGVyZmFjZSBQcmVyZW5kZXJPcHRpb25zIHtcbiAgcm91dGVzRmlsZT86IHN0cmluZztcbiAgZGlzY292ZXJSb3V0ZXM/OiBib29sZWFuO1xuICByb3V0ZXM/OiBzdHJpbmdbXTtcbn1cblxuaW50ZXJmYWNlIEFwcFNoZWxsT3B0aW9ucyB7XG4gIHJvdXRlPzogc3RyaW5nO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcHJlcmVuZGVyUGFnZXMoXG4gIHRzQ29uZmlnUGF0aDogc3RyaW5nLFxuICBhcHBTaGVsbE9wdGlvbnM6IEFwcFNoZWxsT3B0aW9ucyA9IHt9LFxuICBwcmVyZW5kZXJPcHRpb25zOiBQcmVyZW5kZXJPcHRpb25zID0ge30sXG4gIG91dHB1dEZpbGVzOiBSZWFkb25seTxPdXRwdXRGaWxlW10+LFxuICBkb2N1bWVudDogc3RyaW5nLFxuICBpbmxpbmVDcml0aWNhbENzcz86IGJvb2xlYW4sXG4gIG1heFRocmVhZHMgPSAxLFxuKTogUHJvbWlzZTx7XG4gIG91dHB1dDogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgd2FybmluZ3M6IHN0cmluZ1tdO1xuICBlcnJvcnM6IHN0cmluZ1tdO1xufT4ge1xuICBjb25zdCBhbGxSb3V0ZXMgPSBhd2FpdCBnZXRBbGxSb3V0ZXModHNDb25maWdQYXRoLCBhcHBTaGVsbE9wdGlvbnMsIHByZXJlbmRlck9wdGlvbnMpO1xuICBjb25zdCBvdXRwdXRGaWxlc0ZvcldvcmtlcjogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuXG4gIGZvciAoY29uc3QgeyB0ZXh0LCBwYXRoIH0gb2Ygb3V0cHV0RmlsZXMpIHtcbiAgICBzd2l0Y2ggKGV4dG5hbWUocGF0aCkpIHtcbiAgICAgIGNhc2UgJy5tanMnOiAvLyBDb250YWlucyB0aGUgc2VydmVyIHJ1bm5hYmxlIGFwcGxpY2F0aW9uIGNvZGUuXG4gICAgICBjYXNlICcuY3NzJzogLy8gR2xvYmFsIHN0eWxlcyBmb3IgY3JpdGljYWwgQ1NTIGlubGluaW5nLlxuICAgICAgICBvdXRwdXRGaWxlc0ZvcldvcmtlcltwYXRoXSA9IHRleHQ7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHJlbmRlcldvcmtlciA9IG5ldyBQaXNjaW5hKHtcbiAgICBmaWxlbmFtZTogcmVxdWlyZS5yZXNvbHZlKCcuL3JlbmRlci13b3JrZXInKSxcbiAgICBtYXhUaHJlYWRzOiBNYXRoLm1pbihhbGxSb3V0ZXMuc2l6ZSwgbWF4VGhyZWFkcyksXG4gICAgd29ya2VyRGF0YToge1xuICAgICAgb3V0cHV0RmlsZXM6IG91dHB1dEZpbGVzRm9yV29ya2VyLFxuICAgICAgaW5saW5lQ3JpdGljYWxDc3MsXG4gICAgICBkb2N1bWVudCxcbiAgICB9IGFzIFdvcmtlckRhdGEsXG4gICAgZXhlY0FyZ3Y6IFtcbiAgICAgICctLW5vLXdhcm5pbmdzJywgLy8gU3VwcHJlc3MgYEV4cGVyaW1lbnRhbFdhcm5pbmc6IEN1c3RvbSBFU00gTG9hZGVycyBpcyBhbiBleHBlcmltZW50YWwgZmVhdHVyZS4uLmAuXG4gICAgICAnLS1sb2FkZXInLFxuICAgICAgcmVxdWlyZS5yZXNvbHZlKCcuL2VzbS1pbi1tZW1vcnktZmlsZS1sb2FkZXIuanMnKSxcbiAgICBdLFxuICB9KTtcblxuICBjb25zdCBvdXRwdXQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcblxuICB0cnkge1xuICAgIGNvbnN0IHJlbmRlcmluZ1Byb21pc2VzOiBQcm9taXNlPHZvaWQ+W10gPSBbXTtcblxuICAgIGZvciAoY29uc3Qgcm91dGUgb2YgYWxsUm91dGVzKSB7XG4gICAgICBjb25zdCBpc0FwcFNoZWxsUm91dGUgPSBhcHBTaGVsbE9wdGlvbnMucm91dGUgPT09IHJvdXRlO1xuICAgICAgY29uc3Qgc2VydmVyQ29udGV4dDogU2VydmVyQ29udGV4dCA9IGlzQXBwU2hlbGxSb3V0ZSA/ICdhcHAtc2hlbGwnIDogJ3NzZyc7XG5cbiAgICAgIGNvbnN0IHJlbmRlcjogUHJvbWlzZTxSZW5kZXJSZXN1bHQ+ID0gcmVuZGVyV29ya2VyLnJ1bih7IHJvdXRlLCBzZXJ2ZXJDb250ZXh0IH0pO1xuICAgICAgY29uc3QgcmVuZGVyUmVzdWx0OiBQcm9taXNlPHZvaWQ+ID0gcmVuZGVyLnRoZW4oKHsgY29udGVudCwgd2FybmluZ3MsIGVycm9ycyB9KSA9PiB7XG4gICAgICAgIGlmIChjb250ZW50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBjb25zdCBvdXRQYXRoID0gaXNBcHBTaGVsbFJvdXRlID8gJ2luZGV4Lmh0bWwnIDogcG9zaXguam9pbihyb3V0ZSwgJ2luZGV4Lmh0bWwnKTtcbiAgICAgICAgICBvdXRwdXRbb3V0UGF0aF0gPSBjb250ZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHdhcm5pbmdzKSB7XG4gICAgICAgICAgd2FybmluZ3MucHVzaCguLi53YXJuaW5ncyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXJyb3JzKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHJlbmRlcmluZ1Byb21pc2VzLnB1c2gocmVuZGVyUmVzdWx0KTtcbiAgICB9XG5cbiAgICBhd2FpdCBQcm9taXNlLmFsbChyZW5kZXJpbmdQcm9taXNlcyk7XG4gIH0gZmluYWxseSB7XG4gICAgdm9pZCByZW5kZXJXb3JrZXIuZGVzdHJveSgpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBlcnJvcnMsXG4gICAgd2FybmluZ3MsXG4gICAgb3V0cHV0LFxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRBbGxSb3V0ZXMoXG4gIHRzQ29uZmlnUGF0aDogc3RyaW5nLFxuICBhcHBTaGVsbE9wdGlvbnM6IEFwcFNoZWxsT3B0aW9ucyxcbiAgcHJlcmVuZGVyT3B0aW9uczogUHJlcmVuZGVyT3B0aW9ucyxcbik6IFByb21pc2U8U2V0PHN0cmluZz4+IHtcbiAgY29uc3QgeyByb3V0ZXNGaWxlLCBkaXNjb3ZlclJvdXRlcywgcm91dGVzOiBleGlzdGluZ1JvdXRlcyB9ID0gcHJlcmVuZGVyT3B0aW9ucztcbiAgY29uc3Qgcm91dGVzID0gbmV3IFNldChleGlzdGluZ1JvdXRlcyk7XG5cbiAgY29uc3QgeyByb3V0ZTogYXBwU2hlbGxSb3V0ZSB9ID0gYXBwU2hlbGxPcHRpb25zO1xuICBpZiAoYXBwU2hlbGxSb3V0ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcm91dGVzLmFkZChhcHBTaGVsbFJvdXRlKTtcbiAgfVxuXG4gIGlmIChyb3V0ZXNGaWxlKSB7XG4gICAgY29uc3Qgcm91dGVzRnJvbUZpbGUgPSAoYXdhaXQgcmVhZEZpbGUocm91dGVzRmlsZSwgJ3V0ZjgnKSkuc3BsaXQoL1xccj9cXG4vKTtcbiAgICBmb3IgKGxldCByb3V0ZSBvZiByb3V0ZXNGcm9tRmlsZSkge1xuICAgICAgcm91dGUgPSByb3V0ZS50cmltKCk7XG4gICAgICBpZiAocm91dGUpIHtcbiAgICAgICAgcm91dGVzLmFkZChyb3V0ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKGRpc2NvdmVyUm91dGVzKSB7XG4gICAgY29uc3QgeyBwYXJzZUFuZ3VsYXJSb3V0ZXMgfSA9IGF3YWl0IGltcG9ydCgnZ3Vlc3MtcGFyc2VyJyk7XG4gICAgZm9yIChjb25zdCB7IHBhdGggfSBvZiBwYXJzZUFuZ3VsYXJSb3V0ZXModHNDb25maWdQYXRoKSkge1xuICAgICAgLy8gRXhjbHVkZSBkeW5hbWljIHJvdXRlcyBhcyB0aGVzZSBjYW5ub3QgYmUgcHJlLXJlbmRlcmVkLlxuICAgICAgaWYgKCEvWyo6XS8udGVzdChwYXRoKSkge1xuICAgICAgICByb3V0ZXMuYWRkKHBhdGgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByb3V0ZXM7XG59XG4iXX0=