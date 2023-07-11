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
function execute(options, context, transforms = {}) {
    // Determine project name from builder context target
    const projectName = context.target?.project;
    if (!projectName) {
        context.logger.error(`The 'dev-server' builder requires a target to be specified.`);
        return rxjs_1.EMPTY;
    }
    return (0, rxjs_1.defer)(() => initialize(options, projectName, context)).pipe((0, rxjs_1.switchMap)(({ builderName, normalizedOptions }) => {
        // Use vite-based development server for esbuild-based builds
        if (builderName === '@angular-devkit/build-angular:browser-esbuild' ||
            normalizedOptions.forceEsbuild) {
            return (0, rxjs_1.defer)(() => Promise.resolve().then(() => __importStar(require('./vite-server')))).pipe((0, rxjs_1.switchMap)(({ serveWithVite }) => serveWithVite(normalizedOptions, builderName, context)));
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
    const builderName = await context.getBuilderNameForTarget(normalizedOptions.browserTarget);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Rldi1zZXJ2ZXIvYnVpbGRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILCtCQUEyRDtBQUUzRCx1REFBbUQ7QUFFbkQseURBQStEO0FBQy9ELHVDQUE2QztBQUk3Qzs7Ozs7Ozs7R0FRRztBQUNILFNBQWdCLE9BQU8sQ0FDckIsT0FBZ0MsRUFDaEMsT0FBdUIsRUFDdkIsYUFJSSxFQUFFO0lBRU4scURBQXFEO0lBQ3JELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDO0lBQzVDLElBQUksQ0FBQyxXQUFXLEVBQUU7UUFDaEIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsNkRBQTZELENBQUMsQ0FBQztRQUVwRixPQUFPLFlBQUssQ0FBQztLQUNkO0lBRUQsT0FBTyxJQUFBLFlBQUssRUFBQyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FDaEUsSUFBQSxnQkFBUyxFQUFDLENBQUMsRUFBRSxXQUFXLEVBQUUsaUJBQWlCLEVBQUUsRUFBRSxFQUFFO1FBQy9DLDZEQUE2RDtRQUM3RCxJQUNFLFdBQVcsS0FBSywrQ0FBK0M7WUFDL0QsaUJBQWlCLENBQUMsWUFBWSxFQUM5QjtZQUNBLE9BQU8sSUFBQSxZQUFLLEVBQUMsR0FBRyxFQUFFLG1EQUFRLGVBQWUsR0FBQyxDQUFDLENBQUMsSUFBSSxDQUM5QyxJQUFBLGdCQUFTLEVBQUMsQ0FBQyxFQUFFLGFBQWEsRUFBRSxFQUFFLEVBQUUsQ0FBQyxhQUFhLENBQUMsaUJBQWlCLEVBQUUsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQ3pGLENBQUM7U0FDSDtRQUVELDRDQUE0QztRQUM1QyxPQUFPLElBQUEsWUFBSyxFQUFDLEdBQUcsRUFBRSxtREFBUSxrQkFBa0IsR0FBQyxDQUFDLENBQUMsSUFBSSxDQUNqRCxJQUFBLGdCQUFTLEVBQUMsQ0FBQyxFQUFFLG1CQUFtQixFQUFFLEVBQUUsRUFBRSxDQUNwQyxtQkFBbUIsQ0FBQyxpQkFBaUIsRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUN6RSxDQUNGLENBQUM7SUFDSixDQUFDLENBQUMsQ0FDSCxDQUFDO0FBQ0osQ0FBQztBQXJDRCwwQkFxQ0M7QUFFRCxLQUFLLFVBQVUsVUFBVSxDQUN2QixjQUF1QyxFQUN2QyxXQUFtQixFQUNuQixPQUF1QjtJQUV2Qiw4QkFBOEI7SUFDOUIsTUFBTSxJQUFBLGtDQUFvQixFQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRXBDLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxJQUFBLDBCQUFnQixFQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDdkYsTUFBTSxXQUFXLEdBQUcsTUFBTSxPQUFPLENBQUMsdUJBQXVCLENBQUMsaUJBQWlCLENBQUMsYUFBYSxDQUFDLENBQUM7SUFFM0YsSUFDRSxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQjtRQUNuQyxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUM7UUFDcEQsaUJBQWlCLENBQUMsSUFBSSxLQUFLLFdBQVcsRUFDdEM7UUFDQSxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQzs7Ozs7Ozs7S0FRbkIsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxJQUFJLGlCQUFpQixDQUFDLGdCQUFnQixFQUFFO1FBQ3RDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNqQiwwRUFBMEU7WUFDeEUsaUhBQWlILENBQ3BILENBQUM7S0FDSDtJQUVELElBQUksaUJBQWlCLENBQUMsWUFBWSxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxnQ0FBZ0MsQ0FBQyxFQUFFO1FBQy9GLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNqQixzRkFBc0Y7WUFDcEYsdURBQXVELENBQzFELENBQUM7S0FDSDtJQUVELGlCQUFpQixDQUFDLElBQUksR0FBRyxNQUFNLElBQUEsc0JBQVMsRUFBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFekYsT0FBTyxFQUFFLFdBQVcsRUFBRSxpQkFBaUIsRUFBRSxDQUFDO0FBQzVDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgRU1QVFksIE9ic2VydmFibGUsIGRlZmVyLCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzJztcbmltcG9ydCB0eXBlIHsgRXhlY3V0aW9uVHJhbnNmb3JtZXIgfSBmcm9tICcuLi8uLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7IGNoZWNrUG9ydCB9IGZyb20gJy4uLy4uL3V0aWxzL2NoZWNrLXBvcnQnO1xuaW1wb3J0IHR5cGUgeyBJbmRleEh0bWxUcmFuc2Zvcm0gfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2luZGV4LWh0bWwtZ2VuZXJhdG9yJztcbmltcG9ydCB7IHB1cmdlU3RhbGVCdWlsZENhY2hlIH0gZnJvbSAnLi4vLi4vdXRpbHMvcHVyZ2UtY2FjaGUnO1xuaW1wb3J0IHsgbm9ybWFsaXplT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgdHlwZSB7IFNjaGVtYSBhcyBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB0eXBlIHsgRGV2U2VydmVyQnVpbGRlck91dHB1dCB9IGZyb20gJy4vd2VicGFjay1zZXJ2ZXInO1xuXG4vKipcbiAqIEEgQnVpbGRlciB0aGF0IGV4ZWN1dGVzIGEgZGV2ZWxvcG1lbnQgc2VydmVyIGJhc2VkIG9uIHRoZSBwcm92aWRlZCBicm93c2VyIHRhcmdldCBvcHRpb24uXG4gKiBAcGFyYW0gb3B0aW9ucyBEZXYgU2VydmVyIG9wdGlvbnMuXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgYnVpbGQgY29udGV4dC5cbiAqIEBwYXJhbSB0cmFuc2Zvcm1zIEEgbWFwIG9mIHRyYW5zZm9ybXMgdGhhdCBjYW4gYmUgdXNlZCB0byBob29rIGludG8gc29tZSBsb2dpYyAoc3VjaCBhc1xuICogdHJhbnNmb3JtaW5nIHdlYnBhY2sgY29uZmlndXJhdGlvbiBiZWZvcmUgcGFzc2luZyBpdCB0byB3ZWJwYWNrKS5cbiAqXG4gKiBAZXhwZXJpbWVudGFsIERpcmVjdCB1c2FnZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbnNpZGVyZWQgZXhwZXJpbWVudGFsLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZXhlY3V0ZShcbiAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB0cmFuc2Zvcm1zOiB7XG4gICAgd2VicGFja0NvbmZpZ3VyYXRpb24/OiBFeGVjdXRpb25UcmFuc2Zvcm1lcjxpbXBvcnQoJ3dlYnBhY2snKS5Db25maWd1cmF0aW9uPjtcbiAgICBsb2dnaW5nPzogaW1wb3J0KCdAYW5ndWxhci1kZXZraXQvYnVpbGQtd2VicGFjaycpLldlYnBhY2tMb2dnaW5nQ2FsbGJhY2s7XG4gICAgaW5kZXhIdG1sPzogSW5kZXhIdG1sVHJhbnNmb3JtO1xuICB9ID0ge30sXG4pOiBPYnNlcnZhYmxlPERldlNlcnZlckJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gRGV0ZXJtaW5lIHByb2plY3QgbmFtZSBmcm9tIGJ1aWxkZXIgY29udGV4dCB0YXJnZXRcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGBUaGUgJ2Rldi1zZXJ2ZXInIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQgdG8gYmUgc3BlY2lmaWVkLmApO1xuXG4gICAgcmV0dXJuIEVNUFRZO1xuICB9XG5cbiAgcmV0dXJuIGRlZmVyKCgpID0+IGluaXRpYWxpemUob3B0aW9ucywgcHJvamVjdE5hbWUsIGNvbnRleHQpKS5waXBlKFxuICAgIHN3aXRjaE1hcCgoeyBidWlsZGVyTmFtZSwgbm9ybWFsaXplZE9wdGlvbnMgfSkgPT4ge1xuICAgICAgLy8gVXNlIHZpdGUtYmFzZWQgZGV2ZWxvcG1lbnQgc2VydmVyIGZvciBlc2J1aWxkLWJhc2VkIGJ1aWxkc1xuICAgICAgaWYgKFxuICAgICAgICBidWlsZGVyTmFtZSA9PT0gJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOmJyb3dzZXItZXNidWlsZCcgfHxcbiAgICAgICAgbm9ybWFsaXplZE9wdGlvbnMuZm9yY2VFc2J1aWxkXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIGRlZmVyKCgpID0+IGltcG9ydCgnLi92aXRlLXNlcnZlcicpKS5waXBlKFxuICAgICAgICAgIHN3aXRjaE1hcCgoeyBzZXJ2ZVdpdGhWaXRlIH0pID0+IHNlcnZlV2l0aFZpdGUobm9ybWFsaXplZE9wdGlvbnMsIGJ1aWxkZXJOYW1lLCBjb250ZXh0KSksXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIC8vIFVzZSBXZWJwYWNrIGZvciBhbGwgb3RoZXIgYnJvd3NlciB0YXJnZXRzXG4gICAgICByZXR1cm4gZGVmZXIoKCkgPT4gaW1wb3J0KCcuL3dlYnBhY2stc2VydmVyJykpLnBpcGUoXG4gICAgICAgIHN3aXRjaE1hcCgoeyBzZXJ2ZVdlYnBhY2tCcm93c2VyIH0pID0+XG4gICAgICAgICAgc2VydmVXZWJwYWNrQnJvd3Nlcihub3JtYWxpemVkT3B0aW9ucywgYnVpbGRlck5hbWUsIGNvbnRleHQsIHRyYW5zZm9ybXMpLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICB9KSxcbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaW5pdGlhbGl6ZShcbiAgaW5pdGlhbE9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbikge1xuICAvLyBQdXJnZSBvbGQgYnVpbGQgZGlzayBjYWNoZS5cbiAgYXdhaXQgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUoY29udGV4dCk7XG5cbiAgY29uc3Qgbm9ybWFsaXplZE9wdGlvbnMgPSBhd2FpdCBub3JtYWxpemVPcHRpb25zKGNvbnRleHQsIHByb2plY3ROYW1lLCBpbml0aWFsT3B0aW9ucyk7XG4gIGNvbnN0IGJ1aWxkZXJOYW1lID0gYXdhaXQgY29udGV4dC5nZXRCdWlsZGVyTmFtZUZvclRhcmdldChub3JtYWxpemVkT3B0aW9ucy5icm93c2VyVGFyZ2V0KTtcblxuICBpZiAoXG4gICAgIW5vcm1hbGl6ZWRPcHRpb25zLmRpc2FibGVIb3N0Q2hlY2sgJiZcbiAgICAhL14xMjdcXC5cXGQrXFwuXFxkK1xcLlxcZCsvZy50ZXN0KG5vcm1hbGl6ZWRPcHRpb25zLmhvc3QpICYmXG4gICAgbm9ybWFsaXplZE9wdGlvbnMuaG9zdCAhPT0gJ2xvY2FsaG9zdCdcbiAgKSB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybihgXG5XYXJuaW5nOiBUaGlzIGlzIGEgc2ltcGxlIHNlcnZlciBmb3IgdXNlIGluIHRlc3Rpbmcgb3IgZGVidWdnaW5nIEFuZ3VsYXIgYXBwbGljYXRpb25zXG5sb2NhbGx5LiBJdCBoYXNuJ3QgYmVlbiByZXZpZXdlZCBmb3Igc2VjdXJpdHkgaXNzdWVzLlxuXG5CaW5kaW5nIHRoaXMgc2VydmVyIHRvIGFuIG9wZW4gY29ubmVjdGlvbiBjYW4gcmVzdWx0IGluIGNvbXByb21pc2luZyB5b3VyIGFwcGxpY2F0aW9uIG9yXG5jb21wdXRlci4gVXNpbmcgYSBkaWZmZXJlbnQgaG9zdCB0aGFuIHRoZSBvbmUgcGFzc2VkIHRvIHRoZSBcIi0taG9zdFwiIGZsYWcgbWlnaHQgcmVzdWx0IGluXG53ZWJzb2NrZXQgY29ubmVjdGlvbiBpc3N1ZXMuIFlvdSBtaWdodCBuZWVkIHRvIHVzZSBcIi0tZGlzYWJsZS1ob3N0LWNoZWNrXCIgaWYgdGhhdCdzIHRoZVxuY2FzZS5cbiAgICBgKTtcbiAgfVxuXG4gIGlmIChub3JtYWxpemVkT3B0aW9ucy5kaXNhYmxlSG9zdENoZWNrKSB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICdXYXJuaW5nOiBSdW5uaW5nIGEgc2VydmVyIHdpdGggLS1kaXNhYmxlLWhvc3QtY2hlY2sgaXMgYSBzZWN1cml0eSByaXNrLiAnICtcbiAgICAgICAgJ1NlZSBodHRwczovL21lZGl1bS5jb20vd2VicGFjay93ZWJwYWNrLWRldi1zZXJ2ZXItbWlkZGxld2FyZS1zZWN1cml0eS1pc3N1ZXMtMTQ4OWQ5NTA4NzRhIGZvciBtb3JlIGluZm9ybWF0aW9uLicsXG4gICAgKTtcbiAgfVxuXG4gIGlmIChub3JtYWxpemVkT3B0aW9ucy5mb3JjZUVzYnVpbGQgJiYgIWJ1aWxkZXJOYW1lLnN0YXJ0c1dpdGgoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOicpKSB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICdXYXJuaW5nOiBGb3JjaW5nIHRoZSB1c2Ugb2YgdGhlIGVzYnVpbGQtYmFzZWQgYnVpbGQgc3lzdGVtIHdpdGggdGhpcmQtcGFydHkgYnVpbGRlcnMnICtcbiAgICAgICAgJyBtYXkgY2F1c2UgdW5leHBlY3RlZCBiZWhhdmlvciBhbmQvb3IgYnVpbGQgZmFpbHVyZXMuJyxcbiAgICApO1xuICB9XG5cbiAgbm9ybWFsaXplZE9wdGlvbnMucG9ydCA9IGF3YWl0IGNoZWNrUG9ydChub3JtYWxpemVkT3B0aW9ucy5wb3J0LCBub3JtYWxpemVkT3B0aW9ucy5ob3N0KTtcblxuICByZXR1cm4geyBidWlsZGVyTmFtZSwgbm9ybWFsaXplZE9wdGlvbnMgfTtcbn1cbiJdfQ==