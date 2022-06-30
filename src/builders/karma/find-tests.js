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
exports.findTests = void 0;
const fs_1 = require("fs");
const glob_1 = __importStar(require("glob"));
const path_1 = require("path");
const util_1 = require("util");
const globPromise = (0, util_1.promisify)(glob_1.default);
// go through all patterns and find unique list of files
async function findTests(patterns, workspaceRoot, projectSourceRoot) {
    const matchingTestsPromises = patterns.map((pattern) => findMatchingTests(pattern, workspaceRoot, projectSourceRoot));
    const files = await Promise.all(matchingTestsPromises);
    // Unique file names
    return [...new Set(files.flat())];
}
exports.findTests = findTests;
const normalizePath = (path) => path.replace(/\\/g, '/');
async function findMatchingTests(pattern, workspaceRoot, projectSourceRoot) {
    // normalize pattern, glob lib only accepts forward slashes
    let normalizedPattern = normalizePath(pattern);
    const relativeProjectRoot = normalizePath((0, path_1.relative)(workspaceRoot, projectSourceRoot) + '/');
    // remove relativeProjectRoot to support relative paths from root
    // such paths are easy to get when running scripts via IDEs
    if (normalizedPattern.startsWith(relativeProjectRoot)) {
        normalizedPattern = normalizedPattern.substring(relativeProjectRoot.length);
    }
    // special logic when pattern does not look like a glob
    if (!(0, glob_1.hasMagic)(normalizedPattern)) {
        if (await isDirectory((0, path_1.join)(projectSourceRoot, normalizedPattern))) {
            normalizedPattern = `${normalizedPattern}/**/*.spec.@(ts|tsx)`;
        }
        else {
            // see if matching spec file exists
            const fileExt = (0, path_1.extname)(normalizedPattern);
            // Replace extension to `.spec.ext`. Example: `src/app/app.component.ts`-> `src/app/app.component.spec.ts`
            const potentialSpec = (0, path_1.join)((0, path_1.dirname)(normalizedPattern), `${(0, path_1.basename)(normalizedPattern, fileExt)}.spec${fileExt}`);
            if (await exists((0, path_1.join)(projectSourceRoot, potentialSpec))) {
                return [normalizePath(potentialSpec)];
            }
        }
    }
    return globPromise(normalizedPattern, {
        cwd: projectSourceRoot,
        root: projectSourceRoot,
        nomount: true,
    });
}
async function isDirectory(path) {
    try {
        const stats = await fs_1.promises.stat(path);
        return stats.isDirectory();
    }
    catch (_a) {
        return false;
    }
}
async function exists(path) {
    try {
        await fs_1.promises.access(path, fs_1.constants.F_OK);
        return true;
    }
    catch (_a) {
        return false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZC10ZXN0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2thcm1hL2ZpbmQtdGVzdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCwyQkFBeUQ7QUFDekQsNkNBQXNDO0FBQ3RDLCtCQUFrRTtBQUNsRSwrQkFBaUM7QUFFakMsTUFBTSxXQUFXLEdBQUcsSUFBQSxnQkFBUyxFQUFDLGNBQUksQ0FBQyxDQUFDO0FBRXBDLHdEQUF3RDtBQUNqRCxLQUFLLFVBQVUsU0FBUyxDQUM3QixRQUFrQixFQUNsQixhQUFxQixFQUNyQixpQkFBeUI7SUFFekIsTUFBTSxxQkFBcUIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FDckQsaUJBQWlCLENBQUMsT0FBTyxFQUFFLGFBQWEsRUFBRSxpQkFBaUIsQ0FBQyxDQUM3RCxDQUFDO0lBQ0YsTUFBTSxLQUFLLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUM7SUFFdkQsb0JBQW9CO0lBQ3BCLE9BQU8sQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDcEMsQ0FBQztBQVpELDhCQVlDO0FBRUQsTUFBTSxhQUFhLEdBQUcsQ0FBQyxJQUFZLEVBQVUsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBRXpFLEtBQUssVUFBVSxpQkFBaUIsQ0FDOUIsT0FBZSxFQUNmLGFBQXFCLEVBQ3JCLGlCQUF5QjtJQUV6QiwyREFBMkQ7SUFDM0QsSUFBSSxpQkFBaUIsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDL0MsTUFBTSxtQkFBbUIsR0FBRyxhQUFhLENBQUMsSUFBQSxlQUFRLEVBQUMsYUFBYSxFQUFFLGlCQUFpQixDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7SUFFNUYsaUVBQWlFO0lBQ2pFLDJEQUEyRDtJQUMzRCxJQUFJLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFO1FBQ3JELGlCQUFpQixHQUFHLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUM3RTtJQUVELHVEQUF1RDtJQUN2RCxJQUFJLENBQUMsSUFBQSxlQUFRLEVBQUMsaUJBQWlCLENBQUMsRUFBRTtRQUNoQyxJQUFJLE1BQU0sV0FBVyxDQUFDLElBQUEsV0FBSSxFQUFDLGlCQUFpQixFQUFFLGlCQUFpQixDQUFDLENBQUMsRUFBRTtZQUNqRSxpQkFBaUIsR0FBRyxHQUFHLGlCQUFpQixzQkFBc0IsQ0FBQztTQUNoRTthQUFNO1lBQ0wsbUNBQW1DO1lBQ25DLE1BQU0sT0FBTyxHQUFHLElBQUEsY0FBTyxFQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDM0MsMEdBQTBHO1lBQzFHLE1BQU0sYUFBYSxHQUFHLElBQUEsV0FBSSxFQUN4QixJQUFBLGNBQU8sRUFBQyxpQkFBaUIsQ0FBQyxFQUMxQixHQUFHLElBQUEsZUFBUSxFQUFDLGlCQUFpQixFQUFFLE9BQU8sQ0FBQyxRQUFRLE9BQU8sRUFBRSxDQUN6RCxDQUFDO1lBRUYsSUFBSSxNQUFNLE1BQU0sQ0FBQyxJQUFBLFdBQUksRUFBQyxpQkFBaUIsRUFBRSxhQUFhLENBQUMsQ0FBQyxFQUFFO2dCQUN4RCxPQUFPLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7YUFDdkM7U0FDRjtLQUNGO0lBRUQsT0FBTyxXQUFXLENBQUMsaUJBQWlCLEVBQUU7UUFDcEMsR0FBRyxFQUFFLGlCQUFpQjtRQUN0QixJQUFJLEVBQUUsaUJBQWlCO1FBQ3ZCLE9BQU8sRUFBRSxJQUFJO0tBQ2QsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELEtBQUssVUFBVSxXQUFXLENBQUMsSUFBYztJQUN2QyxJQUFJO1FBQ0YsTUFBTSxLQUFLLEdBQUcsTUFBTSxhQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRWxDLE9BQU8sS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDO0tBQzVCO0lBQUMsV0FBTTtRQUNOLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7QUFDSCxDQUFDO0FBRUQsS0FBSyxVQUFVLE1BQU0sQ0FBQyxJQUFjO0lBQ2xDLElBQUk7UUFDRixNQUFNLGFBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUV0QyxPQUFPLElBQUksQ0FBQztLQUNiO0lBQUMsV0FBTTtRQUNOLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IFBhdGhMaWtlLCBjb25zdGFudHMsIHByb21pc2VzIGFzIGZzIH0gZnJvbSAnZnMnO1xuaW1wb3J0IGdsb2IsIHsgaGFzTWFnaWMgfSBmcm9tICdnbG9iJztcbmltcG9ydCB7IGJhc2VuYW1lLCBkaXJuYW1lLCBleHRuYW1lLCBqb2luLCByZWxhdGl2ZSB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5cbmNvbnN0IGdsb2JQcm9taXNlID0gcHJvbWlzaWZ5KGdsb2IpO1xuXG4vLyBnbyB0aHJvdWdoIGFsbCBwYXR0ZXJucyBhbmQgZmluZCB1bmlxdWUgbGlzdCBvZiBmaWxlc1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbmRUZXN0cyhcbiAgcGF0dGVybnM6IHN0cmluZ1tdLFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIHByb2plY3RTb3VyY2VSb290OiBzdHJpbmcsXG4pOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gIGNvbnN0IG1hdGNoaW5nVGVzdHNQcm9taXNlcyA9IHBhdHRlcm5zLm1hcCgocGF0dGVybikgPT5cbiAgICBmaW5kTWF0Y2hpbmdUZXN0cyhwYXR0ZXJuLCB3b3Jrc3BhY2VSb290LCBwcm9qZWN0U291cmNlUm9vdCksXG4gICk7XG4gIGNvbnN0IGZpbGVzID0gYXdhaXQgUHJvbWlzZS5hbGwobWF0Y2hpbmdUZXN0c1Byb21pc2VzKTtcblxuICAvLyBVbmlxdWUgZmlsZSBuYW1lc1xuICByZXR1cm4gWy4uLm5ldyBTZXQoZmlsZXMuZmxhdCgpKV07XG59XG5cbmNvbnN0IG5vcm1hbGl6ZVBhdGggPSAocGF0aDogc3RyaW5nKTogc3RyaW5nID0+IHBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuXG5hc3luYyBmdW5jdGlvbiBmaW5kTWF0Y2hpbmdUZXN0cyhcbiAgcGF0dGVybjogc3RyaW5nLFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIHByb2plY3RTb3VyY2VSb290OiBzdHJpbmcsXG4pOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gIC8vIG5vcm1hbGl6ZSBwYXR0ZXJuLCBnbG9iIGxpYiBvbmx5IGFjY2VwdHMgZm9yd2FyZCBzbGFzaGVzXG4gIGxldCBub3JtYWxpemVkUGF0dGVybiA9IG5vcm1hbGl6ZVBhdGgocGF0dGVybik7XG4gIGNvbnN0IHJlbGF0aXZlUHJvamVjdFJvb3QgPSBub3JtYWxpemVQYXRoKHJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIHByb2plY3RTb3VyY2VSb290KSArICcvJyk7XG5cbiAgLy8gcmVtb3ZlIHJlbGF0aXZlUHJvamVjdFJvb3QgdG8gc3VwcG9ydCByZWxhdGl2ZSBwYXRocyBmcm9tIHJvb3RcbiAgLy8gc3VjaCBwYXRocyBhcmUgZWFzeSB0byBnZXQgd2hlbiBydW5uaW5nIHNjcmlwdHMgdmlhIElERXNcbiAgaWYgKG5vcm1hbGl6ZWRQYXR0ZXJuLnN0YXJ0c1dpdGgocmVsYXRpdmVQcm9qZWN0Um9vdCkpIHtcbiAgICBub3JtYWxpemVkUGF0dGVybiA9IG5vcm1hbGl6ZWRQYXR0ZXJuLnN1YnN0cmluZyhyZWxhdGl2ZVByb2plY3RSb290Lmxlbmd0aCk7XG4gIH1cblxuICAvLyBzcGVjaWFsIGxvZ2ljIHdoZW4gcGF0dGVybiBkb2VzIG5vdCBsb29rIGxpa2UgYSBnbG9iXG4gIGlmICghaGFzTWFnaWMobm9ybWFsaXplZFBhdHRlcm4pKSB7XG4gICAgaWYgKGF3YWl0IGlzRGlyZWN0b3J5KGpvaW4ocHJvamVjdFNvdXJjZVJvb3QsIG5vcm1hbGl6ZWRQYXR0ZXJuKSkpIHtcbiAgICAgIG5vcm1hbGl6ZWRQYXR0ZXJuID0gYCR7bm9ybWFsaXplZFBhdHRlcm59LyoqLyouc3BlYy5AKHRzfHRzeClgO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBzZWUgaWYgbWF0Y2hpbmcgc3BlYyBmaWxlIGV4aXN0c1xuICAgICAgY29uc3QgZmlsZUV4dCA9IGV4dG5hbWUobm9ybWFsaXplZFBhdHRlcm4pO1xuICAgICAgLy8gUmVwbGFjZSBleHRlbnNpb24gdG8gYC5zcGVjLmV4dGAuIEV4YW1wbGU6IGBzcmMvYXBwL2FwcC5jb21wb25lbnQudHNgLT4gYHNyYy9hcHAvYXBwLmNvbXBvbmVudC5zcGVjLnRzYFxuICAgICAgY29uc3QgcG90ZW50aWFsU3BlYyA9IGpvaW4oXG4gICAgICAgIGRpcm5hbWUobm9ybWFsaXplZFBhdHRlcm4pLFxuICAgICAgICBgJHtiYXNlbmFtZShub3JtYWxpemVkUGF0dGVybiwgZmlsZUV4dCl9LnNwZWMke2ZpbGVFeHR9YCxcbiAgICAgICk7XG5cbiAgICAgIGlmIChhd2FpdCBleGlzdHMoam9pbihwcm9qZWN0U291cmNlUm9vdCwgcG90ZW50aWFsU3BlYykpKSB7XG4gICAgICAgIHJldHVybiBbbm9ybWFsaXplUGF0aChwb3RlbnRpYWxTcGVjKV07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGdsb2JQcm9taXNlKG5vcm1hbGl6ZWRQYXR0ZXJuLCB7XG4gICAgY3dkOiBwcm9qZWN0U291cmNlUm9vdCxcbiAgICByb290OiBwcm9qZWN0U291cmNlUm9vdCxcbiAgICBub21vdW50OiB0cnVlLFxuICB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaXNEaXJlY3RvcnkocGF0aDogUGF0aExpa2UpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBzdGF0cyA9IGF3YWl0IGZzLnN0YXQocGF0aCk7XG5cbiAgICByZXR1cm4gc3RhdHMuaXNEaXJlY3RvcnkoKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGV4aXN0cyhwYXRoOiBQYXRoTGlrZSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICB0cnkge1xuICAgIGF3YWl0IGZzLmFjY2VzcyhwYXRoLCBjb25zdGFudHMuRl9PSyk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG4iXX0=