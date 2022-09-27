"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.useLegacySass = exports.maxWorkers = exports.allowMinify = exports.shouldBeautify = exports.allowMangle = void 0;
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
const legacySassVariable = process.env['NG_BUILD_LEGACY_SASS'];
exports.useLegacySass = (() => {
    if (!isPresent(legacySassVariable)) {
        return false;
    }
    // eslint-disable-next-line no-console
    console.warn(color_1.colors.yellow(`Warning: 'NG_BUILD_LEGACY_SASS' environment variable support will be removed in version 16.`));
    return isEnabled(legacySassVariable);
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnQtb3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsbUNBQWlDO0FBRWpDLFNBQVMsVUFBVSxDQUFDLFFBQWdCO0lBQ2xDLE9BQU8sUUFBUSxLQUFLLEdBQUcsSUFBSSxRQUFRLENBQUMsV0FBVyxFQUFFLEtBQUssT0FBTyxDQUFDO0FBQ2hFLENBQUM7QUFFRCxTQUFTLFNBQVMsQ0FBQyxRQUFnQjtJQUNqQyxPQUFPLFFBQVEsS0FBSyxHQUFHLElBQUksUUFBUSxDQUFDLFdBQVcsRUFBRSxLQUFLLE1BQU0sQ0FBQztBQUMvRCxDQUFDO0FBRUQsU0FBUyxTQUFTLENBQUMsUUFBNEI7SUFDN0MsT0FBTyxPQUFPLFFBQVEsS0FBSyxRQUFRLElBQUksUUFBUSxLQUFLLEVBQUUsQ0FBQztBQUN6RCxDQUFDO0FBRUQsNEJBQTRCO0FBQzVCLE1BQU0scUJBQXFCLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQ3JFLE1BQU0sYUFBYSxHQUFHLENBQUMsR0FBRyxFQUFFO0lBQzFCLElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsSUFBSSxVQUFVLENBQUMscUJBQXFCLENBQUMsRUFBRTtRQUMxRSxPQUFPO1lBQ0wsTUFBTSxFQUFFLElBQUk7WUFDWixNQUFNLEVBQUUsSUFBSTtZQUNaLFFBQVEsRUFBRSxLQUFLO1NBQ2hCLENBQUM7S0FDSDtJQUVELE1BQU0sVUFBVSxHQUFHO1FBQ2pCLE1BQU0sRUFBRSxLQUFLO1FBQ2IsTUFBTSxFQUFFLEtBQUs7UUFDYixRQUFRLEVBQUUsSUFBSTtLQUNmLENBQUM7SUFFRixJQUFJLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFO1FBQ3BDLE9BQU8sVUFBVSxDQUFDO0tBQ25CO0lBRUQsS0FBSyxNQUFNLElBQUksSUFBSSxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDbkQsUUFBUSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDakMsS0FBSyxRQUFRO2dCQUNYLFVBQVUsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO2dCQUN6QixNQUFNO1lBQ1IsS0FBSyxRQUFRO2dCQUNYLFVBQVUsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO2dCQUN6QixNQUFNO1lBQ1IsS0FBSyxVQUFVO2dCQUNiLFVBQVUsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO2dCQUMzQixNQUFNO1NBQ1Q7S0FDRjtJQUVELE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFFTCxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFDekMsUUFBQSxXQUFXLEdBQUcsU0FBUyxDQUFDLGNBQWMsQ0FBQztJQUNsRCxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDO0lBQzdCLENBQUMsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDO0FBRVosUUFBQSxjQUFjLEdBQUcsYUFBYSxDQUFDLFFBQVEsQ0FBQztBQUN4QyxRQUFBLFdBQVcsR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDO0FBRWhEOzs7Ozs7OztHQVFHO0FBQ0gsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDLENBQUM7QUFDbEQsUUFBQSxVQUFVLEdBQUcsU0FBUyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUVsRixNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsQ0FBQztBQUNsRCxRQUFBLGFBQWEsR0FBWSxDQUFDLEdBQUcsRUFBRTtJQUMxQyxJQUFJLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLEVBQUU7UUFDbEMsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUVELHNDQUFzQztJQUN0QyxPQUFPLENBQUMsSUFBSSxDQUNWLGNBQU0sQ0FBQyxNQUFNLENBQ1gsNkZBQTZGLENBQzlGLENBQ0YsQ0FBQztJQUVGLE9BQU8sU0FBUyxDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFDdkMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBjb2xvcnMgfSBmcm9tICcuL2NvbG9yJztcblxuZnVuY3Rpb24gaXNEaXNhYmxlZCh2YXJpYWJsZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiB2YXJpYWJsZSA9PT0gJzAnIHx8IHZhcmlhYmxlLnRvTG93ZXJDYXNlKCkgPT09ICdmYWxzZSc7XG59XG5cbmZ1bmN0aW9uIGlzRW5hYmxlZCh2YXJpYWJsZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiB2YXJpYWJsZSA9PT0gJzEnIHx8IHZhcmlhYmxlLnRvTG93ZXJDYXNlKCkgPT09ICd0cnVlJztcbn1cblxuZnVuY3Rpb24gaXNQcmVzZW50KHZhcmlhYmxlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB2YXJpYWJsZSBpcyBzdHJpbmcge1xuICByZXR1cm4gdHlwZW9mIHZhcmlhYmxlID09PSAnc3RyaW5nJyAmJiB2YXJpYWJsZSAhPT0gJyc7XG59XG5cbi8vIE9wdGltaXphdGlvbiBhbmQgbWFuZ2xpbmdcbmNvbnN0IGRlYnVnT3B0aW1pemVWYXJpYWJsZSA9IHByb2Nlc3MuZW52WydOR19CVUlMRF9ERUJVR19PUFRJTUlaRSddO1xuY29uc3QgZGVidWdPcHRpbWl6ZSA9ICgoKSA9PiB7XG4gIGlmICghaXNQcmVzZW50KGRlYnVnT3B0aW1pemVWYXJpYWJsZSkgfHwgaXNEaXNhYmxlZChkZWJ1Z09wdGltaXplVmFyaWFibGUpKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1hbmdsZTogdHJ1ZSxcbiAgICAgIG1pbmlmeTogdHJ1ZSxcbiAgICAgIGJlYXV0aWZ5OiBmYWxzZSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgZGVidWdWYWx1ZSA9IHtcbiAgICBtYW5nbGU6IGZhbHNlLFxuICAgIG1pbmlmeTogZmFsc2UsXG4gICAgYmVhdXRpZnk6IHRydWUsXG4gIH07XG5cbiAgaWYgKGlzRW5hYmxlZChkZWJ1Z09wdGltaXplVmFyaWFibGUpKSB7XG4gICAgcmV0dXJuIGRlYnVnVmFsdWU7XG4gIH1cblxuICBmb3IgKGNvbnN0IHBhcnQgb2YgZGVidWdPcHRpbWl6ZVZhcmlhYmxlLnNwbGl0KCcsJykpIHtcbiAgICBzd2l0Y2ggKHBhcnQudHJpbSgpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgIGNhc2UgJ21hbmdsZSc6XG4gICAgICAgIGRlYnVnVmFsdWUubWFuZ2xlID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdtaW5pZnknOlxuICAgICAgICBkZWJ1Z1ZhbHVlLm1pbmlmeSA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnYmVhdXRpZnknOlxuICAgICAgICBkZWJ1Z1ZhbHVlLmJlYXV0aWZ5ID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGRlYnVnVmFsdWU7XG59KSgpO1xuXG5jb25zdCBtYW5nbGVWYXJpYWJsZSA9IHByb2Nlc3MuZW52WydOR19CVUlMRF9NQU5HTEUnXTtcbmV4cG9ydCBjb25zdCBhbGxvd01hbmdsZSA9IGlzUHJlc2VudChtYW5nbGVWYXJpYWJsZSlcbiAgPyAhaXNEaXNhYmxlZChtYW5nbGVWYXJpYWJsZSlcbiAgOiBkZWJ1Z09wdGltaXplLm1hbmdsZTtcblxuZXhwb3J0IGNvbnN0IHNob3VsZEJlYXV0aWZ5ID0gZGVidWdPcHRpbWl6ZS5iZWF1dGlmeTtcbmV4cG9ydCBjb25zdCBhbGxvd01pbmlmeSA9IGRlYnVnT3B0aW1pemUubWluaWZ5O1xuXG4vKipcbiAqIFNvbWUgZW52aXJvbm1lbnRzLCBsaWtlIENpcmNsZUNJIHdoaWNoIHVzZSBEb2NrZXIgcmVwb3J0IGEgbnVtYmVyIG9mIENQVXMgYnkgdGhlIGhvc3QgYW5kIG5vdCB0aGUgY291bnQgb2YgYXZhaWxhYmxlLlxuICogVGhpcyBjYXVzZSBgRXJyb3I6IENhbGwgcmV0cmllcyB3ZXJlIGV4Y2VlZGVkYCBlcnJvcnMgd2hlbiB0cnlpbmcgdG8gdXNlIHRoZW0uXG4gKlxuICogQHNlZSBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvaXNzdWVzLzI4NzYyXG4gKiBAc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvdGVyc2VyLXdlYnBhY2stcGx1Z2luL2lzc3Vlcy8xNDNcbiAqIEBzZWUgaHR0cHM6Ly9pdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMTY4NjAjaXNzdWVjb21tZW50LTU4ODgyODA3OVxuICpcbiAqL1xuY29uc3QgbWF4V29ya2Vyc1ZhcmlhYmxlID0gcHJvY2Vzcy5lbnZbJ05HX0JVSUxEX01BWF9XT1JLRVJTJ107XG5leHBvcnQgY29uc3QgbWF4V29ya2VycyA9IGlzUHJlc2VudChtYXhXb3JrZXJzVmFyaWFibGUpID8gK21heFdvcmtlcnNWYXJpYWJsZSA6IDQ7XG5cbmNvbnN0IGxlZ2FjeVNhc3NWYXJpYWJsZSA9IHByb2Nlc3MuZW52WydOR19CVUlMRF9MRUdBQ1lfU0FTUyddO1xuZXhwb3J0IGNvbnN0IHVzZUxlZ2FjeVNhc3M6IGJvb2xlYW4gPSAoKCkgPT4ge1xuICBpZiAoIWlzUHJlc2VudChsZWdhY3lTYXNzVmFyaWFibGUpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgY29uc29sZS53YXJuKFxuICAgIGNvbG9ycy55ZWxsb3coXG4gICAgICBgV2FybmluZzogJ05HX0JVSUxEX0xFR0FDWV9TQVNTJyBlbnZpcm9ubWVudCB2YXJpYWJsZSBzdXBwb3J0IHdpbGwgYmUgcmVtb3ZlZCBpbiB2ZXJzaW9uIDE2LmAsXG4gICAgKSxcbiAgKTtcblxuICByZXR1cm4gaXNFbmFibGVkKGxlZ2FjeVNhc3NWYXJpYWJsZSk7XG59KSgpO1xuIl19