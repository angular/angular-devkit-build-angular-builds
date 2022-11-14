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
                const result = {
                    warnings: setupWarnings,
                };
                // Reset the setup warnings so that they are only shown during the first build.
                setupWarnings = undefined;
                // Reset debug performance tracking
                (0, profiling_1.resetCumulativeDurations)();
                // Reset stylesheet resource output files
                stylesheetResourceFiles = [];
                // Create TypeScript compiler host
                const host = typescript_1.default.createIncrementalCompilerHost(compilerOptions);
                // Temporarily process external resources via readResource.
                // The AOT compiler currently requires this hook to allow for a transformResource hook.
                // Once the AOT compiler allows only a transformResource hook, this can be reevaluated.
                host.readResource = async function (fileName) {
                    var _a, _b, _c;
                    // Template resources (.html/.svg) files are not bundled or transformed
                    if (fileName.endsWith('.html') || fileName.endsWith('.svg')) {
                        return (_a = this.readFile(fileName)) !== null && _a !== void 0 ? _a : '';
                    }
                    const { contents, resourceFiles, errors, warnings } = await (0, stylesheets_1.bundleStylesheetFile)(fileName, styleOptions);
                    ((_b = result.errors) !== null && _b !== void 0 ? _b : (result.errors = [])).push(...errors);
                    ((_c = result.warnings) !== null && _c !== void 0 ? _c : (result.warnings = [])).push(...warnings);
                    stylesheetResourceFiles.push(...resourceFiles);
                    return contents;
                };
                // Add an AOT compiler resource transform hook
                host.transformResource = async function (data, context) {
                    var _a, _b, _c;
                    // Only inline style resources are transformed separately currently
                    if (context.resourceFile || context.type !== 'style') {
                        return null;
                    }
                    // The file with the resource content will either be an actual file (resourceFile)
                    // or the file containing the inline component style text (containingFile).
                    const file = (_a = context.resourceFile) !== null && _a !== void 0 ? _a : context.containingFile;
                    const { contents, resourceFiles, errors, warnings } = await (0, stylesheets_1.bundleStylesheetText)(data, {
                        resolvePath: path.dirname(file),
                        virtualName: file,
                    }, styleOptions);
                    ((_b = result.errors) !== null && _b !== void 0 ? _b : (result.errors = [])).push(...errors);
                    ((_c = result.warnings) !== null && _c !== void 0 ? _c : (result.warnings = [])).push(...warnings);
                    stylesheetResourceFiles.push(...resourceFiles);
                    return { content: contents };
                };
                // Temporary deep import for host augmentation support
                const { augmentHostWithCaching, augmentHostWithReplacements, augmentProgramWithVersioning, } = require('@ngtools/webpack/src/ivy/host');
                // Augment TypeScript Host for file replacements option
                if (pluginOptions.fileReplacements) {
                    augmentHostWithReplacements(host, pluginOptions.fileReplacements);
                }
                // Augment TypeScript Host with source file caching if provided
                if (pluginOptions.sourceFileCache) {
                    augmentHostWithCaching(host, pluginOptions.sourceFileCache);
                    // Allow the AOT compiler to request the set of changed templates and styles
                    host.getModifiedResourceFiles = function () {
                        var _a;
                        return (_a = pluginOptions.sourceFileCache) === null || _a === void 0 ? void 0 : _a.modifiedFiles;
                    };
                }
                // Create the Angular specific program that contains the Angular compiler
                const angularProgram = (0, profiling_1.profileSync)('NG_CREATE_PROGRAM', () => new NgtscProgram(rootNames, compilerOptions, host, previousAngularProgram));
                previousAngularProgram = angularProgram;
                const angularCompiler = angularProgram.compiler;
                const typeScriptProgram = angularProgram.getTsProgram();
                augmentProgramWithVersioning(typeScriptProgram);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILHNDQUE2QztBQVM3QyxvREFBc0M7QUFDdEMscURBQXVDO0FBQ3ZDLHFDQUFtQztBQUNuQyxnREFBa0M7QUFDbEMsdUNBQXlDO0FBQ3pDLDREQUE0QjtBQUM1QixrRkFBdUU7QUFDdkUsK0RBQTZEO0FBQzdELG1EQUFxRDtBQUNyRCwyQ0FLcUI7QUFDckIsK0NBQW9HO0FBVXBHOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLCtCQUErQixDQUN0QyxJQUFxQyxFQUNyQyxJQUE4QixFQUM5QixVQUFtQjtJQUVuQixJQUFJLElBQUksR0FBRyxvQkFBRSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDaEYsSUFBSSxVQUFVLEVBQUU7UUFDZCxJQUFJLEdBQUcsVUFBVSxHQUFHLElBQUksQ0FBQztLQUMxQjtJQUVELE1BQU0sSUFBSSxHQUFnQixFQUFFLElBQUksRUFBRSxDQUFDO0lBRW5DLElBQUksSUFBSSxDQUFDLElBQUksRUFBRTtRQUNiLElBQUksQ0FBQyxRQUFRLEdBQUc7WUFDZCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRO1lBQ3hCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtTQUNwQixDQUFDO1FBRUYsNEZBQTRGO1FBQzVGLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNkLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEdBQUcsb0JBQUUs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QUksT0FBTyxDQUFDLGNBQWMsRUFBRSxFQUFFO1FBQ2pELElBQUksYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxzQkFBc0IsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDdEYsU0FBUztTQUNWO1FBRUQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztLQUMvQjtJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUM7QUFFRCxTQUFTLHNCQUFzQixDQUFDLE9BQWUsRUFBRSxRQUFnQixFQUFFLElBQVk7SUFDN0UsTUFBTSxLQUFLLEdBQUc7UUFDWixJQUFJLEVBQUUsU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsK0NBQStDO1FBQzFGLEtBQUssRUFBRTtZQUNMO2dCQUNFLElBQUksRUFBRSwwRkFBMEY7YUFDakc7U0FDRjtLQUNGLENBQUM7SUFFRixJQUFJLE9BQU8sS0FBSyxRQUFRLEVBQUU7UUFDeEIsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDZixJQUFJLEVBQUUsaURBQWlELElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxJQUFJO1NBQ3pGLENBQUMsQ0FBQztLQUNKO0lBRUQsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQ29tcGlsZXJIb3N0LCBOZ3RzY1Byb2dyYW0gfSBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHsgdHJhbnNmb3JtQXN5bmMgfSBmcm9tICdAYmFiZWwvY29yZSc7XG5pbXBvcnQgdHlwZSB7XG4gIE9uU3RhcnRSZXN1bHQsXG4gIE91dHB1dEZpbGUsXG4gIFBhcnRpYWxNZXNzYWdlLFxuICBQYXJ0aWFsTm90ZSxcbiAgUGx1Z2luLFxuICBQbHVnaW5CdWlsZCxcbn0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJ25vZGU6b3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCBhbmd1bGFyQXBwbGljYXRpb25QcmVzZXQgZnJvbSAnLi4vLi4vYmFiZWwvcHJlc2V0cy9hcHBsaWNhdGlvbic7XG5pbXBvcnQgeyByZXF1aXJlc0xpbmtpbmcgfSBmcm9tICcuLi8uLi9iYWJlbC93ZWJwYWNrLWxvYWRlcic7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHtcbiAgbG9nQ3VtdWxhdGl2ZUR1cmF0aW9ucyxcbiAgcHJvZmlsZUFzeW5jLFxuICBwcm9maWxlU3luYyxcbiAgcmVzZXRDdW11bGF0aXZlRHVyYXRpb25zLFxufSBmcm9tICcuL3Byb2ZpbGluZyc7XG5pbXBvcnQgeyBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucywgYnVuZGxlU3R5bGVzaGVldEZpbGUsIGJ1bmRsZVN0eWxlc2hlZXRUZXh0IH0gZnJvbSAnLi9zdHlsZXNoZWV0cyc7XG5cbmludGVyZmFjZSBFbWl0RmlsZVJlc3VsdCB7XG4gIGNvbnRlbnQ/OiBzdHJpbmc7XG4gIG1hcD86IHN0cmluZztcbiAgZGVwZW5kZW5jaWVzOiByZWFkb25seSBzdHJpbmdbXTtcbiAgaGFzaD86IFVpbnQ4QXJyYXk7XG59XG50eXBlIEZpbGVFbWl0dGVyID0gKGZpbGU6IHN0cmluZykgPT4gUHJvbWlzZTxFbWl0RmlsZVJlc3VsdCB8IHVuZGVmaW5lZD47XG5cbi8qKlxuICogQ29udmVydHMgVHlwZVNjcmlwdCBEaWFnbm9zdGljIHJlbGF0ZWQgaW5mb3JtYXRpb24gaW50byBhbiBlc2J1aWxkIGNvbXBhdGlibGUgbm90ZSBvYmplY3QuXG4gKiBSZWxhdGVkIGluZm9ybWF0aW9uIGlzIGEgc3Vic2V0IG9mIGEgZnVsbCBUeXBlU2NyaXB0IERpYWdub3N0aWMgYW5kIGFsc28gdXNlZCBmb3IgZGlhZ25vc3RpY1xuICogbm90ZXMgYXNzb2NpYXRlZCB3aXRoIHRoZSBtYWluIERpYWdub3N0aWMuXG4gKiBAcGFyYW0gaW5mbyBUaGUgVHlwZVNjcmlwdCBkaWFnbm9zdGljIHJlbGF0aXZlIGluZm9ybWF0aW9uIHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0gaG9zdCBBIFR5cGVTY3JpcHQgRm9ybWF0RGlhZ25vc3RpY3NIb3N0IGluc3RhbmNlIHRvIHVzZSBkdXJpbmcgY29udmVyc2lvbi5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgZGlhZ25vc3RpYyBtZXNzYWdlIGFzIGEgUGFydGlhbE1lc3NhZ2Ugb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oXG4gIGluZm86IHRzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24sXG4gIGhvc3Q6IHRzLkZvcm1hdERpYWdub3N0aWNzSG9zdCxcbiAgdGV4dFByZWZpeD86IHN0cmluZyxcbik6IFBhcnRpYWxOb3RlIHtcbiAgbGV0IHRleHQgPSB0cy5mbGF0dGVuRGlhZ25vc3RpY01lc3NhZ2VUZXh0KGluZm8ubWVzc2FnZVRleHQsIGhvc3QuZ2V0TmV3TGluZSgpKTtcbiAgaWYgKHRleHRQcmVmaXgpIHtcbiAgICB0ZXh0ID0gdGV4dFByZWZpeCArIHRleHQ7XG4gIH1cblxuICBjb25zdCBub3RlOiBQYXJ0aWFsTm90ZSA9IHsgdGV4dCB9O1xuXG4gIGlmIChpbmZvLmZpbGUpIHtcbiAgICBub3RlLmxvY2F0aW9uID0ge1xuICAgICAgZmlsZTogaW5mby5maWxlLmZpbGVOYW1lLFxuICAgICAgbGVuZ3RoOiBpbmZvLmxlbmd0aCxcbiAgICB9O1xuXG4gICAgLy8gQ2FsY3VsYXRlIHRoZSBsaW5lL2NvbHVtbiBsb2NhdGlvbiBhbmQgZXh0cmFjdCB0aGUgZnVsbCBsaW5lIHRleHQgdGhhdCBoYXMgdGhlIGRpYWdub3N0aWNcbiAgICBpZiAoaW5mby5zdGFydCkge1xuICAgICAgY29uc3QgeyBsaW5lLCBjaGFyYWN0ZXIgfSA9IHRzLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKGluZm8uZmlsZSwgaW5mby5zdGFydCk7XG4gICAgICBub3RlLmxvY2F0aW9uLmxpbmUgPSBsaW5lICsgMTtcbiAgICAgIG5vdGUubG9jYXRpb24uY29sdW1uID0gY2hhcmFjdGVyO1xuXG4gICAgICAvLyBUaGUgc3RhcnQgcG9zaXRpb24gZm9yIHRoZSBzbGljZSBpcyB0aGUgZmlyc3QgY2hhcmFjdGVyIG9mIHRoZSBlcnJvciBsaW5lXG4gICAgICBjb25zdCBsaW5lU3RhcnRQb3NpdGlvbiA9IHRzLmdldFBvc2l0aW9uT2ZMaW5lQW5kQ2hhcmFjdGVyKGluZm8uZmlsZSwgbGluZSwgMCk7XG5cbiAgICAgIC8vIFRoZSBlbmQgcG9zaXRpb24gZm9yIHRoZSBzbGljZSBpcyB0aGUgZmlyc3QgY2hhcmFjdGVyIG9mIHRoZSBuZXh0IGxpbmUgb3IgdGhlIGxlbmd0aCBvZlxuICAgICAgLy8gdGhlIGVudGlyZSBmaWxlIGlmIHRoZSBsaW5lIGlzIHRoZSBsYXN0IGxpbmUgb2YgdGhlIGZpbGUgKGdldFBvc2l0aW9uT2ZMaW5lQW5kQ2hhcmFjdGVyXG4gICAgICAvLyB3aWxsIGVycm9yIGlmIGEgbm9uZXhpc3RlbnQgbGluZSBpcyBwYXNzZWQpLlxuICAgICAgY29uc3QgeyBsaW5lOiBsYXN0TGluZU9mRmlsZSB9ID0gdHMuZ2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24oXG4gICAgICAgIGluZm8uZmlsZSxcbiAgICAgICAgaW5mby5maWxlLnRleHQubGVuZ3RoIC0gMSxcbiAgICAgICk7XG4gICAgICBjb25zdCBsaW5lRW5kUG9zaXRpb24gPVxuICAgICAgICBsaW5lIDwgbGFzdExpbmVPZkZpbGVcbiAgICAgICAgICA/IHRzLmdldFBvc2l0aW9uT2ZMaW5lQW5kQ2hhcmFjdGVyKGluZm8uZmlsZSwgbGluZSArIDEsIDApXG4gICAgICAgICAgOiBpbmZvLmZpbGUudGV4dC5sZW5ndGg7XG5cbiAgICAgIG5vdGUubG9jYXRpb24ubGluZVRleHQgPSBpbmZvLmZpbGUudGV4dC5zbGljZShsaW5lU3RhcnRQb3NpdGlvbiwgbGluZUVuZFBvc2l0aW9uKS50cmltRW5kKCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5vdGU7XG59XG5cbi8qKlxuICogQ29udmVydHMgYSBUeXBlU2NyaXB0IERpYWdub3N0aWMgbWVzc2FnZSBpbnRvIGFuIGVzYnVpbGQgY29tcGF0aWJsZSBtZXNzYWdlIG9iamVjdC5cbiAqIEBwYXJhbSBkaWFnbm9zdGljIFRoZSBUeXBlU2NyaXB0IGRpYWdub3N0aWMgdG8gY29udmVydC5cbiAqIEBwYXJhbSBob3N0IEEgVHlwZVNjcmlwdCBGb3JtYXREaWFnbm9zdGljc0hvc3QgaW5zdGFuY2UgdG8gdXNlIGR1cmluZyBjb252ZXJzaW9uLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBkaWFnbm9zdGljIG1lc3NhZ2UgYXMgYSBQYXJ0aWFsTWVzc2FnZSBvYmplY3RcbiAqL1xuZnVuY3Rpb24gY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljKFxuICBkaWFnbm9zdGljOiB0cy5EaWFnbm9zdGljLFxuICBob3N0OiB0cy5Gb3JtYXREaWFnbm9zdGljc0hvc3QsXG4pOiBQYXJ0aWFsTWVzc2FnZSB7XG4gIGxldCBjb2RlUHJlZml4ID0gJ1RTJztcbiAgbGV0IGNvZGUgPSBgJHtkaWFnbm9zdGljLmNvZGV9YDtcbiAgaWYgKGRpYWdub3N0aWMuc291cmNlID09PSAnbmd0c2MnKSB7XG4gICAgY29kZVByZWZpeCA9ICdORyc7XG4gICAgLy8gUmVtb3ZlIGAtOTlgIEFuZ3VsYXIgcHJlZml4IGZyb20gZGlhZ25vc3RpYyBjb2RlXG4gICAgY29kZSA9IGNvZGUuc2xpY2UoMyk7XG4gIH1cblxuICBjb25zdCBtZXNzYWdlOiBQYXJ0aWFsTWVzc2FnZSA9IHtcbiAgICAuLi5jb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWNJbmZvKGRpYWdub3N0aWMsIGhvc3QsIGAke2NvZGVQcmVmaXh9JHtjb2RlfTogYCksXG4gICAgLy8gU3RvcmUgb3JpZ2luYWwgZGlhZ25vc3RpYyBmb3IgcmVmZXJlbmNlIGlmIG5lZWRlZCBkb3duc3RyZWFtXG4gICAgZGV0YWlsOiBkaWFnbm9zdGljLFxuICB9O1xuXG4gIGlmIChkaWFnbm9zdGljLnJlbGF0ZWRJbmZvcm1hdGlvbj8ubGVuZ3RoKSB7XG4gICAgbWVzc2FnZS5ub3RlcyA9IGRpYWdub3N0aWMucmVsYXRlZEluZm9ybWF0aW9uLm1hcCgoaW5mbykgPT5cbiAgICAgIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oaW5mbywgaG9zdCksXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBtZXNzYWdlO1xufVxuXG5jb25zdCBVU0lOR19XSU5ET1dTID0gcGxhdGZvcm0oKSA9PT0gJ3dpbjMyJztcbmNvbnN0IFdJTkRPV1NfU0VQX1JFR0VYUCA9IG5ldyBSZWdFeHAoYFxcXFwke3BhdGgud2luMzIuc2VwfWAsICdnJyk7XG5cbmV4cG9ydCBjbGFzcyBTb3VyY2VGaWxlQ2FjaGUgZXh0ZW5kcyBNYXA8c3RyaW5nLCB0cy5Tb3VyY2VGaWxlPiB7XG4gIHJlYWRvbmx5IG1vZGlmaWVkRmlsZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcmVhZG9ubHkgYmFiZWxGaWxlQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgVWludDhBcnJheT4oKTtcbiAgcmVhZG9ubHkgdHlwZVNjcmlwdEZpbGVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBVaW50OEFycmF5PigpO1xuXG4gIGludmFsaWRhdGUoZmlsZXM6IEl0ZXJhYmxlPHN0cmluZz4pOiB2b2lkIHtcbiAgICB0aGlzLm1vZGlmaWVkRmlsZXMuY2xlYXIoKTtcbiAgICBmb3IgKGxldCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICB0aGlzLmJhYmVsRmlsZUNhY2hlLmRlbGV0ZShmaWxlKTtcbiAgICAgIHRoaXMudHlwZVNjcmlwdEZpbGVDYWNoZS5kZWxldGUocGF0aFRvRmlsZVVSTChmaWxlKS5ocmVmKTtcblxuICAgICAgLy8gTm9ybWFsaXplIHNlcGFyYXRvcnMgdG8gYWxsb3cgbWF0Y2hpbmcgVHlwZVNjcmlwdCBIb3N0IHBhdGhzXG4gICAgICBpZiAoVVNJTkdfV0lORE9XUykge1xuICAgICAgICBmaWxlID0gZmlsZS5yZXBsYWNlKFdJTkRPV1NfU0VQX1JFR0VYUCwgcGF0aC5wb3NpeC5zZXApO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmRlbGV0ZShmaWxlKTtcbiAgICAgIHRoaXMubW9kaWZpZWRGaWxlcy5hZGQoZmlsZSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZXJQbHVnaW5PcHRpb25zIHtcbiAgc291cmNlbWFwOiBib29sZWFuO1xuICB0c2NvbmZpZzogc3RyaW5nO1xuICBhZHZhbmNlZE9wdGltaXphdGlvbnM/OiBib29sZWFuO1xuICB0aGlyZFBhcnR5U291cmNlbWFwcz86IGJvb2xlYW47XG4gIGZpbGVSZXBsYWNlbWVudHM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGU7XG59XG5cbi8vIFRoaXMgaXMgYSBub24td2F0Y2ggdmVyc2lvbiBvZiB0aGUgY29tcGlsZXIgY29kZSBmcm9tIGBAbmd0b29scy93ZWJwYWNrYCBhdWdtZW50ZWQgZm9yIGVzYnVpbGRcbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gIHBsdWdpbk9wdGlvbnM6IENvbXBpbGVyUGx1Z2luT3B0aW9ucyxcbiAgc3R5bGVPcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbik6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItY29tcGlsZXInLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG4gICAgYXN5bmMgc2V0dXAoYnVpbGQ6IFBsdWdpbkJ1aWxkKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICBsZXQgc2V0dXBXYXJuaW5nczogUGFydGlhbE1lc3NhZ2VbXSB8IHVuZGVmaW5lZDtcblxuICAgICAgLy8gVGhpcyB1c2VzIGEgd3JhcHBlZCBkeW5hbWljIGltcG9ydCB0byBsb2FkIGBAYW5ndWxhci9jb21waWxlci1jbGlgIHdoaWNoIGlzIEVTTS5cbiAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciByZXRhaW5pbmcgZHluYW1pYyBpbXBvcnRzIHRoaXMgd29ya2Fyb3VuZCBjYW4gYmUgZHJvcHBlZC5cbiAgICAgIGNvbnN0IHsgR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCwgTmd0c2NQcm9ncmFtLCBPcHRpbWl6ZUZvciwgcmVhZENvbmZpZ3VyYXRpb24gfSA9XG4gICAgICAgIGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk+KCdAYW5ndWxhci9jb21waWxlci1jbGknKTtcblxuICAgICAgLy8gVGVtcG9yYXJ5IGRlZXAgaW1wb3J0IGZvciB0cmFuc2Zvcm1lciBzdXBwb3J0XG4gICAgICBjb25zdCB7XG4gICAgICAgIG1lcmdlVHJhbnNmb3JtZXJzLFxuICAgICAgICByZXBsYWNlQm9vdHN0cmFwLFxuICAgICAgfSA9IHJlcXVpcmUoJ0BuZ3Rvb2xzL3dlYnBhY2svc3JjL2l2eS90cmFuc2Zvcm1hdGlvbicpO1xuXG4gICAgICAvLyBTZXR1cCBkZWZpbmVzIGJhc2VkIG9uIHRoZSB2YWx1ZXMgcHJvdmlkZWQgYnkgdGhlIEFuZ3VsYXIgY29tcGlsZXItY2xpXG4gICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUgPz89IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCkpIHtcbiAgICAgICAgaWYgKGtleSBpbiBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUpIHtcbiAgICAgICAgICAvLyBTa2lwIGtleXMgdGhhdCBoYXZlIGJlZW4gbWFudWFsbHkgcHJvdmlkZWRcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBlc2J1aWxkIHJlcXVpcmVzIHZhbHVlcyB0byBiZSBhIHN0cmluZyAoYWN0dWFsIHN0cmluZ3MgbmVlZCB0byBiZSBxdW90ZWQpLlxuICAgICAgICAvLyBJbiB0aGlzIGNhc2UsIGFsbCBwcm92aWRlZCB2YWx1ZXMgYXJlIGJvb2xlYW5zLlxuICAgICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmVba2V5XSA9IHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSB0c2NvbmZpZyBpcyBsb2FkZWQgaW4gc2V0dXAgaW5zdGVhZCBvZiBpbiBzdGFydCB0byBhbGxvdyB0aGUgZXNidWlsZCB0YXJnZXQgYnVpbGQgb3B0aW9uIHRvIGJlIG1vZGlmaWVkLlxuICAgICAgLy8gZXNidWlsZCBidWlsZCBvcHRpb25zIGNhbiBvbmx5IGJlIG1vZGlmaWVkIGluIHNldHVwIHByaW9yIHRvIHN0YXJ0aW5nIHRoZSBidWlsZC5cbiAgICAgIGNvbnN0IHtcbiAgICAgICAgb3B0aW9uczogY29tcGlsZXJPcHRpb25zLFxuICAgICAgICByb290TmFtZXMsXG4gICAgICAgIGVycm9yczogY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgICAgfSA9IHByb2ZpbGVTeW5jKCdOR19SRUFEX0NPTkZJRycsICgpID0+XG4gICAgICAgIHJlYWRDb25maWd1cmF0aW9uKHBsdWdpbk9wdGlvbnMudHNjb25maWcsIHtcbiAgICAgICAgICBub0VtaXRPbkVycm9yOiBmYWxzZSxcbiAgICAgICAgICBzdXBwcmVzc091dHB1dFBhdGhDaGVjazogdHJ1ZSxcbiAgICAgICAgICBvdXREaXI6IHVuZGVmaW5lZCxcbiAgICAgICAgICBpbmxpbmVTb3VyY2VzOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICBpbmxpbmVTb3VyY2VNYXA6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgIHNvdXJjZU1hcDogZmFsc2UsXG4gICAgICAgICAgbWFwUm9vdDogdW5kZWZpbmVkLFxuICAgICAgICAgIHNvdXJjZVJvb3Q6IHVuZGVmaW5lZCxcbiAgICAgICAgICBkZWNsYXJhdGlvbjogZmFsc2UsXG4gICAgICAgICAgZGVjbGFyYXRpb25NYXA6IGZhbHNlLFxuICAgICAgICAgIGFsbG93RW1wdHlDb2RlZ2VuRmlsZXM6IGZhbHNlLFxuICAgICAgICAgIGFubm90YXRpb25zQXM6ICdkZWNvcmF0b3JzJyxcbiAgICAgICAgICBlbmFibGVSZXNvdXJjZUlubGluaW5nOiBmYWxzZSxcbiAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgICBpZiAoY29tcGlsZXJPcHRpb25zLnRhcmdldCA9PT0gdW5kZWZpbmVkIHx8IGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPCB0cy5TY3JpcHRUYXJnZXQuRVMyMDIyKSB7XG4gICAgICAgIC8vIElmICd1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkcycgaXMgYWxyZWFkeSBkZWZpbmVkIGluIHRoZSB1c2VycyBwcm9qZWN0IGxlYXZlIHRoZSB2YWx1ZSBhcyBpcy5cbiAgICAgICAgLy8gT3RoZXJ3aXNlIGZhbGxiYWNrIHRvIGZhbHNlIGR1ZSB0byBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzQ1OTk1XG4gICAgICAgIC8vIHdoaWNoIGJyZWFrcyB0aGUgZGVwcmVjYXRlZCBgQEVmZmVjdHNgIE5HUlggZGVjb3JhdG9yIGFuZCBwb3RlbnRpYWxseSBvdGhlciBleGlzdGluZyBjb2RlIGFzIHdlbGwuXG4gICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPSB0cy5TY3JpcHRUYXJnZXQuRVMyMDIyO1xuICAgICAgICBjb21waWxlck9wdGlvbnMudXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHMgPz89IGZhbHNlO1xuXG4gICAgICAgIChzZXR1cFdhcm5pbmdzID8/PSBbXSkucHVzaCh7XG4gICAgICAgICAgdGV4dDpcbiAgICAgICAgICAgICdUeXBlU2NyaXB0IGNvbXBpbGVyIG9wdGlvbnMgXCJ0YXJnZXRcIiBhbmQgXCJ1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkc1wiIGFyZSBzZXQgdG8gXCJFUzIwMjJcIiBhbmQgJyArXG4gICAgICAgICAgICAnXCJmYWxzZVwiIHJlc3BlY3RpdmVseSBieSB0aGUgQW5ndWxhciBDTEkuJyxcbiAgICAgICAgICBsb2NhdGlvbjogeyBmaWxlOiBwbHVnaW5PcHRpb25zLnRzY29uZmlnIH0sXG4gICAgICAgICAgbm90ZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdGV4dDpcbiAgICAgICAgICAgICAgICAnVG8gY29udHJvbCBFQ01BIHZlcnNpb24gYW5kIGZlYXR1cmVzIHVzZSB0aGUgQnJvd2Vyc2xpc3QgY29uZmlndXJhdGlvbi4gJyArXG4gICAgICAgICAgICAgICAgJ0ZvciBtb3JlIGluZm9ybWF0aW9uLCBzZWUgaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2J1aWxkI2NvbmZpZ3VyaW5nLWJyb3dzZXItY29tcGF0aWJpbGl0eScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgZmlsZSBlbWl0dGVyIGNyZWF0ZWQgZHVyaW5nIGBvblN0YXJ0YCB0aGF0IHdpbGwgYmUgdXNlZCBkdXJpbmcgdGhlIGJ1aWxkIGluIGBvbkxvYWRgIGNhbGxiYWNrcyBmb3IgVFMgZmlsZXNcbiAgICAgIGxldCBmaWxlRW1pdHRlcjogRmlsZUVtaXR0ZXIgfCB1bmRlZmluZWQ7XG5cbiAgICAgIC8vIFRoZSBzdHlsZXNoZWV0IHJlc291cmNlcyBmcm9tIGNvbXBvbmVudCBzdHlsZXNoZWV0cyB0aGF0IHdpbGwgYmUgYWRkZWQgdG8gdGhlIGJ1aWxkIHJlc3VsdHMgb3V0cHV0IGZpbGVzXG4gICAgICBsZXQgc3R5bGVzaGVldFJlc291cmNlRmlsZXM6IE91dHB1dEZpbGVbXTtcblxuICAgICAgbGV0IHByZXZpb3VzQnVpbGRlcjogdHMuRW1pdEFuZFNlbWFudGljRGlhZ25vc3RpY3NCdWlsZGVyUHJvZ3JhbSB8IHVuZGVmaW5lZDtcbiAgICAgIGxldCBwcmV2aW91c0FuZ3VsYXJQcm9ncmFtOiBOZ3RzY1Byb2dyYW0gfCB1bmRlZmluZWQ7XG4gICAgICBjb25zdCBiYWJlbERhdGFDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBVaW50OEFycmF5PigpO1xuICAgICAgY29uc3QgZGlhZ25vc3RpY0NhY2hlID0gbmV3IFdlYWtNYXA8dHMuU291cmNlRmlsZSwgdHMuRGlhZ25vc3RpY1tdPigpO1xuXG4gICAgICBidWlsZC5vblN0YXJ0KGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0OiBPblN0YXJ0UmVzdWx0ID0ge1xuICAgICAgICAgIHdhcm5pbmdzOiBzZXR1cFdhcm5pbmdzLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFJlc2V0IHRoZSBzZXR1cCB3YXJuaW5ncyBzbyB0aGF0IHRoZXkgYXJlIG9ubHkgc2hvd24gZHVyaW5nIHRoZSBmaXJzdCBidWlsZC5cbiAgICAgICAgc2V0dXBXYXJuaW5ncyA9IHVuZGVmaW5lZDtcblxuICAgICAgICAvLyBSZXNldCBkZWJ1ZyBwZXJmb3JtYW5jZSB0cmFja2luZ1xuICAgICAgICByZXNldEN1bXVsYXRpdmVEdXJhdGlvbnMoKTtcblxuICAgICAgICAvLyBSZXNldCBzdHlsZXNoZWV0IHJlc291cmNlIG91dHB1dCBmaWxlc1xuICAgICAgICBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyA9IFtdO1xuXG4gICAgICAgIC8vIENyZWF0ZSBUeXBlU2NyaXB0IGNvbXBpbGVyIGhvc3RcbiAgICAgICAgY29uc3QgaG9zdCA9IHRzLmNyZWF0ZUluY3JlbWVudGFsQ29tcGlsZXJIb3N0KGNvbXBpbGVyT3B0aW9ucyk7XG5cbiAgICAgICAgLy8gVGVtcG9yYXJpbHkgcHJvY2VzcyBleHRlcm5hbCByZXNvdXJjZXMgdmlhIHJlYWRSZXNvdXJjZS5cbiAgICAgICAgLy8gVGhlIEFPVCBjb21waWxlciBjdXJyZW50bHkgcmVxdWlyZXMgdGhpcyBob29rIHRvIGFsbG93IGZvciBhIHRyYW5zZm9ybVJlc291cmNlIGhvb2suXG4gICAgICAgIC8vIE9uY2UgdGhlIEFPVCBjb21waWxlciBhbGxvd3Mgb25seSBhIHRyYW5zZm9ybVJlc291cmNlIGhvb2ssIHRoaXMgY2FuIGJlIHJlZXZhbHVhdGVkLlxuICAgICAgICAoaG9zdCBhcyBDb21waWxlckhvc3QpLnJlYWRSZXNvdXJjZSA9IGFzeW5jIGZ1bmN0aW9uIChmaWxlTmFtZSkge1xuICAgICAgICAgIC8vIFRlbXBsYXRlIHJlc291cmNlcyAoLmh0bWwvLnN2ZykgZmlsZXMgYXJlIG5vdCBidW5kbGVkIG9yIHRyYW5zZm9ybWVkXG4gICAgICAgICAgaWYgKGZpbGVOYW1lLmVuZHNXaXRoKCcuaHRtbCcpIHx8IGZpbGVOYW1lLmVuZHNXaXRoKCcuc3ZnJykpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlYWRGaWxlKGZpbGVOYW1lKSA/PyAnJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCB7IGNvbnRlbnRzLCByZXNvdXJjZUZpbGVzLCBlcnJvcnMsIHdhcm5pbmdzIH0gPSBhd2FpdCBidW5kbGVTdHlsZXNoZWV0RmlsZShcbiAgICAgICAgICAgIGZpbGVOYW1lLFxuICAgICAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaCguLi53YXJuaW5ncyk7XG4gICAgICAgICAgc3R5bGVzaGVldFJlc291cmNlRmlsZXMucHVzaCguLi5yZXNvdXJjZUZpbGVzKTtcblxuICAgICAgICAgIHJldHVybiBjb250ZW50cztcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBBZGQgYW4gQU9UIGNvbXBpbGVyIHJlc291cmNlIHRyYW5zZm9ybSBob29rXG4gICAgICAgIChob3N0IGFzIENvbXBpbGVySG9zdCkudHJhbnNmb3JtUmVzb3VyY2UgPSBhc3luYyBmdW5jdGlvbiAoZGF0YSwgY29udGV4dCkge1xuICAgICAgICAgIC8vIE9ubHkgaW5saW5lIHN0eWxlIHJlc291cmNlcyBhcmUgdHJhbnNmb3JtZWQgc2VwYXJhdGVseSBjdXJyZW50bHlcbiAgICAgICAgICBpZiAoY29udGV4dC5yZXNvdXJjZUZpbGUgfHwgY29udGV4dC50eXBlICE9PSAnc3R5bGUnKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUaGUgZmlsZSB3aXRoIHRoZSByZXNvdXJjZSBjb250ZW50IHdpbGwgZWl0aGVyIGJlIGFuIGFjdHVhbCBmaWxlIChyZXNvdXJjZUZpbGUpXG4gICAgICAgICAgLy8gb3IgdGhlIGZpbGUgY29udGFpbmluZyB0aGUgaW5saW5lIGNvbXBvbmVudCBzdHlsZSB0ZXh0IChjb250YWluaW5nRmlsZSkuXG4gICAgICAgICAgY29uc3QgZmlsZSA9IGNvbnRleHQucmVzb3VyY2VGaWxlID8/IGNvbnRleHQuY29udGFpbmluZ0ZpbGU7XG5cbiAgICAgICAgICBjb25zdCB7IGNvbnRlbnRzLCByZXNvdXJjZUZpbGVzLCBlcnJvcnMsIHdhcm5pbmdzIH0gPSBhd2FpdCBidW5kbGVTdHlsZXNoZWV0VGV4dChcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHJlc29sdmVQYXRoOiBwYXRoLmRpcm5hbWUoZmlsZSksXG4gICAgICAgICAgICAgIHZpcnR1YWxOYW1lOiBmaWxlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgICAgKHJlc3VsdC53YXJuaW5ncyA/Pz0gW10pLnB1c2goLi4ud2FybmluZ3MpO1xuICAgICAgICAgIHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLnB1c2goLi4ucmVzb3VyY2VGaWxlcyk7XG5cbiAgICAgICAgICByZXR1cm4geyBjb250ZW50OiBjb250ZW50cyB9O1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFRlbXBvcmFyeSBkZWVwIGltcG9ydCBmb3IgaG9zdCBhdWdtZW50YXRpb24gc3VwcG9ydFxuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgYXVnbWVudEhvc3RXaXRoQ2FjaGluZyxcbiAgICAgICAgICBhdWdtZW50SG9zdFdpdGhSZXBsYWNlbWVudHMsXG4gICAgICAgICAgYXVnbWVudFByb2dyYW1XaXRoVmVyc2lvbmluZyxcbiAgICAgICAgfSA9IHJlcXVpcmUoJ0BuZ3Rvb2xzL3dlYnBhY2svc3JjL2l2eS9ob3N0Jyk7XG5cbiAgICAgICAgLy8gQXVnbWVudCBUeXBlU2NyaXB0IEhvc3QgZm9yIGZpbGUgcmVwbGFjZW1lbnRzIG9wdGlvblxuICAgICAgICBpZiAocGx1Z2luT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgICAgICAgYXVnbWVudEhvc3RXaXRoUmVwbGFjZW1lbnRzKGhvc3QsIHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBdWdtZW50IFR5cGVTY3JpcHQgSG9zdCB3aXRoIHNvdXJjZSBmaWxlIGNhY2hpbmcgaWYgcHJvdmlkZWRcbiAgICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlKSB7XG4gICAgICAgICAgYXVnbWVudEhvc3RXaXRoQ2FjaGluZyhob3N0LCBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZSk7XG4gICAgICAgICAgLy8gQWxsb3cgdGhlIEFPVCBjb21waWxlciB0byByZXF1ZXN0IHRoZSBzZXQgb2YgY2hhbmdlZCB0ZW1wbGF0ZXMgYW5kIHN0eWxlc1xuICAgICAgICAgIChob3N0IGFzIENvbXBpbGVySG9zdCkuZ2V0TW9kaWZpZWRSZXNvdXJjZUZpbGVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5tb2RpZmllZEZpbGVzO1xuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDcmVhdGUgdGhlIEFuZ3VsYXIgc3BlY2lmaWMgcHJvZ3JhbSB0aGF0IGNvbnRhaW5zIHRoZSBBbmd1bGFyIGNvbXBpbGVyXG4gICAgICAgIGNvbnN0IGFuZ3VsYXJQcm9ncmFtID0gcHJvZmlsZVN5bmMoXG4gICAgICAgICAgJ05HX0NSRUFURV9QUk9HUkFNJyxcbiAgICAgICAgICAoKSA9PiBuZXcgTmd0c2NQcm9ncmFtKHJvb3ROYW1lcywgY29tcGlsZXJPcHRpb25zLCBob3N0LCBwcmV2aW91c0FuZ3VsYXJQcm9ncmFtKSxcbiAgICAgICAgKTtcbiAgICAgICAgcHJldmlvdXNBbmd1bGFyUHJvZ3JhbSA9IGFuZ3VsYXJQcm9ncmFtO1xuICAgICAgICBjb25zdCBhbmd1bGFyQ29tcGlsZXIgPSBhbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgICAgICAgY29uc3QgdHlwZVNjcmlwdFByb2dyYW0gPSBhbmd1bGFyUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKTtcbiAgICAgICAgYXVnbWVudFByb2dyYW1XaXRoVmVyc2lvbmluZyh0eXBlU2NyaXB0UHJvZ3JhbSk7XG5cbiAgICAgICAgY29uc3QgYnVpbGRlciA9IHRzLmNyZWF0ZUVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0oXG4gICAgICAgICAgdHlwZVNjcmlwdFByb2dyYW0sXG4gICAgICAgICAgaG9zdCxcbiAgICAgICAgICBwcmV2aW91c0J1aWxkZXIsXG4gICAgICAgICAgY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgICAgICApO1xuICAgICAgICBwcmV2aW91c0J1aWxkZXIgPSBidWlsZGVyO1xuXG4gICAgICAgIGF3YWl0IHByb2ZpbGVBc3luYygnTkdfQU5BTFlaRV9QUk9HUkFNJywgKCkgPT4gYW5ndWxhckNvbXBpbGVyLmFuYWx5emVBc3luYygpKTtcbiAgICAgICAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IHByb2ZpbGVTeW5jKCdOR19GSU5EX0FGRkVDVEVEJywgKCkgPT5cbiAgICAgICAgICBmaW5kQWZmZWN0ZWRGaWxlcyhidWlsZGVyLCBhbmd1bGFyQ29tcGlsZXIpLFxuICAgICAgICApO1xuXG4gICAgICAgIGlmIChwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZSkge1xuICAgICAgICAgIGZvciAoY29uc3QgYWZmZWN0ZWQgb2YgYWZmZWN0ZWRGaWxlcykge1xuICAgICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUudHlwZVNjcmlwdEZpbGVDYWNoZS5kZWxldGUoXG4gICAgICAgICAgICAgIHBhdGhUb0ZpbGVVUkwoYWZmZWN0ZWQuZmlsZU5hbWUpLmhyZWYsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uKiBjb2xsZWN0RGlhZ25vc3RpY3MoKTogSXRlcmFibGU8dHMuRGlhZ25vc3RpYz4ge1xuICAgICAgICAgIC8vIENvbGxlY3QgcHJvZ3JhbSBsZXZlbCBkaWFnbm9zdGljc1xuICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldENvbmZpZ0ZpbGVQYXJzaW5nRGlhZ25vc3RpY3MoKTtcbiAgICAgICAgICB5aWVsZCogYW5ndWxhckNvbXBpbGVyLmdldE9wdGlvbkRpYWdub3N0aWNzKCk7XG4gICAgICAgICAgeWllbGQqIGJ1aWxkZXIuZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCk7XG4gICAgICAgICAgeWllbGQqIGJ1aWxkZXIuZ2V0R2xvYmFsRGlhZ25vc3RpY3MoKTtcblxuICAgICAgICAgIC8vIENvbGxlY3Qgc291cmNlIGZpbGUgc3BlY2lmaWMgZGlhZ25vc3RpY3NcbiAgICAgICAgICBjb25zdCBvcHRpbWl6ZUZvciA9XG4gICAgICAgICAgICBhZmZlY3RlZEZpbGVzLnNpemUgPiAxID8gT3B0aW1pemVGb3IuV2hvbGVQcm9ncmFtIDogT3B0aW1pemVGb3IuU2luZ2xlRmlsZTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgYnVpbGRlci5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICAgICAgICBpZiAoYW5ndWxhckNvbXBpbGVyLmlnbm9yZUZvckRpYWdub3N0aWNzLmhhcyhzb3VyY2VGaWxlKSkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVHlwZVNjcmlwdCB3aWxsIHVzZSBjYWNoZWQgZGlhZ25vc3RpY3MgZm9yIGZpbGVzIHRoYXQgaGF2ZSBub3QgYmVlblxuICAgICAgICAgICAgLy8gY2hhbmdlZCBvciBhZmZlY3RlZCBmb3IgdGhpcyBidWlsZCB3aGVuIHVzaW5nIGluY3JlbWVudGFsIGJ1aWxkaW5nLlxuICAgICAgICAgICAgeWllbGQqIHByb2ZpbGVTeW5jKFxuICAgICAgICAgICAgICAnTkdfRElBR05PU1RJQ1NfU1lOVEFDVElDJyxcbiAgICAgICAgICAgICAgKCkgPT4gYnVpbGRlci5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlKSxcbiAgICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB5aWVsZCogcHJvZmlsZVN5bmMoXG4gICAgICAgICAgICAgICdOR19ESUFHTk9TVElDU19TRU1BTlRJQycsXG4gICAgICAgICAgICAgICgpID0+IGJ1aWxkZXIuZ2V0U2VtYW50aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlKSxcbiAgICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIC8vIERlY2xhcmF0aW9uIGZpbGVzIGNhbm5vdCBoYXZlIHRlbXBsYXRlIGRpYWdub3N0aWNzXG4gICAgICAgICAgICBpZiAoc291cmNlRmlsZS5pc0RlY2xhcmF0aW9uRmlsZSkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gT25seSByZXF1ZXN0IEFuZ3VsYXIgdGVtcGxhdGUgZGlhZ25vc3RpY3MgZm9yIGFmZmVjdGVkIGZpbGVzIHRvIGF2b2lkXG4gICAgICAgICAgICAvLyBvdmVyaGVhZCBvZiB0ZW1wbGF0ZSBkaWFnbm9zdGljcyBmb3IgdW5jaGFuZ2VkIGZpbGVzLlxuICAgICAgICAgICAgaWYgKGFmZmVjdGVkRmlsZXMuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGFuZ3VsYXJEaWFnbm9zdGljcyA9IHByb2ZpbGVTeW5jKFxuICAgICAgICAgICAgICAgICdOR19ESUFHTk9TVElDU19URU1QTEFURScsXG4gICAgICAgICAgICAgICAgKCkgPT4gYW5ndWxhckNvbXBpbGVyLmdldERpYWdub3N0aWNzRm9yRmlsZShzb3VyY2VGaWxlLCBvcHRpbWl6ZUZvciksXG4gICAgICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgZGlhZ25vc3RpY0NhY2hlLnNldChzb3VyY2VGaWxlLCBhbmd1bGFyRGlhZ25vc3RpY3MpO1xuICAgICAgICAgICAgICB5aWVsZCogYW5ndWxhckRpYWdub3N0aWNzO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gZGlhZ25vc3RpY0NhY2hlLmdldChzb3VyY2VGaWxlKTtcbiAgICAgICAgICAgICAgaWYgKGFuZ3VsYXJEaWFnbm9zdGljcykge1xuICAgICAgICAgICAgICAgIHlpZWxkKiBhbmd1bGFyRGlhZ25vc3RpY3M7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBwcm9maWxlU3luYygnTkdfRElBR05PU1RJQ1NfVE9UQUwnLCAoKSA9PiB7XG4gICAgICAgICAgZm9yIChjb25zdCBkaWFnbm9zdGljIG9mIGNvbGxlY3REaWFnbm9zdGljcygpKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljKGRpYWdub3N0aWMsIGhvc3QpO1xuICAgICAgICAgICAgaWYgKGRpYWdub3N0aWMuY2F0ZWdvcnkgPT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcikge1xuICAgICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2gobWVzc2FnZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaChtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZpbGVFbWl0dGVyID0gY3JlYXRlRmlsZUVtaXR0ZXIoXG4gICAgICAgICAgYnVpbGRlcixcbiAgICAgICAgICBtZXJnZVRyYW5zZm9ybWVycyhhbmd1bGFyQ29tcGlsZXIucHJlcGFyZUVtaXQoKS50cmFuc2Zvcm1lcnMsIHtcbiAgICAgICAgICAgIGJlZm9yZTogW3JlcGxhY2VCb290c3RyYXAoKCkgPT4gYnVpbGRlci5nZXRQcm9ncmFtKCkuZ2V0VHlwZUNoZWNrZXIoKSldLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIChzb3VyY2VGaWxlKSA9PiBhbmd1bGFyQ29tcGlsZXIuaW5jcmVtZW50YWxDb21waWxhdGlvbi5yZWNvcmRTdWNjZXNzZnVsRW1pdChzb3VyY2VGaWxlKSxcbiAgICAgICAgKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZChcbiAgICAgICAgeyBmaWx0ZXI6IGNvbXBpbGVyT3B0aW9ucy5hbGxvd0pzID8gL1xcLltjbV0/W2p0XXN4PyQvIDogL1xcLltjbV0/dHN4PyQvIH0sXG4gICAgICAgIChhcmdzKSA9PlxuICAgICAgICAgIHByb2ZpbGVBc3luYyhcbiAgICAgICAgICAgICdOR19FTUlUX1RTKicsXG4gICAgICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgIGFzc2VydC5vayhmaWxlRW1pdHRlciwgJ0ludmFsaWQgcGx1Z2luIGV4ZWN1dGlvbiBvcmRlcicpO1xuXG4gICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3QgPSBwbHVnaW5PcHRpb25zLmZpbGVSZXBsYWNlbWVudHM/LlthcmdzLnBhdGhdID8/IGFyZ3MucGF0aDtcblxuICAgICAgICAgICAgICAvLyBUaGUgZmlsZW5hbWUgaXMgY3VycmVudGx5IHVzZWQgYXMgYSBjYWNoZSBrZXkuIFNpbmNlIHRoZSBjYWNoZSBpcyBtZW1vcnkgb25seSxcbiAgICAgICAgICAgICAgLy8gdGhlIG9wdGlvbnMgY2Fubm90IGNoYW5nZSBhbmQgZG8gbm90IG5lZWQgdG8gYmUgcmVwcmVzZW50ZWQgaW4gdGhlIGtleS4gSWYgdGhlXG4gICAgICAgICAgICAgIC8vIGNhY2hlIGlzIGxhdGVyIHN0b3JlZCB0byBkaXNrLCB0aGVuIHRoZSBvcHRpb25zIHRoYXQgYWZmZWN0IHRyYW5zZm9ybSBvdXRwdXRcbiAgICAgICAgICAgICAgLy8gd291bGQgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUga2V5IGFzIHdlbGwgYXMgYSBjaGVjayBmb3IgYW55IGNoYW5nZSBvZiBjb250ZW50LlxuICAgICAgICAgICAgICBsZXQgY29udGVudHMgPSBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8udHlwZVNjcmlwdEZpbGVDYWNoZS5nZXQoXG4gICAgICAgICAgICAgICAgcGF0aFRvRmlsZVVSTChyZXF1ZXN0KS5ocmVmLFxuICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgIGlmIChjb250ZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdHlwZXNjcmlwdFJlc3VsdCA9IGF3YWl0IGZpbGVFbWl0dGVyKHJlcXVlc3QpO1xuICAgICAgICAgICAgICAgIGlmICghdHlwZXNjcmlwdFJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgLy8gTm8gVFMgcmVzdWx0IGluZGljYXRlcyB0aGUgZmlsZSBpcyBub3QgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBwcm9ncmFtLlxuICAgICAgICAgICAgICAgICAgLy8gSWYgYWxsb3dKcyBpcyBlbmFibGVkIGFuZCB0aGUgZmlsZSBpcyBKUyB0aGVuIGRlZmVyIHRvIHRoZSBuZXh0IGxvYWQgaG9vay5cbiAgICAgICAgICAgICAgICAgIGlmIChjb21waWxlck9wdGlvbnMuYWxsb3dKcyAmJiAvXFwuW2NtXT9qcyQvLnRlc3QocmVxdWVzdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgLy8gT3RoZXJ3aXNlIHJldHVybiBhbiBlcnJvclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgY3JlYXRlTWlzc2luZ0ZpbGVFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzLnBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyID8/ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSB0eXBlc2NyaXB0UmVzdWx0LmNvbnRlbnQgPz8gJyc7XG4gICAgICAgICAgICAgICAgLy8gVGhlIHByZS10cmFuc2Zvcm1lZCBkYXRhIGlzIHVzZWQgYXMgYSBjYWNoZSBrZXkuIFNpbmNlIHRoZSBjYWNoZSBpcyBtZW1vcnkgb25seSxcbiAgICAgICAgICAgICAgICAvLyB0aGUgb3B0aW9ucyBjYW5ub3QgY2hhbmdlIGFuZCBkbyBub3QgbmVlZCB0byBiZSByZXByZXNlbnRlZCBpbiB0aGUga2V5LiBJZiB0aGVcbiAgICAgICAgICAgICAgICAvLyBjYWNoZSBpcyBsYXRlciBzdG9yZWQgdG8gZGlzaywgdGhlbiB0aGUgb3B0aW9ucyB0aGF0IGFmZmVjdCB0cmFuc2Zvcm0gb3V0cHV0XG4gICAgICAgICAgICAgICAgLy8gd291bGQgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUga2V5IGFzIHdlbGwuXG4gICAgICAgICAgICAgICAgY29udGVudHMgPSBiYWJlbERhdGFDYWNoZS5nZXQoZGF0YSk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHRyYW5zZm9ybWVkRGF0YSA9IGF3YWl0IHRyYW5zZm9ybVdpdGhCYWJlbChyZXF1ZXN0LCBkYXRhLCBwbHVnaW5PcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgIGNvbnRlbnRzID0gQnVmZmVyLmZyb20odHJhbnNmb3JtZWREYXRhLCAndXRmLTgnKTtcbiAgICAgICAgICAgICAgICAgIGJhYmVsRGF0YUNhY2hlLnNldChkYXRhLCBjb250ZW50cyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LnR5cGVTY3JpcHRGaWxlQ2FjaGUuc2V0KFxuICAgICAgICAgICAgICAgICAgcGF0aFRvRmlsZVVSTChyZXF1ZXN0KS5ocmVmLFxuICAgICAgICAgICAgICAgICAgY29udGVudHMsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgY29udGVudHMsXG4gICAgICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRydWUsXG4gICAgICAgICAgKSxcbiAgICAgICk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLltjbV0/anMkLyB9LCAoYXJncykgPT5cbiAgICAgICAgcHJvZmlsZUFzeW5jKFxuICAgICAgICAgICdOR19FTUlUX0pTKicsXG4gICAgICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgLy8gVGhlIGZpbGVuYW1lIGlzIGN1cnJlbnRseSB1c2VkIGFzIGEgY2FjaGUga2V5LiBTaW5jZSB0aGUgY2FjaGUgaXMgbWVtb3J5IG9ubHksXG4gICAgICAgICAgICAvLyB0aGUgb3B0aW9ucyBjYW5ub3QgY2hhbmdlIGFuZCBkbyBub3QgbmVlZCB0byBiZSByZXByZXNlbnRlZCBpbiB0aGUga2V5LiBJZiB0aGVcbiAgICAgICAgICAgIC8vIGNhY2hlIGlzIGxhdGVyIHN0b3JlZCB0byBkaXNrLCB0aGVuIHRoZSBvcHRpb25zIHRoYXQgYWZmZWN0IHRyYW5zZm9ybSBvdXRwdXRcbiAgICAgICAgICAgIC8vIHdvdWxkIG5lZWQgdG8gYmUgYWRkZWQgdG8gdGhlIGtleSBhcyB3ZWxsIGFzIGEgY2hlY2sgZm9yIGFueSBjaGFuZ2Ugb2YgY29udGVudC5cbiAgICAgICAgICAgIGxldCBjb250ZW50cyA9IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5iYWJlbEZpbGVDYWNoZS5nZXQoYXJncy5wYXRoKTtcbiAgICAgICAgICAgIGlmIChjb250ZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBmcy5yZWFkRmlsZShhcmdzLnBhdGgsICd1dGYtOCcpO1xuICAgICAgICAgICAgICBjb25zdCB0cmFuc2Zvcm1lZERhdGEgPSBhd2FpdCB0cmFuc2Zvcm1XaXRoQmFiZWwoYXJncy5wYXRoLCBkYXRhLCBwbHVnaW5PcHRpb25zKTtcbiAgICAgICAgICAgICAgY29udGVudHMgPSBCdWZmZXIuZnJvbSh0cmFuc2Zvcm1lZERhdGEsICd1dGYtOCcpO1xuICAgICAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8uYmFiZWxGaWxlQ2FjaGUuc2V0KGFyZ3MucGF0aCwgY29udGVudHMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICksXG4gICAgICApO1xuXG4gICAgICBidWlsZC5vbkVuZCgocmVzdWx0KSA9PiB7XG4gICAgICAgIGlmIChzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcy5sZW5ndGgpIHtcbiAgICAgICAgICByZXN1bHQub3V0cHV0RmlsZXM/LnB1c2goLi4uc3R5bGVzaGVldFJlc291cmNlRmlsZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgbG9nQ3VtdWxhdGl2ZUR1cmF0aW9ucygpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlRmlsZUVtaXR0ZXIoXG4gIHByb2dyYW06IHRzLkJ1aWxkZXJQcm9ncmFtLFxuICB0cmFuc2Zvcm1lcnM6IHRzLkN1c3RvbVRyYW5zZm9ybWVycyA9IHt9LFxuICBvbkFmdGVyRW1pdD86IChzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKSA9PiB2b2lkLFxuKTogRmlsZUVtaXR0ZXIge1xuICByZXR1cm4gYXN5bmMgKGZpbGU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBwcm9ncmFtLmdldFNvdXJjZUZpbGUoZmlsZSk7XG4gICAgaWYgKCFzb3VyY2VGaWxlKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGxldCBjb250ZW50OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgcHJvZ3JhbS5lbWl0KFxuICAgICAgc291cmNlRmlsZSxcbiAgICAgIChmaWxlbmFtZSwgZGF0YSkgPT4ge1xuICAgICAgICBpZiAoL1xcLltjbV0/anMkLy50ZXN0KGZpbGVuYW1lKSkge1xuICAgICAgICAgIGNvbnRlbnQgPSBkYXRhO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgdW5kZWZpbmVkIC8qIGNhbmNlbGxhdGlvblRva2VuICovLFxuICAgICAgdW5kZWZpbmVkIC8qIGVtaXRPbmx5RHRzRmlsZXMgKi8sXG4gICAgICB0cmFuc2Zvcm1lcnMsXG4gICAgKTtcblxuICAgIG9uQWZ0ZXJFbWl0Py4oc291cmNlRmlsZSk7XG5cbiAgICByZXR1cm4geyBjb250ZW50LCBkZXBlbmRlbmNpZXM6IFtdIH07XG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRyYW5zZm9ybVdpdGhCYWJlbChcbiAgZmlsZW5hbWU6IHN0cmluZyxcbiAgZGF0YTogc3RyaW5nLFxuICBwbHVnaW5PcHRpb25zOiBDb21waWxlclBsdWdpbk9wdGlvbnMsXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICBjb25zdCBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24gPVxuICAgICEvW1xcXFwvXVtfZl0/ZXNtMjAxNVtcXFxcL10vLnRlc3QoZmlsZW5hbWUpICYmIC9hc3luY1xccytmdW5jdGlvblxccypcXCovLnRlc3QoZGF0YSk7XG4gIGNvbnN0IHNob3VsZExpbmsgPSBhd2FpdCByZXF1aXJlc0xpbmtpbmcoZmlsZW5hbWUsIGRhdGEpO1xuICBjb25zdCB1c2VJbnB1dFNvdXJjZW1hcCA9XG4gICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAgJiZcbiAgICAoISFwbHVnaW5PcHRpb25zLnRoaXJkUGFydHlTb3VyY2VtYXBzIHx8ICEvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vLnRlc3QoZmlsZW5hbWUpKTtcblxuICAvLyBJZiBubyBhZGRpdGlvbmFsIHRyYW5zZm9ybWF0aW9ucyBhcmUgbmVlZGVkLCByZXR1cm4gdGhlIGRhdGEgZGlyZWN0bHlcbiAgaWYgKCFmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24gJiYgIXBsdWdpbk9wdGlvbnMuYWR2YW5jZWRPcHRpbWl6YXRpb25zICYmICFzaG91bGRMaW5rKSB7XG4gICAgLy8gU3RyaXAgc291cmNlbWFwcyBpZiB0aGV5IHNob3VsZCBub3QgYmUgdXNlZFxuICAgIHJldHVybiB1c2VJbnB1dFNvdXJjZW1hcCA/IGRhdGEgOiBkYXRhLnJlcGxhY2UoL15cXC9cXC8jIHNvdXJjZU1hcHBpbmdVUkw9W15cXHJcXG5dKi9nbSwgJycpO1xuICB9XG5cbiAgY29uc3QgYW5ndWxhclBhY2thZ2UgPSAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL11AYW5ndWxhcltcXFxcL10vLnRlc3QoZmlsZW5hbWUpO1xuXG4gIGNvbnN0IGxpbmtlclBsdWdpbkNyZWF0b3IgPSBzaG91bGRMaW5rXG4gICAgPyAoXG4gICAgICAgIGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcpPihcbiAgICAgICAgICAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcsXG4gICAgICAgIClcbiAgICAgICkuY3JlYXRlRXMyMDE1TGlua2VyUGx1Z2luXG4gICAgOiB1bmRlZmluZWQ7XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdHJhbnNmb3JtQXN5bmMoZGF0YSwge1xuICAgIGZpbGVuYW1lLFxuICAgIGlucHV0U291cmNlTWFwOiAodXNlSW5wdXRTb3VyY2VtYXAgPyB1bmRlZmluZWQgOiBmYWxzZSkgYXMgdW5kZWZpbmVkLFxuICAgIHNvdXJjZU1hcHM6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwID8gJ2lubGluZScgOiBmYWxzZSxcbiAgICBjb21wYWN0OiBmYWxzZSxcbiAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICBiYWJlbHJjOiBmYWxzZSxcbiAgICBicm93c2Vyc2xpc3RDb25maWdGaWxlOiBmYWxzZSxcbiAgICBwbHVnaW5zOiBbXSxcbiAgICBwcmVzZXRzOiBbXG4gICAgICBbXG4gICAgICAgIGFuZ3VsYXJBcHBsaWNhdGlvblByZXNldCxcbiAgICAgICAge1xuICAgICAgICAgIGFuZ3VsYXJMaW5rZXI6IHtcbiAgICAgICAgICAgIHNob3VsZExpbmssXG4gICAgICAgICAgICBqaXRNb2RlOiBmYWxzZSxcbiAgICAgICAgICAgIGxpbmtlclBsdWdpbkNyZWF0b3IsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24sXG4gICAgICAgICAgb3B0aW1pemU6IHBsdWdpbk9wdGlvbnMuYWR2YW5jZWRPcHRpbWl6YXRpb25zICYmIHtcbiAgICAgICAgICAgIGxvb3NlRW51bXM6IGFuZ3VsYXJQYWNrYWdlLFxuICAgICAgICAgICAgcHVyZVRvcExldmVsOiBhbmd1bGFyUGFja2FnZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICBdLFxuICB9KTtcblxuICByZXR1cm4gcmVzdWx0Py5jb2RlID8/IGRhdGE7XG59XG5cbmZ1bmN0aW9uIGZpbmRBZmZlY3RlZEZpbGVzKFxuICBidWlsZGVyOiB0cy5FbWl0QW5kU2VtYW50aWNEaWFnbm9zdGljc0J1aWxkZXJQcm9ncmFtLFxuICB7IGlnbm9yZUZvckRpYWdub3N0aWNzLCBpZ25vcmVGb3JFbWl0LCBpbmNyZW1lbnRhbENvbXBpbGF0aW9uIH06IE5ndHNjUHJvZ3JhbVsnY29tcGlsZXInXSxcbik6IFNldDx0cy5Tb3VyY2VGaWxlPiB7XG4gIGNvbnN0IGFmZmVjdGVkRmlsZXMgPSBuZXcgU2V0PHRzLlNvdXJjZUZpbGU+KCk7XG5cbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnN0YW50LWNvbmRpdGlvblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGJ1aWxkZXIuZ2V0U2VtYW50aWNEaWFnbm9zdGljc09mTmV4dEFmZmVjdGVkRmlsZSh1bmRlZmluZWQsIChzb3VyY2VGaWxlKSA9PiB7XG4gICAgICAvLyBJZiB0aGUgYWZmZWN0ZWQgZmlsZSBpcyBhIFRUQyBzaGltLCBhZGQgdGhlIHNoaW0ncyBvcmlnaW5hbCBzb3VyY2UgZmlsZS5cbiAgICAgIC8vIFRoaXMgZW5zdXJlcyB0aGF0IGNoYW5nZXMgdGhhdCBhZmZlY3QgVFRDIGFyZSB0eXBlY2hlY2tlZCBldmVuIHdoZW4gdGhlIGNoYW5nZXNcbiAgICAgIC8vIGFyZSBvdGhlcndpc2UgdW5yZWxhdGVkIGZyb20gYSBUUyBwZXJzcGVjdGl2ZSBhbmQgZG8gbm90IHJlc3VsdCBpbiBJdnkgY29kZWdlbiBjaGFuZ2VzLlxuICAgICAgLy8gRm9yIGV4YW1wbGUsIGNoYW5naW5nIEBJbnB1dCBwcm9wZXJ0eSB0eXBlcyBvZiBhIGRpcmVjdGl2ZSB1c2VkIGluIGFub3RoZXIgY29tcG9uZW50J3NcbiAgICAgIC8vIHRlbXBsYXRlLlxuICAgICAgLy8gQSBUVEMgc2hpbSBpcyBhIGZpbGUgdGhhdCBoYXMgYmVlbiBpZ25vcmVkIGZvciBkaWFnbm9zdGljcyBhbmQgaGFzIGEgZmlsZW5hbWUgZW5kaW5nIGluIGAubmd0eXBlY2hlY2sudHNgLlxuICAgICAgaWYgKGlnbm9yZUZvckRpYWdub3N0aWNzLmhhcyhzb3VyY2VGaWxlKSAmJiBzb3VyY2VGaWxlLmZpbGVOYW1lLmVuZHNXaXRoKCcubmd0eXBlY2hlY2sudHMnKSkge1xuICAgICAgICAvLyBUaGlzIGZpbGUgbmFtZSBjb252ZXJzaW9uIHJlbGllcyBvbiBpbnRlcm5hbCBjb21waWxlciBsb2dpYyBhbmQgc2hvdWxkIGJlIGNvbnZlcnRlZFxuICAgICAgICAvLyB0byBhbiBvZmZpY2lhbCBtZXRob2Qgd2hlbiBhdmFpbGFibGUuIDE1IGlzIGxlbmd0aCBvZiBgLm5ndHlwZWNoZWNrLnRzYFxuICAgICAgICBjb25zdCBvcmlnaW5hbEZpbGVuYW1lID0gc291cmNlRmlsZS5maWxlTmFtZS5zbGljZSgwLCAtMTUpICsgJy50cyc7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsU291cmNlRmlsZSA9IGJ1aWxkZXIuZ2V0U291cmNlRmlsZShvcmlnaW5hbEZpbGVuYW1lKTtcbiAgICAgICAgaWYgKG9yaWdpbmFsU291cmNlRmlsZSkge1xuICAgICAgICAgIGFmZmVjdGVkRmlsZXMuYWRkKG9yaWdpbmFsU291cmNlRmlsZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuXG4gICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGFmZmVjdGVkRmlsZXMuYWRkKHJlc3VsdC5hZmZlY3RlZCBhcyB0cy5Tb3VyY2VGaWxlKTtcbiAgfVxuXG4gIC8vIEEgZmlsZSBpcyBhbHNvIGFmZmVjdGVkIGlmIHRoZSBBbmd1bGFyIGNvbXBpbGVyIHJlcXVpcmVzIGl0IHRvIGJlIGVtaXR0ZWRcbiAgZm9yIChjb25zdCBzb3VyY2VGaWxlIG9mIGJ1aWxkZXIuZ2V0U291cmNlRmlsZXMoKSkge1xuICAgIGlmIChpZ25vcmVGb3JFbWl0Lmhhcyhzb3VyY2VGaWxlKSB8fCBpbmNyZW1lbnRhbENvbXBpbGF0aW9uLnNhZmVUb1NraXBFbWl0KHNvdXJjZUZpbGUpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBhZmZlY3RlZEZpbGVzLmFkZChzb3VyY2VGaWxlKTtcbiAgfVxuXG4gIHJldHVybiBhZmZlY3RlZEZpbGVzO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVNaXNzaW5nRmlsZUVycm9yKHJlcXVlc3Q6IHN0cmluZywgb3JpZ2luYWw6IHN0cmluZywgcm9vdDogc3RyaW5nKTogUGFydGlhbE1lc3NhZ2Uge1xuICBjb25zdCBlcnJvciA9IHtcbiAgICB0ZXh0OiBgRmlsZSAnJHtwYXRoLnJlbGF0aXZlKHJvb3QsIHJlcXVlc3QpfScgaXMgbWlzc2luZyBmcm9tIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uLmAsXG4gICAgbm90ZXM6IFtcbiAgICAgIHtcbiAgICAgICAgdGV4dDogYEVuc3VyZSB0aGUgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0gdmlhIHRoZSAnZmlsZXMnIG9yICdpbmNsdWRlJyBwcm9wZXJ0eS5gLFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xuXG4gIGlmIChyZXF1ZXN0ICE9PSBvcmlnaW5hbCkge1xuICAgIGVycm9yLm5vdGVzLnB1c2goe1xuICAgICAgdGV4dDogYEZpbGUgaXMgcmVxdWVzdGVkIGZyb20gYSBmaWxlIHJlcGxhY2VtZW50IG9mICcke3BhdGgucmVsYXRpdmUocm9vdCwgb3JpZ2luYWwpfScuYCxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBlcnJvcjtcbn1cbiJdfQ==