"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular-devkit/core");
const rxjs_1 = require("rxjs");
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
        return rxjs_1.of(null).pipe(operators_1.concatMap(() => options.deleteOutputPath
            ? this._deleteOutputDir(root, core_1.normalize(options.outputPath), this.context.host)
            : rxjs_1.of(null)), operators_1.concatMap(() => new rxjs_1.Observable(obs => {
            // Ensure Build Optimizer is only used with AOT.
            if (options.buildOptimizer && !options.aot) {
                throw new Error('The `--build-optimizer` option cannot be used without `--aot`.');
            }
            let webpackConfig;
            try {
                webpackConfig = this.buildWebpackConfig(root, projectRoot, options);
            }
            catch (e) {
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
        options.fileReplacements.forEach(({ src, replaceWith }) => {
            host.aliases.set(core_1.join(root, core_1.normalize(src)), core_1.join(root, core_1.normalize(replaceWith)));
        });
        // TODO: make target defaults into configurations instead
        // options = this.addTargetDefaults(options);
        const tsConfigPath = core_1.getSystemPath(core_1.normalize(core_1.resolve(root, core_1.normalize(options.tsConfig))));
        const tsConfig = read_tsconfig_1.readTsconfig(tsConfigPath);
        const projectTs = require_project_module_1.requireProjectModule(core_1.getSystemPath(projectRoot), 'typescript');
        const supportES2015 = tsConfig.options.target !== projectTs.ScriptTarget.ES3
            && tsConfig.options.target !== projectTs.ScriptTarget.ES5;
        wco = {
            root: core_1.getSystemPath(root),
            projectRoot: core_1.getSystemPath(projectRoot),
            // TODO: use only this.options, it contains all flags and configs items already.
            buildOptions: options,
            tsConfig,
            tsConfigPath,
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
        if (wco.buildOptions.main || wco.buildOptions.polyfills) {
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
            ? rxjs_1.concat(host.delete(resolvedOutputPath), rxjs_1.of(null)).pipe(operators_1.last())
            // ? of(null)
            : rxjs_1.of(null)));
    }
}
exports.BrowserBuilder = BrowserBuilder;
exports.default = BrowserBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2Jyb3dzZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFhQSwrQ0FBZ0c7QUFFaEcsK0JBQThDO0FBQzlDLDhDQUFpRDtBQUVqRCxtQ0FBbUM7QUFDbkMsaUZBTXFEO0FBQ3JELDZFQUEwRjtBQUUxRixnRkFBNEU7QUFDNUUsa0dBQTZGO0FBQzdGLGtGQUE0RjtBQUM1RixnRUFJOEM7QUFDOUMsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBZ0Y5QztJQUVFLFlBQW1CLE9BQXVCO1FBQXZCLFlBQU8sR0FBUCxPQUFPLENBQWdCO0lBQUksQ0FBQztJQUUvQyxHQUFHLENBQUMsYUFBMEQ7UUFDNUQsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQztRQUN0QyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDekMsTUFBTSxXQUFXLEdBQUcsY0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdEQsTUFBTSxDQUFDLFNBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQ2xCLHFCQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLGdCQUFnQjtZQUN0QyxDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxnQkFBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztZQUMvRSxDQUFDLENBQUMsU0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQ2IscUJBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLGlCQUFVLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDbkMsZ0RBQWdEO1lBQ2hELEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDM0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxnRUFBZ0UsQ0FBQyxDQUFDO1lBQ3BGLENBQUM7WUFFRCxJQUFJLGFBQWEsQ0FBQztZQUNsQixJQUFJLENBQUM7Z0JBQ0gsYUFBYSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3RFLENBQUM7WUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNYLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRWIsTUFBTSxDQUFDO1lBQ1QsQ0FBQztZQUNELE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUMvQyxNQUFNLFdBQVcsR0FBRyw2QkFBcUIsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7WUFFM0QsTUFBTSxRQUFRLEdBQXNDLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxFQUFFO2dCQUNqRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO29CQUNSLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN4QixDQUFDO2dCQUVELE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQ3ZDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUNwQixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO2dCQUN4RCxDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNOLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxxQkFBYSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDO2dCQUM3RCxDQUFDO2dCQUVELEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQ3hCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyw2QkFBcUIsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztnQkFDckUsQ0FBQztnQkFDRCxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUN0QixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsMkJBQW1CLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BFLENBQUM7Z0JBRUQsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7b0JBQ2xCLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUUxQyxnQ0FBZ0M7b0JBQ2hDLE1BQU0sQ0FBQztnQkFDVCxDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNOLEVBQUUsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQzt3QkFDeEMsNENBQTJCLENBQ3pCLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUNqQixJQUFJLEVBQ0osV0FBVyxFQUNYLGNBQU8sQ0FBQyxJQUFJLEVBQUUsZ0JBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsRUFDNUMsT0FBTyxDQUFDLFFBQVEsSUFBSSxHQUFHLENBQ3hCLENBQUMsSUFBSSxDQUNKLEdBQUcsRUFBRTs0QkFDSCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQzs0QkFDMUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO3dCQUNqQixDQUFDLEVBQ0QsQ0FBQyxHQUFVLEVBQUUsRUFBRTs0QkFDYix3RUFBd0U7NEJBQ3hFLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7d0JBQ2pCLENBQUMsQ0FDRixDQUFDO29CQUNKLENBQUM7b0JBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ04sR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7d0JBQzFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFDakIsQ0FBQztnQkFDSCxDQUFDO1lBQ0gsQ0FBQyxDQUFDO1lBRUYsSUFBSSxDQUFDO2dCQUNILEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO29CQUNsQixNQUFNLFFBQVEsR0FBRyxlQUFlLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFFekUsNERBQTREO29CQUM1RCxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDekMsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixlQUFlLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUNoQyxDQUFDO1lBQ0gsQ0FBQztZQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ2IsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDUixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQ3ZCLHdDQUF3QyxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQzVFLENBQUM7Z0JBQ0QsTUFBTSxHQUFHLENBQUM7WUFDWixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUMsQ0FDSixDQUFDO0lBQ0osQ0FBQztJQUVELGtCQUFrQixDQUNoQixJQUFVLEVBQ1YsV0FBaUIsRUFDakIsT0FBOEI7UUFFOUIsSUFBSSxHQUF5QixDQUFDO1FBRTlCLE1BQU0sSUFBSSxHQUFHLElBQUksZ0JBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFnQyxDQUFDLENBQUM7UUFFcEYsT0FBTyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUU7WUFDeEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQ2QsV0FBSSxDQUFDLElBQUksRUFBRSxnQkFBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQzFCLFdBQUksQ0FBQyxJQUFJLEVBQUUsZ0JBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUNuQyxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7UUFFSCx5REFBeUQ7UUFDekQsNkNBQTZDO1FBRTdDLE1BQU0sWUFBWSxHQUFHLG9CQUFhLENBQUMsZ0JBQVMsQ0FBQyxjQUFPLENBQUMsSUFBSSxFQUFFLGdCQUFTLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzFGLE1BQU0sUUFBUSxHQUFHLDRCQUFZLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFNUMsTUFBTSxTQUFTLEdBQUcsNkNBQW9CLENBQUMsb0JBQWEsQ0FBQyxXQUFXLENBQUMsRUFBRSxZQUFZLENBQWMsQ0FBQztRQUU5RixNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sS0FBSyxTQUFTLENBQUMsWUFBWSxDQUFDLEdBQUc7ZUFDdkUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssU0FBUyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUM7UUFFNUQsR0FBRyxHQUFHO1lBQ0osSUFBSSxFQUFFLG9CQUFhLENBQUMsSUFBSSxDQUFDO1lBQ3pCLFdBQVcsRUFBRSxvQkFBYSxDQUFDLFdBQVcsQ0FBQztZQUN2QyxnRkFBZ0Y7WUFDaEYsWUFBWSxFQUFFLE9BQU87WUFDckIsUUFBUTtZQUNSLFlBQVk7WUFDWixhQUFhO1NBQ2QsQ0FBQztRQUdGLHFGQUFxRjtRQUNyRixpQkFBaUI7UUFDakIsd0JBQXdCO1FBQ3hCLDRCQUE0QjtRQUM1QixzQkFBc0I7UUFDdEIsdUJBQXVCO1FBQ3ZCLHVCQUF1QjtRQUN2QixnQkFBZ0I7UUFDaEIsdUJBQXVCO1FBQ3ZCLDJCQUEyQjtRQUMzQixLQUFLO1FBQ0wsZ0JBQWdCO1FBQ2hCLHlCQUF5QjtRQUN6QiwwQkFBMEI7UUFDMUIsdUJBQXVCO1FBQ3ZCLHNCQUFzQjtRQUN0Qix3QkFBd0I7UUFDeEIsZUFBZTtRQUNmLDJCQUEyQjtRQUMzQix3QkFBd0I7UUFDeEIsZ0RBQWdEO1FBQ2hELElBQUk7UUFFSixNQUFNLGNBQWMsR0FBUztZQUMzQixpQ0FBZSxDQUFDLEdBQUcsQ0FBQztZQUNwQixrQ0FBZ0IsQ0FBQyxHQUFHLENBQUM7WUFDckIsaUNBQWUsQ0FBQyxHQUFHLENBQUM7U0FDckIsQ0FBQztRQUVGLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUN4RCxNQUFNLHVCQUF1QixHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRztnQkFDbEQsQ0FBQyxDQUFDLDhCQUFZLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQztnQkFDekIsQ0FBQyxDQUFDLGlDQUFlLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQy9CLGNBQWMsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBRUQsTUFBTSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRU8sZ0JBQWdCLENBQUMsSUFBVSxFQUFFLFVBQWdCLEVBQUUsSUFBb0I7UUFDekUsTUFBTSxrQkFBa0IsR0FBRyxjQUFPLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3JELEVBQUUsQ0FBQyxDQUFDLGtCQUFrQixLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDaEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7UUFFRCxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLElBQUksQ0FDekMscUJBQVMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU07WUFDeEIsd0RBQXdEO1lBQ3hELENBQUMsQ0FBQyxhQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLFNBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBSSxFQUFFLENBQUM7WUFDaEUsYUFBYTtZQUNiLENBQUMsQ0FBQyxTQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FDZCxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBOUxELHdDQThMQztBQUVELGtCQUFlLGNBQWMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnQsXG4gIEJ1aWxkZXIsXG4gIEJ1aWxkZXJDb25maWd1cmF0aW9uLFxuICBCdWlsZGVyQ29udGV4dCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBQYXRoLCBnZXRTeXN0ZW1QYXRoLCBqb2luLCBub3JtYWxpemUsIHJlc29sdmUsIHZpcnR1YWxGcyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGNvbmNhdCwgb2YgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbGFzdCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuaW1wb3J0ICogYXMgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7XG4gIGdldEFvdENvbmZpZyxcbiAgZ2V0QnJvd3NlckNvbmZpZyxcbiAgZ2V0Q29tbW9uQ29uZmlnLFxuICBnZXROb25Bb3RDb25maWcsXG4gIGdldFN0eWxlc0NvbmZpZyxcbn0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncyc7XG5pbXBvcnQgeyBnZXRXZWJwYWNrU3RhdHNDb25maWcgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3V0aWxzJztcbmltcG9ydCB7IEJ1ZGdldCB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9idW5kbGUtY2FsY3VsYXRvcic7XG5pbXBvcnQgeyByZWFkVHNjb25maWcgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcmVhZC10c2NvbmZpZyc7XG5pbXBvcnQgeyByZXF1aXJlUHJvamVjdE1vZHVsZSB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9yZXF1aXJlLXByb2plY3QtbW9kdWxlJztcbmltcG9ydCB7IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlciB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9zZXJ2aWNlLXdvcmtlcic7XG5pbXBvcnQge1xuICBzdGF0c0Vycm9yc1RvU3RyaW5nLFxuICBzdGF0c1RvU3RyaW5nLFxuICBzdGF0c1dhcm5pbmdzVG9TdHJpbmcsXG59IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9zdGF0cyc7XG5jb25zdCB3ZWJwYWNrTWVyZ2UgPSByZXF1aXJlKCd3ZWJwYWNrLW1lcmdlJyk7XG5cblxuLy8gVE9ETzogVXNlIHF1aWNrdHlwZSB0byBidWlsZCBvdXIgVHlwZVNjcmlwdCBpbnRlcmZhY2VzIGZyb20gdGhlIEpTT04gU2NoZW1hIGl0c2VsZiwgaW5cbi8vIHRoZSBidWlsZCBzeXN0ZW0uXG5leHBvcnQgaW50ZXJmYWNlIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyB7XG4gIG91dHB1dFBhdGg6IHN0cmluZztcbiAgaW5kZXg6IHN0cmluZztcbiAgbWFpbjogc3RyaW5nO1xuICB0c0NvbmZpZzogc3RyaW5nOyAvLyBwcmV2aW91c2x5ICd0c2NvbmZpZycuXG4gIGFvdDogYm9vbGVhbjtcbiAgdmVuZG9yQ2h1bms6IGJvb2xlYW47XG4gIGNvbW1vbkNodW5rOiBib29sZWFuO1xuICB2ZXJib3NlOiBib29sZWFuO1xuICBwcm9ncmVzczogYm9vbGVhbjtcbiAgZXh0cmFjdENzczogYm9vbGVhbjtcbiAgd2F0Y2g6IGJvb2xlYW47XG4gIG91dHB1dEhhc2hpbmc6ICdub25lJyB8ICdhbGwnIHwgJ21lZGlhJyB8ICdidW5kbGVzJztcbiAgZGVsZXRlT3V0cHV0UGF0aDogYm9vbGVhbjtcbiAgcHJlc2VydmVTeW1saW5rczogYm9vbGVhbjtcbiAgZXh0cmFjdExpY2Vuc2VzOiBib29sZWFuO1xuICBzaG93Q2lyY3VsYXJEZXBlbmRlbmNpZXM6IGJvb2xlYW47XG4gIGJ1aWxkT3B0aW1pemVyOiBib29sZWFuO1xuICBuYW1lZENodW5rczogYm9vbGVhbjtcbiAgc3VicmVzb3VyY2VJbnRlZ3JpdHk6IGJvb2xlYW47XG4gIHNlcnZpY2VXb3JrZXI6IGJvb2xlYW47XG4gIHNraXBBcHBTaGVsbDogYm9vbGVhbjtcbiAgZm9ya1R5cGVDaGVja2VyOiBib29sZWFuO1xuICBzdGF0c0pzb246IGJvb2xlYW47XG4gIGxhenlNb2R1bGVzOiBzdHJpbmdbXTtcbiAgYnVkZ2V0czogQnVkZ2V0W107XG5cbiAgLy8gT3B0aW9ucyB3aXRoIG5vIGRlZmF1bHRzLlxuICAvLyBUT0RPOiByZWNvbnNpZGVyIHRoaXMgbGlzdC5cbiAgcG9seWZpbGxzPzogc3RyaW5nO1xuICBiYXNlSHJlZj86IHN0cmluZztcbiAgZGVwbG95VXJsPzogc3RyaW5nO1xuICBpMThuRmlsZT86IHN0cmluZztcbiAgaTE4bkZvcm1hdD86IHN0cmluZztcbiAgaTE4bk91dEZpbGU/OiBzdHJpbmc7XG4gIGkxOG5PdXRGb3JtYXQ/OiBzdHJpbmc7XG4gIHBvbGw/OiBudW1iZXI7XG5cbiAgLy8gQSBjb3VwbGUgb2Ygb3B0aW9ucyBoYXZlIGRpZmZlcmVudCBuYW1lcy5cbiAgc291cmNlTWFwOiBib29sZWFuOyAvLyBwcmV2aW91c2x5ICdzb3VyY2VtYXBzJy5cbiAgZXZhbFNvdXJjZU1hcDogYm9vbGVhbjsgLy8gcHJldmlvdXNseSAnZXZhbFNvdXJjZW1hcHMnLlxuICBvcHRpbWl6YXRpb246IGJvb2xlYW47IC8vIHByZXZpb3VzbHkgJ3RhcmdldCcuXG4gIGkxOG5Mb2NhbGU/OiBzdHJpbmc7IC8vIHByZXZpb3VzbHkgJ2xvY2FsZScuXG4gIGkxOG5NaXNzaW5nVHJhbnNsYXRpb24/OiBzdHJpbmc7IC8vIHByZXZpb3VzbHkgJ21pc3NpbmdUcmFuc2xhdGlvbicuXG5cbiAgLy8gVGhlc2Ugb3B0aW9ucyB3ZXJlIG5vdCBhdmFpbGFibGUgYXMgZmxhZ3MuXG4gIGFzc2V0czogQXNzZXRQYXR0ZXJuW107XG4gIHNjcmlwdHM6IEV4dHJhRW50cnlQb2ludFtdO1xuICBzdHlsZXM6IEV4dHJhRW50cnlQb2ludFtdO1xuICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM6IHsgaW5jbHVkZVBhdGhzOiBzdHJpbmdbXSB9O1xuXG4gIGZpbGVSZXBsYWNlbWVudHM6IHsgc3JjOiBzdHJpbmc7IHJlcGxhY2VXaXRoOiBzdHJpbmc7IH1bXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBc3NldFBhdHRlcm4ge1xuICBnbG9iOiBzdHJpbmc7XG4gIGlucHV0OiBzdHJpbmc7XG4gIG91dHB1dDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEV4dHJhRW50cnlQb2ludCB7XG4gIGlucHV0OiBzdHJpbmc7XG4gIGJ1bmRsZU5hbWU6IHN0cmluZztcbiAgbGF6eTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBXZWJwYWNrQ29uZmlnT3B0aW9ucyB7XG4gIHJvb3Q6IHN0cmluZztcbiAgcHJvamVjdFJvb3Q6IHN0cmluZztcbiAgYnVpbGRPcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnM7XG4gIHRzQ29uZmlnOiB0cy5QYXJzZWRDb21tYW5kTGluZTtcbiAgdHNDb25maWdQYXRoOiBzdHJpbmc7XG4gIHN1cHBvcnRFUzIwMTU6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBCcm93c2VyQnVpbGRlciBpbXBsZW1lbnRzIEJ1aWxkZXI8QnJvd3NlckJ1aWxkZXJPcHRpb25zPiB7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KSB7IH1cblxuICBydW4oYnVpbGRlckNvbmZpZzogQnVpbGRlckNvbmZpZ3VyYXRpb248QnJvd3NlckJ1aWxkZXJPcHRpb25zPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnM7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdDtcbiAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5yb290KTtcblxuICAgIHJldHVybiBvZihudWxsKS5waXBlKFxuICAgICAgY29uY2F0TWFwKCgpID0+IG9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aFxuICAgICAgICA/IHRoaXMuX2RlbGV0ZU91dHB1dERpcihyb290LCBub3JtYWxpemUob3B0aW9ucy5vdXRwdXRQYXRoKSwgdGhpcy5jb250ZXh0Lmhvc3QpXG4gICAgICAgIDogb2YobnVsbCkpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IG5ldyBPYnNlcnZhYmxlKG9icyA9PiB7XG4gICAgICAgIC8vIEVuc3VyZSBCdWlsZCBPcHRpbWl6ZXIgaXMgb25seSB1c2VkIHdpdGggQU9ULlxuICAgICAgICBpZiAob3B0aW9ucy5idWlsZE9wdGltaXplciAmJiAhb3B0aW9ucy5hb3QpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBgLS1idWlsZC1vcHRpbWl6ZXJgIG9wdGlvbiBjYW5ub3QgYmUgdXNlZCB3aXRob3V0IGAtLWFvdGAuJyk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgd2VicGFja0NvbmZpZztcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB3ZWJwYWNrQ29uZmlnID0gdGhpcy5idWlsZFdlYnBhY2tDb25maWcocm9vdCwgcHJvamVjdFJvb3QsIG9wdGlvbnMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgb2JzLmVycm9yKGUpO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHdlYnBhY2tDb21waWxlciA9IHdlYnBhY2sod2VicGFja0NvbmZpZyk7XG4gICAgICAgIGNvbnN0IHN0YXRzQ29uZmlnID0gZ2V0V2VicGFja1N0YXRzQ29uZmlnKG9wdGlvbnMudmVyYm9zZSk7XG5cbiAgICAgICAgY29uc3QgY2FsbGJhY2s6IHdlYnBhY2suY29tcGlsZXIuQ29tcGlsZXJDYWxsYmFjayA9IChlcnIsIHN0YXRzKSA9PiB7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgcmV0dXJuIG9icy5lcnJvcihlcnIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGpzb24gPSBzdGF0cy50b0pzb24oc3RhdHNDb25maWcpO1xuICAgICAgICAgIGlmIChvcHRpb25zLnZlcmJvc2UpIHtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbyhzdGF0cy50b1N0cmluZyhzdGF0c0NvbmZpZykpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmluZm8oc3RhdHNUb1N0cmluZyhqc29uLCBzdGF0c0NvbmZpZykpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzdGF0cy5oYXNXYXJuaW5ncygpKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4oc3RhdHNXYXJuaW5nc1RvU3RyaW5nKGpzb24sIHN0YXRzQ29uZmlnKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzdGF0cy5oYXNFcnJvcnMoKSkge1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5lcnJvcihzdGF0c0Vycm9yc1RvU3RyaW5nKGpzb24sIHN0YXRzQ29uZmlnKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG9wdGlvbnMud2F0Y2gpIHtcbiAgICAgICAgICAgIG9icy5uZXh0KHsgc3VjY2VzczogIXN0YXRzLmhhc0Vycm9ycygpIH0pO1xuXG4gICAgICAgICAgICAvLyBOZXZlciBjb21wbGV0ZSBvbiB3YXRjaCBtb2RlLlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoYnVpbGRlckNvbmZpZy5vcHRpb25zLnNlcnZpY2VXb3JrZXIpIHtcbiAgICAgICAgICAgICAgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyKFxuICAgICAgICAgICAgICAgIHRoaXMuY29udGV4dC5ob3N0LFxuICAgICAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICAgICAgcHJvamVjdFJvb3QsXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShyb290LCBub3JtYWxpemUob3B0aW9ucy5vdXRwdXRQYXRoKSksXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5iYXNlSHJlZiB8fCAnLycsXG4gICAgICAgICAgICAgICkudGhlbihcbiAgICAgICAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICBvYnMubmV4dCh7IHN1Y2Nlc3M6ICFzdGF0cy5oYXNFcnJvcnMoKSB9KTtcbiAgICAgICAgICAgICAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgIC8vIFdlIGVycm9yIG91dCBoZXJlIGJlY2F1c2Ugd2UncmUgbm90IGluIHdhdGNoIG1vZGUgYW55d2F5IChzZWUgYWJvdmUpLlxuICAgICAgICAgICAgICAgICAgb2JzLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG9icy5uZXh0KHsgc3VjY2VzczogIXN0YXRzLmhhc0Vycm9ycygpIH0pO1xuICAgICAgICAgICAgICBvYnMuY29tcGxldGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBpZiAob3B0aW9ucy53YXRjaCkge1xuICAgICAgICAgICAgY29uc3Qgd2F0Y2hpbmcgPSB3ZWJwYWNrQ29tcGlsZXIud2F0Y2goeyBwb2xsOiBvcHRpb25zLnBvbGwgfSwgY2FsbGJhY2spO1xuXG4gICAgICAgICAgICAvLyBUZWFyZG93biBsb2dpYy4gQ2xvc2UgdGhlIHdhdGNoZXIgd2hlbiB1bnN1YnNjcmliZWQgZnJvbS5cbiAgICAgICAgICAgIHJldHVybiAoKSA9PiB3YXRjaGluZy5jbG9zZSgoKSA9PiB7IH0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3ZWJwYWNrQ29tcGlsZXIucnVuKGNhbGxiYWNrKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuZXJyb3IoXG4gICAgICAgICAgICAgICdcXG5BbiBlcnJvciBvY2N1cmVkIGR1cmluZyB0aGUgYnVpbGQ6XFxuJyArICgoZXJyICYmIGVyci5zdGFjaykgfHwgZXJyKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgfSkpLFxuICAgICk7XG4gIH1cblxuICBidWlsZFdlYnBhY2tDb25maWcoXG4gICAgcm9vdDogUGF0aCxcbiAgICBwcm9qZWN0Um9vdDogUGF0aCxcbiAgICBvcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gICkge1xuICAgIGxldCB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zO1xuXG4gICAgY29uc3QgaG9zdCA9IG5ldyB2aXJ0dWFsRnMuQWxpYXNIb3N0KHRoaXMuY29udGV4dC5ob3N0IGFzIHZpcnR1YWxGcy5Ib3N0PGZzLlN0YXRzPik7XG5cbiAgICBvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMuZm9yRWFjaCgoeyBzcmMsIHJlcGxhY2VXaXRoIH0pID0+IHtcbiAgICAgIGhvc3QuYWxpYXNlcy5zZXQoXG4gICAgICAgIGpvaW4ocm9vdCwgbm9ybWFsaXplKHNyYykpLFxuICAgICAgICBqb2luKHJvb3QsIG5vcm1hbGl6ZShyZXBsYWNlV2l0aCkpLFxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIC8vIFRPRE86IG1ha2UgdGFyZ2V0IGRlZmF1bHRzIGludG8gY29uZmlndXJhdGlvbnMgaW5zdGVhZFxuICAgIC8vIG9wdGlvbnMgPSB0aGlzLmFkZFRhcmdldERlZmF1bHRzKG9wdGlvbnMpO1xuXG4gICAgY29uc3QgdHNDb25maWdQYXRoID0gZ2V0U3lzdGVtUGF0aChub3JtYWxpemUocmVzb2x2ZShyb290LCBub3JtYWxpemUob3B0aW9ucy50c0NvbmZpZykpKSk7XG4gICAgY29uc3QgdHNDb25maWcgPSByZWFkVHNjb25maWcodHNDb25maWdQYXRoKTtcblxuICAgIGNvbnN0IHByb2plY3RUcyA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLCAndHlwZXNjcmlwdCcpIGFzIHR5cGVvZiB0cztcblxuICAgIGNvbnN0IHN1cHBvcnRFUzIwMTUgPSB0c0NvbmZpZy5vcHRpb25zLnRhcmdldCAhPT0gcHJvamVjdFRzLlNjcmlwdFRhcmdldC5FUzNcbiAgICAgICYmIHRzQ29uZmlnLm9wdGlvbnMudGFyZ2V0ICE9PSBwcm9qZWN0VHMuU2NyaXB0VGFyZ2V0LkVTNTtcblxuICAgIHdjbyA9IHtcbiAgICAgIHJvb3Q6IGdldFN5c3RlbVBhdGgocm9vdCksXG4gICAgICBwcm9qZWN0Um9vdDogZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksXG4gICAgICAvLyBUT0RPOiB1c2Ugb25seSB0aGlzLm9wdGlvbnMsIGl0IGNvbnRhaW5zIGFsbCBmbGFncyBhbmQgY29uZmlncyBpdGVtcyBhbHJlYWR5LlxuICAgICAgYnVpbGRPcHRpb25zOiBvcHRpb25zLFxuICAgICAgdHNDb25maWcsXG4gICAgICB0c0NvbmZpZ1BhdGgsXG4gICAgICBzdXBwb3J0RVMyMDE1LFxuICAgIH07XG5cblxuICAgIC8vIFRPRE86IGFkZCB0aGUgb2xkIGRldiBvcHRpb25zIGFzIHRoZSBkZWZhdWx0LCBhbmQgdGhlIHByb2Qgb25lIGFzIGEgY29uZmlndXJhdGlvbjpcbiAgICAvLyBkZXZlbG9wbWVudDoge1xuICAgIC8vICAgZW52aXJvbm1lbnQ6ICdkZXYnLFxuICAgIC8vICAgb3V0cHV0SGFzaGluZzogJ21lZGlhJyxcbiAgICAvLyAgIHNvdXJjZW1hcHM6IHRydWUsXG4gICAgLy8gICBleHRyYWN0Q3NzOiBmYWxzZSxcbiAgICAvLyAgIG5hbWVkQ2h1bmtzOiB0cnVlLFxuICAgIC8vICAgYW90OiBmYWxzZSxcbiAgICAvLyAgIHZlbmRvckNodW5rOiB0cnVlLFxuICAgIC8vICAgYnVpbGRPcHRpbWl6ZXI6IGZhbHNlLFxuICAgIC8vIH0sXG4gICAgLy8gcHJvZHVjdGlvbjoge1xuICAgIC8vICAgZW52aXJvbm1lbnQ6ICdwcm9kJyxcbiAgICAvLyAgIG91dHB1dEhhc2hpbmc6ICdhbGwnLFxuICAgIC8vICAgc291cmNlbWFwczogZmFsc2UsXG4gICAgLy8gICBleHRyYWN0Q3NzOiB0cnVlLFxuICAgIC8vICAgbmFtZWRDaHVua3M6IGZhbHNlLFxuICAgIC8vICAgYW90OiB0cnVlLFxuICAgIC8vICAgZXh0cmFjdExpY2Vuc2VzOiB0cnVlLFxuICAgIC8vICAgdmVuZG9yQ2h1bms6IGZhbHNlLFxuICAgIC8vICAgYnVpbGRPcHRpbWl6ZXI6IGJ1aWxkT3B0aW9ucy5hb3QgIT09IGZhbHNlLFxuICAgIC8vIH1cblxuICAgIGNvbnN0IHdlYnBhY2tDb25maWdzOiB7fVtdID0gW1xuICAgICAgZ2V0Q29tbW9uQ29uZmlnKHdjbyksXG4gICAgICBnZXRCcm93c2VyQ29uZmlnKHdjbyksXG4gICAgICBnZXRTdHlsZXNDb25maWcod2NvKSxcbiAgICBdO1xuXG4gICAgaWYgKHdjby5idWlsZE9wdGlvbnMubWFpbiB8fCB3Y28uYnVpbGRPcHRpb25zLnBvbHlmaWxscykge1xuICAgICAgY29uc3QgdHlwZXNjcmlwdENvbmZpZ1BhcnRpYWwgPSB3Y28uYnVpbGRPcHRpb25zLmFvdFxuICAgICAgICA/IGdldEFvdENvbmZpZyh3Y28sIGhvc3QpXG4gICAgICAgIDogZ2V0Tm9uQW90Q29uZmlnKHdjbywgaG9zdCk7XG4gICAgICB3ZWJwYWNrQ29uZmlncy5wdXNoKHR5cGVzY3JpcHRDb25maWdQYXJ0aWFsKTtcbiAgICB9XG5cbiAgICByZXR1cm4gd2VicGFja01lcmdlKHdlYnBhY2tDb25maWdzKTtcbiAgfVxuXG4gIHByaXZhdGUgX2RlbGV0ZU91dHB1dERpcihyb290OiBQYXRoLCBvdXRwdXRQYXRoOiBQYXRoLCBob3N0OiB2aXJ0dWFsRnMuSG9zdCkge1xuICAgIGNvbnN0IHJlc29sdmVkT3V0cHV0UGF0aCA9IHJlc29sdmUocm9vdCwgb3V0cHV0UGF0aCk7XG4gICAgaWYgKHJlc29sdmVkT3V0cHV0UGF0aCA9PT0gcm9vdCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdPdXRwdXQgcGF0aCBNVVNUIG5vdCBiZSBwcm9qZWN0IHJvb3QgZGlyZWN0b3J5IScpO1xuICAgIH1cblxuICAgIHJldHVybiBob3N0LmV4aXN0cyhyZXNvbHZlZE91dHB1dFBhdGgpLnBpcGUoXG4gICAgICBjb25jYXRNYXAoZXhpc3RzID0+IGV4aXN0c1xuICAgICAgICAvLyBUT0RPOiByZW1vdmUgdGhpcyBjb25jYXQgb25jZSBob3N0IG9wcyBlbWl0IGFuIGV2ZW50LlxuICAgICAgICA/IGNvbmNhdChob3N0LmRlbGV0ZShyZXNvbHZlZE91dHB1dFBhdGgpLCBvZihudWxsKSkucGlwZShsYXN0KCkpXG4gICAgICAgIC8vID8gb2YobnVsbClcbiAgICAgICAgOiBvZihudWxsKSksXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBCcm93c2VyQnVpbGRlcjtcbiJdfQ==