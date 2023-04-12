"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _a, _AngularCompilation_angularCompilerCliModule;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AngularCompilation = void 0;
const load_esm_1 = require("../../../utils/load-esm");
class AngularCompilation {
    static async loadCompilerCli() {
        var _b;
        // This uses a wrapped dynamic import to load `@angular/compiler-cli` which is ESM.
        // Once TypeScript provides support for retaining dynamic imports this workaround can be dropped.
        __classPrivateFieldSet(_b = AngularCompilation, _a, __classPrivateFieldGet(_b, _a, "f", _AngularCompilation_angularCompilerCliModule) ?? await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli'), "f", _AngularCompilation_angularCompilerCliModule);
        return __classPrivateFieldGet(AngularCompilation, _a, "f", _AngularCompilation_angularCompilerCliModule);
    }
}
exports.AngularCompilation = AngularCompilation;
_a = AngularCompilation;
_AngularCompilation_angularCompilerCliModule = { value: void 0 };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5ndWxhci1jb21waWxhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9hbmd1bGFyL2FuZ3VsYXItY29tcGlsYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7O0FBSUgsc0RBQXdEO0FBV3hELE1BQXNCLGtCQUFrQjtJQUd0QyxNQUFNLENBQUMsS0FBSyxDQUFDLGVBQWU7O1FBQzFCLG1GQUFtRjtRQUNuRixpR0FBaUc7UUFDakcseUlBQWlELE1BQU0sSUFBQSx3QkFBYSxFQUNsRSx1QkFBdUIsQ0FDeEIsb0RBQUEsQ0FBQztRQUVGLE9BQU8sdUJBQUEsa0JBQWtCLHdEQUEwQixDQUFDO0lBQ3RELENBQUM7Q0FZRjtBQXZCRCxnREF1QkM7O0FBdEJRLGdFQUF5QixDQUFhIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIG5nIGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQgdHlwZSB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi8uLi8uLi91dGlscy9sb2FkLWVzbSc7XG5pbXBvcnQgdHlwZSB7IEFuZ3VsYXJIb3N0T3B0aW9ucyB9IGZyb20gJy4vYW5ndWxhci1ob3N0JztcblxuZXhwb3J0IGludGVyZmFjZSBFbWl0RmlsZVJlc3VsdCB7XG4gIGNvbnRlbnQ/OiBzdHJpbmc7XG4gIG1hcD86IHN0cmluZztcbiAgZGVwZW5kZW5jaWVzOiByZWFkb25seSBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IHR5cGUgRmlsZUVtaXR0ZXIgPSAoZmlsZTogc3RyaW5nKSA9PiBQcm9taXNlPEVtaXRGaWxlUmVzdWx0IHwgdW5kZWZpbmVkPjtcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFuZ3VsYXJDb21waWxhdGlvbiB7XG4gIHN0YXRpYyAjYW5ndWxhckNvbXBpbGVyQ2xpTW9kdWxlPzogdHlwZW9mIG5nO1xuXG4gIHN0YXRpYyBhc3luYyBsb2FkQ29tcGlsZXJDbGkoKTogUHJvbWlzZTx0eXBlb2Ygbmc+IHtcbiAgICAvLyBUaGlzIHVzZXMgYSB3cmFwcGVkIGR5bmFtaWMgaW1wb3J0IHRvIGxvYWQgYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgd2hpY2ggaXMgRVNNLlxuICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciByZXRhaW5pbmcgZHluYW1pYyBpbXBvcnRzIHRoaXMgd29ya2Fyb3VuZCBjYW4gYmUgZHJvcHBlZC5cbiAgICBBbmd1bGFyQ29tcGlsYXRpb24uI2FuZ3VsYXJDb21waWxlckNsaU1vZHVsZSA/Pz0gYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2Ygbmc+KFxuICAgICAgJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScsXG4gICAgKTtcblxuICAgIHJldHVybiBBbmd1bGFyQ29tcGlsYXRpb24uI2FuZ3VsYXJDb21waWxlckNsaU1vZHVsZTtcbiAgfVxuXG4gIGFic3RyYWN0IGluaXRpYWxpemUoXG4gICAgcm9vdE5hbWVzOiBzdHJpbmdbXSxcbiAgICBjb21waWxlck9wdGlvbnM6IHRzLkNvbXBpbGVyT3B0aW9ucyxcbiAgICBob3N0T3B0aW9uczogQW5ndWxhckhvc3RPcHRpb25zLFxuICAgIGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcz86IHRzLkRpYWdub3N0aWNbXSxcbiAgKTogUHJvbWlzZTx7IGFmZmVjdGVkRmlsZXM6IFJlYWRvbmx5U2V0PHRzLlNvdXJjZUZpbGU+IH0+O1xuXG4gIGFic3RyYWN0IGNvbGxlY3REaWFnbm9zdGljcygpOiBJdGVyYWJsZTx0cy5EaWFnbm9zdGljPjtcblxuICBhYnN0cmFjdCBjcmVhdGVGaWxlRW1pdHRlcihvbkFmdGVyRW1pdD86IChzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKSA9PiB2b2lkKTogRmlsZUVtaXR0ZXI7XG59XG4iXX0=