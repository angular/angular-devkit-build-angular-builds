"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCompilerPlugin = exports.SourceFileCache = void 0;
const assert = __importStar(require("node:assert"));
const node_os_1 = require("node:os");
const path = __importStar(require("node:path"));
const node_url_1 = require("node:url");
const typescript_1 = __importDefault(require("typescript"));
const environment_options_1 = require("../../utils/environment-options");
const load_esm_1 = require("../../utils/load-esm");
const angular_host_1 = require("./angular-host");
const javascript_transformer_1 = require("./javascript-transformer");
const profiling_1 = require("./profiling");
const stylesheets_1 = require("./stylesheets");
/**
 * Converts TypeScript Diagnostic related information into an esbuild compatible note object.
 * Related information is a subset of a full TypeScript Diagnostic and also used for diagnostic
 * notes associated with the main Diagnostic.
 * @param info The TypeScript diagnostic relative information to convert.
 * @param host A TypeScript FormatDiagnosticsHost instance to use during conversion.
 * @returns An esbuild diagnostic message as a PartialMessage object
 */
function convertTypeScriptDiagnosticInfo(info, host, textPrefix) {
    let text = typescript_1.default.flattenDiagnosticMessageText(info.messageText, host.getNewLine());
    if (textPrefix) {
        text = textPrefix + text;
    }
    const note = { text };
    if (info.file) {
        note.location = {
            file: info.file.fileName,
            length: info.length,
        };
        // Calculate the line/column location and extract the full line text that has the diagnostic
        if (info.start) {
            const { line, character } = typescript_1.default.getLineAndCharacterOfPosition(info.file, info.start);
            note.location.line = line + 1;
            note.location.column = character;
            // The start position for the slice is the first character of the error line
            const lineStartPosition = typescript_1.default.getPositionOfLineAndCharacter(info.file, line, 0);
            // The end position for the slice is the first character of the next line or the length of
            // the entire file if the line is the last line of the file (getPositionOfLineAndCharacter
            // will error if a nonexistent line is passed).
            const { line: lastLineOfFile } = typescript_1.default.getLineAndCharacterOfPosition(info.file, info.file.text.length - 1);
            const lineEndPosition = line < lastLineOfFile
                ? typescript_1.default.getPositionOfLineAndCharacter(info.file, line + 1, 0)
                : info.file.text.length;
            note.location.lineText = info.file.text.slice(lineStartPosition, lineEndPosition).trimEnd();
        }
    }
    return note;
}
/**
 * Converts a TypeScript Diagnostic message into an esbuild compatible message object.
 * @param diagnostic The TypeScript diagnostic to convert.
 * @param host A TypeScript FormatDiagnosticsHost instance to use during conversion.
 * @returns An esbuild diagnostic message as a PartialMessage object
 */
