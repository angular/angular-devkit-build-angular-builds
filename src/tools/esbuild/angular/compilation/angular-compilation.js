"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AngularCompilation = void 0;
const load_esm_1 = require("../../../../utils/load-esm");
const profiling_1 = require("../../profiling");
const diagnostics_1 = require("../diagnostics");
class AngularCompilation {
    static #angularCompilerCliModule;
    static #typescriptModule;
    static async loadCompilerCli() {
        // This uses a wrapped dynamic import to load `@angular/compiler-cli` which is ESM.
        // Once TypeScript provides support for retaining dynamic imports this workaround can be dropped.
        AngularCompilation.#angularCompilerCliModule ??=
            await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli');
        return AngularCompilation.#angularCompilerCliModule;
    }
    static async loadTypescript() {
        AngularCompilation.#typescriptModule ??= await Promise.resolve().then(() => __importStar(require('typescript')));
        return AngularCompilation.#typescriptModule;
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
        // Avoid loading typescript until actually needed.
        // This allows for avoiding the load of typescript in the main thread when using the parallel compilation.
        const typescript = await AngularCompilation.loadTypescript();
        await (0, profiling_1.profileAsync)('NG_DIAGNOSTICS_TOTAL', async () => {
            for (const diagnostic of await this.collectDiagnostics()) {
                const message = (0, diagnostics_1.convertTypeScriptDiagnostic)(typescript, diagnostic);
                if (diagnostic.category === typescript.DiagnosticCategory.Error) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5ndWxhci1jb21waWxhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvYW5ndWxhci9jb21waWxhdGlvbi9hbmd1bGFyLWNvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBS0gseURBQTJEO0FBQzNELCtDQUE0RDtBQUU1RCxnREFBNkQ7QUFRN0QsTUFBc0Isa0JBQWtCO0lBQ3RDLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBYTtJQUM3QyxNQUFNLENBQUMsaUJBQWlCLENBQWE7SUFFckMsTUFBTSxDQUFDLEtBQUssQ0FBQyxlQUFlO1FBQzFCLG1GQUFtRjtRQUNuRixpR0FBaUc7UUFDakcsa0JBQWtCLENBQUMseUJBQXlCO1lBQzFDLE1BQU0sSUFBQSx3QkFBYSxFQUFZLHVCQUF1QixDQUFDLENBQUM7UUFFMUQsT0FBTyxrQkFBa0IsQ0FBQyx5QkFBeUIsQ0FBQztJQUN0RCxDQUFDO0lBRUQsTUFBTSxDQUFDLEtBQUssQ0FBQyxjQUFjO1FBQ3pCLGtCQUFrQixDQUFDLGlCQUFpQixLQUFLLHdEQUFhLFlBQVksR0FBQyxDQUFDO1FBRXBFLE9BQU8sa0JBQWtCLENBQUMsaUJBQWlCLENBQUM7SUFDOUMsQ0FBQztJQUVTLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxRQUFnQjtRQUNoRCxNQUFNLEVBQUUsaUJBQWlCLEVBQUUsR0FBRyxNQUFNLGtCQUFrQixDQUFDLGVBQWUsRUFBRSxDQUFDO1FBRXpFLE9BQU8sSUFBQSx1QkFBVyxFQUFDLGdCQUFnQixFQUFFLEdBQUcsRUFBRSxDQUN4QyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUU7WUFDMUIsNkZBQTZGO1lBQzdGLHVCQUF1QixFQUFFLElBQUk7WUFDN0IsTUFBTSxFQUFFLFNBQVM7WUFDakIsU0FBUyxFQUFFLEtBQUs7WUFDaEIsV0FBVyxFQUFFLEtBQUs7WUFDbEIsY0FBYyxFQUFFLEtBQUs7WUFDckIsc0JBQXNCLEVBQUUsS0FBSztZQUM3QixhQUFhLEVBQUUsWUFBWTtZQUMzQixzQkFBc0IsRUFBRSxLQUFLO1lBQzdCLGNBQWMsRUFBRSxLQUFLO1lBQ3JCLGNBQWMsRUFBRSxLQUFLO1NBQ3RCLENBQUMsQ0FDSCxDQUFDO0lBQ0osQ0FBQztJQWtCRCxLQUFLLENBQUMsYUFBYTtRQUNqQixNQUFNLE1BQU0sR0FBK0QsRUFBRSxDQUFDO1FBRTlFLGtEQUFrRDtRQUNsRCwwR0FBMEc7UUFDMUcsTUFBTSxVQUFVLEdBQUcsTUFBTSxrQkFBa0IsQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUU3RCxNQUFNLElBQUEsd0JBQVksRUFBQyxzQkFBc0IsRUFBRSxLQUFLLElBQUksRUFBRTtZQUNwRCxLQUFLLE1BQU0sVUFBVSxJQUFJLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixFQUFFLEVBQUU7Z0JBQ3hELE1BQU0sT0FBTyxHQUFHLElBQUEseUNBQTJCLEVBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDO2dCQUNwRSxJQUFJLFVBQVUsQ0FBQyxRQUFRLEtBQUssVUFBVSxDQUFDLGtCQUFrQixDQUFDLEtBQUssRUFBRTtvQkFDL0QsQ0FBQyxNQUFNLENBQUMsTUFBTSxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztpQkFDdEM7cUJBQU07b0JBQ0wsQ0FBQyxNQUFNLENBQUMsUUFBUSxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztpQkFDeEM7YUFDRjtRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztDQUtGO0FBL0VELGdEQStFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHR5cGUgeyBQYXJ0aWFsTWVzc2FnZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHR5cGUgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHsgcHJvZmlsZUFzeW5jLCBwcm9maWxlU3luYyB9IGZyb20gJy4uLy4uL3Byb2ZpbGluZyc7XG5pbXBvcnQgdHlwZSB7IEFuZ3VsYXJIb3N0T3B0aW9ucyB9IGZyb20gJy4uL2FuZ3VsYXItaG9zdCc7XG5pbXBvcnQgeyBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWMgfSBmcm9tICcuLi9kaWFnbm9zdGljcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRW1pdEZpbGVSZXN1bHQge1xuICBmaWxlbmFtZTogc3RyaW5nO1xuICBjb250ZW50czogc3RyaW5nO1xuICBkZXBlbmRlbmNpZXM/OiByZWFkb25seSBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFuZ3VsYXJDb21waWxhdGlvbiB7XG4gIHN0YXRpYyAjYW5ndWxhckNvbXBpbGVyQ2xpTW9kdWxlPzogdHlwZW9mIG5nO1xuICBzdGF0aWMgI3R5cGVzY3JpcHRNb2R1bGU/OiB0eXBlb2YgdHM7XG5cbiAgc3RhdGljIGFzeW5jIGxvYWRDb21waWxlckNsaSgpOiBQcm9taXNlPHR5cGVvZiBuZz4ge1xuICAgIC8vIFRoaXMgdXNlcyBhIHdyYXBwZWQgZHluYW1pYyBpbXBvcnQgdG8gbG9hZCBgQGFuZ3VsYXIvY29tcGlsZXItY2xpYCB3aGljaCBpcyBFU00uXG4gICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIHJldGFpbmluZyBkeW5hbWljIGltcG9ydHMgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZSBkcm9wcGVkLlxuICAgIEFuZ3VsYXJDb21waWxhdGlvbi4jYW5ndWxhckNvbXBpbGVyQ2xpTW9kdWxlID8/PVxuICAgICAgYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2Ygbmc+KCdAYW5ndWxhci9jb21waWxlci1jbGknKTtcblxuICAgIHJldHVybiBBbmd1bGFyQ29tcGlsYXRpb24uI2FuZ3VsYXJDb21waWxlckNsaU1vZHVsZTtcbiAgfVxuXG4gIHN0YXRpYyBhc3luYyBsb2FkVHlwZXNjcmlwdCgpOiBQcm9taXNlPHR5cGVvZiB0cz4ge1xuICAgIEFuZ3VsYXJDb21waWxhdGlvbi4jdHlwZXNjcmlwdE1vZHVsZSA/Pz0gYXdhaXQgaW1wb3J0KCd0eXBlc2NyaXB0Jyk7XG5cbiAgICByZXR1cm4gQW5ndWxhckNvbXBpbGF0aW9uLiN0eXBlc2NyaXB0TW9kdWxlO1xuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGxvYWRDb25maWd1cmF0aW9uKHRzY29uZmlnOiBzdHJpbmcpOiBQcm9taXNlPG5nLkNvbXBpbGVyT3B0aW9ucz4ge1xuICAgIGNvbnN0IHsgcmVhZENvbmZpZ3VyYXRpb24gfSA9IGF3YWl0IEFuZ3VsYXJDb21waWxhdGlvbi5sb2FkQ29tcGlsZXJDbGkoKTtcblxuICAgIHJldHVybiBwcm9maWxlU3luYygnTkdfUkVBRF9DT05GSUcnLCAoKSA9PlxuICAgICAgcmVhZENvbmZpZ3VyYXRpb24odHNjb25maWcsIHtcbiAgICAgICAgLy8gQW5ndWxhciBzcGVjaWZpYyBjb25maWd1cmF0aW9uIGRlZmF1bHRzIGFuZCBvdmVycmlkZXMgdG8gZW5zdXJlIGEgZnVuY3Rpb25pbmcgY29tcGlsYXRpb24uXG4gICAgICAgIHN1cHByZXNzT3V0cHV0UGF0aENoZWNrOiB0cnVlLFxuICAgICAgICBvdXREaXI6IHVuZGVmaW5lZCxcbiAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcbiAgICAgICAgZGVjbGFyYXRpb246IGZhbHNlLFxuICAgICAgICBkZWNsYXJhdGlvbk1hcDogZmFsc2UsXG4gICAgICAgIGFsbG93RW1wdHlDb2RlZ2VuRmlsZXM6IGZhbHNlLFxuICAgICAgICBhbm5vdGF0aW9uc0FzOiAnZGVjb3JhdG9ycycsXG4gICAgICAgIGVuYWJsZVJlc291cmNlSW5saW5pbmc6IGZhbHNlLFxuICAgICAgICBzdXBwb3J0VGVzdEJlZDogZmFsc2UsXG4gICAgICAgIHN1cHBvcnRKaXRNb2RlOiBmYWxzZSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBhYnN0cmFjdCBpbml0aWFsaXplKFxuICAgIHRzY29uZmlnOiBzdHJpbmcsXG4gICAgaG9zdE9wdGlvbnM6IEFuZ3VsYXJIb3N0T3B0aW9ucyxcbiAgICBjb21waWxlck9wdGlvbnNUcmFuc2Zvcm1lcj86IChjb21waWxlck9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucykgPT4gbmcuQ29tcGlsZXJPcHRpb25zLFxuICApOiBQcm9taXNlPHtcbiAgICBhZmZlY3RlZEZpbGVzOiBSZWFkb25seVNldDx0cy5Tb3VyY2VGaWxlPjtcbiAgICBjb21waWxlck9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucztcbiAgICByZWZlcmVuY2VkRmlsZXM6IHJlYWRvbmx5IHN0cmluZ1tdO1xuICB9PjtcblxuICBhYnN0cmFjdCBlbWl0QWZmZWN0ZWRGaWxlcygpOiBJdGVyYWJsZTxFbWl0RmlsZVJlc3VsdD4gfCBQcm9taXNlPEl0ZXJhYmxlPEVtaXRGaWxlUmVzdWx0Pj47XG5cbiAgcHJvdGVjdGVkIGFic3RyYWN0IGNvbGxlY3REaWFnbm9zdGljcygpOlxuICAgIHwgSXRlcmFibGU8dHMuRGlhZ25vc3RpYz5cbiAgICB8IFByb21pc2U8SXRlcmFibGU8dHMuRGlhZ25vc3RpYz4+O1xuXG4gIGFzeW5jIGRpYWdub3NlRmlsZXMoKTogUHJvbWlzZTx7IGVycm9ycz86IFBhcnRpYWxNZXNzYWdlW107IHdhcm5pbmdzPzogUGFydGlhbE1lc3NhZ2VbXSB9PiB7XG4gICAgY29uc3QgcmVzdWx0OiB7IGVycm9ycz86IFBhcnRpYWxNZXNzYWdlW107IHdhcm5pbmdzPzogUGFydGlhbE1lc3NhZ2VbXSB9ID0ge307XG5cbiAgICAvLyBBdm9pZCBsb2FkaW5nIHR5cGVzY3JpcHQgdW50aWwgYWN0dWFsbHkgbmVlZGVkLlxuICAgIC8vIFRoaXMgYWxsb3dzIGZvciBhdm9pZGluZyB0aGUgbG9hZCBvZiB0eXBlc2NyaXB0IGluIHRoZSBtYWluIHRocmVhZCB3aGVuIHVzaW5nIHRoZSBwYXJhbGxlbCBjb21waWxhdGlvbi5cbiAgICBjb25zdCB0eXBlc2NyaXB0ID0gYXdhaXQgQW5ndWxhckNvbXBpbGF0aW9uLmxvYWRUeXBlc2NyaXB0KCk7XG5cbiAgICBhd2FpdCBwcm9maWxlQXN5bmMoJ05HX0RJQUdOT1NUSUNTX1RPVEFMJywgYXN5bmMgKCkgPT4ge1xuICAgICAgZm9yIChjb25zdCBkaWFnbm9zdGljIG9mIGF3YWl0IHRoaXMuY29sbGVjdERpYWdub3N0aWNzKCkpIHtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpYyh0eXBlc2NyaXB0LCBkaWFnbm9zdGljKTtcbiAgICAgICAgaWYgKGRpYWdub3N0aWMuY2F0ZWdvcnkgPT09IHR5cGVzY3JpcHQuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKSB7XG4gICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgdXBkYXRlPyhmaWxlczogU2V0PHN0cmluZz4pOiBQcm9taXNlPHZvaWQ+O1xuXG4gIGNsb3NlPygpOiBQcm9taXNlPHZvaWQ+O1xufVxuIl19