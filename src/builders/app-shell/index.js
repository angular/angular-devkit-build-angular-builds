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
    for (const { path: outputPath, baseHref } of browserResult.outputs) {
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
            await (0, service_worker_1.augmentAppWithServiceWorker)(projectRoot, root, outputPath, baseHref !== null && baseHref !== void 0 ? baseHref : '/', browserOptions.ngswConfigPath);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9hcHAtc2hlbGwvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHlEQUttQztBQUVuQyx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLHVDQUFvRDtBQUNwRCxvRkFBd0Y7QUFDeEYsK0RBQXlFO0FBQ3pFLGlEQUE4QztBQU05QyxLQUFLLFVBQVUsZ0JBQWdCLENBQzdCLE9BQW1DLEVBQ25DLE9BQXVCLEVBQ3ZCLGFBQW1DLEVBQ25DLFlBQWlDLEVBQ2pDLE9BQWdCOztJQUVoQiw4QkFBOEI7SUFDOUIsTUFBTSxhQUFhLEdBQUcsSUFBQSxrQ0FBc0IsRUFBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDcEUsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxDQUNsRCxDQUFDO0lBQ3ZCLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxPQUFPLENBQUMsdUJBQXVCLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDaEYsTUFBTSxjQUFjLEdBQUcsTUFBTSxPQUFPLENBQUMsZUFBZSxDQUNsRCxpQkFBaUIsRUFDakIsa0JBQWtCLENBQ25CLENBQUM7SUFFRixxQkFBcUI7SUFDckIsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUNuQyxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNsRSx3REFBYSxXQUFXLEdBQUMsQ0FBQztJQUUxQixNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO0lBQzdELElBQUksQ0FBQyxXQUFXLEVBQUU7UUFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO0tBQ25EO0lBRUQsTUFBTSxlQUFlLEdBQUcsTUFBTSxPQUFPLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDdEUsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBQyxlQUFlLENBQUMsSUFBMkIsbUNBQUksRUFBRSxDQUFDLENBQUM7SUFFeEYsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUEsNkJBQXFCLEVBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQ3RFLE1BQU0sMEJBQTBCLEdBQUcsTUFBTSxDQUFDLGNBQWM7UUFDdEQsQ0FBQyxDQUFDLElBQUksZ0RBQTBCLENBQUM7WUFDN0IsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO1lBQ3JCLFNBQVMsRUFBRSxjQUFjLENBQUMsU0FBUztTQUNwQyxDQUFDO1FBQ0osQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUVkLEtBQUssTUFBTSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLElBQUksYUFBYSxDQUFDLE9BQU8sRUFBRTtRQUNsRSxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxjQUFjLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDaEYsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUNuRSxNQUFNLFNBQVMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLHNCQUFzQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzdFLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSwwQkFBMEIsQ0FDdkQsT0FBTyxFQUNQLE9BQU8sRUFDUCxZQUFZLEVBQ1osZUFBZSxDQUNoQixDQUFDO1FBRUYsTUFBTSxFQUFFLGVBQWUsRUFBRSxZQUFZLEVBQUUsR0FBRyx3REFBYSxnQkFBZ0IsR0FBQyxDQUFDO1FBRXpFLE1BQU0sY0FBYyxHQUNsQixZQUFZLENBQUM7UUFFZixJQUFJLENBQUMsQ0FBQyxjQUFjLElBQUksZUFBZSxDQUFDLEVBQUU7WUFDeEMsTUFBTSxJQUFJLEtBQUssQ0FDYixzRUFBc0UsZ0JBQWdCLEdBQUcsQ0FDMUYsQ0FBQztTQUNIO1FBRUQsdUNBQXVDO1FBQ3ZDLE1BQU0sVUFBVSxHQUFHO1lBQ2pCLFFBQVEsRUFBRSxTQUFTO1lBQ25CLEdBQUcsRUFBRSxPQUFPLENBQUMsS0FBSztTQUNuQixDQUFDO1FBRUYsSUFBSSxJQUFJLEdBQUcsTUFBTSxjQUFjLENBQUMsZUFBZSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzdELG1DQUFtQztRQUNuQyxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsZUFBZTtZQUM3QyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLGVBQWUsQ0FBQztZQUMxQyxDQUFDLENBQUMsc0JBQXNCLENBQUM7UUFFM0IsSUFBSSwwQkFBMEIsRUFBRTtZQUM5QixNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsR0FBRyxNQUFNLDBCQUEwQixDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7Z0JBQ25GLFVBQVU7YUFDWCxDQUFDLENBQUM7WUFDSCxJQUFJLEdBQUcsT0FBTyxDQUFDO1lBRWYsSUFBSSxRQUFRLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Z0JBQ3BDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDZixRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNoRCxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMvQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7YUFDakI7U0FDRjtRQUVELE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRW5ELElBQUksY0FBYyxDQUFDLGFBQWEsRUFBRTtZQUNoQyxNQUFNLElBQUEsNENBQTJCLEVBQy9CLFdBQVcsRUFDWCxJQUFJLEVBQ0osVUFBVSxFQUNWLFFBQVEsYUFBUixRQUFRLGNBQVIsUUFBUSxHQUFJLEdBQUcsRUFDZixjQUFjLENBQUMsY0FBYyxDQUM5QixDQUFDO1NBQ0g7S0FDRjtJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUM7QUFFRCxLQUFLLFVBQVUsMEJBQTBCLENBQ3ZDLE9BQW1DLEVBQ25DLE9BQXVCLEVBQ3ZCLFlBQWlDLEVBQ2pDLHNCQUE4QjtJQUU5QixJQUFJLE9BQU8sQ0FBQyxlQUFlLEVBQUU7UUFDM0IsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0tBQ2xFO0lBRUQsTUFBTSxFQUFFLGNBQWMsR0FBRyxFQUFFLEVBQUUsR0FBRyxZQUFZLENBQUM7SUFDN0MsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsc0JBQXNCLENBQUMsQ0FBQztJQUVyRSxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsRUFBRTtRQUM5QixNQUFNLElBQUksS0FBSyxDQUFDLDJDQUEyQyxVQUFVLEdBQUcsQ0FBQyxDQUFDO0tBQzNFO0lBRUQsTUFBTSxFQUFFLEdBQUcsa0NBQWtDLENBQUM7SUFDOUMsTUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUVyRSxJQUFJLENBQUMsU0FBUyxFQUFFO1FBQ2QsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0tBQ3BEO0lBRUQsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsQ0FBQztBQUMxQyxDQUFDO0FBRUQsS0FBSyxVQUFVLGdCQUFnQixDQUM3QixPQUFtQyxFQUNuQyxPQUF1QjtJQUV2QixNQUFNLGFBQWEsR0FBRyxJQUFBLGtDQUFzQixFQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNwRSxNQUFNLFlBQVksR0FBRyxJQUFBLGtDQUFzQixFQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUVsRSw4Q0FBOEM7SUFDOUMsdUVBQXVFO0lBQ3ZFLE1BQU0sY0FBYyxHQUFHLENBQUMsTUFBTSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQy9DLENBQUM7SUFFdkIsTUFBTSxZQUFZLEdBQUcsSUFBQSw2QkFBcUIsRUFBQyxjQUFjLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDeEUsWUFBWSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEdBQUcsS0FBSyxDQUFDO0lBRTNDLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxPQUFPLENBQUMsY0FBYyxDQUFDLGFBQWEsRUFBRTtRQUNuRSxLQUFLLEVBQUUsS0FBSztRQUNaLGFBQWEsRUFBRSxLQUFLO1FBQ3BCLFlBQVksRUFBRSxZQUFxQztLQUNwRCxDQUFDLENBQUM7SUFDSCxNQUFNLGVBQWUsR0FBRyxNQUFNLE9BQU8sQ0FBQyxjQUFjLENBQUMsWUFBWSxFQUFFO1FBQ2pFLEtBQUssRUFBRSxLQUFLO0tBQ2IsQ0FBQyxDQUFDO0lBRUgsSUFBSSxPQUE0QixDQUFDO0lBRWpDLElBQUk7UUFDRixNQUFNLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQztZQUN0RCxnQkFBZ0IsQ0FBQyxNQUF1QztZQUN4RCxlQUFlLENBQUMsTUFBc0M7U0FDdkQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxhQUFhLENBQUMsT0FBTyxLQUFLLEtBQUssSUFBSSxhQUFhLENBQUMsY0FBYyxLQUFLLFNBQVMsRUFBRTtZQUNqRixPQUFPLGFBQWEsQ0FBQztTQUN0QjthQUFNLElBQUksWUFBWSxDQUFDLE9BQU8sS0FBSyxLQUFLLEVBQUU7WUFDekMsT0FBTyxZQUFZLENBQUM7U0FDckI7UUFFRCxPQUFPLEdBQUcsSUFBSSxpQkFBTyxFQUFFLENBQUM7UUFDeEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1FBQ2pELE1BQU0sTUFBTSxHQUFHLE1BQU0sZ0JBQWdCLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzlGLE9BQU8sQ0FBQyxPQUFPLENBQUMsd0NBQXdDLENBQUMsQ0FBQztRQUUxRCxPQUFPLE1BQU0sQ0FBQztLQUNmO0lBQUMsT0FBTyxHQUFHLEVBQUU7UUFDWixPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsSUFBSSxDQUFDLHNDQUFzQyxDQUFDLENBQUM7UUFFdEQsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztLQUMvQztZQUFTO1FBQ1IsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLEVBQUUsZUFBZSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztLQUN0RTtBQUNILENBQUM7QUFFRCxrQkFBZSxJQUFBLHlCQUFhLEVBQUMsZ0JBQWdCLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZGVyQ29udGV4dCxcbiAgQnVpbGRlck91dHB1dCxcbiAgY3JlYXRlQnVpbGRlcixcbiAgdGFyZ2V0RnJvbVRhcmdldFN0cmluZyxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBKc29uT2JqZWN0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IG5vcm1hbGl6ZU9wdGltaXphdGlvbiB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmxpbmUtY3JpdGljYWwtY3NzJztcbmltcG9ydCB7IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlciB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IFNwaW5uZXIgfSBmcm9tICcuLi8uLi91dGlscy9zcGlubmVyJztcbmltcG9ydCB7IEJyb3dzZXJCdWlsZGVyT3V0cHV0IH0gZnJvbSAnLi4vYnJvd3Nlcic7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBTZXJ2ZXJCdWlsZGVyT3V0cHV0IH0gZnJvbSAnLi4vc2VydmVyJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCdWlsZFdlYnBhY2tBcHBTaGVsbFNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcblxuYXN5bmMgZnVuY3Rpb24gX3JlbmRlclVuaXZlcnNhbChcbiAgb3B0aW9uczogQnVpbGRXZWJwYWNrQXBwU2hlbGxTY2hlbWEsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBicm93c2VyUmVzdWx0OiBCcm93c2VyQnVpbGRlck91dHB1dCxcbiAgc2VydmVyUmVzdWx0OiBTZXJ2ZXJCdWlsZGVyT3V0cHV0LFxuICBzcGlubmVyOiBTcGlubmVyLFxuKTogUHJvbWlzZTxCcm93c2VyQnVpbGRlck91dHB1dD4ge1xuICAvLyBHZXQgYnJvd3NlciB0YXJnZXQgb3B0aW9ucy5cbiAgY29uc3QgYnJvd3NlclRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5icm93c2VyVGFyZ2V0KTtcbiAgY29uc3QgcmF3QnJvd3Nlck9wdGlvbnMgPSAoYXdhaXQgY29udGV4dC5nZXRUYXJnZXRPcHRpb25zKGJyb3dzZXJUYXJnZXQpKSBhcyBKc29uT2JqZWN0ICZcbiAgICBCcm93c2VyQnVpbGRlclNjaGVtYTtcbiAgY29uc3QgYnJvd3NlckJ1aWxkZXJOYW1lID0gYXdhaXQgY29udGV4dC5nZXRCdWlsZGVyTmFtZUZvclRhcmdldChicm93c2VyVGFyZ2V0KTtcbiAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSBhd2FpdCBjb250ZXh0LnZhbGlkYXRlT3B0aW9uczxKc29uT2JqZWN0ICYgQnJvd3NlckJ1aWxkZXJTY2hlbWE+KFxuICAgIHJhd0Jyb3dzZXJPcHRpb25zLFxuICAgIGJyb3dzZXJCdWlsZGVyTmFtZSxcbiAgKTtcblxuICAvLyBJbml0aWFsaXplIHpvbmUuanNcbiAgY29uc3Qgcm9vdCA9IGNvbnRleHQud29ya3NwYWNlUm9vdDtcbiAgY29uc3Qgem9uZVBhY2thZ2UgPSByZXF1aXJlLnJlc29sdmUoJ3pvbmUuanMnLCB7IHBhdGhzOiBbcm9vdF0gfSk7XG4gIGF3YWl0IGltcG9ydCh6b25lUGFja2FnZSk7XG5cbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldCAmJiBjb250ZXh0LnRhcmdldC5wcm9qZWN0O1xuICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldC4nKTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3RNZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgY29uc3QgcHJvamVjdFJvb3QgPSBwYXRoLmpvaW4ocm9vdCwgKHByb2plY3RNZXRhZGF0YS5yb290IGFzIHN0cmluZyB8IHVuZGVmaW5lZCkgPz8gJycpO1xuXG4gIGNvbnN0IHsgc3R5bGVzIH0gPSBub3JtYWxpemVPcHRpbWl6YXRpb24oYnJvd3Nlck9wdGlvbnMub3B0aW1pemF0aW9uKTtcbiAgY29uc3QgaW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgPSBzdHlsZXMuaW5saW5lQ3JpdGljYWxcbiAgICA/IG5ldyBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvcih7XG4gICAgICAgIG1pbmlmeTogc3R5bGVzLm1pbmlmeSxcbiAgICAgICAgZGVwbG95VXJsOiBicm93c2VyT3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgICB9KVxuICAgIDogdW5kZWZpbmVkO1xuXG4gIGZvciAoY29uc3QgeyBwYXRoOiBvdXRwdXRQYXRoLCBiYXNlSHJlZiB9IG9mIGJyb3dzZXJSZXN1bHQub3V0cHV0cykge1xuICAgIGNvbnN0IGxvY2FsZURpcmVjdG9yeSA9IHBhdGgucmVsYXRpdmUoYnJvd3NlclJlc3VsdC5iYXNlT3V0cHV0UGF0aCwgb3V0cHV0UGF0aCk7XG4gICAgY29uc3QgYnJvd3NlckluZGV4T3V0cHV0UGF0aCA9IHBhdGguam9pbihvdXRwdXRQYXRoLCAnaW5kZXguaHRtbCcpO1xuICAgIGNvbnN0IGluZGV4SHRtbCA9IGF3YWl0IGZzLnByb21pc2VzLnJlYWRGaWxlKGJyb3dzZXJJbmRleE91dHB1dFBhdGgsICd1dGY4Jyk7XG4gICAgY29uc3Qgc2VydmVyQnVuZGxlUGF0aCA9IGF3YWl0IF9nZXRTZXJ2ZXJNb2R1bGVCdW5kbGVQYXRoKFxuICAgICAgb3B0aW9ucyxcbiAgICAgIGNvbnRleHQsXG4gICAgICBzZXJ2ZXJSZXN1bHQsXG4gICAgICBsb2NhbGVEaXJlY3RvcnksXG4gICAgKTtcblxuICAgIGNvbnN0IHsgQXBwU2VydmVyTW9kdWxlLCByZW5kZXJNb2R1bGUgfSA9IGF3YWl0IGltcG9ydChzZXJ2ZXJCdW5kbGVQYXRoKTtcblxuICAgIGNvbnN0IHJlbmRlck1vZHVsZUZuOiAoKG1vZHVsZTogdW5rbm93biwgb3B0aW9uczoge30pID0+IFByb21pc2U8c3RyaW5nPikgfCB1bmRlZmluZWQgPVxuICAgICAgcmVuZGVyTW9kdWxlO1xuXG4gICAgaWYgKCEocmVuZGVyTW9kdWxlRm4gJiYgQXBwU2VydmVyTW9kdWxlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgcmVuZGVyTW9kdWxlIG1ldGhvZCBhbmQvb3IgQXBwU2VydmVyTW9kdWxlIHdlcmUgbm90IGV4cG9ydGVkIGZyb206ICR7c2VydmVyQnVuZGxlUGF0aH0uYCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gTG9hZCBwbGF0Zm9ybSBzZXJ2ZXIgbW9kdWxlIHJlbmRlcmVyXG4gICAgY29uc3QgcmVuZGVyT3B0cyA9IHtcbiAgICAgIGRvY3VtZW50OiBpbmRleEh0bWwsXG4gICAgICB1cmw6IG9wdGlvbnMucm91dGUsXG4gICAgfTtcblxuICAgIGxldCBodG1sID0gYXdhaXQgcmVuZGVyTW9kdWxlRm4oQXBwU2VydmVyTW9kdWxlLCByZW5kZXJPcHRzKTtcbiAgICAvLyBPdmVyd3JpdGUgdGhlIGNsaWVudCBpbmRleCBmaWxlLlxuICAgIGNvbnN0IG91dHB1dEluZGV4UGF0aCA9IG9wdGlvbnMub3V0cHV0SW5kZXhQYXRoXG4gICAgICA/IHBhdGguam9pbihyb290LCBvcHRpb25zLm91dHB1dEluZGV4UGF0aClcbiAgICAgIDogYnJvd3NlckluZGV4T3V0cHV0UGF0aDtcblxuICAgIGlmIChpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvcikge1xuICAgICAgY29uc3QgeyBjb250ZW50LCB3YXJuaW5ncywgZXJyb3JzIH0gPSBhd2FpdCBpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvci5wcm9jZXNzKGh0bWwsIHtcbiAgICAgICAgb3V0cHV0UGF0aCxcbiAgICAgIH0pO1xuICAgICAgaHRtbCA9IGNvbnRlbnQ7XG5cbiAgICAgIGlmICh3YXJuaW5ncy5sZW5ndGggfHwgZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICBzcGlubmVyLnN0b3AoKTtcbiAgICAgICAgd2FybmluZ3MuZm9yRWFjaCgobSkgPT4gY29udGV4dC5sb2dnZXIud2FybihtKSk7XG4gICAgICAgIGVycm9ycy5mb3JFYWNoKChtKSA9PiBjb250ZXh0LmxvZ2dlci5lcnJvcihtKSk7XG4gICAgICAgIHNwaW5uZXIuc3RhcnQoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhd2FpdCBmcy5wcm9taXNlcy53cml0ZUZpbGUob3V0cHV0SW5kZXhQYXRoLCBodG1sKTtcblxuICAgIGlmIChicm93c2VyT3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgICBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIoXG4gICAgICAgIHByb2plY3RSb290LFxuICAgICAgICByb290LFxuICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICBiYXNlSHJlZiA/PyAnLycsXG4gICAgICAgIGJyb3dzZXJPcHRpb25zLm5nc3dDb25maWdQYXRoLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnJvd3NlclJlc3VsdDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2dldFNlcnZlck1vZHVsZUJ1bmRsZVBhdGgoXG4gIG9wdGlvbnM6IEJ1aWxkV2VicGFja0FwcFNoZWxsU2NoZW1hLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgc2VydmVyUmVzdWx0OiBTZXJ2ZXJCdWlsZGVyT3V0cHV0LFxuICBicm93c2VyTG9jYWxlRGlyZWN0b3J5OiBzdHJpbmcsXG4pIHtcbiAgaWYgKG9wdGlvbnMuYXBwTW9kdWxlQnVuZGxlKSB7XG4gICAgcmV0dXJuIHBhdGguam9pbihjb250ZXh0LndvcmtzcGFjZVJvb3QsIG9wdGlvbnMuYXBwTW9kdWxlQnVuZGxlKTtcbiAgfVxuXG4gIGNvbnN0IHsgYmFzZU91dHB1dFBhdGggPSAnJyB9ID0gc2VydmVyUmVzdWx0O1xuICBjb25zdCBvdXRwdXRQYXRoID0gcGF0aC5qb2luKGJhc2VPdXRwdXRQYXRoLCBicm93c2VyTG9jYWxlRGlyZWN0b3J5KTtcblxuICBpZiAoIWZzLmV4aXN0c1N5bmMob3V0cHV0UGF0aCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kIHNlcnZlciBvdXRwdXQgZGlyZWN0b3J5OiAke291dHB1dFBhdGh9LmApO1xuICB9XG5cbiAgY29uc3QgcmUgPSAvXm1haW5cXC4oPzpbYS16QS1aMC05XXsxNn1cXC4pP2pzJC87XG4gIGNvbnN0IG1heWJlTWFpbiA9IGZzLnJlYWRkaXJTeW5jKG91dHB1dFBhdGgpLmZpbmQoKHgpID0+IHJlLnRlc3QoeCkpO1xuXG4gIGlmICghbWF5YmVNYWluKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCB0aGUgbWFpbiBidW5kbGUuJyk7XG4gIH1cblxuICByZXR1cm4gcGF0aC5qb2luKG91dHB1dFBhdGgsIG1heWJlTWFpbik7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9hcHBTaGVsbEJ1aWxkZXIoXG4gIG9wdGlvbnM6IEJ1aWxkV2VicGFja0FwcFNoZWxsU2NoZW1hLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IFByb21pc2U8QnVpbGRlck91dHB1dD4ge1xuICBjb25zdCBicm93c2VyVGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLmJyb3dzZXJUYXJnZXQpO1xuICBjb25zdCBzZXJ2ZXJUYXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuc2VydmVyVGFyZ2V0KTtcblxuICAvLyBOZXZlciBydW4gdGhlIGJyb3dzZXIgdGFyZ2V0IGluIHdhdGNoIG1vZGUuXG4gIC8vIElmIHNlcnZpY2Ugd29ya2VyIGlzIG5lZWRlZCwgaXQgd2lsbCBiZSBhZGRlZCBpbiBfcmVuZGVyVW5pdmVyc2FsKCk7XG4gIGNvbnN0IGJyb3dzZXJPcHRpb25zID0gKGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyhicm93c2VyVGFyZ2V0KSkgYXMgSnNvbk9iamVjdCAmXG4gICAgQnJvd3NlckJ1aWxkZXJTY2hlbWE7XG5cbiAgY29uc3Qgb3B0aW1pemF0aW9uID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbik7XG4gIG9wdGltaXphdGlvbi5zdHlsZXMuaW5saW5lQ3JpdGljYWwgPSBmYWxzZTtcblxuICBjb25zdCBicm93c2VyVGFyZ2V0UnVuID0gYXdhaXQgY29udGV4dC5zY2hlZHVsZVRhcmdldChicm93c2VyVGFyZ2V0LCB7XG4gICAgd2F0Y2g6IGZhbHNlLFxuICAgIHNlcnZpY2VXb3JrZXI6IGZhbHNlLFxuICAgIG9wdGltaXphdGlvbjogb3B0aW1pemF0aW9uIGFzIHVua25vd24gYXMgSnNvbk9iamVjdCxcbiAgfSk7XG4gIGNvbnN0IHNlcnZlclRhcmdldFJ1biA9IGF3YWl0IGNvbnRleHQuc2NoZWR1bGVUYXJnZXQoc2VydmVyVGFyZ2V0LCB7XG4gICAgd2F0Y2g6IGZhbHNlLFxuICB9KTtcblxuICBsZXQgc3Bpbm5lcjogU3Bpbm5lciB8IHVuZGVmaW5lZDtcblxuICB0cnkge1xuICAgIGNvbnN0IFticm93c2VyUmVzdWx0LCBzZXJ2ZXJSZXN1bHRdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgYnJvd3NlclRhcmdldFJ1bi5yZXN1bHQgYXMgUHJvbWlzZTxCcm93c2VyQnVpbGRlck91dHB1dD4sXG4gICAgICBzZXJ2ZXJUYXJnZXRSdW4ucmVzdWx0IGFzIFByb21pc2U8U2VydmVyQnVpbGRlck91dHB1dD4sXG4gICAgXSk7XG5cbiAgICBpZiAoYnJvd3NlclJlc3VsdC5zdWNjZXNzID09PSBmYWxzZSB8fCBicm93c2VyUmVzdWx0LmJhc2VPdXRwdXRQYXRoID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBicm93c2VyUmVzdWx0O1xuICAgIH0gZWxzZSBpZiAoc2VydmVyUmVzdWx0LnN1Y2Nlc3MgPT09IGZhbHNlKSB7XG4gICAgICByZXR1cm4gc2VydmVyUmVzdWx0O1xuICAgIH1cblxuICAgIHNwaW5uZXIgPSBuZXcgU3Bpbm5lcigpO1xuICAgIHNwaW5uZXIuc3RhcnQoJ0dlbmVyYXRpbmcgYXBwbGljYXRpb24gc2hlbGwuLi4nKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBfcmVuZGVyVW5pdmVyc2FsKG9wdGlvbnMsIGNvbnRleHQsIGJyb3dzZXJSZXN1bHQsIHNlcnZlclJlc3VsdCwgc3Bpbm5lcik7XG4gICAgc3Bpbm5lci5zdWNjZWVkKCdBcHBsaWNhdGlvbiBzaGVsbCBnZW5lcmF0aW9uIGNvbXBsZXRlLicpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgc3Bpbm5lcj8uZmFpbCgnQXBwbGljYXRpb24gc2hlbGwgZ2VuZXJhdGlvbiBmYWlsZWQuJyk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XG4gIH0gZmluYWxseSB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW2Jyb3dzZXJUYXJnZXRSdW4uc3RvcCgpLCBzZXJ2ZXJUYXJnZXRSdW4uc3RvcCgpXSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcihfYXBwU2hlbGxCdWlsZGVyKTtcbiJdfQ==