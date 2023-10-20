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
        // Workaround piscina bug where a worker thread will be recreated after destroy to meet the minimum.
        worker.options.minThreads = 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9wcmVyZW5kZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFLbUM7QUFFbkMsdUNBQXlCO0FBQ3pCLCtDQUE0QztBQUM1Qyw4Q0FBc0I7QUFDdEIsMkNBQTZCO0FBQzdCLHNEQUE4QjtBQUM5Qix1Q0FBb0Q7QUFDcEQseUVBQTZEO0FBQzdELDZDQUFrRDtBQUNsRCwrREFBeUU7QUFDekUsK0VBQXdFO0FBV3hFLE1BQU0sU0FBVSxTQUFRLEdBQVc7SUFDeEIsR0FBRyxDQUFDLEtBQWE7UUFDeEIsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNyRSxDQUFDO0NBQ0Y7QUFFRCxLQUFLLFVBQVUsU0FBUyxDQUN0QixTQUFpQixFQUNqQixVQUFrQixFQUNsQixnQkFBd0IsRUFDeEIsT0FBZ0MsRUFDaEMsYUFBcUI7SUFFckIsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLEdBQUcsRUFBRSxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsR0FBRyxPQUFPLENBQUM7SUFDekUsTUFBTSxNQUFNLEdBQUcsSUFBSSxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUM7SUFFMUMsSUFBSSxVQUFVLEVBQUU7UUFDZCxNQUFNLGNBQWMsR0FBRyxDQUFDLE1BQU0sSUFBQSxtQkFBUSxFQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLFVBQVUsQ0FBQyxFQUFF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SUFFRCxPQUFPLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxjQUFjLENBQUMsQ0FBQztBQUN6RixDQUFDO0FBaEJELDBCQWdCQztBQUVELGtCQUFlLElBQUEseUJBQWEsRUFBQyxPQUFPLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZGVyQ29udGV4dCxcbiAgQnVpbGRlck91dHB1dCxcbiAgY3JlYXRlQnVpbGRlcixcbiAgdGFyZ2V0RnJvbVRhcmdldFN0cmluZyxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBqc29uIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCBvcmEgZnJvbSAnb3JhJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgUGlzY2luYSBmcm9tICdwaXNjaW5hJztcbmltcG9ydCB7IG5vcm1hbGl6ZU9wdGltaXphdGlvbiB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IG1heFdvcmtlcnMgfSBmcm9tICcuLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIgfSBmcm9tICcuLi8uLi91dGlscy9zZXJ2aWNlLXdvcmtlcic7XG5pbXBvcnQgeyBnZXRJbmRleE91dHB1dEZpbGUgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IEJyb3dzZXJCdWlsZGVyT3V0cHV0IH0gZnJvbSAnLi4vYnJvd3Nlcic7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgU2VydmVyQnVpbGRlck91dHB1dCB9IGZyb20gJy4uL3NlcnZlcic7XG5pbXBvcnQgdHlwZSB7IFJlbmRlck9wdGlvbnMsIFJlbmRlclJlc3VsdCB9IGZyb20gJy4vcmVuZGVyLXdvcmtlcic7XG5pbXBvcnQgeyBSb3V0ZXNFeHRyYWN0b3JXb3JrZXJEYXRhIH0gZnJvbSAnLi9yb3V0ZXMtZXh0cmFjdG9yLXdvcmtlcic7XG5pbXBvcnQgeyBTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5cbnR5cGUgUHJlcmVuZGVyQnVpbGRlck9wdGlvbnMgPSBTY2hlbWEgJiBqc29uLkpzb25PYmplY3Q7XG50eXBlIFByZXJlbmRlckJ1aWxkZXJPdXRwdXQgPSBCdWlsZGVyT3V0cHV0O1xuXG5jbGFzcyBSb3V0ZXNTZXQgZXh0ZW5kcyBTZXQ8c3RyaW5nPiB7XG4gIG92ZXJyaWRlIGFkZCh2YWx1ZTogc3RyaW5nKTogdGhpcyB7XG4gICAgcmV0dXJuIHN1cGVyLmFkZCh2YWx1ZS5jaGFyQXQoMCkgPT09ICcvJyA/IHZhbHVlLnNsaWNlKDEpIDogdmFsdWUpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFJvdXRlcyhcbiAgaW5kZXhGaWxlOiBzdHJpbmcsXG4gIG91dHB1dFBhdGg6IHN0cmluZyxcbiAgc2VydmVyQnVuZGxlUGF0aDogc3RyaW5nLFxuICBvcHRpb25zOiBQcmVyZW5kZXJCdWlsZGVyT3B0aW9ucyxcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICBjb25zdCB7IHJvdXRlczogZXh0cmFSb3V0ZXMgPSBbXSwgcm91dGVzRmlsZSwgZGlzY292ZXJSb3V0ZXMgfSA9IG9wdGlvbnM7XG4gIGNvbnN0IHJvdXRlcyA9IG5ldyBSb3V0ZXNTZXQoZXh0cmFSb3V0ZXMpO1xuXG4gIGlmIChyb3V0ZXNGaWxlKSB7XG4gICAgY29uc3Qgcm91dGVzRnJvbUZpbGUgPSAoYXdhaXQgcmVhZEZpbGUocGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIHJvdXRlc0ZpbGUpLCAndXRmOCcpKS5zcGxpdChcbiAgICAgIC9cXHI/XFxuLyxcbiAgICApO1xuICAgIGZvciAoY29uc3Qgcm91dGUgb2Ygcm91dGVzRnJvbUZpbGUpIHtcbiAgICAgIHJvdXRlcy5hZGQocm91dGUpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChkaXNjb3ZlclJvdXRlcykge1xuICAgIGNvbnN0IHJlbmRlcldvcmtlciA9IG5ldyBQaXNjaW5hKHtcbiAgICAgIGZpbGVuYW1lOiByZXF1aXJlLnJlc29sdmUoJy4vcm91dGVzLWV4dHJhY3Rvci13b3JrZXInKSxcbiAgICAgIG1heFRocmVhZHM6IDEsXG4gICAgICB3b3JrZXJEYXRhOiB7XG4gICAgICAgIGluZGV4RmlsZSxcbiAgICAgICAgb3V0cHV0UGF0aCxcbiAgICAgICAgc2VydmVyQnVuZGxlUGF0aCxcbiAgICAgICAgem9uZVBhY2thZ2U6IHJlcXVpcmUucmVzb2x2ZSgnem9uZS5qcycsIHsgcGF0aHM6IFt3b3Jrc3BhY2VSb290XSB9KSxcbiAgICAgIH0gYXMgUm91dGVzRXh0cmFjdG9yV29ya2VyRGF0YSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGV4dHJhY3RlZFJvdXRlczogc3RyaW5nW10gPSBhd2FpdCByZW5kZXJXb3JrZXJcbiAgICAgIC5ydW4oe30pXG4gICAgICAuZmluYWxseSgoKSA9PiB2b2lkIHJlbmRlcldvcmtlci5kZXN0cm95KCkpO1xuXG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiBleHRyYWN0ZWRSb3V0ZXMpIHtcbiAgICAgIHJvdXRlcy5hZGQocm91dGUpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChyb3V0ZXMuc2l6ZSA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgYW55IHJvdXRlcyB0byBwcmVyZW5kZXIuJyk7XG4gIH1cblxuICByZXR1cm4gWy4uLnJvdXRlc107XG59XG5cbi8qKlxuICogU2NoZWR1bGVzIHRoZSBzZXJ2ZXIgYW5kIGJyb3dzZXIgYnVpbGRzIGFuZCByZXR1cm5zIHRoZWlyIHJlc3VsdHMgaWYgYm90aCBidWlsZHMgYXJlIHN1Y2Nlc3NmdWwuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIF9zY2hlZHVsZUJ1aWxkcyhcbiAgb3B0aW9uczogUHJlcmVuZGVyQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKTogUHJvbWlzZTxcbiAgQnVpbGRlck91dHB1dCAmIHtcbiAgICBzZXJ2ZXJSZXN1bHQ/OiBTZXJ2ZXJCdWlsZGVyT3V0cHV0O1xuICAgIGJyb3dzZXJSZXN1bHQ/OiBCcm93c2VyQnVpbGRlck91dHB1dDtcbiAgfVxuPiB7XG4gIGNvbnN0IGJyb3dzZXJUYXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuYnJvd3NlclRhcmdldCk7XG4gIGNvbnN0IHNlcnZlclRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5zZXJ2ZXJUYXJnZXQpO1xuXG4gIGNvbnN0IGJyb3dzZXJUYXJnZXRSdW4gPSBhd2FpdCBjb250ZXh0LnNjaGVkdWxlVGFyZ2V0KGJyb3dzZXJUYXJnZXQsIHtcbiAgICB3YXRjaDogZmFsc2UsXG4gICAgc2VydmljZVdvcmtlcjogZmFsc2UsXG4gICAgLy8gdG9kbzogaGFuZGxlIHNlcnZpY2Ugd29ya2VyIGF1Z21lbnRhdGlvblxuICB9KTtcbiAgY29uc3Qgc2VydmVyVGFyZ2V0UnVuID0gYXdhaXQgY29udGV4dC5zY2hlZHVsZVRhcmdldChzZXJ2ZXJUYXJnZXQsIHtcbiAgICB3YXRjaDogZmFsc2UsXG4gIH0pO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgW2Jyb3dzZXJSZXN1bHQsIHNlcnZlclJlc3VsdF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBicm93c2VyVGFyZ2V0UnVuLnJlc3VsdCBhcyB1bmtub3duIGFzIEJyb3dzZXJCdWlsZGVyT3V0cHV0LFxuICAgICAgc2VydmVyVGFyZ2V0UnVuLnJlc3VsdCBhcyB1bmtub3duIGFzIFNlcnZlckJ1aWxkZXJPdXRwdXQsXG4gICAgXSk7XG5cbiAgICBjb25zdCBzdWNjZXNzID1cbiAgICAgIGJyb3dzZXJSZXN1bHQuc3VjY2VzcyAmJiBzZXJ2ZXJSZXN1bHQuc3VjY2VzcyAmJiBicm93c2VyUmVzdWx0LmJhc2VPdXRwdXRQYXRoICE9PSB1bmRlZmluZWQ7XG4gICAgY29uc3QgZXJyb3IgPSBicm93c2VyUmVzdWx0LmVycm9yIHx8IChzZXJ2ZXJSZXN1bHQuZXJyb3IgYXMgc3RyaW5nKTtcblxuICAgIHJldHVybiB7IHN1Y2Nlc3MsIGVycm9yLCBicm93c2VyUmVzdWx0LCBzZXJ2ZXJSZXN1bHQgfTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGFzc2VydElzRXJyb3IoZSk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGUubWVzc2FnZSB9O1xuICB9IGZpbmFsbHkge1xuICAgIGF3YWl0IFByb21pc2UuYWxsKFticm93c2VyVGFyZ2V0UnVuLnN0b3AoKSwgc2VydmVyVGFyZ2V0UnVuLnN0b3AoKV0pO1xuICB9XG59XG5cbi8qKlxuICogUmVuZGVycyBlYWNoIHJvdXRlIGFuZCB3cml0ZXMgdGhlbSB0b1xuICogPHJvdXRlPi9pbmRleC5odG1sIGZvciBlYWNoIG91dHB1dCBwYXRoIGluIHRoZSBicm93c2VyIHJlc3VsdC5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gX3JlbmRlclVuaXZlcnNhbChcbiAgb3B0aW9uczogUHJlcmVuZGVyQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBicm93c2VyUmVzdWx0OiBCcm93c2VyQnVpbGRlck91dHB1dCxcbiAgc2VydmVyUmVzdWx0OiBTZXJ2ZXJCdWlsZGVyT3V0cHV0LFxuICBicm93c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuKTogUHJvbWlzZTxQcmVyZW5kZXJCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQgJiYgY29udGV4dC50YXJnZXQucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVGhlIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQuJyk7XG4gIH1cblxuICBjb25zdCBwcm9qZWN0TWV0YWRhdGEgPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gIGNvbnN0IHByb2plY3RSb290ID0gcGF0aC5qb2luKFxuICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAocHJvamVjdE1ldGFkYXRhLnJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnJyxcbiAgKTtcblxuICAvLyBVc2VycyBjYW4gc3BlY2lmeSBhIGRpZmZlcmVudCBiYXNlIGh0bWwgZmlsZSBlLmcuIFwic3JjL2hvbWUuaHRtbFwiXG4gIGNvbnN0IGluZGV4RmlsZSA9IGdldEluZGV4T3V0cHV0RmlsZShicm93c2VyT3B0aW9ucy5pbmRleCk7XG4gIGNvbnN0IHsgc3R5bGVzOiBub3JtYWxpemVkU3R5bGVzT3B0aW1pemF0aW9uIH0gPSBub3JtYWxpemVPcHRpbWl6YXRpb24oXG4gICAgYnJvd3Nlck9wdGlvbnMub3B0aW1pemF0aW9uLFxuICApO1xuXG4gIGNvbnN0IHpvbmVQYWNrYWdlID0gcmVxdWlyZS5yZXNvbHZlKCd6b25lLmpzJywgeyBwYXRoczogW2NvbnRleHQud29ya3NwYWNlUm9vdF0gfSk7XG5cbiAgY29uc3QgeyBiYXNlT3V0cHV0UGF0aCA9ICcnIH0gPSBzZXJ2ZXJSZXN1bHQ7XG4gIGNvbnN0IHdvcmtlciA9IG5ldyBQaXNjaW5hKHtcbiAgICBmaWxlbmFtZTogcGF0aC5qb2luKF9fZGlybmFtZSwgJ3JlbmRlci13b3JrZXIuanMnKSxcbiAgICBtYXhUaHJlYWRzOiBtYXhXb3JrZXJzLFxuICAgIHdvcmtlckRhdGE6IHsgem9uZVBhY2thZ2UgfSxcbiAgfSk7XG5cbiAgbGV0IHJvdXRlczogc3RyaW5nW10gfCB1bmRlZmluZWQ7XG5cbiAgdHJ5IHtcbiAgICAvLyBXZSBuZWVkIHRvIHJlbmRlciB0aGUgcm91dGVzIGZvciBlYWNoIGxvY2FsZSBmcm9tIHRoZSBicm93c2VyIG91dHB1dC5cbiAgICBmb3IgKGNvbnN0IHsgcGF0aDogb3V0cHV0UGF0aCB9IG9mIGJyb3dzZXJSZXN1bHQub3V0cHV0cykge1xuICAgICAgY29uc3QgbG9jYWxlRGlyZWN0b3J5ID0gcGF0aC5yZWxhdGl2ZShicm93c2VyUmVzdWx0LmJhc2VPdXRwdXRQYXRoLCBvdXRwdXRQYXRoKTtcbiAgICAgIGNvbnN0IHNlcnZlckJ1bmRsZVBhdGggPSBwYXRoLmpvaW4oYmFzZU91dHB1dFBhdGgsIGxvY2FsZURpcmVjdG9yeSwgJ21haW4uanMnKTtcblxuICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHNlcnZlckJ1bmRsZVBhdGgpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgdGhlIG1haW4gYnVuZGxlOiAke3NlcnZlckJ1bmRsZVBhdGh9YCk7XG4gICAgICB9XG5cbiAgICAgIHJvdXRlcyA/Pz0gYXdhaXQgZ2V0Um91dGVzKFxuICAgICAgICBpbmRleEZpbGUsXG4gICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgIHNlcnZlckJ1bmRsZVBhdGgsXG4gICAgICAgIG9wdGlvbnMsXG4gICAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgICk7XG5cbiAgICAgIGNvbnN0IHNwaW5uZXIgPSBvcmEoYFByZXJlbmRlcmluZyAke3JvdXRlcy5sZW5ndGh9IHJvdXRlKHMpIHRvICR7b3V0cHV0UGF0aH0uLi5gKS5zdGFydCgpO1xuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHRzID0gKGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgIHJvdXRlcy5tYXAoKHJvdXRlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBvcHRpb25zOiBSZW5kZXJPcHRpb25zID0ge1xuICAgICAgICAgICAgICBpbmRleEZpbGUsXG4gICAgICAgICAgICAgIGRlcGxveVVybDogYnJvd3Nlck9wdGlvbnMuZGVwbG95VXJsIHx8ICcnLFxuICAgICAgICAgICAgICBpbmxpbmVDcml0aWNhbENzczogISFub3JtYWxpemVkU3R5bGVzT3B0aW1pemF0aW9uLmlubGluZUNyaXRpY2FsLFxuICAgICAgICAgICAgICBtaW5pZnlDc3M6ICEhbm9ybWFsaXplZFN0eWxlc09wdGltaXphdGlvbi5taW5pZnksXG4gICAgICAgICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgICAgICAgIHJvdXRlLFxuICAgICAgICAgICAgICBzZXJ2ZXJCdW5kbGVQYXRoLFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgcmV0dXJuIHdvcmtlci5ydW4ob3B0aW9ucyk7XG4gICAgICAgICAgfSksXG4gICAgICAgICkpIGFzIFJlbmRlclJlc3VsdFtdO1xuICAgICAgICBsZXQgbnVtRXJyb3JzID0gMDtcbiAgICAgICAgZm9yIChjb25zdCB7IGVycm9ycywgd2FybmluZ3MgfSBvZiByZXN1bHRzKSB7XG4gICAgICAgICAgc3Bpbm5lci5zdG9wKCk7XG4gICAgICAgICAgZXJyb3JzPy5mb3JFYWNoKChlKSA9PiBjb250ZXh0LmxvZ2dlci5lcnJvcihlKSk7XG4gICAgICAgICAgd2FybmluZ3M/LmZvckVhY2goKGUpID0+IGNvbnRleHQubG9nZ2VyLndhcm4oZSkpO1xuICAgICAgICAgIHNwaW5uZXIuc3RhcnQoKTtcbiAgICAgICAgICBudW1FcnJvcnMgKz0gZXJyb3JzPy5sZW5ndGggPz8gMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobnVtRXJyb3JzID4gMCkge1xuICAgICAgICAgIHRocm93IEVycm9yKGBSZW5kZXJpbmcgZmFpbGVkIHdpdGggJHtudW1FcnJvcnN9IHdvcmtlciBlcnJvcnMuYCk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHNwaW5uZXIuZmFpbChgUHJlcmVuZGVyaW5nIHJvdXRlcyB0byAke291dHB1dFBhdGh9IGZhaWxlZC5gKTtcbiAgICAgICAgYXNzZXJ0SXNFcnJvcihlcnJvcik7XG5cbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07XG4gICAgICB9XG4gICAgICBzcGlubmVyLnN1Y2NlZWQoYFByZXJlbmRlcmluZyByb3V0ZXMgdG8gJHtvdXRwdXRQYXRofSBjb21wbGV0ZS5gKTtcblxuICAgICAgaWYgKGJyb3dzZXJPcHRpb25zLnNlcnZpY2VXb3JrZXIpIHtcbiAgICAgICAgc3Bpbm5lci5zdGFydCgnR2VuZXJhdGluZyBzZXJ2aWNlIHdvcmtlci4uLicpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlcihcbiAgICAgICAgICAgIHByb2plY3RSb290LFxuICAgICAgICAgICAgY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgICAgICAgb3V0cHV0UGF0aCxcbiAgICAgICAgICAgIGJyb3dzZXJPcHRpb25zLmJhc2VIcmVmIHx8ICcvJyxcbiAgICAgICAgICAgIGJyb3dzZXJPcHRpb25zLm5nc3dDb25maWdQYXRoLFxuICAgICAgICAgICk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgc3Bpbm5lci5mYWlsKCdTZXJ2aWNlIHdvcmtlciBnZW5lcmF0aW9uIGZhaWxlZC4nKTtcbiAgICAgICAgICBhc3NlcnRJc0Vycm9yKGVycm9yKTtcblxuICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgICAgIHNwaW5uZXIuc3VjY2VlZCgnU2VydmljZSB3b3JrZXIgZ2VuZXJhdGlvbiBjb21wbGV0ZS4nKTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZmluYWxseSB7XG4gICAgLy8gV29ya2Fyb3VuZCBwaXNjaW5hIGJ1ZyB3aGVyZSBhIHdvcmtlciB0aHJlYWQgd2lsbCBiZSByZWNyZWF0ZWQgYWZ0ZXIgZGVzdHJveSB0byBtZWV0IHRoZSBtaW5pbXVtLlxuICAgIHdvcmtlci5vcHRpb25zLm1pblRocmVhZHMgPSAwO1xuICAgIHZvaWQgd29ya2VyLmRlc3Ryb3koKTtcbiAgfVxuXG4gIHJldHVybiBicm93c2VyUmVzdWx0O1xufVxuXG4vKipcbiAqIEJ1aWxkcyB0aGUgYnJvd3NlciBhbmQgc2VydmVyLCB0aGVuIHJlbmRlcnMgZWFjaCByb3V0ZSBpbiBvcHRpb25zLnJvdXRlc1xuICogYW5kIHdyaXRlcyB0aGVtIHRvIHByZXJlbmRlci88cm91dGU+L2luZGV4Lmh0bWwgZm9yIGVhY2ggb3V0cHV0IHBhdGggaW5cbiAqIHRoZSBicm93c2VyIHJlc3VsdC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IFByZXJlbmRlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IFByb21pc2U8UHJlcmVuZGVyQnVpbGRlck91dHB1dD4ge1xuICBjb25zdCBicm93c2VyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLmJyb3dzZXJUYXJnZXQpO1xuICBjb25zdCBicm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMoXG4gICAgYnJvd3NlclRhcmdldCxcbiAgKSkgYXMgdW5rbm93biBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IF9zY2hlZHVsZUJ1aWxkcyhvcHRpb25zLCBjb250ZXh0KTtcbiAgY29uc3QgeyBzdWNjZXNzLCBlcnJvciwgYnJvd3NlclJlc3VsdCwgc2VydmVyUmVzdWx0IH0gPSByZXN1bHQ7XG5cbiAgaWYgKCFzdWNjZXNzIHx8ICFicm93c2VyUmVzdWx0IHx8ICFzZXJ2ZXJSZXN1bHQpIHtcbiAgICByZXR1cm4geyBzdWNjZXNzLCBlcnJvciB9IGFzIEJ1aWxkZXJPdXRwdXQ7XG4gIH1cblxuICByZXR1cm4gX3JlbmRlclVuaXZlcnNhbChvcHRpb25zLCBjb250ZXh0LCBicm93c2VyUmVzdWx0LCBzZXJ2ZXJSZXN1bHQsIGJyb3dzZXJPcHRpb25zKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcihleGVjdXRlKTtcbiJdfQ==