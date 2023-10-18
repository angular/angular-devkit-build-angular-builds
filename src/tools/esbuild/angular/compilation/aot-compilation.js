"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AotCompilation = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const typescript_1 = __importDefault(require("typescript"));
const profiling_1 = require("../../profiling");
const angular_host_1 = require("../angular-host");
const web_worker_transformer_1 = require("../web-worker-transformer");
const angular_compilation_1 = require("./angular-compilation");
// Temporary deep import for transformer support
// TODO: Move these to a private exports location or move the implementation into this package.
const { mergeTransformers, replaceBootstrap } = require('@ngtools/webpack/src/ivy/transformation');
class AngularCompilationState {
    angularProgram;
    compilerHost;
    typeScriptProgram;
    affectedFiles;
    templateDiagnosticsOptimization;
    webWorkerTransform;
    diagnosticCache;
    constructor(angularProgram, compilerHost, typeScriptProgram, affectedFiles, templateDiagnosticsOptimization, webWorkerTransform, diagnosticCache = new WeakMap()) {
        this.angularProgram = angularProgram;
        this.compilerHost = compilerHost;
        this.typeScriptProgram = typeScriptProgram;
        this.affectedFiles = affectedFiles;
        this.templateDiagnosticsOptimization = templateDiagnosticsOptimization;
        this.webWorkerTransform = webWorkerTransform;
        this.diagnosticCache = diagnosticCache;
    }
    get angularCompiler() {
        return this.angularProgram.compiler;
    }
}
class AotCompilation extends angular_compilation_1.AngularCompilation {
    #state;
    async initialize(tsconfig, hostOptions, compilerOptionsTransformer) {
        // Dynamically load the Angular compiler CLI package
        const { NgtscProgram, OptimizeFor } = await angular_compilation_1.AngularCompilation.loadCompilerCli();
        // Load the compiler configuration and transform as needed
        const { options: originalCompilerOptions, rootNames, errors: configurationDiagnostics, } = await this.loadConfiguration(tsconfig);
        const compilerOptions = compilerOptionsTransformer?.(originalCompilerOptions) ?? originalCompilerOptions;
        // Create Angular compiler host
        const host = (0, angular_host_1.createAngularCompilerHost)(compilerOptions, hostOptions);
        // Create the Angular specific program that contains the Angular compiler
        const angularProgram = (0, profiling_1.profileSync)('NG_CREATE_PROGRAM', () => new NgtscProgram(rootNames, compilerOptions, host, this.#state?.angularProgram));
        const angularCompiler = angularProgram.compiler;
        const angularTypeScriptProgram = angularProgram.getTsProgram();
        (0, angular_host_1.ensureSourceFileVersions)(angularTypeScriptProgram);
        let oldProgram = this.#state?.typeScriptProgram;
        let usingBuildInfo = false;
        if (!oldProgram) {
            oldProgram = typescript_1.default.readBuilderProgram(compilerOptions, host);
            usingBuildInfo = !!oldProgram;
        }
        const typeScriptProgram = typescript_1.default.createEmitAndSemanticDiagnosticsBuilderProgram(angularTypeScriptProgram, host, oldProgram, configurationDiagnostics);
        await (0, profiling_1.profileAsync)('NG_ANALYZE_PROGRAM', () => angularCompiler.analyzeAsync());
        const affectedFiles = (0, profiling_1.profileSync)('NG_FIND_AFFECTED', () => findAffectedFiles(typeScriptProgram, angularCompiler, usingBuildInfo));
        // Get all files referenced in the TypeScript/Angular program including component resources
        const referencedFiles = typeScriptProgram
            .getSourceFiles()
            .filter((sourceFile) => !angularCompiler.ignoreForEmit.has(sourceFile))
            .flatMap((sourceFile) => {
            const resourceDependencies = angularCompiler.getResourceDependencies(sourceFile);
            // Also invalidate Angular diagnostics for a source file if component resources are modified
            if (this.#state && hostOptions.modifiedFiles?.size) {
                for (const resourceDependency of resourceDependencies) {
                    if (hostOptions.modifiedFiles.has(resourceDependency)) {
                        this.#state.diagnosticCache.delete(sourceFile);
                        // Also mark as affected in case changed template affects diagnostics
                        affectedFiles.add(sourceFile);
                    }
                }
            }
            return [sourceFile.fileName, ...resourceDependencies];
        });
        this.#state = new AngularCompilationState(angularProgram, host, typeScriptProgram, affectedFiles, affectedFiles.size === 1 ? OptimizeFor.SingleFile : OptimizeFor.WholeProgram, (0, web_worker_transformer_1.createWorkerTransformer)(hostOptions.processWebWorker.bind(hostOptions)), this.#state?.diagnosticCache);
        return { affectedFiles, compilerOptions, referencedFiles };
    }
    *collectDiagnostics() {
        (0, node_assert_1.default)(this.#state, 'Angular compilation must be initialized prior to collecting diagnostics.');
        const { affectedFiles, angularCompiler, diagnosticCache, templateDiagnosticsOptimization, typeScriptProgram, } = this.#state;
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
        (0, node_assert_1.default)(this.#state, 'Angular compilation must be initialized prior to emitting files.');
        const { angularCompiler, compilerHost, typeScriptProgram, webWorkerTransform } = this.#state;
        const buildInfoFilename = typeScriptProgram.getCompilerOptions().tsBuildInfoFile ?? '.tsbuildinfo';
        const emittedFiles = new Map();
        const writeFileCallback = (filename, contents, _a, _b, sourceFiles) => {
            if (!sourceFiles?.length && filename.endsWith(buildInfoFilename)) {
                // Save builder info contents to specified location
                compilerHost.writeFile(filename, contents, false);
                return;
            }
            (0, node_assert_1.default)(sourceFiles?.length === 1, 'Invalid TypeScript program emit for ' + filename);
            const sourceFile = typescript_1.default.getOriginalNode(sourceFiles[0], typescript_1.default.isSourceFile);
            if (angularCompiler.ignoreForEmit.has(sourceFile)) {
                return;
            }
            angularCompiler.incrementalCompilation.recordSuccessfulEmit(sourceFile);
            emittedFiles.set(sourceFile, { filename: sourceFile.fileName, contents });
        };
        const transformers = mergeTransformers(angularCompiler.prepareEmit().transformers, {
            before: [
                replaceBootstrap(() => typeScriptProgram.getProgram().getTypeChecker()),
                webWorkerTransform,
            ],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW90LWNvbXBpbGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2NvbXBpbGF0aW9uL2FvdC1jb21waWxhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFHSCw4REFBaUM7QUFDakMsNERBQTRCO0FBQzVCLCtDQUE0RDtBQUM1RCxrREFJeUI7QUFDekIsc0VBQW9FO0FBQ3BFLCtEQUEyRTtBQUUzRSxnREFBZ0Q7QUFDaEQsK0ZBQStGO0FBQy9GLE1BQU0sRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLE9BQU8sQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDO0FBRW5HLE1BQU0sdUJBQXVCO0lBRVQ7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFQbEIsWUFDa0IsY0FBK0IsRUFDL0IsWUFBNkIsRUFDN0IsaUJBQThELEVBQzlELGFBQXlDLEVBQ3pDLCtCQUErQyxFQUMvQyxrQkFBd0QsRUFDeEQsa0JBQWtCLElBQUksT0FBTyxFQUFrQztRQU4vRCxtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7UUFDL0IsaUJBQVksR0FBWixZQUFZLENBQWlCO1FBQzdCLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBNkM7UUFDOUQsa0JBQWEsR0FBYixhQUFhLENBQTRCO1FBQ3pDLG9DQUErQixHQUEvQiwrQkFBK0IsQ0FBZ0I7UUFDL0MsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFzQztRQUN4RCxvQkFBZSxHQUFmLGVBQWUsQ0FBZ0Q7SUFDOUUsQ0FBQztJQUVKLElBQUksZUFBZTtRQUNqQixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDO0lBQ3RDLENBQUM7Q0FDRjtBQUVELE1BQWEsY0FBZSxTQUFRLHdDQUFrQjtJ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QUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUM7Z0JBQ25FLE1BQU0sa0JBQWtCLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO2dCQUNuRSxJQUFJLGtCQUFrQixFQUFFO29CQUN0QixhQUFhLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7aUJBQ3ZDO2FBQ0Y7U0FDRjtLQUNGO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSBuZyBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBwcm9maWxlQXN5bmMsIHByb2ZpbGVTeW5jIH0gZnJvbSAnLi4vLi4vcHJvZmlsaW5nJztcbmltcG9ydCB7XG4gIEFuZ3VsYXJIb3N0T3B0aW9ucyxcbiAgY3JlYXRlQW5ndWxhckNvbXBpbGVySG9zdCxcbiAgZW5zdXJlU291cmNlRmlsZVZlcnNpb25zLFxufSBmcm9tICcuLi9hbmd1bGFyLWhvc3QnO1xuaW1wb3J0IHsgY3JlYXRlV29ya2VyVHJhbnNmb3JtZXIgfSBmcm9tICcuLi93ZWItd29ya2VyLXRyYW5zZm9ybWVyJztcbmltcG9ydCB7IEFuZ3VsYXJDb21waWxhdGlvbiwgRW1pdEZpbGVSZXN1bHQgfSBmcm9tICcuL2FuZ3VsYXItY29tcGlsYXRpb24nO1xuXG4vLyBUZW1wb3JhcnkgZGVlcCBpbXBvcnQgZm9yIHRyYW5zZm9ybWVyIHN1cHBvcnRcbi8vIFRPRE86IE1vdmUgdGhlc2UgdG8gYSBwcml2YXRlIGV4cG9ydHMgbG9jYXRpb24gb3IgbW92ZSB0aGUgaW1wbGVtZW50YXRpb24gaW50byB0aGlzIHBhY2thZ2UuXG5jb25zdCB7IG1lcmdlVHJhbnNmb3JtZXJzLCByZXBsYWNlQm9vdHN0cmFwIH0gPSByZXF1aXJlKCdAbmd0b29scy93ZWJwYWNrL3NyYy9pdnkvdHJhbnNmb3JtYXRpb24nKTtcblxuY2xhc3MgQW5ndWxhckNvbXBpbGF0aW9uU3RhdGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgcmVhZG9ubHkgYW5ndWxhclByb2dyYW06IG5nLk5ndHNjUHJvZ3JhbSxcbiAgICBwdWJsaWMgcmVhZG9ubHkgY29tcGlsZXJIb3N0OiBuZy5Db21waWxlckhvc3QsXG4gICAgcHVibGljIHJlYWRvbmx5IHR5cGVTY3JpcHRQcm9ncmFtOiB0cy5FbWl0QW5kU2VtYW50aWNEaWFnbm9zdGljc0J1aWxkZXJQcm9ncmFtLFxuICAgIHB1YmxpYyByZWFkb25seSBhZmZlY3RlZEZpbGVzOiBSZWFkb25seVNldDx0cy5Tb3VyY2VGaWxlPixcbiAgICBwdWJsaWMgcmVhZG9ubHkgdGVtcGxhdGVEaWFnbm9zdGljc09wdGltaXphdGlvbjogbmcuT3B0aW1pemVGb3IsXG4gICAgcHVibGljIHJlYWRvbmx5IHdlYldvcmtlclRyYW5zZm9ybTogdHMuVHJhbnNmb3JtZXJGYWN0b3J5PHRzLlNvdXJjZUZpbGU+LFxuICAgIHB1YmxpYyByZWFkb25seSBkaWFnbm9zdGljQ2FjaGUgPSBuZXcgV2Vha01hcDx0cy5Tb3VyY2VGaWxlLCB0cy5EaWFnbm9zdGljW10+KCksXG4gICkge31cblxuICBnZXQgYW5ndWxhckNvbXBpbGVyKCkge1xuICAgIHJldHVybiB0aGlzLmFuZ3VsYXJQcm9ncmFtLmNvbXBpbGVyO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBBb3RDb21waWxhdGlvbiBleHRlbmRzIEFuZ3VsYXJDb21waWxhdGlvbiB7XG4gICNzdGF0ZT86IEFuZ3VsYXJDb21waWxhdGlvblN0YXRlO1xuXG4gIGFzeW5jIGluaXRpYWxpemUoXG4gICAgdHNjb25maWc6IHN0cmluZyxcbiAgICBob3N0T3B0aW9uczogQW5ndWxhckhvc3RPcHRpb25zLFxuICAgIGNvbXBpbGVyT3B0aW9uc1RyYW5zZm9ybWVyPzogKGNvbXBpbGVyT3B0aW9uczogbmcuQ29tcGlsZXJPcHRpb25zKSA9PiBuZy5Db21waWxlck9wdGlvbnMsXG4gICk6IFByb21pc2U8e1xuICAgIGFmZmVjdGVkRmlsZXM6IFJlYWRvbmx5U2V0PHRzLlNvdXJjZUZpbGU+O1xuICAgIGNvbXBpbGVyT3B0aW9uczogbmcuQ29tcGlsZXJPcHRpb25zO1xuICAgIHJlZmVyZW5jZWRGaWxlczogcmVhZG9ubHkgc3RyaW5nW107XG4gIH0+IHtcbiAgICAvLyBEeW5hbWljYWxseSBsb2FkIHRoZSBBbmd1bGFyIGNvbXBpbGVyIENMSSBwYWNrYWdlXG4gICAgY29uc3QgeyBOZ3RzY1Byb2dyYW0sIE9wdGltaXplRm9yIH0gPSBhd2FpdCBBbmd1bGFyQ29tcGlsYXRpb24ubG9hZENvbXBpbGVyQ2xpKCk7XG5cbiAgICAvLyBMb2FkIHRoZSBjb21waWxlciBjb25maWd1cmF0aW9uIGFuZCB0cmFuc2Zvcm0gYXMgbmVlZGVkXG4gICAgY29uc3Qge1xuICAgICAgb3B0aW9uczogb3JpZ2luYWxDb21waWxlck9wdGlvbnMsXG4gICAgICByb290TmFtZXMsXG4gICAgICBlcnJvcnM6IGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcyxcbiAgICB9ID0gYXdhaXQgdGhpcy5sb2FkQ29uZmlndXJhdGlvbih0c2NvbmZpZyk7XG4gICAgY29uc3QgY29tcGlsZXJPcHRpb25zID1cbiAgICAgIGNvbXBpbGVyT3B0aW9uc1RyYW5zZm9ybWVyPy4ob3JpZ2luYWxDb21waWxlck9wdGlvbnMpID8/IG9yaWdpbmFsQ29tcGlsZXJPcHRpb25zO1xuXG4gICAgLy8gQ3JlYXRlIEFuZ3VsYXIgY29tcGlsZXIgaG9zdFxuICAgIGNvbnN0IGhvc3QgPSBjcmVhdGVBbmd1bGFyQ29tcGlsZXJIb3N0KGNvbXBpbGVyT3B0aW9ucywgaG9zdE9wdGlvbnMpO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSBBbmd1bGFyIHNwZWNpZmljIHByb2dyYW0gdGhhdCBjb250YWlucyB0aGUgQW5ndWxhciBjb21waWxlclxuICAgIGNvbnN0IGFuZ3VsYXJQcm9ncmFtID0gcHJvZmlsZVN5bmMoXG4gICAgICAnTkdfQ1JFQVRFX1BST0dSQU0nLFxuICAgICAgKCkgPT4gbmV3IE5ndHNjUHJvZ3JhbShyb290TmFtZXMsIGNvbXBpbGVyT3B0aW9ucywgaG9zdCwgdGhpcy4jc3RhdGU/LmFuZ3VsYXJQcm9ncmFtKSxcbiAgICApO1xuICAgIGNvbnN0IGFuZ3VsYXJDb21waWxlciA9IGFuZ3VsYXJQcm9ncmFtLmNvbXBpbGVyO1xuICAgIGNvbnN0IGFuZ3VsYXJUeXBlU2NyaXB0UHJvZ3JhbSA9IGFuZ3VsYXJQcm9ncmFtLmdldFRzUHJvZ3JhbSgpO1xuICAgIGVuc3VyZVNvdXJjZUZpbGVWZXJzaW9ucyhhbmd1bGFyVHlwZVNjcmlwdFByb2dyYW0pO1xuXG4gICAgbGV0IG9sZFByb2dyYW0gPSB0aGlzLiNzdGF0ZT8udHlwZVNjcmlwdFByb2dyYW07XG4gICAgbGV0IHVzaW5nQnVpbGRJbmZvID0gZmFsc2U7XG4gICAgaWYgKCFvbGRQcm9ncmFtKSB7XG4gICAgICBvbGRQcm9ncmFtID0gdHMucmVhZEJ1aWxkZXJQcm9ncmFtKGNvbXBpbGVyT3B0aW9ucywgaG9zdCk7XG4gICAgICB1c2luZ0J1aWxkSW5mbyA9ICEhb2xkUHJvZ3JhbTtcbiAgICB9XG5cbiAgICBjb25zdCB0eXBlU2NyaXB0UHJvZ3JhbSA9IHRzLmNyZWF0ZUVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0oXG4gICAgICBhbmd1bGFyVHlwZVNjcmlwdFByb2dyYW0sXG4gICAgICBob3N0LFxuICAgICAgb2xkUHJvZ3JhbSxcbiAgICAgIGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcyxcbiAgICApO1xuXG4gICAgYXdhaXQgcHJvZmlsZUFzeW5jKCdOR19BTkFMWVpFX1BST0dSQU0nLCAoKSA9PiBhbmd1bGFyQ29tcGlsZXIuYW5hbHl6ZUFzeW5jKCkpO1xuICAgIGNvbnN0IGFmZmVjdGVkRmlsZXMgPSBwcm9maWxlU3luYygnTkdfRklORF9BRkZFQ1RFRCcsICgpID0+XG4gICAgICBmaW5kQWZmZWN0ZWRGaWxlcyh0eXBlU2NyaXB0UHJvZ3JhbSwgYW5ndWxhckNvbXBpbGVyLCB1c2luZ0J1aWxkSW5mbyksXG4gICAgKTtcblxuICAgIC8vIEdldCBhbGwgZmlsZXMgcmVmZXJlbmNlZCBpbiB0aGUgVHlwZVNjcmlwdC9Bbmd1bGFyIHByb2dyYW0gaW5jbHVkaW5nIGNvbXBvbmVudCByZXNvdXJjZXNcbiAgICBjb25zdCByZWZlcmVuY2VkRmlsZXMgPSB0eXBlU2NyaXB0UHJvZ3JhbVxuICAgICAgLmdldFNvdXJjZUZpbGVzKClcbiAgICAgIC5maWx0ZXIoKHNvdXJjZUZpbGUpID0+ICFhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRW1pdC5oYXMoc291cmNlRmlsZSkpXG4gICAgICAuZmxhdE1hcCgoc291cmNlRmlsZSkgPT4ge1xuICAgICAgICBjb25zdCByZXNvdXJjZURlcGVuZGVuY2llcyA9IGFuZ3VsYXJDb21waWxlci5nZXRSZXNvdXJjZURlcGVuZGVuY2llcyhzb3VyY2VGaWxlKTtcblxuICAgICAgICAvLyBBbHNvIGludmFsaWRhdGUgQW5ndWxhciBkaWFnbm9zdGljcyBmb3IgYSBzb3VyY2UgZmlsZSBpZiBjb21wb25lbnQgcmVzb3VyY2VzIGFyZSBtb2RpZmllZFxuICAgICAgICBpZiAodGhpcy4jc3RhdGUgJiYgaG9zdE9wdGlvbnMubW9kaWZpZWRGaWxlcz8uc2l6ZSkge1xuICAgICAgICAgIGZvciAoY29uc3QgcmVzb3VyY2VEZXBlbmRlbmN5IG9mIHJlc291cmNlRGVwZW5kZW5jaWVzKSB7XG4gICAgICAgICAgICBpZiAoaG9zdE9wdGlvbnMubW9kaWZpZWRGaWxlcy5oYXMocmVzb3VyY2VEZXBlbmRlbmN5KSkge1xuICAgICAgICAgICAgICB0aGlzLiNzdGF0ZS5kaWFnbm9zdGljQ2FjaGUuZGVsZXRlKHNvdXJjZUZpbGUpO1xuICAgICAgICAgICAgICAvLyBBbHNvIG1hcmsgYXMgYWZmZWN0ZWQgaW4gY2FzZSBjaGFuZ2VkIHRlbXBsYXRlIGFmZmVjdHMgZGlhZ25vc3RpY3NcbiAgICAgICAgICAgICAgYWZmZWN0ZWRGaWxlcy5hZGQoc291cmNlRmlsZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFtzb3VyY2VGaWxlLmZpbGVOYW1lLCAuLi5yZXNvdXJjZURlcGVuZGVuY2llc107XG4gICAgICB9KTtcblxuICAgIHRoaXMuI3N0YXRlID0gbmV3IEFuZ3VsYXJDb21waWxhdGlvblN0YXRlKFxuICAgICAgYW5ndWxhclByb2dyYW0sXG4gICAgICBob3N0LFxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0sXG4gICAgICBhZmZlY3RlZEZpbGVzLFxuICAgICAgYWZmZWN0ZWRGaWxlcy5zaXplID09PSAxID8gT3B0aW1pemVGb3IuU2luZ2xlRmlsZSA6IE9wdGltaXplRm9yLldob2xlUHJvZ3JhbSxcbiAgICAgIGNyZWF0ZVdvcmtlclRyYW5zZm9ybWVyKGhvc3RPcHRpb25zLnByb2Nlc3NXZWJXb3JrZXIuYmluZChob3N0T3B0aW9ucykpLFxuICAgICAgdGhpcy4jc3RhdGU/LmRpYWdub3N0aWNDYWNoZSxcbiAgICApO1xuXG4gICAgcmV0dXJuIHsgYWZmZWN0ZWRGaWxlcywgY29tcGlsZXJPcHRpb25zLCByZWZlcmVuY2VkRmlsZXMgfTtcbiAgfVxuXG4gICpjb2xsZWN0RGlhZ25vc3RpY3MoKTogSXRlcmFibGU8dHMuRGlhZ25vc3RpYz4ge1xuICAgIGFzc2VydCh0aGlzLiNzdGF0ZSwgJ0FuZ3VsYXIgY29tcGlsYXRpb24gbXVzdCBiZSBpbml0aWFsaXplZCBwcmlvciB0byBjb2xsZWN0aW5nIGRpYWdub3N0aWNzLicpO1xuICAgIGNvbnN0IHtcbiAgICAgIGFmZmVjdGVkRmlsZXMsXG4gICAgICBhbmd1bGFyQ29tcGlsZXIsXG4gICAgICBkaWFnbm9zdGljQ2FjaGUsXG4gICAgICB0ZW1wbGF0ZURpYWdub3N0aWNzT3B0aW1pemF0aW9uLFxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0sXG4gICAgfSA9IHRoaXMuI3N0YXRlO1xuXG4gICAgLy8gQ29sbGVjdCBwcm9ncmFtIGxldmVsIGRpYWdub3N0aWNzXG4gICAgeWllbGQqIHR5cGVTY3JpcHRQcm9ncmFtLmdldENvbmZpZ0ZpbGVQYXJzaW5nRGlhZ25vc3RpY3MoKTtcbiAgICB5aWVsZCogYW5ndWxhckNvbXBpbGVyLmdldE9wdGlvbkRpYWdub3N0aWNzKCk7XG4gICAgeWllbGQqIHR5cGVTY3JpcHRQcm9ncmFtLmdldE9wdGlvbnNEaWFnbm9zdGljcygpO1xuICAgIHlpZWxkKiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRHbG9iYWxEaWFnbm9zdGljcygpO1xuXG4gICAgLy8gQ29sbGVjdCBzb3VyY2UgZmlsZSBzcGVjaWZpYyBkaWFnbm9zdGljc1xuICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICBpZiAoYW5ndWxhckNvbXBpbGVyLmlnbm9yZUZvckRpYWdub3N0aWNzLmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gVHlwZVNjcmlwdCB3aWxsIHVzZSBjYWNoZWQgZGlhZ25vc3RpY3MgZm9yIGZpbGVzIHRoYXQgaGF2ZSBub3QgYmVlblxuICAgICAgLy8gY2hhbmdlZCBvciBhZmZlY3RlZCBmb3IgdGhpcyBidWlsZCB3aGVuIHVzaW5nIGluY3JlbWVudGFsIGJ1aWxkaW5nLlxuICAgICAgeWllbGQqIHByb2ZpbGVTeW5jKFxuICAgICAgICAnTkdfRElBR05PU1RJQ1NfU1lOVEFDVElDJyxcbiAgICAgICAgKCkgPT4gdHlwZVNjcmlwdFByb2dyYW0uZ2V0U3ludGFjdGljRGlhZ25vc3RpY3Moc291cmNlRmlsZSksXG4gICAgICAgIHRydWUsXG4gICAgICApO1xuICAgICAgeWllbGQqIHByb2ZpbGVTeW5jKFxuICAgICAgICAnTkdfRElBR05PU1RJQ1NfU0VNQU5USUMnLFxuICAgICAgICAoKSA9PiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKHNvdXJjZUZpbGUpLFxuICAgICAgICB0cnVlLFxuICAgICAgKTtcblxuICAgICAgLy8gRGVjbGFyYXRpb24gZmlsZXMgY2Fubm90IGhhdmUgdGVtcGxhdGUgZGlhZ25vc3RpY3NcbiAgICAgIGlmIChzb3VyY2VGaWxlLmlzRGVjbGFyYXRpb25GaWxlKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBPbmx5IHJlcXVlc3QgQW5ndWxhciB0ZW1wbGF0ZSBkaWFnbm9zdGljcyBmb3IgYWZmZWN0ZWQgZmlsZXMgdG8gYXZvaWRcbiAgICAgIC8vIG92ZXJoZWFkIG9mIHRlbXBsYXRlIGRpYWdub3N0aWNzIGZvciB1bmNoYW5nZWQgZmlsZXMuXG4gICAgICBpZiAoYWZmZWN0ZWRGaWxlcy5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gcHJvZmlsZVN5bmMoXG4gICAgICAgICAgJ05HX0RJQUdOT1NUSUNTX1RFTVBMQVRFJyxcbiAgICAgICAgICAoKSA9PiBhbmd1bGFyQ29tcGlsZXIuZ2V0RGlhZ25vc3RpY3NGb3JGaWxlKHNvdXJjZUZpbGUsIHRlbXBsYXRlRGlhZ25vc3RpY3NPcHRpbWl6YXRpb24pLFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICk7XG4gICAgICAgIGRpYWdub3N0aWNDYWNoZS5zZXQoc291cmNlRmlsZSwgYW5ndWxhckRpYWdub3N0aWNzKTtcbiAgICAgICAgeWllbGQqIGFuZ3VsYXJEaWFnbm9zdGljcztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGFuZ3VsYXJEaWFnbm9zdGljcyA9IGRpYWdub3N0aWNDYWNoZS5nZXQoc291cmNlRmlsZSk7XG4gICAgICAgIGlmIChhbmd1bGFyRGlhZ25vc3RpY3MpIHtcbiAgICAgICAgICB5aWVsZCogYW5ndWxhckRpYWdub3N0aWNzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZW1pdEFmZmVjdGVkRmlsZXMoKTogSXRlcmFibGU8RW1pdEZpbGVSZXN1bHQ+IHtcbiAgICBhc3NlcnQodGhpcy4jc3RhdGUsICdBbmd1bGFyIGNvbXBpbGF0aW9uIG11c3QgYmUgaW5pdGlhbGl6ZWQgcHJpb3IgdG8gZW1pdHRpbmcgZmlsZXMuJyk7XG4gICAgY29uc3QgeyBhbmd1bGFyQ29tcGlsZXIsIGNvbXBpbGVySG9zdCwgdHlwZVNjcmlwdFByb2dyYW0sIHdlYldvcmtlclRyYW5zZm9ybSB9ID0gdGhpcy4jc3RhdGU7XG4gICAgY29uc3QgYnVpbGRJbmZvRmlsZW5hbWUgPVxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0uZ2V0Q29tcGlsZXJPcHRpb25zKCkudHNCdWlsZEluZm9GaWxlID8/ICcudHNidWlsZGluZm8nO1xuXG4gICAgY29uc3QgZW1pdHRlZEZpbGVzID0gbmV3IE1hcDx0cy5Tb3VyY2VGaWxlLCBFbWl0RmlsZVJlc3VsdD4oKTtcbiAgICBjb25zdCB3cml0ZUZpbGVDYWxsYmFjazogdHMuV3JpdGVGaWxlQ2FsbGJhY2sgPSAoZmlsZW5hbWUsIGNvbnRlbnRzLCBfYSwgX2IsIHNvdXJjZUZpbGVzKSA9PiB7XG4gICAgICBpZiAoIXNvdXJjZUZpbGVzPy5sZW5ndGggJiYgZmlsZW5hbWUuZW5kc1dpdGgoYnVpbGRJbmZvRmlsZW5hbWUpKSB7XG4gICAgICAgIC8vIFNhdmUgYnVpbGRlciBpbmZvIGNvbnRlbnRzIHRvIHNwZWNpZmllZCBsb2NhdGlvblxuICAgICAgICBjb21waWxlckhvc3Qud3JpdGVGaWxlKGZpbGVuYW1lLCBjb250ZW50cywgZmFsc2UpO1xuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgYXNzZXJ0KHNvdXJjZUZpbGVzPy5sZW5ndGggPT09IDEsICdJbnZhbGlkIFR5cGVTY3JpcHQgcHJvZ3JhbSBlbWl0IGZvciAnICsgZmlsZW5hbWUpO1xuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IHRzLmdldE9yaWdpbmFsTm9kZShzb3VyY2VGaWxlc1swXSwgdHMuaXNTb3VyY2VGaWxlKTtcbiAgICAgIGlmIChhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRW1pdC5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBhbmd1bGFyQ29tcGlsZXIuaW5jcmVtZW50YWxDb21waWxhdGlvbi5yZWNvcmRTdWNjZXNzZnVsRW1pdChzb3VyY2VGaWxlKTtcbiAgICAgIGVtaXR0ZWRGaWxlcy5zZXQoc291cmNlRmlsZSwgeyBmaWxlbmFtZTogc291cmNlRmlsZS5maWxlTmFtZSwgY29udGVudHMgfSk7XG4gICAgfTtcbiAgICBjb25zdCB0cmFuc2Zvcm1lcnMgPSBtZXJnZVRyYW5zZm9ybWVycyhhbmd1bGFyQ29tcGlsZXIucHJlcGFyZUVtaXQoKS50cmFuc2Zvcm1lcnMsIHtcbiAgICAgIGJlZm9yZTogW1xuICAgICAgICByZXBsYWNlQm9vdHN0cmFwKCgpID0+IHR5cGVTY3JpcHRQcm9ncmFtLmdldFByb2dyYW0oKS5nZXRUeXBlQ2hlY2tlcigpKSxcbiAgICAgICAgd2ViV29ya2VyVHJhbnNmb3JtLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIFR5cGVTY3JpcHQgd2lsbCBsb29wIHVudGlsIHRoZXJlIGFyZSBubyBtb3JlIGFmZmVjdGVkIGZpbGVzIGluIHRoZSBwcm9ncmFtXG4gICAgd2hpbGUgKFxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0uZW1pdE5leHRBZmZlY3RlZEZpbGUod3JpdGVGaWxlQ2FsbGJhY2ssIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cmFuc2Zvcm1lcnMpXG4gICAgKSB7XG4gICAgICAvKiBlbXB0eSAqL1xuICAgIH1cblxuICAgIC8vIEFuZ3VsYXIgbWF5IGhhdmUgZmlsZXMgdGhhdCBtdXN0IGJlIGVtaXR0ZWQgYnV0IFR5cGVTY3JpcHQgZG9lcyBub3QgY29uc2lkZXIgYWZmZWN0ZWRcbiAgICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgdHlwZVNjcmlwdFByb2dyYW0uZ2V0U291cmNlRmlsZXMoKSkge1xuICAgICAgaWYgKGVtaXR0ZWRGaWxlcy5oYXMoc291cmNlRmlsZSkgfHwgYW5ndWxhckNvbXBpbGVyLmlnbm9yZUZvckVtaXQuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoc291cmNlRmlsZS5pc0RlY2xhcmF0aW9uRmlsZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGFuZ3VsYXJDb21waWxlci5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLnNhZmVUb1NraXBFbWl0KHNvdXJjZUZpbGUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbS5lbWl0KHNvdXJjZUZpbGUsIHdyaXRlRmlsZUNhbGxiYWNrLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJhbnNmb3JtZXJzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZW1pdHRlZEZpbGVzLnZhbHVlcygpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmRBZmZlY3RlZEZpbGVzKFxuICBidWlsZGVyOiB0cy5FbWl0QW5kU2VtYW50aWNEaWFnbm9zdGljc0J1aWxkZXJQcm9ncmFtLFxuICB7IGlnbm9yZUZvckRpYWdub3N0aWNzIH06IG5nLk5ndHNjUHJvZ3JhbVsnY29tcGlsZXInXSxcbiAgaW5jbHVkZVRUQzogYm9vbGVhbixcbik6IFNldDx0cy5Tb3VyY2VGaWxlPiB7XG4gIGNvbnN0IGFmZmVjdGVkRmlsZXMgPSBuZXcgU2V0PHRzLlNvdXJjZUZpbGU+KCk7XG5cbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnN0YW50LWNvbmRpdGlvblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGJ1aWxkZXIuZ2V0U2VtYW50aWNEaWFnbm9zdGljc09mTmV4dEFmZmVjdGVkRmlsZSh1bmRlZmluZWQsIChzb3VyY2VGaWxlKSA9PiB7XG4gICAgICAvLyBJZiB0aGUgYWZmZWN0ZWQgZmlsZSBpcyBhIFRUQyBzaGltLCBhZGQgdGhlIHNoaW0ncyBvcmlnaW5hbCBzb3VyY2UgZmlsZS5cbiAgICAgIC8vIFRoaXMgZW5zdXJlcyB0aGF0IGNoYW5nZXMgdGhhdCBhZmZlY3QgVFRDIGFyZSB0eXBlY2hlY2tlZCBldmVuIHdoZW4gdGhlIGNoYW5nZXNcbiAgICAgIC8vIGFyZSBvdGhlcndpc2UgdW5yZWxhdGVkIGZyb20gYSBUUyBwZXJzcGVjdGl2ZSBhbmQgZG8gbm90IHJlc3VsdCBpbiBJdnkgY29kZWdlbiBjaGFuZ2VzLlxuICAgICAgLy8gRm9yIGV4YW1wbGUsIGNoYW5naW5nIEBJbnB1dCBwcm9wZXJ0eSB0eXBlcyBvZiBhIGRpcmVjdGl2ZSB1c2VkIGluIGFub3RoZXIgY29tcG9uZW50J3NcbiAgICAgIC8vIHRlbXBsYXRlLlxuICAgICAgLy8gQSBUVEMgc2hpbSBpcyBhIGZpbGUgdGhhdCBoYXMgYmVlbiBpZ25vcmVkIGZvciBkaWFnbm9zdGljcyBhbmQgaGFzIGEgZmlsZW5hbWUgZW5kaW5nIGluIGAubmd0eXBlY2hlY2sudHNgLlxuICAgICAgaWYgKGlnbm9yZUZvckRpYWdub3N0aWNzLmhhcyhzb3VyY2VGaWxlKSAmJiBzb3VyY2VGaWxlLmZpbGVOYW1lLmVuZHNXaXRoKCcubmd0eXBlY2hlY2sudHMnKSkge1xuICAgICAgICAvLyBUaGlzIGZpbGUgbmFtZSBjb252ZXJzaW9uIHJlbGllcyBvbiBpbnRlcm5hbCBjb21waWxlciBsb2dpYyBhbmQgc2hvdWxkIGJlIGNvbnZlcnRlZFxuICAgICAgICAvLyB0byBhbiBvZmZpY2lhbCBtZXRob2Qgd2hlbiBhdmFpbGFibGUuIDE1IGlzIGxlbmd0aCBvZiBgLm5ndHlwZWNoZWNrLnRzYFxuICAgICAgICBjb25zdCBvcmlnaW5hbEZpbGVuYW1lID0gc291cmNlRmlsZS5maWxlTmFtZS5zbGljZSgwLCAtMTUpICsgJy50cyc7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsU291cmNlRmlsZSA9IGJ1aWxkZXIuZ2V0U291cmNlRmlsZShvcmlnaW5hbEZpbGVuYW1lKTtcbiAgICAgICAgaWYgKG9yaWdpbmFsU291cmNlRmlsZSkge1xuICAgICAgICAgIGFmZmVjdGVkRmlsZXMuYWRkKG9yaWdpbmFsU291cmNlRmlsZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuXG4gICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGFmZmVjdGVkRmlsZXMuYWRkKHJlc3VsdC5hZmZlY3RlZCBhcyB0cy5Tb3VyY2VGaWxlKTtcbiAgfVxuXG4gIC8vIEFkZCBhbGwgZmlsZXMgd2l0aCBhc3NvY2lhdGVkIHRlbXBsYXRlIHR5cGUgY2hlY2tpbmcgZmlsZXMuXG4gIC8vIFN0b3JlZCBUUyBidWlsZCBpbmZvIGRvZXMgbm90IGhhdmUga25vd2xlZGdlIG9mIHRoZSBBT1QgY29tcGlsZXIgb3IgdGhlIHR5cGVjaGVja2luZyBzdGF0ZSBvZiB0aGUgdGVtcGxhdGVzLlxuICAvLyBUbyBlbnN1cmUgdGhhdCBlcnJvcnMgYXJlIHJlcG9ydGVkIGNvcnJlY3RseSwgYWxsIEFPVCBjb21wb25lbnQgZGlhZ25vc3RpY3MgbmVlZCB0byBiZSBhbmFseXplZCBldmVuIGlmIGJ1aWxkXG4gIC8vIGluZm8gaXMgcHJlc2VudC5cbiAgaWYgKGluY2x1ZGVUVEMpIHtcbiAgICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgYnVpbGRlci5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICBpZiAoaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpICYmIHNvdXJjZUZpbGUuZmlsZU5hbWUuZW5kc1dpdGgoJy5uZ3R5cGVjaGVjay50cycpKSB7XG4gICAgICAgIC8vIFRoaXMgZmlsZSBuYW1lIGNvbnZlcnNpb24gcmVsaWVzIG9uIGludGVybmFsIGNvbXBpbGVyIGxvZ2ljIGFuZCBzaG91bGQgYmUgY29udmVydGVkXG4gICAgICAgIC8vIHRvIGFuIG9mZmljaWFsIG1ldGhvZCB3aGVuIGF2YWlsYWJsZS4gMTUgaXMgbGVuZ3RoIG9mIGAubmd0eXBlY2hlY2sudHNgXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsRmlsZW5hbWUgPSBzb3VyY2VGaWxlLmZpbGVOYW1lLnNsaWNlKDAsIC0xNSkgKyAnLnRzJztcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxTb3VyY2VGaWxlID0gYnVpbGRlci5nZXRTb3VyY2VGaWxlKG9yaWdpbmFsRmlsZW5hbWUpO1xuICAgICAgICBpZiAob3JpZ2luYWxTb3VyY2VGaWxlKSB7XG4gICAgICAgICAgYWZmZWN0ZWRGaWxlcy5hZGQob3JpZ2luYWxTb3VyY2VGaWxlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBhZmZlY3RlZEZpbGVzO1xufVxuIl19