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
            const stylesheetBundler = new component_stylesheets_1.ComponentStylesheetBundler(styleOptions, pluginOptions.incremental);
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
                    stylesheetBundler.invalidate(modifiedFiles);
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
                    // target of 9 is ES2022 (using the number avoids an expensive import of typescript just for an enum)
                    if (compilerOptions.target === undefined || compilerOptions.target < 9) {
                        // If 'useDefineForClassFields' is already defined in the users project leave the value as is.
                        // Otherwise fallback to false due to https://github.com/microsoft/TypeScript/issues/45995
                        // which breaks the deprecated `@Effects` NGRX decorator and potentially other existing code as well.
                        compilerOptions.target = 9;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVdILDhEQUFpQztBQUNqQywrQ0FBNEM7QUFDNUMsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUN6Qyw0RUFBZ0U7QUFDaEUsc0VBQWtFO0FBRWxFLDRDQUE4RjtBQUc5RiwrQ0FBOEY7QUFDOUYsMkRBQTBGO0FBQzFGLG1FQUFxRTtBQUNyRSxxRUFBZ0U7QUFDaEUsaUVBQWlFO0FBaUJqRSxrREFBa0Q7QUFDbEQsU0FBZ0Isb0JBQW9CLENBQ2xDLGFBQW9DLEVBQ3BDLFlBQXVFO0lBRXZFLE9BQU87UUFDTCxJQUFJLEVBQUUsa0JBQWtCO1FBQ3hCLGtEQUFrRDtRQUNsRCxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQWtCO1lBQzVCLElBQUksYUFBYSxHQUFpQyxFQUFFLENBQUM7WUFDckQsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLGdCQUFnQixDQUFDO1lBRS9ELElBQUksWUFBWSxHQUFHLGFBQWEsQ0FBQyxRQUFRLENBQUM7WUFDMUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFO2dCQUNyQixnRUFBZ0U7Z0JBQ2hFLHlGQUF5RjtnQkFDekYsSUFBSTtvQkFDRixZQUFZLEdBQUcsTUFBTSxJQUFBLG1CQUFRLEVBQUMsWUFBWSxDQUFDLENBQUM7aUJBQzdDO2dCQUFDLE1BQU0sR0FBRTthQUNYO1lBRUQsMERBQTBEO1lBQzFELE1BQU0scUJBQXFCLEdBQUcsSUFBSSw4Q0FBcUIsQ0FBQyxhQUFhLEVBQUUsZ0NBQVUsQ0FBQyxDQUFDO1lBRW5G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QUFJLENBQUM7WUFDZixJQUFJLEVBQUUsaURBQWlELElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxJQUFJO1NBQ3pGLENBQUMsQ0FBQztLQUNKO0lBRUQsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgQnVpbGRGYWlsdXJlLFxuICBNZXRhZmlsZSxcbiAgT25TdGFydFJlc3VsdCxcbiAgT3V0cHV0RmlsZSxcbiAgUGFydGlhbE1lc3NhZ2UsXG4gIFBsdWdpbixcbiAgUGx1Z2luQnVpbGQsXG59IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyByZWFscGF0aCB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB7IG1heFdvcmtlcnMgfSBmcm9tICcuLi8uLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IEphdmFTY3JpcHRUcmFuc2Zvcm1lciB9IGZyb20gJy4uL2phdmFzY3JpcHQtdHJhbnNmb3JtZXInO1xuaW1wb3J0IHsgTG9hZFJlc3VsdENhY2hlIH0gZnJvbSAnLi4vbG9hZC1yZXN1bHQtY2FjaGUnO1xuaW1wb3J0IHsgbG9nQ3VtdWxhdGl2ZUR1cmF0aW9ucywgcHJvZmlsZUFzeW5jLCByZXNldEN1bXVsYXRpdmVEdXJhdGlvbnMgfSBmcm9tICcuLi9wcm9maWxpbmcnO1xuaW1wb3J0IHsgQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMgfSBmcm9tICcuLi9zdHlsZXNoZWV0cy9idW5kbGUtb3B0aW9ucyc7XG5pbXBvcnQgeyBBbmd1bGFySG9zdE9wdGlvbnMgfSBmcm9tICcuL2FuZ3VsYXItaG9zdCc7XG5pbXBvcnQgeyBBbmd1bGFyQ29tcGlsYXRpb24sIE5vb3BDb21waWxhdGlvbiwgY3JlYXRlQW5ndWxhckNvbXBpbGF0aW9uIH0gZnJvbSAnLi9jb21waWxhdGlvbic7XG5pbXBvcnQgeyBTaGFyZWRUU0NvbXBpbGF0aW9uU3RhdGUsIGdldFNoYXJlZENvbXBpbGF0aW9uU3RhdGUgfSBmcm9tICcuL2NvbXBpbGF0aW9uLXN0YXRlJztcbmltcG9ydCB7IENvbXBvbmVudFN0eWxlc2hlZXRCdW5kbGVyIH0gZnJvbSAnLi9jb21wb25lbnQtc3R5bGVzaGVldHMnO1xuaW1wb3J0IHsgRmlsZVJlZmVyZW5jZVRyYWNrZXIgfSBmcm9tICcuL2ZpbGUtcmVmZXJlbmNlLXRyYWNrZXInO1xuaW1wb3J0IHsgc2V0dXBKaXRQbHVnaW5DYWxsYmFja3MgfSBmcm9tICcuL2ppdC1wbHVnaW4tY2FsbGJhY2tzJztcbmltcG9ydCB7IFNvdXJjZUZpbGVDYWNoZSB9IGZyb20gJy4vc291cmNlLWZpbGUtY2FjaGUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbXBpbGVyUGx1Z2luT3B0aW9ucyB7XG4gIHNvdXJjZW1hcDogYm9vbGVhbjtcbiAgdHNjb25maWc6IHN0cmluZztcbiAgaml0PzogYm9vbGVhbjtcbiAgLyoqIFNraXAgVHlwZVNjcmlwdCBjb21waWxhdGlvbiBzZXR1cC4gVGhpcyBpcyB1c2VmdWwgdG8gcmUtdXNlIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uIGZyb20gYW5vdGhlciBwbHVnaW4uICovXG4gIG5vb3BUeXBlU2NyaXB0Q29tcGlsYXRpb24/OiBib29sZWFuO1xuICBhZHZhbmNlZE9wdGltaXphdGlvbnM/OiBib29sZWFuO1xuICB0aGlyZFBhcnR5U291cmNlbWFwcz86IGJvb2xlYW47XG4gIGZpbGVSZXBsYWNlbWVudHM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGU7XG4gIGxvYWRSZXN1bHRDYWNoZT86IExvYWRSZXN1bHRDYWNoZTtcbiAgaW5jcmVtZW50YWw6IGJvb2xlYW47XG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gIHBsdWdpbk9wdGlvbnM6IENvbXBpbGVyUGx1Z2luT3B0aW9ucyxcbiAgc3R5bGVPcHRpb25zOiBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyAmIHsgaW5saW5lU3R5bGVMYW5ndWFnZTogc3RyaW5nIH0sXG4pOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLWNvbXBpbGVyJyxcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuICAgIGFzeW5jIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgbGV0IHNldHVwV2FybmluZ3M6IFBhcnRpYWxNZXNzYWdlW10gfCB1bmRlZmluZWQgPSBbXTtcbiAgICAgIGNvbnN0IHByZXNlcnZlU3ltbGlua3MgPSBidWlsZC5pbml0aWFsT3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzO1xuXG4gICAgICBsZXQgdHNjb25maWdQYXRoID0gcGx1Z2luT3B0aW9ucy50c2NvbmZpZztcbiAgICAgIGlmICghcHJlc2VydmVTeW1saW5rcykge1xuICAgICAgICAvLyBVc2UgdGhlIHJlYWwgcGF0aCBvZiB0aGUgdHNjb25maWcgaWYgbm90IHByZXNlcnZpbmcgc3ltbGlua3MuXG4gICAgICAgIC8vIFRoaXMgZW5zdXJlcyB0aGUgVFMgc291cmNlIGZpbGUgcGF0aHMgYXJlIGJhc2VkIG9uIHRoZSByZWFsIHBhdGggb2YgdGhlIGNvbmZpZ3VyYXRpb24uXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdHNjb25maWdQYXRoID0gYXdhaXQgcmVhbHBhdGgodHNjb25maWdQYXRoKTtcbiAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgfVxuXG4gICAgICAvLyBJbml0aWFsaXplIGEgd29ya2VyIHBvb2wgZm9yIEphdmFTY3JpcHQgdHJhbnNmb3JtYXRpb25zXG4gICAgICBjb25zdCBqYXZhc2NyaXB0VHJhbnNmb3JtZXIgPSBuZXcgSmF2YVNjcmlwdFRyYW5zZm9ybWVyKHBsdWdpbk9wdGlvbnMsIG1heFdvcmtlcnMpO1xuXG4gICAgICAvLyBTZXR1cCBkZWZpbmVzIGJhc2VkIG9uIHRoZSB2YWx1ZXMgdXNlZCBieSB0aGUgQW5ndWxhciBjb21waWxlci1jbGlcbiAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLmRlZmluZSA/Pz0ge307XG4gICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmVbJ25nSTE4bkNsb3N1cmVNb2RlJ10gPz89ICdmYWxzZSc7XG5cbiAgICAgIC8vIFRoZSBpbi1tZW1vcnkgY2FjaGUgb2YgVHlwZVNjcmlwdCBmaWxlIG91dHB1dHMgd2lsbCBiZSB1c2VkIGR1cmluZyB0aGUgYnVpbGQgaW4gYG9uTG9hZGAgY2FsbGJhY2tzIGZvciBUUyBmaWxlcy5cbiAgICAgIC8vIEEgc3RyaW5nIHZhbHVlIGluZGljYXRlcyBkaXJlY3QgVFMvTkcgb3V0cHV0IGFuZCBhIFVpbnQ4QXJyYXkgaW5kaWNhdGVzIGZ1bGx5IHRyYW5zZm9ybWVkIGNvZGUuXG4gICAgICBjb25zdCB0eXBlU2NyaXB0RmlsZUNhY2hlID1cbiAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LnR5cGVTY3JpcHRGaWxlQ2FjaGUgPz9cbiAgICAgICAgbmV3IE1hcDxzdHJpbmcsIHN0cmluZyB8IFVpbnQ4QXJyYXk+KCk7XG5cbiAgICAgIC8vIFRoZSByZXNvdXJjZXMgZnJvbSBjb21wb25lbnQgc3R5bGVzaGVldHMgYW5kIHdlYiB3b3JrZXJzIHRoYXQgd2lsbCBiZSBhZGRlZCB0byB0aGUgYnVpbGQgcmVzdWx0cyBvdXRwdXQgZmlsZXNcbiAgICAgIGNvbnN0IGFkZGl0aW9uYWxSZXN1bHRzID0gbmV3IE1hcDxcbiAgICAgICAgc3RyaW5nLFxuICAgICAgICB7IG91dHB1dEZpbGVzPzogT3V0cHV0RmlsZVtdOyBtZXRhZmlsZT86IE1ldGFmaWxlOyBlcnJvcnM/OiBQYXJ0aWFsTWVzc2FnZVtdIH1cbiAgICAgID4oKTtcblxuICAgICAgLy8gQ3JlYXRlIG5ldyByZXVzYWJsZSBjb21waWxhdGlvbiBmb3IgdGhlIGFwcHJvcHJpYXRlIG1vZGUgYmFzZWQgb24gdGhlIGBqaXRgIHBsdWdpbiBvcHRpb25cbiAgICAgIGNvbnN0IGNvbXBpbGF0aW9uOiBBbmd1bGFyQ29tcGlsYXRpb24gPSBwbHVnaW5PcHRpb25zLm5vb3BUeXBlU2NyaXB0Q29tcGlsYXRpb25cbiAgICAgICAgPyBuZXcgTm9vcENvbXBpbGF0aW9uKClcbiAgICAgICAgOiBhd2FpdCBjcmVhdGVBbmd1bGFyQ29tcGlsYXRpb24oISFwbHVnaW5PcHRpb25zLmppdCk7XG5cbiAgICAgIC8vIERldGVybWluZXMgaWYgVHlwZVNjcmlwdCBzaG91bGQgcHJvY2VzcyBKYXZhU2NyaXB0IGZpbGVzIGJhc2VkIG9uIHRzY29uZmlnIGBhbGxvd0pzYCBvcHRpb25cbiAgICAgIGxldCBzaG91bGRUc0lnbm9yZUpzID0gdHJ1ZTtcblxuICAgICAgLy8gVHJhY2sgaW5jcmVtZW50YWwgY29tcG9uZW50IHN0eWxlc2hlZXQgYnVpbGRzXG4gICAgICBjb25zdCBzdHlsZXNoZWV0QnVuZGxlciA9IG5ldyBDb21wb25lbnRTdHlsZXNoZWV0QnVuZGxlcihcbiAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgICBwbHVnaW5PcHRpb25zLmluY3JlbWVudGFsLFxuICAgICAgKTtcbiAgICAgIGxldCBzaGFyZWRUU0NvbXBpbGF0aW9uU3RhdGU6IFNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZSB8IHVuZGVmaW5lZDtcblxuICAgICAgLy8gVG8gZnVsbHkgaW52YWxpZGF0ZSBmaWxlcywgdHJhY2sgcmVzb3VyY2UgcmVmZXJlbmNlZCBmaWxlcyBhbmQgdGhlaXIgcmVmZXJlbmNpbmcgc291cmNlXG4gICAgICBjb25zdCByZWZlcmVuY2VkRmlsZVRyYWNrZXIgPSBuZXcgRmlsZVJlZmVyZW5jZVRyYWNrZXIoKTtcblxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbiAgICAgIGJ1aWxkLm9uU3RhcnQoYXN5bmMgKCkgPT4ge1xuICAgICAgICBzaGFyZWRUU0NvbXBpbGF0aW9uU3RhdGUgPSBnZXRTaGFyZWRDb21waWxhdGlvblN0YXRlKCk7XG4gICAgICAgIGlmICghKGNvbXBpbGF0aW9uIGluc3RhbmNlb2YgTm9vcENvbXBpbGF0aW9uKSkge1xuICAgICAgICAgIHNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZS5tYXJrQXNJblByb2dyZXNzKCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZXN1bHQ6IE9uU3RhcnRSZXN1bHQgPSB7XG4gICAgICAgICAgd2FybmluZ3M6IHNldHVwV2FybmluZ3MsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gUmVzZXQgZGVidWcgcGVyZm9ybWFuY2UgdHJhY2tpbmdcbiAgICAgICAgcmVzZXRDdW11bGF0aXZlRHVyYXRpb25zKCk7XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSByZWZlcmVuY2UgdHJhY2tlciBhbmQgZ2VuZXJhdGUgYSBmdWxsIHNldCBvZiBtb2RpZmllZCBmaWxlcyBmb3IgdGhlXG4gICAgICAgIC8vIEFuZ3VsYXIgY29tcGlsZXIgd2hpY2ggZG9lcyBub3QgaGF2ZSBkaXJlY3Qga25vd2xlZGdlIG9mIHRyYW5zaXRpdmUgcmVzb3VyY2VcbiAgICAgICAgLy8gZGVwZW5kZW5jaWVzIG9yIHdlYiB3b3JrZXIgcHJvY2Vzc2luZy5cbiAgICAgICAgbGV0IG1vZGlmaWVkRmlsZXM7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8ubW9kaWZpZWRGaWxlcy5zaXplICYmXG4gICAgICAgICAgcmVmZXJlbmNlZEZpbGVUcmFja2VyICYmXG4gICAgICAgICAgIXBsdWdpbk9wdGlvbnMubm9vcFR5cGVTY3JpcHRDb21waWxhdGlvblxuICAgICAgICApIHtcbiAgICAgICAgICAvLyBUT0RPOiBEaWZmZXJlbnRpYXRlIGJldHdlZW4gY2hhbmdlZCBpbnB1dCBmaWxlcyBhbmQgc3RhbGUgb3V0cHV0IGZpbGVzXG4gICAgICAgICAgbW9kaWZpZWRGaWxlcyA9IHJlZmVyZW5jZWRGaWxlVHJhY2tlci51cGRhdGUocGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUubW9kaWZpZWRGaWxlcyk7XG4gICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUuaW52YWxpZGF0ZShtb2RpZmllZEZpbGVzKTtcbiAgICAgICAgICBzdHlsZXNoZWV0QnVuZGxlci5pbnZhbGlkYXRlKG1vZGlmaWVkRmlsZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICFwbHVnaW5PcHRpb25zLm5vb3BUeXBlU2NyaXB0Q29tcGlsYXRpb24gJiZcbiAgICAgICAgICBjb21waWxhdGlvbi51cGRhdGUgJiZcbiAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8ubW9kaWZpZWRGaWxlcy5zaXplXG4gICAgICAgICkge1xuICAgICAgICAgIGF3YWl0IGNvbXBpbGF0aW9uLnVwZGF0ZShtb2RpZmllZEZpbGVzID8/IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlLm1vZGlmaWVkRmlsZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ3JlYXRlIEFuZ3VsYXIgY29tcGlsZXIgaG9zdCBvcHRpb25zXG4gICAgICAgIGNvbnN0IGhvc3RPcHRpb25zOiBBbmd1bGFySG9zdE9wdGlvbnMgPSB7XG4gICAgICAgICAgZmlsZVJlcGxhY2VtZW50czogcGx1Z2luT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzLFxuICAgICAgICAgIG1vZGlmaWVkRmlsZXMsXG4gICAgICAgICAgc291cmNlRmlsZUNhY2hlOiBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZSxcbiAgICAgICAgICBhc3luYyB0cmFuc2Zvcm1TdHlsZXNoZWV0KGRhdGEsIGNvbnRhaW5pbmdGaWxlLCBzdHlsZXNoZWV0RmlsZSkge1xuICAgICAgICAgICAgbGV0IHN0eWxlc2hlZXRSZXN1bHQ7XG5cbiAgICAgICAgICAgIC8vIFN0eWxlc2hlZXQgZmlsZSBvbmx5IGV4aXN0cyBmb3IgZXh0ZXJuYWwgc3R5bGVzaGVldHNcbiAgICAgICAgICAgIGlmIChzdHlsZXNoZWV0RmlsZSkge1xuICAgICAgICAgICAgICBzdHlsZXNoZWV0UmVzdWx0ID0gYXdhaXQgc3R5bGVzaGVldEJ1bmRsZXIuYnVuZGxlRmlsZShzdHlsZXNoZWV0RmlsZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzdHlsZXNoZWV0UmVzdWx0ID0gYXdhaXQgc3R5bGVzaGVldEJ1bmRsZXIuYnVuZGxlSW5saW5lKFxuICAgICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgICAgY29udGFpbmluZ0ZpbGUsXG4gICAgICAgICAgICAgICAgc3R5bGVPcHRpb25zLmlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHsgY29udGVudHMsIHJlc291cmNlRmlsZXMsIHJlZmVyZW5jZWRGaWxlcywgZXJyb3JzLCB3YXJuaW5ncyB9ID0gc3R5bGVzaGVldFJlc3VsdDtcbiAgICAgICAgICAgIGlmIChlcnJvcnMpIHtcbiAgICAgICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaCguLi53YXJuaW5ncyk7XG4gICAgICAgICAgICBhZGRpdGlvbmFsUmVzdWx0cy5zZXQoc3R5bGVzaGVldEZpbGUgPz8gY29udGFpbmluZ0ZpbGUsIHtcbiAgICAgICAgICAgICAgb3V0cHV0RmlsZXM6IHJlc291cmNlRmlsZXMsXG4gICAgICAgICAgICAgIG1ldGFmaWxlOiBzdHlsZXNoZWV0UmVzdWx0Lm1ldGFmaWxlLFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmIChyZWZlcmVuY2VkRmlsZXMpIHtcbiAgICAgICAgICAgICAgcmVmZXJlbmNlZEZpbGVUcmFja2VyLmFkZChjb250YWluaW5nRmlsZSwgcmVmZXJlbmNlZEZpbGVzKTtcbiAgICAgICAgICAgICAgaWYgKHN0eWxlc2hlZXRGaWxlKSB7XG4gICAgICAgICAgICAgICAgLy8gQW5ndWxhciBBT1QgY29tcGlsZXIgbmVlZHMgbW9kaWZpZWQgZGlyZWN0IHJlc291cmNlIGZpbGVzIHRvIGNvcnJlY3RseSBpbnZhbGlkYXRlIGl0cyBhbmFseXNpc1xuICAgICAgICAgICAgICAgIHJlZmVyZW5jZWRGaWxlVHJhY2tlci5hZGQoc3R5bGVzaGVldEZpbGUsIHJlZmVyZW5jZWRGaWxlcyk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGNvbnRlbnRzO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgcHJvY2Vzc1dlYldvcmtlcih3b3JrZXJGaWxlLCBjb250YWluaW5nRmlsZSkge1xuICAgICAgICAgICAgY29uc3QgZnVsbFdvcmtlclBhdGggPSBwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKGNvbnRhaW5pbmdGaWxlKSwgd29ya2VyRmlsZSk7XG4gICAgICAgICAgICAvLyBUaGUgc3luY2hyb25vdXMgQVBJIG11c3QgYmUgdXNlZCBkdWUgdG8gdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gY3VycmVudGx5IGJlaW5nXG4gICAgICAgICAgICAvLyBmdWxseSBzeW5jaHJvbm91cyBhbmQgdGhpcyBwcm9jZXNzIGNhbGxiYWNrIGJlaW5nIGNhbGxlZCBmcm9tIHdpdGhpbiBhIFR5cGVTY3JpcHRcbiAgICAgICAgICAgIC8vIHRyYW5zZm9ybWVyLlxuICAgICAgICAgICAgY29uc3Qgd29ya2VyUmVzdWx0ID0gYnVuZGxlV2ViV29ya2VyKGJ1aWxkLCBwbHVnaW5PcHRpb25zLCBmdWxsV29ya2VyUGF0aCk7XG5cbiAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLndvcmtlclJlc3VsdC53YXJuaW5ncyk7XG4gICAgICAgICAgICBpZiAod29ya2VyUmVzdWx0LmVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaCguLi53b3JrZXJSZXN1bHQuZXJyb3JzKTtcbiAgICAgICAgICAgICAgLy8gVHJhY2sgd29ya2VyIGZpbGUgZXJyb3JzIHRvIGFsbG93IHJlYnVpbGRzIG9uIGNoYW5nZXNcbiAgICAgICAgICAgICAgcmVmZXJlbmNlZEZpbGVUcmFja2VyLmFkZChcbiAgICAgICAgICAgICAgICBjb250YWluaW5nRmlsZSxcbiAgICAgICAgICAgICAgICB3b3JrZXJSZXN1bHQuZXJyb3JzXG4gICAgICAgICAgICAgICAgICAubWFwKChlcnJvcikgPT4gZXJyb3IubG9jYXRpb24/LmZpbGUpXG4gICAgICAgICAgICAgICAgICAuZmlsdGVyKChmaWxlKTogZmlsZSBpcyBzdHJpbmcgPT4gISFmaWxlKVxuICAgICAgICAgICAgICAgICAgLm1hcCgoZmlsZSkgPT4gcGF0aC5qb2luKGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIgPz8gJycsIGZpbGUpKSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgYWRkaXRpb25hbFJlc3VsdHMuc2V0KGZ1bGxXb3JrZXJQYXRoLCB7IGVycm9yczogcmVzdWx0LmVycm9ycyB9KTtcblxuICAgICAgICAgICAgICAvLyBSZXR1cm4gdGhlIG9yaWdpbmFsIHBhdGggaWYgdGhlIGJ1aWxkIGZhaWxlZFxuICAgICAgICAgICAgICByZXR1cm4gd29ya2VyRmlsZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXNzZXJ0KCdvdXRwdXRGaWxlcycgaW4gd29ya2VyUmVzdWx0LCAnSW52YWxpZCB3ZWIgd29ya2VyIGJ1bmRsZSByZXN1bHQuJyk7XG4gICAgICAgICAgICBhZGRpdGlvbmFsUmVzdWx0cy5zZXQoZnVsbFdvcmtlclBhdGgsIHtcbiAgICAgICAgICAgICAgb3V0cHV0RmlsZXM6IHdvcmtlclJlc3VsdC5vdXRwdXRGaWxlcyxcbiAgICAgICAgICAgICAgbWV0YWZpbGU6IHdvcmtlclJlc3VsdC5tZXRhZmlsZSxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZWZlcmVuY2VkRmlsZVRyYWNrZXIuYWRkKFxuICAgICAgICAgICAgICBjb250YWluaW5nRmlsZSxcbiAgICAgICAgICAgICAgT2JqZWN0LmtleXMod29ya2VyUmVzdWx0Lm1ldGFmaWxlLmlucHV0cykubWFwKChpbnB1dCkgPT5cbiAgICAgICAgICAgICAgICBwYXRoLmpvaW4oYnVpbGQuaW5pdGlhbE9wdGlvbnMuYWJzV29ya2luZ0RpciA/PyAnJywgaW5wdXQpLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gUmV0dXJuIGJ1bmRsZWQgd29ya2VyIGZpbGUgZW50cnkgbmFtZSB0byBiZSB1c2VkIGluIHRoZSBidWlsdCBvdXRwdXRcbiAgICAgICAgICAgIGNvbnN0IHdvcmtlckNvZGVGaWxlID0gd29ya2VyUmVzdWx0Lm91dHB1dEZpbGVzLmZpbmQoKGZpbGUpID0+XG4gICAgICAgICAgICAgIGZpbGUucGF0aC5lbmRzV2l0aCgnLmpzJyksXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYXNzZXJ0KHdvcmtlckNvZGVGaWxlLCAnV2ViIFdvcmtlciBidW5kbGVkIGNvZGUgZmlsZSBzaG91bGQgYWx3YXlzIGJlIHByZXNlbnQuJyk7XG5cbiAgICAgICAgICAgIHJldHVybiBwYXRoLnJlbGF0aXZlKGJ1aWxkLmluaXRpYWxPcHRpb25zLm91dGRpciA/PyAnJywgd29ya2VyQ29kZUZpbGUucGF0aCk7XG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHRoZSBBbmd1bGFyIGNvbXBpbGF0aW9uIGZvciB0aGUgY3VycmVudCBidWlsZC5cbiAgICAgICAgLy8gSW4gd2F0Y2ggbW9kZSwgcHJldmlvdXMgYnVpbGQgc3RhdGUgd2lsbCBiZSByZXVzZWQuXG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICBjb21waWxlck9wdGlvbnM6IHsgYWxsb3dKcyB9LFxuICAgICAgICAgIHJlZmVyZW5jZWRGaWxlcyxcbiAgICAgICAgfSA9IGF3YWl0IGNvbXBpbGF0aW9uLmluaXRpYWxpemUodHNjb25maWdQYXRoLCBob3N0T3B0aW9ucywgKGNvbXBpbGVyT3B0aW9ucykgPT4ge1xuICAgICAgICAgIC8vIHRhcmdldCBvZiA5IGlzIEVTMjAyMiAodXNpbmcgdGhlIG51bWJlciBhdm9pZHMgYW4gZXhwZW5zaXZlIGltcG9ydCBvZiB0eXBlc2NyaXB0IGp1c3QgZm9yIGFuIGVudW0pXG4gICAgICAgICAgaWYgKGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPT09IHVuZGVmaW5lZCB8fCBjb21waWxlck9wdGlvbnMudGFyZ2V0IDwgOSkge1xuICAgICAgICAgICAgLy8gSWYgJ3VzZURlZmluZUZvckNsYXNzRmllbGRzJyBpcyBhbHJlYWR5IGRlZmluZWQgaW4gdGhlIHVzZXJzIHByb2plY3QgbGVhdmUgdGhlIHZhbHVlIGFzIGlzLlxuICAgICAgICAgICAgLy8gT3RoZXJ3aXNlIGZhbGxiYWNrIHRvIGZhbHNlIGR1ZSB0byBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzQ1OTk1XG4gICAgICAgICAgICAvLyB3aGljaCBicmVha3MgdGhlIGRlcHJlY2F0ZWQgYEBFZmZlY3RzYCBOR1JYIGRlY29yYXRvciBhbmQgcG90ZW50aWFsbHkgb3RoZXIgZXhpc3RpbmcgY29kZSBhcyB3ZWxsLlxuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCA9IDk7XG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMudXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHMgPz89IGZhbHNlO1xuXG4gICAgICAgICAgICAvLyBPbmx5IGFkZCB0aGUgd2FybmluZyBvbiB0aGUgaW5pdGlhbCBidWlsZFxuICAgICAgICAgICAgc2V0dXBXYXJuaW5ncz8ucHVzaCh7XG4gICAgICAgICAgICAgIHRleHQ6XG4gICAgICAgICAgICAgICAgJ1R5cGVTY3JpcHQgY29tcGlsZXIgb3B0aW9ucyBcInRhcmdldFwiIGFuZCBcInVzZURlZmluZUZvckNsYXNzRmllbGRzXCIgYXJlIHNldCB0byBcIkVTMjAyMlwiIGFuZCAnICtcbiAgICAgICAgICAgICAgICAnXCJmYWxzZVwiIHJlc3BlY3RpdmVseSBieSB0aGUgQW5ndWxhciBDTEkuJyxcbiAgICAgICAgICAgICAgbG9jYXRpb246IHsgZmlsZTogcGx1Z2luT3B0aW9ucy50c2NvbmZpZyB9LFxuICAgICAgICAgICAgICBub3RlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHRleHQ6XG4gICAgICAgICAgICAgICAgICAgICdUbyBjb250cm9sIEVDTUEgdmVyc2lvbiBhbmQgZmVhdHVyZXMgdXNlIHRoZSBCcm93ZXJzbGlzdCBjb25maWd1cmF0aW9uLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ0ZvciBtb3JlIGluZm9ybWF0aW9uLCBzZWUgaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2J1aWxkI2NvbmZpZ3VyaW5nLWJyb3dzZXItY29tcGF0aWJpbGl0eScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEVuYWJsZSBpbmNyZW1lbnRhbCBjb21waWxhdGlvbiBieSBkZWZhdWx0IGlmIGNhY2hpbmcgaXMgZW5hYmxlZFxuICAgICAgICAgIGlmIChwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8ucGVyc2lzdGVudENhY2hlUGF0aCkge1xuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLmluY3JlbWVudGFsID8/PSB0cnVlO1xuICAgICAgICAgICAgLy8gU2V0IHRoZSBidWlsZCBpbmZvIGZpbGUgbG9jYXRpb24gdG8gdGhlIGNvbmZpZ3VyZWQgY2FjaGUgZGlyZWN0b3J5XG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMudHNCdWlsZEluZm9GaWxlID0gcGF0aC5qb2luKFxuICAgICAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8ucGVyc2lzdGVudENhY2hlUGF0aCxcbiAgICAgICAgICAgICAgJy50c2J1aWxkaW5mbycsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMuaW5jcmVtZW50YWwgPSBmYWxzZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4uY29tcGlsZXJPcHRpb25zLFxuICAgICAgICAgICAgbm9FbWl0T25FcnJvcjogZmFsc2UsXG4gICAgICAgICAgICBpbmxpbmVTb3VyY2VzOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIGlubGluZVNvdXJjZU1hcDogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgICBtYXBSb290OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBzb3VyY2VSb290OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgICBzaG91bGRUc0lnbm9yZUpzID0gIWFsbG93SnM7XG5cbiAgICAgICAgaWYgKGNvbXBpbGF0aW9uIGluc3RhbmNlb2YgTm9vcENvbXBpbGF0aW9uKSB7XG4gICAgICAgICAgYXdhaXQgc2hhcmVkVFNDb21waWxhdGlvblN0YXRlLndhaXRVbnRpbFJlYWR5O1xuXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRpYWdub3N0aWNzID0gYXdhaXQgY29tcGlsYXRpb24uZGlhZ25vc2VGaWxlcygpO1xuICAgICAgICBpZiAoZGlhZ25vc3RpY3MuZXJyb3JzKSB7XG4gICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLmRpYWdub3N0aWNzLmVycm9ycyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRpYWdub3N0aWNzLndhcm5pbmdzKSB7XG4gICAgICAgICAgKHJlc3VsdC53YXJuaW5ncyA/Pz0gW10pLnB1c2goLi4uZGlhZ25vc3RpY3Mud2FybmluZ3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIFR5cGVTY3JpcHQgZmlsZSBvdXRwdXQgY2FjaGUgZm9yIGFsbCBhZmZlY3RlZCBmaWxlc1xuICAgICAgICBhd2FpdCBwcm9maWxlQXN5bmMoJ05HX0VNSVRfVFMnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgZm9yIChjb25zdCB7IGZpbGVuYW1lLCBjb250ZW50cyB9IG9mIGF3YWl0IGNvbXBpbGF0aW9uLmVtaXRBZmZlY3RlZEZpbGVzKCkpIHtcbiAgICAgICAgICAgIHR5cGVTY3JpcHRGaWxlQ2FjaGUuc2V0KHBhdGhUb0ZpbGVVUkwoZmlsZW5hbWUpLmhyZWYsIGNvbnRlbnRzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZCBlcnJvcnMgZnJvbSBmYWlsZWQgYWRkaXRpb25hbCByZXN1bHRzLlxuICAgICAgICAvLyBUaGlzIG11c3QgYmUgZG9uZSBhZnRlciBlbWl0IHRvIGNhcHR1cmUgbGF0ZXN0IHdlYiB3b3JrZXIgcmVzdWx0cy5cbiAgICAgICAgZm9yIChjb25zdCB7IGVycm9ycyB9IG9mIGFkZGl0aW9uYWxSZXN1bHRzLnZhbHVlcygpKSB7XG4gICAgICAgICAgaWYgKGVycm9ycykge1xuICAgICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3RvcmUgcmVmZXJlbmNlZCBmaWxlcyBmb3IgdXBkYXRlZCBmaWxlIHdhdGNoaW5nIGlmIGVuYWJsZWRcbiAgICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlKSB7XG4gICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUucmVmZXJlbmNlZEZpbGVzID0gW1xuICAgICAgICAgICAgLi4ucmVmZXJlbmNlZEZpbGVzLFxuICAgICAgICAgICAgLi4ucmVmZXJlbmNlZEZpbGVUcmFja2VyLnJlZmVyZW5jZWRGaWxlcyxcbiAgICAgICAgICBdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzZXQgdGhlIHNldHVwIHdhcm5pbmdzIHNvIHRoYXQgdGhleSBhcmUgb25seSBzaG93biBkdXJpbmcgdGhlIGZpcnN0IGJ1aWxkLlxuICAgICAgICBzZXR1cFdhcm5pbmdzID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIHNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZS5tYXJrQXNSZWFkeSgpO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9banRdc3g/JC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cz8uW2FyZ3MucGF0aF0gPz8gYXJncy5wYXRoO1xuXG4gICAgICAgIC8vIFNraXAgVFMgbG9hZCBhdHRlbXB0IGlmIEpTIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gbm90IGVuYWJsZWQgYW5kIGZpbGUgaXMgSlNcbiAgICAgICAgaWYgKHNob3VsZFRzSWdub3JlSnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KHJlcXVlc3QpKSB7XG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBmaWxlbmFtZSBpcyBjdXJyZW50bHkgdXNlZCBhcyBhIGNhY2hlIGtleS4gU2luY2UgdGhlIGNhY2hlIGlzIG1lbW9yeSBvbmx5LFxuICAgICAgICAvLyB0aGUgb3B0aW9ucyBjYW5ub3QgY2hhbmdlIGFuZCBkbyBub3QgbmVlZCB0byBiZSByZXByZXNlbnRlZCBpbiB0aGUga2V5LiBJZiB0aGVcbiAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAvLyB3b3VsZCBuZWVkIHRvIGJlIGFkZGVkIHRvIHRoZSBrZXkgYXMgd2VsbCBhcyBhIGNoZWNrIGZvciBhbnkgY2hhbmdlIG9mIGNvbnRlbnQuXG4gICAgICAgIGxldCBjb250ZW50cyA9IHR5cGVTY3JpcHRGaWxlQ2FjaGUuZ2V0KHBhdGhUb0ZpbGVVUkwocmVxdWVzdCkuaHJlZik7XG5cbiAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBObyBUUyByZXN1bHQgaW5kaWNhdGVzIHRoZSBmaWxlIGlzIG5vdCBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0uXG4gICAgICAgICAgLy8gSWYgYWxsb3dKcyBpcyBlbmFibGVkIGFuZCB0aGUgZmlsZSBpcyBKUyB0aGVuIGRlZmVyIHRvIHRoZSBuZXh0IGxvYWQgaG9vay5cbiAgICAgICAgICBpZiAoIXNob3VsZFRzSWdub3JlSnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KHJlcXVlc3QpKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE90aGVyd2lzZSByZXR1cm4gYW4gZXJyb3JcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgIGNyZWF0ZU1pc3NpbmdGaWxlRXJyb3IocmVxdWVzdCwgYXJncy5wYXRoLCBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyID8/ICcnKSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY29udGVudHMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgLy8gQSBzdHJpbmcgaW5kaWNhdGVzIHVudHJhbnNmb3JtZWQgb3V0cHV0IGZyb20gdGhlIFRTL05HIGNvbXBpbGVyXG4gICAgICAgICAgY29udGVudHMgPSBhd2FpdCBqYXZhc2NyaXB0VHJhbnNmb3JtZXIudHJhbnNmb3JtRGF0YShcbiAgICAgICAgICAgIHJlcXVlc3QsXG4gICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgIHRydWUgLyogc2tpcExpbmtlciAqLyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgLy8gU3RvcmUgYXMgdGhlIHJldHVybmVkIFVpbnQ4QXJyYXkgdG8gYWxsb3cgY2FjaGluZyB0aGUgZnVsbHkgdHJhbnNmb3JtZWQgY29kZVxuICAgICAgICAgIHR5cGVTY3JpcHRGaWxlQ2FjaGUuc2V0KHBhdGhUb0ZpbGVVUkwocmVxdWVzdCkuaHJlZiwgY29udGVudHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9qcyQvIH0sIChhcmdzKSA9PlxuICAgICAgICBwcm9maWxlQXN5bmMoXG4gICAgICAgICAgJ05HX0VNSVRfSlMqJyxcbiAgICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAvLyBUaGUgZmlsZW5hbWUgaXMgY3VycmVudGx5IHVzZWQgYXMgYSBjYWNoZSBrZXkuIFNpbmNlIHRoZSBjYWNoZSBpcyBtZW1vcnkgb25seSxcbiAgICAgICAgICAgIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAgICAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAgICAgLy8gd291bGQgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUga2V5IGFzIHdlbGwgYXMgYSBjaGVjayBmb3IgYW55IGNoYW5nZSBvZiBjb250ZW50LlxuICAgICAgICAgICAgbGV0IGNvbnRlbnRzID0gcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LmJhYmVsRmlsZUNhY2hlLmdldChhcmdzLnBhdGgpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgY29udGVudHMgPSBhd2FpdCBqYXZhc2NyaXB0VHJhbnNmb3JtZXIudHJhbnNmb3JtRmlsZShhcmdzLnBhdGgsIHBsdWdpbk9wdGlvbnMuaml0KTtcbiAgICAgICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LmJhYmVsRmlsZUNhY2hlLnNldChhcmdzLnBhdGgsIGNvbnRlbnRzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgY29udGVudHMsXG4gICAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSxcbiAgICAgICAgICB0cnVlLFxuICAgICAgICApLFxuICAgICAgKTtcblxuICAgICAgLy8gU2V0dXAgYnVuZGxpbmcgb2YgY29tcG9uZW50IHRlbXBsYXRlcyBhbmQgc3R5bGVzaGVldHMgd2hlbiBpbiBKSVQgbW9kZVxuICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuaml0KSB7XG4gICAgICAgIHNldHVwSml0UGx1Z2luQ2FsbGJhY2tzKFxuICAgICAgICAgIGJ1aWxkLFxuICAgICAgICAgIHN0eWxlc2hlZXRCdW5kbGVyLFxuICAgICAgICAgIGFkZGl0aW9uYWxSZXN1bHRzLFxuICAgICAgICAgIHN0eWxlT3B0aW9ucy5pbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBidWlsZC5vbkVuZCgocmVzdWx0KSA9PiB7XG4gICAgICAgIGZvciAoY29uc3QgeyBvdXRwdXRGaWxlcywgbWV0YWZpbGUgfSBvZiBhZGRpdGlvbmFsUmVzdWx0cy52YWx1ZXMoKSkge1xuICAgICAgICAgIC8vIEFkZCBhbnkgYWRkaXRpb25hbCBvdXRwdXQgZmlsZXMgdG8gdGhlIG1haW4gb3V0cHV0IGZpbGVzXG4gICAgICAgICAgaWYgKG91dHB1dEZpbGVzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJlc3VsdC5vdXRwdXRGaWxlcz8ucHVzaCguLi5vdXRwdXRGaWxlcyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQ29tYmluZSBhZGRpdGlvbmFsIG1ldGFmaWxlcyB3aXRoIG1haW4gbWV0YWZpbGVcbiAgICAgICAgICBpZiAocmVzdWx0Lm1ldGFmaWxlICYmIG1ldGFmaWxlKSB7XG4gICAgICAgICAgICByZXN1bHQubWV0YWZpbGUuaW5wdXRzID0geyAuLi5yZXN1bHQubWV0YWZpbGUuaW5wdXRzLCAuLi5tZXRhZmlsZS5pbnB1dHMgfTtcbiAgICAgICAgICAgIHJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzID0geyAuLi5yZXN1bHQubWV0YWZpbGUub3V0cHV0cywgLi4ubWV0YWZpbGUub3V0cHV0cyB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxvZ0N1bXVsYXRpdmVEdXJhdGlvbnMoKTtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkRpc3Bvc2UoKCkgPT4ge1xuICAgICAgICBzaGFyZWRUU0NvbXBpbGF0aW9uU3RhdGU/LmRpc3Bvc2UoKTtcbiAgICAgICAgdm9pZCBzdHlsZXNoZWV0QnVuZGxlci5kaXNwb3NlKCk7XG4gICAgICAgIHZvaWQgY29tcGlsYXRpb24uY2xvc2U/LigpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVuZGxlV2ViV29ya2VyKFxuICBidWlsZDogUGx1Z2luQnVpbGQsXG4gIHBsdWdpbk9wdGlvbnM6IENvbXBpbGVyUGx1Z2luT3B0aW9ucyxcbiAgd29ya2VyRmlsZTogc3RyaW5nLFxuKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGJ1aWxkLmVzYnVpbGQuYnVpbGRTeW5jKHtcbiAgICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgICB3cml0ZTogZmFsc2UsXG4gICAgICBidW5kbGU6IHRydWUsXG4gICAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICAgIGZvcm1hdDogJ2VzbScsXG4gICAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgICAgbG9nTGV2ZWw6ICdzaWxlbnQnLFxuICAgICAgc291cmNlbWFwOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgIGVudHJ5TmFtZXM6ICd3b3JrZXItW2hhc2hdJyxcbiAgICAgIGVudHJ5UG9pbnRzOiBbd29ya2VyRmlsZV0sXG4gICAgICBhYnNXb3JraW5nRGlyOiBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyLFxuICAgICAgb3V0ZGlyOiBidWlsZC5pbml0aWFsT3B0aW9ucy5vdXRkaXIsXG4gICAgICBtaW5pZnlJZGVudGlmaWVyczogYnVpbGQuaW5pdGlhbE9wdGlvbnMubWluaWZ5SWRlbnRpZmllcnMsXG4gICAgICBtaW5pZnlTeW50YXg6IGJ1aWxkLmluaXRpYWxPcHRpb25zLm1pbmlmeVN5bnRheCxcbiAgICAgIG1pbmlmeVdoaXRlc3BhY2U6IGJ1aWxkLmluaXRpYWxPcHRpb25zLm1pbmlmeVdoaXRlc3BhY2UsXG4gICAgICB0YXJnZXQ6IGJ1aWxkLmluaXRpYWxPcHRpb25zLnRhcmdldCxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IgJiYgdHlwZW9mIGVycm9yID09PSAnb2JqZWN0JyAmJiAnZXJyb3JzJyBpbiBlcnJvciAmJiAnd2FybmluZ3MnIGluIGVycm9yKSB7XG4gICAgICByZXR1cm4gZXJyb3IgYXMgQnVpbGRGYWlsdXJlO1xuICAgIH1cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVNaXNzaW5nRmlsZUVycm9yKHJlcXVlc3Q6IHN0cmluZywgb3JpZ2luYWw6IHN0cmluZywgcm9vdDogc3RyaW5nKTogUGFydGlhbE1lc3NhZ2Uge1xuICBjb25zdCBlcnJvciA9IHtcbiAgICB0ZXh0OiBgRmlsZSAnJHtwYXRoLnJlbGF0aXZlKHJvb3QsIHJlcXVlc3QpfScgaXMgbWlzc2luZyBmcm9tIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uLmAsXG4gICAgbm90ZXM6IFtcbiAgICAgIHtcbiAgICAgICAgdGV4dDogYEVuc3VyZSB0aGUgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0gdmlhIHRoZSAnZmlsZXMnIG9yICdpbmNsdWRlJyBwcm9wZXJ0eS5gLFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xuXG4gIGlmIChyZXF1ZXN0ICE9PSBvcmlnaW5hbCkge1xuICAgIGVycm9yLm5vdGVzLnB1c2goe1xuICAgICAgdGV4dDogYEZpbGUgaXMgcmVxdWVzdGVkIGZyb20gYSBmaWxlIHJlcGxhY2VtZW50IG9mICcke3BhdGgucmVsYXRpdmUocm9vdCwgb3JpZ2luYWwpfScuYCxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBlcnJvcjtcbn1cbiJdfQ==