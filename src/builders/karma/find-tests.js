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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZC10ZXN0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2thcm1hL2ZpbmQtdGVzdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCwyQkFBeUQ7QUFDekQsNkNBQXNDO0FBQ3RDLCtCQUFrRTtBQUNsRSwrQkFBaUM7QUFFakMsTUFBTSxXQUFXLEdBQUcsSUFBQSxnQkFBUyxFQUFDLGNBQUksQ0FBQyxDQUFDO0FBRXBDLHdEQUF3RDtBQUNqRCxLQUFLLFVBQVUsU0FBUyxDQUM3QixRQUFrQixFQUNsQixhQUFxQixFQUNyQixpQkFBeUI7SUFFekIsTUFBTSxxQkFBcUIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FDckQsaUJBQWlCLENBQUMsT0FBTyxFQUFFLGFBQWEsRUFBRSxpQkFBaUIsQ0FBQyxDQUM3RCxDQUFDO0lBQ0YsTUFBTSxLQUFLLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUM7SUFFdkQsb0JBQW9CO0lBQ3BCLE9BQU8sQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDcEMsQ0FBQztBQVpELDhCQVlDO0FBRUQsTUFBTSxhQUFhLEdBQUcsQ0FBQyxJQUFZLEVBQVUsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBRXpFLEtBQUssVUFBVSxpQkFBaUIsQ0FDOUIsT0FBZSxFQUNmLGFBQXFCLEVBQ3JCLGlCQUF5QjtJQUV6QiwyREFBMkQ7SUFDM0QsSUFBSSxpQkFBaUIsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDL0MsTUFBTSxtQkFBbUIsR0FBRyxhQUFhLENBQUMsSUFBQSxlQUFRLEVBQUMsYUFBYSxFQUFFLGlCQUFpQixDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7SUFFNUYsaUVBQWlFO0lBQ2pFLDJEQUEyRDtJQUMzRCxJQUFJLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFO1FBQ3JELGlCQUFpQixHQUFHLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUM3RTtJQUVELHVEQUF1RDtJQUN2RCxJQUFJLENBQUMsSUFBQSxlQUFRLEVBQUMsaUJBQWlCLENBQUMsRUFBRTtRQUNoQyxJQUFJLE1BQU0sV0FBVyxDQUFDLElBQUEsV0FBSSxFQUFDLGlCQUFpQixFQUFFLGlCQUFpQixDQUFDLENBQUMsRUFBRTtZQUNqRSxpQkFBaUIsR0FBRyxHQUFHLGlCQUFpQixzQkFBc0IsQ0FBQztTQUNoRTthQUFNO1lBQ0wsbUNBQW1DO1lBQ25DLE1BQU0sT0FBTyxHQUFHLElBQUEsY0FBTyxFQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDM0MsMEdBQTBHO1lBQzFHLE1BQU0sYUFBYSxHQUFHLElBQUEsV0FBSSxFQUN4QixJQUFBLGNBQU8sRUFBQyxpQkFBaUIsQ0FBQyxFQUMxQixHQUFHLElBQUEsZUFBUSxFQUFDLGlCQUFpQixFQUFFLE9BQU8sQ0FBQyxRQUFRLE9BQU8sRUFBRSxDQUN6RCxDQUFDO1lBRUYsSUFBSSxNQUFNLE1BQU0sQ0FBQyxJQUFBLFdBQUksRUFBQyxpQkFBaUIsRUFBRSxhQUFhLENBQUMsQ0FBQyxFQUFFO2dCQUN4RCxPQUFPLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7YUFDdkM7U0FDRjtLQUNGO0lBRUQsT0FBTyxXQUFXLENBQUMsaUJBQWlCLEVBQUU7UUFDcEMsR0FBRyxFQUFFLGlCQUFpQjtLQUN2QixDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsS0FBSyxVQUFVLFdBQVcsQ0FBQyxJQUFjO0lBQ3ZDLElBQUk7UUFDRixNQUFNLEtBQUssR0FBRyxNQUFNLGFBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFbEMsT0FBTyxLQUFLLENBQUMsV0FBVyxFQUFFLENBQUM7S0FDNUI7SUFBQyxXQUFNO1FBQ04sT0FBTyxLQUFLLENBQUM7S0FDZDtBQUNILENBQUM7QUFFRCxLQUFLLFVBQVUsTUFBTSxDQUFDLElBQWM7SUFDbEMsSUFBSTtRQUNGLE1BQU0sYUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsY0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXRDLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFBQyxXQUFNO1FBQ04sT0FBTyxLQUFLLENBQUM7S0FDZDtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgUGF0aExpa2UsIGNvbnN0YW50cywgcHJvbWlzZXMgYXMgZnMgfSBmcm9tICdmcyc7XG5pbXBvcnQgZ2xvYiwgeyBoYXNNYWdpYyB9IGZyb20gJ2dsb2InO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGRpcm5hbWUsIGV4dG5hbWUsIGpvaW4sIHJlbGF0aXZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJztcblxuY29uc3QgZ2xvYlByb21pc2UgPSBwcm9taXNpZnkoZ2xvYik7XG5cbi8vIGdvIHRocm91Z2ggYWxsIHBhdHRlcm5zIGFuZCBmaW5kIHVuaXF1ZSBsaXN0IG9mIGZpbGVzXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmluZFRlc3RzKFxuICBwYXR0ZXJuczogc3RyaW5nW10sXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgcHJvamVjdFNvdXJjZVJvb3Q6IHN0cmluZyxcbik6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgY29uc3QgbWF0Y2hpbmdUZXN0c1Byb21pc2VzID0gcGF0dGVybnMubWFwKChwYXR0ZXJuKSA9PlxuICAgIGZpbmRNYXRjaGluZ1Rlc3RzKHBhdHRlcm4sIHdvcmtzcGFjZVJvb3QsIHByb2plY3RTb3VyY2VSb290KSxcbiAgKTtcbiAgY29uc3QgZmlsZXMgPSBhd2FpdCBQcm9taXNlLmFsbChtYXRjaGluZ1Rlc3RzUHJvbWlzZXMpO1xuXG4gIC8vIFVuaXF1ZSBmaWxlIG5hbWVzXG4gIHJldHVybiBbLi4ubmV3IFNldChmaWxlcy5mbGF0KCkpXTtcbn1cblxuY29uc3Qgbm9ybWFsaXplUGF0aCA9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT4gcGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG5cbmFzeW5jIGZ1bmN0aW9uIGZpbmRNYXRjaGluZ1Rlc3RzKFxuICBwYXR0ZXJuOiBzdHJpbmcsXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgcHJvamVjdFNvdXJjZVJvb3Q6IHN0cmluZyxcbik6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgLy8gbm9ybWFsaXplIHBhdHRlcm4sIGdsb2IgbGliIG9ubHkgYWNjZXB0cyBmb3J3YXJkIHNsYXNoZXNcbiAgbGV0IG5vcm1hbGl6ZWRQYXR0ZXJuID0gbm9ybWFsaXplUGF0aChwYXR0ZXJuKTtcbiAgY29uc3QgcmVsYXRpdmVQcm9qZWN0Um9vdCA9IG5vcm1hbGl6ZVBhdGgocmVsYXRpdmUod29ya3NwYWNlUm9vdCwgcHJvamVjdFNvdXJjZVJvb3QpICsgJy8nKTtcblxuICAvLyByZW1vdmUgcmVsYXRpdmVQcm9qZWN0Um9vdCB0byBzdXBwb3J0IHJlbGF0aXZlIHBhdGhzIGZyb20gcm9vdFxuICAvLyBzdWNoIHBhdGhzIGFyZSBlYXN5IHRvIGdldCB3aGVuIHJ1bm5pbmcgc2NyaXB0cyB2aWEgSURFc1xuICBpZiAobm9ybWFsaXplZFBhdHRlcm4uc3RhcnRzV2l0aChyZWxhdGl2ZVByb2plY3RSb290KSkge1xuICAgIG5vcm1hbGl6ZWRQYXR0ZXJuID0gbm9ybWFsaXplZFBhdHRlcm4uc3Vic3RyaW5nKHJlbGF0aXZlUHJvamVjdFJvb3QubGVuZ3RoKTtcbiAgfVxuXG4gIC8vIHNwZWNpYWwgbG9naWMgd2hlbiBwYXR0ZXJuIGRvZXMgbm90IGxvb2sgbGlrZSBhIGdsb2JcbiAgaWYgKCFoYXNNYWdpYyhub3JtYWxpemVkUGF0dGVybikpIHtcbiAgICBpZiAoYXdhaXQgaXNEaXJlY3Rvcnkoam9pbihwcm9qZWN0U291cmNlUm9vdCwgbm9ybWFsaXplZFBhdHRlcm4pKSkge1xuICAgICAgbm9ybWFsaXplZFBhdHRlcm4gPSBgJHtub3JtYWxpemVkUGF0dGVybn0vKiovKi5zcGVjLkAodHN8dHN4KWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHNlZSBpZiBtYXRjaGluZyBzcGVjIGZpbGUgZXhpc3RzXG4gICAgICBjb25zdCBmaWxlRXh0ID0gZXh0bmFtZShub3JtYWxpemVkUGF0dGVybik7XG4gICAgICAvLyBSZXBsYWNlIGV4dGVuc2lvbiB0byBgLnNwZWMuZXh0YC4gRXhhbXBsZTogYHNyYy9hcHAvYXBwLmNvbXBvbmVudC50c2AtPiBgc3JjL2FwcC9hcHAuY29tcG9uZW50LnNwZWMudHNgXG4gICAgICBjb25zdCBwb3RlbnRpYWxTcGVjID0gam9pbihcbiAgICAgICAgZGlybmFtZShub3JtYWxpemVkUGF0dGVybiksXG4gICAgICAgIGAke2Jhc2VuYW1lKG5vcm1hbGl6ZWRQYXR0ZXJuLCBmaWxlRXh0KX0uc3BlYyR7ZmlsZUV4dH1gLFxuICAgICAgKTtcblxuICAgICAgaWYgKGF3YWl0IGV4aXN0cyhqb2luKHByb2plY3RTb3VyY2VSb290LCBwb3RlbnRpYWxTcGVjKSkpIHtcbiAgICAgICAgcmV0dXJuIFtub3JtYWxpemVQYXRoKHBvdGVudGlhbFNwZWMpXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gZ2xvYlByb21pc2Uobm9ybWFsaXplZFBhdHRlcm4sIHtcbiAgICBjd2Q6IHByb2plY3RTb3VyY2VSb290LFxuICB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaXNEaXJlY3RvcnkocGF0aDogUGF0aExpa2UpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBzdGF0cyA9IGF3YWl0IGZzLnN0YXQocGF0aCk7XG5cbiAgICByZXR1cm4gc3RhdHMuaXNEaXJlY3RvcnkoKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGV4aXN0cyhwYXRoOiBQYXRoTGlrZSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICB0cnkge1xuICAgIGF3YWl0IGZzLmFjY2VzcyhwYXRoLCBjb25zdGFudHMuRl9PSyk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG4iXX0=