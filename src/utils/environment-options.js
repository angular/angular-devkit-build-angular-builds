"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cachingDisabled = exports.maxWorkers = exports.allowMinify = exports.shouldBeautify = exports.allowMangle = void 0;
const color_1 = require("./color");
function isDisabled(variable) {
    return variable === '0' || variable.toLowerCase() === 'false';
}
function isEnabled(variable) {
    return variable === '1' || variable.toLowerCase() === 'true';
}
function isPresent(variable) {
    return typeof variable === 'string' && variable !== '';
}
// Optimization and mangling
const debugOptimizeVariable = process.env['NG_BUILD_DEBUG_OPTIMIZE'];
const debugOptimize = (() => {
    if (!isPresent(debugOptimizeVariable) || isDisabled(debugOptimizeVariable)) {
        return {
            mangle: true,
            minify: true,
            beautify: false,
        };
    }
    const debugValue = {
        mangle: false,
        minify: false,
        beautify: true,
    };
    if (isEnabled(debugOptimizeVariable)) {
        return debugValue;
    }
    for (const part of debugOptimizeVariable.split(',')) {
        switch (part.trim().toLowerCase()) {
            case 'mangle':
                debugValue.mangle = true;
                break;
            case 'minify':
                debugValue.minify = true;
                break;
            case 'beautify':
                debugValue.beautify = true;
                break;
        }
    }
    return debugValue;
})();
const mangleVariable = process.env['NG_BUILD_MANGLE'];
exports.allowMangle = isPresent(mangleVariable)
    ? !isDisabled(mangleVariable)
    : debugOptimize.mangle;
exports.shouldBeautify = debugOptimize.beautify;
exports.allowMinify = debugOptimize.minify;
/**
 * Some environments, like CircleCI which use Docker report a number of CPUs by the host and not the count of available.
 * This cause `Error: Call retries were exceeded` errors when trying to use them.
 *
 * @see https://github.com/nodejs/node/issues/28762
 * @see https://github.com/webpack-contrib/terser-webpack-plugin/issues/143
 * @see https://ithub.com/angular/angular-cli/issues/16860#issuecomment-588828079
 *
 */
