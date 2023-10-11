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
        if (builderName === '@angular-devkit/build-angular:application' ||
            builderName === '@angular-devkit/build-angular:browser-esbuild' ||
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Rldi1zZXJ2ZXIvYnVpbGRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILCtCQUEyRDtBQUUzRCx1REFBbUQ7QUFFbkQseURBQStEO0FBQy9ELHVDQUE2QztBQUk3Qzs7Ozs7Ozs7R0FRRztBQUNILFNBQWdCLE9BQU8sQ0FDckIsT0FBZ0MsRUFDaEMsT0FBdUIsRUFDdkIsYUFJSSxFQUFFO0lBRU4scURBQXFEO0lBQ3JELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDO0lBQzVDLElBQUksQ0FBQyxXQUFXLEVBQUU7UUFDaEIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsNkRBQTZELENBQUMsQ0FBQztRQUVwRixPQUFPLFlBQUssQ0FBQztLQUNkO0lBRUQsT0FBTyxJQUFBLFlBQUssRUFBQyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FDaEUsSUFBQSxnQkFBUyxFQUFDLENBQUMsRUFBRSxXQUFXLEVBQUUsaUJBQWlCLEVBQUUsRUFBRSxFQUFFO1FBQy9DLDZEQUE2RDtRQUM3RCxJQUNFLFdBQVcsS0FBSywyQ0FBMkM7WUFDM0QsV0FBVyxLQUFLLCtDQUErQztZQUMvRCxpQkFBaUIsQ0FBQyxZQUFZLEVBQzlCO1lBQ0EsT0FBTyxJQUFBLFlBQUssRUFBQyxHQUFHLEVBQUUsbURBQVEsZUFBZSxHQUFDLENBQUMsQ0FBQyxJQUFJLENBQzlDLElBQUEsZ0JBQVMsRUFBQyxDQUFDLEVBQUUsYUFBYSxFQUFFLEVBQUUsRUFBRSxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsRUFBRSxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FDekYsQ0FBQztTQUNIO1FBRUQsNENBQTRDO1FBQzVDLE9BQU8sSUFBQSxZQUFLLEVBQUMsR0FBRyxFQUFFLG1EQUFRLGtCQUFrQixHQUFDLENBQUMsQ0FBQyxJQUFJLENBQ2pELElBQUEsZ0JBQVMsRUFBQyxDQUFDLEVBQUUsbUJBQW1CLEVBQUUsRUFBRSxFQUFFLENBQ3BDLG1CQUFtQixDQUFDLGlCQUFpQixFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsVUFBVSxDQUFDLENBQ3pFLENBQ0YsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUNILENBQUM7QUFDSixDQUFDO0FBdENELDBCQXNDQztBQUVELEtBQUssVUFBVSxVQUFVLENBQ3ZCLGNBQXVDLEVBQ3ZDLFdBQW1CLEVBQ25CLE9BQXVCO0lBRXZCLDhCQUE4QjtJQUM5QixNQUFNLElBQUEsa0NBQW9CLEVBQUMsT0FBTyxDQUFDLENBQUM7SUFFcEMsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLElBQUEsMEJBQWdCLEVBQUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxjQUFjLENBQUMsQ0FBQztJQUN2RixNQUFNLFdBQVcsR0FBRyxNQUFNLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUV6RixJQUNFLENBQUMsaUJBQWlCLENBQUMsZ0JBQWdCO1FBQ25DLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQztRQUNwRCxpQkFBaUIsQ0FBQyxJQUFJLEtBQUssV0FBVyxFQUN0QztRQUNBLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDOzs7Ozs7OztLQVFuQixDQUFDLENBQUM7S0FDSjtJQUVELElBQUksaUJBQWlCLENBQUMsZ0JBQWdCLEVBQUU7UUFDdEMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2pCLDBFQUEwRTtZQUN4RSxpSEFBaUgsQ0FDcEgsQ0FBQztLQUNIO0lBRUQsSUFBSSxpQkFBaUIsQ0FBQyxZQUFZLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLGdDQUFnQyxDQUFDLEVBQUU7UUFDL0YsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2pCLHNGQUFzRjtZQUNwRix1REFBdUQsQ0FDMUQsQ0FBQztLQUNIO0lBRUQsaUJBQWlCLENBQUMsSUFBSSxHQUFHLE1BQU0sSUFBQSxzQkFBUyxFQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV6RixPQUFPLEVBQUUsV0FBVyxFQUFFLGlCQUFpQixFQUFFLENBQUM7QUFDNUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBFTVBUWSwgT2JzZXJ2YWJsZSwgZGVmZXIsIHN3aXRjaE1hcCB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHR5cGUgeyBFeGVjdXRpb25UcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHsgY2hlY2tQb3J0IH0gZnJvbSAnLi4vLi4vdXRpbHMvY2hlY2stcG9ydCc7XG5pbXBvcnQgdHlwZSB7IEluZGV4SHRtbFRyYW5zZm9ybSB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUgfSBmcm9tICcuLi8uLi91dGlscy9wdXJnZS1jYWNoZSc7XG5pbXBvcnQgeyBub3JtYWxpemVPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB0eXBlIHsgU2NoZW1hIGFzIERldlNlcnZlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuaW1wb3J0IHR5cGUgeyBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0IH0gZnJvbSAnLi93ZWJwYWNrLXNlcnZlcic7XG5cbi8qKlxuICogQSBCdWlsZGVyIHRoYXQgZXhlY3V0ZXMgYSBkZXZlbG9wbWVudCBzZXJ2ZXIgYmFzZWQgb24gdGhlIHByb3ZpZGVkIGJyb3dzZXIgdGFyZ2V0IG9wdGlvbi5cbiAqIEBwYXJhbSBvcHRpb25zIERldiBTZXJ2ZXIgb3B0aW9ucy5cbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBidWlsZCBjb250ZXh0LlxuICogQHBhcmFtIHRyYW5zZm9ybXMgQSBtYXAgb2YgdHJhbnNmb3JtcyB0aGF0IGNhbiBiZSB1c2VkIHRvIGhvb2sgaW50byBzb21lIGxvZ2ljIChzdWNoIGFzXG4gKiB0cmFuc2Zvcm1pbmcgd2VicGFjayBjb25maWd1cmF0aW9uIGJlZm9yZSBwYXNzaW5nIGl0IHRvIHdlYnBhY2spLlxuICpcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleGVjdXRlKFxuICBvcHRpb25zOiBEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHRyYW5zZm9ybXM6IHtcbiAgICB3ZWJwYWNrQ29uZmlndXJhdGlvbj86IEV4ZWN1dGlvblRyYW5zZm9ybWVyPGltcG9ydCgnd2VicGFjaycpLkNvbmZpZ3VyYXRpb24+O1xuICAgIGxvZ2dpbmc/OiBpbXBvcnQoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC13ZWJwYWNrJykuV2VicGFja0xvZ2dpbmdDYWxsYmFjaztcbiAgICBpbmRleEh0bWw/OiBJbmRleEh0bWxUcmFuc2Zvcm07XG4gIH0gPSB7fSxcbik6IE9ic2VydmFibGU8RGV2U2VydmVyQnVpbGRlck91dHB1dD4ge1xuICAvLyBEZXRlcm1pbmUgcHJvamVjdCBuYW1lIGZyb20gYnVpbGRlciBjb250ZXh0IHRhcmdldFxuICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0Py5wcm9qZWN0O1xuICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoYFRoZSAnZGV2LXNlcnZlcicgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldCB0byBiZSBzcGVjaWZpZWQuYCk7XG5cbiAgICByZXR1cm4gRU1QVFk7XG4gIH1cblxuICByZXR1cm4gZGVmZXIoKCkgPT4gaW5pdGlhbGl6ZShvcHRpb25zLCBwcm9qZWN0TmFtZSwgY29udGV4dCkpLnBpcGUoXG4gICAgc3dpdGNoTWFwKCh7IGJ1aWxkZXJOYW1lLCBub3JtYWxpemVkT3B0aW9ucyB9KSA9PiB7XG4gICAgICAvLyBVc2Ugdml0ZS1iYXNlZCBkZXZlbG9wbWVudCBzZXJ2ZXIgZm9yIGVzYnVpbGQtYmFzZWQgYnVpbGRzXG4gICAgICBpZiAoXG4gICAgICAgIGJ1aWxkZXJOYW1lID09PSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6YXBwbGljYXRpb24nIHx8XG4gICAgICAgIGJ1aWxkZXJOYW1lID09PSAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6YnJvd3Nlci1lc2J1aWxkJyB8fFxuICAgICAgICBub3JtYWxpemVkT3B0aW9ucy5mb3JjZUVzYnVpbGRcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gZGVmZXIoKCkgPT4gaW1wb3J0KCcuL3ZpdGUtc2VydmVyJykpLnBpcGUoXG4gICAgICAgICAgc3dpdGNoTWFwKCh7IHNlcnZlV2l0aFZpdGUgfSkgPT4gc2VydmVXaXRoVml0ZShub3JtYWxpemVkT3B0aW9ucywgYnVpbGRlck5hbWUsIGNvbnRleHQpKSxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgLy8gVXNlIFdlYnBhY2sgZm9yIGFsbCBvdGhlciBicm93c2VyIHRhcmdldHNcbiAgICAgIHJldHVybiBkZWZlcigoKSA9PiBpbXBvcnQoJy4vd2VicGFjay1zZXJ2ZXInKSkucGlwZShcbiAgICAgICAgc3dpdGNoTWFwKCh7IHNlcnZlV2VicGFja0Jyb3dzZXIgfSkgPT5cbiAgICAgICAgICBzZXJ2ZVdlYnBhY2tCcm93c2VyKG5vcm1hbGl6ZWRPcHRpb25zLCBidWlsZGVyTmFtZSwgY29udGV4dCwgdHJhbnNmb3JtcyksXG4gICAgICAgICksXG4gICAgICApO1xuICAgIH0pLFxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplKFxuICBpbml0aWFsT3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKSB7XG4gIC8vIFB1cmdlIG9sZCBidWlsZCBkaXNrIGNhY2hlLlxuICBhd2FpdCBwdXJnZVN0YWxlQnVpbGRDYWNoZShjb250ZXh0KTtcblxuICBjb25zdCBub3JtYWxpemVkT3B0aW9ucyA9IGF3YWl0IG5vcm1hbGl6ZU9wdGlvbnMoY29udGV4dCwgcHJvamVjdE5hbWUsIGluaXRpYWxPcHRpb25zKTtcbiAgY29uc3QgYnVpbGRlck5hbWUgPSBhd2FpdCBjb250ZXh0LmdldEJ1aWxkZXJOYW1lRm9yVGFyZ2V0KG5vcm1hbGl6ZWRPcHRpb25zLmJ1aWxkVGFyZ2V0KTtcblxuICBpZiAoXG4gICAgIW5vcm1hbGl6ZWRPcHRpb25zLmRpc2FibGVIb3N0Q2hlY2sgJiZcbiAgICAhL14xMjdcXC5cXGQrXFwuXFxkK1xcLlxcZCsvZy50ZXN0KG5vcm1hbGl6ZWRPcHRpb25zLmhvc3QpICYmXG4gICAgbm9ybWFsaXplZE9wdGlvbnMuaG9zdCAhPT0gJ2xvY2FsaG9zdCdcbiAgKSB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybihgXG5XYXJuaW5nOiBUaGlzIGlzIGEgc2ltcGxlIHNlcnZlciBmb3IgdXNlIGluIHRlc3Rpbmcgb3IgZGVidWdnaW5nIEFuZ3VsYXIgYXBwbGljYXRpb25zXG5sb2NhbGx5LiBJdCBoYXNuJ3QgYmVlbiByZXZpZXdlZCBmb3Igc2VjdXJpdHkgaXNzdWVzLlxuXG5CaW5kaW5nIHRoaXMgc2VydmVyIHRvIGFuIG9wZW4gY29ubmVjdGlvbiBjYW4gcmVzdWx0IGluIGNvbXByb21pc2luZyB5b3VyIGFwcGxpY2F0aW9uIG9yXG5jb21wdXRlci4gVXNpbmcgYSBkaWZmZXJlbnQgaG9zdCB0aGFuIHRoZSBvbmUgcGFzc2VkIHRvIHRoZSBcIi0taG9zdFwiIGZsYWcgbWlnaHQgcmVzdWx0IGluXG53ZWJzb2NrZXQgY29ubmVjdGlvbiBpc3N1ZXMuIFlvdSBtaWdodCBuZWVkIHRvIHVzZSBcIi0tZGlzYWJsZS1ob3N0LWNoZWNrXCIgaWYgdGhhdCdzIHRoZVxuY2FzZS5cbiAgICBgKTtcbiAgfVxuXG4gIGlmIChub3JtYWxpemVkT3B0aW9ucy5kaXNhYmxlSG9zdENoZWNrKSB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICdXYXJuaW5nOiBSdW5uaW5nIGEgc2VydmVyIHdpdGggLS1kaXNhYmxlLWhvc3QtY2hlY2sgaXMgYSBzZWN1cml0eSByaXNrLiAnICtcbiAgICAgICAgJ1NlZSBodHRwczovL21lZGl1bS5jb20vd2VicGFjay93ZWJwYWNrLWRldi1zZXJ2ZXItbWlkZGxld2FyZS1zZWN1cml0eS1pc3N1ZXMtMTQ4OWQ5NTA4NzRhIGZvciBtb3JlIGluZm9ybWF0aW9uLicsXG4gICAgKTtcbiAgfVxuXG4gIGlmIChub3JtYWxpemVkT3B0aW9ucy5mb3JjZUVzYnVpbGQgJiYgIWJ1aWxkZXJOYW1lLnN0YXJ0c1dpdGgoJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOicpKSB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICdXYXJuaW5nOiBGb3JjaW5nIHRoZSB1c2Ugb2YgdGhlIGVzYnVpbGQtYmFzZWQgYnVpbGQgc3lzdGVtIHdpdGggdGhpcmQtcGFydHkgYnVpbGRlcnMnICtcbiAgICAgICAgJyBtYXkgY2F1c2UgdW5leHBlY3RlZCBiZWhhdmlvciBhbmQvb3IgYnVpbGQgZmFpbHVyZXMuJyxcbiAgICApO1xuICB9XG5cbiAgbm9ybWFsaXplZE9wdGlvbnMucG9ydCA9IGF3YWl0IGNoZWNrUG9ydChub3JtYWxpemVkT3B0aW9ucy5wb3J0LCBub3JtYWxpemVkT3B0aW9ucy5ob3N0KTtcblxuICByZXR1cm4geyBidWlsZGVyTmFtZSwgbm9ybWFsaXplZE9wdGlvbnMgfTtcbn1cbiJdfQ==