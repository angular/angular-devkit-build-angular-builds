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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _AngularCompilation_angularCompilerCliModule;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AngularCompilation = void 0;
const typescript_1 = __importDefault(require("typescript"));
const load_esm_1 = require("../../../../utils/load-esm");
const profiling_1 = require("../../profiling");
const diagnostics_1 = require("../diagnostics");
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
            supportTestBed: false,
            supportJitMode: false,
        }));
    }
    async diagnoseFiles() {
        const result = {};
        (0, profiling_1.profileSync)('NG_DIAGNOSTICS_TOTAL', () => {
            for (const diagnostic of this.collectDiagnostics()) {
                const message = (0, diagnostics_1.convertTypeScriptDiagnostic)(diagnostic);
                if (diagnostic.category === typescript_1.default.DiagnosticCategory.Error) {
                    (result.errors ?? (result.errors = [])).push(message);
                }
                else {
                    (result.warnings ?? (result.warnings = [])).push(message);
                }
            }
        });
        return result;
    }
}
exports.AngularCompilation = AngularCompilation;
_a = AngularCompilation;
_AngularCompilation_angularCompilerCliModule = { value: void 0 };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5ndWxhci1jb21waWxhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvYW5ndWxhci9jb21waWxhdGlvbi9hbmd1bGFyLWNvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUlILDREQUE0QjtBQUM1Qix5REFBMkQ7QUFDM0QsK0NBQThDO0FBRTlDLGdEQUE2RDtBQVE3RCxNQUFzQixrQkFBa0I7SUFHdEMsTUFBTSxDQUFDLEtBQUssQ0FBQyxlQUFlOztRQUMxQixtRkFBbUY7UUFDbkYsaUdBQWlHO1FBQ2pHLHlJQUFpRCxNQUFNLElBQUEsd0JBQWEsRUFDbEUsdUJBQXVCLENBQ3hCLG9EQUFBLENBQUM7UUFFRixPQUFPLHVCQUFBLGtCQUFrQix3REFBMEIsQ0FBQztJQUN0RCxDQUFDO0lBRVMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLFFBQWdCO1FBQ2hELE1BQU0sRUFBRSxpQkFBaUIsRUFBRSxHQUFHLE1BQU0sa0JBQWtCLENBQUMsZUFBZSxFQUFFLENBQUM7UUFFekUsT0FBTyxJQUFBLHVCQUFXLEVBQUMsZ0JBQWdCLEVBQUUsR0FBRyxFQUFFLENBQ3hDLGlCQUFpQixDQUFDLFFBQVEsRUFBRTtZQUMxQiw2RkFBNkY7WUFDN0YsdUJBQXVCLEVBQUUsSUFBSTtZQUM3QixNQUFNLEVBQUUsU0FBUztZQUNqQixTQUFTLEVBQUUsS0FBSztZQUNoQixXQUFXLEVBQUUsS0FBSztZQUNsQixjQUFjLEVBQUUsS0FBSztZQUNyQixzQkFBc0IsRUFBRSxLQUFLO1lBQzdCLGFBQWEsRUFBRSxZQUFZO1lBQzNCLHNCQUFzQixFQUFFLEtBQUs7WUFDN0IsY0FBYyxFQUFFLEtBQUs7WUFDckIsY0FBYyxFQUFFLEtBQUs7U0FDdEIsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0lBZ0JELEtBQUssQ0FBQyxhQUFhO1FBQ2pCLE1BQU0sTUFBTSxHQUErRCxFQUFFLENBQUM7UUFFOUUsSUFBQSx1QkFBVyxFQUFDLHNCQUFzQixFQUFFLEdBQUcsRUFBRTtZQUN2QyxLQUFLLE1BQU0sVUFBVSxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFO2dCQUNsRCxNQUFNLE9BQU8sR0FBRyxJQUFBLHlDQUEyQixFQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUN4RCxJQUFJLFVBQVUsQ0FBQyxRQUFRLEtBQUssb0JBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLEVBQUU7b0JBQ3ZELENBQUMsTUFBTSxDQUFDLE1BQU0sS0FBYixNQUFNLENBQUMsTUFBTSxHQUFLLEVBQUUsRUFBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztpQkFDdEM7cUJBQU07b0JBQ0wsQ0FBQyxNQUFNLENBQUMsUUFBUSxLQUFmLE1BQU0sQ0FBQyxRQUFRLEdBQUssRUFBRSxFQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2lCQUN4QzthQUNGO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0NBQ0Y7QUEvREQsZ0RBK0RDOztBQTlEUSxnRUFBeUIsQ0FBYSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHR5cGUgeyBQYXJ0aWFsTWVzc2FnZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcbmltcG9ydCB7IHByb2ZpbGVTeW5jIH0gZnJvbSAnLi4vLi4vcHJvZmlsaW5nJztcbmltcG9ydCB0eXBlIHsgQW5ndWxhckhvc3RPcHRpb25zIH0gZnJvbSAnLi4vYW5ndWxhci1ob3N0JztcbmltcG9ydCB7IGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpYyB9IGZyb20gJy4uL2RpYWdub3N0aWNzJztcblxuZXhwb3J0IGludGVyZmFjZSBFbWl0RmlsZVJlc3VsdCB7XG4gIGZpbGVuYW1lOiBzdHJpbmc7XG4gIGNvbnRlbnRzOiBzdHJpbmc7XG4gIGRlcGVuZGVuY2llcz86IHJlYWRvbmx5IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQW5ndWxhckNvbXBpbGF0aW9uIHtcbiAgc3RhdGljICNhbmd1bGFyQ29tcGlsZXJDbGlNb2R1bGU/OiB0eXBlb2Ygbmc7XG5cbiAgc3RhdGljIGFzeW5jIGxvYWRDb21waWxlckNsaSgpOiBQcm9taXNlPHR5cGVvZiBuZz4ge1xuICAgIC8vIFRoaXMgdXNlcyBhIHdyYXBwZWQgZHluYW1pYyBpbXBvcnQgdG8gbG9hZCBgQGFuZ3VsYXIvY29tcGlsZXItY2xpYCB3aGljaCBpcyBFU00uXG4gICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIHJldGFpbmluZyBkeW5hbWljIGltcG9ydHMgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZSBkcm9wcGVkLlxuICAgIEFuZ3VsYXJDb21waWxhdGlvbi4jYW5ndWxhckNvbXBpbGVyQ2xpTW9kdWxlID8/PSBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBuZz4oXG4gICAgICAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJyxcbiAgICApO1xuXG4gICAgcmV0dXJuIEFuZ3VsYXJDb21waWxhdGlvbi4jYW5ndWxhckNvbXBpbGVyQ2xpTW9kdWxlO1xuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGxvYWRDb25maWd1cmF0aW9uKHRzY29uZmlnOiBzdHJpbmcpOiBQcm9taXNlPG5nLkNvbXBpbGVyT3B0aW9ucz4ge1xuICAgIGNvbnN0IHsgcmVhZENvbmZpZ3VyYXRpb24gfSA9IGF3YWl0IEFuZ3VsYXJDb21waWxhdGlvbi5sb2FkQ29tcGlsZXJDbGkoKTtcblxuICAgIHJldHVybiBwcm9maWxlU3luYygnTkdfUkVBRF9DT05GSUcnLCAoKSA9PlxuICAgICAgcmVhZENvbmZpZ3VyYXRpb24odHNjb25maWcsIHtcbiAgICAgICAgLy8gQW5ndWxhciBzcGVjaWZpYyBjb25maWd1cmF0aW9uIGRlZmF1bHRzIGFuZCBvdmVycmlkZXMgdG8gZW5zdXJlIGEgZnVuY3Rpb25pbmcgY29tcGlsYXRpb24uXG4gICAgICAgIHN1cHByZXNzT3V0cHV0UGF0aENoZWNrOiB0cnVlLFxuICAgICAgICBvdXREaXI6IHVuZGVmaW5lZCxcbiAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcbiAgICAgICAgZGVjbGFyYXRpb246IGZhbHNlLFxuICAgICAgICBkZWNsYXJhdGlvbk1hcDogZmFsc2UsXG4gICAgICAgIGFsbG93RW1wdHlDb2RlZ2VuRmlsZXM6IGZhbHNlLFxuICAgICAgICBhbm5vdGF0aW9uc0FzOiAnZGVjb3JhdG9ycycsXG4gICAgICAgIGVuYWJsZVJlc291cmNlSW5saW5pbmc6IGZhbHNlLFxuICAgICAgICBzdXBwb3J0VGVzdEJlZDogZmFsc2UsXG4gICAgICAgIHN1cHBvcnRKaXRNb2RlOiBmYWxzZSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBhYnN0cmFjdCBpbml0aWFsaXplKFxuICAgIHRzY29uZmlnOiBzdHJpbmcsXG4gICAgaG9zdE9wdGlvbnM6IEFuZ3VsYXJIb3N0T3B0aW9ucyxcbiAgICBjb21waWxlck9wdGlvbnNUcmFuc2Zvcm1lcj86IChjb21waWxlck9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucykgPT4gbmcuQ29tcGlsZXJPcHRpb25zLFxuICApOiBQcm9taXNlPHtcbiAgICBhZmZlY3RlZEZpbGVzOiBSZWFkb25seVNldDx0cy5Tb3VyY2VGaWxlPjtcbiAgICBjb21waWxlck9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucztcbiAgICByZWZlcmVuY2VkRmlsZXM6IHJlYWRvbmx5IHN0cmluZ1tdO1xuICB9PjtcblxuICBhYnN0cmFjdCBlbWl0QWZmZWN0ZWRGaWxlcygpOiBJdGVyYWJsZTxFbWl0RmlsZVJlc3VsdD47XG5cbiAgcHJvdGVjdGVkIGFic3RyYWN0IGNvbGxlY3REaWFnbm9zdGljcygpOiBJdGVyYWJsZTx0cy5EaWFnbm9zdGljPjtcblxuICBhc3luYyBkaWFnbm9zZUZpbGVzKCk6IFByb21pc2U8eyBlcnJvcnM/OiBQYXJ0aWFsTWVzc2FnZVtdOyB3YXJuaW5ncz86IFBhcnRpYWxNZXNzYWdlW10gfT4ge1xuICAgIGNvbnN0IHJlc3VsdDogeyBlcnJvcnM/OiBQYXJ0aWFsTWVzc2FnZVtdOyB3YXJuaW5ncz86IFBhcnRpYWxNZXNzYWdlW10gfSA9IHt9O1xuXG4gICAgcHJvZmlsZVN5bmMoJ05HX0RJQUdOT1NUSUNTX1RPVEFMJywgKCkgPT4ge1xuICAgICAgZm9yIChjb25zdCBkaWFnbm9zdGljIG9mIHRoaXMuY29sbGVjdERpYWdub3N0aWNzKCkpIHtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpYyhkaWFnbm9zdGljKTtcbiAgICAgICAgaWYgKGRpYWdub3N0aWMuY2F0ZWdvcnkgPT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcikge1xuICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaChtZXNzYWdlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaChtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuIl19