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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9wcm90cmFjdG9yL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFLbUM7QUFDbkMsK0NBQWtEO0FBQ2xELCtCQUErQjtBQUMvQix5Q0FBMkI7QUFDM0IsdUNBQXdEO0FBV3hELFNBQVMsYUFBYSxDQUFDLElBQVksRUFBRSxPQUFpQztJQUNwRSxNQUFNLDBCQUEwQixHQUFpRTtRQUMvRixPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU87UUFDeEIsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVM7UUFDeEUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO1FBQ3BCLGVBQWUsRUFBRTtZQUNmLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtZQUNsQixVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVU7U0FDL0I7S0FDRixDQUFDO0lBRUYscUZBQXFGO0lBQ3JGLDBEQUEwRDtJQUMxRCxvREFBb0Q7SUFDcEQsT0FBTyxJQUFBLGlDQUF5QixFQUFDLElBQUksRUFBRSwyQkFBMkIsRUFBRSxNQUFNLEVBQUU7UUFDMUUsSUFBQSxjQUFPLEVBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQztRQUN2QywwQkFBMEI7S0FDM0IsQ0FBQyxDQUFDLFNBQVMsRUFBNEIsQ0FBQztBQUMzQyxDQUFDO0FBRUQsS0FBSyxVQUFVLGVBQWU7SUFDNUIsK0VBQStFO0lBQy9FLE1BQU0sbUJBQW1CLEdBQUcseUNBQXlDLENBQUM7SUFFdEUsSUFBSSxJQUFJLENBQUM7SUFDVCxJQUFJO1FBQ0YsTUFBTSxjQUFjLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUVyRCxJQUFJLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsQ0FBQztLQUMxRTtJQUFDLE9BQU8sS0FBSyxFQUFFO1FBQ2QsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLGtCQUFrQixFQUFFO1lBQ3JDLE1BQU0sS0FBSyxDQUFDO1NBQ2I7S0FDRjtJQUVELElBQUksQ0FBQyxJQUFJLEVBQUU7UUFDVCxNQUFNLElBQUksS0FBSyxDQUFDLFdBQUksQ0FBQyxZQUFZLENBQUE7OztLQUdoQyxDQUFDLENBQUM7S0FDSjtJQUVELE1BQU0sZUFBZSxHQUFHLHdEQUFhLElBQUksR0FBQyxDQUFDO0lBQzNDLDJHQUEyRztJQUUzRywwRUFBMEU7SUFDMUUsOERBQThEO0lBQzlELE9BQU8sZUFBZSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUM7UUFDakMsVUFBVSxFQUFFLEtBQUs7UUFDakIsS0FBSyxFQUFFLEtBQUs7UUFDWixLQUFLLEVBQUUsSUFBSTtLQUNPLENBQUMsQ0FBQztBQUN4QixDQUFDO0FBSUQ7O0dBRUc7QUFDSSxLQUFLLFVBQVUsT0FBTyxDQUMzQixPQUFpQyxFQUNqQyxPQUF1QjtJQUV2QixPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDakIscUxBQXFMLENBQ3RMLENBQUM7SUFFRixnREFBZ0Q7SUFDaEQsSUFBSSxPQUFPLENBQUMsZUFBZSxJQUFJLE9BQU8sQ0FBQyxPQUFPLEVBQUU7UUFDOUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxXQUFJLENBQUMsWUFBWSxDQUFBOzs7S0FHaEMsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxJQUFJLE9BQU8sQ0FBQyxlQUFlLEVBQUU7UUFDM0IsTUFBTSxlQUFlLEVBQUUsQ0FBQztLQUN6QjtJQUVELElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUM7SUFDOUIsSUFBSSxNQUFNLENBQUM7SUFDWCxJQUFJLE9BQU8sQ0FBQyxlQUFlLEVBQUU7UUFDM0IsTUFBTSxNQUFNLEdBQUcsSUFBQSxrQ0FBc0IsRUFBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDL0QsTUFBTSxhQUFhLEdBQUcsTUFBTSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFN0QsTUFBTSxTQUFTLEdBQUc7WUFDaEIsS0FBSyxFQUFFLEtBQUs7WUFDWixVQUFVLEVBQUUsS0FBSztTQUMyQixDQUFDO1FBRS9DLElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUU7WUFDOUIsU0FBUyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDO1NBQy9CO2FBQU0sSUFBSSxPQUFPLGFBQWEsQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO1lBQ2pELE9BQU8sQ0FBQyxJQUFJLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQztTQUNuQzthQUFNO1lBQ0wsT0FBTyxDQUFDLElBQUksR0FBRyxTQUFTLENBQUMsSUFBSSxHQUFHLFdBQVcsQ0FBQztTQUM3QztRQUVELElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUU7WUFDOUIsU0FBUyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDO1NBQy9CO2FBQU0sSUFBSSxPQUFPLGFBQWEsQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO1lBQ2pELE9BQU8sQ0FBQyxJQUFJLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQztTQUNuQztRQUVELE1BQU0sR0FBRyxNQUFNLE9BQU8sQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3pELE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUNuQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtZQUNuQixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO1NBQzNCO1FBRUQsSUFBSSxPQUFPLGFBQWEsQ0FBQyxVQUFVLEtBQUssUUFBUSxFQUFFO1lBQ2hELElBQUksVUFBVSxHQUFHLGFBQWEsQ0FBQyxVQUFvQixDQUFDO1lBQ3BELElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFO2dCQUNqQyxVQUFVLEdBQUcsR0FBRyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sTUFBTSxVQUFVLEVBQUUsQ0FBQzthQUN4RTtZQUNELE1BQU0sU0FBUyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDeEMsT0FBTyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDakM7YUFBTSxJQUFJLE9BQU8sTUFBTSxDQUFDLE9BQU8sS0FBSyxRQUFRLEVBQUU7WUFDN0MsT0FBTyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUM7U0FDMUI7YUFBTSxJQUFJLE9BQU8sTUFBTSxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7WUFDMUMsT0FBTyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUM7Z0JBQ25CLFFBQVEsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU07Z0JBQzlDLFFBQVEsRUFBRSxPQUFPLENBQUMsSUFBSTtnQkFDdEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFO2FBQzdCLENBQUMsQ0FBQztTQUNKO0tBQ0Y7SUFFRCwrRUFBK0U7SUFDL0UsZ0RBQWdEO0lBQ2hELElBQUksT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUNyQyxPQUFPLElBQUksR0FBRyxDQUFDO0tBQ2hCO0lBRUQsSUFBSTtRQUNGLE9BQU8sTUFBTSxhQUFhLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxFQUFFLEdBQUcsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7S0FDNUU7SUFBQyxXQUFNO1FBQ04sT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztLQUMzQjtZQUFTO1FBQ1IsSUFBSSxNQUFNLEVBQUU7WUFDVixNQUFNLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztTQUNyQjtLQUNGO0FBQ0gsQ0FBQztBQXBGRCwwQkFvRkM7QUFFRCxrQkFBZSxJQUFBLHlCQUFhLEVBQTJCLE9BQU8sQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkZXJDb250ZXh0LFxuICBCdWlsZGVyT3V0cHV0LFxuICBjcmVhdGVCdWlsZGVyLFxuICB0YXJnZXRGcm9tVGFyZ2V0U3RyaW5nLFxufSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IGpzb24sIHRhZ3MgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcbmltcG9ydCB7IHJ1bk1vZHVsZUFzT2JzZXJ2YWJsZUZvcmsgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4uL2Rldi1zZXJ2ZXIvaW5kZXgnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIFByb3RyYWN0b3JCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4vc2NoZW1hJztcblxuaW50ZXJmYWNlIEphc21pbmVOb2RlT3B0cyB7XG4gIGphc21pbmVOb2RlT3B0czoge1xuICAgIGdyZXA/OiBzdHJpbmc7XG4gICAgaW52ZXJ0R3JlcD86IGJvb2xlYW47XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJ1blByb3RyYWN0b3Iocm9vdDogc3RyaW5nLCBvcHRpb25zOiBQcm90cmFjdG9yQnVpbGRlck9wdGlvbnMpOiBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3QgYWRkaXRpb25hbFByb3RyYWN0b3JDb25maWc6IFBhcnRpYWw8UHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zPiAmIFBhcnRpYWw8SmFzbWluZU5vZGVPcHRzPiA9IHtcbiAgICBiYXNlVXJsOiBvcHRpb25zLmJhc2VVcmwsXG4gICAgc3BlY3M6IG9wdGlvbnMuc3BlY3MgJiYgb3B0aW9ucy5zcGVjcy5sZW5ndGggPyBvcHRpb25zLnNwZWNzIDogdW5kZWZpbmVkLFxuICAgIHN1aXRlOiBvcHRpb25zLnN1aXRlLFxuICAgIGphc21pbmVOb2RlT3B0czoge1xuICAgICAgZ3JlcDogb3B0aW9ucy5ncmVwLFxuICAgICAgaW52ZXJ0R3JlcDogb3B0aW9ucy5pbnZlcnRHcmVwLFxuICAgIH0sXG4gIH07XG5cbiAgLy8gVE9ETzogUHJvdHJhY3RvciBtYW5hZ2VzIHByb2Nlc3MuZXhpdCBpdHNlbGYsIHNvIHRoaXMgdGFyZ2V0IHdpbGwgYWxsd2F5cyBxdWl0IHRoZVxuICAvLyBwcm9jZXNzLiBUbyB3b3JrIGFyb3VuZCB0aGlzIHdlIHJ1biBpdCBpbiBhIHN1YnByb2Nlc3MuXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL3Byb3RyYWN0b3IvaXNzdWVzLzQxNjBcbiAgcmV0dXJuIHJ1bk1vZHVsZUFzT2JzZXJ2YWJsZUZvcmsocm9vdCwgJ3Byb3RyYWN0b3IvYnVpbHQvbGF1bmNoZXInLCAnaW5pdCcsIFtcbiAgICByZXNvbHZlKHJvb3QsIG9wdGlvbnMucHJvdHJhY3RvckNvbmZpZyksXG4gICAgYWRkaXRpb25hbFByb3RyYWN0b3JDb25maWcsXG4gIF0pLnRvUHJvbWlzZSgpIGFzIFByb21pc2U8QnVpbGRlck91dHB1dD47XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVdlYmRyaXZlcigpIHtcbiAgLy8gVGhlIHdlYmRyaXZlci1tYW5hZ2VyIHVwZGF0ZSBjb21tYW5kIGNhbiBvbmx5IGJlIGFjY2Vzc2VkIHZpYSBhIGRlZXAgaW1wb3J0LlxuICBjb25zdCB3ZWJkcml2ZXJEZWVwSW1wb3J0ID0gJ3dlYmRyaXZlci1tYW5hZ2VyL2J1aWx0L2xpYi9jbWRzL3VwZGF0ZSc7XG5cbiAgbGV0IHBhdGg7XG4gIHRyeSB7XG4gICAgY29uc3QgcHJvdHJhY3RvclBhdGggPSByZXF1aXJlLnJlc29sdmUoJ3Byb3RyYWN0b3InKTtcblxuICAgIHBhdGggPSByZXF1aXJlLnJlc29sdmUod2ViZHJpdmVyRGVlcEltcG9ydCwgeyBwYXRoczogW3Byb3RyYWN0b3JQYXRoXSB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IuY29kZSAhPT0gJ01PRFVMRV9OT1RfRk9VTkQnKSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICBpZiAoIXBhdGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IodGFncy5zdHJpcEluZGVudHNgXG4gICAgICBDYW5ub3QgYXV0b21hdGljYWxseSBmaW5kIHdlYmRyaXZlci1tYW5hZ2VyIHRvIHVwZGF0ZS5cbiAgICAgIFVwZGF0ZSB3ZWJkcml2ZXItbWFuYWdlciBtYW51YWxseSBhbmQgcnVuICduZyBlMmUgLS1uby13ZWJkcml2ZXItdXBkYXRlJyBpbnN0ZWFkLlxuICAgIGApO1xuICB9XG5cbiAgY29uc3Qgd2ViZHJpdmVyVXBkYXRlID0gYXdhaXQgaW1wb3J0KHBhdGgpO1xuICAvLyBjb25zdCB3ZWJkcml2ZXJVcGRhdGUgPSBhd2FpdCBpbXBvcnQocGF0aCkgYXMgdHlwZW9mIGltcG9ydCAoJ3dlYmRyaXZlci1tYW5hZ2VyL2J1aWx0L2xpYi9jbWRzL3VwZGF0ZScpO1xuXG4gIC8vIHJ1biBgd2ViZHJpdmVyLW1hbmFnZXIgdXBkYXRlIC0tc3RhbmRhbG9uZSBmYWxzZSAtLWdlY2tvIGZhbHNlIC0tcXVpZXRgXG4gIC8vIGlmIHlvdSBjaGFuZ2UgdGhpcywgdXBkYXRlIHRoZSBjb21tYW5kIGNvbW1lbnQgaW4gcHJldiBsaW5lXG4gIHJldHVybiB3ZWJkcml2ZXJVcGRhdGUucHJvZ3JhbS5ydW4oe1xuICAgIHN0YW5kYWxvbmU6IGZhbHNlLFxuICAgIGdlY2tvOiBmYWxzZSxcbiAgICBxdWlldDogdHJ1ZSxcbiAgfSBhcyB1bmtub3duIGFzIEpTT04pO1xufVxuXG5leHBvcnQgeyBQcm90cmFjdG9yQnVpbGRlck9wdGlvbnMgfTtcblxuLyoqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZXhlY3V0ZShcbiAgb3B0aW9uczogUHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IFByb21pc2U8QnVpbGRlck91dHB1dD4ge1xuICBjb250ZXh0LmxvZ2dlci53YXJuKFxuICAgICdQcm90cmFjdG9yIGhhcyBiZWVuIGRlcHJlY2F0ZWQgaW5jbHVkaW5nIGl0cyBzdXBwb3J0IGluIHRoZSBBbmd1bGFyIENMSS4gRm9yIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gYW5kIGFsdGVybmF0aXZlcywgcGxlYXNlIHNlZSBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9wcm90cmFjdG9yL2lzc3Vlcy81NTAyLicsXG4gICk7XG5cbiAgLy8gZW5zdXJlIHRoYXQgb25seSBvbmUgb2YgdGhlc2Ugb3B0aW9ucyBpcyB1c2VkXG4gIGlmIChvcHRpb25zLmRldlNlcnZlclRhcmdldCAmJiBvcHRpb25zLmJhc2VVcmwpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IodGFncy5zdHJpcEluZGVudHNgXG4gICAgVGhlICdiYXNlVXJsJyBvcHRpb24gY2Fubm90IGJlIHVzZWQgd2l0aCAnZGV2U2VydmVyVGFyZ2V0Jy5cbiAgICBXaGVuIHByZXNlbnQsICdkZXZTZXJ2ZXJUYXJnZXQnIHdpbGwgYmUgdXNlZCB0byBhdXRvbWF0aWNhbGx5IHNldHVwICdiYXNlVXJsJyBmb3IgUHJvdHJhY3Rvci5cbiAgICBgKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLndlYmRyaXZlclVwZGF0ZSkge1xuICAgIGF3YWl0IHVwZGF0ZVdlYmRyaXZlcigpO1xuICB9XG5cbiAgbGV0IGJhc2VVcmwgPSBvcHRpb25zLmJhc2VVcmw7XG4gIGxldCBzZXJ2ZXI7XG4gIGlmIChvcHRpb25zLmRldlNlcnZlclRhcmdldCkge1xuICAgIGNvbnN0IHRhcmdldCA9IHRhcmdldEZyb21UYXJnZXRTdHJpbmcob3B0aW9ucy5kZXZTZXJ2ZXJUYXJnZXQpO1xuICAgIGNvbnN0IHNlcnZlck9wdGlvbnMgPSBhd2FpdCBjb250ZXh0LmdldFRhcmdldE9wdGlvbnModGFyZ2V0KTtcblxuICAgIGNvbnN0IG92ZXJyaWRlcyA9IHtcbiAgICAgIHdhdGNoOiBmYWxzZSxcbiAgICAgIGxpdmVSZWxvYWQ6IGZhbHNlLFxuICAgIH0gYXMgRGV2U2VydmVyQnVpbGRlck9wdGlvbnMgJiBqc29uLkpzb25PYmplY3Q7XG5cbiAgICBpZiAob3B0aW9ucy5ob3N0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIG92ZXJyaWRlcy5ob3N0ID0gb3B0aW9ucy5ob3N0O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHNlcnZlck9wdGlvbnMuaG9zdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG9wdGlvbnMuaG9zdCA9IHNlcnZlck9wdGlvbnMuaG9zdDtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucy5ob3N0ID0gb3ZlcnJpZGVzLmhvc3QgPSAnbG9jYWxob3N0JztcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5wb3J0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIG92ZXJyaWRlcy5wb3J0ID0gb3B0aW9ucy5wb3J0O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHNlcnZlck9wdGlvbnMucG9ydCA9PT0gJ251bWJlcicpIHtcbiAgICAgIG9wdGlvbnMucG9ydCA9IHNlcnZlck9wdGlvbnMucG9ydDtcbiAgICB9XG5cbiAgICBzZXJ2ZXIgPSBhd2FpdCBjb250ZXh0LnNjaGVkdWxlVGFyZ2V0KHRhcmdldCwgb3ZlcnJpZGVzKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzZXJ2ZXIucmVzdWx0O1xuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBzZXJ2ZXJPcHRpb25zLnB1YmxpY0hvc3QgPT09ICdzdHJpbmcnKSB7XG4gICAgICBsZXQgcHVibGljSG9zdCA9IHNlcnZlck9wdGlvbnMucHVibGljSG9zdCBhcyBzdHJpbmc7XG4gICAgICBpZiAoIS9eXFx3KzpcXC9cXC8vLnRlc3QocHVibGljSG9zdCkpIHtcbiAgICAgICAgcHVibGljSG9zdCA9IGAke3NlcnZlck9wdGlvbnMuc3NsID8gJ2h0dHBzJyA6ICdodHRwJ306Ly8ke3B1YmxpY0hvc3R9YDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNsaWVudFVybCA9IHVybC5wYXJzZShwdWJsaWNIb3N0KTtcbiAgICAgIGJhc2VVcmwgPSB1cmwuZm9ybWF0KGNsaWVudFVybCk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcmVzdWx0LmJhc2VVcmwgPT09ICdzdHJpbmcnKSB7XG4gICAgICBiYXNlVXJsID0gcmVzdWx0LmJhc2VVcmw7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcmVzdWx0LnBvcnQgPT09ICdudW1iZXInKSB7XG4gICAgICBiYXNlVXJsID0gdXJsLmZvcm1hdCh7XG4gICAgICAgIHByb3RvY29sOiBzZXJ2ZXJPcHRpb25zLnNzbCA/ICdodHRwcycgOiAnaHR0cCcsXG4gICAgICAgIGhvc3RuYW1lOiBvcHRpb25zLmhvc3QsXG4gICAgICAgIHBvcnQ6IHJlc3VsdC5wb3J0LnRvU3RyaW5nKCksXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvLyBMaWtlIHRoZSBiYXNlVXJsIGluIHByb3RyYWN0b3IgY29uZmlnIGZpbGUgd2hlbiB1c2luZyB0aGUgQVBJIHdlIG5lZWQgdG8gYWRkXG4gIC8vIGEgdHJhaWxpbmcgc2xhc2ggd2hlbiBwcm92aWRlIHRvIHRoZSBiYXNlVXJsLlxuICBpZiAoYmFzZVVybCAmJiAhYmFzZVVybC5lbmRzV2l0aCgnLycpKSB7XG4gICAgYmFzZVVybCArPSAnLyc7XG4gIH1cblxuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCBydW5Qcm90cmFjdG9yKGNvbnRleHQud29ya3NwYWNlUm9vdCwgeyAuLi5vcHRpb25zLCBiYXNlVXJsIH0pO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICB9IGZpbmFsbHkge1xuICAgIGlmIChzZXJ2ZXIpIHtcbiAgICAgIGF3YWl0IHNlcnZlci5zdG9wKCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXI8UHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zPihleGVjdXRlKTtcbiJdfQ==