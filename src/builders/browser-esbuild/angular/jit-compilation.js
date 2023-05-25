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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0LWNvbXBpbGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2FuZ3VsYXIvaml0LWNvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw0REFBNEI7QUFDNUIsNENBQTJDO0FBQzNDLCtEQUEyRTtBQUMzRSxpREFBK0U7QUFDL0UseUVBQTBFO0FBRTFFLE1BQU0sbUJBQW1CO0lBQ3ZCLFlBQ2tCLFlBQTZCLEVBQzdCLGlCQUE4RCxFQUM5RCx1Q0FBNkUsRUFDN0UseUJBQStEO1FBSC9ELGlCQUFZLEdBQVosWUFBWSxDQUFpQjtRQUM3QixzQkFBaUIsR0FBakIsaUJBQWlCLENBQTZDO1FBQzlELDRDQUF1QyxHQUF2Qyx1Q0FBdUMsQ0FBc0M7UUFDN0UsOEJBQXlCLEdBQXpCLHlCQUF5QixDQUFzQztJQUM5RSxDQUFDO0NBQ0w7QUFFRCxNQUFhLGNBQWUsU0FBUSx3Q0FBa0I7SUFBdEQ7O1FBQ0Usd0NBQTZCO0lBMEcvQixDQUFDO0lBeEdDLEtBQUssQ0FBQyxVQUFVLENBQ2QsUUFBZ0IsRUFDaEIsV0FBK0IsRUFDL0IsMEJBQXdGO1FBTXhGLG9EQUFvRDtRQUNwRCxNQUFNLEVBQUUsdUNBQXVDLEVBQUUsR0FBRyxNQUFNLHdDQUFrQixDQUFDLGVBQWUsRUFBRSxDQUFDO1FBRS9GLDBEQUEwRDtRQUMxRCxNQUFNLEVBQ0osT0FBTyxFQUFFLHVCQUF1QixFQUNoQyxTQUFTLEVBQ1QsTUFBTSxFQUFFLHdCQUF3QixHQUNqQyxHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzNDLE1BQU0sZUFBZSxHQUNuQiwwQkFBMEIsRUFB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LFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFFbEQsT0FBTzthQUNSO1lBRUQsSUFBQSxxQkFBTSxFQUFDLFdBQVcsRUFBRSxNQUFNLEtBQUssQ0FBQyxFQUFFLHNDQUFzQyxHQUFHLFFBQVEsQ0FBQyxDQUFDO1lBRXJGLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUMsQ0FBQztRQUNGLE1BQU0sWUFBWSxHQUFHO1lBQ25CLE1BQU0sRUFBRSxDQUFDLHlCQUF5QixFQUFFLHVDQUF1QyxDQUFDO1NBQzdFLENBQUM7UUFFRiw2RUFBNkU7UUFDN0UsT0FDRSxpQkFBaUIsQ0FBQyxvQkFBb0IsQ0FBQyxpQkFBaUIsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFlBQVksQ0FBQyxFQUM3RjtZQUNBLFdBQVc7U0FDWjtRQUVELE9BQU8sWUFBWSxDQUFDO0lBQ3RCLENBQUM7Q0FDRjtBQTNHRCx3Q0EyR0M7O0FBRUQsU0FBUyxpQkFBaUIsQ0FDeEIsT0FBb0Q7SUFFcEQsTUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLEVBQWlCLENBQUM7SUFFL0MsSUFBSSxNQUFNLENBQUM7SUFDWCxPQUFPLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyx3Q0FBd0MsRUFBRSxDQUFDLEVBQUU7UUFDcEUsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBeUIsQ0FBQyxDQUFDO0tBQ3JEO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBwcm9maWxlU3luYyB9IGZyb20gJy4uL3Byb2ZpbGluZyc7XG5pbXBvcnQgeyBBbmd1bGFyQ29tcGlsYXRpb24sIEVtaXRGaWxlUmVzdWx0IH0gZnJvbSAnLi9hbmd1bGFyLWNvbXBpbGF0aW9uJztcbmltcG9ydCB7IEFuZ3VsYXJIb3N0T3B0aW9ucywgY3JlYXRlQW5ndWxhckNvbXBpbGVySG9zdCB9IGZyb20gJy4vYW5ndWxhci1ob3N0JztcbmltcG9ydCB7IGNyZWF0ZUppdFJlc291cmNlVHJhbnNmb3JtZXIgfSBmcm9tICcuL2ppdC1yZXNvdXJjZS10cmFuc2Zvcm1lcic7XG5cbmNsYXNzIEppdENvbXBpbGF0aW9uU3RhdGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgcmVhZG9ubHkgY29tcGlsZXJIb3N0OiBuZy5Db21waWxlckhvc3QsXG4gICAgcHVibGljIHJlYWRvbmx5IHR5cGVTY3JpcHRQcm9ncmFtOiB0cy5FbWl0QW5kU2VtYW50aWNEaWFnbm9zdGljc0J1aWxkZXJQcm9ncmFtLFxuICAgIHB1YmxpYyByZWFkb25seSBjb25zdHJ1Y3RvclBhcmFtZXRlcnNEb3dubGV2ZWxUcmFuc2Zvcm06IHRzLlRyYW5zZm9ybWVyRmFjdG9yeTx0cy5Tb3VyY2VGaWxlPixcbiAgICBwdWJsaWMgcmVhZG9ubHkgcmVwbGFjZVJlc291cmNlc1RyYW5zZm9ybTogdHMuVHJhbnNmb3JtZXJGYWN0b3J5PHRzLlNvdXJjZUZpbGU+LFxuICApIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBKaXRDb21waWxhdGlvbiBleHRlbmRzIEFuZ3VsYXJDb21waWxhdGlvbiB7XG4gICNzdGF0ZT86IEppdENvbXBpbGF0aW9uU3RhdGU7XG5cbiAgYXN5bmMgaW5pdGlhbGl6ZShcbiAgICB0c2NvbmZpZzogc3RyaW5nLFxuICAgIGhvc3RPcHRpb25zOiBBbmd1bGFySG9zdE9wdGlvbnMsXG4gICAgY29tcGlsZXJPcHRpb25zVHJhbnNmb3JtZXI/OiAoY29tcGlsZXJPcHRpb25zOiBuZy5Db21waWxlck9wdGlvbnMpID0+IG5nLkNvbXBpbGVyT3B0aW9ucyxcbiAgKTogUHJvbWlzZTx7XG4gICAgYWZmZWN0ZWRGaWxlczogUmVhZG9ubHlTZXQ8dHMuU291cmNlRmlsZT47XG4gICAgY29tcGlsZXJPcHRpb25zOiBuZy5Db21waWxlck9wdGlvbnM7XG4gICAgcmVmZXJlbmNlZEZpbGVzOiByZWFkb25seSBzdHJpbmdbXTtcbiAgfT4ge1xuICAgIC8vIER5bmFtaWNhbGx5IGxvYWQgdGhlIEFuZ3VsYXIgY29tcGlsZXIgQ0xJIHBhY2thZ2VcbiAgICBjb25zdCB7IGNvbnN0cnVjdG9yUGFyYW1ldGVyc0Rvd25sZXZlbFRyYW5zZm9ybSB9ID0gYXdhaXQgQW5ndWxhckNvbXBpbGF0aW9uLmxvYWRDb21waWxlckNsaSgpO1xuXG4gICAgLy8gTG9hZCB0aGUgY29tcGlsZXIgY29uZmlndXJhdGlvbiBhbmQgdHJhbnNmb3JtIGFzIG5lZWRlZFxuICAgIGNvbnN0IHtcbiAgICAgIG9wdGlvbnM6IG9yaWdpbmFsQ29tcGlsZXJPcHRpb25zLFxuICAgICAgcm9vdE5hbWVzLFxuICAgICAgZXJyb3JzOiBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3MsXG4gICAgfSA9IGF3YWl0IHRoaXMubG9hZENvbmZpZ3VyYXRpb24odHNjb25maWcpO1xuICAgIGNvbnN0IGNvbXBpbGVyT3B0aW9ucyA9XG4gICAgICBjb21waWxlck9wdGlvbnNUcmFuc2Zvcm1lcj8uKG9yaWdpbmFsQ29tcGlsZXJPcHRpb25zKSA/PyBvcmlnaW5hbENvbXBpbGVyT3B0aW9ucztcblxuICAgIC8vIENyZWF0ZSBBbmd1bGFyIGNvbXBpbGVyIGhvc3RcbiAgICBjb25zdCBob3N0ID0gY3JlYXRlQW5ndWxhckNvbXBpbGVySG9zdChjb21waWxlck9wdGlvbnMsIGhvc3RPcHRpb25zKTtcblxuICAgIC8vIENyZWF0ZSB0aGUgVHlwZVNjcmlwdCBQcm9ncmFtXG4gICAgY29uc3QgdHlwZVNjcmlwdFByb2dyYW0gPSBwcm9maWxlU3luYygnVFNfQ1JFQVRFX1BST0dSQU0nLCAoKSA9PlxuICAgICAgdHMuY3JlYXRlRW1pdEFuZFNlbWFudGljRGlhZ25vc3RpY3NCdWlsZGVyUHJvZ3JhbShcbiAgICAgICAgcm9vdE5hbWVzLFxuICAgICAgICBjb21waWxlck9wdGlvbnMsXG4gICAgICAgIGhvc3QsXG4gICAgICAgIHRoaXMuI3N0YXRlPy50eXBlU2NyaXB0UHJvZ3JhbSA/PyB0cy5yZWFkQnVpbGRlclByb2dyYW0oY29tcGlsZXJPcHRpb25zLCBob3N0KSxcbiAgICAgICAgY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgICAgKSxcbiAgICApO1xuXG4gICAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IHByb2ZpbGVTeW5jKCdUU19GSU5EX0FGRkVDVEVEJywgKCkgPT5cbiAgICAgIGZpbmRBZmZlY3RlZEZpbGVzKHR5cGVTY3JpcHRQcm9ncmFtKSxcbiAgICApO1xuXG4gICAgdGhpcy4jc3RhdGUgPSBuZXcgSml0Q29tcGlsYXRpb25TdGF0ZShcbiAgICAgIGhvc3QsXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbSxcbiAgICAgIGNvbnN0cnVjdG9yUGFyYW1ldGVyc0Rvd25sZXZlbFRyYW5zZm9ybSh0eXBlU2NyaXB0UHJvZ3JhbS5nZXRQcm9ncmFtKCkpLFxuICAgICAgY3JlYXRlSml0UmVzb3VyY2VUcmFuc2Zvcm1lcigoKSA9PiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRQcm9ncmFtKCkuZ2V0VHlwZUNoZWNrZXIoKSksXG4gICAgKTtcblxuICAgIGNvbnN0IHJlZmVyZW5jZWRGaWxlcyA9IHR5cGVTY3JpcHRQcm9ncmFtXG4gICAgICAuZ2V0U291cmNlRmlsZXMoKVxuICAgICAgLm1hcCgoc291cmNlRmlsZSkgPT4gc291cmNlRmlsZS5maWxlTmFtZSk7XG5cbiAgICByZXR1cm4geyBhZmZlY3RlZEZpbGVzLCBjb21waWxlck9wdGlvbnMsIHJlZmVyZW5jZWRGaWxlcyB9O1xuICB9XG5cbiAgKmNvbGxlY3REaWFnbm9zdGljcygpOiBJdGVyYWJsZTx0cy5EaWFnbm9zdGljPiB7XG4gICAgYXNzZXJ0KHRoaXMuI3N0YXRlLCAnQ29tcGlsYXRpb24gbXVzdCBiZSBpbml0aWFsaXplZCBwcmlvciB0byBjb2xsZWN0aW5nIGRpYWdub3N0aWNzLicpO1xuICAgIGNvbnN0IHsgdHlwZVNjcmlwdFByb2dyYW0gfSA9IHRoaXMuI3N0YXRlO1xuXG4gICAgLy8gQ29sbGVjdCBwcm9ncmFtIGxldmVsIGRpYWdub3N0aWNzXG4gICAgeWllbGQqIHR5cGVTY3JpcHRQcm9ncmFtLmdldENvbmZpZ0ZpbGVQYXJzaW5nRGlhZ25vc3RpY3MoKTtcbiAgICB5aWVsZCogdHlwZVNjcmlwdFByb2dyYW0uZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCk7XG4gICAgeWllbGQqIHR5cGVTY3JpcHRQcm9ncmFtLmdldEdsb2JhbERpYWdub3N0aWNzKCk7XG4gICAgeWllbGQqIHByb2ZpbGVTeW5jKCdOR19ESUFHTk9TVElDU19TWU5UQUNUSUMnLCAoKSA9PlxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0uZ2V0U3ludGFjdGljRGlhZ25vc3RpY3MoKSxcbiAgICApO1xuICAgIHlpZWxkKiBwcm9maWxlU3luYygnTkdfRElBR05PU1RJQ1NfU0VNQU5USUMnLCAoKSA9PiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKCkpO1xuICB9XG5cbiAgZW1pdEFmZmVjdGVkRmlsZXMoKTogSXRlcmFibGU8RW1pdEZpbGVSZXN1bHQ+IHtcbiAgICBhc3NlcnQodGhpcy4jc3RhdGUsICdDb21waWxhdGlvbiBtdXN0IGJlIGluaXRpYWxpemVkIHByaW9yIHRvIGVtaXR0aW5nIGZpbGVzLicpO1xuICAgIGNvbnN0IHtcbiAgICAgIGNvbXBpbGVySG9zdCxcbiAgICAgIHR5cGVTY3JpcHRQcm9ncmFtLFxuICAgICAgY29uc3RydWN0b3JQYXJhbWV0ZXJzRG93bmxldmVsVHJhbnNmb3JtLFxuICAgICAgcmVwbGFjZVJlc291cmNlc1RyYW5zZm9ybSxcbiAgICB9ID0gdGhpcy4jc3RhdGU7XG4gICAgY29uc3QgYnVpbGRJbmZvRmlsZW5hbWUgPVxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0uZ2V0Q29tcGlsZXJPcHRpb25zKCkudHNCdWlsZEluZm9GaWxlID8/ICcudHNidWlsZGluZm8nO1xuXG4gICAgY29uc3QgZW1pdHRlZEZpbGVzOiBFbWl0RmlsZVJlc3VsdFtdID0gW107XG4gICAgY29uc3Qgd3JpdGVGaWxlQ2FsbGJhY2s6IHRzLldyaXRlRmlsZUNhbGxiYWNrID0gKGZpbGVuYW1lLCBjb250ZW50cywgX2EsIF9iLCBzb3VyY2VGaWxlcykgPT4ge1xuICAgICAgaWYgKCFzb3VyY2VGaWxlcz8ubGVuZ3RoICYmIGZpbGVuYW1lLmVuZHNXaXRoKGJ1aWxkSW5mb0ZpbGVuYW1lKSkge1xuICAgICAgICAvLyBTYXZlIGJ1aWxkZXIgaW5mbyBjb250ZW50cyB0byBzcGVjaWZpZWQgbG9jYXRpb25cbiAgICAgICAgY29tcGlsZXJIb3N0LndyaXRlRmlsZShmaWxlbmFtZSwgY29udGVudHMsIGZhbHNlKTtcblxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGFzc2VydChzb3VyY2VGaWxlcz8ubGVuZ3RoID09PSAxLCAnSW52YWxpZCBUeXBlU2NyaXB0IHByb2dyYW0gZW1pdCBmb3IgJyArIGZpbGVuYW1lKTtcblxuICAgICAgZW1pdHRlZEZpbGVzLnB1c2goeyBmaWxlbmFtZTogc291cmNlRmlsZXNbMF0uZmlsZU5hbWUsIGNvbnRlbnRzIH0pO1xuICAgIH07XG4gICAgY29uc3QgdHJhbnNmb3JtZXJzID0ge1xuICAgICAgYmVmb3JlOiBbcmVwbGFjZVJlc291cmNlc1RyYW5zZm9ybSwgY29uc3RydWN0b3JQYXJhbWV0ZXJzRG93bmxldmVsVHJhbnNmb3JtXSxcbiAgICB9O1xuXG4gICAgLy8gVHlwZVNjcmlwdCB3aWxsIGxvb3AgdW50aWwgdGhlcmUgYXJlIG5vIG1vcmUgYWZmZWN0ZWQgZmlsZXMgaW4gdGhlIHByb2dyYW1cbiAgICB3aGlsZSAoXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbS5lbWl0TmV4dEFmZmVjdGVkRmlsZSh3cml0ZUZpbGVDYWxsYmFjaywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRyYW5zZm9ybWVycylcbiAgICApIHtcbiAgICAgIC8qIGVtcHR5ICovXG4gICAgfVxuXG4gICAgcmV0dXJuIGVtaXR0ZWRGaWxlcztcbiAgfVxufVxuXG5mdW5jdGlvbiBmaW5kQWZmZWN0ZWRGaWxlcyhcbiAgYnVpbGRlcjogdHMuRW1pdEFuZFNlbWFudGljRGlhZ25vc3RpY3NCdWlsZGVyUHJvZ3JhbSxcbik6IFNldDx0cy5Tb3VyY2VGaWxlPiB7XG4gIGNvbnN0IGFmZmVjdGVkRmlsZXMgPSBuZXcgU2V0PHRzLlNvdXJjZUZpbGU+KCk7XG5cbiAgbGV0IHJlc3VsdDtcbiAgd2hpbGUgKChyZXN1bHQgPSBidWlsZGVyLmdldFNlbWFudGljRGlhZ25vc3RpY3NPZk5leHRBZmZlY3RlZEZpbGUoKSkpIHtcbiAgICBhZmZlY3RlZEZpbGVzLmFkZChyZXN1bHQuYWZmZWN0ZWQgYXMgdHMuU291cmNlRmlsZSk7XG4gIH1cblxuICByZXR1cm4gYWZmZWN0ZWRGaWxlcztcbn1cbiJdfQ==