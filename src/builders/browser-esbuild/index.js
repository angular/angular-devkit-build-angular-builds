"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEsbuildBrowser = void 0;
const architect_1 = require("@angular-devkit/architect");
const node_assert_1 = __importDefault(require("node:assert"));
const node_fs_1 = require("node:fs");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const utils_1 = require("../../utils");
const copy_assets_1 = require("../../utils/copy-assets");
const error_1 = require("../../utils/error");
const esbuild_targets_1 = require("../../utils/esbuild-targets");
const index_html_generator_1 = require("../../utils/index-file/index-html-generator");
const service_worker_1 = require("../../utils/service-worker");
const supported_browsers_1 = require("../../utils/supported-browsers");
const stats_1 = require("../../webpack/utils/stats");
const commonjs_checker_1 = require("./commonjs-checker");
const compiler_plugin_1 = require("./compiler-plugin");
const esbuild_1 = require("./esbuild");
const experimental_warnings_1 = require("./experimental-warnings");
const license_extractor_1 = require("./license-extractor");
const options_1 = require("./options");
const sass_plugin_1 = require("./sass-plugin");
const stylesheets_1 = require("./stylesheets");
const watcher_1 = require("./watcher");
/**
 * Represents the result of a single builder execute call.
 */
class ExecutionResult {
    constructor(codeRebuild, globalStylesRebuild, codeBundleCache) {
        this.codeRebuild = codeRebuild;
        this.globalStylesRebuild = globalStylesRebuild;
        this.codeBundleCache = codeBundleCache;
        this.outputFiles = [];
        this.assetFiles = [];
    }
    addOutputFile(path, content) {
        this.outputFiles.push(createOutputFileFromText(path, content));
    }
    get output() {
        return {
            success: this.outputFiles.length > 0,
        };
    }
    get outputWithFiles() {
        return {
            success: this.outputFiles.length > 0,
            outputFiles: this.outputFiles,
            assetFiles: this.assetFiles,
        };
    }
    createRebuildState(fileChanges) {
        this.codeBundleCache?.invalidate([...fileChanges.modified, ...fileChanges.removed]);
        return {
            codeRebuild: this.codeRebuild,
            globalStylesRebuild: this.globalStylesRebuild,
            codeBundleCache: this.codeBundleCache,
            fileChanges,
        };
    }
    async dispose() {
        await Promise.allSettled([this.codeRebuild?.dispose(), this.globalStylesRebuild?.dispose()]);
    }
}
async function execute(options, context, rebuildState) {
    const startTime = process.hrtime.bigint();
    const { projectRoot, workspaceRoot, optimizationOptions, assets, serviceWorkerOptions, indexHtmlOptions, } = options;
    const browsers = (0, supported_browsers_1.getSupportedBrowsers)(projectRoot, context.logger);
    const target = (0, esbuild_targets_1.transformSupportedBrowsersToTargets)(browsers);
    // Reuse rebuild state or create new bundle contexts for code and global stylesheets
    const codeBundleCache = options.watch
        ? rebuildState?.codeBundleCache ?? new compiler_plugin_1.SourceFileCache()
        : undefined;
    const codeBundleContext = rebuildState?.codeRebuild ??
        new esbuild_1.BundlerContext(workspaceRoot, !!options.watch, createCodeBundleOptions(options, target, browsers, codeBundleCache));
    const globalStylesBundleContext = rebuildState?.globalStylesRebuild ??
        new esbuild_1.BundlerContext(workspaceRoot, !!options.watch, createGlobalStylesBundleOptions(options, target, browsers));
    const [codeResults, styleResults] = await Promise.all([
        // Execute esbuild to bundle the application code
        codeBundleContext.bundle(),
        // Execute esbuild to bundle the global stylesheets
        globalStylesBundleContext.bundle(),
    ]);
    // Log all warnings and errors generated during bundling
    await (0, esbuild_1.logMessages)(context, {
        errors: [...(codeResults.errors || []), ...(styleResults.errors || [])],
        warnings: [...codeResults.warnings, ...styleResults.warnings],
    });
    const executionResult = new ExecutionResult(codeBundleContext, globalStylesBundleContext, codeBundleCache);
    // Return if the bundling has errors
    if (codeResults.errors || styleResults.errors) {
        return executionResult;
    }
    // Filter global stylesheet initial files
    styleResults.initialFiles = styleResults.initialFiles.filter(({ name }) => options.globalStyles.find((style) => style.name === name)?.initial);
    // Combine the bundling output files
    const initialFiles = [...codeResults.initialFiles, ...styleResults.initialFiles];
    executionResult.outputFiles.push(...codeResults.outputFiles, ...styleResults.outputFiles);
    // Combine metafiles used for the stats option as well as bundle budgets and console output
    const metafile = {
        inputs: { ...codeResults.metafile?.inputs, ...styleResults.metafile?.inputs },
        outputs: { ...codeResults.metafile?.outputs, ...styleResults.metafile?.outputs },
    };
    // Check metafile for CommonJS module usage if optimizing scripts
    if (optimizationOptions.scripts) {
        const messages = (0, commonjs_checker_1.checkCommonJSModules)(metafile, options.allowedCommonJsDependencies);
        await (0, esbuild_1.logMessages)(context, { warnings: messages });
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
            const relativefilePath = node_path_1.default.relative(virtualOutputPath, filePath);
            const file = executionResult.outputFiles.find((file) => file.path === relativefilePath);
            if (file) {
                return file.text;
            }
            throw new Error(`Output file does not exist: ${node_path_1.default}`);
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
        executionResult.addOutputFile(indexHtmlOptions.output, content);
    }
    // Copy assets
    if (assets) {
        // The webpack copy assets helper is used with no base paths defined. This prevents the helper
        // from directly writing to disk. This should eventually be replaced with a more optimized helper.
        executionResult.assetFiles.push(...(await (0, copy_assets_1.copyAssets)(assets, [], workspaceRoot)));
    }
    // Write metafile if stats option is enabled
    if (options.stats) {
        executionResult.addOutputFile('stats.json', JSON.stringify(metafile, null, 2));
    }
    // Extract and write licenses for used packages
    if (options.extractLicenses) {
        executionResult.addOutputFile('3rdpartylicenses.txt', await (0, license_extractor_1.extractLicenses)(metafile, workspaceRoot));
    }
    // Augment the application with service worker support
    if (serviceWorkerOptions) {
        try {
            const serviceWorkerResult = await (0, service_worker_1.augmentAppWithServiceWorkerEsbuild)(workspaceRoot, serviceWorkerOptions, options.baseHref || '/', executionResult.outputFiles, executionResult.assetFiles);
            executionResult.addOutputFile('ngsw.json', serviceWorkerResult.manifest);
            executionResult.assetFiles.push(...serviceWorkerResult.assetFiles);
        }
        catch (error) {
            context.logger.error(error instanceof Error ? error.message : `${error}`);
            return executionResult;
        }
    }
    logBuildStats(context, metafile);
    const buildTime = Number(process.hrtime.bigint() - startTime) / 10 ** 9;
    context.logger.info(`Complete. [${buildTime.toFixed(3)} seconds]`);
    return executionResult;
}
async function writeResultFiles(outputFiles, assetFiles, outputPath) {
    const directoryExists = new Set();
    await Promise.all(outputFiles.map(async (file) => {
        // Ensure output subdirectories exist
        const basePath = node_path_1.default.dirname(file.path);
        if (basePath && !directoryExists.has(basePath)) {
            await promises_1.default.mkdir(node_path_1.default.join(outputPath, basePath), { recursive: true });
            directoryExists.add(basePath);
        }
        // Write file contents
        await promises_1.default.writeFile(node_path_1.default.join(outputPath, file.path), file.contents);
    }));
    if (assetFiles?.length) {
        await Promise.all(assetFiles.map(async ({ source, destination }) => {
            // Ensure output subdirectories exist
            const basePath = node_path_1.default.dirname(destination);
            if (basePath && !directoryExists.has(basePath)) {
                await promises_1.default.mkdir(node_path_1.default.join(outputPath, basePath), { recursive: true });
                directoryExists.add(basePath);
            }
            // Copy file contents
            await promises_1.default.copyFile(source, node_path_1.default.join(outputPath, destination), 
            // This is not yet available from `fs/promises` in Node.js v16.13
            node_fs_1.constants.COPYFILE_FICLONE);
        }));
    }
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
function createCodeBundleOptions(options, target, browsers, sourceFileCache) {
    const { workspaceRoot, entryPoints, polyfills, optimizationOptions, sourcemapOptions, tsconfig, outputNames, fileReplacements, externalDependencies, preserveSymlinks, stylePreprocessorOptions, advancedOptimizations, inlineStyleLanguage, jit, tailwindConfiguration, } = options;
    const buildOptions = {
        absWorkingDir: workspaceRoot,
        bundle: true,
        format: 'esm',
        entryPoints,
        entryNames: outputNames.bundles,
        assetNames: outputNames.media,
        target,
        supported: getFeatureSupport(target),
        mainFields: ['es2020', 'browser', 'module', 'main'],
        conditions: ['es2020', 'es2015', 'module'],
        resolveExtensions: ['.ts', '.tsx', '.mjs', '.js'],
        metafile: true,
        legalComments: options.extractLicenses ? 'none' : 'eof',
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
                jit,
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
                includePaths: stylePreprocessorOptions?.includePaths,
                externalDependencies,
                target,
                inlineStyleLanguage,
                browsers,
                tailwindConfiguration,
            }),
        ],
        define: {
            // Only set to false when script optimizations are enabled. It should not be set to true because
            // Angular turns `ngDevMode` into an object for development debugging purposes when not defined
            // which a constant true value would break.
            ...(optimizationOptions.scripts ? { 'ngDevMode': 'false' } : undefined),
            'ngJitMode': jit ? 'true' : 'false',
        },
    };
    if (polyfills?.length) {
        const namespace = 'angular:polyfills';
        buildOptions.entryPoints = {
            ...buildOptions.entryPoints,
            ['polyfills']: namespace,
        };
        buildOptions.plugins?.unshift({
            name: 'angular-polyfills',
            setup(build) {
                build.onResolve({ filter: /^angular:polyfills$/ }, (args) => {
                    if (args.kind !== 'entry-point') {
                        return null;
                    }
                    return {
                        path: 'entry',
                        namespace,
                    };
                });
                build.onLoad({ filter: /./, namespace }, () => {
                    return {
                        contents: polyfills.map((file) => `import '${file.replace(/\\/g, '/')}';`).join('\n'),
                        loader: 'js',
                        resolveDir: workspaceRoot,
                    };
                });
            },
        });
    }
    return buildOptions;
}
/**
 * Generates a syntax feature object map for Angular applications based on a list of targets.
 * A full set of feature names can be found here: https://esbuild.github.io/api/#supported
 * @param target An array of browser/engine targets in the format accepted by the esbuild `target` option.
 * @returns An object that can be used with the esbuild build `supported` option.
 */
