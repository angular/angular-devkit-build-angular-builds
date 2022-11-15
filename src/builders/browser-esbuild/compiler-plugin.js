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
const core_1 = require("@babel/core");
const assert = __importStar(require("node:assert"));
const fs = __importStar(require("node:fs/promises"));
const node_os_1 = require("node:os");
const path = __importStar(require("node:path"));
const node_url_1 = require("node:url");
const typescript_1 = __importDefault(require("typescript"));
const application_1 = __importDefault(require("../../babel/presets/application"));
const webpack_loader_1 = require("../../babel/webpack-loader");
const load_esm_1 = require("../../utils/load-esm");
const angular_host_1 = require("./angular-host");
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
            const babelDataCache = new Map();
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
                var _a, _b, _c, _d, _e, _f;
                assert.ok(fileEmitter, 'Invalid plugin execution order');
                const request = (_b = (_a = pluginOptions.fileReplacements) === null || _a === void 0 ? void 0 : _a[args.path]) !== null && _b !== void 0 ? _b : args.path;
                // The filename is currently used as a cache key. Since the cache is memory only,
                // the options cannot change and do not need to be represented in the key. If the
                // cache is later stored to disk, then the options that affect transform output
                // would need to be added to the key as well as a check for any change of content.
                let contents = (_c = pluginOptions.sourceFileCache) === null || _c === void 0 ? void 0 : _c.typeScriptFileCache.get((0, node_url_1.pathToFileURL)(request).href);
                if (contents === undefined) {
                    const typescriptResult = await fileEmitter(request);
                    if (!typescriptResult) {
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
                    const data = (_e = typescriptResult.content) !== null && _e !== void 0 ? _e : '';
                    // The pre-transformed data is used as a cache key. Since the cache is memory only,
                    // the options cannot change and do not need to be represented in the key. If the
                    // cache is later stored to disk, then the options that affect transform output
                    // would need to be added to the key as well.
                    contents = babelDataCache.get(data);
                    if (contents === undefined) {
                        const transformedData = await transformWithBabel(request, data, pluginOptions);
                        contents = Buffer.from(transformedData, 'utf-8');
                        babelDataCache.set(data, contents);
                    }
                    (_f = pluginOptions.sourceFileCache) === null || _f === void 0 ? void 0 : _f.typeScriptFileCache.set((0, node_url_1.pathToFileURL)(request).href, contents);
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
                    const data = await fs.readFile(args.path, 'utf-8');
                    const transformedData = await transformWithBabel(args.path, data, pluginOptions);
                    contents = Buffer.from(transformedData, 'utf-8');
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
async function transformWithBabel(filename, data, pluginOptions) {
    var _a;
    const forceAsyncTransformation = !/[\\/][_f]?esm2015[\\/]/.test(filename) && /async\s+function\s*\*/.test(data);
    const shouldLink = await (0, webpack_loader_1.requiresLinking)(filename, data);
    const useInputSourcemap = pluginOptions.sourcemap &&
        (!!pluginOptions.thirdPartySourcemaps || !/[\\/]node_modules[\\/]/.test(filename));
    // If no additional transformations are needed, return the data directly
    if (!forceAsyncTransformation && !pluginOptions.advancedOptimizations && !shouldLink) {
        // Strip sourcemaps if they should not be used
        return useInputSourcemap ? data : data.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, '');
    }
    const angularPackage = /[\\/]node_modules[\\/]@angular[\\/]/.test(filename);
    const linkerPluginCreator = shouldLink
        ? (await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli/linker/babel')).createEs2015LinkerPlugin
        : undefined;
    const result = await (0, core_1.transformAsync)(data, {
        filename,
        inputSourceMap: (useInputSourcemap ? undefined : false),
        sourceMaps: pluginOptions.sourcemap ? 'inline' : false,
        compact: false,
        configFile: false,
        babelrc: false,
        browserslistConfigFile: false,
        plugins: [],
        presets: [
            [
                application_1.default,
                {
                    angularLinker: {
                        shouldLink,
                        jitMode: false,
                        linkerPluginCreator,
                    },
                    forceAsyncTransformation,
                    optimize: pluginOptions.advancedOptimizations && {
                        looseEnums: angularPackage,
                        pureTopLevel: angularPackage,
                    },
                },
            ],
        ],
    });
    return (_a = result === null || result === void 0 ? void 0 : result.code) !== null && _a !== void 0 ? _a : data;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILHNDQUE2QztBQVM3QyxvREFBc0M7QUFDdEMscURBQXVDO0FBQ3ZDLHFDQUFtQztBQUNuQyxnREFBa0M7QUFDbEMsdUNBQXlDO0FBQ3pDLDREQUE0QjtBQUM1QixrRkFBdUU7QUFDdkUsK0RBQTZEO0FBQzdELG1EQUFxRDtBQUNyRCxpREFBcUY7QUFDckYsMkNBS3FCO0FBQ3JCLCtDQUFvRztBQVVwRzs7Ozs7OztHQU9HO0FBQ0gsU0FBUywrQkFBK0IsQ0FDdEMsSUFBcUMsRUFDckMsSUFBOEIsRUFDOUIsVUFBbUI7SUFFbkIsSUFBSSxJQUFJLEdBQUcsb0JBQUUsQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0lBQ2hGLElBQUksVUFBVSxFQUFFO1FBQ2QsSUFBSSxHQUFHLFVBQVUsR0FBRyxJQUFJLENBQUM7S0FDMUI7SUFFRCxNQUFNLElBQUksR0FBZ0IsRUFBRSxJQUFJLEVBQUUsQ0FBQztJQUVuQyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUU7UUFDYixJQUFJLENBQUMsUUFBUSxHQUFHO1lBQ2QsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUTtZQUN4QixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07U0FDcEIsQ0FBQztRQUVGLDRGQUE0RjtRQUM1RixJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDZCxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFB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QUF5QixDQUFDLENBQUM7S0FDckQ7SUFFRCw0RUFBNEU7SUFDNUUsS0FBSyxNQUFNLFVBQVUsSUFBSSxPQUFPLENBQUMsY0FBYyxFQUFFLEVBQUU7UUFDakQsSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLHNCQUFzQixDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUN0RixTQUFTO1NBQ1Y7UUFFRCxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQy9CO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQztBQUVELFNBQVMsc0JBQXNCLENBQUMsT0FBZSxFQUFFLFFBQWdCLEVBQUUsSUFBWTtJQUM3RSxNQUFNLEtBQUssR0FBRztRQUNaLElBQUksRUFBRSxTQUFTLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQywrQ0FBK0M7UUFDMUYsS0FBSyxFQUFFO1lBQ0w7Z0JBQ0UsSUFBSSxFQUFFLDBGQUEwRjthQUNqRztTQUNGO0tBQ0YsQ0FBQztJQUVGLElBQUksT0FBTyxLQUFLLFFBQVEsRUFBRTtRQUN4QixLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNmLElBQUksRUFBRSxpREFBaUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUk7U0FDekYsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBOZ3RzY1Byb2dyYW0gfSBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHsgdHJhbnNmb3JtQXN5bmMgfSBmcm9tICdAYmFiZWwvY29yZSc7XG5pbXBvcnQgdHlwZSB7XG4gIE9uU3RhcnRSZXN1bHQsXG4gIE91dHB1dEZpbGUsXG4gIFBhcnRpYWxNZXNzYWdlLFxuICBQYXJ0aWFsTm90ZSxcbiAgUGx1Z2luLFxuICBQbHVnaW5CdWlsZCxcbn0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJ25vZGU6b3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCBhbmd1bGFyQXBwbGljYXRpb25QcmVzZXQgZnJvbSAnLi4vLi4vYmFiZWwvcHJlc2V0cy9hcHBsaWNhdGlvbic7XG5pbXBvcnQgeyByZXF1aXJlc0xpbmtpbmcgfSBmcm9tICcuLi8uLi9iYWJlbC93ZWJwYWNrLWxvYWRlcic7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHsgY3JlYXRlQW5ndWxhckNvbXBpbGVySG9zdCwgZW5zdXJlU291cmNlRmlsZVZlcnNpb25zIH0gZnJvbSAnLi9hbmd1bGFyLWhvc3QnO1xuaW1wb3J0IHtcbiAgbG9nQ3VtdWxhdGl2ZUR1cmF0aW9ucyxcbiAgcHJvZmlsZUFzeW5jLFxuICBwcm9maWxlU3luYyxcbiAgcmVzZXRDdW11bGF0aXZlRHVyYXRpb25zLFxufSBmcm9tICcuL3Byb2ZpbGluZyc7XG5pbXBvcnQgeyBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucywgYnVuZGxlU3R5bGVzaGVldEZpbGUsIGJ1bmRsZVN0eWxlc2hlZXRUZXh0IH0gZnJvbSAnLi9zdHlsZXNoZWV0cyc7XG5cbmludGVyZmFjZSBFbWl0RmlsZVJlc3VsdCB7XG4gIGNvbnRlbnQ/OiBzdHJpbmc7XG4gIG1hcD86IHN0cmluZztcbiAgZGVwZW5kZW5jaWVzOiByZWFkb25seSBzdHJpbmdbXTtcbiAgaGFzaD86IFVpbnQ4QXJyYXk7XG59XG50eXBlIEZpbGVFbWl0dGVyID0gKGZpbGU6IHN0cmluZykgPT4gUHJvbWlzZTxFbWl0RmlsZVJlc3VsdCB8IHVuZGVmaW5lZD47XG5cbi8qKlxuICogQ29udmVydHMgVHlwZVNjcmlwdCBEaWFnbm9zdGljIHJlbGF0ZWQgaW5mb3JtYXRpb24gaW50byBhbiBlc2J1aWxkIGNvbXBhdGlibGUgbm90ZSBvYmplY3QuXG4gKiBSZWxhdGVkIGluZm9ybWF0aW9uIGlzIGEgc3Vic2V0IG9mIGEgZnVsbCBUeXBlU2NyaXB0IERpYWdub3N0aWMgYW5kIGFsc28gdXNlZCBmb3IgZGlhZ25vc3RpY1xuICogbm90ZXMgYXNzb2NpYXRlZCB3aXRoIHRoZSBtYWluIERpYWdub3N0aWMuXG4gKiBAcGFyYW0gaW5mbyBUaGUgVHlwZVNjcmlwdCBkaWFnbm9zdGljIHJlbGF0aXZlIGluZm9ybWF0aW9uIHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0gaG9zdCBBIFR5cGVTY3JpcHQgRm9ybWF0RGlhZ25vc3RpY3NIb3N0IGluc3RhbmNlIHRvIHVzZSBkdXJpbmcgY29udmVyc2lvbi5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgZGlhZ25vc3RpYyBtZXNzYWdlIGFzIGEgUGFydGlhbE1lc3NhZ2Ugb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oXG4gIGluZm86IHRzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24sXG4gIGhvc3Q6IHRzLkZvcm1hdERpYWdub3N0aWNzSG9zdCxcbiAgdGV4dFByZWZpeD86IHN0cmluZyxcbik6IFBhcnRpYWxOb3RlIHtcbiAgbGV0IHRleHQgPSB0cy5mbGF0dGVuRGlhZ25vc3RpY01lc3NhZ2VUZXh0KGluZm8ubWVzc2FnZVRleHQsIGhvc3QuZ2V0TmV3TGluZSgpKTtcbiAgaWYgKHRleHRQcmVmaXgpIHtcbiAgICB0ZXh0ID0gdGV4dFByZWZpeCArIHRleHQ7XG4gIH1cblxuICBjb25zdCBub3RlOiBQYXJ0aWFsTm90ZSA9IHsgdGV4dCB9O1xuXG4gIGlmIChpbmZvLmZpbGUpIHtcbiAgICBub3RlLmxvY2F0aW9uID0ge1xuICAgICAgZmlsZTogaW5mby5maWxlLmZpbGVOYW1lLFxuICAgICAgbGVuZ3RoOiBpbmZvLmxlbmd0aCxcbiAgICB9O1xuXG4gICAgLy8gQ2FsY3VsYXRlIHRoZSBsaW5lL2NvbHVtbiBsb2NhdGlvbiBhbmQgZXh0cmFjdCB0aGUgZnVsbCBsaW5lIHRleHQgdGhhdCBoYXMgdGhlIGRpYWdub3N0aWNcbiAgICBpZiAoaW5mby5zdGFydCkge1xuICAgICAgY29uc3QgeyBsaW5lLCBjaGFyYWN0ZXIgfSA9IHRzLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKGluZm8uZmlsZSwgaW5mby5zdGFydCk7XG4gICAgICBub3RlLmxvY2F0aW9uLmxpbmUgPSBsaW5lICsgMTtcbiAgICAgIG5vdGUubG9jYXRpb24uY29sdW1uID0gY2hhcmFjdGVyO1xuXG4gICAgICAvLyBUaGUgc3RhcnQgcG9zaXRpb24gZm9yIHRoZSBzbGljZSBpcyB0aGUgZmlyc3QgY2hhcmFjdGVyIG9mIHRoZSBlcnJvciBsaW5lXG4gICAgICBjb25zdCBsaW5lU3RhcnRQb3NpdGlvbiA9IHRzLmdldFBvc2l0aW9uT2ZMaW5lQW5kQ2hhcmFjdGVyKGluZm8uZmlsZSwgbGluZSwgMCk7XG5cbiAgICAgIC8vIFRoZSBlbmQgcG9zaXRpb24gZm9yIHRoZSBzbGljZSBpcyB0aGUgZmlyc3QgY2hhcmFjdGVyIG9mIHRoZSBuZXh0IGxpbmUgb3IgdGhlIGxlbmd0aCBvZlxuICAgICAgLy8gdGhlIGVudGlyZSBmaWxlIGlmIHRoZSBsaW5lIGlzIHRoZSBsYXN0IGxpbmUgb2YgdGhlIGZpbGUgKGdldFBvc2l0aW9uT2ZMaW5lQW5kQ2hhcmFjdGVyXG4gICAgICAvLyB3aWxsIGVycm9yIGlmIGEgbm9uZXhpc3RlbnQgbGluZSBpcyBwYXNzZWQpLlxuICAgICAgY29uc3QgeyBsaW5lOiBsYXN0TGluZU9mRmlsZSB9ID0gdHMuZ2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24oXG4gICAgICAgIGluZm8uZmlsZSxcbiAgICAgICAgaW5mby5maWxlLnRleHQubGVuZ3RoIC0gMSxcbiAgICAgICk7XG4gICAgICBjb25zdCBsaW5lRW5kUG9zaXRpb24gPVxuICAgICAgICBsaW5lIDwgbGFzdExpbmVPZkZpbGVcbiAgICAgICAgICA/IHRzLmdldFBvc2l0aW9uT2ZMaW5lQW5kQ2hhcmFjdGVyKGluZm8uZmlsZSwgbGluZSArIDEsIDApXG4gICAgICAgICAgOiBpbmZvLmZpbGUudGV4dC5sZW5ndGg7XG5cbiAgICAgIG5vdGUubG9jYXRpb24ubGluZVRleHQgPSBpbmZvLmZpbGUudGV4dC5zbGljZShsaW5lU3RhcnRQb3NpdGlvbiwgbGluZUVuZFBvc2l0aW9uKS50cmltRW5kKCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5vdGU7XG59XG5cbi8qKlxuICogQ29udmVydHMgYSBUeXBlU2NyaXB0IERpYWdub3N0aWMgbWVzc2FnZSBpbnRvIGFuIGVzYnVpbGQgY29tcGF0aWJsZSBtZXNzYWdlIG9iamVjdC5cbiAqIEBwYXJhbSBkaWFnbm9zdGljIFRoZSBUeXBlU2NyaXB0IGRpYWdub3N0aWMgdG8gY29udmVydC5cbiAqIEBwYXJhbSBob3N0IEEgVHlwZVNjcmlwdCBGb3JtYXREaWFnbm9zdGljc0hvc3QgaW5zdGFuY2UgdG8gdXNlIGR1cmluZyBjb252ZXJzaW9uLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBkaWFnbm9zdGljIG1lc3NhZ2UgYXMgYSBQYXJ0aWFsTWVzc2FnZSBvYmplY3RcbiAqL1xuZnVuY3Rpb24gY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljKFxuICBkaWFnbm9zdGljOiB0cy5EaWFnbm9zdGljLFxuICBob3N0OiB0cy5Gb3JtYXREaWFnbm9zdGljc0hvc3QsXG4pOiBQYXJ0aWFsTWVzc2FnZSB7XG4gIGxldCBjb2RlUHJlZml4ID0gJ1RTJztcbiAgbGV0IGNvZGUgPSBgJHtkaWFnbm9zdGljLmNvZGV9YDtcbiAgaWYgKGRpYWdub3N0aWMuc291cmNlID09PSAnbmd0c2MnKSB7XG4gICAgY29kZVByZWZpeCA9ICdORyc7XG4gICAgLy8gUmVtb3ZlIGAtOTlgIEFuZ3VsYXIgcHJlZml4IGZyb20gZGlhZ25vc3RpYyBjb2RlXG4gICAgY29kZSA9IGNvZGUuc2xpY2UoMyk7XG4gIH1cblxuICBjb25zdCBtZXNzYWdlOiBQYXJ0aWFsTWVzc2FnZSA9IHtcbiAgICAuLi5jb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWNJbmZvKGRpYWdub3N0aWMsIGhvc3QsIGAke2NvZGVQcmVmaXh9JHtjb2RlfTogYCksXG4gICAgLy8gU3RvcmUgb3JpZ2luYWwgZGlhZ25vc3RpYyBmb3IgcmVmZXJlbmNlIGlmIG5lZWRlZCBkb3duc3RyZWFtXG4gICAgZGV0YWlsOiBkaWFnbm9zdGljLFxuICB9O1xuXG4gIGlmIChkaWFnbm9zdGljLnJlbGF0ZWRJbmZvcm1hdGlvbj8ubGVuZ3RoKSB7XG4gICAgbWVzc2FnZS5ub3RlcyA9IGRpYWdub3N0aWMucmVsYXRlZEluZm9ybWF0aW9uLm1hcCgoaW5mbykgPT5cbiAgICAgIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oaW5mbywgaG9zdCksXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBtZXNzYWdlO1xufVxuXG5jb25zdCBVU0lOR19XSU5ET1dTID0gcGxhdGZvcm0oKSA9PT0gJ3dpbjMyJztcbmNvbnN0IFdJTkRPV1NfU0VQX1JFR0VYUCA9IG5ldyBSZWdFeHAoYFxcXFwke3BhdGgud2luMzIuc2VwfWAsICdnJyk7XG5cbmV4cG9ydCBjbGFzcyBTb3VyY2VGaWxlQ2FjaGUgZXh0ZW5kcyBNYXA8c3RyaW5nLCB0cy5Tb3VyY2VGaWxlPiB7XG4gIHJlYWRvbmx5IG1vZGlmaWVkRmlsZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcmVhZG9ubHkgYmFiZWxGaWxlQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgVWludDhBcnJheT4oKTtcbiAgcmVhZG9ubHkgdHlwZVNjcmlwdEZpbGVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBVaW50OEFycmF5PigpO1xuXG4gIGludmFsaWRhdGUoZmlsZXM6IEl0ZXJhYmxlPHN0cmluZz4pOiB2b2lkIHtcbiAgICB0aGlzLm1vZGlmaWVkRmlsZXMuY2xlYXIoKTtcbiAgICBmb3IgKGxldCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICB0aGlzLmJhYmVsRmlsZUNhY2hlLmRlbGV0ZShmaWxlKTtcbiAgICAgIHRoaXMudHlwZVNjcmlwdEZpbGVDYWNoZS5kZWxldGUocGF0aFRvRmlsZVVSTChmaWxlKS5ocmVmKTtcblxuICAgICAgLy8gTm9ybWFsaXplIHNlcGFyYXRvcnMgdG8gYWxsb3cgbWF0Y2hpbmcgVHlwZVNjcmlwdCBIb3N0IHBhdGhzXG4gICAgICBpZiAoVVNJTkdfV0lORE9XUykge1xuICAgICAgICBmaWxlID0gZmlsZS5yZXBsYWNlKFdJTkRPV1NfU0VQX1JFR0VYUCwgcGF0aC5wb3NpeC5zZXApO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmRlbGV0ZShmaWxlKTtcbiAgICAgIHRoaXMubW9kaWZpZWRGaWxlcy5hZGQoZmlsZSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZXJQbHVnaW5PcHRpb25zIHtcbiAgc291cmNlbWFwOiBib29sZWFuO1xuICB0c2NvbmZpZzogc3RyaW5nO1xuICBhZHZhbmNlZE9wdGltaXphdGlvbnM/OiBib29sZWFuO1xuICB0aGlyZFBhcnR5U291cmNlbWFwcz86IGJvb2xlYW47XG4gIGZpbGVSZXBsYWNlbWVudHM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGU7XG59XG5cbi8vIFRoaXMgaXMgYSBub24td2F0Y2ggdmVyc2lvbiBvZiB0aGUgY29tcGlsZXIgY29kZSBmcm9tIGBAbmd0b29scy93ZWJwYWNrYCBhdWdtZW50ZWQgZm9yIGVzYnVpbGRcbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gIHBsdWdpbk9wdGlvbnM6IENvbXBpbGVyUGx1Z2luT3B0aW9ucyxcbiAgc3R5bGVPcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbik6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItY29tcGlsZXInLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG4gICAgYXN5bmMgc2V0dXAoYnVpbGQ6IFBsdWdpbkJ1aWxkKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICBsZXQgc2V0dXBXYXJuaW5nczogUGFydGlhbE1lc3NhZ2VbXSB8IHVuZGVmaW5lZDtcblxuICAgICAgLy8gVGhpcyB1c2VzIGEgd3JhcHBlZCBkeW5hbWljIGltcG9ydCB0byBsb2FkIGBAYW5ndWxhci9jb21waWxlci1jbGlgIHdoaWNoIGlzIEVTTS5cbiAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciByZXRhaW5pbmcgZHluYW1pYyBpbXBvcnRzIHRoaXMgd29ya2Fyb3VuZCBjYW4gYmUgZHJvcHBlZC5cbiAgICAgIGNvbnN0IHsgR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCwgTmd0c2NQcm9ncmFtLCBPcHRpbWl6ZUZvciwgcmVhZENvbmZpZ3VyYXRpb24gfSA9XG4gICAgICAgIGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk+KCdAYW5ndWxhci9jb21waWxlci1jbGknKTtcblxuICAgICAgLy8gVGVtcG9yYXJ5IGRlZXAgaW1wb3J0IGZvciB0cmFuc2Zvcm1lciBzdXBwb3J0XG4gICAgICBjb25zdCB7XG4gICAgICAgIG1lcmdlVHJhbnNmb3JtZXJzLFxuICAgICAgICByZXBsYWNlQm9vdHN0cmFwLFxuICAgICAgfSA9IHJlcXVpcmUoJ0BuZ3Rvb2xzL3dlYnBhY2svc3JjL2l2eS90cmFuc2Zvcm1hdGlvbicpO1xuXG4gICAgICAvLyBTZXR1cCBkZWZpbmVzIGJhc2VkIG9uIHRoZSB2YWx1ZXMgcHJvdmlkZWQgYnkgdGhlIEFuZ3VsYXIgY29tcGlsZXItY2xpXG4gICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUgPz89IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCkpIHtcbiAgICAgICAgaWYgKGtleSBpbiBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUpIHtcbiAgICAgICAgICAvLyBTa2lwIGtleXMgdGhhdCBoYXZlIGJlZW4gbWFudWFsbHkgcHJvdmlkZWRcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBlc2J1aWxkIHJlcXVpcmVzIHZhbHVlcyB0byBiZSBhIHN0cmluZyAoYWN0dWFsIHN0cmluZ3MgbmVlZCB0byBiZSBxdW90ZWQpLlxuICAgICAgICAvLyBJbiB0aGlzIGNhc2UsIGFsbCBwcm92aWRlZCB2YWx1ZXMgYXJlIGJvb2xlYW5zLlxuICAgICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmVba2V5XSA9IHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSB0c2NvbmZpZyBpcyBsb2FkZWQgaW4gc2V0dXAgaW5zdGVhZCBvZiBpbiBzdGFydCB0byBhbGxvdyB0aGUgZXNidWlsZCB0YXJnZXQgYnVpbGQgb3B0aW9uIHRvIGJlIG1vZGlmaWVkLlxuICAgICAgLy8gZXNidWlsZCBidWlsZCBvcHRpb25zIGNhbiBvbmx5IGJlIG1vZGlmaWVkIGluIHNldHVwIHByaW9yIHRvIHN0YXJ0aW5nIHRoZSBidWlsZC5cbiAgICAgIGNvbnN0IHtcbiAgICAgICAgb3B0aW9uczogY29tcGlsZXJPcHRpb25zLFxuICAgICAgICByb290TmFtZXMsXG4gICAgICAgIGVycm9yczogY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgICAgfSA9IHByb2ZpbGVTeW5jKCdOR19SRUFEX0NPTkZJRycsICgpID0+XG4gICAgICAgIHJlYWRDb25maWd1cmF0aW9uKHBsdWdpbk9wdGlvbnMudHNjb25maWcsIHtcbiAgICAgICAgICBub0VtaXRPbkVycm9yOiBmYWxzZSxcbiAgICAgICAgICBzdXBwcmVzc091dHB1dFBhdGhDaGVjazogdHJ1ZSxcbiAgICAgICAgICBvdXREaXI6IHVuZGVmaW5lZCxcbiAgICAgICAgICBpbmxpbmVTb3VyY2VzOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICBpbmxpbmVTb3VyY2VNYXA6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgIHNvdXJjZU1hcDogZmFsc2UsXG4gICAgICAgICAgbWFwUm9vdDogdW5kZWZpbmVkLFxuICAgICAgICAgIHNvdXJjZVJvb3Q6IHVuZGVmaW5lZCxcbiAgICAgICAgICBkZWNsYXJhdGlvbjogZmFsc2UsXG4gICAgICAgICAgZGVjbGFyYXRpb25NYXA6IGZhbHNlLFxuICAgICAgICAgIGFsbG93RW1wdHlDb2RlZ2VuRmlsZXM6IGZhbHNlLFxuICAgICAgICAgIGFubm90YXRpb25zQXM6ICdkZWNvcmF0b3JzJyxcbiAgICAgICAgICBlbmFibGVSZXNvdXJjZUlubGluaW5nOiBmYWxzZSxcbiAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgICBpZiAoY29tcGlsZXJPcHRpb25zLnRhcmdldCA9PT0gdW5kZWZpbmVkIHx8IGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPCB0cy5TY3JpcHRUYXJnZXQuRVMyMDIyKSB7XG4gICAgICAgIC8vIElmICd1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkcycgaXMgYWxyZWFkeSBkZWZpbmVkIGluIHRoZSB1c2VycyBwcm9qZWN0IGxlYXZlIHRoZSB2YWx1ZSBhcyBpcy5cbiAgICAgICAgLy8gT3RoZXJ3aXNlIGZhbGxiYWNrIHRvIGZhbHNlIGR1ZSB0byBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzQ1OTk1XG4gICAgICAgIC8vIHdoaWNoIGJyZWFrcyB0aGUgZGVwcmVjYXRlZCBgQEVmZmVjdHNgIE5HUlggZGVjb3JhdG9yIGFuZCBwb3RlbnRpYWxseSBvdGhlciBleGlzdGluZyBjb2RlIGFzIHdlbGwuXG4gICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPSB0cy5TY3JpcHRUYXJnZXQuRVMyMDIyO1xuICAgICAgICBjb21waWxlck9wdGlvbnMudXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHMgPz89IGZhbHNlO1xuXG4gICAgICAgIChzZXR1cFdhcm5pbmdzID8/PSBbXSkucHVzaCh7XG4gICAgICAgICAgdGV4dDpcbiAgICAgICAgICAgICdUeXBlU2NyaXB0IGNvbXBpbGVyIG9wdGlvbnMgXCJ0YXJnZXRcIiBhbmQgXCJ1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkc1wiIGFyZSBzZXQgdG8gXCJFUzIwMjJcIiBhbmQgJyArXG4gICAgICAgICAgICAnXCJmYWxzZVwiIHJlc3BlY3RpdmVseSBieSB0aGUgQW5ndWxhciBDTEkuJyxcbiAgICAgICAgICBsb2NhdGlvbjogeyBmaWxlOiBwbHVnaW5PcHRpb25zLnRzY29uZmlnIH0sXG4gICAgICAgICAgbm90ZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdGV4dDpcbiAgICAgICAgICAgICAgICAnVG8gY29udHJvbCBFQ01BIHZlcnNpb24gYW5kIGZlYXR1cmVzIHVzZSB0aGUgQnJvd2Vyc2xpc3QgY29uZmlndXJhdGlvbi4gJyArXG4gICAgICAgICAgICAgICAgJ0ZvciBtb3JlIGluZm9ybWF0aW9uLCBzZWUgaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2J1aWxkI2NvbmZpZ3VyaW5nLWJyb3dzZXItY29tcGF0aWJpbGl0eScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgZmlsZSBlbWl0dGVyIGNyZWF0ZWQgZHVyaW5nIGBvblN0YXJ0YCB0aGF0IHdpbGwgYmUgdXNlZCBkdXJpbmcgdGhlIGJ1aWxkIGluIGBvbkxvYWRgIGNhbGxiYWNrcyBmb3IgVFMgZmlsZXNcbiAgICAgIGxldCBmaWxlRW1pdHRlcjogRmlsZUVtaXR0ZXIgfCB1bmRlZmluZWQ7XG5cbiAgICAgIC8vIFRoZSBzdHlsZXNoZWV0IHJlc291cmNlcyBmcm9tIGNvbXBvbmVudCBzdHlsZXNoZWV0cyB0aGF0IHdpbGwgYmUgYWRkZWQgdG8gdGhlIGJ1aWxkIHJlc3VsdHMgb3V0cHV0IGZpbGVzXG4gICAgICBsZXQgc3R5bGVzaGVldFJlc291cmNlRmlsZXM6IE91dHB1dEZpbGVbXTtcblxuICAgICAgbGV0IHByZXZpb3VzQnVpbGRlcjogdHMuRW1pdEFuZFNlbWFudGljRGlhZ25vc3RpY3NCdWlsZGVyUHJvZ3JhbSB8IHVuZGVmaW5lZDtcbiAgICAgIGxldCBwcmV2aW91c0FuZ3VsYXJQcm9ncmFtOiBOZ3RzY1Byb2dyYW0gfCB1bmRlZmluZWQ7XG4gICAgICBjb25zdCBiYWJlbERhdGFDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBVaW50OEFycmF5PigpO1xuICAgICAgY29uc3QgZGlhZ25vc3RpY0NhY2hlID0gbmV3IFdlYWtNYXA8dHMuU291cmNlRmlsZSwgdHMuRGlhZ25vc3RpY1tdPigpO1xuXG4gICAgICBidWlsZC5vblN0YXJ0KGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0OiBPblN0YXJ0UmVzdWx0ID0ge1xuICAgICAgICAgIHdhcm5pbmdzOiBzZXR1cFdhcm5pbmdzLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFJlc2V0IHRoZSBzZXR1cCB3YXJuaW5ncyBzbyB0aGF0IHRoZXkgYXJlIG9ubHkgc2hvd24gZHVyaW5nIHRoZSBmaXJzdCBidWlsZC5cbiAgICAgICAgc2V0dXBXYXJuaW5ncyA9IHVuZGVmaW5lZDtcblxuICAgICAgICAvLyBSZXNldCBkZWJ1ZyBwZXJmb3JtYW5jZSB0cmFja2luZ1xuICAgICAgICByZXNldEN1bXVsYXRpdmVEdXJhdGlvbnMoKTtcblxuICAgICAgICAvLyBSZXNldCBzdHlsZXNoZWV0IHJlc291cmNlIG91dHB1dCBmaWxlc1xuICAgICAgICBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyA9IFtdO1xuXG4gICAgICAgIC8vIENyZWF0ZSBBbmd1bGFyIGNvbXBpbGVyIGhvc3RcbiAgICAgICAgY29uc3QgaG9zdCA9IGNyZWF0ZUFuZ3VsYXJDb21waWxlckhvc3QoY29tcGlsZXJPcHRpb25zLCB7XG4gICAgICAgICAgZmlsZVJlcGxhY2VtZW50czogcGx1Z2luT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzLFxuICAgICAgICAgIG1vZGlmaWVkRmlsZXM6IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5tb2RpZmllZEZpbGVzLFxuICAgICAgICAgIHNvdXJjZUZpbGVDYWNoZTogcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUsXG4gICAgICAgICAgYXN5bmMgdHJhbnNmb3JtU3R5bGVzaGVldChkYXRhLCBjb250YWluaW5nRmlsZSwgc3R5bGVzaGVldEZpbGUpIHtcbiAgICAgICAgICAgIC8vIFN0eWxlc2hlZXQgZmlsZSBvbmx5IGV4aXN0cyBmb3IgZXh0ZXJuYWwgc3R5bGVzaGVldHNcbiAgICAgICAgICAgIGNvbnN0IGZpbGVuYW1lID0gc3R5bGVzaGVldEZpbGUgPz8gY29udGFpbmluZ0ZpbGU7XG5cbiAgICAgICAgICAgIC8vIFRlbXBvcmFyeSB3b3JrYXJvdW5kIGZvciBsYWNrIG9mIHZpcnR1YWwgZmlsZSBzdXBwb3J0IGluIHRoZSBTYXNzIHBsdWdpbi5cbiAgICAgICAgICAgIC8vIEV4dGVybmFsIFNhc3Mgc3R5bGVzaGVldHMgYXJlIHRyYW5zZm9ybWVkIHVzaW5nIHRoZSBmaWxlIGluc3RlYWQgb2YgdGhlIGFscmVhZHkgcmVhZCBjb250ZW50LlxuICAgICAgICAgICAgbGV0IHN0eWxlc2hlZXRSZXN1bHQ7XG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUuZW5kc1dpdGgoJy5zY3NzJykgfHwgZmlsZW5hbWUuZW5kc1dpdGgoJy5zYXNzJykpIHtcbiAgICAgICAgICAgICAgc3R5bGVzaGVldFJlc3VsdCA9IGF3YWl0IGJ1bmRsZVN0eWxlc2hlZXRGaWxlKGZpbGVuYW1lLCBzdHlsZU9wdGlvbnMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc3R5bGVzaGVldFJlc3VsdCA9IGF3YWl0IGJ1bmRsZVN0eWxlc2hlZXRUZXh0KFxuICAgICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgcmVzb2x2ZVBhdGg6IHBhdGguZGlybmFtZShmaWxlbmFtZSksXG4gICAgICAgICAgICAgICAgICB2aXJ0dWFsTmFtZTogZmlsZW5hbWUsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHsgY29udGVudHMsIHJlc291cmNlRmlsZXMsIGVycm9ycywgd2FybmluZ3MgfSA9IHN0eWxlc2hlZXRSZXN1bHQ7XG4gICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgICAgIHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLnB1c2goLi4ucmVzb3VyY2VGaWxlcyk7XG5cbiAgICAgICAgICAgIHJldHVybiBjb250ZW50cztcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBDcmVhdGUgdGhlIEFuZ3VsYXIgc3BlY2lmaWMgcHJvZ3JhbSB0aGF0IGNvbnRhaW5zIHRoZSBBbmd1bGFyIGNvbXBpbGVyXG4gICAgICAgIGNvbnN0IGFuZ3VsYXJQcm9ncmFtID0gcHJvZmlsZVN5bmMoXG4gICAgICAgICAgJ05HX0NSRUFURV9QUk9HUkFNJyxcbiAgICAgICAgICAoKSA9PiBuZXcgTmd0c2NQcm9ncmFtKHJvb3ROYW1lcywgY29tcGlsZXJPcHRpb25zLCBob3N0LCBwcmV2aW91c0FuZ3VsYXJQcm9ncmFtKSxcbiAgICAgICAgKTtcbiAgICAgICAgcHJldmlvdXNBbmd1bGFyUHJvZ3JhbSA9IGFuZ3VsYXJQcm9ncmFtO1xuICAgICAgICBjb25zdCBhbmd1bGFyQ29tcGlsZXIgPSBhbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgICAgICAgY29uc3QgdHlwZVNjcmlwdFByb2dyYW0gPSBhbmd1bGFyUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKTtcbiAgICAgICAgZW5zdXJlU291cmNlRmlsZVZlcnNpb25zKHR5cGVTY3JpcHRQcm9ncmFtKTtcblxuICAgICAgICBjb25zdCBidWlsZGVyID0gdHMuY3JlYXRlRW1pdEFuZFNlbWFudGljRGlhZ25vc3RpY3NCdWlsZGVyUHJvZ3JhbShcbiAgICAgICAgICB0eXBlU2NyaXB0UHJvZ3JhbSxcbiAgICAgICAgICBob3N0LFxuICAgICAgICAgIHByZXZpb3VzQnVpbGRlcixcbiAgICAgICAgICBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3MsXG4gICAgICAgICk7XG4gICAgICAgIHByZXZpb3VzQnVpbGRlciA9IGJ1aWxkZXI7XG5cbiAgICAgICAgYXdhaXQgcHJvZmlsZUFzeW5jKCdOR19BTkFMWVpFX1BST0dSQU0nLCAoKSA9PiBhbmd1bGFyQ29tcGlsZXIuYW5hbHl6ZUFzeW5jKCkpO1xuICAgICAgICBjb25zdCBhZmZlY3RlZEZpbGVzID0gcHJvZmlsZVN5bmMoJ05HX0ZJTkRfQUZGRUNURUQnLCAoKSA9PlxuICAgICAgICAgIGZpbmRBZmZlY3RlZEZpbGVzKGJ1aWxkZXIsIGFuZ3VsYXJDb21waWxlciksXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBhZmZlY3RlZCBvZiBhZmZlY3RlZEZpbGVzKSB7XG4gICAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZS50eXBlU2NyaXB0RmlsZUNhY2hlLmRlbGV0ZShcbiAgICAgICAgICAgICAgcGF0aFRvRmlsZVVSTChhZmZlY3RlZC5maWxlTmFtZSkuaHJlZixcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24qIGNvbGxlY3REaWFnbm9zdGljcygpOiBJdGVyYWJsZTx0cy5EaWFnbm9zdGljPiB7XG4gICAgICAgICAgLy8gQ29sbGVjdCBwcm9ncmFtIGxldmVsIGRpYWdub3N0aWNzXG4gICAgICAgICAgeWllbGQqIGJ1aWxkZXIuZ2V0Q29uZmlnRmlsZVBhcnNpbmdEaWFnbm9zdGljcygpO1xuICAgICAgICAgIHlpZWxkKiBhbmd1bGFyQ29tcGlsZXIuZ2V0T3B0aW9uRGlhZ25vc3RpY3MoKTtcbiAgICAgICAgICB5aWVsZCogYnVpbGRlci5nZXRPcHRpb25zRGlhZ25vc3RpY3MoKTtcbiAgICAgICAgICB5aWVsZCogYnVpbGRlci5nZXRHbG9iYWxEaWFnbm9zdGljcygpO1xuXG4gICAgICAgICAgLy8gQ29sbGVjdCBzb3VyY2UgZmlsZSBzcGVjaWZpYyBkaWFnbm9zdGljc1xuICAgICAgICAgIGNvbnN0IG9wdGltaXplRm9yID1cbiAgICAgICAgICAgIGFmZmVjdGVkRmlsZXMuc2l6ZSA+IDEgPyBPcHRpbWl6ZUZvci5XaG9sZVByb2dyYW0gOiBPcHRpbWl6ZUZvci5TaW5nbGVGaWxlO1xuICAgICAgICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiBidWlsZGVyLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBUeXBlU2NyaXB0IHdpbGwgdXNlIGNhY2hlZCBkaWFnbm9zdGljcyBmb3IgZmlsZXMgdGhhdCBoYXZlIG5vdCBiZWVuXG4gICAgICAgICAgICAvLyBjaGFuZ2VkIG9yIGFmZmVjdGVkIGZvciB0aGlzIGJ1aWxkIHdoZW4gdXNpbmcgaW5jcmVtZW50YWwgYnVpbGRpbmcuXG4gICAgICAgICAgICB5aWVsZCogcHJvZmlsZVN5bmMoXG4gICAgICAgICAgICAgICdOR19ESUFHTk9TVElDU19TWU5UQUNUSUMnLFxuICAgICAgICAgICAgICAoKSA9PiBidWlsZGVyLmdldFN5bnRhY3RpY0RpYWdub3N0aWNzKHNvdXJjZUZpbGUpLFxuICAgICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHlpZWxkKiBwcm9maWxlU3luYyhcbiAgICAgICAgICAgICAgJ05HX0RJQUdOT1NUSUNTX1NFTUFOVElDJyxcbiAgICAgICAgICAgICAgKCkgPT4gYnVpbGRlci5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKHNvdXJjZUZpbGUpLFxuICAgICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gRGVjbGFyYXRpb24gZmlsZXMgY2Fubm90IGhhdmUgdGVtcGxhdGUgZGlhZ25vc3RpY3NcbiAgICAgICAgICAgIGlmIChzb3VyY2VGaWxlLmlzRGVjbGFyYXRpb25GaWxlKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBPbmx5IHJlcXVlc3QgQW5ndWxhciB0ZW1wbGF0ZSBkaWFnbm9zdGljcyBmb3IgYWZmZWN0ZWQgZmlsZXMgdG8gYXZvaWRcbiAgICAgICAgICAgIC8vIG92ZXJoZWFkIG9mIHRlbXBsYXRlIGRpYWdub3N0aWNzIGZvciB1bmNoYW5nZWQgZmlsZXMuXG4gICAgICAgICAgICBpZiAoYWZmZWN0ZWRGaWxlcy5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gcHJvZmlsZVN5bmMoXG4gICAgICAgICAgICAgICAgJ05HX0RJQUdOT1NUSUNTX1RFTVBMQVRFJyxcbiAgICAgICAgICAgICAgICAoKSA9PiBhbmd1bGFyQ29tcGlsZXIuZ2V0RGlhZ25vc3RpY3NGb3JGaWxlKHNvdXJjZUZpbGUsIG9wdGltaXplRm9yKSxcbiAgICAgICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBkaWFnbm9zdGljQ2FjaGUuc2V0KHNvdXJjZUZpbGUsIGFuZ3VsYXJEaWFnbm9zdGljcyk7XG4gICAgICAgICAgICAgIHlpZWxkKiBhbmd1bGFyRGlhZ25vc3RpY3M7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb25zdCBhbmd1bGFyRGlhZ25vc3RpY3MgPSBkaWFnbm9zdGljQ2FjaGUuZ2V0KHNvdXJjZUZpbGUpO1xuICAgICAgICAgICAgICBpZiAoYW5ndWxhckRpYWdub3N0aWNzKSB7XG4gICAgICAgICAgICAgICAgeWllbGQqIGFuZ3VsYXJEaWFnbm9zdGljcztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHByb2ZpbGVTeW5jKCdOR19ESUFHTk9TVElDU19UT1RBTCcsICgpID0+IHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGRpYWdub3N0aWMgb2YgY29sbGVjdERpYWdub3N0aWNzKCkpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWMoZGlhZ25vc3RpYywgaG9zdCk7XG4gICAgICAgICAgICBpZiAoZGlhZ25vc3RpYy5jYXRlZ29yeSA9PT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKSB7XG4gICAgICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaChtZXNzYWdlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgZmlsZUVtaXR0ZXIgPSBjcmVhdGVGaWxlRW1pdHRlcihcbiAgICAgICAgICBidWlsZGVyLFxuICAgICAgICAgIG1lcmdlVHJhbnNmb3JtZXJzKGFuZ3VsYXJDb21waWxlci5wcmVwYXJlRW1pdCgpLnRyYW5zZm9ybWVycywge1xuICAgICAgICAgICAgYmVmb3JlOiBbcmVwbGFjZUJvb3RzdHJhcCgoKSA9PiBidWlsZGVyLmdldFByb2dyYW0oKS5nZXRUeXBlQ2hlY2tlcigpKV0sXG4gICAgICAgICAgfSksXG4gICAgICAgICAgKHNvdXJjZUZpbGUpID0+IGFuZ3VsYXJDb21waWxlci5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLnJlY29yZFN1Y2Nlc3NmdWxFbWl0KHNvdXJjZUZpbGUpLFxuICAgICAgICApO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKFxuICAgICAgICB7IGZpbHRlcjogY29tcGlsZXJPcHRpb25zLmFsbG93SnMgPyAvXFwuW2NtXT9banRdc3g/JC8gOiAvXFwuW2NtXT90c3g/JC8gfSxcbiAgICAgICAgKGFyZ3MpID0+XG4gICAgICAgICAgcHJvZmlsZUFzeW5jKFxuICAgICAgICAgICAgJ05HX0VNSVRfVFMqJyxcbiAgICAgICAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgYXNzZXJ0Lm9rKGZpbGVFbWl0dGVyLCAnSW52YWxpZCBwbHVnaW4gZXhlY3V0aW9uIG9yZGVyJyk7XG5cbiAgICAgICAgICAgICAgY29uc3QgcmVxdWVzdCA9IHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cz8uW2FyZ3MucGF0aF0gPz8gYXJncy5wYXRoO1xuXG4gICAgICAgICAgICAgIC8vIFRoZSBmaWxlbmFtZSBpcyBjdXJyZW50bHkgdXNlZCBhcyBhIGNhY2hlIGtleS4gU2luY2UgdGhlIGNhY2hlIGlzIG1lbW9yeSBvbmx5LFxuICAgICAgICAgICAgICAvLyB0aGUgb3B0aW9ucyBjYW5ub3QgY2hhbmdlIGFuZCBkbyBub3QgbmVlZCB0byBiZSByZXByZXNlbnRlZCBpbiB0aGUga2V5LiBJZiB0aGVcbiAgICAgICAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAgICAgICAvLyB3b3VsZCBuZWVkIHRvIGJlIGFkZGVkIHRvIHRoZSBrZXkgYXMgd2VsbCBhcyBhIGNoZWNrIGZvciBhbnkgY2hhbmdlIG9mIGNvbnRlbnQuXG4gICAgICAgICAgICAgIGxldCBjb250ZW50cyA9IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy50eXBlU2NyaXB0RmlsZUNhY2hlLmdldChcbiAgICAgICAgICAgICAgICBwYXRoVG9GaWxlVVJMKHJlcXVlc3QpLmhyZWYsXG4gICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0eXBlc2NyaXB0UmVzdWx0ID0gYXdhaXQgZmlsZUVtaXR0ZXIocmVxdWVzdCk7XG4gICAgICAgICAgICAgICAgaWYgKCF0eXBlc2NyaXB0UmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAvLyBObyBUUyByZXN1bHQgaW5kaWNhdGVzIHRoZSBmaWxlIGlzIG5vdCBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0uXG4gICAgICAgICAgICAgICAgICAvLyBJZiBhbGxvd0pzIGlzIGVuYWJsZWQgYW5kIHRoZSBmaWxlIGlzIEpTIHRoZW4gZGVmZXIgdG8gdGhlIG5leHQgbG9hZCBob29rLlxuICAgICAgICAgICAgICAgICAgaWYgKGNvbXBpbGVyT3B0aW9ucy5hbGxvd0pzICYmIC9cXC5bY21dP2pzJC8udGVzdChyZXF1ZXN0KSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAvLyBPdGhlcndpc2UgcmV0dXJuIGFuIGVycm9yXG4gICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVNaXNzaW5nRmlsZUVycm9yKFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3MucGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIgPz8gJycsXG4gICAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IHR5cGVzY3JpcHRSZXN1bHQuY29udGVudCA/PyAnJztcbiAgICAgICAgICAgICAgICAvLyBUaGUgcHJlLXRyYW5zZm9ybWVkIGRhdGEgaXMgdXNlZCBhcyBhIGNhY2hlIGtleS4gU2luY2UgdGhlIGNhY2hlIGlzIG1lbW9yeSBvbmx5LFxuICAgICAgICAgICAgICAgIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAgICAgICAgICAgICAgIC8vIGNhY2hlIGlzIGxhdGVyIHN0b3JlZCB0byBkaXNrLCB0aGVuIHRoZSBvcHRpb25zIHRoYXQgYWZmZWN0IHRyYW5zZm9ybSBvdXRwdXRcbiAgICAgICAgICAgICAgICAvLyB3b3VsZCBuZWVkIHRvIGJlIGFkZGVkIHRvIHRoZSBrZXkgYXMgd2VsbC5cbiAgICAgICAgICAgICAgICBjb250ZW50cyA9IGJhYmVsRGF0YUNhY2hlLmdldChkYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAoY29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgY29uc3QgdHJhbnNmb3JtZWREYXRhID0gYXdhaXQgdHJhbnNmb3JtV2l0aEJhYmVsKHJlcXVlc3QsIGRhdGEsIHBsdWdpbk9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgY29udGVudHMgPSBCdWZmZXIuZnJvbSh0cmFuc2Zvcm1lZERhdGEsICd1dGYtOCcpO1xuICAgICAgICAgICAgICAgICAgYmFiZWxEYXRhQ2FjaGUuc2V0KGRhdGEsIGNvbnRlbnRzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8udHlwZVNjcmlwdEZpbGVDYWNoZS5zZXQoXG4gICAgICAgICAgICAgICAgICBwYXRoVG9GaWxlVVJMKHJlcXVlc3QpLmhyZWYsXG4gICAgICAgICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICApLFxuICAgICAgKTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9qcyQvIH0sIChhcmdzKSA9PlxuICAgICAgICBwcm9maWxlQXN5bmMoXG4gICAgICAgICAgJ05HX0VNSVRfSlMqJyxcbiAgICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAvLyBUaGUgZmlsZW5hbWUgaXMgY3VycmVudGx5IHVzZWQgYXMgYSBjYWNoZSBrZXkuIFNpbmNlIHRoZSBjYWNoZSBpcyBtZW1vcnkgb25seSxcbiAgICAgICAgICAgIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAgICAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAgICAgLy8gd291bGQgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUga2V5IGFzIHdlbGwgYXMgYSBjaGVjayBmb3IgYW55IGNoYW5nZSBvZiBjb250ZW50LlxuICAgICAgICAgICAgbGV0IGNvbnRlbnRzID0gcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LmJhYmVsRmlsZUNhY2hlLmdldChhcmdzLnBhdGgpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGZzLnJlYWRGaWxlKGFyZ3MucGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgICAgICAgIGNvbnN0IHRyYW5zZm9ybWVkRGF0YSA9IGF3YWl0IHRyYW5zZm9ybVdpdGhCYWJlbChhcmdzLnBhdGgsIGRhdGEsIHBsdWdpbk9wdGlvbnMpO1xuICAgICAgICAgICAgICBjb250ZW50cyA9IEJ1ZmZlci5mcm9tKHRyYW5zZm9ybWVkRGF0YSwgJ3V0Zi04Jyk7XG4gICAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5iYWJlbEZpbGVDYWNoZS5zZXQoYXJncy5wYXRoLCBjb250ZW50cyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKSxcbiAgICAgICk7XG5cbiAgICAgIGJ1aWxkLm9uRW5kKChyZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLmxlbmd0aCkge1xuICAgICAgICAgIHJlc3VsdC5vdXRwdXRGaWxlcz8ucHVzaCguLi5zdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyk7XG4gICAgICAgIH1cblxuICAgICAgICBsb2dDdW11bGF0aXZlRHVyYXRpb25zKCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVGaWxlRW1pdHRlcihcbiAgcHJvZ3JhbTogdHMuQnVpbGRlclByb2dyYW0sXG4gIHRyYW5zZm9ybWVyczogdHMuQ3VzdG9tVHJhbnNmb3JtZXJzID0ge30sXG4gIG9uQWZ0ZXJFbWl0PzogKHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUpID0+IHZvaWQsXG4pOiBGaWxlRW1pdHRlciB7XG4gIHJldHVybiBhc3luYyAoZmlsZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgc291cmNlRmlsZSA9IHByb2dyYW0uZ2V0U291cmNlRmlsZShmaWxlKTtcbiAgICBpZiAoIXNvdXJjZUZpbGUpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgbGV0IGNvbnRlbnQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBwcm9ncmFtLmVtaXQoXG4gICAgICBzb3VyY2VGaWxlLFxuICAgICAgKGZpbGVuYW1lLCBkYXRhKSA9PiB7XG4gICAgICAgIGlmICgvXFwuW2NtXT9qcyQvLnRlc3QoZmlsZW5hbWUpKSB7XG4gICAgICAgICAgY29udGVudCA9IGRhdGE7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB1bmRlZmluZWQgLyogY2FuY2VsbGF0aW9uVG9rZW4gKi8sXG4gICAgICB1bmRlZmluZWQgLyogZW1pdE9ubHlEdHNGaWxlcyAqLyxcbiAgICAgIHRyYW5zZm9ybWVycyxcbiAgICApO1xuXG4gICAgb25BZnRlckVtaXQ/Lihzb3VyY2VGaWxlKTtcblxuICAgIHJldHVybiB7IGNvbnRlbnQsIGRlcGVuZGVuY2llczogW10gfTtcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdHJhbnNmb3JtV2l0aEJhYmVsKFxuICBmaWxlbmFtZTogc3RyaW5nLFxuICBkYXRhOiBzdHJpbmcsXG4gIHBsdWdpbk9wdGlvbnM6IENvbXBpbGVyUGx1Z2luT3B0aW9ucyxcbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IGZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbiA9XG4gICAgIS9bXFxcXC9dW19mXT9lc20yMDE1W1xcXFwvXS8udGVzdChmaWxlbmFtZSkgJiYgL2FzeW5jXFxzK2Z1bmN0aW9uXFxzKlxcKi8udGVzdChkYXRhKTtcbiAgY29uc3Qgc2hvdWxkTGluayA9IGF3YWl0IHJlcXVpcmVzTGlua2luZyhmaWxlbmFtZSwgZGF0YSk7XG4gIGNvbnN0IHVzZUlucHV0U291cmNlbWFwID1cbiAgICBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCAmJlxuICAgICghIXBsdWdpbk9wdGlvbnMudGhpcmRQYXJ0eVNvdXJjZW1hcHMgfHwgIS9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS8udGVzdChmaWxlbmFtZSkpO1xuXG4gIC8vIElmIG5vIGFkZGl0aW9uYWwgdHJhbnNmb3JtYXRpb25zIGFyZSBuZWVkZWQsIHJldHVybiB0aGUgZGF0YSBkaXJlY3RseVxuICBpZiAoIWZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbiAmJiAhcGx1Z2luT3B0aW9ucy5hZHZhbmNlZE9wdGltaXphdGlvbnMgJiYgIXNob3VsZExpbmspIHtcbiAgICAvLyBTdHJpcCBzb3VyY2VtYXBzIGlmIHRoZXkgc2hvdWxkIG5vdCBiZSB1c2VkXG4gICAgcmV0dXJuIHVzZUlucHV0U291cmNlbWFwID8gZGF0YSA6IGRhdGEucmVwbGFjZSgvXlxcL1xcLyMgc291cmNlTWFwcGluZ1VSTD1bXlxcclxcbl0qL2dtLCAnJyk7XG4gIH1cblxuICBjb25zdCBhbmd1bGFyUGFja2FnZSA9IC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXUBhbmd1bGFyW1xcXFwvXS8udGVzdChmaWxlbmFtZSk7XG5cbiAgY29uc3QgbGlua2VyUGx1Z2luQ3JlYXRvciA9IHNob3VsZExpbmtcbiAgICA/IChcbiAgICAgICAgYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJyk+KFxuICAgICAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJyxcbiAgICAgICAgKVxuICAgICAgKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW5cbiAgICA6IHVuZGVmaW5lZDtcblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1Bc3luYyhkYXRhLCB7XG4gICAgZmlsZW5hbWUsXG4gICAgaW5wdXRTb3VyY2VNYXA6ICh1c2VJbnB1dFNvdXJjZW1hcCA/IHVuZGVmaW5lZCA6IGZhbHNlKSBhcyB1bmRlZmluZWQsXG4gICAgc291cmNlTWFwczogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAgPyAnaW5saW5lJyA6IGZhbHNlLFxuICAgIGNvbXBhY3Q6IGZhbHNlLFxuICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIGJhYmVscmM6IGZhbHNlLFxuICAgIGJyb3dzZXJzbGlzdENvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIHBsdWdpbnM6IFtdLFxuICAgIHByZXNldHM6IFtcbiAgICAgIFtcbiAgICAgICAgYW5ndWxhckFwcGxpY2F0aW9uUHJlc2V0LFxuICAgICAgICB7XG4gICAgICAgICAgYW5ndWxhckxpbmtlcjoge1xuICAgICAgICAgICAgc2hvdWxkTGluayxcbiAgICAgICAgICAgIGppdE1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgbGlua2VyUGx1Z2luQ3JlYXRvcixcbiAgICAgICAgICB9LFxuICAgICAgICAgIGZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbixcbiAgICAgICAgICBvcHRpbWl6ZTogcGx1Z2luT3B0aW9ucy5hZHZhbmNlZE9wdGltaXphdGlvbnMgJiYge1xuICAgICAgICAgICAgbG9vc2VFbnVtczogYW5ndWxhclBhY2thZ2UsXG4gICAgICAgICAgICBwdXJlVG9wTGV2ZWw6IGFuZ3VsYXJQYWNrYWdlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIF0sXG4gIH0pO1xuXG4gIHJldHVybiByZXN1bHQ/LmNvZGUgPz8gZGF0YTtcbn1cblxuZnVuY3Rpb24gZmluZEFmZmVjdGVkRmlsZXMoXG4gIGJ1aWxkZXI6IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0sXG4gIHsgaWdub3JlRm9yRGlhZ25vc3RpY3MsIGlnbm9yZUZvckVtaXQsIGluY3JlbWVudGFsQ29tcGlsYXRpb24gfTogTmd0c2NQcm9ncmFtWydjb21waWxlciddLFxuKTogU2V0PHRzLlNvdXJjZUZpbGU+IHtcbiAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IG5ldyBTZXQ8dHMuU291cmNlRmlsZT4oKTtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYnVpbGRlci5nZXRTZW1hbnRpY0RpYWdub3N0aWNzT2ZOZXh0QWZmZWN0ZWRGaWxlKHVuZGVmaW5lZCwgKHNvdXJjZUZpbGUpID0+IHtcbiAgICAgIC8vIElmIHRoZSBhZmZlY3RlZCBmaWxlIGlzIGEgVFRDIHNoaW0sIGFkZCB0aGUgc2hpbSdzIG9yaWdpbmFsIHNvdXJjZSBmaWxlLlxuICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoYXQgY2hhbmdlcyB0aGF0IGFmZmVjdCBUVEMgYXJlIHR5cGVjaGVja2VkIGV2ZW4gd2hlbiB0aGUgY2hhbmdlc1xuICAgICAgLy8gYXJlIG90aGVyd2lzZSB1bnJlbGF0ZWQgZnJvbSBhIFRTIHBlcnNwZWN0aXZlIGFuZCBkbyBub3QgcmVzdWx0IGluIEl2eSBjb2RlZ2VuIGNoYW5nZXMuXG4gICAgICAvLyBGb3IgZXhhbXBsZSwgY2hhbmdpbmcgQElucHV0IHByb3BlcnR5IHR5cGVzIG9mIGEgZGlyZWN0aXZlIHVzZWQgaW4gYW5vdGhlciBjb21wb25lbnQnc1xuICAgICAgLy8gdGVtcGxhdGUuXG4gICAgICAvLyBBIFRUQyBzaGltIGlzIGEgZmlsZSB0aGF0IGhhcyBiZWVuIGlnbm9yZWQgZm9yIGRpYWdub3N0aWNzIGFuZCBoYXMgYSBmaWxlbmFtZSBlbmRpbmcgaW4gYC5uZ3R5cGVjaGVjay50c2AuXG4gICAgICBpZiAoaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpICYmIHNvdXJjZUZpbGUuZmlsZU5hbWUuZW5kc1dpdGgoJy5uZ3R5cGVjaGVjay50cycpKSB7XG4gICAgICAgIC8vIFRoaXMgZmlsZSBuYW1lIGNvbnZlcnNpb24gcmVsaWVzIG9uIGludGVybmFsIGNvbXBpbGVyIGxvZ2ljIGFuZCBzaG91bGQgYmUgY29udmVydGVkXG4gICAgICAgIC8vIHRvIGFuIG9mZmljaWFsIG1ldGhvZCB3aGVuIGF2YWlsYWJsZS4gMTUgaXMgbGVuZ3RoIG9mIGAubmd0eXBlY2hlY2sudHNgXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsRmlsZW5hbWUgPSBzb3VyY2VGaWxlLmZpbGVOYW1lLnNsaWNlKDAsIC0xNSkgKyAnLnRzJztcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxTb3VyY2VGaWxlID0gYnVpbGRlci5nZXRTb3VyY2VGaWxlKG9yaWdpbmFsRmlsZW5hbWUpO1xuICAgICAgICBpZiAob3JpZ2luYWxTb3VyY2VGaWxlKSB7XG4gICAgICAgICAgYWZmZWN0ZWRGaWxlcy5hZGQob3JpZ2luYWxTb3VyY2VGaWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgYWZmZWN0ZWRGaWxlcy5hZGQocmVzdWx0LmFmZmVjdGVkIGFzIHRzLlNvdXJjZUZpbGUpO1xuICB9XG5cbiAgLy8gQSBmaWxlIGlzIGFsc28gYWZmZWN0ZWQgaWYgdGhlIEFuZ3VsYXIgY29tcGlsZXIgcmVxdWlyZXMgaXQgdG8gYmUgZW1pdHRlZFxuICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgYnVpbGRlci5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgaWYgKGlnbm9yZUZvckVtaXQuaGFzKHNvdXJjZUZpbGUpIHx8IGluY3JlbWVudGFsQ29tcGlsYXRpb24uc2FmZVRvU2tpcEVtaXQoc291cmNlRmlsZSkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGFmZmVjdGVkRmlsZXMuYWRkKHNvdXJjZUZpbGUpO1xuICB9XG5cbiAgcmV0dXJuIGFmZmVjdGVkRmlsZXM7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU1pc3NpbmdGaWxlRXJyb3IocmVxdWVzdDogc3RyaW5nLCBvcmlnaW5hbDogc3RyaW5nLCByb290OiBzdHJpbmcpOiBQYXJ0aWFsTWVzc2FnZSB7XG4gIGNvbnN0IGVycm9yID0ge1xuICAgIHRleHQ6IGBGaWxlICcke3BhdGgucmVsYXRpdmUocm9vdCwgcmVxdWVzdCl9JyBpcyBtaXNzaW5nIGZyb20gdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24uYCxcbiAgICBub3RlczogW1xuICAgICAge1xuICAgICAgICB0ZXh0OiBgRW5zdXJlIHRoZSBmaWxlIGlzIHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvZ3JhbSB2aWEgdGhlICdmaWxlcycgb3IgJ2luY2x1ZGUnIHByb3BlcnR5LmAsXG4gICAgICB9LFxuICAgIF0sXG4gIH07XG5cbiAgaWYgKHJlcXVlc3QgIT09IG9yaWdpbmFsKSB7XG4gICAgZXJyb3Iubm90ZXMucHVzaCh7XG4gICAgICB0ZXh0OiBgRmlsZSBpcyByZXF1ZXN0ZWQgZnJvbSBhIGZpbGUgcmVwbGFjZW1lbnQgb2YgJyR7cGF0aC5yZWxhdGl2ZShyb290LCBvcmlnaW5hbCl9Jy5gLFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIGVycm9yO1xufVxuIl19