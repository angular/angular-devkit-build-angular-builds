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
const glob = __importStar(require("glob"));
const path_1 = require("path");
const is_directory_1 = require("../../utils/is-directory");
// go through all patterns and find unique list of files
function findTests(patterns, cwd, workspaceRoot) {
    return patterns.reduce((files, pattern) => {
        const relativePathToMain = cwd.replace(workspaceRoot, '').substr(1); // remove leading slash
        const tests = findMatchingTests(pattern, cwd, relativePathToMain);
        tests.forEach((file) => {
            if (!files.includes(file)) {
                files.push(file);
            }
        });
        return files;
    }, []);
}
exports.findTests = findTests;
function findMatchingTests(pattern, cwd, relativePathToMain) {
    // normalize pattern, glob lib only accepts forward slashes
    pattern = pattern.replace(/\\/g, '/');
    relativePathToMain = relativePathToMain.replace(/\\/g, '/');
    // remove relativePathToMain to support relative paths from root
    // such paths are easy to get when running scripts via IDEs
    if (pattern.startsWith(relativePathToMain + '/')) {
        pattern = pattern.substr(relativePathToMain.length + 1); // +1 to include slash
    }
    // special logic when pattern does not look like a glob
    if (!glob.hasMagic(pattern)) {
        if ((0, is_directory_1.isDirectory)((0, path_1.join)(cwd, pattern))) {
            pattern = `${pattern}/**/*.spec.@(ts|tsx)`;
        }
        else {
            // see if matching spec file exists
            const extension = (0, path_1.extname)(pattern);
            const matchingSpec = `${(0, path_1.basename)(pattern, extension)}.spec${extension}`;
            if ((0, fs_1.existsSync)((0, path_1.join)(cwd, (0, path_1.dirname)(pattern), matchingSpec))) {
                pattern = (0, path_1.join)((0, path_1.dirname)(pattern), matchingSpec).replace(/\\/g, '/');
            }
        }
    }
    const files = glob.sync(pattern, {
        cwd,
    });
    return files;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZC10ZXN0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2thcm1hL2ZpbmQtdGVzdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCwyQkFBZ0M7QUFDaEMsMkNBQTZCO0FBQzdCLCtCQUF3RDtBQUN4RCwyREFBdUQ7QUFFdkQsd0RBQXdEO0FBQ3hELFNBQWdCLFNBQVMsQ0FBQyxRQUFrQixFQUFFLEdBQVcsRUFBRSxhQUFxQjtJQUM5RSxPQUFPLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLEVBQUU7UUFDeEMsTUFBTSxrQkFBa0IsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyx1QkFBdUI7UUFDNUYsTUFBTSxLQUFLLEdBQUcsaUJBQWlCLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBQ2xFLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUNyQixJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDekIsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUNsQjtRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDLEVBQUUsRUFBYyxDQUFDLENBQUM7QUFDckIsQ0FBQztBQVpELDhCQVlDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxPQUFlLEVBQUUsR0FBVyxFQUFFLGtCQUEwQjtJQUNqRiwyREFBMkQ7SUFDM0QsT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3RDLGtCQUFrQixHQUFHLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFFNUQsZ0VBQWdFO0lBQ2hFLDJEQUEyRDtJQUMzRCxJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsa0JBQWtCLEdBQUcsR0FBRyxDQUFDLEVBQUU7UUFDaEQsT0FBTyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsa0JBQWtCLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsc0JBQXNCO0tBQ2hGO0lBRUQsdURBQXVEO0lBQ3ZELElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzNCLElBQUksSUFBQSwwQkFBVyxFQUFDLElBQUEsV0FBSSxFQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQyxFQUFFO1lBQ25DLE9BQU8sR0FBRyxHQUFHLE9BQU8sc0JBQXNCLENBQUM7U0FDNUM7YUFBTTtZQUNMLG1DQUFtQztZQUNuQyxNQUFNLFNBQVMsR0FBRyxJQUFBLGNBQU8sRUFBQyxPQUFPLENBQUMsQ0FBQztZQUNuQyxNQUFNLFlBQVksR0FBRyxHQUFHLElBQUEsZUFBUSxFQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsUUFBUSxTQUFTLEVBQUUsQ0FBQztZQUV4RSxJQUFJLElBQUEsZUFBVSxFQUFDLElBQUEsV0FBSSxFQUFDLEdBQUcsRUFBRSxJQUFBLGNBQU8sRUFBQyxPQUFPLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQyxFQUFFO2dCQUN6RCxPQUFPLEdBQUcsSUFBQSxXQUFJLEVBQUMsSUFBQSxjQUFPLEVBQUMsT0FBTyxDQUFDLEVBQUUsWUFBWSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQzthQUNwRTtTQUNGO0tBQ0Y7SUFFRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRTtRQUMvQixHQUFHO0tBQ0osQ0FBQyxDQUFDO0lBRUgsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IGV4aXN0c1N5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBnbG9iIGZyb20gJ2dsb2InO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGRpcm5hbWUsIGV4dG5hbWUsIGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IGlzRGlyZWN0b3J5IH0gZnJvbSAnLi4vLi4vdXRpbHMvaXMtZGlyZWN0b3J5JztcblxuLy8gZ28gdGhyb3VnaCBhbGwgcGF0dGVybnMgYW5kIGZpbmQgdW5pcXVlIGxpc3Qgb2YgZmlsZXNcbmV4cG9ydCBmdW5jdGlvbiBmaW5kVGVzdHMocGF0dGVybnM6IHN0cmluZ1tdLCBjd2Q6IHN0cmluZywgd29ya3NwYWNlUm9vdDogc3RyaW5nKTogc3RyaW5nW10ge1xuICByZXR1cm4gcGF0dGVybnMucmVkdWNlKChmaWxlcywgcGF0dGVybikgPT4ge1xuICAgIGNvbnN0IHJlbGF0aXZlUGF0aFRvTWFpbiA9IGN3ZC5yZXBsYWNlKHdvcmtzcGFjZVJvb3QsICcnKS5zdWJzdHIoMSk7IC8vIHJlbW92ZSBsZWFkaW5nIHNsYXNoXG4gICAgY29uc3QgdGVzdHMgPSBmaW5kTWF0Y2hpbmdUZXN0cyhwYXR0ZXJuLCBjd2QsIHJlbGF0aXZlUGF0aFRvTWFpbik7XG4gICAgdGVzdHMuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgaWYgKCFmaWxlcy5pbmNsdWRlcyhmaWxlKSkge1xuICAgICAgICBmaWxlcy5wdXNoKGZpbGUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGZpbGVzO1xuICB9LCBbXSBhcyBzdHJpbmdbXSk7XG59XG5cbmZ1bmN0aW9uIGZpbmRNYXRjaGluZ1Rlc3RzKHBhdHRlcm46IHN0cmluZywgY3dkOiBzdHJpbmcsIHJlbGF0aXZlUGF0aFRvTWFpbjogc3RyaW5nKTogc3RyaW5nW10ge1xuICAvLyBub3JtYWxpemUgcGF0dGVybiwgZ2xvYiBsaWIgb25seSBhY2NlcHRzIGZvcndhcmQgc2xhc2hlc1xuICBwYXR0ZXJuID0gcGF0dGVybi5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gIHJlbGF0aXZlUGF0aFRvTWFpbiA9IHJlbGF0aXZlUGF0aFRvTWFpbi5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG5cbiAgLy8gcmVtb3ZlIHJlbGF0aXZlUGF0aFRvTWFpbiB0byBzdXBwb3J0IHJlbGF0aXZlIHBhdGhzIGZyb20gcm9vdFxuICAvLyBzdWNoIHBhdGhzIGFyZSBlYXN5IHRvIGdldCB3aGVuIHJ1bm5pbmcgc2NyaXB0cyB2aWEgSURFc1xuICBpZiAocGF0dGVybi5zdGFydHNXaXRoKHJlbGF0aXZlUGF0aFRvTWFpbiArICcvJykpIHtcbiAgICBwYXR0ZXJuID0gcGF0dGVybi5zdWJzdHIocmVsYXRpdmVQYXRoVG9NYWluLmxlbmd0aCArIDEpOyAvLyArMSB0byBpbmNsdWRlIHNsYXNoXG4gIH1cblxuICAvLyBzcGVjaWFsIGxvZ2ljIHdoZW4gcGF0dGVybiBkb2VzIG5vdCBsb29rIGxpa2UgYSBnbG9iXG4gIGlmICghZ2xvYi5oYXNNYWdpYyhwYXR0ZXJuKSkge1xuICAgIGlmIChpc0RpcmVjdG9yeShqb2luKGN3ZCwgcGF0dGVybikpKSB7XG4gICAgICBwYXR0ZXJuID0gYCR7cGF0dGVybn0vKiovKi5zcGVjLkAodHN8dHN4KWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHNlZSBpZiBtYXRjaGluZyBzcGVjIGZpbGUgZXhpc3RzXG4gICAgICBjb25zdCBleHRlbnNpb24gPSBleHRuYW1lKHBhdHRlcm4pO1xuICAgICAgY29uc3QgbWF0Y2hpbmdTcGVjID0gYCR7YmFzZW5hbWUocGF0dGVybiwgZXh0ZW5zaW9uKX0uc3BlYyR7ZXh0ZW5zaW9ufWA7XG5cbiAgICAgIGlmIChleGlzdHNTeW5jKGpvaW4oY3dkLCBkaXJuYW1lKHBhdHRlcm4pLCBtYXRjaGluZ1NwZWMpKSkge1xuICAgICAgICBwYXR0ZXJuID0gam9pbihkaXJuYW1lKHBhdHRlcm4pLCBtYXRjaGluZ1NwZWMpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjb25zdCBmaWxlcyA9IGdsb2Iuc3luYyhwYXR0ZXJuLCB7XG4gICAgY3dkLFxuICB9KTtcblxuICByZXR1cm4gZmlsZXM7XG59XG4iXX0=