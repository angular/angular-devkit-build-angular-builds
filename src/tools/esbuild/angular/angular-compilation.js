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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5ndWxhci1jb21waWxhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvYW5ndWxhci9hbmd1bGFyLWNvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7OztBQUlILHNEQUF3RDtBQUN4RCw0Q0FBMkM7QUFTM0MsTUFBc0Isa0JBQWtCO0lBR3RDLE1BQU0sQ0FBQyxLQUFLLENBQUMsZUFBZTs7UUFDMUIsbUZBQW1GO1FBQ25GLGlHQUFpRztRQUNqRyx5SUFBaUQsTUFBTSxJQUFBLHdCQUFhLEVBQ2xFLHVCQUF1QixDQUN4QixvREFBQSxDQUFDO1FBRUYsT0FBTyx1QkFBQSxrQkFBa0Isd0RBQTBCLENBQUM7SUFDdEQsQ0FBQztJQUVTLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxRQUFnQjtRQUNoRCxNQUFNLEVBQUUsaUJBQWlCLEVBQUUsR0FBRyxNQUFNLGtCQUFrQixDQUFDLGVBQWUsRUFBRSxDQUFDO1FBRXpFLE9BQU8sSUFBQSx1QkFBVyxFQUFDLGdCQUFnQixFQUFFLEdBQUcsRUFBRSxDQUN4QyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUU7WUFDMUIsNkZBQTZGO1lBQzdGLHVCQUF1QixFQUFFLElBQUk7WUFDN0IsTUFBTSxFQUFFLFNBQVM7WUFDakIsU0FBUyxFQUFFLEtBQUs7WUFDaEIsV0FBVyxFQUFFLEtBQUs7WUFDbEIsY0FBYyxFQUFFLEtBQUs7WUFDckIsc0JBQXNCLEVBQUUsS0FBSztZQUM3QixhQUFhLEVBQUUsWUFBWTtZQUMzQixzQkFBc0IsRUFBRSxLQUFLO1NBQzlCLENBQUMsQ0FDSCxDQUFDO0lBQ0osQ0FBQztDQWVGO0FBNUNELGdEQTRDQzs7QUEzQ1EsZ0VBQXlCLENBQWEiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgbmcgZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCB0eXBlIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcbmltcG9ydCB7IHByb2ZpbGVTeW5jIH0gZnJvbSAnLi4vcHJvZmlsaW5nJztcbmltcG9ydCB0eXBlIHsgQW5ndWxhckhvc3RPcHRpb25zIH0gZnJvbSAnLi9hbmd1bGFyLWhvc3QnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEVtaXRGaWxlUmVzdWx0IHtcbiAgZmlsZW5hbWU6IHN0cmluZztcbiAgY29udGVudHM6IHN0cmluZztcbiAgZGVwZW5kZW5jaWVzPzogcmVhZG9ubHkgc3RyaW5nW107XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBbmd1bGFyQ29tcGlsYXRpb24ge1xuICBzdGF0aWMgI2FuZ3VsYXJDb21waWxlckNsaU1vZHVsZT86IHR5cGVvZiBuZztcblxuICBzdGF0aWMgYXN5bmMgbG9hZENvbXBpbGVyQ2xpKCk6IFByb21pc2U8dHlwZW9mIG5nPiB7XG4gICAgLy8gVGhpcyB1c2VzIGEgd3JhcHBlZCBkeW5hbWljIGltcG9ydCB0byBsb2FkIGBAYW5ndWxhci9jb21waWxlci1jbGlgIHdoaWNoIGlzIEVTTS5cbiAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3IgcmV0YWluaW5nIGR5bmFtaWMgaW1wb3J0cyB0aGlzIHdvcmthcm91bmQgY2FuIGJlIGRyb3BwZWQuXG4gICAgQW5ndWxhckNvbXBpbGF0aW9uLiNhbmd1bGFyQ29tcGlsZXJDbGlNb2R1bGUgPz89IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIG5nPihcbiAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGknLFxuICAgICk7XG5cbiAgICByZXR1cm4gQW5ndWxhckNvbXBpbGF0aW9uLiNhbmd1bGFyQ29tcGlsZXJDbGlNb2R1bGU7XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgbG9hZENvbmZpZ3VyYXRpb24odHNjb25maWc6IHN0cmluZyk6IFByb21pc2U8bmcuQ29tcGlsZXJPcHRpb25zPiB7XG4gICAgY29uc3QgeyByZWFkQ29uZmlndXJhdGlvbiB9ID0gYXdhaXQgQW5ndWxhckNvbXBpbGF0aW9uLmxvYWRDb21waWxlckNsaSgpO1xuXG4gICAgcmV0dXJuIHByb2ZpbGVTeW5jKCdOR19SRUFEX0NPTkZJRycsICgpID0+XG4gICAgICByZWFkQ29uZmlndXJhdGlvbih0c2NvbmZpZywge1xuICAgICAgICAvLyBBbmd1bGFyIHNwZWNpZmljIGNvbmZpZ3VyYXRpb24gZGVmYXVsdHMgYW5kIG92ZXJyaWRlcyB0byBlbnN1cmUgYSBmdW5jdGlvbmluZyBjb21waWxhdGlvbi5cbiAgICAgICAgc3VwcHJlc3NPdXRwdXRQYXRoQ2hlY2s6IHRydWUsXG4gICAgICAgIG91dERpcjogdW5kZWZpbmVkLFxuICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxuICAgICAgICBkZWNsYXJhdGlvbjogZmFsc2UsXG4gICAgICAgIGRlY2xhcmF0aW9uTWFwOiBmYWxzZSxcbiAgICAgICAgYWxsb3dFbXB0eUNvZGVnZW5GaWxlczogZmFsc2UsXG4gICAgICAgIGFubm90YXRpb25zQXM6ICdkZWNvcmF0b3JzJyxcbiAgICAgICAgZW5hYmxlUmVzb3VyY2VJbmxpbmluZzogZmFsc2UsXG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgYWJzdHJhY3QgaW5pdGlhbGl6ZShcbiAgICB0c2NvbmZpZzogc3RyaW5nLFxuICAgIGhvc3RPcHRpb25zOiBBbmd1bGFySG9zdE9wdGlvbnMsXG4gICAgY29tcGlsZXJPcHRpb25zVHJhbnNmb3JtZXI/OiAoY29tcGlsZXJPcHRpb25zOiBuZy5Db21waWxlck9wdGlvbnMpID0+IG5nLkNvbXBpbGVyT3B0aW9ucyxcbiAgKTogUHJvbWlzZTx7XG4gICAgYWZmZWN0ZWRGaWxlczogUmVhZG9ubHlTZXQ8dHMuU291cmNlRmlsZT47XG4gICAgY29tcGlsZXJPcHRpb25zOiBuZy5Db21waWxlck9wdGlvbnM7XG4gICAgcmVmZXJlbmNlZEZpbGVzOiByZWFkb25seSBzdHJpbmdbXTtcbiAgfT47XG5cbiAgYWJzdHJhY3QgY29sbGVjdERpYWdub3N0aWNzKCk6IEl0ZXJhYmxlPHRzLkRpYWdub3N0aWM+O1xuXG4gIGFic3RyYWN0IGVtaXRBZmZlY3RlZEZpbGVzKCk6IEl0ZXJhYmxlPEVtaXRGaWxlUmVzdWx0Pjtcbn1cbiJdfQ==