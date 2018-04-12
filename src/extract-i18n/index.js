"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular-devkit/core");
const path = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const webpack = require("webpack");
const webpack_configs_1 = require("../angular-cli-files/models/webpack-configs");
const utils_1 = require("../angular-cli-files/models/webpack-configs/utils");
const read_tsconfig_1 = require("../angular-cli-files/utilities/read-tsconfig");
const stats_1 = require("../angular-cli-files/utilities/stats");
const MemoryFS = require('memory-fs');
const webpackMerge = require('webpack-merge');
class ExtractI18nBuilder {
    constructor(context) {
        this.context = context;
    }
    run(builderConfig) {
        const architect = this.context.architect;
        const options = builderConfig.options;
        const root = this.context.workspace.root;
        const projectRoot = core_1.resolve(root, builderConfig.root);
        const [project, targetName, configuration] = options.browserTarget.split(':');
        // Override browser build watch setting.
        const overrides = { watch: false };
        const browserTargetSpec = { project, target: targetName, configuration, overrides };
        const browserBuilderConfig = architect.getBuilderConfiguration(browserTargetSpec);
        return architect.getBuilderDescription(browserBuilderConfig).pipe(operators_1.concatMap(browserDescription => architect.validateBuilderOptions(browserBuilderConfig, browserDescription)), operators_1.map(browserBuilderConfig => browserBuilderConfig.options), operators_1.concatMap((validatedBrowserOptions) => new rxjs_1.Observable(obs => {
            const browserOptions = validatedBrowserOptions;
            // We need to determine the outFile name so that AngularCompiler can retrieve it.
            let outFile = options.outFile || getI18nOutfile(options.i18nFormat);
            if (options.outputPath) {
                // AngularCompilerPlugin doesn't support genDir so we have to adjust outFile instead.
                outFile = path.join(options.outputPath, outFile);
            }
            // Extracting i18n uses the browser target webpack config with some specific options.
            const webpackConfig = this.buildWebpackConfig(root, projectRoot, Object.assign({}, browserOptions, { optimization: false, i18nLocale: options.i18nLocale, i18nFormat: options.i18nFormat, i18nFile: outFile, aot: true, assets: [], scripts: [], styles: [] }));
            const webpackCompiler = webpack(webpackConfig);
            webpackCompiler.outputFileSystem = new MemoryFS();
            const statsConfig = utils_1.getWebpackStatsConfig();
            const callback = (err, stats) => {
                if (err) {
                    return obs.error(err);
                }
                const json = stats.toJson('verbose');
                if (stats.hasWarnings()) {
                    this.context.logger.warn(stats_1.statsWarningsToString(json, statsConfig));
                }
                if (stats.hasErrors()) {
                    this.context.logger.error(stats_1.statsErrorsToString(json, statsConfig));
                }
                obs.next({ success: !stats.hasErrors() });
                obs.complete();
            };
            try {
                webpackCompiler.run(callback);
            }
            catch (err) {
                if (err) {
                    this.context.logger.error('\nAn error occured during the extraction:\n' + ((err && err.stack) || err));
                }
                throw err;
            }
        })));
    }
    buildWebpackConfig(root, projectRoot, options) {
        let wco;
        const host = new core_1.virtualFs.AliasHost(this.context.host);
        const tsConfigPath = core_1.getSystemPath(core_1.normalize(core_1.resolve(root, core_1.normalize(options.tsConfig))));
        const tsConfig = read_tsconfig_1.readTsconfig(tsConfigPath);
        wco = {
            root: core_1.getSystemPath(root),
            projectRoot: core_1.getSystemPath(projectRoot),
            // TODO: use only this.options, it contains all flags and configs items already.
            buildOptions: options,
            tsConfig,
            tsConfigPath,
            supportES2015: false,
        };
        const webpackConfigs = [
            webpack_configs_1.getCommonConfig(wco),
            webpack_configs_1.getAotConfig(wco, host, true),
            webpack_configs_1.getStylesConfig(wco),
        ];
        return webpackMerge(webpackConfigs);
    }
}
exports.ExtractI18nBuilder = ExtractI18nBuilder;
function getI18nOutfile(format) {
    switch (format) {
        case 'xmb':
            return 'messages.xmb';
        case 'xlf':
        case 'xlif':
        case 'xliff':
        case 'xlf2':
        case 'xliff2':
            return 'messages.xlf';
        default:
            throw new Error(`Unsupported format "${format}"`);
    }
}
exports.default = ExtractI18nBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2V4dHJhY3QtaTE4bi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWFBLCtDQUEwRjtBQUUxRiw2QkFBNkI7QUFDN0IsK0JBQWtDO0FBQ2xDLDhDQUFnRDtBQUNoRCxtQ0FBbUM7QUFFbkMsaUZBSXFEO0FBQ3JELDZFQUEwRjtBQUMxRixnRkFBNEU7QUFDNUUsZ0VBQWtHO0FBRWxHLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUN0QyxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFXOUM7SUFFRSxZQUFtQixPQUF1QjtRQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtJQUFJLENBQUM7SUFFL0MsR0FBRyxDQUFDLGFBQThEO1FBQ2hFLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDO1FBQ3pDLE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7UUFDdEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3pDLE1BQU0sV0FBVyxHQUFHLGNBQU8sQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELE1BQU0sQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzlFLHdDQUF3QztRQUN4QyxNQUFNLFNBQVMsR0FBRyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsQ0FBQztRQUVuQyxNQUFNLGlCQUFpQixHQUFHLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLFNBQVMsRUFBRSxD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QztJQUN0QyxDQUFDO0NBQ0Y7QUE5R0QsZ0RBOEdDO0FBRUQsd0JBQXdCLE1BQWM7SUFDcEMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUNmLEtBQUssS0FBSztZQUNSLE1BQU0sQ0FBQyxjQUFjLENBQUM7UUFDeEIsS0FBSyxLQUFLLENBQUM7UUFDWCxLQUFLLE1BQU0sQ0FBQztRQUNaLEtBQUssT0FBTyxDQUFDO1FBQ2IsS0FBSyxNQUFNLENBQUM7UUFDWixLQUFLLFFBQVE7WUFDWCxNQUFNLENBQUMsY0FBYyxDQUFDO1FBQ3hCO1lBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUN0RCxDQUFDO0FBQ0gsQ0FBQztBQUVELGtCQUFlLGtCQUFrQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtcbiAgQnVpbGRFdmVudCxcbiAgQnVpbGRlcixcbiAgQnVpbGRlckNvbmZpZ3VyYXRpb24sXG4gIEJ1aWxkZXJDb250ZXh0LFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IFBhdGgsIGdldFN5c3RlbVBhdGgsIG5vcm1hbGl6ZSwgcmVzb2x2ZSwgdmlydHVhbEZzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0ICogYXMgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHtcbiAgZ2V0QW90Q29uZmlnLFxuICBnZXRDb21tb25Db25maWcsXG4gIGdldFN0eWxlc0NvbmZpZyxcbn0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncyc7XG5pbXBvcnQgeyBnZXRXZWJwYWNrU3RhdHNDb25maWcgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3V0aWxzJztcbmltcG9ydCB7IHJlYWRUc2NvbmZpZyB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9yZWFkLXRzY29uZmlnJztcbmltcG9ydCB7IHN0YXRzRXJyb3JzVG9TdHJpbmcsIHN0YXRzV2FybmluZ3NUb1N0cmluZyB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9zdGF0cyc7XG5pbXBvcnQgeyBCcm93c2VyQnVpbGRlclNjaGVtYSB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmNvbnN0IE1lbW9yeUZTID0gcmVxdWlyZSgnbWVtb3J5LWZzJyk7XG5jb25zdCB3ZWJwYWNrTWVyZ2UgPSByZXF1aXJlKCd3ZWJwYWNrLW1lcmdlJyk7XG5cblxuZXhwb3J0IGludGVyZmFjZSBFeHRyYWN0STE4bkJ1aWxkZXJPcHRpb25zIHtcbiAgYnJvd3NlclRhcmdldDogc3RyaW5nO1xuICBpMThuRm9ybWF0OiBzdHJpbmc7XG4gIGkxOG5Mb2NhbGU6IHN0cmluZztcbiAgb3V0cHV0UGF0aD86IHN0cmluZztcbiAgb3V0RmlsZT86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEV4dHJhY3RJMThuQnVpbGRlciBpbXBsZW1lbnRzIEJ1aWxkZXI8RXh0cmFjdEkxOG5CdWlsZGVyT3B0aW9ucz4ge1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkgeyB9XG5cbiAgcnVuKGJ1aWxkZXJDb25maWc6IEJ1aWxkZXJDb25maWd1cmF0aW9uPEV4dHJhY3RJMThuQnVpbGRlck9wdGlvbnM+KTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG4gICAgY29uc3QgYXJjaGl0ZWN0ID0gdGhpcy5jb250ZXh0LmFyY2hpdGVjdDtcbiAgICBjb25zdCBvcHRpb25zID0gYnVpbGRlckNvbmZpZy5vcHRpb25zO1xuICAgIGNvbnN0IHJvb3QgPSB0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3Q7XG4gICAgY29uc3QgcHJvamVjdFJvb3QgPSByZXNvbHZlKHJvb3QsIGJ1aWxkZXJDb25maWcucm9vdCk7XG4gICAgY29uc3QgW3Byb2plY3QsIHRhcmdldE5hbWUsIGNvbmZpZ3VyYXRpb25dID0gb3B0aW9ucy5icm93c2VyVGFyZ2V0LnNwbGl0KCc6Jyk7XG4gICAgLy8gT3ZlcnJpZGUgYnJvd3NlciBidWlsZCB3YXRjaCBzZXR0aW5nLlxuICAgIGNvbnN0IG92ZXJyaWRlcyA9IHsgd2F0Y2g6IGZhbHNlIH07XG5cbiAgICBjb25zdCBicm93c2VyVGFyZ2V0U3BlYyA9IHsgcHJvamVjdCwgdGFyZ2V0OiB0YXJnZXROYW1lLCBjb25maWd1cmF0aW9uLCBvdmVycmlkZXMgfTtcbiAgICBjb25zdCBicm93c2VyQnVpbGRlckNvbmZpZyA9IGFyY2hpdGVjdC5nZXRCdWlsZGVyQ29uZmlndXJhdGlvbjxCcm93c2VyQnVpbGRlclNjaGVtYT4oXG4gICAgICBicm93c2VyVGFyZ2V0U3BlYyk7XG5cbiAgICByZXR1cm4gYXJjaGl0ZWN0LmdldEJ1aWxkZXJEZXNjcmlwdGlvbihicm93c2VyQnVpbGRlckNvbmZpZykucGlwZShcbiAgICAgIGNvbmNhdE1hcChicm93c2VyRGVzY3JpcHRpb24gPT5cbiAgICAgICAgYXJjaGl0ZWN0LnZhbGlkYXRlQnVpbGRlck9wdGlvbnMoYnJvd3NlckJ1aWxkZXJDb25maWcsIGJyb3dzZXJEZXNjcmlwdGlvbikpLFxuICAgICAgbWFwKGJyb3dzZXJCdWlsZGVyQ29uZmlnID0+IGJyb3dzZXJCdWlsZGVyQ29uZmlnLm9wdGlvbnMpLFxuICAgICAgY29uY2F0TWFwKCh2YWxpZGF0ZWRCcm93c2VyT3B0aW9ucykgPT4gbmV3IE9ic2VydmFibGUob2JzID0+IHtcbiAgICAgICAgY29uc3QgYnJvd3Nlck9wdGlvbnMgPSB2YWxpZGF0ZWRCcm93c2VyT3B0aW9ucztcblxuICAgICAgICAvLyBXZSBuZWVkIHRvIGRldGVybWluZSB0aGUgb3V0RmlsZSBuYW1lIHNvIHRoYXQgQW5ndWxhckNvbXBpbGVyIGNhbiByZXRyaWV2ZSBpdC5cbiAgICAgICAgbGV0IG91dEZpbGUgPSBvcHRpb25zLm91dEZpbGUgfHwgZ2V0STE4bk91dGZpbGUob3B0aW9ucy5pMThuRm9ybWF0KTtcbiAgICAgICAgaWYgKG9wdGlvbnMub3V0cHV0UGF0aCkge1xuICAgICAgICAgIC8vIEFuZ3VsYXJDb21waWxlclBsdWdpbiBkb2Vzbid0IHN1cHBvcnQgZ2VuRGlyIHNvIHdlIGhhdmUgdG8gYWRqdXN0IG91dEZpbGUgaW5zdGVhZC5cbiAgICAgICAgICBvdXRGaWxlID0gcGF0aC5qb2luKG9wdGlvbnMub3V0cHV0UGF0aCwgb3V0RmlsZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBFeHRyYWN0aW5nIGkxOG4gdXNlcyB0aGUgYnJvd3NlciB0YXJnZXQgd2VicGFjayBjb25maWcgd2l0aCBzb21lIHNwZWNpZmljIG9wdGlvbnMuXG4gICAgICAgIGNvbnN0IHdlYnBhY2tDb25maWcgPSB0aGlzLmJ1aWxkV2VicGFja0NvbmZpZyhyb290LCBwcm9qZWN0Um9vdCwge1xuICAgICAgICAgIC4uLmJyb3dzZXJPcHRpb25zLFxuICAgICAgICAgIG9wdGltaXphdGlvbjogZmFsc2UsXG4gICAgICAgICAgaTE4bkxvY2FsZTogb3B0aW9ucy5pMThuTG9jYWxlLFxuICAgICAgICAgIGkxOG5Gb3JtYXQ6IG9wdGlvbnMuaTE4bkZvcm1hdCxcbiAgICAgICAgICBpMThuRmlsZTogb3V0RmlsZSxcbiAgICAgICAgICBhb3Q6IHRydWUsXG4gICAgICAgICAgYXNzZXRzOiBbXSxcbiAgICAgICAgICBzY3JpcHRzOiBbXSxcbiAgICAgICAgICBzdHlsZXM6IFtdLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCB3ZWJwYWNrQ29tcGlsZXIgPSB3ZWJwYWNrKHdlYnBhY2tDb25maWcpO1xuICAgICAgICB3ZWJwYWNrQ29tcGlsZXIub3V0cHV0RmlsZVN5c3RlbSA9IG5ldyBNZW1vcnlGUygpO1xuICAgICAgICBjb25zdCBzdGF0c0NvbmZpZyA9IGdldFdlYnBhY2tTdGF0c0NvbmZpZygpO1xuXG4gICAgICAgIGNvbnN0IGNhbGxiYWNrOiB3ZWJwYWNrLmNvbXBpbGVyLkNvbXBpbGVyQ2FsbGJhY2sgPSAoZXJyLCBzdGF0cykgPT4ge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIHJldHVybiBvYnMuZXJyb3IoZXJyKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBqc29uID0gc3RhdHMudG9Kc29uKCd2ZXJib3NlJyk7XG4gICAgICAgICAgaWYgKHN0YXRzLmhhc1dhcm5pbmdzKCkpIHtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2FybihzdGF0c1dhcm5pbmdzVG9TdHJpbmcoanNvbiwgc3RhdHNDb25maWcpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoc3RhdHMuaGFzRXJyb3JzKCkpIHtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuZXJyb3Ioc3RhdHNFcnJvcnNUb1N0cmluZyhqc29uLCBzdGF0c0NvbmZpZykpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG9icy5uZXh0KHsgc3VjY2VzczogIXN0YXRzLmhhc0Vycm9ycygpIH0pO1xuXG4gICAgICAgICAgb2JzLmNvbXBsZXRlKCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB3ZWJwYWNrQ29tcGlsZXIucnVuKGNhbGxiYWNrKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5lcnJvcihcbiAgICAgICAgICAgICAgJ1xcbkFuIGVycm9yIG9jY3VyZWQgZHVyaW5nIHRoZSBleHRyYWN0aW9uOlxcbicgKyAoKGVyciAmJiBlcnIuc3RhY2spIHx8IGVycikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH0pKSxcbiAgICApO1xuICB9XG5cbiAgYnVpbGRXZWJwYWNrQ29uZmlnKFxuICAgIHJvb3Q6IFBhdGgsXG4gICAgcHJvamVjdFJvb3Q6IFBhdGgsXG4gICAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJTY2hlbWEsXG4gICkge1xuICAgIGxldCB3Y286IFdlYnBhY2tDb25maWdPcHRpb25zO1xuXG4gICAgY29uc3QgaG9zdCA9IG5ldyB2aXJ0dWFsRnMuQWxpYXNIb3N0KHRoaXMuY29udGV4dC5ob3N0IGFzIHZpcnR1YWxGcy5Ib3N0PGZzLlN0YXRzPik7XG5cbiAgICBjb25zdCB0c0NvbmZpZ1BhdGggPSBnZXRTeXN0ZW1QYXRoKG5vcm1hbGl6ZShyZXNvbHZlKHJvb3QsIG5vcm1hbGl6ZShvcHRpb25zLnRzQ29uZmlnKSkpKTtcbiAgICBjb25zdCB0c0NvbmZpZyA9IHJlYWRUc2NvbmZpZyh0c0NvbmZpZ1BhdGgpO1xuXG4gICAgd2NvID0ge1xuICAgICAgcm9vdDogZ2V0U3lzdGVtUGF0aChyb290KSxcbiAgICAgIHByb2plY3RSb290OiBnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSxcbiAgICAgIC8vIFRPRE86IHVzZSBvbmx5IHRoaXMub3B0aW9ucywgaXQgY29udGFpbnMgYWxsIGZsYWdzIGFuZCBjb25maWdzIGl0ZW1zIGFscmVhZHkuXG4gICAgICBidWlsZE9wdGlvbnM6IG9wdGlvbnMsXG4gICAgICB0c0NvbmZpZyxcbiAgICAgIHRzQ29uZmlnUGF0aCxcbiAgICAgIHN1cHBvcnRFUzIwMTU6IGZhbHNlLFxuICAgIH07XG5cbiAgICBjb25zdCB3ZWJwYWNrQ29uZmlnczoge31bXSA9IFtcbiAgICAgIGdldENvbW1vbkNvbmZpZyh3Y28pLFxuICAgICAgZ2V0QW90Q29uZmlnKHdjbywgaG9zdCwgdHJ1ZSksXG4gICAgICBnZXRTdHlsZXNDb25maWcod2NvKSxcbiAgICBdO1xuXG4gICAgcmV0dXJuIHdlYnBhY2tNZXJnZSh3ZWJwYWNrQ29uZmlncyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0STE4bk91dGZpbGUoZm9ybWF0OiBzdHJpbmcpIHtcbiAgc3dpdGNoIChmb3JtYXQpIHtcbiAgICBjYXNlICd4bWInOlxuICAgICAgcmV0dXJuICdtZXNzYWdlcy54bWInO1xuICAgIGNhc2UgJ3hsZic6XG4gICAgY2FzZSAneGxpZic6XG4gICAgY2FzZSAneGxpZmYnOlxuICAgIGNhc2UgJ3hsZjInOlxuICAgIGNhc2UgJ3hsaWZmMic6XG4gICAgICByZXR1cm4gJ21lc3NhZ2VzLnhsZic7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZm9ybWF0IFwiJHtmb3JtYXR9XCJgKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFeHRyYWN0STE4bkJ1aWxkZXI7XG4iXX0=