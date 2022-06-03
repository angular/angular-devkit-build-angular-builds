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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILHNDQUE2QztBQUM3QywrQ0FBaUM7QUFFakMsMkJBQW9DO0FBQ3BDLDJDQUE2QjtBQUM3Qiw0REFBNEI7QUFDNUIsa0ZBQXVFO0FBQ3ZFLCtEQUE2RDtBQUM3RCxtREFBcUQ7QUFDckQsK0NBQThFO0FBVTlFOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLCtCQUErQixDQUN0QyxJQUFxQyxFQUNyQyxJQUE4QixFQUM5QixVQUFtQjtJQUVuQixJQUFJLElBQUksR0FBRyxvQkFBRSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDaEYsSUFBSSxVQUFVLEVBQUU7UUFDZCxJQUFJLEdBQUcsVUFBVSxHQUFHLElBQUksQ0FBQztLQUMxQjtJQUVELE1BQU0sSUFBSSxHQUFnQixFQUFFLElBQUksRUFBRSxDQUFDO0lBRW5DLElBQUksSUFBSSxDQUFDLElBQUksRUFBRTtRQUNiLElBQUksQ0FBQyxRQUFRLEdBQUc7WUFDZCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRO1lBQ3hCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtTQUNwQixDQUFDO1FBRUYsNEZBQTRGO1FBQzVGLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNkLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEdBQUcsb0JBQUUsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElB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QkFDYixDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUEzUUQsb0RBMlFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FDeEIsT0FBMEIsRUFDMUIsZUFBc0MsRUFBRSxFQUN4QyxXQUFpRDtJQUVqRCxPQUFPLEtBQUssRUFBRSxJQUFZLEVBQUUsRUFBRTtRQUM1QixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDZixPQUFPLFNBQVMsQ0FBQztTQUNsQjtRQUVELElBQUksT0FBMkIsQ0FBQztRQUNoQyxPQUFPLENBQUMsSUFBSSxDQUNWLFVBQVUsRUFDVixDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsRUFBRTtZQUNqQixJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQy9CLE9BQU8sR0FBRyxJQUFJLENBQUM7YUFDaEI7UUFDSCxDQUFDLEVBQ0QsU0FBUyxDQUFDLHVCQUF1QixFQUNqQyxTQUFTLENBQUMsc0JBQXNCLEVBQ2hDLFlBQVksQ0FDYixDQUFDO1FBRUYsV0FBVyxhQUFYLFdBQVcsdUJBQVgsV0FBVyxDQUFHLFVBQVUsQ0FBQyxDQUFDO1FBRTFCLE9BQU8sRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLEVBQUUsRUFBRSxDQUFDO0lBQ3ZDLENBQUMsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBDb21waWxlckhvc3QgfSBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHsgdHJhbnNmb3JtQXN5bmMgfSBmcm9tICdAYmFiZWwvY29yZSc7XG5pbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB0eXBlIHsgT25TdGFydFJlc3VsdCwgUGFydGlhbE1lc3NhZ2UsIFBhcnRpYWxOb3RlLCBQbHVnaW4sIFBsdWdpbkJ1aWxkIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBwcm9taXNlcyBhcyBmcyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgYW5ndWxhckFwcGxpY2F0aW9uUHJlc2V0IGZyb20gJy4uLy4uL2JhYmVsL3ByZXNldHMvYXBwbGljYXRpb24nO1xuaW1wb3J0IHsgcmVxdWlyZXNMaW5raW5nIH0gZnJvbSAnLi4vLi4vYmFiZWwvd2VicGFjay1sb2FkZXInO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtZXNtJztcbmltcG9ydCB7IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLCBidW5kbGVTdHlsZXNoZWV0VGV4dCB9IGZyb20gJy4vc3R5bGVzaGVldHMnO1xuXG5pbnRlcmZhY2UgRW1pdEZpbGVSZXN1bHQge1xuICBjb250ZW50Pzogc3RyaW5nO1xuICBtYXA/OiBzdHJpbmc7XG4gIGRlcGVuZGVuY2llczogcmVhZG9ubHkgc3RyaW5nW107XG4gIGhhc2g/OiBVaW50OEFycmF5O1xufVxudHlwZSBGaWxlRW1pdHRlciA9IChmaWxlOiBzdHJpbmcpID0+IFByb21pc2U8RW1pdEZpbGVSZXN1bHQgfCB1bmRlZmluZWQ+O1xuXG4vKipcbiAqIENvbnZlcnRzIFR5cGVTY3JpcHQgRGlhZ25vc3RpYyByZWxhdGVkIGluZm9ybWF0aW9uIGludG8gYW4gZXNidWlsZCBjb21wYXRpYmxlIG5vdGUgb2JqZWN0LlxuICogUmVsYXRlZCBpbmZvcm1hdGlvbiBpcyBhIHN1YnNldCBvZiBhIGZ1bGwgVHlwZVNjcmlwdCBEaWFnbm9zdGljIGFuZCBhbHNvIHVzZWQgZm9yIGRpYWdub3N0aWNcbiAqIG5vdGVzIGFzc29jaWF0ZWQgd2l0aCB0aGUgbWFpbiBEaWFnbm9zdGljLlxuICogQHBhcmFtIGRpYWdub3N0aWMgVGhlIFR5cGVTY3JpcHQgZGlhZ25vc3RpYyByZWxhdGl2ZSBpbmZvcm1hdGlvbiB0byBjb252ZXJ0LlxuICogQHBhcmFtIGhvc3QgQSBUeXBlU2NyaXB0IEZvcm1hdERpYWdub3N0aWNzSG9zdCBpbnN0YW5jZSB0byB1c2UgZHVyaW5nIGNvbnZlcnNpb24uXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIGRpYWdub3N0aWMgbWVzc2FnZSBhcyBhIFBhcnRpYWxNZXNzYWdlIG9iamVjdFxuICovXG5mdW5jdGlvbiBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWNJbmZvKFxuICBpbmZvOiB0cy5EaWFnbm9zdGljUmVsYXRlZEluZm9ybWF0aW9uLFxuICBob3N0OiB0cy5Gb3JtYXREaWFnbm9zdGljc0hvc3QsXG4gIHRleHRQcmVmaXg/OiBzdHJpbmcsXG4pOiBQYXJ0aWFsTm90ZSB7XG4gIGxldCB0ZXh0ID0gdHMuZmxhdHRlbkRpYWdub3N0aWNNZXNzYWdlVGV4dChpbmZvLm1lc3NhZ2VUZXh0LCBob3N0LmdldE5ld0xpbmUoKSk7XG4gIGlmICh0ZXh0UHJlZml4KSB7XG4gICAgdGV4dCA9IHRleHRQcmVmaXggKyB0ZXh0O1xuICB9XG5cbiAgY29uc3Qgbm90ZTogUGFydGlhbE5vdGUgPSB7IHRleHQgfTtcblxuICBpZiAoaW5mby5maWxlKSB7XG4gICAgbm90ZS5sb2NhdGlvbiA9IHtcbiAgICAgIGZpbGU6IGluZm8uZmlsZS5maWxlTmFtZSxcbiAgICAgIGxlbmd0aDogaW5mby5sZW5ndGgsXG4gICAgfTtcblxuICAgIC8vIENhbGN1bGF0ZSB0aGUgbGluZS9jb2x1bW4gbG9jYXRpb24gYW5kIGV4dHJhY3QgdGhlIGZ1bGwgbGluZSB0ZXh0IHRoYXQgaGFzIHRoZSBkaWFnbm9zdGljXG4gICAgaWYgKGluZm8uc3RhcnQpIHtcbiAgICAgIGNvbnN0IHsgbGluZSwgY2hhcmFjdGVyIH0gPSB0cy5nZXRMaW5lQW5kQ2hhcmFjdGVyT2ZQb3NpdGlvbihpbmZvLmZpbGUsIGluZm8uc3RhcnQpO1xuICAgICAgbm90ZS5sb2NhdGlvbi5saW5lID0gbGluZSArIDE7XG4gICAgICBub3RlLmxvY2F0aW9uLmNvbHVtbiA9IGNoYXJhY3RlcjtcblxuICAgICAgLy8gVGhlIHN0YXJ0IHBvc2l0aW9uIGZvciB0aGUgc2xpY2UgaXMgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiB0aGUgZXJyb3IgbGluZVxuICAgICAgY29uc3QgbGluZVN0YXJ0UG9zaXRpb24gPSB0cy5nZXRQb3NpdGlvbk9mTGluZUFuZENoYXJhY3RlcihpbmZvLmZpbGUsIGxpbmUsIDApO1xuXG4gICAgICAvLyBUaGUgZW5kIHBvc2l0aW9uIGZvciB0aGUgc2xpY2UgaXMgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiB0aGUgbmV4dCBsaW5lIG9yIHRoZSBsZW5ndGggb2ZcbiAgICAgIC8vIHRoZSBlbnRpcmUgZmlsZSBpZiB0aGUgbGluZSBpcyB0aGUgbGFzdCBsaW5lIG9mIHRoZSBmaWxlIChnZXRQb3NpdGlvbk9mTGluZUFuZENoYXJhY3RlclxuICAgICAgLy8gd2lsbCBlcnJvciBpZiBhIG5vbmV4aXN0ZW50IGxpbmUgaXMgcGFzc2VkKS5cbiAgICAgIGNvbnN0IHsgbGluZTogbGFzdExpbmVPZkZpbGUgfSA9IHRzLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKFxuICAgICAgICBpbmZvLmZpbGUsXG4gICAgICAgIGluZm8uZmlsZS50ZXh0Lmxlbmd0aCAtIDEsXG4gICAgICApO1xuICAgICAgY29uc3QgbGluZUVuZFBvc2l0aW9uID1cbiAgICAgICAgbGluZSA8IGxhc3RMaW5lT2ZGaWxlXG4gICAgICAgICAgPyB0cy5nZXRQb3NpdGlvbk9mTGluZUFuZENoYXJhY3RlcihpbmZvLmZpbGUsIGxpbmUgKyAxLCAwKVxuICAgICAgICAgIDogaW5mby5maWxlLnRleHQubGVuZ3RoO1xuXG4gICAgICBub3RlLmxvY2F0aW9uLmxpbmVUZXh0ID0gaW5mby5maWxlLnRleHQuc2xpY2UobGluZVN0YXJ0UG9zaXRpb24sIGxpbmVFbmRQb3NpdGlvbikudHJpbUVuZCgpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBub3RlO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGEgVHlwZVNjcmlwdCBEaWFnbm9zdGljIG1lc3NhZ2UgaW50byBhbiBlc2J1aWxkIGNvbXBhdGlibGUgbWVzc2FnZSBvYmplY3QuXG4gKiBAcGFyYW0gZGlhZ25vc3RpYyBUaGUgVHlwZVNjcmlwdCBkaWFnbm9zdGljIHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0gaG9zdCBBIFR5cGVTY3JpcHQgRm9ybWF0RGlhZ25vc3RpY3NIb3N0IGluc3RhbmNlIHRvIHVzZSBkdXJpbmcgY29udmVyc2lvbi5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgZGlhZ25vc3RpYyBtZXNzYWdlIGFzIGEgUGFydGlhbE1lc3NhZ2Ugb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpYyhcbiAgZGlhZ25vc3RpYzogdHMuRGlhZ25vc3RpYyxcbiAgaG9zdDogdHMuRm9ybWF0RGlhZ25vc3RpY3NIb3N0LFxuKTogUGFydGlhbE1lc3NhZ2Uge1xuICBsZXQgY29kZVByZWZpeCA9ICdUUyc7XG4gIGxldCBjb2RlID0gYCR7ZGlhZ25vc3RpYy5jb2RlfWA7XG4gIGlmIChkaWFnbm9zdGljLnNvdXJjZSA9PT0gJ25ndHNjJykge1xuICAgIGNvZGVQcmVmaXggPSAnTkcnO1xuICAgIC8vIFJlbW92ZSBgLTk5YCBBbmd1bGFyIHByZWZpeCBmcm9tIGRpYWdub3N0aWMgY29kZVxuICAgIGNvZGUgPSBjb2RlLnNsaWNlKDMpO1xuICB9XG5cbiAgY29uc3QgbWVzc2FnZTogUGFydGlhbE1lc3NhZ2UgPSB7XG4gICAgLi4uY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljSW5mbyhkaWFnbm9zdGljLCBob3N0LCBgJHtjb2RlUHJlZml4fSR7Y29kZX06IGApLFxuICAgIC8vIFN0b3JlIG9yaWdpbmFsIGRpYWdub3N0aWMgZm9yIHJlZmVyZW5jZSBpZiBuZWVkZWQgZG93bnN0cmVhbVxuICAgIGRldGFpbDogZGlhZ25vc3RpYyxcbiAgfTtcblxuICBpZiAoZGlhZ25vc3RpYy5yZWxhdGVkSW5mb3JtYXRpb24/Lmxlbmd0aCkge1xuICAgIG1lc3NhZ2Uubm90ZXMgPSBkaWFnbm9zdGljLnJlbGF0ZWRJbmZvcm1hdGlvbi5tYXAoKGluZm8pID0+XG4gICAgICBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWNJbmZvKGluZm8sIGhvc3QpLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gbWVzc2FnZTtcbn1cblxuLy8gVGhpcyBpcyBhIG5vbi13YXRjaCB2ZXJzaW9uIG9mIHRoZSBjb21waWxlciBjb2RlIGZyb20gYEBuZ3Rvb2xzL3dlYnBhY2tgIGF1Z21lbnRlZCBmb3IgZXNidWlsZFxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgcGx1Z2luT3B0aW9uczogeyBzb3VyY2VtYXA6IGJvb2xlYW47IHRzY29uZmlnOiBzdHJpbmc7IGFkdmFuY2VkT3B0aW1pemF0aW9ucz86IGJvb2xlYW4gfSxcbiAgc3R5bGVPcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbik6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItY29tcGlsZXInLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG4gICAgYXN5bmMgc2V0dXAoYnVpbGQ6IFBsdWdpbkJ1aWxkKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAvLyBUaGlzIHVzZXMgYSB3cmFwcGVkIGR5bmFtaWMgaW1wb3J0IHRvIGxvYWQgYEBhbmd1bGFyL2NvbXBpbGVyLWNsaWAgd2hpY2ggaXMgRVNNLlxuICAgICAgLy8gT25jZSBUeXBlU2NyaXB0IHByb3ZpZGVzIHN1cHBvcnQgZm9yIHJldGFpbmluZyBkeW5hbWljIGltcG9ydHMgdGhpcyB3b3JrYXJvdW5kIGNhbiBiZSBkcm9wcGVkLlxuICAgICAgY29uc3QgY29tcGlsZXJDbGkgPSBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScpPihcbiAgICAgICAgJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaScsXG4gICAgICApO1xuXG4gICAgICAvLyBUZW1wb3JhcnkgZGVlcCBpbXBvcnQgZm9yIHRyYW5zZm9ybWVyIHN1cHBvcnRcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbWVyZ2VUcmFuc2Zvcm1lcnMsXG4gICAgICAgIHJlcGxhY2VCb290c3RyYXAsXG4gICAgICB9ID0gcmVxdWlyZSgnQG5ndG9vbHMvd2VicGFjay9zcmMvaXZ5L3RyYW5zZm9ybWF0aW9uJyk7XG5cbiAgICAgIC8vIFNldHVwIGRlZmluZXMgYmFzZWQgb24gdGhlIHZhbHVlcyBwcm92aWRlZCBieSB0aGUgQW5ndWxhciBjb21waWxlci1jbGlcbiAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLmRlZmluZSA/Pz0ge307XG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhjb21waWxlckNsaS5HTE9CQUxfREVGU19GT1JfVEVSU0VSX1dJVEhfQU9UKSkge1xuICAgICAgICBpZiAoa2V5IGluIGJ1aWxkLmluaXRpYWxPcHRpb25zLmRlZmluZSkge1xuICAgICAgICAgIC8vIFNraXAga2V5cyB0aGF0IGhhdmUgYmVlbiBtYW51YWxseSBwcm92aWRlZFxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIGVzYnVpbGQgcmVxdWlyZXMgdmFsdWVzIHRvIGJlIGEgc3RyaW5nIChhY3R1YWwgc3RyaW5ncyBuZWVkIHRvIGJlIHF1b3RlZCkuXG4gICAgICAgIC8vIEluIHRoaXMgY2FzZSwgYWxsIHByb3ZpZGVkIHZhbHVlcyBhcmUgYm9vbGVhbnMuXG4gICAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLmRlZmluZVtrZXldID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIHRzY29uZmlnIGlzIGxvYWRlZCBpbiBzZXR1cCBpbnN0ZWFkIG9mIGluIHN0YXJ0IHRvIGFsbG93IHRoZSBlc2J1aWxkIHRhcmdldCBidWlsZCBvcHRpb24gdG8gYmUgbW9kaWZpZWQuXG4gICAgICAvLyBlc2J1aWxkIGJ1aWxkIG9wdGlvbnMgY2FuIG9ubHkgYmUgbW9kaWZpZWQgaW4gc2V0dXAgcHJpb3IgdG8gc3RhcnRpbmcgdGhlIGJ1aWxkLlxuICAgICAgY29uc3Qge1xuICAgICAgICBvcHRpb25zOiBjb21waWxlck9wdGlvbnMsXG4gICAgICAgIHJvb3ROYW1lcyxcbiAgICAgICAgZXJyb3JzOiBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3MsXG4gICAgICB9ID0gY29tcGlsZXJDbGkucmVhZENvbmZpZ3VyYXRpb24ocGx1Z2luT3B0aW9ucy50c2NvbmZpZywge1xuICAgICAgICBlbmFibGVJdnk6IHRydWUsXG4gICAgICAgIG5vRW1pdE9uRXJyb3I6IGZhbHNlLFxuICAgICAgICBzdXBwcmVzc091dHB1dFBhdGhDaGVjazogdHJ1ZSxcbiAgICAgICAgb3V0RGlyOiB1bmRlZmluZWQsXG4gICAgICAgIGlubGluZVNvdXJjZXM6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICBpbmxpbmVTb3VyY2VNYXA6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxuICAgICAgICBtYXBSb290OiB1bmRlZmluZWQsXG4gICAgICAgIHNvdXJjZVJvb3Q6IHVuZGVmaW5lZCxcbiAgICAgICAgZGVjbGFyYXRpb246IGZhbHNlLFxuICAgICAgICBkZWNsYXJhdGlvbk1hcDogZmFsc2UsXG4gICAgICAgIGFsbG93RW1wdHlDb2RlZ2VuRmlsZXM6IGZhbHNlLFxuICAgICAgICBhbm5vdGF0aW9uc0FzOiAnZGVjb3JhdG9ycycsXG4gICAgICAgIGVuYWJsZVJlc291cmNlSW5saW5pbmc6IGZhbHNlLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEFkanVzdCB0aGUgZXNidWlsZCBvdXRwdXQgdGFyZ2V0IGJhc2VkIG9uIHRoZSB0c2NvbmZpZyB0YXJnZXRcbiAgICAgIGlmIChcbiAgICAgICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPD0gdHMuU2NyaXB0VGFyZ2V0LkVTMjAxNVxuICAgICAgKSB7XG4gICAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLnRhcmdldCA9ICdlczIwMTUnO1xuICAgICAgfSBlbHNlIGlmIChjb21waWxlck9wdGlvbnMudGFyZ2V0ID49IHRzLlNjcmlwdFRhcmdldC5FU05leHQpIHtcbiAgICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMudGFyZ2V0ID0gJ2VzbmV4dCc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy50YXJnZXQgPSB0cy5TY3JpcHRUYXJnZXRbY29tcGlsZXJPcHRpb25zLnRhcmdldF0udG9Mb3dlckNhc2UoKTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIGZpbGUgZW1pdHRlciBjcmVhdGVkIGR1cmluZyBgb25TdGFydGAgdGhhdCB3aWxsIGJlIHVzZWQgZHVyaW5nIHRoZSBidWlsZCBpbiBgb25Mb2FkYCBjYWxsYmFja3MgZm9yIFRTIGZpbGVzXG4gICAgICBsZXQgZmlsZUVtaXR0ZXI6IEZpbGVFbWl0dGVyIHwgdW5kZWZpbmVkO1xuXG4gICAgICBidWlsZC5vblN0YXJ0KGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0OiBPblN0YXJ0UmVzdWx0ID0ge307XG5cbiAgICAgICAgLy8gQ3JlYXRlIFR5cGVTY3JpcHQgY29tcGlsZXIgaG9zdFxuICAgICAgICBjb25zdCBob3N0ID0gdHMuY3JlYXRlSW5jcmVtZW50YWxDb21waWxlckhvc3QoY29tcGlsZXJPcHRpb25zKTtcblxuICAgICAgICAvLyBUZW1wb3JhcmlseSBhZGQgYSByZWFkUmVzb3VyY2UgaG9vayB0byBhbGxvdyBmb3IgYSB0cmFuc2Zvcm1SZXNvdXJjZSBob29rLlxuICAgICAgICAvLyBPbmNlIHRoZSBBT1QgY29tcGlsZXIgYWxsb3dzIG9ubHkgYSB0cmFuc2Zvcm1SZXNvdXJjZSBob29rIHRoaXMgY2FuIGJlIHJlbW92ZWQuXG4gICAgICAgIChob3N0IGFzIENvbXBpbGVySG9zdCkucmVhZFJlc291cmNlID0gZnVuY3Rpb24gKGZpbGVOYW1lKSB7XG4gICAgICAgICAgLy8gUHJvdmlkZSBzYW1lIG5vIGZpbGUgZm91bmQgYmVoYXZpb3IgYXMgQG5ndG9vbHMvd2VicGFja1xuICAgICAgICAgIHJldHVybiB0aGlzLnJlYWRGaWxlKGZpbGVOYW1lKSA/PyAnJztcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBBZGQgYW4gQU9UIGNvbXBpbGVyIHJlc291cmNlIHRyYW5zZm9ybSBob29rXG4gICAgICAgIChob3N0IGFzIENvbXBpbGVySG9zdCkudHJhbnNmb3JtUmVzb3VyY2UgPSBhc3luYyBmdW5jdGlvbiAoZGF0YSwgY29udGV4dCkge1xuICAgICAgICAgIC8vIE9ubHkgc3R5bGUgcmVzb3VyY2VzIGFyZSB0cmFuc2Zvcm1lZCBjdXJyZW50bHlcbiAgICAgICAgICBpZiAoY29udGV4dC50eXBlICE9PSAnc3R5bGUnKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUaGUgZmlsZSB3aXRoIHRoZSByZXNvdXJjZSBjb250ZW50IHdpbGwgZWl0aGVyIGJlIGFuIGFjdHVhbCBmaWxlIChyZXNvdXJjZUZpbGUpXG4gICAgICAgICAgLy8gb3IgdGhlIGZpbGUgY29udGFpbmluZyB0aGUgaW5saW5lIGNvbXBvbmVudCBzdHlsZSB0ZXh0IChjb250YWluaW5nRmlsZSkuXG4gICAgICAgICAgY29uc3QgZmlsZSA9IGNvbnRleHQucmVzb3VyY2VGaWxlID8/IGNvbnRleHQuY29udGFpbmluZ0ZpbGU7XG5cbiAgICAgICAgICBjb25zdCB7IGNvbnRlbnRzLCBlcnJvcnMsIHdhcm5pbmdzIH0gPSBhd2FpdCBidW5kbGVTdHlsZXNoZWV0VGV4dChcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHJlc29sdmVQYXRoOiBwYXRoLmRpcm5hbWUoZmlsZSksXG4gICAgICAgICAgICAgIHZpcnR1YWxOYW1lOiBmaWxlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgICAgKHJlc3VsdC53YXJuaW5ncyA/Pz0gW10pLnB1c2goLi4ud2FybmluZ3MpO1xuXG4gICAgICAgICAgcmV0dXJuIHsgY29udGVudDogY29udGVudHMgfTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBDcmVhdGUgdGhlIEFuZ3VsYXIgc3BlY2lmaWMgcHJvZ3JhbSB0aGF0IGNvbnRhaW5zIHRoZSBBbmd1bGFyIGNvbXBpbGVyXG4gICAgICAgIGNvbnN0IGFuZ3VsYXJQcm9ncmFtID0gbmV3IGNvbXBpbGVyQ2xpLk5ndHNjUHJvZ3JhbShyb290TmFtZXMsIGNvbXBpbGVyT3B0aW9ucywgaG9zdCk7XG4gICAgICAgIGNvbnN0IGFuZ3VsYXJDb21waWxlciA9IGFuZ3VsYXJQcm9ncmFtLmNvbXBpbGVyO1xuICAgICAgICBjb25zdCB7IGlnbm9yZUZvckRpYWdub3N0aWNzLCBpZ25vcmVGb3JFbWl0IH0gPSBhbmd1bGFyQ29tcGlsZXI7XG4gICAgICAgIGNvbnN0IHR5cGVTY3JpcHRQcm9ncmFtID0gYW5ndWxhclByb2dyYW0uZ2V0VHNQcm9ncmFtKCk7XG5cbiAgICAgICAgY29uc3QgYnVpbGRlciA9IHRzLmNyZWF0ZUFic3RyYWN0QnVpbGRlcih0eXBlU2NyaXB0UHJvZ3JhbSwgaG9zdCk7XG5cbiAgICAgICAgYXdhaXQgYW5ndWxhckNvbXBpbGVyLmFuYWx5emVBc3luYygpO1xuXG4gICAgICAgIGZ1bmN0aW9uKiBjb2xsZWN0RGlhZ25vc3RpY3MoKSB7XG4gICAgICAgICAgLy8gQ29sbGVjdCBwcm9ncmFtIGxldmVsIGRpYWdub3N0aWNzXG4gICAgICAgICAgeWllbGQqIGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcztcbiAgICAgICAgICB5aWVsZCogYW5ndWxhckNvbXBpbGVyLmdldE9wdGlvbkRpYWdub3N0aWNzKCk7XG4gICAgICAgICAgeWllbGQqIGJ1aWxkZXIuZ2V0T3B0aW9uc0RpYWdub3N0aWNzKCk7XG4gICAgICAgICAgeWllbGQqIGJ1aWxkZXIuZ2V0R2xvYmFsRGlhZ25vc3RpY3MoKTtcblxuICAgICAgICAgIC8vIENvbGxlY3Qgc291cmNlIGZpbGUgc3BlY2lmaWMgZGlhZ25vc3RpY3NcbiAgICAgICAgICBjb25zdCBPcHRpbWl6ZUZvciA9IGNvbXBpbGVyQ2xpLk9wdGltaXplRm9yO1xuICAgICAgICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiBidWlsZGVyLmdldFNvdXJjZUZpbGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChpZ25vcmVGb3JEaWFnbm9zdGljcy5oYXMoc291cmNlRmlsZSkpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldFN5bnRhY3RpY0RpYWdub3N0aWNzKHNvdXJjZUZpbGUpO1xuICAgICAgICAgICAgeWllbGQqIGJ1aWxkZXIuZ2V0U2VtYW50aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlKTtcblxuICAgICAgICAgICAgY29uc3QgYW5ndWxhckRpYWdub3N0aWNzID0gYW5ndWxhckNvbXBpbGVyLmdldERpYWdub3N0aWNzRm9yRmlsZShcbiAgICAgICAgICAgICAgc291cmNlRmlsZSxcbiAgICAgICAgICAgICAgT3B0aW1pemVGb3IuV2hvbGVQcm9ncmFtLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHlpZWxkKiBhbmd1bGFyRGlhZ25vc3RpY3M7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCBkaWFnbm9zdGljIG9mIGNvbGxlY3REaWFnbm9zdGljcygpKSB7XG4gICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpYyhkaWFnbm9zdGljLCBob3N0KTtcbiAgICAgICAgICBpZiAoZGlhZ25vc3RpYy5jYXRlZ29yeSA9PT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKSB7XG4gICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2gobWVzc2FnZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZpbGVFbWl0dGVyID0gY3JlYXRlRmlsZUVtaXR0ZXIoXG4gICAgICAgICAgYnVpbGRlcixcbiAgICAgICAgICBtZXJnZVRyYW5zZm9ybWVycyhhbmd1bGFyQ29tcGlsZXIucHJlcGFyZUVtaXQoKS50cmFuc2Zvcm1lcnMsIHtcbiAgICAgICAgICAgIGJlZm9yZTogW3JlcGxhY2VCb290c3RyYXAoKCkgPT4gYnVpbGRlci5nZXRQcm9ncmFtKCkuZ2V0VHlwZUNoZWNrZXIoKSldLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgICgpID0+IFtdLFxuICAgICAgICApO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKFxuICAgICAgICB7IGZpbHRlcjogY29tcGlsZXJPcHRpb25zLmFsbG93SnMgPyAvXFwuW2NtXT9banRdc3g/JC8gOiAvXFwuW2NtXT90c3g/JC8gfSxcbiAgICAgICAgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgICBhc3NlcnQub2soZmlsZUVtaXR0ZXIsICdJbnZhbGlkIHBsdWdpbiBleGVjdXRpb24gb3JkZXInKTtcblxuICAgICAgICAgIGNvbnN0IHR5cGVzY3JpcHRSZXN1bHQgPSBhd2FpdCBmaWxlRW1pdHRlcihhcmdzLnBhdGgpO1xuICAgICAgICAgIGlmICghdHlwZXNjcmlwdFJlc3VsdCkge1xuICAgICAgICAgICAgLy8gTm8gVFMgcmVzdWx0IGluZGljYXRlcyB0aGUgZmlsZSBpcyBub3QgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBwcm9ncmFtLlxuICAgICAgICAgICAgLy8gSWYgYWxsb3dKcyBpcyBlbmFibGVkIGFuZCB0aGUgZmlsZSBpcyBKUyB0aGVuIGRlZmVyIHRvIHRoZSBuZXh0IGxvYWQgaG9vay5cbiAgICAgICAgICAgIGlmIChjb21waWxlck9wdGlvbnMuYWxsb3dKcyAmJiAvXFwuW2NtXT9qcyQvLnRlc3QoYXJncy5wYXRoKSkge1xuICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBPdGhlcndpc2UgcmV0dXJuIGFuIGVycm9yXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB0ZXh0OiAnRmlsZSBpcyBtaXNzaW5nIGZyb20gdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24uJyxcbiAgICAgICAgICAgICAgICAgIGxvY2F0aW9uOiB7IGZpbGU6IGFyZ3MucGF0aCB9LFxuICAgICAgICAgICAgICAgICAgbm90ZXM6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgIHRleHQ6IGBFbnN1cmUgdGhlIGZpbGUgaXMgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBwcm9ncmFtIHZpYSB0aGUgJ2ZpbGVzJyBvciAnaW5jbHVkZScgcHJvcGVydHkuYCxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZGF0YSA9IHR5cGVzY3JpcHRSZXN1bHQuY29udGVudCA/PyAnJztcbiAgICAgICAgICBjb25zdCBiYWJlbFJlc3VsdCA9IGF3YWl0IHRyYW5zZm9ybUFzeW5jKGRhdGEsIHtcbiAgICAgICAgICAgIGZpbGVuYW1lOiBhcmdzLnBhdGgsXG4gICAgICAgICAgICBpbnB1dFNvdXJjZU1hcDogKHBsdWdpbk9wdGlvbnMuc291cmNlbWFwID8gdW5kZWZpbmVkIDogZmFsc2UpIGFzIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHNvdXJjZU1hcHM6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwID8gJ2lubGluZScgOiBmYWxzZSxcbiAgICAgICAgICAgIGNvbXBhY3Q6IGZhbHNlLFxuICAgICAgICAgICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgICAgICAgICBiYWJlbHJjOiBmYWxzZSxcbiAgICAgICAgICAgIGJyb3dzZXJzbGlzdENvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgICAgICAgICAgcGx1Z2luczogW10sXG4gICAgICAgICAgICBwcmVzZXRzOiBbXG4gICAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgICBhbmd1bGFyQXBwbGljYXRpb25QcmVzZXQsXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uOiBkYXRhLmluY2x1ZGVzKCdhc3luYycpLFxuICAgICAgICAgICAgICAgICAgb3B0aW1pemU6IHBsdWdpbk9wdGlvbnMuYWR2YW5jZWRPcHRpbWl6YXRpb25zICYmIHt9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNvbnRlbnRzOiBiYWJlbFJlc3VsdD8uY29kZSA/PyAnJyxcbiAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgKTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9qcyQvIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGFuZ3VsYXJQYWNrYWdlID0gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dQGFuZ3VsYXJbXFxcXC9dLy50ZXN0KGFyZ3MucGF0aCk7XG5cbiAgICAgICAgY29uc3QgbGlua2VyUGx1Z2luQ3JlYXRvciA9IChcbiAgICAgICAgICBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKT4oXG4gICAgICAgICAgICAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcsXG4gICAgICAgICAgKVxuICAgICAgICApLmNyZWF0ZUVzMjAxNUxpbmtlclBsdWdpbjtcblxuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgZnMucmVhZEZpbGUoYXJncy5wYXRoLCAndXRmLTgnKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdHJhbnNmb3JtQXN5bmMoZGF0YSwge1xuICAgICAgICAgIGZpbGVuYW1lOiBhcmdzLnBhdGgsXG4gICAgICAgICAgaW5wdXRTb3VyY2VNYXA6IChwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCA/IHVuZGVmaW5lZCA6IGZhbHNlKSBhcyB1bmRlZmluZWQsXG4gICAgICAgICAgc291cmNlTWFwczogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAgPyAnaW5saW5lJyA6IGZhbHNlLFxuICAgICAgICAgIGNvbXBhY3Q6IGZhbHNlLFxuICAgICAgICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgICAgICAgIGJhYmVscmM6IGZhbHNlLFxuICAgICAgICAgIGJyb3dzZXJzbGlzdENvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgICAgICAgIHBsdWdpbnM6IFtdLFxuICAgICAgICAgIHByZXNldHM6IFtcbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgYW5ndWxhckFwcGxpY2F0aW9uUHJlc2V0LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgYW5ndWxhckxpbmtlcjoge1xuICAgICAgICAgICAgICAgICAgc2hvdWxkTGluazogYXdhaXQgcmVxdWlyZXNMaW5raW5nKGFyZ3MucGF0aCwgZGF0YSksXG4gICAgICAgICAgICAgICAgICBqaXRNb2RlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgIGxpbmtlclBsdWdpbkNyZWF0b3IsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb246XG4gICAgICAgICAgICAgICAgICAhL1tcXFxcL11bX2ZdP2VzbTIwMTVbXFxcXC9dLy50ZXN0KGFyZ3MucGF0aCkgJiYgZGF0YS5pbmNsdWRlcygnYXN5bmMnKSxcbiAgICAgICAgICAgICAgICBvcHRpbWl6ZTogcGx1Z2luT3B0aW9ucy5hZHZhbmNlZE9wdGltaXphdGlvbnMgJiYge1xuICAgICAgICAgICAgICAgICAgbG9vc2VFbnVtczogYW5ndWxhclBhY2thZ2UsXG4gICAgICAgICAgICAgICAgICBwdXJlVG9wTGV2ZWw6IGFuZ3VsYXJQYWNrYWdlLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgY29udGVudHM6IHJlc3VsdD8uY29kZSA/PyBkYXRhLFxuICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUZpbGVFbWl0dGVyKFxuICBwcm9ncmFtOiB0cy5CdWlsZGVyUHJvZ3JhbSxcbiAgdHJhbnNmb3JtZXJzOiB0cy5DdXN0b21UcmFuc2Zvcm1lcnMgPSB7fSxcbiAgb25BZnRlckVtaXQ/OiAoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSkgPT4gdm9pZCxcbik6IEZpbGVFbWl0dGVyIHtcbiAgcmV0dXJuIGFzeW5jIChmaWxlOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBzb3VyY2VGaWxlID0gcHJvZ3JhbS5nZXRTb3VyY2VGaWxlKGZpbGUpO1xuICAgIGlmICghc291cmNlRmlsZSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBsZXQgY29udGVudDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIHByb2dyYW0uZW1pdChcbiAgICAgIHNvdXJjZUZpbGUsXG4gICAgICAoZmlsZW5hbWUsIGRhdGEpID0+IHtcbiAgICAgICAgaWYgKC9cXC5bY21dP2pzJC8udGVzdChmaWxlbmFtZSkpIHtcbiAgICAgICAgICBjb250ZW50ID0gZGF0YTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHVuZGVmaW5lZCAvKiBjYW5jZWxsYXRpb25Ub2tlbiAqLyxcbiAgICAgIHVuZGVmaW5lZCAvKiBlbWl0T25seUR0c0ZpbGVzICovLFxuICAgICAgdHJhbnNmb3JtZXJzLFxuICAgICk7XG5cbiAgICBvbkFmdGVyRW1pdD8uKHNvdXJjZUZpbGUpO1xuXG4gICAgcmV0dXJuIHsgY29udGVudCwgZGVwZW5kZW5jaWVzOiBbXSB9O1xuICB9O1xufVxuIl19