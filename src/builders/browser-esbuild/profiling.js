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
        console.log(`DURATION[${name}]: ${duration.toFixed(9)} seconds`);
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
        console.log(`DURATION[${name}]: ${duration.toFixed(9)} seconds`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZmlsaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL3Byb2ZpbGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCx5RUFBbUU7QUFFbkUsSUFBSSxtQkFBb0QsQ0FBQztBQUV6RCxTQUFnQix3QkFBd0I7SUFDdEMsbUJBQW1CLGFBQW5CLG1CQUFtQix1QkFBbkIsbUJBQW1CLENBQUUsS0FBSyxFQUFFLENBQUM7QUFDL0IsQ0FBQztBQUZELDREQUVDO0FBRUQsU0FBZ0Isc0JBQXNCO0lBQ3BDLElBQUksQ0FBQyxzQ0FBZ0IsSUFBSSxDQUFDLG1CQUFtQixFQUFFO1FBQzdDLE9BQU87S0FDUjtJQUVELEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsSUFBSSxtQkFBbUIsRUFBRTtRQUNsRCxzQ0FBc0M7UUFDdEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLElBQUksTUFBTSxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQztLQUNsRTtBQUNILENBQUM7QUFURCx3REFTQztBQUVELFNBQVMsY0FBYyxDQUFDLElBQVksRUFBRSxTQUFpQixFQUFFLFVBQW9COztJQUMzRSxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsR0FBRyxTQUFTLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3ZFLElBQUksVUFBVSxFQUFFO1FBQ2QsbUJBQW1CLGFBQW5CLG1CQUFtQixjQUFuQixtQkFBbUIsSUFBbkIsbUJBQW1CLEdBQUssSUFBSSxHQUFHLEVBQWtCLEVBQUM7UUFDbEQsbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLE1BQUEsbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxtQ0FBSSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQztLQUNoRjtTQUFNO1FBQ0wsc0NBQXNDO1FBQ3RDLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxJQUFJLE1BQU0sUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDbEU7QUFDSCxDQUFDO0FBRU0sS0FBSyxVQUFVLFlBQVksQ0FDaEMsSUFBWSxFQUNaLE1BQXdCLEVBQ3hCLFVBQW9CO0lBRXBCLElBQUksQ0FBQyxzQ0FBZ0IsRUFBRTtRQUNyQixPQUFPLE1BQU0sRUFBRSxDQUFDO0tBQ2pCO0lBRUQsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUMxQyxJQUFJO1FBQ0YsT0FBTyxNQUFNLE1BQU0sRUFBRSxDQUFDO0tBQ3ZCO1lBQVM7UUFDUixjQUFjLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQztLQUM3QztBQUNILENBQUM7QUFmRCxvQ0FlQztBQUVELFNBQWdCLFdBQVcsQ0FBSSxJQUFZLEVBQUUsTUFBZSxFQUFFLFVBQW9CO0lBQ2hGLElBQUksQ0FBQyxzQ0FBZ0IsRUFBRTtRQUNyQixPQUFPLE1BQU0sRUFBRSxDQUFDO0tBQ2pCO0lBRUQsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUMxQyxJQUFJO1FBQ0YsT0FBTyxNQUFNLEVBQUUsQ0FBQztLQUNqQjtZQUFTO1FBQ1IsY0FBYyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7S0FDN0M7QUFDSCxDQUFDO0FBWEQsa0NBV0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgZGVidWdQZXJmb3JtYW5jZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuXG5sZXQgY3VtdWxhdGl2ZUR1cmF0aW9uczogTWFwPHN0cmluZywgbnVtYmVyPiB8IHVuZGVmaW5lZDtcblxuZXhwb3J0IGZ1bmN0aW9uIHJlc2V0Q3VtdWxhdGl2ZUR1cmF0aW9ucygpOiB2b2lkIHtcbiAgY3VtdWxhdGl2ZUR1cmF0aW9ucz8uY2xlYXIoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvZ0N1bXVsYXRpdmVEdXJhdGlvbnMoKTogdm9pZCB7XG4gIGlmICghZGVidWdQZXJmb3JtYW5jZSB8fCAhY3VtdWxhdGl2ZUR1cmF0aW9ucykge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGZvciAoY29uc3QgW25hbWUsIGR1cmF0aW9uXSBvZiBjdW11bGF0aXZlRHVyYXRpb25zKSB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICBjb25zb2xlLmxvZyhgRFVSQVRJT05bJHtuYW1lfV06ICR7ZHVyYXRpb24udG9GaXhlZCg5KX0gc2Vjb25kc2ApO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlY29yZER1cmF0aW9uKG5hbWU6IHN0cmluZywgc3RhcnRUaW1lOiBiaWdpbnQsIGN1bXVsYXRpdmU/OiBib29sZWFuKTogdm9pZCB7XG4gIGNvbnN0IGR1cmF0aW9uID0gTnVtYmVyKHByb2Nlc3MuaHJ0aW1lLmJpZ2ludCgpIC0gc3RhcnRUaW1lKSAvIDEwICoqIDk7XG4gIGlmIChjdW11bGF0aXZlKSB7XG4gICAgY3VtdWxhdGl2ZUR1cmF0aW9ucyA/Pz0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgICBjdW11bGF0aXZlRHVyYXRpb25zLnNldChuYW1lLCAoY3VtdWxhdGl2ZUR1cmF0aW9ucy5nZXQobmFtZSkgPz8gMCkgKyBkdXJhdGlvbik7XG4gIH0gZWxzZSB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICBjb25zb2xlLmxvZyhgRFVSQVRJT05bJHtuYW1lfV06ICR7ZHVyYXRpb24udG9GaXhlZCg5KX0gc2Vjb25kc2ApO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcm9maWxlQXN5bmM8VD4oXG4gIG5hbWU6IHN0cmluZyxcbiAgYWN0aW9uOiAoKSA9PiBQcm9taXNlPFQ+LFxuICBjdW11bGF0aXZlPzogYm9vbGVhbixcbik6IFByb21pc2U8VD4ge1xuICBpZiAoIWRlYnVnUGVyZm9ybWFuY2UpIHtcbiAgICByZXR1cm4gYWN0aW9uKCk7XG4gIH1cblxuICBjb25zdCBzdGFydFRpbWUgPSBwcm9jZXNzLmhydGltZS5iaWdpbnQoKTtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgYWN0aW9uKCk7XG4gIH0gZmluYWxseSB7XG4gICAgcmVjb3JkRHVyYXRpb24obmFtZSwgc3RhcnRUaW1lLCBjdW11bGF0aXZlKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJvZmlsZVN5bmM8VD4obmFtZTogc3RyaW5nLCBhY3Rpb246ICgpID0+IFQsIGN1bXVsYXRpdmU/OiBib29sZWFuKTogVCB7XG4gIGlmICghZGVidWdQZXJmb3JtYW5jZSkge1xuICAgIHJldHVybiBhY3Rpb24oKTtcbiAgfVxuXG4gIGNvbnN0IHN0YXJ0VGltZSA9IHByb2Nlc3MuaHJ0aW1lLmJpZ2ludCgpO1xuICB0cnkge1xuICAgIHJldHVybiBhY3Rpb24oKTtcbiAgfSBmaW5hbGx5IHtcbiAgICByZWNvcmREdXJhdGlvbihuYW1lLCBzdGFydFRpbWUsIGN1bXVsYXRpdmUpO1xuICB9XG59XG4iXX0=