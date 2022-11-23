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
const assert = __importStar(require("node:assert"));
const node_os_1 = require("node:os");
const path = __importStar(require("node:path"));
const node_url_1 = require("node:url");
const typescript_1 = __importDefault(require("typescript"));
const environment_options_1 = require("../../utils/environment-options");
const angular_compilation_1 = require("./angular-compilation");
const javascript_transformer_1 = require("./javascript-transformer");
const profiling_1 = require("./profiling");
const stylesheets_1 = require("./stylesheets");
/**
 * Converts TypeScript Diagnostic related information into an esbuild compatible note object.
 * Related information is a subset of a full TypeScript Diagnostic and also used for diagnostic
 * notes associated with the main Diagnostic.
 * @param info The TypeScript diagnostic relative information to convert.
 * @returns An esbuild diagnostic message as a PartialMessage object
 */
function convertTypeScriptDiagnosticInfo(info, textPrefix) {
    const newLine = (0, node_os_1.platform)() === 'win32' ? '\r\n' : '\n';
    let text = typescript_1.default.flattenDiagnosticMessageText(info.messageText, newLine);
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
 * @returns An esbuild diagnostic message as a PartialMessage object
 */
function convertTypeScriptDiagnostic(diagnostic) {
    var _a;
    let codePrefix = 'TS';
    let code = `${diagnostic.code}`;
    if (diagnostic.source === 'ngtsc') {
        codePrefix = 'NG';
        // Remove `-99` Angular prefix from diagnostic code
        code = code.slice(3);
    }
    const message = {
        ...convertTypeScriptDiagnosticInfo(diagnostic, `${codePrefix}${code}: `),
        // Store original diagnostic for reference if needed downstream
        detail: diagnostic,
    };
    if ((_a = diagnostic.relatedInformation) === null || _a === void 0 ? void 0 : _a.length) {
        message.notes = diagnostic.relatedInformation.map((info) => convertTypeScriptDiagnosticInfo(info));
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
// eslint-disable-next-line max-lines-per-function
function createCompilerPlugin(pluginOptions, styleOptions) {
    return {
        name: 'angular-compiler',
        // eslint-disable-next-line max-lines-per-function
        async setup(build) {
            var _a, _b;
            var _c;
            let setupWarnings;
            // Initialize a worker pool for JavaScript transformations
            const javascriptTransformer = new javascript_transformer_1.JavaScriptTransformer(pluginOptions, environment_options_1.maxWorkers);
            const { GLOBAL_DEFS_FOR_TERSER_WITH_AOT, readConfiguration } = await angular_compilation_1.AngularCompilation.loadCompilerCli();
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
            let compilation;
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
                // Create Angular compiler host options
                const hostOptions = {
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
                };
                // Create new compilation if first build; otherwise, use existing for rebuilds
                compilation !== null && compilation !== void 0 ? compilation : (compilation = new angular_compilation_1.AngularCompilation());
                // Initialize the Angular compilation for the current build.
                // In watch mode, previous build state will be reused.
                const { affectedFiles } = await compilation.initialize(rootNames, compilerOptions, hostOptions, configurationDiagnostics);
                // Clear affected files from the cache (if present)
                if (pluginOptions.sourceFileCache) {
                    for (const affected of affectedFiles) {
                        pluginOptions.sourceFileCache.typeScriptFileCache.delete((0, node_url_1.pathToFileURL)(affected.fileName).href);
                    }
                }
                (0, profiling_1.profileSync)('NG_DIAGNOSTICS_TOTAL', () => {
                    var _a, _b;
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    for (const diagnostic of compilation.collectDiagnostics()) {
                        const message = convertTypeScriptDiagnostic(diagnostic);
                        if (diagnostic.category === typescript_1.default.DiagnosticCategory.Error) {
                            ((_a = result.errors) !== null && _a !== void 0 ? _a : (result.errors = [])).push(message);
                        }
                        else {
                            ((_b = result.warnings) !== null && _b !== void 0 ? _b : (result.warnings = [])).push(message);
                        }
                    }
                });
                fileEmitter = compilation.createFileEmitter();
                return result;
            });
            build.onLoad({ filter: compilerOptions.allowJs ? /\.[cm]?[jt]sx?$/ : /\.[cm]?tsx?$/ }, (args) => (0, profiling_1.profileAsync)('NG_EMIT_TS*', async () => {
                var _a, _b, _c, _d, _e;
                assert.ok(fileEmitter, 'Invalid plugin execution order');
                const request = (_b = (_a = pluginOptions.fileReplacements) === null || _a === void 0 ? void 0 : _a[args.path]) !== null && _b !== void 0 ? _b : args.path;
                // The filename is currently used as a cache key. Since the cache is memory only,
                // the options cannot change and do not need to be represented in the key. If the
                // cache is later stored to disk, then the options that affect transform output
                // would need to be added to the key as well as a check for any change of content.
                let contents = (_c = pluginOptions.sourceFileCache) === null || _c === void 0 ? void 0 : _c.typeScriptFileCache.get((0, node_url_1.pathToFileURL)(request).href);
                if (contents === undefined) {
                    const typescriptResult = await fileEmitter(request);
                    if (!(typescriptResult === null || typescriptResult === void 0 ? void 0 : typescriptResult.content)) {
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
                    contents = await javascriptTransformer.transformData(request, typescriptResult.content, true /* skipLinker */);
                    (_e = pluginOptions.sourceFileCache) === null || _e === void 0 ? void 0 : _e.typeScriptFileCache.set((0, node_url_1.pathToFileURL)(request).href, contents);
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
                    contents = await javascriptTransformer.transformFile(args.path);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVVILG9EQUFzQztBQUN0QyxxQ0FBbUM7QUFDbkMsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUN6Qyw0REFBNEI7QUFDNUIseUVBQTZEO0FBQzdELCtEQUF3RTtBQUV4RSxxRUFBaUU7QUFDakUsMkNBS3FCO0FBQ3JCLCtDQUFvRztBQUVwRzs7Ozs7O0dBTUc7QUFDSCxTQUFTLCtCQUErQixDQUN0QyxJQUFxQyxFQUNyQyxVQUFtQjtJQUVuQixNQUFNLE9BQU8sR0FBRyxJQUFBLGtCQUFRLEdBQUUsS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQ3ZELElBQUksSUFBSSxHQUFHLG9CQUFFLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN0RSxJQUFJLFVBQVUsRUFBRTtRQUNkLElBQUksR0FBRyxVQUFVLEdBQUcsSUFBSSxDQUFDO0tBQzFCO0lBRUQsTUFBTSxJQUFJLEdBQWdCLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFFbkMsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO1FBQ2IsSUFBSSxDQUFDLFFBQVEsR0FBRztZQUNkLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVE7WUFDeEIsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO1NBQ3BCLENBQUM7UUFFRiw0RkFBNEY7UUFDNUYsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ2QsTUFB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QUFNLENBQUMsV0FBVywwQ0FBRSxJQUFJLENBQUMsR0FBRyx1QkFBdUIsQ0FBQyxDQUFDO2lCQUN0RDtnQkFFRCxJQUFBLGtDQUFzQixHQUFFLENBQUM7WUFDM0IsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFwUUQsb0RBb1FDO0FBRUQsU0FBUyxzQkFBc0IsQ0FBQyxPQUFlLEVBQUUsUUFBZ0IsRUFBRSxJQUFZO0lBQzdFLE1BQU0sS0FBSyxHQUFHO1FBQ1osSUFBSSxFQUFFLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLCtDQUErQztRQUMxRixLQUFLLEVBQUU7WUFDTDtnQkFDRSxJQUFJLEVBQUUsMEZBQTBGO2FBQ2pHO1NBQ0Y7S0FDRixDQUFDO0lBRUYsSUFBSSxPQUFPLEtBQUssUUFBUSxFQUFFO1FBQ3hCLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ2YsSUFBSSxFQUFFLGlEQUFpRCxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsSUFBSTtTQUN6RixDQUFDLENBQUM7S0FDSjtJQUVELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIE9uU3RhcnRSZXN1bHQsXG4gIE91dHB1dEZpbGUsXG4gIFBhcnRpYWxNZXNzYWdlLFxuICBQYXJ0aWFsTm90ZSxcbiAgUGx1Z2luLFxuICBQbHVnaW5CdWlsZCxcbn0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICdub2RlOm9zJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBtYXhXb3JrZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBBbmd1bGFyQ29tcGlsYXRpb24sIEZpbGVFbWl0dGVyIH0gZnJvbSAnLi9hbmd1bGFyLWNvbXBpbGF0aW9uJztcbmltcG9ydCB7IEFuZ3VsYXJIb3N0T3B0aW9ucyB9IGZyb20gJy4vYW5ndWxhci1ob3N0JztcbmltcG9ydCB7IEphdmFTY3JpcHRUcmFuc2Zvcm1lciB9IGZyb20gJy4vamF2YXNjcmlwdC10cmFuc2Zvcm1lcic7XG5pbXBvcnQge1xuICBsb2dDdW11bGF0aXZlRHVyYXRpb25zLFxuICBwcm9maWxlQXN5bmMsXG4gIHByb2ZpbGVTeW5jLFxuICByZXNldEN1bXVsYXRpdmVEdXJhdGlvbnMsXG59IGZyb20gJy4vcHJvZmlsaW5nJztcbmltcG9ydCB7IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLCBidW5kbGVTdHlsZXNoZWV0RmlsZSwgYnVuZGxlU3R5bGVzaGVldFRleHQgfSBmcm9tICcuL3N0eWxlc2hlZXRzJztcblxuLyoqXG4gKiBDb252ZXJ0cyBUeXBlU2NyaXB0IERpYWdub3N0aWMgcmVsYXRlZCBpbmZvcm1hdGlvbiBpbnRvIGFuIGVzYnVpbGQgY29tcGF0aWJsZSBub3RlIG9iamVjdC5cbiAqIFJlbGF0ZWQgaW5mb3JtYXRpb24gaXMgYSBzdWJzZXQgb2YgYSBmdWxsIFR5cGVTY3JpcHQgRGlhZ25vc3RpYyBhbmQgYWxzbyB1c2VkIGZvciBkaWFnbm9zdGljXG4gKiBub3RlcyBhc3NvY2lhdGVkIHdpdGggdGhlIG1haW4gRGlhZ25vc3RpYy5cbiAqIEBwYXJhbSBpbmZvIFRoZSBUeXBlU2NyaXB0IGRpYWdub3N0aWMgcmVsYXRpdmUgaW5mb3JtYXRpb24gdG8gY29udmVydC5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgZGlhZ25vc3RpYyBtZXNzYWdlIGFzIGEgUGFydGlhbE1lc3NhZ2Ugb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oXG4gIGluZm86IHRzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24sXG4gIHRleHRQcmVmaXg/OiBzdHJpbmcsXG4pOiBQYXJ0aWFsTm90ZSB7XG4gIGNvbnN0IG5ld0xpbmUgPSBwbGF0Zm9ybSgpID09PSAnd2luMzInID8gJ1xcclxcbicgOiAnXFxuJztcbiAgbGV0IHRleHQgPSB0cy5mbGF0dGVuRGlhZ25vc3RpY01lc3NhZ2VUZXh0KGluZm8ubWVzc2FnZVRleHQsIG5ld0xpbmUpO1xuICBpZiAodGV4dFByZWZpeCkge1xuICAgIHRleHQgPSB0ZXh0UHJlZml4ICsgdGV4dDtcbiAgfVxuXG4gIGNvbnN0IG5vdGU6IFBhcnRpYWxOb3RlID0geyB0ZXh0IH07XG5cbiAgaWYgKGluZm8uZmlsZSkge1xuICAgIG5vdGUubG9jYXRpb24gPSB7XG4gICAgICBmaWxlOiBpbmZvLmZpbGUuZmlsZU5hbWUsXG4gICAgICBsZW5ndGg6IGluZm8ubGVuZ3RoLFxuICAgIH07XG5cbiAgICAvLyBDYWxjdWxhdGUgdGhlIGxpbmUvY29sdW1uIGxvY2F0aW9uIGFuZCBleHRyYWN0IHRoZSBmdWxsIGxpbmUgdGV4dCB0aGF0IGhhcyB0aGUgZGlhZ25vc3RpY1xuICAgIGlmIChpbmZvLnN0YXJ0KSB7XG4gICAgICBjb25zdCB7IGxpbmUsIGNoYXJhY3RlciB9ID0gdHMuZ2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24oaW5mby5maWxlLCBpbmZvLnN0YXJ0KTtcbiAgICAgIG5vdGUubG9jYXRpb24ubGluZSA9IGxpbmUgKyAxO1xuICAgICAgbm90ZS5sb2NhdGlvbi5jb2x1bW4gPSBjaGFyYWN0ZXI7XG5cbiAgICAgIC8vIFRoZSBzdGFydCBwb3NpdGlvbiBmb3IgdGhlIHNsaWNlIGlzIHRoZSBmaXJzdCBjaGFyYWN0ZXIgb2YgdGhlIGVycm9yIGxpbmVcbiAgICAgIGNvbnN0IGxpbmVTdGFydFBvc2l0aW9uID0gdHMuZ2V0UG9zaXRpb25PZkxpbmVBbmRDaGFyYWN0ZXIoaW5mby5maWxlLCBsaW5lLCAwKTtcblxuICAgICAgLy8gVGhlIGVuZCBwb3NpdGlvbiBmb3IgdGhlIHNsaWNlIGlzIHRoZSBmaXJzdCBjaGFyYWN0ZXIgb2YgdGhlIG5leHQgbGluZSBvciB0aGUgbGVuZ3RoIG9mXG4gICAgICAvLyB0aGUgZW50aXJlIGZpbGUgaWYgdGhlIGxpbmUgaXMgdGhlIGxhc3QgbGluZSBvZiB0aGUgZmlsZSAoZ2V0UG9zaXRpb25PZkxpbmVBbmRDaGFyYWN0ZXJcbiAgICAgIC8vIHdpbGwgZXJyb3IgaWYgYSBub25leGlzdGVudCBsaW5lIGlzIHBhc3NlZCkuXG4gICAgICBjb25zdCB7IGxpbmU6IGxhc3RMaW5lT2ZGaWxlIH0gPSB0cy5nZXRMaW5lQW5kQ2hhcmFjdGVyT2ZQb3NpdGlvbihcbiAgICAgICAgaW5mby5maWxlLFxuICAgICAgICBpbmZvLmZpbGUudGV4dC5sZW5ndGggLSAxLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGxpbmVFbmRQb3NpdGlvbiA9XG4gICAgICAgIGxpbmUgPCBsYXN0TGluZU9mRmlsZVxuICAgICAgICAgID8gdHMuZ2V0UG9zaXRpb25PZkxpbmVBbmRDaGFyYWN0ZXIoaW5mby5maWxlLCBsaW5lICsgMSwgMClcbiAgICAgICAgICA6IGluZm8uZmlsZS50ZXh0Lmxlbmd0aDtcblxuICAgICAgbm90ZS5sb2NhdGlvbi5saW5lVGV4dCA9IGluZm8uZmlsZS50ZXh0LnNsaWNlKGxpbmVTdGFydFBvc2l0aW9uLCBsaW5lRW5kUG9zaXRpb24pLnRyaW1FbmQoKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbm90ZTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBhIFR5cGVTY3JpcHQgRGlhZ25vc3RpYyBtZXNzYWdlIGludG8gYW4gZXNidWlsZCBjb21wYXRpYmxlIG1lc3NhZ2Ugb2JqZWN0LlxuICogQHBhcmFtIGRpYWdub3N0aWMgVGhlIFR5cGVTY3JpcHQgZGlhZ25vc3RpYyB0byBjb252ZXJ0LlxuICogQHJldHVybnMgQW4gZXNidWlsZCBkaWFnbm9zdGljIG1lc3NhZ2UgYXMgYSBQYXJ0aWFsTWVzc2FnZSBvYmplY3RcbiAqL1xuZnVuY3Rpb24gY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljKGRpYWdub3N0aWM6IHRzLkRpYWdub3N0aWMpOiBQYXJ0aWFsTWVzc2FnZSB7XG4gIGxldCBjb2RlUHJlZml4ID0gJ1RTJztcbiAgbGV0IGNvZGUgPSBgJHtkaWFnbm9zdGljLmNvZGV9YDtcbiAgaWYgKGRpYWdub3N0aWMuc291cmNlID09PSAnbmd0c2MnKSB7XG4gICAgY29kZVByZWZpeCA9ICdORyc7XG4gICAgLy8gUmVtb3ZlIGAtOTlgIEFuZ3VsYXIgcHJlZml4IGZyb20gZGlhZ25vc3RpYyBjb2RlXG4gICAgY29kZSA9IGNvZGUuc2xpY2UoMyk7XG4gIH1cblxuICBjb25zdCBtZXNzYWdlOiBQYXJ0aWFsTWVzc2FnZSA9IHtcbiAgICAuLi5jb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWNJbmZvKGRpYWdub3N0aWMsIGAke2NvZGVQcmVmaXh9JHtjb2RlfTogYCksXG4gICAgLy8gU3RvcmUgb3JpZ2luYWwgZGlhZ25vc3RpYyBmb3IgcmVmZXJlbmNlIGlmIG5lZWRlZCBkb3duc3RyZWFtXG4gICAgZGV0YWlsOiBkaWFnbm9zdGljLFxuICB9O1xuXG4gIGlmIChkaWFnbm9zdGljLnJlbGF0ZWRJbmZvcm1hdGlvbj8ubGVuZ3RoKSB7XG4gICAgbWVzc2FnZS5ub3RlcyA9IGRpYWdub3N0aWMucmVsYXRlZEluZm9ybWF0aW9uLm1hcCgoaW5mbykgPT5cbiAgICAgIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oaW5mbyksXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBtZXNzYWdlO1xufVxuXG5jb25zdCBVU0lOR19XSU5ET1dTID0gcGxhdGZvcm0oKSA9PT0gJ3dpbjMyJztcbmNvbnN0IFdJTkRPV1NfU0VQX1JFR0VYUCA9IG5ldyBSZWdFeHAoYFxcXFwke3BhdGgud2luMzIuc2VwfWAsICdnJyk7XG5cbmV4cG9ydCBjbGFzcyBTb3VyY2VGaWxlQ2FjaGUgZXh0ZW5kcyBNYXA8c3RyaW5nLCB0cy5Tb3VyY2VGaWxlPiB7XG4gIHJlYWRvbmx5IG1vZGlmaWVkRmlsZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcmVhZG9ubHkgYmFiZWxGaWxlQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgVWludDhBcnJheT4oKTtcbiAgcmVhZG9ubHkgdHlwZVNjcmlwdEZpbGVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBVaW50OEFycmF5PigpO1xuXG4gIGludmFsaWRhdGUoZmlsZXM6IEl0ZXJhYmxlPHN0cmluZz4pOiB2b2lkIHtcbiAgICB0aGlzLm1vZGlmaWVkRmlsZXMuY2xlYXIoKTtcbiAgICBmb3IgKGxldCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICB0aGlzLmJhYmVsRmlsZUNhY2hlLmRlbGV0ZShmaWxlKTtcbiAgICAgIHRoaXMudHlwZVNjcmlwdEZpbGVDYWNoZS5kZWxldGUocGF0aFRvRmlsZVVSTChmaWxlKS5ocmVmKTtcblxuICAgICAgLy8gTm9ybWFsaXplIHNlcGFyYXRvcnMgdG8gYWxsb3cgbWF0Y2hpbmcgVHlwZVNjcmlwdCBIb3N0IHBhdGhzXG4gICAgICBpZiAoVVNJTkdfV0lORE9XUykge1xuICAgICAgICBmaWxlID0gZmlsZS5yZXBsYWNlKFdJTkRPV1NfU0VQX1JFR0VYUCwgcGF0aC5wb3NpeC5zZXApO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmRlbGV0ZShmaWxlKTtcbiAgICAgIHRoaXMubW9kaWZpZWRGaWxlcy5hZGQoZmlsZSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZXJQbHVnaW5PcHRpb25zIHtcbiAgc291cmNlbWFwOiBib29sZWFuO1xuICB0c2NvbmZpZzogc3RyaW5nO1xuICBhZHZhbmNlZE9wdGltaXphdGlvbnM/OiBib29sZWFuO1xuICB0aGlyZFBhcnR5U291cmNlbWFwcz86IGJvb2xlYW47XG4gIGZpbGVSZXBsYWNlbWVudHM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGU7XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gIHBsdWdpbk9wdGlvbnM6IENvbXBpbGVyUGx1Z2luT3B0aW9ucyxcbiAgc3R5bGVPcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyxcbik6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItY29tcGlsZXInLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG4gICAgYXN5bmMgc2V0dXAoYnVpbGQ6IFBsdWdpbkJ1aWxkKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICBsZXQgc2V0dXBXYXJuaW5nczogUGFydGlhbE1lc3NhZ2VbXSB8IHVuZGVmaW5lZDtcblxuICAgICAgLy8gSW5pdGlhbGl6ZSBhIHdvcmtlciBwb29sIGZvciBKYXZhU2NyaXB0IHRyYW5zZm9ybWF0aW9uc1xuICAgICAgY29uc3QgamF2YXNjcmlwdFRyYW5zZm9ybWVyID0gbmV3IEphdmFTY3JpcHRUcmFuc2Zvcm1lcihwbHVnaW5PcHRpb25zLCBtYXhXb3JrZXJzKTtcblxuICAgICAgY29uc3QgeyBHTE9CQUxfREVGU19GT1JfVEVSU0VSX1dJVEhfQU9ULCByZWFkQ29uZmlndXJhdGlvbiB9ID1cbiAgICAgICAgYXdhaXQgQW5ndWxhckNvbXBpbGF0aW9uLmxvYWRDb21waWxlckNsaSgpO1xuXG4gICAgICAvLyBTZXR1cCBkZWZpbmVzIGJhc2VkIG9uIHRoZSB2YWx1ZXMgcHJvdmlkZWQgYnkgdGhlIEFuZ3VsYXIgY29tcGlsZXItY2xpXG4gICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUgPz89IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCkpIHtcbiAgICAgICAgaWYgKGtleSBpbiBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUpIHtcbiAgICAgICAgICAvLyBTa2lwIGtleXMgdGhhdCBoYXZlIGJlZW4gbWFudWFsbHkgcHJvdmlkZWRcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBlc2J1aWxkIHJlcXVpcmVzIHZhbHVlcyB0byBiZSBhIHN0cmluZyAoYWN0dWFsIHN0cmluZ3MgbmVlZCB0byBiZSBxdW90ZWQpLlxuICAgICAgICAvLyBJbiB0aGlzIGNhc2UsIGFsbCBwcm92aWRlZCB2YWx1ZXMgYXJlIGJvb2xlYW5zLlxuICAgICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmVba2V5XSA9IHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSB0c2NvbmZpZyBpcyBsb2FkZWQgaW4gc2V0dXAgaW5zdGVhZCBvZiBpbiBzdGFydCB0byBhbGxvdyB0aGUgZXNidWlsZCB0YXJnZXQgYnVpbGQgb3B0aW9uIHRvIGJlIG1vZGlmaWVkLlxuICAgICAgLy8gZXNidWlsZCBidWlsZCBvcHRpb25zIGNhbiBvbmx5IGJlIG1vZGlmaWVkIGluIHNldHVwIHByaW9yIHRvIHN0YXJ0aW5nIHRoZSBidWlsZC5cbiAgICAgIGNvbnN0IHtcbiAgICAgICAgb3B0aW9uczogY29tcGlsZXJPcHRpb25zLFxuICAgICAgICByb290TmFtZXMsXG4gICAgICAgIGVycm9yczogY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgICAgfSA9IHByb2ZpbGVTeW5jKCdOR19SRUFEX0NPTkZJRycsICgpID0+XG4gICAgICAgIHJlYWRDb25maWd1cmF0aW9uKHBsdWdpbk9wdGlvbnMudHNjb25maWcsIHtcbiAgICAgICAgICBub0VtaXRPbkVycm9yOiBmYWxzZSxcbiAgICAgICAgICBzdXBwcmVzc091dHB1dFBhdGhDaGVjazogdHJ1ZSxcbiAgICAgICAgICBvdXREaXI6IHVuZGVmaW5lZCxcbiAgICAgICAgICBpbmxpbmVTb3VyY2VzOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICBpbmxpbmVTb3VyY2VNYXA6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgIHNvdXJjZU1hcDogZmFsc2UsXG4gICAgICAgICAgbWFwUm9vdDogdW5kZWZpbmVkLFxuICAgICAgICAgIHNvdXJjZVJvb3Q6IHVuZGVmaW5lZCxcbiAgICAgICAgICBkZWNsYXJhdGlvbjogZmFsc2UsXG4gICAgICAgICAgZGVjbGFyYXRpb25NYXA6IGZhbHNlLFxuICAgICAgICAgIGFsbG93RW1wdHlDb2RlZ2VuRmlsZXM6IGZhbHNlLFxuICAgICAgICAgIGFubm90YXRpb25zQXM6ICdkZWNvcmF0b3JzJyxcbiAgICAgICAgICBlbmFibGVSZXNvdXJjZUlubGluaW5nOiBmYWxzZSxcbiAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgICBpZiAoY29tcGlsZXJPcHRpb25zLnRhcmdldCA9PT0gdW5kZWZpbmVkIHx8IGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPCB0cy5TY3JpcHRUYXJnZXQuRVMyMDIyKSB7XG4gICAgICAgIC8vIElmICd1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkcycgaXMgYWxyZWFkeSBkZWZpbmVkIGluIHRoZSB1c2VycyBwcm9qZWN0IGxlYXZlIHRoZSB2YWx1ZSBhcyBpcy5cbiAgICAgICAgLy8gT3RoZXJ3aXNlIGZhbGxiYWNrIHRvIGZhbHNlIGR1ZSB0byBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzQ1OTk1XG4gICAgICAgIC8vIHdoaWNoIGJyZWFrcyB0aGUgZGVwcmVjYXRlZCBgQEVmZmVjdHNgIE5HUlggZGVjb3JhdG9yIGFuZCBwb3RlbnRpYWxseSBvdGhlciBleGlzdGluZyBjb2RlIGFzIHdlbGwuXG4gICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPSB0cy5TY3JpcHRUYXJnZXQuRVMyMDIyO1xuICAgICAgICBjb21waWxlck9wdGlvbnMudXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHMgPz89IGZhbHNlO1xuXG4gICAgICAgIChzZXR1cFdhcm5pbmdzID8/PSBbXSkucHVzaCh7XG4gICAgICAgICAgdGV4dDpcbiAgICAgICAgICAgICdUeXBlU2NyaXB0IGNvbXBpbGVyIG9wdGlvbnMgXCJ0YXJnZXRcIiBhbmQgXCJ1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkc1wiIGFyZSBzZXQgdG8gXCJFUzIwMjJcIiBhbmQgJyArXG4gICAgICAgICAgICAnXCJmYWxzZVwiIHJlc3BlY3RpdmVseSBieSB0aGUgQW5ndWxhciBDTEkuJyxcbiAgICAgICAgICBsb2NhdGlvbjogeyBmaWxlOiBwbHVnaW5PcHRpb25zLnRzY29uZmlnIH0sXG4gICAgICAgICAgbm90ZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdGV4dDpcbiAgICAgICAgICAgICAgICAnVG8gY29udHJvbCBFQ01BIHZlcnNpb24gYW5kIGZlYXR1cmVzIHVzZSB0aGUgQnJvd2Vyc2xpc3QgY29uZmlndXJhdGlvbi4gJyArXG4gICAgICAgICAgICAgICAgJ0ZvciBtb3JlIGluZm9ybWF0aW9uLCBzZWUgaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2J1aWxkI2NvbmZpZ3VyaW5nLWJyb3dzZXItY29tcGF0aWJpbGl0eScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgZmlsZSBlbWl0dGVyIGNyZWF0ZWQgZHVyaW5nIGBvblN0YXJ0YCB0aGF0IHdpbGwgYmUgdXNlZCBkdXJpbmcgdGhlIGJ1aWxkIGluIGBvbkxvYWRgIGNhbGxiYWNrcyBmb3IgVFMgZmlsZXNcbiAgICAgIGxldCBmaWxlRW1pdHRlcjogRmlsZUVtaXR0ZXIgfCB1bmRlZmluZWQ7XG5cbiAgICAgIC8vIFRoZSBzdHlsZXNoZWV0IHJlc291cmNlcyBmcm9tIGNvbXBvbmVudCBzdHlsZXNoZWV0cyB0aGF0IHdpbGwgYmUgYWRkZWQgdG8gdGhlIGJ1aWxkIHJlc3VsdHMgb3V0cHV0IGZpbGVzXG4gICAgICBsZXQgc3R5bGVzaGVldFJlc291cmNlRmlsZXM6IE91dHB1dEZpbGVbXTtcblxuICAgICAgbGV0IGNvbXBpbGF0aW9uOiBBbmd1bGFyQ29tcGlsYXRpb24gfCB1bmRlZmluZWQ7XG5cbiAgICAgIGJ1aWxkLm9uU3RhcnQoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQ6IE9uU3RhcnRSZXN1bHQgPSB7XG4gICAgICAgICAgd2FybmluZ3M6IHNldHVwV2FybmluZ3MsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gUmVzZXQgdGhlIHNldHVwIHdhcm5pbmdzIHNvIHRoYXQgdGhleSBhcmUgb25seSBzaG93biBkdXJpbmcgdGhlIGZpcnN0IGJ1aWxkLlxuICAgICAgICBzZXR1cFdhcm5pbmdzID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIC8vIFJlc2V0IGRlYnVnIHBlcmZvcm1hbmNlIHRyYWNraW5nXG4gICAgICAgIHJlc2V0Q3VtdWxhdGl2ZUR1cmF0aW9ucygpO1xuXG4gICAgICAgIC8vIFJlc2V0IHN0eWxlc2hlZXQgcmVzb3VyY2Ugb3V0cHV0IGZpbGVzXG4gICAgICAgIHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzID0gW107XG5cbiAgICAgICAgLy8gQ3JlYXRlIEFuZ3VsYXIgY29tcGlsZXIgaG9zdCBvcHRpb25zXG4gICAgICAgIGNvbnN0IGhvc3RPcHRpb25zOiBBbmd1bGFySG9zdE9wdGlvbnMgPSB7XG4gICAgICAgICAgZmlsZVJlcGxhY2VtZW50czogcGx1Z2luT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzLFxuICAgICAgICAgIG1vZGlmaWVkRmlsZXM6IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5tb2RpZmllZEZpbGVzLFxuICAgICAgICAgIHNvdXJjZUZpbGVDYWNoZTogcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUsXG4gICAgICAgICAgYXN5bmMgdHJhbnNmb3JtU3R5bGVzaGVldChkYXRhLCBjb250YWluaW5nRmlsZSwgc3R5bGVzaGVldEZpbGUpIHtcbiAgICAgICAgICAgIC8vIFN0eWxlc2hlZXQgZmlsZSBvbmx5IGV4aXN0cyBmb3IgZXh0ZXJuYWwgc3R5bGVzaGVldHNcbiAgICAgICAgICAgIGNvbnN0IGZpbGVuYW1lID0gc3R5bGVzaGVldEZpbGUgPz8gY29udGFpbmluZ0ZpbGU7XG5cbiAgICAgICAgICAgIC8vIFRlbXBvcmFyeSB3b3JrYXJvdW5kIGZvciBsYWNrIG9mIHZpcnR1YWwgZmlsZSBzdXBwb3J0IGluIHRoZSBTYXNzIHBsdWdpbi5cbiAgICAgICAgICAgIC8vIEV4dGVybmFsIFNhc3Mgc3R5bGVzaGVldHMgYXJlIHRyYW5zZm9ybWVkIHVzaW5nIHRoZSBmaWxlIGluc3RlYWQgb2YgdGhlIGFscmVhZHkgcmVhZCBjb250ZW50LlxuICAgICAgICAgICAgbGV0IHN0eWxlc2hlZXRSZXN1bHQ7XG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUuZW5kc1dpdGgoJy5zY3NzJykgfHwgZmlsZW5hbWUuZW5kc1dpdGgoJy5zYXNzJykpIHtcbiAgICAgICAgICAgICAgc3R5bGVzaGVldFJlc3VsdCA9IGF3YWl0IGJ1bmRsZVN0eWxlc2hlZXRGaWxlKGZpbGVuYW1lLCBzdHlsZU9wdGlvbnMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc3R5bGVzaGVldFJlc3VsdCA9IGF3YWl0IGJ1bmRsZVN0eWxlc2hlZXRUZXh0KFxuICAgICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgcmVzb2x2ZVBhdGg6IHBhdGguZGlybmFtZShmaWxlbmFtZSksXG4gICAgICAgICAgICAgICAgICB2aXJ0dWFsTmFtZTogZmlsZW5hbWUsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHsgY29udGVudHMsIHJlc291cmNlRmlsZXMsIGVycm9ycywgd2FybmluZ3MgfSA9IHN0eWxlc2hlZXRSZXN1bHQ7XG4gICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgICAgIHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLnB1c2goLi4ucmVzb3VyY2VGaWxlcyk7XG5cbiAgICAgICAgICAgIHJldHVybiBjb250ZW50cztcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIENyZWF0ZSBuZXcgY29tcGlsYXRpb24gaWYgZmlyc3QgYnVpbGQ7IG90aGVyd2lzZSwgdXNlIGV4aXN0aW5nIGZvciByZWJ1aWxkc1xuICAgICAgICBjb21waWxhdGlvbiA/Pz0gbmV3IEFuZ3VsYXJDb21waWxhdGlvbigpO1xuXG4gICAgICAgIC8vIEluaXRpYWxpemUgdGhlIEFuZ3VsYXIgY29tcGlsYXRpb24gZm9yIHRoZSBjdXJyZW50IGJ1aWxkLlxuICAgICAgICAvLyBJbiB3YXRjaCBtb2RlLCBwcmV2aW91cyBidWlsZCBzdGF0ZSB3aWxsIGJlIHJldXNlZC5cbiAgICAgICAgY29uc3QgeyBhZmZlY3RlZEZpbGVzIH0gPSBhd2FpdCBjb21waWxhdGlvbi5pbml0aWFsaXplKFxuICAgICAgICAgIHJvb3ROYW1lcyxcbiAgICAgICAgICBjb21waWxlck9wdGlvbnMsXG4gICAgICAgICAgaG9zdE9wdGlvbnMsXG4gICAgICAgICAgY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgICAgICApO1xuXG4gICAgICAgIC8vIENsZWFyIGFmZmVjdGVkIGZpbGVzIGZyb20gdGhlIGNhY2hlIChpZiBwcmVzZW50KVxuICAgICAgICBpZiAocGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGFmZmVjdGVkIG9mIGFmZmVjdGVkRmlsZXMpIHtcbiAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlLnR5cGVTY3JpcHRGaWxlQ2FjaGUuZGVsZXRlKFxuICAgICAgICAgICAgICBwYXRoVG9GaWxlVVJMKGFmZmVjdGVkLmZpbGVOYW1lKS5ocmVmLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBwcm9maWxlU3luYygnTkdfRElBR05PU1RJQ1NfVE9UQUwnLCAoKSA9PiB7XG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgICBmb3IgKGNvbnN0IGRpYWdub3N0aWMgb2YgY29tcGlsYXRpb24hLmNvbGxlY3REaWFnbm9zdGljcygpKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljKGRpYWdub3N0aWMpO1xuICAgICAgICAgICAgaWYgKGRpYWdub3N0aWMuY2F0ZWdvcnkgPT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcikge1xuICAgICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2gobWVzc2FnZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaChtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZpbGVFbWl0dGVyID0gY29tcGlsYXRpb24uY3JlYXRlRmlsZUVtaXR0ZXIoKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZChcbiAgICAgICAgeyBmaWx0ZXI6IGNvbXBpbGVyT3B0aW9ucy5hbGxvd0pzID8gL1xcLltjbV0/W2p0XXN4PyQvIDogL1xcLltjbV0/dHN4PyQvIH0sXG4gICAgICAgIChhcmdzKSA9PlxuICAgICAgICAgIHByb2ZpbGVBc3luYyhcbiAgICAgICAgICAgICdOR19FTUlUX1RTKicsXG4gICAgICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgIGFzc2VydC5vayhmaWxlRW1pdHRlciwgJ0ludmFsaWQgcGx1Z2luIGV4ZWN1dGlvbiBvcmRlcicpO1xuXG4gICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3QgPSBwbHVnaW5PcHRpb25zLmZpbGVSZXBsYWNlbWVudHM/LlthcmdzLnBhdGhdID8/IGFyZ3MucGF0aDtcblxuICAgICAgICAgICAgICAvLyBUaGUgZmlsZW5hbWUgaXMgY3VycmVudGx5IHVzZWQgYXMgYSBjYWNoZSBrZXkuIFNpbmNlIHRoZSBjYWNoZSBpcyBtZW1vcnkgb25seSxcbiAgICAgICAgICAgICAgLy8gdGhlIG9wdGlvbnMgY2Fubm90IGNoYW5nZSBhbmQgZG8gbm90IG5lZWQgdG8gYmUgcmVwcmVzZW50ZWQgaW4gdGhlIGtleS4gSWYgdGhlXG4gICAgICAgICAgICAgIC8vIGNhY2hlIGlzIGxhdGVyIHN0b3JlZCB0byBkaXNrLCB0aGVuIHRoZSBvcHRpb25zIHRoYXQgYWZmZWN0IHRyYW5zZm9ybSBvdXRwdXRcbiAgICAgICAgICAgICAgLy8gd291bGQgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUga2V5IGFzIHdlbGwgYXMgYSBjaGVjayBmb3IgYW55IGNoYW5nZSBvZiBjb250ZW50LlxuICAgICAgICAgICAgICBsZXQgY29udGVudHMgPSBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8udHlwZVNjcmlwdEZpbGVDYWNoZS5nZXQoXG4gICAgICAgICAgICAgICAgcGF0aFRvRmlsZVVSTChyZXF1ZXN0KS5ocmVmLFxuICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgIGlmIChjb250ZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdHlwZXNjcmlwdFJlc3VsdCA9IGF3YWl0IGZpbGVFbWl0dGVyKHJlcXVlc3QpO1xuICAgICAgICAgICAgICAgIGlmICghdHlwZXNjcmlwdFJlc3VsdD8uY29udGVudCkge1xuICAgICAgICAgICAgICAgICAgLy8gTm8gVFMgcmVzdWx0IGluZGljYXRlcyB0aGUgZmlsZSBpcyBub3QgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBwcm9ncmFtLlxuICAgICAgICAgICAgICAgICAgLy8gSWYgYWxsb3dKcyBpcyBlbmFibGVkIGFuZCB0aGUgZmlsZSBpcyBKUyB0aGVuIGRlZmVyIHRvIHRoZSBuZXh0IGxvYWQgaG9vay5cbiAgICAgICAgICAgICAgICAgIGlmIChjb21waWxlck9wdGlvbnMuYWxsb3dKcyAmJiAvXFwuW2NtXT9qcyQvLnRlc3QocmVxdWVzdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgLy8gT3RoZXJ3aXNlIHJldHVybiBhbiBlcnJvclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgY3JlYXRlTWlzc2luZ0ZpbGVFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzLnBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyID8/ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnRlbnRzID0gYXdhaXQgamF2YXNjcmlwdFRyYW5zZm9ybWVyLnRyYW5zZm9ybURhdGEoXG4gICAgICAgICAgICAgICAgICByZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgdHlwZXNjcmlwdFJlc3VsdC5jb250ZW50LFxuICAgICAgICAgICAgICAgICAgdHJ1ZSAvKiBza2lwTGlua2VyICovLFxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8udHlwZVNjcmlwdEZpbGVDYWNoZS5zZXQoXG4gICAgICAgICAgICAgICAgICBwYXRoVG9GaWxlVVJMKHJlcXVlc3QpLmhyZWYsXG4gICAgICAgICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICApLFxuICAgICAgKTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9qcyQvIH0sIChhcmdzKSA9PlxuICAgICAgICBwcm9maWxlQXN5bmMoXG4gICAgICAgICAgJ05HX0VNSVRfSlMqJyxcbiAgICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAvLyBUaGUgZmlsZW5hbWUgaXMgY3VycmVudGx5IHVzZWQgYXMgYSBjYWNoZSBrZXkuIFNpbmNlIHRoZSBjYWNoZSBpcyBtZW1vcnkgb25seSxcbiAgICAgICAgICAgIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAgICAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAgICAgLy8gd291bGQgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUga2V5IGFzIHdlbGwgYXMgYSBjaGVjayBmb3IgYW55IGNoYW5nZSBvZiBjb250ZW50LlxuICAgICAgICAgICAgbGV0IGNvbnRlbnRzID0gcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LmJhYmVsRmlsZUNhY2hlLmdldChhcmdzLnBhdGgpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgY29udGVudHMgPSBhd2FpdCBqYXZhc2NyaXB0VHJhbnNmb3JtZXIudHJhbnNmb3JtRmlsZShhcmdzLnBhdGgpO1xuICAgICAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8uYmFiZWxGaWxlQ2FjaGUuc2V0KGFyZ3MucGF0aCwgY29udGVudHMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICksXG4gICAgICApO1xuXG4gICAgICBidWlsZC5vbkVuZCgocmVzdWx0KSA9PiB7XG4gICAgICAgIGlmIChzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcy5sZW5ndGgpIHtcbiAgICAgICAgICByZXN1bHQub3V0cHV0RmlsZXM/LnB1c2goLi4uc3R5bGVzaGVldFJlc291cmNlRmlsZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgbG9nQ3VtdWxhdGl2ZUR1cmF0aW9ucygpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTWlzc2luZ0ZpbGVFcnJvcihyZXF1ZXN0OiBzdHJpbmcsIG9yaWdpbmFsOiBzdHJpbmcsIHJvb3Q6IHN0cmluZyk6IFBhcnRpYWxNZXNzYWdlIHtcbiAgY29uc3QgZXJyb3IgPSB7XG4gICAgdGV4dDogYEZpbGUgJyR7cGF0aC5yZWxhdGl2ZShyb290LCByZXF1ZXN0KX0nIGlzIG1pc3NpbmcgZnJvbSB0aGUgVHlwZVNjcmlwdCBjb21waWxhdGlvbi5gLFxuICAgIG5vdGVzOiBbXG4gICAgICB7XG4gICAgICAgIHRleHQ6IGBFbnN1cmUgdGhlIGZpbGUgaXMgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBwcm9ncmFtIHZpYSB0aGUgJ2ZpbGVzJyBvciAnaW5jbHVkZScgcHJvcGVydHkuYCxcbiAgICAgIH0sXG4gICAgXSxcbiAgfTtcblxuICBpZiAocmVxdWVzdCAhPT0gb3JpZ2luYWwpIHtcbiAgICBlcnJvci5ub3Rlcy5wdXNoKHtcbiAgICAgIHRleHQ6IGBGaWxlIGlzIHJlcXVlc3RlZCBmcm9tIGEgZmlsZSByZXBsYWNlbWVudCBvZiAnJHtwYXRoLnJlbGF0aXZlKHJvb3QsIG9yaWdpbmFsKX0nLmAsXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gZXJyb3I7XG59XG4iXX0=