"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const build_webpack_1 = require("@angular-devkit/build-webpack");
const core_1 = require("@angular-devkit/core");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const webpack_configs_1 = require("../angular-cli-files/models/webpack-configs");
const read_tsconfig_1 = require("../angular-cli-files/utilities/read-tsconfig");
const require_project_module_1 = require("../angular-cli-files/utilities/require-project-module");
const service_worker_1 = require("../angular-cli-files/utilities/service-worker");
const stats_1 = require("../angular-cli-files/utilities/stats");
const utils_1 = require("../utils");
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const webpackMerge = require('webpack-merge');
class BrowserBuilder {
    constructor(context) {
        this.context = context;
    }
    createWebpackBuilder(context) {
        return new build_webpack_1.WebpackBuilder(context);
    }
    createLoggingFactory() {
        return exports.getBrowserLoggingCb;
    }
    run(builderConfig) {
        const root = this.context.workspace.root;
        const projectRoot = core_1.resolve(root, builderConfig.root);
        const host = new core_1.virtualFs.AliasHost(this.context.host);
        const webpackBuilder = this.createWebpackBuilder(Object.assign({}, this.context, { host }));
        const getLoggingCb = this.createLoggingFactory();
        const options = utils_1.normalizeBrowserSchema(host, root, core_1.resolve(root, builderConfig.root), builderConfig.sourceRoot, builderConfig.options);
        return rxjs_1.of(null).pipe(operators_1.concatMap(() => options.deleteOutputPath
            ? this._deleteOutputDir(root, core_1.normalize(options.outputPath), this.context.host)
            : rxjs_1.of(null)), operators_1.concatMap(() => {
            let webpackConfig;
            try {
                webpackConfig = this.buildWebpackConfig(root, projectRoot, host, options);
            }
            catch (e) {
                return rxjs_1.throwError(e);
            }
            return webpackBuilder.runWebpack(webpackConfig, getLoggingCb(options.verbose || false));
        }), operators_1.concatMap(buildEvent => {
            if (buildEvent.success && !options.watch && options.serviceWorker) {
                return new rxjs_1.Observable(obs => {
                    service_worker_1.augmentAppWithServiceWorker(this.context.host, root, projectRoot, core_1.resolve(root, core_1.normalize(options.outputPath)), options.baseHref || '/', options.ngswConfigPath).then(() => {
                        obs.next({ success: true });
                        obs.complete();
                    }, (err) => {
                        obs.error(err);
                    });
                });
            }
            else {
                return rxjs_1.of(buildEvent);
            }
        }));
    }
    buildWebpackConfig(root, projectRoot, host, options) {
        // Ensure Build Optimizer is only used with AOT.
        if (options.buildOptimizer && !options.aot) {
            throw new Error(`The 'buildOptimizer' option cannot be used without 'aot'.`);
        }
        let wco;
        const tsConfigPath = core_1.getSystemPath(core_1.normalize(core_1.resolve(root, core_1.normalize(options.tsConfig))));
        const tsConfig = read_tsconfig_1.readTsconfig(tsConfigPath);
        const projectTs = require_project_module_1.requireProjectModule(core_1.getSystemPath(projectRoot), 'typescript');
        const supportES2015 = tsConfig.options.target !== projectTs.ScriptTarget.ES3
            && tsConfig.options.target !== projectTs.ScriptTarget.ES5;
        wco = {
            root: core_1.getSystemPath(root),
            logger: this.context.logger,
            projectRoot: core_1.getSystemPath(projectRoot),
            buildOptions: options,
            tsConfig,
            tsConfigPath,
            supportES2015,
        };
        wco.buildOptions.progress = utils_1.defaultProgress(wco.buildOptions.progress);
        const webpackConfigs = [
            webpack_configs_1.getCommonConfig(wco),
            webpack_configs_1.getBrowserConfig(wco),
            webpack_configs_1.getStylesConfig(wco),
            webpack_configs_1.getStatsConfig(wco),
        ];
        if (wco.buildOptions.main || wco.buildOptions.polyfills) {
            const typescriptConfigPartial = wco.buildOptions.aot
                ? webpack_configs_1.getAotConfig(wco, host)
                : webpack_configs_1.getNonAotConfig(wco, host);
            webpackConfigs.push(typescriptConfigPartial);
        }
        const webpackConfig = webpackMerge(webpackConfigs);
        if (options.profile) {
            const smp = new SpeedMeasurePlugin({
                outputFormat: 'json',
                outputTarget: core_1.getSystemPath(core_1.join(root, 'speed-measure-plugin.json')),
            });
            return smp.wrap(webpackConfig);
        }
        return webpackConfig;
    }
    _deleteOutputDir(root, outputPath, host) {
        const resolvedOutputPath = core_1.resolve(root, outputPath);
        if (resolvedOutputPath === root) {
            throw new Error('Output path MUST not be project root directory!');
        }
        return host.exists(resolvedOutputPath).pipe(operators_1.concatMap(exists => exists
            // TODO: remove this concat once host ops emit an event.
            ? rxjs_1.concat(host.delete(resolvedOutputPath), rxjs_1.of(null)).pipe(operators_1.last())
            // ? of(null)
            : rxjs_1.of(null)));
    }
}
exports.BrowserBuilder = BrowserBuilder;
exports.getBrowserLoggingCb = (verbose) => (stats, config, logger) => {
    // config.stats contains our own stats settings, added during buildWebpackConfig().
    const json = stats.toJson(config.stats);
    if (verbose) {
        logger.info(stats.toString(config.stats));
    }
    else {
        logger.info(stats_1.statsToString(json, config.stats));
    }
    if (stats.hasWarnings()) {
        logger.warn(stats_1.statsWarningsToString(json, config.stats));
    }
    if (stats.hasErrors()) {
        logger.error(stats_1.statsErrorsToString(json, config.stats));
    }
};
exports.default = BrowserBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2Jyb3dzZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFhQSxpRUFBZ0Y7QUFDaEYsK0NBQWdHO0FBRWhHLCtCQUEwRDtBQUMxRCw4Q0FBaUQ7QUFHakQsaUZBT3FEO0FBQ3JELGdGQUE0RTtBQUM1RSxrR0FBNkY7QUFDN0Ysa0ZBQTRGO0FBQzVGLGdFQUk4QztBQUM5QyxvQ0FBbUc7QUFFbkcsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsOEJBQThCLENBQUMsQ0FBQztBQUNuRSxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFFOUMsTUFBYSxjQUFjO0lBRXpCLFlBQW1CLE9BQXVCO1FBQXZCLFlBQU8sR0FBUCxPQUFPLENBQWdCO0lBQUksQ0FBQztJQUVyQyxvQkFBb0IsQ0FBQyxPQUF1QjtRQUNwRCxPQUFPLElBQUksOEJBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRVMsb0JBQW9CO1FBQzVCLE9BQU8sMkJBQW1CLENBQUM7SUFDN0IsQ0FBQztJQUVELEdBQUcsQ0FBQyxhQUF5RDtRQUMzRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDekMsTUFBTSxXQUFXLEdBQUcsY0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsTUFBTSxJQUFJLEdBQUcsSUFBSSxnQkFBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQWdDLENBQUMsQ0FBQztRQUNwRixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLG1CQUFNLElBQUksQ0FBQyxPQUFPLElBQUUsSUFBSSxJQUFHLENBQUM7UUFDNUUsTUFBTSxZQUFZLEdBQUcsSUFB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S0FBSyxDQUFDLENBQUM7SUFDeEMsSUFBSSxPQUFPLEVBQUU7UUFDWCxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7S0FDM0M7U0FBTTtRQUNMLE1BQU0sQ0FBQyxJQUFJLENBQUMscUJBQWEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7S0FDaEQ7SUFFRCxJQUFJLEtBQUssQ0FBQyxXQUFXLEVBQUUsRUFBRTtRQUN2QixNQUFNLENBQUMsSUFBSSxDQUFDLDZCQUFxQixDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztLQUN4RDtJQUNELElBQUksS0FBSyxDQUFDLFNBQVMsRUFBRSxFQUFFO1FBQ3JCLE1BQU0sQ0FBQyxLQUFLLENBQUMsMkJBQW1CLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0tBQ3ZEO0FBQ0gsQ0FBQyxDQUFDO0FBRUosa0JBQWUsY0FBYyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtcbiAgQnVpbGRFdmVudCxcbiAgQnVpbGRlcixcbiAgQnVpbGRlckNvbmZpZ3VyYXRpb24sXG4gIEJ1aWxkZXJDb250ZXh0LFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IExvZ2dpbmdDYWxsYmFjaywgV2VicGFja0J1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyBQYXRoLCBnZXRTeXN0ZW1QYXRoLCBqb2luLCBub3JtYWxpemUsIHJlc29sdmUsIHZpcnR1YWxGcyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGNvbmNhdCwgb2YsIHRocm93RXJyb3IgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbGFzdCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQge1xuICBnZXRBb3RDb25maWcsXG4gIGdldEJyb3dzZXJDb25maWcsXG4gIGdldENvbW1vbkNvbmZpZyxcbiAgZ2V0Tm9uQW90Q29uZmlnLFxuICBnZXRTdGF0c0NvbmZpZyxcbiAgZ2V0U3R5bGVzQ29uZmlnLFxufSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzJztcbmltcG9ydCB7IHJlYWRUc2NvbmZpZyB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9yZWFkLXRzY29uZmlnJztcbmltcG9ydCB7IHJlcXVpcmVQcm9qZWN0TW9kdWxlIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3JlcXVpcmUtcHJvamVjdC1tb2R1bGUnO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7XG4gIHN0YXRzRXJyb3JzVG9TdHJpbmcsXG4gIHN0YXRzVG9TdHJpbmcsXG4gIHN0YXRzV2FybmluZ3NUb1N0cmluZyxcbn0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3N0YXRzJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYSwgZGVmYXVsdFByb2dyZXNzLCBub3JtYWxpemVCcm93c2VyU2NoZW1hIH0gZnJvbSAnLi4vdXRpbHMnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuY29uc3QgU3BlZWRNZWFzdXJlUGx1Z2luID0gcmVxdWlyZSgnc3BlZWQtbWVhc3VyZS13ZWJwYWNrLXBsdWdpbicpO1xuY29uc3Qgd2VicGFja01lcmdlID0gcmVxdWlyZSgnd2VicGFjay1tZXJnZScpO1xuXG5leHBvcnQgY2xhc3MgQnJvd3NlckJ1aWxkZXIgaW1wbGVtZW50cyBCdWlsZGVyPEJyb3dzZXJCdWlsZGVyU2NoZW1hPiB7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KSB7IH1cblxuICBwcm90ZWN0ZWQgY3JlYXRlV2VicGFja0J1aWxkZXIoY29udGV4dDogQnVpbGRlckNvbnRleHQpOiBXZWJwYWNrQnVpbGRlciB7XG4gICAgcmV0dXJuIG5ldyBXZWJwYWNrQnVpbGRlcihjb250ZXh0KTtcbiAgfVxuXG4gIHByb3RlY3RlZCBjcmVhdGVMb2dnaW5nRmFjdG9yeSgpOiAodmVyYm9zZTogYm9vbGVhbikgPT4gTG9nZ2luZ0NhbGxiYWNrICB7XG4gICAgcmV0dXJuIGdldEJyb3dzZXJMb2dnaW5nQ2I7XG4gIH1cblxuICBydW4oYnVpbGRlckNvbmZpZzogQnVpbGRlckNvbmZpZ3VyYXRpb248QnJvd3NlckJ1aWxkZXJTY2hlbWE+KTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdDtcbiAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5yb290KTtcbiAgICBjb25zdCBob3N0ID0gbmV3IHZpcnR1YWxGcy5BbGlhc0hvc3QodGhpcy5jb250ZXh0Lmhvc3QgYXMgdmlydHVhbEZzLkhvc3Q8ZnMuU3RhdHM+KTtcbiAgICBjb25zdCB3ZWJwYWNrQnVpbGRlciA9IHRoaXMuY3JlYXRlV2VicGFja0J1aWxkZXIoeyAuLi50aGlzLmNvbnRleHQsIGhvc3QgfSk7XG4gICAgY29uc3QgZ2V0TG9nZ2luZ0NiID0gdGhpcy5jcmVhdGVMb2dnaW5nRmFjdG9yeSgpO1xuXG4gICAgY29uc3Qgb3B0aW9ucyA9IG5vcm1hbGl6ZUJyb3dzZXJTY2hlbWEoXG4gICAgICBob3N0LFxuICAgICAgcm9vdCxcbiAgICAgIHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5yb290KSxcbiAgICAgIGJ1aWxkZXJDb25maWcuc291cmNlUm9vdCxcbiAgICAgIGJ1aWxkZXJDb25maWcub3B0aW9ucyxcbiAgICApO1xuXG4gICAgcmV0dXJuIG9mKG51bGwpLnBpcGUoXG4gICAgICBjb25jYXRNYXAoKCkgPT4gb3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoXG4gICAgICAgID8gdGhpcy5fZGVsZXRlT3V0cHV0RGlyKHJvb3QsIG5vcm1hbGl6ZShvcHRpb25zLm91dHB1dFBhdGgpLCB0aGlzLmNvbnRleHQuaG9zdClcbiAgICAgICAgOiBvZihudWxsKSksXG4gICAgICBjb25jYXRNYXAoKCkgPT4ge1xuICAgICAgICBsZXQgd2VicGFja0NvbmZpZztcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB3ZWJwYWNrQ29uZmlnID0gdGhpcy5idWlsZFdlYnBhY2tDb25maWcocm9vdCwgcHJvamVjdFJvb3QsIGhvc3QsIG9wdGlvbnMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgcmV0dXJuIHRocm93RXJyb3IoZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gd2VicGFja0J1aWxkZXIucnVuV2VicGFjayh3ZWJwYWNrQ29uZmlnLCBnZXRMb2dnaW5nQ2Iob3B0aW9ucy52ZXJib3NlIHx8IGZhbHNlKSk7XG4gICAgICB9KSxcbiAgICAgIGNvbmNhdE1hcChidWlsZEV2ZW50ID0+IHtcbiAgICAgICAgaWYgKGJ1aWxkRXZlbnQuc3VjY2VzcyAmJiAhb3B0aW9ucy53YXRjaCAmJiBvcHRpb25zLnNlcnZpY2VXb3JrZXIpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IE9ic2VydmFibGUob2JzID0+IHtcbiAgICAgICAgICAgIGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlcihcbiAgICAgICAgICAgICAgdGhpcy5jb250ZXh0Lmhvc3QsXG4gICAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICAgIHByb2plY3RSb290LFxuICAgICAgICAgICAgICByZXNvbHZlKHJvb3QsIG5vcm1hbGl6ZShvcHRpb25zLm91dHB1dFBhdGgpKSxcbiAgICAgICAgICAgICAgb3B0aW9ucy5iYXNlSHJlZiB8fCAnLycsXG4gICAgICAgICAgICAgIG9wdGlvbnMubmdzd0NvbmZpZ1BhdGgsXG4gICAgICAgICAgICApLnRoZW4oXG4gICAgICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgICAgICBvYnMubmV4dCh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgb2JzLmNvbXBsZXRlKCk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgb2JzLmVycm9yKGVycik7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBvZihidWlsZEV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGJ1aWxkV2VicGFja0NvbmZpZyhcbiAgICByb290OiBQYXRoLFxuICAgIHByb2plY3RSb290OiBQYXRoLFxuICAgIGhvc3Q6IHZpcnR1YWxGcy5Ib3N0PGZzLlN0YXRzPixcbiAgICBvcHRpb25zOiBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICkge1xuICAgIC8vIEVuc3VyZSBCdWlsZCBPcHRpbWl6ZXIgaXMgb25seSB1c2VkIHdpdGggQU9ULlxuICAgIGlmIChvcHRpb25zLmJ1aWxkT3B0aW1pemVyICYmICFvcHRpb25zLmFvdCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJ2J1aWxkT3B0aW1pemVyJyBvcHRpb24gY2Fubm90IGJlIHVzZWQgd2l0aG91dCAnYW90Jy5gKTtcbiAgICB9XG5cbiAgICBsZXQgd2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9uczxOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWE+O1xuXG4gICAgY29uc3QgdHNDb25maWdQYXRoID0gZ2V0U3lzdGVtUGF0aChub3JtYWxpemUocmVzb2x2ZShyb290LCBub3JtYWxpemUob3B0aW9ucy50c0NvbmZpZykpKSk7XG4gICAgY29uc3QgdHNDb25maWcgPSByZWFkVHNjb25maWcodHNDb25maWdQYXRoKTtcblxuICAgIGNvbnN0IHByb2plY3RUcyA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLCAndHlwZXNjcmlwdCcpIGFzIHR5cGVvZiB0cztcblxuICAgIGNvbnN0IHN1cHBvcnRFUzIwMTUgPSB0c0NvbmZpZy5vcHRpb25zLnRhcmdldCAhPT0gcHJvamVjdFRzLlNjcmlwdFRhcmdldC5FUzNcbiAgICAgICYmIHRzQ29uZmlnLm9wdGlvbnMudGFyZ2V0ICE9PSBwcm9qZWN0VHMuU2NyaXB0VGFyZ2V0LkVTNTtcblxuICAgIHdjbyA9IHtcbiAgICAgIHJvb3Q6IGdldFN5c3RlbVBhdGgocm9vdCksXG4gICAgICBsb2dnZXI6IHRoaXMuY29udGV4dC5sb2dnZXIsXG4gICAgICBwcm9qZWN0Um9vdDogZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksXG4gICAgICBidWlsZE9wdGlvbnM6IG9wdGlvbnMsXG4gICAgICB0c0NvbmZpZyxcbiAgICAgIHRzQ29uZmlnUGF0aCxcbiAgICAgIHN1cHBvcnRFUzIwMTUsXG4gICAgfTtcblxuICAgIHdjby5idWlsZE9wdGlvbnMucHJvZ3Jlc3MgPSBkZWZhdWx0UHJvZ3Jlc3Mod2NvLmJ1aWxkT3B0aW9ucy5wcm9ncmVzcyk7XG5cbiAgICBjb25zdCB3ZWJwYWNrQ29uZmlnczoge31bXSA9IFtcbiAgICAgIGdldENvbW1vbkNvbmZpZyh3Y28pLFxuICAgICAgZ2V0QnJvd3NlckNvbmZpZyh3Y28pLFxuICAgICAgZ2V0U3R5bGVzQ29uZmlnKHdjbyksXG4gICAgICBnZXRTdGF0c0NvbmZpZyh3Y28pLFxuICAgIF07XG5cbiAgICBpZiAod2NvLmJ1aWxkT3B0aW9ucy5tYWluIHx8IHdjby5idWlsZE9wdGlvbnMucG9seWZpbGxzKSB7XG4gICAgICBjb25zdCB0eXBlc2NyaXB0Q29uZmlnUGFydGlhbCA9IHdjby5idWlsZE9wdGlvbnMuYW90XG4gICAgICAgID8gZ2V0QW90Q29uZmlnKHdjbywgaG9zdClcbiAgICAgICAgOiBnZXROb25Bb3RDb25maWcod2NvLCBob3N0KTtcbiAgICAgIHdlYnBhY2tDb25maWdzLnB1c2godHlwZXNjcmlwdENvbmZpZ1BhcnRpYWwpO1xuICAgIH1cblxuICAgIGNvbnN0IHdlYnBhY2tDb25maWcgPSB3ZWJwYWNrTWVyZ2Uod2VicGFja0NvbmZpZ3MpO1xuXG4gICAgaWYgKG9wdGlvbnMucHJvZmlsZSkge1xuICAgICAgY29uc3Qgc21wID0gbmV3IFNwZWVkTWVhc3VyZVBsdWdpbih7XG4gICAgICAgIG91dHB1dEZvcm1hdDogJ2pzb24nLFxuICAgICAgICBvdXRwdXRUYXJnZXQ6IGdldFN5c3RlbVBhdGgoam9pbihyb290LCAnc3BlZWQtbWVhc3VyZS1wbHVnaW4uanNvbicpKSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gc21wLndyYXAod2VicGFja0NvbmZpZyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHdlYnBhY2tDb25maWc7XG4gIH1cblxuICBwcml2YXRlIF9kZWxldGVPdXRwdXREaXIocm9vdDogUGF0aCwgb3V0cHV0UGF0aDogUGF0aCwgaG9zdDogdmlydHVhbEZzLkhvc3QpIHtcbiAgICBjb25zdCByZXNvbHZlZE91dHB1dFBhdGggPSByZXNvbHZlKHJvb3QsIG91dHB1dFBhdGgpO1xuICAgIGlmIChyZXNvbHZlZE91dHB1dFBhdGggPT09IHJvb3QpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignT3V0cHV0IHBhdGggTVVTVCBub3QgYmUgcHJvamVjdCByb290IGRpcmVjdG9yeSEnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaG9zdC5leGlzdHMocmVzb2x2ZWRPdXRwdXRQYXRoKS5waXBlKFxuICAgICAgY29uY2F0TWFwKGV4aXN0cyA9PiBleGlzdHNcbiAgICAgICAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgY29uY2F0IG9uY2UgaG9zdCBvcHMgZW1pdCBhbiBldmVudC5cbiAgICAgICAgPyBjb25jYXQoaG9zdC5kZWxldGUocmVzb2x2ZWRPdXRwdXRQYXRoKSwgb2YobnVsbCkpLnBpcGUobGFzdCgpKVxuICAgICAgICAvLyA/IG9mKG51bGwpXG4gICAgICAgIDogb2YobnVsbCkpLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGdldEJyb3dzZXJMb2dnaW5nQ2IgPSAodmVyYm9zZTogYm9vbGVhbik6IExvZ2dpbmdDYWxsYmFjayA9PlxuICAoc3RhdHMsIGNvbmZpZywgbG9nZ2VyKSA9PiB7XG4gICAgLy8gY29uZmlnLnN0YXRzIGNvbnRhaW5zIG91ciBvd24gc3RhdHMgc2V0dGluZ3MsIGFkZGVkIGR1cmluZyBidWlsZFdlYnBhY2tDb25maWcoKS5cbiAgICBjb25zdCBqc29uID0gc3RhdHMudG9Kc29uKGNvbmZpZy5zdGF0cyk7XG4gICAgaWYgKHZlcmJvc2UpIHtcbiAgICAgIGxvZ2dlci5pbmZvKHN0YXRzLnRvU3RyaW5nKGNvbmZpZy5zdGF0cykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIuaW5mbyhzdGF0c1RvU3RyaW5nKGpzb24sIGNvbmZpZy5zdGF0cykpO1xuICAgIH1cblxuICAgIGlmIChzdGF0cy5oYXNXYXJuaW5ncygpKSB7XG4gICAgICBsb2dnZXIud2FybihzdGF0c1dhcm5pbmdzVG9TdHJpbmcoanNvbiwgY29uZmlnLnN0YXRzKSk7XG4gICAgfVxuICAgIGlmIChzdGF0cy5oYXNFcnJvcnMoKSkge1xuICAgICAgbG9nZ2VyLmVycm9yKHN0YXRzRXJyb3JzVG9TdHJpbmcoanNvbiwgY29uZmlnLnN0YXRzKSk7XG4gICAgfVxuICB9O1xuXG5leHBvcnQgZGVmYXVsdCBCcm93c2VyQnVpbGRlcjtcbiJdfQ==