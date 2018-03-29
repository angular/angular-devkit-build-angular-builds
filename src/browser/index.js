"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular-devkit/core");
const Observable_1 = require("rxjs/Observable");
const of_1 = require("rxjs/observable/of");
const operators_1 = require("rxjs/operators");
const webpack = require("webpack");
const webpack_configs_1 = require("../angular-cli-files/models/webpack-configs");
const utils_1 = require("../angular-cli-files/models/webpack-configs/utils");
const read_tsconfig_1 = require("../angular-cli-files/utilities/read-tsconfig");
const require_project_module_1 = require("../angular-cli-files/utilities/require-project-module");
const service_worker_1 = require("../angular-cli-files/utilities/service-worker");
const stats_1 = require("../angular-cli-files/utilities/stats");
const webpackMerge = require('webpack-merge');
class BrowserBuilder {
    constructor(context) {
        this.context = context;
    }
    run(builderConfig) {
        const options = builderConfig.options;
        const root = this.context.workspace.root;
        const projectRoot = core_1.resolve(root, builderConfig.root);
        return of_1.of(null).pipe(operators_1.concatMap(() => options.deleteOutputPath
            ? this._deleteOutputDir(root, core_1.normalize(options.outputPath), this.context.host)
            : of_1.of(null)), operators_1.concatMap(() => new Observable_1.Observable(obs => {
            // Ensure Build Optimizer is only used with AOT.
            if (options.buildOptimizer && !options.aot) {
                throw new Error('The `--build-optimizer` option cannot be used without `--aot`.');
            }
            let webpackConfig;
            try {
                webpackConfig = this.buildWebpackConfig(root, projectRoot, options);
            }
            catch (e) {
                // TODO: why do I have to catch this error? I thought throwing inside an observable
                // always got converted into an error.
                obs.error(e);
                return;
            }
            const webpackCompiler = webpack(webpackConfig);
            const statsConfig = utils_1.getWebpackStatsConfig(options.verbose);
            const callback = (err, stats) => {
                if (err) {
                    return obs.error(err);
                }
                const json = stats.toJson(statsConfig);
                if (options.verbose) {
                    this.context.logger.info(stats.toString(statsConfig));
                }
                else {
                    this.context.logger.info(stats_1.statsToString(json, statsConfig));
                }
                if (stats.hasWarnings()) {
                    this.context.logger.warn(stats_1.statsWarningsToString(json, statsConfig));
                }
                if (stats.hasErrors()) {
                    this.context.logger.error(stats_1.statsErrorsToString(json, statsConfig));
                }
                if (options.watch) {
                    obs.next({ success: !stats.hasErrors() });
                    // Never complete on watch mode.
                    return;
                }
                else {
                    if (builderConfig.options.serviceWorker) {
                        service_worker_1.augmentAppWithServiceWorker(this.context.host, root, projectRoot, core_1.resolve(root, core_1.normalize(options.outputPath)), options.baseHref || '/').then(() => {
                            obs.next({ success: !stats.hasErrors() });
                            obs.complete();
                        }, (err) => {
                            // We error out here because we're not in watch mode anyway (see above).
                            obs.error(err);
                        });
                    }
                    else {
                        obs.next({ success: !stats.hasErrors() });
                        obs.complete();
                    }
                }
            };
            try {
                if (options.watch) {
                    const watching = webpackCompiler.watch({ poll: options.poll }, callback);
                    // Teardown logic. Close the watcher when unsubscribed from.
                    return () => watching.close(() => { });
                }
                else {
                    webpackCompiler.run(callback);
                }
            }
            catch (err) {
                if (err) {
                    this.context.logger.error('\nAn error occured during the build:\n' + ((err && err.stack) || err));
                }
                throw err;
            }
        })));
    }
    buildWebpackConfig(root, projectRoot, options) {
        let wco;
        const host = new core_1.virtualFs.AliasHost(this.context.host);
        options.fileReplacements.forEach(({ from, to }) => {
            host.aliases.set(core_1.join(root, core_1.normalize(from)), core_1.join(root, core_1.normalize(to)));
        });
        // TODO: make target defaults into configurations instead
        // options = this.addTargetDefaults(options);
        const tsconfigPath = core_1.normalize(core_1.resolve(root, core_1.normalize(options.tsConfig)));
        const tsConfig = read_tsconfig_1.readTsconfig(core_1.getSystemPath(tsconfigPath));
        const projectTs = require_project_module_1.requireProjectModule(core_1.getSystemPath(projectRoot), 'typescript');
        const supportES2015 = tsConfig.options.target !== projectTs.ScriptTarget.ES3
            && tsConfig.options.target !== projectTs.ScriptTarget.ES5;
        // TODO: inside the configs, always use the project root and not the workspace root.
        // Until then we have to pretend the app root is relative (``) but the same as `projectRoot`.
        options.root = ''; // tslint:disable-line:no-any
        wco = {
            root: core_1.getSystemPath(root),
            projectRoot: core_1.getSystemPath(projectRoot),
            // TODO: use only this.options, it contains all flags and configs items already.
            buildOptions: options,
            appConfig: options,
            tsConfig,
            supportES2015,
        };
        // TODO: add the old dev options as the default, and the prod one as a configuration:
        // development: {
        //   environment: 'dev',
        //   outputHashing: 'media',
        //   sourcemaps: true,
        //   extractCss: false,
        //   namedChunks: true,
        //   aot: false,
        //   vendorChunk: true,
        //   buildOptimizer: false,
        // },
        // production: {
        //   environment: 'prod',
        //   outputHashing: 'all',
        //   sourcemaps: false,
        //   extractCss: true,
        //   namedChunks: false,
        //   aot: true,
        //   extractLicenses: true,
        //   vendorChunk: false,
        //   buildOptimizer: buildOptions.aot !== false,
        // }
        const webpackConfigs = [
            webpack_configs_1.getCommonConfig(wco),
            webpack_configs_1.getBrowserConfig(wco),
            webpack_configs_1.getStylesConfig(wco),
        ];
        if (wco.appConfig.main || wco.appConfig.polyfills) {
            const typescriptConfigPartial = wco.buildOptions.aot
                ? webpack_configs_1.getAotConfig(wco, host)
                : webpack_configs_1.getNonAotConfig(wco, host);
            webpackConfigs.push(typescriptConfigPartial);
        }
        return webpackMerge(webpackConfigs);
    }
    _deleteOutputDir(root, outputPath, host) {
        const resolvedOutputPath = core_1.resolve(root, outputPath);
        if (resolvedOutputPath === root) {
            throw new Error('Output path MUST not be project root directory!');
        }
        return host.exists(resolvedOutputPath).pipe(operators_1.concatMap(exists => exists
            // TODO: remove this concat once host ops emit an event.
            ? host.delete(resolvedOutputPath).pipe(operators_1.concat(of_1.of(null)))
            // ? of(null)
            : of_1.of(null)));
    }
}
exports.BrowserBuilder = BrowserBuilder;
exports.default = BrowserBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2Jyb3dzZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFhQSwrQ0FBZ0c7QUFFaEcsZ0RBQTZDO0FBQzdDLDJDQUF3QztBQUN4Qyw4Q0FBbUQ7QUFFbkQsbUNBQW1DO0FBQ25DLGlGQU1xRDtBQUNyRCw2RUFBMEY7QUFFMUYsZ0ZBQTRFO0FBQzVFLGtHQUE2RjtBQUM3RixrRkFBNEY7QUFDNUYsZ0VBSThDO0FBQzlDLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQWlGOUM7SUFFRSxZQUFtQixPQUF1QjtRQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtJQUFJLENBQUM7SUFFL0MsR0FBRyxDQUFDLGFBQTBEO1FBQzVELE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7UUFDdEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3pDLE1BQU0sV0FBVyxHQUFHLGNBQU8sQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXRELE1BQU0sQ0FBQyxPQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUNsQixxQkFBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0I7WUFDdEMsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsZ0JBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7WUFDL0UsQ0FBQyxDQUFDLE9BQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUNiLHFCQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSx1QkFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lB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QUF1QixDQUFDLENBQUM7UUFDL0MsQ0FBQztRQUVELE1BQU0sQ0FBQyxZQUFZLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDdEMsQ0FBQztJQUVPLGdCQUFnQixDQUFDLElBQVUsRUFBRSxVQUFnQixFQUFFLElBQW9CO1FBQ3pFLE1BQU0sa0JBQWtCLEdBQUcsY0FBTyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNyRCxFQUFFLENBQUMsQ0FBQyxrQkFBa0IsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLE1BQU0sSUFBSSxLQUFLLENBQUMsaURBQWlELENBQUMsQ0FBQztRQUNyRSxDQUFDO1FBRUQsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxJQUFJLENBQ3pDLHFCQUFTLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNO1lBQ3hCLHdEQUF3RDtZQUN4RCxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBTSxDQUFDLE9BQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ3hELGFBQWE7WUFDYixDQUFDLENBQUMsT0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQ2QsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQXJNRCx3Q0FxTUM7QUFFRCxrQkFBZSxjQUFjLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge1xuICBCdWlsZEV2ZW50LFxuICBCdWlsZGVyLFxuICBCdWlsZGVyQ29uZmlndXJhdGlvbixcbiAgQnVpbGRlckNvbnRleHQsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgUGF0aCwgZ2V0U3lzdGVtUGF0aCwgam9pbiwgbm9ybWFsaXplLCByZXNvbHZlLCB2aXJ0dWFsRnMgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlIH0gZnJvbSAncnhqcy9PYnNlcnZhYmxlJztcbmltcG9ydCB7IG9mIH0gZnJvbSAncnhqcy9vYnNlcnZhYmxlL29mJztcbmltcG9ydCB7IGNvbmNhdCwgY29uY2F0TWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG5pbXBvcnQgKiBhcyB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHtcbiAgZ2V0QW90Q29uZmlnLFxuICBnZXRCcm93c2VyQ29uZmlnLFxuICBnZXRDb21tb25Db25maWcsXG4gIGdldE5vbkFvdENvbmZpZyxcbiAgZ2V0U3R5bGVzQ29uZmlnLFxufSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzJztcbmltcG9ydCB7IGdldFdlYnBhY2tTdGF0c0NvbmZpZyB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL21vZGVscy93ZWJwYWNrLWNvbmZpZ3MvdXRpbHMnO1xuaW1wb3J0IHsgQnVkZ2V0IH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL2J1bmRsZS1jYWxjdWxhdG9yJztcbmltcG9ydCB7IHJlYWRUc2NvbmZpZyB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9yZWFkLXRzY29uZmlnJztcbmltcG9ydCB7IHJlcXVpcmVQcm9qZWN0TW9kdWxlIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3JlcXVpcmUtcHJvamVjdC1tb2R1bGUnO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7XG4gIHN0YXRzRXJyb3JzVG9TdHJpbmcsXG4gIHN0YXRzVG9TdHJpbmcsXG4gIHN0YXRzV2FybmluZ3NUb1N0cmluZyxcbn0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3N0YXRzJztcbmNvbnN0IHdlYnBhY2tNZXJnZSA9IHJlcXVpcmUoJ3dlYnBhY2stbWVyZ2UnKTtcblxuXG4vLyBUT0RPOiBVc2UgcXVpY2t0eXBlIHRvIGJ1aWxkIG91ciBUeXBlU2NyaXB0IGludGVyZmFjZXMgZnJvbSB0aGUgSlNPTiBTY2hlbWEgaXRzZWxmLCBpblxuLy8gdGhlIGJ1aWxkIHN5c3RlbS5cbmV4cG9ydCBpbnRlcmZhY2UgQnJvd3NlckJ1aWxkZXJPcHRpb25zIHtcbiAgb3V0cHV0UGF0aDogc3RyaW5nO1xuICBpbmRleDogc3RyaW5nO1xuICBtYWluOiBzdHJpbmc7XG4gIHRzQ29uZmlnOiBzdHJpbmc7IC8vIHByZXZpb3VzbHkgJ3RzY29uZmlnJy5cbiAgYW90OiBib29sZWFuO1xuICB2ZW5kb3JDaHVuazogYm9vbGVhbjtcbiAgY29tbW9uQ2h1bms6IGJvb2xlYW47XG4gIHZlcmJvc2U6IGJvb2xlYW47XG4gIHByb2dyZXNzOiBib29sZWFuO1xuICBleHRyYWN0Q3NzOiBib29sZWFuO1xuICB3YXRjaDogYm9vbGVhbjtcbiAgb3V0cHV0SGFzaGluZzogJ25vbmUnIHwgJ2FsbCcgfCAnbWVkaWEnIHwgJ2J1bmRsZXMnO1xuICBkZWxldGVPdXRwdXRQYXRoOiBib29sZWFuO1xuICBwcmVzZXJ2ZVN5bWxpbmtzOiBib29sZWFuO1xuICBleHRyYWN0TGljZW5zZXM6IGJvb2xlYW47XG4gIHNob3dDaXJjdWxhckRlcGVuZGVuY2llczogYm9vbGVhbjtcbiAgYnVpbGRPcHRpbWl6ZXI6IGJvb2xlYW47XG4gIG5hbWVkQ2h1bmtzOiBib29sZWFuO1xuICBzdWJyZXNvdXJjZUludGVncml0eTogYm9vbGVhbjtcbiAgc2VydmljZVdvcmtlcjogYm9vbGVhbjtcbiAgc2tpcEFwcFNoZWxsOiBib29sZWFuO1xuICBmb3JrVHlwZUNoZWNrZXI6IGJvb2xlYW47XG4gIHN0YXRzSnNvbjogYm9vbGVhbjtcbiAgbGF6eU1vZHVsZXM6IHN0cmluZ1tdO1xuICBidWRnZXRzOiBCdWRnZXRbXTtcblxuICAvLyBPcHRpb25zIHdpdGggbm8gZGVmYXVsdHMuXG4gIC8vIFRPRE86IHJlY29uc2lkZXIgdGhpcyBsaXN0LlxuICBwb2x5ZmlsbHM/OiBzdHJpbmc7XG4gIGJhc2VIcmVmPzogc3RyaW5nO1xuICBkZXBsb3lVcmw/OiBzdHJpbmc7XG4gIGkxOG5GaWxlPzogc3RyaW5nO1xuICBpMThuRm9ybWF0Pzogc3RyaW5nO1xuICBpMThuT3V0RmlsZT86IHN0cmluZztcbiAgaTE4bk91dEZvcm1hdD86IHN0cmluZztcbiAgcG9sbD86IG51bWJlcjtcblxuICAvLyBBIGNvdXBsZSBvZiBvcHRpb25zIGhhdmUgZGlmZmVyZW50IG5hbWVzLlxuICBzb3VyY2VNYXA6IGJvb2xlYW47IC8vIHByZXZpb3VzbHkgJ3NvdXJjZW1hcHMnLlxuICBldmFsU291cmNlTWFwOiBib29sZWFuOyAvLyBwcmV2aW91c2x5ICdldmFsU291cmNlbWFwcycuXG4gIG9wdGltaXphdGlvbjogYm9vbGVhbjsgLy8gcHJldmlvdXNseSAndGFyZ2V0Jy5cbiAgaTE4bkxvY2FsZT86IHN0cmluZzsgLy8gcHJldmlvdXNseSAnbG9jYWxlJy5cbiAgaTE4bk1pc3NpbmdUcmFuc2xhdGlvbj86IHN0cmluZzsgLy8gcHJldmlvdXNseSAnbWlzc2luZ1RyYW5zbGF0aW9uJy5cblxuICAvLyBUaGVzZSBvcHRpb25zIHdlcmUgbm90IGF2YWlsYWJsZSBhcyBmbGFncy5cbiAgYXNzZXRzOiBBc3NldFBhdHRlcm5bXTtcbiAgc2NyaXB0czogRXh0cmFFbnRyeVBvaW50W107XG4gIHN0eWxlczogRXh0cmFFbnRyeVBvaW50W107XG4gIHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9uczogeyBpbmNsdWRlUGF0aHM6IHN0cmluZ1tdIH07XG5cbiAgZmlsZVJlcGxhY2VtZW50czogeyBmcm9tOiBzdHJpbmc7IHRvOiBzdHJpbmc7IH1bXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBc3NldFBhdHRlcm4ge1xuICBnbG9iOiBzdHJpbmc7XG4gIGlucHV0OiBzdHJpbmc7XG4gIG91dHB1dDogc3RyaW5nO1xuICBhbGxvd091dHNpZGVPdXREaXI6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXh0cmFFbnRyeVBvaW50IHtcbiAgaW5wdXQ6IHN0cmluZztcbiAgb3V0cHV0Pzogc3RyaW5nO1xuICBsYXp5OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFdlYnBhY2tDb25maWdPcHRpb25zIHtcbiAgcm9vdDogc3RyaW5nO1xuICBwcm9qZWN0Um9vdDogc3RyaW5nO1xuICBidWlsZE9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucztcbiAgYXBwQ29uZmlnOiBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG4gIHRzQ29uZmlnOiB0cy5QYXJzZWRDb21tYW5kTGluZTtcbiAgc3VwcG9ydEVTMjAxNTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIEJyb3dzZXJCdWlsZGVyIGltcGxlbWVudHMgQnVpbGRlcjxCcm93c2VyQnVpbGRlck9wdGlvbnM+IHtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHsgfVxuXG4gIHJ1bihidWlsZGVyQ29uZmlnOiBCdWlsZGVyQ29uZmlndXJhdGlvbjxCcm93c2VyQnVpbGRlck9wdGlvbnM+KTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGJ1aWxkZXJDb25maWcub3B0aW9ucztcbiAgICBjb25zdCByb290ID0gdGhpcy5jb250ZXh0LndvcmtzcGFjZS5yb290O1xuICAgIGNvbnN0IHByb2plY3RSb290ID0gcmVzb2x2ZShyb290LCBidWlsZGVyQ29uZmlnLnJvb3QpO1xuXG4gICAgcmV0dXJuIG9mKG51bGwpLnBpcGUoXG4gICAgICBjb25jYXRNYXAoKCkgPT4gb3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoXG4gICAgICAgID8gdGhpcy5fZGVsZXRlT3V0cHV0RGlyKHJvb3QsIG5vcm1hbGl6ZShvcHRpb25zLm91dHB1dFBhdGgpLCB0aGlzLmNvbnRleHQuaG9zdClcbiAgICAgICAgOiBvZihudWxsKSksXG4gICAgICBjb25jYXRNYXAoKCkgPT4gbmV3IE9ic2VydmFibGUob2JzID0+IHtcbiAgICAgICAgLy8gRW5zdXJlIEJ1aWxkIE9wdGltaXplciBpcyBvbmx5IHVzZWQgd2l0aCBBT1QuXG4gICAgICAgIGlmIChvcHRpb25zLmJ1aWxkT3B0aW1pemVyICYmICFvcHRpb25zLmFvdCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGAtLWJ1aWxkLW9wdGltaXplcmAgb3B0aW9uIGNhbm5vdCBiZSB1c2VkIHdpdGhvdXQgYC0tYW90YC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB3ZWJwYWNrQ29uZmlnO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHdlYnBhY2tDb25maWcgPSB0aGlzLmJ1aWxkV2VicGFja0NvbmZpZyhyb290LCBwcm9qZWN0Um9vdCwgb3B0aW9ucyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAvLyBUT0RPOiB3aHkgZG8gSSBoYXZlIHRvIGNhdGNoIHRoaXMgZXJyb3I/IEkgdGhvdWdodCB0aHJvd2luZyBpbnNpZGUgYW4gb2JzZXJ2YWJsZVxuICAgICAgICAgIC8vIGFsd2F5cyBnb3QgY29udmVydGVkIGludG8gYW4gZXJyb3IuXG4gICAgICAgICAgb2JzLmVycm9yKGUpO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHdlYnBhY2tDb21waWxlciA9IHdlYnBhY2sod2VicGFja0NvbmZpZyk7XG4gICAgICAgIGNvbnN0IHN0YXRzQ29uZmlnID0gZ2V0V2VicGFja1N0YXRzQ29uZmlnKG9wdGlvbnMudmVyYm9zZSk7XG5cbiAgICAgICAgY29uc3QgY2FsbGJhY2s6IHdlYnBhY2suY29tcGlsZXIuQ29tcGlsZXJDYWxsYmFjayA9IChlcnIsIHN0YXRzKSA9PiB7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgcmV0dXJuIG9icy5lcnJvcihlcnIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGpzb24gPSBzdGF0cy50b0pzb24oc3RhdHNDb25maWcpO1xuICAgICAgICAgIGlmIChvcHRpb25zLnZlcmJvc2UpIHtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbyhzdGF0cy50b1N0cmluZyhzdGF0c0NvbmZpZykpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmluZm8oc3RhdHNUb1N0cmluZyhqc29uLCBzdGF0c0NvbmZpZykpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzdGF0cy5oYXNXYXJuaW5ncygpKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4oc3RhdHNXYXJuaW5nc1RvU3RyaW5nKGpzb24sIHN0YXRzQ29uZmlnKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzdGF0cy5oYXNFcnJvcnMoKSkge1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5lcnJvcihzdGF0c0Vycm9yc1RvU3RyaW5nKGpzb24sIHN0YXRzQ29uZmlnKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG9wdGlvbnMud2F0Y2gpIHtcbiAgICAgICAgICAgIG9icy5uZXh0KHsgc3VjY2VzczogIXN0YXRzLmhhc0Vycm9ycygpIH0pO1xuXG4gICAgICAgICAgICAvLyBOZXZlciBjb21wbGV0ZSBvbiB3YXRjaCBtb2RlLlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoYnVpbGRlckNvbmZpZy5vcHRpb25zLnNlcnZpY2VXb3JrZXIpIHtcbiAgICAgICAgICAgICAgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyKFxuICAgICAgICAgICAgICAgIHRoaXMuY29udGV4dC5ob3N0LFxuICAgICAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICAgICAgcHJvamVjdFJvb3QsXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShyb290LCBub3JtYWxpemUob3B0aW9ucy5vdXRwdXRQYXRoKSksXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5iYXNlSHJlZiB8fCAnLycsXG4gICAgICAgICAgICAgICkudGhlbihcbiAgICAgICAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICBvYnMubmV4dCh7IHN1Y2Nlc3M6ICFzdGF0cy5oYXNFcnJvcnMoKSB9KTtcbiAgICAgICAgICAgICAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgIC8vIFdlIGVycm9yIG91dCBoZXJlIGJlY2F1c2Ugd2UncmUgbm90IGluIHdhdGNoIG1vZGUgYW55d2F5IChzZWUgYWJvdmUpLlxuICAgICAgICAgICAgICAgICAgb2JzLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG9icy5uZXh0KHsgc3VjY2VzczogIXN0YXRzLmhhc0Vycm9ycygpIH0pO1xuICAgICAgICAgICAgICBvYnMuY29tcGxldGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBpZiAob3B0aW9ucy53YXRjaCkge1xuICAgICAgICAgICAgY29uc3Qgd2F0Y2hpbmcgPSB3ZWJwYWNrQ29tcGlsZXIud2F0Y2goeyBwb2xsOiBvcHRpb25zLnBvbGwgfSwgY2FsbGJhY2spO1xuXG4gICAgICAgICAgICAvLyBUZWFyZG93biBsb2dpYy4gQ2xvc2UgdGhlIHdhdGNoZXIgd2hlbiB1bnN1YnNjcmliZWQgZnJvbS5cbiAgICAgICAgICAgIHJldHVybiAoKSA9PiB3YXRjaGluZy5jbG9zZSgoKSA9PiB7IH0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3ZWJwYWNrQ29tcGlsZXIucnVuKGNhbGxiYWNrKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuZXJyb3IoXG4gICAgICAgICAgICAgICdcXG5BbiBlcnJvciBvY2N1cmVkIGR1cmluZyB0aGUgYnVpbGQ6XFxuJyArICgoZXJyICYmIGVyci5zdGFjaykgfHwgZXJyKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgfSkpLFxuICAgICk7XG4gIH1cblxuICBidWlsZFdlYnBhY2tDb25maWcoXG4gICAgcm9vdDogUGF0aCxcbiAgICBwcm9qZWN0Um9vdDogUGF0aCxcbiAgICBvcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gICkge1xuICAgIGxldCB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zO1xuXG4gICAgY29uc3QgaG9zdCA9IG5ldyB2aXJ0dWFsRnMuQWxpYXNIb3N0KHRoaXMuY29udGV4dC5ob3N0IGFzIHZpcnR1YWxGcy5Ib3N0PGZzLlN0YXRzPik7XG5cbiAgICBvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMuZm9yRWFjaCgoeyBmcm9tLCB0byB9KSA9PiB7XG4gICAgICBob3N0LmFsaWFzZXMuc2V0KFxuICAgICAgICBqb2luKHJvb3QsIG5vcm1hbGl6ZShmcm9tKSksXG4gICAgICAgIGpvaW4ocm9vdCwgbm9ybWFsaXplKHRvKSksXG4gICAgICApO1xuICAgIH0pO1xuXG4gICAgLy8gVE9ETzogbWFrZSB0YXJnZXQgZGVmYXVsdHMgaW50byBjb25maWd1cmF0aW9ucyBpbnN0ZWFkXG4gICAgLy8gb3B0aW9ucyA9IHRoaXMuYWRkVGFyZ2V0RGVmYXVsdHMob3B0aW9ucyk7XG5cbiAgICBjb25zdCB0c2NvbmZpZ1BhdGggPSBub3JtYWxpemUocmVzb2x2ZShyb290LCBub3JtYWxpemUob3B0aW9ucy50c0NvbmZpZyBhcyBzdHJpbmcpKSk7XG4gICAgY29uc3QgdHNDb25maWcgPSByZWFkVHNjb25maWcoZ2V0U3lzdGVtUGF0aCh0c2NvbmZpZ1BhdGgpKTtcblxuICAgIGNvbnN0IHByb2plY3RUcyA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLCAndHlwZXNjcmlwdCcpIGFzIHR5cGVvZiB0cztcblxuICAgIGNvbnN0IHN1cHBvcnRFUzIwMTUgPSB0c0NvbmZpZy5vcHRpb25zLnRhcmdldCAhPT0gcHJvamVjdFRzLlNjcmlwdFRhcmdldC5FUzNcbiAgICAgICYmIHRzQ29uZmlnLm9wdGlvbnMudGFyZ2V0ICE9PSBwcm9qZWN0VHMuU2NyaXB0VGFyZ2V0LkVTNTtcblxuXG4gICAgLy8gVE9ETzogaW5zaWRlIHRoZSBjb25maWdzLCBhbHdheXMgdXNlIHRoZSBwcm9qZWN0IHJvb3QgYW5kIG5vdCB0aGUgd29ya3NwYWNlIHJvb3QuXG4gICAgLy8gVW50aWwgdGhlbiB3ZSBoYXZlIHRvIHByZXRlbmQgdGhlIGFwcCByb290IGlzIHJlbGF0aXZlIChgYCkgYnV0IHRoZSBzYW1lIGFzIGBwcm9qZWN0Um9vdGAuXG4gICAgKG9wdGlvbnMgYXMgYW55KS5yb290ID0gJyc7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8tYW55XG5cbiAgICB3Y28gPSB7XG4gICAgICByb290OiBnZXRTeXN0ZW1QYXRoKHJvb3QpLFxuICAgICAgcHJvamVjdFJvb3Q6IGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLFxuICAgICAgLy8gVE9ETzogdXNlIG9ubHkgdGhpcy5vcHRpb25zLCBpdCBjb250YWlucyBhbGwgZmxhZ3MgYW5kIGNvbmZpZ3MgaXRlbXMgYWxyZWFkeS5cbiAgICAgIGJ1aWxkT3B0aW9uczogb3B0aW9ucyxcbiAgICAgIGFwcENvbmZpZzogb3B0aW9ucyxcbiAgICAgIHRzQ29uZmlnLFxuICAgICAgc3VwcG9ydEVTMjAxNSxcbiAgICB9O1xuXG5cbiAgICAvLyBUT0RPOiBhZGQgdGhlIG9sZCBkZXYgb3B0aW9ucyBhcyB0aGUgZGVmYXVsdCwgYW5kIHRoZSBwcm9kIG9uZSBhcyBhIGNvbmZpZ3VyYXRpb246XG4gICAgLy8gZGV2ZWxvcG1lbnQ6IHtcbiAgICAvLyAgIGVudmlyb25tZW50OiAnZGV2JyxcbiAgICAvLyAgIG91dHB1dEhhc2hpbmc6ICdtZWRpYScsXG4gICAgLy8gICBzb3VyY2VtYXBzOiB0cnVlLFxuICAgIC8vICAgZXh0cmFjdENzczogZmFsc2UsXG4gICAgLy8gICBuYW1lZENodW5rczogdHJ1ZSxcbiAgICAvLyAgIGFvdDogZmFsc2UsXG4gICAgLy8gICB2ZW5kb3JDaHVuazogdHJ1ZSxcbiAgICAvLyAgIGJ1aWxkT3B0aW1pemVyOiBmYWxzZSxcbiAgICAvLyB9LFxuICAgIC8vIHByb2R1Y3Rpb246IHtcbiAgICAvLyAgIGVudmlyb25tZW50OiAncHJvZCcsXG4gICAgLy8gICBvdXRwdXRIYXNoaW5nOiAnYWxsJyxcbiAgICAvLyAgIHNvdXJjZW1hcHM6IGZhbHNlLFxuICAgIC8vICAgZXh0cmFjdENzczogdHJ1ZSxcbiAgICAvLyAgIG5hbWVkQ2h1bmtzOiBmYWxzZSxcbiAgICAvLyAgIGFvdDogdHJ1ZSxcbiAgICAvLyAgIGV4dHJhY3RMaWNlbnNlczogdHJ1ZSxcbiAgICAvLyAgIHZlbmRvckNodW5rOiBmYWxzZSxcbiAgICAvLyAgIGJ1aWxkT3B0aW1pemVyOiBidWlsZE9wdGlvbnMuYW90ICE9PSBmYWxzZSxcbiAgICAvLyB9XG5cbiAgICBjb25zdCB3ZWJwYWNrQ29uZmlnczoge31bXSA9IFtcbiAgICAgIGdldENvbW1vbkNvbmZpZyh3Y28pLFxuICAgICAgZ2V0QnJvd3NlckNvbmZpZyh3Y28pLFxuICAgICAgZ2V0U3R5bGVzQ29uZmlnKHdjbyksXG4gICAgXTtcblxuICAgIGlmICh3Y28uYXBwQ29uZmlnLm1haW4gfHwgd2NvLmFwcENvbmZpZy5wb2x5ZmlsbHMpIHtcbiAgICAgIGNvbnN0IHR5cGVzY3JpcHRDb25maWdQYXJ0aWFsID0gd2NvLmJ1aWxkT3B0aW9ucy5hb3RcbiAgICAgICAgPyBnZXRBb3RDb25maWcod2NvLCBob3N0KVxuICAgICAgICA6IGdldE5vbkFvdENvbmZpZyh3Y28sIGhvc3QpO1xuICAgICAgd2VicGFja0NvbmZpZ3MucHVzaCh0eXBlc2NyaXB0Q29uZmlnUGFydGlhbCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHdlYnBhY2tNZXJnZSh3ZWJwYWNrQ29uZmlncyk7XG4gIH1cblxuICBwcml2YXRlIF9kZWxldGVPdXRwdXREaXIocm9vdDogUGF0aCwgb3V0cHV0UGF0aDogUGF0aCwgaG9zdDogdmlydHVhbEZzLkhvc3QpIHtcbiAgICBjb25zdCByZXNvbHZlZE91dHB1dFBhdGggPSByZXNvbHZlKHJvb3QsIG91dHB1dFBhdGgpO1xuICAgIGlmIChyZXNvbHZlZE91dHB1dFBhdGggPT09IHJvb3QpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignT3V0cHV0IHBhdGggTVVTVCBub3QgYmUgcHJvamVjdCByb290IGRpcmVjdG9yeSEnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaG9zdC5leGlzdHMocmVzb2x2ZWRPdXRwdXRQYXRoKS5waXBlKFxuICAgICAgY29uY2F0TWFwKGV4aXN0cyA9PiBleGlzdHNcbiAgICAgICAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgY29uY2F0IG9uY2UgaG9zdCBvcHMgZW1pdCBhbiBldmVudC5cbiAgICAgICAgPyBob3N0LmRlbGV0ZShyZXNvbHZlZE91dHB1dFBhdGgpLnBpcGUoY29uY2F0KG9mKG51bGwpKSlcbiAgICAgICAgLy8gPyBvZihudWxsKVxuICAgICAgICA6IG9mKG51bGwpKSxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJyb3dzZXJCdWlsZGVyO1xuIl19