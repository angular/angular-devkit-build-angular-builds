"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.maxWorkers = exports.allowMinify = exports.shouldBeautify = exports.allowMangle = void 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnQtb3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsU0FBUyxVQUFVLENBQUMsUUFBZ0I7SUFDbEMsT0FBTyxRQUFRLEtBQUssR0FBRyxJQUFJLFFBQVEsQ0FBQyxXQUFXLEVBQUUsS0FBSyxPQUFPLENBQUM7QUFDaEUsQ0FBQztBQUVELFNBQVMsU0FBUyxDQUFDLFFBQWdCO0lBQ2pDLE9BQU8sUUFBUSxLQUFLLEdBQUcsSUFBSSxRQUFRLENBQUMsV0FBVyxFQUFFLEtBQUssTUFBTSxDQUFDO0FBQy9ELENBQUM7QUFFRCxTQUFTLFNBQVMsQ0FBQyxRQUE0QjtJQUM3QyxPQUFPLE9BQU8sUUFBUSxLQUFLLFFBQVEsSUFBSSxRQUFRLEtBQUssRUFBRSxDQUFDO0FBQ3pELENBQUM7QUFFRCw0QkFBNEI7QUFDNUIsTUFBTSxxQkFBcUIsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUM7QUFDckUsTUFBTSxhQUFhLEdBQUcsQ0FBQyxHQUFHLEVBQUU7SUFDMUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFO1FBQzFFLE9BQU87WUFDTCxNQUFNLEVBQUUsSUFBSTtZQUNaLE1BQU0sRUFBRSxJQUFJO1lBQ1osUUFBUSxFQUFFLEtBQUs7U0FDaEIsQ0FBQztLQUNIO0lBRUQsTUFBTSxVQUFVLEdBQUc7UUFDakIsTUFBTSxFQUFFLEtBQUs7UUFDYixNQUFNLEVBQUUsS0FBSztRQUNiLFFBQVEsRUFBRSxJQUFJO0tBQ2YsQ0FBQztJQUVGLElBQUksU0FBUyxDQUFDLHFCQUFxQixDQUFDLEVBQUU7UUFDcEMsT0FBTyxVQUFVLENBQUM7S0FDbkI7SUFFRCxLQUFLLE1BQU0sSUFBSSxJQUFJLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUNuRCxRQUFRLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRTtZQUNqQyxLQUFLLFFBQVE7Z0JBQ1gsVUFBVSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7Z0JBQ3pCLE1BQU07WUFDUixLQUFLLFFBQVE7Z0JBQ1gsVUFBVSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7Z0JBQ3pCLE1BQU07WUFDUixLQUFLLFVBQVU7Z0JBQ2IsVUFBVSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7Z0JBQzNCLE1BQU07U0FDVDtLQUNGO0lBRUQsT0FBTyxVQUFVLENBQUM7QUFDcEIsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUVMLE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUN6QyxRQUFBLFdBQVcsR0FBRyxTQUFTLENBQUMsY0FBYyxDQUFDO0lBQ2xELENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUM7SUFDN0IsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUM7QUFFWixRQUFBLGNBQWMsR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDO0FBQ3hDLFFBQUEsV0FBVyxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUM7QUFFaEQ7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsQ0FBQztBQUNsRCxRQUFBLFVBQVUsR0FBRyxTQUFTLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmZ1bmN0aW9uIGlzRGlzYWJsZWQodmFyaWFibGU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gdmFyaWFibGUgPT09ICcwJyB8fCB2YXJpYWJsZS50b0xvd2VyQ2FzZSgpID09PSAnZmFsc2UnO1xufVxuXG5mdW5jdGlvbiBpc0VuYWJsZWQodmFyaWFibGU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gdmFyaWFibGUgPT09ICcxJyB8fCB2YXJpYWJsZS50b0xvd2VyQ2FzZSgpID09PSAndHJ1ZSc7XG59XG5cbmZ1bmN0aW9uIGlzUHJlc2VudCh2YXJpYWJsZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogdmFyaWFibGUgaXMgc3RyaW5nIHtcbiAgcmV0dXJuIHR5cGVvZiB2YXJpYWJsZSA9PT0gJ3N0cmluZycgJiYgdmFyaWFibGUgIT09ICcnO1xufVxuXG4vLyBPcHRpbWl6YXRpb24gYW5kIG1hbmdsaW5nXG5jb25zdCBkZWJ1Z09wdGltaXplVmFyaWFibGUgPSBwcm9jZXNzLmVudlsnTkdfQlVJTERfREVCVUdfT1BUSU1JWkUnXTtcbmNvbnN0IGRlYnVnT3B0aW1pemUgPSAoKCkgPT4ge1xuICBpZiAoIWlzUHJlc2VudChkZWJ1Z09wdGltaXplVmFyaWFibGUpIHx8IGlzRGlzYWJsZWQoZGVidWdPcHRpbWl6ZVZhcmlhYmxlKSkge1xuICAgIHJldHVybiB7XG4gICAgICBtYW5nbGU6IHRydWUsXG4gICAgICBtaW5pZnk6IHRydWUsXG4gICAgICBiZWF1dGlmeTogZmFsc2UsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IGRlYnVnVmFsdWUgPSB7XG4gICAgbWFuZ2xlOiBmYWxzZSxcbiAgICBtaW5pZnk6IGZhbHNlLFxuICAgIGJlYXV0aWZ5OiB0cnVlLFxuICB9O1xuXG4gIGlmIChpc0VuYWJsZWQoZGVidWdPcHRpbWl6ZVZhcmlhYmxlKSkge1xuICAgIHJldHVybiBkZWJ1Z1ZhbHVlO1xuICB9XG5cbiAgZm9yIChjb25zdCBwYXJ0IG9mIGRlYnVnT3B0aW1pemVWYXJpYWJsZS5zcGxpdCgnLCcpKSB7XG4gICAgc3dpdGNoIChwYXJ0LnRyaW0oKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICBjYXNlICdtYW5nbGUnOlxuICAgICAgICBkZWJ1Z1ZhbHVlLm1hbmdsZSA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnbWluaWZ5JzpcbiAgICAgICAgZGVidWdWYWx1ZS5taW5pZnkgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2JlYXV0aWZ5JzpcbiAgICAgICAgZGVidWdWYWx1ZS5iZWF1dGlmeSA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBkZWJ1Z1ZhbHVlO1xufSkoKTtcblxuY29uc3QgbWFuZ2xlVmFyaWFibGUgPSBwcm9jZXNzLmVudlsnTkdfQlVJTERfTUFOR0xFJ107XG5leHBvcnQgY29uc3QgYWxsb3dNYW5nbGUgPSBpc1ByZXNlbnQobWFuZ2xlVmFyaWFibGUpXG4gID8gIWlzRGlzYWJsZWQobWFuZ2xlVmFyaWFibGUpXG4gIDogZGVidWdPcHRpbWl6ZS5tYW5nbGU7XG5cbmV4cG9ydCBjb25zdCBzaG91bGRCZWF1dGlmeSA9IGRlYnVnT3B0aW1pemUuYmVhdXRpZnk7XG5leHBvcnQgY29uc3QgYWxsb3dNaW5pZnkgPSBkZWJ1Z09wdGltaXplLm1pbmlmeTtcblxuLyoqXG4gKiBTb21lIGVudmlyb25tZW50cywgbGlrZSBDaXJjbGVDSSB3aGljaCB1c2UgRG9ja2VyIHJlcG9ydCBhIG51bWJlciBvZiBDUFVzIGJ5IHRoZSBob3N0IGFuZCBub3QgdGhlIGNvdW50IG9mIGF2YWlsYWJsZS5cbiAqIFRoaXMgY2F1c2UgYEVycm9yOiBDYWxsIHJldHJpZXMgd2VyZSBleGNlZWRlZGAgZXJyb3JzIHdoZW4gdHJ5aW5nIHRvIHVzZSB0aGVtLlxuICpcbiAqIEBzZWUgaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2lzc3Vlcy8yODc2MlxuICogQHNlZSBodHRwczovL2dpdGh1Yi5jb20vd2VicGFjay1jb250cmliL3RlcnNlci13ZWJwYWNrLXBsdWdpbi9pc3N1ZXMvMTQzXG4gKiBAc2VlIGh0dHBzOi8vaXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzE2ODYwI2lzc3VlY29tbWVudC01ODg4MjgwNzlcbiAqXG4gKi9cbmNvbnN0IG1heFdvcmtlcnNWYXJpYWJsZSA9IHByb2Nlc3MuZW52WydOR19CVUlMRF9NQVhfV09SS0VSUyddO1xuZXhwb3J0IGNvbnN0IG1heFdvcmtlcnMgPSBpc1ByZXNlbnQobWF4V29ya2Vyc1ZhcmlhYmxlKSA/ICttYXhXb3JrZXJzVmFyaWFibGUgOiA0O1xuIl19