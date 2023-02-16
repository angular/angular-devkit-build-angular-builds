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
const path_1 = require("path");
const rxjs_1 = require("rxjs");
const normalize_cache_1 = require("../../utils/normalize-cache");
const purge_cache_1 = require("../../utils/purge-cache");
/**
 * @experimental Direct usage of this function is considered experimental.
 */
function execute(options, context) {
    return (0, rxjs_1.from)((async () => {
        var _a;
        // Purge old build disk cache.
        await (0, purge_cache_1.purgeStaleBuildCache)(context);
        const root = context.workspaceRoot;
        const packager = (await Promise.resolve().then(() => __importStar(require('ng-packagr')))).ngPackagr();
        packager.forProject((0, path_1.resolve)(root, options.project));
        if (options.tsConfig) {
            packager.withTsConfig((0, path_1.resolve)(root, options.tsConfig));
        }
        const projectName = (_a = context.target) === null || _a === void 0 ? void 0 : _a.project;
        if (!projectName) {
            throw new Error('The builder requires a target.');
        }
        const metadata = await context.getProjectMetadata(projectName);
        const { enabled: cacheEnabled, path: cacheDirectory } = (0, normalize_cache_1.normalizeCacheOptions)(metadata, context.workspaceRoot);
        const ngPackagrOptions = {
            cacheEnabled,
            cacheDirectory: (0, path_1.join)(cacheDirectory, 'ng-packagr'),
        };
        return { packager, ngPackagrOptions };
    })()).pipe((0, rxjs_1.switchMap)(({ packager, ngPackagrOptions }) => options.watch ? packager.watch(ngPackagrOptions) : packager.build(ngPackagrOptions)), (0, rxjs_1.mapTo)({ success: true }), (0, rxjs_1.catchError)((err) => (0, rxjs_1.of)({ success: false, error: err.message })));
}
exports.execute = execute;
exports.default = (0, architect_1.createBuilder)(execute);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9uZy1wYWNrYWdyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQXlGO0FBQ3pGLCtCQUFxQztBQUNyQywrQkFBMEU7QUFDMUUsaUVBQW9FO0FBQ3BFLHlEQUErRDtBQUcvRDs7R0FFRztBQUNILFNBQWdCLE9BQU8sQ0FDckIsT0FBZ0MsRUFDaEMsT0FBdUI7SUFFdkIsT0FBTyxJQUFBLFdBQUksRUFDVCxDQUFDLEtBQUssSUFBSSxFQUFFOztRQUNWLDhCQUE4QjtRQUM5QixNQUFNLElBQUEsa0NBQW9CLEVBQUMsT0FBTyxDQUFDLENBQUM7UUFFcEMsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztRQUNuQyxNQUFNLFFBQVEsR0FBRyxDQUFDLHdEQUFhLFlBQVksR0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUM7UUFFMUQsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFBLGNBQU8sRUFBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFFcEQsSUFBSSxPQUFPLENBQUMsUUFBUSxFQUFFO1lBQ3BCLFFBQVEsQ0FBQyxZQUFZLENBQUMsSUFBQSxjQUFPLEVBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1NBQ3hEO1FBRUQsTUFBTSxXQUFXLEdBQUcsTUFBQSxPQUFPLENBQUMsTUFBTSwwQ0FBRSxPQUFPLENBQUM7UUFDNUMsSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUNoQixNQUFNLElBQUksS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7U0FDbkQ7UUFFRCxNQUFNLFFBQVEsR0FBRyxNQUFNLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMvRCxNQUFNLEVBQUUsT0FBTyxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLEdBQUcsSUFBQSx1Q0FBcUIsRUFDM0UsUUFBUSxFQUNSLE9BQU8sQ0FBQyxhQUFhLENBQ3RCLENBQUM7UUFFRixNQUFNLGdCQUFnQixHQUFHO1lBQ3ZCLFlBQVk7WUFDWixjQUFjLEVBQUUsSUFBQSxXQUFJLEVBQUMsY0FBYyxFQUFFLFlBQVksQ0FBQztTQUNuRCxDQUFDO1FBRUYsT0FBTyxFQUFFLFFBQVEsRUFBRSxnQkFBZ0IsRUFBRSxDQUFDO0lBQ3hDLENBQUMsQ0FBQyxFQUFFLENBQ0wsQ0FBQyxJQUFJLENBQ0osSUFBQSxnQkFBUyxFQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsZ0JBQWdCLEVBQUUsRUFBRSxFQUFFLENBQzNDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUNwRixFQUNELElBQUEsWUFBSyxFQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQ3hCLElBQUEsaUJBQVUsRUFBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsSUFBQSxTQUFFLEVBQUMsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUNoRSxDQUFDO0FBQ0osQ0FBQztBQTNDRCwwQkEyQ0M7QUFHRCxrQkFBZSxJQUFBLHlCQUFhLEVBQW1ELE9BQU8sQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBqb2luLCByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBjYXRjaEVycm9yLCBmcm9tLCBtYXBUbywgb2YsIHN3aXRjaE1hcCB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgbm9ybWFsaXplQ2FjaGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvbm9ybWFsaXplLWNhY2hlJztcbmltcG9ydCB7IHB1cmdlU3RhbGVCdWlsZENhY2hlIH0gZnJvbSAnLi4vLi4vdXRpbHMvcHVyZ2UtY2FjaGUnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIE5nUGFja2FnckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG4vKipcbiAqIEBleHBlcmltZW50YWwgRGlyZWN0IHVzYWdlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uc2lkZXJlZCBleHBlcmltZW50YWwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleGVjdXRlKFxuICBvcHRpb25zOiBOZ1BhY2thZ3JCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBPYnNlcnZhYmxlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgcmV0dXJuIGZyb20oXG4gICAgKGFzeW5jICgpID0+IHtcbiAgICAgIC8vIFB1cmdlIG9sZCBidWlsZCBkaXNrIGNhY2hlLlxuICAgICAgYXdhaXQgcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUoY29udGV4dCk7XG5cbiAgICAgIGNvbnN0IHJvb3QgPSBjb250ZXh0LndvcmtzcGFjZVJvb3Q7XG4gICAgICBjb25zdCBwYWNrYWdlciA9IChhd2FpdCBpbXBvcnQoJ25nLXBhY2thZ3InKSkubmdQYWNrYWdyKCk7XG5cbiAgICAgIHBhY2thZ2VyLmZvclByb2plY3QocmVzb2x2ZShyb290LCBvcHRpb25zLnByb2plY3QpKTtcblxuICAgICAgaWYgKG9wdGlvbnMudHNDb25maWcpIHtcbiAgICAgICAgcGFja2FnZXIud2l0aFRzQ29uZmlnKHJlc29sdmUocm9vdCwgb3B0aW9ucy50c0NvbmZpZykpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0Py5wcm9qZWN0O1xuICAgICAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0LicpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgICAgIGNvbnN0IHsgZW5hYmxlZDogY2FjaGVFbmFibGVkLCBwYXRoOiBjYWNoZURpcmVjdG9yeSB9ID0gbm9ybWFsaXplQ2FjaGVPcHRpb25zKFxuICAgICAgICBtZXRhZGF0YSxcbiAgICAgICAgY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgKTtcblxuICAgICAgY29uc3QgbmdQYWNrYWdyT3B0aW9ucyA9IHtcbiAgICAgICAgY2FjaGVFbmFibGVkLFxuICAgICAgICBjYWNoZURpcmVjdG9yeTogam9pbihjYWNoZURpcmVjdG9yeSwgJ25nLXBhY2thZ3InKSxcbiAgICAgIH07XG5cbiAgICAgIHJldHVybiB7IHBhY2thZ2VyLCBuZ1BhY2thZ3JPcHRpb25zIH07XG4gICAgfSkoKSxcbiAgKS5waXBlKFxuICAgIHN3aXRjaE1hcCgoeyBwYWNrYWdlciwgbmdQYWNrYWdyT3B0aW9ucyB9KSA9PlxuICAgICAgb3B0aW9ucy53YXRjaCA/IHBhY2thZ2VyLndhdGNoKG5nUGFja2Fnck9wdGlvbnMpIDogcGFja2FnZXIuYnVpbGQobmdQYWNrYWdyT3B0aW9ucyksXG4gICAgKSxcbiAgICBtYXBUbyh7IHN1Y2Nlc3M6IHRydWUgfSksXG4gICAgY2F0Y2hFcnJvcigoZXJyKSA9PiBvZih7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpLFxuICApO1xufVxuXG5leHBvcnQgeyBOZ1BhY2thZ3JCdWlsZGVyT3B0aW9ucyB9O1xuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcjxSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ICYgTmdQYWNrYWdyQnVpbGRlck9wdGlvbnM+KGV4ZWN1dGUpO1xuIl19