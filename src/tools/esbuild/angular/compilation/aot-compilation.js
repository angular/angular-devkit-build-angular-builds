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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW90LWNvbXBpbGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2NvbXBpbGF0aW9uL2FvdC1jb21waWxhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFHSCw4REFBaUM7QUFDakMsNERBQTRCO0FBQzVCLCtDQUE0RDtBQUM1RCxrREFJeUI7QUFDekIsc0VBQW9FO0FBQ3BFLCtEQUEyRTtBQUUzRSxnREFBZ0Q7QUFDaEQsK0ZBQStGO0FBQy9GLE1BQU0sRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLE9BQU8sQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDO0FBRW5HLE1BQU0sdUJBQXVCO0lBRVQ7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFQbEIsWUFDa0IsY0FBK0IsRUFDL0IsWUFBNkIsRUFDN0IsaUJBQThELEVBQzlELGFBQXlDLEVBQ3pDLCtCQUErQyxFQUMvQyxrQkFBd0QsRUFDeEQsa0JBQWtCLElBQUksT0FBTyxFQUFrQztRQU4vRCxtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7UUFDL0IsaUJBQVksR0FBWixZQUFZLENBQWlCO1FBQzdCLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBNkM7UUFDOUQsa0JBQWEsR0FBYixhQUFhLENBQTRCO1FBQ3pDLG9DQUErQixHQUEvQiwrQkFBK0IsQ0FBZ0I7UUFDL0MsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFzQztRQUN4RCxvQkFBZSxHQUFmLGVBQWUsQ0FBZ0Q7SUFDOUUsQ0FBQztJQUVKLElBQUksZUFBZTtRQUNqQixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDO0lBQ3RDLENBQUM7Q0FDRjtBQUVELE1BQWEsY0FBZSxTQUFRLHdDQUFrQjtJ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QixHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztnQkFDbkUsSUFBSSxrQkFBa0IsRUFBRTtvQkFDdEIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO2lCQUN2QzthQUNGO1NBQ0Y7S0FDRjtJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgbmcgZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHsgcHJvZmlsZUFzeW5jLCBwcm9maWxlU3luYyB9IGZyb20gJy4uLy4uL3Byb2ZpbGluZyc7XG5pbXBvcnQge1xuICBBbmd1bGFySG9zdE9wdGlvbnMsXG4gIGNyZWF0ZUFuZ3VsYXJDb21waWxlckhvc3QsXG4gIGVuc3VyZVNvdXJjZUZpbGVWZXJzaW9ucyxcbn0gZnJvbSAnLi4vYW5ndWxhci1ob3N0JztcbmltcG9ydCB7IGNyZWF0ZVdvcmtlclRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vd2ViLXdvcmtlci10cmFuc2Zvcm1lcic7XG5pbXBvcnQgeyBBbmd1bGFyQ29tcGlsYXRpb24sIEVtaXRGaWxlUmVzdWx0IH0gZnJvbSAnLi9hbmd1bGFyLWNvbXBpbGF0aW9uJztcblxuLy8gVGVtcG9yYXJ5IGRlZXAgaW1wb3J0IGZvciB0cmFuc2Zvcm1lciBzdXBwb3J0XG4vLyBUT0RPOiBNb3ZlIHRoZXNlIHRvIGEgcHJpdmF0ZSBleHBvcnRzIGxvY2F0aW9uIG9yIG1vdmUgdGhlIGltcGxlbWVudGF0aW9uIGludG8gdGhpcyBwYWNrYWdlLlxuY29uc3QgeyBtZXJnZVRyYW5zZm9ybWVycywgcmVwbGFjZUJvb3RzdHJhcCB9ID0gcmVxdWlyZSgnQG5ndG9vbHMvd2VicGFjay9zcmMvaXZ5L3RyYW5zZm9ybWF0aW9uJyk7XG5cbmNsYXNzIEFuZ3VsYXJDb21waWxhdGlvblN0YXRlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIHJlYWRvbmx5IGFuZ3VsYXJQcm9ncmFtOiBuZy5OZ3RzY1Byb2dyYW0sXG4gICAgcHVibGljIHJlYWRvbmx5IGNvbXBpbGVySG9zdDogbmcuQ29tcGlsZXJIb3N0LFxuICAgIHB1YmxpYyByZWFkb25seSB0eXBlU2NyaXB0UHJvZ3JhbTogdHMuRW1pdEFuZFNlbWFudGljRGlhZ25vc3RpY3NCdWlsZGVyUHJvZ3JhbSxcbiAgICBwdWJsaWMgcmVhZG9ubHkgYWZmZWN0ZWRGaWxlczogUmVhZG9ubHlTZXQ8dHMuU291cmNlRmlsZT4sXG4gICAgcHVibGljIHJlYWRvbmx5IHRlbXBsYXRlRGlhZ25vc3RpY3NPcHRpbWl6YXRpb246IG5nLk9wdGltaXplRm9yLFxuICAgIHB1YmxpYyByZWFkb25seSB3ZWJXb3JrZXJUcmFuc2Zvcm06IHRzLlRyYW5zZm9ybWVyRmFjdG9yeTx0cy5Tb3VyY2VGaWxlPixcbiAgICBwdWJsaWMgcmVhZG9ubHkgZGlhZ25vc3RpY0NhY2hlID0gbmV3IFdlYWtNYXA8dHMuU291cmNlRmlsZSwgdHMuRGlhZ25vc3RpY1tdPigpLFxuICApIHt9XG5cbiAgZ2V0IGFuZ3VsYXJDb21waWxlcigpIHtcbiAgICByZXR1cm4gdGhpcy5hbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQW90Q29tcGlsYXRpb24gZXh0ZW5kcyBBbmd1bGFyQ29tcGlsYXRpb24ge1xuICAjc3RhdGU/OiBBbmd1bGFyQ29tcGlsYXRpb25TdGF0ZTtcblxuICBhc3luYyBpbml0aWFsaXplKFxuICAgIHRzY29uZmlnOiBzdHJpbmcsXG4gICAgaG9zdE9wdGlvbnM6IEFuZ3VsYXJIb3N0T3B0aW9ucyxcbiAgICBjb21waWxlck9wdGlvbnNUcmFuc2Zvcm1lcj86IChjb21waWxlck9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucykgPT4gbmcuQ29tcGlsZXJPcHRpb25zLFxuICApOiBQcm9taXNlPHtcbiAgICBhZmZlY3RlZEZpbGVzOiBSZWFkb25seVNldDx0cy5Tb3VyY2VGaWxlPjtcbiAgICBjb21waWxlck9wdGlvbnM6IG5nLkNvbXBpbGVyT3B0aW9ucztcbiAgICByZWZlcmVuY2VkRmlsZXM6IHJlYWRvbmx5IHN0cmluZ1tdO1xuICB9PiB7XG4gICAgLy8gRHluYW1pY2FsbHkgbG9hZCB0aGUgQW5ndWxhciBjb21waWxlciBDTEkgcGFja2FnZVxuICAgIGNvbnN0IHsgTmd0c2NQcm9ncmFtLCBPcHRpbWl6ZUZvciB9ID0gYXdhaXQgQW5ndWxhckNvbXBpbGF0aW9uLmxvYWRDb21waWxlckNsaSgpO1xuXG4gICAgLy8gTG9hZCB0aGUgY29tcGlsZXIgY29uZmlndXJhdGlvbiBhbmQgdHJhbnNmb3JtIGFzIG5lZWRlZFxuICAgIGNvbnN0IHtcbiAgICAgIG9wdGlvbnM6IG9yaWdpbmFsQ29tcGlsZXJPcHRpb25zLFxuICAgICAgcm9vdE5hbWVzLFxuICAgICAgZXJyb3JzOiBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3MsXG4gICAgfSA9IGF3YWl0IHRoaXMubG9hZENvbmZpZ3VyYXRpb24odHNjb25maWcpO1xuICAgIGNvbnN0IGNvbXBpbGVyT3B0aW9ucyA9XG4gICAgICBjb21waWxlck9wdGlvbnNUcmFuc2Zvcm1lcj8uKG9yaWdpbmFsQ29tcGlsZXJPcHRpb25zKSA/PyBvcmlnaW5hbENvbXBpbGVyT3B0aW9ucztcblxuICAgIC8vIENyZWF0ZSBBbmd1bGFyIGNvbXBpbGVyIGhvc3RcbiAgICBjb25zdCBob3N0ID0gY3JlYXRlQW5ndWxhckNvbXBpbGVySG9zdChjb21waWxlck9wdGlvbnMsIGhvc3RPcHRpb25zKTtcblxuICAgIC8vIENyZWF0ZSB0aGUgQW5ndWxhciBzcGVjaWZpYyBwcm9ncmFtIHRoYXQgY29udGFpbnMgdGhlIEFuZ3VsYXIgY29tcGlsZXJcbiAgICBjb25zdCBhbmd1bGFyUHJvZ3JhbSA9IHByb2ZpbGVTeW5jKFxuICAgICAgJ05HX0NSRUFURV9QUk9HUkFNJyxcbiAgICAgICgpID0+IG5ldyBOZ3RzY1Byb2dyYW0ocm9vdE5hbWVzLCBjb21waWxlck9wdGlvbnMsIGhvc3QsIHRoaXMuI3N0YXRlPy5hbmd1bGFyUHJvZ3JhbSksXG4gICAgKTtcbiAgICBjb25zdCBhbmd1bGFyQ29tcGlsZXIgPSBhbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgICBjb25zdCBhbmd1bGFyVHlwZVNjcmlwdFByb2dyYW0gPSBhbmd1bGFyUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKTtcbiAgICBlbnN1cmVTb3VyY2VGaWxlVmVyc2lvbnMoYW5ndWxhclR5cGVTY3JpcHRQcm9ncmFtKTtcblxuICAgIGxldCBvbGRQcm9ncmFtID0gdGhpcy4jc3RhdGU/LnR5cGVTY3JpcHRQcm9ncmFtO1xuICAgIGxldCB1c2luZ0J1aWxkSW5mbyA9IGZhbHNlO1xuICAgIGlmICghb2xkUHJvZ3JhbSkge1xuICAgICAgb2xkUHJvZ3JhbSA9IHRzLnJlYWRCdWlsZGVyUHJvZ3JhbShjb21waWxlck9wdGlvbnMsIGhvc3QpO1xuICAgICAgdXNpbmdCdWlsZEluZm8gPSAhIW9sZFByb2dyYW07XG4gICAgfVxuXG4gICAgY29uc3QgdHlwZVNjcmlwdFByb2dyYW0gPSB0cy5jcmVhdGVFbWl0QW5kU2VtYW50aWNEaWFnbm9zdGljc0J1aWxkZXJQcm9ncmFtKFxuICAgICAgYW5ndWxhclR5cGVTY3JpcHRQcm9ncmFtLFxuICAgICAgaG9zdCxcbiAgICAgIG9sZFByb2dyYW0sXG4gICAgICBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3MsXG4gICAgKTtcblxuICAgIGF3YWl0IHByb2ZpbGVBc3luYygnTkdfQU5BTFlaRV9QUk9HUkFNJywgKCkgPT4gYW5ndWxhckNvbXBpbGVyLmFuYWx5emVBc3luYygpKTtcbiAgICBjb25zdCBhZmZlY3RlZEZpbGVzID0gcHJvZmlsZVN5bmMoJ05HX0ZJTkRfQUZGRUNURUQnLCAoKSA9PlxuICAgICAgZmluZEFmZmVjdGVkRmlsZXModHlwZVNjcmlwdFByb2dyYW0sIGFuZ3VsYXJDb21waWxlciwgdXNpbmdCdWlsZEluZm8pLFxuICAgICk7XG5cbiAgICAvLyBHZXQgYWxsIGZpbGVzIHJlZmVyZW5jZWQgaW4gdGhlIFR5cGVTY3JpcHQvQW5ndWxhciBwcm9ncmFtIGluY2x1ZGluZyBjb21wb25lbnQgcmVzb3VyY2VzXG4gICAgY29uc3QgcmVmZXJlbmNlZEZpbGVzID0gdHlwZVNjcmlwdFByb2dyYW1cbiAgICAgIC5nZXRTb3VyY2VGaWxlcygpXG4gICAgICAuZmlsdGVyKChzb3VyY2VGaWxlKSA9PiAhYW5ndWxhckNvbXBpbGVyLmlnbm9yZUZvckVtaXQuaGFzKHNvdXJjZUZpbGUpKVxuICAgICAgLmZsYXRNYXAoKHNvdXJjZUZpbGUpID0+IHtcbiAgICAgICAgY29uc3QgcmVzb3VyY2VEZXBlbmRlbmNpZXMgPSBhbmd1bGFyQ29tcGlsZXIuZ2V0UmVzb3VyY2VEZXBlbmRlbmNpZXMoc291cmNlRmlsZSk7XG5cbiAgICAgICAgLy8gQWxzbyBpbnZhbGlkYXRlIEFuZ3VsYXIgZGlhZ25vc3RpY3MgZm9yIGEgc291cmNlIGZpbGUgaWYgY29tcG9uZW50IHJlc291cmNlcyBhcmUgbW9kaWZpZWRcbiAgICAgICAgaWYgKHRoaXMuI3N0YXRlICYmIGhvc3RPcHRpb25zLm1vZGlmaWVkRmlsZXM/LnNpemUpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHJlc291cmNlRGVwZW5kZW5jeSBvZiByZXNvdXJjZURlcGVuZGVuY2llcykge1xuICAgICAgICAgICAgaWYgKGhvc3RPcHRpb25zLm1vZGlmaWVkRmlsZXMuaGFzKHJlc291cmNlRGVwZW5kZW5jeSkpIHtcbiAgICAgICAgICAgICAgdGhpcy4jc3RhdGUuZGlhZ25vc3RpY0NhY2hlLmRlbGV0ZShzb3VyY2VGaWxlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gW3NvdXJjZUZpbGUuZmlsZU5hbWUsIC4uLnJlc291cmNlRGVwZW5kZW5jaWVzXTtcbiAgICAgIH0pO1xuXG4gICAgdGhpcy4jc3RhdGUgPSBuZXcgQW5ndWxhckNvbXBpbGF0aW9uU3RhdGUoXG4gICAgICBhbmd1bGFyUHJvZ3JhbSxcbiAgICAgIGhvc3QsXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbSxcbiAgICAgIGFmZmVjdGVkRmlsZXMsXG4gICAgICBhZmZlY3RlZEZpbGVzLnNpemUgPT09IDEgPyBPcHRpbWl6ZUZvci5TaW5nbGVGaWxlIDogT3B0aW1pemVGb3IuV2hvbGVQcm9ncmFtLFxuICAgICAgY3JlYXRlV29ya2VyVHJhbnNmb3JtZXIoaG9zdE9wdGlvbnMucHJvY2Vzc1dlYldvcmtlci5iaW5kKGhvc3RPcHRpb25zKSksXG4gICAgICB0aGlzLiNzdGF0ZT8uZGlhZ25vc3RpY0NhY2hlLFxuICAgICk7XG5cbiAgICByZXR1cm4geyBhZmZlY3RlZEZpbGVzLCBjb21waWxlck9wdGlvbnMsIHJlZmVyZW5jZWRGaWxlcyB9O1xuICB9XG5cbiAgKmNvbGxlY3REaWFnbm9zdGljcygpOiBJdGVyYWJsZTx0cy5EaWFnbm9zdGljPiB7XG4gICAgYXNzZXJ0KHRoaXMuI3N0YXRlLCAnQW5ndWxhciBjb21waWxhdGlvbiBtdXN0IGJlIGluaXRpYWxpemVkIHByaW9yIHRvIGNvbGxlY3RpbmcgZGlhZ25vc3RpY3MuJyk7XG4gICAgY29uc3Qge1xuICAgICAgYWZmZWN0ZWRGaWxlcyxcbiAgICAgIGFuZ3VsYXJDb21waWxlcixcbiAgICAgIGRpYWdub3N0aWNDYWNoZSxcbiAgICAgIHRlbXBsYXRlRGlhZ25vc3RpY3NPcHRpbWl6YXRpb24sXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbSxcbiAgICB9ID0gdGhpcy4jc3RhdGU7XG5cbiAgICAvLyBDb2xsZWN0IHByb2dyYW0gbGV2ZWwgZGlhZ25vc3RpY3NcbiAgICB5aWVsZCogdHlwZVNjcmlwdFByb2dyYW0uZ2V0Q29uZmlnRmlsZVBhcnNpbmdEaWFnbm9zdGljcygpO1xuICAgIHlpZWxkKiBhbmd1bGFyQ29tcGlsZXIuZ2V0T3B0aW9uRGlhZ25vc3RpY3MoKTtcbiAgICB5aWVsZCogdHlwZVNjcmlwdFByb2dyYW0uZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCk7XG4gICAgeWllbGQqIHR5cGVTY3JpcHRQcm9ncmFtLmdldEdsb2JhbERpYWdub3N0aWNzKCk7XG5cbiAgICAvLyBDb2xsZWN0IHNvdXJjZSBmaWxlIHNwZWNpZmljIGRpYWdub3N0aWNzXG4gICAgZm9yIChjb25zdCBzb3VyY2VGaWxlIG9mIHR5cGVTY3JpcHRQcm9ncmFtLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgIGlmIChhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBUeXBlU2NyaXB0IHdpbGwgdXNlIGNhY2hlZCBkaWFnbm9zdGljcyBmb3IgZmlsZXMgdGhhdCBoYXZlIG5vdCBiZWVuXG4gICAgICAvLyBjaGFuZ2VkIG9yIGFmZmVjdGVkIGZvciB0aGlzIGJ1aWxkIHdoZW4gdXNpbmcgaW5jcmVtZW50YWwgYnVpbGRpbmcuXG4gICAgICB5aWVsZCogcHJvZmlsZVN5bmMoXG4gICAgICAgICdOR19ESUFHTk9TVElDU19TWU5UQUNUSUMnLFxuICAgICAgICAoKSA9PiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlKSxcbiAgICAgICAgdHJ1ZSxcbiAgICAgICk7XG4gICAgICB5aWVsZCogcHJvZmlsZVN5bmMoXG4gICAgICAgICdOR19ESUFHTk9TVElDU19TRU1BTlRJQycsXG4gICAgICAgICgpID0+IHR5cGVTY3JpcHRQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc291cmNlRmlsZSksXG4gICAgICAgIHRydWUsXG4gICAgICApO1xuXG4gICAgICAvLyBEZWNsYXJhdGlvbiBmaWxlcyBjYW5ub3QgaGF2ZSB0ZW1wbGF0ZSBkaWFnbm9zdGljc1xuICAgICAgaWYgKHNvdXJjZUZpbGUuaXNEZWNsYXJhdGlvbkZpbGUpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIE9ubHkgcmVxdWVzdCBBbmd1bGFyIHRlbXBsYXRlIGRpYWdub3N0aWNzIGZvciBhZmZlY3RlZCBmaWxlcyB0byBhdm9pZFxuICAgICAgLy8gb3ZlcmhlYWQgb2YgdGVtcGxhdGUgZGlhZ25vc3RpY3MgZm9yIHVuY2hhbmdlZCBmaWxlcy5cbiAgICAgIGlmIChhZmZlY3RlZEZpbGVzLmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgICBjb25zdCBhbmd1bGFyRGlhZ25vc3RpY3MgPSBwcm9maWxlU3luYyhcbiAgICAgICAgICAnTkdfRElBR05PU1RJQ1NfVEVNUExBVEUnLFxuICAgICAgICAgICgpID0+IGFuZ3VsYXJDb21waWxlci5nZXREaWFnbm9zdGljc0ZvckZpbGUoc291cmNlRmlsZSwgdGVtcGxhdGVEaWFnbm9zdGljc09wdGltaXphdGlvbiksXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKTtcbiAgICAgICAgZGlhZ25vc3RpY0NhY2hlLnNldChzb3VyY2VGaWxlLCBhbmd1bGFyRGlhZ25vc3RpY3MpO1xuICAgICAgICB5aWVsZCogYW5ndWxhckRpYWdub3N0aWNzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gZGlhZ25vc3RpY0NhY2hlLmdldChzb3VyY2VGaWxlKTtcbiAgICAgICAgaWYgKGFuZ3VsYXJEaWFnbm9zdGljcykge1xuICAgICAgICAgIHlpZWxkKiBhbmd1bGFyRGlhZ25vc3RpY3M7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBlbWl0QWZmZWN0ZWRGaWxlcygpOiBJdGVyYWJsZTxFbWl0RmlsZVJlc3VsdD4ge1xuICAgIGFzc2VydCh0aGlzLiNzdGF0ZSwgJ0FuZ3VsYXIgY29tcGlsYXRpb24gbXVzdCBiZSBpbml0aWFsaXplZCBwcmlvciB0byBlbWl0dGluZyBmaWxlcy4nKTtcbiAgICBjb25zdCB7IGFuZ3VsYXJDb21waWxlciwgY29tcGlsZXJIb3N0LCB0eXBlU2NyaXB0UHJvZ3JhbSwgd2ViV29ya2VyVHJhbnNmb3JtIH0gPSB0aGlzLiNzdGF0ZTtcbiAgICBjb25zdCBidWlsZEluZm9GaWxlbmFtZSA9XG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRDb21waWxlck9wdGlvbnMoKS50c0J1aWxkSW5mb0ZpbGUgPz8gJy50c2J1aWxkaW5mbyc7XG5cbiAgICBjb25zdCBlbWl0dGVkRmlsZXMgPSBuZXcgTWFwPHRzLlNvdXJjZUZpbGUsIEVtaXRGaWxlUmVzdWx0PigpO1xuICAgIGNvbnN0IHdyaXRlRmlsZUNhbGxiYWNrOiB0cy5Xcml0ZUZpbGVDYWxsYmFjayA9IChmaWxlbmFtZSwgY29udGVudHMsIF9hLCBfYiwgc291cmNlRmlsZXMpID0+IHtcbiAgICAgIGlmICghc291cmNlRmlsZXM/Lmxlbmd0aCAmJiBmaWxlbmFtZS5lbmRzV2l0aChidWlsZEluZm9GaWxlbmFtZSkpIHtcbiAgICAgICAgLy8gU2F2ZSBidWlsZGVyIGluZm8gY29udGVudHMgdG8gc3BlY2lmaWVkIGxvY2F0aW9uXG4gICAgICAgIGNvbXBpbGVySG9zdC53cml0ZUZpbGUoZmlsZW5hbWUsIGNvbnRlbnRzLCBmYWxzZSk7XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBhc3NlcnQoc291cmNlRmlsZXM/Lmxlbmd0aCA9PT0gMSwgJ0ludmFsaWQgVHlwZVNjcmlwdCBwcm9ncmFtIGVtaXQgZm9yICcgKyBmaWxlbmFtZSk7XG4gICAgICBjb25zdCBzb3VyY2VGaWxlID0gdHMuZ2V0T3JpZ2luYWxOb2RlKHNvdXJjZUZpbGVzWzBdLCB0cy5pc1NvdXJjZUZpbGUpO1xuICAgICAgaWYgKGFuZ3VsYXJDb21waWxlci5pZ25vcmVGb3JFbWl0Lmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGFuZ3VsYXJDb21waWxlci5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLnJlY29yZFN1Y2Nlc3NmdWxFbWl0KHNvdXJjZUZpbGUpO1xuICAgICAgZW1pdHRlZEZpbGVzLnNldChzb3VyY2VGaWxlLCB7IGZpbGVuYW1lOiBzb3VyY2VGaWxlLmZpbGVOYW1lLCBjb250ZW50cyB9KTtcbiAgICB9O1xuICAgIGNvbnN0IHRyYW5zZm9ybWVycyA9IG1lcmdlVHJhbnNmb3JtZXJzKGFuZ3VsYXJDb21waWxlci5wcmVwYXJlRW1pdCgpLnRyYW5zZm9ybWVycywge1xuICAgICAgYmVmb3JlOiBbXG4gICAgICAgIHJlcGxhY2VCb290c3RyYXAoKCkgPT4gdHlwZVNjcmlwdFByb2dyYW0uZ2V0UHJvZ3JhbSgpLmdldFR5cGVDaGVja2VyKCkpLFxuICAgICAgICB3ZWJXb3JrZXJUcmFuc2Zvcm0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gVHlwZVNjcmlwdCB3aWxsIGxvb3AgdW50aWwgdGhlcmUgYXJlIG5vIG1vcmUgYWZmZWN0ZWQgZmlsZXMgaW4gdGhlIHByb2dyYW1cbiAgICB3aGlsZSAoXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbS5lbWl0TmV4dEFmZmVjdGVkRmlsZSh3cml0ZUZpbGVDYWxsYmFjaywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRyYW5zZm9ybWVycylcbiAgICApIHtcbiAgICAgIC8qIGVtcHR5ICovXG4gICAgfVxuXG4gICAgLy8gQW5ndWxhciBtYXkgaGF2ZSBmaWxlcyB0aGF0IG11c3QgYmUgZW1pdHRlZCBidXQgVHlwZVNjcmlwdCBkb2VzIG5vdCBjb25zaWRlciBhZmZlY3RlZFxuICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICBpZiAoZW1pdHRlZEZpbGVzLmhhcyhzb3VyY2VGaWxlKSB8fCBhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRW1pdC5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChzb3VyY2VGaWxlLmlzRGVjbGFyYXRpb25GaWxlKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoYW5ndWxhckNvbXBpbGVyLmluY3JlbWVudGFsQ29tcGlsYXRpb24uc2FmZVRvU2tpcEVtaXQoc291cmNlRmlsZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHR5cGVTY3JpcHRQcm9ncmFtLmVtaXQoc291cmNlRmlsZSwgd3JpdGVGaWxlQ2FsbGJhY2ssIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cmFuc2Zvcm1lcnMpO1xuICAgIH1cblxuICAgIHJldHVybiBlbWl0dGVkRmlsZXMudmFsdWVzKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZEFmZmVjdGVkRmlsZXMoXG4gIGJ1aWxkZXI6IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0sXG4gIHsgaWdub3JlRm9yRGlhZ25vc3RpY3MgfTogbmcuTmd0c2NQcm9ncmFtWydjb21waWxlciddLFxuICBpbmNsdWRlVFRDOiBib29sZWFuLFxuKTogU2V0PHRzLlNvdXJjZUZpbGU+IHtcbiAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IG5ldyBTZXQ8dHMuU291cmNlRmlsZT4oKTtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYnVpbGRlci5nZXRTZW1hbnRpY0RpYWdub3N0aWNzT2ZOZXh0QWZmZWN0ZWRGaWxlKHVuZGVmaW5lZCwgKHNvdXJjZUZpbGUpID0+IHtcbiAgICAgIC8vIElmIHRoZSBhZmZlY3RlZCBmaWxlIGlzIGEgVFRDIHNoaW0sIGFkZCB0aGUgc2hpbSdzIG9yaWdpbmFsIHNvdXJjZSBmaWxlLlxuICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoYXQgY2hhbmdlcyB0aGF0IGFmZmVjdCBUVEMgYXJlIHR5cGVjaGVja2VkIGV2ZW4gd2hlbiB0aGUgY2hhbmdlc1xuICAgICAgLy8gYXJlIG90aGVyd2lzZSB1bnJlbGF0ZWQgZnJvbSBhIFRTIHBlcnNwZWN0aXZlIGFuZCBkbyBub3QgcmVzdWx0IGluIEl2eSBjb2RlZ2VuIGNoYW5nZXMuXG4gICAgICAvLyBGb3IgZXhhbXBsZSwgY2hhbmdpbmcgQElucHV0IHByb3BlcnR5IHR5cGVzIG9mIGEgZGlyZWN0aXZlIHVzZWQgaW4gYW5vdGhlciBjb21wb25lbnQnc1xuICAgICAgLy8gdGVtcGxhdGUuXG4gICAgICAvLyBBIFRUQyBzaGltIGlzIGEgZmlsZSB0aGF0IGhhcyBiZWVuIGlnbm9yZWQgZm9yIGRpYWdub3N0aWNzIGFuZCBoYXMgYSBmaWxlbmFtZSBlbmRpbmcgaW4gYC5uZ3R5cGVjaGVjay50c2AuXG4gICAgICBpZiAoaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpICYmIHNvdXJjZUZpbGUuZmlsZU5hbWUuZW5kc1dpdGgoJy5uZ3R5cGVjaGVjay50cycpKSB7XG4gICAgICAgIC8vIFRoaXMgZmlsZSBuYW1lIGNvbnZlcnNpb24gcmVsaWVzIG9uIGludGVybmFsIGNvbXBpbGVyIGxvZ2ljIGFuZCBzaG91bGQgYmUgY29udmVydGVkXG4gICAgICAgIC8vIHRvIGFuIG9mZmljaWFsIG1ldGhvZCB3aGVuIGF2YWlsYWJsZS4gMTUgaXMgbGVuZ3RoIG9mIGAubmd0eXBlY2hlY2sudHNgXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsRmlsZW5hbWUgPSBzb3VyY2VGaWxlLmZpbGVOYW1lLnNsaWNlKDAsIC0xNSkgKyAnLnRzJztcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxTb3VyY2VGaWxlID0gYnVpbGRlci5nZXRTb3VyY2VGaWxlKG9yaWdpbmFsRmlsZW5hbWUpO1xuICAgICAgICBpZiAob3JpZ2luYWxTb3VyY2VGaWxlKSB7XG4gICAgICAgICAgYWZmZWN0ZWRGaWxlcy5hZGQob3JpZ2luYWxTb3VyY2VGaWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgYWZmZWN0ZWRGaWxlcy5hZGQocmVzdWx0LmFmZmVjdGVkIGFzIHRzLlNvdXJjZUZpbGUpO1xuICB9XG5cbiAgLy8gQWRkIGFsbCBmaWxlcyB3aXRoIGFzc29jaWF0ZWQgdGVtcGxhdGUgdHlwZSBjaGVja2luZyBmaWxlcy5cbiAgLy8gU3RvcmVkIFRTIGJ1aWxkIGluZm8gZG9lcyBub3QgaGF2ZSBrbm93bGVkZ2Ugb2YgdGhlIEFPVCBjb21waWxlciBvciB0aGUgdHlwZWNoZWNraW5nIHN0YXRlIG9mIHRoZSB0ZW1wbGF0ZXMuXG4gIC8vIFRvIGVuc3VyZSB0aGF0IGVycm9ycyBhcmUgcmVwb3J0ZWQgY29ycmVjdGx5LCBhbGwgQU9UIGNvbXBvbmVudCBkaWFnbm9zdGljcyBuZWVkIHRvIGJlIGFuYWx5emVkIGV2ZW4gaWYgYnVpbGRcbiAgLy8gaW5mbyBpcyBwcmVzZW50LlxuICBpZiAoaW5jbHVkZVRUQykge1xuICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiBidWlsZGVyLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgIGlmIChpZ25vcmVGb3JEaWFnbm9zdGljcy5oYXMoc291cmNlRmlsZSkgJiYgc291cmNlRmlsZS5maWxlTmFtZS5lbmRzV2l0aCgnLm5ndHlwZWNoZWNrLnRzJykpIHtcbiAgICAgICAgLy8gVGhpcyBmaWxlIG5hbWUgY29udmVyc2lvbiByZWxpZXMgb24gaW50ZXJuYWwgY29tcGlsZXIgbG9naWMgYW5kIHNob3VsZCBiZSBjb252ZXJ0ZWRcbiAgICAgICAgLy8gdG8gYW4gb2ZmaWNpYWwgbWV0aG9kIHdoZW4gYXZhaWxhYmxlLiAxNSBpcyBsZW5ndGggb2YgYC5uZ3R5cGVjaGVjay50c2BcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxGaWxlbmFtZSA9IHNvdXJjZUZpbGUuZmlsZU5hbWUuc2xpY2UoMCwgLTE1KSArICcudHMnO1xuICAgICAgICBjb25zdCBvcmlnaW5hbFNvdXJjZUZpbGUgPSBidWlsZGVyLmdldFNvdXJjZUZpbGUob3JpZ2luYWxGaWxlbmFtZSk7XG4gICAgICAgIGlmIChvcmlnaW5hbFNvdXJjZUZpbGUpIHtcbiAgICAgICAgICBhZmZlY3RlZEZpbGVzLmFkZChvcmlnaW5hbFNvdXJjZUZpbGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGFmZmVjdGVkRmlsZXM7XG59XG4iXX0=