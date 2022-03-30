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
        return fs_1.promises
            .rm(subPath, { force: true, recursive: true, maxRetries: 3 })
            .catch(() => void 0);
    });
    await Promise.all(entriesToDelete);
}
exports.purgeStaleBuildCache = purgeStaleBuildCache;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVyZ2UtY2FjaGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9wdXJnZS1jYWNoZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFHSCwyQkFBa0U7QUFDbEUsK0JBQTRCO0FBQzVCLHVEQUEwRDtBQUUxRCxpRkFBaUY7QUFDMUUsS0FBSyxVQUFVLG9CQUFvQixDQUFDLE9BQXVCOztJQUNoRSxNQUFNLFdBQVcsR0FBRyxNQUFBLE9BQU8sQ0FBQyxNQUFNLDBDQUFFLE9BQU8sQ0FBQztJQUM1QyxJQUFJLENBQUMsV0FBVyxFQUFFO1FBQ2hCLE9BQU87S0FDUjtJQUVELE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQy9ELE1BQU0sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxHQUFHLElBQUEsdUNBQXFCLEVBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUUzRixJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBQSxlQUFVLEVBQUMsUUFBUSxDQUFDLEVBQUU7UUFDckMsT0FBTztLQUNSO0lBRUQsTUFBTSxlQUFlLEdBQUcsQ0FBQyxNQUFNLGFBQVUsQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7U0FDbEYsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFBLFdBQUksRUFBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7U0FDakUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7UUFDVCxNQUFNLE9BQU8sR0FBRyxJQUFBLFdBQUksRUFBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXZDLE9BQU8sYUFBVTthQUNkLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDO2FBQzVELEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ3pCLENBQUMsQ0FBQyxDQUFDO0lBRUwsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3JDLENBQUM7QUF4QkQsb0RBd0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBQYXRoTGlrZSwgZXhpc3RzU3luYywgcHJvbWlzZXMgYXMgZnNQcm9taXNlcyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyB9IGZyb20gJy4vbm9ybWFsaXplLWNhY2hlJztcblxuLyoqIERlbGV0ZSBzdGFsZSBjYWNoZSBkaXJlY3RvcmllcyB1c2VkIGJ5IHByZXZpb3VzIHZlcnNpb25zIG9mIGJ1aWxkLWFuZ3VsYXIuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcHVyZ2VTdGFsZUJ1aWxkQ2FjaGUoY29udGV4dDogQnVpbGRlckNvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IG1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICBjb25zdCB7IGJhc2VQYXRoLCBwYXRoLCBlbmFibGVkIH0gPSBub3JtYWxpemVDYWNoZU9wdGlvbnMobWV0YWRhdGEsIGNvbnRleHQud29ya3NwYWNlUm9vdCk7XG5cbiAgaWYgKCFlbmFibGVkIHx8ICFleGlzdHNTeW5jKGJhc2VQYXRoKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGVudHJpZXNUb0RlbGV0ZSA9IChhd2FpdCBmc1Byb21pc2VzLnJlYWRkaXIoYmFzZVBhdGgsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KSlcbiAgICAuZmlsdGVyKChkKSA9PiBqb2luKGJhc2VQYXRoLCBkLm5hbWUpICE9PSBwYXRoICYmIGQuaXNEaXJlY3RvcnkoKSlcbiAgICAubWFwKChkKSA9PiB7XG4gICAgICBjb25zdCBzdWJQYXRoID0gam9pbihiYXNlUGF0aCwgZC5uYW1lKTtcblxuICAgICAgcmV0dXJuIGZzUHJvbWlzZXNcbiAgICAgICAgLnJtKHN1YlBhdGgsIHsgZm9yY2U6IHRydWUsIHJlY3Vyc2l2ZTogdHJ1ZSwgbWF4UmV0cmllczogMyB9KVxuICAgICAgICAuY2F0Y2goKCkgPT4gdm9pZCAwKTtcbiAgICB9KTtcblxuICBhd2FpdCBQcm9taXNlLmFsbChlbnRyaWVzVG9EZWxldGUpO1xufVxuIl19