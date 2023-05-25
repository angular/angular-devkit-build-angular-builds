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
    constructor(persistentCachePath) {
        super();
        this.persistentCachePath = persistentCachePath;
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
                const { compilerOptions: { allowJs }, referencedFiles, } = await compilation.initialize(tsconfigPath, hostOptions, (compilerOptions) => {
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
                    // Enable incremental compilation by default if caching is enabled
                    if (pluginOptions.sourceFileCache?.persistentCachePath) {
                        compilerOptions.incremental ?? (compilerOptions.incremental = true);
                        // Set the build info file location to the configured cache directory
                        compilerOptions.tsBuildInfoFile = path.join(pluginOptions.sourceFileCache?.persistentCachePath, '.tsbuildinfo');
                    }
                    else {
                        compilerOptions.incremental = false;
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
                (0, profiling_1.profileSync)('NG_EMIT_TS', () => {
                    for (const { filename, contents } of compilation.emitAffectedFiles()) {
                        typeScriptFileCache.set((0, node_url_1.pathToFileURL)(filename).href, contents);
                    }
                });
                // Store referenced files for updated file watching if enabled
                if (pluginOptions.sourceFileCache) {
                    pluginOptions.sourceFileCache.referencedFiles = referencedFiles;
                }
                // Reset the setup warnings so that they are only shown during the first build.
                setupWarnings = undefined;
                return result;
            });
            build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async (args) => {
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
            });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL2FuZ3VsYXIvY29tcGlsZXItcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBVUgsK0NBQTRDO0FBQzVDLHFDQUFtQztBQUNuQyxnREFBa0M7QUFDbEMsdUNBQXlDO0FBQ3pDLDREQUE0QjtBQUM1Qiw0RUFBZ0U7QUFDaEUsc0VBQWtFO0FBQ2xFLDREQUE4RTtBQUM5RSw0Q0FLc0I7QUFDdEIsa0VBQW1HO0FBQ25HLCtEQUEyRDtBQUUzRCx1REFBbUQ7QUFDbkQsK0NBQTREO0FBQzVELHVEQUFtRDtBQUNuRCxpRUFBaUU7QUFFakUsTUFBTSxhQUFhLEdBQUcsSUFBQSxrQkFBUSxHQUFFLEtBQUssT0FBTyxDQUFDO0FBQzdDLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxNQUFNLENBQUMsS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBRWxFLE1BQWEsZUFBZ0IsU0FBUSxHQUEwQjtJQVE3RCxZQUFxQixtQkFBNEI7UUFDL0MsS0FBSyxFQUFFLENBQUM7UUFEVyx3QkFBbUIsR0FBbkIsbUJBQW1CLENBQVM7UUFQeEMsa0JBQWEsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO1FBQ2xDLG1CQUFjLEdBQUcsSUFBSSxHQUFHLEVBQXNCLENBQUM7UUFDL0Msd0JBQW1CLEdBQUcsSUFBSSxHQUFHLEVBQStCLENBQUM7UUFDN0Qsb0JBQWUsR0FBRyxJQUFJLHlDQUFxQixFQUFFLENBQUM7SUFNdkQsQ0FBQztJQUVELFVBQVUsQ0FBQyxLQUF1QjtRQUNoQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzNCLEtBQUssSUFBSSxJQUFJLElBQUksS0FBSyxFQUFFO1lBQ3RCLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2pDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsSUFBQSx3QkFBYSxFQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzFELElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRXRDLCtEQUErRDtZQUMvRCxJQUFJLGFBQWEsRUFBRTtnQkFDakIsSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUN6RDtZQUVELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbEIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDOUI7SUFDSCxDQUFDO0NBQ0Y7QUE1QkQsMENBNEJDO0FBYUQsa0RBQWtEO0FBQ2xELFNBQWdCLG9CQUFvQixDQUNsQyxhQUFvQyxFQUNwQyxZQUF1RTtJQUV2RSxPQUFPO1FBQ0wsSUFBSSxFQUFFLGtCQUFrQjtRQUN4QixrREFBa0Q7UUFDbEQsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFrQjs7WUFDNUIsSUFBSSxhQUFhLEdBQWlDLEVBQUUsQ0FBQztZQUVyRCxNQUFNLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUM7WUFDL0QsSUFBSSxZQUFZLEdBQUcsYUFBYSxDQUFDLFFBQVEsQ0FBQztZQUMxQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7Z0JBQ3JCLGdFQUFnRTtnQkFDaEUseUZBQXlGO2dCQUN6RixJQUFJO29CQUNGLFlBQVksR0FBRyxNQUFNLElBQUEsbUJBQVEsRUFBQyxZQUFZLENBQUMsQ0FBQztpQkFDN0M7Z0JBQUMsTUFBTSxHQUFFO2FBQ1g7WUFFRCwwREFBMEQ7WUFDMUQsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLDhDQUFxQixDQUFDLGFBQWEsRUFBRSxnQ0FBVSxDQUFDLENBQUM7WUFFbkYseUVBQXlFO1lBQ3pFLE1BQU0sRUFBRSwrQkFBK0IsRUFBRSxHQUFHLE1BQU0sd0NBQWtCLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDdkYsTUFBQSxLQUFLLENBQUMsY0FBYyxFQUFDLE1BQU0sUUFBTixNQUFNLEdBQUssRUFBRSxFQUFDO1lBQ25DLEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLCtCQUErQixDQUFDLEVBQUU7Z0JBQzFFLElBQUksR0FBRyxJQUFJLEtBQUssQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFO29CQUN0Qyw2Q0FBNkM7b0JBQzdDLFNBQVM7aUJBQ1Y7Z0JBQ0QsSUFBSSxHQUFHLEtBQUssV0FBVyxFQUFFO29CQUN2Qiw2RUFBNkU7b0JBQzdFLFNBQVM7aUJBQ1Y7Z0JBQ0QsNkVBQTZFO2dCQUM3RSxrREFBa0Q7Z0JBQ2xELEtBQUssQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQzthQUNyRDtZQUVELG1IQUFtSDtZQUNuSCxrR0FBa0c7WUFDbEcsTUFBTSxtQkFBbUIsR0FDdkIsYUFBYSxDQUFDLGVBQWUsRUFBRSxtQkFBbUI7Z0JBQ2xELElBQUksR0FBRyxFQUErQixDQUFDO1lBRXpDLDJHQUEyRztZQUMzRyxJQUFJLHVCQUF1QixHQUFpQixFQUFFLENBQUM7WUFDL0MsSUFBSSxtQkFBK0IsQ0FBQztZQUVwQyw0RkFBNEY7WUFDNUYsTUFBTSxXQUFXLEdBQXVCLGFBQWEsQ0FBQyxHQUFHO2dCQUN2RCxDQUFDLENBQUMsSUFBSSxnQ0FBYyxFQUFFO2dCQUN0QixDQUFDLENBQUMsSUFBSSxnQ0FBYyxFQUFFLENBQUM7WUFFekIsOEZBQThGO1lBQzlGLElBQUksZ0JBQWdCLEdBQUcsSUFBSSxDQUFDO1lBRTVCLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLEVBQUU7Z0JBQ3ZCLE1BQU0sTUFBTSxHQUFrQjtvQkFDNUIsUUFBUSxFQUFFLGFBQWE7aUJBQ3hCLENBQUM7Z0JBRUYsbUNBQW1DO2dCQUNuQyxJQUFBLG9DQUF3QixHQUFFLENBQUM7Z0JBRTNCLHlDQUF5QztnQkFDekMsdUJBQXVCLEdBQUcsRUFBRSxDQUFDO2dCQUM3QixtQkFBbUIsR0FBRyxFQUFFLENBQUM7Z0JBRXpCLHVDQUF1QztnQkFDdkMsTUFBTSxXQUFXLEdBQXVCO29CQUN0QyxnQkFBZ0IsRUFBRSxhQUFhLENBQUMsZ0JBQWdCO29CQUNoRCxhQUFhLEVBQUUsYUFBYSxDQUFDLGVBQWUsRUFBRSxhQUFhO29CQUMzRCxlQUFlLEVBQUUsYUFBYSxDQUFDLGVBQWU7b0JBQzlDLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFLGNBQWM7d0JBQzVELHVEQUF1RDt3QkFDdkQsTUFBTSxRQUFRLEdBQUcsY0FBYyxJQUFJLGNBQWMsQ0FBQzt3QkFFbEQsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLElBQUEsMENBQXlCLEVBQ3RELFlBQVksQ0FBQyxtQkFBbUIsRUFDaEMsSUFBSSxFQUNKLFFBQVEsRUFDUixDQUFDLGNBQWMsRUFDZixZQUFZLEVBQ1osYUFBYSxDQUFDLGVBQWUsQ0FDOUIsQ0FBQzt3QkFFRixNQUFNLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLEdBQUcsZ0JBQWdCLENBQUM7d0JBQ3ZFLElBQUksTUFBTSxFQUFFOzRCQUNWLENBQUMsTUFBTSxDQUFDLE1BQU0sS0FBYixNQUFNLENBQUMsTUFBTSxHQUFLLEVBQUUsRUFBQyxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDO3lCQUN4Qzt3QkFDRCxDQUFDLE1BQU0sQ0FBQyxRQUFRLEtBQWYsTUFBTSxDQUFDLFFBQVEsR0FBSyxFQUFFLEVBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQzt3QkFDM0MsdUJBQXVCLENBQUMsSUFBSSxDQUFDLEdBQUcsYUFBYSxDQUFDLENBQUM7d0JBQy9DLElBQUksZ0JBQWdCLENBQUMsUUFBUSxFQUFFOzRCQUM3QixtQkFBbUIsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUM7eUJBQ3JEO3dCQUVELE9BQU8sUUFBUSxDQUFDO29CQUNsQixDQUFDO2lCQUNGLENBQUM7Z0JBRUYsNERBQTREO2dCQUM1RCxzREFBc0Q7Z0JBQ3RELE1BQU0sRUFDSixlQUFlLEVBQUUsRUFBRSxPQUFPLEVBQUUsRUFDNUIsZUFBZSxHQUNoQixHQUFHLE1BQU0sV0FBVyxDQUFDLFVBQVUsQ0FBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLENBQUMsZUFBZSxFQUFFLEVBQUU7b0JBQzlFLElBQ0UsZUFBZSxDQUFDLE1BQU0sS0FBSyxTQUFTO3dCQUNwQyxlQUFlLENBQUMsTUFBTSxHQUFHLG9CQUFFLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFDL0M7d0JBQ0EsOEZBQThGO3dCQUM5RiwwRkFBMEY7d0JBQzFGLHFHQUFxRzt3QkFDckcsZUFBZSxDQUFDLE1BQU0sR0FBRyxvQkFBRSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUM7d0JBQ2hELGVBQWUsQ0FBQyx1QkFBdUIsS0FBdkMsZUFBZSxDQUFDLHVCQUF1QixHQUFLLEtBQUssRUFBQzt3QkFFbEQsNENBQTRDO3dCQUM1QyxhQUFhLEVBQUUsSUFBSSxDQUFDOzRCQUNsQixJQUFJLEVBQ0YsNkZBQTZGO2dDQUM3RiwwQ0FBMEM7NEJBQzVDLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxhQUFhLENBQUMsUUFBUSxFQUFFOzRCQUMxQyxLQUFLLEVBQUU7Z0NBQ0w7b0NBQ0UsSUFBSSxFQUNGLDBFQUEwRTt3Q0FDMUUsNEZBQTRGO2lDQUMvRjs2QkFDRjt5QkFDRixDQUFDLENBQUM7cUJBQ0o7b0JBRUQsa0VBQWtFO29CQUNsRSxJQUFJLGFBQWEsQ0FBQyxlQUFlLEVBQUUsbUJBQW1CLEVBQUU7d0JBQ3RELGVBQWUsQ0FBQyxXQUFXLEtBQTNCLGVBQWUsQ0FBQyxXQUFXLEdBQUssSUFBSSxFQUFDO3dCQUNyQyxxRUFBcUU7d0JBQ3JFLGVBQWUsQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FDekMsYUFBYSxDQUFDLGVBQWUsRUFBRSxtQkFBbUIsRUFDbEQsY0FBYyxDQUNmLENBQUM7cUJBQ0g7eUJBQU07d0JBQ0wsZUFBZSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7cUJBQ3JDO29CQUVELE9BQU87d0JBQ0wsR0FBRyxlQUFlO3dCQUNsQixhQUFhLEVBQUUsS0FBSzt3QkFDcEIsYUFBYSxFQUFFLGFBQWEsQ0FBQyxTQUFTO3dCQUN0QyxlQUFlLEVBQUUsYUFBYSxDQUFDLFNBQVM7d0JBQ3hDLE9BQU8sRUFBRSxTQUFTO3dCQUNsQixVQUFVLEVBQUUsU0FBUzt3QkFDckIsZ0JBQWdCO3FCQUNqQixDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDO2dCQUNILGdCQUFnQixHQUFHLENBQUMsT0FBTyxDQUFDO2dCQUU1QixJQUFBLHVCQUFXLEVBQUMsc0JBQXNCLEVBQUUsR0FBRyxFQUFFO29CQUN2QyxLQUFLLE1BQU0sVUFBVSxJQUFJLFdBQVcsQ0FBQyxrQkFBa0IsRUFBRSxFQUFFO3dCQUN6RCxNQUFNLE9BQU8sR0FBRyxJQUFBLHlDQUEyQixFQUFDLFVBQVUsQ0FBQyxDQUFDO3dCQUN4RCxJQUFJLFVBQVUsQ0FBQyxRQUFRLEtBQUssb0JBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLEVBQUU7NEJBQ3ZELENBQUMsTUFBTSxDQUFDLE1BQU0sS0FBYixNQUFNLENBQUMsTUFBTSxHQUFLLEVBQUUsRUFBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQzt5QkFDdEM7NkJBQU07NEJBQ0wsQ0FBQyxNQUFNLENBQUMsUUFBUSxLQUFmLE1BQU0sQ0FBQyxRQUFRLEdBQUssRUFBRSxFQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO3lCQUN4QztxQkFDRjtnQkFDSCxDQUFDLENBQUMsQ0FBQztnQkFFSCw2REFBNkQ7Z0JBQzdELElBQUEsdUJBQVcsRUFBQyxZQUFZLEVBQUUsR0FBRyxFQUFFO29CQUM3QixLQUFLLE1BQU0sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLElBQUksV0FBVyxDQUFDLGlCQUFpQixFQUFFLEVBQUU7d0JBQ3BFLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFBLHdCQUFhLEVBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO3FCQUNqRTtnQkFDSCxDQUFDLENBQUMsQ0FBQztnQkFFSCw4REFBOEQ7Z0JBQzlELElBQUksYUFBYSxDQUFDLGVBQWUsRUFBRTtvQkFDakMsYUFBYSxDQUFDLGVBQWUsQ0FBQyxlQUFlLEdBQUcsZUFBZSxDQUFDO2lCQUNqRTtnQkFFRCwrRUFBK0U7Z0JBQy9FLGFBQWEsR0FBRyxTQUFTLENBQUM7Z0JBRTFCLE9BQU8sTUFBTSxDQUFDO1lBQ2hCLENBQUMsQ0FBQyxDQUFDO1lBRUgsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxpQkFBaUIsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtnQkFDekQsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLGdCQUFnQixFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUM7Z0JBRXpFLCtFQUErRTtnQkFDL0UsSUFBSSxnQkFBZ0IsSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFO29CQUNsRCxPQUFPLFNBQVMsQ0FBQztpQkFDbEI7Z0JBRUQsaUZBQWlGO2dCQUNqRixpRkFBaUY7Z0JBQ2pGLCtFQUErRTtnQkFDL0Usa0ZBQWtGO2dCQUNsRixJQUFJLFFBQVEsR0FBRyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBQSx3QkFBYSxFQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUVwRSxJQUFJLFFBQVEsS0FBSyxTQUFTLEVBQUU7b0JBQzFCLHlFQUF5RTtvQkFDekUsNkVBQTZFO29CQUM3RSxJQUFJLENBQUMsZ0JBQWdCLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRTt3QkFDbkQsT0FBTyxTQUFTLENBQUM7cUJBQ2xCO29CQUVELDRCQUE0QjtvQkFDNUIsT0FBTzt3QkFDTCxNQUFNLEVBQUU7NEJBQ04sc0JBQXNCLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxhQUFhLElBQUksRUFBRSxDQUFDO3lCQUNyRjtxQkFDRixDQUFDO2lCQUNIO3FCQUFNLElBQUksT0FBTyxRQUFRLEtBQUssUUFBUSxFQUFFO29CQUN2QyxrRUFBa0U7b0JBQ2xFLFFBQVEsR0FBRyxNQUFNLHFCQUFxQixDQUFDLGFBQWEsQ0FDbEQsT0FBTyxFQUNQLFFBQVEsRUFDUixJQUFJLENBQUMsZ0JBQWdCLENBQ3RCLENBQUM7b0JBRUYsK0VBQStFO29CQUMvRSxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBQSx3QkFBYSxFQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztpQkFDaEU7Z0JBRUQsT0FBTztvQkFDTCxRQUFRO29CQUNSLE1BQU0sRUFBRSxJQUFJO2lCQUNiLENBQUM7WUFDSixDQUFDLENBQUMsQ0FBQztZQUVILEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUM5QyxJQUFBLHdCQUFZLEVBQ1YsYUFBYSxFQUNiLEtBQUssSUFBSSxFQUFFO2dCQUNULGlGQUFpRjtnQkFDakYsaUZBQWlGO2dCQUNqRiwrRUFBK0U7Z0JBQy9FLGtGQUFrRjtnQkFDbEYsSUFBSSxRQUFRLEdBQUcsYUFBYSxDQUFDLGVBQWUsRUFBRSxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDNUUsSUFBSSxRQUFRLEtBQUssU0FBUyxFQUFFO29CQUMxQixRQUFRLEdBQUcsTUFBTSxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ25GLGFBQWEsQ0FBQyxlQUFlLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2lCQUN4RTtnQkFFRCxPQUFPO29CQUNMLFFBQVE7b0JBQ1IsTUFBTSxFQUFFLElBQUk7aUJBQ2IsQ0FBQztZQUNKLENBQUMsRUFDRCxJQUFJLENBQ0wsQ0FDRixDQUFDO1lBRUYseUVBQXlFO1lBQ3pFLElBQUksYUFBYSxDQUFDLEdBQUcsRUFBRTtnQkFDckIsSUFBQSw4Q0FBdUIsRUFDckIsS0FBSyxFQUNMLFlBQVksRUFDWix1QkFBdUIsRUFDdkIsYUFBYSxDQUFDLGVBQWUsQ0FDOUIsQ0FBQzthQUNIO1lBRUQsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFO2dCQUNyQixrRUFBa0U7Z0JBQ2xFLElBQUksdUJBQXVCLENBQUMsTUFBTSxFQUFFO29CQUNsQyxNQUFNLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxHQUFHLHVCQUF1QixDQUFDLENBQUM7aUJBQ3REO2dCQUVELDREQUE0RDtnQkFDNUQsSUFBSSxNQUFNLENBQUMsUUFBUSxJQUFJLG1CQUFtQixDQUFDLE1BQU0sRUFBRTtvQkFDakQsS0FBSyxNQUFNLFFBQVEsSUFBSSxtQkFBbUIsRUFBRTt3QkFDMUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsRUFBRSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDO3dCQUMzRSxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sR0FBRyxFQUFFLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsR0FBRyxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7cUJBQy9FO2lCQUNGO2dCQUVELElBQUEsa0NBQXNCLEdBQUUsQ0FBQztZQUMzQixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQTNSRCxvREEyUkM7QUFFRCxTQUFTLHNCQUFzQixDQUFDLE9BQWUsRUFBRSxRQUFnQixFQUFFLElBQVk7SUFDN0UsTUFBTSxLQUFLLEdBQUc7UUFDWixJQUFJLEVBQUUsU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsK0NBQStDO1FBQzFGLEtBQUssRUFBRTtZQUNMO2dCQUNFLElBQUksRUFBRSwwRkFBMEY7YUFDakc7U0FDRjtLQUNGLENBQUM7SUFFRixJQUFJLE9BQU8sS0FBSyxRQUFRLEVBQUU7UUFDeEIsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDZixJQUFJLEVBQUUsaURBQWlELElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxJQUFJO1NBQ3pGLENBQUMsQ0FBQztLQUNKO0lBRUQsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgTWV0YWZpbGUsXG4gIE9uU3RhcnRSZXN1bHQsXG4gIE91dHB1dEZpbGUsXG4gIFBhcnRpYWxNZXNzYWdlLFxuICBQbHVnaW4sXG4gIFBsdWdpbkJ1aWxkLFxufSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IHJlYWxwYXRoIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJ25vZGU6b3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7IG1heFdvcmtlcnMgfSBmcm9tICcuLi8uLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IEphdmFTY3JpcHRUcmFuc2Zvcm1lciB9IGZyb20gJy4uL2phdmFzY3JpcHQtdHJhbnNmb3JtZXInO1xuaW1wb3J0IHsgTG9hZFJlc3VsdENhY2hlLCBNZW1vcnlMb2FkUmVzdWx0Q2FjaGUgfSBmcm9tICcuLi9sb2FkLXJlc3VsdC1jYWNoZSc7XG5pbXBvcnQge1xuICBsb2dDdW11bGF0aXZlRHVyYXRpb25zLFxuICBwcm9maWxlQXN5bmMsXG4gIHByb2ZpbGVTeW5jLFxuICByZXNldEN1bXVsYXRpdmVEdXJhdGlvbnMsXG59IGZyb20gJy4uL3Byb2ZpbGluZyc7XG5pbXBvcnQgeyBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucywgYnVuZGxlQ29tcG9uZW50U3R5bGVzaGVldCB9IGZyb20gJy4uL3N0eWxlc2hlZXRzL2J1bmRsZS1vcHRpb25zJztcbmltcG9ydCB7IEFuZ3VsYXJDb21waWxhdGlvbiB9IGZyb20gJy4vYW5ndWxhci1jb21waWxhdGlvbic7XG5pbXBvcnQgeyBBbmd1bGFySG9zdE9wdGlvbnMgfSBmcm9tICcuL2FuZ3VsYXItaG9zdCc7XG5pbXBvcnQgeyBBb3RDb21waWxhdGlvbiB9IGZyb20gJy4vYW90LWNvbXBpbGF0aW9uJztcbmltcG9ydCB7IGNvbnZlcnRUeXBlU2NyaXB0RGlhZ25vc3RpYyB9IGZyb20gJy4vZGlhZ25vc3RpY3MnO1xuaW1wb3J0IHsgSml0Q29tcGlsYXRpb24gfSBmcm9tICcuL2ppdC1jb21waWxhdGlvbic7XG5pbXBvcnQgeyBzZXR1cEppdFBsdWdpbkNhbGxiYWNrcyB9IGZyb20gJy4vaml0LXBsdWdpbi1jYWxsYmFja3MnO1xuXG5jb25zdCBVU0lOR19XSU5ET1dTID0gcGxhdGZvcm0oKSA9PT0gJ3dpbjMyJztcbmNvbnN0IFdJTkRPV1NfU0VQX1JFR0VYUCA9IG5ldyBSZWdFeHAoYFxcXFwke3BhdGgud2luMzIuc2VwfWAsICdnJyk7XG5cbmV4cG9ydCBjbGFzcyBTb3VyY2VGaWxlQ2FjaGUgZXh0ZW5kcyBNYXA8c3RyaW5nLCB0cy5Tb3VyY2VGaWxlPiB7XG4gIHJlYWRvbmx5IG1vZGlmaWVkRmlsZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcmVhZG9ubHkgYmFiZWxGaWxlQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgVWludDhBcnJheT4oKTtcbiAgcmVhZG9ubHkgdHlwZVNjcmlwdEZpbGVDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmcgfCBVaW50OEFycmF5PigpO1xuICByZWFkb25seSBsb2FkUmVzdWx0Q2FjaGUgPSBuZXcgTWVtb3J5TG9hZFJlc3VsdENhY2hlKCk7XG5cbiAgcmVmZXJlbmNlZEZpbGVzPzogcmVhZG9ubHkgc3RyaW5nW107XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgcGVyc2lzdGVudENhY2hlUGF0aD86IHN0cmluZykge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBpbnZhbGlkYXRlKGZpbGVzOiBJdGVyYWJsZTxzdHJpbmc+KTogdm9pZCB7XG4gICAgdGhpcy5tb2RpZmllZEZpbGVzLmNsZWFyKCk7XG4gICAgZm9yIChsZXQgZmlsZSBvZiBmaWxlcykge1xuICAgICAgdGhpcy5iYWJlbEZpbGVDYWNoZS5kZWxldGUoZmlsZSk7XG4gICAgICB0aGlzLnR5cGVTY3JpcHRGaWxlQ2FjaGUuZGVsZXRlKHBhdGhUb0ZpbGVVUkwoZmlsZSkuaHJlZik7XG4gICAgICB0aGlzLmxvYWRSZXN1bHRDYWNoZS5pbnZhbGlkYXRlKGZpbGUpO1xuXG4gICAgICAvLyBOb3JtYWxpemUgc2VwYXJhdG9ycyB0byBhbGxvdyBtYXRjaGluZyBUeXBlU2NyaXB0IEhvc3QgcGF0aHNcbiAgICAgIGlmIChVU0lOR19XSU5ET1dTKSB7XG4gICAgICAgIGZpbGUgPSBmaWxlLnJlcGxhY2UoV0lORE9XU19TRVBfUkVHRVhQLCBwYXRoLnBvc2l4LnNlcCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZGVsZXRlKGZpbGUpO1xuICAgICAgdGhpcy5tb2RpZmllZEZpbGVzLmFkZChmaWxlKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb21waWxlclBsdWdpbk9wdGlvbnMge1xuICBzb3VyY2VtYXA6IGJvb2xlYW47XG4gIHRzY29uZmlnOiBzdHJpbmc7XG4gIGppdD86IGJvb2xlYW47XG4gIGFkdmFuY2VkT3B0aW1pemF0aW9ucz86IGJvb2xlYW47XG4gIHRoaXJkUGFydHlTb3VyY2VtYXBzPzogYm9vbGVhbjtcbiAgZmlsZVJlcGxhY2VtZW50cz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZTtcbiAgbG9hZFJlc3VsdENhY2hlPzogTG9hZFJlc3VsdENhY2hlO1xufVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICBwbHVnaW5PcHRpb25zOiBDb21waWxlclBsdWdpbk9wdGlvbnMsXG4gIHN0eWxlT3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMgJiB7IGlubGluZVN0eWxlTGFuZ3VhZ2U6IHN0cmluZyB9LFxuKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1jb21waWxlcicsXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbiAgICBhc3luYyBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgIGxldCBzZXR1cFdhcm5pbmdzOiBQYXJ0aWFsTWVzc2FnZVtdIHwgdW5kZWZpbmVkID0gW107XG5cbiAgICAgIGNvbnN0IHByZXNlcnZlU3ltbGlua3MgPSBidWlsZC5pbml0aWFsT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzO1xuICAgICAgbGV0IHRzY29uZmlnUGF0aCA9IHBsdWdpbk9wdGlvbnMudHNjb25maWc7XG4gICAgICBpZiAoIXByZXNlcnZlU3ltbGlua3MpIHtcbiAgICAgICAgLy8gVXNlIHRoZSByZWFsIHBhdGggb2YgdGhlIHRzY29uZmlnIGlmIG5vdCBwcmVzZXJ2aW5nIHN5bWxpbmtzLlxuICAgICAgICAvLyBUaGlzIGVuc3VyZXMgdGhlIFRTIHNvdXJjZSBmaWxlIHBhdGhzIGFyZSBiYXNlZCBvbiB0aGUgcmVhbCBwYXRoIG9mIHRoZSBjb25maWd1cmF0aW9uLlxuICAgICAgICB0cnkge1xuICAgICAgICAgIHRzY29uZmlnUGF0aCA9IGF3YWl0IHJlYWxwYXRoKHRzY29uZmlnUGF0aCk7XG4gICAgICAgIH0gY2F0Y2gge31cbiAgICAgIH1cblxuICAgICAgLy8gSW5pdGlhbGl6ZSBhIHdvcmtlciBwb29sIGZvciBKYXZhU2NyaXB0IHRyYW5zZm9ybWF0aW9uc1xuICAgICAgY29uc3QgamF2YXNjcmlwdFRyYW5zZm9ybWVyID0gbmV3IEphdmFTY3JpcHRUcmFuc2Zvcm1lcihwbHVnaW5PcHRpb25zLCBtYXhXb3JrZXJzKTtcblxuICAgICAgLy8gU2V0dXAgZGVmaW5lcyBiYXNlZCBvbiB0aGUgdmFsdWVzIHByb3ZpZGVkIGJ5IHRoZSBBbmd1bGFyIGNvbXBpbGVyLWNsaVxuICAgICAgY29uc3QgeyBHTE9CQUxfREVGU19GT1JfVEVSU0VSX1dJVEhfQU9UIH0gPSBhd2FpdCBBbmd1bGFyQ29tcGlsYXRpb24ubG9hZENvbXBpbGVyQ2xpKCk7XG4gICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUgPz89IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoR0xPQkFMX0RFRlNfRk9SX1RFUlNFUl9XSVRIX0FPVCkpIHtcbiAgICAgICAgaWYgKGtleSBpbiBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUpIHtcbiAgICAgICAgICAvLyBTa2lwIGtleXMgdGhhdCBoYXZlIGJlZW4gbWFudWFsbHkgcHJvdmlkZWRcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoa2V5ID09PSAnbmdEZXZNb2RlJykge1xuICAgICAgICAgIC8vIG5nRGV2TW9kZSBpcyBhbHJlYWR5IHNldCBiYXNlZCBvbiB0aGUgYnVpbGRlcidzIHNjcmlwdCBvcHRpbWl6YXRpb24gb3B0aW9uXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZXNidWlsZCByZXF1aXJlcyB2YWx1ZXMgdG8gYmUgYSBzdHJpbmcgKGFjdHVhbCBzdHJpbmdzIG5lZWQgdG8gYmUgcXVvdGVkKS5cbiAgICAgICAgLy8gSW4gdGhpcyBjYXNlLCBhbGwgcHJvdmlkZWQgdmFsdWVzIGFyZSBib29sZWFucy5cbiAgICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lW2tleV0gPSB2YWx1ZS50b1N0cmluZygpO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgaW4tbWVtb3J5IGNhY2hlIG9mIFR5cGVTY3JpcHQgZmlsZSBvdXRwdXRzIHdpbGwgYmUgdXNlZCBkdXJpbmcgdGhlIGJ1aWxkIGluIGBvbkxvYWRgIGNhbGxiYWNrcyBmb3IgVFMgZmlsZXMuXG4gICAgICAvLyBBIHN0cmluZyB2YWx1ZSBpbmRpY2F0ZXMgZGlyZWN0IFRTL05HIG91dHB1dCBhbmQgYSBVaW50OEFycmF5IGluZGljYXRlcyBmdWxseSB0cmFuc2Zvcm1lZCBjb2RlLlxuICAgICAgY29uc3QgdHlwZVNjcmlwdEZpbGVDYWNoZSA9XG4gICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy50eXBlU2NyaXB0RmlsZUNhY2hlID8/XG4gICAgICAgIG5ldyBNYXA8c3RyaW5nLCBzdHJpbmcgfCBVaW50OEFycmF5PigpO1xuXG4gICAgICAvLyBUaGUgc3R5bGVzaGVldCByZXNvdXJjZXMgZnJvbSBjb21wb25lbnQgc3R5bGVzaGVldHMgdGhhdCB3aWxsIGJlIGFkZGVkIHRvIHRoZSBidWlsZCByZXN1bHRzIG91dHB1dCBmaWxlc1xuICAgICAgbGV0IHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzOiBPdXRwdXRGaWxlW10gPSBbXTtcbiAgICAgIGxldCBzdHlsZXNoZWV0TWV0YWZpbGVzOiBNZXRhZmlsZVtdO1xuXG4gICAgICAvLyBDcmVhdGUgbmV3IHJldXNhYmxlIGNvbXBpbGF0aW9uIGZvciB0aGUgYXBwcm9wcmlhdGUgbW9kZSBiYXNlZCBvbiB0aGUgYGppdGAgcGx1Z2luIG9wdGlvblxuICAgICAgY29uc3QgY29tcGlsYXRpb246IEFuZ3VsYXJDb21waWxhdGlvbiA9IHBsdWdpbk9wdGlvbnMuaml0XG4gICAgICAgID8gbmV3IEppdENvbXBpbGF0aW9uKClcbiAgICAgICAgOiBuZXcgQW90Q29tcGlsYXRpb24oKTtcblxuICAgICAgLy8gRGV0ZXJtaW5lcyBpZiBUeXBlU2NyaXB0IHNob3VsZCBwcm9jZXNzIEphdmFTY3JpcHQgZmlsZXMgYmFzZWQgb24gdHNjb25maWcgYGFsbG93SnNgIG9wdGlvblxuICAgICAgbGV0IHNob3VsZFRzSWdub3JlSnMgPSB0cnVlO1xuXG4gICAgICBidWlsZC5vblN0YXJ0KGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0OiBPblN0YXJ0UmVzdWx0ID0ge1xuICAgICAgICAgIHdhcm5pbmdzOiBzZXR1cFdhcm5pbmdzLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFJlc2V0IGRlYnVnIHBlcmZvcm1hbmNlIHRyYWNraW5nXG4gICAgICAgIHJlc2V0Q3VtdWxhdGl2ZUR1cmF0aW9ucygpO1xuXG4gICAgICAgIC8vIFJlc2V0IHN0eWxlc2hlZXQgcmVzb3VyY2Ugb3V0cHV0IGZpbGVzXG4gICAgICAgIHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzID0gW107XG4gICAgICAgIHN0eWxlc2hlZXRNZXRhZmlsZXMgPSBbXTtcblxuICAgICAgICAvLyBDcmVhdGUgQW5ndWxhciBjb21waWxlciBob3N0IG9wdGlvbnNcbiAgICAgICAgY29uc3QgaG9zdE9wdGlvbnM6IEFuZ3VsYXJIb3N0T3B0aW9ucyA9IHtcbiAgICAgICAgICBmaWxlUmVwbGFjZW1lbnRzOiBwbHVnaW5PcHRpb25zLmZpbGVSZXBsYWNlbWVudHMsXG4gICAgICAgICAgbW9kaWZpZWRGaWxlczogcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/Lm1vZGlmaWVkRmlsZXMsXG4gICAgICAgICAgc291cmNlRmlsZUNhY2hlOiBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZSxcbiAgICAgICAgICBhc3luYyB0cmFuc2Zvcm1TdHlsZXNoZWV0KGRhdGEsIGNvbnRhaW5pbmdGaWxlLCBzdHlsZXNoZWV0RmlsZSkge1xuICAgICAgICAgICAgLy8gU3R5bGVzaGVldCBmaWxlIG9ubHkgZXhpc3RzIGZvciBleHRlcm5hbCBzdHlsZXNoZWV0c1xuICAgICAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBzdHlsZXNoZWV0RmlsZSA/PyBjb250YWluaW5nRmlsZTtcblxuICAgICAgICAgICAgY29uc3Qgc3R5bGVzaGVldFJlc3VsdCA9IGF3YWl0IGJ1bmRsZUNvbXBvbmVudFN0eWxlc2hlZXQoXG4gICAgICAgICAgICAgIHN0eWxlT3B0aW9ucy5pbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgICBmaWxlbmFtZSxcbiAgICAgICAgICAgICAgIXN0eWxlc2hlZXRGaWxlLFxuICAgICAgICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMubG9hZFJlc3VsdENhY2hlLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgY29uc3QgeyBjb250ZW50cywgcmVzb3VyY2VGaWxlcywgZXJyb3JzLCB3YXJuaW5ncyB9ID0gc3R5bGVzaGVldFJlc3VsdDtcbiAgICAgICAgICAgIGlmIChlcnJvcnMpIHtcbiAgICAgICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaCguLi53YXJuaW5ncyk7XG4gICAgICAgICAgICBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcy5wdXNoKC4uLnJlc291cmNlRmlsZXMpO1xuICAgICAgICAgICAgaWYgKHN0eWxlc2hlZXRSZXN1bHQubWV0YWZpbGUpIHtcbiAgICAgICAgICAgICAgc3R5bGVzaGVldE1ldGFmaWxlcy5wdXNoKHN0eWxlc2hlZXRSZXN1bHQubWV0YWZpbGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY29udGVudHM7XG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHRoZSBBbmd1bGFyIGNvbXBpbGF0aW9uIGZvciB0aGUgY3VycmVudCBidWlsZC5cbiAgICAgICAgLy8gSW4gd2F0Y2ggbW9kZSwgcHJldmlvdXMgYnVpbGQgc3RhdGUgd2lsbCBiZSByZXVzZWQuXG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICBjb21waWxlck9wdGlvbnM6IHsgYWxsb3dKcyB9LFxuICAgICAgICAgIHJlZmVyZW5jZWRGaWxlcyxcbiAgICAgICAgfSA9IGF3YWl0IGNvbXBpbGF0aW9uLmluaXRpYWxpemUodHNjb25maWdQYXRoLCBob3N0T3B0aW9ucywgKGNvbXBpbGVyT3B0aW9ucykgPT4ge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCA8IHRzLlNjcmlwdFRhcmdldC5FUzIwMjJcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIC8vIElmICd1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkcycgaXMgYWxyZWFkeSBkZWZpbmVkIGluIHRoZSB1c2VycyBwcm9qZWN0IGxlYXZlIHRoZSB2YWx1ZSBhcyBpcy5cbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSBmYWxsYmFjayB0byBmYWxzZSBkdWUgdG8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy80NTk5NVxuICAgICAgICAgICAgLy8gd2hpY2ggYnJlYWtzIHRoZSBkZXByZWNhdGVkIGBARWZmZWN0c2AgTkdSWCBkZWNvcmF0b3IgYW5kIHBvdGVudGlhbGx5IG90aGVyIGV4aXN0aW5nIGNvZGUgYXMgd2VsbC5cbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPSB0cy5TY3JpcHRUYXJnZXQuRVMyMDIyO1xuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnVzZURlZmluZUZvckNsYXNzRmllbGRzID8/PSBmYWxzZTtcblxuICAgICAgICAgICAgLy8gT25seSBhZGQgdGhlIHdhcm5pbmcgb24gdGhlIGluaXRpYWwgYnVpbGRcbiAgICAgICAgICAgIHNldHVwV2FybmluZ3M/LnB1c2goe1xuICAgICAgICAgICAgICB0ZXh0OlxuICAgICAgICAgICAgICAgICdUeXBlU2NyaXB0IGNvbXBpbGVyIG9wdGlvbnMgXCJ0YXJnZXRcIiBhbmQgXCJ1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkc1wiIGFyZSBzZXQgdG8gXCJFUzIwMjJcIiBhbmQgJyArXG4gICAgICAgICAgICAgICAgJ1wiZmFsc2VcIiByZXNwZWN0aXZlbHkgYnkgdGhlIEFuZ3VsYXIgQ0xJLicsXG4gICAgICAgICAgICAgIGxvY2F0aW9uOiB7IGZpbGU6IHBsdWdpbk9wdGlvbnMudHNjb25maWcgfSxcbiAgICAgICAgICAgICAgbm90ZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB0ZXh0OlxuICAgICAgICAgICAgICAgICAgICAnVG8gY29udHJvbCBFQ01BIHZlcnNpb24gYW5kIGZlYXR1cmVzIHVzZSB0aGUgQnJvd2Vyc2xpc3QgY29uZmlndXJhdGlvbi4gJyArXG4gICAgICAgICAgICAgICAgICAgICdGb3IgbW9yZSBpbmZvcm1hdGlvbiwgc2VlIGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS9idWlsZCNjb25maWd1cmluZy1icm93c2VyLWNvbXBhdGliaWxpdHknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBFbmFibGUgaW5jcmVtZW50YWwgY29tcGlsYXRpb24gYnkgZGVmYXVsdCBpZiBjYWNoaW5nIGlzIGVuYWJsZWRcbiAgICAgICAgICBpZiAocGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LnBlcnNpc3RlbnRDYWNoZVBhdGgpIHtcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy5pbmNyZW1lbnRhbCA/Pz0gdHJ1ZTtcbiAgICAgICAgICAgIC8vIFNldCB0aGUgYnVpbGQgaW5mbyBmaWxlIGxvY2F0aW9uIHRvIHRoZSBjb25maWd1cmVkIGNhY2hlIGRpcmVjdG9yeVxuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnRzQnVpbGRJbmZvRmlsZSA9IHBhdGguam9pbihcbiAgICAgICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LnBlcnNpc3RlbnRDYWNoZVBhdGgsXG4gICAgICAgICAgICAgICcudHNidWlsZGluZm8nLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLmluY3JlbWVudGFsID0gZmFsc2U7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLmNvbXBpbGVyT3B0aW9ucyxcbiAgICAgICAgICAgIG5vRW1pdE9uRXJyb3I6IGZhbHNlLFxuICAgICAgICAgICAgaW5saW5lU291cmNlczogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgICBpbmxpbmVTb3VyY2VNYXA6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgICAgbWFwUm9vdDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgc291cmNlUm9vdDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgICAgc2hvdWxkVHNJZ25vcmVKcyA9ICFhbGxvd0pzO1xuXG4gICAgICAgIHByb2ZpbGVTeW5jKCdOR19ESUFHTk9TVElDU19UT1RBTCcsICgpID0+IHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGRpYWdub3N0aWMgb2YgY29tcGlsYXRpb24uY29sbGVjdERpYWdub3N0aWNzKCkpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBjb252ZXJ0VHlwZVNjcmlwdERpYWdub3N0aWMoZGlhZ25vc3RpYyk7XG4gICAgICAgICAgICBpZiAoZGlhZ25vc3RpYy5jYXRlZ29yeSA9PT0gdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yKSB7XG4gICAgICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaChtZXNzYWdlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gVXBkYXRlIFR5cGVTY3JpcHQgZmlsZSBvdXRwdXQgY2FjaGUgZm9yIGFsbCBhZmZlY3RlZCBmaWxlc1xuICAgICAgICBwcm9maWxlU3luYygnTkdfRU1JVF9UUycsICgpID0+IHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHsgZmlsZW5hbWUsIGNvbnRlbnRzIH0gb2YgY29tcGlsYXRpb24uZW1pdEFmZmVjdGVkRmlsZXMoKSkge1xuICAgICAgICAgICAgdHlwZVNjcmlwdEZpbGVDYWNoZS5zZXQocGF0aFRvRmlsZVVSTChmaWxlbmFtZSkuaHJlZiwgY29udGVudHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gU3RvcmUgcmVmZXJlbmNlZCBmaWxlcyBmb3IgdXBkYXRlZCBmaWxlIHdhdGNoaW5nIGlmIGVuYWJsZWRcbiAgICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlKSB7XG4gICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUucmVmZXJlbmNlZEZpbGVzID0gcmVmZXJlbmNlZEZpbGVzO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzZXQgdGhlIHNldHVwIHdhcm5pbmdzIHNvIHRoYXQgdGhleSBhcmUgb25seSBzaG93biBkdXJpbmcgdGhlIGZpcnN0IGJ1aWxkLlxuICAgICAgICBzZXR1cFdhcm5pbmdzID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9banRdc3g/JC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cz8uW2FyZ3MucGF0aF0gPz8gYXJncy5wYXRoO1xuXG4gICAgICAgIC8vIFNraXAgVFMgbG9hZCBhdHRlbXB0IGlmIEpTIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gbm90IGVuYWJsZWQgYW5kIGZpbGUgaXMgSlNcbiAgICAgICAgaWYgKHNob3VsZFRzSWdub3JlSnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KHJlcXVlc3QpKSB7XG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBmaWxlbmFtZSBpcyBjdXJyZW50bHkgdXNlZCBhcyBhIGNhY2hlIGtleS4gU2luY2UgdGhlIGNhY2hlIGlzIG1lbW9yeSBvbmx5LFxuICAgICAgICAvLyB0aGUgb3B0aW9ucyBjYW5ub3QgY2hhbmdlIGFuZCBkbyBub3QgbmVlZCB0byBiZSByZXByZXNlbnRlZCBpbiB0aGUga2V5LiBJZiB0aGVcbiAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAvLyB3b3VsZCBuZWVkIHRvIGJlIGFkZGVkIHRvIHRoZSBrZXkgYXMgd2VsbCBhcyBhIGNoZWNrIGZvciBhbnkgY2hhbmdlIG9mIGNvbnRlbnQuXG4gICAgICAgIGxldCBjb250ZW50cyA9IHR5cGVTY3JpcHRGaWxlQ2FjaGUuZ2V0KHBhdGhUb0ZpbGVVUkwocmVxdWVzdCkuaHJlZik7XG5cbiAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBObyBUUyByZXN1bHQgaW5kaWNhdGVzIHRoZSBmaWxlIGlzIG5vdCBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0uXG4gICAgICAgICAgLy8gSWYgYWxsb3dKcyBpcyBlbmFibGVkIGFuZCB0aGUgZmlsZSBpcyBKUyB0aGVuIGRlZmVyIHRvIHRoZSBuZXh0IGxvYWQgaG9vay5cbiAgICAgICAgICBpZiAoIXNob3VsZFRzSWdub3JlSnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KHJlcXVlc3QpKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE90aGVyd2lzZSByZXR1cm4gYW4gZXJyb3JcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgIGNyZWF0ZU1pc3NpbmdGaWxlRXJyb3IocmVxdWVzdCwgYXJncy5wYXRoLCBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyID8/ICcnKSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY29udGVudHMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgLy8gQSBzdHJpbmcgaW5kaWNhdGVzIHVudHJhbnNmb3JtZWQgb3V0cHV0IGZyb20gdGhlIFRTL05HIGNvbXBpbGVyXG4gICAgICAgICAgY29udGVudHMgPSBhd2FpdCBqYXZhc2NyaXB0VHJhbnNmb3JtZXIudHJhbnNmb3JtRGF0YShcbiAgICAgICAgICAgIHJlcXVlc3QsXG4gICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgIHRydWUgLyogc2tpcExpbmtlciAqLyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgLy8gU3RvcmUgYXMgdGhlIHJldHVybmVkIFVpbnQ4QXJyYXkgdG8gYWxsb3cgY2FjaGluZyB0aGUgZnVsbHkgdHJhbnNmb3JtZWQgY29kZVxuICAgICAgICAgIHR5cGVTY3JpcHRGaWxlQ2FjaGUuc2V0KHBhdGhUb0ZpbGVVUkwocmVxdWVzdCkuaHJlZiwgY29udGVudHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9qcyQvIH0sIChhcmdzKSA9PlxuICAgICAgICBwcm9maWxlQXN5bmMoXG4gICAgICAgICAgJ05HX0VNSVRfSlMqJyxcbiAgICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAvLyBUaGUgZmlsZW5hbWUgaXMgY3VycmVudGx5IHVzZWQgYXMgYSBjYWNoZSBrZXkuIFNpbmNlIHRoZSBjYWNoZSBpcyBtZW1vcnkgb25seSxcbiAgICAgICAgICAgIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAgICAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAgICAgLy8gd291bGQgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUga2V5IGFzIHdlbGwgYXMgYSBjaGVjayBmb3IgYW55IGNoYW5nZSBvZiBjb250ZW50LlxuICAgICAgICAgICAgbGV0IGNvbnRlbnRzID0gcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LmJhYmVsRmlsZUNhY2hlLmdldChhcmdzLnBhdGgpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgY29udGVudHMgPSBhd2FpdCBqYXZhc2NyaXB0VHJhbnNmb3JtZXIudHJhbnNmb3JtRmlsZShhcmdzLnBhdGgsIHBsdWdpbk9wdGlvbnMuaml0KTtcbiAgICAgICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LmJhYmVsRmlsZUNhY2hlLnNldChhcmdzLnBhdGgsIGNvbnRlbnRzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgY29udGVudHMsXG4gICAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSxcbiAgICAgICAgICB0cnVlLFxuICAgICAgICApLFxuICAgICAgKTtcblxuICAgICAgLy8gU2V0dXAgYnVuZGxpbmcgb2YgY29tcG9uZW50IHRlbXBsYXRlcyBhbmQgc3R5bGVzaGVldHMgd2hlbiBpbiBKSVQgbW9kZVxuICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuaml0KSB7XG4gICAgICAgIHNldHVwSml0UGx1Z2luQ2FsbGJhY2tzKFxuICAgICAgICAgIGJ1aWxkLFxuICAgICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICAgICBzdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyxcbiAgICAgICAgICBwbHVnaW5PcHRpb25zLmxvYWRSZXN1bHRDYWNoZSxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgYnVpbGQub25FbmQoKHJlc3VsdCkgPT4ge1xuICAgICAgICAvLyBBZGQgYW55IGNvbXBvbmVudCBzdHlsZXNoZWV0IHJlc291cmNlIGZpbGVzIHRvIHRoZSBvdXRwdXQgZmlsZXNcbiAgICAgICAgaWYgKHN0eWxlc2hlZXRSZXNvdXJjZUZpbGVzLmxlbmd0aCkge1xuICAgICAgICAgIHJlc3VsdC5vdXRwdXRGaWxlcz8ucHVzaCguLi5zdHlsZXNoZWV0UmVzb3VyY2VGaWxlcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb21iaW5lIGNvbXBvbmVudCBzdHlsZXNoZWV0IG1ldGFmaWxlcyB3aXRoIG1haW4gbWV0YWZpbGVcbiAgICAgICAgaWYgKHJlc3VsdC5tZXRhZmlsZSAmJiBzdHlsZXNoZWV0TWV0YWZpbGVzLmxlbmd0aCkge1xuICAgICAgICAgIGZvciAoY29uc3QgbWV0YWZpbGUgb2Ygc3R5bGVzaGVldE1ldGFmaWxlcykge1xuICAgICAgICAgICAgcmVzdWx0Lm1ldGFmaWxlLmlucHV0cyA9IHsgLi4ucmVzdWx0Lm1ldGFmaWxlLmlucHV0cywgLi4ubWV0YWZpbGUuaW5wdXRzIH07XG4gICAgICAgICAgICByZXN1bHQubWV0YWZpbGUub3V0cHV0cyA9IHsgLi4ucmVzdWx0Lm1ldGFmaWxlLm91dHB1dHMsIC4uLm1ldGFmaWxlLm91dHB1dHMgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBsb2dDdW11bGF0aXZlRHVyYXRpb25zKCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVNaXNzaW5nRmlsZUVycm9yKHJlcXVlc3Q6IHN0cmluZywgb3JpZ2luYWw6IHN0cmluZywgcm9vdDogc3RyaW5nKTogUGFydGlhbE1lc3NhZ2Uge1xuICBjb25zdCBlcnJvciA9IHtcbiAgICB0ZXh0OiBgRmlsZSAnJHtwYXRoLnJlbGF0aXZlKHJvb3QsIHJlcXVlc3QpfScgaXMgbWlzc2luZyBmcm9tIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uLmAsXG4gICAgbm90ZXM6IFtcbiAgICAgIHtcbiAgICAgICAgdGV4dDogYEVuc3VyZSB0aGUgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0gdmlhIHRoZSAnZmlsZXMnIG9yICdpbmNsdWRlJyBwcm9wZXJ0eS5gLFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xuXG4gIGlmIChyZXF1ZXN0ICE9PSBvcmlnaW5hbCkge1xuICAgIGVycm9yLm5vdGVzLnB1c2goe1xuICAgICAgdGV4dDogYEZpbGUgaXMgcmVxdWVzdGVkIGZyb20gYSBmaWxlIHJlcGxhY2VtZW50IG9mICcke3BhdGgucmVsYXRpdmUocm9vdCwgb3JpZ2luYWwpfScuYCxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBlcnJvcjtcbn1cbiJdfQ==