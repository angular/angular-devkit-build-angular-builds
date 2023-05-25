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
const profiling_1 = require("../profiling");
class AngularCompilation {
    static async loadCompilerCli() {
        var _b;
        // This uses a wrapped dynamic import to load `@angular/compiler-cli` which is ESM.
        // Once TypeScript provides support for retaining dynamic imports this workaround can be dropped.
        __classPrivateFieldSet(_b = AngularCompilation, _a, __classPrivateFieldGet(_b, _a, "f", _AngularCompilation_angularCompilerCliModule) ?? await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli'), "f", _AngularCompilation_angularCompilerCliModule);
        return __classPrivateFieldGet(AngularCompilation, _a, "f", _AngularCompilation_angularCompilerCliModule);
    }
    async loadConfiguration(tsconfig) {
        const { readConfiguration } = await AngularCompilation.loadCompilerCli();
        return (0, profiling_1.profileSync)('NG_READ_CONFIG', () => readConfiguration(tsconfig, {
            // Angular specific configuration defaults and overrides to ensure a functioning compilation.
            suppressOutputPathCheck: true,
            outDir: undefined,
            sourceMap: false,
            declaration: false,
            declarationMap: false,
            allowEmptyCodegenFiles: false,
            annotationsAs: 'decorators',
            enableResourceInlining: false,
        }));
    }
}
exports.AngularCompilation = AngularCompilation;
_a = AngularCompilation;
_AngularCompilation_angularCompilerCliModule = { value: void 0 };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5ndWxhci1jb21waWxhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9hbmd1bGFyL2FuZ3VsYXItY29tcGlsYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7O0FBSUgsc0RBQXdEO0FBQ3hELDRDQUEyQztBQVMzQyxNQUFzQixrQkFBa0I7SUFHdEMsTUFBTSxDQUFDLEtBQUssQ0FBQyxlQUFlOztRQUMxQixtRkFBbUY7UUFDbkYsaUdBQWlHO1FBQ2pHLHlJQUFpRCxNQUFNLElBQUEsd0JBQWEsRUFDbEUsdUJBQXVCLENBQ3hCLG9EQUFBLENBQUM7UUFFRixPQUFPLHVCQUFBLGtCQUFrQix3REFBMEIsQ0FBQztJQUN0RCxDQUFDO0lBRVMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLFFBQWdCO1FBQ2hELE1BQU0sRUFBRSxpQkFBaUIsRUFBRSxHQUFHLE1BQU0sa0JBQWtCLENBQUMsZUFBZSxFQUFFLENBQUM7UUFFekUsT0FBTyxJQUFBLHVCQUFXLEVBQUMsZ0JBQWdCLEVBQUUsR0FBRyxFQUFFLENBQ3hDLGlCQUFpQixDQUFDLFFBQVEsRUFBRTtZQUMxQiw2RkFBNkY7WUFDN0YsdUJBQXVCLEVBQUUsSUFBSTtZQUM3QixNQUFNLEVBQUUsU0FBUztZQUNqQixTQUFTLEVBQUUsS0FBSztZQUNoQixXQUFXLEVBQUUsS0FBSztZQUNsQixjQUFjLEVBQUUsS0FBSztZQUNyQixzQkFBc0IsRUFBRSxLQUFLO1lBQzdCLGFBQWEsRUFBRSxZQUFZO1lBQzNCLHNCQUFzQixFQUFFLEtBQUs7U0FDOUIsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0NBZUY7QUE1Q0QsZ0RBNENDOztBQTNDUSxnRUFBeUIsQ0FBYSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHR5cGUgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHsgcHJvZmlsZVN5bmMgfSBmcm9tICcuLi9wcm9maWxpbmcnO1xuaW1wb3J0IHR5cGUgeyBBbmd1bGFySG9zdE9wdGlvbnMgfSBmcm9tICcuL2FuZ3VsYXItaG9zdCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRW1pdEZpbGVSZXN1bHQge1xuICBmaWxlbmFtZTogc3RyaW5nO1xuICBjb250ZW50czogc3RyaW5nO1xuICBkZXBlbmRlbmNpZXM/OiByZWFkb25seSBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFuZ3VsYXJDb21waWxhdGlvbiB7XG4gIHN0YXRpYyAjYW5ndWxhckNvbXBpbGVyQ2xpTW9kdWxlPzogdHlwZW9mIG5nO1xuXG4gIHN0YXRpYyBhc3luYyBsb2FkQ29tcGlsZXJDbGkoKTogUHJvbWlzZTx0eXBlb2Ygbmc+IHtcbiAgICAvLyBUaGlzIHVzZXMgYSB3cmFwcGVkIGR5bmFtaWMgaW1wb3J0IHRvIGxvYWQgYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgd2hpY2ggaXMgRVNNLlxuICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciByZXRhaW5pbmcgZHluYW1pYyBpbXBvcnRzIHRoaXMgd29ya2Fyb3VuZCBjYW4gYmUgZHJvcHBlZC5cbiAgICBBbmd1bGFyQ29tcGlsYXRpb24uI2FuZ3VsYXJDb21waWxlckNsaU1vZHVsZSA/Pz0gYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2Ygbmc+KFxuICAgICAgJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScsXG4gICAgKTtcblxuICAgIHJldHVybiBBbmd1bGFyQ29tcGlsYXRpb24uI2FuZ3VsYXJDb21waWxlckNsaU1vZHVsZTtcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBsb2FkQ29uZmlndXJhdGlvbih0c2NvbmZpZzogc3RyaW5nKTogUHJvbWlzZTxuZy5Db21waWxlck9wdGlvbnM+IHtcbiAgICBjb25zdCB7IHJlYWRDb25maWd1cmF0aW9uIH0gPSBhd2FpdCBBbmd1bGFyQ29tcGlsYXRpb24ubG9hZENvbXBpbGVyQ2xpKCk7XG5cbiAgICByZXR1cm4gcHJvZmlsZVN5bmMoJ05HX1JFQURfQ09ORklHJywgKCkgPT5cbiAgICAgIHJlYWRDb25maWd1cmF0aW9uKHRzY29uZmlnLCB7XG4gICAgICAgIC8vIEFuZ3VsYXIgc3BlY2lmaWMgY29uZmlndXJhdGlvbiBkZWZhdWx0cyBhbmQgb3ZlcnJpZGVzIHRvIGVuc3VyZSBhIGZ1bmN0aW9uaW5nIGNvbXBpbGF0aW9uLlxuICAgICAgICBzdXBwcmVzc091dHB1dFBhdGhDaGVjazogdHJ1ZSxcbiAgICAgICAgb3V0RGlyOiB1bmRlZmluZWQsXG4gICAgICAgIHNvdXJjZU1hcDogZmFsc2UsXG4gICAgICAgIGRlY2xhcmF0aW9uOiBmYWxzZSxcbiAgICAgICAgZGVjbGFyYXRpb25NYXA6IGZhbHNlLFxuICAgICAgICBhbGxvd0VtcHR5Q29kZWdlbkZpbGVzOiBmYWxzZSxcbiAgICAgICAgYW5ub3RhdGlvbnNBczogJ2RlY29yYXRvcnMnLFxuICAgICAgICBlbmFibGVSZXNvdXJjZUlubGluaW5nOiBmYWxzZSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBhYnN0cmFjdCBpbml0aWFsaXplKFxuICAgIHRzY29uZmlnOiBzdHJpbmcsXG4gICAgaG9zdE9wdGlvbnM6IEFuZ3VsYXJIb3N0T3B0aW9ucyxcbiAgICBjb21waWxlck9wdGlvbnNUcmFuc2Zvcm1lcj86IChjb21waWxlck9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucykgPT4gbmcuQ29tcGlsZXJPcHRpb25zLFxuICApOiBQcm9taXNlPHtcbiAgICBhZmZlY3RlZEZpbGVzOiBSZWFkb25seVNldDx0cy5Tb3VyY2VGaWxlPjtcbiAgICBjb21waWxlck9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucztcbiAgICByZWZlcmVuY2VkRmlsZXM6IHJlYWRvbmx5IHN0cmluZ1tdO1xuICB9PjtcblxuICBhYnN0cmFjdCBjb2xsZWN0RGlhZ25vc3RpY3MoKTogSXRlcmFibGU8dHMuRGlhZ25vc3RpYz47XG5cbiAgYWJzdHJhY3QgZW1pdEFmZmVjdGVkRmlsZXMoKTogSXRlcmFibGU8RW1pdEZpbGVSZXN1bHQ+O1xufVxuIl19