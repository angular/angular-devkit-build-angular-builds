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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW90LWNvbXBpbGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2FuZ3VsYXIvYW90LWNvbXBpbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILDhEQUFpQztBQUNqQyw0REFBNEI7QUFDNUIsNENBQXlEO0FBQ3pELCtEQUEyRTtBQUMzRSxpREFJd0I7QUFFeEIsZ0RBQWdEO0FBQ2hELCtGQUErRjtBQUMvRixNQUFNLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxPQUFPLENBQUMseUNBQXlDLENBQUMsQ0FBQztBQUVuRyxNQUFNLHVCQUF1QjtJQUMzQixZQUNrQixjQUErQixFQUMvQixZQUE2QixFQUM3QixpQkFBOEQsRUFDOUQsYUFBeUMsRUFDekMsK0JBQStDLEVBQy9DLGtCQUFrQixJQUFJLE9BQU8sRUFBa0M7UUFML0QsbUJBQWMsR0FBZCxjQUFjLENBQWlCO1FBQy9CLGlCQUFZLEdBQVosWUFBWSxDQUFpQjtRQUM3QixzQkFBaUIsR0FBakIsaUJBQWlCLENBQTZDO1FBQzlELGtCQUFhLEdBQWIsYUFBYSxDQUE0QjtRQUN6QyxvQ0FBK0IsR0FBL0IsK0JBQStCLENBQWdCO1FBQy9DLG9CQUFlLEdBQWYsZUFBZSxDQUFnRDtJQUM5RSxDQUFDO0lBRUosSUFBSSxlQUFlO1FBQ2pCLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUM7SUFDdEMsQ0FBQztDQUNGO0FBRUQsTUFBYSxjQUFlLFNBQVEsd0NBQWtCO0lBQXREOztRQUNFLHdDQUFpQztJQXdMbkMsQ0FBQztJQXRMQyxLQUFLLENBQUMsVUFBVSxDQUNkLFFBQWdCLEVBQ2hCLFdBQStCLEVBQy9CLDBCQUF3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SUFDaEgsbUJBQW1CO0lBQ25CLElBQUksVUFBVSxFQUFFO1FBQ2QsS0FBSyxNQUFNLFVBQVUsSUFBSSxPQUFPLENBQUMsY0FBYyxFQUFFLEVBQUU7WUFDakQsSUFBSSxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksVUFBVSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUMsRUFBRTtnQkFDM0Ysc0ZBQXNGO2dCQUN0RiwwRUFBMEU7Z0JBQzFFLE1BQU0sZ0JBQWdCLEdBQUcsVUFBVSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDO2dCQUNuRSxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztnQkFDbkUsSUFBSSxrQkFBa0IsRUFBRTtvQkFDdEIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO2lCQUN2QzthQUNGO1NBQ0Y7S0FDRjtJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgbmcgZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHsgcHJvZmlsZUFzeW5jLCBwcm9maWxlU3luYyB9IGZyb20gJy4uL3Byb2ZpbGluZyc7XG5pbXBvcnQgeyBBbmd1bGFyQ29tcGlsYXRpb24sIEVtaXRGaWxlUmVzdWx0IH0gZnJvbSAnLi9hbmd1bGFyLWNvbXBpbGF0aW9uJztcbmltcG9ydCB7XG4gIEFuZ3VsYXJIb3N0T3B0aW9ucyxcbiAgY3JlYXRlQW5ndWxhckNvbXBpbGVySG9zdCxcbiAgZW5zdXJlU291cmNlRmlsZVZlcnNpb25zLFxufSBmcm9tICcuL2FuZ3VsYXItaG9zdCc7XG5cbi8vIFRlbXBvcmFyeSBkZWVwIGltcG9ydCBmb3IgdHJhbnNmb3JtZXIgc3VwcG9ydFxuLy8gVE9ETzogTW92ZSB0aGVzZSB0byBhIHByaXZhdGUgZXhwb3J0cyBsb2NhdGlvbiBvciBtb3ZlIHRoZSBpbXBsZW1lbnRhdGlvbiBpbnRvIHRoaXMgcGFja2FnZS5cbmNvbnN0IHsgbWVyZ2VUcmFuc2Zvcm1lcnMsIHJlcGxhY2VCb290c3RyYXAgfSA9IHJlcXVpcmUoJ0BuZ3Rvb2xzL3dlYnBhY2svc3JjL2l2eS90cmFuc2Zvcm1hdGlvbicpO1xuXG5jbGFzcyBBbmd1bGFyQ29tcGlsYXRpb25TdGF0ZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyByZWFkb25seSBhbmd1bGFyUHJvZ3JhbTogbmcuTmd0c2NQcm9ncmFtLFxuICAgIHB1YmxpYyByZWFkb25seSBjb21waWxlckhvc3Q6IG5nLkNvbXBpbGVySG9zdCxcbiAgICBwdWJsaWMgcmVhZG9ubHkgdHlwZVNjcmlwdFByb2dyYW06IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0sXG4gICAgcHVibGljIHJlYWRvbmx5IGFmZmVjdGVkRmlsZXM6IFJlYWRvbmx5U2V0PHRzLlNvdXJjZUZpbGU+LFxuICAgIHB1YmxpYyByZWFkb25seSB0ZW1wbGF0ZURpYWdub3N0aWNzT3B0aW1pemF0aW9uOiBuZy5PcHRpbWl6ZUZvcixcbiAgICBwdWJsaWMgcmVhZG9ubHkgZGlhZ25vc3RpY0NhY2hlID0gbmV3IFdlYWtNYXA8dHMuU291cmNlRmlsZSwgdHMuRGlhZ25vc3RpY1tdPigpLFxuICApIHt9XG5cbiAgZ2V0IGFuZ3VsYXJDb21waWxlcigpIHtcbiAgICByZXR1cm4gdGhpcy5hbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQW90Q29tcGlsYXRpb24gZXh0ZW5kcyBBbmd1bGFyQ29tcGlsYXRpb24ge1xuICAjc3RhdGU/OiBBbmd1bGFyQ29tcGlsYXRpb25TdGF0ZTtcblxuICBhc3luYyBpbml0aWFsaXplKFxuICAgIHRzY29uZmlnOiBzdHJpbmcsXG4gICAgaG9zdE9wdGlvbnM6IEFuZ3VsYXJIb3N0T3B0aW9ucyxcbiAgICBjb21waWxlck9wdGlvbnNUcmFuc2Zvcm1lcj86IChjb21waWxlck9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucykgPT4gbmcuQ29tcGlsZXJPcHRpb25zLFxuICApOiBQcm9taXNlPHtcbiAgICBhZmZlY3RlZEZpbGVzOiBSZWFkb25seVNldDx0cy5Tb3VyY2VGaWxlPjtcbiAgICBjb21waWxlck9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucztcbiAgICByZWZlcmVuY2VkRmlsZXM6IHJlYWRvbmx5IHN0cmluZ1tdO1xuICB9PiB7XG4gICAgLy8gRHluYW1pY2FsbHkgbG9hZCB0aGUgQW5ndWxhciBjb21waWxlciBDTEkgcGFja2FnZVxuICAgIGNvbnN0IHsgTmd0c2NQcm9ncmFtLCBPcHRpbWl6ZUZvciB9ID0gYXdhaXQgQW5ndWxhckNvbXBpbGF0aW9uLmxvYWRDb21waWxlckNsaSgpO1xuXG4gICAgLy8gTG9hZCB0aGUgY29tcGlsZXIgY29uZmlndXJhdGlvbiBhbmQgdHJhbnNmb3JtIGFzIG5lZWRlZFxuICAgIGNvbnN0IHtcbiAgICAgIG9wdGlvbnM6IG9yaWdpbmFsQ29tcGlsZXJPcHRpb25zLFxuICAgICAgcm9vdE5hbWVzLFxuICAgICAgZXJyb3JzOiBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3MsXG4gICAgfSA9IGF3YWl0IHRoaXMubG9hZENvbmZpZ3VyYXRpb24odHNjb25maWcpO1xuICAgIGNvbnN0IGNvbXBpbGVyT3B0aW9ucyA9XG4gICAgICBjb21waWxlck9wdGlvbnNUcmFuc2Zvcm1lcj8uKG9yaWdpbmFsQ29tcGlsZXJPcHRpb25zKSA/PyBvcmlnaW5hbENvbXBpbGVyT3B0aW9ucztcblxuICAgIC8vIENyZWF0ZSBBbmd1bGFyIGNvbXBpbGVyIGhvc3RcbiAgICBjb25zdCBob3N0ID0gY3JlYXRlQW5ndWxhckNvbXBpbGVySG9zdChjb21waWxlck9wdGlvbnMsIGhvc3RPcHRpb25zKTtcblxuICAgIC8vIENyZWF0ZSB0aGUgQW5ndWxhciBzcGVjaWZpYyBwcm9ncmFtIHRoYXQgY29udGFpbnMgdGhlIEFuZ3VsYXIgY29tcGlsZXJcbiAgICBjb25zdCBhbmd1bGFyUHJvZ3JhbSA9IHByb2ZpbGVTeW5jKFxuICAgICAgJ05HX0NSRUFURV9QUk9HUkFNJyxcbiAgICAgICgpID0+IG5ldyBOZ3RzY1Byb2dyYW0ocm9vdE5hbWVzLCBjb21waWxlck9wdGlvbnMsIGhvc3QsIHRoaXMuI3N0YXRlPy5hbmd1bGFyUHJvZ3JhbSksXG4gICAgKTtcbiAgICBjb25zdCBhbmd1bGFyQ29tcGlsZXIgPSBhbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgICBjb25zdCBhbmd1bGFyVHlwZVNjcmlwdFByb2dyYW0gPSBhbmd1bGFyUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKTtcbiAgICBlbnN1cmVTb3VyY2VGaWxlVmVyc2lvbnMoYW5ndWxhclR5cGVTY3JpcHRQcm9ncmFtKTtcblxuICAgIGxldCBvbGRQcm9ncmFtID0gdGhpcy4jc3RhdGU/LnR5cGVTY3JpcHRQcm9ncmFtO1xuICAgIGxldCB1c2luZ0J1aWxkSW5mbyA9IGZhbHNlO1xuICAgIGlmICghb2xkUHJvZ3JhbSkge1xuICAgICAgb2xkUHJvZ3JhbSA9IHRzLnJlYWRCdWlsZGVyUHJvZ3JhbShjb21waWxlck9wdGlvbnMsIGhvc3QpO1xuICAgICAgdXNpbmdCdWlsZEluZm8gPSB0cnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHR5cGVTY3JpcHRQcm9ncmFtID0gdHMuY3JlYXRlRW1pdEFuZFNlbWFudGljRGlhZ25vc3RpY3NCdWlsZGVyUHJvZ3JhbShcbiAgICAgIGFuZ3VsYXJUeXBlU2NyaXB0UHJvZ3JhbSxcbiAgICAgIGhvc3QsXG4gICAgICBvbGRQcm9ncmFtLFxuICAgICAgY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgICk7XG5cbiAgICBhd2FpdCBwcm9maWxlQXN5bmMoJ05HX0FOQUxZWkVfUFJPR1JBTScsICgpID0+IGFuZ3VsYXJDb21waWxlci5hbmFseXplQXN5bmMoKSk7XG4gICAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IHByb2ZpbGVTeW5jKCdOR19GSU5EX0FGRkVDVEVEJywgKCkgPT5cbiAgICAgIGZpbmRBZmZlY3RlZEZpbGVzKHR5cGVTY3JpcHRQcm9ncmFtLCBhbmd1bGFyQ29tcGlsZXIsIHVzaW5nQnVpbGRJbmZvKSxcbiAgICApO1xuXG4gICAgdGhpcy4jc3RhdGUgPSBuZXcgQW5ndWxhckNvbXBpbGF0aW9uU3RhdGUoXG4gICAgICBhbmd1bGFyUHJvZ3JhbSxcbiAgICAgIGhvc3QsXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbSxcbiAgICAgIGFmZmVjdGVkRmlsZXMsXG4gICAgICBhZmZlY3RlZEZpbGVzLnNpemUgPT09IDEgPyBPcHRpbWl6ZUZvci5TaW5nbGVGaWxlIDogT3B0aW1pemVGb3IuV2hvbGVQcm9ncmFtLFxuICAgICAgdGhpcy4jc3RhdGU/LmRpYWdub3N0aWNDYWNoZSxcbiAgICApO1xuXG4gICAgY29uc3QgcmVmZXJlbmNlZEZpbGVzID0gdHlwZVNjcmlwdFByb2dyYW1cbiAgICAgIC5nZXRTb3VyY2VGaWxlcygpXG4gICAgICAuZmlsdGVyKChzb3VyY2VGaWxlKSA9PiAhYW5ndWxhckNvbXBpbGVyLmlnbm9yZUZvckVtaXQuaGFzKHNvdXJjZUZpbGUpKVxuICAgICAgLm1hcCgoc291cmNlRmlsZSkgPT4gc291cmNlRmlsZS5maWxlTmFtZSk7XG5cbiAgICByZXR1cm4geyBhZmZlY3RlZEZpbGVzLCBjb21waWxlck9wdGlvbnMsIHJlZmVyZW5jZWRGaWxlcyB9O1xuICB9XG5cbiAgKmNvbGxlY3REaWFnbm9zdGljcygpOiBJdGVyYWJsZTx0cy5EaWFnbm9zdGljPiB7XG4gICAgYXNzZXJ0KHRoaXMuI3N0YXRlLCAnQW5ndWxhciBjb21waWxhdGlvbiBtdXN0IGJlIGluaXRpYWxpemVkIHByaW9yIHRvIGNvbGxlY3RpbmcgZGlhZ25vc3RpY3MuJyk7XG4gICAgY29uc3Qge1xuICAgICAgYWZmZWN0ZWRGaWxlcyxcbiAgICAgIGFuZ3VsYXJDb21waWxlcixcbiAgICAgIGRpYWdub3N0aWNDYWNoZSxcbiAgICAgIHRlbXBsYXRlRGlhZ25vc3RpY3NPcHRpbWl6YXRpb24sXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbSxcbiAgICB9ID0gdGhpcy4jc3RhdGU7XG5cbiAgICAvLyBDb2xsZWN0IHByb2dyYW0gbGV2ZWwgZGlhZ25vc3RpY3NcbiAgICB5aWVsZCogdHlwZVNjcmlwdFByb2dyYW0uZ2V0Q29uZmlnRmlsZVBhcnNpbmdEaWFnbm9zdGljcygpO1xuICAgIHlpZWxkKiBhbmd1bGFyQ29tcGlsZXIuZ2V0T3B0aW9uRGlhZ25vc3RpY3MoKTtcbiAgICB5aWVsZCogdHlwZVNjcmlwdFByb2dyYW0uZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCk7XG4gICAgeWllbGQqIHR5cGVTY3JpcHRQcm9ncmFtLmdldEdsb2JhbERpYWdub3N0aWNzKCk7XG5cbiAgICAvLyBDb2xsZWN0IHNvdXJjZSBmaWxlIHNwZWNpZmljIGRpYWdub3N0aWNzXG4gICAgZm9yIChjb25zdCBzb3VyY2VGaWxlIG9mIHR5cGVTY3JpcHRQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgIGlmIChhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBUeXBlU2NyaXB0IHdpbGwgdXNlIGNhY2hlZCBkaWFnbm9zdGljcyBmb3IgZmlsZXMgdGhhdCBoYXZlIG5vdCBiZWVuXG4gICAgICAvLyBjaGFuZ2VkIG9yIGFmZmVjdGVkIGZvciB0aGlzIGJ1aWxkIHdoZW4gdXNpbmcgaW5jcmVtZW50YWwgYnVpbGRpbmcuXG4gICAgICB5aWVsZCogcHJvZmlsZVN5bmMoXG4gICAgICAgICdOR19ESUFHTk9TVElDU19TWU5UQUNUSUMnLFxuICAgICAgICAoKSA9PiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlKSxcbiAgICAgICAgdHJ1ZSxcbiAgICAgICk7XG4gICAgICB5aWVsZCogcHJvZmlsZVN5bmMoXG4gICAgICAgICdOR19ESUFHTk9TVElDU19TRU1BTlRJQycsXG4gICAgICAgICgpID0+IHR5cGVTY3JpcHRQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc291cmNlRmlsZSksXG4gICAgICAgIHRydWUsXG4gICAgICApO1xuXG4gICAgICAvLyBEZWNsYXJhdGlvbiBmaWxlcyBjYW5ub3QgaGF2ZSB0ZW1wbGF0ZSBkaWFnbm9zdGljc1xuICAgICAgaWYgKHNvdXJjZUZpbGUuaXNEZWNsYXJhdGlvbkZpbGUpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIE9ubHkgcmVxdWVzdCBBbmd1bGFyIHRlbXBsYXRlIGRpYWdub3N0aWNzIGZvciBhZmZlY3RlZCBmaWxlcyB0byBhdm9pZFxuICAgICAgLy8gb3ZlcmhlYWQgb2YgdGVtcGxhdGUgZGlhZ25vc3RpY3MgZm9yIHVuY2hhbmdlZCBmaWxlcy5cbiAgICAgIGlmIChhZmZlY3RlZEZpbGVzLmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgICBjb25zdCBhbmd1bGFyRGlhZ25vc3RpY3MgPSBwcm9maWxlU3luYyhcbiAgICAgICAgICAnTkdfRElBR05PU1RJQ1NfVEVNUExBVEUnLFxuICAgICAgICAgICgpID0+IGFuZ3VsYXJDb21waWxlci5nZXREaWFnbm9zdGljc0ZvckZpbGUoc291cmNlRmlsZSwgdGVtcGxhdGVEaWFnbm9zdGljc09wdGltaXphdGlvbiksXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKTtcbiAgICAgICAgZGlhZ25vc3RpY0NhY2hlLnNldChzb3VyY2VGaWxlLCBhbmd1bGFyRGlhZ25vc3RpY3MpO1xuICAgICAgICB5aWVsZCogYW5ndWxhckRpYWdub3N0aWNzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gZGlhZ25vc3RpY0NhY2hlLmdldChzb3VyY2VGaWxlKTtcbiAgICAgICAgaWYgKGFuZ3VsYXJEaWFnbm9zdGljcykge1xuICAgICAgICAgIHlpZWxkKiBhbmd1bGFyRGlhZ25vc3RpY3M7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBlbWl0QWZmZWN0ZWRGaWxlcygpOiBJdGVyYWJsZTxFbWl0RmlsZVJlc3VsdD4ge1xuICAgIGFzc2VydCh0aGlzLiNzdGF0ZSwgJ0FuZ3VsYXIgY29tcGlsYXRpb24gbXVzdCBiZSBpbml0aWFsaXplZCBwcmlvciB0byBlbWl0dGluZyBmaWxlcy4nKTtcbiAgICBjb25zdCB7IGFuZ3VsYXJDb21waWxlciwgY29tcGlsZXJIb3N0LCB0eXBlU2NyaXB0UHJvZ3JhbSB9ID0gdGhpcy4jc3RhdGU7XG4gICAgY29uc3QgYnVpbGRJbmZvRmlsZW5hbWUgPVxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0uZ2V0Q29tcGlsZXJPcHRpb25zKCkudHNCdWlsZEluZm9GaWxlID8/ICcudHNidWlsZGluZm8nO1xuXG4gICAgY29uc3QgZW1pdHRlZEZpbGVzID0gbmV3IE1hcDx0cy5Tb3VyY2VGaWxlLCBFbWl0RmlsZVJlc3VsdD4oKTtcbiAgICBjb25zdCB3cml0ZUZpbGVDYWxsYmFjazogdHMuV3JpdGVGaWxlQ2FsbGJhY2sgPSAoZmlsZW5hbWUsIGNvbnRlbnRzLCBfYSwgX2IsIHNvdXJjZUZpbGVzKSA9PiB7XG4gICAgICBpZiAoIXNvdXJjZUZpbGVzPy5sZW5ndGggJiYgZmlsZW5hbWUuZW5kc1dpdGgoYnVpbGRJbmZvRmlsZW5hbWUpKSB7XG4gICAgICAgIC8vIFNhdmUgYnVpbGRlciBpbmZvIGNvbnRlbnRzIHRvIHNwZWNpZmllZCBsb2NhdGlvblxuICAgICAgICBjb21waWxlckhvc3Qud3JpdGVGaWxlKGZpbGVuYW1lLCBjb250ZW50cywgZmFsc2UpO1xuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgYXNzZXJ0KHNvdXJjZUZpbGVzPy5sZW5ndGggPT09IDEsICdJbnZhbGlkIFR5cGVTY3JpcHQgcHJvZ3JhbSBlbWl0IGZvciAnICsgZmlsZW5hbWUpO1xuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IHNvdXJjZUZpbGVzWzBdO1xuICAgICAgaWYgKGFuZ3VsYXJDb21waWxlci5pZ25vcmVGb3JFbWl0Lmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlci5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLnJlY29yZFN1Y2Nlc3NmdWxFbWl0KHNvdXJjZUZpbGUpO1xuICAgICAgZW1pdHRlZEZpbGVzLnNldChzb3VyY2VGaWxlLCB7IGZpbGVuYW1lOiBzb3VyY2VGaWxlLmZpbGVOYW1lLCBjb250ZW50cyB9KTtcbiAgICB9O1xuICAgIGNvbnN0IHRyYW5zZm9ybWVycyA9IG1lcmdlVHJhbnNmb3JtZXJzKGFuZ3VsYXJDb21waWxlci5wcmVwYXJlRW1pdCgpLnRyYW5zZm9ybWVycywge1xuICAgICAgYmVmb3JlOiBbcmVwbGFjZUJvb3RzdHJhcCgoKSA9PiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRQcm9ncmFtKCkuZ2V0VHlwZUNoZWNrZXIoKSldLFxuICAgIH0pO1xuXG4gICAgLy8gVHlwZVNjcmlwdCB3aWxsIGxvb3AgdW50aWwgdGhlcmUgYXJlIG5vIG1vcmUgYWZmZWN0ZWQgZmlsZXMgaW4gdGhlIHByb2dyYW1cbiAgICB3aGlsZSAoXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbS5lbWl0TmV4dEFmZmVjdGVkRmlsZSh3cml0ZUZpbGVDYWxsYmFjaywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRyYW5zZm9ybWVycylcbiAgICApIHtcbiAgICAgIC8qIGVtcHR5ICovXG4gICAgfVxuXG4gICAgLy8gQW5ndWxhciBtYXkgaGF2ZSBmaWxlcyB0aGF0IG11c3QgYmUgZW1pdHRlZCBidXQgVHlwZVNjcmlwdCBkb2VzIG5vdCBjb25zaWRlciBhZmZlY3RlZFxuICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICBpZiAoZW1pdHRlZEZpbGVzLmhhcyhzb3VyY2VGaWxlKSB8fCBhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRW1pdC5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChzb3VyY2VGaWxlLmlzRGVjbGFyYXRpb25GaWxlKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoYW5ndWxhckNvbXBpbGVyLmluY3JlbWVudGFsQ29tcGlsYXRpb24uc2FmZVRvU2tpcEVtaXQoc291cmNlRmlsZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHR5cGVTY3JpcHRQcm9ncmFtLmVtaXQoc291cmNlRmlsZSwgd3JpdGVGaWxlQ2FsbGJhY2ssIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cmFuc2Zvcm1lcnMpO1xuICAgIH1cblxuICAgIHJldHVybiBlbWl0dGVkRmlsZXMudmFsdWVzKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZEFmZmVjdGVkRmlsZXMoXG4gIGJ1aWxkZXI6IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0sXG4gIHsgaWdub3JlRm9yRGlhZ25vc3RpY3MgfTogbmcuTmd0c2NQcm9ncmFtWydjb21waWxlciddLFxuICBpbmNsdWRlVFRDOiBib29sZWFuLFxuKTogU2V0PHRzLlNvdXJjZUZpbGU+IHtcbiAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IG5ldyBTZXQ8dHMuU291cmNlRmlsZT4oKTtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYnVpbGRlci5nZXRTZW1hbnRpY0RpYWdub3N0aWNzT2ZOZXh0QWZmZWN0ZWRGaWxlKHVuZGVmaW5lZCwgKHNvdXJjZUZpbGUpID0+IHtcbiAgICAgIC8vIElmIHRoZSBhZmZlY3RlZCBmaWxlIGlzIGEgVFRDIHNoaW0sIGFkZCB0aGUgc2hpbSdzIG9yaWdpbmFsIHNvdXJjZSBmaWxlLlxuICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoYXQgY2hhbmdlcyB0aGF0IGFmZmVjdCBUVEMgYXJlIHR5cGVjaGVja2VkIGV2ZW4gd2hlbiB0aGUgY2hhbmdlc1xuICAgICAgLy8gYXJlIG90aGVyd2lzZSB1bnJlbGF0ZWQgZnJvbSBhIFRTIHBlcnNwZWN0aXZlIGFuZCBkbyBub3QgcmVzdWx0IGluIEl2eSBjb2RlZ2VuIGNoYW5nZXMuXG4gICAgICAvLyBGb3IgZXhhbXBsZSwgY2hhbmdpbmcgQElucHV0IHByb3BlcnR5IHR5cGVzIG9mIGEgZGlyZWN0aXZlIHVzZWQgaW4gYW5vdGhlciBjb21wb25lbnQnc1xuICAgICAgLy8gdGVtcGxhdGUuXG4gICAgICAvLyBBIFRUQyBzaGltIGlzIGEgZmlsZSB0aGF0IGhhcyBiZWVuIGlnbm9yZWQgZm9yIGRpYWdub3N0aWNzIGFuZCBoYXMgYSBmaWxlbmFtZSBlbmRpbmcgaW4gYC5uZ3R5cGVjaGVjay50c2AuXG4gICAgICBpZiAoaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpICYmIHNvdXJjZUZpbGUuZmlsZU5hbWUuZW5kc1dpdGgoJy5uZ3R5cGVjaGVjay50cycpKSB7XG4gICAgICAgIC8vIFRoaXMgZmlsZSBuYW1lIGNvbnZlcnNpb24gcmVsaWVzIG9uIGludGVybmFsIGNvbXBpbGVyIGxvZ2ljIGFuZCBzaG91bGQgYmUgY29udmVydGVkXG4gICAgICAgIC8vIHRvIGFuIG9mZmljaWFsIG1ldGhvZCB3aGVuIGF2YWlsYWJsZS4gMTUgaXMgbGVuZ3RoIG9mIGAubmd0eXBlY2hlY2sudHNgXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsRmlsZW5hbWUgPSBzb3VyY2VGaWxlLmZpbGVOYW1lLnNsaWNlKDAsIC0xNSkgKyAnLnRzJztcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxTb3VyY2VGaWxlID0gYnVpbGRlci5nZXRTb3VyY2VGaWxlKG9yaWdpbmFsRmlsZW5hbWUpO1xuICAgICAgICBpZiAob3JpZ2luYWxTb3VyY2VGaWxlKSB7XG4gICAgICAgICAgYWZmZWN0ZWRGaWxlcy5hZGQob3JpZ2luYWxTb3VyY2VGaWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgYWZmZWN0ZWRGaWxlcy5hZGQocmVzdWx0LmFmZmVjdGVkIGFzIHRzLlNvdXJjZUZpbGUpO1xuICB9XG5cbiAgLy8gQWRkIGFsbCBmaWxlcyB3aXRoIGFzc29jaWF0ZWQgdGVtcGxhdGUgdHlwZSBjaGVja2luZyBmaWxlcy5cbiAgLy8gU3RvcmVkIFRTIGJ1aWxkIGluZm8gZG9lcyBub3QgaGF2ZSBrbm93bGVkZ2Ugb2YgdGhlIEFPVCBjb21waWxlciBvciB0aGUgdHlwZWNoZWNraW5nIHN0YXRlIG9mIHRoZSB0ZW1wbGF0ZXMuXG4gIC8vIFRvIGVuc3VyZSB0aGF0IGVycm9ycyBhcmUgcmVwb3J0ZWQgY29ycmVjdGx5LCBhbGwgQU9UIGNvbXBvbmVudCBkaWFnbm9zdGljcyBuZWVkIHRvIGJlIGFuYWx5emVkIGV2ZW4gaWYgYnVpbGRcbiAgLy8gaW5mbyBpcyBwcmVzZW50LlxuICBpZiAoaW5jbHVkZVRUQykge1xuICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiBidWlsZGVyLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgIGlmIChpZ25vcmVGb3JEaWFnbm9zdGljcy5oYXMoc291cmNlRmlsZSkgJiYgc291cmNlRmlsZS5maWxlTmFtZS5lbmRzV2l0aCgnLm5ndHlwZWNoZWNrLnRzJykpIHtcbiAgICAgICAgLy8gVGhpcyBmaWxlIG5hbWUgY29udmVyc2lvbiByZWxpZXMgb24gaW50ZXJuYWwgY29tcGlsZXIgbG9naWMgYW5kIHNob3VsZCBiZSBjb252ZXJ0ZWRcbiAgICAgICAgLy8gdG8gYW4gb2ZmaWNpYWwgbWV0aG9kIHdoZW4gYXZhaWxhYmxlLiAxNSBpcyBsZW5ndGggb2YgYC5uZ3R5cGVjaGVjay50c2BcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxGaWxlbmFtZSA9IHNvdXJjZUZpbGUuZmlsZU5hbWUuc2xpY2UoMCwgLTE1KSArICcudHMnO1xuICAgICAgICBjb25zdCBvcmlnaW5hbFNvdXJjZUZpbGUgPSBidWlsZGVyLmdldFNvdXJjZUZpbGUob3JpZ2luYWxGaWxlbmFtZSk7XG4gICAgICAgIGlmIChvcmlnaW5hbFNvdXJjZUZpbGUpIHtcbiAgICAgICAgICBhZmZlY3RlZEZpbGVzLmFkZChvcmlnaW5hbFNvdXJjZUZpbGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGFmZmVjdGVkRmlsZXM7XG59XG4iXX0=