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
        execArgv: (0, node_18_utils_1.getESMLoaderArgs)(),
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
        execArgv: (0, node_18_utils_1.getESMLoaderArgs)(),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlcmVuZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvc2VydmVyLXJlbmRlcmluZy9wcmVyZW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgsK0NBQTRDO0FBQzVDLHlDQUEyQztBQUMzQyxzREFBOEI7QUFDOUIseUVBQTJGO0FBQzNGLHdFQUF3RTtBQWlCakUsS0FBSyxVQUFVLGNBQWMsQ0FDbEMsYUFBcUIsRUFDckIsa0JBQW1DLEVBQUUsRUFDckMsbUJBQXFDLEVBQUUsRUFDdkMsV0FBd0MsRUFDeEMsUUFBZ0IsRUFDaEIsaUJBQTJCLEVBQzNCLFVBQVUsR0FBRyxDQUFDLEVBQ2QsT0FBTyxHQUFHLEtBQUs7SUFNZixNQUFNLE1BQU0sR0FBMkIsRUFBRSxDQUFDO0lBQzFDLE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztJQUM5QixNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFDNUIsTUFBTSxvQkFBb0IsR0FBMkIsRUFBRSxDQUFDO0lBRXhELEtBQUssTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksV0FBVyxFQUFFO1FBQzlDLElBQ0UsSUFBSSxLQUFLLHFDQUFtQixDQUFDLE1BQU0sSUFBSSxnREFBZ0Q7WUFDdkYsQ0FBQyxJQUFJLEtBQUsscUNBQW1CLENBQUMsT0FBTyxJQUFJLElBQUEsbUJBQU8sRUFBQyxJQUFJLENBQUMsS0FBSyxNQUFNLENBQUMsQ0FBQywyQ0FBMkM7VUFDOUc7WUFDQSxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUM7U0FDbkM7S0FDRjtJQUVELE1BQU0sRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsR0FBRyxNQUFNLFlBQVksQ0FDeEUs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LEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNuQjtJQUVELE9BQU8sRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLENBQUM7QUFDOUIsQ0FBQztBQUVELFNBQVMsa0JBQWtCLENBQUMsS0FBYTtJQUN2QyxPQUFPLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDMUQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgcG9zaXggfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IFBpc2NpbmEgZnJvbSAncGlzY2luYSc7XG5pbXBvcnQgeyBCdWlsZE91dHB1dEZpbGUsIEJ1aWxkT3V0cHV0RmlsZVR5cGUgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgeyBnZXRFU01Mb2FkZXJBcmdzIH0gZnJvbSAnLi9lc20taW4tbWVtb3J5LWxvYWRlci9ub2RlLTE4LXV0aWxzJztcbmltcG9ydCB0eXBlIHsgUmVuZGVyUmVzdWx0LCBTZXJ2ZXJDb250ZXh0IH0gZnJvbSAnLi9yZW5kZXItcGFnZSc7XG5pbXBvcnQgdHlwZSB7IFJlbmRlcldvcmtlckRhdGEgfSBmcm9tICcuL3JlbmRlci13b3JrZXInO1xuaW1wb3J0IHR5cGUge1xuICBSb3V0ZXJzRXh0cmFjdG9yV29ya2VyUmVzdWx0LFxuICBSb3V0ZXNFeHRyYWN0b3JXb3JrZXJEYXRhLFxufSBmcm9tICcuL3JvdXRlcy1leHRyYWN0b3Itd29ya2VyJztcblxuaW50ZXJmYWNlIFByZXJlbmRlck9wdGlvbnMge1xuICByb3V0ZXNGaWxlPzogc3RyaW5nO1xuICBkaXNjb3ZlclJvdXRlcz86IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBBcHBTaGVsbE9wdGlvbnMge1xuICByb3V0ZT86IHN0cmluZztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHByZXJlbmRlclBhZ2VzKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIGFwcFNoZWxsT3B0aW9uczogQXBwU2hlbGxPcHRpb25zID0ge30sXG4gIHByZXJlbmRlck9wdGlvbnM6IFByZXJlbmRlck9wdGlvbnMgPSB7fSxcbiAgb3V0cHV0RmlsZXM6IFJlYWRvbmx5PEJ1aWxkT3V0cHV0RmlsZVtdPixcbiAgZG9jdW1lbnQ6IHN0cmluZyxcbiAgaW5saW5lQ3JpdGljYWxDc3M/OiBib29sZWFuLFxuICBtYXhUaHJlYWRzID0gMSxcbiAgdmVyYm9zZSA9IGZhbHNlLFxuKTogUHJvbWlzZTx7XG4gIG91dHB1dDogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgd2FybmluZ3M6IHN0cmluZ1tdO1xuICBlcnJvcnM6IHN0cmluZ1tdO1xufT4ge1xuICBjb25zdCBvdXRwdXQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgb3V0cHV0RmlsZXNGb3JXb3JrZXI6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcblxuICBmb3IgKGNvbnN0IHsgdGV4dCwgcGF0aCwgdHlwZSB9IG9mIG91dHB1dEZpbGVzKSB7XG4gICAgaWYgKFxuICAgICAgdHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5TZXJ2ZXIgfHwgLy8gQ29udGFpbnMgdGhlIHNlcnZlciBydW5uYWJsZSBhcHBsaWNhdGlvbiBjb2RlXG4gICAgICAodHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5Ccm93c2VyICYmIGV4dG5hbWUocGF0aCkgPT09ICcuY3NzJykgLy8gR2xvYmFsIHN0eWxlcyBmb3IgY3JpdGljYWwgQ1NTIGlubGluaW5nLlxuICAgICkge1xuICAgICAgb3V0cHV0RmlsZXNGb3JXb3JrZXJbcGF0aF0gPSB0ZXh0O1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHsgcm91dGVzOiBhbGxSb3V0ZXMsIHdhcm5pbmdzOiByb3V0ZXNXYXJuaW5ncyB9ID0gYXdhaXQgZ2V0QWxsUm91dGVzKFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgb3V0cHV0RmlsZXNGb3JXb3JrZXIsXG4gICAgZG9jdW1lbnQsXG4gICAgYXBwU2hlbGxPcHRpb25zLFxuICAgIHByZXJlbmRlck9wdGlvbnMsXG4gICAgdmVyYm9zZSxcbiAgKTtcblxuICBpZiAocm91dGVzV2FybmluZ3M/Lmxlbmd0aCkge1xuICAgIHdhcm5pbmdzLnB1c2goLi4ucm91dGVzV2FybmluZ3MpO1xuICB9XG5cbiAgaWYgKGFsbFJvdXRlcy5zaXplIDwgMSkge1xuICAgIHJldHVybiB7XG4gICAgICBlcnJvcnMsXG4gICAgICB3YXJuaW5ncyxcbiAgICAgIG91dHB1dCxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgcmVuZGVyV29ya2VyID0gbmV3IFBpc2NpbmEoe1xuICAgIGZpbGVuYW1lOiByZXF1aXJlLnJlc29sdmUoJy4vcmVuZGVyLXdvcmtlcicpLFxuICAgIG1heFRocmVhZHM6IE1hdGgubWluKGFsbFJvdXRlcy5zaXplLCBtYXhUaHJlYWRzKSxcbiAgICB3b3JrZXJEYXRhOiB7XG4gICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgb3V0cHV0RmlsZXM6IG91dHB1dEZpbGVzRm9yV29ya2VyLFxuICAgICAgaW5saW5lQ3JpdGljYWxDc3MsXG4gICAgICBkb2N1bWVudCxcbiAgICB9IGFzIFJlbmRlcldvcmtlckRhdGEsXG4gICAgZXhlY0FyZ3Y6IGdldEVTTUxvYWRlckFyZ3MoKSxcbiAgfSk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZW5kZXJpbmdQcm9taXNlczogUHJvbWlzZTx2b2lkPltdID0gW107XG4gICAgY29uc3QgYXBwU2hlbGxSb3V0ZSA9IGFwcFNoZWxsT3B0aW9ucy5yb3V0ZSAmJiByZW1vdmVMZWFkaW5nU2xhc2goYXBwU2hlbGxPcHRpb25zLnJvdXRlKTtcblxuICAgIGZvciAoY29uc3Qgcm91dGUgb2YgYWxsUm91dGVzKSB7XG4gICAgICBjb25zdCBpc0FwcFNoZWxsUm91dGUgPSBhcHBTaGVsbFJvdXRlID09PSByb3V0ZTtcbiAgICAgIGNvbnN0IHNlcnZlckNvbnRleHQ6IFNlcnZlckNvbnRleHQgPSBpc0FwcFNoZWxsUm91dGUgPyAnYXBwLXNoZWxsJyA6ICdzc2cnO1xuXG4gICAgICBjb25zdCByZW5kZXI6IFByb21pc2U8UmVuZGVyUmVzdWx0PiA9IHJlbmRlcldvcmtlci5ydW4oeyByb3V0ZSwgc2VydmVyQ29udGV4dCB9KTtcbiAgICAgIGNvbnN0IHJlbmRlclJlc3VsdDogUHJvbWlzZTx2b2lkPiA9IHJlbmRlci50aGVuKCh7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSkgPT4ge1xuICAgICAgICBpZiAoY29udGVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc3Qgb3V0UGF0aCA9IGlzQXBwU2hlbGxSb3V0ZSA/ICdpbmRleC5odG1sJyA6IHBvc2l4LmpvaW4ocm91dGUsICdpbmRleC5odG1sJyk7XG4gICAgICAgICAgb3V0cHV0W291dFBhdGhdID0gY29udGVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh3YXJuaW5ncykge1xuICAgICAgICAgIHdhcm5pbmdzLnB1c2goLi4ud2FybmluZ3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVycm9ycykge1xuICAgICAgICAgIGVycm9ycy5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICByZW5kZXJpbmdQcm9taXNlcy5wdXNoKHJlbmRlclJlc3VsdCk7XG4gICAgfVxuXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwocmVuZGVyaW5nUHJvbWlzZXMpO1xuICB9IGZpbmFsbHkge1xuICAgIHZvaWQgcmVuZGVyV29ya2VyLmRlc3Ryb3koKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZXJyb3JzLFxuICAgIHdhcm5pbmdzLFxuICAgIG91dHB1dCxcbiAgfTtcbn1cblxuY2xhc3MgUm91dGVzU2V0IGV4dGVuZHMgU2V0PHN0cmluZz4ge1xuICBvdmVycmlkZSBhZGQodmFsdWU6IHN0cmluZyk6IHRoaXMge1xuICAgIHJldHVybiBzdXBlci5hZGQocmVtb3ZlTGVhZGluZ1NsYXNoKHZhbHVlKSk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0QWxsUm91dGVzKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIG91dHB1dEZpbGVzRm9yV29ya2VyOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+LFxuICBkb2N1bWVudDogc3RyaW5nLFxuICBhcHBTaGVsbE9wdGlvbnM6IEFwcFNoZWxsT3B0aW9ucyxcbiAgcHJlcmVuZGVyT3B0aW9uczogUHJlcmVuZGVyT3B0aW9ucyxcbiAgdmVyYm9zZTogYm9vbGVhbixcbik6IFByb21pc2U8eyByb3V0ZXM6IFNldDxzdHJpbmc+OyB3YXJuaW5ncz86IHN0cmluZ1tdIH0+IHtcbiAgY29uc3QgeyByb3V0ZXNGaWxlLCBkaXNjb3ZlclJvdXRlcyB9ID0gcHJlcmVuZGVyT3B0aW9ucztcbiAgY29uc3Qgcm91dGVzID0gbmV3IFJvdXRlc1NldCgpO1xuXG4gIGNvbnN0IHsgcm91dGU6IGFwcFNoZWxsUm91dGUgfSA9IGFwcFNoZWxsT3B0aW9ucztcbiAgaWYgKGFwcFNoZWxsUm91dGUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJvdXRlcy5hZGQoYXBwU2hlbGxSb3V0ZSk7XG4gIH1cblxuICBpZiAocm91dGVzRmlsZSkge1xuICAgIGNvbnN0IHJvdXRlc0Zyb21GaWxlID0gKGF3YWl0IHJlYWRGaWxlKHJvdXRlc0ZpbGUsICd1dGY4JykpLnNwbGl0KC9cXHI/XFxuLyk7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiByb3V0ZXNGcm9tRmlsZSkge1xuICAgICAgcm91dGVzLmFkZChyb3V0ZS50cmltKCkpO1xuICAgIH1cbiAgfVxuXG4gIGlmICghZGlzY292ZXJSb3V0ZXMpIHtcbiAgICByZXR1cm4geyByb3V0ZXMgfTtcbiAgfVxuXG4gIGNvbnN0IHJlbmRlcldvcmtlciA9IG5ldyBQaXNjaW5hKHtcbiAgICBmaWxlbmFtZTogcmVxdWlyZS5yZXNvbHZlKCcuL3JvdXRlcy1leHRyYWN0b3Itd29ya2VyJyksXG4gICAgbWF4VGhyZWFkczogMSxcbiAgICB3b3JrZXJEYXRhOiB7XG4gICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgb3V0cHV0RmlsZXM6IG91dHB1dEZpbGVzRm9yV29ya2VyLFxuICAgICAgZG9jdW1lbnQsXG4gICAgICB2ZXJib3NlLFxuICAgIH0gYXMgUm91dGVzRXh0cmFjdG9yV29ya2VyRGF0YSxcbiAgICBleGVjQXJndjogZ2V0RVNNTG9hZGVyQXJncygpLFxuICB9KTtcblxuICBjb25zdCB7IHJvdXRlczogZXh0cmFjdGVkUm91dGVzLCB3YXJuaW5ncyB9OiBSb3V0ZXJzRXh0cmFjdG9yV29ya2VyUmVzdWx0ID0gYXdhaXQgcmVuZGVyV29ya2VyXG4gICAgLnJ1bih7fSlcbiAgICAuZmluYWxseSgoKSA9PiB2b2lkIHJlbmRlcldvcmtlci5kZXN0cm95KCkpO1xuXG4gIGZvciAoY29uc3Qgcm91dGUgb2YgZXh0cmFjdGVkUm91dGVzKSB7XG4gICAgcm91dGVzLmFkZChyb3V0ZSk7XG4gIH1cblxuICByZXR1cm4geyByb3V0ZXMsIHdhcm5pbmdzIH07XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUxlYWRpbmdTbGFzaCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHZhbHVlLmNoYXJBdCgwKSA9PT0gJy8nID8gdmFsdWUuc2xpY2UoMSkgOiB2YWx1ZTtcbn1cbiJdfQ==