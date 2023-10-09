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
const component_stylesheets_1 = require("./component-stylesheets");
const jit_plugin_callbacks_1 = require("./jit-plugin-callbacks");
// TODO: find a better way to unblock TS compilation of server bundles.
let TS_COMPILATION_READY;
// eslint-disable-next-line max-lines-per-function
function createCompilerPlugin(pluginOptions, styleOptions) {
    let resolveCompilationReady;
    if (!pluginOptions.noopTypeScriptCompilation) {
        TS_COMPILATION_READY = new Promise((resolve) => {
            resolveCompilationReady = resolve;
        });
    }
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
            build.onStart(async () => {
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
                    await TS_COMPILATION_READY;
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
                // TODO: find a better way to unblock TS compilation of server bundles.
                resolveCompilationReady?.();
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
            build.onDispose(() => void stylesheetBundler.dispose());
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXItcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9hbmd1bGFyL2NvbXBpbGVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVVILDhEQUFpQztBQUNqQywrQ0FBNEM7QUFDNUMsZ0RBQWtDO0FBQ2xDLHVDQUF5QztBQUN6Qyw0REFBNEI7QUFDNUIsNEVBQWdFO0FBQ2hFLHNFQUFrRTtBQUVsRSw0Q0FLc0I7QUFHdEIsK0NBQW9HO0FBQ3BHLG1FQUFxRTtBQUNyRSxpRUFBaUU7QUFnQmpFLHVFQUF1RTtBQUN2RSxJQUFJLG9CQUErQyxDQUFDO0FBRXBELGtEQUFrRDtBQUNsRCxTQUFnQixvQkFBb0IsQ0FDbEMsYUFBb0MsRUFDcEMsWUFBdUU7SUFFdkUsSUFBSSx1QkFBaUQsQ0FBQztJQUV0RCxJQUFJLENBQUMsYUFBYSxDQUFDLHlCQUF5QixFQUFFO1FBQzVDLG9CQUFvQixHQUFHLElBQUksT0FBTyxDQUFPLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDbkQsdUJBQXVCLEdBQUcsT0FBTyxDQUFDO1FBQ3BDLENBQUMsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxPQUFPO1FBQ0wsSUFBSSxFQUFFLGtCQUFrQjtRQUN4QixrREFBa0Q7UUFDbEQsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFrQjtZQUM1QixJQUFJLGFBQWEsR0FBaUMsRUFBRSxDQUFDO1lBRXJELE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQztZQUMvRCxJQUFJLFlBQVksR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDO1lBQzFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtnQkFDckIsZ0VBQWdF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QztLQUNKO0lBRUQsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgTWV0YWZpbGUsXG4gIE9uU3RhcnRSZXN1bHQsXG4gIE91dHB1dEZpbGUsXG4gIFBhcnRpYWxNZXNzYWdlLFxuICBQbHVnaW4sXG4gIFBsdWdpbkJ1aWxkLFxufSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcmVhbHBhdGggfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBtYXhXb3JrZXJzIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIgfSBmcm9tICcuLi9qYXZhc2NyaXB0LXRyYW5zZm9ybWVyJztcbmltcG9ydCB7IExvYWRSZXN1bHRDYWNoZSB9IGZyb20gJy4uL2xvYWQtcmVzdWx0LWNhY2hlJztcbmltcG9ydCB7XG4gIGxvZ0N1bXVsYXRpdmVEdXJhdGlvbnMsXG4gIHByb2ZpbGVBc3luYyxcbiAgcHJvZmlsZVN5bmMsXG4gIHJlc2V0Q3VtdWxhdGl2ZUR1cmF0aW9ucyxcbn0gZnJvbSAnLi4vcHJvZmlsaW5nJztcbmltcG9ydCB7IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zIH0gZnJvbSAnLi4vc3R5bGVzaGVldHMvYnVuZGxlLW9wdGlvbnMnO1xuaW1wb3J0IHsgQW5ndWxhckhvc3RPcHRpb25zIH0gZnJvbSAnLi9hbmd1bGFyLWhvc3QnO1xuaW1wb3J0IHsgQW5ndWxhckNvbXBpbGF0aW9uLCBBb3RDb21waWxhdGlvbiwgSml0Q29tcGlsYXRpb24sIE5vb3BDb21waWxhdGlvbiB9IGZyb20gJy4vY29tcGlsYXRpb24nO1xuaW1wb3J0IHsgQ29tcG9uZW50U3R5bGVzaGVldEJ1bmRsZXIgfSBmcm9tICcuL2NvbXBvbmVudC1zdHlsZXNoZWV0cyc7XG5pbXBvcnQgeyBzZXR1cEppdFBsdWdpbkNhbGxiYWNrcyB9IGZyb20gJy4vaml0LXBsdWdpbi1jYWxsYmFja3MnO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlIH0gZnJvbSAnLi9zb3VyY2UtZmlsZS1jYWNoZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZXJQbHVnaW5PcHRpb25zIHtcbiAgc291cmNlbWFwOiBib29sZWFuO1xuICB0c2NvbmZpZzogc3RyaW5nO1xuICBqaXQ/OiBib29sZWFuO1xuICAvKiogU2tpcCBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uIHNldHVwLiBUaGlzIGlzIHVzZWZ1bCB0byByZS11c2UgdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gZnJvbSBhbm90aGVyIHBsdWdpbi4gKi9cbiAgbm9vcFR5cGVTY3JpcHRDb21waWxhdGlvbj86IGJvb2xlYW47XG4gIGFkdmFuY2VkT3B0aW1pemF0aW9ucz86IGJvb2xlYW47XG4gIHRoaXJkUGFydHlTb3VyY2VtYXBzPzogYm9vbGVhbjtcbiAgZmlsZVJlcGxhY2VtZW50cz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZTtcbiAgbG9hZFJlc3VsdENhY2hlPzogTG9hZFJlc3VsdENhY2hlO1xufVxuXG4vLyBUT0RPOiBmaW5kIGEgYmV0dGVyIHdheSB0byB1bmJsb2NrIFRTIGNvbXBpbGF0aW9uIG9mIHNlcnZlciBidW5kbGVzLlxubGV0IFRTX0NPTVBJTEFUSU9OX1JFQURZOiBQcm9taXNlPHZvaWQ+IHwgdW5kZWZpbmVkO1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICBwbHVnaW5PcHRpb25zOiBDb21waWxlclBsdWdpbk9wdGlvbnMsXG4gIHN0eWxlT3B0aW9uczogQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMgJiB7IGlubGluZVN0eWxlTGFuZ3VhZ2U6IHN0cmluZyB9LFxuKTogUGx1Z2luIHtcbiAgbGV0IHJlc29sdmVDb21waWxhdGlvblJlYWR5OiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cbiAgaWYgKCFwbHVnaW5PcHRpb25zLm5vb3BUeXBlU2NyaXB0Q29tcGlsYXRpb24pIHtcbiAgICBUU19DT01QSUxBVElPTl9SRUFEWSA9IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICByZXNvbHZlQ29tcGlsYXRpb25SZWFkeSA9IHJlc29sdmU7XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLWNvbXBpbGVyJyxcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuICAgIGFzeW5jIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgbGV0IHNldHVwV2FybmluZ3M6IFBhcnRpYWxNZXNzYWdlW10gfCB1bmRlZmluZWQgPSBbXTtcblxuICAgICAgY29uc3QgcHJlc2VydmVTeW1saW5rcyA9IGJ1aWxkLmluaXRpYWxPcHRpb25zLnByZXNlcnZlU3ltbGlua3M7XG4gICAgICBsZXQgdHNjb25maWdQYXRoID0gcGx1Z2luT3B0aW9ucy50c2NvbmZpZztcbiAgICAgIGlmICghcHJlc2VydmVTeW1saW5rcykge1xuICAgICAgICAvLyBVc2UgdGhlIHJlYWwgcGF0aCBvZiB0aGUgdHNjb25maWcgaWYgbm90IHByZXNlcnZpbmcgc3ltbGlua3MuXG4gICAgICAgIC8vIFRoaXMgZW5zdXJlcyB0aGUgVFMgc291cmNlIGZpbGUgcGF0aHMgYXJlIGJhc2VkIG9uIHRoZSByZWFsIHBhdGggb2YgdGhlIGNvbmZpZ3VyYXRpb24uXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdHNjb25maWdQYXRoID0gYXdhaXQgcmVhbHBhdGgodHNjb25maWdQYXRoKTtcbiAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgfVxuXG4gICAgICAvLyBJbml0aWFsaXplIGEgd29ya2VyIHBvb2wgZm9yIEphdmFTY3JpcHQgdHJhbnNmb3JtYXRpb25zXG4gICAgICBjb25zdCBqYXZhc2NyaXB0VHJhbnNmb3JtZXIgPSBuZXcgSmF2YVNjcmlwdFRyYW5zZm9ybWVyKHBsdWdpbk9wdGlvbnMsIG1heFdvcmtlcnMpO1xuXG4gICAgICAvLyBTZXR1cCBkZWZpbmVzIGJhc2VkIG9uIHRoZSB2YWx1ZXMgdXNlZCBieSB0aGUgQW5ndWxhciBjb21waWxlci1jbGlcbiAgICAgIGJ1aWxkLmluaXRpYWxPcHRpb25zLmRlZmluZSA/Pz0ge307XG4gICAgICBidWlsZC5pbml0aWFsT3B0aW9ucy5kZWZpbmVbJ25nSTE4bkNsb3N1cmVNb2RlJ10gPz89ICdmYWxzZSc7XG5cbiAgICAgIC8vIFRoZSBpbi1tZW1vcnkgY2FjaGUgb2YgVHlwZVNjcmlwdCBmaWxlIG91dHB1dHMgd2lsbCBiZSB1c2VkIGR1cmluZyB0aGUgYnVpbGQgaW4gYG9uTG9hZGAgY2FsbGJhY2tzIGZvciBUUyBmaWxlcy5cbiAgICAgIC8vIEEgc3RyaW5nIHZhbHVlIGluZGljYXRlcyBkaXJlY3QgVFMvTkcgb3V0cHV0IGFuZCBhIFVpbnQ4QXJyYXkgaW5kaWNhdGVzIGZ1bGx5IHRyYW5zZm9ybWVkIGNvZGUuXG4gICAgICBjb25zdCB0eXBlU2NyaXB0RmlsZUNhY2hlID1cbiAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LnR5cGVTY3JpcHRGaWxlQ2FjaGUgPz9cbiAgICAgICAgbmV3IE1hcDxzdHJpbmcsIHN0cmluZyB8IFVpbnQ4QXJyYXk+KCk7XG5cbiAgICAgIC8vIFRoZSBzdHlsZXNoZWV0IHJlc291cmNlcyBmcm9tIGNvbXBvbmVudCBzdHlsZXNoZWV0cyB0aGF0IHdpbGwgYmUgYWRkZWQgdG8gdGhlIGJ1aWxkIHJlc3VsdHMgb3V0cHV0IGZpbGVzXG4gICAgICBsZXQgYWRkaXRpb25hbE91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW10gPSBbXTtcbiAgICAgIGxldCBhZGRpdGlvbmFsTWV0YWZpbGVzOiBNZXRhZmlsZVtdO1xuXG4gICAgICAvLyBDcmVhdGUgbmV3IHJldXNhYmxlIGNvbXBpbGF0aW9uIGZvciB0aGUgYXBwcm9wcmlhdGUgbW9kZSBiYXNlZCBvbiB0aGUgYGppdGAgcGx1Z2luIG9wdGlvblxuICAgICAgY29uc3QgY29tcGlsYXRpb246IEFuZ3VsYXJDb21waWxhdGlvbiA9IHBsdWdpbk9wdGlvbnMubm9vcFR5cGVTY3JpcHRDb21waWxhdGlvblxuICAgICAgICA/IG5ldyBOb29wQ29tcGlsYXRpb24oKVxuICAgICAgICA6IHBsdWdpbk9wdGlvbnMuaml0XG4gICAgICAgID8gbmV3IEppdENvbXBpbGF0aW9uKClcbiAgICAgICAgOiBuZXcgQW90Q29tcGlsYXRpb24oKTtcblxuICAgICAgLy8gRGV0ZXJtaW5lcyBpZiBUeXBlU2NyaXB0IHNob3VsZCBwcm9jZXNzIEphdmFTY3JpcHQgZmlsZXMgYmFzZWQgb24gdHNjb25maWcgYGFsbG93SnNgIG9wdGlvblxuICAgICAgbGV0IHNob3VsZFRzSWdub3JlSnMgPSB0cnVlO1xuXG4gICAgICAvLyBUcmFjayBpbmNyZW1lbnRhbCBjb21wb25lbnQgc3R5bGVzaGVldCBidWlsZHNcbiAgICAgIGNvbnN0IHN0eWxlc2hlZXRCdW5kbGVyID0gbmV3IENvbXBvbmVudFN0eWxlc2hlZXRCdW5kbGVyKFxuICAgICAgICBzdHlsZU9wdGlvbnMsXG4gICAgICAgIHBsdWdpbk9wdGlvbnMubG9hZFJlc3VsdENhY2hlLFxuICAgICAgKTtcblxuICAgICAgYnVpbGQub25TdGFydChhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogT25TdGFydFJlc3VsdCA9IHtcbiAgICAgICAgICB3YXJuaW5nczogc2V0dXBXYXJuaW5ncyxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBSZXNldCBkZWJ1ZyBwZXJmb3JtYW5jZSB0cmFja2luZ1xuICAgICAgICByZXNldEN1bXVsYXRpdmVEdXJhdGlvbnMoKTtcblxuICAgICAgICAvLyBSZXNldCBhZGRpdGlvbmFsIG91dHB1dCBmaWxlc1xuICAgICAgICBhZGRpdGlvbmFsT3V0cHV0RmlsZXMgPSBbXTtcbiAgICAgICAgYWRkaXRpb25hbE1ldGFmaWxlcyA9IFtdO1xuXG4gICAgICAgIC8vIENyZWF0ZSBBbmd1bGFyIGNvbXBpbGVyIGhvc3Qgb3B0aW9uc1xuICAgICAgICBjb25zdCBob3N0T3B0aW9uczogQW5ndWxhckhvc3RPcHRpb25zID0ge1xuICAgICAgICAgIGZpbGVSZXBsYWNlbWVudHM6IHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cyxcbiAgICAgICAgICBtb2RpZmllZEZpbGVzOiBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8ubW9kaWZpZWRGaWxlcyxcbiAgICAgICAgICBzb3VyY2VGaWxlQ2FjaGU6IHBsdWdpbk9wdGlvbnMuc291cmNlRmlsZUNhY2hlLFxuICAgICAgICAgIGFzeW5jIHRyYW5zZm9ybVN0eWxlc2hlZXQoZGF0YSwgY29udGFpbmluZ0ZpbGUsIHN0eWxlc2hlZXRGaWxlKSB7XG4gICAgICAgICAgICBsZXQgc3R5bGVzaGVldFJlc3VsdDtcblxuICAgICAgICAgICAgLy8gU3R5bGVzaGVldCBmaWxlIG9ubHkgZXhpc3RzIGZvciBleHRlcm5hbCBzdHlsZXNoZWV0c1xuICAgICAgICAgICAgaWYgKHN0eWxlc2hlZXRGaWxlKSB7XG4gICAgICAgICAgICAgIHN0eWxlc2hlZXRSZXN1bHQgPSBhd2FpdCBzdHlsZXNoZWV0QnVuZGxlci5idW5kbGVGaWxlKHN0eWxlc2hlZXRGaWxlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHN0eWxlc2hlZXRSZXN1bHQgPSBhd2FpdCBzdHlsZXNoZWV0QnVuZGxlci5idW5kbGVJbmxpbmUoXG4gICAgICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgICAgICBjb250YWluaW5nRmlsZSxcbiAgICAgICAgICAgICAgICBzdHlsZU9wdGlvbnMuaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgeyBjb250ZW50cywgcmVzb3VyY2VGaWxlcywgZXJyb3JzLCB3YXJuaW5ncyB9ID0gc3R5bGVzaGVldFJlc3VsdDtcbiAgICAgICAgICAgIGlmIChlcnJvcnMpIHtcbiAgICAgICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaCguLi53YXJuaW5ncyk7XG4gICAgICAgICAgICBhZGRpdGlvbmFsT3V0cHV0RmlsZXMucHVzaCguLi5yZXNvdXJjZUZpbGVzKTtcbiAgICAgICAgICAgIGlmIChzdHlsZXNoZWV0UmVzdWx0Lm1ldGFmaWxlKSB7XG4gICAgICAgICAgICAgIGFkZGl0aW9uYWxNZXRhZmlsZXMucHVzaChzdHlsZXNoZWV0UmVzdWx0Lm1ldGFmaWxlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGNvbnRlbnRzO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgcHJvY2Vzc1dlYldvcmtlcih3b3JrZXJGaWxlLCBjb250YWluaW5nRmlsZSkge1xuICAgICAgICAgICAgY29uc3QgZnVsbFdvcmtlclBhdGggPSBwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKGNvbnRhaW5pbmdGaWxlKSwgd29ya2VyRmlsZSk7XG4gICAgICAgICAgICAvLyBUaGUgc3luY2hyb25vdXMgQVBJIG11c3QgYmUgdXNlZCBkdWUgdG8gdGhlIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gY3VycmVudGx5IGJlaW5nXG4gICAgICAgICAgICAvLyBmdWxseSBzeW5jaHJvbm91cyBhbmQgdGhpcyBwcm9jZXNzIGNhbGxiYWNrIGJlaW5nIGNhbGxlZCBmcm9tIHdpdGhpbiBhIFR5cGVTY3JpcHRcbiAgICAgICAgICAgIC8vIHRyYW5zZm9ybWVyLlxuICAgICAgICAgICAgY29uc3Qgd29ya2VyUmVzdWx0ID0gYnVpbGQuZXNidWlsZC5idWlsZFN5bmMoe1xuICAgICAgICAgICAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgICAgICAgICAgICB3cml0ZTogZmFsc2UsXG4gICAgICAgICAgICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgbWV0YWZpbGU6IHRydWUsXG4gICAgICAgICAgICAgIGZvcm1hdDogJ2VzbScsXG4gICAgICAgICAgICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgICAgICAgICAgIHNvdXJjZW1hcDogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgICAgIGVudHJ5TmFtZXM6ICd3b3JrZXItW2hhc2hdJyxcbiAgICAgICAgICAgICAgZW50cnlQb2ludHM6IFtmdWxsV29ya2VyUGF0aF0sXG4gICAgICAgICAgICAgIGFic1dvcmtpbmdEaXI6IGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIsXG4gICAgICAgICAgICAgIG91dGRpcjogYnVpbGQuaW5pdGlhbE9wdGlvbnMub3V0ZGlyLFxuICAgICAgICAgICAgICBtaW5pZnlJZGVudGlmaWVyczogYnVpbGQuaW5pdGlhbE9wdGlvbnMubWluaWZ5SWRlbnRpZmllcnMsXG4gICAgICAgICAgICAgIG1pbmlmeVN5bnRheDogYnVpbGQuaW5pdGlhbE9wdGlvbnMubWluaWZ5U3ludGF4LFxuICAgICAgICAgICAgICBtaW5pZnlXaGl0ZXNwYWNlOiBidWlsZC5pbml0aWFsT3B0aW9ucy5taW5pZnlXaGl0ZXNwYWNlLFxuICAgICAgICAgICAgICB0YXJnZXQ6IGJ1aWxkLmluaXRpYWxPcHRpb25zLnRhcmdldCxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaCguLi53b3JrZXJSZXN1bHQud2FybmluZ3MpO1xuICAgICAgICAgICAgYWRkaXRpb25hbE91dHB1dEZpbGVzLnB1c2goLi4ud29ya2VyUmVzdWx0Lm91dHB1dEZpbGVzKTtcbiAgICAgICAgICAgIGlmICh3b3JrZXJSZXN1bHQubWV0YWZpbGUpIHtcbiAgICAgICAgICAgICAgYWRkaXRpb25hbE1ldGFmaWxlcy5wdXNoKHdvcmtlclJlc3VsdC5tZXRhZmlsZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh3b3JrZXJSZXN1bHQuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgKHJlc3VsdC5lcnJvcnMgPz89IFtdKS5wdXNoKC4uLndvcmtlclJlc3VsdC5lcnJvcnMpO1xuXG4gICAgICAgICAgICAgIC8vIFJldHVybiB0aGUgb3JpZ2luYWwgcGF0aCBpZiB0aGUgYnVpbGQgZmFpbGVkXG4gICAgICAgICAgICAgIHJldHVybiB3b3JrZXJGaWxlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZXR1cm4gYnVuZGxlZCB3b3JrZXIgZmlsZSBlbnRyeSBuYW1lIHRvIGJlIHVzZWQgaW4gdGhlIGJ1aWx0IG91dHB1dFxuICAgICAgICAgICAgY29uc3Qgd29ya2VyQ29kZUZpbGUgPSB3b3JrZXJSZXN1bHQub3V0cHV0RmlsZXMuZmluZCgoZmlsZSkgPT5cbiAgICAgICAgICAgICAgZmlsZS5wYXRoLmVuZHNXaXRoKCcuanMnKSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBhc3NlcnQod29ya2VyQ29kZUZpbGUsICdXZWIgV29ya2VyIGJ1bmRsZWQgY29kZSBmaWxlIHNob3VsZCBhbHdheXMgYmUgcHJlc2VudC4nKTtcblxuICAgICAgICAgICAgcmV0dXJuIHBhdGgucmVsYXRpdmUoYnVpbGQuaW5pdGlhbE9wdGlvbnMub3V0ZGlyID8/ICcnLCB3b3JrZXJDb2RlRmlsZS5wYXRoKTtcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIEluaXRpYWxpemUgdGhlIEFuZ3VsYXIgY29tcGlsYXRpb24gZm9yIHRoZSBjdXJyZW50IGJ1aWxkLlxuICAgICAgICAvLyBJbiB3YXRjaCBtb2RlLCBwcmV2aW91cyBidWlsZCBzdGF0ZSB3aWxsIGJlIHJldXNlZC5cbiAgICAgICAgY29uc3Qge1xuICAgICAgICAgIGNvbXBpbGVyT3B0aW9uczogeyBhbGxvd0pzIH0sXG4gICAgICAgICAgcmVmZXJlbmNlZEZpbGVzLFxuICAgICAgICB9ID0gYXdhaXQgY29tcGlsYXRpb24uaW5pdGlhbGl6ZSh0c2NvbmZpZ1BhdGgsIGhvc3RPcHRpb25zLCAoY29tcGlsZXJPcHRpb25zKSA9PiB7XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMudGFyZ2V0IDwgdHMuU2NyaXB0VGFyZ2V0LkVTMjAyMlxuICAgICAgICAgICkge1xuICAgICAgICAgICAgLy8gSWYgJ3VzZURlZmluZUZvckNsYXNzRmllbGRzJyBpcyBhbHJlYWR5IGRlZmluZWQgaW4gdGhlIHVzZXJzIHByb2plY3QgbGVhdmUgdGhlIHZhbHVlIGFzIGlzLlxuICAgICAgICAgICAgLy8gT3RoZXJ3aXNlIGZhbGxiYWNrIHRvIGZhbHNlIGR1ZSB0byBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L1R5cGVTY3JpcHQvaXNzdWVzLzQ1OTk1XG4gICAgICAgICAgICAvLyB3aGljaCBicmVha3MgdGhlIGRlcHJlY2F0ZWQgYEBFZmZlY3RzYCBOR1JYIGRlY29yYXRvciBhbmQgcG90ZW50aWFsbHkgb3RoZXIgZXhpc3RpbmcgY29kZSBhcyB3ZWxsLlxuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCA9IHRzLlNjcmlwdFRhcmdldC5FUzIwMjI7XG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMudXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHMgPz89IGZhbHNlO1xuXG4gICAgICAgICAgICAvLyBPbmx5IGFkZCB0aGUgd2FybmluZyBvbiB0aGUgaW5pdGlhbCBidWlsZFxuICAgICAgICAgICAgc2V0dXBXYXJuaW5ncz8ucHVzaCh7XG4gICAgICAgICAgICAgIHRleHQ6XG4gICAgICAgICAgICAgICAgJ1R5cGVTY3JpcHQgY29tcGlsZXIgb3B0aW9ucyBcInRhcmdldFwiIGFuZCBcInVzZURlZmluZUZvckNsYXNzRmllbGRzXCIgYXJlIHNldCB0byBcIkVTMjAyMlwiIGFuZCAnICtcbiAgICAgICAgICAgICAgICAnXCJmYWxzZVwiIHJlc3BlY3RpdmVseSBieSB0aGUgQW5ndWxhciBDTEkuJyxcbiAgICAgICAgICAgICAgbG9jYXRpb246IHsgZmlsZTogcGx1Z2luT3B0aW9ucy50c2NvbmZpZyB9LFxuICAgICAgICAgICAgICBub3RlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHRleHQ6XG4gICAgICAgICAgICAgICAgICAgICdUbyBjb250cm9sIEVDTUEgdmVyc2lvbiBhbmQgZmVhdHVyZXMgdXNlIHRoZSBCcm93ZXJzbGlzdCBjb25maWd1cmF0aW9uLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ0ZvciBtb3JlIGluZm9ybWF0aW9uLCBzZWUgaHR0cHM6Ly9hbmd1bGFyLmlvL2d1aWRlL2J1aWxkI2NvbmZpZ3VyaW5nLWJyb3dzZXItY29tcGF0aWJpbGl0eScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEVuYWJsZSBpbmNyZW1lbnRhbCBjb21waWxhdGlvbiBieSBkZWZhdWx0IGlmIGNhY2hpbmcgaXMgZW5hYmxlZFxuICAgICAgICAgIGlmIChwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8ucGVyc2lzdGVudENhY2hlUGF0aCkge1xuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLmluY3JlbWVudGFsID8/PSB0cnVlO1xuICAgICAgICAgICAgLy8gU2V0IHRoZSBidWlsZCBpbmZvIGZpbGUgbG9jYXRpb24gdG8gdGhlIGNvbmZpZ3VyZWQgY2FjaGUgZGlyZWN0b3J5XG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMudHNCdWlsZEluZm9GaWxlID0gcGF0aC5qb2luKFxuICAgICAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZT8ucGVyc2lzdGVudENhY2hlUGF0aCxcbiAgICAgICAgICAgICAgJy50c2J1aWxkaW5mbycsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnMuaW5jcmVtZW50YWwgPSBmYWxzZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4uY29tcGlsZXJPcHRpb25zLFxuICAgICAgICAgICAgbm9FbWl0T25FcnJvcjogZmFsc2UsXG4gICAgICAgICAgICBpbmxpbmVTb3VyY2VzOiBwbHVnaW5PcHRpb25zLnNvdXJjZW1hcCxcbiAgICAgICAgICAgIGlubGluZVNvdXJjZU1hcDogcGx1Z2luT3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgICAgICBtYXBSb290OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBzb3VyY2VSb290OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgICBzaG91bGRUc0lnbm9yZUpzID0gIWFsbG93SnM7XG5cbiAgICAgICAgaWYgKGNvbXBpbGF0aW9uIGluc3RhbmNlb2YgTm9vcENvbXBpbGF0aW9uKSB7XG4gICAgICAgICAgYXdhaXQgVFNfQ09NUElMQVRJT05fUkVBRFk7XG5cbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGlhZ25vc3RpY3MgPSBhd2FpdCBjb21waWxhdGlvbi5kaWFnbm9zZUZpbGVzKCk7XG4gICAgICAgIGlmIChkaWFnbm9zdGljcy5lcnJvcnMpIHtcbiAgICAgICAgICAocmVzdWx0LmVycm9ycyA/Pz0gW10pLnB1c2goLi4uZGlhZ25vc3RpY3MuZXJyb3JzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGlhZ25vc3RpY3Mud2FybmluZ3MpIHtcbiAgICAgICAgICAocmVzdWx0Lndhcm5pbmdzID8/PSBbXSkucHVzaCguLi5kaWFnbm9zdGljcy53YXJuaW5ncyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgVHlwZVNjcmlwdCBmaWxlIG91dHB1dCBjYWNoZSBmb3IgYWxsIGFmZmVjdGVkIGZpbGVzXG4gICAgICAgIHByb2ZpbGVTeW5jKCdOR19FTUlUX1RTJywgKCkgPT4ge1xuICAgICAgICAgIGZvciAoY29uc3QgeyBmaWxlbmFtZSwgY29udGVudHMgfSBvZiBjb21waWxhdGlvbi5lbWl0QWZmZWN0ZWRGaWxlcygpKSB7XG4gICAgICAgICAgICB0eXBlU2NyaXB0RmlsZUNhY2hlLnNldChwYXRoVG9GaWxlVVJMKGZpbGVuYW1lKS5ocmVmLCBjb250ZW50cyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBTdG9yZSByZWZlcmVuY2VkIGZpbGVzIGZvciB1cGRhdGVkIGZpbGUgd2F0Y2hpbmcgaWYgZW5hYmxlZFxuICAgICAgICBpZiAocGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGUpIHtcbiAgICAgICAgICBwbHVnaW5PcHRpb25zLnNvdXJjZUZpbGVDYWNoZS5yZWZlcmVuY2VkRmlsZXMgPSByZWZlcmVuY2VkRmlsZXM7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXNldCB0aGUgc2V0dXAgd2FybmluZ3Mgc28gdGhhdCB0aGV5IGFyZSBvbmx5IHNob3duIGR1cmluZyB0aGUgZmlyc3QgYnVpbGQuXG4gICAgICAgIHNldHVwV2FybmluZ3MgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgLy8gVE9ETzogZmluZCBhIGJldHRlciB3YXkgdG8gdW5ibG9jayBUUyBjb21waWxhdGlvbiBvZiBzZXJ2ZXIgYnVuZGxlcy5cbiAgICAgICAgcmVzb2x2ZUNvbXBpbGF0aW9uUmVhZHk/LigpO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9banRdc3g/JC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHBsdWdpbk9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cz8uW2FyZ3MucGF0aF0gPz8gYXJncy5wYXRoO1xuXG4gICAgICAgIC8vIFNraXAgVFMgbG9hZCBhdHRlbXB0IGlmIEpTIFR5cGVTY3JpcHQgY29tcGlsYXRpb24gbm90IGVuYWJsZWQgYW5kIGZpbGUgaXMgSlNcbiAgICAgICAgaWYgKHNob3VsZFRzSWdub3JlSnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KHJlcXVlc3QpKSB7XG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBmaWxlbmFtZSBpcyBjdXJyZW50bHkgdXNlZCBhcyBhIGNhY2hlIGtleS4gU2luY2UgdGhlIGNhY2hlIGlzIG1lbW9yeSBvbmx5LFxuICAgICAgICAvLyB0aGUgb3B0aW9ucyBjYW5ub3QgY2hhbmdlIGFuZCBkbyBub3QgbmVlZCB0byBiZSByZXByZXNlbnRlZCBpbiB0aGUga2V5LiBJZiB0aGVcbiAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAvLyB3b3VsZCBuZWVkIHRvIGJlIGFkZGVkIHRvIHRoZSBrZXkgYXMgd2VsbCBhcyBhIGNoZWNrIGZvciBhbnkgY2hhbmdlIG9mIGNvbnRlbnQuXG4gICAgICAgIGxldCBjb250ZW50cyA9IHR5cGVTY3JpcHRGaWxlQ2FjaGUuZ2V0KHBhdGhUb0ZpbGVVUkwocmVxdWVzdCkuaHJlZik7XG5cbiAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBObyBUUyByZXN1bHQgaW5kaWNhdGVzIHRoZSBmaWxlIGlzIG5vdCBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0uXG4gICAgICAgICAgLy8gSWYgYWxsb3dKcyBpcyBlbmFibGVkIGFuZCB0aGUgZmlsZSBpcyBKUyB0aGVuIGRlZmVyIHRvIHRoZSBuZXh0IGxvYWQgaG9vay5cbiAgICAgICAgICBpZiAoIXNob3VsZFRzSWdub3JlSnMgJiYgL1xcLltjbV0/anMkLy50ZXN0KHJlcXVlc3QpKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE90aGVyd2lzZSByZXR1cm4gYW4gZXJyb3JcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZXJyb3JzOiBbXG4gICAgICAgICAgICAgIGNyZWF0ZU1pc3NpbmdGaWxlRXJyb3IocmVxdWVzdCwgYXJncy5wYXRoLCBidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyID8/ICcnKSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY29udGVudHMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgLy8gQSBzdHJpbmcgaW5kaWNhdGVzIHVudHJhbnNmb3JtZWQgb3V0cHV0IGZyb20gdGhlIFRTL05HIGNvbXBpbGVyXG4gICAgICAgICAgY29udGVudHMgPSBhd2FpdCBqYXZhc2NyaXB0VHJhbnNmb3JtZXIudHJhbnNmb3JtRGF0YShcbiAgICAgICAgICAgIHJlcXVlc3QsXG4gICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgIHRydWUgLyogc2tpcExpbmtlciAqLyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgLy8gU3RvcmUgYXMgdGhlIHJldHVybmVkIFVpbnQ4QXJyYXkgdG8gYWxsb3cgY2FjaGluZyB0aGUgZnVsbHkgdHJhbnNmb3JtZWQgY29kZVxuICAgICAgICAgIHR5cGVTY3JpcHRGaWxlQ2FjaGUuc2V0KHBhdGhUb0ZpbGVVUkwocmVxdWVzdCkuaHJlZiwgY29udGVudHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXFwuW2NtXT9qcyQvIH0sIChhcmdzKSA9PlxuICAgICAgICBwcm9maWxlQXN5bmMoXG4gICAgICAgICAgJ05HX0VNSVRfSlMqJyxcbiAgICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAvLyBUaGUgZmlsZW5hbWUgaXMgY3VycmVudGx5IHVzZWQgYXMgYSBjYWNoZSBrZXkuIFNpbmNlIHRoZSBjYWNoZSBpcyBtZW1vcnkgb25seSxcbiAgICAgICAgICAgIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAgICAgICAgICAgLy8gY2FjaGUgaXMgbGF0ZXIgc3RvcmVkIHRvIGRpc2ssIHRoZW4gdGhlIG9wdGlvbnMgdGhhdCBhZmZlY3QgdHJhbnNmb3JtIG91dHB1dFxuICAgICAgICAgICAgLy8gd291bGQgbmVlZCB0byBiZSBhZGRlZCB0byB0aGUga2V5IGFzIHdlbGwgYXMgYSBjaGVjayBmb3IgYW55IGNoYW5nZSBvZiBjb250ZW50LlxuICAgICAgICAgICAgbGV0IGNvbnRlbnRzID0gcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LmJhYmVsRmlsZUNhY2hlLmdldChhcmdzLnBhdGgpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgY29udGVudHMgPSBhd2FpdCBqYXZhc2NyaXB0VHJhbnNmb3JtZXIudHJhbnNmb3JtRmlsZShhcmdzLnBhdGgsIHBsdWdpbk9wdGlvbnMuaml0KTtcbiAgICAgICAgICAgICAgcGx1Z2luT3B0aW9ucy5zb3VyY2VGaWxlQ2FjaGU/LmJhYmVsRmlsZUNhY2hlLnNldChhcmdzLnBhdGgsIGNvbnRlbnRzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgY29udGVudHMsXG4gICAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSxcbiAgICAgICAgICB0cnVlLFxuICAgICAgICApLFxuICAgICAgKTtcblxuICAgICAgLy8gU2V0dXAgYnVuZGxpbmcgb2YgY29tcG9uZW50IHRlbXBsYXRlcyBhbmQgc3R5bGVzaGVldHMgd2hlbiBpbiBKSVQgbW9kZVxuICAgICAgaWYgKHBsdWdpbk9wdGlvbnMuaml0KSB7XG4gICAgICAgIHNldHVwSml0UGx1Z2luQ2FsbGJhY2tzKFxuICAgICAgICAgIGJ1aWxkLFxuICAgICAgICAgIHN0eWxlc2hlZXRCdW5kbGVyLFxuICAgICAgICAgIGFkZGl0aW9uYWxPdXRwdXRGaWxlcyxcbiAgICAgICAgICBzdHlsZU9wdGlvbnMuaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgYnVpbGQub25FbmQoKHJlc3VsdCkgPT4ge1xuICAgICAgICAvLyBBZGQgYW55IGFkZGl0aW9uYWwgb3V0cHV0IGZpbGVzIHRvIHRoZSBtYWluIG91dHB1dCBmaWxlc1xuICAgICAgICBpZiAoYWRkaXRpb25hbE91dHB1dEZpbGVzLmxlbmd0aCkge1xuICAgICAgICAgIHJlc3VsdC5vdXRwdXRGaWxlcz8ucHVzaCguLi5hZGRpdGlvbmFsT3V0cHV0RmlsZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ29tYmluZSBhZGRpdGlvbmFsIG1ldGFmaWxlcyB3aXRoIG1haW4gbWV0YWZpbGVcbiAgICAgICAgaWYgKHJlc3VsdC5tZXRhZmlsZSAmJiBhZGRpdGlvbmFsTWV0YWZpbGVzLmxlbmd0aCkge1xuICAgICAgICAgIGZvciAoY29uc3QgbWV0YWZpbGUgb2YgYWRkaXRpb25hbE1ldGFmaWxlcykge1xuICAgICAgICAgICAgcmVzdWx0Lm1ldGFmaWxlLmlucHV0cyA9IHsgLi4ucmVzdWx0Lm1ldGFmaWxlLmlucHV0cywgLi4ubWV0YWZpbGUuaW5wdXRzIH07XG4gICAgICAgICAgICByZXN1bHQubWV0YWZpbGUub3V0cHV0cyA9IHsgLi4ucmVzdWx0Lm1ldGFmaWxlLm91dHB1dHMsIC4uLm1ldGFmaWxlLm91dHB1dHMgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBsb2dDdW11bGF0aXZlRHVyYXRpb25zKCk7XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25EaXNwb3NlKCgpID0+IHZvaWQgc3R5bGVzaGVldEJ1bmRsZXIuZGlzcG9zZSgpKTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVNaXNzaW5nRmlsZUVycm9yKHJlcXVlc3Q6IHN0cmluZywgb3JpZ2luYWw6IHN0cmluZywgcm9vdDogc3RyaW5nKTogUGFydGlhbE1lc3NhZ2Uge1xuICBjb25zdCBlcnJvciA9IHtcbiAgICB0ZXh0OiBgRmlsZSAnJHtwYXRoLnJlbGF0aXZlKHJvb3QsIHJlcXVlc3QpfScgaXMgbWlzc2luZyBmcm9tIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGF0aW9uLmAsXG4gICAgbm90ZXM6IFtcbiAgICAgIHtcbiAgICAgICAgdGV4dDogYEVuc3VyZSB0aGUgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUeXBlU2NyaXB0IHByb2dyYW0gdmlhIHRoZSAnZmlsZXMnIG9yICdpbmNsdWRlJyBwcm9wZXJ0eS5gLFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xuXG4gIGlmIChyZXF1ZXN0ICE9PSBvcmlnaW5hbCkge1xuICAgIGVycm9yLm5vdGVzLnB1c2goe1xuICAgICAgdGV4dDogYEZpbGUgaXMgcmVxdWVzdGVkIGZyb20gYSBmaWxlIHJlcGxhY2VtZW50IG9mICcke3BhdGgucmVsYXRpdmUocm9vdCwgb3JpZ2luYWwpfScuYCxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBlcnJvcjtcbn1cbiJdfQ==