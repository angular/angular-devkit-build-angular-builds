"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular-devkit/core");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const webpack_configs_1 = require("../angular-cli-files/models/webpack-configs");
const read_tsconfig_1 = require("../angular-cli-files/utilities/read-tsconfig");
const require_project_module_1 = require("../angular-cli-files/utilities/require-project-module");
const utils_1 = require("../utils");
const webpackMerge = require('webpack-merge');
class KarmaBuilder {
    constructor(context) {
        this.context = context;
    }
    run(builderConfig) {
        const root = this.context.workspace.root;
        const projectRoot = core_1.resolve(root, builderConfig.root);
        const host = new core_1.virtualFs.AliasHost(this.context.host);
        const options = utils_1.normalizeKarmaSchema(host, root, core_1.resolve(root, builderConfig.root), builderConfig.sourceRoot, builderConfig.options);
        return rxjs_1.of(null).pipe(operators_1.concatMap(() => new rxjs_1.Observable(obs => {
            const karma = require_project_module_1.requireProjectModule(core_1.getSystemPath(projectRoot), 'karma');
            const karmaConfig = core_1.getSystemPath(core_1.resolve(root, core_1.normalize(options.karmaConfig)));
            // TODO: adjust options to account for not passing them blindly to karma.
            // const karmaOptions: any = Object.assign({}, options);
            // tslint:disable-next-line:no-any
            const karmaOptions = {};
            if (options.watch !== undefined) {
                karmaOptions.singleRun = !options.watch;
            }
            // Convert browsers from a string to an array
            if (options.browsers) {
                karmaOptions.browsers = options.browsers.split(',');
            }
            if (options.reporters) {
                // Split along commas to make it more natural, and remove empty strings.
                const reporters = options.reporters
                    .reduce((acc, curr) => acc.concat(curr.split(/,/)), [])
                    .filter(x => !!x);
                if (reporters.length > 0) {
                    karmaOptions.reporters = reporters;
                }
            }
            const sourceRoot = builderConfig.sourceRoot && core_1.resolve(root, builderConfig.sourceRoot);
            karmaOptions.buildWebpack = {
                root: core_1.getSystemPath(root),
                projectRoot: core_1.getSystemPath(projectRoot),
                options,
                webpackConfig: this.buildWebpackConfig(root, projectRoot, sourceRoot, host, options),
                // Pass onto Karma to emit BuildEvents.
                successCb: () => obs.next({ success: true }),
                failureCb: () => obs.next({ success: false }),
                // Workaround for https://github.com/karma-runner/karma/issues/3154
                // When this workaround is removed, user projects need to be updated to use a Karma
                // version that has a fix for this issue.
                toJSON: () => { },
                logger: this.context.logger,
            };
            // TODO: inside the configs, always use the project root and not the workspace root.
            // Until then we pretend the app root is relative (``) but the same as `projectRoot`.
            karmaOptions.buildWebpack.options.root = '';
            // Assign additional karmaConfig options to the local ngapp config
            karmaOptions.configFile = karmaConfig;
            // Complete the observable once the Karma server returns.
            const karmaServer = new karma.Server(karmaOptions, () => obs.complete());
            const karmaStartPromise = karmaServer.start();
            // Cleanup, signal Karma to exit.
            return () => {
                // Karma only has the `stop` method start with 3.1.1, so we must defensively check.
                if (karmaServer.stop && typeof karmaServer.stop === 'function') {
                    return karmaStartPromise.then(() => karmaServer.stop());
                }
            };
        })));
    }
    buildWebpackConfig(root, projectRoot, sourceRoot, host, options) {
        let wco;
        const tsConfigPath = core_1.getSystemPath(core_1.resolve(root, core_1.normalize(options.tsConfig)));
        const tsConfig = read_tsconfig_1.readTsconfig(tsConfigPath);
        const projectTs = require_project_module_1.requireProjectModule(core_1.getSystemPath(projectRoot), 'typescript');
        const supportES2015 = tsConfig.options.target !== projectTs.ScriptTarget.ES3
            && tsConfig.options.target !== projectTs.ScriptTarget.ES5;
        const compatOptions = Object.assign({}, options, { 
            // Some asset logic inside getCommonConfig needs outputPath to be set.
            outputPath: '' });
        wco = {
            root: core_1.getSystemPath(root),
            logger: this.context.logger,
            projectRoot: core_1.getSystemPath(projectRoot),
            sourceRoot: sourceRoot && core_1.getSystemPath(sourceRoot),
            // TODO: use only this.options, it contains all flags and configs items already.
            buildOptions: compatOptions,
            tsConfig,
            tsConfigPath,
            supportES2015,
        };
        wco.buildOptions.progress = utils_1.defaultProgress(wco.buildOptions.progress);
        const webpackConfigs = [
            webpack_configs_1.getCommonConfig(wco),
            webpack_configs_1.getStylesConfig(wco),
            webpack_configs_1.getNonAotTestConfig(wco, host),
            webpack_configs_1.getTestConfig(wco),
        ];
        return webpackMerge(webpackConfigs);
    }
}
exports.KarmaBuilder = KarmaBuilder;
exports.default = KarmaBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2thcm1hL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7O0FBUUgsK0NBQTBGO0FBRTFGLCtCQUFzQztBQUN0Qyw4Q0FBMkM7QUFHM0MsaUZBS3FEO0FBQ3JELGdGQUE0RTtBQUM1RSxrR0FBNkY7QUFDN0Ysb0NBQStGO0FBRS9GLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUc5QyxNQUFhLFlBQVk7SUFDdkIsWUFBbUIsT0FBdUI7UUFBdkIsWUFBTyxHQUFQLE9BQU8sQ0FBZ0I7SUFBSSxDQUFDO0lBRS9DLEdBQUcsQ0FBQyxhQUF1RDtRQUN6RCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDekMsTUFBTSxXQUFXLEdBQUcsY0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsTUFBTSxJQUFJLEdBQUcsSUFBSSxnQkFBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQWdDLENBQUMsQ0FBQztRQUVwRixNQUFNLE9BQU8sR0FBRyw0QkFBb0IsQ0FDbEMsSUFBSSxFQUNKLElBQUksRUFDSixjQUFPLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUMsRUFDakMsYUFBYSxDQUFDLFVBQVUsRUFDeEIsYUFBYSxDQUFDLE9BQU8sQ0FDdEIsQ0FBQztRQUVGLE9BQU8sU0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FDbEIscUJBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLGlCQUFVLENBQWEsR0FBRyxDQUFDLEVBQUU7WUFDL0MsTUFBTSxLQUFLLEdBQUcsNkNBQW9CLENBQUMsb0JBQWEsQ0FBQyxXQUFXLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUN4RSxNQUFNLFdBQVcsR0FBRyxvQkFBYSxDQUFDLGNBQU8sQ0FBQyxJQUFJLEVBQUUsZ0JBQVMsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRWpGLHlFQUF5RTtZQUN6RSx3REFBd0Q7WUFDeEQsa0NBQWtDO1lBQ2xDLE1BQU0sWUFBWSxHQUFRLEVBQUUsQ0FBQztZQUU3QixJQUFJLE9BQU8sQ0FBQyxLQUFLLEtBQUssU0FBUyxFQUFFO2dCQUMvQixZQUFZLENBQUMsU0FBUyxHQUFHLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQzthQUN6QztZQUVELDZDQUE2QztZQUM3QyxJQUFJLE9BQU8sQ0FBQyxRQUFRLEVBQUU7Z0JBQ3BCLFlBQVksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7YUFDckQ7WUFFRCxJQUFJLE9BQU8sQ0FBQyxTQUFTLEVBQUU7Z0JBQ3JCLHdFQUF3RTtnQkFDeEUsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLFNBQVM7cUJBQ2hDLE1BQU0sQ0FBVyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQztxQkFDaEUsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUVwQixJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO29CQUN4QixZQUFZLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztpQkFDcEM7YUFDRjtZQUVELE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxVQUFVLElBQUksY0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7WUFFdkYsWUFBWSxDQUFDLFlBQVksR0FBRztnQkFDMUIsSUFBSSxFQUFFLG9CQUFhLENBQUMsSUFBSSxDQUFDO2dCQUN6QixXQUFXLEVBQUUsb0JBQWEsQ0FBQyxXQUFXLENBQUM7Z0JBQ3ZDLE9BQU87Z0JBQ1AsYUFBYSxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDO2dCQUNwRix1Q0FBdUM7Z0JBQ3ZDLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDO2dCQUM1QyxTQUFTLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztnQkFDN0MsbUVBQW1FO2dCQUNuRSxtRkFBbUY7Z0JBQ25GLHlDQUF5QztnQkFDekMsTUFBTSxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7Z0JBQ2pCLE1BQU0sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU07YUFDNUIsQ0FBQztZQUVGLG9GQUFvRjtZQUNwRixxRkFBcUY7WUFDckYsWUFBWSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztZQUU1QyxrRUFBa0U7WUFDbEUsWUFBWSxDQUFDLFVBQVUsR0FBRyxXQUFXLENBQUM7WUFFdEMseURBQXlEO1lBQ3pELE1BQU0sV0FBVyxHQUFHLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDekUsTUFBTSxpQkFBaUIsR0FBRyxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUM7WUFFOUMsaUNBQWlDO1lBQ2pDLE9BQU8sR0FBRyxFQUFFO2dCQUNWLG1GQUFtRjtnQkFDbkYsSUFBSSxXQUFXLENBQUMsSUFBSSxJQUFJLE9BQU8sV0FBVyxDQUFDLElBQUksS0FBSyxVQUFVLEVBQUU7b0JBQzlELE9BQU8saUJBQWlCLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO2lCQUN6RDtZQUNILENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDLENBQ0osQ0FBQztJQUNKLENBQUM7SUFFRCxrQkFBa0IsQ0FDaEIsSUFBVSxFQUNWLFdBQWlCLEVBQ2pCLFVBQTRCLEVBQzVCLElBQThCLEVBQzlCLE9BQXFDO1FBRXJDLElBQUksR0FBeUIsQ0FBQztRQUU5QixNQUFNLFlBQVksR0FBRyxvQkFBYSxDQUFDLGNBQU8sQ0FBQyxJQUFJLEVBQUUsZ0JBQVMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQy9FLE1BQU0sUUFBUSxHQUFHLDRCQUFZLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFNUMsTUFBTSxTQUFTLEdBQUcsNkNBQW9CLENBQUMsb0JBQWEsQ0FBQyxXQUFXLENBQUMsRUFBRSxZQUFZLENBQWMsQ0FBQztRQUU5RixNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sS0FBSyxTQUFTLENBQUMsWUFBWSxDQUFDLEdBQUc7ZUFDdkUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssU0FBUyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUM7UUFFNUQsTUFBTSxhQUFhLHFCQUNkLE9BQTJDO1lBQzlDLHNFQUFzRTtZQUN0RSxVQUFVLEVBQUUsRUFBRSxHQUNmLENBQUM7UUFFRixHQUFHLEdBQUc7WUFDSixJQUFJLEVBQUUsb0JBQWEsQ0FBQyxJQUFJLENBQUM7WUFDekIsTUFBTSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTTtZQUMzQixXQUFXLEVBQUUsb0JBQWEsQ0FBQyxXQUFXLENBQUM7WUFDdkMsVUFBVSxFQUFFLFVBQVUsSUFBSSxvQkFBYSxDQUFDLFVBQVUsQ0FBQztZQUNuRCxnRkFBZ0Y7WUFDaEYsWUFBWSxFQUFFLGFBQWE7WUFDM0IsUUFBUTtZQUNSLFlBQVk7WUFDWixhQUFhO1NBQ2QsQ0FBQztRQUVGLEdBQUcsQ0FBQyxZQUFZLENBQUMsUUFBUSxHQUFHLHVCQUFlLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUV2RSxNQUFNLGNBQWMsR0FBUztZQUMzQixpQ0FBZSxDQUFDLEdBQUcsQ0FBQztZQUNwQixpQ0FBZSxDQUFDLEdBQUcsQ0FBQztZQUNwQixxQ0FBbUIsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDO1lBQzlCLCtCQUFhLENBQUMsR0FBRyxDQUFDO1NBQ25CLENBQUM7UUFFRixPQUFPLFlBQVksQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUN0QyxDQUFDO0NBQ0Y7QUFuSUQsb0NBbUlDO0FBRUQsa0JBQWUsWUFBWSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZEV2ZW50LFxuICBCdWlsZGVyLFxuICBCdWlsZGVyQ29uZmlndXJhdGlvbixcbiAgQnVpbGRlckNvbnRleHQsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgUGF0aCwgZ2V0U3lzdGVtUGF0aCwgbm9ybWFsaXplLCByZXNvbHZlLCB2aXJ0dWFsRnMgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBvZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL21vZGVscy9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7XG4gIGdldENvbW1vbkNvbmZpZyxcbiAgZ2V0Tm9uQW90VGVzdENvbmZpZyxcbiAgZ2V0U3R5bGVzQ29uZmlnLFxuICBnZXRUZXN0Q29uZmlnLFxufSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzJztcbmltcG9ydCB7IHJlYWRUc2NvbmZpZyB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9yZWFkLXRzY29uZmlnJztcbmltcG9ydCB7IHJlcXVpcmVQcm9qZWN0TW9kdWxlIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3JlcXVpcmUtcHJvamVjdC1tb2R1bGUnO1xuaW1wb3J0IHsgTm9ybWFsaXplZEthcm1hQnVpbGRlclNjaGVtYSwgZGVmYXVsdFByb2dyZXNzLCBub3JtYWxpemVLYXJtYVNjaGVtYSB9IGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCB7IEthcm1hQnVpbGRlclNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcbmNvbnN0IHdlYnBhY2tNZXJnZSA9IHJlcXVpcmUoJ3dlYnBhY2stbWVyZ2UnKTtcblxuXG5leHBvcnQgY2xhc3MgS2FybWFCdWlsZGVyIGltcGxlbWVudHMgQnVpbGRlcjxLYXJtYUJ1aWxkZXJTY2hlbWE+IHtcbiAgY29uc3RydWN0b3IocHVibGljIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KSB7IH1cblxuICBydW4oYnVpbGRlckNvbmZpZzogQnVpbGRlckNvbmZpZ3VyYXRpb248S2FybWFCdWlsZGVyU2NoZW1hPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuICAgIGNvbnN0IHJvb3QgPSB0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3Q7XG4gICAgY29uc3QgcHJvamVjdFJvb3QgPSByZXNvbHZlKHJvb3QsIGJ1aWxkZXJDb25maWcucm9vdCk7XG4gICAgY29uc3QgaG9zdCA9IG5ldyB2aXJ0dWFsRnMuQWxpYXNIb3N0KHRoaXMuY29udGV4dC5ob3N0IGFzIHZpcnR1YWxGcy5Ib3N0PGZzLlN0YXRzPik7XG5cbiAgICBjb25zdCBvcHRpb25zID0gbm9ybWFsaXplS2FybWFTY2hlbWEoXG4gICAgICBob3N0LFxuICAgICAgcm9vdCxcbiAgICAgIHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5yb290KSxcbiAgICAgIGJ1aWxkZXJDb25maWcuc291cmNlUm9vdCxcbiAgICAgIGJ1aWxkZXJDb25maWcub3B0aW9ucyxcbiAgICApO1xuXG4gICAgcmV0dXJuIG9mKG51bGwpLnBpcGUoXG4gICAgICBjb25jYXRNYXAoKCkgPT4gbmV3IE9ic2VydmFibGU8QnVpbGRFdmVudD4ob2JzID0+IHtcbiAgICAgICAgY29uc3Qga2FybWEgPSByZXF1aXJlUHJvamVjdE1vZHVsZShnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSwgJ2thcm1hJyk7XG4gICAgICAgIGNvbnN0IGthcm1hQ29uZmlnID0gZ2V0U3lzdGVtUGF0aChyZXNvbHZlKHJvb3QsIG5vcm1hbGl6ZShvcHRpb25zLmthcm1hQ29uZmlnKSkpO1xuXG4gICAgICAgIC8vIFRPRE86IGFkanVzdCBvcHRpb25zIHRvIGFjY291bnQgZm9yIG5vdCBwYXNzaW5nIHRoZW0gYmxpbmRseSB0byBrYXJtYS5cbiAgICAgICAgLy8gY29uc3Qga2FybWFPcHRpb25zOiBhbnkgPSBPYmplY3QuYXNzaWduKHt9LCBvcHRpb25zKTtcbiAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICBjb25zdCBrYXJtYU9wdGlvbnM6IGFueSA9IHt9O1xuXG4gICAgICAgIGlmIChvcHRpb25zLndhdGNoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBrYXJtYU9wdGlvbnMuc2luZ2xlUnVuID0gIW9wdGlvbnMud2F0Y2g7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb252ZXJ0IGJyb3dzZXJzIGZyb20gYSBzdHJpbmcgdG8gYW4gYXJyYXlcbiAgICAgICAgaWYgKG9wdGlvbnMuYnJvd3NlcnMpIHtcbiAgICAgICAgICBrYXJtYU9wdGlvbnMuYnJvd3NlcnMgPSBvcHRpb25zLmJyb3dzZXJzLnNwbGl0KCcsJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5yZXBvcnRlcnMpIHtcbiAgICAgICAgICAvLyBTcGxpdCBhbG9uZyBjb21tYXMgdG8gbWFrZSBpdCBtb3JlIG5hdHVyYWwsIGFuZCByZW1vdmUgZW1wdHkgc3RyaW5ncy5cbiAgICAgICAgICBjb25zdCByZXBvcnRlcnMgPSBvcHRpb25zLnJlcG9ydGVyc1xuICAgICAgICAgICAgLnJlZHVjZTxzdHJpbmdbXT4oKGFjYywgY3VycikgPT4gYWNjLmNvbmNhdChjdXJyLnNwbGl0KC8sLykpLCBbXSlcbiAgICAgICAgICAgIC5maWx0ZXIoeCA9PiAhIXgpO1xuXG4gICAgICAgICAgaWYgKHJlcG9ydGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBrYXJtYU9wdGlvbnMucmVwb3J0ZXJzID0gcmVwb3J0ZXJzO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNvdXJjZVJvb3QgPSBidWlsZGVyQ29uZmlnLnNvdXJjZVJvb3QgJiYgcmVzb2x2ZShyb290LCBidWlsZGVyQ29uZmlnLnNvdXJjZVJvb3QpO1xuXG4gICAgICAgIGthcm1hT3B0aW9ucy5idWlsZFdlYnBhY2sgPSB7XG4gICAgICAgICAgcm9vdDogZ2V0U3lzdGVtUGF0aChyb290KSxcbiAgICAgICAgICBwcm9qZWN0Um9vdDogZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksXG4gICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICB3ZWJwYWNrQ29uZmlnOiB0aGlzLmJ1aWxkV2VicGFja0NvbmZpZyhyb290LCBwcm9qZWN0Um9vdCwgc291cmNlUm9vdCwgaG9zdCwgb3B0aW9ucyksXG4gICAgICAgICAgLy8gUGFzcyBvbnRvIEthcm1hIHRvIGVtaXQgQnVpbGRFdmVudHMuXG4gICAgICAgICAgc3VjY2Vzc0NiOiAoKSA9PiBvYnMubmV4dCh7IHN1Y2Nlc3M6IHRydWUgfSksXG4gICAgICAgICAgZmFpbHVyZUNiOiAoKSA9PiBvYnMubmV4dCh7IHN1Y2Nlc3M6IGZhbHNlIH0pLFxuICAgICAgICAgIC8vIFdvcmthcm91bmQgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9rYXJtYS1ydW5uZXIva2FybWEvaXNzdWVzLzMxNTRcbiAgICAgICAgICAvLyBXaGVuIHRoaXMgd29ya2Fyb3VuZCBpcyByZW1vdmVkLCB1c2VyIHByb2plY3RzIG5lZWQgdG8gYmUgdXBkYXRlZCB0byB1c2UgYSBLYXJtYVxuICAgICAgICAgIC8vIHZlcnNpb24gdGhhdCBoYXMgYSBmaXggZm9yIHRoaXMgaXNzdWUuXG4gICAgICAgICAgdG9KU09OOiAoKSA9PiB7IH0sXG4gICAgICAgICAgbG9nZ2VyOiB0aGlzLmNvbnRleHQubG9nZ2VyLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFRPRE86IGluc2lkZSB0aGUgY29uZmlncywgYWx3YXlzIHVzZSB0aGUgcHJvamVjdCByb290IGFuZCBub3QgdGhlIHdvcmtzcGFjZSByb290LlxuICAgICAgICAvLyBVbnRpbCB0aGVuIHdlIHByZXRlbmQgdGhlIGFwcCByb290IGlzIHJlbGF0aXZlIChgYCkgYnV0IHRoZSBzYW1lIGFzIGBwcm9qZWN0Um9vdGAuXG4gICAgICAgIGthcm1hT3B0aW9ucy5idWlsZFdlYnBhY2sub3B0aW9ucy5yb290ID0gJyc7XG5cbiAgICAgICAgLy8gQXNzaWduIGFkZGl0aW9uYWwga2FybWFDb25maWcgb3B0aW9ucyB0byB0aGUgbG9jYWwgbmdhcHAgY29uZmlnXG4gICAgICAgIGthcm1hT3B0aW9ucy5jb25maWdGaWxlID0ga2FybWFDb25maWc7XG5cbiAgICAgICAgLy8gQ29tcGxldGUgdGhlIG9ic2VydmFibGUgb25jZSB0aGUgS2FybWEgc2VydmVyIHJldHVybnMuXG4gICAgICAgIGNvbnN0IGthcm1hU2VydmVyID0gbmV3IGthcm1hLlNlcnZlcihrYXJtYU9wdGlvbnMsICgpID0+IG9icy5jb21wbGV0ZSgpKTtcbiAgICAgICAgY29uc3Qga2FybWFTdGFydFByb21pc2UgPSBrYXJtYVNlcnZlci5zdGFydCgpO1xuXG4gICAgICAgIC8vIENsZWFudXAsIHNpZ25hbCBLYXJtYSB0byBleGl0LlxuICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgIC8vIEthcm1hIG9ubHkgaGFzIHRoZSBgc3RvcGAgbWV0aG9kIHN0YXJ0IHdpdGggMy4xLjEsIHNvIHdlIG11c3QgZGVmZW5zaXZlbHkgY2hlY2suXG4gICAgICAgICAgaWYgKGthcm1hU2VydmVyLnN0b3AgJiYgdHlwZW9mIGthcm1hU2VydmVyLnN0b3AgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHJldHVybiBrYXJtYVN0YXJ0UHJvbWlzZS50aGVuKCgpID0+IGthcm1hU2VydmVyLnN0b3AoKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfSkpLFxuICAgICk7XG4gIH1cblxuICBidWlsZFdlYnBhY2tDb25maWcoXG4gICAgcm9vdDogUGF0aCxcbiAgICBwcm9qZWN0Um9vdDogUGF0aCxcbiAgICBzb3VyY2VSb290OiBQYXRoIHwgdW5kZWZpbmVkLFxuICAgIGhvc3Q6IHZpcnR1YWxGcy5Ib3N0PGZzLlN0YXRzPixcbiAgICBvcHRpb25zOiBOb3JtYWxpemVkS2FybWFCdWlsZGVyU2NoZW1hLFxuICApIHtcbiAgICBsZXQgd2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucztcblxuICAgIGNvbnN0IHRzQ29uZmlnUGF0aCA9IGdldFN5c3RlbVBhdGgocmVzb2x2ZShyb290LCBub3JtYWxpemUob3B0aW9ucy50c0NvbmZpZykpKTtcbiAgICBjb25zdCB0c0NvbmZpZyA9IHJlYWRUc2NvbmZpZyh0c0NvbmZpZ1BhdGgpO1xuXG4gICAgY29uc3QgcHJvamVjdFRzID0gcmVxdWlyZVByb2plY3RNb2R1bGUoZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksICd0eXBlc2NyaXB0JykgYXMgdHlwZW9mIHRzO1xuXG4gICAgY29uc3Qgc3VwcG9ydEVTMjAxNSA9IHRzQ29uZmlnLm9wdGlvbnMudGFyZ2V0ICE9PSBwcm9qZWN0VHMuU2NyaXB0VGFyZ2V0LkVTM1xuICAgICAgJiYgdHNDb25maWcub3B0aW9ucy50YXJnZXQgIT09IHByb2plY3RUcy5TY3JpcHRUYXJnZXQuRVM1O1xuXG4gICAgY29uc3QgY29tcGF0T3B0aW9uczogdHlwZW9mIHdjb1snYnVpbGRPcHRpb25zJ10gPSB7XG4gICAgICAuLi5vcHRpb25zIGFzIHt9IGFzIHR5cGVvZiB3Y29bJ2J1aWxkT3B0aW9ucyddLFxuICAgICAgLy8gU29tZSBhc3NldCBsb2dpYyBpbnNpZGUgZ2V0Q29tbW9uQ29uZmlnIG5lZWRzIG91dHB1dFBhdGggdG8gYmUgc2V0LlxuICAgICAgb3V0cHV0UGF0aDogJycsXG4gICAgfTtcblxuICAgIHdjbyA9IHtcbiAgICAgIHJvb3Q6IGdldFN5c3RlbVBhdGgocm9vdCksXG4gICAgICBsb2dnZXI6IHRoaXMuY29udGV4dC5sb2dnZXIsXG4gICAgICBwcm9qZWN0Um9vdDogZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksXG4gICAgICBzb3VyY2VSb290OiBzb3VyY2VSb290ICYmIGdldFN5c3RlbVBhdGgoc291cmNlUm9vdCksXG4gICAgICAvLyBUT0RPOiB1c2Ugb25seSB0aGlzLm9wdGlvbnMsIGl0IGNvbnRhaW5zIGFsbCBmbGFncyBhbmQgY29uZmlncyBpdGVtcyBhbHJlYWR5LlxuICAgICAgYnVpbGRPcHRpb25zOiBjb21wYXRPcHRpb25zLFxuICAgICAgdHNDb25maWcsXG4gICAgICB0c0NvbmZpZ1BhdGgsXG4gICAgICBzdXBwb3J0RVMyMDE1LFxuICAgIH07XG5cbiAgICB3Y28uYnVpbGRPcHRpb25zLnByb2dyZXNzID0gZGVmYXVsdFByb2dyZXNzKHdjby5idWlsZE9wdGlvbnMucHJvZ3Jlc3MpO1xuXG4gICAgY29uc3Qgd2VicGFja0NvbmZpZ3M6IHt9W10gPSBbXG4gICAgICBnZXRDb21tb25Db25maWcod2NvKSxcbiAgICAgIGdldFN0eWxlc0NvbmZpZyh3Y28pLFxuICAgICAgZ2V0Tm9uQW90VGVzdENvbmZpZyh3Y28sIGhvc3QpLFxuICAgICAgZ2V0VGVzdENvbmZpZyh3Y28pLFxuICAgIF07XG5cbiAgICByZXR1cm4gd2VicGFja01lcmdlKHdlYnBhY2tDb25maWdzKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBLYXJtYUJ1aWxkZXI7XG4iXX0=