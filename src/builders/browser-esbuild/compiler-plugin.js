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
const assert = __importStar(require("assert"));
const fs_1 = require("fs");
const os_1 = require("os");
const path = __importStar(require("path"));
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
const USING_WINDOWS = (0, os_1.platform)() === 'win32';
const WINDOWS_SEP_REGEXP = new RegExp(`\\${path.win32.sep}`, 'g');
class SourceFileCache extends Map {
    constructor() {
        super(...arguments);
        this.modifiedFiles = new Set();
        this.babelFileCache = new Map();
    }
    invalidate(files) {
        this.modifiedFiles.clear();
        for (let file of files) {
            this.babelFileCache.delete(file);
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
                            text: `To control ECMA version and features use the Browerslist configuration. ' +
              'For more information, see https://github.com/browserslist/browserslist#queries'`,
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
                function* collectDiagnostics() {
                    // Collect program level diagnostics
                    yield* builder.getConfigFileParsingDiagnostics();
                    yield* angularCompiler.getOptionDiagnostics();
                    yield* builder.getOptionsDiagnostics();
                    yield* builder.getGlobalDiagnostics();
                    // Collect source file specific diagnostics
                    const affectedFiles = findAffectedFiles(builder, angularCompiler);
                    const optimizeFor = affectedFiles.size > 1 ? OptimizeFor.WholeProgram : OptimizeFor.SingleFile;
                    for (const sourceFile of builder.getSourceFiles()) {
                        if (angularCompiler.ignoreForDiagnostics.has(sourceFile)) {
                            continue;
                        }
                        // TypeScript will use cached diagnostics for files that have not been
                        // changed or affected for this build when using incremental building.
                        yield* (0, profiling_1.profileSync)('NG_DIAGNOSTICS_SYNTACTIC', () => builder.getSyntacticDiagnostics(sourceFile), true);
                        yield* (0, profiling_1.profileSync)('NG_DIAGNOSTICS_SEMANTIC', () => builder.getSemanticDiagnostics(sourceFile), true);
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
                var _a, _b, _c;
                assert.ok(fileEmitter, 'Invalid plugin execution order');
                const typescriptResult = await fileEmitter((_b = (_a = pluginOptions.fileReplacements) === null || _a === void 0 ? void 0 : _a[args.path]) !== null && _b !== void 0 ? _b : args.path);
                if (!typescriptResult) {
                    // No TS result indicates the file is not part of the TypeScript program.
                    // If allowJs is enabled and the file is JS then defer to the next load hook.
                    if (compilerOptions.allowJs && /\.[cm]?js$/.test(args.path)) {
                        return undefined;
                    }
                    // Otherwise return an error
                    return {
                        errors: [
                            {
                                text: `File '${args.path}' is missing from the TypeScript compilation.`,
                                notes: [
                                    {
                                        text: `Ensure the file is part of the TypeScript program via the 'files' or 'include' property.`,
                                    },
                                ],
                            },
                        ],
                    };
                }
                const data = (_c = typescriptResult.content) !== null && _c !== void 0 ? _c : '';
                // The pre-transformed data is used as a cache key. Since the cache is memory only,
                // the options cannot change and do not need to be represented in the key. If the
                // cache is later stored to disk, then the options that affect transform output
                // would need to be added to the key as well.
                let contents = babelDataCache.get(data);
                if (contents === undefined) {
                    contents = await transformWithBabel(args.path, data, pluginOptions);
                    babelDataCache.set(data, contents);
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
                    const data = await fs_1.promises.readFile(args.path, 'utf-8');
                    contents = await transformWithBabel(args.path, data, pluginOptions);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILHNDQUE2QztBQUM3QywrQ0FBaUM7QUFTakMsMkJBQW9DO0FBQ3BDLDJCQUE4QjtBQUM5QiwyQ0FBNkI7QUFDN0IsNERBQTRCO0FBQzVCLGtGQUF1RTtBQUN2RSwrREFBNkQ7QUFDN0QsbURBQXFEO0FBQ3JELDJDQUtxQjtBQUNyQiwrQ0FBb0c7QUFVcEc7Ozs7Ozs7R0FPRztBQUNILFNBQVMsK0JBQStCLENBQ3RDLElBQXFDLEVBQ3JDLElBQThCLEVBQzlCLFVBQW1CO0lBRW5CLElBQUksSUFBSSxHQUFHLG9CQUFFLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztJQUNoRixJQUFJLFVBQVUsRUFBRTtRQUNkLElBQUksR0FBRyxVQUFVLEdBQUcsSUFBSSxDQUFDO0tBQzFCO0lBRUQsTUFBTSxJQUFJLEdBQWdCLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFFbkMsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO1FBQ2IsSUFBSSxDQUFDLFFBQVEsR0FBRztZQUNkLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVE7WUFDeEIsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO1NBQ3BCLENBQUM7UUFFRiw0RkFBNEY7UUFDNUYsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ2QsTUFBTSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsR0FBRyxvQkFBRSxDQUFDLDZCQUE2QixD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LElBQUksT0FBTyxDQUFDLGNBQWMsRUFBRSxFQUFFO1FBQ2pELElBQUksYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxzQkFBc0IsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDdEYsU0FBUztTQUNWO1FBRUQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztLQUMvQjtJQUVELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBDb21waWxlckhvc3QsIE5ndHNjUHJvZ3JhbSB9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQgeyB0cmFuc2Zvcm1Bc3luYyB9IGZyb20gJ0BiYWJlbC9jb3JlJztcbmltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHR5cGUge1xuICBPblN0YXJ0UmVzdWx0LFxuICBPdXRwdXRGaWxlLFxuICBQYXJ0aWFsTWVzc2FnZSxcbiAgUGFydGlhbE5vdGUsXG4gIFBsdWdpbixcbiAgUGx1Z2luQnVpbGQsXG59IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgcHJvbWlzZXMgYXMgZnMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJ29zJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgYW5ndWxhckFwcGxpY2F0aW9uUHJlc2V0IGZyb20gJy4uLy4uL2JhYmVsL3ByZXNldHMvYXBwbGljYXRpb24nO1xuaW1wb3J0IHsgcmVxdWlyZXNMaW5raW5nIH0gZnJvbSAnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcbmltcG9ydCB7XG4gIGxvZ0N1bXVsYXRpdmVEdXJhdGlvbnMsXG4gIHByb2ZpbGVBc3luYyxcbiAgcHJvZmlsZVN5bmMsXG4gIHJlc2V0Q3VtdWxhdGl2ZUR1cmF0aW9ucyxcbn0gZnJvbSAnLi9wcm9maWxpbmcnO1xuaW1wb3J0IHsgQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsIGJ1bmRsZVN0eWxlc2hlZXRGaWxlLCBidW5kbGVTdHlsZXNoZWV0VGV4dCB9IGZyb20gJy4vc3R5bGVzaGVldHMnO1xuXG5pbnRlcmZhY2UgRW1pdEZpbGVSZXN1bHQge1xuICBjb250ZW50Pzogc3RyaW5nO1xuICBtYXA/OiBzdHJpbmc7XG4gIGRlcGVuZGVuY2llczogcmVhZG9ubHkgc3RyaW5nW107XG4gIGhhc2g/OiBVaW50OEFycmF5O1xufVxudHlwZSBGaWxlRW1pdHRlciA9IChmaWxlOiBzdHJpbmcpID0+IFByb21pc2U8RW1pdEZpbGVSZXN1bHQgfCB1bmRlZmluZWQ+O1xuXG4vKipcbiAqIENvbnZlcnRzIFR5cGVTY3JpcHQgRGlhZ25vc3RpYyByZWxhdGVkIGluZm9ybWF0aW9uIGludG8gYW4gZXNidWlsZCBjb21wYXRpYmxlIG5vdGUgb2JqZWN0LlxuICogUmVsYXRlZCBpbmZvcm1hdGlvbiBpcyBhIHN1YnNldCBvZiBhIGZ1bGwgVHlwZVNjcmlwdCBEaWFnbm9zdGljIGFuZCBhbHNvIHVzZWQgZm9yIGRpYWdub3N0aWNcbiAqIG5vdGVzIGFzc29jaWF0ZWQgd2l0aCB0aGUgbWFpbiBEaWFnbm9zdGljLlxuICogQHBhcmFtIGluZm8gVGhlIFR5cGVTY3JpcHQgZGlhZ25vc3RpYyByZWxhdGl2ZSBpbmZvcm1hdGlvbiB0byBjb252ZXJ0LlxuICogQHBhcmFtIGhvc3QgQSBUeXBlU2NyaXB0IEZvcm1hdERpYWdub3N0aWNzSG9zdCBpbnN0YW5jZSB0byB1c2UgZHVyaW5nIGNvbnZlcnNpb24uXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIGRpYWdub3N0aWMgbWVzc2FnZSBhcyBhIFBhcnRpYWxNZXNzYWdlIG9iamVjdFxuICovXG5mdW5jdGlvbiBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWNJbmZvKFxuICBpbmZvOiB0cy5EaWFnbm9zdGljUmVsYXRlZEluZm9ybWF0aW9uLFxuICBob3N0OiB0cy5Gb3JtYXREaWFnbm9zdGljc0hvc3QsXG4gIHRleHRQcmVmaXg/OiBzdHJpbmcsXG4pOiBQYXJ0aWFsTm90ZSB7XG4gIGxldCB0ZXh0ID0gdHMuZmxhdHRlbkRpYWdub3N0aWNNZXNzYWdlVGV4dChpbmZvLm1lc3NhZ2VUZXh0LCBob3N0LmdldE5ld0xpbmUoKSk7XG4gIGlmICh0ZXh0UHJlZml4KSB7XG4gICAgdGV4dCA9IHRleHRQcmVmaXggKyB0ZXh0O1xuICB9XG5cbiAgY29uc3Qgbm90ZTogUGFydGlhbE5vdGUgPSB7IHRleHQgfTtcblxuICBpZiAoaW5mby5maWxlKSB7XG4gICAgbm90ZS5sb2NhdGlvbiA9IHtcbiAgICAgIGZpbGU6IGluZm8uZmlsZS5maWxlTmFtZSxcbiAgICAgIGxlbmd0aDogaW5mby5sZW5ndGgsXG4gICAgfTtcblxuICAgIC8vIENhbGN1bGF0ZSB0aGUgbGluZS9jb2x1bW4gbG9jYXRpb24gYW5kIGV4dHJhY3QgdGhlIGZ1bGwgbGluZSB0ZXh0IHRoYXQgaGFzIHRoZSBkaWFnbm9zdGljXG4gICAgaWYgKGluZm8uc3RhcnQpIHtcbiAgICAgIGNvbnN0IHsgbGluZSwgY2hhcmFjdGVyIH0gPSB0cy5nZXRMaW5lQW5kQ2hhcmFjdGVyT2ZQb3NpdGlvbihpbmZvLmZpbGUsIGluZm8uc3RhcnQpO1xuICAgICAgbm90ZS5sb2NhdGlvbi5saW5lID0gbGluZSArIDE7XG4gICAgICBub3RlLmxvY2F0aW9uLmNvbHVtbiA9IGNoYXJhY3RlcjtcblxuICAgICAgLy8gVGhlIHN0YXJ0IHBvc2l0aW9uIGZvciB0aGUgc2xpY2UgaXMgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiB0aGUgZXJyb3IgbGluZVxuICAgICAgY29uc3QgbGluZVN0YXJ0UG9zaXRpb24gPSB0cy5nZXRQb3NpdGlvbk9mTGluZUFuZENoYXJhY3RlcihpbmZvLmZpbGUsIGxpbmUsIDApO1xuXG4gICAgICAvLyBUaGUgZW5kIHBvc2l0aW9uIGZvciB0aGUgc2xpY2UgaXMgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiB0aGUgbmV4dCBsaW5lIG9yIHRoZSBsZW5ndGggb2ZcbiAgICAgIC8vIHRoZSBlbnRpcmUgZmlsZSBpZiB0aGUgbGluZSBpcyB0aGUgbGFzdCBsaW5lIG9mIHRoZSBmaWxlIChnZXRQb3NpdGlvbk9mTGluZUFuZENoYXJhY3RlclxuICAgICAgLy8gd2lsbCBlcnJvciBpZiBhIG5vbmV4aXN0ZW50IGxpbmUgaXMgcGFzc2VkKS5cbiAgICAgIGNvbnN0IHsgbGluZTogbGFzdExpbmVPZkZpbGUgfSA9IHRzLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKFxuICAgICAgICBpbmZvLmZpbGUsXG4gICAgICAgIGluZm8uZmlsZS50ZXh0Lmxlbmd0aCAtIDEsXG4gICAgICApO1xuICAgICAgY29uc3QgbGluZUVuZFBvc2l0aW9uID1cbiAgICAgICAgbGluZSA8IGxhc3RMaW5lT2ZGaWxlXG4gICAgICAgICAgPyB0cy5nZXRQb3NpdGlvbk9mTGluZUFuZENoYXJhY3RlcihpbmZvLmZpbGUsIGxpbmUgKyAxLCAwKVxuICAgICAgICAgIDogaW5mby5maWxlLnRleHQubGVuZ3RoO1xuXG4gICAgICBub3RlLmxvY2F0aW9uLmxpbmVUZXh0ID0gaW5mby5maWxlLnRleHQuc2xpY2UobGluZVN0YXJ0UG9zaXRpb24sIGxpbmVFbmRQb3NpdGlvbikudHJpbUVuZCgpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBub3RlO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGEgVHlwZVNjcmlwdCBEaWFnbm9zdGljIG1lc3NhZ2UgaW50byBhbiBlc2J1aWxkIGNvbXBhdGlibGUgbWVzc2FnZSBvYmplY3QuXG4gKiBAcGFyYW0gZGlhZ25vc3RpYyBUaGUgVHlwZVNjcmlwdCBkaWFnbm9zdGljIHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0gaG9zdCBBIFR5cGVTY3JpcHQgRm9ybWF0RGlhZ25vc3RpY3NIb3N0IGluc3RhbmNlIHRvIHVzZSBkdXJpbmcgY29udmVyc2lvbi5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgZGlhZ25vc3RpYyBtZXNzYWdlIGFzIGEgUGFydGlhbE1lc3NhZ2Ugb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpYyhcbiAgZGlhZ25vc3RpYzogdHMuRGlhZ25vc3RpYyxcbiAgaG9zdDogdHMuRm9ybWF0RGlhZ25vc3RpY3NIb3N0LFxuKTogUGFydGlhbE1lc3NhZ2Uge1xuICBsZXQgY29kZVByZWZpeCA9ICdUUyc7XG4gIGxldCBjb2RlID0gYCR7ZGlhZ25vc3RpYy5jb2RlfWA7XG4gIGlmIChkaWFnbm9zdGljLnNvdXJjZSA9PT0gJ25ndHNjJykge1xuICAgIGNvZGVQcmVmaXggPSAnTkcnO1xuICAgIC8vIFJlbW92ZSBgLTk5YCBBbmd1bGFyIHByZWZpeCBmcm9tIGRpYWdub3N0aWMgY29kZVxuICAgIGNvZGUgPSBjb2RlLnNsaWNlKDMpO1xuICB9XG5cbiAgY29uc3QgbWVzc2FnZTogUGFydGlhbE1lc3NhZ2UgPSB7XG4gICAgLi4uY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljSW5mbyhkaWFnbm9zdGljLCBob3N0LCBgJHtjb2RlUHJlZml4fSR7Y29kZX06IGApLFxuICAgIC8vIFN0b3JlIG9yaWdpbmFsIGRpYWdub3N0aWMgZm9yIHJlZmVyZW5jZSBpZiBuZWVkZWQgZG93bnN0cmVhbVxuICAgIGRldGFpbDogZGlhZ25vc3RpYyxcbiAgfTtcblxuICBpZiAoZGlhZ25vc3RpYy5yZWxhdGVkSW5mb3JtYXRpb24/Lmxlbmd0aCkge1xuICAgIG1lc3NhZ2Uubm90ZXMgPSBkaWFnbm9zdGljLnJlbGF0ZWRJbmZvcm1hdGlvbi5tYXAoKGluZm8pID0+XG4gICAgICBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWNJbmZvKGluZm8sIGhvc3QpLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gbWVzc2FnZTtcbn1cblxuY29uc3QgVVNJTkdfV0lORE9XUyA9IHBsYXRmb3JtKCkgPT09ICd3aW4zMic7XG5jb25zdCBXSU5ET1dTX1NFUF9SRUdFWFAgPSBuZXcgUmVnRXhwKGBcXFxcJHtwYXRoLndpbjMyLnNlcH1gLCAnZycpO1xuXG5leHBvcnQgY2xhc3MgU291cmNlRmlsZUNhY2hlIGV4dGVuZHMgTWFwPHN0cmluZywgdHMuU291cmNlRmlsZT4ge1xuICByZWFkb25seSBtb2RpZmllZEZpbGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIHJlYWRvbmx5IGJhYmVsRmlsZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblxuICBpbnZhbGlkYXRlKGZpbGVzOiBJdGVyYWJsZTxzdHJpbmc+KTogdm9pZCB7XG4gICAgdGhpcy5tb2RpZmllZEZpbGVzLmNsZWFyKCk7XG4gICAgZm9yIChsZXQgZmlsZSBvZiBmaWxlcykge1xuICAgICAgdGhpcy5iYWJlbEZpbGVDYWNoZS5kZWxldGUoZmlsZSk7XG5cbiAgICAgIC8vIE5vcm1hbGl6ZSBzZXBhcmF0b3JzIHRvIGFsbG93IG1hdGNoaW5nIFR5cGVTY3JpcHQgSG9zdCBwYXRoc1xuICAgICAgaWYgKFVTSU5HX1dJTkRPV1MpIHtcbiAgICAgICAgZmlsZSA9IGZpbGUucmVwbGFjZShXSU5ET1dTX1NFUF9SRUdFWFAsIHBhdGgucG9zaXguc2VwKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5kZWxldGUoZmlsZSk7XG4gICAgICB0aGlzLm1vZGlmaWVkRmlsZXMuYWRkKGZpbGUpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbXBpbGVyUGx1Z2luT3B0aW9ucyB7XG4gIHNvdXJjZW1hcDogYm9vbGVhbjtcbiAgdHNjb25maWc6IHN0cmluZztcbiAgYWR2YW5jZWRPcHRpbWl6YXRpb25zPzogYm9vbGVhbjtcbiAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM/OiBib29sZWFuO1xuICBmaWxlUmVwbGFjZW1lbnRzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgc291cmNlRmlsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlO1xufVxuXG4vLyBUaGlzIGlzIGEgbm9uLXdhdGNoIHZlcnNpb24gb2YgdGhlIGNvbXBpbGVyIGNvZGUgZnJvbSBgQG5ndG9vbHMvd2VicGFja2AgYXVnbWVudGVkIGZvciBlc2J1aWxkXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICBwbHVnaW5PcHRpb25zOiBDb21waWxlclBsdWdpbk9wdGlvbnMsXG4gIHN0eWxlT3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsXG4pOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLWNvbXBpbGVyJyxcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuICAgIGFzeW5jIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgbGV0IHNldHVwV2FybmluZ3M6IFBhcnRpYWxNZXNzYWdlW10gfCB1bmRlZmluZWQ7XG5cbiAgICAgIC8vIFRoaXMgdXNlcyBhIHdyYXBwZWQgZHluYW1pYyBpbXBvcnQgdG8gbG9hZCBgQGFuZ3VsYXIvY29tcGlsZXItY2xpYCB3aGljaCBpcyBFU00uXG4gICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3IgcmV0YWluaW5nIGR5bmFtaWMgaW1wb3J0cyB0aGlzIHdvcmthcm91bmQgY2FuIGJlIGRyb3BwZWQuXG4gICAgICBjb25zdCB7IEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QsIE5ndHNjUHJvZ3JhbSwgT3B0aW1pemVGb3IsIHJlYWRDb25maWd1cmF0aW9uIH0gPVxuICAgICAgICBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpPignQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk7XG5cbiAgICAgIC8vIFRlbXBvcmFyeSBkZWVwIGltcG9ydCBmb3IgdHJhbnNmb3JtZXIgc3VwcG9ydFxuICAgICAgY29uc3Qge1xuICAgICAgICBtZXJnZVRyYW5zZm9ybWVycyxcbiAgICAgICAgcmVwbGFjZUJvb3RzdHJhcCxcbiAgICAgIH0gPSByZXF1aXJlKCdAbmd0b29scy93ZWJwYWNrL3NyYy9pdnkvdHJhbnNmb3JtYXRpb24nKTtcblxuICAgICAgLy8gU2V0dXAgZGVmaW5lcyBiYXNlZCBvbiB0aGUgdmFsdWVzIHByb3ZpZGVkIGJ5IHRoZSBBbmd1bGFyIGNvbXBpbGVyLWNsaVxuICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lID8/PSB7fTtcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QpKSB7XG4gICAgICAgIGlmIChrZXkgaW4gYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lKSB7XG4gICAgICAgICAgLy8gU2tpcCBrZXlzIHRoYXQgaGF2ZSBiZWVuIG1hbnVhbGx5IHByb3ZpZGVkXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZXNidWlsZCByZXF1aXJlcyB2YWx1ZXMgdG8gYmUgYSBzdHJpbmcgKGFjdHVhbCBzdHJpbmdzIG5lZWQgdG8gYmUgcXVvdGVkKS5cbiAgICAgICAgLy8gSW4gdGhpcyBjYXNlLCBhbGwgcHJvdmlkZWQgdmFsdWVzIGFyZSBib29sZWFucy5cbiAgICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lW2tleV0gPSB2YWx1ZS50b1N0cmluZygpO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgdHNjb25maWcgaXMgbG9hZGVkIGluIHNldHVwIGluc3RlYWQgb2YgaW4gc3RhcnQgdG8gYWxsb3cgdGhlIGVzYnVpbGQgdGFyZ2V0IGJ1aWxkIG9wdGlvbiB0byBiZSBtb2RpZmllZC5cbiAgICAgIC8vIGVzYnVpbGQgYnVpbGQgb3B0aW9ucyBjYW4gb25seSBiZSBtb2RpZmllZCBpbiBzZXR1cCBwcmlvciB0byBzdGFydGluZyB0aGUgYnVpbGQuXG4gICAgICBjb25zdCB7XG4gICAgICAgIG9wdGlvbnM6IGNvbXBpbGVyT3B0aW9ucyxcbiAgICAgICAgcm9vdE5hbWVzLFxuICAgICAgICBlcnJvcnM6IGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcyxcbiAgICAgIH0gPSBwcm9maWxlU3luYygnTkdfUkVBRF9DT05GSUcnLCAoKSA9PlxuICAgICAgICByZWFkQ29uZmlndXJhdGlvbihwbHVnaW5PcHRpb25zLnRzY29uZmlnLCB7XG4gICAgICAgICAgbm9FbWl0T25FcnJvcjogZmFsc2UsXG4gICAgICAgICAgc3VwcHJlc3NPdXRwdXRQYXRoQ2hlY2s6IHRydWUsXG4gICAgICAgICAgb3V0RGlyOiB1bmRlZmluZWQsXG4gICAgICAgICAgaW5saW5lU291cmNlczogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgaW5saW5lU291cmNlTWFwOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxuICAgICAgICAgIG1hcFJvb3Q6IHVuZGVmaW5lZCxcbiAgICAgICAgICBzb3VyY2VSb290OiB1bmRlZmluZWQsXG4gICAgICAgICAgZGVjbGFyYXRpb246IGZhbHNlLFxuICAgICAgICAgIGRlY2xhcmF0aW9uTWFwOiBmYWxzZSxcbiAgICAgICAgICBhbGxvd0VtcHR5Q29kZWdlbkZpbGVzOiBmYWxzZSxcbiAgICAgICAgICBhbm5vdGF0aW9uc0FzOiAnZGVjb3JhdG9ycycsXG4gICAgICAgICAgZW5hYmxlUmVzb3VyY2VJbmxpbmluZzogZmFsc2UsXG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgICAgaWYgKGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPT09IHVuZGVmaW5lZCB8fCBjb21waWxlck9wdGlvbnMudGFyZ2V0IDwgdHMuU2NyaXB0VGFyZ2V0LkVTMjAyMikge1xuICAgICAgICAvLyBJZiAndXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHMnIGlzIGFscmVhZHkgZGVmaW5lZCBpbiB0aGUgdXNlcnMgcHJvamVjdCBsZWF2ZSB0aGUgdmFsdWUgYXMgaXMuXG4gICAgICAgIC8vIE90aGVyd2lzZSBmYWxsYmFjayB0byBmYWxzZSBkdWUgdG8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy80NTk5NVxuICAgICAgICAvLyB3aGljaCBicmVha3MgdGhlIGRlcHJlY2F0ZWQgYEBFZmZlY3RzYCBOR1JYIGRlY29yYXRvciBhbmQgcG90ZW50aWFsbHkgb3RoZXIgZXhpc3RpbmcgY29kZSBhcyB3ZWxsLlxuICAgICAgICBjb21waWxlck9wdGlvbnMudGFyZ2V0ID0gdHMuU2NyaXB0VGFyZ2V0LkVTMjAyMjtcbiAgICAgICAgY29tcGlsZXJPcHRpb25zLnVzZURlZmluZUZvckNsYXNzRmllbGRzID8/PSBmYWxzZTtcblxuICAgICAgICAoc2V0dXBXYXJuaW5ncyA/Pz0gW10pLnB1c2goe1xuICAgICAgICAgIHRleHQ6XG4gICAgICAgICAgICAnVHlwZVNjcmlwdCBjb21waWxlciBvcHRpb25zIFwidGFyZ2V0XCIgYW5kIFwidXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHNcIiBhcmUgc2V0IHRvIFwiRVMyMDIyXCIgYW5kICcgK1xuICAgICAgICAgICAgJ1wiZmFsc2VcIiByZXNwZWN0aXZlbHkgYnkgdGhlIEFuZ3VsYXIgQ0xJLicsXG4gICAgICAgICAgbG9jYXRpb246IHsgZmlsZTogcGx1Z2luT3B0aW9ucy50c2NvbmZpZyB9LFxuICAgICAgICAgIG5vdGVzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHRleHQ6IGBUbyBjb250cm9sIEVDTUEgdmVyc2lvbiBhbmQgZmVhdHVyZXMgdXNlIHRoZSBCcm93ZXJzbGlzdCBjb25maWd1cmF0aW9uLiAnICtcbiAgICAgICAgICAgICAgJ0ZvciBtb3JlIGluZm9ybWF0aW9uLCBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2Jyb3dzZXJzbGlzdC9icm93c2Vyc2xpc3QjcXVlcmllcydgLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIGZpbGUgZW1pdHRlciBjcmVhdGVkIGR1cmluZyBgb25TdGFydGAgdGhhdCB3aWxsIGJlIHVzZWQgZHVyaW5nIHRoZSBidWlsZCBpbiBgb25Mb2FkYCBjYWxsYmFja3MgZm9yIFRTIGZpbGVzXG4gICAgICBsZXQgZmlsZUVtaXR0ZXI6IEZpbGVFbWl0dGVyIHwgdW5kZWZpbmVkO1xuXG4gICAgICAvLyBUaGUgc3R5bGVzaGVldCByZXNvdXJjZXMgZnJvbSBjb21wb25lbnQgc3R5bGVzaGVldHMgdGhhdCB3aWxsIGJlIGFkZGVkIHRvIHRoZSBidWlsZCByZXN1bHRzIG91dHB1dCBmaWxlc1xuICAgICAgbGV0IHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzOiBPdXRwdXRGaWxlW107XG5cbiAgICAgIGxldCBwcmV2aW91c0J1aWxkZXI6IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0gfCB1bmRlZmluZWQ7XG4gICAgICBsZXQgcHJldmlvdXNBbmd1bGFyUHJvZ3JhbTogTmd0c2NQcm9ncmFtIHwgdW5kZWZpbmVkO1xuICAgICAgY29uc3QgYmFiZWxEYXRhQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgICAgY29uc3QgZGlhZ25vc3RpY0NhY2hlID0gbmV3IFdlYWtNYXA8dHMuU291cmNlRmlsZSwgdHMuRGlhZ25vc3RpY1tdPigpO1xuXG4gICAgICBidWlsZC5vblN0YXJ0KGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0OiBPblN0YXJ0UmVzdWx0ID0ge1xuICAgICAgICAgIHdhcm5pbmdzOiBzZXR1cFdhcm5pbmdzLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFJlc2V0IHRoZSBzZXR1cCB3YXJuaW5ncyBzbyB0aGF0IHRoZXkgYXJlIG9ubHkgc2hvd24gZHVyaW5nIHRoZSBmaXJzdCBidWlsZC5cbiAgICAgICAgc2V0dXBXYXJuaW5ncyA9IHVuZGVmaW5lZDtcblxuICAgICAgICAvLyBSZXNldCBkZWJ1ZyBwZXJmb3JtYW5jZSB0cmFja2luZ1xuICAgICAgICByZXNldEN1bXVsYXRpdmVEdXJhdGlvbnMoKTtcblxuICAgICAgICAvLyBSZXNldCBzdHlsZXNoZWV0IHJlc291cmNlIG91dHB1dCBmaWxlc1xuICAgICAgICBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyA9IFtdO1xuXG4gICAgICAgIC8vIENyZWF0ZSBUeXBlU2NyaXB0IGNvbXBpbGVyIGhvc3RcbiAgICAgICAgY29uc3QgaG9zdCA9IHRzLmNyZWF0ZUluY3JlbWVudGFsQ29tcGlsZXJIb3N0KGNvbXBpbGVyT3B0aW9ucyk7XG5cbiAgICAgICAgLy8gVGVtcG9yYXJpbHkgcHJvY2VzcyBleHRlcm5hbCByZXNvdXJjZXMgdmlhIHJlYWRSZXNvdXJjZS5cbiAgICAgICAgLy8gVGhlIEFPVCBjb21waWxlciBjdXJyZW50bHkgcmVxdWlyZXMgdGhpcyBob29rIHRvIGFsbG93IGZvciBhIHRyYW5zZm9ybVJlc291cmNlIGhvb2suXG4gICAgICAgIC8vIE9uY2UgdGhlIEFPVCBjb21waWxlciBhbGxvd3Mgb25seSBhIHRyYW5zZm9ybVJlc291cmNlIGhvb2ssIHRoaXMgY2FuIGJlIHJlZXZhbHVhdGVkLlxuICAgICAgICAoaG9zdCBhcyBDb21waWxlckhvc3QpLnJlYWRSZXNvdXJjZSA9IGFzeW5jIGZ1bmN0aW9uIChmaWxlTmFtZSkge1xuICAgICAgICAgIC8vIFRlbXBsYXRlIHJlc291cmNlcyAoLmh0bWwvLnN2ZykgZmlsZXMgYXJlIG5vdCBidW5kbGVkIG9yIHRyYW5zZm9ybWVkXG4gICAgICAgICAgaWYgKGZpbGVOYW1lLmVuZHNXaXRoKCcuaHRtbCcpIHx8IGZpbGVOYW1lLmVuZHNXaXRoKCcuc3ZnJykpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlYWRGaWxlKGZpbGVOYW1lKSA/PyAnJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCB7IGNvbnRlbnRzLCByZXNvdXJjZUZpbGVzLCBlcnJvcnMsIHdhcm5pbmdzIH0gPSBhd2FpdCBidW5kbGVTdHlsZXNoZWV0RmlsZShcbiAgICAgICAgICAgIGZpbGVOYW1lLFxuICAgICAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaCguLi53YXJuaW5ncyk7XG4gICAgICAgICAgc3R5bGVzaGVldFJlc291cmNlRmlsZXMucHVzaCguLi5yZXNvdXJjZUZpbGVzKTtcblxuICAgICAgICAgIHJldHVybiBjb250ZW50cztcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBBZGQgYW4gQU9UIGNvbXBpbGVyIHJlc291cmNlIHRyYW5zZm9ybSBob29rXG4gICAgICAgIChob3N0IGFzIENvbXBpbGVySG9zdCkudHJhbnNmb3JtUmVzb3VyY2UgPSBhc3luYyBmdW5jdGlvbiAoZGF0YSwgY29udGV4dCkge1xuICAgICAgICAgIC8vIE9ubHkgaW5saW5lIHN0eWxlIHJlc291cmNlcyBhcmUgdHJhbnNmb3JtZWQgc2VwYXJhdGVseSBjdXJyZW50bHlcbiAgICAgICAgICBpZiAoY29udGV4dC5yZXNvdXJjZUZpbGUgfHwgY29udGV4dC50eXBlICE9PSAnc3R5bGUnKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUaGUgZmlsZSB3aXRoIHRoZSByZXNvdXJjZSBjb250ZW50IHdpbGwgZWl0aGVyIGJlIGFuIGFjdHVhbCBmaWxlIChyZXNvdXJjZUZpbGUpXG4gICAgICAgICAgLy8gb3IgdGhlIGZpbGUgY29udGFpbmluZyB0aGUgaW5saW5lIGNvbXBvbmVudCBzdHlsZSB0ZXh0IChjb250YWluaW5nRmlsZSkuXG4gICAgICAgICAgY29uc3QgZmlsZSA9IGNvbnRleHQucmVzb3VyY2VGaWxlID8/IGNvbnRleHQuY29udGFpbmluZ0ZpbGU7XG5cbiAgICAgICAgICBjb25zdCB7IGNvbnRlbnRzLCByZXNvdXJjZUZpbGVzLCBlcnJvcnMsIHdhcm5pbmdzIH0gPSBhd2FpdCBidW5kbGVTdHlsZXNoZWV0VGV4dChcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHJlc29sdmVQYXRoOiBwYXRoLmRpcm5hbWUoZmlsZSksXG4gICAgICAgICAgICAgIHZpcnR1YWxOYW1lOiBmaWxlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgICAgKHJlc3VsdC53YXJuaW5ncyA/Pz0gW10pLnB1c2goLi4ud2FybmluZ3MpO1xuICAgICAgICAgIHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLnB1c2goLi4ucmVzb3VyY2VGaWxlcyk7XG5cbiAgICAgICAgICByZXR1cm4geyBjb250ZW50OiBjb250ZW50cyB9O1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFRlbXBvcmFyeSBkZWVwIGltcG9ydCBmb3IgaG9zdCBhdWdtZW50YXRpb24gc3VwcG9ydFxuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgYXVnbWVudEhvc3RXaXRoQ2FjaGluZyxcbiAgICAgICAgICBhdWdtZW50SG9zdFdpdGhSZXBsYWNlbWVudHMsXG4gICAgICAgICAgYXVnbWVudFByb2dyYW1XaXRoVmVyc2lvbmluZyxcbiAgICAgICAgfSA9IHJlcXVpcmUoJ0BuZ3Rvb2xzL3dlYnBhY2svc3JjL2l2eS9ob3N0Jyk7XG5cbiAgICAgICAgLy8gQXVnbWVudCBUeXBlU2NyaXB0IEhvc3QgZm9yIGZpbGUgcmVwbGFjZW1lbnRzIG9wdGlvblxuICAgICAgICBpZiAocGx1Z2luT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgICAgICAgYXVnbWVudEhvc3RXaXRoUmVwbGFjZW1lbnRzKGhvc3QsIHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBdWdtZW50IFR5cGVTY3JpcHQgSG9zdCB3aXRoIHNvdXJjZSBmaWxlIGNhY2hpbmcgaWYgcHJvdmlkZWRcbiAgICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlKSB7XG4gICAgICAgICAgYXVnbWVudEhvc3RXaXRoQ2FjaGluZyhob3N0LCBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZSk7XG4gICAgICAgICAgLy8gQWxsb3cgdGhlIEFPVCBjb21waWxlciB0byByZXF1ZXN0IHRoZSBzZXQgb2YgY2hhbmdlZCB0ZW1wbGF0ZXMgYW5kIHN0eWxlc1xuICAgICAgICAgIChob3N0IGFzIENvbXBpbGVySG9zdCkuZ2V0TW9kaWZpZWRSZXNvdXJjZUZpbGVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5tb2RpZmllZEZpbGVzO1xuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDcmVhdGUgdGhlIEFuZ3VsYXIgc3BlY2lmaWMgcHJvZ3JhbSB0aGF0IGNvbnRhaW5zIHRoZSBBbmd1bGFyIGNvbXBpbGVyXG4gICAgICAgIGNvbnN0IGFuZ3VsYXJQcm9ncmFtID0gcHJvZmlsZVN5bmMoXG4gICAgICAgICAgJ05HX0NSRUFURV9QUk9HUkFNJyxcbiAgICAgICAgICAoKSA9PiBuZXcgTmd0c2NQcm9ncmFtKHJvb3ROYW1lcywgY29tcGlsZXJPcHRpb25zLCBob3N0LCBwcmV2aW91c0FuZ3VsYXJQcm9ncmFtKSxcbiAgICAgICAgKTtcbiAgICAgICAgcHJldmlvdXNBbmd1bGFyUHJvZ3JhbSA9IGFuZ3VsYXJQcm9ncmFtO1xuICAgICAgICBjb25zdCBhbmd1bGFyQ29tcGlsZXIgPSBhbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgICAgICAgY29uc3QgdHlwZVNjcmlwdFByb2dyYW0gPSBhbmd1bGFyUHJvZ3JhbS5nZXRUc1Byb2dyYW0oKTtcbiAgICAgICAgYXVnbWVudFByb2dyYW1XaXRoVmVyc2lvbmluZyh0eXBlU2NyaXB0UHJvZ3JhbSk7XG5cbiAgICAgICAgY29uc3QgYnVpbGRlciA9IHRzLmNyZWF0ZUVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0oXG4gICAgICAgICAgdHlwZVNjcmlwdFByb2dyYW0sXG4gICAgICAgICAgaG9zdCxcbiAgICAgICAgICBwcmV2aW91c0J1aWxkZXIsXG4gICAgICAgICAgY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgICAgICApO1xuICAgICAgICBwcmV2aW91c0J1aWxkZXIgPSBidWlsZGVyO1xuXG4gICAgICAgIGF3YWl0IHByb2ZpbGVBc3luYygnTkdfQU5BTFlaRV9QUk9HUkFNJywgKCkgPT4gYW5ndWxhckNvbXBpbGVyLmFuYWx5emVBc3luYygpKTtcblxuICAgICAgICBmdW5jdGlvbiogY29sbGVjdERpYWdub3N0aWNzKCk6IEl0ZXJhYmxlPHRzLkRpYWdub3N0aWM+IHtcbiAgICAgICAgICAvLyBDb2xsZWN0IHByb2dyYW0gbGV2ZWwgZGlhZ25vc3RpY3NcbiAgICAgICAgICB5aWVsZCogYnVpbGRlci5nZXRDb25maWdGaWxlUGFyc2luZ0RpYWdub3N0aWNzKCk7XG4gICAgICAgICAgeWllbGQqIGFuZ3VsYXJDb21waWxlci5nZXRPcHRpb25EaWFnbm9zdGljcygpO1xuICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldE9wdGlvbnNEaWFnbm9zdGljcygpO1xuICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldEdsb2JhbERpYWdub3N0aWNzKCk7XG5cbiAgICAgICAgICAvLyBDb2xsZWN0IHNvdXJjZSBmaWxlIHNwZWNpZmljIGRpYWdub3N0aWNzXG4gICAgICAgICAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IGZpbmRBZmZlY3RlZEZpbGVzKGJ1aWxkZXIsIGFuZ3VsYXJDb21waWxlcik7XG4gICAgICAgICAgY29uc3Qgb3B0aW1pemVGb3IgPVxuICAgICAgICAgICAgYWZmZWN0ZWRGaWxlcy5zaXplID4gMSA/IE9wdGltaXplRm9yLldob2xlUHJvZ3JhbSA6IE9wdGltaXplRm9yLlNpbmdsZUZpbGU7XG4gICAgICAgICAgZm9yIChjb25zdCBzb3VyY2VGaWxlIG9mIGJ1aWxkZXIuZ2V0U291cmNlRmlsZXMoKSkge1xuICAgICAgICAgICAgaWYgKGFuZ3VsYXJDb21waWxlci5pZ25vcmVGb3JEaWFnbm9zdGljcy5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFR5cGVTY3JpcHQgd2lsbCB1c2UgY2FjaGVkIGRpYWdub3N0aWNzIGZvciBmaWxlcyB0aGF0IGhhdmUgbm90IGJlZW5cbiAgICAgICAgICAgIC8vIGNoYW5nZWQgb3IgYWZmZWN0ZWQgZm9yIHRoaXMgYnVpbGQgd2hlbiB1c2luZyBpbmNyZW1lbnRhbCBidWlsZGluZy5cbiAgICAgICAgICAgIHlpZWxkKiBwcm9maWxlU3luYyhcbiAgICAgICAgICAgICAgJ05HX0RJQUdOT1NUSUNTX1NZTlRBQ1RJQycsXG4gICAgICAgICAgICAgICgpID0+IGJ1aWxkZXIuZ2V0U3ludGFjdGljRGlhZ25vc3RpY3Moc291cmNlRmlsZSksXG4gICAgICAgICAgICAgIHRydWUsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgeWllbGQqIHByb2ZpbGVTeW5jKFxuICAgICAgICAgICAgICAnTkdfRElBR05PU1RJQ1NfU0VNQU5USUMnLFxuICAgICAgICAgICAgICAoKSA9PiBidWlsZGVyLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc291cmNlRmlsZSksXG4gICAgICAgICAgICAgIHRydWUsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAvLyBPbmx5IHJlcXVlc3QgQW5ndWxhciB0ZW1wbGF0ZSBkaWFnbm9zdGljcyBmb3IgYWZmZWN0ZWQgZmlsZXMgdG8gYXZvaWRcbiAgICAgICAgICAgIC8vIG92ZXJoZWFkIG9mIHRlbXBsYXRlIGRpYWdub3N0aWNzIGZvciB1bmNoYW5nZWQgZmlsZXMuXG4gICAgICAgICAgICBpZiAoYWZmZWN0ZWRGaWxlcy5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gcHJvZmlsZVN5bmMoXG4gICAgICAgICAgICAgICAgJ05HX0RJQUdOT1NUSUNTX1RFTVBMQVRFJyxcbiAgICAgICAgICAgICAgICAoKSA9PiBhbmd1bGFyQ29tcGlsZXIuZ2V0RGlhZ25vc3RpY3NGb3JGaWxlKHNvdXJjZUZpbGUsIG9wdGltaXplRm9yKSxcbiAgICAgICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBkaWFnbm9zdGljQ2FjaGUuc2V0KHNvdXJjZUZpbGUsIGFuZ3VsYXJEaWFnbm9zdGljcyk7XG4gICAgICAgICAgICAgIHlpZWxkKiBhbmd1bGFyRGlhZ25vc3RpY3M7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb25zdCBhbmd1bGFyRGlhZ25vc3RpY3MgPSBkaWFnbm9zdGljQ2FjaGUuZ2V0KHNvdXJjZUZpbGUpO1xuICAgICAgICAgICAgICBpZiAoYW5ndWxhckRpYWdub3N0aWNzKSB7XG4gICAgICAgICAgICAgICAgeWllbGQqIGFuZ3VsYXJEaWFnbm9zdGljcztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHByb2ZpbGVTeW5jKCdOR19ESUFHTk9TVElDU19UT1RBTCcsICgpID0+IHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGRpYWdub3N0aWMgb2YgY29sbGVjdERpYWdub3N0aWNzKCkpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWMoZGlhZ25vc3RpYywgaG9zdCk7XG4gICAgICAgICAgICBpZiAoZGlhZ25vc3RpYy5jYXRlZ29yeSA9PT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKSB7XG4gICAgICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaChtZXNzYWdlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgZmlsZUVtaXR0ZXIgPSBjcmVhdGVGaWxlRW1pdHRlcihcbiAgICAgICAgICBidWlsZGVyLFxuICAgICAgICAgIG1lcmdlVHJhbnNmb3JtZXJzKGFuZ3VsYXJDb21waWxlci5wcmVwYXJlRW1pdCgpLnRyYW5zZm9ybWVycywge1xuICAgICAgICAgICAgYmVmb3JlOiBbcmVwbGFjZUJvb3RzdHJhcCgoKSA9PiBidWlsZGVyLmdldFByb2dyYW0oKS5nZXRUeXBlQ2hlY2tlcigpKV0sXG4gICAgICAgICAgfSksXG4gICAgICAgICAgKHNvdXJjZUZpbGUpID0+IGFuZ3VsYXJDb21waWxlci5pbmNyZW1lbnRhbENvbXBpbGF0aW9uLnJlY29yZFN1Y2Nlc3NmdWxFbWl0KHNvdXJjZUZpbGUpLFxuICAgICAgICApO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKFxuICAgICAgICB7IGZpbHRlcjogY29tcGlsZXJPcHRpb25zLmFsbG93SnMgPyAvXFwuW2NtXT9banRdc3g/JC8gOiAvXFwuW2NtXT90c3g/JC8gfSxcbiAgICAgICAgKGFyZ3MpID0+XG4gICAgICAgICAgcHJvZmlsZUFzeW5jKFxuICAgICAgICAgICAgJ05HX0VNSVRfVFMqJyxcbiAgICAgICAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgYXNzZXJ0Lm9rKGZpbGVFbWl0dGVyLCAnSW52YWxpZCBwbHVnaW4gZXhlY3V0aW9uIG9yZGVyJyk7XG5cbiAgICAgICAgICAgICAgY29uc3QgdHlwZXNjcmlwdFJlc3VsdCA9IGF3YWl0IGZpbGVFbWl0dGVyKFxuICAgICAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cz8uW2FyZ3MucGF0aF0gPz8gYXJncy5wYXRoLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBpZiAoIXR5cGVzY3JpcHRSZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAvLyBObyBUUyByZXN1bHQgaW5kaWNhdGVzIHRoZSBmaWxlIGlzIG5vdCBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0uXG4gICAgICAgICAgICAgICAgLy8gSWYgYWxsb3dKcyBpcyBlbmFibGVkIGFuZCB0aGUgZmlsZSBpcyBKUyB0aGVuIGRlZmVyIHRvIHRoZSBuZXh0IGxvYWQgaG9vay5cbiAgICAgICAgICAgICAgICBpZiAoY29tcGlsZXJPcHRpb25zLmFsbG93SnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KGFyZ3MucGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gT3RoZXJ3aXNlIHJldHVybiBhbiBlcnJvclxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgIHRleHQ6IGBGaWxlICcke2FyZ3MucGF0aH0nIGlzIG1pc3NpbmcgZnJvbSB0aGUgVHlwZVNjcmlwdCBjb21waWxhdGlvbi5gLFxuICAgICAgICAgICAgICAgICAgICAgIG5vdGVzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRleHQ6IGBFbnN1cmUgdGhlIGZpbGUgaXMgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBwcm9ncmFtIHZpYSB0aGUgJ2ZpbGVzJyBvciAnaW5jbHVkZScgcHJvcGVydHkuYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSB0eXBlc2NyaXB0UmVzdWx0LmNvbnRlbnQgPz8gJyc7XG4gICAgICAgICAgICAgIC8vIFRoZSBwcmUtdHJhbnNmb3JtZWQgZGF0YSBpcyB1c2VkIGFzIGEgY2FjaGUga2V5LiBTaW5jZSB0aGUgY2FjaGUgaXMgbWVtb3J5IG9ubHksXG4gICAgICAgICAgICAgIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAgICAgICAgICAgICAvLyBjYWNoZSBpcyBsYXRlciBzdG9yZWQgdG8gZGlzaywgdGhlbiB0aGUgb3B0aW9ucyB0aGF0IGFmZmVjdCB0cmFuc2Zvcm0gb3V0cHV0XG4gICAgICAgICAgICAgIC8vIHdvdWxkIG5lZWQgdG8gYmUgYWRkZWQgdG8gdGhlIGtleSBhcyB3ZWxsLlxuICAgICAgICAgICAgICBsZXQgY29udGVudHMgPSBiYWJlbERhdGFDYWNoZS5nZXQoZGF0YSk7XG4gICAgICAgICAgICAgIGlmIChjb250ZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29udGVudHMgPSBhd2FpdCB0cmFuc2Zvcm1XaXRoQmFiZWwoYXJncy5wYXRoLCBkYXRhLCBwbHVnaW5PcHRpb25zKTtcbiAgICAgICAgICAgICAgICBiYWJlbERhdGFDYWNoZS5zZXQoZGF0YSwgY29udGVudHMpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICApLFxuICAgICAgKTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9qcyQvIH0sIChhcmdzKSA9PlxuICAgICAgICBwcm9maWxlQXN5bmMoXG4gICAgICAgICAgJ05HX0VNSVRfSlMqJyxcbiAgICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAvLyBUaGUgZmlsZW5hbWUgaXMgY3VycmVudGx5IHVzZWQgYXMgYSBjYWNoZSBrZXkuIFNpbmNlIHRoZSBjYWNoZSBpcyBtZW1vcnkgb25seSxcbiAgICAgICAgICAgIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAgICAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAgICAgLy8gd291bGQgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUga2V5IGFzIHdlbGwgYXMgYSBjaGVjayBmb3IgYW55IGNoYW5nZSBvZiBjb250ZW50LlxuICAgICAgICAgICAgbGV0IGNvbnRlbnRzID0gcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LmJhYmVsRmlsZUNhY2hlLmdldChhcmdzLnBhdGgpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGZzLnJlYWRGaWxlKGFyZ3MucGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgICAgICAgIGNvbnRlbnRzID0gYXdhaXQgdHJhbnNmb3JtV2l0aEJhYmVsKGFyZ3MucGF0aCwgZGF0YSwgcGx1Z2luT3B0aW9ucyk7XG4gICAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5iYWJlbEZpbGVDYWNoZS5zZXQoYXJncy5wYXRoLCBjb250ZW50cyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKSxcbiAgICAgICk7XG5cbiAgICAgIGJ1aWxkLm9uRW5kKChyZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLmxlbmd0aCkge1xuICAgICAgICAgIHJlc3VsdC5vdXRwdXRGaWxlcz8ucHVzaCguLi5zdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyk7XG4gICAgICAgIH1cblxuICAgICAgICBsb2dDdW11bGF0aXZlRHVyYXRpb25zKCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVGaWxlRW1pdHRlcihcbiAgcHJvZ3JhbTogdHMuQnVpbGRlclByb2dyYW0sXG4gIHRyYW5zZm9ybWVyczogdHMuQ3VzdG9tVHJhbnNmb3JtZXJzID0ge30sXG4gIG9uQWZ0ZXJFbWl0PzogKHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUpID0+IHZvaWQsXG4pOiBGaWxlRW1pdHRlciB7XG4gIHJldHVybiBhc3luYyAoZmlsZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgc291cmNlRmlsZSA9IHByb2dyYW0uZ2V0U291cmNlRmlsZShmaWxlKTtcbiAgICBpZiAoIXNvdXJjZUZpbGUpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgbGV0IGNvbnRlbnQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBwcm9ncmFtLmVtaXQoXG4gICAgICBzb3VyY2VGaWxlLFxuICAgICAgKGZpbGVuYW1lLCBkYXRhKSA9PiB7XG4gICAgICAgIGlmICgvXFwuW2NtXT9qcyQvLnRlc3QoZmlsZW5hbWUpKSB7XG4gICAgICAgICAgY29udGVudCA9IGRhdGE7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB1bmRlZmluZWQgLyogY2FuY2VsbGF0aW9uVG9rZW4gKi8sXG4gICAgICB1bmRlZmluZWQgLyogZW1pdE9ubHlEdHNGaWxlcyAqLyxcbiAgICAgIHRyYW5zZm9ybWVycyxcbiAgICApO1xuXG4gICAgb25BZnRlckVtaXQ/Lihzb3VyY2VGaWxlKTtcblxuICAgIHJldHVybiB7IGNvbnRlbnQsIGRlcGVuZGVuY2llczogW10gfTtcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdHJhbnNmb3JtV2l0aEJhYmVsKFxuICBmaWxlbmFtZTogc3RyaW5nLFxuICBkYXRhOiBzdHJpbmcsXG4gIHBsdWdpbk9wdGlvbnM6IENvbXBpbGVyUGx1Z2luT3B0aW9ucyxcbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IGZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbiA9XG4gICAgIS9bXFxcXC9dW19mXT9lc20yMDE1W1xcXFwvXS8udGVzdChmaWxlbmFtZSkgJiYgL2FzeW5jXFxzK2Z1bmN0aW9uXFxzKlxcKi8udGVzdChkYXRhKTtcbiAgY29uc3Qgc2hvdWxkTGluayA9IGF3YWl0IHJlcXVpcmVzTGlua2luZyhmaWxlbmFtZSwgZGF0YSk7XG4gIGNvbnN0IHVzZUlucHV0U291cmNlbWFwID1cbiAgICBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCAmJlxuICAgICghIXBsdWdpbk9wdGlvbnMudGhpcmRQYXJ0eVNvdXJjZW1hcHMgfHwgIS9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS8udGVzdChmaWxlbmFtZSkpO1xuXG4gIC8vIElmIG5vIGFkZGl0aW9uYWwgdHJhbnNmb3JtYXRpb25zIGFyZSBuZWVkZWQsIHJldHVybiB0aGUgZGF0YSBkaXJlY3RseVxuICBpZiAoIWZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbiAmJiAhcGx1Z2luT3B0aW9ucy5hZHZhbmNlZE9wdGltaXphdGlvbnMgJiYgIXNob3VsZExpbmspIHtcbiAgICAvLyBTdHJpcCBzb3VyY2VtYXBzIGlmIHRoZXkgc2hvdWxkIG5vdCBiZSB1c2VkXG4gICAgcmV0dXJuIHVzZUlucHV0U291cmNlbWFwID8gZGF0YSA6IGRhdGEucmVwbGFjZSgvXlxcL1xcLyMgc291cmNlTWFwcGluZ1VSTD1bXlxcclxcbl0qL2dtLCAnJyk7XG4gIH1cblxuICBjb25zdCBhbmd1bGFyUGFja2FnZSA9IC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXUBhbmd1bGFyW1xcXFwvXS8udGVzdChmaWxlbmFtZSk7XG5cbiAgY29uc3QgbGlua2VyUGx1Z2luQ3JlYXRvciA9IHNob3VsZExpbmtcbiAgICA/IChcbiAgICAgICAgYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJyk+KFxuICAgICAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJyxcbiAgICAgICAgKVxuICAgICAgKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW5cbiAgICA6IHVuZGVmaW5lZDtcblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1Bc3luYyhkYXRhLCB7XG4gICAgZmlsZW5hbWUsXG4gICAgaW5wdXRTb3VyY2VNYXA6ICh1c2VJbnB1dFNvdXJjZW1hcCA/IHVuZGVmaW5lZCA6IGZhbHNlKSBhcyB1bmRlZmluZWQsXG4gICAgc291cmNlTWFwczogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAgPyAnaW5saW5lJyA6IGZhbHNlLFxuICAgIGNvbXBhY3Q6IGZhbHNlLFxuICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIGJhYmVscmM6IGZhbHNlLFxuICAgIGJyb3dzZXJzbGlzdENvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIHBsdWdpbnM6IFtdLFxuICAgIHByZXNldHM6IFtcbiAgICAgIFtcbiAgICAgICAgYW5ndWxhckFwcGxpY2F0aW9uUHJlc2V0LFxuICAgICAgICB7XG4gICAgICAgICAgYW5ndWxhckxpbmtlcjoge1xuICAgICAgICAgICAgc2hvdWxkTGluayxcbiAgICAgICAgICAgIGppdE1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgbGlua2VyUGx1Z2luQ3JlYXRvcixcbiAgICAgICAgICB9LFxuICAgICAgICAgIGZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbixcbiAgICAgICAgICBvcHRpbWl6ZTogcGx1Z2luT3B0aW9ucy5hZHZhbmNlZE9wdGltaXphdGlvbnMgJiYge1xuICAgICAgICAgICAgbG9vc2VFbnVtczogYW5ndWxhclBhY2thZ2UsXG4gICAgICAgICAgICBwdXJlVG9wTGV2ZWw6IGFuZ3VsYXJQYWNrYWdlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIF0sXG4gIH0pO1xuXG4gIHJldHVybiByZXN1bHQ/LmNvZGUgPz8gZGF0YTtcbn1cblxuZnVuY3Rpb24gZmluZEFmZmVjdGVkRmlsZXMoXG4gIGJ1aWxkZXI6IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0sXG4gIHsgaWdub3JlRm9yRGlhZ25vc3RpY3MsIGlnbm9yZUZvckVtaXQsIGluY3JlbWVudGFsQ29tcGlsYXRpb24gfTogTmd0c2NQcm9ncmFtWydjb21waWxlciddLFxuKTogU2V0PHRzLlNvdXJjZUZpbGU+IHtcbiAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IG5ldyBTZXQ8dHMuU291cmNlRmlsZT4oKTtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYnVpbGRlci5nZXRTZW1hbnRpY0RpYWdub3N0aWNzT2ZOZXh0QWZmZWN0ZWRGaWxlKHVuZGVmaW5lZCwgKHNvdXJjZUZpbGUpID0+IHtcbiAgICAgIC8vIElmIHRoZSBhZmZlY3RlZCBmaWxlIGlzIGEgVFRDIHNoaW0sIGFkZCB0aGUgc2hpbSdzIG9yaWdpbmFsIHNvdXJjZSBmaWxlLlxuICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoYXQgY2hhbmdlcyB0aGF0IGFmZmVjdCBUVEMgYXJlIHR5cGVjaGVja2VkIGV2ZW4gd2hlbiB0aGUgY2hhbmdlc1xuICAgICAgLy8gYXJlIG90aGVyd2lzZSB1bnJlbGF0ZWQgZnJvbSBhIFRTIHBlcnNwZWN0aXZlIGFuZCBkbyBub3QgcmVzdWx0IGluIEl2eSBjb2RlZ2VuIGNoYW5nZXMuXG4gICAgICAvLyBGb3IgZXhhbXBsZSwgY2hhbmdpbmcgQElucHV0IHByb3BlcnR5IHR5cGVzIG9mIGEgZGlyZWN0aXZlIHVzZWQgaW4gYW5vdGhlciBjb21wb25lbnQnc1xuICAgICAgLy8gdGVtcGxhdGUuXG4gICAgICAvLyBBIFRUQyBzaGltIGlzIGEgZmlsZSB0aGF0IGhhcyBiZWVuIGlnbm9yZWQgZm9yIGRpYWdub3N0aWNzIGFuZCBoYXMgYSBmaWxlbmFtZSBlbmRpbmcgaW4gYC5uZ3R5cGVjaGVjay50c2AuXG4gICAgICBpZiAoaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpICYmIHNvdXJjZUZpbGUuZmlsZU5hbWUuZW5kc1dpdGgoJy5uZ3R5cGVjaGVjay50cycpKSB7XG4gICAgICAgIC8vIFRoaXMgZmlsZSBuYW1lIGNvbnZlcnNpb24gcmVsaWVzIG9uIGludGVybmFsIGNvbXBpbGVyIGxvZ2ljIGFuZCBzaG91bGQgYmUgY29udmVydGVkXG4gICAgICAgIC8vIHRvIGFuIG9mZmljaWFsIG1ldGhvZCB3aGVuIGF2YWlsYWJsZS4gMTUgaXMgbGVuZ3RoIG9mIGAubmd0eXBlY2hlY2sudHNgXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsRmlsZW5hbWUgPSBzb3VyY2VGaWxlLmZpbGVOYW1lLnNsaWNlKDAsIC0xNSkgKyAnLnRzJztcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxTb3VyY2VGaWxlID0gYnVpbGRlci5nZXRTb3VyY2VGaWxlKG9yaWdpbmFsRmlsZW5hbWUpO1xuICAgICAgICBpZiAob3JpZ2luYWxTb3VyY2VGaWxlKSB7XG4gICAgICAgICAgYWZmZWN0ZWRGaWxlcy5hZGQob3JpZ2luYWxTb3VyY2VGaWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgYWZmZWN0ZWRGaWxlcy5hZGQocmVzdWx0LmFmZmVjdGVkIGFzIHRzLlNvdXJjZUZpbGUpO1xuICB9XG5cbiAgLy8gQSBmaWxlIGlzIGFsc28gYWZmZWN0ZWQgaWYgdGhlIEFuZ3VsYXIgY29tcGlsZXIgcmVxdWlyZXMgaXQgdG8gYmUgZW1pdHRlZFxuICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgYnVpbGRlci5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgaWYgKGlnbm9yZUZvckVtaXQuaGFzKHNvdXJjZUZpbGUpIHx8IGluY3JlbWVudGFsQ29tcGlsYXRpb24uc2FmZVRvU2tpcEVtaXQoc291cmNlRmlsZSkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGFmZmVjdGVkRmlsZXMuYWRkKHNvdXJjZUZpbGUpO1xuICB9XG5cbiAgcmV0dXJuIGFmZmVjdGVkRmlsZXM7XG59XG4iXX0=