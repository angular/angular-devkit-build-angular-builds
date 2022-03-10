"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = void 0;
const architect_1 = require("@angular-devkit/architect");
const core_1 = require("@angular-devkit/core");
const path_1 = require("path");
const url = __importStar(require("url"));
const utils_1 = require("../../utils");
function runProtractor(root, options) {
    const additionalProtractorConfig = {
        baseUrl: options.baseUrl,
        specs: options.specs && options.specs.length ? options.specs : undefined,
        suite: options.suite,
        jasmineNodeOpts: {
            grep: options.grep,
            invertGrep: options.invertGrep,
        },
    };
    // TODO: Protractor manages process.exit itself, so this target will allways quit the
    // process. To work around this we run it in a subprocess.
    // https://github.com/angular/protractor/issues/4160
    return (0, utils_1.runModuleAsObservableFork)(root, 'protractor/built/launcher', 'init', [
        (0, path_1.resolve)(root, options.protractorConfig),
        additionalProtractorConfig,
    ]).toPromise();
}
async function updateWebdriver() {
    // The webdriver-manager update command can only be accessed via a deep import.
    const webdriverDeepImport = 'webdriver-manager/built/lib/cmds/update';
    let path;
    try {
        const protractorPath = require.resolve('protractor');
        path = require.resolve(webdriverDeepImport, { paths: [protractorPath] });
    }
    catch (error) {
        if (error.code !== 'MODULE_NOT_FOUND') {
            throw error;
        }
    }
    if (!path) {
        throw new Error(core_1.tags.stripIndents `
      Cannot automatically find webdriver-manager to update.
      Update webdriver-manager manually and run 'ng e2e --no-webdriver-update' instead.
    `);
    }
    const webdriverUpdate = await Promise.resolve().then(() => __importStar(require(path)));
    // const webdriverUpdate = await import(path) as typeof import ('webdriver-manager/built/lib/cmds/update');
    // run `webdriver-manager update --standalone false --gecko false --quiet`
    // if you change this, update the command comment in prev line
    return webdriverUpdate.program.run({
        standalone: false,
        gecko: false,
        quiet: true,
    });
}
/**
 * @experimental Direct usage of this function is considered experimental.
 */
