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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2thcm1hL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7O0FBUUgsK0NBQTBGO0FBRTFGLCtCQUFzQztBQUN0Qyw4Q0FBZ0Q7QUFHaEQsaUZBS3FEO0FBQ3JELGdGQUE0RTtBQUM1RSxrR0FBNkY7QUFFN0Ysb0NBQThGO0FBRTlGLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQVE5QyxNQUFhLFlBQVk7SUFDdkIsWUFBbUIsT0FBdUI7UUFBdkIsWUFBTyxHQUFQLE9BQU8sQ0FBZ0I7SUFBSSxDQUFDO0lBRS9DLEdBQUcsQ0FBQyxhQUF1RDtRQUN6RCxNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDO1FBQ3RDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztRQUN6QyxNQUFNLFdBQVcsR0FBRyxjQUFPLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxNQUFNLElBQUksR0FBRyxJQUFJLGdCQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBZ0MsQ0FBQyxDQUFDO1FBRXBGLE9BQU8sU0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FDbEIscUJBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxpQ0FBeUIsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQ2hGLGVBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixDQUFDLEVBQ3BFLHFCQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsOEJBQXNCLENBQ3BDLE9BQU8sQ0FBQyxN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b3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnQsXG4gIEJ1aWxkZXIsXG4gIEJ1aWxkZXJDb25maWd1cmF0aW9uLFxuICBCdWlsZGVyQ29udGV4dCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBQYXRoLCBnZXRTeXN0ZW1QYXRoLCBub3JtYWxpemUsIHJlc29sdmUsIHZpcnR1YWxGcyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IE9ic2VydmFibGUsIG9mIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBjb25jYXRNYXAsIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQge1xuICBnZXRDb21tb25Db25maWcsXG4gIGdldE5vbkFvdFRlc3RDb25maWcsXG4gIGdldFN0eWxlc0NvbmZpZyxcbiAgZ2V0VGVzdENvbmZpZyxcbn0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncyc7XG5pbXBvcnQgeyByZWFkVHNjb25maWcgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcmVhZC10c2NvbmZpZyc7XG5pbXBvcnQgeyByZXF1aXJlUHJvamVjdE1vZHVsZSB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9yZXF1aXJlLXByb2plY3QtbW9kdWxlJztcbmltcG9ydCB7IEFzc2V0UGF0dGVybk9iamVjdCwgQ3VycmVudEZpbGVSZXBsYWNlbWVudCB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IGRlZmF1bHRQcm9ncmVzcywgbm9ybWFsaXplQXNzZXRQYXR0ZXJucywgbm9ybWFsaXplRmlsZVJlcGxhY2VtZW50cyB9IGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCB7IEthcm1hQnVpbGRlclNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcbmNvbnN0IHdlYnBhY2tNZXJnZSA9IHJlcXVpcmUoJ3dlYnBhY2stbWVyZ2UnKTtcblxuXG5leHBvcnQgaW50ZXJmYWNlIE5vcm1hbGl6ZWRLYXJtYUJ1aWxkZXJTY2hlbWEgZXh0ZW5kcyBLYXJtYUJ1aWxkZXJTY2hlbWEge1xuICBhc3NldHM6IEFzc2V0UGF0dGVybk9iamVjdFtdO1xuICBmaWxlUmVwbGFjZW1lbnRzOiBDdXJyZW50RmlsZVJlcGxhY2VtZW50W107XG59XG5cbmV4cG9ydCBjbGFzcyBLYXJtYUJ1aWxkZXIgaW1wbGVtZW50cyBCdWlsZGVyPEthcm1hQnVpbGRlclNjaGVtYT4ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHsgfVxuXG4gIHJ1bihidWlsZGVyQ29uZmlnOiBCdWlsZGVyQ29uZmlndXJhdGlvbjxLYXJtYUJ1aWxkZXJTY2hlbWE+KTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGJ1aWxkZXJDb25maWcub3B0aW9ucztcbiAgICBjb25zdCByb290ID0gdGhpcy5jb250ZXh0LndvcmtzcGFjZS5yb290O1xuICAgIGNvbnN0IHByb2plY3RSb290ID0gcmVzb2x2ZShyb290LCBidWlsZGVyQ29uZmlnLnJvb3QpO1xuICAgIGNvbnN0IGhvc3QgPSBuZXcgdmlydHVhbEZzLkFsaWFzSG9zdCh0aGlzLmNvbnRleHQuaG9zdCBhcyB2aXJ0dWFsRnMuSG9zdDxmcy5TdGF0cz4pO1xuXG4gICAgcmV0dXJuIG9mKG51bGwpLnBpcGUoXG4gICAgICBjb25jYXRNYXAoKCkgPT4gbm9ybWFsaXplRmlsZVJlcGxhY2VtZW50cyhvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMsIGhvc3QsIHJvb3QpKSxcbiAgICAgIHRhcChmaWxlUmVwbGFjZW1lbnRzID0+IG9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cyA9IGZpbGVSZXBsYWNlbWVudHMpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMoXG4gICAgICAgIG9wdGlvbnMuYXNzZXRzLCBob3N0LCByb290LCBwcm9qZWN0Um9vdCwgYnVpbGRlckNvbmZpZy5zb3VyY2VSb290KSksXG4gICAgICAvLyBSZXBsYWNlIHRoZSBhc3NldHMgaW4gb3B0aW9ucyB3aXRoIHRoZSBub3JtYWxpemVkIHZlcnNpb24uXG4gICAgICB0YXAoKGFzc2V0UGF0dGVybk9iamVjdHMgPT4gb3B0aW9ucy5hc3NldHMgPSBhc3NldFBhdHRlcm5PYmplY3RzKSksXG4gICAgICBjb25jYXRNYXAoKCkgPT4gbmV3IE9ic2VydmFibGUob2JzID0+IHtcbiAgICAgICAgY29uc3Qga2FybWEgPSByZXF1aXJlUHJvamVjdE1vZHVsZShnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSwgJ2thcm1hJyk7XG4gICAgICAgIGNvbnN0IGthcm1hQ29uZmlnID0gZ2V0U3lzdGVtUGF0aChyZXNvbHZlKHJvb3QsIG5vcm1hbGl6ZShvcHRpb25zLmthcm1hQ29uZmlnKSkpO1xuXG4gICAgICAgIC8vIFRPRE86IGFkanVzdCBvcHRpb25zIHRvIGFjY291bnQgZm9yIG5vdCBwYXNzaW5nIHRoZW0gYmxpbmRseSB0byBrYXJtYS5cbiAgICAgICAgLy8gY29uc3Qga2FybWFPcHRpb25zOiBhbnkgPSBPYmplY3QuYXNzaWduKHt9LCBvcHRpb25zKTtcbiAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICBjb25zdCBrYXJtYU9wdGlvbnM6IGFueSA9IHt9O1xuXG4gICAgICAgIGlmIChvcHRpb25zLndhdGNoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBrYXJtYU9wdGlvbnMuc2luZ2xlUnVuID0gIW9wdGlvbnMud2F0Y2g7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb252ZXJ0IGJyb3dzZXJzIGZyb20gYSBzdHJpbmcgdG8gYW4gYXJyYXlcbiAgICAgICAgaWYgKG9wdGlvbnMuYnJvd3NlcnMpIHtcbiAgICAgICAgICBrYXJtYU9wdGlvbnMuYnJvd3NlcnMgPSBvcHRpb25zLmJyb3dzZXJzLnNwbGl0KCcsJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzb3VyY2VSb290ID0gYnVpbGRlckNvbmZpZy5zb3VyY2VSb290ICYmIHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5zb3VyY2VSb290KTtcblxuICAgICAgICBrYXJtYU9wdGlvbnMuYnVpbGRXZWJwYWNrID0ge1xuICAgICAgICAgIHJvb3Q6IGdldFN5c3RlbVBhdGgocm9vdCksXG4gICAgICAgICAgcHJvamVjdFJvb3Q6IGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLFxuICAgICAgICAgIG9wdGlvbnM6IG9wdGlvbnMgYXMgTm9ybWFsaXplZEthcm1hQnVpbGRlclNjaGVtYSxcbiAgICAgICAgICB3ZWJwYWNrQ29uZmlnOiB0aGlzLl9idWlsZFdlYnBhY2tDb25maWcocm9vdCwgcHJvamVjdFJvb3QsIHNvdXJjZVJvb3QsIGhvc3QsXG4gICAgICAgICAgICBvcHRpb25zIGFzIE5vcm1hbGl6ZWRLYXJtYUJ1aWxkZXJTY2hlbWEpLFxuICAgICAgICAgIC8vIFBhc3Mgb250byBLYXJtYSB0byBlbWl0IEJ1aWxkRXZlbnRzLlxuICAgICAgICAgIHN1Y2Nlc3NDYjogKCkgPT4gb2JzLm5leHQoeyBzdWNjZXNzOiB0cnVlIH0pLFxuICAgICAgICAgIGZhaWx1cmVDYjogKCkgPT4gb2JzLm5leHQoeyBzdWNjZXNzOiBmYWxzZSB9KSxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBUT0RPOiBpbnNpZGUgdGhlIGNvbmZpZ3MsIGFsd2F5cyB1c2UgdGhlIHByb2plY3Qgcm9vdCBhbmQgbm90IHRoZSB3b3Jrc3BhY2Ugcm9vdC5cbiAgICAgICAgLy8gVW50aWwgdGhlbiB3ZSBwcmV0ZW5kIHRoZSBhcHAgcm9vdCBpcyByZWxhdGl2ZSAoYGApIGJ1dCB0aGUgc2FtZSBhcyBgcHJvamVjdFJvb3RgLlxuICAgICAgICBrYXJtYU9wdGlvbnMuYnVpbGRXZWJwYWNrLm9wdGlvbnMucm9vdCA9ICcnO1xuXG4gICAgICAgIC8vIEFzc2lnbiBhZGRpdGlvbmFsIGthcm1hQ29uZmlnIG9wdGlvbnMgdG8gdGhlIGxvY2FsIG5nYXBwIGNvbmZpZ1xuICAgICAgICBrYXJtYU9wdGlvbnMuY29uZmlnRmlsZSA9IGthcm1hQ29uZmlnO1xuXG4gICAgICAgIC8vIENvbXBsZXRlIHRoZSBvYnNlcnZhYmxlIG9uY2UgdGhlIEthcm1hIHNlcnZlciByZXR1cm5zLlxuICAgICAgICBjb25zdCBrYXJtYVNlcnZlciA9IG5ldyBrYXJtYS5TZXJ2ZXIoa2FybWFPcHRpb25zLCAoKSA9PiBvYnMuY29tcGxldGUoKSk7XG4gICAgICAgIGthcm1hU2VydmVyLnN0YXJ0KCk7XG5cbiAgICAgICAgLy8gQ2xlYW51cCwgc2lnbmFsIEthcm1hIHRvIGV4aXQuXG4gICAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgICAgLy8gS2FybWEgZG9lcyBub3Qgc2VlbSB0byBoYXZlIGEgd2F5IHRvIGV4aXQgdGhlIHNlcnZlciBncmFjZWZ1bGx5LlxuICAgICAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20va2FybWEtcnVubmVyL2thcm1hL2lzc3Vlcy8yODY3I2lzc3VlY29tbWVudC0zNjk5MTIxNjdcbiAgICAgICAgICAvLyBUT0RPOiBtYWtlIGEgUFIgZm9yIGthcm1hIHRvIGFkZCBga2FybWFTZXJ2ZXIuY2xvc2UoY29kZSlgLCB0aGF0XG4gICAgICAgICAgLy8gY2FsbHMgYGRpc2Nvbm5lY3RCcm93c2Vycyhjb2RlKTtgXG4gICAgICAgICAgLy8ga2FybWFTZXJ2ZXIuY2xvc2UoKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKSxcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRXZWJwYWNrQ29uZmlnKFxuICAgIHJvb3Q6IFBhdGgsXG4gICAgcHJvamVjdFJvb3Q6IFBhdGgsXG4gICAgc291cmNlUm9vdDogUGF0aCB8IHVuZGVmaW5lZCxcbiAgICBob3N0OiB2aXJ0dWFsRnMuSG9zdDxmcy5TdGF0cz4sXG4gICAgb3B0aW9uczogTm9ybWFsaXplZEthcm1hQnVpbGRlclNjaGVtYSxcbiAgKSB7XG4gICAgbGV0IHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnM7XG5cbiAgICBjb25zdCB0c0NvbmZpZ1BhdGggPSBnZXRTeXN0ZW1QYXRoKHJlc29sdmUocm9vdCwgbm9ybWFsaXplKG9wdGlvbnMudHNDb25maWcpKSk7XG4gICAgY29uc3QgdHNDb25maWcgPSByZWFkVHNjb25maWcodHNDb25maWdQYXRoKTtcblxuICAgIGNvbnN0IHByb2plY3RUcyA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLCAndHlwZXNjcmlwdCcpIGFzIHR5cGVvZiB0cztcblxuICAgIGNvbnN0IHN1cHBvcnRFUzIwMTUgPSB0c0NvbmZpZy5vcHRpb25zLnRhcmdldCAhPT0gcHJvamVjdFRzLlNjcmlwdFRhcmdldC5FUzNcbiAgICAgICYmIHRzQ29uZmlnLm9wdGlvbnMudGFyZ2V0ICE9PSBwcm9qZWN0VHMuU2NyaXB0VGFyZ2V0LkVTNTtcblxuICAgIGNvbnN0IGNvbXBhdE9wdGlvbnM6IHR5cGVvZiB3Y29bJ2J1aWxkT3B0aW9ucyddID0ge1xuICAgICAgLi4ub3B0aW9ucyBhcyB7fSBhcyB0eXBlb2Ygd2NvWydidWlsZE9wdGlvbnMnXSxcbiAgICAgIC8vIFNvbWUgYXNzZXQgbG9naWMgaW5zaWRlIGdldENvbW1vbkNvbmZpZyBuZWVkcyBvdXRwdXRQYXRoIHRvIGJlIHNldC5cbiAgICAgIG91dHB1dFBhdGg6ICcnLFxuICAgIH07XG5cbiAgICB3Y28gPSB7XG4gICAgICByb290OiBnZXRTeXN0ZW1QYXRoKHJvb3QpLFxuICAgICAgcHJvamVjdFJvb3Q6IGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLFxuICAgICAgc291cmNlUm9vdDogc291cmNlUm9vdCAmJiBnZXRTeXN0ZW1QYXRoKHNvdXJjZVJvb3QpLFxuICAgICAgLy8gVE9ETzogdXNlIG9ubHkgdGhpcy5vcHRpb25zLCBpdCBjb250YWlucyBhbGwgZmxhZ3MgYW5kIGNvbmZpZ3MgaXRlbXMgYWxyZWFkeS5cbiAgICAgIGJ1aWxkT3B0aW9uczogY29tcGF0T3B0aW9ucyxcbiAgICAgIHRzQ29uZmlnLFxuICAgICAgdHNDb25maWdQYXRoLFxuICAgICAgc3VwcG9ydEVTMjAxNSxcbiAgICB9O1xuXG4gICAgd2NvLmJ1aWxkT3B0aW9ucy5wcm9ncmVzcyA9IGRlZmF1bHRQcm9ncmVzcyh3Y28uYnVpbGRPcHRpb25zLnByb2dyZXNzKTtcblxuICAgIGNvbnN0IHdlYnBhY2tDb25maWdzOiB7fVtdID0gW1xuICAgICAgZ2V0Q29tbW9uQ29uZmlnKHdjbyksXG4gICAgICBnZXRTdHlsZXNDb25maWcod2NvKSxcbiAgICAgIGdldE5vbkFvdFRlc3RDb25maWcod2NvLCBob3N0KSxcbiAgICAgIGdldFRlc3RDb25maWcod2NvKSxcbiAgICBdO1xuXG4gICAgcmV0dXJuIHdlYnBhY2tNZXJnZSh3ZWJwYWNrQ29uZmlncyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgS2FybWFCdWlsZGVyO1xuIl19