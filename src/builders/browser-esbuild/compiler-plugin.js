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
 * A counter for component styles used to generate unique build-time identifiers for each stylesheet.
 */
let componentStyleCounter = 0;
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
                if (key === 'ngDevMode') {
                    // ngDevMode is already set based on the builder's script optimization option
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
            let stylesheetMetafiles;
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
                stylesheetMetafiles = [];
                // Create Angular compiler host options
                const hostOptions = {
                    fileReplacements: pluginOptions.fileReplacements,
                    modifiedFiles: (_a = pluginOptions.sourceFileCache) === null || _a === void 0 ? void 0 : _a.modifiedFiles,
                    sourceFileCache: pluginOptions.sourceFileCache,
                    async transformStylesheet(data, containingFile, stylesheetFile) {
                        var _a, _b;
                        // Stylesheet file only exists for external stylesheets
                        const filename = stylesheetFile !== null && stylesheetFile !== void 0 ? stylesheetFile : containingFile;
                        const stylesheetResult = await (0, stylesheets_1.bundleComponentStylesheet)(
                        // TODO: Evaluate usage of a fast hash instead
                        `${++componentStyleCounter}`, styleOptions.inlineStyleLanguage, data, filename, !stylesheetFile, styleOptions);
                        const { contents, resourceFiles, errors, warnings } = stylesheetResult;
                        ((_a = result.errors) !== null && _a !== void 0 ? _a : (result.errors = [])).push(...errors);
                        ((_b = result.warnings) !== null && _b !== void 0 ? _b : (result.warnings = [])).push(...warnings);
                        stylesheetResourceFiles.push(...resourceFiles);
                        if (stylesheetResult.metafile) {
                            stylesheetMetafiles.push(stylesheetResult.metafile);
                        }
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
                // Add any component stylesheet resource files to the output files
                if (stylesheetResourceFiles.length) {
                    (_a = result.outputFiles) === null || _a === void 0 ? void 0 : _a.push(...stylesheetResourceFiles);
                }
                // Combine component stylesheet metafiles with main metafile
                if (result.metafile && stylesheetMetafiles.length) {
                    for (const metafile of stylesheetMetafiles) {
                        result.metafile.inputs = { ...result.metafile.inputs, ...metafile.inputs };
                        result.metafile.outputs = { ...result.metafile.outputs, ...metafile.outputs };
                    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVdILG9EQUFzQztBQUN0QyxxQ0FBbUM7QUFDbkMsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUN6Qyw0REFBNEI7QUFDNUIseUVBQTZEO0FBQzdELCtEQUF3RTtBQUV4RSxxRUFBaUU7QUFDakUsMkNBS3FCO0FBQ3JCLCtDQUFtRjtBQUVuRjs7R0FFRztBQUNILElBQUkscUJBQXFCLEdBQUcsQ0FBQyxDQUFDO0FBRTlCOzs7Ozs7R0FNRztBQUNILFNBQVMsK0JBQStCLENBQ3RDLElBQXFDLEVBQ3JDLFVBQW1CO0lBRW5CLE1BQU0sT0FBTyxHQUFHLElBQUEsa0JBQVEsR0FBRSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDdkQsSUFBSSxJQUFJLEdBQUcsb0JBQUUsQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3RFLElBQUksVUFBVSxFQUFFO1FBQ2QsSUFBSSxHQUFHLFVBQVUsR0FBRyxJQUFJLENBQUM7S0FDMUI7SUFFRCxNQUFNLElBQUksR0FBZ0IsRUFBRSxJQUFJLEVBQUUsQ0FBQztJQUVuQyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUU7UUFDYixJQUFJLENBQUMsUUFBUSxHQUFHO1lBQ2QsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUTtZQUN4QixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07U0FDcEIsQ0FBQztRQUVGLDRGQUE0RjtRQUM1RixJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDZCxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLG9CQUFFLENBQUMsNkJBQTZCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDcEYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQztZQUM5QixJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxTQUFTLENBQUM7WUFFakMsNEVBQTRFO1lBQzVFLE1BQU0saUJBQWlCLEdBQUcsb0JBQUUsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztZQUUvRSwwRkFBMEY7WUFDMUYsMEZBQTBGO1lBQzFGLCtDQUErQztZQUMvQyxNQUFNLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxHQUFHLG9CQUFFLENBQUMsNkJBQTZCLENBQy9ELElBQUksQ0FBQyxJQUFJLEVBQ1QsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FDMUIsQ0FBQztZQUNGLE1BQU0sZUFBZSxHQUNuQixJQUFJLEdBQUcsY0FBYztnQkFDbkIsQ0FBQyxDQUFDLG9CQUFFLENBQUMsNkJBQTZCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDMUQsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztZQUU1QixJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsZUFBZSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7U0FDN0Y7S0FDRjtJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxTQUFTLDJCQUEyQixDQUFDLFVBQXlCOztJQUM1RCxJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUM7SUFDdEIsSUFBSSxJQUFJLEdBQUcsR0FBRyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDaEMsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLE9BQU8sRUFBRTtRQUNqQyxVQUFVLEdBQUcsSUFBSSxDQUFDO1FBQ2xCLG1EQUFtRDtRQUNuRCxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN0QjtJQUVELE1BQU0sT0FBTyxHQUFtQjtRQUM5QixHQUFHLCtCQUErQixDQUFDLFVBQVUsRUFBRSxHQUFHLFVBQVUsR0FBRyxJQUFJLElBQUksQ0FBQztRQUN4RSwrREFBK0Q7UUFDL0QsTUFBTSxFQUFFLFVBQVU7S0FDbkIsQ0FBQztJQUVGLElBQUksTUFBQSxVQUFVLENBQUMsa0JBQWtCLDBDQUFFLE1BQU0sRUFBRTtRQUN6QyxPQUFPLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUN6RCwrQkFBK0IsQ0FBQyxJQUFJLENBQUMsQ0FDdEMsQ0FBQztLQUNIO0lBRUQsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQztBQUVELE1BQU0sYUFBYSxHQUFHLElBQUEsa0JBQVEsR0FBRSxLQUFLLE9BQU8sQ0FBQztBQUM3QyxNQUFNLGtCQUFrQixHQUFHLElBQUksTUFBTSxDQUFDLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUVsRSxNQUFhLGVBQWdCLFNBQVEsR0FBMEI7SUFBL0Q7O1FBQ1csa0JBQWEsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO1FBQ2xDLG1CQUFjLEdBQUcsSUFBSSxHQUFHLEVBQXNCLENBQUM7UUFDL0Msd0JBQW1CLEdBQUcsSUFBSSxHQUFHLEVBQXNCLENBQUM7SUFpQi9ELENBQUM7SUFmQyxVQUFVLENBQUMsS0FBdUI7UUFDaEMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUMzQixLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssRUFBRTtZQUN0QixJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNqQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLElBQUEsd0JBQWEsRUFBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUUxRCwrREFBK0Q7WUFDL0QsSUFBSSxhQUFhLEVBQUU7Z0JBQ2pCLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGtCQUFrQixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7YUFDekQ7WUFFRCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2xCLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzlCO0lBQ0gsQ0FBQztDQUNGO0FBcEJELDBDQW9CQztBQVdELGtEQUFrRDtBQUNsRCxTQUFnQixvQkFBb0IsQ0FDbEMsYUFBb0MsRUFDcEMsWUFBdUU7SUFFdkUsT0FBTztRQUNMLElBQUksRUFBRSxrQkFBa0I7UUFDeEIsa0RBQWtEO1FBQ2xELEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBa0I7OztZQUM1QixJQUFJLGFBQTJDLENBQUM7WUFFaEQsMERBQTBEO1lBQzFELE1BQU0scUJBQXFCLEdBQUcsSUFBSSw4Q0FBcUIsQ0FBQyxhQUFhLEVBQUUsZ0NBQVUsQ0FBQyxDQUFDO1lBRW5GLE1BQU0sRUFBRSwrQkFBK0IsRUFBRSxpQkFBaUIsRUFBRSxHQUMxRCxNQUFNLHdDQUFrQixDQUFDLGVBQWUsRUFBRSxDQUFDO1lBRTdDLHlFQUF5RTtZQUN6RSxZQUFBLEtBQUssQ0FBQyxjQUFjLEVBQUMsTUFBTSx1Q0FBTixNQUFNLEdBQUssRUFBRSxFQUFDO1lBQ25DLEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLCtCQUErQixDQUFDLEVBQUU7Z0JBQzFFLElBQUksR0FBRyxJQUFJLEtBQUssQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFO29CQUN0Qyw2Q0FBNkM7b0JBQzdDLFNBQVM7aUJBQ1Y7Z0JBQ0QsSUFBSSxHQUFHLEtBQUssV0FBVyxFQUFFO29CQUN2Qiw2RUFBNkU7b0JBQzdFLFNBQVM7aUJBQ1Y7Z0JBQ0QsNkVBQTZFO2dCQUM3RSxrREFBa0Q7Z0JBQ2xELEtBQUssQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQzthQUNyRDtZQUVELCtHQUErRztZQUMvRyxtRkFBbUY7WUFDbkYsTUFBTSxFQUNKLE9BQU8sRUFBRSxlQUFlLEVBQ3hCLFNBQVMsRUFDVCxNQUFNLEVBQUUsd0JBQXdCLEdBQ2pDLEdBQUcsSUFBQSx1QkFBVyxFQUFDLGdCQUFnQixFQUFFLEdBQUcsRUFBRSxDQUNyQyxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFO2dCQUN4QyxhQUFhLEVBQUUsS0FBSztnQkFDcEIsdUJBQXVCLEVBQUUsSUFBSTtnQkFDN0IsTUFBTSxFQUFFLFNBQVM7Z0JBQ2pCLGFBQWEsRUFBRSxhQUFhLENBQUMsU0FBUztnQkFDdEMsZUFBZSxFQUFFLGFBQWEsQ0FBQyxTQUFTO2dCQUN4QyxTQUFTLEVBQUUsS0FBSztnQkFDaEIsT0FBTyxFQUFFLFNBQVM7Z0JBQ2xCLFVBQVUsRUFBRSxTQUFTO2dCQUNyQixXQUFXLEVBQUUsS0FBSztnQkFDbEIsY0FBYyxFQUFFLEtBQUs7Z0JBQ3JCLHNCQUFzQixFQUFFLEtBQUs7Z0JBQzdCLGFBQWEsRUFBRSxZQUFZO2dCQUMzQixzQkFBc0IsRUFBRSxLQUFLO2FBQzlCLENBQUMsQ0FDSCxDQUFDO1lBRUYsSUFBSSxlQUFlLENBQUMsTUFBTSxLQUFLLFNBQVMsSUFBSSxlQUFlLENBQUMsTUFBTSxHQUFHLG9CQUFFLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRTtnQkFDM0YsOEZBQThGO2dCQUM5RiwwRkFBMEY7Z0JBQzFGLHFHQUFxRztnQkFDckcsZUFBZSxDQUFDLE1BQU0sR0FBRyxvQkFBRSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUM7Z0JBQ2hELE1BQUEsZUFBZSxDQUFDLHVCQUF1QixvQ0FBdkMsZUFBZSxDQUFDLHVCQUF1QixHQUFLLEtBQUssRUFBQztnQkFFbEQsQ0FBQyxhQUFhLGFBQWIsYUFBYSxjQUFiLGFBQWEsSUFBYixhQUFhLEdBQUssRUFBRSxFQUFDLENBQUMsSUFBSSxDQUFDO29CQUMxQixJQUFJLEVBQ0YsNkZBQTZGO3dCQUM3RiwwQ0FBMEM7b0JBQzVDLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxhQUFhLENBQUMsUUFBUSxFQUFFO29CQUMxQyxLQUFLLEVBQUU7d0JBQ0w7NEJBQ0UsSUFBSSxFQUNGLDBFQUEwRTtnQ0FDMUUsNEZBQTRGO3lCQUMvRjtxQkFDRjtpQkFDRixDQUFDLENBQUM7YUFDSjtZQUVELGtIQUFrSDtZQUNsSCxJQUFJLFdBQW9DLENBQUM7WUFFekMsMkdBQTJHO1lBQzNHLElBQUksdUJBQXFDLENBQUM7WUFFMUMsSUFBSSxtQkFBK0IsQ0FBQztZQUVwQyxJQUFJLFdBQTJDLENBQUM7WUFFaEQsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksRUFBRTs7Z0JBQ3ZCLE1BQU0sTUFBTSxHQUFrQjtvQkFDNUIsUUFBUSxFQUFFLGFBQWE7aUJBQ3hCLENBQUM7Z0JBRUYsK0VBQStFO2dCQUMvRSxhQUFhLEdBQUcsU0FBUyxDQUFDO2dCQUUxQixtQ0FBbUM7Z0JBQ25DLElBQUEsb0NBQXdCLEdBQUUsQ0FBQztnQkFFM0IseUNBQXlDO2dCQUN6Qyx1QkFBdUIsR0FBRyxFQUFFLENBQUM7Z0JBQzdCLG1CQUFtQixHQUFHLEVBQUUsQ0FBQztnQkFFekIsdUNBQXVDO2dCQUN2QyxNQUFNLFdBQVcsR0FBdUI7b0JBQ3RDLGdCQUFnQixFQUFFLGFBQWEsQ0FBQyxnQkFBZ0I7b0JBQ2hELGFBQWEsRUFBRSxNQUFBLGFBQWEsQ0FBQyxlQUFlLDBDQUFFLGFBQWE7b0JBQzNELGVBQWUsRUFBRSxhQUFhLENBQUMsZUFBZTtvQkFDOUMsS0FBSyxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxjQUFjLEVBQUUsY0FBYzs7d0JBQzVELHVEQUF1RDt3QkFDdkQsTUFBTSxRQUFRLEdBQUcsY0FBYyxhQUFkLGNBQWMsY0FBZCxjQUFjLEdBQUksY0FBYyxDQUFDO3dCQUVsRCxNQUFNLGdCQUFnQixHQUFHLE1BQU0sSUFBQSx1Q0FBeUI7d0JBQ3RELDhDQUE4Qzt3QkFDOUMsR0FBRyxFQUFFLHFCQUFxQixFQUFFLEVBQzVCLFlBQVksQ0FBQyxtQkFBbUIsRUFDaEMsSUFBSSxFQUNKLFFBQVEsRUFDUixDQUFDLGNBQWMsRUFDZixZQUFZLENBQ2IsQ0FBQzt3QkFFRixNQUFNLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLEdBQUcsZ0JBQWdCLENBQUM7d0JBQ3ZFLE9BQUMsTUFBTSxDQUFDLE1BQU0sb0NBQWIsTUFBTSxDQUFDLE1BQU0sR0FBSyxFQUFFLEVBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQzt3QkFDdkMsT0FBQyxNQUFNLENBQUMsUUFBUSxvQ0FBZixNQUFNLENBQUMsUUFBUSxHQUFLLEVBQUUsRUFBQyxDQUFDLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDO3dCQUMzQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxhQUFhLENBQUMsQ0FBQzt3QkFDL0MsSUFBSSxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUU7NEJBQzdCLG1CQUFtQixDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQzt5QkFDckQ7d0JBRUQsT0FBTyxRQUFRLENBQUM7b0JBQ2xCLENBQUM7aUJBQ0YsQ0FBQztnQkFFRiw4RUFBOEU7Z0JBQzlFLFdBQVcsYUFBWCxXQUFXLGNBQVgsV0FBVyxJQUFYLFdBQVcsR0FBSyxJQUFJLHdDQUFrQixFQUFFLEVBQUM7Z0JBRXpDLDREQUE0RDtnQkFDNUQsc0RBQXNEO2dCQUN0RCxNQUFNLEVBQUUsYUFBYSxFQUFFLEdBQUcsTUFBTSxXQUFXLENBQUMsVUFBVSxDQUNwRCxTQUFTLEVBQ1QsZUFBZSxFQUNmLFdBQVcsRUFDWCx3QkFBd0IsQ0FDekIsQ0FBQztnQkFFRixtREFBbUQ7Z0JBQ25ELElBQUksYUFBYSxDQUFDLGVBQWUsRUFBRTtvQkFDakMsS0FBSyxNQUFNLFFBQVEsSUFBSSxhQUFhLEVBQUU7d0JBQ3BDLGFBQWEsQ0FBQyxlQUFlLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUN0RCxJQUFBLHdCQUFhLEVBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FDdEMsQ0FBQztxQkFDSDtpQkFDRjtnQkFFRCxJQUFBLHVCQUFXLEVBQUMsc0JBQXNCLEVBQUUsR0FBRyxFQUFFOztvQkFDdkMsb0VBQW9FO29CQUNwRSxLQUFLLE1BQU0sVUFBVSxJQUFJLFdBQVksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFO3dCQUMxRCxNQUFNLE9BQU8sR0FBRywyQkFBMkIsQ0FBQyxVQUFVLENBQUMsQ0FBQzt3QkFDeEQsSUFBSSxVQUFVLENBQUMsUUFBUSxLQUFLLG9CQUFFLENBQUMsa0JBQWtCLENBQUMsS0FBSyxFQUFFOzRCQUN2RCxPQUFDLE1BQU0sQ0FBQyxNQUFNLG9DQUFiLE1BQU0sQ0FBQyxNQUFNLEdBQUssRUFBRSxFQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO3lCQUN0Qzs2QkFBTTs0QkFDTCxPQUFDLE1BQU0sQ0FBQyxRQUFRLG9DQUFmLE1BQU0sQ0FBQyxRQUFRLEdBQUssRUFBRSxFQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO3lCQUN4QztxQkFDRjtnQkFDSCxDQUFDLENBQUMsQ0FBQztnQkFFSCxXQUFXLEdBQUcsV0FBVyxDQUFDLGlCQUFpQixFQUFFLENBQUM7Z0JBRTlDLE9BQU8sTUFBTSxDQUFDO1lBQ2hCLENBQUMsQ0FBQyxDQUFDO1lBRUgsS0FBSyxDQUFDLE1BQU0sQ0FDVixFQUFFLE1BQU0sRUFBRSxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsY0FBYyxFQUFFLEVBQ3hFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FDUCxJQUFBLHdCQUFZLEVBQ1YsYUFBYSxFQUNiLEtBQUssSUFBSSxFQUFFOztnQkFDVCxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxnQ0FBZ0MsQ0FBQyxDQUFDO2dCQUV6RCxNQUFNLE9BQU8sR0FBRyxNQUFBLE1BQUEsYUFBYSxDQUFDLGdCQUFnQiwwQ0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLG1DQUFJLElBQUksQ0FBQyxJQUFJLENBQUM7Z0JBRXpFLGlGQUFpRjtnQkFDakYsaUZBQWlGO2dCQUNqRiwrRUFBK0U7Z0JBQy9FLGtGQUFrRjtnQkFDbEYsSUFBSSxRQUFRLEdBQUcsTUFBQSxhQUFhLENBQUMsZUFBZSwwQ0FBRSxtQkFBbUIsQ0FBQyxHQUFHLENBQ25FLElBQUEsd0JBQWEsRUFBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQzVCLENBQUM7Z0JBRUYsSUFBSSxRQUFRLEtBQUssU0FBUyxFQUFFO29CQUMxQixNQUFNLGdCQUFnQixHQUFHLE1BQU0sV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUNwRCxJQUFJLENBQUMsQ0FBQSxnQkFBZ0IsYUFBaEIsZ0JBQWdCLHVCQUFoQixnQkFBZ0IsQ0FBRSxPQUFPLENBQUEsRUFBRTt3QkFDOUIseUVBQXlFO3dCQUN6RSw2RUFBNkU7d0JBQzdFLElBQUksZUFBZSxDQUFDLE9BQU8sSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFOzRCQUN6RCxPQUFPLFNBQVMsQ0FBQzt5QkFDbEI7d0JBRUQsNEJBQTRCO3dCQUM1QixPQUFPOzRCQUNMLE1BQU0sRUFBRTtnQ0FDTixzQkFBc0IsQ0FDcEIsT0FBTyxFQUNQLElBQUksQ0FBQyxJQUFJLEVBQ1QsTUFBQSxLQUFLLENBQUMsY0FBYyxDQUFDLGFBQWEsbUNBQUksRUFBRSxDQUN6Qzs2QkFDRjt5QkFDRixDQUFDO3FCQUNIO29CQUVELFFBQVEsR0FBRyxNQUFNLHFCQUFxQixDQUFDLGFBQWEsQ0FDbEQsT0FBTyxFQUNQLGdCQUFnQixDQUFDLE9BQU8sRUFDeEIsSUFBSSxDQUFDLGdCQUFnQixDQUN0QixDQUFDO29CQUVGLE1BQUEsYUFBYSxDQUFDLGVBQWUsMENBQUUsbUJBQW1CLENBQUMsR0FBRyxDQUNwRCxJQUFBLHdCQUFhLEVBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUMzQixRQUFRLENBQ1QsQ0FBQztpQkFDSDtnQkFFRCxPQUFPO29CQUNMLFFBQVE7b0JBQ1IsTUFBTSxFQUFFLElBQUk7aUJBQ2IsQ0FBQztZQUNKLENBQUMsRUFDRCxJQUFJLENBQ0wsQ0FDSixDQUFDO1lBRUYsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQzlDLElBQUEsd0JBQVksRUFDVixhQUFhLEVBQ2IsS0FBSyxJQUFJLEVBQUU7O2dCQUNULGlGQUFpRjtnQkFDakYsaUZBQWlGO2dCQUNqRiwrRUFBK0U7Z0JBQy9FLGtGQUFrRjtnQkFDbEYsSUFBSSxRQUFRLEdBQUcsTUFBQSxhQUFhLENBQUMsZUFBZSwwQ0FBRSxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDNUUsSUFBSSxRQUFRLEtBQUssU0FBUyxFQUFFO29CQUMxQixRQUFRLEdBQUcsTUFBTSxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUNoRSxNQUFBLGFBQWEsQ0FBQyxlQUFlLDBDQUFFLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztpQkFDeEU7Z0JBRUQsT0FBTztvQkFDTCxRQUFRO29CQUNSLE1BQU0sRUFBRSxJQUFJO2lCQUNiLENBQUM7WUFDSixDQUFDLEVBQ0QsSUFBSSxDQUNMLENBQ0YsQ0FBQztZQUVGLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRTs7Z0JBQ3JCLGtFQUFrRTtnQkFDbEUsSUFBSSx1QkFBdUIsQ0FBQyxNQUFNLEVBQUU7b0JBQ2xDLE1BQUEsTUFBTSxDQUFDLFdBQVcsMENBQUUsSUFBSSxDQUFDLEdBQUcsdUJBQXVCLENBQUMsQ0FBQztpQkFDdEQ7Z0JBRUQsNERBQTREO2dCQUM1RCxJQUFJLE1BQU0sQ0FBQyxRQUFRLElBQUksbUJBQW1CLENBQUMsTUFBTSxFQUFFO29CQUNqRCxLQUFLLE1BQU0sUUFBUSxJQUFJLG1CQUFtQixFQUFFO3dCQUMxQyxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxFQUFFLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7d0JBQzNFLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxHQUFHLEVBQUUsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxHQUFHLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztxQkFDL0U7aUJBQ0Y7Z0JBRUQsSUFBQSxrQ0FBc0IsR0FBRSxDQUFDO1lBQzNCLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBalJELG9EQWlSQztBQUVELFNBQVMsc0JBQXNCLENBQUMsT0FBZSxFQUFFLFFBQWdCLEVBQUUsSUFBWTtJQUM3RSxNQUFNLEtBQUssR0FBRztRQUNaLElBQUksRUFBRSxTQUFTLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQywrQ0FBK0M7UUFDMUYsS0FBSyxFQUFFO1lBQ0w7Z0JBQ0UsSUFBSSxFQUFFLDBGQUEwRjthQUNqRztTQUNGO0tBQ0YsQ0FBQztJQUVGLElBQUksT0FBTyxLQUFLLFFBQVEsRUFBRTtRQUN4QixLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNmLElBQUksRUFBRSxpREFBaUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUk7U0FDekYsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBNZXRhZmlsZSxcbiAgT25TdGFydFJlc3VsdCxcbiAgT3V0cHV0RmlsZSxcbiAgUGFydGlhbE1lc3NhZ2UsXG4gIFBhcnRpYWxOb3RlLFxuICBQbHVnaW4sXG4gIFBsdWdpbkJ1aWxkLFxufSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJ25vZGU6b3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7IG1heFdvcmtlcnMgfSBmcm9tICcuLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IEFuZ3VsYXJDb21waWxhdGlvbiwgRmlsZUVtaXR0ZXIgfSBmcm9tICcuL2FuZ3VsYXItY29tcGlsYXRpb24nO1xuaW1wb3J0IHsgQW5ndWxhckhvc3RPcHRpb25zIH0gZnJvbSAnLi9hbmd1bGFyLWhvc3QnO1xuaW1wb3J0IHsgSmF2YVNjcmlwdFRyYW5zZm9ybWVyIH0gZnJvbSAnLi9qYXZhc2NyaXB0LXRyYW5zZm9ybWVyJztcbmltcG9ydCB7XG4gIGxvZ0N1bXVsYXRpdmVEdXJhdGlvbnMsXG4gIHByb2ZpbGVBc3luYyxcbiAgcHJvZmlsZVN5bmMsXG4gIHJlc2V0Q3VtdWxhdGl2ZUR1cmF0aW9ucyxcbn0gZnJvbSAnLi9wcm9maWxpbmcnO1xuaW1wb3J0IHsgQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsIGJ1bmRsZUNvbXBvbmVudFN0eWxlc2hlZXQgfSBmcm9tICcuL3N0eWxlc2hlZXRzJztcblxuLyoqXG4gKiBBIGNvdW50ZXIgZm9yIGNvbXBvbmVudCBzdHlsZXMgdXNlZCB0byBnZW5lcmF0ZSB1bmlxdWUgYnVpbGQtdGltZSBpZGVudGlmaWVycyBmb3IgZWFjaCBzdHlsZXNoZWV0LlxuICovXG5sZXQgY29tcG9uZW50U3R5bGVDb3VudGVyID0gMDtcblxuLyoqXG4gKiBDb252ZXJ0cyBUeXBlU2NyaXB0IERpYWdub3N0aWMgcmVsYXRlZCBpbmZvcm1hdGlvbiBpbnRvIGFuIGVzYnVpbGQgY29tcGF0aWJsZSBub3RlIG9iamVjdC5cbiAqIFJlbGF0ZWQgaW5mb3JtYXRpb24gaXMgYSBzdWJzZXQgb2YgYSBmdWxsIFR5cGVTY3JpcHQgRGlhZ25vc3RpYyBhbmQgYWxzbyB1c2VkIGZvciBkaWFnbm9zdGljXG4gKiBub3RlcyBhc3NvY2lhdGVkIHdpdGggdGhlIG1haW4gRGlhZ25vc3RpYy5cbiAqIEBwYXJhbSBpbmZvIFRoZSBUeXBlU2NyaXB0IGRpYWdub3N0aWMgcmVsYXRpdmUgaW5mb3JtYXRpb24gdG8gY29udmVydC5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgZGlhZ25vc3RpYyBtZXNzYWdlIGFzIGEgUGFydGlhbE1lc3NhZ2Ugb2JqZWN0XG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oXG4gIGluZm86IHRzLkRpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24sXG4gIHRleHRQcmVmaXg/OiBzdHJpbmcsXG4pOiBQYXJ0aWFsTm90ZSB7XG4gIGNvbnN0IG5ld0xpbmUgPSBwbGF0Zm9ybSgpID09PSAnd2luMzInID8gJ1xcclxcbicgOiAnXFxuJztcbiAgbGV0IHRleHQgPSB0cy5mbGF0dGVuRGlhZ25vc3RpY01lc3NhZ2VUZXh0KGluZm8ubWVzc2FnZVRleHQsIG5ld0xpbmUpO1xuICBpZiAodGV4dFByZWZpeCkge1xuICAgIHRleHQgPSB0ZXh0UHJlZml4ICsgdGV4dDtcbiAgfVxuXG4gIGNvbnN0IG5vdGU6IFBhcnRpYWxOb3RlID0geyB0ZXh0IH07XG5cbiAgaWYgKGluZm8uZmlsZSkge1xuICAgIG5vdGUubG9jYXRpb24gPSB7XG4gICAgICBmaWxlOiBpbmZvLmZpbGUuZmlsZU5hbWUsXG4gICAgICBsZW5ndGg6IGluZm8ubGVuZ3RoLFxuICAgIH07XG5cbiAgICAvLyBDYWxjdWxhdGUgdGhlIGxpbmUvY29sdW1uIGxvY2F0aW9uIGFuZCBleHRyYWN0IHRoZSBmdWxsIGxpbmUgdGV4dCB0aGF0IGhhcyB0aGUgZGlhZ25vc3RpY1xuICAgIGlmIChpbmZvLnN0YXJ0KSB7XG4gICAgICBjb25zdCB7IGxpbmUsIGNoYXJhY3RlciB9ID0gdHMuZ2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24oaW5mby5maWxlLCBpbmZvLnN0YXJ0KTtcbiAgICAgIG5vdGUubG9jYXRpb24ubGluZSA9IGxpbmUgKyAxO1xuICAgICAgbm90ZS5sb2NhdGlvbi5jb2x1bW4gPSBjaGFyYWN0ZXI7XG5cbiAgICAgIC8vIFRoZSBzdGFydCBwb3NpdGlvbiBmb3IgdGhlIHNsaWNlIGlzIHRoZSBmaXJzdCBjaGFyYWN0ZXIgb2YgdGhlIGVycm9yIGxpbmVcbiAgICAgIGNvbnN0IGxpbmVTdGFydFBvc2l0aW9uID0gdHMuZ2V0UG9zaXRpb25PZkxpbmVBbmRDaGFyYWN0ZXIoaW5mby5maWxlLCBsaW5lLCAwKTtcblxuICAgICAgLy8gVGhlIGVuZCBwb3NpdGlvbiBmb3IgdGhlIHNsaWNlIGlzIHRoZSBmaXJzdCBjaGFyYWN0ZXIgb2YgdGhlIG5leHQgbGluZSBvciB0aGUgbGVuZ3RoIG9mXG4gICAgICAvLyB0aGUgZW50aXJlIGZpbGUgaWYgdGhlIGxpbmUgaXMgdGhlIGxhc3QgbGluZSBvZiB0aGUgZmlsZSAoZ2V0UG9zaXRpb25PZkxpbmVBbmRDaGFyYWN0ZXJcbiAgICAgIC8vIHdpbGwgZXJyb3IgaWYgYSBub25leGlzdGVudCBsaW5lIGlzIHBhc3NlZCkuXG4gICAgICBjb25zdCB7IGxpbmU6IGxhc3RMaW5lT2ZGaWxlIH0gPSB0cy5nZXRMaW5lQW5kQ2hhcmFjdGVyT2ZQb3NpdGlvbihcbiAgICAgICAgaW5mby5maWxlLFxuICAgICAgICBpbmZvLmZpbGUudGV4dC5sZW5ndGggLSAxLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGxpbmVFbmRQb3NpdGlvbiA9XG4gICAgICAgIGxpbmUgPCBsYXN0TGluZU9mRmlsZVxuICAgICAgICAgID8gdHMuZ2V0UG9zaXRpb25PZkxpbmVBbmRDaGFyYWN0ZXIoaW5mby5maWxlLCBsaW5lICsgMSwgMClcbiAgICAgICAgICA6IGluZm8uZmlsZS50ZXh0Lmxlbmd0aDtcblxuICAgICAgbm90ZS5sb2NhdGlvbi5saW5lVGV4dCA9IGluZm8uZmlsZS50ZXh0LnNsaWNlKGxpbmVTdGFydFBvc2l0aW9uLCBsaW5lRW5kUG9zaXRpb24pLnRyaW1FbmQoKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbm90ZTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBhIFR5cGVTY3JpcHQgRGlhZ25vc3RpYyBtZXNzYWdlIGludG8gYW4gZXNidWlsZCBjb21wYXRpYmxlIG1lc3NhZ2Ugb2JqZWN0LlxuICogQHBhcmFtIGRpYWdub3N0aWMgVGhlIFR5cGVTY3JpcHQgZGlhZ25vc3RpYyB0byBjb252ZXJ0LlxuICogQHJldHVybnMgQW4gZXNidWlsZCBkaWFnbm9zdGljIG1lc3NhZ2UgYXMgYSBQYXJ0aWFsTWVzc2FnZSBvYmplY3RcbiAqL1xuZnVuY3Rpb24gY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljKGRpYWdub3N0aWM6IHRzLkRpYWdub3N0aWMpOiBQYXJ0aWFsTWVzc2FnZSB7XG4gIGxldCBjb2RlUHJlZml4ID0gJ1RTJztcbiAgbGV0IGNvZGUgPSBgJHtkaWFnbm9zdGljLmNvZGV9YDtcbiAgaWYgKGRpYWdub3N0aWMuc291cmNlID09PSAnbmd0c2MnKSB7XG4gICAgY29kZVByZWZpeCA9ICdORyc7XG4gICAgLy8gUmVtb3ZlIGAtOTlgIEFuZ3VsYXIgcHJlZml4IGZyb20gZGlhZ25vc3RpYyBjb2RlXG4gICAgY29kZSA9IGNvZGUuc2xpY2UoMyk7XG4gIH1cblxuICBjb25zdCBtZXNzYWdlOiBQYXJ0aWFsTWVzc2FnZSA9IHtcbiAgICAuLi5jb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWNJbmZvKGRpYWdub3N0aWMsIGAke2NvZGVQcmVmaXh9JHtjb2RlfTogYCksXG4gICAgLy8gU3RvcmUgb3JpZ2luYWwgZGlhZ25vc3RpYyBmb3IgcmVmZXJlbmNlIGlmIG5lZWRlZCBkb3duc3RyZWFtXG4gICAgZGV0YWlsOiBkaWFnbm9zdGljLFxuICB9O1xuXG4gIGlmIChkaWFnbm9zdGljLnJlbGF0ZWRJbmZvcm1hdGlvbj8ubGVuZ3RoKSB7XG4gICAgbWVzc2FnZS5ub3RlcyA9IGRpYWdub3N0aWMucmVsYXRlZEluZm9ybWF0aW9uLm1hcCgoaW5mbykgPT5cbiAgICAgIGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oaW5mbyksXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBtZXNzYWdlO1xufVxuXG5jb25zdCBVU0lOR19XSU5ET1dTID0gcGxhdGZvcm0oKSA9PT0gJ3dpbjMyJztcbmNvbnN0IFdJTkRPV1NfU0VQX1JFR0VYUCA9IG5ldyBSZWdFeHAoYFxcXFwke3BhdGgud2luMzIuc2VwfWAsICdnJyk7XG5cbmV4cG9ydCBjbGFzcyBTb3VyY2VGaWxlQ2FjaGUgZXh0ZW5kcyBNYXA8c3RyaW5nLCB0cy5Tb3VyY2VGaWxlPiB7XG4gIHJlYWRvbmx5IG1vZGlmaWVkRmlsZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcmVhZG9ubHkgYmFiZWxGaWxlQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgVWludDhBcnJheT4oKTtcbiAgcmVhZG9ubHkgdHlwZVNjcmlwdEZpbGVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBVaW50OEFycmF5PigpO1xuXG4gIGludmFsaWRhdGUoZmlsZXM6IEl0ZXJhYmxlPHN0cmluZz4pOiB2b2lkIHtcbiAgICB0aGlzLm1vZGlmaWVkRmlsZXMuY2xlYXIoKTtcbiAgICBmb3IgKGxldCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICB0aGlzLmJhYmVsRmlsZUNhY2hlLmRlbGV0ZShmaWxlKTtcbiAgICAgIHRoaXMudHlwZVNjcmlwdEZpbGVDYWNoZS5kZWxldGUocGF0aFRvRmlsZVVSTChmaWxlKS5ocmVmKTtcblxuICAgICAgLy8gTm9ybWFsaXplIHNlcGFyYXRvcnMgdG8gYWxsb3cgbWF0Y2hpbmcgVHlwZVNjcmlwdCBIb3N0IHBhdGhzXG4gICAgICBpZiAoVVNJTkdfV0lORE9XUykge1xuICAgICAgICBmaWxlID0gZmlsZS5yZXBsYWNlKFdJTkRPV1NfU0VQX1JFR0VYUCwgcGF0aC5wb3NpeC5zZXApO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmRlbGV0ZShmaWxlKTtcbiAgICAgIHRoaXMubW9kaWZpZWRGaWxlcy5hZGQoZmlsZSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZXJQbHVnaW5PcHRpb25zIHtcbiAgc291cmNlbWFwOiBib29sZWFuO1xuICB0c2NvbmZpZzogc3RyaW5nO1xuICBhZHZhbmNlZE9wdGltaXphdGlvbnM/OiBib29sZWFuO1xuICB0aGlyZFBhcnR5U291cmNlbWFwcz86IGJvb2xlYW47XG4gIGZpbGVSZXBsYWNlbWVudHM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGU7XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gIHBsdWdpbk9wdGlvbnM6IENvbXBpbGVyUGx1Z2luT3B0aW9ucyxcbiAgc3R5bGVPcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyAmIHsgaW5saW5lU3R5bGVMYW5ndWFnZTogc3RyaW5nIH0sXG4pOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLWNvbXBpbGVyJyxcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuICAgIGFzeW5jIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgbGV0IHNldHVwV2FybmluZ3M6IFBhcnRpYWxNZXNzYWdlW10gfCB1bmRlZmluZWQ7XG5cbiAgICAgIC8vIEluaXRpYWxpemUgYSB3b3JrZXIgcG9vbCBmb3IgSmF2YVNjcmlwdCB0cmFuc2Zvcm1hdGlvbnNcbiAgICAgIGNvbnN0IGphdmFzY3JpcHRUcmFuc2Zvcm1lciA9IG5ldyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIocGx1Z2luT3B0aW9ucywgbWF4V29ya2Vycyk7XG5cbiAgICAgIGNvbnN0IHsgR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCwgcmVhZENvbmZpZ3VyYXRpb24gfSA9XG4gICAgICAgIGF3YWl0IEFuZ3VsYXJDb21waWxhdGlvbi5sb2FkQ29tcGlsZXJDbGkoKTtcblxuICAgICAgLy8gU2V0dXAgZGVmaW5lcyBiYXNlZCBvbiB0aGUgdmFsdWVzIHByb3ZpZGVkIGJ5IHRoZSBBbmd1bGFyIGNvbXBpbGVyLWNsaVxuICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lID8/PSB7fTtcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QpKSB7XG4gICAgICAgIGlmIChrZXkgaW4gYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lKSB7XG4gICAgICAgICAgLy8gU2tpcCBrZXlzIHRoYXQgaGF2ZSBiZWVuIG1hbnVhbGx5IHByb3ZpZGVkXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGtleSA9PT0gJ25nRGV2TW9kZScpIHtcbiAgICAgICAgICAvLyBuZ0Rldk1vZGUgaXMgYWxyZWFkeSBzZXQgYmFzZWQgb24gdGhlIGJ1aWxkZXIncyBzY3JpcHQgb3B0aW1pemF0aW9uIG9wdGlvblxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIGVzYnVpbGQgcmVxdWlyZXMgdmFsdWVzIHRvIGJlIGEgc3RyaW5nIChhY3R1YWwgc3RyaW5ncyBuZWVkIHRvIGJlIHF1b3RlZCkuXG4gICAgICAgIC8vIEluIHRoaXMgY2FzZSwgYWxsIHByb3ZpZGVkIHZhbHVlcyBhcmUgYm9vbGVhbnMuXG4gICAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLmRlZmluZVtrZXldID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIHRzY29uZmlnIGlzIGxvYWRlZCBpbiBzZXR1cCBpbnN0ZWFkIG9mIGluIHN0YXJ0IHRvIGFsbG93IHRoZSBlc2J1aWxkIHRhcmdldCBidWlsZCBvcHRpb24gdG8gYmUgbW9kaWZpZWQuXG4gICAgICAvLyBlc2J1aWxkIGJ1aWxkIG9wdGlvbnMgY2FuIG9ubHkgYmUgbW9kaWZpZWQgaW4gc2V0dXAgcHJpb3IgdG8gc3RhcnRpbmcgdGhlIGJ1aWxkLlxuICAgICAgY29uc3Qge1xuICAgICAgICBvcHRpb25zOiBjb21waWxlck9wdGlvbnMsXG4gICAgICAgIHJvb3ROYW1lcyxcbiAgICAgICAgZXJyb3JzOiBjb25maWd1cmF0aW9uRGlhZ25vc3RpY3MsXG4gICAgICB9ID0gcHJvZmlsZVN5bmMoJ05HX1JFQURfQ09ORklHJywgKCkgPT5cbiAgICAgICAgcmVhZENvbmZpZ3VyYXRpb24ocGx1Z2luT3B0aW9ucy50c2NvbmZpZywge1xuICAgICAgICAgIG5vRW1pdE9uRXJyb3I6IGZhbHNlLFxuICAgICAgICAgIHN1cHByZXNzT3V0cHV0UGF0aENoZWNrOiB0cnVlLFxuICAgICAgICAgIG91dERpcjogdW5kZWZpbmVkLFxuICAgICAgICAgIGlubGluZVNvdXJjZXM6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgIGlubGluZVNvdXJjZU1hcDogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcbiAgICAgICAgICBtYXBSb290OiB1bmRlZmluZWQsXG4gICAgICAgICAgc291cmNlUm9vdDogdW5kZWZpbmVkLFxuICAgICAgICAgIGRlY2xhcmF0aW9uOiBmYWxzZSxcbiAgICAgICAgICBkZWNsYXJhdGlvbk1hcDogZmFsc2UsXG4gICAgICAgICAgYWxsb3dFbXB0eUNvZGVnZW5GaWxlczogZmFsc2UsXG4gICAgICAgICAgYW5ub3RhdGlvbnNBczogJ2RlY29yYXRvcnMnLFxuICAgICAgICAgIGVuYWJsZVJlc291cmNlSW5saW5pbmc6IGZhbHNlLFxuICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICAgIGlmIChjb21waWxlck9wdGlvbnMudGFyZ2V0ID09PSB1bmRlZmluZWQgfHwgY29tcGlsZXJPcHRpb25zLnRhcmdldCA8IHRzLlNjcmlwdFRhcmdldC5FUzIwMjIpIHtcbiAgICAgICAgLy8gSWYgJ3VzZURlZmluZUZvckNsYXNzRmllbGRzJyBpcyBhbHJlYWR5IGRlZmluZWQgaW4gdGhlIHVzZXJzIHByb2plY3QgbGVhdmUgdGhlIHZhbHVlIGFzIGlzLlxuICAgICAgICAvLyBPdGhlcndpc2UgZmFsbGJhY2sgdG8gZmFsc2UgZHVlIHRvIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvNDU5OTVcbiAgICAgICAgLy8gd2hpY2ggYnJlYWtzIHRoZSBkZXByZWNhdGVkIGBARWZmZWN0c2AgTkdSWCBkZWNvcmF0b3IgYW5kIHBvdGVudGlhbGx5IG90aGVyIGV4aXN0aW5nIGNvZGUgYXMgd2VsbC5cbiAgICAgICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCA9IHRzLlNjcmlwdFRhcmdldC5FUzIwMjI7XG4gICAgICAgIGNvbXBpbGVyT3B0aW9ucy51c2VEZWZpbmVGb3JDbGFzc0ZpZWxkcyA/Pz0gZmFsc2U7XG5cbiAgICAgICAgKHNldHVwV2FybmluZ3MgPz89IFtdKS5wdXNoKHtcbiAgICAgICAgICB0ZXh0OlxuICAgICAgICAgICAgJ1R5cGVTY3JpcHQgY29tcGlsZXIgb3B0aW9ucyBcInRhcmdldFwiIGFuZCBcInVzZURlZmluZUZvckNsYXNzRmllbGRzXCIgYXJlIHNldCB0byBcIkVTMjAyMlwiIGFuZCAnICtcbiAgICAgICAgICAgICdcImZhbHNlXCIgcmVzcGVjdGl2ZWx5IGJ5IHRoZSBBbmd1bGFyIENMSS4nLFxuICAgICAgICAgIGxvY2F0aW9uOiB7IGZpbGU6IHBsdWdpbk9wdGlvbnMudHNjb25maWcgfSxcbiAgICAgICAgICBub3RlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB0ZXh0OlxuICAgICAgICAgICAgICAgICdUbyBjb250cm9sIEVDTUEgdmVyc2lvbiBhbmQgZmVhdHVyZXMgdXNlIHRoZSBCcm93ZXJzbGlzdCBjb25maWd1cmF0aW9uLiAnICtcbiAgICAgICAgICAgICAgICAnRm9yIG1vcmUgaW5mb3JtYXRpb24sIHNlZSBodHRwczovL2FuZ3VsYXIuaW8vZ3VpZGUvYnVpbGQjY29uZmlndXJpbmctYnJvd3Nlci1jb21wYXRpYmlsaXR5JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSBmaWxlIGVtaXR0ZXIgY3JlYXRlZCBkdXJpbmcgYG9uU3RhcnRgIHRoYXQgd2lsbCBiZSB1c2VkIGR1cmluZyB0aGUgYnVpbGQgaW4gYG9uTG9hZGAgY2FsbGJhY2tzIGZvciBUUyBmaWxlc1xuICAgICAgbGV0IGZpbGVFbWl0dGVyOiBGaWxlRW1pdHRlciB8IHVuZGVmaW5lZDtcblxuICAgICAgLy8gVGhlIHN0eWxlc2hlZXQgcmVzb3VyY2VzIGZyb20gY29tcG9uZW50IHN0eWxlc2hlZXRzIHRoYXQgd2lsbCBiZSBhZGRlZCB0byB0aGUgYnVpbGQgcmVzdWx0cyBvdXRwdXQgZmlsZXNcbiAgICAgIGxldCBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlczogT3V0cHV0RmlsZVtdO1xuXG4gICAgICBsZXQgc3R5bGVzaGVldE1ldGFmaWxlczogTWV0YWZpbGVbXTtcblxuICAgICAgbGV0IGNvbXBpbGF0aW9uOiBBbmd1bGFyQ29tcGlsYXRpb24gfCB1bmRlZmluZWQ7XG5cbiAgICAgIGJ1aWxkLm9uU3RhcnQoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQ6IE9uU3RhcnRSZXN1bHQgPSB7XG4gICAgICAgICAgd2FybmluZ3M6IHNldHVwV2FybmluZ3MsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gUmVzZXQgdGhlIHNldHVwIHdhcm5pbmdzIHNvIHRoYXQgdGhleSBhcmUgb25seSBzaG93biBkdXJpbmcgdGhlIGZpcnN0IGJ1aWxkLlxuICAgICAgICBzZXR1cFdhcm5pbmdzID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIC8vIFJlc2V0IGRlYnVnIHBlcmZvcm1hbmNlIHRyYWNraW5nXG4gICAgICAgIHJlc2V0Q3VtdWxhdGl2ZUR1cmF0aW9ucygpO1xuXG4gICAgICAgIC8vIFJlc2V0IHN0eWxlc2hlZXQgcmVzb3VyY2Ugb3V0cHV0IGZpbGVzXG4gICAgICAgIHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzID0gW107XG4gICAgICAgIHN0eWxlc2hlZXRNZXRhZmlsZXMgPSBbXTtcblxuICAgICAgICAvLyBDcmVhdGUgQW5ndWxhciBjb21waWxlciBob3N0IG9wdGlvbnNcbiAgICAgICAgY29uc3QgaG9zdE9wdGlvbnM6IEFuZ3VsYXJIb3N0T3B0aW9ucyA9IHtcbiAgICAgICAgICBmaWxlUmVwbGFjZW1lbnRzOiBwbHVnaW5PcHRpb25zLmZpbGVSZXBsYWNlbWVudHMsXG4gICAgICAgICAgbW9kaWZpZWRGaWxlczogcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/Lm1vZGlmaWVkRmlsZXMsXG4gICAgICAgICAgc291cmNlRmlsZUNhY2hlOiBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZSxcbiAgICAgICAgICBhc3luYyB0cmFuc2Zvcm1TdHlsZXNoZWV0KGRhdGEsIGNvbnRhaW5pbmdGaWxlLCBzdHlsZXNoZWV0RmlsZSkge1xuICAgICAgICAgICAgLy8gU3R5bGVzaGVldCBmaWxlIG9ubHkgZXhpc3RzIGZvciBleHRlcm5hbCBzdHlsZXNoZWV0c1xuICAgICAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBzdHlsZXNoZWV0RmlsZSA/PyBjb250YWluaW5nRmlsZTtcblxuICAgICAgICAgICAgY29uc3Qgc3R5bGVzaGVldFJlc3VsdCA9IGF3YWl0IGJ1bmRsZUNvbXBvbmVudFN0eWxlc2hlZXQoXG4gICAgICAgICAgICAgIC8vIFRPRE86IEV2YWx1YXRlIHVzYWdlIG9mIGEgZmFzdCBoYXNoIGluc3RlYWRcbiAgICAgICAgICAgICAgYCR7Kytjb21wb25lbnRTdHlsZUNvdW50ZXJ9YCxcbiAgICAgICAgICAgICAgc3R5bGVPcHRpb25zLmlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgIGZpbGVuYW1lLFxuICAgICAgICAgICAgICAhc3R5bGVzaGVldEZpbGUsXG4gICAgICAgICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGNvbnN0IHsgY29udGVudHMsIHJlc291cmNlRmlsZXMsIGVycm9ycywgd2FybmluZ3MgfSA9IHN0eWxlc2hlZXRSZXN1bHQ7XG4gICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgICAgIHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLnB1c2goLi4ucmVzb3VyY2VGaWxlcyk7XG4gICAgICAgICAgICBpZiAoc3R5bGVzaGVldFJlc3VsdC5tZXRhZmlsZSkge1xuICAgICAgICAgICAgICBzdHlsZXNoZWV0TWV0YWZpbGVzLnB1c2goc3R5bGVzaGVldFJlc3VsdC5tZXRhZmlsZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjb250ZW50cztcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIENyZWF0ZSBuZXcgY29tcGlsYXRpb24gaWYgZmlyc3QgYnVpbGQ7IG90aGVyd2lzZSwgdXNlIGV4aXN0aW5nIGZvciByZWJ1aWxkc1xuICAgICAgICBjb21waWxhdGlvbiA/Pz0gbmV3IEFuZ3VsYXJDb21waWxhdGlvbigpO1xuXG4gICAgICAgIC8vIEluaXRpYWxpemUgdGhlIEFuZ3VsYXIgY29tcGlsYXRpb24gZm9yIHRoZSBjdXJyZW50IGJ1aWxkLlxuICAgICAgICAvLyBJbiB3YXRjaCBtb2RlLCBwcmV2aW91cyBidWlsZCBzdGF0ZSB3aWxsIGJlIHJldXNlZC5cbiAgICAgICAgY29uc3QgeyBhZmZlY3RlZEZpbGVzIH0gPSBhd2FpdCBjb21waWxhdGlvbi5pbml0aWFsaXplKFxuICAgICAgICAgIHJvb3ROYW1lcyxcbiAgICAgICAgICBjb21waWxlck9wdGlvbnMsXG4gICAgICAgICAgaG9zdE9wdGlvbnMsXG4gICAgICAgICAgY29uZmlndXJhdGlvbkRpYWdub3N0aWNzLFxuICAgICAgICApO1xuXG4gICAgICAgIC8vIENsZWFyIGFmZmVjdGVkIGZpbGVzIGZyb20gdGhlIGNhY2hlIChpZiBwcmVzZW50KVxuICAgICAgICBpZiAocGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGFmZmVjdGVkIG9mIGFmZmVjdGVkRmlsZXMpIHtcbiAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlLnR5cGVTY3JpcHRGaWxlQ2FjaGUuZGVsZXRlKFxuICAgICAgICAgICAgICBwYXRoVG9GaWxlVVJMKGFmZmVjdGVkLmZpbGVOYW1lKS5ocmVmLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBwcm9maWxlU3luYygnTkdfRElBR05PU1RJQ1NfVE9UQUwnLCAoKSA9PiB7XG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgICBmb3IgKGNvbnN0IGRpYWdub3N0aWMgb2YgY29tcGlsYXRpb24hLmNvbGxlY3REaWFnbm9zdGljcygpKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljKGRpYWdub3N0aWMpO1xuICAgICAgICAgICAgaWYgKGRpYWdub3N0aWMuY2F0ZWdvcnkgPT09IHRzLkRpYWdub3N0aWNDYXRlZ29yeS5FcnJvcikge1xuICAgICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2gobWVzc2FnZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaChtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZpbGVFbWl0dGVyID0gY29tcGlsYXRpb24uY3JlYXRlRmlsZUVtaXR0ZXIoKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZChcbiAgICAgICAgeyBmaWx0ZXI6IGNvbXBpbGVyT3B0aW9ucy5hbGxvd0pzID8gL1xcLltjbV0/W2p0XXN4PyQvIDogL1xcLltjbV0/dHN4PyQvIH0sXG4gICAgICAgIChhcmdzKSA9PlxuICAgICAgICAgIHByb2ZpbGVBc3luYyhcbiAgICAgICAgICAgICdOR19FTUlUX1RTKicsXG4gICAgICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgIGFzc2VydC5vayhmaWxlRW1pdHRlciwgJ0ludmFsaWQgcGx1Z2luIGV4ZWN1dGlvbiBvcmRlcicpO1xuXG4gICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3QgPSBwbHVnaW5PcHRpb25zLmZpbGVSZXBsYWNlbWVudHM/LlthcmdzLnBhdGhdID8/IGFyZ3MucGF0aDtcblxuICAgICAgICAgICAgICAvLyBUaGUgZmlsZW5hbWUgaXMgY3VycmVudGx5IHVzZWQgYXMgYSBjYWNoZSBrZXkuIFNpbmNlIHRoZSBjYWNoZSBpcyBtZW1vcnkgb25seSxcbiAgICAgICAgICAgICAgLy8gdGhlIG9wdGlvbnMgY2Fubm90IGNoYW5nZSBhbmQgZG8gbm90IG5lZWQgdG8gYmUgcmVwcmVzZW50ZWQgaW4gdGhlIGtleS4gSWYgdGhlXG4gICAgICAgICAgICAgIC8vIGNhY2hlIGlzIGxhdGVyIHN0b3JlZCB0byBkaXNrLCB0aGVuIHRoZSBvcHRpb25zIHRoYXQgYWZmZWN0IHRyYW5zZm9ybSBvdXRwdXRcbiAgICAgICAgICAgICAgLy8gd291bGQgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUga2V5IGFzIHdlbGwgYXMgYSBjaGVjayBmb3IgYW55IGNoYW5nZSBvZiBjb250ZW50LlxuICAgICAgICAgICAgICBsZXQgY29udGVudHMgPSBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8udHlwZVNjcmlwdEZpbGVDYWNoZS5nZXQoXG4gICAgICAgICAgICAgICAgcGF0aFRvRmlsZVVSTChyZXF1ZXN0KS5ocmVmLFxuICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgIGlmIChjb250ZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdHlwZXNjcmlwdFJlc3VsdCA9IGF3YWl0IGZpbGVFbWl0dGVyKHJlcXVlc3QpO1xuICAgICAgICAgICAgICAgIGlmICghdHlwZXNjcmlwdFJlc3VsdD8uY29udGVudCkge1xuICAgICAgICAgICAgICAgICAgLy8gTm8gVFMgcmVzdWx0IGluZGljYXRlcyB0aGUgZmlsZSBpcyBub3QgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBwcm9ncmFtLlxuICAgICAgICAgICAgICAgICAgLy8gSWYgYWxsb3dKcyBpcyBlbmFibGVkIGFuZCB0aGUgZmlsZSBpcyBKUyB0aGVuIGRlZmVyIHRvIHRoZSBuZXh0IGxvYWQgaG9vay5cbiAgICAgICAgICAgICAgICAgIGlmIChjb21waWxlck9wdGlvbnMuYWxsb3dKcyAmJiAvXFwuW2NtXT9qcyQvLnRlc3QocmVxdWVzdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgLy8gT3RoZXJ3aXNlIHJldHVybiBhbiBlcnJvclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgY3JlYXRlTWlzc2luZ0ZpbGVFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzLnBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyID8/ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnRlbnRzID0gYXdhaXQgamF2YXNjcmlwdFRyYW5zZm9ybWVyLnRyYW5zZm9ybURhdGEoXG4gICAgICAgICAgICAgICAgICByZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgdHlwZXNjcmlwdFJlc3VsdC5jb250ZW50LFxuICAgICAgICAgICAgICAgICAgdHJ1ZSAvKiBza2lwTGlua2VyICovLFxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8udHlwZVNjcmlwdEZpbGVDYWNoZS5zZXQoXG4gICAgICAgICAgICAgICAgICBwYXRoVG9GaWxlVVJMKHJlcXVlc3QpLmhyZWYsXG4gICAgICAgICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICApLFxuICAgICAgKTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9qcyQvIH0sIChhcmdzKSA9PlxuICAgICAgICBwcm9maWxlQXN5bmMoXG4gICAgICAgICAgJ05HX0VNSVRfSlMqJyxcbiAgICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAvLyBUaGUgZmlsZW5hbWUgaXMgY3VycmVudGx5IHVzZWQgYXMgYSBjYWNoZSBrZXkuIFNpbmNlIHRoZSBjYWNoZSBpcyBtZW1vcnkgb25seSxcbiAgICAgICAgICAgIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAgICAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAgICAgLy8gd291bGQgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUga2V5IGFzIHdlbGwgYXMgYSBjaGVjayBmb3IgYW55IGNoYW5nZSBvZiBjb250ZW50LlxuICAgICAgICAgICAgbGV0IGNvbnRlbnRzID0gcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LmJhYmVsRmlsZUNhY2hlLmdldChhcmdzLnBhdGgpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgY29udGVudHMgPSBhd2FpdCBqYXZhc2NyaXB0VHJhbnNmb3JtZXIudHJhbnNmb3JtRmlsZShhcmdzLnBhdGgpO1xuICAgICAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8uYmFiZWxGaWxlQ2FjaGUuc2V0KGFyZ3MucGF0aCwgY29udGVudHMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICksXG4gICAgICApO1xuXG4gICAgICBidWlsZC5vbkVuZCgocmVzdWx0KSA9PiB7XG4gICAgICAgIC8vIEFkZCBhbnkgY29tcG9uZW50IHN0eWxlc2hlZXQgcmVzb3VyY2UgZmlsZXMgdG8gdGhlIG91dHB1dCBmaWxlc1xuICAgICAgICBpZiAoc3R5bGVzaGVldFJlc291cmNlRmlsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgcmVzdWx0Lm91dHB1dEZpbGVzPy5wdXNoKC4uLnN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENvbWJpbmUgY29tcG9uZW50IHN0eWxlc2hlZXQgbWV0YWZpbGVzIHdpdGggbWFpbiBtZXRhZmlsZVxuICAgICAgICBpZiAocmVzdWx0Lm1ldGFmaWxlICYmIHN0eWxlc2hlZXRNZXRhZmlsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBtZXRhZmlsZSBvZiBzdHlsZXNoZWV0TWV0YWZpbGVzKSB7XG4gICAgICAgICAgICByZXN1bHQubWV0YWZpbGUuaW5wdXRzID0geyAuLi5yZXN1bHQubWV0YWZpbGUuaW5wdXRzLCAuLi5tZXRhZmlsZS5pbnB1dHMgfTtcbiAgICAgICAgICAgIHJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzID0geyAuLi5yZXN1bHQubWV0YWZpbGUub3V0cHV0cywgLi4ubWV0YWZpbGUub3V0cHV0cyB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxvZ0N1bXVsYXRpdmVEdXJhdGlvbnMoKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU1pc3NpbmdGaWxlRXJyb3IocmVxdWVzdDogc3RyaW5nLCBvcmlnaW5hbDogc3RyaW5nLCByb290OiBzdHJpbmcpOiBQYXJ0aWFsTWVzc2FnZSB7XG4gIGNvbnN0IGVycm9yID0ge1xuICAgIHRleHQ6IGBGaWxlICcke3BhdGgucmVsYXRpdmUocm9vdCwgcmVxdWVzdCl9JyBpcyBtaXNzaW5nIGZyb20gdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24uYCxcbiAgICBub3RlczogW1xuICAgICAge1xuICAgICAgICB0ZXh0OiBgRW5zdXJlIHRoZSBmaWxlIGlzIHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvZ3JhbSB2aWEgdGhlICdmaWxlcycgb3IgJ2luY2x1ZGUnIHByb3BlcnR5LmAsXG4gICAgICB9LFxuICAgIF0sXG4gIH07XG5cbiAgaWYgKHJlcXVlc3QgIT09IG9yaWdpbmFsKSB7XG4gICAgZXJyb3Iubm90ZXMucHVzaCh7XG4gICAgICB0ZXh0OiBgRmlsZSBpcyByZXF1ZXN0ZWQgZnJvbSBhIGZpbGUgcmVwbGFjZW1lbnQgb2YgJyR7cGF0aC5yZWxhdGl2ZShyb290LCBvcmlnaW5hbCl9Jy5gLFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIGVycm9yO1xufVxuIl19