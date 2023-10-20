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
exports.execute = void 0;
const architect_1 = require("@angular-devkit/architect");
const fs = __importStar(require("fs"));
const promises_1 = require("node:fs/promises");
const ora_1 = __importDefault(require("ora"));
const path = __importStar(require("path"));
const piscina_1 = __importDefault(require("piscina"));
const utils_1 = require("../../utils");
const environment_options_1 = require("../../utils/environment-options");
const error_1 = require("../../utils/error");
const service_worker_1 = require("../../utils/service-worker");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
class RoutesSet extends Set {
    add(value) {
        return super.add(value.charAt(0) === '/' ? value.slice(1) : value);
    }
}
async function getRoutes(indexFile, outputPath, serverBundlePath, options, workspaceRoot) {
    const { routes: extraRoutes = [], routesFile, discoverRoutes } = options;
    const routes = new RoutesSet(extraRoutes);
    if (routesFile) {
        const routesFromFile = (await (0, promises_1.readFile)(path.join(workspaceRoot, routesFile), 'utf8')).split(/\r?\n/);
        for (const route of routesFromFile) {
            routes.add(route);
        }
    }
    if (discoverRoutes) {
        const renderWorker = new piscina_1.default({
            filename: require.resolve('./routes-extractor-worker'),
            maxThreads: 1,
            workerData: {
                indexFile,
                outputPath,
                serverBundlePath,
                zonePackage: require.resolve('zone.js', { paths: [workspaceRoot] }),
            },
        });
        const extractedRoutes = await renderWorker
            .run({})
            .finally(() => void renderWorker.destroy());
        for (const route of extractedRoutes) {
            routes.add(route);
        }
    }
    if (routes.size === 0) {
        throw new Error('Could not find any routes to prerender.');
    }
    return [...routes];
}
/**
 * Schedules the server and browser builds and returns their results if both builds are successful.
 */
async function _scheduleBuilds(options, context) {
    const browserTarget = (0, architect_1.targetFromTargetString)(options.browserTarget);
    const serverTarget = (0, architect_1.targetFromTargetString)(options.serverTarget);
    const browserTargetRun = await context.scheduleTarget(browserTarget, {
        watch: false,
        serviceWorker: false,
        // todo: handle service worker augmentation
    });
    const serverTargetRun = await context.scheduleTarget(serverTarget, {
        watch: false,
    });
    try {
        const [browserResult, serverResult] = await Promise.all([
            browserTargetRun.result,
            serverTargetRun.result,
        ]);
        const success = browserResult.success && serverResult.success && browserResult.baseOutputPath !== undefined;
        const error = browserResult.error || serverResult.error;
        return { success, error, browserResult, serverResult };
    }
    catch (e) {
        (0, error_1.assertIsError)(e);
        return { success: false, error: e.message };
    }
    finally {
        await Promise.all([browserTargetRun.stop(), serverTargetRun.stop()]);
    }
}
/**
 * Renders each route and writes them to
 * <route>/index.html for each output path in the browser result.
 */
