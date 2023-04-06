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
const spinner_1 = require("../../utils/spinner");
const supported_browsers_1 = require("../../utils/supported-browsers");
const stats_1 = require("../../webpack/utils/stats");
const commonjs_checker_1 = require("./commonjs-checker");
const compiler_plugin_1 = require("./compiler-plugin");
const esbuild_1 = require("./esbuild");
const experimental_warnings_1 = require("./experimental-warnings");
const global_scripts_1 = require("./global-scripts");
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
    const globalScriptsBundleContext = new esbuild_1.BundlerContext(workspaceRoot, !!options.watch, (0, global_scripts_1.createGlobalScriptsBundleOptions)(options));
    const [codeResults, styleResults, scriptResults] = await Promise.all([
        // Execute esbuild to bundle the application code
        codeBundleContext.bundle(),
        // Execute esbuild to bundle the global stylesheets
        globalStylesBundleContext.bundle(),
        globalScriptsBundleContext.bundle(),
    ]);
    // Log all warnings and errors generated during bundling
    await (0, esbuild_1.logMessages)(context, {
        errors: [
            ...(codeResults.errors || []),
            ...(styleResults.errors || []),
            ...(scriptResults.errors || []),
        ],
        warnings: [...codeResults.warnings, ...styleResults.warnings, ...scriptResults.warnings],
    });
    const executionResult = new ExecutionResult(codeBundleContext, globalStylesBundleContext, codeBundleCache);
    // Return if the bundling has errors
    if (codeResults.errors || styleResults.errors || scriptResults.errors) {
        return executionResult;
    }
    // Filter global stylesheet initial files
    styleResults.initialFiles = styleResults.initialFiles.filter(({ name }) => options.globalStyles.find((style) => style.name === name)?.initial);
    // Combine the bundling output files
    const initialFiles = [
        ...codeResults.initialFiles,
        ...styleResults.initialFiles,
        ...scriptResults.initialFiles,
    ];
    executionResult.outputFiles.push(...codeResults.outputFiles, ...styleResults.outputFiles, ...scriptResults.outputFiles);
    // Combine metafiles used for the stats option as well as bundle budgets and console output
    const metafile = {
        inputs: {
            ...codeResults.metafile?.inputs,
            ...styleResults.metafile?.inputs,
            ...scriptResults.metafile?.inputs,
        },
        outputs: {
            ...codeResults.metafile?.outputs,
            ...styleResults.metafile?.outputs,
            ...scriptResults.metafile?.outputs,
        },
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
async function withSpinner(text, action) {
    const spinner = new spinner_1.Spinner(text);
    spinner.start();
    try {
        return await action();
    }
    finally {
        spinner.stop();
    }
}
async function withNoProgress(test, action) {
    return action();
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
    const withProgress = normalizedOptions.progress
        ? withSpinner
        : withNoProgress;
    // Initial build
    let result;
    try {
        result = await withProgress('Building...', () => execute(normalizedOptions, context));
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
    if (normalizedOptions.progress) {
        context.logger.info('Watch mode enabled. Watching for file changes...');
    }
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
            if (userOptions.verbose) {
                context.logger.info(changes.toDebugString());
            }
            result = await withProgress('Changes detected. Rebuilding...', () => execute(normalizedOptions, context, result.createRebuildState(changes)));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgseURBQXlGO0FBRXpGLDhEQUFpQztBQUNqQyxxQ0FBbUQ7QUFDbkQsZ0VBQWtDO0FBQ2xDLDBEQUE2QjtBQUM3Qix1Q0FBOEM7QUFDOUMseURBQXFEO0FBQ3JELDZDQUFrRDtBQUNsRCxpRUFBa0Y7QUFFbEYsc0ZBQWlGO0FBQ2pGLCtEQUFnRjtBQUNoRixpREFBOEM7QUFDOUMsdUVBQXNFO0FBQ3RFLHFEQUFpRjtBQUNqRix5REFBMEQ7QUFDMUQsdURBQTBFO0FBQzFFLHVDQUF3RDtBQUN4RCxtRUFBa0U7QUFDbEUscURBQW9FO0FBQ3BFLDJEQUFzRDtBQUN0RCx1Q0FBdUU7QUFDdkUsK0NBQXVEO0FBRXZELCtDQUE4RDtBQUM5RCx1Q0FBd0Q7QUFTeEQ7O0dBRUc7QUFDSCxNQUFNLGVBQWU7SUFJbkIsWUFDVSxXQUE0QixFQUM1QixtQkFBb0MsRUFDcEMsZUFBaUM7UUFGakMsZ0JBQVcsR0FBWCxXQUFXLENBQWlCO1FBQzVCLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBaUI7UUFDcEMsb0JBQWUsR0FBZixlQUFlLENBQWtCO1FBTmxDLGdCQUFXLEdBQWlCLEVBQUUsQ0FBQztRQUMvQixlQUFVLEdBQThDLEVBQUUsQ0FBQztJQU1qRSxDQUFDO0lBRUosYUFBYSxDQUFDLElBQVksRUFBRSxPQUFlO1FBQ3pDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFFRCxJQUFJLE1BQU07UUFDUixPQUFPO1lBQ0wsT0FBTyxFQUFF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LENBQUM7UUFDdEIsb0NBQW9DO1FBQ3BDLE1BQU0sTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3ZCLElBQUEsb0NBQXNCLEdBQUUsQ0FBQztLQUMxQjtBQUNILENBQUM7QUE3SEQsa0RBNkhDO0FBRUQsa0JBQWUsSUFBQSx5QkFBYSxFQUFDLG1CQUFtQixDQUFDLENBQUM7QUFFbEQsU0FBUyxhQUFhLENBQUMsT0FBdUIsRUFBRSxRQUFrQjtJQUNoRSxNQUFNLEtBQUssR0FBa0IsRUFBRSxDQUFDO0lBQ2hDLEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUM3RCxrQkFBa0I7UUFDbEIsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3pCLFNBQVM7U0FDVjtRQUNELG9DQUFvQztRQUNwQyw4REFBOEQ7UUFDOUQsSUFBSyxNQUFjLENBQUMsY0FBYyxDQUFDLEVBQUU7WUFDbkMsU0FBUztTQUNWO1FBRUQsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNULE9BQU8sRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLFVBQVU7WUFDNUIsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQztTQUNwQyxDQUFDLENBQUM7S0FDSjtJQUVELE1BQU0sU0FBUyxHQUFHLElBQUEsK0JBQXVCLEVBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBRS9FLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxTQUFTLEdBQUcsSUFBSSxDQUFDLENBQUM7QUFDL0MsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHR5cGUgeyBCdWlsZE9wdGlvbnMsIE1ldGFmaWxlLCBPdXRwdXRGaWxlIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IGNvbnN0YW50cyBhcyBmc0NvbnN0YW50cyB9IGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGRlbGV0ZU91dHB1dERpciB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IGNvcHlBc3NldHMgfSBmcm9tICcuLi8uLi91dGlscy9jb3B5LWFzc2V0cyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMgfSBmcm9tICcuLi8uLi91dGlscy9lc2J1aWxkLXRhcmdldHMnO1xuaW1wb3J0IHsgRmlsZUluZm8gfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2F1Z21lbnQtaW5kZXgtaHRtbCc7XG5pbXBvcnQgeyBJbmRleEh0bWxHZW5lcmF0b3IgfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2luZGV4LWh0bWwtZ2VuZXJhdG9yJztcbmltcG9ydCB7IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlckVzYnVpbGQgfSBmcm9tICcuLi8uLi91dGlscy9zZXJ2aWNlLXdvcmtlcic7XG5pbXBvcnQgeyBTcGlubmVyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lcic7XG5pbXBvcnQgeyBnZXRTdXBwb3J0ZWRCcm93c2VycyB9IGZyb20gJy4uLy4uL3V0aWxzL3N1cHBvcnRlZC1icm93c2Vycyc7XG5pbXBvcnQgeyBCdW5kbGVTdGF0cywgZ2VuZXJhdGVCdWlsZFN0YXRzVGFibGUgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL3N0YXRzJztcbmltcG9ydCB7IGNoZWNrQ29tbW9uSlNNb2R1bGVzIH0gZnJvbSAnLi9jb21tb25qcy1jaGVja2VyJztcbmltcG9ydCB7IFNvdXJjZUZpbGVDYWNoZSwgY3JlYXRlQ29tcGlsZXJQbHVnaW4gfSBmcm9tICcuL2NvbXBpbGVyLXBsdWdpbic7XG5pbXBvcnQgeyBCdW5kbGVyQ29udGV4dCwgbG9nTWVzc2FnZXMgfSBmcm9tICcuL2VzYnVpbGQnO1xuaW1wb3J0IHsgbG9nRXhwZXJpbWVudGFsV2FybmluZ3MgfSBmcm9tICcuL2V4cGVyaW1lbnRhbC13YXJuaW5ncyc7XG5pbXBvcnQgeyBjcmVhdGVHbG9iYWxTY3JpcHRzQnVuZGxlT3B0aW9ucyB9IGZyb20gJy4vZ2xvYmFsLXNjcmlwdHMnO1xuaW1wb3J0IHsgZXh0cmFjdExpY2Vuc2VzIH0gZnJvbSAnLi9saWNlbnNlLWV4dHJhY3Rvcic7XG5pbXBvcnQgeyBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMsIG5vcm1hbGl6ZU9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnO1xuaW1wb3J0IHsgc2h1dGRvd25TYXNzV29ya2VyUG9vbCB9IGZyb20gJy4vc2Fzcy1wbHVnaW4nO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB7IGNyZWF0ZVN0eWxlc2hlZXRCdW5kbGVPcHRpb25zIH0gZnJvbSAnLi9zdHlsZXNoZWV0cyc7XG5pbXBvcnQgeyBDaGFuZ2VkRmlsZXMsIGNyZWF0ZVdhdGNoZXIgfSBmcm9tICcuL3dhdGNoZXInO1xuXG5pbnRlcmZhY2UgUmVidWlsZFN0YXRlIHtcbiAgY29kZVJlYnVpbGQ/OiBCdW5kbGVyQ29udGV4dDtcbiAgZ2xvYmFsU3R5bGVzUmVidWlsZD86IEJ1bmRsZXJDb250ZXh0O1xuICBjb2RlQnVuZGxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGU7XG4gIGZpbGVDaGFuZ2VzOiBDaGFuZ2VkRmlsZXM7XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyB0aGUgcmVzdWx0IG9mIGEgc2luZ2xlIGJ1aWxkZXIgZXhlY3V0ZSBjYWxsLlxuICovXG5jbGFzcyBFeGVjdXRpb25SZXN1bHQge1xuICByZWFkb25seSBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gIHJlYWRvbmx5IGFzc2V0RmlsZXM6IHsgc291cmNlOiBzdHJpbmc7IGRlc3RpbmF0aW9uOiBzdHJpbmcgfVtdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBjb2RlUmVidWlsZD86IEJ1bmRsZXJDb250ZXh0LFxuICAgIHByaXZhdGUgZ2xvYmFsU3R5bGVzUmVidWlsZD86IEJ1bmRsZXJDb250ZXh0LFxuICAgIHByaXZhdGUgY29kZUJ1bmRsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlLFxuICApIHt9XG5cbiAgYWRkT3V0cHV0RmlsZShwYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMub3V0cHV0RmlsZXMucHVzaChjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQocGF0aCwgY29udGVudCkpO1xuICB9XG5cbiAgZ2V0IG91dHB1dCgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdGhpcy5vdXRwdXRGaWxlcy5sZW5ndGggPiAwLFxuICAgIH07XG4gIH1cblxuICBnZXQgb3V0cHV0V2l0aEZpbGVzKCkge1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0aGlzLm91dHB1dEZpbGVzLmxlbmd0aCA+IDAsXG4gICAgICBvdXRwdXRGaWxlczogdGhpcy5vdXRwdXRGaWxlcyxcbiAgICAgIGFzc2V0RmlsZXM6IHRoaXMuYXNzZXRGaWxlcyxcbiAgICB9O1xuICB9XG5cbiAgY3JlYXRlUmVidWlsZFN0YXRlKGZpbGVDaGFuZ2VzOiBDaGFuZ2VkRmlsZXMpOiBSZWJ1aWxkU3RhdGUge1xuICAgIHRoaXMuY29kZUJ1bmRsZUNhY2hlPy5pbnZhbGlkYXRlKFsuLi5maWxlQ2hhbmdlcy5tb2RpZmllZCwgLi4uZmlsZUNoYW5nZXMucmVtb3ZlZF0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvZGVSZWJ1aWxkOiB0aGlzLmNvZGVSZWJ1aWxkLFxuICAgICAgZ2xvYmFsU3R5bGVzUmVidWlsZDogdGhpcy5nbG9iYWxTdHlsZXNSZWJ1aWxkLFxuICAgICAgY29kZUJ1bmRsZUNhY2hlOiB0aGlzLmNvZGVCdW5kbGVDYWNoZSxcbiAgICAgIGZpbGVDaGFuZ2VzLFxuICAgIH07XG4gIH1cblxuICBhc3luYyBkaXNwb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChbdGhpcy5jb2RlUmVidWlsZD8uZGlzcG9zZSgpLCB0aGlzLmdsb2JhbFN0eWxlc1JlYnVpbGQ/LmRpc3Bvc2UoKV0pO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHJlYnVpbGRTdGF0ZT86IFJlYnVpbGRTdGF0ZSxcbik6IFByb21pc2U8RXhlY3V0aW9uUmVzdWx0PiB7XG4gIGNvbnN0IHN0YXJ0VGltZSA9IHByb2Nlc3MuaHJ0aW1lLmJpZ2ludCgpO1xuXG4gIGNvbnN0IHtcbiAgICBwcm9qZWN0Um9vdCxcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgYXNzZXRzLFxuICAgIHNlcnZpY2VXb3JrZXJPcHRpb25zLFxuICAgIGluZGV4SHRtbE9wdGlvbnMsXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IGJyb3dzZXJzID0gZ2V0U3VwcG9ydGVkQnJvd3NlcnMocHJvamVjdFJvb3QsIGNvbnRleHQubG9nZ2VyKTtcbiAgY29uc3QgdGFyZ2V0ID0gdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMoYnJvd3NlcnMpO1xuXG4gIC8vIFJldXNlIHJlYnVpbGQgc3RhdGUgb3IgY3JlYXRlIG5ldyBidW5kbGUgY29udGV4dHMgZm9yIGNvZGUgYW5kIGdsb2JhbCBzdHlsZXNoZWV0c1xuICBjb25zdCBjb2RlQnVuZGxlQ2FjaGUgPSBvcHRpb25zLndhdGNoXG4gICAgPyByZWJ1aWxkU3RhdGU/LmNvZGVCdW5kbGVDYWNoZSA/PyBuZXcgU291cmNlRmlsZUNhY2hlKClcbiAgICA6IHVuZGVmaW5lZDtcbiAgY29uc3QgY29kZUJ1bmRsZUNvbnRleHQgPVxuICAgIHJlYnVpbGRTdGF0ZT8uY29kZVJlYnVpbGQgPz9cbiAgICBuZXcgQnVuZGxlckNvbnRleHQoXG4gICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgISFvcHRpb25zLndhdGNoLFxuICAgICAgY3JlYXRlQ29kZUJ1bmRsZU9wdGlvbnMob3B0aW9ucywgdGFyZ2V0LCBicm93c2VycywgY29kZUJ1bmRsZUNhY2hlKSxcbiAgICApO1xuICBjb25zdCBnbG9iYWxTdHlsZXNCdW5kbGVDb250ZXh0ID1cbiAgICByZWJ1aWxkU3RhdGU/Lmdsb2JhbFN0eWxlc1JlYnVpbGQgPz9cbiAgICBuZXcgQnVuZGxlckNvbnRleHQoXG4gICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgISFvcHRpb25zLndhdGNoLFxuICAgICAgY3JlYXRlR2xvYmFsU3R5bGVzQnVuZGxlT3B0aW9ucyhvcHRpb25zLCB0YXJnZXQsIGJyb3dzZXJzKSxcbiAgICApO1xuXG4gIGNvbnN0IGdsb2JhbFNjcmlwdHNCdW5kbGVDb250ZXh0ID0gbmV3IEJ1bmRsZXJDb250ZXh0KFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgISFvcHRpb25zLndhdGNoLFxuICAgIGNyZWF0ZUdsb2JhbFNjcmlwdHNCdW5kbGVPcHRpb25zKG9wdGlvbnMpLFxuICApO1xuXG4gIGNvbnN0IFtjb2RlUmVzdWx0cywgc3R5bGVSZXN1bHRzLCBzY3JpcHRSZXN1bHRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAvLyBFeGVjdXRlIGVzYnVpbGQgdG8gYnVuZGxlIHRoZSBhcHBsaWNhdGlvbiBjb2RlXG4gICAgY29kZUJ1bmRsZUNvbnRleHQuYnVuZGxlKCksXG4gICAgLy8gRXhlY3V0ZSBlc2J1aWxkIHRvIGJ1bmRsZSB0aGUgZ2xvYmFsIHN0eWxlc2hlZXRzXG4gICAgZ2xvYmFsU3R5bGVzQnVuZGxlQ29udGV4dC5idW5kbGUoKSxcbiAgICBnbG9iYWxTY3JpcHRzQnVuZGxlQ29udGV4dC5idW5kbGUoKSxcbiAgXSk7XG5cbiAgLy8gTG9nIGFsbCB3YXJuaW5ncyBhbmQgZXJyb3JzIGdlbmVyYXRlZCBkdXJpbmcgYnVuZGxpbmdcbiAgYXdhaXQgbG9nTWVzc2FnZXMoY29udGV4dCwge1xuICAgIGVycm9yczogW1xuICAgICAgLi4uKGNvZGVSZXN1bHRzLmVycm9ycyB8fCBbXSksXG4gICAgICAuLi4oc3R5bGVSZXN1bHRzLmVycm9ycyB8fCBbXSksXG4gICAgICAuLi4oc2NyaXB0UmVzdWx0cy5lcnJvcnMgfHwgW10pLFxuICAgIF0sXG4gICAgd2FybmluZ3M6IFsuLi5jb2RlUmVzdWx0cy53YXJuaW5ncywgLi4uc3R5bGVSZXN1bHRzLndhcm5pbmdzLCAuLi5zY3JpcHRSZXN1bHRzLndhcm5pbmdzXSxcbiAgfSk7XG5cbiAgY29uc3QgZXhlY3V0aW9uUmVzdWx0ID0gbmV3IEV4ZWN1dGlvblJlc3VsdChcbiAgICBjb2RlQnVuZGxlQ29udGV4dCxcbiAgICBnbG9iYWxTdHlsZXNCdW5kbGVDb250ZXh0LFxuICAgIGNvZGVCdW5kbGVDYWNoZSxcbiAgKTtcblxuICAvLyBSZXR1cm4gaWYgdGhlIGJ1bmRsaW5nIGhhcyBlcnJvcnNcbiAgaWYgKGNvZGVSZXN1bHRzLmVycm9ycyB8fCBzdHlsZVJlc3VsdHMuZXJyb3JzIHx8IHNjcmlwdFJlc3VsdHMuZXJyb3JzKSB7XG4gICAgcmV0dXJuIGV4ZWN1dGlvblJlc3VsdDtcbiAgfVxuXG4gIC8vIEZpbHRlciBnbG9iYWwgc3R5bGVzaGVldCBpbml0aWFsIGZpbGVzXG4gIHN0eWxlUmVzdWx0cy5pbml0aWFsRmlsZXMgPSBzdHlsZVJlc3VsdHMuaW5pdGlhbEZpbGVzLmZpbHRlcihcbiAgICAoeyBuYW1lIH0pID0+IG9wdGlvbnMuZ2xvYmFsU3R5bGVzLmZpbmQoKHN0eWxlKSA9PiBzdHlsZS5uYW1lID09PSBuYW1lKT8uaW5pdGlhbCxcbiAgKTtcblxuICAvLyBDb21iaW5lIHRoZSBidW5kbGluZyBvdXRwdXQgZmlsZXNcbiAgY29uc3QgaW5pdGlhbEZpbGVzOiBGaWxlSW5mb1tdID0gW1xuICAgIC4uLmNvZGVSZXN1bHRzLmluaXRpYWxGaWxlcyxcbiAgICAuLi5zdHlsZVJlc3VsdHMuaW5pdGlhbEZpbGVzLFxuICAgIC4uLnNjcmlwdFJlc3VsdHMuaW5pdGlhbEZpbGVzLFxuICBdO1xuICBleGVjdXRpb25SZXN1bHQub3V0cHV0RmlsZXMucHVzaChcbiAgICAuLi5jb2RlUmVzdWx0cy5vdXRwdXRGaWxlcyxcbiAgICAuLi5zdHlsZVJlc3VsdHMub3V0cHV0RmlsZXMsXG4gICAgLi4uc2NyaXB0UmVzdWx0cy5vdXRwdXRGaWxlcyxcbiAgKTtcblxuICAvLyBDb21iaW5lIG1ldGFmaWxlcyB1c2VkIGZvciB0aGUgc3RhdHMgb3B0aW9uIGFzIHdlbGwgYXMgYnVuZGxlIGJ1ZGdldHMgYW5kIGNvbnNvbGUgb3V0cHV0XG4gIGNvbnN0IG1ldGFmaWxlID0ge1xuICAgIGlucHV0czoge1xuICAgICAgLi4uY29kZVJlc3VsdHMubWV0YWZpbGU/LmlucHV0cyxcbiAgICAgIC4uLnN0eWxlUmVzdWx0cy5tZXRhZmlsZT8uaW5wdXRzLFxuICAgICAgLi4uc2NyaXB0UmVzdWx0cy5tZXRhZmlsZT8uaW5wdXRzLFxuICAgIH0sXG4gICAgb3V0cHV0czoge1xuICAgICAgLi4uY29kZVJlc3VsdHMubWV0YWZpbGU/Lm91dHB1dHMsXG4gICAgICAuLi5zdHlsZVJlc3VsdHMubWV0YWZpbGU/Lm91dHB1dHMsXG4gICAgICAuLi5zY3JpcHRSZXN1bHRzLm1ldGFmaWxlPy5vdXRwdXRzLFxuICAgIH0sXG4gIH07XG5cbiAgLy8gQ2hlY2sgbWV0YWZpbGUgZm9yIENvbW1vbkpTIG1vZHVsZSB1c2FnZSBpZiBvcHRpbWl6aW5nIHNjcmlwdHNcbiAgaWYgKG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cykge1xuICAgIGNvbnN0IG1lc3NhZ2VzID0gY2hlY2tDb21tb25KU01vZHVsZXMobWV0YWZpbGUsIG9wdGlvbnMuYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzKTtcbiAgICBhd2FpdCBsb2dNZXNzYWdlcyhjb250ZXh0LCB7IHdhcm5pbmdzOiBtZXNzYWdlcyB9KTtcbiAgfVxuXG4gIC8vIEdlbmVyYXRlIGluZGV4IEhUTUwgZmlsZVxuICBpZiAoaW5kZXhIdG1sT3B0aW9ucykge1xuICAgIC8vIENyZWF0ZSBhbiBpbmRleCBIVE1MIGdlbmVyYXRvciB0aGF0IHJlYWRzIGZyb20gdGhlIGluLW1lbW9yeSBvdXRwdXQgZmlsZXNcbiAgICBjb25zdCBpbmRleEh0bWxHZW5lcmF0b3IgPSBuZXcgSW5kZXhIdG1sR2VuZXJhdG9yKHtcbiAgICAgIGluZGV4UGF0aDogaW5kZXhIdG1sT3B0aW9ucy5pbnB1dCxcbiAgICAgIGVudHJ5cG9pbnRzOiBpbmRleEh0bWxPcHRpb25zLmluc2VydGlvbk9yZGVyLFxuICAgICAgc3JpOiBvcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgICAgb3B0aW1pemF0aW9uOiBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgICAgY3Jvc3NPcmlnaW46IG9wdGlvbnMuY3Jvc3NPcmlnaW4sXG4gICAgfSk7XG5cbiAgICAvKiogVmlydHVhbCBvdXRwdXQgcGF0aCB0byBzdXBwb3J0IHJlYWRpbmcgaW4tbWVtb3J5IGZpbGVzLiAqL1xuICAgIGNvbnN0IHZpcnR1YWxPdXRwdXRQYXRoID0gJy8nO1xuICAgIGluZGV4SHRtbEdlbmVyYXRvci5yZWFkQXNzZXQgPSBhc3luYyBmdW5jdGlvbiAoZmlsZVBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgICAvLyBSZW1vdmUgbGVhZGluZyBkaXJlY3Rvcnkgc2VwYXJhdG9yXG4gICAgICBjb25zdCByZWxhdGl2ZWZpbGVQYXRoID0gcGF0aC5yZWxhdGl2ZSh2aXJ0dWFsT3V0cHV0UGF0aCwgZmlsZVBhdGgpO1xuICAgICAgY29uc3QgZmlsZSA9IGV4ZWN1dGlvblJlc3VsdC5vdXRwdXRGaWxlcy5maW5kKChmaWxlKSA9PiBmaWxlLnBhdGggPT09IHJlbGF0aXZlZmlsZVBhdGgpO1xuICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgcmV0dXJuIGZpbGUudGV4dDtcbiAgICAgIH1cblxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBPdXRwdXQgZmlsZSBkb2VzIG5vdCBleGlzdDogJHtwYXRofWApO1xuICAgIH07XG5cbiAgICBjb25zdCB7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IGluZGV4SHRtbEdlbmVyYXRvci5wcm9jZXNzKHtcbiAgICAgIGJhc2VIcmVmOiBvcHRpb25zLmJhc2VIcmVmLFxuICAgICAgbGFuZzogdW5kZWZpbmVkLFxuICAgICAgb3V0cHV0UGF0aDogdmlydHVhbE91dHB1dFBhdGgsXG4gICAgICBmaWxlczogaW5pdGlhbEZpbGVzLFxuICAgIH0pO1xuXG4gICAgZm9yIChjb25zdCBlcnJvciBvZiBlcnJvcnMpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB3YXJuaW5nIG9mIHdhcm5pbmdzKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci53YXJuKHdhcm5pbmcpO1xuICAgIH1cblxuICAgIGV4ZWN1dGlvblJlc3VsdC5hZGRPdXRwdXRGaWxlKGluZGV4SHRtbE9wdGlvbnMub3V0cHV0LCBjb250ZW50KTtcbiAgfVxuXG4gIC8vIENvcHkgYXNzZXRzXG4gIGlmIChhc3NldHMpIHtcbiAgICAvLyBUaGUgd2VicGFjayBjb3B5IGFzc2V0cyBoZWxwZXIgaXMgdXNlZCB3aXRoIG5vIGJhc2UgcGF0aHMgZGVmaW5lZC4gVGhpcyBwcmV2ZW50cyB0aGUgaGVscGVyXG4gICAgLy8gZnJvbSBkaXJlY3RseSB3cml0aW5nIHRvIGRpc2suIFRoaXMgc2hvdWxkIGV2ZW50dWFsbHkgYmUgcmVwbGFjZWQgd2l0aCBhIG1vcmUgb3B0aW1pemVkIGhlbHBlci5cbiAgICBleGVjdXRpb25SZXN1bHQuYXNzZXRGaWxlcy5wdXNoKC4uLihhd2FpdCBjb3B5QXNzZXRzKGFzc2V0cywgW10sIHdvcmtzcGFjZVJvb3QpKSk7XG4gIH1cblxuICAvLyBXcml0ZSBtZXRhZmlsZSBpZiBzdGF0cyBvcHRpb24gaXMgZW5hYmxlZFxuICBpZiAob3B0aW9ucy5zdGF0cykge1xuICAgIGV4ZWN1dGlvblJlc3VsdC5hZGRPdXRwdXRGaWxlKCdzdGF0cy5qc29uJywgSlNPTi5zdHJpbmdpZnkobWV0YWZpbGUsIG51bGwsIDIpKTtcbiAgfVxuXG4gIC8vIEV4dHJhY3QgYW5kIHdyaXRlIGxpY2Vuc2VzIGZvciB1c2VkIHBhY2thZ2VzXG4gIGlmIChvcHRpb25zLmV4dHJhY3RMaWNlbnNlcykge1xuICAgIGV4ZWN1dGlvblJlc3VsdC5hZGRPdXRwdXRGaWxlKFxuICAgICAgJzNyZHBhcnR5bGljZW5zZXMudHh0JyxcbiAgICAgIGF3YWl0IGV4dHJhY3RMaWNlbnNlcyhtZXRhZmlsZSwgd29ya3NwYWNlUm9vdCksXG4gICAgKTtcbiAgfVxuXG4gIC8vIEF1Z21lbnQgdGhlIGFwcGxpY2F0aW9uIHdpdGggc2VydmljZSB3b3JrZXIgc3VwcG9ydFxuICBpZiAoc2VydmljZVdvcmtlck9wdGlvbnMpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2VydmljZVdvcmtlclJlc3VsdCA9IGF3YWl0IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlckVzYnVpbGQoXG4gICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIHNlcnZpY2VXb3JrZXJPcHRpb25zLFxuICAgICAgICBvcHRpb25zLmJhc2VIcmVmIHx8ICcvJyxcbiAgICAgICAgZXhlY3V0aW9uUmVzdWx0Lm91dHB1dEZpbGVzLFxuICAgICAgICBleGVjdXRpb25SZXN1bHQuYXNzZXRGaWxlcyxcbiAgICAgICk7XG4gICAgICBleGVjdXRpb25SZXN1bHQuYWRkT3V0cHV0RmlsZSgnbmdzdy5qc29uJywgc2VydmljZVdvcmtlclJlc3VsdC5tYW5pZmVzdCk7XG4gICAgICBleGVjdXRpb25SZXN1bHQuYXNzZXRGaWxlcy5wdXNoKC4uLnNlcnZpY2VXb3JrZXJSZXN1bHQuYXNzZXRGaWxlcyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogYCR7ZXJyb3J9YCk7XG5cbiAgICAgIHJldHVybiBleGVjdXRpb25SZXN1bHQ7XG4gICAgfVxuICB9XG5cbiAgbG9nQnVpbGRTdGF0cyhjb250ZXh0LCBtZXRhZmlsZSk7XG5cbiAgY29uc3QgYnVpbGRUaW1lID0gTnVtYmVyKHByb2Nlc3MuaHJ0aW1lLmJpZ2ludCgpIC0gc3RhcnRUaW1lKSAvIDEwICoqIDk7XG4gIGNvbnRleHQubG9nZ2VyLmluZm8oYENvbXBsZXRlLiBbJHtidWlsZFRpbWUudG9GaXhlZCgzKX0gc2Vjb25kc11gKTtcblxuICByZXR1cm4gZXhlY3V0aW9uUmVzdWx0O1xufVxuXG5hc3luYyBmdW5jdGlvbiB3cml0ZVJlc3VsdEZpbGVzKFxuICBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdLFxuICBhc3NldEZpbGVzOiB7IHNvdXJjZTogc3RyaW5nOyBkZXN0aW5hdGlvbjogc3RyaW5nIH1bXSB8IHVuZGVmaW5lZCxcbiAgb3V0cHV0UGF0aDogc3RyaW5nLFxuKSB7XG4gIGNvbnN0IGRpcmVjdG9yeUV4aXN0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICBvdXRwdXRGaWxlcy5tYXAoYXN5bmMgKGZpbGUpID0+IHtcbiAgICAgIC8vIEVuc3VyZSBvdXRwdXQgc3ViZGlyZWN0b3JpZXMgZXhpc3RcbiAgICAgIGNvbnN0IGJhc2VQYXRoID0gcGF0aC5kaXJuYW1lKGZpbGUucGF0aCk7XG4gICAgICBpZiAoYmFzZVBhdGggJiYgIWRpcmVjdG9yeUV4aXN0cy5oYXMoYmFzZVBhdGgpKSB7XG4gICAgICAgIGF3YWl0IGZzLm1rZGlyKHBhdGguam9pbihvdXRwdXRQYXRoLCBiYXNlUGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICBkaXJlY3RvcnlFeGlzdHMuYWRkKGJhc2VQYXRoKTtcbiAgICAgIH1cbiAgICAgIC8vIFdyaXRlIGZpbGUgY29udGVudHNcbiAgICAgIGF3YWl0IGZzLndyaXRlRmlsZShwYXRoLmpvaW4ob3V0cHV0UGF0aCwgZmlsZS5wYXRoKSwgZmlsZS5jb250ZW50cyk7XG4gICAgfSksXG4gICk7XG5cbiAgaWYgKGFzc2V0RmlsZXM/Lmxlbmd0aCkge1xuICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgYXNzZXRGaWxlcy5tYXAoYXN5bmMgKHsgc291cmNlLCBkZXN0aW5hdGlvbiB9KSA9PiB7XG4gICAgICAgIC8vIEVuc3VyZSBvdXRwdXQgc3ViZGlyZWN0b3JpZXMgZXhpc3RcbiAgICAgICAgY29uc3QgYmFzZVBhdGggPSBwYXRoLmRpcm5hbWUoZGVzdGluYXRpb24pO1xuICAgICAgICBpZiAoYmFzZVBhdGggJiYgIWRpcmVjdG9yeUV4aXN0cy5oYXMoYmFzZVBhdGgpKSB7XG4gICAgICAgICAgYXdhaXQgZnMubWtkaXIocGF0aC5qb2luKG91dHB1dFBhdGgsIGJhc2VQYXRoKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgZGlyZWN0b3J5RXhpc3RzLmFkZChiYXNlUGF0aCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ29weSBmaWxlIGNvbnRlbnRzXG4gICAgICAgIGF3YWl0IGZzLmNvcHlGaWxlKFxuICAgICAgICAgIHNvdXJjZSxcbiAgICAgICAgICBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgZGVzdGluYXRpb24pLFxuICAgICAgICAgIC8vIFRoaXMgaXMgbm90IHlldCBhdmFpbGFibGUgZnJvbSBgZnMvcHJvbWlzZXNgIGluIE5vZGUuanMgdjE2LjEzXG4gICAgICAgICAgZnNDb25zdGFudHMuQ09QWUZJTEVfRklDTE9ORSxcbiAgICAgICAgKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHBhdGg6IHN0cmluZywgdGV4dDogc3RyaW5nKTogT3V0cHV0RmlsZSB7XG4gIHJldHVybiB7XG4gICAgcGF0aCxcbiAgICB0ZXh0LFxuICAgIGdldCBjb250ZW50cygpIHtcbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbSh0aGlzLnRleHQsICd1dGYtOCcpO1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvZGVCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIGJyb3dzZXJzOiBzdHJpbmdbXSxcbiAgc291cmNlRmlsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlLFxuKTogQnVpbGRPcHRpb25zIHtcbiAgY29uc3Qge1xuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgZW50cnlQb2ludHMsXG4gICAgcG9seWZpbGxzLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB0c2NvbmZpZyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLFxuICAgIGFkdmFuY2VkT3B0aW1pemF0aW9ucyxcbiAgICBpbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgIGppdCxcbiAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IGJ1aWxkT3B0aW9uczogQnVpbGRPcHRpb25zID0ge1xuICAgIGFic1dvcmtpbmdEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgYnVuZGxlOiB0cnVlLFxuICAgIGZvcm1hdDogJ2VzbScsXG4gICAgZW50cnlQb2ludHMsXG4gICAgZW50cnlOYW1lczogb3V0cHV0TmFtZXMuYnVuZGxlcyxcbiAgICBhc3NldE5hbWVzOiBvdXRwdXROYW1lcy5tZWRpYSxcbiAgICB0YXJnZXQsXG4gICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICBjb25kaXRpb25zOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnbW9kdWxlJ10sXG4gICAgcmVzb2x2ZUV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBsZWdhbENvbW1lbnRzOiBvcHRpb25zLmV4dHJhY3RMaWNlbnNlcyA/ICdub25lJyA6ICdlb2YnLFxuICAgIGxvZ0xldmVsOiBvcHRpb25zLnZlcmJvc2UgPyAnZGVidWcnIDogJ3NpbGVudCcsXG4gICAgbWluaWZ5OiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgcHVyZTogWydmb3J3YXJkUmVmJ10sXG4gICAgb3V0ZGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIHNvdXJjZW1hcDogc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICBzcGxpdHRpbmc6IHRydWUsXG4gICAgdHNjb25maWcsXG4gICAgZXh0ZXJuYWw6IGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gICAgICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICAgICAge1xuICAgICAgICAgIHNvdXJjZW1hcDogISFzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMsXG4gICAgICAgICAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM6IHNvdXJjZW1hcE9wdGlvbnMudmVuZG9yLFxuICAgICAgICAgIHRzY29uZmlnLFxuICAgICAgICAgIGppdCxcbiAgICAgICAgICBhZHZhbmNlZE9wdGltaXphdGlvbnMsXG4gICAgICAgICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICAgICAgICBzb3VyY2VGaWxlQ2FjaGUsXG4gICAgICAgIH0sXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAge1xuICAgICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgb3B0aW1pemF0aW9uOiAhIW9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLm1pbmlmeSxcbiAgICAgICAgICBzb3VyY2VtYXA6XG4gICAgICAgICAgICAvLyBIaWRkZW4gY29tcG9uZW50IHN0eWxlc2hlZXQgc291cmNlbWFwcyBhcmUgaW5hY2Nlc3NpYmxlIHdoaWNoIGlzIGVmZmVjdGl2ZWx5XG4gICAgICAgICAgICAvLyB0aGUgc2FtZSBhcyBiZWluZyBkaXNhYmxlZC4gRGlzYWJsaW5nIGhhcyB0aGUgYWR2YW50YWdlIG9mIGF2b2lkaW5nIHRoZSBvdmVyaGVhZFxuICAgICAgICAgICAgLy8gb2Ygc291cmNlbWFwIHByb2Nlc3NpbmcuXG4gICAgICAgICAgICAhIXNvdXJjZW1hcE9wdGlvbnMuc3R5bGVzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/IGZhbHNlIDogJ2lubGluZScpLFxuICAgICAgICAgIG91dHB1dE5hbWVzLFxuICAgICAgICAgIGluY2x1ZGVQYXRoczogc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zPy5pbmNsdWRlUGF0aHMsXG4gICAgICAgICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgICAgICAgYnJvd3NlcnMsXG4gICAgICAgICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICAgICAgICB9LFxuICAgICAgKSxcbiAgICBdLFxuICAgIGRlZmluZToge1xuICAgICAgLy8gT25seSBzZXQgdG8gZmFsc2Ugd2hlbiBzY3JpcHQgb3B0aW1pemF0aW9ucyBhcmUgZW5hYmxlZC4gSXQgc2hvdWxkIG5vdCBiZSBzZXQgdG8gdHJ1ZSBiZWNhdXNlXG4gICAgICAvLyBBbmd1bGFyIHR1cm5zIGBuZ0Rldk1vZGVgIGludG8gYW4gb2JqZWN0IGZvciBkZXZlbG9wbWVudCBkZWJ1Z2dpbmcgcHVycG9zZXMgd2hlbiBub3QgZGVmaW5lZFxuICAgICAgLy8gd2hpY2ggYSBjb25zdGFudCB0cnVlIHZhbHVlIHdvdWxkIGJyZWFrLlxuICAgICAgLi4uKG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyA/IHsgJ25nRGV2TW9kZSc6ICdmYWxzZScgfSA6IHVuZGVmaW5lZCksXG4gICAgICAnbmdKaXRNb2RlJzogaml0ID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICB9LFxuICB9O1xuXG4gIGlmIChwb2x5ZmlsbHM/Lmxlbmd0aCkge1xuICAgIGNvbnN0IG5hbWVzcGFjZSA9ICdhbmd1bGFyOnBvbHlmaWxscyc7XG4gICAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0ge1xuICAgICAgLi4uYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzLFxuICAgICAgWydwb2x5ZmlsbHMnXTogbmFtZXNwYWNlLFxuICAgIH07XG5cbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucz8udW5zaGlmdCh7XG4gICAgICBuYW1lOiAnYW5ndWxhci1wb2x5ZmlsbHMnLFxuICAgICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgICAgYnVpbGQub25SZXNvbHZlKHsgZmlsdGVyOiAvXmFuZ3VsYXI6cG9seWZpbGxzJC8gfSwgKGFyZ3MpID0+IHtcbiAgICAgICAgICBpZiAoYXJncy5raW5kICE9PSAnZW50cnktcG9pbnQnKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGF0aDogJ2VudHJ5JyxcbiAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZSB9LCAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNvbnRlbnRzOiBwb2x5ZmlsbHMubWFwKChmaWxlKSA9PiBgaW1wb3J0ICcke2ZpbGUucmVwbGFjZSgvXFxcXC9nLCAnLycpfSc7YCkuam9pbignXFxuJyksXG4gICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBidWlsZE9wdGlvbnM7XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgc3ludGF4IGZlYXR1cmUgb2JqZWN0IG1hcCBmb3IgQW5ndWxhciBhcHBsaWNhdGlvbnMgYmFzZWQgb24gYSBsaXN0IG9mIHRhcmdldHMuXG4gKiBBIGZ1bGwgc2V0IG9mIGZlYXR1cmUgbmFtZXMgY2FuIGJlIGZvdW5kIGhlcmU6IGh0dHBzOi8vZXNidWlsZC5naXRodWIuaW8vYXBpLyNzdXBwb3J0ZWRcbiAqIEBwYXJhbSB0YXJnZXQgQW4gYXJyYXkgb2YgYnJvd3Nlci9lbmdpbmUgdGFyZ2V0cyBpbiB0aGUgZm9ybWF0IGFjY2VwdGVkIGJ5IHRoZSBlc2J1aWxkIGB0YXJnZXRgIG9wdGlvbi5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkIHdpdGggdGhlIGVzYnVpbGQgYnVpbGQgYHN1cHBvcnRlZGAgb3B0aW9uLlxuICovXG5mdW5jdGlvbiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQ6IHN0cmluZ1tdKTogQnVpbGRPcHRpb25zWydzdXBwb3J0ZWQnXSB7XG4gIGNvbnN0IHN1cHBvcnRlZDogUmVjb3JkPHN0cmluZywgYm9vbGVhbj4gPSB7XG4gICAgLy8gTmF0aXZlIGFzeW5jL2F3YWl0IGlzIG5vdCBzdXBwb3J0ZWQgd2l0aCBab25lLmpzLiBEaXNhYmxpbmcgc3VwcG9ydCBoZXJlIHdpbGwgY2F1c2VcbiAgICAvLyBlc2J1aWxkIHRvIGRvd25sZXZlbCBhc3luYy9hd2FpdCBhbmQgZm9yIGF3YWl0Li4ub2YgdG8gYSBab25lLmpzIHN1cHBvcnRlZCBmb3JtLiBIb3dldmVyLCBlc2J1aWxkXG4gICAgLy8gZG9lcyBub3QgY3VycmVudGx5IHN1cHBvcnQgZG93bmxldmVsaW5nIGFzeW5jIGdlbmVyYXRvcnMuIEluc3RlYWQgYmFiZWwgaXMgdXNlZCB3aXRoaW4gdGhlIEpTL1RTXG4gICAgLy8gbG9hZGVyIHRvIHBlcmZvcm0gdGhlIGRvd25sZXZlbCB0cmFuc2Zvcm1hdGlvbi5cbiAgICAvLyBOT1RFOiBJZiBlc2J1aWxkIGFkZHMgc3VwcG9ydCBpbiB0aGUgZnV0dXJlLCB0aGUgYmFiZWwgc3VwcG9ydCBmb3IgYXN5bmMgZ2VuZXJhdG9ycyBjYW4gYmUgZGlzYWJsZWQuXG4gICAgJ2FzeW5jLWF3YWl0JzogZmFsc2UsXG4gICAgLy8gVjggY3VycmVudGx5IGhhcyBhIHBlcmZvcm1hbmNlIGRlZmVjdCBpbnZvbHZpbmcgb2JqZWN0IHNwcmVhZCBvcGVyYXRpb25zIHRoYXQgY2FuIGNhdXNlIHNpZ25maWNhbnRcbiAgICAvLyBkZWdyYWRhdGlvbiBpbiBydW50aW1lIHBlcmZvcm1hbmNlLiBCeSBub3Qgc3VwcG9ydGluZyB0aGUgbGFuZ3VhZ2UgZmVhdHVyZSBoZXJlLCBhIGRvd25sZXZlbCBmb3JtXG4gICAgLy8gd2lsbCBiZSB1c2VkIGluc3RlYWQgd2hpY2ggcHJvdmlkZXMgYSB3b3JrYXJvdW5kIGZvciB0aGUgcGVyZm9ybWFuY2UgaXNzdWUuXG4gICAgLy8gRm9yIG1vcmUgZGV0YWlsczogaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MTE1MzZcbiAgICAnb2JqZWN0LXJlc3Qtc3ByZWFkJzogZmFsc2UsXG4gIH07XG5cbiAgLy8gRGV0ZWN0IFNhZmFyaSBicm93c2VyIHZlcnNpb25zIHRoYXQgaGF2ZSBhIGNsYXNzIGZpZWxkIGJlaGF2aW9yIGJ1Z1xuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNDM1NSNpc3N1ZWNvbW1lbnQtMTMzMzQ3NzAzM1xuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9XZWJLaXQvV2ViS2l0L2NvbW1pdC9lODc4OGEzNGIzZDVmNWI0ZWRkN2ZmNjQ1MGI4MDkzNmJmZjM5NmYyXG4gIGxldCBzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcgPSBmYWxzZTtcbiAgZm9yIChjb25zdCBicm93c2VyIG9mIHRhcmdldCkge1xuICAgIGxldCBtYWpvclZlcnNpb247XG4gICAgaWYgKGJyb3dzZXIuc3RhcnRzV2l0aCgnaW9zJykpIHtcbiAgICAgIG1ham9yVmVyc2lvbiA9IE51bWJlcihicm93c2VyLnNsaWNlKDMsIDUpKTtcbiAgICB9IGVsc2UgaWYgKGJyb3dzZXIuc3RhcnRzV2l0aCgnc2FmYXJpJykpIHtcbiAgICAgIG1ham9yVmVyc2lvbiA9IE51bWJlcihicm93c2VyLnNsaWNlKDYsIDgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIC8vIFRlY2huaWNhbGx5LCAxNC4wIGlzIG5vdCBicm9rZW4gYnV0IHJhdGhlciBkb2VzIG5vdCBoYXZlIHN1cHBvcnQuIEhvd2V2ZXIsIHRoZSBiZWhhdmlvclxuICAgIC8vIGlzIGlkZW50aWNhbCBzaW5jZSBpdCB3b3VsZCBiZSBzZXQgdG8gZmFsc2UgYnkgZXNidWlsZCBpZiBwcmVzZW50IGFzIGEgdGFyZ2V0LlxuICAgIGlmIChtYWpvclZlcnNpb24gPT09IDE0IHx8IG1ham9yVmVyc2lvbiA9PT0gMTUpIHtcbiAgICAgIHNhZmFyaUNsYXNzRmllbGRTY29wZUJ1ZyA9IHRydWU7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgLy8gSWYgY2xhc3MgZmllbGQgc3VwcG9ydCBjYW5ub3QgYmUgdXNlZCBzZXQgdG8gZmFsc2U7IG90aGVyd2lzZSBsZWF2ZSB1bmRlZmluZWQgdG8gYWxsb3dcbiAgLy8gZXNidWlsZCB0byB1c2UgYHRhcmdldGAgdG8gZGV0ZXJtaW5lIHN1cHBvcnQuXG4gIGlmIChzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcpIHtcbiAgICBzdXBwb3J0ZWRbJ2NsYXNzLWZpZWxkJ10gPSBmYWxzZTtcbiAgICBzdXBwb3J0ZWRbJ2NsYXNzLXN0YXRpYy1maWVsZCddID0gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gc3VwcG9ydGVkO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVHbG9iYWxTdHlsZXNCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIGJyb3dzZXJzOiBzdHJpbmdbXSxcbik6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHtcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBnbG9iYWxTdHlsZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICB9ID0gb3B0aW9ucztcblxuICBjb25zdCBidWlsZE9wdGlvbnMgPSBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyh7XG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBvcHRpbWl6YXRpb246ICEhb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMubWluaWZ5LFxuICAgIHNvdXJjZW1hcDogISFzb3VyY2VtYXBPcHRpb25zLnN0eWxlcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHRhcmdldCxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBpbmNsdWRlUGF0aHM6IHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucz8uaW5jbHVkZVBhdGhzLFxuICAgIGJyb3dzZXJzLFxuICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbixcbiAgfSk7XG4gIGJ1aWxkT3B0aW9ucy5sZWdhbENvbW1lbnRzID0gb3B0aW9ucy5leHRyYWN0TGljZW5zZXMgPyAnbm9uZScgOiAnZW9mJztcblxuICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpzdHlsZXMvZ2xvYmFsJztcbiAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0ge307XG4gIGZvciAoY29uc3QgeyBuYW1lIH0gb2YgZ2xvYmFsU3R5bGVzKSB7XG4gICAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzW25hbWVdID0gYCR7bmFtZXNwYWNlfTske25hbWV9YDtcbiAgfVxuXG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnVuc2hpZnQoe1xuICAgIG5hbWU6ICdhbmd1bGFyLWdsb2JhbC1zdHlsZXMnLFxuICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IC9eYW5ndWxhcjpzdHlsZXNcXC9nbG9iYWw7LyB9LCAoYXJncykgPT4ge1xuICAgICAgICBpZiAoYXJncy5raW5kICE9PSAnZW50cnktcG9pbnQnKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHBhdGg6IGFyZ3MucGF0aC5zcGxpdCgnOycsIDIpWzFdLFxuICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZSB9LCAoYXJncykgPT4ge1xuICAgICAgICBjb25zdCBmaWxlcyA9IGdsb2JhbFN0eWxlcy5maW5kKCh7IG5hbWUgfSkgPT4gbmFtZSA9PT0gYXJncy5wYXRoKT8uZmlsZXM7XG4gICAgICAgIGFzc2VydChmaWxlcywgYGdsb2JhbCBzdHlsZSBuYW1lIHNob3VsZCBhbHdheXMgYmUgZm91bmQgWyR7YXJncy5wYXRofV1gKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbnRlbnRzOiBmaWxlcy5tYXAoKGZpbGUpID0+IGBAaW1wb3J0ICcke2ZpbGUucmVwbGFjZSgvXFxcXC9nLCAnLycpfSc7YCkuam9pbignXFxuJyksXG4gICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cblxuYXN5bmMgZnVuY3Rpb24gd2l0aFNwaW5uZXI8VD4odGV4dDogc3RyaW5nLCBhY3Rpb246ICgpID0+IFQgfCBQcm9taXNlPFQ+KTogUHJvbWlzZTxUPiB7XG4gIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcih0ZXh0KTtcbiAgc3Bpbm5lci5zdGFydCgpO1xuXG4gIHRyeSB7XG4gICAgcmV0dXJuIGF3YWl0IGFjdGlvbigpO1xuICB9IGZpbmFsbHkge1xuICAgIHNwaW5uZXIuc3RvcCgpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHdpdGhOb1Byb2dyZXNzPFQ+KHRlc3Q6IHN0cmluZywgYWN0aW9uOiAoKSA9PiBUIHwgUHJvbWlzZTxUPik6IFByb21pc2U8VD4ge1xuICByZXR1cm4gYWN0aW9uKCk7XG59XG5cbi8qKlxuICogTWFpbiBleGVjdXRpb24gZnVuY3Rpb24gZm9yIHRoZSBlc2J1aWxkLWJhc2VkIGFwcGxpY2F0aW9uIGJ1aWxkZXIuXG4gKiBUaGUgb3B0aW9ucyBhcmUgY29tcGF0aWJsZSB3aXRoIHRoZSBXZWJwYWNrLWJhc2VkIGJ1aWxkZXIuXG4gKiBAcGFyYW0gdXNlck9wdGlvbnMgVGhlIGJyb3dzZXIgYnVpbGRlciBvcHRpb25zIHRvIHVzZSB3aGVuIHNldHRpbmcgdXAgdGhlIGFwcGxpY2F0aW9uIGJ1aWxkXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgQXJjaGl0ZWN0IGJ1aWxkZXIgY29udGV4dCBvYmplY3RcbiAqIEByZXR1cm5zIEFuIGFzeW5jIGl0ZXJhYmxlIHdpdGggdGhlIGJ1aWxkZXIgcmVzdWx0IG91dHB1dFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24qIGJ1aWxkRXNidWlsZEJyb3dzZXIoXG4gIHVzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBpbmZyYXN0cnVjdHVyZVNldHRpbmdzPzoge1xuICAgIHdyaXRlPzogYm9vbGVhbjtcbiAgfSxcbik6IEFzeW5jSXRlcmFibGU8XG4gIEJ1aWxkZXJPdXRwdXQgJiB7XG4gICAgb3V0cHV0RmlsZXM/OiBPdXRwdXRGaWxlW107XG4gICAgYXNzZXRGaWxlcz86IHsgc291cmNlOiBzdHJpbmc7IGRlc3RpbmF0aW9uOiBzdHJpbmcgfVtdO1xuICB9XG4+IHtcbiAgLy8gSW5mb3JtIHVzZXIgb2YgZXhwZXJpbWVudGFsIHN0YXR1cyBvZiBidWlsZGVyIGFuZCBvcHRpb25zXG4gIGxvZ0V4cGVyaW1lbnRhbFdhcm5pbmdzKHVzZXJPcHRpb25zLCBjb250ZXh0KTtcblxuICAvLyBEZXRlcm1pbmUgcHJvamVjdCBuYW1lIGZyb20gYnVpbGRlciBjb250ZXh0IHRhcmdldFxuICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0Py5wcm9qZWN0O1xuICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoYFRoZSAnYnJvd3Nlci1lc2J1aWxkJyBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0IHRvIGJlIHNwZWNpZmllZC5gKTtcblxuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IG5vcm1hbGl6ZWRPcHRpb25zID0gYXdhaXQgbm9ybWFsaXplT3B0aW9ucyhjb250ZXh0LCBwcm9qZWN0TmFtZSwgdXNlck9wdGlvbnMpO1xuICAvLyBXcml0aW5nIHRoZSByZXN1bHQgdG8gdGhlIGZpbGVzeXN0ZW0gaXMgdGhlIGRlZmF1bHQgYmVoYXZpb3JcbiAgY29uc3Qgc2hvdWxkV3JpdGVSZXN1bHQgPSBpbmZyYXN0cnVjdHVyZVNldHRpbmdzPy53cml0ZSAhPT0gZmFsc2U7XG5cbiAgaWYgKHNob3VsZFdyaXRlUmVzdWx0KSB7XG4gICAgLy8gQ2xlYW4gb3V0cHV0IHBhdGggaWYgZW5hYmxlZFxuICAgIGlmICh1c2VyT3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoKSB7XG4gICAgICBkZWxldGVPdXRwdXREaXIobm9ybWFsaXplZE9wdGlvbnMud29ya3NwYWNlUm9vdCwgdXNlck9wdGlvbnMub3V0cHV0UGF0aCk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIG91dHB1dCBkaXJlY3RvcnkgaWYgbmVlZGVkXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGZzLm1rZGlyKG5vcm1hbGl6ZWRPcHRpb25zLm91dHB1dFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGFzc2VydElzRXJyb3IoZSk7XG4gICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcignVW5hYmxlIHRvIGNyZWF0ZSBvdXRwdXQgZGlyZWN0b3J5OiAnICsgZS5tZXNzYWdlKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHdpdGhQcm9ncmVzczogdHlwZW9mIHdpdGhTcGlubmVyID0gbm9ybWFsaXplZE9wdGlvbnMucHJvZ3Jlc3NcbiAgICA/IHdpdGhTcGlubmVyXG4gICAgOiB3aXRoTm9Qcm9ncmVzcztcblxuICAvLyBJbml0aWFsIGJ1aWxkXG4gIGxldCByZXN1bHQ6IEV4ZWN1dGlvblJlc3VsdDtcbiAgdHJ5IHtcbiAgICByZXN1bHQgPSBhd2FpdCB3aXRoUHJvZ3Jlc3MoJ0J1aWxkaW5nLi4uJywgKCkgPT4gZXhlY3V0ZShub3JtYWxpemVkT3B0aW9ucywgY29udGV4dCkpO1xuXG4gICAgaWYgKHNob3VsZFdyaXRlUmVzdWx0KSB7XG4gICAgICAvLyBXcml0ZSBvdXRwdXQgZmlsZXNcbiAgICAgIGF3YWl0IHdyaXRlUmVzdWx0RmlsZXMocmVzdWx0Lm91dHB1dEZpbGVzLCByZXN1bHQuYXNzZXRGaWxlcywgbm9ybWFsaXplZE9wdGlvbnMub3V0cHV0UGF0aCk7XG5cbiAgICAgIHlpZWxkIHJlc3VsdC5vdXRwdXQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFJlcXVpcmVzIGNhc3RpbmcgZHVlIHRvIHVubmVlZGVkIGBKc29uT2JqZWN0YCByZXF1aXJlbWVudC4gUmVtb3ZlIG9uY2UgZml4ZWQuXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgeWllbGQgcmVzdWx0Lm91dHB1dFdpdGhGaWxlcyBhcyBhbnk7XG4gICAgfVxuXG4gICAgLy8gRmluaXNoIGlmIHdhdGNoIG1vZGUgaXMgbm90IGVuYWJsZWRcbiAgICBpZiAoIXVzZXJPcHRpb25zLndhdGNoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIC8vIEVuc3VyZSBTYXNzIHdvcmtlcnMgYXJlIHNodXRkb3duIGlmIG5vdCB3YXRjaGluZ1xuICAgIGlmICghdXNlck9wdGlvbnMud2F0Y2gpIHtcbiAgICAgIHNodXRkb3duU2Fzc1dvcmtlclBvb2woKTtcbiAgICB9XG4gIH1cblxuICBpZiAobm9ybWFsaXplZE9wdGlvbnMucHJvZ3Jlc3MpIHtcbiAgICBjb250ZXh0LmxvZ2dlci5pbmZvKCdXYXRjaCBtb2RlIGVuYWJsZWQuIFdhdGNoaW5nIGZvciBmaWxlIGNoYW5nZXMuLi4nKTtcbiAgfVxuXG4gIC8vIFNldHVwIGEgd2F0Y2hlclxuICBjb25zdCB3YXRjaGVyID0gY3JlYXRlV2F0Y2hlcih7XG4gICAgcG9sbGluZzogdHlwZW9mIHVzZXJPcHRpb25zLnBvbGwgPT09ICdudW1iZXInLFxuICAgIGludGVydmFsOiB1c2VyT3B0aW9ucy5wb2xsLFxuICAgIC8vIElnbm9yZSB0aGUgb3V0cHV0IGFuZCBjYWNoZSBwYXRocyB0byBhdm9pZCBpbmZpbml0ZSByZWJ1aWxkIGN5Y2xlc1xuICAgIGlnbm9yZWQ6IFtub3JtYWxpemVkT3B0aW9ucy5vdXRwdXRQYXRoLCBub3JtYWxpemVkT3B0aW9ucy5jYWNoZU9wdGlvbnMuYmFzZVBhdGhdLFxuICB9KTtcblxuICAvLyBUZW1wb3JhcmlseSB3YXRjaCB0aGUgZW50aXJlIHByb2plY3RcbiAgd2F0Y2hlci5hZGQobm9ybWFsaXplZE9wdGlvbnMucHJvamVjdFJvb3QpO1xuXG4gIC8vIFdhdGNoIHdvcmtzcGFjZSByb290IG5vZGUgbW9kdWxlc1xuICAvLyBJbmNsdWRlcyBZYXJuIFBuUCBtYW5pZmVzdCBmaWxlcyAoaHR0cHM6Ly95YXJucGtnLmNvbS9hZHZhbmNlZC9wbnAtc3BlYy8pXG4gIHdhdGNoZXIuYWRkKHBhdGguam9pbihub3JtYWxpemVkT3B0aW9ucy53b3Jrc3BhY2VSb290LCAnbm9kZV9tb2R1bGVzJykpO1xuICB3YXRjaGVyLmFkZChwYXRoLmpvaW4obm9ybWFsaXplZE9wdGlvbnMud29ya3NwYWNlUm9vdCwgJy5wbnAuY2pzJykpO1xuICB3YXRjaGVyLmFkZChwYXRoLmpvaW4obm9ybWFsaXplZE9wdGlvbnMud29ya3NwYWNlUm9vdCwgJy5wbnAuZGF0YS5qc29uJykpO1xuXG4gIC8vIFdhaXQgZm9yIGNoYW5nZXMgYW5kIHJlYnVpbGQgYXMgbmVlZGVkXG4gIHRyeSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaGFuZ2VzIG9mIHdhdGNoZXIpIHtcbiAgICAgIGlmICh1c2VyT3B0aW9ucy52ZXJib3NlKSB7XG4gICAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oY2hhbmdlcy50b0RlYnVnU3RyaW5nKCkpO1xuICAgICAgfVxuXG4gICAgICByZXN1bHQgPSBhd2FpdCB3aXRoUHJvZ3Jlc3MoJ0NoYW5nZXMgZGV0ZWN0ZWQuIFJlYnVpbGRpbmcuLi4nLCAoKSA9PlxuICAgICAgICBleGVjdXRlKG5vcm1hbGl6ZWRPcHRpb25zLCBjb250ZXh0LCByZXN1bHQuY3JlYXRlUmVidWlsZFN0YXRlKGNoYW5nZXMpKSxcbiAgICAgICk7XG5cbiAgICAgIGlmIChzaG91bGRXcml0ZVJlc3VsdCkge1xuICAgICAgICAvLyBXcml0ZSBvdXRwdXQgZmlsZXNcbiAgICAgICAgYXdhaXQgd3JpdGVSZXN1bHRGaWxlcyhyZXN1bHQub3V0cHV0RmlsZXMsIHJlc3VsdC5hc3NldEZpbGVzLCBub3JtYWxpemVkT3B0aW9ucy5vdXRwdXRQYXRoKTtcblxuICAgICAgICB5aWVsZCByZXN1bHQub3V0cHV0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gUmVxdWlyZXMgY2FzdGluZyBkdWUgdG8gdW5uZWVkZWQgYEpzb25PYmplY3RgIHJlcXVpcmVtZW50LiBSZW1vdmUgb25jZSBmaXhlZC5cbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgeWllbGQgcmVzdWx0Lm91dHB1dFdpdGhGaWxlcyBhcyBhbnk7XG4gICAgICB9XG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIC8vIFN0b3AgdGhlIHdhdGNoZXJcbiAgICBhd2FpdCB3YXRjaGVyLmNsb3NlKCk7XG4gICAgLy8gQ2xlYW51cCBpbmNyZW1lbnRhbCByZWJ1aWxkIHN0YXRlXG4gICAgYXdhaXQgcmVzdWx0LmRpc3Bvc2UoKTtcbiAgICBzaHV0ZG93blNhc3NXb3JrZXJQb29sKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcihidWlsZEVzYnVpbGRCcm93c2VyKTtcblxuZnVuY3Rpb24gbG9nQnVpbGRTdGF0cyhjb250ZXh0OiBCdWlsZGVyQ29udGV4dCwgbWV0YWZpbGU6IE1ldGFmaWxlKSB7XG4gIGNvbnN0IHN0YXRzOiBCdW5kbGVTdGF0c1tdID0gW107XG4gIGZvciAoY29uc3QgW2ZpbGUsIG91dHB1dF0gb2YgT2JqZWN0LmVudHJpZXMobWV0YWZpbGUub3V0cHV0cykpIHtcbiAgICAvLyBTa2lwIHNvdXJjZW1hcHNcbiAgICBpZiAoZmlsZS5lbmRzV2l0aCgnLm1hcCcpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgLy8gU2tpcCBpbnRlcm5hbCBjb21wb25lbnQgcmVzb3VyY2VzXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBpZiAoKG91dHB1dCBhcyBhbnkpWyduZy1jb21wb25lbnQnXSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgc3RhdHMucHVzaCh7XG4gICAgICBpbml0aWFsOiAhIW91dHB1dC5lbnRyeVBvaW50LFxuICAgICAgc3RhdHM6IFtmaWxlLCAnJywgb3V0cHV0LmJ5dGVzLCAnJ10sXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCB0YWJsZVRleHQgPSBnZW5lcmF0ZUJ1aWxkU3RhdHNUYWJsZShzdGF0cywgdHJ1ZSwgdHJ1ZSwgZmFsc2UsIHVuZGVmaW5lZCk7XG5cbiAgY29udGV4dC5sb2dnZXIuaW5mbygnXFxuJyArIHRhYmxlVGV4dCArICdcXG4nKTtcbn1cbiJdfQ==