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
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const path = __importStar(require("node:path"));
const node_url_1 = require("node:url");
const typescript_1 = __importDefault(require("typescript"));
const environment_options_1 = require("../../../utils/environment-options");
const javascript_transformer_1 = require("../javascript-transformer");
const load_result_cache_1 = require("../load-result-cache");
const profiling_1 = require("../profiling");
const stylesheets_1 = require("../stylesheets");
const angular_compilation_1 = require("./angular-compilation");
const aot_compilation_1 = require("./aot-compilation");
const jit_compilation_1 = require("./jit-compilation");
const jit_plugin_callbacks_1 = require("./jit-plugin-callbacks");
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
    if (diagnostic.relatedInformation?.length) {
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
        this.loadResultCache = new load_result_cache_1.MemoryLoadResultCache();
    }
    invalidate(files) {
        this.modifiedFiles.clear();
        for (let file of files) {
            this.babelFileCache.delete(file);
            this.typeScriptFileCache.delete((0, node_url_1.pathToFileURL)(file).href);
            this.loadResultCache.invalidate(file);
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
            var _a;
            let setupWarnings = [];
            const preserveSymlinks = build.initialOptions.preserveSymlinks;
            let tsconfigPath = pluginOptions.tsconfig;
            if (!preserveSymlinks) {
                // Use the real path of the tsconfig if not preserving symlinks.
                // This ensures the TS source file paths are based on the real path of the configuration.
                try {
                    tsconfigPath = await (0, promises_1.realpath)(tsconfigPath);
                }
                catch { }
            }
            // Initialize a worker pool for JavaScript transformations
            const javascriptTransformer = new javascript_transformer_1.JavaScriptTransformer(pluginOptions, environment_options_1.maxWorkers);
            // Setup defines based on the values provided by the Angular compiler-cli
            const { GLOBAL_DEFS_FOR_TERSER_WITH_AOT } = await angular_compilation_1.AngularCompilation.loadCompilerCli();
            (_a = build.initialOptions).define ?? (_a.define = {});
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
            // The file emitter created during `onStart` that will be used during the build in `onLoad` callbacks for TS files
            let fileEmitter;
            // The stylesheet resources from component stylesheets that will be added to the build results output files
            let stylesheetResourceFiles = [];
            let stylesheetMetafiles;
            // Create new reusable compilation for the appropriate mode based on the `jit` plugin option
            const compilation = pluginOptions.jit
                ? new jit_compilation_1.JitCompilation()
                : new aot_compilation_1.AotCompilation();
            // Determines if TypeScript should process JavaScript files based on tsconfig `allowJs` option
            let shouldTsIgnoreJs = true;
            build.onStart(async () => {
                const result = {
                    warnings: setupWarnings,
                };
                // Reset debug performance tracking
                (0, profiling_1.resetCumulativeDurations)();
                // Reset stylesheet resource output files
                stylesheetResourceFiles = [];
                stylesheetMetafiles = [];
                // Create Angular compiler host options
                const hostOptions = {
                    fileReplacements: pluginOptions.fileReplacements,
                    modifiedFiles: pluginOptions.sourceFileCache?.modifiedFiles,
                    sourceFileCache: pluginOptions.sourceFileCache,
                    async transformStylesheet(data, containingFile, stylesheetFile) {
                        // Stylesheet file only exists for external stylesheets
                        const filename = stylesheetFile ?? containingFile;
                        const stylesheetResult = await (0, stylesheets_1.bundleComponentStylesheet)(styleOptions.inlineStyleLanguage, data, filename, !stylesheetFile, styleOptions, pluginOptions.loadResultCache);
                        const { contents, resourceFiles, errors, warnings } = stylesheetResult;
                        if (errors) {
                            (result.errors ?? (result.errors = [])).push(...errors);
                        }
                        (result.warnings ?? (result.warnings = [])).push(...warnings);
                        stylesheetResourceFiles.push(...resourceFiles);
                        if (stylesheetResult.metafile) {
                            stylesheetMetafiles.push(stylesheetResult.metafile);
                        }
                        return contents;
                    },
                };
                // Initialize the Angular compilation for the current build.
                // In watch mode, previous build state will be reused.
                const { affectedFiles, compilerOptions: { allowJs }, } = await compilation.initialize(tsconfigPath, hostOptions, (compilerOptions) => {
                    if (compilerOptions.target === undefined ||
                        compilerOptions.target < typescript_1.default.ScriptTarget.ES2022) {
                        // If 'useDefineForClassFields' is already defined in the users project leave the value as is.
                        // Otherwise fallback to false due to https://github.com/microsoft/TypeScript/issues/45995
                        // which breaks the deprecated `@Effects` NGRX decorator and potentially other existing code as well.
                        compilerOptions.target = typescript_1.default.ScriptTarget.ES2022;
                        compilerOptions.useDefineForClassFields ?? (compilerOptions.useDefineForClassFields = false);
                        // Only add the warning on the initial build
                        setupWarnings?.push({
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
                    return {
                        ...compilerOptions,
                        noEmitOnError: false,
                        inlineSources: pluginOptions.sourcemap,
                        inlineSourceMap: pluginOptions.sourcemap,
                        mapRoot: undefined,
                        sourceRoot: undefined,
                        preserveSymlinks,
                    };
                });
                shouldTsIgnoreJs = !allowJs;
                // Clear affected files from the cache (if present)
                if (pluginOptions.sourceFileCache) {
                    for (const affected of affectedFiles) {
                        pluginOptions.sourceFileCache.typeScriptFileCache.delete((0, node_url_1.pathToFileURL)(affected.fileName).href);
                    }
                }
                (0, profiling_1.profileSync)('NG_DIAGNOSTICS_TOTAL', () => {
                    for (const diagnostic of compilation.collectDiagnostics()) {
                        const message = convertTypeScriptDiagnostic(diagnostic);
                        if (diagnostic.category === typescript_1.default.DiagnosticCategory.Error) {
                            (result.errors ?? (result.errors = [])).push(message);
                        }
                        else {
                            (result.warnings ?? (result.warnings = [])).push(message);
                        }
                    }
                });
                fileEmitter = compilation.createFileEmitter();
                // Reset the setup warnings so that they are only shown during the first build.
                setupWarnings = undefined;
                return result;
            });
            build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, (args) => (0, profiling_1.profileAsync)('NG_EMIT_TS*', async () => {
                assert.ok(fileEmitter, 'Invalid plugin execution order');
                const request = pluginOptions.fileReplacements?.[args.path] ?? args.path;
                // Skip TS load attempt if JS TypeScript compilation not enabled and file is JS
                if (shouldTsIgnoreJs && /\.[cm]?js$/.test(request)) {
                    return undefined;
                }
                // The filename is currently used as a cache key. Since the cache is memory only,
                // the options cannot change and do not need to be represented in the key. If the
                // cache is later stored to disk, then the options that affect transform output
                // would need to be added to the key as well as a check for any change of content.
                let contents = pluginOptions.sourceFileCache?.typeScriptFileCache.get((0, node_url_1.pathToFileURL)(request).href);
                if (contents === undefined) {
                    const typescriptResult = await fileEmitter(request);
                    if (!typescriptResult?.content) {
                        // No TS result indicates the file is not part of the TypeScript program.
                        // If allowJs is enabled and the file is JS then defer to the next load hook.
                        if (!shouldTsIgnoreJs && /\.[cm]?js$/.test(request)) {
                            return undefined;
                        }
                        // Otherwise return an error
                        return {
                            errors: [
                                createMissingFileError(request, args.path, build.initialOptions.absWorkingDir ?? ''),
                            ],
                        };
                    }
                    contents = await javascriptTransformer.transformData(request, typescriptResult.content, true /* skipLinker */);
                    pluginOptions.sourceFileCache?.typeScriptFileCache.set((0, node_url_1.pathToFileURL)(request).href, contents);
                }
                return {
                    contents,
                    loader: 'js',
                };
            }, true));
            build.onLoad({ filter: /\.[cm]?js$/ }, (args) => (0, profiling_1.profileAsync)('NG_EMIT_JS*', async () => {
                // The filename is currently used as a cache key. Since the cache is memory only,
                // the options cannot change and do not need to be represented in the key. If the
                // cache is later stored to disk, then the options that affect transform output
                // would need to be added to the key as well as a check for any change of content.
                let contents = pluginOptions.sourceFileCache?.babelFileCache.get(args.path);
                if (contents === undefined) {
                    contents = await javascriptTransformer.transformFile(args.path, pluginOptions.jit);
                    pluginOptions.sourceFileCache?.babelFileCache.set(args.path, contents);
                }
                return {
                    contents,
                    loader: 'js',
                };
            }, true));
            // Setup bundling of component templates and stylesheets when in JIT mode
            if (pluginOptions.jit) {
                (0, jit_plugin_callbacks_1.setupJitPluginCallbacks)(build, styleOptions, stylesheetResourceFiles, pluginOptions.loadResultCache);
            }
            build.onEnd((result) => {
                // Add any component stylesheet resource files to the output files
                if (stylesheetResourceFiles.length) {
                    result.outputFiles?.push(...stylesheetResourceFiles);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2FuZ3VsYXIvY29tcGlsZXItcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBV0gsb0RBQXNDO0FBQ3RDLCtDQUE0QztBQUM1QyxxQ0FBbUM7QUFDbkMsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUN6Qyw0REFBNEI7QUFDNUIsNEVBQWdFO0FBQ2hFLHNFQUFrRTtBQUNsRSw0REFBOEU7QUFDOUUsNENBS3NCO0FBQ3RCLGdEQUFvRjtBQUNwRiwrREFBd0U7QUFFeEUsdURBQW1EO0FBQ25ELHVEQUFtRDtBQUNuRCxpRUFBaUU7QUFFakU7Ozs7OztHQU1HO0FBQ0gsU0FBUywrQkFBK0IsQ0FDdEMsSUFBcUMsRUFDckMsVUFBbUI7SUFFbkIsTUFBTSxPQUFPLEdBQUcsSUFBQSxrQkFBUSxHQUFFLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUN2RCxJQUFJLElBQUksR0FBRyxvQkFBRSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdEUsSUFBSSxVQUFVLEVBQUU7UUFDZCxJQUFJLEdBQUcsVUFBVSxHQUFHLElBQUksQ0FBQztLQUMxQjtJQUVELE1BQU0sSUFBSSxHQUFnQixFQUFFLElBQUksRUFBRSxDQUFDO0lBRW5DLElBQUksSUFBSSxDQUFDLElBQUksRUFBRTtRQUNiLElBQUksQ0FBQyxRQUFRLEdBQUc7WUFDZCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRO1lBQ3hCLE1BQU0sRUFBRSxJ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K0M7UUFDMUYsS0FBSyxFQUFFO1lBQ0w7Z0JBQ0UsSUFBSSxFQUFFLDBGQUEwRjthQUNqRztTQUNGO0tBQ0YsQ0FBQztJQUVGLElBQUksT0FBTyxLQUFLLFFBQVEsRUFBRTtRQUN4QixLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNmLElBQUksRUFBRSxpREFBaUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUk7U0FDekYsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBNZXRhZmlsZSxcbiAgT25TdGFydFJlc3VsdCxcbiAgT3V0cHV0RmlsZSxcbiAgUGFydGlhbE1lc3NhZ2UsXG4gIFBhcnRpYWxOb3RlLFxuICBQbHVnaW4sXG4gIFBsdWdpbkJ1aWxkLFxufSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyByZWFscGF0aCB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICdub2RlOm9zJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBtYXhXb3JrZXJzIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIgfSBmcm9tICcuLi9qYXZhc2NyaXB0LXRyYW5zZm9ybWVyJztcbmltcG9ydCB7IExvYWRSZXN1bHRDYWNoZSwgTWVtb3J5TG9hZFJlc3VsdENhY2hlIH0gZnJvbSAnLi4vbG9hZC1yZXN1bHQtY2FjaGUnO1xuaW1wb3J0IHtcbiAgbG9nQ3VtdWxhdGl2ZUR1cmF0aW9ucyxcbiAgcHJvZmlsZUFzeW5jLFxuICBwcm9maWxlU3luYyxcbiAgcmVzZXRDdW11bGF0aXZlRHVyYXRpb25zLFxufSBmcm9tICcuLi9wcm9maWxpbmcnO1xuaW1wb3J0IHsgQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMsIGJ1bmRsZUNvbXBvbmVudFN0eWxlc2hlZXQgfSBmcm9tICcuLi9zdHlsZXNoZWV0cyc7XG5pbXBvcnQgeyBBbmd1bGFyQ29tcGlsYXRpb24sIEZpbGVFbWl0dGVyIH0gZnJvbSAnLi9hbmd1bGFyLWNvbXBpbGF0aW9uJztcbmltcG9ydCB7IEFuZ3VsYXJIb3N0T3B0aW9ucyB9IGZyb20gJy4vYW5ndWxhci1ob3N0JztcbmltcG9ydCB7IEFvdENvbXBpbGF0aW9uIH0gZnJvbSAnLi9hb3QtY29tcGlsYXRpb24nO1xuaW1wb3J0IHsgSml0Q29tcGlsYXRpb24gfSBmcm9tICcuL2ppdC1jb21waWxhdGlvbic7XG5pbXBvcnQgeyBzZXR1cEppdFBsdWdpbkNhbGxiYWNrcyB9IGZyb20gJy4vaml0LXBsdWdpbi1jYWxsYmFja3MnO1xuXG4vKipcbiAqIENvbnZlcnRzIFR5cGVTY3JpcHQgRGlhZ25vc3RpYyByZWxhdGVkIGluZm9ybWF0aW9uIGludG8gYW4gZXNidWlsZCBjb21wYXRpYmxlIG5vdGUgb2JqZWN0LlxuICogUmVsYXRlZCBpbmZvcm1hdGlvbiBpcyBhIHN1YnNldCBvZiBhIGZ1bGwgVHlwZVNjcmlwdCBEaWFnbm9zdGljIGFuZCBhbHNvIHVzZWQgZm9yIGRpYWdub3N0aWNcbiAqIG5vdGVzIGFzc29jaWF0ZWQgd2l0aCB0aGUgbWFpbiBEaWFnbm9zdGljLlxuICogQHBhcmFtIGluZm8gVGhlIFR5cGVTY3JpcHQgZGlhZ25vc3RpYyByZWxhdGl2ZSBpbmZvcm1hdGlvbiB0byBjb252ZXJ0LlxuICogQHJldHVybnMgQW4gZXNidWlsZCBkaWFnbm9zdGljIG1lc3NhZ2UgYXMgYSBQYXJ0aWFsTWVzc2FnZSBvYmplY3RcbiAqL1xuZnVuY3Rpb24gY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljSW5mbyhcbiAgaW5mbzogdHMuRGlhZ25vc3RpY1JlbGF0ZWRJbmZvcm1hdGlvbixcbiAgdGV4dFByZWZpeD86IHN0cmluZyxcbik6IFBhcnRpYWxOb3RlIHtcbiAgY29uc3QgbmV3TGluZSA9IHBsYXRmb3JtKCkgPT09ICd3aW4zMicgPyAnXFxyXFxuJyA6ICdcXG4nO1xuICBsZXQgdGV4dCA9IHRzLmZsYXR0ZW5EaWFnbm9zdGljTWVzc2FnZVRleHQoaW5mby5tZXNzYWdlVGV4dCwgbmV3TGluZSk7XG4gIGlmICh0ZXh0UHJlZml4KSB7XG4gICAgdGV4dCA9IHRleHRQcmVmaXggKyB0ZXh0O1xuICB9XG5cbiAgY29uc3Qgbm90ZTogUGFydGlhbE5vdGUgPSB7IHRleHQgfTtcblxuICBpZiAoaW5mby5maWxlKSB7XG4gICAgbm90ZS5sb2NhdGlvbiA9IHtcbiAgICAgIGZpbGU6IGluZm8uZmlsZS5maWxlTmFtZSxcbiAgICAgIGxlbmd0aDogaW5mby5sZW5ndGgsXG4gICAgfTtcblxuICAgIC8vIENhbGN1bGF0ZSB0aGUgbGluZS9jb2x1bW4gbG9jYXRpb24gYW5kIGV4dHJhY3QgdGhlIGZ1bGwgbGluZSB0ZXh0IHRoYXQgaGFzIHRoZSBkaWFnbm9zdGljXG4gICAgaWYgKGluZm8uc3RhcnQpIHtcbiAgICAgIGNvbnN0IHsgbGluZSwgY2hhcmFjdGVyIH0gPSB0cy5nZXRMaW5lQW5kQ2hhcmFjdGVyT2ZQb3NpdGlvbihpbmZvLmZpbGUsIGluZm8uc3RhcnQpO1xuICAgICAgbm90ZS5sb2NhdGlvbi5saW5lID0gbGluZSArIDE7XG4gICAgICBub3RlLmxvY2F0aW9uLmNvbHVtbiA9IGNoYXJhY3RlcjtcblxuICAgICAgLy8gVGhlIHN0YXJ0IHBvc2l0aW9uIGZvciB0aGUgc2xpY2UgaXMgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiB0aGUgZXJyb3IgbGluZVxuICAgICAgY29uc3QgbGluZVN0YXJ0UG9zaXRpb24gPSB0cy5nZXRQb3NpdGlvbk9mTGluZUFuZENoYXJhY3RlcihpbmZvLmZpbGUsIGxpbmUsIDApO1xuXG4gICAgICAvLyBUaGUgZW5kIHBvc2l0aW9uIGZvciB0aGUgc2xpY2UgaXMgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiB0aGUgbmV4dCBsaW5lIG9yIHRoZSBsZW5ndGggb2ZcbiAgICAgIC8vIHRoZSBlbnRpcmUgZmlsZSBpZiB0aGUgbGluZSBpcyB0aGUgbGFzdCBsaW5lIG9mIHRoZSBmaWxlIChnZXRQb3NpdGlvbk9mTGluZUFuZENoYXJhY3RlclxuICAgICAgLy8gd2lsbCBlcnJvciBpZiBhIG5vbmV4aXN0ZW50IGxpbmUgaXMgcGFzc2VkKS5cbiAgICAgIGNvbnN0IHsgbGluZTogbGFzdExpbmVPZkZpbGUgfSA9IHRzLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKFxuICAgICAgICBpbmZvLmZpbGUsXG4gICAgICAgIGluZm8uZmlsZS50ZXh0Lmxlbmd0aCAtIDEsXG4gICAgICApO1xuICAgICAgY29uc3QgbGluZUVuZFBvc2l0aW9uID1cbiAgICAgICAgbGluZSA8IGxhc3RMaW5lT2ZGaWxlXG4gICAgICAgICAgPyB0cy5nZXRQb3NpdGlvbk9mTGluZUFuZENoYXJhY3RlcihpbmZvLmZpbGUsIGxpbmUgKyAxLCAwKVxuICAgICAgICAgIDogaW5mby5maWxlLnRleHQubGVuZ3RoO1xuXG4gICAgICBub3RlLmxvY2F0aW9uLmxpbmVUZXh0ID0gaW5mby5maWxlLnRleHQuc2xpY2UobGluZVN0YXJ0UG9zaXRpb24sIGxpbmVFbmRQb3NpdGlvbikudHJpbUVuZCgpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBub3RlO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGEgVHlwZVNjcmlwdCBEaWFnbm9zdGljIG1lc3NhZ2UgaW50byBhbiBlc2J1aWxkIGNvbXBhdGlibGUgbWVzc2FnZSBvYmplY3QuXG4gKiBAcGFyYW0gZGlhZ25vc3RpYyBUaGUgVHlwZVNjcmlwdCBkaWFnbm9zdGljIHRvIGNvbnZlcnQuXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIGRpYWdub3N0aWMgbWVzc2FnZSBhcyBhIFBhcnRpYWxNZXNzYWdlIG9iamVjdFxuICovXG5mdW5jdGlvbiBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWMoZGlhZ25vc3RpYzogdHMuRGlhZ25vc3RpYyk6IFBhcnRpYWxNZXNzYWdlIHtcbiAgbGV0IGNvZGVQcmVmaXggPSAnVFMnO1xuICBsZXQgY29kZSA9IGAke2RpYWdub3N0aWMuY29kZX1gO1xuICBpZiAoZGlhZ25vc3RpYy5zb3VyY2UgPT09ICduZ3RzYycpIHtcbiAgICBjb2RlUHJlZml4ID0gJ05HJztcbiAgICAvLyBSZW1vdmUgYC05OWAgQW5ndWxhciBwcmVmaXggZnJvbSBkaWFnbm9zdGljIGNvZGVcbiAgICBjb2RlID0gY29kZS5zbGljZSgzKTtcbiAgfVxuXG4gIGNvbnN0IG1lc3NhZ2U6IFBhcnRpYWxNZXNzYWdlID0ge1xuICAgIC4uLmNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpY0luZm8oZGlhZ25vc3RpYywgYCR7Y29kZVByZWZpeH0ke2NvZGV9OiBgKSxcbiAgICAvLyBTdG9yZSBvcmlnaW5hbCBkaWFnbm9zdGljIGZvciByZWZlcmVuY2UgaWYgbmVlZGVkIGRvd25zdHJlYW1cbiAgICBkZXRhaWw6IGRpYWdub3N0aWMsXG4gIH07XG5cbiAgaWYgKGRpYWdub3N0aWMucmVsYXRlZEluZm9ybWF0aW9uPy5sZW5ndGgpIHtcbiAgICBtZXNzYWdlLm5vdGVzID0gZGlhZ25vc3RpYy5yZWxhdGVkSW5mb3JtYXRpb24ubWFwKChpbmZvKSA9PlxuICAgICAgY29udmVydFR5cGVTY3JpcHREaWFnbm9zdGljSW5mbyhpbmZvKSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIG1lc3NhZ2U7XG59XG5cbmNvbnN0IFVTSU5HX1dJTkRPV1MgPSBwbGF0Zm9ybSgpID09PSAnd2luMzInO1xuY29uc3QgV0lORE9XU19TRVBfUkVHRVhQID0gbmV3IFJlZ0V4cChgXFxcXCR7cGF0aC53aW4zMi5zZXB9YCwgJ2cnKTtcblxuZXhwb3J0IGNsYXNzIFNvdXJjZUZpbGVDYWNoZSBleHRlbmRzIE1hcDxzdHJpbmcsIHRzLlNvdXJjZUZpbGU+IHtcbiAgcmVhZG9ubHkgbW9kaWZpZWRGaWxlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICByZWFkb25seSBiYWJlbEZpbGVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBVaW50OEFycmF5PigpO1xuICByZWFkb25seSB0eXBlU2NyaXB0RmlsZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIFVpbnQ4QXJyYXk+KCk7XG4gIHJlYWRvbmx5IGxvYWRSZXN1bHRDYWNoZSA9IG5ldyBNZW1vcnlMb2FkUmVzdWx0Q2FjaGUoKTtcblxuICBpbnZhbGlkYXRlKGZpbGVzOiBJdGVyYWJsZTxzdHJpbmc+KTogdm9pZCB7XG4gICAgdGhpcy5tb2RpZmllZEZpbGVzLmNsZWFyKCk7XG4gICAgZm9yIChsZXQgZmlsZSBvZiBmaWxlcykge1xuICAgICAgdGhpcy5iYWJlbEZpbGVDYWNoZS5kZWxldGUoZmlsZSk7XG4gICAgICB0aGlzLnR5cGVTY3JpcHRGaWxlQ2FjaGUuZGVsZXRlKHBhdGhUb0ZpbGVVUkwoZmlsZSkuaHJlZik7XG4gICAgICB0aGlzLmxvYWRSZXN1bHRDYWNoZS5pbnZhbGlkYXRlKGZpbGUpO1xuXG4gICAgICAvLyBOb3JtYWxpemUgc2VwYXJhdG9ycyB0byBhbGxvdyBtYXRjaGluZyBUeXBlU2NyaXB0IEhvc3QgcGF0aHNcbiAgICAgIGlmIChVU0lOR19XSU5ET1dTKSB7XG4gICAgICAgIGZpbGUgPSBmaWxlLnJlcGxhY2UoV0lORE9XU19TRVBfUkVHRVhQLCBwYXRoLnBvc2l4LnNlcCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZGVsZXRlKGZpbGUpO1xuICAgICAgdGhpcy5tb2RpZmllZEZpbGVzLmFkZChmaWxlKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb21waWxlclBsdWdpbk9wdGlvbnMge1xuICBzb3VyY2VtYXA6IGJvb2xlYW47XG4gIHRzY29uZmlnOiBzdHJpbmc7XG4gIGppdD86IGJvb2xlYW47XG4gIGFkdmFuY2VkT3B0aW1pemF0aW9ucz86IGJvb2xlYW47XG4gIHRoaXJkUGFydHlTb3VyY2VtYXBzPzogYm9vbGVhbjtcbiAgZmlsZVJlcGxhY2VtZW50cz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZTtcbiAgbG9hZFJlc3VsdENhY2hlPzogTG9hZFJlc3VsdENhY2hlO1xufVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICBwbHVnaW5PcHRpb25zOiBDb21waWxlclBsdWdpbk9wdGlvbnMsXG4gIHN0eWxlT3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMgJiB7IGlubGluZVN0eWxlTGFuZ3VhZ2U6IHN0cmluZyB9LFxuKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1jb21waWxlcicsXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbiAgICBhc3luYyBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgIGxldCBzZXR1cFdhcm5pbmdzOiBQYXJ0aWFsTWVzc2FnZVtdIHwgdW5kZWZpbmVkID0gW107XG5cbiAgICAgIGNvbnN0IHByZXNlcnZlU3ltbGlua3MgPSBidWlsZC5pbml0aWFsT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzO1xuICAgICAgbGV0IHRzY29uZmlnUGF0aCA9IHBsdWdpbk9wdGlvbnMudHNjb25maWc7XG4gICAgICBpZiAoIXByZXNlcnZlU3ltbGlua3MpIHtcbiAgICAgICAgLy8gVXNlIHRoZSByZWFsIHBhdGggb2YgdGhlIHRzY29uZmlnIGlmIG5vdCBwcmVzZXJ2aW5nIHN5bWxpbmtzLlxuICAgICAgICAvLyBUaGlzIGVuc3VyZXMgdGhlIFRTIHNvdXJjZSBmaWxlIHBhdGhzIGFyZSBiYXNlZCBvbiB0aGUgcmVhbCBwYXRoIG9mIHRoZSBjb25maWd1cmF0aW9uLlxuICAgICAgICB0cnkge1xuICAgICAgICAgIHRzY29uZmlnUGF0aCA9IGF3YWl0IHJlYWxwYXRoKHRzY29uZmlnUGF0aCk7XG4gICAgICAgIH0gY2F0Y2gge31cbiAgICAgIH1cblxuICAgICAgLy8gSW5pdGlhbGl6ZSBhIHdvcmtlciBwb29sIGZvciBKYXZhU2NyaXB0IHRyYW5zZm9ybWF0aW9uc1xuICAgICAgY29uc3QgamF2YXNjcmlwdFRyYW5zZm9ybWVyID0gbmV3IEphdmFTY3JpcHRUcmFuc2Zvcm1lcihwbHVnaW5PcHRpb25zLCBtYXhXb3JrZXJzKTtcblxuICAgICAgLy8gU2V0dXAgZGVmaW5lcyBiYXNlZCBvbiB0aGUgdmFsdWVzIHByb3ZpZGVkIGJ5IHRoZSBBbmd1bGFyIGNvbXBpbGVyLWNsaVxuICAgICAgY29uc3QgeyBHTE9CQUxfREVGU19GT1JfVEVSU0VSX1dJVEhfQU9UIH0gPSBhd2FpdCBBbmd1bGFyQ29tcGlsYXRpb24ubG9hZENvbXBpbGVyQ2xpKCk7XG4gICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUgPz89IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCkpIHtcbiAgICAgICAgaWYgKGtleSBpbiBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUpIHtcbiAgICAgICAgICAvLyBTa2lwIGtleXMgdGhhdCBoYXZlIGJlZW4gbWFudWFsbHkgcHJvdmlkZWRcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoa2V5ID09PSAnbmdEZXZNb2RlJykge1xuICAgICAgICAgIC8vIG5nRGV2TW9kZSBpcyBhbHJlYWR5IHNldCBiYXNlZCBvbiB0aGUgYnVpbGRlcidzIHNjcmlwdCBvcHRpbWl6YXRpb24gb3B0aW9uXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZXNidWlsZCByZXF1aXJlcyB2YWx1ZXMgdG8gYmUgYSBzdHJpbmcgKGFjdHVhbCBzdHJpbmdzIG5lZWQgdG8gYmUgcXVvdGVkKS5cbiAgICAgICAgLy8gSW4gdGhpcyBjYXNlLCBhbGwgcHJvdmlkZWQgdmFsdWVzIGFyZSBib29sZWFucy5cbiAgICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lW2tleV0gPSB2YWx1ZS50b1N0cmluZygpO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgZmlsZSBlbWl0dGVyIGNyZWF0ZWQgZHVyaW5nIGBvblN0YXJ0YCB0aGF0IHdpbGwgYmUgdXNlZCBkdXJpbmcgdGhlIGJ1aWxkIGluIGBvbkxvYWRgIGNhbGxiYWNrcyBmb3IgVFMgZmlsZXNcbiAgICAgIGxldCBmaWxlRW1pdHRlcjogRmlsZUVtaXR0ZXIgfCB1bmRlZmluZWQ7XG5cbiAgICAgIC8vIFRoZSBzdHlsZXNoZWV0IHJlc291cmNlcyBmcm9tIGNvbXBvbmVudCBzdHlsZXNoZWV0cyB0aGF0IHdpbGwgYmUgYWRkZWQgdG8gdGhlIGJ1aWxkIHJlc3VsdHMgb3V0cHV0IGZpbGVzXG4gICAgICBsZXQgc3R5bGVzaGVldFJlc291cmNlRmlsZXM6IE91dHB1dEZpbGVbXSA9IFtdO1xuICAgICAgbGV0IHN0eWxlc2hlZXRNZXRhZmlsZXM6IE1ldGFmaWxlW107XG5cbiAgICAgIC8vIENyZWF0ZSBuZXcgcmV1c2FibGUgY29tcGlsYXRpb24gZm9yIHRoZSBhcHByb3ByaWF0ZSBtb2RlIGJhc2VkIG9uIHRoZSBgaml0YCBwbHVnaW4gb3B0aW9uXG4gICAgICBjb25zdCBjb21waWxhdGlvbjogQW5ndWxhckNvbXBpbGF0aW9uID0gcGx1Z2luT3B0aW9ucy5qaXRcbiAgICAgICAgPyBuZXcgSml0Q29tcGlsYXRpb24oKVxuICAgICAgICA6IG5ldyBBb3RDb21waWxhdGlvbigpO1xuXG4gICAgICAvLyBEZXRlcm1pbmVzIGlmIFR5cGVTY3JpcHQgc2hvdWxkIHByb2Nlc3MgSmF2YVNjcmlwdCBmaWxlcyBiYXNlZCBvbiB0c2NvbmZpZyBgYWxsb3dKc2Agb3B0aW9uXG4gICAgICBsZXQgc2hvdWxkVHNJZ25vcmVKcyA9IHRydWU7XG5cbiAgICAgIGJ1aWxkLm9uU3RhcnQoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQ6IE9uU3RhcnRSZXN1bHQgPSB7XG4gICAgICAgICAgd2FybmluZ3M6IHNldHVwV2FybmluZ3MsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gUmVzZXQgZGVidWcgcGVyZm9ybWFuY2UgdHJhY2tpbmdcbiAgICAgICAgcmVzZXRDdW11bGF0aXZlRHVyYXRpb25zKCk7XG5cbiAgICAgICAgLy8gUmVzZXQgc3R5bGVzaGVldCByZXNvdXJjZSBvdXRwdXQgZmlsZXNcbiAgICAgICAgc3R5bGVzaGVldFJlc291cmNlRmlsZXMgPSBbXTtcbiAgICAgICAgc3R5bGVzaGVldE1ldGFmaWxlcyA9IFtdO1xuXG4gICAgICAgIC8vIENyZWF0ZSBBbmd1bGFyIGNvbXBpbGVyIGhvc3Qgb3B0aW9uc1xuICAgICAgICBjb25zdCBob3N0T3B0aW9uczogQW5ndWxhckhvc3RPcHRpb25zID0ge1xuICAgICAgICAgIGZpbGVSZXBsYWNlbWVudHM6IHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cyxcbiAgICAgICAgICBtb2RpZmllZEZpbGVzOiBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8ubW9kaWZpZWRGaWxlcyxcbiAgICAgICAgICBzb3VyY2VGaWxlQ2FjaGU6IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlLFxuICAgICAgICAgIGFzeW5jIHRyYW5zZm9ybVN0eWxlc2hlZXQoZGF0YSwgY29udGFpbmluZ0ZpbGUsIHN0eWxlc2hlZXRGaWxlKSB7XG4gICAgICAgICAgICAvLyBTdHlsZXNoZWV0IGZpbGUgb25seSBleGlzdHMgZm9yIGV4dGVybmFsIHN0eWxlc2hlZXRzXG4gICAgICAgICAgICBjb25zdCBmaWxlbmFtZSA9IHN0eWxlc2hlZXRGaWxlID8/IGNvbnRhaW5pbmdGaWxlO1xuXG4gICAgICAgICAgICBjb25zdCBzdHlsZXNoZWV0UmVzdWx0ID0gYXdhaXQgYnVuZGxlQ29tcG9uZW50U3R5bGVzaGVldChcbiAgICAgICAgICAgICAgc3R5bGVPcHRpb25zLmlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgIGZpbGVuYW1lLFxuICAgICAgICAgICAgICAhc3R5bGVzaGVldEZpbGUsXG4gICAgICAgICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICAgICAgICAgcGx1Z2luT3B0aW9ucy5sb2FkUmVzdWx0Q2FjaGUsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBjb25zdCB7IGNvbnRlbnRzLCByZXNvdXJjZUZpbGVzLCBlcnJvcnMsIHdhcm5pbmdzIH0gPSBzdHlsZXNoZWV0UmVzdWx0O1xuICAgICAgICAgICAgaWYgKGVycm9ycykge1xuICAgICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgICAgIHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLnB1c2goLi4ucmVzb3VyY2VGaWxlcyk7XG4gICAgICAgICAgICBpZiAoc3R5bGVzaGVldFJlc3VsdC5tZXRhZmlsZSkge1xuICAgICAgICAgICAgICBzdHlsZXNoZWV0TWV0YWZpbGVzLnB1c2goc3R5bGVzaGVldFJlc3VsdC5tZXRhZmlsZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjb250ZW50cztcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIEluaXRpYWxpemUgdGhlIEFuZ3VsYXIgY29tcGlsYXRpb24gZm9yIHRoZSBjdXJyZW50IGJ1aWxkLlxuICAgICAgICAvLyBJbiB3YXRjaCBtb2RlLCBwcmV2aW91cyBidWlsZCBzdGF0ZSB3aWxsIGJlIHJldXNlZC5cbiAgICAgICAgY29uc3Qge1xuICAgICAgICAgIGFmZmVjdGVkRmlsZXMsXG4gICAgICAgICAgY29tcGlsZXJPcHRpb25zOiB7IGFsbG93SnMgfSxcbiAgICAgICAgfSA9IGF3YWl0IGNvbXBpbGF0aW9uLmluaXRpYWxpemUodHNjb25maWdQYXRoLCBob3N0T3B0aW9ucywgKGNvbXBpbGVyT3B0aW9ucykgPT4ge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCA8IHRzLlNjcmlwdFRhcmdldC5FUzIwMjJcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIC8vIElmICd1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkcycgaXMgYWxyZWFkeSBkZWZpbmVkIGluIHRoZSB1c2VycyBwcm9qZWN0IGxlYXZlIHRoZSB2YWx1ZSBhcyBpcy5cbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSBmYWxsYmFjayB0byBmYWxzZSBkdWUgdG8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy80NTk5NVxuICAgICAgICAgICAgLy8gd2hpY2ggYnJlYWtzIHRoZSBkZXByZWNhdGVkIGBARWZmZWN0c2AgTkdSWCBkZWNvcmF0b3IgYW5kIHBvdGVudGlhbGx5IG90aGVyIGV4aXN0aW5nIGNvZGUgYXMgd2VsbC5cbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPSB0cy5TY3JpcHRUYXJnZXQuRVMyMDIyO1xuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnVzZURlZmluZUZvckNsYXNzRmllbGRzID8/PSBmYWxzZTtcblxuICAgICAgICAgICAgLy8gT25seSBhZGQgdGhlIHdhcm5pbmcgb24gdGhlIGluaXRpYWwgYnVpbGRcbiAgICAgICAgICAgIHNldHVwV2FybmluZ3M/LnB1c2goe1xuICAgICAgICAgICAgICB0ZXh0OlxuICAgICAgICAgICAgICAgICdUeXBlU2NyaXB0IGNvbXBpbGVyIG9wdGlvbnMgXCJ0YXJnZXRcIiBhbmQgXCJ1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkc1wiIGFyZSBzZXQgdG8gXCJFUzIwMjJcIiBhbmQgJyArXG4gICAgICAgICAgICAgICAgJ1wiZmFsc2VcIiByZXNwZWN0aXZlbHkgYnkgdGhlIEFuZ3VsYXIgQ0xJLicsXG4gICAgICAgICAgICAgIGxvY2F0aW9uOiB7IGZpbGU6IHBsdWdpbk9wdGlvbnMudHNjb25maWcgfSxcbiAgICAgICAgICAgICAgbm90ZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB0ZXh0OlxuICAgICAgICAgICAgICAgICAgICAnVG8gY29udHJvbCBFQ01BIHZlcnNpb24gYW5kIGZlYXR1cmVzIHVzZSB0aGUgQnJvd2Vyc2xpc3QgY29uZmlndXJhdGlvbi4gJyArXG4gICAgICAgICAgICAgICAgICAgICdGb3IgbW9yZSBpbmZvcm1hdGlvbiwgc2VlIGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS9idWlsZCNjb25maWd1cmluZy1icm93c2VyLWNvbXBhdGliaWxpdHknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4uY29tcGlsZXJPcHRpb25zLFxuICAgICAgICAgICAgbm9FbWl0T25FcnJvcjogZmFsc2UsXG4gICAgICAgICAgICBpbmxpbmVTb3VyY2VzOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIGlubGluZVNvdXJjZU1hcDogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgICBtYXBSb290OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBzb3VyY2VSb290OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgICBzaG91bGRUc0lnbm9yZUpzID0gIWFsbG93SnM7XG5cbiAgICAgICAgLy8gQ2xlYXIgYWZmZWN0ZWQgZmlsZXMgZnJvbSB0aGUgY2FjaGUgKGlmIHByZXNlbnQpXG4gICAgICAgIGlmIChwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZSkge1xuICAgICAgICAgIGZvciAoY29uc3QgYWZmZWN0ZWQgb2YgYWZmZWN0ZWRGaWxlcykge1xuICAgICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUudHlwZVNjcmlwdEZpbGVDYWNoZS5kZWxldGUoXG4gICAgICAgICAgICAgIHBhdGhUb0ZpbGVVUkwoYWZmZWN0ZWQuZmlsZU5hbWUpLmhyZWYsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHByb2ZpbGVTeW5jKCdOR19ESUFHTk9TVElDU19UT1RBTCcsICgpID0+IHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGRpYWdub3N0aWMgb2YgY29tcGlsYXRpb24uY29sbGVjdERpYWdub3N0aWNzKCkpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWMoZGlhZ25vc3RpYyk7XG4gICAgICAgICAgICBpZiAoZGlhZ25vc3RpYy5jYXRlZ29yeSA9PT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKSB7XG4gICAgICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaChtZXNzYWdlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgZmlsZUVtaXR0ZXIgPSBjb21waWxhdGlvbi5jcmVhdGVGaWxlRW1pdHRlcigpO1xuXG4gICAgICAgIC8vIFJlc2V0IHRoZSBzZXR1cCB3YXJuaW5ncyBzbyB0aGF0IHRoZXkgYXJlIG9ubHkgc2hvd24gZHVyaW5nIHRoZSBmaXJzdCBidWlsZC5cbiAgICAgICAgc2V0dXBXYXJuaW5ncyA9IHVuZGVmaW5lZDtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLltjbV0/W2p0XXN4PyQvIH0sIChhcmdzKSA9PlxuICAgICAgICBwcm9maWxlQXN5bmMoXG4gICAgICAgICAgJ05HX0VNSVRfVFMqJyxcbiAgICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBhc3NlcnQub2soZmlsZUVtaXR0ZXIsICdJbnZhbGlkIHBsdWdpbiBleGVjdXRpb24gb3JkZXInKTtcblxuICAgICAgICAgICAgY29uc3QgcmVxdWVzdCA9IHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cz8uW2FyZ3MucGF0aF0gPz8gYXJncy5wYXRoO1xuXG4gICAgICAgICAgICAvLyBTa2lwIFRTIGxvYWQgYXR0ZW1wdCBpZiBKUyBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uIG5vdCBlbmFibGVkIGFuZCBmaWxlIGlzIEpTXG4gICAgICAgICAgICBpZiAoc2hvdWxkVHNJZ25vcmVKcyAmJiAvXFwuW2NtXT9qcyQvLnRlc3QocmVxdWVzdCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVGhlIGZpbGVuYW1lIGlzIGN1cnJlbnRseSB1c2VkIGFzIGEgY2FjaGUga2V5LiBTaW5jZSB0aGUgY2FjaGUgaXMgbWVtb3J5IG9ubHksXG4gICAgICAgICAgICAvLyB0aGUgb3B0aW9ucyBjYW5ub3QgY2hhbmdlIGFuZCBkbyBub3QgbmVlZCB0byBiZSByZXByZXNlbnRlZCBpbiB0aGUga2V5LiBJZiB0aGVcbiAgICAgICAgICAgIC8vIGNhY2hlIGlzIGxhdGVyIHN0b3JlZCB0byBkaXNrLCB0aGVuIHRoZSBvcHRpb25zIHRoYXQgYWZmZWN0IHRyYW5zZm9ybSBvdXRwdXRcbiAgICAgICAgICAgIC8vIHdvdWxkIG5lZWQgdG8gYmUgYWRkZWQgdG8gdGhlIGtleSBhcyB3ZWxsIGFzIGEgY2hlY2sgZm9yIGFueSBjaGFuZ2Ugb2YgY29udGVudC5cbiAgICAgICAgICAgIGxldCBjb250ZW50cyA9IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy50eXBlU2NyaXB0RmlsZUNhY2hlLmdldChcbiAgICAgICAgICAgICAgcGF0aFRvRmlsZVVSTChyZXF1ZXN0KS5ocmVmLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgY29uc3QgdHlwZXNjcmlwdFJlc3VsdCA9IGF3YWl0IGZpbGVFbWl0dGVyKHJlcXVlc3QpO1xuICAgICAgICAgICAgICBpZiAoIXR5cGVzY3JpcHRSZXN1bHQ/LmNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICAvLyBObyBUUyByZXN1bHQgaW5kaWNhdGVzIHRoZSBmaWxlIGlzIG5vdCBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0uXG4gICAgICAgICAgICAgICAgLy8gSWYgYWxsb3dKcyBpcyBlbmFibGVkIGFuZCB0aGUgZmlsZSBpcyBKUyB0aGVuIGRlZmVyIHRvIHRoZSBuZXh0IGxvYWQgaG9vay5cbiAgICAgICAgICAgICAgICBpZiAoIXNob3VsZFRzSWdub3JlSnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KHJlcXVlc3QpKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIE90aGVyd2lzZSByZXR1cm4gYW4gZXJyb3JcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgICAgICAgIGNyZWF0ZU1pc3NpbmdGaWxlRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdCxcbiAgICAgICAgICAgICAgICAgICAgICBhcmdzLnBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuYWJzV29ya2luZ0RpciA/PyAnJyxcbiAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnRlbnRzID0gYXdhaXQgamF2YXNjcmlwdFRyYW5zZm9ybWVyLnRyYW5zZm9ybURhdGEoXG4gICAgICAgICAgICAgICAgcmVxdWVzdCxcbiAgICAgICAgICAgICAgICB0eXBlc2NyaXB0UmVzdWx0LmNvbnRlbnQsXG4gICAgICAgICAgICAgICAgdHJ1ZSAvKiBza2lwTGlua2VyICovLFxuICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy50eXBlU2NyaXB0RmlsZUNhY2hlLnNldChcbiAgICAgICAgICAgICAgICBwYXRoVG9GaWxlVVJMKHJlcXVlc3QpLmhyZWYsXG4gICAgICAgICAgICAgICAgY29udGVudHMsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKSxcbiAgICAgICk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLltjbV0/anMkLyB9LCAoYXJncykgPT5cbiAgICAgICAgcHJvZmlsZUFzeW5jKFxuICAgICAgICAgICdOR19FTUlUX0pTKicsXG4gICAgICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgLy8gVGhlIGZpbGVuYW1lIGlzIGN1cnJlbnRseSB1c2VkIGFzIGEgY2FjaGUga2V5LiBTaW5jZSB0aGUgY2FjaGUgaXMgbWVtb3J5IG9ubHksXG4gICAgICAgICAgICAvLyB0aGUgb3B0aW9ucyBjYW5ub3QgY2hhbmdlIGFuZCBkbyBub3QgbmVlZCB0byBiZSByZXByZXNlbnRlZCBpbiB0aGUga2V5LiBJZiB0aGVcbiAgICAgICAgICAgIC8vIGNhY2hlIGlzIGxhdGVyIHN0b3JlZCB0byBkaXNrLCB0aGVuIHRoZSBvcHRpb25zIHRoYXQgYWZmZWN0IHRyYW5zZm9ybSBvdXRwdXRcbiAgICAgICAgICAgIC8vIHdvdWxkIG5lZWQgdG8gYmUgYWRkZWQgdG8gdGhlIGtleSBhcyB3ZWxsIGFzIGEgY2hlY2sgZm9yIGFueSBjaGFuZ2Ugb2YgY29udGVudC5cbiAgICAgICAgICAgIGxldCBjb250ZW50cyA9IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5iYWJlbEZpbGVDYWNoZS5nZXQoYXJncy5wYXRoKTtcbiAgICAgICAgICAgIGlmIChjb250ZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGNvbnRlbnRzID0gYXdhaXQgamF2YXNjcmlwdFRyYW5zZm9ybWVyLnRyYW5zZm9ybUZpbGUoYXJncy5wYXRoLCBwbHVnaW5PcHRpb25zLmppdCk7XG4gICAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5iYWJlbEZpbGVDYWNoZS5zZXQoYXJncy5wYXRoLCBjb250ZW50cyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKSxcbiAgICAgICk7XG5cbiAgICAgIC8vIFNldHVwIGJ1bmRsaW5nIG9mIGNvbXBvbmVudCB0ZW1wbGF0ZXMgYW5kIHN0eWxlc2hlZXRzIHdoZW4gaW4gSklUIG1vZGVcbiAgICAgIGlmIChwbHVnaW5PcHRpb25zLmppdCkge1xuICAgICAgICBzZXR1cEppdFBsdWdpbkNhbGxiYWNrcyhcbiAgICAgICAgICBidWlsZCxcbiAgICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICAgICAgc3R5bGVzaGVldFJlc291cmNlRmlsZXMsXG4gICAgICAgICAgcGx1Z2luT3B0aW9ucy5sb2FkUmVzdWx0Q2FjaGUsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGJ1aWxkLm9uRW5kKChyZXN1bHQpID0+IHtcbiAgICAgICAgLy8gQWRkIGFueSBjb21wb25lbnQgc3R5bGVzaGVldCByZXNvdXJjZSBmaWxlcyB0byB0aGUgb3V0cHV0IGZpbGVzXG4gICAgICAgIGlmIChzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcy5sZW5ndGgpIHtcbiAgICAgICAgICByZXN1bHQub3V0cHV0RmlsZXM/LnB1c2goLi4uc3R5bGVzaGVldFJlc291cmNlRmlsZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ29tYmluZSBjb21wb25lbnQgc3R5bGVzaGVldCBtZXRhZmlsZXMgd2l0aCBtYWluIG1ldGFmaWxlXG4gICAgICAgIGlmIChyZXN1bHQubWV0YWZpbGUgJiYgc3R5bGVzaGVldE1ldGFmaWxlcy5sZW5ndGgpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IG1ldGFmaWxlIG9mIHN0eWxlc2hlZXRNZXRhZmlsZXMpIHtcbiAgICAgICAgICAgIHJlc3VsdC5tZXRhZmlsZS5pbnB1dHMgPSB7IC4uLnJlc3VsdC5tZXRhZmlsZS5pbnB1dHMsIC4uLm1ldGFmaWxlLmlucHV0cyB9O1xuICAgICAgICAgICAgcmVzdWx0Lm1ldGFmaWxlLm91dHB1dHMgPSB7IC4uLnJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzLCAuLi5tZXRhZmlsZS5vdXRwdXRzIH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbG9nQ3VtdWxhdGl2ZUR1cmF0aW9ucygpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTWlzc2luZ0ZpbGVFcnJvcihyZXF1ZXN0OiBzdHJpbmcsIG9yaWdpbmFsOiBzdHJpbmcsIHJvb3Q6IHN0cmluZyk6IFBhcnRpYWxNZXNzYWdlIHtcbiAgY29uc3QgZXJyb3IgPSB7XG4gICAgdGV4dDogYEZpbGUgJyR7cGF0aC5yZWxhdGl2ZShyb290LCByZXF1ZXN0KX0nIGlzIG1pc3NpbmcgZnJvbSB0aGUgVHlwZVNjcmlwdCBjb21waWxhdGlvbi5gLFxuICAgIG5vdGVzOiBbXG4gICAgICB7XG4gICAgICAgIHRleHQ6IGBFbnN1cmUgdGhlIGZpbGUgaXMgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBwcm9ncmFtIHZpYSB0aGUgJ2ZpbGVzJyBvciAnaW5jbHVkZScgcHJvcGVydHkuYCxcbiAgICAgIH0sXG4gICAgXSxcbiAgfTtcblxuICBpZiAocmVxdWVzdCAhPT0gb3JpZ2luYWwpIHtcbiAgICBlcnJvci5ub3Rlcy5wdXNoKHtcbiAgICAgIHRleHQ6IGBGaWxlIGlzIHJlcXVlc3RlZCBmcm9tIGEgZmlsZSByZXBsYWNlbWVudCBvZiAnJHtwYXRoLnJlbGF0aXZlKHJvb3QsIG9yaWdpbmFsKX0nLmAsXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gZXJyb3I7XG59XG4iXX0=