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
exports.buildEsbuildBrowser = void 0;
const architect_1 = require("@angular-devkit/architect");
const node_assert_1 = __importDefault(require("node:assert"));
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const utils_1 = require("../../utils");
const copy_assets_1 = require("../../utils/copy-assets");
const error_1 = require("../../utils/error");
const esbuild_targets_1 = require("../../utils/esbuild-targets");
const index_html_generator_1 = require("../../utils/index-file/index-html-generator");
const service_worker_1 = require("../../utils/service-worker");
const supported_browsers_1 = require("../../utils/supported-browsers");
const compiler_plugin_1 = require("./compiler-plugin");
const esbuild_1 = require("./esbuild");
const experimental_warnings_1 = require("./experimental-warnings");
const options_1 = require("./options");
const sass_plugin_1 = require("./sass-plugin");
const stylesheets_1 = require("./stylesheets");
const watcher_1 = require("./watcher");
/**
 * Represents the result of a single builder execute call.
 */
class ExecutionResult {
    constructor(success, codeRebuild, globalStylesRebuild, codeBundleCache) {
        this.success = success;
        this.codeRebuild = codeRebuild;
        this.globalStylesRebuild = globalStylesRebuild;
        this.codeBundleCache = codeBundleCache;
    }
    get output() {
        return {
            success: this.success,
        };
    }
    createRebuildState(fileChanges) {
        var _a;
        (_a = this.codeBundleCache) === null || _a === void 0 ? void 0 : _a.invalidate([...fileChanges.modified, ...fileChanges.removed]);
        return {
            codeRebuild: this.codeRebuild,
            globalStylesRebuild: this.globalStylesRebuild,
            codeBundleCache: this.codeBundleCache,
            fileChanges,
        };
    }
    dispose() {
        var _a;
        (_a = this.codeRebuild) === null || _a === void 0 ? void 0 : _a.dispose();
    }
}
async function execute(options, context, rebuildState) {
    var _a, _b, _c, _d;
    const startTime = process.hrtime.bigint();
    const { projectRoot, workspaceRoot, optimizationOptions, outputPath, assets, serviceWorkerOptions, indexHtmlOptions, } = options;
    const target = (0, esbuild_targets_1.transformSupportedBrowsersToTargets)((0, supported_browsers_1.getSupportedBrowsers)(projectRoot, context.logger));
    const codeBundleCache = options.watch
        ? (_a = rebuildState === null || rebuildState === void 0 ? void 0 : rebuildState.codeBundleCache) !== null && _a !== void 0 ? _a : new compiler_plugin_1.SourceFileCache()
        : undefined;
    const [codeResults, styleResults] = await Promise.all([
        // Execute esbuild to bundle the application code
        (0, esbuild_1.bundle)(workspaceRoot, (_b = rebuildState === null || rebuildState === void 0 ? void 0 : rebuildState.codeRebuild) !== null && _b !== void 0 ? _b : createCodeBundleOptions(options, target, codeBundleCache)),
        // Execute esbuild to bundle the global stylesheets
        (0, esbuild_1.bundle)(workspaceRoot, (_c = rebuildState === null || rebuildState === void 0 ? void 0 : rebuildState.globalStylesRebuild) !== null && _c !== void 0 ? _c : createGlobalStylesBundleOptions(options, target)),
    ]);
    // Log all warnings and errors generated during bundling
    await (0, esbuild_1.logMessages)(context, {
        errors: [...codeResults.errors, ...styleResults.errors],
        warnings: [...codeResults.warnings, ...styleResults.warnings],
    });
    // Return if the bundling failed to generate output files or there are errors
    if (!codeResults.outputFiles || codeResults.errors.length) {
        return new ExecutionResult(false, rebuildState === null || rebuildState === void 0 ? void 0 : rebuildState.codeRebuild, (_d = (styleResults.outputFiles && styleResults.rebuild)) !== null && _d !== void 0 ? _d : rebuildState === null || rebuildState === void 0 ? void 0 : rebuildState.globalStylesRebuild, codeBundleCache);
    }
    // Return if the global stylesheet bundling has errors
    if (!styleResults.outputFiles || styleResults.errors.length) {
        return new ExecutionResult(false, codeResults.rebuild, rebuildState === null || rebuildState === void 0 ? void 0 : rebuildState.globalStylesRebuild, codeBundleCache);
    }
    // Filter global stylesheet initial files
    styleResults.initialFiles = styleResults.initialFiles.filter(({ name }) => { var _a; return (_a = options.globalStyles.find((style) => style.name === name)) === null || _a === void 0 ? void 0 : _a.initial; });
    // Combine the bundling output files
    const initialFiles = [...codeResults.initialFiles, ...styleResults.initialFiles];
    const outputFiles = [...codeResults.outputFiles, ...styleResults.outputFiles];
    // Generate index HTML file
    if (indexHtmlOptions) {
        // Create an index HTML generator that reads from the in-memory output files
        const indexHtmlGenerator = new index_html_generator_1.IndexHtmlGenerator({
            indexPath: indexHtmlOptions.input,
            entrypoints: indexHtmlOptions.insertionOrder,
            sri: options.subresourceIntegrity,
            optimization: optimizationOptions,
            crossOrigin: options.crossOrigin,
        });
        /** Virtual output path to support reading in-memory files. */
        const virtualOutputPath = '/';
        indexHtmlGenerator.readAsset = async function (filePath) {
            // Remove leading directory separator
            const relativefilePath = path.relative(virtualOutputPath, filePath);
            const file = outputFiles.find((file) => file.path === relativefilePath);
            if (file) {
                return file.text;
            }
            throw new Error(`Output file does not exist: ${path}`);
        };
        const { content, warnings, errors } = await indexHtmlGenerator.process({
            baseHref: options.baseHref,
            lang: undefined,
            outputPath: virtualOutputPath,
            files: initialFiles,
        });
        for (const error of errors) {
            context.logger.error(error);
        }
        for (const warning of warnings) {
            context.logger.warn(warning);
        }
        outputFiles.push(createOutputFileFromText(indexHtmlOptions.output, content));
    }
    // Copy assets
    if (assets) {
        await (0, copy_assets_1.copyAssets)(assets, [outputPath], workspaceRoot);
    }
    // Write output files
    await Promise.all(outputFiles.map((file) => fs.writeFile(path.join(outputPath, file.path), file.contents)));
    // Augment the application with service worker support
    // TODO: This should eventually operate on the in-memory files prior to writing the output files
    if (serviceWorkerOptions) {
        try {
            await (0, service_worker_1.augmentAppWithServiceWorkerEsbuild)(workspaceRoot, serviceWorkerOptions, outputPath, options.baseHref || '/');
        }
        catch (error) {
            context.logger.error(error instanceof Error ? error.message : `${error}`);
            return new ExecutionResult(false, codeResults.rebuild, styleResults.rebuild, codeBundleCache);
        }
    }
    const buildTime = Number(process.hrtime.bigint() - startTime) / 10 ** 9;
    context.logger.info(`Complete. [${buildTime.toFixed(3)} seconds]`);
    return new ExecutionResult(true, codeResults.rebuild, styleResults.rebuild, codeBundleCache);
}
function createOutputFileFromText(path, text) {
    return {
        path,
        text,
        get contents() {
            return Buffer.from(this.text, 'utf-8');
        },
    };
}
function createCodeBundleOptions(options, target, sourceFileCache) {
    const { workspaceRoot, entryPoints, optimizationOptions, sourcemapOptions, tsconfig, outputNames, fileReplacements, externalDependencies, preserveSymlinks, stylePreprocessorOptions, advancedOptimizations, } = options;
    return {
        absWorkingDir: workspaceRoot,
        bundle: true,
        incremental: options.watch,
        format: 'esm',
        entryPoints,
        entryNames: outputNames.bundles,
        assetNames: outputNames.media,
        target,
        supported: {
            // Native async/await is not supported with Zone.js. Disabling support here will cause
            // esbuild to downlevel async/await and for await...of to a Zone.js supported form. However, esbuild
            // does not currently support downleveling async generators. Instead babel is used within the JS/TS
            // loader to perform the downlevel transformation.
            // NOTE: If esbuild adds support in the future, the babel support for async generators can be disabled.
            'async-await': false,
            // V8 currently has a performance defect involving object spread operations that can cause signficant
            // degradation in runtime performance. By not supporting the language feature here, a downlevel form
            // will be used instead which provides a workaround for the performance issue.
            // For more details: https://bugs.chromium.org/p/v8/issues/detail?id=11536
            'object-rest-spread': false,
        },
        mainFields: ['es2020', 'browser', 'module', 'main'],
        conditions: ['es2020', 'es2015', 'module'],
        resolveExtensions: ['.ts', '.tsx', '.mjs', '.js'],
        logLevel: options.verbose ? 'debug' : 'silent',
        minify: optimizationOptions.scripts,
        pure: ['forwardRef'],
        outdir: workspaceRoot,
        sourcemap: sourcemapOptions.scripts && (sourcemapOptions.hidden ? 'external' : true),
        splitting: true,
        tsconfig,
        external: externalDependencies,
        write: false,
        platform: 'browser',
        preserveSymlinks,
        plugins: [
            (0, compiler_plugin_1.createCompilerPlugin)(
            // JS/TS options
            {
                sourcemap: !!sourcemapOptions.scripts,
                thirdPartySourcemaps: sourcemapOptions.vendor,
                tsconfig,
                advancedOptimizations,
                fileReplacements,
                sourceFileCache,
            }, 
            // Component stylesheet options
            {
                workspaceRoot,
                optimization: !!optimizationOptions.styles.minify,
                sourcemap: 
                // Hidden component stylesheet sourcemaps are inaccessible which is effectively
                // the same as being disabled. Disabling has the advantage of avoiding the overhead
                // of sourcemap processing.
                !!sourcemapOptions.styles && (sourcemapOptions.hidden ? false : 'inline'),
                outputNames,
                includePaths: stylePreprocessorOptions === null || stylePreprocessorOptions === void 0 ? void 0 : stylePreprocessorOptions.includePaths,
                externalDependencies,
                target,
            }),
        ],
        define: {
            ...(optimizationOptions.scripts ? { 'ngDevMode': 'false' } : undefined),
            'ngJitMode': 'false',
        },
    };
}
function createGlobalStylesBundleOptions(options, target) {
    const { workspaceRoot, optimizationOptions, sourcemapOptions, outputNames, globalStyles, preserveSymlinks, externalDependencies, stylePreprocessorOptions, watch, } = options;
    const buildOptions = (0, stylesheets_1.createStylesheetBundleOptions)({
        workspaceRoot,
        optimization: !!optimizationOptions.styles.minify,
        sourcemap: !!sourcemapOptions.styles,
        preserveSymlinks,
        target,
        externalDependencies,
        outputNames,
        includePaths: stylePreprocessorOptions === null || stylePreprocessorOptions === void 0 ? void 0 : stylePreprocessorOptions.includePaths,
    });
    buildOptions.incremental = watch;
    const namespace = 'angular:styles/global';
    buildOptions.entryPoints = {};
    for (const { name } of globalStyles) {
        buildOptions.entryPoints[name] = `${namespace};${name}`;
    }
    buildOptions.plugins.unshift({
        name: 'angular-global-styles',
        setup(build) {
            build.onResolve({ filter: /^angular:styles\/global;/ }, (args) => {
                if (args.kind !== 'entry-point') {
                    return null;
                }
                return {
                    path: args.path.split(';', 2)[1],
                    namespace,
                };
            });
            build.onLoad({ filter: /./, namespace }, (args) => {
                var _a;
                const files = (_a = globalStyles.find(({ name }) => name === args.path)) === null || _a === void 0 ? void 0 : _a.files;
                (0, node_assert_1.default)(files, `global style name should always be found [${args.path}]`);
                return {
                    contents: files.map((file) => `@import '${file.replace(/\\/g, '/')}';`).join('\n'),
                    loader: 'css',
                    resolveDir: workspaceRoot,
                };
            });
        },
    });
    return buildOptions;
}
/**
 * Main execution function for the esbuild-based application builder.
 * The options are compatible with the Webpack-based builder.
 * @param initialOptions The browser builder options to use when setting up the application build
 * @param context The Architect builder context object
 * @returns An async iterable with the builder result output
 */
