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
        return architect.getBuilderDescription(builderConfig).pipe(operators_1.tap(description => devServerDescription = description), operators_1.concatMap(devServerDescription => architect.validateBuilderOptions(builderConfig, devServerDescription)), operators_1.map(() => this.context.architect.getBuilder(devServerDescription, this.context)), operators_1.concatMap(builder => builder.run(builderConfig)), operators_1.tap(buildEvent => {
            if (!buildEvent.success) {
                return;
            }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Byb3RyYWN0b3IvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFVSCwrQ0FBcUY7QUFDckYsK0JBQTRDO0FBQzVDLDhDQUEyRDtBQUMzRCwyQkFBMkI7QUFDM0Isa0dBQTZGO0FBRTdGLG9DQUFxRDtBQWVyRCxNQUFhLGlCQUFpQjtJQUU1QixZQUFtQixPQUF1QjtRQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtJQUFJLENBQUM7SUFFL0MsR0FBRyxDQUFDLGFBQTZEO1FBRS9ELE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7UUFDdEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3pDLE1BQU0sV0FBVyxHQUFHLGNBQU8sQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELHdEQUF3RDtRQUV4RCxnRUFBZ0U7UUFDaEUsT0FBTyxTQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUNsQixxQkFBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUNuRixxQkFBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQ3hGLHFCQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUs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LE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVM7WUFDdkQsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO1NBQ3JCLENBQUM7UUFFRixxRkFBcUY7UUFDckYsMERBQTBEO1FBQzFELG9EQUFvRDtRQUNwRCxPQUFPLGlDQUF5QixDQUM5QixvQkFBYSxDQUFDLElBQUksQ0FBQyxFQUNuQiwyQkFBMkIsRUFDM0IsTUFBTSxFQUNOO1lBQ0Usb0JBQWEsQ0FBQyxjQUFPLENBQUMsSUFBSSxFQUFFLGdCQUFTLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQztZQUNqRSwwQkFBMEI7U0FDM0IsQ0FDRixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBMUhELDhDQTBIQztBQUVELGtCQUFlLGlCQUFpQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZEV2ZW50LFxuICBCdWlsZGVyLFxuICBCdWlsZGVyQ29uZmlndXJhdGlvbixcbiAgQnVpbGRlckNvbnRleHQsXG4gIEJ1aWxkZXJEZXNjcmlwdGlvbixcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBEZXZTZXJ2ZXJSZXN1bHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjayc7XG5pbXBvcnQgeyBQYXRoLCBnZXRTeXN0ZW1QYXRoLCBub3JtYWxpemUsIHJlc29sdmUsIHRhZ3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBmcm9tLCBvZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAsIHRha2UsIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIHVybCBmcm9tICd1cmwnO1xuaW1wb3J0IHsgcmVxdWlyZVByb2plY3RNb2R1bGUgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcmVxdWlyZS1wcm9qZWN0LW1vZHVsZSc7XG5pbXBvcnQgeyBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4uL2Rldi1zZXJ2ZXInO1xuaW1wb3J0IHsgcnVuTW9kdWxlQXNPYnNlcnZhYmxlRm9yayB9IGZyb20gJy4uL3V0aWxzJztcblxuXG5leHBvcnQgaW50ZXJmYWNlIFByb3RyYWN0b3JCdWlsZGVyT3B0aW9ucyB7XG4gIHByb3RyYWN0b3JDb25maWc6IHN0cmluZztcbiAgZGV2U2VydmVyVGFyZ2V0Pzogc3RyaW5nO1xuICBzcGVjczogc3RyaW5nW107XG4gIHN1aXRlPzogc3RyaW5nO1xuICBlbGVtZW50RXhwbG9yZXI6IGJvb2xlYW47XG4gIHdlYmRyaXZlclVwZGF0ZTogYm9vbGVhbjtcbiAgcG9ydD86IG51bWJlcjtcbiAgaG9zdDogc3RyaW5nO1xuICBiYXNlVXJsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBQcm90cmFjdG9yQnVpbGRlciBpbXBsZW1lbnRzIEJ1aWxkZXI8UHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zPiB7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KSB7IH1cblxuICBydW4oYnVpbGRlckNvbmZpZzogQnVpbGRlckNvbmZpZ3VyYXRpb248UHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuXG4gICAgY29uc3Qgb3B0aW9ucyA9IGJ1aWxkZXJDb25maWcub3B0aW9ucztcbiAgICBjb25zdCByb290ID0gdGhpcy5jb250ZXh0LndvcmtzcGFjZS5yb290O1xuICAgIGNvbnN0IHByb2plY3RSb290ID0gcmVzb2x2ZShyb290LCBidWlsZGVyQ29uZmlnLnJvb3QpO1xuICAgIC8vIGNvbnN0IHByb2plY3RTeXN0ZW1Sb290ID0gZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCk7XG5cbiAgICAvLyBUT0RPOiB2ZXJpZnkgdXNpbmcgb2YobnVsbCkgdG8ga2lja3N0YXJ0IHRoaW5ncyBpcyBhIHBhdHRlcm4uXG4gICAgcmV0dXJuIG9mKG51bGwpLnBpcGUoXG4gICAgICBjb25jYXRNYXAoKCkgPT4gb3B0aW9ucy5kZXZTZXJ2ZXJUYXJnZXQgPyB0aGlzLl9zdGFydERldlNlcnZlcihvcHRpb25zKSA6IG9mKG51bGwpKSxcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiBvcHRpb25zLndlYmRyaXZlclVwZGF0ZSA/IHRoaXMuX3VwZGF0ZVdlYmRyaXZlcihwcm9qZWN0Um9vdCkgOiBvZihudWxsKSksXG4gICAgICBjb25jYXRNYXAoKCkgPT4gdGhpcy5fcnVuUHJvdHJhY3Rvcihyb290LCBvcHRpb25zKSksXG4gICAgICB0YWtlKDEpLFxuICAgICk7XG4gIH1cblxuICAvLyBOb3RlOiB0aGlzIG1ldGhvZCBtdXRhdGVzIHRoZSBvcHRpb25zIGFyZ3VtZW50LlxuICBwcml2YXRlIF9zdGFydERldlNlcnZlcihvcHRpb25zOiBQcm90cmFjdG9yQnVpbGRlck9wdGlvbnMpIHtcbiAgICBjb25zdCBhcmNoaXRlY3QgPSB0aGlzLmNvbnRleHQuYXJjaGl0ZWN0O1xuICAgIGNvbnN0IFtwcm9qZWN0LCB0YXJnZXROYW1lLCBjb25maWd1cmF0aW9uXSA9IChvcHRpb25zLmRldlNlcnZlclRhcmdldCBhcyBzdHJpbmcpLnNwbGl0KCc6Jyk7XG4gICAgLy8gT3ZlcnJpZGUgZGV2IHNlcnZlciB3YXRjaCBzZXR0aW5nLlxuICAgIGNvbnN0IG92ZXJyaWRlczogUGFydGlhbDxEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucz4gPSB7IHdhdGNoOiBmYWxzZSB9O1xuICAgIC8vIEFsc28gb3ZlcnJpZGUgdGhlIHBvcnQgYW5kIGhvc3QgaWYgdGhleSBhcmUgZGVmaW5lZCBpbiBwcm90cmFjdG9yIG9wdGlvbnMuXG4gICAgaWYgKG9wdGlvbnMuaG9zdCAhPT0gdW5kZWZpbmVkKSB7IG92ZXJyaWRlcy5ob3N0ID0gb3B0aW9ucy5ob3N0OyB9XG4gICAgaWYgKG9wdGlvbnMucG9ydCAhPT0gdW5kZWZpbmVkKSB7IG92ZXJyaWRlcy5wb3J0ID0gb3B0aW9ucy5wb3J0OyB9XG4gICAgY29uc3QgdGFyZ2V0U3BlYyA9IHsgcHJvamVjdCwgdGFyZ2V0OiB0YXJnZXROYW1lLCBjb25maWd1cmF0aW9uLCBvdmVycmlkZXMgfTtcbiAgICBjb25zdCBidWlsZGVyQ29uZmlnID0gYXJjaGl0ZWN0LmdldEJ1aWxkZXJDb25maWd1cmF0aW9uPERldlNlcnZlckJ1aWxkZXJPcHRpb25zPih0YXJnZXRTcGVjKTtcbiAgICBsZXQgZGV2U2VydmVyRGVzY3JpcHRpb246IEJ1aWxkZXJEZXNjcmlwdGlvbjtcbiAgICBsZXQgYmFzZVVybDogc3RyaW5nO1xuXG4gICAgcmV0dXJuIGFyY2hpdGVjdC5nZXRCdWlsZGVyRGVzY3JpcHRpb24oYnVpbGRlckNvbmZpZykucGlwZShcbiAgICAgIHRhcChkZXNjcmlwdGlvbiA9PiBkZXZTZXJ2ZXJEZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uKSxcbiAgICAgIGNvbmNhdE1hcChkZXZTZXJ2ZXJEZXNjcmlwdGlvbiA9PlxuICAgICAgICBhcmNoaXRlY3QudmFsaWRhdGVCdWlsZGVyT3B0aW9ucyhidWlsZGVyQ29uZmlnLCBkZXZTZXJ2ZXJEZXNjcmlwdGlvbikpLFxuICAgICAgbWFwKCgpID0+IHRoaXMuY29udGV4dC5hcmNoaXRlY3QuZ2V0QnVpbGRlcihkZXZTZXJ2ZXJEZXNjcmlwdGlvbiwgdGhpcy5jb250ZXh0KSksXG4gICAgICBjb25jYXRNYXAoYnVpbGRlciA9PiBidWlsZGVyLnJ1bihidWlsZGVyQ29uZmlnKSksXG4gICAgICB0YXAoYnVpbGRFdmVudCA9PiB7XG4gICAgICAgIGlmICghYnVpbGRFdmVudC5zdWNjZXNzKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ29tcHV0ZSBiYXNlVXJsIGZyb20gZGV2U2VydmVyT3B0aW9ucy5cbiAgICAgICAgaWYgKG9wdGlvbnMuZGV2U2VydmVyVGFyZ2V0ICYmIGJ1aWxkZXJDb25maWcub3B0aW9ucy5wdWJsaWNIb3N0KSB7XG4gICAgICAgICAgbGV0IHB1YmxpY0hvc3QgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnMucHVibGljSG9zdDtcbiAgICAgICAgICBpZiAoIS9eXFx3KzpcXC9cXC8vLnRlc3QocHVibGljSG9zdCkpIHtcbiAgICAgICAgICAgIHB1YmxpY0hvc3QgPSBgJHtidWlsZGVyQ29uZmlnLm9wdGlvbnMuc3NsXG4gICAgICAgICAgICAgID8gJ2h0dHBzJ1xuICAgICAgICAgICAgICA6ICdodHRwJ306Ly8ke3B1YmxpY0hvc3R9YDtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgY2xpZW50VXJsID0gdXJsLnBhcnNlKHB1YmxpY0hvc3QpO1xuICAgICAgICAgIGJhc2VVcmwgPSB1cmwuZm9ybWF0KGNsaWVudFVybCk7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5kZXZTZXJ2ZXJUYXJnZXQpIHtcbiAgICAgICAgICBjb25zdCByZXN1bHQ6IERldlNlcnZlclJlc3VsdCB8IHVuZGVmaW5lZCA9IGJ1aWxkRXZlbnQucmVzdWx0O1xuXG4gICAgICAgICAgYmFzZVVybCA9IHVybC5mb3JtYXQoe1xuICAgICAgICAgICAgcHJvdG9jb2w6IGJ1aWxkZXJDb25maWcub3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnLFxuICAgICAgICAgICAgaG9zdG5hbWU6IG9wdGlvbnMuaG9zdCxcbiAgICAgICAgICAgIHBvcnQ6IHJlc3VsdCAmJiByZXN1bHQucG9ydC50b1N0cmluZygpLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2F2ZSB0aGUgY29tcHV0ZWQgYmFzZVVybCBiYWNrIHNvIHRoYXQgUHJvdHJhY3RvciBjYW4gdXNlIGl0LlxuICAgICAgICBvcHRpb25zLmJhc2VVcmwgPSBiYXNlVXJsO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgX3VwZGF0ZVdlYmRyaXZlcihwcm9qZWN0Um9vdDogUGF0aCkge1xuICAgIC8vIFRoZSB3ZWJkcml2ZXItbWFuYWdlciB1cGRhdGUgY29tbWFuZCBjYW4gb25seSBiZSBhY2Nlc3NlZCB2aWEgYSBkZWVwIGltcG9ydC5cbiAgICBjb25zdCB3ZWJkcml2ZXJEZWVwSW1wb3J0ID0gJ3dlYmRyaXZlci1tYW5hZ2VyL2J1aWx0L2xpYi9jbWRzL3VwZGF0ZSc7XG4gICAgbGV0IHdlYmRyaXZlclVwZGF0ZTogYW55OyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFdoZW4gdXNpbmcgbnBtLCB3ZWJkcml2ZXIgaXMgd2l0aGluIHByb3RyYWN0b3Ivbm9kZV9tb2R1bGVzLlxuICAgICAgd2ViZHJpdmVyVXBkYXRlID0gcmVxdWlyZVByb2plY3RNb2R1bGUoZ2V0U3lzdGVtUGF0aChwcm9qZWN0Um9vdCksXG4gICAgICAgIGBwcm90cmFjdG9yL25vZGVfbW9kdWxlcy8ke3dlYmRyaXZlckRlZXBJbXBvcnR9YCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyBXaGVuIHVzaW5nIHlhcm4sIHdlYmRyaXZlciBpcyBmb3VuZCBhcyBhIHJvb3QgbW9kdWxlLlxuICAgICAgICB3ZWJkcml2ZXJVcGRhdGUgPSByZXF1aXJlUHJvamVjdE1vZHVsZShnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSwgd2ViZHJpdmVyRGVlcEltcG9ydCk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgICAgIENhbm5vdCBhdXRvbWF0aWNhbGx5IGZpbmQgd2ViZHJpdmVyLW1hbmFnZXIgdG8gdXBkYXRlLlxuICAgICAgICAgIFVwZGF0ZSB3ZWJkcml2ZXItbWFuYWdlciBtYW51YWxseSBhbmQgcnVuICduZyBlMmUgLS1uby13ZWJkcml2ZXItdXBkYXRlJyBpbnN0ZWFkLlxuICAgICAgICBgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBydW4gYHdlYmRyaXZlci1tYW5hZ2VyIHVwZGF0ZSAtLXN0YW5kYWxvbmUgZmFsc2UgLS1nZWNrbyBmYWxzZSAtLXF1aWV0YFxuICAgIC8vIGlmIHlvdSBjaGFuZ2UgdGhpcywgdXBkYXRlIHRoZSBjb21tYW5kIGNvbW1lbnQgaW4gcHJldiBsaW5lLCBhbmQgaW4gYGVqZWN0YCB0YXNrXG4gICAgcmV0dXJuIGZyb20od2ViZHJpdmVyVXBkYXRlLnByb2dyYW0ucnVuKHtcbiAgICAgIHN0YW5kYWxvbmU6IGZhbHNlLFxuICAgICAgZ2Vja286IGZhbHNlLFxuICAgICAgcXVpZXQ6IHRydWUsXG4gICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcnVuUHJvdHJhY3Rvcihyb290OiBQYXRoLCBvcHRpb25zOiBQcm90cmFjdG9yQnVpbGRlck9wdGlvbnMpOiBPYnNlcnZhYmxlPEJ1aWxkRXZlbnQ+IHtcbiAgICBjb25zdCBhZGRpdGlvbmFsUHJvdHJhY3RvckNvbmZpZzogUGFydGlhbDxQcm90cmFjdG9yQnVpbGRlck9wdGlvbnM+ID0ge1xuICAgICAgZWxlbWVudEV4cGxvcmVyOiBvcHRpb25zLmVsZW1lbnRFeHBsb3JlcixcbiAgICAgIGJhc2VVcmw6IG9wdGlvbnMuYmFzZVVybCxcbiAgICAgIHNwZWNzOiBvcHRpb25zLnNwZWNzLmxlbmd0aCA/IG9wdGlvbnMuc3BlY3MgOiB1bmRlZmluZWQsXG4gICAgICBzdWl0ZTogb3B0aW9ucy5zdWl0ZSxcbiAgICB9O1xuXG4gICAgLy8gVE9ETzogUHJvdHJhY3RvciBtYW5hZ2VzIHByb2Nlc3MuZXhpdCBpdHNlbGYsIHNvIHRoaXMgdGFyZ2V0IHdpbGwgYWxsd2F5cyBxdWl0IHRoZVxuICAgIC8vIHByb2Nlc3MuIFRvIHdvcmsgYXJvdW5kIHRoaXMgd2UgcnVuIGl0IGluIGEgc3VicHJvY2Vzcy5cbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9wcm90cmFjdG9yL2lzc3Vlcy80MTYwXG4gICAgcmV0dXJuIHJ1bk1vZHVsZUFzT2JzZXJ2YWJsZUZvcmsoXG4gICAgICBnZXRTeXN0ZW1QYXRoKHJvb3QpLFxuICAgICAgJ3Byb3RyYWN0b3IvYnVpbHQvbGF1bmNoZXInLFxuICAgICAgJ2luaXQnLFxuICAgICAgW1xuICAgICAgICBnZXRTeXN0ZW1QYXRoKHJlc29sdmUocm9vdCwgbm9ybWFsaXplKG9wdGlvbnMucHJvdHJhY3RvckNvbmZpZykpKSxcbiAgICAgICAgYWRkaXRpb25hbFByb3RyYWN0b3JDb25maWcsXG4gICAgICBdLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJvdHJhY3RvckJ1aWxkZXI7XG4iXX0=