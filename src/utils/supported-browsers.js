"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupportedBrowsers = void 0;
const browserslist_1 = __importDefault(require("browserslist"));
function getSupportedBrowsers(projectRoot) {
    browserslist_1.default.defaults = [
        'last 1 Chrome version',
        'last 1 Firefox version',
        'last 2 Edge major versions',
        'last 2 Safari major versions',
        'last 2 iOS major versions',
        'Firefox ESR',
    ];
    return (0, browserslist_1.default)(undefined, { path: projectRoot });
}
exports.getSupportedBrowsers = getSupportedBrowsers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3VwcG9ydGVkLWJyb3dzZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvc3VwcG9ydGVkLWJyb3dzZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUVILGdFQUF3QztBQUV4QyxTQUFnQixvQkFBb0IsQ0FBQyxXQUFtQjtJQUN0RCxzQkFBWSxDQUFDLFFBQVEsR0FBRztRQUN0Qix1QkFBdUI7UUFDdkIsd0JBQXdCO1FBQ3hCLDRCQUE0QjtRQUM1Qiw4QkFBOEI7UUFDOUIsMkJBQTJCO1FBQzNCLGFBQWE7S0FDZCxDQUFDO0lBRUYsT0FBTyxJQUFBLHNCQUFZLEVBQUMsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFDeEQsQ0FBQztBQVhELG9EQVdDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBicm93c2Vyc2xpc3QgZnJvbSAnYnJvd3NlcnNsaXN0JztcblxuZXhwb3J0IGZ1bmN0aW9uIGdldFN1cHBvcnRlZEJyb3dzZXJzKHByb2plY3RSb290OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGJyb3dzZXJzbGlzdC5kZWZhdWx0cyA9IFtcbiAgICAnbGFzdCAxIENocm9tZSB2ZXJzaW9uJyxcbiAgICAnbGFzdCAxIEZpcmVmb3ggdmVyc2lvbicsXG4gICAgJ2xhc3QgMiBFZGdlIG1ham9yIHZlcnNpb25zJyxcbiAgICAnbGFzdCAyIFNhZmFyaSBtYWpvciB2ZXJzaW9ucycsXG4gICAgJ2xhc3QgMiBpT1MgbWFqb3IgdmVyc2lvbnMnLFxuICAgICdGaXJlZm94IEVTUicsXG4gIF07XG5cbiAgcmV0dXJuIGJyb3dzZXJzbGlzdCh1bmRlZmluZWQsIHsgcGF0aDogcHJvamVjdFJvb3QgfSk7XG59XG4iXX0=