function convertTypeScriptDiagnostic(diagnostic, host) {
    var _a;
    let codePrefix = 'TS';
    let code = `${diagnostic.code}`;
    if (diagnostic.source === 'ngtsc') {
        codePrefix = 'NG';
        // Remove `-99` Angular prefix from diagnostic code
        code = code.slice(3);
    }
    const message = {
        ...convertTypeScriptDiagnosticInfo(diagnostic, host, `${codePrefix}${code}: `),
        // Store original diagnostic for reference if needed downstream
        detail: diagnostic,
    };
    if ((_a = diagnostic.relatedInformation) === null || _a === void 0 ? void 0 : _a.length) {
        message.notes = diagnostic.relatedInformation.map((info) => convertTypeScriptDiagnosticInfo(info, host));
    }
    return message;
}
const USING_WINDOWS = (0, node_os_1.platform)() === 'win32';
const WINDOWS_SEP_REGEXP = new RegExp(`\\${path.win32.sep}`, 'g');
class SourceFileCache extends Map {
    constructor() {
        super(...arguments);
        this.modifiedFiles = new Set();
        this.babelFileCache = new Map();
        this.typeScriptFileCache = new Map();
    }
    invalidate(files) {
        this.modifiedFiles.clear();
        for (let file of files) {
            this.babelFileCache.delete(file);
            this.typeScriptFileCache.delete((0, node_url_1.pathToFileURL)(file).href);
            // Normalize separators to allow matching TypeScript Host paths
            if (USING_WINDOWS) {
                file = file.replace(WINDOWS_SEP_REGEXP, path.posix.sep);
            }
            this.delete(file);
            this.modifiedFiles.add(file);
        }
    }
}
exports.SourceFileCache = SourceFileCache;
// This is a non-watch version of the compiler code from `@ngtools/webpack` augmented for esbuild
// eslint-disable-next-line max-lines-per-function
function createCompilerPlugin(pluginOptions, styleOptions) {
    return {
        name: 'angular-compiler',
        // eslint-disable-next-line max-lines-per-function
        async setup(build) {
            var _a, _b;
            var _c;
            let setupWarnings;
            // Initialize a worker pool for JavaScript transformations
            const javascriptTransformer = new javascript_transformer_1.JavaScriptTransformer(pluginOptions, environment_options_1.maxWorkers);
            // This uses a wrapped dynamic import to load `@angular/compiler-cli` which is ESM.
            // Once TypeScript provides support for retaining dynamic imports this workaround can be dropped.
            const { GLOBAL_DEFS_FOR_TERSER_WITH_AOT, NgtscProgram, OptimizeFor, readConfiguration } = await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli');
            // Temporary deep import for transformer support
            const { mergeTransformers, replaceBootstrap, } = require('@ngtools/webpack/src/ivy/transformation');
            // Setup defines based on the values provided by the Angular compiler-cli
            (_a = (_c = build.initialOptions).define) !== null && _a !== void 0 ? _a : (_c.define = {});
            for (const [key, value] of Object.entries(GLOBAL_DEFS_FOR_TERSER_WITH_AOT)) {
                if (key in build.initialOptions.define) {
                    // Skip keys that have been manually provided
                    continue;
                }
                // esbuild requires values to be a string (actual strings need to be quoted).
                // In this case, all provided values are booleans.
                build.initialOptions.define[key] = value.toString();
            }
            // The tsconfig is loaded in setup instead of in start to allow the esbuild target build option to be modified.
            // esbuild build options can only be modified in setup prior to starting the build.
            const { options: compilerOptions, rootNames, errors: configurationDiagnostics, } = (0, profiling_1.profileSync)('NG_READ_CONFIG', () => readConfiguration(pluginOptions.tsconfig, {
                noEmitOnError: false,
                suppressOutputPathCheck: true,
                outDir: undefined,
                inlineSources: pluginOptions.sourcemap,
                inlineSourceMap: pluginOptions.sourcemap,
                sourceMap: false,
                mapRoot: undefined,
                sourceRoot: undefined,
                declaration: false,
                declarationMap: false,
                allowEmptyCodegenFiles: false,
                annotationsAs: 'decorators',
                enableResourceInlining: false,
            }));
            if (compilerOptions.target === undefined || compilerOptions.target < typescript_1.default.ScriptTarget.ES2022) {
                // If 'useDefineForClassFields' is already defined in the users project leave the value as is.
                // Otherwise fallback to false due to https://github.com/microsoft/TypeScript/issues/45995
                // which breaks the deprecated `@Effects` NGRX decorator and potentially other existing code as well.
                compilerOptions.target = typescript_1.default.ScriptTarget.ES2022;
                (_b = compilerOptions.useDefineForClassFields) !== null && _b !== void 0 ? _b : (compilerOptions.useDefineForClassFields = false);
                (setupWarnings !== null && setupWarnings !== void 0 ? setupWarnings : (setupWarnings = [])).push({
                    text: 'TypeScript compiler options "target" and "useDefineForClassFields" are set to "ES2022" and ' +
                        '"false" respectively by the Angular CLI.',
                    location: { file: pluginOptions.tsconfig },
                    notes: [
                        {
                            text: 'To control ECMA version and features use the Browerslist configuration. ' +
                                'For more information, see https://angular.io/guide/build#configuring-browser-compatibility',
                        },
                    ],
                });
            }
            // The file emitter created during `onStart` that will be used during the build in `onLoad` callbacks for TS files
            let fileEmitter;
            // The stylesheet resources from component stylesheets that will be added to the build results output files
            let stylesheetResourceFiles;
            let previousBuilder;
            let previousAngularProgram;
            const diagnosticCache = new WeakMap();
            build.onStart(async () => {
                var _a;
                const result = {
                    warnings: setupWarnings,
                };
                // Reset the setup warnings so that they are only shown during the first build.
                setupWarnings = undefined;
                // Reset debug performance tracking
                (0, profiling_1.resetCumulativeDurations)();
                // Reset stylesheet resource output files
                stylesheetResourceFiles = [];
                // Create Angular compiler host
                const host = (0, angular_host_1.createAngularCompilerHost)(compilerOptions, {
                    fileReplacements: pluginOptions.fileReplacements,
                    modifiedFiles: (_a = pluginOptions.sourceFileCache) === null || _a === void 0 ? void 0 : _a.modifiedFiles,
                    sourceFileCache: pluginOptions.sourceFileCache,
                    async transformStylesheet(data, containingFile, stylesheetFile) {
                        var _a, _b;
                        // Stylesheet file only exists for external stylesheets
                        const filename = stylesheetFile !== null && stylesheetFile !== void 0 ? stylesheetFile : containingFile;
                        // Temporary workaround for lack of virtual file support in the Sass plugin.
                        // External Sass stylesheets are transformed using the file instead of the already read content.
                        let stylesheetResult;
                        if (filename.endsWith('.scss') || filename.endsWith('.sass')) {
                            stylesheetResult = await (0, stylesheets_1.bundleStylesheetFile)(filename, styleOptions);
                        }
                        else {
                            stylesheetResult = await (0, stylesheets_1.bundleStylesheetText)(data, {
                                resolvePath: path.dirname(filename),
                                virtualName: filename,
                            }, styleOptions);
                        }
                        const { contents, resourceFiles, errors, warnings } = stylesheetResult;
                        ((_a = result.errors) !== null && _a !== void 0 ? _a : (result.errors = [])).push(...errors);
                        ((_b = result.warnings) !== null && _b !== void 0 ? _b : (result.warnings = [])).push(...warnings);
                        stylesheetResourceFiles.push(...resourceFiles);
                        return contents;
                    },
                });
                // Create the Angular specific program that contains the Angular compiler
                const angularProgram = (0, profiling_1.profileSync)('NG_CREATE_PROGRAM', () => new NgtscProgram(rootNames, compilerOptions, host, previousAngularProgram));
                previousAngularProgram = angularProgram;
                const angularCompiler = angularProgram.compiler;
                const typeScriptProgram = angularProgram.getTsProgram();
                (0, angular_host_1.ensureSourceFileVersions)(typeScriptProgram);
                const builder = typescript_1.default.createEmitAndSemanticDiagnosticsBuilderProgram(typeScriptProgram, host, previousBuilder, configurationDiagnostics);
                previousBuilder = builder;
                await (0, profiling_1.profileAsync)('NG_ANALYZE_PROGRAM', () => angularCompiler.analyzeAsync());
                const affectedFiles = (0, profiling_1.profileSync)('NG_FIND_AFFECTED', () => findAffectedFiles(builder, angularCompiler));
                if (pluginOptions.sourceFileCache) {
                    for (const affected of affectedFiles) {
                        pluginOptions.sourceFileCache.typeScriptFileCache.delete((0, node_url_1.pathToFileURL)(affected.fileName).href);
                    }
                }
                function* collectDiagnostics() {
                    // Collect program level diagnostics
                    yield* builder.getConfigFileParsingDiagnostics();
                    yield* angularCompiler.getOptionDiagnostics();
                    yield* builder.getOptionsDiagnostics();
                    yield* builder.getGlobalDiagnostics();
                    // Collect source file specific diagnostics
                    const optimizeFor = affectedFiles.size > 1 ? OptimizeFor.WholeProgram : OptimizeFor.SingleFile;
                    for (const sourceFile of builder.getSourceFiles()) {
                        if (angularCompiler.ignoreForDiagnostics.has(sourceFile)) {
                            continue;
                        }
                        // TypeScript will use cached diagnostics for files that have not been
                        // changed or affected for this build when using incremental building.
                        yield* (0, profiling_1.profileSync)('NG_DIAGNOSTICS_SYNTACTIC', () => builder.getSyntacticDiagnostics(sourceFile), true);
                        yield* (0, profiling_1.profileSync)('NG_DIAGNOSTICS_SEMANTIC', () => builder.getSemanticDiagnostics(sourceFile), true);
                        // Declaration files cannot have template diagnostics
                        if (sourceFile.isDeclarationFile) {
                            continue;
                        }
                        // Only request Angular template diagnostics for affected files to avoid
                        // overhead of template diagnostics for unchanged files.
                        if (affectedFiles.has(sourceFile)) {
                            const angularDiagnostics = (0, profiling_1.profileSync)('NG_DIAGNOSTICS_TEMPLATE', () => angularCompiler.getDiagnosticsForFile(sourceFile, optimizeFor), true);
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
                (0, profiling_1.profileSync)('NG_DIAGNOSTICS_TOTAL', () => {
                    var _a, _b;
                    for (const diagnostic of collectDiagnostics()) {
                        const message = convertTypeScriptDiagnostic(diagnostic, host);
                        if (diagnostic.category === typescript_1.default.DiagnosticCategory.Error) {
                            ((_a = result.errors) !== null && _a !== void 0 ? _a : (result.errors = [])).push(message);
                        }
                        else {
                            ((_b = result.warnings) !== null && _b !== void 0 ? _b : (result.warnings = [])).push(message);
                        }
                    }
                });
                fileEmitter = createFileEmitter(builder, mergeTransformers(angularCompiler.prepareEmit().transformers, {
                    before: [replaceBootstrap(() => builder.getProgram().getTypeChecker())],
                }), (sourceFile) => angularCompiler.incrementalCompilation.recordSuccessfulEmit(sourceFile));
                return result;
            });
            build.onLoad({ filter: compilerOptions.allowJs ? /\.[cm]?[jt]sx?$/ : /\.[cm]?tsx?$/ }, (args) => (0, profiling_1.profileAsync)('NG_EMIT_TS*', async () => {
                var _a, _b, _c, _d, _e;
                assert.ok(fileEmitter, 'Invalid plugin execution order');
                const request = (_b = (_a = pluginOptions.fileReplacements) === null || _a === void 0 ? void 0 : _a[args.path]) !== null && _b !== void 0 ? _b : args.path;
                // The filename is currently used as a cache key. Since the cache is memory only,
                // the options cannot change and do not need to be represented in the key. If the
                // cache is later stored to disk, then the options that affect transform output
                // would need to be added to the key as well as a check for any change of content.
                let contents = (_c = pluginOptions.sourceFileCache) === null || _c === void 0 ? void 0 : _c.typeScriptFileCache.get((0, node_url_1.pathToFileURL)(request).href);
                if (contents === undefined) {
                    const typescriptResult = await fileEmitter(request);
                    if (!(typescriptResult === null || typescriptResult === void 0 ? void 0 : typescriptResult.content)) {
                        // No TS result indicates the file is not part of the TypeScript program.
                        // If allowJs is enabled and the file is JS then defer to the next load hook.
                        if (compilerOptions.allowJs && /\.[cm]?js$/.test(request)) {
                            return undefined;
                        }
                        // Otherwise return an error
                        return {
                            errors: [
                                createMissingFileError(request, args.path, (_d = build.initialOptions.absWorkingDir) !== null && _d !== void 0 ? _d : ''),
                            ],
                        };
                    }
                    contents = await javascriptTransformer.transformData(request, typescriptResult.content, true /* skipLinker */);
                    (_e = pluginOptions.sourceFileCache) === null || _e === void 0 ? void 0 : _e.typeScriptFileCache.set((0, node_url_1.pathToFileURL)(request).href, contents);
                }
                return {
                    contents,
                    loader: 'js',
                };
            }, true));
            build.onLoad({ filter: /\.[cm]?js$/ }, (args) => (0, profiling_1.profileAsync)('NG_EMIT_JS*', async () => {
                var _a, _b;
                // The filename is currently used as a cache key. Since the cache is memory only,
                // the options cannot change and do not need to be represented in the key. If the
                // cache is later stored to disk, then the options that affect transform output
                // would need to be added to the key as well as a check for any change of content.
                let contents = (_a = pluginOptions.sourceFileCache) === null || _a === void 0 ? void 0 : _a.babelFileCache.get(args.path);
                if (contents === undefined) {
                    contents = await javascriptTransformer.transformFile(args.path);
                    (_b = pluginOptions.sourceFileCache) === null || _b === void 0 ? void 0 : _b.babelFileCache.set(args.path, contents);
                }
                return {
                    contents,
                    loader: 'js',
                };
            }, true));
            build.onEnd((result) => {
                var _a;
                if (stylesheetResourceFiles.length) {
                    (_a = result.outputFiles) === null || _a === void 0 ? void 0 : _a.push(...stylesheetResourceFiles);
                }
                (0, profiling_1.logCumulativeDurations)();
            });
        },
    };
}
exports.createCompilerPlugin = createCompilerPlugin;
function createFileEmitter(program, transformers = {}, onAfterEmit) {
    return async (file) => {
        const sourceFile = program.getSourceFile(file);
        if (!sourceFile) {
            return undefined;
        }
        let content;
        program.emit(sourceFile, (filename, data) => {
            if (/\.[cm]?js$/.test(filename)) {
                content = data;
            }
        }, undefined /* cancellationToken */, undefined /* emitOnlyDtsFiles */, transformers);
        onAfterEmit === null || onAfterEmit === void 0 ? void 0 : onAfterEmit(sourceFile);
        return { content, dependencies: [] };
    };
}
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
function createMissingFileError(request, original, root) {
    const error = {
        text: `File '${path.relative(root, request)}' is missing from the TypeScript compilation.`,
        notes: [
            {
                text: `Ensure the file is part of the TypeScript program via the 'files' or 'include' property.`,
            },
        ],
    };
    if (request !== original) {
        error.notes.push({
            text: `File is requested from a file replacement of '${path.relative(root, original)}'.`,
        });
    }
    return error;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVdILG9EQUFzQztBQUN0QyxxQ0FBbUM7QUFDbkMsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUN6Qyw0REFBNEI7QUFDNUIseUVBQTZEO0FBQzdELG1EQUFxRDtBQUNyRCxpREFBcUY7QUFDckYscUVBQWlFO0FBQ2pFLDJDQUtxQjtBQUNyQiwrQ0FBb0c7QUFVcEc7Ozs7Ozs7R0FPRztBQUNILFNBQVMsK0JBQStCLENBQ3RDLElBQXFDLEVBQ3JDLElBQThCLEVBQzlCLFVBQW1CO0lBRW5CLElBQUksSUFBSSxHQUFHLG9CQUFFLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztJQUNoRixJQUFJLFVBQVUsRUFBRTtRQUNkLElBQUksR0FBRyxVQUFVLEdBQUcsSUFBSSxDQUFDO0tBQzFCO0lBRUQsTUFBTSxJQUFJLEdBQWdCLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFFbkMsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO1FBQ2IsSUFBSSxDQUFDLFFBQVEsR0FBRztZQUNkLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVE7WUFDeEIsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO1NBQ3BCLENBQUM7UUFFRiw0RkFBNEY7UUFDNUYsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ2QsTUFBTSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsR0FBRyxvQkFBRSxDQUFDLDZCQUE2QixD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UDtRQUVELGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQXlCLENBQUMsQ0FBQztLQUNyRDtJQUVELDRFQUE0RTtJQUM1RSxLQUFLLE1BQU0sVUFBVSxJQUFJLE9BQU8sQ0FBQyxjQUFjLEVBQUUsRUFBRTtRQUNqRCxJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksc0JBQXNCLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ3RGLFNBQVM7U0FDVjtRQUVELGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDL0I7SUFFRCxPQUFPLGFBQWEsQ0FBQztBQUN2QixDQUFDO0FBRUQsU0FBUyxzQkFBc0IsQ0FBQyxPQUFlLEVBQUUsUUFBZ0IsRUFBRSxJQUFZO0lBQzdFLE1BQU0sS0FBSyxHQUFHO1FBQ1osSUFBSSxFQUFFLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLCtDQUErQztRQUMxRixLQUFLLEVBQUU7WUFDTDtnQkFDRSxJQUFJLEVBQUUsMEZBQTBGO2FBQ2pHO1NBQ0Y7S0FDRixDQUFDO0lBRUYsSUFBSSxPQUFPLEtBQUssUUFBUSxFQUFFO1FBQ3hCLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ2YsSUFBSSxFQUFFLGlEQUFpRCxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsSUFBSTtTQUN6RixDQUFDLENBQUM7S0FDSjtJQUVELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE5ndHNjUHJvZ3JhbSB9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQgdHlwZSB7XG4gIE9uU3RhcnRSZXN1bHQsXG4gIE91dHB1dEZpbGUsXG4gIFBhcnRpYWxNZXNzYWdlLFxuICBQYXJ0aWFsTm90ZSxcbiAgUGx1Z2luLFxuICBQbHVnaW5CdWlsZCxcbn0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICdub2RlOm9zJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBtYXhXb3JrZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHsgY3JlYXRlQW5ndWxhckNvbXBpbGVySG9zdCwgZW5zdXJlU291cmNlRmlsZVZlcnNpb25zIH0gZnJvbSAnLi9hbmd1bGFyLWhvc3QnO1xuaW1wb3J0IHsgSmF2YVNjcmlwdFRyYW5zZm9ybWVyIH0gZnJvbSAnLi9qYXZhc2NyaXB0LXRyYW5zZm9ybWVyJztcbmltcG9ydCB7XG4gIGxvZ0N1bXVsYXRpdmVEdXJhdGlvbnMsXG4gIHByb2ZpbGVBc3luYyxcbiAgcHJvZmlsZVN5bmMsXG4gIHJlc2V0Q3VtdWxhdGl2ZUR1cmF0aW9ucyxcbn0gZnJvbSAnLi9wcm9maWxpbmcnO1xuaW1wb3J0IHsgQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsIGJ1bmRsZVN0eWxlc2hlZXRGaWxlLCBidW5kbGVTdHlsZXNoZWV0VGV4dCB9IGZyb20gJy4vc3R5bGVzaGVldHMnO1xuXG5pbnRlcmZhY2UgRW1pdEZpbGVSZXN1bHQge1xuICBjb250ZW50Pzogc3RyaW5nO1xuICBtYXA/OiBzdHJpbmc7XG4gIGRlcGVuZGVuY2llczogcmVhZG9ubHkgc3RyaW5nW107XG4gIGhhc2g/OiBVaW50OEFycmF5O1xufVxudHlwZSBGaWxlRW1pdHRlciA9IChmaWxlOiBzdHJpbmcpID0+IFByb21pc2U8RW1pdEZpbGVSZXN1bHQgfCB1bmRlZmluZWQ+O1xuXG4vKipcbiAqIENvbnZlcnRzIFR5cGVTY3JpcHQgRGlhZ25vc3RpYyByZWxhdGVkIGluZm9ybWF0aW9uIGludG8gYW4gZXNidWlsZCBjb21wYXRpYmxlIG5vdGUgb2JqZWN0LlxuICogUmVsYXRlZCBpbmZvcm1hdGlvbiBpcyBhIHN1YnNldCBvZiBhIGZ1bGwgVHlwZVNjcmlwdCBEaWFnbm9zdGljIGFuZCBhbHNvIHVzZWQgZm9yIGRpYWdub3N0aWNcbiAqIG5vdGVzIGFzc29jaWF0ZWQgd2l0aCB0aGUgbWFpbiBEaWFnbm9zdGljLlxuICogQHBhcmFtIGluZm8gVGhlIFR5cGVTY3JpcHQgZGlhZ25vc3RpYyByZWxhdGl2ZSBpbmZvcm1hdGlvbiB0byBjb252ZXJ0LlxuICogQHBhcmFtIGhvc3QgQSBUeXBlU2NyaXB0IEZvcm1hdERpYWdub3N0aWNzSG9zdCBpbnN0YW5jZSB0byB1c2UgZHVyaW5nIGNvbnZlcnNpb24uXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIGRpYWdub3N0aWMgbWVzc2FnZSBhcyBhIFBhcnRpYWxNZXNzYWdlIG9iamVjdFxuICovXG5mdW5jdGlvbiBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWNJbmZvKFxuICBpbmZvOiB0cy5EaWFnbm9zdGljUmVsYXRlZEluZm9ybWF0aW9uLFxuICBob3N0OiB0cy5Gb3JtYXREaWFnbm9zdGljc0hvc3QsXG4gIHRleHRQcmVmaXg/OiBzdHJpbmcsXG4pOiBQYXJ0aWFsTm90ZSB7XG4gIGxldCB0ZXh0ID0gdHMuZmxhdHRlbkRpYWdub3N0aWNNZXNzYWdlVGV4dChpbmZvLm1lc3NhZ2VUZXh0LCBob3N0LmdldE5ld0xpbmUoKSk7XG4gIGlmICh0ZXh0UHJlZml4KSB7XG4gICAgdGV4dCA9IHRleHRQcmVmaXggKyB0ZXh0O1xuICB9XG5cbiAgY29uc3Qgbm90ZTogUGFydGlhbE5vdGUgPSB7IHRleHQgfTtcblxuICBpZiAoaW5mby5maWxlKSB7XG4gICAgbm90ZS5sb2NhdGlvbiA9IHtcbiAgICAgIGZpbGU6IGluZm8uZmlsZS5maWxlTmFtZSxcbiAgICAgIGxlbmd0aDogaW5mby5sZW5ndGgsXG4gICAgfTtcblxuICAgIC8vIENhbGN1bGF0ZSB0aGUgbGluZS9jb2x1bW4gbG9jYXRpb24gYW5kIGV4dHJhY3QgdGhlIGZ1bGwgbGluZSB0ZXh0IHRoYXQgaGFzIHRoZSBkaWFnbm9zdGljXG4gICAgaWYgKGluZm8uc3RhcnQpIHtcbiAgICAgIGNvbnN0IHsgbGluZSwgY2hhcmFjdGVyIH0gPSB0cy5nZXRMaW5lQW5kQ2hhcmFjdGVyT2ZQb3NpdGlvbihpbmZvLmZpbGUsIGluZm8uc3RhcnQpO1xuICAgICAgbm90ZS5sb2NhdGlvbi5saW5lID0gbGluZSArIDE7XG4gICAgICBub3RlLmxvY2F0aW9uLmNvbHVtbiA9IGNoYXJhY3RlcjtcblxuICAgICAgLy8gVGhlIHN0YXJ0IHBvc2l0aW9uIGZvciB0aGUgc2xpY2UgaXMgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiB0aGUgZXJyb3IgbGluZVxuICAgICAgY29uc3QgbGluZVN0YXJ0UG9zaXRpb24gPSB0cy5nZXRQb3NpdGlvbk9mTGluZUFuZENoYXJhY3RlcihpbmZvLmZpbGUsIGxpbmUsIDApO1xuXG4gICAgICAvLyBUaGUgZW5kIHBvc2l0aW9uIGZvciB0aGUgc2xpY2UgaXMgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiB0aGUgbmV4dCBsaW5lIG9yIHRoZSBsZW5ndGggb2ZcbiAgICAgIC8vIHRoZSBlbnRpcmUgZmlsZSBpZiB0aGUgbGluZSBpcyB0aGUgbGFzdCBsaW5lIG9mIHRoZSBmaWxlIChnZXRQb3NpdGlvbk9mTGluZUFuZENoYXJhY3RlclxuICAgICAgLy8gd2lsbCBlcnJvciBpZiBhIG5vbmV4aXN0ZW50IGxpbmUgaXMgcGFzc2VkKS5cbiAgICAgIGNvbnN0IHsgbGluZTogbGFzdExpbmVPZkZpbGUgfSA9IHRzLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKFxuICAgICAgICBpbmZvLmZpbGUsXG4gICAgICAgIGluZm8uZmlsZS50ZXh0Lmxlbmd0aCAtIDEsXG4gICAgICApO1xuICAgICAgY29uc3QgbGluZUVuZFBvc2l0aW9uID1cbiAgICAgICAgbGluZSA8IGxhc3RMaW5lT2ZGaWxlXG4gICAgICAgICAgPyB0cy5nZXRQb3NpdGlvbk9mTGluZUFuZENoYXJhY3RlcihpbmZvLmZpbGUsIGxpbmUgKyAxLCAwKVxuICAgICAgICAgIDogaW5mby5maWxlLnRleHQubGVuZ3RoO1xuXG4gICAgICBub3RlLmxvY2F0aW9uLmxpbmVUZXh0ID0gaW5mby5maWxlLnRleHQuc2xpY2UobGluZVN0YXJ0UG9zaXRpb24sIGxpbmVFbmRQb3NpdGlvbikudHJpbUVuZCgpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBub3RlO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGEgVHlwZVNjcmlwdCBEaWFnbm9zdGljIG1lc3NhZ2UgaW50byBhbiBlc2J1aWxkIGNvbXBhdGlibGUgbWVzc2FnZSBvYmplY3QuXG4gKiBAcGFyYW0gZGlhZ25vc3RpYyBUaGUgVHlwZVNjcmlwdCBkaWFnbm9zdGljIHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0gaG9zdCBBIFR5cGVTY3JpcHQgRm9ybWF0RGlhZ25vc3RpY3NIb3N0IGluc3RhbmNlIHRvIHVzZSBkdXJpbmcgY29udmVyc2lvbi5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgZGlhZ25vc3RpYyBtZXNzYWdlIGFzIGEgUGFydGlhbE1lc3NhZ2Ugb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpYyhcbiAgZGlhZ25vc3RpYzogdHMuRGlhZ25vc3RpYyxcbiAgaG9zdDogdHMuRm9ybWF0RGlhZ25vc3RpY3NIb3N0LFxuKTogUGFydGlhbE1lc3NhZ2Uge1xuICBsZXQgY29kZVByZWZpeCA9ICdUUyc7XG4gIGxldCBjb2RlID0gYCR7ZGlhZ25vc3RpYy5jb2RlfWA7XG4gIGlmIChkaWFnbm9zdGljLnNvdXJjZSA9PT0gJ25ndHNjJykge1xuICAgIGNvZGVQcmVmaXggPSAnTkcnO1xuICAgIC8vIFJlbW92ZSBgLTk5YCBBbmd1bGFyIHByZWZpeCBmcm9tIGRpYWdub3N0aWMgY29kZVxuICAgIGNvZGUgPSBjb2RlLnNsaWNlKDMpO1xuICB9XG5cbiAgY29uc3QgbWVzc2FnZTogUGFydGlhbE1lc3NhZ2UgPSB7XG4gICAgLi4uY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljSW5mbyhkaWFnbm9zdGljLCBob3N0LCBgJHtjb2RlUHJlZml4fSR7Y29kZX06IGApLFxuICAgIC8vIFN0b3JlIG9yaWdpbmFsIGRpYWdub3N0aWMgZm9yIHJlZmVyZW5jZSBpZiBuZWVkZWQgZG93bnN0cmVhbVxuICAgIGRldGFpbDogZGlhZ25vc3RpYyxcbiAgfTtcblxuICBpZiAoZGlhZ25vc3RpYy5yZWxhdGVkSW5mb3JtYXRpb24/Lmxlbmd0aCkge1xuICAgIG1lc3NhZ2Uubm90ZXMgPSBkaWFnbm9zdGljLnJlbGF0ZWRJbmZvcm1hdGlvbi5tYXAoKGluZm8pID0+XG4gICAgICBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWNJbmZvKGluZm8sIGhvc3QpLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gbWVzc2FnZTtcbn1cblxuY29uc3QgVVNJTkdfV0lORE9XUyA9IHBsYXRmb3JtKCkgPT09ICd3aW4zMic7XG5jb25zdCBXSU5ET1dTX1NFUF9SRUdFWFAgPSBuZXcgUmVnRXhwKGBcXFxcJHtwYXRoLndpbjMyLnNlcH1gLCAnZycpO1xuXG5leHBvcnQgY2xhc3MgU291cmNlRmlsZUNhY2hlIGV4dGVuZHMgTWFwPHN0cmluZywgdHMuU291cmNlRmlsZT4ge1xuICByZWFkb25seSBtb2RpZmllZEZpbGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIHJlYWRvbmx5IGJhYmVsRmlsZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIFVpbnQ4QXJyYXk+KCk7XG4gIHJlYWRvbmx5IHR5cGVTY3JpcHRGaWxlQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgVWludDhBcnJheT4oKTtcblxuICBpbnZhbGlkYXRlKGZpbGVzOiBJdGVyYWJsZTxzdHJpbmc+KTogdm9pZCB7XG4gICAgdGhpcy5tb2RpZmllZEZpbGVzLmNsZWFyKCk7XG4gICAgZm9yIChsZXQgZmlsZSBvZiBmaWxlcykge1xuICAgICAgdGhpcy5iYWJlbEZpbGVDYWNoZS5kZWxldGUoZmlsZSk7XG4gICAgICB0aGlzLnR5cGVTY3JpcHRGaWxlQ2FjaGUuZGVsZXRlKHBhdGhUb0ZpbGVVUkwoZmlsZSkuaHJlZik7XG5cbiAgICAgIC8vIE5vcm1hbGl6ZSBzZXBhcmF0b3JzIHRvIGFsbG93IG1hdGNoaW5nIFR5cGVTY3JpcHQgSG9zdCBwYXRoc1xuICAgICAgaWYgKFVTSU5HX1dJTkRPV1MpIHtcbiAgICAgICAgZmlsZSA9IGZpbGUucmVwbGFjZShXSU5ET1dTX1NFUF9SRUdFWFAsIHBhdGgucG9zaXguc2VwKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5kZWxldGUoZmlsZSk7XG4gICAgICB0aGlzLm1vZGlmaWVkRmlsZXMuYWRkKGZpbGUpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbXBpbGVyUGx1Z2luT3B0aW9ucyB7XG4gIHNvdXJjZW1hcDogYm9vbGVhbjtcbiAgdHNjb25maWc6IHN0cmluZztcbiAgYWR2YW5jZWRPcHRpbWl6YXRpb25zPzogYm9vbGVhbjtcbiAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM/OiBib29sZWFuO1xuICBmaWxlUmVwbGFjZW1lbnRzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgc291cmNlRmlsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlO1xufVxuXG4vLyBUaGlzIGlzIGEgbm9uLXdhdGNoIHZlcnNpb24gb2YgdGhlIGNvbXBpbGVyIGNvZGUgZnJvbSBgQG5ndG9vbHMvd2VicGFja2AgYXVnbWVudGVkIGZvciBlc2J1aWxkXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICBwbHVnaW5PcHRpb25zOiBDb21waWxlclBsdWdpbk9wdGlvbnMsXG4gIHN0eWxlT3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsXG4pOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLWNvbXBpbGVyJyxcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuICAgIGFzeW5jIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgbGV0IHNldHVwV2FybmluZ3M6IFBhcnRpYWxNZXNzYWdlW10gfCB1bmRlZmluZWQ7XG5cbiAgICAgIC8vIEluaXRpYWxpemUgYSB3b3JrZXIgcG9vbCBmb3IgSmF2YVNjcmlwdCB0cmFuc2Zvcm1hdGlvbnNcbiAgICAgIGNvbnN0IGphdmFzY3JpcHRUcmFuc2Zvcm1lciA9IG5ldyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIocGx1Z2luT3B0aW9ucywgbWF4V29ya2Vycyk7XG5cbiAgICAgIC8vIFRoaXMgdXNlcyBhIHdyYXBwZWQgZHluYW1pYyBpbXBvcnQgdG8gbG9hZCBgQGFuZ3VsYXIvY29tcGlsZXItY2xpYCB3aGljaCBpcyBFU00uXG4gICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3IgcmV0YWluaW5nIGR5bmFtaWMgaW1wb3J0cyB0aGlzIHdvcmthcm91bmQgY2FuIGJlIGRyb3BwZWQuXG4gICAgICBjb25zdCB7IEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QsIE5ndHNjUHJvZ3JhbSwgT3B0aW1pemVGb3IsIHJlYWRDb25maWd1cmF0aW9uIH0gPVxuICAgICAgICBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpPignQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk7XG5cbiAgICAgIC8vIFRlbXBvcmFyeSBkZWVwIGltcG9ydCBmb3IgdHJhbnNmb3JtZXIgc3VwcG9ydFxuICAgICAgY29uc3Qge1xuICAgICAgICBtZXJnZVRyYW5zZm9ybWVycyxcbiAgICAgICAgcmVwbGFjZUJvb3RzdHJhcCxcbiAgICAgIH0gPSByZXF1aXJlKCdAbmd0b29scy93ZWJwYWNrL3NyYy9pdnkvdHJhbnNmb3JtYXRpb24nKTtcblxuICAgICAgLy8gU2V0dXAgZGVmaW5lcyBiYXNlZCBvbiB0aGUgdmFsdWVzIHByb3ZpZGVkIGJ5IHRoZSBBbmd1bGFyIGNvbXBpbGVyLWNsaVxuICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lID8/PSB7fTtcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QpKSB7XG4gICAgICAgIGlmIChrZXkgaW4gYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lKSB7XG4gICAgICAgICAgLy8gU2tpcCBrZXlzIHRoYXQgaGF2ZSBiZWVuIG1hbnVhbGx5IHByb3ZpZGVkXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZXNidWlsZCByZXF1aXJlcyB2YWx1ZXMgdG8gYmUgYSBzdHJpbmcgKGFjdHVhbCBzdHJpbmdzIG5lZWQgdG8gYmUgcXVvdGVkKS5cbiAgICAgICAgLy8gSW4gdGhpcyBjYXNlLCBhbGwgcHJvdmlkZWQgdmFsdWVzIGFyZSBib29sZWFucy5cbiAgICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lW2tleV0gPSB2YWx1ZS50b1N0cmluZygpO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgdHNjb25maWcgaXMgbG9hZGVkIGluIHNldHVwIGluc3RlYWQgb2YgaW4gc3RhcnQgdG8gYWxsb3cgdGhlIGVzYnVpbGQgdGFyZ2V0IGJ1aWxkIG9wdGlvbiB0byBiZSBtb2RpZmllZC5cbiAgICAgIC8vIGVzYnVpbGQgYnVpbGQgb3B0aW9ucyBjYW4gb25seSBiZSBtb2RpZmllZCBpbiBzZXR1cCBwcmlvciB0byBzdGFydGluZyB0aGUgYnVpbGQuXG4gICAgICBjb25zdCB7XG4gICAgICAgIG9wdGlvbnM6IGNvbXBpbGVyT3B0aW9ucyxcbiAgICAgICAgcm9vdE5hbWVzLFxuICAgICAgICBlcnJvcnM6IGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcyxcbiAgICAgIH0gPSBwcm9maWxlU3luYygnTkdfUkVBRF9DT05GSUcnLCAoKSA9PlxuICAgICAgICByZWFkQ29uZmlndXJhdGlvbihwbHVnaW5PcHRpb25zLnRzY29uZmlnLCB7XG4gICAgICAgICAgbm9FbWl0T25FcnJvcjogZmFsc2UsXG4gICAgICAgICAgc3VwcHJlc3NPdXRwdXRQYXRoQ2hlY2s6IHRydWUsXG4gICAgICAgICAgb3V0RGlyOiB1bmRlZmluZWQsXG4gICAgICAgICAgaW5saW5lU291cmNlczogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgaW5saW5lU291cmNlTWFwOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxuICAgICAgICAgIG1hcFJvb3Q6IHVuZGVmaW5lZCxcbiAgICAgICAgICBzb3VyY2VSb290OiB1bmRlZmluZWQsXG4gICAgICAgICAgZGVjbGFyYXRpb246IGZhbHNlLFxuICAgICAgICAgIGRlY2xhcmF0aW9uTWFwOiBmYWxzZSxcbiAgICAgICAgICBhbGxvd0VtcHR5Q29kZWdlbkZpbGVzOiBmYWxzZSxcbiAgICAgICAgICBhbm5vdGF0aW9uc0FzOiAnZGVjb3JhdG9ycycsXG4gICAgICAgICAgZW5hYmxlUmVzb3VyY2VJbmxpbmluZzogZmFsc2UsXG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgICAgaWYgKGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPT09IHVuZGVmaW5lZCB8fCBjb21waWxlck9wdGlvbnMudGFyZ2V0IDwgdHMuU2NyaXB0VGFyZ2V0LkVTMjAyMikge1xuICAgICAgICAvLyBJZiAndXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHMnIGlzIGFscmVhZHkgZGVmaW5lZCBpbiB0aGUgdXNlcnMgcHJvamVjdCBsZWF2ZSB0aGUgdmFsdWUgYXMgaXMuXG4gICAgICAgIC8vIE90aGVyd2lzZSBmYWxsYmFjayB0byBmYWxzZSBkdWUgdG8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy80NTk5NVxuICAgICAgICAvLyB3aGljaCBicmVha3MgdGhlIGRlcHJlY2F0ZWQgYEBFZmZlY3RzYCBOR1JYIGRlY29yYXRvciBhbmQgcG90ZW50aWFsbHkgb3RoZXIgZXhpc3RpbmcgY29kZSBhcyB3ZWxsLlxuICAgICAgICBjb21waWxlck9wdGlvbnMudGFyZ2V0ID0gdHMuU2NyaXB0VGFyZ2V0LkVTMjAyMjtcbiAgICAgICAgY29tcGlsZXJPcHRpb25zLnVzZURlZmluZUZvckNsYXNzRmllbGRzID8/PSBmYWxzZTtcblxuICAgICAgICAoc2V0dXBXYXJuaW5ncyA/Pz0gW10pLnB1c2goe1xuICAgICAgICAgIHRleHQ6XG4gICAgICAgICAgICAnVHlwZVNjcmlwdCBjb21waWxlciBvcHRpb25zIFwidGFyZ2V0XCIgYW5kIFwidXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHNcIiBhcmUgc2V0IHRvIFwiRVMyMDIyXCIgYW5kICcgK1xuICAgICAgICAgICAgJ1wiZmFsc2VcIiByZXNwZWN0aXZlbHkgYnkgdGhlIEFuZ3VsYXIgQ0xJLicsXG4gICAgICAgICAgbG9jYXRpb246IHsgZmlsZTogcGx1Z2luT3B0aW9ucy50c2NvbmZpZyB9LFxuICAgICAgICAgIG5vdGVzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHRleHQ6XG4gICAgICAgICAgICAgICAgJ1RvIGNvbnRyb2wgRUNNQSB2ZXJzaW9uIGFuZCBmZWF0dXJlcyB1c2UgdGhlIEJyb3dlcnNsaXN0IGNvbmZpZ3VyYXRpb24uICcgK1xuICAgICAgICAgICAgICAgICdGb3IgbW9yZSBpbmZvcm1hdGlvbiwgc2VlIGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS9idWlsZCNjb25maWd1cmluZy1icm93c2VyLWNvbXBhdGliaWxpdHknLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIGZpbGUgZW1pdHRlciBjcmVhdGVkIGR1cmluZyBgb25TdGFydGAgdGhhdCB3aWxsIGJlIHVzZWQgZHVyaW5nIHRoZSBidWlsZCBpbiBgb25Mb2FkYCBjYWxsYmFja3MgZm9yIFRTIGZpbGVzXG4gICAgICBsZXQgZmlsZUVtaXR0ZXI6IEZpbGVFbWl0dGVyIHwgdW5kZWZpbmVkO1xuXG4gICAgICAvLyBUaGUgc3R5bGVzaGVldCByZXNvdXJjZXMgZnJvbSBjb21wb25lbnQgc3R5bGVzaGVldHMgdGhhdCB3aWxsIGJlIGFkZGVkIHRvIHRoZSBidWlsZCByZXN1bHRzIG91dHB1dCBmaWxlc1xuICAgICAgbGV0IHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzOiBPdXRwdXRGaWxlW107XG5cbiAgICAgIGxldCBwcmV2aW91c0J1aWxkZXI6IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0gfCB1bmRlZmluZWQ7XG4gICAgICBsZXQgcHJldmlvdXNBbmd1bGFyUHJvZ3JhbTogTmd0c2NQcm9ncmFtIHwgdW5kZWZpbmVkO1xuICAgICAgY29uc3QgZGlhZ25vc3RpY0NhY2hlID0gbmV3IFdlYWtNYXA8dHMuU291cmNlRmlsZSwgdHMuRGlhZ25vc3RpY1tdPigpO1xuXG4gICAgICBidWlsZC5vblN0YXJ0KGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0OiBPblN0YXJ0UmVzdWx0ID0ge1xuICAgICAgICAgIHdhcm5pbmdzOiBzZXR1cFdhcm5pbmdzLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFJlc2V0IHRoZSBzZXR1cCB3YXJuaW5ncyBzbyB0aGF0IHRoZXkgYXJlIG9ubHkgc2hvd24gZHVyaW5nIHRoZSBmaXJzdCBidWlsZC5cbiAgICAgICAgc2V0dXBXYXJuaW5ncyA9IHVuZGVmaW5lZDtcblxuICAgICAgICAvLyBSZXNldCBkZWJ1ZyBwZXJmb3JtYW5jZSB0cmFja2luZ1xuICAgICAgICByZXNldEN1bXVsYXRpdmVEdXJhdGlvbnMoKTtcblxuICAgICAgICAvLyBSZXNldCBzdHlsZXNoZWV0IHJlc291cmNlIG91dHB1dCBmaWxlc1xuICAgICAgICBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyA9IFtdO1xuXG4gICAgICAgIC8vIENyZWF0ZSBBbmd1bGFyIGNvbXBpbGVyIGhvc3RcbiAgICAgICAgY29uc3QgaG9zdCA9IGNyZWF0ZUFuZ3VsYXJDb21waWxlckhvc3QoY29tcGlsZXJPcHRpb25zLCB7XG4gICAgICAgICAgZmlsZVJlcGxhY2VtZW50czogcGx1Z2luT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzLFxuICAgICAgICAgIG1vZGlmaWVkRmlsZXM6IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5tb2RpZmllZEZpbGVzLFxuICAgICAgICAgIHNvdXJjZUZpbGVDYWNoZTogcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUsXG4gICAgICAgICAgYXN5bmMgdHJhbnNmb3JtU3R5bGVzaGVldChkYXRhLCBjb250YWluaW5nRmlsZSwgc3R5bGVzaGVldEZpbGUpIHtcbiAgICAgICAgICAgIC8vIFN0eWxlc2hlZXQgZmlsZSBvbmx5IGV4aXN0cyBmb3IgZXh0ZXJuYWwgc3R5bGVzaGVldHNcbiAgICAgICAgICAgIGNvbnN0IGZpbGVuYW1lID0gc3R5bGVzaGVldEZpbGUgPz8gY29udGFpbmluZ0ZpbGU7XG5cbiAgICAgICAgICAgIC8vIFRlbXBvcmFyeSB3b3JrYXJvdW5kIGZvciBsYWNrIG9mIHZpcnR1YWwgZmlsZSBzdXBwb3J0IGluIHRoZSBTYXNzIHBsdWdpbi5cbiAgICAgICAgICAgIC8vIEV4dGVybmFsIFNhc3Mgc3R5bGVzaGVldHMgYXJlIHRyYW5zZm9ybWVkIHVzaW5nIHRoZSBmaWxlIGluc3RlYWQgb2YgdGhlIGFscmVhZHkgcmVhZCBjb250ZW50LlxuICAgICAgICAgICAgbGV0IHN0eWxlc2hlZXRSZXN1bHQ7XG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUuZW5kc1dpdGgoJy5zY3NzJykgfHwgZmlsZW5hbWUuZW5kc1dpdGgoJy5zYXNzJykpIHtcbiAgICAgICAgICAgICAgc3R5bGVzaGVldFJlc3VsdCA9IGF3YWl0IGJ1bmRsZVN0eWxlc2hlZXRGaWxlKGZpbGVuYW1lLCBzdHlsZU9wdGlvbnMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc3R5bGVzaGVldFJlc3VsdCA9IGF3YWl0IGJ1bmRsZVN0eWxlc2hlZXRUZXh0KFxuICAgICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgcmVzb2x2ZVBhdGg6IHBhdGguZGlybmFtZShmaWxlbmFtZSksXG4gICAgICAgICAgICAgICAgICB2aXJ0dWFsTmFtZTogZmlsZW5hbWUsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHsgY29udGVudHMsIHJlc291cmNlRmlsZXMsIGVycm9ycywgd2FybmluZ3MgfSA9IHN0eWxlc2hlZXRSZXN1bHQ7XG4gICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgICAgIHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLnB1c2goLi4ucmVzb3VyY2VGaWxlcyk7XG5cbiAgICAgICAgICAgIHJldHVybiBjb250ZW50cztcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBDcmVhdGUgdGhlIEFuZ3VsYXIgc3BlY2lmaWMgcHJvZ3JhbSB0aGF0IGNvbnRhaW5zIHRoZSBBbmd1bGFyIGNvbXBpbGVyXG4gICAgICAgIGNvbnN0IGFuZ3VsYXJQcm9ncmFtID0gcHJvZmlsZVN5bmMoXG4gICAgICAgICAgJ05HX0NSRUFURV9QUk9HUkFNJyxcbiAgICAgICAgICAoKSA9PiBuZXcgTmd0c2NQcm9ncmFtKHJvb3ROYW1lcywgY29tcGlsZXJPcHRpb25zLCBob3N0LCBwcmV2aW91c0FuZ3VsYXJQcm9ncmFtKSxcbiAgICAgICAgKTtcbiAgICAgICAgcHJldmlvdXNBbmd1bGFyUHJvZ3JhbSA9IGFuZ3VsYXJQcm9ncmFtO1xuICAgICAgICBjb25zdCBhbmd1bGFyQ29tcGlsZXIgPSBhbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgICAgICAgY29uc3QgdHlwZVNjcmlwdFByb2dyYW0gPSBhbmd1bGFyUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKTtcbiAgICAgICAgZW5zdXJlU291cmNlRmlsZVZlcnNpb25zKHR5cGVTY3JpcHRQcm9ncmFtKTtcblxuICAgICAgICBjb25zdCBidWlsZGVyID0gdHMuY3JlYXRlRW1pdEFuZFNlbWFudGljRGlhZ25vc3RpY3NCdWlsZGVyUHJvZ3JhbShcbiAgICAgICAgICB0eXBlU2NyaXB0UHJvZ3JhbSxcbiAgICAgICAgICBob3N0LFxuICAgICAgICAgIHByZXZpb3VzQnVpbGRlcixcbiAgICAgICAgICBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3MsXG4gICAgICAgICk7XG4gICAgICAgIHByZXZpb3VzQnVpbGRlciA9IGJ1aWxkZXI7XG5cbiAgICAgICAgYXdhaXQgcHJvZmlsZUFzeW5jKCdOR19BTkFMWVpFX1BST0dSQU0nLCAoKSA9PiBhbmd1bGFyQ29tcGlsZXIuYW5hbHl6ZUFzeW5jKCkpO1xuICAgICAgICBjb25zdCBhZmZlY3RlZEZpbGVzID0gcHJvZmlsZVN5bmMoJ05HX0ZJTkRfQUZGRUNURUQnLCAoKSA9PlxuICAgICAgICAgIGZpbmRBZmZlY3RlZEZpbGVzKGJ1aWxkZXIsIGFuZ3VsYXJDb21waWxlciksXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBhZmZlY3RlZCBvZiBhZmZlY3RlZEZpbGVzKSB7XG4gICAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZS50eXBlU2NyaXB0RmlsZUNhY2hlLmRlbGV0ZShcbiAgICAgICAgICAgICAgcGF0aFRvRmlsZVVSTChhZmZlY3RlZC5maWxlTmFtZSkuaHJlZixcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24qIGNvbGxlY3REaWFnbm9zdGljcygpOiBJdGVyYWJsZTx0cy5EaWFnbm9zdGljPiB7XG4gICAgICAgICAgLy8gQ29sbGVjdCBwcm9ncmFtIGxldmVsIGRpYWdub3N0aWNzXG4gICAgICAgICAgeWllbGQqIGJ1aWxkZXIuZ2V0Q29uZmlnRmlsZVBhcnNpbmdEaWFnbm9zdGljcygpO1xuICAgICAgICAgIHlpZWxkKiBhbmd1bGFyQ29tcGlsZXIuZ2V0T3B0aW9uRGlhZ25vc3RpY3MoKTtcbiAgICAgICAgICB5aWVsZCogYnVpbGRlci5nZXRPcHRpb25zRGlhZ25vc3RpY3MoKTtcbiAgICAgICAgICB5aWVsZCogYnVpbGRlci5nZXRHbG9iYWxEaWFnbm9zdGljcygpO1xuXG4gICAgICAgICAgLy8gQ29sbGVjdCBzb3VyY2UgZmlsZSBzcGVjaWZpYyBkaWFnbm9zdGljc1xuICAgICAgICAgIGNvbnN0IG9wdGltaXplRm9yID1cbiAgICAgICAgICAgIGFmZmVjdGVkRmlsZXMuc2l6ZSA+IDEgPyBPcHRpbWl6ZUZvci5XaG9sZVByb2dyYW0gOiBPcHRpbWl6ZUZvci5TaW5nbGVGaWxlO1xuICAgICAgICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiBidWlsZGVyLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBUeXBlU2NyaXB0IHdpbGwgdXNlIGNhY2hlZCBkaWFnbm9zdGljcyBmb3IgZmlsZXMgdGhhdCBoYXZlIG5vdCBiZWVuXG4gICAgICAgICAgICAvLyBjaGFuZ2VkIG9yIGFmZmVjdGVkIGZvciB0aGlzIGJ1aWxkIHdoZW4gdXNpbmcgaW5jcmVtZW50YWwgYnVpbGRpbmcuXG4gICAgICAgICAgICB5aWVsZCogcHJvZmlsZVN5bmMoXG4gICAgICAgICAgICAgICdOR19ESUFHTk9TVElDU19TWU5UQUNUSUMnLFxuICAgICAgICAgICAgICAoKSA9PiBidWlsZGVyLmdldFN5bnRhY3RpY0RpYWdub3N0aWNzKHNvdXJjZUZpbGUpLFxuICAgICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHlpZWxkKiBwcm9maWxlU3luYyhcbiAgICAgICAgICAgICAgJ05HX0RJQUdOT1NUSUNTX1NFTUFOVElDJyxcbiAgICAgICAgICAgICAgKCkgPT4gYnVpbGRlci5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKHNvdXJjZUZpbGUpLFxuICAgICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gRGVjbGFyYXRpb24gZmlsZXMgY2Fubm90IGhhdmUgdGVtcGxhdGUgZGlhZ25vc3RpY3NcbiAgICAgICAgICAgIGlmIChzb3VyY2VGaWxlLmlzRGVjbGFyYXRpb25GaWxlKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBPbmx5IHJlcXVlc3QgQW5ndWxhciB0ZW1wbGF0ZSBkaWFnbm9zdGljcyBmb3IgYWZmZWN0ZWQgZmlsZXMgdG8gYXZvaWRcbiAgICAgICAgICAgIC8vIG92ZXJoZWFkIG9mIHRlbXBsYXRlIGRpYWdub3N0aWNzIGZvciB1bmNoYW5nZWQgZmlsZXMuXG4gICAgICAgICAgICBpZiAoYWZmZWN0ZWRGaWxlcy5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gcHJvZmlsZVN5bmMoXG4gICAgICAgICAgICAgICAgJ05HX0RJQUdOT1NUSUNTX1RFTVBMQVRFJyxcbiAgICAgICAgICAgICAgICAoKSA9PiBhbmd1bGFyQ29tcGlsZXIuZ2V0RGlhZ25vc3RpY3NGb3JGaWxlKHNvdXJjZUZpbGUsIG9wdGltaXplRm9yKSxcbiAgICAgICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBkaWFnbm9zdGljQ2FjaGUuc2V0KHNvdXJjZUZpbGUsIGFuZ3VsYXJEaWFnbm9zdGljcyk7XG4gICAgICAgICAgICAgIHlpZWxkKiBhbmd1bGFyRGlhZ25vc3RpY3M7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb25zdCBhbmd1bGFyRGlhZ25vc3RpY3MgPSBkaWFnbm9zdGljQ2FjaGUuZ2V0KHNvdXJjZUZpbGUpO1xuICAgICAgICAgICAgICBpZiAoYW5ndWxhckRpYWdub3N0aWNzKSB7XG4gICAgICAgICAgICAgICAgeWllbGQqIGFuZ3VsYXJEaWFnbm9zdGljcztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHByb2ZpbGVTeW5jKCdOR19ESUFHTk9TVElDU19UT1RBTCcsICgpID0+IHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGRpYWdub3N0aWMgb2YgY29sbGVjdERpYWdub3N0aWNzKCkpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWMoZGlhZ25vc3RpYywgaG9zdCk7XG4gICAgICAgICAgICBpZiAoZGlhZ25vc3RpYy5jYXRlZ29yeSA9PT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKSB7XG4gICAgICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaChtZXNzYWdlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgZmlsZUVtaXR0ZXIgPSBjcmVhdGVGaWxlRW1pdHRlcihcbiAgICAgICAgICBidWlsZGVyLFxuICAgICAgICAgIG1lcmdlVHJhbnNmb3JtZXJzKGFuZ3VsYXJDb21waWxlci5wcmVwYXJlRW1pdCgpLnRyYW5zZm9ybWVycywge1xuICAgICAgICAgICAgYmVmb3JlOiBbcmVwbGFjZUJvb3RzdHJhcCgoKSA9PiBidWlsZGVyLmdldFByb2dyYW0oKS5nZXRUeXBlQ2hlY2tlcigpKV0sXG4gICAgICAgICAgfSksXG4gICAgICAgICAgKHNvdXJjZUZpbGUpID0+IGFuZ3VsYXJDb21waWxlci5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLnJlY29yZFN1Y2Nlc3NmdWxFbWl0KHNvdXJjZUZpbGUpLFxuICAgICAgICApO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKFxuICAgICAgICB7IGZpbHRlcjogY29tcGlsZXJPcHRpb25zLmFsbG93SnMgPyAvXFwuW2NtXT9banRdc3g/JC8gOiAvXFwuW2NtXT90c3g/JC8gfSxcbiAgICAgICAgKGFyZ3MpID0+XG4gICAgICAgICAgcHJvZmlsZUFzeW5jKFxuICAgICAgICAgICAgJ05HX0VNSVRfVFMqJyxcbiAgICAgICAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgYXNzZXJ0Lm9rKGZpbGVFbWl0dGVyLCAnSW52YWxpZCBwbHVnaW4gZXhlY3V0aW9uIG9yZGVyJyk7XG5cbiAgICAgICAgICAgICAgY29uc3QgcmVxdWVzdCA9IHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cz8uW2FyZ3MucGF0aF0gPz8gYXJncy5wYXRoO1xuXG4gICAgICAgICAgICAgIC8vIFRoZSBmaWxlbmFtZSBpcyBjdXJyZW50bHkgdXNlZCBhcyBhIGNhY2hlIGtleS4gU2luY2UgdGhlIGNhY2hlIGlzIG1lbW9yeSBvbmx5LFxuICAgICAgICAgICAgICAvLyB0aGUgb3B0aW9ucyBjYW5ub3QgY2hhbmdlIGFuZCBkbyBub3QgbmVlZCB0byBiZSByZXByZXNlbnRlZCBpbiB0aGUga2V5LiBJZiB0aGVcbiAgICAgICAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAgICAgICAvLyB3b3VsZCBuZWVkIHRvIGJlIGFkZGVkIHRvIHRoZSBrZXkgYXMgd2VsbCBhcyBhIGNoZWNrIGZvciBhbnkgY2hhbmdlIG9mIGNvbnRlbnQuXG4gICAgICAgICAgICAgIGxldCBjb250ZW50cyA9IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy50eXBlU2NyaXB0RmlsZUNhY2hlLmdldChcbiAgICAgICAgICAgICAgICBwYXRoVG9GaWxlVVJMKHJlcXVlc3QpLmhyZWYsXG4gICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0eXBlc2NyaXB0UmVzdWx0ID0gYXdhaXQgZmlsZUVtaXR0ZXIocmVxdWVzdCk7XG4gICAgICAgICAgICAgICAgaWYgKCF0eXBlc2NyaXB0UmVzdWx0Py5jb250ZW50KSB7XG4gICAgICAgICAgICAgICAgICAvLyBObyBUUyByZXN1bHQgaW5kaWNhdGVzIHRoZSBmaWxlIGlzIG5vdCBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0uXG4gICAgICAgICAgICAgICAgICAvLyBJZiBhbGxvd0pzIGlzIGVuYWJsZWQgYW5kIHRoZSBmaWxlIGlzIEpTIHRoZW4gZGVmZXIgdG8gdGhlIG5leHQgbG9hZCBob29rLlxuICAgICAgICAgICAgICAgICAgaWYgKGNvbXBpbGVyT3B0aW9ucy5hbGxvd0pzICYmIC9cXC5bY21dP2pzJC8udGVzdChyZXF1ZXN0KSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAvLyBPdGhlcndpc2UgcmV0dXJuIGFuIGVycm9yXG4gICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVNaXNzaW5nRmlsZUVycm9yKFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MucGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIgPz8gJycsXG4gICAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29udGVudHMgPSBhd2FpdCBqYXZhc2NyaXB0VHJhbnNmb3JtZXIudHJhbnNmb3JtRGF0YShcbiAgICAgICAgICAgICAgICAgIHJlcXVlc3QsXG4gICAgICAgICAgICAgICAgICB0eXBlc2NyaXB0UmVzdWx0LmNvbnRlbnQsXG4gICAgICAgICAgICAgICAgICB0cnVlIC8qIHNraXBMaW5rZXIgKi8sXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy50eXBlU2NyaXB0RmlsZUNhY2hlLnNldChcbiAgICAgICAgICAgICAgICAgIHBhdGhUb0ZpbGVVUkwocmVxdWVzdCkuaHJlZixcbiAgICAgICAgICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICksXG4gICAgICApO1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5bY21dP2pzJC8gfSwgKGFyZ3MpID0+XG4gICAgICAgIHByb2ZpbGVBc3luYyhcbiAgICAgICAgICAnTkdfRU1JVF9KUyonLFxuICAgICAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIC8vIFRoZSBmaWxlbmFtZSBpcyBjdXJyZW50bHkgdXNlZCBhcyBhIGNhY2hlIGtleS4gU2luY2UgdGhlIGNhY2hlIGlzIG1lbW9yeSBvbmx5LFxuICAgICAgICAgICAgLy8gdGhlIG9wdGlvbnMgY2Fubm90IGNoYW5nZSBhbmQgZG8gbm90IG5lZWQgdG8gYmUgcmVwcmVzZW50ZWQgaW4gdGhlIGtleS4gSWYgdGhlXG4gICAgICAgICAgICAvLyBjYWNoZSBpcyBsYXRlciBzdG9yZWQgdG8gZGlzaywgdGhlbiB0aGUgb3B0aW9ucyB0aGF0IGFmZmVjdCB0cmFuc2Zvcm0gb3V0cHV0XG4gICAgICAgICAgICAvLyB3b3VsZCBuZWVkIHRvIGJlIGFkZGVkIHRvIHRoZSBrZXkgYXMgd2VsbCBhcyBhIGNoZWNrIGZvciBhbnkgY2hhbmdlIG9mIGNvbnRlbnQuXG4gICAgICAgICAgICBsZXQgY29udGVudHMgPSBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8uYmFiZWxGaWxlQ2FjaGUuZ2V0KGFyZ3MucGF0aCk7XG4gICAgICAgICAgICBpZiAoY29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBjb250ZW50cyA9IGF3YWl0IGphdmFzY3JpcHRUcmFuc2Zvcm1lci50cmFuc2Zvcm1GaWxlKGFyZ3MucGF0aCk7XG4gICAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5iYWJlbEZpbGVDYWNoZS5zZXQoYXJncy5wYXRoLCBjb250ZW50cyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKSxcbiAgICAgICk7XG5cbiAgICAgIGJ1aWxkLm9uRW5kKChyZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLmxlbmd0aCkge1xuICAgICAgICAgIHJlc3VsdC5vdXRwdXRGaWxlcz8ucHVzaCguLi5zdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyk7XG4gICAgICAgIH1cblxuICAgICAgICBsb2dDdW11bGF0aXZlRHVyYXRpb25zKCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVGaWxlRW1pdHRlcihcbiAgcHJvZ3JhbTogdHMuQnVpbGRlclByb2dyYW0sXG4gIHRyYW5zZm9ybWVyczogdHMuQ3VzdG9tVHJhbnNmb3JtZXJzID0ge30sXG4gIG9uQWZ0ZXJFbWl0PzogKHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUpID0+IHZvaWQsXG4pOiBGaWxlRW1pdHRlciB7XG4gIHJldHVybiBhc3luYyAoZmlsZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgc291cmNlRmlsZSA9IHByb2dyYW0uZ2V0U291cmNlRmlsZShmaWxlKTtcbiAgICBpZiAoIXNvdXJjZUZpbGUpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgbGV0IGNvbnRlbnQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBwcm9ncmFtLmVtaXQoXG4gICAgICBzb3VyY2VGaWxlLFxuICAgICAgKGZpbGVuYW1lLCBkYXRhKSA9PiB7XG4gICAgICAgIGlmICgvXFwuW2NtXT9qcyQvLnRlc3QoZmlsZW5hbWUpKSB7XG4gICAgICAgICAgY29udGVudCA9IGRhdGE7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB1bmRlZmluZWQgLyogY2FuY2VsbGF0aW9uVG9rZW4gKi8sXG4gICAgICB1bmRlZmluZWQgLyogZW1pdE9ubHlEdHNGaWxlcyAqLyxcbiAgICAgIHRyYW5zZm9ybWVycyxcbiAgICApO1xuXG4gICAgb25BZnRlckVtaXQ/Lihzb3VyY2VGaWxlKTtcblxuICAgIHJldHVybiB7IGNvbnRlbnQsIGRlcGVuZGVuY2llczogW10gfTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gZmluZEFmZmVjdGVkRmlsZXMoXG4gIGJ1aWxkZXI6IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0sXG4gIHsgaWdub3JlRm9yRGlhZ25vc3RpY3MsIGlnbm9yZUZvckVtaXQsIGluY3JlbWVudGFsQ29tcGlsYXRpb24gfTogTmd0c2NQcm9ncmFtWydjb21waWxlciddLFxuKTogU2V0PHRzLlNvdXJjZUZpbGU+IHtcbiAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IG5ldyBTZXQ8dHMuU291cmNlRmlsZT4oKTtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYnVpbGRlci5nZXRTZW1hbnRpY0RpYWdub3N0aWNzT2ZOZXh0QWZmZWN0ZWRGaWxlKHVuZGVmaW5lZCwgKHNvdXJjZUZpbGUpID0+IHtcbiAgICAgIC8vIElmIHRoZSBhZmZlY3RlZCBmaWxlIGlzIGEgVFRDIHNoaW0sIGFkZCB0aGUgc2hpbSdzIG9yaWdpbmFsIHNvdXJjZSBmaWxlLlxuICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoYXQgY2hhbmdlcyB0aGF0IGFmZmVjdCBUVEMgYXJlIHR5cGVjaGVja2VkIGV2ZW4gd2hlbiB0aGUgY2hhbmdlc1xuICAgICAgLy8gYXJlIG90aGVyd2lzZSB1bnJlbGF0ZWQgZnJvbSBhIFRTIHBlcnNwZWN0aXZlIGFuZCBkbyBub3QgcmVzdWx0IGluIEl2eSBjb2RlZ2VuIGNoYW5nZXMuXG4gICAgICAvLyBGb3IgZXhhbXBsZSwgY2hhbmdpbmcgQElucHV0IHByb3BlcnR5IHR5cGVzIG9mIGEgZGlyZWN0aXZlIHVzZWQgaW4gYW5vdGhlciBjb21wb25lbnQnc1xuICAgICAgLy8gdGVtcGxhdGUuXG4gICAgICAvLyBBIFRUQyBzaGltIGlzIGEgZmlsZSB0aGF0IGhhcyBiZWVuIGlnbm9yZWQgZm9yIGRpYWdub3N0aWNzIGFuZCBoYXMgYSBmaWxlbmFtZSBlbmRpbmcgaW4gYC5uZ3R5cGVjaGVjay50c2AuXG4gICAgICBpZiAoaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpICYmIHNvdXJjZUZpbGUuZmlsZU5hbWUuZW5kc1dpdGgoJy5uZ3R5cGVjaGVjay50cycpKSB7XG4gICAgICAgIC8vIFRoaXMgZmlsZSBuYW1lIGNvbnZlcnNpb24gcmVsaWVzIG9uIGludGVybmFsIGNvbXBpbGVyIGxvZ2ljIGFuZCBzaG91bGQgYmUgY29udmVydGVkXG4gICAgICAgIC8vIHRvIGFuIG9mZmljaWFsIG1ldGhvZCB3aGVuIGF2YWlsYWJsZS4gMTUgaXMgbGVuZ3RoIG9mIGAubmd0eXBlY2hlY2sudHNgXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsRmlsZW5hbWUgPSBzb3VyY2VGaWxlLmZpbGVOYW1lLnNsaWNlKDAsIC0xNSkgKyAnLnRzJztcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxTb3VyY2VGaWxlID0gYnVpbGRlci5nZXRTb3VyY2VGaWxlKG9yaWdpbmFsRmlsZW5hbWUpO1xuICAgICAgICBpZiAob3JpZ2luYWxTb3VyY2VGaWxlKSB7XG4gICAgICAgICAgYWZmZWN0ZWRGaWxlcy5hZGQob3JpZ2luYWxTb3VyY2VGaWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgYWZmZWN0ZWRGaWxlcy5hZGQocmVzdWx0LmFmZmVjdGVkIGFzIHRzLlNvdXJjZUZpbGUpO1xuICB9XG5cbiAgLy8gQSBmaWxlIGlzIGFsc28gYWZmZWN0ZWQgaWYgdGhlIEFuZ3VsYXIgY29tcGlsZXIgcmVxdWlyZXMgaXQgdG8gYmUgZW1pdHRlZFxuICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgYnVpbGRlci5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgaWYgKGlnbm9yZUZvckVtaXQuaGFzKHNvdXJjZUZpbGUpIHx8IGluY3JlbWVudGFsQ29tcGlsYXRpb24uc2FmZVRvU2tpcEVtaXQoc291cmNlRmlsZSkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGFmZmVjdGVkRmlsZXMuYWRkKHNvdXJjZUZpbGUpO1xuICB9XG5cbiAgcmV0dXJuIGFmZmVjdGVkRmlsZXM7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU1pc3NpbmdGaWxlRXJyb3IocmVxdWVzdDogc3RyaW5nLCBvcmlnaW5hbDogc3RyaW5nLCByb290OiBzdHJpbmcpOiBQYXJ0aWFsTWVzc2FnZSB7XG4gIGNvbnN0IGVycm9yID0ge1xuICAgIHRleHQ6IGBGaWxlICcke3BhdGgucmVsYXRpdmUocm9vdCwgcmVxdWVzdCl9JyBpcyBtaXNzaW5nIGZyb20gdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24uYCxcbiAgICBub3RlczogW1xuICAgICAge1xuICAgICAgICB0ZXh0OiBgRW5zdXJlIHRoZSBmaWxlIGlzIHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvZ3JhbSB2aWEgdGhlICdmaWxlcycgb3IgJ2luY2x1ZGUnIHByb3BlcnR5LmAsXG4gICAgICB9LFxuICAgIF0sXG4gIH07XG5cbiAgaWYgKHJlcXVlc3QgIT09IG9yaWdpbmFsKSB7XG4gICAgZXJyb3Iubm90ZXMucHVzaCh7XG4gICAgICB0ZXh0OiBgRmlsZSBpcyByZXF1ZXN0ZWQgZnJvbSBhIGZpbGUgcmVwbGFjZW1lbnQgb2YgJyR7cGF0aC5yZWxhdGl2ZShyb290LCBvcmlnaW5hbCl9Jy5gLFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIGVycm9yO1xufVxuIl19