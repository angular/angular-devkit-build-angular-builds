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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZC10ZXN0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2thcm1hL2ZpbmQtdGVzdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDJCQUF5RDtBQUN6RCw2Q0FBc0M7QUFDdEMsK0JBQWtFO0FBQ2xFLCtCQUFpQztBQUVqQyxNQUFNLFdBQVcsR0FBRyxJQUFBLGdCQUFTLEVBQUMsY0FBSSxDQUFDLENBQUM7QUFFcEMsd0RBQXdEO0FBQ2pELEtBQUssVUFBVSxTQUFTLENBQzdCLFFBQWtCLEVBQ2xCLGFBQXFCLEVBQ3JCLGlCQUF5QjtJQUV6QixNQUFNLHFCQUFxQixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUNyRCxpQkFBaUIsQ0FBQyxPQUFPLEVBQUUsYUFBYSxFQUFFLGlCQUFpQixDQUFDLENBQzdELENBQUM7SUFDRixNQUFNLEtBQUssR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsQ0FBQztJQUV2RCxvQkFBb0I7SUFDcEIsT0FBTyxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNwQyxDQUFDO0FBWkQsOEJBWUM7QUFFRCxNQUFNLGFBQWEsR0FBRyxDQUFDLElBQVksRUFBVSxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFFekUsS0FBSyxVQUFVLGlCQUFpQixDQUM5QixPQUFlLEVBQ2YsYUFBcUIsRUFDckIsaUJBQXlCO0lBRXpCLDJEQUEyRDtJQUMzRCxJQUFJLGlCQUFpQixHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUMvQyxNQUFNLG1CQUFtQixHQUFHLGFBQWEsQ0FBQyxJQUFBLGVBQVEsRUFBQyxhQUFhLEVBQUUsaUJBQWlCLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQztJQUU1RixpRUFBaUU7SUFDakUsMkRBQTJEO0lBQzNELElBQUksaUJBQWlCLENBQUMsVUFBVSxDQUFDLG1CQUFtQixDQUFDLEVBQUU7UUFDckQsaUJBQWlCLEdBQUcsaUJBQWlCLENBQUMsU0FBUyxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQzdFO0lBRUQsdURBQXVEO0lBQ3ZELElBQUksQ0FBQyxJQUFBLGVBQVEsRUFBQyxpQkFBaUIsQ0FBQyxFQUFFO1FBQ2hDLElBQUksTUFBTSxXQUFXLENBQUMsSUFBQSxXQUFJLEVBQUMsaUJBQWlCLEVBQUUsaUJBQWlCLENBQUMsQ0FBQyxFQUFFO1lBQ2pFLGlCQUFpQixHQUFHLEdBQUcsaUJBQWlCLHNCQUFzQixDQUFDO1NBQ2hFO2FBQU07WUFDTCxtQ0FBbUM7WUFDbkMsTUFBTSxPQUFPLEdBQUcsSUFBQSxjQUFPLEVBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUMzQywwR0FBMEc7WUFDMUcsTUFBTSxhQUFhLEdBQUcsSUFBQSxXQUFJLEVBQ3hCLElBQUEsY0FBTyxFQUFDLGlCQUFpQixDQUFDLEVBQzFCLEdBQUcsSUFBQSxlQUFRLEVBQUMsaUJBQWlCLEVBQUUsT0FBTyxDQUFDLFFBQVEsT0FBTyxFQUFFLENBQ3pELENBQUM7WUFFRixJQUFJLE1BQU0sTUFBTSxDQUFDLElBQUEsV0FBSSxFQUFDLGlCQUFpQixFQUFFLGFBQWEsQ0FBQyxDQUFDLEVBQUU7Z0JBQ3hELE9BQU8sQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQzthQUN2QztTQUNGO0tBQ0Y7SUFFRCxPQUFPLFdBQVcsQ0FBQyxpQkFBaUIsRUFBRTtRQUNwQyxHQUFHLEVBQUUsaUJBQWlCO0tBQ3ZCLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxLQUFLLFVBQVUsV0FBVyxDQUFDLElBQWM7SUFDdkMsSUFBSTtRQUNGLE1BQU0sS0FBSyxHQUFHLE1BQU0sYUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVsQyxPQUFPLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQztLQUM1QjtJQUFDLFdBQU07UUFDTixPQUFPLEtBQUssQ0FBQztLQUNkO0FBQ0gsQ0FBQztBQUVELEtBQUssVUFBVSxNQUFNLENBQUMsSUFBYztJQUNsQyxJQUFJO1FBQ0YsTUFBTSxhQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxjQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdEMsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUFDLFdBQU07UUFDTixPQUFPLEtBQUssQ0FBQztLQUNkO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBQYXRoTGlrZSwgY29uc3RhbnRzLCBwcm9taXNlcyBhcyBmcyB9IGZyb20gJ2ZzJztcbmltcG9ydCBnbG9iLCB7IGhhc01hZ2ljIH0gZnJvbSAnZ2xvYic7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSwgZXh0bmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuXG5jb25zdCBnbG9iUHJvbWlzZSA9IHByb21pc2lmeShnbG9iKTtcblxuLy8gZ28gdGhyb3VnaCBhbGwgcGF0dGVybnMgYW5kIGZpbmQgdW5pcXVlIGxpc3Qgb2YgZmlsZXNcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmaW5kVGVzdHMoXG4gIHBhdHRlcm5zOiBzdHJpbmdbXSxcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBwcm9qZWN0U291cmNlUm9vdDogc3RyaW5nLFxuKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICBjb25zdCBtYXRjaGluZ1Rlc3RzUHJvbWlzZXMgPSBwYXR0ZXJucy5tYXAoKHBhdHRlcm4pID0+XG4gICAgZmluZE1hdGNoaW5nVGVzdHMocGF0dGVybiwgd29ya3NwYWNlUm9vdCwgcHJvamVjdFNvdXJjZVJvb3QpLFxuICApO1xuICBjb25zdCBmaWxlcyA9IGF3YWl0IFByb21pc2UuYWxsKG1hdGNoaW5nVGVzdHNQcm9taXNlcyk7XG5cbiAgLy8gVW5pcXVlIGZpbGUgbmFtZXNcbiAgcmV0dXJuIFsuLi5uZXcgU2V0KGZpbGVzLmZsYXQoKSldO1xufVxuXG5jb25zdCBub3JtYWxpemVQYXRoID0gKHBhdGg6IHN0cmluZyk6IHN0cmluZyA9PiBwYXRoLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcblxuYXN5bmMgZnVuY3Rpb24gZmluZE1hdGNoaW5nVGVzdHMoXG4gIHBhdHRlcm46IHN0cmluZyxcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBwcm9qZWN0U291cmNlUm9vdDogc3RyaW5nLFxuKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAvLyBub3JtYWxpemUgcGF0dGVybiwgZ2xvYiBsaWIgb25seSBhY2NlcHRzIGZvcndhcmQgc2xhc2hlc1xuICBsZXQgbm9ybWFsaXplZFBhdHRlcm4gPSBub3JtYWxpemVQYXRoKHBhdHRlcm4pO1xuICBjb25zdCByZWxhdGl2ZVByb2plY3RSb290ID0gbm9ybWFsaXplUGF0aChyZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCBwcm9qZWN0U291cmNlUm9vdCkgKyAnLycpO1xuXG4gIC8vIHJlbW92ZSByZWxhdGl2ZVByb2plY3RSb290IHRvIHN1cHBvcnQgcmVsYXRpdmUgcGF0aHMgZnJvbSByb290XG4gIC8vIHN1Y2ggcGF0aHMgYXJlIGVhc3kgdG8gZ2V0IHdoZW4gcnVubmluZyBzY3JpcHRzIHZpYSBJREVzXG4gIGlmIChub3JtYWxpemVkUGF0dGVybi5zdGFydHNXaXRoKHJlbGF0aXZlUHJvamVjdFJvb3QpKSB7XG4gICAgbm9ybWFsaXplZFBhdHRlcm4gPSBub3JtYWxpemVkUGF0dGVybi5zdWJzdHJpbmcocmVsYXRpdmVQcm9qZWN0Um9vdC5sZW5ndGgpO1xuICB9XG5cbiAgLy8gc3BlY2lhbCBsb2dpYyB3aGVuIHBhdHRlcm4gZG9lcyBub3QgbG9vayBsaWtlIGEgZ2xvYlxuICBpZiAoIWhhc01hZ2ljKG5vcm1hbGl6ZWRQYXR0ZXJuKSkge1xuICAgIGlmIChhd2FpdCBpc0RpcmVjdG9yeShqb2luKHByb2plY3RTb3VyY2VSb290LCBub3JtYWxpemVkUGF0dGVybikpKSB7XG4gICAgICBub3JtYWxpemVkUGF0dGVybiA9IGAke25vcm1hbGl6ZWRQYXR0ZXJufS8qKi8qLnNwZWMuQCh0c3x0c3gpYDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gc2VlIGlmIG1hdGNoaW5nIHNwZWMgZmlsZSBleGlzdHNcbiAgICAgIGNvbnN0IGZpbGVFeHQgPSBleHRuYW1lKG5vcm1hbGl6ZWRQYXR0ZXJuKTtcbiAgICAgIC8vIFJlcGxhY2UgZXh0ZW5zaW9uIHRvIGAuc3BlYy5leHRgLiBFeGFtcGxlOiBgc3JjL2FwcC9hcHAuY29tcG9uZW50LnRzYC0+IGBzcmMvYXBwL2FwcC5jb21wb25lbnQuc3BlYy50c2BcbiAgICAgIGNvbnN0IHBvdGVudGlhbFNwZWMgPSBqb2luKFxuICAgICAgICBkaXJuYW1lKG5vcm1hbGl6ZWRQYXR0ZXJuKSxcbiAgICAgICAgYCR7YmFzZW5hbWUobm9ybWFsaXplZFBhdHRlcm4sIGZpbGVFeHQpfS5zcGVjJHtmaWxlRXh0fWAsXG4gICAgICApO1xuXG4gICAgICBpZiAoYXdhaXQgZXhpc3RzKGpvaW4ocHJvamVjdFNvdXJjZVJvb3QsIHBvdGVudGlhbFNwZWMpKSkge1xuICAgICAgICByZXR1cm4gW25vcm1hbGl6ZVBhdGgocG90ZW50aWFsU3BlYyldO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBnbG9iUHJvbWlzZShub3JtYWxpemVkUGF0dGVybiwge1xuICAgIGN3ZDogcHJvamVjdFNvdXJjZVJvb3QsXG4gIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBpc0RpcmVjdG9yeShwYXRoOiBQYXRoTGlrZSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICB0cnkge1xuICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnMuc3RhdChwYXRoKTtcblxuICAgIHJldHVybiBzdGF0cy5pc0RpcmVjdG9yeSgpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZXhpc3RzKHBhdGg6IFBhdGhMaWtlKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgZnMuYWNjZXNzKHBhdGgsIGNvbnN0YW50cy5GX09LKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cbiJdfQ==