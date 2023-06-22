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
            .flatMap((sourceFile) => [
            sourceFile.fileName,
            ...angularCompiler.getResourceDependencies(sourceFile),
        ]);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW90LWNvbXBpbGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2FvdC1jb21waWxhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCw4REFBaUM7QUFDakMsNERBQTRCO0FBQzVCLDRDQUF5RDtBQUN6RCwrREFBMkU7QUFDM0UsaURBSXdCO0FBRXhCLGdEQUFnRDtBQUNoRCwrRkFBK0Y7QUFDL0YsTUFBTSxFQUFFLGlCQUFpQixFQUFFLGdCQUFnQixFQUFFLEdBQUcsT0FBTyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7QUFFbkcsTUFBTSx1QkFBdUI7SUFDM0IsWUFDa0IsY0FBK0IsRUFDL0IsWUFBNkIsRUFDN0IsaUJBQThELEVBQzlELGFBQXlDLEVBQ3pDLCtCQUErQyxFQUMvQyxrQkFBa0IsSUFBSSxPQUFPLEVBQWtDO1FBTC9ELG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUMvQixpQkFBWSxHQUFaLFlBQVksQ0FBaUI7UUFDN0Isc0JBQWlCLEdBQWpCLGlCQUFpQixDQUE2QztRQUM5RCxrQkFBYSxHQUFiLGFBQWEsQ0FBNEI7UUFDekMsb0NBQStCLEdBQS9CLCtCQUErQixDQUFnQjtRQUMvQyxvQkFBZSxHQUFmLGVBQWUsQ0FBZ0Q7SUFDOUUsQ0FBQztJQUVKLElBQUksZUFBZTtRQUNqQixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDO0lBQ3RDLENBQUM7Q0FDRjtBQUVELE1BQWEsY0FBZSxTQUFRLHdDQUFrQjtJQUF0RDs7UUFDRSx3Q0FBaUM7SUEyTG5DLENBQUM7SUF6TEMsS0FBSyxDQUFDLFVBQVUsQ0FDZCxRQUFnQixFQUNoQixXQUErQixFQUMvQiwwQkFBd0Y7UUFNeEYsb0RB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QUNyRDtJQUVELDhEQUE4RDtJQUM5RCwrR0FBK0c7SUFDL0csZ0hBQWdIO0lBQ2hILG1CQUFtQjtJQUNuQixJQUFJLFVBQVUsRUFBRTtRQUNkLEtBQUssTUFBTSxVQUFVLElBQUksT0FBTyxDQUFDLGNBQWMsRUFBRSxFQUFFO1lBQ2pELElBQUksb0JBQW9CLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLEVBQUU7Z0JBQzNGLHNGQUFzRjtnQkFDdEYsMEVBQTBFO2dCQUMxRSxNQUFNLGdCQUFnQixHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQztnQkFDbkUsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLENBQUM7Z0JBQ25FLElBQUksa0JBQWtCLEVBQUU7b0JBQ3RCLGFBQWEsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztpQkFDdkM7YUFDRjtTQUNGO0tBQ0Y7SUFFRCxPQUFPLGFBQWEsQ0FBQztBQUN2QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIG5nIGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7IHByb2ZpbGVBc3luYywgcHJvZmlsZVN5bmMgfSBmcm9tICcuLi9wcm9maWxpbmcnO1xuaW1wb3J0IHsgQW5ndWxhckNvbXBpbGF0aW9uLCBFbWl0RmlsZVJlc3VsdCB9IGZyb20gJy4vYW5ndWxhci1jb21waWxhdGlvbic7XG5pbXBvcnQge1xuICBBbmd1bGFySG9zdE9wdGlvbnMsXG4gIGNyZWF0ZUFuZ3VsYXJDb21waWxlckhvc3QsXG4gIGVuc3VyZVNvdXJjZUZpbGVWZXJzaW9ucyxcbn0gZnJvbSAnLi9hbmd1bGFyLWhvc3QnO1xuXG4vLyBUZW1wb3JhcnkgZGVlcCBpbXBvcnQgZm9yIHRyYW5zZm9ybWVyIHN1cHBvcnRcbi8vIFRPRE86IE1vdmUgdGhlc2UgdG8gYSBwcml2YXRlIGV4cG9ydHMgbG9jYXRpb24gb3IgbW92ZSB0aGUgaW1wbGVtZW50YXRpb24gaW50byB0aGlzIHBhY2thZ2UuXG5jb25zdCB7IG1lcmdlVHJhbnNmb3JtZXJzLCByZXBsYWNlQm9vdHN0cmFwIH0gPSByZXF1aXJlKCdAbmd0b29scy93ZWJwYWNrL3NyYy9pdnkvdHJhbnNmb3JtYXRpb24nKTtcblxuY2xhc3MgQW5ndWxhckNvbXBpbGF0aW9uU3RhdGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgcmVhZG9ubHkgYW5ndWxhclByb2dyYW06IG5nLk5ndHNjUHJvZ3JhbSxcbiAgICBwdWJsaWMgcmVhZG9ubHkgY29tcGlsZXJIb3N0OiBuZy5Db21waWxlckhvc3QsXG4gICAgcHVibGljIHJlYWRvbmx5IHR5cGVTY3JpcHRQcm9ncmFtOiB0cy5FbWl0QW5kU2VtYW50aWNEaWFnbm9zdGljc0J1aWxkZXJQcm9ncmFtLFxuICAgIHB1YmxpYyByZWFkb25seSBhZmZlY3RlZEZpbGVzOiBSZWFkb25seVNldDx0cy5Tb3VyY2VGaWxlPixcbiAgICBwdWJsaWMgcmVhZG9ubHkgdGVtcGxhdGVEaWFnbm9zdGljc09wdGltaXphdGlvbjogbmcuT3B0aW1pemVGb3IsXG4gICAgcHVibGljIHJlYWRvbmx5IGRpYWdub3N0aWNDYWNoZSA9IG5ldyBXZWFrTWFwPHRzLlNvdXJjZUZpbGUsIHRzLkRpYWdub3N0aWNbXT4oKSxcbiAgKSB7fVxuXG4gIGdldCBhbmd1bGFyQ29tcGlsZXIoKSB7XG4gICAgcmV0dXJuIHRoaXMuYW5ndWxhclByb2dyYW0uY29tcGlsZXI7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEFvdENvbXBpbGF0aW9uIGV4dGVuZHMgQW5ndWxhckNvbXBpbGF0aW9uIHtcbiAgI3N0YXRlPzogQW5ndWxhckNvbXBpbGF0aW9uU3RhdGU7XG5cbiAgYXN5bmMgaW5pdGlhbGl6ZShcbiAgICB0c2NvbmZpZzogc3RyaW5nLFxuICAgIGhvc3RPcHRpb25zOiBBbmd1bGFySG9zdE9wdGlvbnMsXG4gICAgY29tcGlsZXJPcHRpb25zVHJhbnNmb3JtZXI/OiAoY29tcGlsZXJPcHRpb25zOiBuZy5Db21waWxlck9wdGlvbnMpID0+IG5nLkNvbXBpbGVyT3B0aW9ucyxcbiAgKTogUHJvbWlzZTx7XG4gICAgYWZmZWN0ZWRGaWxlczogUmVhZG9ubHlTZXQ8dHMuU291cmNlRmlsZT47XG4gICAgY29tcGlsZXJPcHRpb25zOiBuZy5Db21waWxlck9wdGlvbnM7XG4gICAgcmVmZXJlbmNlZEZpbGVzOiByZWFkb25seSBzdHJpbmdbXTtcbiAgfT4ge1xuICAgIC8vIER5bmFtaWNhbGx5IGxvYWQgdGhlIEFuZ3VsYXIgY29tcGlsZXIgQ0xJIHBhY2thZ2VcbiAgICBjb25zdCB7IE5ndHNjUHJvZ3JhbSwgT3B0aW1pemVGb3IgfSA9IGF3YWl0IEFuZ3VsYXJDb21waWxhdGlvbi5sb2FkQ29tcGlsZXJDbGkoKTtcblxuICAgIC8vIExvYWQgdGhlIGNvbXBpbGVyIGNvbmZpZ3VyYXRpb24gYW5kIHRyYW5zZm9ybSBhcyBuZWVkZWRcbiAgICBjb25zdCB7XG4gICAgICBvcHRpb25zOiBvcmlnaW5hbENvbXBpbGVyT3B0aW9ucyxcbiAgICAgIHJvb3ROYW1lcyxcbiAgICAgIGVycm9yczogY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgIH0gPSBhd2FpdCB0aGlzLmxvYWRDb25maWd1cmF0aW9uKHRzY29uZmlnKTtcbiAgICBjb25zdCBjb21waWxlck9wdGlvbnMgPVxuICAgICAgY29tcGlsZXJPcHRpb25zVHJhbnNmb3JtZXI/LihvcmlnaW5hbENvbXBpbGVyT3B0aW9ucykgPz8gb3JpZ2luYWxDb21waWxlck9wdGlvbnM7XG5cbiAgICAvLyBDcmVhdGUgQW5ndWxhciBjb21waWxlciBob3N0XG4gICAgY29uc3QgaG9zdCA9IGNyZWF0ZUFuZ3VsYXJDb21waWxlckhvc3QoY29tcGlsZXJPcHRpb25zLCBob3N0T3B0aW9ucyk7XG5cbiAgICAvLyBDcmVhdGUgdGhlIEFuZ3VsYXIgc3BlY2lmaWMgcHJvZ3JhbSB0aGF0IGNvbnRhaW5zIHRoZSBBbmd1bGFyIGNvbXBpbGVyXG4gICAgY29uc3QgYW5ndWxhclByb2dyYW0gPSBwcm9maWxlU3luYyhcbiAgICAgICdOR19DUkVBVEVfUFJPR1JBTScsXG4gICAgICAoKSA9PiBuZXcgTmd0c2NQcm9ncmFtKHJvb3ROYW1lcywgY29tcGlsZXJPcHRpb25zLCBob3N0LCB0aGlzLiNzdGF0ZT8uYW5ndWxhclByb2dyYW0pLFxuICAgICk7XG4gICAgY29uc3QgYW5ndWxhckNvbXBpbGVyID0gYW5ndWxhclByb2dyYW0uY29tcGlsZXI7XG4gICAgY29uc3QgYW5ndWxhclR5cGVTY3JpcHRQcm9ncmFtID0gYW5ndWxhclByb2dyYW0uZ2V0VHNQcm9ncmFtKCk7XG4gICAgZW5zdXJlU291cmNlRmlsZVZlcnNpb25zKGFuZ3VsYXJUeXBlU2NyaXB0UHJvZ3JhbSk7XG5cbiAgICBsZXQgb2xkUHJvZ3JhbSA9IHRoaXMuI3N0YXRlPy50eXBlU2NyaXB0UHJvZ3JhbTtcbiAgICBsZXQgdXNpbmdCdWlsZEluZm8gPSBmYWxzZTtcbiAgICBpZiAoIW9sZFByb2dyYW0pIHtcbiAgICAgIG9sZFByb2dyYW0gPSB0cy5yZWFkQnVpbGRlclByb2dyYW0oY29tcGlsZXJPcHRpb25zLCBob3N0KTtcbiAgICAgIHVzaW5nQnVpbGRJbmZvID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0eXBlU2NyaXB0UHJvZ3JhbSA9IHRzLmNyZWF0ZUVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0oXG4gICAgICBhbmd1bGFyVHlwZVNjcmlwdFByb2dyYW0sXG4gICAgICBob3N0LFxuICAgICAgb2xkUHJvZ3JhbSxcbiAgICAgIGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcyxcbiAgICApO1xuXG4gICAgYXdhaXQgcHJvZmlsZUFzeW5jKCdOR19BTkFMWVpFX1BST0dSQU0nLCAoKSA9PiBhbmd1bGFyQ29tcGlsZXIuYW5hbHl6ZUFzeW5jKCkpO1xuICAgIGNvbnN0IGFmZmVjdGVkRmlsZXMgPSBwcm9maWxlU3luYygnTkdfRklORF9BRkZFQ1RFRCcsICgpID0+XG4gICAgICBmaW5kQWZmZWN0ZWRGaWxlcyh0eXBlU2NyaXB0UHJvZ3JhbSwgYW5ndWxhckNvbXBpbGVyLCB1c2luZ0J1aWxkSW5mbyksXG4gICAgKTtcblxuICAgIHRoaXMuI3N0YXRlID0gbmV3IEFuZ3VsYXJDb21waWxhdGlvblN0YXRlKFxuICAgICAgYW5ndWxhclByb2dyYW0sXG4gICAgICBob3N0LFxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0sXG4gICAgICBhZmZlY3RlZEZpbGVzLFxuICAgICAgYWZmZWN0ZWRGaWxlcy5zaXplID09PSAxID8gT3B0aW1pemVGb3IuU2luZ2xlRmlsZSA6IE9wdGltaXplRm9yLldob2xlUHJvZ3JhbSxcbiAgICAgIHRoaXMuI3N0YXRlPy5kaWFnbm9zdGljQ2FjaGUsXG4gICAgKTtcblxuICAgIGNvbnN0IHJlZmVyZW5jZWRGaWxlcyA9IHR5cGVTY3JpcHRQcm9ncmFtXG4gICAgICAuZ2V0U291cmNlRmlsZXMoKVxuICAgICAgLmZpbHRlcigoc291cmNlRmlsZSkgPT4gIWFuZ3VsYXJDb21waWxlci5pZ25vcmVGb3JFbWl0Lmhhcyhzb3VyY2VGaWxlKSlcbiAgICAgIC5mbGF0TWFwKChzb3VyY2VGaWxlKSA9PiBbXG4gICAgICAgIHNvdXJjZUZpbGUuZmlsZU5hbWUsXG4gICAgICAgIC4uLmFuZ3VsYXJDb21waWxlci5nZXRSZXNvdXJjZURlcGVuZGVuY2llcyhzb3VyY2VGaWxlKSxcbiAgICAgIF0pO1xuXG4gICAgcmV0dXJuIHsgYWZmZWN0ZWRGaWxlcywgY29tcGlsZXJPcHRpb25zLCByZWZlcmVuY2VkRmlsZXMgfTtcbiAgfVxuXG4gICpjb2xsZWN0RGlhZ25vc3RpY3MoKTogSXRlcmFibGU8dHMuRGlhZ25vc3RpYz4ge1xuICAgIGFzc2VydCh0aGlzLiNzdGF0ZSwgJ0FuZ3VsYXIgY29tcGlsYXRpb24gbXVzdCBiZSBpbml0aWFsaXplZCBwcmlvciB0byBjb2xsZWN0aW5nIGRpYWdub3N0aWNzLicpO1xuICAgIGNvbnN0IHtcbiAgICAgIGFmZmVjdGVkRmlsZXMsXG4gICAgICBhbmd1bGFyQ29tcGlsZXIsXG4gICAgICBkaWFnbm9zdGljQ2FjaGUsXG4gICAgICB0ZW1wbGF0ZURpYWdub3N0aWNzT3B0aW1pemF0aW9uLFxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0sXG4gICAgfSA9IHRoaXMuI3N0YXRlO1xuXG4gICAgLy8gQ29sbGVjdCBwcm9ncmFtIGxldmVsIGRpYWdub3N0aWNzXG4gICAgeWllbGQqIHR5cGVTY3JpcHRQcm9ncmFtLmdldENvbmZpZ0ZpbGVQYXJzaW5nRGlhZ25vc3RpY3MoKTtcbiAgICB5aWVsZCogYW5ndWxhckNvbXBpbGVyLmdldE9wdGlvbkRpYWdub3N0aWNzKCk7XG4gICAgeWllbGQqIHR5cGVTY3JpcHRQcm9ncmFtLmdldE9wdGlvbnNEaWFnbm9zdGljcygpO1xuICAgIHlpZWxkKiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRHbG9iYWxEaWFnbm9zdGljcygpO1xuXG4gICAgLy8gQ29sbGVjdCBzb3VyY2UgZmlsZSBzcGVjaWZpYyBkaWFnbm9zdGljc1xuICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICBpZiAoYW5ndWxhckNvbXBpbGVyLmlnbm9yZUZvckRpYWdub3N0aWNzLmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gVHlwZVNjcmlwdCB3aWxsIHVzZSBjYWNoZWQgZGlhZ25vc3RpY3MgZm9yIGZpbGVzIHRoYXQgaGF2ZSBub3QgYmVlblxuICAgICAgLy8gY2hhbmdlZCBvciBhZmZlY3RlZCBmb3IgdGhpcyBidWlsZCB3aGVuIHVzaW5nIGluY3JlbWVudGFsIGJ1aWxkaW5nLlxuICAgICAgeWllbGQqIHByb2ZpbGVTeW5jKFxuICAgICAgICAnTkdfRElBR05PU1RJQ1NfU1lOVEFDVElDJyxcbiAgICAgICAgKCkgPT4gdHlwZVNjcmlwdFByb2dyYW0uZ2V0U3ludGFjdGljRGlhZ25vc3RpY3Moc291cmNlRmlsZSksXG4gICAgICAgIHRydWUsXG4gICAgICApO1xuICAgICAgeWllbGQqIHByb2ZpbGVTeW5jKFxuICAgICAgICAnTkdfRElBR05PU1RJQ1NfU0VNQU5USUMnLFxuICAgICAgICAoKSA9PiB0eXBlU2NyaXB0UHJvZ3JhbS5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKHNvdXJjZUZpbGUpLFxuICAgICAgICB0cnVlLFxuICAgICAgKTtcblxuICAgICAgLy8gRGVjbGFyYXRpb24gZmlsZXMgY2Fubm90IGhhdmUgdGVtcGxhdGUgZGlhZ25vc3RpY3NcbiAgICAgIGlmIChzb3VyY2VGaWxlLmlzRGVjbGFyYXRpb25GaWxlKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBPbmx5IHJlcXVlc3QgQW5ndWxhciB0ZW1wbGF0ZSBkaWFnbm9zdGljcyBmb3IgYWZmZWN0ZWQgZmlsZXMgdG8gYXZvaWRcbiAgICAgIC8vIG92ZXJoZWFkIG9mIHRlbXBsYXRlIGRpYWdub3N0aWNzIGZvciB1bmNoYW5nZWQgZmlsZXMuXG4gICAgICBpZiAoYWZmZWN0ZWRGaWxlcy5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gcHJvZmlsZVN5bmMoXG4gICAgICAgICAgJ05HX0RJQUdOT1NUSUNTX1RFTVBMQVRFJyxcbiAgICAgICAgICAoKSA9PiBhbmd1bGFyQ29tcGlsZXIuZ2V0RGlhZ25vc3RpY3NGb3JGaWxlKHNvdXJjZUZpbGUsIHRlbXBsYXRlRGlhZ25vc3RpY3NPcHRpbWl6YXRpb24pLFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICk7XG4gICAgICAgIGRpYWdub3N0aWNDYWNoZS5zZXQoc291cmNlRmlsZSwgYW5ndWxhckRpYWdub3N0aWNzKTtcbiAgICAgICAgeWllbGQqIGFuZ3VsYXJEaWFnbm9zdGljcztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGFuZ3VsYXJEaWFnbm9zdGljcyA9IGRpYWdub3N0aWNDYWNoZS5nZXQoc291cmNlRmlsZSk7XG4gICAgICAgIGlmIChhbmd1bGFyRGlhZ25vc3RpY3MpIHtcbiAgICAgICAgICB5aWVsZCogYW5ndWxhckRpYWdub3N0aWNzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZW1pdEFmZmVjdGVkRmlsZXMoKTogSXRlcmFibGU8RW1pdEZpbGVSZXN1bHQ+IHtcbiAgICBhc3NlcnQodGhpcy4jc3RhdGUsICdBbmd1bGFyIGNvbXBpbGF0aW9uIG11c3QgYmUgaW5pdGlhbGl6ZWQgcHJpb3IgdG8gZW1pdHRpbmcgZmlsZXMuJyk7XG4gICAgY29uc3QgeyBhbmd1bGFyQ29tcGlsZXIsIGNvbXBpbGVySG9zdCwgdHlwZVNjcmlwdFByb2dyYW0gfSA9IHRoaXMuI3N0YXRlO1xuICAgIGNvbnN0IGJ1aWxkSW5mb0ZpbGVuYW1lID1cbiAgICAgIHR5cGVTY3JpcHRQcm9ncmFtLmdldENvbXBpbGVyT3B0aW9ucygpLnRzQnVpbGRJbmZvRmlsZSA/PyAnLnRzYnVpbGRpbmZvJztcblxuICAgIGNvbnN0IGVtaXR0ZWRGaWxlcyA9IG5ldyBNYXA8dHMuU291cmNlRmlsZSwgRW1pdEZpbGVSZXN1bHQ+KCk7XG4gICAgY29uc3Qgd3JpdGVGaWxlQ2FsbGJhY2s6IHRzLldyaXRlRmlsZUNhbGxiYWNrID0gKGZpbGVuYW1lLCBjb250ZW50cywgX2EsIF9iLCBzb3VyY2VGaWxlcykgPT4ge1xuICAgICAgaWYgKCFzb3VyY2VGaWxlcz8ubGVuZ3RoICYmIGZpbGVuYW1lLmVuZHNXaXRoKGJ1aWxkSW5mb0ZpbGVuYW1lKSkge1xuICAgICAgICAvLyBTYXZlIGJ1aWxkZXIgaW5mbyBjb250ZW50cyB0byBzcGVjaWZpZWQgbG9jYXRpb25cbiAgICAgICAgY29tcGlsZXJIb3N0LndyaXRlRmlsZShmaWxlbmFtZSwgY29udGVudHMsIGZhbHNlKTtcblxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGFzc2VydChzb3VyY2VGaWxlcz8ubGVuZ3RoID09PSAxLCAnSW52YWxpZCBUeXBlU2NyaXB0IHByb2dyYW0gZW1pdCBmb3IgJyArIGZpbGVuYW1lKTtcbiAgICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBzb3VyY2VGaWxlc1swXTtcbiAgICAgIGlmIChhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRW1pdC5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBhbmd1bGFyQ29tcGlsZXIuaW5jcmVtZW50YWxDb21waWxhdGlvbi5yZWNvcmRTdWNjZXNzZnVsRW1pdChzb3VyY2VGaWxlKTtcbiAgICAgIGVtaXR0ZWRGaWxlcy5zZXQoc291cmNlRmlsZSwgeyBmaWxlbmFtZTogc291cmNlRmlsZS5maWxlTmFtZSwgY29udGVudHMgfSk7XG4gICAgfTtcbiAgICBjb25zdCB0cmFuc2Zvcm1lcnMgPSBtZXJnZVRyYW5zZm9ybWVycyhhbmd1bGFyQ29tcGlsZXIucHJlcGFyZUVtaXQoKS50cmFuc2Zvcm1lcnMsIHtcbiAgICAgIGJlZm9yZTogW3JlcGxhY2VCb290c3RyYXAoKCkgPT4gdHlwZVNjcmlwdFByb2dyYW0uZ2V0UHJvZ3JhbSgpLmdldFR5cGVDaGVja2VyKCkpXSxcbiAgICB9KTtcblxuICAgIC8vIFR5cGVTY3JpcHQgd2lsbCBsb29wIHVudGlsIHRoZXJlIGFyZSBubyBtb3JlIGFmZmVjdGVkIGZpbGVzIGluIHRoZSBwcm9ncmFtXG4gICAgd2hpbGUgKFxuICAgICAgdHlwZVNjcmlwdFByb2dyYW0uZW1pdE5leHRBZmZlY3RlZEZpbGUod3JpdGVGaWxlQ2FsbGJhY2ssIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cmFuc2Zvcm1lcnMpXG4gICAgKSB7XG4gICAgICAvKiBlbXB0eSAqL1xuICAgIH1cblxuICAgIC8vIEFuZ3VsYXIgbWF5IGhhdmUgZmlsZXMgdGhhdCBtdXN0IGJlIGVtaXR0ZWQgYnV0IFR5cGVTY3JpcHQgZG9lcyBub3QgY29uc2lkZXIgYWZmZWN0ZWRcbiAgICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgdHlwZVNjcmlwdFByb2dyYW0uZ2V0U291cmNlRmlsZXMoKSkge1xuICAgICAgaWYgKGVtaXR0ZWRGaWxlcy5oYXMoc291cmNlRmlsZSkgfHwgYW5ndWxhckNvbXBpbGVyLmlnbm9yZUZvckVtaXQuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoc291cmNlRmlsZS5pc0RlY2xhcmF0aW9uRmlsZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGFuZ3VsYXJDb21waWxlci5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLnNhZmVUb1NraXBFbWl0KHNvdXJjZUZpbGUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB0eXBlU2NyaXB0UHJvZ3JhbS5lbWl0KHNvdXJjZUZpbGUsIHdyaXRlRmlsZUNhbGxiYWNrLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJhbnNmb3JtZXJzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZW1pdHRlZEZpbGVzLnZhbHVlcygpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmRBZmZlY3RlZEZpbGVzKFxuICBidWlsZGVyOiB0cy5FbWl0QW5kU2VtYW50aWNEaWFnbm9zdGljc0J1aWxkZXJQcm9ncmFtLFxuICB7IGlnbm9yZUZvckRpYWdub3N0aWNzIH06IG5nLk5ndHNjUHJvZ3JhbVsnY29tcGlsZXInXSxcbiAgaW5jbHVkZVRUQzogYm9vbGVhbixcbik6IFNldDx0cy5Tb3VyY2VGaWxlPiB7XG4gIGNvbnN0IGFmZmVjdGVkRmlsZXMgPSBuZXcgU2V0PHRzLlNvdXJjZUZpbGU+KCk7XG5cbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnN0YW50LWNvbmRpdGlvblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGJ1aWxkZXIuZ2V0U2VtYW50aWNEaWFnbm9zdGljc09mTmV4dEFmZmVjdGVkRmlsZSh1bmRlZmluZWQsIChzb3VyY2VGaWxlKSA9PiB7XG4gICAgICAvLyBJZiB0aGUgYWZmZWN0ZWQgZmlsZSBpcyBhIFRUQyBzaGltLCBhZGQgdGhlIHNoaW0ncyBvcmlnaW5hbCBzb3VyY2UgZmlsZS5cbiAgICAgIC8vIFRoaXMgZW5zdXJlcyB0aGF0IGNoYW5nZXMgdGhhdCBhZmZlY3QgVFRDIGFyZSB0eXBlY2hlY2tlZCBldmVuIHdoZW4gdGhlIGNoYW5nZXNcbiAgICAgIC8vIGFyZSBvdGhlcndpc2UgdW5yZWxhdGVkIGZyb20gYSBUUyBwZXJzcGVjdGl2ZSBhbmQgZG8gbm90IHJlc3VsdCBpbiBJdnkgY29kZWdlbiBjaGFuZ2VzLlxuICAgICAgLy8gRm9yIGV4YW1wbGUsIGNoYW5naW5nIEBJbnB1dCBwcm9wZXJ0eSB0eXBlcyBvZiBhIGRpcmVjdGl2ZSB1c2VkIGluIGFub3RoZXIgY29tcG9uZW50J3NcbiAgICAgIC8vIHRlbXBsYXRlLlxuICAgICAgLy8gQSBUVEMgc2hpbSBpcyBhIGZpbGUgdGhhdCBoYXMgYmVlbiBpZ25vcmVkIGZvciBkaWFnbm9zdGljcyBhbmQgaGFzIGEgZmlsZW5hbWUgZW5kaW5nIGluIGAubmd0eXBlY2hlY2sudHNgLlxuICAgICAgaWYgKGlnbm9yZUZvckRpYWdub3N0aWNzLmhhcyhzb3VyY2VGaWxlKSAmJiBzb3VyY2VGaWxlLmZpbGVOYW1lLmVuZHNXaXRoKCcubmd0eXBlY2hlY2sudHMnKSkge1xuICAgICAgICAvLyBUaGlzIGZpbGUgbmFtZSBjb252ZXJzaW9uIHJlbGllcyBvbiBpbnRlcm5hbCBjb21waWxlciBsb2dpYyBhbmQgc2hvdWxkIGJlIGNvbnZlcnRlZFxuICAgICAgICAvLyB0byBhbiBvZmZpY2lhbCBtZXRob2Qgd2hlbiBhdmFpbGFibGUuIDE1IGlzIGxlbmd0aCBvZiBgLm5ndHlwZWNoZWNrLnRzYFxuICAgICAgICBjb25zdCBvcmlnaW5hbEZpbGVuYW1lID0gc291cmNlRmlsZS5maWxlTmFtZS5zbGljZSgwLCAtMTUpICsgJy50cyc7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsU291cmNlRmlsZSA9IGJ1aWxkZXIuZ2V0U291cmNlRmlsZShvcmlnaW5hbEZpbGVuYW1lKTtcbiAgICAgICAgaWYgKG9yaWdpbmFsU291cmNlRmlsZSkge1xuICAgICAgICAgIGFmZmVjdGVkRmlsZXMuYWRkKG9yaWdpbmFsU291cmNlRmlsZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuXG4gICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGFmZmVjdGVkRmlsZXMuYWRkKHJlc3VsdC5hZmZlY3RlZCBhcyB0cy5Tb3VyY2VGaWxlKTtcbiAgfVxuXG4gIC8vIEFkZCBhbGwgZmlsZXMgd2l0aCBhc3NvY2lhdGVkIHRlbXBsYXRlIHR5cGUgY2hlY2tpbmcgZmlsZXMuXG4gIC8vIFN0b3JlZCBUUyBidWlsZCBpbmZvIGRvZXMgbm90IGhhdmUga25vd2xlZGdlIG9mIHRoZSBBT1QgY29tcGlsZXIgb3IgdGhlIHR5cGVjaGVja2luZyBzdGF0ZSBvZiB0aGUgdGVtcGxhdGVzLlxuICAvLyBUbyBlbnN1cmUgdGhhdCBlcnJvcnMgYXJlIHJlcG9ydGVkIGNvcnJlY3RseSwgYWxsIEFPVCBjb21wb25lbnQgZGlhZ25vc3RpY3MgbmVlZCB0byBiZSBhbmFseXplZCBldmVuIGlmIGJ1aWxkXG4gIC8vIGluZm8gaXMgcHJlc2VudC5cbiAgaWYgKGluY2x1ZGVUVEMpIHtcbiAgICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgYnVpbGRlci5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICBpZiAoaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpICYmIHNvdXJjZUZpbGUuZmlsZU5hbWUuZW5kc1dpdGgoJy5uZ3R5cGVjaGVjay50cycpKSB7XG4gICAgICAgIC8vIFRoaXMgZmlsZSBuYW1lIGNvbnZlcnNpb24gcmVsaWVzIG9uIGludGVybmFsIGNvbXBpbGVyIGxvZ2ljIGFuZCBzaG91bGQgYmUgY29udmVydGVkXG4gICAgICAgIC8vIHRvIGFuIG9mZmljaWFsIG1ldGhvZCB3aGVuIGF2YWlsYWJsZS4gMTUgaXMgbGVuZ3RoIG9mIGAubmd0eXBlY2hlY2sudHNgXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsRmlsZW5hbWUgPSBzb3VyY2VGaWxlLmZpbGVOYW1lLnNsaWNlKDAsIC0xNSkgKyAnLnRzJztcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxTb3VyY2VGaWxlID0gYnVpbGRlci5nZXRTb3VyY2VGaWxlKG9yaWdpbmFsRmlsZW5hbWUpO1xuICAgICAgICBpZiAob3JpZ2luYWxTb3VyY2VGaWxlKSB7XG4gICAgICAgICAgYWZmZWN0ZWRGaWxlcy5hZGQob3JpZ2luYWxTb3VyY2VGaWxlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBhZmZlY3RlZEZpbGVzO1xufVxuIl19