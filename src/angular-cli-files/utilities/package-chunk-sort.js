"use strict";
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../models/webpack-configs/utils");
function generateEntryPoints(appConfig) {
    let entryPoints = ['polyfills', 'sw-register'];
    // Add all styles/scripts, except lazy-loaded ones.
    [
        ...appConfig.styles
            .filter(entry => !entry.lazy)
            .map(entry => utils_1.computeBundleName(entry, 'styles')),
        ...appConfig.scripts
            .filter(entry => !entry.lazy)
            .map(entry => utils_1.computeBundleName(entry, 'scripts')),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFja2FnZS1jaHVuay1zb3J0LmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcGFja2FnZS1jaHVuay1zb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBaUI7QUFDakIsK0RBQStEOztBQUcvRCwyREFBb0U7QUFFcEUsNkJBQW9DLFNBQWM7SUFDaEQsSUFBSSxXQUFXLEdBQUcsQ0FBQyxXQUFXLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFFL0MsbURBQW1EO0lBQ25EO1FBQ0UsR0FBSSxTQUFTLENBQUMsTUFBNEI7YUFDdkMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO2FBQzVCLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLHlCQUFpQixDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNuRCxHQUFJLFNBQVMsQ0FBQyxPQUE2QjthQUN4QyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7YUFDNUIsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMseUJBQWlCLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0tBQ3JELENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1FBQ3JCLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNDLFdBQVcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDL0IsQ0FBQztJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUV6QixNQUFNLENBQUMsV0FBVyxDQUFDO0FBQ3JCLENBQUM7QUFwQkQsa0RBb0JDO0FBRUQsK0NBQStDO0FBQy9DLDhDQUE4QztBQUM5QywwQkFBaUMsU0FBYztJQUM3QyxNQUFNLFdBQVcsR0FBRyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUVuRCxjQUFjLElBQVMsRUFBRSxLQUFVO1FBQ2pDLElBQUksU0FBUyxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ25ELElBQUksVUFBVSxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRXJELEVBQUUsQ0FBQyxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQzNCLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDWCxDQUFDO1FBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQ2xDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNaLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDWCxDQUFDO0lBQ0gsQ0FBQztJQUVELGdHQUFnRztJQUNoRyxrQkFBa0I7SUFDakIsSUFBWSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7SUFDeEMsTUFBTSxDQUFDLElBQUksQ0FBQztBQUNkLENBQUM7QUFwQkQsNENBb0JDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG5pbXBvcnQgeyBFeHRyYUVudHJ5UG9pbnQgfSBmcm9tICcuLi8uLi9icm93c2VyJztcbmltcG9ydCB7IGNvbXB1dGVCdW5kbGVOYW1lIH0gZnJvbSAnLi4vbW9kZWxzL3dlYnBhY2stY29uZmlncy91dGlscyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUVudHJ5UG9pbnRzKGFwcENvbmZpZzogYW55KSB7XG4gIGxldCBlbnRyeVBvaW50cyA9IFsncG9seWZpbGxzJywgJ3N3LXJlZ2lzdGVyJ107XG5cbiAgLy8gQWRkIGFsbCBzdHlsZXMvc2NyaXB0cywgZXhjZXB0IGxhenktbG9hZGVkIG9uZXMuXG4gIFtcbiAgICAuLi4oYXBwQ29uZmlnLnN0eWxlcyBhcyBFeHRyYUVudHJ5UG9pbnRbXSlcbiAgICAgIC5maWx0ZXIoZW50cnkgPT4gIWVudHJ5LmxhenkpXG4gICAgICAubWFwKGVudHJ5ID0+IGNvbXB1dGVCdW5kbGVOYW1lKGVudHJ5LCAnc3R5bGVzJykpLFxuICAgIC4uLihhcHBDb25maWcuc2NyaXB0cyBhcyBFeHRyYUVudHJ5UG9pbnRbXSlcbiAgICAgIC5maWx0ZXIoZW50cnkgPT4gIWVudHJ5LmxhenkpXG4gICAgICAubWFwKGVudHJ5ID0+IGNvbXB1dGVCdW5kbGVOYW1lKGVudHJ5LCAnc2NyaXB0cycpKSxcbiAgXS5mb3JFYWNoKGJ1bmRsZU5hbWUgPT4ge1xuICAgIGlmIChlbnRyeVBvaW50cy5pbmRleE9mKGJ1bmRsZU5hbWUpID09PSAtMSkge1xuICAgICAgZW50cnlQb2ludHMucHVzaChidW5kbGVOYW1lKTtcbiAgICB9XG4gIH0pO1xuXG4gIGVudHJ5UG9pbnRzLnB1c2goJ21haW4nKTtcblxuICByZXR1cm4gZW50cnlQb2ludHM7XG59XG5cbi8vIFNvcnQgY2h1bmtzIGFjY29yZGluZyB0byBhIHByZWRlZmluZWQgb3JkZXI6XG4vLyBpbmxpbmUsIHBvbHlmaWxscywgYWxsIHN0eWxlcywgdmVuZG9yLCBtYWluXG5leHBvcnQgZnVuY3Rpb24gcGFja2FnZUNodW5rU29ydChhcHBDb25maWc6IGFueSkge1xuICBjb25zdCBlbnRyeVBvaW50cyA9IGdlbmVyYXRlRW50cnlQb2ludHMoYXBwQ29uZmlnKTtcblxuICBmdW5jdGlvbiBzb3J0KGxlZnQ6IGFueSwgcmlnaHQ6IGFueSkge1xuICAgIGxldCBsZWZ0SW5kZXggPSBlbnRyeVBvaW50cy5pbmRleE9mKGxlZnQubmFtZXNbMF0pO1xuICAgIGxldCByaWdodGluZGV4ID0gZW50cnlQb2ludHMuaW5kZXhPZihyaWdodC5uYW1lc1swXSk7XG5cbiAgICBpZiAobGVmdEluZGV4ID4gcmlnaHRpbmRleCkge1xuICAgICAgcmV0dXJuIDE7XG4gICAgfSBlbHNlIGlmIChsZWZ0SW5kZXggPCByaWdodGluZGV4KSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgfVxuXG4gIC8vIFdlIG5lZWQgdG8gbGlzdCBvZiBlbnRyeSBwb2ludHMgZm9yIHRoZSBFamVjdGVkIHdlYnBhY2sgY29uZmlnIHRvIHdvcmsgKHdlIHJldXNlIHRoZSBmdW5jdGlvblxuICAvLyBkZWZpbmVkIGFib3ZlKS5cbiAgKHNvcnQgYXMgYW55KS5lbnRyeVBvaW50cyA9IGVudHJ5UG9pbnRzO1xuICByZXR1cm4gc29ydDtcbn1cbiJdfQ==