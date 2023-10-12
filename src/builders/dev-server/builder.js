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
const rxjs_1 = require("rxjs");
const check_port_1 = require("../../utils/check-port");
const purge_cache_1 = require("../../utils/purge-cache");
const options_1 = require("./options");
/**
 * A Builder that executes a development server based on the provided browser target option.
 * @param options Dev Server options.
 * @param context The build context.
 * @param transforms A map of transforms that can be used to hook into some logic (such as
 * transforming webpack configuration before passing it to webpack).
 *
 * @experimental Direct usage of this function is considered experimental.
 */
function execute(options, context, transforms = {}, plugins) {
    // Determine project name from builder context target
    const projectName = context.target?.project;
    if (!projectName) {
        context.logger.error(`The 'dev-server' builder requires a target to be specified.`);
        return rxjs_1.EMPTY;
    }
    return (0, rxjs_1.defer)(() => initialize(options, projectName, context)).pipe((0, rxjs_1.switchMap)(({ builderName, normalizedOptions }) => {
        // Use vite-based development server for esbuild-based builds
        if (builderName === '@angular-devkit/build-angular:application' ||
            builderName === '@angular-devkit/build-angular:browser-esbuild' ||
            normalizedOptions.forceEsbuild) {
            if (Object.keys(transforms).length > 0) {
                throw new Error('The `application` and `browser-esbuild` builders do not support Webpack transforms.');
            }
            return (0, rxjs_1.defer)(() => Promise.resolve().then(() => __importStar(require('./vite-server')))).pipe((0, rxjs_1.switchMap)(({ serveWithVite }) => serveWithVite(normalizedOptions, builderName, context, plugins)));
        }
        if (plugins?.length) {
            throw new Error('Only the `application` and `browser-esbuild` builders support plugins.');
        }
        // Use Webpack for all other browser targets
        return (0, rxjs_1.defer)(() => Promise.resolve().then(() => __importStar(require('./webpack-server')))).pipe((0, rxjs_1.switchMap)(({ serveWebpackBrowser }) => serveWebpackBrowser(normalizedOptions, builderName, context, transforms)));
    }));
}
exports.execute = execute;
async function initialize(initialOptions, projectName, context) {
    // Purge old build disk cache.
    await (0, purge_cache_1.purgeStaleBuildCache)(context);
    const normalizedOptions = await (0, options_1.normalizeOptions)(context, projectName, initialOptions);
    const builderName = await context.getBuilderNameForTarget(normalizedOptions.buildTarget);
    if (!normalizedOptions.disableHostCheck &&
        !/^127\.\d+\.\d+\.\d+/g.test(normalizedOptions.host) &&
        normalizedOptions.host !== 'localhost') {
        context.logger.warn(`
Warning: This is a simple server for use in testing or debugging Angular applications
locally. It hasn't been reviewed for security issues.

Binding this server to an open connection can result in compromising your application or
computer. Using a different host than the one passed to the "--host" flag might result in
websocket connection issues. You might need to use "--disable-host-check" if that's the
case.
    `);
    }
    if (normalizedOptions.disableHostCheck) {
        context.logger.warn('Warning: Running a server with --disable-host-check is a security risk. ' +
            'See https://medium.com/webpack/webpack-dev-server-middleware-security-issues-1489d950874a for more information.');
    }
    if (normalizedOptions.forceEsbuild && !builderName.startsWith('@angular-devkit/build-angular:')) {
        context.logger.warn('Warning: Forcing the use of the esbuild-based build system with third-party builders' +
            ' may cause unexpected behavior and/or build failures.');
    }
    normalizedOptions.port = await (0, check_port_1.checkPort)(normalizedOptions.port, normalizedOptions.host);
    return { builderName, normalizedOptions };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Rldi1zZXJ2ZXIvYnVpbGRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUlILCtCQUEyRDtBQUUzRCx1REFBbUQ7QUFFbkQseURBQStEO0FBQy9ELHVDQUE2QztBQUk3Qzs7Ozs7Ozs7R0FRRztBQUNILFNBQWdCLE9BQU8sQ0FDckIsT0FBZ0MsRUFDaEMsT0FBdUIsRUFDdkIsYUFJSSxFQUFFLEVBQ04sT0FBa0I7SUFFbEIscURBQXFEO0lBQ3JELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDO0lBQzVDLElBQUksQ0FBQyxXQUFXLEVBQUU7UUFDaEIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsNkRBQTZELENBQUMsQ0FBQztRQUVwRixPQUFPLFlBQUssQ0FBQztLQUNkO0lBRUQsT0FBTyxJQUFBLFlBQUssRUFBQyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FDaEUsSUFBQSxnQkFBUyxFQUFDLENBQUMsRUFBRSxXQUFXLEVBQUUsaUJBQWlCLEVBQUUsRUFBRSxFQUFFO1FBQy9DLDZEQUE2RDtRQUM3RCxJQUNFLFdBQVcsS0FBSywyQ0FBMkM7WUFDM0QsV0FBVyxLQUFLLCtDQUErQztZQUMvRCxpQkFBaUIsQ0FBQyxZQUFZLEVBQzlCO1lBQ0EsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Z0JBQ3RDLE1BQU0sSUFBSSxLQUFLLENBQ2IscUZBQXFGLENBQ3RGLENBQUM7YUFDSDtZQUVELE9BQU8sSUFBQSxZQUFLLEVBQUMsR0FBRyxFQUFFLG1EQUFRLGVBQWUsR0FBQyxDQUFDLENBQUMsSUFBSSxDQUM5QyxJQUFBLGdCQUFTLEVBQUMsQ0FBQyxFQUFFLGFBQWEsRUFBRSxFQUFFLEVBQUUsQ0FDOUIsYUFBYSxDQUFDLGlCQUFpQixFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQ2hFLENBQ0YsQ0FBQztTQUNIO1FBRUQsSUFBSSxPQUFPLEVBQUUsTUFBTSxFQUFFO1lBQ25CLE1BQU0sSUFBSSxLQUFLLENBQUMsd0VBQXdFLENBQUMsQ0FBQztTQUMzRjtRQUVELDRDQUE0QztRQUM1QyxPQUFPLElBQUEsWUFBSyxFQUFDLEdBQUcsRUFBRSxtREFBUSxrQkFBa0IsR0FBQyxDQUFDLENBQUMsSUFBSSxDQUNqRCxJQUFBLGdCQUFTLEVBQUMsQ0FBQyxFQUFFLG1CQUFtQixFQUFFLEVBQUUsRUFBRSxDQUNwQyxtQkFBbUIsQ0FBQyxpQkFBaUIsRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUN6RSxDQUNGLENBQUM7SUFDSixDQUFDLENBQUMsQ0FDSCxDQUFDO0FBQ0osQ0FBQztBQW5ERCwwQkFtREM7QUFFRCxLQUFLLFVBQVUsVUFBVSxDQUN2QixjQUF1QyxFQUN2QyxXQUFtQixFQUNuQixPQUF1QjtJQUV2Qiw4QkFBOEI7SUFDOUIsTUFBTSxJQUFBLGtDQUFvQixFQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRXBDLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxJQUFBLDBCQUFnQixFQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDdkYsTUFBTSxXQUFXLEdBQUcsTUFBTSxPQUFPLENBQUMsdUJBQXVCLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLENBQUM7SUFFekYsSUFDRSxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQjtRQUNuQyxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUM7UUFDcEQsaUJBQWlCLENBQUMsSUFBSSxLQUFLLFdBQVcsRUFDdEM7UUFDQSxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQzs7Ozs7Ozs7S0FRbkIsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxJQUFJLGlCQUFpQixDQUFDLGdCQUFnQixFQUFFO1FBQ3RDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNqQiwwRUFBMEU7WUFDeEUsaUhBQWlILENBQ3BILENBQUM7S0FDSDtJQUVELElBQUksaUJBQWlCLENBQUMsWUFBWSxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxnQ0FBZ0MsQ0FBQyxFQUFFO1FBQy9GLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNqQixzRkFBc0Y7WUFDcEYsdURBQXVELENBQzFELENBQUM7S0FDSDtJQUVELGlCQUFpQixDQUFDLElBQUksR0FBRyxNQUFNLElBQUEsc0JBQVMsRUFBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFekYsT0FBTyxFQUFFLFdBQVcsRUFBRSxpQkFBaUIsRUFBRSxDQUFDO0FBQzVDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHR5cGUgeyBQbHVnaW4gfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IEVNUFRZLCBPYnNlcnZhYmxlLCBkZWZlciwgc3dpdGNoTWFwIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgdHlwZSB7IEV4ZWN1dGlvblRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vdHJhbnNmb3Jtcyc7XG5pbXBvcnQgeyBjaGVja1BvcnQgfSBmcm9tICcuLi8uLi91dGlscy9jaGVjay1wb3J0JztcbmltcG9ydCB0eXBlIHsgSW5kZXhIdG1sVHJhbnNmb3JtIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBwdXJnZVN0YWxlQnVpbGRDYWNoZSB9IGZyb20gJy4uLy4uL3V0aWxzL3B1cmdlLWNhY2hlJztcbmltcG9ydCB7IG5vcm1hbGl6ZU9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnO1xuaW1wb3J0IHR5cGUgeyBTY2hlbWEgYXMgRGV2U2VydmVyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQgdHlwZSB7IERldlNlcnZlckJ1aWxkZXJPdXRwdXQgfSBmcm9tICcuL3dlYnBhY2stc2VydmVyJztcblxuLyoqXG4gKiBBIEJ1aWxkZXIgdGhhdCBleGVjdXRlcyBhIGRldmVsb3BtZW50IHNlcnZlciBiYXNlZCBvbiB0aGUgcHJvdmlkZWQgYnJvd3NlciB0YXJnZXQgb3B0aW9uLlxuICogQHBhcmFtIG9wdGlvbnMgRGV2IFNlcnZlciBvcHRpb25zLlxuICogQHBhcmFtIGNvbnRleHQgVGhlIGJ1aWxkIGNvbnRleHQuXG4gKiBAcGFyYW0gdHJhbnNmb3JtcyBBIG1hcCBvZiB0cmFuc2Zvcm1zIHRoYXQgY2FuIGJlIHVzZWQgdG8gaG9vayBpbnRvIHNvbWUgbG9naWMgKHN1Y2ggYXNcbiAqIHRyYW5zZm9ybWluZyB3ZWJwYWNrIGNvbmZpZ3VyYXRpb24gYmVmb3JlIHBhc3NpbmcgaXQgdG8gd2VicGFjaykuXG4gKlxuICogQGV4cGVyaW1lbnRhbCBEaXJlY3QgdXNhZ2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyBjb25zaWRlcmVkIGV4cGVyaW1lbnRhbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgdHJhbnNmb3Jtczoge1xuICAgIHdlYnBhY2tDb25maWd1cmF0aW9uPzogRXhlY3V0aW9uVHJhbnNmb3JtZXI8aW1wb3J0KCd3ZWJwYWNrJykuQ29uZmlndXJhdGlvbj47XG4gICAgbG9nZ2luZz86IGltcG9ydCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLXdlYnBhY2snKS5XZWJwYWNrTG9nZ2luZ0NhbGxiYWNrO1xuICAgIGluZGV4SHRtbD86IEluZGV4SHRtbFRyYW5zZm9ybTtcbiAgfSA9IHt9LFxuICBwbHVnaW5zPzogUGx1Z2luW10sXG4pOiBPYnNlcnZhYmxlPERldlNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gRGV0ZXJtaW5lIHByb2plY3QgbmFtZSBmcm9tIGJ1aWxkZXIgY29udGV4dCB0YXJnZXRcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGBUaGUgJ2Rldi1zZXJ2ZXInIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQgdG8gYmUgc3BlY2lmaWVkLmApO1xuXG4gICAgcmV0dXJuIEVNUFRZO1xuICB9XG5cbiAgcmV0dXJuIGRlZmVyKCgpID0+IGluaXRpYWxpemUob3B0aW9ucywgcHJvamVjdE5hbWUsIGNvbnRleHQpKS5waXBlKFxuICAgIHN3aXRjaE1hcCgoeyBidWlsZGVyTmFtZSwgbm9ybWFsaXplZE9wdGlvbnMgfSkgPT4ge1xuICAgICAgLy8gVXNlIHZpdGUtYmFzZWQgZGV2ZWxvcG1lbnQgc2VydmVyIGZvciBlc2J1aWxkLWJhc2VkIGJ1aWxkc1xuICAgICAgaWYgKFxuICAgICAgICBidWlsZGVyTmFtZSA9PT0gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOmFwcGxpY2F0aW9uJyB8fFxuICAgICAgICBidWlsZGVyTmFtZSA9PT0gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOmJyb3dzZXItZXNidWlsZCcgfHxcbiAgICAgICAgbm9ybWFsaXplZE9wdGlvbnMuZm9yY2VFc2J1aWxkXG4gICAgICApIHtcbiAgICAgICAgaWYgKE9iamVjdC5rZXlzKHRyYW5zZm9ybXMpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAnVGhlIGBhcHBsaWNhdGlvbmAgYW5kIGBicm93c2VyLWVzYnVpbGRgIGJ1aWxkZXJzIGRvIG5vdCBzdXBwb3J0IFdlYnBhY2sgdHJhbnNmb3Jtcy4nLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZGVmZXIoKCkgPT4gaW1wb3J0KCcuL3ZpdGUtc2VydmVyJykpLnBpcGUoXG4gICAgICAgICAgc3dpdGNoTWFwKCh7IHNlcnZlV2l0aFZpdGUgfSkgPT5cbiAgICAgICAgICAgIHNlcnZlV2l0aFZpdGUobm9ybWFsaXplZE9wdGlvbnMsIGJ1aWxkZXJOYW1lLCBjb250ZXh0LCBwbHVnaW5zKSxcbiAgICAgICAgICApLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBpZiAocGx1Z2lucz8ubGVuZ3RoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignT25seSB0aGUgYGFwcGxpY2F0aW9uYCBhbmQgYGJyb3dzZXItZXNidWlsZGAgYnVpbGRlcnMgc3VwcG9ydCBwbHVnaW5zLicpO1xuICAgICAgfVxuXG4gICAgICAvLyBVc2UgV2VicGFjayBmb3IgYWxsIG90aGVyIGJyb3dzZXIgdGFyZ2V0c1xuICAgICAgcmV0dXJuIGRlZmVyKCgpID0+IGltcG9ydCgnLi93ZWJwYWNrLXNlcnZlcicpKS5waXBlKFxuICAgICAgICBzd2l0Y2hNYXAoKHsgc2VydmVXZWJwYWNrQnJvd3NlciB9KSA9PlxuICAgICAgICAgIHNlcnZlV2VicGFja0Jyb3dzZXIobm9ybWFsaXplZE9wdGlvbnMsIGJ1aWxkZXJOYW1lLCBjb250ZXh0LCB0cmFuc2Zvcm1zKSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgfSksXG4gICk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemUoXG4gIGluaXRpYWxPcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pIHtcbiAgLy8gUHVyZ2Ugb2xkIGJ1aWxkIGRpc2sgY2FjaGUuXG4gIGF3YWl0IHB1cmdlU3RhbGVCdWlsZENhY2hlKGNvbnRleHQpO1xuXG4gIGNvbnN0IG5vcm1hbGl6ZWRPcHRpb25zID0gYXdhaXQgbm9ybWFsaXplT3B0aW9ucyhjb250ZXh0LCBwcm9qZWN0TmFtZSwgaW5pdGlhbE9wdGlvbnMpO1xuICBjb25zdCBidWlsZGVyTmFtZSA9IGF3YWl0IGNvbnRleHQuZ2V0QnVpbGRlck5hbWVGb3JUYXJnZXQobm9ybWFsaXplZE9wdGlvbnMuYnVpbGRUYXJnZXQpO1xuXG4gIGlmIChcbiAgICAhbm9ybWFsaXplZE9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjayAmJlxuICAgICEvXjEyN1xcLlxcZCtcXC5cXGQrXFwuXFxkKy9nLnRlc3Qobm9ybWFsaXplZE9wdGlvbnMuaG9zdCkgJiZcbiAgICBub3JtYWxpemVkT3B0aW9ucy5ob3N0ICE9PSAnbG9jYWxob3N0J1xuICApIHtcbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKGBcbldhcm5pbmc6IFRoaXMgaXMgYSBzaW1wbGUgc2VydmVyIGZvciB1c2UgaW4gdGVzdGluZyBvciBkZWJ1Z2dpbmcgQW5ndWxhciBhcHBsaWNhdGlvbnNcbmxvY2FsbHkuIEl0IGhhc24ndCBiZWVuIHJldmlld2VkIGZvciBzZWN1cml0eSBpc3N1ZXMuXG5cbkJpbmRpbmcgdGhpcyBzZXJ2ZXIgdG8gYW4gb3BlbiBjb25uZWN0aW9uIGNhbiByZXN1bHQgaW4gY29tcHJvbWlzaW5nIHlvdXIgYXBwbGljYXRpb24gb3JcbmNvbXB1dGVyLiBVc2luZyBhIGRpZmZlcmVudCBob3N0IHRoYW4gdGhlIG9uZSBwYXNzZWQgdG8gdGhlIFwiLS1ob3N0XCIgZmxhZyBtaWdodCByZXN1bHQgaW5cbndlYnNvY2tldCBjb25uZWN0aW9uIGlzc3Vlcy4gWW91IG1pZ2h0IG5lZWQgdG8gdXNlIFwiLS1kaXNhYmxlLWhvc3QtY2hlY2tcIiBpZiB0aGF0J3MgdGhlXG5jYXNlLlxuICAgIGApO1xuICB9XG5cbiAgaWYgKG5vcm1hbGl6ZWRPcHRpb25zLmRpc2FibGVIb3N0Q2hlY2spIHtcbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKFxuICAgICAgJ1dhcm5pbmc6IFJ1bm5pbmcgYSBzZXJ2ZXIgd2l0aCAtLWRpc2FibGUtaG9zdC1jaGVjayBpcyBhIHNlY3VyaXR5IHJpc2suICcgK1xuICAgICAgICAnU2VlIGh0dHBzOi8vbWVkaXVtLmNvbS93ZWJwYWNrL3dlYnBhY2stZGV2LXNlcnZlci1taWRkbGV3YXJlLXNlY3VyaXR5LWlzc3Vlcy0xNDg5ZDk1MDg3NGEgZm9yIG1vcmUgaW5mb3JtYXRpb24uJyxcbiAgICApO1xuICB9XG5cbiAgaWYgKG5vcm1hbGl6ZWRPcHRpb25zLmZvcmNlRXNidWlsZCAmJiAhYnVpbGRlck5hbWUuc3RhcnRzV2l0aCgnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6JykpIHtcbiAgICBjb250ZXh0LmxvZ2dlci53YXJuKFxuICAgICAgJ1dhcm5pbmc6IEZvcmNpbmcgdGhlIHVzZSBvZiB0aGUgZXNidWlsZC1iYXNlZCBidWlsZCBzeXN0ZW0gd2l0aCB0aGlyZC1wYXJ0eSBidWlsZGVycycgK1xuICAgICAgICAnIG1heSBjYXVzZSB1bmV4cGVjdGVkIGJlaGF2aW9yIGFuZC9vciBidWlsZCBmYWlsdXJlcy4nLFxuICAgICk7XG4gIH1cblxuICBub3JtYWxpemVkT3B0aW9ucy5wb3J0ID0gYXdhaXQgY2hlY2tQb3J0KG5vcm1hbGl6ZWRPcHRpb25zLnBvcnQsIG5vcm1hbGl6ZWRPcHRpb25zLmhvc3QpO1xuXG4gIHJldHVybiB7IGJ1aWxkZXJOYW1lLCBub3JtYWxpemVkT3B0aW9ucyB9O1xufVxuIl19