const maxWorkersVariable = process.env['NG_BUILD_MAX_WORKERS'];
exports.maxWorkers = isPresent(maxWorkersVariable) ? +maxWorkersVariable : 4;
// Build cache
const cacheVariable = process.env['NG_BUILD_CACHE'];
exports.cachingDisabled = (() => {
    if (!isPresent(cacheVariable)) {
        return null;
    }
    // eslint-disable-next-line no-console
    console.warn(color_1.colors.yellow(`Warning: 'NG_BUILD_CACHE' environment variable support will be removed in version 14.\n` +
        `Configure 'cli.cache' in the workspace configuration instead.`));
    return isDisabled(cacheVariable);
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnQtb3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsbUNBQWlDO0FBRWpDLFNBQVMsVUFBVSxDQUFDLFFBQWdCO0lBQ2xDLE9BQU8sUUFBUSxLQUFLLEdBQUcsSUFBSSxRQUFRLENBQUMsV0FBVyxFQUFFLEtBQUssT0FBTyxDQUFDO0FBQ2hFLENBQUM7QUFFRCxTQUFTLFNBQVMsQ0FBQyxRQUFnQjtJQUNqQyxPQUFPLFFBQVEsS0FBSyxHQUFHLElBQUksUUFBUSxDQUFDLFdBQVcsRUFBRSxLQUFLLE1BQU0sQ0FBQztBQUMvRCxDQUFDO0FBRUQsU0FBUyxTQUFTLENBQUMsUUFBNEI7SUFDN0MsT0FBTyxPQUFPLFFBQVEsS0FBSyxRQUFRLElBQUksUUFBUSxLQUFLLEVBQUUsQ0FBQztBQUN6RCxDQUFDO0FBRUQsNEJBQTRCO0FBQzVCLE1BQU0scUJBQXFCLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQ3JFLE1BQU0sYUFBYSxHQUFHLENBQUMsR0FBRyxFQUFFO0lBQzFCLElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsSUFBSSxVQUFVLENBQUMscUJBQXFCLENBQUMsRUFBRTtRQUMxRSxPQUFPO1lBQ0wsTUFBTSxFQUFFLElBQUk7WUFDWixNQUFNLEVBQUUsSUFBSTtZQUNaLFFBQVEsRUFBRSxLQUFLO1NBQ2hCLENBQUM7S0FDSDtJQUVELE1BQU0sVUFBVSxHQUFHO1FBQ2pCLE1BQU0sRUFBRSxLQUFLO1FBQ2IsTUFBTSxFQUFFLEtBQUs7UUFDYixRQUFRLEVBQUUsSUFBSTtLQUNmLENBQUM7SUFFRixJQUFJLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFO1FBQ3BDLE9BQU8sVUFBVSxDQUFDO0tBQ25CO0lBRUQsS0FBSyxNQUFNLElBQUksSUFBSSxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDbkQsUUFBUSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDakMsS0FBSyxRQUFRO2dCQUNYLFVBQVUsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO2dCQUN6QixNQUFNO1lBQ1IsS0FBSyxRQUFRO2dCQUNYLFVBQVUsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO2dCQUN6QixNQUFNO1lBQ1IsS0FBSyxVQUFVO2dCQUNiLFVBQVUsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO2dCQUMzQixNQUFNO1NBQ1Q7S0FDRjtJQUVELE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFFTCxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFDekMsUUFBQSxXQUFXLEdBQUcsU0FBUyxDQUFDLGNBQWMsQ0FBQztJQUNsRCxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDO0lBQzdCLENBQUMsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDO0FBRVosUUFBQSxjQUFjLEdBQUcsYUFBYSxDQUFDLFFBQVEsQ0FBQztBQUN4QyxRQUFBLFdBQVcsR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDO0FBRWhEOzs7Ozs7OztHQVFHO0FBQ0gsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDLENBQUM7QUFDbEQsUUFBQSxVQUFVLEdBQUcsU0FBUyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUVsRixjQUFjO0FBQ2QsTUFBTSxhQUFhLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0FBQ3ZDLFFBQUEsZUFBZSxHQUFHLENBQUMsR0FBRyxFQUFFO0lBQ25DLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLEVBQUU7UUFDN0IsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUVELHNDQUFzQztJQUN0QyxPQUFPLENBQUMsSUFBSSxDQUNWLGNBQU0sQ0FBQyxNQUFNLENBQ1gseUZBQXlGO1FBQ3ZGLCtEQUErRCxDQUNsRSxDQUNGLENBQUM7SUFFRixPQUFPLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNuQyxDQUFDLENBQUMsRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IGNvbG9ycyB9IGZyb20gJy4vY29sb3InO1xuXG5mdW5jdGlvbiBpc0Rpc2FibGVkKHZhcmlhYmxlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHZhcmlhYmxlID09PSAnMCcgfHwgdmFyaWFibGUudG9Mb3dlckNhc2UoKSA9PT0gJ2ZhbHNlJztcbn1cblxuZnVuY3Rpb24gaXNFbmFibGVkKHZhcmlhYmxlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHZhcmlhYmxlID09PSAnMScgfHwgdmFyaWFibGUudG9Mb3dlckNhc2UoKSA9PT0gJ3RydWUnO1xufVxuXG5mdW5jdGlvbiBpc1ByZXNlbnQodmFyaWFibGU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHZhcmlhYmxlIGlzIHN0cmluZyB7XG4gIHJldHVybiB0eXBlb2YgdmFyaWFibGUgPT09ICdzdHJpbmcnICYmIHZhcmlhYmxlICE9PSAnJztcbn1cblxuLy8gT3B0aW1pemF0aW9uIGFuZCBtYW5nbGluZ1xuY29uc3QgZGVidWdPcHRpbWl6ZVZhcmlhYmxlID0gcHJvY2Vzcy5lbnZbJ05HX0JVSUxEX0RFQlVHX09QVElNSVpFJ107XG5jb25zdCBkZWJ1Z09wdGltaXplID0gKCgpID0+IHtcbiAgaWYgKCFpc1ByZXNlbnQoZGVidWdPcHRpbWl6ZVZhcmlhYmxlKSB8fCBpc0Rpc2FibGVkKGRlYnVnT3B0aW1pemVWYXJpYWJsZSkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbWFuZ2xlOiB0cnVlLFxuICAgICAgbWluaWZ5OiB0cnVlLFxuICAgICAgYmVhdXRpZnk6IGZhbHNlLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBkZWJ1Z1ZhbHVlID0ge1xuICAgIG1hbmdsZTogZmFsc2UsXG4gICAgbWluaWZ5OiBmYWxzZSxcbiAgICBiZWF1dGlmeTogdHJ1ZSxcbiAgfTtcblxuICBpZiAoaXNFbmFibGVkKGRlYnVnT3B0aW1pemVWYXJpYWJsZSkpIHtcbiAgICByZXR1cm4gZGVidWdWYWx1ZTtcbiAgfVxuXG4gIGZvciAoY29uc3QgcGFydCBvZiBkZWJ1Z09wdGltaXplVmFyaWFibGUuc3BsaXQoJywnKSkge1xuICAgIHN3aXRjaCAocGFydC50cmltKCkudG9Mb3dlckNhc2UoKSkge1xuICAgICAgY2FzZSAnbWFuZ2xlJzpcbiAgICAgICAgZGVidWdWYWx1ZS5tYW5nbGUgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ21pbmlmeSc6XG4gICAgICAgIGRlYnVnVmFsdWUubWluaWZ5ID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdiZWF1dGlmeSc6XG4gICAgICAgIGRlYnVnVmFsdWUuYmVhdXRpZnkgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZGVidWdWYWx1ZTtcbn0pKCk7XG5cbmNvbnN0IG1hbmdsZVZhcmlhYmxlID0gcHJvY2Vzcy5lbnZbJ05HX0JVSUxEX01BTkdMRSddO1xuZXhwb3J0IGNvbnN0IGFsbG93TWFuZ2xlID0gaXNQcmVzZW50KG1hbmdsZVZhcmlhYmxlKVxuICA/ICFpc0Rpc2FibGVkKG1hbmdsZVZhcmlhYmxlKVxuICA6IGRlYnVnT3B0aW1pemUubWFuZ2xlO1xuXG5leHBvcnQgY29uc3Qgc2hvdWxkQmVhdXRpZnkgPSBkZWJ1Z09wdGltaXplLmJlYXV0aWZ5O1xuZXhwb3J0IGNvbnN0IGFsbG93TWluaWZ5ID0gZGVidWdPcHRpbWl6ZS5taW5pZnk7XG5cbi8qKlxuICogU29tZSBlbnZpcm9ubWVudHMsIGxpa2UgQ2lyY2xlQ0kgd2hpY2ggdXNlIERvY2tlciByZXBvcnQgYSBudW1iZXIgb2YgQ1BVcyBieSB0aGUgaG9zdCBhbmQgbm90IHRoZSBjb3VudCBvZiBhdmFpbGFibGUuXG4gKiBUaGlzIGNhdXNlIGBFcnJvcjogQ2FsbCByZXRyaWVzIHdlcmUgZXhjZWVkZWRgIGVycm9ycyB3aGVuIHRyeWluZyB0byB1c2UgdGhlbS5cbiAqXG4gKiBAc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9pc3N1ZXMvMjg3NjJcbiAqIEBzZWUgaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi90ZXJzZXItd2VicGFjay1wbHVnaW4vaXNzdWVzLzE0M1xuICogQHNlZSBodHRwczovL2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8xNjg2MCNpc3N1ZWNvbW1lbnQtNTg4ODI4MDc5XG4gKlxuICovXG5jb25zdCBtYXhXb3JrZXJzVmFyaWFibGUgPSBwcm9jZXNzLmVudlsnTkdfQlVJTERfTUFYX1dPUktFUlMnXTtcbmV4cG9ydCBjb25zdCBtYXhXb3JrZXJzID0gaXNQcmVzZW50KG1heFdvcmtlcnNWYXJpYWJsZSkgPyArbWF4V29ya2Vyc1ZhcmlhYmxlIDogNDtcblxuLy8gQnVpbGQgY2FjaGVcbmNvbnN0IGNhY2hlVmFyaWFibGUgPSBwcm9jZXNzLmVudlsnTkdfQlVJTERfQ0FDSEUnXTtcbmV4cG9ydCBjb25zdCBjYWNoaW5nRGlzYWJsZWQgPSAoKCkgPT4ge1xuICBpZiAoIWlzUHJlc2VudChjYWNoZVZhcmlhYmxlKSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgY29uc29sZS53YXJuKFxuICAgIGNvbG9ycy55ZWxsb3coXG4gICAgICBgV2FybmluZzogJ05HX0JVSUxEX0NBQ0hFJyBlbnZpcm9ubWVudCB2YXJpYWJsZSBzdXBwb3J0IHdpbGwgYmUgcmVtb3ZlZCBpbiB2ZXJzaW9uIDE0LlxcbmAgK1xuICAgICAgICBgQ29uZmlndXJlICdjbGkuY2FjaGUnIGluIHRoZSB3b3Jrc3BhY2UgY29uZmlndXJhdGlvbiBpbnN0ZWFkLmAsXG4gICAgKSxcbiAgKTtcblxuICByZXR1cm4gaXNEaXNhYmxlZChjYWNoZVZhcmlhYmxlKTtcbn0pKCk7XG4iXX0=