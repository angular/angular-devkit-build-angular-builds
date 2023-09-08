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
exports.AngularCompilation = void 0;
const typescript_1 = __importDefault(require("typescript"));
const load_esm_1 = require("../../../../utils/load-esm");
const profiling_1 = require("../../profiling");
const diagnostics_1 = require("../diagnostics");
class AngularCompilation {
    static #angularCompilerCliModule;
    static async loadCompilerCli() {
        // This uses a wrapped dynamic import to load `@angular/compiler-cli` which is ESM.
        // Once TypeScript provides support for retaining dynamic imports this workaround can be dropped.
        AngularCompilation.#angularCompilerCliModule ??= await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli');
        return AngularCompilation.#angularCompilerCliModule;
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
                    (result.errors ??= []).push(message);
                }
                else {
                    (result.warnings ??= []).push(message);
                }
            }
        });
        return result;
    }
}
exports.AngularCompilation = AngularCompilation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5ndWxhci1jb21waWxhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvYW5ndWxhci9jb21waWxhdGlvbi9hbmd1bGFyLWNvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUlILDREQUE0QjtBQUM1Qix5REFBMkQ7QUFDM0QsK0NBQThDO0FBRTlDLGdEQUE2RDtBQVE3RCxNQUFzQixrQkFBa0I7SUFDdEMsTUFBTSxDQUFDLHlCQUF5QixDQUFhO0lBRTdDLE1BQU0sQ0FBQyxLQUFLLENBQUMsZUFBZTtRQUMxQixtRkFBbUY7UUFDbkYsaUdBQWlHO1FBQ2pHLGtCQUFrQixDQUFDLHlCQUF5QixLQUFLLE1BQU0sSUFBQSx3QkFBYSxFQUNsRSx1QkFBdUIsQ0FDeEIsQ0FBQztRQUVGLE9BQU8sa0JBQWtCLENBQUMseUJBQXlCLENBQUM7SUFDdEQsQ0FBQztJQUVTLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxRQUFnQjtRQUNoRCxNQUFNLEVBQUUsaUJBQWlCLEVBQUUsR0FBRyxNQUFNLGtCQUFrQixDQUFDLGVBQWUsRUFBRSxDQUFDO1FBRXpFLE9BQU8sSUFBQSx1QkFBVyxFQUFDLGdCQUFnQixFQUFFLEdBQUcsRUFBRSxDQUN4QyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUU7WUFDMUIsNkZBQTZGO1lBQzdGLHVCQUF1QixFQUFFLElBQUk7WUFDN0IsTUFBTSxFQUFFLFNBQVM7WUFDakIsU0FBUyxFQUFFLEtBQUs7WUFDaEIsV0FBVyxFQUFFLEtBQUs7WUFDbEIsY0FBYyxFQUFFLEtBQUs7WUFDckIsc0JBQXNCLEVBQUUsS0FBSztZQUM3QixhQUFhLEVBQUUsWUFBWTtZQUMzQixzQkFBc0IsRUFBRSxLQUFLO1lBQzdCLGNBQWMsRUFBRSxLQUFLO1lBQ3JCLGNBQWMsRUFBRSxLQUFLO1NBQ3RCLENBQUMsQ0FDSCxDQUFDO0lBQ0osQ0FBQztJQWdCRCxLQUFLLENBQUMsYUFBYTtRQUNqQixNQUFNLE1BQU0sR0FBK0QsRUFBRSxDQUFDO1FBRTlFLElBQUEsdUJBQVcsRUFBQyxzQkFBc0IsRUFBRSxHQUFHLEVBQUU7WUFDdkMsS0FBSyxNQUFNLFVBQVUsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsRUFBRTtnQkFDbEQsTUFBTSxPQUFPLEdBQUcsSUFBQSx5Q0FBMkIsRUFBQyxVQUFVLENBQUMsQ0FBQztnQkFDeEQsSUFBSSxVQUFVLENBQUMsUUFBUSxLQUFLLG9CQUFFLENBQUMsa0JBQWtCLENBQUMsS0FBSyxFQUFFO29CQUN2RCxDQUFDLE1BQU0sQ0FBQyxNQUFNLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2lCQUN0QztxQkFBTTtvQkFDTCxDQUFDLE1BQU0sQ0FBQyxRQUFRLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2lCQUN4QzthQUNGO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0NBQ0Y7QUEvREQsZ0RBK0RDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIG5nIGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQgdHlwZSB7IFBhcnRpYWxNZXNzYWdlIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHsgcHJvZmlsZVN5bmMgfSBmcm9tICcuLi8uLi9wcm9maWxpbmcnO1xuaW1wb3J0IHR5cGUgeyBBbmd1bGFySG9zdE9wdGlvbnMgfSBmcm9tICcuLi9hbmd1bGFyLWhvc3QnO1xuaW1wb3J0IHsgY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljIH0gZnJvbSAnLi4vZGlhZ25vc3RpY3MnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEVtaXRGaWxlUmVzdWx0IHtcbiAgZmlsZW5hbWU6IHN0cmluZztcbiAgY29udGVudHM6IHN0cmluZztcbiAgZGVwZW5kZW5jaWVzPzogcmVhZG9ubHkgc3RyaW5nW107XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBbmd1bGFyQ29tcGlsYXRpb24ge1xuICBzdGF0aWMgI2FuZ3VsYXJDb21waWxlckNsaU1vZHVsZT86IHR5cGVvZiBuZztcblxuICBzdGF0aWMgYXN5bmMgbG9hZENvbXBpbGVyQ2xpKCk6IFByb21pc2U8dHlwZW9mIG5nPiB7XG4gICAgLy8gVGhpcyB1c2VzIGEgd3JhcHBlZCBkeW5hbWljIGltcG9ydCB0byBsb2FkIGBAYW5ndWxhci9jb21waWxlci1jbGlgIHdoaWNoIGlzIEVTTS5cbiAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3IgcmV0YWluaW5nIGR5bmFtaWMgaW1wb3J0cyB0aGlzIHdvcmthcm91bmQgY2FuIGJlIGRyb3BwZWQuXG4gICAgQW5ndWxhckNvbXBpbGF0aW9uLiNhbmd1bGFyQ29tcGlsZXJDbGlNb2R1bGUgPz89IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIG5nPihcbiAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGknLFxuICAgICk7XG5cbiAgICByZXR1cm4gQW5ndWxhckNvbXBpbGF0aW9uLiNhbmd1bGFyQ29tcGlsZXJDbGlNb2R1bGU7XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgbG9hZENvbmZpZ3VyYXRpb24odHNjb25maWc6IHN0cmluZyk6IFByb21pc2U8bmcuQ29tcGlsZXJPcHRpb25zPiB7XG4gICAgY29uc3QgeyByZWFkQ29uZmlndXJhdGlvbiB9ID0gYXdhaXQgQW5ndWxhckNvbXBpbGF0aW9uLmxvYWRDb21waWxlckNsaSgpO1xuXG4gICAgcmV0dXJuIHByb2ZpbGVTeW5jKCdOR19SRUFEX0NPTkZJRycsICgpID0+XG4gICAgICByZWFkQ29uZmlndXJhdGlvbih0c2NvbmZpZywge1xuICAgICAgICAvLyBBbmd1bGFyIHNwZWNpZmljIGNvbmZpZ3VyYXRpb24gZGVmYXVsdHMgYW5kIG92ZXJyaWRlcyB0byBlbnN1cmUgYSBmdW5jdGlvbmluZyBjb21waWxhdGlvbi5cbiAgICAgICAgc3VwcHJlc3NPdXRwdXRQYXRoQ2hlY2s6IHRydWUsXG4gICAgICAgIG91dERpcjogdW5kZWZpbmVkLFxuICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxuICAgICAgICBkZWNsYXJhdGlvbjogZmFsc2UsXG4gICAgICAgIGRlY2xhcmF0aW9uTWFwOiBmYWxzZSxcbiAgICAgICAgYWxsb3dFbXB0eUNvZGVnZW5GaWxlczogZmFsc2UsXG4gICAgICAgIGFubm90YXRpb25zQXM6ICdkZWNvcmF0b3JzJyxcbiAgICAgICAgZW5hYmxlUmVzb3VyY2VJbmxpbmluZzogZmFsc2UsXG4gICAgICAgIHN1cHBvcnRUZXN0QmVkOiBmYWxzZSxcbiAgICAgICAgc3VwcG9ydEppdE1vZGU6IGZhbHNlLFxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGFic3RyYWN0IGluaXRpYWxpemUoXG4gICAgdHNjb25maWc6IHN0cmluZyxcbiAgICBob3N0T3B0aW9uczogQW5ndWxhckhvc3RPcHRpb25zLFxuICAgIGNvbXBpbGVyT3B0aW9uc1RyYW5zZm9ybWVyPzogKGNvbXBpbGVyT3B0aW9uczogbmcuQ29tcGlsZXJPcHRpb25zKSA9PiBuZy5Db21waWxlck9wdGlvbnMsXG4gICk6IFByb21pc2U8e1xuICAgIGFmZmVjdGVkRmlsZXM6IFJlYWRvbmx5U2V0PHRzLlNvdXJjZUZpbGU+O1xuICAgIGNvbXBpbGVyT3B0aW9uczogbmcuQ29tcGlsZXJPcHRpb25zO1xuICAgIHJlZmVyZW5jZWRGaWxlczogcmVhZG9ubHkgc3RyaW5nW107XG4gIH0+O1xuXG4gIGFic3RyYWN0IGVtaXRBZmZlY3RlZEZpbGVzKCk6IEl0ZXJhYmxlPEVtaXRGaWxlUmVzdWx0PjtcblxuICBwcm90ZWN0ZWQgYWJzdHJhY3QgY29sbGVjdERpYWdub3N0aWNzKCk6IEl0ZXJhYmxlPHRzLkRpYWdub3N0aWM+O1xuXG4gIGFzeW5jIGRpYWdub3NlRmlsZXMoKTogUHJvbWlzZTx7IGVycm9ycz86IFBhcnRpYWxNZXNzYWdlW107IHdhcm5pbmdzPzogUGFydGlhbE1lc3NhZ2VbXSB9PiB7XG4gICAgY29uc3QgcmVzdWx0OiB7IGVycm9ycz86IFBhcnRpYWxNZXNzYWdlW107IHdhcm5pbmdzPzogUGFydGlhbE1lc3NhZ2VbXSB9ID0ge307XG5cbiAgICBwcm9maWxlU3luYygnTkdfRElBR05PU1RJQ1NfVE9UQUwnLCAoKSA9PiB7XG4gICAgICBmb3IgKGNvbnN0IGRpYWdub3N0aWMgb2YgdGhpcy5jb2xsZWN0RGlhZ25vc3RpY3MoKSkge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljKGRpYWdub3N0aWMpO1xuICAgICAgICBpZiAoZGlhZ25vc3RpYy5jYXRlZ29yeSA9PT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKSB7XG4gICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG4iXX0=