async function _renderUniversal(options, context, browserResult, serverResult, browserOptions) {
    const projectName = context.target && context.target.project;
    if (!projectName) {
        throw new Error('The builder requires a target.');
    }
    const projectMetadata = await context.getProjectMetadata(projectName);
    const projectRoot = path.join(context.workspaceRoot, projectMetadata.root ?? '');
    // Users can specify a different base html file e.g. "src/home.html"
    const indexFile = (0, webpack_browser_config_1.getIndexOutputFile)(browserOptions.index);
    const { styles: normalizedStylesOptimization } = (0, utils_1.normalizeOptimization)(browserOptions.optimization);
    const zonePackage = require.resolve('zone.js', { paths: [context.workspaceRoot] });
    const { baseOutputPath = '' } = serverResult;
    const worker = new piscina_1.default({
        filename: path.join(__dirname, 'render-worker.js'),
        maxThreads: environment_options_1.maxWorkers,
        workerData: { zonePackage },
    });
    let routes;
    try {
        // We need to render the routes for each locale from the browser output.
        for (const { path: outputPath } of browserResult.outputs) {
            const localeDirectory = path.relative(browserResult.baseOutputPath, outputPath);
            const serverBundlePath = path.join(baseOutputPath, localeDirectory, 'main.js');
            if (!fs.existsSync(serverBundlePath)) {
                throw new Error(`Could not find the main bundle: ${serverBundlePath}`);
            }
            routes ??= await getRoutes(indexFile, outputPath, serverBundlePath, options, context.workspaceRoot);
            const spinner = (0, ora_1.default)(`Prerendering ${routes.length} route(s) to ${outputPath}...`).start();
            try {
                const results = (await Promise.all(routes.map((route) => {
                    const options = {
                        indexFile,
                        deployUrl: browserOptions.deployUrl || '',
                        inlineCriticalCss: !!normalizedStylesOptimization.inlineCritical,
                        minifyCss: !!normalizedStylesOptimization.minify,
                        outputPath,
                        route,
                        serverBundlePath,
                    };
                    return worker.run(options);
                })));
                let numErrors = 0;
                for (const { errors, warnings } of results) {
                    spinner.stop();
                    errors?.forEach((e) => context.logger.error(e));
                    warnings?.forEach((e) => context.logger.warn(e));
                    spinner.start();
                    numErrors += errors?.length ?? 0;
                }
                if (numErrors > 0) {
                    throw Error(`Rendering failed with ${numErrors} worker errors.`);
                }
            }
            catch (error) {
                spinner.fail(`Prerendering routes to ${outputPath} failed.`);
                (0, error_1.assertIsError)(error);
                return { success: false, error: error.message };
            }
            spinner.succeed(`Prerendering routes to ${outputPath} complete.`);
            if (browserOptions.serviceWorker) {
                spinner.start('Generating service worker...');
                try {
                    await (0, service_worker_1.augmentAppWithServiceWorker)(projectRoot, context.workspaceRoot, outputPath, browserOptions.baseHref || '/', browserOptions.ngswConfigPath);
                }
                catch (error) {
                    spinner.fail('Service worker generation failed.');
                    (0, error_1.assertIsError)(error);
                    return { success: false, error: error.message };
                }
                spinner.succeed('Service worker generation complete.');
            }
        }
    }
    finally {
        void worker.destroy();
    }
    return browserResult;
}
/**
 * Builds the browser and server, then renders each route in options.routes
 * and writes them to prerender/<route>/index.html for each output path in
 * the browser result.
 */
