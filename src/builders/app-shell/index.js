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
const core_1 = require("@angular-devkit/core");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const utils_1 = require("../../utils");
const inline_critical_css_1 = require("../../utils/index-file/inline-critical-css");
const service_worker_1 = require("../../utils/service-worker");
const spinner_1 = require("../../utils/spinner");
async function _renderUniversal(options, context, browserResult, serverResult, spinner) {
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
    const projectRoot = (0, core_1.resolve)((0, core_1.normalize)(root), (0, core_1.normalize)(projectMetadata.root || ''));
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
            await (0, service_worker_1.augmentAppWithServiceWorker)(projectRoot, context.workspaceRoot, (0, core_1.normalize)(outputPath), browserOptions.baseHref || '/', browserOptions.ngswConfigPath);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9hcHAtc2hlbGwvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUttQztBQUNuQywrQ0FBc0U7QUFDdEUsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUM3Qix1Q0FBb0Q7QUFDcEQsb0ZBQXdGO0FBQ3hGLCtEQUF5RTtBQUN6RSxpREFBOEM7QUFNOUMsS0FBSyxVQUFVLGdCQUFnQixDQUM3QixPQUFtQyxFQUNuQyxPQUF1QixFQUN2QixhQUFtQyxFQUNuQyxZQUFpQyxFQUNqQyxPQUFnQjtJQUVoQiw4QkFBOEI7SUFDOUIsTUFBTSxhQUFhLEdBQUcsSUFBQSxrQ0FBc0IsRUFBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDcEUsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxDQUNsRCxDQUFDO0lBQ3ZCLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxPQUFPLENBQUMsdUJBQXVCLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDaEYsTUFBTSxjQUFjLEdBQUcsTUFBTSxPQUFPLENBQUMsZUFBZSxDQUNsRCxpQkFBaUIsRUFDakIsa0JBQWtCLENBQ25CLENBQUM7SUFFRixxQkFBcUI7SUFDckIsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUNuQyxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNsRSx3REFBYSxXQUFXLEdBQUMsQ0FBQztJQUUxQixNQUFNLFdBQVcsR0FBRyxP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QUcsQ0FBQztZQUN0RCxnQkFBZ0IsQ0FBQyxNQUF1QztZQUN4RCxlQUFlLENBQUMsTUFBc0M7U0FDdkQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxhQUFhLENBQUMsT0FBTyxLQUFLLEtBQUssSUFBSSxhQUFhLENBQUMsY0FBYyxLQUFLLFNBQVMsRUFBRTtZQUNqRixPQUFPLGFBQWEsQ0FBQztTQUN0QjthQUFNLElBQUksWUFBWSxDQUFDLE9BQU8sS0FBSyxLQUFLLEVBQUU7WUFDekMsT0FBTyxZQUFZLENBQUM7U0FDckI7UUFFRCxPQUFPLEdBQUcsSUFBSSxpQkFBTyxFQUFFLENBQUM7UUFDeEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1FBQ2pELE1BQU0sTUFBTSxHQUFHLE1BQU0sZ0JBQWdCLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzlGLE9BQU8sQ0FBQyxPQUFPLENBQUMsd0NBQXdDLENBQUMsQ0FBQztRQUUxRCxPQUFPLE1BQU0sQ0FBQztLQUNmO0lBQUMsT0FBTyxHQUFHLEVBQUU7UUFDWixPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsSUFBSSxDQUFDLHNDQUFzQyxDQUFDLENBQUM7UUFFdEQsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztLQUMvQztZQUFTO1FBQ1IsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLEVBQUUsZUFBZSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztLQUN0RTtBQUNILENBQUM7QUFFRCxrQkFBZSxJQUFBLHlCQUFhLEVBQUMsZ0JBQWdCLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZGVyQ29udGV4dCxcbiAgQnVpbGRlck91dHB1dCxcbiAgY3JlYXRlQnVpbGRlcixcbiAgdGFyZ2V0RnJvbVRhcmdldFN0cmluZyxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBKc29uT2JqZWN0LCBub3JtYWxpemUsIHJlc29sdmUgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgbm9ybWFsaXplT3B0aW1pemF0aW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2lubGluZS1jcml0aWNhbC1jc3MnO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2VydmljZS13b3JrZXInO1xuaW1wb3J0IHsgU3Bpbm5lciB9IGZyb20gJy4uLy4uL3V0aWxzL3NwaW5uZXInO1xuaW1wb3J0IHsgQnJvd3NlckJ1aWxkZXJPdXRwdXQgfSBmcm9tICcuLi9icm93c2VyJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlclNjaGVtYSB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IFNlcnZlckJ1aWxkZXJPdXRwdXQgfSBmcm9tICcuLi9zZXJ2ZXInO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJ1aWxkV2VicGFja0FwcFNoZWxsU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5hc3luYyBmdW5jdGlvbiBfcmVuZGVyVW5pdmVyc2FsKFxuICBvcHRpb25zOiBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIGJyb3dzZXJSZXN1bHQ6IEJyb3dzZXJCdWlsZGVyT3V0cHV0LFxuICBzZXJ2ZXJSZXN1bHQ6IFNlcnZlckJ1aWxkZXJPdXRwdXQsXG4gIHNwaW5uZXI6IFNwaW5uZXIsXG4pOiBQcm9taXNlPEJyb3dzZXJCdWlsZGVyT3V0cHV0PiB7XG4gIC8vIEdldCBicm93c2VyIHRhcmdldCBvcHRpb25zLlxuICBjb25zdCBicm93c2VyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLmJyb3dzZXJUYXJnZXQpO1xuICBjb25zdCByYXdCcm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMoYnJvd3NlclRhcmdldCkpIGFzIEpzb25PYmplY3QgJlxuICAgIEJyb3dzZXJCdWlsZGVyU2NoZW1hO1xuICBjb25zdCBicm93c2VyQnVpbGRlck5hbWUgPSBhd2FpdCBjb250ZXh0LmdldEJ1aWxkZXJOYW1lRm9yVGFyZ2V0KGJyb3dzZXJUYXJnZXQpO1xuICBjb25zdCBicm93c2VyT3B0aW9ucyA9IGF3YWl0IGNvbnRleHQudmFsaWRhdGVPcHRpb25zPEpzb25PYmplY3QgJiBCcm93c2VyQnVpbGRlclNjaGVtYT4oXG4gICAgcmF3QnJvd3Nlck9wdGlvbnMsXG4gICAgYnJvd3NlckJ1aWxkZXJOYW1lLFxuICApO1xuXG4gIC8vIEluaXRpYWxpemUgem9uZS5qc1xuICBjb25zdCByb290ID0gY29udGV4dC53b3Jrc3BhY2VSb290O1xuICBjb25zdCB6b25lUGFja2FnZSA9IHJlcXVpcmUucmVzb2x2ZSgnem9uZS5qcycsIHsgcGF0aHM6IFtyb290XSB9KTtcbiAgYXdhaXQgaW1wb3J0KHpvbmVQYWNrYWdlKTtcblxuICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0ICYmIGNvbnRleHQudGFyZ2V0LnByb2plY3Q7XG4gIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0LicpO1xuICB9XG5cbiAgY29uc3QgcHJvamVjdE1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICBjb25zdCBwcm9qZWN0Um9vdCA9IHJlc29sdmUobm9ybWFsaXplKHJvb3QpLCBub3JtYWxpemUoKHByb2plY3RNZXRhZGF0YS5yb290IGFzIHN0cmluZykgfHwgJycpKTtcblxuICBjb25zdCB7IHN0eWxlcyB9ID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbik7XG4gIGNvbnN0IGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yID0gc3R5bGVzLmlubGluZUNyaXRpY2FsXG4gICAgPyBuZXcgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3Ioe1xuICAgICAgICBtaW5pZnk6IHN0eWxlcy5taW5pZnksXG4gICAgICAgIGRlcGxveVVybDogYnJvd3Nlck9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgfSlcbiAgICA6IHVuZGVmaW5lZDtcblxuICBmb3IgKGNvbnN0IG91dHB1dFBhdGggb2YgYnJvd3NlclJlc3VsdC5vdXRwdXRQYXRocykge1xuICAgIGNvbnN0IGxvY2FsZURpcmVjdG9yeSA9IHBhdGgucmVsYXRpdmUoYnJvd3NlclJlc3VsdC5iYXNlT3V0cHV0UGF0aCwgb3V0cHV0UGF0aCk7XG4gICAgY29uc3QgYnJvd3NlckluZGV4T3V0cHV0UGF0aCA9IHBhdGguam9pbihvdXRwdXRQYXRoLCAnaW5kZXguaHRtbCcpO1xuICAgIGNvbnN0IGluZGV4SHRtbCA9IGF3YWl0IGZzLnByb21pc2VzLnJlYWRGaWxlKGJyb3dzZXJJbmRleE91dHB1dFBhdGgsICd1dGY4Jyk7XG4gICAgY29uc3Qgc2VydmVyQnVuZGxlUGF0aCA9IGF3YWl0IF9nZXRTZXJ2ZXJNb2R1bGVCdW5kbGVQYXRoKFxuICAgICAgb3B0aW9ucyxcbiAgICAgIGNvbnRleHQsXG4gICAgICBzZXJ2ZXJSZXN1bHQsXG4gICAgICBsb2NhbGVEaXJlY3RvcnksXG4gICAgKTtcblxuICAgIGNvbnN0IHsgQXBwU2VydmVyTW9kdWxlLCByZW5kZXJNb2R1bGUgfSA9IGF3YWl0IGltcG9ydChzZXJ2ZXJCdW5kbGVQYXRoKTtcblxuICAgIGNvbnN0IHJlbmRlck1vZHVsZUZuOiAoKG1vZHVsZTogdW5rbm93biwgb3B0aW9uczoge30pID0+IFByb21pc2U8c3RyaW5nPikgfCB1bmRlZmluZWQgPVxuICAgICAgcmVuZGVyTW9kdWxlO1xuXG4gICAgaWYgKCEocmVuZGVyTW9kdWxlRm4gJiYgQXBwU2VydmVyTW9kdWxlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgcmVuZGVyTW9kdWxlIG1ldGhvZCBhbmQvb3IgQXBwU2VydmVyTW9kdWxlIHdlcmUgbm90IGV4cG9ydGVkIGZyb206ICR7c2VydmVyQnVuZGxlUGF0aH0uYCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gTG9hZCBwbGF0Zm9ybSBzZXJ2ZXIgbW9kdWxlIHJlbmRlcmVyXG4gICAgY29uc3QgcmVuZGVyT3B0cyA9IHtcbiAgICAgIGRvY3VtZW50OiBpbmRleEh0bWwsXG4gICAgICB1cmw6IG9wdGlvbnMucm91dGUsXG4gICAgfTtcblxuICAgIGxldCBodG1sID0gYXdhaXQgcmVuZGVyTW9kdWxlRm4oQXBwU2VydmVyTW9kdWxlLCByZW5kZXJPcHRzKTtcbiAgICAvLyBPdmVyd3JpdGUgdGhlIGNsaWVudCBpbmRleCBmaWxlLlxuICAgIGNvbnN0IG91dHB1dEluZGV4UGF0aCA9IG9wdGlvbnMub3V0cHV0SW5kZXhQYXRoXG4gICAgICA/IHBhdGguam9pbihyb290LCBvcHRpb25zLm91dHB1dEluZGV4UGF0aClcbiAgICAgIDogYnJvd3NlckluZGV4T3V0cHV0UGF0aDtcblxuICAgIGlmIChpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvcikge1xuICAgICAgY29uc3QgeyBjb250ZW50LCB3YXJuaW5ncywgZXJyb3JzIH0gPSBhd2FpdCBpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvci5wcm9jZXNzKGh0bWwsIHtcbiAgICAgICAgb3V0cHV0UGF0aCxcbiAgICAgIH0pO1xuICAgICAgaHRtbCA9IGNvbnRlbnQ7XG5cbiAgICAgIGlmICh3YXJuaW5ncy5sZW5ndGggfHwgZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICBzcGlubmVyLnN0b3AoKTtcbiAgICAgICAgd2FybmluZ3MuZm9yRWFjaCgobSkgPT4gY29udGV4dC5sb2dnZXIud2FybihtKSk7XG4gICAgICAgIGVycm9ycy5mb3JFYWNoKChtKSA9PiBjb250ZXh0LmxvZ2dlci5lcnJvcihtKSk7XG4gICAgICAgIHNwaW5uZXIuc3RhcnQoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhd2FpdCBmcy5wcm9taXNlcy53cml0ZUZpbGUob3V0cHV0SW5kZXhQYXRoLCBodG1sKTtcblxuICAgIGlmIChicm93c2VyT3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgICBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIoXG4gICAgICAgIHByb2plY3RSb290LFxuICAgICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICAgIG5vcm1hbGl6ZShvdXRwdXRQYXRoKSxcbiAgICAgICAgYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYgfHwgJy8nLFxuICAgICAgICBicm93c2VyT3B0aW9ucy5uZ3N3Q29uZmlnUGF0aCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJyb3dzZXJSZXN1bHQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9nZXRTZXJ2ZXJNb2R1bGVCdW5kbGVQYXRoKFxuICBvcHRpb25zOiBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHNlcnZlclJlc3VsdDogU2VydmVyQnVpbGRlck91dHB1dCxcbiAgYnJvd3NlckxvY2FsZURpcmVjdG9yeTogc3RyaW5nLFxuKSB7XG4gIGlmIChvcHRpb25zLmFwcE1vZHVsZUJ1bmRsZSkge1xuICAgIHJldHVybiBwYXRoLmpvaW4oY29udGV4dC53b3Jrc3BhY2VSb290LCBvcHRpb25zLmFwcE1vZHVsZUJ1bmRsZSk7XG4gIH1cblxuICBjb25zdCB7IGJhc2VPdXRwdXRQYXRoID0gJycgfSA9IHNlcnZlclJlc3VsdDtcbiAgY29uc3Qgb3V0cHV0UGF0aCA9IHBhdGguam9pbihiYXNlT3V0cHV0UGF0aCwgYnJvd3NlckxvY2FsZURpcmVjdG9yeSk7XG5cbiAgaWYgKCFmcy5leGlzdHNTeW5jKG91dHB1dFBhdGgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCBzZXJ2ZXIgb3V0cHV0IGRpcmVjdG9yeTogJHtvdXRwdXRQYXRofS5gKTtcbiAgfVxuXG4gIGNvbnN0IHJlID0gL15tYWluXFwuKD86W2EtekEtWjAtOV17MTZ9XFwuKT9qcyQvO1xuICBjb25zdCBtYXliZU1haW4gPSBmcy5yZWFkZGlyU3luYyhvdXRwdXRQYXRoKS5maW5kKCh4KSA9PiByZS50ZXN0KHgpKTtcblxuICBpZiAoIW1heWJlTWFpbikge1xuICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgdGhlIG1haW4gYnVuZGxlLicpO1xuICB9XG5cbiAgcmV0dXJuIHBhdGguam9pbihvdXRwdXRQYXRoLCBtYXliZU1haW4pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfYXBwU2hlbGxCdWlsZGVyKFxuICBvcHRpb25zOiBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3QgYnJvd3NlclRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5icm93c2VyVGFyZ2V0KTtcbiAgY29uc3Qgc2VydmVyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLnNlcnZlclRhcmdldCk7XG5cbiAgLy8gTmV2ZXIgcnVuIHRoZSBicm93c2VyIHRhcmdldCBpbiB3YXRjaCBtb2RlLlxuICAvLyBJZiBzZXJ2aWNlIHdvcmtlciBpcyBuZWVkZWQsIGl0IHdpbGwgYmUgYWRkZWQgaW4gX3JlbmRlclVuaXZlcnNhbCgpO1xuICBjb25zdCBicm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMoYnJvd3NlclRhcmdldCkpIGFzIEpzb25PYmplY3QgJlxuICAgIEJyb3dzZXJCdWlsZGVyU2NoZW1hO1xuXG4gIGNvbnN0IG9wdGltaXphdGlvbiA9IG5vcm1hbGl6ZU9wdGltaXphdGlvbihicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24pO1xuICBvcHRpbWl6YXRpb24uc3R5bGVzLmlubGluZUNyaXRpY2FsID0gZmFsc2U7XG5cbiAgY29uc3QgYnJvd3NlclRhcmdldFJ1biA9IGF3YWl0IGNvbnRleHQuc2NoZWR1bGVUYXJnZXQoYnJvd3NlclRhcmdldCwge1xuICAgIHdhdGNoOiBmYWxzZSxcbiAgICBzZXJ2aWNlV29ya2VyOiBmYWxzZSxcbiAgICBvcHRpbWl6YXRpb246IG9wdGltaXphdGlvbiBhcyB1bmtub3duIGFzIEpzb25PYmplY3QsXG4gIH0pO1xuICBjb25zdCBzZXJ2ZXJUYXJnZXRSdW4gPSBhd2FpdCBjb250ZXh0LnNjaGVkdWxlVGFyZ2V0KHNlcnZlclRhcmdldCwge1xuICAgIHdhdGNoOiBmYWxzZSxcbiAgfSk7XG5cbiAgbGV0IHNwaW5uZXI6IFNwaW5uZXIgfCB1bmRlZmluZWQ7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBbYnJvd3NlclJlc3VsdCwgc2VydmVyUmVzdWx0XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGJyb3dzZXJUYXJnZXRSdW4ucmVzdWx0IGFzIFByb21pc2U8QnJvd3NlckJ1aWxkZXJPdXRwdXQ+LFxuICAgICAgc2VydmVyVGFyZ2V0UnVuLnJlc3VsdCBhcyBQcm9taXNlPFNlcnZlckJ1aWxkZXJPdXRwdXQ+LFxuICAgIF0pO1xuXG4gICAgaWYgKGJyb3dzZXJSZXN1bHQuc3VjY2VzcyA9PT0gZmFsc2UgfHwgYnJvd3NlclJlc3VsdC5iYXNlT3V0cHV0UGF0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gYnJvd3NlclJlc3VsdDtcbiAgICB9IGVsc2UgaWYgKHNlcnZlclJlc3VsdC5zdWNjZXNzID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuIHNlcnZlclJlc3VsdDtcbiAgICB9XG5cbiAgICBzcGlubmVyID0gbmV3IFNwaW5uZXIoKTtcbiAgICBzcGlubmVyLnN0YXJ0KCdHZW5lcmF0aW5nIGFwcGxpY2F0aW9uIHNoZWxsLi4uJyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgX3JlbmRlclVuaXZlcnNhbChvcHRpb25zLCBjb250ZXh0LCBicm93c2VyUmVzdWx0LCBzZXJ2ZXJSZXN1bHQsIHNwaW5uZXIpO1xuICAgIHNwaW5uZXIuc3VjY2VlZCgnQXBwbGljYXRpb24gc2hlbGwgZ2VuZXJhdGlvbiBjb21wbGV0ZS4nKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHNwaW5uZXI/LmZhaWwoJ0FwcGxpY2F0aW9uIHNoZWxsIGdlbmVyYXRpb24gZmFpbGVkLicpO1xuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xuICB9IGZpbmFsbHkge1xuICAgIGF3YWl0IFByb21pc2UuYWxsKFticm93c2VyVGFyZ2V0UnVuLnN0b3AoKSwgc2VydmVyVGFyZ2V0UnVuLnN0b3AoKV0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXIoX2FwcFNoZWxsQnVpbGRlcik7XG4iXX0=