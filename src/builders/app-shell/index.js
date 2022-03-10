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
            await (0, service_worker_1.augmentAppWithServiceWorker)((0, core_1.normalize)(projectRoot), (0, core_1.normalize)(outputPath), browserOptions.baseHref || '/', browserOptions.ngswConfigPath);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9hcHAtc2hlbGwvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUttQztBQUNuQywrQ0FBNkQ7QUFDN0QsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUM3Qix1Q0FBb0Q7QUFDcEQsb0ZBQXdGO0FBQ3hGLCtEQUF5RTtBQUN6RSxpREFBOEM7QUFNOUMsS0FBSyxVQUFVLGdCQUFnQixDQUM3QixPQUFtQyxFQUNuQyxPQUF1QixFQUN2QixhQUFtQyxFQUNuQyxZQUFpQyxFQUNqQyxPQUFnQjs7SUFFaEIsOEJBQThCO0lBQzlCLE1BQU0sYUFBYSxHQUFHLElBQUEsa0NBQXNCLEVBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3BFLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsQ0FDbEQsQ0FBQztJQUN2QixNQUFNLGtCQUFrQixHQUFHLE1BQU0sT0FBTyxDQUFDLHVCQUF1QixDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ2hGLE1BQU0sY0FBYyxHQUFHLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FDbEQsaUJBQWlCLEVBQ2pCLGtCQUFrQixDQUNuQixDQUFDO0lBRUYscUJBQXFCO0lBQ3JCLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7SUFDbkMsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDbEUsd0RBQWEsV0FBVyxHQUFDLENBQUM7SUFFMUIsTUFBTSxXQUFXLEdBQUcs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QXVDO1lBQ3hELGVBQWUsQ0FBQyxNQUFzQztTQUN2RCxDQUFDLENBQUM7UUFFSCxJQUFJLGFBQWEsQ0FBQyxPQUFPLEtBQUssS0FBSyxJQUFJLGFBQWEsQ0FBQyxjQUFjLEtBQUssU0FBUyxFQUFFO1lBQ2pGLE9BQU8sYUFBYSxDQUFDO1NBQ3RCO2FBQU0sSUFBSSxZQUFZLENBQUMsT0FBTyxLQUFLLEtBQUssRUFBRTtZQUN6QyxPQUFPLFlBQVksQ0FBQztTQUNyQjtRQUVELE9BQU8sR0FBRyxJQUFJLGlCQUFPLEVBQUUsQ0FBQztRQUN4QixPQUFPLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7UUFDakQsTUFBTSxNQUFNLEdBQUcsTUFBTSxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDOUYsT0FBTyxDQUFDLE9BQU8sQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDO1FBRTFELE9BQU8sTUFBTSxDQUFDO0tBQ2Y7SUFBQyxPQUFPLEdBQUcsRUFBRTtRQUNaLE9BQU8sYUFBUCxPQUFPLHVCQUFQLE9BQU8sQ0FBRSxJQUFJLENBQUMsc0NBQXNDLENBQUMsQ0FBQztRQUV0RCxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQy9DO1lBQVM7UUFDUixNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsRUFBRSxlQUFlLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQ3RFO0FBQ0gsQ0FBQztBQUVELGtCQUFlLElBQUEseUJBQWEsRUFBQyxnQkFBZ0IsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkZXJDb250ZXh0LFxuICBCdWlsZGVyT3V0cHV0LFxuICBjcmVhdGVCdWlsZGVyLFxuICB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IEpzb25PYmplY3QsIG5vcm1hbGl6ZSB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBub3JtYWxpemVPcHRpbWl6YXRpb24gfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NvciB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5saW5lLWNyaXRpY2FsLWNzcyc7XG5pbXBvcnQgeyBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIgfSBmcm9tICcuLi8uLi91dGlscy9zZXJ2aWNlLXdvcmtlcic7XG5pbXBvcnQgeyBTcGlubmVyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lcic7XG5pbXBvcnQgeyBCcm93c2VyQnVpbGRlck91dHB1dCB9IGZyb20gJy4uL2Jyb3dzZXInO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyU2NoZW1hIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgU2VydmVyQnVpbGRlck91dHB1dCB9IGZyb20gJy4uL3NlcnZlcic7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmFzeW5jIGZ1bmN0aW9uIF9yZW5kZXJVbml2ZXJzYWwoXG4gIG9wdGlvbnM6IEJ1aWxkV2VicGFja0FwcFNoZWxsU2NoZW1hLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgYnJvd3NlclJlc3VsdDogQnJvd3NlckJ1aWxkZXJPdXRwdXQsXG4gIHNlcnZlclJlc3VsdDogU2VydmVyQnVpbGRlck91dHB1dCxcbiAgc3Bpbm5lcjogU3Bpbm5lcixcbik6IFByb21pc2U8QnJvd3NlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gR2V0IGJyb3dzZXIgdGFyZ2V0IG9wdGlvbnMuXG4gIGNvbnN0IGJyb3dzZXJUYXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuYnJvd3NlclRhcmdldCk7XG4gIGNvbnN0IHJhd0Jyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhicm93c2VyVGFyZ2V0KSkgYXMgSnNvbk9iamVjdCAmXG4gICAgQnJvd3NlckJ1aWxkZXJTY2hlbWE7XG4gIGNvbnN0IGJyb3dzZXJCdWlsZGVyTmFtZSA9IGF3YWl0IGNvbnRleHQuZ2V0QnVpbGRlck5hbWVGb3JUYXJnZXQoYnJvd3NlclRhcmdldCk7XG4gIGNvbnN0IGJyb3dzZXJPcHRpb25zID0gYXdhaXQgY29udGV4dC52YWxpZGF0ZU9wdGlvbnM8SnNvbk9iamVjdCAmIEJyb3dzZXJCdWlsZGVyU2NoZW1hPihcbiAgICByYXdCcm93c2VyT3B0aW9ucyxcbiAgICBicm93c2VyQnVpbGRlck5hbWUsXG4gICk7XG5cbiAgLy8gSW5pdGlhbGl6ZSB6b25lLmpzXG4gIGNvbnN0IHJvb3QgPSBjb250ZXh0LndvcmtzcGFjZVJvb3Q7XG4gIGNvbnN0IHpvbmVQYWNrYWdlID0gcmVxdWlyZS5yZXNvbHZlKCd6b25lLmpzJywgeyBwYXRoczogW3Jvb3RdIH0pO1xuICBhd2FpdCBpbXBvcnQoem9uZVBhY2thZ2UpO1xuXG4gIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQgJiYgY29udGV4dC50YXJnZXQucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVGhlIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQuJyk7XG4gIH1cblxuICBjb25zdCBwcm9qZWN0TWV0YWRhdGEgPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gIGNvbnN0IHByb2plY3RSb290ID0gcGF0aC5qb2luKHJvb3QsIChwcm9qZWN0TWV0YWRhdGEucm9vdCBhcyBzdHJpbmcgfCB1bmRlZmluZWQpID8/ICcnKTtcblxuICBjb25zdCB7IHN0eWxlcyB9ID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbik7XG4gIGNvbnN0IGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yID0gc3R5bGVzLmlubGluZUNyaXRpY2FsXG4gICAgPyBuZXcgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3Ioe1xuICAgICAgICBtaW5pZnk6IHN0eWxlcy5taW5pZnksXG4gICAgICAgIGRlcGxveVVybDogYnJvd3Nlck9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgfSlcbiAgICA6IHVuZGVmaW5lZDtcblxuICBmb3IgKGNvbnN0IG91dHB1dFBhdGggb2YgYnJvd3NlclJlc3VsdC5vdXRwdXRQYXRocykge1xuICAgIGNvbnN0IGxvY2FsZURpcmVjdG9yeSA9IHBhdGgucmVsYXRpdmUoYnJvd3NlclJlc3VsdC5iYXNlT3V0cHV0UGF0aCwgb3V0cHV0UGF0aCk7XG4gICAgY29uc3QgYnJvd3NlckluZGV4T3V0cHV0UGF0aCA9IHBhdGguam9pbihvdXRwdXRQYXRoLCAnaW5kZXguaHRtbCcpO1xuICAgIGNvbnN0IGluZGV4SHRtbCA9IGF3YWl0IGZzLnByb21pc2VzLnJlYWRGaWxlKGJyb3dzZXJJbmRleE91dHB1dFBhdGgsICd1dGY4Jyk7XG4gICAgY29uc3Qgc2VydmVyQnVuZGxlUGF0aCA9IGF3YWl0IF9nZXRTZXJ2ZXJNb2R1bGVCdW5kbGVQYXRoKFxuICAgICAgb3B0aW9ucyxcbiAgICAgIGNvbnRleHQsXG4gICAgICBzZXJ2ZXJSZXN1bHQsXG4gICAgICBsb2NhbGVEaXJlY3RvcnksXG4gICAgKTtcblxuICAgIGNvbnN0IHsgQXBwU2VydmVyTW9kdWxlLCByZW5kZXJNb2R1bGUgfSA9IGF3YWl0IGltcG9ydChzZXJ2ZXJCdW5kbGVQYXRoKTtcblxuICAgIGNvbnN0IHJlbmRlck1vZHVsZUZuOiAoKG1vZHVsZTogdW5rbm93biwgb3B0aW9uczoge30pID0+IFByb21pc2U8c3RyaW5nPikgfCB1bmRlZmluZWQgPVxuICAgICAgcmVuZGVyTW9kdWxlO1xuXG4gICAgaWYgKCEocmVuZGVyTW9kdWxlRm4gJiYgQXBwU2VydmVyTW9kdWxlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgcmVuZGVyTW9kdWxlIG1ldGhvZCBhbmQvb3IgQXBwU2VydmVyTW9kdWxlIHdlcmUgbm90IGV4cG9ydGVkIGZyb206ICR7c2VydmVyQnVuZGxlUGF0aH0uYCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gTG9hZCBwbGF0Zm9ybSBzZXJ2ZXIgbW9kdWxlIHJlbmRlcmVyXG4gICAgY29uc3QgcmVuZGVyT3B0cyA9IHtcbiAgICAgIGRvY3VtZW50OiBpbmRleEh0bWwsXG4gICAgICB1cmw6IG9wdGlvbnMucm91dGUsXG4gICAgfTtcblxuICAgIGxldCBodG1sID0gYXdhaXQgcmVuZGVyTW9kdWxlRm4oQXBwU2VydmVyTW9kdWxlLCByZW5kZXJPcHRzKTtcbiAgICAvLyBPdmVyd3JpdGUgdGhlIGNsaWVudCBpbmRleCBmaWxlLlxuICAgIGNvbnN0IG91dHB1dEluZGV4UGF0aCA9IG9wdGlvbnMub3V0cHV0SW5kZXhQYXRoXG4gICAgICA/IHBhdGguam9pbihyb290LCBvcHRpb25zLm91dHB1dEluZGV4UGF0aClcbiAgICAgIDogYnJvd3NlckluZGV4T3V0cHV0UGF0aDtcblxuICAgIGlmIChpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvcikge1xuICAgICAgY29uc3QgeyBjb250ZW50LCB3YXJuaW5ncywgZXJyb3JzIH0gPSBhd2FpdCBpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvci5wcm9jZXNzKGh0bWwsIHtcbiAgICAgICAgb3V0cHV0UGF0aCxcbiAgICAgIH0pO1xuICAgICAgaHRtbCA9IGNvbnRlbnQ7XG5cbiAgICAgIGlmICh3YXJuaW5ncy5sZW5ndGggfHwgZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICBzcGlubmVyLnN0b3AoKTtcbiAgICAgICAgd2FybmluZ3MuZm9yRWFjaCgobSkgPT4gY29udGV4dC5sb2dnZXIud2FybihtKSk7XG4gICAgICAgIGVycm9ycy5mb3JFYWNoKChtKSA9PiBjb250ZXh0LmxvZ2dlci5lcnJvcihtKSk7XG4gICAgICAgIHNwaW5uZXIuc3RhcnQoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhd2FpdCBmcy5wcm9taXNlcy53cml0ZUZpbGUob3V0cHV0SW5kZXhQYXRoLCBodG1sKTtcblxuICAgIGlmIChicm93c2VyT3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgICBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIoXG4gICAgICAgIG5vcm1hbGl6ZShwcm9qZWN0Um9vdCksXG4gICAgICAgIG5vcm1hbGl6ZShvdXRwdXRQYXRoKSxcbiAgICAgICAgYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYgfHwgJy8nLFxuICAgICAgICBicm93c2VyT3B0aW9ucy5uZ3N3Q29uZmlnUGF0aCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJyb3dzZXJSZXN1bHQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9nZXRTZXJ2ZXJNb2R1bGVCdW5kbGVQYXRoKFxuICBvcHRpb25zOiBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHNlcnZlclJlc3VsdDogU2VydmVyQnVpbGRlck91dHB1dCxcbiAgYnJvd3NlckxvY2FsZURpcmVjdG9yeTogc3RyaW5nLFxuKSB7XG4gIGlmIChvcHRpb25zLmFwcE1vZHVsZUJ1bmRsZSkge1xuICAgIHJldHVybiBwYXRoLmpvaW4oY29udGV4dC53b3Jrc3BhY2VSb290LCBvcHRpb25zLmFwcE1vZHVsZUJ1bmRsZSk7XG4gIH1cblxuICBjb25zdCB7IGJhc2VPdXRwdXRQYXRoID0gJycgfSA9IHNlcnZlclJlc3VsdDtcbiAgY29uc3Qgb3V0cHV0UGF0aCA9IHBhdGguam9pbihiYXNlT3V0cHV0UGF0aCwgYnJvd3NlckxvY2FsZURpcmVjdG9yeSk7XG5cbiAgaWYgKCFmcy5leGlzdHNTeW5jKG91dHB1dFBhdGgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCBzZXJ2ZXIgb3V0cHV0IGRpcmVjdG9yeTogJHtvdXRwdXRQYXRofS5gKTtcbiAgfVxuXG4gIGNvbnN0IHJlID0gL15tYWluXFwuKD86W2EtekEtWjAtOV17MTZ9XFwuKT9qcyQvO1xuICBjb25zdCBtYXliZU1haW4gPSBmcy5yZWFkZGlyU3luYyhvdXRwdXRQYXRoKS5maW5kKCh4KSA9PiByZS50ZXN0KHgpKTtcblxuICBpZiAoIW1heWJlTWFpbikge1xuICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgdGhlIG1haW4gYnVuZGxlLicpO1xuICB9XG5cbiAgcmV0dXJuIHBhdGguam9pbihvdXRwdXRQYXRoLCBtYXliZU1haW4pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfYXBwU2hlbGxCdWlsZGVyKFxuICBvcHRpb25zOiBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3QgYnJvd3NlclRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5icm93c2VyVGFyZ2V0KTtcbiAgY29uc3Qgc2VydmVyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLnNlcnZlclRhcmdldCk7XG5cbiAgLy8gTmV2ZXIgcnVuIHRoZSBicm93c2VyIHRhcmdldCBpbiB3YXRjaCBtb2RlLlxuICAvLyBJZiBzZXJ2aWNlIHdvcmtlciBpcyBuZWVkZWQsIGl0IHdpbGwgYmUgYWRkZWQgaW4gX3JlbmRlclVuaXZlcnNhbCgpO1xuICBjb25zdCBicm93c2VyT3B0aW9ucyA9IChhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnMoYnJvd3NlclRhcmdldCkpIGFzIEpzb25PYmplY3QgJlxuICAgIEJyb3dzZXJCdWlsZGVyU2NoZW1hO1xuXG4gIGNvbnN0IG9wdGltaXphdGlvbiA9IG5vcm1hbGl6ZU9wdGltaXphdGlvbihicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24pO1xuICBvcHRpbWl6YXRpb24uc3R5bGVzLmlubGluZUNyaXRpY2FsID0gZmFsc2U7XG5cbiAgY29uc3QgYnJvd3NlclRhcmdldFJ1biA9IGF3YWl0IGNvbnRleHQuc2NoZWR1bGVUYXJnZXQoYnJvd3NlclRhcmdldCwge1xuICAgIHdhdGNoOiBmYWxzZSxcbiAgICBzZXJ2aWNlV29ya2VyOiBmYWxzZSxcbiAgICBvcHRpbWl6YXRpb246IG9wdGltaXphdGlvbiBhcyB1bmtub3duIGFzIEpzb25PYmplY3QsXG4gIH0pO1xuICBjb25zdCBzZXJ2ZXJUYXJnZXRSdW4gPSBhd2FpdCBjb250ZXh0LnNjaGVkdWxlVGFyZ2V0KHNlcnZlclRhcmdldCwge1xuICAgIHdhdGNoOiBmYWxzZSxcbiAgfSk7XG5cbiAgbGV0IHNwaW5uZXI6IFNwaW5uZXIgfCB1bmRlZmluZWQ7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBbYnJvd3NlclJlc3VsdCwgc2VydmVyUmVzdWx0XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGJyb3dzZXJUYXJnZXRSdW4ucmVzdWx0IGFzIFByb21pc2U8QnJvd3NlckJ1aWxkZXJPdXRwdXQ+LFxuICAgICAgc2VydmVyVGFyZ2V0UnVuLnJlc3VsdCBhcyBQcm9taXNlPFNlcnZlckJ1aWxkZXJPdXRwdXQ+LFxuICAgIF0pO1xuXG4gICAgaWYgKGJyb3dzZXJSZXN1bHQuc3VjY2VzcyA9PT0gZmFsc2UgfHwgYnJvd3NlclJlc3VsdC5iYXNlT3V0cHV0UGF0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gYnJvd3NlclJlc3VsdDtcbiAgICB9IGVsc2UgaWYgKHNlcnZlclJlc3VsdC5zdWNjZXNzID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuIHNlcnZlclJlc3VsdDtcbiAgICB9XG5cbiAgICBzcGlubmVyID0gbmV3IFNwaW5uZXIoKTtcbiAgICBzcGlubmVyLnN0YXJ0KCdHZW5lcmF0aW5nIGFwcGxpY2F0aW9uIHNoZWxsLi4uJyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgX3JlbmRlclVuaXZlcnNhbChvcHRpb25zLCBjb250ZXh0LCBicm93c2VyUmVzdWx0LCBzZXJ2ZXJSZXN1bHQsIHNwaW5uZXIpO1xuICAgIHNwaW5uZXIuc3VjY2VlZCgnQXBwbGljYXRpb24gc2hlbGwgZ2VuZXJhdGlvbiBjb21wbGV0ZS4nKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHNwaW5uZXI/LmZhaWwoJ0FwcGxpY2F0aW9uIHNoZWxsIGdlbmVyYXRpb24gZmFpbGVkLicpO1xuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xuICB9IGZpbmFsbHkge1xuICAgIGF3YWl0IFByb21pc2UuYWxsKFticm93c2VyVGFyZ2V0UnVuLnN0b3AoKSwgc2VydmVyVGFyZ2V0UnVuLnN0b3AoKV0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXIoX2FwcFNoZWxsQnVpbGRlcik7XG4iXX0=