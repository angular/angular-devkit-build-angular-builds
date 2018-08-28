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
        const options = builderConfig.options;
        const root = this.context.workspace.root;
        const projectRoot = core_1.resolve(root, builderConfig.root);
        const host = new core_1.virtualFs.AliasHost(this.context.host);
        return rxjs_1.of(null).pipe(operators_1.concatMap(() => utils_1.normalizeFileReplacements(options.fileReplacements, host, root)), operators_1.tap(fileReplacements => options.fileReplacements = fileReplacements), operators_1.concatMap(() => utils_1.normalizeAssetPatterns(options.assets, host, root, projectRoot, builderConfig.sourceRoot)), 
        // Replace the assets in options with the normalized version.
        operators_1.tap((assetPatternObjects => options.assets = assetPatternObjects)), operators_1.concatMap(() => new rxjs_1.Observable(obs => {
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
            const sourceRoot = builderConfig.sourceRoot && core_1.resolve(root, builderConfig.sourceRoot);
            karmaOptions.buildWebpack = {
                root: core_1.getSystemPath(root),
                projectRoot: core_1.getSystemPath(projectRoot),
                options: options,
                webpackConfig: this._buildWebpackConfig(root, projectRoot, sourceRoot, host, options),
                // Pass onto Karma to emit BuildEvents.
                successCb: () => obs.next({ success: true }),
                failureCb: () => obs.next({ success: false }),
            };
            // TODO: inside the configs, always use the project root and not the workspace root.
            // Until then we pretend the app root is relative (``) but the same as `projectRoot`.
            karmaOptions.buildWebpack.options.root = '';
            // Assign additional karmaConfig options to the local ngapp config
            karmaOptions.configFile = karmaConfig;
            // Complete the observable once the Karma server returns.
            const karmaServer = new karma.Server(karmaOptions, () => obs.complete());
            karmaServer.start();
            // Cleanup, signal Karma to exit.
            return () => {
                // Karma does not seem to have a way to exit the server gracefully.
                // See https://github.com/karma-runner/karma/issues/2867#issuecomment-369912167
                // TODO: make a PR for karma to add `karmaServer.close(code)`, that
                // calls `disconnectBrowsers(code);`
                // karmaServer.close();
            };
        })));
    }
    _buildWebpackConfig(root, projectRoot, sourceRoot, host, options) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2thcm1hL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7O0FBUUgsK0NBQTBGO0FBRTFGLCtCQUFzQztBQUN0Qyw4Q0FBZ0Q7QUFHaEQsaUZBS3FEO0FBQ3JELGdGQUE0RTtBQUM1RSxrR0FBNkY7QUFFN0Ysb0NBQThGO0FBRTlGLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQVE5QztJQUNFLFlBQW1CLE9BQXVCO1FBQXZCLFlBQU8sR0FBUCxPQUFPLENBQWdCO0lBQUksQ0FBQztJQUUvQyxHQUFHLENBQUMsYUFBdUQ7UUFDekQsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQztRQUN0QyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDekMsTUFBTSxXQUFXLEdBQUcsY0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsTUFBTSxJQUFJLEdBQUcsSUFBSSxnQkFBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQWdDLENBQUMsQ0FBQztRQUVwRixPQUFPLFNBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQ2xCLHFCQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsaUNBQXlCLENBQUMsT0FBTyxDQUFDLGdCQUFnQixFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUNoRixlQUFHLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsR0FBRyxnQkFBZ0IsQ0FBQyxFQUNwRSxxQkFBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLDhCQUFzQixDQUNwQyxPQUFPLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNyRSw2REFBNkQ7UUFDN0QsZUFBRyxDQUFDLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsbUJBQW1CLENBQUMsQ0FBQyxFQUNsRSxxQkFBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksaUJBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNuQyxNQUFNLEtBQUssR0FBRyw2Q0FBb0IsQ0FBQyxvQkFBYSxDQUFDLFdBQVcsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3hFLE1BQU0sV0FBVyxHQUFHLG9CQUFhLENBQUMsY0FBTyxDQUFDLElBQUksRUFBRSxnQkFBUyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFakYseUVBQXlFO1lBQ3pFLHdEQUF3RDtZQUN4RCxrQ0FBa0M7WUFDbEMsTUFBTSxZQUFZLEdBQVEsRUFBRSxDQUFDO1lBRTdCLElBQUksT0FBTyxDQUFDLEtBQUssS0FBSyxTQUFTLEVBQUU7Z0JBQy9CLFlBQVksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO2FBQ3pDO1lBRUQsNkNBQTZDO1lBQzdDLElBQUksT0FBTyxDQUFDLFFBQVEsRUFBRTtnQkFDcEIsWUFBWSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUNyRDtZQUVELE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxVQUFVLElBQUksY0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7WUFFdkYsWUFBWSxDQUFDLFlBQVksR0FBRztnQkFDMUIsSUFBSSxFQUFFLG9CQUFhLENBQUMsSUFBSSxDQUFDO2dCQUN6QixXQUFXLEVBQUUsb0JBQWEsQ0FBQyxXQUFXLENBQUM7Z0JBQ3ZDLE9BQU8sRUFBRSxPQUF1QztnQkFDaEQsYUFBYSxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQ3pFLE9BQXVDLENBQUM7Z0JBQzFDLHVDQUF1QztnQkFDdkMsU0FBUyxFQUFFLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUM7Z0JBQzVDLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO2FBQzlDLENBQUM7WUFFRixvRkFBb0Y7WUFDcEYscUZBQXFGO1lBQ3JGLFlBQVksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7WUFFNUMsa0VBQWtFO1lBQ2xFLFlBQVksQ0FBQyxVQUFVLEdBQUcsV0FBVyxDQUFDO1lBRXRDLHlEQUF5RDtZQUN6RCxNQUFNLFdBQVcsR0FBRyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ3pFLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUVwQixpQ0FBaUM7WUFDakMsT0FBTyxHQUFHLEVBQUU7Z0JBQ1YsbUVBQW1FO2dCQUNuRSwrRUFBK0U7Z0JBQy9FLG1FQUFtRTtnQkFDbkUsb0NBQW9DO2dCQUNwQyx1QkFBdUI7WUFDekIsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUMsQ0FDSixDQUFDO0lBQ0osQ0FBQztJQUVPLG1CQUFtQixDQUN6QixJQUFVLEVBQ1YsV0FBaUIsRUFDakIsVUFBNEIsRUFDNUIsSUFBOEIsRUFDOUIsT0FBcUM7UUFFckMsSUFBSSxHQUF5QixDQUFDO1FBRTlCLE1BQU0sWUFBWSxHQUFHLG9CQUFhLENBQUMsY0FBTyxDQUFDLElBQUksRUFBRSxnQkFBUyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0UsTUFBTSxRQUFRLEdBQUcsNEJBQVksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUU1QyxNQUFNLFNBQVMsR0FBRyw2Q0FBb0IsQ0FBQyxvQkFBYSxDQUFDLFdBQVcsQ0FBQyxFQUFFLFlBQVksQ0FBYyxDQUFDO1FBRTlGLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLFNBQVMsQ0FBQyxZQUFZLENBQUMsR0FBRztlQUN2RSxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sS0FBSyxTQUFTLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQztRQUU1RCxNQUFNLGFBQWEscUJBQ2QsT0FBMkM7WUFDOUMsc0VBQXNFO1lBQ3RFLFVBQVUsRUFBRSxFQUFFLEdBQ2YsQ0FBQztRQUVGLEdBQUcsR0FBRztZQUNKLElBQUksRUFBRSxvQkFBYSxDQUFDLElBQUksQ0FBQztZQUN6QixXQUFXLEVBQUUsb0JBQWEsQ0FBQyxXQUFXLENBQUM7WUFDdkMsVUFBVSxFQUFFLFVBQVUsSUFBSSxvQkFBYSxDQUFDLFVBQVUsQ0FBQztZQUNuRCxnRkFBZ0Y7WUFDaEYsWUFBWSxFQUFFLGFBQWE7WUFDM0IsUUFBUTtZQUNSLFlBQVk7WUFDWixhQUFhO1NBQ2QsQ0FBQztRQUVGLEdBQUcsQ0FBQyxZQUFZLENBQUMsUUFBUSxHQUFHLHVCQUFlLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUV2RSxNQUFNLGNBQWMsR0FBUztZQUMzQixpQ0FBZSxDQUFDLEdBQUcsQ0FBQztZQUNwQixpQ0FBZSxDQUFDLEdBQUcsQ0FBQztZQUNwQixxQ0FBbUIsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDO1lBQzlCLCtCQUFhLENBQUMsR0FBRyxDQUFDO1NBQ25CLENBQUM7UUFFRixPQUFPLFlBQVksQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUN0QyxDQUFDO0NBQ0Y7QUFuSEQsb0NBbUhDO0FBRUQsa0JBQWUsWUFBWSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZEV2ZW50LFxuICBCdWlsZGVyLFxuICBCdWlsZGVyQ29uZmlndXJhdGlvbixcbiAgQnVpbGRlckNvbnRleHQsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgUGF0aCwgZ2V0U3lzdGVtUGF0aCwgbm9ybWFsaXplLCByZXNvbHZlLCB2aXJ0dWFsRnMgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBvZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JzsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHtcbiAgZ2V0Q29tbW9uQ29uZmlnLFxuICBnZXROb25Bb3RUZXN0Q29uZmlnLFxuICBnZXRTdHlsZXNDb25maWcsXG4gIGdldFRlc3RDb25maWcsXG59IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL21vZGVscy93ZWJwYWNrLWNvbmZpZ3MnO1xuaW1wb3J0IHsgcmVhZFRzY29uZmlnIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3JlYWQtdHNjb25maWcnO1xuaW1wb3J0IHsgcmVxdWlyZVByb2plY3RNb2R1bGUgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcmVxdWlyZS1wcm9qZWN0LW1vZHVsZSc7XG5pbXBvcnQgeyBBc3NldFBhdHRlcm5PYmplY3QsIEN1cnJlbnRGaWxlUmVwbGFjZW1lbnQgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBkZWZhdWx0UHJvZ3Jlc3MsIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMsIG5vcm1hbGl6ZUZpbGVSZXBsYWNlbWVudHMgfSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgeyBLYXJtYUJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5jb25zdCB3ZWJwYWNrTWVyZ2UgPSByZXF1aXJlKCd3ZWJwYWNrLW1lcmdlJyk7XG5cblxuZXhwb3J0IGludGVyZmFjZSBOb3JtYWxpemVkS2FybWFCdWlsZGVyU2NoZW1hIGV4dGVuZHMgS2FybWFCdWlsZGVyU2NoZW1hIHtcbiAgYXNzZXRzOiBBc3NldFBhdHRlcm5PYmplY3RbXTtcbiAgZmlsZVJlcGxhY2VtZW50czogQ3VycmVudEZpbGVSZXBsYWNlbWVudFtdO1xufVxuXG5leHBvcnQgY2xhc3MgS2FybWFCdWlsZGVyIGltcGxlbWVudHMgQnVpbGRlcjxLYXJtYUJ1aWxkZXJTY2hlbWE+IHtcbiAgY29uc3RydWN0b3IocHVibGljIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KSB7IH1cblxuICBydW4oYnVpbGRlckNvbmZpZzogQnVpbGRlckNvbmZpZ3VyYXRpb248S2FybWFCdWlsZGVyU2NoZW1hPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnM7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdDtcbiAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5yb290KTtcbiAgICBjb25zdCBob3N0ID0gbmV3IHZpcnR1YWxGcy5BbGlhc0hvc3QodGhpcy5jb250ZXh0Lmhvc3QgYXMgdmlydHVhbEZzLkhvc3Q8ZnMuU3RhdHM+KTtcblxuICAgIHJldHVybiBvZihudWxsKS5waXBlKFxuICAgICAgY29uY2F0TWFwKCgpID0+IG5vcm1hbGl6ZUZpbGVSZXBsYWNlbWVudHMob3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzLCBob3N0LCByb290KSksXG4gICAgICB0YXAoZmlsZVJlcGxhY2VtZW50cyA9PiBvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMgPSBmaWxlUmVwbGFjZW1lbnRzKSxcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiBub3JtYWxpemVBc3NldFBhdHRlcm5zKFxuICAgICAgICBvcHRpb25zLmFzc2V0cywgaG9zdCwgcm9vdCwgcHJvamVjdFJvb3QsIGJ1aWxkZXJDb25maWcuc291cmNlUm9vdCkpLFxuICAgICAgLy8gUmVwbGFjZSB0aGUgYXNzZXRzIGluIG9wdGlvbnMgd2l0aCB0aGUgbm9ybWFsaXplZCB2ZXJzaW9uLlxuICAgICAgdGFwKChhc3NldFBhdHRlcm5PYmplY3RzID0+IG9wdGlvbnMuYXNzZXRzID0gYXNzZXRQYXR0ZXJuT2JqZWN0cykpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IG5ldyBPYnNlcnZhYmxlKG9icyA9PiB7XG4gICAgICAgIGNvbnN0IGthcm1hID0gcmVxdWlyZVByb2plY3RNb2R1bGUoZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksICdrYXJtYScpO1xuICAgICAgICBjb25zdCBrYXJtYUNvbmZpZyA9IGdldFN5c3RlbVBhdGgocmVzb2x2ZShyb290LCBub3JtYWxpemUob3B0aW9ucy5rYXJtYUNvbmZpZykpKTtcblxuICAgICAgICAvLyBUT0RPOiBhZGp1c3Qgb3B0aW9ucyB0byBhY2NvdW50IGZvciBub3QgcGFzc2luZyB0aGVtIGJsaW5kbHkgdG8ga2FybWEuXG4gICAgICAgIC8vIGNvbnN0IGthcm1hT3B0aW9uczogYW55ID0gT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucyk7XG4gICAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICAgICAgY29uc3Qga2FybWFPcHRpb25zOiBhbnkgPSB7fTtcblxuICAgICAgICBpZiAob3B0aW9ucy53YXRjaCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAga2FybWFPcHRpb25zLnNpbmdsZVJ1biA9ICFvcHRpb25zLndhdGNoO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ29udmVydCBicm93c2VycyBmcm9tIGEgc3RyaW5nIHRvIGFuIGFycmF5XG4gICAgICAgIGlmIChvcHRpb25zLmJyb3dzZXJzKSB7XG4gICAgICAgICAga2FybWFPcHRpb25zLmJyb3dzZXJzID0gb3B0aW9ucy5icm93c2Vycy5zcGxpdCgnLCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc291cmNlUm9vdCA9IGJ1aWxkZXJDb25maWcuc291cmNlUm9vdCAmJiByZXNvbHZlKHJvb3QsIGJ1aWxkZXJDb25maWcuc291cmNlUm9vdCk7XG5cbiAgICAgICAga2FybWFPcHRpb25zLmJ1aWxkV2VicGFjayA9IHtcbiAgICAgICAgICByb290OiBnZXRTeXN0ZW1QYXRoKHJvb3QpLFxuICAgICAgICAgIHByb2plY3RSb290OiBnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSxcbiAgICAgICAgICBvcHRpb25zOiBvcHRpb25zIGFzIE5vcm1hbGl6ZWRLYXJtYUJ1aWxkZXJTY2hlbWEsXG4gICAgICAgICAgd2VicGFja0NvbmZpZzogdGhpcy5fYnVpbGRXZWJwYWNrQ29uZmlnKHJvb3QsIHByb2plY3RSb290LCBzb3VyY2VSb290LCBob3N0LFxuICAgICAgICAgICAgb3B0aW9ucyBhcyBOb3JtYWxpemVkS2FybWFCdWlsZGVyU2NoZW1hKSxcbiAgICAgICAgICAvLyBQYXNzIG9udG8gS2FybWEgdG8gZW1pdCBCdWlsZEV2ZW50cy5cbiAgICAgICAgICBzdWNjZXNzQ2I6ICgpID0+IG9icy5uZXh0KHsgc3VjY2VzczogdHJ1ZSB9KSxcbiAgICAgICAgICBmYWlsdXJlQ2I6ICgpID0+IG9icy5uZXh0KHsgc3VjY2VzczogZmFsc2UgfSksXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gVE9ETzogaW5zaWRlIHRoZSBjb25maWdzLCBhbHdheXMgdXNlIHRoZSBwcm9qZWN0IHJvb3QgYW5kIG5vdCB0aGUgd29ya3NwYWNlIHJvb3QuXG4gICAgICAgIC8vIFVudGlsIHRoZW4gd2UgcHJldGVuZCB0aGUgYXBwIHJvb3QgaXMgcmVsYXRpdmUgKGBgKSBidXQgdGhlIHNhbWUgYXMgYHByb2plY3RSb290YC5cbiAgICAgICAga2FybWFPcHRpb25zLmJ1aWxkV2VicGFjay5vcHRpb25zLnJvb3QgPSAnJztcblxuICAgICAgICAvLyBBc3NpZ24gYWRkaXRpb25hbCBrYXJtYUNvbmZpZyBvcHRpb25zIHRvIHRoZSBsb2NhbCBuZ2FwcCBjb25maWdcbiAgICAgICAga2FybWFPcHRpb25zLmNvbmZpZ0ZpbGUgPSBrYXJtYUNvbmZpZztcblxuICAgICAgICAvLyBDb21wbGV0ZSB0aGUgb2JzZXJ2YWJsZSBvbmNlIHRoZSBLYXJtYSBzZXJ2ZXIgcmV0dXJucy5cbiAgICAgICAgY29uc3Qga2FybWFTZXJ2ZXIgPSBuZXcga2FybWEuU2VydmVyKGthcm1hT3B0aW9ucywgKCkgPT4gb2JzLmNvbXBsZXRlKCkpO1xuICAgICAgICBrYXJtYVNlcnZlci5zdGFydCgpO1xuXG4gICAgICAgIC8vIENsZWFudXAsIHNpZ25hbCBLYXJtYSB0byBleGl0LlxuICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgIC8vIEthcm1hIGRvZXMgbm90IHNlZW0gdG8gaGF2ZSBhIHdheSB0byBleGl0IHRoZSBzZXJ2ZXIgZ3JhY2VmdWxseS5cbiAgICAgICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2thcm1hLXJ1bm5lci9rYXJtYS9pc3N1ZXMvMjg2NyNpc3N1ZWNvbW1lbnQtMzY5OTEyMTY3XG4gICAgICAgICAgLy8gVE9ETzogbWFrZSBhIFBSIGZvciBrYXJtYSB0byBhZGQgYGthcm1hU2VydmVyLmNsb3NlKGNvZGUpYCwgdGhhdFxuICAgICAgICAgIC8vIGNhbGxzIGBkaXNjb25uZWN0QnJvd3NlcnMoY29kZSk7YFxuICAgICAgICAgIC8vIGthcm1hU2VydmVyLmNsb3NlKCk7XG4gICAgICAgIH07XG4gICAgICB9KSksXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkV2VicGFja0NvbmZpZyhcbiAgICByb290OiBQYXRoLFxuICAgIHByb2plY3RSb290OiBQYXRoLFxuICAgIHNvdXJjZVJvb3Q6IFBhdGggfCB1bmRlZmluZWQsXG4gICAgaG9zdDogdmlydHVhbEZzLkhvc3Q8ZnMuU3RhdHM+LFxuICAgIG9wdGlvbnM6IE5vcm1hbGl6ZWRLYXJtYUJ1aWxkZXJTY2hlbWEsXG4gICkge1xuICAgIGxldCB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zO1xuXG4gICAgY29uc3QgdHNDb25maWdQYXRoID0gZ2V0U3lzdGVtUGF0aChyZXNvbHZlKHJvb3QsIG5vcm1hbGl6ZShvcHRpb25zLnRzQ29uZmlnKSkpO1xuICAgIGNvbnN0IHRzQ29uZmlnID0gcmVhZFRzY29uZmlnKHRzQ29uZmlnUGF0aCk7XG5cbiAgICBjb25zdCBwcm9qZWN0VHMgPSByZXF1aXJlUHJvamVjdE1vZHVsZShnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSwgJ3R5cGVzY3JpcHQnKSBhcyB0eXBlb2YgdHM7XG5cbiAgICBjb25zdCBzdXBwb3J0RVMyMDE1ID0gdHNDb25maWcub3B0aW9ucy50YXJnZXQgIT09IHByb2plY3RUcy5TY3JpcHRUYXJnZXQuRVMzXG4gICAgICAmJiB0c0NvbmZpZy5vcHRpb25zLnRhcmdldCAhPT0gcHJvamVjdFRzLlNjcmlwdFRhcmdldC5FUzU7XG5cbiAgICBjb25zdCBjb21wYXRPcHRpb25zOiB0eXBlb2Ygd2NvWydidWlsZE9wdGlvbnMnXSA9IHtcbiAgICAgIC4uLm9wdGlvbnMgYXMge30gYXMgdHlwZW9mIHdjb1snYnVpbGRPcHRpb25zJ10sXG4gICAgICAvLyBTb21lIGFzc2V0IGxvZ2ljIGluc2lkZSBnZXRDb21tb25Db25maWcgbmVlZHMgb3V0cHV0UGF0aCB0byBiZSBzZXQuXG4gICAgICBvdXRwdXRQYXRoOiAnJyxcbiAgICB9O1xuXG4gICAgd2NvID0ge1xuICAgICAgcm9vdDogZ2V0U3lzdGVtUGF0aChyb290KSxcbiAgICAgIHByb2plY3RSb290OiBnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSxcbiAgICAgIHNvdXJjZVJvb3Q6IHNvdXJjZVJvb3QgJiYgZ2V0U3lzdGVtUGF0aChzb3VyY2VSb290KSxcbiAgICAgIC8vIFRPRE86IHVzZSBvbmx5IHRoaXMub3B0aW9ucywgaXQgY29udGFpbnMgYWxsIGZsYWdzIGFuZCBjb25maWdzIGl0ZW1zIGFscmVhZHkuXG4gICAgICBidWlsZE9wdGlvbnM6IGNvbXBhdE9wdGlvbnMsXG4gICAgICB0c0NvbmZpZyxcbiAgICAgIHRzQ29uZmlnUGF0aCxcbiAgICAgIHN1cHBvcnRFUzIwMTUsXG4gICAgfTtcblxuICAgIHdjby5idWlsZE9wdGlvbnMucHJvZ3Jlc3MgPSBkZWZhdWx0UHJvZ3Jlc3Mod2NvLmJ1aWxkT3B0aW9ucy5wcm9ncmVzcyk7XG5cbiAgICBjb25zdCB3ZWJwYWNrQ29uZmlnczoge31bXSA9IFtcbiAgICAgIGdldENvbW1vbkNvbmZpZyh3Y28pLFxuICAgICAgZ2V0U3R5bGVzQ29uZmlnKHdjbyksXG4gICAgICBnZXROb25Bb3RUZXN0Q29uZmlnKHdjbywgaG9zdCksXG4gICAgICBnZXRUZXN0Q29uZmlnKHdjbyksXG4gICAgXTtcblxuICAgIHJldHVybiB3ZWJwYWNrTWVyZ2Uod2VicGFja0NvbmZpZ3MpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEthcm1hQnVpbGRlcjtcbiJdfQ==