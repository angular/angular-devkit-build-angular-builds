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
        // ensure that either one of this option is used
        if (options.devServerTarget && options.baseUrl) {
            throw new Error(core_1.tags.stripIndents `
      The 'baseUrl' option cannot be used with 'devServerTarget'.
      When present, 'devServerTarget' will be used to automatically setup 'baseUrl' for Protractor.
      `);
        }
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
        return architect.getBuilderDescription(builderConfig).pipe(operators_1.tap(description => devServerDescription = description), operators_1.concatMap(devServerDescription => architect.validateBuilderOptions(builderConfig, devServerDescription)), operators_1.map(() => this.context.architect.getBuilder(devServerDescription, this.context)), operators_1.concatMap(builder => builder.run(builderConfig)), operators_1.tap(buildEvent => {
            if (!buildEvent.success) {
                return;
            }
            // Compute baseUrl from devServerOptions.
            if (builderConfig.options.publicHost) {
                let publicHost = builderConfig.options.publicHost;
                if (!/^\w+:\/\//.test(publicHost)) {
                    publicHost = `${builderConfig.options.ssl
                        ? 'https'
                        : 'http'}://${publicHost}`;
                }
                const clientUrl = url.parse(publicHost);
                baseUrl = url.format(clientUrl);
            }
            else {
                const result = buildEvent.result;
                baseUrl = url.format({
                    protocol: builderConfig.options.ssl ? 'https' : 'http',
                    hostname: options.host,
                    port: result && result.port.toString(),
                });
            }
            // Save the computed baseUrl back so that Protractor can use it.
            options.baseUrl = baseUrl;
        }));
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
        // if you change this, update the command comment in prev line
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Byb3RyYWN0b3IvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFVSCwrQ0FBcUY7QUFDckYsK0JBQTRDO0FBQzVDLDhDQUEyRDtBQUMzRCwyQkFBMkI7QUFDM0Isa0dBQTZGO0FBRTdGLG9DQUFxRDtBQWVyRCxNQUFhLGlCQUFpQjtJQUU1QixZQUFtQixPQUF1QjtRQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtJQUFJLENBQUM7SUFFL0MsR0FBRyxDQUFDLGFBQTZEO1FBRS9ELE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7UUFDdEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3pDLE1BQU0sV0FBVyxHQUFHLGNBQU8sQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXRELGdEQUFnRDtRQUNoRCxJQUFJLE9BQU8sQ0FBQyxlQUFlLElBQUksT0FBTyxDQUFDLE9BQU8sRUFBRTtZQUM5QyxNQUFNLElBQUksS0FBSyxDQUFDLFdBQUksQ0FBQyxZQUFZLENBQUE7OztPQUdoQyxDQUFDLENBQUM7U0FDSjtRQUVELGdFQUFnRTtRQUNoRSxPQUFPLFNBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQ2xCLHFCQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQ25GLHFCQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFn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QUUsT0FBTyxDQUFDLE9BQU87WUFDeEIsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTO1lBQ3ZELEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSztTQUNyQixDQUFDO1FBRUYscUZBQXFGO1FBQ3JGLDBEQUEwRDtRQUMxRCxvREFBb0Q7UUFDcEQsT0FBTyxpQ0FBeUIsQ0FDOUIsb0JBQWEsQ0FBQyxJQUFJLENBQUMsRUFDbkIsMkJBQTJCLEVBQzNCLE1BQU0sRUFDTjtZQUNFLG9CQUFhLENBQUMsY0FBTyxDQUFDLElBQUksRUFBRSxnQkFBUyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7WUFDakUsMEJBQTBCO1NBQzNCLENBQ0YsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQWpJRCw4Q0FpSUM7QUFFRCxrQkFBZSxpQkFBaUIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgQnVpbGRFdmVudCxcbiAgQnVpbGRlcixcbiAgQnVpbGRlckNvbmZpZ3VyYXRpb24sXG4gIEJ1aWxkZXJDb250ZXh0LFxuICBCdWlsZGVyRGVzY3JpcHRpb24sXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgRGV2U2VydmVyUmVzdWx0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLXdlYnBhY2snO1xuaW1wb3J0IHsgUGF0aCwgZ2V0U3lzdGVtUGF0aCwgbm9ybWFsaXplLCByZXNvbHZlLCB0YWdzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSwgb2YgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbWFwLCB0YWtlLCB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcbmltcG9ydCB7IHJlcXVpcmVQcm9qZWN0TW9kdWxlIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3JlcXVpcmUtcHJvamVjdC1tb2R1bGUnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIERldlNlcnZlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi4vZGV2LXNlcnZlci9zY2hlbWEnO1xuaW1wb3J0IHsgcnVuTW9kdWxlQXNPYnNlcnZhYmxlRm9yayB9IGZyb20gJy4uL3V0aWxzJztcblxuXG5leHBvcnQgaW50ZXJmYWNlIFByb3RyYWN0b3JCdWlsZGVyT3B0aW9ucyB7XG4gIHByb3RyYWN0b3JDb25maWc6IHN0cmluZztcbiAgZGV2U2VydmVyVGFyZ2V0Pzogc3RyaW5nO1xuICBzcGVjczogc3RyaW5nW107XG4gIHN1aXRlPzogc3RyaW5nO1xuICBlbGVtZW50RXhwbG9yZXI6IGJvb2xlYW47XG4gIHdlYmRyaXZlclVwZGF0ZTogYm9vbGVhbjtcbiAgcG9ydD86IG51bWJlcjtcbiAgaG9zdDogc3RyaW5nO1xuICBiYXNlVXJsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBQcm90cmFjdG9yQnVpbGRlciBpbXBsZW1lbnRzIEJ1aWxkZXI8UHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zPiB7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KSB7IH1cblxuICBydW4oYnVpbGRlckNvbmZpZzogQnVpbGRlckNvbmZpZ3VyYXRpb248UHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuXG4gICAgY29uc3Qgb3B0aW9ucyA9IGJ1aWxkZXJDb25maWcub3B0aW9ucztcbiAgICBjb25zdCByb290ID0gdGhpcy5jb250ZXh0LndvcmtzcGFjZS5yb290O1xuICAgIGNvbnN0IHByb2plY3RSb290ID0gcmVzb2x2ZShyb290LCBidWlsZGVyQ29uZmlnLnJvb3QpO1xuXG4gICAgLy8gZW5zdXJlIHRoYXQgZWl0aGVyIG9uZSBvZiB0aGlzIG9wdGlvbiBpcyB1c2VkXG4gICAgaWYgKG9wdGlvbnMuZGV2U2VydmVyVGFyZ2V0ICYmIG9wdGlvbnMuYmFzZVVybCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgVGhlICdiYXNlVXJsJyBvcHRpb24gY2Fubm90IGJlIHVzZWQgd2l0aCAnZGV2U2VydmVyVGFyZ2V0Jy5cbiAgICAgIFdoZW4gcHJlc2VudCwgJ2RldlNlcnZlclRhcmdldCcgd2lsbCBiZSB1c2VkIHRvIGF1dG9tYXRpY2FsbHkgc2V0dXAgJ2Jhc2VVcmwnIGZvciBQcm90cmFjdG9yLlxuICAgICAgYCk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogdmVyaWZ5IHVzaW5nIG9mKG51bGwpIHRvIGtpY2tzdGFydCB0aGluZ3MgaXMgYSBwYXR0ZXJuLlxuICAgIHJldHVybiBvZihudWxsKS5waXBlKFxuICAgICAgY29uY2F0TWFwKCgpID0+IG9wdGlvbnMuZGV2U2VydmVyVGFyZ2V0ID8gdGhpcy5fc3RhcnREZXZTZXJ2ZXIob3B0aW9ucykgOiBvZihudWxsKSksXG4gICAgICBjb25jYXRNYXAoKCkgPT4gb3B0aW9ucy53ZWJkcml2ZXJVcGRhdGUgPyB0aGlzLl91cGRhdGVXZWJkcml2ZXIocHJvamVjdFJvb3QpIDogb2YobnVsbCkpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IHRoaXMuX3J1blByb3RyYWN0b3Iocm9vdCwgb3B0aW9ucykpLFxuICAgICAgdGFrZSgxKSxcbiAgICApO1xuICB9XG5cbiAgLy8gTm90ZTogdGhpcyBtZXRob2QgbXV0YXRlcyB0aGUgb3B0aW9ucyBhcmd1bWVudC5cbiAgcHJpdmF0ZSBfc3RhcnREZXZTZXJ2ZXIob3B0aW9uczogUHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zKSB7XG4gICAgY29uc3QgYXJjaGl0ZWN0ID0gdGhpcy5jb250ZXh0LmFyY2hpdGVjdDtcbiAgICBjb25zdCBbcHJvamVjdCwgdGFyZ2V0TmFtZSwgY29uZmlndXJhdGlvbl0gPSAob3B0aW9ucy5kZXZTZXJ2ZXJUYXJnZXQgYXMgc3RyaW5nKS5zcGxpdCgnOicpO1xuICAgIC8vIE92ZXJyaWRlIGRldiBzZXJ2ZXIgd2F0Y2ggc2V0dGluZy5cbiAgICBjb25zdCBvdmVycmlkZXM6IFBhcnRpYWw8RGV2U2VydmVyQnVpbGRlck9wdGlvbnM+ID0geyB3YXRjaDogZmFsc2UgfTtcbiAgICAvLyBBbHNvIG92ZXJyaWRlIHRoZSBwb3J0IGFuZCBob3N0IGlmIHRoZXkgYXJlIGRlZmluZWQgaW4gcHJvdHJhY3RvciBvcHRpb25zLlxuICAgIGlmIChvcHRpb25zLmhvc3QgIT09IHVuZGVmaW5lZCkgeyBvdmVycmlkZXMuaG9zdCA9IG9wdGlvbnMuaG9zdDsgfVxuICAgIGlmIChvcHRpb25zLnBvcnQgIT09IHVuZGVmaW5lZCkgeyBvdmVycmlkZXMucG9ydCA9IG9wdGlvbnMucG9ydDsgfVxuICAgIGNvbnN0IHRhcmdldFNwZWMgPSB7IHByb2plY3QsIHRhcmdldDogdGFyZ2V0TmFtZSwgY29uZmlndXJhdGlvbiwgb3ZlcnJpZGVzIH07XG4gICAgY29uc3QgYnVpbGRlckNvbmZpZyA9IGFyY2hpdGVjdC5nZXRCdWlsZGVyQ29uZmlndXJhdGlvbjxEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucz4odGFyZ2V0U3BlYyk7XG4gICAgbGV0IGRldlNlcnZlckRlc2NyaXB0aW9uOiBCdWlsZGVyRGVzY3JpcHRpb247XG4gICAgbGV0IGJhc2VVcmw6IHN0cmluZztcblxuICAgIHJldHVybiBhcmNoaXRlY3QuZ2V0QnVpbGRlckRlc2NyaXB0aW9uKGJ1aWxkZXJDb25maWcpLnBpcGUoXG4gICAgICB0YXAoZGVzY3JpcHRpb24gPT4gZGV2U2VydmVyRGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbiksXG4gICAgICBjb25jYXRNYXAoZGV2U2VydmVyRGVzY3JpcHRpb24gPT5cbiAgICAgICAgYXJjaGl0ZWN0LnZhbGlkYXRlQnVpbGRlck9wdGlvbnMoYnVpbGRlckNvbmZpZywgZGV2U2VydmVyRGVzY3JpcHRpb24pKSxcbiAgICAgIG1hcCgoKSA9PiB0aGlzLmNvbnRleHQuYXJjaGl0ZWN0LmdldEJ1aWxkZXIoZGV2U2VydmVyRGVzY3JpcHRpb24sIHRoaXMuY29udGV4dCkpLFxuICAgICAgY29uY2F0TWFwKGJ1aWxkZXIgPT4gYnVpbGRlci5ydW4oYnVpbGRlckNvbmZpZykpLFxuICAgICAgdGFwKGJ1aWxkRXZlbnQgPT4ge1xuICAgICAgICBpZiAoIWJ1aWxkRXZlbnQuc3VjY2Vzcykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENvbXB1dGUgYmFzZVVybCBmcm9tIGRldlNlcnZlck9wdGlvbnMuXG4gICAgICAgIGlmIChidWlsZGVyQ29uZmlnLm9wdGlvbnMucHVibGljSG9zdCkge1xuICAgICAgICAgIGxldCBwdWJsaWNIb3N0ID0gYnVpbGRlckNvbmZpZy5vcHRpb25zLnB1YmxpY0hvc3Q7XG4gICAgICAgICAgaWYgKCEvXlxcdys6XFwvXFwvLy50ZXN0KHB1YmxpY0hvc3QpKSB7XG4gICAgICAgICAgICBwdWJsaWNIb3N0ID0gYCR7YnVpbGRlckNvbmZpZy5vcHRpb25zLnNzbFxuICAgICAgICAgICAgICA/ICdodHRwcydcbiAgICAgICAgICAgICAgOiAnaHR0cCd9Oi8vJHtwdWJsaWNIb3N0fWA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGNsaWVudFVybCA9IHVybC5wYXJzZShwdWJsaWNIb3N0KTtcbiAgICAgICAgICBiYXNlVXJsID0gdXJsLmZvcm1hdChjbGllbnRVcmwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdDogRGV2U2VydmVyUmVzdWx0IHwgdW5kZWZpbmVkID0gYnVpbGRFdmVudC5yZXN1bHQ7XG5cbiAgICAgICAgICBiYXNlVXJsID0gdXJsLmZvcm1hdCh7XG4gICAgICAgICAgICBwcm90b2NvbDogYnVpbGRlckNvbmZpZy5vcHRpb25zLnNzbCA/ICdodHRwcycgOiAnaHR0cCcsXG4gICAgICAgICAgICBob3N0bmFtZTogb3B0aW9ucy5ob3N0LFxuICAgICAgICAgICAgcG9ydDogcmVzdWx0ICYmIHJlc3VsdC5wb3J0LnRvU3RyaW5nKCksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTYXZlIHRoZSBjb21wdXRlZCBiYXNlVXJsIGJhY2sgc28gdGhhdCBQcm90cmFjdG9yIGNhbiB1c2UgaXQuXG4gICAgICAgIG9wdGlvbnMuYmFzZVVybCA9IGJhc2VVcmw7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBfdXBkYXRlV2ViZHJpdmVyKHByb2plY3RSb290OiBQYXRoKSB7XG4gICAgLy8gVGhlIHdlYmRyaXZlci1tYW5hZ2VyIHVwZGF0ZSBjb21tYW5kIGNhbiBvbmx5IGJlIGFjY2Vzc2VkIHZpYSBhIGRlZXAgaW1wb3J0LlxuICAgIGNvbnN0IHdlYmRyaXZlckRlZXBJbXBvcnQgPSAnd2ViZHJpdmVyLW1hbmFnZXIvYnVpbHQvbGliL2NtZHMvdXBkYXRlJztcbiAgICBsZXQgd2ViZHJpdmVyVXBkYXRlOiBhbnk7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8tYW55XG5cbiAgICB0cnkge1xuICAgICAgLy8gV2hlbiB1c2luZyBucG0sIHdlYmRyaXZlciBpcyB3aXRoaW4gcHJvdHJhY3Rvci9ub2RlX21vZHVsZXMuXG4gICAgICB3ZWJkcml2ZXJVcGRhdGUgPSByZXF1aXJlUHJvamVjdE1vZHVsZShnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSxcbiAgICAgICAgYHByb3RyYWN0b3Ivbm9kZV9tb2R1bGVzLyR7d2ViZHJpdmVyRGVlcEltcG9ydH1gKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIFdoZW4gdXNpbmcgeWFybiwgd2ViZHJpdmVyIGlzIGZvdW5kIGFzIGEgcm9vdCBtb2R1bGUuXG4gICAgICAgIHdlYmRyaXZlclVwZGF0ZSA9IHJlcXVpcmVQcm9qZWN0TW9kdWxlKGdldFN5c3RlbVBhdGgocHJvamVjdFJvb3QpLCB3ZWJkcml2ZXJEZWVwSW1wb3J0KTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IodGFncy5zdHJpcEluZGVudHNgXG4gICAgICAgICAgQ2Fubm90IGF1dG9tYXRpY2FsbHkgZmluZCB3ZWJkcml2ZXItbWFuYWdlciB0byB1cGRhdGUuXG4gICAgICAgICAgVXBkYXRlIHdlYmRyaXZlci1tYW5hZ2VyIG1hbnVhbGx5IGFuZCBydW4gJ25nIGUyZSAtLW5vLXdlYmRyaXZlci11cGRhdGUnIGluc3RlYWQuXG4gICAgICAgIGApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJ1biBgd2ViZHJpdmVyLW1hbmFnZXIgdXBkYXRlIC0tc3RhbmRhbG9uZSBmYWxzZSAtLWdlY2tvIGZhbHNlIC0tcXVpZXRgXG4gICAgLy8gaWYgeW91IGNoYW5nZSB0aGlzLCB1cGRhdGUgdGhlIGNvbW1hbmQgY29tbWVudCBpbiBwcmV2IGxpbmVcbiAgICByZXR1cm4gZnJvbSh3ZWJkcml2ZXJVcGRhdGUucHJvZ3JhbS5ydW4oe1xuICAgICAgc3RhbmRhbG9uZTogZmFsc2UsXG4gICAgICBnZWNrbzogZmFsc2UsXG4gICAgICBxdWlldDogdHJ1ZSxcbiAgICB9KSk7XG4gIH1cblxuICBwcml2YXRlIF9ydW5Qcm90cmFjdG9yKHJvb3Q6IFBhdGgsIG9wdGlvbnM6IFByb3RyYWN0b3JCdWlsZGVyT3B0aW9ucyk6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuICAgIGNvbnN0IGFkZGl0aW9uYWxQcm90cmFjdG9yQ29uZmlnOiBQYXJ0aWFsPFByb3RyYWN0b3JCdWlsZGVyT3B0aW9ucz4gPSB7XG4gICAgICBlbGVtZW50RXhwbG9yZXI6IG9wdGlvbnMuZWxlbWVudEV4cGxvcmVyLFxuICAgICAgYmFzZVVybDogb3B0aW9ucy5iYXNlVXJsLFxuICAgICAgc3BlY3M6IG9wdGlvbnMuc3BlY3MubGVuZ3RoID8gb3B0aW9ucy5zcGVjcyA6IHVuZGVmaW5lZCxcbiAgICAgIHN1aXRlOiBvcHRpb25zLnN1aXRlLFxuICAgIH07XG5cbiAgICAvLyBUT0RPOiBQcm90cmFjdG9yIG1hbmFnZXMgcHJvY2Vzcy5leGl0IGl0c2VsZiwgc28gdGhpcyB0YXJnZXQgd2lsbCBhbGx3YXlzIHF1aXQgdGhlXG4gICAgLy8gcHJvY2Vzcy4gVG8gd29yayBhcm91bmQgdGhpcyB3ZSBydW4gaXQgaW4gYSBzdWJwcm9jZXNzLlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL3Byb3RyYWN0b3IvaXNzdWVzLzQxNjBcbiAgICByZXR1cm4gcnVuTW9kdWxlQXNPYnNlcnZhYmxlRm9yayhcbiAgICAgIGdldFN5c3RlbVBhdGgocm9vdCksXG4gICAgICAncHJvdHJhY3Rvci9idWlsdC9sYXVuY2hlcicsXG4gICAgICAnaW5pdCcsXG4gICAgICBbXG4gICAgICAgIGdldFN5c3RlbVBhdGgocmVzb2x2ZShyb290LCBub3JtYWxpemUob3B0aW9ucy5wcm90cmFjdG9yQ29uZmlnKSkpLFxuICAgICAgICBhZGRpdGlvbmFsUHJvdHJhY3RvckNvbmZpZyxcbiAgICAgIF0sXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQcm90cmFjdG9yQnVpbGRlcjtcbiJdfQ==