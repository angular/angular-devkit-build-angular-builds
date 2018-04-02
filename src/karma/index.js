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
const webpack_configs_1 = require("../angular-cli-files/models/webpack-configs");
const read_tsconfig_1 = require("../angular-cli-files/utilities/read-tsconfig");
const require_project_module_1 = require("../angular-cli-files/utilities/require-project-module");
const webpackMerge = require('webpack-merge');
class KarmaBuilder {
    constructor(context) {
        this.context = context;
    }
    run(builderConfig) {
        // const root = getSystemPath(builderConfig.root);
        const options = builderConfig.options;
        const root = this.context.workspace.root;
        const projectRoot = core_1.resolve(root, builderConfig.root);
        return new rxjs_1.Observable(obs => {
            const karma = require_project_module_1.requireProjectModule(core_1.getSystemPath(projectRoot), 'karma');
            const karmaConfig = core_1.getSystemPath(core_1.resolve(root, core_1.normalize(options.karmaConfig)));
            // TODO: adjust options to account for not passing them blindly to karma.
            // const karmaOptions: any = Object.assign({}, options);
            // tslint:disable-next-line:no-any
            const karmaOptions = {
                singleRun: !options.watch,
            };
            // Convert browsers from a string to an array
            if (options.browsers) {
                karmaOptions.browsers = options.browsers.split(',');
            }
            karmaOptions.buildWebpack = {
                root: core_1.getSystemPath(root),
                projectRoot: core_1.getSystemPath(projectRoot),
                options: options,
                webpackConfig: this._buildWebpackConfig(root, projectRoot, options),
                // Pass onto Karma to emit BuildEvents.
                successCb: () => obs.next({ success: true }),
                failureCb: () => obs.next({ success: false }),
            };
            // TODO: inside the configs, always use the project root and not the workspace root.
            // Until then we pretend the app root is relative (``) but the same as `projectRoot`.
            karmaOptions.buildWebpack.options.root = ''; // tslint:disable-line:no-any
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
        });
    }
    _buildWebpackConfig(root, projectRoot, options) {
        let wco;
        const host = new core_1.virtualFs.AliasHost(this.context.host);
        options.fileReplacements.forEach(({ src, replaceWith }) => {
            host.aliases.set(core_1.join(root, core_1.normalize(src)), core_1.join(root, core_1.normalize(replaceWith)));
        });
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
            // TODO: use only this.options, it contains all flags and configs items already.
            buildOptions: compatOptions,
            tsConfig,
            tsConfigPath,
            supportES2015,
        };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2thcm1hL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7O0FBUUgsK0NBQWlHO0FBRWpHLCtCQUFrQztBQUdsQyxpRkFLcUQ7QUFDckQsZ0ZBQTRFO0FBQzVFLGtHQUE2RjtBQUs3RixNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFzQzlDO0lBQ0UsWUFBbUIsT0FBdUI7UUFBdkIsWUFBTyxHQUFQLE9BQU8sQ0FBZ0I7SUFBSSxDQUFDO0lBRS9DLEdBQUcsQ0FBQyxhQUF3RDtRQUUxRCxrREFBa0Q7UUFDbEQsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQztRQUN0QyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDekMsTUFBTSxXQUFXLEdBQUcsY0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdEQsTUFBTSxDQUFDLElBQUksaUJBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUMxQixNQUFNLEtBQUssR0FBRyw2Q0FBb0IsQ0FBQyxvQkFBYSxDQUFDLFdBQVcsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3hFLE1BQU0sV0FBVyxHQUFHLG9CQUFhLENBQUMsY0FBTyxDQUFDLElBQUksRUFBRSxnQkFBUyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFakYseUVBQXlFO1lBQ3pFLHdEQUF3RDtZQUN4RCxrQ0FBa0M7WUFDbEMsTUFBTSxZQUFZLEdBQVE7Z0JBQ3hCLFNBQVMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLO2FBQzFCLENBQUM7WUFFRiw2Q0FBNkM7WUFDN0MsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JCLFlBQVksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDdEQsQ0FBQztZQUVELFlBQVksQ0FBQyxZQUFZLEdBQUc7Z0JBQzFCLElBQUksRUFBRSxvQkFBYSxDQUFDLElBQUksQ0FBQztnQkFDekIsV0FBVyxFQUFFLG9CQUFhLENBQUMsV0FBVyxDQUFDO2dCQUN2QyxPQUFPLEVBQUUsT0FBTztnQkFDaEIsYUFBYSxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLE9BQU8sQ0FBQztnQkFDbkUsdUNBQXVDO2dCQUN2QyxTQUFTLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQztnQkFDNUMsU0FBUyxFQUFFLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUM7YUFDOUMsQ0FBQztZQUVGLG9GQUFvRjtZQUNwRixxRkFBcUY7WUFDcEYsWUFBWSxDQUFDLFlBQVksQ0FBQyxPQUFlLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDLDZCQUE2QjtZQUVuRixrRUFBa0U7WUFDbEUsWUFBWSxDQUFDLFVBQVUsR0FBRyxXQUFXLENBQUM7WUFFdEMseURBQXlEO1lBQ3pELE1BQU0sV0FBVyxHQUFHLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDekUsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBRXBCLGlDQUFpQztZQUNqQyxNQUFNLENBQUMsR0FBRyxFQUFFO2dCQUNWLG1FQUFtRTtnQkFDbkUsK0VBQStFO2dCQUMvRSxtRUFBbUU7Z0JBQ25FLG9DQUFvQztnQkFDcEMsdUJBQXVCO1lBQ3pCLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLG1CQUFtQixDQUFDLElBQVUsRUFBRSxXQUFpQixFQUFFLE9BQTRCO1FBQ3JGLElBQUksR0FBeUIsQ0FBQztRQUU5QixNQUFNLElBQUksR0FBRyxJQUFJLGdCQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBZ0MsQ0FBQyxDQUFDO1FBRXBGLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFFO1lBQ3hELElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUNkLFdBQUksQ0FBQyxJQUFJLEVBQUUsZ0JBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUMxQixXQUFJLENBQUMsSUFBSSxFQUFFLGdCQUFTLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FDbkMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxZQUFZLEdBQUcsb0JBQWEsQ0FBQyxjQUFPLENBQUMsSUFBSSxFQUFFLGdCQUFTLENBQUMsT0FBTyxDQUFDLFFBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekYsTUFBTSxRQUFRLEdBQUcsNEJBQVksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUU1QyxNQUFNLFNBQVMsR0FBRyw2Q0FBb0IsQ0FBQyxvQkFBYSxDQUFDLFdBQVcsQ0FBQyxFQUFFLFlBQVksQ0FBYyxDQUFDO1FBRTlGLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLFNBQVMsQ0FBQyxZQUFZLENBQUMsR0FBRztlQUN2RSxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sS0FBSyxTQUFTLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQztRQUU1RCxNQUFNLGFBQWEscUJBQ2QsT0FBMkM7WUFDOUMsc0VBQXNFO1lBQ3RFLFVBQVUsRUFBRSxFQUFFLEdBQ2YsQ0FBQztRQUVGLEdBQUcsR0FBRztZQUNKLElBQUksRUFBRSxvQkFBYSxDQUFDLElBQUksQ0FBQztZQUN6QixXQUFXLEVBQUUsb0JBQWEsQ0FBQyxXQUFXLENBQUM7WUFDdkMsZ0ZBQWdGO1lBQ2hGLFlBQVksRUFBRSxhQUFhO1lBQzNCLFFBQVE7WUFDUixZQUFZO1lBQ1osYUFBYTtTQUNkLENBQUM7UUFFRixNQUFNLGNBQWMsR0FBUztZQUMzQixpQ0FBZSxDQUFDLEdBQUcsQ0FBQztZQUNwQixpQ0FBZSxDQUFDLEdBQUcsQ0FBQztZQUNwQixxQ0FBbUIsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDO1lBQzlCLCtCQUFhLENBQUMsR0FBRyxDQUFDO1NBQ25CLENBQUM7UUFFRixNQUFNLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ3RDLENBQUM7Q0FDRjtBQXZHRCxvQ0F1R0M7QUFFRCxrQkFBZSxZQUFZLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnQsXG4gIEJ1aWxkZXIsXG4gIEJ1aWxkZXJDb25maWd1cmF0aW9uLFxuICBCdWlsZGVyQ29udGV4dCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBQYXRoLCBnZXRTeXN0ZW1QYXRoLCBqb2luLCAgbm9ybWFsaXplLCByZXNvbHZlLCB2aXJ0dWFsRnMgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JzsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHtcbiAgZ2V0Q29tbW9uQ29uZmlnLFxuICBnZXROb25Bb3RUZXN0Q29uZmlnLFxuICBnZXRTdHlsZXNDb25maWcsXG4gIGdldFRlc3RDb25maWcsXG59IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL21vZGVscy93ZWJwYWNrLWNvbmZpZ3MnO1xuaW1wb3J0IHsgcmVhZFRzY29uZmlnIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3JlYWQtdHNjb25maWcnO1xuaW1wb3J0IHsgcmVxdWlyZVByb2plY3RNb2R1bGUgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcmVxdWlyZS1wcm9qZWN0LW1vZHVsZSc7XG5pbXBvcnQge1xuICBBc3NldFBhdHRlcm4sXG4gIEV4dHJhRW50cnlQb2ludCxcbn0gZnJvbSAnLi4vYnJvd3Nlcic7XG5jb25zdCB3ZWJwYWNrTWVyZ2UgPSByZXF1aXJlKCd3ZWJwYWNrLW1lcmdlJyk7XG5cblxuZXhwb3J0IGludGVyZmFjZSBLYXJtYUJ1aWxkZXJPcHRpb25zIHtcbiAgbWFpbjogc3RyaW5nO1xuICB0c0NvbmZpZzogc3RyaW5nOyAvLyBwcmV2aW91c2x5ICd0c2NvbmZpZycuXG4gIGthcm1hQ29uZmlnOiBzdHJpbmc7IC8vIHByZXZpb3VzbHkgJ2NvbmZpZycuXG4gIHdhdGNoOiBib29sZWFuO1xuICBjb2RlQ292ZXJhZ2U6IGJvb2xlYW47XG4gIGNvZGVDb3ZlcmFnZUV4Y2x1ZGU6IHN0cmluZ1tdO1xuICBwcm9ncmVzczogYm9vbGVhbjtcbiAgcHJlc2VydmVTeW1saW5rcz86IGJvb2xlYW47XG5cbiAgLy8gT3B0aW9ucyB3aXRoIG5vIGRlZmF1bHRzLlxuICBwb2x5ZmlsbHM/OiBzdHJpbmc7XG4gIHBvbGw/OiBudW1iZXI7XG4gIHBvcnQ/OiBudW1iZXI7XG4gIGJyb3dzZXJzPzogc3RyaW5nO1xuXG4gIC8vIEEgY291cGxlIG9mIG9wdGlvbnMgaGF2ZSBkaWZmZXJlbnQgbmFtZXMuXG4gIHNvdXJjZU1hcDogYm9vbGVhbjsgLy8gcHJldmlvdXNseSAnc291cmNlbWFwcycuXG5cbiAgLy8gVGhlc2Ugb3B0aW9ucyB3ZXJlIG5vdCBhdmFpbGFibGUgYXMgZmxhZ3MuXG4gIGFzc2V0czogQXNzZXRQYXR0ZXJuW107XG4gIHNjcmlwdHM6IEV4dHJhRW50cnlQb2ludFtdO1xuICBzdHlsZXM6IEV4dHJhRW50cnlQb2ludFtdO1xuICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM6IHsgaW5jbHVkZVBhdGhzOiBzdHJpbmdbXSB9O1xuXG4gIC8vIFNvbWUgb3B0aW9ucyBhcmUgbm90IG5lZWRlZCBhbnltb3JlLlxuICAvLyBhcHA/OiBzdHJpbmc7IC8vIGFwcHMgYXJlbid0IHVzZWQgd2l0aCBidWlsZCBmYWNhZGVcbiAgLy8gc2luZ2xlUnVuPzogYm9vbGVhbjsgLy8gc2FtZSBhcyB3YXRjaFxuICAvLyBjb2xvcnM6IGJvb2xlYW47IC8vIHdlIGp1c3QgcGFzc2VkIGl0IHRvIHRoZSBrYXJtYSBjb25maWdcbiAgLy8gbG9nTGV2ZWw/OiBzdHJpbmc7IC8vIHNhbWUgYXMgYWJvdmVcbiAgLy8gcmVwb3J0ZXJzPzogc3RyaW5nOyAvLyBzYW1lIGFzIGFib3ZlXG5cbiAgZmlsZVJlcGxhY2VtZW50czogeyBzcmM6IHN0cmluZzsgcmVwbGFjZVdpdGg6IHN0cmluZzsgfVtdO1xufVxuXG5leHBvcnQgY2xhc3MgS2FybWFCdWlsZGVyIGltcGxlbWVudHMgQnVpbGRlcjxLYXJtYUJ1aWxkZXJPcHRpb25zPiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkgeyB9XG5cbiAgcnVuKGJ1aWxkZXJDb25maWc6IEJ1aWxkZXJDb25maWd1cmF0aW9uPEthcm1hQnVpbGRlck9wdGlvbnM+KTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG5cbiAgICAvLyBjb25zdCByb290ID0gZ2V0U3lzdGVtUGF0aChidWlsZGVyQ29uZmlnLnJvb3QpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnM7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdDtcbiAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5yb290KTtcblxuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZShvYnMgPT4ge1xuICAgICAgY29uc3Qga2FybWEgPSByZXF1aXJlUHJvamVjdE1vZHVsZShnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSwgJ2thcm1hJyk7XG4gICAgICBjb25zdCBrYXJtYUNvbmZpZyA9IGdldFN5c3RlbVBhdGgocmVzb2x2ZShyb290LCBub3JtYWxpemUob3B0aW9ucy5rYXJtYUNvbmZpZykpKTtcblxuICAgICAgLy8gVE9ETzogYWRqdXN0IG9wdGlvbnMgdG8gYWNjb3VudCBmb3Igbm90IHBhc3NpbmcgdGhlbSBibGluZGx5IHRvIGthcm1hLlxuICAgICAgLy8gY29uc3Qga2FybWFPcHRpb25zOiBhbnkgPSBPYmplY3QuYXNzaWduKHt9LCBvcHRpb25zKTtcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICAgIGNvbnN0IGthcm1hT3B0aW9uczogYW55ID0ge1xuICAgICAgICBzaW5nbGVSdW46ICFvcHRpb25zLndhdGNoLFxuICAgICAgfTtcblxuICAgICAgLy8gQ29udmVydCBicm93c2VycyBmcm9tIGEgc3RyaW5nIHRvIGFuIGFycmF5XG4gICAgICBpZiAob3B0aW9ucy5icm93c2Vycykge1xuICAgICAgICBrYXJtYU9wdGlvbnMuYnJvd3NlcnMgPSBvcHRpb25zLmJyb3dzZXJzLnNwbGl0KCcsJyk7XG4gICAgICB9XG5cbiAgICAgIGthcm1hT3B0aW9ucy5idWlsZFdlYnBhY2sgPSB7XG4gICAgICAgIHJvb3Q6IGdldFN5c3RlbVBhdGgocm9vdCksXG4gICAgICAgIHByb2plY3RSb290OiBnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSxcbiAgICAgICAgb3B0aW9uczogb3B0aW9ucyxcbiAgICAgICAgd2VicGFja0NvbmZpZzogdGhpcy5fYnVpbGRXZWJwYWNrQ29uZmlnKHJvb3QsIHByb2plY3RSb290LCBvcHRpb25zKSxcbiAgICAgICAgLy8gUGFzcyBvbnRvIEthcm1hIHRvIGVtaXQgQnVpbGRFdmVudHMuXG4gICAgICAgIHN1Y2Nlc3NDYjogKCkgPT4gb2JzLm5leHQoeyBzdWNjZXNzOiB0cnVlIH0pLFxuICAgICAgICBmYWlsdXJlQ2I6ICgpID0+IG9icy5uZXh0KHsgc3VjY2VzczogZmFsc2UgfSksXG4gICAgICB9O1xuXG4gICAgICAvLyBUT0RPOiBpbnNpZGUgdGhlIGNvbmZpZ3MsIGFsd2F5cyB1c2UgdGhlIHByb2plY3Qgcm9vdCBhbmQgbm90IHRoZSB3b3Jrc3BhY2Ugcm9vdC5cbiAgICAgIC8vIFVudGlsIHRoZW4gd2UgcHJldGVuZCB0aGUgYXBwIHJvb3QgaXMgcmVsYXRpdmUgKGBgKSBidXQgdGhlIHNhbWUgYXMgYHByb2plY3RSb290YC5cbiAgICAgIChrYXJtYU9wdGlvbnMuYnVpbGRXZWJwYWNrLm9wdGlvbnMgYXMgYW55KS5yb290ID0gJyc7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8tYW55XG5cbiAgICAgIC8vIEFzc2lnbiBhZGRpdGlvbmFsIGthcm1hQ29uZmlnIG9wdGlvbnMgdG8gdGhlIGxvY2FsIG5nYXBwIGNvbmZpZ1xuICAgICAga2FybWFPcHRpb25zLmNvbmZpZ0ZpbGUgPSBrYXJtYUNvbmZpZztcblxuICAgICAgLy8gQ29tcGxldGUgdGhlIG9ic2VydmFibGUgb25jZSB0aGUgS2FybWEgc2VydmVyIHJldHVybnMuXG4gICAgICBjb25zdCBrYXJtYVNlcnZlciA9IG5ldyBrYXJtYS5TZXJ2ZXIoa2FybWFPcHRpb25zLCAoKSA9PiBvYnMuY29tcGxldGUoKSk7XG4gICAgICBrYXJtYVNlcnZlci5zdGFydCgpO1xuXG4gICAgICAvLyBDbGVhbnVwLCBzaWduYWwgS2FybWEgdG8gZXhpdC5cbiAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgIC8vIEthcm1hIGRvZXMgbm90IHNlZW0gdG8gaGF2ZSBhIHdheSB0byBleGl0IHRoZSBzZXJ2ZXIgZ3JhY2VmdWxseS5cbiAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9rYXJtYS1ydW5uZXIva2FybWEvaXNzdWVzLzI4NjcjaXNzdWVjb21tZW50LTM2OTkxMjE2N1xuICAgICAgICAvLyBUT0RPOiBtYWtlIGEgUFIgZm9yIGthcm1hIHRvIGFkZCBga2FybWFTZXJ2ZXIuY2xvc2UoY29kZSlgLCB0aGF0XG4gICAgICAgIC8vIGNhbGxzIGBkaXNjb25uZWN0QnJvd3NlcnMoY29kZSk7YFxuICAgICAgICAvLyBrYXJtYVNlcnZlci5jbG9zZSgpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkV2VicGFja0NvbmZpZyhyb290OiBQYXRoLCBwcm9qZWN0Um9vdDogUGF0aCwgb3B0aW9uczogS2FybWFCdWlsZGVyT3B0aW9ucykge1xuICAgIGxldCB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zO1xuXG4gICAgY29uc3QgaG9zdCA9IG5ldyB2aXJ0dWFsRnMuQWxpYXNIb3N0KHRoaXMuY29udGV4dC5ob3N0IGFzIHZpcnR1YWxGcy5Ib3N0PGZzLlN0YXRzPik7XG5cbiAgICBvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMuZm9yRWFjaCgoeyBzcmMsIHJlcGxhY2VXaXRoIH0pID0+IHtcbiAgICAgIGhvc3QuYWxpYXNlcy5zZXQoXG4gICAgICAgIGpvaW4ocm9vdCwgbm9ybWFsaXplKHNyYykpLFxuICAgICAgICBqb2luKHJvb3QsIG5vcm1hbGl6ZShyZXBsYWNlV2l0aCkpLFxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHRzQ29uZmlnUGF0aCA9IGdldFN5c3RlbVBhdGgocmVzb2x2ZShyb290LCBub3JtYWxpemUob3B0aW9ucy50c0NvbmZpZyBhcyBzdHJpbmcpKSk7XG4gICAgY29uc3QgdHNDb25maWcgPSByZWFkVHNjb25maWcodHNDb25maWdQYXRoKTtcblxuICAgIGNvbnN0IHByb2plY3RUcyA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLCAndHlwZXNjcmlwdCcpIGFzIHR5cGVvZiB0cztcblxuICAgIGNvbnN0IHN1cHBvcnRFUzIwMTUgPSB0c0NvbmZpZy5vcHRpb25zLnRhcmdldCAhPT0gcHJvamVjdFRzLlNjcmlwdFRhcmdldC5FUzNcbiAgICAgICYmIHRzQ29uZmlnLm9wdGlvbnMudGFyZ2V0ICE9PSBwcm9qZWN0VHMuU2NyaXB0VGFyZ2V0LkVTNTtcblxuICAgIGNvbnN0IGNvbXBhdE9wdGlvbnM6IHR5cGVvZiB3Y29bJ2J1aWxkT3B0aW9ucyddID0ge1xuICAgICAgLi4ub3B0aW9ucyBhcyB7fSBhcyB0eXBlb2Ygd2NvWydidWlsZE9wdGlvbnMnXSxcbiAgICAgIC8vIFNvbWUgYXNzZXQgbG9naWMgaW5zaWRlIGdldENvbW1vbkNvbmZpZyBuZWVkcyBvdXRwdXRQYXRoIHRvIGJlIHNldC5cbiAgICAgIG91dHB1dFBhdGg6ICcnLFxuICAgIH07XG5cbiAgICB3Y28gPSB7XG4gICAgICByb290OiBnZXRTeXN0ZW1QYXRoKHJvb3QpLFxuICAgICAgcHJvamVjdFJvb3Q6IGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLFxuICAgICAgLy8gVE9ETzogdXNlIG9ubHkgdGhpcy5vcHRpb25zLCBpdCBjb250YWlucyBhbGwgZmxhZ3MgYW5kIGNvbmZpZ3MgaXRlbXMgYWxyZWFkeS5cbiAgICAgIGJ1aWxkT3B0aW9uczogY29tcGF0T3B0aW9ucyxcbiAgICAgIHRzQ29uZmlnLFxuICAgICAgdHNDb25maWdQYXRoLFxuICAgICAgc3VwcG9ydEVTMjAxNSxcbiAgICB9O1xuXG4gICAgY29uc3Qgd2VicGFja0NvbmZpZ3M6IHt9W10gPSBbXG4gICAgICBnZXRDb21tb25Db25maWcod2NvKSxcbiAgICAgIGdldFN0eWxlc0NvbmZpZyh3Y28pLFxuICAgICAgZ2V0Tm9uQW90VGVzdENvbmZpZyh3Y28sIGhvc3QpLFxuICAgICAgZ2V0VGVzdENvbmZpZyh3Y28pLFxuICAgIF07XG5cbiAgICByZXR1cm4gd2VicGFja01lcmdlKHdlYnBhY2tDb25maWdzKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBLYXJtYUJ1aWxkZXI7XG4iXX0=