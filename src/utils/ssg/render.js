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
            zonePackage: require.resolve('zone.js', { paths: [workspaceRoot] }),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvc3NnL3JlbmRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILCtDQUE0QztBQUM1Qyx5Q0FBMkM7QUFDM0Msc0RBQThCO0FBYXZCLEtBQUssVUFBVSxjQUFjLENBQ2xDLGFBQXFCLEVBQ3JCLFlBQW9CLEVBQ3BCLGtCQUFtQyxFQUFFLEVBQ3JDLG1CQUFxQyxFQUFFLEVBQ3ZDLFdBQW1DLEVBQ25DLFFBQWdCLEVBQ2hCLGlCQUEyQixFQUMzQixVQUFVLEdBQUcsQ0FBQztJQU1kLE1BQU0sU0FBUyxHQUFHLE1BQU0sWUFBWSxDQUFDLFlBQVksRUFBRSxlQUFlLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztJQUN0RixNQUFNLG9CQUFvQixHQUEyQixFQUFFLENBQUM7SUFFeEQsS0FBSyxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLFdBQVcsRUFBRTtRQUN4QyxRQUFRLElBQUEsbUJBQU8sRUFBQyxJQUFJLENBQUMsRUFBRTtZQUNyQixLQUFLLE1BQU0sQ0FBQyxDQUFDLGlEQUFpRDtZQUM5RCxLQUFLLE1BQU0sRUFBRSwyQ0FBMkM7Z0JBQ3RELG9CQUFvQixDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQztnQkFDbEMsTUFBTTtTQUNUO0tBQ0Y7SUFFRCxNQUFNLFlBQVksR0FBRyxJQUFJLGlCQUFPLENBQUM7UUFDL0IsUUFBUSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUM7UUFDNUMsVUFBVSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUM7UUFDaEQsVUFBVSxFQUFFO1lBQ1YsV0FB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QUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQ25CO1NBQ0Y7S0FDRjtJQUVELElBQUksY0FBYyxFQUFFO1FBQ2xCLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxHQUFHLHdEQUFhLGNBQWMsR0FBQyxDQUFDO1FBQzVELEtBQUssTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxFQUFFO1lBQ3ZELDBEQUEwRDtZQUMxRCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDdEIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUNsQjtTQUNGO0tBQ0Y7SUFFRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBleHRuYW1lLCBwb3NpeCB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgUGlzY2luYSBmcm9tICdwaXNjaW5hJztcbmltcG9ydCB0eXBlIHsgUmVuZGVyUmVzdWx0LCBTZXJ2ZXJDb250ZXh0LCBXb3JrZXJEYXRhIH0gZnJvbSAnLi9yZW5kZXItd29ya2VyJztcblxuaW50ZXJmYWNlIHByZXJlbmRlck9wdGlvbnMge1xuICByb3V0ZXNGaWxlPzogc3RyaW5nO1xuICBkaXNjb3ZlclJvdXRlcz86IGJvb2xlYW47XG4gIHJvdXRlcz86IHN0cmluZ1tdO1xufVxuXG5pbnRlcmZhY2UgQXBwU2hlbGxPcHRpb25zIHtcbiAgcm91dGU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcmVyZW5kZXJQYWdlcyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICB0c0NvbmZpZ1BhdGg6IHN0cmluZyxcbiAgYXBwU2hlbGxPcHRpb25zOiBBcHBTaGVsbE9wdGlvbnMgPSB7fSxcbiAgcHJlcmVuZGVyT3B0aW9uczogcHJlcmVuZGVyT3B0aW9ucyA9IHt9LFxuICBvdXRwdXRGaWxlczogUmVhZG9ubHk8T3V0cHV0RmlsZVtdPixcbiAgZG9jdW1lbnQ6IHN0cmluZyxcbiAgaW5saW5lQ3JpdGljYWxDc3M/OiBib29sZWFuLFxuICBtYXhUaHJlYWRzID0gMSxcbik6IFByb21pc2U8e1xuICBvdXRwdXQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIHdhcm5pbmdzOiBzdHJpbmdbXTtcbiAgZXJyb3JzOiBzdHJpbmdbXTtcbn0+IHtcbiAgY29uc3QgYWxsUm91dGVzID0gYXdhaXQgZ2V0QWxsUm91dGVzKHRzQ29uZmlnUGF0aCwgYXBwU2hlbGxPcHRpb25zLCBwcmVyZW5kZXJPcHRpb25zKTtcbiAgY29uc3Qgb3V0cHV0RmlsZXNGb3JXb3JrZXI6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcblxuICBmb3IgKGNvbnN0IHsgdGV4dCwgcGF0aCB9IG9mIG91dHB1dEZpbGVzKSB7XG4gICAgc3dpdGNoIChleHRuYW1lKHBhdGgpKSB7XG4gICAgICBjYXNlICcubWpzJzogLy8gQ29udGFpbnMgdGhlIHNlcnZlciBydW5uYWJsZSBhcHBsaWNhdGlvbiBjb2RlLlxuICAgICAgY2FzZSAnLmNzcyc6IC8vIEdsb2JhbCBzdHlsZXMgZm9yIGNyaXRpY2FsIENTUyBpbmxpbmluZy5cbiAgICAgICAgb3V0cHV0RmlsZXNGb3JXb3JrZXJbcGF0aF0gPSB0ZXh0O1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBjb25zdCByZW5kZXJXb3JrZXIgPSBuZXcgUGlzY2luYSh7XG4gICAgZmlsZW5hbWU6IHJlcXVpcmUucmVzb2x2ZSgnLi9yZW5kZXItd29ya2VyJyksXG4gICAgbWF4VGhyZWFkczogTWF0aC5taW4oYWxsUm91dGVzLnNpemUsIG1heFRocmVhZHMpLFxuICAgIHdvcmtlckRhdGE6IHtcbiAgICAgIHpvbmVQYWNrYWdlOiByZXF1aXJlLnJlc29sdmUoJ3pvbmUuanMnLCB7IHBhdGhzOiBbd29ya3NwYWNlUm9vdF0gfSksXG4gICAgICBvdXRwdXRGaWxlczogb3V0cHV0RmlsZXNGb3JXb3JrZXIsXG4gICAgICBpbmxpbmVDcml0aWNhbENzcyxcbiAgICAgIGRvY3VtZW50LFxuICAgIH0gYXMgV29ya2VyRGF0YSxcbiAgICBleGVjQXJndjogW1xuICAgICAgJy0tbm8td2FybmluZ3MnLCAvLyBTdXBwcmVzcyBgRXhwZXJpbWVudGFsV2FybmluZzogQ3VzdG9tIEVTTSBMb2FkZXJzIGlzIGFuIGV4cGVyaW1lbnRhbCBmZWF0dXJlLi4uYC5cbiAgICAgICctLWxvYWRlcicsXG4gICAgICByZXF1aXJlLnJlc29sdmUoJy4vZXNtLWluLW1lbW9yeS1maWxlLWxvYWRlci5qcycpLFxuICAgIF0sXG4gIH0pO1xuXG4gIGNvbnN0IG91dHB1dDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVuZGVyaW5nUHJvbWlzZXM6IFByb21pc2U8dm9pZD5bXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiBhbGxSb3V0ZXMpIHtcbiAgICAgIGNvbnN0IGlzQXBwU2hlbGxSb3V0ZSA9IGFwcFNoZWxsT3B0aW9ucy5yb3V0ZSA9PT0gcm91dGU7XG4gICAgICBjb25zdCBzZXJ2ZXJDb250ZXh0OiBTZXJ2ZXJDb250ZXh0ID0gaXNBcHBTaGVsbFJvdXRlID8gJ2FwcC1zaGVsbCcgOiAnc3NnJztcblxuICAgICAgY29uc3QgcmVuZGVyOiBQcm9taXNlPFJlbmRlclJlc3VsdD4gPSByZW5kZXJXb3JrZXIucnVuKHsgcm91dGUsIHNlcnZlckNvbnRleHQgfSk7XG4gICAgICBjb25zdCByZW5kZXJSZXN1bHQ6IFByb21pc2U8dm9pZD4gPSByZW5kZXIudGhlbigoeyBjb250ZW50LCB3YXJuaW5ncywgZXJyb3JzIH0pID0+IHtcbiAgICAgICAgaWYgKGNvbnRlbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNvbnN0IG91dFBhdGggPSBpc0FwcFNoZWxsUm91dGUgPyAnaW5kZXguaHRtbCcgOiBwb3NpeC5qb2luKHJvdXRlLCAnaW5kZXguaHRtbCcpO1xuICAgICAgICAgIG91dHB1dFtvdXRQYXRoXSA9IGNvbnRlbnQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAod2FybmluZ3MpIHtcbiAgICAgICAgICB3YXJuaW5ncy5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlcnJvcnMpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaCguLi5lcnJvcnMpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgcmVuZGVyaW5nUHJvbWlzZXMucHVzaChyZW5kZXJSZXN1bHQpO1xuICAgIH1cblxuICAgIGF3YWl0IFByb21pc2UuYWxsKHJlbmRlcmluZ1Byb21pc2VzKTtcbiAgfSBmaW5hbGx5IHtcbiAgICB2b2lkIHJlbmRlcldvcmtlci5kZXN0cm95KCk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGVycm9ycyxcbiAgICB3YXJuaW5ncyxcbiAgICBvdXRwdXQsXG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEFsbFJvdXRlcyhcbiAgdHNDb25maWdQYXRoOiBzdHJpbmcsXG4gIGFwcFNoZWxsT3B0aW9uczogQXBwU2hlbGxPcHRpb25zLFxuICBwcmVyZW5kZXJPcHRpb25zOiBwcmVyZW5kZXJPcHRpb25zLFxuKTogUHJvbWlzZTxTZXQ8c3RyaW5nPj4ge1xuICBjb25zdCB7IHJvdXRlc0ZpbGUsIGRpc2NvdmVyUm91dGVzLCByb3V0ZXM6IGV4aXN0aW5nUm91dGVzIH0gPSBwcmVyZW5kZXJPcHRpb25zO1xuICBjb25zdCByb3V0ZXMgPSBuZXcgU2V0KGV4aXN0aW5nUm91dGVzKTtcblxuICBjb25zdCB7IHJvdXRlOiBhcHBTaGVsbFJvdXRlIH0gPSBhcHBTaGVsbE9wdGlvbnM7XG4gIGlmIChhcHBTaGVsbFJvdXRlICE9PSB1bmRlZmluZWQpIHtcbiAgICByb3V0ZXMuYWRkKGFwcFNoZWxsUm91dGUpO1xuICB9XG5cbiAgaWYgKHJvdXRlc0ZpbGUpIHtcbiAgICBjb25zdCByb3V0ZXNGcm9tRmlsZSA9IChhd2FpdCByZWFkRmlsZShyb3V0ZXNGaWxlLCAndXRmOCcpKS5zcGxpdCgvXFxyP1xcbi8pO1xuICAgIGZvciAobGV0IHJvdXRlIG9mIHJvdXRlc0Zyb21GaWxlKSB7XG4gICAgICByb3V0ZSA9IHJvdXRlLnRyaW0oKTtcbiAgICAgIGlmIChyb3V0ZSkge1xuICAgICAgICByb3V0ZXMuYWRkKHJvdXRlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoZGlzY292ZXJSb3V0ZXMpIHtcbiAgICBjb25zdCB7IHBhcnNlQW5ndWxhclJvdXRlcyB9ID0gYXdhaXQgaW1wb3J0KCdndWVzcy1wYXJzZXInKTtcbiAgICBmb3IgKGNvbnN0IHsgcGF0aCB9IG9mIHBhcnNlQW5ndWxhclJvdXRlcyh0c0NvbmZpZ1BhdGgpKSB7XG4gICAgICAvLyBFeGNsdWRlIGR5bmFtaWMgcm91dGVzIGFzIHRoZXNlIGNhbm5vdCBiZSBwcmUtcmVuZGVyZWQuXG4gICAgICBpZiAoIS9bKjpdLy50ZXN0KHBhdGgpKSB7XG4gICAgICAgIHJvdXRlcy5hZGQocGF0aCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJvdXRlcztcbn1cbiJdfQ==