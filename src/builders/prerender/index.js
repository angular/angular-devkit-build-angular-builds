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
const ora_1 = __importDefault(require("ora"));
const path = __importStar(require("path"));
const piscina_1 = __importDefault(require("piscina"));
const utils_1 = require("../../utils");
const environment_options_1 = require("../../utils/environment-options");
const error_1 = require("../../utils/error");
const service_worker_1 = require("../../utils/service-worker");
const utils_2 = require("./utils");
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
async function _renderUniversal(routes, context, browserResult, serverResult, browserOptions) {
    const projectName = context.target && context.target.project;
    if (!projectName) {
        throw new Error('The builder requires a target.');
    }
    const projectMetadata = await context.getProjectMetadata(projectName);
    const projectRoot = path.join(context.workspaceRoot, projectMetadata.root ?? '');
    // Users can specify a different base html file e.g. "src/home.html"
    const indexFile = (0, utils_2.getIndexOutputFile)(browserOptions);
    const { styles: normalizedStylesOptimization } = (0, utils_1.normalizeOptimization)(browserOptions.optimization);
    const zonePackage = require.resolve('zone.js', { paths: [context.workspaceRoot] });
    const { baseOutputPath = '' } = serverResult;
    const worker = new piscina_1.default({
        filename: path.join(__dirname, 'render-worker.js'),
        maxThreads: environment_options_1.maxWorkers,
        workerData: { zonePackage },
    });
    try {
        // We need to render the routes for each locale from the browser output.
        for (const { path: outputPath } of browserResult.outputs) {
            const localeDirectory = path.relative(browserResult.baseOutputPath, outputPath);
            const serverBundlePath = path.join(baseOutputPath, localeDirectory, 'main.js');
            if (!fs.existsSync(serverBundlePath)) {
                throw new Error(`Could not find the main bundle: ${serverBundlePath}`);
            }
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
    const tsConfigPath = typeof browserOptions.tsConfig === 'string' ? browserOptions.tsConfig : undefined;
    const routes = await (0, utils_2.getRoutes)(options, tsConfigPath, context);
    if (!routes.length) {
        throw new Error(`Could not find any routes to prerender.`);
    }
    const result = await _scheduleBuilds(options, context);
    const { success, error, browserResult, serverResult } = result;
    if (!success || !browserResult || !serverResult) {
        return { success, error };
    }
    return _renderUniversal(routes, context, browserResult, serverResult, browserOptions);
}
exports.execute = execute;
exports.default = (0, architect_1.createBuilder)(execute);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9wcmVyZW5kZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFLbUM7QUFFbkMsdUNBQXlCO0FBQ3pCLDhDQUFzQjtBQUN0QiwyQ0FBNkI7QUFDN0Isc0RBQThCO0FBQzlCLHVDQUFvRDtBQUNwRCx5RUFBNkQ7QUFDN0QsNkNBQWtEO0FBQ2xELCtEQUF5RTtBQU16RSxtQ0FBd0Q7QUFLeEQ7O0dBRUc7QUFDSCxLQUFLLFVBQVUsZUFBZSxDQUM1QixPQUFnQyxFQUNoQyxPQUF1QjtJQU92QixNQUFNLGFBQWEsR0FBRyxJQUFBLGtDQUFzQixFQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNwRSxNQUFNLFlBQVksR0FBRyxJQUFBLGtDQUFzQixFQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUVsRSxNQUFNLGdCQUFnQixHQUFHLE1BQU0sT0FBTyxDQUFDLGNBQWMsQ0FBQyxhQUFhLEVBQUU7UUFDbkUsS0FBSyxFQUFFLEtBQUs7UUFDWixhQUFhLEVBQUUsS0FBSztRQUNwQiwyQ0FBMkM7S0FDNUMsQ0FBQyxDQUFDO0lBQ0gsTUFBTSxlQUFlLEdBQUcsTUFBTSxPQUFPLENBQUMsY0FBYyxDQUFDLFlBQVksRUFBRTtRQUNqRSxLQUFLLEVBQUUsS0FBSztLQUNiLENBQUMsQ0FBQztJQUVILElBQUk7UUFDRixNQUFNLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQztZQUN0RCxnQkFBZ0IsQ0FBQyxNQUF5QztZQUMxRCxlQUFlLENBQUMsTUFBd0M7U0FDekQsQ0FBQyxDQUFDO1FBRUgsTUFB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LGNBQWMsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUNwRCxhQUFhLENBQ2QsQ0FBcUMsQ0FBQztJQUN2QyxNQUFNLFlBQVksR0FDaEIsT0FBTyxjQUFjLENBQUMsUUFBUSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBRXBGLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBQSxpQkFBUyxFQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDL0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7UUFDbEIsTUFBTSxJQUFJLEtBQUssQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDO0tBQzVEO0lBRUQsTUFBTSxNQUFNLEdBQUcsTUFBTSxlQUFlLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3ZELE1BQU0sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQUUsR0FBRyxNQUFNLENBQUM7SUFDL0QsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLFlBQVksRUFBRTtRQUMvQyxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBbUIsQ0FBQztLQUM1QztJQUVELE9BQU8sZ0JBQWdCLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLGNBQWMsQ0FBQyxDQUFDO0FBQ3hGLENBQUM7QUF2QkQsMEJBdUJDO0FBRUQsa0JBQWUsSUFBQSx5QkFBYSxFQUFDLE9BQU8sQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkZXJDb250ZXh0LFxuICBCdWlsZGVyT3V0cHV0LFxuICBjcmVhdGVCdWlsZGVyLFxuICB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IGpzb24gfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgb3JhIGZyb20gJ29yYSc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IFBpc2NpbmEgZnJvbSAncGlzY2luYSc7XG5pbXBvcnQgeyBub3JtYWxpemVPcHRpbWl6YXRpb24gfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBtYXhXb3JrZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2VydmljZS13b3JrZXInO1xuaW1wb3J0IHsgQnJvd3NlckJ1aWxkZXJPdXRwdXQgfSBmcm9tICcuLi9icm93c2VyJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBTZXJ2ZXJCdWlsZGVyT3V0cHV0IH0gZnJvbSAnLi4vc2VydmVyJztcbmltcG9ydCB0eXBlIHsgUmVuZGVyT3B0aW9ucywgUmVuZGVyUmVzdWx0IH0gZnJvbSAnLi9yZW5kZXItd29ya2VyJztcbmltcG9ydCB7IFNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB7IGdldEluZGV4T3V0cHV0RmlsZSwgZ2V0Um91dGVzIH0gZnJvbSAnLi91dGlscyc7XG5cbnR5cGUgUHJlcmVuZGVyQnVpbGRlck9wdGlvbnMgPSBTY2hlbWEgJiBqc29uLkpzb25PYmplY3Q7XG50eXBlIFByZXJlbmRlckJ1aWxkZXJPdXRwdXQgPSBCdWlsZGVyT3V0cHV0O1xuXG4vKipcbiAqIFNjaGVkdWxlcyB0aGUgc2VydmVyIGFuZCBicm93c2VyIGJ1aWxkcyBhbmQgcmV0dXJucyB0aGVpciByZXN1bHRzIGlmIGJvdGggYnVpbGRzIGFyZSBzdWNjZXNzZnVsLlxuICovXG5hc3luYyBmdW5jdGlvbiBfc2NoZWR1bGVCdWlsZHMoXG4gIG9wdGlvbnM6IFByZXJlbmRlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IFByb21pc2U8XG4gIEJ1aWxkZXJPdXRwdXQgJiB7XG4gICAgc2VydmVyUmVzdWx0PzogU2VydmVyQnVpbGRlck91dHB1dDtcbiAgICBicm93c2VyUmVzdWx0PzogQnJvd3NlckJ1aWxkZXJPdXRwdXQ7XG4gIH1cbj4ge1xuICBjb25zdCBicm93c2VyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLmJyb3dzZXJUYXJnZXQpO1xuICBjb25zdCBzZXJ2ZXJUYXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuc2VydmVyVGFyZ2V0KTtcblxuICBjb25zdCBicm93c2VyVGFyZ2V0UnVuID0gYXdhaXQgY29udGV4dC5zY2hlZHVsZVRhcmdldChicm93c2VyVGFyZ2V0LCB7XG4gICAgd2F0Y2g6IGZhbHNlLFxuICAgIHNlcnZpY2VXb3JrZXI6IGZhbHNlLFxuICAgIC8vIHRvZG86IGhhbmRsZSBzZXJ2aWNlIHdvcmtlciBhdWdtZW50YXRpb25cbiAgfSk7XG4gIGNvbnN0IHNlcnZlclRhcmdldFJ1biA9IGF3YWl0IGNvbnRleHQuc2NoZWR1bGVUYXJnZXQoc2VydmVyVGFyZ2V0LCB7XG4gICAgd2F0Y2g6IGZhbHNlLFxuICB9KTtcblxuICB0cnkge1xuICAgIGNvbnN0IFticm93c2VyUmVzdWx0LCBzZXJ2ZXJSZXN1bHRdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgYnJvd3NlclRhcmdldFJ1bi5yZXN1bHQgYXMgdW5rbm93biBhcyBCcm93c2VyQnVpbGRlck91dHB1dCxcbiAgICAgIHNlcnZlclRhcmdldFJ1bi5yZXN1bHQgYXMgdW5rbm93biBhcyBTZXJ2ZXJCdWlsZGVyT3V0cHV0LFxuICAgIF0pO1xuXG4gICAgY29uc3Qgc3VjY2VzcyA9XG4gICAgICBicm93c2VyUmVzdWx0LnN1Y2Nlc3MgJiYgc2VydmVyUmVzdWx0LnN1Y2Nlc3MgJiYgYnJvd3NlclJlc3VsdC5iYXNlT3V0cHV0UGF0aCAhPT0gdW5kZWZpbmVkO1xuICAgIGNvbnN0IGVycm9yID0gYnJvd3NlclJlc3VsdC5lcnJvciB8fCAoc2VydmVyUmVzdWx0LmVycm9yIGFzIHN0cmluZyk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzLCBlcnJvciwgYnJvd3NlclJlc3VsdCwgc2VydmVyUmVzdWx0IH07XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBhc3NlcnRJc0Vycm9yKGUpO1xuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlLm1lc3NhZ2UgfTtcbiAgfSBmaW5hbGx5IHtcbiAgICBhd2FpdCBQcm9taXNlLmFsbChbYnJvd3NlclRhcmdldFJ1bi5zdG9wKCksIHNlcnZlclRhcmdldFJ1bi5zdG9wKCldKTtcbiAgfVxufVxuXG4vKipcbiAqIFJlbmRlcnMgZWFjaCByb3V0ZSBhbmQgd3JpdGVzIHRoZW0gdG9cbiAqIDxyb3V0ZT4vaW5kZXguaHRtbCBmb3IgZWFjaCBvdXRwdXQgcGF0aCBpbiB0aGUgYnJvd3NlciByZXN1bHQuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIF9yZW5kZXJVbml2ZXJzYWwoXG4gIHJvdXRlczogc3RyaW5nW10sXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBicm93c2VyUmVzdWx0OiBCcm93c2VyQnVpbGRlck91dHB1dCxcbiAgc2VydmVyUmVzdWx0OiBTZXJ2ZXJCdWlsZGVyT3V0cHV0LFxuICBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuKTogUHJvbWlzZTxQcmVyZW5kZXJCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQgJiYgY29udGV4dC50YXJnZXQucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVGhlIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQuJyk7XG4gIH1cblxuICBjb25zdCBwcm9qZWN0TWV0YWRhdGEgPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gIGNvbnN0IHByb2plY3RSb290ID0gcGF0aC5qb2luKFxuICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAocHJvamVjdE1ldGFkYXRhLnJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnJyxcbiAgKTtcblxuICAvLyBVc2VycyBjYW4gc3BlY2lmeSBhIGRpZmZlcmVudCBiYXNlIGh0bWwgZmlsZSBlLmcuIFwic3JjL2hvbWUuaHRtbFwiXG4gIGNvbnN0IGluZGV4RmlsZSA9IGdldEluZGV4T3V0cHV0RmlsZShicm93c2VyT3B0aW9ucyk7XG4gIGNvbnN0IHsgc3R5bGVzOiBub3JtYWxpemVkU3R5bGVzT3B0aW1pemF0aW9uIH0gPSBub3JtYWxpemVPcHRpbWl6YXRpb24oXG4gICAgYnJvd3Nlck9wdGlvbnMub3B0aW1pemF0aW9uLFxuICApO1xuXG4gIGNvbnN0IHpvbmVQYWNrYWdlID0gcmVxdWlyZS5yZXNvbHZlKCd6b25lLmpzJywgeyBwYXRoczogW2NvbnRleHQud29ya3NwYWNlUm9vdF0gfSk7XG5cbiAgY29uc3QgeyBiYXNlT3V0cHV0UGF0aCA9ICcnIH0gPSBzZXJ2ZXJSZXN1bHQ7XG4gIGNvbnN0IHdvcmtlciA9IG5ldyBQaXNjaW5hKHtcbiAgICBmaWxlbmFtZTogcGF0aC5qb2luKF9fZGlybmFtZSwgJ3JlbmRlci13b3JrZXIuanMnKSxcbiAgICBtYXhUaHJlYWRzOiBtYXhXb3JrZXJzLFxuICAgIHdvcmtlckRhdGE6IHsgem9uZVBhY2thZ2UgfSxcbiAgfSk7XG5cbiAgdHJ5IHtcbiAgICAvLyBXZSBuZWVkIHRvIHJlbmRlciB0aGUgcm91dGVzIGZvciBlYWNoIGxvY2FsZSBmcm9tIHRoZSBicm93c2VyIG91dHB1dC5cbiAgICBmb3IgKGNvbnN0IHsgcGF0aDogb3V0cHV0UGF0aCB9IG9mIGJyb3dzZXJSZXN1bHQub3V0cHV0cykge1xuICAgICAgY29uc3QgbG9jYWxlRGlyZWN0b3J5ID0gcGF0aC5yZWxhdGl2ZShicm93c2VyUmVzdWx0LmJhc2VPdXRwdXRQYXRoLCBvdXRwdXRQYXRoKTtcbiAgICAgIGNvbnN0IHNlcnZlckJ1bmRsZVBhdGggPSBwYXRoLmpvaW4oYmFzZU91dHB1dFBhdGgsIGxvY2FsZURpcmVjdG9yeSwgJ21haW4uanMnKTtcbiAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzZXJ2ZXJCdW5kbGVQYXRoKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kIHRoZSBtYWluIGJ1bmRsZTogJHtzZXJ2ZXJCdW5kbGVQYXRofWApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBzcGlubmVyID0gb3JhKGBQcmVyZW5kZXJpbmcgJHtyb3V0ZXMubGVuZ3RofSByb3V0ZShzKSB0byAke291dHB1dFBhdGh9Li4uYCkuc3RhcnQoKTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IChhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICByb3V0ZXMubWFwKChyb3V0ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgb3B0aW9uczogUmVuZGVyT3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgaW5kZXhGaWxlLFxuICAgICAgICAgICAgICBkZXBsb3lVcmw6IGJyb3dzZXJPcHRpb25zLmRlcGxveVVybCB8fCAnJyxcbiAgICAgICAgICAgICAgaW5saW5lQ3JpdGljYWxDc3M6ICEhbm9ybWFsaXplZFN0eWxlc09wdGltaXphdGlvbi5pbmxpbmVDcml0aWNhbCxcbiAgICAgICAgICAgICAgbWluaWZ5Q3NzOiAhIW5vcm1hbGl6ZWRTdHlsZXNPcHRpbWl6YXRpb24ubWluaWZ5LFxuICAgICAgICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICAgICAgICByb3V0ZSxcbiAgICAgICAgICAgICAgc2VydmVyQnVuZGxlUGF0aCxcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHJldHVybiB3b3JrZXIucnVuKG9wdGlvbnMpO1xuICAgICAgICAgIH0pLFxuICAgICAgICApKSBhcyBSZW5kZXJSZXN1bHRbXTtcbiAgICAgICAgbGV0IG51bUVycm9ycyA9IDA7XG4gICAgICAgIGZvciAoY29uc3QgeyBlcnJvcnMsIHdhcm5pbmdzIH0gb2YgcmVzdWx0cykge1xuICAgICAgICAgIHNwaW5uZXIuc3RvcCgpO1xuICAgICAgICAgIGVycm9ycz8uZm9yRWFjaCgoZSkgPT4gY29udGV4dC5sb2dnZXIuZXJyb3IoZSkpO1xuICAgICAgICAgIHdhcm5pbmdzPy5mb3JFYWNoKChlKSA9PiBjb250ZXh0LmxvZ2dlci53YXJuKGUpKTtcbiAgICAgICAgICBzcGlubmVyLnN0YXJ0KCk7XG4gICAgICAgICAgbnVtRXJyb3JzICs9IGVycm9ycz8ubGVuZ3RoID8/IDA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG51bUVycm9ycyA+IDApIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcihgUmVuZGVyaW5nIGZhaWxlZCB3aXRoICR7bnVtRXJyb3JzfSB3b3JrZXIgZXJyb3JzLmApO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBzcGlubmVyLmZhaWwoYFByZXJlbmRlcmluZyByb3V0ZXMgdG8gJHtvdXRwdXRQYXRofSBmYWlsZWQuYCk7XG4gICAgICAgIGFzc2VydElzRXJyb3IoZXJyb3IpO1xuXG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgfVxuICAgICAgc3Bpbm5lci5zdWNjZWVkKGBQcmVyZW5kZXJpbmcgcm91dGVzIHRvICR7b3V0cHV0UGF0aH0gY29tcGxldGUuYCk7XG5cbiAgICAgIGlmIChicm93c2VyT3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgICAgIHNwaW5uZXIuc3RhcnQoJ0dlbmVyYXRpbmcgc2VydmljZSB3b3JrZXIuLi4nKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIoXG4gICAgICAgICAgICBwcm9qZWN0Um9vdCxcbiAgICAgICAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgICAgICBicm93c2VyT3B0aW9ucy5iYXNlSHJlZiB8fCAnLycsXG4gICAgICAgICAgICBicm93c2VyT3B0aW9ucy5uZ3N3Q29uZmlnUGF0aCxcbiAgICAgICAgICApO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIHNwaW5uZXIuZmFpbCgnU2VydmljZSB3b3JrZXIgZ2VuZXJhdGlvbiBmYWlsZWQuJyk7XG4gICAgICAgICAgYXNzZXJ0SXNFcnJvcihlcnJvcik7XG5cbiAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgICAgICBzcGlubmVyLnN1Y2NlZWQoJ1NlcnZpY2Ugd29ya2VyIGdlbmVyYXRpb24gY29tcGxldGUuJyk7XG4gICAgICB9XG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIHZvaWQgd29ya2VyLmRlc3Ryb3koKTtcbiAgfVxuXG4gIHJldHVybiBicm93c2VyUmVzdWx0O1xufVxuXG4vKipcbiAqIEJ1aWxkcyB0aGUgYnJvd3NlciBhbmQgc2VydmVyLCB0aGVuIHJlbmRlcnMgZWFjaCByb3V0ZSBpbiBvcHRpb25zLnJvdXRlc1xuICogYW5kIHdyaXRlcyB0aGVtIHRvIHByZXJlbmRlci88cm91dGU+L2luZGV4Lmh0bWwgZm9yIGVhY2ggb3V0cHV0IHBhdGggaW5cbiAqIHRoZSBicm93c2VyIHJlc3VsdC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IFByZXJlbmRlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IFByb21pc2U8UHJlcmVuZGVyQnVpbGRlck91dHB1dD4ge1xuICBjb25zdCBicm93c2VyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLmJyb3dzZXJUYXJnZXQpO1xuICBjb25zdCBicm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMoXG4gICAgYnJvd3NlclRhcmdldCxcbiAgKSkgYXMgdW5rbm93biBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG4gIGNvbnN0IHRzQ29uZmlnUGF0aCA9XG4gICAgdHlwZW9mIGJyb3dzZXJPcHRpb25zLnRzQ29uZmlnID09PSAnc3RyaW5nJyA/IGJyb3dzZXJPcHRpb25zLnRzQ29uZmlnIDogdW5kZWZpbmVkO1xuXG4gIGNvbnN0IHJvdXRlcyA9IGF3YWl0IGdldFJvdXRlcyhvcHRpb25zLCB0c0NvbmZpZ1BhdGgsIGNvbnRleHQpO1xuICBpZiAoIXJvdXRlcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kIGFueSByb3V0ZXMgdG8gcHJlcmVuZGVyLmApO1xuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgX3NjaGVkdWxlQnVpbGRzKG9wdGlvbnMsIGNvbnRleHQpO1xuICBjb25zdCB7IHN1Y2Nlc3MsIGVycm9yLCBicm93c2VyUmVzdWx0LCBzZXJ2ZXJSZXN1bHQgfSA9IHJlc3VsdDtcbiAgaWYgKCFzdWNjZXNzIHx8ICFicm93c2VyUmVzdWx0IHx8ICFzZXJ2ZXJSZXN1bHQpIHtcbiAgICByZXR1cm4geyBzdWNjZXNzLCBlcnJvciB9IGFzIEJ1aWxkZXJPdXRwdXQ7XG4gIH1cblxuICByZXR1cm4gX3JlbmRlclVuaXZlcnNhbChyb3V0ZXMsIGNvbnRleHQsIGJyb3dzZXJSZXN1bHQsIHNlcnZlclJlc3VsdCwgYnJvd3Nlck9wdGlvbnMpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyKGV4ZWN1dGUpO1xuIl19