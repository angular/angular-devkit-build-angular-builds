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
        return rxjs_1.of(null).pipe(operators_1.concatMap(() => utils_1.addFileReplacements(root, host, options.fileReplacements)), operators_1.concatMap(() => new rxjs_1.Observable(obs => {
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
                webpackConfig: this._buildWebpackConfig(root, projectRoot, host, options),
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
        })));
    }
    _buildWebpackConfig(root, projectRoot, host, options) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2thcm1hL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7O0FBUUgsK0NBQTBGO0FBRTFGLCtCQUFzQztBQUN0Qyw4Q0FBMkM7QUFHM0MsaUZBS3FEO0FBQ3JELGdGQUE0RTtBQUM1RSxrR0FBNkY7QUFFN0Ysb0NBQStDO0FBRS9DLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQU85QztJQUNFLFlBQW1CLE9BQXVCO1FBQXZCLFlBQU8sR0FBUCxPQUFPLENBQWdCO0lBQUksQ0FBQztJQUUvQyxHQUFHLENBQUMsYUFBd0Q7UUFDMUQsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQztRQUN0QyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDekMsTUFBTSxXQUFXLEdBQUcsY0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEQsTUFBTSxJQUFJLEdBQUcsSUFBSSxnQkFBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQWdDLENBQUMsQ0FBQztRQUVwRixNQUFNLENBQUMsU0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FDbEIscUJBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQywyQkFBbUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLEVBQzFFLHFCQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxpQkFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQ25DLE1BQU0sS0FBSyxHQUFHLDZDQUFvQixDQUFDLG9CQUFhLENBQUMsV0FBVyxDQUFDLEVBQUUsT0FBTyxDQUFDLENB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QUN2QyxnRkFBZ0Y7WUFDaEYsWUFBWSxFQUFFLGFBQWE7WUFDM0IsUUFBUTtZQUNSLFlBQVk7WUFDWixhQUFhO1NBQ2QsQ0FBQztRQUVGLE1BQU0sY0FBYyxHQUFTO1lBQzNCLGlDQUFlLENBQUMsR0FBRyxDQUFDO1lBQ3BCLGlDQUFlLENBQUMsR0FBRyxDQUFDO1lBQ3BCLHFDQUFtQixDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7WUFDOUIsK0JBQWEsQ0FBQyxHQUFHLENBQUM7U0FDbkIsQ0FBQztRQUVGLE1BQU0sQ0FBQyxZQUFZLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDdEMsQ0FBQztDQUNGO0FBckdELG9DQXFHQztBQUVELGtCQUFlLFlBQVksQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgQnVpbGRFdmVudCxcbiAgQnVpbGRlcixcbiAgQnVpbGRlckNvbmZpZ3VyYXRpb24sXG4gIEJ1aWxkZXJDb250ZXh0LFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IFBhdGgsIGdldFN5c3RlbVBhdGgsIG5vcm1hbGl6ZSwgcmVzb2x2ZSwgdmlydHVhbEZzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgb2YgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQge1xuICBnZXRDb21tb25Db25maWcsXG4gIGdldE5vbkFvdFRlc3RDb25maWcsXG4gIGdldFN0eWxlc0NvbmZpZyxcbiAgZ2V0VGVzdENvbmZpZyxcbn0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncyc7XG5pbXBvcnQgeyByZWFkVHNjb25maWcgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcmVhZC10c2NvbmZpZyc7XG5pbXBvcnQgeyByZXF1aXJlUHJvamVjdE1vZHVsZSB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9yZXF1aXJlLXByb2plY3QtbW9kdWxlJztcbmltcG9ydCB7IEN1cnJlbnRGaWxlUmVwbGFjZW1lbnQgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBhZGRGaWxlUmVwbGFjZW1lbnRzIH0gZnJvbSAnLi4vdXRpbHMnO1xuaW1wb3J0IHsgS2FybWFCdWlsZGVyU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuY29uc3Qgd2VicGFja01lcmdlID0gcmVxdWlyZSgnd2VicGFjay1tZXJnZScpO1xuXG5cbmV4cG9ydCBpbnRlcmZhY2UgS2FybWFCdWlsZGVyT3B0aW9ucyBleHRlbmRzIEthcm1hQnVpbGRlclNjaGVtYSB7XG4gIGZpbGVSZXBsYWNlbWVudHM6IEN1cnJlbnRGaWxlUmVwbGFjZW1lbnRbXTtcbn1cblxuZXhwb3J0IGNsYXNzIEthcm1hQnVpbGRlciBpbXBsZW1lbnRzIEJ1aWxkZXI8S2FybWFCdWlsZGVyT3B0aW9ucz4ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHsgfVxuXG4gIHJ1bihidWlsZGVyQ29uZmlnOiBCdWlsZGVyQ29uZmlndXJhdGlvbjxLYXJtYUJ1aWxkZXJPcHRpb25zPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnM7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdDtcbiAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5yb290KTtcbiAgICBjb25zdCBob3N0ID0gbmV3IHZpcnR1YWxGcy5BbGlhc0hvc3QodGhpcy5jb250ZXh0Lmhvc3QgYXMgdmlydHVhbEZzLkhvc3Q8ZnMuU3RhdHM+KTtcblxuICAgIHJldHVybiBvZihudWxsKS5waXBlKFxuICAgICAgY29uY2F0TWFwKCgpID0+IGFkZEZpbGVSZXBsYWNlbWVudHMocm9vdCwgaG9zdCwgb3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSksXG4gICAgICBjb25jYXRNYXAoKCkgPT4gbmV3IE9ic2VydmFibGUob2JzID0+IHtcbiAgICAgICAgY29uc3Qga2FybWEgPSByZXF1aXJlUHJvamVjdE1vZHVsZShnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSwgJ2thcm1hJyk7XG4gICAgICAgIGNvbnN0IGthcm1hQ29uZmlnID0gZ2V0U3lzdGVtUGF0aChyZXNvbHZlKHJvb3QsIG5vcm1hbGl6ZShvcHRpb25zLmthcm1hQ29uZmlnKSkpO1xuXG4gICAgICAgIC8vIFRPRE86IGFkanVzdCBvcHRpb25zIHRvIGFjY291bnQgZm9yIG5vdCBwYXNzaW5nIHRoZW0gYmxpbmRseSB0byBrYXJtYS5cbiAgICAgICAgLy8gY29uc3Qga2FybWFPcHRpb25zOiBhbnkgPSBPYmplY3QuYXNzaWduKHt9LCBvcHRpb25zKTtcbiAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICBjb25zdCBrYXJtYU9wdGlvbnM6IGFueSA9IHtcbiAgICAgICAgICBzaW5nbGVSdW46ICFvcHRpb25zLndhdGNoLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIENvbnZlcnQgYnJvd3NlcnMgZnJvbSBhIHN0cmluZyB0byBhbiBhcnJheVxuICAgICAgICBpZiAob3B0aW9ucy5icm93c2Vycykge1xuICAgICAgICAgIGthcm1hT3B0aW9ucy5icm93c2VycyA9IG9wdGlvbnMuYnJvd3NlcnMuc3BsaXQoJywnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGthcm1hT3B0aW9ucy5idWlsZFdlYnBhY2sgPSB7XG4gICAgICAgICAgcm9vdDogZ2V0U3lzdGVtUGF0aChyb290KSxcbiAgICAgICAgICBwcm9qZWN0Um9vdDogZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksXG4gICAgICAgICAgb3B0aW9uczogb3B0aW9ucyxcbiAgICAgICAgICB3ZWJwYWNrQ29uZmlnOiB0aGlzLl9idWlsZFdlYnBhY2tDb25maWcocm9vdCwgcHJvamVjdFJvb3QsIGhvc3QsIG9wdGlvbnMpLFxuICAgICAgICAgIC8vIFBhc3Mgb250byBLYXJtYSB0byBlbWl0IEJ1aWxkRXZlbnRzLlxuICAgICAgICAgIHN1Y2Nlc3NDYjogKCkgPT4gb2JzLm5leHQoeyBzdWNjZXNzOiB0cnVlIH0pLFxuICAgICAgICAgIGZhaWx1cmVDYjogKCkgPT4gb2JzLm5leHQoeyBzdWNjZXNzOiBmYWxzZSB9KSxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBUT0RPOiBpbnNpZGUgdGhlIGNvbmZpZ3MsIGFsd2F5cyB1c2UgdGhlIHByb2plY3Qgcm9vdCBhbmQgbm90IHRoZSB3b3Jrc3BhY2Ugcm9vdC5cbiAgICAgICAgLy8gVW50aWwgdGhlbiB3ZSBwcmV0ZW5kIHRoZSBhcHAgcm9vdCBpcyByZWxhdGl2ZSAoYGApIGJ1dCB0aGUgc2FtZSBhcyBgcHJvamVjdFJvb3RgLlxuICAgICAgICAoa2FybWFPcHRpb25zLmJ1aWxkV2VicGFjay5vcHRpb25zIGFzIGFueSkucm9vdCA9ICcnOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuXG4gICAgICAgIC8vIEFzc2lnbiBhZGRpdGlvbmFsIGthcm1hQ29uZmlnIG9wdGlvbnMgdG8gdGhlIGxvY2FsIG5nYXBwIGNvbmZpZ1xuICAgICAgICBrYXJtYU9wdGlvbnMuY29uZmlnRmlsZSA9IGthcm1hQ29uZmlnO1xuXG4gICAgICAgIC8vIENvbXBsZXRlIHRoZSBvYnNlcnZhYmxlIG9uY2UgdGhlIEthcm1hIHNlcnZlciByZXR1cm5zLlxuICAgICAgICBjb25zdCBrYXJtYVNlcnZlciA9IG5ldyBrYXJtYS5TZXJ2ZXIoa2FybWFPcHRpb25zLCAoKSA9PiBvYnMuY29tcGxldGUoKSk7XG4gICAgICAgIGthcm1hU2VydmVyLnN0YXJ0KCk7XG5cbiAgICAgICAgLy8gQ2xlYW51cCwgc2lnbmFsIEthcm1hIHRvIGV4aXQuXG4gICAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgICAgLy8gS2FybWEgZG9lcyBub3Qgc2VlbSB0byBoYXZlIGEgd2F5IHRvIGV4aXQgdGhlIHNlcnZlciBncmFjZWZ1bGx5LlxuICAgICAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20va2FybWEtcnVubmVyL2thcm1hL2lzc3Vlcy8yODY3I2lzc3VlY29tbWVudC0zNjk5MTIxNjdcbiAgICAgICAgICAvLyBUT0RPOiBtYWtlIGEgUFIgZm9yIGthcm1hIHRvIGFkZCBga2FybWFTZXJ2ZXIuY2xvc2UoY29kZSlgLCB0aGF0XG4gICAgICAgICAgLy8gY2FsbHMgYGRpc2Nvbm5lY3RCcm93c2Vycyhjb2RlKTtgXG4gICAgICAgICAgLy8ga2FybWFTZXJ2ZXIuY2xvc2UoKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKSxcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRXZWJwYWNrQ29uZmlnKFxuICAgIHJvb3Q6IFBhdGgsXG4gICAgcHJvamVjdFJvb3Q6IFBhdGgsXG4gICAgaG9zdDogdmlydHVhbEZzLkhvc3Q8ZnMuU3RhdHM+LFxuICAgIG9wdGlvbnM6IEthcm1hQnVpbGRlck9wdGlvbnMsXG4gICkge1xuICAgIGxldCB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zO1xuXG4gICAgY29uc3QgdHNDb25maWdQYXRoID0gZ2V0U3lzdGVtUGF0aChyZXNvbHZlKHJvb3QsIG5vcm1hbGl6ZShvcHRpb25zLnRzQ29uZmlnIGFzIHN0cmluZykpKTtcbiAgICBjb25zdCB0c0NvbmZpZyA9IHJlYWRUc2NvbmZpZyh0c0NvbmZpZ1BhdGgpO1xuXG4gICAgY29uc3QgcHJvamVjdFRzID0gcmVxdWlyZVByb2plY3RNb2R1bGUoZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksICd0eXBlc2NyaXB0JykgYXMgdHlwZW9mIHRzO1xuXG4gICAgY29uc3Qgc3VwcG9ydEVTMjAxNSA9IHRzQ29uZmlnLm9wdGlvbnMudGFyZ2V0ICE9PSBwcm9qZWN0VHMuU2NyaXB0VGFyZ2V0LkVTM1xuICAgICAgJiYgdHNDb25maWcub3B0aW9ucy50YXJnZXQgIT09IHByb2plY3RUcy5TY3JpcHRUYXJnZXQuRVM1O1xuXG4gICAgY29uc3QgY29tcGF0T3B0aW9uczogdHlwZW9mIHdjb1snYnVpbGRPcHRpb25zJ10gPSB7XG4gICAgICAuLi5vcHRpb25zIGFzIHt9IGFzIHR5cGVvZiB3Y29bJ2J1aWxkT3B0aW9ucyddLFxuICAgICAgLy8gU29tZSBhc3NldCBsb2dpYyBpbnNpZGUgZ2V0Q29tbW9uQ29uZmlnIG5lZWRzIG91dHB1dFBhdGggdG8gYmUgc2V0LlxuICAgICAgb3V0cHV0UGF0aDogJycsXG4gICAgfTtcblxuICAgIHdjbyA9IHtcbiAgICAgIHJvb3Q6IGdldFN5c3RlbVBhdGgocm9vdCksXG4gICAgICBwcm9qZWN0Um9vdDogZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksXG4gICAgICAvLyBUT0RPOiB1c2Ugb25seSB0aGlzLm9wdGlvbnMsIGl0IGNvbnRhaW5zIGFsbCBmbGFncyBhbmQgY29uZmlncyBpdGVtcyBhbHJlYWR5LlxuICAgICAgYnVpbGRPcHRpb25zOiBjb21wYXRPcHRpb25zLFxuICAgICAgdHNDb25maWcsXG4gICAgICB0c0NvbmZpZ1BhdGgsXG4gICAgICBzdXBwb3J0RVMyMDE1LFxuICAgIH07XG5cbiAgICBjb25zdCB3ZWJwYWNrQ29uZmlnczoge31bXSA9IFtcbiAgICAgIGdldENvbW1vbkNvbmZpZyh3Y28pLFxuICAgICAgZ2V0U3R5bGVzQ29uZmlnKHdjbyksXG4gICAgICBnZXROb25Bb3RUZXN0Q29uZmlnKHdjbywgaG9zdCksXG4gICAgICBnZXRUZXN0Q29uZmlnKHdjbyksXG4gICAgXTtcblxuICAgIHJldHVybiB3ZWJwYWNrTWVyZ2Uod2VicGFja0NvbmZpZ3MpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEthcm1hQnVpbGRlcjtcbiJdfQ==