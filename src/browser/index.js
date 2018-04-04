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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2Jyb3dzZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFhQSwrQ0FBZ0c7QUFFaEcsK0JBQThDO0FBQzlDLDhDQUFpRDtBQUVqRCxtQ0FBbUM7QUFDbkMsaUZBTXFEO0FBQ3JELDZFQUEwRjtBQUUxRixnRkFBNEU7QUFDNUUsa0dBQTZGO0FBQzdGLGtGQUE0RjtBQUM1RixnRUFJOEM7QUFDOUMsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBZ0Y5QztJQUVFLFlBQW1CLE9BQXVCO1FBQXZCLFlBQU8sR0FBUCxPQUFPLENBQWdCO0lBQUksQ0FBQztJQUUvQyxHQUFHLENBQUMsYUFBMEQ7UUFDNUQsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQztRQUN0QyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDekMsTUFBTSxXQUFXLEdBQUcsY0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdEQsTUFBTSxDQUFDLFNBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQ2xCLHFCQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLGdCQUFnQjtZQUN0QyxDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxnQkFBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztZQUMvRSxDQUFDLENBQUMsU0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQ2IscUJBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLGlCQUFVLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDbkMsZ0RBQWdEO1lBQ2hELEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDM0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxnRUFBZ0UsQ0FBQyxDQUFDO1lBQ3BGLENBQUM7WUFFRCxJQUFJLGFBQWEsQ0FBQztZQUNsQixJQUFJLENBQUM7Z0JBQ0gsYUFBYSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3RFLENBQUM7WUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNYLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRWIsTUFBTSxDQUFDO1lBQ1QsQ0FBQztZQUNELE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUMvQyxNQUFNLFdBQVcsR0FBRyw2QkFBcUIsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7WUFFM0QsTUFBTSxRQUFRLEdBQXNDLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxFQUFFO2dCQUNqRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO29CQUNSLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN4QixDQUFDO2dCQUVELE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQ3ZDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUNwQixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO2dCQUN4RCxDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNOLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxxQkFBYSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDO2dCQUM3RCxDQUFDO2dCQUVELEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQ3hCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyw2QkFBcUIsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztnQkFDckUsQ0FBQztnQkFDRCxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUN0QixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsMkJBQW1CLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BFLENBQUM7Z0JBRUQsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7b0JBQ2xCLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUUxQyxnQ0FBZ0M7b0JBQ2hDLE1BQU0sQ0FBQztnQkFDVCxDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNOLEVBQUUsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQzt3QkFDeEMsNENBQTJCLENBQ3pCLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUNqQixJQUFJLEVBQ0osV0FBVyxFQUNYLGNBQU8sQ0FBQyxJQUFJLEVBQUUsZ0JBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsRUFDNUMsT0FBTyxDQUFDLFFBQVEsSUFBSSxHQUFHLENBQ3hCLENBQUMsSUFBSSxDQUNKLEdBQUcsRUFBRTs0QkFDSCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQzs0QkFDMUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO3dCQUNqQixDQUFDLEVBQ0QsQ0FBQyxHQUFVLEVBQUUsRUFBRTs0QkFDYix3RUFBd0U7NEJBQ3hFLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7d0JBQ2pCLENBQUMsQ0FDRixDQUFDO29CQUNKLENBQUM7b0JBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ04sR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7d0JBQzFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFDakIsQ0FBQztnQkFDSCxDQUFDO1lBQ0gsQ0FBQyxDQUFDO1lBRUYsSUFBSSxDQUFDO2dCQUNILEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO29CQUNsQixNQUFNLFFBQVEsR0FBRyxlQUFlLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFFekUsNERBQTREO29CQUM1RCxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDekMsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixlQUFlLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUNoQyxDQUFDO1lBQ0gsQ0FBQztZQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ2IsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDUixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQ3ZCLHdDQUF3QyxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQzVFLENBQUM7Z0JBQ0QsTUFBTSxHQUFHLENBQUM7WUFDWixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUMsQ0FDSixDQUFDO0lBQ0osQ0FBQztJQUVELGtCQUFrQixDQUNoQixJQUFVLEVBQ1YsV0FBaUIsRUFDakIsT0FBOEI7UUFFOUIsSUFBSSxHQUF5QixDQUFDO1FBRTlCLE1BQU0sSUFBSSxHQUFHLElBQUksZ0JBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFnQyxDQUFDLENBQUM7UUFFcEYsT0FBTyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUU7WUFDeEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQ2QsV0FBSSxDQUFDLElBQUksRUFBRSxnQkFBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQzFCLFdBQUksQ0FBQyxJQUFJLEVBQUUsZ0JBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUNuQyxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7UUFFSCx5REFBeUQ7UUFDekQsNkNBQTZDO1FBRTdDLE1BQU0sWUFBWSxHQUFHLG9CQUFhLENBQUMsZ0JBQVMsQ0FBQyxjQUFPLENBQUMsSUFBSSxFQUFFLGdCQUFTLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzFGLE1BQU0sUUFBUSxHQUFHLDRCQUFZLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFNUMsTUFBTSxTQUFTLEdBQUcsNkNBQW9CLENBQUMsb0JBQWEsQ0FBQyxXQUFXLENBQUMsRUFBRSxZQUFZLENBQWMsQ0FBQztRQUU5RixNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sS0FBSyxTQUFTLENBQUMsWUFBWSxDQUFDLEdBQUc7ZUFDdkUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssU0FBUyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUM7UUFFNUQsR0FBRyxHQUFHO1lBQ0osSUFBSSxFQUFFLG9CQUFhLENBQUMsSUFBSSxDQUFDO1lBQ3pCLFdBQVcsRUFBRSxvQkFBYSxDQUFDLFdBQVcsQ0FBQztZQUN2QyxnRkFBZ0Y7WUFDaEYsWUFBWSxFQUFFLE9BQU87WUFDckIsUUFBUTtZQUNSLFlBQVk7WUFDWixhQUFhO1NBQ2QsQ0FBQztRQUdGLHFGQUFxRjtRQUNyRixpQkFBaUI7UUFDakIsd0JBQXdCO1FBQ3hCLDRCQUE0QjtRQUM1QixzQkFBc0I7UUFDdEIsdUJBQXVCO1FBQ3ZCLHVCQUF1QjtRQUN2QixnQkFBZ0I7UUFDaEIsdUJBQXVCO1FBQ3ZCLDJCQUEyQjtRQUMzQixLQUFLO1FBQ0wsZ0JBQWdCO1FBQ2hCLHlCQUF5QjtRQUN6QiwwQkFBMEI7UUFDMUIsdUJBQXVCO1FBQ3ZCLHNCQUFzQjtRQUN0Qix3QkFBd0I7UUFDeEIsZUFBZTtRQUNmLDJCQUEyQjtRQUMzQix3QkFBd0I7UUFDeEIsZ0RBQWdEO1FBQ2hELElBQUk7UUFFSixNQUFNLGNBQWMsR0FBUztZQUMzQixpQ0FBZSxDQUFDLEdBQUcsQ0FBQztZQUNwQixrQ0FBZ0IsQ0FBQyxHQUFHLENBQUM7WUFDckIsaUNBQWUsQ0FBQyxHQUFHLENBQUM7U0FDckIsQ0FBQztRQUVGLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUN4RCxNQUFNLHVCQUF1QixHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRztnQkFDbEQsQ0FBQyxDQUFDLDhCQUFZLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQztnQkFDekIsQ0FBQyxDQUFDLGlDQUFlLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQy9CLGNBQWMsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBRUQsTUFBTSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRU8sZ0JBQWdCLENBQUMsSUFBVSxFQUFFLFVBQWdCLEVBQUUsSUFBb0I7UUFDekUsTUFBTSxrQkFBa0IsR0FBRyxjQUFPLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3JELEVBQUUsQ0FBQyxDQUFDLGtCQUFrQixLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDaEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7UUFFRCxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLElBQUksQ0FDekMscUJBQVMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU07WUFDeEIsd0RBQXdEO1lBQ3hELENBQUMsQ0FBQyxhQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLFNBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBSSxFQUFFLENBQUM7WUFDaEUsYUFBYTtZQUNiLENBQUMsQ0FBQyxTQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FDZCxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBOUxELHdDQThMQztBQUVELGtCQUFlLGNBQWMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnQsXG4gIEJ1aWxkZXIsXG4gIEJ1aWxkZXJDb25maWd1cmF0aW9uLFxuICBCdWlsZGVyQ29udGV4dCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBQYXRoLCBnZXRTeXN0ZW1QYXRoLCBqb2luLCBub3JtYWxpemUsIHJlc29sdmUsIHZpcnR1YWxGcyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGNvbmNhdCwgb2YgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbGFzdCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuaW1wb3J0ICogYXMgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7XG4gIGdldEFvdENvbmZpZyxcbiAgZ2V0QnJvd3NlckNvbmZpZyxcbiAgZ2V0Q29tbW9uQ29uZmlnLFxuICBnZXROb25Bb3RDb25maWcsXG4gIGdldFN0eWxlc0NvbmZpZyxcbn0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncyc7XG5pbXBvcnQgeyBnZXRXZWJwYWNrU3RhdHNDb25maWcgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3V0aWxzJztcbmltcG9ydCB7IEJ1ZGdldCB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9idW5kbGUtY2FsY3VsYXRvcic7XG5pbXBvcnQgeyByZWFkVHNjb25maWcgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcmVhZC10c2NvbmZpZyc7XG5pbXBvcnQgeyByZXF1aXJlUHJvamVjdE1vZHVsZSB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9yZXF1aXJlLXByb2plY3QtbW9kdWxlJztcbmltcG9ydCB7IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlciB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9zZXJ2aWNlLXdvcmtlcic7XG5pbXBvcnQge1xuICBzdGF0c0Vycm9yc1RvU3RyaW5nLFxuICBzdGF0c1RvU3RyaW5nLFxuICBzdGF0c1dhcm5pbmdzVG9TdHJpbmcsXG59IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9zdGF0cyc7XG5jb25zdCB3ZWJwYWNrTWVyZ2UgPSByZXF1aXJlKCd3ZWJwYWNrLW1lcmdlJyk7XG5cblxuLy8gVE9ETzogVXNlIHF1aWNrdHlwZSB0byBidWlsZCBvdXIgVHlwZVNjcmlwdCBpbnRlcmZhY2VzIGZyb20gdGhlIEpTT04gU2NoZW1hIGl0c2VsZiwgaW5cbi8vIHRoZSBidWlsZCBzeXN0ZW0uXG5leHBvcnQgaW50ZXJmYWNlIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyB7XG4gIG91dHB1dFBhdGg6IHN0cmluZztcbiAgaW5kZXg6IHN0cmluZztcbiAgbWFpbjogc3RyaW5nO1xuICB0c0NvbmZpZzogc3RyaW5nOyAvLyBwcmV2aW91c2x5ICd0c2NvbmZpZycuXG4gIGFvdDogYm9vbGVhbjtcbiAgdmVuZG9yQ2h1bms6IGJvb2xlYW47XG4gIGNvbW1vbkNodW5rOiBib29sZWFuO1xuICB2ZXJib3NlOiBib29sZWFuO1xuICBwcm9ncmVzczogYm9vbGVhbjtcbiAgZXh0cmFjdENzczogYm9vbGVhbjtcbiAgd2F0Y2g6IGJvb2xlYW47XG4gIG91dHB1dEhhc2hpbmc6ICdub25lJyB8ICdhbGwnIHwgJ21lZGlhJyB8ICdidW5kbGVzJztcbiAgZGVsZXRlT3V0cHV0UGF0aDogYm9vbGVhbjtcbiAgcHJlc2VydmVTeW1saW5rczogYm9vbGVhbjtcbiAgZXh0cmFjdExpY2Vuc2VzOiBib29sZWFuO1xuICBzaG93Q2lyY3VsYXJEZXBlbmRlbmNpZXM6IGJvb2xlYW47XG4gIGJ1aWxkT3B0aW1pemVyOiBib29sZWFuO1xuICBuYW1lZENodW5rczogYm9vbGVhbjtcbiAgc3VicmVzb3VyY2VJbnRlZ3JpdHk6IGJvb2xlYW47XG4gIHNlcnZpY2VXb3JrZXI6IGJvb2xlYW47XG4gIHNraXBBcHBTaGVsbDogYm9vbGVhbjtcbiAgZm9ya1R5cGVDaGVja2VyOiBib29sZWFuO1xuICBzdGF0c0pzb246IGJvb2xlYW47XG4gIGxhenlNb2R1bGVzOiBzdHJpbmdbXTtcbiAgYnVkZ2V0czogQnVkZ2V0W107XG5cbiAgLy8gT3B0aW9ucyB3aXRoIG5vIGRlZmF1bHRzLlxuICAvLyBUT0RPOiByZWNvbnNpZGVyIHRoaXMgbGlzdC5cbiAgcG9seWZpbGxzPzogc3RyaW5nO1xuICBiYXNlSHJlZj86IHN0cmluZztcbiAgZGVwbG95VXJsPzogc3RyaW5nO1xuICBpMThuRmlsZT86IHN0cmluZztcbiAgaTE4bkZvcm1hdD86IHN0cmluZztcbiAgaTE4bk91dEZpbGU/OiBzdHJpbmc7XG4gIGkxOG5PdXRGb3JtYXQ/OiBzdHJpbmc7XG4gIHBvbGw/OiBudW1iZXI7XG5cbiAgLy8gQSBjb3VwbGUgb2Ygb3B0aW9ucyBoYXZlIGRpZmZlcmVudCBuYW1lcy5cbiAgc291cmNlTWFwOiBib29sZWFuOyAvLyBwcmV2aW91c2x5ICdzb3VyY2VtYXBzJy5cbiAgZXZhbFNvdXJjZU1hcDogYm9vbGVhbjsgLy8gcHJldmlvdXNseSAnZXZhbFNvdXJjZW1hcHMnLlxuICBvcHRpbWl6YXRpb246IGJvb2xlYW47IC8vIHByZXZpb3VzbHkgJ3RhcmdldCcuXG4gIGkxOG5Mb2NhbGU/OiBzdHJpbmc7IC8vIHByZXZpb3VzbHkgJ2xvY2FsZScuXG4gIGkxOG5NaXNzaW5nVHJhbnNsYXRpb24/OiBzdHJpbmc7IC8vIHByZXZpb3VzbHkgJ21pc3NpbmdUcmFuc2xhdGlvbicuXG5cbiAgLy8gVGhlc2Ugb3B0aW9ucyB3ZXJlIG5vdCBhdmFpbGFibGUgYXMgZmxhZ3MuXG4gIGFzc2V0czogQXNzZXRQYXR0ZXJuW107XG4gIHNjcmlwdHM6IEV4dHJhRW50cnlQb2ludFtdO1xuICBzdHlsZXM6IEV4dHJhRW50cnlQb2ludFtdO1xuICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM6IHsgaW5jbHVkZVBhdGhzOiBzdHJpbmdbXSB9O1xuXG4gIGZpbGVSZXBsYWNlbWVudHM6IHsgc3JjOiBzdHJpbmc7IHJlcGxhY2VXaXRoOiBzdHJpbmc7IH1bXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBc3NldFBhdHRlcm4ge1xuICBnbG9iOiBzdHJpbmc7XG4gIGlucHV0OiBzdHJpbmc7XG4gIG91dHB1dDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEV4dHJhRW50cnlQb2ludCB7XG4gIGlucHV0OiBzdHJpbmc7XG4gIGJ1bmRsZU5hbWU/OiBzdHJpbmc7XG4gIGxhenk6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgV2VicGFja0NvbmZpZ09wdGlvbnMge1xuICByb290OiBzdHJpbmc7XG4gIHByb2plY3RSb290OiBzdHJpbmc7XG4gIGJ1aWxkT3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zO1xuICB0c0NvbmZpZzogdHMuUGFyc2VkQ29tbWFuZExpbmU7XG4gIHRzQ29uZmlnUGF0aDogc3RyaW5nO1xuICBzdXBwb3J0RVMyMDE1OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgQnJvd3NlckJ1aWxkZXIgaW1wbGVtZW50cyBCdWlsZGVyPEJyb3dzZXJCdWlsZGVyT3B0aW9ucz4ge1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkgeyB9XG5cbiAgcnVuKGJ1aWxkZXJDb25maWc6IEJ1aWxkZXJDb25maWd1cmF0aW9uPEJyb3dzZXJCdWlsZGVyT3B0aW9ucz4pOiBPYnNlcnZhYmxlPEJ1aWxkRXZlbnQ+IHtcbiAgICBjb25zdCBvcHRpb25zID0gYnVpbGRlckNvbmZpZy5vcHRpb25zO1xuICAgIGNvbnN0IHJvb3QgPSB0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3Q7XG4gICAgY29uc3QgcHJvamVjdFJvb3QgPSByZXNvbHZlKHJvb3QsIGJ1aWxkZXJDb25maWcucm9vdCk7XG5cbiAgICByZXR1cm4gb2YobnVsbCkucGlwZShcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiBvcHRpb25zLmRlbGV0ZU91dHB1dFBhdGhcbiAgICAgICAgPyB0aGlzLl9kZWxldGVPdXRwdXREaXIocm9vdCwgbm9ybWFsaXplKG9wdGlvbnMub3V0cHV0UGF0aCksIHRoaXMuY29udGV4dC5ob3N0KVxuICAgICAgICA6IG9mKG51bGwpKSxcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiBuZXcgT2JzZXJ2YWJsZShvYnMgPT4ge1xuICAgICAgICAvLyBFbnN1cmUgQnVpbGQgT3B0aW1pemVyIGlzIG9ubHkgdXNlZCB3aXRoIEFPVC5cbiAgICAgICAgaWYgKG9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIgJiYgIW9wdGlvbnMuYW90KSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgYC0tYnVpbGQtb3B0aW1pemVyYCBvcHRpb24gY2Fubm90IGJlIHVzZWQgd2l0aG91dCBgLS1hb3RgLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHdlYnBhY2tDb25maWc7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgd2VicGFja0NvbmZpZyA9IHRoaXMuYnVpbGRXZWJwYWNrQ29uZmlnKHJvb3QsIHByb2plY3RSb290LCBvcHRpb25zKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIG9icy5lcnJvcihlKTtcblxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB3ZWJwYWNrQ29tcGlsZXIgPSB3ZWJwYWNrKHdlYnBhY2tDb25maWcpO1xuICAgICAgICBjb25zdCBzdGF0c0NvbmZpZyA9IGdldFdlYnBhY2tTdGF0c0NvbmZpZyhvcHRpb25zLnZlcmJvc2UpO1xuXG4gICAgICAgIGNvbnN0IGNhbGxiYWNrOiB3ZWJwYWNrLmNvbXBpbGVyLkNvbXBpbGVyQ2FsbGJhY2sgPSAoZXJyLCBzdGF0cykgPT4ge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIHJldHVybiBvYnMuZXJyb3IoZXJyKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBqc29uID0gc3RhdHMudG9Kc29uKHN0YXRzQ29uZmlnKTtcbiAgICAgICAgICBpZiAob3B0aW9ucy52ZXJib3NlKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmluZm8oc3RhdHMudG9TdHJpbmcoc3RhdHNDb25maWcpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5pbmZvKHN0YXRzVG9TdHJpbmcoanNvbiwgc3RhdHNDb25maWcpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoc3RhdHMuaGFzV2FybmluZ3MoKSkge1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKHN0YXRzV2FybmluZ3NUb1N0cmluZyhqc29uLCBzdGF0c0NvbmZpZykpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc3RhdHMuaGFzRXJyb3JzKCkpIHtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuZXJyb3Ioc3RhdHNFcnJvcnNUb1N0cmluZyhqc29uLCBzdGF0c0NvbmZpZykpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChvcHRpb25zLndhdGNoKSB7XG4gICAgICAgICAgICBvYnMubmV4dCh7IHN1Y2Nlc3M6ICFzdGF0cy5oYXNFcnJvcnMoKSB9KTtcblxuICAgICAgICAgICAgLy8gTmV2ZXIgY29tcGxldGUgb24gd2F0Y2ggbW9kZS5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGJ1aWxkZXJDb25maWcub3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgICAgICAgICAgIGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlcihcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRleHQuaG9zdCxcbiAgICAgICAgICAgICAgICByb290LFxuICAgICAgICAgICAgICAgIHByb2plY3RSb290LFxuICAgICAgICAgICAgICAgIHJlc29sdmUocm9vdCwgbm9ybWFsaXplKG9wdGlvbnMub3V0cHV0UGF0aCkpLFxuICAgICAgICAgICAgICAgIG9wdGlvbnMuYmFzZUhyZWYgfHwgJy8nLFxuICAgICAgICAgICAgICApLnRoZW4oXG4gICAgICAgICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgb2JzLm5leHQoeyBzdWNjZXNzOiAhc3RhdHMuaGFzRXJyb3JzKCkgfSk7XG4gICAgICAgICAgICAgICAgICBvYnMuY29tcGxldGUoKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAvLyBXZSBlcnJvciBvdXQgaGVyZSBiZWNhdXNlIHdlJ3JlIG5vdCBpbiB3YXRjaCBtb2RlIGFueXdheSAoc2VlIGFib3ZlKS5cbiAgICAgICAgICAgICAgICAgIG9icy5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvYnMubmV4dCh7IHN1Y2Nlc3M6ICFzdGF0cy5oYXNFcnJvcnMoKSB9KTtcbiAgICAgICAgICAgICAgb2JzLmNvbXBsZXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaWYgKG9wdGlvbnMud2F0Y2gpIHtcbiAgICAgICAgICAgIGNvbnN0IHdhdGNoaW5nID0gd2VicGFja0NvbXBpbGVyLndhdGNoKHsgcG9sbDogb3B0aW9ucy5wb2xsIH0sIGNhbGxiYWNrKTtcblxuICAgICAgICAgICAgLy8gVGVhcmRvd24gbG9naWMuIENsb3NlIHRoZSB3YXRjaGVyIHdoZW4gdW5zdWJzY3JpYmVkIGZyb20uXG4gICAgICAgICAgICByZXR1cm4gKCkgPT4gd2F0Y2hpbmcuY2xvc2UoKCkgPT4geyB9KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgd2VicGFja0NvbXBpbGVyLnJ1bihjYWxsYmFjayk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmVycm9yKFxuICAgICAgICAgICAgICAnXFxuQW4gZXJyb3Igb2NjdXJlZCBkdXJpbmcgdGhlIGJ1aWxkOlxcbicgKyAoKGVyciAmJiBlcnIuc3RhY2spIHx8IGVycikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH0pKSxcbiAgICApO1xuICB9XG5cbiAgYnVpbGRXZWJwYWNrQ29uZmlnKFxuICAgIHJvb3Q6IFBhdGgsXG4gICAgcHJvamVjdFJvb3Q6IFBhdGgsXG4gICAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICApIHtcbiAgICBsZXQgd2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucztcblxuICAgIGNvbnN0IGhvc3QgPSBuZXcgdmlydHVhbEZzLkFsaWFzSG9zdCh0aGlzLmNvbnRleHQuaG9zdCBhcyB2aXJ0dWFsRnMuSG9zdDxmcy5TdGF0cz4pO1xuXG4gICAgb3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzLmZvckVhY2goKHsgc3JjLCByZXBsYWNlV2l0aCB9KSA9PiB7XG4gICAgICBob3N0LmFsaWFzZXMuc2V0KFxuICAgICAgICBqb2luKHJvb3QsIG5vcm1hbGl6ZShzcmMpKSxcbiAgICAgICAgam9pbihyb290LCBub3JtYWxpemUocmVwbGFjZVdpdGgpKSxcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICAvLyBUT0RPOiBtYWtlIHRhcmdldCBkZWZhdWx0cyBpbnRvIGNvbmZpZ3VyYXRpb25zIGluc3RlYWRcbiAgICAvLyBvcHRpb25zID0gdGhpcy5hZGRUYXJnZXREZWZhdWx0cyhvcHRpb25zKTtcblxuICAgIGNvbnN0IHRzQ29uZmlnUGF0aCA9IGdldFN5c3RlbVBhdGgobm9ybWFsaXplKHJlc29sdmUocm9vdCwgbm9ybWFsaXplKG9wdGlvbnMudHNDb25maWcpKSkpO1xuICAgIGNvbnN0IHRzQ29uZmlnID0gcmVhZFRzY29uZmlnKHRzQ29uZmlnUGF0aCk7XG5cbiAgICBjb25zdCBwcm9qZWN0VHMgPSByZXF1aXJlUHJvamVjdE1vZHVsZShnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSwgJ3R5cGVzY3JpcHQnKSBhcyB0eXBlb2YgdHM7XG5cbiAgICBjb25zdCBzdXBwb3J0RVMyMDE1ID0gdHNDb25maWcub3B0aW9ucy50YXJnZXQgIT09IHByb2plY3RUcy5TY3JpcHRUYXJnZXQuRVMzXG4gICAgICAmJiB0c0NvbmZpZy5vcHRpb25zLnRhcmdldCAhPT0gcHJvamVjdFRzLlNjcmlwdFRhcmdldC5FUzU7XG5cbiAgICB3Y28gPSB7XG4gICAgICByb290OiBnZXRTeXN0ZW1QYXRoKHJvb3QpLFxuICAgICAgcHJvamVjdFJvb3Q6IGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLFxuICAgICAgLy8gVE9ETzogdXNlIG9ubHkgdGhpcy5vcHRpb25zLCBpdCBjb250YWlucyBhbGwgZmxhZ3MgYW5kIGNvbmZpZ3MgaXRlbXMgYWxyZWFkeS5cbiAgICAgIGJ1aWxkT3B0aW9uczogb3B0aW9ucyxcbiAgICAgIHRzQ29uZmlnLFxuICAgICAgdHNDb25maWdQYXRoLFxuICAgICAgc3VwcG9ydEVTMjAxNSxcbiAgICB9O1xuXG5cbiAgICAvLyBUT0RPOiBhZGQgdGhlIG9sZCBkZXYgb3B0aW9ucyBhcyB0aGUgZGVmYXVsdCwgYW5kIHRoZSBwcm9kIG9uZSBhcyBhIGNvbmZpZ3VyYXRpb246XG4gICAgLy8gZGV2ZWxvcG1lbnQ6IHtcbiAgICAvLyAgIGVudmlyb25tZW50OiAnZGV2JyxcbiAgICAvLyAgIG91dHB1dEhhc2hpbmc6ICdtZWRpYScsXG4gICAgLy8gICBzb3VyY2VtYXBzOiB0cnVlLFxuICAgIC8vICAgZXh0cmFjdENzczogZmFsc2UsXG4gICAgLy8gICBuYW1lZENodW5rczogdHJ1ZSxcbiAgICAvLyAgIGFvdDogZmFsc2UsXG4gICAgLy8gICB2ZW5kb3JDaHVuazogdHJ1ZSxcbiAgICAvLyAgIGJ1aWxkT3B0aW1pemVyOiBmYWxzZSxcbiAgICAvLyB9LFxuICAgIC8vIHByb2R1Y3Rpb246IHtcbiAgICAvLyAgIGVudmlyb25tZW50OiAncHJvZCcsXG4gICAgLy8gICBvdXRwdXRIYXNoaW5nOiAnYWxsJyxcbiAgICAvLyAgIHNvdXJjZW1hcHM6IGZhbHNlLFxuICAgIC8vICAgZXh0cmFjdENzczogdHJ1ZSxcbiAgICAvLyAgIG5hbWVkQ2h1bmtzOiBmYWxzZSxcbiAgICAvLyAgIGFvdDogdHJ1ZSxcbiAgICAvLyAgIGV4dHJhY3RMaWNlbnNlczogdHJ1ZSxcbiAgICAvLyAgIHZlbmRvckNodW5rOiBmYWxzZSxcbiAgICAvLyAgIGJ1aWxkT3B0aW1pemVyOiBidWlsZE9wdGlvbnMuYW90ICE9PSBmYWxzZSxcbiAgICAvLyB9XG5cbiAgICBjb25zdCB3ZWJwYWNrQ29uZmlnczoge31bXSA9IFtcbiAgICAgIGdldENvbW1vbkNvbmZpZyh3Y28pLFxuICAgICAgZ2V0QnJvd3NlckNvbmZpZyh3Y28pLFxuICAgICAgZ2V0U3R5bGVzQ29uZmlnKHdjbyksXG4gICAgXTtcblxuICAgIGlmICh3Y28uYnVpbGRPcHRpb25zLm1haW4gfHwgd2NvLmJ1aWxkT3B0aW9ucy5wb2x5ZmlsbHMpIHtcbiAgICAgIGNvbnN0IHR5cGVzY3JpcHRDb25maWdQYXJ0aWFsID0gd2NvLmJ1aWxkT3B0aW9ucy5hb3RcbiAgICAgICAgPyBnZXRBb3RDb25maWcod2NvLCBob3N0KVxuICAgICAgICA6IGdldE5vbkFvdENvbmZpZyh3Y28sIGhvc3QpO1xuICAgICAgd2VicGFja0NvbmZpZ3MucHVzaCh0eXBlc2NyaXB0Q29uZmlnUGFydGlhbCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHdlYnBhY2tNZXJnZSh3ZWJwYWNrQ29uZmlncyk7XG4gIH1cblxuICBwcml2YXRlIF9kZWxldGVPdXRwdXREaXIocm9vdDogUGF0aCwgb3V0cHV0UGF0aDogUGF0aCwgaG9zdDogdmlydHVhbEZzLkhvc3QpIHtcbiAgICBjb25zdCByZXNvbHZlZE91dHB1dFBhdGggPSByZXNvbHZlKHJvb3QsIG91dHB1dFBhdGgpO1xuICAgIGlmIChyZXNvbHZlZE91dHB1dFBhdGggPT09IHJvb3QpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignT3V0cHV0IHBhdGggTVVTVCBub3QgYmUgcHJvamVjdCByb290IGRpcmVjdG9yeSEnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaG9zdC5leGlzdHMocmVzb2x2ZWRPdXRwdXRQYXRoKS5waXBlKFxuICAgICAgY29uY2F0TWFwKGV4aXN0cyA9PiBleGlzdHNcbiAgICAgICAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgY29uY2F0IG9uY2UgaG9zdCBvcHMgZW1pdCBhbiBldmVudC5cbiAgICAgICAgPyBjb25jYXQoaG9zdC5kZWxldGUocmVzb2x2ZWRPdXRwdXRQYXRoKSwgb2YobnVsbCkpLnBpcGUobGFzdCgpKVxuICAgICAgICAvLyA/IG9mKG51bGwpXG4gICAgICAgIDogb2YobnVsbCkpLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQnJvd3NlckJ1aWxkZXI7XG4iXX0=