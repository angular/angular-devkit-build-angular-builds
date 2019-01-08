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
        const options = utils_1.normalizeBuilderSchema(host, root, builderConfig);
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
            return webpackBuilder.runWebpack(webpackConfig, getLoggingCb(options.verbose));
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
            throw new Error('The `--build-optimizer` option cannot be used without `--aot`.');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2Jyb3dzZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFhQSxpRUFBZ0Y7QUFDaEYsK0NBQWdHO0FBRWhHLCtCQUEwRDtBQUMxRCw4Q0FBc0Q7QUFHdEQsaUZBT3FEO0FBQ3JELGdGQUE0RTtBQUM1RSxrR0FBNkY7QUFDN0Ysa0ZBQTRGO0FBQzVGLGdFQUk4QztBQUM5QyxvQ0FBbUU7QUFFbkUsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsOEJBQThCLENBQUMsQ0FBQztBQUNuRSxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFFOUMsTUFBYSxjQUFjO0lBRXpCLFlBQW1CLE9BQXVCO1FBQXZCLFlBQU8sR0FBUCxPQUFPLENBQWdCO0lBQUksQ0FBQztJQUVyQyxvQkFBb0IsQ0FBQyxPQUF1QjtRQUNwRCxPQUFPLElBQUksOEJBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRVMsb0JBQW9CO1FBQzVCLE9BQU8sMkJBQW1CLENBQUM7SUFDN0IsQ0FBQztJQUVELEdBQUcsQ0FBQyxhQUF5RDtRQUMzRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDekMsTUFBTSxXQUFXLEdBQUcsY0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsTUFBTSxJQUFJLEdBQUcsSUFBSSxnQkFBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQWdDLENBQUMsQ0FBQztRQUNwRixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLG1CQUFNLElBQUksQ0FBQyxPQUFPLElBQUUsSUFBSSxJQUFHLENBQUM7UUFDNUUsTUFBTSxZQUFZLEdBQUcsSUFB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QUMsS0FBSyxDQUFDLENBQUMsQ0FBQztLQUMzQztTQUFNO1FBQ0wsTUFBTSxDQUFDLElBQUksQ0FBQyxxQkFBYSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztLQUNoRDtJQUVELElBQUksS0FBSyxDQUFDLFdBQVcsRUFBRSxFQUFFO1FBQ3ZCLE1BQU0sQ0FBQyxJQUFJLENBQUMsNkJBQXFCLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0tBQ3hEO0lBQ0QsSUFBSSxLQUFLLENBQUMsU0FBUyxFQUFFLEVBQUU7UUFDckIsTUFBTSxDQUFDLEtBQUssQ0FBQywyQkFBbUIsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7S0FDdkQ7QUFDSCxDQUFDLENBQUM7QUFFSixrQkFBZSxjQUFjLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge1xuICBCdWlsZEV2ZW50LFxuICBCdWlsZGVyLFxuICBCdWlsZGVyQ29uZmlndXJhdGlvbixcbiAgQnVpbGRlckNvbnRleHQsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgTG9nZ2luZ0NhbGxiYWNrLCBXZWJwYWNrQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJztcbmltcG9ydCB7IFBhdGgsIGdldFN5c3RlbVBhdGgsIGpvaW4sIG5vcm1hbGl6ZSwgcmVzb2x2ZSwgdmlydHVhbEZzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgY29uY2F0LCBvZiwgdGhyb3dFcnJvciB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBsYXN0LCB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JzsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHtcbiAgZ2V0QW90Q29uZmlnLFxuICBnZXRCcm93c2VyQ29uZmlnLFxuICBnZXRDb21tb25Db25maWcsXG4gIGdldE5vbkFvdENvbmZpZyxcbiAgZ2V0U3RhdHNDb25maWcsXG4gIGdldFN0eWxlc0NvbmZpZyxcbn0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncyc7XG5pbXBvcnQgeyByZWFkVHNjb25maWcgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcmVhZC10c2NvbmZpZyc7XG5pbXBvcnQgeyByZXF1aXJlUHJvamVjdE1vZHVsZSB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9yZXF1aXJlLXByb2plY3QtbW9kdWxlJztcbmltcG9ydCB7IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlciB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9zZXJ2aWNlLXdvcmtlcic7XG5pbXBvcnQge1xuICBzdGF0c0Vycm9yc1RvU3RyaW5nLFxuICBzdGF0c1RvU3RyaW5nLFxuICBzdGF0c1dhcm5pbmdzVG9TdHJpbmcsXG59IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9zdGF0cyc7XG5pbXBvcnQgeyBkZWZhdWx0UHJvZ3Jlc3MsIG5vcm1hbGl6ZUJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgeyBCcm93c2VyQnVpbGRlclNjaGVtYSwgTm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuY29uc3QgU3BlZWRNZWFzdXJlUGx1Z2luID0gcmVxdWlyZSgnc3BlZWQtbWVhc3VyZS13ZWJwYWNrLXBsdWdpbicpO1xuY29uc3Qgd2VicGFja01lcmdlID0gcmVxdWlyZSgnd2VicGFjay1tZXJnZScpO1xuXG5leHBvcnQgY2xhc3MgQnJvd3NlckJ1aWxkZXIgaW1wbGVtZW50cyBCdWlsZGVyPEJyb3dzZXJCdWlsZGVyU2NoZW1hPiB7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KSB7IH1cblxuICBwcm90ZWN0ZWQgY3JlYXRlV2VicGFja0J1aWxkZXIoY29udGV4dDogQnVpbGRlckNvbnRleHQpOiBXZWJwYWNrQnVpbGRlciB7XG4gICAgcmV0dXJuIG5ldyBXZWJwYWNrQnVpbGRlcihjb250ZXh0KTtcbiAgfVxuXG4gIHByb3RlY3RlZCBjcmVhdGVMb2dnaW5nRmFjdG9yeSgpOiAodmVyYm9zZTogYm9vbGVhbikgPT4gTG9nZ2luZ0NhbGxiYWNrICB7XG4gICAgcmV0dXJuIGdldEJyb3dzZXJMb2dnaW5nQ2I7XG4gIH1cblxuICBydW4oYnVpbGRlckNvbmZpZzogQnVpbGRlckNvbmZpZ3VyYXRpb248QnJvd3NlckJ1aWxkZXJTY2hlbWE+KTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdDtcbiAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5yb290KTtcbiAgICBjb25zdCBob3N0ID0gbmV3IHZpcnR1YWxGcy5BbGlhc0hvc3QodGhpcy5jb250ZXh0Lmhvc3QgYXMgdmlydHVhbEZzLkhvc3Q8ZnMuU3RhdHM+KTtcbiAgICBjb25zdCB3ZWJwYWNrQnVpbGRlciA9IHRoaXMuY3JlYXRlV2VicGFja0J1aWxkZXIoeyAuLi50aGlzLmNvbnRleHQsIGhvc3QgfSk7XG4gICAgY29uc3QgZ2V0TG9nZ2luZ0NiID0gdGhpcy5jcmVhdGVMb2dnaW5nRmFjdG9yeSgpO1xuXG4gICAgY29uc3Qgb3B0aW9ucyA9IG5vcm1hbGl6ZUJ1aWxkZXJTY2hlbWEoXG4gICAgICBob3N0LFxuICAgICAgcm9vdCxcbiAgICAgIGJ1aWxkZXJDb25maWcsXG4gICAgKTtcblxuICAgIHJldHVybiBvZihudWxsKS5waXBlKFxuICAgICAgY29uY2F0TWFwKCgpID0+IG9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aFxuICAgICAgICA/IHRoaXMuX2RlbGV0ZU91dHB1dERpcihyb290LCBub3JtYWxpemUob3B0aW9ucy5vdXRwdXRQYXRoKSwgdGhpcy5jb250ZXh0Lmhvc3QpXG4gICAgICAgIDogb2YobnVsbCkpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IHtcbiAgICAgICAgbGV0IHdlYnBhY2tDb25maWc7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgd2VicGFja0NvbmZpZyA9IHRoaXMuYnVpbGRXZWJwYWNrQ29uZmlnKHJvb3QsIHByb2plY3RSb290LCBob3N0LCBvcHRpb25zKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIHJldHVybiB0aHJvd0Vycm9yKGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHdlYnBhY2tCdWlsZGVyLnJ1bldlYnBhY2sod2VicGFja0NvbmZpZywgZ2V0TG9nZ2luZ0NiKG9wdGlvbnMudmVyYm9zZSkpO1xuICAgICAgfSksXG4gICAgICBjb25jYXRNYXAoYnVpbGRFdmVudCA9PiB7XG4gICAgICAgIGlmIChidWlsZEV2ZW50LnN1Y2Nlc3MgJiYgIW9wdGlvbnMud2F0Y2ggJiYgb3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlKG9icyA9PiB7XG4gICAgICAgICAgICBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIoXG4gICAgICAgICAgICAgIHRoaXMuY29udGV4dC5ob3N0LFxuICAgICAgICAgICAgICByb290LFxuICAgICAgICAgICAgICBwcm9qZWN0Um9vdCxcbiAgICAgICAgICAgICAgcmVzb2x2ZShyb290LCBub3JtYWxpemUob3B0aW9ucy5vdXRwdXRQYXRoKSksXG4gICAgICAgICAgICAgIG9wdGlvbnMuYmFzZUhyZWYgfHwgJy8nLFxuICAgICAgICAgICAgICBvcHRpb25zLm5nc3dDb25maWdQYXRoLFxuICAgICAgICAgICAgKS50aGVuKFxuICAgICAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICAgICAgb2JzLm5leHQoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIG9icy5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gb2YoYnVpbGRFdmVudCk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBidWlsZFdlYnBhY2tDb25maWcoXG4gICAgcm9vdDogUGF0aCxcbiAgICBwcm9qZWN0Um9vdDogUGF0aCxcbiAgICBob3N0OiB2aXJ0dWFsRnMuSG9zdDxmcy5TdGF0cz4sXG4gICAgb3B0aW9uczogTm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICApIHtcbiAgICAvLyBFbnN1cmUgQnVpbGQgT3B0aW1pemVyIGlzIG9ubHkgdXNlZCB3aXRoIEFPVC5cbiAgICBpZiAob3B0aW9ucy5idWlsZE9wdGltaXplciAmJiAhb3B0aW9ucy5hb3QpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGAtLWJ1aWxkLW9wdGltaXplcmAgb3B0aW9uIGNhbm5vdCBiZSB1c2VkIHdpdGhvdXQgYC0tYW90YC4nKTtcbiAgICB9XG5cbiAgICBsZXQgd2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9uczxOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWE+O1xuXG4gICAgY29uc3QgdHNDb25maWdQYXRoID0gZ2V0U3lzdGVtUGF0aChub3JtYWxpemUocmVzb2x2ZShyb290LCBub3JtYWxpemUob3B0aW9ucy50c0NvbmZpZykpKSk7XG4gICAgY29uc3QgdHNDb25maWcgPSByZWFkVHNjb25maWcodHNDb25maWdQYXRoKTtcblxuICAgIGNvbnN0IHByb2plY3RUcyA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLCAndHlwZXNjcmlwdCcpIGFzIHR5cGVvZiB0cztcblxuICAgIGNvbnN0IHN1cHBvcnRFUzIwMTUgPSB0c0NvbmZpZy5vcHRpb25zLnRhcmdldCAhPT0gcHJvamVjdFRzLlNjcmlwdFRhcmdldC5FUzNcbiAgICAgICYmIHRzQ29uZmlnLm9wdGlvbnMudGFyZ2V0ICE9PSBwcm9qZWN0VHMuU2NyaXB0VGFyZ2V0LkVTNTtcblxuICAgIHdjbyA9IHtcbiAgICAgIHJvb3Q6IGdldFN5c3RlbVBhdGgocm9vdCksXG4gICAgICBsb2dnZXI6IHRoaXMuY29udGV4dC5sb2dnZXIsXG4gICAgICBwcm9qZWN0Um9vdDogZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksXG4gICAgICBidWlsZE9wdGlvbnM6IG9wdGlvbnMsXG4gICAgICB0c0NvbmZpZyxcbiAgICAgIHRzQ29uZmlnUGF0aCxcbiAgICAgIHN1cHBvcnRFUzIwMTUsXG4gICAgfTtcblxuICAgIHdjby5idWlsZE9wdGlvbnMucHJvZ3Jlc3MgPSBkZWZhdWx0UHJvZ3Jlc3Mod2NvLmJ1aWxkT3B0aW9ucy5wcm9ncmVzcyk7XG5cbiAgICBjb25zdCB3ZWJwYWNrQ29uZmlnczoge31bXSA9IFtcbiAgICAgIGdldENvbW1vbkNvbmZpZyh3Y28pLFxuICAgICAgZ2V0QnJvd3NlckNvbmZpZyh3Y28pLFxuICAgICAgZ2V0U3R5bGVzQ29uZmlnKHdjbyksXG4gICAgICBnZXRTdGF0c0NvbmZpZyh3Y28pLFxuICAgIF07XG5cbiAgICBpZiAod2NvLmJ1aWxkT3B0aW9ucy5tYWluIHx8IHdjby5idWlsZE9wdGlvbnMucG9seWZpbGxzKSB7XG4gICAgICBjb25zdCB0eXBlc2NyaXB0Q29uZmlnUGFydGlhbCA9IHdjby5idWlsZE9wdGlvbnMuYW90XG4gICAgICAgID8gZ2V0QW90Q29uZmlnKHdjbywgaG9zdClcbiAgICAgICAgOiBnZXROb25Bb3RDb25maWcod2NvLCBob3N0KTtcbiAgICAgIHdlYnBhY2tDb25maWdzLnB1c2godHlwZXNjcmlwdENvbmZpZ1BhcnRpYWwpO1xuICAgIH1cblxuICAgIGNvbnN0IHdlYnBhY2tDb25maWcgPSB3ZWJwYWNrTWVyZ2Uod2VicGFja0NvbmZpZ3MpO1xuXG4gICAgaWYgKG9wdGlvbnMucHJvZmlsZSkge1xuICAgICAgY29uc3Qgc21wID0gbmV3IFNwZWVkTWVhc3VyZVBsdWdpbih7XG4gICAgICAgIG91dHB1dEZvcm1hdDogJ2pzb24nLFxuICAgICAgICBvdXRwdXRUYXJnZXQ6IGdldFN5c3RlbVBhdGgoam9pbihyb290LCAnc3BlZWQtbWVhc3VyZS1wbHVnaW4uanNvbicpKSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gc21wLndyYXAod2VicGFja0NvbmZpZyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHdlYnBhY2tDb25maWc7XG4gIH1cblxuICBwcml2YXRlIF9kZWxldGVPdXRwdXREaXIocm9vdDogUGF0aCwgb3V0cHV0UGF0aDogUGF0aCwgaG9zdDogdmlydHVhbEZzLkhvc3QpIHtcbiAgICBjb25zdCByZXNvbHZlZE91dHB1dFBhdGggPSByZXNvbHZlKHJvb3QsIG91dHB1dFBhdGgpO1xuICAgIGlmIChyZXNvbHZlZE91dHB1dFBhdGggPT09IHJvb3QpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignT3V0cHV0IHBhdGggTVVTVCBub3QgYmUgcHJvamVjdCByb290IGRpcmVjdG9yeSEnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaG9zdC5leGlzdHMocmVzb2x2ZWRPdXRwdXRQYXRoKS5waXBlKFxuICAgICAgY29uY2F0TWFwKGV4aXN0cyA9PiBleGlzdHNcbiAgICAgICAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgY29uY2F0IG9uY2UgaG9zdCBvcHMgZW1pdCBhbiBldmVudC5cbiAgICAgICAgPyBjb25jYXQoaG9zdC5kZWxldGUocmVzb2x2ZWRPdXRwdXRQYXRoKSwgb2YobnVsbCkpLnBpcGUobGFzdCgpKVxuICAgICAgICAvLyA/IG9mKG51bGwpXG4gICAgICAgIDogb2YobnVsbCkpLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGdldEJyb3dzZXJMb2dnaW5nQ2IgPSAodmVyYm9zZTogYm9vbGVhbik6IExvZ2dpbmdDYWxsYmFjayA9PlxuICAoc3RhdHMsIGNvbmZpZywgbG9nZ2VyKSA9PiB7XG4gICAgLy8gY29uZmlnLnN0YXRzIGNvbnRhaW5zIG91ciBvd24gc3RhdHMgc2V0dGluZ3MsIGFkZGVkIGR1cmluZyBidWlsZFdlYnBhY2tDb25maWcoKS5cbiAgICBjb25zdCBqc29uID0gc3RhdHMudG9Kc29uKGNvbmZpZy5zdGF0cyk7XG4gICAgaWYgKHZlcmJvc2UpIHtcbiAgICAgIGxvZ2dlci5pbmZvKHN0YXRzLnRvU3RyaW5nKGNvbmZpZy5zdGF0cykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIuaW5mbyhzdGF0c1RvU3RyaW5nKGpzb24sIGNvbmZpZy5zdGF0cykpO1xuICAgIH1cblxuICAgIGlmIChzdGF0cy5oYXNXYXJuaW5ncygpKSB7XG4gICAgICBsb2dnZXIud2FybihzdGF0c1dhcm5pbmdzVG9TdHJpbmcoanNvbiwgY29uZmlnLnN0YXRzKSk7XG4gICAgfVxuICAgIGlmIChzdGF0cy5oYXNFcnJvcnMoKSkge1xuICAgICAgbG9nZ2VyLmVycm9yKHN0YXRzRXJyb3JzVG9TdHJpbmcoanNvbiwgY29uZmlnLnN0YXRzKSk7XG4gICAgfVxuICB9O1xuXG5leHBvcnQgZGVmYXVsdCBCcm93c2VyQnVpbGRlcjtcbiJdfQ==