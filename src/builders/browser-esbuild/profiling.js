"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileSync = exports.profileAsync = exports.logCumulativeDurations = exports.resetCumulativeDurations = void 0;
const environment_options_1 = require("../../utils/environment-options");
let cumulativeDurations;
function resetCumulativeDurations() {
    cumulativeDurations === null || cumulativeDurations === void 0 ? void 0 : cumulativeDurations.clear();
}
exports.resetCumulativeDurations = resetCumulativeDurations;
function logCumulativeDurations() {
    if (!environment_options_1.debugPerformance || !cumulativeDurations) {
        return;
    }
    for (const [name, duration] of cumulativeDurations) {
        // eslint-disable-next-line no-console
        console.log(`DURATION[${name}]: ${duration} seconds`);
    }
}
exports.logCumulativeDurations = logCumulativeDurations;
function recordDuration(name, startTime, cumulative) {
    var _a;
    const duration = Number(process.hrtime.bigint() - startTime) / 10 ** 9;
    if (cumulative) {
        cumulativeDurations !== null && cumulativeDurations !== void 0 ? cumulativeDurations : (cumulativeDurations = new Map());
        cumulativeDurations.set(name, ((_a = cumulativeDurations.get(name)) !== null && _a !== void 0 ? _a : 0) + duration);
    }
    else {
        // eslint-disable-next-line no-console
        console.log(`DURATION[${name}]: ${duration} seconds`);
    }
}
async function profileAsync(name, action, cumulative) {
    if (!environment_options_1.debugPerformance) {
        return action();
    }
    const startTime = process.hrtime.bigint();
    try {
        return await action();
    }
    finally {
        recordDuration(name, startTime, cumulative);
    }
}
exports.profileAsync = profileAsync;
function profileSync(name, action, cumulative) {
    if (!environment_options_1.debugPerformance) {
        return action();
    }
    const startTime = process.hrtime.bigint();
    try {
        return action();
    }
    finally {
        recordDuration(name, startTime, cumulative);
    }
}
exports.profileSync = profileSync;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZmlsaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL3Byb2ZpbGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCx5RUFBbUU7QUFFbkUsSUFBSSxtQkFBb0QsQ0FBQztBQUV6RCxTQUFnQix3QkFBd0I7SUFDdEMsbUJBQW1CLGFBQW5CLG1CQUFtQix1QkFBbkIsbUJBQW1CLENBQUUsS0FBSyxFQUFFLENBQUM7QUFDL0IsQ0FBQztBQUZELDREQUVDO0FBRUQsU0FBZ0Isc0JBQXNCO0lBQ3BDLElBQUksQ0FBQyxzQ0FBZ0IsSUFBSSxDQUFDLG1CQUFtQixFQUFFO1FBQzdDLE9BQU87S0FDUjtJQUVELEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsSUFBSSxtQkFBbUIsRUFBRTtRQUNsRCxzQ0FBc0M7UUFDdEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLElBQUksTUFBTSxRQUFRLFVBQVUsQ0FBQyxDQUFDO0tBQ3ZEO0FBQ0gsQ0FBQztBQVRELHdEQVNDO0FBRUQsU0FBUyxjQUFjLENBQUMsSUFBWSxFQUFFLFNBQWlCLEVBQUUsVUFBb0I7O0lBQzNFLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxHQUFHLFNBQVMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDdkUsSUFBSSxVQUFVLEVBQUU7UUFDZCxtQkFBbUIsYUFBbkIsbUJBQW1CLGNBQW5CLG1CQUFtQixJQUFuQixtQkFBbUIsR0FBSyxJQUFJLEdBQUcsRUFBa0IsRUFBQztRQUNsRCxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBQSxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLG1DQUFJLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDO0tBQ2hGO1NBQU07UUFDTCxzQ0FBc0M7UUFDdEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLElBQUksTUFBTSxRQUFRLFVBQVUsQ0FBQyxDQUFDO0tBQ3ZEO0FBQ0gsQ0FBQztBQUVNLEtBQUssVUFBVSxZQUFZLENBQ2hDLElBQVksRUFDWixNQUF3QixFQUN4QixVQUFvQjtJQUVwQixJQUFJLENBQUMsc0NBQWdCLEVBQUU7UUFDckIsT0FBTyxNQUFNLEVBQUUsQ0FBQztLQUNqQjtJQUVELE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDMUMsSUFBSTtRQUNGLE9BQU8sTUFBTSxNQUFNLEVBQUUsQ0FBQztLQUN2QjtZQUFTO1FBQ1IsY0FBYyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7S0FDN0M7QUFDSCxDQUFDO0FBZkQsb0NBZUM7QUFFRCxTQUFnQixXQUFXLENBQUksSUFBWSxFQUFFLE1BQWUsRUFBRSxVQUFvQjtJQUNoRixJQUFJLENBQUMsc0NBQWdCLEVBQUU7UUFDckIsT0FBTyxNQUFNLEVBQUUsQ0FBQztLQUNqQjtJQUVELE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDMUMsSUFBSTtRQUNGLE9BQU8sTUFBTSxFQUFFLENBQUM7S0FDakI7WUFBUztRQUNSLGNBQWMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0tBQzdDO0FBQ0gsQ0FBQztBQVhELGtDQVdDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IGRlYnVnUGVyZm9ybWFuY2UgfSBmcm9tICcuLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcblxubGV0IGN1bXVsYXRpdmVEdXJhdGlvbnM6IE1hcDxzdHJpbmcsIG51bWJlcj4gfCB1bmRlZmluZWQ7XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNldEN1bXVsYXRpdmVEdXJhdGlvbnMoKTogdm9pZCB7XG4gIGN1bXVsYXRpdmVEdXJhdGlvbnM/LmNsZWFyKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dDdW11bGF0aXZlRHVyYXRpb25zKCk6IHZvaWQge1xuICBpZiAoIWRlYnVnUGVyZm9ybWFuY2UgfHwgIWN1bXVsYXRpdmVEdXJhdGlvbnMpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBmb3IgKGNvbnN0IFtuYW1lLCBkdXJhdGlvbl0gb2YgY3VtdWxhdGl2ZUR1cmF0aW9ucykge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgY29uc29sZS5sb2coYERVUkFUSU9OWyR7bmFtZX1dOiAke2R1cmF0aW9ufSBzZWNvbmRzYCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVjb3JkRHVyYXRpb24obmFtZTogc3RyaW5nLCBzdGFydFRpbWU6IGJpZ2ludCwgY3VtdWxhdGl2ZT86IGJvb2xlYW4pOiB2b2lkIHtcbiAgY29uc3QgZHVyYXRpb24gPSBOdW1iZXIocHJvY2Vzcy5ocnRpbWUuYmlnaW50KCkgLSBzdGFydFRpbWUpIC8gMTAgKiogOTtcbiAgaWYgKGN1bXVsYXRpdmUpIHtcbiAgICBjdW11bGF0aXZlRHVyYXRpb25zID8/PSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICAgIGN1bXVsYXRpdmVEdXJhdGlvbnMuc2V0KG5hbWUsIChjdW11bGF0aXZlRHVyYXRpb25zLmdldChuYW1lKSA/PyAwKSArIGR1cmF0aW9uKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxuICAgIGNvbnNvbGUubG9nKGBEVVJBVElPTlske25hbWV9XTogJHtkdXJhdGlvbn0gc2Vjb25kc2ApO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcm9maWxlQXN5bmM8VD4oXG4gIG5hbWU6IHN0cmluZyxcbiAgYWN0aW9uOiAoKSA9PiBQcm9taXNlPFQ+LFxuICBjdW11bGF0aXZlPzogYm9vbGVhbixcbik6IFByb21pc2U8VD4ge1xuICBpZiAoIWRlYnVnUGVyZm9ybWFuY2UpIHtcbiAgICByZXR1cm4gYWN0aW9uKCk7XG4gIH1cblxuICBjb25zdCBzdGFydFRpbWUgPSBwcm9jZXNzLmhydGltZS5iaWdpbnQoKTtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgYWN0aW9uKCk7XG4gIH0gZmluYWxseSB7XG4gICAgcmVjb3JkRHVyYXRpb24obmFtZSwgc3RhcnRUaW1lLCBjdW11bGF0aXZlKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJvZmlsZVN5bmM8VD4obmFtZTogc3RyaW5nLCBhY3Rpb246ICgpID0+IFQsIGN1bXVsYXRpdmU/OiBib29sZWFuKTogVCB7XG4gIGlmICghZGVidWdQZXJmb3JtYW5jZSkge1xuICAgIHJldHVybiBhY3Rpb24oKTtcbiAgfVxuXG4gIGNvbnN0IHN0YXJ0VGltZSA9IHByb2Nlc3MuaHJ0aW1lLmJpZ2ludCgpO1xuICB0cnkge1xuICAgIHJldHVybiBhY3Rpb24oKTtcbiAgfSBmaW5hbGx5IHtcbiAgICByZWNvcmREdXJhdGlvbihuYW1lLCBzdGFydFRpbWUsIGN1bXVsYXRpdmUpO1xuICB9XG59XG4iXX0=