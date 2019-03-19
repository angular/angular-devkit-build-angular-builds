"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const index2_1 = require("@angular-devkit/architect/src/index2");
const core_1 = require("@angular-devkit/core");
const path_1 = require("path");
const url = require("url");
const utils_1 = require("../utils");
function runProtractor(root, options) {
    const additionalProtractorConfig = {
        elementExplorer: options.elementExplorer,
        baseUrl: options.baseUrl,
        specs: options.specs && options.specs.length ? options.specs : undefined,
        suite: options.suite,
    };
    // TODO: Protractor manages process.exit itself, so this target will allways quit the
    // process. To work around this we run it in a subprocess.
    // https://github.com/angular/protractor/issues/4160
    return utils_1.runModuleAsObservableFork(root, 'protractor/built/launcher', 'init', [path_1.resolve(root, options.protractorConfig), additionalProtractorConfig]).toPromise();
}
async function updateWebdriver() {
    // The webdriver-manager update command can only be accessed via a deep import.
    const webdriverDeepImport = 'webdriver-manager/built/lib/cmds/update';
    const importOptions = [
        // When using npm, webdriver is within protractor/node_modules.
        `protractor/node_modules/${webdriverDeepImport}`,
        // When using yarn, webdriver is found as a root module.
        webdriverDeepImport,
    ];
    let path;
    for (const importOption of importOptions) {
        try {
            path = require.resolve(importOption);
        }
        catch (error) {
            if (error.code !== 'MODULE_NOT_FOUND') {
                throw error;
            }
        }
    }
    if (!path) {
        throw new Error(core_1.tags.stripIndents `
      Cannot automatically find webdriver-manager to update.
      Update webdriver-manager manually and run 'ng e2e --no-webdriver-update' instead.
    `);
    }
    // tslint:disable-next-line:max-line-length no-implicit-dependencies
    const webdriverUpdate = await Promise.resolve().then(() => require(path));
    // run `webdriver-manager update --standalone false --gecko false --quiet`
    // if you change this, update the command comment in prev line
    return webdriverUpdate.program.run({
        standalone: false,
        gecko: false,
        quiet: true,
    });
}
async function execute(options, context) {
    // ensure that only one of these options is used
    if (options.devServerTarget && options.baseUrl) {
        throw new Error(core_1.tags.stripIndents `
    The 'baseUrl' option cannot be used with 'devServerTarget'.
    When present, 'devServerTarget' will be used to automatically setup 'baseUrl' for Protractor.
    `);
    }
    if (options.webdriverUpdate) {
        try {
            await updateWebdriver();
        }
        catch (error) {
            context.reportStatus('Error: ' + error);
            return { success: false };
        }
    }
    let baseUrl;
    let server;
    if (options.devServerTarget) {
        const target = index2_1.targetFromTargetString(options.devServerTarget);
        const serverOptions = await context.getTargetOptions(target);
        const overrides = { watch: false };
        if (options.host !== undefined) {
            overrides.host = options.host;
        }
        if (options.port !== undefined) {
            overrides.port = options.port;
        }
        server = await context.scheduleTarget(target, overrides);
        let result;
        try {
            result = await server.result;
        }
        catch (error) {
            context.reportStatus('Error: ' + error);
        }
        if (!result || !result.success) {
            return { success: false };
        }
        if (typeof serverOptions.publicHost === 'string') {
            let publicHost = serverOptions.publicHost;
            if (!/^\w+:\/\//.test(publicHost)) {
                publicHost = `${serverOptions.ssl
                    ? 'https'
                    : 'http'}://${publicHost}`;
            }
            const clientUrl = url.parse(publicHost);
            baseUrl = url.format(clientUrl);
        }
        else if (typeof result.port === 'number') {
            baseUrl = url.format({
                protocol: serverOptions.ssl ? 'https' : 'http',
                hostname: options.host,
                port: result.port.toString(),
            });
        }
    }
    try {
        return await runProtractor(context.workspaceRoot, Object.assign({}, options, { baseUrl }));
    }
    catch (_a) {
        return { success: false };
    }
    finally {
        if (server) {
            await server.stop();
        }
    }
}
exports.execute = execute;
exports.default = index2_1.createBuilder(execute);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9wcm90cmFjdG9yL2luZGV4Mi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILGlFQUs4QztBQUM5QywrQ0FBd0Q7QUFDeEQsK0JBQStCO0FBQy9CLDJCQUEyQjtBQUMzQixvQ0FBcUQ7QUFHckQsU0FBUyxhQUFhLENBQUMsSUFBWSxFQUFFLE9BQWlDO0lBQ3BFLE1BQU0sMEJBQTBCLEdBQXNDO1FBQ3BFLGVBQWUsRUFBRSxPQUFPLENBQUMsZUFBZTtRQUN4QyxPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU87UUFDeEIsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVM7UUFDeEUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO0tBQ3JCLENBQUM7SUFFRixxRkFBcUY7SUFDckYsMERBQTBEO0lBQzFELG9EQUFvRDtJQUNwRCxPQUFPLGlDQUF5QixDQUM5QixJQUFJLEVBQ0osMkJBQTJCLEVBQzNCLE1BQU0sRUFDTixDQUFDLGNBQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEVBQUUsMEJBQTBCLENBQUMsQ0FDdEUsQ0FBQyxTQUFTLEVBQTRCLENBQUM7QUFDMUMsQ0FBQztBQUVELEtBQUssVUFBVSxlQUFlO0lBQzVCLCtFQUErRTtJQUMvRSxNQUFNLG1CQUFtQixHQUFHLHlDQUF5QyxDQUFDO0lBQ3RFLE1BQU0sYUFBYSxHQUFHO1FBQ3BCLCtEQUErRDtRQUMvRCwyQkFBMkIsbUJBQW1CLEVBQUU7UUFDaEQsd0RBQXdEO1FBQ3hELG1CQUFtQjtLQUNwQixDQUFDO0lBRUYsSUFBSSxJQUFJLENBQUM7SUFDVCxLQUFLLE1B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O29CQUNULENBQUMsQ0FBQyxNQUFNLE1BQU0sVUFBVSxFQUFFLENBQUM7YUFDOUI7WUFDRCxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3hDLE9BQU8sR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQ2pDO2FBQU0sSUFBSSxPQUFPLE1BQU0sQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO1lBQzFDLE9BQU8sR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO2dCQUNuQixRQUFRLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNO2dCQUM5QyxRQUFRLEVBQUUsT0FBTyxDQUFDLElBQUk7Z0JBQ3RCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRTthQUM3QixDQUFDLENBQUM7U0FDSjtLQUNGO0lBRUQsSUFBSTtRQUNGLE9BQU8sTUFBTSxhQUFhLENBQUMsT0FBTyxDQUFDLGFBQWEsb0JBQU8sT0FBTyxJQUFFLE9BQU8sSUFBRyxDQUFDO0tBQzVFO0lBQUMsV0FBTTtRQUNOLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUM7S0FDM0I7WUFBUztRQUNSLElBQUksTUFBTSxFQUFFO1lBQ1YsTUFBTSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7U0FDckI7S0FDRjtBQUNILENBQUM7QUF2RUQsMEJBdUVDO0FBRUQsa0JBQWUsc0JBQWEsQ0FBd0MsT0FBTyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge1xuICBCdWlsZGVyQ29udGV4dCxcbiAgQnVpbGRlck91dHB1dCxcbiAgY3JlYXRlQnVpbGRlcixcbiAgdGFyZ2V0RnJvbVRhcmdldFN0cmluZyxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdC9zcmMvaW5kZXgyJztcbmltcG9ydCB7IEpzb25PYmplY3QsIHRhZ3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcbmltcG9ydCB7IHJ1bk1vZHVsZUFzT2JzZXJ2YWJsZUZvcmsgfSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgUHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5mdW5jdGlvbiBydW5Qcm90cmFjdG9yKHJvb3Q6IHN0cmluZywgb3B0aW9uczogUHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zKTogUHJvbWlzZTxCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnN0IGFkZGl0aW9uYWxQcm90cmFjdG9yQ29uZmlnOiBQYXJ0aWFsPFByb3RyYWN0b3JCdWlsZGVyT3B0aW9ucz4gPSB7XG4gICAgZWxlbWVudEV4cGxvcmVyOiBvcHRpb25zLmVsZW1lbnRFeHBsb3JlcixcbiAgICBiYXNlVXJsOiBvcHRpb25zLmJhc2VVcmwsXG4gICAgc3BlY3M6IG9wdGlvbnMuc3BlY3MgJiYgb3B0aW9ucy5zcGVjcy5sZW5ndGggPyBvcHRpb25zLnNwZWNzIDogdW5kZWZpbmVkLFxuICAgIHN1aXRlOiBvcHRpb25zLnN1aXRlLFxuICB9O1xuXG4gIC8vIFRPRE86IFByb3RyYWN0b3IgbWFuYWdlcyBwcm9jZXNzLmV4aXQgaXRzZWxmLCBzbyB0aGlzIHRhcmdldCB3aWxsIGFsbHdheXMgcXVpdCB0aGVcbiAgLy8gcHJvY2Vzcy4gVG8gd29yayBhcm91bmQgdGhpcyB3ZSBydW4gaXQgaW4gYSBzdWJwcm9jZXNzLlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9wcm90cmFjdG9yL2lzc3Vlcy80MTYwXG4gIHJldHVybiBydW5Nb2R1bGVBc09ic2VydmFibGVGb3JrKFxuICAgIHJvb3QsXG4gICAgJ3Byb3RyYWN0b3IvYnVpbHQvbGF1bmNoZXInLFxuICAgICdpbml0JyxcbiAgICBbcmVzb2x2ZShyb290LCBvcHRpb25zLnByb3RyYWN0b3JDb25maWcpLCBhZGRpdGlvbmFsUHJvdHJhY3RvckNvbmZpZ10sXG4gICkudG9Qcm9taXNlKCkgYXMgUHJvbWlzZTxCdWlsZGVyT3V0cHV0Pjtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdXBkYXRlV2ViZHJpdmVyKCkge1xuICAvLyBUaGUgd2ViZHJpdmVyLW1hbmFnZXIgdXBkYXRlIGNvbW1hbmQgY2FuIG9ubHkgYmUgYWNjZXNzZWQgdmlhIGEgZGVlcCBpbXBvcnQuXG4gIGNvbnN0IHdlYmRyaXZlckRlZXBJbXBvcnQgPSAnd2ViZHJpdmVyLW1hbmFnZXIvYnVpbHQvbGliL2NtZHMvdXBkYXRlJztcbiAgY29uc3QgaW1wb3J0T3B0aW9ucyA9IFtcbiAgICAvLyBXaGVuIHVzaW5nIG5wbSwgd2ViZHJpdmVyIGlzIHdpdGhpbiBwcm90cmFjdG9yL25vZGVfbW9kdWxlcy5cbiAgICBgcHJvdHJhY3Rvci9ub2RlX21vZHVsZXMvJHt3ZWJkcml2ZXJEZWVwSW1wb3J0fWAsXG4gICAgLy8gV2hlbiB1c2luZyB5YXJuLCB3ZWJkcml2ZXIgaXMgZm91bmQgYXMgYSByb290IG1vZHVsZS5cbiAgICB3ZWJkcml2ZXJEZWVwSW1wb3J0LFxuICBdO1xuXG4gIGxldCBwYXRoO1xuICBmb3IgKGNvbnN0IGltcG9ydE9wdGlvbiBvZiBpbXBvcnRPcHRpb25zKSB7XG4gICAgdHJ5IHtcbiAgICAgIHBhdGggPSByZXF1aXJlLnJlc29sdmUoaW1wb3J0T3B0aW9uKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKGVycm9yLmNvZGUgIT09ICdNT0RVTEVfTk9UX0ZPVU5EJykge1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoIXBhdGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IodGFncy5zdHJpcEluZGVudHNgXG4gICAgICBDYW5ub3QgYXV0b21hdGljYWxseSBmaW5kIHdlYmRyaXZlci1tYW5hZ2VyIHRvIHVwZGF0ZS5cbiAgICAgIFVwZGF0ZSB3ZWJkcml2ZXItbWFuYWdlciBtYW51YWxseSBhbmQgcnVuICduZyBlMmUgLS1uby13ZWJkcml2ZXItdXBkYXRlJyBpbnN0ZWFkLlxuICAgIGApO1xuICB9XG5cbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm1heC1saW5lLWxlbmd0aCBuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcbiAgY29uc3Qgd2ViZHJpdmVyVXBkYXRlID0gYXdhaXQgaW1wb3J0KHBhdGgpIGFzIHR5cGVvZiBpbXBvcnQgKCd3ZWJkcml2ZXItbWFuYWdlci9idWlsdC9saWIvY21kcy91cGRhdGUnKTtcblxuICAvLyBydW4gYHdlYmRyaXZlci1tYW5hZ2VyIHVwZGF0ZSAtLXN0YW5kYWxvbmUgZmFsc2UgLS1nZWNrbyBmYWxzZSAtLXF1aWV0YFxuICAvLyBpZiB5b3UgY2hhbmdlIHRoaXMsIHVwZGF0ZSB0aGUgY29tbWFuZCBjb21tZW50IGluIHByZXYgbGluZVxuICByZXR1cm4gd2ViZHJpdmVyVXBkYXRlLnByb2dyYW0ucnVuKHtcbiAgICBzdGFuZGFsb25lOiBmYWxzZSxcbiAgICBnZWNrbzogZmFsc2UsXG4gICAgcXVpZXQ6IHRydWUsXG4gIH0gYXMgdW5rbm93biBhcyBKU09OKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IFByb3RyYWN0b3JCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gZW5zdXJlIHRoYXQgb25seSBvbmUgb2YgdGhlc2Ugb3B0aW9ucyBpcyB1c2VkXG4gIGlmIChvcHRpb25zLmRldlNlcnZlclRhcmdldCAmJiBvcHRpb25zLmJhc2VVcmwpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IodGFncy5zdHJpcEluZGVudHNgXG4gICAgVGhlICdiYXNlVXJsJyBvcHRpb24gY2Fubm90IGJlIHVzZWQgd2l0aCAnZGV2U2VydmVyVGFyZ2V0Jy5cbiAgICBXaGVuIHByZXNlbnQsICdkZXZTZXJ2ZXJUYXJnZXQnIHdpbGwgYmUgdXNlZCB0byBhdXRvbWF0aWNhbGx5IHNldHVwICdiYXNlVXJsJyBmb3IgUHJvdHJhY3Rvci5cbiAgICBgKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLndlYmRyaXZlclVwZGF0ZSkge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB1cGRhdGVXZWJkcml2ZXIoKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29udGV4dC5yZXBvcnRTdGF0dXMoJ0Vycm9yOiAnICsgZXJyb3IpO1xuXG4gICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICAgIH1cbiAgfVxuXG4gIGxldCBiYXNlVXJsO1xuICBsZXQgc2VydmVyO1xuICBpZiAob3B0aW9ucy5kZXZTZXJ2ZXJUYXJnZXQpIHtcbiAgICBjb25zdCB0YXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuZGV2U2VydmVyVGFyZ2V0KTtcbiAgICBjb25zdCBzZXJ2ZXJPcHRpb25zID0gYXdhaXQgY29udGV4dC5nZXRUYXJnZXRPcHRpb25zKHRhcmdldCk7XG5cbiAgICBjb25zdCBvdmVycmlkZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4+ID0geyB3YXRjaDogZmFsc2UgfTtcbiAgICBpZiAob3B0aW9ucy5ob3N0ICE9PSB1bmRlZmluZWQpIHsgb3ZlcnJpZGVzLmhvc3QgPSBvcHRpb25zLmhvc3Q7IH1cbiAgICBpZiAob3B0aW9ucy5wb3J0ICE9PSB1bmRlZmluZWQpIHsgb3ZlcnJpZGVzLnBvcnQgPSBvcHRpb25zLnBvcnQ7IH1cbiAgICBzZXJ2ZXIgPSBhd2FpdCBjb250ZXh0LnNjaGVkdWxlVGFyZ2V0KHRhcmdldCwgb3ZlcnJpZGVzKTtcblxuICAgIGxldCByZXN1bHQ7XG4gICAgdHJ5IHtcbiAgICAgIHJlc3VsdCA9IGF3YWl0IHNlcnZlci5yZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnRleHQucmVwb3J0U3RhdHVzKCdFcnJvcjogJyArIGVycm9yKTtcbiAgICB9XG5cbiAgICBpZiAoIXJlc3VsdCB8fCAhcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBzZXJ2ZXJPcHRpb25zLnB1YmxpY0hvc3QgPT09ICdzdHJpbmcnKSB7XG4gICAgICBsZXQgcHVibGljSG9zdCA9IHNlcnZlck9wdGlvbnMucHVibGljSG9zdCBhcyBzdHJpbmc7XG4gICAgICBpZiAoIS9eXFx3KzpcXC9cXC8vLnRlc3QocHVibGljSG9zdCkpIHtcbiAgICAgICAgcHVibGljSG9zdCA9IGAke3NlcnZlck9wdGlvbnMuc3NsXG4gICAgICAgICAgPyAnaHR0cHMnXG4gICAgICAgICAgOiAnaHR0cCd9Oi8vJHtwdWJsaWNIb3N0fWA7XG4gICAgICB9XG4gICAgICBjb25zdCBjbGllbnRVcmwgPSB1cmwucGFyc2UocHVibGljSG9zdCk7XG4gICAgICBiYXNlVXJsID0gdXJsLmZvcm1hdChjbGllbnRVcmwpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHJlc3VsdC5wb3J0ID09PSAnbnVtYmVyJykge1xuICAgICAgYmFzZVVybCA9IHVybC5mb3JtYXQoe1xuICAgICAgICBwcm90b2NvbDogc2VydmVyT3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnLFxuICAgICAgICBob3N0bmFtZTogb3B0aW9ucy5ob3N0LFxuICAgICAgICBwb3J0OiByZXN1bHQucG9ydC50b1N0cmluZygpLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgcnVuUHJvdHJhY3Rvcihjb250ZXh0LndvcmtzcGFjZVJvb3QsIHsgLi4ub3B0aW9ucywgYmFzZVVybCB9KTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoc2VydmVyKSB7XG4gICAgICBhd2FpdCBzZXJ2ZXIuc3RvcCgpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyPEpzb25PYmplY3QgJiBQcm90cmFjdG9yQnVpbGRlck9wdGlvbnM+KGV4ZWN1dGUpO1xuIl19