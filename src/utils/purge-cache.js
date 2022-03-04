"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.purgeStaleBuildCache = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const normalize_cache_1 = require("./normalize-cache");
/** Delete stale cache directories used by previous versions of build-angular. */
async function purgeStaleBuildCache(context) {
    var _a;
    const projectName = (_a = context.target) === null || _a === void 0 ? void 0 : _a.project;
    if (!projectName) {
        return;
    }
    const metadata = await context.getProjectMetadata(projectName);
    const { basePath, path, enabled } = (0, normalize_cache_1.normalizeCacheOptions)(metadata, context.workspaceRoot);
    if (!enabled || !(0, fs_1.existsSync)(basePath)) {
        return;
    }
    const entriesToDelete = (await fs_1.promises.readdir(basePath, { withFileTypes: true }))
        .filter((d) => (0, path_1.join)(basePath, d.name) !== path && d.isDirectory())
        .map((d) => {
        const subPath = (0, path_1.join)(basePath, d.name);
        try {
            return fs_1.promises.rm(subPath, { force: true, recursive: true, maxRetries: 3 });
        }
        catch (_a) { }
    });
    await Promise.all(entriesToDelete);
}
exports.purgeStaleBuildCache = purgeStaleBuildCache;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVyZ2UtY2FjaGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9wdXJnZS1jYWNoZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFHSCwyQkFBa0U7QUFDbEUsK0JBQTRCO0FBQzVCLHVEQUEwRDtBQUUxRCxpRkFBaUY7QUFDMUUsS0FBSyxVQUFVLG9CQUFvQixDQUFDLE9BQXVCOztJQUNoRSxNQUFNLFdBQVcsR0FBRyxNQUFBLE9BQU8sQ0FBQyxNQUFNLDBDQUFFLE9BQU8sQ0FBQztJQUM1QyxJQUFJLENBQUMsV0FBVyxFQUFFO1FBQ2hCLE9BQU87S0FDUjtJQUVELE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQy9ELE1BQU0sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxHQUFHLElBQUEsdUNBQXFCLEVBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUUzRixJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBQSxlQUFVLEVBQUMsUUFBUSxDQUFDLEVBQUU7UUFDckMsT0FBTztLQUNSO0lBRUQsTUFBTSxlQUFlLEdBQUcsQ0FBQyxNQUFNLGFBQVUsQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7U0FDbEYsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFBLFdBQUksRUFBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7U0FDakUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7UUFDVCxNQUFNLE9BQU8sR0FBRyxJQUFBLFdBQUksRUFBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLElBQUk7WUFDRixPQUFPLGFBQVUsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1NBQ2hGO1FBQUMsV0FBTSxHQUFFO0lBQ1osQ0FBQyxDQUFDLENBQUM7SUFFTCxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDckMsQ0FBQztBQXZCRCxvREF1QkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IFBhdGhMaWtlLCBleGlzdHNTeW5jLCBwcm9taXNlcyBhcyBmc1Byb21pc2VzIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgbm9ybWFsaXplQ2FjaGVPcHRpb25zIH0gZnJvbSAnLi9ub3JtYWxpemUtY2FjaGUnO1xuXG4vKiogRGVsZXRlIHN0YWxlIGNhY2hlIGRpcmVjdG9yaWVzIHVzZWQgYnkgcHJldmlvdXMgdmVyc2lvbnMgb2YgYnVpbGQtYW5ndWxhci4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwdXJnZVN0YWxlQnVpbGRDYWNoZShjb250ZXh0OiBCdWlsZGVyQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0Py5wcm9qZWN0O1xuICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgbWV0YWRhdGEgPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gIGNvbnN0IHsgYmFzZVBhdGgsIHBhdGgsIGVuYWJsZWQgfSA9IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyhtZXRhZGF0YSwgY29udGV4dC53b3Jrc3BhY2VSb290KTtcblxuICBpZiAoIWVuYWJsZWQgfHwgIWV4aXN0c1N5bmMoYmFzZVBhdGgpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgZW50cmllc1RvRGVsZXRlID0gKGF3YWl0IGZzUHJvbWlzZXMucmVhZGRpcihiYXNlUGF0aCwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pKVxuICAgIC5maWx0ZXIoKGQpID0+IGpvaW4oYmFzZVBhdGgsIGQubmFtZSkgIT09IHBhdGggJiYgZC5pc0RpcmVjdG9yeSgpKVxuICAgIC5tYXAoKGQpID0+IHtcbiAgICAgIGNvbnN0IHN1YlBhdGggPSBqb2luKGJhc2VQYXRoLCBkLm5hbWUpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIGZzUHJvbWlzZXMucm0oc3ViUGF0aCwgeyBmb3JjZTogdHJ1ZSwgcmVjdXJzaXZlOiB0cnVlLCBtYXhSZXRyaWVzOiAzIH0pO1xuICAgICAgfSBjYXRjaCB7fVxuICAgIH0pO1xuXG4gIGF3YWl0IFByb21pc2UuYWxsKGVudHJpZXNUb0RlbGV0ZSk7XG59XG4iXX0=