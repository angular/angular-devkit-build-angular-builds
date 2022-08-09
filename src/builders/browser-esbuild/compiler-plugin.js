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
                    // Template resources (.html) files are not bundled or transformed
                    if (fileName.endsWith('.html')) {
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
                const { ignoreForDiagnostics, ignoreForEmit } = angularCompiler;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILHNDQUE2QztBQUM3QywrQ0FBaUM7QUFTakMsMkJBQW9DO0FBQ3BDLDJDQUE2QjtBQUM3Qiw0REFBNEI7QUFDNUIsa0ZBQXVFO0FBQ3ZFLCtEQUE2RDtBQUM3RCxtREFBcUQ7QUFDckQsK0NBQW9HO0FBVXBHOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLCtCQUErQixDQUN0QyxJQUFxQyxFQUNyQyxJQUE4QixFQUM5QixVQUFtQjtJQUVuQixJQUFJLElBQUksR0FBRyxvQkFBRSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDaEYsSUFBSSxVQUFVLEVBQUU7UUFDZCxJQUFJLEdBQUcsVUFBVSxHQUFHLElBQUksQ0FBQztLQUMxQjtJQUVELE1BQU0sSUFBSSxHQUFnQixFQUFFLElBQUksRUFBRSxDQUFDO0lBRW5DLElBQUksSUFBSSxDQUFDLElBQUksRUFBRTtRQUNiLElBQUksQ0FBQyxRQUFRLEdBQUc7WUFDZCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRO1lBQ3hCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtTQUNwQixDQUFDO1FBRUYsNEZBQTRGO1FBQzVGLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNkLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEdBQUcsb0JBQUUsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElB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QUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMvQyxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQ2YsT0FBTyxTQUFTLENBQUM7U0FDbEI7UUFFRCxJQUFJLE9BQTJCLENBQUM7UUFDaEMsT0FBTyxDQUFDLElBQUksQ0FDVixVQUFVLEVBQ1YsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLEVBQUU7WUFDakIsSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUMvQixPQUFPLEdBQUcsSUFBSSxDQUFDO2FBQ2hCO1FBQ0gsQ0FBQyxFQUNELFNBQVMsQ0FBQyx1QkFBdUIsRUFDakMsU0FBUyxDQUFDLHNCQUFzQixFQUNoQyxZQUFZLENBQ2IsQ0FBQztRQUVGLFdBQVcsYUFBWCxXQUFXLHVCQUFYLFdBQVcsQ0FBRyxVQUFVLENBQUMsQ0FBQztRQUUxQixPQUFPLEVBQUUsT0FBTyxFQUFFLFlBQVksRUFBRSxFQUFFLEVBQUUsQ0FBQztJQUN2QyxDQUFDLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQ29tcGlsZXJIb3N0IH0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJztcbmltcG9ydCB7IHRyYW5zZm9ybUFzeW5jIH0gZnJvbSAnQGJhYmVsL2NvcmUnO1xuaW1wb3J0ICogYXMgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgdHlwZSB7XG4gIE9uU3RhcnRSZXN1bHQsXG4gIE91dHB1dEZpbGUsXG4gIFBhcnRpYWxNZXNzYWdlLFxuICBQYXJ0aWFsTm90ZSxcbiAgUGx1Z2luLFxuICBQbHVnaW5CdWlsZCxcbn0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBwcm9taXNlcyBhcyBmcyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgYW5ndWxhckFwcGxpY2F0aW9uUHJlc2V0IGZyb20gJy4uLy4uL2JhYmVsL3ByZXNldHMvYXBwbGljYXRpb24nO1xuaW1wb3J0IHsgcmVxdWlyZXNMaW5raW5nIH0gZnJvbSAnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcbmltcG9ydCB7IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLCBidW5kbGVTdHlsZXNoZWV0RmlsZSwgYnVuZGxlU3R5bGVzaGVldFRleHQgfSBmcm9tICcuL3N0eWxlc2hlZXRzJztcblxuaW50ZXJmYWNlIEVtaXRGaWxlUmVzdWx0IHtcbiAgY29udGVudD86IHN0cmluZztcbiAgbWFwPzogc3RyaW5nO1xuICBkZXBlbmRlbmNpZXM6IHJlYWRvbmx5IHN0cmluZ1tdO1xuICBoYXNoPzogVWludDhBcnJheTtcbn1cbnR5cGUgRmlsZUVtaXR0ZXIgPSAoZmlsZTogc3RyaW5nKSA9PiBQcm9taXNlPEVtaXRGaWxlUmVzdWx0IHwgdW5kZWZpbmVkPjtcblxuLyoqXG4gKiBDb252ZXJ0cyBUeXBlU2NyaXB0IERpYWdub3N0aWMgcmVsYXRlZCBpbmZvcm1hdGlvbiBpbnRvIGFuIGVzYnVpbGQgY29tcGF0aWJsZSBub3RlIG9iamVjdC5cbiAqIFJlbGF0ZWQgaW5mb3JtYXRpb24gaXMgYSBzdWJzZXQgb2YgYSBmdWxsIFR5cGVTY3JpcHQgRGlhZ25vc3RpYyBhbmQgYWxzbyB1c2VkIGZvciBkaWFnbm9zdGljXG4gKiBub3RlcyBhc3NvY2lhdGVkIHdpdGggdGhlIG1haW4gRGlhZ25vc3RpYy5cbiAqIEBwYXJhbSBkaWFnbm9zdGljIFRoZSBUeXBlU2NyaXB0IGRpYWdub3N0aWMgcmVsYXRpdmUgaW5mb3JtYXRpb24gdG8gY29udmVydC5cbiAqIEBwYXJhbSBob3N0IEEgVHlwZVNjcmlwdCBGb3JtYXREaWFnbm9zdGljc0hvc3QgaW5zdGFuY2UgdG8gdXNlIGR1cmluZyBjb252ZXJzaW9uLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBkaWFnbm9zdGljIG1lc3NhZ2UgYXMgYSBQYXJ0aWFsTWVzc2FnZSBvYmplY3RcbiAqL1xuZnVuY3Rpb24gY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljSW5mbyhcbiAgaW5mbzogdHMuRGlhZ25vc3RpY1JlbGF0ZWRJbmZvcm1hdGlvbixcbiAgaG9zdDogdHMuRm9ybWF0RGlhZ25vc3RpY3NIb3N0LFxuICB0ZXh0UHJlZml4Pzogc3RyaW5nLFxuKTogUGFydGlhbE5vdGUge1xuICBsZXQgdGV4dCA9IHRzLmZsYXR0ZW5EaWFnbm9zdGljTWVzc2FnZVRleHQoaW5mby5tZXNzYWdlVGV4dCwgaG9zdC5nZXROZXdMaW5lKCkpO1xuICBpZiAodGV4dFByZWZpeCkge1xuICAgIHRleHQgPSB0ZXh0UHJlZml4ICsgdGV4dDtcbiAgfVxuXG4gIGNvbnN0IG5vdGU6IFBhcnRpYWxOb3RlID0geyB0ZXh0IH07XG5cbiAgaWYgKGluZm8uZmlsZSkge1xuICAgIG5vdGUubG9jYXRpb24gPSB7XG4gICAgICBmaWxlOiBpbmZvLmZpbGUuZmlsZU5hbWUsXG4gICAgICBsZW5ndGg6IGluZm8ubGVuZ3RoLFxuICAgIH07XG5cbiAgICAvLyBDYWxjdWxhdGUgdGhlIGxpbmUvY29sdW1uIGxvY2F0aW9uIGFuZCBleHRyYWN0IHRoZSBmdWxsIGxpbmUgdGV4dCB0aGF0IGhhcyB0aGUgZGlhZ25vc3RpY1xuICAgIGlmIChpbmZvLnN0YXJ0KSB7XG4gICAgICBjb25zdCB7IGxpbmUsIGNoYXJhY3RlciB9ID0gdHMuZ2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24oaW5mby5maWxlLCBpbmZvLnN0YXJ0KTtcbiAgICAgIG5vdGUubG9jYXRpb24ubGluZSA9IGxpbmUgKyAxO1xuICAgICAgbm90ZS5sb2NhdGlvbi5jb2x1bW4gPSBjaGFyYWN0ZXI7XG5cbiAgICAgIC8vIFRoZSBzdGFydCBwb3NpdGlvbiBmb3IgdGhlIHNsaWNlIGlzIHRoZSBmaXJzdCBjaGFyYWN0ZXIgb2YgdGhlIGVycm9yIGxpbmVcbiAgICAgIGNvbnN0IGxpbmVTdGFydFBvc2l0aW9uID0gdHMuZ2V0UG9zaXRpb25PZkxpbmVBbmRDaGFyYWN0ZXIoaW5mby5maWxlLCBsaW5lLCAwKTtcblxuICAgICAgLy8gVGhlIGVuZCBwb3NpdGlvbiBmb3IgdGhlIHNsaWNlIGlzIHRoZSBmaXJzdCBjaGFyYWN0ZXIgb2YgdGhlIG5leHQgbGluZSBvciB0aGUgbGVuZ3RoIG9mXG4gICAgICAvLyB0aGUgZW50aXJlIGZpbGUgaWYgdGhlIGxpbmUgaXMgdGhlIGxhc3QgbGluZSBvZiB0aGUgZmlsZSAoZ2V0UG9zaXRpb25PZkxpbmVBbmRDaGFyYWN0ZXJcbiAgICAgIC8vIHdpbGwgZXJyb3IgaWYgYSBub25leGlzdGVudCBsaW5lIGlzIHBhc3NlZCkuXG4gICAgICBjb25zdCB7IGxpbmU6IGxhc3RMaW5lT2ZGaWxlIH0gPSB0cy5nZXRMaW5lQW5kQ2hhcmFjdGVyT2ZQb3NpdGlvbihcbiAgICAgICAgaW5mby5maWxlLFxuICAgICAgICBpbmZvLmZpbGUudGV4dC5sZW5ndGggLSAxLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGxpbmVFbmRQb3NpdGlvbiA9XG4gICAgICAgIGxpbmUgPCBsYXN0TGluZU9mRmlsZVxuICAgICAgICAgID8gdHMuZ2V0UG9zaXRpb25PZkxpbmVBbmRDaGFyYWN0ZXIoaW5mby5maWxlLCBsaW5lICsgMSwgMClcbiAgICAgICAgICA6IGluZm8uZmlsZS50ZXh0Lmxlbmd0aDtcblxuICAgICAgbm90ZS5sb2NhdGlvbi5saW5lVGV4dCA9IGluZm8uZmlsZS50ZXh0LnNsaWNlKGxpbmVTdGFydFBvc2l0aW9uLCBsaW5lRW5kUG9zaXRpb24pLnRyaW1FbmQoKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbm90ZTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBhIFR5cGVTY3JpcHQgRGlhZ25vc3RpYyBtZXNzYWdlIGludG8gYW4gZXNidWlsZCBjb21wYXRpYmxlIG1lc3NhZ2Ugb2JqZWN0LlxuICogQHBhcmFtIGRpYWdub3N0aWMgVGhlIFR5cGVTY3JpcHQgZGlhZ25vc3RpYyB0byBjb252ZXJ0LlxuICogQHBhcmFtIGhvc3QgQSBUeXBlU2NyaXB0IEZvcm1hdERpYWdub3N0aWNzSG9zdCBpbnN0YW5jZSB0byB1c2UgZHVyaW5nIGNvbnZlcnNpb24uXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIGRpYWdub3N0aWMgbWVzc2FnZSBhcyBhIFBhcnRpYWxNZXNzYWdlIG9iamVjdFxuICovXG5mdW5jdGlvbiBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWMoXG4gIGRpYWdub3N0aWM6IHRzLkRpYWdub3N0aWMsXG4gIGhvc3Q6IHRzLkZvcm1hdERpYWdub3N0aWNzSG9zdCxcbik6IFBhcnRpYWxNZXNzYWdlIHtcbiAgbGV0IGNvZGVQcmVmaXggPSAnVFMnO1xuICBsZXQgY29kZSA9IGAke2RpYWdub3N0aWMuY29kZX1gO1xuICBpZiAoZGlhZ25vc3RpYy5zb3VyY2UgPT09ICduZ3RzYycpIHtcbiAgICBjb2RlUHJlZml4ID0gJ05HJztcbiAgICAvLyBSZW1vdmUgYC05OWAgQW5ndWxhciBwcmVmaXggZnJvbSBkaWFnbm9zdGljIGNvZGVcbiAgICBjb2RlID0gY29kZS5zbGljZSgzKTtcbiAgfVxuXG4gIGNvbnN0IG1lc3NhZ2U6IFBhcnRpYWxNZXNzYWdlID0ge1xuICAgIC4uLmNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oZGlhZ25vc3RpYywgaG9zdCwgYCR7Y29kZVByZWZpeH0ke2NvZGV9OiBgKSxcbiAgICAvLyBTdG9yZSBvcmlnaW5hbCBkaWFnbm9zdGljIGZvciByZWZlcmVuY2UgaWYgbmVlZGVkIGRvd25zdHJlYW1cbiAgICBkZXRhaWw6IGRpYWdub3N0aWMsXG4gIH07XG5cbiAgaWYgKGRpYWdub3N0aWMucmVsYXRlZEluZm9ybWF0aW9uPy5sZW5ndGgpIHtcbiAgICBtZXNzYWdlLm5vdGVzID0gZGlhZ25vc3RpYy5yZWxhdGVkSW5mb3JtYXRpb24ubWFwKChpbmZvKSA9PlxuICAgICAgY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljSW5mbyhpbmZvLCBob3N0KSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIG1lc3NhZ2U7XG59XG5cbi8vIFRoaXMgaXMgYSBub24td2F0Y2ggdmVyc2lvbiBvZiB0aGUgY29tcGlsZXIgY29kZSBmcm9tIGBAbmd0b29scy93ZWJwYWNrYCBhdWdtZW50ZWQgZm9yIGVzYnVpbGRcbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gIHBsdWdpbk9wdGlvbnM6IHtcbiAgICBzb3VyY2VtYXA6IGJvb2xlYW47XG4gICAgdHNjb25maWc6IHN0cmluZztcbiAgICBhZHZhbmNlZE9wdGltaXphdGlvbnM/OiBib29sZWFuO1xuICAgIHRoaXJkUGFydHlTb3VyY2VtYXBzPzogYm9vbGVhbjtcbiAgfSxcbiAgc3R5bGVPcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbik6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItY29tcGlsZXInLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG4gICAgYXN5bmMgc2V0dXAoYnVpbGQ6IFBsdWdpbkJ1aWxkKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAvLyBUaGlzIHVzZXMgYSB3cmFwcGVkIGR5bmFtaWMgaW1wb3J0IHRvIGxvYWQgYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgd2hpY2ggaXMgRVNNLlxuICAgICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIHJldGFpbmluZyBkeW5hbWljIGltcG9ydHMgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZSBkcm9wcGVkLlxuICAgICAgY29uc3QgY29tcGlsZXJDbGkgPSBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpPihcbiAgICAgICAgJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScsXG4gICAgICApO1xuXG4gICAgICAvLyBUZW1wb3JhcnkgZGVlcCBpbXBvcnQgZm9yIHRyYW5zZm9ybWVyIHN1cHBvcnRcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbWVyZ2VUcmFuc2Zvcm1lcnMsXG4gICAgICAgIHJlcGxhY2VCb290c3RyYXAsXG4gICAgICB9ID0gcmVxdWlyZSgnQG5ndG9vbHMvd2VicGFjay9zcmMvaXZ5L3RyYW5zZm9ybWF0aW9uJyk7XG5cbiAgICAgIC8vIFNldHVwIGRlZmluZXMgYmFzZWQgb24gdGhlIHZhbHVlcyBwcm92aWRlZCBieSB0aGUgQW5ndWxhciBjb21waWxlci1jbGlcbiAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLmRlZmluZSA/Pz0ge307XG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhjb21waWxlckNsaS5HTE9CQUxfREVGU19GT1JfVEVSU0VSX1dJVEhfQU9UKSkge1xuICAgICAgICBpZiAoa2V5IGluIGJ1aWxkLmluaXRpYWxPcHRpb25zLmRlZmluZSkge1xuICAgICAgICAgIC8vIFNraXAga2V5cyB0aGF0IGhhdmUgYmVlbiBtYW51YWxseSBwcm92aWRlZFxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIGVzYnVpbGQgcmVxdWlyZXMgdmFsdWVzIHRvIGJlIGEgc3RyaW5nIChhY3R1YWwgc3RyaW5ncyBuZWVkIHRvIGJlIHF1b3RlZCkuXG4gICAgICAgIC8vIEluIHRoaXMgY2FzZSwgYWxsIHByb3ZpZGVkIHZhbHVlcyBhcmUgYm9vbGVhbnMuXG4gICAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLmRlZmluZVtrZXldID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIHRzY29uZmlnIGlzIGxvYWRlZCBpbiBzZXR1cCBpbnN0ZWFkIG9mIGluIHN0YXJ0IHRvIGFsbG93IHRoZSBlc2J1aWxkIHRhcmdldCBidWlsZCBvcHRpb24gdG8gYmUgbW9kaWZpZWQuXG4gICAgICAvLyBlc2J1aWxkIGJ1aWxkIG9wdGlvbnMgY2FuIG9ubHkgYmUgbW9kaWZpZWQgaW4gc2V0dXAgcHJpb3IgdG8gc3RhcnRpbmcgdGhlIGJ1aWxkLlxuICAgICAgY29uc3Qge1xuICAgICAgICBvcHRpb25zOiBjb21waWxlck9wdGlvbnMsXG4gICAgICAgIHJvb3ROYW1lcyxcbiAgICAgICAgZXJyb3JzOiBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3MsXG4gICAgICB9ID0gY29tcGlsZXJDbGkucmVhZENvbmZpZ3VyYXRpb24ocGx1Z2luT3B0aW9ucy50c2NvbmZpZywge1xuICAgICAgICBlbmFibGVJdnk6IHRydWUsXG4gICAgICAgIG5vRW1pdE9uRXJyb3I6IGZhbHNlLFxuICAgICAgICBzdXBwcmVzc091dHB1dFBhdGhDaGVjazogdHJ1ZSxcbiAgICAgICAgb3V0RGlyOiB1bmRlZmluZWQsXG4gICAgICAgIGlubGluZVNvdXJjZXM6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICBpbmxpbmVTb3VyY2VNYXA6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxuICAgICAgICBtYXBSb290OiB1bmRlZmluZWQsXG4gICAgICAgIHNvdXJjZVJvb3Q6IHVuZGVmaW5lZCxcbiAgICAgICAgZGVjbGFyYXRpb246IGZhbHNlLFxuICAgICAgICBkZWNsYXJhdGlvbk1hcDogZmFsc2UsXG4gICAgICAgIGFsbG93RW1wdHlDb2RlZ2VuRmlsZXM6IGZhbHNlLFxuICAgICAgICBhbm5vdGF0aW9uc0FzOiAnZGVjb3JhdG9ycycsXG4gICAgICAgIGVuYWJsZVJlc291cmNlSW5saW5pbmc6IGZhbHNlLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEFkanVzdCB0aGUgZXNidWlsZCBvdXRwdXQgdGFyZ2V0IGJhc2VkIG9uIHRoZSB0c2NvbmZpZyB0YXJnZXRcbiAgICAgIGlmIChcbiAgICAgICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPD0gdHMuU2NyaXB0VGFyZ2V0LkVTMjAxNVxuICAgICAgKSB7XG4gICAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLnRhcmdldCA9ICdlczIwMTUnO1xuICAgICAgfSBlbHNlIGlmIChjb21waWxlck9wdGlvbnMudGFyZ2V0ID49IHRzLlNjcmlwdFRhcmdldC5FU05leHQpIHtcbiAgICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMudGFyZ2V0ID0gJ2VzbmV4dCc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy50YXJnZXQgPSB0cy5TY3JpcHRUYXJnZXRbY29tcGlsZXJPcHRpb25zLnRhcmdldF0udG9Mb3dlckNhc2UoKTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIGZpbGUgZW1pdHRlciBjcmVhdGVkIGR1cmluZyBgb25TdGFydGAgdGhhdCB3aWxsIGJlIHVzZWQgZHVyaW5nIHRoZSBidWlsZCBpbiBgb25Mb2FkYCBjYWxsYmFja3MgZm9yIFRTIGZpbGVzXG4gICAgICBsZXQgZmlsZUVtaXR0ZXI6IEZpbGVFbWl0dGVyIHwgdW5kZWZpbmVkO1xuXG4gICAgICAvLyBUaGUgc3R5bGVzaGVldCByZXNvdXJjZXMgZnJvbSBjb21wb25lbnQgc3R5bGVzaGVldHMgdGhhdCB3aWxsIGJlIGFkZGVkIHRvIHRoZSBidWlsZCByZXN1bHRzIG91dHB1dCBmaWxlc1xuICAgICAgbGV0IHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzOiBPdXRwdXRGaWxlW107XG5cbiAgICAgIGJ1aWxkLm9uU3RhcnQoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQ6IE9uU3RhcnRSZXN1bHQgPSB7fTtcblxuICAgICAgICAvLyBSZXNldCBzdHlsZXNoZWV0IHJlc291cmNlIG91dHB1dCBmaWxlc1xuICAgICAgICBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyA9IFtdO1xuXG4gICAgICAgIC8vIENyZWF0ZSBUeXBlU2NyaXB0IGNvbXBpbGVyIGhvc3RcbiAgICAgICAgY29uc3QgaG9zdCA9IHRzLmNyZWF0ZUluY3JlbWVudGFsQ29tcGlsZXJIb3N0KGNvbXBpbGVyT3B0aW9ucyk7XG5cbiAgICAgICAgLy8gVGVtcG9yYXJpbHkgcHJvY2VzcyBleHRlcm5hbCByZXNvdXJjZXMgdmlhIHJlYWRSZXNvdXJjZS5cbiAgICAgICAgLy8gVGhlIEFPVCBjb21waWxlciBjdXJyZW50bHkgcmVxdWlyZXMgdGhpcyBob29rIHRvIGFsbG93IGZvciBhIHRyYW5zZm9ybVJlc291cmNlIGhvb2suXG4gICAgICAgIC8vIE9uY2UgdGhlIEFPVCBjb21waWxlciBhbGxvd3Mgb25seSBhIHRyYW5zZm9ybVJlc291cmNlIGhvb2ssIHRoaXMgY2FuIGJlIHJlZXZhbHVhdGVkLlxuICAgICAgICAoaG9zdCBhcyBDb21waWxlckhvc3QpLnJlYWRSZXNvdXJjZSA9IGFzeW5jIGZ1bmN0aW9uIChmaWxlTmFtZSkge1xuICAgICAgICAgIC8vIFRlbXBsYXRlIHJlc291cmNlcyAoLmh0bWwpIGZpbGVzIGFyZSBub3QgYnVuZGxlZCBvciB0cmFuc2Zvcm1lZFxuICAgICAgICAgIGlmIChmaWxlTmFtZS5lbmRzV2l0aCgnLmh0bWwnKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVhZEZpbGUoZmlsZU5hbWUpID8/ICcnO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHsgY29udGVudHMsIHJlc291cmNlRmlsZXMsIGVycm9ycywgd2FybmluZ3MgfSA9IGF3YWl0IGJ1bmRsZVN0eWxlc2hlZXRGaWxlKFxuICAgICAgICAgICAgZmlsZU5hbWUsXG4gICAgICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaCguLi5lcnJvcnMpO1xuICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgICBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcy5wdXNoKC4uLnJlc291cmNlRmlsZXMpO1xuXG4gICAgICAgICAgcmV0dXJuIGNvbnRlbnRzO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIEFkZCBhbiBBT1QgY29tcGlsZXIgcmVzb3VyY2UgdHJhbnNmb3JtIGhvb2tcbiAgICAgICAgKGhvc3QgYXMgQ29tcGlsZXJIb3N0KS50cmFuc2Zvcm1SZXNvdXJjZSA9IGFzeW5jIGZ1bmN0aW9uIChkYXRhLCBjb250ZXh0KSB7XG4gICAgICAgICAgLy8gT25seSBpbmxpbmUgc3R5bGUgcmVzb3VyY2VzIGFyZSB0cmFuc2Zvcm1lZCBzZXBhcmF0ZWx5IGN1cnJlbnRseVxuICAgICAgICAgIGlmIChjb250ZXh0LnJlc291cmNlRmlsZSB8fCBjb250ZXh0LnR5cGUgIT09ICdzdHlsZScpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFRoZSBmaWxlIHdpdGggdGhlIHJlc291cmNlIGNvbnRlbnQgd2lsbCBlaXRoZXIgYmUgYW4gYWN0dWFsIGZpbGUgKHJlc291cmNlRmlsZSlcbiAgICAgICAgICAvLyBvciB0aGUgZmlsZSBjb250YWluaW5nIHRoZSBpbmxpbmUgY29tcG9uZW50IHN0eWxlIHRleHQgKGNvbnRhaW5pbmdGaWxlKS5cbiAgICAgICAgICBjb25zdCBmaWxlID0gY29udGV4dC5yZXNvdXJjZUZpbGUgPz8gY29udGV4dC5jb250YWluaW5nRmlsZTtcblxuICAgICAgICAgIGNvbnN0IHsgY29udGVudHMsIHJlc291cmNlRmlsZXMsIGVycm9ycywgd2FybmluZ3MgfSA9IGF3YWl0IGJ1bmRsZVN0eWxlc2hlZXRUZXh0KFxuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZVBhdGg6IHBhdGguZGlybmFtZShmaWxlKSxcbiAgICAgICAgICAgICAgdmlydHVhbE5hbWU6IGZpbGUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaCguLi53YXJuaW5ncyk7XG4gICAgICAgICAgc3R5bGVzaGVldFJlc291cmNlRmlsZXMucHVzaCguLi5yZXNvdXJjZUZpbGVzKTtcblxuICAgICAgICAgIHJldHVybiB7IGNvbnRlbnQ6IGNvbnRlbnRzIH07XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQ3JlYXRlIHRoZSBBbmd1bGFyIHNwZWNpZmljIHByb2dyYW0gdGhhdCBjb250YWlucyB0aGUgQW5ndWxhciBjb21waWxlclxuICAgICAgICBjb25zdCBhbmd1bGFyUHJvZ3JhbSA9IG5ldyBjb21waWxlckNsaS5OZ3RzY1Byb2dyYW0ocm9vdE5hbWVzLCBjb21waWxlck9wdGlvbnMsIGhvc3QpO1xuICAgICAgICBjb25zdCBhbmd1bGFyQ29tcGlsZXIgPSBhbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgICAgICAgY29uc3QgeyBpZ25vcmVGb3JEaWFnbm9zdGljcywgaWdub3JlRm9yRW1pdCB9ID0gYW5ndWxhckNvbXBpbGVyO1xuICAgICAgICBjb25zdCB0eXBlU2NyaXB0UHJvZ3JhbSA9IGFuZ3VsYXJQcm9ncmFtLmdldFRzUHJvZ3JhbSgpO1xuXG4gICAgICAgIGNvbnN0IGJ1aWxkZXIgPSB0cy5jcmVhdGVBYnN0cmFjdEJ1aWxkZXIodHlwZVNjcmlwdFByb2dyYW0sIGhvc3QpO1xuXG4gICAgICAgIGF3YWl0IGFuZ3VsYXJDb21waWxlci5hbmFseXplQXN5bmMoKTtcblxuICAgICAgICBmdW5jdGlvbiogY29sbGVjdERpYWdub3N0aWNzKCkge1xuICAgICAgICAgIC8vIENvbGxlY3QgcHJvZ3JhbSBsZXZlbCBkaWFnbm9zdGljc1xuICAgICAgICAgIHlpZWxkKiBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3M7XG4gICAgICAgICAgeWllbGQqIGFuZ3VsYXJDb21waWxlci5nZXRPcHRpb25EaWFnbm9zdGljcygpO1xuICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldE9wdGlvbnNEaWFnbm9zdGljcygpO1xuICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldEdsb2JhbERpYWdub3N0aWNzKCk7XG5cbiAgICAgICAgICAvLyBDb2xsZWN0IHNvdXJjZSBmaWxlIHNwZWNpZmljIGRpYWdub3N0aWNzXG4gICAgICAgICAgY29uc3QgT3B0aW1pemVGb3IgPSBjb21waWxlckNsaS5PcHRpbWl6ZUZvcjtcbiAgICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgYnVpbGRlci5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICAgICAgICBpZiAoaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB5aWVsZCogYnVpbGRlci5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlKTtcbiAgICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc291cmNlRmlsZSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGFuZ3VsYXJEaWFnbm9zdGljcyA9IGFuZ3VsYXJDb21waWxlci5nZXREaWFnbm9zdGljc0ZvckZpbGUoXG4gICAgICAgICAgICAgIHNvdXJjZUZpbGUsXG4gICAgICAgICAgICAgIE9wdGltaXplRm9yLldob2xlUHJvZ3JhbSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB5aWVsZCogYW5ndWxhckRpYWdub3N0aWNzO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgZGlhZ25vc3RpYyBvZiBjb2xsZWN0RGlhZ25vc3RpY3MoKSkge1xuICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWMoZGlhZ25vc3RpYywgaG9zdCk7XG4gICAgICAgICAgaWYgKGRpYWdub3N0aWMuY2F0ZWdvcnkgPT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcikge1xuICAgICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaChtZXNzYWdlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmaWxlRW1pdHRlciA9IGNyZWF0ZUZpbGVFbWl0dGVyKFxuICAgICAgICAgIGJ1aWxkZXIsXG4gICAgICAgICAgbWVyZ2VUcmFuc2Zvcm1lcnMoYW5ndWxhckNvbXBpbGVyLnByZXBhcmVFbWl0KCkudHJhbnNmb3JtZXJzLCB7XG4gICAgICAgICAgICBiZWZvcmU6IFtyZXBsYWNlQm9vdHN0cmFwKCgpID0+IGJ1aWxkZXIuZ2V0UHJvZ3JhbSgpLmdldFR5cGVDaGVja2VyKCkpXSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICAoKSA9PiBbXSxcbiAgICAgICAgKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZChcbiAgICAgICAgeyBmaWx0ZXI6IGNvbXBpbGVyT3B0aW9ucy5hbGxvd0pzID8gL1xcLltjbV0/W2p0XXN4PyQvIDogL1xcLltjbV0/dHN4PyQvIH0sXG4gICAgICAgIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgICAgYXNzZXJ0Lm9rKGZpbGVFbWl0dGVyLCAnSW52YWxpZCBwbHVnaW4gZXhlY3V0aW9uIG9yZGVyJyk7XG5cbiAgICAgICAgICBjb25zdCB0eXBlc2NyaXB0UmVzdWx0ID0gYXdhaXQgZmlsZUVtaXR0ZXIoYXJncy5wYXRoKTtcbiAgICAgICAgICBpZiAoIXR5cGVzY3JpcHRSZXN1bHQpIHtcbiAgICAgICAgICAgIC8vIE5vIFRTIHJlc3VsdCBpbmRpY2F0ZXMgdGhlIGZpbGUgaXMgbm90IHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvZ3JhbS5cbiAgICAgICAgICAgIC8vIElmIGFsbG93SnMgaXMgZW5hYmxlZCBhbmQgdGhlIGZpbGUgaXMgSlMgdGhlbiBkZWZlciB0byB0aGUgbmV4dCBsb2FkIGhvb2suXG4gICAgICAgICAgICBpZiAoY29tcGlsZXJPcHRpb25zLmFsbG93SnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KGFyZ3MucGF0aCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gT3RoZXJ3aXNlIHJldHVybiBhbiBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgdGV4dDogJ0ZpbGUgaXMgbWlzc2luZyBmcm9tIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uLicsXG4gICAgICAgICAgICAgICAgICBsb2NhdGlvbjogeyBmaWxlOiBhcmdzLnBhdGggfSxcbiAgICAgICAgICAgICAgICAgIG5vdGVzOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiBgRW5zdXJlIHRoZSBmaWxlIGlzIHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvZ3JhbSB2aWEgdGhlICdmaWxlcycgb3IgJ2luY2x1ZGUnIHByb3BlcnR5LmAsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGRhdGEgPSB0eXBlc2NyaXB0UmVzdWx0LmNvbnRlbnQgPz8gJyc7XG4gICAgICAgICAgY29uc3QgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uID0gL2Zvclxccythd2FpdFxccypcXCh8YXN5bmNcXHMrZnVuY3Rpb25cXHMqXFwqLy50ZXN0KGRhdGEpO1xuICAgICAgICAgIGNvbnN0IHVzZUlucHV0U291cmNlbWFwID1cbiAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlbWFwICYmXG4gICAgICAgICAgICAoISFwbHVnaW5PcHRpb25zLnRoaXJkUGFydHlTb3VyY2VtYXBzIHx8ICEvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vLnRlc3QoYXJncy5wYXRoKSk7XG5cbiAgICAgICAgICAvLyBJZiBubyBhZGRpdGlvbmFsIHRyYW5zZm9ybWF0aW9ucyBhcmUgbmVlZGVkLCByZXR1cm4gdGhlIFR5cGVTY3JpcHQgb3V0cHV0IGRpcmVjdGx5XG4gICAgICAgICAgaWYgKCFmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24gJiYgIXBsdWdpbk9wdGlvbnMuYWR2YW5jZWRPcHRpbWl6YXRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAvLyBTdHJpcCBzb3VyY2VtYXBzIGlmIHRoZXkgc2hvdWxkIG5vdCBiZSB1c2VkXG4gICAgICAgICAgICAgIGNvbnRlbnRzOiB1c2VJbnB1dFNvdXJjZW1hcFxuICAgICAgICAgICAgICAgID8gZGF0YVxuICAgICAgICAgICAgICAgIDogZGF0YS5yZXBsYWNlKC9eXFwvXFwvIyBzb3VyY2VNYXBwaW5nVVJMPVteXFxyXFxuXSovZ20sICcnKSxcbiAgICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBiYWJlbFJlc3VsdCA9IGF3YWl0IHRyYW5zZm9ybUFzeW5jKGRhdGEsIHtcbiAgICAgICAgICAgIGZpbGVuYW1lOiBhcmdzLnBhdGgsXG4gICAgICAgICAgICBpbnB1dFNvdXJjZU1hcDogKHVzZUlucHV0U291cmNlbWFwID8gdW5kZWZpbmVkIDogZmFsc2UpIGFzIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHNvdXJjZU1hcHM6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwID8gJ2lubGluZScgOiBmYWxzZSxcbiAgICAgICAgICAgIGNvbXBhY3Q6IGZhbHNlLFxuICAgICAgICAgICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgICAgICAgICBiYWJlbHJjOiBmYWxzZSxcbiAgICAgICAgICAgIGJyb3dzZXJzbGlzdENvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgICAgICAgICAgcGx1Z2luczogW10sXG4gICAgICAgICAgICBwcmVzZXRzOiBbXG4gICAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgICBhbmd1bGFyQXBwbGljYXRpb25QcmVzZXQsXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uLFxuICAgICAgICAgICAgICAgICAgb3B0aW1pemU6IHBsdWdpbk9wdGlvbnMuYWR2YW5jZWRPcHRpbWl6YXRpb25zICYmIHt9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNvbnRlbnRzOiBiYWJlbFJlc3VsdD8uY29kZSA/PyAnJyxcbiAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgKTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9qcyQvIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBmcy5yZWFkRmlsZShhcmdzLnBhdGgsICd1dGYtOCcpO1xuICAgICAgICBjb25zdCBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24gPVxuICAgICAgICAgICEvW1xcXFwvXVtfZl0/ZXNtMjAxNVtcXFxcL10vLnRlc3QoYXJncy5wYXRoKSAmJlxuICAgICAgICAgIC9mb3JcXHMrYXdhaXRcXHMqXFwofGFzeW5jXFxzK2Z1bmN0aW9uXFxzKlxcKi8udGVzdChkYXRhKTtcbiAgICAgICAgY29uc3Qgc2hvdWxkTGluayA9IGF3YWl0IHJlcXVpcmVzTGlua2luZyhhcmdzLnBhdGgsIGRhdGEpO1xuICAgICAgICBjb25zdCB1c2VJbnB1dFNvdXJjZW1hcCA9XG4gICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAgJiZcbiAgICAgICAgICAoISFwbHVnaW5PcHRpb25zLnRoaXJkUGFydHlTb3VyY2VtYXBzIHx8ICEvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vLnRlc3QoYXJncy5wYXRoKSk7XG5cbiAgICAgICAgLy8gSWYgbm8gYWRkaXRpb25hbCB0cmFuc2Zvcm1hdGlvbnMgYXJlIG5lZWRlZCwgcmV0dXJuIHRoZSBUeXBlU2NyaXB0IG91dHB1dCBkaXJlY3RseVxuICAgICAgICBpZiAoIWZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbiAmJiAhcGx1Z2luT3B0aW9ucy5hZHZhbmNlZE9wdGltaXphdGlvbnMgJiYgIXNob3VsZExpbmspIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLy8gU3RyaXAgc291cmNlbWFwcyBpZiB0aGV5IHNob3VsZCBub3QgYmUgdXNlZFxuICAgICAgICAgICAgY29udGVudHM6IHVzZUlucHV0U291cmNlbWFwXG4gICAgICAgICAgICAgID8gZGF0YVxuICAgICAgICAgICAgICA6IGRhdGEucmVwbGFjZSgvXlxcL1xcLyMgc291cmNlTWFwcGluZ1VSTD1bXlxcclxcbl0qL2dtLCAnJyksXG4gICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFuZ3VsYXJQYWNrYWdlID0gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dQGFuZ3VsYXJbXFxcXC9dLy50ZXN0KGFyZ3MucGF0aCk7XG5cbiAgICAgICAgY29uc3QgbGlua2VyUGx1Z2luQ3JlYXRvciA9IChcbiAgICAgICAgICBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKT4oXG4gICAgICAgICAgICAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcsXG4gICAgICAgICAgKVxuICAgICAgICApLmNyZWF0ZUVzMjAxNUxpbmtlclBsdWdpbjtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1Bc3luYyhkYXRhLCB7XG4gICAgICAgICAgZmlsZW5hbWU6IGFyZ3MucGF0aCxcbiAgICAgICAgICBpbnB1dFNvdXJjZU1hcDogKHVzZUlucHV0U291cmNlbWFwID8gdW5kZWZpbmVkIDogZmFsc2UpIGFzIHVuZGVmaW5lZCxcbiAgICAgICAgICBzb3VyY2VNYXBzOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCA/ICdpbmxpbmUnIDogZmFsc2UsXG4gICAgICAgICAgY29tcGFjdDogZmFsc2UsXG4gICAgICAgICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgICAgICAgYmFiZWxyYzogZmFsc2UsXG4gICAgICAgICAgYnJvd3NlcnNsaXN0Q29uZmlnRmlsZTogZmFsc2UsXG4gICAgICAgICAgcGx1Z2luczogW10sXG4gICAgICAgICAgcHJlc2V0czogW1xuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICBhbmd1bGFyQXBwbGljYXRpb25QcmVzZXQsXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBhbmd1bGFyTGlua2VyOiB7XG4gICAgICAgICAgICAgICAgICBzaG91bGRMaW5rLFxuICAgICAgICAgICAgICAgICAgaml0TW9kZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICBsaW5rZXJQbHVnaW5DcmVhdG9yLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uLFxuICAgICAgICAgICAgICAgIG9wdGltaXplOiBwbHVnaW5PcHRpb25zLmFkdmFuY2VkT3B0aW1pemF0aW9ucyAmJiB7XG4gICAgICAgICAgICAgICAgICBsb29zZUVudW1zOiBhbmd1bGFyUGFja2FnZSxcbiAgICAgICAgICAgICAgICAgIHB1cmVUb3BMZXZlbDogYW5ndWxhclBhY2thZ2UsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50czogcmVzdWx0Py5jb2RlID8/IGRhdGEsXG4gICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICB9O1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uRW5kKChyZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLmxlbmd0aCkge1xuICAgICAgICAgIHJlc3VsdC5vdXRwdXRGaWxlcz8ucHVzaCguLi5zdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUZpbGVFbWl0dGVyKFxuICBwcm9ncmFtOiB0cy5CdWlsZGVyUHJvZ3JhbSxcbiAgdHJhbnNmb3JtZXJzOiB0cy5DdXN0b21UcmFuc2Zvcm1lcnMgPSB7fSxcbiAgb25BZnRlckVtaXQ/OiAoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSkgPT4gdm9pZCxcbik6IEZpbGVFbWl0dGVyIHtcbiAgcmV0dXJuIGFzeW5jIChmaWxlOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBzb3VyY2VGaWxlID0gcHJvZ3JhbS5nZXRTb3VyY2VGaWxlKGZpbGUpO1xuICAgIGlmICghc291cmNlRmlsZSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBsZXQgY29udGVudDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIHByb2dyYW0uZW1pdChcbiAgICAgIHNvdXJjZUZpbGUsXG4gICAgICAoZmlsZW5hbWUsIGRhdGEpID0+IHtcbiAgICAgICAgaWYgKC9cXC5bY21dP2pzJC8udGVzdChmaWxlbmFtZSkpIHtcbiAgICAgICAgICBjb250ZW50ID0gZGF0YTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHVuZGVmaW5lZCAvKiBjYW5jZWxsYXRpb25Ub2tlbiAqLyxcbiAgICAgIHVuZGVmaW5lZCAvKiBlbWl0T25seUR0c0ZpbGVzICovLFxuICAgICAgdHJhbnNmb3JtZXJzLFxuICAgICk7XG5cbiAgICBvbkFmdGVyRW1pdD8uKHNvdXJjZUZpbGUpO1xuXG4gICAgcmV0dXJuIHsgY29udGVudCwgZGVwZW5kZW5jaWVzOiBbXSB9O1xuICB9O1xufVxuIl19