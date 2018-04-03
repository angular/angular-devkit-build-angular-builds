"use strict";
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
function generateEntryPoints(appConfig) {
    let entryPoints = ['polyfills', 'sw-register'];
    // Add all styles/scripts, except lazy-loaded ones.
    [
        ...appConfig.styles
            .filter(entry => !entry.lazy)
            .map(entry => entry.bundleName || 'styles'),
        ...appConfig.scripts
            .filter(entry => !entry.lazy)
            .map(entry => entry.bundleName || 'scripts'),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFja2FnZS1jaHVuay1zb3J0LmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvcGFja2FnZS1jaHVuay1zb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBaUI7QUFDakIsK0RBQStEOztBQUkvRCw2QkFBb0MsU0FBYztJQUNoRCxJQUFJLFdBQVcsR0FBRyxDQUFDLFdBQVcsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUUvQyxtREFBbUQ7SUFDbkQ7UUFDRSxHQUFJLFNBQVMsQ0FBQyxNQUE0QjthQUN2QyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7YUFDNUIsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFVBQVUsSUFBSSxRQUFRLENBQUM7UUFDN0MsR0FBSSxTQUFTLENBQUMsT0FBNkI7YUFDeEMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO2FBQzVCLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxVQUFVLElBQUksU0FBUyxDQUFDO0tBQy9DLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1FBQ3JCLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNDLFdBQVcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDL0IsQ0FBQztJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUV6QixNQUFNLENBQUMsV0FBVyxDQUFDO0FBQ3JCLENBQUM7QUFwQkQsa0RBb0JDO0FBRUQsK0NBQStDO0FBQy9DLDhDQUE4QztBQUM5QywwQkFBaUMsU0FBYztJQUM3QyxNQUFNLFdBQVcsR0FBRyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUVuRCxjQUFjLElBQVMsRUFBRSxLQUFVO1FBQ2pDLElBQUksU0FBUyxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ25ELElBQUksVUFBVSxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRXJELEVBQUUsQ0FBQyxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQzNCLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDWCxDQUFDO1FBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQ2xDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNaLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDWCxDQUFDO0lBQ0gsQ0FBQztJQUVELGdHQUFnRztJQUNoRyxrQkFBa0I7SUFDakIsSUFBWSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7SUFDeEMsTUFBTSxDQUFDLElBQUksQ0FBQztBQUNkLENBQUM7QUFwQkQsNENBb0JDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG5pbXBvcnQgeyBFeHRyYUVudHJ5UG9pbnQgfSBmcm9tICcuLi8uLi9icm93c2VyJztcblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlRW50cnlQb2ludHMoYXBwQ29uZmlnOiBhbnkpIHtcbiAgbGV0IGVudHJ5UG9pbnRzID0gWydwb2x5ZmlsbHMnLCAnc3ctcmVnaXN0ZXInXTtcblxuICAvLyBBZGQgYWxsIHN0eWxlcy9zY3JpcHRzLCBleGNlcHQgbGF6eS1sb2FkZWQgb25lcy5cbiAgW1xuICAgIC4uLihhcHBDb25maWcuc3R5bGVzIGFzIEV4dHJhRW50cnlQb2ludFtdKVxuICAgICAgLmZpbHRlcihlbnRyeSA9PiAhZW50cnkubGF6eSlcbiAgICAgIC5tYXAoZW50cnkgPT4gZW50cnkuYnVuZGxlTmFtZSB8fCAnc3R5bGVzJyksXG4gICAgLi4uKGFwcENvbmZpZy5zY3JpcHRzIGFzIEV4dHJhRW50cnlQb2ludFtdKVxuICAgICAgLmZpbHRlcihlbnRyeSA9PiAhZW50cnkubGF6eSlcbiAgICAgIC5tYXAoZW50cnkgPT4gZW50cnkuYnVuZGxlTmFtZSB8fCAnc2NyaXB0cycpLFxuICBdLmZvckVhY2goYnVuZGxlTmFtZSA9PiB7XG4gICAgaWYgKGVudHJ5UG9pbnRzLmluZGV4T2YoYnVuZGxlTmFtZSkgPT09IC0xKSB7XG4gICAgICBlbnRyeVBvaW50cy5wdXNoKGJ1bmRsZU5hbWUpO1xuICAgIH1cbiAgfSk7XG5cbiAgZW50cnlQb2ludHMucHVzaCgnbWFpbicpO1xuXG4gIHJldHVybiBlbnRyeVBvaW50cztcbn1cblxuLy8gU29ydCBjaHVua3MgYWNjb3JkaW5nIHRvIGEgcHJlZGVmaW5lZCBvcmRlcjpcbi8vIGlubGluZSwgcG9seWZpbGxzLCBhbGwgc3R5bGVzLCB2ZW5kb3IsIG1haW5cbmV4cG9ydCBmdW5jdGlvbiBwYWNrYWdlQ2h1bmtTb3J0KGFwcENvbmZpZzogYW55KSB7XG4gIGNvbnN0IGVudHJ5UG9pbnRzID0gZ2VuZXJhdGVFbnRyeVBvaW50cyhhcHBDb25maWcpO1xuXG4gIGZ1bmN0aW9uIHNvcnQobGVmdDogYW55LCByaWdodDogYW55KSB7XG4gICAgbGV0IGxlZnRJbmRleCA9IGVudHJ5UG9pbnRzLmluZGV4T2YobGVmdC5uYW1lc1swXSk7XG4gICAgbGV0IHJpZ2h0aW5kZXggPSBlbnRyeVBvaW50cy5pbmRleE9mKHJpZ2h0Lm5hbWVzWzBdKTtcblxuICAgIGlmIChsZWZ0SW5kZXggPiByaWdodGluZGV4KSB7XG4gICAgICByZXR1cm4gMTtcbiAgICB9IGVsc2UgaWYgKGxlZnRJbmRleCA8IHJpZ2h0aW5kZXgpIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICB9XG5cbiAgLy8gV2UgbmVlZCB0byBsaXN0IG9mIGVudHJ5IHBvaW50cyBmb3IgdGhlIEVqZWN0ZWQgd2VicGFjayBjb25maWcgdG8gd29yayAod2UgcmV1c2UgdGhlIGZ1bmN0aW9uXG4gIC8vIGRlZmluZWQgYWJvdmUpLlxuICAoc29ydCBhcyBhbnkpLmVudHJ5UG9pbnRzID0gZW50cnlQb2ludHM7XG4gIHJldHVybiBzb3J0O1xufVxuIl19