async function* buildEsbuildBrowser(initialOptions, context) {
    var _a;
    // Only AOT is currently supported
    if (initialOptions.aot !== true) {
        context.logger.error('JIT mode is currently not supported by this experimental builder. AOT mode must be used.');
        return { success: false };
    }
    // Inform user of experimental status of builder and options
    (0, experimental_warnings_1.logExperimentalWarnings)(initialOptions, context);
    // Determine project name from builder context target
    const projectName = (_a = context.target) === null || _a === void 0 ? void 0 : _a.project;
    if (!projectName) {
        context.logger.error(`The 'browser-esbuild' builder requires a target to be specified.`);
        return { success: false };
    }
    const normalizedOptions = await (0, options_1.normalizeOptions)(context, projectName, initialOptions);
    // Clean output path if enabled
    if (initialOptions.deleteOutputPath) {
        (0, utils_1.deleteOutputDir)(normalizedOptions.workspaceRoot, initialOptions.outputPath);
    }
    // Create output directory if needed
    try {
        await fs.mkdir(normalizedOptions.outputPath, { recursive: true });
    }
    catch (e) {
        (0, error_1.assertIsError)(e);
        context.logger.error('Unable to create output directory: ' + e.message);
        return { success: false };
    }
    // Initial build
    let result = await execute(normalizedOptions, context);
    yield result.output;
    // Finish if watch mode is not enabled
    if (!initialOptions.watch) {
        (0, sass_plugin_1.shutdownSassWorkerPool)();
        return;
    }
    context.logger.info('Watch mode enabled. Watching for file changes...');
    // Setup a watcher
    const watcher = (0, watcher_1.createWatcher)({
        polling: typeof initialOptions.poll === 'number',
        interval: initialOptions.poll,
        // Ignore the output and cache paths to avoid infinite rebuild cycles
        ignored: [normalizedOptions.outputPath, normalizedOptions.cacheOptions.basePath],
    });
    // Temporarily watch the entire project
    watcher.add(normalizedOptions.projectRoot);
    // Watch workspace root node modules
    // Includes Yarn PnP manifest files (https://yarnpkg.com/advanced/pnp-spec/)
    watcher.add(path.join(normalizedOptions.workspaceRoot, 'node_modules'));
    watcher.add(path.join(normalizedOptions.workspaceRoot, '.pnp.cjs'));
    watcher.add(path.join(normalizedOptions.workspaceRoot, '.pnp.data.json'));
    // Wait for changes and rebuild as needed
    try {
        for await (const changes of watcher) {
            context.logger.info('Changes detected. Rebuilding...');
            if (initialOptions.verbose) {
                context.logger.info(changes.toDebugString());
            }
            result = await execute(normalizedOptions, context, result.createRebuildState(changes));
            yield result.output;
        }
    }
    finally {
        // Stop the watcher
        await watcher.close();
        // Cleanup incremental rebuild state
        result.dispose();
        (0, sass_plugin_1.shutdownSassWorkerPool)();
    }
}
exports.buildEsbuildBrowser = buildEsbuildBrowser;
exports.default = (0, architect_1.createBuilder)(buildEsbuildBrowser);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFFekYsOERBQWlDO0FBQ2pDLHFEQUF1QztBQUN2QyxnREFBa0M7QUFDbEMsdUNBQThDO0FBQzlDLHlEQUFxRDtBQUNyRCw2Q0FBa0Q7QUFDbEQsaUVBQWtGO0FBRWxGLHNGQUFpRjtBQUNqRiwrREFBZ0Y7QUFDaEYsdUVBQXNFO0FBQ3RFLHVEQUEwRTtBQUMxRSx1Q0FBZ0Q7QUFDaEQsbUVBQWtFO0FBQ2xFLHVDQUF1RTtBQUN2RSwrQ0FBdUQ7QUFFdkQsK0NBQThEO0FBQzlELHVDQUF3RDtBQVN4RDs7R0FFRztBQUNILE1BQU0sZUFBZTtJQUNuQixZQUNVLE9BQWdCLEVBQ2hCLFdBQTZCLEVBQzdCLG1CQUFxQyxFQUNyQyxlQUFpQztRQUhqQyxZQUFPLEdBQVAsT0FBTyxDQUFTO1FBQ2hCLGdCQUFXLEdBQVgsV0FBVyxDQUFrQjtRQUM3Qix3QkFBbUIsR0FBbkIsbUJBQW1CLENBQWtCO1FBQ3JDLG9CQUFlLEdBQWYsZUFBZSxDQUFrQjtJQUN4QyxDQUFDO0lBRUosSUFBSSxNQUFNO1FBQ1IsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTztTQUN0QixDQUFDO0lBQ0osQ0FBQztJQUVELGtCQUFrQixDQUFDLFdBQXlCOztRQUMxQyxNQUFBLElBQUksQ0FBQyxlQUFlLDBDQUFFLFVBQVUsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDLFFBQVEsRUFBRSxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBRXBGLE9BQU87WUFDTCxXQUFXLEVB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Q0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ3ZGLE1BQU0sTUFBTSxDQUFDLE1BQU0sQ0FBQztTQUNyQjtLQUNGO1lBQVM7UUFDUixtQkFBbUI7UUFDbkIsTUFBTSxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDdEIsb0NBQW9DO1FBQ3BDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNqQixJQUFBLG9DQUFzQixHQUFFLENBQUM7S0FDMUI7QUFDSCxDQUFDO0FBMUZELGtEQTBGQztBQUVELGtCQUFlLElBQUEseUJBQWEsRUFBQyxtQkFBbUIsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgdHlwZSB7IEJ1aWxkSW52YWxpZGF0ZSwgQnVpbGRPcHRpb25zLCBPdXRwdXRGaWxlIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZGVsZXRlT3V0cHV0RGlyIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgY29weUFzc2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvcHktYXNzZXRzJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2VzYnVpbGQtdGFyZ2V0cyc7XG5pbXBvcnQgeyBGaWxlSW5mbyB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvYXVnbWVudC1pbmRleC1odG1sJztcbmltcG9ydCB7IEluZGV4SHRtbEdlbmVyYXRvciB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyRXNidWlsZCB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IGdldFN1cHBvcnRlZEJyb3dzZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3VwcG9ydGVkLWJyb3dzZXJzJztcbmltcG9ydCB7IFNvdXJjZUZpbGVDYWNoZSwgY3JlYXRlQ29tcGlsZXJQbHVnaW4gfSBmcm9tICcuL2NvbXBpbGVyLXBsdWdpbic7XG5pbXBvcnQgeyBidW5kbGUsIGxvZ01lc3NhZ2VzIH0gZnJvbSAnLi9lc2J1aWxkJztcbmltcG9ydCB7IGxvZ0V4cGVyaW1lbnRhbFdhcm5pbmdzIH0gZnJvbSAnLi9leHBlcmltZW50YWwtd2FybmluZ3MnO1xuaW1wb3J0IHsgTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zLCBub3JtYWxpemVPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB7IHNodXRkb3duU2Fzc1dvcmtlclBvb2wgfSBmcm9tICcuL3Nhc3MtcGx1Z2luJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQgeyBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyB9IGZyb20gJy4vc3R5bGVzaGVldHMnO1xuaW1wb3J0IHsgQ2hhbmdlZEZpbGVzLCBjcmVhdGVXYXRjaGVyIH0gZnJvbSAnLi93YXRjaGVyJztcblxuaW50ZXJmYWNlIFJlYnVpbGRTdGF0ZSB7XG4gIGNvZGVSZWJ1aWxkPzogQnVpbGRJbnZhbGlkYXRlO1xuICBnbG9iYWxTdHlsZXNSZWJ1aWxkPzogQnVpbGRJbnZhbGlkYXRlO1xuICBjb2RlQnVuZGxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGU7XG4gIGZpbGVDaGFuZ2VzOiBDaGFuZ2VkRmlsZXM7XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyB0aGUgcmVzdWx0IG9mIGEgc2luZ2xlIGJ1aWxkZXIgZXhlY3V0ZSBjYWxsLlxuICovXG5jbGFzcyBFeGVjdXRpb25SZXN1bHQge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHN1Y2Nlc3M6IGJvb2xlYW4sXG4gICAgcHJpdmF0ZSBjb2RlUmVidWlsZD86IEJ1aWxkSW52YWxpZGF0ZSxcbiAgICBwcml2YXRlIGdsb2JhbFN0eWxlc1JlYnVpbGQ/OiBCdWlsZEludmFsaWRhdGUsXG4gICAgcHJpdmF0ZSBjb2RlQnVuZGxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4gICkge31cblxuICBnZXQgb3V0cHV0KCkge1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0aGlzLnN1Y2Nlc3MsXG4gICAgfTtcbiAgfVxuXG4gIGNyZWF0ZVJlYnVpbGRTdGF0ZShmaWxlQ2hhbmdlczogQ2hhbmdlZEZpbGVzKTogUmVidWlsZFN0YXRlIHtcbiAgICB0aGlzLmNvZGVCdW5kbGVDYWNoZT8uaW52YWxpZGF0ZShbLi4uZmlsZUNoYW5nZXMubW9kaWZpZWQsIC4uLmZpbGVDaGFuZ2VzLnJlbW92ZWRdKTtcblxuICAgIHJldHVybiB7XG4gICAgICBjb2RlUmVidWlsZDogdGhpcy5jb2RlUmVidWlsZCxcbiAgICAgIGdsb2JhbFN0eWxlc1JlYnVpbGQ6IHRoaXMuZ2xvYmFsU3R5bGVzUmVidWlsZCxcbiAgICAgIGNvZGVCdW5kbGVDYWNoZTogdGhpcy5jb2RlQnVuZGxlQ2FjaGUsXG4gICAgICBmaWxlQ2hhbmdlcyxcbiAgICB9O1xuICB9XG5cbiAgZGlzcG9zZSgpOiB2b2lkIHtcbiAgICB0aGlzLmNvZGVSZWJ1aWxkPy5kaXNwb3NlKCk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZXhlY3V0ZShcbiAgb3B0aW9uczogTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgcmVidWlsZFN0YXRlPzogUmVidWlsZFN0YXRlLFxuKTogUHJvbWlzZTxFeGVjdXRpb25SZXN1bHQ+IHtcbiAgY29uc3Qgc3RhcnRUaW1lID0gcHJvY2Vzcy5ocnRpbWUuYmlnaW50KCk7XG5cbiAgY29uc3Qge1xuICAgIHByb2plY3RSb290LFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBvdXRwdXRQYXRoLFxuICAgIGFzc2V0cyxcbiAgICBzZXJ2aWNlV29ya2VyT3B0aW9ucyxcbiAgICBpbmRleEh0bWxPcHRpb25zLFxuICB9ID0gb3B0aW9ucztcblxuICBjb25zdCB0YXJnZXQgPSB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyhcbiAgICBnZXRTdXBwb3J0ZWRCcm93c2Vycyhwcm9qZWN0Um9vdCwgY29udGV4dC5sb2dnZXIpLFxuICApO1xuXG4gIGNvbnN0IGNvZGVCdW5kbGVDYWNoZSA9IG9wdGlvbnMud2F0Y2hcbiAgICA/IHJlYnVpbGRTdGF0ZT8uY29kZUJ1bmRsZUNhY2hlID8/IG5ldyBTb3VyY2VGaWxlQ2FjaGUoKVxuICAgIDogdW5kZWZpbmVkO1xuXG4gIGNvbnN0IFtjb2RlUmVzdWx0cywgc3R5bGVSZXN1bHRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAvLyBFeGVjdXRlIGVzYnVpbGQgdG8gYnVuZGxlIHRoZSBhcHBsaWNhdGlvbiBjb2RlXG4gICAgYnVuZGxlKFxuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgIHJlYnVpbGRTdGF0ZT8uY29kZVJlYnVpbGQgPz8gY3JlYXRlQ29kZUJ1bmRsZU9wdGlvbnMob3B0aW9ucywgdGFyZ2V0LCBjb2RlQnVuZGxlQ2FjaGUpLFxuICAgICksXG4gICAgLy8gRXhlY3V0ZSBlc2J1aWxkIHRvIGJ1bmRsZSB0aGUgZ2xvYmFsIHN0eWxlc2hlZXRzXG4gICAgYnVuZGxlKFxuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgIHJlYnVpbGRTdGF0ZT8uZ2xvYmFsU3R5bGVzUmVidWlsZCA/PyBjcmVhdGVHbG9iYWxTdHlsZXNCdW5kbGVPcHRpb25zKG9wdGlvbnMsIHRhcmdldCksXG4gICAgKSxcbiAgXSk7XG5cbiAgLy8gTG9nIGFsbCB3YXJuaW5ncyBhbmQgZXJyb3JzIGdlbmVyYXRlZCBkdXJpbmcgYnVuZGxpbmdcbiAgYXdhaXQgbG9nTWVzc2FnZXMoY29udGV4dCwge1xuICAgIGVycm9yczogWy4uLmNvZGVSZXN1bHRzLmVycm9ycywgLi4uc3R5bGVSZXN1bHRzLmVycm9yc10sXG4gICAgd2FybmluZ3M6IFsuLi5jb2RlUmVzdWx0cy53YXJuaW5ncywgLi4uc3R5bGVSZXN1bHRzLndhcm5pbmdzXSxcbiAgfSk7XG5cbiAgLy8gUmV0dXJuIGlmIHRoZSBidW5kbGluZyBmYWlsZWQgdG8gZ2VuZXJhdGUgb3V0cHV0IGZpbGVzIG9yIHRoZXJlIGFyZSBlcnJvcnNcbiAgaWYgKCFjb2RlUmVzdWx0cy5vdXRwdXRGaWxlcyB8fCBjb2RlUmVzdWx0cy5lcnJvcnMubGVuZ3RoKSB7XG4gICAgcmV0dXJuIG5ldyBFeGVjdXRpb25SZXN1bHQoXG4gICAgICBmYWxzZSxcbiAgICAgIHJlYnVpbGRTdGF0ZT8uY29kZVJlYnVpbGQsXG4gICAgICAoc3R5bGVSZXN1bHRzLm91dHB1dEZpbGVzICYmIHN0eWxlUmVzdWx0cy5yZWJ1aWxkKSA/PyByZWJ1aWxkU3RhdGU/Lmdsb2JhbFN0eWxlc1JlYnVpbGQsXG4gICAgICBjb2RlQnVuZGxlQ2FjaGUsXG4gICAgKTtcbiAgfVxuXG4gIC8vIFJldHVybiBpZiB0aGUgZ2xvYmFsIHN0eWxlc2hlZXQgYnVuZGxpbmcgaGFzIGVycm9yc1xuICBpZiAoIXN0eWxlUmVzdWx0cy5vdXRwdXRGaWxlcyB8fCBzdHlsZVJlc3VsdHMuZXJyb3JzLmxlbmd0aCkge1xuICAgIHJldHVybiBuZXcgRXhlY3V0aW9uUmVzdWx0KFxuICAgICAgZmFsc2UsXG4gICAgICBjb2RlUmVzdWx0cy5yZWJ1aWxkLFxuICAgICAgcmVidWlsZFN0YXRlPy5nbG9iYWxTdHlsZXNSZWJ1aWxkLFxuICAgICAgY29kZUJ1bmRsZUNhY2hlLFxuICAgICk7XG4gIH1cblxuICAvLyBGaWx0ZXIgZ2xvYmFsIHN0eWxlc2hlZXQgaW5pdGlhbCBmaWxlc1xuICBzdHlsZVJlc3VsdHMuaW5pdGlhbEZpbGVzID0gc3R5bGVSZXN1bHRzLmluaXRpYWxGaWxlcy5maWx0ZXIoXG4gICAgKHsgbmFtZSB9KSA9PiBvcHRpb25zLmdsb2JhbFN0eWxlcy5maW5kKChzdHlsZSkgPT4gc3R5bGUubmFtZSA9PT0gbmFtZSk/LmluaXRpYWwsXG4gICk7XG5cbiAgLy8gQ29tYmluZSB0aGUgYnVuZGxpbmcgb3V0cHV0IGZpbGVzXG4gIGNvbnN0IGluaXRpYWxGaWxlczogRmlsZUluZm9bXSA9IFsuLi5jb2RlUmVzdWx0cy5pbml0aWFsRmlsZXMsIC4uLnN0eWxlUmVzdWx0cy5pbml0aWFsRmlsZXNdO1xuICBjb25zdCBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdID0gWy4uLmNvZGVSZXN1bHRzLm91dHB1dEZpbGVzLCAuLi5zdHlsZVJlc3VsdHMub3V0cHV0RmlsZXNdO1xuXG4gIC8vIEdlbmVyYXRlIGluZGV4IEhUTUwgZmlsZVxuICBpZiAoaW5kZXhIdG1sT3B0aW9ucykge1xuICAgIC8vIENyZWF0ZSBhbiBpbmRleCBIVE1MIGdlbmVyYXRvciB0aGF0IHJlYWRzIGZyb20gdGhlIGluLW1lbW9yeSBvdXRwdXQgZmlsZXNcbiAgICBjb25zdCBpbmRleEh0bWxHZW5lcmF0b3IgPSBuZXcgSW5kZXhIdG1sR2VuZXJhdG9yKHtcbiAgICAgIGluZGV4UGF0aDogaW5kZXhIdG1sT3B0aW9ucy5pbnB1dCxcbiAgICAgIGVudHJ5cG9pbnRzOiBpbmRleEh0bWxPcHRpb25zLmluc2VydGlvbk9yZGVyLFxuICAgICAgc3JpOiBvcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgICAgb3B0aW1pemF0aW9uOiBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgICAgY3Jvc3NPcmlnaW46IG9wdGlvbnMuY3Jvc3NPcmlnaW4sXG4gICAgfSk7XG5cbiAgICAvKiogVmlydHVhbCBvdXRwdXQgcGF0aCB0byBzdXBwb3J0IHJlYWRpbmcgaW4tbWVtb3J5IGZpbGVzLiAqL1xuICAgIGNvbnN0IHZpcnR1YWxPdXRwdXRQYXRoID0gJy8nO1xuICAgIGluZGV4SHRtbEdlbmVyYXRvci5yZWFkQXNzZXQgPSBhc3luYyBmdW5jdGlvbiAoZmlsZVBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgICAvLyBSZW1vdmUgbGVhZGluZyBkaXJlY3Rvcnkgc2VwYXJhdG9yXG4gICAgICBjb25zdCByZWxhdGl2ZWZpbGVQYXRoID0gcGF0aC5yZWxhdGl2ZSh2aXJ0dWFsT3V0cHV0UGF0aCwgZmlsZVBhdGgpO1xuICAgICAgY29uc3QgZmlsZSA9IG91dHB1dEZpbGVzLmZpbmQoKGZpbGUpID0+IGZpbGUucGF0aCA9PT0gcmVsYXRpdmVmaWxlUGF0aCk7XG4gICAgICBpZiAoZmlsZSkge1xuICAgICAgICByZXR1cm4gZmlsZS50ZXh0O1xuICAgICAgfVxuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE91dHB1dCBmaWxlIGRvZXMgbm90IGV4aXN0OiAke3BhdGh9YCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHsgY29udGVudCwgd2FybmluZ3MsIGVycm9ycyB9ID0gYXdhaXQgaW5kZXhIdG1sR2VuZXJhdG9yLnByb2Nlc3Moe1xuICAgICAgYmFzZUhyZWY6IG9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICBsYW5nOiB1bmRlZmluZWQsXG4gICAgICBvdXRwdXRQYXRoOiB2aXJ0dWFsT3V0cHV0UGF0aCxcbiAgICAgIGZpbGVzOiBpbml0aWFsRmlsZXMsXG4gICAgfSk7XG5cbiAgICBmb3IgKGNvbnN0IGVycm9yIG9mIGVycm9ycykge1xuICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZXJyb3IpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHdhcm5pbmcgb2Ygd2FybmluZ3MpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4od2FybmluZyk7XG4gICAgfVxuXG4gICAgb3V0cHV0RmlsZXMucHVzaChjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQoaW5kZXhIdG1sT3B0aW9ucy5vdXRwdXQsIGNvbnRlbnQpKTtcbiAgfVxuXG4gIC8vIENvcHkgYXNzZXRzXG4gIGlmIChhc3NldHMpIHtcbiAgICBhd2FpdCBjb3B5QXNzZXRzKGFzc2V0cywgW291dHB1dFBhdGhdLCB3b3Jrc3BhY2VSb290KTtcbiAgfVxuXG4gIC8vIFdyaXRlIG91dHB1dCBmaWxlc1xuICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICBvdXRwdXRGaWxlcy5tYXAoKGZpbGUpID0+IGZzLndyaXRlRmlsZShwYXRoLmpvaW4ob3V0cHV0UGF0aCwgZmlsZS5wYXRoKSwgZmlsZS5jb250ZW50cykpLFxuICApO1xuXG4gIC8vIEF1Z21lbnQgdGhlIGFwcGxpY2F0aW9uIHdpdGggc2VydmljZSB3b3JrZXIgc3VwcG9ydFxuICAvLyBUT0RPOiBUaGlzIHNob3VsZCBldmVudHVhbGx5IG9wZXJhdGUgb24gdGhlIGluLW1lbW9yeSBmaWxlcyBwcmlvciB0byB3cml0aW5nIHRoZSBvdXRwdXQgZmlsZXNcbiAgaWYgKHNlcnZpY2VXb3JrZXJPcHRpb25zKSB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlckVzYnVpbGQoXG4gICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIHNlcnZpY2VXb3JrZXJPcHRpb25zLFxuICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICBvcHRpb25zLmJhc2VIcmVmIHx8ICcvJyxcbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogYCR7ZXJyb3J9YCk7XG5cbiAgICAgIHJldHVybiBuZXcgRXhlY3V0aW9uUmVzdWx0KGZhbHNlLCBjb2RlUmVzdWx0cy5yZWJ1aWxkLCBzdHlsZVJlc3VsdHMucmVidWlsZCwgY29kZUJ1bmRsZUNhY2hlKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBidWlsZFRpbWUgPSBOdW1iZXIocHJvY2Vzcy5ocnRpbWUuYmlnaW50KCkgLSBzdGFydFRpbWUpIC8gMTAgKiogOTtcbiAgY29udGV4dC5sb2dnZXIuaW5mbyhgQ29tcGxldGUuIFske2J1aWxkVGltZS50b0ZpeGVkKDMpfSBzZWNvbmRzXWApO1xuXG4gIHJldHVybiBuZXcgRXhlY3V0aW9uUmVzdWx0KHRydWUsIGNvZGVSZXN1bHRzLnJlYnVpbGQsIHN0eWxlUmVzdWx0cy5yZWJ1aWxkLCBjb2RlQnVuZGxlQ2FjaGUpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQocGF0aDogc3RyaW5nLCB0ZXh0OiBzdHJpbmcpOiBPdXRwdXRGaWxlIHtcbiAgcmV0dXJuIHtcbiAgICBwYXRoLFxuICAgIHRleHQsXG4gICAgZ2V0IGNvbnRlbnRzKCkge1xuICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKHRoaXMudGV4dCwgJ3V0Zi04Jyk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ29kZUJ1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyxcbiAgdGFyZ2V0OiBzdHJpbmdbXSxcbiAgc291cmNlRmlsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlLFxuKTogQnVpbGRPcHRpb25zIHtcbiAgY29uc3Qge1xuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgZW50cnlQb2ludHMsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIGZpbGVSZXBsYWNlbWVudHMsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zLFxuICB9ID0gb3B0aW9ucztcblxuICByZXR1cm4ge1xuICAgIGFic1dvcmtpbmdEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgYnVuZGxlOiB0cnVlLFxuICAgIGluY3JlbWVudGFsOiBvcHRpb25zLndhdGNoLFxuICAgIGZvcm1hdDogJ2VzbScsXG4gICAgZW50cnlQb2ludHMsXG4gICAgZW50cnlOYW1lczogb3V0cHV0TmFtZXMuYnVuZGxlcyxcbiAgICBhc3NldE5hbWVzOiBvdXRwdXROYW1lcy5tZWRpYSxcbiAgICB0YXJnZXQsXG4gICAgc3VwcG9ydGVkOiB7XG4gICAgICAvLyBOYXRpdmUgYXN5bmMvYXdhaXQgaXMgbm90IHN1cHBvcnRlZCB3aXRoIFpvbmUuanMuIERpc2FibGluZyBzdXBwb3J0IGhlcmUgd2lsbCBjYXVzZVxuICAgICAgLy8gZXNidWlsZCB0byBkb3dubGV2ZWwgYXN5bmMvYXdhaXQgYW5kIGZvciBhd2FpdC4uLm9mIHRvIGEgWm9uZS5qcyBzdXBwb3J0ZWQgZm9ybS4gSG93ZXZlciwgZXNidWlsZFxuICAgICAgLy8gZG9lcyBub3QgY3VycmVudGx5IHN1cHBvcnQgZG93bmxldmVsaW5nIGFzeW5jIGdlbmVyYXRvcnMuIEluc3RlYWQgYmFiZWwgaXMgdXNlZCB3aXRoaW4gdGhlIEpTL1RTXG4gICAgICAvLyBsb2FkZXIgdG8gcGVyZm9ybSB0aGUgZG93bmxldmVsIHRyYW5zZm9ybWF0aW9uLlxuICAgICAgLy8gTk9URTogSWYgZXNidWlsZCBhZGRzIHN1cHBvcnQgaW4gdGhlIGZ1dHVyZSwgdGhlIGJhYmVsIHN1cHBvcnQgZm9yIGFzeW5jIGdlbmVyYXRvcnMgY2FuIGJlIGRpc2FibGVkLlxuICAgICAgJ2FzeW5jLWF3YWl0JzogZmFsc2UsXG4gICAgICAvLyBWOCBjdXJyZW50bHkgaGFzIGEgcGVyZm9ybWFuY2UgZGVmZWN0IGludm9sdmluZyBvYmplY3Qgc3ByZWFkIG9wZXJhdGlvbnMgdGhhdCBjYW4gY2F1c2Ugc2lnbmZpY2FudFxuICAgICAgLy8gZGVncmFkYXRpb24gaW4gcnVudGltZSBwZXJmb3JtYW5jZS4gQnkgbm90IHN1cHBvcnRpbmcgdGhlIGxhbmd1YWdlIGZlYXR1cmUgaGVyZSwgYSBkb3dubGV2ZWwgZm9ybVxuICAgICAgLy8gd2lsbCBiZSB1c2VkIGluc3RlYWQgd2hpY2ggcHJvdmlkZXMgYSB3b3JrYXJvdW5kIGZvciB0aGUgcGVyZm9ybWFuY2UgaXNzdWUuXG4gICAgICAvLyBGb3IgbW9yZSBkZXRhaWxzOiBodHRwczovL2J1Z3MuY2hyb21pdW0ub3JnL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0xMTUzNlxuICAgICAgJ29iamVjdC1yZXN0LXNwcmVhZCc6IGZhbHNlLFxuICAgIH0sXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgIGNvbmRpdGlvbnM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdtb2R1bGUnXSxcbiAgICByZXNvbHZlRXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgIGxvZ0xldmVsOiBvcHRpb25zLnZlcmJvc2UgPyAnZGVidWcnIDogJ3NpbGVudCcsXG4gICAgbWluaWZ5OiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgcHVyZTogWydmb3J3YXJkUmVmJ10sXG4gICAgb3V0ZGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIHNvdXJjZW1hcDogc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICBzcGxpdHRpbmc6IHRydWUsXG4gICAgdHNjb25maWcsXG4gICAgZXh0ZXJuYWw6IGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gICAgICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICAgICAge1xuICAgICAgICAgIHNvdXJjZW1hcDogISFzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMsXG4gICAgICAgICAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM6IHNvdXJjZW1hcE9wdGlvbnMudmVuZG9yLFxuICAgICAgICAgIHRzY29uZmlnLFxuICAgICAgICAgIGFkdmFuY2VkT3B0aW1pemF0aW9ucyxcbiAgICAgICAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgICAgICAgIHNvdXJjZUZpbGVDYWNoZSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gQ29tcG9uZW50IHN0eWxlc2hlZXQgb3B0aW9uc1xuICAgICAgICB7XG4gICAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICBvcHRpbWl6YXRpb246ICEhb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMubWluaWZ5LFxuICAgICAgICAgIHNvdXJjZW1hcDpcbiAgICAgICAgICAgIC8vIEhpZGRlbiBjb21wb25lbnQgc3R5bGVzaGVldCBzb3VyY2VtYXBzIGFyZSBpbmFjY2Vzc2libGUgd2hpY2ggaXMgZWZmZWN0aXZlbHlcbiAgICAgICAgICAgIC8vIHRoZSBzYW1lIGFzIGJlaW5nIGRpc2FibGVkLiBEaXNhYmxpbmcgaGFzIHRoZSBhZHZhbnRhZ2Ugb2YgYXZvaWRpbmcgdGhlIG92ZXJoZWFkXG4gICAgICAgICAgICAvLyBvZiBzb3VyY2VtYXAgcHJvY2Vzc2luZy5cbiAgICAgICAgICAgICEhc291cmNlbWFwT3B0aW9ucy5zdHlsZXMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gZmFsc2UgOiAnaW5saW5lJyksXG4gICAgICAgICAgb3V0cHV0TmFtZXMsXG4gICAgICAgICAgaW5jbHVkZVBhdGhzOiBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocyxcbiAgICAgICAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgIH0sXG4gICAgICApLFxuICAgIF0sXG4gICAgZGVmaW5lOiB7XG4gICAgICAuLi4ob3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzID8geyAnbmdEZXZNb2RlJzogJ2ZhbHNlJyB9IDogdW5kZWZpbmVkKSxcbiAgICAgICduZ0ppdE1vZGUnOiAnZmFsc2UnLFxuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUdsb2JhbFN0eWxlc0J1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyxcbiAgdGFyZ2V0OiBzdHJpbmdbXSxcbik6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHtcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBnbG9iYWxTdHlsZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgd2F0Y2gsXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IGJ1aWxkT3B0aW9ucyA9IGNyZWF0ZVN0eWxlc2hlZXRCdW5kbGVPcHRpb25zKHtcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG9wdGltaXphdGlvbjogISFvcHRpbWl6YXRpb25PcHRpb25zLnN0eWxlcy5taW5pZnksXG4gICAgc291cmNlbWFwOiAhIXNvdXJjZW1hcE9wdGlvbnMuc3R5bGVzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgdGFyZ2V0LFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIGluY2x1ZGVQYXRoczogc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zPy5pbmNsdWRlUGF0aHMsXG4gIH0pO1xuICBidWlsZE9wdGlvbnMuaW5jcmVtZW50YWwgPSB3YXRjaDtcblxuICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpzdHlsZXMvZ2xvYmFsJztcbiAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0ge307XG4gIGZvciAoY29uc3QgeyBuYW1lIH0gb2YgZ2xvYmFsU3R5bGVzKSB7XG4gICAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzW25hbWVdID0gYCR7bmFtZXNwYWNlfTske25hbWV9YDtcbiAgfVxuXG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnVuc2hpZnQoe1xuICAgIG5hbWU6ICdhbmd1bGFyLWdsb2JhbC1zdHlsZXMnLFxuICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IC9eYW5ndWxhcjpzdHlsZXNcXC9nbG9iYWw7LyB9LCAoYXJncykgPT4ge1xuICAgICAgICBpZiAoYXJncy5raW5kICE9PSAnZW50cnktcG9pbnQnKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHBhdGg6IGFyZ3MucGF0aC5zcGxpdCgnOycsIDIpWzFdLFxuICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZSB9LCAoYXJncykgPT4ge1xuICAgICAgICBjb25zdCBmaWxlcyA9IGdsb2JhbFN0eWxlcy5maW5kKCh7IG5hbWUgfSkgPT4gbmFtZSA9PT0gYXJncy5wYXRoKT8uZmlsZXM7XG4gICAgICAgIGFzc2VydChmaWxlcywgYGdsb2JhbCBzdHlsZSBuYW1lIHNob3VsZCBhbHdheXMgYmUgZm91bmQgWyR7YXJncy5wYXRofV1gKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbnRlbnRzOiBmaWxlcy5tYXAoKGZpbGUpID0+IGBAaW1wb3J0ICcke2ZpbGUucmVwbGFjZSgvXFxcXC9nLCAnLycpfSc7YCkuam9pbignXFxuJyksXG4gICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cblxuLyoqXG4gKiBNYWluIGV4ZWN1dGlvbiBmdW5jdGlvbiBmb3IgdGhlIGVzYnVpbGQtYmFzZWQgYXBwbGljYXRpb24gYnVpbGRlci5cbiAqIFRoZSBvcHRpb25zIGFyZSBjb21wYXRpYmxlIHdpdGggdGhlIFdlYnBhY2stYmFzZWQgYnVpbGRlci5cbiAqIEBwYXJhbSBpbml0aWFsT3B0aW9ucyBUaGUgYnJvd3NlciBidWlsZGVyIG9wdGlvbnMgdG8gdXNlIHdoZW4gc2V0dGluZyB1cCB0aGUgYXBwbGljYXRpb24gYnVpbGRcbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBBcmNoaXRlY3QgYnVpbGRlciBjb250ZXh0IG9iamVjdFxuICogQHJldHVybnMgQW4gYXN5bmMgaXRlcmFibGUgd2l0aCB0aGUgYnVpbGRlciByZXN1bHQgb3V0cHV0XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogYnVpbGRFc2J1aWxkQnJvd3NlcihcbiAgaW5pdGlhbE9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBBc3luY0l0ZXJhYmxlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gT25seSBBT1QgaXMgY3VycmVudGx5IHN1cHBvcnRlZFxuICBpZiAoaW5pdGlhbE9wdGlvbnMuYW90ICE9PSB0cnVlKSB7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoXG4gICAgICAnSklUIG1vZGUgaXMgY3VycmVudGx5IG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBleHBlcmltZW50YWwgYnVpbGRlci4gQU9UIG1vZGUgbXVzdCBiZSB1c2VkLicsXG4gICAgKTtcblxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gIH1cblxuICAvLyBJbmZvcm0gdXNlciBvZiBleHBlcmltZW50YWwgc3RhdHVzIG9mIGJ1aWxkZXIgYW5kIG9wdGlvbnNcbiAgbG9nRXhwZXJpbWVudGFsV2FybmluZ3MoaW5pdGlhbE9wdGlvbnMsIGNvbnRleHQpO1xuXG4gIC8vIERldGVybWluZSBwcm9qZWN0IG5hbWUgZnJvbSBidWlsZGVyIGNvbnRleHQgdGFyZ2V0XG4gIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQ/LnByb2plY3Q7XG4gIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihgVGhlICdicm93c2VyLWVzYnVpbGQnIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQgdG8gYmUgc3BlY2lmaWVkLmApO1xuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgfVxuXG4gIGNvbnN0IG5vcm1hbGl6ZWRPcHRpb25zID0gYXdhaXQgbm9ybWFsaXplT3B0aW9ucyhjb250ZXh0LCBwcm9qZWN0TmFtZSwgaW5pdGlhbE9wdGlvbnMpO1xuXG4gIC8vIENsZWFuIG91dHB1dCBwYXRoIGlmIGVuYWJsZWRcbiAgaWYgKGluaXRpYWxPcHRpb25zLmRlbGV0ZU91dHB1dFBhdGgpIHtcbiAgICBkZWxldGVPdXRwdXREaXIobm9ybWFsaXplZE9wdGlvbnMud29ya3NwYWNlUm9vdCwgaW5pdGlhbE9wdGlvbnMub3V0cHV0UGF0aCk7XG4gIH1cblxuICAvLyBDcmVhdGUgb3V0cHV0IGRpcmVjdG9yeSBpZiBuZWVkZWRcbiAgdHJ5IHtcbiAgICBhd2FpdCBmcy5ta2Rpcihub3JtYWxpemVkT3B0aW9ucy5vdXRwdXRQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGFzc2VydElzRXJyb3IoZSk7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoJ1VuYWJsZSB0byBjcmVhdGUgb3V0cHV0IGRpcmVjdG9yeTogJyArIGUubWVzc2FnZSk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICB9XG5cbiAgLy8gSW5pdGlhbCBidWlsZFxuICBsZXQgcmVzdWx0ID0gYXdhaXQgZXhlY3V0ZShub3JtYWxpemVkT3B0aW9ucywgY29udGV4dCk7XG4gIHlpZWxkIHJlc3VsdC5vdXRwdXQ7XG5cbiAgLy8gRmluaXNoIGlmIHdhdGNoIG1vZGUgaXMgbm90IGVuYWJsZWRcbiAgaWYgKCFpbml0aWFsT3B0aW9ucy53YXRjaCkge1xuICAgIHNodXRkb3duU2Fzc1dvcmtlclBvb2woKTtcblxuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnRleHQubG9nZ2VyLmluZm8oJ1dhdGNoIG1vZGUgZW5hYmxlZC4gV2F0Y2hpbmcgZm9yIGZpbGUgY2hhbmdlcy4uLicpO1xuXG4gIC8vIFNldHVwIGEgd2F0Y2hlclxuICBjb25zdCB3YXRjaGVyID0gY3JlYXRlV2F0Y2hlcih7XG4gICAgcG9sbGluZzogdHlwZW9mIGluaXRpYWxPcHRpb25zLnBvbGwgPT09ICdudW1iZXInLFxuICAgIGludGVydmFsOiBpbml0aWFsT3B0aW9ucy5wb2xsLFxuICAgIC8vIElnbm9yZSB0aGUgb3V0cHV0IGFuZCBjYWNoZSBwYXRocyB0byBhdm9pZCBpbmZpbml0ZSByZWJ1aWxkIGN5Y2xlc1xuICAgIGlnbm9yZWQ6IFtub3JtYWxpemVkT3B0aW9ucy5vdXRwdXRQYXRoLCBub3JtYWxpemVkT3B0aW9ucy5jYWNoZU9wdGlvbnMuYmFzZVBhdGhdLFxuICB9KTtcblxuICAvLyBUZW1wb3JhcmlseSB3YXRjaCB0aGUgZW50aXJlIHByb2plY3RcbiAgd2F0Y2hlci5hZGQobm9ybWFsaXplZE9wdGlvbnMucHJvamVjdFJvb3QpO1xuXG4gIC8vIFdhdGNoIHdvcmtzcGFjZSByb290IG5vZGUgbW9kdWxlc1xuICAvLyBJbmNsdWRlcyBZYXJuIFBuUCBtYW5pZmVzdCBmaWxlcyAoaHR0cHM6Ly95YXJucGtnLmNvbS9hZHZhbmNlZC9wbnAtc3BlYy8pXG4gIHdhdGNoZXIuYWRkKHBhdGguam9pbihub3JtYWxpemVkT3B0aW9ucy53b3Jrc3BhY2VSb290LCAnbm9kZV9tb2R1bGVzJykpO1xuICB3YXRjaGVyLmFkZChwYXRoLmpvaW4obm9ybWFsaXplZE9wdGlvbnMud29ya3NwYWNlUm9vdCwgJy5wbnAuY2pzJykpO1xuICB3YXRjaGVyLmFkZChwYXRoLmpvaW4obm9ybWFsaXplZE9wdGlvbnMud29ya3NwYWNlUm9vdCwgJy5wbnAuZGF0YS5qc29uJykpO1xuXG4gIC8vIFdhaXQgZm9yIGNoYW5nZXMgYW5kIHJlYnVpbGQgYXMgbmVlZGVkXG4gIHRyeSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaGFuZ2VzIG9mIHdhdGNoZXIpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oJ0NoYW5nZXMgZGV0ZWN0ZWQuIFJlYnVpbGRpbmcuLi4nKTtcblxuICAgICAgaWYgKGluaXRpYWxPcHRpb25zLnZlcmJvc2UpIHtcbiAgICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhjaGFuZ2VzLnRvRGVidWdTdHJpbmcoKSk7XG4gICAgICB9XG5cbiAgICAgIHJlc3VsdCA9IGF3YWl0IGV4ZWN1dGUobm9ybWFsaXplZE9wdGlvbnMsIGNvbnRleHQsIHJlc3VsdC5jcmVhdGVSZWJ1aWxkU3RhdGUoY2hhbmdlcykpO1xuICAgICAgeWllbGQgcmVzdWx0Lm91dHB1dDtcbiAgICB9XG4gIH0gZmluYWxseSB7XG4gICAgLy8gU3RvcCB0aGUgd2F0Y2hlclxuICAgIGF3YWl0IHdhdGNoZXIuY2xvc2UoKTtcbiAgICAvLyBDbGVhbnVwIGluY3JlbWVudGFsIHJlYnVpbGQgc3RhdGVcbiAgICByZXN1bHQuZGlzcG9zZSgpO1xuICAgIHNodXRkb3duU2Fzc1dvcmtlclBvb2woKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyKGJ1aWxkRXNidWlsZEJyb3dzZXIpO1xuIl19