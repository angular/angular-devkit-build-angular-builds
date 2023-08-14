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
async function prerenderPages(workspaceRoot, tsConfigPath, appShellOptions = {}, prerenderOptions = {}, outputFiles, document, inlineCriticalCss, maxThreads = 1) {
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
            workspaceRoot,
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
                    const outPath = isAppShellRoute
                        ? 'index.html'
                        : node_path_1.posix.join(route.startsWith('/') ? route.slice(1) /* Remove leading slash */ : route, 'index.html');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlcmVuZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvc2VydmVyLXJlbmRlcmluZy9wcmVyZW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCwrQ0FBNEM7QUFDNUMseUNBQTJDO0FBQzNDLHNEQUE4QjtBQWN2QixLQUFLLFVBQVUsY0FBYyxDQUNsQyxhQUFxQixFQUNyQixZQUFvQixFQUNwQixrQkFBbUMsRUFBRSxFQUNyQyxtQkFBcUMsRUFBRSxFQUN2QyxXQUFtQyxFQUNuQyxRQUFnQixFQUNoQixpQkFBMkIsRUFDM0IsVUFBVSxHQUFHLENBQUM7SUFNZCxNQUFNLFNBQVMsR0FBRyxNQUFNLFlBQVksQ0FBQyxZQUFZLEVBQUUsZUFBZSxFQUFFLGdCQUFnQixDQUFDLENBQUM7SUFDdEYsTUFBTSxvQkFBb0IsR0FBMkIsRUFBRSxDQUFDO0lBRXhELEtBQUssTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxXQUFXLEVBQUU7UUFDeEMsUUFBUSxJQUFBLG1CQUFPLEVBQUMsSUFBSSxDQUFDLEVBQUU7WUFDckIsS0FBSyxNQUFNLENBQUMsQ0FBQyxpREFBaUQ7WUFDOUQsS0FBSyxNQUFNLEVBQUUsMkNBQTJDO2dCQUN0RCxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUM7Z0JBQ2xDLE1BQU07U0FDVDtLQUNGO0lBRUQsTUFBTSxZQUFZLEdBQUcsSUFBSSxpQkFBTyxDQUFDO1FBQy9CLFFBQVEsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDO1FBQzVDLFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDO1FBQ2hE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Q0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNyQixJQUFJLEtBQUssRUFBRTtnQkFDVCxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQ25CO1NBQ0Y7S0FDRjtJQUVELElBQUksY0FBYyxFQUFFO1FBQ2xCLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxHQUFHLHdEQUFhLGNBQWMsR0FBQyxDQUFDO1FBQzVELEtBQUssTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxFQUFFO1lBQ3ZELDBEQUEwRDtZQUMxRCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDdEIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUNsQjtTQUNGO0tBQ0Y7SUFFRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBleHRuYW1lLCBwb3NpeCB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgUGlzY2luYSBmcm9tICdwaXNjaW5hJztcbmltcG9ydCB0eXBlIHsgUmVuZGVyUmVzdWx0LCBTZXJ2ZXJDb250ZXh0IH0gZnJvbSAnLi9yZW5kZXItcGFnZSc7XG5pbXBvcnQgdHlwZSB7IFdvcmtlckRhdGEgfSBmcm9tICcuL3JlbmRlci13b3JrZXInO1xuXG5pbnRlcmZhY2UgUHJlcmVuZGVyT3B0aW9ucyB7XG4gIHJvdXRlc0ZpbGU/OiBzdHJpbmc7XG4gIGRpc2NvdmVyUm91dGVzPzogYm9vbGVhbjtcbiAgcm91dGVzPzogc3RyaW5nW107XG59XG5cbmludGVyZmFjZSBBcHBTaGVsbE9wdGlvbnMge1xuICByb3V0ZT86IHN0cmluZztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHByZXJlbmRlclBhZ2VzKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIHRzQ29uZmlnUGF0aDogc3RyaW5nLFxuICBhcHBTaGVsbE9wdGlvbnM6IEFwcFNoZWxsT3B0aW9ucyA9IHt9LFxuICBwcmVyZW5kZXJPcHRpb25zOiBQcmVyZW5kZXJPcHRpb25zID0ge30sXG4gIG91dHB1dEZpbGVzOiBSZWFkb25seTxPdXRwdXRGaWxlW10+LFxuICBkb2N1bWVudDogc3RyaW5nLFxuICBpbmxpbmVDcml0aWNhbENzcz86IGJvb2xlYW4sXG4gIG1heFRocmVhZHMgPSAxLFxuKTogUHJvbWlzZTx7XG4gIG91dHB1dDogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgd2FybmluZ3M6IHN0cmluZ1tdO1xuICBlcnJvcnM6IHN0cmluZ1tdO1xufT4ge1xuICBjb25zdCBhbGxSb3V0ZXMgPSBhd2FpdCBnZXRBbGxSb3V0ZXModHNDb25maWdQYXRoLCBhcHBTaGVsbE9wdGlvbnMsIHByZXJlbmRlck9wdGlvbnMpO1xuICBjb25zdCBvdXRwdXRGaWxlc0ZvcldvcmtlcjogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuXG4gIGZvciAoY29uc3QgeyB0ZXh0LCBwYXRoIH0gb2Ygb3V0cHV0RmlsZXMpIHtcbiAgICBzd2l0Y2ggKGV4dG5hbWUocGF0aCkpIHtcbiAgICAgIGNhc2UgJy5tanMnOiAvLyBDb250YWlucyB0aGUgc2VydmVyIHJ1bm5hYmxlIGFwcGxpY2F0aW9uIGNvZGUuXG4gICAgICBjYXNlICcuY3NzJzogLy8gR2xvYmFsIHN0eWxlcyBmb3IgY3JpdGljYWwgQ1NTIGlubGluaW5nLlxuICAgICAgICBvdXRwdXRGaWxlc0ZvcldvcmtlcltwYXRoXSA9IHRleHQ7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHJlbmRlcldvcmtlciA9IG5ldyBQaXNjaW5hKHtcbiAgICBmaWxlbmFtZTogcmVxdWlyZS5yZXNvbHZlKCcuL3JlbmRlci13b3JrZXInKSxcbiAgICBtYXhUaHJlYWRzOiBNYXRoLm1pbihhbGxSb3V0ZXMuc2l6ZSwgbWF4VGhyZWFkcyksXG4gICAgd29ya2VyRGF0YToge1xuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgIG91dHB1dEZpbGVzOiBvdXRwdXRGaWxlc0ZvcldvcmtlcixcbiAgICAgIGlubGluZUNyaXRpY2FsQ3NzLFxuICAgICAgZG9jdW1lbnQsXG4gICAgfSBhcyBXb3JrZXJEYXRhLFxuICAgIGV4ZWNBcmd2OiBbXG4gICAgICAnLS1uby13YXJuaW5ncycsIC8vIFN1cHByZXNzIGBFeHBlcmltZW50YWxXYXJuaW5nOiBDdXN0b20gRVNNIExvYWRlcnMgaXMgYW4gZXhwZXJpbWVudGFsIGZlYXR1cmUuLi5gLlxuICAgICAgJy0tbG9hZGVyJyxcbiAgICAgIHJlcXVpcmUucmVzb2x2ZSgnLi9lc20taW4tbWVtb3J5LWZpbGUtbG9hZGVyLmpzJyksXG4gICAgXSxcbiAgfSk7XG5cbiAgY29uc3Qgb3V0cHV0OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZW5kZXJpbmdQcm9taXNlczogUHJvbWlzZTx2b2lkPltdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIGFsbFJvdXRlcykge1xuICAgICAgY29uc3QgaXNBcHBTaGVsbFJvdXRlID0gYXBwU2hlbGxPcHRpb25zLnJvdXRlID09PSByb3V0ZTtcbiAgICAgIGNvbnN0IHNlcnZlckNvbnRleHQ6IFNlcnZlckNvbnRleHQgPSBpc0FwcFNoZWxsUm91dGUgPyAnYXBwLXNoZWxsJyA6ICdzc2cnO1xuXG4gICAgICBjb25zdCByZW5kZXI6IFByb21pc2U8UmVuZGVyUmVzdWx0PiA9IHJlbmRlcldvcmtlci5ydW4oeyByb3V0ZSwgc2VydmVyQ29udGV4dCB9KTtcbiAgICAgIGNvbnN0IHJlbmRlclJlc3VsdDogUHJvbWlzZTx2b2lkPiA9IHJlbmRlci50aGVuKCh7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSkgPT4ge1xuICAgICAgICBpZiAoY29udGVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc3Qgb3V0UGF0aCA9IGlzQXBwU2hlbGxSb3V0ZVxuICAgICAgICAgICAgPyAnaW5kZXguaHRtbCdcbiAgICAgICAgICAgIDogcG9zaXguam9pbihcbiAgICAgICAgICAgICAgICByb3V0ZS5zdGFydHNXaXRoKCcvJykgPyByb3V0ZS5zbGljZSgxKSAvKiBSZW1vdmUgbGVhZGluZyBzbGFzaCAqLyA6IHJvdXRlLFxuICAgICAgICAgICAgICAgICdpbmRleC5odG1sJyxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICBvdXRwdXRbb3V0UGF0aF0gPSBjb250ZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHdhcm5pbmdzKSB7XG4gICAgICAgICAgd2FybmluZ3MucHVzaCguLi53YXJuaW5ncyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXJyb3JzKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHJlbmRlcmluZ1Byb21pc2VzLnB1c2gocmVuZGVyUmVzdWx0KTtcbiAgICB9XG5cbiAgICBhd2FpdCBQcm9taXNlLmFsbChyZW5kZXJpbmdQcm9taXNlcyk7XG4gIH0gZmluYWxseSB7XG4gICAgdm9pZCByZW5kZXJXb3JrZXIuZGVzdHJveSgpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBlcnJvcnMsXG4gICAgd2FybmluZ3MsXG4gICAgb3V0cHV0LFxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRBbGxSb3V0ZXMoXG4gIHRzQ29uZmlnUGF0aDogc3RyaW5nLFxuICBhcHBTaGVsbE9wdGlvbnM6IEFwcFNoZWxsT3B0aW9ucyxcbiAgcHJlcmVuZGVyT3B0aW9uczogUHJlcmVuZGVyT3B0aW9ucyxcbik6IFByb21pc2U8U2V0PHN0cmluZz4+IHtcbiAgY29uc3QgeyByb3V0ZXNGaWxlLCBkaXNjb3ZlclJvdXRlcywgcm91dGVzOiBleGlzdGluZ1JvdXRlcyB9ID0gcHJlcmVuZGVyT3B0aW9ucztcbiAgY29uc3Qgcm91dGVzID0gbmV3IFNldChleGlzdGluZ1JvdXRlcyk7XG5cbiAgY29uc3QgeyByb3V0ZTogYXBwU2hlbGxSb3V0ZSB9ID0gYXBwU2hlbGxPcHRpb25zO1xuICBpZiAoYXBwU2hlbGxSb3V0ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcm91dGVzLmFkZChhcHBTaGVsbFJvdXRlKTtcbiAgfVxuXG4gIGlmIChyb3V0ZXNGaWxlKSB7XG4gICAgY29uc3Qgcm91dGVzRnJvbUZpbGUgPSAoYXdhaXQgcmVhZEZpbGUocm91dGVzRmlsZSwgJ3V0ZjgnKSkuc3BsaXQoL1xccj9cXG4vKTtcbiAgICBmb3IgKGxldCByb3V0ZSBvZiByb3V0ZXNGcm9tRmlsZSkge1xuICAgICAgcm91dGUgPSByb3V0ZS50cmltKCk7XG4gICAgICBpZiAocm91dGUpIHtcbiAgICAgICAgcm91dGVzLmFkZChyb3V0ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKGRpc2NvdmVyUm91dGVzKSB7XG4gICAgY29uc3QgeyBwYXJzZUFuZ3VsYXJSb3V0ZXMgfSA9IGF3YWl0IGltcG9ydCgnZ3Vlc3MtcGFyc2VyJyk7XG4gICAgZm9yIChjb25zdCB7IHBhdGggfSBvZiBwYXJzZUFuZ3VsYXJSb3V0ZXModHNDb25maWdQYXRoKSkge1xuICAgICAgLy8gRXhjbHVkZSBkeW5hbWljIHJvdXRlcyBhcyB0aGVzZSBjYW5ub3QgYmUgcHJlLXJlbmRlcmVkLlxuICAgICAgaWYgKCEvWyo6XS8udGVzdChwYXRoKSkge1xuICAgICAgICByb3V0ZXMuYWRkKHBhdGgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByb3V0ZXM7XG59XG4iXX0=