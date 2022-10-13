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
                    const transformedData = await transformWithBabel(args.path, data, pluginOptions);
                    contents = Buffer.from(transformedData, 'utf-8');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILHNDQUE2QztBQUM3QywrQ0FBaUM7QUFTakMsMkJBQW9DO0FBQ3BDLDJCQUE4QjtBQUM5QiwyQ0FBNkI7QUFDN0IsNERBQTRCO0FBQzVCLGtGQUF1RTtBQUN2RSwrREFBNkQ7QUFDN0QsbURBQXFEO0FBQ3JELDJDQUtxQjtBQUNyQiwrQ0FBb0c7QUFVcEc7Ozs7Ozs7R0FPRztBQUNILFNBQVMsK0JBQStCLENBQ3RDLElBQXFDLEVBQ3JDLElBQThCLEVBQzlCLFVBQW1CO0lBRW5CLElBQUksSUFBSSxHQUFHLG9CQUFFLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztJQUNoRixJQUFJLFVBQVUsRUFBRTtRQUNkLElBQUksR0FBRyxVQUFVLEdBQUcsSUFBSSxDQUFDO0tBQzFCO0lBRUQsTUFBTSxJQUFJLEdBQWdCLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFFbkMsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO1FBQ2IsSUFBSSxDQUFDLFFBQVEsR0FBRztZQUNkLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVE7WUFDeEIsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO1NBQ3BCLENBQUM7UUFFRiw0RkFBNEY7UUFDNUYsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ2QsTUFBTSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsR0FBRyxvQkFBRSxDQUFDLDZCQUE2QixD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Q0FBQztRQUVILElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDWCxNQUFNO1NBQ1A7UUFFRCxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUF5QixDQUFDLENBQUM7S0FDckQ7SUFFRCw0RUFBNEU7SUFDNUUsS0FBSyxNQUFNLFVBQVUsSUFBSSxPQUFPLENBQUMsY0FBYyxFQUFFLEVBQUU7UUFDakQsSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLHNCQUFzQixDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUN0RixTQUFTO1NBQ1Y7UUFFRCxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQy9CO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IENvbXBpbGVySG9zdCwgTmd0c2NQcm9ncmFtIH0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCB7IHRyYW5zZm9ybUFzeW5jIH0gZnJvbSAnQGJhYmVsL2NvcmUnO1xuaW1wb3J0ICogYXMgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgdHlwZSB7XG4gIE9uU3RhcnRSZXN1bHQsXG4gIE91dHB1dEZpbGUsXG4gIFBhcnRpYWxNZXNzYWdlLFxuICBQYXJ0aWFsTm90ZSxcbiAgUGx1Z2luLFxuICBQbHVnaW5CdWlsZCxcbn0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBwcm9taXNlcyBhcyBmcyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IHBsYXRmb3JtIH0gZnJvbSAnb3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCBhbmd1bGFyQXBwbGljYXRpb25QcmVzZXQgZnJvbSAnLi4vLi4vYmFiZWwvcHJlc2V0cy9hcHBsaWNhdGlvbic7XG5pbXBvcnQgeyByZXF1aXJlc0xpbmtpbmcgfSBmcm9tICcuLi8uLi9iYWJlbC93ZWJwYWNrLWxvYWRlcic7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHtcbiAgbG9nQ3VtdWxhdGl2ZUR1cmF0aW9ucyxcbiAgcHJvZmlsZUFzeW5jLFxuICBwcm9maWxlU3luYyxcbiAgcmVzZXRDdW11bGF0aXZlRHVyYXRpb25zLFxufSBmcm9tICcuL3Byb2ZpbGluZyc7XG5pbXBvcnQgeyBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucywgYnVuZGxlU3R5bGVzaGVldEZpbGUsIGJ1bmRsZVN0eWxlc2hlZXRUZXh0IH0gZnJvbSAnLi9zdHlsZXNoZWV0cyc7XG5cbmludGVyZmFjZSBFbWl0RmlsZVJlc3VsdCB7XG4gIGNvbnRlbnQ/OiBzdHJpbmc7XG4gIG1hcD86IHN0cmluZztcbiAgZGVwZW5kZW5jaWVzOiByZWFkb25seSBzdHJpbmdbXTtcbiAgaGFzaD86IFVpbnQ4QXJyYXk7XG59XG50eXBlIEZpbGVFbWl0dGVyID0gKGZpbGU6IHN0cmluZykgPT4gUHJvbWlzZTxFbWl0RmlsZVJlc3VsdCB8IHVuZGVmaW5lZD47XG5cbi8qKlxuICogQ29udmVydHMgVHlwZVNjcmlwdCBEaWFnbm9zdGljIHJlbGF0ZWQgaW5mb3JtYXRpb24gaW50byBhbiBlc2J1aWxkIGNvbXBhdGlibGUgbm90ZSBvYmplY3QuXG4gKiBSZWxhdGVkIGluZm9ybWF0aW9uIGlzIGEgc3Vic2V0IG9mIGEgZnVsbCBUeXBlU2NyaXB0IERpYWdub3N0aWMgYW5kIGFsc28gdXNlZCBmb3IgZGlhZ25vc3RpY1xuICogbm90ZXMgYXNzb2NpYXRlZCB3aXRoIHRoZSBtYWluIERpYWdub3N0aWMuXG4gKiBAcGFyYW0gaW5mbyBUaGUgVHlwZVNjcmlwdCBkaWFnbm9zdGljIHJlbGF0aXZlIGluZm9ybWF0aW9uIHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0gaG9zdCBBIFR5cGVTY3JpcHQgRm9ybWF0RGlhZ25vc3RpY3NIb3N0IGluc3RhbmNlIHRvIHVzZSBkdXJpbmcgY29udmVyc2lvbi5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgZGlhZ25vc3RpYyBtZXNzYWdlIGFzIGEgUGFydGlhbE1lc3NhZ2Ugb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oXG4gIGluZm86IHRzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24sXG4gIGhvc3Q6IHRzLkZvcm1hdERpYWdub3N0aWNzSG9zdCxcbiAgdGV4dFByZWZpeD86IHN0cmluZyxcbik6IFBhcnRpYWxOb3RlIHtcbiAgbGV0IHRleHQgPSB0cy5mbGF0dGVuRGlhZ25vc3RpY01lc3NhZ2VUZXh0KGluZm8ubWVzc2FnZVRleHQsIGhvc3QuZ2V0TmV3TGluZSgpKTtcbiAgaWYgKHRleHRQcmVmaXgpIHtcbiAgICB0ZXh0ID0gdGV4dFByZWZpeCArIHRleHQ7XG4gIH1cblxuICBjb25zdCBub3RlOiBQYXJ0aWFsTm90ZSA9IHsgdGV4dCB9O1xuXG4gIGlmIChpbmZvLmZpbGUpIHtcbiAgICBub3RlLmxvY2F0aW9uID0ge1xuICAgICAgZmlsZTogaW5mby5maWxlLmZpbGVOYW1lLFxuICAgICAgbGVuZ3RoOiBpbmZvLmxlbmd0aCxcbiAgICB9O1xuXG4gICAgLy8gQ2FsY3VsYXRlIHRoZSBsaW5lL2NvbHVtbiBsb2NhdGlvbiBhbmQgZXh0cmFjdCB0aGUgZnVsbCBsaW5lIHRleHQgdGhhdCBoYXMgdGhlIGRpYWdub3N0aWNcbiAgICBpZiAoaW5mby5zdGFydCkge1xuICAgICAgY29uc3QgeyBsaW5lLCBjaGFyYWN0ZXIgfSA9IHRzLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKGluZm8uZmlsZSwgaW5mby5zdGFydCk7XG4gICAgICBub3RlLmxvY2F0aW9uLmxpbmUgPSBsaW5lICsgMTtcbiAgICAgIG5vdGUubG9jYXRpb24uY29sdW1uID0gY2hhcmFjdGVyO1xuXG4gICAgICAvLyBUaGUgc3RhcnQgcG9zaXRpb24gZm9yIHRoZSBzbGljZSBpcyB0aGUgZmlyc3QgY2hhcmFjdGVyIG9mIHRoZSBlcnJvciBsaW5lXG4gICAgICBjb25zdCBsaW5lU3RhcnRQb3NpdGlvbiA9IHRzLmdldFBvc2l0aW9uT2ZMaW5lQW5kQ2hhcmFjdGVyKGluZm8uZmlsZSwgbGluZSwgMCk7XG5cbiAgICAgIC8vIFRoZSBlbmQgcG9zaXRpb24gZm9yIHRoZSBzbGljZSBpcyB0aGUgZmlyc3QgY2hhcmFjdGVyIG9mIHRoZSBuZXh0IGxpbmUgb3IgdGhlIGxlbmd0aCBvZlxuICAgICAgLy8gdGhlIGVudGlyZSBmaWxlIGlmIHRoZSBsaW5lIGlzIHRoZSBsYXN0IGxpbmUgb2YgdGhlIGZpbGUgKGdldFBvc2l0aW9uT2ZMaW5lQW5kQ2hhcmFjdGVyXG4gICAgICAvLyB3aWxsIGVycm9yIGlmIGEgbm9uZXhpc3RlbnQgbGluZSBpcyBwYXNzZWQpLlxuICAgICAgY29uc3QgeyBsaW5lOiBsYXN0TGluZU9mRmlsZSB9ID0gdHMuZ2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24oXG4gICAgICAgIGluZm8uZmlsZSxcbiAgICAgICAgaW5mby5maWxlLnRleHQubGVuZ3RoIC0gMSxcbiAgICAgICk7XG4gICAgICBjb25zdCBsaW5lRW5kUG9zaXRpb24gPVxuICAgICAgICBsaW5lIDwgbGFzdExpbmVPZkZpbGVcbiAgICAgICAgICA/IHRzLmdldFBvc2l0aW9uT2ZMaW5lQW5kQ2hhcmFjdGVyKGluZm8uZmlsZSwgbGluZSArIDEsIDApXG4gICAgICAgICAgOiBpbmZvLmZpbGUudGV4dC5sZW5ndGg7XG5cbiAgICAgIG5vdGUubG9jYXRpb24ubGluZVRleHQgPSBpbmZvLmZpbGUudGV4dC5zbGljZShsaW5lU3RhcnRQb3NpdGlvbiwgbGluZUVuZFBvc2l0aW9uKS50cmltRW5kKCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5vdGU7XG59XG5cbi8qKlxuICogQ29udmVydHMgYSBUeXBlU2NyaXB0IERpYWdub3N0aWMgbWVzc2FnZSBpbnRvIGFuIGVzYnVpbGQgY29tcGF0aWJsZSBtZXNzYWdlIG9iamVjdC5cbiAqIEBwYXJhbSBkaWFnbm9zdGljIFRoZSBUeXBlU2NyaXB0IGRpYWdub3N0aWMgdG8gY29udmVydC5cbiAqIEBwYXJhbSBob3N0IEEgVHlwZVNjcmlwdCBGb3JtYXREaWFnbm9zdGljc0hvc3QgaW5zdGFuY2UgdG8gdXNlIGR1cmluZyBjb252ZXJzaW9uLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBkaWFnbm9zdGljIG1lc3NhZ2UgYXMgYSBQYXJ0aWFsTWVzc2FnZSBvYmplY3RcbiAqL1xuZnVuY3Rpb24gY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljKFxuICBkaWFnbm9zdGljOiB0cy5EaWFnbm9zdGljLFxuICBob3N0OiB0cy5Gb3JtYXREaWFnbm9zdGljc0hvc3QsXG4pOiBQYXJ0aWFsTWVzc2FnZSB7XG4gIGxldCBjb2RlUHJlZml4ID0gJ1RTJztcbiAgbGV0IGNvZGUgPSBgJHtkaWFnbm9zdGljLmNvZGV9YDtcbiAgaWYgKGRpYWdub3N0aWMuc291cmNlID09PSAnbmd0c2MnKSB7XG4gICAgY29kZVByZWZpeCA9ICdORyc7XG4gICAgLy8gUmVtb3ZlIGAtOTlgIEFuZ3VsYXIgcHJlZml4IGZyb20gZGlhZ25vc3RpYyBjb2RlXG4gICAgY29kZSA9IGNvZGUuc2xpY2UoMyk7XG4gIH1cblxuICBjb25zdCBtZXNzYWdlOiBQYXJ0aWFsTWVzc2FnZSA9IHtcbiAgICAuLi5jb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWNJbmZvKGRpYWdub3N0aWMsIGhvc3QsIGAke2NvZGVQcmVmaXh9JHtjb2RlfTogYCksXG4gICAgLy8gU3RvcmUgb3JpZ2luYWwgZGlhZ25vc3RpYyBmb3IgcmVmZXJlbmNlIGlmIG5lZWRlZCBkb3duc3RyZWFtXG4gICAgZGV0YWlsOiBkaWFnbm9zdGljLFxuICB9O1xuXG4gIGlmIChkaWFnbm9zdGljLnJlbGF0ZWRJbmZvcm1hdGlvbj8ubGVuZ3RoKSB7XG4gICAgbWVzc2FnZS5ub3RlcyA9IGRpYWdub3N0aWMucmVsYXRlZEluZm9ybWF0aW9uLm1hcCgoaW5mbykgPT5cbiAgICAgIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oaW5mbywgaG9zdCksXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBtZXNzYWdlO1xufVxuXG5jb25zdCBVU0lOR19XSU5ET1dTID0gcGxhdGZvcm0oKSA9PT0gJ3dpbjMyJztcbmNvbnN0IFdJTkRPV1NfU0VQX1JFR0VYUCA9IG5ldyBSZWdFeHAoYFxcXFwke3BhdGgud2luMzIuc2VwfWAsICdnJyk7XG5cbmV4cG9ydCBjbGFzcyBTb3VyY2VGaWxlQ2FjaGUgZXh0ZW5kcyBNYXA8c3RyaW5nLCB0cy5Tb3VyY2VGaWxlPiB7XG4gIHJlYWRvbmx5IG1vZGlmaWVkRmlsZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcmVhZG9ubHkgYmFiZWxGaWxlQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgVWludDhBcnJheT4oKTtcblxuICBpbnZhbGlkYXRlKGZpbGVzOiBJdGVyYWJsZTxzdHJpbmc+KTogdm9pZCB7XG4gICAgdGhpcy5tb2RpZmllZEZpbGVzLmNsZWFyKCk7XG4gICAgZm9yIChsZXQgZmlsZSBvZiBmaWxlcykge1xuICAgICAgdGhpcy5iYWJlbEZpbGVDYWNoZS5kZWxldGUoZmlsZSk7XG5cbiAgICAgIC8vIE5vcm1hbGl6ZSBzZXBhcmF0b3JzIHRvIGFsbG93IG1hdGNoaW5nIFR5cGVTY3JpcHQgSG9zdCBwYXRoc1xuICAgICAgaWYgKFVTSU5HX1dJTkRPV1MpIHtcbiAgICAgICAgZmlsZSA9IGZpbGUucmVwbGFjZShXSU5ET1dTX1NFUF9SRUdFWFAsIHBhdGgucG9zaXguc2VwKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5kZWxldGUoZmlsZSk7XG4gICAgICB0aGlzLm1vZGlmaWVkRmlsZXMuYWRkKGZpbGUpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbXBpbGVyUGx1Z2luT3B0aW9ucyB7XG4gIHNvdXJjZW1hcDogYm9vbGVhbjtcbiAgdHNjb25maWc6IHN0cmluZztcbiAgYWR2YW5jZWRPcHRpbWl6YXRpb25zPzogYm9vbGVhbjtcbiAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM/OiBib29sZWFuO1xuICBmaWxlUmVwbGFjZW1lbnRzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgc291cmNlRmlsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlO1xufVxuXG4vLyBUaGlzIGlzIGEgbm9uLXdhdGNoIHZlcnNpb24gb2YgdGhlIGNvbXBpbGVyIGNvZGUgZnJvbSBgQG5ndG9vbHMvd2VicGFja2AgYXVnbWVudGVkIGZvciBlc2J1aWxkXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICBwbHVnaW5PcHRpb25zOiBDb21waWxlclBsdWdpbk9wdGlvbnMsXG4gIHN0eWxlT3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsXG4pOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLWNvbXBpbGVyJyxcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuICAgIGFzeW5jIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgbGV0IHNldHVwV2FybmluZ3M6IFBhcnRpYWxNZXNzYWdlW10gfCB1bmRlZmluZWQ7XG5cbiAgICAgIC8vIFRoaXMgdXNlcyBhIHdyYXBwZWQgZHluYW1pYyBpbXBvcnQgdG8gbG9hZCBgQGFuZ3VsYXIvY29tcGlsZXItY2xpYCB3aGljaCBpcyBFU00uXG4gICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3IgcmV0YWluaW5nIGR5bmFtaWMgaW1wb3J0cyB0aGlzIHdvcmthcm91bmQgY2FuIGJlIGRyb3BwZWQuXG4gICAgICBjb25zdCB7IEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QsIE5ndHNjUHJvZ3JhbSwgT3B0aW1pemVGb3IsIHJlYWRDb25maWd1cmF0aW9uIH0gPVxuICAgICAgICBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpPignQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk7XG5cbiAgICAgIC8vIFRlbXBvcmFyeSBkZWVwIGltcG9ydCBmb3IgdHJhbnNmb3JtZXIgc3VwcG9ydFxuICAgICAgY29uc3Qge1xuICAgICAgICBtZXJnZVRyYW5zZm9ybWVycyxcbiAgICAgICAgcmVwbGFjZUJvb3RzdHJhcCxcbiAgICAgIH0gPSByZXF1aXJlKCdAbmd0b29scy93ZWJwYWNrL3NyYy9pdnkvdHJhbnNmb3JtYXRpb24nKTtcblxuICAgICAgLy8gU2V0dXAgZGVmaW5lcyBiYXNlZCBvbiB0aGUgdmFsdWVzIHByb3ZpZGVkIGJ5IHRoZSBBbmd1bGFyIGNvbXBpbGVyLWNsaVxuICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lID8/PSB7fTtcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QpKSB7XG4gICAgICAgIGlmIChrZXkgaW4gYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lKSB7XG4gICAgICAgICAgLy8gU2tpcCBrZXlzIHRoYXQgaGF2ZSBiZWVuIG1hbnVhbGx5IHByb3ZpZGVkXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZXNidWlsZCByZXF1aXJlcyB2YWx1ZXMgdG8gYmUgYSBzdHJpbmcgKGFjdHVhbCBzdHJpbmdzIG5lZWQgdG8gYmUgcXVvdGVkKS5cbiAgICAgICAgLy8gSW4gdGhpcyBjYXNlLCBhbGwgcHJvdmlkZWQgdmFsdWVzIGFyZSBib29sZWFucy5cbiAgICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lW2tleV0gPSB2YWx1ZS50b1N0cmluZygpO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgdHNjb25maWcgaXMgbG9hZGVkIGluIHNldHVwIGluc3RlYWQgb2YgaW4gc3RhcnQgdG8gYWxsb3cgdGhlIGVzYnVpbGQgdGFyZ2V0IGJ1aWxkIG9wdGlvbiB0byBiZSBtb2RpZmllZC5cbiAgICAgIC8vIGVzYnVpbGQgYnVpbGQgb3B0aW9ucyBjYW4gb25seSBiZSBtb2RpZmllZCBpbiBzZXR1cCBwcmlvciB0byBzdGFydGluZyB0aGUgYnVpbGQuXG4gICAgICBjb25zdCB7XG4gICAgICAgIG9wdGlvbnM6IGNvbXBpbGVyT3B0aW9ucyxcbiAgICAgICAgcm9vdE5hbWVzLFxuICAgICAgICBlcnJvcnM6IGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcyxcbiAgICAgIH0gPSBwcm9maWxlU3luYygnTkdfUkVBRF9DT05GSUcnLCAoKSA9PlxuICAgICAgICByZWFkQ29uZmlndXJhdGlvbihwbHVnaW5PcHRpb25zLnRzY29uZmlnLCB7XG4gICAgICAgICAgbm9FbWl0T25FcnJvcjogZmFsc2UsXG4gICAgICAgICAgc3VwcHJlc3NPdXRwdXRQYXRoQ2hlY2s6IHRydWUsXG4gICAgICAgICAgb3V0RGlyOiB1bmRlZmluZWQsXG4gICAgICAgICAgaW5saW5lU291cmNlczogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgaW5saW5lU291cmNlTWFwOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxuICAgICAgICAgIG1hcFJvb3Q6IHVuZGVmaW5lZCxcbiAgICAgICAgICBzb3VyY2VSb290OiB1bmRlZmluZWQsXG4gICAgICAgICAgZGVjbGFyYXRpb246IGZhbHNlLFxuICAgICAgICAgIGRlY2xhcmF0aW9uTWFwOiBmYWxzZSxcbiAgICAgICAgICBhbGxvd0VtcHR5Q29kZWdlbkZpbGVzOiBmYWxzZSxcbiAgICAgICAgICBhbm5vdGF0aW9uc0FzOiAnZGVjb3JhdG9ycycsXG4gICAgICAgICAgZW5hYmxlUmVzb3VyY2VJbmxpbmluZzogZmFsc2UsXG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgICAgaWYgKGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPT09IHVuZGVmaW5lZCB8fCBjb21waWxlck9wdGlvbnMudGFyZ2V0IDwgdHMuU2NyaXB0VGFyZ2V0LkVTMjAyMikge1xuICAgICAgICAvLyBJZiAndXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHMnIGlzIGFscmVhZHkgZGVmaW5lZCBpbiB0aGUgdXNlcnMgcHJvamVjdCBsZWF2ZSB0aGUgdmFsdWUgYXMgaXMuXG4gICAgICAgIC8vIE90aGVyd2lzZSBmYWxsYmFjayB0byBmYWxzZSBkdWUgdG8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy80NTk5NVxuICAgICAgICAvLyB3aGljaCBicmVha3MgdGhlIGRlcHJlY2F0ZWQgYEBFZmZlY3RzYCBOR1JYIGRlY29yYXRvciBhbmQgcG90ZW50aWFsbHkgb3RoZXIgZXhpc3RpbmcgY29kZSBhcyB3ZWxsLlxuICAgICAgICBjb21waWxlck9wdGlvbnMudGFyZ2V0ID0gdHMuU2NyaXB0VGFyZ2V0LkVTMjAyMjtcbiAgICAgICAgY29tcGlsZXJPcHRpb25zLnVzZURlZmluZUZvckNsYXNzRmllbGRzID8/PSBmYWxzZTtcblxuICAgICAgICAoc2V0dXBXYXJuaW5ncyA/Pz0gW10pLnB1c2goe1xuICAgICAgICAgIHRleHQ6XG4gICAgICAgICAgICAnVHlwZVNjcmlwdCBjb21waWxlciBvcHRpb25zIFwidGFyZ2V0XCIgYW5kIFwidXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHNcIiBhcmUgc2V0IHRvIFwiRVMyMDIyXCIgYW5kICcgK1xuICAgICAgICAgICAgJ1wiZmFsc2VcIiByZXNwZWN0aXZlbHkgYnkgdGhlIEFuZ3VsYXIgQ0xJLicsXG4gICAgICAgICAgbG9jYXRpb246IHsgZmlsZTogcGx1Z2luT3B0aW9ucy50c2NvbmZpZyB9LFxuICAgICAgICAgIG5vdGVzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHRleHQ6IGBUbyBjb250cm9sIEVDTUEgdmVyc2lvbiBhbmQgZmVhdHVyZXMgdXNlIHRoZSBCcm93ZXJzbGlzdCBjb25maWd1cmF0aW9uLiAnICtcbiAgICAgICAgICAgICAgJ0ZvciBtb3JlIGluZm9ybWF0aW9uLCBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2Jyb3dzZXJzbGlzdC9icm93c2Vyc2xpc3QjcXVlcmllcydgLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIGZpbGUgZW1pdHRlciBjcmVhdGVkIGR1cmluZyBgb25TdGFydGAgdGhhdCB3aWxsIGJlIHVzZWQgZHVyaW5nIHRoZSBidWlsZCBpbiBgb25Mb2FkYCBjYWxsYmFja3MgZm9yIFRTIGZpbGVzXG4gICAgICBsZXQgZmlsZUVtaXR0ZXI6IEZpbGVFbWl0dGVyIHwgdW5kZWZpbmVkO1xuXG4gICAgICAvLyBUaGUgc3R5bGVzaGVldCByZXNvdXJjZXMgZnJvbSBjb21wb25lbnQgc3R5bGVzaGVldHMgdGhhdCB3aWxsIGJlIGFkZGVkIHRvIHRoZSBidWlsZCByZXN1bHRzIG91dHB1dCBmaWxlc1xuICAgICAgbGV0IHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzOiBPdXRwdXRGaWxlW107XG5cbiAgICAgIGxldCBwcmV2aW91c0J1aWxkZXI6IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0gfCB1bmRlZmluZWQ7XG4gICAgICBsZXQgcHJldmlvdXNBbmd1bGFyUHJvZ3JhbTogTmd0c2NQcm9ncmFtIHwgdW5kZWZpbmVkO1xuICAgICAgY29uc3QgYmFiZWxEYXRhQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgVWludDhBcnJheT4oKTtcbiAgICAgIGNvbnN0IGRpYWdub3N0aWNDYWNoZSA9IG5ldyBXZWFrTWFwPHRzLlNvdXJjZUZpbGUsIHRzLkRpYWdub3N0aWNbXT4oKTtcblxuICAgICAgYnVpbGQub25TdGFydChhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogT25TdGFydFJlc3VsdCA9IHtcbiAgICAgICAgICB3YXJuaW5nczogc2V0dXBXYXJuaW5ncyxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBSZXNldCB0aGUgc2V0dXAgd2FybmluZ3Mgc28gdGhhdCB0aGV5IGFyZSBvbmx5IHNob3duIGR1cmluZyB0aGUgZmlyc3QgYnVpbGQuXG4gICAgICAgIHNldHVwV2FybmluZ3MgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgLy8gUmVzZXQgZGVidWcgcGVyZm9ybWFuY2UgdHJhY2tpbmdcbiAgICAgICAgcmVzZXRDdW11bGF0aXZlRHVyYXRpb25zKCk7XG5cbiAgICAgICAgLy8gUmVzZXQgc3R5bGVzaGVldCByZXNvdXJjZSBvdXRwdXQgZmlsZXNcbiAgICAgICAgc3R5bGVzaGVldFJlc291cmNlRmlsZXMgPSBbXTtcblxuICAgICAgICAvLyBDcmVhdGUgVHlwZVNjcmlwdCBjb21waWxlciBob3N0XG4gICAgICAgIGNvbnN0IGhvc3QgPSB0cy5jcmVhdGVJbmNyZW1lbnRhbENvbXBpbGVySG9zdChjb21waWxlck9wdGlvbnMpO1xuXG4gICAgICAgIC8vIFRlbXBvcmFyaWx5IHByb2Nlc3MgZXh0ZXJuYWwgcmVzb3VyY2VzIHZpYSByZWFkUmVzb3VyY2UuXG4gICAgICAgIC8vIFRoZSBBT1QgY29tcGlsZXIgY3VycmVudGx5IHJlcXVpcmVzIHRoaXMgaG9vayB0byBhbGxvdyBmb3IgYSB0cmFuc2Zvcm1SZXNvdXJjZSBob29rLlxuICAgICAgICAvLyBPbmNlIHRoZSBBT1QgY29tcGlsZXIgYWxsb3dzIG9ubHkgYSB0cmFuc2Zvcm1SZXNvdXJjZSBob29rLCB0aGlzIGNhbiBiZSByZWV2YWx1YXRlZC5cbiAgICAgICAgKGhvc3QgYXMgQ29tcGlsZXJIb3N0KS5yZWFkUmVzb3VyY2UgPSBhc3luYyBmdW5jdGlvbiAoZmlsZU5hbWUpIHtcbiAgICAgICAgICAvLyBUZW1wbGF0ZSByZXNvdXJjZXMgKC5odG1sLy5zdmcpIGZpbGVzIGFyZSBub3QgYnVuZGxlZCBvciB0cmFuc2Zvcm1lZFxuICAgICAgICAgIGlmIChmaWxlTmFtZS5lbmRzV2l0aCgnLmh0bWwnKSB8fCBmaWxlTmFtZS5lbmRzV2l0aCgnLnN2ZycpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yZWFkRmlsZShmaWxlTmFtZSkgPz8gJyc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgeyBjb250ZW50cywgcmVzb3VyY2VGaWxlcywgZXJyb3JzLCB3YXJuaW5ncyB9ID0gYXdhaXQgYnVuZGxlU3R5bGVzaGVldEZpbGUoXG4gICAgICAgICAgICBmaWxlTmFtZSxcbiAgICAgICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgICAgKHJlc3VsdC53YXJuaW5ncyA/Pz0gW10pLnB1c2goLi4ud2FybmluZ3MpO1xuICAgICAgICAgIHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLnB1c2goLi4ucmVzb3VyY2VGaWxlcyk7XG5cbiAgICAgICAgICByZXR1cm4gY29udGVudHM7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQWRkIGFuIEFPVCBjb21waWxlciByZXNvdXJjZSB0cmFuc2Zvcm0gaG9va1xuICAgICAgICAoaG9zdCBhcyBDb21waWxlckhvc3QpLnRyYW5zZm9ybVJlc291cmNlID0gYXN5bmMgZnVuY3Rpb24gKGRhdGEsIGNvbnRleHQpIHtcbiAgICAgICAgICAvLyBPbmx5IGlubGluZSBzdHlsZSByZXNvdXJjZXMgYXJlIHRyYW5zZm9ybWVkIHNlcGFyYXRlbHkgY3VycmVudGx5XG4gICAgICAgICAgaWYgKGNvbnRleHQucmVzb3VyY2VGaWxlIHx8IGNvbnRleHQudHlwZSAhPT0gJ3N0eWxlJykge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gVGhlIGZpbGUgd2l0aCB0aGUgcmVzb3VyY2UgY29udGVudCB3aWxsIGVpdGhlciBiZSBhbiBhY3R1YWwgZmlsZSAocmVzb3VyY2VGaWxlKVxuICAgICAgICAgIC8vIG9yIHRoZSBmaWxlIGNvbnRhaW5pbmcgdGhlIGlubGluZSBjb21wb25lbnQgc3R5bGUgdGV4dCAoY29udGFpbmluZ0ZpbGUpLlxuICAgICAgICAgIGNvbnN0IGZpbGUgPSBjb250ZXh0LnJlc291cmNlRmlsZSA/PyBjb250ZXh0LmNvbnRhaW5pbmdGaWxlO1xuXG4gICAgICAgICAgY29uc3QgeyBjb250ZW50cywgcmVzb3VyY2VGaWxlcywgZXJyb3JzLCB3YXJuaW5ncyB9ID0gYXdhaXQgYnVuZGxlU3R5bGVzaGVldFRleHQoXG4gICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICByZXNvbHZlUGF0aDogcGF0aC5kaXJuYW1lKGZpbGUpLFxuICAgICAgICAgICAgICB2aXJ0dWFsTmFtZTogZmlsZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaCguLi5lcnJvcnMpO1xuICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgICBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcy5wdXNoKC4uLnJlc291cmNlRmlsZXMpO1xuXG4gICAgICAgICAgcmV0dXJuIHsgY29udGVudDogY29udGVudHMgfTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBUZW1wb3JhcnkgZGVlcCBpbXBvcnQgZm9yIGhvc3QgYXVnbWVudGF0aW9uIHN1cHBvcnRcbiAgICAgICAgY29uc3Qge1xuICAgICAgICAgIGF1Z21lbnRIb3N0V2l0aENhY2hpbmcsXG4gICAgICAgICAgYXVnbWVudEhvc3RXaXRoUmVwbGFjZW1lbnRzLFxuICAgICAgICAgIGF1Z21lbnRQcm9ncmFtV2l0aFZlcnNpb25pbmcsXG4gICAgICAgIH0gPSByZXF1aXJlKCdAbmd0b29scy93ZWJwYWNrL3NyYy9pdnkvaG9zdCcpO1xuXG4gICAgICAgIC8vIEF1Z21lbnQgVHlwZVNjcmlwdCBIb3N0IGZvciBmaWxlIHJlcGxhY2VtZW50cyBvcHRpb25cbiAgICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykge1xuICAgICAgICAgIGF1Z21lbnRIb3N0V2l0aFJlcGxhY2VtZW50cyhob3N0LCBwbHVnaW5PcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXVnbWVudCBUeXBlU2NyaXB0IEhvc3Qgd2l0aCBzb3VyY2UgZmlsZSBjYWNoaW5nIGlmIHByb3ZpZGVkXG4gICAgICAgIGlmIChwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZSkge1xuICAgICAgICAgIGF1Z21lbnRIb3N0V2l0aENhY2hpbmcoaG9zdCwgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUpO1xuICAgICAgICAgIC8vIEFsbG93IHRoZSBBT1QgY29tcGlsZXIgdG8gcmVxdWVzdCB0aGUgc2V0IG9mIGNoYW5nZWQgdGVtcGxhdGVzIGFuZCBzdHlsZXNcbiAgICAgICAgICAoaG9zdCBhcyBDb21waWxlckhvc3QpLmdldE1vZGlmaWVkUmVzb3VyY2VGaWxlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8ubW9kaWZpZWRGaWxlcztcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ3JlYXRlIHRoZSBBbmd1bGFyIHNwZWNpZmljIHByb2dyYW0gdGhhdCBjb250YWlucyB0aGUgQW5ndWxhciBjb21waWxlclxuICAgICAgICBjb25zdCBhbmd1bGFyUHJvZ3JhbSA9IHByb2ZpbGVTeW5jKFxuICAgICAgICAgICdOR19DUkVBVEVfUFJPR1JBTScsXG4gICAgICAgICAgKCkgPT4gbmV3IE5ndHNjUHJvZ3JhbShyb290TmFtZXMsIGNvbXBpbGVyT3B0aW9ucywgaG9zdCwgcHJldmlvdXNBbmd1bGFyUHJvZ3JhbSksXG4gICAgICAgICk7XG4gICAgICAgIHByZXZpb3VzQW5ndWxhclByb2dyYW0gPSBhbmd1bGFyUHJvZ3JhbTtcbiAgICAgICAgY29uc3QgYW5ndWxhckNvbXBpbGVyID0gYW5ndWxhclByb2dyYW0uY29tcGlsZXI7XG4gICAgICAgIGNvbnN0IHR5cGVTY3JpcHRQcm9ncmFtID0gYW5ndWxhclByb2dyYW0uZ2V0VHNQcm9ncmFtKCk7XG4gICAgICAgIGF1Z21lbnRQcm9ncmFtV2l0aFZlcnNpb25pbmcodHlwZVNjcmlwdFByb2dyYW0pO1xuXG4gICAgICAgIGNvbnN0IGJ1aWxkZXIgPSB0cy5jcmVhdGVFbWl0QW5kU2VtYW50aWNEaWFnbm9zdGljc0J1aWxkZXJQcm9ncmFtKFxuICAgICAgICAgIHR5cGVTY3JpcHRQcm9ncmFtLFxuICAgICAgICAgIGhvc3QsXG4gICAgICAgICAgcHJldmlvdXNCdWlsZGVyLFxuICAgICAgICAgIGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcyxcbiAgICAgICAgKTtcbiAgICAgICAgcHJldmlvdXNCdWlsZGVyID0gYnVpbGRlcjtcblxuICAgICAgICBhd2FpdCBwcm9maWxlQXN5bmMoJ05HX0FOQUxZWkVfUFJPR1JBTScsICgpID0+IGFuZ3VsYXJDb21waWxlci5hbmFseXplQXN5bmMoKSk7XG5cbiAgICAgICAgZnVuY3Rpb24qIGNvbGxlY3REaWFnbm9zdGljcygpOiBJdGVyYWJsZTx0cy5EaWFnbm9zdGljPiB7XG4gICAgICAgICAgLy8gQ29sbGVjdCBwcm9ncmFtIGxldmVsIGRpYWdub3N0aWNzXG4gICAgICAgICAgeWllbGQqIGJ1aWxkZXIuZ2V0Q29uZmlnRmlsZVBhcnNpbmdEaWFnbm9zdGljcygpO1xuICAgICAgICAgIHlpZWxkKiBhbmd1bGFyQ29tcGlsZXIuZ2V0T3B0aW9uRGlhZ25vc3RpY3MoKTtcbiAgICAgICAgICB5aWVsZCogYnVpbGRlci5nZXRPcHRpb25zRGlhZ25vc3RpY3MoKTtcbiAgICAgICAgICB5aWVsZCogYnVpbGRlci5nZXRHbG9iYWxEaWFnbm9zdGljcygpO1xuXG4gICAgICAgICAgLy8gQ29sbGVjdCBzb3VyY2UgZmlsZSBzcGVjaWZpYyBkaWFnbm9zdGljc1xuICAgICAgICAgIGNvbnN0IGFmZmVjdGVkRmlsZXMgPSBmaW5kQWZmZWN0ZWRGaWxlcyhidWlsZGVyLCBhbmd1bGFyQ29tcGlsZXIpO1xuICAgICAgICAgIGNvbnN0IG9wdGltaXplRm9yID1cbiAgICAgICAgICAgIGFmZmVjdGVkRmlsZXMuc2l6ZSA+IDEgPyBPcHRpbWl6ZUZvci5XaG9sZVByb2dyYW0gOiBPcHRpbWl6ZUZvci5TaW5nbGVGaWxlO1xuICAgICAgICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiBidWlsZGVyLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChhbmd1bGFyQ29tcGlsZXIuaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBUeXBlU2NyaXB0IHdpbGwgdXNlIGNhY2hlZCBkaWFnbm9zdGljcyBmb3IgZmlsZXMgdGhhdCBoYXZlIG5vdCBiZWVuXG4gICAgICAgICAgICAvLyBjaGFuZ2VkIG9yIGFmZmVjdGVkIGZvciB0aGlzIGJ1aWxkIHdoZW4gdXNpbmcgaW5jcmVtZW50YWwgYnVpbGRpbmcuXG4gICAgICAgICAgICB5aWVsZCogcHJvZmlsZVN5bmMoXG4gICAgICAgICAgICAgICdOR19ESUFHTk9TVElDU19TWU5UQUNUSUMnLFxuICAgICAgICAgICAgICAoKSA9PiBidWlsZGVyLmdldFN5bnRhY3RpY0RpYWdub3N0aWNzKHNvdXJjZUZpbGUpLFxuICAgICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHlpZWxkKiBwcm9maWxlU3luYyhcbiAgICAgICAgICAgICAgJ05HX0RJQUdOT1NUSUNTX1NFTUFOVElDJyxcbiAgICAgICAgICAgICAgKCkgPT4gYnVpbGRlci5nZXRTZW1hbnRpY0RpYWdub3N0aWNzKHNvdXJjZUZpbGUpLFxuICAgICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gT25seSByZXF1ZXN0IEFuZ3VsYXIgdGVtcGxhdGUgZGlhZ25vc3RpY3MgZm9yIGFmZmVjdGVkIGZpbGVzIHRvIGF2b2lkXG4gICAgICAgICAgICAvLyBvdmVyaGVhZCBvZiB0ZW1wbGF0ZSBkaWFnbm9zdGljcyBmb3IgdW5jaGFuZ2VkIGZpbGVzLlxuICAgICAgICAgICAgaWYgKGFmZmVjdGVkRmlsZXMuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGFuZ3VsYXJEaWFnbm9zdGljcyA9IHByb2ZpbGVTeW5jKFxuICAgICAgICAgICAgICAgICdOR19ESUFHTk9TVElDU19URU1QTEFURScsXG4gICAgICAgICAgICAgICAgKCkgPT4gYW5ndWxhckNvbXBpbGVyLmdldERpYWdub3N0aWNzRm9yRmlsZShzb3VyY2VGaWxlLCBvcHRpbWl6ZUZvciksXG4gICAgICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgZGlhZ25vc3RpY0NhY2hlLnNldChzb3VyY2VGaWxlLCBhbmd1bGFyRGlhZ25vc3RpY3MpO1xuICAgICAgICAgICAgICB5aWVsZCogYW5ndWxhckRpYWdub3N0aWNzO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gZGlhZ25vc3RpY0NhY2hlLmdldChzb3VyY2VGaWxlKTtcbiAgICAgICAgICAgICAgaWYgKGFuZ3VsYXJEaWFnbm9zdGljcykge1xuICAgICAgICAgICAgICAgIHlpZWxkKiBhbmd1bGFyRGlhZ25vc3RpY3M7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBwcm9maWxlU3luYygnTkdfRElBR05PU1RJQ1NfVE9UQUwnLCAoKSA9PiB7XG4gICAgICAgICAgZm9yIChjb25zdCBkaWFnbm9zdGljIG9mIGNvbGxlY3REaWFnbm9zdGljcygpKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljKGRpYWdub3N0aWMsIGhvc3QpO1xuICAgICAgICAgICAgaWYgKGRpYWdub3N0aWMuY2F0ZWdvcnkgPT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcikge1xuICAgICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2gobWVzc2FnZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaChtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZpbGVFbWl0dGVyID0gY3JlYXRlRmlsZUVtaXR0ZXIoXG4gICAgICAgICAgYnVpbGRlcixcbiAgICAgICAgICBtZXJnZVRyYW5zZm9ybWVycyhhbmd1bGFyQ29tcGlsZXIucHJlcGFyZUVtaXQoKS50cmFuc2Zvcm1lcnMsIHtcbiAgICAgICAgICAgIGJlZm9yZTogW3JlcGxhY2VCb290c3RyYXAoKCkgPT4gYnVpbGRlci5nZXRQcm9ncmFtKCkuZ2V0VHlwZUNoZWNrZXIoKSldLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIChzb3VyY2VGaWxlKSA9PiBhbmd1bGFyQ29tcGlsZXIuaW5jcmVtZW50YWxDb21waWxhdGlvbi5yZWNvcmRTdWNjZXNzZnVsRW1pdChzb3VyY2VGaWxlKSxcbiAgICAgICAgKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZChcbiAgICAgICAgeyBmaWx0ZXI6IGNvbXBpbGVyT3B0aW9ucy5hbGxvd0pzID8gL1xcLltjbV0/W2p0XXN4PyQvIDogL1xcLltjbV0/dHN4PyQvIH0sXG4gICAgICAgIChhcmdzKSA9PlxuICAgICAgICAgIHByb2ZpbGVBc3luYyhcbiAgICAgICAgICAgICdOR19FTUlUX1RTKicsXG4gICAgICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgIGFzc2VydC5vayhmaWxlRW1pdHRlciwgJ0ludmFsaWQgcGx1Z2luIGV4ZWN1dGlvbiBvcmRlcicpO1xuXG4gICAgICAgICAgICAgIGNvbnN0IHR5cGVzY3JpcHRSZXN1bHQgPSBhd2FpdCBmaWxlRW1pdHRlcihcbiAgICAgICAgICAgICAgICBwbHVnaW5PcHRpb25zLmZpbGVSZXBsYWNlbWVudHM/LlthcmdzLnBhdGhdID8/IGFyZ3MucGF0aCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgaWYgKCF0eXBlc2NyaXB0UmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgLy8gTm8gVFMgcmVzdWx0IGluZGljYXRlcyB0aGUgZmlsZSBpcyBub3QgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBwcm9ncmFtLlxuICAgICAgICAgICAgICAgIC8vIElmIGFsbG93SnMgaXMgZW5hYmxlZCBhbmQgdGhlIGZpbGUgaXMgSlMgdGhlbiBkZWZlciB0byB0aGUgbmV4dCBsb2FkIGhvb2suXG4gICAgICAgICAgICAgICAgaWYgKGNvbXBpbGVyT3B0aW9ucy5hbGxvd0pzICYmIC9cXC5bY21dP2pzJC8udGVzdChhcmdzLnBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIE90aGVyd2lzZSByZXR1cm4gYW4gZXJyb3JcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiBgRmlsZSAnJHthcmdzLnBhdGh9JyBpcyBtaXNzaW5nIGZyb20gdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24uYCxcbiAgICAgICAgICAgICAgICAgICAgICBub3RlczogW1xuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiBgRW5zdXJlIHRoZSBmaWxlIGlzIHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvZ3JhbSB2aWEgdGhlICdmaWxlcycgb3IgJ2luY2x1ZGUnIHByb3BlcnR5LmAsXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBkYXRhID0gdHlwZXNjcmlwdFJlc3VsdC5jb250ZW50ID8/ICcnO1xuICAgICAgICAgICAgICAvLyBUaGUgcHJlLXRyYW5zZm9ybWVkIGRhdGEgaXMgdXNlZCBhcyBhIGNhY2hlIGtleS4gU2luY2UgdGhlIGNhY2hlIGlzIG1lbW9yeSBvbmx5LFxuICAgICAgICAgICAgICAvLyB0aGUgb3B0aW9ucyBjYW5ub3QgY2hhbmdlIGFuZCBkbyBub3QgbmVlZCB0byBiZSByZXByZXNlbnRlZCBpbiB0aGUga2V5LiBJZiB0aGVcbiAgICAgICAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAgICAgICAvLyB3b3VsZCBuZWVkIHRvIGJlIGFkZGVkIHRvIHRoZSBrZXkgYXMgd2VsbC5cbiAgICAgICAgICAgICAgbGV0IGNvbnRlbnRzID0gYmFiZWxEYXRhQ2FjaGUuZ2V0KGRhdGEpO1xuICAgICAgICAgICAgICBpZiAoY29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRyYW5zZm9ybWVkRGF0YSA9IGF3YWl0IHRyYW5zZm9ybVdpdGhCYWJlbChhcmdzLnBhdGgsIGRhdGEsIHBsdWdpbk9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIGNvbnRlbnRzID0gQnVmZmVyLmZyb20odHJhbnNmb3JtZWREYXRhLCAndXRmLTgnKTtcbiAgICAgICAgICAgICAgICBiYWJlbERhdGFDYWNoZS5zZXQoZGF0YSwgY29udGVudHMpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICApLFxuICAgICAgKTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9qcyQvIH0sIChhcmdzKSA9PlxuICAgICAgICBwcm9maWxlQXN5bmMoXG4gICAgICAgICAgJ05HX0VNSVRfSlMqJyxcbiAgICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAvLyBUaGUgZmlsZW5hbWUgaXMgY3VycmVudGx5IHVzZWQgYXMgYSBjYWNoZSBrZXkuIFNpbmNlIHRoZSBjYWNoZSBpcyBtZW1vcnkgb25seSxcbiAgICAgICAgICAgIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAgICAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAgICAgLy8gd291bGQgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUga2V5IGFzIHdlbGwgYXMgYSBjaGVjayBmb3IgYW55IGNoYW5nZSBvZiBjb250ZW50LlxuICAgICAgICAgICAgbGV0IGNvbnRlbnRzID0gcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LmJhYmVsRmlsZUNhY2hlLmdldChhcmdzLnBhdGgpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGZzLnJlYWRGaWxlKGFyZ3MucGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgICAgICAgIGNvbnN0IHRyYW5zZm9ybWVkRGF0YSA9IGF3YWl0IHRyYW5zZm9ybVdpdGhCYWJlbChhcmdzLnBhdGgsIGRhdGEsIHBsdWdpbk9wdGlvbnMpO1xuICAgICAgICAgICAgICBjb250ZW50cyA9IEJ1ZmZlci5mcm9tKHRyYW5zZm9ybWVkRGF0YSwgJ3V0Zi04Jyk7XG4gICAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5iYWJlbEZpbGVDYWNoZS5zZXQoYXJncy5wYXRoLCBjb250ZW50cyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKSxcbiAgICAgICk7XG5cbiAgICAgIGJ1aWxkLm9uRW5kKChyZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLmxlbmd0aCkge1xuICAgICAgICAgIHJlc3VsdC5vdXRwdXRGaWxlcz8ucHVzaCguLi5zdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyk7XG4gICAgICAgIH1cblxuICAgICAgICBsb2dDdW11bGF0aXZlRHVyYXRpb25zKCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVGaWxlRW1pdHRlcihcbiAgcHJvZ3JhbTogdHMuQnVpbGRlclByb2dyYW0sXG4gIHRyYW5zZm9ybWVyczogdHMuQ3VzdG9tVHJhbnNmb3JtZXJzID0ge30sXG4gIG9uQWZ0ZXJFbWl0PzogKHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUpID0+IHZvaWQsXG4pOiBGaWxlRW1pdHRlciB7XG4gIHJldHVybiBhc3luYyAoZmlsZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgc291cmNlRmlsZSA9IHByb2dyYW0uZ2V0U291cmNlRmlsZShmaWxlKTtcbiAgICBpZiAoIXNvdXJjZUZpbGUpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgbGV0IGNvbnRlbnQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBwcm9ncmFtLmVtaXQoXG4gICAgICBzb3VyY2VGaWxlLFxuICAgICAgKGZpbGVuYW1lLCBkYXRhKSA9PiB7XG4gICAgICAgIGlmICgvXFwuW2NtXT9qcyQvLnRlc3QoZmlsZW5hbWUpKSB7XG4gICAgICAgICAgY29udGVudCA9IGRhdGE7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB1bmRlZmluZWQgLyogY2FuY2VsbGF0aW9uVG9rZW4gKi8sXG4gICAgICB1bmRlZmluZWQgLyogZW1pdE9ubHlEdHNGaWxlcyAqLyxcbiAgICAgIHRyYW5zZm9ybWVycyxcbiAgICApO1xuXG4gICAgb25BZnRlckVtaXQ/Lihzb3VyY2VGaWxlKTtcblxuICAgIHJldHVybiB7IGNvbnRlbnQsIGRlcGVuZGVuY2llczogW10gfTtcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdHJhbnNmb3JtV2l0aEJhYmVsKFxuICBmaWxlbmFtZTogc3RyaW5nLFxuICBkYXRhOiBzdHJpbmcsXG4gIHBsdWdpbk9wdGlvbnM6IENvbXBpbGVyUGx1Z2luT3B0aW9ucyxcbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IGZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbiA9XG4gICAgIS9bXFxcXC9dW19mXT9lc20yMDE1W1xcXFwvXS8udGVzdChmaWxlbmFtZSkgJiYgL2FzeW5jXFxzK2Z1bmN0aW9uXFxzKlxcKi8udGVzdChkYXRhKTtcbiAgY29uc3Qgc2hvdWxkTGluayA9IGF3YWl0IHJlcXVpcmVzTGlua2luZyhmaWxlbmFtZSwgZGF0YSk7XG4gIGNvbnN0IHVzZUlucHV0U291cmNlbWFwID1cbiAgICBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCAmJlxuICAgICghIXBsdWdpbk9wdGlvbnMudGhpcmRQYXJ0eVNvdXJjZW1hcHMgfHwgIS9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS8udGVzdChmaWxlbmFtZSkpO1xuXG4gIC8vIElmIG5vIGFkZGl0aW9uYWwgdHJhbnNmb3JtYXRpb25zIGFyZSBuZWVkZWQsIHJldHVybiB0aGUgZGF0YSBkaXJlY3RseVxuICBpZiAoIWZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbiAmJiAhcGx1Z2luT3B0aW9ucy5hZHZhbmNlZE9wdGltaXphdGlvbnMgJiYgIXNob3VsZExpbmspIHtcbiAgICAvLyBTdHJpcCBzb3VyY2VtYXBzIGlmIHRoZXkgc2hvdWxkIG5vdCBiZSB1c2VkXG4gICAgcmV0dXJuIHVzZUlucHV0U291cmNlbWFwID8gZGF0YSA6IGRhdGEucmVwbGFjZSgvXlxcL1xcLyMgc291cmNlTWFwcGluZ1VSTD1bXlxcclxcbl0qL2dtLCAnJyk7XG4gIH1cblxuICBjb25zdCBhbmd1bGFyUGFja2FnZSA9IC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXUBhbmd1bGFyW1xcXFwvXS8udGVzdChmaWxlbmFtZSk7XG5cbiAgY29uc3QgbGlua2VyUGx1Z2luQ3JlYXRvciA9IHNob3VsZExpbmtcbiAgICA/IChcbiAgICAgICAgYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJyk+KFxuICAgICAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJyxcbiAgICAgICAgKVxuICAgICAgKS5jcmVhdGVFczIwMTVMaW5rZXJQbHVnaW5cbiAgICA6IHVuZGVmaW5lZDtcblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1Bc3luYyhkYXRhLCB7XG4gICAgZmlsZW5hbWUsXG4gICAgaW5wdXRTb3VyY2VNYXA6ICh1c2VJbnB1dFNvdXJjZW1hcCA/IHVuZGVmaW5lZCA6IGZhbHNlKSBhcyB1bmRlZmluZWQsXG4gICAgc291cmNlTWFwczogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAgPyAnaW5saW5lJyA6IGZhbHNlLFxuICAgIGNvbXBhY3Q6IGZhbHNlLFxuICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIGJhYmVscmM6IGZhbHNlLFxuICAgIGJyb3dzZXJzbGlzdENvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgIHBsdWdpbnM6IFtdLFxuICAgIHByZXNldHM6IFtcbiAgICAgIFtcbiAgICAgICAgYW5ndWxhckFwcGxpY2F0aW9uUHJlc2V0LFxuICAgICAgICB7XG4gICAgICAgICAgYW5ndWxhckxpbmtlcjoge1xuICAgICAgICAgICAgc2hvdWxkTGluayxcbiAgICAgICAgICAgIGppdE1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgbGlua2VyUGx1Z2luQ3JlYXRvcixcbiAgICAgICAgICB9LFxuICAgICAgICAgIGZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbixcbiAgICAgICAgICBvcHRpbWl6ZTogcGx1Z2luT3B0aW9ucy5hZHZhbmNlZE9wdGltaXphdGlvbnMgJiYge1xuICAgICAgICAgICAgbG9vc2VFbnVtczogYW5ndWxhclBhY2thZ2UsXG4gICAgICAgICAgICBwdXJlVG9wTGV2ZWw6IGFuZ3VsYXJQYWNrYWdlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIF0sXG4gIH0pO1xuXG4gIHJldHVybiByZXN1bHQ/LmNvZGUgPz8gZGF0YTtcbn1cblxuZnVuY3Rpb24gZmluZEFmZmVjdGVkRmlsZXMoXG4gIGJ1aWxkZXI6IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0sXG4gIHsgaWdub3JlRm9yRGlhZ25vc3RpY3MsIGlnbm9yZUZvckVtaXQsIGluY3JlbWVudGFsQ29tcGlsYXRpb24gfTogTmd0c2NQcm9ncmFtWydjb21waWxlciddLFxuKTogU2V0PHRzLlNvdXJjZUZpbGU+IHtcbiAgY29uc3QgYWZmZWN0ZWRGaWxlcyA9IG5ldyBTZXQ8dHMuU291cmNlRmlsZT4oKTtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYnVpbGRlci5nZXRTZW1hbnRpY0RpYWdub3N0aWNzT2ZOZXh0QWZmZWN0ZWRGaWxlKHVuZGVmaW5lZCwgKHNvdXJjZUZpbGUpID0+IHtcbiAgICAgIC8vIElmIHRoZSBhZmZlY3RlZCBmaWxlIGlzIGEgVFRDIHNoaW0sIGFkZCB0aGUgc2hpbSdzIG9yaWdpbmFsIHNvdXJjZSBmaWxlLlxuICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoYXQgY2hhbmdlcyB0aGF0IGFmZmVjdCBUVEMgYXJlIHR5cGVjaGVja2VkIGV2ZW4gd2hlbiB0aGUgY2hhbmdlc1xuICAgICAgLy8gYXJlIG90aGVyd2lzZSB1bnJlbGF0ZWQgZnJvbSBhIFRTIHBlcnNwZWN0aXZlIGFuZCBkbyBub3QgcmVzdWx0IGluIEl2eSBjb2RlZ2VuIGNoYW5nZXMuXG4gICAgICAvLyBGb3IgZXhhbXBsZSwgY2hhbmdpbmcgQElucHV0IHByb3BlcnR5IHR5cGVzIG9mIGEgZGlyZWN0aXZlIHVzZWQgaW4gYW5vdGhlciBjb21wb25lbnQnc1xuICAgICAgLy8gdGVtcGxhdGUuXG4gICAgICAvLyBBIFRUQyBzaGltIGlzIGEgZmlsZSB0aGF0IGhhcyBiZWVuIGlnbm9yZWQgZm9yIGRpYWdub3N0aWNzIGFuZCBoYXMgYSBmaWxlbmFtZSBlbmRpbmcgaW4gYC5uZ3R5cGVjaGVjay50c2AuXG4gICAgICBpZiAoaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpICYmIHNvdXJjZUZpbGUuZmlsZU5hbWUuZW5kc1dpdGgoJy5uZ3R5cGVjaGVjay50cycpKSB7XG4gICAgICAgIC8vIFRoaXMgZmlsZSBuYW1lIGNvbnZlcnNpb24gcmVsaWVzIG9uIGludGVybmFsIGNvbXBpbGVyIGxvZ2ljIGFuZCBzaG91bGQgYmUgY29udmVydGVkXG4gICAgICAgIC8vIHRvIGFuIG9mZmljaWFsIG1ldGhvZCB3aGVuIGF2YWlsYWJsZS4gMTUgaXMgbGVuZ3RoIG9mIGAubmd0eXBlY2hlY2sudHNgXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsRmlsZW5hbWUgPSBzb3VyY2VGaWxlLmZpbGVOYW1lLnNsaWNlKDAsIC0xNSkgKyAnLnRzJztcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxTb3VyY2VGaWxlID0gYnVpbGRlci5nZXRTb3VyY2VGaWxlKG9yaWdpbmFsRmlsZW5hbWUpO1xuICAgICAgICBpZiAob3JpZ2luYWxTb3VyY2VGaWxlKSB7XG4gICAgICAgICAgYWZmZWN0ZWRGaWxlcy5hZGQob3JpZ2luYWxTb3VyY2VGaWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgYWZmZWN0ZWRGaWxlcy5hZGQocmVzdWx0LmFmZmVjdGVkIGFzIHRzLlNvdXJjZUZpbGUpO1xuICB9XG5cbiAgLy8gQSBmaWxlIGlzIGFsc28gYWZmZWN0ZWQgaWYgdGhlIEFuZ3VsYXIgY29tcGlsZXIgcmVxdWlyZXMgaXQgdG8gYmUgZW1pdHRlZFxuICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgYnVpbGRlci5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgaWYgKGlnbm9yZUZvckVtaXQuaGFzKHNvdXJjZUZpbGUpIHx8IGluY3JlbWVudGFsQ29tcGlsYXRpb24uc2FmZVRvU2tpcEVtaXQoc291cmNlRmlsZSkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGFmZmVjdGVkRmlsZXMuYWRkKHNvdXJjZUZpbGUpO1xuICB9XG5cbiAgcmV0dXJuIGFmZmVjdGVkRmlsZXM7XG59XG4iXX0=