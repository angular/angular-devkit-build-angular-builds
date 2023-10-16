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
function removeLeadingSlash(value) {
    return value.charAt(0) === '/' ? value.slice(1) : value;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlcmVuZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvc2VydmVyLXJlbmRlcmluZy9wcmVyZW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgsK0NBQTRDO0FBQzVDLHlDQUFpRDtBQUNqRCxzREFBOEI7QUFDOUIseUVBQTJGO0FBQzNGLHdFQUF3RTtBQWlCakUsS0FBSyxVQUFVLGNBQWMsQ0FDbEMsYUFBcUIsRUFDckIsa0JBQW1DLEVBQUUsRUFDckMsbUJBQXFDLEVBQUUsRUFDdkMsV0FBd0MsRUFDeEMsUUFBZ0IsRUFDaEIsU0FBUyxHQUFHLEtBQUssRUFDakIsaUJBQWlCLEdBQUcsS0FBSyxFQUN6QixVQUFVLEdBQUcsQ0FBQyxFQUNkLE9BQU8sR0FBRyxLQUFLO0lBTWYsTUFBTSxNQUFNLEdBQTJCLEVBQUUsQ0FBQztJQUMxQyxNQUFNLFFBQVEsR0FBYSxFQUFFLENBQUM7SUFDOUIsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO0lBQzVCLE1BQU0sb0JBQW9CLEdBQTJCLEVBQUUsQ0FBQztJQUN4RCxNQUFNLHVCQUF1QixHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO0lBRTFELEtBQUssTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksV0FBVyxFQUFFO1FBQzlDLE1BQU0sT0FBTyxHQUFHLElBQUEsbUJBQU8sRUFBQyxJQUFJLENBQUMsQ0FBQztRQUM5QixJQUFJLElBQUksS0FBSyxxQ0FBbUIsQ0FBQyxNQUFNLElBQUksT0FBTyxLQUFLLE1BQU0sRUFBRTtZQUM3RCx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FB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RCxTQUFTLGtCQUFrQixDQUFDLEtBQWE7SUFDdkMsT0FBTyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQzFELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IGV4dG5hbWUsIGpvaW4sIHBvc2l4IH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCBQaXNjaW5hIGZyb20gJ3Bpc2NpbmEnO1xuaW1wb3J0IHsgQnVpbGRPdXRwdXRGaWxlLCBCdWlsZE91dHB1dEZpbGVUeXBlIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9idW5kbGVyLWNvbnRleHQnO1xuaW1wb3J0IHsgZ2V0RVNNTG9hZGVyQXJncyB9IGZyb20gJy4vZXNtLWluLW1lbW9yeS1sb2FkZXIvbm9kZS0xOC11dGlscyc7XG5pbXBvcnQgdHlwZSB7IFJlbmRlclJlc3VsdCwgU2VydmVyQ29udGV4dCB9IGZyb20gJy4vcmVuZGVyLXBhZ2UnO1xuaW1wb3J0IHR5cGUgeyBSZW5kZXJXb3JrZXJEYXRhIH0gZnJvbSAnLi9yZW5kZXItd29ya2VyJztcbmltcG9ydCB0eXBlIHtcbiAgUm91dGVyc0V4dHJhY3RvcldvcmtlclJlc3VsdCxcbiAgUm91dGVzRXh0cmFjdG9yV29ya2VyRGF0YSxcbn0gZnJvbSAnLi9yb3V0ZXMtZXh0cmFjdG9yLXdvcmtlcic7XG5cbmludGVyZmFjZSBQcmVyZW5kZXJPcHRpb25zIHtcbiAgcm91dGVzRmlsZT86IHN0cmluZztcbiAgZGlzY292ZXJSb3V0ZXM/OiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgQXBwU2hlbGxPcHRpb25zIHtcbiAgcm91dGU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcmVyZW5kZXJQYWdlcyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBhcHBTaGVsbE9wdGlvbnM6IEFwcFNoZWxsT3B0aW9ucyA9IHt9LFxuICBwcmVyZW5kZXJPcHRpb25zOiBQcmVyZW5kZXJPcHRpb25zID0ge30sXG4gIG91dHB1dEZpbGVzOiBSZWFkb25seTxCdWlsZE91dHB1dEZpbGVbXT4sXG4gIGRvY3VtZW50OiBzdHJpbmcsXG4gIHNvdXJjZW1hcCA9IGZhbHNlLFxuICBpbmxpbmVDcml0aWNhbENzcyA9IGZhbHNlLFxuICBtYXhUaHJlYWRzID0gMSxcbiAgdmVyYm9zZSA9IGZhbHNlLFxuKTogUHJvbWlzZTx7XG4gIG91dHB1dDogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgd2FybmluZ3M6IHN0cmluZ1tdO1xuICBlcnJvcnM6IHN0cmluZ1tdO1xufT4ge1xuICBjb25zdCBvdXRwdXQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgb3V0cHV0RmlsZXNGb3JXb3JrZXI6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgY29uc3Qgc2VydmVyQnVuZGxlc1NvdXJjZU1hcHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gIGZvciAoY29uc3QgeyB0ZXh0LCBwYXRoLCB0eXBlIH0gb2Ygb3V0cHV0RmlsZXMpIHtcbiAgICBjb25zdCBmaWxlRXh0ID0gZXh0bmFtZShwYXRoKTtcbiAgICBpZiAodHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5TZXJ2ZXIgJiYgZmlsZUV4dCA9PT0gJy5tYXAnKSB7XG4gICAgICBzZXJ2ZXJCdW5kbGVzU291cmNlTWFwcy5zZXQocGF0aC5zbGljZSgwLCAtNCksIHRleHQpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICB0eXBlID09PSBCdWlsZE91dHB1dEZpbGVUeXBlLlNlcnZlciB8fCAvLyBDb250YWlucyB0aGUgc2VydmVyIHJ1bm5hYmxlIGFwcGxpY2F0aW9uIGNvZGVcbiAgICAgICh0eXBlID09PSBCdWlsZE91dHB1dEZpbGVUeXBlLkJyb3dzZXIgJiYgZmlsZUV4dCA9PT0gJy5jc3MnKSAvLyBHbG9iYWwgc3R5bGVzIGZvciBjcml0aWNhbCBDU1MgaW5saW5pbmcuXG4gICAgKSB7XG4gICAgICBvdXRwdXRGaWxlc0ZvcldvcmtlcltwYXRoXSA9IHRleHQ7XG4gICAgfVxuICB9XG5cbiAgLy8gSW5saW5lIHNvdXJjZW1hcCBpbnRvIEpTIGZpbGUuIFRoaXMgaXMgbmVlZGVkIHRvIG1ha2UgTm9kZS5qcyByZXNvbHZlIHNvdXJjZW1hcHNcbiAgLy8gd2hlbiB1c2luZyBgLS1lbmFibGUtc291cmNlLW1hcHNgIHdoZW4gdXNpbmcgaW4gbWVtb3J5IGZpbGVzLlxuICBmb3IgKGNvbnN0IFtmaWxlUGF0aCwgbWFwXSBvZiBzZXJ2ZXJCdW5kbGVzU291cmNlTWFwcykge1xuICAgIGNvbnN0IGpzQ29udGVudCA9IG91dHB1dEZpbGVzRm9yV29ya2VyW2ZpbGVQYXRoXTtcbiAgICBpZiAoanNDb250ZW50KSB7XG4gICAgICBvdXRwdXRGaWxlc0ZvcldvcmtlcltmaWxlUGF0aF0gPVxuICAgICAgICBqc0NvbnRlbnQgK1xuICAgICAgICBgXFxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YCArXG4gICAgICAgIGBkYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LCR7QnVmZmVyLmZyb20obWFwKS50b1N0cmluZygnYmFzZTY0Jyl9YDtcbiAgICB9XG4gIH1cbiAgc2VydmVyQnVuZGxlc1NvdXJjZU1hcHMuY2xlYXIoKTtcblxuICBjb25zdCB7IHJvdXRlczogYWxsUm91dGVzLCB3YXJuaW5nczogcm91dGVzV2FybmluZ3MgfSA9IGF3YWl0IGdldEFsbFJvdXRlcyhcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG91dHB1dEZpbGVzRm9yV29ya2VyLFxuICAgIGRvY3VtZW50LFxuICAgIGFwcFNoZWxsT3B0aW9ucyxcbiAgICBwcmVyZW5kZXJPcHRpb25zLFxuICAgIHNvdXJjZW1hcCxcbiAgICB2ZXJib3NlLFxuICApO1xuXG4gIGlmIChyb3V0ZXNXYXJuaW5ncz8ubGVuZ3RoKSB7XG4gICAgd2FybmluZ3MucHVzaCguLi5yb3V0ZXNXYXJuaW5ncyk7XG4gIH1cblxuICBpZiAoYWxsUm91dGVzLnNpemUgPCAxKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGVycm9ycyxcbiAgICAgIHdhcm5pbmdzLFxuICAgICAgb3V0cHV0LFxuICAgIH07XG4gIH1cblxuICBjb25zdCB3b3JrZXJFeGVjQXJndiA9IGdldEVTTUxvYWRlckFyZ3MoKTtcbiAgaWYgKHNvdXJjZW1hcCkge1xuICAgIHdvcmtlckV4ZWNBcmd2LnB1c2goJy0tZW5hYmxlLXNvdXJjZS1tYXBzJyk7XG4gIH1cblxuICBjb25zdCByZW5kZXJXb3JrZXIgPSBuZXcgUGlzY2luYSh7XG4gICAgZmlsZW5hbWU6IHJlcXVpcmUucmVzb2x2ZSgnLi9yZW5kZXItd29ya2VyJyksXG4gICAgbWF4VGhyZWFkczogTWF0aC5taW4oYWxsUm91dGVzLnNpemUsIG1heFRocmVhZHMpLFxuICAgIHdvcmtlckRhdGE6IHtcbiAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICBvdXRwdXRGaWxlczogb3V0cHV0RmlsZXNGb3JXb3JrZXIsXG4gICAgICBpbmxpbmVDcml0aWNhbENzcyxcbiAgICAgIGRvY3VtZW50LFxuICAgIH0gYXMgUmVuZGVyV29ya2VyRGF0YSxcbiAgICBleGVjQXJndjogd29ya2VyRXhlY0FyZ3YsXG4gIH0pO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVuZGVyaW5nUHJvbWlzZXM6IFByb21pc2U8dm9pZD5bXSA9IFtdO1xuICAgIGNvbnN0IGFwcFNoZWxsUm91dGUgPSBhcHBTaGVsbE9wdGlvbnMucm91dGUgJiYgcmVtb3ZlTGVhZGluZ1NsYXNoKGFwcFNoZWxsT3B0aW9ucy5yb3V0ZSk7XG5cbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIGFsbFJvdXRlcykge1xuICAgICAgY29uc3QgaXNBcHBTaGVsbFJvdXRlID0gYXBwU2hlbGxSb3V0ZSA9PT0gcm91dGU7XG4gICAgICBjb25zdCBzZXJ2ZXJDb250ZXh0OiBTZXJ2ZXJDb250ZXh0ID0gaXNBcHBTaGVsbFJvdXRlID8gJ2FwcC1zaGVsbCcgOiAnc3NnJztcblxuICAgICAgY29uc3QgcmVuZGVyOiBQcm9taXNlPFJlbmRlclJlc3VsdD4gPSByZW5kZXJXb3JrZXIucnVuKHsgcm91dGUsIHNlcnZlckNvbnRleHQgfSk7XG4gICAgICBjb25zdCByZW5kZXJSZXN1bHQ6IFByb21pc2U8dm9pZD4gPSByZW5kZXIudGhlbigoeyBjb250ZW50LCB3YXJuaW5ncywgZXJyb3JzIH0pID0+IHtcbiAgICAgICAgaWYgKGNvbnRlbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNvbnN0IG91dFBhdGggPSBpc0FwcFNoZWxsUm91dGUgPyAnaW5kZXguaHRtbCcgOiBwb3NpeC5qb2luKHJvdXRlLCAnaW5kZXguaHRtbCcpO1xuICAgICAgICAgIG91dHB1dFtvdXRQYXRoXSA9IGNvbnRlbnQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAod2FybmluZ3MpIHtcbiAgICAgICAgICB3YXJuaW5ncy5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlcnJvcnMpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaCguLi5lcnJvcnMpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgcmVuZGVyaW5nUHJvbWlzZXMucHVzaChyZW5kZXJSZXN1bHQpO1xuICAgIH1cblxuICAgIGF3YWl0IFByb21pc2UuYWxsKHJlbmRlcmluZ1Byb21pc2VzKTtcbiAgfSBmaW5hbGx5IHtcbiAgICB2b2lkIHJlbmRlcldvcmtlci5kZXN0cm95KCk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGVycm9ycyxcbiAgICB3YXJuaW5ncyxcbiAgICBvdXRwdXQsXG4gIH07XG59XG5cbmNsYXNzIFJvdXRlc1NldCBleHRlbmRzIFNldDxzdHJpbmc+IHtcbiAgb3ZlcnJpZGUgYWRkKHZhbHVlOiBzdHJpbmcpOiB0aGlzIHtcbiAgICByZXR1cm4gc3VwZXIuYWRkKHJlbW92ZUxlYWRpbmdTbGFzaCh2YWx1ZSkpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEFsbFJvdXRlcyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBvdXRwdXRGaWxlc0ZvcldvcmtlcjogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbiAgZG9jdW1lbnQ6IHN0cmluZyxcbiAgYXBwU2hlbGxPcHRpb25zOiBBcHBTaGVsbE9wdGlvbnMsXG4gIHByZXJlbmRlck9wdGlvbnM6IFByZXJlbmRlck9wdGlvbnMsXG4gIHNvdXJjZW1hcDogYm9vbGVhbixcbiAgdmVyYm9zZTogYm9vbGVhbixcbik6IFByb21pc2U8eyByb3V0ZXM6IFNldDxzdHJpbmc+OyB3YXJuaW5ncz86IHN0cmluZ1tdIH0+IHtcbiAgY29uc3QgeyByb3V0ZXNGaWxlLCBkaXNjb3ZlclJvdXRlcyB9ID0gcHJlcmVuZGVyT3B0aW9ucztcbiAgY29uc3Qgcm91dGVzID0gbmV3IFJvdXRlc1NldCgpO1xuXG4gIGNvbnN0IHsgcm91dGU6IGFwcFNoZWxsUm91dGUgfSA9IGFwcFNoZWxsT3B0aW9ucztcbiAgaWYgKGFwcFNoZWxsUm91dGUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJvdXRlcy5hZGQoYXBwU2hlbGxSb3V0ZSk7XG4gIH1cblxuICBpZiAocm91dGVzRmlsZSkge1xuICAgIGNvbnN0IHJvdXRlc0Zyb21GaWxlID0gKGF3YWl0IHJlYWRGaWxlKHJvdXRlc0ZpbGUsICd1dGY4JykpLnNwbGl0KC9cXHI/XFxuLyk7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiByb3V0ZXNGcm9tRmlsZSkge1xuICAgICAgcm91dGVzLmFkZChyb3V0ZS50cmltKCkpO1xuICAgIH1cbiAgfVxuXG4gIGlmICghZGlzY292ZXJSb3V0ZXMpIHtcbiAgICByZXR1cm4geyByb3V0ZXMgfTtcbiAgfVxuXG4gIGNvbnN0IHdvcmtlckV4ZWNBcmd2ID0gZ2V0RVNNTG9hZGVyQXJncygpO1xuICBpZiAoc291cmNlbWFwKSB7XG4gICAgd29ya2VyRXhlY0FyZ3YucHVzaCgnLS1lbmFibGUtc291cmNlLW1hcHMnKTtcbiAgfVxuXG4gIGNvbnN0IHJlbmRlcldvcmtlciA9IG5ldyBQaXNjaW5hKHtcbiAgICBmaWxlbmFtZTogcmVxdWlyZS5yZXNvbHZlKCcuL3JvdXRlcy1leHRyYWN0b3Itd29ya2VyJyksXG4gICAgbWF4VGhyZWFkczogMSxcbiAgICB3b3JrZXJEYXRhOiB7XG4gICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgb3V0cHV0RmlsZXM6IG91dHB1dEZpbGVzRm9yV29ya2VyLFxuICAgICAgZG9jdW1lbnQsXG4gICAgICB2ZXJib3NlLFxuICAgIH0gYXMgUm91dGVzRXh0cmFjdG9yV29ya2VyRGF0YSxcbiAgICBleGVjQXJndjogd29ya2VyRXhlY0FyZ3YsXG4gIH0pO1xuXG4gIGNvbnN0IHsgcm91dGVzOiBleHRyYWN0ZWRSb3V0ZXMsIHdhcm5pbmdzIH06IFJvdXRlcnNFeHRyYWN0b3JXb3JrZXJSZXN1bHQgPSBhd2FpdCByZW5kZXJXb3JrZXJcbiAgICAucnVuKHt9KVxuICAgIC5maW5hbGx5KCgpID0+IHZvaWQgcmVuZGVyV29ya2VyLmRlc3Ryb3koKSk7XG5cbiAgZm9yIChjb25zdCByb3V0ZSBvZiBleHRyYWN0ZWRSb3V0ZXMpIHtcbiAgICByb3V0ZXMuYWRkKHJvdXRlKTtcbiAgfVxuXG4gIHJldHVybiB7IHJvdXRlcywgd2FybmluZ3MgfTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlTGVhZGluZ1NsYXNoKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gdmFsdWUuY2hhckF0KDApID09PSAnLycgPyB2YWx1ZS5zbGljZSgxKSA6IHZhbHVlO1xufVxuIl19