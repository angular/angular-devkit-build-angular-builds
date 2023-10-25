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
const prerender_server_1 = require("./prerender-server");
async function prerenderPages(workspaceRoot, appShellOptions = {}, prerenderOptions = {}, outputFiles, assets, document, sourcemap = false, inlineCriticalCss = false, maxThreads = 1, verbose = false) {
    const outputFilesForWorker = {};
    const serverBundlesSourceMaps = new Map();
    const warnings = [];
    const errors = [];
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
    // Start server to handle HTTP requests to assets.
    // TODO: consider starting this is a seperate process to avoid any blocks to the main thread.
    const { address: assetsServerAddress, close: closeAssetsServer } = await (0, prerender_server_1.startServer)(assets);
    try {
        // Get routes to prerender
        const { routes: allRoutes, warnings: routesWarnings } = await getAllRoutes(workspaceRoot, outputFilesForWorker, document, appShellOptions, prerenderOptions, sourcemap, verbose, assetsServerAddress);
        if (routesWarnings?.length) {
            warnings.push(...routesWarnings);
        }
        if (allRoutes.size < 1) {
            return {
                errors,
                warnings,
                output: {},
                prerenderedRoutes: allRoutes,
            };
        }
        // Render routes
        const { warnings: renderingWarnings, errors: renderingErrors, output, } = await renderPages(sourcemap, allRoutes, maxThreads, workspaceRoot, outputFilesForWorker, inlineCriticalCss, document, assetsServerAddress, appShellOptions);
        errors.push(...renderingErrors);
        warnings.push(...renderingWarnings);
        return {
            errors,
            warnings,
            output,
            prerenderedRoutes: allRoutes,
        };
    }
    finally {
        void closeAssetsServer?.();
    }
}
exports.prerenderPages = prerenderPages;
class RoutesSet extends Set {
    add(value) {
        return super.add(addLeadingSlash(value));
    }
}
async function renderPages(sourcemap, allRoutes, maxThreads, workspaceRoot, outputFilesForWorker, inlineCriticalCss, document, baseUrl, appShellOptions) {
    const output = {};
    const warnings = [];
    const errors = [];
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
            baseUrl,
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
    };
}
async function getAllRoutes(workspaceRoot, outputFilesForWorker, document, appShellOptions, prerenderOptions, sourcemap, verbose, assetsServerAddress) {
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
            url: assetsServerAddress,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlcmVuZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvc2VydmVyLXJlbmRlcmluZy9wcmVyZW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgsK0NBQTRDO0FBQzVDLHlDQUEyQztBQUMzQyxzREFBOEI7QUFDOUIseUVBQTJGO0FBRTNGLHdFQUF3RTtBQUN4RSx5REFBaUQ7QUFpQjFDLEtBQUssVUFBVSxjQUFjLENBQ2xDLGFBQXFCLEVBQ3JCLGtCQUFtQyxFQUFFLEVBQ3JDLG1CQUFxQyxFQUFFLEVBQ3ZDLFdBQXdDLEVBQ3hDLE1BQW9DLEVBQ3BDLFFBQWdCLEVBQ2hCLFNBQVMsR0FBRyxLQUFLLEVBQ2pCLGlCQUFpQixHQUFHLEtBQUssRUFDekIsVUFBVSxHQUFHLENBQUMsRUFDZCxPQUFPLEdBQUcsS0FBSztJQU9mLE1BQU0sb0JBQW9CLEdBQTJCLEVBQUUsQ0FBQztJQUN4RCxNQUFNLHVCQUF1QixHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO0lBQzFELE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztJQUM5QixNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFFNUIsS0FBSyxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxXQUFXLEVBQUU7UUFDOUMsTUFBTSxPQUFPLEdBQUcsSUFBQSxtQkFBTyxFQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlCLElBQUksSUFBSSxLQUFLLHFDQUFtQixDQUFDLE1BQU0sSUFBSSxPQUFPLEtBQUssTUFBTSxFQUFFO1lBQzdELHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3RE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LENBQUM7SUFFTCxLQUFLLE1BQU0sS0FBSyxJQUFJLGVBQWUsRUFBRTtRQUNuQyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ25CO0lBRUQsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsQ0FBQztBQUM5QixDQUFDO0FBRUQsU0FBUyxlQUFlLENBQUMsS0FBYTtJQUNwQyxPQUFPLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxLQUFLLENBQUM7QUFDdkQsQ0FBQztBQUVELFNBQVMsa0JBQWtCLENBQUMsS0FBYTtJQUN2QyxPQUFPLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDMUQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgcG9zaXggfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IFBpc2NpbmEgZnJvbSAncGlzY2luYSc7XG5pbXBvcnQgeyBCdWlsZE91dHB1dEZpbGUsIEJ1aWxkT3V0cHV0RmlsZVR5cGUgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgeyBCdWlsZE91dHB1dEFzc2V0IH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9idW5kbGVyLWV4ZWN1dGlvbi1yZXN1bHQnO1xuaW1wb3J0IHsgZ2V0RVNNTG9hZGVyQXJncyB9IGZyb20gJy4vZXNtLWluLW1lbW9yeS1sb2FkZXIvbm9kZS0xOC11dGlscyc7XG5pbXBvcnQgeyBzdGFydFNlcnZlciB9IGZyb20gJy4vcHJlcmVuZGVyLXNlcnZlcic7XG5pbXBvcnQgdHlwZSB7IFJlbmRlclJlc3VsdCwgU2VydmVyQ29udGV4dCB9IGZyb20gJy4vcmVuZGVyLXBhZ2UnO1xuaW1wb3J0IHR5cGUgeyBSZW5kZXJXb3JrZXJEYXRhIH0gZnJvbSAnLi9yZW5kZXItd29ya2VyJztcbmltcG9ydCB0eXBlIHtcbiAgUm91dGVyc0V4dHJhY3RvcldvcmtlclJlc3VsdCxcbiAgUm91dGVzRXh0cmFjdG9yV29ya2VyRGF0YSxcbn0gZnJvbSAnLi9yb3V0ZXMtZXh0cmFjdG9yLXdvcmtlcic7XG5cbmludGVyZmFjZSBQcmVyZW5kZXJPcHRpb25zIHtcbiAgcm91dGVzRmlsZT86IHN0cmluZztcbiAgZGlzY292ZXJSb3V0ZXM/OiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgQXBwU2hlbGxPcHRpb25zIHtcbiAgcm91dGU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcmVyZW5kZXJQYWdlcyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBhcHBTaGVsbE9wdGlvbnM6IEFwcFNoZWxsT3B0aW9ucyA9IHt9LFxuICBwcmVyZW5kZXJPcHRpb25zOiBQcmVyZW5kZXJPcHRpb25zID0ge30sXG4gIG91dHB1dEZpbGVzOiBSZWFkb25seTxCdWlsZE91dHB1dEZpbGVbXT4sXG4gIGFzc2V0czogUmVhZG9ubHk8QnVpbGRPdXRwdXRBc3NldFtdPixcbiAgZG9jdW1lbnQ6IHN0cmluZyxcbiAgc291cmNlbWFwID0gZmFsc2UsXG4gIGlubGluZUNyaXRpY2FsQ3NzID0gZmFsc2UsXG4gIG1heFRocmVhZHMgPSAxLFxuICB2ZXJib3NlID0gZmFsc2UsXG4pOiBQcm9taXNlPHtcbiAgb3V0cHV0OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICB3YXJuaW5nczogc3RyaW5nW107XG4gIGVycm9yczogc3RyaW5nW107XG4gIHByZXJlbmRlcmVkUm91dGVzOiBTZXQ8c3RyaW5nPjtcbn0+IHtcbiAgY29uc3Qgb3V0cHV0RmlsZXNGb3JXb3JrZXI6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgY29uc3Qgc2VydmVyQnVuZGxlc1NvdXJjZU1hcHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGZvciAoY29uc3QgeyB0ZXh0LCBwYXRoLCB0eXBlIH0gb2Ygb3V0cHV0RmlsZXMpIHtcbiAgICBjb25zdCBmaWxlRXh0ID0gZXh0bmFtZShwYXRoKTtcbiAgICBpZiAodHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5TZXJ2ZXIgJiYgZmlsZUV4dCA9PT0gJy5tYXAnKSB7XG4gICAgICBzZXJ2ZXJCdW5kbGVzU291cmNlTWFwcy5zZXQocGF0aC5zbGljZSgwLCAtNCksIHRleHQpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICB0eXBlID09PSBCdWlsZE91dHB1dEZpbGVUeXBlLlNlcnZlciB8fCAvLyBDb250YWlucyB0aGUgc2VydmVyIHJ1bm5hYmxlIGFwcGxpY2F0aW9uIGNvZGVcbiAgICAgICh0eXBlID09PSBCdWlsZE91dHB1dEZpbGVUeXBlLkJyb3dzZXIgJiYgZmlsZUV4dCA9PT0gJy5jc3MnKSAvLyBHbG9iYWwgc3R5bGVzIGZvciBjcml0aWNhbCBDU1MgaW5saW5pbmcuXG4gICAgKSB7XG4gICAgICBvdXRwdXRGaWxlc0ZvcldvcmtlcltwYXRoXSA9IHRleHQ7XG4gICAgfVxuICB9XG5cbiAgLy8gSW5saW5lIHNvdXJjZW1hcCBpbnRvIEpTIGZpbGUuIFRoaXMgaXMgbmVlZGVkIHRvIG1ha2UgTm9kZS5qcyByZXNvbHZlIHNvdXJjZW1hcHNcbiAgLy8gd2hlbiB1c2luZyBgLS1lbmFibGUtc291cmNlLW1hcHNgIHdoZW4gdXNpbmcgaW4gbWVtb3J5IGZpbGVzLlxuICBmb3IgKGNvbnN0IFtmaWxlUGF0aCwgbWFwXSBvZiBzZXJ2ZXJCdW5kbGVzU291cmNlTWFwcykge1xuICAgIGNvbnN0IGpzQ29udGVudCA9IG91dHB1dEZpbGVzRm9yV29ya2VyW2ZpbGVQYXRoXTtcbiAgICBpZiAoanNDb250ZW50KSB7XG4gICAgICBvdXRwdXRGaWxlc0ZvcldvcmtlcltmaWxlUGF0aF0gPVxuICAgICAgICBqc0NvbnRlbnQgK1xuICAgICAgICBgXFxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YCArXG4gICAgICAgIGBkYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LCR7QnVmZmVyLmZyb20obWFwKS50b1N0cmluZygnYmFzZTY0Jyl9YDtcbiAgICB9XG4gIH1cbiAgc2VydmVyQnVuZGxlc1NvdXJjZU1hcHMuY2xlYXIoKTtcblxuICAvLyBTdGFydCBzZXJ2ZXIgdG8gaGFuZGxlIEhUVFAgcmVxdWVzdHMgdG8gYXNzZXRzLlxuICAvLyBUT0RPOiBjb25zaWRlciBzdGFydGluZyB0aGlzIGlzIGEgc2VwZXJhdGUgcHJvY2VzcyB0byBhdm9pZCBhbnkgYmxvY2tzIHRvIHRoZSBtYWluIHRocmVhZC5cbiAgY29uc3QgeyBhZGRyZXNzOiBhc3NldHNTZXJ2ZXJBZGRyZXNzLCBjbG9zZTogY2xvc2VBc3NldHNTZXJ2ZXIgfSA9IGF3YWl0IHN0YXJ0U2VydmVyKGFzc2V0cyk7XG5cbiAgdHJ5IHtcbiAgICAvLyBHZXQgcm91dGVzIHRvIHByZXJlbmRlclxuICAgIGNvbnN0IHsgcm91dGVzOiBhbGxSb3V0ZXMsIHdhcm5pbmdzOiByb3V0ZXNXYXJuaW5ncyB9ID0gYXdhaXQgZ2V0QWxsUm91dGVzKFxuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgIG91dHB1dEZpbGVzRm9yV29ya2VyLFxuICAgICAgZG9jdW1lbnQsXG4gICAgICBhcHBTaGVsbE9wdGlvbnMsXG4gICAgICBwcmVyZW5kZXJPcHRpb25zLFxuICAgICAgc291cmNlbWFwLFxuICAgICAgdmVyYm9zZSxcbiAgICAgIGFzc2V0c1NlcnZlckFkZHJlc3MsXG4gICAgKTtcblxuICAgIGlmIChyb3V0ZXNXYXJuaW5ncz8ubGVuZ3RoKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKC4uLnJvdXRlc1dhcm5pbmdzKTtcbiAgICB9XG5cbiAgICBpZiAoYWxsUm91dGVzLnNpemUgPCAxKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBlcnJvcnMsXG4gICAgICAgIHdhcm5pbmdzLFxuICAgICAgICBvdXRwdXQ6IHt9LFxuICAgICAgICBwcmVyZW5kZXJlZFJvdXRlczogYWxsUm91dGVzLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBSZW5kZXIgcm91dGVzXG4gICAgY29uc3Qge1xuICAgICAgd2FybmluZ3M6IHJlbmRlcmluZ1dhcm5pbmdzLFxuICAgICAgZXJyb3JzOiByZW5kZXJpbmdFcnJvcnMsXG4gICAgICBvdXRwdXQsXG4gICAgfSA9IGF3YWl0IHJlbmRlclBhZ2VzKFxuICAgICAgc291cmNlbWFwLFxuICAgICAgYWxsUm91dGVzLFxuICAgICAgbWF4VGhyZWFkcyxcbiAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICBvdXRwdXRGaWxlc0ZvcldvcmtlcixcbiAgICAgIGlubGluZUNyaXRpY2FsQ3NzLFxuICAgICAgZG9jdW1lbnQsXG4gICAgICBhc3NldHNTZXJ2ZXJBZGRyZXNzLFxuICAgICAgYXBwU2hlbGxPcHRpb25zLFxuICAgICk7XG5cbiAgICBlcnJvcnMucHVzaCguLi5yZW5kZXJpbmdFcnJvcnMpO1xuICAgIHdhcm5pbmdzLnB1c2goLi4ucmVuZGVyaW5nV2FybmluZ3MpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGVycm9ycyxcbiAgICAgIHdhcm5pbmdzLFxuICAgICAgb3V0cHV0LFxuICAgICAgcHJlcmVuZGVyZWRSb3V0ZXM6IGFsbFJvdXRlcyxcbiAgICB9O1xuICB9IGZpbmFsbHkge1xuICAgIHZvaWQgY2xvc2VBc3NldHNTZXJ2ZXI/LigpO1xuICB9XG59XG5cbmNsYXNzIFJvdXRlc1NldCBleHRlbmRzIFNldDxzdHJpbmc+IHtcbiAgb3ZlcnJpZGUgYWRkKHZhbHVlOiBzdHJpbmcpOiB0aGlzIHtcbiAgICByZXR1cm4gc3VwZXIuYWRkKGFkZExlYWRpbmdTbGFzaCh2YWx1ZSkpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlbmRlclBhZ2VzKFxuICBzb3VyY2VtYXA6IGJvb2xlYW4sXG4gIGFsbFJvdXRlczogU2V0PHN0cmluZz4sXG4gIG1heFRocmVhZHM6IG51bWJlcixcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBvdXRwdXRGaWxlc0ZvcldvcmtlcjogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbiAgaW5saW5lQ3JpdGljYWxDc3M6IGJvb2xlYW4sXG4gIGRvY3VtZW50OiBzdHJpbmcsXG4gIGJhc2VVcmw6IHN0cmluZyxcbiAgYXBwU2hlbGxPcHRpb25zOiBBcHBTaGVsbE9wdGlvbnMsXG4pOiBQcm9taXNlPHtcbiAgb3V0cHV0OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICB3YXJuaW5nczogc3RyaW5nW107XG4gIGVycm9yczogc3RyaW5nW107XG59PiB7XG4gIGNvbnN0IG91dHB1dDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGNvbnN0IHdvcmtlckV4ZWNBcmd2ID0gZ2V0RVNNTG9hZGVyQXJncygpO1xuICBpZiAoc291cmNlbWFwKSB7XG4gICAgd29ya2VyRXhlY0FyZ3YucHVzaCgnLS1lbmFibGUtc291cmNlLW1hcHMnKTtcbiAgfVxuXG4gIGNvbnN0IHJlbmRlcldvcmtlciA9IG5ldyBQaXNjaW5hKHtcbiAgICBmaWxlbmFtZTogcmVxdWlyZS5yZXNvbHZlKCcuL3JlbmRlci13b3JrZXInKSxcbiAgICBtYXhUaHJlYWRzOiBNYXRoLm1pbihhbGxSb3V0ZXMuc2l6ZSwgbWF4VGhyZWFkcyksXG4gICAgd29ya2VyRGF0YToge1xuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgIG91dHB1dEZpbGVzOiBvdXRwdXRGaWxlc0ZvcldvcmtlcixcbiAgICAgIGlubGluZUNyaXRpY2FsQ3NzLFxuICAgICAgZG9jdW1lbnQsXG4gICAgICBiYXNlVXJsLFxuICAgIH0gYXMgUmVuZGVyV29ya2VyRGF0YSxcbiAgICBleGVjQXJndjogd29ya2VyRXhlY0FyZ3YsXG4gIH0pO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVuZGVyaW5nUHJvbWlzZXM6IFByb21pc2U8dm9pZD5bXSA9IFtdO1xuICAgIGNvbnN0IGFwcFNoZWxsUm91dGUgPSBhcHBTaGVsbE9wdGlvbnMucm91dGUgJiYgYWRkTGVhZGluZ1NsYXNoKGFwcFNoZWxsT3B0aW9ucy5yb3V0ZSk7XG5cbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIGFsbFJvdXRlcykge1xuICAgICAgY29uc3QgaXNBcHBTaGVsbFJvdXRlID0gYXBwU2hlbGxSb3V0ZSA9PT0gcm91dGU7XG4gICAgICBjb25zdCBzZXJ2ZXJDb250ZXh0OiBTZXJ2ZXJDb250ZXh0ID0gaXNBcHBTaGVsbFJvdXRlID8gJ2FwcC1zaGVsbCcgOiAnc3NnJztcbiAgICAgIGNvbnN0IHJlbmRlcjogUHJvbWlzZTxSZW5kZXJSZXN1bHQ+ID0gcmVuZGVyV29ya2VyLnJ1bih7IHJvdXRlLCBzZXJ2ZXJDb250ZXh0IH0pO1xuICAgICAgY29uc3QgcmVuZGVyUmVzdWx0OiBQcm9taXNlPHZvaWQ+ID0gcmVuZGVyLnRoZW4oKHsgY29udGVudCwgd2FybmluZ3MsIGVycm9ycyB9KSA9PiB7XG4gICAgICAgIGlmIChjb250ZW50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBjb25zdCBvdXRQYXRoID0gaXNBcHBTaGVsbFJvdXRlXG4gICAgICAgICAgICA/ICdpbmRleC5odG1sJ1xuICAgICAgICAgICAgOiBwb3NpeC5qb2luKHJlbW92ZUxlYWRpbmdTbGFzaChyb3V0ZSksICdpbmRleC5odG1sJyk7XG4gICAgICAgICAgb3V0cHV0W291dFBhdGhdID0gY29udGVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh3YXJuaW5ncykge1xuICAgICAgICAgIHdhcm5pbmdzLnB1c2goLi4ud2FybmluZ3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVycm9ycykge1xuICAgICAgICAgIGVycm9ycy5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICByZW5kZXJpbmdQcm9taXNlcy5wdXNoKHJlbmRlclJlc3VsdCk7XG4gICAgfVxuXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwocmVuZGVyaW5nUHJvbWlzZXMpO1xuICB9IGZpbmFsbHkge1xuICAgIC8vIFdvcmthcm91bmQgcGlzY2luYSBidWcgd2hlcmUgYSB3b3JrZXIgdGhyZWFkIHdpbGwgYmUgcmVjcmVhdGVkIGFmdGVyIGRlc3Ryb3kgdG8gbWVldCB0aGUgbWluaW11bS5cbiAgICByZW5kZXJXb3JrZXIub3B0aW9ucy5taW5UaHJlYWRzID0gMDtcbiAgICB2b2lkIHJlbmRlcldvcmtlci5kZXN0cm95KCk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGVycm9ycyxcbiAgICB3YXJuaW5ncyxcbiAgICBvdXRwdXQsXG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEFsbFJvdXRlcyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBvdXRwdXRGaWxlc0ZvcldvcmtlcjogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbiAgZG9jdW1lbnQ6IHN0cmluZyxcbiAgYXBwU2hlbGxPcHRpb25zOiBBcHBTaGVsbE9wdGlvbnMsXG4gIHByZXJlbmRlck9wdGlvbnM6IFByZXJlbmRlck9wdGlvbnMsXG4gIHNvdXJjZW1hcDogYm9vbGVhbixcbiAgdmVyYm9zZTogYm9vbGVhbixcbiAgYXNzZXRzU2VydmVyQWRkcmVzczogc3RyaW5nLFxuKTogUHJvbWlzZTx7IHJvdXRlczogU2V0PHN0cmluZz47IHdhcm5pbmdzPzogc3RyaW5nW10gfT4ge1xuICBjb25zdCB7IHJvdXRlc0ZpbGUsIGRpc2NvdmVyUm91dGVzIH0gPSBwcmVyZW5kZXJPcHRpb25zO1xuICBjb25zdCByb3V0ZXMgPSBuZXcgUm91dGVzU2V0KCk7XG4gIGNvbnN0IHsgcm91dGU6IGFwcFNoZWxsUm91dGUgfSA9IGFwcFNoZWxsT3B0aW9ucztcblxuICBpZiAoYXBwU2hlbGxSb3V0ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcm91dGVzLmFkZChhcHBTaGVsbFJvdXRlKTtcbiAgfVxuXG4gIGlmIChyb3V0ZXNGaWxlKSB7XG4gICAgY29uc3Qgcm91dGVzRnJvbUZpbGUgPSAoYXdhaXQgcmVhZEZpbGUocm91dGVzRmlsZSwgJ3V0ZjgnKSkuc3BsaXQoL1xccj9cXG4vKTtcbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIHJvdXRlc0Zyb21GaWxlKSB7XG4gICAgICByb3V0ZXMuYWRkKHJvdXRlLnRyaW0oKSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKCFkaXNjb3ZlclJvdXRlcykge1xuICAgIHJldHVybiB7IHJvdXRlcyB9O1xuICB9XG5cbiAgY29uc3Qgd29ya2VyRXhlY0FyZ3YgPSBnZXRFU01Mb2FkZXJBcmdzKCk7XG4gIGlmIChzb3VyY2VtYXApIHtcbiAgICB3b3JrZXJFeGVjQXJndi5wdXNoKCctLWVuYWJsZS1zb3VyY2UtbWFwcycpO1xuICB9XG5cbiAgY29uc3QgcmVuZGVyV29ya2VyID0gbmV3IFBpc2NpbmEoe1xuICAgIGZpbGVuYW1lOiByZXF1aXJlLnJlc29sdmUoJy4vcm91dGVzLWV4dHJhY3Rvci13b3JrZXInKSxcbiAgICBtYXhUaHJlYWRzOiAxLFxuICAgIHdvcmtlckRhdGE6IHtcbiAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICBvdXRwdXRGaWxlczogb3V0cHV0RmlsZXNGb3JXb3JrZXIsXG4gICAgICBkb2N1bWVudCxcbiAgICAgIHZlcmJvc2UsXG4gICAgICB1cmw6IGFzc2V0c1NlcnZlckFkZHJlc3MsXG4gICAgfSBhcyBSb3V0ZXNFeHRyYWN0b3JXb3JrZXJEYXRhLFxuICAgIGV4ZWNBcmd2OiB3b3JrZXJFeGVjQXJndixcbiAgfSk7XG5cbiAgY29uc3QgeyByb3V0ZXM6IGV4dHJhY3RlZFJvdXRlcywgd2FybmluZ3MgfTogUm91dGVyc0V4dHJhY3RvcldvcmtlclJlc3VsdCA9IGF3YWl0IHJlbmRlcldvcmtlclxuICAgIC5ydW4oe30pXG4gICAgLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgLy8gV29ya2Fyb3VuZCBwaXNjaW5hIGJ1ZyB3aGVyZSBhIHdvcmtlciB0aHJlYWQgd2lsbCBiZSByZWNyZWF0ZWQgYWZ0ZXIgZGVzdHJveSB0byBtZWV0IHRoZSBtaW5pbXVtLlxuICAgICAgcmVuZGVyV29ya2VyLm9wdGlvbnMubWluVGhyZWFkcyA9IDA7XG4gICAgICB2b2lkIHJlbmRlcldvcmtlci5kZXN0cm95KCk7XG4gICAgfSk7XG5cbiAgZm9yIChjb25zdCByb3V0ZSBvZiBleHRyYWN0ZWRSb3V0ZXMpIHtcbiAgICByb3V0ZXMuYWRkKHJvdXRlKTtcbiAgfVxuXG4gIHJldHVybiB7IHJvdXRlcywgd2FybmluZ3MgfTtcbn1cblxuZnVuY3Rpb24gYWRkTGVhZGluZ1NsYXNoKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gdmFsdWUuY2hhckF0KDApID09PSAnLycgPyB2YWx1ZSA6ICcvJyArIHZhbHVlO1xufVxuXG5mdW5jdGlvbiByZW1vdmVMZWFkaW5nU2xhc2godmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZS5jaGFyQXQoMCkgPT09ICcvJyA/IHZhbHVlLnNsaWNlKDEpIDogdmFsdWU7XG59XG4iXX0=