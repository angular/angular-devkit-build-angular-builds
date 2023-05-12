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
        return { affectedFiles, compilerOptions };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0LWNvbXBpbGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2FuZ3VsYXIvaml0LWNvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw0REFBNEI7QUFDNUIsNENBQTJDO0FBQzNDLCtEQUEyRTtBQUMzRSxpREFBK0U7QUFDL0UseUVBQTBFO0FBRTFFLE1BQU0sbUJBQW1CO0lBQ3ZCLFlBQ2tCLFlBQTZCLEVBQzdCLGlCQUE4RCxFQUM5RCx1Q0FBNkUsRUFDN0UseUJBQStEO1FBSC9ELGlCQUFZLEdBQVosWUFBWSxDQUFpQjtRQUM3QixzQkFBaUIsR0FBakIsaUJBQWlCLENBQTZDO1FBQzlELDRDQUF1QyxHQUF2Qyx1Q0FBdUMsQ0FBc0M7UUFDN0UsOEJBQXlCLEdBQXpCLHlCQUF5QixDQUFzQztJQUM5RSxDQUFDO0NBQ0w7QUFFRCxNQUFhLGNBQWUsU0FBUSx3Q0FBa0I7SUFBdEQ7O1FBQ0Usd0NBQTZCO0lBa0cvQixDQUFDO0lBaEdDLEtBQUssQ0FBQyxVQUFVLENBQ2QsUUFBZ0IsRUFDaEIsV0FBK0IsRUFDL0IsMEJBQXdGO1FBRXhGLG9EQUFvRDtRQUNwRCxNQUFNLEVBQUUsdUNBQXVDLEVBQUUsR0FBRyxNQUFNLHdDQUFrQixDQUFDLGVBQWUsRUFBRSxDQUFDO1FBRS9GLDBEQUEwRDtRQUMxRCxNQUFNLEVBQ0osT0FBTyxFQUFFLHVCQUF1QixFQUNoQyxTQUFTLEVBQ1QsTUFBTSxFQUFFLHdCQUF3QixHQUNqQyxHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzNDLE1BQU0sZUFBZSxHQUNuQiwwQkFBMEIsRUFBRSxDQUFDLHVCQUF1QixDQUFDLElBQUksdUJBQXVCLENBQUM7UUFFbkYsK0JBQStCO1FBQy9CLE1BQU0sSUFBSSxHQUFHLElBQUEsd0NBQXlCLEVBQUMsZUFBZSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBRXJFLGdDQUFnQztRQUNoQyxNQUFNLGlCQUFpQixHQUFHLElBQUEsdUJBQVcsRUFBQyxtQkFBbUIsRUFBRSxHQUFHLEVBQUUsQ0FDOUQsb0JBQUUsQ0FBQyw4Q0FBOEMsQ0FDL0MsU0FBUyxFQUNULGVBQWUsRUFDZixJQUFJLEVBQ0osdUJBQUEsSUFBSSw2QkFBTyxFQUFFLGlCQUFpQixJQUFJLG9CQUFFLENBQUMsa0JBQWtCLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxFQUM5RSx3QkFBd0IsQ0FDekIsQ0FDRixDQUFDO1FBRUYsTUFBTSxhQUFhLEdBQUcsSUFBQSx1QkFBVyxFQUFDLGtCQUFrQixFQUFFLEdBQUcsRUFBRSxDQUN6RCxpQkFBaUIsQ0FBQyxpQkFBaUIsQ0FBQyxDQUNyQyxDQUFDO1FBRUYsdUJBQUEsSUFBSSx5QkFBVSxJQUFJLG1CQUFtQixDQUNuQyxJQUFJLEVBQ0osaUJBQWlCLEVBQ2pCLHVDQUF1QyxDQUFDLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxDQUFDLEVBQ3ZFLElBQUEsdURBQTRCLEVBQUMsR0FBRyxFQUFFLENBQUMsaUJBQWlCLENBQUMsVUFBVSxFQUFFLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FDcEYsTUFBQSxDQUFDO1FBRUYsT0FBTyxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsQ0FBQztJQUM1QyxDQUFDO0lBRUQsQ0FBQyxrQkFBa0I7UUFDakIsSUFBQSxxQkFBTSxFQUFDLHVCQUFBLElBQUksNkJBQU8sRUFBRSxrRUFBa0UsQ0FBQyxDQUFDO1FBQ3hGLE1BQU0sRUFBRSxpQkFBaUIsRUFBRSxHQUFHLHVCQUFBLElBQUksNkJBQU8sQ0FBQztRQUUxQyxvQ0FBb0M7UUFDcEMsS0FBSyxDQUFDLENBQUMsaUJBQWlCLENBQUMsK0JBQStCLEVBQUUsQ0FBQztRQUMzRCxLQUFLLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQ2pELEtBQUssQ0FBQyxDQUFDLGlCQUFpQixDQUFDLG9CQUFvQixFQUFFLENBQUM7UUFDaEQsS0FBSyxDQUFDLENBQUMsSUFBQSx1QkFBVyxFQUFDLDBCQUEwQixFQUFFLEdBQUcsRUFBRSxDQUNsRCxpQkFBaUIsQ0FBQyx1QkFBdUIsRUFBRSxDQUM1QyxDQUFDO1FBQ0YsS0FBSyxDQUFDLENBQUMsSUFBQSx1QkFBVyxFQUFDLHlCQUF5QixFQUFFLEdBQUcsRUFBRSxDQUFDLGlCQUFpQixDQUFDLHNCQUFzQixFQUFFLENBQUMsQ0FBQztJQUNsRyxDQUFDO0lBRUQsaUJBQWlCO1FBQ2YsSUFBQSxxQkFBTSxFQUFDLHVCQUFBLElBQUksNkJBQU8sRUFBRSwwREFBMEQsQ0FBQyxDQUFDO1FBQ2hGLE1BQU0sRUFDSixZQUFZLEVBQ1osaUJBQWlCLEVBQ2pCLHVDQUF1QyxFQUN2Qyx5QkFBeUIsR0FDMUIsR0FBRyx1QkFBQSxJQUFJLDZCQUFPLENBQUM7UUFDaEIsTUFBTSxpQkFBaUIsR0FDckIsaUJBQWlCLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxlQUFlLElBQUksY0FBYyxDQUFDO1FBRTNFLE1BQU0sWUFBWSxHQUFxQixFQUFFLENBQUM7UUFDMUMsTUFBTSxpQkFBaUIsR0FBeUIsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLEVBQUU7WUFDMUYsSUFBSSxDQUFDLFdBQVcsRUFBRSxNQUFNLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO2dCQUNoRSxtREFBbUQ7Z0JBQ25ELFlBQVksQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFFbEQsT0FBTzthQUNSO1lBRUQsSUFBQSxxQkFBTSxFQUFDLFdBQVcsRUFBRSxNQUFNLEtBQUssQ0FBQyxFQUFFLHNDQUFzQyxHQUFHLFFBQVEsQ0FBQyxDQUFDO1lBRXJGLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUMsQ0FBQztRQUNGLE1BQU0sWUFBWSxHQUFHO1lBQ25CLE1BQU0sRUFBRSxDQUFDLHlCQUF5QixFQUFFLHVDQUF1QyxDQUFDO1NBQzdFLENBQUM7UUFFRiw2RUFBNkU7UUFDN0UsT0FDRSxpQkFBaUIsQ0FBQyxvQkFBb0IsQ0FBQyxpQkFBaUIsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFlBQVksQ0FBQyxFQUM3RjtZQUNBLFdBQVc7U0FDWjtRQUVELE9BQU8sWUFBWSxDQUFDO0lBQ3RCLENBQUM7Q0FDRjtBQW5HRCx3Q0FtR0M7O0FBRUQsU0FBUyxpQkFBaUIsQ0FDeEIsT0FBb0Q7SUFFcEQsTUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLEVBQWlCLENBQUM7SUFFL0MsSUFBSSxNQUFNLENBQUM7SUFDWCxPQUFPLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyx3Q0FBd0MsRUFBRSxDQUFDLEVBQUU7UUFDcEUsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBeUIsQ0FBQyxDQUFDO0tBQ3JEO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBwcm9maWxlU3luYyB9IGZyb20gJy4uL3Byb2ZpbGluZyc7XG5pbXBvcnQgeyBBbmd1bGFyQ29tcGlsYXRpb24sIEVtaXRGaWxlUmVzdWx0IH0gZnJvbSAnLi9hbmd1bGFyLWNvbXBpbGF0aW9uJztcbmltcG9ydCB7IEFuZ3VsYXJIb3N0T3B0aW9ucywgY3JlYXRlQW5ndWxhckNvbXBpbGVySG9zdCB9IGZyb20gJy4vYW5ndWxhci1ob3N0JztcbmltcG9ydCB7IGNyZWF0ZUppdFJlc291cmNlVHJhbnNmb3JtZXIgfSBmcm9tICcuL2ppdC1yZXNvdXJjZS10cmFuc2Zvcm1lcic7XG5cbmNsYXNzIEppdENvbXBpbGF0aW9uU3RhdGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgcmVhZG9ubHkgY29tcGlsZXJIb3N0OiBuZy5Db21waWxlckhvc3QsXG4gICAgcHVibGljIHJlYWRvbmx5IHR5cGVTY3JpcHRQcm9ncmFtOiB0cy5FbWl0QW5kU2VtYW50aWNEaWFnbm9zdGljc0J1aWxkZXJQcm9ncmFtLFxuICAgIHB1YmxpYyByZWFkb25seSBjb25zdHJ1Y3RvclBhcmFtZXRlcnNEb3dubGV2ZWxUcmFuc2Zvcm06IHRzLlRyYW5zZm9ybWVyRmFjdG9yeTx0cy5Tb3VyY2VGaWxlPixcbiAgICBwdWJsaWMgcmVhZG9ubHkgcmVwbGFjZVJlc291cmNlc1RyYW5zZm9ybTogdHMuVHJhbnNmb3JtZXJGYWN0b3J5PHRzLlNvdXJjZUZpbGU+LFxuICApIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBKaXRDb21waWxhdGlvbiBleHRlbmRzIEFuZ3VsYXJDb21waWxhdGlvbiB7XG4gICNzdGF0ZT86IEppdENvbXBpbGF0aW9uU3RhdGU7XG5cbiAgYXN5bmMgaW5pdGlhbGl6ZShcbiAgICB0c2NvbmZpZzogc3RyaW5nLFxuICAgIGhvc3RPcHRpb25zOiBBbmd1bGFySG9zdE9wdGlvbnMsXG4gICAgY29tcGlsZXJPcHRpb25zVHJhbnNmb3JtZXI/OiAoY29tcGlsZXJPcHRpb25zOiBuZy5Db21waWxlck9wdGlvbnMpID0+IG5nLkNvbXBpbGVyT3B0aW9ucyxcbiAgKTogUHJvbWlzZTx7IGFmZmVjdGVkRmlsZXM6IFJlYWRvbmx5U2V0PHRzLlNvdXJjZUZpbGU+OyBjb21waWxlck9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucyB9PiB7XG4gICAgLy8gRHluYW1pY2FsbHkgbG9hZCB0aGUgQW5ndWxhciBjb21waWxlciBDTEkgcGFja2FnZVxuICAgIGNvbnN0IHsgY29uc3RydWN0b3JQYXJhbWV0ZXJzRG93bmxldmVsVHJhbnNmb3JtIH0gPSBhd2FpdCBBbmd1bGFyQ29tcGlsYXRpb24ubG9hZENvbXBpbGVyQ2xpKCk7XG5cbiAgICAvLyBMb2FkIHRoZSBjb21waWxlciBjb25maWd1cmF0aW9uIGFuZCB0cmFuc2Zvcm0gYXMgbmVlZGVkXG4gICAgY29uc3Qge1xuICAgICAgb3B0aW9uczogb3JpZ2luYWxDb21waWxlck9wdGlvbnMsXG4gICAgICByb290TmFtZXMsXG4gICAgICBlcnJvcnM6IGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcyxcbiAgICB9ID0gYXdhaXQgdGhpcy5sb2FkQ29uZmlndXJhdGlvbih0c2NvbmZpZyk7XG4gICAgY29uc3QgY29tcGlsZXJPcHRpb25zID1cbiAgICAgIGNvbXBpbGVyT3B0aW9uc1RyYW5zZm9ybWVyPy4ob3JpZ2luYWxDb21waWxlck9wdGlvbnMpID8/IG9yaWdpbmFsQ29tcGlsZXJPcHRpb25zO1xuXG4gICAgLy8gQ3JlYXRlIEFuZ3VsYXIgY29tcGlsZXIgaG9zdFxuICAgIGNvbnN0IGhvc3QgPSBjcmVhdGVBbmd1bGFyQ29tcGlsZXJIb3N0KGNvbXBpbGVyT3B0aW9ucywgaG9zdE9wdGlvbnMpO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSBUeXBlU2NyaXB0IFByb2dyYW1cbiAgICBjb25zdCB0eXBlU2NyaXB0UHJvZ3JhbSA9IHByb2ZpbGVTeW5jKCdUU19DUkVBVEVfUFJPR1JBTScsICgpID0+XG4gICAgICB0cy5jcmVhdGVFbWl0QW5kU2VtYW50aWNEaWFnbm9zdGljc0J1aWxkZXJQcm9ncmFtKFxuICAgICAgICByb290TmFtZXMsXG4gICAgICAgIGNvbXBpbGVyT3B0aW9ucyxcbiAgICAgICAgaG9zdCxcbiAgICAgICAgdGhpcy4jc3RhdGU/LnR5cGVTY3JpcHRQcm9ncmFtID8/IHRzLnJlYWRCdWlsZGVyUHJvZ3JhbShjb21waWxlck9wdGlvbnMsIGhvc3QpLFxuICAgICAgICBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3MsXG4gICAgICApLFxuICAgICk7XG5cbiAgICBjb25zdCBhZmZlY3RlZEZpbGVzID0gcHJvZmlsZVN5bmMoJ1RTX0ZJTkRfQUZGRUNURUQnLCAoKSA9PlxuICAgICAgZmluZEFmZmVjdGVkRmlsZXModHlwZVNjcmlwdFByb2dyYW0pLFxuICAgICk7XG5cbiAgICB0aGlzLiNzdGF0ZSA9IG5ldyBKaXRDb21waWxhdGlvblN0YXRlKFxuICAgICAgaG9zdCxcbiAgICAgIHR5cGVTY3JpcHRQcm9ncmFtLFxuICAgICAgY29uc3RydWN0b3JQYXJhbWV0ZXJzRG93bmxldmVsVHJhbnNmb3JtKHR5cGVTY3JpcHRQcm9ncmFtLmdldFByb2dyYW0oKSksXG4gICAgICBjcmVhdGVKaXRSZXNvdXJjZVRyYW5zZm9ybWVyKCgpID0+IHR5cGVTY3JpcHRQcm9ncmFtLmdldFByb2dyYW0oKS5nZXRUeXBlQ2hlY2tlcigpKSxcbiAgICApO1xuXG4gICAgcmV0dXJuIHsgYWZmZWN0ZWRGaWxlcywgY29tcGlsZXJPcHRpb25zIH07XG4gIH1cblxuICAqY29sbGVjdERpYWdub3N0aWNzKCk6IEl0ZXJhYmxlPHRzLkRpYWdub3N0aWM+IHtcbiAgICBhc3NlcnQodGhpcy4jc3RhdGUsICdDb21waWxhdGlvbiBtdXN0IGJlIGluaXRpYWxpemVkIHByaW9yIHRvIGNvbGxlY3RpbmcgZGlhZ25vc3RpY3MuJyk7XG4gICAgY29uc3QgeyB0eXBlU2NyaXB0UHJvZ3JhbSB9ID0gdGhpcy4jc3RhdGU7XG5cbiAgICAvLyBDb2xsZWN0IHByb2dyYW0gbGV2ZWwgZGlhZ25vc3RpY3NcbiAgICB5aWVsZCogdHlwZVNjcmlwdFByb2dyYW0uZ2V0Q29uZmlnRmlsZVBhcnNpbmdEaWFnbm9zdGljcygpO1xuICAgIHlpZWxkKiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRPcHRpb25zRGlhZ25vc3RpY3MoKTtcbiAgICB5aWVsZCogdHlwZVNjcmlwdFByb2dyYW0uZ2V0R2xvYmFsRGlhZ25vc3RpY3MoKTtcbiAgICB5aWVsZCogcHJvZmlsZVN5bmMoJ05HX0RJQUdOT1NUSUNTX1NZTlRBQ1RJQycsICgpID0+XG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTeW50YWN0aWNEaWFnbm9zdGljcygpLFxuICAgICk7XG4gICAgeWllbGQqIHByb2ZpbGVTeW5jKCdOR19ESUFHTk9TVElDU19TRU1BTlRJQycsICgpID0+IHR5cGVTY3JpcHRQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3MoKSk7XG4gIH1cblxuICBlbWl0QWZmZWN0ZWRGaWxlcygpOiBJdGVyYWJsZTxFbWl0RmlsZVJlc3VsdD4ge1xuICAgIGFzc2VydCh0aGlzLiNzdGF0ZSwgJ0NvbXBpbGF0aW9uIG11c3QgYmUgaW5pdGlhbGl6ZWQgcHJpb3IgdG8gZW1pdHRpbmcgZmlsZXMuJyk7XG4gICAgY29uc3Qge1xuICAgICAgY29tcGlsZXJIb3N0LFxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0sXG4gICAgICBjb25zdHJ1Y3RvclBhcmFtZXRlcnNEb3dubGV2ZWxUcmFuc2Zvcm0sXG4gICAgICByZXBsYWNlUmVzb3VyY2VzVHJhbnNmb3JtLFxuICAgIH0gPSB0aGlzLiNzdGF0ZTtcbiAgICBjb25zdCBidWlsZEluZm9GaWxlbmFtZSA9XG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRDb21waWxlck9wdGlvbnMoKS50c0J1aWxkSW5mb0ZpbGUgPz8gJy50c2J1aWxkaW5mbyc7XG5cbiAgICBjb25zdCBlbWl0dGVkRmlsZXM6IEVtaXRGaWxlUmVzdWx0W10gPSBbXTtcbiAgICBjb25zdCB3cml0ZUZpbGVDYWxsYmFjazogdHMuV3JpdGVGaWxlQ2FsbGJhY2sgPSAoZmlsZW5hbWUsIGNvbnRlbnRzLCBfYSwgX2IsIHNvdXJjZUZpbGVzKSA9PiB7XG4gICAgICBpZiAoIXNvdXJjZUZpbGVzPy5sZW5ndGggJiYgZmlsZW5hbWUuZW5kc1dpdGgoYnVpbGRJbmZvRmlsZW5hbWUpKSB7XG4gICAgICAgIC8vIFNhdmUgYnVpbGRlciBpbmZvIGNvbnRlbnRzIHRvIHNwZWNpZmllZCBsb2NhdGlvblxuICAgICAgICBjb21waWxlckhvc3Qud3JpdGVGaWxlKGZpbGVuYW1lLCBjb250ZW50cywgZmFsc2UpO1xuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgYXNzZXJ0KHNvdXJjZUZpbGVzPy5sZW5ndGggPT09IDEsICdJbnZhbGlkIFR5cGVTY3JpcHQgcHJvZ3JhbSBlbWl0IGZvciAnICsgZmlsZW5hbWUpO1xuXG4gICAgICBlbWl0dGVkRmlsZXMucHVzaCh7IGZpbGVuYW1lOiBzb3VyY2VGaWxlc1swXS5maWxlTmFtZSwgY29udGVudHMgfSk7XG4gICAgfTtcbiAgICBjb25zdCB0cmFuc2Zvcm1lcnMgPSB7XG4gICAgICBiZWZvcmU6IFtyZXBsYWNlUmVzb3VyY2VzVHJhbnNmb3JtLCBjb25zdHJ1Y3RvclBhcmFtZXRlcnNEb3dubGV2ZWxUcmFuc2Zvcm1dLFxuICAgIH07XG5cbiAgICAvLyBUeXBlU2NyaXB0IHdpbGwgbG9vcCB1bnRpbCB0aGVyZSBhcmUgbm8gbW9yZSBhZmZlY3RlZCBmaWxlcyBpbiB0aGUgcHJvZ3JhbVxuICAgIHdoaWxlIChcbiAgICAgIHR5cGVTY3JpcHRQcm9ncmFtLmVtaXROZXh0QWZmZWN0ZWRGaWxlKHdyaXRlRmlsZUNhbGxiYWNrLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJhbnNmb3JtZXJzKVxuICAgICkge1xuICAgICAgLyogZW1wdHkgKi9cbiAgICB9XG5cbiAgICByZXR1cm4gZW1pdHRlZEZpbGVzO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmRBZmZlY3RlZEZpbGVzKFxuICBidWlsZGVyOiB0cy5FbWl0QW5kU2VtYW50aWNEaWFnbm9zdGljc0J1aWxkZXJQcm9ncmFtLFxuKTogU2V0PHRzLlNvdXJjZUZpbGU+IHtcbiAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IG5ldyBTZXQ8dHMuU291cmNlRmlsZT4oKTtcblxuICBsZXQgcmVzdWx0O1xuICB3aGlsZSAoKHJlc3VsdCA9IGJ1aWxkZXIuZ2V0U2VtYW50aWNEaWFnbm9zdGljc09mTmV4dEFmZmVjdGVkRmlsZSgpKSkge1xuICAgIGFmZmVjdGVkRmlsZXMuYWRkKHJlc3VsdC5hZmZlY3RlZCBhcyB0cy5Tb3VyY2VGaWxlKTtcbiAgfVxuXG4gIHJldHVybiBhZmZlY3RlZEZpbGVzO1xufVxuIl19