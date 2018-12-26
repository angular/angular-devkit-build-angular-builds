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
        return rxjs_1.of(null).pipe(operators_1.concatMap(() => options.devServerTarget ? this._startDevServer(options) : rxjs_1.of(null)), operators_1.concatMap(() => options.webdriverUpdate ? this._updateWebdriver(projectRoot) : rxjs_1.of(null)), operators_1.concatMap(() => this._runProtractor(root, options)), operators_1.take(1));
    }
    // Note: this method mutates the options argument.
    _startDevServer(options) {
        const architect = this.context.architect;
        const [project, targetName, configuration] = options.devServerTarget.split(':');
        // Override dev server watch setting.
        const overrides = { watch: false };
        // Also override the port and host if they are defined in protractor options.
        if (options.host !== undefined) {
            overrides.host = options.host;
        }
        if (options.port !== undefined) {
            overrides.port = options.port;
        }
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
            return rxjs_1.of(this.context.architect.getBuilder(devServerDescription, this.context));
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
        catch (_a) {
            try {
                // When using yarn, webdriver is found as a root module.
                webdriverUpdate = require_project_module_1.requireProjectModule(core_1.getSystemPath(projectRoot), webdriverDeepImport);
            }
            catch (_b) {
                throw new Error(core_1.tags.stripIndents `
          Cannot automatically find webdriver-manager to update.
          Update webdriver-manager manually and run 'ng e2e --no-webdriver-update' instead.
        `);
            }
        }
        // run `webdriver-manager update --standalone false --gecko false --quiet`
        // if you change this, update the command comment in prev line, and in `eject` task
        return rxjs_1.from(webdriverUpdate.program.run({
            standalone: false,
            gecko: false,
            quiet: true,
        }));
    }
    _runProtractor(root, options) {
        const additionalProtractorConfig = {
            elementExplorer: options.elementExplorer,
            baseUrl: options.baseUrl,
            specs: options.specs.length ? options.specs : undefined,
            suite: options.suite,
        };
        // TODO: Protractor manages process.exit itself, so this target will allways quit the
        // process. To work around this we run it in a subprocess.
        // https://github.com/angular/protractor/issues/4160
        return utils_1.runModuleAsObservableFork(core_1.getSystemPath(root), 'protractor/built/launcher', 'init', [
            core_1.getSystemPath(core_1.resolve(root, core_1.normalize(options.protractorConfig))),
            additionalProtractorConfig,
        ]);
    }
}
exports.ProtractorBuilder = ProtractorBuilder;
exports.default = ProtractorBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Byb3RyYWN0b3IvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFTSCwrQ0FBcUY7QUFDckYsK0JBQTRDO0FBQzVDLDhDQUFzRDtBQUN0RCwyQkFBMkI7QUFDM0Isa0dBQTZGO0FBRTdGLG9DQUFxRDtBQWVyRCxNQUFhLGlCQUFpQjtJQUU1QixZQUFtQixPQUF1QjtRQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtJQUFJLENBQUM7SUFFL0MsR0FBRyxDQUFDLGFBQTZEO1FBRS9ELE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7UUFDdEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3pDLE1BQU0sV0FBVyxHQUFHLGNBQU8sQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELHdEQUF3RDtRQUV4RCxnRUFBZ0U7UUFDaEUsT0FBTyxTQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUNsQixxQkFBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUNuRixxQkFBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQ3hGLHFCQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUs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QUMxRCxvREFBb0Q7UUFDcEQsT0FBTyxpQ0FBeUIsQ0FDOUIsb0JBQWEsQ0FBQyxJQUFJLENBQUMsRUFDbkIsMkJBQTJCLEVBQzNCLE1BQU0sRUFDTjtZQUNFLG9CQUFhLENBQUMsY0FBTyxDQUFDLElBQUksRUFBRSxnQkFBUyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7WUFDakUsMEJBQTBCO1NBQzNCLENBQ0YsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQXJIRCw4Q0FxSEM7QUFFRCxrQkFBZSxpQkFBaUIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgQnVpbGRFdmVudCxcbiAgQnVpbGRlcixcbiAgQnVpbGRlckNvbmZpZ3VyYXRpb24sXG4gIEJ1aWxkZXJDb250ZXh0LFxuICBCdWlsZGVyRGVzY3JpcHRpb24sXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgUGF0aCwgZ2V0U3lzdGVtUGF0aCwgbm9ybWFsaXplLCByZXNvbHZlLCB0YWdzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSwgb2YgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgdGFrZSwgdGFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0ICogYXMgdXJsIGZyb20gJ3VybCc7XG5pbXBvcnQgeyByZXF1aXJlUHJvamVjdE1vZHVsZSB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9yZXF1aXJlLXByb2plY3QtbW9kdWxlJztcbmltcG9ydCB7IERldlNlcnZlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi4vZGV2LXNlcnZlcic7XG5pbXBvcnQgeyBydW5Nb2R1bGVBc09ic2VydmFibGVGb3JrIH0gZnJvbSAnLi4vdXRpbHMnO1xuXG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zIHtcbiAgcHJvdHJhY3RvckNvbmZpZzogc3RyaW5nO1xuICBkZXZTZXJ2ZXJUYXJnZXQ/OiBzdHJpbmc7XG4gIHNwZWNzOiBzdHJpbmdbXTtcbiAgc3VpdGU/OiBzdHJpbmc7XG4gIGVsZW1lbnRFeHBsb3JlcjogYm9vbGVhbjtcbiAgd2ViZHJpdmVyVXBkYXRlOiBib29sZWFuO1xuICBwb3J0PzogbnVtYmVyO1xuICBob3N0OiBzdHJpbmc7XG4gIGJhc2VVcmw6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFByb3RyYWN0b3JCdWlsZGVyIGltcGxlbWVudHMgQnVpbGRlcjxQcm90cmFjdG9yQnVpbGRlck9wdGlvbnM+IHtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHsgfVxuXG4gIHJ1bihidWlsZGVyQ29uZmlnOiBCdWlsZGVyQ29uZmlndXJhdGlvbjxQcm90cmFjdG9yQnVpbGRlck9wdGlvbnM+KTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG5cbiAgICBjb25zdCBvcHRpb25zID0gYnVpbGRlckNvbmZpZy5vcHRpb25zO1xuICAgIGNvbnN0IHJvb3QgPSB0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3Q7XG4gICAgY29uc3QgcHJvamVjdFJvb3QgPSByZXNvbHZlKHJvb3QsIGJ1aWxkZXJDb25maWcucm9vdCk7XG4gICAgLy8gY29uc3QgcHJvamVjdFN5c3RlbVJvb3QgPSBnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KTtcblxuICAgIC8vIFRPRE86IHZlcmlmeSB1c2luZyBvZihudWxsKSB0byBraWNrc3RhcnQgdGhpbmdzIGlzIGEgcGF0dGVybi5cbiAgICByZXR1cm4gb2YobnVsbCkucGlwZShcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiBvcHRpb25zLmRldlNlcnZlclRhcmdldCA/IHRoaXMuX3N0YXJ0RGV2U2VydmVyKG9wdGlvbnMpIDogb2YobnVsbCkpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IG9wdGlvbnMud2ViZHJpdmVyVXBkYXRlID8gdGhpcy5fdXBkYXRlV2ViZHJpdmVyKHByb2plY3RSb290KSA6IG9mKG51bGwpKSxcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiB0aGlzLl9ydW5Qcm90cmFjdG9yKHJvb3QsIG9wdGlvbnMpKSxcbiAgICAgIHRha2UoMSksXG4gICAgKTtcbiAgfVxuXG4gIC8vIE5vdGU6IHRoaXMgbWV0aG9kIG11dGF0ZXMgdGhlIG9wdGlvbnMgYXJndW1lbnQuXG4gIHByaXZhdGUgX3N0YXJ0RGV2U2VydmVyKG9wdGlvbnM6IFByb3RyYWN0b3JCdWlsZGVyT3B0aW9ucykge1xuICAgIGNvbnN0IGFyY2hpdGVjdCA9IHRoaXMuY29udGV4dC5hcmNoaXRlY3Q7XG4gICAgY29uc3QgW3Byb2plY3QsIHRhcmdldE5hbWUsIGNvbmZpZ3VyYXRpb25dID0gKG9wdGlvbnMuZGV2U2VydmVyVGFyZ2V0IGFzIHN0cmluZykuc3BsaXQoJzonKTtcbiAgICAvLyBPdmVycmlkZSBkZXYgc2VydmVyIHdhdGNoIHNldHRpbmcuXG4gICAgY29uc3Qgb3ZlcnJpZGVzOiBQYXJ0aWFsPERldlNlcnZlckJ1aWxkZXJPcHRpb25zPiA9IHsgd2F0Y2g6IGZhbHNlIH07XG4gICAgLy8gQWxzbyBvdmVycmlkZSB0aGUgcG9ydCBhbmQgaG9zdCBpZiB0aGV5IGFyZSBkZWZpbmVkIGluIHByb3RyYWN0b3Igb3B0aW9ucy5cbiAgICBpZiAob3B0aW9ucy5ob3N0ICE9PSB1bmRlZmluZWQpIHsgb3ZlcnJpZGVzLmhvc3QgPSBvcHRpb25zLmhvc3Q7IH1cbiAgICBpZiAob3B0aW9ucy5wb3J0ICE9PSB1bmRlZmluZWQpIHsgb3ZlcnJpZGVzLnBvcnQgPSBvcHRpb25zLnBvcnQ7IH1cbiAgICBjb25zdCB0YXJnZXRTcGVjID0geyBwcm9qZWN0LCB0YXJnZXQ6IHRhcmdldE5hbWUsIGNvbmZpZ3VyYXRpb24sIG92ZXJyaWRlcyB9O1xuICAgIGNvbnN0IGJ1aWxkZXJDb25maWcgPSBhcmNoaXRlY3QuZ2V0QnVpbGRlckNvbmZpZ3VyYXRpb248RGV2U2VydmVyQnVpbGRlck9wdGlvbnM+KHRhcmdldFNwZWMpO1xuICAgIGxldCBkZXZTZXJ2ZXJEZXNjcmlwdGlvbjogQnVpbGRlckRlc2NyaXB0aW9uO1xuICAgIGxldCBiYXNlVXJsOiBzdHJpbmc7XG5cbiAgICByZXR1cm4gYXJjaGl0ZWN0LmdldEJ1aWxkZXJEZXNjcmlwdGlvbihidWlsZGVyQ29uZmlnKS5waXBlKFxuICAgICAgdGFwKGRlc2NyaXB0aW9uID0+IGRldlNlcnZlckRlc2NyaXB0aW9uID0gZGVzY3JpcHRpb24pLFxuICAgICAgY29uY2F0TWFwKGRldlNlcnZlckRlc2NyaXB0aW9uID0+IGFyY2hpdGVjdC52YWxpZGF0ZUJ1aWxkZXJPcHRpb25zKFxuICAgICAgICBidWlsZGVyQ29uZmlnLCBkZXZTZXJ2ZXJEZXNjcmlwdGlvbikpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IHtcbiAgICAgICAgLy8gQ29tcHV0ZSBiYXNlVXJsIGZyb20gZGV2U2VydmVyT3B0aW9ucy5cbiAgICAgICAgaWYgKG9wdGlvbnMuZGV2U2VydmVyVGFyZ2V0ICYmIGJ1aWxkZXJDb25maWcub3B0aW9ucy5wdWJsaWNIb3N0KSB7XG4gICAgICAgICAgbGV0IHB1YmxpY0hvc3QgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnMucHVibGljSG9zdDtcbiAgICAgICAgICBpZiAoIS9eXFx3KzpcXC9cXC8vLnRlc3QocHVibGljSG9zdCkpIHtcbiAgICAgICAgICAgIHB1YmxpY0hvc3QgPSBgJHtidWlsZGVyQ29uZmlnLm9wdGlvbnMuc3NsXG4gICAgICAgICAgICAgID8gJ2h0dHBzJ1xuICAgICAgICAgICAgICA6ICdodHRwJ306Ly8ke3B1YmxpY0hvc3R9YDtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgY2xpZW50VXJsID0gdXJsLnBhcnNlKHB1YmxpY0hvc3QpO1xuICAgICAgICAgIGJhc2VVcmwgPSB1cmwuZm9ybWF0KGNsaWVudFVybCk7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5kZXZTZXJ2ZXJUYXJnZXQpIHtcbiAgICAgICAgICBiYXNlVXJsID0gdXJsLmZvcm1hdCh7XG4gICAgICAgICAgICBwcm90b2NvbDogYnVpbGRlckNvbmZpZy5vcHRpb25zLnNzbCA/ICdodHRwcycgOiAnaHR0cCcsXG4gICAgICAgICAgICBob3N0bmFtZTogb3B0aW9ucy5ob3N0LFxuICAgICAgICAgICAgcG9ydDogYnVpbGRlckNvbmZpZy5vcHRpb25zLnBvcnQudG9TdHJpbmcoKSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNhdmUgdGhlIGNvbXB1dGVkIGJhc2VVcmwgYmFjayBzbyB0aGF0IFByb3RyYWN0b3IgY2FuIHVzZSBpdC5cbiAgICAgICAgb3B0aW9ucy5iYXNlVXJsID0gYmFzZVVybDtcblxuICAgICAgICByZXR1cm4gb2YodGhpcy5jb250ZXh0LmFyY2hpdGVjdC5nZXRCdWlsZGVyKGRldlNlcnZlckRlc2NyaXB0aW9uLCB0aGlzLmNvbnRleHQpKTtcbiAgICAgIH0pLFxuICAgICAgY29uY2F0TWFwKGJ1aWxkZXIgPT4gYnVpbGRlci5ydW4oYnVpbGRlckNvbmZpZykpLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIF91cGRhdGVXZWJkcml2ZXIocHJvamVjdFJvb3Q6IFBhdGgpIHtcbiAgICAvLyBUaGUgd2ViZHJpdmVyLW1hbmFnZXIgdXBkYXRlIGNvbW1hbmQgY2FuIG9ubHkgYmUgYWNjZXNzZWQgdmlhIGEgZGVlcCBpbXBvcnQuXG4gICAgY29uc3Qgd2ViZHJpdmVyRGVlcEltcG9ydCA9ICd3ZWJkcml2ZXItbWFuYWdlci9idWlsdC9saWIvY21kcy91cGRhdGUnO1xuICAgIGxldCB3ZWJkcml2ZXJVcGRhdGU6IGFueTsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1hbnlcblxuICAgIHRyeSB7XG4gICAgICAvLyBXaGVuIHVzaW5nIG5wbSwgd2ViZHJpdmVyIGlzIHdpdGhpbiBwcm90cmFjdG9yL25vZGVfbW9kdWxlcy5cbiAgICAgIHdlYmRyaXZlclVwZGF0ZSA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLFxuICAgICAgICBgcHJvdHJhY3Rvci9ub2RlX21vZHVsZXMvJHt3ZWJkcml2ZXJEZWVwSW1wb3J0fWApO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdHJ5IHtcbiAgICAgICAgLy8gV2hlbiB1c2luZyB5YXJuLCB3ZWJkcml2ZXIgaXMgZm91bmQgYXMgYSByb290IG1vZHVsZS5cbiAgICAgICAgd2ViZHJpdmVyVXBkYXRlID0gcmVxdWlyZVByb2plY3RNb2R1bGUoZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksIHdlYmRyaXZlckRlZXBJbXBvcnQpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcih0YWdzLnN0cmlwSW5kZW50c2BcbiAgICAgICAgICBDYW5ub3QgYXV0b21hdGljYWxseSBmaW5kIHdlYmRyaXZlci1tYW5hZ2VyIHRvIHVwZGF0ZS5cbiAgICAgICAgICBVcGRhdGUgd2ViZHJpdmVyLW1hbmFnZXIgbWFudWFsbHkgYW5kIHJ1biAnbmcgZTJlIC0tbm8td2ViZHJpdmVyLXVwZGF0ZScgaW5zdGVhZC5cbiAgICAgICAgYCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gcnVuIGB3ZWJkcml2ZXItbWFuYWdlciB1cGRhdGUgLS1zdGFuZGFsb25lIGZhbHNlIC0tZ2Vja28gZmFsc2UgLS1xdWlldGBcbiAgICAvLyBpZiB5b3UgY2hhbmdlIHRoaXMsIHVwZGF0ZSB0aGUgY29tbWFuZCBjb21tZW50IGluIHByZXYgbGluZSwgYW5kIGluIGBlamVjdGAgdGFza1xuICAgIHJldHVybiBmcm9tKHdlYmRyaXZlclVwZGF0ZS5wcm9ncmFtLnJ1bih7XG4gICAgICBzdGFuZGFsb25lOiBmYWxzZSxcbiAgICAgIGdlY2tvOiBmYWxzZSxcbiAgICAgIHF1aWV0OiB0cnVlLFxuICAgIH0pKTtcbiAgfVxuXG4gIHByaXZhdGUgX3J1blByb3RyYWN0b3Iocm9vdDogUGF0aCwgb3B0aW9uczogUHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zKTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG4gICAgY29uc3QgYWRkaXRpb25hbFByb3RyYWN0b3JDb25maWc6IFBhcnRpYWw8UHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zPiA9IHtcbiAgICAgIGVsZW1lbnRFeHBsb3Jlcjogb3B0aW9ucy5lbGVtZW50RXhwbG9yZXIsXG4gICAgICBiYXNlVXJsOiBvcHRpb25zLmJhc2VVcmwsXG4gICAgICBzcGVjczogb3B0aW9ucy5zcGVjcy5sZW5ndGggPyBvcHRpb25zLnNwZWNzIDogdW5kZWZpbmVkLFxuICAgICAgc3VpdGU6IG9wdGlvbnMuc3VpdGUsXG4gICAgfTtcblxuICAgIC8vIFRPRE86IFByb3RyYWN0b3IgbWFuYWdlcyBwcm9jZXNzLmV4aXQgaXRzZWxmLCBzbyB0aGlzIHRhcmdldCB3aWxsIGFsbHdheXMgcXVpdCB0aGVcbiAgICAvLyBwcm9jZXNzLiBUbyB3b3JrIGFyb3VuZCB0aGlzIHdlIHJ1biBpdCBpbiBhIHN1YnByb2Nlc3MuXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvcHJvdHJhY3Rvci9pc3N1ZXMvNDE2MFxuICAgIHJldHVybiBydW5Nb2R1bGVBc09ic2VydmFibGVGb3JrKFxuICAgICAgZ2V0U3lzdGVtUGF0aChyb290KSxcbiAgICAgICdwcm90cmFjdG9yL2J1aWx0L2xhdW5jaGVyJyxcbiAgICAgICdpbml0JyxcbiAgICAgIFtcbiAgICAgICAgZ2V0U3lzdGVtUGF0aChyZXNvbHZlKHJvb3QsIG5vcm1hbGl6ZShvcHRpb25zLnByb3RyYWN0b3JDb25maWcpKSksXG4gICAgICAgIGFkZGl0aW9uYWxQcm90cmFjdG9yQ29uZmlnLFxuICAgICAgXSxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByb3RyYWN0b3JCdWlsZGVyO1xuIl19