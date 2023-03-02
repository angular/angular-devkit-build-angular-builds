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
var _a, _AngularCompilation_angularCompilerCliModule, _AngularCompilation_state;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AngularCompilation = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const typescript_1 = __importDefault(require("typescript"));
const load_esm_1 = require("../../utils/load-esm");
const angular_host_1 = require("./angular-host");
const profiling_1 = require("./profiling");
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
class AngularCompilation {
    static async loadCompilerCli() {
        // This uses a wrapped dynamic import to load `@angular/compiler-cli` which is ESM.
        // Once TypeScript provides support for retaining dynamic imports this workaround can be dropped.
        __classPrivateFieldSet(this, _a, __classPrivateFieldGet(this, _a, "f", _AngularCompilation_angularCompilerCliModule) ?? await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli'), "f", _AngularCompilation_angularCompilerCliModule);
        return __classPrivateFieldGet(this, _a, "f", _AngularCompilation_angularCompilerCliModule);
    }
    constructor() {
        _AngularCompilation_state.set(this, void 0);
    }
    async initialize(rootNames, compilerOptions, hostOptions, configurationDiagnostics) {
        // Dynamically load the Angular compiler CLI package
        const { NgtscProgram, OptimizeFor } = await AngularCompilation.loadCompilerCli();
        // Create Angular compiler host
        const host = (0, angular_host_1.createAngularCompilerHost)(compilerOptions, hostOptions);
        // Create the Angular specific program that contains the Angular compiler
        const angularProgram = (0, profiling_1.profileSync)('NG_CREATE_PROGRAM', () => new NgtscProgram(rootNames, compilerOptions, host, __classPrivateFieldGet(this, _AngularCompilation_state, "f")?.angularProgram));
        const angularCompiler = angularProgram.compiler;
        const angularTypeScriptProgram = angularProgram.getTsProgram();
        (0, angular_host_1.ensureSourceFileVersions)(angularTypeScriptProgram);
        const typeScriptProgram = typescript_1.default.createEmitAndSemanticDiagnosticsBuilderProgram(angularTypeScriptProgram, host, __classPrivateFieldGet(this, _AngularCompilation_state, "f")?.typeScriptProgram, configurationDiagnostics);
        await (0, profiling_1.profileAsync)('NG_ANALYZE_PROGRAM', () => angularCompiler.analyzeAsync());
        const affectedFiles = (0, profiling_1.profileSync)('NG_FIND_AFFECTED', () => findAffectedFiles(typeScriptProgram, angularCompiler));
        __classPrivateFieldSet(this, _AngularCompilation_state, new AngularCompilationState(angularProgram, typeScriptProgram, affectedFiles, affectedFiles.size === 1 ? OptimizeFor.SingleFile : OptimizeFor.WholeProgram, __classPrivateFieldGet(this, _AngularCompilation_state, "f")?.diagnosticCache), "f");
        return { affectedFiles };
    }
    *collectDiagnostics() {
        (0, node_assert_1.default)(__classPrivateFieldGet(this, _AngularCompilation_state, "f"), 'Angular compilation must be initialized prior to collecting diagnostics.');
        const { affectedFiles, angularCompiler, diagnosticCache, templateDiagnosticsOptimization, typeScriptProgram, } = __classPrivateFieldGet(this, _AngularCompilation_state, "f");
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
        (0, node_assert_1.default)(__classPrivateFieldGet(this, _AngularCompilation_state, "f"), 'Angular compilation must be initialized prior to emitting files.');
        const { angularCompiler, typeScriptProgram } = __classPrivateFieldGet(this, _AngularCompilation_state, "f");
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
exports.AngularCompilation = AngularCompilation;
_a = AngularCompilation, _AngularCompilation_state = new WeakMap();
_AngularCompilation_angularCompilerCliModule = { value: void 0 };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5ndWxhci1jb21waWxhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9hbmd1bGFyLWNvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw0REFBNEI7QUFDNUIsbURBQXFEO0FBQ3JELGlEQUl3QjtBQUN4QiwyQ0FBd0Q7QUFFeEQsZ0RBQWdEO0FBQ2hELCtGQUErRjtBQUMvRixNQUFNLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxPQUFPLENBQUMseUNBQXlDLENBQUMsQ0FBQztBQUVuRyxNQUFNLHVCQUF1QjtJQUMzQixZQUNrQixjQUErQixFQUMvQixpQkFBOEQsRUFDOUQsYUFBeUMsRUFDekMsK0JBQStDLEVBQy9DLGtCQUFrQixJQUFJLE9BQU8sRUFBa0M7UUFKL0QsbUJBQWMsR0FBZCxjQUFjLENBQWlCO1FBQy9CLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBNkM7UUFDOUQsa0JBQWEsR0FBYixhQUFhLENBQTRCO1FBQ3pDLG9DQUErQixHQUEvQiwrQkFBK0IsQ0FBZ0I7UUFDL0Msb0JBQWUsR0FBZixlQUFlLENBQWdEO0lBQzlFLENBQUM7SUFFSixJQUFJLGVBQWU7UUFDakIsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQztJQUN0QyxDQUFDO0NBQ0Y7QUFTRCxNQUFhLGtCQUFrQjtJQUs3QixNQUFNLENBQUMsS0FBSyxDQUFDLGVBQWU7UUFDMUIsbUZBQW1GO1FBQ25GLGlHQUFpRztRQUNqRyx3SEFBbUMsTUFBTSxJQUFBLHdCQUFhLEVBQVksdUJBQXVCLENBQUMsb0RBQUEsQ0FBQztRQUUzRixPQUFPLHVCQUFBLElBQUksd0RB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QUEyRTtZQUMzRSxrRkFBa0Y7WUFDbEYsMEZBQTBGO1lBQzFGLHlGQUF5RjtZQUN6RixZQUFZO1lBQ1osNkdBQTZHO1lBQzdHLElBQUksb0JBQW9CLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLEVBQUU7Z0JBQzNGLHNGQUFzRjtnQkFDdEYsMEVBQTBFO2dCQUMxRSxNQUFNLGdCQUFnQixHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQztnQkFDbkUsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLENBQUM7Z0JBQ25FLElBQUksa0JBQWtCLEVBQUU7b0JBQ3RCLGFBQWEsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztpQkFDdkM7Z0JBRUQsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUVELE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ1gsTUFBTTtTQUNQO1FBRUQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBeUIsQ0FBQyxDQUFDO0tBQ3JEO0lBRUQsNEVBQTRFO0lBQzVFLEtBQUssTUFBTSxVQUFVLElBQUksT0FBTyxDQUFDLGNBQWMsRUFBRSxFQUFFO1FBQ2pELElBQUksYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxzQkFBc0IsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDdEYsU0FBUztTQUNWO1FBRUQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztLQUMvQjtJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgbmcgZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcbmltcG9ydCB7XG4gIEFuZ3VsYXJIb3N0T3B0aW9ucyxcbiAgY3JlYXRlQW5ndWxhckNvbXBpbGVySG9zdCxcbiAgZW5zdXJlU291cmNlRmlsZVZlcnNpb25zLFxufSBmcm9tICcuL2FuZ3VsYXItaG9zdCc7XG5pbXBvcnQgeyBwcm9maWxlQXN5bmMsIHByb2ZpbGVTeW5jIH0gZnJvbSAnLi9wcm9maWxpbmcnO1xuXG4vLyBUZW1wb3JhcnkgZGVlcCBpbXBvcnQgZm9yIHRyYW5zZm9ybWVyIHN1cHBvcnRcbi8vIFRPRE86IE1vdmUgdGhlc2UgdG8gYSBwcml2YXRlIGV4cG9ydHMgbG9jYXRpb24gb3IgbW92ZSB0aGUgaW1wbGVtZW50YXRpb24gaW50byB0aGlzIHBhY2thZ2UuXG5jb25zdCB7IG1lcmdlVHJhbnNmb3JtZXJzLCByZXBsYWNlQm9vdHN0cmFwIH0gPSByZXF1aXJlKCdAbmd0b29scy93ZWJwYWNrL3NyYy9pdnkvdHJhbnNmb3JtYXRpb24nKTtcblxuY2xhc3MgQW5ndWxhckNvbXBpbGF0aW9uU3RhdGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgcmVhZG9ubHkgYW5ndWxhclByb2dyYW06IG5nLk5ndHNjUHJvZ3JhbSxcbiAgICBwdWJsaWMgcmVhZG9ubHkgdHlwZVNjcmlwdFByb2dyYW06IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0sXG4gICAgcHVibGljIHJlYWRvbmx5IGFmZmVjdGVkRmlsZXM6IFJlYWRvbmx5U2V0PHRzLlNvdXJjZUZpbGU+LFxuICAgIHB1YmxpYyByZWFkb25seSB0ZW1wbGF0ZURpYWdub3N0aWNzT3B0aW1pemF0aW9uOiBuZy5PcHRpbWl6ZUZvcixcbiAgICBwdWJsaWMgcmVhZG9ubHkgZGlhZ25vc3RpY0NhY2hlID0gbmV3IFdlYWtNYXA8dHMuU291cmNlRmlsZSwgdHMuRGlhZ25vc3RpY1tdPigpLFxuICApIHt9XG5cbiAgZ2V0IGFuZ3VsYXJDb21waWxlcigpIHtcbiAgICByZXR1cm4gdGhpcy5hbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEVtaXRGaWxlUmVzdWx0IHtcbiAgY29udGVudD86IHN0cmluZztcbiAgbWFwPzogc3RyaW5nO1xuICBkZXBlbmRlbmNpZXM6IHJlYWRvbmx5IHN0cmluZ1tdO1xufVxuZXhwb3J0IHR5cGUgRmlsZUVtaXR0ZXIgPSAoZmlsZTogc3RyaW5nKSA9PiBQcm9taXNlPEVtaXRGaWxlUmVzdWx0IHwgdW5kZWZpbmVkPjtcblxuZXhwb3J0IGNsYXNzIEFuZ3VsYXJDb21waWxhdGlvbiB7XG4gIHN0YXRpYyAjYW5ndWxhckNvbXBpbGVyQ2xpTW9kdWxlPzogdHlwZW9mIG5nO1xuXG4gICNzdGF0ZT86IEFuZ3VsYXJDb21waWxhdGlvblN0YXRlO1xuXG4gIHN0YXRpYyBhc3luYyBsb2FkQ29tcGlsZXJDbGkoKTogUHJvbWlzZTx0eXBlb2Ygbmc+IHtcbiAgICAvLyBUaGlzIHVzZXMgYSB3cmFwcGVkIGR5bmFtaWMgaW1wb3J0IHRvIGxvYWQgYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgd2hpY2ggaXMgRVNNLlxuICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciByZXRhaW5pbmcgZHluYW1pYyBpbXBvcnRzIHRoaXMgd29ya2Fyb3VuZCBjYW4gYmUgZHJvcHBlZC5cbiAgICB0aGlzLiNhbmd1bGFyQ29tcGlsZXJDbGlNb2R1bGUgPz89IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIG5nPignQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk7XG5cbiAgICByZXR1cm4gdGhpcy4jYW5ndWxhckNvbXBpbGVyQ2xpTW9kdWxlO1xuICB9XG5cbiAgY29uc3RydWN0b3IoKSB7fVxuXG4gIGFzeW5jIGluaXRpYWxpemUoXG4gICAgcm9vdE5hbWVzOiBzdHJpbmdbXSxcbiAgICBjb21waWxlck9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucyxcbiAgICBob3N0T3B0aW9uczogQW5ndWxhckhvc3RPcHRpb25zLFxuICAgIGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcz86IHRzLkRpYWdub3N0aWNbXSxcbiAgKTogUHJvbWlzZTx7IGFmZmVjdGVkRmlsZXM6IFJlYWRvbmx5U2V0PHRzLlNvdXJjZUZpbGU+IH0+IHtcbiAgICAvLyBEeW5hbWljYWxseSBsb2FkIHRoZSBBbmd1bGFyIGNvbXBpbGVyIENMSSBwYWNrYWdlXG4gICAgY29uc3QgeyBOZ3RzY1Byb2dyYW0sIE9wdGltaXplRm9yIH0gPSBhd2FpdCBBbmd1bGFyQ29tcGlsYXRpb24ubG9hZENvbXBpbGVyQ2xpKCk7XG5cbiAgICAvLyBDcmVhdGUgQW5ndWxhciBjb21waWxlciBob3N0XG4gICAgY29uc3QgaG9zdCA9IGNyZWF0ZUFuZ3VsYXJDb21waWxlckhvc3QoY29tcGlsZXJPcHRpb25zLCBob3N0T3B0aW9ucyk7XG5cbiAgICAvLyBDcmVhdGUgdGhlIEFuZ3VsYXIgc3BlY2lmaWMgcHJvZ3JhbSB0aGF0IGNvbnRhaW5zIHRoZSBBbmd1bGFyIGNvbXBpbGVyXG4gICAgY29uc3QgYW5ndWxhclByb2dyYW0gPSBwcm9maWxlU3luYyhcbiAgICAgICdOR19DUkVBVEVfUFJPR1JBTScsXG4gICAgICAoKSA9PiBuZXcgTmd0c2NQcm9ncmFtKHJvb3ROYW1lcywgY29tcGlsZXJPcHRpb25zLCBob3N0LCB0aGlzLiNzdGF0ZT8uYW5ndWxhclByb2dyYW0pLFxuICAgICk7XG4gICAgY29uc3QgYW5ndWxhckNvbXBpbGVyID0gYW5ndWxhclByb2dyYW0uY29tcGlsZXI7XG4gICAgY29uc3QgYW5ndWxhclR5cGVTY3JpcHRQcm9ncmFtID0gYW5ndWxhclByb2dyYW0uZ2V0VHNQcm9ncmFtKCk7XG4gICAgZW5zdXJlU291cmNlRmlsZVZlcnNpb25zKGFuZ3VsYXJUeXBlU2NyaXB0UHJvZ3JhbSk7XG5cbiAgICBjb25zdCB0eXBlU2NyaXB0UHJvZ3JhbSA9IHRzLmNyZWF0ZUVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0oXG4gICAgICBhbmd1bGFyVHlwZVNjcmlwdFByb2dyYW0sXG4gICAgICBob3N0LFxuICAgICAgdGhpcy4jc3RhdGU/LnR5cGVTY3JpcHRQcm9ncmFtLFxuICAgICAgY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgICk7XG5cbiAgICBhd2FpdCBwcm9maWxlQXN5bmMoJ05HX0FOQUxZWkVfUFJPR1JBTScsICgpID0+IGFuZ3VsYXJDb21waWxlci5hbmFseXplQXN5bmMoKSk7XG4gICAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IHByb2ZpbGVTeW5jKCdOR19GSU5EX0FGRkVDVEVEJywgKCkgPT5cbiAgICAgIGZpbmRBZmZlY3RlZEZpbGVzKHR5cGVTY3JpcHRQcm9ncmFtLCBhbmd1bGFyQ29tcGlsZXIpLFxuICAgICk7XG5cbiAgICB0aGlzLiNzdGF0ZSA9IG5ldyBBbmd1bGFyQ29tcGlsYXRpb25TdGF0ZShcbiAgICAgIGFuZ3VsYXJQcm9ncmFtLFxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0sXG4gICAgICBhZmZlY3RlZEZpbGVzLFxuICAgICAgYWZmZWN0ZWRGaWxlcy5zaXplID09PSAxID8gT3B0aW1pemVGb3IuU2luZ2xlRmlsZSA6IE9wdGltaXplRm9yLldob2xlUHJvZ3JhbSxcbiAgICAgIHRoaXMuI3N0YXRlPy5kaWFnbm9zdGljQ2FjaGUsXG4gICAgKTtcblxuICAgIHJldHVybiB7IGFmZmVjdGVkRmlsZXMgfTtcbiAgfVxuXG4gICpjb2xsZWN0RGlhZ25vc3RpY3MoKTogSXRlcmFibGU8dHMuRGlhZ25vc3RpYz4ge1xuICAgIGFzc2VydCh0aGlzLiNzdGF0ZSwgJ0FuZ3VsYXIgY29tcGlsYXRpb24gbXVzdCBiZSBpbml0aWFsaXplZCBwcmlvciB0byBjb2xsZWN0aW5nIGRpYWdub3N0aWNzLicpO1xuICAgIGNvbnN0IHtcbiAgICAgIGFmZmVjdGVkRmlsZXMsXG4gICAgICBhbmd1bGFyQ29tcGlsZXIsXG4gICAgICBkaWFnbm9zdGljQ2FjaGUsXG4gICAgICB0ZW1wbGF0ZURpYWdub3N0aWNzT3B0aW1pemF0aW9uLFxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0sXG4gICAgfSA9IHRoaXMuI3N0YXRlO1xuXG4gICAgLy8gQ29sbGVjdCBwcm9ncmFtIGxldmVsIGRpYWdub3N0aWNzXG4gICAgeWllbGQqIHR5cGVTY3JpcHRQcm9ncmFtLmdldENvbmZpZ0ZpbGVQYXJzaW5nRGlhZ25vc3RpY3MoKTtcbiAgICB5aWVsZCogYW5ndWxhckNvbXBpbGVyLmdldE9wdGlvbkRpYWdub3N0aWNzKCk7XG4gICAgeWllbGQqIHR5cGVTY3JpcHRQcm9ncmFtLmdldE9wdGlvbnNEaWFnbm9zdGljcygpO1xuICAgIHlpZWxkKiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRHbG9iYWxEaWFnbm9zdGljcygpO1xuXG4gICAgLy8gQ29sbGVjdCBzb3VyY2UgZmlsZSBzcGVjaWZpYyBkaWFnbm9zdGljc1xuICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICBpZiAoYW5ndWxhckNvbXBpbGVyLmlnbm9yZUZvckRpYWdub3N0aWNzLmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gVHlwZVNjcmlwdCB3aWxsIHVzZSBjYWNoZWQgZGlhZ25vc3RpY3MgZm9yIGZpbGVzIHRoYXQgaGF2ZSBub3QgYmVlblxuICAgICAgLy8gY2hhbmdlZCBvciBhZmZlY3RlZCBmb3IgdGhpcyBidWlsZCB3aGVuIHVzaW5nIGluY3JlbWVudGFsIGJ1aWxkaW5nLlxuICAgICAgeWllbGQqIHByb2ZpbGVTeW5jKFxuICAgICAgICAnTkdfRElBR05PU1RJQ1NfU1lOVEFDVElDJyxcbiAgICAgICAgKCkgPT4gdHlwZVNjcmlwdFByb2dyYW0uZ2V0U3ludGFjdGljRGlhZ25vc3RpY3Moc291cmNlRmlsZSksXG4gICAgICAgIHRydWUsXG4gICAgICApO1xuICAgICAgeWllbGQqIHByb2ZpbGVTeW5jKFxuICAgICAgICAnTkdfRElBR05PU1RJQ1NfU0VNQU5USUMnLFxuICAgICAgICAoKSA9PiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKHNvdXJjZUZpbGUpLFxuICAgICAgICB0cnVlLFxuICAgICAgKTtcblxuICAgICAgLy8gRGVjbGFyYXRpb24gZmlsZXMgY2Fubm90IGhhdmUgdGVtcGxhdGUgZGlhZ25vc3RpY3NcbiAgICAgIGlmIChzb3VyY2VGaWxlLmlzRGVjbGFyYXRpb25GaWxlKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBPbmx5IHJlcXVlc3QgQW5ndWxhciB0ZW1wbGF0ZSBkaWFnbm9zdGljcyBmb3IgYWZmZWN0ZWQgZmlsZXMgdG8gYXZvaWRcbiAgICAgIC8vIG92ZXJoZWFkIG9mIHRlbXBsYXRlIGRpYWdub3N0aWNzIGZvciB1bmNoYW5nZWQgZmlsZXMuXG4gICAgICBpZiAoYWZmZWN0ZWRGaWxlcy5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gcHJvZmlsZVN5bmMoXG4gICAgICAgICAgJ05HX0RJQUdOT1NUSUNTX1RFTVBMQVRFJyxcbiAgICAgICAgICAoKSA9PiBhbmd1bGFyQ29tcGlsZXIuZ2V0RGlhZ25vc3RpY3NGb3JGaWxlKHNvdXJjZUZpbGUsIHRlbXBsYXRlRGlhZ25vc3RpY3NPcHRpbWl6YXRpb24pLFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICk7XG4gICAgICAgIGRpYWdub3N0aWNDYWNoZS5zZXQoc291cmNlRmlsZSwgYW5ndWxhckRpYWdub3N0aWNzKTtcbiAgICAgICAgeWllbGQqIGFuZ3VsYXJEaWFnbm9zdGljcztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGFuZ3VsYXJEaWFnbm9zdGljcyA9IGRpYWdub3N0aWNDYWNoZS5nZXQoc291cmNlRmlsZSk7XG4gICAgICAgIGlmIChhbmd1bGFyRGlhZ25vc3RpY3MpIHtcbiAgICAgICAgICB5aWVsZCogYW5ndWxhckRpYWdub3N0aWNzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY3JlYXRlRmlsZUVtaXR0ZXIob25BZnRlckVtaXQ/OiAoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSkgPT4gdm9pZCk6IEZpbGVFbWl0dGVyIHtcbiAgICBhc3NlcnQodGhpcy4jc3RhdGUsICdBbmd1bGFyIGNvbXBpbGF0aW9uIG11c3QgYmUgaW5pdGlhbGl6ZWQgcHJpb3IgdG8gZW1pdHRpbmcgZmlsZXMuJyk7XG4gICAgY29uc3QgeyBhbmd1bGFyQ29tcGlsZXIsIHR5cGVTY3JpcHRQcm9ncmFtIH0gPSB0aGlzLiNzdGF0ZTtcblxuICAgIGNvbnN0IHRyYW5zZm9ybWVycyA9IG1lcmdlVHJhbnNmb3JtZXJzKGFuZ3VsYXJDb21waWxlci5wcmVwYXJlRW1pdCgpLnRyYW5zZm9ybWVycywge1xuICAgICAgYmVmb3JlOiBbcmVwbGFjZUJvb3RzdHJhcCgoKSA9PiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRQcm9ncmFtKCkuZ2V0VHlwZUNoZWNrZXIoKSldLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGFzeW5jIChmaWxlOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IHNvdXJjZUZpbGUgPSB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTb3VyY2VGaWxlKGZpbGUpO1xuICAgICAgaWYgKCFzb3VyY2VGaWxlKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG5cbiAgICAgIGxldCBjb250ZW50OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbS5lbWl0KFxuICAgICAgICBzb3VyY2VGaWxlLFxuICAgICAgICAoZmlsZW5hbWUsIGRhdGEpID0+IHtcbiAgICAgICAgICBpZiAoL1xcLltjbV0/anMkLy50ZXN0KGZpbGVuYW1lKSkge1xuICAgICAgICAgICAgY29udGVudCA9IGRhdGE7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB1bmRlZmluZWQgLyogY2FuY2VsbGF0aW9uVG9rZW4gKi8sXG4gICAgICAgIHVuZGVmaW5lZCAvKiBlbWl0T25seUR0c0ZpbGVzICovLFxuICAgICAgICB0cmFuc2Zvcm1lcnMsXG4gICAgICApO1xuXG4gICAgICBhbmd1bGFyQ29tcGlsZXIuaW5jcmVtZW50YWxDb21waWxhdGlvbi5yZWNvcmRTdWNjZXNzZnVsRW1pdChzb3VyY2VGaWxlKTtcbiAgICAgIG9uQWZ0ZXJFbWl0Py4oc291cmNlRmlsZSk7XG5cbiAgICAgIHJldHVybiB7IGNvbnRlbnQsIGRlcGVuZGVuY2llczogW10gfTtcbiAgICB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmRBZmZlY3RlZEZpbGVzKFxuICBidWlsZGVyOiB0cy5FbWl0QW5kU2VtYW50aWNEaWFnbm9zdGljc0J1aWxkZXJQcm9ncmFtLFxuICB7IGlnbm9yZUZvckRpYWdub3N0aWNzLCBpZ25vcmVGb3JFbWl0LCBpbmNyZW1lbnRhbENvbXBpbGF0aW9uIH06IG5nLk5ndHNjUHJvZ3JhbVsnY29tcGlsZXInXSxcbik6IFNldDx0cy5Tb3VyY2VGaWxlPiB7XG4gIGNvbnN0IGFmZmVjdGVkRmlsZXMgPSBuZXcgU2V0PHRzLlNvdXJjZUZpbGU+KCk7XG5cbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnN0YW50LWNvbmRpdGlvblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGJ1aWxkZXIuZ2V0U2VtYW50aWNEaWFnbm9zdGljc09mTmV4dEFmZmVjdGVkRmlsZSh1bmRlZmluZWQsIChzb3VyY2VGaWxlKSA9PiB7XG4gICAgICAvLyBJZiB0aGUgYWZmZWN0ZWQgZmlsZSBpcyBhIFRUQyBzaGltLCBhZGQgdGhlIHNoaW0ncyBvcmlnaW5hbCBzb3VyY2UgZmlsZS5cbiAgICAgIC8vIFRoaXMgZW5zdXJlcyB0aGF0IGNoYW5nZXMgdGhhdCBhZmZlY3QgVFRDIGFyZSB0eXBlY2hlY2tlZCBldmVuIHdoZW4gdGhlIGNoYW5nZXNcbiAgICAgIC8vIGFyZSBvdGhlcndpc2UgdW5yZWxhdGVkIGZyb20gYSBUUyBwZXJzcGVjdGl2ZSBhbmQgZG8gbm90IHJlc3VsdCBpbiBJdnkgY29kZWdlbiBjaGFuZ2VzLlxuICAgICAgLy8gRm9yIGV4YW1wbGUsIGNoYW5naW5nIEBJbnB1dCBwcm9wZXJ0eSB0eXBlcyBvZiBhIGRpcmVjdGl2ZSB1c2VkIGluIGFub3RoZXIgY29tcG9uZW50J3NcbiAgICAgIC8vIHRlbXBsYXRlLlxuICAgICAgLy8gQSBUVEMgc2hpbSBpcyBhIGZpbGUgdGhhdCBoYXMgYmVlbiBpZ25vcmVkIGZvciBkaWFnbm9zdGljcyBhbmQgaGFzIGEgZmlsZW5hbWUgZW5kaW5nIGluIGAubmd0eXBlY2hlY2sudHNgLlxuICAgICAgaWYgKGlnbm9yZUZvckRpYWdub3N0aWNzLmhhcyhzb3VyY2VGaWxlKSAmJiBzb3VyY2VGaWxlLmZpbGVOYW1lLmVuZHNXaXRoKCcubmd0eXBlY2hlY2sudHMnKSkge1xuICAgICAgICAvLyBUaGlzIGZpbGUgbmFtZSBjb252ZXJzaW9uIHJlbGllcyBvbiBpbnRlcm5hbCBjb21waWxlciBsb2dpYyBhbmQgc2hvdWxkIGJlIGNvbnZlcnRlZFxuICAgICAgICAvLyB0byBhbiBvZmZpY2lhbCBtZXRob2Qgd2hlbiBhdmFpbGFibGUuIDE1IGlzIGxlbmd0aCBvZiBgLm5ndHlwZWNoZWNrLnRzYFxuICAgICAgICBjb25zdCBvcmlnaW5hbEZpbGVuYW1lID0gc291cmNlRmlsZS5maWxlTmFtZS5zbGljZSgwLCAtMTUpICsgJy50cyc7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsU291cmNlRmlsZSA9IGJ1aWxkZXIuZ2V0U291cmNlRmlsZShvcmlnaW5hbEZpbGVuYW1lKTtcbiAgICAgICAgaWYgKG9yaWdpbmFsU291cmNlRmlsZSkge1xuICAgICAgICAgIGFmZmVjdGVkRmlsZXMuYWRkKG9yaWdpbmFsU291cmNlRmlsZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuXG4gICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGFmZmVjdGVkRmlsZXMuYWRkKHJlc3VsdC5hZmZlY3RlZCBhcyB0cy5Tb3VyY2VGaWxlKTtcbiAgfVxuXG4gIC8vIEEgZmlsZSBpcyBhbHNvIGFmZmVjdGVkIGlmIHRoZSBBbmd1bGFyIGNvbXBpbGVyIHJlcXVpcmVzIGl0IHRvIGJlIGVtaXR0ZWRcbiAgZm9yIChjb25zdCBzb3VyY2VGaWxlIG9mIGJ1aWxkZXIuZ2V0U291cmNlRmlsZXMoKSkge1xuICAgIGlmIChpZ25vcmVGb3JFbWl0Lmhhcyhzb3VyY2VGaWxlKSB8fCBpbmNyZW1lbnRhbENvbXBpbGF0aW9uLnNhZmVUb1NraXBFbWl0KHNvdXJjZUZpbGUpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBhZmZlY3RlZEZpbGVzLmFkZChzb3VyY2VGaWxlKTtcbiAgfVxuXG4gIHJldHVybiBhZmZlY3RlZEZpbGVzO1xufVxuIl19