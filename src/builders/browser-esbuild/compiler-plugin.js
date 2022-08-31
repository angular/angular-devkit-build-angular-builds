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
                const forceAsyncTransformation = /async\s+function\s*\*/.test(data);
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
                const forceAsyncTransformation = !/[\\/][_f]?esm2015[\\/]/.test(args.path) && /async\s+function\s*\*/.test(data);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdILHNDQUE2QztBQUM3QywrQ0FBaUM7QUFTakMsMkJBQW9DO0FBQ3BDLDJDQUE2QjtBQUM3Qiw0REFBNEI7QUFDNUIsa0ZBQXVFO0FBQ3ZFLCtEQUE2RDtBQUM3RCxtREFBcUQ7QUFDckQsK0NBQW9HO0FBVXBHOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLCtCQUErQixDQUN0QyxJQUFxQyxFQUNyQyxJQUE4QixFQUM5QixVQUFtQjtJQUVuQixJQUFJLElBQUksR0FBRyxvQkFBRSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDaEYsSUFBSSxVQUFVLEVBQUU7UUFDZCxJQUFJLEdBQUcsVUFBVSxHQUFHLElBQUksQ0FBQztLQUMxQjtJQUVELE1BQU0sSUFBSSxHQUFnQixFQUFFLElBQUksRUFBRSxDQUFDO0lBRW5DLElBQUksSUFBSSxDQUFDLElBQUksRUFBRTtRQUNiLElBQUksQ0FBQyxRQUFRLEdBQUc7WUFDZCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRO1lBQ3hCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtTQUNwQixDQUFDO1FBRUYsNEZBQTRGO1FBQzVGLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNkLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEdBQUcsb0JBQUUsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElB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QixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDZixPQUFPLFNBQVMsQ0FBQztTQUNsQjtRQUVELElBQUksT0FBMkIsQ0FBQztRQUNoQyxPQUFPLENBQUMsSUFBSSxDQUNWLFVBQVUsRUFDVixDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsRUFBRTtZQUNqQixJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQy9CLE9BQU8sR0FBRyxJQUFJLENBQUM7YUFDaEI7UUFDSCxDQUFDLEVBQ0QsU0FBUyxDQUFDLHVCQUF1QixFQUNqQyxTQUFTLENBQUMsc0JBQXNCLEVBQ2hDLFlBQVksQ0FDYixDQUFDO1FBRUYsV0FBVyxhQUFYLFdBQVcsdUJBQVgsV0FBVyxDQUFHLFVBQVUsQ0FBQyxDQUFDO1FBRTFCLE9BQU8sRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLEVBQUUsRUFBRSxDQUFDO0lBQ3ZDLENBQUMsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBDb21waWxlckhvc3QgfSBmcm9tICdAYW5ndWxhci9jb21waWxlci1jbGknO1xuaW1wb3J0IHsgdHJhbnNmb3JtQXN5bmMgfSBmcm9tICdAYmFiZWwvY29yZSc7XG5pbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB0eXBlIHtcbiAgT25TdGFydFJlc3VsdCxcbiAgT3V0cHV0RmlsZSxcbiAgUGFydGlhbE1lc3NhZ2UsXG4gIFBhcnRpYWxOb3RlLFxuICBQbHVnaW4sXG4gIFBsdWdpbkJ1aWxkLFxufSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IHByb21pc2VzIGFzIGZzIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCBhbmd1bGFyQXBwbGljYXRpb25QcmVzZXQgZnJvbSAnLi4vLi4vYmFiZWwvcHJlc2V0cy9hcHBsaWNhdGlvbic7XG5pbXBvcnQgeyByZXF1aXJlc0xpbmtpbmcgfSBmcm9tICcuLi8uLi9iYWJlbC93ZWJwYWNrLWxvYWRlcic7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC1lc20nO1xuaW1wb3J0IHsgQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsIGJ1bmRsZVN0eWxlc2hlZXRGaWxlLCBidW5kbGVTdHlsZXNoZWV0VGV4dCB9IGZyb20gJy4vc3R5bGVzaGVldHMnO1xuXG5pbnRlcmZhY2UgRW1pdEZpbGVSZXN1bHQge1xuICBjb250ZW50Pzogc3RyaW5nO1xuICBtYXA/OiBzdHJpbmc7XG4gIGRlcGVuZGVuY2llczogcmVhZG9ubHkgc3RyaW5nW107XG4gIGhhc2g/OiBVaW50OEFycmF5O1xufVxudHlwZSBGaWxlRW1pdHRlciA9IChmaWxlOiBzdHJpbmcpID0+IFByb21pc2U8RW1pdEZpbGVSZXN1bHQgfCB1bmRlZmluZWQ+O1xuXG4vKipcbiAqIENvbnZlcnRzIFR5cGVTY3JpcHQgRGlhZ25vc3RpYyByZWxhdGVkIGluZm9ybWF0aW9uIGludG8gYW4gZXNidWlsZCBjb21wYXRpYmxlIG5vdGUgb2JqZWN0LlxuICogUmVsYXRlZCBpbmZvcm1hdGlvbiBpcyBhIHN1YnNldCBvZiBhIGZ1bGwgVHlwZVNjcmlwdCBEaWFnbm9zdGljIGFuZCBhbHNvIHVzZWQgZm9yIGRpYWdub3N0aWNcbiAqIG5vdGVzIGFzc29jaWF0ZWQgd2l0aCB0aGUgbWFpbiBEaWFnbm9zdGljLlxuICogQHBhcmFtIGRpYWdub3N0aWMgVGhlIFR5cGVTY3JpcHQgZGlhZ25vc3RpYyByZWxhdGl2ZSBpbmZvcm1hdGlvbiB0byBjb252ZXJ0LlxuICogQHBhcmFtIGhvc3QgQSBUeXBlU2NyaXB0IEZvcm1hdERpYWdub3N0aWNzSG9zdCBpbnN0YW5jZSB0byB1c2UgZHVyaW5nIGNvbnZlcnNpb24uXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIGRpYWdub3N0aWMgbWVzc2FnZSBhcyBhIFBhcnRpYWxNZXNzYWdlIG9iamVjdFxuICovXG5mdW5jdGlvbiBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWNJbmZvKFxuICBpbmZvOiB0cy5EaWFnbm9zdGljUmVsYXRlZEluZm9ybWF0aW9uLFxuICBob3N0OiB0cy5Gb3JtYXREaWFnbm9zdGljc0hvc3QsXG4gIHRleHRQcmVmaXg/OiBzdHJpbmcsXG4pOiBQYXJ0aWFsTm90ZSB7XG4gIGxldCB0ZXh0ID0gdHMuZmxhdHRlbkRpYWdub3N0aWNNZXNzYWdlVGV4dChpbmZvLm1lc3NhZ2VUZXh0LCBob3N0LmdldE5ld0xpbmUoKSk7XG4gIGlmICh0ZXh0UHJlZml4KSB7XG4gICAgdGV4dCA9IHRleHRQcmVmaXggKyB0ZXh0O1xuICB9XG5cbiAgY29uc3Qgbm90ZTogUGFydGlhbE5vdGUgPSB7IHRleHQgfTtcblxuICBpZiAoaW5mby5maWxlKSB7XG4gICAgbm90ZS5sb2NhdGlvbiA9IHtcbiAgICAgIGZpbGU6IGluZm8uZmlsZS5maWxlTmFtZSxcbiAgICAgIGxlbmd0aDogaW5mby5sZW5ndGgsXG4gICAgfTtcblxuICAgIC8vIENhbGN1bGF0ZSB0aGUgbGluZS9jb2x1bW4gbG9jYXRpb24gYW5kIGV4dHJhY3QgdGhlIGZ1bGwgbGluZSB0ZXh0IHRoYXQgaGFzIHRoZSBkaWFnbm9zdGljXG4gICAgaWYgKGluZm8uc3RhcnQpIHtcbiAgICAgIGNvbnN0IHsgbGluZSwgY2hhcmFjdGVyIH0gPSB0cy5nZXRMaW5lQW5kQ2hhcmFjdGVyT2ZQb3NpdGlvbihpbmZvLmZpbGUsIGluZm8uc3RhcnQpO1xuICAgICAgbm90ZS5sb2NhdGlvbi5saW5lID0gbGluZSArIDE7XG4gICAgICBub3RlLmxvY2F0aW9uLmNvbHVtbiA9IGNoYXJhY3RlcjtcblxuICAgICAgLy8gVGhlIHN0YXJ0IHBvc2l0aW9uIGZvciB0aGUgc2xpY2UgaXMgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiB0aGUgZXJyb3IgbGluZVxuICAgICAgY29uc3QgbGluZVN0YXJ0UG9zaXRpb24gPSB0cy5nZXRQb3NpdGlvbk9mTGluZUFuZENoYXJhY3RlcihpbmZvLmZpbGUsIGxpbmUsIDApO1xuXG4gICAgICAvLyBUaGUgZW5kIHBvc2l0aW9uIGZvciB0aGUgc2xpY2UgaXMgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiB0aGUgbmV4dCBsaW5lIG9yIHRoZSBsZW5ndGggb2ZcbiAgICAgIC8vIHRoZSBlbnRpcmUgZmlsZSBpZiB0aGUgbGluZSBpcyB0aGUgbGFzdCBsaW5lIG9mIHRoZSBmaWxlIChnZXRQb3NpdGlvbk9mTGluZUFuZENoYXJhY3RlclxuICAgICAgLy8gd2lsbCBlcnJvciBpZiBhIG5vbmV4aXN0ZW50IGxpbmUgaXMgcGFzc2VkKS5cbiAgICAgIGNvbnN0IHsgbGluZTogbGFzdExpbmVPZkZpbGUgfSA9IHRzLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKFxuICAgICAgICBpbmZvLmZpbGUsXG4gICAgICAgIGluZm8uZmlsZS50ZXh0Lmxlbmd0aCAtIDEsXG4gICAgICApO1xuICAgICAgY29uc3QgbGluZUVuZFBvc2l0aW9uID1cbiAgICAgICAgbGluZSA8IGxhc3RMaW5lT2ZGaWxlXG4gICAgICAgICAgPyB0cy5nZXRQb3NpdGlvbk9mTGluZUFuZENoYXJhY3RlcihpbmZvLmZpbGUsIGxpbmUgKyAxLCAwKVxuICAgICAgICAgIDogaW5mby5maWxlLnRleHQubGVuZ3RoO1xuXG4gICAgICBub3RlLmxvY2F0aW9uLmxpbmVUZXh0ID0gaW5mby5maWxlLnRleHQuc2xpY2UobGluZVN0YXJ0UG9zaXRpb24sIGxpbmVFbmRQb3NpdGlvbikudHJpbUVuZCgpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBub3RlO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGEgVHlwZVNjcmlwdCBEaWFnbm9zdGljIG1lc3NhZ2UgaW50byBhbiBlc2J1aWxkIGNvbXBhdGlibGUgbWVzc2FnZSBvYmplY3QuXG4gKiBAcGFyYW0gZGlhZ25vc3RpYyBUaGUgVHlwZVNjcmlwdCBkaWFnbm9zdGljIHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0gaG9zdCBBIFR5cGVTY3JpcHQgRm9ybWF0RGlhZ25vc3RpY3NIb3N0IGluc3RhbmNlIHRvIHVzZSBkdXJpbmcgY29udmVyc2lvbi5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgZGlhZ25vc3RpYyBtZXNzYWdlIGFzIGEgUGFydGlhbE1lc3NhZ2Ugb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpYyhcbiAgZGlhZ25vc3RpYzogdHMuRGlhZ25vc3RpYyxcbiAgaG9zdDogdHMuRm9ybWF0RGlhZ25vc3RpY3NIb3N0LFxuKTogUGFydGlhbE1lc3NhZ2Uge1xuICBsZXQgY29kZVByZWZpeCA9ICdUUyc7XG4gIGxldCBjb2RlID0gYCR7ZGlhZ25vc3RpYy5jb2RlfWA7XG4gIGlmIChkaWFnbm9zdGljLnNvdXJjZSA9PT0gJ25ndHNjJykge1xuICAgIGNvZGVQcmVmaXggPSAnTkcnO1xuICAgIC8vIFJlbW92ZSBgLTk5YCBBbmd1bGFyIHByZWZpeCBmcm9tIGRpYWdub3N0aWMgY29kZVxuICAgIGNvZGUgPSBjb2RlLnNsaWNlKDMpO1xuICB9XG5cbiAgY29uc3QgbWVzc2FnZTogUGFydGlhbE1lc3NhZ2UgPSB7XG4gICAgLi4uY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljSW5mbyhkaWFnbm9zdGljLCBob3N0LCBgJHtjb2RlUHJlZml4fSR7Y29kZX06IGApLFxuICAgIC8vIFN0b3JlIG9yaWdpbmFsIGRpYWdub3N0aWMgZm9yIHJlZmVyZW5jZSBpZiBuZWVkZWQgZG93bnN0cmVhbVxuICAgIGRldGFpbDogZGlhZ25vc3RpYyxcbiAgfTtcblxuICBpZiAoZGlhZ25vc3RpYy5yZWxhdGVkSW5mb3JtYXRpb24/Lmxlbmd0aCkge1xuICAgIG1lc3NhZ2Uubm90ZXMgPSBkaWFnbm9zdGljLnJlbGF0ZWRJbmZvcm1hdGlvbi5tYXAoKGluZm8pID0+XG4gICAgICBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWNJbmZvKGluZm8sIGhvc3QpLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gbWVzc2FnZTtcbn1cblxuLy8gVGhpcyBpcyBhIG5vbi13YXRjaCB2ZXJzaW9uIG9mIHRoZSBjb21waWxlciBjb2RlIGZyb20gYEBuZ3Rvb2xzL3dlYnBhY2tgIGF1Z21lbnRlZCBmb3IgZXNidWlsZFxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgcGx1Z2luT3B0aW9uczoge1xuICAgIHNvdXJjZW1hcDogYm9vbGVhbjtcbiAgICB0c2NvbmZpZzogc3RyaW5nO1xuICAgIGFkdmFuY2VkT3B0aW1pemF0aW9ucz86IGJvb2xlYW47XG4gICAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM/OiBib29sZWFuO1xuICB9LFxuICBzdHlsZU9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLFxuKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1jb21waWxlcicsXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbiAgICBhc3luYyBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgIC8vIFRoaXMgdXNlcyBhIHdyYXBwZWQgZHluYW1pYyBpbXBvcnQgdG8gbG9hZCBgQGFuZ3VsYXIvY29tcGlsZXItY2xpYCB3aGljaCBpcyBFU00uXG4gICAgICAvLyBPbmNlIFR5cGVTY3JpcHQgcHJvdmlkZXMgc3VwcG9ydCBmb3IgcmV0YWluaW5nIGR5bmFtaWMgaW1wb3J0cyB0aGlzIHdvcmthcm91bmQgY2FuIGJlIGRyb3BwZWQuXG4gICAgICBjb25zdCBjb21waWxlckNsaSA9IGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tcGlsZXItY2xpJyk+KFxuICAgICAgICAnQGFuZ3VsYXIvY29tcGlsZXItY2xpJyxcbiAgICAgICk7XG5cbiAgICAgIC8vIFRlbXBvcmFyeSBkZWVwIGltcG9ydCBmb3IgdHJhbnNmb3JtZXIgc3VwcG9ydFxuICAgICAgY29uc3Qge1xuICAgICAgICBtZXJnZVRyYW5zZm9ybWVycyxcbiAgICAgICAgcmVwbGFjZUJvb3RzdHJhcCxcbiAgICAgIH0gPSByZXF1aXJlKCdAbmd0b29scy93ZWJwYWNrL3NyYy9pdnkvdHJhbnNmb3JtYXRpb24nKTtcblxuICAgICAgLy8gU2V0dXAgZGVmaW5lcyBiYXNlZCBvbiB0aGUgdmFsdWVzIHByb3ZpZGVkIGJ5IHRoZSBBbmd1bGFyIGNvbXBpbGVyLWNsaVxuICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lID8/PSB7fTtcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGNvbXBpbGVyQ2xpLkdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QpKSB7XG4gICAgICAgIGlmIChrZXkgaW4gYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lKSB7XG4gICAgICAgICAgLy8gU2tpcCBrZXlzIHRoYXQgaGF2ZSBiZWVuIG1hbnVhbGx5IHByb3ZpZGVkXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZXNidWlsZCByZXF1aXJlcyB2YWx1ZXMgdG8gYmUgYSBzdHJpbmcgKGFjdHVhbCBzdHJpbmdzIG5lZWQgdG8gYmUgcXVvdGVkKS5cbiAgICAgICAgLy8gSW4gdGhpcyBjYXNlLCBhbGwgcHJvdmlkZWQgdmFsdWVzIGFyZSBib29sZWFucy5cbiAgICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lW2tleV0gPSB2YWx1ZS50b1N0cmluZygpO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgdHNjb25maWcgaXMgbG9hZGVkIGluIHNldHVwIGluc3RlYWQgb2YgaW4gc3RhcnQgdG8gYWxsb3cgdGhlIGVzYnVpbGQgdGFyZ2V0IGJ1aWxkIG9wdGlvbiB0byBiZSBtb2RpZmllZC5cbiAgICAgIC8vIGVzYnVpbGQgYnVpbGQgb3B0aW9ucyBjYW4gb25seSBiZSBtb2RpZmllZCBpbiBzZXR1cCBwcmlvciB0byBzdGFydGluZyB0aGUgYnVpbGQuXG4gICAgICBjb25zdCB7XG4gICAgICAgIG9wdGlvbnM6IGNvbXBpbGVyT3B0aW9ucyxcbiAgICAgICAgcm9vdE5hbWVzLFxuICAgICAgICBlcnJvcnM6IGNvbmZpZ3VyYXRpb25EaWFnbm9zdGljcyxcbiAgICAgIH0gPSBjb21waWxlckNsaS5yZWFkQ29uZmlndXJhdGlvbihwbHVnaW5PcHRpb25zLnRzY29uZmlnLCB7XG4gICAgICAgIGVuYWJsZUl2eTogdHJ1ZSxcbiAgICAgICAgbm9FbWl0T25FcnJvcjogZmFsc2UsXG4gICAgICAgIHN1cHByZXNzT3V0cHV0UGF0aENoZWNrOiB0cnVlLFxuICAgICAgICBvdXREaXI6IHVuZGVmaW5lZCxcbiAgICAgICAgaW5saW5lU291cmNlczogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgIGlubGluZVNvdXJjZU1hcDogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgIHNvdXJjZU1hcDogZmFsc2UsXG4gICAgICAgIG1hcFJvb3Q6IHVuZGVmaW5lZCxcbiAgICAgICAgc291cmNlUm9vdDogdW5kZWZpbmVkLFxuICAgICAgICBkZWNsYXJhdGlvbjogZmFsc2UsXG4gICAgICAgIGRlY2xhcmF0aW9uTWFwOiBmYWxzZSxcbiAgICAgICAgYWxsb3dFbXB0eUNvZGVnZW5GaWxlczogZmFsc2UsXG4gICAgICAgIGFubm90YXRpb25zQXM6ICdkZWNvcmF0b3JzJyxcbiAgICAgICAgZW5hYmxlUmVzb3VyY2VJbmxpbmluZzogZmFsc2UsXG4gICAgICB9KTtcblxuICAgICAgLy8gQWRqdXN0IHRoZSBlc2J1aWxkIG91dHB1dCB0YXJnZXQgYmFzZWQgb24gdGhlIHRzY29uZmlnIHRhcmdldFxuICAgICAgaWYgKFxuICAgICAgICBjb21waWxlck9wdGlvbnMudGFyZ2V0ID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCA8PSB0cy5TY3JpcHRUYXJnZXQuRVMyMDE1XG4gICAgICApIHtcbiAgICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMudGFyZ2V0ID0gJ2VzMjAxNSc7XG4gICAgICB9IGVsc2UgaWYgKGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPj0gdHMuU2NyaXB0VGFyZ2V0LkVTTmV4dCkge1xuICAgICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy50YXJnZXQgPSAnZXNuZXh0JztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLnRhcmdldCA9IHRzLlNjcmlwdFRhcmdldFtjb21waWxlck9wdGlvbnMudGFyZ2V0XS50b0xvd2VyQ2FzZSgpO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgZmlsZSBlbWl0dGVyIGNyZWF0ZWQgZHVyaW5nIGBvblN0YXJ0YCB0aGF0IHdpbGwgYmUgdXNlZCBkdXJpbmcgdGhlIGJ1aWxkIGluIGBvbkxvYWRgIGNhbGxiYWNrcyBmb3IgVFMgZmlsZXNcbiAgICAgIGxldCBmaWxlRW1pdHRlcjogRmlsZUVtaXR0ZXIgfCB1bmRlZmluZWQ7XG5cbiAgICAgIC8vIFRoZSBzdHlsZXNoZWV0IHJlc291cmNlcyBmcm9tIGNvbXBvbmVudCBzdHlsZXNoZWV0cyB0aGF0IHdpbGwgYmUgYWRkZWQgdG8gdGhlIGJ1aWxkIHJlc3VsdHMgb3V0cHV0IGZpbGVzXG4gICAgICBsZXQgc3R5bGVzaGVldFJlc291cmNlRmlsZXM6IE91dHB1dEZpbGVbXTtcblxuICAgICAgYnVpbGQub25TdGFydChhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogT25TdGFydFJlc3VsdCA9IHt9O1xuXG4gICAgICAgIC8vIFJlc2V0IHN0eWxlc2hlZXQgcmVzb3VyY2Ugb3V0cHV0IGZpbGVzXG4gICAgICAgIHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzID0gW107XG5cbiAgICAgICAgLy8gQ3JlYXRlIFR5cGVTY3JpcHQgY29tcGlsZXIgaG9zdFxuICAgICAgICBjb25zdCBob3N0ID0gdHMuY3JlYXRlSW5jcmVtZW50YWxDb21waWxlckhvc3QoY29tcGlsZXJPcHRpb25zKTtcblxuICAgICAgICAvLyBUZW1wb3JhcmlseSBwcm9jZXNzIGV4dGVybmFsIHJlc291cmNlcyB2aWEgcmVhZFJlc291cmNlLlxuICAgICAgICAvLyBUaGUgQU9UIGNvbXBpbGVyIGN1cnJlbnRseSByZXF1aXJlcyB0aGlzIGhvb2sgdG8gYWxsb3cgZm9yIGEgdHJhbnNmb3JtUmVzb3VyY2UgaG9vay5cbiAgICAgICAgLy8gT25jZSB0aGUgQU9UIGNvbXBpbGVyIGFsbG93cyBvbmx5IGEgdHJhbnNmb3JtUmVzb3VyY2UgaG9vaywgdGhpcyBjYW4gYmUgcmVldmFsdWF0ZWQuXG4gICAgICAgIChob3N0IGFzIENvbXBpbGVySG9zdCkucmVhZFJlc291cmNlID0gYXN5bmMgZnVuY3Rpb24gKGZpbGVOYW1lKSB7XG4gICAgICAgICAgLy8gVGVtcGxhdGUgcmVzb3VyY2VzICguaHRtbC8uc3ZnKSBmaWxlcyBhcmUgbm90IGJ1bmRsZWQgb3IgdHJhbnNmb3JtZWRcbiAgICAgICAgICBpZiAoZmlsZU5hbWUuZW5kc1dpdGgoJy5odG1sJykgfHwgZmlsZU5hbWUuZW5kc1dpdGgoJy5zdmcnKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVhZEZpbGUoZmlsZU5hbWUpID8/ICcnO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHsgY29udGVudHMsIHJlc291cmNlRmlsZXMsIGVycm9ycywgd2FybmluZ3MgfSA9IGF3YWl0IGJ1bmRsZVN0eWxlc2hlZXRGaWxlKFxuICAgICAgICAgICAgZmlsZU5hbWUsXG4gICAgICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaCguLi5lcnJvcnMpO1xuICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgICBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcy5wdXNoKC4uLnJlc291cmNlRmlsZXMpO1xuXG4gICAgICAgICAgcmV0dXJuIGNvbnRlbnRzO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIEFkZCBhbiBBT1QgY29tcGlsZXIgcmVzb3VyY2UgdHJhbnNmb3JtIGhvb2tcbiAgICAgICAgKGhvc3QgYXMgQ29tcGlsZXJIb3N0KS50cmFuc2Zvcm1SZXNvdXJjZSA9IGFzeW5jIGZ1bmN0aW9uIChkYXRhLCBjb250ZXh0KSB7XG4gICAgICAgICAgLy8gT25seSBpbmxpbmUgc3R5bGUgcmVzb3VyY2VzIGFyZSB0cmFuc2Zvcm1lZCBzZXBhcmF0ZWx5IGN1cnJlbnRseVxuICAgICAgICAgIGlmIChjb250ZXh0LnJlc291cmNlRmlsZSB8fCBjb250ZXh0LnR5cGUgIT09ICdzdHlsZScpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFRoZSBmaWxlIHdpdGggdGhlIHJlc291cmNlIGNvbnRlbnQgd2lsbCBlaXRoZXIgYmUgYW4gYWN0dWFsIGZpbGUgKHJlc291cmNlRmlsZSlcbiAgICAgICAgICAvLyBvciB0aGUgZmlsZSBjb250YWluaW5nIHRoZSBpbmxpbmUgY29tcG9uZW50IHN0eWxlIHRleHQgKGNvbnRhaW5pbmdGaWxlKS5cbiAgICAgICAgICBjb25zdCBmaWxlID0gY29udGV4dC5yZXNvdXJjZUZpbGUgPz8gY29udGV4dC5jb250YWluaW5nRmlsZTtcblxuICAgICAgICAgIGNvbnN0IHsgY29udGVudHMsIHJlc291cmNlRmlsZXMsIGVycm9ycywgd2FybmluZ3MgfSA9IGF3YWl0IGJ1bmRsZVN0eWxlc2hlZXRUZXh0KFxuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZVBhdGg6IHBhdGguZGlybmFtZShmaWxlKSxcbiAgICAgICAgICAgICAgdmlydHVhbE5hbWU6IGZpbGUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaCguLi53YXJuaW5ncyk7XG4gICAgICAgICAgc3R5bGVzaGVldFJlc291cmNlRmlsZXMucHVzaCguLi5yZXNvdXJjZUZpbGVzKTtcblxuICAgICAgICAgIHJldHVybiB7IGNvbnRlbnQ6IGNvbnRlbnRzIH07XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQ3JlYXRlIHRoZSBBbmd1bGFyIHNwZWNpZmljIHByb2dyYW0gdGhhdCBjb250YWlucyB0aGUgQW5ndWxhciBjb21waWxlclxuICAgICAgICBjb25zdCBhbmd1bGFyUHJvZ3JhbSA9IG5ldyBjb21waWxlckNsaS5OZ3RzY1Byb2dyYW0ocm9vdE5hbWVzLCBjb21waWxlck9wdGlvbnMsIGhvc3QpO1xuICAgICAgICBjb25zdCBhbmd1bGFyQ29tcGlsZXIgPSBhbmd1bGFyUHJvZ3JhbS5jb21waWxlcjtcbiAgICAgICAgY29uc3QgeyBpZ25vcmVGb3JEaWFnbm9zdGljcyB9ID0gYW5ndWxhckNvbXBpbGVyO1xuICAgICAgICBjb25zdCB0eXBlU2NyaXB0UHJvZ3JhbSA9IGFuZ3VsYXJQcm9ncmFtLmdldFRzUHJvZ3JhbSgpO1xuXG4gICAgICAgIGNvbnN0IGJ1aWxkZXIgPSB0cy5jcmVhdGVBYnN0cmFjdEJ1aWxkZXIodHlwZVNjcmlwdFByb2dyYW0sIGhvc3QpO1xuXG4gICAgICAgIGF3YWl0IGFuZ3VsYXJDb21waWxlci5hbmFseXplQXN5bmMoKTtcblxuICAgICAgICBmdW5jdGlvbiogY29sbGVjdERpYWdub3N0aWNzKCkge1xuICAgICAgICAgIC8vIENvbGxlY3QgcHJvZ3JhbSBsZXZlbCBkaWFnbm9zdGljc1xuICAgICAgICAgIHlpZWxkKiBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3M7XG4gICAgICAgICAgeWllbGQqIGFuZ3VsYXJDb21waWxlci5nZXRPcHRpb25EaWFnbm9zdGljcygpO1xuICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldE9wdGlvbnNEaWFnbm9zdGljcygpO1xuICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldEdsb2JhbERpYWdub3N0aWNzKCk7XG5cbiAgICAgICAgICAvLyBDb2xsZWN0IHNvdXJjZSBmaWxlIHNwZWNpZmljIGRpYWdub3N0aWNzXG4gICAgICAgICAgY29uc3QgT3B0aW1pemVGb3IgPSBjb21waWxlckNsaS5PcHRpbWl6ZUZvcjtcbiAgICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZUZpbGUgb2YgYnVpbGRlci5nZXRTb3VyY2VGaWxlcygpKSB7XG4gICAgICAgICAgICBpZiAoaWdub3JlRm9yRGlhZ25vc3RpY3MuaGFzKHNvdXJjZUZpbGUpKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB5aWVsZCogYnVpbGRlci5nZXRTeW50YWN0aWNEaWFnbm9zdGljcyhzb3VyY2VGaWxlKTtcbiAgICAgICAgICAgIHlpZWxkKiBidWlsZGVyLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc291cmNlRmlsZSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGFuZ3VsYXJEaWFnbm9zdGljcyA9IGFuZ3VsYXJDb21waWxlci5nZXREaWFnbm9zdGljc0ZvckZpbGUoXG4gICAgICAgICAgICAgIHNvdXJjZUZpbGUsXG4gICAgICAgICAgICAgIE9wdGltaXplRm9yLldob2xlUHJvZ3JhbSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB5aWVsZCogYW5ndWxhckRpYWdub3N0aWNzO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgZGlhZ25vc3RpYyBvZiBjb2xsZWN0RGlhZ25vc3RpY3MoKSkge1xuICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWMoZGlhZ25vc3RpYywgaG9zdCk7XG4gICAgICAgICAgaWYgKGRpYWdub3N0aWMuY2F0ZWdvcnkgPT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcikge1xuICAgICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaChtZXNzYWdlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmaWxlRW1pdHRlciA9IGNyZWF0ZUZpbGVFbWl0dGVyKFxuICAgICAgICAgIGJ1aWxkZXIsXG4gICAgICAgICAgbWVyZ2VUcmFuc2Zvcm1lcnMoYW5ndWxhckNvbXBpbGVyLnByZXBhcmVFbWl0KCkudHJhbnNmb3JtZXJzLCB7XG4gICAgICAgICAgICBiZWZvcmU6IFtyZXBsYWNlQm9vdHN0cmFwKCgpID0+IGJ1aWxkZXIuZ2V0UHJvZ3JhbSgpLmdldFR5cGVDaGVja2VyKCkpXSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICAoKSA9PiBbXSxcbiAgICAgICAgKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZChcbiAgICAgICAgeyBmaWx0ZXI6IGNvbXBpbGVyT3B0aW9ucy5hbGxvd0pzID8gL1xcLltjbV0/W2p0XXN4PyQvIDogL1xcLltjbV0/dHN4PyQvIH0sXG4gICAgICAgIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgICAgYXNzZXJ0Lm9rKGZpbGVFbWl0dGVyLCAnSW52YWxpZCBwbHVnaW4gZXhlY3V0aW9uIG9yZGVyJyk7XG5cbiAgICAgICAgICBjb25zdCB0eXBlc2NyaXB0UmVzdWx0ID0gYXdhaXQgZmlsZUVtaXR0ZXIoYXJncy5wYXRoKTtcbiAgICAgICAgICBpZiAoIXR5cGVzY3JpcHRSZXN1bHQpIHtcbiAgICAgICAgICAgIC8vIE5vIFRTIHJlc3VsdCBpbmRpY2F0ZXMgdGhlIGZpbGUgaXMgbm90IHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvZ3JhbS5cbiAgICAgICAgICAgIC8vIElmIGFsbG93SnMgaXMgZW5hYmxlZCBhbmQgdGhlIGZpbGUgaXMgSlMgdGhlbiBkZWZlciB0byB0aGUgbmV4dCBsb2FkIGhvb2suXG4gICAgICAgICAgICBpZiAoY29tcGlsZXJPcHRpb25zLmFsbG93SnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KGFyZ3MucGF0aCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gT3RoZXJ3aXNlIHJldHVybiBhbiBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgdGV4dDogJ0ZpbGUgaXMgbWlzc2luZyBmcm9tIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uLicsXG4gICAgICAgICAgICAgICAgICBsb2NhdGlvbjogeyBmaWxlOiBhcmdzLnBhdGggfSxcbiAgICAgICAgICAgICAgICAgIG5vdGVzOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiBgRW5zdXJlIHRoZSBmaWxlIGlzIHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvZ3JhbSB2aWEgdGhlICdmaWxlcycgb3IgJ2luY2x1ZGUnIHByb3BlcnR5LmAsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGRhdGEgPSB0eXBlc2NyaXB0UmVzdWx0LmNvbnRlbnQgPz8gJyc7XG4gICAgICAgICAgY29uc3QgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uID0gL2FzeW5jXFxzK2Z1bmN0aW9uXFxzKlxcKi8udGVzdChkYXRhKTtcbiAgICAgICAgICBjb25zdCB1c2VJbnB1dFNvdXJjZW1hcCA9XG4gICAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCAmJlxuICAgICAgICAgICAgKCEhcGx1Z2luT3B0aW9ucy50aGlyZFBhcnR5U291cmNlbWFwcyB8fCAhL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLy50ZXN0KGFyZ3MucGF0aCkpO1xuXG4gICAgICAgICAgLy8gSWYgbm8gYWRkaXRpb25hbCB0cmFuc2Zvcm1hdGlvbnMgYXJlIG5lZWRlZCwgcmV0dXJuIHRoZSBUeXBlU2NyaXB0IG91dHB1dCBkaXJlY3RseVxuICAgICAgICAgIGlmICghZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uICYmICFwbHVnaW5PcHRpb25zLmFkdmFuY2VkT3B0aW1pemF0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgLy8gU3RyaXAgc291cmNlbWFwcyBpZiB0aGV5IHNob3VsZCBub3QgYmUgdXNlZFxuICAgICAgICAgICAgICBjb250ZW50czogdXNlSW5wdXRTb3VyY2VtYXBcbiAgICAgICAgICAgICAgICA/IGRhdGFcbiAgICAgICAgICAgICAgICA6IGRhdGEucmVwbGFjZSgvXlxcL1xcLyMgc291cmNlTWFwcGluZ1VSTD1bXlxcclxcbl0qL2dtLCAnJyksXG4gICAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgYmFiZWxSZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1Bc3luYyhkYXRhLCB7XG4gICAgICAgICAgICBmaWxlbmFtZTogYXJncy5wYXRoLFxuICAgICAgICAgICAgaW5wdXRTb3VyY2VNYXA6ICh1c2VJbnB1dFNvdXJjZW1hcCA/IHVuZGVmaW5lZCA6IGZhbHNlKSBhcyB1bmRlZmluZWQsXG4gICAgICAgICAgICBzb3VyY2VNYXBzOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCA/ICdpbmxpbmUnIDogZmFsc2UsXG4gICAgICAgICAgICBjb21wYWN0OiBmYWxzZSxcbiAgICAgICAgICAgIGNvbmZpZ0ZpbGU6IGZhbHNlLFxuICAgICAgICAgICAgYmFiZWxyYzogZmFsc2UsXG4gICAgICAgICAgICBicm93c2Vyc2xpc3RDb25maWdGaWxlOiBmYWxzZSxcbiAgICAgICAgICAgIHBsdWdpbnM6IFtdLFxuICAgICAgICAgICAgcHJlc2V0czogW1xuICAgICAgICAgICAgICBbXG4gICAgICAgICAgICAgICAgYW5ndWxhckFwcGxpY2F0aW9uUHJlc2V0LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbixcbiAgICAgICAgICAgICAgICAgIG9wdGltaXplOiBwbHVnaW5PcHRpb25zLmFkdmFuY2VkT3B0aW1pemF0aW9ucyAmJiB7fSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb250ZW50czogYmFiZWxSZXN1bHQ/LmNvZGUgPz8gJycsXG4gICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgICk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLltjbV0/anMkLyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgZnMucmVhZEZpbGUoYXJncy5wYXRoLCAndXRmLTgnKTtcbiAgICAgICAgY29uc3QgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uID1cbiAgICAgICAgICAhL1tcXFxcL11bX2ZdP2VzbTIwMTVbXFxcXC9dLy50ZXN0KGFyZ3MucGF0aCkgJiYgL2FzeW5jXFxzK2Z1bmN0aW9uXFxzKlxcKi8udGVzdChkYXRhKTtcbiAgICAgICAgY29uc3Qgc2hvdWxkTGluayA9IGF3YWl0IHJlcXVpcmVzTGlua2luZyhhcmdzLnBhdGgsIGRhdGEpO1xuICAgICAgICBjb25zdCB1c2VJbnB1dFNvdXJjZW1hcCA9XG4gICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAgJiZcbiAgICAgICAgICAoISFwbHVnaW5PcHRpb25zLnRoaXJkUGFydHlTb3VyY2VtYXBzIHx8ICEvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vLnRlc3QoYXJncy5wYXRoKSk7XG5cbiAgICAgICAgLy8gSWYgbm8gYWRkaXRpb25hbCB0cmFuc2Zvcm1hdGlvbnMgYXJlIG5lZWRlZCwgcmV0dXJuIHRoZSBUeXBlU2NyaXB0IG91dHB1dCBkaXJlY3RseVxuICAgICAgICBpZiAoIWZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbiAmJiAhcGx1Z2luT3B0aW9ucy5hZHZhbmNlZE9wdGltaXphdGlvbnMgJiYgIXNob3VsZExpbmspIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLy8gU3RyaXAgc291cmNlbWFwcyBpZiB0aGV5IHNob3VsZCBub3QgYmUgdXNlZFxuICAgICAgICAgICAgY29udGVudHM6IHVzZUlucHV0U291cmNlbWFwXG4gICAgICAgICAgICAgID8gZGF0YVxuICAgICAgICAgICAgICA6IGRhdGEucmVwbGFjZSgvXlxcL1xcLyMgc291cmNlTWFwcGluZ1VSTD1bXlxcclxcbl0qL2dtLCAnJyksXG4gICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFuZ3VsYXJQYWNrYWdlID0gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dQGFuZ3VsYXJbXFxcXC9dLy50ZXN0KGFyZ3MucGF0aCk7XG5cbiAgICAgICAgY29uc3QgbGlua2VyUGx1Z2luQ3JlYXRvciA9IChcbiAgICAgICAgICBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbXBpbGVyLWNsaS9saW5rZXIvYmFiZWwnKT4oXG4gICAgICAgICAgICAnQGFuZ3VsYXIvY29tcGlsZXItY2xpL2xpbmtlci9iYWJlbCcsXG4gICAgICAgICAgKVxuICAgICAgICApLmNyZWF0ZUVzMjAxNUxpbmtlclBsdWdpbjtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0cmFuc2Zvcm1Bc3luYyhkYXRhLCB7XG4gICAgICAgICAgZmlsZW5hbWU6IGFyZ3MucGF0aCxcbiAgICAgICAgICBpbnB1dFNvdXJjZU1hcDogKHVzZUlucHV0U291cmNlbWFwID8gdW5kZWZpbmVkIDogZmFsc2UpIGFzIHVuZGVmaW5lZCxcbiAgICAgICAgICBzb3VyY2VNYXBzOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCA/ICdpbmxpbmUnIDogZmFsc2UsXG4gICAgICAgICAgY29tcGFjdDogZmFsc2UsXG4gICAgICAgICAgY29uZmlnRmlsZTogZmFsc2UsXG4gICAgICAgICAgYmFiZWxyYzogZmFsc2UsXG4gICAgICAgICAgYnJvd3NlcnNsaXN0Q29uZmlnRmlsZTogZmFsc2UsXG4gICAgICAgICAgcGx1Z2luczogW10sXG4gICAgICAgICAgcHJlc2V0czogW1xuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICBhbmd1bGFyQXBwbGljYXRpb25QcmVzZXQsXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBhbmd1bGFyTGlua2VyOiB7XG4gICAgICAgICAgICAgICAgICBzaG91bGRMaW5rLFxuICAgICAgICAgICAgICAgICAgaml0TW9kZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICBsaW5rZXJQbHVnaW5DcmVhdG9yLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uLFxuICAgICAgICAgICAgICAgIG9wdGltaXplOiBwbHVnaW5PcHRpb25zLmFkdmFuY2VkT3B0aW1pemF0aW9ucyAmJiB7XG4gICAgICAgICAgICAgICAgICBsb29zZUVudW1zOiBhbmd1bGFyUGFja2FnZSxcbiAgICAgICAgICAgICAgICAgIHB1cmVUb3BMZXZlbDogYW5ndWxhclBhY2thZ2UsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50czogcmVzdWx0Py5jb2RlID8/IGRhdGEsXG4gICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICB9O1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uRW5kKChyZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLmxlbmd0aCkge1xuICAgICAgICAgIHJlc3VsdC5vdXRwdXRGaWxlcz8ucHVzaCguLi5zdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUZpbGVFbWl0dGVyKFxuICBwcm9ncmFtOiB0cy5CdWlsZGVyUHJvZ3JhbSxcbiAgdHJhbnNmb3JtZXJzOiB0cy5DdXN0b21UcmFuc2Zvcm1lcnMgPSB7fSxcbiAgb25BZnRlckVtaXQ/OiAoc291cmNlRmlsZTogdHMuU291cmNlRmlsZSkgPT4gdm9pZCxcbik6IEZpbGVFbWl0dGVyIHtcbiAgcmV0dXJuIGFzeW5jIChmaWxlOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBzb3VyY2VGaWxlID0gcHJvZ3JhbS5nZXRTb3VyY2VGaWxlKGZpbGUpO1xuICAgIGlmICghc291cmNlRmlsZSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBsZXQgY29udGVudDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIHByb2dyYW0uZW1pdChcbiAgICAgIHNvdXJjZUZpbGUsXG4gICAgICAoZmlsZW5hbWUsIGRhdGEpID0+IHtcbiAgICAgICAgaWYgKC9cXC5bY21dP2pzJC8udGVzdChmaWxlbmFtZSkpIHtcbiAgICAgICAgICBjb250ZW50ID0gZGF0YTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHVuZGVmaW5lZCAvKiBjYW5jZWxsYXRpb25Ub2tlbiAqLyxcbiAgICAgIHVuZGVmaW5lZCAvKiBlbWl0T25seUR0c0ZpbGVzICovLFxuICAgICAgdHJhbnNmb3JtZXJzLFxuICAgICk7XG5cbiAgICBvbkFmdGVyRW1pdD8uKHNvdXJjZUZpbGUpO1xuXG4gICAgcmV0dXJuIHsgY29udGVudCwgZGVwZW5kZW5jaWVzOiBbXSB9O1xuICB9O1xufVxuIl19