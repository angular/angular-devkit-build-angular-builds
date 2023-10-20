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
const architect_1 = require("@angular-devkit/architect");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const piscina_1 = __importDefault(require("piscina"));
const utils_1 = require("../../utils");
const error_1 = require("../../utils/error");
const service_worker_1 = require("../../utils/service-worker");
const spinner_1 = require("../../utils/spinner");
async function _renderUniversal(options, context, browserResult, serverResult, spinner) {
    // Get browser target options.
    const browserTarget = (0, architect_1.targetFromTargetString)(options.browserTarget);
    const rawBrowserOptions = (await context.getTargetOptions(browserTarget));
    const browserBuilderName = await context.getBuilderNameForTarget(browserTarget);
    const browserOptions = await context.validateOptions(rawBrowserOptions, browserBuilderName);
    // Locate zone.js to load in the render worker
    const root = context.workspaceRoot;
    const zonePackage = require.resolve('zone.js', { paths: [root] });
    const projectName = context.target && context.target.project;
    if (!projectName) {
        throw new Error('The builder requires a target.');
    }
    const projectMetadata = await context.getProjectMetadata(projectName);
    const projectRoot = path.join(root, projectMetadata.root ?? '');
    const { styles } = (0, utils_1.normalizeOptimization)(browserOptions.optimization);
    let inlineCriticalCssProcessor;
    if (styles.inlineCritical) {
        const { InlineCriticalCssProcessor } = await Promise.resolve().then(() => __importStar(require('../../utils/index-file/inline-critical-css')));
        inlineCriticalCssProcessor = new InlineCriticalCssProcessor({
            minify: styles.minify,
            deployUrl: browserOptions.deployUrl,
        });
    }
    const renderWorker = new piscina_1.default({
        filename: require.resolve('./render-worker'),
        maxThreads: 1,
        workerData: { zonePackage },
    });
    try {
        for (const { path: outputPath, baseHref } of browserResult.outputs) {
            const localeDirectory = path.relative(browserResult.baseOutputPath, outputPath);
            const browserIndexOutputPath = path.join(outputPath, 'index.html');
            const indexHtml = await fs.promises.readFile(browserIndexOutputPath, 'utf8');
            const serverBundlePath = await _getServerModuleBundlePath(options, context, serverResult, localeDirectory);
            let html = await renderWorker.run({
                serverBundlePath,
                document: indexHtml,
                url: options.route,
            });
            // Overwrite the client index file.
            const outputIndexPath = options.outputIndexPath
                ? path.join(root, options.outputIndexPath)
                : browserIndexOutputPath;
            if (inlineCriticalCssProcessor) {
                const { content, warnings, errors } = await inlineCriticalCssProcessor.process(html, {
                    outputPath,
                });
                html = content;
                if (warnings.length || errors.length) {
                    spinner.stop();
                    warnings.forEach((m) => context.logger.warn(m));
                    errors.forEach((m) => context.logger.error(m));
                    spinner.start();
                }
            }
            await fs.promises.writeFile(outputIndexPath, html);
            if (browserOptions.serviceWorker) {
                await (0, service_worker_1.augmentAppWithServiceWorker)(projectRoot, root, outputPath, baseHref ?? '/', browserOptions.ngswConfigPath);
            }
        }
    }
    finally {
        await renderWorker.destroy();
    }
    return browserResult;
}
async function _getServerModuleBundlePath(options, context, serverResult, browserLocaleDirectory) {
    if (options.appModuleBundle) {
        return path.join(context.workspaceRoot, options.appModuleBundle);
    }
    const { baseOutputPath = '' } = serverResult;
    const outputPath = path.join(baseOutputPath, browserLocaleDirectory);
    if (!fs.existsSync(outputPath)) {
        throw new Error(`Could not find server output directory: ${outputPath}.`);
    }
    const re = /^main\.(?:[a-zA-Z0-9]{16}\.)?js$/;
    const maybeMain = fs.readdirSync(outputPath).find((x) => re.test(x));
    if (!maybeMain) {
        throw new Error('Could not find the main bundle.');
    }
    return path.join(outputPath, maybeMain);
}
async function _appShellBuilder(options, context) {
    const browserTarget = (0, architect_1.targetFromTargetString)(options.browserTarget);
    const serverTarget = (0, architect_1.targetFromTargetString)(options.serverTarget);
    // Never run the browser target in watch mode.
    // If service worker is needed, it will be added in _renderUniversal();
    const browserOptions = (await context.getTargetOptions(browserTarget));
    const optimization = (0, utils_1.normalizeOptimization)(browserOptions.optimization);
    optimization.styles.inlineCritical = false;
    const browserTargetRun = await context.scheduleTarget(browserTarget, {
        watch: false,
        serviceWorker: false,
        optimization: optimization,
    });
    const serverTargetRun = await context.scheduleTarget(serverTarget, {
        watch: false,
    });
    let spinner;
    try {
        const [browserResult, serverResult] = await Promise.all([
            browserTargetRun.result,
            serverTargetRun.result,
        ]);
        if (browserResult.success === false || browserResult.baseOutputPath === undefined) {
            return browserResult;
        }
        else if (serverResult.success === false) {
            return serverResult;
        }
        spinner = new spinner_1.Spinner();
        spinner.start('Generating application shell...');
        const result = await _renderUniversal(options, context, browserResult, serverResult, spinner);
        spinner.succeed('Application shell generation complete.');
        return result;
    }
    catch (err) {
        spinner?.fail('Application shell generation failed.');
        (0, error_1.assertIsError)(err);
        return { success: false, error: err.message };
    }
    finally {
        await Promise.all([browserTargetRun.stop(), serverTargetRun.stop()]);
    }
}
exports.default = (0, architect_1.createBuilder)(_appShellBuilder);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9hcHAtc2hlbGwvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUttQztBQUVuQyx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLHNEQUE4QjtBQUM5Qix1Q0FBb0Q7QUFDcEQsNkNBQWtEO0FBRWxELCtEQUF5RTtBQUN6RSxpREFBOEM7QUFNOUMsS0FBSyxVQUFVLGdCQUFnQixDQUM3QixPQUFtQyxFQUNuQyxPQUF1QixFQUN2QixhQUFtQyxFQUNuQyxZQUFpQyxFQUNqQyxPQUFnQjtJQUVoQiw4QkFBOEI7SUFDOUIsTUFBTSxhQUFhLEdBQUcsSUFBQSxrQ0FBc0IsRUFBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDcEUsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxDQUNsRCxDQUFDO0lBQ3ZCLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxPQUFPLENBQUMsdUJBQXVCLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDaEYsTUFBTSxjQUFjLEdBQUcsTUFBTSxPQUFPLENBQUMsZUFBZSxDQUNsRCxpQkFBaUIsRUFDakIsa0JBQWtCLENBQ25CLENBQUM7SUFFRiw4Q0FBOEM7SUFDOUMsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUNuQyxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUVsRSxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFBTSxJQUFJLE9BQU8s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QUMsTUFBdUM7WUFDeEQsZUFBZSxDQUFDLE1BQXNDO1NBQ3ZELENBQUMsQ0FBQztRQUVILElBQUksYUFBYSxDQUFDLE9BQU8sS0FBSyxLQUFLLElBQUksYUFBYSxDQUFDLGNBQWMsS0FBSyxTQUFTLEVBQUU7WUFDakYsT0FBTyxhQUFhLENBQUM7U0FDdEI7YUFBTSxJQUFJLFlBQVksQ0FBQyxPQUFPLEtBQUssS0FBSyxFQUFFO1lBQ3pDLE9BQU8sWUFBWSxDQUFDO1NBQ3JCO1FBRUQsT0FBTyxHQUFHLElBQUksaUJBQU8sRUFBRSxDQUFDO1FBQ3hCLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUNBQWlDLENBQUMsQ0FBQztRQUNqRCxNQUFNLE1BQU0sR0FBRyxNQUFNLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM5RixPQUFPLENBQUMsT0FBTyxDQUFDLHdDQUF3QyxDQUFDLENBQUM7UUFFMUQsT0FBTyxNQUFNLENBQUM7S0FDZjtJQUFDLE9BQU8sR0FBRyxFQUFFO1FBQ1osT0FBTyxFQUFFLElBQUksQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO1FBQ3RELElBQUEscUJBQWEsRUFBQyxHQUFHLENBQUMsQ0FBQztRQUVuQixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQy9DO1lBQVM7UUFDUixNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsRUFBRSxlQUFlLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQ3RFO0FBQ0gsQ0FBQztBQUVELGtCQUFlLElBQUEseUJBQWEsRUFBQyxnQkFBZ0IsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkZXJDb250ZXh0LFxuICBCdWlsZGVyT3V0cHV0LFxuICBjcmVhdGVCdWlsZGVyLFxuICB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IEpzb25PYmplY3QgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IFBpc2NpbmEgZnJvbSAncGlzY2luYSc7XG5pbXBvcnQgeyBub3JtYWxpemVPcHRpbWl6YXRpb24gfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHR5cGUgeyBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NvciB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5saW5lLWNyaXRpY2FsLWNzcyc7XG5pbXBvcnQgeyBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIgfSBmcm9tICcuLi8uLi91dGlscy9zZXJ2aWNlLXdvcmtlcic7XG5pbXBvcnQgeyBTcGlubmVyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lcic7XG5pbXBvcnQgeyBCcm93c2VyQnVpbGRlck91dHB1dCB9IGZyb20gJy4uL2Jyb3dzZXInO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyU2NoZW1hIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgU2VydmVyQnVpbGRlck91dHB1dCB9IGZyb20gJy4uL3NlcnZlcic7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmFzeW5jIGZ1bmN0aW9uIF9yZW5kZXJVbml2ZXJzYWwoXG4gIG9wdGlvbnM6IEJ1aWxkV2VicGFja0FwcFNoZWxsU2NoZW1hLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgYnJvd3NlclJlc3VsdDogQnJvd3NlckJ1aWxkZXJPdXRwdXQsXG4gIHNlcnZlclJlc3VsdDogU2VydmVyQnVpbGRlck91dHB1dCxcbiAgc3Bpbm5lcjogU3Bpbm5lcixcbik6IFByb21pc2U8QnJvd3NlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gR2V0IGJyb3dzZXIgdGFyZ2V0IG9wdGlvbnMuXG4gIGNvbnN0IGJyb3dzZXJUYXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuYnJvd3NlclRhcmdldCk7XG4gIGNvbnN0IHJhd0Jyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhicm93c2VyVGFyZ2V0KSkgYXMgSnNvbk9iamVjdCAmXG4gICAgQnJvd3NlckJ1aWxkZXJTY2hlbWE7XG4gIGNvbnN0IGJyb3dzZXJCdWlsZGVyTmFtZSA9IGF3YWl0IGNvbnRleHQuZ2V0QnVpbGRlck5hbWVGb3JUYXJnZXQoYnJvd3NlclRhcmdldCk7XG4gIGNvbnN0IGJyb3dzZXJPcHRpb25zID0gYXdhaXQgY29udGV4dC52YWxpZGF0ZU9wdGlvbnM8SnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyU2NoZW1hPihcbiAgICByYXdCcm93c2VyT3B0aW9ucyxcbiAgICBicm93c2VyQnVpbGRlck5hbWUsXG4gICk7XG5cbiAgLy8gTG9jYXRlIHpvbmUuanMgdG8gbG9hZCBpbiB0aGUgcmVuZGVyIHdvcmtlclxuICBjb25zdCByb290ID0gY29udGV4dC53b3Jrc3BhY2VSb290O1xuICBjb25zdCB6b25lUGFja2FnZSA9IHJlcXVpcmUucmVzb2x2ZSgnem9uZS5qcycsIHsgcGF0aHM6IFtyb290XSB9KTtcblxuICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0ICYmIGNvbnRleHQudGFyZ2V0LnByb2plY3Q7XG4gIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0LicpO1xuICB9XG5cbiAgY29uc3QgcHJvamVjdE1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICBjb25zdCBwcm9qZWN0Um9vdCA9IHBhdGguam9pbihyb290LCAocHJvamVjdE1ldGFkYXRhLnJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnJyk7XG5cbiAgY29uc3QgeyBzdHlsZXMgfSA9IG5vcm1hbGl6ZU9wdGltaXphdGlvbihicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24pO1xuICBsZXQgaW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3I6IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yIHwgdW5kZWZpbmVkO1xuICBpZiAoc3R5bGVzLmlubGluZUNyaXRpY2FsKSB7XG4gICAgY29uc3QgeyBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NvciB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5saW5lLWNyaXRpY2FsLWNzcydcbiAgICApO1xuICAgIGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yID0gbmV3IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yKHtcbiAgICAgIG1pbmlmeTogc3R5bGVzLm1pbmlmeSxcbiAgICAgIGRlcGxveVVybDogYnJvd3Nlck9wdGlvbnMuZGVwbG95VXJsLFxuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgcmVuZGVyV29ya2VyID0gbmV3IFBpc2NpbmEoe1xuICAgIGZpbGVuYW1lOiByZXF1aXJlLnJlc29sdmUoJy4vcmVuZGVyLXdvcmtlcicpLFxuICAgIG1heFRocmVhZHM6IDEsXG4gICAgd29ya2VyRGF0YTogeyB6b25lUGFja2FnZSB9LFxuICB9KTtcblxuICB0cnkge1xuICAgIGZvciAoY29uc3QgeyBwYXRoOiBvdXRwdXRQYXRoLCBiYXNlSHJlZiB9IG9mIGJyb3dzZXJSZXN1bHQub3V0cHV0cykge1xuICAgICAgY29uc3QgbG9jYWxlRGlyZWN0b3J5ID0gcGF0aC5yZWxhdGl2ZShicm93c2VyUmVzdWx0LmJhc2VPdXRwdXRQYXRoLCBvdXRwdXRQYXRoKTtcbiAgICAgIGNvbnN0IGJyb3dzZXJJbmRleE91dHB1dFBhdGggPSBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgJ2luZGV4Lmh0bWwnKTtcbiAgICAgIGNvbnN0IGluZGV4SHRtbCA9IGF3YWl0IGZzLnByb21pc2VzLnJlYWRGaWxlKGJyb3dzZXJJbmRleE91dHB1dFBhdGgsICd1dGY4Jyk7XG4gICAgICBjb25zdCBzZXJ2ZXJCdW5kbGVQYXRoID0gYXdhaXQgX2dldFNlcnZlck1vZHVsZUJ1bmRsZVBhdGgoXG4gICAgICAgIG9wdGlvbnMsXG4gICAgICAgIGNvbnRleHQsXG4gICAgICAgIHNlcnZlclJlc3VsdCxcbiAgICAgICAgbG9jYWxlRGlyZWN0b3J5LFxuICAgICAgKTtcblxuICAgICAgbGV0IGh0bWw6IHN0cmluZyA9IGF3YWl0IHJlbmRlcldvcmtlci5ydW4oe1xuICAgICAgICBzZXJ2ZXJCdW5kbGVQYXRoLFxuICAgICAgICBkb2N1bWVudDogaW5kZXhIdG1sLFxuICAgICAgICB1cmw6IG9wdGlvbnMucm91dGUsXG4gICAgICB9KTtcblxuICAgICAgLy8gT3ZlcndyaXRlIHRoZSBjbGllbnQgaW5kZXggZmlsZS5cbiAgICAgIGNvbnN0IG91dHB1dEluZGV4UGF0aCA9IG9wdGlvbnMub3V0cHV0SW5kZXhQYXRoXG4gICAgICAgID8gcGF0aC5qb2luKHJvb3QsIG9wdGlvbnMub3V0cHV0SW5kZXhQYXRoKVxuICAgICAgICA6IGJyb3dzZXJJbmRleE91dHB1dFBhdGg7XG5cbiAgICAgIGlmIChpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvcikge1xuICAgICAgICBjb25zdCB7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yLnByb2Nlc3MoaHRtbCwge1xuICAgICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgIH0pO1xuICAgICAgICBodG1sID0gY29udGVudDtcblxuICAgICAgICBpZiAod2FybmluZ3MubGVuZ3RoIHx8IGVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICBzcGlubmVyLnN0b3AoKTtcbiAgICAgICAgICB3YXJuaW5ncy5mb3JFYWNoKChtKSA9PiBjb250ZXh0LmxvZ2dlci53YXJuKG0pKTtcbiAgICAgICAgICBlcnJvcnMuZm9yRWFjaCgobSkgPT4gY29udGV4dC5sb2dnZXIuZXJyb3IobSkpO1xuICAgICAgICAgIHNwaW5uZXIuc3RhcnQoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBhd2FpdCBmcy5wcm9taXNlcy53cml0ZUZpbGUob3V0cHV0SW5kZXhQYXRoLCBodG1sKTtcblxuICAgICAgaWYgKGJyb3dzZXJPcHRpb25zLnNlcnZpY2VXb3JrZXIpIHtcbiAgICAgICAgYXdhaXQgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyKFxuICAgICAgICAgIHByb2plY3RSb290LFxuICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgb3V0cHV0UGF0aCxcbiAgICAgICAgICBiYXNlSHJlZiA/PyAnLycsXG4gICAgICAgICAgYnJvd3Nlck9wdGlvbnMubmdzd0NvbmZpZ1BhdGgsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIGF3YWl0IHJlbmRlcldvcmtlci5kZXN0cm95KCk7XG4gIH1cblxuICByZXR1cm4gYnJvd3NlclJlc3VsdDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2dldFNlcnZlck1vZHVsZUJ1bmRsZVBhdGgoXG4gIG9wdGlvbnM6IEJ1aWxkV2VicGFja0FwcFNoZWxsU2NoZW1hLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgc2VydmVyUmVzdWx0OiBTZXJ2ZXJCdWlsZGVyT3V0cHV0LFxuICBicm93c2VyTG9jYWxlRGlyZWN0b3J5OiBzdHJpbmcsXG4pIHtcbiAgaWYgKG9wdGlvbnMuYXBwTW9kdWxlQnVuZGxlKSB7XG4gICAgcmV0dXJuIHBhdGguam9pbihjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9wdGlvbnMuYXBwTW9kdWxlQnVuZGxlKTtcbiAgfVxuXG4gIGNvbnN0IHsgYmFzZU91dHB1dFBhdGggPSAnJyB9ID0gc2VydmVyUmVzdWx0O1xuICBjb25zdCBvdXRwdXRQYXRoID0gcGF0aC5qb2luKGJhc2VPdXRwdXRQYXRoLCBicm93c2VyTG9jYWxlRGlyZWN0b3J5KTtcblxuICBpZiAoIWZzLmV4aXN0c1N5bmMob3V0cHV0UGF0aCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kIHNlcnZlciBvdXRwdXQgZGlyZWN0b3J5OiAke291dHB1dFBhdGh9LmApO1xuICB9XG5cbiAgY29uc3QgcmUgPSAvXm1haW5cXC4oPzpbYS16QS1aMC05XXsxNn1cXC4pP2pzJC87XG4gIGNvbnN0IG1heWJlTWFpbiA9IGZzLnJlYWRkaXJTeW5jKG91dHB1dFBhdGgpLmZpbmQoKHgpID0+IHJlLnRlc3QoeCkpO1xuXG4gIGlmICghbWF5YmVNYWluKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCB0aGUgbWFpbiBidW5kbGUuJyk7XG4gIH1cblxuICByZXR1cm4gcGF0aC5qb2luKG91dHB1dFBhdGgsIG1heWJlTWFpbik7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9hcHBTaGVsbEJ1aWxkZXIoXG4gIG9wdGlvbnM6IEJ1aWxkV2VicGFja0FwcFNoZWxsU2NoZW1hLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IFByb21pc2U8QnVpbGRlck91dHB1dD4ge1xuICBjb25zdCBicm93c2VyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLmJyb3dzZXJUYXJnZXQpO1xuICBjb25zdCBzZXJ2ZXJUYXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuc2VydmVyVGFyZ2V0KTtcblxuICAvLyBOZXZlciBydW4gdGhlIGJyb3dzZXIgdGFyZ2V0IGluIHdhdGNoIG1vZGUuXG4gIC8vIElmIHNlcnZpY2Ugd29ya2VyIGlzIG5lZWRlZCwgaXQgd2lsbCBiZSBhZGRlZCBpbiBfcmVuZGVyVW5pdmVyc2FsKCk7XG4gIGNvbnN0IGJyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhicm93c2VyVGFyZ2V0KSkgYXMgSnNvbk9iamVjdCAmXG4gICAgQnJvd3NlckJ1aWxkZXJTY2hlbWE7XG5cbiAgY29uc3Qgb3B0aW1pemF0aW9uID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbik7XG4gIG9wdGltaXphdGlvbi5zdHlsZXMuaW5saW5lQ3JpdGljYWwgPSBmYWxzZTtcblxuICBjb25zdCBicm93c2VyVGFyZ2V0UnVuID0gYXdhaXQgY29udGV4dC5zY2hlZHVsZVRhcmdldChicm93c2VyVGFyZ2V0LCB7XG4gICAgd2F0Y2g6IGZhbHNlLFxuICAgIHNlcnZpY2VXb3JrZXI6IGZhbHNlLFxuICAgIG9wdGltaXphdGlvbjogb3B0aW1pemF0aW9uIGFzIHVua25vd24gYXMgSnNvbk9iamVjdCxcbiAgfSk7XG4gIGNvbnN0IHNlcnZlclRhcmdldFJ1biA9IGF3YWl0IGNvbnRleHQuc2NoZWR1bGVUYXJnZXQoc2VydmVyVGFyZ2V0LCB7XG4gICAgd2F0Y2g6IGZhbHNlLFxuICB9KTtcblxuICBsZXQgc3Bpbm5lcjogU3Bpbm5lciB8IHVuZGVmaW5lZDtcblxuICB0cnkge1xuICAgIGNvbnN0IFticm93c2VyUmVzdWx0LCBzZXJ2ZXJSZXN1bHRdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgYnJvd3NlclRhcmdldFJ1bi5yZXN1bHQgYXMgUHJvbWlzZTxCcm93c2VyQnVpbGRlck91dHB1dD4sXG4gICAgICBzZXJ2ZXJUYXJnZXRSdW4ucmVzdWx0IGFzIFByb21pc2U8U2VydmVyQnVpbGRlck91dHB1dD4sXG4gICAgXSk7XG5cbiAgICBpZiAoYnJvd3NlclJlc3VsdC5zdWNjZXNzID09PSBmYWxzZSB8fCBicm93c2VyUmVzdWx0LmJhc2VPdXRwdXRQYXRoID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBicm93c2VyUmVzdWx0O1xuICAgIH0gZWxzZSBpZiAoc2VydmVyUmVzdWx0LnN1Y2Nlc3MgPT09IGZhbHNlKSB7XG4gICAgICByZXR1cm4gc2VydmVyUmVzdWx0O1xuICAgIH1cblxuICAgIHNwaW5uZXIgPSBuZXcgU3Bpbm5lcigpO1xuICAgIHNwaW5uZXIuc3RhcnQoJ0dlbmVyYXRpbmcgYXBwbGljYXRpb24gc2hlbGwuLi4nKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBfcmVuZGVyVW5pdmVyc2FsKG9wdGlvbnMsIGNvbnRleHQsIGJyb3dzZXJSZXN1bHQsIHNlcnZlclJlc3VsdCwgc3Bpbm5lcik7XG4gICAgc3Bpbm5lci5zdWNjZWVkKCdBcHBsaWNhdGlvbiBzaGVsbCBnZW5lcmF0aW9uIGNvbXBsZXRlLicpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgc3Bpbm5lcj8uZmFpbCgnQXBwbGljYXRpb24gc2hlbGwgZ2VuZXJhdGlvbiBmYWlsZWQuJyk7XG4gICAgYXNzZXJ0SXNFcnJvcihlcnIpO1xuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xuICB9IGZpbmFsbHkge1xuICAgIGF3YWl0IFByb21pc2UuYWxsKFticm93c2VyVGFyZ2V0UnVuLnN0b3AoKSwgc2VydmVyVGFyZ2V0UnVuLnN0b3AoKV0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXIoX2FwcFNoZWxsQnVpbGRlcik7XG4iXX0=