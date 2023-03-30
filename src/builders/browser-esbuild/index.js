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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgseURBQXlGO0FBRXpGLDhEQUFpQztBQUNqQyxxQ0FBbUQ7QUFDbkQsZ0VBQWtDO0FBQ2xDLDBEQUE2QjtBQUM3Qix1Q0FBOEM7QUFDOUMseURBQXFEO0FBQ3JELDZDQUFrRDtBQUNsRCxpRUFBa0Y7QUFFbEYsc0ZBQWlGO0FBQ2pGLCtEQUFnRjtBQUNoRix1RUFBc0U7QUFDdEUseURBQTBEO0FBQzFELHVEQUEwRTtBQUMxRSx1Q0FBd0Q7QUFDeEQsbUVBQWtFO0FBQ2xFLDJEQUFzRDtBQUN0RCx1Q0FBdUU7QUFDdkUsK0NBQXVEO0FBRXZELCtDQUE4RDtBQUM5RCx1Q0FBd0Q7QUFTeEQ7O0dBRUc7QUFDSCxNQUFNLGVBQWU7SUFJbkIsWUFDVSxXQUE0QixFQUM1QixtQkFBb0MsRUFDcEMsZUFBaUM7UUFGakMsZ0JBQVcsR0FBWCxXQUFXLENBQWlCO1FBQzVCLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBaUI7UUFDcEMsb0JBQWUsR0FBZixlQUFlLENBQWtCO1FBTmxDLGdCQUFXLEdBQWlCLEVBQUUsQ0FBQztRQUMvQixlQUFVLEdBQThDLEVBQUUsQ0FBQztJQU1qRSxDQUFDO0lBRUosYUFBYSxDQUFDLElBQVksRUFBRSxPQUFlO1FBQ3pDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFFRCxJQUFJLE1BQU07UUFDUixPQUFPO1lBQ0wsT0FBTyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUM7U0FDckMsQ0FBQztJQUNKLENBQUM7SUFFRCxJQUFJLGVBQWU7UUFDakIsT0FBTztZQUNMLE9BQU8sRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDO1lBQ3BDLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVztZQUM3QixVQUFVLEVBQUUsSUFBSSxDQUFDLFVBQVU7U0FDNUIsQ0FBQztJQUNKLENBQUM7SUFFRCxrQkFBa0IsQ0FBQyxXQUF5QjtRQUMxQyxJQUFJLENBQUMsZUFBZSxFQUFFLFVBQVUsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDLFFBQVEsRUFBRSxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBRXBGLE9BQU87WUFDTCxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7WUFDN0IsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLG1CQUFtQjtZQUM3QyxlQUFlLEVBQUUsSUFBSSxDQUFDLGVBQWU7WUFDckMsV0FBVztTQUNaLENBQUM7SUFDSixDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQU87UUFDWCxNQUFNLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxFQUFFLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDL0YsQ0FBQztDQUNGO0FBRUQsS0FBSyxVQUFVLE9BQU8sQ0FDcEIsT0FBaUMsRUFDakMsT0FBdUIsRUFDdkIsWUFBMkI7SUFFM0IsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUUxQyxNQUFNLEVBQ0osV0FBVyxFQUNYLGFBQWEsRUFDYixtQkFBbUIsRUFDbkIsTUFBTSxFQUNOLG9CQUFvQixFQUNwQixnQkFBZ0IsR0FDakIsR0FBRyxPQUFPLENBQUM7SUFFWixNQUFNLFFBQVEsR0FBRyxJQUFBLHlDQUFvQixFQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbkUsTUFBTSxNQUFNLEdBQUcsSUFBQSxxREFBbUMsRUFBQyxRQUFRLENBQUMsQ0FBQztJQUU3RCxvRkFBb0Y7SUFDcEYsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLEtBQUs7UUFDbkMsQ0FBQyxDQUFDLFlBQVksRUFBRSxlQUFlLElBQUksSUFBSSxpQ0FBZSxFQUFFO1FBQ3hELENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDZCxNQUFNLGlCQUFpQixHQUNyQixZQUFZLEVBQUUsV0FBVztRQUN6QixJQUFJLHdCQUFjLENBQ2hCLGFBQWEsRUFDYixDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFDZix1QkFBdUIsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxlQUFlLENBQUMsQ0FDcEUsQ0FBQztJQUNKLE1BQU0seUJBQXlCLEdBQzdCLFlBQVksRUFBRSxtQkFBbUI7UUFDakMsSUFBSSx3QkFBYyxDQUNoQixhQUFhLEVBQ2IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQ2YsK0JBQStCLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FDM0QsQ0FBQztJQUVKLE1BQU0sQ0FBQyxXQUFXLEVBQUUsWUFBWSxDQUFDLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDO1FBQ3BELGlEQUFpRDtRQUNqRCxpQkFBaUIsQ0FBQyxNQUFNLEVBQUU7UUFDMUIsbURBQW1EO1FBQ25ELHlCQUF5QixDQUFDLE1BQU0sRUFBRTtLQUNuQyxDQUFDLENBQUM7SUFFSCx3REFBd0Q7SUFDeEQsTUFBTSxJQUFBLHFCQUFXLEVBQUMsT0FBTyxFQUFFO1FBQ3pCLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxZQUFZLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZFLFFBQVEsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLFFBQVEsRUFBRSxHQUFHLFlBQVksQ0FBQyxRQUFRLENBQUM7S0FDOUQsQ0FBQyxDQUFDO0lBRUgsTUFBTSxlQUFlLEdBQUcsSUFBSSxlQUFlLENBQ3pDLGlCQUFpQixFQUNqQix5QkFBeUIsRUFDekIsZUFBZSxDQUNoQixDQUFDO0lBRUYsb0NBQW9DO0lBQ3BDLElBQUksV0FBVyxDQUFDLE1BQU0sSUFBSSxZQUFZLENBQUMsTUFBTSxFQUFFO1FBQzdDLE9BQU8sZUFBZSxDQUFDO0tBQ3hCO0lBRUQseUNBQXlDO0lBQ3pDLFlBQVksQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQzFELENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLEVBQUUsT0FBTyxDQUNqRixDQUFDO0lBRUYsb0NBQW9DO0lBQ3BDLE1BQU0sWUFBWSxHQUFlLENBQUMsR0FBRyxXQUFXLENBQUMsWUFBWSxFQUFFLEdBQUcsWUFBWSxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQzdGLGVBQWUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsV0FBVyxDQUFDLFdBQVcsRUFBRSxHQUFHLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUUxRiwyRkFBMkY7SUFDM0YsTUFBTSxRQUFRLEdBQUc7UUFDZixNQUFNLEVBQUUsRUFBRSxHQUFHLFdBQVcsQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLEdBQUcsWUFBWSxDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUU7UUFDN0UsT0FBTyxFQUFFLEVBQUUsR0FBRyxXQUFXLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxHQUFHLFlBQVksQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFO0tBQ2pGLENBQUM7SUFFRixpRUFBaUU7SUFDakUsSUFBSSxtQkFBbUIsQ0FBQyxPQUFPLEVBQUU7UUFDL0IsTUFBTSxRQUFRLEdBQUcsSUFBQSx1Q0FBb0IsRUFBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFDckYsTUFBTSxJQUFBLHFCQUFXLEVBQUMsT0FBTyxFQUFFLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7S0FDcEQ7SUFFRCwyQkFBMkI7SUFDM0IsSUFBSSxnQkFBZ0IsRUFBRTtRQUNwQiw0RUFBNEU7UUFDNUUsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLHlDQUFrQixDQUFDO1lBQ2hELFNBQVMsRUFBRSxnQkFBZ0IsQ0FBQyxLQUFLO1lBQ2pDLFdBQVcsRUFBRSxnQkFBZ0IsQ0FBQyxjQUFjO1lBQzVDLEdBQUcsRUFBRSxPQUFPLENBQUMsb0JBQW9CO1lBQ2pDLFlBQVksRUFBRSxtQkFBbUI7WUFDakMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxXQUFXO1NBQ2pDLENBQUMsQ0FBQztRQUVILDhEQUE4RDtRQUM5RCxNQUFNLGlCQUFpQixHQUFHLEdBQUcsQ0FBQztRQUM5QixrQkFBa0IsQ0FBQyxTQUFTLEdBQUcsS0FBSyxXQUFXLFFBQWdCO1lBQzdELHFDQUFxQztZQUNyQyxNQUFNLGdCQUFnQixHQUFHLG1CQUFJLENBQUMsUUFBUSxDQUFDLGlCQUFpQixFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ3BFLE1BQU0sSUFBSSxHQUFHLGVBQWUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLGdCQUFnQixDQUFDLENBQUM7WUFDeEYsSUFBSSxJQUFJLEVBQUU7Z0JBQ1IsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDO2FBQ2xCO1lBRUQsTUFBTSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsbUJBQUksRUFBRSxDQUFDLENBQUM7UUFDekQsQ0FBQyxDQUFDO1FBRUYsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxrQkFBa0IsQ0FBQyxPQUFPLENBQUM7WUFDckUsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRO1lBQzFCLElBQUksRUFBRSxTQUFTO1lBQ2YsVUFBVSxFQUFFLGlCQUFpQjtZQUM3QixLQUFLLEVBQUUsWUFBWTtTQUNwQixDQUFDLENBQUM7UUFFSCxLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sRUFBRTtZQUMxQixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUM3QjtRQUNELEtBQUssTUFBTSxPQUFPLElBQUksUUFBUSxFQUFFO1lBQzlCLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQzlCO1FBRUQsZUFBZSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7S0FDakU7SUFFRCxjQUFjO0lBQ2QsSUFBSSxNQUFNLEVBQUU7UUFDViw4RkFBOEY7UUFDOUYsa0dBQWtHO1FBQ2xHLGVBQWUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLElBQUEsd0JBQVUsRUFBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNuRjtJQUVELDRDQUE0QztJQUM1QyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUU7UUFDakIsZUFBZSxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDaEY7SUFFRCwrQ0FBK0M7SUFDL0MsSUFBSSxPQUFPLENBQUMsZUFBZSxFQUFFO1FBQzNCLGVBQWUsQ0FBQyxhQUFhLENBQzNCLHNCQUFzQixFQUN0QixNQUFNLElBQUEsbUNBQWUsRUFBQyxRQUFRLEVBQUUsYUFBYSxDQUFDLENBQy9DLENBQUM7S0FDSDtJQUVELHNEQUFzRDtJQUN0RCxJQUFJLG9CQUFvQixFQUFFO1FBQ3hCLElBQUk7WUFDRixNQUFNLG1CQUFtQixHQUFHLE1BQU0sSUFBQSxtREFBa0MsRUFDbEUsYUFBYSxFQUNiLG9CQUFvQixFQUNwQixPQUFPLENBQUMsUUFBUSxJQUFJLEdBQUcsRUFDdkIsZUFBZSxDQUFDLFdBQVcsRUFDM0IsZUFBZSxDQUFDLFVBQVUsQ0FDM0IsQ0FBQztZQUNGLGVBQWUsQ0FBQyxhQUFhLENBQUMsV0FBVyxFQUFFLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3pFLGVBQWUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsbUJBQW1CLENBQUMsVUFBVSxDQUFDLENBQUM7U0FDcEU7UUFBQyxPQUFPLEtBQUssRUFBRTtZQUNkLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsQ0FBQztZQUUxRSxPQUFPLGVBQWUsQ0FBQztTQUN4QjtLQUNGO0lBRUQsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLEdBQUcsU0FBUyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN4RSxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBRW5FLE9BQU8sZUFBZSxDQUFDO0FBQ3pCLENBQUM7QUFFRCxLQUFLLFVBQVUsZ0JBQWdCLENBQzdCLFdBQXlCLEVBQ3pCLFVBQWlFLEVBQ2pFLFVBQWtCO0lBRWxCLE1BQU0sZUFBZSxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7SUFDMUMsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUNmLFdBQVcsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFO1FBQzdCLHFDQUFxQztRQUNyQyxNQUFNLFFBQVEsR0FBRyxtQkFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDekMsSUFBSSxRQUFRLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQzlDLE1BQU0sa0JBQUUsQ0FBQyxLQUFLLENBQUMsbUJBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7WUFDckUsZUFBZSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUMvQjtRQUNELHNCQUFzQjtRQUN0QixNQUFNLGtCQUFFLENBQUMsU0FBUyxDQUFDLG1CQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3RFLENBQUMsQ0FBQyxDQUNILENBQUM7SUFFRixJQUFJLFVBQVUsRUFBRSxNQUFNLEVBQUU7UUFDdEIsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUNmLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUU7WUFDL0MscUNBQXFDO1lBQ3JDLE1BQU0sUUFBUSxHQUFHLG1CQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzNDLElBQUksUUFBUSxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDOUMsTUFBTSxrQkFBRSxDQUFDLEtBQUssQ0FBQyxtQkFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztnQkFDckUsZUFBZSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUMvQjtZQUNELHFCQUFxQjtZQUNyQixNQUFNLGtCQUFFLENBQUMsUUFBUSxDQUNmLE1BQU0sRUFDTixtQkFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsV0FBVyxDQUFDO1lBQ2xDLGlFQUFpRTtZQUNqRSxtQkFBVyxDQUFDLGdCQUFnQixDQUM3QixDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQ0gsQ0FBQztLQUNIO0FBQ0gsQ0FBQztBQUVELFNBQVMsd0JBQXdCLENBQUMsSUFBWSxFQUFFLElBQVk7SUFDMUQsT0FBTztRQUNMLElBQUk7UUFDSixJQUFJO1FBQ0osSUFBSSxRQUFRO1lBQ1YsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDekMsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyx1QkFBdUIsQ0FDOUIsT0FBaUMsRUFDakMsTUFBZ0IsRUFDaEIsUUFBa0IsRUFDbEIsZUFBaUM7SUFFakMsTUFBTSxFQUNKLGFBQWEsRUFDYixXQUFXLEVBQ1gsU0FBUyxFQUNULG1CQUFtQixFQUNuQixnQkFBZ0IsRUFDaEIsUUFBUSxFQUNSLFdBQVcsRUFDWCxnQkFBZ0IsRUFDaEIsb0JBQW9CLEVBQ3BCLGdCQUFnQixFQUNoQix3QkFBd0IsRUFDeEIscUJBQXFCLEVBQ3JCLG1CQUFtQixFQUNuQixHQUFHLEVBQ0gscUJBQXFCLEdBQ3RCLEdBQUcsT0FBTyxDQUFDO0lBRVosTUFBTSxZQUFZLEdBQWlCO1FBQ2pDLGFBQWEsRUFBRSxhQUFhO1FBQzVCLE1BQU0sRUFBRSxJQUFJO1FBQ1osTUFBTSxFQUFFLEtBQUs7UUFDYixXQUFXO1FBQ1gsVUFBVSxFQUFFLFdBQVcsQ0FBQyxPQUFPO1FBQy9CLFVBQVUsRUFBRSxXQUFXLENBQUMsS0FBSztRQUM3QixNQUFNO1FBQ04sU0FBUyxFQUFFLGlCQUFpQixDQUFDLE1BQU0sQ0FBQztRQUNwQyxVQUFVLEVBQUUsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUM7UUFDbkQsVUFBVSxFQUFFLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7UUFDMUMsaUJBQWlCLEVBQUUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUM7UUFDakQsUUFBUSxFQUFFLElBQUk7UUFDZCxhQUFhLEVBQUUsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLO1FBQ3ZELFFBQVEsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFFBQVE7UUFDOUMsTUFBTSxFQUFFLG1CQUFtQixDQUFDLE9BQU87UUFDbkMsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDO1FBQ3BCLE1BQU0sRUFBRSxhQUFhO1FBQ3JCLFNBQVMsRUFBRSxnQkFBZ0IsQ0FBQyxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ3BGLFNBQVMsRUFBRSxJQUFJO1FBQ2YsUUFBUTtRQUNSLFFBQVEsRUFBRSxvQkFBb0I7UUFDOUIsS0FBSyxFQUFFLEtBQUs7UUFDWixRQUFRLEVBQUUsU0FBUztRQUNuQixnQkFBZ0I7UUFDaEIsT0FBTyxFQUFFO1lBQ1AsSUFBQSxzQ0FBb0I7WUFDbEIsZ0JBQWdCO1lBQ2hCO2dCQUNFLFNBQVMsRUFBRSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsT0FBTztnQkFDckMsb0JBQW9CLEVBQUUsZ0JBQWdCLENBQUMsTUFBTTtnQkFDN0MsUUFBUTtnQkFDUixHQUFHO2dCQUNILHFCQUFxQjtnQkFDckIsZ0JBQWdCO2dCQUNoQixlQUFlO2FBQ2hCO1lBQ0QsK0JBQStCO1lBQy9CO2dCQUNFLGFBQWE7Z0JBQ2IsWUFBWSxFQUFFLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsTUFBTTtnQkFDakQsU0FBUztnQkFDUCwrRUFBK0U7Z0JBQy9FLG1GQUFtRjtnQkFDbkYsMkJBQTJCO2dCQUMzQixDQUFDLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztnQkFDM0UsV0FBVztnQkFDWCxZQUFZLEVBQUUsd0JBQXdCLEVBQUUsWUFBWTtnQkFDcEQsb0JBQW9CO2dCQUNwQixNQUFNO2dCQUNOLG1CQUFtQjtnQkFDbkIsUUFBUTtnQkFDUixxQkFBcUI7YUFDdEIsQ0FDRjtTQUNGO1FBQ0QsTUFBTSxFQUFFO1lBQ04sZ0dBQWdHO1lBQ2hHLCtGQUErRjtZQUMvRiwyQ0FBMkM7WUFDM0MsR0FBRyxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUN2RSxXQUFXLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU87U0FDcEM7S0FDRixDQUFDO0lBRUYsSUFBSSxTQUFTLEVBQUUsTUFBTSxFQUFFO1FBQ3JCLE1BQU0sU0FBUyxHQUFHLG1CQUFtQixDQUFDO1FBQ3RDLFlBQVksQ0FBQyxXQUFXLEdBQUc7WUFDekIsR0FBRyxZQUFZLENBQUMsV0FBVztZQUMzQixDQUFDLFdBQVcsQ0FBQyxFQUFFLFNBQVM7U0FDekIsQ0FBQztRQUVGLFlBQVksQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDO1lBQzVCLElBQUksRUFBRSxtQkFBbUI7WUFDekIsS0FBSyxDQUFDLEtBQUs7Z0JBQ1QsS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxxQkFBcUIsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7b0JBQzFELElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxhQUFhLEVBQUU7d0JBQy9CLE9BQU8sSUFBSSxDQUFDO3FCQUNiO29CQUVELE9BQU87d0JBQ0wsSUFBSSxFQUFFLE9BQU87d0JBQ2IsU0FBUztxQkFDVixDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDO2dCQUNILEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxFQUFFLEdBQUcsRUFBRTtvQkFDNUMsT0FBTzt3QkFDTCxRQUFRLEVBQUUsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsV0FBVyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQzt3QkFDckYsTUFBTSxFQUFFLElBQUk7d0JBQ1osVUFBVSxFQUFFLGFBQWE7cUJBQzFCLENBQUM7Z0JBQ0osQ0FBQyxDQUFDLENBQUM7WUFDTCxDQUFDO1NBQ0YsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxPQUFPLFlBQVksQ0FBQztBQUN0QixDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxTQUFTLGlCQUFpQixDQUFDLE1BQWdCO0lBQ3pDLE1BQU0sU0FBUyxHQUE0QjtRQUN6QyxzRkFBc0Y7UUFDdEYsb0dBQW9HO1FBQ3BHLG1HQUFtRztRQUNuRyxrREFBa0Q7UUFDbEQsdUdBQXVHO1FBQ3ZHLGFBQWEsRUFBRSxLQUFLO1FBQ3BCLHFHQUFxRztRQUNyRyxvR0FBb0c7UUFDcEcsOEVBQThFO1FBQzlFLDBFQUEwRTtRQUMxRSxvQkFBb0IsRUFBRSxLQUFLO0tBQzVCLENBQUM7SUFFRixzRUFBc0U7SUFDdEUsbUZBQW1GO0lBQ25GLHdGQUF3RjtJQUN4RixJQUFJLHdCQUF3QixHQUFHLEtBQUssQ0FBQztJQUNyQyxLQUFLLE1BQU0sT0FBTyxJQUFJLE1BQU0sRUFBRTtRQUM1QixJQUFJLFlBQVksQ0FBQztRQUNqQixJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDN0IsWUFBWSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQzVDO2FBQU0sSUFBSSxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQ3ZDLFlBQVksR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUM1QzthQUFNO1lBQ0wsU0FBUztTQUNWO1FBQ0QsMEZBQTBGO1FBQzFGLGlGQUFpRjtRQUNqRixJQUFJLFlBQVksS0FBSyxFQUFFLElBQUksWUFBWSxLQUFLLEVBQUUsRUFBRTtZQUM5Qyx3QkFBd0IsR0FBRyxJQUFJLENBQUM7WUFDaEMsTUFBTTtTQUNQO0tBQ0Y7SUFDRCx5RkFBeUY7SUFDekYsZ0RBQWdEO0lBQ2hELElBQUksd0JBQXdCLEVBQUU7UUFDNUIsU0FBUyxDQUFDLGFBQWEsQ0FBQyxHQUFHLEtBQUssQ0FBQztRQUNqQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsR0FBRyxLQUFLLENBQUM7S0FDekM7SUFFRCxPQUFPLFNBQVMsQ0FBQztBQUNuQixDQUFDO0FBRUQsU0FBUywrQkFBK0IsQ0FDdEMsT0FBaUMsRUFDakMsTUFBZ0IsRUFDaEIsUUFBa0I7SUFFbEIsTUFBTSxFQUNKLGFBQWEsRUFDYixtQkFBbUIsRUFDbkIsZ0JBQWdCLEVBQ2hCLFdBQVcsRUFDWCxZQUFZLEVBQ1osZ0JBQWdCLEVBQ2hCLG9CQUFvQixFQUNwQix3QkFBd0IsRUFDeEIscUJBQXFCLEdBQ3RCLEdBQUcsT0FBTyxDQUFDO0lBRVosTUFBTSxZQUFZLEdBQUcsSUFBQSwyQ0FBNkIsRUFBQztRQUNqRCxhQUFhO1FBQ2IsWUFBWSxFQUFFLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsTUFBTTtRQUNqRCxTQUFTLEVBQUUsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLE1BQU07UUFDcEMsZ0JBQWdCO1FBQ2hCLE1BQU07UUFDTixvQkFBb0I7UUFDcEIsV0FBVztRQUNYLFlBQVksRUFBRSx3QkFBd0IsRUFBRSxZQUFZO1FBQ3BELFFBQVE7UUFDUixxQkFBcUI7S0FDdEIsQ0FBQyxDQUFDO0lBQ0gsWUFBWSxDQUFDLGFBQWEsR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztJQUV0RSxNQUFNLFNBQVMsR0FBRyx1QkFBdUIsQ0FBQztJQUMxQyxZQUFZLENBQUMsV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUM5QixLQUFLLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFBSSxZQUFZLEVBQUU7UUFDbkMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLFNBQVMsSUFBSSxJQUFJLEVBQUUsQ0FBQztLQUN6RDtJQUVELFlBQVksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO1FBQzNCLElBQUksRUFBRSx1QkFBdUI7UUFDN0IsS0FBSyxDQUFDLEtBQUs7WUFDVCxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLDBCQUEwQixFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTtnQkFDL0QsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLGFBQWEsRUFBRTtvQkFDL0IsT0FBTyxJQUFJLENBQUM7aUJBQ2I7Z0JBRUQsT0FBTztvQkFDTCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDaEMsU0FBUztpQkFDVixDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7WUFDSCxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFO2dCQUNoRCxNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLENBQUM7Z0JBQ3pFLElBQUEscUJBQU0sRUFBQyxLQUFLLEVBQUUsNkNBQTZDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO2dCQUV6RSxPQUFPO29CQUNMLFFBQVEsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxZQUFZLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO29CQUNsRixNQUFNLEVBQUUsS0FBSztvQkFDYixVQUFVLEVBQUUsYUFBYTtpQkFDMUIsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztLQUNGLENBQUMsQ0FBQztJQUVILE9BQU8sWUFBWSxDQUFDO0FBQ3RCLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSSxLQUFLLFNBQVMsQ0FBQyxDQUFDLG1CQUFtQixDQUN4QyxXQUFrQyxFQUNsQyxPQUF1QixFQUN2QixzQkFFQztJQUVELDREQUE0RDtJQUM1RCxJQUFBLCtDQUF1QixFQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUU5QyxxREFBcUQ7SUFDckQsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUM7SUFDNUMsSUFBSSxDQUFDLFdBQVcsRUFBRTtRQUNoQixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxrRUFBa0UsQ0FBQyxDQUFDO1FBRXpGLE9BQU87S0FDUjtJQUVELE1BQU0saUJBQWlCLEdBQUcsTUFBTSxJQUFBLDBCQUFnQixFQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDcEYsK0RBQStEO0lBQy9ELE1BQU0saUJBQWlCLEdBQUcsc0JBQXNCLEVBQUUsS0FBSyxLQUFLLEtBQUssQ0FBQztJQUVsRSxJQUFJLGlCQUFpQixFQUFFO1FBQ3JCLCtCQUErQjtRQUMvQixJQUFJLFdBQVcsQ0FBQyxnQkFBZ0IsRUFBRTtZQUNoQyxJQUFBLHVCQUFlLEVBQUMsaUJBQWlCLENBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUMxRTtRQUVELG9DQUFvQztRQUNwQyxJQUFJO1lBQ0YsTUFBTSxrQkFBRSxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztTQUNuRTtRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsSUFBQSxxQkFBYSxFQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pCLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLHFDQUFxQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUV4RSxPQUFPO1NBQ1I7S0FDRjtJQUVELGdCQUFnQjtJQUNoQixJQUFJLE1BQXVCLENBQUM7SUFDNUIsSUFBSTtRQUNGLE1BQU0sR0FBRyxNQUFNLE9BQU8sQ0FBQyxpQkFBaUIsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUVuRCxJQUFJLGlCQUFpQixFQUFFO1lBQ3JCLHFCQUFxQjtZQUNyQixNQUFNLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLFVBQVUsRUFBRSxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUU1RixNQUFNLE1BQU0sQ0FBQyxNQUFNLENBQUM7U0FDckI7YUFBTTtZQUNMLGdGQUFnRjtZQUNoRiw4REFBOEQ7WUFDOUQsTUFBTSxNQUFNLENBQUMsZUFBc0IsQ0FBQztTQUNyQztRQUVELHNDQUFzQztRQUN0QyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRTtZQUN0QixPQUFPO1NBQ1I7S0FDRjtZQUFTO1FBQ1IsbURBQW1EO1FBQ25ELElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFO1lBQ3RCLElBQUEsb0NBQXNCLEdBQUUsQ0FBQztTQUMxQjtLQUNGO0lBRUQsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsa0RBQWtELENBQUMsQ0FBQztJQUV4RSxrQkFBa0I7SUFDbEIsTUFBTSxPQUFPLEdBQUcsSUFBQSx1QkFBYSxFQUFDO1FBQzVCLE9BQU8sRUFBRSxPQUFPLFdBQVcsQ0FBQyxJQUFJLEtBQUssUUFBUTtRQUM3QyxRQUFRLEVBQUUsV0FBVyxDQUFDLElBQUk7UUFDMUIscUVBQXFFO1FBQ3JFLE9BQU8sRUFBRSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsRUFBRSxpQkFBaUIsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDO0tBQ2pGLENBQUMsQ0FBQztJQUVILHVDQUF1QztJQUN2QyxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBRTNDLG9DQUFvQztJQUNwQyw0RUFBNEU7SUFDNUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQztJQUN4RSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBQ3BFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsYUFBYSxFQUFFLGdCQUFnQixDQUFDLENBQUMsQ0FBQztJQUUxRSx5Q0FBeUM7SUFDekMsSUFBSTtRQUNGLElBQUksS0FBSyxFQUFFLE1BQU0sT0FBTyxJQUFJLE9BQU8sRUFBRTtZQUNuQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1lBRXZELElBQUksV0FBVyxDQUFDLE9BQU8sRUFBRTtnQkFDdkIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUM7YUFDOUM7WUFFRCxNQUFNLEdBQUcsTUFBTSxPQUFPLENBQUMsaUJBQWlCLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBRXZGLElBQUksaUJBQWlCLEVBQUU7Z0JBQ3JCLHFCQUFxQjtnQkFDckIsTUFBTSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxVQUFVLEVBQUUsaUJBQWlCLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBRTVGLE1BQU0sTUFBTSxDQUFDLE1BQU0sQ0FBQzthQUNyQjtpQkFBTTtnQkFDTCxnRkFBZ0Y7Z0JBQ2hGLDhEQUE4RDtnQkFDOUQsTUFBTSxNQUFNLENBQUMsZUFBc0IsQ0FBQzthQUNyQztTQUNGO0tBQ0Y7WUFBUztRQUNSLG1CQUFtQjtRQUNuQixNQUFNLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUN0QixvQ0FBb0M7UUFDcEMsTUFBTSxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDdkIsSUFBQSxvQ0FBc0IsR0FBRSxDQUFDO0tBQzFCO0FBQ0gsQ0FBQztBQWxIRCxrREFrSEM7QUFFRCxrQkFBZSxJQUFBLHlCQUFhLEVBQUMsbUJBQW1CLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHR5cGUgeyBCdWlsZE9wdGlvbnMsIE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgY29uc3RhbnRzIGFzIGZzQ29uc3RhbnRzIH0gZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZGVsZXRlT3V0cHV0RGlyIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgY29weUFzc2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvcHktYXNzZXRzJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2VzYnVpbGQtdGFyZ2V0cyc7XG5pbXBvcnQgeyBGaWxlSW5mbyB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvYXVnbWVudC1pbmRleC1odG1sJztcbmltcG9ydCB7IEluZGV4SHRtbEdlbmVyYXRvciB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyRXNidWlsZCB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IGdldFN1cHBvcnRlZEJyb3dzZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3VwcG9ydGVkLWJyb3dzZXJzJztcbmltcG9ydCB7IGNoZWNrQ29tbW9uSlNNb2R1bGVzIH0gZnJvbSAnLi9jb21tb25qcy1jaGVja2VyJztcbmltcG9ydCB7IFNvdXJjZUZpbGVDYWNoZSwgY3JlYXRlQ29tcGlsZXJQbHVnaW4gfSBmcm9tICcuL2NvbXBpbGVyLXBsdWdpbic7XG5pbXBvcnQgeyBCdW5kbGVyQ29udGV4dCwgbG9nTWVzc2FnZXMgfSBmcm9tICcuL2VzYnVpbGQnO1xuaW1wb3J0IHsgbG9nRXhwZXJpbWVudGFsV2FybmluZ3MgfSBmcm9tICcuL2V4cGVyaW1lbnRhbC13YXJuaW5ncyc7XG5pbXBvcnQgeyBleHRyYWN0TGljZW5zZXMgfSBmcm9tICcuL2xpY2Vuc2UtZXh0cmFjdG9yJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucywgbm9ybWFsaXplT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgeyBzaHV0ZG93blNhc3NXb3JrZXJQb29sIH0gZnJvbSAnLi9zYXNzLXBsdWdpbic7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuaW1wb3J0IHsgY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnMgfSBmcm9tICcuL3N0eWxlc2hlZXRzJztcbmltcG9ydCB7IENoYW5nZWRGaWxlcywgY3JlYXRlV2F0Y2hlciB9IGZyb20gJy4vd2F0Y2hlcic7XG5cbmludGVyZmFjZSBSZWJ1aWxkU3RhdGUge1xuICBjb2RlUmVidWlsZD86IEJ1bmRsZXJDb250ZXh0O1xuICBnbG9iYWxTdHlsZXNSZWJ1aWxkPzogQnVuZGxlckNvbnRleHQ7XG4gIGNvZGVCdW5kbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZTtcbiAgZmlsZUNoYW5nZXM6IENoYW5nZWRGaWxlcztcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIHRoZSByZXN1bHQgb2YgYSBzaW5nbGUgYnVpbGRlciBleGVjdXRlIGNhbGwuXG4gKi9cbmNsYXNzIEV4ZWN1dGlvblJlc3VsdCB7XG4gIHJlYWRvbmx5IG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW10gPSBbXTtcbiAgcmVhZG9ubHkgYXNzZXRGaWxlczogeyBzb3VyY2U6IHN0cmluZzsgZGVzdGluYXRpb246IHN0cmluZyB9W10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGNvZGVSZWJ1aWxkPzogQnVuZGxlckNvbnRleHQsXG4gICAgcHJpdmF0ZSBnbG9iYWxTdHlsZXNSZWJ1aWxkPzogQnVuZGxlckNvbnRleHQsXG4gICAgcHJpdmF0ZSBjb2RlQnVuZGxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4gICkge31cblxuICBhZGRPdXRwdXRGaWxlKHBhdGg6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5vdXRwdXRGaWxlcy5wdXNoKGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChwYXRoLCBjb250ZW50KSk7XG4gIH1cblxuICBnZXQgb3V0cHV0KCkge1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0aGlzLm91dHB1dEZpbGVzLmxlbmd0aCA+IDAsXG4gICAgfTtcbiAgfVxuXG4gIGdldCBvdXRwdXRXaXRoRmlsZXMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRoaXMub3V0cHV0RmlsZXMubGVuZ3RoID4gMCxcbiAgICAgIG91dHB1dEZpbGVzOiB0aGlzLm91dHB1dEZpbGVzLFxuICAgICAgYXNzZXRGaWxlczogdGhpcy5hc3NldEZpbGVzLFxuICAgIH07XG4gIH1cblxuICBjcmVhdGVSZWJ1aWxkU3RhdGUoZmlsZUNoYW5nZXM6IENoYW5nZWRGaWxlcyk6IFJlYnVpbGRTdGF0ZSB7XG4gICAgdGhpcy5jb2RlQnVuZGxlQ2FjaGU/LmludmFsaWRhdGUoWy4uLmZpbGVDaGFuZ2VzLm1vZGlmaWVkLCAuLi5maWxlQ2hhbmdlcy5yZW1vdmVkXSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29kZVJlYnVpbGQ6IHRoaXMuY29kZVJlYnVpbGQsXG4gICAgICBnbG9iYWxTdHlsZXNSZWJ1aWxkOiB0aGlzLmdsb2JhbFN0eWxlc1JlYnVpbGQsXG4gICAgICBjb2RlQnVuZGxlQ2FjaGU6IHRoaXMuY29kZUJ1bmRsZUNhY2hlLFxuICAgICAgZmlsZUNoYW5nZXMsXG4gICAgfTtcbiAgfVxuXG4gIGFzeW5jIGRpc3Bvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFt0aGlzLmNvZGVSZWJ1aWxkPy5kaXNwb3NlKCksIHRoaXMuZ2xvYmFsU3R5bGVzUmVidWlsZD8uZGlzcG9zZSgpXSk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZXhlY3V0ZShcbiAgb3B0aW9uczogTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgcmVidWlsZFN0YXRlPzogUmVidWlsZFN0YXRlLFxuKTogUHJvbWlzZTxFeGVjdXRpb25SZXN1bHQ+IHtcbiAgY29uc3Qgc3RhcnRUaW1lID0gcHJvY2Vzcy5ocnRpbWUuYmlnaW50KCk7XG5cbiAgY29uc3Qge1xuICAgIHByb2plY3RSb290LFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBhc3NldHMsXG4gICAgc2VydmljZVdvcmtlck9wdGlvbnMsXG4gICAgaW5kZXhIdG1sT3B0aW9ucyxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgYnJvd3NlcnMgPSBnZXRTdXBwb3J0ZWRCcm93c2Vycyhwcm9qZWN0Um9vdCwgY29udGV4dC5sb2dnZXIpO1xuICBjb25zdCB0YXJnZXQgPSB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyhicm93c2Vycyk7XG5cbiAgLy8gUmV1c2UgcmVidWlsZCBzdGF0ZSBvciBjcmVhdGUgbmV3IGJ1bmRsZSBjb250ZXh0cyBmb3IgY29kZSBhbmQgZ2xvYmFsIHN0eWxlc2hlZXRzXG4gIGNvbnN0IGNvZGVCdW5kbGVDYWNoZSA9IG9wdGlvbnMud2F0Y2hcbiAgICA/IHJlYnVpbGRTdGF0ZT8uY29kZUJ1bmRsZUNhY2hlID8/IG5ldyBTb3VyY2VGaWxlQ2FjaGUoKVxuICAgIDogdW5kZWZpbmVkO1xuICBjb25zdCBjb2RlQnVuZGxlQ29udGV4dCA9XG4gICAgcmVidWlsZFN0YXRlPy5jb2RlUmVidWlsZCA/P1xuICAgIG5ldyBCdW5kbGVyQ29udGV4dChcbiAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAhIW9wdGlvbnMud2F0Y2gsXG4gICAgICBjcmVhdGVDb2RlQnVuZGxlT3B0aW9ucyhvcHRpb25zLCB0YXJnZXQsIGJyb3dzZXJzLCBjb2RlQnVuZGxlQ2FjaGUpLFxuICAgICk7XG4gIGNvbnN0IGdsb2JhbFN0eWxlc0J1bmRsZUNvbnRleHQgPVxuICAgIHJlYnVpbGRTdGF0ZT8uZ2xvYmFsU3R5bGVzUmVidWlsZCA/P1xuICAgIG5ldyBCdW5kbGVyQ29udGV4dChcbiAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAhIW9wdGlvbnMud2F0Y2gsXG4gICAgICBjcmVhdGVHbG9iYWxTdHlsZXNCdW5kbGVPcHRpb25zKG9wdGlvbnMsIHRhcmdldCwgYnJvd3NlcnMpLFxuICAgICk7XG5cbiAgY29uc3QgW2NvZGVSZXN1bHRzLCBzdHlsZVJlc3VsdHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIC8vIEV4ZWN1dGUgZXNidWlsZCB0byBidW5kbGUgdGhlIGFwcGxpY2F0aW9uIGNvZGVcbiAgICBjb2RlQnVuZGxlQ29udGV4dC5idW5kbGUoKSxcbiAgICAvLyBFeGVjdXRlIGVzYnVpbGQgdG8gYnVuZGxlIHRoZSBnbG9iYWwgc3R5bGVzaGVldHNcbiAgICBnbG9iYWxTdHlsZXNCdW5kbGVDb250ZXh0LmJ1bmRsZSgpLFxuICBdKTtcblxuICAvLyBMb2cgYWxsIHdhcm5pbmdzIGFuZCBlcnJvcnMgZ2VuZXJhdGVkIGR1cmluZyBidW5kbGluZ1xuICBhd2FpdCBsb2dNZXNzYWdlcyhjb250ZXh0LCB7XG4gICAgZXJyb3JzOiBbLi4uKGNvZGVSZXN1bHRzLmVycm9ycyB8fCBbXSksIC4uLihzdHlsZVJlc3VsdHMuZXJyb3JzIHx8IFtdKV0sXG4gICAgd2FybmluZ3M6IFsuLi5jb2RlUmVzdWx0cy53YXJuaW5ncywgLi4uc3R5bGVSZXN1bHRzLndhcm5pbmdzXSxcbiAgfSk7XG5cbiAgY29uc3QgZXhlY3V0aW9uUmVzdWx0ID0gbmV3IEV4ZWN1dGlvblJlc3VsdChcbiAgICBjb2RlQnVuZGxlQ29udGV4dCxcbiAgICBnbG9iYWxTdHlsZXNCdW5kbGVDb250ZXh0LFxuICAgIGNvZGVCdW5kbGVDYWNoZSxcbiAgKTtcblxuICAvLyBSZXR1cm4gaWYgdGhlIGJ1bmRsaW5nIGhhcyBlcnJvcnNcbiAgaWYgKGNvZGVSZXN1bHRzLmVycm9ycyB8fCBzdHlsZVJlc3VsdHMuZXJyb3JzKSB7XG4gICAgcmV0dXJuIGV4ZWN1dGlvblJlc3VsdDtcbiAgfVxuXG4gIC8vIEZpbHRlciBnbG9iYWwgc3R5bGVzaGVldCBpbml0aWFsIGZpbGVzXG4gIHN0eWxlUmVzdWx0cy5pbml0aWFsRmlsZXMgPSBzdHlsZVJlc3VsdHMuaW5pdGlhbEZpbGVzLmZpbHRlcihcbiAgICAoeyBuYW1lIH0pID0+IG9wdGlvbnMuZ2xvYmFsU3R5bGVzLmZpbmQoKHN0eWxlKSA9PiBzdHlsZS5uYW1lID09PSBuYW1lKT8uaW5pdGlhbCxcbiAgKTtcblxuICAvLyBDb21iaW5lIHRoZSBidW5kbGluZyBvdXRwdXQgZmlsZXNcbiAgY29uc3QgaW5pdGlhbEZpbGVzOiBGaWxlSW5mb1tdID0gWy4uLmNvZGVSZXN1bHRzLmluaXRpYWxGaWxlcywgLi4uc3R5bGVSZXN1bHRzLmluaXRpYWxGaWxlc107XG4gIGV4ZWN1dGlvblJlc3VsdC5vdXRwdXRGaWxlcy5wdXNoKC4uLmNvZGVSZXN1bHRzLm91dHB1dEZpbGVzLCAuLi5zdHlsZVJlc3VsdHMub3V0cHV0RmlsZXMpO1xuXG4gIC8vIENvbWJpbmUgbWV0YWZpbGVzIHVzZWQgZm9yIHRoZSBzdGF0cyBvcHRpb24gYXMgd2VsbCBhcyBidW5kbGUgYnVkZ2V0cyBhbmQgY29uc29sZSBvdXRwdXRcbiAgY29uc3QgbWV0YWZpbGUgPSB7XG4gICAgaW5wdXRzOiB7IC4uLmNvZGVSZXN1bHRzLm1ldGFmaWxlPy5pbnB1dHMsIC4uLnN0eWxlUmVzdWx0cy5tZXRhZmlsZT8uaW5wdXRzIH0sXG4gICAgb3V0cHV0czogeyAuLi5jb2RlUmVzdWx0cy5tZXRhZmlsZT8ub3V0cHV0cywgLi4uc3R5bGVSZXN1bHRzLm1ldGFmaWxlPy5vdXRwdXRzIH0sXG4gIH07XG5cbiAgLy8gQ2hlY2sgbWV0YWZpbGUgZm9yIENvbW1vbkpTIG1vZHVsZSB1c2FnZSBpZiBvcHRpbWl6aW5nIHNjcmlwdHNcbiAgaWYgKG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cykge1xuICAgIGNvbnN0IG1lc3NhZ2VzID0gY2hlY2tDb21tb25KU01vZHVsZXMobWV0YWZpbGUsIG9wdGlvbnMuYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzKTtcbiAgICBhd2FpdCBsb2dNZXNzYWdlcyhjb250ZXh0LCB7IHdhcm5pbmdzOiBtZXNzYWdlcyB9KTtcbiAgfVxuXG4gIC8vIEdlbmVyYXRlIGluZGV4IEhUTUwgZmlsZVxuICBpZiAoaW5kZXhIdG1sT3B0aW9ucykge1xuICAgIC8vIENyZWF0ZSBhbiBpbmRleCBIVE1MIGdlbmVyYXRvciB0aGF0IHJlYWRzIGZyb20gdGhlIGluLW1lbW9yeSBvdXRwdXQgZmlsZXNcbiAgICBjb25zdCBpbmRleEh0bWxHZW5lcmF0b3IgPSBuZXcgSW5kZXhIdG1sR2VuZXJhdG9yKHtcbiAgICAgIGluZGV4UGF0aDogaW5kZXhIdG1sT3B0aW9ucy5pbnB1dCxcbiAgICAgIGVudHJ5cG9pbnRzOiBpbmRleEh0bWxPcHRpb25zLmluc2VydGlvbk9yZGVyLFxuICAgICAgc3JpOiBvcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgICAgb3B0aW1pemF0aW9uOiBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgICAgY3Jvc3NPcmlnaW46IG9wdGlvbnMuY3Jvc3NPcmlnaW4sXG4gICAgfSk7XG5cbiAgICAvKiogVmlydHVhbCBvdXRwdXQgcGF0aCB0byBzdXBwb3J0IHJlYWRpbmcgaW4tbWVtb3J5IGZpbGVzLiAqL1xuICAgIGNvbnN0IHZpcnR1YWxPdXRwdXRQYXRoID0gJy8nO1xuICAgIGluZGV4SHRtbEdlbmVyYXRvci5yZWFkQXNzZXQgPSBhc3luYyBmdW5jdGlvbiAoZmlsZVBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgICAvLyBSZW1vdmUgbGVhZGluZyBkaXJlY3Rvcnkgc2VwYXJhdG9yXG4gICAgICBjb25zdCByZWxhdGl2ZWZpbGVQYXRoID0gcGF0aC5yZWxhdGl2ZSh2aXJ0dWFsT3V0cHV0UGF0aCwgZmlsZVBhdGgpO1xuICAgICAgY29uc3QgZmlsZSA9IGV4ZWN1dGlvblJlc3VsdC5vdXRwdXRGaWxlcy5maW5kKChmaWxlKSA9PiBmaWxlLnBhdGggPT09IHJlbGF0aXZlZmlsZVBhdGgpO1xuICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgcmV0dXJuIGZpbGUudGV4dDtcbiAgICAgIH1cblxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBPdXRwdXQgZmlsZSBkb2VzIG5vdCBleGlzdDogJHtwYXRofWApO1xuICAgIH07XG5cbiAgICBjb25zdCB7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IGluZGV4SHRtbEdlbmVyYXRvci5wcm9jZXNzKHtcbiAgICAgIGJhc2VIcmVmOiBvcHRpb25zLmJhc2VIcmVmLFxuICAgICAgbGFuZzogdW5kZWZpbmVkLFxuICAgICAgb3V0cHV0UGF0aDogdmlydHVhbE91dHB1dFBhdGgsXG4gICAgICBmaWxlczogaW5pdGlhbEZpbGVzLFxuICAgIH0pO1xuXG4gICAgZm9yIChjb25zdCBlcnJvciBvZiBlcnJvcnMpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB3YXJuaW5nIG9mIHdhcm5pbmdzKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci53YXJuKHdhcm5pbmcpO1xuICAgIH1cblxuICAgIGV4ZWN1dGlvblJlc3VsdC5hZGRPdXRwdXRGaWxlKGluZGV4SHRtbE9wdGlvbnMub3V0cHV0LCBjb250ZW50KTtcbiAgfVxuXG4gIC8vIENvcHkgYXNzZXRzXG4gIGlmIChhc3NldHMpIHtcbiAgICAvLyBUaGUgd2VicGFjayBjb3B5IGFzc2V0cyBoZWxwZXIgaXMgdXNlZCB3aXRoIG5vIGJhc2UgcGF0aHMgZGVmaW5lZC4gVGhpcyBwcmV2ZW50cyB0aGUgaGVscGVyXG4gICAgLy8gZnJvbSBkaXJlY3RseSB3cml0aW5nIHRvIGRpc2suIFRoaXMgc2hvdWxkIGV2ZW50dWFsbHkgYmUgcmVwbGFjZWQgd2l0aCBhIG1vcmUgb3B0aW1pemVkIGhlbHBlci5cbiAgICBleGVjdXRpb25SZXN1bHQuYXNzZXRGaWxlcy5wdXNoKC4uLihhd2FpdCBjb3B5QXNzZXRzKGFzc2V0cywgW10sIHdvcmtzcGFjZVJvb3QpKSk7XG4gIH1cblxuICAvLyBXcml0ZSBtZXRhZmlsZSBpZiBzdGF0cyBvcHRpb24gaXMgZW5hYmxlZFxuICBpZiAob3B0aW9ucy5zdGF0cykge1xuICAgIGV4ZWN1dGlvblJlc3VsdC5hZGRPdXRwdXRGaWxlKCdzdGF0cy5qc29uJywgSlNPTi5zdHJpbmdpZnkobWV0YWZpbGUsIG51bGwsIDIpKTtcbiAgfVxuXG4gIC8vIEV4dHJhY3QgYW5kIHdyaXRlIGxpY2Vuc2VzIGZvciB1c2VkIHBhY2thZ2VzXG4gIGlmIChvcHRpb25zLmV4dHJhY3RMaWNlbnNlcykge1xuICAgIGV4ZWN1dGlvblJlc3VsdC5hZGRPdXRwdXRGaWxlKFxuICAgICAgJzNyZHBhcnR5bGljZW5zZXMudHh0JyxcbiAgICAgIGF3YWl0IGV4dHJhY3RMaWNlbnNlcyhtZXRhZmlsZSwgd29ya3NwYWNlUm9vdCksXG4gICAgKTtcbiAgfVxuXG4gIC8vIEF1Z21lbnQgdGhlIGFwcGxpY2F0aW9uIHdpdGggc2VydmljZSB3b3JrZXIgc3VwcG9ydFxuICBpZiAoc2VydmljZVdvcmtlck9wdGlvbnMpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2VydmljZVdvcmtlclJlc3VsdCA9IGF3YWl0IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlckVzYnVpbGQoXG4gICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIHNlcnZpY2VXb3JrZXJPcHRpb25zLFxuICAgICAgICBvcHRpb25zLmJhc2VIcmVmIHx8ICcvJyxcbiAgICAgICAgZXhlY3V0aW9uUmVzdWx0Lm91dHB1dEZpbGVzLFxuICAgICAgICBleGVjdXRpb25SZXN1bHQuYXNzZXRGaWxlcyxcbiAgICAgICk7XG4gICAgICBleGVjdXRpb25SZXN1bHQuYWRkT3V0cHV0RmlsZSgnbmdzdy5qc29uJywgc2VydmljZVdvcmtlclJlc3VsdC5tYW5pZmVzdCk7XG4gICAgICBleGVjdXRpb25SZXN1bHQuYXNzZXRGaWxlcy5wdXNoKC4uLnNlcnZpY2VXb3JrZXJSZXN1bHQuYXNzZXRGaWxlcyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogYCR7ZXJyb3J9YCk7XG5cbiAgICAgIHJldHVybiBleGVjdXRpb25SZXN1bHQ7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgYnVpbGRUaW1lID0gTnVtYmVyKHByb2Nlc3MuaHJ0aW1lLmJpZ2ludCgpIC0gc3RhcnRUaW1lKSAvIDEwICoqIDk7XG4gIGNvbnRleHQubG9nZ2VyLmluZm8oYENvbXBsZXRlLiBbJHtidWlsZFRpbWUudG9GaXhlZCgzKX0gc2Vjb25kc11gKTtcblxuICByZXR1cm4gZXhlY3V0aW9uUmVzdWx0O1xufVxuXG5hc3luYyBmdW5jdGlvbiB3cml0ZVJlc3VsdEZpbGVzKFxuICBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdLFxuICBhc3NldEZpbGVzOiB7IHNvdXJjZTogc3RyaW5nOyBkZXN0aW5hdGlvbjogc3RyaW5nIH1bXSB8IHVuZGVmaW5lZCxcbiAgb3V0cHV0UGF0aDogc3RyaW5nLFxuKSB7XG4gIGNvbnN0IGRpcmVjdG9yeUV4aXN0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICBvdXRwdXRGaWxlcy5tYXAoYXN5bmMgKGZpbGUpID0+IHtcbiAgICAgIC8vIEVuc3VyZSBvdXRwdXQgc3ViZGlyZWN0b3JpZXMgZXhpc3RcbiAgICAgIGNvbnN0IGJhc2VQYXRoID0gcGF0aC5kaXJuYW1lKGZpbGUucGF0aCk7XG4gICAgICBpZiAoYmFzZVBhdGggJiYgIWRpcmVjdG9yeUV4aXN0cy5oYXMoYmFzZVBhdGgpKSB7XG4gICAgICAgIGF3YWl0IGZzLm1rZGlyKHBhdGguam9pbihvdXRwdXRQYXRoLCBiYXNlUGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICBkaXJlY3RvcnlFeGlzdHMuYWRkKGJhc2VQYXRoKTtcbiAgICAgIH1cbiAgICAgIC8vIFdyaXRlIGZpbGUgY29udGVudHNcbiAgICAgIGF3YWl0IGZzLndyaXRlRmlsZShwYXRoLmpvaW4ob3V0cHV0UGF0aCwgZmlsZS5wYXRoKSwgZmlsZS5jb250ZW50cyk7XG4gICAgfSksXG4gICk7XG5cbiAgaWYgKGFzc2V0RmlsZXM/Lmxlbmd0aCkge1xuICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgYXNzZXRGaWxlcy5tYXAoYXN5bmMgKHsgc291cmNlLCBkZXN0aW5hdGlvbiB9KSA9PiB7XG4gICAgICAgIC8vIEVuc3VyZSBvdXRwdXQgc3ViZGlyZWN0b3JpZXMgZXhpc3RcbiAgICAgICAgY29uc3QgYmFzZVBhdGggPSBwYXRoLmRpcm5hbWUoZGVzdGluYXRpb24pO1xuICAgICAgICBpZiAoYmFzZVBhdGggJiYgIWRpcmVjdG9yeUV4aXN0cy5oYXMoYmFzZVBhdGgpKSB7XG4gICAgICAgICAgYXdhaXQgZnMubWtkaXIocGF0aC5qb2luKG91dHB1dFBhdGgsIGJhc2VQYXRoKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgZGlyZWN0b3J5RXhpc3RzLmFkZChiYXNlUGF0aCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ29weSBmaWxlIGNvbnRlbnRzXG4gICAgICAgIGF3YWl0IGZzLmNvcHlGaWxlKFxuICAgICAgICAgIHNvdXJjZSxcbiAgICAgICAgICBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgZGVzdGluYXRpb24pLFxuICAgICAgICAgIC8vIFRoaXMgaXMgbm90IHlldCBhdmFpbGFibGUgZnJvbSBgZnMvcHJvbWlzZXNgIGluIE5vZGUuanMgdjE2LjEzXG4gICAgICAgICAgZnNDb25zdGFudHMuQ09QWUZJTEVfRklDTE9ORSxcbiAgICAgICAgKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHBhdGg6IHN0cmluZywgdGV4dDogc3RyaW5nKTogT3V0cHV0RmlsZSB7XG4gIHJldHVybiB7XG4gICAgcGF0aCxcbiAgICB0ZXh0LFxuICAgIGdldCBjb250ZW50cygpIHtcbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbSh0aGlzLnRleHQsICd1dGYtOCcpO1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvZGVCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIGJyb3dzZXJzOiBzdHJpbmdbXSxcbiAgc291cmNlRmlsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlLFxuKTogQnVpbGRPcHRpb25zIHtcbiAgY29uc3Qge1xuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgZW50cnlQb2ludHMsXG4gICAgcG9seWZpbGxzLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB0c2NvbmZpZyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLFxuICAgIGFkdmFuY2VkT3B0aW1pemF0aW9ucyxcbiAgICBpbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgIGppdCxcbiAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IGJ1aWxkT3B0aW9uczogQnVpbGRPcHRpb25zID0ge1xuICAgIGFic1dvcmtpbmdEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgYnVuZGxlOiB0cnVlLFxuICAgIGZvcm1hdDogJ2VzbScsXG4gICAgZW50cnlQb2ludHMsXG4gICAgZW50cnlOYW1lczogb3V0cHV0TmFtZXMuYnVuZGxlcyxcbiAgICBhc3NldE5hbWVzOiBvdXRwdXROYW1lcy5tZWRpYSxcbiAgICB0YXJnZXQsXG4gICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICBjb25kaXRpb25zOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnbW9kdWxlJ10sXG4gICAgcmVzb2x2ZUV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBsZWdhbENvbW1lbnRzOiBvcHRpb25zLmV4dHJhY3RMaWNlbnNlcyA/ICdub25lJyA6ICdlb2YnLFxuICAgIGxvZ0xldmVsOiBvcHRpb25zLnZlcmJvc2UgPyAnZGVidWcnIDogJ3NpbGVudCcsXG4gICAgbWluaWZ5OiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgcHVyZTogWydmb3J3YXJkUmVmJ10sXG4gICAgb3V0ZGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIHNvdXJjZW1hcDogc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICBzcGxpdHRpbmc6IHRydWUsXG4gICAgdHNjb25maWcsXG4gICAgZXh0ZXJuYWw6IGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gICAgICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICAgICAge1xuICAgICAgICAgIHNvdXJjZW1hcDogISFzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMsXG4gICAgICAgICAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM6IHNvdXJjZW1hcE9wdGlvbnMudmVuZG9yLFxuICAgICAgICAgIHRzY29uZmlnLFxuICAgICAgICAgIGppdCxcbiAgICAgICAgICBhZHZhbmNlZE9wdGltaXphdGlvbnMsXG4gICAgICAgICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICAgICAgICBzb3VyY2VGaWxlQ2FjaGUsXG4gICAgICAgIH0sXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAge1xuICAgICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgb3B0aW1pemF0aW9uOiAhIW9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLm1pbmlmeSxcbiAgICAgICAgICBzb3VyY2VtYXA6XG4gICAgICAgICAgICAvLyBIaWRkZW4gY29tcG9uZW50IHN0eWxlc2hlZXQgc291cmNlbWFwcyBhcmUgaW5hY2Nlc3NpYmxlIHdoaWNoIGlzIGVmZmVjdGl2ZWx5XG4gICAgICAgICAgICAvLyB0aGUgc2FtZSBhcyBiZWluZyBkaXNhYmxlZC4gRGlzYWJsaW5nIGhhcyB0aGUgYWR2YW50YWdlIG9mIGF2b2lkaW5nIHRoZSBvdmVyaGVhZFxuICAgICAgICAgICAgLy8gb2Ygc291cmNlbWFwIHByb2Nlc3NpbmcuXG4gICAgICAgICAgICAhIXNvdXJjZW1hcE9wdGlvbnMuc3R5bGVzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/IGZhbHNlIDogJ2lubGluZScpLFxuICAgICAgICAgIG91dHB1dE5hbWVzLFxuICAgICAgICAgIGluY2x1ZGVQYXRoczogc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zPy5pbmNsdWRlUGF0aHMsXG4gICAgICAgICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgICAgICAgYnJvd3NlcnMsXG4gICAgICAgICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICAgICAgICB9LFxuICAgICAgKSxcbiAgICBdLFxuICAgIGRlZmluZToge1xuICAgICAgLy8gT25seSBzZXQgdG8gZmFsc2Ugd2hlbiBzY3JpcHQgb3B0aW1pemF0aW9ucyBhcmUgZW5hYmxlZC4gSXQgc2hvdWxkIG5vdCBiZSBzZXQgdG8gdHJ1ZSBiZWNhdXNlXG4gICAgICAvLyBBbmd1bGFyIHR1cm5zIGBuZ0Rldk1vZGVgIGludG8gYW4gb2JqZWN0IGZvciBkZXZlbG9wbWVudCBkZWJ1Z2dpbmcgcHVycG9zZXMgd2hlbiBub3QgZGVmaW5lZFxuICAgICAgLy8gd2hpY2ggYSBjb25zdGFudCB0cnVlIHZhbHVlIHdvdWxkIGJyZWFrLlxuICAgICAgLi4uKG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyA/IHsgJ25nRGV2TW9kZSc6ICdmYWxzZScgfSA6IHVuZGVmaW5lZCksXG4gICAgICAnbmdKaXRNb2RlJzogaml0ID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICB9LFxuICB9O1xuXG4gIGlmIChwb2x5ZmlsbHM/Lmxlbmd0aCkge1xuICAgIGNvbnN0IG5hbWVzcGFjZSA9ICdhbmd1bGFyOnBvbHlmaWxscyc7XG4gICAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0ge1xuICAgICAgLi4uYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzLFxuICAgICAgWydwb2x5ZmlsbHMnXTogbmFtZXNwYWNlLFxuICAgIH07XG5cbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucz8udW5zaGlmdCh7XG4gICAgICBuYW1lOiAnYW5ndWxhci1wb2x5ZmlsbHMnLFxuICAgICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgICAgYnVpbGQub25SZXNvbHZlKHsgZmlsdGVyOiAvXmFuZ3VsYXI6cG9seWZpbGxzJC8gfSwgKGFyZ3MpID0+IHtcbiAgICAgICAgICBpZiAoYXJncy5raW5kICE9PSAnZW50cnktcG9pbnQnKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGF0aDogJ2VudHJ5JyxcbiAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZSB9LCAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNvbnRlbnRzOiBwb2x5ZmlsbHMubWFwKChmaWxlKSA9PiBgaW1wb3J0ICcke2ZpbGUucmVwbGFjZSgvXFxcXC9nLCAnLycpfSc7YCkuam9pbignXFxuJyksXG4gICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBidWlsZE9wdGlvbnM7XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgc3ludGF4IGZlYXR1cmUgb2JqZWN0IG1hcCBmb3IgQW5ndWxhciBhcHBsaWNhdGlvbnMgYmFzZWQgb24gYSBsaXN0IG9mIHRhcmdldHMuXG4gKiBBIGZ1bGwgc2V0IG9mIGZlYXR1cmUgbmFtZXMgY2FuIGJlIGZvdW5kIGhlcmU6IGh0dHBzOi8vZXNidWlsZC5naXRodWIuaW8vYXBpLyNzdXBwb3J0ZWRcbiAqIEBwYXJhbSB0YXJnZXQgQW4gYXJyYXkgb2YgYnJvd3Nlci9lbmdpbmUgdGFyZ2V0cyBpbiB0aGUgZm9ybWF0IGFjY2VwdGVkIGJ5IHRoZSBlc2J1aWxkIGB0YXJnZXRgIG9wdGlvbi5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkIHdpdGggdGhlIGVzYnVpbGQgYnVpbGQgYHN1cHBvcnRlZGAgb3B0aW9uLlxuICovXG5mdW5jdGlvbiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQ6IHN0cmluZ1tdKTogQnVpbGRPcHRpb25zWydzdXBwb3J0ZWQnXSB7XG4gIGNvbnN0IHN1cHBvcnRlZDogUmVjb3JkPHN0cmluZywgYm9vbGVhbj4gPSB7XG4gICAgLy8gTmF0aXZlIGFzeW5jL2F3YWl0IGlzIG5vdCBzdXBwb3J0ZWQgd2l0aCBab25lLmpzLiBEaXNhYmxpbmcgc3VwcG9ydCBoZXJlIHdpbGwgY2F1c2VcbiAgICAvLyBlc2J1aWxkIHRvIGRvd25sZXZlbCBhc3luYy9hd2FpdCBhbmQgZm9yIGF3YWl0Li4ub2YgdG8gYSBab25lLmpzIHN1cHBvcnRlZCBmb3JtLiBIb3dldmVyLCBlc2J1aWxkXG4gICAgLy8gZG9lcyBub3QgY3VycmVudGx5IHN1cHBvcnQgZG93bmxldmVsaW5nIGFzeW5jIGdlbmVyYXRvcnMuIEluc3RlYWQgYmFiZWwgaXMgdXNlZCB3aXRoaW4gdGhlIEpTL1RTXG4gICAgLy8gbG9hZGVyIHRvIHBlcmZvcm0gdGhlIGRvd25sZXZlbCB0cmFuc2Zvcm1hdGlvbi5cbiAgICAvLyBOT1RFOiBJZiBlc2J1aWxkIGFkZHMgc3VwcG9ydCBpbiB0aGUgZnV0dXJlLCB0aGUgYmFiZWwgc3VwcG9ydCBmb3IgYXN5bmMgZ2VuZXJhdG9ycyBjYW4gYmUgZGlzYWJsZWQuXG4gICAgJ2FzeW5jLWF3YWl0JzogZmFsc2UsXG4gICAgLy8gVjggY3VycmVudGx5IGhhcyBhIHBlcmZvcm1hbmNlIGRlZmVjdCBpbnZvbHZpbmcgb2JqZWN0IHNwcmVhZCBvcGVyYXRpb25zIHRoYXQgY2FuIGNhdXNlIHNpZ25maWNhbnRcbiAgICAvLyBkZWdyYWRhdGlvbiBpbiBydW50aW1lIHBlcmZvcm1hbmNlLiBCeSBub3Qgc3VwcG9ydGluZyB0aGUgbGFuZ3VhZ2UgZmVhdHVyZSBoZXJlLCBhIGRvd25sZXZlbCBmb3JtXG4gICAgLy8gd2lsbCBiZSB1c2VkIGluc3RlYWQgd2hpY2ggcHJvdmlkZXMgYSB3b3JrYXJvdW5kIGZvciB0aGUgcGVyZm9ybWFuY2UgaXNzdWUuXG4gICAgLy8gRm9yIG1vcmUgZGV0YWlsczogaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MTE1MzZcbiAgICAnb2JqZWN0LXJlc3Qtc3ByZWFkJzogZmFsc2UsXG4gIH07XG5cbiAgLy8gRGV0ZWN0IFNhZmFyaSBicm93c2VyIHZlcnNpb25zIHRoYXQgaGF2ZSBhIGNsYXNzIGZpZWxkIGJlaGF2aW9yIGJ1Z1xuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNDM1NSNpc3N1ZWNvbW1lbnQtMTMzMzQ3NzAzM1xuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9XZWJLaXQvV2ViS2l0L2NvbW1pdC9lODc4OGEzNGIzZDVmNWI0ZWRkN2ZmNjQ1MGI4MDkzNmJmZjM5NmYyXG4gIGxldCBzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcgPSBmYWxzZTtcbiAgZm9yIChjb25zdCBicm93c2VyIG9mIHRhcmdldCkge1xuICAgIGxldCBtYWpvclZlcnNpb247XG4gICAgaWYgKGJyb3dzZXIuc3RhcnRzV2l0aCgnaW9zJykpIHtcbiAgICAgIG1ham9yVmVyc2lvbiA9IE51bWJlcihicm93c2VyLnNsaWNlKDMsIDUpKTtcbiAgICB9IGVsc2UgaWYgKGJyb3dzZXIuc3RhcnRzV2l0aCgnc2FmYXJpJykpIHtcbiAgICAgIG1ham9yVmVyc2lvbiA9IE51bWJlcihicm93c2VyLnNsaWNlKDYsIDgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIC8vIFRlY2huaWNhbGx5LCAxNC4wIGlzIG5vdCBicm9rZW4gYnV0IHJhdGhlciBkb2VzIG5vdCBoYXZlIHN1cHBvcnQuIEhvd2V2ZXIsIHRoZSBiZWhhdmlvclxuICAgIC8vIGlzIGlkZW50aWNhbCBzaW5jZSBpdCB3b3VsZCBiZSBzZXQgdG8gZmFsc2UgYnkgZXNidWlsZCBpZiBwcmVzZW50IGFzIGEgdGFyZ2V0LlxuICAgIGlmIChtYWpvclZlcnNpb24gPT09IDE0IHx8IG1ham9yVmVyc2lvbiA9PT0gMTUpIHtcbiAgICAgIHNhZmFyaUNsYXNzRmllbGRTY29wZUJ1ZyA9IHRydWU7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgLy8gSWYgY2xhc3MgZmllbGQgc3VwcG9ydCBjYW5ub3QgYmUgdXNlZCBzZXQgdG8gZmFsc2U7IG90aGVyd2lzZSBsZWF2ZSB1bmRlZmluZWQgdG8gYWxsb3dcbiAgLy8gZXNidWlsZCB0byB1c2UgYHRhcmdldGAgdG8gZGV0ZXJtaW5lIHN1cHBvcnQuXG4gIGlmIChzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcpIHtcbiAgICBzdXBwb3J0ZWRbJ2NsYXNzLWZpZWxkJ10gPSBmYWxzZTtcbiAgICBzdXBwb3J0ZWRbJ2NsYXNzLXN0YXRpYy1maWVsZCddID0gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gc3VwcG9ydGVkO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVHbG9iYWxTdHlsZXNCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIGJyb3dzZXJzOiBzdHJpbmdbXSxcbik6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHtcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBnbG9iYWxTdHlsZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICB9ID0gb3B0aW9ucztcblxuICBjb25zdCBidWlsZE9wdGlvbnMgPSBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyh7XG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBvcHRpbWl6YXRpb246ICEhb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMubWluaWZ5LFxuICAgIHNvdXJjZW1hcDogISFzb3VyY2VtYXBPcHRpb25zLnN0eWxlcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHRhcmdldCxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBpbmNsdWRlUGF0aHM6IHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucz8uaW5jbHVkZVBhdGhzLFxuICAgIGJyb3dzZXJzLFxuICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbixcbiAgfSk7XG4gIGJ1aWxkT3B0aW9ucy5sZWdhbENvbW1lbnRzID0gb3B0aW9ucy5leHRyYWN0TGljZW5zZXMgPyAnbm9uZScgOiAnZW9mJztcblxuICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpzdHlsZXMvZ2xvYmFsJztcbiAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0ge307XG4gIGZvciAoY29uc3QgeyBuYW1lIH0gb2YgZ2xvYmFsU3R5bGVzKSB7XG4gICAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzW25hbWVdID0gYCR7bmFtZXNwYWNlfTske25hbWV9YDtcbiAgfVxuXG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnVuc2hpZnQoe1xuICAgIG5hbWU6ICdhbmd1bGFyLWdsb2JhbC1zdHlsZXMnLFxuICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IC9eYW5ndWxhcjpzdHlsZXNcXC9nbG9iYWw7LyB9LCAoYXJncykgPT4ge1xuICAgICAgICBpZiAoYXJncy5raW5kICE9PSAnZW50cnktcG9pbnQnKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHBhdGg6IGFyZ3MucGF0aC5zcGxpdCgnOycsIDIpWzFdLFxuICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZSB9LCAoYXJncykgPT4ge1xuICAgICAgICBjb25zdCBmaWxlcyA9IGdsb2JhbFN0eWxlcy5maW5kKCh7IG5hbWUgfSkgPT4gbmFtZSA9PT0gYXJncy5wYXRoKT8uZmlsZXM7XG4gICAgICAgIGFzc2VydChmaWxlcywgYGdsb2JhbCBzdHlsZSBuYW1lIHNob3VsZCBhbHdheXMgYmUgZm91bmQgWyR7YXJncy5wYXRofV1gKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbnRlbnRzOiBmaWxlcy5tYXAoKGZpbGUpID0+IGBAaW1wb3J0ICcke2ZpbGUucmVwbGFjZSgvXFxcXC9nLCAnLycpfSc7YCkuam9pbignXFxuJyksXG4gICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cblxuLyoqXG4gKiBNYWluIGV4ZWN1dGlvbiBmdW5jdGlvbiBmb3IgdGhlIGVzYnVpbGQtYmFzZWQgYXBwbGljYXRpb24gYnVpbGRlci5cbiAqIFRoZSBvcHRpb25zIGFyZSBjb21wYXRpYmxlIHdpdGggdGhlIFdlYnBhY2stYmFzZWQgYnVpbGRlci5cbiAqIEBwYXJhbSB1c2VyT3B0aW9ucyBUaGUgYnJvd3NlciBidWlsZGVyIG9wdGlvbnMgdG8gdXNlIHdoZW4gc2V0dGluZyB1cCB0aGUgYXBwbGljYXRpb24gYnVpbGRcbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBBcmNoaXRlY3QgYnVpbGRlciBjb250ZXh0IG9iamVjdFxuICogQHJldHVybnMgQW4gYXN5bmMgaXRlcmFibGUgd2l0aCB0aGUgYnVpbGRlciByZXN1bHQgb3V0cHV0XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogYnVpbGRFc2J1aWxkQnJvd3NlcihcbiAgdXNlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIGluZnJhc3RydWN0dXJlU2V0dGluZ3M/OiB7XG4gICAgd3JpdGU/OiBib29sZWFuO1xuICB9LFxuKTogQXN5bmNJdGVyYWJsZTxCdWlsZGVyT3V0cHV0ICYgeyBvdXRwdXRGaWxlcz86IE91dHB1dEZpbGVbXSB9PiB7XG4gIC8vIEluZm9ybSB1c2VyIG9mIGV4cGVyaW1lbnRhbCBzdGF0dXMgb2YgYnVpbGRlciBhbmQgb3B0aW9uc1xuICBsb2dFeHBlcmltZW50YWxXYXJuaW5ncyh1c2VyT3B0aW9ucywgY29udGV4dCk7XG5cbiAgLy8gRGV0ZXJtaW5lIHByb2plY3QgbmFtZSBmcm9tIGJ1aWxkZXIgY29udGV4dCB0YXJnZXRcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGBUaGUgJ2Jyb3dzZXItZXNidWlsZCcgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldCB0byBiZSBzcGVjaWZpZWQuYCk7XG5cbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBub3JtYWxpemVkT3B0aW9ucyA9IGF3YWl0IG5vcm1hbGl6ZU9wdGlvbnMoY29udGV4dCwgcHJvamVjdE5hbWUsIHVzZXJPcHRpb25zKTtcbiAgLy8gV3JpdGluZyB0aGUgcmVzdWx0IHRvIHRoZSBmaWxlc3lzdGVtIGlzIHRoZSBkZWZhdWx0IGJlaGF2aW9yXG4gIGNvbnN0IHNob3VsZFdyaXRlUmVzdWx0ID0gaW5mcmFzdHJ1Y3R1cmVTZXR0aW5ncz8ud3JpdGUgIT09IGZhbHNlO1xuXG4gIGlmIChzaG91bGRXcml0ZVJlc3VsdCkge1xuICAgIC8vIENsZWFuIG91dHB1dCBwYXRoIGlmIGVuYWJsZWRcbiAgICBpZiAodXNlck9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aCkge1xuICAgICAgZGVsZXRlT3V0cHV0RGlyKG5vcm1hbGl6ZWRPcHRpb25zLndvcmtzcGFjZVJvb3QsIHVzZXJPcHRpb25zLm91dHB1dFBhdGgpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBvdXRwdXQgZGlyZWN0b3J5IGlmIG5lZWRlZFxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmcy5ta2Rpcihub3JtYWxpemVkT3B0aW9ucy5vdXRwdXRQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBhc3NlcnRJc0Vycm9yKGUpO1xuICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoJ1VuYWJsZSB0byBjcmVhdGUgb3V0cHV0IGRpcmVjdG9yeTogJyArIGUubWVzc2FnZSk7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cblxuICAvLyBJbml0aWFsIGJ1aWxkXG4gIGxldCByZXN1bHQ6IEV4ZWN1dGlvblJlc3VsdDtcbiAgdHJ5IHtcbiAgICByZXN1bHQgPSBhd2FpdCBleGVjdXRlKG5vcm1hbGl6ZWRPcHRpb25zLCBjb250ZXh0KTtcblxuICAgIGlmIChzaG91bGRXcml0ZVJlc3VsdCkge1xuICAgICAgLy8gV3JpdGUgb3V0cHV0IGZpbGVzXG4gICAgICBhd2FpdCB3cml0ZVJlc3VsdEZpbGVzKHJlc3VsdC5vdXRwdXRGaWxlcywgcmVzdWx0LmFzc2V0RmlsZXMsIG5vcm1hbGl6ZWRPcHRpb25zLm91dHB1dFBhdGgpO1xuXG4gICAgICB5aWVsZCByZXN1bHQub3V0cHV0O1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBSZXF1aXJlcyBjYXN0aW5nIGR1ZSB0byB1bm5lZWRlZCBgSnNvbk9iamVjdGAgcmVxdWlyZW1lbnQuIFJlbW92ZSBvbmNlIGZpeGVkLlxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIHlpZWxkIHJlc3VsdC5vdXRwdXRXaXRoRmlsZXMgYXMgYW55O1xuICAgIH1cblxuICAgIC8vIEZpbmlzaCBpZiB3YXRjaCBtb2RlIGlzIG5vdCBlbmFibGVkXG4gICAgaWYgKCF1c2VyT3B0aW9ucy53YXRjaCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICAvLyBFbnN1cmUgU2FzcyB3b3JrZXJzIGFyZSBzaHV0ZG93biBpZiBub3Qgd2F0Y2hpbmdcbiAgICBpZiAoIXVzZXJPcHRpb25zLndhdGNoKSB7XG4gICAgICBzaHV0ZG93blNhc3NXb3JrZXJQb29sKCk7XG4gICAgfVxuICB9XG5cbiAgY29udGV4dC5sb2dnZXIuaW5mbygnV2F0Y2ggbW9kZSBlbmFibGVkLiBXYXRjaGluZyBmb3IgZmlsZSBjaGFuZ2VzLi4uJyk7XG5cbiAgLy8gU2V0dXAgYSB3YXRjaGVyXG4gIGNvbnN0IHdhdGNoZXIgPSBjcmVhdGVXYXRjaGVyKHtcbiAgICBwb2xsaW5nOiB0eXBlb2YgdXNlck9wdGlvbnMucG9sbCA9PT0gJ251bWJlcicsXG4gICAgaW50ZXJ2YWw6IHVzZXJPcHRpb25zLnBvbGwsXG4gICAgLy8gSWdub3JlIHRoZSBvdXRwdXQgYW5kIGNhY2hlIHBhdGhzIHRvIGF2b2lkIGluZmluaXRlIHJlYnVpbGQgY3ljbGVzXG4gICAgaWdub3JlZDogW25vcm1hbGl6ZWRPcHRpb25zLm91dHB1dFBhdGgsIG5vcm1hbGl6ZWRPcHRpb25zLmNhY2hlT3B0aW9ucy5iYXNlUGF0aF0sXG4gIH0pO1xuXG4gIC8vIFRlbXBvcmFyaWx5IHdhdGNoIHRoZSBlbnRpcmUgcHJvamVjdFxuICB3YXRjaGVyLmFkZChub3JtYWxpemVkT3B0aW9ucy5wcm9qZWN0Um9vdCk7XG5cbiAgLy8gV2F0Y2ggd29ya3NwYWNlIHJvb3Qgbm9kZSBtb2R1bGVzXG4gIC8vIEluY2x1ZGVzIFlhcm4gUG5QIG1hbmlmZXN0IGZpbGVzIChodHRwczovL3lhcm5wa2cuY29tL2FkdmFuY2VkL3BucC1zcGVjLylcbiAgd2F0Y2hlci5hZGQocGF0aC5qb2luKG5vcm1hbGl6ZWRPcHRpb25zLndvcmtzcGFjZVJvb3QsICdub2RlX21vZHVsZXMnKSk7XG4gIHdhdGNoZXIuYWRkKHBhdGguam9pbihub3JtYWxpemVkT3B0aW9ucy53b3Jrc3BhY2VSb290LCAnLnBucC5janMnKSk7XG4gIHdhdGNoZXIuYWRkKHBhdGguam9pbihub3JtYWxpemVkT3B0aW9ucy53b3Jrc3BhY2VSb290LCAnLnBucC5kYXRhLmpzb24nKSk7XG5cbiAgLy8gV2FpdCBmb3IgY2hhbmdlcyBhbmQgcmVidWlsZCBhcyBuZWVkZWRcbiAgdHJ5IHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNoYW5nZXMgb2Ygd2F0Y2hlcikge1xuICAgICAgY29udGV4dC5sb2dnZXIuaW5mbygnQ2hhbmdlcyBkZXRlY3RlZC4gUmVidWlsZGluZy4uLicpO1xuXG4gICAgICBpZiAodXNlck9wdGlvbnMudmVyYm9zZSkge1xuICAgICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKGNoYW5nZXMudG9EZWJ1Z1N0cmluZygpKTtcbiAgICAgIH1cblxuICAgICAgcmVzdWx0ID0gYXdhaXQgZXhlY3V0ZShub3JtYWxpemVkT3B0aW9ucywgY29udGV4dCwgcmVzdWx0LmNyZWF0ZVJlYnVpbGRTdGF0ZShjaGFuZ2VzKSk7XG5cbiAgICAgIGlmIChzaG91bGRXcml0ZVJlc3VsdCkge1xuICAgICAgICAvLyBXcml0ZSBvdXRwdXQgZmlsZXNcbiAgICAgICAgYXdhaXQgd3JpdGVSZXN1bHRGaWxlcyhyZXN1bHQub3V0cHV0RmlsZXMsIHJlc3VsdC5hc3NldEZpbGVzLCBub3JtYWxpemVkT3B0aW9ucy5vdXRwdXRQYXRoKTtcblxuICAgICAgICB5aWVsZCByZXN1bHQub3V0cHV0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gUmVxdWlyZXMgY2FzdGluZyBkdWUgdG8gdW5uZWVkZWQgYEpzb25PYmplY3RgIHJlcXVpcmVtZW50LiBSZW1vdmUgb25jZSBmaXhlZC5cbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgeWllbGQgcmVzdWx0Lm91dHB1dFdpdGhGaWxlcyBhcyBhbnk7XG4gICAgICB9XG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIC8vIFN0b3AgdGhlIHdhdGNoZXJcbiAgICBhd2FpdCB3YXRjaGVyLmNsb3NlKCk7XG4gICAgLy8gQ2xlYW51cCBpbmNyZW1lbnRhbCByZWJ1aWxkIHN0YXRlXG4gICAgYXdhaXQgcmVzdWx0LmRpc3Bvc2UoKTtcbiAgICBzaHV0ZG93blNhc3NXb3JrZXJQb29sKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcihidWlsZEVzYnVpbGRCcm93c2VyKTtcbiJdfQ==