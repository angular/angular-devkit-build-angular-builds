"use strict";
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
function generateEntryPoints(appConfig) {
    let entryPoints = ['polyfills', 'sw-register'];
    // Add all styles/scripts, except lazy-loaded ones.
    const lazyChunkBundleNames = [...appConfig.styles, ...appConfig.scripts]
        .filter(entry => !entry.lazy)
        .map(entry => entry.bundleName)
        .forEach(bundleName => {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFja2FnZS1jaHVuay1zb3J0LmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcGFja2FnZS1jaHVuay1zb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBaUI7QUFDakIsK0RBQStEOztBQUkvRCw2QkFBb0MsU0FBYztJQUNoRCxJQUFJLFdBQVcsR0FBRyxDQUFDLFdBQVcsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUUvQyxtREFBbUQ7SUFDbkQsTUFBTSxvQkFBb0IsR0FBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQXVCO1NBQzVGLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztTQUM1QixHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDO1NBQzlCLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRTtRQUNwQixFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzQyxXQUFXLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQy9CLENBQUM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVMLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFekIsTUFBTSxDQUFDLFdBQVcsQ0FBQztBQUNyQixDQUFDO0FBaEJELGtEQWdCQztBQUVELCtDQUErQztBQUMvQyw4Q0FBOEM7QUFDOUMsMEJBQWlDLFNBQWM7SUFDN0MsTUFBTSxXQUFXLEdBQUcsbUJBQW1CLENBQUMsU0FBUyxDQUFDLENBQUM7SUFFbkQsY0FBYyxJQUFTLEVBQUUsS0FBVTtRQUNqQyxJQUFJLFNBQVMsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuRCxJQUFJLFVBQVUsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVyRCxFQUFFLENBQUMsQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUMzQixNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ1gsQ0FBQztRQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUNsQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDWixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ1gsQ0FBQztJQUNILENBQUM7SUFFRCxnR0FBZ0c7SUFDaEcsa0JBQWtCO0lBQ2pCLElBQVksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO0lBQ3hDLE1BQU0sQ0FBQyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBcEJELDRDQW9CQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIHRzbGludDpkaXNhYmxlXG4vLyBUT0RPOiBjbGVhbnVwIHRoaXMgZmlsZSwgaXQncyBjb3BpZWQgYXMgaXMgZnJvbSBBbmd1bGFyIENMSS5cblxuaW1wb3J0IHsgRXh0cmFFbnRyeVBvaW50IH0gZnJvbSAnLi4vLi4vYnJvd3Nlcic7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUVudHJ5UG9pbnRzKGFwcENvbmZpZzogYW55KSB7XG4gIGxldCBlbnRyeVBvaW50cyA9IFsncG9seWZpbGxzJywgJ3N3LXJlZ2lzdGVyJ107XG5cbiAgLy8gQWRkIGFsbCBzdHlsZXMvc2NyaXB0cywgZXhjZXB0IGxhenktbG9hZGVkIG9uZXMuXG4gIGNvbnN0IGxhenlDaHVua0J1bmRsZU5hbWVzID0gKFsuLi5hcHBDb25maWcuc3R5bGVzLCAuLi5hcHBDb25maWcuc2NyaXB0c10gYXMgRXh0cmFFbnRyeVBvaW50W10pXG4gICAgLmZpbHRlcihlbnRyeSA9PiAhZW50cnkubGF6eSlcbiAgICAubWFwKGVudHJ5ID0+IGVudHJ5LmJ1bmRsZU5hbWUpXG4gICAgLmZvckVhY2goYnVuZGxlTmFtZSA9PiB7XG4gICAgICBpZiAoZW50cnlQb2ludHMuaW5kZXhPZihidW5kbGVOYW1lKSA9PT0gLTEpIHtcbiAgICAgICAgZW50cnlQb2ludHMucHVzaChidW5kbGVOYW1lKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICBlbnRyeVBvaW50cy5wdXNoKCdtYWluJyk7XG5cbiAgcmV0dXJuIGVudHJ5UG9pbnRzO1xufVxuXG4vLyBTb3J0IGNodW5rcyBhY2NvcmRpbmcgdG8gYSBwcmVkZWZpbmVkIG9yZGVyOlxuLy8gaW5saW5lLCBwb2x5ZmlsbHMsIGFsbCBzdHlsZXMsIHZlbmRvciwgbWFpblxuZXhwb3J0IGZ1bmN0aW9uIHBhY2thZ2VDaHVua1NvcnQoYXBwQ29uZmlnOiBhbnkpIHtcbiAgY29uc3QgZW50cnlQb2ludHMgPSBnZW5lcmF0ZUVudHJ5UG9pbnRzKGFwcENvbmZpZyk7XG5cbiAgZnVuY3Rpb24gc29ydChsZWZ0OiBhbnksIHJpZ2h0OiBhbnkpIHtcbiAgICBsZXQgbGVmdEluZGV4ID0gZW50cnlQb2ludHMuaW5kZXhPZihsZWZ0Lm5hbWVzWzBdKTtcbiAgICBsZXQgcmlnaHRpbmRleCA9IGVudHJ5UG9pbnRzLmluZGV4T2YocmlnaHQubmFtZXNbMF0pO1xuXG4gICAgaWYgKGxlZnRJbmRleCA+IHJpZ2h0aW5kZXgpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH0gZWxzZSBpZiAobGVmdEluZGV4IDwgcmlnaHRpbmRleCkge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG4gIH1cblxuICAvLyBXZSBuZWVkIHRvIGxpc3Qgb2YgZW50cnkgcG9pbnRzIGZvciB0aGUgRWplY3RlZCB3ZWJwYWNrIGNvbmZpZyB0byB3b3JrICh3ZSByZXVzZSB0aGUgZnVuY3Rpb25cbiAgLy8gZGVmaW5lZCBhYm92ZSkuXG4gIChzb3J0IGFzIGFueSkuZW50cnlQb2ludHMgPSBlbnRyeVBvaW50cztcbiAgcmV0dXJuIHNvcnQ7XG59XG4iXX0=