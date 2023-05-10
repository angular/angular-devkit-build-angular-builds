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
        const typeScriptProgram = typescript_1.default.createEmitAndSemanticDiagnosticsBuilderProgram(angularTypeScriptProgram, host, __classPrivateFieldGet(this, _AotCompilation_state, "f")?.typeScriptProgram, configurationDiagnostics);
        await (0, profiling_1.profileAsync)('NG_ANALYZE_PROGRAM', () => angularCompiler.analyzeAsync());
        const affectedFiles = (0, profiling_1.profileSync)('NG_FIND_AFFECTED', () => findAffectedFiles(typeScriptProgram, angularCompiler));
        __classPrivateFieldSet(this, _AotCompilation_state, new AngularCompilationState(angularProgram, typeScriptProgram, affectedFiles, affectedFiles.size === 1 ? OptimizeFor.SingleFile : OptimizeFor.WholeProgram, __classPrivateFieldGet(this, _AotCompilation_state, "f")?.diagnosticCache), "f");
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
        const { angularCompiler, typeScriptProgram } = __classPrivateFieldGet(this, _AotCompilation_state, "f");
        const buildInfoFilename = typeScriptProgram.getCompilerOptions().tsBuildInfoFile ?? '.tsbuildinfo';
        const emittedFiles = new Map();
        const writeFileCallback = (filename, contents, _a, _b, sourceFiles) => {
            if (sourceFiles?.length === 0 && filename.endsWith(buildInfoFilename)) {
                // TODO: Store incremental build info
                return;
            }
            (0, node_assert_1.default)(sourceFiles?.length === 1, 'Invalid TypeScript program emit for ' + filename);
            const sourceFile = sourceFiles[0];
            if (angularCompiler.ignoreForEmit.has(sourceFile)) {
                return;
            }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW90LWNvbXBpbGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2FuZ3VsYXIvYW90LWNvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw0REFBNEI7QUFDNUIsNENBQXlEO0FBQ3pELCtEQUEyRTtBQUMzRSxpREFJd0I7QUFFeEIsZ0RBQWdEO0FBQ2hELCtGQUErRjtBQUMvRixNQUFNLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxPQUFPLENBQUMseUNBQXlDLENBQUMsQ0FBQztBQUVuRyxNQUFNLHVCQUF1QjtJQUMzQixZQUNrQixjQUErQixFQUMvQixpQkFBOEQsRUFDOUQsYUFBeUMsRUFDekMsK0JBQStDLEVBQy9DLGtCQUFrQixJQUFJLE9BQU8sRUFBa0M7UUFKL0QsbUJBQWMsR0FBZCxjQUFjLENBQWlCO1FBQy9CLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBNkM7UUFDOUQsa0JBQWEsR0FBYixhQUFhLENBQTRCO1FBQ3pDLG9DQUErQixHQUEvQiwrQkFBK0IsQ0FBZ0I7UUFDL0Msb0JBQWUsR0FBZixlQUFlLENBQWdEO0lBQzlFLENBQUM7SUFFSixJQUFJLGVBQWU7UUFDakIsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQztJQUN0QyxDQUFDO0NBQ0Y7QUFFRCxNQUFhLGNBQWUsU0FBUSx3Q0FBa0I7SUFBdEQ7O1FBQ0Usd0NBQWlDO0lBZ0tuQyxDQUFDO0lBOUpDLEtBQUssQ0FBQyxVQUFVLENBQ2QsUUFBZ0IsRUFDaEIsV0FBK0IsRUFDL0IsMEJBQXdGO1FBRXhGLG9EQUFvRDtRQUNwRCxNQUFNLEVBQUUsWUFBWSxFQUFF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LENBQUMsQ0FBQztnQkFDbkUsSUFBSSxrQkFBa0IsRUFBRTtvQkFDdEIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO2lCQUN2QztnQkFFRCxPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDWCxNQUFNO1NBQ1A7UUFFRCxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUF5QixDQUFDLENBQUM7S0FDckQ7SUFFRCw0RUFBNEU7SUFDNUUsS0FBSyxNQUFNLFVBQVUsSUFBSSxPQUFPLENBQUMsY0FBYyxFQUFFLEVBQUU7UUFDakQsSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLHNCQUFzQixDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUN0RixTQUFTO1NBQ1Y7UUFFRCxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQy9CO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBwcm9maWxlQXN5bmMsIHByb2ZpbGVTeW5jIH0gZnJvbSAnLi4vcHJvZmlsaW5nJztcbmltcG9ydCB7IEFuZ3VsYXJDb21waWxhdGlvbiwgRW1pdEZpbGVSZXN1bHQgfSBmcm9tICcuL2FuZ3VsYXItY29tcGlsYXRpb24nO1xuaW1wb3J0IHtcbiAgQW5ndWxhckhvc3RPcHRpb25zLFxuICBjcmVhdGVBbmd1bGFyQ29tcGlsZXJIb3N0LFxuICBlbnN1cmVTb3VyY2VGaWxlVmVyc2lvbnMsXG59IGZyb20gJy4vYW5ndWxhci1ob3N0JztcblxuLy8gVGVtcG9yYXJ5IGRlZXAgaW1wb3J0IGZvciB0cmFuc2Zvcm1lciBzdXBwb3J0XG4vLyBUT0RPOiBNb3ZlIHRoZXNlIHRvIGEgcHJpdmF0ZSBleHBvcnRzIGxvY2F0aW9uIG9yIG1vdmUgdGhlIGltcGxlbWVudGF0aW9uIGludG8gdGhpcyBwYWNrYWdlLlxuY29uc3QgeyBtZXJnZVRyYW5zZm9ybWVycywgcmVwbGFjZUJvb3RzdHJhcCB9ID0gcmVxdWlyZSgnQG5ndG9vbHMvd2VicGFjay9zcmMvaXZ5L3RyYW5zZm9ybWF0aW9uJyk7XG5cbmNsYXNzIEFuZ3VsYXJDb21waWxhdGlvblN0YXRlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIHJlYWRvbmx5IGFuZ3VsYXJQcm9ncmFtOiBuZy5OZ3RzY1Byb2dyYW0sXG4gICAgcHVibGljIHJlYWRvbmx5IHR5cGVTY3JpcHRQcm9ncmFtOiB0cy5FbWl0QW5kU2VtYW50aWNEaWFnbm9zdGljc0J1aWxkZXJQcm9ncmFtLFxuICAgIHB1YmxpYyByZWFkb25seSBhZmZlY3RlZEZpbGVzOiBSZWFkb25seVNldDx0cy5Tb3VyY2VGaWxlPixcbiAgICBwdWJsaWMgcmVhZG9ubHkgdGVtcGxhdGVEaWFnbm9zdGljc09wdGltaXphdGlvbjogbmcuT3B0aW1pemVGb3IsXG4gICAgcHVibGljIHJlYWRvbmx5IGRpYWdub3N0aWNDYWNoZSA9IG5ldyBXZWFrTWFwPHRzLlNvdXJjZUZpbGUsIHRzLkRpYWdub3N0aWNbXT4oKSxcbiAgKSB7fVxuXG4gIGdldCBhbmd1bGFyQ29tcGlsZXIoKSB7XG4gICAgcmV0dXJuIHRoaXMuYW5ndWxhclByb2dyYW0uY29tcGlsZXI7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEFvdENvbXBpbGF0aW9uIGV4dGVuZHMgQW5ndWxhckNvbXBpbGF0aW9uIHtcbiAgI3N0YXRlPzogQW5ndWxhckNvbXBpbGF0aW9uU3RhdGU7XG5cbiAgYXN5bmMgaW5pdGlhbGl6ZShcbiAgICB0c2NvbmZpZzogc3RyaW5nLFxuICAgIGhvc3RPcHRpb25zOiBBbmd1bGFySG9zdE9wdGlvbnMsXG4gICAgY29tcGlsZXJPcHRpb25zVHJhbnNmb3JtZXI/OiAoY29tcGlsZXJPcHRpb25zOiBuZy5Db21waWxlck9wdGlvbnMpID0+IG5nLkNvbXBpbGVyT3B0aW9ucyxcbiAgKTogUHJvbWlzZTx7IGFmZmVjdGVkRmlsZXM6IFJlYWRvbmx5U2V0PHRzLlNvdXJjZUZpbGU+OyBjb21waWxlck9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucyB9PiB7XG4gICAgLy8gRHluYW1pY2FsbHkgbG9hZCB0aGUgQW5ndWxhciBjb21waWxlciBDTEkgcGFja2FnZVxuICAgIGNvbnN0IHsgTmd0c2NQcm9ncmFtLCBPcHRpbWl6ZUZvciB9ID0gYXdhaXQgQW5ndWxhckNvbXBpbGF0aW9uLmxvYWRDb21waWxlckNsaSgpO1xuXG4gICAgLy8gTG9hZCB0aGUgY29tcGlsZXIgY29uZmlndXJhdGlvbiBhbmQgdHJhbnNmb3JtIGFzIG5lZWRlZFxuICAgIGNvbnN0IHtcbiAgICAgIG9wdGlvbnM6IG9yaWdpbmFsQ29tcGlsZXJPcHRpb25zLFxuICAgICAgcm9vdE5hbWVzLFxuICAgICAgZXJyb3JzOiBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3MsXG4gICAgfSA9IGF3YWl0IHRoaXMubG9hZENvbmZpZ3VyYXRpb24odHNjb25maWcpO1xuICAgIGNvbnN0IGNvbXBpbGVyT3B0aW9ucyA9XG4gICAgICBjb21waWxlck9wdGlvbnNUcmFuc2Zvcm1lcj8uKG9yaWdpbmFsQ29tcGlsZXJPcHRpb25zKSA/PyBvcmlnaW5hbENvbXBpbGVyT3B0aW9ucztcblxuICAgIC8vIENyZWF0ZSBBbmd1bGFyIGNvbXBpbGVyIGhvc3RcbiAgICBjb25zdCBob3N0ID0gY3JlYXRlQW5ndWxhckNvbXBpbGVySG9zdChjb21waWxlck9wdGlvbnMsIGhvc3RPcHRpb25zKTtcblxuICAgIC8vIENyZWF0ZSB0aGUgQW5ndWxhciBzcGVjaWZpYyBwcm9ncmFtIHRoYXQgY29udGFpbnMgdGhlIEFuZ3VsYXIgY29tcGlsZXJcbiAgICBjb25zdCBhbmd1bGFyUHJvZ3JhbSA9IHByb2ZpbGVTeW5jKFxuICAgICAgJ05HX0NSRUFURV9QUk9HUkFNJyxcbiAgICAgICgpID0+IG5ldyBOZ3RzY1Byb2dyYW0ocm9vdE5hbWVzLCBjb21waWxlck9wdGlvbnMsIGhvc3QsIHRoaXMuI3N0YXRlPy5hbmd1bGFyUHJvZ3JhbSksXG4gICAgKTtcbiAgICBjb25zdCBhbmd1bGFyQ29tcGlsZXIgPSBhbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgICBjb25zdCBhbmd1bGFyVHlwZVNjcmlwdFByb2dyYW0gPSBhbmd1bGFyUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKTtcbiAgICBlbnN1cmVTb3VyY2VGaWxlVmVyc2lvbnMoYW5ndWxhclR5cGVTY3JpcHRQcm9ncmFtKTtcblxuICAgIGNvbnN0IHR5cGVTY3JpcHRQcm9ncmFtID0gdHMuY3JlYXRlRW1pdEFuZFNlbWFudGljRGlhZ25vc3RpY3NCdWlsZGVyUHJvZ3JhbShcbiAgICAgIGFuZ3VsYXJUeXBlU2NyaXB0UHJvZ3JhbSxcbiAgICAgIGhvc3QsXG4gICAgICB0aGlzLiNzdGF0ZT8udHlwZVNjcmlwdFByb2dyYW0sXG4gICAgICBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3MsXG4gICAgKTtcblxuICAgIGF3YWl0IHByb2ZpbGVBc3luYygnTkdfQU5BTFlaRV9QUk9HUkFNJywgKCkgPT4gYW5ndWxhckNvbXBpbGVyLmFuYWx5emVBc3luYygpKTtcbiAgICBjb25zdCBhZmZlY3RlZEZpbGVzID0gcHJvZmlsZVN5bmMoJ05HX0ZJTkRfQUZGRUNURUQnLCAoKSA9PlxuICAgICAgZmluZEFmZmVjdGVkRmlsZXModHlwZVNjcmlwdFByb2dyYW0sIGFuZ3VsYXJDb21waWxlciksXG4gICAgKTtcblxuICAgIHRoaXMuI3N0YXRlID0gbmV3IEFuZ3VsYXJDb21waWxhdGlvblN0YXRlKFxuICAgICAgYW5ndWxhclByb2dyYW0sXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbSxcbiAgICAgIGFmZmVjdGVkRmlsZXMsXG4gICAgICBhZmZlY3RlZEZpbGVzLnNpemUgPT09IDEgPyBPcHRpbWl6ZUZvci5TaW5nbGVGaWxlIDogT3B0aW1pemVGb3IuV2hvbGVQcm9ncmFtLFxuICAgICAgdGhpcy4jc3RhdGU/LmRpYWdub3N0aWNDYWNoZSxcbiAgICApO1xuXG4gICAgcmV0dXJuIHsgYWZmZWN0ZWRGaWxlcywgY29tcGlsZXJPcHRpb25zIH07XG4gIH1cblxuICAqY29sbGVjdERpYWdub3N0aWNzKCk6IEl0ZXJhYmxlPHRzLkRpYWdub3N0aWM+IHtcbiAgICBhc3NlcnQodGhpcy4jc3RhdGUsICdBbmd1bGFyIGNvbXBpbGF0aW9uIG11c3QgYmUgaW5pdGlhbGl6ZWQgcHJpb3IgdG8gY29sbGVjdGluZyBkaWFnbm9zdGljcy4nKTtcbiAgICBjb25zdCB7XG4gICAgICBhZmZlY3RlZEZpbGVzLFxuICAgICAgYW5ndWxhckNvbXBpbGVyLFxuICAgICAgZGlhZ25vc3RpY0NhY2hlLFxuICAgICAgdGVtcGxhdGVEaWFnbm9zdGljc09wdGltaXphdGlvbixcbiAgICAgIHR5cGVTY3JpcHRQcm9ncmFtLFxuICAgIH0gPSB0aGlzLiNzdGF0ZTtcblxuICAgIC8vIENvbGxlY3QgcHJvZ3JhbSBsZXZlbCBkaWFnbm9zdGljc1xuICAgIHlpZWxkKiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRDb25maWdGaWxlUGFyc2luZ0RpYWdub3N0aWNzKCk7XG4gICAgeWllbGQqIGFuZ3VsYXJDb21waWxlci5nZXRPcHRpb25EaWFnbm9zdGljcygpO1xuICAgIHlpZWxkKiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRPcHRpb25zRGlhZ25vc3RpY3MoKTtcbiAgICB5aWVsZCogdHlwZVNjcmlwdFByb2dyYW0uZ2V0R2xvYmFsRGlhZ25vc3RpY3MoKTtcblxuICAgIC8vIENvbGxlY3Qgc291cmNlIGZpbGUgc3BlY2lmaWMgZGlhZ25vc3RpY3NcbiAgICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgdHlwZVNjcmlwdFByb2dyYW0uZ2V0U291cmNlRmlsZXMoKSkge1xuICAgICAgaWYgKGFuZ3VsYXJDb21waWxlci5pZ25vcmVGb3JEaWFnbm9zdGljcy5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIFR5cGVTY3JpcHQgd2lsbCB1c2UgY2FjaGVkIGRpYWdub3N0aWNzIGZvciBmaWxlcyB0aGF0IGhhdmUgbm90IGJlZW5cbiAgICAgIC8vIGNoYW5nZWQgb3IgYWZmZWN0ZWQgZm9yIHRoaXMgYnVpbGQgd2hlbiB1c2luZyBpbmNyZW1lbnRhbCBidWlsZGluZy5cbiAgICAgIHlpZWxkKiBwcm9maWxlU3luYyhcbiAgICAgICAgJ05HX0RJQUdOT1NUSUNTX1NZTlRBQ1RJQycsXG4gICAgICAgICgpID0+IHR5cGVTY3JpcHRQcm9ncmFtLmdldFN5bnRhY3RpY0RpYWdub3N0aWNzKHNvdXJjZUZpbGUpLFxuICAgICAgICB0cnVlLFxuICAgICAgKTtcbiAgICAgIHlpZWxkKiBwcm9maWxlU3luYyhcbiAgICAgICAgJ05HX0RJQUdOT1NUSUNTX1NFTUFOVElDJyxcbiAgICAgICAgKCkgPT4gdHlwZVNjcmlwdFByb2dyYW0uZ2V0U2VtYW50aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlKSxcbiAgICAgICAgdHJ1ZSxcbiAgICAgICk7XG5cbiAgICAgIC8vIERlY2xhcmF0aW9uIGZpbGVzIGNhbm5vdCBoYXZlIHRlbXBsYXRlIGRpYWdub3N0aWNzXG4gICAgICBpZiAoc291cmNlRmlsZS5pc0RlY2xhcmF0aW9uRmlsZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gT25seSByZXF1ZXN0IEFuZ3VsYXIgdGVtcGxhdGUgZGlhZ25vc3RpY3MgZm9yIGFmZmVjdGVkIGZpbGVzIHRvIGF2b2lkXG4gICAgICAvLyBvdmVyaGVhZCBvZiB0ZW1wbGF0ZSBkaWFnbm9zdGljcyBmb3IgdW5jaGFuZ2VkIGZpbGVzLlxuICAgICAgaWYgKGFmZmVjdGVkRmlsZXMuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgIGNvbnN0IGFuZ3VsYXJEaWFnbm9zdGljcyA9IHByb2ZpbGVTeW5jKFxuICAgICAgICAgICdOR19ESUFHTk9TVElDU19URU1QTEFURScsXG4gICAgICAgICAgKCkgPT4gYW5ndWxhckNvbXBpbGVyLmdldERpYWdub3N0aWNzRm9yRmlsZShzb3VyY2VGaWxlLCB0ZW1wbGF0ZURpYWdub3N0aWNzT3B0aW1pemF0aW9uKSxcbiAgICAgICAgICB0cnVlLFxuICAgICAgICApO1xuICAgICAgICBkaWFnbm9zdGljQ2FjaGUuc2V0KHNvdXJjZUZpbGUsIGFuZ3VsYXJEaWFnbm9zdGljcyk7XG4gICAgICAgIHlpZWxkKiBhbmd1bGFyRGlhZ25vc3RpY3M7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBhbmd1bGFyRGlhZ25vc3RpY3MgPSBkaWFnbm9zdGljQ2FjaGUuZ2V0KHNvdXJjZUZpbGUpO1xuICAgICAgICBpZiAoYW5ndWxhckRpYWdub3N0aWNzKSB7XG4gICAgICAgICAgeWllbGQqIGFuZ3VsYXJEaWFnbm9zdGljcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGVtaXRBZmZlY3RlZEZpbGVzKCk6IEl0ZXJhYmxlPEVtaXRGaWxlUmVzdWx0PiB7XG4gICAgYXNzZXJ0KHRoaXMuI3N0YXRlLCAnQW5ndWxhciBjb21waWxhdGlvbiBtdXN0IGJlIGluaXRpYWxpemVkIHByaW9yIHRvIGVtaXR0aW5nIGZpbGVzLicpO1xuICAgIGNvbnN0IHsgYW5ndWxhckNvbXBpbGVyLCB0eXBlU2NyaXB0UHJvZ3JhbSB9ID0gdGhpcy4jc3RhdGU7XG4gICAgY29uc3QgYnVpbGRJbmZvRmlsZW5hbWUgPVxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0uZ2V0Q29tcGlsZXJPcHRpb25zKCkudHNCdWlsZEluZm9GaWxlID8/ICcudHNidWlsZGluZm8nO1xuXG4gICAgY29uc3QgZW1pdHRlZEZpbGVzID0gbmV3IE1hcDx0cy5Tb3VyY2VGaWxlLCBFbWl0RmlsZVJlc3VsdD4oKTtcbiAgICBjb25zdCB3cml0ZUZpbGVDYWxsYmFjazogdHMuV3JpdGVGaWxlQ2FsbGJhY2sgPSAoZmlsZW5hbWUsIGNvbnRlbnRzLCBfYSwgX2IsIHNvdXJjZUZpbGVzKSA9PiB7XG4gICAgICBpZiAoc291cmNlRmlsZXM/Lmxlbmd0aCA9PT0gMCAmJiBmaWxlbmFtZS5lbmRzV2l0aChidWlsZEluZm9GaWxlbmFtZSkpIHtcbiAgICAgICAgLy8gVE9ETzogU3RvcmUgaW5jcmVtZW50YWwgYnVpbGQgaW5mb1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGFzc2VydChzb3VyY2VGaWxlcz8ubGVuZ3RoID09PSAxLCAnSW52YWxpZCBUeXBlU2NyaXB0IHByb2dyYW0gZW1pdCBmb3IgJyArIGZpbGVuYW1lKTtcbiAgICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBzb3VyY2VGaWxlc1swXTtcbiAgICAgIGlmIChhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRW1pdC5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBlbWl0dGVkRmlsZXMuc2V0KHNvdXJjZUZpbGUsIHsgZmlsZW5hbWU6IHNvdXJjZUZpbGUuZmlsZU5hbWUsIGNvbnRlbnRzIH0pO1xuICAgIH07XG4gICAgY29uc3QgdHJhbnNmb3JtZXJzID0gbWVyZ2VUcmFuc2Zvcm1lcnMoYW5ndWxhckNvbXBpbGVyLnByZXBhcmVFbWl0KCkudHJhbnNmb3JtZXJzLCB7XG4gICAgICBiZWZvcmU6IFtyZXBsYWNlQm9vdHN0cmFwKCgpID0+IHR5cGVTY3JpcHRQcm9ncmFtLmdldFByb2dyYW0oKS5nZXRUeXBlQ2hlY2tlcigpKV0sXG4gICAgfSk7XG5cbiAgICAvLyBUeXBlU2NyaXB0IHdpbGwgbG9vcCB1bnRpbCB0aGVyZSBhcmUgbm8gbW9yZSBhZmZlY3RlZCBmaWxlcyBpbiB0aGUgcHJvZ3JhbVxuICAgIHdoaWxlIChcbiAgICAgIHR5cGVTY3JpcHRQcm9ncmFtLmVtaXROZXh0QWZmZWN0ZWRGaWxlKHdyaXRlRmlsZUNhbGxiYWNrLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJhbnNmb3JtZXJzKVxuICAgICkge1xuICAgICAgLyogZW1wdHkgKi9cbiAgICB9XG5cbiAgICAvLyBBbmd1bGFyIG1heSBoYXZlIGZpbGVzIHRoYXQgbXVzdCBiZSBlbWl0dGVkIGJ1dCBUeXBlU2NyaXB0IGRvZXMgbm90IGNvbnNpZGVyIGFmZmVjdGVkXG4gICAgZm9yIChjb25zdCBzb3VyY2VGaWxlIG9mIHR5cGVTY3JpcHRQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgIGlmIChlbWl0dGVkRmlsZXMuaGFzKHNvdXJjZUZpbGUpIHx8IGFuZ3VsYXJDb21waWxlci5pZ25vcmVGb3JFbWl0Lmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGFuZ3VsYXJDb21waWxlci5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLnNhZmVUb1NraXBFbWl0KHNvdXJjZUZpbGUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbS5lbWl0KHNvdXJjZUZpbGUsIHdyaXRlRmlsZUNhbGxiYWNrLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJhbnNmb3JtZXJzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZW1pdHRlZEZpbGVzLnZhbHVlcygpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmRBZmZlY3RlZEZpbGVzKFxuICBidWlsZGVyOiB0cy5FbWl0QW5kU2VtYW50aWNEaWFnbm9zdGljc0J1aWxkZXJQcm9ncmFtLFxuICB7IGlnbm9yZUZvckRpYWdub3N0aWNzLCBpZ25vcmVGb3JFbWl0LCBpbmNyZW1lbnRhbENvbXBpbGF0aW9uIH06IG5nLk5ndHNjUHJvZ3JhbVsnY29tcGlsZXInXSxcbik6IFNldDx0cy5Tb3VyY2VGaWxlPiB7XG4gIGNvbnN0IGFmZmVjdGVkRmlsZXMgPSBuZXcgU2V0PHRzLlNvdXJjZUZpbGU+KCk7XG5cbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnN0YW50LWNvbmRpdGlvblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGJ1aWxkZXIuZ2V0U2VtYW50aWNEaWFnbm9zdGljc09mTmV4dEFmZmVjdGVkRmlsZSh1bmRlZmluZWQsIChzb3VyY2VGaWxlKSA9PiB7XG4gICAgICAvLyBJZiB0aGUgYWZmZWN0ZWQgZmlsZSBpcyBhIFRUQyBzaGltLCBhZGQgdGhlIHNoaW0ncyBvcmlnaW5hbCBzb3VyY2UgZmlsZS5cbiAgICAgIC8vIFRoaXMgZW5zdXJlcyB0aGF0IGNoYW5nZXMgdGhhdCBhZmZlY3QgVFRDIGFyZSB0eXBlY2hlY2tlZCBldmVuIHdoZW4gdGhlIGNoYW5nZXNcbiAgICAgIC8vIGFyZSBvdGhlcndpc2UgdW5yZWxhdGVkIGZyb20gYSBUUyBwZXJzcGVjdGl2ZSBhbmQgZG8gbm90IHJlc3VsdCBpbiBJdnkgY29kZWdlbiBjaGFuZ2VzLlxuICAgICAgLy8gRm9yIGV4YW1wbGUsIGNoYW5naW5nIEBJbnB1dCBwcm9wZXJ0eSB0eXBlcyBvZiBhIGRpcmVjdGl2ZSB1c2VkIGluIGFub3RoZXIgY29tcG9uZW50J3NcbiAgICAgIC8vIHRlbXBsYXRlLlxuICAgICAgLy8gQSBUVEMgc2hpbSBpcyBhIGZpbGUgdGhhdCBoYXMgYmVlbiBpZ25vcmVkIGZvciBkaWFnbm9zdGljcyBhbmQgaGFzIGEgZmlsZW5hbWUgZW5kaW5nIGluIGAubmd0eXBlY2hlY2sudHNgLlxuICAgICAgaWYgKGlnbm9yZUZvckRpYWdub3N0aWNzLmhhcyhzb3VyY2VGaWxlKSAmJiBzb3VyY2VGaWxlLmZpbGVOYW1lLmVuZHNXaXRoKCcubmd0eXBlY2hlY2sudHMnKSkge1xuICAgICAgICAvLyBUaGlzIGZpbGUgbmFtZSBjb252ZXJzaW9uIHJlbGllcyBvbiBpbnRlcm5hbCBjb21waWxlciBsb2dpYyBhbmQgc2hvdWxkIGJlIGNvbnZlcnRlZFxuICAgICAgICAvLyB0byBhbiBvZmZpY2lhbCBtZXRob2Qgd2hlbiBhdmFpbGFibGUuIDE1IGlzIGxlbmd0aCBvZiBgLm5ndHlwZWNoZWNrLnRzYFxuICAgICAgICBjb25zdCBvcmlnaW5hbEZpbGVuYW1lID0gc291cmNlRmlsZS5maWxlTmFtZS5zbGljZSgwLCAtMTUpICsgJy50cyc7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsU291cmNlRmlsZSA9IGJ1aWxkZXIuZ2V0U291cmNlRmlsZShvcmlnaW5hbEZpbGVuYW1lKTtcbiAgICAgICAgaWYgKG9yaWdpbmFsU291cmNlRmlsZSkge1xuICAgICAgICAgIGFmZmVjdGVkRmlsZXMuYWRkKG9yaWdpbmFsU291cmNlRmlsZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuXG4gICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGFmZmVjdGVkRmlsZXMuYWRkKHJlc3VsdC5hZmZlY3RlZCBhcyB0cy5Tb3VyY2VGaWxlKTtcbiAgfVxuXG4gIC8vIEEgZmlsZSBpcyBhbHNvIGFmZmVjdGVkIGlmIHRoZSBBbmd1bGFyIGNvbXBpbGVyIHJlcXVpcmVzIGl0IHRvIGJlIGVtaXR0ZWRcbiAgZm9yIChjb25zdCBzb3VyY2VGaWxlIG9mIGJ1aWxkZXIuZ2V0U291cmNlRmlsZXMoKSkge1xuICAgIGlmIChpZ25vcmVGb3JFbWl0Lmhhcyhzb3VyY2VGaWxlKSB8fCBpbmNyZW1lbnRhbENvbXBpbGF0aW9uLnNhZmVUb1NraXBFbWl0KHNvdXJjZUZpbGUpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBhZmZlY3RlZEZpbGVzLmFkZChzb3VyY2VGaWxlKTtcbiAgfVxuXG4gIHJldHVybiBhZmZlY3RlZEZpbGVzO1xufVxuIl19