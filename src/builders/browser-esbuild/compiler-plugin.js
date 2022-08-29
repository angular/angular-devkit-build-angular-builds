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
exports.createCompilerPlugin = void 0;
const core_1 = require("@babel/core");
const assert = __importStar(require("assert"));
const fs_1 = require("fs");
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
 * @param diagnostic The TypeScript diagnostic relative information to convert.
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
// This is a non-watch version of the compiler code from `@ngtools/webpack` augmented for esbuild
// eslint-disable-next-line max-lines-per-function
function createCompilerPlugin(pluginOptions, styleOptions) {
    return {
        name: 'angular-compiler',
        // eslint-disable-next-line max-lines-per-function
        async setup(build) {
            var _a;
            var _b;
            // This uses a wrapped dynamic import to load `@angular/compiler-cli` which is ESM.
            // Once TypeScript provides support for retaining dynamic imports this workaround can be dropped.
            const compilerCli = await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli');
            // Temporary deep import for transformer support
            const { mergeTransformers, replaceBootstrap, } = require('@ngtools/webpack/src/ivy/transformation');
            // Setup defines based on the values provided by the Angular compiler-cli
            (_a = (_b = build.initialOptions).define) !== null && _a !== void 0 ? _a : (_b.define = {});
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
                enableIvy: true,
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
            // Adjust the esbuild output target based on the tsconfig target
            if (compilerOptions.target === undefined ||
                compilerOptions.target <= typescript_1.default.ScriptTarget.ES2015) {
                build.initialOptions.target = 'es2015';
            }
            else if (compilerOptions.target >= typescript_1.default.ScriptTarget.ESNext) {
                build.initialOptions.target = 'esnext';
            }
            else {
                build.initialOptions.target = typescript_1.default.ScriptTarget[compilerOptions.target].toLowerCase();
            }
            // The file emitter created during `onStart` that will be used during the build in `onLoad` callbacks for TS files
            let fileEmitter;
            // The stylesheet resources from component stylesheets that will be added to the build results output files
            let stylesheetResourceFiles;
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
                // Create the Angular specific program that contains the Angular compiler
                const angularProgram = new compilerCli.NgtscProgram(rootNames, compilerOptions, host);
                const angularCompiler = angularProgram.compiler;
                const { ignoreForDiagnostics } = angularCompiler;
                const typeScriptProgram = angularProgram.getTsProgram();
                const builder = typescript_1.default.createAbstractBuilder(typeScriptProgram, host);
                await angularCompiler.analyzeAsync();
                function* collectDiagnostics() {
                    // Collect program level diagnostics
                    yield* configurationDiagnostics;
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
                }), () => []);
                return result;
            });
            build.onLoad({ filter: compilerOptions.allowJs ? /\.[cm]?[jt]sx?$/ : /\.[cm]?tsx?$/ }, async (args) => {
                var _a, _b;
                assert.ok(fileEmitter, 'Invalid plugin execution order');
                const typescriptResult = await fileEmitter(args.path);
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
                                text: 'File is missing from the TypeScript compilation.',
                                location: { file: args.path },
                                notes: [
                                    {
                                        text: `Ensure the file is part of the TypeScript program via the 'files' or 'include' property.`,
                                    },
                                ],
                            },
                        ],
                    };
                }
                const data = (_a = typescriptResult.content) !== null && _a !== void 0 ? _a : '';
                const forceAsyncTransformation = /for\s+await\s*\(|async\s+function\s*\*/.test(data);
                const useInputSourcemap = pluginOptions.sourcemap &&
                    (!!pluginOptions.thirdPartySourcemaps || !/[\\/]node_modules[\\/]/.test(args.path));
                // If no additional transformations are needed, return the TypeScript output directly
                if (!forceAsyncTransformation && !pluginOptions.advancedOptimizations) {
                    return {
                        // Strip sourcemaps if they should not be used
                        contents: useInputSourcemap
                            ? data
                            : data.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, ''),
                        loader: 'js',
                    };
                }
                const babelResult = await (0, core_1.transformAsync)(data, {
                    filename: args.path,
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
                                forceAsyncTransformation,
                                optimize: pluginOptions.advancedOptimizations && {},
                            },
                        ],
                    ],
                });
                return {
                    contents: (_b = babelResult === null || babelResult === void 0 ? void 0 : babelResult.code) !== null && _b !== void 0 ? _b : '',
                    loader: 'js',
                };
            });
            build.onLoad({ filter: /\.[cm]?js$/ }, async (args) => {
                var _a;
                const data = await fs_1.promises.readFile(args.path, 'utf-8');
                const forceAsyncTransformation = !/[\\/][_f]?esm2015[\\/]/.test(args.path) &&
                    /for\s+await\s*\(|async\s+function\s*\*/.test(data);
                const shouldLink = await (0, webpack_loader_1.requiresLinking)(args.path, data);
                const useInputSourcemap = pluginOptions.sourcemap &&
                    (!!pluginOptions.thirdPartySourcemaps || !/[\\/]node_modules[\\/]/.test(args.path));
                // If no additional transformations are needed, return the TypeScript output directly
                if (!forceAsyncTransformation && !pluginOptions.advancedOptimizations && !shouldLink) {
                    return {
                        // Strip sourcemaps if they should not be used
                        contents: useInputSourcemap
                            ? data
                            : data.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, ''),
                        loader: 'js',
                    };
                }
                const angularPackage = /[\\/]node_modules[\\/]@angular[\\/]/.test(args.path);
                const linkerPluginCreator = (await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli/linker/babel')).createEs2015LinkerPlugin;
                const result = await (0, core_1.transformAsync)(data, {
                    filename: args.path,
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
                return {
                    contents: (_a = result === null || result === void 0 ? void 0 : result.code) !== null && _a !== void 0 ? _a : data,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILHNDQUE2QztBQUM3QywrQ0FBaUM7QUFTakMsMkJBQW9DO0FBQ3BDLDJDQUE2QjtBQUM3Qiw0REFBNEI7QUFDNUIsa0ZBQXVFO0FBQ3ZFLCtEQUE2RDtBQUM3RCxtREFBcUQ7QUFDckQsK0NBQW9HO0FBVXBHOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLCtCQUErQixDQUN0QyxJQUFxQyxFQUNyQyxJQUE4QixFQUM5QixVQUFtQjtJQUVuQixJQUFJLElBQUksR0FBRyxvQkFBRSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDaEYsSUFBSSxVQUFVLEVBQUU7UUFDZCxJQUFJLEdBQUcsVUFBVSxHQUFHLElBQUksQ0FBQztLQUMxQjtJQUVELE1BQU0sSUFBSSxHQUFnQixFQUFFLElBQUksRUFBRSxDQUFDO0lBRW5DLElBQUksSUFBSSxDQUFDLElBQUksRUFBRTtRQUNiLElBQUksQ0FBQyxRQUFRLEdBQUc7WUFDZCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRO1lBQ3hCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtTQUNwQixDQUFDO1FBRUYsNEZBQTRGO1FBQzVGLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNkLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEdBQUcsb0JBQUUsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElB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QzVCLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNmLE9BQU8sU0FBUyxDQUFDO1NBQ2xCO1FBRUQsSUFBSSxPQUEyQixDQUFDO1FBQ2hDLE9BQU8sQ0FBQyxJQUFJLENBQ1YsVUFBVSxFQUNWLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxFQUFFO1lBQ2pCLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDL0IsT0FBTyxHQUFHLElBQUksQ0FBQzthQUNoQjtRQUNILENBQUMsRUFDRCxTQUFTLENBQUMsdUJBQXVCLEVBQ2pDLFNBQVMsQ0FBQyxzQkFBc0IsRUFDaEMsWUFBWSxDQUNiLENBQUM7UUFFRixXQUFXLGFBQVgsV0FBVyx1QkFBWCxXQUFXLENBQUcsVUFBVSxDQUFDLENBQUM7UUFFMUIsT0FBTyxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsRUFBRSxFQUFFLENBQUM7SUFDdkMsQ0FBQyxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IENvbXBpbGVySG9zdCB9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQgeyB0cmFuc2Zvcm1Bc3luYyB9IGZyb20gJ0BiYWJlbC9jb3JlJztcbmltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHR5cGUge1xuICBPblN0YXJ0UmVzdWx0LFxuICBPdXRwdXRGaWxlLFxuICBQYXJ0aWFsTWVzc2FnZSxcbiAgUGFydGlhbE5vdGUsXG4gIFBsdWdpbixcbiAgUGx1Z2luQnVpbGQsXG59IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgcHJvbWlzZXMgYXMgZnMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IGFuZ3VsYXJBcHBsaWNhdGlvblByZXNldCBmcm9tICcuLi8uLi9iYWJlbC9wcmVzZXRzL2FwcGxpY2F0aW9uJztcbmltcG9ydCB7IHJlcXVpcmVzTGlua2luZyB9IGZyb20gJy4uLy4uL2JhYmVsL3dlYnBhY2stbG9hZGVyJztcbmltcG9ydCB7IGxvYWRFc21Nb2R1bGUgfSBmcm9tICcuLi8uLi91dGlscy9sb2FkLWVzbSc7XG5pbXBvcnQgeyBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucywgYnVuZGxlU3R5bGVzaGVldEZpbGUsIGJ1bmRsZVN0eWxlc2hlZXRUZXh0IH0gZnJvbSAnLi9zdHlsZXNoZWV0cyc7XG5cbmludGVyZmFjZSBFbWl0RmlsZVJlc3VsdCB7XG4gIGNvbnRlbnQ/OiBzdHJpbmc7XG4gIG1hcD86IHN0cmluZztcbiAgZGVwZW5kZW5jaWVzOiByZWFkb25seSBzdHJpbmdbXTtcbiAgaGFzaD86IFVpbnQ4QXJyYXk7XG59XG50eXBlIEZpbGVFbWl0dGVyID0gKGZpbGU6IHN0cmluZykgPT4gUHJvbWlzZTxFbWl0RmlsZVJlc3VsdCB8IHVuZGVmaW5lZD47XG5cbi8qKlxuICogQ29udmVydHMgVHlwZVNjcmlwdCBEaWFnbm9zdGljIHJlbGF0ZWQgaW5mb3JtYXRpb24gaW50byBhbiBlc2J1aWxkIGNvbXBhdGlibGUgbm90ZSBvYmplY3QuXG4gKiBSZWxhdGVkIGluZm9ybWF0aW9uIGlzIGEgc3Vic2V0IG9mIGEgZnVsbCBUeXBlU2NyaXB0IERpYWdub3N0aWMgYW5kIGFsc28gdXNlZCBmb3IgZGlhZ25vc3RpY1xuICogbm90ZXMgYXNzb2NpYXRlZCB3aXRoIHRoZSBtYWluIERpYWdub3N0aWMuXG4gKiBAcGFyYW0gZGlhZ25vc3RpYyBUaGUgVHlwZVNjcmlwdCBkaWFnbm9zdGljIHJlbGF0aXZlIGluZm9ybWF0aW9uIHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0gaG9zdCBBIFR5cGVTY3JpcHQgRm9ybWF0RGlhZ25vc3RpY3NIb3N0IGluc3RhbmNlIHRvIHVzZSBkdXJpbmcgY29udmVyc2lvbi5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgZGlhZ25vc3RpYyBtZXNzYWdlIGFzIGEgUGFydGlhbE1lc3NhZ2Ugb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oXG4gIGluZm86IHRzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24sXG4gIGhvc3Q6IHRzLkZvcm1hdERpYWdub3N0aWNzSG9zdCxcbiAgdGV4dFByZWZpeD86IHN0cmluZyxcbik6IFBhcnRpYWxOb3RlIHtcbiAgbGV0IHRleHQgPSB0cy5mbGF0dGVuRGlhZ25vc3RpY01lc3NhZ2VUZXh0KGluZm8ubWVzc2FnZVRleHQsIGhvc3QuZ2V0TmV3TGluZSgpKTtcbiAgaWYgKHRleHRQcmVmaXgpIHtcbiAgICB0ZXh0ID0gdGV4dFByZWZpeCArIHRleHQ7XG4gIH1cblxuICBjb25zdCBub3RlOiBQYXJ0aWFsTm90ZSA9IHsgdGV4dCB9O1xuXG4gIGlmIChpbmZvLmZpbGUpIHtcbiAgICBub3RlLmxvY2F0aW9uID0ge1xuICAgICAgZmlsZTogaW5mby5maWxlLmZpbGVOYW1lLFxuICAgICAgbGVuZ3RoOiBpbmZvLmxlbmd0aCxcbiAgICB9O1xuXG4gICAgLy8gQ2FsY3VsYXRlIHRoZSBsaW5lL2NvbHVtbiBsb2NhdGlvbiBhbmQgZXh0cmFjdCB0aGUgZnVsbCBsaW5lIHRleHQgdGhhdCBoYXMgdGhlIGRpYWdub3N0aWNcbiAgICBpZiAoaW5mby5zdGFydCkge1xuICAgICAgY29uc3QgeyBsaW5lLCBjaGFyYWN0ZXIgfSA9IHRzLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKGluZm8uZmlsZSwgaW5mby5zdGFydCk7XG4gICAgICBub3RlLmxvY2F0aW9uLmxpbmUgPSBsaW5lICsgMTtcbiAgICAgIG5vdGUubG9jYXRpb24uY29sdW1uID0gY2hhcmFjdGVyO1xuXG4gICAgICAvLyBUaGUgc3RhcnQgcG9zaXRpb24gZm9yIHRoZSBzbGljZSBpcyB0aGUgZmlyc3QgY2hhcmFjdGVyIG9mIHRoZSBlcnJvciBsaW5lXG4gICAgICBjb25zdCBsaW5lU3RhcnRQb3NpdGlvbiA9IHRzLmdldFBvc2l0aW9uT2ZMaW5lQW5kQ2hhcmFjdGVyKGluZm8uZmlsZSwgbGluZSwgMCk7XG5cbiAgICAgIC8vIFRoZSBlbmQgcG9zaXRpb24gZm9yIHRoZSBzbGljZSBpcyB0aGUgZmlyc3QgY2hhcmFjdGVyIG9mIHRoZSBuZXh0IGxpbmUgb3IgdGhlIGxlbmd0aCBvZlxuICAgICAgLy8gdGhlIGVudGlyZSBmaWxlIGlmIHRoZSBsaW5lIGlzIHRoZSBsYXN0IGxpbmUgb2YgdGhlIGZpbGUgKGdldFBvc2l0aW9uT2ZMaW5lQW5kQ2hhcmFjdGVyXG4gICAgICAvLyB3aWxsIGVycm9yIGlmIGEgbm9uZXhpc3RlbnQgbGluZSBpcyBwYXNzZWQpLlxuICAgICAgY29uc3QgeyBsaW5lOiBsYXN0TGluZU9mRmlsZSB9ID0gdHMuZ2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24oXG4gICAgICAgIGluZm8uZmlsZSxcbiAgICAgICAgaW5mby5maWxlLnRleHQubGVuZ3RoIC0gMSxcbiAgICAgICk7XG4gICAgICBjb25zdCBsaW5lRW5kUG9zaXRpb24gPVxuICAgICAgICBsaW5lIDwgbGFzdExpbmVPZkZpbGVcbiAgICAgICAgICA/IHRzLmdldFBvc2l0aW9uT2ZMaW5lQW5kQ2hhcmFjdGVyKGluZm8uZmlsZSwgbGluZSArIDEsIDApXG4gICAgICAgICAgOiBpbmZvLmZpbGUudGV4dC5sZW5ndGg7XG5cbiAgICAgIG5vdGUubG9jYXRpb24ubGluZVRleHQgPSBpbmZvLmZpbGUudGV4dC5zbGljZShsaW5lU3RhcnRQb3NpdGlvbiwgbGluZUVuZFBvc2l0aW9uKS50cmltRW5kKCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5vdGU7XG59XG5cbi8qKlxuICogQ29udmVydHMgYSBUeXBlU2NyaXB0IERpYWdub3N0aWMgbWVzc2FnZSBpbnRvIGFuIGVzYnVpbGQgY29tcGF0aWJsZSBtZXNzYWdlIG9iamVjdC5cbiAqIEBwYXJhbSBkaWFnbm9zdGljIFRoZSBUeXBlU2NyaXB0IGRpYWdub3N0aWMgdG8gY29udmVydC5cbiAqIEBwYXJhbSBob3N0IEEgVHlwZVNjcmlwdCBGb3JtYXREaWFnbm9zdGljc0hvc3QgaW5zdGFuY2UgdG8gdXNlIGR1cmluZyBjb252ZXJzaW9uLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBkaWFnbm9zdGljIG1lc3NhZ2UgYXMgYSBQYXJ0aWFsTWVzc2FnZSBvYmplY3RcbiAqL1xuZnVuY3Rpb24gY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljKFxuICBkaWFnbm9zdGljOiB0cy5EaWFnbm9zdGljLFxuICBob3N0OiB0cy5Gb3JtYXREaWFnbm9zdGljc0hvc3QsXG4pOiBQYXJ0aWFsTWVzc2FnZSB7XG4gIGxldCBjb2RlUHJlZml4ID0gJ1RTJztcbiAgbGV0IGNvZGUgPSBgJHtkaWFnbm9zdGljLmNvZGV9YDtcbiAgaWYgKGRpYWdub3N0aWMuc291cmNlID09PSAnbmd0c2MnKSB7XG4gICAgY29kZVByZWZpeCA9ICdORyc7XG4gICAgLy8gUmVtb3ZlIGAtOTlgIEFuZ3VsYXIgcHJlZml4IGZyb20gZGlhZ25vc3RpYyBjb2RlXG4gICAgY29kZSA9IGNvZGUuc2xpY2UoMyk7XG4gIH1cblxuICBjb25zdCBtZXNzYWdlOiBQYXJ0aWFsTWVzc2FnZSA9IHtcbiAgICAuLi5jb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWNJbmZvKGRpYWdub3N0aWMsIGhvc3QsIGAke2NvZGVQcmVmaXh9JHtjb2RlfTogYCksXG4gICAgLy8gU3RvcmUgb3JpZ2luYWwgZGlhZ25vc3RpYyBmb3IgcmVmZXJlbmNlIGlmIG5lZWRlZCBkb3duc3RyZWFtXG4gICAgZGV0YWlsOiBkaWFnbm9zdGljLFxuICB9O1xuXG4gIGlmIChkaWFnbm9zdGljLnJlbGF0ZWRJbmZvcm1hdGlvbj8ubGVuZ3RoKSB7XG4gICAgbWVzc2FnZS5ub3RlcyA9IGRpYWdub3N0aWMucmVsYXRlZEluZm9ybWF0aW9uLm1hcCgoaW5mbykgPT5cbiAgICAgIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oaW5mbywgaG9zdCksXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBtZXNzYWdlO1xufVxuXG4vLyBUaGlzIGlzIGEgbm9uLXdhdGNoIHZlcnNpb24gb2YgdGhlIGNvbXBpbGVyIGNvZGUgZnJvbSBgQG5ndG9vbHMvd2VicGFja2AgYXVnbWVudGVkIGZvciBlc2J1aWxkXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICBwbHVnaW5PcHRpb25zOiB7XG4gICAgc291cmNlbWFwOiBib29sZWFuO1xuICAgIHRzY29uZmlnOiBzdHJpbmc7XG4gICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zPzogYm9vbGVhbjtcbiAgICB0aGlyZFBhcnR5U291cmNlbWFwcz86IGJvb2xlYW47XG4gIH0sXG4gIHN0eWxlT3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsXG4pOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLWNvbXBpbGVyJyxcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuICAgIGFzeW5jIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgLy8gVGhpcyB1c2VzIGEgd3JhcHBlZCBkeW5hbWljIGltcG9ydCB0byBsb2FkIGBAYW5ndWxhci9jb21waWxlci1jbGlgIHdoaWNoIGlzIEVTTS5cbiAgICAgIC8vIE9uY2UgVHlwZVNjcmlwdCBwcm92aWRlcyBzdXBwb3J0IGZvciByZXRhaW5pbmcgZHluYW1pYyBpbXBvcnRzIHRoaXMgd29ya2Fyb3VuZCBjYW4gYmUgZHJvcHBlZC5cbiAgICAgIGNvbnN0IGNvbXBpbGVyQ2xpID0gYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21waWxlci1jbGknKT4oXG4gICAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGknLFxuICAgICAgKTtcblxuICAgICAgLy8gVGVtcG9yYXJ5IGRlZXAgaW1wb3J0IGZvciB0cmFuc2Zvcm1lciBzdXBwb3J0XG4gICAgICBjb25zdCB7XG4gICAgICAgIG1lcmdlVHJhbnNmb3JtZXJzLFxuICAgICAgICByZXBsYWNlQm9vdHN0cmFwLFxuICAgICAgfSA9IHJlcXVpcmUoJ0BuZ3Rvb2xzL3dlYnBhY2svc3JjL2l2eS90cmFuc2Zvcm1hdGlvbicpO1xuXG4gICAgICAvLyBTZXR1cCBkZWZpbmVzIGJhc2VkIG9uIHRoZSB2YWx1ZXMgcHJvdmlkZWQgYnkgdGhlIEFuZ3VsYXIgY29tcGlsZXItY2xpXG4gICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUgPz89IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29tcGlsZXJDbGkuR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCkpIHtcbiAgICAgICAgaWYgKGtleSBpbiBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUpIHtcbiAgICAgICAgICAvLyBTa2lwIGtleXMgdGhhdCBoYXZlIGJlZW4gbWFudWFsbHkgcHJvdmlkZWRcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBlc2J1aWxkIHJlcXVpcmVzIHZhbHVlcyB0byBiZSBhIHN0cmluZyAoYWN0dWFsIHN0cmluZ3MgbmVlZCB0byBiZSBxdW90ZWQpLlxuICAgICAgICAvLyBJbiB0aGlzIGNhc2UsIGFsbCBwcm92aWRlZCB2YWx1ZXMgYXJlIGJvb2xlYW5zLlxuICAgICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmVba2V5XSA9IHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSB0c2NvbmZpZyBpcyBsb2FkZWQgaW4gc2V0dXAgaW5zdGVhZCBvZiBpbiBzdGFydCB0byBhbGxvdyB0aGUgZXNidWlsZCB0YXJnZXQgYnVpbGQgb3B0aW9uIHRvIGJlIG1vZGlmaWVkLlxuICAgICAgLy8gZXNidWlsZCBidWlsZCBvcHRpb25zIGNhbiBvbmx5IGJlIG1vZGlmaWVkIGluIHNldHVwIHByaW9yIHRvIHN0YXJ0aW5nIHRoZSBidWlsZC5cbiAgICAgIGNvbnN0IHtcbiAgICAgICAgb3B0aW9uczogY29tcGlsZXJPcHRpb25zLFxuICAgICAgICByb290TmFtZXMsXG4gICAgICAgIGVycm9yczogY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgICAgfSA9IGNvbXBpbGVyQ2xpLnJlYWRDb25maWd1cmF0aW9uKHBsdWdpbk9wdGlvbnMudHNjb25maWcsIHtcbiAgICAgICAgZW5hYmxlSXZ5OiB0cnVlLFxuICAgICAgICBub0VtaXRPbkVycm9yOiBmYWxzZSxcbiAgICAgICAgc3VwcHJlc3NPdXRwdXRQYXRoQ2hlY2s6IHRydWUsXG4gICAgICAgIG91dERpcjogdW5kZWZpbmVkLFxuICAgICAgICBpbmxpbmVTb3VyY2VzOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgaW5saW5lU291cmNlTWFwOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcbiAgICAgICAgbWFwUm9vdDogdW5kZWZpbmVkLFxuICAgICAgICBzb3VyY2VSb290OiB1bmRlZmluZWQsXG4gICAgICAgIGRlY2xhcmF0aW9uOiBmYWxzZSxcbiAgICAgICAgZGVjbGFyYXRpb25NYXA6IGZhbHNlLFxuICAgICAgICBhbGxvd0VtcHR5Q29kZWdlbkZpbGVzOiBmYWxzZSxcbiAgICAgICAgYW5ub3RhdGlvbnNBczogJ2RlY29yYXRvcnMnLFxuICAgICAgICBlbmFibGVSZXNvdXJjZUlubGluaW5nOiBmYWxzZSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBBZGp1c3QgdGhlIGVzYnVpbGQgb3V0cHV0IHRhcmdldCBiYXNlZCBvbiB0aGUgdHNjb25maWcgdGFyZ2V0XG4gICAgICBpZiAoXG4gICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICBjb21waWxlck9wdGlvbnMudGFyZ2V0IDw9IHRzLlNjcmlwdFRhcmdldC5FUzIwMTVcbiAgICAgICkge1xuICAgICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy50YXJnZXQgPSAnZXMyMDE1JztcbiAgICAgIH0gZWxzZSBpZiAoY29tcGlsZXJPcHRpb25zLnRhcmdldCA+PSB0cy5TY3JpcHRUYXJnZXQuRVNOZXh0KSB7XG4gICAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLnRhcmdldCA9ICdlc25leHQnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMudGFyZ2V0ID0gdHMuU2NyaXB0VGFyZ2V0W2NvbXBpbGVyT3B0aW9ucy50YXJnZXRdLnRvTG93ZXJDYXNlKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSBmaWxlIGVtaXR0ZXIgY3JlYXRlZCBkdXJpbmcgYG9uU3RhcnRgIHRoYXQgd2lsbCBiZSB1c2VkIGR1cmluZyB0aGUgYnVpbGQgaW4gYG9uTG9hZGAgY2FsbGJhY2tzIGZvciBUUyBmaWxlc1xuICAgICAgbGV0IGZpbGVFbWl0dGVyOiBGaWxlRW1pdHRlciB8IHVuZGVmaW5lZDtcblxuICAgICAgLy8gVGhlIHN0eWxlc2hlZXQgcmVzb3VyY2VzIGZyb20gY29tcG9uZW50IHN0eWxlc2hlZXRzIHRoYXQgd2lsbCBiZSBhZGRlZCB0byB0aGUgYnVpbGQgcmVzdWx0cyBvdXRwdXQgZmlsZXNcbiAgICAgIGxldCBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlczogT3V0cHV0RmlsZVtdO1xuXG4gICAgICBidWlsZC5vblN0YXJ0KGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0OiBPblN0YXJ0UmVzdWx0ID0ge307XG5cbiAgICAgICAgLy8gUmVzZXQgc3R5bGVzaGVldCByZXNvdXJjZSBvdXRwdXQgZmlsZXNcbiAgICAgICAgc3R5bGVzaGVldFJlc291cmNlRmlsZXMgPSBbXTtcblxuICAgICAgICAvLyBDcmVhdGUgVHlwZVNjcmlwdCBjb21waWxlciBob3N0XG4gICAgICAgIGNvbnN0IGhvc3QgPSB0cy5jcmVhdGVJbmNyZW1lbnRhbENvbXBpbGVySG9zdChjb21waWxlck9wdGlvbnMpO1xuXG4gICAgICAgIC8vIFRlbXBvcmFyaWx5IHByb2Nlc3MgZXh0ZXJuYWwgcmVzb3VyY2VzIHZpYSByZWFkUmVzb3VyY2UuXG4gICAgICAgIC8vIFRoZSBBT1QgY29tcGlsZXIgY3VycmVudGx5IHJlcXVpcmVzIHRoaXMgaG9vayB0byBhbGxvdyBmb3IgYSB0cmFuc2Zvcm1SZXNvdXJjZSBob29rLlxuICAgICAgICAvLyBPbmNlIHRoZSBBT1QgY29tcGlsZXIgYWxsb3dzIG9ubHkgYSB0cmFuc2Zvcm1SZXNvdXJjZSBob29rLCB0aGlzIGNhbiBiZSByZWV2YWx1YXRlZC5cbiAgICAgICAgKGhvc3QgYXMgQ29tcGlsZXJIb3N0KS5yZWFkUmVzb3VyY2UgPSBhc3luYyBmdW5jdGlvbiAoZmlsZU5hbWUpIHtcbiAgICAgICAgICAvLyBUZW1wbGF0ZSByZXNvdXJjZXMgKC5odG1sLy5zdmcpIGZpbGVzIGFyZSBub3QgYnVuZGxlZCBvciB0cmFuc2Zvcm1lZFxuICAgICAgICAgIGlmIChmaWxlTmFtZS5lbmRzV2l0aCgnLmh0bWwnKSB8fCBmaWxlTmFtZS5lbmRzV2l0aCgnLnN2ZycpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yZWFkRmlsZShmaWxlTmFtZSkgPz8gJyc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgeyBjb250ZW50cywgcmVzb3VyY2VGaWxlcywgZXJyb3JzLCB3YXJuaW5ncyB9ID0gYXdhaXQgYnVuZGxlU3R5bGVzaGVldEZpbGUoXG4gICAgICAgICAgICBmaWxlTmFtZSxcbiAgICAgICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgICAgKHJlc3VsdC53YXJuaW5ncyA/Pz0gW10pLnB1c2goLi4ud2FybmluZ3MpO1xuICAgICAgICAgIHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLnB1c2goLi4ucmVzb3VyY2VGaWxlcyk7XG5cbiAgICAgICAgICByZXR1cm4gY29udGVudHM7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQWRkIGFuIEFPVCBjb21waWxlciByZXNvdXJjZSB0cmFuc2Zvcm0gaG9va1xuICAgICAgICAoaG9zdCBhcyBDb21waWxlckhvc3QpLnRyYW5zZm9ybVJlc291cmNlID0gYXN5bmMgZnVuY3Rpb24gKGRhdGEsIGNvbnRleHQpIHtcbiAgICAgICAgICAvLyBPbmx5IGlubGluZSBzdHlsZSByZXNvdXJjZXMgYXJlIHRyYW5zZm9ybWVkIHNlcGFyYXRlbHkgY3VycmVudGx5XG4gICAgICAgICAgaWYgKGNvbnRleHQucmVzb3VyY2VGaWxlIHx8IGNvbnRleHQudHlwZSAhPT0gJ3N0eWxlJykge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gVGhlIGZpbGUgd2l0aCB0aGUgcmVzb3VyY2UgY29udGVudCB3aWxsIGVpdGhlciBiZSBhbiBhY3R1YWwgZmlsZSAocmVzb3VyY2VGaWxlKVxuICAgICAgICAgIC8vIG9yIHRoZSBmaWxlIGNvbnRhaW5pbmcgdGhlIGlubGluZSBjb21wb25lbnQgc3R5bGUgdGV4dCAoY29udGFpbmluZ0ZpbGUpLlxuICAgICAgICAgIGNvbnN0IGZpbGUgPSBjb250ZXh0LnJlc291cmNlRmlsZSA/PyBjb250ZXh0LmNvbnRhaW5pbmdGaWxlO1xuXG4gICAgICAgICAgY29uc3QgeyBjb250ZW50cywgcmVzb3VyY2VGaWxlcywgZXJyb3JzLCB3YXJuaW5ncyB9ID0gYXdhaXQgYnVuZGxlU3R5bGVzaGVldFRleHQoXG4gICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICByZXNvbHZlUGF0aDogcGF0aC5kaXJuYW1lKGZpbGUpLFxuICAgICAgICAgICAgICB2aXJ0dWFsTmFtZTogZmlsZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaCguLi5lcnJvcnMpO1xuICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgICBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcy5wdXNoKC4uLnJlc291cmNlRmlsZXMpO1xuXG4gICAgICAgICAgcmV0dXJuIHsgY29udGVudDogY29udGVudHMgfTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBDcmVhdGUgdGhlIEFuZ3VsYXIgc3BlY2lmaWMgcHJvZ3JhbSB0aGF0IGNvbnRhaW5zIHRoZSBBbmd1bGFyIGNvbXBpbGVyXG4gICAgICAgIGNvbnN0IGFuZ3VsYXJQcm9ncmFtID0gbmV3IGNvbXBpbGVyQ2xpLk5ndHNjUHJvZ3JhbShyb290TmFtZXMsIGNvbXBpbGVyT3B0aW9ucywgaG9zdCk7XG4gICAgICAgIGNvbnN0IGFuZ3VsYXJDb21waWxlciA9IGFuZ3VsYXJQcm9ncmFtLmNvbXBpbGVyO1xuICAgICAgICBjb25zdCB7IGlnbm9yZUZvckRpYWdub3N0aWNzIH0gPSBhbmd1bGFyQ29tcGlsZXI7XG4gICAgICAgIGNvbnN0IHR5cGVTY3JpcHRQcm9ncmFtID0gYW5ndWxhclByb2dyYW0uZ2V0VHNQcm9ncmFtKCk7XG5cbiAgICAgICAgY29uc3QgYnVpbGRlciA9IHRzLmNyZWF0ZUFic3RyYWN0QnVpbGRlcih0eXBlU2NyaXB0UHJvZ3JhbSwgaG9zdCk7XG5cbiAgICAgICAgYXdhaXQgYW5ndWxhckNvbXBpbGVyLmFuYWx5emVBc3luYygpO1xuXG4gICAgICAgIGZ1bmN0aW9uKiBjb2xsZWN0RGlhZ25vc3RpY3MoKSB7XG4gICAgICAgICAgLy8gQ29sbGVjdCBwcm9ncmFtIGxldmVsIGRpYWdub3N0aWNzXG4gICAgICAgICAgeWllbGQqIGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcztcbiAgICAgICAgICB5aWVsZCogYW5ndWxhckNvbXBpbGVyLmdldE9wdGlvbkRpYWdub3N0aWNzKCk7XG4gICAgICAgICAgeWllbGQqIGJ1aWxkZXIuZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCk7XG4gICAgICAgICAgeWllbGQqIGJ1aWxkZXIuZ2V0R2xvYmFsRGlhZ25vc3RpY3MoKTtcblxuICAgICAgICAgIC8vIENvbGxlY3Qgc291cmNlIGZpbGUgc3BlY2lmaWMgZGlhZ25vc3RpY3NcbiAgICAgICAgICBjb25zdCBPcHRpbWl6ZUZvciA9IGNvbXBpbGVyQ2xpLk9wdGltaXplRm9yO1xuICAgICAgICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiBidWlsZGVyLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChpZ25vcmVGb3JEaWFnbm9zdGljcy5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldFN5bnRhY3RpY0RpYWdub3N0aWNzKHNvdXJjZUZpbGUpO1xuICAgICAgICAgICAgeWllbGQqIGJ1aWxkZXIuZ2V0U2VtYW50aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlKTtcblxuICAgICAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gYW5ndWxhckNvbXBpbGVyLmdldERpYWdub3N0aWNzRm9yRmlsZShcbiAgICAgICAgICAgICAgc291cmNlRmlsZSxcbiAgICAgICAgICAgICAgT3B0aW1pemVGb3IuV2hvbGVQcm9ncmFtLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHlpZWxkKiBhbmd1bGFyRGlhZ25vc3RpY3M7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCBkaWFnbm9zdGljIG9mIGNvbGxlY3REaWFnbm9zdGljcygpKSB7XG4gICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpYyhkaWFnbm9zdGljLCBob3N0KTtcbiAgICAgICAgICBpZiAoZGlhZ25vc3RpYy5jYXRlZ29yeSA9PT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKSB7XG4gICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2gobWVzc2FnZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZpbGVFbWl0dGVyID0gY3JlYXRlRmlsZUVtaXR0ZXIoXG4gICAgICAgICAgYnVpbGRlcixcbiAgICAgICAgICBtZXJnZVRyYW5zZm9ybWVycyhhbmd1bGFyQ29tcGlsZXIucHJlcGFyZUVtaXQoKS50cmFuc2Zvcm1lcnMsIHtcbiAgICAgICAgICAgIGJlZm9yZTogW3JlcGxhY2VCb290c3RyYXAoKCkgPT4gYnVpbGRlci5nZXRQcm9ncmFtKCkuZ2V0VHlwZUNoZWNrZXIoKSldLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgICgpID0+IFtdLFxuICAgICAgICApO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKFxuICAgICAgICB7IGZpbHRlcjogY29tcGlsZXJPcHRpb25zLmFsbG93SnMgPyAvXFwuW2NtXT9banRdc3g/JC8gOiAvXFwuW2NtXT90c3g/JC8gfSxcbiAgICAgICAgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgICBhc3NlcnQub2soZmlsZUVtaXR0ZXIsICdJbnZhbGlkIHBsdWdpbiBleGVjdXRpb24gb3JkZXInKTtcblxuICAgICAgICAgIGNvbnN0IHR5cGVzY3JpcHRSZXN1bHQgPSBhd2FpdCBmaWxlRW1pdHRlcihhcmdzLnBhdGgpO1xuICAgICAgICAgIGlmICghdHlwZXNjcmlwdFJlc3VsdCkge1xuICAgICAgICAgICAgLy8gTm8gVFMgcmVzdWx0IGluZGljYXRlcyB0aGUgZmlsZSBpcyBub3QgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBwcm9ncmFtLlxuICAgICAgICAgICAgLy8gSWYgYWxsb3dKcyBpcyBlbmFibGVkIGFuZCB0aGUgZmlsZSBpcyBKUyB0aGVuIGRlZmVyIHRvIHRoZSBuZXh0IGxvYWQgaG9vay5cbiAgICAgICAgICAgIGlmIChjb21waWxlck9wdGlvbnMuYWxsb3dKcyAmJiAvXFwuW2NtXT9qcyQvLnRlc3QoYXJncy5wYXRoKSkge1xuICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBPdGhlcndpc2UgcmV0dXJuIGFuIGVycm9yXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB0ZXh0OiAnRmlsZSBpcyBtaXNzaW5nIGZyb20gdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24uJyxcbiAgICAgICAgICAgICAgICAgIGxvY2F0aW9uOiB7IGZpbGU6IGFyZ3MucGF0aCB9LFxuICAgICAgICAgICAgICAgICAgbm90ZXM6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgIHRleHQ6IGBFbnN1cmUgdGhlIGZpbGUgaXMgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBwcm9ncmFtIHZpYSB0aGUgJ2ZpbGVzJyBvciAnaW5jbHVkZScgcHJvcGVydHkuYCxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZGF0YSA9IHR5cGVzY3JpcHRSZXN1bHQuY29udGVudCA/PyAnJztcbiAgICAgICAgICBjb25zdCBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24gPSAvZm9yXFxzK2F3YWl0XFxzKlxcKHxhc3luY1xccytmdW5jdGlvblxccypcXCovLnRlc3QoZGF0YSk7XG4gICAgICAgICAgY29uc3QgdXNlSW5wdXRTb3VyY2VtYXAgPVxuICAgICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAgJiZcbiAgICAgICAgICAgICghIXBsdWdpbk9wdGlvbnMudGhpcmRQYXJ0eVNvdXJjZW1hcHMgfHwgIS9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS8udGVzdChhcmdzLnBhdGgpKTtcblxuICAgICAgICAgIC8vIElmIG5vIGFkZGl0aW9uYWwgdHJhbnNmb3JtYXRpb25zIGFyZSBuZWVkZWQsIHJldHVybiB0aGUgVHlwZVNjcmlwdCBvdXRwdXQgZGlyZWN0bHlcbiAgICAgICAgICBpZiAoIWZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbiAmJiAhcGx1Z2luT3B0aW9ucy5hZHZhbmNlZE9wdGltaXphdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIC8vIFN0cmlwIHNvdXJjZW1hcHMgaWYgdGhleSBzaG91bGQgbm90IGJlIHVzZWRcbiAgICAgICAgICAgICAgY29udGVudHM6IHVzZUlucHV0U291cmNlbWFwXG4gICAgICAgICAgICAgICAgPyBkYXRhXG4gICAgICAgICAgICAgICAgOiBkYXRhLnJlcGxhY2UoL15cXC9cXC8jIHNvdXJjZU1hcHBpbmdVUkw9W15cXHJcXG5dKi9nbSwgJycpLFxuICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGJhYmVsUmVzdWx0ID0gYXdhaXQgdHJhbnNmb3JtQXN5bmMoZGF0YSwge1xuICAgICAgICAgICAgZmlsZW5hbWU6IGFyZ3MucGF0aCxcbiAgICAgICAgICAgIGlucHV0U291cmNlTWFwOiAodXNlSW5wdXRTb3VyY2VtYXAgPyB1bmRlZmluZWQgOiBmYWxzZSkgYXMgdW5kZWZpbmVkLFxuICAgICAgICAgICAgc291cmNlTWFwczogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAgPyAnaW5saW5lJyA6IGZhbHNlLFxuICAgICAgICAgICAgY29tcGFjdDogZmFsc2UsXG4gICAgICAgICAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICAgICAgICAgIGJhYmVscmM6IGZhbHNlLFxuICAgICAgICAgICAgYnJvd3NlcnNsaXN0Q29uZmlnRmlsZTogZmFsc2UsXG4gICAgICAgICAgICBwbHVnaW5zOiBbXSxcbiAgICAgICAgICAgIHByZXNldHM6IFtcbiAgICAgICAgICAgICAgW1xuICAgICAgICAgICAgICAgIGFuZ3VsYXJBcHBsaWNhdGlvblByZXNldCxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24sXG4gICAgICAgICAgICAgICAgICBvcHRpbWl6ZTogcGx1Z2luT3B0aW9ucy5hZHZhbmNlZE9wdGltaXphdGlvbnMgJiYge30sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29udGVudHM6IGJhYmVsUmVzdWx0Py5jb2RlID8/ICcnLFxuICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICApO1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5bY21dP2pzJC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGZzLnJlYWRGaWxlKGFyZ3MucGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgIGNvbnN0IGZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbiA9XG4gICAgICAgICAgIS9bXFxcXC9dW19mXT9lc20yMDE1W1xcXFwvXS8udGVzdChhcmdzLnBhdGgpICYmXG4gICAgICAgICAgL2Zvclxccythd2FpdFxccypcXCh8YXN5bmNcXHMrZnVuY3Rpb25cXHMqXFwqLy50ZXN0KGRhdGEpO1xuICAgICAgICBjb25zdCBzaG91bGRMaW5rID0gYXdhaXQgcmVxdWlyZXNMaW5raW5nKGFyZ3MucGF0aCwgZGF0YSk7XG4gICAgICAgIGNvbnN0IHVzZUlucHV0U291cmNlbWFwID1cbiAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCAmJlxuICAgICAgICAgICghIXBsdWdpbk9wdGlvbnMudGhpcmRQYXJ0eVNvdXJjZW1hcHMgfHwgIS9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS8udGVzdChhcmdzLnBhdGgpKTtcblxuICAgICAgICAvLyBJZiBubyBhZGRpdGlvbmFsIHRyYW5zZm9ybWF0aW9ucyBhcmUgbmVlZGVkLCByZXR1cm4gdGhlIFR5cGVTY3JpcHQgb3V0cHV0IGRpcmVjdGx5XG4gICAgICAgIGlmICghZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uICYmICFwbHVnaW5PcHRpb25zLmFkdmFuY2VkT3B0aW1pemF0aW9ucyAmJiAhc2hvdWxkTGluaykge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAvLyBTdHJpcCBzb3VyY2VtYXBzIGlmIHRoZXkgc2hvdWxkIG5vdCBiZSB1c2VkXG4gICAgICAgICAgICBjb250ZW50czogdXNlSW5wdXRTb3VyY2VtYXBcbiAgICAgICAgICAgICAgPyBkYXRhXG4gICAgICAgICAgICAgIDogZGF0YS5yZXBsYWNlKC9eXFwvXFwvIyBzb3VyY2VNYXBwaW5nVVJMPVteXFxyXFxuXSovZ20sICcnKSxcbiAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYW5ndWxhclBhY2thZ2UgPSAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL11AYW5ndWxhcltcXFxcL10vLnRlc3QoYXJncy5wYXRoKTtcblxuICAgICAgICBjb25zdCBsaW5rZXJQbHVnaW5DcmVhdG9yID0gKFxuICAgICAgICAgIGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcpPihcbiAgICAgICAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJyxcbiAgICAgICAgICApXG4gICAgICAgICkuY3JlYXRlRXMyMDE1TGlua2VyUGx1Z2luO1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRyYW5zZm9ybUFzeW5jKGRhdGEsIHtcbiAgICAgICAgICBmaWxlbmFtZTogYXJncy5wYXRoLFxuICAgICAgICAgIGlucHV0U291cmNlTWFwOiAodXNlSW5wdXRTb3VyY2VtYXAgPyB1bmRlZmluZWQgOiBmYWxzZSkgYXMgdW5kZWZpbmVkLFxuICAgICAgICAgIHNvdXJjZU1hcHM6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwID8gJ2lubGluZScgOiBmYWxzZSxcbiAgICAgICAgICBjb21wYWN0OiBmYWxzZSxcbiAgICAgICAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICAgICAgICBiYWJlbHJjOiBmYWxzZSxcbiAgICAgICAgICBicm93c2Vyc2xpc3RDb25maWdGaWxlOiBmYWxzZSxcbiAgICAgICAgICBwbHVnaW5zOiBbXSxcbiAgICAgICAgICBwcmVzZXRzOiBbXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgIGFuZ3VsYXJBcHBsaWNhdGlvblByZXNldCxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGFuZ3VsYXJMaW5rZXI6IHtcbiAgICAgICAgICAgICAgICAgIHNob3VsZExpbmssXG4gICAgICAgICAgICAgICAgICBqaXRNb2RlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgIGxpbmtlclBsdWdpbkNyZWF0b3IsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24sXG4gICAgICAgICAgICAgICAgb3B0aW1pemU6IHBsdWdpbk9wdGlvbnMuYWR2YW5jZWRPcHRpbWl6YXRpb25zICYmIHtcbiAgICAgICAgICAgICAgICAgIGxvb3NlRW51bXM6IGFuZ3VsYXJQYWNrYWdlLFxuICAgICAgICAgICAgICAgICAgcHVyZVRvcExldmVsOiBhbmd1bGFyUGFja2FnZSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbnRlbnRzOiByZXN1bHQ/LmNvZGUgPz8gZGF0YSxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25FbmQoKHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAoc3R5bGVzaGVldFJlc291cmNlRmlsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgcmVzdWx0Lm91dHB1dEZpbGVzPy5wdXNoKC4uLnN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlRmlsZUVtaXR0ZXIoXG4gIHByb2dyYW06IHRzLkJ1aWxkZXJQcm9ncmFtLFxuICB0cmFuc2Zvcm1lcnM6IHRzLkN1c3RvbVRyYW5zZm9ybWVycyA9IHt9LFxuICBvbkFmdGVyRW1pdD86IChzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKSA9PiB2b2lkLFxuKTogRmlsZUVtaXR0ZXIge1xuICByZXR1cm4gYXN5bmMgKGZpbGU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBwcm9ncmFtLmdldFNvdXJjZUZpbGUoZmlsZSk7XG4gICAgaWYgKCFzb3VyY2VGaWxlKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGxldCBjb250ZW50OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgcHJvZ3JhbS5lbWl0KFxuICAgICAgc291cmNlRmlsZSxcbiAgICAgIChmaWxlbmFtZSwgZGF0YSkgPT4ge1xuICAgICAgICBpZiAoL1xcLltjbV0/anMkLy50ZXN0KGZpbGVuYW1lKSkge1xuICAgICAgICAgIGNvbnRlbnQgPSBkYXRhO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgdW5kZWZpbmVkIC8qIGNhbmNlbGxhdGlvblRva2VuICovLFxuICAgICAgdW5kZWZpbmVkIC8qIGVtaXRPbmx5RHRzRmlsZXMgKi8sXG4gICAgICB0cmFuc2Zvcm1lcnMsXG4gICAgKTtcblxuICAgIG9uQWZ0ZXJFbWl0Py4oc291cmNlRmlsZSk7XG5cbiAgICByZXR1cm4geyBjb250ZW50LCBkZXBlbmRlbmNpZXM6IFtdIH07XG4gIH07XG59XG4iXX0=