async function execute(options, context) {
    const browserTarget = (0, architect_1.targetFromTargetString)(options.browserTarget);
    const browserOptions = (await context.getTargetOptions(browserTarget));
    const result = await _scheduleBuilds(options, context);
    const { success, error, browserResult, serverResult } = result;
    if (!success || !browserResult || !serverResult) {
        return { success, error };
    }
    return _renderUniversal(options, context, browserResult, serverResult, browserOptions);
}
exports.execute = execute;
exports.default = (0, architect_1.createBuilder)(execute);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9wcmVyZW5kZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFLbUM7QUFFbkMsdUNBQXlCO0FBQ3pCLCtDQUE0QztBQUM1Qyw4Q0FBc0I7QUFDdEIsMkNBQTZCO0FBQzdCLHNEQUE4QjtBQUM5Qix1Q0FBb0Q7QUFDcEQseUVBQTZEO0FBQzdELDZDQUFrRDtBQUNsRCwrREFBeUU7QUFDekUsK0VBQXdFO0FBV3hFLE1BQU0sU0FBVSxTQUFRLEdBQVc7SUFDeEIsR0FBRyxDQUFDLEtBQWE7UUFDeEIsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNyRSxDQUFDO0NBQ0Y7QUFFRCxLQUFLLFVBQVUsU0FBUyxDQUN0QixTQUFpQixFQUNqQixVQUFrQixFQUNsQixnQkFBd0IsRUFDeEIsT0FBZ0MsRUFDaEMsYUFBcUI7SUFFckIsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLEdBQUcsRUFBRSxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsR0FBRyxPQUFPLENBQUM7SUFDekUsTUFBTSxNQUFNLEdBQUcsSUFBSSxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUM7SUFFMUMsSUFBSSxVQUFVLEVBQUU7UUFDZCxNQUFNLGNBQWMsR0FBRyxDQUFDLE1BQU0sSUFBQSxtQkFBUSxFQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLFVBQVUsQ0FBQyxFQUFF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QUUsY0FBYyxDQUFDLENBQUM7QUFDekYsQ0FBQztBQWhCRCwwQkFnQkM7QUFFRCxrQkFBZSxJQUFBLHlCQUFhLEVBQUMsT0FBTyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgQnVpbGRlckNvbnRleHQsXG4gIEJ1aWxkZXJPdXRwdXQsXG4gIGNyZWF0ZUJ1aWxkZXIsXG4gIHRhcmdldEZyb21UYXJnZXRTdHJpbmcsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsganNvbiB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgb3JhIGZyb20gJ29yYSc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IFBpc2NpbmEgZnJvbSAncGlzY2luYSc7XG5pbXBvcnQgeyBub3JtYWxpemVPcHRpbWl6YXRpb24gfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBtYXhXb3JrZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2VydmljZS13b3JrZXInO1xuaW1wb3J0IHsgZ2V0SW5kZXhPdXRwdXRGaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBCcm93c2VyQnVpbGRlck91dHB1dCB9IGZyb20gJy4uL2Jyb3dzZXInO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IFNlcnZlckJ1aWxkZXJPdXRwdXQgfSBmcm9tICcuLi9zZXJ2ZXInO1xuaW1wb3J0IHR5cGUgeyBSZW5kZXJPcHRpb25zLCBSZW5kZXJSZXN1bHQgfSBmcm9tICcuL3JlbmRlci13b3JrZXInO1xuaW1wb3J0IHsgUm91dGVzRXh0cmFjdG9yV29ya2VyRGF0YSB9IGZyb20gJy4vcm91dGVzLWV4dHJhY3Rvci13b3JrZXInO1xuaW1wb3J0IHsgU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG50eXBlIFByZXJlbmRlckJ1aWxkZXJPcHRpb25zID0gU2NoZW1hICYganNvbi5Kc29uT2JqZWN0O1xudHlwZSBQcmVyZW5kZXJCdWlsZGVyT3V0cHV0ID0gQnVpbGRlck91dHB1dDtcblxuY2xhc3MgUm91dGVzU2V0IGV4dGVuZHMgU2V0PHN0cmluZz4ge1xuICBvdmVycmlkZSBhZGQodmFsdWU6IHN0cmluZyk6IHRoaXMge1xuICAgIHJldHVybiBzdXBlci5hZGQodmFsdWUuY2hhckF0KDApID09PSAnLycgPyB2YWx1ZS5zbGljZSgxKSA6IHZhbHVlKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRSb3V0ZXMoXG4gIGluZGV4RmlsZTogc3RyaW5nLFxuICBvdXRwdXRQYXRoOiBzdHJpbmcsXG4gIHNlcnZlckJ1bmRsZVBhdGg6IHN0cmluZyxcbiAgb3B0aW9uczogUHJlcmVuZGVyQnVpbGRlck9wdGlvbnMsXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbik6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgY29uc3QgeyByb3V0ZXM6IGV4dHJhUm91dGVzID0gW10sIHJvdXRlc0ZpbGUsIGRpc2NvdmVyUm91dGVzIH0gPSBvcHRpb25zO1xuICBjb25zdCByb3V0ZXMgPSBuZXcgUm91dGVzU2V0KGV4dHJhUm91dGVzKTtcblxuICBpZiAocm91dGVzRmlsZSkge1xuICAgIGNvbnN0IHJvdXRlc0Zyb21GaWxlID0gKGF3YWl0IHJlYWRGaWxlKHBhdGguam9pbih3b3Jrc3BhY2VSb290LCByb3V0ZXNGaWxlKSwgJ3V0ZjgnKSkuc3BsaXQoXG4gICAgICAvXFxyP1xcbi8sXG4gICAgKTtcbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIHJvdXRlc0Zyb21GaWxlKSB7XG4gICAgICByb3V0ZXMuYWRkKHJvdXRlKTtcbiAgICB9XG4gIH1cblxuICBpZiAoZGlzY292ZXJSb3V0ZXMpIHtcbiAgICBjb25zdCByZW5kZXJXb3JrZXIgPSBuZXcgUGlzY2luYSh7XG4gICAgICBmaWxlbmFtZTogcmVxdWlyZS5yZXNvbHZlKCcuL3JvdXRlcy1leHRyYWN0b3Itd29ya2VyJyksXG4gICAgICBtYXhUaHJlYWRzOiAxLFxuICAgICAgd29ya2VyRGF0YToge1xuICAgICAgICBpbmRleEZpbGUsXG4gICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgIHNlcnZlckJ1bmRsZVBhdGgsXG4gICAgICAgIHpvbmVQYWNrYWdlOiByZXF1aXJlLnJlc29sdmUoJ3pvbmUuanMnLCB7IHBhdGhzOiBbd29ya3NwYWNlUm9vdF0gfSksXG4gICAgICB9IGFzIFJvdXRlc0V4dHJhY3RvcldvcmtlckRhdGEsXG4gICAgfSk7XG5cbiAgICBjb25zdCBleHRyYWN0ZWRSb3V0ZXM6IHN0cmluZ1tdID0gYXdhaXQgcmVuZGVyV29ya2VyXG4gICAgICAucnVuKHt9KVxuICAgICAgLmZpbmFsbHkoKCkgPT4gdm9pZCByZW5kZXJXb3JrZXIuZGVzdHJveSgpKTtcblxuICAgIGZvciAoY29uc3Qgcm91dGUgb2YgZXh0cmFjdGVkUm91dGVzKSB7XG4gICAgICByb3V0ZXMuYWRkKHJvdXRlKTtcbiAgICB9XG4gIH1cblxuICBpZiAocm91dGVzLnNpemUgPT09IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIGFueSByb3V0ZXMgdG8gcHJlcmVuZGVyLicpO1xuICB9XG5cbiAgcmV0dXJuIFsuLi5yb3V0ZXNdO1xufVxuXG4vKipcbiAqIFNjaGVkdWxlcyB0aGUgc2VydmVyIGFuZCBicm93c2VyIGJ1aWxkcyBhbmQgcmV0dXJucyB0aGVpciByZXN1bHRzIGlmIGJvdGggYnVpbGRzIGFyZSBzdWNjZXNzZnVsLlxuICovXG5hc3luYyBmdW5jdGlvbiBfc2NoZWR1bGVCdWlsZHMoXG4gIG9wdGlvbnM6IFByZXJlbmRlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IFByb21pc2U8XG4gIEJ1aWxkZXJPdXRwdXQgJiB7XG4gICAgc2VydmVyUmVzdWx0PzogU2VydmVyQnVpbGRlck91dHB1dDtcbiAgICBicm93c2VyUmVzdWx0PzogQnJvd3NlckJ1aWxkZXJPdXRwdXQ7XG4gIH1cbj4ge1xuICBjb25zdCBicm93c2VyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLmJyb3dzZXJUYXJnZXQpO1xuICBjb25zdCBzZXJ2ZXJUYXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuc2VydmVyVGFyZ2V0KTtcblxuICBjb25zdCBicm93c2VyVGFyZ2V0UnVuID0gYXdhaXQgY29udGV4dC5zY2hlZHVsZVRhcmdldChicm93c2VyVGFyZ2V0LCB7XG4gICAgd2F0Y2g6IGZhbHNlLFxuICAgIHNlcnZpY2VXb3JrZXI6IGZhbHNlLFxuICAgIC8vIHRvZG86IGhhbmRsZSBzZXJ2aWNlIHdvcmtlciBhdWdtZW50YXRpb25cbiAgfSk7XG4gIGNvbnN0IHNlcnZlclRhcmdldFJ1biA9IGF3YWl0IGNvbnRleHQuc2NoZWR1bGVUYXJnZXQoc2VydmVyVGFyZ2V0LCB7XG4gICAgd2F0Y2g6IGZhbHNlLFxuICB9KTtcblxuICB0cnkge1xuICAgIGNvbnN0IFticm93c2VyUmVzdWx0LCBzZXJ2ZXJSZXN1bHRdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgYnJvd3NlclRhcmdldFJ1bi5yZXN1bHQgYXMgdW5rbm93biBhcyBCcm93c2VyQnVpbGRlck91dHB1dCxcbiAgICAgIHNlcnZlclRhcmdldFJ1bi5yZXN1bHQgYXMgdW5rbm93biBhcyBTZXJ2ZXJCdWlsZGVyT3V0cHV0LFxuICAgIF0pO1xuXG4gICAgY29uc3Qgc3VjY2VzcyA9XG4gICAgICBicm93c2VyUmVzdWx0LnN1Y2Nlc3MgJiYgc2VydmVyUmVzdWx0LnN1Y2Nlc3MgJiYgYnJvd3NlclJlc3VsdC5iYXNlT3V0cHV0UGF0aCAhPT0gdW5kZWZpbmVkO1xuICAgIGNvbnN0IGVycm9yID0gYnJvd3NlclJlc3VsdC5lcnJvciB8fCAoc2VydmVyUmVzdWx0LmVycm9yIGFzIHN0cmluZyk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzLCBlcnJvciwgYnJvd3NlclJlc3VsdCwgc2VydmVyUmVzdWx0IH07XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBhc3NlcnRJc0Vycm9yKGUpO1xuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlLm1lc3NhZ2UgfTtcbiAgfSBmaW5hbGx5IHtcbiAgICBhd2FpdCBQcm9taXNlLmFsbChbYnJvd3NlclRhcmdldFJ1bi5zdG9wKCksIHNlcnZlclRhcmdldFJ1bi5zdG9wKCldKTtcbiAgfVxufVxuXG4vKipcbiAqIFJlbmRlcnMgZWFjaCByb3V0ZSBhbmQgd3JpdGVzIHRoZW0gdG9cbiAqIDxyb3V0ZT4vaW5kZXguaHRtbCBmb3IgZWFjaCBvdXRwdXQgcGF0aCBpbiB0aGUgYnJvd3NlciByZXN1bHQuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIF9yZW5kZXJVbml2ZXJzYWwoXG4gIG9wdGlvbnM6IFByZXJlbmRlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgYnJvd3NlclJlc3VsdDogQnJvd3NlckJ1aWxkZXJPdXRwdXQsXG4gIHNlcnZlclJlc3VsdDogU2VydmVyQnVpbGRlck91dHB1dCxcbiAgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbik6IFByb21pc2U8UHJlcmVuZGVyQnVpbGRlck91dHB1dD4ge1xuICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0ICYmIGNvbnRleHQudGFyZ2V0LnByb2plY3Q7XG4gIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0LicpO1xuICB9XG5cbiAgY29uc3QgcHJvamVjdE1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICBjb25zdCBwcm9qZWN0Um9vdCA9IHBhdGguam9pbihcbiAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgKHByb2plY3RNZXRhZGF0YS5yb290IGFzIHN0cmluZyB8IHVuZGVmaW5lZCkgPz8gJycsXG4gICk7XG5cbiAgLy8gVXNlcnMgY2FuIHNwZWNpZnkgYSBkaWZmZXJlbnQgYmFzZSBodG1sIGZpbGUgZS5nLiBcInNyYy9ob21lLmh0bWxcIlxuICBjb25zdCBpbmRleEZpbGUgPSBnZXRJbmRleE91dHB1dEZpbGUoYnJvd3Nlck9wdGlvbnMuaW5kZXgpO1xuICBjb25zdCB7IHN0eWxlczogbm9ybWFsaXplZFN0eWxlc09wdGltaXphdGlvbiB9ID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKFxuICAgIGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbixcbiAgKTtcblxuICBjb25zdCB6b25lUGFja2FnZSA9IHJlcXVpcmUucmVzb2x2ZSgnem9uZS5qcycsIHsgcGF0aHM6IFtjb250ZXh0LndvcmtzcGFjZVJvb3RdIH0pO1xuXG4gIGNvbnN0IHsgYmFzZU91dHB1dFBhdGggPSAnJyB9ID0gc2VydmVyUmVzdWx0O1xuICBjb25zdCB3b3JrZXIgPSBuZXcgUGlzY2luYSh7XG4gICAgZmlsZW5hbWU6IHBhdGguam9pbihfX2Rpcm5hbWUsICdyZW5kZXItd29ya2VyLmpzJyksXG4gICAgbWF4VGhyZWFkczogbWF4V29ya2VycyxcbiAgICB3b3JrZXJEYXRhOiB7IHpvbmVQYWNrYWdlIH0sXG4gIH0pO1xuXG4gIGxldCByb3V0ZXM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkO1xuXG4gIHRyeSB7XG4gICAgLy8gV2UgbmVlZCB0byByZW5kZXIgdGhlIHJvdXRlcyBmb3IgZWFjaCBsb2NhbGUgZnJvbSB0aGUgYnJvd3NlciBvdXRwdXQuXG4gICAgZm9yIChjb25zdCB7IHBhdGg6IG91dHB1dFBhdGggfSBvZiBicm93c2VyUmVzdWx0Lm91dHB1dHMpIHtcbiAgICAgIGNvbnN0IGxvY2FsZURpcmVjdG9yeSA9IHBhdGgucmVsYXRpdmUoYnJvd3NlclJlc3VsdC5iYXNlT3V0cHV0UGF0aCwgb3V0cHV0UGF0aCk7XG4gICAgICBjb25zdCBzZXJ2ZXJCdW5kbGVQYXRoID0gcGF0aC5qb2luKGJhc2VPdXRwdXRQYXRoLCBsb2NhbGVEaXJlY3RvcnksICdtYWluLmpzJyk7XG5cbiAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzZXJ2ZXJCdW5kbGVQYXRoKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kIHRoZSBtYWluIGJ1bmRsZTogJHtzZXJ2ZXJCdW5kbGVQYXRofWApO1xuICAgICAgfVxuXG4gICAgICByb3V0ZXMgPz89IGF3YWl0IGdldFJvdXRlcyhcbiAgICAgICAgaW5kZXhGaWxlLFxuICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICBzZXJ2ZXJCdW5kbGVQYXRoLFxuICAgICAgICBvcHRpb25zLFxuICAgICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICApO1xuXG4gICAgICBjb25zdCBzcGlubmVyID0gb3JhKGBQcmVyZW5kZXJpbmcgJHtyb3V0ZXMubGVuZ3RofSByb3V0ZShzKSB0byAke291dHB1dFBhdGh9Li4uYCkuc3RhcnQoKTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IChhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICByb3V0ZXMubWFwKChyb3V0ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgb3B0aW9uczogUmVuZGVyT3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgaW5kZXhGaWxlLFxuICAgICAgICAgICAgICBkZXBsb3lVcmw6IGJyb3dzZXJPcHRpb25zLmRlcGxveVVybCB8fCAnJyxcbiAgICAgICAgICAgICAgaW5saW5lQ3JpdGljYWxDc3M6ICEhbm9ybWFsaXplZFN0eWxlc09wdGltaXphdGlvbi5pbmxpbmVDcml0aWNhbCxcbiAgICAgICAgICAgICAgbWluaWZ5Q3NzOiAhIW5vcm1hbGl6ZWRTdHlsZXNPcHRpbWl6YXRpb24ubWluaWZ5LFxuICAgICAgICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICAgICAgICByb3V0ZSxcbiAgICAgICAgICAgICAgc2VydmVyQnVuZGxlUGF0aCxcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHJldHVybiB3b3JrZXIucnVuKG9wdGlvbnMpO1xuICAgICAgICAgIH0pLFxuICAgICAgICApKSBhcyBSZW5kZXJSZXN1bHRbXTtcbiAgICAgICAgbGV0IG51bUVycm9ycyA9IDA7XG4gICAgICAgIGZvciAoY29uc3QgeyBlcnJvcnMsIHdhcm5pbmdzIH0gb2YgcmVzdWx0cykge1xuICAgICAgICAgIHNwaW5uZXIuc3RvcCgpO1xuICAgICAgICAgIGVycm9ycz8uZm9yRWFjaCgoZSkgPT4gY29udGV4dC5sb2dnZXIuZXJyb3IoZSkpO1xuICAgICAgICAgIHdhcm5pbmdzPy5mb3JFYWNoKChlKSA9PiBjb250ZXh0LmxvZ2dlci53YXJuKGUpKTtcbiAgICAgICAgICBzcGlubmVyLnN0YXJ0KCk7XG4gICAgICAgICAgbnVtRXJyb3JzICs9IGVycm9ycz8ubGVuZ3RoID8/IDA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG51bUVycm9ycyA+IDApIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcihgUmVuZGVyaW5nIGZhaWxlZCB3aXRoICR7bnVtRXJyb3JzfSB3b3JrZXIgZXJyb3JzLmApO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBzcGlubmVyLmZhaWwoYFByZXJlbmRlcmluZyByb3V0ZXMgdG8gJHtvdXRwdXRQYXRofSBmYWlsZWQuYCk7XG4gICAgICAgIGFzc2VydElzRXJyb3IoZXJyb3IpO1xuXG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgfVxuICAgICAgc3Bpbm5lci5zdWNjZWVkKGBQcmVyZW5kZXJpbmcgcm91dGVzIHRvICR7b3V0cHV0UGF0aH0gY29tcGxldGUuYCk7XG5cbiAgICAgIGlmIChicm93c2VyT3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgICAgIHNwaW5uZXIuc3RhcnQoJ0dlbmVyYXRpbmcgc2VydmljZSB3b3JrZXIuLi4nKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIoXG4gICAgICAgICAgICBwcm9qZWN0Um9vdCxcbiAgICAgICAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgICAgICBicm93c2VyT3B0aW9ucy5iYXNlSHJlZiB8fCAnLycsXG4gICAgICAgICAgICBicm93c2VyT3B0aW9ucy5uZ3N3Q29uZmlnUGF0aCxcbiAgICAgICAgICApO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIHNwaW5uZXIuZmFpbCgnU2VydmljZSB3b3JrZXIgZ2VuZXJhdGlvbiBmYWlsZWQuJyk7XG4gICAgICAgICAgYXNzZXJ0SXNFcnJvcihlcnJvcik7XG5cbiAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgICAgICBzcGlubmVyLnN1Y2NlZWQoJ1NlcnZpY2Ugd29ya2VyIGdlbmVyYXRpb24gY29tcGxldGUuJyk7XG4gICAgICB9XG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIHZvaWQgd29ya2VyLmRlc3Ryb3koKTtcbiAgfVxuXG4gIHJldHVybiBicm93c2VyUmVzdWx0O1xufVxuXG4vKipcbiAqIEJ1aWxkcyB0aGUgYnJvd3NlciBhbmQgc2VydmVyLCB0aGVuIHJlbmRlcnMgZWFjaCByb3V0ZSBpbiBvcHRpb25zLnJvdXRlc1xuICogYW5kIHdyaXRlcyB0aGVtIHRvIHByZXJlbmRlci88cm91dGU+L2luZGV4Lmh0bWwgZm9yIGVhY2ggb3V0cHV0IHBhdGggaW5cbiAqIHRoZSBicm93c2VyIHJlc3VsdC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IFByZXJlbmRlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IFByb21pc2U8UHJlcmVuZGVyQnVpbGRlck91dHB1dD4ge1xuICBjb25zdCBicm93c2VyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLmJyb3dzZXJUYXJnZXQpO1xuICBjb25zdCBicm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMoXG4gICAgYnJvd3NlclRhcmdldCxcbiAgKSkgYXMgdW5rbm93biBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IF9zY2hlZHVsZUJ1aWxkcyhvcHRpb25zLCBjb250ZXh0KTtcbiAgY29uc3QgeyBzdWNjZXNzLCBlcnJvciwgYnJvd3NlclJlc3VsdCwgc2VydmVyUmVzdWx0IH0gPSByZXN1bHQ7XG5cbiAgaWYgKCFzdWNjZXNzIHx8ICFicm93c2VyUmVzdWx0IHx8ICFzZXJ2ZXJSZXN1bHQpIHtcbiAgICByZXR1cm4geyBzdWNjZXNzLCBlcnJvciB9IGFzIEJ1aWxkZXJPdXRwdXQ7XG4gIH1cblxuICByZXR1cm4gX3JlbmRlclVuaXZlcnNhbChvcHRpb25zLCBjb250ZXh0LCBicm93c2VyUmVzdWx0LCBzZXJ2ZXJSZXN1bHQsIGJyb3dzZXJPcHRpb25zKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcihleGVjdXRlKTtcbiJdfQ==