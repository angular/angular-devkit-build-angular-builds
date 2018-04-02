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
        // tslint:disable-next-line:no-any
        let wco;
        const host = new core_1.virtualFs.AliasHost(this.context.host);
        options.fileReplacements.forEach(({ src, replaceWith }) => {
            host.aliases.set(core_1.join(root, core_1.normalize(src)), core_1.join(root, core_1.normalize(replaceWith)));
        });
        const tsconfigPath = core_1.getSystemPath(core_1.resolve(root, core_1.normalize(options.tsConfig)));
        const tsConfig = read_tsconfig_1.readTsconfig(tsconfigPath);
        const projectTs = require_project_module_1.requireProjectModule(core_1.getSystemPath(projectRoot), 'typescript');
        const supportES2015 = tsConfig.options.target !== projectTs.ScriptTarget.ES3
            && tsConfig.options.target !== projectTs.ScriptTarget.ES5;
        const compatOptions = Object.assign({}, options, { 
            // TODO: inside the configs, always use the project root and not the workspace root.
            // Until then we have to pretend the app root is relative (``) but the same as `projectRoot`.
            root: '', 
            // Some asset logic inside getCommonConfig needs outputPath to be set.
            outputPath: '' });
        wco = {
            root: core_1.getSystemPath(root),
            projectRoot: core_1.getSystemPath(projectRoot),
            // TODO: use only this.options, it contains all flags and configs items already.
            buildOptions: compatOptions,
            appConfig: compatOptions,
            tsConfig,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2thcm1hL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7O0FBUUgsK0NBQWlHO0FBRWpHLCtCQUFrQztBQUVsQyxpRkFLcUQ7QUFDckQsZ0ZBQTRFO0FBQzVFLGtHQUE2RjtBQUs3RixNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFzQzlDO0lBQ0UsWUFBbUIsT0FBdUI7UUFBdkIsWUFBTyxHQUFQLE9BQU8sQ0FBZ0I7SUFBSSxDQUFDO0lBRS9DLEdBQUcsQ0FBQyxhQUF3RDtRQUUxRCxrREFBa0Q7UUFDbEQsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQztRQUN0QyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDekMsTUFBTSxXQUFXLEdBQUcsY0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdEQsTUFBTSxDQUFDLElBQUksaUJBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUMxQixNQUFNLEtBQUssR0FBRyw2Q0FBb0IsQ0FBQyxvQkFBYSxDQUFDLFdBQVcsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3hFLE1BQU0sV0FBVyxHQUFHLG9CQUFhLENBQUMsY0FBTyxDQUFDLElBQUksRUFBRSxnQkFBUyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFakYseUVBQXlFO1lBQ3pFLHdEQUF3RDtZQUN4RCxrQ0FBa0M7WUFDbEMsTUFBTSxZQUFZLEdBQVE7Z0JBQ3hCLFNBQVMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLO2FBQzFCLENBQUM7WUFFRiw2Q0FBNkM7WUFDN0MsRUFBRSxDQUFDLENBQUMsT0FBTyxD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QUNmLENBQUM7UUFFRixHQUFHLEdBQUc7WUFDSixJQUFJLEVBQUUsb0JBQWEsQ0FBQyxJQUFJLENBQUM7WUFDekIsV0FBVyxFQUFFLG9CQUFhLENBQUMsV0FBVyxDQUFDO1lBQ3ZDLGdGQUFnRjtZQUNoRixZQUFZLEVBQUUsYUFBYTtZQUMzQixTQUFTLEVBQUUsYUFBYTtZQUN4QixRQUFRO1lBQ1IsYUFBYTtTQUNkLENBQUM7UUFFRixNQUFNLGNBQWMsR0FBUztZQUMzQixpQ0FBZSxDQUFDLEdBQUcsQ0FBQztZQUNwQixpQ0FBZSxDQUFDLEdBQUcsQ0FBQztZQUNwQixxQ0FBbUIsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDO1lBQzlCLCtCQUFhLENBQUMsR0FBRyxDQUFDO1NBQ25CLENBQUM7UUFFRixNQUFNLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ3RDLENBQUM7Q0FDRjtBQTNHRCxvQ0EyR0M7QUFFRCxrQkFBZSxZQUFZLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnQsXG4gIEJ1aWxkZXIsXG4gIEJ1aWxkZXJDb25maWd1cmF0aW9uLFxuICBCdWlsZGVyQ29udGV4dCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBQYXRoLCBnZXRTeXN0ZW1QYXRoLCBqb2luLCAgbm9ybWFsaXplLCByZXNvbHZlLCB2aXJ0dWFsRnMgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JzsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcbmltcG9ydCB7XG4gIGdldENvbW1vbkNvbmZpZyxcbiAgZ2V0Tm9uQW90VGVzdENvbmZpZyxcbiAgZ2V0U3R5bGVzQ29uZmlnLFxuICBnZXRUZXN0Q29uZmlnLFxufSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzJztcbmltcG9ydCB7IHJlYWRUc2NvbmZpZyB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9yZWFkLXRzY29uZmlnJztcbmltcG9ydCB7IHJlcXVpcmVQcm9qZWN0TW9kdWxlIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3JlcXVpcmUtcHJvamVjdC1tb2R1bGUnO1xuaW1wb3J0IHtcbiAgQXNzZXRQYXR0ZXJuLFxuICBFeHRyYUVudHJ5UG9pbnQsXG59IGZyb20gJy4uL2Jyb3dzZXInO1xuY29uc3Qgd2VicGFja01lcmdlID0gcmVxdWlyZSgnd2VicGFjay1tZXJnZScpO1xuXG5cbmV4cG9ydCBpbnRlcmZhY2UgS2FybWFCdWlsZGVyT3B0aW9ucyB7XG4gIG1haW46IHN0cmluZztcbiAgdHNDb25maWc6IHN0cmluZzsgLy8gcHJldmlvdXNseSAndHNjb25maWcnLlxuICBrYXJtYUNvbmZpZzogc3RyaW5nOyAvLyBwcmV2aW91c2x5ICdjb25maWcnLlxuICB3YXRjaDogYm9vbGVhbjtcbiAgY29kZUNvdmVyYWdlOiBib29sZWFuO1xuICBjb2RlQ292ZXJhZ2VFeGNsdWRlOiBzdHJpbmdbXTtcbiAgcHJvZ3Jlc3M6IGJvb2xlYW47XG4gIHByZXNlcnZlU3ltbGlua3M/OiBib29sZWFuO1xuXG4gIC8vIE9wdGlvbnMgd2l0aCBubyBkZWZhdWx0cy5cbiAgcG9seWZpbGxzPzogc3RyaW5nO1xuICBwb2xsPzogbnVtYmVyO1xuICBwb3J0PzogbnVtYmVyO1xuICBicm93c2Vycz86IHN0cmluZztcblxuICAvLyBBIGNvdXBsZSBvZiBvcHRpb25zIGhhdmUgZGlmZmVyZW50IG5hbWVzLlxuICBzb3VyY2VNYXA6IGJvb2xlYW47IC8vIHByZXZpb3VzbHkgJ3NvdXJjZW1hcHMnLlxuXG4gIC8vIFRoZXNlIG9wdGlvbnMgd2VyZSBub3QgYXZhaWxhYmxlIGFzIGZsYWdzLlxuICBhc3NldHM6IEFzc2V0UGF0dGVybltdO1xuICBzY3JpcHRzOiBFeHRyYUVudHJ5UG9pbnRbXTtcbiAgc3R5bGVzOiBFeHRyYUVudHJ5UG9pbnRbXTtcbiAgc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zOiB7IGluY2x1ZGVQYXRoczogc3RyaW5nW10gfTtcblxuICAvLyBTb21lIG9wdGlvbnMgYXJlIG5vdCBuZWVkZWQgYW55bW9yZS5cbiAgLy8gYXBwPzogc3RyaW5nOyAvLyBhcHBzIGFyZW4ndCB1c2VkIHdpdGggYnVpbGQgZmFjYWRlXG4gIC8vIHNpbmdsZVJ1bj86IGJvb2xlYW47IC8vIHNhbWUgYXMgd2F0Y2hcbiAgLy8gY29sb3JzOiBib29sZWFuOyAvLyB3ZSBqdXN0IHBhc3NlZCBpdCB0byB0aGUga2FybWEgY29uZmlnXG4gIC8vIGxvZ0xldmVsPzogc3RyaW5nOyAvLyBzYW1lIGFzIGFib3ZlXG4gIC8vIHJlcG9ydGVycz86IHN0cmluZzsgLy8gc2FtZSBhcyBhYm92ZVxuXG4gIGZpbGVSZXBsYWNlbWVudHM6IHsgc3JjOiBzdHJpbmc7IHJlcGxhY2VXaXRoOiBzdHJpbmc7IH1bXTtcbn1cblxuZXhwb3J0IGNsYXNzIEthcm1hQnVpbGRlciBpbXBsZW1lbnRzIEJ1aWxkZXI8S2FybWFCdWlsZGVyT3B0aW9ucz4ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHsgfVxuXG4gIHJ1bihidWlsZGVyQ29uZmlnOiBCdWlsZGVyQ29uZmlndXJhdGlvbjxLYXJtYUJ1aWxkZXJPcHRpb25zPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuXG4gICAgLy8gY29uc3Qgcm9vdCA9IGdldFN5c3RlbVBhdGgoYnVpbGRlckNvbmZpZy5yb290KTtcbiAgICBjb25zdCBvcHRpb25zID0gYnVpbGRlckNvbmZpZy5vcHRpb25zO1xuICAgIGNvbnN0IHJvb3QgPSB0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3Q7XG4gICAgY29uc3QgcHJvamVjdFJvb3QgPSByZXNvbHZlKHJvb3QsIGJ1aWxkZXJDb25maWcucm9vdCk7XG5cbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUob2JzID0+IHtcbiAgICAgIGNvbnN0IGthcm1hID0gcmVxdWlyZVByb2plY3RNb2R1bGUoZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksICdrYXJtYScpO1xuICAgICAgY29uc3Qga2FybWFDb25maWcgPSBnZXRTeXN0ZW1QYXRoKHJlc29sdmUocm9vdCwgbm9ybWFsaXplKG9wdGlvbnMua2FybWFDb25maWcpKSk7XG5cbiAgICAgIC8vIFRPRE86IGFkanVzdCBvcHRpb25zIHRvIGFjY291bnQgZm9yIG5vdCBwYXNzaW5nIHRoZW0gYmxpbmRseSB0byBrYXJtYS5cbiAgICAgIC8vIGNvbnN0IGthcm1hT3B0aW9uczogYW55ID0gT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucyk7XG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgICBjb25zdCBrYXJtYU9wdGlvbnM6IGFueSA9IHtcbiAgICAgICAgc2luZ2xlUnVuOiAhb3B0aW9ucy53YXRjaCxcbiAgICAgIH07XG5cbiAgICAgIC8vIENvbnZlcnQgYnJvd3NlcnMgZnJvbSBhIHN0cmluZyB0byBhbiBhcnJheVxuICAgICAgaWYgKG9wdGlvbnMuYnJvd3NlcnMpIHtcbiAgICAgICAga2FybWFPcHRpb25zLmJyb3dzZXJzID0gb3B0aW9ucy5icm93c2Vycy5zcGxpdCgnLCcpO1xuICAgICAgfVxuXG4gICAgICBrYXJtYU9wdGlvbnMuYnVpbGRXZWJwYWNrID0ge1xuICAgICAgICByb290OiBnZXRTeXN0ZW1QYXRoKHJvb3QpLFxuICAgICAgICBwcm9qZWN0Um9vdDogZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksXG4gICAgICAgIG9wdGlvbnM6IG9wdGlvbnMsXG4gICAgICAgIHdlYnBhY2tDb25maWc6IHRoaXMuX2J1aWxkV2VicGFja0NvbmZpZyhyb290LCBwcm9qZWN0Um9vdCwgb3B0aW9ucyksXG4gICAgICAgIC8vIFBhc3Mgb250byBLYXJtYSB0byBlbWl0IEJ1aWxkRXZlbnRzLlxuICAgICAgICBzdWNjZXNzQ2I6ICgpID0+IG9icy5uZXh0KHsgc3VjY2VzczogdHJ1ZSB9KSxcbiAgICAgICAgZmFpbHVyZUNiOiAoKSA9PiBvYnMubmV4dCh7IHN1Y2Nlc3M6IGZhbHNlIH0pLFxuICAgICAgfTtcblxuICAgICAgLy8gVE9ETzogaW5zaWRlIHRoZSBjb25maWdzLCBhbHdheXMgdXNlIHRoZSBwcm9qZWN0IHJvb3QgYW5kIG5vdCB0aGUgd29ya3NwYWNlIHJvb3QuXG4gICAgICAvLyBVbnRpbCB0aGVuIHdlIHByZXRlbmQgdGhlIGFwcCByb290IGlzIHJlbGF0aXZlIChgYCkgYnV0IHRoZSBzYW1lIGFzIGBwcm9qZWN0Um9vdGAuXG4gICAgICAoa2FybWFPcHRpb25zLmJ1aWxkV2VicGFjay5vcHRpb25zIGFzIGFueSkucm9vdCA9ICcnOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuXG4gICAgICAvLyBBc3NpZ24gYWRkaXRpb25hbCBrYXJtYUNvbmZpZyBvcHRpb25zIHRvIHRoZSBsb2NhbCBuZ2FwcCBjb25maWdcbiAgICAgIGthcm1hT3B0aW9ucy5jb25maWdGaWxlID0ga2FybWFDb25maWc7XG5cbiAgICAgIC8vIENvbXBsZXRlIHRoZSBvYnNlcnZhYmxlIG9uY2UgdGhlIEthcm1hIHNlcnZlciByZXR1cm5zLlxuICAgICAgY29uc3Qga2FybWFTZXJ2ZXIgPSBuZXcga2FybWEuU2VydmVyKGthcm1hT3B0aW9ucywgKCkgPT4gb2JzLmNvbXBsZXRlKCkpO1xuICAgICAga2FybWFTZXJ2ZXIuc3RhcnQoKTtcblxuICAgICAgLy8gQ2xlYW51cCwgc2lnbmFsIEthcm1hIHRvIGV4aXQuXG4gICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAvLyBLYXJtYSBkb2VzIG5vdCBzZWVtIHRvIGhhdmUgYSB3YXkgdG8gZXhpdCB0aGUgc2VydmVyIGdyYWNlZnVsbHkuXG4gICAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20va2FybWEtcnVubmVyL2thcm1hL2lzc3Vlcy8yODY3I2lzc3VlY29tbWVudC0zNjk5MTIxNjdcbiAgICAgICAgLy8gVE9ETzogbWFrZSBhIFBSIGZvciBrYXJtYSB0byBhZGQgYGthcm1hU2VydmVyLmNsb3NlKGNvZGUpYCwgdGhhdFxuICAgICAgICAvLyBjYWxscyBgZGlzY29ubmVjdEJyb3dzZXJzKGNvZGUpO2BcbiAgICAgICAgLy8ga2FybWFTZXJ2ZXIuY2xvc2UoKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFdlYnBhY2tDb25maWcocm9vdDogUGF0aCwgcHJvamVjdFJvb3Q6IFBhdGgsIG9wdGlvbnM6IEthcm1hQnVpbGRlck9wdGlvbnMpIHtcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgbGV0IHdjbzogYW55O1xuXG4gICAgY29uc3QgaG9zdCA9IG5ldyB2aXJ0dWFsRnMuQWxpYXNIb3N0KHRoaXMuY29udGV4dC5ob3N0IGFzIHZpcnR1YWxGcy5Ib3N0PGZzLlN0YXRzPik7XG5cbiAgICBvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMuZm9yRWFjaCgoeyBzcmMsIHJlcGxhY2VXaXRoIH0pID0+IHtcbiAgICAgIGhvc3QuYWxpYXNlcy5zZXQoXG4gICAgICAgIGpvaW4ocm9vdCwgbm9ybWFsaXplKHNyYykpLFxuICAgICAgICBqb2luKHJvb3QsIG5vcm1hbGl6ZShyZXBsYWNlV2l0aCkpLFxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHRzY29uZmlnUGF0aCA9IGdldFN5c3RlbVBhdGgocmVzb2x2ZShyb290LCBub3JtYWxpemUob3B0aW9ucy50c0NvbmZpZyBhcyBzdHJpbmcpKSk7XG4gICAgY29uc3QgdHNDb25maWcgPSByZWFkVHNjb25maWcodHNjb25maWdQYXRoKTtcblxuICAgIGNvbnN0IHByb2plY3RUcyA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLCAndHlwZXNjcmlwdCcpIGFzIHR5cGVvZiB0cztcblxuICAgIGNvbnN0IHN1cHBvcnRFUzIwMTUgPSB0c0NvbmZpZy5vcHRpb25zLnRhcmdldCAhPT0gcHJvamVjdFRzLlNjcmlwdFRhcmdldC5FUzNcbiAgICAgICYmIHRzQ29uZmlnLm9wdGlvbnMudGFyZ2V0ICE9PSBwcm9qZWN0VHMuU2NyaXB0VGFyZ2V0LkVTNTtcblxuICAgIGNvbnN0IGNvbXBhdE9wdGlvbnMgPSB7XG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgLy8gVE9ETzogaW5zaWRlIHRoZSBjb25maWdzLCBhbHdheXMgdXNlIHRoZSBwcm9qZWN0IHJvb3QgYW5kIG5vdCB0aGUgd29ya3NwYWNlIHJvb3QuXG4gICAgICAvLyBVbnRpbCB0aGVuIHdlIGhhdmUgdG8gcHJldGVuZCB0aGUgYXBwIHJvb3QgaXMgcmVsYXRpdmUgKGBgKSBidXQgdGhlIHNhbWUgYXMgYHByb2plY3RSb290YC5cbiAgICAgIHJvb3Q6ICcnLFxuICAgICAgLy8gU29tZSBhc3NldCBsb2dpYyBpbnNpZGUgZ2V0Q29tbW9uQ29uZmlnIG5lZWRzIG91dHB1dFBhdGggdG8gYmUgc2V0LlxuICAgICAgb3V0cHV0UGF0aDogJycsXG4gICAgfTtcblxuICAgIHdjbyA9IHtcbiAgICAgIHJvb3Q6IGdldFN5c3RlbVBhdGgocm9vdCksXG4gICAgICBwcm9qZWN0Um9vdDogZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksXG4gICAgICAvLyBUT0RPOiB1c2Ugb25seSB0aGlzLm9wdGlvbnMsIGl0IGNvbnRhaW5zIGFsbCBmbGFncyBhbmQgY29uZmlncyBpdGVtcyBhbHJlYWR5LlxuICAgICAgYnVpbGRPcHRpb25zOiBjb21wYXRPcHRpb25zLFxuICAgICAgYXBwQ29uZmlnOiBjb21wYXRPcHRpb25zLFxuICAgICAgdHNDb25maWcsXG4gICAgICBzdXBwb3J0RVMyMDE1LFxuICAgIH07XG5cbiAgICBjb25zdCB3ZWJwYWNrQ29uZmlnczoge31bXSA9IFtcbiAgICAgIGdldENvbW1vbkNvbmZpZyh3Y28pLFxuICAgICAgZ2V0U3R5bGVzQ29uZmlnKHdjbyksXG4gICAgICBnZXROb25Bb3RUZXN0Q29uZmlnKHdjbywgaG9zdCksXG4gICAgICBnZXRUZXN0Q29uZmlnKHdjbyksXG4gICAgXTtcblxuICAgIHJldHVybiB3ZWJwYWNrTWVyZ2Uod2VicGFja0NvbmZpZ3MpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEthcm1hQnVpbGRlcjtcbiJdfQ==