function getFeatureSupport(target) {
    const supported = {
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
    };
    // Detect Safari browser versions that have a class field behavior bug
    // See: https://github.com/angular/angular-cli/issues/24355#issuecomment-1333477033
    // See: https://github.com/WebKit/WebKit/commit/e8788a34b3d5f5b4edd7ff6450b80936bff396f2
    let safariClassFieldScopeBug = false;
    for (const browser of target) {
        let majorVersion;
        if (browser.startsWith('ios')) {
            majorVersion = Number(browser.slice(3, 5));
        }
        else if (browser.startsWith('safari')) {
            majorVersion = Number(browser.slice(6, 8));
        }
        else {
            continue;
        }
        // Technically, 14.0 is not broken but rather does not have support. However, the behavior
        // is identical since it would be set to false by esbuild if present as a target.
        if (majorVersion === 14 || majorVersion === 15) {
            safariClassFieldScopeBug = true;
            break;
        }
    }
    // If class field support cannot be used set to false; otherwise leave undefined to allow
    // esbuild to use `target` to determine support.
    if (safariClassFieldScopeBug) {
        supported['class-field'] = false;
        supported['class-static-field'] = false;
    }
    return supported;
}
function createGlobalStylesBundleOptions(options, target, browsers) {
    const { workspaceRoot, optimizationOptions, sourcemapOptions, outputNames, globalStyles, preserveSymlinks, externalDependencies, stylePreprocessorOptions, tailwindConfiguration, } = options;
    const buildOptions = (0, stylesheets_1.createStylesheetBundleOptions)({
        workspaceRoot,
        optimization: !!optimizationOptions.styles.minify,
        sourcemap: !!sourcemapOptions.styles,
        preserveSymlinks,
        target,
        externalDependencies,
        outputNames,
        includePaths: stylePreprocessorOptions?.includePaths,
        browsers,
        tailwindConfiguration,
    });
    buildOptions.legalComments = options.extractLicenses ? 'none' : 'eof';
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
                const files = globalStyles.find(({ name }) => name === args.path)?.files;
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
 * @param userOptions The browser builder options to use when setting up the application build
 * @param context The Architect builder context object
 * @returns An async iterable with the builder result output
 */
async function* buildEsbuildBrowser(userOptions, context, infrastructureSettings) {
    // Inform user of experimental status of builder and options
    (0, experimental_warnings_1.logExperimentalWarnings)(userOptions, context);
    // Determine project name from builder context target
    const projectName = context.target?.project;
    if (!projectName) {
        context.logger.error(`The 'browser-esbuild' builder requires a target to be specified.`);
        return;
    }
    const normalizedOptions = await (0, options_1.normalizeOptions)(context, projectName, userOptions);
    // Writing the result to the filesystem is the default behavior
    const shouldWriteResult = infrastructureSettings?.write !== false;
    if (shouldWriteResult) {
        // Clean output path if enabled
        if (userOptions.deleteOutputPath) {
            (0, utils_1.deleteOutputDir)(normalizedOptions.workspaceRoot, userOptions.outputPath);
        }
        // Create output directory if needed
        try {
            await promises_1.default.mkdir(normalizedOptions.outputPath, { recursive: true });
        }
        catch (e) {
            (0, error_1.assertIsError)(e);
            context.logger.error('Unable to create output directory: ' + e.message);
            return;
        }
    }
    // Initial build
    let result;
    try {
        result = await execute(normalizedOptions, context);
        if (shouldWriteResult) {
            // Write output files
            await writeResultFiles(result.outputFiles, result.assetFiles, normalizedOptions.outputPath);
            yield result.output;
        }
        else {
            // Requires casting due to unneeded `JsonObject` requirement. Remove once fixed.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            yield result.outputWithFiles;
        }
        // Finish if watch mode is not enabled
        if (!userOptions.watch) {
            return;
        }
    }
    finally {
        // Ensure Sass workers are shutdown if not watching
        if (!userOptions.watch) {
            (0, sass_plugin_1.shutdownSassWorkerPool)();
        }
    }
    context.logger.info('Watch mode enabled. Watching for file changes...');
    // Setup a watcher
    const watcher = (0, watcher_1.createWatcher)({
        polling: typeof userOptions.poll === 'number',
        interval: userOptions.poll,
        // Ignore the output and cache paths to avoid infinite rebuild cycles
        ignored: [normalizedOptions.outputPath, normalizedOptions.cacheOptions.basePath],
    });
    // Temporarily watch the entire project
    watcher.add(normalizedOptions.projectRoot);
    // Watch workspace root node modules
    // Includes Yarn PnP manifest files (https://yarnpkg.com/advanced/pnp-spec/)
    watcher.add(node_path_1.default.join(normalizedOptions.workspaceRoot, 'node_modules'));
    watcher.add(node_path_1.default.join(normalizedOptions.workspaceRoot, '.pnp.cjs'));
    watcher.add(node_path_1.default.join(normalizedOptions.workspaceRoot, '.pnp.data.json'));
    // Wait for changes and rebuild as needed
    try {
        for await (const changes of watcher) {
            context.logger.info('Changes detected. Rebuilding...');
            if (userOptions.verbose) {
                context.logger.info(changes.toDebugString());
            }
            result = await execute(normalizedOptions, context, result.createRebuildState(changes));
            if (shouldWriteResult) {
                // Write output files
                await writeResultFiles(result.outputFiles, result.assetFiles, normalizedOptions.outputPath);
                yield result.output;
            }
            else {
                // Requires casting due to unneeded `JsonObject` requirement. Remove once fixed.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                yield result.outputWithFiles;
            }
        }
    }
    finally {
        // Stop the watcher
        await watcher.close();
        // Cleanup incremental rebuild state
        await result.dispose();
        (0, sass_plugin_1.shutdownSassWorkerPool)();
    }
}
exports.buildEsbuildBrowser = buildEsbuildBrowser;
exports.default = (0, architect_1.createBuilder)(buildEsbuildBrowser);
function logBuildStats(context, metafile) {
    const stats = [];
    for (const [file, output] of Object.entries(metafile.outputs)) {
        // Skip sourcemaps
        if (file.endsWith('.map')) {
            continue;
        }
        // Skip internal component resources
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (output['ng-component']) {
            continue;
        }
        stats.push({
            initial: !!output.entryPoint,
            stats: [file, '', output.bytes, ''],
        });
    }
    const tableText = (0, stats_1.generateBuildStatsTable)(stats, true, true, false, undefined);
    context.logger.info('\n' + tableText + '\n');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgseURBQXlGO0FBRXpGLDhEQUFpQztBQUNqQyxxQ0FBbUQ7QUFDbkQsZ0VBQWtDO0FBQ2xDLDBEQUE2QjtBQUM3Qix1Q0FBOEM7QUFDOUMseURBQXFEO0FBQ3JELDZDQUFrRDtBQUNsRCxpRUFBa0Y7QUFFbEYsc0ZBQWlGO0FBQ2pGLCtEQUFnRjtBQUNoRix1RUFBc0U7QUFDdEUscURBQWlGO0FBQ2pGLHlEQUEwRDtBQUMxRCx1REFBMEU7QUFDMUUsdUNBQXdEO0FBQ3hELG1FQUFrRTtBQUNsRSwyREFBc0Q7QUFDdEQsdUNBQXVFO0FBQ3ZFLCtDQUF1RDtBQUV2RCwrQ0FBOEQ7QUFDOUQsdUNBQXdEO0FBU3hEOztHQUVHO0FBQ0gsTUFBTSxlQUFlO0lBSW5CLFlBQ1UsV0FBNEIsRUFDNUIsbUJBQW9DLEVBQ3BDLGVBQWlDO1FBRmpDLGdCQUFXLEdBQVgsV0FBVyxDQUFpQjtRQUM1Qix3QkFBbUIsR0FBbkIsbUJBQW1CLENBQWlCO1FBQ3BDLG9CQUFlLEdBQWYsZUFBZSxDQUFrQjtRQU5sQyxnQkFBVyxHQUFpQixFQUFFLENBQUM7UUFDL0IsZUFBVSxHQUE4QyxFQUFFLENBQUM7SUFNakUsQ0FBQztJQUVKLGFBQWEsQ0FBQyxJQUFZLEVBQUUsT0FBZTtRQUN6QyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRUQsSUFBSSxNQUFNO1FBQ1IsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0s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ZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgdHlwZSB7IEJ1aWxkT3B0aW9ucywgTWV0YWZpbGUsIE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgY29uc3RhbnRzIGFzIGZzQ29uc3RhbnRzIH0gZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZGVsZXRlT3V0cHV0RGlyIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgY29weUFzc2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvcHktYXNzZXRzJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2VzYnVpbGQtdGFyZ2V0cyc7XG5pbXBvcnQgeyBGaWxlSW5mbyB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvYXVnbWVudC1pbmRleC1odG1sJztcbmltcG9ydCB7IEluZGV4SHRtbEdlbmVyYXRvciB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyRXNidWlsZCB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IGdldFN1cHBvcnRlZEJyb3dzZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3VwcG9ydGVkLWJyb3dzZXJzJztcbmltcG9ydCB7IEJ1bmRsZVN0YXRzLCBnZW5lcmF0ZUJ1aWxkU3RhdHNUYWJsZSB9IGZyb20gJy4uLy4uL3dlYnBhY2svdXRpbHMvc3RhdHMnO1xuaW1wb3J0IHsgY2hlY2tDb21tb25KU01vZHVsZXMgfSBmcm9tICcuL2NvbW1vbmpzLWNoZWNrZXInO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlLCBjcmVhdGVDb21waWxlclBsdWdpbiB9IGZyb20gJy4vY29tcGlsZXItcGx1Z2luJztcbmltcG9ydCB7IEJ1bmRsZXJDb250ZXh0LCBsb2dNZXNzYWdlcyB9IGZyb20gJy4vZXNidWlsZCc7XG5pbXBvcnQgeyBsb2dFeHBlcmltZW50YWxXYXJuaW5ncyB9IGZyb20gJy4vZXhwZXJpbWVudGFsLXdhcm5pbmdzJztcbmltcG9ydCB7IGV4dHJhY3RMaWNlbnNlcyB9IGZyb20gJy4vbGljZW5zZS1leHRyYWN0b3InO1xuaW1wb3J0IHsgTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zLCBub3JtYWxpemVPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB7IHNodXRkb3duU2Fzc1dvcmtlclBvb2wgfSBmcm9tICcuL3Nhc3MtcGx1Z2luJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQgeyBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyB9IGZyb20gJy4vc3R5bGVzaGVldHMnO1xuaW1wb3J0IHsgQ2hhbmdlZEZpbGVzLCBjcmVhdGVXYXRjaGVyIH0gZnJvbSAnLi93YXRjaGVyJztcblxuaW50ZXJmYWNlIFJlYnVpbGRTdGF0ZSB7XG4gIGNvZGVSZWJ1aWxkPzogQnVuZGxlckNvbnRleHQ7XG4gIGdsb2JhbFN0eWxlc1JlYnVpbGQ/OiBCdW5kbGVyQ29udGV4dDtcbiAgY29kZUJ1bmRsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlO1xuICBmaWxlQ2hhbmdlczogQ2hhbmdlZEZpbGVzO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgdGhlIHJlc3VsdCBvZiBhIHNpbmdsZSBidWlsZGVyIGV4ZWN1dGUgY2FsbC5cbiAqL1xuY2xhc3MgRXhlY3V0aW9uUmVzdWx0IHtcbiAgcmVhZG9ubHkgb3V0cHV0RmlsZXM6IE91dHB1dEZpbGVbXSA9IFtdO1xuICByZWFkb25seSBhc3NldEZpbGVzOiB7IHNvdXJjZTogc3RyaW5nOyBkZXN0aW5hdGlvbjogc3RyaW5nIH1bXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgY29kZVJlYnVpbGQ/OiBCdW5kbGVyQ29udGV4dCxcbiAgICBwcml2YXRlIGdsb2JhbFN0eWxlc1JlYnVpbGQ/OiBCdW5kbGVyQ29udGV4dCxcbiAgICBwcml2YXRlIGNvZGVCdW5kbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZSxcbiAgKSB7fVxuXG4gIGFkZE91dHB1dEZpbGUocGF0aDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLm91dHB1dEZpbGVzLnB1c2goY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHBhdGgsIGNvbnRlbnQpKTtcbiAgfVxuXG4gIGdldCBvdXRwdXQoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRoaXMub3V0cHV0RmlsZXMubGVuZ3RoID4gMCxcbiAgICB9O1xuICB9XG5cbiAgZ2V0IG91dHB1dFdpdGhGaWxlcygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdGhpcy5vdXRwdXRGaWxlcy5sZW5ndGggPiAwLFxuICAgICAgb3V0cHV0RmlsZXM6IHRoaXMub3V0cHV0RmlsZXMsXG4gICAgICBhc3NldEZpbGVzOiB0aGlzLmFzc2V0RmlsZXMsXG4gICAgfTtcbiAgfVxuXG4gIGNyZWF0ZVJlYnVpbGRTdGF0ZShmaWxlQ2hhbmdlczogQ2hhbmdlZEZpbGVzKTogUmVidWlsZFN0YXRlIHtcbiAgICB0aGlzLmNvZGVCdW5kbGVDYWNoZT8uaW52YWxpZGF0ZShbLi4uZmlsZUNoYW5nZXMubW9kaWZpZWQsIC4uLmZpbGVDaGFuZ2VzLnJlbW92ZWRdKTtcblxuICAgIHJldHVybiB7XG4gICAgICBjb2RlUmVidWlsZDogdGhpcy5jb2RlUmVidWlsZCxcbiAgICAgIGdsb2JhbFN0eWxlc1JlYnVpbGQ6IHRoaXMuZ2xvYmFsU3R5bGVzUmVidWlsZCxcbiAgICAgIGNvZGVCdW5kbGVDYWNoZTogdGhpcy5jb2RlQnVuZGxlQ2FjaGUsXG4gICAgICBmaWxlQ2hhbmdlcyxcbiAgICB9O1xuICB9XG5cbiAgYXN5bmMgZGlzcG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoW3RoaXMuY29kZVJlYnVpbGQ/LmRpc3Bvc2UoKSwgdGhpcy5nbG9iYWxTdHlsZXNSZWJ1aWxkPy5kaXNwb3NlKCldKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBleGVjdXRlKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICByZWJ1aWxkU3RhdGU/OiBSZWJ1aWxkU3RhdGUsXG4pOiBQcm9taXNlPEV4ZWN1dGlvblJlc3VsdD4ge1xuICBjb25zdCBzdGFydFRpbWUgPSBwcm9jZXNzLmhydGltZS5iaWdpbnQoKTtcblxuICBjb25zdCB7XG4gICAgcHJvamVjdFJvb3QsXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIGFzc2V0cyxcbiAgICBzZXJ2aWNlV29ya2VyT3B0aW9ucyxcbiAgICBpbmRleEh0bWxPcHRpb25zLFxuICB9ID0gb3B0aW9ucztcblxuICBjb25zdCBicm93c2VycyA9IGdldFN1cHBvcnRlZEJyb3dzZXJzKHByb2plY3RSb290LCBjb250ZXh0LmxvZ2dlcik7XG4gIGNvbnN0IHRhcmdldCA9IHRyYW5zZm9ybVN1cHBvcnRlZEJyb3dzZXJzVG9UYXJnZXRzKGJyb3dzZXJzKTtcblxuICAvLyBSZXVzZSByZWJ1aWxkIHN0YXRlIG9yIGNyZWF0ZSBuZXcgYnVuZGxlIGNvbnRleHRzIGZvciBjb2RlIGFuZCBnbG9iYWwgc3R5bGVzaGVldHNcbiAgY29uc3QgY29kZUJ1bmRsZUNhY2hlID0gb3B0aW9ucy53YXRjaFxuICAgID8gcmVidWlsZFN0YXRlPy5jb2RlQnVuZGxlQ2FjaGUgPz8gbmV3IFNvdXJjZUZpbGVDYWNoZSgpXG4gICAgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IGNvZGVCdW5kbGVDb250ZXh0ID1cbiAgICByZWJ1aWxkU3RhdGU/LmNvZGVSZWJ1aWxkID8/XG4gICAgbmV3IEJ1bmRsZXJDb250ZXh0KFxuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICEhb3B0aW9ucy53YXRjaCxcbiAgICAgIGNyZWF0ZUNvZGVCdW5kbGVPcHRpb25zKG9wdGlvbnMsIHRhcmdldCwgYnJvd3NlcnMsIGNvZGVCdW5kbGVDYWNoZSksXG4gICAgKTtcbiAgY29uc3QgZ2xvYmFsU3R5bGVzQnVuZGxlQ29udGV4dCA9XG4gICAgcmVidWlsZFN0YXRlPy5nbG9iYWxTdHlsZXNSZWJ1aWxkID8/XG4gICAgbmV3IEJ1bmRsZXJDb250ZXh0KFxuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICEhb3B0aW9ucy53YXRjaCxcbiAgICAgIGNyZWF0ZUdsb2JhbFN0eWxlc0J1bmRsZU9wdGlvbnMob3B0aW9ucywgdGFyZ2V0LCBicm93c2VycyksXG4gICAgKTtcblxuICBjb25zdCBbY29kZVJlc3VsdHMsIHN0eWxlUmVzdWx0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgLy8gRXhlY3V0ZSBlc2J1aWxkIHRvIGJ1bmRsZSB0aGUgYXBwbGljYXRpb24gY29kZVxuICAgIGNvZGVCdW5kbGVDb250ZXh0LmJ1bmRsZSgpLFxuICAgIC8vIEV4ZWN1dGUgZXNidWlsZCB0byBidW5kbGUgdGhlIGdsb2JhbCBzdHlsZXNoZWV0c1xuICAgIGdsb2JhbFN0eWxlc0J1bmRsZUNvbnRleHQuYnVuZGxlKCksXG4gIF0pO1xuXG4gIC8vIExvZyBhbGwgd2FybmluZ3MgYW5kIGVycm9ycyBnZW5lcmF0ZWQgZHVyaW5nIGJ1bmRsaW5nXG4gIGF3YWl0IGxvZ01lc3NhZ2VzKGNvbnRleHQsIHtcbiAgICBlcnJvcnM6IFsuLi4oY29kZVJlc3VsdHMuZXJyb3JzIHx8IFtdKSwgLi4uKHN0eWxlUmVzdWx0cy5lcnJvcnMgfHwgW10pXSxcbiAgICB3YXJuaW5nczogWy4uLmNvZGVSZXN1bHRzLndhcm5pbmdzLCAuLi5zdHlsZVJlc3VsdHMud2FybmluZ3NdLFxuICB9KTtcblxuICBjb25zdCBleGVjdXRpb25SZXN1bHQgPSBuZXcgRXhlY3V0aW9uUmVzdWx0KFxuICAgIGNvZGVCdW5kbGVDb250ZXh0LFxuICAgIGdsb2JhbFN0eWxlc0J1bmRsZUNvbnRleHQsXG4gICAgY29kZUJ1bmRsZUNhY2hlLFxuICApO1xuXG4gIC8vIFJldHVybiBpZiB0aGUgYnVuZGxpbmcgaGFzIGVycm9yc1xuICBpZiAoY29kZVJlc3VsdHMuZXJyb3JzIHx8IHN0eWxlUmVzdWx0cy5lcnJvcnMpIHtcbiAgICByZXR1cm4gZXhlY3V0aW9uUmVzdWx0O1xuICB9XG5cbiAgLy8gRmlsdGVyIGdsb2JhbCBzdHlsZXNoZWV0IGluaXRpYWwgZmlsZXNcbiAgc3R5bGVSZXN1bHRzLmluaXRpYWxGaWxlcyA9IHN0eWxlUmVzdWx0cy5pbml0aWFsRmlsZXMuZmlsdGVyKFxuICAgICh7IG5hbWUgfSkgPT4gb3B0aW9ucy5nbG9iYWxTdHlsZXMuZmluZCgoc3R5bGUpID0+IHN0eWxlLm5hbWUgPT09IG5hbWUpPy5pbml0aWFsLFxuICApO1xuXG4gIC8vIENvbWJpbmUgdGhlIGJ1bmRsaW5nIG91dHB1dCBmaWxlc1xuICBjb25zdCBpbml0aWFsRmlsZXM6IEZpbGVJbmZvW10gPSBbLi4uY29kZVJlc3VsdHMuaW5pdGlhbEZpbGVzLCAuLi5zdHlsZVJlc3VsdHMuaW5pdGlhbEZpbGVzXTtcbiAgZXhlY3V0aW9uUmVzdWx0Lm91dHB1dEZpbGVzLnB1c2goLi4uY29kZVJlc3VsdHMub3V0cHV0RmlsZXMsIC4uLnN0eWxlUmVzdWx0cy5vdXRwdXRGaWxlcyk7XG5cbiAgLy8gQ29tYmluZSBtZXRhZmlsZXMgdXNlZCBmb3IgdGhlIHN0YXRzIG9wdGlvbiBhcyB3ZWxsIGFzIGJ1bmRsZSBidWRnZXRzIGFuZCBjb25zb2xlIG91dHB1dFxuICBjb25zdCBtZXRhZmlsZSA9IHtcbiAgICBpbnB1dHM6IHsgLi4uY29kZVJlc3VsdHMubWV0YWZpbGU/LmlucHV0cywgLi4uc3R5bGVSZXN1bHRzLm1ldGFmaWxlPy5pbnB1dHMgfSxcbiAgICBvdXRwdXRzOiB7IC4uLmNvZGVSZXN1bHRzLm1ldGFmaWxlPy5vdXRwdXRzLCAuLi5zdHlsZVJlc3VsdHMubWV0YWZpbGU/Lm91dHB1dHMgfSxcbiAgfTtcblxuICAvLyBDaGVjayBtZXRhZmlsZSBmb3IgQ29tbW9uSlMgbW9kdWxlIHVzYWdlIGlmIG9wdGltaXppbmcgc2NyaXB0c1xuICBpZiAob3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzKSB7XG4gICAgY29uc3QgbWVzc2FnZXMgPSBjaGVja0NvbW1vbkpTTW9kdWxlcyhtZXRhZmlsZSwgb3B0aW9ucy5hbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMpO1xuICAgIGF3YWl0IGxvZ01lc3NhZ2VzKGNvbnRleHQsIHsgd2FybmluZ3M6IG1lc3NhZ2VzIH0pO1xuICB9XG5cbiAgLy8gR2VuZXJhdGUgaW5kZXggSFRNTCBmaWxlXG4gIGlmIChpbmRleEh0bWxPcHRpb25zKSB7XG4gICAgLy8gQ3JlYXRlIGFuIGluZGV4IEhUTUwgZ2VuZXJhdG9yIHRoYXQgcmVhZHMgZnJvbSB0aGUgaW4tbWVtb3J5IG91dHB1dCBmaWxlc1xuICAgIGNvbnN0IGluZGV4SHRtbEdlbmVyYXRvciA9IG5ldyBJbmRleEh0bWxHZW5lcmF0b3Ioe1xuICAgICAgaW5kZXhQYXRoOiBpbmRleEh0bWxPcHRpb25zLmlucHV0LFxuICAgICAgZW50cnlwb2ludHM6IGluZGV4SHRtbE9wdGlvbnMuaW5zZXJ0aW9uT3JkZXIsXG4gICAgICBzcmk6IG9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgICBvcHRpbWl6YXRpb246IG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgICBjcm9zc09yaWdpbjogb3B0aW9ucy5jcm9zc09yaWdpbixcbiAgICB9KTtcblxuICAgIC8qKiBWaXJ0dWFsIG91dHB1dCBwYXRoIHRvIHN1cHBvcnQgcmVhZGluZyBpbi1tZW1vcnkgZmlsZXMuICovXG4gICAgY29uc3QgdmlydHVhbE91dHB1dFBhdGggPSAnLyc7XG4gICAgaW5kZXhIdG1sR2VuZXJhdG9yLnJlYWRBc3NldCA9IGFzeW5jIGZ1bmN0aW9uIChmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAgIC8vIFJlbW92ZSBsZWFkaW5nIGRpcmVjdG9yeSBzZXBhcmF0b3JcbiAgICAgIGNvbnN0IHJlbGF0aXZlZmlsZVBhdGggPSBwYXRoLnJlbGF0aXZlKHZpcnR1YWxPdXRwdXRQYXRoLCBmaWxlUGF0aCk7XG4gICAgICBjb25zdCBmaWxlID0gZXhlY3V0aW9uUmVzdWx0Lm91dHB1dEZpbGVzLmZpbmQoKGZpbGUpID0+IGZpbGUucGF0aCA9PT0gcmVsYXRpdmVmaWxlUGF0aCk7XG4gICAgICBpZiAoZmlsZSkge1xuICAgICAgICByZXR1cm4gZmlsZS50ZXh0O1xuICAgICAgfVxuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE91dHB1dCBmaWxlIGRvZXMgbm90IGV4aXN0OiAke3BhdGh9YCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHsgY29udGVudCwgd2FybmluZ3MsIGVycm9ycyB9ID0gYXdhaXQgaW5kZXhIdG1sR2VuZXJhdG9yLnByb2Nlc3Moe1xuICAgICAgYmFzZUhyZWY6IG9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICBsYW5nOiB1bmRlZmluZWQsXG4gICAgICBvdXRwdXRQYXRoOiB2aXJ0dWFsT3V0cHV0UGF0aCxcbiAgICAgIGZpbGVzOiBpbml0aWFsRmlsZXMsXG4gICAgfSk7XG5cbiAgICBmb3IgKGNvbnN0IGVycm9yIG9mIGVycm9ycykge1xuICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZXJyb3IpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHdhcm5pbmcgb2Ygd2FybmluZ3MpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4od2FybmluZyk7XG4gICAgfVxuXG4gICAgZXhlY3V0aW9uUmVzdWx0LmFkZE91dHB1dEZpbGUoaW5kZXhIdG1sT3B0aW9ucy5vdXRwdXQsIGNvbnRlbnQpO1xuICB9XG5cbiAgLy8gQ29weSBhc3NldHNcbiAgaWYgKGFzc2V0cykge1xuICAgIC8vIFRoZSB3ZWJwYWNrIGNvcHkgYXNzZXRzIGhlbHBlciBpcyB1c2VkIHdpdGggbm8gYmFzZSBwYXRocyBkZWZpbmVkLiBUaGlzIHByZXZlbnRzIHRoZSBoZWxwZXJcbiAgICAvLyBmcm9tIGRpcmVjdGx5IHdyaXRpbmcgdG8gZGlzay4gVGhpcyBzaG91bGQgZXZlbnR1YWxseSBiZSByZXBsYWNlZCB3aXRoIGEgbW9yZSBvcHRpbWl6ZWQgaGVscGVyLlxuICAgIGV4ZWN1dGlvblJlc3VsdC5hc3NldEZpbGVzLnB1c2goLi4uKGF3YWl0IGNvcHlBc3NldHMoYXNzZXRzLCBbXSwgd29ya3NwYWNlUm9vdCkpKTtcbiAgfVxuXG4gIC8vIFdyaXRlIG1ldGFmaWxlIGlmIHN0YXRzIG9wdGlvbiBpcyBlbmFibGVkXG4gIGlmIChvcHRpb25zLnN0YXRzKSB7XG4gICAgZXhlY3V0aW9uUmVzdWx0LmFkZE91dHB1dEZpbGUoJ3N0YXRzLmpzb24nLCBKU09OLnN0cmluZ2lmeShtZXRhZmlsZSwgbnVsbCwgMikpO1xuICB9XG5cbiAgLy8gRXh0cmFjdCBhbmQgd3JpdGUgbGljZW5zZXMgZm9yIHVzZWQgcGFja2FnZXNcbiAgaWYgKG9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzKSB7XG4gICAgZXhlY3V0aW9uUmVzdWx0LmFkZE91dHB1dEZpbGUoXG4gICAgICAnM3JkcGFydHlsaWNlbnNlcy50eHQnLFxuICAgICAgYXdhaXQgZXh0cmFjdExpY2Vuc2VzKG1ldGFmaWxlLCB3b3Jrc3BhY2VSb290KSxcbiAgICApO1xuICB9XG5cbiAgLy8gQXVnbWVudCB0aGUgYXBwbGljYXRpb24gd2l0aCBzZXJ2aWNlIHdvcmtlciBzdXBwb3J0XG4gIGlmIChzZXJ2aWNlV29ya2VyT3B0aW9ucykge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzZXJ2aWNlV29ya2VyUmVzdWx0ID0gYXdhaXQgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyRXNidWlsZChcbiAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgc2VydmljZVdvcmtlck9wdGlvbnMsXG4gICAgICAgIG9wdGlvbnMuYmFzZUhyZWYgfHwgJy8nLFxuICAgICAgICBleGVjdXRpb25SZXN1bHQub3V0cHV0RmlsZXMsXG4gICAgICAgIGV4ZWN1dGlvblJlc3VsdC5hc3NldEZpbGVzLFxuICAgICAgKTtcbiAgICAgIGV4ZWN1dGlvblJlc3VsdC5hZGRPdXRwdXRGaWxlKCduZ3N3Lmpzb24nLCBzZXJ2aWNlV29ya2VyUmVzdWx0Lm1hbmlmZXN0KTtcbiAgICAgIGV4ZWN1dGlvblJlc3VsdC5hc3NldEZpbGVzLnB1c2goLi4uc2VydmljZVdvcmtlclJlc3VsdC5hc3NldEZpbGVzKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBgJHtlcnJvcn1gKTtcblxuICAgICAgcmV0dXJuIGV4ZWN1dGlvblJlc3VsdDtcbiAgICB9XG4gIH1cblxuICBsb2dCdWlsZFN0YXRzKGNvbnRleHQsIG1ldGFmaWxlKTtcblxuICBjb25zdCBidWlsZFRpbWUgPSBOdW1iZXIocHJvY2Vzcy5ocnRpbWUuYmlnaW50KCkgLSBzdGFydFRpbWUpIC8gMTAgKiogOTtcbiAgY29udGV4dC5sb2dnZXIuaW5mbyhgQ29tcGxldGUuIFske2J1aWxkVGltZS50b0ZpeGVkKDMpfSBzZWNvbmRzXWApO1xuXG4gIHJldHVybiBleGVjdXRpb25SZXN1bHQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHdyaXRlUmVzdWx0RmlsZXMoXG4gIG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW10sXG4gIGFzc2V0RmlsZXM6IHsgc291cmNlOiBzdHJpbmc7IGRlc3RpbmF0aW9uOiBzdHJpbmcgfVtdIHwgdW5kZWZpbmVkLFxuICBvdXRwdXRQYXRoOiBzdHJpbmcsXG4pIHtcbiAgY29uc3QgZGlyZWN0b3J5RXhpc3RzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGF3YWl0IFByb21pc2UuYWxsKFxuICAgIG91dHB1dEZpbGVzLm1hcChhc3luYyAoZmlsZSkgPT4ge1xuICAgICAgLy8gRW5zdXJlIG91dHB1dCBzdWJkaXJlY3RvcmllcyBleGlzdFxuICAgICAgY29uc3QgYmFzZVBhdGggPSBwYXRoLmRpcm5hbWUoZmlsZS5wYXRoKTtcbiAgICAgIGlmIChiYXNlUGF0aCAmJiAhZGlyZWN0b3J5RXhpc3RzLmhhcyhiYXNlUGF0aCkpIHtcbiAgICAgICAgYXdhaXQgZnMubWtkaXIocGF0aC5qb2luKG91dHB1dFBhdGgsIGJhc2VQYXRoKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgIGRpcmVjdG9yeUV4aXN0cy5hZGQoYmFzZVBhdGgpO1xuICAgICAgfVxuICAgICAgLy8gV3JpdGUgZmlsZSBjb250ZW50c1xuICAgICAgYXdhaXQgZnMud3JpdGVGaWxlKHBhdGguam9pbihvdXRwdXRQYXRoLCBmaWxlLnBhdGgpLCBmaWxlLmNvbnRlbnRzKTtcbiAgICB9KSxcbiAgKTtcblxuICBpZiAoYXNzZXRGaWxlcz8ubGVuZ3RoKSB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBhc3NldEZpbGVzLm1hcChhc3luYyAoeyBzb3VyY2UsIGRlc3RpbmF0aW9uIH0pID0+IHtcbiAgICAgICAgLy8gRW5zdXJlIG91dHB1dCBzdWJkaXJlY3RvcmllcyBleGlzdFxuICAgICAgICBjb25zdCBiYXNlUGF0aCA9IHBhdGguZGlybmFtZShkZXN0aW5hdGlvbik7XG4gICAgICAgIGlmIChiYXNlUGF0aCAmJiAhZGlyZWN0b3J5RXhpc3RzLmhhcyhiYXNlUGF0aCkpIHtcbiAgICAgICAgICBhd2FpdCBmcy5ta2RpcihwYXRoLmpvaW4ob3V0cHV0UGF0aCwgYmFzZVBhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICBkaXJlY3RvcnlFeGlzdHMuYWRkKGJhc2VQYXRoKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBDb3B5IGZpbGUgY29udGVudHNcbiAgICAgICAgYXdhaXQgZnMuY29weUZpbGUoXG4gICAgICAgICAgc291cmNlLFxuICAgICAgICAgIHBhdGguam9pbihvdXRwdXRQYXRoLCBkZXN0aW5hdGlvbiksXG4gICAgICAgICAgLy8gVGhpcyBpcyBub3QgeWV0IGF2YWlsYWJsZSBmcm9tIGBmcy9wcm9taXNlc2AgaW4gTm9kZS5qcyB2MTYuMTNcbiAgICAgICAgICBmc0NvbnN0YW50cy5DT1BZRklMRV9GSUNMT05FLFxuICAgICAgICApO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQocGF0aDogc3RyaW5nLCB0ZXh0OiBzdHJpbmcpOiBPdXRwdXRGaWxlIHtcbiAgcmV0dXJuIHtcbiAgICBwYXRoLFxuICAgIHRleHQsXG4gICAgZ2V0IGNvbnRlbnRzKCkge1xuICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKHRoaXMudGV4dCwgJ3V0Zi04Jyk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ29kZUJ1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyxcbiAgdGFyZ2V0OiBzdHJpbmdbXSxcbiAgYnJvd3NlcnM6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7XG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBwb2x5ZmlsbHMsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIGZpbGVSZXBsYWNlbWVudHMsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zLFxuICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgaml0LFxuICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbixcbiAgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zOiBCdWlsZE9wdGlvbnMgPSB7XG4gICAgYWJzV29ya2luZ0Rpcjogd29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IHRydWUsXG4gICAgZm9ybWF0OiAnZXNtJyxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBlbnRyeU5hbWVzOiBvdXRwdXROYW1lcy5idW5kbGVzLFxuICAgIGFzc2V0TmFtZXM6IG91dHB1dE5hbWVzLm1lZGlhLFxuICAgIHRhcmdldCxcbiAgICBzdXBwb3J0ZWQ6IGdldEZlYXR1cmVTdXBwb3J0KHRhcmdldCksXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgIGNvbmRpdGlvbnM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdtb2R1bGUnXSxcbiAgICByZXNvbHZlRXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgIGxlZ2FsQ29tbWVudHM6IG9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzID8gJ25vbmUnIDogJ2VvZicsXG4gICAgbG9nTGV2ZWw6IG9wdGlvbnMudmVyYm9zZSA/ICdkZWJ1ZycgOiAnc2lsZW50JyxcbiAgICBtaW5pZnk6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBwdXJlOiBbJ2ZvcndhcmRSZWYnXSxcbiAgICBvdXRkaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgc291cmNlbWFwOiBzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gJ2V4dGVybmFsJyA6IHRydWUpLFxuICAgIHNwbGl0dGluZzogdHJ1ZSxcbiAgICB0c2NvbmZpZyxcbiAgICBleHRlcm5hbDogZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgICAgICAgLy8gSlMvVFMgb3B0aW9uc1xuICAgICAgICB7XG4gICAgICAgICAgc291cmNlbWFwOiAhIXNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyxcbiAgICAgICAgICB0aGlyZFBhcnR5U291cmNlbWFwczogc291cmNlbWFwT3B0aW9ucy52ZW5kb3IsXG4gICAgICAgICAgdHNjb25maWcsXG4gICAgICAgICAgaml0LFxuICAgICAgICAgIGFkdmFuY2VkT3B0aW1pemF0aW9ucyxcbiAgICAgICAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgICAgICAgIHNvdXJjZUZpbGVDYWNoZSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gQ29tcG9uZW50IHN0eWxlc2hlZXQgb3B0aW9uc1xuICAgICAgICB7XG4gICAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICBvcHRpbWl6YXRpb246ICEhb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMubWluaWZ5LFxuICAgICAgICAgIHNvdXJjZW1hcDpcbiAgICAgICAgICAgIC8vIEhpZGRlbiBjb21wb25lbnQgc3R5bGVzaGVldCBzb3VyY2VtYXBzIGFyZSBpbmFjY2Vzc2libGUgd2hpY2ggaXMgZWZmZWN0aXZlbHlcbiAgICAgICAgICAgIC8vIHRoZSBzYW1lIGFzIGJlaW5nIGRpc2FibGVkLiBEaXNhYmxpbmcgaGFzIHRoZSBhZHZhbnRhZ2Ugb2YgYXZvaWRpbmcgdGhlIG92ZXJoZWFkXG4gICAgICAgICAgICAvLyBvZiBzb3VyY2VtYXAgcHJvY2Vzc2luZy5cbiAgICAgICAgICAgICEhc291cmNlbWFwT3B0aW9ucy5zdHlsZXMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gZmFsc2UgOiAnaW5saW5lJyksXG4gICAgICAgICAgb3V0cHV0TmFtZXMsXG4gICAgICAgICAgaW5jbHVkZVBhdGhzOiBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocyxcbiAgICAgICAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICAgICAgICBicm93c2VycyxcbiAgICAgICAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gICAgICAgIH0sXG4gICAgICApLFxuICAgIF0sXG4gICAgZGVmaW5lOiB7XG4gICAgICAvLyBPbmx5IHNldCB0byBmYWxzZSB3aGVuIHNjcmlwdCBvcHRpbWl6YXRpb25zIGFyZSBlbmFibGVkLiBJdCBzaG91bGQgbm90IGJlIHNldCB0byB0cnVlIGJlY2F1c2VcbiAgICAgIC8vIEFuZ3VsYXIgdHVybnMgYG5nRGV2TW9kZWAgaW50byBhbiBvYmplY3QgZm9yIGRldmVsb3BtZW50IGRlYnVnZ2luZyBwdXJwb3NlcyB3aGVuIG5vdCBkZWZpbmVkXG4gICAgICAvLyB3aGljaCBhIGNvbnN0YW50IHRydWUgdmFsdWUgd291bGQgYnJlYWsuXG4gICAgICAuLi4ob3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzID8geyAnbmdEZXZNb2RlJzogJ2ZhbHNlJyB9IDogdW5kZWZpbmVkKSxcbiAgICAgICduZ0ppdE1vZGUnOiBqaXQgPyAndHJ1ZScgOiAnZmFsc2UnLFxuICAgIH0sXG4gIH07XG5cbiAgaWYgKHBvbHlmaWxscz8ubGVuZ3RoKSB7XG4gICAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6cG9seWZpbGxzJztcbiAgICBidWlsZE9wdGlvbnMuZW50cnlQb2ludHMgPSB7XG4gICAgICAuLi5idWlsZE9wdGlvbnMuZW50cnlQb2ludHMsXG4gICAgICBbJ3BvbHlmaWxscyddOiBuYW1lc3BhY2UsXG4gICAgfTtcblxuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zPy51bnNoaWZ0KHtcbiAgICAgIG5hbWU6ICdhbmd1bGFyLXBvbHlmaWxscycsXG4gICAgICBzZXR1cChidWlsZCkge1xuICAgICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IC9eYW5ndWxhcjpwb2x5ZmlsbHMkLyB9LCAoYXJncykgPT4ge1xuICAgICAgICAgIGlmIChhcmdzLmtpbmQgIT09ICdlbnRyeS1wb2ludCcpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwYXRoOiAnZW50cnknLFxuICAgICAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC8uLywgbmFtZXNwYWNlIH0sICgpID0+IHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29udGVudHM6IHBvbHlmaWxscy5tYXAoKGZpbGUpID0+IGBpbXBvcnQgJyR7ZmlsZS5yZXBsYWNlKC9cXFxcL2csICcvJyl9JztgKS5qb2luKCdcXG4nKSxcbiAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgYSBzeW50YXggZmVhdHVyZSBvYmplY3QgbWFwIGZvciBBbmd1bGFyIGFwcGxpY2F0aW9ucyBiYXNlZCBvbiBhIGxpc3Qgb2YgdGFyZ2V0cy5cbiAqIEEgZnVsbCBzZXQgb2YgZmVhdHVyZSBuYW1lcyBjYW4gYmUgZm91bmQgaGVyZTogaHR0cHM6Ly9lc2J1aWxkLmdpdGh1Yi5pby9hcGkvI3N1cHBvcnRlZFxuICogQHBhcmFtIHRhcmdldCBBbiBhcnJheSBvZiBicm93c2VyL2VuZ2luZSB0YXJnZXRzIGluIHRoZSBmb3JtYXQgYWNjZXB0ZWQgYnkgdGhlIGVzYnVpbGQgYHRhcmdldGAgb3B0aW9uLlxuICogQHJldHVybnMgQW4gb2JqZWN0IHRoYXQgY2FuIGJlIHVzZWQgd2l0aCB0aGUgZXNidWlsZCBidWlsZCBgc3VwcG9ydGVkYCBvcHRpb24uXG4gKi9cbmZ1bmN0aW9uIGdldEZlYXR1cmVTdXBwb3J0KHRhcmdldDogc3RyaW5nW10pOiBCdWlsZE9wdGlvbnNbJ3N1cHBvcnRlZCddIHtcbiAgY29uc3Qgc3VwcG9ydGVkOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPiA9IHtcbiAgICAvLyBOYXRpdmUgYXN5bmMvYXdhaXQgaXMgbm90IHN1cHBvcnRlZCB3aXRoIFpvbmUuanMuIERpc2FibGluZyBzdXBwb3J0IGhlcmUgd2lsbCBjYXVzZVxuICAgIC8vIGVzYnVpbGQgdG8gZG93bmxldmVsIGFzeW5jL2F3YWl0IGFuZCBmb3IgYXdhaXQuLi5vZiB0byBhIFpvbmUuanMgc3VwcG9ydGVkIGZvcm0uIEhvd2V2ZXIsIGVzYnVpbGRcbiAgICAvLyBkb2VzIG5vdCBjdXJyZW50bHkgc3VwcG9ydCBkb3dubGV2ZWxpbmcgYXN5bmMgZ2VuZXJhdG9ycy4gSW5zdGVhZCBiYWJlbCBpcyB1c2VkIHdpdGhpbiB0aGUgSlMvVFNcbiAgICAvLyBsb2FkZXIgdG8gcGVyZm9ybSB0aGUgZG93bmxldmVsIHRyYW5zZm9ybWF0aW9uLlxuICAgIC8vIE5PVEU6IElmIGVzYnVpbGQgYWRkcyBzdXBwb3J0IGluIHRoZSBmdXR1cmUsIHRoZSBiYWJlbCBzdXBwb3J0IGZvciBhc3luYyBnZW5lcmF0b3JzIGNhbiBiZSBkaXNhYmxlZC5cbiAgICAnYXN5bmMtYXdhaXQnOiBmYWxzZSxcbiAgICAvLyBWOCBjdXJyZW50bHkgaGFzIGEgcGVyZm9ybWFuY2UgZGVmZWN0IGludm9sdmluZyBvYmplY3Qgc3ByZWFkIG9wZXJhdGlvbnMgdGhhdCBjYW4gY2F1c2Ugc2lnbmZpY2FudFxuICAgIC8vIGRlZ3JhZGF0aW9uIGluIHJ1bnRpbWUgcGVyZm9ybWFuY2UuIEJ5IG5vdCBzdXBwb3J0aW5nIHRoZSBsYW5ndWFnZSBmZWF0dXJlIGhlcmUsIGEgZG93bmxldmVsIGZvcm1cbiAgICAvLyB3aWxsIGJlIHVzZWQgaW5zdGVhZCB3aGljaCBwcm92aWRlcyBhIHdvcmthcm91bmQgZm9yIHRoZSBwZXJmb3JtYW5jZSBpc3N1ZS5cbiAgICAvLyBGb3IgbW9yZSBkZXRhaWxzOiBodHRwczovL2J1Z3MuY2hyb21pdW0ub3JnL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0xMTUzNlxuICAgICdvYmplY3QtcmVzdC1zcHJlYWQnOiBmYWxzZSxcbiAgfTtcblxuICAvLyBEZXRlY3QgU2FmYXJpIGJyb3dzZXIgdmVyc2lvbnMgdGhhdCBoYXZlIGEgY2xhc3MgZmllbGQgYmVoYXZpb3IgYnVnXG4gIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzI0MzU1I2lzc3VlY29tbWVudC0xMzMzNDc3MDMzXG4gIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL1dlYktpdC9XZWJLaXQvY29tbWl0L2U4Nzg4YTM0YjNkNWY1YjRlZGQ3ZmY2NDUwYjgwOTM2YmZmMzk2ZjJcbiAgbGV0IHNhZmFyaUNsYXNzRmllbGRTY29wZUJ1ZyA9IGZhbHNlO1xuICBmb3IgKGNvbnN0IGJyb3dzZXIgb2YgdGFyZ2V0KSB7XG4gICAgbGV0IG1ham9yVmVyc2lvbjtcbiAgICBpZiAoYnJvd3Nlci5zdGFydHNXaXRoKCdpb3MnKSkge1xuICAgICAgbWFqb3JWZXJzaW9uID0gTnVtYmVyKGJyb3dzZXIuc2xpY2UoMywgNSkpO1xuICAgIH0gZWxzZSBpZiAoYnJvd3Nlci5zdGFydHNXaXRoKCdzYWZhcmknKSkge1xuICAgICAgbWFqb3JWZXJzaW9uID0gTnVtYmVyKGJyb3dzZXIuc2xpY2UoNiwgOCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgLy8gVGVjaG5pY2FsbHksIDE0LjAgaXMgbm90IGJyb2tlbiBidXQgcmF0aGVyIGRvZXMgbm90IGhhdmUgc3VwcG9ydC4gSG93ZXZlciwgdGhlIGJlaGF2aW9yXG4gICAgLy8gaXMgaWRlbnRpY2FsIHNpbmNlIGl0IHdvdWxkIGJlIHNldCB0byBmYWxzZSBieSBlc2J1aWxkIGlmIHByZXNlbnQgYXMgYSB0YXJnZXQuXG4gICAgaWYgKG1ham9yVmVyc2lvbiA9PT0gMTQgfHwgbWFqb3JWZXJzaW9uID09PSAxNSkge1xuICAgICAgc2FmYXJpQ2xhc3NGaWVsZFNjb3BlQnVnID0gdHJ1ZTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICAvLyBJZiBjbGFzcyBmaWVsZCBzdXBwb3J0IGNhbm5vdCBiZSB1c2VkIHNldCB0byBmYWxzZTsgb3RoZXJ3aXNlIGxlYXZlIHVuZGVmaW5lZCB0byBhbGxvd1xuICAvLyBlc2J1aWxkIHRvIHVzZSBgdGFyZ2V0YCB0byBkZXRlcm1pbmUgc3VwcG9ydC5cbiAgaWYgKHNhZmFyaUNsYXNzRmllbGRTY29wZUJ1Zykge1xuICAgIHN1cHBvcnRlZFsnY2xhc3MtZmllbGQnXSA9IGZhbHNlO1xuICAgIHN1cHBvcnRlZFsnY2xhc3Mtc3RhdGljLWZpZWxkJ10gPSBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiBzdXBwb3J0ZWQ7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUdsb2JhbFN0eWxlc0J1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyxcbiAgdGFyZ2V0OiBzdHJpbmdbXSxcbiAgYnJvd3NlcnM6IHN0cmluZ1tdLFxuKTogQnVpbGRPcHRpb25zIHtcbiAgY29uc3Qge1xuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIGdsb2JhbFN0eWxlcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucyxcbiAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IGJ1aWxkT3B0aW9ucyA9IGNyZWF0ZVN0eWxlc2hlZXRCdW5kbGVPcHRpb25zKHtcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG9wdGltaXphdGlvbjogISFvcHRpbWl6YXRpb25PcHRpb25zLnN0eWxlcy5taW5pZnksXG4gICAgc291cmNlbWFwOiAhIXNvdXJjZW1hcE9wdGlvbnMuc3R5bGVzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgdGFyZ2V0LFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIGluY2x1ZGVQYXRoczogc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zPy5pbmNsdWRlUGF0aHMsXG4gICAgYnJvd3NlcnMsXG4gICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICB9KTtcbiAgYnVpbGRPcHRpb25zLmxlZ2FsQ29tbWVudHMgPSBvcHRpb25zLmV4dHJhY3RMaWNlbnNlcyA/ICdub25lJyA6ICdlb2YnO1xuXG4gIGNvbnN0IG5hbWVzcGFjZSA9ICdhbmd1bGFyOnN0eWxlcy9nbG9iYWwnO1xuICBidWlsZE9wdGlvbnMuZW50cnlQb2ludHMgPSB7fTtcbiAgZm9yIChjb25zdCB7IG5hbWUgfSBvZiBnbG9iYWxTdHlsZXMpIHtcbiAgICBidWlsZE9wdGlvbnMuZW50cnlQb2ludHNbbmFtZV0gPSBgJHtuYW1lc3BhY2V9OyR7bmFtZX1gO1xuICB9XG5cbiAgYnVpbGRPcHRpb25zLnBsdWdpbnMudW5zaGlmdCh7XG4gICAgbmFtZTogJ2FuZ3VsYXItZ2xvYmFsLXN0eWxlcycsXG4gICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgIGJ1aWxkLm9uUmVzb2x2ZSh7IGZpbHRlcjogL15hbmd1bGFyOnN0eWxlc1xcL2dsb2JhbDsvIH0sIChhcmdzKSA9PiB7XG4gICAgICAgIGlmIChhcmdzLmtpbmQgIT09ICdlbnRyeS1wb2ludCcpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcGF0aDogYXJncy5wYXRoLnNwbGl0KCc7JywgMilbMV0sXG4gICAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC8uLywgbmFtZXNwYWNlIH0sIChhcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGZpbGVzID0gZ2xvYmFsU3R5bGVzLmZpbmQoKHsgbmFtZSB9KSA9PiBuYW1lID09PSBhcmdzLnBhdGgpPy5maWxlcztcbiAgICAgICAgYXNzZXJ0KGZpbGVzLCBgZ2xvYmFsIHN0eWxlIG5hbWUgc2hvdWxkIGFsd2F5cyBiZSBmb3VuZCBbJHthcmdzLnBhdGh9XWApO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgY29udGVudHM6IGZpbGVzLm1hcCgoZmlsZSkgPT4gYEBpbXBvcnQgJyR7ZmlsZS5yZXBsYWNlKC9cXFxcL2csICcvJyl9JztgKS5qb2luKCdcXG4nKSxcbiAgICAgICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICB9LFxuICB9KTtcblxuICByZXR1cm4gYnVpbGRPcHRpb25zO1xufVxuXG4vKipcbiAqIE1haW4gZXhlY3V0aW9uIGZ1bmN0aW9uIGZvciB0aGUgZXNidWlsZC1iYXNlZCBhcHBsaWNhdGlvbiBidWlsZGVyLlxuICogVGhlIG9wdGlvbnMgYXJlIGNvbXBhdGlibGUgd2l0aCB0aGUgV2VicGFjay1iYXNlZCBidWlsZGVyLlxuICogQHBhcmFtIHVzZXJPcHRpb25zIFRoZSBicm93c2VyIGJ1aWxkZXIgb3B0aW9ucyB0byB1c2Ugd2hlbiBzZXR0aW5nIHVwIHRoZSBhcHBsaWNhdGlvbiBidWlsZFxuICogQHBhcmFtIGNvbnRleHQgVGhlIEFyY2hpdGVjdCBidWlsZGVyIGNvbnRleHQgb2JqZWN0XG4gKiBAcmV0dXJucyBBbiBhc3luYyBpdGVyYWJsZSB3aXRoIHRoZSBidWlsZGVyIHJlc3VsdCBvdXRwdXRcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uKiBidWlsZEVzYnVpbGRCcm93c2VyKFxuICB1c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgaW5mcmFzdHJ1Y3R1cmVTZXR0aW5ncz86IHtcbiAgICB3cml0ZT86IGJvb2xlYW47XG4gIH0sXG4pOiBBc3luY0l0ZXJhYmxlPEJ1aWxkZXJPdXRwdXQgJiB7IG91dHB1dEZpbGVzPzogT3V0cHV0RmlsZVtdIH0+IHtcbiAgLy8gSW5mb3JtIHVzZXIgb2YgZXhwZXJpbWVudGFsIHN0YXR1cyBvZiBidWlsZGVyIGFuZCBvcHRpb25zXG4gIGxvZ0V4cGVyaW1lbnRhbFdhcm5pbmdzKHVzZXJPcHRpb25zLCBjb250ZXh0KTtcblxuICAvLyBEZXRlcm1pbmUgcHJvamVjdCBuYW1lIGZyb20gYnVpbGRlciBjb250ZXh0IHRhcmdldFxuICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0Py5wcm9qZWN0O1xuICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoYFRoZSAnYnJvd3Nlci1lc2J1aWxkJyBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0IHRvIGJlIHNwZWNpZmllZC5gKTtcblxuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IG5vcm1hbGl6ZWRPcHRpb25zID0gYXdhaXQgbm9ybWFsaXplT3B0aW9ucyhjb250ZXh0LCBwcm9qZWN0TmFtZSwgdXNlck9wdGlvbnMpO1xuICAvLyBXcml0aW5nIHRoZSByZXN1bHQgdG8gdGhlIGZpbGVzeXN0ZW0gaXMgdGhlIGRlZmF1bHQgYmVoYXZpb3JcbiAgY29uc3Qgc2hvdWxkV3JpdGVSZXN1bHQgPSBpbmZyYXN0cnVjdHVyZVNldHRpbmdzPy53cml0ZSAhPT0gZmFsc2U7XG5cbiAgaWYgKHNob3VsZFdyaXRlUmVzdWx0KSB7XG4gICAgLy8gQ2xlYW4gb3V0cHV0IHBhdGggaWYgZW5hYmxlZFxuICAgIGlmICh1c2VyT3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoKSB7XG4gICAgICBkZWxldGVPdXRwdXREaXIobm9ybWFsaXplZE9wdGlvbnMud29ya3NwYWNlUm9vdCwgdXNlck9wdGlvbnMub3V0cHV0UGF0aCk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIG91dHB1dCBkaXJlY3RvcnkgaWYgbmVlZGVkXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGZzLm1rZGlyKG5vcm1hbGl6ZWRPcHRpb25zLm91dHB1dFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGFzc2VydElzRXJyb3IoZSk7XG4gICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcignVW5hYmxlIHRvIGNyZWF0ZSBvdXRwdXQgZGlyZWN0b3J5OiAnICsgZS5tZXNzYWdlKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxuXG4gIC8vIEluaXRpYWwgYnVpbGRcbiAgbGV0IHJlc3VsdDogRXhlY3V0aW9uUmVzdWx0O1xuICB0cnkge1xuICAgIHJlc3VsdCA9IGF3YWl0IGV4ZWN1dGUobm9ybWFsaXplZE9wdGlvbnMsIGNvbnRleHQpO1xuXG4gICAgaWYgKHNob3VsZFdyaXRlUmVzdWx0KSB7XG4gICAgICAvLyBXcml0ZSBvdXRwdXQgZmlsZXNcbiAgICAgIGF3YWl0IHdyaXRlUmVzdWx0RmlsZXMocmVzdWx0Lm91dHB1dEZpbGVzLCByZXN1bHQuYXNzZXRGaWxlcywgbm9ybWFsaXplZE9wdGlvbnMub3V0cHV0UGF0aCk7XG5cbiAgICAgIHlpZWxkIHJlc3VsdC5vdXRwdXQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFJlcXVpcmVzIGNhc3RpbmcgZHVlIHRvIHVubmVlZGVkIGBKc29uT2JqZWN0YCByZXF1aXJlbWVudC4gUmVtb3ZlIG9uY2UgZml4ZWQuXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgeWllbGQgcmVzdWx0Lm91dHB1dFdpdGhGaWxlcyBhcyBhbnk7XG4gICAgfVxuXG4gICAgLy8gRmluaXNoIGlmIHdhdGNoIG1vZGUgaXMgbm90IGVuYWJsZWRcbiAgICBpZiAoIXVzZXJPcHRpb25zLndhdGNoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIC8vIEVuc3VyZSBTYXNzIHdvcmtlcnMgYXJlIHNodXRkb3duIGlmIG5vdCB3YXRjaGluZ1xuICAgIGlmICghdXNlck9wdGlvbnMud2F0Y2gpIHtcbiAgICAgIHNodXRkb3duU2Fzc1dvcmtlclBvb2woKTtcbiAgICB9XG4gIH1cblxuICBjb250ZXh0LmxvZ2dlci5pbmZvKCdXYXRjaCBtb2RlIGVuYWJsZWQuIFdhdGNoaW5nIGZvciBmaWxlIGNoYW5nZXMuLi4nKTtcblxuICAvLyBTZXR1cCBhIHdhdGNoZXJcbiAgY29uc3Qgd2F0Y2hlciA9IGNyZWF0ZVdhdGNoZXIoe1xuICAgIHBvbGxpbmc6IHR5cGVvZiB1c2VyT3B0aW9ucy5wb2xsID09PSAnbnVtYmVyJyxcbiAgICBpbnRlcnZhbDogdXNlck9wdGlvbnMucG9sbCxcbiAgICAvLyBJZ25vcmUgdGhlIG91dHB1dCBhbmQgY2FjaGUgcGF0aHMgdG8gYXZvaWQgaW5maW5pdGUgcmVidWlsZCBjeWNsZXNcbiAgICBpZ25vcmVkOiBbbm9ybWFsaXplZE9wdGlvbnMub3V0cHV0UGF0aCwgbm9ybWFsaXplZE9wdGlvbnMuY2FjaGVPcHRpb25zLmJhc2VQYXRoXSxcbiAgfSk7XG5cbiAgLy8gVGVtcG9yYXJpbHkgd2F0Y2ggdGhlIGVudGlyZSBwcm9qZWN0XG4gIHdhdGNoZXIuYWRkKG5vcm1hbGl6ZWRPcHRpb25zLnByb2plY3RSb290KTtcblxuICAvLyBXYXRjaCB3b3Jrc3BhY2Ugcm9vdCBub2RlIG1vZHVsZXNcbiAgLy8gSW5jbHVkZXMgWWFybiBQblAgbWFuaWZlc3QgZmlsZXMgKGh0dHBzOi8veWFybnBrZy5jb20vYWR2YW5jZWQvcG5wLXNwZWMvKVxuICB3YXRjaGVyLmFkZChwYXRoLmpvaW4obm9ybWFsaXplZE9wdGlvbnMud29ya3NwYWNlUm9vdCwgJ25vZGVfbW9kdWxlcycpKTtcbiAgd2F0Y2hlci5hZGQocGF0aC5qb2luKG5vcm1hbGl6ZWRPcHRpb25zLndvcmtzcGFjZVJvb3QsICcucG5wLmNqcycpKTtcbiAgd2F0Y2hlci5hZGQocGF0aC5qb2luKG5vcm1hbGl6ZWRPcHRpb25zLndvcmtzcGFjZVJvb3QsICcucG5wLmRhdGEuanNvbicpKTtcblxuICAvLyBXYWl0IGZvciBjaGFuZ2VzIGFuZCByZWJ1aWxkIGFzIG5lZWRlZFxuICB0cnkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2hhbmdlcyBvZiB3YXRjaGVyKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKCdDaGFuZ2VzIGRldGVjdGVkLiBSZWJ1aWxkaW5nLi4uJyk7XG5cbiAgICAgIGlmICh1c2VyT3B0aW9ucy52ZXJib3NlKSB7XG4gICAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oY2hhbmdlcy50b0RlYnVnU3RyaW5nKCkpO1xuICAgICAgfVxuXG4gICAgICByZXN1bHQgPSBhd2FpdCBleGVjdXRlKG5vcm1hbGl6ZWRPcHRpb25zLCBjb250ZXh0LCByZXN1bHQuY3JlYXRlUmVidWlsZFN0YXRlKGNoYW5nZXMpKTtcblxuICAgICAgaWYgKHNob3VsZFdyaXRlUmVzdWx0KSB7XG4gICAgICAgIC8vIFdyaXRlIG91dHB1dCBmaWxlc1xuICAgICAgICBhd2FpdCB3cml0ZVJlc3VsdEZpbGVzKHJlc3VsdC5vdXRwdXRGaWxlcywgcmVzdWx0LmFzc2V0RmlsZXMsIG5vcm1hbGl6ZWRPcHRpb25zLm91dHB1dFBhdGgpO1xuXG4gICAgICAgIHlpZWxkIHJlc3VsdC5vdXRwdXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBSZXF1aXJlcyBjYXN0aW5nIGR1ZSB0byB1bm5lZWRlZCBgSnNvbk9iamVjdGAgcmVxdWlyZW1lbnQuIFJlbW92ZSBvbmNlIGZpeGVkLlxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgICB5aWVsZCByZXN1bHQub3V0cHV0V2l0aEZpbGVzIGFzIGFueTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZmluYWxseSB7XG4gICAgLy8gU3RvcCB0aGUgd2F0Y2hlclxuICAgIGF3YWl0IHdhdGNoZXIuY2xvc2UoKTtcbiAgICAvLyBDbGVhbnVwIGluY3JlbWVudGFsIHJlYnVpbGQgc3RhdGVcbiAgICBhd2FpdCByZXN1bHQuZGlzcG9zZSgpO1xuICAgIHNodXRkb3duU2Fzc1dvcmtlclBvb2woKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyKGJ1aWxkRXNidWlsZEJyb3dzZXIpO1xuXG5mdW5jdGlvbiBsb2dCdWlsZFN0YXRzKGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LCBtZXRhZmlsZTogTWV0YWZpbGUpIHtcbiAgY29uc3Qgc3RhdHM6IEJ1bmRsZVN0YXRzW10gPSBbXTtcbiAgZm9yIChjb25zdCBbZmlsZSwgb3V0cHV0XSBvZiBPYmplY3QuZW50cmllcyhtZXRhZmlsZS5vdXRwdXRzKSkge1xuICAgIC8vIFNraXAgc291cmNlbWFwc1xuICAgIGlmIChmaWxlLmVuZHNXaXRoKCcubWFwJykpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICAvLyBTa2lwIGludGVybmFsIGNvbXBvbmVudCByZXNvdXJjZXNcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGlmICgob3V0cHV0IGFzIGFueSlbJ25nLWNvbXBvbmVudCddKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBzdGF0cy5wdXNoKHtcbiAgICAgIGluaXRpYWw6ICEhb3V0cHV0LmVudHJ5UG9pbnQsXG4gICAgICBzdGF0czogW2ZpbGUsICcnLCBvdXRwdXQuYnl0ZXMsICcnXSxcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHRhYmxlVGV4dCA9IGdlbmVyYXRlQnVpbGRTdGF0c1RhYmxlKHN0YXRzLCB0cnVlLCB0cnVlLCBmYWxzZSwgdW5kZWZpbmVkKTtcblxuICBjb250ZXh0LmxvZ2dlci5pbmZvKCdcXG4nICsgdGFibGVUZXh0ICsgJ1xcbicpO1xufVxuIl19