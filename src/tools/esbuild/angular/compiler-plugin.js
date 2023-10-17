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
            // The stylesheet resources from component stylesheets that will be added to the build results output files
            let additionalOutputFiles = [];
            let additionalMetafiles;
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
                // Reset additional output files
                additionalOutputFiles = [];
                additionalMetafiles = [];
                // Create Angular compiler host options
                const hostOptions = {
                    fileReplacements: pluginOptions.fileReplacements,
                    modifiedFiles: pluginOptions.sourceFileCache?.modifiedFiles,
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
                        const { contents, resourceFiles, errors, warnings } = stylesheetResult;
                        if (errors) {
                            (result.errors ??= []).push(...errors);
                        }
                        (result.warnings ??= []).push(...warnings);
                        additionalOutputFiles.push(...resourceFiles);
                        if (stylesheetResult.metafile) {
                            additionalMetafiles.push(stylesheetResult.metafile);
                        }
                        return contents;
                    },
                    processWebWorker(workerFile, containingFile) {
                        const fullWorkerPath = path.join(path.dirname(containingFile), workerFile);
                        // The synchronous API must be used due to the TypeScript compilation currently being
                        // fully synchronous and this process callback being called from within a TypeScript
                        // transformer.
                        const workerResult = build.esbuild.buildSync({
                            platform: 'browser',
                            write: false,
                            bundle: true,
                            metafile: true,
                            format: 'esm',
                            mainFields: ['es2020', 'es2015', 'browser', 'module', 'main'],
                            sourcemap: pluginOptions.sourcemap,
                            entryNames: 'worker-[hash]',
                            entryPoints: [fullWorkerPath],
                            absWorkingDir: build.initialOptions.absWorkingDir,
                            outdir: build.initialOptions.outdir,
                            minifyIdentifiers: build.initialOptions.minifyIdentifiers,
                            minifySyntax: build.initialOptions.minifySyntax,
                            minifyWhitespace: build.initialOptions.minifyWhitespace,
                            target: build.initialOptions.target,
                        });
                        (result.warnings ??= []).push(...workerResult.warnings);
                        additionalOutputFiles.push(...workerResult.outputFiles);
                        if (workerResult.metafile) {
                            additionalMetafiles.push(workerResult.metafile);
                        }
                        if (workerResult.errors.length > 0) {
                            (result.errors ??= []).push(...workerResult.errors);
                            // Return the original path if the build failed
                            return workerFile;
                        }
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
                // Store referenced files for updated file watching if enabled
                if (pluginOptions.sourceFileCache) {
                    pluginOptions.sourceFileCache.referencedFiles = referencedFiles;
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
                (0, jit_plugin_callbacks_1.setupJitPluginCallbacks)(build, stylesheetBundler, additionalOutputFiles, styleOptions.inlineStyleLanguage);
            }
            build.onEnd((result) => {
                // Add any additional output files to the main output files
                if (additionalOutputFiles.length) {
                    result.outputFiles?.push(...additionalOutputFiles);
                }
                // Combine additional metafiles with main metafile
                if (result.metafile && additionalMetafiles.length) {
                    for (const metafile of additionalMetafiles) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVVILDhEQUFpQztBQUNqQywrQ0FBNEM7QUFDNUMsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUN6Qyw0REFBNEI7QUFDNUIsNEVBQWdFO0FBQ2hFLHNFQUFrRTtBQUVsRSw0Q0FLc0I7QUFHdEIsK0NBQW9HO0FBQ3BHLDJEQUEwRjtBQUMxRixtRUFBcUU7QUFDckUsaUVBQWlFO0FBaUJqRSxrREFBa0Q7QUFDbEQsU0FBZ0Isb0JBQW9CLENBQ2xDLGFBQW9DLEVBQ3BDLFlBQXVFO0lBRXZFLE9BQU87UUFDTCxJQUFJLEVBQUUsa0JBQWtCO1FBQ3hCLGtEQUFrRDtRQUNsRCxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQWtCO1lBQzVCLElBQUksYUFBYSxHQUFpQyxFQUFFLENBQUM7WUFDckQsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLGdCQUFnQixDQUFDO1lBRS9ELElBQUksWUFBWSxHQUFHLGFBQWEsQ0FBQyxRQUFRLENBQUM7WUFDMUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFO2dCQUNyQixnRUFBZ0U7Z0JBQ2hFLHlGQUF5RjtnQkFDekYsSUFBSTtvQkFDRixZQUFZLEdBQUcsTUFBTSxJQUFBLG1CQUFRLEVBQUMsWUFBWSxDQUFDLENBQUM7aUJBQzdDO2dCQUFDLE1BQU0sR0FBRTthQUNYO1lBRUQsMERBQTBEO1lBQzFELE1BQU0scUJBQXFCLEdBQUcsSUFBSSw4Q0FBcUIsQ0FBQyxhQUFhLEVBQUUsZ0NBQVUsQ0FBQyxDQUFDO1lBRW5G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QUksRUFBRSxRQUFRLENBQUMsSUFBSTtTQUN6RixDQUFDLENBQUM7S0FDSjtJQUVELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIE1ldGFmaWxlLFxuICBPblN0YXJ0UmVzdWx0LFxuICBPdXRwdXRGaWxlLFxuICBQYXJ0aWFsTWVzc2FnZSxcbiAgUGx1Z2luLFxuICBQbHVnaW5CdWlsZCxcbn0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IHJlYWxwYXRoIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBwYXRoVG9GaWxlVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHsgbWF4V29ya2VycyB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgSmF2YVNjcmlwdFRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vamF2YXNjcmlwdC10cmFuc2Zvcm1lcic7XG5pbXBvcnQgeyBMb2FkUmVzdWx0Q2FjaGUgfSBmcm9tICcuLi9sb2FkLXJlc3VsdC1jYWNoZSc7XG5pbXBvcnQge1xuICBsb2dDdW11bGF0aXZlRHVyYXRpb25zLFxuICBwcm9maWxlQXN5bmMsXG4gIHByb2ZpbGVTeW5jLFxuICByZXNldEN1bXVsYXRpdmVEdXJhdGlvbnMsXG59IGZyb20gJy4uL3Byb2ZpbGluZyc7XG5pbXBvcnQgeyBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyB9IGZyb20gJy4uL3N0eWxlc2hlZXRzL2J1bmRsZS1vcHRpb25zJztcbmltcG9ydCB7IEFuZ3VsYXJIb3N0T3B0aW9ucyB9IGZyb20gJy4vYW5ndWxhci1ob3N0JztcbmltcG9ydCB7IEFuZ3VsYXJDb21waWxhdGlvbiwgQW90Q29tcGlsYXRpb24sIEppdENvbXBpbGF0aW9uLCBOb29wQ29tcGlsYXRpb24gfSBmcm9tICcuL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7IFNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZSwgZ2V0U2hhcmVkQ29tcGlsYXRpb25TdGF0ZSB9IGZyb20gJy4vY29tcGlsYXRpb24tc3RhdGUnO1xuaW1wb3J0IHsgQ29tcG9uZW50U3R5bGVzaGVldEJ1bmRsZXIgfSBmcm9tICcuL2NvbXBvbmVudC1zdHlsZXNoZWV0cyc7XG5pbXBvcnQgeyBzZXR1cEppdFBsdWdpbkNhbGxiYWNrcyB9IGZyb20gJy4vaml0LXBsdWdpbi1jYWxsYmFja3MnO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlIH0gZnJvbSAnLi9zb3VyY2UtZmlsZS1jYWNoZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZXJQbHVnaW5PcHRpb25zIHtcbiAgc291cmNlbWFwOiBib29sZWFuO1xuICB0c2NvbmZpZzogc3RyaW5nO1xuICBqaXQ/OiBib29sZWFuO1xuICAvKiogU2tpcCBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uIHNldHVwLiBUaGlzIGlzIHVzZWZ1bCB0byByZS11c2UgdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gZnJvbSBhbm90aGVyIHBsdWdpbi4gKi9cbiAgbm9vcFR5cGVTY3JpcHRDb21waWxhdGlvbj86IGJvb2xlYW47XG4gIGFkdmFuY2VkT3B0aW1pemF0aW9ucz86IGJvb2xlYW47XG4gIHRoaXJkUGFydHlTb3VyY2VtYXBzPzogYm9vbGVhbjtcbiAgZmlsZVJlcGxhY2VtZW50cz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZTtcbiAgbG9hZFJlc3VsdENhY2hlPzogTG9hZFJlc3VsdENhY2hlO1xuICBpbmNyZW1lbnRhbDogYm9vbGVhbjtcbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgcGx1Z2luT3B0aW9uczogQ29tcGlsZXJQbHVnaW5PcHRpb25zLFxuICBzdHlsZU9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zICYgeyBpbmxpbmVTdHlsZUxhbmd1YWdlOiBzdHJpbmcgfSxcbik6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItY29tcGlsZXInLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG4gICAgYXN5bmMgc2V0dXAoYnVpbGQ6IFBsdWdpbkJ1aWxkKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICBsZXQgc2V0dXBXYXJuaW5nczogUGFydGlhbE1lc3NhZ2VbXSB8IHVuZGVmaW5lZCA9IFtdO1xuICAgICAgY29uc3QgcHJlc2VydmVTeW1saW5rcyA9IGJ1aWxkLmluaXRpYWxPcHRpb25zLnByZXNlcnZlU3ltbGlua3M7XG5cbiAgICAgIGxldCB0c2NvbmZpZ1BhdGggPSBwbHVnaW5PcHRpb25zLnRzY29uZmlnO1xuICAgICAgaWYgKCFwcmVzZXJ2ZVN5bWxpbmtzKSB7XG4gICAgICAgIC8vIFVzZSB0aGUgcmVhbCBwYXRoIG9mIHRoZSB0c2NvbmZpZyBpZiBub3QgcHJlc2VydmluZyBzeW1saW5rcy5cbiAgICAgICAgLy8gVGhpcyBlbnN1cmVzIHRoZSBUUyBzb3VyY2UgZmlsZSBwYXRocyBhcmUgYmFzZWQgb24gdGhlIHJlYWwgcGF0aCBvZiB0aGUgY29uZmlndXJhdGlvbi5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0c2NvbmZpZ1BhdGggPSBhd2FpdCByZWFscGF0aCh0c2NvbmZpZ1BhdGgpO1xuICAgICAgICB9IGNhdGNoIHt9XG4gICAgICB9XG5cbiAgICAgIC8vIEluaXRpYWxpemUgYSB3b3JrZXIgcG9vbCBmb3IgSmF2YVNjcmlwdCB0cmFuc2Zvcm1hdGlvbnNcbiAgICAgIGNvbnN0IGphdmFzY3JpcHRUcmFuc2Zvcm1lciA9IG5ldyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIocGx1Z2luT3B0aW9ucywgbWF4V29ya2Vycyk7XG5cbiAgICAgIC8vIFNldHVwIGRlZmluZXMgYmFzZWQgb24gdGhlIHZhbHVlcyB1c2VkIGJ5IHRoZSBBbmd1bGFyIGNvbXBpbGVyLWNsaVxuICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lID8/PSB7fTtcbiAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLmRlZmluZVsnbmdJMThuQ2xvc3VyZU1vZGUnXSA/Pz0gJ2ZhbHNlJztcblxuICAgICAgLy8gVGhlIGluLW1lbW9yeSBjYWNoZSBvZiBUeXBlU2NyaXB0IGZpbGUgb3V0cHV0cyB3aWxsIGJlIHVzZWQgZHVyaW5nIHRoZSBidWlsZCBpbiBgb25Mb2FkYCBjYWxsYmFja3MgZm9yIFRTIGZpbGVzLlxuICAgICAgLy8gQSBzdHJpbmcgdmFsdWUgaW5kaWNhdGVzIGRpcmVjdCBUUy9ORyBvdXRwdXQgYW5kIGEgVWludDhBcnJheSBpbmRpY2F0ZXMgZnVsbHkgdHJhbnNmb3JtZWQgY29kZS5cbiAgICAgIGNvbnN0IHR5cGVTY3JpcHRGaWxlQ2FjaGUgPVxuICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8udHlwZVNjcmlwdEZpbGVDYWNoZSA/P1xuICAgICAgICBuZXcgTWFwPHN0cmluZywgc3RyaW5nIHwgVWludDhBcnJheT4oKTtcblxuICAgICAgLy8gVGhlIHN0eWxlc2hlZXQgcmVzb3VyY2VzIGZyb20gY29tcG9uZW50IHN0eWxlc2hlZXRzIHRoYXQgd2lsbCBiZSBhZGRlZCB0byB0aGUgYnVpbGQgcmVzdWx0cyBvdXRwdXQgZmlsZXNcbiAgICAgIGxldCBhZGRpdGlvbmFsT3V0cHV0RmlsZXM6IE91dHB1dEZpbGVbXSA9IFtdO1xuICAgICAgbGV0IGFkZGl0aW9uYWxNZXRhZmlsZXM6IE1ldGFmaWxlW107XG5cbiAgICAgIC8vIENyZWF0ZSBuZXcgcmV1c2FibGUgY29tcGlsYXRpb24gZm9yIHRoZSBhcHByb3ByaWF0ZSBtb2RlIGJhc2VkIG9uIHRoZSBgaml0YCBwbHVnaW4gb3B0aW9uXG4gICAgICBjb25zdCBjb21waWxhdGlvbjogQW5ndWxhckNvbXBpbGF0aW9uID0gcGx1Z2luT3B0aW9ucy5ub29wVHlwZVNjcmlwdENvbXBpbGF0aW9uXG4gICAgICAgID8gbmV3IE5vb3BDb21waWxhdGlvbigpXG4gICAgICAgIDogcGx1Z2luT3B0aW9ucy5qaXRcbiAgICAgICAgPyBuZXcgSml0Q29tcGlsYXRpb24oKVxuICAgICAgICA6IG5ldyBBb3RDb21waWxhdGlvbigpO1xuXG4gICAgICAvLyBEZXRlcm1pbmVzIGlmIFR5cGVTY3JpcHQgc2hvdWxkIHByb2Nlc3MgSmF2YVNjcmlwdCBmaWxlcyBiYXNlZCBvbiB0c2NvbmZpZyBgYWxsb3dKc2Agb3B0aW9uXG4gICAgICBsZXQgc2hvdWxkVHNJZ25vcmVKcyA9IHRydWU7XG5cbiAgICAgIC8vIFRyYWNrIGluY3JlbWVudGFsIGNvbXBvbmVudCBzdHlsZXNoZWV0IGJ1aWxkc1xuICAgICAgY29uc3Qgc3R5bGVzaGVldEJ1bmRsZXIgPSBuZXcgQ29tcG9uZW50U3R5bGVzaGVldEJ1bmRsZXIoXG4gICAgICAgIHN0eWxlT3B0aW9ucyxcbiAgICAgICAgcGx1Z2luT3B0aW9ucy5pbmNyZW1lbnRhbCxcbiAgICAgICAgcGx1Z2luT3B0aW9ucy5sb2FkUmVzdWx0Q2FjaGUsXG4gICAgICApO1xuICAgICAgbGV0IHNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZTogU2hhcmVkVFNDb21waWxhdGlvblN0YXRlIHwgdW5kZWZpbmVkO1xuXG4gICAgICBidWlsZC5vblN0YXJ0KGFzeW5jICgpID0+IHtcbiAgICAgICAgc2hhcmVkVFNDb21waWxhdGlvblN0YXRlID0gZ2V0U2hhcmVkQ29tcGlsYXRpb25TdGF0ZSgpO1xuICAgICAgICBpZiAoIShjb21waWxhdGlvbiBpbnN0YW5jZW9mIE5vb3BDb21waWxhdGlvbikpIHtcbiAgICAgICAgICBzaGFyZWRUU0NvbXBpbGF0aW9uU3RhdGUubWFya0FzSW5Qcm9ncmVzcygpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVzdWx0OiBPblN0YXJ0UmVzdWx0ID0ge1xuICAgICAgICAgIHdhcm5pbmdzOiBzZXR1cFdhcm5pbmdzLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFJlc2V0IGRlYnVnIHBlcmZvcm1hbmNlIHRyYWNraW5nXG4gICAgICAgIHJlc2V0Q3VtdWxhdGl2ZUR1cmF0aW9ucygpO1xuXG4gICAgICAgIC8vIFJlc2V0IGFkZGl0aW9uYWwgb3V0cHV0IGZpbGVzXG4gICAgICAgIGFkZGl0aW9uYWxPdXRwdXRGaWxlcyA9IFtdO1xuICAgICAgICBhZGRpdGlvbmFsTWV0YWZpbGVzID0gW107XG5cbiAgICAgICAgLy8gQ3JlYXRlIEFuZ3VsYXIgY29tcGlsZXIgaG9zdCBvcHRpb25zXG4gICAgICAgIGNvbnN0IGhvc3RPcHRpb25zOiBBbmd1bGFySG9zdE9wdGlvbnMgPSB7XG4gICAgICAgICAgZmlsZVJlcGxhY2VtZW50czogcGx1Z2luT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzLFxuICAgICAgICAgIG1vZGlmaWVkRmlsZXM6IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5tb2RpZmllZEZpbGVzLFxuICAgICAgICAgIHNvdXJjZUZpbGVDYWNoZTogcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUsXG4gICAgICAgICAgYXN5bmMgdHJhbnNmb3JtU3R5bGVzaGVldChkYXRhLCBjb250YWluaW5nRmlsZSwgc3R5bGVzaGVldEZpbGUpIHtcbiAgICAgICAgICAgIGxldCBzdHlsZXNoZWV0UmVzdWx0O1xuXG4gICAgICAgICAgICAvLyBTdHlsZXNoZWV0IGZpbGUgb25seSBleGlzdHMgZm9yIGV4dGVybmFsIHN0eWxlc2hlZXRzXG4gICAgICAgICAgICBpZiAoc3R5bGVzaGVldEZpbGUpIHtcbiAgICAgICAgICAgICAgc3R5bGVzaGVldFJlc3VsdCA9IGF3YWl0IHN0eWxlc2hlZXRCdW5kbGVyLmJ1bmRsZUZpbGUoc3R5bGVzaGVldEZpbGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc3R5bGVzaGVldFJlc3VsdCA9IGF3YWl0IHN0eWxlc2hlZXRCdW5kbGVyLmJ1bmRsZUlubGluZShcbiAgICAgICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgICAgIGNvbnRhaW5pbmdGaWxlLFxuICAgICAgICAgICAgICAgIHN0eWxlT3B0aW9ucy5pbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB7IGNvbnRlbnRzLCByZXNvdXJjZUZpbGVzLCBlcnJvcnMsIHdhcm5pbmdzIH0gPSBzdHlsZXNoZWV0UmVzdWx0O1xuICAgICAgICAgICAgaWYgKGVycm9ycykge1xuICAgICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLndhcm5pbmdzKTtcbiAgICAgICAgICAgIGFkZGl0aW9uYWxPdXRwdXRGaWxlcy5wdXNoKC4uLnJlc291cmNlRmlsZXMpO1xuICAgICAgICAgICAgaWYgKHN0eWxlc2hlZXRSZXN1bHQubWV0YWZpbGUpIHtcbiAgICAgICAgICAgICAgYWRkaXRpb25hbE1ldGFmaWxlcy5wdXNoKHN0eWxlc2hlZXRSZXN1bHQubWV0YWZpbGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY29udGVudHM7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcm9jZXNzV2ViV29ya2VyKHdvcmtlckZpbGUsIGNvbnRhaW5pbmdGaWxlKSB7XG4gICAgICAgICAgICBjb25zdCBmdWxsV29ya2VyUGF0aCA9IHBhdGguam9pbihwYXRoLmRpcm5hbWUoY29udGFpbmluZ0ZpbGUpLCB3b3JrZXJGaWxlKTtcbiAgICAgICAgICAgIC8vIFRoZSBzeW5jaHJvbm91cyBBUEkgbXVzdCBiZSB1c2VkIGR1ZSB0byB0aGUgVHlwZVNjcmlwdCBjb21waWxhdGlvbiBjdXJyZW50bHkgYmVpbmdcbiAgICAgICAgICAgIC8vIGZ1bGx5IHN5bmNocm9ub3VzIGFuZCB0aGlzIHByb2Nlc3MgY2FsbGJhY2sgYmVpbmcgY2FsbGVkIGZyb20gd2l0aGluIGEgVHlwZVNjcmlwdFxuICAgICAgICAgICAgLy8gdHJhbnNmb3JtZXIuXG4gICAgICAgICAgICBjb25zdCB3b3JrZXJSZXN1bHQgPSBidWlsZC5lc2J1aWxkLmJ1aWxkU3luYyh7XG4gICAgICAgICAgICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgICAgICAgICAgIHdyaXRlOiBmYWxzZSxcbiAgICAgICAgICAgICAgYnVuZGxlOiB0cnVlLFxuICAgICAgICAgICAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgZm9ybWF0OiAnZXNtJyxcbiAgICAgICAgICAgICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnZXMyMDE1JywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICAgICAgICAgICAgc291cmNlbWFwOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgICAgZW50cnlOYW1lczogJ3dvcmtlci1baGFzaF0nLFxuICAgICAgICAgICAgICBlbnRyeVBvaW50czogW2Z1bGxXb3JrZXJQYXRoXSxcbiAgICAgICAgICAgICAgYWJzV29ya2luZ0RpcjogYnVpbGQuaW5pdGlhbE9wdGlvbnMuYWJzV29ya2luZ0RpcixcbiAgICAgICAgICAgICAgb3V0ZGlyOiBidWlsZC5pbml0aWFsT3B0aW9ucy5vdXRkaXIsXG4gICAgICAgICAgICAgIG1pbmlmeUlkZW50aWZpZXJzOiBidWlsZC5pbml0aWFsT3B0aW9ucy5taW5pZnlJZGVudGlmaWVycyxcbiAgICAgICAgICAgICAgbWluaWZ5U3ludGF4OiBidWlsZC5pbml0aWFsT3B0aW9ucy5taW5pZnlTeW50YXgsXG4gICAgICAgICAgICAgIG1pbmlmeVdoaXRlc3BhY2U6IGJ1aWxkLmluaXRpYWxPcHRpb25zLm1pbmlmeVdoaXRlc3BhY2UsXG4gICAgICAgICAgICAgIHRhcmdldDogYnVpbGQuaW5pdGlhbE9wdGlvbnMudGFyZ2V0LFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLndvcmtlclJlc3VsdC53YXJuaW5ncyk7XG4gICAgICAgICAgICBhZGRpdGlvbmFsT3V0cHV0RmlsZXMucHVzaCguLi53b3JrZXJSZXN1bHQub3V0cHV0RmlsZXMpO1xuICAgICAgICAgICAgaWYgKHdvcmtlclJlc3VsdC5tZXRhZmlsZSkge1xuICAgICAgICAgICAgICBhZGRpdGlvbmFsTWV0YWZpbGVzLnB1c2god29ya2VyUmVzdWx0Lm1ldGFmaWxlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHdvcmtlclJlc3VsdC5lcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4ud29ya2VyUmVzdWx0LmVycm9ycyk7XG5cbiAgICAgICAgICAgICAgLy8gUmV0dXJuIHRoZSBvcmlnaW5hbCBwYXRoIGlmIHRoZSBidWlsZCBmYWlsZWRcbiAgICAgICAgICAgICAgcmV0dXJuIHdvcmtlckZpbGU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJldHVybiBidW5kbGVkIHdvcmtlciBmaWxlIGVudHJ5IG5hbWUgdG8gYmUgdXNlZCBpbiB0aGUgYnVpbHQgb3V0cHV0XG4gICAgICAgICAgICBjb25zdCB3b3JrZXJDb2RlRmlsZSA9IHdvcmtlclJlc3VsdC5vdXRwdXRGaWxlcy5maW5kKChmaWxlKSA9PlxuICAgICAgICAgICAgICBmaWxlLnBhdGguZW5kc1dpdGgoJy5qcycpLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGFzc2VydCh3b3JrZXJDb2RlRmlsZSwgJ1dlYiBXb3JrZXIgYnVuZGxlZCBjb2RlIGZpbGUgc2hvdWxkIGFsd2F5cyBiZSBwcmVzZW50LicpO1xuXG4gICAgICAgICAgICByZXR1cm4gcGF0aC5yZWxhdGl2ZShidWlsZC5pbml0aWFsT3B0aW9ucy5vdXRkaXIgPz8gJycsIHdvcmtlckNvZGVGaWxlLnBhdGgpO1xuICAgICAgICAgIH0sXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSB0aGUgQW5ndWxhciBjb21waWxhdGlvbiBmb3IgdGhlIGN1cnJlbnQgYnVpbGQuXG4gICAgICAgIC8vIEluIHdhdGNoIG1vZGUsIHByZXZpb3VzIGJ1aWxkIHN0YXRlIHdpbGwgYmUgcmV1c2VkLlxuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgY29tcGlsZXJPcHRpb25zOiB7IGFsbG93SnMgfSxcbiAgICAgICAgICByZWZlcmVuY2VkRmlsZXMsXG4gICAgICAgIH0gPSBhd2FpdCBjb21waWxhdGlvbi5pbml0aWFsaXplKHRzY29uZmlnUGF0aCwgaG9zdE9wdGlvbnMsIChjb21waWxlck9wdGlvbnMpID0+IHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMudGFyZ2V0ID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPCB0cy5TY3JpcHRUYXJnZXQuRVMyMDIyXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICAvLyBJZiAndXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHMnIGlzIGFscmVhZHkgZGVmaW5lZCBpbiB0aGUgdXNlcnMgcHJvamVjdCBsZWF2ZSB0aGUgdmFsdWUgYXMgaXMuXG4gICAgICAgICAgICAvLyBPdGhlcndpc2UgZmFsbGJhY2sgdG8gZmFsc2UgZHVlIHRvIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvNDU5OTVcbiAgICAgICAgICAgIC8vIHdoaWNoIGJyZWFrcyB0aGUgZGVwcmVjYXRlZCBgQEVmZmVjdHNgIE5HUlggZGVjb3JhdG9yIGFuZCBwb3RlbnRpYWxseSBvdGhlciBleGlzdGluZyBjb2RlIGFzIHdlbGwuXG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMudGFyZ2V0ID0gdHMuU2NyaXB0VGFyZ2V0LkVTMjAyMjtcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy51c2VEZWZpbmVGb3JDbGFzc0ZpZWxkcyA/Pz0gZmFsc2U7XG5cbiAgICAgICAgICAgIC8vIE9ubHkgYWRkIHRoZSB3YXJuaW5nIG9uIHRoZSBpbml0aWFsIGJ1aWxkXG4gICAgICAgICAgICBzZXR1cFdhcm5pbmdzPy5wdXNoKHtcbiAgICAgICAgICAgICAgdGV4dDpcbiAgICAgICAgICAgICAgICAnVHlwZVNjcmlwdCBjb21waWxlciBvcHRpb25zIFwidGFyZ2V0XCIgYW5kIFwidXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHNcIiBhcmUgc2V0IHRvIFwiRVMyMDIyXCIgYW5kICcgK1xuICAgICAgICAgICAgICAgICdcImZhbHNlXCIgcmVzcGVjdGl2ZWx5IGJ5IHRoZSBBbmd1bGFyIENMSS4nLFxuICAgICAgICAgICAgICBsb2NhdGlvbjogeyBmaWxlOiBwbHVnaW5PcHRpb25zLnRzY29uZmlnIH0sXG4gICAgICAgICAgICAgIG5vdGVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgdGV4dDpcbiAgICAgICAgICAgICAgICAgICAgJ1RvIGNvbnRyb2wgRUNNQSB2ZXJzaW9uIGFuZCBmZWF0dXJlcyB1c2UgdGhlIEJyb3dlcnNsaXN0IGNvbmZpZ3VyYXRpb24uICcgK1xuICAgICAgICAgICAgICAgICAgICAnRm9yIG1vcmUgaW5mb3JtYXRpb24sIHNlZSBodHRwczovL2FuZ3VsYXIuaW8vZ3VpZGUvYnVpbGQjY29uZmlndXJpbmctYnJvd3Nlci1jb21wYXRpYmlsaXR5JyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gRW5hYmxlIGluY3JlbWVudGFsIGNvbXBpbGF0aW9uIGJ5IGRlZmF1bHQgaWYgY2FjaGluZyBpcyBlbmFibGVkXG4gICAgICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5wZXJzaXN0ZW50Q2FjaGVQYXRoKSB7XG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMuaW5jcmVtZW50YWwgPz89IHRydWU7XG4gICAgICAgICAgICAvLyBTZXQgdGhlIGJ1aWxkIGluZm8gZmlsZSBsb2NhdGlvbiB0byB0aGUgY29uZmlndXJlZCBjYWNoZSBkaXJlY3RvcnlcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy50c0J1aWxkSW5mb0ZpbGUgPSBwYXRoLmpvaW4oXG4gICAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5wZXJzaXN0ZW50Q2FjaGVQYXRoLFxuICAgICAgICAgICAgICAnLnRzYnVpbGRpbmZvJyxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy5pbmNyZW1lbnRhbCA9IGZhbHNlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5jb21waWxlck9wdGlvbnMsXG4gICAgICAgICAgICBub0VtaXRPbkVycm9yOiBmYWxzZSxcbiAgICAgICAgICAgIGlubGluZVNvdXJjZXM6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgICAgaW5saW5lU291cmNlTWFwOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIG1hcFJvb3Q6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHNvdXJjZVJvb3Q6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNob3VsZFRzSWdub3JlSnMgPSAhYWxsb3dKcztcblxuICAgICAgICBpZiAoY29tcGlsYXRpb24gaW5zdGFuY2VvZiBOb29wQ29tcGlsYXRpb24pIHtcbiAgICAgICAgICBhd2FpdCBzaGFyZWRUU0NvbXBpbGF0aW9uU3RhdGUud2FpdFVudGlsUmVhZHk7XG5cbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGlhZ25vc3RpY3MgPSBhd2FpdCBjb21waWxhdGlvbi5kaWFnbm9zZUZpbGVzKCk7XG4gICAgICAgIGlmIChkaWFnbm9zdGljcy5lcnJvcnMpIHtcbiAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZGlhZ25vc3RpY3MuZXJyb3JzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGlhZ25vc3RpY3Mud2FybmluZ3MpIHtcbiAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaCguLi5kaWFnbm9zdGljcy53YXJuaW5ncyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgVHlwZVNjcmlwdCBmaWxlIG91dHB1dCBjYWNoZSBmb3IgYWxsIGFmZmVjdGVkIGZpbGVzXG4gICAgICAgIHByb2ZpbGVTeW5jKCdOR19FTUlUX1RTJywgKCkgPT4ge1xuICAgICAgICAgIGZvciAoY29uc3QgeyBmaWxlbmFtZSwgY29udGVudHMgfSBvZiBjb21waWxhdGlvbi5lbWl0QWZmZWN0ZWRGaWxlcygpKSB7XG4gICAgICAgICAgICB0eXBlU2NyaXB0RmlsZUNhY2hlLnNldChwYXRoVG9GaWxlVVJMKGZpbGVuYW1lKS5ocmVmLCBjb250ZW50cyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBTdG9yZSByZWZlcmVuY2VkIGZpbGVzIGZvciB1cGRhdGVkIGZpbGUgd2F0Y2hpbmcgaWYgZW5hYmxlZFxuICAgICAgICBpZiAocGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUpIHtcbiAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZS5yZWZlcmVuY2VkRmlsZXMgPSByZWZlcmVuY2VkRmlsZXM7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXNldCB0aGUgc2V0dXAgd2FybmluZ3Mgc28gdGhhdCB0aGV5IGFyZSBvbmx5IHNob3duIGR1cmluZyB0aGUgZmlyc3QgYnVpbGQuXG4gICAgICAgIHNldHVwV2FybmluZ3MgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgc2hhcmVkVFNDb21waWxhdGlvblN0YXRlLm1hcmtBc1JlYWR5KCk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5bY21dP1tqdF1zeD8kLyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gcGx1Z2luT3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzPy5bYXJncy5wYXRoXSA/PyBhcmdzLnBhdGg7XG5cbiAgICAgICAgLy8gU2tpcCBUUyBsb2FkIGF0dGVtcHQgaWYgSlMgVHlwZVNjcmlwdCBjb21waWxhdGlvbiBub3QgZW5hYmxlZCBhbmQgZmlsZSBpcyBKU1xuICAgICAgICBpZiAoc2hvdWxkVHNJZ25vcmVKcyAmJiAvXFwuW2NtXT9qcyQvLnRlc3QocmVxdWVzdCkpIHtcbiAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGhlIGZpbGVuYW1lIGlzIGN1cnJlbnRseSB1c2VkIGFzIGEgY2FjaGUga2V5LiBTaW5jZSB0aGUgY2FjaGUgaXMgbWVtb3J5IG9ubHksXG4gICAgICAgIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAgICAgICAvLyBjYWNoZSBpcyBsYXRlciBzdG9yZWQgdG8gZGlzaywgdGhlbiB0aGUgb3B0aW9ucyB0aGF0IGFmZmVjdCB0cmFuc2Zvcm0gb3V0cHV0XG4gICAgICAgIC8vIHdvdWxkIG5lZWQgdG8gYmUgYWRkZWQgdG8gdGhlIGtleSBhcyB3ZWxsIGFzIGEgY2hlY2sgZm9yIGFueSBjaGFuZ2Ugb2YgY29udGVudC5cbiAgICAgICAgbGV0IGNvbnRlbnRzID0gdHlwZVNjcmlwdEZpbGVDYWNoZS5nZXQocGF0aFRvRmlsZVVSTChyZXF1ZXN0KS5ocmVmKTtcblxuICAgICAgICBpZiAoY29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIE5vIFRTIHJlc3VsdCBpbmRpY2F0ZXMgdGhlIGZpbGUgaXMgbm90IHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvZ3JhbS5cbiAgICAgICAgICAvLyBJZiBhbGxvd0pzIGlzIGVuYWJsZWQgYW5kIHRoZSBmaWxlIGlzIEpTIHRoZW4gZGVmZXIgdG8gdGhlIG5leHQgbG9hZCBob29rLlxuICAgICAgICAgIGlmICghc2hvdWxkVHNJZ25vcmVKcyAmJiAvXFwuW2NtXT9qcyQvLnRlc3QocmVxdWVzdCkpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gT3RoZXJ3aXNlIHJldHVybiBhbiBlcnJvclxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBlcnJvcnM6IFtcbiAgICAgICAgICAgICAgY3JlYXRlTWlzc2luZ0ZpbGVFcnJvcihyZXF1ZXN0LCBhcmdzLnBhdGgsIGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIgPz8gJycpLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb250ZW50cyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAvLyBBIHN0cmluZyBpbmRpY2F0ZXMgdW50cmFuc2Zvcm1lZCBvdXRwdXQgZnJvbSB0aGUgVFMvTkcgY29tcGlsZXJcbiAgICAgICAgICBjb250ZW50cyA9IGF3YWl0IGphdmFzY3JpcHRUcmFuc2Zvcm1lci50cmFuc2Zvcm1EYXRhKFxuICAgICAgICAgICAgcmVxdWVzdCxcbiAgICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgICAgdHJ1ZSAvKiBza2lwTGlua2VyICovLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICAvLyBTdG9yZSBhcyB0aGUgcmV0dXJuZWQgVWludDhBcnJheSB0byBhbGxvdyBjYWNoaW5nIHRoZSBmdWxseSB0cmFuc2Zvcm1lZCBjb2RlXG4gICAgICAgICAgdHlwZVNjcmlwdEZpbGVDYWNoZS5zZXQocGF0aFRvRmlsZVVSTChyZXF1ZXN0KS5ocmVmLCBjb250ZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5bY21dP2pzJC8gfSwgKGFyZ3MpID0+XG4gICAgICAgIHByb2ZpbGVBc3luYyhcbiAgICAgICAgICAnTkdfRU1JVF9KUyonLFxuICAgICAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIC8vIFRoZSBmaWxlbmFtZSBpcyBjdXJyZW50bHkgdXNlZCBhcyBhIGNhY2hlIGtleS4gU2luY2UgdGhlIGNhY2hlIGlzIG1lbW9yeSBvbmx5LFxuICAgICAgICAgICAgLy8gdGhlIG9wdGlvbnMgY2Fubm90IGNoYW5nZSBhbmQgZG8gbm90IG5lZWQgdG8gYmUgcmVwcmVzZW50ZWQgaW4gdGhlIGtleS4gSWYgdGhlXG4gICAgICAgICAgICAvLyBjYWNoZSBpcyBsYXRlciBzdG9yZWQgdG8gZGlzaywgdGhlbiB0aGUgb3B0aW9ucyB0aGF0IGFmZmVjdCB0cmFuc2Zvcm0gb3V0cHV0XG4gICAgICAgICAgICAvLyB3b3VsZCBuZWVkIHRvIGJlIGFkZGVkIHRvIHRoZSBrZXkgYXMgd2VsbCBhcyBhIGNoZWNrIGZvciBhbnkgY2hhbmdlIG9mIGNvbnRlbnQuXG4gICAgICAgICAgICBsZXQgY29udGVudHMgPSBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8uYmFiZWxGaWxlQ2FjaGUuZ2V0KGFyZ3MucGF0aCk7XG4gICAgICAgICAgICBpZiAoY29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBjb250ZW50cyA9IGF3YWl0IGphdmFzY3JpcHRUcmFuc2Zvcm1lci50cmFuc2Zvcm1GaWxlKGFyZ3MucGF0aCwgcGx1Z2luT3B0aW9ucy5qaXQpO1xuICAgICAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8uYmFiZWxGaWxlQ2FjaGUuc2V0KGFyZ3MucGF0aCwgY29udGVudHMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICksXG4gICAgICApO1xuXG4gICAgICAvLyBTZXR1cCBidW5kbGluZyBvZiBjb21wb25lbnQgdGVtcGxhdGVzIGFuZCBzdHlsZXNoZWV0cyB3aGVuIGluIEpJVCBtb2RlXG4gICAgICBpZiAocGx1Z2luT3B0aW9ucy5qaXQpIHtcbiAgICAgICAgc2V0dXBKaXRQbHVnaW5DYWxsYmFja3MoXG4gICAgICAgICAgYnVpbGQsXG4gICAgICAgICAgc3R5bGVzaGVldEJ1bmRsZXIsXG4gICAgICAgICAgYWRkaXRpb25hbE91dHB1dEZpbGVzLFxuICAgICAgICAgIHN0eWxlT3B0aW9ucy5pbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBidWlsZC5vbkVuZCgocmVzdWx0KSA9PiB7XG4gICAgICAgIC8vIEFkZCBhbnkgYWRkaXRpb25hbCBvdXRwdXQgZmlsZXMgdG8gdGhlIG1haW4gb3V0cHV0IGZpbGVzXG4gICAgICAgIGlmIChhZGRpdGlvbmFsT3V0cHV0RmlsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgcmVzdWx0Lm91dHB1dEZpbGVzPy5wdXNoKC4uLmFkZGl0aW9uYWxPdXRwdXRGaWxlcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb21iaW5lIGFkZGl0aW9uYWwgbWV0YWZpbGVzIHdpdGggbWFpbiBtZXRhZmlsZVxuICAgICAgICBpZiAocmVzdWx0Lm1ldGFmaWxlICYmIGFkZGl0aW9uYWxNZXRhZmlsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBtZXRhZmlsZSBvZiBhZGRpdGlvbmFsTWV0YWZpbGVzKSB7XG4gICAgICAgICAgICByZXN1bHQubWV0YWZpbGUuaW5wdXRzID0geyAuLi5yZXN1bHQubWV0YWZpbGUuaW5wdXRzLCAuLi5tZXRhZmlsZS5pbnB1dHMgfTtcbiAgICAgICAgICAgIHJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzID0geyAuLi5yZXN1bHQubWV0YWZpbGUub3V0cHV0cywgLi4ubWV0YWZpbGUub3V0cHV0cyB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxvZ0N1bXVsYXRpdmVEdXJhdGlvbnMoKTtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkRpc3Bvc2UoKCkgPT4ge1xuICAgICAgICBzaGFyZWRUU0NvbXBpbGF0aW9uU3RhdGU/LmRpc3Bvc2UoKTtcbiAgICAgICAgdm9pZCBzdHlsZXNoZWV0QnVuZGxlci5kaXNwb3NlKCk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVNaXNzaW5nRmlsZUVycm9yKHJlcXVlc3Q6IHN0cmluZywgb3JpZ2luYWw6IHN0cmluZywgcm9vdDogc3RyaW5nKTogUGFydGlhbE1lc3NhZ2Uge1xuICBjb25zdCBlcnJvciA9IHtcbiAgICB0ZXh0OiBgRmlsZSAnJHtwYXRoLnJlbGF0aXZlKHJvb3QsIHJlcXVlc3QpfScgaXMgbWlzc2luZyBmcm9tIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uLmAsXG4gICAgbm90ZXM6IFtcbiAgICAgIHtcbiAgICAgICAgdGV4dDogYEVuc3VyZSB0aGUgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0gdmlhIHRoZSAnZmlsZXMnIG9yICdpbmNsdWRlJyBwcm9wZXJ0eS5gLFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xuXG4gIGlmIChyZXF1ZXN0ICE9PSBvcmlnaW5hbCkge1xuICAgIGVycm9yLm5vdGVzLnB1c2goe1xuICAgICAgdGV4dDogYEZpbGUgaXMgcmVxdWVzdGVkIGZyb20gYSBmaWxlIHJlcGxhY2VtZW50IG9mICcke3BhdGgucmVsYXRpdmUocm9vdCwgb3JpZ2luYWwpfScuYCxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBlcnJvcjtcbn1cbiJdfQ==