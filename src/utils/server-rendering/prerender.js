"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prerenderPages = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const piscina_1 = __importDefault(require("piscina"));
const bundler_context_1 = require("../../tools/esbuild/bundler-context");
async function prerenderPages(workspaceRoot, appShellOptions = {}, prerenderOptions = {}, outputFiles, document, inlineCriticalCss, maxThreads = 1, verbose = false) {
    const output = {};
    const warnings = [];
    const errors = [];
    const outputFilesForWorker = {};
    for (const { text, path, type } of outputFiles) {
        if (type === bundler_context_1.BuildOutputFileType.Server || // Contains the server runnable application code
            (type === bundler_context_1.BuildOutputFileType.Browser && (0, node_path_1.extname)(path) === '.css') // Global styles for critical CSS inlining.
        ) {
            outputFilesForWorker[path] = text;
        }
    }
    const { routes: allRoutes, warnings: routesWarnings } = await getAllRoutes(workspaceRoot, outputFilesForWorker, document, appShellOptions, prerenderOptions, verbose);
    if (routesWarnings?.length) {
        warnings.push(...routesWarnings);
    }
    if (allRoutes.size < 1) {
        return {
            errors,
            warnings,
            output,
        };
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
            (0, node_url_1.pathToFileURL)((0, node_path_1.join)(__dirname, 'esm-in-memory-file-loader.js')).href, // Loader cannot be an absolute path on Windows.
        ],
    });
    try {
        const renderingPromises = [];
        const appShellRoute = appShellOptions.route && removeLeadingSlash(appShellOptions.route);
        for (const route of allRoutes) {
            const isAppShellRoute = appShellRoute === route;
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
class RoutesSet extends Set {
    add(value) {
        return super.add(removeLeadingSlash(value));
    }
}
async function getAllRoutes(workspaceRoot, outputFilesForWorker, document, appShellOptions, prerenderOptions, verbose) {
    const { routesFile, discoverRoutes } = prerenderOptions;
    const routes = new RoutesSet();
    const { route: appShellRoute } = appShellOptions;
    if (appShellRoute !== undefined) {
        routes.add(appShellRoute);
    }
    if (routesFile) {
        const routesFromFile = (await (0, promises_1.readFile)(routesFile, 'utf8')).split(/\r?\n/);
        for (const route of routesFromFile) {
            routes.add(route.trim());
        }
    }
    if (!discoverRoutes) {
        return { routes };
    }
    const renderWorker = new piscina_1.default({
        filename: require.resolve('./routes-extractor-worker'),
        maxThreads: 1,
        workerData: {
            workspaceRoot,
            outputFiles: outputFilesForWorker,
            document,
            verbose,
        },
        execArgv: [
            '--no-warnings',
            '--loader',
            (0, node_url_1.pathToFileURL)((0, node_path_1.join)(__dirname, 'esm-in-memory-file-loader.js')).href, // Loader cannot be an absolute path on Windows.
        ],
    });
    const { routes: extractedRoutes, warnings } = await renderWorker
        .run({})
        .finally(() => void renderWorker.destroy());
    for (const route of extractedRoutes) {
        routes.add(route);
    }
    return { routes, warnings };
}
function removeLeadingSlash(value) {
    return value.charAt(0) === '/' ? value.slice(1) : value;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlcmVuZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvc2VydmVyLXJlbmRlcmluZy9wcmVyZW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgsK0NBQTRDO0FBQzVDLHlDQUFpRDtBQUNqRCx1Q0FBeUM7QUFDekMsc0RBQThCO0FBQzlCLHlFQUEyRjtBQWlCcEYsS0FBSyxVQUFVLGNBQWMsQ0FDbEMsYUFBcUIsRUFDckIsa0JBQW1DLEVBQUUsRUFDckMsbUJBQXFDLEVBQUUsRUFDdkMsV0FBd0MsRUFDeEMsUUFBZ0IsRUFDaEIsaUJBQTJCLEVBQzNCLFVBQVUsR0FBRyxDQUFDLEVBQ2QsT0FBTyxHQUFHLEtBQUs7SUFNZixNQUFNLE1BQU0sR0FBMkIsRUFBRSxDQUFDO0lBQzFDLE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztJQUM5QixNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFDNUIsTUFBTSxvQkFBb0IsR0FBMkIsRUFBRSxDQUFDO0lBRXhELEtBQUssTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksV0FBVyxFQUFFO1FBQzlDLElBQ0UsSUFBSSxLQUFLLHFDQUFtQixDQUFDLE1BQU0sSUFBSSxnREFBZ0Q7WUFDdkYsQ0FBQyxJQUFJLEtBQUsscUNBQW1CLENBQUMsT0FBTyxJQUFJLElBQUEsbUJBQU8sRUFBQyxJQUFJLENBQUMsS0FBSyxNQUFNLENBQUMsQ0FBQywyQ0FBMkM7VUFDOUc7WUFDQSxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUM7U0FDbkM7S0FDRjtJQUVELE1BQU0sRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsR0FBRyxNQUFNLFlBQVksQ0FDeEUs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TUFBTSxFQUFFLGVBQWUsRUFBRSxRQUFRLEVBQUUsR0FBaUMsTUFBTSxZQUFZO1NBQzNGLEdBQUcsQ0FBQyxFQUFFLENBQUM7U0FDUCxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsS0FBSyxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUU5QyxLQUFLLE1BQU0sS0FBSyxJQUFJLGVBQWUsRUFBRTtRQUNuQyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ25CO0lBRUQsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsQ0FBQztBQUM5QixDQUFDO0FBRUQsU0FBUyxrQkFBa0IsQ0FBQyxLQUFhO0lBQ3ZDLE9BQU8sS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUMxRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBleHRuYW1lLCBqb2luLCBwb3NpeCB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBwYXRoVG9GaWxlVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IFBpc2NpbmEgZnJvbSAncGlzY2luYSc7XG5pbXBvcnQgeyBCdWlsZE91dHB1dEZpbGUsIEJ1aWxkT3V0cHV0RmlsZVR5cGUgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgdHlwZSB7IFJlbmRlclJlc3VsdCwgU2VydmVyQ29udGV4dCB9IGZyb20gJy4vcmVuZGVyLXBhZ2UnO1xuaW1wb3J0IHR5cGUgeyBSZW5kZXJXb3JrZXJEYXRhIH0gZnJvbSAnLi9yZW5kZXItd29ya2VyJztcbmltcG9ydCB0eXBlIHtcbiAgUm91dGVyc0V4dHJhY3RvcldvcmtlclJlc3VsdCxcbiAgUm91dGVzRXh0cmFjdG9yV29ya2VyRGF0YSxcbn0gZnJvbSAnLi9yb3V0ZXMtZXh0cmFjdG9yLXdvcmtlcic7XG5cbmludGVyZmFjZSBQcmVyZW5kZXJPcHRpb25zIHtcbiAgcm91dGVzRmlsZT86IHN0cmluZztcbiAgZGlzY292ZXJSb3V0ZXM/OiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgQXBwU2hlbGxPcHRpb25zIHtcbiAgcm91dGU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcmVyZW5kZXJQYWdlcyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBhcHBTaGVsbE9wdGlvbnM6IEFwcFNoZWxsT3B0aW9ucyA9IHt9LFxuICBwcmVyZW5kZXJPcHRpb25zOiBQcmVyZW5kZXJPcHRpb25zID0ge30sXG4gIG91dHB1dEZpbGVzOiBSZWFkb25seTxCdWlsZE91dHB1dEZpbGVbXT4sXG4gIGRvY3VtZW50OiBzdHJpbmcsXG4gIGlubGluZUNyaXRpY2FsQ3NzPzogYm9vbGVhbixcbiAgbWF4VGhyZWFkcyA9IDEsXG4gIHZlcmJvc2UgPSBmYWxzZSxcbik6IFByb21pc2U8e1xuICBvdXRwdXQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIHdhcm5pbmdzOiBzdHJpbmdbXTtcbiAgZXJyb3JzOiBzdHJpbmdbXTtcbn0+IHtcbiAgY29uc3Qgb3V0cHV0OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IG91dHB1dEZpbGVzRm9yV29ya2VyOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG5cbiAgZm9yIChjb25zdCB7IHRleHQsIHBhdGgsIHR5cGUgfSBvZiBvdXRwdXRGaWxlcykge1xuICAgIGlmIChcbiAgICAgIHR5cGUgPT09IEJ1aWxkT3V0cHV0RmlsZVR5cGUuU2VydmVyIHx8IC8vIENvbnRhaW5zIHRoZSBzZXJ2ZXIgcnVubmFibGUgYXBwbGljYXRpb24gY29kZVxuICAgICAgKHR5cGUgPT09IEJ1aWxkT3V0cHV0RmlsZVR5cGUuQnJvd3NlciAmJiBleHRuYW1lKHBhdGgpID09PSAnLmNzcycpIC8vIEdsb2JhbCBzdHlsZXMgZm9yIGNyaXRpY2FsIENTUyBpbmxpbmluZy5cbiAgICApIHtcbiAgICAgIG91dHB1dEZpbGVzRm9yV29ya2VyW3BhdGhdID0gdGV4dDtcbiAgICB9XG4gIH1cblxuICBjb25zdCB7IHJvdXRlczogYWxsUm91dGVzLCB3YXJuaW5nczogcm91dGVzV2FybmluZ3MgfSA9IGF3YWl0IGdldEFsbFJvdXRlcyhcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG91dHB1dEZpbGVzRm9yV29ya2VyLFxuICAgIGRvY3VtZW50LFxuICAgIGFwcFNoZWxsT3B0aW9ucyxcbiAgICBwcmVyZW5kZXJPcHRpb25zLFxuICAgIHZlcmJvc2UsXG4gICk7XG5cbiAgaWYgKHJvdXRlc1dhcm5pbmdzPy5sZW5ndGgpIHtcbiAgICB3YXJuaW5ncy5wdXNoKC4uLnJvdXRlc1dhcm5pbmdzKTtcbiAgfVxuXG4gIGlmIChhbGxSb3V0ZXMuc2l6ZSA8IDEpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZXJyb3JzLFxuICAgICAgd2FybmluZ3MsXG4gICAgICBvdXRwdXQsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHJlbmRlcldvcmtlciA9IG5ldyBQaXNjaW5hKHtcbiAgICBmaWxlbmFtZTogcmVxdWlyZS5yZXNvbHZlKCcuL3JlbmRlci13b3JrZXInKSxcbiAgICBtYXhUaHJlYWRzOiBNYXRoLm1pbihhbGxSb3V0ZXMuc2l6ZSwgbWF4VGhyZWFkcyksXG4gICAgd29ya2VyRGF0YToge1xuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgIG91dHB1dEZpbGVzOiBvdXRwdXRGaWxlc0ZvcldvcmtlcixcbiAgICAgIGlubGluZUNyaXRpY2FsQ3NzLFxuICAgICAgZG9jdW1lbnQsXG4gICAgfSBhcyBSZW5kZXJXb3JrZXJEYXRhLFxuICAgIGV4ZWNBcmd2OiBbXG4gICAgICAnLS1uby13YXJuaW5ncycsIC8vIFN1cHByZXNzIGBFeHBlcmltZW50YWxXYXJuaW5nOiBDdXN0b20gRVNNIExvYWRlcnMgaXMgYW4gZXhwZXJpbWVudGFsIGZlYXR1cmUuLi5gLlxuICAgICAgJy0tbG9hZGVyJyxcbiAgICAgIHBhdGhUb0ZpbGVVUkwoam9pbihfX2Rpcm5hbWUsICdlc20taW4tbWVtb3J5LWZpbGUtbG9hZGVyLmpzJykpLmhyZWYsIC8vIExvYWRlciBjYW5ub3QgYmUgYW4gYWJzb2x1dGUgcGF0aCBvbiBXaW5kb3dzLlxuICAgIF0sXG4gIH0pO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVuZGVyaW5nUHJvbWlzZXM6IFByb21pc2U8dm9pZD5bXSA9IFtdO1xuICAgIGNvbnN0IGFwcFNoZWxsUm91dGUgPSBhcHBTaGVsbE9wdGlvbnMucm91dGUgJiYgcmVtb3ZlTGVhZGluZ1NsYXNoKGFwcFNoZWxsT3B0aW9ucy5yb3V0ZSk7XG5cbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIGFsbFJvdXRlcykge1xuICAgICAgY29uc3QgaXNBcHBTaGVsbFJvdXRlID0gYXBwU2hlbGxSb3V0ZSA9PT0gcm91dGU7XG4gICAgICBjb25zdCBzZXJ2ZXJDb250ZXh0OiBTZXJ2ZXJDb250ZXh0ID0gaXNBcHBTaGVsbFJvdXRlID8gJ2FwcC1zaGVsbCcgOiAnc3NnJztcblxuICAgICAgY29uc3QgcmVuZGVyOiBQcm9taXNlPFJlbmRlclJlc3VsdD4gPSByZW5kZXJXb3JrZXIucnVuKHsgcm91dGUsIHNlcnZlckNvbnRleHQgfSk7XG4gICAgICBjb25zdCByZW5kZXJSZXN1bHQ6IFByb21pc2U8dm9pZD4gPSByZW5kZXIudGhlbigoeyBjb250ZW50LCB3YXJuaW5ncywgZXJyb3JzIH0pID0+IHtcbiAgICAgICAgaWYgKGNvbnRlbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNvbnN0IG91dFBhdGggPSBpc0FwcFNoZWxsUm91dGUgPyAnaW5kZXguaHRtbCcgOiBwb3NpeC5qb2luKHJvdXRlLCAnaW5kZXguaHRtbCcpO1xuICAgICAgICAgIG91dHB1dFtvdXRQYXRoXSA9IGNvbnRlbnQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAod2FybmluZ3MpIHtcbiAgICAgICAgICB3YXJuaW5ncy5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlcnJvcnMpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaCguLi5lcnJvcnMpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgcmVuZGVyaW5nUHJvbWlzZXMucHVzaChyZW5kZXJSZXN1bHQpO1xuICAgIH1cblxuICAgIGF3YWl0IFByb21pc2UuYWxsKHJlbmRlcmluZ1Byb21pc2VzKTtcbiAgfSBmaW5hbGx5IHtcbiAgICB2b2lkIHJlbmRlcldvcmtlci5kZXN0cm95KCk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGVycm9ycyxcbiAgICB3YXJuaW5ncyxcbiAgICBvdXRwdXQsXG4gIH07XG59XG5cbmNsYXNzIFJvdXRlc1NldCBleHRlbmRzIFNldDxzdHJpbmc+IHtcbiAgb3ZlcnJpZGUgYWRkKHZhbHVlOiBzdHJpbmcpOiB0aGlzIHtcbiAgICByZXR1cm4gc3VwZXIuYWRkKHJlbW92ZUxlYWRpbmdTbGFzaCh2YWx1ZSkpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEFsbFJvdXRlcyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBvdXRwdXRGaWxlc0ZvcldvcmtlcjogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbiAgZG9jdW1lbnQ6IHN0cmluZyxcbiAgYXBwU2hlbGxPcHRpb25zOiBBcHBTaGVsbE9wdGlvbnMsXG4gIHByZXJlbmRlck9wdGlvbnM6IFByZXJlbmRlck9wdGlvbnMsXG4gIHZlcmJvc2U6IGJvb2xlYW4sXG4pOiBQcm9taXNlPHsgcm91dGVzOiBTZXQ8c3RyaW5nPjsgd2FybmluZ3M/OiBzdHJpbmdbXSB9PiB7XG4gIGNvbnN0IHsgcm91dGVzRmlsZSwgZGlzY292ZXJSb3V0ZXMgfSA9IHByZXJlbmRlck9wdGlvbnM7XG4gIGNvbnN0IHJvdXRlcyA9IG5ldyBSb3V0ZXNTZXQoKTtcblxuICBjb25zdCB7IHJvdXRlOiBhcHBTaGVsbFJvdXRlIH0gPSBhcHBTaGVsbE9wdGlvbnM7XG4gIGlmIChhcHBTaGVsbFJvdXRlICE9PSB1bmRlZmluZWQpIHtcbiAgICByb3V0ZXMuYWRkKGFwcFNoZWxsUm91dGUpO1xuICB9XG5cbiAgaWYgKHJvdXRlc0ZpbGUpIHtcbiAgICBjb25zdCByb3V0ZXNGcm9tRmlsZSA9IChhd2FpdCByZWFkRmlsZShyb3V0ZXNGaWxlLCAndXRmOCcpKS5zcGxpdCgvXFxyP1xcbi8pO1xuICAgIGZvciAoY29uc3Qgcm91dGUgb2Ygcm91dGVzRnJvbUZpbGUpIHtcbiAgICAgIHJvdXRlcy5hZGQocm91dGUudHJpbSgpKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWRpc2NvdmVyUm91dGVzKSB7XG4gICAgcmV0dXJuIHsgcm91dGVzIH07XG4gIH1cblxuICBjb25zdCByZW5kZXJXb3JrZXIgPSBuZXcgUGlzY2luYSh7XG4gICAgZmlsZW5hbWU6IHJlcXVpcmUucmVzb2x2ZSgnLi9yb3V0ZXMtZXh0cmFjdG9yLXdvcmtlcicpLFxuICAgIG1heFRocmVhZHM6IDEsXG4gICAgd29ya2VyRGF0YToge1xuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgIG91dHB1dEZpbGVzOiBvdXRwdXRGaWxlc0ZvcldvcmtlcixcbiAgICAgIGRvY3VtZW50LFxuICAgICAgdmVyYm9zZSxcbiAgICB9IGFzIFJvdXRlc0V4dHJhY3RvcldvcmtlckRhdGEsXG4gICAgZXhlY0FyZ3Y6IFtcbiAgICAgICctLW5vLXdhcm5pbmdzJywgLy8gU3VwcHJlc3MgYEV4cGVyaW1lbnRhbFdhcm5pbmc6IEN1c3RvbSBFU00gTG9hZGVycyBpcyBhbiBleHBlcmltZW50YWwgZmVhdHVyZS4uLmAuXG4gICAgICAnLS1sb2FkZXInLFxuICAgICAgcGF0aFRvRmlsZVVSTChqb2luKF9fZGlybmFtZSwgJ2VzbS1pbi1tZW1vcnktZmlsZS1sb2FkZXIuanMnKSkuaHJlZiwgLy8gTG9hZGVyIGNhbm5vdCBiZSBhbiBhYnNvbHV0ZSBwYXRoIG9uIFdpbmRvd3MuXG4gICAgXSxcbiAgfSk7XG5cbiAgY29uc3QgeyByb3V0ZXM6IGV4dHJhY3RlZFJvdXRlcywgd2FybmluZ3MgfTogUm91dGVyc0V4dHJhY3RvcldvcmtlclJlc3VsdCA9IGF3YWl0IHJlbmRlcldvcmtlclxuICAgIC5ydW4oe30pXG4gICAgLmZpbmFsbHkoKCkgPT4gdm9pZCByZW5kZXJXb3JrZXIuZGVzdHJveSgpKTtcblxuICBmb3IgKGNvbnN0IHJvdXRlIG9mIGV4dHJhY3RlZFJvdXRlcykge1xuICAgIHJvdXRlcy5hZGQocm91dGUpO1xuICB9XG5cbiAgcmV0dXJuIHsgcm91dGVzLCB3YXJuaW5ncyB9O1xufVxuXG5mdW5jdGlvbiByZW1vdmVMZWFkaW5nU2xhc2godmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZS5jaGFyQXQoMCkgPT09ICcvJyA/IHZhbHVlLnNsaWNlKDEpIDogdmFsdWU7XG59XG4iXX0=