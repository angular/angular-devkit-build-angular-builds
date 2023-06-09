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
var _JitCompilation_state;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JitCompilation = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const typescript_1 = __importDefault(require("typescript"));
const profiling_1 = require("../profiling");
const angular_compilation_1 = require("./angular-compilation");
const angular_host_1 = require("./angular-host");
const jit_resource_transformer_1 = require("./jit-resource-transformer");
class JitCompilationState {
    constructor(compilerHost, typeScriptProgram, constructorParametersDownlevelTransform, replaceResourcesTransform) {
        this.compilerHost = compilerHost;
        this.typeScriptProgram = typeScriptProgram;
        this.constructorParametersDownlevelTransform = constructorParametersDownlevelTransform;
        this.replaceResourcesTransform = replaceResourcesTransform;
    }
}
class JitCompilation extends angular_compilation_1.AngularCompilation {
    constructor() {
        super(...arguments);
        _JitCompilation_state.set(this, void 0);
    }
    async initialize(tsconfig, hostOptions, compilerOptionsTransformer) {
        // Dynamically load the Angular compiler CLI package
        const { constructorParametersDownlevelTransform } = await angular_compilation_1.AngularCompilation.loadCompilerCli();
        // Load the compiler configuration and transform as needed
        const { options: originalCompilerOptions, rootNames, errors: configurationDiagnostics, } = await this.loadConfiguration(tsconfig);
        const compilerOptions = compilerOptionsTransformer?.(originalCompilerOptions) ?? originalCompilerOptions;
        // Create Angular compiler host
        const host = (0, angular_host_1.createAngularCompilerHost)(compilerOptions, hostOptions);
        // Create the TypeScript Program
        const typeScriptProgram = (0, profiling_1.profileSync)('TS_CREATE_PROGRAM', () => typescript_1.default.createEmitAndSemanticDiagnosticsBuilderProgram(rootNames, compilerOptions, host, __classPrivateFieldGet(this, _JitCompilation_state, "f")?.typeScriptProgram ?? typescript_1.default.readBuilderProgram(compilerOptions, host), configurationDiagnostics));
        const affectedFiles = (0, profiling_1.profileSync)('TS_FIND_AFFECTED', () => findAffectedFiles(typeScriptProgram));
        __classPrivateFieldSet(this, _JitCompilation_state, new JitCompilationState(host, typeScriptProgram, constructorParametersDownlevelTransform(typeScriptProgram.getProgram()), (0, jit_resource_transformer_1.createJitResourceTransformer)(() => typeScriptProgram.getProgram().getTypeChecker())), "f");
        const referencedFiles = typeScriptProgram
            .getSourceFiles()
            .map((sourceFile) => sourceFile.fileName);
        return { affectedFiles, compilerOptions, referencedFiles };
    }
    *collectDiagnostics() {
        (0, node_assert_1.default)(__classPrivateFieldGet(this, _JitCompilation_state, "f"), 'Compilation must be initialized prior to collecting diagnostics.');
        const { typeScriptProgram } = __classPrivateFieldGet(this, _JitCompilation_state, "f");
        // Collect program level diagnostics
        yield* typeScriptProgram.getConfigFileParsingDiagnostics();
        yield* typeScriptProgram.getOptionsDiagnostics();
        yield* typeScriptProgram.getGlobalDiagnostics();
        yield* (0, profiling_1.profileSync)('NG_DIAGNOSTICS_SYNTACTIC', () => typeScriptProgram.getSyntacticDiagnostics());
        yield* (0, profiling_1.profileSync)('NG_DIAGNOSTICS_SEMANTIC', () => typeScriptProgram.getSemanticDiagnostics());
    }
    emitAffectedFiles() {
        (0, node_assert_1.default)(__classPrivateFieldGet(this, _JitCompilation_state, "f"), 'Compilation must be initialized prior to emitting files.');
        const { compilerHost, typeScriptProgram, constructorParametersDownlevelTransform, replaceResourcesTransform, } = __classPrivateFieldGet(this, _JitCompilation_state, "f");
        const buildInfoFilename = typeScriptProgram.getCompilerOptions().tsBuildInfoFile ?? '.tsbuildinfo';
        const emittedFiles = [];
        const writeFileCallback = (filename, contents, _a, _b, sourceFiles) => {
            if (!sourceFiles?.length && filename.endsWith(buildInfoFilename)) {
                // Save builder info contents to specified location
                compilerHost.writeFile(filename, contents, false);
                return;
            }
            (0, node_assert_1.default)(sourceFiles?.length === 1, 'Invalid TypeScript program emit for ' + filename);
            emittedFiles.push({ filename: sourceFiles[0].fileName, contents });
        };
        const transformers = {
            before: [replaceResourcesTransform, constructorParametersDownlevelTransform],
        };
        // TypeScript will loop until there are no more affected files in the program
        while (typeScriptProgram.emitNextAffectedFile(writeFileCallback, undefined, undefined, transformers)) {
            /* empty */
        }
        return emittedFiles;
    }
}
exports.JitCompilation = JitCompilation;
_JitCompilation_state = new WeakMap();
function findAffectedFiles(builder) {
    const affectedFiles = new Set();
    let result;
    while ((result = builder.getSemanticDiagnosticsOfNextAffectedFile())) {
        affectedFiles.add(result.affected);
    }
    return affectedFiles;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0LWNvbXBpbGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2ppdC1jb21waWxhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCw4REFBaUM7QUFDakMsNERBQTRCO0FBQzVCLDRDQUEyQztBQUMzQywrREFBMkU7QUFDM0UsaURBQStFO0FBQy9FLHlFQUEwRTtBQUUxRSxNQUFNLG1CQUFtQjtJQUN2QixZQUNrQixZQUE2QixFQUM3QixpQkFBOEQsRUFDOUQsdUNBQTZFLEVBQzdFLHlCQUErRDtRQUgvRCxpQkFBWSxHQUFaLFlBQVksQ0FBaUI7UUFDN0Isc0JBQWlCLEdBQWpCLGlCQUFpQixDQUE2QztRQUM5RCw0Q0FBdUMsR0FBdkMsdUNBQXVDLENBQXNDO1FBQzdFLDhCQUF5QixHQUF6Qix5QkFBeUIsQ0FBc0M7SUFDOUUsQ0FBQztDQUNMO0FBRUQsTUFBYSxjQUFlLFNBQVEsd0NBQWtCO0lBQXREOztRQUNFLHdDQUE2QjtJQTBHL0IsQ0FBQztJQXhHQyxLQUFLLENBQUMsVUFBVSxDQUNkLFFBQWdCLEVBQ2hCLFdBQStCLEVBQy9CLDBCQUF3RjtRQU14RixvREFBb0Q7UUFDcEQsTUFBTSxFQUFFLHVDQUF1QyxFQUFFLEdBQUcsTUFBTSx3Q0FBa0IsQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUUvRiwwREFBMEQ7UUFDMUQsTUFBTSxFQUNKLE9BQU8sRUFBRSx1QkFBdUIsRUFDaEMsU0FBUyxFQUNULE1BQU0sRUFBRSx3QkFBd0IsR0FDakMsR0FBRyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMzQyxNQUFNLGVBQWUsR0FDbkIsMEJBQTBCLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLHVCQUF1QixDQUFDO1FBRW5GLCtCQUErQjtRQUMvQixNQUFNLElBQUksR0FBRyxJQUFBLHdDQUF5QixFQUFDLGVBQWUsRUFBRSxXQUFXLENBQUMsQ0FBQztRQUVyRSxnQ0FBZ0M7UUFDaEMsTUFBTSxpQkFBaUIsR0FBRyxJQUFBLHVCQUFXLEVBQUMsbUJBQW1CLEVBQUUsR0FBRyxFQUFFLENBQzlELG9CQUFFLENBQUMsOENBQThDLENBQy9DLFNBQVMsRUFDVCxlQUFlLEVBQ2YsSUFBSSxFQUNKLHVCQUFBLElBQUksNkJBQU8sRUFBRSxpQkFBaUIsSUFBSSxvQkFBRSxDQUFDLGtCQUFrQixDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsRUFDOUUsd0JBQXdCLENBQ3pCLENBQ0YsQ0FBQztRQUVGLE1BQU0sYUFBYSxHQUFHLElBQUEsdUJBQVcsRUFBQyxrQkFBa0IsRUFBRSxHQUFHLEVBQUUsQ0FDekQsaUJBQWlCLENBQUMsaUJBQWlCLENBQUMsQ0FDckMsQ0FBQztRQUVGLHVCQUFBLElBQUkseUJBQVUsSUFBSSxtQkFBbUIsQ0FDbkMsSUFBSSxFQUNKLGlCQUFpQixFQUNqQix1Q0FBdUMsQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxFQUN2RSxJQUFBLHVEQUE0QixFQUFDLEdBQUcsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQ3BGLE1BQUEsQ0FBQztRQUVGLE1BQU0sZUFBZSxHQUFHLGlCQUFpQjthQUN0QyxjQUFjLEVBQUU7YUFDaEIsR0FBRyxDQUFDLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFNUMsT0FBTyxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFFLENBQUM7SUFDN0QsQ0FBQztJQUVELENBQUMsa0JBQWtCO1FBQ2pCLElBQUEscUJBQU0sRUFBQyx1QkFBQSxJQUFJLDZCQUFPLEVBQUUsa0VBQWtFLENBQUMsQ0FBQztRQUN4RixNQUFNLEVBQUUsaUJBQWlCLEVBQUUsR0FBRyx1QkFBQSxJQUFJLDZCQUFPLENBQUM7UUFFMUMsb0NBQW9DO1FBQ3BDLEtBQUssQ0FBQyxDQUFDLGlCQUFpQixDQUFDLCtCQUErQixFQUFFLENBQUM7UUFDM0QsS0FBSyxDQUFDLENBQUMsaUJBQWlCLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUNqRCxLQUFLLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1FBQ2hELEtBQUssQ0FBQyxDQUFDLElBQUEsdUJBQVcsRUFBQywwQkFBMEIsRUFBRSxHQUFHLEVBQUUsQ0FDbEQsaUJBQWlCLENBQUMsdUJBQXVCLEVBQUUsQ0FDNUMsQ0FBQztRQUNGLEtBQUssQ0FBQyxDQUFDLElBQUEsdUJBQVcsRUFBQyx5QkFBeUIsRUFBRSxHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxzQkFBc0IsRUFBRSxDQUFDLENBQUM7SUFDbEcsQ0FBQztJQUVELGlCQUFpQjtRQUNmLElBQUEscUJBQU0sRUFBQyx1QkFBQSxJQUFJLDZCQUFPLEVBQUUsMERBQTBELENBQUMsQ0FBQztRQUNoRixNQUFNLEVBQ0osWUFBWSxFQUNaLGlCQUFpQixFQUNqQix1Q0FBdUMsRUFDdkMseUJBQXlCLEdBQzFCLEdBQUcsdUJBQUEsSUFBSSw2QkFBTyxDQUFDO1FBQ2hCLE1BQU0saUJBQWlCLEdBQ3JCLGlCQUFpQixDQUFDLGtCQUFrQixFQUFFLENBQUMsZUFBZSxJQUFJLGNBQWMsQ0FBQztRQUUzRSxNQUFNLFlBQVksR0FBcUIsRUFBRSxDQUFDO1FBQzFDLE1BQU0saUJBQWlCLEdBQXlCLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRSxFQUFFO1lBQzFGLElBQUksQ0FBQyxXQUFXLEVBQUUsTUFBTSxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUMsRUFBRTtnQkFDaEUsbURBQW1EO2dCQUNuRCxZQUFZLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBRWxELE9BQU87YUFDUjtZQUVELElBQUEscUJBQU0sRUFBQyxXQUFXLEVBQUUsTUFBTSxLQUFLLENBQUMsRUFBRSxzQ0FBc0MsR0FBRyxRQUFRLENBQUMsQ0FBQztZQUVyRixZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUNyRSxDQUFDLENBQUM7UUFDRixNQUFNLFlBQVksR0FBRztZQUNuQixNQUFNLEVBQUUsQ0FBQyx5QkFBeUIsRUFBRSx1Q0FBdUMsQ0FBQztTQUM3RSxDQUFDO1FBRUYsNkVBQTZFO1FBQzdFLE9BQ0UsaUJBQWlCLENBQUMsb0JBQW9CLENBQUMsaUJBQWlCLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxZQUFZLENBQUMsRUFDN0Y7WUFDQSxXQUFXO1NBQ1o7UUFFRCxPQUFPLFlBQVksQ0FBQztJQUN0QixDQUFDO0NBQ0Y7QUEzR0Qsd0NBMkdDOztBQUVELFNBQVMsaUJBQWlCLENBQ3hCLE9BQW9EO0lBRXBELE1BQU0sYUFBYSxHQUFHLElBQUksR0FBRyxFQUFpQixDQUFDO0lBRS9DLElBQUksTUFBTSxDQUFDO0lBQ1gsT0FBTyxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsd0NBQXdDLEVBQUUsQ0FBQyxFQUFFO1FBQ3BFLGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQXlCLENBQUMsQ0FBQztLQUNyRDtJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgbmcgZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHsgcHJvZmlsZVN5bmMgfSBmcm9tICcuLi9wcm9maWxpbmcnO1xuaW1wb3J0IHsgQW5ndWxhckNvbXBpbGF0aW9uLCBFbWl0RmlsZVJlc3VsdCB9IGZyb20gJy4vYW5ndWxhci1jb21waWxhdGlvbic7XG5pbXBvcnQgeyBBbmd1bGFySG9zdE9wdGlvbnMsIGNyZWF0ZUFuZ3VsYXJDb21waWxlckhvc3QgfSBmcm9tICcuL2FuZ3VsYXItaG9zdCc7XG5pbXBvcnQgeyBjcmVhdGVKaXRSZXNvdXJjZVRyYW5zZm9ybWVyIH0gZnJvbSAnLi9qaXQtcmVzb3VyY2UtdHJhbnNmb3JtZXInO1xuXG5jbGFzcyBKaXRDb21waWxhdGlvblN0YXRlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIHJlYWRvbmx5IGNvbXBpbGVySG9zdDogbmcuQ29tcGlsZXJIb3N0LFxuICAgIHB1YmxpYyByZWFkb25seSB0eXBlU2NyaXB0UHJvZ3JhbTogdHMuRW1pdEFuZFNlbWFudGljRGlhZ25vc3RpY3NCdWlsZGVyUHJvZ3JhbSxcbiAgICBwdWJsaWMgcmVhZG9ubHkgY29uc3RydWN0b3JQYXJhbWV0ZXJzRG93bmxldmVsVHJhbnNmb3JtOiB0cy5UcmFuc2Zvcm1lckZhY3Rvcnk8dHMuU291cmNlRmlsZT4sXG4gICAgcHVibGljIHJlYWRvbmx5IHJlcGxhY2VSZXNvdXJjZXNUcmFuc2Zvcm06IHRzLlRyYW5zZm9ybWVyRmFjdG9yeTx0cy5Tb3VyY2VGaWxlPixcbiAgKSB7fVxufVxuXG5leHBvcnQgY2xhc3MgSml0Q29tcGlsYXRpb24gZXh0ZW5kcyBBbmd1bGFyQ29tcGlsYXRpb24ge1xuICAjc3RhdGU/OiBKaXRDb21waWxhdGlvblN0YXRlO1xuXG4gIGFzeW5jIGluaXRpYWxpemUoXG4gICAgdHNjb25maWc6IHN0cmluZyxcbiAgICBob3N0T3B0aW9uczogQW5ndWxhckhvc3RPcHRpb25zLFxuICAgIGNvbXBpbGVyT3B0aW9uc1RyYW5zZm9ybWVyPzogKGNvbXBpbGVyT3B0aW9uczogbmcuQ29tcGlsZXJPcHRpb25zKSA9PiBuZy5Db21waWxlck9wdGlvbnMsXG4gICk6IFByb21pc2U8e1xuICAgIGFmZmVjdGVkRmlsZXM6IFJlYWRvbmx5U2V0PHRzLlNvdXJjZUZpbGU+O1xuICAgIGNvbXBpbGVyT3B0aW9uczogbmcuQ29tcGlsZXJPcHRpb25zO1xuICAgIHJlZmVyZW5jZWRGaWxlczogcmVhZG9ubHkgc3RyaW5nW107XG4gIH0+IHtcbiAgICAvLyBEeW5hbWljYWxseSBsb2FkIHRoZSBBbmd1bGFyIGNvbXBpbGVyIENMSSBwYWNrYWdlXG4gICAgY29uc3QgeyBjb25zdHJ1Y3RvclBhcmFtZXRlcnNEb3dubGV2ZWxUcmFuc2Zvcm0gfSA9IGF3YWl0IEFuZ3VsYXJDb21waWxhdGlvbi5sb2FkQ29tcGlsZXJDbGkoKTtcblxuICAgIC8vIExvYWQgdGhlIGNvbXBpbGVyIGNvbmZpZ3VyYXRpb24gYW5kIHRyYW5zZm9ybSBhcyBuZWVkZWRcbiAgICBjb25zdCB7XG4gICAgICBvcHRpb25zOiBvcmlnaW5hbENvbXBpbGVyT3B0aW9ucyxcbiAgICAgIHJvb3ROYW1lcyxcbiAgICAgIGVycm9yczogY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgIH0gPSBhd2FpdCB0aGlzLmxvYWRDb25maWd1cmF0aW9uKHRzY29uZmlnKTtcbiAgICBjb25zdCBjb21waWxlck9wdGlvbnMgPVxuICAgICAgY29tcGlsZXJPcHRpb25zVHJhbnNmb3JtZXI/LihvcmlnaW5hbENvbXBpbGVyT3B0aW9ucykgPz8gb3JpZ2luYWxDb21waWxlck9wdGlvbnM7XG5cbiAgICAvLyBDcmVhdGUgQW5ndWxhciBjb21waWxlciBob3N0XG4gICAgY29uc3QgaG9zdCA9IGNyZWF0ZUFuZ3VsYXJDb21waWxlckhvc3QoY29tcGlsZXJPcHRpb25zLCBob3N0T3B0aW9ucyk7XG5cbiAgICAvLyBDcmVhdGUgdGhlIFR5cGVTY3JpcHQgUHJvZ3JhbVxuICAgIGNvbnN0IHR5cGVTY3JpcHRQcm9ncmFtID0gcHJvZmlsZVN5bmMoJ1RTX0NSRUFURV9QUk9HUkFNJywgKCkgPT5cbiAgICAgIHRzLmNyZWF0ZUVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0oXG4gICAgICAgIHJvb3ROYW1lcyxcbiAgICAgICAgY29tcGlsZXJPcHRpb25zLFxuICAgICAgICBob3N0LFxuICAgICAgICB0aGlzLiNzdGF0ZT8udHlwZVNjcmlwdFByb2dyYW0gPz8gdHMucmVhZEJ1aWxkZXJQcm9ncmFtKGNvbXBpbGVyT3B0aW9ucywgaG9zdCksXG4gICAgICAgIGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcyxcbiAgICAgICksXG4gICAgKTtcblxuICAgIGNvbnN0IGFmZmVjdGVkRmlsZXMgPSBwcm9maWxlU3luYygnVFNfRklORF9BRkZFQ1RFRCcsICgpID0+XG4gICAgICBmaW5kQWZmZWN0ZWRGaWxlcyh0eXBlU2NyaXB0UHJvZ3JhbSksXG4gICAgKTtcblxuICAgIHRoaXMuI3N0YXRlID0gbmV3IEppdENvbXBpbGF0aW9uU3RhdGUoXG4gICAgICBob3N0LFxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0sXG4gICAgICBjb25zdHJ1Y3RvclBhcmFtZXRlcnNEb3dubGV2ZWxUcmFuc2Zvcm0odHlwZVNjcmlwdFByb2dyYW0uZ2V0UHJvZ3JhbSgpKSxcbiAgICAgIGNyZWF0ZUppdFJlc291cmNlVHJhbnNmb3JtZXIoKCkgPT4gdHlwZVNjcmlwdFByb2dyYW0uZ2V0UHJvZ3JhbSgpLmdldFR5cGVDaGVja2VyKCkpLFxuICAgICk7XG5cbiAgICBjb25zdCByZWZlcmVuY2VkRmlsZXMgPSB0eXBlU2NyaXB0UHJvZ3JhbVxuICAgICAgLmdldFNvdXJjZUZpbGVzKClcbiAgICAgIC5tYXAoKHNvdXJjZUZpbGUpID0+IHNvdXJjZUZpbGUuZmlsZU5hbWUpO1xuXG4gICAgcmV0dXJuIHsgYWZmZWN0ZWRGaWxlcywgY29tcGlsZXJPcHRpb25zLCByZWZlcmVuY2VkRmlsZXMgfTtcbiAgfVxuXG4gICpjb2xsZWN0RGlhZ25vc3RpY3MoKTogSXRlcmFibGU8dHMuRGlhZ25vc3RpYz4ge1xuICAgIGFzc2VydCh0aGlzLiNzdGF0ZSwgJ0NvbXBpbGF0aW9uIG11c3QgYmUgaW5pdGlhbGl6ZWQgcHJpb3IgdG8gY29sbGVjdGluZyBkaWFnbm9zdGljcy4nKTtcbiAgICBjb25zdCB7IHR5cGVTY3JpcHRQcm9ncmFtIH0gPSB0aGlzLiNzdGF0ZTtcblxuICAgIC8vIENvbGxlY3QgcHJvZ3JhbSBsZXZlbCBkaWFnbm9zdGljc1xuICAgIHlpZWxkKiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRDb25maWdGaWxlUGFyc2luZ0RpYWdub3N0aWNzKCk7XG4gICAgeWllbGQqIHR5cGVTY3JpcHRQcm9ncmFtLmdldE9wdGlvbnNEaWFnbm9zdGljcygpO1xuICAgIHlpZWxkKiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRHbG9iYWxEaWFnbm9zdGljcygpO1xuICAgIHlpZWxkKiBwcm9maWxlU3luYygnTkdfRElBR05PU1RJQ1NfU1lOVEFDVElDJywgKCkgPT5cbiAgICAgIHR5cGVTY3JpcHRQcm9ncmFtLmdldFN5bnRhY3RpY0RpYWdub3N0aWNzKCksXG4gICAgKTtcbiAgICB5aWVsZCogcHJvZmlsZVN5bmMoJ05HX0RJQUdOT1NUSUNTX1NFTUFOVElDJywgKCkgPT4gdHlwZVNjcmlwdFByb2dyYW0uZ2V0U2VtYW50aWNEaWFnbm9zdGljcygpKTtcbiAgfVxuXG4gIGVtaXRBZmZlY3RlZEZpbGVzKCk6IEl0ZXJhYmxlPEVtaXRGaWxlUmVzdWx0PiB7XG4gICAgYXNzZXJ0KHRoaXMuI3N0YXRlLCAnQ29tcGlsYXRpb24gbXVzdCBiZSBpbml0aWFsaXplZCBwcmlvciB0byBlbWl0dGluZyBmaWxlcy4nKTtcbiAgICBjb25zdCB7XG4gICAgICBjb21waWxlckhvc3QsXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbSxcbiAgICAgIGNvbnN0cnVjdG9yUGFyYW1ldGVyc0Rvd25sZXZlbFRyYW5zZm9ybSxcbiAgICAgIHJlcGxhY2VSZXNvdXJjZXNUcmFuc2Zvcm0sXG4gICAgfSA9IHRoaXMuI3N0YXRlO1xuICAgIGNvbnN0IGJ1aWxkSW5mb0ZpbGVuYW1lID1cbiAgICAgIHR5cGVTY3JpcHRQcm9ncmFtLmdldENvbXBpbGVyT3B0aW9ucygpLnRzQnVpbGRJbmZvRmlsZSA/PyAnLnRzYnVpbGRpbmZvJztcblxuICAgIGNvbnN0IGVtaXR0ZWRGaWxlczogRW1pdEZpbGVSZXN1bHRbXSA9IFtdO1xuICAgIGNvbnN0IHdyaXRlRmlsZUNhbGxiYWNrOiB0cy5Xcml0ZUZpbGVDYWxsYmFjayA9IChmaWxlbmFtZSwgY29udGVudHMsIF9hLCBfYiwgc291cmNlRmlsZXMpID0+IHtcbiAgICAgIGlmICghc291cmNlRmlsZXM/Lmxlbmd0aCAmJiBmaWxlbmFtZS5lbmRzV2l0aChidWlsZEluZm9GaWxlbmFtZSkpIHtcbiAgICAgICAgLy8gU2F2ZSBidWlsZGVyIGluZm8gY29udGVudHMgdG8gc3BlY2lmaWVkIGxvY2F0aW9uXG4gICAgICAgIGNvbXBpbGVySG9zdC53cml0ZUZpbGUoZmlsZW5hbWUsIGNvbnRlbnRzLCBmYWxzZSk7XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBhc3NlcnQoc291cmNlRmlsZXM/Lmxlbmd0aCA9PT0gMSwgJ0ludmFsaWQgVHlwZVNjcmlwdCBwcm9ncmFtIGVtaXQgZm9yICcgKyBmaWxlbmFtZSk7XG5cbiAgICAgIGVtaXR0ZWRGaWxlcy5wdXNoKHsgZmlsZW5hbWU6IHNvdXJjZUZpbGVzWzBdLmZpbGVOYW1lLCBjb250ZW50cyB9KTtcbiAgICB9O1xuICAgIGNvbnN0IHRyYW5zZm9ybWVycyA9IHtcbiAgICAgIGJlZm9yZTogW3JlcGxhY2VSZXNvdXJjZXNUcmFuc2Zvcm0sIGNvbnN0cnVjdG9yUGFyYW1ldGVyc0Rvd25sZXZlbFRyYW5zZm9ybV0sXG4gICAgfTtcblxuICAgIC8vIFR5cGVTY3JpcHQgd2lsbCBsb29wIHVudGlsIHRoZXJlIGFyZSBubyBtb3JlIGFmZmVjdGVkIGZpbGVzIGluIHRoZSBwcm9ncmFtXG4gICAgd2hpbGUgKFxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0uZW1pdE5leHRBZmZlY3RlZEZpbGUod3JpdGVGaWxlQ2FsbGJhY2ssIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cmFuc2Zvcm1lcnMpXG4gICAgKSB7XG4gICAgICAvKiBlbXB0eSAqL1xuICAgIH1cblxuICAgIHJldHVybiBlbWl0dGVkRmlsZXM7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZEFmZmVjdGVkRmlsZXMoXG4gIGJ1aWxkZXI6IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0sXG4pOiBTZXQ8dHMuU291cmNlRmlsZT4ge1xuICBjb25zdCBhZmZlY3RlZEZpbGVzID0gbmV3IFNldDx0cy5Tb3VyY2VGaWxlPigpO1xuXG4gIGxldCByZXN1bHQ7XG4gIHdoaWxlICgocmVzdWx0ID0gYnVpbGRlci5nZXRTZW1hbnRpY0RpYWdub3N0aWNzT2ZOZXh0QWZmZWN0ZWRGaWxlKCkpKSB7XG4gICAgYWZmZWN0ZWRGaWxlcy5hZGQocmVzdWx0LmFmZmVjdGVkIGFzIHRzLlNvdXJjZUZpbGUpO1xuICB9XG5cbiAgcmV0dXJuIGFmZmVjdGVkRmlsZXM7XG59XG4iXX0=