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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEsbuildBrowser = void 0;
const architect_1 = require("@angular-devkit/architect");
const assert = __importStar(require("assert"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
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
    constructor(success, codeRebuild, codeBundleCache) {
        this.success = success;
        this.codeRebuild = codeRebuild;
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
        (0, esbuild_1.bundle)((_b = rebuildState === null || rebuildState === void 0 ? void 0 : rebuildState.codeRebuild) !== null && _b !== void 0 ? _b : createCodeBundleOptions(options, target, codeBundleCache)),
        // Execute esbuild to bundle the global stylesheets
        bundleGlobalStylesheets(options, target),
    ]);
    // Log all warnings and errors generated during bundling
    await (0, esbuild_1.logMessages)(context, {
        errors: [...codeResults.errors, ...styleResults.errors],
        warnings: [...codeResults.warnings, ...styleResults.warnings],
    });
    // Return if the bundling failed to generate output files or there are errors
    if (!codeResults.outputFiles || codeResults.errors.length) {
        return new ExecutionResult(false, rebuildState === null || rebuildState === void 0 ? void 0 : rebuildState.codeRebuild, codeBundleCache);
    }
    // Structure the code bundling output files
    const initialFiles = [];
    const outputFiles = [];
    for (const outputFile of codeResults.outputFiles) {
        // Entries in the metafile are relative to the `absWorkingDir` option which is set to the workspaceRoot
        const relativeFilePath = path.relative(workspaceRoot, outputFile.path);
        const entryPoint = (_d = (_c = codeResults.metafile) === null || _c === void 0 ? void 0 : _c.outputs[relativeFilePath]) === null || _d === void 0 ? void 0 : _d.entryPoint;
        outputFile.path = relativeFilePath;
        if (entryPoint) {
            // An entryPoint value indicates an initial file
            initialFiles.push({
                file: outputFile.path,
                // The first part of the filename is the name of file (e.g., "polyfills" for "polyfills.7S5G3MDY.js")
                name: path.basename(outputFile.path).split('.')[0],
                extension: path.extname(outputFile.path),
            });
        }
        outputFiles.push(outputFile);
    }
    // Add global stylesheets output files
    outputFiles.push(...styleResults.outputFiles);
    initialFiles.push(...styleResults.initialFiles);
    // Return if the global stylesheet bundling has errors
    if (styleResults.errors.length) {
        return new ExecutionResult(false, codeResults.rebuild, codeBundleCache);
    }
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
            return new ExecutionResult(false, codeResults.rebuild, codeBundleCache);
        }
    }
    const buildTime = Number(process.hrtime.bigint() - startTime) / 10 ** 9;
    context.logger.info(`Complete. [${buildTime.toFixed(3)} seconds]`);
    return new ExecutionResult(true, codeResults.rebuild, codeBundleCache);
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
        metafile: true,
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
async function bundleGlobalStylesheets(options, target) {
    const { workspaceRoot, optimizationOptions, sourcemapOptions, outputNames, globalStyles, preserveSymlinks, externalDependencies, stylePreprocessorOptions, } = options;
    const outputFiles = [];
    const initialFiles = [];
    const errors = [];
    const warnings = [];
    for (const { name, files, initial } of globalStyles) {
        const virtualEntryData = files
            .map((file) => `@import '${file.replace(/\\/g, '/')}';`)
            .join('\n');
        const sheetResult = await (0, stylesheets_1.bundleStylesheetText)(virtualEntryData, { virtualName: `angular:style/global;${name}`, resolvePath: workspaceRoot }, {
            workspaceRoot,
            optimization: !!optimizationOptions.styles.minify,
            sourcemap: !!sourcemapOptions.styles && (sourcemapOptions.hidden ? 'external' : true),
            outputNames: initial ? outputNames : { media: outputNames.media },
            includePaths: stylePreprocessorOptions === null || stylePreprocessorOptions === void 0 ? void 0 : stylePreprocessorOptions.includePaths,
            preserveSymlinks,
            externalDependencies,
            target,
        });
        errors.push(...sheetResult.errors);
        warnings.push(...sheetResult.warnings);
        if (!sheetResult.path) {
            // Failed to process the stylesheet
            assert.ok(sheetResult.errors.length, `Global stylesheet processing for '${name}' failed with no errors.`);
            continue;
        }
        // The virtual stylesheets will be named `stdin` by esbuild. This must be replaced
        // with the actual name of the global style and the leading directory separator must
        // also be removed to make the path relative.
        const sheetPath = sheetResult.path.replace('stdin', name);
        let sheetContents = sheetResult.contents;
        if (sheetResult.map) {
            outputFiles.push(createOutputFileFromText(sheetPath + '.map', sheetResult.map));
            sheetContents = sheetContents.replace('sourceMappingURL=stdin.css.map', `sourceMappingURL=${name}.css.map`);
        }
        outputFiles.push(createOutputFileFromText(sheetPath, sheetContents));
        if (initial) {
            initialFiles.push({
                file: sheetPath,
                name,
                extension: '.css',
            });
        }
        outputFiles.push(...sheetResult.resourceFiles);
    }
    return { outputFiles, initialFiles, errors, warnings };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsK0NBQWlDO0FBRWpDLGdEQUFrQztBQUNsQywyQ0FBNkI7QUFDN0IsdUNBQThDO0FBQzlDLHlEQUFxRDtBQUNyRCw2Q0FBa0Q7QUFDbEQsaUVBQWtGO0FBRWxGLHNGQUFpRjtBQUNqRiwrREFBZ0Y7QUFDaEYsdUVBQXNFO0FBQ3RFLHVEQUEwRTtBQUMxRSx1Q0FBZ0Q7QUFDaEQsbUVBQWtFO0FBQ2xFLHVDQUF1RTtBQUN2RSwrQ0FBdUQ7QUFFdkQsK0NBQXFEO0FBQ3JELHVDQUF3RDtBQVF4RDs7R0FFRztBQUNILE1BQU0sZUFBZTtJQUNuQixZQUNVLE9BQWdCLEVBQ2hCLFdBQTZCLEVBQzdCLGVBQWlDO1FBRmpDLFlBQU8sR0FBUCxPQUFPLENBQVM7UUFDaEIsZ0JBQVcsR0FBWCxXQUFXLENBQWtCO1FBQzdCLG9CQUFlLEdBQWYsZUFBZSxDQUFrQjtJQUN4QyxDQUFDO0lBRUosSUFBSSxNQUFNO1FBQ1IsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTztTQUN0QixDQUFDO0lBQ0osQ0FBQztJQUVELGtCQUFrQixDQUFDLFdBQXlCOztRQUMxQyxNQUFBLElBQUksQ0FBQyxlQUFlLDBDQUFFLFVBQVUsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDLFFBQVEsRUFBRSxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBRXBGLE9BQU87WUFDTCxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7WUFDN0IsZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFl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SUFDcEUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGFBQWEsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7SUFFMUUseUNBQXlDO0lBQ3pDLElBQUk7UUFDRixJQUFJLEtBQUssRUFBRSxNQUFNLE9BQU8sSUFBSSxPQUFPLEVBQUU7WUFDbkMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUNBQWlDLENBQUMsQ0FBQztZQUV2RCxJQUFJLGNBQWMsQ0FBQyxPQUFPLEVBQUU7Z0JBQzFCLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDO2FBQzlDO1lBRUQsTUFBTSxHQUFHLE1BQU0sT0FBTyxDQUFDLGlCQUFpQixFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN2RixNQUFNLE1BQU0sQ0FBQyxNQUFNLENBQUM7U0FDckI7S0FDRjtZQUFTO1FBQ1IsbUJBQW1CO1FBQ25CLE1BQU0sT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ3RCLG9DQUFvQztRQUNwQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDakIsSUFBQSxvQ0FBc0IsR0FBRSxDQUFDO0tBQzFCO0FBQ0gsQ0FBQztBQTFGRCxrREEwRkM7QUFFRCxrQkFBZSxJQUFBLHlCQUFhLEVBQUMsbUJBQW1CLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0ICogYXMgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgdHlwZSB7IEJ1aWxkSW52YWxpZGF0ZSwgQnVpbGRPcHRpb25zLCBNZXNzYWdlLCBPdXRwdXRGaWxlIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgZGVsZXRlT3V0cHV0RGlyIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgY29weUFzc2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvcHktYXNzZXRzJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2VzYnVpbGQtdGFyZ2V0cyc7XG5pbXBvcnQgeyBGaWxlSW5mbyB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvYXVnbWVudC1pbmRleC1odG1sJztcbmltcG9ydCB7IEluZGV4SHRtbEdlbmVyYXRvciB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyRXNidWlsZCB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IGdldFN1cHBvcnRlZEJyb3dzZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3VwcG9ydGVkLWJyb3dzZXJzJztcbmltcG9ydCB7IFNvdXJjZUZpbGVDYWNoZSwgY3JlYXRlQ29tcGlsZXJQbHVnaW4gfSBmcm9tICcuL2NvbXBpbGVyLXBsdWdpbic7XG5pbXBvcnQgeyBidW5kbGUsIGxvZ01lc3NhZ2VzIH0gZnJvbSAnLi9lc2J1aWxkJztcbmltcG9ydCB7IGxvZ0V4cGVyaW1lbnRhbFdhcm5pbmdzIH0gZnJvbSAnLi9leHBlcmltZW50YWwtd2FybmluZ3MnO1xuaW1wb3J0IHsgTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zLCBub3JtYWxpemVPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB7IHNodXRkb3duU2Fzc1dvcmtlclBvb2wgfSBmcm9tICcuL3Nhc3MtcGx1Z2luJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQgeyBidW5kbGVTdHlsZXNoZWV0VGV4dCB9IGZyb20gJy4vc3R5bGVzaGVldHMnO1xuaW1wb3J0IHsgQ2hhbmdlZEZpbGVzLCBjcmVhdGVXYXRjaGVyIH0gZnJvbSAnLi93YXRjaGVyJztcblxuaW50ZXJmYWNlIFJlYnVpbGRTdGF0ZSB7XG4gIGNvZGVSZWJ1aWxkPzogQnVpbGRJbnZhbGlkYXRlO1xuICBjb2RlQnVuZGxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGU7XG4gIGZpbGVDaGFuZ2VzOiBDaGFuZ2VkRmlsZXM7XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyB0aGUgcmVzdWx0IG9mIGEgc2luZ2xlIGJ1aWxkZXIgZXhlY3V0ZSBjYWxsLlxuICovXG5jbGFzcyBFeGVjdXRpb25SZXN1bHQge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHN1Y2Nlc3M6IGJvb2xlYW4sXG4gICAgcHJpdmF0ZSBjb2RlUmVidWlsZD86IEJ1aWxkSW52YWxpZGF0ZSxcbiAgICBwcml2YXRlIGNvZGVCdW5kbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZSxcbiAgKSB7fVxuXG4gIGdldCBvdXRwdXQoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRoaXMuc3VjY2VzcyxcbiAgICB9O1xuICB9XG5cbiAgY3JlYXRlUmVidWlsZFN0YXRlKGZpbGVDaGFuZ2VzOiBDaGFuZ2VkRmlsZXMpOiBSZWJ1aWxkU3RhdGUge1xuICAgIHRoaXMuY29kZUJ1bmRsZUNhY2hlPy5pbnZhbGlkYXRlKFsuLi5maWxlQ2hhbmdlcy5tb2RpZmllZCwgLi4uZmlsZUNoYW5nZXMucmVtb3ZlZF0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvZGVSZWJ1aWxkOiB0aGlzLmNvZGVSZWJ1aWxkLFxuICAgICAgY29kZUJ1bmRsZUNhY2hlOiB0aGlzLmNvZGVCdW5kbGVDYWNoZSxcbiAgICAgIGZpbGVDaGFuZ2VzLFxuICAgIH07XG4gIH1cblxuICBkaXNwb3NlKCk6IHZvaWQge1xuICAgIHRoaXMuY29kZVJlYnVpbGQ/LmRpc3Bvc2UoKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBleGVjdXRlKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICByZWJ1aWxkU3RhdGU/OiBSZWJ1aWxkU3RhdGUsXG4pOiBQcm9taXNlPEV4ZWN1dGlvblJlc3VsdD4ge1xuICBjb25zdCBzdGFydFRpbWUgPSBwcm9jZXNzLmhydGltZS5iaWdpbnQoKTtcblxuICBjb25zdCB7XG4gICAgcHJvamVjdFJvb3QsXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIG91dHB1dFBhdGgsXG4gICAgYXNzZXRzLFxuICAgIHNlcnZpY2VXb3JrZXJPcHRpb25zLFxuICAgIGluZGV4SHRtbE9wdGlvbnMsXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IHRhcmdldCA9IHRyYW5zZm9ybVN1cHBvcnRlZEJyb3dzZXJzVG9UYXJnZXRzKFxuICAgIGdldFN1cHBvcnRlZEJyb3dzZXJzKHByb2plY3RSb290LCBjb250ZXh0LmxvZ2dlciksXG4gICk7XG5cbiAgY29uc3QgY29kZUJ1bmRsZUNhY2hlID0gb3B0aW9ucy53YXRjaFxuICAgID8gcmVidWlsZFN0YXRlPy5jb2RlQnVuZGxlQ2FjaGUgPz8gbmV3IFNvdXJjZUZpbGVDYWNoZSgpXG4gICAgOiB1bmRlZmluZWQ7XG5cbiAgY29uc3QgW2NvZGVSZXN1bHRzLCBzdHlsZVJlc3VsdHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIC8vIEV4ZWN1dGUgZXNidWlsZCB0byBidW5kbGUgdGhlIGFwcGxpY2F0aW9uIGNvZGVcbiAgICBidW5kbGUocmVidWlsZFN0YXRlPy5jb2RlUmVidWlsZCA/PyBjcmVhdGVDb2RlQnVuZGxlT3B0aW9ucyhvcHRpb25zLCB0YXJnZXQsIGNvZGVCdW5kbGVDYWNoZSkpLFxuICAgIC8vIEV4ZWN1dGUgZXNidWlsZCB0byBidW5kbGUgdGhlIGdsb2JhbCBzdHlsZXNoZWV0c1xuICAgIGJ1bmRsZUdsb2JhbFN0eWxlc2hlZXRzKG9wdGlvbnMsIHRhcmdldCksXG4gIF0pO1xuXG4gIC8vIExvZyBhbGwgd2FybmluZ3MgYW5kIGVycm9ycyBnZW5lcmF0ZWQgZHVyaW5nIGJ1bmRsaW5nXG4gIGF3YWl0IGxvZ01lc3NhZ2VzKGNvbnRleHQsIHtcbiAgICBlcnJvcnM6IFsuLi5jb2RlUmVzdWx0cy5lcnJvcnMsIC4uLnN0eWxlUmVzdWx0cy5lcnJvcnNdLFxuICAgIHdhcm5pbmdzOiBbLi4uY29kZVJlc3VsdHMud2FybmluZ3MsIC4uLnN0eWxlUmVzdWx0cy53YXJuaW5nc10sXG4gIH0pO1xuXG4gIC8vIFJldHVybiBpZiB0aGUgYnVuZGxpbmcgZmFpbGVkIHRvIGdlbmVyYXRlIG91dHB1dCBmaWxlcyBvciB0aGVyZSBhcmUgZXJyb3JzXG4gIGlmICghY29kZVJlc3VsdHMub3V0cHV0RmlsZXMgfHwgY29kZVJlc3VsdHMuZXJyb3JzLmxlbmd0aCkge1xuICAgIHJldHVybiBuZXcgRXhlY3V0aW9uUmVzdWx0KGZhbHNlLCByZWJ1aWxkU3RhdGU/LmNvZGVSZWJ1aWxkLCBjb2RlQnVuZGxlQ2FjaGUpO1xuICB9XG5cbiAgLy8gU3RydWN0dXJlIHRoZSBjb2RlIGJ1bmRsaW5nIG91dHB1dCBmaWxlc1xuICBjb25zdCBpbml0aWFsRmlsZXM6IEZpbGVJbmZvW10gPSBbXTtcbiAgY29uc3Qgb3V0cHV0RmlsZXM6IE91dHB1dEZpbGVbXSA9IFtdO1xuICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2YgY29kZVJlc3VsdHMub3V0cHV0RmlsZXMpIHtcbiAgICAvLyBFbnRyaWVzIGluIHRoZSBtZXRhZmlsZSBhcmUgcmVsYXRpdmUgdG8gdGhlIGBhYnNXb3JraW5nRGlyYCBvcHRpb24gd2hpY2ggaXMgc2V0IHRvIHRoZSB3b3Jrc3BhY2VSb290XG4gICAgY29uc3QgcmVsYXRpdmVGaWxlUGF0aCA9IHBhdGgucmVsYXRpdmUod29ya3NwYWNlUm9vdCwgb3V0cHV0RmlsZS5wYXRoKTtcbiAgICBjb25zdCBlbnRyeVBvaW50ID0gY29kZVJlc3VsdHMubWV0YWZpbGU/Lm91dHB1dHNbcmVsYXRpdmVGaWxlUGF0aF0/LmVudHJ5UG9pbnQ7XG5cbiAgICBvdXRwdXRGaWxlLnBhdGggPSByZWxhdGl2ZUZpbGVQYXRoO1xuXG4gICAgaWYgKGVudHJ5UG9pbnQpIHtcbiAgICAgIC8vIEFuIGVudHJ5UG9pbnQgdmFsdWUgaW5kaWNhdGVzIGFuIGluaXRpYWwgZmlsZVxuICAgICAgaW5pdGlhbEZpbGVzLnB1c2goe1xuICAgICAgICBmaWxlOiBvdXRwdXRGaWxlLnBhdGgsXG4gICAgICAgIC8vIFRoZSBmaXJzdCBwYXJ0IG9mIHRoZSBmaWxlbmFtZSBpcyB0aGUgbmFtZSBvZiBmaWxlIChlLmcuLCBcInBvbHlmaWxsc1wiIGZvciBcInBvbHlmaWxscy43UzVHM01EWS5qc1wiKVxuICAgICAgICBuYW1lOiBwYXRoLmJhc2VuYW1lKG91dHB1dEZpbGUucGF0aCkuc3BsaXQoJy4nKVswXSxcbiAgICAgICAgZXh0ZW5zaW9uOiBwYXRoLmV4dG5hbWUob3V0cHV0RmlsZS5wYXRoKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBvdXRwdXRGaWxlcy5wdXNoKG91dHB1dEZpbGUpO1xuICB9XG5cbiAgLy8gQWRkIGdsb2JhbCBzdHlsZXNoZWV0cyBvdXRwdXQgZmlsZXNcbiAgb3V0cHV0RmlsZXMucHVzaCguLi5zdHlsZVJlc3VsdHMub3V0cHV0RmlsZXMpO1xuICBpbml0aWFsRmlsZXMucHVzaCguLi5zdHlsZVJlc3VsdHMuaW5pdGlhbEZpbGVzKTtcblxuICAvLyBSZXR1cm4gaWYgdGhlIGdsb2JhbCBzdHlsZXNoZWV0IGJ1bmRsaW5nIGhhcyBlcnJvcnNcbiAgaWYgKHN0eWxlUmVzdWx0cy5lcnJvcnMubGVuZ3RoKSB7XG4gICAgcmV0dXJuIG5ldyBFeGVjdXRpb25SZXN1bHQoZmFsc2UsIGNvZGVSZXN1bHRzLnJlYnVpbGQsIGNvZGVCdW5kbGVDYWNoZSk7XG4gIH1cblxuICAvLyBHZW5lcmF0ZSBpbmRleCBIVE1MIGZpbGVcbiAgaWYgKGluZGV4SHRtbE9wdGlvbnMpIHtcbiAgICAvLyBDcmVhdGUgYW4gaW5kZXggSFRNTCBnZW5lcmF0b3IgdGhhdCByZWFkcyBmcm9tIHRoZSBpbi1tZW1vcnkgb3V0cHV0IGZpbGVzXG4gICAgY29uc3QgaW5kZXhIdG1sR2VuZXJhdG9yID0gbmV3IEluZGV4SHRtbEdlbmVyYXRvcih7XG4gICAgICBpbmRleFBhdGg6IGluZGV4SHRtbE9wdGlvbnMuaW5wdXQsXG4gICAgICBlbnRyeXBvaW50czogaW5kZXhIdG1sT3B0aW9ucy5pbnNlcnRpb25PcmRlcixcbiAgICAgIHNyaTogb3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSxcbiAgICAgIG9wdGltaXphdGlvbjogb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICAgIGNyb3NzT3JpZ2luOiBvcHRpb25zLmNyb3NzT3JpZ2luLFxuICAgIH0pO1xuXG4gICAgLyoqIFZpcnR1YWwgb3V0cHV0IHBhdGggdG8gc3VwcG9ydCByZWFkaW5nIGluLW1lbW9yeSBmaWxlcy4gKi9cbiAgICBjb25zdCB2aXJ0dWFsT3V0cHV0UGF0aCA9ICcvJztcbiAgICBpbmRleEh0bWxHZW5lcmF0b3IucmVhZEFzc2V0ID0gYXN5bmMgZnVuY3Rpb24gKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgLy8gUmVtb3ZlIGxlYWRpbmcgZGlyZWN0b3J5IHNlcGFyYXRvclxuICAgICAgY29uc3QgcmVsYXRpdmVmaWxlUGF0aCA9IHBhdGgucmVsYXRpdmUodmlydHVhbE91dHB1dFBhdGgsIGZpbGVQYXRoKTtcbiAgICAgIGNvbnN0IGZpbGUgPSBvdXRwdXRGaWxlcy5maW5kKChmaWxlKSA9PiBmaWxlLnBhdGggPT09IHJlbGF0aXZlZmlsZVBhdGgpO1xuICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgcmV0dXJuIGZpbGUudGV4dDtcbiAgICAgIH1cblxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBPdXRwdXQgZmlsZSBkb2VzIG5vdCBleGlzdDogJHtwYXRofWApO1xuICAgIH07XG5cbiAgICBjb25zdCB7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IGluZGV4SHRtbEdlbmVyYXRvci5wcm9jZXNzKHtcbiAgICAgIGJhc2VIcmVmOiBvcHRpb25zLmJhc2VIcmVmLFxuICAgICAgbGFuZzogdW5kZWZpbmVkLFxuICAgICAgb3V0cHV0UGF0aDogdmlydHVhbE91dHB1dFBhdGgsXG4gICAgICBmaWxlczogaW5pdGlhbEZpbGVzLFxuICAgIH0pO1xuXG4gICAgZm9yIChjb25zdCBlcnJvciBvZiBlcnJvcnMpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB3YXJuaW5nIG9mIHdhcm5pbmdzKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci53YXJuKHdhcm5pbmcpO1xuICAgIH1cblxuICAgIG91dHB1dEZpbGVzLnB1c2goY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KGluZGV4SHRtbE9wdGlvbnMub3V0cHV0LCBjb250ZW50KSk7XG4gIH1cblxuICAvLyBDb3B5IGFzc2V0c1xuICBpZiAoYXNzZXRzKSB7XG4gICAgYXdhaXQgY29weUFzc2V0cyhhc3NldHMsIFtvdXRwdXRQYXRoXSwgd29ya3NwYWNlUm9vdCk7XG4gIH1cblxuICAvLyBXcml0ZSBvdXRwdXQgZmlsZXNcbiAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgb3V0cHV0RmlsZXMubWFwKChmaWxlKSA9PiBmcy53cml0ZUZpbGUocGF0aC5qb2luKG91dHB1dFBhdGgsIGZpbGUucGF0aCksIGZpbGUuY29udGVudHMpKSxcbiAgKTtcblxuICAvLyBBdWdtZW50IHRoZSBhcHBsaWNhdGlvbiB3aXRoIHNlcnZpY2Ugd29ya2VyIHN1cHBvcnRcbiAgLy8gVE9ETzogVGhpcyBzaG91bGQgZXZlbnR1YWxseSBvcGVyYXRlIG9uIHRoZSBpbi1tZW1vcnkgZmlsZXMgcHJpb3IgdG8gd3JpdGluZyB0aGUgb3V0cHV0IGZpbGVzXG4gIGlmIChzZXJ2aWNlV29ya2VyT3B0aW9ucykge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXJFc2J1aWxkKFxuICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICBzZXJ2aWNlV29ya2VyT3B0aW9ucyxcbiAgICAgICAgb3V0cHV0UGF0aCxcbiAgICAgICAgb3B0aW9ucy5iYXNlSHJlZiB8fCAnLycsXG4gICAgICApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGAke2Vycm9yfWApO1xuXG4gICAgICByZXR1cm4gbmV3IEV4ZWN1dGlvblJlc3VsdChmYWxzZSwgY29kZVJlc3VsdHMucmVidWlsZCwgY29kZUJ1bmRsZUNhY2hlKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBidWlsZFRpbWUgPSBOdW1iZXIocHJvY2Vzcy5ocnRpbWUuYmlnaW50KCkgLSBzdGFydFRpbWUpIC8gMTAgKiogOTtcbiAgY29udGV4dC5sb2dnZXIuaW5mbyhgQ29tcGxldGUuIFske2J1aWxkVGltZS50b0ZpeGVkKDMpfSBzZWNvbmRzXWApO1xuXG4gIHJldHVybiBuZXcgRXhlY3V0aW9uUmVzdWx0KHRydWUsIGNvZGVSZXN1bHRzLnJlYnVpbGQsIGNvZGVCdW5kbGVDYWNoZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChwYXRoOiBzdHJpbmcsIHRleHQ6IHN0cmluZyk6IE91dHB1dEZpbGUge1xuICByZXR1cm4ge1xuICAgIHBhdGgsXG4gICAgdGV4dCxcbiAgICBnZXQgY29udGVudHMoKSB7XG4gICAgICByZXR1cm4gQnVmZmVyLmZyb20odGhpcy50ZXh0LCAndXRmLTgnKTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDb2RlQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7XG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucyxcbiAgICBhZHZhbmNlZE9wdGltaXphdGlvbnMsXG4gIH0gPSBvcHRpb25zO1xuXG4gIHJldHVybiB7XG4gICAgYWJzV29ya2luZ0Rpcjogd29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IHRydWUsXG4gICAgaW5jcmVtZW50YWw6IG9wdGlvbnMud2F0Y2gsXG4gICAgZm9ybWF0OiAnZXNtJyxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBlbnRyeU5hbWVzOiBvdXRwdXROYW1lcy5idW5kbGVzLFxuICAgIGFzc2V0TmFtZXM6IG91dHB1dE5hbWVzLm1lZGlhLFxuICAgIHRhcmdldCxcbiAgICBzdXBwb3J0ZWQ6IHtcbiAgICAgIC8vIE5hdGl2ZSBhc3luYy9hd2FpdCBpcyBub3Qgc3VwcG9ydGVkIHdpdGggWm9uZS5qcy4gRGlzYWJsaW5nIHN1cHBvcnQgaGVyZSB3aWxsIGNhdXNlXG4gICAgICAvLyBlc2J1aWxkIHRvIGRvd25sZXZlbCBhc3luYy9hd2FpdCBhbmQgZm9yIGF3YWl0Li4ub2YgdG8gYSBab25lLmpzIHN1cHBvcnRlZCBmb3JtLiBIb3dldmVyLCBlc2J1aWxkXG4gICAgICAvLyBkb2VzIG5vdCBjdXJyZW50bHkgc3VwcG9ydCBkb3dubGV2ZWxpbmcgYXN5bmMgZ2VuZXJhdG9ycy4gSW5zdGVhZCBiYWJlbCBpcyB1c2VkIHdpdGhpbiB0aGUgSlMvVFNcbiAgICAgIC8vIGxvYWRlciB0byBwZXJmb3JtIHRoZSBkb3dubGV2ZWwgdHJhbnNmb3JtYXRpb24uXG4gICAgICAvLyBOT1RFOiBJZiBlc2J1aWxkIGFkZHMgc3VwcG9ydCBpbiB0aGUgZnV0dXJlLCB0aGUgYmFiZWwgc3VwcG9ydCBmb3IgYXN5bmMgZ2VuZXJhdG9ycyBjYW4gYmUgZGlzYWJsZWQuXG4gICAgICAnYXN5bmMtYXdhaXQnOiBmYWxzZSxcbiAgICAgIC8vIFY4IGN1cnJlbnRseSBoYXMgYSBwZXJmb3JtYW5jZSBkZWZlY3QgaW52b2x2aW5nIG9iamVjdCBzcHJlYWQgb3BlcmF0aW9ucyB0aGF0IGNhbiBjYXVzZSBzaWduZmljYW50XG4gICAgICAvLyBkZWdyYWRhdGlvbiBpbiBydW50aW1lIHBlcmZvcm1hbmNlLiBCeSBub3Qgc3VwcG9ydGluZyB0aGUgbGFuZ3VhZ2UgZmVhdHVyZSBoZXJlLCBhIGRvd25sZXZlbCBmb3JtXG4gICAgICAvLyB3aWxsIGJlIHVzZWQgaW5zdGVhZCB3aGljaCBwcm92aWRlcyBhIHdvcmthcm91bmQgZm9yIHRoZSBwZXJmb3JtYW5jZSBpc3N1ZS5cbiAgICAgIC8vIEZvciBtb3JlIGRldGFpbHM6IGh0dHBzOi8vYnVncy5jaHJvbWl1bS5vcmcvcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTExNTM2XG4gICAgICAnb2JqZWN0LXJlc3Qtc3ByZWFkJzogZmFsc2UsXG4gICAgfSxcbiAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgY29uZGl0aW9uczogWydlczIwMjAnLCAnZXMyMDE1JywgJ21vZHVsZSddLFxuICAgIHJlc29sdmVFeHRlbnNpb25zOiBbJy50cycsICcudHN4JywgJy5tanMnLCAnLmpzJ10sXG4gICAgbG9nTGV2ZWw6IG9wdGlvbnMudmVyYm9zZSA/ICdkZWJ1ZycgOiAnc2lsZW50JyxcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBtaW5pZnk6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBwdXJlOiBbJ2ZvcndhcmRSZWYnXSxcbiAgICBvdXRkaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgc291cmNlbWFwOiBzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gJ2V4dGVybmFsJyA6IHRydWUpLFxuICAgIHNwbGl0dGluZzogdHJ1ZSxcbiAgICB0c2NvbmZpZyxcbiAgICBleHRlcm5hbDogZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgICAgICAgLy8gSlMvVFMgb3B0aW9uc1xuICAgICAgICB7XG4gICAgICAgICAgc291cmNlbWFwOiAhIXNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyxcbiAgICAgICAgICB0aGlyZFBhcnR5U291cmNlbWFwczogc291cmNlbWFwT3B0aW9ucy52ZW5kb3IsXG4gICAgICAgICAgdHNjb25maWcsXG4gICAgICAgICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zLFxuICAgICAgICAgIGZpbGVSZXBsYWNlbWVudHMsXG4gICAgICAgICAgc291cmNlRmlsZUNhY2hlLFxuICAgICAgICB9LFxuICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzaGVldCBvcHRpb25zXG4gICAgICAgIHtcbiAgICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgIG9wdGltaXphdGlvbjogISFvcHRpbWl6YXRpb25PcHRpb25zLnN0eWxlcy5taW5pZnksXG4gICAgICAgICAgc291cmNlbWFwOlxuICAgICAgICAgICAgLy8gSGlkZGVuIGNvbXBvbmVudCBzdHlsZXNoZWV0IHNvdXJjZW1hcHMgYXJlIGluYWNjZXNzaWJsZSB3aGljaCBpcyBlZmZlY3RpdmVseVxuICAgICAgICAgICAgLy8gdGhlIHNhbWUgYXMgYmVpbmcgZGlzYWJsZWQuIERpc2FibGluZyBoYXMgdGhlIGFkdmFudGFnZSBvZiBhdm9pZGluZyB0aGUgb3ZlcmhlYWRcbiAgICAgICAgICAgIC8vIG9mIHNvdXJjZW1hcCBwcm9jZXNzaW5nLlxuICAgICAgICAgICAgISFzb3VyY2VtYXBPcHRpb25zLnN0eWxlcyAmJiAoc291cmNlbWFwT3B0aW9ucy5oaWRkZW4gPyBmYWxzZSA6ICdpbmxpbmUnKSxcbiAgICAgICAgICBvdXRwdXROYW1lcyxcbiAgICAgICAgICBpbmNsdWRlUGF0aHM6IHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucz8uaW5jbHVkZVBhdGhzLFxuICAgICAgICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgfSxcbiAgICAgICksXG4gICAgXSxcbiAgICBkZWZpbmU6IHtcbiAgICAgIC4uLihvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgPyB7ICduZ0Rldk1vZGUnOiAnZmFsc2UnIH0gOiB1bmRlZmluZWQpLFxuICAgICAgJ25nSml0TW9kZSc6ICdmYWxzZScsXG4gICAgfSxcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYnVuZGxlR2xvYmFsU3R5bGVzaGVldHMob3B0aW9uczogTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zLCB0YXJnZXQ6IHN0cmluZ1tdKSB7XG4gIGNvbnN0IHtcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBnbG9iYWxTdHlsZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW10gPSBbXTtcbiAgY29uc3QgaW5pdGlhbEZpbGVzOiBGaWxlSW5mb1tdID0gW107XG4gIGNvbnN0IGVycm9yczogTWVzc2FnZVtdID0gW107XG4gIGNvbnN0IHdhcm5pbmdzOiBNZXNzYWdlW10gPSBbXTtcblxuICBmb3IgKGNvbnN0IHsgbmFtZSwgZmlsZXMsIGluaXRpYWwgfSBvZiBnbG9iYWxTdHlsZXMpIHtcbiAgICBjb25zdCB2aXJ0dWFsRW50cnlEYXRhID0gZmlsZXNcbiAgICAgIC5tYXAoKGZpbGUpID0+IGBAaW1wb3J0ICcke2ZpbGUucmVwbGFjZSgvXFxcXC9nLCAnLycpfSc7YClcbiAgICAgIC5qb2luKCdcXG4nKTtcbiAgICBjb25zdCBzaGVldFJlc3VsdCA9IGF3YWl0IGJ1bmRsZVN0eWxlc2hlZXRUZXh0KFxuICAgICAgdmlydHVhbEVudHJ5RGF0YSxcbiAgICAgIHsgdmlydHVhbE5hbWU6IGBhbmd1bGFyOnN0eWxlL2dsb2JhbDske25hbWV9YCwgcmVzb2x2ZVBhdGg6IHdvcmtzcGFjZVJvb3QgfSxcbiAgICAgIHtcbiAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgb3B0aW1pemF0aW9uOiAhIW9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLm1pbmlmeSxcbiAgICAgICAgc291cmNlbWFwOiAhIXNvdXJjZW1hcE9wdGlvbnMuc3R5bGVzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICAgICAgb3V0cHV0TmFtZXM6IGluaXRpYWwgPyBvdXRwdXROYW1lcyA6IHsgbWVkaWE6IG91dHB1dE5hbWVzLm1lZGlhIH0sXG4gICAgICAgIGluY2x1ZGVQYXRoczogc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zPy5pbmNsdWRlUGF0aHMsXG4gICAgICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgICAgICB0YXJnZXQsXG4gICAgICB9LFxuICAgICk7XG5cbiAgICBlcnJvcnMucHVzaCguLi5zaGVldFJlc3VsdC5lcnJvcnMpO1xuICAgIHdhcm5pbmdzLnB1c2goLi4uc2hlZXRSZXN1bHQud2FybmluZ3MpO1xuXG4gICAgaWYgKCFzaGVldFJlc3VsdC5wYXRoKSB7XG4gICAgICAvLyBGYWlsZWQgdG8gcHJvY2VzcyB0aGUgc3R5bGVzaGVldFxuICAgICAgYXNzZXJ0Lm9rKFxuICAgICAgICBzaGVldFJlc3VsdC5lcnJvcnMubGVuZ3RoLFxuICAgICAgICBgR2xvYmFsIHN0eWxlc2hlZXQgcHJvY2Vzc2luZyBmb3IgJyR7bmFtZX0nIGZhaWxlZCB3aXRoIG5vIGVycm9ycy5gLFxuICAgICAgKTtcblxuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gVGhlIHZpcnR1YWwgc3R5bGVzaGVldHMgd2lsbCBiZSBuYW1lZCBgc3RkaW5gIGJ5IGVzYnVpbGQuIFRoaXMgbXVzdCBiZSByZXBsYWNlZFxuICAgIC8vIHdpdGggdGhlIGFjdHVhbCBuYW1lIG9mIHRoZSBnbG9iYWwgc3R5bGUgYW5kIHRoZSBsZWFkaW5nIGRpcmVjdG9yeSBzZXBhcmF0b3IgbXVzdFxuICAgIC8vIGFsc28gYmUgcmVtb3ZlZCB0byBtYWtlIHRoZSBwYXRoIHJlbGF0aXZlLlxuICAgIGNvbnN0IHNoZWV0UGF0aCA9IHNoZWV0UmVzdWx0LnBhdGgucmVwbGFjZSgnc3RkaW4nLCBuYW1lKTtcbiAgICBsZXQgc2hlZXRDb250ZW50cyA9IHNoZWV0UmVzdWx0LmNvbnRlbnRzO1xuICAgIGlmIChzaGVldFJlc3VsdC5tYXApIHtcbiAgICAgIG91dHB1dEZpbGVzLnB1c2goY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHNoZWV0UGF0aCArICcubWFwJywgc2hlZXRSZXN1bHQubWFwKSk7XG4gICAgICBzaGVldENvbnRlbnRzID0gc2hlZXRDb250ZW50cy5yZXBsYWNlKFxuICAgICAgICAnc291cmNlTWFwcGluZ1VSTD1zdGRpbi5jc3MubWFwJyxcbiAgICAgICAgYHNvdXJjZU1hcHBpbmdVUkw9JHtuYW1lfS5jc3MubWFwYCxcbiAgICAgICk7XG4gICAgfVxuICAgIG91dHB1dEZpbGVzLnB1c2goY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHNoZWV0UGF0aCwgc2hlZXRDb250ZW50cykpO1xuXG4gICAgaWYgKGluaXRpYWwpIHtcbiAgICAgIGluaXRpYWxGaWxlcy5wdXNoKHtcbiAgICAgICAgZmlsZTogc2hlZXRQYXRoLFxuICAgICAgICBuYW1lLFxuICAgICAgICBleHRlbnNpb246ICcuY3NzJyxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBvdXRwdXRGaWxlcy5wdXNoKC4uLnNoZWV0UmVzdWx0LnJlc291cmNlRmlsZXMpO1xuICB9XG5cbiAgcmV0dXJuIHsgb3V0cHV0RmlsZXMsIGluaXRpYWxGaWxlcywgZXJyb3JzLCB3YXJuaW5ncyB9O1xufVxuXG4vKipcbiAqIE1haW4gZXhlY3V0aW9uIGZ1bmN0aW9uIGZvciB0aGUgZXNidWlsZC1iYXNlZCBhcHBsaWNhdGlvbiBidWlsZGVyLlxuICogVGhlIG9wdGlvbnMgYXJlIGNvbXBhdGlibGUgd2l0aCB0aGUgV2VicGFjay1iYXNlZCBidWlsZGVyLlxuICogQHBhcmFtIGluaXRpYWxPcHRpb25zIFRoZSBicm93c2VyIGJ1aWxkZXIgb3B0aW9ucyB0byB1c2Ugd2hlbiBzZXR0aW5nIHVwIHRoZSBhcHBsaWNhdGlvbiBidWlsZFxuICogQHBhcmFtIGNvbnRleHQgVGhlIEFyY2hpdGVjdCBidWlsZGVyIGNvbnRleHQgb2JqZWN0XG4gKiBAcmV0dXJucyBBbiBhc3luYyBpdGVyYWJsZSB3aXRoIHRoZSBidWlsZGVyIHJlc3VsdCBvdXRwdXRcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uKiBidWlsZEVzYnVpbGRCcm93c2VyKFxuICBpbml0aWFsT3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IEFzeW5jSXRlcmFibGU8QnVpbGRlck91dHB1dD4ge1xuICAvLyBPbmx5IEFPVCBpcyBjdXJyZW50bHkgc3VwcG9ydGVkXG4gIGlmIChpbml0aWFsT3B0aW9ucy5hb3QgIT09IHRydWUpIHtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihcbiAgICAgICdKSVQgbW9kZSBpcyBjdXJyZW50bHkgbm90IHN1cHBvcnRlZCBieSB0aGlzIGV4cGVyaW1lbnRhbCBidWlsZGVyLiBBT1QgbW9kZSBtdXN0IGJlIHVzZWQuJyxcbiAgICApO1xuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgfVxuXG4gIC8vIEluZm9ybSB1c2VyIG9mIGV4cGVyaW1lbnRhbCBzdGF0dXMgb2YgYnVpbGRlciBhbmQgb3B0aW9uc1xuICBsb2dFeHBlcmltZW50YWxXYXJuaW5ncyhpbml0aWFsT3B0aW9ucywgY29udGV4dCk7XG5cbiAgLy8gRGV0ZXJtaW5lIHByb2plY3QgbmFtZSBmcm9tIGJ1aWxkZXIgY29udGV4dCB0YXJnZXRcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGBUaGUgJ2Jyb3dzZXItZXNidWlsZCcgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldCB0byBiZSBzcGVjaWZpZWQuYCk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICB9XG5cbiAgY29uc3Qgbm9ybWFsaXplZE9wdGlvbnMgPSBhd2FpdCBub3JtYWxpemVPcHRpb25zKGNvbnRleHQsIHByb2plY3ROYW1lLCBpbml0aWFsT3B0aW9ucyk7XG5cbiAgLy8gQ2xlYW4gb3V0cHV0IHBhdGggaWYgZW5hYmxlZFxuICBpZiAoaW5pdGlhbE9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aCkge1xuICAgIGRlbGV0ZU91dHB1dERpcihub3JtYWxpemVkT3B0aW9ucy53b3Jrc3BhY2VSb290LCBpbml0aWFsT3B0aW9ucy5vdXRwdXRQYXRoKTtcbiAgfVxuXG4gIC8vIENyZWF0ZSBvdXRwdXQgZGlyZWN0b3J5IGlmIG5lZWRlZFxuICB0cnkge1xuICAgIGF3YWl0IGZzLm1rZGlyKG5vcm1hbGl6ZWRPcHRpb25zLm91dHB1dFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgYXNzZXJ0SXNFcnJvcihlKTtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcignVW5hYmxlIHRvIGNyZWF0ZSBvdXRwdXQgZGlyZWN0b3J5OiAnICsgZS5tZXNzYWdlKTtcblxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gIH1cblxuICAvLyBJbml0aWFsIGJ1aWxkXG4gIGxldCByZXN1bHQgPSBhd2FpdCBleGVjdXRlKG5vcm1hbGl6ZWRPcHRpb25zLCBjb250ZXh0KTtcbiAgeWllbGQgcmVzdWx0Lm91dHB1dDtcblxuICAvLyBGaW5pc2ggaWYgd2F0Y2ggbW9kZSBpcyBub3QgZW5hYmxlZFxuICBpZiAoIWluaXRpYWxPcHRpb25zLndhdGNoKSB7XG4gICAgc2h1dGRvd25TYXNzV29ya2VyUG9vbCgpO1xuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29udGV4dC5sb2dnZXIuaW5mbygnV2F0Y2ggbW9kZSBlbmFibGVkLiBXYXRjaGluZyBmb3IgZmlsZSBjaGFuZ2VzLi4uJyk7XG5cbiAgLy8gU2V0dXAgYSB3YXRjaGVyXG4gIGNvbnN0IHdhdGNoZXIgPSBjcmVhdGVXYXRjaGVyKHtcbiAgICBwb2xsaW5nOiB0eXBlb2YgaW5pdGlhbE9wdGlvbnMucG9sbCA9PT0gJ251bWJlcicsXG4gICAgaW50ZXJ2YWw6IGluaXRpYWxPcHRpb25zLnBvbGwsXG4gICAgLy8gSWdub3JlIHRoZSBvdXRwdXQgYW5kIGNhY2hlIHBhdGhzIHRvIGF2b2lkIGluZmluaXRlIHJlYnVpbGQgY3ljbGVzXG4gICAgaWdub3JlZDogW25vcm1hbGl6ZWRPcHRpb25zLm91dHB1dFBhdGgsIG5vcm1hbGl6ZWRPcHRpb25zLmNhY2hlT3B0aW9ucy5iYXNlUGF0aF0sXG4gIH0pO1xuXG4gIC8vIFRlbXBvcmFyaWx5IHdhdGNoIHRoZSBlbnRpcmUgcHJvamVjdFxuICB3YXRjaGVyLmFkZChub3JtYWxpemVkT3B0aW9ucy5wcm9qZWN0Um9vdCk7XG5cbiAgLy8gV2F0Y2ggd29ya3NwYWNlIHJvb3Qgbm9kZSBtb2R1bGVzXG4gIC8vIEluY2x1ZGVzIFlhcm4gUG5QIG1hbmlmZXN0IGZpbGVzIChodHRwczovL3lhcm5wa2cuY29tL2FkdmFuY2VkL3BucC1zcGVjLylcbiAgd2F0Y2hlci5hZGQocGF0aC5qb2luKG5vcm1hbGl6ZWRPcHRpb25zLndvcmtzcGFjZVJvb3QsICdub2RlX21vZHVsZXMnKSk7XG4gIHdhdGNoZXIuYWRkKHBhdGguam9pbihub3JtYWxpemVkT3B0aW9ucy53b3Jrc3BhY2VSb290LCAnLnBucC5janMnKSk7XG4gIHdhdGNoZXIuYWRkKHBhdGguam9pbihub3JtYWxpemVkT3B0aW9ucy53b3Jrc3BhY2VSb290LCAnLnBucC5kYXRhLmpzb24nKSk7XG5cbiAgLy8gV2FpdCBmb3IgY2hhbmdlcyBhbmQgcmVidWlsZCBhcyBuZWVkZWRcbiAgdHJ5IHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNoYW5nZXMgb2Ygd2F0Y2hlcikge1xuICAgICAgY29udGV4dC5sb2dnZXIuaW5mbygnQ2hhbmdlcyBkZXRlY3RlZC4gUmVidWlsZGluZy4uLicpO1xuXG4gICAgICBpZiAoaW5pdGlhbE9wdGlvbnMudmVyYm9zZSkge1xuICAgICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKGNoYW5nZXMudG9EZWJ1Z1N0cmluZygpKTtcbiAgICAgIH1cblxuICAgICAgcmVzdWx0ID0gYXdhaXQgZXhlY3V0ZShub3JtYWxpemVkT3B0aW9ucywgY29udGV4dCwgcmVzdWx0LmNyZWF0ZVJlYnVpbGRTdGF0ZShjaGFuZ2VzKSk7XG4gICAgICB5aWVsZCByZXN1bHQub3V0cHV0O1xuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICAvLyBTdG9wIHRoZSB3YXRjaGVyXG4gICAgYXdhaXQgd2F0Y2hlci5jbG9zZSgpO1xuICAgIC8vIENsZWFudXAgaW5jcmVtZW50YWwgcmVidWlsZCBzdGF0ZVxuICAgIHJlc3VsdC5kaXNwb3NlKCk7XG4gICAgc2h1dGRvd25TYXNzV29ya2VyUG9vbCgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXIoYnVpbGRFc2J1aWxkQnJvd3Nlcik7XG4iXX0=