async function execute(options, context) {
    context.logger.warn('Protractor has been deprecated including its support in the Angular CLI. For additional information and alternatives, please see https://github.com/angular/protractor/issues/5502.');
    // ensure that only one of these options is used
    if (options.devServerTarget && options.baseUrl) {
        throw new Error(core_1.tags.stripIndents `
    The 'baseUrl' option cannot be used with 'devServerTarget'.
    When present, 'devServerTarget' will be used to automatically setup 'baseUrl' for Protractor.
    `);
    }
    if (options.webdriverUpdate) {
        await updateWebdriver();
    }
    let baseUrl = options.baseUrl;
    let server;
    if (options.devServerTarget) {
        const target = (0, architect_1.targetFromTargetString)(options.devServerTarget);
        const serverOptions = await context.getTargetOptions(target);
        const overrides = {
            watch: false,
            liveReload: false,
        };
        if (options.host !== undefined) {
            overrides.host = options.host;
        }
        else if (typeof serverOptions.host === 'string') {
            options.host = serverOptions.host;
        }
        else {
            options.host = overrides.host = 'localhost';
        }
        if (options.port !== undefined) {
            overrides.port = options.port;
        }
        else if (typeof serverOptions.port === 'number') {
            options.port = serverOptions.port;
        }
        server = await context.scheduleTarget(target, overrides);
        const result = await server.result;
        if (!result.success) {
            return { success: false };
        }
        if (typeof serverOptions.publicHost === 'string') {
            let publicHost = serverOptions.publicHost;
            if (!/^\w+:\/\//.test(publicHost)) {
                publicHost = `${serverOptions.ssl ? 'https' : 'http'}://${publicHost}`;
            }
            const clientUrl = url.parse(publicHost);
            baseUrl = url.format(clientUrl);
        }
        else if (typeof result.baseUrl === 'string') {
            baseUrl = result.baseUrl;
        }
        else if (typeof result.port === 'number') {
            baseUrl = url.format({
                protocol: serverOptions.ssl ? 'https' : 'http',
                hostname: options.host,
                port: result.port.toString(),
            });
        }
    }
    // Like the baseUrl in protractor config file when using the API we need to add
    // a trailing slash when provide to the baseUrl.
    if (baseUrl && !baseUrl.endsWith('/')) {
        baseUrl += '/';
    }
    try {
        return await runProtractor(context.workspaceRoot, { ...options, baseUrl });
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
exports.default = (0, architect_1.createBuilder)(execute);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9wcm90cmFjdG9yL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBS21DO0FBQ25DLCtDQUFrRDtBQUNsRCwrQkFBK0I7QUFDL0IseUNBQTJCO0FBQzNCLHVDQUF3RDtBQVd4RCxTQUFTLGFBQWEsQ0FBQyxJQUFZLEVBQUUsT0FBaUM7SUFDcEUsTUFBTSwwQkFBMEIsR0FBaUU7UUFDL0YsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPO1FBQ3hCLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSyxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTO1FBQ3hFLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSztRQUNwQixlQUFlLEVBQUU7WUFDZixJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7WUFDbEIsVUFBVSxFQUFFLE9BQU8sQ0FBQyxVQUFVO1NBQy9CO0tBQ0YsQ0FBQztJQUVGLHFGQUFxRjtJQUNyRiwwREFBMEQ7SUFDMUQsb0RBQW9EO0lBQ3BELE9BQU8sSUFBQSxpQ0FBeUIsRUFBQyxJQUFJLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSxFQUFFO1FBQzFFLElBQUEsY0FBTyxFQUFDLElBQUksRUFBRSxPQUFPLENBQUMsZ0JBQWdCLENBQUM7UUFDdkMsMEJBQTBCO0tBQzNCLENBQUMsQ0FBQyxTQUFTLEVBQTRCLENBQUM7QUFDM0MsQ0FBQztBQUVELEtBQUssVUFBVSxlQUFlO0lBQzVCLCtFQUErRTtJQUMvRSxNQUFNLG1CQUFtQixHQUFHLHlDQUF5QyxDQUFDO0lBRXRFLElBQUks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QUUsQ0FBQyxDQUFDO0tBQzVFO0lBQUMsV0FBTTtRQUNOLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUM7S0FDM0I7WUFBUztRQUNSLElBQUksTUFBTSxFQUFFO1lBQ1YsTUFBTSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7U0FDckI7S0FDRjtBQUNILENBQUM7QUFwRkQsMEJBb0ZDO0FBRUQsa0JBQWUsSUFBQSx5QkFBYSxFQUEyQixPQUFPLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZGVyQ29udGV4dCxcbiAgQnVpbGRlck91dHB1dCxcbiAgY3JlYXRlQnVpbGRlcixcbiAgdGFyZ2V0RnJvbVRhcmdldFN0cmluZyxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBqc29uLCB0YWdzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgdXJsIGZyb20gJ3VybCc7XG5pbXBvcnQgeyBydW5Nb2R1bGVBc09ic2VydmFibGVGb3JrIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgRGV2U2VydmVyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuLi9kZXYtc2VydmVyL2luZGV4JztcbmltcG9ydCB7IFNjaGVtYSBhcyBQcm90cmFjdG9yQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmludGVyZmFjZSBKYXNtaW5lTm9kZU9wdHMge1xuICBqYXNtaW5lTm9kZU9wdHM6IHtcbiAgICBncmVwPzogc3RyaW5nO1xuICAgIGludmVydEdyZXA/OiBib29sZWFuO1xuICB9O1xufVxuXG5mdW5jdGlvbiBydW5Qcm90cmFjdG9yKHJvb3Q6IHN0cmluZywgb3B0aW9uczogUHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zKTogUHJvbWlzZTxCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnN0IGFkZGl0aW9uYWxQcm90cmFjdG9yQ29uZmlnOiBQYXJ0aWFsPFByb3RyYWN0b3JCdWlsZGVyT3B0aW9ucz4gJiBQYXJ0aWFsPEphc21pbmVOb2RlT3B0cz4gPSB7XG4gICAgYmFzZVVybDogb3B0aW9ucy5iYXNlVXJsLFxuICAgIHNwZWNzOiBvcHRpb25zLnNwZWNzICYmIG9wdGlvbnMuc3BlY3MubGVuZ3RoID8gb3B0aW9ucy5zcGVjcyA6IHVuZGVmaW5lZCxcbiAgICBzdWl0ZTogb3B0aW9ucy5zdWl0ZSxcbiAgICBqYXNtaW5lTm9kZU9wdHM6IHtcbiAgICAgIGdyZXA6IG9wdGlvbnMuZ3JlcCxcbiAgICAgIGludmVydEdyZXA6IG9wdGlvbnMuaW52ZXJ0R3JlcCxcbiAgICB9LFxuICB9O1xuXG4gIC8vIFRPRE86IFByb3RyYWN0b3IgbWFuYWdlcyBwcm9jZXNzLmV4aXQgaXRzZWxmLCBzbyB0aGlzIHRhcmdldCB3aWxsIGFsbHdheXMgcXVpdCB0aGVcbiAgLy8gcHJvY2Vzcy4gVG8gd29yayBhcm91bmQgdGhpcyB3ZSBydW4gaXQgaW4gYSBzdWJwcm9jZXNzLlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9wcm90cmFjdG9yL2lzc3Vlcy80MTYwXG4gIHJldHVybiBydW5Nb2R1bGVBc09ic2VydmFibGVGb3JrKHJvb3QsICdwcm90cmFjdG9yL2J1aWx0L2xhdW5jaGVyJywgJ2luaXQnLCBbXG4gICAgcmVzb2x2ZShyb290LCBvcHRpb25zLnByb3RyYWN0b3JDb25maWcpLFxuICAgIGFkZGl0aW9uYWxQcm90cmFjdG9yQ29uZmlnLFxuICBdKS50b1Byb21pc2UoKSBhcyBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+O1xufVxuXG5hc3luYyBmdW5jdGlvbiB1cGRhdGVXZWJkcml2ZXIoKSB7XG4gIC8vIFRoZSB3ZWJkcml2ZXItbWFuYWdlciB1cGRhdGUgY29tbWFuZCBjYW4gb25seSBiZSBhY2Nlc3NlZCB2aWEgYSBkZWVwIGltcG9ydC5cbiAgY29uc3Qgd2ViZHJpdmVyRGVlcEltcG9ydCA9ICd3ZWJkcml2ZXItbWFuYWdlci9idWlsdC9saWIvY21kcy91cGRhdGUnO1xuXG4gIGxldCBwYXRoO1xuICB0cnkge1xuICAgIGNvbnN0IHByb3RyYWN0b3JQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCdwcm90cmFjdG9yJyk7XG5cbiAgICBwYXRoID0gcmVxdWlyZS5yZXNvbHZlKHdlYmRyaXZlckRlZXBJbXBvcnQsIHsgcGF0aHM6IFtwcm90cmFjdG9yUGF0aF0gfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yLmNvZGUgIT09ICdNT0RVTEVfTk9UX0ZPVU5EJykge1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgaWYgKCFwYXRoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgICAgQ2Fubm90IGF1dG9tYXRpY2FsbHkgZmluZCB3ZWJkcml2ZXItbWFuYWdlciB0byB1cGRhdGUuXG4gICAgICBVcGRhdGUgd2ViZHJpdmVyLW1hbmFnZXIgbWFudWFsbHkgYW5kIHJ1biAnbmcgZTJlIC0tbm8td2ViZHJpdmVyLXVwZGF0ZScgaW5zdGVhZC5cbiAgICBgKTtcbiAgfVxuXG4gIGNvbnN0IHdlYmRyaXZlclVwZGF0ZSA9IGF3YWl0IGltcG9ydChwYXRoKTtcbiAgLy8gY29uc3Qgd2ViZHJpdmVyVXBkYXRlID0gYXdhaXQgaW1wb3J0KHBhdGgpIGFzIHR5cGVvZiBpbXBvcnQgKCd3ZWJkcml2ZXItbWFuYWdlci9idWlsdC9saWIvY21kcy91cGRhdGUnKTtcblxuICAvLyBydW4gYHdlYmRyaXZlci1tYW5hZ2VyIHVwZGF0ZSAtLXN0YW5kYWxvbmUgZmFsc2UgLS1nZWNrbyBmYWxzZSAtLXF1aWV0YFxuICAvLyBpZiB5b3UgY2hhbmdlIHRoaXMsIHVwZGF0ZSB0aGUgY29tbWFuZCBjb21tZW50IGluIHByZXYgbGluZVxuICByZXR1cm4gd2ViZHJpdmVyVXBkYXRlLnByb2dyYW0ucnVuKHtcbiAgICBzdGFuZGFsb25lOiBmYWxzZSxcbiAgICBnZWNrbzogZmFsc2UsXG4gICAgcXVpZXQ6IHRydWUsXG4gIH0gYXMgdW5rbm93biBhcyBKU09OKTtcbn1cblxuZXhwb3J0IHsgUHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zIH07XG5cbi8qKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IFByb3RyYWN0b3JCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAnUHJvdHJhY3RvciBoYXMgYmVlbiBkZXByZWNhdGVkIGluY2x1ZGluZyBpdHMgc3VwcG9ydCBpbiB0aGUgQW5ndWxhciBDTEkuIEZvciBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGFuZCBhbHRlcm5hdGl2ZXMsIHBsZWFzZSBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvcHJvdHJhY3Rvci9pc3N1ZXMvNTUwMi4nLFxuICApO1xuXG4gIC8vIGVuc3VyZSB0aGF0IG9ubHkgb25lIG9mIHRoZXNlIG9wdGlvbnMgaXMgdXNlZFxuICBpZiAob3B0aW9ucy5kZXZTZXJ2ZXJUYXJnZXQgJiYgb3B0aW9ucy5iYXNlVXJsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKHRhZ3Muc3RyaXBJbmRlbnRzYFxuICAgIFRoZSAnYmFzZVVybCcgb3B0aW9uIGNhbm5vdCBiZSB1c2VkIHdpdGggJ2RldlNlcnZlclRhcmdldCcuXG4gICAgV2hlbiBwcmVzZW50LCAnZGV2U2VydmVyVGFyZ2V0JyB3aWxsIGJlIHVzZWQgdG8gYXV0b21hdGljYWxseSBzZXR1cCAnYmFzZVVybCcgZm9yIFByb3RyYWN0b3IuXG4gICAgYCk7XG4gIH1cblxuICBpZiAob3B0aW9ucy53ZWJkcml2ZXJVcGRhdGUpIHtcbiAgICBhd2FpdCB1cGRhdGVXZWJkcml2ZXIoKTtcbiAgfVxuXG4gIGxldCBiYXNlVXJsID0gb3B0aW9ucy5iYXNlVXJsO1xuICBsZXQgc2VydmVyO1xuICBpZiAob3B0aW9ucy5kZXZTZXJ2ZXJUYXJnZXQpIHtcbiAgICBjb25zdCB0YXJnZXQgPSB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nKG9wdGlvbnMuZGV2U2VydmVyVGFyZ2V0KTtcbiAgICBjb25zdCBzZXJ2ZXJPcHRpb25zID0gYXdhaXQgY29udGV4dC5nZXRUYXJnZXRPcHRpb25zKHRhcmdldCk7XG5cbiAgICBjb25zdCBvdmVycmlkZXMgPSB7XG4gICAgICB3YXRjaDogZmFsc2UsXG4gICAgICBsaXZlUmVsb2FkOiBmYWxzZSxcbiAgICB9IGFzIERldlNlcnZlckJ1aWxkZXJPcHRpb25zICYganNvbi5Kc29uT2JqZWN0O1xuXG4gICAgaWYgKG9wdGlvbnMuaG9zdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBvdmVycmlkZXMuaG9zdCA9IG9wdGlvbnMuaG9zdDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZXJ2ZXJPcHRpb25zLmhvc3QgPT09ICdzdHJpbmcnKSB7XG4gICAgICBvcHRpb25zLmhvc3QgPSBzZXJ2ZXJPcHRpb25zLmhvc3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdGlvbnMuaG9zdCA9IG92ZXJyaWRlcy5ob3N0ID0gJ2xvY2FsaG9zdCc7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMucG9ydCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBvdmVycmlkZXMucG9ydCA9IG9wdGlvbnMucG9ydDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZXJ2ZXJPcHRpb25zLnBvcnQgPT09ICdudW1iZXInKSB7XG4gICAgICBvcHRpb25zLnBvcnQgPSBzZXJ2ZXJPcHRpb25zLnBvcnQ7XG4gICAgfVxuXG4gICAgc2VydmVyID0gYXdhaXQgY29udGV4dC5zY2hlZHVsZVRhcmdldCh0YXJnZXQsIG92ZXJyaWRlcyk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc2VydmVyLnJlc3VsdDtcbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygc2VydmVyT3B0aW9ucy5wdWJsaWNIb3N0ID09PSAnc3RyaW5nJykge1xuICAgICAgbGV0IHB1YmxpY0hvc3QgPSBzZXJ2ZXJPcHRpb25zLnB1YmxpY0hvc3QgYXMgc3RyaW5nO1xuICAgICAgaWYgKCEvXlxcdys6XFwvXFwvLy50ZXN0KHB1YmxpY0hvc3QpKSB7XG4gICAgICAgIHB1YmxpY0hvc3QgPSBgJHtzZXJ2ZXJPcHRpb25zLnNzbCA/ICdodHRwcycgOiAnaHR0cCd9Oi8vJHtwdWJsaWNIb3N0fWA7XG4gICAgICB9XG4gICAgICBjb25zdCBjbGllbnRVcmwgPSB1cmwucGFyc2UocHVibGljSG9zdCk7XG4gICAgICBiYXNlVXJsID0gdXJsLmZvcm1hdChjbGllbnRVcmwpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHJlc3VsdC5iYXNlVXJsID09PSAnc3RyaW5nJykge1xuICAgICAgYmFzZVVybCA9IHJlc3VsdC5iYXNlVXJsO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHJlc3VsdC5wb3J0ID09PSAnbnVtYmVyJykge1xuICAgICAgYmFzZVVybCA9IHVybC5mb3JtYXQoe1xuICAgICAgICBwcm90b2NvbDogc2VydmVyT3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnLFxuICAgICAgICBob3N0bmFtZTogb3B0aW9ucy5ob3N0LFxuICAgICAgICBwb3J0OiByZXN1bHQucG9ydC50b1N0cmluZygpLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gTGlrZSB0aGUgYmFzZVVybCBpbiBwcm90cmFjdG9yIGNvbmZpZyBmaWxlIHdoZW4gdXNpbmcgdGhlIEFQSSB3ZSBuZWVkIHRvIGFkZFxuICAvLyBhIHRyYWlsaW5nIHNsYXNoIHdoZW4gcHJvdmlkZSB0byB0aGUgYmFzZVVybC5cbiAgaWYgKGJhc2VVcmwgJiYgIWJhc2VVcmwuZW5kc1dpdGgoJy8nKSkge1xuICAgIGJhc2VVcmwgKz0gJy8nO1xuICB9XG5cbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgcnVuUHJvdHJhY3Rvcihjb250ZXh0LndvcmtzcGFjZVJvb3QsIHsgLi4ub3B0aW9ucywgYmFzZVVybCB9KTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoc2VydmVyKSB7XG4gICAgICBhd2FpdCBzZXJ2ZXIuc3RvcCgpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyPFByb3RyYWN0b3JCdWlsZGVyT3B0aW9ucz4oZXhlY3V0ZSk7XG4iXX0=