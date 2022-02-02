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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9wcm90cmFjdG9yL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFLbUM7QUFDbkMsK0NBQTRDO0FBQzVDLCtCQUErQjtBQUMvQix5Q0FBMkI7QUFDM0IsdUNBQXdEO0FBV3hELFNBQVMsYUFBYSxDQUFDLElBQVksRUFBRSxPQUFpQztJQUNwRSxNQUFNLDBCQUEwQixHQUFpRTtRQUMvRixPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU87UUFDeEIsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVM7UUFDeEUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO1FBQ3BCLGVBQWUsRUFBRTtZQUNmLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtZQUNsQixVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVU7U0FDL0I7S0FDRixDQUFDO0lBRUYscUZBQXFGO0lBQ3JGLDBEQUEwRDtJQUMxRCxvREFBb0Q7SUFDcEQsT0FBTyxJQUFBLGlDQUF5QixFQUFDLElBQUksRUFBRSwyQkFBMkIsRUFBRSxNQUFNLEVBQUU7UUFDMUUsSUFBQSxjQUFPLEVBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQztRQUN2QywwQkFBMEI7S0FDM0IsQ0FBQyxDQUFDLFNBQVMsRUFBNEIsQ0FBQztBQUMzQyxDQUFDO0FBRUQsS0FBSyxVQUFVLGVBQWU7SUFDNUIsK0VBQStFO0lBQy9FLE1BQU0sbUJBQW1CLEdBQUcseUNBQXlDLENBQUM7SUFFdEUsSUFBSSxJQUFJ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QUMsQ0FBQztLQUM1RTtJQUFDLFdBQU07UUFDTixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO0tBQzNCO1lBQVM7UUFDUixJQUFJLE1BQU0sRUFBRTtZQUNWLE1BQU0sTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1NBQ3JCO0tBQ0Y7QUFDSCxDQUFDO0FBcEZELDBCQW9GQztBQUVELGtCQUFlLElBQUEseUJBQWEsRUFBMkIsT0FBTyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgQnVpbGRlckNvbnRleHQsXG4gIEJ1aWxkZXJPdXRwdXQsXG4gIGNyZWF0ZUJ1aWxkZXIsXG4gIHRhcmdldEZyb21UYXJnZXRTdHJpbmcsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgdGFncyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIHVybCBmcm9tICd1cmwnO1xuaW1wb3J0IHsgcnVuTW9kdWxlQXNPYnNlcnZhYmxlRm9yayB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IERldlNlcnZlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi4vZGV2LXNlcnZlci9pbmRleCc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgUHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5pbnRlcmZhY2UgSmFzbWluZU5vZGVPcHRzIHtcbiAgamFzbWluZU5vZGVPcHRzOiB7XG4gICAgZ3JlcD86IHN0cmluZztcbiAgICBpbnZlcnRHcmVwPzogYm9vbGVhbjtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcnVuUHJvdHJhY3Rvcihyb290OiBzdHJpbmcsIG9wdGlvbnM6IFByb3RyYWN0b3JCdWlsZGVyT3B0aW9ucyk6IFByb21pc2U8QnVpbGRlck91dHB1dD4ge1xuICBjb25zdCBhZGRpdGlvbmFsUHJvdHJhY3RvckNvbmZpZzogUGFydGlhbDxQcm90cmFjdG9yQnVpbGRlck9wdGlvbnM+ICYgUGFydGlhbDxKYXNtaW5lTm9kZU9wdHM+ID0ge1xuICAgIGJhc2VVcmw6IG9wdGlvbnMuYmFzZVVybCxcbiAgICBzcGVjczogb3B0aW9ucy5zcGVjcyAmJiBvcHRpb25zLnNwZWNzLmxlbmd0aCA/IG9wdGlvbnMuc3BlY3MgOiB1bmRlZmluZWQsXG4gICAgc3VpdGU6IG9wdGlvbnMuc3VpdGUsXG4gICAgamFzbWluZU5vZGVPcHRzOiB7XG4gICAgICBncmVwOiBvcHRpb25zLmdyZXAsXG4gICAgICBpbnZlcnRHcmVwOiBvcHRpb25zLmludmVydEdyZXAsXG4gICAgfSxcbiAgfTtcblxuICAvLyBUT0RPOiBQcm90cmFjdG9yIG1hbmFnZXMgcHJvY2Vzcy5leGl0IGl0c2VsZiwgc28gdGhpcyB0YXJnZXQgd2lsbCBhbGx3YXlzIHF1aXQgdGhlXG4gIC8vIHByb2Nlc3MuIFRvIHdvcmsgYXJvdW5kIHRoaXMgd2UgcnVuIGl0IGluIGEgc3VicHJvY2Vzcy5cbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvcHJvdHJhY3Rvci9pc3N1ZXMvNDE2MFxuICByZXR1cm4gcnVuTW9kdWxlQXNPYnNlcnZhYmxlRm9yayhyb290LCAncHJvdHJhY3Rvci9idWlsdC9sYXVuY2hlcicsICdpbml0JywgW1xuICAgIHJlc29sdmUocm9vdCwgb3B0aW9ucy5wcm90cmFjdG9yQ29uZmlnKSxcbiAgICBhZGRpdGlvbmFsUHJvdHJhY3RvckNvbmZpZyxcbiAgXSkudG9Qcm9taXNlKCkgYXMgUHJvbWlzZTxCdWlsZGVyT3V0cHV0Pjtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdXBkYXRlV2ViZHJpdmVyKCkge1xuICAvLyBUaGUgd2ViZHJpdmVyLW1hbmFnZXIgdXBkYXRlIGNvbW1hbmQgY2FuIG9ubHkgYmUgYWNjZXNzZWQgdmlhIGEgZGVlcCBpbXBvcnQuXG4gIGNvbnN0IHdlYmRyaXZlckRlZXBJbXBvcnQgPSAnd2ViZHJpdmVyLW1hbmFnZXIvYnVpbHQvbGliL2NtZHMvdXBkYXRlJztcblxuICBsZXQgcGF0aDtcbiAgdHJ5IHtcbiAgICBjb25zdCBwcm90cmFjdG9yUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgncHJvdHJhY3RvcicpO1xuXG4gICAgcGF0aCA9IHJlcXVpcmUucmVzb2x2ZSh3ZWJkcml2ZXJEZWVwSW1wb3J0LCB7IHBhdGhzOiBbcHJvdHJhY3RvclBhdGhdIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvci5jb2RlICE9PSAnTU9EVUxFX05PVF9GT1VORCcpIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIGlmICghcGF0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcih0YWdzLnN0cmlwSW5kZW50c2BcbiAgICAgIENhbm5vdCBhdXRvbWF0aWNhbGx5IGZpbmQgd2ViZHJpdmVyLW1hbmFnZXIgdG8gdXBkYXRlLlxuICAgICAgVXBkYXRlIHdlYmRyaXZlci1tYW5hZ2VyIG1hbnVhbGx5IGFuZCBydW4gJ25nIGUyZSAtLW5vLXdlYmRyaXZlci11cGRhdGUnIGluc3RlYWQuXG4gICAgYCk7XG4gIH1cblxuICBjb25zdCB3ZWJkcml2ZXJVcGRhdGUgPSBhd2FpdCBpbXBvcnQocGF0aCk7XG4gIC8vIGNvbnN0IHdlYmRyaXZlclVwZGF0ZSA9IGF3YWl0IGltcG9ydChwYXRoKSBhcyB0eXBlb2YgaW1wb3J0ICgnd2ViZHJpdmVyLW1hbmFnZXIvYnVpbHQvbGliL2NtZHMvdXBkYXRlJyk7XG5cbiAgLy8gcnVuIGB3ZWJkcml2ZXItbWFuYWdlciB1cGRhdGUgLS1zdGFuZGFsb25lIGZhbHNlIC0tZ2Vja28gZmFsc2UgLS1xdWlldGBcbiAgLy8gaWYgeW91IGNoYW5nZSB0aGlzLCB1cGRhdGUgdGhlIGNvbW1hbmQgY29tbWVudCBpbiBwcmV2IGxpbmVcbiAgcmV0dXJuIHdlYmRyaXZlclVwZGF0ZS5wcm9ncmFtLnJ1bih7XG4gICAgc3RhbmRhbG9uZTogZmFsc2UsXG4gICAgZ2Vja286IGZhbHNlLFxuICAgIHF1aWV0OiB0cnVlLFxuICB9IGFzIHVua25vd24gYXMgSlNPTik7XG59XG5cbmV4cG9ydCB7IFByb3RyYWN0b3JCdWlsZGVyT3B0aW9ucyB9O1xuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBleGVjdXRlKFxuICBvcHRpb25zOiBQcm90cmFjdG9yQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKTogUHJvbWlzZTxCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgJ1Byb3RyYWN0b3IgaGFzIGJlZW4gZGVwcmVjYXRlZCBpbmNsdWRpbmcgaXRzIHN1cHBvcnQgaW4gdGhlIEFuZ3VsYXIgQ0xJLiBGb3IgYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhbmQgYWx0ZXJuYXRpdmVzLCBwbGVhc2Ugc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL3Byb3RyYWN0b3IvaXNzdWVzLzU1MDIuJyxcbiAgKTtcblxuICAvLyBlbnN1cmUgdGhhdCBvbmx5IG9uZSBvZiB0aGVzZSBvcHRpb25zIGlzIHVzZWRcbiAgaWYgKG9wdGlvbnMuZGV2U2VydmVyVGFyZ2V0ICYmIG9wdGlvbnMuYmFzZVVybCkge1xuICAgIHRocm93IG5ldyBFcnJvcih0YWdzLnN0cmlwSW5kZW50c2BcbiAgICBUaGUgJ2Jhc2VVcmwnIG9wdGlvbiBjYW5ub3QgYmUgdXNlZCB3aXRoICdkZXZTZXJ2ZXJUYXJnZXQnLlxuICAgIFdoZW4gcHJlc2VudCwgJ2RldlNlcnZlclRhcmdldCcgd2lsbCBiZSB1c2VkIHRvIGF1dG9tYXRpY2FsbHkgc2V0dXAgJ2Jhc2VVcmwnIGZvciBQcm90cmFjdG9yLlxuICAgIGApO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMud2ViZHJpdmVyVXBkYXRlKSB7XG4gICAgYXdhaXQgdXBkYXRlV2ViZHJpdmVyKCk7XG4gIH1cblxuICBsZXQgYmFzZVVybCA9IG9wdGlvbnMuYmFzZVVybDtcbiAgbGV0IHNlcnZlcjtcbiAgaWYgKG9wdGlvbnMuZGV2U2VydmVyVGFyZ2V0KSB7XG4gICAgY29uc3QgdGFyZ2V0ID0gdGFyZ2V0RnJvbVRhcmdldFN0cmluZyhvcHRpb25zLmRldlNlcnZlclRhcmdldCk7XG4gICAgY29uc3Qgc2VydmVyT3B0aW9ucyA9IGF3YWl0IGNvbnRleHQuZ2V0VGFyZ2V0T3B0aW9ucyh0YXJnZXQpO1xuXG4gICAgY29uc3Qgb3ZlcnJpZGVzID0ge1xuICAgICAgd2F0Y2g6IGZhbHNlLFxuICAgICAgbGl2ZVJlbG9hZDogZmFsc2UsXG4gICAgfSBhcyBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucztcblxuICAgIGlmIChvcHRpb25zLmhvc3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgb3ZlcnJpZGVzLmhvc3QgPSBvcHRpb25zLmhvc3Q7XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygc2VydmVyT3B0aW9ucy5ob3N0ID09PSAnc3RyaW5nJykge1xuICAgICAgb3B0aW9ucy5ob3N0ID0gc2VydmVyT3B0aW9ucy5ob3N0O1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zLmhvc3QgPSBvdmVycmlkZXMuaG9zdCA9ICdsb2NhbGhvc3QnO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLnBvcnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgb3ZlcnJpZGVzLnBvcnQgPSBvcHRpb25zLnBvcnQ7XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygc2VydmVyT3B0aW9ucy5wb3J0ID09PSAnbnVtYmVyJykge1xuICAgICAgb3B0aW9ucy5wb3J0ID0gc2VydmVyT3B0aW9ucy5wb3J0O1xuICAgIH1cblxuICAgIHNlcnZlciA9IGF3YWl0IGNvbnRleHQuc2NoZWR1bGVUYXJnZXQodGFyZ2V0LCBvdmVycmlkZXMpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlcnZlci5yZXN1bHQ7XG4gICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHNlcnZlck9wdGlvbnMucHVibGljSG9zdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGxldCBwdWJsaWNIb3N0ID0gc2VydmVyT3B0aW9ucy5wdWJsaWNIb3N0IGFzIHN0cmluZztcbiAgICAgIGlmICghL15cXHcrOlxcL1xcLy8udGVzdChwdWJsaWNIb3N0KSkge1xuICAgICAgICBwdWJsaWNIb3N0ID0gYCR7c2VydmVyT3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnfTovLyR7cHVibGljSG9zdH1gO1xuICAgICAgfVxuICAgICAgY29uc3QgY2xpZW50VXJsID0gdXJsLnBhcnNlKHB1YmxpY0hvc3QpO1xuICAgICAgYmFzZVVybCA9IHVybC5mb3JtYXQoY2xpZW50VXJsKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiByZXN1bHQuYmFzZVVybCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGJhc2VVcmwgPSByZXN1bHQuYmFzZVVybDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiByZXN1bHQucG9ydCA9PT0gJ251bWJlcicpIHtcbiAgICAgIGJhc2VVcmwgPSB1cmwuZm9ybWF0KHtcbiAgICAgICAgcHJvdG9jb2w6IHNlcnZlck9wdGlvbnMuc3NsID8gJ2h0dHBzJyA6ICdodHRwJyxcbiAgICAgICAgaG9zdG5hbWU6IG9wdGlvbnMuaG9zdCxcbiAgICAgICAgcG9ydDogcmVzdWx0LnBvcnQudG9TdHJpbmcoKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIExpa2UgdGhlIGJhc2VVcmwgaW4gcHJvdHJhY3RvciBjb25maWcgZmlsZSB3aGVuIHVzaW5nIHRoZSBBUEkgd2UgbmVlZCB0byBhZGRcbiAgLy8gYSB0cmFpbGluZyBzbGFzaCB3aGVuIHByb3ZpZGUgdG8gdGhlIGJhc2VVcmwuXG4gIGlmIChiYXNlVXJsICYmICFiYXNlVXJsLmVuZHNXaXRoKCcvJykpIHtcbiAgICBiYXNlVXJsICs9ICcvJztcbiAgfVxuXG4gIHRyeSB7XG4gICAgcmV0dXJuIGF3YWl0IHJ1blByb3RyYWN0b3IoY29udGV4dC53b3Jrc3BhY2VSb290LCB7IC4uLm9wdGlvbnMsIGJhc2VVcmwgfSk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gIH0gZmluYWxseSB7XG4gICAgaWYgKHNlcnZlcikge1xuICAgICAgYXdhaXQgc2VydmVyLnN0b3AoKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcjxQcm90cmFjdG9yQnVpbGRlck9wdGlvbnM+KGV4ZWN1dGUpO1xuIl19