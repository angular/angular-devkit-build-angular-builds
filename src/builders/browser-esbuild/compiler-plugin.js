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
    }
    invalidate(files) {
        this.modifiedFiles.clear();
        for (let file of files) {
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
            // This uses a wrapped dynamic import to load `@angular/compiler-cli` which is ESM.
            // Once TypeScript provides support for retaining dynamic imports this workaround can be dropped.
            const compilerCli = await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli');
            // Temporary deep import for transformer support
            const { mergeTransformers, replaceBootstrap, } = require('@ngtools/webpack/src/ivy/transformation');
            // Setup defines based on the values provided by the Angular compiler-cli
            (_a = (_c = build.initialOptions).define) !== null && _a !== void 0 ? _a : (_c.define = {});
            for (const [key, value] of Object.entries(compilerCli.GLOBAL_DEFS_FOR_TERSER_WITH_AOT)) {
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
            const { options: compilerOptions, rootNames, errors: configurationDiagnostics, } = compilerCli.readConfiguration(pluginOptions.tsconfig, {
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
            });
            if (compilerOptions.target === undefined || compilerOptions.target < typescript_1.default.ScriptTarget.ES2022) {
                // If 'useDefineForClassFields' is already defined in the users project leave the value as is.
                // Otherwise fallback to false due to https://github.com/microsoft/TypeScript/issues/45995
                // which breaks the deprecated `@Effects` NGRX decorator and potentially other existing code as well.
                compilerOptions.target = typescript_1.default.ScriptTarget.ES2022;
                (_b = compilerOptions.useDefineForClassFields) !== null && _b !== void 0 ? _b : (compilerOptions.useDefineForClassFields = false);
                // TODO: show warning about this override when we have access to the logger.
            }
            // The file emitter created during `onStart` that will be used during the build in `onLoad` callbacks for TS files
            let fileEmitter;
            // The stylesheet resources from component stylesheets that will be added to the build results output files
            let stylesheetResourceFiles;
            let previousBuilder;
            let previousAngularProgram;
            const babelMemoryCache = new Map();
            build.onStart(async () => {
                var _a, _b;
                const result = {};
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
                const angularProgram = new compilerCli.NgtscProgram(rootNames, compilerOptions, host, previousAngularProgram);
                previousAngularProgram = angularProgram;
                const angularCompiler = angularProgram.compiler;
                const { ignoreForDiagnostics } = angularCompiler;
                const typeScriptProgram = angularProgram.getTsProgram();
                augmentProgramWithVersioning(typeScriptProgram);
                const builder = typescript_1.default.createEmitAndSemanticDiagnosticsBuilderProgram(typeScriptProgram, host, previousBuilder, configurationDiagnostics);
                previousBuilder = builder;
                await angularCompiler.analyzeAsync();
                function* collectDiagnostics() {
                    // Collect program level diagnostics
                    yield* builder.getConfigFileParsingDiagnostics();
                    yield* angularCompiler.getOptionDiagnostics();
                    yield* builder.getOptionsDiagnostics();
                    yield* builder.getGlobalDiagnostics();
                    // Collect source file specific diagnostics
                    const OptimizeFor = compilerCli.OptimizeFor;
                    for (const sourceFile of builder.getSourceFiles()) {
                        if (ignoreForDiagnostics.has(sourceFile)) {
                            continue;
                        }
                        yield* builder.getSyntacticDiagnostics(sourceFile);
                        yield* builder.getSemanticDiagnostics(sourceFile);
                        const angularDiagnostics = angularCompiler.getDiagnosticsForFile(sourceFile, OptimizeFor.WholeProgram);
                        yield* angularDiagnostics;
                    }
                }
                for (const diagnostic of collectDiagnostics()) {
                    const message = convertTypeScriptDiagnostic(diagnostic, host);
                    if (diagnostic.category === typescript_1.default.DiagnosticCategory.Error) {
                        ((_a = result.errors) !== null && _a !== void 0 ? _a : (result.errors = [])).push(message);
                    }
                    else {
                        ((_b = result.warnings) !== null && _b !== void 0 ? _b : (result.warnings = [])).push(message);
                    }
                }
                fileEmitter = createFileEmitter(builder, mergeTransformers(angularCompiler.prepareEmit().transformers, {
                    before: [replaceBootstrap(() => builder.getProgram().getTypeChecker())],
                }), (sourceFile) => angularCompiler.incrementalDriver.recordSuccessfulEmit(sourceFile));
                return result;
            });
            build.onLoad({ filter: compilerOptions.allowJs ? /\.[cm]?[jt]sx?$/ : /\.[cm]?tsx?$/ }, async (args) => {
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
                return {
                    contents: await transformWithBabelCached(args.path, (_c = typescriptResult.content) !== null && _c !== void 0 ? _c : '', pluginOptions, babelMemoryCache),
                    loader: 'js',
                };
            });
            build.onLoad({ filter: /\.[cm]?js$/ }, async (args) => {
                const data = await fs_1.promises.readFile(args.path, 'utf-8');
                return {
                    contents: await transformWithBabelCached(args.path, data, pluginOptions, babelMemoryCache),
                    loader: 'js',
                };
            });
            build.onEnd((result) => {
                var _a;
                if (stylesheetResourceFiles.length) {
                    (_a = result.outputFiles) === null || _a === void 0 ? void 0 : _a.push(...stylesheetResourceFiles);
                }
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
/**
 * Transforms JavaScript file data using the babel transforms setup in transformWithBabel. The
 * supplied cache will be used to avoid repeating the transforms for data that has previously
 * been transformed such as in a previous rebuild cycle.
 * @param filename The file path of the data to be transformed.
 * @param data The file data that will be transformed.
 * @param pluginOptions Compiler plugin options that will be used to control the transformation.
 * @param cache A cache of previously transformed data that will be used to avoid repeat transforms.
 * @returns A promise containing the transformed data.
 */
async function transformWithBabelCached(filename, data, pluginOptions, cache) {
    // The pre-transformed data is used as a cache key. Since the cache is memory only,
    // the options cannot change and do not need to be represented in the key. If the
    // cache is later stored to disk, then the options that affect transform output
    // would need to be added to the key as well.
    let result = cache.get(data);
    if (result === undefined) {
        result = await transformWithBabel(filename, data, pluginOptions);
        cache.set(data, result);
    }
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILHNDQUE2QztBQUM3QywrQ0FBaUM7QUFTakMsMkJBQW9DO0FBQ3BDLDJCQUE4QjtBQUM5QiwyQ0FBNkI7QUFDN0IsNERBQTRCO0FBQzVCLGtGQUF1RTtBQUN2RSwrREFBNkQ7QUFDN0QsbURBQXFEO0FBQ3JELCtDQUFvRztBQVVwRzs7Ozs7OztHQU9HO0FBQ0gsU0FBUywrQkFBK0IsQ0FDdEMsSUFBcUMsRUFDckMsSUFBOEIsRUFDOUIsVUFBbUI7SUFFbkIsSUFBSSxJQUFJLEdBQUcsb0JBQUUsQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0lBQ2hGLElBQUksVUFBVSxFQUFFO1FBQ2QsSUFBSSxHQUFHLFVBQVUsR0FBRyxJQUFJLENBQUM7S0FDMUI7SUFFRCxNQUFNLElBQUksR0FBZ0IsRUFBRSxJQUFJLEVBQUUsQ0FBQztJQUVuQyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUU7UUFDYixJQUFJLENBQUMsUUFBUSxHQUFHO1lBQ2QsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUTtZQUN4QixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07U0FDcEIsQ0FBQztRQUVGLDRGQUE0RjtRQUM1RixJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDZCxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLG9CQUFFLENBQUMsNkJBQTZCLENBQUMsSUFBSSxDQUFD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RkFBbUY7SUFDbkYsaUZBQWlGO0lBQ2pGLCtFQUErRTtJQUMvRSw2Q0FBNkM7SUFDN0MsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM3QixJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUU7UUFDeEIsTUFBTSxHQUFHLE1BQU0sa0JBQWtCLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxhQUFhLENBQUMsQ0FBQztRQUNqRSxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztLQUN6QjtJQUVELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBDb21waWxlckhvc3QsIE5ndHNjUHJvZ3JhbSB9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQgeyB0cmFuc2Zvcm1Bc3luYyB9IGZyb20gJ0BiYWJlbC9jb3JlJztcbmltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHR5cGUge1xuICBPblN0YXJ0UmVzdWx0LFxuICBPdXRwdXRGaWxlLFxuICBQYXJ0aWFsTWVzc2FnZSxcbiAgUGFydGlhbE5vdGUsXG4gIFBsdWdpbixcbiAgUGx1Z2luQnVpbGQsXG59IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgcHJvbWlzZXMgYXMgZnMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJ29zJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgYW5ndWxhckFwcGxpY2F0aW9uUHJlc2V0IGZyb20gJy4uLy4uL2JhYmVsL3ByZXNldHMvYXBwbGljYXRpb24nO1xuaW1wb3J0IHsgcmVxdWlyZXNMaW5raW5nIH0gZnJvbSAnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcbmltcG9ydCB7IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLCBidW5kbGVTdHlsZXNoZWV0RmlsZSwgYnVuZGxlU3R5bGVzaGVldFRleHQgfSBmcm9tICcuL3N0eWxlc2hlZXRzJztcblxuaW50ZXJmYWNlIEVtaXRGaWxlUmVzdWx0IHtcbiAgY29udGVudD86IHN0cmluZztcbiAgbWFwPzogc3RyaW5nO1xuICBkZXBlbmRlbmNpZXM6IHJlYWRvbmx5IHN0cmluZ1tdO1xuICBoYXNoPzogVWludDhBcnJheTtcbn1cbnR5cGUgRmlsZUVtaXR0ZXIgPSAoZmlsZTogc3RyaW5nKSA9PiBQcm9taXNlPEVtaXRGaWxlUmVzdWx0IHwgdW5kZWZpbmVkPjtcblxuLyoqXG4gKiBDb252ZXJ0cyBUeXBlU2NyaXB0IERpYWdub3N0aWMgcmVsYXRlZCBpbmZvcm1hdGlvbiBpbnRvIGFuIGVzYnVpbGQgY29tcGF0aWJsZSBub3RlIG9iamVjdC5cbiAqIFJlbGF0ZWQgaW5mb3JtYXRpb24gaXMgYSBzdWJzZXQgb2YgYSBmdWxsIFR5cGVTY3JpcHQgRGlhZ25vc3RpYyBhbmQgYWxzbyB1c2VkIGZvciBkaWFnbm9zdGljXG4gKiBub3RlcyBhc3NvY2lhdGVkIHdpdGggdGhlIG1haW4gRGlhZ25vc3RpYy5cbiAqIEBwYXJhbSBpbmZvIFRoZSBUeXBlU2NyaXB0IGRpYWdub3N0aWMgcmVsYXRpdmUgaW5mb3JtYXRpb24gdG8gY29udmVydC5cbiAqIEBwYXJhbSBob3N0IEEgVHlwZVNjcmlwdCBGb3JtYXREaWFnbm9zdGljc0hvc3QgaW5zdGFuY2UgdG8gdXNlIGR1cmluZyBjb252ZXJzaW9uLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBkaWFnbm9zdGljIG1lc3NhZ2UgYXMgYSBQYXJ0aWFsTWVzc2FnZSBvYmplY3RcbiAqL1xuZnVuY3Rpb24gY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljSW5mbyhcbiAgaW5mbzogdHMuRGlhZ25vc3RpY1JlbGF0ZWRJbmZvcm1hdGlvbixcbiAgaG9zdDogdHMuRm9ybWF0RGlhZ25vc3RpY3NIb3N0LFxuICB0ZXh0UHJlZml4Pzogc3RyaW5nLFxuKTogUGFydGlhbE5vdGUge1xuICBsZXQgdGV4dCA9IHRzLmZsYXR0ZW5EaWFnbm9zdGljTWVzc2FnZVRleHQoaW5mby5tZXNzYWdlVGV4dCwgaG9zdC5nZXROZXdMaW5lKCkpO1xuICBpZiAodGV4dFByZWZpeCkge1xuICAgIHRleHQgPSB0ZXh0UHJlZml4ICsgdGV4dDtcbiAgfVxuXG4gIGNvbnN0IG5vdGU6IFBhcnRpYWxOb3RlID0geyB0ZXh0IH07XG5cbiAgaWYgKGluZm8uZmlsZSkge1xuICAgIG5vdGUubG9jYXRpb24gPSB7XG4gICAgICBmaWxlOiBpbmZvLmZpbGUuZmlsZU5hbWUsXG4gICAgICBsZW5ndGg6IGluZm8ubGVuZ3RoLFxuICAgIH07XG5cbiAgICAvLyBDYWxjdWxhdGUgdGhlIGxpbmUvY29sdW1uIGxvY2F0aW9uIGFuZCBleHRyYWN0IHRoZSBmdWxsIGxpbmUgdGV4dCB0aGF0IGhhcyB0aGUgZGlhZ25vc3RpY1xuICAgIGlmIChpbmZvLnN0YXJ0KSB7XG4gICAgICBjb25zdCB7IGxpbmUsIGNoYXJhY3RlciB9ID0gdHMuZ2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24oaW5mby5maWxlLCBpbmZvLnN0YXJ0KTtcbiAgICAgIG5vdGUubG9jYXRpb24ubGluZSA9IGxpbmUgKyAxO1xuICAgICAgbm90ZS5sb2NhdGlvbi5jb2x1bW4gPSBjaGFyYWN0ZXI7XG5cbiAgICAgIC8vIFRoZSBzdGFydCBwb3NpdGlvbiBmb3IgdGhlIHNsaWNlIGlzIHRoZSBmaXJzdCBjaGFyYWN0ZXIgb2YgdGhlIGVycm9yIGxpbmVcbiAgICAgIGNvbnN0IGxpbmVTdGFydFBvc2l0aW9uID0gdHMuZ2V0UG9zaXRpb25PZkxpbmVBbmRDaGFyYWN0ZXIoaW5mby5maWxlLCBsaW5lLCAwKTtcblxuICAgICAgLy8gVGhlIGVuZCBwb3NpdGlvbiBmb3IgdGhlIHNsaWNlIGlzIHRoZSBmaXJzdCBjaGFyYWN0ZXIgb2YgdGhlIG5leHQgbGluZSBvciB0aGUgbGVuZ3RoIG9mXG4gICAgICAvLyB0aGUgZW50aXJlIGZpbGUgaWYgdGhlIGxpbmUgaXMgdGhlIGxhc3QgbGluZSBvZiB0aGUgZmlsZSAoZ2V0UG9zaXRpb25PZkxpbmVBbmRDaGFyYWN0ZXJcbiAgICAgIC8vIHdpbGwgZXJyb3IgaWYgYSBub25leGlzdGVudCBsaW5lIGlzIHBhc3NlZCkuXG4gICAgICBjb25zdCB7IGxpbmU6IGxhc3RMaW5lT2ZGaWxlIH0gPSB0cy5nZXRMaW5lQW5kQ2hhcmFjdGVyT2ZQb3NpdGlvbihcbiAgICAgICAgaW5mby5maWxlLFxuICAgICAgICBpbmZvLmZpbGUudGV4dC5sZW5ndGggLSAxLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGxpbmVFbmRQb3NpdGlvbiA9XG4gICAgICAgIGxpbmUgPCBsYXN0TGluZU9mRmlsZVxuICAgICAgICAgID8gdHMuZ2V0UG9zaXRpb25PZkxpbmVBbmRDaGFyYWN0ZXIoaW5mby5maWxlLCBsaW5lICsgMSwgMClcbiAgICAgICAgICA6IGluZm8uZmlsZS50ZXh0Lmxlbmd0aDtcblxuICAgICAgbm90ZS5sb2NhdGlvbi5saW5lVGV4dCA9IGluZm8uZmlsZS50ZXh0LnNsaWNlKGxpbmVTdGFydFBvc2l0aW9uLCBsaW5lRW5kUG9zaXRpb24pLnRyaW1FbmQoKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbm90ZTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBhIFR5cGVTY3JpcHQgRGlhZ25vc3RpYyBtZXNzYWdlIGludG8gYW4gZXNidWlsZCBjb21wYXRpYmxlIG1lc3NhZ2Ugb2JqZWN0LlxuICogQHBhcmFtIGRpYWdub3N0aWMgVGhlIFR5cGVTY3JpcHQgZGlhZ25vc3RpYyB0byBjb252ZXJ0LlxuICogQHBhcmFtIGhvc3QgQSBUeXBlU2NyaXB0IEZvcm1hdERpYWdub3N0aWNzSG9zdCBpbnN0YW5jZSB0byB1c2UgZHVyaW5nIGNvbnZlcnNpb24uXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIGRpYWdub3N0aWMgbWVzc2FnZSBhcyBhIFBhcnRpYWxNZXNzYWdlIG9iamVjdFxuICovXG5mdW5jdGlvbiBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWMoXG4gIGRpYWdub3N0aWM6IHRzLkRpYWdub3N0aWMsXG4gIGhvc3Q6IHRzLkZvcm1hdERpYWdub3N0aWNzSG9zdCxcbik6IFBhcnRpYWxNZXNzYWdlIHtcbiAgbGV0IGNvZGVQcmVmaXggPSAnVFMnO1xuICBsZXQgY29kZSA9IGAke2RpYWdub3N0aWMuY29kZX1gO1xuICBpZiAoZGlhZ25vc3RpYy5zb3VyY2UgPT09ICduZ3RzYycpIHtcbiAgICBjb2RlUHJlZml4ID0gJ05HJztcbiAgICAvLyBSZW1vdmUgYC05OWAgQW5ndWxhciBwcmVmaXggZnJvbSBkaWFnbm9zdGljIGNvZGVcbiAgICBjb2RlID0gY29kZS5zbGljZSgzKTtcbiAgfVxuXG4gIGNvbnN0IG1lc3NhZ2U6IFBhcnRpYWxNZXNzYWdlID0ge1xuICAgIC4uLmNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oZGlhZ25vc3RpYywgaG9zdCwgYCR7Y29kZVByZWZpeH0ke2NvZGV9OiBgKSxcbiAgICAvLyBTdG9yZSBvcmlnaW5hbCBkaWFnbm9zdGljIGZvciByZWZlcmVuY2UgaWYgbmVlZGVkIGRvd25zdHJlYW1cbiAgICBkZXRhaWw6IGRpYWdub3N0aWMsXG4gIH07XG5cbiAgaWYgKGRpYWdub3N0aWMucmVsYXRlZEluZm9ybWF0aW9uPy5sZW5ndGgpIHtcbiAgICBtZXNzYWdlLm5vdGVzID0gZGlhZ25vc3RpYy5yZWxhdGVkSW5mb3JtYXRpb24ubWFwKChpbmZvKSA9PlxuICAgICAgY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljSW5mbyhpbmZvLCBob3N0KSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIG1lc3NhZ2U7XG59XG5cbmNvbnN0IFVTSU5HX1dJTkRPV1MgPSBwbGF0Zm9ybSgpID09PSAnd2luMzInO1xuY29uc3QgV0lORE9XU19TRVBfUkVHRVhQID0gbmV3IFJlZ0V4cChgXFxcXCR7cGF0aC53aW4zMi5zZXB9YCwgJ2cnKTtcblxuZXhwb3J0IGNsYXNzIFNvdXJjZUZpbGVDYWNoZSBleHRlbmRzIE1hcDxzdHJpbmcsIHRzLlNvdXJjZUZpbGU+IHtcbiAgcmVhZG9ubHkgbW9kaWZpZWRGaWxlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIGludmFsaWRhdGUoZmlsZXM6IEl0ZXJhYmxlPHN0cmluZz4pOiB2b2lkIHtcbiAgICB0aGlzLm1vZGlmaWVkRmlsZXMuY2xlYXIoKTtcbiAgICBmb3IgKGxldCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICAvLyBOb3JtYWxpemUgc2VwYXJhdG9ycyB0byBhbGxvdyBtYXRjaGluZyBUeXBlU2NyaXB0IEhvc3QgcGF0aHNcbiAgICAgIGlmIChVU0lOR19XSU5ET1dTKSB7XG4gICAgICAgIGZpbGUgPSBmaWxlLnJlcGxhY2UoV0lORE9XU19TRVBfUkVHRVhQLCBwYXRoLnBvc2l4LnNlcCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZGVsZXRlKGZpbGUpO1xuICAgICAgdGhpcy5tb2RpZmllZEZpbGVzLmFkZChmaWxlKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb21waWxlclBsdWdpbk9wdGlvbnMge1xuICBzb3VyY2VtYXA6IGJvb2xlYW47XG4gIHRzY29uZmlnOiBzdHJpbmc7XG4gIGFkdmFuY2VkT3B0aW1pemF0aW9ucz86IGJvb2xlYW47XG4gIHRoaXJkUGFydHlTb3VyY2VtYXBzPzogYm9vbGVhbjtcbiAgZmlsZVJlcGxhY2VtZW50cz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZTtcbn1cblxuLy8gVGhpcyBpcyBhIG5vbi13YXRjaCB2ZXJzaW9uIG9mIHRoZSBjb21waWxlciBjb2RlIGZyb20gYEBuZ3Rvb2xzL3dlYnBhY2tgIGF1Z21lbnRlZCBmb3IgZXNidWlsZFxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgcGx1Z2luT3B0aW9uczogQ29tcGlsZXJQbHVnaW5PcHRpb25zLFxuICBzdHlsZU9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLFxuKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1jb21waWxlcicsXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbiAgICBhc3luYyBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgIC8vIFRoaXMgdXNlcyBhIHdyYXBwZWQgZHluYW1pYyBpbXBvcnQgdG8gbG9hZCBgQGFuZ3VsYXIvY29tcGlsZXItY2xpYCB3aGljaCBpcyBFU00uXG4gICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3IgcmV0YWluaW5nIGR5bmFtaWMgaW1wb3J0cyB0aGlzIHdvcmthcm91bmQgY2FuIGJlIGRyb3BwZWQuXG4gICAgICBjb25zdCBjb21waWxlckNsaSA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk+KFxuICAgICAgICAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJyxcbiAgICAgICk7XG5cbiAgICAgIC8vIFRlbXBvcmFyeSBkZWVwIGltcG9ydCBmb3IgdHJhbnNmb3JtZXIgc3VwcG9ydFxuICAgICAgY29uc3Qge1xuICAgICAgICBtZXJnZVRyYW5zZm9ybWVycyxcbiAgICAgICAgcmVwbGFjZUJvb3RzdHJhcCxcbiAgICAgIH0gPSByZXF1aXJlKCdAbmd0b29scy93ZWJwYWNrL3NyYy9pdnkvdHJhbnNmb3JtYXRpb24nKTtcblxuICAgICAgLy8gU2V0dXAgZGVmaW5lcyBiYXNlZCBvbiB0aGUgdmFsdWVzIHByb3ZpZGVkIGJ5IHRoZSBBbmd1bGFyIGNvbXBpbGVyLWNsaVxuICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lID8/PSB7fTtcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGNvbXBpbGVyQ2xpLkdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QpKSB7XG4gICAgICAgIGlmIChrZXkgaW4gYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lKSB7XG4gICAgICAgICAgLy8gU2tpcCBrZXlzIHRoYXQgaGF2ZSBiZWVuIG1hbnVhbGx5IHByb3ZpZGVkXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZXNidWlsZCByZXF1aXJlcyB2YWx1ZXMgdG8gYmUgYSBzdHJpbmcgKGFjdHVhbCBzdHJpbmdzIG5lZWQgdG8gYmUgcXVvdGVkKS5cbiAgICAgICAgLy8gSW4gdGhpcyBjYXNlLCBhbGwgcHJvdmlkZWQgdmFsdWVzIGFyZSBib29sZWFucy5cbiAgICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lW2tleV0gPSB2YWx1ZS50b1N0cmluZygpO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgdHNjb25maWcgaXMgbG9hZGVkIGluIHNldHVwIGluc3RlYWQgb2YgaW4gc3RhcnQgdG8gYWxsb3cgdGhlIGVzYnVpbGQgdGFyZ2V0IGJ1aWxkIG9wdGlvbiB0byBiZSBtb2RpZmllZC5cbiAgICAgIC8vIGVzYnVpbGQgYnVpbGQgb3B0aW9ucyBjYW4gb25seSBiZSBtb2RpZmllZCBpbiBzZXR1cCBwcmlvciB0byBzdGFydGluZyB0aGUgYnVpbGQuXG4gICAgICBjb25zdCB7XG4gICAgICAgIG9wdGlvbnM6IGNvbXBpbGVyT3B0aW9ucyxcbiAgICAgICAgcm9vdE5hbWVzLFxuICAgICAgICBlcnJvcnM6IGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcyxcbiAgICAgIH0gPSBjb21waWxlckNsaS5yZWFkQ29uZmlndXJhdGlvbihwbHVnaW5PcHRpb25zLnRzY29uZmlnLCB7XG4gICAgICAgIG5vRW1pdE9uRXJyb3I6IGZhbHNlLFxuICAgICAgICBzdXBwcmVzc091dHB1dFBhdGhDaGVjazogdHJ1ZSxcbiAgICAgICAgb3V0RGlyOiB1bmRlZmluZWQsXG4gICAgICAgIGlubGluZVNvdXJjZXM6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICBpbmxpbmVTb3VyY2VNYXA6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxuICAgICAgICBtYXBSb290OiB1bmRlZmluZWQsXG4gICAgICAgIHNvdXJjZVJvb3Q6IHVuZGVmaW5lZCxcbiAgICAgICAgZGVjbGFyYXRpb246IGZhbHNlLFxuICAgICAgICBkZWNsYXJhdGlvbk1hcDogZmFsc2UsXG4gICAgICAgIGFsbG93RW1wdHlDb2RlZ2VuRmlsZXM6IGZhbHNlLFxuICAgICAgICBhbm5vdGF0aW9uc0FzOiAnZGVjb3JhdG9ycycsXG4gICAgICAgIGVuYWJsZVJlc291cmNlSW5saW5pbmc6IGZhbHNlLFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChjb21waWxlck9wdGlvbnMudGFyZ2V0ID09PSB1bmRlZmluZWQgfHwgY29tcGlsZXJPcHRpb25zLnRhcmdldCA8IHRzLlNjcmlwdFRhcmdldC5FUzIwMjIpIHtcbiAgICAgICAgLy8gSWYgJ3VzZURlZmluZUZvckNsYXNzRmllbGRzJyBpcyBhbHJlYWR5IGRlZmluZWQgaW4gdGhlIHVzZXJzIHByb2plY3QgbGVhdmUgdGhlIHZhbHVlIGFzIGlzLlxuICAgICAgICAvLyBPdGhlcndpc2UgZmFsbGJhY2sgdG8gZmFsc2UgZHVlIHRvIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvNDU5OTVcbiAgICAgICAgLy8gd2hpY2ggYnJlYWtzIHRoZSBkZXByZWNhdGVkIGBARWZmZWN0c2AgTkdSWCBkZWNvcmF0b3IgYW5kIHBvdGVudGlhbGx5IG90aGVyIGV4aXN0aW5nIGNvZGUgYXMgd2VsbC5cbiAgICAgICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCA9IHRzLlNjcmlwdFRhcmdldC5FUzIwMjI7XG4gICAgICAgIGNvbXBpbGVyT3B0aW9ucy51c2VEZWZpbmVGb3JDbGFzc0ZpZWxkcyA/Pz0gZmFsc2U7XG4gICAgICAgIC8vIFRPRE86IHNob3cgd2FybmluZyBhYm91dCB0aGlzIG92ZXJyaWRlIHdoZW4gd2UgaGF2ZSBhY2Nlc3MgdG8gdGhlIGxvZ2dlci5cbiAgICAgIH1cblxuICAgICAgLy8gVGhlIGZpbGUgZW1pdHRlciBjcmVhdGVkIGR1cmluZyBgb25TdGFydGAgdGhhdCB3aWxsIGJlIHVzZWQgZHVyaW5nIHRoZSBidWlsZCBpbiBgb25Mb2FkYCBjYWxsYmFja3MgZm9yIFRTIGZpbGVzXG4gICAgICBsZXQgZmlsZUVtaXR0ZXI6IEZpbGVFbWl0dGVyIHwgdW5kZWZpbmVkO1xuXG4gICAgICAvLyBUaGUgc3R5bGVzaGVldCByZXNvdXJjZXMgZnJvbSBjb21wb25lbnQgc3R5bGVzaGVldHMgdGhhdCB3aWxsIGJlIGFkZGVkIHRvIHRoZSBidWlsZCByZXN1bHRzIG91dHB1dCBmaWxlc1xuICAgICAgbGV0IHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzOiBPdXRwdXRGaWxlW107XG5cbiAgICAgIGxldCBwcmV2aW91c0J1aWxkZXI6IHRzLkVtaXRBbmRTZW1hbnRpY0RpYWdub3N0aWNzQnVpbGRlclByb2dyYW0gfCB1bmRlZmluZWQ7XG4gICAgICBsZXQgcHJldmlvdXNBbmd1bGFyUHJvZ3JhbTogTmd0c2NQcm9ncmFtIHwgdW5kZWZpbmVkO1xuICAgICAgY29uc3QgYmFiZWxNZW1vcnlDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cbiAgICAgIGJ1aWxkLm9uU3RhcnQoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQ6IE9uU3RhcnRSZXN1bHQgPSB7fTtcblxuICAgICAgICAvLyBSZXNldCBzdHlsZXNoZWV0IHJlc291cmNlIG91dHB1dCBmaWxlc1xuICAgICAgICBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyA9IFtdO1xuXG4gICAgICAgIC8vIENyZWF0ZSBUeXBlU2NyaXB0IGNvbXBpbGVyIGhvc3RcbiAgICAgICAgY29uc3QgaG9zdCA9IHRzLmNyZWF0ZUluY3JlbWVudGFsQ29tcGlsZXJIb3N0KGNvbXBpbGVyT3B0aW9ucyk7XG5cbiAgICAgICAgLy8gVGVtcG9yYXJpbHkgcHJvY2VzcyBleHRlcm5hbCByZXNvdXJjZXMgdmlhIHJlYWRSZXNvdXJjZS5cbiAgICAgICAgLy8gVGhlIEFPVCBjb21waWxlciBjdXJyZW50bHkgcmVxdWlyZXMgdGhpcyBob29rIHRvIGFsbG93IGZvciBhIHRyYW5zZm9ybVJlc291cmNlIGhvb2suXG4gICAgICAgIC8vIE9uY2UgdGhlIEFPVCBjb21waWxlciBhbGxvd3Mgb25seSBhIHRyYW5zZm9ybVJlc291cmNlIGhvb2ssIHRoaXMgY2FuIGJlIHJlZXZhbHVhdGVkLlxuICAgICAgICAoaG9zdCBhcyBDb21waWxlckhvc3QpLnJlYWRSZXNvdXJjZSA9IGFzeW5jIGZ1bmN0aW9uIChmaWxlTmFtZSkge1xuICAgICAgICAgIC8vIFRlbXBsYXRlIHJlc291cmNlcyAoLmh0bWwvLnN2ZykgZmlsZXMgYXJlIG5vdCBidW5kbGVkIG9yIHRyYW5zZm9ybWVkXG4gICAgICAgICAgaWYgKGZpbGVOYW1lLmVuZHNXaXRoKCcuaHRtbCcpIHx8IGZpbGVOYW1lLmVuZHNXaXRoKCcuc3ZnJykpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlYWRGaWxlKGZpbGVOYW1lKSA/PyAnJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCB7IGNvbnRlbnRzLCByZXNvdXJjZUZpbGVzLCBlcnJvcnMsIHdhcm5pbmdzIH0gPSBhd2FpdCBidW5kbGVTdHlsZXNoZWV0RmlsZShcbiAgICAgICAgICAgIGZpbGVOYW1lLFxuICAgICAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaCguLi53YXJuaW5ncyk7XG4gICAgICAgICAgc3R5bGVzaGVldFJlc291cmNlRmlsZXMucHVzaCguLi5yZXNvdXJjZUZpbGVzKTtcblxuICAgICAgICAgIHJldHVybiBjb250ZW50cztcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBBZGQgYW4gQU9UIGNvbXBpbGVyIHJlc291cmNlIHRyYW5zZm9ybSBob29rXG4gICAgICAgIChob3N0IGFzIENvbXBpbGVySG9zdCkudHJhbnNmb3JtUmVzb3VyY2UgPSBhc3luYyBmdW5jdGlvbiAoZGF0YSwgY29udGV4dCkge1xuICAgICAgICAgIC8vIE9ubHkgaW5saW5lIHN0eWxlIHJlc291cmNlcyBhcmUgdHJhbnNmb3JtZWQgc2VwYXJhdGVseSBjdXJyZW50bHlcbiAgICAgICAgICBpZiAoY29udGV4dC5yZXNvdXJjZUZpbGUgfHwgY29udGV4dC50eXBlICE9PSAnc3R5bGUnKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUaGUgZmlsZSB3aXRoIHRoZSByZXNvdXJjZSBjb250ZW50IHdpbGwgZWl0aGVyIGJlIGFuIGFjdHVhbCBmaWxlIChyZXNvdXJjZUZpbGUpXG4gICAgICAgICAgLy8gb3IgdGhlIGZpbGUgY29udGFpbmluZyB0aGUgaW5saW5lIGNvbXBvbmVudCBzdHlsZSB0ZXh0IChjb250YWluaW5nRmlsZSkuXG4gICAgICAgICAgY29uc3QgZmlsZSA9IGNvbnRleHQucmVzb3VyY2VGaWxlID8/IGNvbnRleHQuY29udGFpbmluZ0ZpbGU7XG5cbiAgICAgICAgICBjb25zdCB7IGNvbnRlbnRzLCByZXNvdXJjZUZpbGVzLCBlcnJvcnMsIHdhcm5pbmdzIH0gPSBhd2FpdCBidW5kbGVTdHlsZXNoZWV0VGV4dChcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHJlc29sdmVQYXRoOiBwYXRoLmRpcm5hbWUoZmlsZSksXG4gICAgICAgICAgICAgIHZpcnR1YWxOYW1lOiBmaWxlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgICAgKHJlc3VsdC53YXJuaW5ncyA/Pz0gW10pLnB1c2goLi4ud2FybmluZ3MpO1xuICAgICAgICAgIHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLnB1c2goLi4ucmVzb3VyY2VGaWxlcyk7XG5cbiAgICAgICAgICByZXR1cm4geyBjb250ZW50OiBjb250ZW50cyB9O1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFRlbXBvcmFyeSBkZWVwIGltcG9ydCBmb3IgaG9zdCBhdWdtZW50YXRpb24gc3VwcG9ydFxuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgYXVnbWVudEhvc3RXaXRoQ2FjaGluZyxcbiAgICAgICAgICBhdWdtZW50SG9zdFdpdGhSZXBsYWNlbWVudHMsXG4gICAgICAgICAgYXVnbWVudFByb2dyYW1XaXRoVmVyc2lvbmluZyxcbiAgICAgICAgfSA9IHJlcXVpcmUoJ0BuZ3Rvb2xzL3dlYnBhY2svc3JjL2l2eS9ob3N0Jyk7XG5cbiAgICAgICAgLy8gQXVnbWVudCBUeXBlU2NyaXB0IEhvc3QgZm9yIGZpbGUgcmVwbGFjZW1lbnRzIG9wdGlvblxuICAgICAgICBpZiAocGx1Z2luT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgICAgICAgYXVnbWVudEhvc3RXaXRoUmVwbGFjZW1lbnRzKGhvc3QsIHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBdWdtZW50IFR5cGVTY3JpcHQgSG9zdCB3aXRoIHNvdXJjZSBmaWxlIGNhY2hpbmcgaWYgcHJvdmlkZWRcbiAgICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlKSB7XG4gICAgICAgICAgYXVnbWVudEhvc3RXaXRoQ2FjaGluZyhob3N0LCBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZSk7XG4gICAgICAgICAgLy8gQWxsb3cgdGhlIEFPVCBjb21waWxlciB0byByZXF1ZXN0IHRoZSBzZXQgb2YgY2hhbmdlZCB0ZW1wbGF0ZXMgYW5kIHN0eWxlc1xuICAgICAgICAgIChob3N0IGFzIENvbXBpbGVySG9zdCkuZ2V0TW9kaWZpZWRSZXNvdXJjZUZpbGVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5tb2RpZmllZEZpbGVzO1xuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDcmVhdGUgdGhlIEFuZ3VsYXIgc3BlY2lmaWMgcHJvZ3JhbSB0aGF0IGNvbnRhaW5zIHRoZSBBbmd1bGFyIGNvbXBpbGVyXG4gICAgICAgIGNvbnN0IGFuZ3VsYXJQcm9ncmFtID0gbmV3IGNvbXBpbGVyQ2xpLk5ndHNjUHJvZ3JhbShcbiAgICAgICAgICByb290TmFtZXMsXG4gICAgICAgICAgY29tcGlsZXJPcHRpb25zLFxuICAgICAgICAgIGhvc3QsXG4gICAgICAgICAgcHJldmlvdXNBbmd1bGFyUHJvZ3JhbSxcbiAgICAgICAgKTtcbiAgICAgICAgcHJldmlvdXNBbmd1bGFyUHJvZ3JhbSA9IGFuZ3VsYXJQcm9ncmFtO1xuICAgICAgICBjb25zdCBhbmd1bGFyQ29tcGlsZXIgPSBhbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgICAgICAgY29uc3QgeyBpZ25vcmVGb3JEaWFnbm9zdGljcyB9ID0gYW5ndWxhckNvbXBpbGVyO1xuICAgICAgICBjb25zdCB0eXBlU2NyaXB0UHJvZ3JhbSA9IGFuZ3VsYXJQcm9ncmFtLmdldFRzUHJvZ3JhbSgpO1xuICAgICAgICBhdWdtZW50UHJvZ3JhbVdpdGhWZXJzaW9uaW5nKHR5cGVTY3JpcHRQcm9ncmFtKTtcblxuICAgICAgICBjb25zdCBidWlsZGVyID0gdHMuY3JlYXRlRW1pdEFuZFNlbWFudGljRGlhZ25vc3RpY3NCdWlsZGVyUHJvZ3JhbShcbiAgICAgICAgICB0eXBlU2NyaXB0UHJvZ3JhbSxcbiAgICAgICAgICBob3N0LFxuICAgICAgICAgIHByZXZpb3VzQnVpbGRlcixcbiAgICAgICAgICBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3MsXG4gICAgICAgICk7XG4gICAgICAgIHByZXZpb3VzQnVpbGRlciA9IGJ1aWxkZXI7XG5cbiAgICAgICAgYXdhaXQgYW5ndWxhckNvbXBpbGVyLmFuYWx5emVBc3luYygpO1xuXG4gICAgICAgIGZ1bmN0aW9uKiBjb2xsZWN0RGlhZ25vc3RpY3MoKTogSXRlcmFibGU8dHMuRGlhZ25vc3RpYz4ge1xuICAgICAgICAgIC8vIENvbGxlY3QgcHJvZ3JhbSBsZXZlbCBkaWFnbm9zdGljc1xuICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldENvbmZpZ0ZpbGVQYXJzaW5nRGlhZ25vc3RpY3MoKTtcbiAgICAgICAgICB5aWVsZCogYW5ndWxhckNvbXBpbGVyLmdldE9wdGlvbkRpYWdub3N0aWNzKCk7XG4gICAgICAgICAgeWllbGQqIGJ1aWxkZXIuZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCk7XG4gICAgICAgICAgeWllbGQqIGJ1aWxkZXIuZ2V0R2xvYmFsRGlhZ25vc3RpY3MoKTtcblxuICAgICAgICAgIC8vIENvbGxlY3Qgc291cmNlIGZpbGUgc3BlY2lmaWMgZGlhZ25vc3RpY3NcbiAgICAgICAgICBjb25zdCBPcHRpbWl6ZUZvciA9IGNvbXBpbGVyQ2xpLk9wdGltaXplRm9yO1xuICAgICAgICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiBidWlsZGVyLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChpZ25vcmVGb3JEaWFnbm9zdGljcy5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldFN5bnRhY3RpY0RpYWdub3N0aWNzKHNvdXJjZUZpbGUpO1xuICAgICAgICAgICAgeWllbGQqIGJ1aWxkZXIuZ2V0U2VtYW50aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlKTtcblxuICAgICAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gYW5ndWxhckNvbXBpbGVyLmdldERpYWdub3N0aWNzRm9yRmlsZShcbiAgICAgICAgICAgICAgc291cmNlRmlsZSxcbiAgICAgICAgICAgICAgT3B0aW1pemVGb3IuV2hvbGVQcm9ncmFtLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHlpZWxkKiBhbmd1bGFyRGlhZ25vc3RpY3M7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCBkaWFnbm9zdGljIG9mIGNvbGxlY3REaWFnbm9zdGljcygpKSB7XG4gICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpYyhkaWFnbm9zdGljLCBob3N0KTtcbiAgICAgICAgICBpZiAoZGlhZ25vc3RpYy5jYXRlZ29yeSA9PT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKSB7XG4gICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2gobWVzc2FnZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZpbGVFbWl0dGVyID0gY3JlYXRlRmlsZUVtaXR0ZXIoXG4gICAgICAgICAgYnVpbGRlcixcbiAgICAgICAgICBtZXJnZVRyYW5zZm9ybWVycyhhbmd1bGFyQ29tcGlsZXIucHJlcGFyZUVtaXQoKS50cmFuc2Zvcm1lcnMsIHtcbiAgICAgICAgICAgIGJlZm9yZTogW3JlcGxhY2VCb290c3RyYXAoKCkgPT4gYnVpbGRlci5nZXRQcm9ncmFtKCkuZ2V0VHlwZUNoZWNrZXIoKSldLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIChzb3VyY2VGaWxlKSA9PiBhbmd1bGFyQ29tcGlsZXIuaW5jcmVtZW50YWxEcml2ZXIucmVjb3JkU3VjY2Vzc2Z1bEVtaXQoc291cmNlRmlsZSksXG4gICAgICAgICk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkxvYWQoXG4gICAgICAgIHsgZmlsdGVyOiBjb21waWxlck9wdGlvbnMuYWxsb3dKcyA/IC9cXC5bY21dP1tqdF1zeD8kLyA6IC9cXC5bY21dP3RzeD8kLyB9LFxuICAgICAgICBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAgIGFzc2VydC5vayhmaWxlRW1pdHRlciwgJ0ludmFsaWQgcGx1Z2luIGV4ZWN1dGlvbiBvcmRlcicpO1xuXG4gICAgICAgICAgY29uc3QgdHlwZXNjcmlwdFJlc3VsdCA9IGF3YWl0IGZpbGVFbWl0dGVyKFxuICAgICAgICAgICAgcGx1Z2luT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzPy5bYXJncy5wYXRoXSA/PyBhcmdzLnBhdGgsXG4gICAgICAgICAgKTtcbiAgICAgICAgICBpZiAoIXR5cGVzY3JpcHRSZXN1bHQpIHtcbiAgICAgICAgICAgIC8vIE5vIFRTIHJlc3VsdCBpbmRpY2F0ZXMgdGhlIGZpbGUgaXMgbm90IHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvZ3JhbS5cbiAgICAgICAgICAgIC8vIElmIGFsbG93SnMgaXMgZW5hYmxlZCBhbmQgdGhlIGZpbGUgaXMgSlMgdGhlbiBkZWZlciB0byB0aGUgbmV4dCBsb2FkIGhvb2suXG4gICAgICAgICAgICBpZiAoY29tcGlsZXJPcHRpb25zLmFsbG93SnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KGFyZ3MucGF0aCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gT3RoZXJ3aXNlIHJldHVybiBhbiBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgdGV4dDogYEZpbGUgJyR7YXJncy5wYXRofScgaXMgbWlzc2luZyBmcm9tIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uLmAsXG4gICAgICAgICAgICAgICAgICBub3RlczogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgdGV4dDogYEVuc3VyZSB0aGUgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0gdmlhIHRoZSAnZmlsZXMnIG9yICdpbmNsdWRlJyBwcm9wZXJ0eS5gLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29udGVudHM6IGF3YWl0IHRyYW5zZm9ybVdpdGhCYWJlbENhY2hlZChcbiAgICAgICAgICAgICAgYXJncy5wYXRoLFxuICAgICAgICAgICAgICB0eXBlc2NyaXB0UmVzdWx0LmNvbnRlbnQgPz8gJycsXG4gICAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMsXG4gICAgICAgICAgICAgIGJhYmVsTWVtb3J5Q2FjaGUsXG4gICAgICAgICAgICApLFxuICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICApO1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5bY21dP2pzJC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGZzLnJlYWRGaWxlKGFyZ3MucGF0aCwgJ3V0Zi04Jyk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50czogYXdhaXQgdHJhbnNmb3JtV2l0aEJhYmVsQ2FjaGVkKFxuICAgICAgICAgICAgYXJncy5wYXRoLFxuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMsXG4gICAgICAgICAgICBiYWJlbE1lbW9yeUNhY2hlLFxuICAgICAgICAgICksXG4gICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICB9O1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uRW5kKChyZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLmxlbmd0aCkge1xuICAgICAgICAgIHJlc3VsdC5vdXRwdXRGaWxlcz8ucHVzaCguLi5zdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUZpbGVFbWl0dGVyKFxuICBwcm9ncmFtOiB0cy5CdWlsZGVyUHJvZ3JhbSxcbiAgdHJhbnNmb3JtZXJzOiB0cy5DdXN0b21UcmFuc2Zvcm1lcnMgPSB7fSxcbiAgb25BZnRlckVtaXQ/OiAoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSkgPT4gdm9pZCxcbik6IEZpbGVFbWl0dGVyIHtcbiAgcmV0dXJuIGFzeW5jIChmaWxlOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBzb3VyY2VGaWxlID0gcHJvZ3JhbS5nZXRTb3VyY2VGaWxlKGZpbGUpO1xuICAgIGlmICghc291cmNlRmlsZSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBsZXQgY29udGVudDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIHByb2dyYW0uZW1pdChcbiAgICAgIHNvdXJjZUZpbGUsXG4gICAgICAoZmlsZW5hbWUsIGRhdGEpID0+IHtcbiAgICAgICAgaWYgKC9cXC5bY21dP2pzJC8udGVzdChmaWxlbmFtZSkpIHtcbiAgICAgICAgICBjb250ZW50ID0gZGF0YTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHVuZGVmaW5lZCAvKiBjYW5jZWxsYXRpb25Ub2tlbiAqLyxcbiAgICAgIHVuZGVmaW5lZCAvKiBlbWl0T25seUR0c0ZpbGVzICovLFxuICAgICAgdHJhbnNmb3JtZXJzLFxuICAgICk7XG5cbiAgICBvbkFmdGVyRW1pdD8uKHNvdXJjZUZpbGUpO1xuXG4gICAgcmV0dXJuIHsgY29udGVudCwgZGVwZW5kZW5jaWVzOiBbXSB9O1xuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiB0cmFuc2Zvcm1XaXRoQmFiZWwoXG4gIGZpbGVuYW1lOiBzdHJpbmcsXG4gIGRhdGE6IHN0cmluZyxcbiAgcGx1Z2luT3B0aW9uczogQ29tcGlsZXJQbHVnaW5PcHRpb25zLFxuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgY29uc3QgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uID1cbiAgICAhL1tcXFxcL11bX2ZdP2VzbTIwMTVbXFxcXC9dLy50ZXN0KGZpbGVuYW1lKSAmJiAvYXN5bmNcXHMrZnVuY3Rpb25cXHMqXFwqLy50ZXN0KGRhdGEpO1xuICBjb25zdCBzaG91bGRMaW5rID0gYXdhaXQgcmVxdWlyZXNMaW5raW5nKGZpbGVuYW1lLCBkYXRhKTtcbiAgY29uc3QgdXNlSW5wdXRTb3VyY2VtYXAgPVxuICAgIHBsdWdpbk9wdGlvbnMuc291cmNlbWFwICYmXG4gICAgKCEhcGx1Z2luT3B0aW9ucy50aGlyZFBhcnR5U291cmNlbWFwcyB8fCAhL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLy50ZXN0KGZpbGVuYW1lKSk7XG5cbiAgLy8gSWYgbm8gYWRkaXRpb25hbCB0cmFuc2Zvcm1hdGlvbnMgYXJlIG5lZWRlZCwgcmV0dXJuIHRoZSBkYXRhIGRpcmVjdGx5XG4gIGlmICghZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uICYmICFwbHVnaW5PcHRpb25zLmFkdmFuY2VkT3B0aW1pemF0aW9ucyAmJiAhc2hvdWxkTGluaykge1xuICAgIC8vIFN0cmlwIHNvdXJjZW1hcHMgaWYgdGhleSBzaG91bGQgbm90IGJlIHVzZWRcbiAgICByZXR1cm4gdXNlSW5wdXRTb3VyY2VtYXAgPyBkYXRhIDogZGF0YS5yZXBsYWNlKC9eXFwvXFwvIyBzb3VyY2VNYXBwaW5nVVJMPVteXFxyXFxuXSovZ20sICcnKTtcbiAgfVxuXG4gIGNvbnN0IGFuZ3VsYXJQYWNrYWdlID0gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dQGFuZ3VsYXJbXFxcXC9dLy50ZXN0KGZpbGVuYW1lKTtcblxuICBjb25zdCBsaW5rZXJQbHVnaW5DcmVhdG9yID0gc2hvdWxkTGlua1xuICAgID8gKFxuICAgICAgICBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKT4oXG4gICAgICAgICAgJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnLFxuICAgICAgICApXG4gICAgICApLmNyZWF0ZUVzMjAxNUxpbmtlclBsdWdpblxuICAgIDogdW5kZWZpbmVkO1xuXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRyYW5zZm9ybUFzeW5jKGRhdGEsIHtcbiAgICBmaWxlbmFtZSxcbiAgICBpbnB1dFNvdXJjZU1hcDogKHVzZUlucHV0U291cmNlbWFwID8gdW5kZWZpbmVkIDogZmFsc2UpIGFzIHVuZGVmaW5lZCxcbiAgICBzb3VyY2VNYXBzOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCA/ICdpbmxpbmUnIDogZmFsc2UsXG4gICAgY29tcGFjdDogZmFsc2UsXG4gICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgYmFiZWxyYzogZmFsc2UsXG4gICAgYnJvd3NlcnNsaXN0Q29uZmlnRmlsZTogZmFsc2UsXG4gICAgcGx1Z2luczogW10sXG4gICAgcHJlc2V0czogW1xuICAgICAgW1xuICAgICAgICBhbmd1bGFyQXBwbGljYXRpb25QcmVzZXQsXG4gICAgICAgIHtcbiAgICAgICAgICBhbmd1bGFyTGlua2VyOiB7XG4gICAgICAgICAgICBzaG91bGRMaW5rLFxuICAgICAgICAgICAgaml0TW9kZTogZmFsc2UsXG4gICAgICAgICAgICBsaW5rZXJQbHVnaW5DcmVhdG9yLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uLFxuICAgICAgICAgIG9wdGltaXplOiBwbHVnaW5PcHRpb25zLmFkdmFuY2VkT3B0aW1pemF0aW9ucyAmJiB7XG4gICAgICAgICAgICBsb29zZUVudW1zOiBhbmd1bGFyUGFja2FnZSxcbiAgICAgICAgICAgIHB1cmVUb3BMZXZlbDogYW5ndWxhclBhY2thZ2UsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgXSxcbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdD8uY29kZSA/PyBkYXRhO1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybXMgSmF2YVNjcmlwdCBmaWxlIGRhdGEgdXNpbmcgdGhlIGJhYmVsIHRyYW5zZm9ybXMgc2V0dXAgaW4gdHJhbnNmb3JtV2l0aEJhYmVsLiBUaGVcbiAqIHN1cHBsaWVkIGNhY2hlIHdpbGwgYmUgdXNlZCB0byBhdm9pZCByZXBlYXRpbmcgdGhlIHRyYW5zZm9ybXMgZm9yIGRhdGEgdGhhdCBoYXMgcHJldmlvdXNseVxuICogYmVlbiB0cmFuc2Zvcm1lZCBzdWNoIGFzIGluIGEgcHJldmlvdXMgcmVidWlsZCBjeWNsZS5cbiAqIEBwYXJhbSBmaWxlbmFtZSBUaGUgZmlsZSBwYXRoIG9mIHRoZSBkYXRhIHRvIGJlIHRyYW5zZm9ybWVkLlxuICogQHBhcmFtIGRhdGEgVGhlIGZpbGUgZGF0YSB0aGF0IHdpbGwgYmUgdHJhbnNmb3JtZWQuXG4gKiBAcGFyYW0gcGx1Z2luT3B0aW9ucyBDb21waWxlciBwbHVnaW4gb3B0aW9ucyB0aGF0IHdpbGwgYmUgdXNlZCB0byBjb250cm9sIHRoZSB0cmFuc2Zvcm1hdGlvbi5cbiAqIEBwYXJhbSBjYWNoZSBBIGNhY2hlIG9mIHByZXZpb3VzbHkgdHJhbnNmb3JtZWQgZGF0YSB0aGF0IHdpbGwgYmUgdXNlZCB0byBhdm9pZCByZXBlYXQgdHJhbnNmb3Jtcy5cbiAqIEByZXR1cm5zIEEgcHJvbWlzZSBjb250YWluaW5nIHRoZSB0cmFuc2Zvcm1lZCBkYXRhLlxuICovXG5hc3luYyBmdW5jdGlvbiB0cmFuc2Zvcm1XaXRoQmFiZWxDYWNoZWQoXG4gIGZpbGVuYW1lOiBzdHJpbmcsXG4gIGRhdGE6IHN0cmluZyxcbiAgcGx1Z2luT3B0aW9uczogQ29tcGlsZXJQbHVnaW5PcHRpb25zLFxuICBjYWNoZTogTWFwPHN0cmluZywgc3RyaW5nPixcbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIC8vIFRoZSBwcmUtdHJhbnNmb3JtZWQgZGF0YSBpcyB1c2VkIGFzIGEgY2FjaGUga2V5LiBTaW5jZSB0aGUgY2FjaGUgaXMgbWVtb3J5IG9ubHksXG4gIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAvLyBjYWNoZSBpcyBsYXRlciBzdG9yZWQgdG8gZGlzaywgdGhlbiB0aGUgb3B0aW9ucyB0aGF0IGFmZmVjdCB0cmFuc2Zvcm0gb3V0cHV0XG4gIC8vIHdvdWxkIG5lZWQgdG8gYmUgYWRkZWQgdG8gdGhlIGtleSBhcyB3ZWxsLlxuICBsZXQgcmVzdWx0ID0gY2FjaGUuZ2V0KGRhdGEpO1xuICBpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICByZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1XaXRoQmFiZWwoZmlsZW5hbWUsIGRhdGEsIHBsdWdpbk9wdGlvbnMpO1xuICAgIGNhY2hlLnNldChkYXRhLCByZXN1bHQpO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdfQ==