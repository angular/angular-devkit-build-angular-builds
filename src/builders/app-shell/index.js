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
Object.defineProperty(exports, "__esModule", { value: true });
const architect_1 = require("@angular-devkit/architect");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const utils_1 = require("../../utils");
const inline_critical_css_1 = require("../../utils/index-file/inline-critical-css");
const service_worker_1 = require("../../utils/service-worker");
const spinner_1 = require("../../utils/spinner");
async function _renderUniversal(options, context, browserResult, serverResult, spinner) {
    var _a;
    // Get browser target options.
    const browserTarget = (0, architect_1.targetFromTargetString)(options.browserTarget);
    const rawBrowserOptions = (await context.getTargetOptions(browserTarget));
    const browserBuilderName = await context.getBuilderNameForTarget(browserTarget);
    const browserOptions = await context.validateOptions(rawBrowserOptions, browserBuilderName);
    // Initialize zone.js
    const root = context.workspaceRoot;
    const zonePackage = require.resolve('zone.js', { paths: [root] });
    await Promise.resolve().then(() => __importStar(require(zonePackage)));
    const projectName = context.target && context.target.project;
    if (!projectName) {
        throw new Error('The builder requires a target.');
    }
    const projectMetadata = await context.getProjectMetadata(projectName);
    const projectRoot = path.join(root, (_a = projectMetadata.root) !== null && _a !== void 0 ? _a : '');
    const { styles } = (0, utils_1.normalizeOptimization)(browserOptions.optimization);
    const inlineCriticalCssProcessor = styles.inlineCritical
        ? new inline_critical_css_1.InlineCriticalCssProcessor({
            minify: styles.minify,
            deployUrl: browserOptions.deployUrl,
        })
        : undefined;
    for (const outputPath of browserResult.outputPaths) {
        const localeDirectory = path.relative(browserResult.baseOutputPath, outputPath);
        const browserIndexOutputPath = path.join(outputPath, 'index.html');
        const indexHtml = await fs.promises.readFile(browserIndexOutputPath, 'utf8');
        const serverBundlePath = await _getServerModuleBundlePath(options, context, serverResult, localeDirectory);
        const { AppServerModule, renderModule } = await Promise.resolve().then(() => __importStar(require(serverBundlePath)));
        const renderModuleFn = renderModule;
        if (!(renderModuleFn && AppServerModule)) {
            throw new Error(`renderModule method and/or AppServerModule were not exported from: ${serverBundlePath}.`);
        }
        // Load platform server module renderer
        const renderOpts = {
            document: indexHtml,
            url: options.route,
        };
        let html = await renderModuleFn(AppServerModule, renderOpts);
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
            await (0, service_worker_1.augmentAppWithServiceWorker)(projectRoot, outputPath, browserOptions.baseHref || '/', browserOptions.ngswConfigPath);
        }
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
        spinner === null || spinner === void 0 ? void 0 : spinner.fail('Application shell generation failed.');
        return { success: false, error: err.message };
    }
    finally {
        await Promise.all([browserTargetRun.stop(), serverTargetRun.stop()]);
    }
}
exports.default = (0, architect_1.createBuilder)(_appShellBuilder);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9hcHAtc2hlbGwvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUttQztBQUVuQyx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLHVDQUFvRDtBQUNwRCxvRkFBd0Y7QUFDeEYsK0RBQXlFO0FBQ3pFLGlEQUE4QztBQU05QyxLQUFLLFVBQVUsZ0JBQWdCLENBQzdCLE9BQW1DLEVBQ25DLE9BQXVCLEVBQ3ZCLGFBQW1DLEVBQ25DLFlBQWlDLEVBQ2pDLE9BQWdCOztJQUVoQiw4QkFBOEI7SUFDOUIsTUFBTSxhQUFhLEdBQUcsSUFBQSxrQ0FBc0IsRUFBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDcEUsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxDQUNsRCxDQUFDO0lBQ3ZCLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxPQUFPLENBQUMsdUJBQXVCLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDaEYsTUFBTSxjQUFjLEdBQUcsTUFBTSxPQUFPLENBQUMsZUFBZSxDQUNsRCxpQkFBaUIsRUFDakIsa0JBQWtCLENBQ25CLENBQUM7SUFFRixxQkFBcUI7SUFDckIsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUNuQyxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNsRSx3REFBYSxXQUFXLEdBQUMsQ0FBQztJQUUxQixNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFB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Q0FBQyxPQUFPLEtBQUssS0FBSyxJQUFJLGFBQWEsQ0FBQyxjQUFjLEtBQUssU0FBUyxFQUFFO1lBQ2pGLE9BQU8sYUFBYSxDQUFDO1NBQ3RCO2FBQU0sSUFBSSxZQUFZLENBQUMsT0FBTyxLQUFLLEtBQUssRUFBRTtZQUN6QyxPQUFPLFlBQVksQ0FBQztTQUNyQjtRQUVELE9BQU8sR0FBRyxJQUFJLGlCQUFPLEVBQUUsQ0FBQztRQUN4QixPQUFPLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7UUFDakQsTUFBTSxNQUFNLEdBQUcsTUFBTSxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDOUYsT0FBTyxDQUFDLE9BQU8sQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDO1FBRTFELE9BQU8sTUFBTSxDQUFDO0tBQ2Y7SUFBQyxPQUFPLEdBQUcsRUFBRTtRQUNaLE9BQU8sYUFBUCxPQUFPLHVCQUFQLE9BQU8sQ0FBRSxJQUFJLENBQUMsc0NBQXNDLENBQUMsQ0FBQztRQUV0RCxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQy9DO1lBQVM7UUFDUixNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsRUFBRSxlQUFlLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQ3RFO0FBQ0gsQ0FBQztBQUVELGtCQUFlLElBQUEseUJBQWEsRUFBQyxnQkFBZ0IsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkZXJDb250ZXh0LFxuICBCdWlsZGVyT3V0cHV0LFxuICBjcmVhdGVCdWlsZGVyLFxuICB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IEpzb25PYmplY3QgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgbm9ybWFsaXplT3B0aW1pemF0aW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2lubGluZS1jcml0aWNhbC1jc3MnO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2VydmljZS13b3JrZXInO1xuaW1wb3J0IHsgU3Bpbm5lciB9IGZyb20gJy4uLy4uL3V0aWxzL3NwaW5uZXInO1xuaW1wb3J0IHsgQnJvd3NlckJ1aWxkZXJPdXRwdXQgfSBmcm9tICcuLi9icm93c2VyJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlclNjaGVtYSB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IFNlcnZlckJ1aWxkZXJPdXRwdXQgfSBmcm9tICcuLi9zZXJ2ZXInO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJ1aWxkV2VicGFja0FwcFNoZWxsU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5hc3luYyBmdW5jdGlvbiBfcmVuZGVyVW5pdmVyc2FsKFxuICBvcHRpb25zOiBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIGJyb3dzZXJSZXN1bHQ6IEJyb3dzZXJCdWlsZGVyT3V0cHV0LFxuICBzZXJ2ZXJSZXN1bHQ6IFNlcnZlckJ1aWxkZXJPdXRwdXQsXG4gIHNwaW5uZXI6IFNwaW5uZXIsXG4pOiBQcm9taXNlPEJyb3dzZXJCdWlsZGVyT3V0cHV0PiB7XG4gIC8vIEdldCBicm93c2VyIHRhcmdldCBvcHRpb25zLlxuICBjb25zdCBicm93c2VyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLmJyb3dzZXJUYXJnZXQpO1xuICBjb25zdCByYXdCcm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMoYnJvd3NlclRhcmdldCkpIGFzIEpzb25PYmplY3QgJlxuICAgIEJyb3dzZXJCdWlsZGVyU2NoZW1hO1xuICBjb25zdCBicm93c2VyQnVpbGRlck5hbWUgPSBhd2FpdCBjb250ZXh0LmdldEJ1aWxkZXJOYW1lRm9yVGFyZ2V0KGJyb3dzZXJUYXJnZXQpO1xuICBjb25zdCBicm93c2VyT3B0aW9ucyA9IGF3YWl0IGNvbnRleHQudmFsaWRhdGVPcHRpb25zPEpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlclNjaGVtYT4oXG4gICAgcmF3QnJvd3Nlck9wdGlvbnMsXG4gICAgYnJvd3NlckJ1aWxkZXJOYW1lLFxuICApO1xuXG4gIC8vIEluaXRpYWxpemUgem9uZS5qc1xuICBjb25zdCByb290ID0gY29udGV4dC53b3Jrc3BhY2VSb290O1xuICBjb25zdCB6b25lUGFja2FnZSA9IHJlcXVpcmUucmVzb2x2ZSgnem9uZS5qcycsIHsgcGF0aHM6IFtyb290XSB9KTtcbiAgYXdhaXQgaW1wb3J0KHpvbmVQYWNrYWdlKTtcblxuICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0ICYmIGNvbnRleHQudGFyZ2V0LnByb2plY3Q7XG4gIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0LicpO1xuICB9XG5cbiAgY29uc3QgcHJvamVjdE1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICBjb25zdCBwcm9qZWN0Um9vdCA9IHBhdGguam9pbihyb290LCAocHJvamVjdE1ldGFkYXRhLnJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnJyk7XG5cbiAgY29uc3QgeyBzdHlsZXMgfSA9IG5vcm1hbGl6ZU9wdGltaXphdGlvbihicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24pO1xuICBjb25zdCBpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NvciA9IHN0eWxlcy5pbmxpbmVDcml0aWNhbFxuICAgID8gbmV3IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yKHtcbiAgICAgICAgbWluaWZ5OiBzdHlsZXMubWluaWZ5LFxuICAgICAgICBkZXBsb3lVcmw6IGJyb3dzZXJPcHRpb25zLmRlcGxveVVybCxcbiAgICAgIH0pXG4gICAgOiB1bmRlZmluZWQ7XG5cbiAgZm9yIChjb25zdCBvdXRwdXRQYXRoIG9mIGJyb3dzZXJSZXN1bHQub3V0cHV0UGF0aHMpIHtcbiAgICBjb25zdCBsb2NhbGVEaXJlY3RvcnkgPSBwYXRoLnJlbGF0aXZlKGJyb3dzZXJSZXN1bHQuYmFzZU91dHB1dFBhdGgsIG91dHB1dFBhdGgpO1xuICAgIGNvbnN0IGJyb3dzZXJJbmRleE91dHB1dFBhdGggPSBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgJ2luZGV4Lmh0bWwnKTtcbiAgICBjb25zdCBpbmRleEh0bWwgPSBhd2FpdCBmcy5wcm9taXNlcy5yZWFkRmlsZShicm93c2VySW5kZXhPdXRwdXRQYXRoLCAndXRmOCcpO1xuICAgIGNvbnN0IHNlcnZlckJ1bmRsZVBhdGggPSBhd2FpdCBfZ2V0U2VydmVyTW9kdWxlQnVuZGxlUGF0aChcbiAgICAgIG9wdGlvbnMsXG4gICAgICBjb250ZXh0LFxuICAgICAgc2VydmVyUmVzdWx0LFxuICAgICAgbG9jYWxlRGlyZWN0b3J5LFxuICAgICk7XG5cbiAgICBjb25zdCB7IEFwcFNlcnZlck1vZHVsZSwgcmVuZGVyTW9kdWxlIH0gPSBhd2FpdCBpbXBvcnQoc2VydmVyQnVuZGxlUGF0aCk7XG5cbiAgICBjb25zdCByZW5kZXJNb2R1bGVGbjogKChtb2R1bGU6IHVua25vd24sIG9wdGlvbnM6IHt9KSA9PiBQcm9taXNlPHN0cmluZz4pIHwgdW5kZWZpbmVkID1cbiAgICAgIHJlbmRlck1vZHVsZTtcblxuICAgIGlmICghKHJlbmRlck1vZHVsZUZuICYmIEFwcFNlcnZlck1vZHVsZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYHJlbmRlck1vZHVsZSBtZXRob2QgYW5kL29yIEFwcFNlcnZlck1vZHVsZSB3ZXJlIG5vdCBleHBvcnRlZCBmcm9tOiAke3NlcnZlckJ1bmRsZVBhdGh9LmAsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIExvYWQgcGxhdGZvcm0gc2VydmVyIG1vZHVsZSByZW5kZXJlclxuICAgIGNvbnN0IHJlbmRlck9wdHMgPSB7XG4gICAgICBkb2N1bWVudDogaW5kZXhIdG1sLFxuICAgICAgdXJsOiBvcHRpb25zLnJvdXRlLFxuICAgIH07XG5cbiAgICBsZXQgaHRtbCA9IGF3YWl0IHJlbmRlck1vZHVsZUZuKEFwcFNlcnZlck1vZHVsZSwgcmVuZGVyT3B0cyk7XG4gICAgLy8gT3ZlcndyaXRlIHRoZSBjbGllbnQgaW5kZXggZmlsZS5cbiAgICBjb25zdCBvdXRwdXRJbmRleFBhdGggPSBvcHRpb25zLm91dHB1dEluZGV4UGF0aFxuICAgICAgPyBwYXRoLmpvaW4ocm9vdCwgb3B0aW9ucy5vdXRwdXRJbmRleFBhdGgpXG4gICAgICA6IGJyb3dzZXJJbmRleE91dHB1dFBhdGg7XG5cbiAgICBpZiAoaW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IpIHtcbiAgICAgIGNvbnN0IHsgY29udGVudCwgd2FybmluZ3MsIGVycm9ycyB9ID0gYXdhaXQgaW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IucHJvY2VzcyhodG1sLCB7XG4gICAgICAgIG91dHB1dFBhdGgsXG4gICAgICB9KTtcbiAgICAgIGh0bWwgPSBjb250ZW50O1xuXG4gICAgICBpZiAod2FybmluZ3MubGVuZ3RoIHx8IGVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgc3Bpbm5lci5zdG9wKCk7XG4gICAgICAgIHdhcm5pbmdzLmZvckVhY2goKG0pID0+IGNvbnRleHQubG9nZ2VyLndhcm4obSkpO1xuICAgICAgICBlcnJvcnMuZm9yRWFjaCgobSkgPT4gY29udGV4dC5sb2dnZXIuZXJyb3IobSkpO1xuICAgICAgICBzcGlubmVyLnN0YXJ0KCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgYXdhaXQgZnMucHJvbWlzZXMud3JpdGVGaWxlKG91dHB1dEluZGV4UGF0aCwgaHRtbCk7XG5cbiAgICBpZiAoYnJvd3Nlck9wdGlvbnMuc2VydmljZVdvcmtlcikge1xuICAgICAgYXdhaXQgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyKFxuICAgICAgICBwcm9qZWN0Um9vdCxcbiAgICAgICAgb3V0cHV0UGF0aCxcbiAgICAgICAgYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYgfHwgJy8nLFxuICAgICAgICBicm93c2VyT3B0aW9ucy5uZ3N3Q29uZmlnUGF0aCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJyb3dzZXJSZXN1bHQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9nZXRTZXJ2ZXJNb2R1bGVCdW5kbGVQYXRoKFxuICBvcHRpb25zOiBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHNlcnZlclJlc3VsdDogU2VydmVyQnVpbGRlck91dHB1dCxcbiAgYnJvd3NlckxvY2FsZURpcmVjdG9yeTogc3RyaW5nLFxuKSB7XG4gIGlmIChvcHRpb25zLmFwcE1vZHVsZUJ1bmRsZSkge1xuICAgIHJldHVybiBwYXRoLmpvaW4oY29udGV4dC53b3Jrc3BhY2VSb290LCBvcHRpb25zLmFwcE1vZHVsZUJ1bmRsZSk7XG4gIH1cblxuICBjb25zdCB7IGJhc2VPdXRwdXRQYXRoID0gJycgfSA9IHNlcnZlclJlc3VsdDtcbiAgY29uc3Qgb3V0cHV0UGF0aCA9IHBhdGguam9pbihiYXNlT3V0cHV0UGF0aCwgYnJvd3NlckxvY2FsZURpcmVjdG9yeSk7XG5cbiAgaWYgKCFmcy5leGlzdHNTeW5jKG91dHB1dFBhdGgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCBzZXJ2ZXIgb3V0cHV0IGRpcmVjdG9yeTogJHtvdXRwdXRQYXRofS5gKTtcbiAgfVxuXG4gIGNvbnN0IHJlID0gL15tYWluXFwuKD86W2EtekEtWjAtOV17MTZ9XFwuKT9qcyQvO1xuICBjb25zdCBtYXliZU1haW4gPSBmcy5yZWFkZGlyU3luYyhvdXRwdXRQYXRoKS5maW5kKCh4KSA9PiByZS50ZXN0KHgpKTtcblxuICBpZiAoIW1heWJlTWFpbikge1xuICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgdGhlIG1haW4gYnVuZGxlLicpO1xuICB9XG5cbiAgcmV0dXJuIHBhdGguam9pbihvdXRwdXRQYXRoLCBtYXliZU1haW4pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfYXBwU2hlbGxCdWlsZGVyKFxuICBvcHRpb25zOiBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3QgYnJvd3NlclRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5icm93c2VyVGFyZ2V0KTtcbiAgY29uc3Qgc2VydmVyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLnNlcnZlclRhcmdldCk7XG5cbiAgLy8gTmV2ZXIgcnVuIHRoZSBicm93c2VyIHRhcmdldCBpbiB3YXRjaCBtb2RlLlxuICAvLyBJZiBzZXJ2aWNlIHdvcmtlciBpcyBuZWVkZWQsIGl0IHdpbGwgYmUgYWRkZWQgaW4gX3JlbmRlclVuaXZlcnNhbCgpO1xuICBjb25zdCBicm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMoYnJvd3NlclRhcmdldCkpIGFzIEpzb25PYmplY3QgJlxuICAgIEJyb3dzZXJCdWlsZGVyU2NoZW1hO1xuXG4gIGNvbnN0IG9wdGltaXphdGlvbiA9IG5vcm1hbGl6ZU9wdGltaXphdGlvbihicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24pO1xuICBvcHRpbWl6YXRpb24uc3R5bGVzLmlubGluZUNyaXRpY2FsID0gZmFsc2U7XG5cbiAgY29uc3QgYnJvd3NlclRhcmdldFJ1biA9IGF3YWl0IGNvbnRleHQuc2NoZWR1bGVUYXJnZXQoYnJvd3NlclRhcmdldCwge1xuICAgIHdhdGNoOiBmYWxzZSxcbiAgICBzZXJ2aWNlV29ya2VyOiBmYWxzZSxcbiAgICBvcHRpbWl6YXRpb246IG9wdGltaXphdGlvbiBhcyB1bmtub3duIGFzIEpzb25PYmplY3QsXG4gIH0pO1xuICBjb25zdCBzZXJ2ZXJUYXJnZXRSdW4gPSBhd2FpdCBjb250ZXh0LnNjaGVkdWxlVGFyZ2V0KHNlcnZlclRhcmdldCwge1xuICAgIHdhdGNoOiBmYWxzZSxcbiAgfSk7XG5cbiAgbGV0IHNwaW5uZXI6IFNwaW5uZXIgfCB1bmRlZmluZWQ7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBbYnJvd3NlclJlc3VsdCwgc2VydmVyUmVzdWx0XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGJyb3dzZXJUYXJnZXRSdW4ucmVzdWx0IGFzIFByb21pc2U8QnJvd3NlckJ1aWxkZXJPdXRwdXQ+LFxuICAgICAgc2VydmVyVGFyZ2V0UnVuLnJlc3VsdCBhcyBQcm9taXNlPFNlcnZlckJ1aWxkZXJPdXRwdXQ+LFxuICAgIF0pO1xuXG4gICAgaWYgKGJyb3dzZXJSZXN1bHQuc3VjY2VzcyA9PT0gZmFsc2UgfHwgYnJvd3NlclJlc3VsdC5iYXNlT3V0cHV0UGF0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gYnJvd3NlclJlc3VsdDtcbiAgICB9IGVsc2UgaWYgKHNlcnZlclJlc3VsdC5zdWNjZXNzID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuIHNlcnZlclJlc3VsdDtcbiAgICB9XG5cbiAgICBzcGlubmVyID0gbmV3IFNwaW5uZXIoKTtcbiAgICBzcGlubmVyLnN0YXJ0KCdHZW5lcmF0aW5nIGFwcGxpY2F0aW9uIHNoZWxsLi4uJyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgX3JlbmRlclVuaXZlcnNhbChvcHRpb25zLCBjb250ZXh0LCBicm93c2VyUmVzdWx0LCBzZXJ2ZXJSZXN1bHQsIHNwaW5uZXIpO1xuICAgIHNwaW5uZXIuc3VjY2VlZCgnQXBwbGljYXRpb24gc2hlbGwgZ2VuZXJhdGlvbiBjb21wbGV0ZS4nKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHNwaW5uZXI/LmZhaWwoJ0FwcGxpY2F0aW9uIHNoZWxsIGdlbmVyYXRpb24gZmFpbGVkLicpO1xuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xuICB9IGZpbmFsbHkge1xuICAgIGF3YWl0IFByb21pc2UuYWxsKFticm93c2VyVGFyZ2V0UnVuLnN0b3AoKSwgc2VydmVyVGFyZ2V0UnVuLnN0b3AoKV0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXIoX2FwcFNoZWxsQnVpbGRlcik7XG4iXX0=