"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../models/webpack-configs/utils");
function generateEntryPoints(appConfig) {
    let entryPoints = ['polyfills', 'sw-register'];
    // Add all styles/scripts, except lazy-loaded ones.
    [
        ...utils_1.normalizeExtraEntryPoints(appConfig.styles, 'styles')
            .filter(entry => !entry.lazy)
            .map(entry => entry.bundleName),
        ...utils_1.normalizeExtraEntryPoints(appConfig.scripts, 'scripts')
            .filter(entry => !entry.lazy)
            .map(entry => entry.bundleName),
    ].forEach(bundleName => {
        if (entryPoints.indexOf(bundleName) === -1) {
            entryPoints.push(bundleName);
        }
    });
    entryPoints.push('main');
    return entryPoints;
}
exports.generateEntryPoints = generateEntryPoints;
// Sort chunks according to a predefined order:
// inline, polyfills, all styles, vendor, main
function packageChunkSort(appConfig) {
    const entryPoints = generateEntryPoints(appConfig);
    function sort(left, right) {
        let leftIndex = entryPoints.indexOf(left.names[0]);
        let rightindex = entryPoints.indexOf(right.names[0]);
        if (leftIndex > rightindex) {
            return 1;
        }
        else if (leftIndex < rightindex) {
            return -1;
        }
        else {
            return 0;
        }
    }
    // We need to list of entry points for the Ejected webpack config to work (we reuse the function
    // defined above).
    sort.entryPoints = entryPoints;
    return sort;
}
exports.packageChunkSort = packageChunkSort;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFja2FnZS1jaHVuay1zb3J0LmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcGFja2FnZS1jaHVuay1zb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7QUFDSCxpQkFBaUI7QUFDakIsK0RBQStEOztBQUcvRCwyREFBNEU7QUFFNUUsU0FBZ0IsbUJBQW1CLENBQUMsU0FBYztJQUNoRCxJQUFJLFdBQVcsR0FBRyxDQUFDLFdBQVcsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUUvQyxtREFBbUQ7SUFDbkQ7UUFDRSxHQUFHLGlDQUF5QixDQUFDLFNBQVMsQ0FBQyxNQUEyQixFQUFFLFFBQVEsQ0FBQzthQUMxRSxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7YUFDNUIsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQztRQUNqQyxHQUFHLGlDQUF5QixDQUFDLFNBQVMsQ0FBQyxPQUE0QixFQUFFLFNBQVMsQ0FBQzthQUM1RSxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7YUFDNUIsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQztLQUNsQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRTtRQUNyQixJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7WUFDMUMsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUM5QjtJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUV6QixPQUFPLFdBQVcsQ0FBQztBQUNyQixDQUFDO0FBcEJELGtEQW9CQztBQUVELCtDQUErQztBQUMvQyw4Q0FBOEM7QUFDOUMsU0FBZ0IsZ0JBQWdCLENBQUMsU0FBYztJQUM3QyxNQUFNLFdBQVcsR0FBRyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUVuRCxTQUFTLElBQUksQ0FBQyxJQUFTLEVBQUUsS0FBVTtRQUNqQyxJQUFJLFNBQVMsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuRCxJQUFJLFVBQVUsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVyRCxJQUFJLFNBQVMsR0FBRyxVQUFVLEVBQUU7WUFDMUIsT0FBTyxDQUFDLENBQUM7U0FDVjthQUFNLElBQUksU0FBUyxHQUFHLFVBQVUsRUFBRTtZQUNqQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1NBQ1g7YUFBTTtZQUNMLE9BQU8sQ0FBQyxDQUFDO1NBQ1Y7SUFDSCxDQUFDO0lBRUQsZ0dBQWdHO0lBQ2hHLGtCQUFrQjtJQUNqQixJQUFZLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztJQUN4QyxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFwQkQsNENBb0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG5pbXBvcnQgeyBFeHRyYUVudHJ5UG9pbnQgfSBmcm9tICcuLi8uLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzIH0gZnJvbSAnLi4vbW9kZWxzL3dlYnBhY2stY29uZmlncy91dGlscyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUVudHJ5UG9pbnRzKGFwcENvbmZpZzogYW55KSB7XG4gIGxldCBlbnRyeVBvaW50cyA9IFsncG9seWZpbGxzJywgJ3N3LXJlZ2lzdGVyJ107XG5cbiAgLy8gQWRkIGFsbCBzdHlsZXMvc2NyaXB0cywgZXhjZXB0IGxhenktbG9hZGVkIG9uZXMuXG4gIFtcbiAgICAuLi5ub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKGFwcENvbmZpZy5zdHlsZXMgYXMgRXh0cmFFbnRyeVBvaW50W10sICdzdHlsZXMnKVxuICAgICAgLmZpbHRlcihlbnRyeSA9PiAhZW50cnkubGF6eSlcbiAgICAgIC5tYXAoZW50cnkgPT4gZW50cnkuYnVuZGxlTmFtZSksXG4gICAgLi4ubm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhhcHBDb25maWcuc2NyaXB0cyBhcyBFeHRyYUVudHJ5UG9pbnRbXSwgJ3NjcmlwdHMnKVxuICAgICAgLmZpbHRlcihlbnRyeSA9PiAhZW50cnkubGF6eSlcbiAgICAgIC5tYXAoZW50cnkgPT4gZW50cnkuYnVuZGxlTmFtZSksXG4gIF0uZm9yRWFjaChidW5kbGVOYW1lID0+IHtcbiAgICBpZiAoZW50cnlQb2ludHMuaW5kZXhPZihidW5kbGVOYW1lKSA9PT0gLTEpIHtcbiAgICAgIGVudHJ5UG9pbnRzLnB1c2goYnVuZGxlTmFtZSk7XG4gICAgfVxuICB9KTtcblxuICBlbnRyeVBvaW50cy5wdXNoKCdtYWluJyk7XG5cbiAgcmV0dXJuIGVudHJ5UG9pbnRzO1xufVxuXG4vLyBTb3J0IGNodW5rcyBhY2NvcmRpbmcgdG8gYSBwcmVkZWZpbmVkIG9yZGVyOlxuLy8gaW5saW5lLCBwb2x5ZmlsbHMsIGFsbCBzdHlsZXMsIHZlbmRvciwgbWFpblxuZXhwb3J0IGZ1bmN0aW9uIHBhY2thZ2VDaHVua1NvcnQoYXBwQ29uZmlnOiBhbnkpIHtcbiAgY29uc3QgZW50cnlQb2ludHMgPSBnZW5lcmF0ZUVudHJ5UG9pbnRzKGFwcENvbmZpZyk7XG5cbiAgZnVuY3Rpb24gc29ydChsZWZ0OiBhbnksIHJpZ2h0OiBhbnkpIHtcbiAgICBsZXQgbGVmdEluZGV4ID0gZW50cnlQb2ludHMuaW5kZXhPZihsZWZ0Lm5hbWVzWzBdKTtcbiAgICBsZXQgcmlnaHRpbmRleCA9IGVudHJ5UG9pbnRzLmluZGV4T2YocmlnaHQubmFtZXNbMF0pO1xuXG4gICAgaWYgKGxlZnRJbmRleCA+IHJpZ2h0aW5kZXgpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH0gZWxzZSBpZiAobGVmdEluZGV4IDwgcmlnaHRpbmRleCkge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG4gIH1cblxuICAvLyBXZSBuZWVkIHRvIGxpc3Qgb2YgZW50cnkgcG9pbnRzIGZvciB0aGUgRWplY3RlZCB3ZWJwYWNrIGNvbmZpZyB0byB3b3JrICh3ZSByZXVzZSB0aGUgZnVuY3Rpb25cbiAgLy8gZGVmaW5lZCBhYm92ZSkuXG4gIChzb3J0IGFzIGFueSkuZW50cnlQb2ludHMgPSBlbnRyeVBvaW50cztcbiAgcmV0dXJuIHNvcnQ7XG59XG4iXX0=