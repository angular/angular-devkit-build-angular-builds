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
const { mergeTransformers, replaceBootstrap } = require('@ngtools/webpack/src/ivy/transformation');
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
        return { affectedFiles, compilerOptions };
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
        const transformers = mergeTransformers(angularCompiler.prepareEmit().transformers, {
            before: [replaceBootstrap(() => typeScriptProgram.getProgram().getTypeChecker())],
        });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW90LWNvbXBpbGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2FuZ3VsYXIvYW90LWNvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw0REFBNEI7QUFDNUIsNENBQXlEO0FBQ3pELCtEQUEyRTtBQUMzRSxpREFJd0I7QUFFeEIsZ0RBQWdEO0FBQ2hELCtGQUErRjtBQUMvRixNQUFNLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxPQUFPLENBQUMseUNBQXlDLENBQUMsQ0FBQztBQUVuRyxNQUFNLHVCQUF1QjtJQUMzQixZQUNrQixjQUErQixFQUMvQixZQUE2QixFQUM3QixpQkFBOEQsRUFDOUQsYUFBeUMsRUFDekMsK0JBQStDLEVBQy9DLGtCQUFrQixJQUFJLE9BQU8sRUFBa0M7UUFML0QsbUJBQWMsR0FBZCxjQUFjLENBQWlCO1FBQy9CLGlCQUFZLEdBQVosWUFBWSxDQUFpQjtRQUM3QixzQkFBaUIsR0FBakIsaUJBQWlCLENBQTZDO1FBQzlELGtCQUFhLEdBQWIsYUFBYSxDQUE0QjtRQUN6QyxvQ0FBK0IsR0FBL0IsK0JBQStCLENBQWdCO1FBQy9DLG9CQUFlLEdBQWYsZUFBZSxDQUFnRDtJQUM5RSxDQUFDO0lBRUosSUFBSSxlQUFlO1FBQ2pCLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUM7SUFDdEMsQ0FBQztDQUNGO0FBRUQsTUFBYSxjQUFlLFNBQVEsd0NBQWtCO0lBQXREOztRQUNFLHdDQUFpQztJQStLbkMsQ0FBQztJQTdLQyxLQUFLLENBQUMsVUFBVSxDQUNkLFFBQWdCLEVBQ2hCLFdBQStCLEVBQy9CLDBCQUF3RjtRQUV4RixvREFBb0Q7UUFDcEQsTUFBTSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsR0FBRyxNQUFNLHdDQUFrQixDQUFDLGVBQWUsRUFBRSxDQUFDO1FBRWpGLDBEQUEwRDtRQUMxRCxNQUFNLEVBQ0osT0FBTyxFQUFFLHVCQUF1QixFQUNoQyxTQUFTLEVBQ1QsTUFBTSxFQUFFLHdCQUF3QixHQUNqQyxHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzNDLE1BQU0sZUFBZSxHQUNuQiwwQkFBMEIsRUFBRSxDQUFDLHVCQUF1QixDQUFDLElBQUksdUJBQXVCLENBQUM7UUFFbkYsK0JBQStCO1FBQy9CLE1BQU0sSUFBSSxHQUFHLElBQUEsd0NBQXlCLEVBQUMsZUFBZSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBRXJFLHlFQUF5RTtRQUN6RSxNQUFNLGNBQWMsR0FBRyxJQUFBLHVCQUFXLEVBQ2hDLG1CQUFtQixFQUNuQixHQUFHLEVBQUUsQ0FBQyxJQUFJLFlBQVksQ0FBQyxTQUFTLEVBQUUsZUFBZSxFQUFFLElBQUksRUFBRSx1QkFBQSxJQUFJLDZCQUFPLEVBQUUsY0FBYyxDQUFDLENBQ3RGLENBQUM7UUFDRixNQUFNLGVBQWUsR0FBRyxjQUFjLENBQUMsUUFBUSxDQUFDO1FBQ2hELE1BQU0sd0JBQXdCLEdBQUcsY0FBYyxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQy9ELElBQUEsdUNBQXdCLEVBQUMsd0JBQXdCLENBQUMsQ0FBQztRQUVuRCxJQUFJLFVBQVUsR0FBRyx1QkFBQSxJQUFJLDZCQUFPLEVBQUUsaUJBQWlCLENBQUM7UUFDaEQsSUFBSSxjQUFjLEdBQUcsS0FBSyxDQUFDO1FBQzNCLElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDZixVQUFVLEdBQUcsb0JBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDMUQsY0FBYyxHQUFHLElBQUksQ0FBQztTQUN2QjtRQUVELE1BQU0saUJBQWlCLEdBQUcsb0JBQUUsQ0FBQyw4Q0FBOEMsQ0FDekUsd0JBQXdCLEVBQ3hCLElBQUksRUFDSixVQUFVLEVBQ1Ysd0JBQXdCLENBQ3pCLENBQUM7UUFFRixNQUFNLElBQUEsd0JBQVksRUFBQyxvQkFBb0IsRUFBRSxHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztRQUMvRSxNQUFNLGFBQWEsR0FBRyxJQUFBLHVCQUFXLEVBQUMsa0JBQWtCLEVBQUUsR0FBRyxFQUFFLENBQ3pELGlCQUFpQixDQUFDLGlCQUFpQixFQUFFLGVBQWUsRUFBRSxjQUFjLENBQUMsQ0FDdEUsQ0FBQztRQUVGLHVCQUFBLElBQUkseUJBQVUsSUFBSSx1QkFBdUIsQ0FDdkMsY0FBYyxFQUNkLElBQUksRUFDSixpQkFBaUIsRUFDakIsYUFBYSxFQUNiLGFBQWEsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsWUFBWSxFQUM1RSx1QkFBQSxJQUFJLDZCQUFPLEVBQUUsZUFBZSxDQUM3QixNQUFBLENBQUM7UUFFRixPQUFPLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxDQUFDO0lBQzVDLENBQUM7SUFFRCxDQUFDLGtCQUFrQjtRQUNqQixJQUFBLHFCQUFNLEVBQUMsdUJBQUEsSUFBSSw2QkFBTyxFQUFFLDBFQUEwRSxDQUFDLENBQUM7UUFDaEcsTUFBTSxFQUNKLGFBQWEsRUFDYixlQUFlLEVBQ2YsZUFBZSxFQUNmLCtCQUErQixFQUMvQixpQkFBaUIsR0FDbEIsR0FBRyx1QkFBQSxJQUFJLDZCQUFPLENBQUM7UUFFaEIsb0NBQW9DO1FBQ3BDLEtBQUssQ0FBQyxDQUFDLGlCQUFpQixDQUFDLCtCQUErQixFQUFFLENBQUM7UUFDM0QsS0FBSyxDQUFDLENBQUMsZUFBZSxDQUFDLG9CQUFvQixFQUFFLENBQUM7UUFDOUMsS0FBSyxDQUFDLENBQUMsaUJBQWlCLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUNqRCxLQUFLLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1FBRWhELDJDQUEyQztRQUMzQyxLQUFLLE1BQU0sVUFBVSxJQUFJLGlCQUFpQixDQUFDLGNBQWMsRUFBRSxFQUFFO1lBQzNELElBQUksZUFBZSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDeEQsU0FBUzthQUNWO1lBRUQsc0VBQXNFO1lBQ3RFLHNFQUFzRTtZQUN0RSxLQUFLLENBQUMsQ0FBQyxJQUFBLHVCQUFXLEVBQ2hCLDBCQUEwQixFQUMxQixHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyx1QkFBdUIsQ0FBQyxVQUFVLENBQUMsRUFDM0QsSUFBSSxDQUNMLENBQUM7WUFDRixLQUFLLENBQUMsQ0FBQyxJQUFBLHVCQUFXLEVBQ2hCLHlCQUF5QixFQUN6QixHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxzQkFBc0IsQ0FBQyxVQUFVLENBQUMsRUFDMUQsSUFBSSxDQUNMLENBQUM7WUFFRixxREFBcUQ7WUFDckQsSUFBSSxVQUFVLENBQUMsaUJBQWlCLEVBQUU7Z0JBQ2hDLFNBQVM7YUFDVjtZQUVELHdFQUF3RTtZQUN4RSx3REFBd0Q7WUFDeEQsSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO2dCQUNqQyxNQUFNLGtCQUFrQixHQUFHLElBQUEsdUJBQVcsRUFDcEMseUJBQXlCLEVBQ3pCLEdBQUcsRUFBRSxDQUFDLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBQyxVQUFVLEVBQUUsK0JBQStCLENBQUMsRUFDeEYsSUFBSSxDQUNMLENBQUM7Z0JBQ0YsZUFBZSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztnQkFDcEQsS0FBSyxDQUFDLENBQUMsa0JBQWtCLENBQUM7YUFDM0I7aUJBQU07Z0JBQ0wsTUFBTSxrQkFBa0IsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUMzRCxJQUFJLGtCQUFrQixFQUFFO29CQUN0QixLQUFLLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQztpQkFDM0I7YUFDRjtTQUNGO0lBQ0gsQ0FBQztJQUVELGlCQUFpQjtRQUNmLElBQUEscUJBQU0sRUFBQyx1QkFBQSxJQUFJLDZCQUFPLEVBQUUsa0VBQWtFLENBQUMsQ0FBQztRQUN4RixNQUFNLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxpQkFBaUIsRUFBRSxHQUFHLHVCQUFBLElBQUksNkJBQU8sQ0FBQztRQUN6RSxNQUFNLGlCQUFpQixHQUNyQixpQkFBaUIsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLGVBQWUsSUFBSSxjQUFjLENBQUM7UUFFM0UsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQWlDLENBQUM7UUFDOUQsTUFBTSxpQkFBaUIsR0FBeUIsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLEVBQUU7WUFDMUYsSUFBSSxDQUFDLFdBQVcsRUFBRSxNQUFNLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO2dCQUNoRSxtREFBbUQ7Z0JBQ25ELFlBQVksQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFFbEQsT0FBTzthQUNSO1lBRUQsSUFBQSxxQkFBTSxFQUFDLFdBQVcsRUFBRSxNQUFNLEtBQUssQ0FBQyxFQUFFLHNDQUFzQyxHQUFHLFFBQVEsQ0FBQyxDQUFDO1lBQ3JGLE1BQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNsQyxJQUFJLGVBQWUsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO2dCQUNqRCxPQUFPO2FBQ1I7WUFFRCxlQUFlLENBQUMsc0JBQXNCLENBQUMsb0JBQW9CLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDeEUsWUFBWSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQzVFLENBQUMsQ0FBQztRQUNGLE1BQU0sWUFBWSxHQUFHLGlCQUFpQixDQUFDLGVBQWUsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxZQUFZLEVBQUU7WUFDakYsTUFBTSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxFQUFFLENBQUMsaUJBQWlCLENBQUMsVUFBVSxFQUFFLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQztTQUNsRixDQUFDLENBQUM7UUFFSCw2RUFBNkU7UUFDN0UsT0FDRSxpQkFBaUIsQ0FBQyxvQkFBb0IsQ0FBQyxpQkFBaUIsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFlBQVksQ0FBQyxFQUM3RjtZQUNBLFdBQVc7U0FDWjtRQUVELHdGQUF3RjtRQUN4RixLQUFLLE1BQU0sVUFBVSxJQUFJLGlCQUFpQixDQUFDLGNBQWMsRUFBRSxFQUFFO1lBQzNELElBQUksWUFBWSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxlQUFlLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDakYsU0FBUzthQUNWO1lBRUQsSUFBSSxVQUFVLENBQUMsaUJBQWlCLEVBQUU7Z0JBQ2hDLFNBQVM7YUFDVjtZQUVELElBQUksZUFBZSxDQUFDLHNCQUFzQixDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDckUsU0FBUzthQUNWO1lBRUQsaUJBQWlCLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFlBQVksQ0FBQyxDQUFDO1NBQzNGO1FBRUQsT0FBTyxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDL0IsQ0FBQztDQUNGO0FBaExELHdDQWdMQzs7QUFFRCxTQUFTLGlCQUFpQixDQUN4QixPQUFvRCxFQUNwRCxFQUFFLG9CQUFvQixFQUErQixFQUNyRCxVQUFtQjtJQUVuQixNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsRUFBaUIsQ0FBQztJQUUvQyxpREFBaUQ7SUFDakQsT0FBTyxJQUFJLEVBQUU7UUFDWCxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsd0NBQXdDLENBQUMsU0FBUyxFQUFFLENBQUMsVUFBVSxFQUFFLEVBQUU7WUFDeEYsMkVBQTJFO1lBQzNFLGtGQUFrRjtZQUNsRiwwRkFBMEY7WUFDMUYseUZBQXlGO1lBQ3pGLFlBQVk7WUFDWiw2R0FBNkc7WUFDN0csSUFBSSxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksVUFBVSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUMsRUFBRTtnQkFDM0Ysc0ZBQXNGO2dCQUN0RiwwRUFBMEU7Z0JBQzFFLE1BQU0sZ0JBQWdCLEdBQUcsVUFBVSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDO2dCQUNuRSxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztnQkFDbkUsSUFBSSxrQkFBa0IsRUFBRTtvQkFDdEIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO2lCQUN2QztnQkFFRCxPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDWCxNQUFNO1NBQ1A7UUFFRCxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUF5QixDQUFDLENBQUM7S0FDckQ7SUFFRCw4REFBOEQ7SUFDOUQsK0dBQStHO0lBQy9HLGdIQUFnSDtJQUNoSCxtQkFBbUI7SUFDbkIsSUFBSSxVQUFVLEVBQUU7UUFDZCxLQUFLLE1BQU0sVUFBVSxJQUFJLE9BQU8sQ0FBQyxjQUFjLEVBQUUsRUFBRTtZQUNqRCxJQUFJLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxVQUFVLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO2dCQUMzRixzRkFBc0Y7Z0JBQ3RGLDBFQUEwRTtnQkFDMUUsTUFBTSxnQkFBZ0IsR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUM7Z0JBQ25FLE1BQU0sa0JBQWtCLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO2dCQUNuRSxJQUFJLGtCQUFrQixFQUFFO29CQUN0QixhQUFhLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7aUJBQ3ZDO2FBQ0Y7U0FDRjtLQUNGO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBwcm9maWxlQXN5bmMsIHByb2ZpbGVTeW5jIH0gZnJvbSAnLi4vcHJvZmlsaW5nJztcbmltcG9ydCB7IEFuZ3VsYXJDb21waWxhdGlvbiwgRW1pdEZpbGVSZXN1bHQgfSBmcm9tICcuL2FuZ3VsYXItY29tcGlsYXRpb24nO1xuaW1wb3J0IHtcbiAgQW5ndWxhckhvc3RPcHRpb25zLFxuICBjcmVhdGVBbmd1bGFyQ29tcGlsZXJIb3N0LFxuICBlbnN1cmVTb3VyY2VGaWxlVmVyc2lvbnMsXG59IGZyb20gJy4vYW5ndWxhci1ob3N0JztcblxuLy8gVGVtcG9yYXJ5IGRlZXAgaW1wb3J0IGZvciB0cmFuc2Zvcm1lciBzdXBwb3J0XG4vLyBUT0RPOiBNb3ZlIHRoZXNlIHRvIGEgcHJpdmF0ZSBleHBvcnRzIGxvY2F0aW9uIG9yIG1vdmUgdGhlIGltcGxlbWVudGF0aW9uIGludG8gdGhpcyBwYWNrYWdlLlxuY29uc3QgeyBtZXJnZVRyYW5zZm9ybWVycywgcmVwbGFjZUJvb3RzdHJhcCB9ID0gcmVxdWlyZSgnQG5ndG9vbHMvd2VicGFjay9zcmMvaXZ5L3RyYW5zZm9ybWF0aW9uJyk7XG5cbmNsYXNzIEFuZ3VsYXJDb21waWxhdGlvblN0YXRlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIHJlYWRvbmx5IGFuZ3VsYXJQcm9ncmFtOiBuZy5OZ3RzY1Byb2dyYW0sXG4gICAgcHVibGljIHJlYWRvbmx5IGNvbXBpbGVySG9zdDogbmcuQ29tcGlsZXJIb3N0LFxuICAgIHB1YmxpYyByZWFkb25seSB0eXBlU2NyaXB0UHJvZ3JhbTogdHMuRW1pdEFuZFNlbWFudGljRGlhZ25vc3RpY3NCdWlsZGVyUHJvZ3JhbSxcbiAgICBwdWJsaWMgcmVhZG9ubHkgYWZmZWN0ZWRGaWxlczogUmVhZG9ubHlTZXQ8dHMuU291cmNlRmlsZT4sXG4gICAgcHVibGljIHJlYWRvbmx5IHRlbXBsYXRlRGlhZ25vc3RpY3NPcHRpbWl6YXRpb246IG5nLk9wdGltaXplRm9yLFxuICAgIHB1YmxpYyByZWFkb25seSBkaWFnbm9zdGljQ2FjaGUgPSBuZXcgV2Vha01hcDx0cy5Tb3VyY2VGaWxlLCB0cy5EaWFnbm9zdGljW10+KCksXG4gICkge31cblxuICBnZXQgYW5ndWxhckNvbXBpbGVyKCkge1xuICAgIHJldHVybiB0aGlzLmFuZ3VsYXJQcm9ncmFtLmNvbXBpbGVyO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBBb3RDb21waWxhdGlvbiBleHRlbmRzIEFuZ3VsYXJDb21waWxhdGlvbiB7XG4gICNzdGF0ZT86IEFuZ3VsYXJDb21waWxhdGlvblN0YXRlO1xuXG4gIGFzeW5jIGluaXRpYWxpemUoXG4gICAgdHNjb25maWc6IHN0cmluZyxcbiAgICBob3N0T3B0aW9uczogQW5ndWxhckhvc3RPcHRpb25zLFxuICAgIGNvbXBpbGVyT3B0aW9uc1RyYW5zZm9ybWVyPzogKGNvbXBpbGVyT3B0aW9uczogbmcuQ29tcGlsZXJPcHRpb25zKSA9PiBuZy5Db21waWxlck9wdGlvbnMsXG4gICk6IFByb21pc2U8eyBhZmZlY3RlZEZpbGVzOiBSZWFkb25seVNldDx0cy5Tb3VyY2VGaWxlPjsgY29tcGlsZXJPcHRpb25zOiBuZy5Db21waWxlck9wdGlvbnMgfT4ge1xuICAgIC8vIER5bmFtaWNhbGx5IGxvYWQgdGhlIEFuZ3VsYXIgY29tcGlsZXIgQ0xJIHBhY2thZ2VcbiAgICBjb25zdCB7IE5ndHNjUHJvZ3JhbSwgT3B0aW1pemVGb3IgfSA9IGF3YWl0IEFuZ3VsYXJDb21waWxhdGlvbi5sb2FkQ29tcGlsZXJDbGkoKTtcblxuICAgIC8vIExvYWQgdGhlIGNvbXBpbGVyIGNvbmZpZ3VyYXRpb24gYW5kIHRyYW5zZm9ybSBhcyBuZWVkZWRcbiAgICBjb25zdCB7XG4gICAgICBvcHRpb25zOiBvcmlnaW5hbENvbXBpbGVyT3B0aW9ucyxcbiAgICAgIHJvb3ROYW1lcyxcbiAgICAgIGVycm9yczogY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgIH0gPSBhd2FpdCB0aGlzLmxvYWRDb25maWd1cmF0aW9uKHRzY29uZmlnKTtcbiAgICBjb25zdCBjb21waWxlck9wdGlvbnMgPVxuICAgICAgY29tcGlsZXJPcHRpb25zVHJhbnNmb3JtZXI/LihvcmlnaW5hbENvbXBpbGVyT3B0aW9ucykgPz8gb3JpZ2luYWxDb21waWxlck9wdGlvbnM7XG5cbiAgICAvLyBDcmVhdGUgQW5ndWxhciBjb21waWxlciBob3N0XG4gICAgY29uc3QgaG9zdCA9IGNyZWF0ZUFuZ3VsYXJDb21waWxlckhvc3QoY29tcGlsZXJPcHRpb25zLCBob3N0T3B0aW9ucyk7XG5cbiAgICAvLyBDcmVhdGUgdGhlIEFuZ3VsYXIgc3BlY2lmaWMgcHJvZ3JhbSB0aGF0IGNvbnRhaW5zIHRoZSBBbmd1bGFyIGNvbXBpbGVyXG4gICAgY29uc3QgYW5ndWxhclByb2dyYW0gPSBwcm9maWxlU3luYyhcbiAgICAgICdOR19DUkVBVEVfUFJPR1JBTScsXG4gICAgICAoKSA9PiBuZXcgTmd0c2NQcm9ncmFtKHJvb3ROYW1lcywgY29tcGlsZXJPcHRpb25zLCBob3N0LCB0aGlzLiNzdGF0ZT8uYW5ndWxhclByb2dyYW0pLFxuICAgICk7XG4gICAgY29uc3QgYW5ndWxhckNvbXBpbGVyID0gYW5ndWxhclByb2dyYW0uY29tcGlsZXI7XG4gICAgY29uc3QgYW5ndWxhclR5cGVTY3JpcHRQcm9ncmFtID0gYW5ndWxhclByb2dyYW0uZ2V0VHNQcm9ncmFtKCk7XG4gICAgZW5zdXJlU291cmNlRmlsZVZlcnNpb25zKGFuZ3VsYXJUeXBlU2NyaXB0UHJvZ3JhbSk7XG5cbiAgICBsZXQgb2xkUHJvZ3JhbSA9IHRoaXMuI3N0YXRlPy50eXBlU2NyaXB0UHJvZ3JhbTtcbiAgICBsZXQgdXNpbmdCdWlsZEluZm8gPSBmYWxzZTtcbiAgICBpZiAoIW9sZFByb2dyYW0pIHtcbiAgICAgIG9sZFByb2dyYW0gPSB0cy5yZWFkQnVpbGRlclByb2dyYW0oY29tcGlsZXJPcHRpb25zLCBob3N0KTtcbiAgICAgIHVzaW5nQnVpbGRJbmZvID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0eXBlU2NyaXB0UHJvZ3JhbSA9IHRzLmNyZWF0ZUVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0oXG4gICAgICBhbmd1bGFyVHlwZVNjcmlwdFByb2dyYW0sXG4gICAgICBob3N0LFxuICAgICAgb2xkUHJvZ3JhbSxcbiAgICAgIGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcyxcbiAgICApO1xuXG4gICAgYXdhaXQgcHJvZmlsZUFzeW5jKCdOR19BTkFMWVpFX1BST0dSQU0nLCAoKSA9PiBhbmd1bGFyQ29tcGlsZXIuYW5hbHl6ZUFzeW5jKCkpO1xuICAgIGNvbnN0IGFmZmVjdGVkRmlsZXMgPSBwcm9maWxlU3luYygnTkdfRklORF9BRkZFQ1RFRCcsICgpID0+XG4gICAgICBmaW5kQWZmZWN0ZWRGaWxlcyh0eXBlU2NyaXB0UHJvZ3JhbSwgYW5ndWxhckNvbXBpbGVyLCB1c2luZ0J1aWxkSW5mbyksXG4gICAgKTtcblxuICAgIHRoaXMuI3N0YXRlID0gbmV3IEFuZ3VsYXJDb21waWxhdGlvblN0YXRlKFxuICAgICAgYW5ndWxhclByb2dyYW0sXG4gICAgICBob3N0LFxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0sXG4gICAgICBhZmZlY3RlZEZpbGVzLFxuICAgICAgYWZmZWN0ZWRGaWxlcy5zaXplID09PSAxID8gT3B0aW1pemVGb3IuU2luZ2xlRmlsZSA6IE9wdGltaXplRm9yLldob2xlUHJvZ3JhbSxcbiAgICAgIHRoaXMuI3N0YXRlPy5kaWFnbm9zdGljQ2FjaGUsXG4gICAgKTtcblxuICAgIHJldHVybiB7IGFmZmVjdGVkRmlsZXMsIGNvbXBpbGVyT3B0aW9ucyB9O1xuICB9XG5cbiAgKmNvbGxlY3REaWFnbm9zdGljcygpOiBJdGVyYWJsZTx0cy5EaWFnbm9zdGljPiB7XG4gICAgYXNzZXJ0KHRoaXMuI3N0YXRlLCAnQW5ndWxhciBjb21waWxhdGlvbiBtdXN0IGJlIGluaXRpYWxpemVkIHByaW9yIHRvIGNvbGxlY3RpbmcgZGlhZ25vc3RpY3MuJyk7XG4gICAgY29uc3Qge1xuICAgICAgYWZmZWN0ZWRGaWxlcyxcbiAgICAgIGFuZ3VsYXJDb21waWxlcixcbiAgICAgIGRpYWdub3N0aWNDYWNoZSxcbiAgICAgIHRlbXBsYXRlRGlhZ25vc3RpY3NPcHRpbWl6YXRpb24sXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbSxcbiAgICB9ID0gdGhpcy4jc3RhdGU7XG5cbiAgICAvLyBDb2xsZWN0IHByb2dyYW0gbGV2ZWwgZGlhZ25vc3RpY3NcbiAgICB5aWVsZCogdHlwZVNjcmlwdFByb2dyYW0uZ2V0Q29uZmlnRmlsZVBhcnNpbmdEaWFnbm9zdGljcygpO1xuICAgIHlpZWxkKiBhbmd1bGFyQ29tcGlsZXIuZ2V0T3B0aW9uRGlhZ25vc3RpY3MoKTtcbiAgICB5aWVsZCogdHlwZVNjcmlwdFByb2dyYW0uZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCk7XG4gICAgeWllbGQqIHR5cGVTY3JpcHRQcm9ncmFtLmdldEdsb2JhbERpYWdub3N0aWNzKCk7XG5cbiAgICAvLyBDb2xsZWN0IHNvdXJjZSBmaWxlIHNwZWNpZmljIGRpYWdub3N0aWNzXG4gICAgZm9yIChjb25zdCBzb3VyY2VGaWxlIG9mIHR5cGVTY3JpcHRQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgIGlmIChhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBUeXBlU2NyaXB0IHdpbGwgdXNlIGNhY2hlZCBkaWFnbm9zdGljcyBmb3IgZmlsZXMgdGhhdCBoYXZlIG5vdCBiZWVuXG4gICAgICAvLyBjaGFuZ2VkIG9yIGFmZmVjdGVkIGZvciB0aGlzIGJ1aWxkIHdoZW4gdXNpbmcgaW5jcmVtZW50YWwgYnVpbGRpbmcuXG4gICAgICB5aWVsZCogcHJvZmlsZVN5bmMoXG4gICAgICAgICdOR19ESUFHTk9TVElDU19TWU5UQUNUSUMnLFxuICAgICAgICAoKSA9PiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlKSxcbiAgICAgICAgdHJ1ZSxcbiAgICAgICk7XG4gICAgICB5aWVsZCogcHJvZmlsZVN5bmMoXG4gICAgICAgICdOR19ESUFHTk9TVElDU19TRU1BTlRJQycsXG4gICAgICAgICgpID0+IHR5cGVTY3JpcHRQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc291cmNlRmlsZSksXG4gICAgICAgIHRydWUsXG4gICAgICApO1xuXG4gICAgICAvLyBEZWNsYXJhdGlvbiBmaWxlcyBjYW5ub3QgaGF2ZSB0ZW1wbGF0ZSBkaWFnbm9zdGljc1xuICAgICAgaWYgKHNvdXJjZUZpbGUuaXNEZWNsYXJhdGlvbkZpbGUpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIE9ubHkgcmVxdWVzdCBBbmd1bGFyIHRlbXBsYXRlIGRpYWdub3N0aWNzIGZvciBhZmZlY3RlZCBmaWxlcyB0byBhdm9pZFxuICAgICAgLy8gb3ZlcmhlYWQgb2YgdGVtcGxhdGUgZGlhZ25vc3RpY3MgZm9yIHVuY2hhbmdlZCBmaWxlcy5cbiAgICAgIGlmIChhZmZlY3RlZEZpbGVzLmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgICBjb25zdCBhbmd1bGFyRGlhZ25vc3RpY3MgPSBwcm9maWxlU3luYyhcbiAgICAgICAgICAnTkdfRElBR05PU1RJQ1NfVEVNUExBVEUnLFxuICAgICAgICAgICgpID0+IGFuZ3VsYXJDb21waWxlci5nZXREaWFnbm9zdGljc0ZvckZpbGUoc291cmNlRmlsZSwgdGVtcGxhdGVEaWFnbm9zdGljc09wdGltaXphdGlvbiksXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKTtcbiAgICAgICAgZGlhZ25vc3RpY0NhY2hlLnNldChzb3VyY2VGaWxlLCBhbmd1bGFyRGlhZ25vc3RpY3MpO1xuICAgICAgICB5aWVsZCogYW5ndWxhckRpYWdub3N0aWNzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gZGlhZ25vc3RpY0NhY2hlLmdldChzb3VyY2VGaWxlKTtcbiAgICAgICAgaWYgKGFuZ3VsYXJEaWFnbm9zdGljcykge1xuICAgICAgICAgIHlpZWxkKiBhbmd1bGFyRGlhZ25vc3RpY3M7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBlbWl0QWZmZWN0ZWRGaWxlcygpOiBJdGVyYWJsZTxFbWl0RmlsZVJlc3VsdD4ge1xuICAgIGFzc2VydCh0aGlzLiNzdGF0ZSwgJ0FuZ3VsYXIgY29tcGlsYXRpb24gbXVzdCBiZSBpbml0aWFsaXplZCBwcmlvciB0byBlbWl0dGluZyBmaWxlcy4nKTtcbiAgICBjb25zdCB7IGFuZ3VsYXJDb21waWxlciwgY29tcGlsZXJIb3N0LCB0eXBlU2NyaXB0UHJvZ3JhbSB9ID0gdGhpcy4jc3RhdGU7XG4gICAgY29uc3QgYnVpbGRJbmZvRmlsZW5hbWUgPVxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0uZ2V0Q29tcGlsZXJPcHRpb25zKCkudHNCdWlsZEluZm9GaWxlID8/ICcudHNidWlsZGluZm8nO1xuXG4gICAgY29uc3QgZW1pdHRlZEZpbGVzID0gbmV3IE1hcDx0cy5Tb3VyY2VGaWxlLCBFbWl0RmlsZVJlc3VsdD4oKTtcbiAgICBjb25zdCB3cml0ZUZpbGVDYWxsYmFjazogdHMuV3JpdGVGaWxlQ2FsbGJhY2sgPSAoZmlsZW5hbWUsIGNvbnRlbnRzLCBfYSwgX2IsIHNvdXJjZUZpbGVzKSA9PiB7XG4gICAgICBpZiAoIXNvdXJjZUZpbGVzPy5sZW5ndGggJiYgZmlsZW5hbWUuZW5kc1dpdGgoYnVpbGRJbmZvRmlsZW5hbWUpKSB7XG4gICAgICAgIC8vIFNhdmUgYnVpbGRlciBpbmZvIGNvbnRlbnRzIHRvIHNwZWNpZmllZCBsb2NhdGlvblxuICAgICAgICBjb21waWxlckhvc3Qud3JpdGVGaWxlKGZpbGVuYW1lLCBjb250ZW50cywgZmFsc2UpO1xuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgYXNzZXJ0KHNvdXJjZUZpbGVzPy5sZW5ndGggPT09IDEsICdJbnZhbGlkIFR5cGVTY3JpcHQgcHJvZ3JhbSBlbWl0IGZvciAnICsgZmlsZW5hbWUpO1xuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IHNvdXJjZUZpbGVzWzBdO1xuICAgICAgaWYgKGFuZ3VsYXJDb21waWxlci5pZ25vcmVGb3JFbWl0Lmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlci5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLnJlY29yZFN1Y2Nlc3NmdWxFbWl0KHNvdXJjZUZpbGUpO1xuICAgICAgZW1pdHRlZEZpbGVzLnNldChzb3VyY2VGaWxlLCB7IGZpbGVuYW1lOiBzb3VyY2VGaWxlLmZpbGVOYW1lLCBjb250ZW50cyB9KTtcbiAgICB9O1xuICAgIGNvbnN0IHRyYW5zZm9ybWVycyA9IG1lcmdlVHJhbnNmb3JtZXJzKGFuZ3VsYXJDb21waWxlci5wcmVwYXJlRW1pdCgpLnRyYW5zZm9ybWVycywge1xuICAgICAgYmVmb3JlOiBbcmVwbGFjZUJvb3RzdHJhcCgoKSA9PiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRQcm9ncmFtKCkuZ2V0VHlwZUNoZWNrZXIoKSldLFxuICAgIH0pO1xuXG4gICAgLy8gVHlwZVNjcmlwdCB3aWxsIGxvb3AgdW50aWwgdGhlcmUgYXJlIG5vIG1vcmUgYWZmZWN0ZWQgZmlsZXMgaW4gdGhlIHByb2dyYW1cbiAgICB3aGlsZSAoXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbS5lbWl0TmV4dEFmZmVjdGVkRmlsZSh3cml0ZUZpbGVDYWxsYmFjaywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRyYW5zZm9ybWVycylcbiAgICApIHtcbiAgICAgIC8qIGVtcHR5ICovXG4gICAgfVxuXG4gICAgLy8gQW5ndWxhciBtYXkgaGF2ZSBmaWxlcyB0aGF0IG11c3QgYmUgZW1pdHRlZCBidXQgVHlwZVNjcmlwdCBkb2VzIG5vdCBjb25zaWRlciBhZmZlY3RlZFxuICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICBpZiAoZW1pdHRlZEZpbGVzLmhhcyhzb3VyY2VGaWxlKSB8fCBhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRW1pdC5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChzb3VyY2VGaWxlLmlzRGVjbGFyYXRpb25GaWxlKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoYW5ndWxhckNvbXBpbGVyLmluY3JlbWVudGFsQ29tcGlsYXRpb24uc2FmZVRvU2tpcEVtaXQoc291cmNlRmlsZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHR5cGVTY3JpcHRQcm9ncmFtLmVtaXQoc291cmNlRmlsZSwgd3JpdGVGaWxlQ2FsbGJhY2ssIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cmFuc2Zvcm1lcnMpO1xuICAgIH1cblxuICAgIHJldHVybiBlbWl0dGVkRmlsZXMudmFsdWVzKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZEFmZmVjdGVkRmlsZXMoXG4gIGJ1aWxkZXI6IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0sXG4gIHsgaWdub3JlRm9yRGlhZ25vc3RpY3MgfTogbmcuTmd0c2NQcm9ncmFtWydjb21waWxlciddLFxuICBpbmNsdWRlVFRDOiBib29sZWFuLFxuKTogU2V0PHRzLlNvdXJjZUZpbGU+IHtcbiAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IG5ldyBTZXQ8dHMuU291cmNlRmlsZT4oKTtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYnVpbGRlci5nZXRTZW1hbnRpY0RpYWdub3N0aWNzT2ZOZXh0QWZmZWN0ZWRGaWxlKHVuZGVmaW5lZCwgKHNvdXJjZUZpbGUpID0+IHtcbiAgICAgIC8vIElmIHRoZSBhZmZlY3RlZCBmaWxlIGlzIGEgVFRDIHNoaW0sIGFkZCB0aGUgc2hpbSdzIG9yaWdpbmFsIHNvdXJjZSBmaWxlLlxuICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoYXQgY2hhbmdlcyB0aGF0IGFmZmVjdCBUVEMgYXJlIHR5cGVjaGVja2VkIGV2ZW4gd2hlbiB0aGUgY2hhbmdlc1xuICAgICAgLy8gYXJlIG90aGVyd2lzZSB1bnJlbGF0ZWQgZnJvbSBhIFRTIHBlcnNwZWN0aXZlIGFuZCBkbyBub3QgcmVzdWx0IGluIEl2eSBjb2RlZ2VuIGNoYW5nZXMuXG4gICAgICAvLyBGb3IgZXhhbXBsZSwgY2hhbmdpbmcgQElucHV0IHByb3BlcnR5IHR5cGVzIG9mIGEgZGlyZWN0aXZlIHVzZWQgaW4gYW5vdGhlciBjb21wb25lbnQnc1xuICAgICAgLy8gdGVtcGxhdGUuXG4gICAgICAvLyBBIFRUQyBzaGltIGlzIGEgZmlsZSB0aGF0IGhhcyBiZWVuIGlnbm9yZWQgZm9yIGRpYWdub3N0aWNzIGFuZCBoYXMgYSBmaWxlbmFtZSBlbmRpbmcgaW4gYC5uZ3R5cGVjaGVjay50c2AuXG4gICAgICBpZiAoaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpICYmIHNvdXJjZUZpbGUuZmlsZU5hbWUuZW5kc1dpdGgoJy5uZ3R5cGVjaGVjay50cycpKSB7XG4gICAgICAgIC8vIFRoaXMgZmlsZSBuYW1lIGNvbnZlcnNpb24gcmVsaWVzIG9uIGludGVybmFsIGNvbXBpbGVyIGxvZ2ljIGFuZCBzaG91bGQgYmUgY29udmVydGVkXG4gICAgICAgIC8vIHRvIGFuIG9mZmljaWFsIG1ldGhvZCB3aGVuIGF2YWlsYWJsZS4gMTUgaXMgbGVuZ3RoIG9mIGAubmd0eXBlY2hlY2sudHNgXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsRmlsZW5hbWUgPSBzb3VyY2VGaWxlLmZpbGVOYW1lLnNsaWNlKDAsIC0xNSkgKyAnLnRzJztcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxTb3VyY2VGaWxlID0gYnVpbGRlci5nZXRTb3VyY2VGaWxlKG9yaWdpbmFsRmlsZW5hbWUpO1xuICAgICAgICBpZiAob3JpZ2luYWxTb3VyY2VGaWxlKSB7XG4gICAgICAgICAgYWZmZWN0ZWRGaWxlcy5hZGQob3JpZ2luYWxTb3VyY2VGaWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgYWZmZWN0ZWRGaWxlcy5hZGQocmVzdWx0LmFmZmVjdGVkIGFzIHRzLlNvdXJjZUZpbGUpO1xuICB9XG5cbiAgLy8gQWRkIGFsbCBmaWxlcyB3aXRoIGFzc29jaWF0ZWQgdGVtcGxhdGUgdHlwZSBjaGVja2luZyBmaWxlcy5cbiAgLy8gU3RvcmVkIFRTIGJ1aWxkIGluZm8gZG9lcyBub3QgaGF2ZSBrbm93bGVkZ2Ugb2YgdGhlIEFPVCBjb21waWxlciBvciB0aGUgdHlwZWNoZWNraW5nIHN0YXRlIG9mIHRoZSB0ZW1wbGF0ZXMuXG4gIC8vIFRvIGVuc3VyZSB0aGF0IGVycm9ycyBhcmUgcmVwb3J0ZWQgY29ycmVjdGx5LCBhbGwgQU9UIGNvbXBvbmVudCBkaWFnbm9zdGljcyBuZWVkIHRvIGJlIGFuYWx5emVkIGV2ZW4gaWYgYnVpbGRcbiAgLy8gaW5mbyBpcyBwcmVzZW50LlxuICBpZiAoaW5jbHVkZVRUQykge1xuICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiBidWlsZGVyLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgIGlmIChpZ25vcmVGb3JEaWFnbm9zdGljcy5oYXMoc291cmNlRmlsZSkgJiYgc291cmNlRmlsZS5maWxlTmFtZS5lbmRzV2l0aCgnLm5ndHlwZWNoZWNrLnRzJykpIHtcbiAgICAgICAgLy8gVGhpcyBmaWxlIG5hbWUgY29udmVyc2lvbiByZWxpZXMgb24gaW50ZXJuYWwgY29tcGlsZXIgbG9naWMgYW5kIHNob3VsZCBiZSBjb252ZXJ0ZWRcbiAgICAgICAgLy8gdG8gYW4gb2ZmaWNpYWwgbWV0aG9kIHdoZW4gYXZhaWxhYmxlLiAxNSBpcyBsZW5ndGggb2YgYC5uZ3R5cGVjaGVjay50c2BcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxGaWxlbmFtZSA9IHNvdXJjZUZpbGUuZmlsZU5hbWUuc2xpY2UoMCwgLTE1KSArICcudHMnO1xuICAgICAgICBjb25zdCBvcmlnaW5hbFNvdXJjZUZpbGUgPSBidWlsZGVyLmdldFNvdXJjZUZpbGUob3JpZ2luYWxGaWxlbmFtZSk7XG4gICAgICAgIGlmIChvcmlnaW5hbFNvdXJjZUZpbGUpIHtcbiAgICAgICAgICBhZmZlY3RlZEZpbGVzLmFkZChvcmlnaW5hbFNvdXJjZUZpbGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGFmZmVjdGVkRmlsZXM7XG59XG4iXX0=