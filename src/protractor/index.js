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
const fromPromise_1 = require("rxjs/observable/fromPromise");
const of_1 = require("rxjs/observable/of");
const operators_1 = require("rxjs/operators");
const url = require("url");
const require_project_module_1 = require("../angular-cli-files/utilities/require-project-module");
const utils_1 = require("../utils");
class ProtractorBuilder {
    constructor(context) {
        this.context = context;
    }
    run(builderConfig) {
        const options = builderConfig.options;
        const root = this.context.workspace.root;
        const projectRoot = core_1.resolve(root, builderConfig.root);
        // const projectSystemRoot = getSystemPath(projectRoot);
        // TODO: verify using of(null) to kickstart things is a pattern.
        return of_1.of(null).pipe(operators_1.concatMap(() => options.devServerTarget ? this._startDevServer(options) : of_1.of(null)), operators_1.concatMap(() => options.webdriverUpdate ? this._updateWebdriver(projectRoot) : of_1.of(null)), operators_1.concatMap(() => this._runProtractor(root, options)), operators_1.take(1));
    }
    // Note: this method mutates the options argument.
    _startDevServer(options) {
        const architect = this.context.architect;
        const [project, targetName, configuration] = options.devServerTarget.split(':');
        // Override browser build watch setting.
        const overrides = { watch: false, host: options.host, port: options.port };
        const targetSpec = { project, target: targetName, configuration, overrides };
        const builderConfig = architect.getBuilderConfiguration(targetSpec);
        let devServerDescription;
        let baseUrl;
        return architect.getBuilderDescription(builderConfig).pipe(operators_1.tap(description => devServerDescription = description), operators_1.concatMap(devServerDescription => architect.validateBuilderOptions(builderConfig, devServerDescription)), operators_1.concatMap(() => {
            // Compute baseUrl from devServerOptions.
            if (options.devServerTarget && builderConfig.options.publicHost) {
                let publicHost = builderConfig.options.publicHost;
                if (!/^\w+:\/\//.test(publicHost)) {
                    publicHost = `${builderConfig.options.ssl
                        ? 'https'
                        : 'http'}://${publicHost}`;
                }
                const clientUrl = url.parse(publicHost);
                baseUrl = url.format(clientUrl);
            }
            else if (options.devServerTarget) {
                baseUrl = url.format({
                    protocol: builderConfig.options.ssl ? 'https' : 'http',
                    hostname: options.host,
                    port: builderConfig.options.port.toString(),
                });
            }
            // Save the computed baseUrl back so that Protractor can use it.
            options.baseUrl = baseUrl;
            return of_1.of(this.context.architect.getBuilder(devServerDescription, this.context));
        }), operators_1.concatMap(builder => builder.run(builderConfig)));
    }
    _updateWebdriver(projectRoot) {
        // The webdriver-manager update command can only be accessed via a deep import.
        const webdriverDeepImport = 'webdriver-manager/built/lib/cmds/update';
        let webdriverUpdate; // tslint:disable-line:no-any
        try {
            // When using npm, webdriver is within protractor/node_modules.
            webdriverUpdate = require_project_module_1.requireProjectModule(core_1.getSystemPath(projectRoot), `protractor/node_modules/${webdriverDeepImport}`);
        }
        catch (e) {
            try {
                // When using yarn, webdriver is found as a root module.
                webdriverUpdate = require_project_module_1.requireProjectModule(core_1.getSystemPath(projectRoot), webdriverDeepImport);
            }
            catch (e) {
                throw new Error(core_1.tags.stripIndents `
          Cannot automatically find webdriver-manager to update.
          Update webdriver-manager manually and run 'ng e2e --no-webdriver-update' instead.
        `);
            }
        }
        // run `webdriver-manager update --standalone false --gecko false --quiet`
        // if you change this, update the command comment in prev line, and in `eject` task
        return fromPromise_1.fromPromise(webdriverUpdate.program.run({
            standalone: false,
            gecko: false,
            quiet: true,
        }));
    }
    _runProtractor(root, options) {
        const additionalProtractorConfig = {
            elementExplorer: options.elementExplorer,
            baseUrl: options.baseUrl,
            spec: options.specs.length ? options.specs : undefined,
            suite: options.suite,
        };
        // TODO: Protractor manages process.exit itself, so this target will allways quit the
        // process. To work around this we run it in a subprocess.
        // https://github.com/angular/protractor/issues/4160
        return utils_1.runModuleAsObservableFork(root, 'protractor/built/launcher', 'init', [
            core_1.getSystemPath(core_1.resolve(root, core_1.normalize(options.protractorConfig))),
            additionalProtractorConfig,
        ]);
    }
}
exports.ProtractorBuilder = ProtractorBuilder;
exports.default = ProtractorBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Byb3RyYWN0b3IvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFTSCwrQ0FBcUY7QUFFckYsNkRBQTBEO0FBQzFELDJDQUF3QztBQUN4Qyw4Q0FBc0Q7QUFDdEQsMkJBQTJCO0FBQzNCLGtHQUE2RjtBQUU3RixvQ0FBcUQ7QUFlckQ7SUFFRSxZQUFtQixPQUF1QjtRQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtJQUFJLENBQUM7SUFFL0MsR0FBRyxDQUFDLGFBQTZEO1FBRS9ELE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7UUFDdEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3pDLE1BQU0sV0FBVyxHQUFHLGNBQU8sQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELHdEQUF3RDtRQUV4RCxnRUFBZ0U7UUFDaEUsTUFBTSxDQUFDLE9BQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQ2xCLHFCQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQ25GLHFCQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsRUFDeEYscUJBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUks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LEVBQUUsT0FBTyxDQUFDLEtBQUs7U0FDckIsQ0FBQztRQUVGLHFGQUFxRjtRQUNyRiwwREFBMEQ7UUFDMUQsb0RBQW9EO1FBQ3BELE1BQU0sQ0FBQyxpQ0FBeUIsQ0FDOUIsSUFBSSxFQUNKLDJCQUEyQixFQUMzQixNQUFNLEVBQ047WUFDRSxvQkFBYSxDQUFDLGNBQU8sQ0FBQyxJQUFJLEVBQUUsZ0JBQVMsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO1lBQ2pFLDBCQUEwQjtTQUMzQixDQUNGLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFsSEQsOENBa0hDO0FBRUQsa0JBQWUsaUJBQWlCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnQsXG4gIEJ1aWxkZXIsXG4gIEJ1aWxkZXJDb25maWd1cmF0aW9uLFxuICBCdWlsZGVyQ29udGV4dCxcbiAgQnVpbGRlckRlc2NyaXB0aW9uLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IFBhdGgsIGdldFN5c3RlbVBhdGgsIG5vcm1hbGl6ZSwgcmVzb2x2ZSwgdGFncyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IE9ic2VydmFibGUgfSBmcm9tICdyeGpzL09ic2VydmFibGUnO1xuaW1wb3J0IHsgZnJvbVByb21pc2UgfSBmcm9tICdyeGpzL29ic2VydmFibGUvZnJvbVByb21pc2UnO1xuaW1wb3J0IHsgb2YgfSBmcm9tICdyeGpzL29ic2VydmFibGUvb2YnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCB0YWtlLCB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcbmltcG9ydCB7IHJlcXVpcmVQcm9qZWN0TW9kdWxlIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3JlcXVpcmUtcHJvamVjdC1tb2R1bGUnO1xuaW1wb3J0IHsgRGV2U2VydmVyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuLi9kZXYtc2VydmVyJztcbmltcG9ydCB7IHJ1bk1vZHVsZUFzT2JzZXJ2YWJsZUZvcmsgfSBmcm9tICcuLi91dGlscyc7XG5cblxuZXhwb3J0IGludGVyZmFjZSBQcm90cmFjdG9yQnVpbGRlck9wdGlvbnMge1xuICBwcm90cmFjdG9yQ29uZmlnOiBzdHJpbmc7XG4gIGRldlNlcnZlclRhcmdldD86IHN0cmluZztcbiAgc3BlY3M6IHN0cmluZ1tdO1xuICBzdWl0ZT86IHN0cmluZztcbiAgZWxlbWVudEV4cGxvcmVyOiBib29sZWFuO1xuICB3ZWJkcml2ZXJVcGRhdGU6IGJvb2xlYW47XG4gIHBvcnQ/OiBudW1iZXI7XG4gIGhvc3Q6IHN0cmluZztcbiAgYmFzZVVybDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgUHJvdHJhY3RvckJ1aWxkZXIgaW1wbGVtZW50cyBCdWlsZGVyPFByb3RyYWN0b3JCdWlsZGVyT3B0aW9ucz4ge1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkgeyB9XG5cbiAgcnVuKGJ1aWxkZXJDb25maWc6IEJ1aWxkZXJDb25maWd1cmF0aW9uPFByb3RyYWN0b3JCdWlsZGVyT3B0aW9ucz4pOiBPYnNlcnZhYmxlPEJ1aWxkRXZlbnQ+IHtcblxuICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnM7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdDtcbiAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5yb290KTtcbiAgICAvLyBjb25zdCBwcm9qZWN0U3lzdGVtUm9vdCA9IGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpO1xuXG4gICAgLy8gVE9ETzogdmVyaWZ5IHVzaW5nIG9mKG51bGwpIHRvIGtpY2tzdGFydCB0aGluZ3MgaXMgYSBwYXR0ZXJuLlxuICAgIHJldHVybiBvZihudWxsKS5waXBlKFxuICAgICAgY29uY2F0TWFwKCgpID0+IG9wdGlvbnMuZGV2U2VydmVyVGFyZ2V0ID8gdGhpcy5fc3RhcnREZXZTZXJ2ZXIob3B0aW9ucykgOiBvZihudWxsKSksXG4gICAgICBjb25jYXRNYXAoKCkgPT4gb3B0aW9ucy53ZWJkcml2ZXJVcGRhdGUgPyB0aGlzLl91cGRhdGVXZWJkcml2ZXIocHJvamVjdFJvb3QpIDogb2YobnVsbCkpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IHRoaXMuX3J1blByb3RyYWN0b3Iocm9vdCwgb3B0aW9ucykpLFxuICAgICAgdGFrZSgxKSxcbiAgICApO1xuICB9XG5cbiAgLy8gTm90ZTogdGhpcyBtZXRob2QgbXV0YXRlcyB0aGUgb3B0aW9ucyBhcmd1bWVudC5cbiAgcHJpdmF0ZSBfc3RhcnREZXZTZXJ2ZXIob3B0aW9uczogUHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zKSB7XG4gICAgY29uc3QgYXJjaGl0ZWN0ID0gdGhpcy5jb250ZXh0LmFyY2hpdGVjdDtcbiAgICBjb25zdCBbcHJvamVjdCwgdGFyZ2V0TmFtZSwgY29uZmlndXJhdGlvbl0gPSAob3B0aW9ucy5kZXZTZXJ2ZXJUYXJnZXQgYXMgc3RyaW5nKS5zcGxpdCgnOicpO1xuICAgIC8vIE92ZXJyaWRlIGJyb3dzZXIgYnVpbGQgd2F0Y2ggc2V0dGluZy5cbiAgICBjb25zdCBvdmVycmlkZXMgPSB7IHdhdGNoOiBmYWxzZSwgaG9zdDogb3B0aW9ucy5ob3N0LCBwb3J0OiBvcHRpb25zLnBvcnQgfTtcbiAgICBjb25zdCB0YXJnZXRTcGVjID0geyBwcm9qZWN0LCB0YXJnZXQ6IHRhcmdldE5hbWUsIGNvbmZpZ3VyYXRpb24sIG92ZXJyaWRlcyB9O1xuICAgIGNvbnN0IGJ1aWxkZXJDb25maWcgPSBhcmNoaXRlY3QuZ2V0QnVpbGRlckNvbmZpZ3VyYXRpb248RGV2U2VydmVyQnVpbGRlck9wdGlvbnM+KHRhcmdldFNwZWMpO1xuICAgIGxldCBkZXZTZXJ2ZXJEZXNjcmlwdGlvbjogQnVpbGRlckRlc2NyaXB0aW9uO1xuICAgIGxldCBiYXNlVXJsOiBzdHJpbmc7XG5cbiAgICByZXR1cm4gYXJjaGl0ZWN0LmdldEJ1aWxkZXJEZXNjcmlwdGlvbihidWlsZGVyQ29uZmlnKS5waXBlKFxuICAgICAgdGFwKGRlc2NyaXB0aW9uID0+IGRldlNlcnZlckRlc2NyaXB0aW9uID0gZGVzY3JpcHRpb24pLFxuICAgICAgY29uY2F0TWFwKGRldlNlcnZlckRlc2NyaXB0aW9uID0+IGFyY2hpdGVjdC52YWxpZGF0ZUJ1aWxkZXJPcHRpb25zKFxuICAgICAgICBidWlsZGVyQ29uZmlnLCBkZXZTZXJ2ZXJEZXNjcmlwdGlvbikpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IHtcbiAgICAgICAgLy8gQ29tcHV0ZSBiYXNlVXJsIGZyb20gZGV2U2VydmVyT3B0aW9ucy5cbiAgICAgICAgaWYgKG9wdGlvbnMuZGV2U2VydmVyVGFyZ2V0ICYmIGJ1aWxkZXJDb25maWcub3B0aW9ucy5wdWJsaWNIb3N0KSB7XG4gICAgICAgICAgbGV0IHB1YmxpY0hvc3QgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnMucHVibGljSG9zdDtcbiAgICAgICAgICBpZiAoIS9eXFx3KzpcXC9cXC8vLnRlc3QocHVibGljSG9zdCkpIHtcbiAgICAgICAgICAgIHB1YmxpY0hvc3QgPSBgJHtidWlsZGVyQ29uZmlnLm9wdGlvbnMuc3NsXG4gICAgICAgICAgICAgID8gJ2h0dHBzJ1xuICAgICAgICAgICAgICA6ICdodHRwJ306Ly8ke3B1YmxpY0hvc3R9YDtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgY2xpZW50VXJsID0gdXJsLnBhcnNlKHB1YmxpY0hvc3QpO1xuICAgICAgICAgIGJhc2VVcmwgPSB1cmwuZm9ybWF0KGNsaWVudFVybCk7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5kZXZTZXJ2ZXJUYXJnZXQpIHtcbiAgICAgICAgICBiYXNlVXJsID0gdXJsLmZvcm1hdCh7XG4gICAgICAgICAgICBwcm90b2NvbDogYnVpbGRlckNvbmZpZy5vcHRpb25zLnNzbCA/ICdodHRwcycgOiAnaHR0cCcsXG4gICAgICAgICAgICBob3N0bmFtZTogb3B0aW9ucy5ob3N0LFxuICAgICAgICAgICAgcG9ydDogYnVpbGRlckNvbmZpZy5vcHRpb25zLnBvcnQudG9TdHJpbmcoKSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNhdmUgdGhlIGNvbXB1dGVkIGJhc2VVcmwgYmFjayBzbyB0aGF0IFByb3RyYWN0b3IgY2FuIHVzZSBpdC5cbiAgICAgICAgb3B0aW9ucy5iYXNlVXJsID0gYmFzZVVybDtcblxuICAgICAgICByZXR1cm4gb2YodGhpcy5jb250ZXh0LmFyY2hpdGVjdC5nZXRCdWlsZGVyKGRldlNlcnZlckRlc2NyaXB0aW9uLCB0aGlzLmNvbnRleHQpKTtcbiAgICAgIH0pLFxuICAgICAgY29uY2F0TWFwKGJ1aWxkZXIgPT4gYnVpbGRlci5ydW4oYnVpbGRlckNvbmZpZykpLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIF91cGRhdGVXZWJkcml2ZXIocHJvamVjdFJvb3Q6IFBhdGgpIHtcbiAgICAvLyBUaGUgd2ViZHJpdmVyLW1hbmFnZXIgdXBkYXRlIGNvbW1hbmQgY2FuIG9ubHkgYmUgYWNjZXNzZWQgdmlhIGEgZGVlcCBpbXBvcnQuXG4gICAgY29uc3Qgd2ViZHJpdmVyRGVlcEltcG9ydCA9ICd3ZWJkcml2ZXItbWFuYWdlci9idWlsdC9saWIvY21kcy91cGRhdGUnO1xuICAgIGxldCB3ZWJkcml2ZXJVcGRhdGU6IGFueTsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1hbnlcblxuICAgIHRyeSB7XG4gICAgICAvLyBXaGVuIHVzaW5nIG5wbSwgd2ViZHJpdmVyIGlzIHdpdGhpbiBwcm90cmFjdG9yL25vZGVfbW9kdWxlcy5cbiAgICAgIHdlYmRyaXZlclVwZGF0ZSA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLFxuICAgICAgICBgcHJvdHJhY3Rvci9ub2RlX21vZHVsZXMvJHt3ZWJkcml2ZXJEZWVwSW1wb3J0fWApO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIFdoZW4gdXNpbmcgeWFybiwgd2ViZHJpdmVyIGlzIGZvdW5kIGFzIGEgcm9vdCBtb2R1bGUuXG4gICAgICAgIHdlYmRyaXZlclVwZGF0ZSA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLCB3ZWJkcml2ZXJEZWVwSW1wb3J0KTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgICAgIENhbm5vdCBhdXRvbWF0aWNhbGx5IGZpbmQgd2ViZHJpdmVyLW1hbmFnZXIgdG8gdXBkYXRlLlxuICAgICAgICAgIFVwZGF0ZSB3ZWJkcml2ZXItbWFuYWdlciBtYW51YWxseSBhbmQgcnVuICduZyBlMmUgLS1uby13ZWJkcml2ZXItdXBkYXRlJyBpbnN0ZWFkLlxuICAgICAgICBgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBydW4gYHdlYmRyaXZlci1tYW5hZ2VyIHVwZGF0ZSAtLXN0YW5kYWxvbmUgZmFsc2UgLS1nZWNrbyBmYWxzZSAtLXF1aWV0YFxuICAgIC8vIGlmIHlvdSBjaGFuZ2UgdGhpcywgdXBkYXRlIHRoZSBjb21tYW5kIGNvbW1lbnQgaW4gcHJldiBsaW5lLCBhbmQgaW4gYGVqZWN0YCB0YXNrXG4gICAgcmV0dXJuIGZyb21Qcm9taXNlKHdlYmRyaXZlclVwZGF0ZS5wcm9ncmFtLnJ1bih7XG4gICAgICBzdGFuZGFsb25lOiBmYWxzZSxcbiAgICAgIGdlY2tvOiBmYWxzZSxcbiAgICAgIHF1aWV0OiB0cnVlLFxuICAgIH0pKTtcbiAgfVxuXG4gIHByaXZhdGUgX3J1blByb3RyYWN0b3Iocm9vdDogUGF0aCwgb3B0aW9uczogUHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zKTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG4gICAgY29uc3QgYWRkaXRpb25hbFByb3RyYWN0b3JDb25maWcgPSB7XG4gICAgICBlbGVtZW50RXhwbG9yZXI6IG9wdGlvbnMuZWxlbWVudEV4cGxvcmVyLFxuICAgICAgYmFzZVVybDogb3B0aW9ucy5iYXNlVXJsLFxuICAgICAgc3BlYzogb3B0aW9ucy5zcGVjcy5sZW5ndGggPyBvcHRpb25zLnNwZWNzIDogdW5kZWZpbmVkLFxuICAgICAgc3VpdGU6IG9wdGlvbnMuc3VpdGUsXG4gICAgfTtcblxuICAgIC8vIFRPRE86IFByb3RyYWN0b3IgbWFuYWdlcyBwcm9jZXNzLmV4aXQgaXRzZWxmLCBzbyB0aGlzIHRhcmdldCB3aWxsIGFsbHdheXMgcXVpdCB0aGVcbiAgICAvLyBwcm9jZXNzLiBUbyB3b3JrIGFyb3VuZCB0aGlzIHdlIHJ1biBpdCBpbiBhIHN1YnByb2Nlc3MuXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvcHJvdHJhY3Rvci9pc3N1ZXMvNDE2MFxuICAgIHJldHVybiBydW5Nb2R1bGVBc09ic2VydmFibGVGb3JrKFxuICAgICAgcm9vdCxcbiAgICAgICdwcm90cmFjdG9yL2J1aWx0L2xhdW5jaGVyJyxcbiAgICAgICdpbml0JyxcbiAgICAgIFtcbiAgICAgICAgZ2V0U3lzdGVtUGF0aChyZXNvbHZlKHJvb3QsIG5vcm1hbGl6ZShvcHRpb25zLnByb3RyYWN0b3JDb25maWcpKSksXG4gICAgICAgIGFkZGl0aW9uYWxQcm90cmFjdG9yQ29uZmlnLFxuICAgICAgXSxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByb3RyYWN0b3JCdWlsZGVyO1xuIl19