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
async function prerenderPages(workspaceRoot, appShellOptions = {}, prerenderOptions = {}, outputFiles, document, inlineCriticalCss, maxThreads = 1, verbose = false) {
    const output = {};
    const warnings = [];
    const errors = [];
    const outputFilesForWorker = {};
    for (const { text, path } of outputFiles) {
        switch ((0, node_path_1.extname)(path)) {
            case '.mjs': // Contains the server runnable application code.
            case '.css': // Global styles for critical CSS inlining.
                outputFilesForWorker[path] = text;
                break;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlcmVuZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvc2VydmVyLXJlbmRlcmluZy9wcmVyZW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsK0NBQTRDO0FBQzVDLHlDQUFpRDtBQUNqRCx1Q0FBeUM7QUFDekMsc0RBQThCO0FBaUJ2QixLQUFLLFVBQVUsY0FBYyxDQUNsQyxhQUFxQixFQUNyQixrQkFBbUMsRUFBRSxFQUNyQyxtQkFBcUMsRUFBRSxFQUN2QyxXQUFtQyxFQUNuQyxRQUFnQixFQUNoQixpQkFBMkIsRUFDM0IsVUFBVSxHQUFHLENBQUMsRUFDZCxPQUFPLEdBQUcsS0FBSztJQU1mLE1BQU0sTUFBTSxHQUEyQixFQUFFLENBQUM7SUFDMUMsTUFBTSxRQUFRLEdBQWEsRUFBRSxDQUFDO0lBQzlCLE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztJQUM1QixNQUFNLG9CQUFvQixHQUEyQixFQUFFLENBQUM7SUFFeEQsS0FBSyxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLFdBQVcsRUFBRTtRQUN4QyxRQUFRLElBQUEsbUJBQU8sRUFBQyxJQUFJLENBQUMsRUFBRTtZQUNyQixLQUFLLE1BQU0sQ0FBQyxDQUFDLGlEQUFpRDtZQUM5RCxLQUFLLE1BQU0sRUFBRSwyQ0FBMkM7Z0JBQ3RELG9CQUFvQixDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQztnQkFDbEMsTUFBTTtTQUNUO0tBQ0Y7SUFFRCxNQUFNLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsY0FBYyxFQUFFLEdBQUcsTUFBTSxZQUFZLENBQ3hFLGFBQWEsRUFDYixvQkFBb0IsRUFDcEIsUUFBUSxFQUNSLGVBQWUsRUFDZixnQkFBZ0IsRUFDaEIsT0FBTyxDQUNSLENBQUM7SUFFRixJQUFJLGNBQWMsRUFBRSxNQUFNLEVBQUU7UUFDMUIsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLGNBQWMsQ0FBQyxDQUFDO0tBQ2xDO0lBRUQsSUFBSSxTQUFTLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRTtRQUN0QixPQUFPO1lBQ0wsTUFBTTtZQUNOLFFBQVE7WUFDUixNQUFNO1NBQ1AsQ0FBQztLQUNIO0lBRUQsTUFBTSxZQUFZLEdBQUcsSUFBSSxpQkFBTyxDQUFDO1FBQy9CLFFBQVEsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDO1FBQzVDLFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDO1FBQ2hELFVBQVUsRUFBRTtZQUNWLGFBQWE7WUFDYixXQUFXLEVBQUUsb0JBQW9CO1lBQ2pDLGlCQUFpQjtZQUNqQixRQUFRO1NBQ1c7UUFDckIsUUFBUSxFQUFFO1lBQ1IsZUFBZTtZQUNmLFVBQVU7WUFDVixJQUFBLHdCQUFhLEVBQUMsSUFBQSxnQkFBSSxFQUFDLFNBQVMsRUFBRSw4QkFBOEIsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLGdEQUFnRDtTQUN0SDtLQUNGLENBQUMsQ0FBQztJQUVILElBQUk7UUFDRixNQUFNLGlCQUFpQixHQUFvQixFQUFFLENBQUM7UUFDOUMsTUFBTSxhQUFhLEdBQUcsZUFBZSxDQUFDLEtBQUssSUFBSSxrQkFBa0IsQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFekYsS0FBSyxNQUFNLEtBQUssSUFBSSxTQUFTLEVBQUU7WUFDN0IsTUFBTSxlQUFlLEdBQUcsYUFBYSxLQUFLLEtBQUssQ0FBQztZQUNoRCxNQUFNLGFBQWEsR0FBa0IsZUFBZSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUUzRSxNQUFNLE1BQU0sR0FBMEIsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsQ0FBQyxDQUFDO1lBQ2pGLE1BQU0sWUFBWSxHQUFrQixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUU7Z0JBQ2hGLElBQUksT0FBTyxLQUFLLFNBQVMsRUFBRTtvQkFDekIsTUFBTSxPQUFPLEdBQUcsZUFBZSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLGlCQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxZQUFZLENBQUMsQ0FBQztvQkFDakYsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLE9BQU8sQ0FBQztpQkFDM0I7Z0JBRUQsSUFBSSxRQUFRLEVBQUU7b0JBQ1osUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDO2lCQUM1QjtnQkFFRCxJQUFJLE1BQU0sRUFBRTtvQkFDVixNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7aUJBQ3hCO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7U0FDdEM7UUFFRCxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQztLQUN0QztZQUFTO1FBQ1IsS0FBSyxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7S0FDN0I7SUFFRCxPQUFPO1FBQ0wsTUFBTTtRQUNOLFFBQVE7UUFDUixNQUFNO0tBQ1AsQ0FBQztBQUNKLENBQUM7QUF0R0Qsd0NBc0dDO0FBRUQsTUFBTSxTQUFVLFNBQVEsR0FBVztJQUN4QixHQUFHLENBQUMsS0FBYTtRQUN4QixPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUM5QyxDQUFDO0NBQ0Y7QUFFRCxLQUFLLFVBQVUsWUFBWSxDQUN6QixhQUFxQixFQUNyQixvQkFBNEMsRUFDNUMsUUFBZ0IsRUFDaEIsZUFBZ0MsRUFDaEMsZ0JBQWtDLEVBQ2xDLE9BQWdCO0lBRWhCLE1BQU0sRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLEdBQUcsZ0JBQWdCLENBQUM7SUFDeEQsTUFBTSxNQUFNLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQztJQUUvQixNQUFNLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSxHQUFHLGVBQWUsQ0FBQztJQUNqRCxJQUFJLGFBQWEsS0FBSyxTQUFTLEVBQUU7UUFDL0IsTUFBTSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQztLQUMzQjtJQUVELElBQUksVUFBVSxFQUFFO1FBQ2QsTUFBTSxjQUFjLEdBQUcsQ0FBQyxNQUFNLElBQUEsbUJBQVEsRUFBQyxVQUFVLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDM0UsS0FBSyxNQUFNLEtBQUssSUFBSSxjQUFjLEVBQUU7WUFDbEMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztTQUMxQjtLQUNGO0lBRUQsSUFBSSxDQUFDLGNBQWMsRUFBRTtRQUNuQixPQUFPLEVBQUUsTUFBTSxFQUFFLENBQUM7S0FDbkI7SUFFRCxNQUFNLFlBQVksR0FBRyxJQUFJLGlCQUFPLENBQUM7UUFDL0IsUUFBUSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsMkJBQTJCLENBQUM7UUFDdEQsVUFBVSxFQUFFLENBQUM7UUFDYixVQUFVLEVBQUU7WUFDVixhQUFhO1lBQ2IsV0FBVyxFQUFFLG9CQUFvQjtZQUNqQyxRQUFRO1lBQ1IsT0FBTztTQUNxQjtRQUM5QixRQUFRLEVBQUU7WUFDUixlQUFlO1lBQ2YsVUFBVTtZQUNWLElBQUEsd0JBQWEsRUFBQyxJQUFBLGdCQUFJLEVBQUMsU0FBUyxFQUFFLDhCQUE4QixDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsZ0RBQWdEO1NBQ3RIO0tBQ0YsQ0FBQyxDQUFDO0lBRUgsTUFBTSxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsUUFBUSxFQUFFLEdBQWlDLE1BQU0sWUFBWTtTQUMzRixHQUFHLENBQUMsRUFBRSxDQUFDO1NBQ1AsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLEtBQUssWUFBWSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFFOUMsS0FBSyxNQUFNLEtBQUssSUFBSSxlQUFlLEVBQUU7UUFDbkMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNuQjtJQUVELE9BQU8sRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLENBQUM7QUFDOUIsQ0FBQztBQUVELFNBQVMsa0JBQWtCLENBQUMsS0FBYTtJQUN2QyxPQUFPLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDMUQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBPdXRwdXRGaWxlIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgam9pbiwgcG9zaXggfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCBQaXNjaW5hIGZyb20gJ3Bpc2NpbmEnO1xuaW1wb3J0IHR5cGUgeyBSZW5kZXJSZXN1bHQsIFNlcnZlckNvbnRleHQgfSBmcm9tICcuL3JlbmRlci1wYWdlJztcbmltcG9ydCB0eXBlIHsgUmVuZGVyV29ya2VyRGF0YSB9IGZyb20gJy4vcmVuZGVyLXdvcmtlcic7XG5pbXBvcnQgdHlwZSB7XG4gIFJvdXRlcnNFeHRyYWN0b3JXb3JrZXJSZXN1bHQsXG4gIFJvdXRlc0V4dHJhY3RvcldvcmtlckRhdGEsXG59IGZyb20gJy4vcm91dGVzLWV4dHJhY3Rvci13b3JrZXInO1xuXG5pbnRlcmZhY2UgUHJlcmVuZGVyT3B0aW9ucyB7XG4gIHJvdXRlc0ZpbGU/OiBzdHJpbmc7XG4gIGRpc2NvdmVyUm91dGVzPzogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIEFwcFNoZWxsT3B0aW9ucyB7XG4gIHJvdXRlPzogc3RyaW5nO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcHJlcmVuZGVyUGFnZXMoXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgYXBwU2hlbGxPcHRpb25zOiBBcHBTaGVsbE9wdGlvbnMgPSB7fSxcbiAgcHJlcmVuZGVyT3B0aW9uczogUHJlcmVuZGVyT3B0aW9ucyA9IHt9LFxuICBvdXRwdXRGaWxlczogUmVhZG9ubHk8T3V0cHV0RmlsZVtdPixcbiAgZG9jdW1lbnQ6IHN0cmluZyxcbiAgaW5saW5lQ3JpdGljYWxDc3M/OiBib29sZWFuLFxuICBtYXhUaHJlYWRzID0gMSxcbiAgdmVyYm9zZSA9IGZhbHNlLFxuKTogUHJvbWlzZTx7XG4gIG91dHB1dDogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgd2FybmluZ3M6IHN0cmluZ1tdO1xuICBlcnJvcnM6IHN0cmluZ1tdO1xufT4ge1xuICBjb25zdCBvdXRwdXQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3Qgb3V0cHV0RmlsZXNGb3JXb3JrZXI6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcblxuICBmb3IgKGNvbnN0IHsgdGV4dCwgcGF0aCB9IG9mIG91dHB1dEZpbGVzKSB7XG4gICAgc3dpdGNoIChleHRuYW1lKHBhdGgpKSB7XG4gICAgICBjYXNlICcubWpzJzogLy8gQ29udGFpbnMgdGhlIHNlcnZlciBydW5uYWJsZSBhcHBsaWNhdGlvbiBjb2RlLlxuICAgICAgY2FzZSAnLmNzcyc6IC8vIEdsb2JhbCBzdHlsZXMgZm9yIGNyaXRpY2FsIENTUyBpbmxpbmluZy5cbiAgICAgICAgb3V0cHV0RmlsZXNGb3JXb3JrZXJbcGF0aF0gPSB0ZXh0O1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBjb25zdCB7IHJvdXRlczogYWxsUm91dGVzLCB3YXJuaW5nczogcm91dGVzV2FybmluZ3MgfSA9IGF3YWl0IGdldEFsbFJvdXRlcyhcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG91dHB1dEZpbGVzRm9yV29ya2VyLFxuICAgIGRvY3VtZW50LFxuICAgIGFwcFNoZWxsT3B0aW9ucyxcbiAgICBwcmVyZW5kZXJPcHRpb25zLFxuICAgIHZlcmJvc2UsXG4gICk7XG5cbiAgaWYgKHJvdXRlc1dhcm5pbmdzPy5sZW5ndGgpIHtcbiAgICB3YXJuaW5ncy5wdXNoKC4uLnJvdXRlc1dhcm5pbmdzKTtcbiAgfVxuXG4gIGlmIChhbGxSb3V0ZXMuc2l6ZSA8IDEpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZXJyb3JzLFxuICAgICAgd2FybmluZ3MsXG4gICAgICBvdXRwdXQsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHJlbmRlcldvcmtlciA9IG5ldyBQaXNjaW5hKHtcbiAgICBmaWxlbmFtZTogcmVxdWlyZS5yZXNvbHZlKCcuL3JlbmRlci13b3JrZXInKSxcbiAgICBtYXhUaHJlYWRzOiBNYXRoLm1pbihhbGxSb3V0ZXMuc2l6ZSwgbWF4VGhyZWFkcyksXG4gICAgd29ya2VyRGF0YToge1xuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgIG91dHB1dEZpbGVzOiBvdXRwdXRGaWxlc0ZvcldvcmtlcixcbiAgICAgIGlubGluZUNyaXRpY2FsQ3NzLFxuICAgICAgZG9jdW1lbnQsXG4gICAgfSBhcyBSZW5kZXJXb3JrZXJEYXRhLFxuICAgIGV4ZWNBcmd2OiBbXG4gICAgICAnLS1uby13YXJuaW5ncycsIC8vIFN1cHByZXNzIGBFeHBlcmltZW50YWxXYXJuaW5nOiBDdXN0b20gRVNNIExvYWRlcnMgaXMgYW4gZXhwZXJpbWVudGFsIGZlYXR1cmUuLi5gLlxuICAgICAgJy0tbG9hZGVyJyxcbiAgICAgIHBhdGhUb0ZpbGVVUkwoam9pbihfX2Rpcm5hbWUsICdlc20taW4tbWVtb3J5LWZpbGUtbG9hZGVyLmpzJykpLmhyZWYsIC8vIExvYWRlciBjYW5ub3QgYmUgYW4gYWJzb2x1dGUgcGF0aCBvbiBXaW5kb3dzLlxuICAgIF0sXG4gIH0pO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVuZGVyaW5nUHJvbWlzZXM6IFByb21pc2U8dm9pZD5bXSA9IFtdO1xuICAgIGNvbnN0IGFwcFNoZWxsUm91dGUgPSBhcHBTaGVsbE9wdGlvbnMucm91dGUgJiYgcmVtb3ZlTGVhZGluZ1NsYXNoKGFwcFNoZWxsT3B0aW9ucy5yb3V0ZSk7XG5cbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIGFsbFJvdXRlcykge1xuICAgICAgY29uc3QgaXNBcHBTaGVsbFJvdXRlID0gYXBwU2hlbGxSb3V0ZSA9PT0gcm91dGU7XG4gICAgICBjb25zdCBzZXJ2ZXJDb250ZXh0OiBTZXJ2ZXJDb250ZXh0ID0gaXNBcHBTaGVsbFJvdXRlID8gJ2FwcC1zaGVsbCcgOiAnc3NnJztcblxuICAgICAgY29uc3QgcmVuZGVyOiBQcm9taXNlPFJlbmRlclJlc3VsdD4gPSByZW5kZXJXb3JrZXIucnVuKHsgcm91dGUsIHNlcnZlckNvbnRleHQgfSk7XG4gICAgICBjb25zdCByZW5kZXJSZXN1bHQ6IFByb21pc2U8dm9pZD4gPSByZW5kZXIudGhlbigoeyBjb250ZW50LCB3YXJuaW5ncywgZXJyb3JzIH0pID0+IHtcbiAgICAgICAgaWYgKGNvbnRlbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNvbnN0IG91dFBhdGggPSBpc0FwcFNoZWxsUm91dGUgPyAnaW5kZXguaHRtbCcgOiBwb3NpeC5qb2luKHJvdXRlLCAnaW5kZXguaHRtbCcpO1xuICAgICAgICAgIG91dHB1dFtvdXRQYXRoXSA9IGNvbnRlbnQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAod2FybmluZ3MpIHtcbiAgICAgICAgICB3YXJuaW5ncy5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlcnJvcnMpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaCguLi5lcnJvcnMpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgcmVuZGVyaW5nUHJvbWlzZXMucHVzaChyZW5kZXJSZXN1bHQpO1xuICAgIH1cblxuICAgIGF3YWl0IFByb21pc2UuYWxsKHJlbmRlcmluZ1Byb21pc2VzKTtcbiAgfSBmaW5hbGx5IHtcbiAgICB2b2lkIHJlbmRlcldvcmtlci5kZXN0cm95KCk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGVycm9ycyxcbiAgICB3YXJuaW5ncyxcbiAgICBvdXRwdXQsXG4gIH07XG59XG5cbmNsYXNzIFJvdXRlc1NldCBleHRlbmRzIFNldDxzdHJpbmc+IHtcbiAgb3ZlcnJpZGUgYWRkKHZhbHVlOiBzdHJpbmcpOiB0aGlzIHtcbiAgICByZXR1cm4gc3VwZXIuYWRkKHJlbW92ZUxlYWRpbmdTbGFzaCh2YWx1ZSkpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEFsbFJvdXRlcyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBvdXRwdXRGaWxlc0ZvcldvcmtlcjogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbiAgZG9jdW1lbnQ6IHN0cmluZyxcbiAgYXBwU2hlbGxPcHRpb25zOiBBcHBTaGVsbE9wdGlvbnMsXG4gIHByZXJlbmRlck9wdGlvbnM6IFByZXJlbmRlck9wdGlvbnMsXG4gIHZlcmJvc2U6IGJvb2xlYW4sXG4pOiBQcm9taXNlPHsgcm91dGVzOiBTZXQ8c3RyaW5nPjsgd2FybmluZ3M/OiBzdHJpbmdbXSB9PiB7XG4gIGNvbnN0IHsgcm91dGVzRmlsZSwgZGlzY292ZXJSb3V0ZXMgfSA9IHByZXJlbmRlck9wdGlvbnM7XG4gIGNvbnN0IHJvdXRlcyA9IG5ldyBSb3V0ZXNTZXQoKTtcblxuICBjb25zdCB7IHJvdXRlOiBhcHBTaGVsbFJvdXRlIH0gPSBhcHBTaGVsbE9wdGlvbnM7XG4gIGlmIChhcHBTaGVsbFJvdXRlICE9PSB1bmRlZmluZWQpIHtcbiAgICByb3V0ZXMuYWRkKGFwcFNoZWxsUm91dGUpO1xuICB9XG5cbiAgaWYgKHJvdXRlc0ZpbGUpIHtcbiAgICBjb25zdCByb3V0ZXNGcm9tRmlsZSA9IChhd2FpdCByZWFkRmlsZShyb3V0ZXNGaWxlLCAndXRmOCcpKS5zcGxpdCgvXFxyP1xcbi8pO1xuICAgIGZvciAoY29uc3Qgcm91dGUgb2Ygcm91dGVzRnJvbUZpbGUpIHtcbiAgICAgIHJvdXRlcy5hZGQocm91dGUudHJpbSgpKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWRpc2NvdmVyUm91dGVzKSB7XG4gICAgcmV0dXJuIHsgcm91dGVzIH07XG4gIH1cblxuICBjb25zdCByZW5kZXJXb3JrZXIgPSBuZXcgUGlzY2luYSh7XG4gICAgZmlsZW5hbWU6IHJlcXVpcmUucmVzb2x2ZSgnLi9yb3V0ZXMtZXh0cmFjdG9yLXdvcmtlcicpLFxuICAgIG1heFRocmVhZHM6IDEsXG4gICAgd29ya2VyRGF0YToge1xuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgIG91dHB1dEZpbGVzOiBvdXRwdXRGaWxlc0ZvcldvcmtlcixcbiAgICAgIGRvY3VtZW50LFxuICAgICAgdmVyYm9zZSxcbiAgICB9IGFzIFJvdXRlc0V4dHJhY3RvcldvcmtlckRhdGEsXG4gICAgZXhlY0FyZ3Y6IFtcbiAgICAgICctLW5vLXdhcm5pbmdzJywgLy8gU3VwcHJlc3MgYEV4cGVyaW1lbnRhbFdhcm5pbmc6IEN1c3RvbSBFU00gTG9hZGVycyBpcyBhbiBleHBlcmltZW50YWwgZmVhdHVyZS4uLmAuXG4gICAgICAnLS1sb2FkZXInLFxuICAgICAgcGF0aFRvRmlsZVVSTChqb2luKF9fZGlybmFtZSwgJ2VzbS1pbi1tZW1vcnktZmlsZS1sb2FkZXIuanMnKSkuaHJlZiwgLy8gTG9hZGVyIGNhbm5vdCBiZSBhbiBhYnNvbHV0ZSBwYXRoIG9uIFdpbmRvd3MuXG4gICAgXSxcbiAgfSk7XG5cbiAgY29uc3QgeyByb3V0ZXM6IGV4dHJhY3RlZFJvdXRlcywgd2FybmluZ3MgfTogUm91dGVyc0V4dHJhY3RvcldvcmtlclJlc3VsdCA9IGF3YWl0IHJlbmRlcldvcmtlclxuICAgIC5ydW4oe30pXG4gICAgLmZpbmFsbHkoKCkgPT4gdm9pZCByZW5kZXJXb3JrZXIuZGVzdHJveSgpKTtcblxuICBmb3IgKGNvbnN0IHJvdXRlIG9mIGV4dHJhY3RlZFJvdXRlcykge1xuICAgIHJvdXRlcy5hZGQocm91dGUpO1xuICB9XG5cbiAgcmV0dXJuIHsgcm91dGVzLCB3YXJuaW5ncyB9O1xufVxuXG5mdW5jdGlvbiByZW1vdmVMZWFkaW5nU2xhc2godmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZS5jaGFyQXQoMCkgPT09ICcvJyA/IHZhbHVlLnNsaWNlKDEpIDogdmFsdWU7XG59XG4iXX0=