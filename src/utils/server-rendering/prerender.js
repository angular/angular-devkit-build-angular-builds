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
        .finally(() => void renderWorker.destroy());
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlcmVuZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvc2VydmVyLXJlbmRlcmluZy9wcmVyZW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgsK0NBQTRDO0FBQzVDLHlDQUFpRDtBQUNqRCxzREFBOEI7QUFDOUIseUVBQTJGO0FBQzNGLHdFQUF3RTtBQWlCakUsS0FBSyxVQUFVLGNBQWMsQ0FDbEMsYUFBcUIsRUFDckIsa0JBQW1DLEVBQUUsRUFDckMsbUJBQXFDLEVBQUUsRUFDdkMsV0FBd0MsRUFDeEMsUUFBZ0IsRUFDaEIsU0FBUyxHQUFHLEtBQUssRUFDakIsaUJBQWlCLEdBQUcsS0FBSyxFQUN6QixVQUFVLEdBQUcsQ0FBQyxFQUNkLE9BQU8sR0FBRyxLQUFLO0lBT2YsTUFBTSxNQUFNLEdBQTJCLEVBQUUsQ0FBQztJQUMxQyxNQUFNLFFBQVEsR0FBYSxFQUFFLENBQUM7SUFDOUIsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO0lBQzVCLE1BQU0sb0JBQW9CLEdBQTJCLEVBQUUsQ0FBQztJQUN4RCxNQUFNLHVCQUF1QixHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO0lBRTFELEtBQUssTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksV0FBVyxFQUFFO1FBQzlDLE1BQU0sT0FBTyxHQUFHLElBQUEsbUJBQU8sRUFBQyxJQUFJLENBQUMsQ0FBQztRQUM5QixJQUFJLElBQUksS0FBSyxxQ0FBbUIsQ0FBQyxNQUFNLElBQUksT0FBTyxLQUFLLE1BQU0sRUFBRTtZQUM3RCx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FB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QztLQUNuQjtJQUVELE9BQU8sRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLENBQUM7QUFDOUIsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFDLEtBQWE7SUFDcEMsT0FBTyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDO0FBQ3ZELENBQUM7QUFFRCxTQUFTLGtCQUFrQixDQUFDLEtBQWE7SUFDdkMsT0FBTyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQzFELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IGV4dG5hbWUsIGpvaW4sIHBvc2l4IH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCBQaXNjaW5hIGZyb20gJ3Bpc2NpbmEnO1xuaW1wb3J0IHsgQnVpbGRPdXRwdXRGaWxlLCBCdWlsZE91dHB1dEZpbGVUeXBlIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9idW5kbGVyLWNvbnRleHQnO1xuaW1wb3J0IHsgZ2V0RVNNTG9hZGVyQXJncyB9IGZyb20gJy4vZXNtLWluLW1lbW9yeS1sb2FkZXIvbm9kZS0xOC11dGlscyc7XG5pbXBvcnQgdHlwZSB7IFJlbmRlclJlc3VsdCwgU2VydmVyQ29udGV4dCB9IGZyb20gJy4vcmVuZGVyLXBhZ2UnO1xuaW1wb3J0IHR5cGUgeyBSZW5kZXJXb3JrZXJEYXRhIH0gZnJvbSAnLi9yZW5kZXItd29ya2VyJztcbmltcG9ydCB0eXBlIHtcbiAgUm91dGVyc0V4dHJhY3RvcldvcmtlclJlc3VsdCxcbiAgUm91dGVzRXh0cmFjdG9yV29ya2VyRGF0YSxcbn0gZnJvbSAnLi9yb3V0ZXMtZXh0cmFjdG9yLXdvcmtlcic7XG5cbmludGVyZmFjZSBQcmVyZW5kZXJPcHRpb25zIHtcbiAgcm91dGVzRmlsZT86IHN0cmluZztcbiAgZGlzY292ZXJSb3V0ZXM/OiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgQXBwU2hlbGxPcHRpb25zIHtcbiAgcm91dGU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcmVyZW5kZXJQYWdlcyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBhcHBTaGVsbE9wdGlvbnM6IEFwcFNoZWxsT3B0aW9ucyA9IHt9LFxuICBwcmVyZW5kZXJPcHRpb25zOiBQcmVyZW5kZXJPcHRpb25zID0ge30sXG4gIG91dHB1dEZpbGVzOiBSZWFkb25seTxCdWlsZE91dHB1dEZpbGVbXT4sXG4gIGRvY3VtZW50OiBzdHJpbmcsXG4gIHNvdXJjZW1hcCA9IGZhbHNlLFxuICBpbmxpbmVDcml0aWNhbENzcyA9IGZhbHNlLFxuICBtYXhUaHJlYWRzID0gMSxcbiAgdmVyYm9zZSA9IGZhbHNlLFxuKTogUHJvbWlzZTx7XG4gIG91dHB1dDogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgd2FybmluZ3M6IHN0cmluZ1tdO1xuICBlcnJvcnM6IHN0cmluZ1tdO1xuICBwcmVyZW5kZXJlZFJvdXRlczogU2V0PHN0cmluZz47XG59PiB7XG4gIGNvbnN0IG91dHB1dDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBvdXRwdXRGaWxlc0ZvcldvcmtlcjogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICBjb25zdCBzZXJ2ZXJCdW5kbGVzU291cmNlTWFwcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cbiAgZm9yIChjb25zdCB7IHRleHQsIHBhdGgsIHR5cGUgfSBvZiBvdXRwdXRGaWxlcykge1xuICAgIGNvbnN0IGZpbGVFeHQgPSBleHRuYW1lKHBhdGgpO1xuICAgIGlmICh0eXBlID09PSBCdWlsZE91dHB1dEZpbGVUeXBlLlNlcnZlciAmJiBmaWxlRXh0ID09PSAnLm1hcCcpIHtcbiAgICAgIHNlcnZlckJ1bmRsZXNTb3VyY2VNYXBzLnNldChwYXRoLnNsaWNlKDAsIC00KSwgdGV4dCk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIHR5cGUgPT09IEJ1aWxkT3V0cHV0RmlsZVR5cGUuU2VydmVyIHx8IC8vIENvbnRhaW5zIHRoZSBzZXJ2ZXIgcnVubmFibGUgYXBwbGljYXRpb24gY29kZVxuICAgICAgKHR5cGUgPT09IEJ1aWxkT3V0cHV0RmlsZVR5cGUuQnJvd3NlciAmJiBmaWxlRXh0ID09PSAnLmNzcycpIC8vIEdsb2JhbCBzdHlsZXMgZm9yIGNyaXRpY2FsIENTUyBpbmxpbmluZy5cbiAgICApIHtcbiAgICAgIG91dHB1dEZpbGVzRm9yV29ya2VyW3BhdGhdID0gdGV4dDtcbiAgICB9XG4gIH1cblxuICAvLyBJbmxpbmUgc291cmNlbWFwIGludG8gSlMgZmlsZS4gVGhpcyBpcyBuZWVkZWQgdG8gbWFrZSBOb2RlLmpzIHJlc29sdmUgc291cmNlbWFwc1xuICAvLyB3aGVuIHVzaW5nIGAtLWVuYWJsZS1zb3VyY2UtbWFwc2Agd2hlbiB1c2luZyBpbiBtZW1vcnkgZmlsZXMuXG4gIGZvciAoY29uc3QgW2ZpbGVQYXRoLCBtYXBdIG9mIHNlcnZlckJ1bmRsZXNTb3VyY2VNYXBzKSB7XG4gICAgY29uc3QganNDb250ZW50ID0gb3V0cHV0RmlsZXNGb3JXb3JrZXJbZmlsZVBhdGhdO1xuICAgIGlmIChqc0NvbnRlbnQpIHtcbiAgICAgIG91dHB1dEZpbGVzRm9yV29ya2VyW2ZpbGVQYXRoXSA9XG4gICAgICAgIGpzQ29udGVudCArXG4gICAgICAgIGBcXG4vLyMgc291cmNlTWFwcGluZ1VSTD1gICtcbiAgICAgICAgYGRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsJHtCdWZmZXIuZnJvbShtYXApLnRvU3RyaW5nKCdiYXNlNjQnKX1gO1xuICAgIH1cbiAgfVxuICBzZXJ2ZXJCdW5kbGVzU291cmNlTWFwcy5jbGVhcigpO1xuXG4gIGNvbnN0IHsgcm91dGVzOiBhbGxSb3V0ZXMsIHdhcm5pbmdzOiByb3V0ZXNXYXJuaW5ncyB9ID0gYXdhaXQgZ2V0QWxsUm91dGVzKFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgb3V0cHV0RmlsZXNGb3JXb3JrZXIsXG4gICAgZG9jdW1lbnQsXG4gICAgYXBwU2hlbGxPcHRpb25zLFxuICAgIHByZXJlbmRlck9wdGlvbnMsXG4gICAgc291cmNlbWFwLFxuICAgIHZlcmJvc2UsXG4gICk7XG5cbiAgaWYgKHJvdXRlc1dhcm5pbmdzPy5sZW5ndGgpIHtcbiAgICB3YXJuaW5ncy5wdXNoKC4uLnJvdXRlc1dhcm5pbmdzKTtcbiAgfVxuXG4gIGlmIChhbGxSb3V0ZXMuc2l6ZSA8IDEpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZXJyb3JzLFxuICAgICAgd2FybmluZ3MsXG4gICAgICBvdXRwdXQsXG4gICAgICBwcmVyZW5kZXJlZFJvdXRlczogYWxsUm91dGVzLFxuICAgIH07XG4gIH1cblxuICBjb25zdCB3b3JrZXJFeGVjQXJndiA9IGdldEVTTUxvYWRlckFyZ3MoKTtcbiAgaWYgKHNvdXJjZW1hcCkge1xuICAgIHdvcmtlckV4ZWNBcmd2LnB1c2goJy0tZW5hYmxlLXNvdXJjZS1tYXBzJyk7XG4gIH1cblxuICBjb25zdCByZW5kZXJXb3JrZXIgPSBuZXcgUGlzY2luYSh7XG4gICAgZmlsZW5hbWU6IHJlcXVpcmUucmVzb2x2ZSgnLi9yZW5kZXItd29ya2VyJyksXG4gICAgbWF4VGhyZWFkczogTWF0aC5taW4oYWxsUm91dGVzLnNpemUsIG1heFRocmVhZHMpLFxuICAgIHdvcmtlckRhdGE6IHtcbiAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICBvdXRwdXRGaWxlczogb3V0cHV0RmlsZXNGb3JXb3JrZXIsXG4gICAgICBpbmxpbmVDcml0aWNhbENzcyxcbiAgICAgIGRvY3VtZW50LFxuICAgIH0gYXMgUmVuZGVyV29ya2VyRGF0YSxcbiAgICBleGVjQXJndjogd29ya2VyRXhlY0FyZ3YsXG4gIH0pO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVuZGVyaW5nUHJvbWlzZXM6IFByb21pc2U8dm9pZD5bXSA9IFtdO1xuICAgIGNvbnN0IGFwcFNoZWxsUm91dGUgPSBhcHBTaGVsbE9wdGlvbnMucm91dGUgJiYgYWRkTGVhZGluZ1NsYXNoKGFwcFNoZWxsT3B0aW9ucy5yb3V0ZSk7XG5cbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIGFsbFJvdXRlcykge1xuICAgICAgY29uc3QgaXNBcHBTaGVsbFJvdXRlID0gYXBwU2hlbGxSb3V0ZSA9PT0gcm91dGU7XG4gICAgICBjb25zdCBzZXJ2ZXJDb250ZXh0OiBTZXJ2ZXJDb250ZXh0ID0gaXNBcHBTaGVsbFJvdXRlID8gJ2FwcC1zaGVsbCcgOiAnc3NnJztcbiAgICAgIGNvbnN0IHJlbmRlcjogUHJvbWlzZTxSZW5kZXJSZXN1bHQ+ID0gcmVuZGVyV29ya2VyLnJ1bih7IHJvdXRlLCBzZXJ2ZXJDb250ZXh0IH0pO1xuICAgICAgY29uc3QgcmVuZGVyUmVzdWx0OiBQcm9taXNlPHZvaWQ+ID0gcmVuZGVyLnRoZW4oKHsgY29udGVudCwgd2FybmluZ3MsIGVycm9ycyB9KSA9PiB7XG4gICAgICAgIGlmIChjb250ZW50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBjb25zdCBvdXRQYXRoID0gaXNBcHBTaGVsbFJvdXRlXG4gICAgICAgICAgICA/ICdpbmRleC5odG1sJ1xuICAgICAgICAgICAgOiBwb3NpeC5qb2luKHJlbW92ZUxlYWRpbmdTbGFzaChyb3V0ZSksICdpbmRleC5odG1sJyk7XG4gICAgICAgICAgb3V0cHV0W291dFBhdGhdID0gY29udGVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh3YXJuaW5ncykge1xuICAgICAgICAgIHdhcm5pbmdzLnB1c2goLi4ud2FybmluZ3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVycm9ycykge1xuICAgICAgICAgIGVycm9ycy5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICByZW5kZXJpbmdQcm9taXNlcy5wdXNoKHJlbmRlclJlc3VsdCk7XG4gICAgfVxuXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwocmVuZGVyaW5nUHJvbWlzZXMpO1xuICB9IGZpbmFsbHkge1xuICAgIHZvaWQgcmVuZGVyV29ya2VyLmRlc3Ryb3koKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZXJyb3JzLFxuICAgIHdhcm5pbmdzLFxuICAgIG91dHB1dCxcbiAgICBwcmVyZW5kZXJlZFJvdXRlczogYWxsUm91dGVzLFxuICB9O1xufVxuXG5jbGFzcyBSb3V0ZXNTZXQgZXh0ZW5kcyBTZXQ8c3RyaW5nPiB7XG4gIG92ZXJyaWRlIGFkZCh2YWx1ZTogc3RyaW5nKTogdGhpcyB7XG4gICAgcmV0dXJuIHN1cGVyLmFkZChhZGRMZWFkaW5nU2xhc2godmFsdWUpKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRBbGxSb3V0ZXMoXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgb3V0cHV0RmlsZXNGb3JXb3JrZXI6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4gIGRvY3VtZW50OiBzdHJpbmcsXG4gIGFwcFNoZWxsT3B0aW9uczogQXBwU2hlbGxPcHRpb25zLFxuICBwcmVyZW5kZXJPcHRpb25zOiBQcmVyZW5kZXJPcHRpb25zLFxuICBzb3VyY2VtYXA6IGJvb2xlYW4sXG4gIHZlcmJvc2U6IGJvb2xlYW4sXG4pOiBQcm9taXNlPHsgcm91dGVzOiBTZXQ8c3RyaW5nPjsgd2FybmluZ3M/OiBzdHJpbmdbXSB9PiB7XG4gIGNvbnN0IHsgcm91dGVzRmlsZSwgZGlzY292ZXJSb3V0ZXMgfSA9IHByZXJlbmRlck9wdGlvbnM7XG4gIGNvbnN0IHJvdXRlcyA9IG5ldyBSb3V0ZXNTZXQoKTtcblxuICBjb25zdCB7IHJvdXRlOiBhcHBTaGVsbFJvdXRlIH0gPSBhcHBTaGVsbE9wdGlvbnM7XG4gIGlmIChhcHBTaGVsbFJvdXRlICE9PSB1bmRlZmluZWQpIHtcbiAgICByb3V0ZXMuYWRkKGFwcFNoZWxsUm91dGUpO1xuICB9XG5cbiAgaWYgKHJvdXRlc0ZpbGUpIHtcbiAgICBjb25zdCByb3V0ZXNGcm9tRmlsZSA9IChhd2FpdCByZWFkRmlsZShyb3V0ZXNGaWxlLCAndXRmOCcpKS5zcGxpdCgvXFxyP1xcbi8pO1xuICAgIGZvciAoY29uc3Qgcm91dGUgb2Ygcm91dGVzRnJvbUZpbGUpIHtcbiAgICAgIHJvdXRlcy5hZGQocm91dGUudHJpbSgpKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWRpc2NvdmVyUm91dGVzKSB7XG4gICAgcmV0dXJuIHsgcm91dGVzIH07XG4gIH1cblxuICBjb25zdCB3b3JrZXJFeGVjQXJndiA9IGdldEVTTUxvYWRlckFyZ3MoKTtcbiAgaWYgKHNvdXJjZW1hcCkge1xuICAgIHdvcmtlckV4ZWNBcmd2LnB1c2goJy0tZW5hYmxlLXNvdXJjZS1tYXBzJyk7XG4gIH1cblxuICBjb25zdCByZW5kZXJXb3JrZXIgPSBuZXcgUGlzY2luYSh7XG4gICAgZmlsZW5hbWU6IHJlcXVpcmUucmVzb2x2ZSgnLi9yb3V0ZXMtZXh0cmFjdG9yLXdvcmtlcicpLFxuICAgIG1heFRocmVhZHM6IDEsXG4gICAgd29ya2VyRGF0YToge1xuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgIG91dHB1dEZpbGVzOiBvdXRwdXRGaWxlc0ZvcldvcmtlcixcbiAgICAgIGRvY3VtZW50LFxuICAgICAgdmVyYm9zZSxcbiAgICB9IGFzIFJvdXRlc0V4dHJhY3RvcldvcmtlckRhdGEsXG4gICAgZXhlY0FyZ3Y6IHdvcmtlckV4ZWNBcmd2LFxuICB9KTtcblxuICBjb25zdCB7IHJvdXRlczogZXh0cmFjdGVkUm91dGVzLCB3YXJuaW5ncyB9OiBSb3V0ZXJzRXh0cmFjdG9yV29ya2VyUmVzdWx0ID0gYXdhaXQgcmVuZGVyV29ya2VyXG4gICAgLnJ1bih7fSlcbiAgICAuZmluYWxseSgoKSA9PiB2b2lkIHJlbmRlcldvcmtlci5kZXN0cm95KCkpO1xuXG4gIGZvciAoY29uc3Qgcm91dGUgb2YgZXh0cmFjdGVkUm91dGVzKSB7XG4gICAgcm91dGVzLmFkZChyb3V0ZSk7XG4gIH1cblxuICByZXR1cm4geyByb3V0ZXMsIHdhcm5pbmdzIH07XG59XG5cbmZ1bmN0aW9uIGFkZExlYWRpbmdTbGFzaCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHZhbHVlLmNoYXJBdCgwKSA9PT0gJy8nID8gdmFsdWUgOiAnLycgKyB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlTGVhZGluZ1NsYXNoKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gdmFsdWUuY2hhckF0KDApID09PSAnLycgPyB2YWx1ZS5zbGljZSgxKSA6IHZhbHVlO1xufVxuIl19