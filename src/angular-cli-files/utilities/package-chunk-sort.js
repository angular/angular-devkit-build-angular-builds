"use strict";
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../models/webpack-configs/utils");
function generateEntryPoints(appConfig) {
    let entryPoints = ['polyfills', 'sw-register'];
    const pushExtraEntries = (extraEntry) => {
        if (entryPoints.indexOf(extraEntry.entry) === -1) {
            entryPoints.push(extraEntry.entry);
        }
    };
    if (appConfig.styles) {
        utils_1.extraEntryParser(appConfig.styles, './', 'styles')
            .filter(entry => !entry.lazy)
            .forEach(pushExtraEntries);
    }
    if (appConfig.scripts) {
        utils_1.extraEntryParser(appConfig.scripts, './', 'scripts')
            .filter(entry => !entry.lazy)
            .forEach(pushExtraEntries);
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFja2FnZS1jaHVuay1zb3J0LmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcGFja2FnZS1jaHVuay1zb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBaUI7QUFDakIsK0RBQStEOztBQUUvRCwyREFBK0U7QUFFL0UsNkJBQW9DLFNBQWM7SUFDaEQsSUFBSSxXQUFXLEdBQUcsQ0FBQyxXQUFXLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFFL0MsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLFVBQXNCLEVBQUUsRUFBRTtRQUNsRCxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFlLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0QsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBZSxDQUFDLENBQUM7UUFDL0MsQ0FBQztJQUNILENBQUMsQ0FBQztJQUVGLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ3JCLHdCQUFnQixDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQzthQUMvQyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7YUFDNUIsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVELEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLHdCQUFnQixDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVMsQ0FBQzthQUNqRCxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7YUFDNUIsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVELFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFekIsTUFBTSxDQUFDLFdBQVcsQ0FBQztBQUNyQixDQUFDO0FBeEJELGtEQXdCQztBQUVELCtDQUErQztBQUMvQyw4Q0FBOEM7QUFDOUMsMEJBQWlDLFNBQWM7SUFDN0MsTUFBTSxXQUFXLEdBQUcsbUJBQW1CLENBQUMsU0FBUyxDQUFDLENBQUM7SUFFbkQsY0FBYyxJQUFTLEVBQUUsS0FBVTtRQUNqQyxJQUFJLFNBQVMsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuRCxJQUFJLFVBQVUsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVyRCxFQUFFLENBQUMsQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUMzQixNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ1gsQ0FBQztRQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUNsQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDWixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ1gsQ0FBQztJQUNILENBQUM7SUFFRCxnR0FBZ0c7SUFDaEcsa0JBQWtCO0lBQ2pCLElBQVksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO0lBQ3hDLE1BQU0sQ0FBQyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBcEJELDRDQW9CQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIHRzbGludDpkaXNhYmxlXG4vLyBUT0RPOiBjbGVhbnVwIHRoaXMgZmlsZSwgaXQncyBjb3BpZWQgYXMgaXMgZnJvbSBBbmd1bGFyIENMSS5cblxuaW1wb3J0IHsgRXh0cmFFbnRyeSwgZXh0cmFFbnRyeVBhcnNlciB9IGZyb20gJy4uL21vZGVscy93ZWJwYWNrLWNvbmZpZ3MvdXRpbHMnO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVFbnRyeVBvaW50cyhhcHBDb25maWc6IGFueSkge1xuICBsZXQgZW50cnlQb2ludHMgPSBbJ3BvbHlmaWxscycsICdzdy1yZWdpc3RlciddO1xuXG4gIGNvbnN0IHB1c2hFeHRyYUVudHJpZXMgPSAoZXh0cmFFbnRyeTogRXh0cmFFbnRyeSkgPT4ge1xuICAgIGlmIChlbnRyeVBvaW50cy5pbmRleE9mKGV4dHJhRW50cnkuZW50cnkgYXMgc3RyaW5nKSA9PT0gLTEpIHtcbiAgICAgIGVudHJ5UG9pbnRzLnB1c2goZXh0cmFFbnRyeS5lbnRyeSBhcyBzdHJpbmcpO1xuICAgIH1cbiAgfTtcblxuICBpZiAoYXBwQ29uZmlnLnN0eWxlcykge1xuICAgIGV4dHJhRW50cnlQYXJzZXIoYXBwQ29uZmlnLnN0eWxlcywgJy4vJywgJ3N0eWxlcycpXG4gICAgICAuZmlsdGVyKGVudHJ5ID0+ICFlbnRyeS5sYXp5KVxuICAgICAgLmZvckVhY2gocHVzaEV4dHJhRW50cmllcyk7XG4gIH1cblxuICBpZiAoYXBwQ29uZmlnLnNjcmlwdHMpIHtcbiAgICBleHRyYUVudHJ5UGFyc2VyKGFwcENvbmZpZy5zY3JpcHRzLCAnLi8nLCAnc2NyaXB0cycpXG4gICAgICAuZmlsdGVyKGVudHJ5ID0+ICFlbnRyeS5sYXp5KVxuICAgICAgLmZvckVhY2gocHVzaEV4dHJhRW50cmllcyk7XG4gIH1cblxuICBlbnRyeVBvaW50cy5wdXNoKCdtYWluJyk7XG5cbiAgcmV0dXJuIGVudHJ5UG9pbnRzO1xufVxuXG4vLyBTb3J0IGNodW5rcyBhY2NvcmRpbmcgdG8gYSBwcmVkZWZpbmVkIG9yZGVyOlxuLy8gaW5saW5lLCBwb2x5ZmlsbHMsIGFsbCBzdHlsZXMsIHZlbmRvciwgbWFpblxuZXhwb3J0IGZ1bmN0aW9uIHBhY2thZ2VDaHVua1NvcnQoYXBwQ29uZmlnOiBhbnkpIHtcbiAgY29uc3QgZW50cnlQb2ludHMgPSBnZW5lcmF0ZUVudHJ5UG9pbnRzKGFwcENvbmZpZyk7XG5cbiAgZnVuY3Rpb24gc29ydChsZWZ0OiBhbnksIHJpZ2h0OiBhbnkpIHtcbiAgICBsZXQgbGVmdEluZGV4ID0gZW50cnlQb2ludHMuaW5kZXhPZihsZWZ0Lm5hbWVzWzBdKTtcbiAgICBsZXQgcmlnaHRpbmRleCA9IGVudHJ5UG9pbnRzLmluZGV4T2YocmlnaHQubmFtZXNbMF0pO1xuXG4gICAgaWYgKGxlZnRJbmRleCA+IHJpZ2h0aW5kZXgpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH0gZWxzZSBpZiAobGVmdEluZGV4IDwgcmlnaHRpbmRleCkge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG4gIH1cblxuICAvLyBXZSBuZWVkIHRvIGxpc3Qgb2YgZW50cnkgcG9pbnRzIGZvciB0aGUgRWplY3RlZCB3ZWJwYWNrIGNvbmZpZyB0byB3b3JrICh3ZSByZXVzZSB0aGUgZnVuY3Rpb25cbiAgLy8gZGVmaW5lZCBhYm92ZSkuXG4gIChzb3J0IGFzIGFueSkuZW50cnlQb2ludHMgPSBlbnRyeVBvaW50cztcbiAgcmV0dXJuIHNvcnQ7XG59XG4iXX0=