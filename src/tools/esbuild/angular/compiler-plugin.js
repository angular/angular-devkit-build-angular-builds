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
                : await (0, compilation_1.createAngularCompilation)(!!pluginOptions.jit);
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
                if (!pluginOptions.noopTypeScriptCompilation &&
                    compilation.update &&
                    pluginOptions.sourceFileCache?.modifiedFiles.size) {
                    await compilation.update(modifiedFiles ?? pluginOptions.sourceFileCache.modifiedFiles);
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
                await (0, profiling_1.profileAsync)('NG_EMIT_TS', async () => {
                    for (const { filename, contents } of await compilation.emitAffectedFiles()) {
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
                void compilation.close?.();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVdILDhEQUFpQztBQUNqQywrQ0FBNEM7QUFDNUMsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUN6Qyw0REFBNEI7QUFDNUIsNEVBQWdFO0FBQ2hFLHNFQUFrRTtBQUVsRSw0Q0FBOEY7QUFHOUYsK0NBQThGO0FBQzlGLDJEQUEwRjtBQUMxRixtRUFBcUU7QUFDckUscUVBQWdFO0FBQ2hFLGlFQUFpRTtBQWlCakUsa0RBQWtEO0FBQ2xELFNBQWdCLG9CQUFvQixDQUNsQyxhQUFvQyxFQUNwQyxZQUF1RTtJQUV2RSxPQUFPO1FBQ0wsSUFBSSxFQUFFLGtCQUFrQjtRQUN4QixrREFBa0Q7UUFDbEQsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFrQjtZQUM1QixJQUFJLGFBQWEsR0FBaUMsRUFBRSxDQUFDO1lBQ3JELE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQztZQUUvRCxJQUFJLFlBQVksR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDO1lBQzFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtnQkFDckIsZ0VBQWdFO2dCQUNoRSx5RkFBeUY7Z0JBQ3pGLElBQUk7b0JBQ0YsWUFBWSxHQUFHLE1BQU0sSUFBQSxtQkFBUSxFQUFDLFlBQVksQ0FBQyxDQUFDO2lCQUM3QztnQkFBQyxNQUFNLEdBQUU7YUFDWDtZQUVELDBEQUEwRDtZQUMxRCxNQUFNLHFCQUFxQixHQUFHLElBQUksOENBQXFCLENBQUMsYUFBYSxFQUFFLGdDQUFVLENB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QUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNmLElBQUksRUFBRSxpREFBaUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUk7U0FDekYsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBCdWlsZEZhaWx1cmUsXG4gIE1ldGFmaWxlLFxuICBPblN0YXJ0UmVzdWx0LFxuICBPdXRwdXRGaWxlLFxuICBQYXJ0aWFsTWVzc2FnZSxcbiAgUGx1Z2luLFxuICBQbHVnaW5CdWlsZCxcbn0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IHJlYWxwYXRoIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBwYXRoVG9GaWxlVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHsgbWF4V29ya2VycyB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgSmF2YVNjcmlwdFRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vamF2YXNjcmlwdC10cmFuc2Zvcm1lcic7XG5pbXBvcnQgeyBMb2FkUmVzdWx0Q2FjaGUgfSBmcm9tICcuLi9sb2FkLXJlc3VsdC1jYWNoZSc7XG5pbXBvcnQgeyBsb2dDdW11bGF0aXZlRHVyYXRpb25zLCBwcm9maWxlQXN5bmMsIHJlc2V0Q3VtdWxhdGl2ZUR1cmF0aW9ucyB9IGZyb20gJy4uL3Byb2ZpbGluZyc7XG5pbXBvcnQgeyBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyB9IGZyb20gJy4uL3N0eWxlc2hlZXRzL2J1bmRsZS1vcHRpb25zJztcbmltcG9ydCB7IEFuZ3VsYXJIb3N0T3B0aW9ucyB9IGZyb20gJy4vYW5ndWxhci1ob3N0JztcbmltcG9ydCB7IEFuZ3VsYXJDb21waWxhdGlvbiwgTm9vcENvbXBpbGF0aW9uLCBjcmVhdGVBbmd1bGFyQ29tcGlsYXRpb24gfSBmcm9tICcuL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7IFNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZSwgZ2V0U2hhcmVkQ29tcGlsYXRpb25TdGF0ZSB9IGZyb20gJy4vY29tcGlsYXRpb24tc3RhdGUnO1xuaW1wb3J0IHsgQ29tcG9uZW50U3R5bGVzaGVldEJ1bmRsZXIgfSBmcm9tICcuL2NvbXBvbmVudC1zdHlsZXNoZWV0cyc7XG5pbXBvcnQgeyBGaWxlUmVmZXJlbmNlVHJhY2tlciB9IGZyb20gJy4vZmlsZS1yZWZlcmVuY2UtdHJhY2tlcic7XG5pbXBvcnQgeyBzZXR1cEppdFBsdWdpbkNhbGxiYWNrcyB9IGZyb20gJy4vaml0LXBsdWdpbi1jYWxsYmFja3MnO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlIH0gZnJvbSAnLi9zb3VyY2UtZmlsZS1jYWNoZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZXJQbHVnaW5PcHRpb25zIHtcbiAgc291cmNlbWFwOiBib29sZWFuO1xuICB0c2NvbmZpZzogc3RyaW5nO1xuICBqaXQ/OiBib29sZWFuO1xuICAvKiogU2tpcCBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uIHNldHVwLiBUaGlzIGlzIHVzZWZ1bCB0byByZS11c2UgdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gZnJvbSBhbm90aGVyIHBsdWdpbi4gKi9cbiAgbm9vcFR5cGVTY3JpcHRDb21waWxhdGlvbj86IGJvb2xlYW47XG4gIGFkdmFuY2VkT3B0aW1pemF0aW9ucz86IGJvb2xlYW47XG4gIHRoaXJkUGFydHlTb3VyY2VtYXBzPzogYm9vbGVhbjtcbiAgZmlsZVJlcGxhY2VtZW50cz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZTtcbiAgbG9hZFJlc3VsdENhY2hlPzogTG9hZFJlc3VsdENhY2hlO1xuICBpbmNyZW1lbnRhbDogYm9vbGVhbjtcbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgcGx1Z2luT3B0aW9uczogQ29tcGlsZXJQbHVnaW5PcHRpb25zLFxuICBzdHlsZU9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zICYgeyBpbmxpbmVTdHlsZUxhbmd1YWdlOiBzdHJpbmcgfSxcbik6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItY29tcGlsZXInLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG4gICAgYXN5bmMgc2V0dXAoYnVpbGQ6IFBsdWdpbkJ1aWxkKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICBsZXQgc2V0dXBXYXJuaW5nczogUGFydGlhbE1lc3NhZ2VbXSB8IHVuZGVmaW5lZCA9IFtdO1xuICAgICAgY29uc3QgcHJlc2VydmVTeW1saW5rcyA9IGJ1aWxkLmluaXRpYWxPcHRpb25zLnByZXNlcnZlU3ltbGlua3M7XG5cbiAgICAgIGxldCB0c2NvbmZpZ1BhdGggPSBwbHVnaW5PcHRpb25zLnRzY29uZmlnO1xuICAgICAgaWYgKCFwcmVzZXJ2ZVN5bWxpbmtzKSB7XG4gICAgICAgIC8vIFVzZSB0aGUgcmVhbCBwYXRoIG9mIHRoZSB0c2NvbmZpZyBpZiBub3QgcHJlc2VydmluZyBzeW1saW5rcy5cbiAgICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoZSBUUyBzb3VyY2UgZmlsZSBwYXRocyBhcmUgYmFzZWQgb24gdGhlIHJlYWwgcGF0aCBvZiB0aGUgY29uZmlndXJhdGlvbi5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0c2NvbmZpZ1BhdGggPSBhd2FpdCByZWFscGF0aCh0c2NvbmZpZ1BhdGgpO1xuICAgICAgICB9IGNhdGNoIHt9XG4gICAgICB9XG5cbiAgICAgIC8vIEluaXRpYWxpemUgYSB3b3JrZXIgcG9vbCBmb3IgSmF2YVNjcmlwdCB0cmFuc2Zvcm1hdGlvbnNcbiAgICAgIGNvbnN0IGphdmFzY3JpcHRUcmFuc2Zvcm1lciA9IG5ldyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIocGx1Z2luT3B0aW9ucywgbWF4V29ya2Vycyk7XG5cbiAgICAgIC8vIFNldHVwIGRlZmluZXMgYmFzZWQgb24gdGhlIHZhbHVlcyB1c2VkIGJ5IHRoZSBBbmd1bGFyIGNvbXBpbGVyLWNsaVxuICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lID8/PSB7fTtcbiAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLmRlZmluZVsnbmdJMThuQ2xvc3VyZU1vZGUnXSA/Pz0gJ2ZhbHNlJztcblxuICAgICAgLy8gVGhlIGluLW1lbW9yeSBjYWNoZSBvZiBUeXBlU2NyaXB0IGZpbGUgb3V0cHV0cyB3aWxsIGJlIHVzZWQgZHVyaW5nIHRoZSBidWlsZCBpbiBgb25Mb2FkYCBjYWxsYmFja3MgZm9yIFRTIGZpbGVzLlxuICAgICAgLy8gQSBzdHJpbmcgdmFsdWUgaW5kaWNhdGVzIGRpcmVjdCBUUy9ORyBvdXRwdXQgYW5kIGEgVWludDhBcnJheSBpbmRpY2F0ZXMgZnVsbHkgdHJhbnNmb3JtZWQgY29kZS5cbiAgICAgIGNvbnN0IHR5cGVTY3JpcHRGaWxlQ2FjaGUgPVxuICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8udHlwZVNjcmlwdEZpbGVDYWNoZSA/P1xuICAgICAgICBuZXcgTWFwPHN0cmluZywgc3RyaW5nIHwgVWludDhBcnJheT4oKTtcblxuICAgICAgLy8gVGhlIHJlc291cmNlcyBmcm9tIGNvbXBvbmVudCBzdHlsZXNoZWV0cyBhbmQgd2ViIHdvcmtlcnMgdGhhdCB3aWxsIGJlIGFkZGVkIHRvIHRoZSBidWlsZCByZXN1bHRzIG91dHB1dCBmaWxlc1xuICAgICAgY29uc3QgYWRkaXRpb25hbFJlc3VsdHMgPSBuZXcgTWFwPFxuICAgICAgICBzdHJpbmcsXG4gICAgICAgIHsgb3V0cHV0RmlsZXM/OiBPdXRwdXRGaWxlW107IG1ldGFmaWxlPzogTWV0YWZpbGU7IGVycm9ycz86IFBhcnRpYWxNZXNzYWdlW10gfVxuICAgICAgPigpO1xuXG4gICAgICAvLyBDcmVhdGUgbmV3IHJldXNhYmxlIGNvbXBpbGF0aW9uIGZvciB0aGUgYXBwcm9wcmlhdGUgbW9kZSBiYXNlZCBvbiB0aGUgYGppdGAgcGx1Z2luIG9wdGlvblxuICAgICAgY29uc3QgY29tcGlsYXRpb246IEFuZ3VsYXJDb21waWxhdGlvbiA9IHBsdWdpbk9wdGlvbnMubm9vcFR5cGVTY3JpcHRDb21waWxhdGlvblxuICAgICAgICA/IG5ldyBOb29wQ29tcGlsYXRpb24oKVxuICAgICAgICA6IGF3YWl0IGNyZWF0ZUFuZ3VsYXJDb21waWxhdGlvbighIXBsdWdpbk9wdGlvbnMuaml0KTtcblxuICAgICAgLy8gRGV0ZXJtaW5lcyBpZiBUeXBlU2NyaXB0IHNob3VsZCBwcm9jZXNzIEphdmFTY3JpcHQgZmlsZXMgYmFzZWQgb24gdHNjb25maWcgYGFsbG93SnNgIG9wdGlvblxuICAgICAgbGV0IHNob3VsZFRzSWdub3JlSnMgPSB0cnVlO1xuXG4gICAgICAvLyBUcmFjayBpbmNyZW1lbnRhbCBjb21wb25lbnQgc3R5bGVzaGVldCBidWlsZHNcbiAgICAgIGNvbnN0IHN0eWxlc2hlZXRCdW5kbGVyID0gbmV3IENvbXBvbmVudFN0eWxlc2hlZXRCdW5kbGVyKFxuICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICAgIHBsdWdpbk9wdGlvbnMuaW5jcmVtZW50YWwsXG4gICAgICAgIHBsdWdpbk9wdGlvbnMubG9hZFJlc3VsdENhY2hlLFxuICAgICAgKTtcbiAgICAgIGxldCBzaGFyZWRUU0NvbXBpbGF0aW9uU3RhdGU6IFNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZSB8IHVuZGVmaW5lZDtcblxuICAgICAgLy8gVG8gZnVsbHkgaW52YWxpZGF0ZSBmaWxlcywgdHJhY2sgcmVzb3VyY2UgcmVmZXJlbmNlZCBmaWxlcyBhbmQgdGhlaXIgcmVmZXJlbmNpbmcgc291cmNlXG4gICAgICBjb25zdCByZWZlcmVuY2VkRmlsZVRyYWNrZXIgPSBuZXcgRmlsZVJlZmVyZW5jZVRyYWNrZXIoKTtcblxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbiAgICAgIGJ1aWxkLm9uU3RhcnQoYXN5bmMgKCkgPT4ge1xuICAgICAgICBzaGFyZWRUU0NvbXBpbGF0aW9uU3RhdGUgPSBnZXRTaGFyZWRDb21waWxhdGlvblN0YXRlKCk7XG4gICAgICAgIGlmICghKGNvbXBpbGF0aW9uIGluc3RhbmNlb2YgTm9vcENvbXBpbGF0aW9uKSkge1xuICAgICAgICAgIHNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZS5tYXJrQXNJblByb2dyZXNzKCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZXN1bHQ6IE9uU3RhcnRSZXN1bHQgPSB7XG4gICAgICAgICAgd2FybmluZ3M6IHNldHVwV2FybmluZ3MsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gUmVzZXQgZGVidWcgcGVyZm9ybWFuY2UgdHJhY2tpbmdcbiAgICAgICAgcmVzZXRDdW11bGF0aXZlRHVyYXRpb25zKCk7XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSByZWZlcmVuY2UgdHJhY2tlciBhbmQgZ2VuZXJhdGUgYSBmdWxsIHNldCBvZiBtb2RpZmllZCBmaWxlcyBmb3IgdGhlXG4gICAgICAgIC8vIEFuZ3VsYXIgY29tcGlsZXIgd2hpY2ggZG9lcyBub3QgaGF2ZSBkaXJlY3Qga25vd2xlZGdlIG9mIHRyYW5zaXRpdmUgcmVzb3VyY2VcbiAgICAgICAgLy8gZGVwZW5kZW5jaWVzIG9yIHdlYiB3b3JrZXIgcHJvY2Vzc2luZy5cbiAgICAgICAgbGV0IG1vZGlmaWVkRmlsZXM7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8ubW9kaWZpZWRGaWxlcy5zaXplICYmXG4gICAgICAgICAgcmVmZXJlbmNlZEZpbGVUcmFja2VyICYmXG4gICAgICAgICAgIXBsdWdpbk9wdGlvbnMubm9vcFR5cGVTY3JpcHRDb21waWxhdGlvblxuICAgICAgICApIHtcbiAgICAgICAgICAvLyBUT0RPOiBEaWZmZXJlbnRpYXRlIGJldHdlZW4gY2hhbmdlZCBpbnB1dCBmaWxlcyBhbmQgc3RhbGUgb3V0cHV0IGZpbGVzXG4gICAgICAgICAgbW9kaWZpZWRGaWxlcyA9IHJlZmVyZW5jZWRGaWxlVHJhY2tlci51cGRhdGUocGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUubW9kaWZpZWRGaWxlcyk7XG4gICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUuaW52YWxpZGF0ZShtb2RpZmllZEZpbGVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAhcGx1Z2luT3B0aW9ucy5ub29wVHlwZVNjcmlwdENvbXBpbGF0aW9uICYmXG4gICAgICAgICAgY29tcGlsYXRpb24udXBkYXRlICYmXG4gICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/Lm1vZGlmaWVkRmlsZXMuc2l6ZVxuICAgICAgICApIHtcbiAgICAgICAgICBhd2FpdCBjb21waWxhdGlvbi51cGRhdGUobW9kaWZpZWRGaWxlcyA/PyBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZS5tb2RpZmllZEZpbGVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENyZWF0ZSBBbmd1bGFyIGNvbXBpbGVyIGhvc3Qgb3B0aW9uc1xuICAgICAgICBjb25zdCBob3N0T3B0aW9uczogQW5ndWxhckhvc3RPcHRpb25zID0ge1xuICAgICAgICAgIGZpbGVSZXBsYWNlbWVudHM6IHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cyxcbiAgICAgICAgICBtb2RpZmllZEZpbGVzLFxuICAgICAgICAgIHNvdXJjZUZpbGVDYWNoZTogcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUsXG4gICAgICAgICAgYXN5bmMgdHJhbnNmb3JtU3R5bGVzaGVldChkYXRhLCBjb250YWluaW5nRmlsZSwgc3R5bGVzaGVldEZpbGUpIHtcbiAgICAgICAgICAgIGxldCBzdHlsZXNoZWV0UmVzdWx0O1xuXG4gICAgICAgICAgICAvLyBTdHlsZXNoZWV0IGZpbGUgb25seSBleGlzdHMgZm9yIGV4dGVybmFsIHN0eWxlc2hlZXRzXG4gICAgICAgICAgICBpZiAoc3R5bGVzaGVldEZpbGUpIHtcbiAgICAgICAgICAgICAgc3R5bGVzaGVldFJlc3VsdCA9IGF3YWl0IHN0eWxlc2hlZXRCdW5kbGVyLmJ1bmRsZUZpbGUoc3R5bGVzaGVldEZpbGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc3R5bGVzaGVldFJlc3VsdCA9IGF3YWl0IHN0eWxlc2hlZXRCdW5kbGVyLmJ1bmRsZUlubGluZShcbiAgICAgICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgICAgIGNvbnRhaW5pbmdGaWxlLFxuICAgICAgICAgICAgICAgIHN0eWxlT3B0aW9ucy5pbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB7IGNvbnRlbnRzLCByZXNvdXJjZUZpbGVzLCByZWZlcmVuY2VkRmlsZXMsIGVycm9ycywgd2FybmluZ3MgfSA9IHN0eWxlc2hlZXRSZXN1bHQ7XG4gICAgICAgICAgICBpZiAoZXJyb3JzKSB7XG4gICAgICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaCguLi5lcnJvcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgKHJlc3VsdC53YXJuaW5ncyA/Pz0gW10pLnB1c2goLi4ud2FybmluZ3MpO1xuICAgICAgICAgICAgYWRkaXRpb25hbFJlc3VsdHMuc2V0KHN0eWxlc2hlZXRGaWxlID8/IGNvbnRhaW5pbmdGaWxlLCB7XG4gICAgICAgICAgICAgIG91dHB1dEZpbGVzOiByZXNvdXJjZUZpbGVzLFxuICAgICAgICAgICAgICBtZXRhZmlsZTogc3R5bGVzaGVldFJlc3VsdC5tZXRhZmlsZSxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAocmVmZXJlbmNlZEZpbGVzKSB7XG4gICAgICAgICAgICAgIHJlZmVyZW5jZWRGaWxlVHJhY2tlci5hZGQoY29udGFpbmluZ0ZpbGUsIHJlZmVyZW5jZWRGaWxlcyk7XG4gICAgICAgICAgICAgIGlmIChzdHlsZXNoZWV0RmlsZSkge1xuICAgICAgICAgICAgICAgIC8vIEFuZ3VsYXIgQU9UIGNvbXBpbGVyIG5lZWRzIG1vZGlmaWVkIGRpcmVjdCByZXNvdXJjZSBmaWxlcyB0byBjb3JyZWN0bHkgaW52YWxpZGF0ZSBpdHMgYW5hbHlzaXNcbiAgICAgICAgICAgICAgICByZWZlcmVuY2VkRmlsZVRyYWNrZXIuYWRkKHN0eWxlc2hlZXRGaWxlLCByZWZlcmVuY2VkRmlsZXMpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjb250ZW50cztcbiAgICAgICAgICB9LFxuICAgICAgICAgIHByb2Nlc3NXZWJXb3JrZXIod29ya2VyRmlsZSwgY29udGFpbmluZ0ZpbGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxXb3JrZXJQYXRoID0gcGF0aC5qb2luKHBhdGguZGlybmFtZShjb250YWluaW5nRmlsZSksIHdvcmtlckZpbGUpO1xuICAgICAgICAgICAgLy8gVGhlIHN5bmNocm9ub3VzIEFQSSBtdXN0IGJlIHVzZWQgZHVlIHRvIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uIGN1cnJlbnRseSBiZWluZ1xuICAgICAgICAgICAgLy8gZnVsbHkgc3luY2hyb25vdXMgYW5kIHRoaXMgcHJvY2VzcyBjYWxsYmFjayBiZWluZyBjYWxsZWQgZnJvbSB3aXRoaW4gYSBUeXBlU2NyaXB0XG4gICAgICAgICAgICAvLyB0cmFuc2Zvcm1lci5cbiAgICAgICAgICAgIGNvbnN0IHdvcmtlclJlc3VsdCA9IGJ1bmRsZVdlYldvcmtlcihidWlsZCwgcGx1Z2luT3B0aW9ucywgZnVsbFdvcmtlclBhdGgpO1xuXG4gICAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaCguLi53b3JrZXJSZXN1bHQud2FybmluZ3MpO1xuICAgICAgICAgICAgaWYgKHdvcmtlclJlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4ud29ya2VyUmVzdWx0LmVycm9ycyk7XG4gICAgICAgICAgICAgIC8vIFRyYWNrIHdvcmtlciBmaWxlIGVycm9ycyB0byBhbGxvdyByZWJ1aWxkcyBvbiBjaGFuZ2VzXG4gICAgICAgICAgICAgIHJlZmVyZW5jZWRGaWxlVHJhY2tlci5hZGQoXG4gICAgICAgICAgICAgICAgY29udGFpbmluZ0ZpbGUsXG4gICAgICAgICAgICAgICAgd29ya2VyUmVzdWx0LmVycm9yc1xuICAgICAgICAgICAgICAgICAgLm1hcCgoZXJyb3IpID0+IGVycm9yLmxvY2F0aW9uPy5maWxlKVxuICAgICAgICAgICAgICAgICAgLmZpbHRlcigoZmlsZSk6IGZpbGUgaXMgc3RyaW5nID0+ICEhZmlsZSlcbiAgICAgICAgICAgICAgICAgIC5tYXAoKGZpbGUpID0+IHBhdGguam9pbihidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyID8/ICcnLCBmaWxlKSksXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIGFkZGl0aW9uYWxSZXN1bHRzLnNldChmdWxsV29ya2VyUGF0aCwgeyBlcnJvcnM6IHJlc3VsdC5lcnJvcnMgfSk7XG5cbiAgICAgICAgICAgICAgLy8gUmV0dXJuIHRoZSBvcmlnaW5hbCBwYXRoIGlmIHRoZSBidWlsZCBmYWlsZWRcbiAgICAgICAgICAgICAgcmV0dXJuIHdvcmtlckZpbGU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFzc2VydCgnb3V0cHV0RmlsZXMnIGluIHdvcmtlclJlc3VsdCwgJ0ludmFsaWQgd2ViIHdvcmtlciBidW5kbGUgcmVzdWx0LicpO1xuICAgICAgICAgICAgYWRkaXRpb25hbFJlc3VsdHMuc2V0KGZ1bGxXb3JrZXJQYXRoLCB7XG4gICAgICAgICAgICAgIG91dHB1dEZpbGVzOiB3b3JrZXJSZXN1bHQub3V0cHV0RmlsZXMsXG4gICAgICAgICAgICAgIG1ldGFmaWxlOiB3b3JrZXJSZXN1bHQubWV0YWZpbGUsXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmVmZXJlbmNlZEZpbGVUcmFja2VyLmFkZChcbiAgICAgICAgICAgICAgY29udGFpbmluZ0ZpbGUsXG4gICAgICAgICAgICAgIE9iamVjdC5rZXlzKHdvcmtlclJlc3VsdC5tZXRhZmlsZS5pbnB1dHMpLm1hcCgoaW5wdXQpID0+XG4gICAgICAgICAgICAgICAgcGF0aC5qb2luKGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIgPz8gJycsIGlucHV0KSxcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIC8vIFJldHVybiBidW5kbGVkIHdvcmtlciBmaWxlIGVudHJ5IG5hbWUgdG8gYmUgdXNlZCBpbiB0aGUgYnVpbHQgb3V0cHV0XG4gICAgICAgICAgICBjb25zdCB3b3JrZXJDb2RlRmlsZSA9IHdvcmtlclJlc3VsdC5vdXRwdXRGaWxlcy5maW5kKChmaWxlKSA9PlxuICAgICAgICAgICAgICBmaWxlLnBhdGguZW5kc1dpdGgoJy5qcycpLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGFzc2VydCh3b3JrZXJDb2RlRmlsZSwgJ1dlYiBXb3JrZXIgYnVuZGxlZCBjb2RlIGZpbGUgc2hvdWxkIGFsd2F5cyBiZSBwcmVzZW50LicpO1xuXG4gICAgICAgICAgICByZXR1cm4gcGF0aC5yZWxhdGl2ZShidWlsZC5pbml0aWFsT3B0aW9ucy5vdXRkaXIgPz8gJycsIHdvcmtlckNvZGVGaWxlLnBhdGgpO1xuICAgICAgICAgIH0sXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSB0aGUgQW5ndWxhciBjb21waWxhdGlvbiBmb3IgdGhlIGN1cnJlbnQgYnVpbGQuXG4gICAgICAgIC8vIEluIHdhdGNoIG1vZGUsIHByZXZpb3VzIGJ1aWxkIHN0YXRlIHdpbGwgYmUgcmV1c2VkLlxuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgY29tcGlsZXJPcHRpb25zOiB7IGFsbG93SnMgfSxcbiAgICAgICAgICByZWZlcmVuY2VkRmlsZXMsXG4gICAgICAgIH0gPSBhd2FpdCBjb21waWxhdGlvbi5pbml0aWFsaXplKHRzY29uZmlnUGF0aCwgaG9zdE9wdGlvbnMsIChjb21waWxlck9wdGlvbnMpID0+IHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMudGFyZ2V0ID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPCB0cy5TY3JpcHRUYXJnZXQuRVMyMDIyXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICAvLyBJZiAndXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHMnIGlzIGFscmVhZHkgZGVmaW5lZCBpbiB0aGUgdXNlcnMgcHJvamVjdCBsZWF2ZSB0aGUgdmFsdWUgYXMgaXMuXG4gICAgICAgICAgICAvLyBPdGhlcndpc2UgZmFsbGJhY2sgdG8gZmFsc2UgZHVlIHRvIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvNDU5OTVcbiAgICAgICAgICAgIC8vIHdoaWNoIGJyZWFrcyB0aGUgZGVwcmVjYXRlZCBgQEVmZmVjdHNgIE5HUlggZGVjb3JhdG9yIGFuZCBwb3RlbnRpYWxseSBvdGhlciBleGlzdGluZyBjb2RlIGFzIHdlbGwuXG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMudGFyZ2V0ID0gdHMuU2NyaXB0VGFyZ2V0LkVTMjAyMjtcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy51c2VEZWZpbmVGb3JDbGFzc0ZpZWxkcyA/Pz0gZmFsc2U7XG5cbiAgICAgICAgICAgIC8vIE9ubHkgYWRkIHRoZSB3YXJuaW5nIG9uIHRoZSBpbml0aWFsIGJ1aWxkXG4gICAgICAgICAgICBzZXR1cFdhcm5pbmdzPy5wdXNoKHtcbiAgICAgICAgICAgICAgdGV4dDpcbiAgICAgICAgICAgICAgICAnVHlwZVNjcmlwdCBjb21waWxlciBvcHRpb25zIFwidGFyZ2V0XCIgYW5kIFwidXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHNcIiBhcmUgc2V0IHRvIFwiRVMyMDIyXCIgYW5kICcgK1xuICAgICAgICAgICAgICAgICdcImZhbHNlXCIgcmVzcGVjdGl2ZWx5IGJ5IHRoZSBBbmd1bGFyIENMSS4nLFxuICAgICAgICAgICAgICBsb2NhdGlvbjogeyBmaWxlOiBwbHVnaW5PcHRpb25zLnRzY29uZmlnIH0sXG4gICAgICAgICAgICAgIG5vdGVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgdGV4dDpcbiAgICAgICAgICAgICAgICAgICAgJ1RvIGNvbnRyb2wgRUNNQSB2ZXJzaW9uIGFuZCBmZWF0dXJlcyB1c2UgdGhlIEJyb3dlcnNsaXN0IGNvbmZpZ3VyYXRpb24uICcgK1xuICAgICAgICAgICAgICAgICAgICAnRm9yIG1vcmUgaW5mb3JtYXRpb24sIHNlZSBodHRwczovL2FuZ3VsYXIuaW8vZ3VpZGUvYnVpbGQjY29uZmlndXJpbmctYnJvd3Nlci1jb21wYXRpYmlsaXR5JyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gRW5hYmxlIGluY3JlbWVudGFsIGNvbXBpbGF0aW9uIGJ5IGRlZmF1bHQgaWYgY2FjaGluZyBpcyBlbmFibGVkXG4gICAgICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5wZXJzaXN0ZW50Q2FjaGVQYXRoKSB7XG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMuaW5jcmVtZW50YWwgPz89IHRydWU7XG4gICAgICAgICAgICAvLyBTZXQgdGhlIGJ1aWxkIGluZm8gZmlsZSBsb2NhdGlvbiB0byB0aGUgY29uZmlndXJlZCBjYWNoZSBkaXJlY3RvcnlcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy50c0J1aWxkSW5mb0ZpbGUgPSBwYXRoLmpvaW4oXG4gICAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5wZXJzaXN0ZW50Q2FjaGVQYXRoLFxuICAgICAgICAgICAgICAnLnRzYnVpbGRpbmZvJyxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy5pbmNyZW1lbnRhbCA9IGZhbHNlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5jb21waWxlck9wdGlvbnMsXG4gICAgICAgICAgICBub0VtaXRPbkVycm9yOiBmYWxzZSxcbiAgICAgICAgICAgIGlubGluZVNvdXJjZXM6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgICAgaW5saW5lU291cmNlTWFwOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIG1hcFJvb3Q6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHNvdXJjZVJvb3Q6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNob3VsZFRzSWdub3JlSnMgPSAhYWxsb3dKcztcblxuICAgICAgICBpZiAoY29tcGlsYXRpb24gaW5zdGFuY2VvZiBOb29wQ29tcGlsYXRpb24pIHtcbiAgICAgICAgICBhd2FpdCBzaGFyZWRUU0NvbXBpbGF0aW9uU3RhdGUud2FpdFVudGlsUmVhZHk7XG5cbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGlhZ25vc3RpY3MgPSBhd2FpdCBjb21waWxhdGlvbi5kaWFnbm9zZUZpbGVzKCk7XG4gICAgICAgIGlmIChkaWFnbm9zdGljcy5lcnJvcnMpIHtcbiAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZGlhZ25vc3RpY3MuZXJyb3JzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGlhZ25vc3RpY3Mud2FybmluZ3MpIHtcbiAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaCguLi5kaWFnbm9zdGljcy53YXJuaW5ncyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgVHlwZVNjcmlwdCBmaWxlIG91dHB1dCBjYWNoZSBmb3IgYWxsIGFmZmVjdGVkIGZpbGVzXG4gICAgICAgIGF3YWl0IHByb2ZpbGVBc3luYygnTkdfRU1JVF9UUycsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHsgZmlsZW5hbWUsIGNvbnRlbnRzIH0gb2YgYXdhaXQgY29tcGlsYXRpb24uZW1pdEFmZmVjdGVkRmlsZXMoKSkge1xuICAgICAgICAgICAgdHlwZVNjcmlwdEZpbGVDYWNoZS5zZXQocGF0aFRvRmlsZVVSTChmaWxlbmFtZSkuaHJlZiwgY29udGVudHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWRkIGVycm9ycyBmcm9tIGZhaWxlZCBhZGRpdGlvbmFsIHJlc3VsdHMuXG4gICAgICAgIC8vIFRoaXMgbXVzdCBiZSBkb25lIGFmdGVyIGVtaXQgdG8gY2FwdHVyZSBsYXRlc3Qgd2ViIHdvcmtlciByZXN1bHRzLlxuICAgICAgICBmb3IgKGNvbnN0IHsgZXJyb3JzIH0gb2YgYWRkaXRpb25hbFJlc3VsdHMudmFsdWVzKCkpIHtcbiAgICAgICAgICBpZiAoZXJyb3JzKSB7XG4gICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTdG9yZSByZWZlcmVuY2VkIGZpbGVzIGZvciB1cGRhdGVkIGZpbGUgd2F0Y2hpbmcgaWYgZW5hYmxlZFxuICAgICAgICBpZiAocGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUpIHtcbiAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZS5yZWZlcmVuY2VkRmlsZXMgPSBbXG4gICAgICAgICAgICAuLi5yZWZlcmVuY2VkRmlsZXMsXG4gICAgICAgICAgICAuLi5yZWZlcmVuY2VkRmlsZVRyYWNrZXIucmVmZXJlbmNlZEZpbGVzLFxuICAgICAgICAgIF07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXNldCB0aGUgc2V0dXAgd2FybmluZ3Mgc28gdGhhdCB0aGV5IGFyZSBvbmx5IHNob3duIGR1cmluZyB0aGUgZmlyc3QgYnVpbGQuXG4gICAgICAgIHNldHVwV2FybmluZ3MgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgc2hhcmVkVFNDb21waWxhdGlvblN0YXRlLm1hcmtBc1JlYWR5KCk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5bY21dP1tqdF1zeD8kLyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gcGx1Z2luT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzPy5bYXJncy5wYXRoXSA/PyBhcmdzLnBhdGg7XG5cbiAgICAgICAgLy8gU2tpcCBUUyBsb2FkIGF0dGVtcHQgaWYgSlMgVHlwZVNjcmlwdCBjb21waWxhdGlvbiBub3QgZW5hYmxlZCBhbmQgZmlsZSBpcyBKU1xuICAgICAgICBpZiAoc2hvdWxkVHNJZ25vcmVKcyAmJiAvXFwuW2NtXT9qcyQvLnRlc3QocmVxdWVzdCkpIHtcbiAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGhlIGZpbGVuYW1lIGlzIGN1cnJlbnRseSB1c2VkIGFzIGEgY2FjaGUga2V5LiBTaW5jZSB0aGUgY2FjaGUgaXMgbWVtb3J5IG9ubHksXG4gICAgICAgIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAgICAgICAvLyBjYWNoZSBpcyBsYXRlciBzdG9yZWQgdG8gZGlzaywgdGhlbiB0aGUgb3B0aW9ucyB0aGF0IGFmZmVjdCB0cmFuc2Zvcm0gb3V0cHV0XG4gICAgICAgIC8vIHdvdWxkIG5lZWQgdG8gYmUgYWRkZWQgdG8gdGhlIGtleSBhcyB3ZWxsIGFzIGEgY2hlY2sgZm9yIGFueSBjaGFuZ2Ugb2YgY29udGVudC5cbiAgICAgICAgbGV0IGNvbnRlbnRzID0gdHlwZVNjcmlwdEZpbGVDYWNoZS5nZXQocGF0aFRvRmlsZVVSTChyZXF1ZXN0KS5ocmVmKTtcblxuICAgICAgICBpZiAoY29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIE5vIFRTIHJlc3VsdCBpbmRpY2F0ZXMgdGhlIGZpbGUgaXMgbm90IHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvZ3JhbS5cbiAgICAgICAgICAvLyBJZiBhbGxvd0pzIGlzIGVuYWJsZWQgYW5kIHRoZSBmaWxlIGlzIEpTIHRoZW4gZGVmZXIgdG8gdGhlIG5leHQgbG9hZCBob29rLlxuICAgICAgICAgIGlmICghc2hvdWxkVHNJZ25vcmVKcyAmJiAvXFwuW2NtXT9qcyQvLnRlc3QocmVxdWVzdCkpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gT3RoZXJ3aXNlIHJldHVybiBhbiBlcnJvclxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICAgICAgY3JlYXRlTWlzc2luZ0ZpbGVFcnJvcihyZXF1ZXN0LCBhcmdzLnBhdGgsIGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIgPz8gJycpLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb250ZW50cyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAvLyBBIHN0cmluZyBpbmRpY2F0ZXMgdW50cmFuc2Zvcm1lZCBvdXRwdXQgZnJvbSB0aGUgVFMvTkcgY29tcGlsZXJcbiAgICAgICAgICBjb250ZW50cyA9IGF3YWl0IGphdmFzY3JpcHRUcmFuc2Zvcm1lci50cmFuc2Zvcm1EYXRhKFxuICAgICAgICAgICAgcmVxdWVzdCxcbiAgICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgICAgdHJ1ZSAvKiBza2lwTGlua2VyICovLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICAvLyBTdG9yZSBhcyB0aGUgcmV0dXJuZWQgVWludDhBcnJheSB0byBhbGxvdyBjYWNoaW5nIHRoZSBmdWxseSB0cmFuc2Zvcm1lZCBjb2RlXG4gICAgICAgICAgdHlwZVNjcmlwdEZpbGVDYWNoZS5zZXQocGF0aFRvRmlsZVVSTChyZXF1ZXN0KS5ocmVmLCBjb250ZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5bY21dP2pzJC8gfSwgKGFyZ3MpID0+XG4gICAgICAgIHByb2ZpbGVBc3luYyhcbiAgICAgICAgICAnTkdfRU1JVF9KUyonLFxuICAgICAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIC8vIFRoZSBmaWxlbmFtZSBpcyBjdXJyZW50bHkgdXNlZCBhcyBhIGNhY2hlIGtleS4gU2luY2UgdGhlIGNhY2hlIGlzIG1lbW9yeSBvbmx5LFxuICAgICAgICAgICAgLy8gdGhlIG9wdGlvbnMgY2Fubm90IGNoYW5nZSBhbmQgZG8gbm90IG5lZWQgdG8gYmUgcmVwcmVzZW50ZWQgaW4gdGhlIGtleS4gSWYgdGhlXG4gICAgICAgICAgICAvLyBjYWNoZSBpcyBsYXRlciBzdG9yZWQgdG8gZGlzaywgdGhlbiB0aGUgb3B0aW9ucyB0aGF0IGFmZmVjdCB0cmFuc2Zvcm0gb3V0cHV0XG4gICAgICAgICAgICAvLyB3b3VsZCBuZWVkIHRvIGJlIGFkZGVkIHRvIHRoZSBrZXkgYXMgd2VsbCBhcyBhIGNoZWNrIGZvciBhbnkgY2hhbmdlIG9mIGNvbnRlbnQuXG4gICAgICAgICAgICBsZXQgY29udGVudHMgPSBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8uYmFiZWxGaWxlQ2FjaGUuZ2V0KGFyZ3MucGF0aCk7XG4gICAgICAgICAgICBpZiAoY29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBjb250ZW50cyA9IGF3YWl0IGphdmFzY3JpcHRUcmFuc2Zvcm1lci50cmFuc2Zvcm1GaWxlKGFyZ3MucGF0aCwgcGx1Z2luT3B0aW9ucy5qaXQpO1xuICAgICAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8uYmFiZWxGaWxlQ2FjaGUuc2V0KGFyZ3MucGF0aCwgY29udGVudHMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICksXG4gICAgICApO1xuXG4gICAgICAvLyBTZXR1cCBidW5kbGluZyBvZiBjb21wb25lbnQgdGVtcGxhdGVzIGFuZCBzdHlsZXNoZWV0cyB3aGVuIGluIEpJVCBtb2RlXG4gICAgICBpZiAocGx1Z2luT3B0aW9ucy5qaXQpIHtcbiAgICAgICAgc2V0dXBKaXRQbHVnaW5DYWxsYmFja3MoXG4gICAgICAgICAgYnVpbGQsXG4gICAgICAgICAgc3R5bGVzaGVldEJ1bmRsZXIsXG4gICAgICAgICAgYWRkaXRpb25hbFJlc3VsdHMsXG4gICAgICAgICAgc3R5bGVPcHRpb25zLmlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGJ1aWxkLm9uRW5kKChyZXN1bHQpID0+IHtcbiAgICAgICAgZm9yIChjb25zdCB7IG91dHB1dEZpbGVzLCBtZXRhZmlsZSB9IG9mIGFkZGl0aW9uYWxSZXN1bHRzLnZhbHVlcygpKSB7XG4gICAgICAgICAgLy8gQWRkIGFueSBhZGRpdGlvbmFsIG91dHB1dCBmaWxlcyB0byB0aGUgbWFpbiBvdXRwdXQgZmlsZXNcbiAgICAgICAgICBpZiAob3V0cHV0RmlsZXM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgcmVzdWx0Lm91dHB1dEZpbGVzPy5wdXNoKC4uLm91dHB1dEZpbGVzKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBDb21iaW5lIGFkZGl0aW9uYWwgbWV0YWZpbGVzIHdpdGggbWFpbiBtZXRhZmlsZVxuICAgICAgICAgIGlmIChyZXN1bHQubWV0YWZpbGUgJiYgbWV0YWZpbGUpIHtcbiAgICAgICAgICAgIHJlc3VsdC5tZXRhZmlsZS5pbnB1dHMgPSB7IC4uLnJlc3VsdC5tZXRhZmlsZS5pbnB1dHMsIC4uLm1ldGFmaWxlLmlucHV0cyB9O1xuICAgICAgICAgICAgcmVzdWx0Lm1ldGFmaWxlLm91dHB1dHMgPSB7IC4uLnJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzLCAuLi5tZXRhZmlsZS5vdXRwdXRzIH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbG9nQ3VtdWxhdGl2ZUR1cmF0aW9ucygpO1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uRGlzcG9zZSgoKSA9PiB7XG4gICAgICAgIHNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZT8uZGlzcG9zZSgpO1xuICAgICAgICB2b2lkIHN0eWxlc2hlZXRCdW5kbGVyLmRpc3Bvc2UoKTtcbiAgICAgICAgdm9pZCBjb21waWxhdGlvbi5jbG9zZT8uKCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBidW5kbGVXZWJXb3JrZXIoXG4gIGJ1aWxkOiBQbHVnaW5CdWlsZCxcbiAgcGx1Z2luT3B0aW9uczogQ29tcGlsZXJQbHVnaW5PcHRpb25zLFxuICB3b3JrZXJGaWxlOiBzdHJpbmcsXG4pIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYnVpbGQuZXNidWlsZC5idWlsZFN5bmMoe1xuICAgICAgcGxhdGZvcm06ICdicm93c2VyJyxcbiAgICAgIHdyaXRlOiBmYWxzZSxcbiAgICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgICAgZm9ybWF0OiAnZXNtJyxcbiAgICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgICBsb2dMZXZlbDogJ3NpbGVudCcsXG4gICAgICBzb3VyY2VtYXA6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgZW50cnlOYW1lczogJ3dvcmtlci1baGFzaF0nLFxuICAgICAgZW50cnlQb2ludHM6IFt3b3JrZXJGaWxlXSxcbiAgICAgIGFic1dvcmtpbmdEaXI6IGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIsXG4gICAgICBvdXRkaXI6IGJ1aWxkLmluaXRpYWxPcHRpb25zLm91dGRpcixcbiAgICAgIG1pbmlmeUlkZW50aWZpZXJzOiBidWlsZC5pbml0aWFsT3B0aW9ucy5taW5pZnlJZGVudGlmaWVycyxcbiAgICAgIG1pbmlmeVN5bnRheDogYnVpbGQuaW5pdGlhbE9wdGlvbnMubWluaWZ5U3ludGF4LFxuICAgICAgbWluaWZ5V2hpdGVzcGFjZTogYnVpbGQuaW5pdGlhbE9wdGlvbnMubWluaWZ5V2hpdGVzcGFjZSxcbiAgICAgIHRhcmdldDogYnVpbGQuaW5pdGlhbE9wdGlvbnMudGFyZ2V0LFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvciAmJiB0eXBlb2YgZXJyb3IgPT09ICdvYmplY3QnICYmICdlcnJvcnMnIGluIGVycm9yICYmICd3YXJuaW5ncycgaW4gZXJyb3IpIHtcbiAgICAgIHJldHVybiBlcnJvciBhcyBCdWlsZEZhaWx1cmU7XG4gICAgfVxuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU1pc3NpbmdGaWxlRXJyb3IocmVxdWVzdDogc3RyaW5nLCBvcmlnaW5hbDogc3RyaW5nLCByb290OiBzdHJpbmcpOiBQYXJ0aWFsTWVzc2FnZSB7XG4gIGNvbnN0IGVycm9yID0ge1xuICAgIHRleHQ6IGBGaWxlICcke3BhdGgucmVsYXRpdmUocm9vdCwgcmVxdWVzdCl9JyBpcyBtaXNzaW5nIGZyb20gdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24uYCxcbiAgICBub3RlczogW1xuICAgICAge1xuICAgICAgICB0ZXh0OiBgRW5zdXJlIHRoZSBmaWxlIGlzIHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvZ3JhbSB2aWEgdGhlICdmaWxlcycgb3IgJ2luY2x1ZGUnIHByb3BlcnR5LmAsXG4gICAgICB9LFxuICAgIF0sXG4gIH07XG5cbiAgaWYgKHJlcXVlc3QgIT09IG9yaWdpbmFsKSB7XG4gICAgZXJyb3Iubm90ZXMucHVzaCh7XG4gICAgICB0ZXh0OiBgRmlsZSBpcyByZXF1ZXN0ZWQgZnJvbSBhIGZpbGUgcmVwbGFjZW1lbnQgb2YgJyR7cGF0aC5yZWxhdGl2ZShyb290LCBvcmlnaW5hbCl9Jy5gLFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIGVycm9yO1xufVxuIl19