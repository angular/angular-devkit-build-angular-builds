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
            const stylesheetBundler = new component_stylesheets_1.ComponentStylesheetBundler(styleOptions, pluginOptions.loadResultCache);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVVILDhEQUFpQztBQUNqQywrQ0FBNEM7QUFDNUMsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUN6Qyw0REFBNEI7QUFDNUIsNEVBQWdFO0FBQ2hFLHNFQUFrRTtBQUVsRSw0Q0FLc0I7QUFHdEIsK0NBQW9HO0FBQ3BHLDJEQUEwRjtBQUMxRixtRUFBcUU7QUFDckUsaUVBQWlFO0FBZ0JqRSxrREFBa0Q7QUFDbEQsU0FBZ0Isb0JBQW9CLENBQ2xDLGFBQW9DLEVBQ3BDLFlBQXVFO0lBRXZFLE9BQU87UUFDTCxJQUFJLEVBQUUsa0JBQWtCO1FBQ3hCLGtEQUFrRDtRQUNsRCxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQWtCO1lBQzVCLElBQUksYUFBYSxHQUFpQyxFQUFFLENBQUM7WUFDckQsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLGdCQUFnQixDQUFDO1lBRS9ELElBQUksWUFBWSxHQUFHLGFBQWEsQ0FBQyxRQUFRLENBQUM7WUFDMUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFO2dCQUNyQixnRUFBZ0U7Z0JBQ2hFLHlGQUF5RjtnQkFDekYsSUFBSTtvQkFDRixZQUFZLEdBQUcsTUFBTSxJQUFBLG1CQUFRLEVBQUMsWUFBWSxDQUFDLENBQUM7aUJBQzdDO2dCQUFDLE1BQU0sR0FBRTthQUNYO1lBRUQsMERBQTBEO1lBQzFELE1BQU0scUJBQXFCLEdBQUcsSUFBSSw4Q0FBcUIsQ0FBQyxhQUFhLEVBQUUsZ0NBQVUsQ0FBQyxDQUFDO1lBRW5G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STtTQUN6RixDQUFDLENBQUM7S0FDSjtJQUVELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIE1ldGFmaWxlLFxuICBPblN0YXJ0UmVzdWx0LFxuICBPdXRwdXRGaWxlLFxuICBQYXJ0aWFsTWVzc2FnZSxcbiAgUGx1Z2luLFxuICBQbHVnaW5CdWlsZCxcbn0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IHJlYWxwYXRoIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBwYXRoVG9GaWxlVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHsgbWF4V29ya2VycyB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgSmF2YVNjcmlwdFRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vamF2YXNjcmlwdC10cmFuc2Zvcm1lcic7XG5pbXBvcnQgeyBMb2FkUmVzdWx0Q2FjaGUgfSBmcm9tICcuLi9sb2FkLXJlc3VsdC1jYWNoZSc7XG5pbXBvcnQge1xuICBsb2dDdW11bGF0aXZlRHVyYXRpb25zLFxuICBwcm9maWxlQXN5bmMsXG4gIHByb2ZpbGVTeW5jLFxuICByZXNldEN1bXVsYXRpdmVEdXJhdGlvbnMsXG59IGZyb20gJy4uL3Byb2ZpbGluZyc7XG5pbXBvcnQgeyBCdW5kbGVTdHlsZXNoZWV0T3B0aW9ucyB9IGZyb20gJy4uL3N0eWxlc2hlZXRzL2J1bmRsZS1vcHRpb25zJztcbmltcG9ydCB7IEFuZ3VsYXJIb3N0T3B0aW9ucyB9IGZyb20gJy4vYW5ndWxhci1ob3N0JztcbmltcG9ydCB7IEFuZ3VsYXJDb21waWxhdGlvbiwgQW90Q29tcGlsYXRpb24sIEppdENvbXBpbGF0aW9uLCBOb29wQ29tcGlsYXRpb24gfSBmcm9tICcuL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7IFNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZSwgZ2V0U2hhcmVkQ29tcGlsYXRpb25TdGF0ZSB9IGZyb20gJy4vY29tcGlsYXRpb24tc3RhdGUnO1xuaW1wb3J0IHsgQ29tcG9uZW50U3R5bGVzaGVldEJ1bmRsZXIgfSBmcm9tICcuL2NvbXBvbmVudC1zdHlsZXNoZWV0cyc7XG5pbXBvcnQgeyBzZXR1cEppdFBsdWdpbkNhbGxiYWNrcyB9IGZyb20gJy4vaml0LXBsdWdpbi1jYWxsYmFja3MnO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlIH0gZnJvbSAnLi9zb3VyY2UtZmlsZS1jYWNoZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZXJQbHVnaW5PcHRpb25zIHtcbiAgc291cmNlbWFwOiBib29sZWFuO1xuICB0c2NvbmZpZzogc3RyaW5nO1xuICBqaXQ/OiBib29sZWFuO1xuICAvKiogU2tpcCBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uIHNldHVwLiBUaGlzIGlzIHVzZWZ1bCB0byByZS11c2UgdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gZnJvbSBhbm90aGVyIHBsdWdpbi4gKi9cbiAgbm9vcFR5cGVTY3JpcHRDb21waWxhdGlvbj86IGJvb2xlYW47XG4gIGFkdmFuY2VkT3B0aW1pemF0aW9ucz86IGJvb2xlYW47XG4gIHRoaXJkUGFydHlTb3VyY2VtYXBzPzogYm9vbGVhbjtcbiAgZmlsZVJlcGxhY2VtZW50cz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZTtcbiAgbG9hZFJlc3VsdENhY2hlPzogTG9hZFJlc3VsdENhY2hlO1xufVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICBwbHVnaW5PcHRpb25zOiBDb21waWxlclBsdWdpbk9wdGlvbnMsXG4gIHN0eWxlT3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMgJiB7IGlubGluZVN0eWxlTGFuZ3VhZ2U6IHN0cmluZyB9LFxuKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1jb21waWxlcicsXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbiAgICBhc3luYyBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgIGxldCBzZXR1cFdhcm5pbmdzOiBQYXJ0aWFsTWVzc2FnZVtdIHwgdW5kZWZpbmVkID0gW107XG4gICAgICBjb25zdCBwcmVzZXJ2ZVN5bWxpbmtzID0gYnVpbGQuaW5pdGlhbE9wdGlvbnMucHJlc2VydmVTeW1saW5rcztcblxuICAgICAgbGV0IHRzY29uZmlnUGF0aCA9IHBsdWdpbk9wdGlvbnMudHNjb25maWc7XG4gICAgICBpZiAoIXByZXNlcnZlU3ltbGlua3MpIHtcbiAgICAgICAgLy8gVXNlIHRoZSByZWFsIHBhdGggb2YgdGhlIHRzY29uZmlnIGlmIG5vdCBwcmVzZXJ2aW5nIHN5bWxpbmtzLlxuICAgICAgICAvLyBUaGlzIGVuc3VyZXMgdGhlIFRTIHNvdXJjZSBmaWxlIHBhdGhzIGFyZSBiYXNlZCBvbiB0aGUgcmVhbCBwYXRoIG9mIHRoZSBjb25maWd1cmF0aW9uLlxuICAgICAgICB0cnkge1xuICAgICAgICAgIHRzY29uZmlnUGF0aCA9IGF3YWl0IHJlYWxwYXRoKHRzY29uZmlnUGF0aCk7XG4gICAgICAgIH0gY2F0Y2gge31cbiAgICAgIH1cblxuICAgICAgLy8gSW5pdGlhbGl6ZSBhIHdvcmtlciBwb29sIGZvciBKYXZhU2NyaXB0IHRyYW5zZm9ybWF0aW9uc1xuICAgICAgY29uc3QgamF2YXNjcmlwdFRyYW5zZm9ybWVyID0gbmV3IEphdmFTY3JpcHRUcmFuc2Zvcm1lcihwbHVnaW5PcHRpb25zLCBtYXhXb3JrZXJzKTtcblxuICAgICAgLy8gU2V0dXAgZGVmaW5lcyBiYXNlZCBvbiB0aGUgdmFsdWVzIHVzZWQgYnkgdGhlIEFuZ3VsYXIgY29tcGlsZXItY2xpXG4gICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmUgPz89IHt9O1xuICAgICAgYnVpbGQuaW5pdGlhbE9wdGlvbnMuZGVmaW5lWyduZ0kxOG5DbG9zdXJlTW9kZSddID8/PSAnZmFsc2UnO1xuXG4gICAgICAvLyBUaGUgaW4tbWVtb3J5IGNhY2hlIG9mIFR5cGVTY3JpcHQgZmlsZSBvdXRwdXRzIHdpbGwgYmUgdXNlZCBkdXJpbmcgdGhlIGJ1aWxkIGluIGBvbkxvYWRgIGNhbGxiYWNrcyBmb3IgVFMgZmlsZXMuXG4gICAgICAvLyBBIHN0cmluZyB2YWx1ZSBpbmRpY2F0ZXMgZGlyZWN0IFRTL05HIG91dHB1dCBhbmQgYSBVaW50OEFycmF5IGluZGljYXRlcyBmdWxseSB0cmFuc2Zvcm1lZCBjb2RlLlxuICAgICAgY29uc3QgdHlwZVNjcmlwdEZpbGVDYWNoZSA9XG4gICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy50eXBlU2NyaXB0RmlsZUNhY2hlID8/XG4gICAgICAgIG5ldyBNYXA8c3RyaW5nLCBzdHJpbmcgfCBVaW50OEFycmF5PigpO1xuXG4gICAgICAvLyBUaGUgc3R5bGVzaGVldCByZXNvdXJjZXMgZnJvbSBjb21wb25lbnQgc3R5bGVzaGVldHMgdGhhdCB3aWxsIGJlIGFkZGVkIHRvIHRoZSBidWlsZCByZXN1bHRzIG91dHB1dCBmaWxlc1xuICAgICAgbGV0IGFkZGl0aW9uYWxPdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gICAgICBsZXQgYWRkaXRpb25hbE1ldGFmaWxlczogTWV0YWZpbGVbXTtcblxuICAgICAgLy8gQ3JlYXRlIG5ldyByZXVzYWJsZSBjb21waWxhdGlvbiBmb3IgdGhlIGFwcHJvcHJpYXRlIG1vZGUgYmFzZWQgb24gdGhlIGBqaXRgIHBsdWdpbiBvcHRpb25cbiAgICAgIGNvbnN0IGNvbXBpbGF0aW9uOiBBbmd1bGFyQ29tcGlsYXRpb24gPSBwbHVnaW5PcHRpb25zLm5vb3BUeXBlU2NyaXB0Q29tcGlsYXRpb25cbiAgICAgICAgPyBuZXcgTm9vcENvbXBpbGF0aW9uKClcbiAgICAgICAgOiBwbHVnaW5PcHRpb25zLmppdFxuICAgICAgICA/IG5ldyBKaXRDb21waWxhdGlvbigpXG4gICAgICAgIDogbmV3IEFvdENvbXBpbGF0aW9uKCk7XG5cbiAgICAgIC8vIERldGVybWluZXMgaWYgVHlwZVNjcmlwdCBzaG91bGQgcHJvY2VzcyBKYXZhU2NyaXB0IGZpbGVzIGJhc2VkIG9uIHRzY29uZmlnIGBhbGxvd0pzYCBvcHRpb25cbiAgICAgIGxldCBzaG91bGRUc0lnbm9yZUpzID0gdHJ1ZTtcblxuICAgICAgLy8gVHJhY2sgaW5jcmVtZW50YWwgY29tcG9uZW50IHN0eWxlc2hlZXQgYnVpbGRzXG4gICAgICBjb25zdCBzdHlsZXNoZWV0QnVuZGxlciA9IG5ldyBDb21wb25lbnRTdHlsZXNoZWV0QnVuZGxlcihcbiAgICAgICAgc3R5bGVPcHRpb25zLFxuICAgICAgICBwbHVnaW5PcHRpb25zLmxvYWRSZXN1bHRDYWNoZSxcbiAgICAgICk7XG4gICAgICBsZXQgc2hhcmVkVFNDb21waWxhdGlvblN0YXRlOiBTaGFyZWRUU0NvbXBpbGF0aW9uU3RhdGUgfCB1bmRlZmluZWQ7XG5cbiAgICAgIGJ1aWxkLm9uU3RhcnQoYXN5bmMgKCkgPT4ge1xuICAgICAgICBzaGFyZWRUU0NvbXBpbGF0aW9uU3RhdGUgPSBnZXRTaGFyZWRDb21waWxhdGlvblN0YXRlKCk7XG4gICAgICAgIGlmICghKGNvbXBpbGF0aW9uIGluc3RhbmNlb2YgTm9vcENvbXBpbGF0aW9uKSkge1xuICAgICAgICAgIHNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZS5tYXJrQXNJblByb2dyZXNzKCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZXN1bHQ6IE9uU3RhcnRSZXN1bHQgPSB7XG4gICAgICAgICAgd2FybmluZ3M6IHNldHVwV2FybmluZ3MsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gUmVzZXQgZGVidWcgcGVyZm9ybWFuY2UgdHJhY2tpbmdcbiAgICAgICAgcmVzZXRDdW11bGF0aXZlRHVyYXRpb25zKCk7XG5cbiAgICAgICAgLy8gUmVzZXQgYWRkaXRpb25hbCBvdXRwdXQgZmlsZXNcbiAgICAgICAgYWRkaXRpb25hbE91dHB1dEZpbGVzID0gW107XG4gICAgICAgIGFkZGl0aW9uYWxNZXRhZmlsZXMgPSBbXTtcblxuICAgICAgICAvLyBDcmVhdGUgQW5ndWxhciBjb21waWxlciBob3N0IG9wdGlvbnNcbiAgICAgICAgY29uc3QgaG9zdE9wdGlvbnM6IEFuZ3VsYXJIb3N0T3B0aW9ucyA9IHtcbiAgICAgICAgICBmaWxlUmVwbGFjZW1lbnRzOiBwbHVnaW5PcHRpb25zLmZpbGVSZXBsYWNlbWVudHMsXG4gICAgICAgICAgbW9kaWZpZWRGaWxlczogcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/Lm1vZGlmaWVkRmlsZXMsXG4gICAgICAgICAgc291cmNlRmlsZUNhY2hlOiBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZSxcbiAgICAgICAgICBhc3luYyB0cmFuc2Zvcm1TdHlsZXNoZWV0KGRhdGEsIGNvbnRhaW5pbmdGaWxlLCBzdHlsZXNoZWV0RmlsZSkge1xuICAgICAgICAgICAgbGV0IHN0eWxlc2hlZXRSZXN1bHQ7XG5cbiAgICAgICAgICAgIC8vIFN0eWxlc2hlZXQgZmlsZSBvbmx5IGV4aXN0cyBmb3IgZXh0ZXJuYWwgc3R5bGVzaGVldHNcbiAgICAgICAgICAgIGlmIChzdHlsZXNoZWV0RmlsZSkge1xuICAgICAgICAgICAgICBzdHlsZXNoZWV0UmVzdWx0ID0gYXdhaXQgc3R5bGVzaGVldEJ1bmRsZXIuYnVuZGxlRmlsZShzdHlsZXNoZWV0RmlsZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzdHlsZXNoZWV0UmVzdWx0ID0gYXdhaXQgc3R5bGVzaGVldEJ1bmRsZXIuYnVuZGxlSW5saW5lKFxuICAgICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgICAgY29udGFpbmluZ0ZpbGUsXG4gICAgICAgICAgICAgICAgc3R5bGVPcHRpb25zLmlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHsgY29udGVudHMsIHJlc291cmNlRmlsZXMsIGVycm9ycywgd2FybmluZ3MgfSA9IHN0eWxlc2hlZXRSZXN1bHQ7XG4gICAgICAgICAgICBpZiAoZXJyb3JzKSB7XG4gICAgICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaCguLi5lcnJvcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgKHJlc3VsdC53YXJuaW5ncyA/Pz0gW10pLnB1c2goLi4ud2FybmluZ3MpO1xuICAgICAgICAgICAgYWRkaXRpb25hbE91dHB1dEZpbGVzLnB1c2goLi4ucmVzb3VyY2VGaWxlcyk7XG4gICAgICAgICAgICBpZiAoc3R5bGVzaGVldFJlc3VsdC5tZXRhZmlsZSkge1xuICAgICAgICAgICAgICBhZGRpdGlvbmFsTWV0YWZpbGVzLnB1c2goc3R5bGVzaGVldFJlc3VsdC5tZXRhZmlsZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjb250ZW50cztcbiAgICAgICAgICB9LFxuICAgICAgICAgIHByb2Nlc3NXZWJXb3JrZXIod29ya2VyRmlsZSwgY29udGFpbmluZ0ZpbGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxXb3JrZXJQYXRoID0gcGF0aC5qb2luKHBhdGguZGlybmFtZShjb250YWluaW5nRmlsZSksIHdvcmtlckZpbGUpO1xuICAgICAgICAgICAgLy8gVGhlIHN5bmNocm9ub3VzIEFQSSBtdXN0IGJlIHVzZWQgZHVlIHRvIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uIGN1cnJlbnRseSBiZWluZ1xuICAgICAgICAgICAgLy8gZnVsbHkgc3luY2hyb25vdXMgYW5kIHRoaXMgcHJvY2VzcyBjYWxsYmFjayBiZWluZyBjYWxsZWQgZnJvbSB3aXRoaW4gYSBUeXBlU2NyaXB0XG4gICAgICAgICAgICAvLyB0cmFuc2Zvcm1lci5cbiAgICAgICAgICAgIGNvbnN0IHdvcmtlclJlc3VsdCA9IGJ1aWxkLmVzYnVpbGQuYnVpbGRTeW5jKHtcbiAgICAgICAgICAgICAgcGxhdGZvcm06ICdicm93c2VyJyxcbiAgICAgICAgICAgICAgd3JpdGU6IGZhbHNlLFxuICAgICAgICAgICAgICBidW5kbGU6IHRydWUsXG4gICAgICAgICAgICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgICAgICAgICAgICBmb3JtYXQ6ICdlc20nLFxuICAgICAgICAgICAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgICAgICAgICAgICBzb3VyY2VtYXA6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgICAgICBlbnRyeU5hbWVzOiAnd29ya2VyLVtoYXNoXScsXG4gICAgICAgICAgICAgIGVudHJ5UG9pbnRzOiBbZnVsbFdvcmtlclBhdGhdLFxuICAgICAgICAgICAgICBhYnNXb3JraW5nRGlyOiBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyLFxuICAgICAgICAgICAgICBvdXRkaXI6IGJ1aWxkLmluaXRpYWxPcHRpb25zLm91dGRpcixcbiAgICAgICAgICAgICAgbWluaWZ5SWRlbnRpZmllcnM6IGJ1aWxkLmluaXRpYWxPcHRpb25zLm1pbmlmeUlkZW50aWZpZXJzLFxuICAgICAgICAgICAgICBtaW5pZnlTeW50YXg6IGJ1aWxkLmluaXRpYWxPcHRpb25zLm1pbmlmeVN5bnRheCxcbiAgICAgICAgICAgICAgbWluaWZ5V2hpdGVzcGFjZTogYnVpbGQuaW5pdGlhbE9wdGlvbnMubWluaWZ5V2hpdGVzcGFjZSxcbiAgICAgICAgICAgICAgdGFyZ2V0OiBidWlsZC5pbml0aWFsT3B0aW9ucy50YXJnZXQsXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgKHJlc3VsdC53YXJuaW5ncyA/Pz0gW10pLnB1c2goLi4ud29ya2VyUmVzdWx0Lndhcm5pbmdzKTtcbiAgICAgICAgICAgIGFkZGl0aW9uYWxPdXRwdXRGaWxlcy5wdXNoKC4uLndvcmtlclJlc3VsdC5vdXRwdXRGaWxlcyk7XG4gICAgICAgICAgICBpZiAod29ya2VyUmVzdWx0Lm1ldGFmaWxlKSB7XG4gICAgICAgICAgICAgIGFkZGl0aW9uYWxNZXRhZmlsZXMucHVzaCh3b3JrZXJSZXN1bHQubWV0YWZpbGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAod29ya2VyUmVzdWx0LmVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaCguLi53b3JrZXJSZXN1bHQuZXJyb3JzKTtcblxuICAgICAgICAgICAgICAvLyBSZXR1cm4gdGhlIG9yaWdpbmFsIHBhdGggaWYgdGhlIGJ1aWxkIGZhaWxlZFxuICAgICAgICAgICAgICByZXR1cm4gd29ya2VyRmlsZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmV0dXJuIGJ1bmRsZWQgd29ya2VyIGZpbGUgZW50cnkgbmFtZSB0byBiZSB1c2VkIGluIHRoZSBidWlsdCBvdXRwdXRcbiAgICAgICAgICAgIGNvbnN0IHdvcmtlckNvZGVGaWxlID0gd29ya2VyUmVzdWx0Lm91dHB1dEZpbGVzLmZpbmQoKGZpbGUpID0+XG4gICAgICAgICAgICAgIGZpbGUucGF0aC5lbmRzV2l0aCgnLmpzJyksXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgYXNzZXJ0KHdvcmtlckNvZGVGaWxlLCAnV2ViIFdvcmtlciBidW5kbGVkIGNvZGUgZmlsZSBzaG91bGQgYWx3YXlzIGJlIHByZXNlbnQuJyk7XG5cbiAgICAgICAgICAgIHJldHVybiBwYXRoLnJlbGF0aXZlKGJ1aWxkLmluaXRpYWxPcHRpb25zLm91dGRpciA/PyAnJywgd29ya2VyQ29kZUZpbGUucGF0aCk7XG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHRoZSBBbmd1bGFyIGNvbXBpbGF0aW9uIGZvciB0aGUgY3VycmVudCBidWlsZC5cbiAgICAgICAgLy8gSW4gd2F0Y2ggbW9kZSwgcHJldmlvdXMgYnVpbGQgc3RhdGUgd2lsbCBiZSByZXVzZWQuXG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICBjb21waWxlck9wdGlvbnM6IHsgYWxsb3dKcyB9LFxuICAgICAgICAgIHJlZmVyZW5jZWRGaWxlcyxcbiAgICAgICAgfSA9IGF3YWl0IGNvbXBpbGF0aW9uLmluaXRpYWxpemUodHNjb25maWdQYXRoLCBob3N0T3B0aW9ucywgKGNvbXBpbGVyT3B0aW9ucykgPT4ge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCA8IHRzLlNjcmlwdFRhcmdldC5FUzIwMjJcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIC8vIElmICd1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkcycgaXMgYWxyZWFkeSBkZWZpbmVkIGluIHRoZSB1c2VycyBwcm9qZWN0IGxlYXZlIHRoZSB2YWx1ZSBhcyBpcy5cbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSBmYWxsYmFjayB0byBmYWxzZSBkdWUgdG8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy80NTk5NVxuICAgICAgICAgICAgLy8gd2hpY2ggYnJlYWtzIHRoZSBkZXByZWNhdGVkIGBARWZmZWN0c2AgTkdSWCBkZWNvcmF0b3IgYW5kIHBvdGVudGlhbGx5IG90aGVyIGV4aXN0aW5nIGNvZGUgYXMgd2VsbC5cbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgPSB0cy5TY3JpcHRUYXJnZXQuRVMyMDIyO1xuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnVzZURlZmluZUZvckNsYXNzRmllbGRzID8/PSBmYWxzZTtcblxuICAgICAgICAgICAgLy8gT25seSBhZGQgdGhlIHdhcm5pbmcgb24gdGhlIGluaXRpYWwgYnVpbGRcbiAgICAgICAgICAgIHNldHVwV2FybmluZ3M/LnB1c2goe1xuICAgICAgICAgICAgICB0ZXh0OlxuICAgICAgICAgICAgICAgICdUeXBlU2NyaXB0IGNvbXBpbGVyIG9wdGlvbnMgXCJ0YXJnZXRcIiBhbmQgXCJ1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkc1wiIGFyZSBzZXQgdG8gXCJFUzIwMjJcIiBhbmQgJyArXG4gICAgICAgICAgICAgICAgJ1wiZmFsc2VcIiByZXNwZWN0aXZlbHkgYnkgdGhlIEFuZ3VsYXIgQ0xJLicsXG4gICAgICAgICAgICAgIGxvY2F0aW9uOiB7IGZpbGU6IHBsdWdpbk9wdGlvbnMudHNjb25maWcgfSxcbiAgICAgICAgICAgICAgbm90ZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB0ZXh0OlxuICAgICAgICAgICAgICAgICAgICAnVG8gY29udHJvbCBFQ01BIHZlcnNpb24gYW5kIGZlYXR1cmVzIHVzZSB0aGUgQnJvd2Vyc2xpc3QgY29uZmlndXJhdGlvbi4gJyArXG4gICAgICAgICAgICAgICAgICAgICdGb3IgbW9yZSBpbmZvcm1hdGlvbiwgc2VlIGh0dHBzOi8vYW5ndWxhci5pby9ndWlkZS9idWlsZCNjb25maWd1cmluZy1icm93c2VyLWNvbXBhdGliaWxpdHknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBFbmFibGUgaW5jcmVtZW50YWwgY29tcGlsYXRpb24gYnkgZGVmYXVsdCBpZiBjYWNoaW5nIGlzIGVuYWJsZWRcbiAgICAgICAgICBpZiAocGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LnBlcnNpc3RlbnRDYWNoZVBhdGgpIHtcbiAgICAgICAgICAgIGNvbXBpbGVyT3B0aW9ucy5pbmNyZW1lbnRhbCA/Pz0gdHJ1ZTtcbiAgICAgICAgICAgIC8vIFNldCB0aGUgYnVpbGQgaW5mbyBmaWxlIGxvY2F0aW9uIHRvIHRoZSBjb25maWd1cmVkIGNhY2hlIGRpcmVjdG9yeVxuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnRzQnVpbGRJbmZvRmlsZSA9IHBhdGguam9pbihcbiAgICAgICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LnBlcnNpc3RlbnRDYWNoZVBhdGgsXG4gICAgICAgICAgICAgICcudHNidWlsZGluZm8nLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLmluY3JlbWVudGFsID0gZmFsc2U7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLmNvbXBpbGVyT3B0aW9ucyxcbiAgICAgICAgICAgIG5vRW1pdE9uRXJyb3I6IGZhbHNlLFxuICAgICAgICAgICAgaW5saW5lU291cmNlczogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgICBpbmxpbmVTb3VyY2VNYXA6IHBsdWdpbk9wdGlvbnMuc291cmNlbWFwLFxuICAgICAgICAgICAgbWFwUm9vdDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgc291cmNlUm9vdDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgICAgc2hvdWxkVHNJZ25vcmVKcyA9ICFhbGxvd0pzO1xuXG4gICAgICAgIGlmIChjb21waWxhdGlvbiBpbnN0YW5jZW9mIE5vb3BDb21waWxhdGlvbikge1xuICAgICAgICAgIGF3YWl0IHNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZS53YWl0VW50aWxSZWFkeTtcblxuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkaWFnbm9zdGljcyA9IGF3YWl0IGNvbXBpbGF0aW9uLmRpYWdub3NlRmlsZXMoKTtcbiAgICAgICAgaWYgKGRpYWdub3N0aWNzLmVycm9ycykge1xuICAgICAgICAgIChyZXN1bHQuZXJyb3JzID8/PSBbXSkucHVzaCguLi5kaWFnbm9zdGljcy5lcnJvcnMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkaWFnbm9zdGljcy53YXJuaW5ncykge1xuICAgICAgICAgIChyZXN1bHQud2FybmluZ3MgPz89IFtdKS5wdXNoKC4uLmRpYWdub3N0aWNzLndhcm5pbmdzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwZGF0ZSBUeXBlU2NyaXB0IGZpbGUgb3V0cHV0IGNhY2hlIGZvciBhbGwgYWZmZWN0ZWQgZmlsZXNcbiAgICAgICAgcHJvZmlsZVN5bmMoJ05HX0VNSVRfVFMnLCAoKSA9PiB7XG4gICAgICAgICAgZm9yIChjb25zdCB7IGZpbGVuYW1lLCBjb250ZW50cyB9IG9mIGNvbXBpbGF0aW9uLmVtaXRBZmZlY3RlZEZpbGVzKCkpIHtcbiAgICAgICAgICAgIHR5cGVTY3JpcHRGaWxlQ2FjaGUuc2V0KHBhdGhUb0ZpbGVVUkwoZmlsZW5hbWUpLmhyZWYsIGNvbnRlbnRzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFN0b3JlIHJlZmVyZW5jZWQgZmlsZXMgZm9yIHVwZGF0ZWQgZmlsZSB3YXRjaGluZyBpZiBlbmFibGVkXG4gICAgICAgIGlmIChwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZSkge1xuICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlLnJlZmVyZW5jZWRGaWxlcyA9IHJlZmVyZW5jZWRGaWxlcztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc2V0IHRoZSBzZXR1cCB3YXJuaW5ncyBzbyB0aGF0IHRoZXkgYXJlIG9ubHkgc2hvd24gZHVyaW5nIHRoZSBmaXJzdCBidWlsZC5cbiAgICAgICAgc2V0dXBXYXJuaW5ncyA9IHVuZGVmaW5lZDtcblxuICAgICAgICBzaGFyZWRUU0NvbXBpbGF0aW9uU3RhdGUubWFya0FzUmVhZHkoKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLltjbV0/W2p0XXN4PyQvIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlcXVlc3QgPSBwbHVnaW5PcHRpb25zLmZpbGVSZXBsYWNlbWVudHM/LlthcmdzLnBhdGhdID8/IGFyZ3MucGF0aDtcblxuICAgICAgICAvLyBTa2lwIFRTIGxvYWQgYXR0ZW1wdCBpZiBKUyBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uIG5vdCBlbmFibGVkIGFuZCBmaWxlIGlzIEpTXG4gICAgICAgIGlmIChzaG91bGRUc0lnbm9yZUpzICYmIC9cXC5bY21dP2pzJC8udGVzdChyZXF1ZXN0KSkge1xuICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgZmlsZW5hbWUgaXMgY3VycmVudGx5IHVzZWQgYXMgYSBjYWNoZSBrZXkuIFNpbmNlIHRoZSBjYWNoZSBpcyBtZW1vcnkgb25seSxcbiAgICAgICAgLy8gdGhlIG9wdGlvbnMgY2Fubm90IGNoYW5nZSBhbmQgZG8gbm90IG5lZWQgdG8gYmUgcmVwcmVzZW50ZWQgaW4gdGhlIGtleS4gSWYgdGhlXG4gICAgICAgIC8vIGNhY2hlIGlzIGxhdGVyIHN0b3JlZCB0byBkaXNrLCB0aGVuIHRoZSBvcHRpb25zIHRoYXQgYWZmZWN0IHRyYW5zZm9ybSBvdXRwdXRcbiAgICAgICAgLy8gd291bGQgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUga2V5IGFzIHdlbGwgYXMgYSBjaGVjayBmb3IgYW55IGNoYW5nZSBvZiBjb250ZW50LlxuICAgICAgICBsZXQgY29udGVudHMgPSB0eXBlU2NyaXB0RmlsZUNhY2hlLmdldChwYXRoVG9GaWxlVVJMKHJlcXVlc3QpLmhyZWYpO1xuXG4gICAgICAgIGlmIChjb250ZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gTm8gVFMgcmVzdWx0IGluZGljYXRlcyB0aGUgZmlsZSBpcyBub3QgcGFydCBvZiB0aGUgVHlwZVNjcmlwdCBwcm9ncmFtLlxuICAgICAgICAgIC8vIElmIGFsbG93SnMgaXMgZW5hYmxlZCBhbmQgdGhlIGZpbGUgaXMgSlMgdGhlbiBkZWZlciB0byB0aGUgbmV4dCBsb2FkIGhvb2suXG4gICAgICAgICAgaWYgKCFzaG91bGRUc0lnbm9yZUpzICYmIC9cXC5bY21dP2pzJC8udGVzdChyZXF1ZXN0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBPdGhlcndpc2UgcmV0dXJuIGFuIGVycm9yXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGVycm9yczogW1xuICAgICAgICAgICAgICBjcmVhdGVNaXNzaW5nRmlsZUVycm9yKHJlcXVlc3QsIGFyZ3MucGF0aCwgYnVpbGQuaW5pdGlhbE9wdGlvbnMuYWJzV29ya2luZ0RpciA/PyAnJyksXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGNvbnRlbnRzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIC8vIEEgc3RyaW5nIGluZGljYXRlcyB1bnRyYW5zZm9ybWVkIG91dHB1dCBmcm9tIHRoZSBUUy9ORyBjb21waWxlclxuICAgICAgICAgIGNvbnRlbnRzID0gYXdhaXQgamF2YXNjcmlwdFRyYW5zZm9ybWVyLnRyYW5zZm9ybURhdGEoXG4gICAgICAgICAgICByZXF1ZXN0LFxuICAgICAgICAgICAgY29udGVudHMsXG4gICAgICAgICAgICB0cnVlIC8qIHNraXBMaW5rZXIgKi8sXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIC8vIFN0b3JlIGFzIHRoZSByZXR1cm5lZCBVaW50OEFycmF5IHRvIGFsbG93IGNhY2hpbmcgdGhlIGZ1bGx5IHRyYW5zZm9ybWVkIGNvZGVcbiAgICAgICAgICB0eXBlU2NyaXB0RmlsZUNhY2hlLnNldChwYXRoVG9GaWxlVVJMKHJlcXVlc3QpLmhyZWYsIGNvbnRlbnRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgY29udGVudHMsXG4gICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICB9O1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogL1xcLltjbV0/anMkLyB9LCAoYXJncykgPT5cbiAgICAgICAgcHJvZmlsZUFzeW5jKFxuICAgICAgICAgICdOR19FTUlUX0pTKicsXG4gICAgICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgLy8gVGhlIGZpbGVuYW1lIGlzIGN1cnJlbnRseSB1c2VkIGFzIGEgY2FjaGUga2V5LiBTaW5jZSB0aGUgY2FjaGUgaXMgbWVtb3J5IG9ubHksXG4gICAgICAgICAgICAvLyB0aGUgb3B0aW9ucyBjYW5ub3QgY2hhbmdlIGFuZCBkbyBub3QgbmVlZCB0byBiZSByZXByZXNlbnRlZCBpbiB0aGUga2V5LiBJZiB0aGVcbiAgICAgICAgICAgIC8vIGNhY2hlIGlzIGxhdGVyIHN0b3JlZCB0byBkaXNrLCB0aGVuIHRoZSBvcHRpb25zIHRoYXQgYWZmZWN0IHRyYW5zZm9ybSBvdXRwdXRcbiAgICAgICAgICAgIC8vIHdvdWxkIG5lZWQgdG8gYmUgYWRkZWQgdG8gdGhlIGtleSBhcyB3ZWxsIGFzIGEgY2hlY2sgZm9yIGFueSBjaGFuZ2Ugb2YgY29udGVudC5cbiAgICAgICAgICAgIGxldCBjb250ZW50cyA9IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5iYWJlbEZpbGVDYWNoZS5nZXQoYXJncy5wYXRoKTtcbiAgICAgICAgICAgIGlmIChjb250ZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGNvbnRlbnRzID0gYXdhaXQgamF2YXNjcmlwdFRyYW5zZm9ybWVyLnRyYW5zZm9ybUZpbGUoYXJncy5wYXRoLCBwbHVnaW5PcHRpb25zLmppdCk7XG4gICAgICAgICAgICAgIHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlPy5iYWJlbEZpbGVDYWNoZS5zZXQoYXJncy5wYXRoLCBjb250ZW50cyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKSxcbiAgICAgICk7XG5cbiAgICAgIC8vIFNldHVwIGJ1bmRsaW5nIG9mIGNvbXBvbmVudCB0ZW1wbGF0ZXMgYW5kIHN0eWxlc2hlZXRzIHdoZW4gaW4gSklUIG1vZGVcbiAgICAgIGlmIChwbHVnaW5PcHRpb25zLmppdCkge1xuICAgICAgICBzZXR1cEppdFBsdWdpbkNhbGxiYWNrcyhcbiAgICAgICAgICBidWlsZCxcbiAgICAgICAgICBzdHlsZXNoZWV0QnVuZGxlcixcbiAgICAgICAgICBhZGRpdGlvbmFsT3V0cHV0RmlsZXMsXG4gICAgICAgICAgc3R5bGVPcHRpb25zLmlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGJ1aWxkLm9uRW5kKChyZXN1bHQpID0+IHtcbiAgICAgICAgLy8gQWRkIGFueSBhZGRpdGlvbmFsIG91dHB1dCBmaWxlcyB0byB0aGUgbWFpbiBvdXRwdXQgZmlsZXNcbiAgICAgICAgaWYgKGFkZGl0aW9uYWxPdXRwdXRGaWxlcy5sZW5ndGgpIHtcbiAgICAgICAgICByZXN1bHQub3V0cHV0RmlsZXM/LnB1c2goLi4uYWRkaXRpb25hbE91dHB1dEZpbGVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENvbWJpbmUgYWRkaXRpb25hbCBtZXRhZmlsZXMgd2l0aCBtYWluIG1ldGFmaWxlXG4gICAgICAgIGlmIChyZXN1bHQubWV0YWZpbGUgJiYgYWRkaXRpb25hbE1ldGFmaWxlcy5sZW5ndGgpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IG1ldGFmaWxlIG9mIGFkZGl0aW9uYWxNZXRhZmlsZXMpIHtcbiAgICAgICAgICAgIHJlc3VsdC5tZXRhZmlsZS5pbnB1dHMgPSB7IC4uLnJlc3VsdC5tZXRhZmlsZS5pbnB1dHMsIC4uLm1ldGFmaWxlLmlucHV0cyB9O1xuICAgICAgICAgICAgcmVzdWx0Lm1ldGFmaWxlLm91dHB1dHMgPSB7IC4uLnJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzLCAuLi5tZXRhZmlsZS5vdXRwdXRzIH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbG9nQ3VtdWxhdGl2ZUR1cmF0aW9ucygpO1xuICAgICAgfSk7XG5cbiAgICAgIGJ1aWxkLm9uRGlzcG9zZSgoKSA9PiB7XG4gICAgICAgIHNoYXJlZFRTQ29tcGlsYXRpb25TdGF0ZT8uZGlzcG9zZSgpO1xuICAgICAgICB2b2lkIHN0eWxlc2hlZXRCdW5kbGVyLmRpc3Bvc2UoKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU1pc3NpbmdGaWxlRXJyb3IocmVxdWVzdDogc3RyaW5nLCBvcmlnaW5hbDogc3RyaW5nLCByb290OiBzdHJpbmcpOiBQYXJ0aWFsTWVzc2FnZSB7XG4gIGNvbnN0IGVycm9yID0ge1xuICAgIHRleHQ6IGBGaWxlICcke3BhdGgucmVsYXRpdmUocm9vdCwgcmVxdWVzdCl9JyBpcyBtaXNzaW5nIGZyb20gdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24uYCxcbiAgICBub3RlczogW1xuICAgICAge1xuICAgICAgICB0ZXh0OiBgRW5zdXJlIHRoZSBmaWxlIGlzIHBhcnQgb2YgdGhlIFR5cGVTY3JpcHQgcHJvZ3JhbSB2aWEgdGhlICdmaWxlcycgb3IgJ2luY2x1ZGUnIHByb3BlcnR5LmAsXG4gICAgICB9LFxuICAgIF0sXG4gIH07XG5cbiAgaWYgKHJlcXVlc3QgIT09IG9yaWdpbmFsKSB7XG4gICAgZXJyb3Iubm90ZXMucHVzaCh7XG4gICAgICB0ZXh0OiBgRmlsZSBpcyByZXF1ZXN0ZWQgZnJvbSBhIGZpbGUgcmVwbGFjZW1lbnQgb2YgJyR7cGF0aC5yZWxhdGl2ZShyb290LCBvcmlnaW5hbCl9Jy5gLFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIGVycm9yO1xufVxuIl19