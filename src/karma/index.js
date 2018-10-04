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
            if (options.reporters) {
                // Split along commas to make it more natural, and remove empty strings.
                karmaOptions.reporters = options.reporters
                    .reduce((acc, curr) => acc.concat(curr.split(/,/)), [])
                    .filter(x => !!x);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2thcm1hL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7O0FBUUgsK0NBQTBGO0FBRTFGLCtCQUFzQztBQUN0Qyw4Q0FBZ0Q7QUFHaEQsaUZBS3FEO0FBQ3JELGdGQUE0RTtBQUM1RSxrR0FBNkY7QUFFN0Ysb0NBQThGO0FBRTlGLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQVE5QyxNQUFhLFlBQVk7SUFDdkIsWUFBbUIsT0FBdUI7UUFBdkIsWUFBTyxHQUFQLE9BQU8sQ0FBZ0I7SUFBSSxDQUFDO0lBRS9DLEdBQUcsQ0FBQyxhQUF1RDtRQUN6RCxNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDO1FBQ3RDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztRQUN6QyxNQUFNLFdBQVcsR0FBRyxjQUFPLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxNQUFNLElBQUksR0FBRyxJQUFJLGdCQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBZ0MsQ0FBQyxDQUFDO1FBRXBGLE9BQU8sU0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FDbEIscUJBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxpQ0FBeUIsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQ2hGLGVBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixDQUFDLEVBQ3BFLHFCQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsOEJBQXNCLENBQ3BDLE9BQU8sQ0FBQyxN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RXZFLE1BQU0sY0FBYyxHQUFTO1lBQzNCLGlDQUFlLENBQUMsR0FBRyxDQUFDO1lBQ3BCLGlDQUFlLENBQUMsR0FBRyxDQUFDO1lBQ3BCLHFDQUFtQixDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7WUFDOUIsK0JBQWEsQ0FBQyxHQUFHLENBQUM7U0FDbkIsQ0FBQztRQUVGLE9BQU8sWUFBWSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ3RDLENBQUM7Q0FDRjtBQTFIRCxvQ0EwSEM7QUFFRCxrQkFBZSxZQUFZLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnQsXG4gIEJ1aWxkZXIsXG4gIEJ1aWxkZXJDb25maWd1cmF0aW9uLFxuICBCdWlsZGVyQ29udGV4dCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBQYXRoLCBnZXRTeXN0ZW1QYXRoLCBub3JtYWxpemUsIHJlc29sdmUsIHZpcnR1YWxGcyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IE9ic2VydmFibGUsIG9mIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBjb25jYXRNYXAsIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQge1xuICBnZXRDb21tb25Db25maWcsXG4gIGdldE5vbkFvdFRlc3RDb25maWcsXG4gIGdldFN0eWxlc0NvbmZpZyxcbiAgZ2V0VGVzdENvbmZpZyxcbn0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncyc7XG5pbXBvcnQgeyByZWFkVHNjb25maWcgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcmVhZC10c2NvbmZpZyc7XG5pbXBvcnQgeyByZXF1aXJlUHJvamVjdE1vZHVsZSB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9yZXF1aXJlLXByb2plY3QtbW9kdWxlJztcbmltcG9ydCB7IEFzc2V0UGF0dGVybk9iamVjdCwgQ3VycmVudEZpbGVSZXBsYWNlbWVudCB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IGRlZmF1bHRQcm9ncmVzcywgbm9ybWFsaXplQXNzZXRQYXR0ZXJucywgbm9ybWFsaXplRmlsZVJlcGxhY2VtZW50cyB9IGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCB7IEthcm1hQnVpbGRlclNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcbmNvbnN0IHdlYnBhY2tNZXJnZSA9IHJlcXVpcmUoJ3dlYnBhY2stbWVyZ2UnKTtcblxuXG5leHBvcnQgaW50ZXJmYWNlIE5vcm1hbGl6ZWRLYXJtYUJ1aWxkZXJTY2hlbWEgZXh0ZW5kcyBLYXJtYUJ1aWxkZXJTY2hlbWEge1xuICBhc3NldHM6IEFzc2V0UGF0dGVybk9iamVjdFtdO1xuICBmaWxlUmVwbGFjZW1lbnRzOiBDdXJyZW50RmlsZVJlcGxhY2VtZW50W107XG59XG5cbmV4cG9ydCBjbGFzcyBLYXJtYUJ1aWxkZXIgaW1wbGVtZW50cyBCdWlsZGVyPEthcm1hQnVpbGRlclNjaGVtYT4ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHsgfVxuXG4gIHJ1bihidWlsZGVyQ29uZmlnOiBCdWlsZGVyQ29uZmlndXJhdGlvbjxLYXJtYUJ1aWxkZXJTY2hlbWE+KTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGJ1aWxkZXJDb25maWcub3B0aW9ucztcbiAgICBjb25zdCByb290ID0gdGhpcy5jb250ZXh0LndvcmtzcGFjZS5yb290O1xuICAgIGNvbnN0IHByb2plY3RSb290ID0gcmVzb2x2ZShyb290LCBidWlsZGVyQ29uZmlnLnJvb3QpO1xuICAgIGNvbnN0IGhvc3QgPSBuZXcgdmlydHVhbEZzLkFsaWFzSG9zdCh0aGlzLmNvbnRleHQuaG9zdCBhcyB2aXJ0dWFsRnMuSG9zdDxmcy5TdGF0cz4pO1xuXG4gICAgcmV0dXJuIG9mKG51bGwpLnBpcGUoXG4gICAgICBjb25jYXRNYXAoKCkgPT4gbm9ybWFsaXplRmlsZVJlcGxhY2VtZW50cyhvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMsIGhvc3QsIHJvb3QpKSxcbiAgICAgIHRhcChmaWxlUmVwbGFjZW1lbnRzID0+IG9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cyA9IGZpbGVSZXBsYWNlbWVudHMpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMoXG4gICAgICAgIG9wdGlvbnMuYXNzZXRzLCBob3N0LCByb290LCBwcm9qZWN0Um9vdCwgYnVpbGRlckNvbmZpZy5zb3VyY2VSb290KSksXG4gICAgICAvLyBSZXBsYWNlIHRoZSBhc3NldHMgaW4gb3B0aW9ucyB3aXRoIHRoZSBub3JtYWxpemVkIHZlcnNpb24uXG4gICAgICB0YXAoKGFzc2V0UGF0dGVybk9iamVjdHMgPT4gb3B0aW9ucy5hc3NldHMgPSBhc3NldFBhdHRlcm5PYmplY3RzKSksXG4gICAgICBjb25jYXRNYXAoKCkgPT4gbmV3IE9ic2VydmFibGUob2JzID0+IHtcbiAgICAgICAgY29uc3Qga2FybWEgPSByZXF1aXJlUHJvamVjdE1vZHVsZShnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSwgJ2thcm1hJyk7XG4gICAgICAgIGNvbnN0IGthcm1hQ29uZmlnID0gZ2V0U3lzdGVtUGF0aChyZXNvbHZlKHJvb3QsIG5vcm1hbGl6ZShvcHRpb25zLmthcm1hQ29uZmlnKSkpO1xuXG4gICAgICAgIC8vIFRPRE86IGFkanVzdCBvcHRpb25zIHRvIGFjY291bnQgZm9yIG5vdCBwYXNzaW5nIHRoZW0gYmxpbmRseSB0byBrYXJtYS5cbiAgICAgICAgLy8gY29uc3Qga2FybWFPcHRpb25zOiBhbnkgPSBPYmplY3QuYXNzaWduKHt9LCBvcHRpb25zKTtcbiAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICBjb25zdCBrYXJtYU9wdGlvbnM6IGFueSA9IHt9O1xuXG4gICAgICAgIGlmIChvcHRpb25zLndhdGNoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBrYXJtYU9wdGlvbnMuc2luZ2xlUnVuID0gIW9wdGlvbnMud2F0Y2g7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb252ZXJ0IGJyb3dzZXJzIGZyb20gYSBzdHJpbmcgdG8gYW4gYXJyYXlcbiAgICAgICAgaWYgKG9wdGlvbnMuYnJvd3NlcnMpIHtcbiAgICAgICAgICBrYXJtYU9wdGlvbnMuYnJvd3NlcnMgPSBvcHRpb25zLmJyb3dzZXJzLnNwbGl0KCcsJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5yZXBvcnRlcnMpIHtcbiAgICAgICAgICAvLyBTcGxpdCBhbG9uZyBjb21tYXMgdG8gbWFrZSBpdCBtb3JlIG5hdHVyYWwsIGFuZCByZW1vdmUgZW1wdHkgc3RyaW5ncy5cbiAgICAgICAgICBrYXJtYU9wdGlvbnMucmVwb3J0ZXJzID0gb3B0aW9ucy5yZXBvcnRlcnNcbiAgICAgICAgICAgIC5yZWR1Y2U8c3RyaW5nW10+KChhY2MsIGN1cnIpID0+IGFjYy5jb25jYXQoY3Vyci5zcGxpdCgvLC8pKSwgW10pXG4gICAgICAgICAgICAuZmlsdGVyKHggPT4gISF4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNvdXJjZVJvb3QgPSBidWlsZGVyQ29uZmlnLnNvdXJjZVJvb3QgJiYgcmVzb2x2ZShyb290LCBidWlsZGVyQ29uZmlnLnNvdXJjZVJvb3QpO1xuXG4gICAgICAgIGthcm1hT3B0aW9ucy5idWlsZFdlYnBhY2sgPSB7XG4gICAgICAgICAgcm9vdDogZ2V0U3lzdGVtUGF0aChyb290KSxcbiAgICAgICAgICBwcm9qZWN0Um9vdDogZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksXG4gICAgICAgICAgb3B0aW9uczogb3B0aW9ucyBhcyBOb3JtYWxpemVkS2FybWFCdWlsZGVyU2NoZW1hLFxuICAgICAgICAgIHdlYnBhY2tDb25maWc6IHRoaXMuX2J1aWxkV2VicGFja0NvbmZpZyhyb290LCBwcm9qZWN0Um9vdCwgc291cmNlUm9vdCwgaG9zdCxcbiAgICAgICAgICAgIG9wdGlvbnMgYXMgTm9ybWFsaXplZEthcm1hQnVpbGRlclNjaGVtYSksXG4gICAgICAgICAgLy8gUGFzcyBvbnRvIEthcm1hIHRvIGVtaXQgQnVpbGRFdmVudHMuXG4gICAgICAgICAgc3VjY2Vzc0NiOiAoKSA9PiBvYnMubmV4dCh7IHN1Y2Nlc3M6IHRydWUgfSksXG4gICAgICAgICAgZmFpbHVyZUNiOiAoKSA9PiBvYnMubmV4dCh7IHN1Y2Nlc3M6IGZhbHNlIH0pLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFRPRE86IGluc2lkZSB0aGUgY29uZmlncywgYWx3YXlzIHVzZSB0aGUgcHJvamVjdCByb290IGFuZCBub3QgdGhlIHdvcmtzcGFjZSByb290LlxuICAgICAgICAvLyBVbnRpbCB0aGVuIHdlIHByZXRlbmQgdGhlIGFwcCByb290IGlzIHJlbGF0aXZlIChgYCkgYnV0IHRoZSBzYW1lIGFzIGBwcm9qZWN0Um9vdGAuXG4gICAgICAgIGthcm1hT3B0aW9ucy5idWlsZFdlYnBhY2sub3B0aW9ucy5yb290ID0gJyc7XG5cbiAgICAgICAgLy8gQXNzaWduIGFkZGl0aW9uYWwga2FybWFDb25maWcgb3B0aW9ucyB0byB0aGUgbG9jYWwgbmdhcHAgY29uZmlnXG4gICAgICAgIGthcm1hT3B0aW9ucy5jb25maWdGaWxlID0ga2FybWFDb25maWc7XG5cbiAgICAgICAgLy8gQ29tcGxldGUgdGhlIG9ic2VydmFibGUgb25jZSB0aGUgS2FybWEgc2VydmVyIHJldHVybnMuXG4gICAgICAgIGNvbnN0IGthcm1hU2VydmVyID0gbmV3IGthcm1hLlNlcnZlcihrYXJtYU9wdGlvbnMsICgpID0+IG9icy5jb21wbGV0ZSgpKTtcbiAgICAgICAga2FybWFTZXJ2ZXIuc3RhcnQoKTtcblxuICAgICAgICAvLyBDbGVhbnVwLCBzaWduYWwgS2FybWEgdG8gZXhpdC5cbiAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICAvLyBLYXJtYSBkb2VzIG5vdCBzZWVtIHRvIGhhdmUgYSB3YXkgdG8gZXhpdCB0aGUgc2VydmVyIGdyYWNlZnVsbHkuXG4gICAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9rYXJtYS1ydW5uZXIva2FybWEvaXNzdWVzLzI4NjcjaXNzdWVjb21tZW50LTM2OTkxMjE2N1xuICAgICAgICAgIC8vIFRPRE86IG1ha2UgYSBQUiBmb3Iga2FybWEgdG8gYWRkIGBrYXJtYVNlcnZlci5jbG9zZShjb2RlKWAsIHRoYXRcbiAgICAgICAgICAvLyBjYWxscyBgZGlzY29ubmVjdEJyb3dzZXJzKGNvZGUpO2BcbiAgICAgICAgICAvLyBrYXJtYVNlcnZlci5jbG9zZSgpO1xuICAgICAgICB9O1xuICAgICAgfSkpLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIF9idWlsZFdlYnBhY2tDb25maWcoXG4gICAgcm9vdDogUGF0aCxcbiAgICBwcm9qZWN0Um9vdDogUGF0aCxcbiAgICBzb3VyY2VSb290OiBQYXRoIHwgdW5kZWZpbmVkLFxuICAgIGhvc3Q6IHZpcnR1YWxGcy5Ib3N0PGZzLlN0YXRzPixcbiAgICBvcHRpb25zOiBOb3JtYWxpemVkS2FybWFCdWlsZGVyU2NoZW1hLFxuICApIHtcbiAgICBsZXQgd2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucztcblxuICAgIGNvbnN0IHRzQ29uZmlnUGF0aCA9IGdldFN5c3RlbVBhdGgocmVzb2x2ZShyb290LCBub3JtYWxpemUob3B0aW9ucy50c0NvbmZpZykpKTtcbiAgICBjb25zdCB0c0NvbmZpZyA9IHJlYWRUc2NvbmZpZyh0c0NvbmZpZ1BhdGgpO1xuXG4gICAgY29uc3QgcHJvamVjdFRzID0gcmVxdWlyZVByb2plY3RNb2R1bGUoZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksICd0eXBlc2NyaXB0JykgYXMgdHlwZW9mIHRzO1xuXG4gICAgY29uc3Qgc3VwcG9ydEVTMjAxNSA9IHRzQ29uZmlnLm9wdGlvbnMudGFyZ2V0ICE9PSBwcm9qZWN0VHMuU2NyaXB0VGFyZ2V0LkVTM1xuICAgICAgJiYgdHNDb25maWcub3B0aW9ucy50YXJnZXQgIT09IHByb2plY3RUcy5TY3JpcHRUYXJnZXQuRVM1O1xuXG4gICAgY29uc3QgY29tcGF0T3B0aW9uczogdHlwZW9mIHdjb1snYnVpbGRPcHRpb25zJ10gPSB7XG4gICAgICAuLi5vcHRpb25zIGFzIHt9IGFzIHR5cGVvZiB3Y29bJ2J1aWxkT3B0aW9ucyddLFxuICAgICAgLy8gU29tZSBhc3NldCBsb2dpYyBpbnNpZGUgZ2V0Q29tbW9uQ29uZmlnIG5lZWRzIG91dHB1dFBhdGggdG8gYmUgc2V0LlxuICAgICAgb3V0cHV0UGF0aDogJycsXG4gICAgfTtcblxuICAgIHdjbyA9IHtcbiAgICAgIHJvb3Q6IGdldFN5c3RlbVBhdGgocm9vdCksXG4gICAgICBwcm9qZWN0Um9vdDogZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksXG4gICAgICBzb3VyY2VSb290OiBzb3VyY2VSb290ICYmIGdldFN5c3RlbVBhdGgoc291cmNlUm9vdCksXG4gICAgICAvLyBUT0RPOiB1c2Ugb25seSB0aGlzLm9wdGlvbnMsIGl0IGNvbnRhaW5zIGFsbCBmbGFncyBhbmQgY29uZmlncyBpdGVtcyBhbHJlYWR5LlxuICAgICAgYnVpbGRPcHRpb25zOiBjb21wYXRPcHRpb25zLFxuICAgICAgdHNDb25maWcsXG4gICAgICB0c0NvbmZpZ1BhdGgsXG4gICAgICBzdXBwb3J0RVMyMDE1LFxuICAgIH07XG5cbiAgICB3Y28uYnVpbGRPcHRpb25zLnByb2dyZXNzID0gZGVmYXVsdFByb2dyZXNzKHdjby5idWlsZE9wdGlvbnMucHJvZ3Jlc3MpO1xuXG4gICAgY29uc3Qgd2VicGFja0NvbmZpZ3M6IHt9W10gPSBbXG4gICAgICBnZXRDb21tb25Db25maWcod2NvKSxcbiAgICAgIGdldFN0eWxlc0NvbmZpZyh3Y28pLFxuICAgICAgZ2V0Tm9uQW90VGVzdENvbmZpZyh3Y28sIGhvc3QpLFxuICAgICAgZ2V0VGVzdENvbmZpZyh3Y28pLFxuICAgIF07XG5cbiAgICByZXR1cm4gd2VicGFja01lcmdlKHdlYnBhY2tDb25maWdzKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBLYXJtYUJ1aWxkZXI7XG4iXX0=