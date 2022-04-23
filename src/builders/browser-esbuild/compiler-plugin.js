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
            const { createAotTransformers, mergeTransformers, } = require('@ngtools/webpack/src/ivy/transformation');
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
            build.onStart(async () => {
                var _a, _b;
                const result = {};
                // Create TypeScript compiler host
                const host = typescript_1.default.createIncrementalCompilerHost(compilerOptions);
                // Temporarily add a readResource hook to allow for a transformResource hook.
                // Once the AOT compiler allows only a transformResource hook this can be removed.
                host.readResource = function (fileName) {
                    var _a;
                    // Provide same no file found behavior as @ngtools/webpack
                    return (_a = this.readFile(fileName)) !== null && _a !== void 0 ? _a : '';
                };
                // Add an AOT compiler resource transform hook
                host.transformResource = async function (data, context) {
                    var _a, _b, _c;
                    // Only style resources are transformed currently
                    if (context.type !== 'style') {
                        return null;
                    }
                    // The file with the resource content will either be an actual file (resourceFile)
                    // or the file containing the inline component style text (containingFile).
                    const file = (_a = context.resourceFile) !== null && _a !== void 0 ? _a : context.containingFile;
                    const { contents, errors, warnings } = await (0, stylesheets_1.bundleStylesheetText)(data, {
                        resolvePath: path.dirname(file),
                        virtualName: file,
                    }, styleOptions);
                    ((_b = result.errors) !== null && _b !== void 0 ? _b : (result.errors = [])).push(...errors);
                    ((_c = result.warnings) !== null && _c !== void 0 ? _c : (result.warnings = [])).push(...warnings);
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
                fileEmitter = createFileEmitter(builder, mergeTransformers(angularCompiler.prepareEmit().transformers, createAotTransformers(builder, {})), () => []);
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
                const babelResult = await (0, core_1.transformAsync)(data, {
                    filename: args.path,
                    inputSourceMap: (pluginOptions.sourcemap ? undefined : false),
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
                                forceAsyncTransformation: data.includes('async'),
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
                const angularPackage = /[\\/]node_modules[\\/]@angular[\\/]/.test(args.path);
                const linkerPluginCreator = (await (0, load_esm_1.loadEsmModule)('@angular/compiler-cli/linker/babel')).createEs2015LinkerPlugin;
                const data = await fs_1.promises.readFile(args.path, 'utf-8');
                const result = await (0, core_1.transformAsync)(data, {
                    filename: args.path,
                    inputSourceMap: (pluginOptions.sourcemap ? undefined : false),
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
                                    shouldLink: await (0, webpack_loader_1.requiresLinking)(args.path, data),
                                    jitMode: false,
                                    linkerPluginCreator,
                                },
                                forceAsyncTransformation: !/[\\/][_f]?esm2015[\\/]/.test(args.path) && data.includes('async'),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILHNDQUE2QztBQUM3QywrQ0FBaUM7QUFFakMsMkJBQW9DO0FBQ3BDLDJDQUE2QjtBQUM3Qiw0REFBNEI7QUFDNUIsa0ZBQXVFO0FBQ3ZFLCtEQUE2RDtBQUM3RCxtREFBcUQ7QUFDckQsK0NBQThFO0FBVTlFOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLCtCQUErQixDQUN0QyxJQUFxQyxFQUNyQyxJQUE4QixFQUM5QixVQUFtQjtJQUVuQixJQUFJLElBQUksR0FBRyxvQkFBRSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDaEYsSUFBSSxVQUFVLEVBQUU7UUFDZCxJQUFJLEdBQUcsVUFBVSxHQUFHLElBQUksQ0FBQztLQUMxQjtJQUVELE1BQU0sSUFBSSxHQUFnQixFQUFFLElBQUksRUFBRSxDQUFDO0lBRW5DLElBQUksSUFBSSxDQUFDLElBQUksRUFBRTtRQUNiLElBQUksQ0FBQyxRQUFRLEdBQUc7WUFDZCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRO1lBQ3hCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtTQUNwQixDQUFDO1FBRUYsNEZBQTRGO1FBQzVGLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNkLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEdBQUcsb0JBQUUsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElB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REE0UUM7QUFFRCxTQUFTLGlCQUFpQixDQUN4QixPQUEwQixFQUMxQixlQUFzQyxFQUFFLEVBQ3hDLFdBQWlEO0lBRWpELE9BQU8sS0FBSyxFQUFFLElBQVksRUFBRSxFQUFFO1FBQzVCLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNmLE9BQU8sU0FBUyxDQUFDO1NBQ2xCO1FBRUQsSUFBSSxPQUEyQixDQUFDO1FBQ2hDLE9BQU8sQ0FBQyxJQUFJLENBQ1YsVUFBVSxFQUNWLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxFQUFFO1lBQ2pCLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDL0IsT0FBTyxHQUFHLElBQUksQ0FBQzthQUNoQjtRQUNILENBQUMsRUFDRCxTQUFTLENBQUMsdUJBQXVCLEVBQ2pDLFNBQVMsQ0FBQyxzQkFBc0IsRUFDaEMsWUFBWSxDQUNiLENBQUM7UUFFRixXQUFXLGFBQVgsV0FBVyx1QkFBWCxXQUFXLENBQUcsVUFBVSxDQUFDLENBQUM7UUFFMUIsT0FBTyxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsRUFBRSxFQUFFLENBQUM7SUFDdkMsQ0FBQyxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IENvbXBpbGVySG9zdCB9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaSc7XG5pbXBvcnQgeyB0cmFuc2Zvcm1Bc3luYyB9IGZyb20gJ0BiYWJlbC9jb3JlJztcbmltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHR5cGUgeyBPblN0YXJ0UmVzdWx0LCBQYXJ0aWFsTWVzc2FnZSwgUGFydGlhbE5vdGUsIFBsdWdpbiwgUGx1Z2luQnVpbGQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IHByb21pc2VzIGFzIGZzIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCBhbmd1bGFyQXBwbGljYXRpb25QcmVzZXQgZnJvbSAnLi4vLi4vYmFiZWwvcHJlc2V0cy9hcHBsaWNhdGlvbic7XG5pbXBvcnQgeyByZXF1aXJlc0xpbmtpbmcgfSBmcm9tICcuLi8uLi9iYWJlbC93ZWJwYWNrLWxvYWRlcic7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHsgQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsIGJ1bmRsZVN0eWxlc2hlZXRUZXh0IH0gZnJvbSAnLi9zdHlsZXNoZWV0cyc7XG5cbmludGVyZmFjZSBFbWl0RmlsZVJlc3VsdCB7XG4gIGNvbnRlbnQ/OiBzdHJpbmc7XG4gIG1hcD86IHN0cmluZztcbiAgZGVwZW5kZW5jaWVzOiByZWFkb25seSBzdHJpbmdbXTtcbiAgaGFzaD86IFVpbnQ4QXJyYXk7XG59XG50eXBlIEZpbGVFbWl0dGVyID0gKGZpbGU6IHN0cmluZykgPT4gUHJvbWlzZTxFbWl0RmlsZVJlc3VsdCB8IHVuZGVmaW5lZD47XG5cbi8qKlxuICogQ29udmVydHMgVHlwZVNjcmlwdCBEaWFnbm9zdGljIHJlbGF0ZWQgaW5mb3JtYXRpb24gaW50byBhbiBlc2J1aWxkIGNvbXBhdGlibGUgbm90ZSBvYmplY3QuXG4gKiBSZWxhdGVkIGluZm9ybWF0aW9uIGlzIGEgc3Vic2V0IG9mIGEgZnVsbCBUeXBlU2NyaXB0IERpYWdub3N0aWMgYW5kIGFsc28gdXNlZCBmb3IgZGlhZ25vc3RpY1xuICogbm90ZXMgYXNzb2NpYXRlZCB3aXRoIHRoZSBtYWluIERpYWdub3N0aWMuXG4gKiBAcGFyYW0gZGlhZ25vc3RpYyBUaGUgVHlwZVNjcmlwdCBkaWFnbm9zdGljIHJlbGF0aXZlIGluZm9ybWF0aW9uIHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0gaG9zdCBBIFR5cGVTY3JpcHQgRm9ybWF0RGlhZ25vc3RpY3NIb3N0IGluc3RhbmNlIHRvIHVzZSBkdXJpbmcgY29udmVyc2lvbi5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgZGlhZ25vc3RpYyBtZXNzYWdlIGFzIGEgUGFydGlhbE1lc3NhZ2Ugb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oXG4gIGluZm86IHRzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24sXG4gIGhvc3Q6IHRzLkZvcm1hdERpYWdub3N0aWNzSG9zdCxcbiAgdGV4dFByZWZpeD86IHN0cmluZyxcbik6IFBhcnRpYWxOb3RlIHtcbiAgbGV0IHRleHQgPSB0cy5mbGF0dGVuRGlhZ25vc3RpY01lc3NhZ2VUZXh0KGluZm8ubWVzc2FnZVRleHQsIGhvc3QuZ2V0TmV3TGluZSgpKTtcbiAgaWYgKHRleHRQcmVmaXgpIHtcbiAgICB0ZXh0ID0gdGV4dFByZWZpeCArIHRleHQ7XG4gIH1cblxuICBjb25zdCBub3RlOiBQYXJ0aWFsTm90ZSA9IHsgdGV4dCB9O1xuXG4gIGlmIChpbmZvLmZpbGUpIHtcbiAgICBub3RlLmxvY2F0aW9uID0ge1xuICAgICAgZmlsZTogaW5mby5maWxlLmZpbGVOYW1lLFxuICAgICAgbGVuZ3RoOiBpbmZvLmxlbmd0aCxcbiAgICB9O1xuXG4gICAgLy8gQ2FsY3VsYXRlIHRoZSBsaW5lL2NvbHVtbiBsb2NhdGlvbiBhbmQgZXh0cmFjdCB0aGUgZnVsbCBsaW5lIHRleHQgdGhhdCBoYXMgdGhlIGRpYWdub3N0aWNcbiAgICBpZiAoaW5mby5zdGFydCkge1xuICAgICAgY29uc3QgeyBsaW5lLCBjaGFyYWN0ZXIgfSA9IHRzLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKGluZm8uZmlsZSwgaW5mby5zdGFydCk7XG4gICAgICBub3RlLmxvY2F0aW9uLmxpbmUgPSBsaW5lICsgMTtcbiAgICAgIG5vdGUubG9jYXRpb24uY29sdW1uID0gY2hhcmFjdGVyO1xuXG4gICAgICAvLyBUaGUgc3RhcnQgcG9zaXRpb24gZm9yIHRoZSBzbGljZSBpcyB0aGUgZmlyc3QgY2hhcmFjdGVyIG9mIHRoZSBlcnJvciBsaW5lXG4gICAgICBjb25zdCBsaW5lU3RhcnRQb3NpdGlvbiA9IHRzLmdldFBvc2l0aW9uT2ZMaW5lQW5kQ2hhcmFjdGVyKGluZm8uZmlsZSwgbGluZSwgMCk7XG5cbiAgICAgIC8vIFRoZSBlbmQgcG9zaXRpb24gZm9yIHRoZSBzbGljZSBpcyB0aGUgZmlyc3QgY2hhcmFjdGVyIG9mIHRoZSBuZXh0IGxpbmUgb3IgdGhlIGxlbmd0aCBvZlxuICAgICAgLy8gdGhlIGVudGlyZSBmaWxlIGlmIHRoZSBsaW5lIGlzIHRoZSBsYXN0IGxpbmUgb2YgdGhlIGZpbGUgKGdldFBvc2l0aW9uT2ZMaW5lQW5kQ2hhcmFjdGVyXG4gICAgICAvLyB3aWxsIGVycm9yIGlmIGEgbm9uZXhpc3RlbnQgbGluZSBpcyBwYXNzZWQpLlxuICAgICAgY29uc3QgeyBsaW5lOiBsYXN0TGluZU9mRmlsZSB9ID0gdHMuZ2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24oXG4gICAgICAgIGluZm8uZmlsZSxcbiAgICAgICAgaW5mby5maWxlLnRleHQubGVuZ3RoIC0gMSxcbiAgICAgICk7XG4gICAgICBjb25zdCBsaW5lRW5kUG9zaXRpb24gPVxuICAgICAgICBsaW5lIDwgbGFzdExpbmVPZkZpbGVcbiAgICAgICAgICA/IHRzLmdldFBvc2l0aW9uT2ZMaW5lQW5kQ2hhcmFjdGVyKGluZm8uZmlsZSwgbGluZSArIDEsIDApXG4gICAgICAgICAgOiBpbmZvLmZpbGUudGV4dC5sZW5ndGg7XG5cbiAgICAgIG5vdGUubG9jYXRpb24ubGluZVRleHQgPSBpbmZvLmZpbGUudGV4dC5zbGljZShsaW5lU3RhcnRQb3NpdGlvbiwgbGluZUVuZFBvc2l0aW9uKS50cmltRW5kKCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5vdGU7XG59XG5cbi8qKlxuICogQ29udmVydHMgYSBUeXBlU2NyaXB0IERpYWdub3N0aWMgbWVzc2FnZSBpbnRvIGFuIGVzYnVpbGQgY29tcGF0aWJsZSBtZXNzYWdlIG9iamVjdC5cbiAqIEBwYXJhbSBkaWFnbm9zdGljIFRoZSBUeXBlU2NyaXB0IGRpYWdub3N0aWMgdG8gY29udmVydC5cbiAqIEBwYXJhbSBob3N0IEEgVHlwZVNjcmlwdCBGb3JtYXREaWFnbm9zdGljc0hvc3QgaW5zdGFuY2UgdG8gdXNlIGR1cmluZyBjb252ZXJzaW9uLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBkaWFnbm9zdGljIG1lc3NhZ2UgYXMgYSBQYXJ0aWFsTWVzc2FnZSBvYmplY3RcbiAqL1xuZnVuY3Rpb24gY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljKFxuICBkaWFnbm9zdGljOiB0cy5EaWFnbm9zdGljLFxuICBob3N0OiB0cy5Gb3JtYXREaWFnbm9zdGljc0hvc3QsXG4pOiBQYXJ0aWFsTWVzc2FnZSB7XG4gIGxldCBjb2RlUHJlZml4ID0gJ1RTJztcbiAgbGV0IGNvZGUgPSBgJHtkaWFnbm9zdGljLmNvZGV9YDtcbiAgaWYgKGRpYWdub3N0aWMuc291cmNlID09PSAnbmd0c2MnKSB7XG4gICAgY29kZVByZWZpeCA9ICdORyc7XG4gICAgLy8gUmVtb3ZlIGAtOTlgIEFuZ3VsYXIgcHJlZml4IGZyb20gZGlhZ25vc3RpYyBjb2RlXG4gICAgY29kZSA9IGNvZGUuc2xpY2UoMyk7XG4gIH1cblxuICBjb25zdCBtZXNzYWdlOiBQYXJ0aWFsTWVzc2FnZSA9IHtcbiAgICAuLi5jb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWNJbmZvKGRpYWdub3N0aWMsIGhvc3QsIGAke2NvZGVQcmVmaXh9JHtjb2RlfTogYCksXG4gICAgLy8gU3RvcmUgb3JpZ2luYWwgZGlhZ25vc3RpYyBmb3IgcmVmZXJlbmNlIGlmIG5lZWRlZCBkb3duc3RyZWFtXG4gICAgZGV0YWlsOiBkaWFnbm9zdGljLFxuICB9O1xuXG4gIGlmIChkaWFnbm9zdGljLnJlbGF0ZWRJbmZvcm1hdGlvbj8ubGVuZ3RoKSB7XG4gICAgbWVzc2FnZS5ub3RlcyA9IGRpYWdub3N0aWMucmVsYXRlZEluZm9ybWF0aW9uLm1hcCgoaW5mbykgPT5cbiAgICAgIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oaW5mbywgaG9zdCksXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBtZXNzYWdlO1xufVxuXG4vLyBUaGlzIGlzIGEgbm9uLXdhdGNoIHZlcnNpb24gb2YgdGhlIGNvbXBpbGVyIGNvZGUgZnJvbSBgQG5ndG9vbHMvd2VicGFja2AgYXVnbWVudGVkIGZvciBlc2J1aWxkXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICBwbHVnaW5PcHRpb25zOiB7IHNvdXJjZW1hcDogYm9vbGVhbjsgdHNjb25maWc6IHN0cmluZzsgYWR2YW5jZWRPcHRpbWl6YXRpb25zPzogYm9vbGVhbiB9LFxuICBzdHlsZU9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLFxuKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1jb21waWxlcicsXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbiAgICBhc3luYyBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgIC8vIFRoaXMgdXNlcyBhIHdyYXBwZWQgZHluYW1pYyBpbXBvcnQgdG8gbG9hZCBgQGFuZ3VsYXIvY29tcGlsZXItY2xpYCB3aGljaCBpcyBFU00uXG4gICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3IgcmV0YWluaW5nIGR5bmFtaWMgaW1wb3J0cyB0aGlzIHdvcmthcm91bmQgY2FuIGJlIGRyb3BwZWQuXG4gICAgICBjb25zdCBjb21waWxlckNsaSA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk+KFxuICAgICAgICAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJyxcbiAgICAgICk7XG5cbiAgICAgIC8vIFRlbXBvcmFyeSBkZWVwIGltcG9ydCBmb3IgdHJhbnNmb3JtZXIgc3VwcG9ydFxuICAgICAgY29uc3Qge1xuICAgICAgICBjcmVhdGVBb3RUcmFuc2Zvcm1lcnMsXG4gICAgICAgIG1lcmdlVHJhbnNmb3JtZXJzLFxuICAgICAgfSA9IHJlcXVpcmUoJ0BuZ3Rvb2xzL3dlYnBhY2svc3JjL2l2eS90cmFuc2Zvcm1hdGlvbicpO1xuXG4gICAgICAvLyBTZXR1cCBkZWZpbmVzIGJhc2VkIG9uIHRoZSB2YWx1ZXMgcHJvdmlkZWQgYnkgdGhlIEFuZ3VsYXIgY29tcGlsZXItY2xpXG4gICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUgPz89IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29tcGlsZXJDbGkuR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCkpIHtcbiAgICAgICAgaWYgKGtleSBpbiBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUpIHtcbiAgICAgICAgICAvLyBTa2lwIGtleXMgdGhhdCBoYXZlIGJlZW4gbWFudWFsbHkgcHJvdmlkZWRcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBlc2J1aWxkIHJlcXVpcmVzIHZhbHVlcyB0byBiZSBhIHN0cmluZyAoYWN0dWFsIHN0cmluZ3MgbmVlZCB0byBiZSBxdW90ZWQpLlxuICAgICAgICAvLyBJbiB0aGlzIGNhc2UsIGFsbCBwcm92aWRlZCB2YWx1ZXMgYXJlIGJvb2xlYW5zLlxuICAgICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmVba2V5XSA9IHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSB0c2NvbmZpZyBpcyBsb2FkZWQgaW4gc2V0dXAgaW5zdGVhZCBvZiBpbiBzdGFydCB0byBhbGxvdyB0aGUgZXNidWlsZCB0YXJnZXQgYnVpbGQgb3B0aW9uIHRvIGJlIG1vZGlmaWVkLlxuICAgICAgLy8gZXNidWlsZCBidWlsZCBvcHRpb25zIGNhbiBvbmx5IGJlIG1vZGlmaWVkIGluIHNldHVwIHByaW9yIHRvIHN0YXJ0aW5nIHRoZSBidWlsZC5cbiAgICAgIGNvbnN0IHtcbiAgICAgICAgb3B0aW9uczogY29tcGlsZXJPcHRpb25zLFxuICAgICAgICByb290TmFtZXMsXG4gICAgICAgIGVycm9yczogY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgICAgfSA9IGNvbXBpbGVyQ2xpLnJlYWRDb25maWd1cmF0aW9uKHBsdWdpbk9wdGlvbnMudHNjb25maWcsIHtcbiAgICAgICAgZW5hYmxlSXZ5OiB0cnVlLFxuICAgICAgICBub0VtaXRPbkVycm9yOiBmYWxzZSxcbiAgICAgICAgc3VwcHJlc3NPdXRwdXRQYXRoQ2hlY2s6IHRydWUsXG4gICAgICAgIG91dERpcjogdW5kZWZpbmVkLFxuICAgICAgICBpbmxpbmVTb3VyY2VzOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgaW5saW5lU291cmNlTWFwOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcbiAgICAgICAgbWFwUm9vdDogdW5kZWZpbmVkLFxuICAgICAgICBzb3VyY2VSb290OiB1bmRlZmluZWQsXG4gICAgICAgIGRlY2xhcmF0aW9uOiBmYWxzZSxcbiAgICAgICAgZGVjbGFyYXRpb25NYXA6IGZhbHNlLFxuICAgICAgICBhbGxvd0VtcHR5Q29kZWdlbkZpbGVzOiBmYWxzZSxcbiAgICAgICAgYW5ub3RhdGlvbnNBczogJ2RlY29yYXRvcnMnLFxuICAgICAgICBlbmFibGVSZXNvdXJjZUlubGluaW5nOiBmYWxzZSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBBZGp1c3QgdGhlIGVzYnVpbGQgb3V0cHV0IHRhcmdldCBiYXNlZCBvbiB0aGUgdHNjb25maWcgdGFyZ2V0XG4gICAgICBpZiAoXG4gICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICBjb21waWxlck9wdGlvbnMudGFyZ2V0IDw9IHRzLlNjcmlwdFRhcmdldC5FUzIwMTVcbiAgICAgICkge1xuICAgICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy50YXJnZXQgPSAnZXMyMDE1JztcbiAgICAgIH0gZWxzZSBpZiAoY29tcGlsZXJPcHRpb25zLnRhcmdldCA+PSB0cy5TY3JpcHRUYXJnZXQuRVNOZXh0KSB7XG4gICAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLnRhcmdldCA9ICdlc25leHQnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMudGFyZ2V0ID0gdHMuU2NyaXB0VGFyZ2V0W2NvbXBpbGVyT3B0aW9ucy50YXJnZXRdLnRvTG93ZXJDYXNlKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSBmaWxlIGVtaXR0ZXIgY3JlYXRlZCBkdXJpbmcgYG9uU3RhcnRgIHRoYXQgd2lsbCBiZSB1c2VkIGR1cmluZyB0aGUgYnVpbGQgaW4gYG9uTG9hZGAgY2FsbGJhY2tzIGZvciBUUyBmaWxlc1xuICAgICAgbGV0IGZpbGVFbWl0dGVyOiBGaWxlRW1pdHRlciB8IHVuZGVmaW5lZDtcblxuICAgICAgYnVpbGQub25TdGFydChhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogT25TdGFydFJlc3VsdCA9IHt9O1xuXG4gICAgICAgIC8vIENyZWF0ZSBUeXBlU2NyaXB0IGNvbXBpbGVyIGhvc3RcbiAgICAgICAgY29uc3QgaG9zdCA9IHRzLmNyZWF0ZUluY3JlbWVudGFsQ29tcGlsZXJIb3N0KGNvbXBpbGVyT3B0aW9ucyk7XG5cbiAgICAgICAgLy8gVGVtcG9yYXJpbHkgYWRkIGEgcmVhZFJlc291cmNlIGhvb2sgdG8gYWxsb3cgZm9yIGEgdHJhbnNmb3JtUmVzb3VyY2UgaG9vay5cbiAgICAgICAgLy8gT25jZSB0aGUgQU9UIGNvbXBpbGVyIGFsbG93cyBvbmx5IGEgdHJhbnNmb3JtUmVzb3VyY2UgaG9vayB0aGlzIGNhbiBiZSByZW1vdmVkLlxuICAgICAgICAoaG9zdCBhcyBDb21waWxlckhvc3QpLnJlYWRSZXNvdXJjZSA9IGZ1bmN0aW9uIChmaWxlTmFtZSkge1xuICAgICAgICAgIC8vIFByb3ZpZGUgc2FtZSBubyBmaWxlIGZvdW5kIGJlaGF2aW9yIGFzIEBuZ3Rvb2xzL3dlYnBhY2tcbiAgICAgICAgICByZXR1cm4gdGhpcy5yZWFkRmlsZShmaWxlTmFtZSkgPz8gJyc7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQWRkIGFuIEFPVCBjb21waWxlciByZXNvdXJjZSB0cmFuc2Zvcm0gaG9va1xuICAgICAgICAoaG9zdCBhcyBDb21waWxlckhvc3QpLnRyYW5zZm9ybVJlc291cmNlID0gYXN5bmMgZnVuY3Rpb24gKGRhdGEsIGNvbnRleHQpIHtcbiAgICAgICAgICAvLyBPbmx5IHN0eWxlIHJlc291cmNlcyBhcmUgdHJhbnNmb3JtZWQgY3VycmVudGx5XG4gICAgICAgICAgaWYgKGNvbnRleHQudHlwZSAhPT0gJ3N0eWxlJykge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gVGhlIGZpbGUgd2l0aCB0aGUgcmVzb3VyY2UgY29udGVudCB3aWxsIGVpdGhlciBiZSBhbiBhY3R1YWwgZmlsZSAocmVzb3VyY2VGaWxlKVxuICAgICAgICAgIC8vIG9yIHRoZSBmaWxlIGNvbnRhaW5pbmcgdGhlIGlubGluZSBjb21wb25lbnQgc3R5bGUgdGV4dCAoY29udGFpbmluZ0ZpbGUpLlxuICAgICAgICAgIGNvbnN0IGZpbGUgPSBjb250ZXh0LnJlc291cmNlRmlsZSA/PyBjb250ZXh0LmNvbnRhaW5pbmdGaWxlO1xuXG4gICAgICAgICAgY29uc3QgeyBjb250ZW50cywgZXJyb3JzLCB3YXJuaW5ncyB9ID0gYXdhaXQgYnVuZGxlU3R5bGVzaGVldFRleHQoXG4gICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICByZXNvbHZlUGF0aDogcGF0aC5kaXJuYW1lKGZpbGUpLFxuICAgICAgICAgICAgICB2aXJ0dWFsTmFtZTogZmlsZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaCguLi5lcnJvcnMpO1xuICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLndhcm5pbmdzKTtcblxuICAgICAgICAgIHJldHVybiB7IGNvbnRlbnQ6IGNvbnRlbnRzIH07XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQ3JlYXRlIHRoZSBBbmd1bGFyIHNwZWNpZmljIHByb2dyYW0gdGhhdCBjb250YWlucyB0aGUgQW5ndWxhciBjb21waWxlclxuICAgICAgICBjb25zdCBhbmd1bGFyUHJvZ3JhbSA9IG5ldyBjb21waWxlckNsaS5OZ3RzY1Byb2dyYW0ocm9vdE5hbWVzLCBjb21waWxlck9wdGlvbnMsIGhvc3QpO1xuICAgICAgICBjb25zdCBhbmd1bGFyQ29tcGlsZXIgPSBhbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgICAgICAgY29uc3QgeyBpZ25vcmVGb3JEaWFnbm9zdGljcywgaWdub3JlRm9yRW1pdCB9ID0gYW5ndWxhckNvbXBpbGVyO1xuICAgICAgICBjb25zdCB0eXBlU2NyaXB0UHJvZ3JhbSA9IGFuZ3VsYXJQcm9ncmFtLmdldFRzUHJvZ3JhbSgpO1xuXG4gICAgICAgIGNvbnN0IGJ1aWxkZXIgPSB0cy5jcmVhdGVBYnN0cmFjdEJ1aWxkZXIodHlwZVNjcmlwdFByb2dyYW0sIGhvc3QpO1xuXG4gICAgICAgIGF3YWl0IGFuZ3VsYXJDb21waWxlci5hbmFseXplQXN5bmMoKTtcblxuICAgICAgICBmdW5jdGlvbiogY29sbGVjdERpYWdub3N0aWNzKCkge1xuICAgICAgICAgIC8vIENvbGxlY3QgcHJvZ3JhbSBsZXZlbCBkaWFnbm9zdGljc1xuICAgICAgICAgIHlpZWxkKiBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3M7XG4gICAgICAgICAgeWllbGQqIGFuZ3VsYXJDb21waWxlci5nZXRPcHRpb25EaWFnbm9zdGljcygpO1xuICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldE9wdGlvbnNEaWFnbm9zdGljcygpO1xuICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldEdsb2JhbERpYWdub3N0aWNzKCk7XG5cbiAgICAgICAgICAvLyBDb2xsZWN0IHNvdXJjZSBmaWxlIHNwZWNpZmljIGRpYWdub3N0aWNzXG4gICAgICAgICAgY29uc3QgT3B0aW1pemVGb3IgPSBjb21waWxlckNsaS5PcHRpbWl6ZUZvcjtcbiAgICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgYnVpbGRlci5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICAgICAgICBpZiAoaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB5aWVsZCogYnVpbGRlci5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlKTtcbiAgICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc291cmNlRmlsZSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGFuZ3VsYXJEaWFnbm9zdGljcyA9IGFuZ3VsYXJDb21waWxlci5nZXREaWFnbm9zdGljc0ZvckZpbGUoXG4gICAgICAgICAgICAgIHNvdXJjZUZpbGUsXG4gICAgICAgICAgICAgIE9wdGltaXplRm9yLldob2xlUHJvZ3JhbSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB5aWVsZCogYW5ndWxhckRpYWdub3N0aWNzO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgZGlhZ25vc3RpYyBvZiBjb2xsZWN0RGlhZ25vc3RpY3MoKSkge1xuICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWMoZGlhZ25vc3RpYywgaG9zdCk7XG4gICAgICAgICAgaWYgKGRpYWdub3N0aWMuY2F0ZWdvcnkgPT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcikge1xuICAgICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaChtZXNzYWdlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmaWxlRW1pdHRlciA9IGNyZWF0ZUZpbGVFbWl0dGVyKFxuICAgICAgICAgIGJ1aWxkZXIsXG4gICAgICAgICAgbWVyZ2VUcmFuc2Zvcm1lcnMoXG4gICAgICAgICAgICBhbmd1bGFyQ29tcGlsZXIucHJlcGFyZUVtaXQoKS50cmFuc2Zvcm1lcnMsXG4gICAgICAgICAgICBjcmVhdGVBb3RUcmFuc2Zvcm1lcnMoYnVpbGRlciwge30pLFxuICAgICAgICAgICksXG4gICAgICAgICAgKCkgPT4gW10sXG4gICAgICAgICk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkxvYWQoXG4gICAgICAgIHsgZmlsdGVyOiBjb21waWxlck9wdGlvbnMuYWxsb3dKcyA/IC9cXC5bY21dP1tqdF1zeD8kLyA6IC9cXC5bY21dP3RzeD8kLyB9LFxuICAgICAgICBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAgIGFzc2VydC5vayhmaWxlRW1pdHRlciwgJ0ludmFsaWQgcGx1Z2luIGV4ZWN1dGlvbiBvcmRlcicpO1xuXG4gICAgICAgICAgY29uc3QgdHlwZXNjcmlwdFJlc3VsdCA9IGF3YWl0IGZpbGVFbWl0dGVyKGFyZ3MucGF0aCk7XG4gICAgICAgICAgaWYgKCF0eXBlc2NyaXB0UmVzdWx0KSB7XG4gICAgICAgICAgICAvLyBObyBUUyByZXN1bHQgaW5kaWNhdGVzIHRoZSBmaWxlIGlzIG5vdCBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0uXG4gICAgICAgICAgICAvLyBJZiBhbGxvd0pzIGlzIGVuYWJsZWQgYW5kIHRoZSBmaWxlIGlzIEpTIHRoZW4gZGVmZXIgdG8gdGhlIG5leHQgbG9hZCBob29rLlxuICAgICAgICAgICAgaWYgKGNvbXBpbGVyT3B0aW9ucy5hbGxvd0pzICYmIC9cXC5bY21dP2pzJC8udGVzdChhcmdzLnBhdGgpKSB7XG4gICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSByZXR1cm4gYW4gZXJyb3JcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGVycm9yczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHRleHQ6ICdGaWxlIGlzIG1pc3NpbmcgZnJvbSB0aGUgVHlwZVNjcmlwdCBjb21waWxhdGlvbi4nLFxuICAgICAgICAgICAgICAgICAgbG9jYXRpb246IHsgZmlsZTogYXJncy5wYXRoIH0sXG4gICAgICAgICAgICAgICAgICBub3RlczogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgdGV4dDogYEVuc3VyZSB0aGUgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0gdmlhIHRoZSAnZmlsZXMnIG9yICdpbmNsdWRlJyBwcm9wZXJ0eS5gLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBkYXRhID0gdHlwZXNjcmlwdFJlc3VsdC5jb250ZW50ID8/ICcnO1xuICAgICAgICAgIGNvbnN0IGJhYmVsUmVzdWx0ID0gYXdhaXQgdHJhbnNmb3JtQXN5bmMoZGF0YSwge1xuICAgICAgICAgICAgZmlsZW5hbWU6IGFyZ3MucGF0aCxcbiAgICAgICAgICAgIGlucHV0U291cmNlTWFwOiAocGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAgPyB1bmRlZmluZWQgOiBmYWxzZSkgYXMgdW5kZWZpbmVkLFxuICAgICAgICAgICAgc291cmNlTWFwczogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAgPyAnaW5saW5lJyA6IGZhbHNlLFxuICAgICAgICAgICAgY29tcGFjdDogZmFsc2UsXG4gICAgICAgICAgICBjb25maWdGaWxlOiBmYWxzZSxcbiAgICAgICAgICAgIGJhYmVscmM6IGZhbHNlLFxuICAgICAgICAgICAgYnJvd3NlcnNsaXN0Q29uZmlnRmlsZTogZmFsc2UsXG4gICAgICAgICAgICBwbHVnaW5zOiBbXSxcbiAgICAgICAgICAgIHByZXNldHM6IFtcbiAgICAgICAgICAgICAgW1xuICAgICAgICAgICAgICAgIGFuZ3VsYXJBcHBsaWNhdGlvblByZXNldCxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb246IGRhdGEuaW5jbHVkZXMoJ2FzeW5jJyksXG4gICAgICAgICAgICAgICAgICBvcHRpbWl6ZTogcGx1Z2luT3B0aW9ucy5hZHZhbmNlZE9wdGltaXphdGlvbnMgJiYge30sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29udGVudHM6IGJhYmVsUmVzdWx0Py5jb2RlID8/ICcnLFxuICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICApO1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5bY21dP2pzJC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgYW5ndWxhclBhY2thZ2UgPSAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL11AYW5ndWxhcltcXFxcL10vLnRlc3QoYXJncy5wYXRoKTtcblxuICAgICAgICBjb25zdCBsaW5rZXJQbHVnaW5DcmVhdG9yID0gKFxuICAgICAgICAgIGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcpPihcbiAgICAgICAgICAgICdAYW5ndWxhci9jb21waWxlci1jbGkvbGlua2VyL2JhYmVsJyxcbiAgICAgICAgICApXG4gICAgICAgICkuY3JlYXRlRXMyMDE1TGlua2VyUGx1Z2luO1xuXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBmcy5yZWFkRmlsZShhcmdzLnBhdGgsICd1dGYtOCcpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1Bc3luYyhkYXRhLCB7XG4gICAgICAgICAgZmlsZW5hbWU6IGFyZ3MucGF0aCxcbiAgICAgICAgICBpbnB1dFNvdXJjZU1hcDogKHBsdWdpbk9wdGlvbnMuc291cmNlbWFwID8gdW5kZWZpbmVkIDogZmFsc2UpIGFzIHVuZGVmaW5lZCxcbiAgICAgICAgICBzb3VyY2VNYXBzOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCA/ICdpbmxpbmUnIDogZmFsc2UsXG4gICAgICAgICAgY29tcGFjdDogZmFsc2UsXG4gICAgICAgICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgICAgICAgYmFiZWxyYzogZmFsc2UsXG4gICAgICAgICAgYnJvd3NlcnNsaXN0Q29uZmlnRmlsZTogZmFsc2UsXG4gICAgICAgICAgcGx1Z2luczogW10sXG4gICAgICAgICAgcHJlc2V0czogW1xuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICBhbmd1bGFyQXBwbGljYXRpb25QcmVzZXQsXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBhbmd1bGFyTGlua2VyOiB7XG4gICAgICAgICAgICAgICAgICBzaG91bGRMaW5rOiBhd2FpdCByZXF1aXJlc0xpbmtpbmcoYXJncy5wYXRoLCBkYXRhKSxcbiAgICAgICAgICAgICAgICAgIGppdE1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgbGlua2VyUGx1Z2luQ3JlYXRvcixcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbjpcbiAgICAgICAgICAgICAgICAgICEvW1xcXFwvXVtfZl0/ZXNtMjAxNVtcXFxcL10vLnRlc3QoYXJncy5wYXRoKSAmJiBkYXRhLmluY2x1ZGVzKCdhc3luYycpLFxuICAgICAgICAgICAgICAgIG9wdGltaXplOiBwbHVnaW5PcHRpb25zLmFkdmFuY2VkT3B0aW1pemF0aW9ucyAmJiB7XG4gICAgICAgICAgICAgICAgICBsb29zZUVudW1zOiBhbmd1bGFyUGFja2FnZSxcbiAgICAgICAgICAgICAgICAgIHB1cmVUb3BMZXZlbDogYW5ndWxhclBhY2thZ2UsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50czogcmVzdWx0Py5jb2RlID8/IGRhdGEsXG4gICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlRmlsZUVtaXR0ZXIoXG4gIHByb2dyYW06IHRzLkJ1aWxkZXJQcm9ncmFtLFxuICB0cmFuc2Zvcm1lcnM6IHRzLkN1c3RvbVRyYW5zZm9ybWVycyA9IHt9LFxuICBvbkFmdGVyRW1pdD86IChzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKSA9PiB2b2lkLFxuKTogRmlsZUVtaXR0ZXIge1xuICByZXR1cm4gYXN5bmMgKGZpbGU6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHNvdXJjZUZpbGUgPSBwcm9ncmFtLmdldFNvdXJjZUZpbGUoZmlsZSk7XG4gICAgaWYgKCFzb3VyY2VGaWxlKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGxldCBjb250ZW50OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgcHJvZ3JhbS5lbWl0KFxuICAgICAgc291cmNlRmlsZSxcbiAgICAgIChmaWxlbmFtZSwgZGF0YSkgPT4ge1xuICAgICAgICBpZiAoL1xcLltjbV0/anMkLy50ZXN0KGZpbGVuYW1lKSkge1xuICAgICAgICAgIGNvbnRlbnQgPSBkYXRhO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgdW5kZWZpbmVkIC8qIGNhbmNlbGxhdGlvblRva2VuICovLFxuICAgICAgdW5kZWZpbmVkIC8qIGVtaXRPbmx5RHRzRmlsZXMgKi8sXG4gICAgICB0cmFuc2Zvcm1lcnMsXG4gICAgKTtcblxuICAgIG9uQWZ0ZXJFbWl0Py4oc291cmNlRmlsZSk7XG5cbiAgICByZXR1cm4geyBjb250ZW50LCBkZXBlbmRlbmNpZXM6IFtdIH07XG4gIH07XG59XG4iXX0=