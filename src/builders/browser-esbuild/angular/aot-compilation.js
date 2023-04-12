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
    constructor(angularProgram, typeScriptProgram, affectedFiles, templateDiagnosticsOptimization, diagnosticCache = new WeakMap()) {
        this.angularProgram = angularProgram;
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
    async initialize(rootNames, compilerOptions, hostOptions, configurationDiagnostics) {
        // Dynamically load the Angular compiler CLI package
        const { NgtscProgram, OptimizeFor } = await angular_compilation_1.AngularCompilation.loadCompilerCli();
        // Create Angular compiler host
        const host = (0, angular_host_1.createAngularCompilerHost)(compilerOptions, hostOptions);
        // Create the Angular specific program that contains the Angular compiler
        const angularProgram = (0, profiling_1.profileSync)('NG_CREATE_PROGRAM', () => new NgtscProgram(rootNames, compilerOptions, host, __classPrivateFieldGet(this, _AotCompilation_state, "f")?.angularProgram));
        const angularCompiler = angularProgram.compiler;
        const angularTypeScriptProgram = angularProgram.getTsProgram();
        (0, angular_host_1.ensureSourceFileVersions)(angularTypeScriptProgram);
        const typeScriptProgram = typescript_1.default.createEmitAndSemanticDiagnosticsBuilderProgram(angularTypeScriptProgram, host, __classPrivateFieldGet(this, _AotCompilation_state, "f")?.typeScriptProgram, configurationDiagnostics);
        await (0, profiling_1.profileAsync)('NG_ANALYZE_PROGRAM', () => angularCompiler.analyzeAsync());
        const affectedFiles = (0, profiling_1.profileSync)('NG_FIND_AFFECTED', () => findAffectedFiles(typeScriptProgram, angularCompiler));
        __classPrivateFieldSet(this, _AotCompilation_state, new AngularCompilationState(angularProgram, typeScriptProgram, affectedFiles, affectedFiles.size === 1 ? OptimizeFor.SingleFile : OptimizeFor.WholeProgram, __classPrivateFieldGet(this, _AotCompilation_state, "f")?.diagnosticCache), "f");
        return { affectedFiles };
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
    createFileEmitter(onAfterEmit) {
        (0, node_assert_1.default)(__classPrivateFieldGet(this, _AotCompilation_state, "f"), 'Angular compilation must be initialized prior to emitting files.');
        const { angularCompiler, typeScriptProgram } = __classPrivateFieldGet(this, _AotCompilation_state, "f");
        const transformers = mergeTransformers(angularCompiler.prepareEmit().transformers, {
            before: [replaceBootstrap(() => typeScriptProgram.getProgram().getTypeChecker())],
        });
        return async (file) => {
            const sourceFile = typeScriptProgram.getSourceFile(file);
            if (!sourceFile) {
                return undefined;
            }
            let content;
            typeScriptProgram.emit(sourceFile, (filename, data) => {
                if (/\.[cm]?js$/.test(filename)) {
                    content = data;
                }
            }, undefined /* cancellationToken */, undefined /* emitOnlyDtsFiles */, transformers);
            angularCompiler.incrementalCompilation.recordSuccessfulEmit(sourceFile);
            onAfterEmit?.(sourceFile);
            return { content, dependencies: [] };
        };
    }
}
exports.AotCompilation = AotCompilation;
_AotCompilation_state = new WeakMap();
function findAffectedFiles(builder, { ignoreForDiagnostics, ignoreForEmit, incrementalCompilation }) {
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
    // A file is also affected if the Angular compiler requires it to be emitted
    for (const sourceFile of builder.getSourceFiles()) {
        if (ignoreForEmit.has(sourceFile) || incrementalCompilation.safeToSkipEmit(sourceFile)) {
            continue;
        }
        affectedFiles.add(sourceFile);
    }
    return affectedFiles;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW90LWNvbXBpbGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2FuZ3VsYXIvYW90LWNvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw0REFBNEI7QUFDNUIsNENBQXlEO0FBQ3pELCtEQUF3RTtBQUN4RSxpREFJd0I7QUFFeEIsZ0RBQWdEO0FBQ2hELCtGQUErRjtBQUMvRixNQUFNLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxPQUFPLENBQUMseUNBQXlDLENBQUMsQ0FBQztBQUVuRyxNQUFNLHVCQUF1QjtJQUMzQixZQUNrQixjQUErQixFQUMvQixpQkFBOEQsRUFDOUQsYUFBeUMsRUFDekMsK0JBQStDLEVBQy9DLGtCQUFrQixJQUFJLE9BQU8sRUFBa0M7UUFKL0QsbUJBQWMsR0FBZCxjQUFjLENBQWlCO1FBQy9CLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBNkM7UUFDOUQsa0JBQWEsR0FBYixhQUFhLENBQTRCO1FBQ3pDLG9DQUErQixHQUEvQiwrQkFBK0IsQ0FBZ0I7UUFDL0Msb0JBQWUsR0FBZixlQUFlLENBQWdEO0lBQzlFLENBQUM7SUFFSixJQUFJLGVBQWU7UUFDakIsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQztJQUN0QyxDQUFDO0NBQ0Y7QUFFRCxNQUFhLGNBQWUsU0FBUSx3Q0FBa0I7SUFBdEQ7O1FBQ0Usd0NBQWlDO0lBMEluQyxDQUFDO0lBeElDLEtBQUssQ0FBQyxVQUFVLENBQ2QsU0FBbUIsRUFDbkIsZUFBbUMsRUFDbkMsV0FBK0IsRUFDL0Isd0JBQTBDO1FBRTFDLG9EQUFvRDtRQUNwRCxNQUFNLEVB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QkFDM0Ysc0ZBQXNGO2dCQUN0RiwwRUFBMEU7Z0JBQzFFLE1BQU0sZ0JBQWdCLEdBQUcsVUFBVSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDO2dCQUNuRSxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztnQkFDbkUsSUFBSSxrQkFBa0IsRUFBRTtvQkFDdEIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO2lCQUN2QztnQkFFRCxPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDWCxNQUFNO1NBQ1A7UUFFRCxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUF5QixDQUFDLENBQUM7S0FDckQ7SUFFRCw0RUFBNEU7SUFDNUUsS0FBSyxNQUFNLFVBQVUsSUFBSSxPQUFPLENBQUMsY0FBYyxFQUFFLEVBQUU7UUFDakQsSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLHNCQUFzQixDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUN0RixTQUFTO1NBQ1Y7UUFFRCxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQy9CO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBwcm9maWxlQXN5bmMsIHByb2ZpbGVTeW5jIH0gZnJvbSAnLi4vcHJvZmlsaW5nJztcbmltcG9ydCB7IEFuZ3VsYXJDb21waWxhdGlvbiwgRmlsZUVtaXR0ZXIgfSBmcm9tICcuL2FuZ3VsYXItY29tcGlsYXRpb24nO1xuaW1wb3J0IHtcbiAgQW5ndWxhckhvc3RPcHRpb25zLFxuICBjcmVhdGVBbmd1bGFyQ29tcGlsZXJIb3N0LFxuICBlbnN1cmVTb3VyY2VGaWxlVmVyc2lvbnMsXG59IGZyb20gJy4vYW5ndWxhci1ob3N0JztcblxuLy8gVGVtcG9yYXJ5IGRlZXAgaW1wb3J0IGZvciB0cmFuc2Zvcm1lciBzdXBwb3J0XG4vLyBUT0RPOiBNb3ZlIHRoZXNlIHRvIGEgcHJpdmF0ZSBleHBvcnRzIGxvY2F0aW9uIG9yIG1vdmUgdGhlIGltcGxlbWVudGF0aW9uIGludG8gdGhpcyBwYWNrYWdlLlxuY29uc3QgeyBtZXJnZVRyYW5zZm9ybWVycywgcmVwbGFjZUJvb3RzdHJhcCB9ID0gcmVxdWlyZSgnQG5ndG9vbHMvd2VicGFjay9zcmMvaXZ5L3RyYW5zZm9ybWF0aW9uJyk7XG5cbmNsYXNzIEFuZ3VsYXJDb21waWxhdGlvblN0YXRlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIHJlYWRvbmx5IGFuZ3VsYXJQcm9ncmFtOiBuZy5OZ3RzY1Byb2dyYW0sXG4gICAgcHVibGljIHJlYWRvbmx5IHR5cGVTY3JpcHRQcm9ncmFtOiB0cy5FbWl0QW5kU2VtYW50aWNEaWFnbm9zdGljc0J1aWxkZXJQcm9ncmFtLFxuICAgIHB1YmxpYyByZWFkb25seSBhZmZlY3RlZEZpbGVzOiBSZWFkb25seVNldDx0cy5Tb3VyY2VGaWxlPixcbiAgICBwdWJsaWMgcmVhZG9ubHkgdGVtcGxhdGVEaWFnbm9zdGljc09wdGltaXphdGlvbjogbmcuT3B0aW1pemVGb3IsXG4gICAgcHVibGljIHJlYWRvbmx5IGRpYWdub3N0aWNDYWNoZSA9IG5ldyBXZWFrTWFwPHRzLlNvdXJjZUZpbGUsIHRzLkRpYWdub3N0aWNbXT4oKSxcbiAgKSB7fVxuXG4gIGdldCBhbmd1bGFyQ29tcGlsZXIoKSB7XG4gICAgcmV0dXJuIHRoaXMuYW5ndWxhclByb2dyYW0uY29tcGlsZXI7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEFvdENvbXBpbGF0aW9uIGV4dGVuZHMgQW5ndWxhckNvbXBpbGF0aW9uIHtcbiAgI3N0YXRlPzogQW5ndWxhckNvbXBpbGF0aW9uU3RhdGU7XG5cbiAgYXN5bmMgaW5pdGlhbGl6ZShcbiAgICByb290TmFtZXM6IHN0cmluZ1tdLFxuICAgIGNvbXBpbGVyT3B0aW9uczogbmcuQ29tcGlsZXJPcHRpb25zLFxuICAgIGhvc3RPcHRpb25zOiBBbmd1bGFySG9zdE9wdGlvbnMsXG4gICAgY29uZmlndXJhdGlvbkRpYWdub3N0aWNzPzogdHMuRGlhZ25vc3RpY1tdLFxuICApOiBQcm9taXNlPHsgYWZmZWN0ZWRGaWxlczogUmVhZG9ubHlTZXQ8dHMuU291cmNlRmlsZT4gfT4ge1xuICAgIC8vIER5bmFtaWNhbGx5IGxvYWQgdGhlIEFuZ3VsYXIgY29tcGlsZXIgQ0xJIHBhY2thZ2VcbiAgICBjb25zdCB7IE5ndHNjUHJvZ3JhbSwgT3B0aW1pemVGb3IgfSA9IGF3YWl0IEFuZ3VsYXJDb21waWxhdGlvbi5sb2FkQ29tcGlsZXJDbGkoKTtcblxuICAgIC8vIENyZWF0ZSBBbmd1bGFyIGNvbXBpbGVyIGhvc3RcbiAgICBjb25zdCBob3N0ID0gY3JlYXRlQW5ndWxhckNvbXBpbGVySG9zdChjb21waWxlck9wdGlvbnMsIGhvc3RPcHRpb25zKTtcblxuICAgIC8vIENyZWF0ZSB0aGUgQW5ndWxhciBzcGVjaWZpYyBwcm9ncmFtIHRoYXQgY29udGFpbnMgdGhlIEFuZ3VsYXIgY29tcGlsZXJcbiAgICBjb25zdCBhbmd1bGFyUHJvZ3JhbSA9IHByb2ZpbGVTeW5jKFxuICAgICAgJ05HX0NSRUFURV9QUk9HUkFNJyxcbiAgICAgICgpID0+IG5ldyBOZ3RzY1Byb2dyYW0ocm9vdE5hbWVzLCBjb21waWxlck9wdGlvbnMsIGhvc3QsIHRoaXMuI3N0YXRlPy5hbmd1bGFyUHJvZ3JhbSksXG4gICAgKTtcbiAgICBjb25zdCBhbmd1bGFyQ29tcGlsZXIgPSBhbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgICBjb25zdCBhbmd1bGFyVHlwZVNjcmlwdFByb2dyYW0gPSBhbmd1bGFyUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKTtcbiAgICBlbnN1cmVTb3VyY2VGaWxlVmVyc2lvbnMoYW5ndWxhclR5cGVTY3JpcHRQcm9ncmFtKTtcblxuICAgIGNvbnN0IHR5cGVTY3JpcHRQcm9ncmFtID0gdHMuY3JlYXRlRW1pdEFuZFNlbWFudGljRGlhZ25vc3RpY3NCdWlsZGVyUHJvZ3JhbShcbiAgICAgIGFuZ3VsYXJUeXBlU2NyaXB0UHJvZ3JhbSxcbiAgICAgIGhvc3QsXG4gICAgICB0aGlzLiNzdGF0ZT8udHlwZVNjcmlwdFByb2dyYW0sXG4gICAgICBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3MsXG4gICAgKTtcblxuICAgIGF3YWl0IHByb2ZpbGVBc3luYygnTkdfQU5BTFlaRV9QUk9HUkFNJywgKCkgPT4gYW5ndWxhckNvbXBpbGVyLmFuYWx5emVBc3luYygpKTtcbiAgICBjb25zdCBhZmZlY3RlZEZpbGVzID0gcHJvZmlsZVN5bmMoJ05HX0ZJTkRfQUZGRUNURUQnLCAoKSA9PlxuICAgICAgZmluZEFmZmVjdGVkRmlsZXModHlwZVNjcmlwdFByb2dyYW0sIGFuZ3VsYXJDb21waWxlciksXG4gICAgKTtcblxuICAgIHRoaXMuI3N0YXRlID0gbmV3IEFuZ3VsYXJDb21waWxhdGlvblN0YXRlKFxuICAgICAgYW5ndWxhclByb2dyYW0sXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbSxcbiAgICAgIGFmZmVjdGVkRmlsZXMsXG4gICAgICBhZmZlY3RlZEZpbGVzLnNpemUgPT09IDEgPyBPcHRpbWl6ZUZvci5TaW5nbGVGaWxlIDogT3B0aW1pemVGb3IuV2hvbGVQcm9ncmFtLFxuICAgICAgdGhpcy4jc3RhdGU/LmRpYWdub3N0aWNDYWNoZSxcbiAgICApO1xuXG4gICAgcmV0dXJuIHsgYWZmZWN0ZWRGaWxlcyB9O1xuICB9XG5cbiAgKmNvbGxlY3REaWFnbm9zdGljcygpOiBJdGVyYWJsZTx0cy5EaWFnbm9zdGljPiB7XG4gICAgYXNzZXJ0KHRoaXMuI3N0YXRlLCAnQW5ndWxhciBjb21waWxhdGlvbiBtdXN0IGJlIGluaXRpYWxpemVkIHByaW9yIHRvIGNvbGxlY3RpbmcgZGlhZ25vc3RpY3MuJyk7XG4gICAgY29uc3Qge1xuICAgICAgYWZmZWN0ZWRGaWxlcyxcbiAgICAgIGFuZ3VsYXJDb21waWxlcixcbiAgICAgIGRpYWdub3N0aWNDYWNoZSxcbiAgICAgIHRlbXBsYXRlRGlhZ25vc3RpY3NPcHRpbWl6YXRpb24sXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbSxcbiAgICB9ID0gdGhpcy4jc3RhdGU7XG5cbiAgICAvLyBDb2xsZWN0IHByb2dyYW0gbGV2ZWwgZGlhZ25vc3RpY3NcbiAgICB5aWVsZCogdHlwZVNjcmlwdFByb2dyYW0uZ2V0Q29uZmlnRmlsZVBhcnNpbmdEaWFnbm9zdGljcygpO1xuICAgIHlpZWxkKiBhbmd1bGFyQ29tcGlsZXIuZ2V0T3B0aW9uRGlhZ25vc3RpY3MoKTtcbiAgICB5aWVsZCogdHlwZVNjcmlwdFByb2dyYW0uZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCk7XG4gICAgeWllbGQqIHR5cGVTY3JpcHRQcm9ncmFtLmdldEdsb2JhbERpYWdub3N0aWNzKCk7XG5cbiAgICAvLyBDb2xsZWN0IHNvdXJjZSBmaWxlIHNwZWNpZmljIGRpYWdub3N0aWNzXG4gICAgZm9yIChjb25zdCBzb3VyY2VGaWxlIG9mIHR5cGVTY3JpcHRQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgIGlmIChhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBUeXBlU2NyaXB0IHdpbGwgdXNlIGNhY2hlZCBkaWFnbm9zdGljcyBmb3IgZmlsZXMgdGhhdCBoYXZlIG5vdCBiZWVuXG4gICAgICAvLyBjaGFuZ2VkIG9yIGFmZmVjdGVkIGZvciB0aGlzIGJ1aWxkIHdoZW4gdXNpbmcgaW5jcmVtZW50YWwgYnVpbGRpbmcuXG4gICAgICB5aWVsZCogcHJvZmlsZVN5bmMoXG4gICAgICAgICdOR19ESUFHTk9TVElDU19TWU5UQUNUSUMnLFxuICAgICAgICAoKSA9PiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlKSxcbiAgICAgICAgdHJ1ZSxcbiAgICAgICk7XG4gICAgICB5aWVsZCogcHJvZmlsZVN5bmMoXG4gICAgICAgICdOR19ESUFHTk9TVElDU19TRU1BTlRJQycsXG4gICAgICAgICgpID0+IHR5cGVTY3JpcHRQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc291cmNlRmlsZSksXG4gICAgICAgIHRydWUsXG4gICAgICApO1xuXG4gICAgICAvLyBEZWNsYXJhdGlvbiBmaWxlcyBjYW5ub3QgaGF2ZSB0ZW1wbGF0ZSBkaWFnbm9zdGljc1xuICAgICAgaWYgKHNvdXJjZUZpbGUuaXNEZWNsYXJhdGlvbkZpbGUpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIE9ubHkgcmVxdWVzdCBBbmd1bGFyIHRlbXBsYXRlIGRpYWdub3N0aWNzIGZvciBhZmZlY3RlZCBmaWxlcyB0byBhdm9pZFxuICAgICAgLy8gb3ZlcmhlYWQgb2YgdGVtcGxhdGUgZGlhZ25vc3RpY3MgZm9yIHVuY2hhbmdlZCBmaWxlcy5cbiAgICAgIGlmIChhZmZlY3RlZEZpbGVzLmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgICBjb25zdCBhbmd1bGFyRGlhZ25vc3RpY3MgPSBwcm9maWxlU3luYyhcbiAgICAgICAgICAnTkdfRElBR05PU1RJQ1NfVEVNUExBVEUnLFxuICAgICAgICAgICgpID0+IGFuZ3VsYXJDb21waWxlci5nZXREaWFnbm9zdGljc0ZvckZpbGUoc291cmNlRmlsZSwgdGVtcGxhdGVEaWFnbm9zdGljc09wdGltaXphdGlvbiksXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKTtcbiAgICAgICAgZGlhZ25vc3RpY0NhY2hlLnNldChzb3VyY2VGaWxlLCBhbmd1bGFyRGlhZ25vc3RpY3MpO1xuICAgICAgICB5aWVsZCogYW5ndWxhckRpYWdub3N0aWNzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gZGlhZ25vc3RpY0NhY2hlLmdldChzb3VyY2VGaWxlKTtcbiAgICAgICAgaWYgKGFuZ3VsYXJEaWFnbm9zdGljcykge1xuICAgICAgICAgIHlpZWxkKiBhbmd1bGFyRGlhZ25vc3RpY3M7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjcmVhdGVGaWxlRW1pdHRlcihvbkFmdGVyRW1pdD86IChzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKSA9PiB2b2lkKTogRmlsZUVtaXR0ZXIge1xuICAgIGFzc2VydCh0aGlzLiNzdGF0ZSwgJ0FuZ3VsYXIgY29tcGlsYXRpb24gbXVzdCBiZSBpbml0aWFsaXplZCBwcmlvciB0byBlbWl0dGluZyBmaWxlcy4nKTtcbiAgICBjb25zdCB7IGFuZ3VsYXJDb21waWxlciwgdHlwZVNjcmlwdFByb2dyYW0gfSA9IHRoaXMuI3N0YXRlO1xuXG4gICAgY29uc3QgdHJhbnNmb3JtZXJzID0gbWVyZ2VUcmFuc2Zvcm1lcnMoYW5ndWxhckNvbXBpbGVyLnByZXBhcmVFbWl0KCkudHJhbnNmb3JtZXJzLCB7XG4gICAgICBiZWZvcmU6IFtyZXBsYWNlQm9vdHN0cmFwKCgpID0+IHR5cGVTY3JpcHRQcm9ncmFtLmdldFByb2dyYW0oKS5nZXRUeXBlQ2hlY2tlcigpKV0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gYXN5bmMgKGZpbGU6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IHR5cGVTY3JpcHRQcm9ncmFtLmdldFNvdXJjZUZpbGUoZmlsZSk7XG4gICAgICBpZiAoIXNvdXJjZUZpbGUpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH1cblxuICAgICAgbGV0IGNvbnRlbnQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgIHR5cGVTY3JpcHRQcm9ncmFtLmVtaXQoXG4gICAgICAgIHNvdXJjZUZpbGUsXG4gICAgICAgIChmaWxlbmFtZSwgZGF0YSkgPT4ge1xuICAgICAgICAgIGlmICgvXFwuW2NtXT9qcyQvLnRlc3QoZmlsZW5hbWUpKSB7XG4gICAgICAgICAgICBjb250ZW50ID0gZGF0YTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHVuZGVmaW5lZCAvKiBjYW5jZWxsYXRpb25Ub2tlbiAqLyxcbiAgICAgICAgdW5kZWZpbmVkIC8qIGVtaXRPbmx5RHRzRmlsZXMgKi8sXG4gICAgICAgIHRyYW5zZm9ybWVycyxcbiAgICAgICk7XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlci5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLnJlY29yZFN1Y2Nlc3NmdWxFbWl0KHNvdXJjZUZpbGUpO1xuICAgICAgb25BZnRlckVtaXQ/Lihzb3VyY2VGaWxlKTtcblxuICAgICAgcmV0dXJuIHsgY29udGVudCwgZGVwZW5kZW5jaWVzOiBbXSB9O1xuICAgIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZEFmZmVjdGVkRmlsZXMoXG4gIGJ1aWxkZXI6IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0sXG4gIHsgaWdub3JlRm9yRGlhZ25vc3RpY3MsIGlnbm9yZUZvckVtaXQsIGluY3JlbWVudGFsQ29tcGlsYXRpb24gfTogbmcuTmd0c2NQcm9ncmFtWydjb21waWxlciddLFxuKTogU2V0PHRzLlNvdXJjZUZpbGU+IHtcbiAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IG5ldyBTZXQ8dHMuU291cmNlRmlsZT4oKTtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYnVpbGRlci5nZXRTZW1hbnRpY0RpYWdub3N0aWNzT2ZOZXh0QWZmZWN0ZWRGaWxlKHVuZGVmaW5lZCwgKHNvdXJjZUZpbGUpID0+IHtcbiAgICAgIC8vIElmIHRoZSBhZmZlY3RlZCBmaWxlIGlzIGEgVFRDIHNoaW0sIGFkZCB0aGUgc2hpbSdzIG9yaWdpbmFsIHNvdXJjZSBmaWxlLlxuICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoYXQgY2hhbmdlcyB0aGF0IGFmZmVjdCBUVEMgYXJlIHR5cGVjaGVja2VkIGV2ZW4gd2hlbiB0aGUgY2hhbmdlc1xuICAgICAgLy8gYXJlIG90aGVyd2lzZSB1bnJlbGF0ZWQgZnJvbSBhIFRTIHBlcnNwZWN0aXZlIGFuZCBkbyBub3QgcmVzdWx0IGluIEl2eSBjb2RlZ2VuIGNoYW5nZXMuXG4gICAgICAvLyBGb3IgZXhhbXBsZSwgY2hhbmdpbmcgQElucHV0IHByb3BlcnR5IHR5cGVzIG9mIGEgZGlyZWN0aXZlIHVzZWQgaW4gYW5vdGhlciBjb21wb25lbnQnc1xuICAgICAgLy8gdGVtcGxhdGUuXG4gICAgICAvLyBBIFRUQyBzaGltIGlzIGEgZmlsZSB0aGF0IGhhcyBiZWVuIGlnbm9yZWQgZm9yIGRpYWdub3N0aWNzIGFuZCBoYXMgYSBmaWxlbmFtZSBlbmRpbmcgaW4gYC5uZ3R5cGVjaGVjay50c2AuXG4gICAgICBpZiAoaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpICYmIHNvdXJjZUZpbGUuZmlsZU5hbWUuZW5kc1dpdGgoJy5uZ3R5cGVjaGVjay50cycpKSB7XG4gICAgICAgIC8vIFRoaXMgZmlsZSBuYW1lIGNvbnZlcnNpb24gcmVsaWVzIG9uIGludGVybmFsIGNvbXBpbGVyIGxvZ2ljIGFuZCBzaG91bGQgYmUgY29udmVydGVkXG4gICAgICAgIC8vIHRvIGFuIG9mZmljaWFsIG1ldGhvZCB3aGVuIGF2YWlsYWJsZS4gMTUgaXMgbGVuZ3RoIG9mIGAubmd0eXBlY2hlY2sudHNgXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsRmlsZW5hbWUgPSBzb3VyY2VGaWxlLmZpbGVOYW1lLnNsaWNlKDAsIC0xNSkgKyAnLnRzJztcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxTb3VyY2VGaWxlID0gYnVpbGRlci5nZXRTb3VyY2VGaWxlKG9yaWdpbmFsRmlsZW5hbWUpO1xuICAgICAgICBpZiAob3JpZ2luYWxTb3VyY2VGaWxlKSB7XG4gICAgICAgICAgYWZmZWN0ZWRGaWxlcy5hZGQob3JpZ2luYWxTb3VyY2VGaWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgYWZmZWN0ZWRGaWxlcy5hZGQocmVzdWx0LmFmZmVjdGVkIGFzIHRzLlNvdXJjZUZpbGUpO1xuICB9XG5cbiAgLy8gQSBmaWxlIGlzIGFsc28gYWZmZWN0ZWQgaWYgdGhlIEFuZ3VsYXIgY29tcGlsZXIgcmVxdWlyZXMgaXQgdG8gYmUgZW1pdHRlZFxuICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgYnVpbGRlci5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgaWYgKGlnbm9yZUZvckVtaXQuaGFzKHNvdXJjZUZpbGUpIHx8IGluY3JlbWVudGFsQ29tcGlsYXRpb24uc2FmZVRvU2tpcEVtaXQoc291cmNlRmlsZSkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGFmZmVjdGVkRmlsZXMuYWRkKHNvdXJjZUZpbGUpO1xuICB9XG5cbiAgcmV0dXJuIGFmZmVjdGVkRmlsZXM7XG59XG4iXX0=