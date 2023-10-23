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
                    if (compilerOptions.compilationMode === 'partial') {
                        setupWarnings?.push({
                            text: 'Angular partial compilation mode is not supported when building applications.',
                            location: null,
                            notes: [{ text: 'Full compilation mode will be used instead.' }],
                        });
                        compilerOptions.compilationMode = 'full';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVdILDhEQUFpQztBQUNqQywrQ0FBNEM7QUFDNUMsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUN6Qyw0RUFBZ0U7QUFDaEUsc0VBQWtFO0FBRWxFLDRDQUE4RjtBQUc5RiwrQ0FBOEY7QUFDOUYsMkRBQTBGO0FBQzFGLG1FQUFxRTtBQUNyRSxxRUFBZ0U7QUFDaEUsaUVBQWlFO0FBaUJqRSxrREFBa0Q7QUFDbEQsU0FBZ0Isb0JBQW9CLENBQ2xDLGFBQW9DLEVBQ3BDLFlBQXVFO0lBRXZFLE9BQU87UUFDTCxJQUFJLEVBQUUsa0JBQWtCO1FBQ3hCLGtEQUFrRDtRQUNsRCxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQWtCO1lBQzVCLElBQUksYUFBYSxHQUFpQyxFQUFFLENBQUM7WUFDckQsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLGdCQUFnQixDQUFDO1lBRS9ELElBQUksWUFBWSxHQUFHLGFBQWEsQ0FBQyxRQUFRLENBQUM7WUFDMUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFO2dCQUNyQixnRUFBZ0U7Z0JBQ2hFLHlGQUF5RjtnQkFDekYsSUFBSTtvQkFDRixZQUFZLEdBQUcsTUFBTSxJQUFBLG1CQUFRLEVBQUMsWUFBWSxDQUFDLENBQUM7aUJBQzdDO2dCQUFDLE1BQU0sR0FBRTthQUNYO1lBRUQsMERBQTBEO1lBQzFELE1BQU0scUJBQXFCLEdBQUcsSUFBSSw4Q0FBcUIsQ0FBQyxhQUFhLEVBQUUsZ0NBQVUsQ0FBQyxDQUFDO1lBRW5G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LFFBQWdCLEVBQUUsSUFBWTtJQUM3RSxNQUFNLEtBQUssR0FBRztRQUNaLElBQUksRUFBRSxTQUFTLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQywrQ0FBK0M7UUFDMUYsS0FBSyxFQUFFO1lBQ0w7Z0JBQ0UsSUFBSSxFQUFFLDBGQUEwRjthQUNqRztTQUNGO0tBQ0YsQ0FBQztJQUVGLElBQUksT0FBTyxLQUFLLFFBQVEsRUFBRTtRQUN4QixLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNmLElBQUksRUFBRSxpREFBaUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUk7U0FDekYsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBCdWlsZEZhaWx1cmUsXG4gIE1ldGFmaWxlLFxuICBPblN0YXJ0UmVzdWx0LFxuICBPdXRwdXRGaWxlLFxuICBQYXJ0aWFsTWVzc2FnZSxcbiAgUGx1Z2luLFxuICBQbHVnaW5CdWlsZCxcbn0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IHJlYWxwYXRoIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBwYXRoVG9GaWxlVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IHsgbWF4V29ya2VycyB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgSmF2YVNjcmlwdFRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vamF2YXNjcmlwdC10cmFuc2Zvcm1lcic7XG5pbXBvcnQgeyBMb2FkUmVzdWx0Q2FjaGUgfSBmcm9tICcuLi9sb2FkLXJlc3VsdC1jYWNoZSc7XG5pbXBvcnQgeyBsb2dDdW11bGF0aXZlRHVyYXRpb25zLCBwcm9maWxlQXN5bmMsIHJlc2V0Q3VtdWxhdGl2ZUR1cmF0aW9ucyB9IGZyb20gJy4uL3Byb2ZpbGluZyc7XG5pbXBvcnQgeyBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyB9IGZyb20gJy4uL3N0eWxlc2hlZXRzL2J1bmRsZS1vcHRpb25zJztcbmltcG9ydCB7IEFuZ3VsYXJIb3N0T3B0aW9ucyB9IGZyb20gJy4vYW5ndWxhci1ob3N0JztcbmltcG9ydCB7IEFuZ3VsYXJDb21waWxhdGlvbiwgTm9vcENvbXBpbGF0aW9uLCBjcmVhdGVBbmd1bGFyQ29tcGlsYXRpb24gfSBmcm9tICcuL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7IFNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZSwgZ2V0U2hhcmVkQ29tcGlsYXRpb25TdGF0ZSB9IGZyb20gJy4vY29tcGlsYXRpb24tc3RhdGUnO1xuaW1wb3J0IHsgQ29tcG9uZW50U3R5bGVzaGVldEJ1bmRsZXIgfSBmcm9tICcuL2NvbXBvbmVudC1zdHlsZXNoZWV0cyc7XG5pbXBvcnQgeyBGaWxlUmVmZXJlbmNlVHJhY2tlciB9IGZyb20gJy4vZmlsZS1yZWZlcmVuY2UtdHJhY2tlcic7XG5pbXBvcnQgeyBzZXR1cEppdFBsdWdpbkNhbGxiYWNrcyB9IGZyb20gJy4vaml0LXBsdWdpbi1jYWxsYmFja3MnO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlIH0gZnJvbSAnLi9zb3VyY2UtZmlsZS1jYWNoZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZXJQbHVnaW5PcHRpb25zIHtcbiAgc291cmNlbWFwOiBib29sZWFuO1xuICB0c2NvbmZpZzogc3RyaW5nO1xuICBqaXQ/OiBib29sZWFuO1xuICAvKiogU2tpcCBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uIHNldHVwLiBUaGlzIGlzIHVzZWZ1bCB0byByZS11c2UgdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gZnJvbSBhbm90aGVyIHBsdWdpbi4gKi9cbiAgbm9vcFR5cGVTY3JpcHRDb21waWxhdGlvbj86IGJvb2xlYW47XG4gIGFkdmFuY2VkT3B0aW1pemF0aW9ucz86IGJvb2xlYW47XG4gIHRoaXJkUGFydHlTb3VyY2VtYXBzPzogYm9vbGVhbjtcbiAgZmlsZVJlcGxhY2VtZW50cz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZTtcbiAgbG9hZFJlc3VsdENhY2hlPzogTG9hZFJlc3VsdENhY2hlO1xuICBpbmNyZW1lbnRhbDogYm9vbGVhbjtcbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgcGx1Z2luT3B0aW9uczogQ29tcGlsZXJQbHVnaW5PcHRpb25zLFxuICBzdHlsZU9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zICYgeyBpbmxpbmVTdHlsZUxhbmd1YWdlOiBzdHJpbmcgfSxcbik6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItY29tcGlsZXInLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG4gICAgYXN5bmMgc2V0dXAoYnVpbGQ6IFBsdWdpbkJ1aWxkKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICBsZXQgc2V0dXBXYXJuaW5nczogUGFydGlhbE1lc3NhZ2VbXSB8IHVuZGVmaW5lZCA9IFtdO1xuICAgICAgY29uc3QgcHJlc2VydmVTeW1saW5rcyA9IGJ1aWxkLmluaXRpYWxPcHRpb25zLnByZXNlcnZlU3ltbGlua3M7XG5cbiAgICAgIGxldCB0c2NvbmZpZ1BhdGggPSBwbHVnaW5PcHRpb25zLnRzY29uZmlnO1xuICAgICAgaWYgKCFwcmVzZXJ2ZVN5bWxpbmtzKSB7XG4gICAgICAgIC8vIFVzZSB0aGUgcmVhbCBwYXRoIG9mIHRoZSB0c2NvbmZpZyBpZiBub3QgcHJlc2VydmluZyBzeW1saW5rcy5cbiAgICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoZSBUUyBzb3VyY2UgZmlsZSBwYXRocyBhcmUgYmFzZWQgb24gdGhlIHJlYWwgcGF0aCBvZiB0aGUgY29uZmlndXJhdGlvbi5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0c2NvbmZpZ1BhdGggPSBhd2FpdCByZWFscGF0aCh0c2NvbmZpZ1BhdGgpO1xuICAgICAgICB9IGNhdGNoIHt9XG4gICAgICB9XG5cbiAgICAgIC8vIEluaXRpYWxpemUgYSB3b3JrZXIgcG9vbCBmb3IgSmF2YVNjcmlwdCB0cmFuc2Zvcm1hdGlvbnNcbiAgICAgIGNvbnN0IGphdmFzY3JpcHRUcmFuc2Zvcm1lciA9IG5ldyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIocGx1Z2luT3B0aW9ucywgbWF4V29ya2Vycyk7XG5cbiAgICAgIC8vIFNldHVwIGRlZmluZXMgYmFzZWQgb24gdGhlIHZhbHVlcyB1c2VkIGJ5IHRoZSBBbmd1bGFyIGNvbXBpbGVyLWNsaVxuICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lID8/PSB7fTtcbiAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLmRlZmluZVsnbmdJMThuQ2xvc3VyZU1vZGUnXSA/Pz0gJ2ZhbHNlJztcblxuICAgICAgLy8gVGhlIGluLW1lbW9yeSBjYWNoZSBvZiBUeXBlU2NyaXB0IGZpbGUgb3V0cHV0cyB3aWxsIGJlIHVzZWQgZHVyaW5nIHRoZSBidWlsZCBpbiBgb25Mb2FkYCBjYWxsYmFja3MgZm9yIFRTIGZpbGVzLlxuICAgICAgLy8gQSBzdHJpbmcgdmFsdWUgaW5kaWNhdGVzIGRpcmVjdCBUUy9ORyBvdXRwdXQgYW5kIGEgVWludDhBcnJheSBpbmRpY2F0ZXMgZnVsbHkgdHJhbnNmb3JtZWQgY29kZS5cbiAgICAgIGNvbnN0IHR5cGVTY3JpcHRGaWxlQ2FjaGUgPVxuICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8udHlwZVNjcmlwdEZpbGVDYWNoZSA/P1xuICAgICAgICBuZXcgTWFwPHN0cmluZywgc3RyaW5nIHwgVWludDhBcnJheT4oKTtcblxuICAgICAgLy8gVGhlIHJlc291cmNlcyBmcm9tIGNvbXBvbmVudCBzdHlsZXNoZWV0cyBhbmQgd2ViIHdvcmtlcnMgdGhhdCB3aWxsIGJlIGFkZGVkIHRvIHRoZSBidWlsZCByZXN1bHRzIG91dHB1dCBmaWxlc1xuICAgICAgY29uc3QgYWRkaXRpb25hbFJlc3VsdHMgPSBuZXcgTWFwPFxuICAgICAgICBzdHJpbmcsXG4gICAgICAgIHsgb3V0cHV0RmlsZXM/OiBPdXRwdXRGaWxlW107IG1ldGFmaWxlPzogTWV0YWZpbGU7IGVycm9ycz86IFBhcnRpYWxNZXNzYWdlW10gfVxuICAgICAgPigpO1xuXG4gICAgICAvLyBDcmVhdGUgbmV3IHJldXNhYmxlIGNvbXBpbGF0aW9uIGZvciB0aGUgYXBwcm9wcmlhdGUgbW9kZSBiYXNlZCBvbiB0aGUgYGppdGAgcGx1Z2luIG9wdGlvblxuICAgICAgY29uc3QgY29tcGlsYXRpb246IEFuZ3VsYXJDb21waWxhdGlvbiA9IHBsdWdpbk9wdGlvbnMubm9vcFR5cGVTY3JpcHRDb21waWxhdGlvblxuICAgICAgICA/IG5ldyBOb29wQ29tcGlsYXRpb24oKVxuICAgICAgICA6IGF3YWl0IGNyZWF0ZUFuZ3VsYXJDb21waWxhdGlvbighIXBsdWdpbk9wdGlvbnMuaml0KTtcblxuICAgICAgLy8gRGV0ZXJtaW5lcyBpZiBUeXBlU2NyaXB0IHNob3VsZCBwcm9jZXNzIEphdmFTY3JpcHQgZmlsZXMgYmFzZWQgb24gdHNjb25maWcgYGFsbG93SnNgIG9wdGlvblxuICAgICAgbGV0IHNob3VsZFRzSWdub3JlSnMgPSB0cnVlO1xuXG4gICAgICAvLyBUcmFjayBpbmNyZW1lbnRhbCBjb21wb25lbnQgc3R5bGVzaGVldCBidWlsZHNcbiAgICAgIGNvbnN0IHN0eWxlc2hlZXRCdW5kbGVyID0gbmV3IENvbXBvbmVudFN0eWxlc2hlZXRCdW5kbGVyKFxuICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICAgIHBsdWdpbk9wdGlvbnMuaW5jcmVtZW50YWwsXG4gICAgICApO1xuICAgICAgbGV0IHNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZTogU2hhcmVkVFNDb21waWxhdGlvblN0YXRlIHwgdW5kZWZpbmVkO1xuXG4gICAgICAvLyBUbyBmdWxseSBpbnZhbGlkYXRlIGZpbGVzLCB0cmFjayByZXNvdXJjZSByZWZlcmVuY2VkIGZpbGVzIGFuZCB0aGVpciByZWZlcmVuY2luZyBzb3VyY2VcbiAgICAgIGNvbnN0IHJlZmVyZW5jZWRGaWxlVHJhY2tlciA9IG5ldyBGaWxlUmVmZXJlbmNlVHJhY2tlcigpO1xuXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuICAgICAgYnVpbGQub25TdGFydChhc3luYyAoKSA9PiB7XG4gICAgICAgIHNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZSA9IGdldFNoYXJlZENvbXBpbGF0aW9uU3RhdGUoKTtcbiAgICAgICAgaWYgKCEoY29tcGlsYXRpb24gaW5zdGFuY2VvZiBOb29wQ29tcGlsYXRpb24pKSB7XG4gICAgICAgICAgc2hhcmVkVFNDb21waWxhdGlvblN0YXRlLm1hcmtBc0luUHJvZ3Jlc3MoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlc3VsdDogT25TdGFydFJlc3VsdCA9IHtcbiAgICAgICAgICB3YXJuaW5nczogc2V0dXBXYXJuaW5ncyxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBSZXNldCBkZWJ1ZyBwZXJmb3JtYW5jZSB0cmFja2luZ1xuICAgICAgICByZXNldEN1bXVsYXRpdmVEdXJhdGlvbnMoKTtcblxuICAgICAgICAvLyBVcGRhdGUgdGhlIHJlZmVyZW5jZSB0cmFja2VyIGFuZCBnZW5lcmF0ZSBhIGZ1bGwgc2V0IG9mIG1vZGlmaWVkIGZpbGVzIGZvciB0aGVcbiAgICAgICAgLy8gQW5ndWxhciBjb21waWxlciB3aGljaCBkb2VzIG5vdCBoYXZlIGRpcmVjdCBrbm93bGVkZ2Ugb2YgdHJhbnNpdGl2ZSByZXNvdXJjZVxuICAgICAgICAvLyBkZXBlbmRlbmNpZXMgb3Igd2ViIHdvcmtlciBwcm9jZXNzaW5nLlxuICAgICAgICBsZXQgbW9kaWZpZWRGaWxlcztcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5tb2RpZmllZEZpbGVzLnNpemUgJiZcbiAgICAgICAgICByZWZlcmVuY2VkRmlsZVRyYWNrZXIgJiZcbiAgICAgICAgICAhcGx1Z2luT3B0aW9ucy5ub29wVHlwZVNjcmlwdENvbXBpbGF0aW9uXG4gICAgICAgICkge1xuICAgICAgICAgIC8vIFRPRE86IERpZmZlcmVudGlhdGUgYmV0d2VlbiBjaGFuZ2VkIGlucHV0IGZpbGVzIGFuZCBzdGFsZSBvdXRwdXQgZmlsZXNcbiAgICAgICAgICBtb2RpZmllZEZpbGVzID0gcmVmZXJlbmNlZEZpbGVUcmFja2VyLnVwZGF0ZShwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZS5tb2RpZmllZEZpbGVzKTtcbiAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZS5pbnZhbGlkYXRlKG1vZGlmaWVkRmlsZXMpO1xuICAgICAgICAgIHN0eWxlc2hlZXRCdW5kbGVyLmludmFsaWRhdGUobW9kaWZpZWRGaWxlcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXG4gICAgICAgICAgIXBsdWdpbk9wdGlvbnMubm9vcFR5cGVTY3JpcHRDb21waWxhdGlvbiAmJlxuICAgICAgICAgIGNvbXBpbGF0aW9uLnVwZGF0ZSAmJlxuICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5tb2RpZmllZEZpbGVzLnNpemVcbiAgICAgICAgKSB7XG4gICAgICAgICAgYXdhaXQgY29tcGlsYXRpb24udXBkYXRlKG1vZGlmaWVkRmlsZXMgPz8gcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUubW9kaWZpZWRGaWxlcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDcmVhdGUgQW5ndWxhciBjb21waWxlciBob3N0IG9wdGlvbnNcbiAgICAgICAgY29uc3QgaG9zdE9wdGlvbnM6IEFuZ3VsYXJIb3N0T3B0aW9ucyA9IHtcbiAgICAgICAgICBmaWxlUmVwbGFjZW1lbnRzOiBwbHVnaW5PcHRpb25zLmZpbGVSZXBsYWNlbWVudHMsXG4gICAgICAgICAgbW9kaWZpZWRGaWxlcyxcbiAgICAgICAgICBzb3VyY2VGaWxlQ2FjaGU6IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlLFxuICAgICAgICAgIGFzeW5jIHRyYW5zZm9ybVN0eWxlc2hlZXQoZGF0YSwgY29udGFpbmluZ0ZpbGUsIHN0eWxlc2hlZXRGaWxlKSB7XG4gICAgICAgICAgICBsZXQgc3R5bGVzaGVldFJlc3VsdDtcblxuICAgICAgICAgICAgLy8gU3R5bGVzaGVldCBmaWxlIG9ubHkgZXhpc3RzIGZvciBleHRlcm5hbCBzdHlsZXNoZWV0c1xuICAgICAgICAgICAgaWYgKHN0eWxlc2hlZXRGaWxlKSB7XG4gICAgICAgICAgICAgIHN0eWxlc2hlZXRSZXN1bHQgPSBhd2FpdCBzdHlsZXNoZWV0QnVuZGxlci5idW5kbGVGaWxlKHN0eWxlc2hlZXRGaWxlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHN0eWxlc2hlZXRSZXN1bHQgPSBhd2FpdCBzdHlsZXNoZWV0QnVuZGxlci5idW5kbGVJbmxpbmUoXG4gICAgICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgICAgICBjb250YWluaW5nRmlsZSxcbiAgICAgICAgICAgICAgICBzdHlsZU9wdGlvbnMuaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgeyBjb250ZW50cywgcmVzb3VyY2VGaWxlcywgcmVmZXJlbmNlZEZpbGVzLCBlcnJvcnMsIHdhcm5pbmdzIH0gPSBzdHlsZXNoZWV0UmVzdWx0O1xuICAgICAgICAgICAgaWYgKGVycm9ycykge1xuICAgICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgICAgIGFkZGl0aW9uYWxSZXN1bHRzLnNldChzdHlsZXNoZWV0RmlsZSA/PyBjb250YWluaW5nRmlsZSwge1xuICAgICAgICAgICAgICBvdXRwdXRGaWxlczogcmVzb3VyY2VGaWxlcyxcbiAgICAgICAgICAgICAgbWV0YWZpbGU6IHN0eWxlc2hlZXRSZXN1bHQubWV0YWZpbGUsXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaWYgKHJlZmVyZW5jZWRGaWxlcykge1xuICAgICAgICAgICAgICByZWZlcmVuY2VkRmlsZVRyYWNrZXIuYWRkKGNvbnRhaW5pbmdGaWxlLCByZWZlcmVuY2VkRmlsZXMpO1xuICAgICAgICAgICAgICBpZiAoc3R5bGVzaGVldEZpbGUpIHtcbiAgICAgICAgICAgICAgICAvLyBBbmd1bGFyIEFPVCBjb21waWxlciBuZWVkcyBtb2RpZmllZCBkaXJlY3QgcmVzb3VyY2UgZmlsZXMgdG8gY29ycmVjdGx5IGludmFsaWRhdGUgaXRzIGFuYWx5c2lzXG4gICAgICAgICAgICAgICAgcmVmZXJlbmNlZEZpbGVUcmFja2VyLmFkZChzdHlsZXNoZWV0RmlsZSwgcmVmZXJlbmNlZEZpbGVzKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY29udGVudHM7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcm9jZXNzV2ViV29ya2VyKHdvcmtlckZpbGUsIGNvbnRhaW5pbmdGaWxlKSB7XG4gICAgICAgICAgICBjb25zdCBmdWxsV29ya2VyUGF0aCA9IHBhdGguam9pbihwYXRoLmRpcm5hbWUoY29udGFpbmluZ0ZpbGUpLCB3b3JrZXJGaWxlKTtcbiAgICAgICAgICAgIC8vIFRoZSBzeW5jaHJvbm91cyBBUEkgbXVzdCBiZSB1c2VkIGR1ZSB0byB0aGUgVHlwZVNjcmlwdCBjb21waWxhdGlvbiBjdXJyZW50bHkgYmVpbmdcbiAgICAgICAgICAgIC8vIGZ1bGx5IHN5bmNocm9ub3VzIGFuZCB0aGlzIHByb2Nlc3MgY2FsbGJhY2sgYmVpbmcgY2FsbGVkIGZyb20gd2l0aGluIGEgVHlwZVNjcmlwdFxuICAgICAgICAgICAgLy8gdHJhbnNmb3JtZXIuXG4gICAgICAgICAgICBjb25zdCB3b3JrZXJSZXN1bHQgPSBidW5kbGVXZWJXb3JrZXIoYnVpbGQsIHBsdWdpbk9wdGlvbnMsIGZ1bGxXb3JrZXJQYXRoKTtcblxuICAgICAgICAgICAgKHJlc3VsdC53YXJuaW5ncyA/Pz0gW10pLnB1c2goLi4ud29ya2VyUmVzdWx0Lndhcm5pbmdzKTtcbiAgICAgICAgICAgIGlmICh3b3JrZXJSZXN1bHQuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLndvcmtlclJlc3VsdC5lcnJvcnMpO1xuICAgICAgICAgICAgICAvLyBUcmFjayB3b3JrZXIgZmlsZSBlcnJvcnMgdG8gYWxsb3cgcmVidWlsZHMgb24gY2hhbmdlc1xuICAgICAgICAgICAgICByZWZlcmVuY2VkRmlsZVRyYWNrZXIuYWRkKFxuICAgICAgICAgICAgICAgIGNvbnRhaW5pbmdGaWxlLFxuICAgICAgICAgICAgICAgIHdvcmtlclJlc3VsdC5lcnJvcnNcbiAgICAgICAgICAgICAgICAgIC5tYXAoKGVycm9yKSA9PiBlcnJvci5sb2NhdGlvbj8uZmlsZSlcbiAgICAgICAgICAgICAgICAgIC5maWx0ZXIoKGZpbGUpOiBmaWxlIGlzIHN0cmluZyA9PiAhIWZpbGUpXG4gICAgICAgICAgICAgICAgICAubWFwKChmaWxlKSA9PiBwYXRoLmpvaW4oYnVpbGQuaW5pdGlhbE9wdGlvbnMuYWJzV29ya2luZ0RpciA/PyAnJywgZmlsZSkpLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBhZGRpdGlvbmFsUmVzdWx0cy5zZXQoZnVsbFdvcmtlclBhdGgsIHsgZXJyb3JzOiByZXN1bHQuZXJyb3JzIH0pO1xuXG4gICAgICAgICAgICAgIC8vIFJldHVybiB0aGUgb3JpZ2luYWwgcGF0aCBpZiB0aGUgYnVpbGQgZmFpbGVkXG4gICAgICAgICAgICAgIHJldHVybiB3b3JrZXJGaWxlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhc3NlcnQoJ291dHB1dEZpbGVzJyBpbiB3b3JrZXJSZXN1bHQsICdJbnZhbGlkIHdlYiB3b3JrZXIgYnVuZGxlIHJlc3VsdC4nKTtcbiAgICAgICAgICAgIGFkZGl0aW9uYWxSZXN1bHRzLnNldChmdWxsV29ya2VyUGF0aCwge1xuICAgICAgICAgICAgICBvdXRwdXRGaWxlczogd29ya2VyUmVzdWx0Lm91dHB1dEZpbGVzLFxuICAgICAgICAgICAgICBtZXRhZmlsZTogd29ya2VyUmVzdWx0Lm1ldGFmaWxlLFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJlZmVyZW5jZWRGaWxlVHJhY2tlci5hZGQoXG4gICAgICAgICAgICAgIGNvbnRhaW5pbmdGaWxlLFxuICAgICAgICAgICAgICBPYmplY3Qua2V5cyh3b3JrZXJSZXN1bHQubWV0YWZpbGUuaW5wdXRzKS5tYXAoKGlucHV0KSA9PlxuICAgICAgICAgICAgICAgIHBhdGguam9pbihidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyID8/ICcnLCBpbnB1dCksXG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAvLyBSZXR1cm4gYnVuZGxlZCB3b3JrZXIgZmlsZSBlbnRyeSBuYW1lIHRvIGJlIHVzZWQgaW4gdGhlIGJ1aWx0IG91dHB1dFxuICAgICAgICAgICAgY29uc3Qgd29ya2VyQ29kZUZpbGUgPSB3b3JrZXJSZXN1bHQub3V0cHV0RmlsZXMuZmluZCgoZmlsZSkgPT5cbiAgICAgICAgICAgICAgZmlsZS5wYXRoLmVuZHNXaXRoKCcuanMnKSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBhc3NlcnQod29ya2VyQ29kZUZpbGUsICdXZWIgV29ya2VyIGJ1bmRsZWQgY29kZSBmaWxlIHNob3VsZCBhbHdheXMgYmUgcHJlc2VudC4nKTtcblxuICAgICAgICAgICAgcmV0dXJuIHBhdGgucmVsYXRpdmUoYnVpbGQuaW5pdGlhbE9wdGlvbnMub3V0ZGlyID8/ICcnLCB3b3JrZXJDb2RlRmlsZS5wYXRoKTtcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIEluaXRpYWxpemUgdGhlIEFuZ3VsYXIgY29tcGlsYXRpb24gZm9yIHRoZSBjdXJyZW50IGJ1aWxkLlxuICAgICAgICAvLyBJbiB3YXRjaCBtb2RlLCBwcmV2aW91cyBidWlsZCBzdGF0ZSB3aWxsIGJlIHJldXNlZC5cbiAgICAgICAgY29uc3Qge1xuICAgICAgICAgIGNvbXBpbGVyT3B0aW9uczogeyBhbGxvd0pzIH0sXG4gICAgICAgICAgcmVmZXJlbmNlZEZpbGVzLFxuICAgICAgICB9ID0gYXdhaXQgY29tcGlsYXRpb24uaW5pdGlhbGl6ZSh0c2NvbmZpZ1BhdGgsIGhvc3RPcHRpb25zLCAoY29tcGlsZXJPcHRpb25zKSA9PiB7XG4gICAgICAgICAgLy8gdGFyZ2V0IG9mIDkgaXMgRVMyMDIyICh1c2luZyB0aGUgbnVtYmVyIGF2b2lkcyBhbiBleHBlbnNpdmUgaW1wb3J0IG9mIHR5cGVzY3JpcHQganVzdCBmb3IgYW4gZW51bSlcbiAgICAgICAgICBpZiAoY29tcGlsZXJPcHRpb25zLnRhcmdldCA9PT0gdW5kZWZpbmVkIHx8IGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPCA5KSB7XG4gICAgICAgICAgICAvLyBJZiAndXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHMnIGlzIGFscmVhZHkgZGVmaW5lZCBpbiB0aGUgdXNlcnMgcHJvamVjdCBsZWF2ZSB0aGUgdmFsdWUgYXMgaXMuXG4gICAgICAgICAgICAvLyBPdGhlcndpc2UgZmFsbGJhY2sgdG8gZmFsc2UgZHVlIHRvIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvNDU5OTVcbiAgICAgICAgICAgIC8vIHdoaWNoIGJyZWFrcyB0aGUgZGVwcmVjYXRlZCBgQEVmZmVjdHNgIE5HUlggZGVjb3JhdG9yIGFuZCBwb3RlbnRpYWxseSBvdGhlciBleGlzdGluZyBjb2RlIGFzIHdlbGwuXG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMudGFyZ2V0ID0gOTtcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy51c2VEZWZpbmVGb3JDbGFzc0ZpZWxkcyA/Pz0gZmFsc2U7XG5cbiAgICAgICAgICAgIC8vIE9ubHkgYWRkIHRoZSB3YXJuaW5nIG9uIHRoZSBpbml0aWFsIGJ1aWxkXG4gICAgICAgICAgICBzZXR1cFdhcm5pbmdzPy5wdXNoKHtcbiAgICAgICAgICAgICAgdGV4dDpcbiAgICAgICAgICAgICAgICAnVHlwZVNjcmlwdCBjb21waWxlciBvcHRpb25zIFwidGFyZ2V0XCIgYW5kIFwidXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHNcIiBhcmUgc2V0IHRvIFwiRVMyMDIyXCIgYW5kICcgK1xuICAgICAgICAgICAgICAgICdcImZhbHNlXCIgcmVzcGVjdGl2ZWx5IGJ5IHRoZSBBbmd1bGFyIENMSS4nLFxuICAgICAgICAgICAgICBsb2NhdGlvbjogeyBmaWxlOiBwbHVnaW5PcHRpb25zLnRzY29uZmlnIH0sXG4gICAgICAgICAgICAgIG5vdGVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgdGV4dDpcbiAgICAgICAgICAgICAgICAgICAgJ1RvIGNvbnRyb2wgRUNNQSB2ZXJzaW9uIGFuZCBmZWF0dXJlcyB1c2UgdGhlIEJyb3dlcnNsaXN0IGNvbmZpZ3VyYXRpb24uICcgK1xuICAgICAgICAgICAgICAgICAgICAnRm9yIG1vcmUgaW5mb3JtYXRpb24sIHNlZSBodHRwczovL2FuZ3VsYXIuaW8vZ3VpZGUvYnVpbGQjY29uZmlndXJpbmctYnJvd3Nlci1jb21wYXRpYmlsaXR5JyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNvbXBpbGVyT3B0aW9ucy5jb21waWxhdGlvbk1vZGUgPT09ICdwYXJ0aWFsJykge1xuICAgICAgICAgICAgc2V0dXBXYXJuaW5ncz8ucHVzaCh7XG4gICAgICAgICAgICAgIHRleHQ6ICdBbmd1bGFyIHBhcnRpYWwgY29tcGlsYXRpb24gbW9kZSBpcyBub3Qgc3VwcG9ydGVkIHdoZW4gYnVpbGRpbmcgYXBwbGljYXRpb25zLicsXG4gICAgICAgICAgICAgIGxvY2F0aW9uOiBudWxsLFxuICAgICAgICAgICAgICBub3RlczogW3sgdGV4dDogJ0Z1bGwgY29tcGlsYXRpb24gbW9kZSB3aWxsIGJlIHVzZWQgaW5zdGVhZC4nIH1dLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMuY29tcGlsYXRpb25Nb2RlID0gJ2Z1bGwnO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEVuYWJsZSBpbmNyZW1lbnRhbCBjb21waWxhdGlvbiBieSBkZWZhdWx0IGlmIGNhY2hpbmcgaXMgZW5hYmxlZFxuICAgICAgICAgIGlmIChwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8ucGVyc2lzdGVudENhY2hlUGF0aCkge1xuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLmluY3JlbWVudGFsID8/PSB0cnVlO1xuICAgICAgICAgICAgLy8gU2V0IHRoZSBidWlsZCBpbmZvIGZpbGUgbG9jYXRpb24gdG8gdGhlIGNvbmZpZ3VyZWQgY2FjaGUgZGlyZWN0b3J5XG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMudHNCdWlsZEluZm9GaWxlID0gcGF0aC5qb2luKFxuICAgICAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8ucGVyc2lzdGVudENhY2hlUGF0aCxcbiAgICAgICAgICAgICAgJy50c2J1aWxkaW5mbycsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMuaW5jcmVtZW50YWwgPSBmYWxzZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4uY29tcGlsZXJPcHRpb25zLFxuICAgICAgICAgICAgbm9FbWl0T25FcnJvcjogZmFsc2UsXG4gICAgICAgICAgICBpbmxpbmVTb3VyY2VzOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIGlubGluZVNvdXJjZU1hcDogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgICBtYXBSb290OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBzb3VyY2VSb290OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgICBzaG91bGRUc0lnbm9yZUpzID0gIWFsbG93SnM7XG5cbiAgICAgICAgaWYgKGNvbXBpbGF0aW9uIGluc3RhbmNlb2YgTm9vcENvbXBpbGF0aW9uKSB7XG4gICAgICAgICAgYXdhaXQgc2hhcmVkVFNDb21waWxhdGlvblN0YXRlLndhaXRVbnRpbFJlYWR5O1xuXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRpYWdub3N0aWNzID0gYXdhaXQgY29tcGlsYXRpb24uZGlhZ25vc2VGaWxlcygpO1xuICAgICAgICBpZiAoZGlhZ25vc3RpY3MuZXJyb3JzKSB7XG4gICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLmRpYWdub3N0aWNzLmVycm9ycyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRpYWdub3N0aWNzLndhcm5pbmdzKSB7XG4gICAgICAgICAgKHJlc3VsdC53YXJuaW5ncyA/Pz0gW10pLnB1c2goLi4uZGlhZ25vc3RpY3Mud2FybmluZ3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIFR5cGVTY3JpcHQgZmlsZSBvdXRwdXQgY2FjaGUgZm9yIGFsbCBhZmZlY3RlZCBmaWxlc1xuICAgICAgICBhd2FpdCBwcm9maWxlQXN5bmMoJ05HX0VNSVRfVFMnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgZm9yIChjb25zdCB7IGZpbGVuYW1lLCBjb250ZW50cyB9IG9mIGF3YWl0IGNvbXBpbGF0aW9uLmVtaXRBZmZlY3RlZEZpbGVzKCkpIHtcbiAgICAgICAgICAgIHR5cGVTY3JpcHRGaWxlQ2FjaGUuc2V0KHBhdGhUb0ZpbGVVUkwoZmlsZW5hbWUpLmhyZWYsIGNvbnRlbnRzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZCBlcnJvcnMgZnJvbSBmYWlsZWQgYWRkaXRpb25hbCByZXN1bHRzLlxuICAgICAgICAvLyBUaGlzIG11c3QgYmUgZG9uZSBhZnRlciBlbWl0IHRvIGNhcHR1cmUgbGF0ZXN0IHdlYiB3b3JrZXIgcmVzdWx0cy5cbiAgICAgICAgZm9yIChjb25zdCB7IGVycm9ycyB9IG9mIGFkZGl0aW9uYWxSZXN1bHRzLnZhbHVlcygpKSB7XG4gICAgICAgICAgaWYgKGVycm9ycykge1xuICAgICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3RvcmUgcmVmZXJlbmNlZCBmaWxlcyBmb3IgdXBkYXRlZCBmaWxlIHdhdGNoaW5nIGlmIGVuYWJsZWRcbiAgICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlKSB7XG4gICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUucmVmZXJlbmNlZEZpbGVzID0gW1xuICAgICAgICAgICAgLi4ucmVmZXJlbmNlZEZpbGVzLFxuICAgICAgICAgICAgLi4ucmVmZXJlbmNlZEZpbGVUcmFja2VyLnJlZmVyZW5jZWRGaWxlcyxcbiAgICAgICAgICBdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzZXQgdGhlIHNldHVwIHdhcm5pbmdzIHNvIHRoYXQgdGhleSBhcmUgb25seSBzaG93biBkdXJpbmcgdGhlIGZpcnN0IGJ1aWxkLlxuICAgICAgICBzZXR1cFdhcm5pbmdzID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIHNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZS5tYXJrQXNSZWFkeSgpO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9banRdc3g/JC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cz8uW2FyZ3MucGF0aF0gPz8gYXJncy5wYXRoO1xuXG4gICAgICAgIC8vIFNraXAgVFMgbG9hZCBhdHRlbXB0IGlmIEpTIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gbm90IGVuYWJsZWQgYW5kIGZpbGUgaXMgSlNcbiAgICAgICAgaWYgKHNob3VsZFRzSWdub3JlSnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KHJlcXVlc3QpKSB7XG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBmaWxlbmFtZSBpcyBjdXJyZW50bHkgdXNlZCBhcyBhIGNhY2hlIGtleS4gU2luY2UgdGhlIGNhY2hlIGlzIG1lbW9yeSBvbmx5LFxuICAgICAgICAvLyB0aGUgb3B0aW9ucyBjYW5ub3QgY2hhbmdlIGFuZCBkbyBub3QgbmVlZCB0byBiZSByZXByZXNlbnRlZCBpbiB0aGUga2V5LiBJZiB0aGVcbiAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAvLyB3b3VsZCBuZWVkIHRvIGJlIGFkZGVkIHRvIHRoZSBrZXkgYXMgd2VsbCBhcyBhIGNoZWNrIGZvciBhbnkgY2hhbmdlIG9mIGNvbnRlbnQuXG4gICAgICAgIGxldCBjb250ZW50cyA9IHR5cGVTY3JpcHRGaWxlQ2FjaGUuZ2V0KHBhdGhUb0ZpbGVVUkwocmVxdWVzdCkuaHJlZik7XG5cbiAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBObyBUUyByZXN1bHQgaW5kaWNhdGVzIHRoZSBmaWxlIGlzIG5vdCBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0uXG4gICAgICAgICAgLy8gSWYgYWxsb3dKcyBpcyBlbmFibGVkIGFuZCB0aGUgZmlsZSBpcyBKUyB0aGVuIGRlZmVyIHRvIHRoZSBuZXh0IGxvYWQgaG9vay5cbiAgICAgICAgICBpZiAoIXNob3VsZFRzSWdub3JlSnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KHJlcXVlc3QpKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE90aGVyd2lzZSByZXR1cm4gYW4gZXJyb3JcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgIGNyZWF0ZU1pc3NpbmdGaWxlRXJyb3IocmVxdWVzdCwgYXJncy5wYXRoLCBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyID8/ICcnKSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY29udGVudHMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgLy8gQSBzdHJpbmcgaW5kaWNhdGVzIHVudHJhbnNmb3JtZWQgb3V0cHV0IGZyb20gdGhlIFRTL05HIGNvbXBpbGVyXG4gICAgICAgICAgY29udGVudHMgPSBhd2FpdCBqYXZhc2NyaXB0VHJhbnNmb3JtZXIudHJhbnNmb3JtRGF0YShcbiAgICAgICAgICAgIHJlcXVlc3QsXG4gICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgIHRydWUgLyogc2tpcExpbmtlciAqLyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgLy8gU3RvcmUgYXMgdGhlIHJldHVybmVkIFVpbnQ4QXJyYXkgdG8gYWxsb3cgY2FjaGluZyB0aGUgZnVsbHkgdHJhbnNmb3JtZWQgY29kZVxuICAgICAgICAgIHR5cGVTY3JpcHRGaWxlQ2FjaGUuc2V0KHBhdGhUb0ZpbGVVUkwocmVxdWVzdCkuaHJlZiwgY29udGVudHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9qcyQvIH0sIChhcmdzKSA9PlxuICAgICAgICBwcm9maWxlQXN5bmMoXG4gICAgICAgICAgJ05HX0VNSVRfSlMqJyxcbiAgICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAvLyBUaGUgZmlsZW5hbWUgaXMgY3VycmVudGx5IHVzZWQgYXMgYSBjYWNoZSBrZXkuIFNpbmNlIHRoZSBjYWNoZSBpcyBtZW1vcnkgb25seSxcbiAgICAgICAgICAgIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAgICAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAgICAgLy8gd291bGQgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUga2V5IGFzIHdlbGwgYXMgYSBjaGVjayBmb3IgYW55IGNoYW5nZSBvZiBjb250ZW50LlxuICAgICAgICAgICAgbGV0IGNvbnRlbnRzID0gcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LmJhYmVsRmlsZUNhY2hlLmdldChhcmdzLnBhdGgpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgY29udGVudHMgPSBhd2FpdCBqYXZhc2NyaXB0VHJhbnNmb3JtZXIudHJhbnNmb3JtRmlsZShhcmdzLnBhdGgsIHBsdWdpbk9wdGlvbnMuaml0KTtcbiAgICAgICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LmJhYmVsRmlsZUNhY2hlLnNldChhcmdzLnBhdGgsIGNvbnRlbnRzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgY29udGVudHMsXG4gICAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSxcbiAgICAgICAgICB0cnVlLFxuICAgICAgICApLFxuICAgICAgKTtcblxuICAgICAgLy8gU2V0dXAgYnVuZGxpbmcgb2YgY29tcG9uZW50IHRlbXBsYXRlcyBhbmQgc3R5bGVzaGVldHMgd2hlbiBpbiBKSVQgbW9kZVxuICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuaml0KSB7XG4gICAgICAgIHNldHVwSml0UGx1Z2luQ2FsbGJhY2tzKFxuICAgICAgICAgIGJ1aWxkLFxuICAgICAgICAgIHN0eWxlc2hlZXRCdW5kbGVyLFxuICAgICAgICAgIGFkZGl0aW9uYWxSZXN1bHRzLFxuICAgICAgICAgIHN0eWxlT3B0aW9ucy5pbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBidWlsZC5vbkVuZCgocmVzdWx0KSA9PiB7XG4gICAgICAgIGZvciAoY29uc3QgeyBvdXRwdXRGaWxlcywgbWV0YWZpbGUgfSBvZiBhZGRpdGlvbmFsUmVzdWx0cy52YWx1ZXMoKSkge1xuICAgICAgICAgIC8vIEFkZCBhbnkgYWRkaXRpb25hbCBvdXRwdXQgZmlsZXMgdG8gdGhlIG1haW4gb3V0cHV0IGZpbGVzXG4gICAgICAgICAgaWYgKG91dHB1dEZpbGVzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJlc3VsdC5vdXRwdXRGaWxlcz8ucHVzaCguLi5vdXRwdXRGaWxlcyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQ29tYmluZSBhZGRpdGlvbmFsIG1ldGFmaWxlcyB3aXRoIG1haW4gbWV0YWZpbGVcbiAgICAgICAgICBpZiAocmVzdWx0Lm1ldGFmaWxlICYmIG1ldGFmaWxlKSB7XG4gICAgICAgICAgICByZXN1bHQubWV0YWZpbGUuaW5wdXRzID0geyAuLi5yZXN1bHQubWV0YWZpbGUuaW5wdXRzLCAuLi5tZXRhZmlsZS5pbnB1dHMgfTtcbiAgICAgICAgICAgIHJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzID0geyAuLi5yZXN1bHQubWV0YWZpbGUub3V0cHV0cywgLi4ubWV0YWZpbGUub3V0cHV0cyB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxvZ0N1bXVsYXRpdmVEdXJhdGlvbnMoKTtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkRpc3Bvc2UoKCkgPT4ge1xuICAgICAgICBzaGFyZWRUU0NvbXBpbGF0aW9uU3RhdGU/LmRpc3Bvc2UoKTtcbiAgICAgICAgdm9pZCBzdHlsZXNoZWV0QnVuZGxlci5kaXNwb3NlKCk7XG4gICAgICAgIHZvaWQgY29tcGlsYXRpb24uY2xvc2U/LigpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVuZGxlV2ViV29ya2VyKFxuICBidWlsZDogUGx1Z2luQnVpbGQsXG4gIHBsdWdpbk9wdGlvbnM6IENvbXBpbGVyUGx1Z2luT3B0aW9ucyxcbiAgd29ya2VyRmlsZTogc3RyaW5nLFxuKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGJ1aWxkLmVzYnVpbGQuYnVpbGRTeW5jKHtcbiAgICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgICB3cml0ZTogZmFsc2UsXG4gICAgICBidW5kbGU6IHRydWUsXG4gICAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICAgIGZvcm1hdDogJ2VzbScsXG4gICAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgICAgbG9nTGV2ZWw6ICdzaWxlbnQnLFxuICAgICAgc291cmNlbWFwOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgIGVudHJ5TmFtZXM6ICd3b3JrZXItW2hhc2hdJyxcbiAgICAgIGVudHJ5UG9pbnRzOiBbd29ya2VyRmlsZV0sXG4gICAgICBhYnNXb3JraW5nRGlyOiBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyLFxuICAgICAgb3V0ZGlyOiBidWlsZC5pbml0aWFsT3B0aW9ucy5vdXRkaXIsXG4gICAgICBtaW5pZnlJZGVudGlmaWVyczogYnVpbGQuaW5pdGlhbE9wdGlvbnMubWluaWZ5SWRlbnRpZmllcnMsXG4gICAgICBtaW5pZnlTeW50YXg6IGJ1aWxkLmluaXRpYWxPcHRpb25zLm1pbmlmeVN5bnRheCxcbiAgICAgIG1pbmlmeVdoaXRlc3BhY2U6IGJ1aWxkLmluaXRpYWxPcHRpb25zLm1pbmlmeVdoaXRlc3BhY2UsXG4gICAgICB0YXJnZXQ6IGJ1aWxkLmluaXRpYWxPcHRpb25zLnRhcmdldCxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IgJiYgdHlwZW9mIGVycm9yID09PSAnb2JqZWN0JyAmJiAnZXJyb3JzJyBpbiBlcnJvciAmJiAnd2FybmluZ3MnIGluIGVycm9yKSB7XG4gICAgICByZXR1cm4gZXJyb3IgYXMgQnVpbGRGYWlsdXJlO1xuICAgIH1cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVNaXNzaW5nRmlsZUVycm9yKHJlcXVlc3Q6IHN0cmluZywgb3JpZ2luYWw6IHN0cmluZywgcm9vdDogc3RyaW5nKTogUGFydGlhbE1lc3NhZ2Uge1xuICBjb25zdCBlcnJvciA9IHtcbiAgICB0ZXh0OiBgRmlsZSAnJHtwYXRoLnJlbGF0aXZlKHJvb3QsIHJlcXVlc3QpfScgaXMgbWlzc2luZyBmcm9tIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uLmAsXG4gICAgbm90ZXM6IFtcbiAgICAgIHtcbiAgICAgICAgdGV4dDogYEVuc3VyZSB0aGUgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0gdmlhIHRoZSAnZmlsZXMnIG9yICdpbmNsdWRlJyBwcm9wZXJ0eS5gLFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xuXG4gIGlmIChyZXF1ZXN0ICE9PSBvcmlnaW5hbCkge1xuICAgIGVycm9yLm5vdGVzLnB1c2goe1xuICAgICAgdGV4dDogYEZpbGUgaXMgcmVxdWVzdGVkIGZyb20gYSBmaWxlIHJlcGxhY2VtZW50IG9mICcke3BhdGgucmVsYXRpdmUocm9vdCwgb3JpZ2luYWwpfScuYCxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBlcnJvcjtcbn1cbiJdfQ==