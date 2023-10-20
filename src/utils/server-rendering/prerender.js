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
const piscina_1 = __importDefault(require("piscina"));
const bundler_context_1 = require("../../tools/esbuild/bundler-context");
const node_18_utils_1 = require("./esm-in-memory-loader/node-18-utils");
async function prerenderPages(workspaceRoot, appShellOptions = {}, prerenderOptions = {}, outputFiles, document, sourcemap = false, inlineCriticalCss = false, maxThreads = 1, verbose = false) {
    const output = {};
    const warnings = [];
    const errors = [];
    const outputFilesForWorker = {};
    const serverBundlesSourceMaps = new Map();
    for (const { text, path, type } of outputFiles) {
        const fileExt = (0, node_path_1.extname)(path);
        if (type === bundler_context_1.BuildOutputFileType.Server && fileExt === '.map') {
            serverBundlesSourceMaps.set(path.slice(0, -4), text);
        }
        else if (type === bundler_context_1.BuildOutputFileType.Server || // Contains the server runnable application code
            (type === bundler_context_1.BuildOutputFileType.Browser && fileExt === '.css') // Global styles for critical CSS inlining.
        ) {
            outputFilesForWorker[path] = text;
        }
    }
    // Inline sourcemap into JS file. This is needed to make Node.js resolve sourcemaps
    // when using `--enable-source-maps` when using in memory files.
    for (const [filePath, map] of serverBundlesSourceMaps) {
        const jsContent = outputFilesForWorker[filePath];
        if (jsContent) {
            outputFilesForWorker[filePath] =
                jsContent +
                    `\n//# sourceMappingURL=` +
                    `data:application/json;base64,${Buffer.from(map).toString('base64')}`;
        }
    }
    serverBundlesSourceMaps.clear();
    const { routes: allRoutes, warnings: routesWarnings } = await getAllRoutes(workspaceRoot, outputFilesForWorker, document, appShellOptions, prerenderOptions, sourcemap, verbose);
    if (routesWarnings?.length) {
        warnings.push(...routesWarnings);
    }
    if (allRoutes.size < 1) {
        return {
            errors,
            warnings,
            output,
            prerenderedRoutes: allRoutes,
        };
    }
    const workerExecArgv = (0, node_18_utils_1.getESMLoaderArgs)();
    if (sourcemap) {
        workerExecArgv.push('--enable-source-maps');
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
        execArgv: workerExecArgv,
    });
    try {
        const renderingPromises = [];
        const appShellRoute = appShellOptions.route && addLeadingSlash(appShellOptions.route);
        for (const route of allRoutes) {
            const isAppShellRoute = appShellRoute === route;
            const serverContext = isAppShellRoute ? 'app-shell' : 'ssg';
            const render = renderWorker.run({ route, serverContext });
            const renderResult = render.then(({ content, warnings, errors }) => {
                if (content !== undefined) {
                    const outPath = isAppShellRoute
                        ? 'index.html'
                        : node_path_1.posix.join(removeLeadingSlash(route), 'index.html');
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
        // Workaround piscina bug where a worker thread will be recreated after destroy to meet the minimum.
        renderWorker.options.minThreads = 0;
        void renderWorker.destroy();
    }
    return {
        errors,
        warnings,
        output,
        prerenderedRoutes: allRoutes,
    };
}
exports.prerenderPages = prerenderPages;
class RoutesSet extends Set {
    add(value) {
        return super.add(addLeadingSlash(value));
    }
}
async function getAllRoutes(workspaceRoot, outputFilesForWorker, document, appShellOptions, prerenderOptions, sourcemap, verbose) {
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
    const workerExecArgv = (0, node_18_utils_1.getESMLoaderArgs)();
    if (sourcemap) {
        workerExecArgv.push('--enable-source-maps');
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
        execArgv: workerExecArgv,
    });
    const { routes: extractedRoutes, warnings } = await renderWorker
        .run({})
        .finally(() => {
        // Workaround piscina bug where a worker thread will be recreated after destroy to meet the minimum.
        renderWorker.options.minThreads = 0;
        void renderWorker.destroy();
    });
    for (const route of extractedRoutes) {
        routes.add(route);
    }
    return { routes, warnings };
}
function addLeadingSlash(value) {
    return value.charAt(0) === '/' ? value : '/' + value;
}
function removeLeadingSlash(value) {
    return value.charAt(0) === '/' ? value.slice(1) : value;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlcmVuZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvc2VydmVyLXJlbmRlcmluZy9wcmVyZW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgsK0NBQTRDO0FBQzVDLHlDQUFpRDtBQUNqRCxzREFBOEI7QUFDOUIseUVBQTJGO0FBQzNGLHdFQUF3RTtBQWlCakUsS0FBSyxVQUFVLGNBQWMsQ0FDbEMsYUFBcUIsRUFDckIsa0JBQW1DLEVBQUUsRUFDckMsbUJBQXFDLEVBQUUsRUFDdkMsV0FBd0MsRUFDeEMsUUFBZ0IsRUFDaEIsU0FBUyxHQUFHLEtBQUssRUFDakIsaUJBQWlCLEdBQUcsS0FBSyxFQUN6QixVQUFVLEdBQUcsQ0FBQyxFQUNkLE9BQU8sR0FBRyxLQUFLO0lBT2YsTUFBTSxNQUFNLEdBQTJCLEVBQUUsQ0FBQztJQUMxQyxNQUFNLFFBQVEsR0FBYSxFQUFFLENBQUM7SUFDOUIsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO0lBQzVCLE1BQU0sb0JBQW9CLEdBQTJCLEVBQUUsQ0FBQztJQUN4RCxNQUFNLHVCQUF1QixHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO0lBRTFELEtBQUssTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksV0FBVyxFQUFFO1FBQzlDLE1BQU0sT0FBTyxHQUFHLElBQUEsbUJBQU8sRUFBQyxJQUFJLENBQUMsQ0FBQztRQUM5QixJQUFJLElBQUksS0FBSyxxQ0FBbUIsQ0FBQyxNQUFNLElBQUksT0FBTyxLQUFLLE1BQU0sRUFBRTtZQUM3RCx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FB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QztRQUNwQyxLQUFLLFlBQVksQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUM5QixDQUFDLENBQUMsQ0FBQztJQUVMLEtBQUssTUFBTSxLQUFLLElBQUksZUFBZSxFQUFFO1FBQ25DLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7S0FDbkI7SUFFRCxPQUFPLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxDQUFDO0FBQzlCLENBQUM7QUFFRCxTQUFTLGVBQWUsQ0FBQyxLQUFhO0lBQ3BDLE9BQU8sS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQztBQUN2RCxDQUFDO0FBRUQsU0FBUyxrQkFBa0IsQ0FBQyxLQUFhO0lBQ3ZDLE9BQU8sS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUMxRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBleHRuYW1lLCBqb2luLCBwb3NpeCB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgUGlzY2luYSBmcm9tICdwaXNjaW5hJztcbmltcG9ydCB7IEJ1aWxkT3V0cHV0RmlsZSwgQnVpbGRPdXRwdXRGaWxlVHlwZSB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvYnVuZGxlci1jb250ZXh0JztcbmltcG9ydCB7IGdldEVTTUxvYWRlckFyZ3MgfSBmcm9tICcuL2VzbS1pbi1tZW1vcnktbG9hZGVyL25vZGUtMTgtdXRpbHMnO1xuaW1wb3J0IHR5cGUgeyBSZW5kZXJSZXN1bHQsIFNlcnZlckNvbnRleHQgfSBmcm9tICcuL3JlbmRlci1wYWdlJztcbmltcG9ydCB0eXBlIHsgUmVuZGVyV29ya2VyRGF0YSB9IGZyb20gJy4vcmVuZGVyLXdvcmtlcic7XG5pbXBvcnQgdHlwZSB7XG4gIFJvdXRlcnNFeHRyYWN0b3JXb3JrZXJSZXN1bHQsXG4gIFJvdXRlc0V4dHJhY3RvcldvcmtlckRhdGEsXG59IGZyb20gJy4vcm91dGVzLWV4dHJhY3Rvci13b3JrZXInO1xuXG5pbnRlcmZhY2UgUHJlcmVuZGVyT3B0aW9ucyB7XG4gIHJvdXRlc0ZpbGU/OiBzdHJpbmc7XG4gIGRpc2NvdmVyUm91dGVzPzogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIEFwcFNoZWxsT3B0aW9ucyB7XG4gIHJvdXRlPzogc3RyaW5nO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcHJlcmVuZGVyUGFnZXMoXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgYXBwU2hlbGxPcHRpb25zOiBBcHBTaGVsbE9wdGlvbnMgPSB7fSxcbiAgcHJlcmVuZGVyT3B0aW9uczogUHJlcmVuZGVyT3B0aW9ucyA9IHt9LFxuICBvdXRwdXRGaWxlczogUmVhZG9ubHk8QnVpbGRPdXRwdXRGaWxlW10+LFxuICBkb2N1bWVudDogc3RyaW5nLFxuICBzb3VyY2VtYXAgPSBmYWxzZSxcbiAgaW5saW5lQ3JpdGljYWxDc3MgPSBmYWxzZSxcbiAgbWF4VGhyZWFkcyA9IDEsXG4gIHZlcmJvc2UgPSBmYWxzZSxcbik6IFByb21pc2U8e1xuICBvdXRwdXQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIHdhcm5pbmdzOiBzdHJpbmdbXTtcbiAgZXJyb3JzOiBzdHJpbmdbXTtcbiAgcHJlcmVuZGVyZWRSb3V0ZXM6IFNldDxzdHJpbmc+O1xufT4ge1xuICBjb25zdCBvdXRwdXQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgb3V0cHV0RmlsZXNGb3JXb3JrZXI6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgY29uc3Qgc2VydmVyQnVuZGxlc1NvdXJjZU1hcHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gIGZvciAoY29uc3QgeyB0ZXh0LCBwYXRoLCB0eXBlIH0gb2Ygb3V0cHV0RmlsZXMpIHtcbiAgICBjb25zdCBmaWxlRXh0ID0gZXh0bmFtZShwYXRoKTtcbiAgICBpZiAodHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5TZXJ2ZXIgJiYgZmlsZUV4dCA9PT0gJy5tYXAnKSB7XG4gICAgICBzZXJ2ZXJCdW5kbGVzU291cmNlTWFwcy5zZXQocGF0aC5zbGljZSgwLCAtNCksIHRleHQpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICB0eXBlID09PSBCdWlsZE91dHB1dEZpbGVUeXBlLlNlcnZlciB8fCAvLyBDb250YWlucyB0aGUgc2VydmVyIHJ1bm5hYmxlIGFwcGxpY2F0aW9uIGNvZGVcbiAgICAgICh0eXBlID09PSBCdWlsZE91dHB1dEZpbGVUeXBlLkJyb3dzZXIgJiYgZmlsZUV4dCA9PT0gJy5jc3MnKSAvLyBHbG9iYWwgc3R5bGVzIGZvciBjcml0aWNhbCBDU1MgaW5saW5pbmcuXG4gICAgKSB7XG4gICAgICBvdXRwdXRGaWxlc0ZvcldvcmtlcltwYXRoXSA9IHRleHQ7XG4gICAgfVxuICB9XG5cbiAgLy8gSW5saW5lIHNvdXJjZW1hcCBpbnRvIEpTIGZpbGUuIFRoaXMgaXMgbmVlZGVkIHRvIG1ha2UgTm9kZS5qcyByZXNvbHZlIHNvdXJjZW1hcHNcbiAgLy8gd2hlbiB1c2luZyBgLS1lbmFibGUtc291cmNlLW1hcHNgIHdoZW4gdXNpbmcgaW4gbWVtb3J5IGZpbGVzLlxuICBmb3IgKGNvbnN0IFtmaWxlUGF0aCwgbWFwXSBvZiBzZXJ2ZXJCdW5kbGVzU291cmNlTWFwcykge1xuICAgIGNvbnN0IGpzQ29udGVudCA9IG91dHB1dEZpbGVzRm9yV29ya2VyW2ZpbGVQYXRoXTtcbiAgICBpZiAoanNDb250ZW50KSB7XG4gICAgICBvdXRwdXRGaWxlc0ZvcldvcmtlcltmaWxlUGF0aF0gPVxuICAgICAgICBqc0NvbnRlbnQgK1xuICAgICAgICBgXFxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YCArXG4gICAgICAgIGBkYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LCR7QnVmZmVyLmZyb20obWFwKS50b1N0cmluZygnYmFzZTY0Jyl9YDtcbiAgICB9XG4gIH1cbiAgc2VydmVyQnVuZGxlc1NvdXJjZU1hcHMuY2xlYXIoKTtcblxuICBjb25zdCB7IHJvdXRlczogYWxsUm91dGVzLCB3YXJuaW5nczogcm91dGVzV2FybmluZ3MgfSA9IGF3YWl0IGdldEFsbFJvdXRlcyhcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG91dHB1dEZpbGVzRm9yV29ya2VyLFxuICAgIGRvY3VtZW50LFxuICAgIGFwcFNoZWxsT3B0aW9ucyxcbiAgICBwcmVyZW5kZXJPcHRpb25zLFxuICAgIHNvdXJjZW1hcCxcbiAgICB2ZXJib3NlLFxuICApO1xuXG4gIGlmIChyb3V0ZXNXYXJuaW5ncz8ubGVuZ3RoKSB7XG4gICAgd2FybmluZ3MucHVzaCguLi5yb3V0ZXNXYXJuaW5ncyk7XG4gIH1cblxuICBpZiAoYWxsUm91dGVzLnNpemUgPCAxKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGVycm9ycyxcbiAgICAgIHdhcm5pbmdzLFxuICAgICAgb3V0cHV0LFxuICAgICAgcHJlcmVuZGVyZWRSb3V0ZXM6IGFsbFJvdXRlcyxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgd29ya2VyRXhlY0FyZ3YgPSBnZXRFU01Mb2FkZXJBcmdzKCk7XG4gIGlmIChzb3VyY2VtYXApIHtcbiAgICB3b3JrZXJFeGVjQXJndi5wdXNoKCctLWVuYWJsZS1zb3VyY2UtbWFwcycpO1xuICB9XG5cbiAgY29uc3QgcmVuZGVyV29ya2VyID0gbmV3IFBpc2NpbmEoe1xuICAgIGZpbGVuYW1lOiByZXF1aXJlLnJlc29sdmUoJy4vcmVuZGVyLXdvcmtlcicpLFxuICAgIG1heFRocmVhZHM6IE1hdGgubWluKGFsbFJvdXRlcy5zaXplLCBtYXhUaHJlYWRzKSxcbiAgICB3b3JrZXJEYXRhOiB7XG4gICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgb3V0cHV0RmlsZXM6IG91dHB1dEZpbGVzRm9yV29ya2VyLFxuICAgICAgaW5saW5lQ3JpdGljYWxDc3MsXG4gICAgICBkb2N1bWVudCxcbiAgICB9IGFzIFJlbmRlcldvcmtlckRhdGEsXG4gICAgZXhlY0FyZ3Y6IHdvcmtlckV4ZWNBcmd2LFxuICB9KTtcblxuICB0cnkge1xuICAgIGNvbnN0IHJlbmRlcmluZ1Byb21pc2VzOiBQcm9taXNlPHZvaWQ+W10gPSBbXTtcbiAgICBjb25zdCBhcHBTaGVsbFJvdXRlID0gYXBwU2hlbGxPcHRpb25zLnJvdXRlICYmIGFkZExlYWRpbmdTbGFzaChhcHBTaGVsbE9wdGlvbnMucm91dGUpO1xuXG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiBhbGxSb3V0ZXMpIHtcbiAgICAgIGNvbnN0IGlzQXBwU2hlbGxSb3V0ZSA9IGFwcFNoZWxsUm91dGUgPT09IHJvdXRlO1xuICAgICAgY29uc3Qgc2VydmVyQ29udGV4dDogU2VydmVyQ29udGV4dCA9IGlzQXBwU2hlbGxSb3V0ZSA/ICdhcHAtc2hlbGwnIDogJ3NzZyc7XG4gICAgICBjb25zdCByZW5kZXI6IFByb21pc2U8UmVuZGVyUmVzdWx0PiA9IHJlbmRlcldvcmtlci5ydW4oeyByb3V0ZSwgc2VydmVyQ29udGV4dCB9KTtcbiAgICAgIGNvbnN0IHJlbmRlclJlc3VsdDogUHJvbWlzZTx2b2lkPiA9IHJlbmRlci50aGVuKCh7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSkgPT4ge1xuICAgICAgICBpZiAoY29udGVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc3Qgb3V0UGF0aCA9IGlzQXBwU2hlbGxSb3V0ZVxuICAgICAgICAgICAgPyAnaW5kZXguaHRtbCdcbiAgICAgICAgICAgIDogcG9zaXguam9pbihyZW1vdmVMZWFkaW5nU2xhc2gocm91dGUpLCAnaW5kZXguaHRtbCcpO1xuICAgICAgICAgIG91dHB1dFtvdXRQYXRoXSA9IGNvbnRlbnQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAod2FybmluZ3MpIHtcbiAgICAgICAgICB3YXJuaW5ncy5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlcnJvcnMpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaCguLi5lcnJvcnMpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgcmVuZGVyaW5nUHJvbWlzZXMucHVzaChyZW5kZXJSZXN1bHQpO1xuICAgIH1cblxuICAgIGF3YWl0IFByb21pc2UuYWxsKHJlbmRlcmluZ1Byb21pc2VzKTtcbiAgfSBmaW5hbGx5IHtcbiAgICAvLyBXb3JrYXJvdW5kIHBpc2NpbmEgYnVnIHdoZXJlIGEgd29ya2VyIHRocmVhZCB3aWxsIGJlIHJlY3JlYXRlZCBhZnRlciBkZXN0cm95IHRvIG1lZXQgdGhlIG1pbmltdW0uXG4gICAgcmVuZGVyV29ya2VyLm9wdGlvbnMubWluVGhyZWFkcyA9IDA7XG4gICAgdm9pZCByZW5kZXJXb3JrZXIuZGVzdHJveSgpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBlcnJvcnMsXG4gICAgd2FybmluZ3MsXG4gICAgb3V0cHV0LFxuICAgIHByZXJlbmRlcmVkUm91dGVzOiBhbGxSb3V0ZXMsXG4gIH07XG59XG5cbmNsYXNzIFJvdXRlc1NldCBleHRlbmRzIFNldDxzdHJpbmc+IHtcbiAgb3ZlcnJpZGUgYWRkKHZhbHVlOiBzdHJpbmcpOiB0aGlzIHtcbiAgICByZXR1cm4gc3VwZXIuYWRkKGFkZExlYWRpbmdTbGFzaCh2YWx1ZSkpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEFsbFJvdXRlcyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBvdXRwdXRGaWxlc0ZvcldvcmtlcjogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbiAgZG9jdW1lbnQ6IHN0cmluZyxcbiAgYXBwU2hlbGxPcHRpb25zOiBBcHBTaGVsbE9wdGlvbnMsXG4gIHByZXJlbmRlck9wdGlvbnM6IFByZXJlbmRlck9wdGlvbnMsXG4gIHNvdXJjZW1hcDogYm9vbGVhbixcbiAgdmVyYm9zZTogYm9vbGVhbixcbik6IFByb21pc2U8eyByb3V0ZXM6IFNldDxzdHJpbmc+OyB3YXJuaW5ncz86IHN0cmluZ1tdIH0+IHtcbiAgY29uc3QgeyByb3V0ZXNGaWxlLCBkaXNjb3ZlclJvdXRlcyB9ID0gcHJlcmVuZGVyT3B0aW9ucztcbiAgY29uc3Qgcm91dGVzID0gbmV3IFJvdXRlc1NldCgpO1xuXG4gIGNvbnN0IHsgcm91dGU6IGFwcFNoZWxsUm91dGUgfSA9IGFwcFNoZWxsT3B0aW9ucztcbiAgaWYgKGFwcFNoZWxsUm91dGUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJvdXRlcy5hZGQoYXBwU2hlbGxSb3V0ZSk7XG4gIH1cblxuICBpZiAocm91dGVzRmlsZSkge1xuICAgIGNvbnN0IHJvdXRlc0Zyb21GaWxlID0gKGF3YWl0IHJlYWRGaWxlKHJvdXRlc0ZpbGUsICd1dGY4JykpLnNwbGl0KC9cXHI/XFxuLyk7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiByb3V0ZXNGcm9tRmlsZSkge1xuICAgICAgcm91dGVzLmFkZChyb3V0ZS50cmltKCkpO1xuICAgIH1cbiAgfVxuXG4gIGlmICghZGlzY292ZXJSb3V0ZXMpIHtcbiAgICByZXR1cm4geyByb3V0ZXMgfTtcbiAgfVxuXG4gIGNvbnN0IHdvcmtlckV4ZWNBcmd2ID0gZ2V0RVNNTG9hZGVyQXJncygpO1xuICBpZiAoc291cmNlbWFwKSB7XG4gICAgd29ya2VyRXhlY0FyZ3YucHVzaCgnLS1lbmFibGUtc291cmNlLW1hcHMnKTtcbiAgfVxuXG4gIGNvbnN0IHJlbmRlcldvcmtlciA9IG5ldyBQaXNjaW5hKHtcbiAgICBmaWxlbmFtZTogcmVxdWlyZS5yZXNvbHZlKCcuL3JvdXRlcy1leHRyYWN0b3Itd29ya2VyJyksXG4gICAgbWF4VGhyZWFkczogMSxcbiAgICB3b3JrZXJEYXRhOiB7XG4gICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgb3V0cHV0RmlsZXM6IG91dHB1dEZpbGVzRm9yV29ya2VyLFxuICAgICAgZG9jdW1lbnQsXG4gICAgICB2ZXJib3NlLFxuICAgIH0gYXMgUm91dGVzRXh0cmFjdG9yV29ya2VyRGF0YSxcbiAgICBleGVjQXJndjogd29ya2VyRXhlY0FyZ3YsXG4gIH0pO1xuXG4gIGNvbnN0IHsgcm91dGVzOiBleHRyYWN0ZWRSb3V0ZXMsIHdhcm5pbmdzIH06IFJvdXRlcnNFeHRyYWN0b3JXb3JrZXJSZXN1bHQgPSBhd2FpdCByZW5kZXJXb3JrZXJcbiAgICAucnVuKHt9KVxuICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgIC8vIFdvcmthcm91bmQgcGlzY2luYSBidWcgd2hlcmUgYSB3b3JrZXIgdGhyZWFkIHdpbGwgYmUgcmVjcmVhdGVkIGFmdGVyIGRlc3Ryb3kgdG8gbWVldCB0aGUgbWluaW11bS5cbiAgICAgIHJlbmRlcldvcmtlci5vcHRpb25zLm1pblRocmVhZHMgPSAwO1xuICAgICAgdm9pZCByZW5kZXJXb3JrZXIuZGVzdHJveSgpO1xuICAgIH0pO1xuXG4gIGZvciAoY29uc3Qgcm91dGUgb2YgZXh0cmFjdGVkUm91dGVzKSB7XG4gICAgcm91dGVzLmFkZChyb3V0ZSk7XG4gIH1cblxuICByZXR1cm4geyByb3V0ZXMsIHdhcm5pbmdzIH07XG59XG5cbmZ1bmN0aW9uIGFkZExlYWRpbmdTbGFzaCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHZhbHVlLmNoYXJBdCgwKSA9PT0gJy8nID8gdmFsdWUgOiAnLycgKyB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlTGVhZGluZ1NsYXNoKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gdmFsdWUuY2hhckF0KDApID09PSAnLycgPyB2YWx1ZS5zbGljZSgxKSA6IHZhbHVlO1xufVxuIl19