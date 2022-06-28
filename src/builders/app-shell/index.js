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
const error_1 = require("../../utils/error");
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
            await (0, service_worker_1.augmentAppWithServiceWorker)(projectRoot, root, outputPath, browserOptions.baseHref || '/', browserOptions.ngswConfigPath);
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
        (0, error_1.assertIsError)(err);
        return { success: false, error: err.message };
    }
    finally {
        await Promise.all([browserTargetRun.stop(), serverTargetRun.stop()]);
    }
}
exports.default = (0, architect_1.createBuilder)(_appShellBuilder);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9hcHAtc2hlbGwvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUttQztBQUVuQyx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLHVDQUFvRDtBQUNwRCw2Q0FBa0Q7QUFDbEQsb0ZBQXdGO0FBQ3hGLCtEQUF5RTtBQUN6RSxpREFBOEM7QUFNOUMsS0FBSyxVQUFVLGdCQUFnQixDQUM3QixPQUFtQyxFQUNuQyxPQUF1QixFQUN2QixhQUFtQyxFQUNuQyxZQUFpQyxFQUNqQyxPQUFnQjs7SUFFaEIsOEJBQThCO0lBQzlCLE1BQU0sYUFBYSxHQUFHLElBQUEsa0NBQXNCLEVBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3BFLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLENBQUMsQ0FDbEQsQ0FBQztJQUN2QixNQUFNLGtCQUFrQixHQUFHLE1BQU0sT0FBTyxDQUFDLHVCQUF1QixDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ2hGLE1BQU0sY0FBYyxHQUFHLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FDbEQsaUJBQWlCLEVBQ2pCLGtCQUFrQixDQUNuQixDQUFDO0lBRUYscUJBQXFCO0lBQ3JCLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7SUFDbkMsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDbEUsd0RBQWEsV0FBVyxHQUFDLENBQUM7SUFFMUIsTUFBTSxXQUFXLEdBQUcs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QUMsQ0FBQztRQUVILElBQUksYUFBYSxDQUFDLE9BQU8sS0FBSyxLQUFLLElBQUksYUFBYSxDQUFDLGNBQWMsS0FBSyxTQUFTLEVBQUU7WUFDakYsT0FBTyxhQUFhLENBQUM7U0FDdEI7YUFBTSxJQUFJLFlBQVksQ0FBQyxPQUFPLEtBQUssS0FBSyxFQUFFO1lBQ3pDLE9BQU8sWUFBWSxDQUFDO1NBQ3JCO1FBRUQsT0FBTyxHQUFHLElBQUksaUJBQU8sRUFBRSxDQUFDO1FBQ3hCLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUNBQWlDLENBQUMsQ0FBQztRQUNqRCxNQUFNLE1BQU0sR0FBRyxNQUFNLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM5RixPQUFPLENBQUMsT0FBTyxDQUFDLHdDQUF3QyxDQUFDLENBQUM7UUFFMUQsT0FBTyxNQUFNLENBQUM7S0FDZjtJQUFDLE9BQU8sR0FBRyxFQUFFO1FBQ1osT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLElBQUksQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO1FBQ3RELElBQUEscUJBQWEsRUFBQyxHQUFHLENBQUMsQ0FBQztRQUVuQixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQy9DO1lBQVM7UUFDUixNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsRUFBRSxlQUFlLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQ3RFO0FBQ0gsQ0FBQztBQUVELGtCQUFlLElBQUEseUJBQWEsRUFBQyxnQkFBZ0IsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkZXJDb250ZXh0LFxuICBCdWlsZGVyT3V0cHV0LFxuICBjcmVhdGVCdWlsZGVyLFxuICB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IEpzb25PYmplY3QgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgbm9ybWFsaXplT3B0aW1pemF0aW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNFcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9yJztcbmltcG9ydCB7IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmxpbmUtY3JpdGljYWwtY3NzJztcbmltcG9ydCB7IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlciB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IFNwaW5uZXIgfSBmcm9tICcuLi8uLi91dGlscy9zcGlubmVyJztcbmltcG9ydCB7IEJyb3dzZXJCdWlsZGVyT3V0cHV0IH0gZnJvbSAnLi4vYnJvd3Nlcic7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBTZXJ2ZXJCdWlsZGVyT3V0cHV0IH0gZnJvbSAnLi4vc2VydmVyJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcblxuYXN5bmMgZnVuY3Rpb24gX3JlbmRlclVuaXZlcnNhbChcbiAgb3B0aW9uczogQnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBicm93c2VyUmVzdWx0OiBCcm93c2VyQnVpbGRlck91dHB1dCxcbiAgc2VydmVyUmVzdWx0OiBTZXJ2ZXJCdWlsZGVyT3V0cHV0LFxuICBzcGlubmVyOiBTcGlubmVyLFxuKTogUHJvbWlzZTxCcm93c2VyQnVpbGRlck91dHB1dD4ge1xuICAvLyBHZXQgYnJvd3NlciB0YXJnZXQgb3B0aW9ucy5cbiAgY29uc3QgYnJvd3NlclRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5icm93c2VyVGFyZ2V0KTtcbiAgY29uc3QgcmF3QnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC5nZXRUYXJnZXRPcHRpb25zKGJyb3dzZXJUYXJnZXQpKSBhcyBKc29uT2JqZWN0ICZcbiAgICBCcm93c2VyQnVpbGRlclNjaGVtYTtcbiAgY29uc3QgYnJvd3NlckJ1aWxkZXJOYW1lID0gYXdhaXQgY29udGV4dC5nZXRCdWlsZGVyTmFtZUZvclRhcmdldChicm93c2VyVGFyZ2V0KTtcbiAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSBhd2FpdCBjb250ZXh0LnZhbGlkYXRlT3B0aW9uczxKc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJTY2hlbWE+KFxuICAgIHJhd0Jyb3dzZXJPcHRpb25zLFxuICAgIGJyb3dzZXJCdWlsZGVyTmFtZSxcbiAgKTtcblxuICAvLyBJbml0aWFsaXplIHpvbmUuanNcbiAgY29uc3Qgcm9vdCA9IGNvbnRleHQud29ya3NwYWNlUm9vdDtcbiAgY29uc3Qgem9uZVBhY2thZ2UgPSByZXF1aXJlLnJlc29sdmUoJ3pvbmUuanMnLCB7IHBhdGhzOiBbcm9vdF0gfSk7XG4gIGF3YWl0IGltcG9ydCh6b25lUGFja2FnZSk7XG5cbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldCAmJiBjb250ZXh0LnRhcmdldC5wcm9qZWN0O1xuICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldC4nKTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3RNZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgY29uc3QgcHJvamVjdFJvb3QgPSBwYXRoLmpvaW4ocm9vdCwgKHByb2plY3RNZXRhZGF0YS5yb290IGFzIHN0cmluZyB8IHVuZGVmaW5lZCkgPz8gJycpO1xuXG4gIGNvbnN0IHsgc3R5bGVzIH0gPSBub3JtYWxpemVPcHRpbWl6YXRpb24oYnJvd3Nlck9wdGlvbnMub3B0aW1pemF0aW9uKTtcbiAgY29uc3QgaW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgPSBzdHlsZXMuaW5saW5lQ3JpdGljYWxcbiAgICA/IG5ldyBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvcih7XG4gICAgICAgIG1pbmlmeTogc3R5bGVzLm1pbmlmeSxcbiAgICAgICAgZGVwbG95VXJsOiBicm93c2VyT3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgICB9KVxuICAgIDogdW5kZWZpbmVkO1xuXG4gIGZvciAoY29uc3Qgb3V0cHV0UGF0aCBvZiBicm93c2VyUmVzdWx0Lm91dHB1dFBhdGhzKSB7XG4gICAgY29uc3QgbG9jYWxlRGlyZWN0b3J5ID0gcGF0aC5yZWxhdGl2ZShicm93c2VyUmVzdWx0LmJhc2VPdXRwdXRQYXRoLCBvdXRwdXRQYXRoKTtcbiAgICBjb25zdCBicm93c2VySW5kZXhPdXRwdXRQYXRoID0gcGF0aC5qb2luKG91dHB1dFBhdGgsICdpbmRleC5odG1sJyk7XG4gICAgY29uc3QgaW5kZXhIdG1sID0gYXdhaXQgZnMucHJvbWlzZXMucmVhZEZpbGUoYnJvd3NlckluZGV4T3V0cHV0UGF0aCwgJ3V0ZjgnKTtcbiAgICBjb25zdCBzZXJ2ZXJCdW5kbGVQYXRoID0gYXdhaXQgX2dldFNlcnZlck1vZHVsZUJ1bmRsZVBhdGgoXG4gICAgICBvcHRpb25zLFxuICAgICAgY29udGV4dCxcbiAgICAgIHNlcnZlclJlc3VsdCxcbiAgICAgIGxvY2FsZURpcmVjdG9yeSxcbiAgICApO1xuXG4gICAgY29uc3QgeyBBcHBTZXJ2ZXJNb2R1bGUsIHJlbmRlck1vZHVsZSB9ID0gYXdhaXQgaW1wb3J0KHNlcnZlckJ1bmRsZVBhdGgpO1xuXG4gICAgY29uc3QgcmVuZGVyTW9kdWxlRm46ICgobW9kdWxlOiB1bmtub3duLCBvcHRpb25zOiB7fSkgPT4gUHJvbWlzZTxzdHJpbmc+KSB8IHVuZGVmaW5lZCA9XG4gICAgICByZW5kZXJNb2R1bGU7XG5cbiAgICBpZiAoIShyZW5kZXJNb2R1bGVGbiAmJiBBcHBTZXJ2ZXJNb2R1bGUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGByZW5kZXJNb2R1bGUgbWV0aG9kIGFuZC9vciBBcHBTZXJ2ZXJNb2R1bGUgd2VyZSBub3QgZXhwb3J0ZWQgZnJvbTogJHtzZXJ2ZXJCdW5kbGVQYXRofS5gLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBMb2FkIHBsYXRmb3JtIHNlcnZlciBtb2R1bGUgcmVuZGVyZXJcbiAgICBjb25zdCByZW5kZXJPcHRzID0ge1xuICAgICAgZG9jdW1lbnQ6IGluZGV4SHRtbCxcbiAgICAgIHVybDogb3B0aW9ucy5yb3V0ZSxcbiAgICB9O1xuXG4gICAgbGV0IGh0bWwgPSBhd2FpdCByZW5kZXJNb2R1bGVGbihBcHBTZXJ2ZXJNb2R1bGUsIHJlbmRlck9wdHMpO1xuICAgIC8vIE92ZXJ3cml0ZSB0aGUgY2xpZW50IGluZGV4IGZpbGUuXG4gICAgY29uc3Qgb3V0cHV0SW5kZXhQYXRoID0gb3B0aW9ucy5vdXRwdXRJbmRleFBhdGhcbiAgICAgID8gcGF0aC5qb2luKHJvb3QsIG9wdGlvbnMub3V0cHV0SW5kZXhQYXRoKVxuICAgICAgOiBicm93c2VySW5kZXhPdXRwdXRQYXRoO1xuXG4gICAgaWYgKGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yKSB7XG4gICAgICBjb25zdCB7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yLnByb2Nlc3MoaHRtbCwge1xuICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgfSk7XG4gICAgICBodG1sID0gY29udGVudDtcblxuICAgICAgaWYgKHdhcm5pbmdzLmxlbmd0aCB8fCBlcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgIHNwaW5uZXIuc3RvcCgpO1xuICAgICAgICB3YXJuaW5ncy5mb3JFYWNoKChtKSA9PiBjb250ZXh0LmxvZ2dlci53YXJuKG0pKTtcbiAgICAgICAgZXJyb3JzLmZvckVhY2goKG0pID0+IGNvbnRleHQubG9nZ2VyLmVycm9yKG0pKTtcbiAgICAgICAgc3Bpbm5lci5zdGFydCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGF3YWl0IGZzLnByb21pc2VzLndyaXRlRmlsZShvdXRwdXRJbmRleFBhdGgsIGh0bWwpO1xuXG4gICAgaWYgKGJyb3dzZXJPcHRpb25zLnNlcnZpY2VXb3JrZXIpIHtcbiAgICAgIGF3YWl0IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlcihcbiAgICAgICAgcHJvamVjdFJvb3QsXG4gICAgICAgIHJvb3QsXG4gICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgIGJyb3dzZXJPcHRpb25zLmJhc2VIcmVmIHx8ICcvJyxcbiAgICAgICAgYnJvd3Nlck9wdGlvbnMubmdzd0NvbmZpZ1BhdGgsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBicm93c2VyUmVzdWx0O1xufVxuXG5hc3luYyBmdW5jdGlvbiBfZ2V0U2VydmVyTW9kdWxlQnVuZGxlUGF0aChcbiAgb3B0aW9uczogQnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBzZXJ2ZXJSZXN1bHQ6IFNlcnZlckJ1aWxkZXJPdXRwdXQsXG4gIGJyb3dzZXJMb2NhbGVEaXJlY3Rvcnk6IHN0cmluZyxcbikge1xuICBpZiAob3B0aW9ucy5hcHBNb2R1bGVCdW5kbGUpIHtcbiAgICByZXR1cm4gcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgb3B0aW9ucy5hcHBNb2R1bGVCdW5kbGUpO1xuICB9XG5cbiAgY29uc3QgeyBiYXNlT3V0cHV0UGF0aCA9ICcnIH0gPSBzZXJ2ZXJSZXN1bHQ7XG4gIGNvbnN0IG91dHB1dFBhdGggPSBwYXRoLmpvaW4oYmFzZU91dHB1dFBhdGgsIGJyb3dzZXJMb2NhbGVEaXJlY3RvcnkpO1xuXG4gIGlmICghZnMuZXhpc3RzU3luYyhvdXRwdXRQYXRoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgc2VydmVyIG91dHB1dCBkaXJlY3Rvcnk6ICR7b3V0cHV0UGF0aH0uYCk7XG4gIH1cblxuICBjb25zdCByZSA9IC9ebWFpblxcLig/OlthLXpBLVowLTldezE2fVxcLik/anMkLztcbiAgY29uc3QgbWF5YmVNYWluID0gZnMucmVhZGRpclN5bmMob3V0cHV0UGF0aCkuZmluZCgoeCkgPT4gcmUudGVzdCh4KSk7XG5cbiAgaWYgKCFtYXliZU1haW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHRoZSBtYWluIGJ1bmRsZS4nKTtcbiAgfVxuXG4gIHJldHVybiBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgbWF5YmVNYWluKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2FwcFNoZWxsQnVpbGRlcihcbiAgb3B0aW9uczogQnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKTogUHJvbWlzZTxCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnN0IGJyb3dzZXJUYXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuYnJvd3NlclRhcmdldCk7XG4gIGNvbnN0IHNlcnZlclRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5zZXJ2ZXJUYXJnZXQpO1xuXG4gIC8vIE5ldmVyIHJ1biB0aGUgYnJvd3NlciB0YXJnZXQgaW4gd2F0Y2ggbW9kZS5cbiAgLy8gSWYgc2VydmljZSB3b3JrZXIgaXMgbmVlZGVkLCBpdCB3aWxsIGJlIGFkZGVkIGluIF9yZW5kZXJVbml2ZXJzYWwoKTtcbiAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC5nZXRUYXJnZXRPcHRpb25zKGJyb3dzZXJUYXJnZXQpKSBhcyBKc29uT2JqZWN0ICZcbiAgICBCcm93c2VyQnVpbGRlclNjaGVtYTtcblxuICBjb25zdCBvcHRpbWl6YXRpb24gPSBub3JtYWxpemVPcHRpbWl6YXRpb24oYnJvd3Nlck9wdGlvbnMub3B0aW1pemF0aW9uKTtcbiAgb3B0aW1pemF0aW9uLnN0eWxlcy5pbmxpbmVDcml0aWNhbCA9IGZhbHNlO1xuXG4gIGNvbnN0IGJyb3dzZXJUYXJnZXRSdW4gPSBhd2FpdCBjb250ZXh0LnNjaGVkdWxlVGFyZ2V0KGJyb3dzZXJUYXJnZXQsIHtcbiAgICB3YXRjaDogZmFsc2UsXG4gICAgc2VydmljZVdvcmtlcjogZmFsc2UsXG4gICAgb3B0aW1pemF0aW9uOiBvcHRpbWl6YXRpb24gYXMgdW5rbm93biBhcyBKc29uT2JqZWN0LFxuICB9KTtcbiAgY29uc3Qgc2VydmVyVGFyZ2V0UnVuID0gYXdhaXQgY29udGV4dC5zY2hlZHVsZVRhcmdldChzZXJ2ZXJUYXJnZXQsIHtcbiAgICB3YXRjaDogZmFsc2UsXG4gIH0pO1xuXG4gIGxldCBzcGlubmVyOiBTcGlubmVyIHwgdW5kZWZpbmVkO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgW2Jyb3dzZXJSZXN1bHQsIHNlcnZlclJlc3VsdF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBicm93c2VyVGFyZ2V0UnVuLnJlc3VsdCBhcyBQcm9taXNlPEJyb3dzZXJCdWlsZGVyT3V0cHV0PixcbiAgICAgIHNlcnZlclRhcmdldFJ1bi5yZXN1bHQgYXMgUHJvbWlzZTxTZXJ2ZXJCdWlsZGVyT3V0cHV0PixcbiAgICBdKTtcblxuICAgIGlmIChicm93c2VyUmVzdWx0LnN1Y2Nlc3MgPT09IGZhbHNlIHx8IGJyb3dzZXJSZXN1bHQuYmFzZU91dHB1dFBhdGggPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGJyb3dzZXJSZXN1bHQ7XG4gICAgfSBlbHNlIGlmIChzZXJ2ZXJSZXN1bHQuc3VjY2VzcyA9PT0gZmFsc2UpIHtcbiAgICAgIHJldHVybiBzZXJ2ZXJSZXN1bHQ7XG4gICAgfVxuXG4gICAgc3Bpbm5lciA9IG5ldyBTcGlubmVyKCk7XG4gICAgc3Bpbm5lci5zdGFydCgnR2VuZXJhdGluZyBhcHBsaWNhdGlvbiBzaGVsbC4uLicpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IF9yZW5kZXJVbml2ZXJzYWwob3B0aW9ucywgY29udGV4dCwgYnJvd3NlclJlc3VsdCwgc2VydmVyUmVzdWx0LCBzcGlubmVyKTtcbiAgICBzcGlubmVyLnN1Y2NlZWQoJ0FwcGxpY2F0aW9uIHNoZWxsIGdlbmVyYXRpb24gY29tcGxldGUuJyk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBzcGlubmVyPy5mYWlsKCdBcHBsaWNhdGlvbiBzaGVsbCBnZW5lcmF0aW9uIGZhaWxlZC4nKTtcbiAgICBhc3NlcnRJc0Vycm9yKGVycik7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XG4gIH0gZmluYWxseSB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW2Jyb3dzZXJUYXJnZXRSdW4uc3RvcCgpLCBzZXJ2ZXJUYXJnZXRSdW4uc3RvcCgpXSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcihfYXBwU2hlbGxCdWlsZGVyKTtcbiJdfQ==