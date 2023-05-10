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
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const path = __importStar(require("node:path"));
const node_url_1 = require("node:url");
const typescript_1 = __importDefault(require("typescript"));
const environment_options_1 = require("../../../utils/environment-options");
const javascript_transformer_1 = require("../javascript-transformer");
const load_result_cache_1 = require("../load-result-cache");
const profiling_1 = require("../profiling");
const bundle_options_1 = require("../stylesheets/bundle-options");
const angular_compilation_1 = require("./angular-compilation");
const aot_compilation_1 = require("./aot-compilation");
const diagnostics_1 = require("./diagnostics");
const jit_compilation_1 = require("./jit-compilation");
const jit_plugin_callbacks_1 = require("./jit-plugin-callbacks");
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
            // The in-memory cache of TypeScript file outputs will be used during the build in `onLoad` callbacks for TS files.
            // A string value indicates direct TS/NG output and a Uint8Array indicates fully transformed code.
            const typeScriptFileCache = pluginOptions.sourceFileCache?.typeScriptFileCache ??
                new Map();
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
                        const stylesheetResult = await (0, bundle_options_1.bundleComponentStylesheet)(styleOptions.inlineStyleLanguage, data, filename, !stylesheetFile, styleOptions, pluginOptions.loadResultCache);
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
                const { compilerOptions: { allowJs }, } = await compilation.initialize(tsconfigPath, hostOptions, (compilerOptions) => {
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
                (0, profiling_1.profileSync)('NG_DIAGNOSTICS_TOTAL', () => {
                    for (const diagnostic of compilation.collectDiagnostics()) {
                        const message = (0, diagnostics_1.convertTypeScriptDiagnostic)(diagnostic);
                        if (diagnostic.category === typescript_1.default.DiagnosticCategory.Error) {
                            (result.errors ?? (result.errors = [])).push(message);
                        }
                        else {
                            (result.warnings ?? (result.warnings = [])).push(message);
                        }
                    }
                });
                // Update TypeScript file output cache for all affected files
                for (const { filename, contents } of compilation.emitAffectedFiles()) {
                    typeScriptFileCache.set((0, node_url_1.pathToFileURL)(filename).href, contents);
                }
                // Reset the setup warnings so that they are only shown during the first build.
                setupWarnings = undefined;
                return result;
            });
            build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, (args) => (0, profiling_1.profileAsync)('NG_EMIT_TS*', async () => {
                const request = pluginOptions.fileReplacements?.[args.path] ?? args.path;
                // Skip TS load attempt if JS TypeScript compilation not enabled and file is JS
                if (shouldTsIgnoreJs && /\.[cm]?js$/.test(request)) {
                    return undefined;
                }
                // The filename is currently used as a cache key. Since the cache is memory only,
                // the options cannot change and do not need to be represented in the key. If the
                // cache is later stored to disk, then the options that affect transform output
                // would need to be added to the key as well as a check for any change of content.
                let contents = typeScriptFileCache.get((0, node_url_1.pathToFileURL)(request).href);
                if (contents === undefined) {
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
                else if (typeof contents === 'string') {
                    // A string indicates untransformed output from the TS/NG compiler
                    contents = await javascriptTransformer.transformData(request, contents, true /* skipLinker */);
                    // Store as the returned Uint8Array to allow caching the fully transformed code
                    typeScriptFileCache.set((0, node_url_1.pathToFileURL)(request).href, contents);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2FuZ3VsYXIvY29tcGlsZXItcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBVUgsK0NBQTRDO0FBQzVDLHFDQUFtQztBQUNuQyxnREFBa0M7QUFDbEMsdUNBQXlDO0FBQ3pDLDREQUE0QjtBQUM1Qiw0RUFBZ0U7QUFDaEUsc0VBQWtFO0FBQ2xFLDREQUE4RTtBQUM5RSw0Q0FLc0I7QUFDdEIsa0VBQW1HO0FBQ25HLCtEQUEyRDtBQUUzRCx1REFBbUQ7QUFDbkQsK0NBQTREO0FBQzVELHVEQUFtRDtBQUNuRCxpRUFBaUU7QUFFakUsTUFBTSxhQUFhLEdBQUcsSUFBQSxrQkFBUSxHQUFFLEtBQUssT0FBTyxDQUFDO0FBQzdDLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxNQUFNLENBQUMsS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBRWxFLE1BQWEsZUFBZ0IsU0FBUSxHQUEwQjtJQUEvRDs7UUFDVyxrQkFBYSxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFDbEMsbUJBQWMsR0FBRyxJQUFJLEdBQUcsRUFBc0IsQ0FBQztRQUMvQyx3QkFBbUIsR0FBRyxJQUFJLEdBQUcsRUFBK0IsQ0FBQztRQUM3RCxvQkFBZSxHQUFHLElBQUkseUNBQXFCLEVBQUUsQ0FBQztJQWtCekQsQ0FBQztJQWhCQyxVQUFVLENBQUMsS0FBdUI7UUFDaEMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUMzQixLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssRUFBRTtZ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OlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgTWV0YWZpbGUsXG4gIE9uU3RhcnRSZXN1bHQsXG4gIE91dHB1dEZpbGUsXG4gIFBhcnRpYWxNZXNzYWdlLFxuICBQbHVnaW4sXG4gIFBsdWdpbkJ1aWxkLFxufSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IHJlYWxwYXRoIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJ25vZGU6b3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7IG1heFdvcmtlcnMgfSBmcm9tICcuLi8uLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IEphdmFTY3JpcHRUcmFuc2Zvcm1lciB9IGZyb20gJy4uL2phdmFzY3JpcHQtdHJhbnNmb3JtZXInO1xuaW1wb3J0IHsgTG9hZFJlc3VsdENhY2hlLCBNZW1vcnlMb2FkUmVzdWx0Q2FjaGUgfSBmcm9tICcuLi9sb2FkLXJlc3VsdC1jYWNoZSc7XG5pbXBvcnQge1xuICBsb2dDdW11bGF0aXZlRHVyYXRpb25zLFxuICBwcm9maWxlQXN5bmMsXG4gIHByb2ZpbGVTeW5jLFxuICByZXNldEN1bXVsYXRpdmVEdXJhdGlvbnMsXG59IGZyb20gJy4uL3Byb2ZpbGluZyc7XG5pbXBvcnQgeyBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucywgYnVuZGxlQ29tcG9uZW50U3R5bGVzaGVldCB9IGZyb20gJy4uL3N0eWxlc2hlZXRzL2J1bmRsZS1vcHRpb25zJztcbmltcG9ydCB7IEFuZ3VsYXJDb21waWxhdGlvbiB9IGZyb20gJy4vYW5ndWxhci1jb21waWxhdGlvbic7XG5pbXBvcnQgeyBBbmd1bGFySG9zdE9wdGlvbnMgfSBmcm9tICcuL2FuZ3VsYXItaG9zdCc7XG5pbXBvcnQgeyBBb3RDb21waWxhdGlvbiB9IGZyb20gJy4vYW90LWNvbXBpbGF0aW9uJztcbmltcG9ydCB7IGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpYyB9IGZyb20gJy4vZGlhZ25vc3RpY3MnO1xuaW1wb3J0IHsgSml0Q29tcGlsYXRpb24gfSBmcm9tICcuL2ppdC1jb21waWxhdGlvbic7XG5pbXBvcnQgeyBzZXR1cEppdFBsdWdpbkNhbGxiYWNrcyB9IGZyb20gJy4vaml0LXBsdWdpbi1jYWxsYmFja3MnO1xuXG5jb25zdCBVU0lOR19XSU5ET1dTID0gcGxhdGZvcm0oKSA9PT0gJ3dpbjMyJztcbmNvbnN0IFdJTkRPV1NfU0VQX1JFR0VYUCA9IG5ldyBSZWdFeHAoYFxcXFwke3BhdGgud2luMzIuc2VwfWAsICdnJyk7XG5cbmV4cG9ydCBjbGFzcyBTb3VyY2VGaWxlQ2FjaGUgZXh0ZW5kcyBNYXA8c3RyaW5nLCB0cy5Tb3VyY2VGaWxlPiB7XG4gIHJlYWRvbmx5IG1vZGlmaWVkRmlsZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcmVhZG9ubHkgYmFiZWxGaWxlQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgVWludDhBcnJheT4oKTtcbiAgcmVhZG9ubHkgdHlwZVNjcmlwdEZpbGVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmcgfCBVaW50OEFycmF5PigpO1xuICByZWFkb25seSBsb2FkUmVzdWx0Q2FjaGUgPSBuZXcgTWVtb3J5TG9hZFJlc3VsdENhY2hlKCk7XG5cbiAgaW52YWxpZGF0ZShmaWxlczogSXRlcmFibGU8c3RyaW5nPik6IHZvaWQge1xuICAgIHRoaXMubW9kaWZpZWRGaWxlcy5jbGVhcigpO1xuICAgIGZvciAobGV0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIHRoaXMuYmFiZWxGaWxlQ2FjaGUuZGVsZXRlKGZpbGUpO1xuICAgICAgdGhpcy50eXBlU2NyaXB0RmlsZUNhY2hlLmRlbGV0ZShwYXRoVG9GaWxlVVJMKGZpbGUpLmhyZWYpO1xuICAgICAgdGhpcy5sb2FkUmVzdWx0Q2FjaGUuaW52YWxpZGF0ZShmaWxlKTtcblxuICAgICAgLy8gTm9ybWFsaXplIHNlcGFyYXRvcnMgdG8gYWxsb3cgbWF0Y2hpbmcgVHlwZVNjcmlwdCBIb3N0IHBhdGhzXG4gICAgICBpZiAoVVNJTkdfV0lORE9XUykge1xuICAgICAgICBmaWxlID0gZmlsZS5yZXBsYWNlKFdJTkRPV1NfU0VQX1JFR0VYUCwgcGF0aC5wb3NpeC5zZXApO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmRlbGV0ZShmaWxlKTtcbiAgICAgIHRoaXMubW9kaWZpZWRGaWxlcy5hZGQoZmlsZSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZXJQbHVnaW5PcHRpb25zIHtcbiAgc291cmNlbWFwOiBib29sZWFuO1xuICB0c2NvbmZpZzogc3RyaW5nO1xuICBqaXQ/OiBib29sZWFuO1xuICBhZHZhbmNlZE9wdGltaXphdGlvbnM/OiBib29sZWFuO1xuICB0aGlyZFBhcnR5U291cmNlbWFwcz86IGJvb2xlYW47XG4gIGZpbGVSZXBsYWNlbWVudHM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGU7XG4gIGxvYWRSZXN1bHRDYWNoZT86IExvYWRSZXN1bHRDYWNoZTtcbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgcGx1Z2luT3B0aW9uczogQ29tcGlsZXJQbHVnaW5PcHRpb25zLFxuICBzdHlsZU9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zICYgeyBpbmxpbmVTdHlsZUxhbmd1YWdlOiBzdHJpbmcgfSxcbik6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItY29tcGlsZXInLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG4gICAgYXN5bmMgc2V0dXAoYnVpbGQ6IFBsdWdpbkJ1aWxkKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICBsZXQgc2V0dXBXYXJuaW5nczogUGFydGlhbE1lc3NhZ2VbXSB8IHVuZGVmaW5lZCA9IFtdO1xuXG4gICAgICBjb25zdCBwcmVzZXJ2ZVN5bWxpbmtzID0gYnVpbGQuaW5pdGlhbE9wdGlvbnMucHJlc2VydmVTeW1saW5rcztcbiAgICAgIGxldCB0c2NvbmZpZ1BhdGggPSBwbHVnaW5PcHRpb25zLnRzY29uZmlnO1xuICAgICAgaWYgKCFwcmVzZXJ2ZVN5bWxpbmtzKSB7XG4gICAgICAgIC8vIFVzZSB0aGUgcmVhbCBwYXRoIG9mIHRoZSB0c2NvbmZpZyBpZiBub3QgcHJlc2VydmluZyBzeW1saW5rcy5cbiAgICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoZSBUUyBzb3VyY2UgZmlsZSBwYXRocyBhcmUgYmFzZWQgb24gdGhlIHJlYWwgcGF0aCBvZiB0aGUgY29uZmlndXJhdGlvbi5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0c2NvbmZpZ1BhdGggPSBhd2FpdCByZWFscGF0aCh0c2NvbmZpZ1BhdGgpO1xuICAgICAgICB9IGNhdGNoIHt9XG4gICAgICB9XG5cbiAgICAgIC8vIEluaXRpYWxpemUgYSB3b3JrZXIgcG9vbCBmb3IgSmF2YVNjcmlwdCB0cmFuc2Zvcm1hdGlvbnNcbiAgICAgIGNvbnN0IGphdmFzY3JpcHRUcmFuc2Zvcm1lciA9IG5ldyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIocGx1Z2luT3B0aW9ucywgbWF4V29ya2Vycyk7XG5cbiAgICAgIC8vIFNldHVwIGRlZmluZXMgYmFzZWQgb24gdGhlIHZhbHVlcyBwcm92aWRlZCBieSB0aGUgQW5ndWxhciBjb21waWxlci1jbGlcbiAgICAgIGNvbnN0IHsgR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCB9ID0gYXdhaXQgQW5ndWxhckNvbXBpbGF0aW9uLmxvYWRDb21waWxlckNsaSgpO1xuICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lID8/PSB7fTtcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKEdMT0JBTF9ERUZTX0ZPUl9URVJTRVJfV0lUSF9BT1QpKSB7XG4gICAgICAgIGlmIChrZXkgaW4gYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lKSB7XG4gICAgICAgICAgLy8gU2tpcCBrZXlzIHRoYXQgaGF2ZSBiZWVuIG1hbnVhbGx5IHByb3ZpZGVkXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGtleSA9PT0gJ25nRGV2TW9kZScpIHtcbiAgICAgICAgICAvLyBuZ0Rldk1vZGUgaXMgYWxyZWFkeSBzZXQgYmFzZWQgb24gdGhlIGJ1aWxkZXIncyBzY3JpcHQgb3B0aW1pemF0aW9uIG9wdGlvblxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIGVzYnVpbGQgcmVxdWlyZXMgdmFsdWVzIHRvIGJlIGEgc3RyaW5nIChhY3R1YWwgc3RyaW5ncyBuZWVkIHRvIGJlIHF1b3RlZCkuXG4gICAgICAgIC8vIEluIHRoaXMgY2FzZSwgYWxsIHByb3ZpZGVkIHZhbHVlcyBhcmUgYm9vbGVhbnMuXG4gICAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLmRlZmluZVtrZXldID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIGluLW1lbW9yeSBjYWNoZSBvZiBUeXBlU2NyaXB0IGZpbGUgb3V0cHV0cyB3aWxsIGJlIHVzZWQgZHVyaW5nIHRoZSBidWlsZCBpbiBgb25Mb2FkYCBjYWxsYmFja3MgZm9yIFRTIGZpbGVzLlxuICAgICAgLy8gQSBzdHJpbmcgdmFsdWUgaW5kaWNhdGVzIGRpcmVjdCBUUy9ORyBvdXRwdXQgYW5kIGEgVWludDhBcnJheSBpbmRpY2F0ZXMgZnVsbHkgdHJhbnNmb3JtZWQgY29kZS5cbiAgICAgIGNvbnN0IHR5cGVTY3JpcHRGaWxlQ2FjaGUgPVxuICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8udHlwZVNjcmlwdEZpbGVDYWNoZSA/P1xuICAgICAgICBuZXcgTWFwPHN0cmluZywgc3RyaW5nIHwgVWludDhBcnJheT4oKTtcblxuICAgICAgLy8gVGhlIHN0eWxlc2hlZXQgcmVzb3VyY2VzIGZyb20gY29tcG9uZW50IHN0eWxlc2hlZXRzIHRoYXQgd2lsbCBiZSBhZGRlZCB0byB0aGUgYnVpbGQgcmVzdWx0cyBvdXRwdXQgZmlsZXNcbiAgICAgIGxldCBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gICAgICBsZXQgc3R5bGVzaGVldE1ldGFmaWxlczogTWV0YWZpbGVbXTtcblxuICAgICAgLy8gQ3JlYXRlIG5ldyByZXVzYWJsZSBjb21waWxhdGlvbiBmb3IgdGhlIGFwcHJvcHJpYXRlIG1vZGUgYmFzZWQgb24gdGhlIGBqaXRgIHBsdWdpbiBvcHRpb25cbiAgICAgIGNvbnN0IGNvbXBpbGF0aW9uOiBBbmd1bGFyQ29tcGlsYXRpb24gPSBwbHVnaW5PcHRpb25zLmppdFxuICAgICAgICA/IG5ldyBKaXRDb21waWxhdGlvbigpXG4gICAgICAgIDogbmV3IEFvdENvbXBpbGF0aW9uKCk7XG5cbiAgICAgIC8vIERldGVybWluZXMgaWYgVHlwZVNjcmlwdCBzaG91bGQgcHJvY2VzcyBKYXZhU2NyaXB0IGZpbGVzIGJhc2VkIG9uIHRzY29uZmlnIGBhbGxvd0pzYCBvcHRpb25cbiAgICAgIGxldCBzaG91bGRUc0lnbm9yZUpzID0gdHJ1ZTtcblxuICAgICAgYnVpbGQub25TdGFydChhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogT25TdGFydFJlc3VsdCA9IHtcbiAgICAgICAgICB3YXJuaW5nczogc2V0dXBXYXJuaW5ncyxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBSZXNldCBkZWJ1ZyBwZXJmb3JtYW5jZSB0cmFja2luZ1xuICAgICAgICByZXNldEN1bXVsYXRpdmVEdXJhdGlvbnMoKTtcblxuICAgICAgICAvLyBSZXNldCBzdHlsZXNoZWV0IHJlc291cmNlIG91dHB1dCBmaWxlc1xuICAgICAgICBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyA9IFtdO1xuICAgICAgICBzdHlsZXNoZWV0TWV0YWZpbGVzID0gW107XG5cbiAgICAgICAgLy8gQ3JlYXRlIEFuZ3VsYXIgY29tcGlsZXIgaG9zdCBvcHRpb25zXG4gICAgICAgIGNvbnN0IGhvc3RPcHRpb25zOiBBbmd1bGFySG9zdE9wdGlvbnMgPSB7XG4gICAgICAgICAgZmlsZVJlcGxhY2VtZW50czogcGx1Z2luT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzLFxuICAgICAgICAgIG1vZGlmaWVkRmlsZXM6IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5tb2RpZmllZEZpbGVzLFxuICAgICAgICAgIHNvdXJjZUZpbGVDYWNoZTogcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUsXG4gICAgICAgICAgYXN5bmMgdHJhbnNmb3JtU3R5bGVzaGVldChkYXRhLCBjb250YWluaW5nRmlsZSwgc3R5bGVzaGVldEZpbGUpIHtcbiAgICAgICAgICAgIC8vIFN0eWxlc2hlZXQgZmlsZSBvbmx5IGV4aXN0cyBmb3IgZXh0ZXJuYWwgc3R5bGVzaGVldHNcbiAgICAgICAgICAgIGNvbnN0IGZpbGVuYW1lID0gc3R5bGVzaGVldEZpbGUgPz8gY29udGFpbmluZ0ZpbGU7XG5cbiAgICAgICAgICAgIGNvbnN0IHN0eWxlc2hlZXRSZXN1bHQgPSBhd2FpdCBidW5kbGVDb21wb25lbnRTdHlsZXNoZWV0KFxuICAgICAgICAgICAgICBzdHlsZU9wdGlvbnMuaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgICAgZmlsZW5hbWUsXG4gICAgICAgICAgICAgICFzdHlsZXNoZWV0RmlsZSxcbiAgICAgICAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgICAgICAgICBwbHVnaW5PcHRpb25zLmxvYWRSZXN1bHRDYWNoZSxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGNvbnN0IHsgY29udGVudHMsIHJlc291cmNlRmlsZXMsIGVycm9ycywgd2FybmluZ3MgfSA9IHN0eWxlc2hlZXRSZXN1bHQ7XG4gICAgICAgICAgICBpZiAoZXJyb3JzKSB7XG4gICAgICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaCguLi5lcnJvcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgKHJlc3VsdC53YXJuaW5ncyA/Pz0gW10pLnB1c2goLi4ud2FybmluZ3MpO1xuICAgICAgICAgICAgc3R5bGVzaGVldFJlc291cmNlRmlsZXMucHVzaCguLi5yZXNvdXJjZUZpbGVzKTtcbiAgICAgICAgICAgIGlmIChzdHlsZXNoZWV0UmVzdWx0Lm1ldGFmaWxlKSB7XG4gICAgICAgICAgICAgIHN0eWxlc2hlZXRNZXRhZmlsZXMucHVzaChzdHlsZXNoZWV0UmVzdWx0Lm1ldGFmaWxlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGNvbnRlbnRzO1xuICAgICAgICAgIH0sXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSB0aGUgQW5ndWxhciBjb21waWxhdGlvbiBmb3IgdGhlIGN1cnJlbnQgYnVpbGQuXG4gICAgICAgIC8vIEluIHdhdGNoIG1vZGUsIHByZXZpb3VzIGJ1aWxkIHN0YXRlIHdpbGwgYmUgcmV1c2VkLlxuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgY29tcGlsZXJPcHRpb25zOiB7IGFsbG93SnMgfSxcbiAgICAgICAgfSA9IGF3YWl0IGNvbXBpbGF0aW9uLmluaXRpYWxpemUodHNjb25maWdQYXRoLCBob3N0T3B0aW9ucywgKGNvbXBpbGVyT3B0aW9ucykgPT4ge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCA8IHRzLlNjcmlwdFRhcmdldC5FUzIwMjJcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIC8vIElmICd1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkcycgaXMgYWxyZWFkeSBkZWZpbmVkIGluIHRoZSB1c2VycyBwcm9qZWN0IGxlYXZlIHRoZSB2YWx1ZSBhcyBpcy5cbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSBmYWxsYmFjayB0byBmYWxzZSBkdWUgdG8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy80NTk5NVxuICAgICAgICAgICAgLy8gd2hpY2ggYnJlYWtzIHRoZSBkZXByZWNhdGVkIGBARWZmZWN0c2AgTkdSWCBkZWNvcmF0b3IgYW5kIHBvdGVudGlhbGx5IG90aGVyIGV4aXN0aW5nIGNvZGUgYXMgd2VsbC5cbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPSB0cy5TY3JpcHRUYXJnZXQuRVMyMDIyO1xuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnVzZURlZmluZUZvckNsYXNzRmllbGRzID8/PSBmYWxzZTtcblxuICAgICAgICAgICAgLy8gT25seSBhZGQgdGhlIHdhcm5pbmcgb24gdGhlIGluaXRpYWwgYnVpbGRcbiAgICAgICAgICAgIHNldHVwV2FybmluZ3M/LnB1c2goe1xuICAgICAgICAgICAgICB0ZXh0OlxuICAgICAgICAgICAgICAgICdUeXBlU2NyaXB0IGNvbXBpbGVyIG9wdGlvbnMgXCJ0YXJnZXRcIiBhbmQgXCJ1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkc1wiIGFyZSBzZXQgdG8gXCJFUzIwMjJcIiBhbmQgJyArXG4gICAgICAgICAgICAgICAgJ1wiZmFsc2VcIiByZXNwZWN0aXZlbHkgYnkgdGhlIEFuZ3VsYXIgQ0xJLicsXG4gICAgICAgICAgICAgIGxvY2F0aW9uOiB7IGZpbGU6IHBsdWdpbk9wdGlvbnMudHNjb25maWcgfSxcbiAgICAgICAgICAgICAgbm90ZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB0ZXh0OlxuICAgICAgICAgICAgICAgICAgICAnVG8gY29udHJvbCBFQ01BIHZlcnNpb24gYW5kIGZlYXR1cmVzIHVzZSB0aGUgQnJvd2Vyc2xpc3QgY29uZmlndXJhdGlvbi4gJyArXG4gICAgICAgICAgICAgICAgICAgICdGb3IgbW9yZSBpbmZvcm1hdGlvbiwgc2VlIGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS9idWlsZCNjb25maWd1cmluZy1icm93c2VyLWNvbXBhdGliaWxpdHknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4uY29tcGlsZXJPcHRpb25zLFxuICAgICAgICAgICAgbm9FbWl0T25FcnJvcjogZmFsc2UsXG4gICAgICAgICAgICBpbmxpbmVTb3VyY2VzOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIGlubGluZVNvdXJjZU1hcDogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgICBtYXBSb290OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBzb3VyY2VSb290OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgICBzaG91bGRUc0lnbm9yZUpzID0gIWFsbG93SnM7XG5cbiAgICAgICAgcHJvZmlsZVN5bmMoJ05HX0RJQUdOT1NUSUNTX1RPVEFMJywgKCkgPT4ge1xuICAgICAgICAgIGZvciAoY29uc3QgZGlhZ25vc3RpYyBvZiBjb21waWxhdGlvbi5jb2xsZWN0RGlhZ25vc3RpY3MoKSkge1xuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpYyhkaWFnbm9zdGljKTtcbiAgICAgICAgICAgIGlmIChkaWFnbm9zdGljLmNhdGVnb3J5ID09PSB0cy5EaWFnbm9zdGljQ2F0ZWdvcnkuRXJyb3IpIHtcbiAgICAgICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgKHJlc3VsdC53YXJuaW5ncyA/Pz0gW10pLnB1c2gobWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBVcGRhdGUgVHlwZVNjcmlwdCBmaWxlIG91dHB1dCBjYWNoZSBmb3IgYWxsIGFmZmVjdGVkIGZpbGVzXG4gICAgICAgIGZvciAoY29uc3QgeyBmaWxlbmFtZSwgY29udGVudHMgfSBvZiBjb21waWxhdGlvbi5lbWl0QWZmZWN0ZWRGaWxlcygpKSB7XG4gICAgICAgICAgdHlwZVNjcmlwdEZpbGVDYWNoZS5zZXQocGF0aFRvRmlsZVVSTChmaWxlbmFtZSkuaHJlZiwgY29udGVudHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzZXQgdGhlIHNldHVwIHdhcm5pbmdzIHNvIHRoYXQgdGhleSBhcmUgb25seSBzaG93biBkdXJpbmcgdGhlIGZpcnN0IGJ1aWxkLlxuICAgICAgICBzZXR1cFdhcm5pbmdzID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9banRdc3g/JC8gfSwgKGFyZ3MpID0+XG4gICAgICAgIHByb2ZpbGVBc3luYyhcbiAgICAgICAgICAnTkdfRU1JVF9UUyonLFxuICAgICAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcXVlc3QgPSBwbHVnaW5PcHRpb25zLmZpbGVSZXBsYWNlbWVudHM/LlthcmdzLnBhdGhdID8/IGFyZ3MucGF0aDtcblxuICAgICAgICAgICAgLy8gU2tpcCBUUyBsb2FkIGF0dGVtcHQgaWYgSlMgVHlwZVNjcmlwdCBjb21waWxhdGlvbiBub3QgZW5hYmxlZCBhbmQgZmlsZSBpcyBKU1xuICAgICAgICAgICAgaWYgKHNob3VsZFRzSWdub3JlSnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KHJlcXVlc3QpKSB7XG4gICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFRoZSBmaWxlbmFtZSBpcyBjdXJyZW50bHkgdXNlZCBhcyBhIGNhY2hlIGtleS4gU2luY2UgdGhlIGNhY2hlIGlzIG1lbW9yeSBvbmx5LFxuICAgICAgICAgICAgLy8gdGhlIG9wdGlvbnMgY2Fubm90IGNoYW5nZSBhbmQgZG8gbm90IG5lZWQgdG8gYmUgcmVwcmVzZW50ZWQgaW4gdGhlIGtleS4gSWYgdGhlXG4gICAgICAgICAgICAvLyBjYWNoZSBpcyBsYXRlciBzdG9yZWQgdG8gZGlzaywgdGhlbiB0aGUgb3B0aW9ucyB0aGF0IGFmZmVjdCB0cmFuc2Zvcm0gb3V0cHV0XG4gICAgICAgICAgICAvLyB3b3VsZCBuZWVkIHRvIGJlIGFkZGVkIHRvIHRoZSBrZXkgYXMgd2VsbCBhcyBhIGNoZWNrIGZvciBhbnkgY2hhbmdlIG9mIGNvbnRlbnQuXG4gICAgICAgICAgICBsZXQgY29udGVudHMgPSB0eXBlU2NyaXB0RmlsZUNhY2hlLmdldChwYXRoVG9GaWxlVVJMKHJlcXVlc3QpLmhyZWYpO1xuXG4gICAgICAgICAgICBpZiAoY29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAvLyBObyBUUyByZXN1bHQgaW5kaWNhdGVzIHRoZSBmaWxlIGlzIG5vdCBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0uXG4gICAgICAgICAgICAgIC8vIElmIGFsbG93SnMgaXMgZW5hYmxlZCBhbmQgdGhlIGZpbGUgaXMgSlMgdGhlbiBkZWZlciB0byB0aGUgbmV4dCBsb2FkIGhvb2suXG4gICAgICAgICAgICAgIGlmICghc2hvdWxkVHNJZ25vcmVKcyAmJiAvXFwuW2NtXT9qcyQvLnRlc3QocmVxdWVzdCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gT3RoZXJ3aXNlIHJldHVybiBhbiBlcnJvclxuICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGVycm9yczogW1xuICAgICAgICAgICAgICAgICAgY3JlYXRlTWlzc2luZ0ZpbGVFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdCxcbiAgICAgICAgICAgICAgICAgICAgYXJncy5wYXRoLFxuICAgICAgICAgICAgICAgICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyID8/ICcnLFxuICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY29udGVudHMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgIC8vIEEgc3RyaW5nIGluZGljYXRlcyB1bnRyYW5zZm9ybWVkIG91dHB1dCBmcm9tIHRoZSBUUy9ORyBjb21waWxlclxuICAgICAgICAgICAgICBjb250ZW50cyA9IGF3YWl0IGphdmFzY3JpcHRUcmFuc2Zvcm1lci50cmFuc2Zvcm1EYXRhKFxuICAgICAgICAgICAgICAgIHJlcXVlc3QsXG4gICAgICAgICAgICAgICAgY29udGVudHMsXG4gICAgICAgICAgICAgICAgdHJ1ZSAvKiBza2lwTGlua2VyICovLFxuICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgIC8vIFN0b3JlIGFzIHRoZSByZXR1cm5lZCBVaW50OEFycmF5IHRvIGFsbG93IGNhY2hpbmcgdGhlIGZ1bGx5IHRyYW5zZm9ybWVkIGNvZGVcbiAgICAgICAgICAgICAgdHlwZVNjcmlwdEZpbGVDYWNoZS5zZXQocGF0aFRvRmlsZVVSTChyZXF1ZXN0KS5ocmVmLCBjb250ZW50cyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKSxcbiAgICAgICk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLltjbV0/anMkLyB9LCAoYXJncykgPT5cbiAgICAgICAgcHJvZmlsZUFzeW5jKFxuICAgICAgICAgICdOR19FTUlUX0pTKicsXG4gICAgICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgLy8gVGhlIGZpbGVuYW1lIGlzIGN1cnJlbnRseSB1c2VkIGFzIGEgY2FjaGUga2V5LiBTaW5jZSB0aGUgY2FjaGUgaXMgbWVtb3J5IG9ubHksXG4gICAgICAgICAgICAvLyB0aGUgb3B0aW9ucyBjYW5ub3QgY2hhbmdlIGFuZCBkbyBub3QgbmVlZCB0byBiZSByZXByZXNlbnRlZCBpbiB0aGUga2V5LiBJZiB0aGVcbiAgICAgICAgICAgIC8vIGNhY2hlIGlzIGxhdGVyIHN0b3JlZCB0byBkaXNrLCB0aGVuIHRoZSBvcHRpb25zIHRoYXQgYWZmZWN0IHRyYW5zZm9ybSBvdXRwdXRcbiAgICAgICAgICAgIC8vIHdvdWxkIG5lZWQgdG8gYmUgYWRkZWQgdG8gdGhlIGtleSBhcyB3ZWxsIGFzIGEgY2hlY2sgZm9yIGFueSBjaGFuZ2Ugb2YgY29udGVudC5cbiAgICAgICAgICAgIGxldCBjb250ZW50cyA9IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5iYWJlbEZpbGVDYWNoZS5nZXQoYXJncy5wYXRoKTtcbiAgICAgICAgICAgIGlmIChjb250ZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGNvbnRlbnRzID0gYXdhaXQgamF2YXNjcmlwdFRyYW5zZm9ybWVyLnRyYW5zZm9ybUZpbGUoYXJncy5wYXRoLCBwbHVnaW5PcHRpb25zLmppdCk7XG4gICAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5iYWJlbEZpbGVDYWNoZS5zZXQoYXJncy5wYXRoLCBjb250ZW50cyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKSxcbiAgICAgICk7XG5cbiAgICAgIC8vIFNldHVwIGJ1bmRsaW5nIG9mIGNvbXBvbmVudCB0ZW1wbGF0ZXMgYW5kIHN0eWxlc2hlZXRzIHdoZW4gaW4gSklUIG1vZGVcbiAgICAgIGlmIChwbHVnaW5PcHRpb25zLmppdCkge1xuICAgICAgICBzZXR1cEppdFBsdWdpbkNhbGxiYWNrcyhcbiAgICAgICAgICBidWlsZCxcbiAgICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICAgICAgc3R5bGVzaGVldFJlc291cmNlRmlsZXMsXG4gICAgICAgICAgcGx1Z2luT3B0aW9ucy5sb2FkUmVzdWx0Q2FjaGUsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGJ1aWxkLm9uRW5kKChyZXN1bHQpID0+IHtcbiAgICAgICAgLy8gQWRkIGFueSBjb21wb25lbnQgc3R5bGVzaGVldCByZXNvdXJjZSBmaWxlcyB0byB0aGUgb3V0cHV0IGZpbGVzXG4gICAgICAgIGlmIChzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcy5sZW5ndGgpIHtcbiAgICAgICAgICByZXN1bHQub3V0cHV0RmlsZXM/LnB1c2goLi4uc3R5bGVzaGVldFJlc291cmNlRmlsZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ29tYmluZSBjb21wb25lbnQgc3R5bGVzaGVldCBtZXRhZmlsZXMgd2l0aCBtYWluIG1ldGFmaWxlXG4gICAgICAgIGlmIChyZXN1bHQubWV0YWZpbGUgJiYgc3R5bGVzaGVldE1ldGFmaWxlcy5sZW5ndGgpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IG1ldGFmaWxlIG9mIHN0eWxlc2hlZXRNZXRhZmlsZXMpIHtcbiAgICAgICAgICAgIHJlc3VsdC5tZXRhZmlsZS5pbnB1dHMgPSB7IC4uLnJlc3VsdC5tZXRhZmlsZS5pbnB1dHMsIC4uLm1ldGFmaWxlLmlucHV0cyB9O1xuICAgICAgICAgICAgcmVzdWx0Lm1ldGFmaWxlLm91dHB1dHMgPSB7IC4uLnJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzLCAuLi5tZXRhZmlsZS5vdXRwdXRzIH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbG9nQ3VtdWxhdGl2ZUR1cmF0aW9ucygpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTWlzc2luZ0ZpbGVFcnJvcihyZXF1ZXN0OiBzdHJpbmcsIG9yaWdpbmFsOiBzdHJpbmcsIHJvb3Q6IHN0cmluZyk6IFBhcnRpYWxNZXNzYWdlIHtcbiAgY29uc3QgZXJyb3IgPSB7XG4gICAgdGV4dDogYEZpbGUgJyR7cGF0aC5yZWxhdGl2ZShyb290LCByZXF1ZXN0KX0nIGlzIG1pc3NpbmcgZnJvbSB0aGUgVHlwZVNjcmlwdCBjb21waWxhdGlvbi5gLFxuICAgIG5vdGVzOiBbXG4gICAgICB7XG4gICAgICAgIHRleHQ6IGBFbnN1cmUgdGhlIGZpbGUgaXMgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBwcm9ncmFtIHZpYSB0aGUgJ2ZpbGVzJyBvciAnaW5jbHVkZScgcHJvcGVydHkuYCxcbiAgICAgIH0sXG4gICAgXSxcbiAgfTtcblxuICBpZiAocmVxdWVzdCAhPT0gb3JpZ2luYWwpIHtcbiAgICBlcnJvci5ub3Rlcy5wdXNoKHtcbiAgICAgIHRleHQ6IGBGaWxlIGlzIHJlcXVlc3RlZCBmcm9tIGEgZmlsZSByZXBsYWNlbWVudCBvZiAnJHtwYXRoLnJlbGF0aXZlKHJvb3QsIG9yaWdpbmFsKX0nLmAsXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gZXJyb3I7XG59XG4iXX0=