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
                ? webpack_configs_1.getAotConfig(wco)
                : webpack_configs_1.getNonAotConfig(wco);
            webpackConfigs.push(typescriptConfigPartial);
        }
        const webpackConfig = webpackMerge(webpackConfigs);
        if (options.profile || process.env['NG_BUILD_PROFILING']) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2Jyb3dzZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFhQSxpRUFBZ0Y7QUFDaEYsK0NBQWdHO0FBRWhHLCtCQUEwRDtBQUMxRCw4Q0FBaUQ7QUFHakQsaUZBT3FEO0FBQ3JELGdGQUE0RTtBQUM1RSxrR0FBNkY7QUFDN0Ysa0ZBQTRGO0FBQzVGLGdFQUk4QztBQUM5QyxvQ0FBbUc7QUFFbkcsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsOEJBQThCLENBQUMsQ0FBQztBQUNuRSxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFFOUMsTUFBYSxjQUFjO0lBRXpCLFlBQW1CLE9BQXVCO1FBQXZCLFlBQU8sR0FBUCxPQUFPLENBQWdCO0lBQUksQ0FBQztJQUVyQyxvQkFBb0IsQ0FBQyxPQUF1QjtRQUNwRCxPQUFPLElBQUksOEJBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRVMsb0JBQW9CO1FBQzVCLE9BQU8sMkJBQW1CLENBQUM7SUFDN0IsQ0FBQztJQUVELEdBQUcsQ0FBQyxhQUF5RDtRQUMzRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDekMsTUFBTSxXQUFXLEdBQUcsY0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsTUFBTSxJQUFJLEdBQUcsSUFBSSxnQkFBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQWdDLENBQUMsQ0FBQztRQUNwRixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLG1CQUFNLElBQUksQ0FBQyxPQUFPLElBQUUsSUFBSSxJQUFHLENBQUM7UUFDNUUsTUFBTSxZQUFZLEdBQUcsSUFB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TSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN4QyxJQUFJLE9BQU8sRUFBRTtRQUNYLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztLQUMzQztTQUFNO1FBQ0wsTUFBTSxDQUFDLElBQUksQ0FBQyxxQkFBYSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztLQUNoRDtJQUVELElBQUksS0FBSyxDQUFDLFdBQVcsRUFBRSxFQUFFO1FBQ3ZCLE1BQU0sQ0FBQyxJQUFJLENBQUMsNkJBQXFCLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0tBQ3hEO0lBQ0QsSUFBSSxLQUFLLENBQUMsU0FBUyxFQUFFLEVBQUU7UUFDckIsTUFBTSxDQUFDLEtBQUssQ0FBQywyQkFBbUIsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7S0FDdkQ7QUFDSCxDQUFDLENBQUM7QUFFSixrQkFBZSxjQUFjLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge1xuICBCdWlsZEV2ZW50LFxuICBCdWlsZGVyLFxuICBCdWlsZGVyQ29uZmlndXJhdGlvbixcbiAgQnVpbGRlckNvbnRleHQsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgTG9nZ2luZ0NhbGxiYWNrLCBXZWJwYWNrQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJztcbmltcG9ydCB7IFBhdGgsIGdldFN5c3RlbVBhdGgsIGpvaW4sIG5vcm1hbGl6ZSwgcmVzb2x2ZSwgdmlydHVhbEZzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgY29uY2F0LCBvZiwgdGhyb3dFcnJvciB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBsYXN0IH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL21vZGVscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7XG4gIGdldEFvdENvbmZpZyxcbiAgZ2V0QnJvd3NlckNvbmZpZyxcbiAgZ2V0Q29tbW9uQ29uZmlnLFxuICBnZXROb25Bb3RDb25maWcsXG4gIGdldFN0YXRzQ29uZmlnLFxuICBnZXRTdHlsZXNDb25maWcsXG59IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL21vZGVscy93ZWJwYWNrLWNvbmZpZ3MnO1xuaW1wb3J0IHsgcmVhZFRzY29uZmlnIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3JlYWQtdHNjb25maWcnO1xuaW1wb3J0IHsgcmVxdWlyZVByb2plY3RNb2R1bGUgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcmVxdWlyZS1wcm9qZWN0LW1vZHVsZSc7XG5pbXBvcnQgeyBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvc2VydmljZS13b3JrZXInO1xuaW1wb3J0IHtcbiAgc3RhdHNFcnJvcnNUb1N0cmluZyxcbiAgc3RhdHNUb1N0cmluZyxcbiAgc3RhdHNXYXJuaW5nc1RvU3RyaW5nLFxufSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvc3RhdHMnO1xuaW1wb3J0IHsgTm9ybWFsaXplZEJyb3dzZXJCdWlsZGVyU2NoZW1hLCBkZWZhdWx0UHJvZ3Jlc3MsIG5vcm1hbGl6ZUJyb3dzZXJTY2hlbWEgfSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5jb25zdCBTcGVlZE1lYXN1cmVQbHVnaW4gPSByZXF1aXJlKCdzcGVlZC1tZWFzdXJlLXdlYnBhY2stcGx1Z2luJyk7XG5jb25zdCB3ZWJwYWNrTWVyZ2UgPSByZXF1aXJlKCd3ZWJwYWNrLW1lcmdlJyk7XG5cbmV4cG9ydCBjbGFzcyBCcm93c2VyQnVpbGRlciBpbXBsZW1lbnRzIEJ1aWxkZXI8QnJvd3NlckJ1aWxkZXJTY2hlbWE+IHtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHsgfVxuXG4gIHByb3RlY3RlZCBjcmVhdGVXZWJwYWNrQnVpbGRlcihjb250ZXh0OiBCdWlsZGVyQ29udGV4dCk6IFdlYnBhY2tCdWlsZGVyIHtcbiAgICByZXR1cm4gbmV3IFdlYnBhY2tCdWlsZGVyKGNvbnRleHQpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGNyZWF0ZUxvZ2dpbmdGYWN0b3J5KCk6ICh2ZXJib3NlOiBib29sZWFuKSA9PiBMb2dnaW5nQ2FsbGJhY2sgIHtcbiAgICByZXR1cm4gZ2V0QnJvd3NlckxvZ2dpbmdDYjtcbiAgfVxuXG4gIHJ1bihidWlsZGVyQ29uZmlnOiBCdWlsZGVyQ29uZmlndXJhdGlvbjxCcm93c2VyQnVpbGRlclNjaGVtYT4pOiBPYnNlcnZhYmxlPEJ1aWxkRXZlbnQ+IHtcbiAgICBjb25zdCByb290ID0gdGhpcy5jb250ZXh0LndvcmtzcGFjZS5yb290O1xuICAgIGNvbnN0IHByb2plY3RSb290ID0gcmVzb2x2ZShyb290LCBidWlsZGVyQ29uZmlnLnJvb3QpO1xuICAgIGNvbnN0IGhvc3QgPSBuZXcgdmlydHVhbEZzLkFsaWFzSG9zdCh0aGlzLmNvbnRleHQuaG9zdCBhcyB2aXJ0dWFsRnMuSG9zdDxmcy5TdGF0cz4pO1xuICAgIGNvbnN0IHdlYnBhY2tCdWlsZGVyID0gdGhpcy5jcmVhdGVXZWJwYWNrQnVpbGRlcih7IC4uLnRoaXMuY29udGV4dCwgaG9zdCB9KTtcbiAgICBjb25zdCBnZXRMb2dnaW5nQ2IgPSB0aGlzLmNyZWF0ZUxvZ2dpbmdGYWN0b3J5KCk7XG5cbiAgICBjb25zdCBvcHRpb25zID0gbm9ybWFsaXplQnJvd3NlclNjaGVtYShcbiAgICAgIGhvc3QsXG4gICAgICByb290LFxuICAgICAgcmVzb2x2ZShyb290LCBidWlsZGVyQ29uZmlnLnJvb3QpLFxuICAgICAgYnVpbGRlckNvbmZpZy5zb3VyY2VSb290LFxuICAgICAgYnVpbGRlckNvbmZpZy5vcHRpb25zLFxuICAgICk7XG5cbiAgICByZXR1cm4gb2YobnVsbCkucGlwZShcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiBvcHRpb25zLmRlbGV0ZU91dHB1dFBhdGhcbiAgICAgICAgPyB0aGlzLl9kZWxldGVPdXRwdXREaXIocm9vdCwgbm9ybWFsaXplKG9wdGlvbnMub3V0cHV0UGF0aCksIHRoaXMuY29udGV4dC5ob3N0KVxuICAgICAgICA6IG9mKG51bGwpKSxcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiB7XG4gICAgICAgIGxldCB3ZWJwYWNrQ29uZmlnO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHdlYnBhY2tDb25maWcgPSB0aGlzLmJ1aWxkV2VicGFja0NvbmZpZyhyb290LCBwcm9qZWN0Um9vdCwgaG9zdCwgb3B0aW9ucyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICByZXR1cm4gdGhyb3dFcnJvcihlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB3ZWJwYWNrQnVpbGRlci5ydW5XZWJwYWNrKHdlYnBhY2tDb25maWcsIGdldExvZ2dpbmdDYihvcHRpb25zLnZlcmJvc2UgfHwgZmFsc2UpKTtcbiAgICAgIH0pLFxuICAgICAgY29uY2F0TWFwKGJ1aWxkRXZlbnQgPT4ge1xuICAgICAgICBpZiAoYnVpbGRFdmVudC5zdWNjZXNzICYmICFvcHRpb25zLndhdGNoICYmIG9wdGlvbnMuc2VydmljZVdvcmtlcikge1xuICAgICAgICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PihvYnMgPT4ge1xuICAgICAgICAgICAgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyKFxuICAgICAgICAgICAgICB0aGlzLmNvbnRleHQuaG9zdCxcbiAgICAgICAgICAgICAgcm9vdCxcbiAgICAgICAgICAgICAgcHJvamVjdFJvb3QsXG4gICAgICAgICAgICAgIHJlc29sdmUocm9vdCwgbm9ybWFsaXplKG9wdGlvbnMub3V0cHV0UGF0aCkpLFxuICAgICAgICAgICAgICBvcHRpb25zLmJhc2VIcmVmIHx8ICcvJyxcbiAgICAgICAgICAgICAgb3B0aW9ucy5uZ3N3Q29uZmlnUGF0aCxcbiAgICAgICAgICAgICkudGhlbihcbiAgICAgICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgICAgIG9icy5uZXh0KHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICBvYnMuY29tcGxldGUoKTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICBvYnMuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG9mKGJ1aWxkRXZlbnQpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgYnVpbGRXZWJwYWNrQ29uZmlnKFxuICAgIHJvb3Q6IFBhdGgsXG4gICAgcHJvamVjdFJvb3Q6IFBhdGgsXG4gICAgaG9zdDogdmlydHVhbEZzLkhvc3Q8ZnMuU3RhdHM+LFxuICAgIG9wdGlvbnM6IE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYSxcbiAgKSB7XG4gICAgLy8gRW5zdXJlIEJ1aWxkIE9wdGltaXplciBpcyBvbmx5IHVzZWQgd2l0aCBBT1QuXG4gICAgaWYgKG9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIgJiYgIW9wdGlvbnMuYW90KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSAnYnVpbGRPcHRpbWl6ZXInIG9wdGlvbiBjYW5ub3QgYmUgdXNlZCB3aXRob3V0ICdhb3QnLmApO1xuICAgIH1cblxuICAgIGxldCB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zPE5vcm1hbGl6ZWRCcm93c2VyQnVpbGRlclNjaGVtYT47XG5cbiAgICBjb25zdCB0c0NvbmZpZ1BhdGggPSBnZXRTeXN0ZW1QYXRoKG5vcm1hbGl6ZShyZXNvbHZlKHJvb3QsIG5vcm1hbGl6ZShvcHRpb25zLnRzQ29uZmlnKSkpKTtcbiAgICBjb25zdCB0c0NvbmZpZyA9IHJlYWRUc2NvbmZpZyh0c0NvbmZpZ1BhdGgpO1xuXG4gICAgY29uc3QgcHJvamVjdFRzID0gcmVxdWlyZVByb2plY3RNb2R1bGUoZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksICd0eXBlc2NyaXB0JykgYXMgdHlwZW9mIHRzO1xuXG4gICAgY29uc3Qgc3VwcG9ydEVTMjAxNSA9IHRzQ29uZmlnLm9wdGlvbnMudGFyZ2V0ICE9PSBwcm9qZWN0VHMuU2NyaXB0VGFyZ2V0LkVTM1xuICAgICAgJiYgdHNDb25maWcub3B0aW9ucy50YXJnZXQgIT09IHByb2plY3RUcy5TY3JpcHRUYXJnZXQuRVM1O1xuXG4gICAgd2NvID0ge1xuICAgICAgcm9vdDogZ2V0U3lzdGVtUGF0aChyb290KSxcbiAgICAgIGxvZ2dlcjogdGhpcy5jb250ZXh0LmxvZ2dlcixcbiAgICAgIHByb2plY3RSb290OiBnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSxcbiAgICAgIGJ1aWxkT3B0aW9uczogb3B0aW9ucyxcbiAgICAgIHRzQ29uZmlnLFxuICAgICAgdHNDb25maWdQYXRoLFxuICAgICAgc3VwcG9ydEVTMjAxNSxcbiAgICB9O1xuXG4gICAgd2NvLmJ1aWxkT3B0aW9ucy5wcm9ncmVzcyA9IGRlZmF1bHRQcm9ncmVzcyh3Y28uYnVpbGRPcHRpb25zLnByb2dyZXNzKTtcblxuICAgIGNvbnN0IHdlYnBhY2tDb25maWdzOiB7fVtdID0gW1xuICAgICAgZ2V0Q29tbW9uQ29uZmlnKHdjbyksXG4gICAgICBnZXRCcm93c2VyQ29uZmlnKHdjbyksXG4gICAgICBnZXRTdHlsZXNDb25maWcod2NvKSxcbiAgICAgIGdldFN0YXRzQ29uZmlnKHdjbyksXG4gICAgXTtcblxuICAgIGlmICh3Y28uYnVpbGRPcHRpb25zLm1haW4gfHwgd2NvLmJ1aWxkT3B0aW9ucy5wb2x5ZmlsbHMpIHtcbiAgICAgIGNvbnN0IHR5cGVzY3JpcHRDb25maWdQYXJ0aWFsID0gd2NvLmJ1aWxkT3B0aW9ucy5hb3RcbiAgICAgICAgPyBnZXRBb3RDb25maWcod2NvKVxuICAgICAgICA6IGdldE5vbkFvdENvbmZpZyh3Y28pO1xuICAgICAgd2VicGFja0NvbmZpZ3MucHVzaCh0eXBlc2NyaXB0Q29uZmlnUGFydGlhbCk7XG4gICAgfVxuXG4gICAgY29uc3Qgd2VicGFja0NvbmZpZyA9IHdlYnBhY2tNZXJnZSh3ZWJwYWNrQ29uZmlncyk7XG5cbiAgICBpZiAob3B0aW9ucy5wcm9maWxlIHx8IHByb2Nlc3MuZW52WydOR19CVUlMRF9QUk9GSUxJTkcnXSkge1xuICAgICAgY29uc3Qgc21wID0gbmV3IFNwZWVkTWVhc3VyZVBsdWdpbih7XG4gICAgICAgIG91dHB1dEZvcm1hdDogJ2pzb24nLFxuICAgICAgICBvdXRwdXRUYXJnZXQ6IGdldFN5c3RlbVBhdGgoam9pbihyb290LCAnc3BlZWQtbWVhc3VyZS1wbHVnaW4uanNvbicpKSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gc21wLndyYXAod2VicGFja0NvbmZpZyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHdlYnBhY2tDb25maWc7XG4gIH1cblxuICBwcml2YXRlIF9kZWxldGVPdXRwdXREaXIocm9vdDogUGF0aCwgb3V0cHV0UGF0aDogUGF0aCwgaG9zdDogdmlydHVhbEZzLkhvc3QpIHtcbiAgICBjb25zdCByZXNvbHZlZE91dHB1dFBhdGggPSByZXNvbHZlKHJvb3QsIG91dHB1dFBhdGgpO1xuICAgIGlmIChyZXNvbHZlZE91dHB1dFBhdGggPT09IHJvb3QpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignT3V0cHV0IHBhdGggTVVTVCBub3QgYmUgcHJvamVjdCByb290IGRpcmVjdG9yeSEnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaG9zdC5leGlzdHMocmVzb2x2ZWRPdXRwdXRQYXRoKS5waXBlKFxuICAgICAgY29uY2F0TWFwKGV4aXN0cyA9PiBleGlzdHNcbiAgICAgICAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgY29uY2F0IG9uY2UgaG9zdCBvcHMgZW1pdCBhbiBldmVudC5cbiAgICAgICAgPyBjb25jYXQoaG9zdC5kZWxldGUocmVzb2x2ZWRPdXRwdXRQYXRoKSwgb2YobnVsbCkpLnBpcGUobGFzdCgpKVxuICAgICAgICAvLyA/IG9mKG51bGwpXG4gICAgICAgIDogb2YobnVsbCkpLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGdldEJyb3dzZXJMb2dnaW5nQ2IgPSAodmVyYm9zZTogYm9vbGVhbik6IExvZ2dpbmdDYWxsYmFjayA9PlxuICAoc3RhdHMsIGNvbmZpZywgbG9nZ2VyKSA9PiB7XG4gICAgLy8gY29uZmlnLnN0YXRzIGNvbnRhaW5zIG91ciBvd24gc3RhdHMgc2V0dGluZ3MsIGFkZGVkIGR1cmluZyBidWlsZFdlYnBhY2tDb25maWcoKS5cbiAgICBjb25zdCBqc29uID0gc3RhdHMudG9Kc29uKGNvbmZpZy5zdGF0cyk7XG4gICAgaWYgKHZlcmJvc2UpIHtcbiAgICAgIGxvZ2dlci5pbmZvKHN0YXRzLnRvU3RyaW5nKGNvbmZpZy5zdGF0cykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIuaW5mbyhzdGF0c1RvU3RyaW5nKGpzb24sIGNvbmZpZy5zdGF0cykpO1xuICAgIH1cblxuICAgIGlmIChzdGF0cy5oYXNXYXJuaW5ncygpKSB7XG4gICAgICBsb2dnZXIud2FybihzdGF0c1dhcm5pbmdzVG9TdHJpbmcoanNvbiwgY29uZmlnLnN0YXRzKSk7XG4gICAgfVxuICAgIGlmIChzdGF0cy5oYXNFcnJvcnMoKSkge1xuICAgICAgbG9nZ2VyLmVycm9yKHN0YXRzRXJyb3JzVG9TdHJpbmcoanNvbiwgY29uZmlnLnN0YXRzKSk7XG4gICAgfVxuICB9O1xuXG5leHBvcnQgZGVmYXVsdCBCcm93c2VyQnVpbGRlcjtcbiJdfQ==