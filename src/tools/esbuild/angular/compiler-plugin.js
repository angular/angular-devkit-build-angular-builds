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
const node_assert_1 = __importDefault(require("node:assert"));
const promises_1 = require("node:fs/promises");
const path = __importStar(require("node:path"));
const node_url_1 = require("node:url");
const typescript_1 = __importDefault(require("typescript"));
const environment_options_1 = require("../../../utils/environment-options");
const javascript_transformer_1 = require("../javascript-transformer");
const profiling_1 = require("../profiling");
const compilation_1 = require("./compilation");
const compilation_state_1 = require("./compilation-state");
const component_stylesheets_1 = require("./component-stylesheets");
const file_reference_tracker_1 = require("./file-reference-tracker");
const jit_plugin_callbacks_1 = require("./jit-plugin-callbacks");
// eslint-disable-next-line max-lines-per-function
function createCompilerPlugin(pluginOptions, styleOptions) {
    return {
        name: 'angular-compiler',
        // eslint-disable-next-line max-lines-per-function
        async setup(build) {
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
            // Setup defines based on the values used by the Angular compiler-cli
            build.initialOptions.define ??= {};
            build.initialOptions.define['ngI18nClosureMode'] ??= 'false';
            // The in-memory cache of TypeScript file outputs will be used during the build in `onLoad` callbacks for TS files.
            // A string value indicates direct TS/NG output and a Uint8Array indicates fully transformed code.
            const typeScriptFileCache = pluginOptions.sourceFileCache?.typeScriptFileCache ??
                new Map();
            // The resources from component stylesheets and web workers that will be added to the build results output files
            const additionalResults = new Map();
            // Create new reusable compilation for the appropriate mode based on the `jit` plugin option
            const compilation = pluginOptions.noopTypeScriptCompilation
                ? new compilation_1.NoopCompilation()
                : pluginOptions.jit
                    ? new compilation_1.JitCompilation()
                    : new compilation_1.AotCompilation();
            // Determines if TypeScript should process JavaScript files based on tsconfig `allowJs` option
            let shouldTsIgnoreJs = true;
            // Track incremental component stylesheet builds
            const stylesheetBundler = new component_stylesheets_1.ComponentStylesheetBundler(styleOptions, pluginOptions.incremental, pluginOptions.loadResultCache);
            let sharedTSCompilationState;
            // To fully invalidate files, track resource referenced files and their referencing source
            const referencedFileTracker = new file_reference_tracker_1.FileReferenceTracker();
            // eslint-disable-next-line max-lines-per-function
            build.onStart(async () => {
                sharedTSCompilationState = (0, compilation_state_1.getSharedCompilationState)();
                if (!(compilation instanceof compilation_1.NoopCompilation)) {
                    sharedTSCompilationState.markAsInProgress();
                }
                const result = {
                    warnings: setupWarnings,
                };
                // Reset debug performance tracking
                (0, profiling_1.resetCumulativeDurations)();
                // Update the reference tracker and generate a full set of modified files for the
                // Angular compiler which does not have direct knowledge of transitive resource
                // dependencies or web worker processing.
                let modifiedFiles;
                if (pluginOptions.sourceFileCache?.modifiedFiles.size &&
                    referencedFileTracker &&
                    !pluginOptions.noopTypeScriptCompilation) {
                    // TODO: Differentiate between changed input files and stale output files
                    modifiedFiles = referencedFileTracker.update(pluginOptions.sourceFileCache.modifiedFiles);
                    pluginOptions.sourceFileCache.invalidate(modifiedFiles);
                }
                // Create Angular compiler host options
                const hostOptions = {
                    fileReplacements: pluginOptions.fileReplacements,
                    modifiedFiles,
                    sourceFileCache: pluginOptions.sourceFileCache,
                    async transformStylesheet(data, containingFile, stylesheetFile) {
                        let stylesheetResult;
                        // Stylesheet file only exists for external stylesheets
                        if (stylesheetFile) {
                            stylesheetResult = await stylesheetBundler.bundleFile(stylesheetFile);
                        }
                        else {
                            stylesheetResult = await stylesheetBundler.bundleInline(data, containingFile, styleOptions.inlineStyleLanguage);
                        }
                        const { contents, resourceFiles, referencedFiles, errors, warnings } = stylesheetResult;
                        if (errors) {
                            (result.errors ??= []).push(...errors);
                        }
                        (result.warnings ??= []).push(...warnings);
                        additionalResults.set(stylesheetFile ?? containingFile, {
                            outputFiles: resourceFiles,
                            metafile: stylesheetResult.metafile,
                        });
                        if (referencedFiles) {
                            referencedFileTracker.add(containingFile, referencedFiles);
                            if (stylesheetFile) {
                                // Angular AOT compiler needs modified direct resource files to correctly invalidate its analysis
                                referencedFileTracker.add(stylesheetFile, referencedFiles);
                            }
                        }
                        return contents;
                    },
                    processWebWorker(workerFile, containingFile) {
                        const fullWorkerPath = path.join(path.dirname(containingFile), workerFile);
                        // The synchronous API must be used due to the TypeScript compilation currently being
                        // fully synchronous and this process callback being called from within a TypeScript
                        // transformer.
                        const workerResult = bundleWebWorker(build, pluginOptions, fullWorkerPath);
                        (result.warnings ??= []).push(...workerResult.warnings);
                        if (workerResult.errors.length > 0) {
                            (result.errors ??= []).push(...workerResult.errors);
                            // Track worker file errors to allow rebuilds on changes
                            referencedFileTracker.add(containingFile, workerResult.errors
                                .map((error) => error.location?.file)
                                .filter((file) => !!file)
                                .map((file) => path.join(build.initialOptions.absWorkingDir ?? '', file)));
                            additionalResults.set(fullWorkerPath, { errors: result.errors });
                            // Return the original path if the build failed
                            return workerFile;
                        }
                        (0, node_assert_1.default)('outputFiles' in workerResult, 'Invalid web worker bundle result.');
                        additionalResults.set(fullWorkerPath, {
                            outputFiles: workerResult.outputFiles,
                            metafile: workerResult.metafile,
                        });
                        referencedFileTracker.add(containingFile, Object.keys(workerResult.metafile.inputs).map((input) => path.join(build.initialOptions.absWorkingDir ?? '', input)));
                        // Return bundled worker file entry name to be used in the built output
                        const workerCodeFile = workerResult.outputFiles.find((file) => file.path.endsWith('.js'));
                        (0, node_assert_1.default)(workerCodeFile, 'Web Worker bundled code file should always be present.');
                        return path.relative(build.initialOptions.outdir ?? '', workerCodeFile.path);
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
                        compilerOptions.useDefineForClassFields ??= false;
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
                        compilerOptions.incremental ??= true;
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
                if (compilation instanceof compilation_1.NoopCompilation) {
                    await sharedTSCompilationState.waitUntilReady;
                    return result;
                }
                const diagnostics = await compilation.diagnoseFiles();
                if (diagnostics.errors) {
                    (result.errors ??= []).push(...diagnostics.errors);
                }
                if (diagnostics.warnings) {
                    (result.warnings ??= []).push(...diagnostics.warnings);
                }
                // Update TypeScript file output cache for all affected files
                (0, profiling_1.profileSync)('NG_EMIT_TS', () => {
                    for (const { filename, contents } of compilation.emitAffectedFiles()) {
                        typeScriptFileCache.set((0, node_url_1.pathToFileURL)(filename).href, contents);
                    }
                });
                // Add errors from failed additional results.
                // This must be done after emit to capture latest web worker results.
                for (const { errors } of additionalResults.values()) {
                    if (errors) {
                        (result.errors ??= []).push(...errors);
                    }
                }
                // Store referenced files for updated file watching if enabled
                if (pluginOptions.sourceFileCache) {
                    pluginOptions.sourceFileCache.referencedFiles = [
                        ...referencedFiles,
                        ...referencedFileTracker.referencedFiles,
                    ];
                }
                // Reset the setup warnings so that they are only shown during the first build.
                setupWarnings = undefined;
                sharedTSCompilationState.markAsReady();
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
                (0, jit_plugin_callbacks_1.setupJitPluginCallbacks)(build, stylesheetBundler, additionalResults, styleOptions.inlineStyleLanguage);
            }
            build.onEnd((result) => {
                for (const { outputFiles, metafile } of additionalResults.values()) {
                    // Add any additional output files to the main output files
                    if (outputFiles?.length) {
                        result.outputFiles?.push(...outputFiles);
                    }
                    // Combine additional metafiles with main metafile
                    if (result.metafile && metafile) {
                        result.metafile.inputs = { ...result.metafile.inputs, ...metafile.inputs };
                        result.metafile.outputs = { ...result.metafile.outputs, ...metafile.outputs };
                    }
                }
                (0, profiling_1.logCumulativeDurations)();
            });
            build.onDispose(() => {
                sharedTSCompilationState?.dispose();
                void stylesheetBundler.dispose();
            });
        },
    };
}
exports.createCompilerPlugin = createCompilerPlugin;
function bundleWebWorker(build, pluginOptions, workerFile) {
    try {
        return build.esbuild.buildSync({
            platform: 'browser',
            write: false,
            bundle: true,
            metafile: true,
            format: 'esm',
            mainFields: ['es2020', 'es2015', 'browser', 'module', 'main'],
            logLevel: 'silent',
            sourcemap: pluginOptions.sourcemap,
            entryNames: 'worker-[hash]',
            entryPoints: [workerFile],
            absWorkingDir: build.initialOptions.absWorkingDir,
            outdir: build.initialOptions.outdir,
            minifyIdentifiers: build.initialOptions.minifyIdentifiers,
            minifySyntax: build.initialOptions.minifySyntax,
            minifyWhitespace: build.initialOptions.minifyWhitespace,
            target: build.initialOptions.target,
        });
    }
    catch (error) {
        if (error && typeof error === 'object' && 'errors' in error && 'warnings' in error) {
            return error;
        }
        throw error;
    }
}
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVdILDhEQUFpQztBQUNqQywrQ0FBNEM7QUFDNUMsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUN6Qyw0REFBNEI7QUFDNUIsNEVBQWdFO0FBQ2hFLHNFQUFrRTtBQUVsRSw0Q0FLc0I7QUFHdEIsK0NBQW9HO0FBQ3BHLDJEQUEwRjtBQUMxRixtRUFBcUU7QUFDckUscUVBQWdFO0FBQ2hFLGlFQUFpRTtBQWlCakUsa0RBQWtEO0FBQ2xELFNBQWdCLG9CQUFvQixDQUNsQyxhQUFvQyxFQUNwQyxZQUF1RTtJQUV2RSxPQUFPO1FBQ0wsSUFBSSxFQUFFLGtCQUFrQjtRQUN4QixrREFBa0Q7UUFDbEQsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFrQjtZQUM1QixJQUFJLGFBQWEsR0FBaUMsRUFBRSxDQUFDO1lBQ3JELE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQztZQUUvRCxJQUFJLFlBQVksR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDO1lBQzFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtnQkFDckIsZ0VBQWdFO2dCQUNoRSx5RkFBeUY7Z0JBQ3pGLElBQUk7b0JBQ0YsWUFBWSxHQUFHLE1BQU0sSUFBQSxtQkFBUSxFQUFDLFlBQVksQ0FBQyxDQUFDO2lCQUM3QztnQkFBQyxNQUFNLEdBQUU7YUFDWDtZQUVELDBEQUEwRDtZQUMxRCxNQUFNLHFCQUFxQixHQUFHLElBQUksOENBQXFCLENBQUMsYUFBYSxFQUFFLGdDQUFVLENB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aWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIEJ1aWxkRmFpbHVyZSxcbiAgTWV0YWZpbGUsXG4gIE9uU3RhcnRSZXN1bHQsXG4gIE91dHB1dEZpbGUsXG4gIFBhcnRpYWxNZXNzYWdlLFxuICBQbHVnaW4sXG4gIFBsdWdpbkJ1aWxkLFxufSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcmVhbHBhdGggfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBtYXhXb3JrZXJzIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIgfSBmcm9tICcuLi9qYXZhc2NyaXB0LXRyYW5zZm9ybWVyJztcbmltcG9ydCB7IExvYWRSZXN1bHRDYWNoZSB9IGZyb20gJy4uL2xvYWQtcmVzdWx0LWNhY2hlJztcbmltcG9ydCB7XG4gIGxvZ0N1bXVsYXRpdmVEdXJhdGlvbnMsXG4gIHByb2ZpbGVBc3luYyxcbiAgcHJvZmlsZVN5bmMsXG4gIHJlc2V0Q3VtdWxhdGl2ZUR1cmF0aW9ucyxcbn0gZnJvbSAnLi4vcHJvZmlsaW5nJztcbmltcG9ydCB7IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zIH0gZnJvbSAnLi4vc3R5bGVzaGVldHMvYnVuZGxlLW9wdGlvbnMnO1xuaW1wb3J0IHsgQW5ndWxhckhvc3RPcHRpb25zIH0gZnJvbSAnLi9hbmd1bGFyLWhvc3QnO1xuaW1wb3J0IHsgQW5ndWxhckNvbXBpbGF0aW9uLCBBb3RDb21waWxhdGlvbiwgSml0Q29tcGlsYXRpb24sIE5vb3BDb21waWxhdGlvbiB9IGZyb20gJy4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHsgU2hhcmVkVFNDb21waWxhdGlvblN0YXRlLCBnZXRTaGFyZWRDb21waWxhdGlvblN0YXRlIH0gZnJvbSAnLi9jb21waWxhdGlvbi1zdGF0ZSc7XG5pbXBvcnQgeyBDb21wb25lbnRTdHlsZXNoZWV0QnVuZGxlciB9IGZyb20gJy4vY29tcG9uZW50LXN0eWxlc2hlZXRzJztcbmltcG9ydCB7IEZpbGVSZWZlcmVuY2VUcmFja2VyIH0gZnJvbSAnLi9maWxlLXJlZmVyZW5jZS10cmFja2VyJztcbmltcG9ydCB7IHNldHVwSml0UGx1Z2luQ2FsbGJhY2tzIH0gZnJvbSAnLi9qaXQtcGx1Z2luLWNhbGxiYWNrcyc7XG5pbXBvcnQgeyBTb3VyY2VGaWxlQ2FjaGUgfSBmcm9tICcuL3NvdXJjZS1maWxlLWNhY2hlJztcblxuZXhwb3J0IGludGVyZmFjZSBDb21waWxlclBsdWdpbk9wdGlvbnMge1xuICBzb3VyY2VtYXA6IGJvb2xlYW47XG4gIHRzY29uZmlnOiBzdHJpbmc7XG4gIGppdD86IGJvb2xlYW47XG4gIC8qKiBTa2lwIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gc2V0dXAuIFRoaXMgaXMgdXNlZnVsIHRvIHJlLXVzZSB0aGUgVHlwZVNjcmlwdCBjb21waWxhdGlvbiBmcm9tIGFub3RoZXIgcGx1Z2luLiAqL1xuICBub29wVHlwZVNjcmlwdENvbXBpbGF0aW9uPzogYm9vbGVhbjtcbiAgYWR2YW5jZWRPcHRpbWl6YXRpb25zPzogYm9vbGVhbjtcbiAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM/OiBib29sZWFuO1xuICBmaWxlUmVwbGFjZW1lbnRzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgc291cmNlRmlsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlO1xuICBsb2FkUmVzdWx0Q2FjaGU/OiBMb2FkUmVzdWx0Q2FjaGU7XG4gIGluY3JlbWVudGFsOiBib29sZWFuO1xufVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICBwbHVnaW5PcHRpb25zOiBDb21waWxlclBsdWdpbk9wdGlvbnMsXG4gIHN0eWxlT3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMgJiB7IGlubGluZVN0eWxlTGFuZ3VhZ2U6IHN0cmluZyB9LFxuKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1jb21waWxlcicsXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbiAgICBhc3luYyBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgIGxldCBzZXR1cFdhcm5pbmdzOiBQYXJ0aWFsTWVzc2FnZVtdIHwgdW5kZWZpbmVkID0gW107XG4gICAgICBjb25zdCBwcmVzZXJ2ZVN5bWxpbmtzID0gYnVpbGQuaW5pdGlhbE9wdGlvbnMucHJlc2VydmVTeW1saW5rcztcblxuICAgICAgbGV0IHRzY29uZmlnUGF0aCA9IHBsdWdpbk9wdGlvbnMudHNjb25maWc7XG4gICAgICBpZiAoIXByZXNlcnZlU3ltbGlua3MpIHtcbiAgICAgICAgLy8gVXNlIHRoZSByZWFsIHBhdGggb2YgdGhlIHRzY29uZmlnIGlmIG5vdCBwcmVzZXJ2aW5nIHN5bWxpbmtzLlxuICAgICAgICAvLyBUaGlzIGVuc3VyZXMgdGhlIFRTIHNvdXJjZSBmaWxlIHBhdGhzIGFyZSBiYXNlZCBvbiB0aGUgcmVhbCBwYXRoIG9mIHRoZSBjb25maWd1cmF0aW9uLlxuICAgICAgICB0cnkge1xuICAgICAgICAgIHRzY29uZmlnUGF0aCA9IGF3YWl0IHJlYWxwYXRoKHRzY29uZmlnUGF0aCk7XG4gICAgICAgIH0gY2F0Y2gge31cbiAgICAgIH1cblxuICAgICAgLy8gSW5pdGlhbGl6ZSBhIHdvcmtlciBwb29sIGZvciBKYXZhU2NyaXB0IHRyYW5zZm9ybWF0aW9uc1xuICAgICAgY29uc3QgamF2YXNjcmlwdFRyYW5zZm9ybWVyID0gbmV3IEphdmFTY3JpcHRUcmFuc2Zvcm1lcihwbHVnaW5PcHRpb25zLCBtYXhXb3JrZXJzKTtcblxuICAgICAgLy8gU2V0dXAgZGVmaW5lcyBiYXNlZCBvbiB0aGUgdmFsdWVzIHVzZWQgYnkgdGhlIEFuZ3VsYXIgY29tcGlsZXItY2xpXG4gICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUgPz89IHt9O1xuICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lWyduZ0kxOG5DbG9zdXJlTW9kZSddID8/PSAnZmFsc2UnO1xuXG4gICAgICAvLyBUaGUgaW4tbWVtb3J5IGNhY2hlIG9mIFR5cGVTY3JpcHQgZmlsZSBvdXRwdXRzIHdpbGwgYmUgdXNlZCBkdXJpbmcgdGhlIGJ1aWxkIGluIGBvbkxvYWRgIGNhbGxiYWNrcyBmb3IgVFMgZmlsZXMuXG4gICAgICAvLyBBIHN0cmluZyB2YWx1ZSBpbmRpY2F0ZXMgZGlyZWN0IFRTL05HIG91dHB1dCBhbmQgYSBVaW50OEFycmF5IGluZGljYXRlcyBmdWxseSB0cmFuc2Zvcm1lZCBjb2RlLlxuICAgICAgY29uc3QgdHlwZVNjcmlwdEZpbGVDYWNoZSA9XG4gICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy50eXBlU2NyaXB0RmlsZUNhY2hlID8/XG4gICAgICAgIG5ldyBNYXA8c3RyaW5nLCBzdHJpbmcgfCBVaW50OEFycmF5PigpO1xuXG4gICAgICAvLyBUaGUgcmVzb3VyY2VzIGZyb20gY29tcG9uZW50IHN0eWxlc2hlZXRzIGFuZCB3ZWIgd29ya2VycyB0aGF0IHdpbGwgYmUgYWRkZWQgdG8gdGhlIGJ1aWxkIHJlc3VsdHMgb3V0cHV0IGZpbGVzXG4gICAgICBjb25zdCBhZGRpdGlvbmFsUmVzdWx0cyA9IG5ldyBNYXA8XG4gICAgICAgIHN0cmluZyxcbiAgICAgICAgeyBvdXRwdXRGaWxlcz86IE91dHB1dEZpbGVbXTsgbWV0YWZpbGU/OiBNZXRhZmlsZTsgZXJyb3JzPzogUGFydGlhbE1lc3NhZ2VbXSB9XG4gICAgICA+KCk7XG5cbiAgICAgIC8vIENyZWF0ZSBuZXcgcmV1c2FibGUgY29tcGlsYXRpb24gZm9yIHRoZSBhcHByb3ByaWF0ZSBtb2RlIGJhc2VkIG9uIHRoZSBgaml0YCBwbHVnaW4gb3B0aW9uXG4gICAgICBjb25zdCBjb21waWxhdGlvbjogQW5ndWxhckNvbXBpbGF0aW9uID0gcGx1Z2luT3B0aW9ucy5ub29wVHlwZVNjcmlwdENvbXBpbGF0aW9uXG4gICAgICAgID8gbmV3IE5vb3BDb21waWxhdGlvbigpXG4gICAgICAgIDogcGx1Z2luT3B0aW9ucy5qaXRcbiAgICAgICAgPyBuZXcgSml0Q29tcGlsYXRpb24oKVxuICAgICAgICA6IG5ldyBBb3RDb21waWxhdGlvbigpO1xuXG4gICAgICAvLyBEZXRlcm1pbmVzIGlmIFR5cGVTY3JpcHQgc2hvdWxkIHByb2Nlc3MgSmF2YVNjcmlwdCBmaWxlcyBiYXNlZCBvbiB0c2NvbmZpZyBgYWxsb3dKc2Agb3B0aW9uXG4gICAgICBsZXQgc2hvdWxkVHNJZ25vcmVKcyA9IHRydWU7XG5cbiAgICAgIC8vIFRyYWNrIGluY3JlbWVudGFsIGNvbXBvbmVudCBzdHlsZXNoZWV0IGJ1aWxkc1xuICAgICAgY29uc3Qgc3R5bGVzaGVldEJ1bmRsZXIgPSBuZXcgQ29tcG9uZW50U3R5bGVzaGVldEJ1bmRsZXIoXG4gICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICAgcGx1Z2luT3B0aW9ucy5pbmNyZW1lbnRhbCxcbiAgICAgICAgcGx1Z2luT3B0aW9ucy5sb2FkUmVzdWx0Q2FjaGUsXG4gICAgICApO1xuICAgICAgbGV0IHNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZTogU2hhcmVkVFNDb21waWxhdGlvblN0YXRlIHwgdW5kZWZpbmVkO1xuXG4gICAgICAvLyBUbyBmdWxseSBpbnZhbGlkYXRlIGZpbGVzLCB0cmFjayByZXNvdXJjZSByZWZlcmVuY2VkIGZpbGVzIGFuZCB0aGVpciByZWZlcmVuY2luZyBzb3VyY2VcbiAgICAgIGNvbnN0IHJlZmVyZW5jZWRGaWxlVHJhY2tlciA9IG5ldyBGaWxlUmVmZXJlbmNlVHJhY2tlcigpO1xuXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuICAgICAgYnVpbGQub25TdGFydChhc3luYyAoKSA9PiB7XG4gICAgICAgIHNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZSA9IGdldFNoYXJlZENvbXBpbGF0aW9uU3RhdGUoKTtcbiAgICAgICAgaWYgKCEoY29tcGlsYXRpb24gaW5zdGFuY2VvZiBOb29wQ29tcGlsYXRpb24pKSB7XG4gICAgICAgICAgc2hhcmVkVFNDb21waWxhdGlvblN0YXRlLm1hcmtBc0luUHJvZ3Jlc3MoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlc3VsdDogT25TdGFydFJlc3VsdCA9IHtcbiAgICAgICAgICB3YXJuaW5nczogc2V0dXBXYXJuaW5ncyxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBSZXNldCBkZWJ1ZyBwZXJmb3JtYW5jZSB0cmFja2luZ1xuICAgICAgICByZXNldEN1bXVsYXRpdmVEdXJhdGlvbnMoKTtcblxuICAgICAgICAvLyBVcGRhdGUgdGhlIHJlZmVyZW5jZSB0cmFja2VyIGFuZCBnZW5lcmF0ZSBhIGZ1bGwgc2V0IG9mIG1vZGlmaWVkIGZpbGVzIGZvciB0aGVcbiAgICAgICAgLy8gQW5ndWxhciBjb21waWxlciB3aGljaCBkb2VzIG5vdCBoYXZlIGRpcmVjdCBrbm93bGVkZ2Ugb2YgdHJhbnNpdGl2ZSByZXNvdXJjZVxuICAgICAgICAvLyBkZXBlbmRlbmNpZXMgb3Igd2ViIHdvcmtlciBwcm9jZXNzaW5nLlxuICAgICAgICBsZXQgbW9kaWZpZWRGaWxlcztcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5tb2RpZmllZEZpbGVzLnNpemUgJiZcbiAgICAgICAgICByZWZlcmVuY2VkRmlsZVRyYWNrZXIgJiZcbiAgICAgICAgICAhcGx1Z2luT3B0aW9ucy5ub29wVHlwZVNjcmlwdENvbXBpbGF0aW9uXG4gICAgICAgICkge1xuICAgICAgICAgIC8vIFRPRE86IERpZmZlcmVudGlhdGUgYmV0d2VlbiBjaGFuZ2VkIGlucHV0IGZpbGVzIGFuZCBzdGFsZSBvdXRwdXQgZmlsZXNcbiAgICAgICAgICBtb2RpZmllZEZpbGVzID0gcmVmZXJlbmNlZEZpbGVUcmFja2VyLnVwZGF0ZShwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZS5tb2RpZmllZEZpbGVzKTtcbiAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZS5pbnZhbGlkYXRlKG1vZGlmaWVkRmlsZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ3JlYXRlIEFuZ3VsYXIgY29tcGlsZXIgaG9zdCBvcHRpb25zXG4gICAgICAgIGNvbnN0IGhvc3RPcHRpb25zOiBBbmd1bGFySG9zdE9wdGlvbnMgPSB7XG4gICAgICAgICAgZmlsZVJlcGxhY2VtZW50czogcGx1Z2luT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzLFxuICAgICAgICAgIG1vZGlmaWVkRmlsZXMsXG4gICAgICAgICAgc291cmNlRmlsZUNhY2hlOiBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZSxcbiAgICAgICAgICBhc3luYyB0cmFuc2Zvcm1TdHlsZXNoZWV0KGRhdGEsIGNvbnRhaW5pbmdGaWxlLCBzdHlsZXNoZWV0RmlsZSkge1xuICAgICAgICAgICAgbGV0IHN0eWxlc2hlZXRSZXN1bHQ7XG5cbiAgICAgICAgICAgIC8vIFN0eWxlc2hlZXQgZmlsZSBvbmx5IGV4aXN0cyBmb3IgZXh0ZXJuYWwgc3R5bGVzaGVldHNcbiAgICAgICAgICAgIGlmIChzdHlsZXNoZWV0RmlsZSkge1xuICAgICAgICAgICAgICBzdHlsZXNoZWV0UmVzdWx0ID0gYXdhaXQgc3R5bGVzaGVldEJ1bmRsZXIuYnVuZGxlRmlsZShzdHlsZXNoZWV0RmlsZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzdHlsZXNoZWV0UmVzdWx0ID0gYXdhaXQgc3R5bGVzaGVldEJ1bmRsZXIuYnVuZGxlSW5saW5lKFxuICAgICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgICAgY29udGFpbmluZ0ZpbGUsXG4gICAgICAgICAgICAgICAgc3R5bGVPcHRpb25zLmlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHsgY29udGVudHMsIHJlc291cmNlRmlsZXMsIHJlZmVyZW5jZWRGaWxlcywgZXJyb3JzLCB3YXJuaW5ncyB9ID0gc3R5bGVzaGVldFJlc3VsdDtcbiAgICAgICAgICAgIGlmIChlcnJvcnMpIHtcbiAgICAgICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaCguLi53YXJuaW5ncyk7XG4gICAgICAgICAgICBhZGRpdGlvbmFsUmVzdWx0cy5zZXQoc3R5bGVzaGVldEZpbGUgPz8gY29udGFpbmluZ0ZpbGUsIHtcbiAgICAgICAgICAgICAgb3V0cHV0RmlsZXM6IHJlc291cmNlRmlsZXMsXG4gICAgICAgICAgICAgIG1ldGFmaWxlOiBzdHlsZXNoZWV0UmVzdWx0Lm1ldGFmaWxlLFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmIChyZWZlcmVuY2VkRmlsZXMpIHtcbiAgICAgICAgICAgICAgcmVmZXJlbmNlZEZpbGVUcmFja2VyLmFkZChjb250YWluaW5nRmlsZSwgcmVmZXJlbmNlZEZpbGVzKTtcbiAgICAgICAgICAgICAgaWYgKHN0eWxlc2hlZXRGaWxlKSB7XG4gICAgICAgICAgICAgICAgLy8gQW5ndWxhciBBT1QgY29tcGlsZXIgbmVlZHMgbW9kaWZpZWQgZGlyZWN0IHJlc291cmNlIGZpbGVzIHRvIGNvcnJlY3RseSBpbnZhbGlkYXRlIGl0cyBhbmFseXNpc1xuICAgICAgICAgICAgICAgIHJlZmVyZW5jZWRGaWxlVHJhY2tlci5hZGQoc3R5bGVzaGVldEZpbGUsIHJlZmVyZW5jZWRGaWxlcyk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGNvbnRlbnRzO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgcHJvY2Vzc1dlYldvcmtlcih3b3JrZXJGaWxlLCBjb250YWluaW5nRmlsZSkge1xuICAgICAgICAgICAgY29uc3QgZnVsbFdvcmtlclBhdGggPSBwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKGNvbnRhaW5pbmdGaWxlKSwgd29ya2VyRmlsZSk7XG4gICAgICAgICAgICAvLyBUaGUgc3luY2hyb25vdXMgQVBJIG11c3QgYmUgdXNlZCBkdWUgdG8gdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gY3VycmVudGx5IGJlaW5nXG4gICAgICAgICAgICAvLyBmdWxseSBzeW5jaHJvbm91cyBhbmQgdGhpcyBwcm9jZXNzIGNhbGxiYWNrIGJlaW5nIGNhbGxlZCBmcm9tIHdpdGhpbiBhIFR5cGVTY3JpcHRcbiAgICAgICAgICAgIC8vIHRyYW5zZm9ybWVyLlxuICAgICAgICAgICAgY29uc3Qgd29ya2VyUmVzdWx0ID0gYnVuZGxlV2ViV29ya2VyKGJ1aWxkLCBwbHVnaW5PcHRpb25zLCBmdWxsV29ya2VyUGF0aCk7XG5cbiAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLndvcmtlclJlc3VsdC53YXJuaW5ncyk7XG4gICAgICAgICAgICBpZiAod29ya2VyUmVzdWx0LmVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaCguLi53b3JrZXJSZXN1bHQuZXJyb3JzKTtcbiAgICAgICAgICAgICAgLy8gVHJhY2sgd29ya2VyIGZpbGUgZXJyb3JzIHRvIGFsbG93IHJlYnVpbGRzIG9uIGNoYW5nZXNcbiAgICAgICAgICAgICAgcmVmZXJlbmNlZEZpbGVUcmFja2VyLmFkZChcbiAgICAgICAgICAgICAgICBjb250YWluaW5nRmlsZSxcbiAgICAgICAgICAgICAgICB3b3JrZXJSZXN1bHQuZXJyb3JzXG4gICAgICAgICAgICAgICAgICAubWFwKChlcnJvcikgPT4gZXJyb3IubG9jYXRpb24/LmZpbGUpXG4gICAgICAgICAgICAgICAgICAuZmlsdGVyKChmaWxlKTogZmlsZSBpcyBzdHJpbmcgPT4gISFmaWxlKVxuICAgICAgICAgICAgICAgICAgLm1hcCgoZmlsZSkgPT4gcGF0aC5qb2luKGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIgPz8gJycsIGZpbGUpKSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgYWRkaXRpb25hbFJlc3VsdHMuc2V0KGZ1bGxXb3JrZXJQYXRoLCB7IGVycm9yczogcmVzdWx0LmVycm9ycyB9KTtcblxuICAgICAgICAgICAgICAvLyBSZXR1cm4gdGhlIG9yaWdpbmFsIHBhdGggaWYgdGhlIGJ1aWxkIGZhaWxlZFxuICAgICAgICAgICAgICByZXR1cm4gd29ya2VyRmlsZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXNzZXJ0KCdvdXRwdXRGaWxlcycgaW4gd29ya2VyUmVzdWx0LCAnSW52YWxpZCB3ZWIgd29ya2VyIGJ1bmRsZSByZXN1bHQuJyk7XG4gICAgICAgICAgICBhZGRpdGlvbmFsUmVzdWx0cy5zZXQoZnVsbFdvcmtlclBhdGgsIHtcbiAgICAgICAgICAgICAgb3V0cHV0RmlsZXM6IHdvcmtlclJlc3VsdC5vdXRwdXRGaWxlcyxcbiAgICAgICAgICAgICAgbWV0YWZpbGU6IHdvcmtlclJlc3VsdC5tZXRhZmlsZSxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZWZlcmVuY2VkRmlsZVRyYWNrZXIuYWRkKFxuICAgICAgICAgICAgICBjb250YWluaW5nRmlsZSxcbiAgICAgICAgICAgICAgT2JqZWN0LmtleXMod29ya2VyUmVzdWx0Lm1ldGFmaWxlLmlucHV0cykubWFwKChpbnB1dCkgPT5cbiAgICAgICAgICAgICAgICBwYXRoLmpvaW4oYnVpbGQuaW5pdGlhbE9wdGlvbnMuYWJzV29ya2luZ0RpciA/PyAnJywgaW5wdXQpLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gUmV0dXJuIGJ1bmRsZWQgd29ya2VyIGZpbGUgZW50cnkgbmFtZSB0byBiZSB1c2VkIGluIHRoZSBidWlsdCBvdXRwdXRcbiAgICAgICAgICAgIGNvbnN0IHdvcmtlckNvZGVGaWxlID0gd29ya2VyUmVzdWx0Lm91dHB1dEZpbGVzLmZpbmQoKGZpbGUpID0+XG4gICAgICAgICAgICAgIGZpbGUucGF0aC5lbmRzV2l0aCgnLmpzJyksXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYXNzZXJ0KHdvcmtlckNvZGVGaWxlLCAnV2ViIFdvcmtlciBidW5kbGVkIGNvZGUgZmlsZSBzaG91bGQgYWx3YXlzIGJlIHByZXNlbnQuJyk7XG5cbiAgICAgICAgICAgIHJldHVybiBwYXRoLnJlbGF0aXZlKGJ1aWxkLmluaXRpYWxPcHRpb25zLm91dGRpciA/PyAnJywgd29ya2VyQ29kZUZpbGUucGF0aCk7XG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHRoZSBBbmd1bGFyIGNvbXBpbGF0aW9uIGZvciB0aGUgY3VycmVudCBidWlsZC5cbiAgICAgICAgLy8gSW4gd2F0Y2ggbW9kZSwgcHJldmlvdXMgYnVpbGQgc3RhdGUgd2lsbCBiZSByZXVzZWQuXG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICBjb21waWxlck9wdGlvbnM6IHsgYWxsb3dKcyB9LFxuICAgICAgICAgIHJlZmVyZW5jZWRGaWxlcyxcbiAgICAgICAgfSA9IGF3YWl0IGNvbXBpbGF0aW9uLmluaXRpYWxpemUodHNjb25maWdQYXRoLCBob3N0T3B0aW9ucywgKGNvbXBpbGVyT3B0aW9ucykgPT4ge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCA8IHRzLlNjcmlwdFRhcmdldC5FUzIwMjJcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIC8vIElmICd1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkcycgaXMgYWxyZWFkeSBkZWZpbmVkIGluIHRoZSB1c2VycyBwcm9qZWN0IGxlYXZlIHRoZSB2YWx1ZSBhcyBpcy5cbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSBmYWxsYmFjayB0byBmYWxzZSBkdWUgdG8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy80NTk5NVxuICAgICAgICAgICAgLy8gd2hpY2ggYnJlYWtzIHRoZSBkZXByZWNhdGVkIGBARWZmZWN0c2AgTkdSWCBkZWNvcmF0b3IgYW5kIHBvdGVudGlhbGx5IG90aGVyIGV4aXN0aW5nIGNvZGUgYXMgd2VsbC5cbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPSB0cy5TY3JpcHRUYXJnZXQuRVMyMDIyO1xuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnVzZURlZmluZUZvckNsYXNzRmllbGRzID8/PSBmYWxzZTtcblxuICAgICAgICAgICAgLy8gT25seSBhZGQgdGhlIHdhcm5pbmcgb24gdGhlIGluaXRpYWwgYnVpbGRcbiAgICAgICAgICAgIHNldHVwV2FybmluZ3M/LnB1c2goe1xuICAgICAgICAgICAgICB0ZXh0OlxuICAgICAgICAgICAgICAgICdUeXBlU2NyaXB0IGNvbXBpbGVyIG9wdGlvbnMgXCJ0YXJnZXRcIiBhbmQgXCJ1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkc1wiIGFyZSBzZXQgdG8gXCJFUzIwMjJcIiBhbmQgJyArXG4gICAgICAgICAgICAgICAgJ1wiZmFsc2VcIiByZXNwZWN0aXZlbHkgYnkgdGhlIEFuZ3VsYXIgQ0xJLicsXG4gICAgICAgICAgICAgIGxvY2F0aW9uOiB7IGZpbGU6IHBsdWdpbk9wdGlvbnMudHNjb25maWcgfSxcbiAgICAgICAgICAgICAgbm90ZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB0ZXh0OlxuICAgICAgICAgICAgICAgICAgICAnVG8gY29udHJvbCBFQ01BIHZlcnNpb24gYW5kIGZlYXR1cmVzIHVzZSB0aGUgQnJvd2Vyc2xpc3QgY29uZmlndXJhdGlvbi4gJyArXG4gICAgICAgICAgICAgICAgICAgICdGb3IgbW9yZSBpbmZvcm1hdGlvbiwgc2VlIGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS9idWlsZCNjb25maWd1cmluZy1icm93c2VyLWNvbXBhdGliaWxpdHknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBFbmFibGUgaW5jcmVtZW50YWwgY29tcGlsYXRpb24gYnkgZGVmYXVsdCBpZiBjYWNoaW5nIGlzIGVuYWJsZWRcbiAgICAgICAgICBpZiAocGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LnBlcnNpc3RlbnRDYWNoZVBhdGgpIHtcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy5pbmNyZW1lbnRhbCA/Pz0gdHJ1ZTtcbiAgICAgICAgICAgIC8vIFNldCB0aGUgYnVpbGQgaW5mbyBmaWxlIGxvY2F0aW9uIHRvIHRoZSBjb25maWd1cmVkIGNhY2hlIGRpcmVjdG9yeVxuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnRzQnVpbGRJbmZvRmlsZSA9IHBhdGguam9pbihcbiAgICAgICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LnBlcnNpc3RlbnRDYWNoZVBhdGgsXG4gICAgICAgICAgICAgICcudHNidWlsZGluZm8nLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLmluY3JlbWVudGFsID0gZmFsc2U7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLmNvbXBpbGVyT3B0aW9ucyxcbiAgICAgICAgICAgIG5vRW1pdE9uRXJyb3I6IGZhbHNlLFxuICAgICAgICAgICAgaW5saW5lU291cmNlczogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgICBpbmxpbmVTb3VyY2VNYXA6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgICAgbWFwUm9vdDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgc291cmNlUm9vdDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgICAgc2hvdWxkVHNJZ25vcmVKcyA9ICFhbGxvd0pzO1xuXG4gICAgICAgIGlmIChjb21waWxhdGlvbiBpbnN0YW5jZW9mIE5vb3BDb21waWxhdGlvbikge1xuICAgICAgICAgIGF3YWl0IHNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZS53YWl0VW50aWxSZWFkeTtcblxuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkaWFnbm9zdGljcyA9IGF3YWl0IGNvbXBpbGF0aW9uLmRpYWdub3NlRmlsZXMoKTtcbiAgICAgICAgaWYgKGRpYWdub3N0aWNzLmVycm9ycykge1xuICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaCguLi5kaWFnbm9zdGljcy5lcnJvcnMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkaWFnbm9zdGljcy53YXJuaW5ncykge1xuICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLmRpYWdub3N0aWNzLndhcm5pbmdzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwZGF0ZSBUeXBlU2NyaXB0IGZpbGUgb3V0cHV0IGNhY2hlIGZvciBhbGwgYWZmZWN0ZWQgZmlsZXNcbiAgICAgICAgcHJvZmlsZVN5bmMoJ05HX0VNSVRfVFMnLCAoKSA9PiB7XG4gICAgICAgICAgZm9yIChjb25zdCB7IGZpbGVuYW1lLCBjb250ZW50cyB9IG9mIGNvbXBpbGF0aW9uLmVtaXRBZmZlY3RlZEZpbGVzKCkpIHtcbiAgICAgICAgICAgIHR5cGVTY3JpcHRGaWxlQ2FjaGUuc2V0KHBhdGhUb0ZpbGVVUkwoZmlsZW5hbWUpLmhyZWYsIGNvbnRlbnRzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZCBlcnJvcnMgZnJvbSBmYWlsZWQgYWRkaXRpb25hbCByZXN1bHRzLlxuICAgICAgICAvLyBUaGlzIG11c3QgYmUgZG9uZSBhZnRlciBlbWl0IHRvIGNhcHR1cmUgbGF0ZXN0IHdlYiB3b3JrZXIgcmVzdWx0cy5cbiAgICAgICAgZm9yIChjb25zdCB7IGVycm9ycyB9IG9mIGFkZGl0aW9uYWxSZXN1bHRzLnZhbHVlcygpKSB7XG4gICAgICAgICAgaWYgKGVycm9ycykge1xuICAgICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3RvcmUgcmVmZXJlbmNlZCBmaWxlcyBmb3IgdXBkYXRlZCBmaWxlIHdhdGNoaW5nIGlmIGVuYWJsZWRcbiAgICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlKSB7XG4gICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUucmVmZXJlbmNlZEZpbGVzID0gW1xuICAgICAgICAgICAgLi4ucmVmZXJlbmNlZEZpbGVzLFxuICAgICAgICAgICAgLi4ucmVmZXJlbmNlZEZpbGVUcmFja2VyLnJlZmVyZW5jZWRGaWxlcyxcbiAgICAgICAgICBdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzZXQgdGhlIHNldHVwIHdhcm5pbmdzIHNvIHRoYXQgdGhleSBhcmUgb25seSBzaG93biBkdXJpbmcgdGhlIGZpcnN0IGJ1aWxkLlxuICAgICAgICBzZXR1cFdhcm5pbmdzID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIHNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZS5tYXJrQXNSZWFkeSgpO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9banRdc3g/JC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cz8uW2FyZ3MucGF0aF0gPz8gYXJncy5wYXRoO1xuXG4gICAgICAgIC8vIFNraXAgVFMgbG9hZCBhdHRlbXB0IGlmIEpTIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gbm90IGVuYWJsZWQgYW5kIGZpbGUgaXMgSlNcbiAgICAgICAgaWYgKHNob3VsZFRzSWdub3JlSnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KHJlcXVlc3QpKSB7XG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBmaWxlbmFtZSBpcyBjdXJyZW50bHkgdXNlZCBhcyBhIGNhY2hlIGtleS4gU2luY2UgdGhlIGNhY2hlIGlzIG1lbW9yeSBvbmx5LFxuICAgICAgICAvLyB0aGUgb3B0aW9ucyBjYW5ub3QgY2hhbmdlIGFuZCBkbyBub3QgbmVlZCB0byBiZSByZXByZXNlbnRlZCBpbiB0aGUga2V5LiBJZiB0aGVcbiAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAvLyB3b3VsZCBuZWVkIHRvIGJlIGFkZGVkIHRvIHRoZSBrZXkgYXMgd2VsbCBhcyBhIGNoZWNrIGZvciBhbnkgY2hhbmdlIG9mIGNvbnRlbnQuXG4gICAgICAgIGxldCBjb250ZW50cyA9IHR5cGVTY3JpcHRGaWxlQ2FjaGUuZ2V0KHBhdGhUb0ZpbGVVUkwocmVxdWVzdCkuaHJlZik7XG5cbiAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBObyBUUyByZXN1bHQgaW5kaWNhdGVzIHRoZSBmaWxlIGlzIG5vdCBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0uXG4gICAgICAgICAgLy8gSWYgYWxsb3dKcyBpcyBlbmFibGVkIGFuZCB0aGUgZmlsZSBpcyBKUyB0aGVuIGRlZmVyIHRvIHRoZSBuZXh0IGxvYWQgaG9vay5cbiAgICAgICAgICBpZiAoIXNob3VsZFRzSWdub3JlSnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KHJlcXVlc3QpKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE90aGVyd2lzZSByZXR1cm4gYW4gZXJyb3JcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgIGNyZWF0ZU1pc3NpbmdGaWxlRXJyb3IocmVxdWVzdCwgYXJncy5wYXRoLCBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyID8/ICcnKSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY29udGVudHMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgLy8gQSBzdHJpbmcgaW5kaWNhdGVzIHVudHJhbnNmb3JtZWQgb3V0cHV0IGZyb20gdGhlIFRTL05HIGNvbXBpbGVyXG4gICAgICAgICAgY29udGVudHMgPSBhd2FpdCBqYXZhc2NyaXB0VHJhbnNmb3JtZXIudHJhbnNmb3JtRGF0YShcbiAgICAgICAgICAgIHJlcXVlc3QsXG4gICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgIHRydWUgLyogc2tpcExpbmtlciAqLyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgLy8gU3RvcmUgYXMgdGhlIHJldHVybmVkIFVpbnQ4QXJyYXkgdG8gYWxsb3cgY2FjaGluZyB0aGUgZnVsbHkgdHJhbnNmb3JtZWQgY29kZVxuICAgICAgICAgIHR5cGVTY3JpcHRGaWxlQ2FjaGUuc2V0KHBhdGhUb0ZpbGVVUkwocmVxdWVzdCkuaHJlZiwgY29udGVudHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9qcyQvIH0sIChhcmdzKSA9PlxuICAgICAgICBwcm9maWxlQXN5bmMoXG4gICAgICAgICAgJ05HX0VNSVRfSlMqJyxcbiAgICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAvLyBUaGUgZmlsZW5hbWUgaXMgY3VycmVudGx5IHVzZWQgYXMgYSBjYWNoZSBrZXkuIFNpbmNlIHRoZSBjYWNoZSBpcyBtZW1vcnkgb25seSxcbiAgICAgICAgICAgIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAgICAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAgICAgLy8gd291bGQgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUga2V5IGFzIHdlbGwgYXMgYSBjaGVjayBmb3IgYW55IGNoYW5nZSBvZiBjb250ZW50LlxuICAgICAgICAgICAgbGV0IGNvbnRlbnRzID0gcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LmJhYmVsRmlsZUNhY2hlLmdldChhcmdzLnBhdGgpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgY29udGVudHMgPSBhd2FpdCBqYXZhc2NyaXB0VHJhbnNmb3JtZXIudHJhbnNmb3JtRmlsZShhcmdzLnBhdGgsIHBsdWdpbk9wdGlvbnMuaml0KTtcbiAgICAgICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LmJhYmVsRmlsZUNhY2hlLnNldChhcmdzLnBhdGgsIGNvbnRlbnRzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgY29udGVudHMsXG4gICAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSxcbiAgICAgICAgICB0cnVlLFxuICAgICAgICApLFxuICAgICAgKTtcblxuICAgICAgLy8gU2V0dXAgYnVuZGxpbmcgb2YgY29tcG9uZW50IHRlbXBsYXRlcyBhbmQgc3R5bGVzaGVldHMgd2hlbiBpbiBKSVQgbW9kZVxuICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuaml0KSB7XG4gICAgICAgIHNldHVwSml0UGx1Z2luQ2FsbGJhY2tzKFxuICAgICAgICAgIGJ1aWxkLFxuICAgICAgICAgIHN0eWxlc2hlZXRCdW5kbGVyLFxuICAgICAgICAgIGFkZGl0aW9uYWxSZXN1bHRzLFxuICAgICAgICAgIHN0eWxlT3B0aW9ucy5pbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBidWlsZC5vbkVuZCgocmVzdWx0KSA9PiB7XG4gICAgICAgIGZvciAoY29uc3QgeyBvdXRwdXRGaWxlcywgbWV0YWZpbGUgfSBvZiBhZGRpdGlvbmFsUmVzdWx0cy52YWx1ZXMoKSkge1xuICAgICAgICAgIC8vIEFkZCBhbnkgYWRkaXRpb25hbCBvdXRwdXQgZmlsZXMgdG8gdGhlIG1haW4gb3V0cHV0IGZpbGVzXG4gICAgICAgICAgaWYgKG91dHB1dEZpbGVzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJlc3VsdC5vdXRwdXRGaWxlcz8ucHVzaCguLi5vdXRwdXRGaWxlcyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQ29tYmluZSBhZGRpdGlvbmFsIG1ldGFmaWxlcyB3aXRoIG1haW4gbWV0YWZpbGVcbiAgICAgICAgICBpZiAocmVzdWx0Lm1ldGFmaWxlICYmIG1ldGFmaWxlKSB7XG4gICAgICAgICAgICByZXN1bHQubWV0YWZpbGUuaW5wdXRzID0geyAuLi5yZXN1bHQubWV0YWZpbGUuaW5wdXRzLCAuLi5tZXRhZmlsZS5pbnB1dHMgfTtcbiAgICAgICAgICAgIHJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzID0geyAuLi5yZXN1bHQubWV0YWZpbGUub3V0cHV0cywgLi4ubWV0YWZpbGUub3V0cHV0cyB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxvZ0N1bXVsYXRpdmVEdXJhdGlvbnMoKTtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkRpc3Bvc2UoKCkgPT4ge1xuICAgICAgICBzaGFyZWRUU0NvbXBpbGF0aW9uU3RhdGU/LmRpc3Bvc2UoKTtcbiAgICAgICAgdm9pZCBzdHlsZXNoZWV0QnVuZGxlci5kaXNwb3NlKCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBidW5kbGVXZWJXb3JrZXIoXG4gIGJ1aWxkOiBQbHVnaW5CdWlsZCxcbiAgcGx1Z2luT3B0aW9uczogQ29tcGlsZXJQbHVnaW5PcHRpb25zLFxuICB3b3JrZXJGaWxlOiBzdHJpbmcsXG4pIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYnVpbGQuZXNidWlsZC5idWlsZFN5bmMoe1xuICAgICAgcGxhdGZvcm06ICdicm93c2VyJyxcbiAgICAgIHdyaXRlOiBmYWxzZSxcbiAgICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgICAgZm9ybWF0OiAnZXNtJyxcbiAgICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgICBsb2dMZXZlbDogJ3NpbGVudCcsXG4gICAgICBzb3VyY2VtYXA6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgZW50cnlOYW1lczogJ3dvcmtlci1baGFzaF0nLFxuICAgICAgZW50cnlQb2ludHM6IFt3b3JrZXJGaWxlXSxcbiAgICAgIGFic1dvcmtpbmdEaXI6IGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIsXG4gICAgICBvdXRkaXI6IGJ1aWxkLmluaXRpYWxPcHRpb25zLm91dGRpcixcbiAgICAgIG1pbmlmeUlkZW50aWZpZXJzOiBidWlsZC5pbml0aWFsT3B0aW9ucy5taW5pZnlJZGVudGlmaWVycyxcbiAgICAgIG1pbmlmeVN5bnRheDogYnVpbGQuaW5pdGlhbE9wdGlvbnMubWluaWZ5U3ludGF4LFxuICAgICAgbWluaWZ5V2hpdGVzcGFjZTogYnVpbGQuaW5pdGlhbE9wdGlvbnMubWluaWZ5V2hpdGVzcGFjZSxcbiAgICAgIHRhcmdldDogYnVpbGQuaW5pdGlhbE9wdGlvbnMudGFyZ2V0LFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvciAmJiB0eXBlb2YgZXJyb3IgPT09ICdvYmplY3QnICYmICdlcnJvcnMnIGluIGVycm9yICYmICd3YXJuaW5ncycgaW4gZXJyb3IpIHtcbiAgICAgIHJldHVybiBlcnJvciBhcyBCdWlsZEZhaWx1cmU7XG4gICAgfVxuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU1pc3NpbmdGaWxlRXJyb3IocmVxdWVzdDogc3RyaW5nLCBvcmlnaW5hbDogc3RyaW5nLCByb290OiBzdHJpbmcpOiBQYXJ0aWFsTWVzc2FnZSB7XG4gIGNvbnN0IGVycm9yID0ge1xuICAgIHRleHQ6IGBGaWxlICcke3BhdGgucmVsYXRpdmUocm9vdCwgcmVxdWVzdCl9JyBpcyBtaXNzaW5nIGZyb20gdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24uYCxcbiAgICBub3RlczogW1xuICAgICAge1xuICAgICAgICB0ZXh0OiBgRW5zdXJlIHRoZSBmaWxlIGlzIHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvZ3JhbSB2aWEgdGhlICdmaWxlcycgb3IgJ2luY2x1ZGUnIHByb3BlcnR5LmAsXG4gICAgICB9LFxuICAgIF0sXG4gIH07XG5cbiAgaWYgKHJlcXVlc3QgIT09IG9yaWdpbmFsKSB7XG4gICAgZXJyb3Iubm90ZXMucHVzaCh7XG4gICAgICB0ZXh0OiBgRmlsZSBpcyByZXF1ZXN0ZWQgZnJvbSBhIGZpbGUgcmVwbGFjZW1lbnQgb2YgJyR7cGF0aC5yZWxhdGl2ZShyb290LCBvcmlnaW5hbCl9Jy5gLFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIGVycm9yO1xufVxuIl19