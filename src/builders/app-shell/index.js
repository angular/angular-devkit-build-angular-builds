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
        // Workaround piscina bug where a worker thread will be recreated after destroy to meet the minimum.
        renderWorker.options.minThreads = 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9hcHAtc2hlbGwvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUttQztBQUVuQyx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLHNEQUE4QjtBQUM5Qix1Q0FBb0Q7QUFDcEQsNkNBQWtEO0FBRWxELCtEQUF5RTtBQUN6RSxpREFBOEM7QUFNOUMsS0FBSyxVQUFVLGdCQUFnQixDQUM3QixPQUFtQyxFQUNuQyxPQUF1QixFQUN2QixhQUFtQyxFQUNuQyxZQUFpQyxFQUNqQyxPQUFnQjtJQUVoQiw4QkFBOEI7SUFDOUIsTUFBTSxhQUFhLEdBQUcsSUFBQSxrQ0FBc0IsRUFBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDcEUsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxDQUNsRCxDQUFDO0lBQ3ZCLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxPQUFPLENBQUMsdUJBQXVCLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDaEYsTUFBTSxjQUFjLEdBQUcsTUFBTSxPQUFPLENBQUMsZUFBZSxDQUNsRCxpQkFBaUIsRUFDakIsa0JBQWtCLENBQ25CLENBQUM7SUFFRiw4Q0FBOEM7SUFDOUMsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUNuQyxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUVsRSxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFBTSxJQUFJLE9BQU8s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R29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgQnVpbGRlckNvbnRleHQsXG4gIEJ1aWxkZXJPdXRwdXQsXG4gIGNyZWF0ZUJ1aWxkZXIsXG4gIHRhcmdldEZyb21UYXJnZXRTdHJpbmcsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgSnNvbk9iamVjdCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgUGlzY2luYSBmcm9tICdwaXNjaW5hJztcbmltcG9ydCB7IG5vcm1hbGl6ZU9wdGltaXphdGlvbiB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgdHlwZSB7IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmxpbmUtY3JpdGljYWwtY3NzJztcbmltcG9ydCB7IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlciB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IFNwaW5uZXIgfSBmcm9tICcuLi8uLi91dGlscy9zcGlubmVyJztcbmltcG9ydCB7IEJyb3dzZXJCdWlsZGVyT3V0cHV0IH0gZnJvbSAnLi4vYnJvd3Nlcic7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBTZXJ2ZXJCdWlsZGVyT3V0cHV0IH0gZnJvbSAnLi4vc2VydmVyJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcblxuYXN5bmMgZnVuY3Rpb24gX3JlbmRlclVuaXZlcnNhbChcbiAgb3B0aW9uczogQnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBicm93c2VyUmVzdWx0OiBCcm93c2VyQnVpbGRlck91dHB1dCxcbiAgc2VydmVyUmVzdWx0OiBTZXJ2ZXJCdWlsZGVyT3V0cHV0LFxuICBzcGlubmVyOiBTcGlubmVyLFxuKTogUHJvbWlzZTxCcm93c2VyQnVpbGRlck91dHB1dD4ge1xuICAvLyBHZXQgYnJvd3NlciB0YXJnZXQgb3B0aW9ucy5cbiAgY29uc3QgYnJvd3NlclRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5icm93c2VyVGFyZ2V0KTtcbiAgY29uc3QgcmF3QnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC5nZXRUYXJnZXRPcHRpb25zKGJyb3dzZXJUYXJnZXQpKSBhcyBKc29uT2JqZWN0ICZcbiAgICBCcm93c2VyQnVpbGRlclNjaGVtYTtcbiAgY29uc3QgYnJvd3NlckJ1aWxkZXJOYW1lID0gYXdhaXQgY29udGV4dC5nZXRCdWlsZGVyTmFtZUZvclRhcmdldChicm93c2VyVGFyZ2V0KTtcbiAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSBhd2FpdCBjb250ZXh0LnZhbGlkYXRlT3B0aW9uczxKc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJTY2hlbWE+KFxuICAgIHJhd0Jyb3dzZXJPcHRpb25zLFxuICAgIGJyb3dzZXJCdWlsZGVyTmFtZSxcbiAgKTtcblxuICAvLyBMb2NhdGUgem9uZS5qcyB0byBsb2FkIGluIHRoZSByZW5kZXIgd29ya2VyXG4gIGNvbnN0IHJvb3QgPSBjb250ZXh0LndvcmtzcGFjZVJvb3Q7XG4gIGNvbnN0IHpvbmVQYWNrYWdlID0gcmVxdWlyZS5yZXNvbHZlKCd6b25lLmpzJywgeyBwYXRoczogW3Jvb3RdIH0pO1xuXG4gIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQgJiYgY29udGV4dC50YXJnZXQucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVGhlIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQuJyk7XG4gIH1cblxuICBjb25zdCBwcm9qZWN0TWV0YWRhdGEgPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gIGNvbnN0IHByb2plY3RSb290ID0gcGF0aC5qb2luKHJvb3QsIChwcm9qZWN0TWV0YWRhdGEucm9vdCBhcyBzdHJpbmcgfCB1bmRlZmluZWQpID8/ICcnKTtcblxuICBjb25zdCB7IHN0eWxlcyB9ID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbik7XG4gIGxldCBpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NvcjogSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgfCB1bmRlZmluZWQ7XG4gIGlmIChzdHlsZXMuaW5saW5lQ3JpdGljYWwpIHtcbiAgICBjb25zdCB7IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmxpbmUtY3JpdGljYWwtY3NzJ1xuICAgICk7XG4gICAgaW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgPSBuZXcgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3Ioe1xuICAgICAgbWluaWZ5OiBzdHlsZXMubWluaWZ5LFxuICAgICAgZGVwbG95VXJsOiBicm93c2VyT3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCByZW5kZXJXb3JrZXIgPSBuZXcgUGlzY2luYSh7XG4gICAgZmlsZW5hbWU6IHJlcXVpcmUucmVzb2x2ZSgnLi9yZW5kZXItd29ya2VyJyksXG4gICAgbWF4VGhyZWFkczogMSxcbiAgICB3b3JrZXJEYXRhOiB7IHpvbmVQYWNrYWdlIH0sXG4gIH0pO1xuXG4gIHRyeSB7XG4gICAgZm9yIChjb25zdCB7IHBhdGg6IG91dHB1dFBhdGgsIGJhc2VIcmVmIH0gb2YgYnJvd3NlclJlc3VsdC5vdXRwdXRzKSB7XG4gICAgICBjb25zdCBsb2NhbGVEaXJlY3RvcnkgPSBwYXRoLnJlbGF0aXZlKGJyb3dzZXJSZXN1bHQuYmFzZU91dHB1dFBhdGgsIG91dHB1dFBhdGgpO1xuICAgICAgY29uc3QgYnJvd3NlckluZGV4T3V0cHV0UGF0aCA9IHBhdGguam9pbihvdXRwdXRQYXRoLCAnaW5kZXguaHRtbCcpO1xuICAgICAgY29uc3QgaW5kZXhIdG1sID0gYXdhaXQgZnMucHJvbWlzZXMucmVhZEZpbGUoYnJvd3NlckluZGV4T3V0cHV0UGF0aCwgJ3V0ZjgnKTtcbiAgICAgIGNvbnN0IHNlcnZlckJ1bmRsZVBhdGggPSBhd2FpdCBfZ2V0U2VydmVyTW9kdWxlQnVuZGxlUGF0aChcbiAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgY29udGV4dCxcbiAgICAgICAgc2VydmVyUmVzdWx0LFxuICAgICAgICBsb2NhbGVEaXJlY3RvcnksXG4gICAgICApO1xuXG4gICAgICBsZXQgaHRtbDogc3RyaW5nID0gYXdhaXQgcmVuZGVyV29ya2VyLnJ1bih7XG4gICAgICAgIHNlcnZlckJ1bmRsZVBhdGgsXG4gICAgICAgIGRvY3VtZW50OiBpbmRleEh0bWwsXG4gICAgICAgIHVybDogb3B0aW9ucy5yb3V0ZSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBPdmVyd3JpdGUgdGhlIGNsaWVudCBpbmRleCBmaWxlLlxuICAgICAgY29uc3Qgb3V0cHV0SW5kZXhQYXRoID0gb3B0aW9ucy5vdXRwdXRJbmRleFBhdGhcbiAgICAgICAgPyBwYXRoLmpvaW4ocm9vdCwgb3B0aW9ucy5vdXRwdXRJbmRleFBhdGgpXG4gICAgICAgIDogYnJvd3NlckluZGV4T3V0cHV0UGF0aDtcblxuICAgICAgaWYgKGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yKSB7XG4gICAgICAgIGNvbnN0IHsgY29udGVudCwgd2FybmluZ3MsIGVycm9ycyB9ID0gYXdhaXQgaW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IucHJvY2VzcyhodG1sLCB7XG4gICAgICAgICAgb3V0cHV0UGF0aCxcbiAgICAgICAgfSk7XG4gICAgICAgIGh0bWwgPSBjb250ZW50O1xuXG4gICAgICAgIGlmICh3YXJuaW5ncy5sZW5ndGggfHwgZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgIHNwaW5uZXIuc3RvcCgpO1xuICAgICAgICAgIHdhcm5pbmdzLmZvckVhY2goKG0pID0+IGNvbnRleHQubG9nZ2VyLndhcm4obSkpO1xuICAgICAgICAgIGVycm9ycy5mb3JFYWNoKChtKSA9PiBjb250ZXh0LmxvZ2dlci5lcnJvcihtKSk7XG4gICAgICAgICAgc3Bpbm5lci5zdGFydCgpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IGZzLnByb21pc2VzLndyaXRlRmlsZShvdXRwdXRJbmRleFBhdGgsIGh0bWwpO1xuXG4gICAgICBpZiAoYnJvd3Nlck9wdGlvbnMuc2VydmljZVdvcmtlcikge1xuICAgICAgICBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIoXG4gICAgICAgICAgcHJvamVjdFJvb3QsXG4gICAgICAgICAgcm9vdCxcbiAgICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICAgIGJhc2VIcmVmID8/ICcvJyxcbiAgICAgICAgICBicm93c2VyT3B0aW9ucy5uZ3N3Q29uZmlnUGF0aCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZmluYWxseSB7XG4gICAgLy8gV29ya2Fyb3VuZCBwaXNjaW5hIGJ1ZyB3aGVyZSBhIHdvcmtlciB0aHJlYWQgd2lsbCBiZSByZWNyZWF0ZWQgYWZ0ZXIgZGVzdHJveSB0byBtZWV0IHRoZSBtaW5pbXVtLlxuICAgIHJlbmRlcldvcmtlci5vcHRpb25zLm1pblRocmVhZHMgPSAwO1xuXG4gICAgYXdhaXQgcmVuZGVyV29ya2VyLmRlc3Ryb3koKTtcbiAgfVxuXG4gIHJldHVybiBicm93c2VyUmVzdWx0O1xufVxuXG5hc3luYyBmdW5jdGlvbiBfZ2V0U2VydmVyTW9kdWxlQnVuZGxlUGF0aChcbiAgb3B0aW9uczogQnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBzZXJ2ZXJSZXN1bHQ6IFNlcnZlckJ1aWxkZXJPdXRwdXQsXG4gIGJyb3dzZXJMb2NhbGVEaXJlY3Rvcnk6IHN0cmluZyxcbikge1xuICBpZiAob3B0aW9ucy5hcHBNb2R1bGVCdW5kbGUpIHtcbiAgICByZXR1cm4gcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgb3B0aW9ucy5hcHBNb2R1bGVCdW5kbGUpO1xuICB9XG5cbiAgY29uc3QgeyBiYXNlT3V0cHV0UGF0aCA9ICcnIH0gPSBzZXJ2ZXJSZXN1bHQ7XG4gIGNvbnN0IG91dHB1dFBhdGggPSBwYXRoLmpvaW4oYmFzZU91dHB1dFBhdGgsIGJyb3dzZXJMb2NhbGVEaXJlY3RvcnkpO1xuXG4gIGlmICghZnMuZXhpc3RzU3luYyhvdXRwdXRQYXRoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgc2VydmVyIG91dHB1dCBkaXJlY3Rvcnk6ICR7b3V0cHV0UGF0aH0uYCk7XG4gIH1cblxuICBjb25zdCByZSA9IC9ebWFpblxcLig/OlthLXpBLVowLTldezE2fVxcLik/anMkLztcbiAgY29uc3QgbWF5YmVNYWluID0gZnMucmVhZGRpclN5bmMob3V0cHV0UGF0aCkuZmluZCgoeCkgPT4gcmUudGVzdCh4KSk7XG5cbiAgaWYgKCFtYXliZU1haW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHRoZSBtYWluIGJ1bmRsZS4nKTtcbiAgfVxuXG4gIHJldHVybiBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgbWF5YmVNYWluKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2FwcFNoZWxsQnVpbGRlcihcbiAgb3B0aW9uczogQnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKTogUHJvbWlzZTxCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnN0IGJyb3dzZXJUYXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuYnJvd3NlclRhcmdldCk7XG4gIGNvbnN0IHNlcnZlclRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5zZXJ2ZXJUYXJnZXQpO1xuXG4gIC8vIE5ldmVyIHJ1biB0aGUgYnJvd3NlciB0YXJnZXQgaW4gd2F0Y2ggbW9kZS5cbiAgLy8gSWYgc2VydmljZSB3b3JrZXIgaXMgbmVlZGVkLCBpdCB3aWxsIGJlIGFkZGVkIGluIF9yZW5kZXJVbml2ZXJzYWwoKTtcbiAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC5nZXRUYXJnZXRPcHRpb25zKGJyb3dzZXJUYXJnZXQpKSBhcyBKc29uT2JqZWN0ICZcbiAgICBCcm93c2VyQnVpbGRlclNjaGVtYTtcblxuICBjb25zdCBvcHRpbWl6YXRpb24gPSBub3JtYWxpemVPcHRpbWl6YXRpb24oYnJvd3Nlck9wdGlvbnMub3B0aW1pemF0aW9uKTtcbiAgb3B0aW1pemF0aW9uLnN0eWxlcy5pbmxpbmVDcml0aWNhbCA9IGZhbHNlO1xuXG4gIGNvbnN0IGJyb3dzZXJUYXJnZXRSdW4gPSBhd2FpdCBjb250ZXh0LnNjaGVkdWxlVGFyZ2V0KGJyb3dzZXJUYXJnZXQsIHtcbiAgICB3YXRjaDogZmFsc2UsXG4gICAgc2VydmljZVdvcmtlcjogZmFsc2UsXG4gICAgb3B0aW1pemF0aW9uOiBvcHRpbWl6YXRpb24gYXMgdW5rbm93biBhcyBKc29uT2JqZWN0LFxuICB9KTtcbiAgY29uc3Qgc2VydmVyVGFyZ2V0UnVuID0gYXdhaXQgY29udGV4dC5zY2hlZHVsZVRhcmdldChzZXJ2ZXJUYXJnZXQsIHtcbiAgICB3YXRjaDogZmFsc2UsXG4gIH0pO1xuXG4gIGxldCBzcGlubmVyOiBTcGlubmVyIHwgdW5kZWZpbmVkO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgW2Jyb3dzZXJSZXN1bHQsIHNlcnZlclJlc3VsdF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBicm93c2VyVGFyZ2V0UnVuLnJlc3VsdCBhcyBQcm9taXNlPEJyb3dzZXJCdWlsZGVyT3V0cHV0PixcbiAgICAgIHNlcnZlclRhcmdldFJ1bi5yZXN1bHQgYXMgUHJvbWlzZTxTZXJ2ZXJCdWlsZGVyT3V0cHV0PixcbiAgICBdKTtcblxuICAgIGlmIChicm93c2VyUmVzdWx0LnN1Y2Nlc3MgPT09IGZhbHNlIHx8IGJyb3dzZXJSZXN1bHQuYmFzZU91dHB1dFBhdGggPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGJyb3dzZXJSZXN1bHQ7XG4gICAgfSBlbHNlIGlmIChzZXJ2ZXJSZXN1bHQuc3VjY2VzcyA9PT0gZmFsc2UpIHtcbiAgICAgIHJldHVybiBzZXJ2ZXJSZXN1bHQ7XG4gICAgfVxuXG4gICAgc3Bpbm5lciA9IG5ldyBTcGlubmVyKCk7XG4gICAgc3Bpbm5lci5zdGFydCgnR2VuZXJhdGluZyBhcHBsaWNhdGlvbiBzaGVsbC4uLicpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IF9yZW5kZXJVbml2ZXJzYWwob3B0aW9ucywgY29udGV4dCwgYnJvd3NlclJlc3VsdCwgc2VydmVyUmVzdWx0LCBzcGlubmVyKTtcbiAgICBzcGlubmVyLnN1Y2NlZWQoJ0FwcGxpY2F0aW9uIHNoZWxsIGdlbmVyYXRpb24gY29tcGxldGUuJyk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBzcGlubmVyPy5mYWlsKCdBcHBsaWNhdGlvbiBzaGVsbCBnZW5lcmF0aW9uIGZhaWxlZC4nKTtcbiAgICBhc3NlcnRJc0Vycm9yKGVycik7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XG4gIH0gZmluYWxseSB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW2Jyb3dzZXJUYXJnZXRSdW4uc3RvcCgpLCBzZXJ2ZXJUYXJnZXRSdW4uc3RvcCgpXSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcihfYXBwU2hlbGxCdWlsZGVyKTtcbiJdfQ==