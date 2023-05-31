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
var _AotCompilation_state;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AotCompilation = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const typescript_1 = __importDefault(require("typescript"));
const profiling_1 = require("../profiling");
const angular_compilation_1 = require("./angular-compilation");
const angular_host_1 = require("./angular-host");
// Temporary deep import for transformer support
// TODO: Move these to a private exports location or move the implementation into this package.
const { mergeTransformers, createAotTransformers, } = require('@ngtools/webpack/src/ivy/transformation');
class AngularCompilationState {
    constructor(angularProgram, compilerHost, typeScriptProgram, affectedFiles, templateDiagnosticsOptimization, diagnosticCache = new WeakMap()) {
        this.angularProgram = angularProgram;
        this.compilerHost = compilerHost;
        this.typeScriptProgram = typeScriptProgram;
        this.affectedFiles = affectedFiles;
        this.templateDiagnosticsOptimization = templateDiagnosticsOptimization;
        this.diagnosticCache = diagnosticCache;
    }
    get angularCompiler() {
        return this.angularProgram.compiler;
    }
}
class AotCompilation extends angular_compilation_1.AngularCompilation {
    constructor() {
        super(...arguments);
        _AotCompilation_state.set(this, void 0);
    }
    async initialize(tsconfig, hostOptions, compilerOptionsTransformer) {
        // Dynamically load the Angular compiler CLI package
        const { NgtscProgram, OptimizeFor } = await angular_compilation_1.AngularCompilation.loadCompilerCli();
        // Load the compiler configuration and transform as needed
        const { options: originalCompilerOptions, rootNames, errors: configurationDiagnostics, } = await this.loadConfiguration(tsconfig);
        const compilerOptions = compilerOptionsTransformer?.(originalCompilerOptions) ?? originalCompilerOptions;
        // Create Angular compiler host
        const host = (0, angular_host_1.createAngularCompilerHost)(compilerOptions, hostOptions);
        // Create the Angular specific program that contains the Angular compiler
        const angularProgram = (0, profiling_1.profileSync)('NG_CREATE_PROGRAM', () => new NgtscProgram(rootNames, compilerOptions, host, __classPrivateFieldGet(this, _AotCompilation_state, "f")?.angularProgram));
        const angularCompiler = angularProgram.compiler;
        const angularTypeScriptProgram = angularProgram.getTsProgram();
        (0, angular_host_1.ensureSourceFileVersions)(angularTypeScriptProgram);
        let oldProgram = __classPrivateFieldGet(this, _AotCompilation_state, "f")?.typeScriptProgram;
        let usingBuildInfo = false;
        if (!oldProgram) {
            oldProgram = typescript_1.default.readBuilderProgram(compilerOptions, host);
            usingBuildInfo = true;
        }
        const typeScriptProgram = typescript_1.default.createEmitAndSemanticDiagnosticsBuilderProgram(angularTypeScriptProgram, host, oldProgram, configurationDiagnostics);
        await (0, profiling_1.profileAsync)('NG_ANALYZE_PROGRAM', () => angularCompiler.analyzeAsync());
        const affectedFiles = (0, profiling_1.profileSync)('NG_FIND_AFFECTED', () => findAffectedFiles(typeScriptProgram, angularCompiler, usingBuildInfo));
        __classPrivateFieldSet(this, _AotCompilation_state, new AngularCompilationState(angularProgram, host, typeScriptProgram, affectedFiles, affectedFiles.size === 1 ? OptimizeFor.SingleFile : OptimizeFor.WholeProgram, __classPrivateFieldGet(this, _AotCompilation_state, "f")?.diagnosticCache), "f");
        const referencedFiles = typeScriptProgram
            .getSourceFiles()
            .filter((sourceFile) => !angularCompiler.ignoreForEmit.has(sourceFile))
            .map((sourceFile) => sourceFile.fileName);
        return { affectedFiles, compilerOptions, referencedFiles };
    }
    *collectDiagnostics() {
        (0, node_assert_1.default)(__classPrivateFieldGet(this, _AotCompilation_state, "f"), 'Angular compilation must be initialized prior to collecting diagnostics.');
        const { affectedFiles, angularCompiler, diagnosticCache, templateDiagnosticsOptimization, typeScriptProgram, } = __classPrivateFieldGet(this, _AotCompilation_state, "f");
        // Collect program level diagnostics
        yield* typeScriptProgram.getConfigFileParsingDiagnostics();
        yield* angularCompiler.getOptionDiagnostics();
        yield* typeScriptProgram.getOptionsDiagnostics();
        yield* typeScriptProgram.getGlobalDiagnostics();
        // Collect source file specific diagnostics
        for (const sourceFile of typeScriptProgram.getSourceFiles()) {
            if (angularCompiler.ignoreForDiagnostics.has(sourceFile)) {
                continue;
            }
            // TypeScript will use cached diagnostics for files that have not been
            // changed or affected for this build when using incremental building.
            yield* (0, profiling_1.profileSync)('NG_DIAGNOSTICS_SYNTACTIC', () => typeScriptProgram.getSyntacticDiagnostics(sourceFile), true);
            yield* (0, profiling_1.profileSync)('NG_DIAGNOSTICS_SEMANTIC', () => typeScriptProgram.getSemanticDiagnostics(sourceFile), true);
            // Declaration files cannot have template diagnostics
            if (sourceFile.isDeclarationFile) {
                continue;
            }
            // Only request Angular template diagnostics for affected files to avoid
            // overhead of template diagnostics for unchanged files.
            if (affectedFiles.has(sourceFile)) {
                const angularDiagnostics = (0, profiling_1.profileSync)('NG_DIAGNOSTICS_TEMPLATE', () => angularCompiler.getDiagnosticsForFile(sourceFile, templateDiagnosticsOptimization), true);
                diagnosticCache.set(sourceFile, angularDiagnostics);
                yield* angularDiagnostics;
            }
            else {
                const angularDiagnostics = diagnosticCache.get(sourceFile);
                if (angularDiagnostics) {
                    yield* angularDiagnostics;
                }
            }
        }
    }
    emitAffectedFiles() {
        (0, node_assert_1.default)(__classPrivateFieldGet(this, _AotCompilation_state, "f"), 'Angular compilation must be initialized prior to emitting files.');
        const { angularCompiler, compilerHost, typeScriptProgram } = __classPrivateFieldGet(this, _AotCompilation_state, "f");
        const buildInfoFilename = typeScriptProgram.getCompilerOptions().tsBuildInfoFile ?? '.tsbuildinfo';
        const emittedFiles = new Map();
        const writeFileCallback = (filename, contents, _a, _b, sourceFiles) => {
            if (!sourceFiles?.length && filename.endsWith(buildInfoFilename)) {
                // Save builder info contents to specified location
                compilerHost.writeFile(filename, contents, false);
                return;
            }
            (0, node_assert_1.default)(sourceFiles?.length === 1, 'Invalid TypeScript program emit for ' + filename);
            const sourceFile = sourceFiles[0];
            if (angularCompiler.ignoreForEmit.has(sourceFile)) {
                return;
            }
            angularCompiler.incrementalCompilation.recordSuccessfulEmit(sourceFile);
            emittedFiles.set(sourceFile, { filename: sourceFile.fileName, contents });
        };
        const transformers = mergeTransformers(angularCompiler.prepareEmit().transformers, 
        // The default behavior is to replace JIT bootstraping and remove AOT metadata calls
        createAotTransformers(typeScriptProgram, {}));
        // TypeScript will loop until there are no more affected files in the program
        while (typeScriptProgram.emitNextAffectedFile(writeFileCallback, undefined, undefined, transformers)) {
            /* empty */
        }
        // Angular may have files that must be emitted but TypeScript does not consider affected
        for (const sourceFile of typeScriptProgram.getSourceFiles()) {
            if (emittedFiles.has(sourceFile) || angularCompiler.ignoreForEmit.has(sourceFile)) {
                continue;
            }
            if (sourceFile.isDeclarationFile) {
                continue;
            }
            if (angularCompiler.incrementalCompilation.safeToSkipEmit(sourceFile)) {
                continue;
            }
            typeScriptProgram.emit(sourceFile, writeFileCallback, undefined, undefined, transformers);
        }
        return emittedFiles.values();
    }
}
exports.AotCompilation = AotCompilation;
_AotCompilation_state = new WeakMap();
function findAffectedFiles(builder, { ignoreForDiagnostics }, includeTTC) {
    const affectedFiles = new Set();
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const result = builder.getSemanticDiagnosticsOfNextAffectedFile(undefined, (sourceFile) => {
            // If the affected file is a TTC shim, add the shim's original source file.
            // This ensures that changes that affect TTC are typechecked even when the changes
            // are otherwise unrelated from a TS perspective and do not result in Ivy codegen changes.
            // For example, changing @Input property types of a directive used in another component's
            // template.
            // A TTC shim is a file that has been ignored for diagnostics and has a filename ending in `.ngtypecheck.ts`.
            if (ignoreForDiagnostics.has(sourceFile) && sourceFile.fileName.endsWith('.ngtypecheck.ts')) {
                // This file name conversion relies on internal compiler logic and should be converted
                // to an official method when available. 15 is length of `.ngtypecheck.ts`
                const originalFilename = sourceFile.fileName.slice(0, -15) + '.ts';
                const originalSourceFile = builder.getSourceFile(originalFilename);
                if (originalSourceFile) {
                    affectedFiles.add(originalSourceFile);
                }
                return true;
            }
            return false;
        });
        if (!result) {
            break;
        }
        affectedFiles.add(result.affected);
    }
    // Add all files with associated template type checking files.
    // Stored TS build info does not have knowledge of the AOT compiler or the typechecking state of the templates.
    // To ensure that errors are reported correctly, all AOT component diagnostics need to be analyzed even if build
    // info is present.
    if (includeTTC) {
        for (const sourceFile of builder.getSourceFiles()) {
            if (ignoreForDiagnostics.has(sourceFile) && sourceFile.fileName.endsWith('.ngtypecheck.ts')) {
                // This file name conversion relies on internal compiler logic and should be converted
                // to an official method when available. 15 is length of `.ngtypecheck.ts`
                const originalFilename = sourceFile.fileName.slice(0, -15) + '.ts';
                const originalSourceFile = builder.getSourceFile(originalFilename);
                if (originalSourceFile) {
                    affectedFiles.add(originalSourceFile);
                }
            }
        }
    }
    return affectedFiles;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW90LWNvbXBpbGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2FuZ3VsYXIvYW90LWNvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw0REFBNEI7QUFDNUIsNENBQXlEO0FBQ3pELCtEQUEyRTtBQUMzRSxpREFJd0I7QUFFeEIsZ0RBQWdEO0FBQ2hELCtGQUErRjtBQUMvRixNQUFNLEVBQ0osaUJBQWlCLEVBQ2pCLHFCQUFxQixHQUN0QixHQUFHLE9BQU8sQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDO0FBRXZELE1BQU0sdUJBQXVCO0lBQzNCLFlBQ2tCLGNBQStCLEVBQy9CLFlBQTZCLEVBQzdCLGlCQUE4RCxFQUM5RCxhQUF5QyxFQUN6QywrQkFBK0MsRUFDL0Msa0JBQWtCLElBQUksT0FBTyxFQUFrQztRQUwvRCxtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7UUFDL0IsaUJBQVksR0FBWixZQUFZLENBQWlCO1FBQzdCLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBNkM7UUFDOUQsa0JBQWEsR0FBYixhQUFhLENBQTRCO1FBQ3pDLG9DQUErQixHQUEvQiwrQkFBK0IsQ0FBZ0I7UUFDL0Msb0JBQWUsR0FBZixlQUFlLENBQWdEO0lBQzlFLENBQUM7SUFFSixJQUFJLGVBQWU7UUFDakIsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQztJQUN0QyxDQUFDO0NBQ0Y7QUFFRCxNQUFhLGNBQWUsU0FBUSx3Q0FBa0I7SUFBdEQ7O1FBQ0Usd0NBQWlDO0lBMExuQyxDQUFDO0lBeExDLEtBQUssQ0FBQyxVQUFVLENBQ2QsUUFBZ0IsRUFDaEIsV0FBK0IsRUFDL0IsMEJBQXdGO1FBTXhGLG9EQUFvRDtRQUNwRCxNQUFNLEVBQUUsWUFBWSxFQUFFLFdBQVcsRUFBRSxHQUFHLE1BQU0sd0NBQWtCLENBQUMsZUFBZSxFQUFFLENBQUM7UUFFakYsMERBQTBEO1FBQzFELE1BQU0sRUFDSixPQUFPLEVBQUUsdUJBQXVCLEVBQ2hDLFNBQVMsRUFDVCxNQUFNLEVBQUUsd0JBQXdCLEdBQ2pDLEdBQUcsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDM0MsTUFBTSxlQUFlLEdBQ25CLDBCQUEwQixFQUFFLENBQUMsdUJBQXVCLENBQUMsSUFBSSx1QkFBdUIsQ0FBQztRQUVuRiwrQkFBK0I7UUFDL0IsTUFBTSxJQUFJLEdBQUcsSUFBQSx3Q0FBeUIsRUFBQyxlQUFlLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFFckUseUVBQXlFO1FBQ3pFLE1BQU0sY0FBYyxHQUFHLElBQUEsdUJBQVcsRUFDaEMsbUJBQW1CLEVBQ25CLEdBQUcsRUFBRSxDQUFDLElBQUksWUFBWSxDQUFDLFNBQVMsRUFBRSxlQUFlLEVBQUUsSUFBSSxFQUFFLHVCQUFBLElBQUksNkJBQU8sRUFBRSxjQUFjLENBQUMsQ0FDdEYsQ0FBQztRQUNGLE1BQU0sZUFBZSxHQUFHLGNBQWMsQ0FBQyxRQUFRLENBQUM7UUFDaEQsTUFBTSx3QkFBd0IsR0FBRyxjQUFjLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDL0QsSUFBQSx1Q0FBd0IsRUFBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBRW5ELElBQUksVUFBVSxHQUFHLHVCQUFBLElBQUksNkJBQU8sRUFBRSxpQkFBaUIsQ0FBQztRQUNoRCxJQUFJLGNBQWMsR0FBRyxLQUFLLENBQUM7UUFDM0IsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNmLFVBQVUsR0FBRyxvQkFBRSxDQUFDLGtCQUFrQixDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUMxRCxjQUFjLEdBQUcsSUFBSSxDQUFDO1NBQ3ZCO1FBRUQsTUFBTSxpQkFBaUIsR0FBRyxvQkFBRSxDQUFDLDhDQUE4QyxDQUN6RSx3QkFBd0IsRUFDeEIsSUFBSSxFQUNKLFVBQVUsRUFDVix3QkFBd0IsQ0FDekIsQ0FBQztRQUVGLE1BQU0sSUFBQSx3QkFBWSxFQUFDLG9CQUFvQixFQUFFLEdBQUcsRUFBRSxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO1FBQy9FLE1BQU0sYUFBYSxHQUFHLElBQUEsdUJBQVcsRUFBQyxrQkFBa0IsRUFBRSxHQUFHLEVBQUUsQ0FDekQsaUJBQWlCLENBQUMsaUJBQWlCLEVBQUUsZUFBZSxFQUFFLGNBQWMsQ0FBQyxDQUN0RSxDQUFDO1FBRUYsdUJBQUEsSUFBSSx5QkFBVSxJQUFJLHVCQUF1QixDQUN2QyxjQUFjLEVBQ2QsSUFBSSxFQUNKLGlCQUFpQixFQUNqQixhQUFhLEVBQ2IsYUFBYSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxZQUFZLEVBQzVFLHVCQUFBLElBQUksNkJBQU8sRUFBRSxlQUFlLENBQzdCLE1BQUEsQ0FBQztRQUVGLE1BQU0sZUFBZSxHQUFHLGlCQUFpQjthQUN0QyxjQUFjLEVBQUU7YUFDaEIsTUFBTSxDQUFDLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2FBQ3RFLEdBQUcsQ0FBQyxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRTVDLE9BQU8sRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBRSxDQUFDO0lBQzdELENBQUM7SUFFRCxDQUFDLGtCQUFrQjtRQUNqQixJQUFBLHFCQUFNLEVBQUMsdUJBQUEsSUFBSSw2QkFBTyxFQUFFLDBFQUEwRSxDQUFDLENBQUM7UUFDaEcsTUFBTSxFQUNKLGFBQWEsRUFDYixlQUFlLEVBQ2YsZUFBZSxFQUNmLCtCQUErQixFQUMvQixpQkFBaUIsR0FDbEIsR0FBRyx1QkFBQSxJQUFJLDZCQUFPLENBQUM7UUFFaEIsb0NBQW9DO1FBQ3BDLEtBQUssQ0FBQyxDQUFDLGlCQUFpQixDQUFDLCtCQUErQixFQUFFLENBQUM7UUFDM0QsS0FBSyxDQUFDLENBQUMsZUFBZSxDQUFDLG9CQUFvQixFQUFFLENBQUM7UUFDOUMsS0FBSyxDQUFDLENBQUMsaUJBQWlCLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUNqRCxLQUFLLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1FBRWhELDJDQUEyQztRQUMzQyxLQUFLLE1BQU0sVUFBVSxJQUFJLGlCQUFpQixDQUFDLGNBQWMsRUFBRSxFQUFFO1lBQzNELElBQUksZUFBZSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDeEQsU0FBUzthQUNWO1lBRUQsc0VBQXNFO1lBQ3RFLHNFQUFzRTtZQUN0RSxLQUFLLENBQUMsQ0FBQyxJQUFBLHVCQUFXLEVBQ2hCLDBCQUEwQixFQUMxQixHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyx1QkFBdUIsQ0FBQyxVQUFVLENBQUMsRUFDM0QsSUFBSSxDQUNMLENBQUM7WUFDRixLQUFLLENBQUMsQ0FBQyxJQUFBLHVCQUFXLEVBQ2hCLHlCQUF5QixFQUN6QixHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxzQkFBc0IsQ0FBQyxVQUFVLENBQUMsRUFDMUQsSUFBSSxDQUNMLENBQUM7WUFFRixxREFBcUQ7WUFDckQsSUFBSSxVQUFVLENBQUMsaUJBQWlCLEVBQUU7Z0JBQ2hDLFNBQVM7YUFDVjtZQUVELHdFQUF3RTtZQUN4RSx3REFBd0Q7WUFDeEQsSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO2dCQUNqQyxNQUFNLGtCQUFrQixHQUFHLElBQUEsdUJBQVcsRUFDcEMseUJBQXlCLEVBQ3pCLEdBQUcsRUFBRSxDQUFDLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBQyxVQUFVLEVBQUUsK0JBQStCLENBQUMsRUFDeEYsSUFBSSxDQUNMLENBQUM7Z0JBQ0YsZUFBZSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztnQkFDcEQsS0FBSyxDQUFDLENBQUMsa0JBQWtCLENBQUM7YUFDM0I7aUJBQU07Z0JBQ0wsTUFBTSxrQkFBa0IsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUMzRCxJQUFJLGtCQUFrQixFQUFFO29CQUN0QixLQUFLLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQztpQkFDM0I7YUFDRjtTQUNGO0lBQ0gsQ0FBQztJQUVELGlCQUFpQjtRQUNmLElBQUEscUJBQU0sRUFBQyx1QkFBQSxJQUFJLDZCQUFPLEVBQUUsa0VBQWtFLENBQUMsQ0FBQztRQUN4RixNQUFNLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxpQkFBaUIsRUFBRSxHQUFHLHVCQUFBLElBQUksNkJBQU8sQ0FBQztRQUN6RSxNQUFNLGlCQUFpQixHQUNyQixpQkFBaUIsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLGVBQWUsSUFBSSxjQUFjLENBQUM7UUFFM0UsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQWlDLENBQUM7UUFDOUQsTUFBTSxpQkFBaUIsR0FBeUIsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLEVBQUU7WUFDMUYsSUFBSSxDQUFDLFdBQVcsRUFBRSxNQUFNLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO2dCQUNoRSxtREFBbUQ7Z0JBQ25ELFlBQVksQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFFbEQsT0FBTzthQUNSO1lBRUQsSUFBQSxxQkFBTSxFQUFDLFdBQVcsRUFBRSxNQUFNLEtBQUssQ0FBQyxFQUFFLHNDQUFzQyxHQUFHLFFBQVEsQ0FBQyxDQUFDO1lBQ3JGLE1BQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNsQyxJQUFJLGVBQWUsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO2dCQUNqRCxPQUFPO2FBQ1I7WUFFRCxlQUFlLENBQUMsc0JBQXNCLENBQUMsb0JBQW9CLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDeEUsWUFBWSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQzVFLENBQUMsQ0FBQztRQUNGLE1BQU0sWUFBWSxHQUFHLGlCQUFpQixDQUNwQyxlQUFlLENBQUMsV0FBVyxFQUFFLENBQUMsWUFBWTtRQUMxQyxvRkFBb0Y7UUFDcEYscUJBQXFCLENBQUMsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLENBQzdDLENBQUM7UUFFRiw2RUFBNkU7UUFDN0UsT0FDRSxpQkFBaUIsQ0FBQyxvQkFBb0IsQ0FBQyxpQkFBaUIsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFlBQVksQ0FBQyxFQUM3RjtZQUNBLFdBQVc7U0FDWjtRQUVELHdGQUF3RjtRQUN4RixLQUFLLE1BQU0sVUFBVSxJQUFJLGlCQUFpQixDQUFDLGNBQWMsRUFBRSxFQUFFO1lBQzNELElBQUksWUFBWSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxlQUFlLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDakYsU0FBUzthQUNWO1lBRUQsSUFBSSxVQUFVLENBQUMsaUJBQWlCLEVBQUU7Z0JBQ2hDLFNBQVM7YUFDVjtZQUVELElBQUksZUFBZSxDQUFDLHNCQUFzQixDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDckUsU0FBUzthQUNWO1lBRUQsaUJBQWlCLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFlBQVksQ0FBQyxDQUFDO1NBQzNGO1FBRUQsT0FBTyxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDL0IsQ0FBQztDQUNGO0FBM0xELHdDQTJMQzs7QUFFRCxTQUFTLGlCQUFpQixDQUN4QixPQUFvRCxFQUNwRCxFQUFFLG9CQUFvQixFQUErQixFQUNyRCxVQUFtQjtJQUVuQixNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsRUFBaUIsQ0FBQztJQUUvQyxpREFBaUQ7SUFDakQsT0FBTyxJQUFJLEVBQUU7UUFDWCxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsd0NBQXdDLENBQUMsU0FBUyxFQUFFLENBQUMsVUFBVSxFQUFFLEVBQUU7WUFDeEYsMkVBQTJFO1lBQzNFLGtGQUFrRjtZQUNsRiwwRkFBMEY7WUFDMUYseUZBQXlGO1lBQ3pGLFlBQVk7WUFDWiw2R0FBNkc7WUFDN0csSUFBSSxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksVUFBVSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUMsRUFBRTtnQkFDM0Ysc0ZBQXNGO2dCQUN0RiwwRUFBMEU7Z0JBQzFFLE1BQU0sZ0JBQWdCLEdBQUcsVUFBVSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDO2dCQUNuRSxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztnQkFDbkUsSUFBSSxrQkFBa0IsRUFBRTtvQkFDdEIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO2lCQUN2QztnQkFFRCxPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDWCxNQUFNO1NBQ1A7UUFFRCxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUF5QixDQUFDLENBQUM7S0FDckQ7SUFFRCw4REFBOEQ7SUFDOUQsK0dBQStHO0lBQy9HLGdIQUFnSDtJQUNoSCxtQkFBbUI7SUFDbkIsSUFBSSxVQUFVLEVBQUU7UUFDZCxLQUFLLE1BQU0sVUFBVSxJQUFJLE9BQU8sQ0FBQyxjQUFjLEVBQUUsRUFBRTtZQUNqRCxJQUFJLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxVQUFVLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO2dCQUMzRixzRkFBc0Y7Z0JBQ3RGLDBFQUEwRTtnQkFDMUUsTUFBTSxnQkFBZ0IsR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUM7Z0JBQ25FLE1BQU0sa0JBQWtCLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO2dCQUNuRSxJQUFJLGtCQUFrQixFQUFFO29CQUN0QixhQUFhLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7aUJBQ3ZDO2FBQ0Y7U0FDRjtLQUNGO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBwcm9maWxlQXN5bmMsIHByb2ZpbGVTeW5jIH0gZnJvbSAnLi4vcHJvZmlsaW5nJztcbmltcG9ydCB7IEFuZ3VsYXJDb21waWxhdGlvbiwgRW1pdEZpbGVSZXN1bHQgfSBmcm9tICcuL2FuZ3VsYXItY29tcGlsYXRpb24nO1xuaW1wb3J0IHtcbiAgQW5ndWxhckhvc3RPcHRpb25zLFxuICBjcmVhdGVBbmd1bGFyQ29tcGlsZXJIb3N0LFxuICBlbnN1cmVTb3VyY2VGaWxlVmVyc2lvbnMsXG59IGZyb20gJy4vYW5ndWxhci1ob3N0JztcblxuLy8gVGVtcG9yYXJ5IGRlZXAgaW1wb3J0IGZvciB0cmFuc2Zvcm1lciBzdXBwb3J0XG4vLyBUT0RPOiBNb3ZlIHRoZXNlIHRvIGEgcHJpdmF0ZSBleHBvcnRzIGxvY2F0aW9uIG9yIG1vdmUgdGhlIGltcGxlbWVudGF0aW9uIGludG8gdGhpcyBwYWNrYWdlLlxuY29uc3Qge1xuICBtZXJnZVRyYW5zZm9ybWVycyxcbiAgY3JlYXRlQW90VHJhbnNmb3JtZXJzLFxufSA9IHJlcXVpcmUoJ0BuZ3Rvb2xzL3dlYnBhY2svc3JjL2l2eS90cmFuc2Zvcm1hdGlvbicpO1xuXG5jbGFzcyBBbmd1bGFyQ29tcGlsYXRpb25TdGF0ZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyByZWFkb25seSBhbmd1bGFyUHJvZ3JhbTogbmcuTmd0c2NQcm9ncmFtLFxuICAgIHB1YmxpYyByZWFkb25seSBjb21waWxlckhvc3Q6IG5nLkNvbXBpbGVySG9zdCxcbiAgICBwdWJsaWMgcmVhZG9ubHkgdHlwZVNjcmlwdFByb2dyYW06IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0sXG4gICAgcHVibGljIHJlYWRvbmx5IGFmZmVjdGVkRmlsZXM6IFJlYWRvbmx5U2V0PHRzLlNvdXJjZUZpbGU+LFxuICAgIHB1YmxpYyByZWFkb25seSB0ZW1wbGF0ZURpYWdub3N0aWNzT3B0aW1pemF0aW9uOiBuZy5PcHRpbWl6ZUZvcixcbiAgICBwdWJsaWMgcmVhZG9ubHkgZGlhZ25vc3RpY0NhY2hlID0gbmV3IFdlYWtNYXA8dHMuU291cmNlRmlsZSwgdHMuRGlhZ25vc3RpY1tdPigpLFxuICApIHt9XG5cbiAgZ2V0IGFuZ3VsYXJDb21waWxlcigpIHtcbiAgICByZXR1cm4gdGhpcy5hbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQW90Q29tcGlsYXRpb24gZXh0ZW5kcyBBbmd1bGFyQ29tcGlsYXRpb24ge1xuICAjc3RhdGU/OiBBbmd1bGFyQ29tcGlsYXRpb25TdGF0ZTtcblxuICBhc3luYyBpbml0aWFsaXplKFxuICAgIHRzY29uZmlnOiBzdHJpbmcsXG4gICAgaG9zdE9wdGlvbnM6IEFuZ3VsYXJIb3N0T3B0aW9ucyxcbiAgICBjb21waWxlck9wdGlvbnNUcmFuc2Zvcm1lcj86IChjb21waWxlck9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucykgPT4gbmcuQ29tcGlsZXJPcHRpb25zLFxuICApOiBQcm9taXNlPHtcbiAgICBhZmZlY3RlZEZpbGVzOiBSZWFkb25seVNldDx0cy5Tb3VyY2VGaWxlPjtcbiAgICBjb21waWxlck9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucztcbiAgICByZWZlcmVuY2VkRmlsZXM6IHJlYWRvbmx5IHN0cmluZ1tdO1xuICB9PiB7XG4gICAgLy8gRHluYW1pY2FsbHkgbG9hZCB0aGUgQW5ndWxhciBjb21waWxlciBDTEkgcGFja2FnZVxuICAgIGNvbnN0IHsgTmd0c2NQcm9ncmFtLCBPcHRpbWl6ZUZvciB9ID0gYXdhaXQgQW5ndWxhckNvbXBpbGF0aW9uLmxvYWRDb21waWxlckNsaSgpO1xuXG4gICAgLy8gTG9hZCB0aGUgY29tcGlsZXIgY29uZmlndXJhdGlvbiBhbmQgdHJhbnNmb3JtIGFzIG5lZWRlZFxuICAgIGNvbnN0IHtcbiAgICAgIG9wdGlvbnM6IG9yaWdpbmFsQ29tcGlsZXJPcHRpb25zLFxuICAgICAgcm9vdE5hbWVzLFxuICAgICAgZXJyb3JzOiBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3MsXG4gICAgfSA9IGF3YWl0IHRoaXMubG9hZENvbmZpZ3VyYXRpb24odHNjb25maWcpO1xuICAgIGNvbnN0IGNvbXBpbGVyT3B0aW9ucyA9XG4gICAgICBjb21waWxlck9wdGlvbnNUcmFuc2Zvcm1lcj8uKG9yaWdpbmFsQ29tcGlsZXJPcHRpb25zKSA/PyBvcmlnaW5hbENvbXBpbGVyT3B0aW9ucztcblxuICAgIC8vIENyZWF0ZSBBbmd1bGFyIGNvbXBpbGVyIGhvc3RcbiAgICBjb25zdCBob3N0ID0gY3JlYXRlQW5ndWxhckNvbXBpbGVySG9zdChjb21waWxlck9wdGlvbnMsIGhvc3RPcHRpb25zKTtcblxuICAgIC8vIENyZWF0ZSB0aGUgQW5ndWxhciBzcGVjaWZpYyBwcm9ncmFtIHRoYXQgY29udGFpbnMgdGhlIEFuZ3VsYXIgY29tcGlsZXJcbiAgICBjb25zdCBhbmd1bGFyUHJvZ3JhbSA9IHByb2ZpbGVTeW5jKFxuICAgICAgJ05HX0NSRUFURV9QUk9HUkFNJyxcbiAgICAgICgpID0+IG5ldyBOZ3RzY1Byb2dyYW0ocm9vdE5hbWVzLCBjb21waWxlck9wdGlvbnMsIGhvc3QsIHRoaXMuI3N0YXRlPy5hbmd1bGFyUHJvZ3JhbSksXG4gICAgKTtcbiAgICBjb25zdCBhbmd1bGFyQ29tcGlsZXIgPSBhbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgICBjb25zdCBhbmd1bGFyVHlwZVNjcmlwdFByb2dyYW0gPSBhbmd1bGFyUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKTtcbiAgICBlbnN1cmVTb3VyY2VGaWxlVmVyc2lvbnMoYW5ndWxhclR5cGVTY3JpcHRQcm9ncmFtKTtcblxuICAgIGxldCBvbGRQcm9ncmFtID0gdGhpcy4jc3RhdGU/LnR5cGVTY3JpcHRQcm9ncmFtO1xuICAgIGxldCB1c2luZ0J1aWxkSW5mbyA9IGZhbHNlO1xuICAgIGlmICghb2xkUHJvZ3JhbSkge1xuICAgICAgb2xkUHJvZ3JhbSA9IHRzLnJlYWRCdWlsZGVyUHJvZ3JhbShjb21waWxlck9wdGlvbnMsIGhvc3QpO1xuICAgICAgdXNpbmdCdWlsZEluZm8gPSB0cnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHR5cGVTY3JpcHRQcm9ncmFtID0gdHMuY3JlYXRlRW1pdEFuZFNlbWFudGljRGlhZ25vc3RpY3NCdWlsZGVyUHJvZ3JhbShcbiAgICAgIGFuZ3VsYXJUeXBlU2NyaXB0UHJvZ3JhbSxcbiAgICAgIGhvc3QsXG4gICAgICBvbGRQcm9ncmFtLFxuICAgICAgY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgICk7XG5cbiAgICBhd2FpdCBwcm9maWxlQXN5bmMoJ05HX0FOQUxZWkVfUFJPR1JBTScsICgpID0+IGFuZ3VsYXJDb21waWxlci5hbmFseXplQXN5bmMoKSk7XG4gICAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IHByb2ZpbGVTeW5jKCdOR19GSU5EX0FGRkVDVEVEJywgKCkgPT5cbiAgICAgIGZpbmRBZmZlY3RlZEZpbGVzKHR5cGVTY3JpcHRQcm9ncmFtLCBhbmd1bGFyQ29tcGlsZXIsIHVzaW5nQnVpbGRJbmZvKSxcbiAgICApO1xuXG4gICAgdGhpcy4jc3RhdGUgPSBuZXcgQW5ndWxhckNvbXBpbGF0aW9uU3RhdGUoXG4gICAgICBhbmd1bGFyUHJvZ3JhbSxcbiAgICAgIGhvc3QsXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbSxcbiAgICAgIGFmZmVjdGVkRmlsZXMsXG4gICAgICBhZmZlY3RlZEZpbGVzLnNpemUgPT09IDEgPyBPcHRpbWl6ZUZvci5TaW5nbGVGaWxlIDogT3B0aW1pemVGb3IuV2hvbGVQcm9ncmFtLFxuICAgICAgdGhpcy4jc3RhdGU/LmRpYWdub3N0aWNDYWNoZSxcbiAgICApO1xuXG4gICAgY29uc3QgcmVmZXJlbmNlZEZpbGVzID0gdHlwZVNjcmlwdFByb2dyYW1cbiAgICAgIC5nZXRTb3VyY2VGaWxlcygpXG4gICAgICAuZmlsdGVyKChzb3VyY2VGaWxlKSA9PiAhYW5ndWxhckNvbXBpbGVyLmlnbm9yZUZvckVtaXQuaGFzKHNvdXJjZUZpbGUpKVxuICAgICAgLm1hcCgoc291cmNlRmlsZSkgPT4gc291cmNlRmlsZS5maWxlTmFtZSk7XG5cbiAgICByZXR1cm4geyBhZmZlY3RlZEZpbGVzLCBjb21waWxlck9wdGlvbnMsIHJlZmVyZW5jZWRGaWxlcyB9O1xuICB9XG5cbiAgKmNvbGxlY3REaWFnbm9zdGljcygpOiBJdGVyYWJsZTx0cy5EaWFnbm9zdGljPiB7XG4gICAgYXNzZXJ0KHRoaXMuI3N0YXRlLCAnQW5ndWxhciBjb21waWxhdGlvbiBtdXN0IGJlIGluaXRpYWxpemVkIHByaW9yIHRvIGNvbGxlY3RpbmcgZGlhZ25vc3RpY3MuJyk7XG4gICAgY29uc3Qge1xuICAgICAgYWZmZWN0ZWRGaWxlcyxcbiAgICAgIGFuZ3VsYXJDb21waWxlcixcbiAgICAgIGRpYWdub3N0aWNDYWNoZSxcbiAgICAgIHRlbXBsYXRlRGlhZ25vc3RpY3NPcHRpbWl6YXRpb24sXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbSxcbiAgICB9ID0gdGhpcy4jc3RhdGU7XG5cbiAgICAvLyBDb2xsZWN0IHByb2dyYW0gbGV2ZWwgZGlhZ25vc3RpY3NcbiAgICB5aWVsZCogdHlwZVNjcmlwdFByb2dyYW0uZ2V0Q29uZmlnRmlsZVBhcnNpbmdEaWFnbm9zdGljcygpO1xuICAgIHlpZWxkKiBhbmd1bGFyQ29tcGlsZXIuZ2V0T3B0aW9uRGlhZ25vc3RpY3MoKTtcbiAgICB5aWVsZCogdHlwZVNjcmlwdFByb2dyYW0uZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCk7XG4gICAgeWllbGQqIHR5cGVTY3JpcHRQcm9ncmFtLmdldEdsb2JhbERpYWdub3N0aWNzKCk7XG5cbiAgICAvLyBDb2xsZWN0IHNvdXJjZSBmaWxlIHNwZWNpZmljIGRpYWdub3N0aWNzXG4gICAgZm9yIChjb25zdCBzb3VyY2VGaWxlIG9mIHR5cGVTY3JpcHRQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgIGlmIChhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBUeXBlU2NyaXB0IHdpbGwgdXNlIGNhY2hlZCBkaWFnbm9zdGljcyBmb3IgZmlsZXMgdGhhdCBoYXZlIG5vdCBiZWVuXG4gICAgICAvLyBjaGFuZ2VkIG9yIGFmZmVjdGVkIGZvciB0aGlzIGJ1aWxkIHdoZW4gdXNpbmcgaW5jcmVtZW50YWwgYnVpbGRpbmcuXG4gICAgICB5aWVsZCogcHJvZmlsZVN5bmMoXG4gICAgICAgICdOR19ESUFHTk9TVElDU19TWU5UQUNUSUMnLFxuICAgICAgICAoKSA9PiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlKSxcbiAgICAgICAgdHJ1ZSxcbiAgICAgICk7XG4gICAgICB5aWVsZCogcHJvZmlsZVN5bmMoXG4gICAgICAgICdOR19ESUFHTk9TVElDU19TRU1BTlRJQycsXG4gICAgICAgICgpID0+IHR5cGVTY3JpcHRQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc291cmNlRmlsZSksXG4gICAgICAgIHRydWUsXG4gICAgICApO1xuXG4gICAgICAvLyBEZWNsYXJhdGlvbiBmaWxlcyBjYW5ub3QgaGF2ZSB0ZW1wbGF0ZSBkaWFnbm9zdGljc1xuICAgICAgaWYgKHNvdXJjZUZpbGUuaXNEZWNsYXJhdGlvbkZpbGUpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIE9ubHkgcmVxdWVzdCBBbmd1bGFyIHRlbXBsYXRlIGRpYWdub3N0aWNzIGZvciBhZmZlY3RlZCBmaWxlcyB0byBhdm9pZFxuICAgICAgLy8gb3ZlcmhlYWQgb2YgdGVtcGxhdGUgZGlhZ25vc3RpY3MgZm9yIHVuY2hhbmdlZCBmaWxlcy5cbiAgICAgIGlmIChhZmZlY3RlZEZpbGVzLmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgICBjb25zdCBhbmd1bGFyRGlhZ25vc3RpY3MgPSBwcm9maWxlU3luYyhcbiAgICAgICAgICAnTkdfRElBR05PU1RJQ1NfVEVNUExBVEUnLFxuICAgICAgICAgICgpID0+IGFuZ3VsYXJDb21waWxlci5nZXREaWFnbm9zdGljc0ZvckZpbGUoc291cmNlRmlsZSwgdGVtcGxhdGVEaWFnbm9zdGljc09wdGltaXphdGlvbiksXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKTtcbiAgICAgICAgZGlhZ25vc3RpY0NhY2hlLnNldChzb3VyY2VGaWxlLCBhbmd1bGFyRGlhZ25vc3RpY3MpO1xuICAgICAgICB5aWVsZCogYW5ndWxhckRpYWdub3N0aWNzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gZGlhZ25vc3RpY0NhY2hlLmdldChzb3VyY2VGaWxlKTtcbiAgICAgICAgaWYgKGFuZ3VsYXJEaWFnbm9zdGljcykge1xuICAgICAgICAgIHlpZWxkKiBhbmd1bGFyRGlhZ25vc3RpY3M7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBlbWl0QWZmZWN0ZWRGaWxlcygpOiBJdGVyYWJsZTxFbWl0RmlsZVJlc3VsdD4ge1xuICAgIGFzc2VydCh0aGlzLiNzdGF0ZSwgJ0FuZ3VsYXIgY29tcGlsYXRpb24gbXVzdCBiZSBpbml0aWFsaXplZCBwcmlvciB0byBlbWl0dGluZyBmaWxlcy4nKTtcbiAgICBjb25zdCB7IGFuZ3VsYXJDb21waWxlciwgY29tcGlsZXJIb3N0LCB0eXBlU2NyaXB0UHJvZ3JhbSB9ID0gdGhpcy4jc3RhdGU7XG4gICAgY29uc3QgYnVpbGRJbmZvRmlsZW5hbWUgPVxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0uZ2V0Q29tcGlsZXJPcHRpb25zKCkudHNCdWlsZEluZm9GaWxlID8/ICcudHNidWlsZGluZm8nO1xuXG4gICAgY29uc3QgZW1pdHRlZEZpbGVzID0gbmV3IE1hcDx0cy5Tb3VyY2VGaWxlLCBFbWl0RmlsZVJlc3VsdD4oKTtcbiAgICBjb25zdCB3cml0ZUZpbGVDYWxsYmFjazogdHMuV3JpdGVGaWxlQ2FsbGJhY2sgPSAoZmlsZW5hbWUsIGNvbnRlbnRzLCBfYSwgX2IsIHNvdXJjZUZpbGVzKSA9PiB7XG4gICAgICBpZiAoIXNvdXJjZUZpbGVzPy5sZW5ndGggJiYgZmlsZW5hbWUuZW5kc1dpdGgoYnVpbGRJbmZvRmlsZW5hbWUpKSB7XG4gICAgICAgIC8vIFNhdmUgYnVpbGRlciBpbmZvIGNvbnRlbnRzIHRvIHNwZWNpZmllZCBsb2NhdGlvblxuICAgICAgICBjb21waWxlckhvc3Qud3JpdGVGaWxlKGZpbGVuYW1lLCBjb250ZW50cywgZmFsc2UpO1xuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgYXNzZXJ0KHNvdXJjZUZpbGVzPy5sZW5ndGggPT09IDEsICdJbnZhbGlkIFR5cGVTY3JpcHQgcHJvZ3JhbSBlbWl0IGZvciAnICsgZmlsZW5hbWUpO1xuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IHNvdXJjZUZpbGVzWzBdO1xuICAgICAgaWYgKGFuZ3VsYXJDb21waWxlci5pZ25vcmVGb3JFbWl0Lmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlci5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLnJlY29yZFN1Y2Nlc3NmdWxFbWl0KHNvdXJjZUZpbGUpO1xuICAgICAgZW1pdHRlZEZpbGVzLnNldChzb3VyY2VGaWxlLCB7IGZpbGVuYW1lOiBzb3VyY2VGaWxlLmZpbGVOYW1lLCBjb250ZW50cyB9KTtcbiAgICB9O1xuICAgIGNvbnN0IHRyYW5zZm9ybWVycyA9IG1lcmdlVHJhbnNmb3JtZXJzKFxuICAgICAgYW5ndWxhckNvbXBpbGVyLnByZXBhcmVFbWl0KCkudHJhbnNmb3JtZXJzLFxuICAgICAgLy8gVGhlIGRlZmF1bHQgYmVoYXZpb3IgaXMgdG8gcmVwbGFjZSBKSVQgYm9vdHN0cmFwaW5nIGFuZCByZW1vdmUgQU9UIG1ldGFkYXRhIGNhbGxzXG4gICAgICBjcmVhdGVBb3RUcmFuc2Zvcm1lcnModHlwZVNjcmlwdFByb2dyYW0sIHt9KSxcbiAgICApO1xuXG4gICAgLy8gVHlwZVNjcmlwdCB3aWxsIGxvb3AgdW50aWwgdGhlcmUgYXJlIG5vIG1vcmUgYWZmZWN0ZWQgZmlsZXMgaW4gdGhlIHByb2dyYW1cbiAgICB3aGlsZSAoXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbS5lbWl0TmV4dEFmZmVjdGVkRmlsZSh3cml0ZUZpbGVDYWxsYmFjaywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRyYW5zZm9ybWVycylcbiAgICApIHtcbiAgICAgIC8qIGVtcHR5ICovXG4gICAgfVxuXG4gICAgLy8gQW5ndWxhciBtYXkgaGF2ZSBmaWxlcyB0aGF0IG11c3QgYmUgZW1pdHRlZCBidXQgVHlwZVNjcmlwdCBkb2VzIG5vdCBjb25zaWRlciBhZmZlY3RlZFxuICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICBpZiAoZW1pdHRlZEZpbGVzLmhhcyhzb3VyY2VGaWxlKSB8fCBhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRW1pdC5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChzb3VyY2VGaWxlLmlzRGVjbGFyYXRpb25GaWxlKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoYW5ndWxhckNvbXBpbGVyLmluY3JlbWVudGFsQ29tcGlsYXRpb24uc2FmZVRvU2tpcEVtaXQoc291cmNlRmlsZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHR5cGVTY3JpcHRQcm9ncmFtLmVtaXQoc291cmNlRmlsZSwgd3JpdGVGaWxlQ2FsbGJhY2ssIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cmFuc2Zvcm1lcnMpO1xuICAgIH1cblxuICAgIHJldHVybiBlbWl0dGVkRmlsZXMudmFsdWVzKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZEFmZmVjdGVkRmlsZXMoXG4gIGJ1aWxkZXI6IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0sXG4gIHsgaWdub3JlRm9yRGlhZ25vc3RpY3MgfTogbmcuTmd0c2NQcm9ncmFtWydjb21waWxlciddLFxuICBpbmNsdWRlVFRDOiBib29sZWFuLFxuKTogU2V0PHRzLlNvdXJjZUZpbGU+IHtcbiAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IG5ldyBTZXQ8dHMuU291cmNlRmlsZT4oKTtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYnVpbGRlci5nZXRTZW1hbnRpY0RpYWdub3N0aWNzT2ZOZXh0QWZmZWN0ZWRGaWxlKHVuZGVmaW5lZCwgKHNvdXJjZUZpbGUpID0+IHtcbiAgICAgIC8vIElmIHRoZSBhZmZlY3RlZCBmaWxlIGlzIGEgVFRDIHNoaW0sIGFkZCB0aGUgc2hpbSdzIG9yaWdpbmFsIHNvdXJjZSBmaWxlLlxuICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoYXQgY2hhbmdlcyB0aGF0IGFmZmVjdCBUVEMgYXJlIHR5cGVjaGVja2VkIGV2ZW4gd2hlbiB0aGUgY2hhbmdlc1xuICAgICAgLy8gYXJlIG90aGVyd2lzZSB1bnJlbGF0ZWQgZnJvbSBhIFRTIHBlcnNwZWN0aXZlIGFuZCBkbyBub3QgcmVzdWx0IGluIEl2eSBjb2RlZ2VuIGNoYW5nZXMuXG4gICAgICAvLyBGb3IgZXhhbXBsZSwgY2hhbmdpbmcgQElucHV0IHByb3BlcnR5IHR5cGVzIG9mIGEgZGlyZWN0aXZlIHVzZWQgaW4gYW5vdGhlciBjb21wb25lbnQnc1xuICAgICAgLy8gdGVtcGxhdGUuXG4gICAgICAvLyBBIFRUQyBzaGltIGlzIGEgZmlsZSB0aGF0IGhhcyBiZWVuIGlnbm9yZWQgZm9yIGRpYWdub3N0aWNzIGFuZCBoYXMgYSBmaWxlbmFtZSBlbmRpbmcgaW4gYC5uZ3R5cGVjaGVjay50c2AuXG4gICAgICBpZiAoaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpICYmIHNvdXJjZUZpbGUuZmlsZU5hbWUuZW5kc1dpdGgoJy5uZ3R5cGVjaGVjay50cycpKSB7XG4gICAgICAgIC8vIFRoaXMgZmlsZSBuYW1lIGNvbnZlcnNpb24gcmVsaWVzIG9uIGludGVybmFsIGNvbXBpbGVyIGxvZ2ljIGFuZCBzaG91bGQgYmUgY29udmVydGVkXG4gICAgICAgIC8vIHRvIGFuIG9mZmljaWFsIG1ldGhvZCB3aGVuIGF2YWlsYWJsZS4gMTUgaXMgbGVuZ3RoIG9mIGAubmd0eXBlY2hlY2sudHNgXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsRmlsZW5hbWUgPSBzb3VyY2VGaWxlLmZpbGVOYW1lLnNsaWNlKDAsIC0xNSkgKyAnLnRzJztcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxTb3VyY2VGaWxlID0gYnVpbGRlci5nZXRTb3VyY2VGaWxlKG9yaWdpbmFsRmlsZW5hbWUpO1xuICAgICAgICBpZiAob3JpZ2luYWxTb3VyY2VGaWxlKSB7XG4gICAgICAgICAgYWZmZWN0ZWRGaWxlcy5hZGQob3JpZ2luYWxTb3VyY2VGaWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgYWZmZWN0ZWRGaWxlcy5hZGQocmVzdWx0LmFmZmVjdGVkIGFzIHRzLlNvdXJjZUZpbGUpO1xuICB9XG5cbiAgLy8gQWRkIGFsbCBmaWxlcyB3aXRoIGFzc29jaWF0ZWQgdGVtcGxhdGUgdHlwZSBjaGVja2luZyBmaWxlcy5cbiAgLy8gU3RvcmVkIFRTIGJ1aWxkIGluZm8gZG9lcyBub3QgaGF2ZSBrbm93bGVkZ2Ugb2YgdGhlIEFPVCBjb21waWxlciBvciB0aGUgdHlwZWNoZWNraW5nIHN0YXRlIG9mIHRoZSB0ZW1wbGF0ZXMuXG4gIC8vIFRvIGVuc3VyZSB0aGF0IGVycm9ycyBhcmUgcmVwb3J0ZWQgY29ycmVjdGx5LCBhbGwgQU9UIGNvbXBvbmVudCBkaWFnbm9zdGljcyBuZWVkIHRvIGJlIGFuYWx5emVkIGV2ZW4gaWYgYnVpbGRcbiAgLy8gaW5mbyBpcyBwcmVzZW50LlxuICBpZiAoaW5jbHVkZVRUQykge1xuICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiBidWlsZGVyLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgIGlmIChpZ25vcmVGb3JEaWFnbm9zdGljcy5oYXMoc291cmNlRmlsZSkgJiYgc291cmNlRmlsZS5maWxlTmFtZS5lbmRzV2l0aCgnLm5ndHlwZWNoZWNrLnRzJykpIHtcbiAgICAgICAgLy8gVGhpcyBmaWxlIG5hbWUgY29udmVyc2lvbiByZWxpZXMgb24gaW50ZXJuYWwgY29tcGlsZXIgbG9naWMgYW5kIHNob3VsZCBiZSBjb252ZXJ0ZWRcbiAgICAgICAgLy8gdG8gYW4gb2ZmaWNpYWwgbWV0aG9kIHdoZW4gYXZhaWxhYmxlLiAxNSBpcyBsZW5ndGggb2YgYC5uZ3R5cGVjaGVjay50c2BcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxGaWxlbmFtZSA9IHNvdXJjZUZpbGUuZmlsZU5hbWUuc2xpY2UoMCwgLTE1KSArICcudHMnO1xuICAgICAgICBjb25zdCBvcmlnaW5hbFNvdXJjZUZpbGUgPSBidWlsZGVyLmdldFNvdXJjZUZpbGUob3JpZ2luYWxGaWxlbmFtZSk7XG4gICAgICAgIGlmIChvcmlnaW5hbFNvdXJjZUZpbGUpIHtcbiAgICAgICAgICBhZmZlY3RlZEZpbGVzLmFkZChvcmlnaW5hbFNvdXJjZUZpbGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGFmZmVjdGVkRmlsZXM7XG59XG4iXX0=