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
exports.buildEsbuildBrowserInternal = exports.buildEsbuildBrowser = void 0;
const architect_1 = require("@angular-devkit/architect");
const node_fs_1 = require("node:fs");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_util_1 = require("node:util");
const node_zlib_1 = require("node:zlib");
const copy_assets_1 = require("../../utils/copy-assets");
const error_1 = require("../../utils/error");
const esbuild_targets_1 = require("../../utils/esbuild-targets");
const index_html_generator_1 = require("../../utils/index-file/index-html-generator");
const service_worker_1 = require("../../utils/service-worker");
const spinner_1 = require("../../utils/spinner");
const supported_browsers_1 = require("../../utils/supported-browsers");
const stats_1 = require("../../webpack/utils/stats");
const compiler_plugin_1 = require("./angular/compiler-plugin");
const builder_status_warnings_1 = require("./builder-status-warnings");
const commonjs_checker_1 = require("./commonjs-checker");
const esbuild_1 = require("./esbuild");
const global_scripts_1 = require("./global-scripts");
const global_styles_1 = require("./global-styles");
const license_extractor_1 = require("./license-extractor");
const options_1 = require("./options");
const sourcemap_ignorelist_plugin_1 = require("./sourcemap-ignorelist-plugin");
const sass_language_1 = require("./stylesheets/sass-language");
const compressAsync = (0, node_util_1.promisify)(node_zlib_1.brotliCompress);
/**
 * Represents the result of a single builder execute call.
 */
class ExecutionResult {
    constructor(rebuildContexts, codeBundleCache) {
        this.rebuildContexts = rebuildContexts;
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
    get watchFiles() {
        return this.codeBundleCache?.referencedFiles ?? [];
    }
    createRebuildState(fileChanges) {
        this.codeBundleCache?.invalidate([...fileChanges.modified, ...fileChanges.removed]);
        return {
            rebuildContexts: this.rebuildContexts,
            codeBundleCache: this.codeBundleCache,
            fileChanges,
        };
    }
    async dispose() {
        await Promise.allSettled(this.rebuildContexts.map((context) => context.dispose()));
    }
}
async function execute(options, context, rebuildState) {
    const startTime = process.hrtime.bigint();
    const { projectRoot, workspaceRoot, optimizationOptions, assets, serviceWorkerOptions, indexHtmlOptions, cacheOptions, } = options;
    const browsers = (0, supported_browsers_1.getSupportedBrowsers)(projectRoot, context.logger);
    const target = (0, esbuild_targets_1.transformSupportedBrowsersToTargets)(browsers);
    // Reuse rebuild state or create new bundle contexts for code and global stylesheets
    let bundlerContexts = rebuildState?.rebuildContexts;
    const codeBundleCache = rebuildState?.codeBundleCache ??
        new compiler_plugin_1.SourceFileCache(cacheOptions.enabled ? cacheOptions.path : undefined);
    if (bundlerContexts === undefined) {
        bundlerContexts = [];
        // Application code
        bundlerContexts.push(new esbuild_1.BundlerContext(workspaceRoot, !!options.watch, createCodeBundleOptions(options, target, browsers, codeBundleCache)));
        // Global Stylesheets
        if (options.globalStyles.length > 0) {
            for (const initial of [true, false]) {
                const bundleOptions = (0, global_styles_1.createGlobalStylesBundleOptions)(options, target, browsers, initial, codeBundleCache?.loadResultCache);
                if (bundleOptions) {
                    bundlerContexts.push(new esbuild_1.BundlerContext(workspaceRoot, !!options.watch, bundleOptions));
                }
            }
        }
        // Global Scripts
        if (options.globalScripts.length > 0) {
            for (const initial of [true, false]) {
                const bundleOptions = (0, global_scripts_1.createGlobalScriptsBundleOptions)(options, initial);
                if (bundleOptions) {
                    bundlerContexts.push(new esbuild_1.BundlerContext(workspaceRoot, !!options.watch, bundleOptions));
                }
            }
        }
    }
    const bundlingResult = await esbuild_1.BundlerContext.bundleAll(bundlerContexts);
    // Log all warnings and errors generated during bundling
    await (0, esbuild_1.logMessages)(context, bundlingResult);
    const executionResult = new ExecutionResult(bundlerContexts, codeBundleCache);
    // Return if the bundling has errors
    if (bundlingResult.errors) {
        return executionResult;
    }
    // Filter global stylesheet initial files. Currently all initial CSS files are from the global styles option.
    if (options.globalStyles.length > 0) {
        bundlingResult.initialFiles = bundlingResult.initialFiles.filter(({ file, name }) => !file.endsWith('.css') ||
            options.globalStyles.find((style) => style.name === name)?.initial);
    }
    const { metafile, initialFiles, outputFiles } = bundlingResult;
    executionResult.outputFiles.push(...outputFiles);
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
    // Calculate estimated transfer size if scripts are optimized
    let estimatedTransferSizes;
    if (optimizationOptions.scripts || optimizationOptions.styles.minify) {
        estimatedTransferSizes = await calculateEstimatedTransferSizes(executionResult.outputFiles);
    }
    logBuildStats(context, metafile, initialFiles, estimatedTransferSizes);
    const buildTime = Number(process.hrtime.bigint() - startTime) / 10 ** 9;
    context.logger.info(`Application bundle generation complete. [${buildTime.toFixed(3)} seconds]`);
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
            await promises_1.default.copyFile(source, node_path_1.default.join(outputPath, destination), node_fs_1.constants.COPYFILE_FICLONE);
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
    const { workspaceRoot, entryPoints, optimizationOptions, sourcemapOptions, tsconfig, outputNames, outExtension, fileReplacements, externalDependencies, preserveSymlinks, stylePreprocessorOptions, advancedOptimizations, inlineStyleLanguage, jit, tailwindConfiguration, } = options;
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
        outExtension: outExtension ? { '.js': `.${outExtension}` } : undefined,
        sourcemap: sourcemapOptions.scripts && (sourcemapOptions.hidden ? 'external' : true),
        splitting: true,
        tsconfig,
        external: externalDependencies,
        write: false,
        platform: 'browser',
        preserveSymlinks,
        plugins: [
            (0, sourcemap_ignorelist_plugin_1.createSourcemapIngorelistPlugin)(),
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
                loadResultCache: sourceFileCache?.loadResultCache,
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
                preserveSymlinks,
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
    const polyfills = options.polyfills ? [...options.polyfills] : [];
    if (jit) {
        polyfills.push('@angular/compiler');
    }
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
        // esbuild currently has a defect involving self-referencing a class within a static code block or
        // static field initializer. This is not an issue for projects that use the default browserslist as these
        // elements are an ES2022 feature which is not support by all browsers in the default list. However, if a
        // custom browserslist is used that only has newer browsers than the static code elements may be present.
        // This issue is compounded by the default usage of the tsconfig `"useDefineForClassFields": false` option
        // present in generated CLI projects which causes static code blocks to be used instead of static fields.
        // esbuild currently unconditionally downlevels all static fields in top-level classes so to workaround the
        // Angular issue only static code blocks are disabled here.
        // For more details: https://github.com/evanw/esbuild/issues/2950
        'class-static-blocks': false,
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
function buildEsbuildBrowser(userOptions, context, infrastructureSettings) {
    return buildEsbuildBrowserInternal(userOptions, context, infrastructureSettings);
}
exports.buildEsbuildBrowser = buildEsbuildBrowser;
/**
 * Internal version of the main execution function for the esbuild-based application builder.
 * Exposes some additional "private" options in addition to those exposed by the schema.
 * @param userOptions The browser-esbuild builder options to use when setting up the application build
 * @param context The Architect builder context object
 * @returns An async iterable with the builder result output
 */
async function* buildEsbuildBrowserInternal(userOptions, context, infrastructureSettings) {
    // Inform user of status of builder and options
    (0, builder_status_warnings_1.logBuilderStatusWarnings)(userOptions, context);
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
            if (normalizedOptions.outputPath === normalizedOptions.workspaceRoot) {
                context.logger.error('Output path MUST not be workspace root directory!');
                return;
            }
            await promises_1.default.rm(normalizedOptions.outputPath, { force: true, recursive: true, maxRetries: 3 });
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
            (0, sass_language_1.shutdownSassWorkerPool)();
        }
    }
    if (normalizedOptions.progress) {
        context.logger.info('Watch mode enabled. Watching for file changes...');
    }
    // Setup a watcher
    const { createWatcher } = await Promise.resolve().then(() => __importStar(require('./watcher')));
    const watcher = createWatcher({
        polling: typeof userOptions.poll === 'number',
        interval: userOptions.poll,
        ignored: [
            // Ignore the output and cache paths to avoid infinite rebuild cycles
            normalizedOptions.outputPath,
            normalizedOptions.cacheOptions.basePath,
            // Ignore all node modules directories to avoid excessive file watchers.
            // Package changes are handled below by watching manifest and lock files.
            '**/node_modules/**',
        ],
    });
    // Temporarily watch the entire project
    watcher.add(normalizedOptions.projectRoot);
    // Watch workspace for package manager changes
    const packageWatchFiles = [
        // manifest can affect module resolution
        'package.json',
        // npm lock file
        'package-lock.json',
        // pnpm lock file
        'pnpm-lock.yaml',
        // yarn lock file including Yarn PnP manifest files (https://yarnpkg.com/advanced/pnp-spec/)
        'yarn.lock',
        '.pnp.cjs',
        '.pnp.data.json',
    ];
    watcher.add(packageWatchFiles.map((file) => node_path_1.default.join(normalizedOptions.workspaceRoot, file)));
    // Watch locations provided by the initial build result
    let previousWatchFiles = new Set(result.watchFiles);
    watcher.add(result.watchFiles);
    // Wait for changes and rebuild as needed
    try {
        for await (const changes of watcher) {
            if (userOptions.verbose) {
                context.logger.info(changes.toDebugString());
            }
            result = await withProgress('Changes detected. Rebuilding...', () => execute(normalizedOptions, context, result.createRebuildState(changes)));
            // Update watched locations provided by the new build result.
            // Add any new locations
            watcher.add(result.watchFiles.filter((watchFile) => !previousWatchFiles.has(watchFile)));
            const newWatchFiles = new Set(result.watchFiles);
            // Remove any old locations
            watcher.remove([...previousWatchFiles].filter((watchFile) => !newWatchFiles.has(watchFile)));
            previousWatchFiles = newWatchFiles;
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
        (0, sass_language_1.shutdownSassWorkerPool)();
    }
}
exports.buildEsbuildBrowserInternal = buildEsbuildBrowserInternal;
exports.default = (0, architect_1.createBuilder)(buildEsbuildBrowser);
function logBuildStats(context, metafile, initialFiles, estimatedTransferSizes) {
    const initial = new Map(initialFiles.map((info) => [info.file, info.name]));
    const stats = [];
    for (const [file, output] of Object.entries(metafile.outputs)) {
        // Only display JavaScript and CSS files
        if (!file.endsWith('.js') && !file.endsWith('.css')) {
            continue;
        }
        // Skip internal component resources
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (output['ng-component']) {
            continue;
        }
        stats.push({
            initial: initial.has(file),
            stats: [
                file,
                initial.get(file) ?? '-',
                output.bytes,
                estimatedTransferSizes?.get(file) ?? '-',
            ],
        });
    }
    const tableText = (0, stats_1.generateBuildStatsTable)(stats, true, true, !!estimatedTransferSizes, undefined);
    context.logger.info('\n' + tableText + '\n');
}
async function calculateEstimatedTransferSizes(outputFiles) {
    const sizes = new Map();
    const pendingCompression = [];
    for (const outputFile of outputFiles) {
        // Only calculate JavaScript and CSS files
        if (!outputFile.path.endsWith('.js') && !outputFile.path.endsWith('.css')) {
            continue;
        }
        // Skip compressing small files which may end being larger once compressed and will most likely not be
        // compressed in actual transit.
        if (outputFile.contents.byteLength < 1024) {
            sizes.set(outputFile.path, outputFile.contents.byteLength);
            continue;
        }
        pendingCompression.push(compressAsync(outputFile.contents).then((result) => sizes.set(outputFile.path, result.byteLength)));
    }
    await Promise.all(pendingCompression);
    return sizes;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFFekYscUNBQW1EO0FBQ25ELGdFQUFrQztBQUNsQywwREFBNkI7QUFDN0IseUNBQXNDO0FBQ3RDLHlDQUEyQztBQUMzQyx5REFBcUQ7QUFDckQsNkNBQWtEO0FBQ2xELGlFQUFrRjtBQUVsRixzRkFBaUY7QUFDakYsK0RBQWdGO0FBQ2hGLGlEQUE4QztBQUM5Qyx1RUFBc0U7QUFDdEUscURBQWlGO0FBQ2pGLCtEQUFrRjtBQUNsRix1RUFBcUU7QUFDckUseURBQTBEO0FBQzFELHVDQUF3RDtBQUN4RCxxREFBb0U7QUFDcEUsbURBQWtFO0FBQ2xFLDJEQUFzRDtBQUN0RCx1Q0FBOEY7QUFFOUYsK0VBQWdGO0FBQ2hGLCtEQUFxRTtBQUdyRSxNQUFNLGFBQWEsR0FBRyxJQUFBLHFCQUFTLEVBQUMsMEJBQWMsQ0FBQyxDQUFDO0FBUWhEOztHQUVHO0FBQ0gsTUFBTSxlQUFlO0lBSW5CLFlBQ1UsZUFBaUMsRUFDakMsZUFBaUM7UUFEakMsb0JBQWUsR0FBZixlQUFlLENBQWtCO1FBQ2pDLG9CQUFlLEdBQWYsZUFBZSxDQUFrQjtRQUxsQyxnQkFBVyxHQUFpQixFQUFFLENBQUM7UUFDL0IsZUFBVSxHQUE4QyxFQUFFLENBQUM7SUFLakUsQ0FBQztJQUVKLGFBQWEsQ0FBQyxJQUFZLEVBQUUsT0FBZTtRQUN6QyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRUQsSUFB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SUFBSSxDQUFDLENBQUM7QUFDL0MsQ0FBQztBQUVELEtBQUssVUFBVSwrQkFBK0IsQ0FBQyxXQUF5QjtJQUN0RSxNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztJQUV4QyxNQUFNLGtCQUFrQixHQUFHLEVBQUUsQ0FBQztJQUM5QixLQUFLLE1BQU0sVUFBVSxJQUFJLFdBQVcsRUFBRTtRQUNwQywwQ0FBMEM7UUFDMUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDekUsU0FBUztTQUNWO1FBRUQsc0dBQXNHO1FBQ3RHLGdDQUFnQztRQUNoQyxJQUFJLFVBQVUsQ0FBQyxRQUFRLENBQUMsVUFBVSxHQUFHLElBQUksRUFBRTtZQUN6QyxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUMzRCxTQUFTO1NBQ1Y7UUFFRCxrQkFBa0IsQ0FBQyxJQUFJLENBQ3JCLGFBQWEsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FDakQsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FDOUMsQ0FDRixDQUFDO0tBQ0g7SUFFRCxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUV0QyxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zLCBNZXRhZmlsZSwgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgY29uc3RhbnRzIGFzIGZzQ29uc3RhbnRzIH0gZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAnbm9kZTp1dGlsJztcbmltcG9ydCB7IGJyb3RsaUNvbXByZXNzIH0gZnJvbSAnbm9kZTp6bGliJztcbmltcG9ydCB7IGNvcHlBc3NldHMgfSBmcm9tICcuLi8uLi91dGlscy9jb3B5LWFzc2V0cyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMgfSBmcm9tICcuLi8uLi91dGlscy9lc2J1aWxkLXRhcmdldHMnO1xuaW1wb3J0IHsgRmlsZUluZm8gfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2F1Z21lbnQtaW5kZXgtaHRtbCc7XG5pbXBvcnQgeyBJbmRleEh0bWxHZW5lcmF0b3IgfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2luZGV4LWh0bWwtZ2VuZXJhdG9yJztcbmltcG9ydCB7IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlckVzYnVpbGQgfSBmcm9tICcuLi8uLi91dGlscy9zZXJ2aWNlLXdvcmtlcic7XG5pbXBvcnQgeyBTcGlubmVyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lcic7XG5pbXBvcnQgeyBnZXRTdXBwb3J0ZWRCcm93c2VycyB9IGZyb20gJy4uLy4uL3V0aWxzL3N1cHBvcnRlZC1icm93c2Vycyc7XG5pbXBvcnQgeyBCdW5kbGVTdGF0cywgZ2VuZXJhdGVCdWlsZFN0YXRzVGFibGUgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL3N0YXRzJztcbmltcG9ydCB7IFNvdXJjZUZpbGVDYWNoZSwgY3JlYXRlQ29tcGlsZXJQbHVnaW4gfSBmcm9tICcuL2FuZ3VsYXIvY29tcGlsZXItcGx1Z2luJztcbmltcG9ydCB7IGxvZ0J1aWxkZXJTdGF0dXNXYXJuaW5ncyB9IGZyb20gJy4vYnVpbGRlci1zdGF0dXMtd2FybmluZ3MnO1xuaW1wb3J0IHsgY2hlY2tDb21tb25KU01vZHVsZXMgfSBmcm9tICcuL2NvbW1vbmpzLWNoZWNrZXInO1xuaW1wb3J0IHsgQnVuZGxlckNvbnRleHQsIGxvZ01lc3NhZ2VzIH0gZnJvbSAnLi9lc2J1aWxkJztcbmltcG9ydCB7IGNyZWF0ZUdsb2JhbFNjcmlwdHNCdW5kbGVPcHRpb25zIH0gZnJvbSAnLi9nbG9iYWwtc2NyaXB0cyc7XG5pbXBvcnQgeyBjcmVhdGVHbG9iYWxTdHlsZXNCdW5kbGVPcHRpb25zIH0gZnJvbSAnLi9nbG9iYWwtc3R5bGVzJztcbmltcG9ydCB7IGV4dHJhY3RMaWNlbnNlcyB9IGZyb20gJy4vbGljZW5zZS1leHRyYWN0b3InO1xuaW1wb3J0IHsgQnJvd3NlckVzYnVpbGRPcHRpb25zLCBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMsIG5vcm1hbGl6ZU9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB7IGNyZWF0ZVNvdXJjZW1hcEluZ29yZWxpc3RQbHVnaW4gfSBmcm9tICcuL3NvdXJjZW1hcC1pZ25vcmVsaXN0LXBsdWdpbic7XG5pbXBvcnQgeyBzaHV0ZG93blNhc3NXb3JrZXJQb29sIH0gZnJvbSAnLi9zdHlsZXNoZWV0cy9zYXNzLWxhbmd1YWdlJztcbmltcG9ydCB0eXBlIHsgQ2hhbmdlZEZpbGVzIH0gZnJvbSAnLi93YXRjaGVyJztcblxuY29uc3QgY29tcHJlc3NBc3luYyA9IHByb21pc2lmeShicm90bGlDb21wcmVzcyk7XG5cbmludGVyZmFjZSBSZWJ1aWxkU3RhdGUge1xuICByZWJ1aWxkQ29udGV4dHM6IEJ1bmRsZXJDb250ZXh0W107XG4gIGNvZGVCdW5kbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZTtcbiAgZmlsZUNoYW5nZXM6IENoYW5nZWRGaWxlcztcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIHRoZSByZXN1bHQgb2YgYSBzaW5nbGUgYnVpbGRlciBleGVjdXRlIGNhbGwuXG4gKi9cbmNsYXNzIEV4ZWN1dGlvblJlc3VsdCB7XG4gIHJlYWRvbmx5IG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW10gPSBbXTtcbiAgcmVhZG9ubHkgYXNzZXRGaWxlczogeyBzb3VyY2U6IHN0cmluZzsgZGVzdGluYXRpb246IHN0cmluZyB9W10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYnVpbGRDb250ZXh0czogQnVuZGxlckNvbnRleHRbXSxcbiAgICBwcml2YXRlIGNvZGVCdW5kbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZSxcbiAgKSB7fVxuXG4gIGFkZE91dHB1dEZpbGUocGF0aDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLm91dHB1dEZpbGVzLnB1c2goY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHBhdGgsIGNvbnRlbnQpKTtcbiAgfVxuXG4gIGdldCBvdXRwdXQoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRoaXMub3V0cHV0RmlsZXMubGVuZ3RoID4gMCxcbiAgICB9O1xuICB9XG5cbiAgZ2V0IG91dHB1dFdpdGhGaWxlcygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdGhpcy5vdXRwdXRGaWxlcy5sZW5ndGggPiAwLFxuICAgICAgb3V0cHV0RmlsZXM6IHRoaXMub3V0cHV0RmlsZXMsXG4gICAgICBhc3NldEZpbGVzOiB0aGlzLmFzc2V0RmlsZXMsXG4gICAgfTtcbiAgfVxuXG4gIGdldCB3YXRjaEZpbGVzKCkge1xuICAgIHJldHVybiB0aGlzLmNvZGVCdW5kbGVDYWNoZT8ucmVmZXJlbmNlZEZpbGVzID8/IFtdO1xuICB9XG5cbiAgY3JlYXRlUmVidWlsZFN0YXRlKGZpbGVDaGFuZ2VzOiBDaGFuZ2VkRmlsZXMpOiBSZWJ1aWxkU3RhdGUge1xuICAgIHRoaXMuY29kZUJ1bmRsZUNhY2hlPy5pbnZhbGlkYXRlKFsuLi5maWxlQ2hhbmdlcy5tb2RpZmllZCwgLi4uZmlsZUNoYW5nZXMucmVtb3ZlZF0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHJlYnVpbGRDb250ZXh0czogdGhpcy5yZWJ1aWxkQ29udGV4dHMsXG4gICAgICBjb2RlQnVuZGxlQ2FjaGU6IHRoaXMuY29kZUJ1bmRsZUNhY2hlLFxuICAgICAgZmlsZUNoYW5nZXMsXG4gICAgfTtcbiAgfVxuXG4gIGFzeW5jIGRpc3Bvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHRoaXMucmVidWlsZENvbnRleHRzLm1hcCgoY29udGV4dCkgPT4gY29udGV4dC5kaXNwb3NlKCkpKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBleGVjdXRlKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICByZWJ1aWxkU3RhdGU/OiBSZWJ1aWxkU3RhdGUsXG4pOiBQcm9taXNlPEV4ZWN1dGlvblJlc3VsdD4ge1xuICBjb25zdCBzdGFydFRpbWUgPSBwcm9jZXNzLmhydGltZS5iaWdpbnQoKTtcblxuICBjb25zdCB7XG4gICAgcHJvamVjdFJvb3QsXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIGFzc2V0cyxcbiAgICBzZXJ2aWNlV29ya2VyT3B0aW9ucyxcbiAgICBpbmRleEh0bWxPcHRpb25zLFxuICAgIGNhY2hlT3B0aW9ucyxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgYnJvd3NlcnMgPSBnZXRTdXBwb3J0ZWRCcm93c2Vycyhwcm9qZWN0Um9vdCwgY29udGV4dC5sb2dnZXIpO1xuICBjb25zdCB0YXJnZXQgPSB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyhicm93c2Vycyk7XG5cbiAgLy8gUmV1c2UgcmVidWlsZCBzdGF0ZSBvciBjcmVhdGUgbmV3IGJ1bmRsZSBjb250ZXh0cyBmb3IgY29kZSBhbmQgZ2xvYmFsIHN0eWxlc2hlZXRzXG4gIGxldCBidW5kbGVyQ29udGV4dHMgPSByZWJ1aWxkU3RhdGU/LnJlYnVpbGRDb250ZXh0cztcbiAgY29uc3QgY29kZUJ1bmRsZUNhY2hlID1cbiAgICByZWJ1aWxkU3RhdGU/LmNvZGVCdW5kbGVDYWNoZSA/P1xuICAgIG5ldyBTb3VyY2VGaWxlQ2FjaGUoY2FjaGVPcHRpb25zLmVuYWJsZWQgPyBjYWNoZU9wdGlvbnMucGF0aCA6IHVuZGVmaW5lZCk7XG4gIGlmIChidW5kbGVyQ29udGV4dHMgPT09IHVuZGVmaW5lZCkge1xuICAgIGJ1bmRsZXJDb250ZXh0cyA9IFtdO1xuXG4gICAgLy8gQXBwbGljYXRpb24gY29kZVxuICAgIGJ1bmRsZXJDb250ZXh0cy5wdXNoKFxuICAgICAgbmV3IEJ1bmRsZXJDb250ZXh0KFxuICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICAhIW9wdGlvbnMud2F0Y2gsXG4gICAgICAgIGNyZWF0ZUNvZGVCdW5kbGVPcHRpb25zKG9wdGlvbnMsIHRhcmdldCwgYnJvd3NlcnMsIGNvZGVCdW5kbGVDYWNoZSksXG4gICAgICApLFxuICAgICk7XG5cbiAgICAvLyBHbG9iYWwgU3R5bGVzaGVldHNcbiAgICBpZiAob3B0aW9ucy5nbG9iYWxTdHlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgZm9yIChjb25zdCBpbml0aWFsIG9mIFt0cnVlLCBmYWxzZV0pIHtcbiAgICAgICAgY29uc3QgYnVuZGxlT3B0aW9ucyA9IGNyZWF0ZUdsb2JhbFN0eWxlc0J1bmRsZU9wdGlvbnMoXG4gICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgYnJvd3NlcnMsXG4gICAgICAgICAgaW5pdGlhbCxcbiAgICAgICAgICBjb2RlQnVuZGxlQ2FjaGU/LmxvYWRSZXN1bHRDYWNoZSxcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKGJ1bmRsZU9wdGlvbnMpIHtcbiAgICAgICAgICBidW5kbGVyQ29udGV4dHMucHVzaChuZXcgQnVuZGxlckNvbnRleHQod29ya3NwYWNlUm9vdCwgISFvcHRpb25zLndhdGNoLCBidW5kbGVPcHRpb25zKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBHbG9iYWwgU2NyaXB0c1xuICAgIGlmIChvcHRpb25zLmdsb2JhbFNjcmlwdHMubGVuZ3RoID4gMCkge1xuICAgICAgZm9yIChjb25zdCBpbml0aWFsIG9mIFt0cnVlLCBmYWxzZV0pIHtcbiAgICAgICAgY29uc3QgYnVuZGxlT3B0aW9ucyA9IGNyZWF0ZUdsb2JhbFNjcmlwdHNCdW5kbGVPcHRpb25zKG9wdGlvbnMsIGluaXRpYWwpO1xuICAgICAgICBpZiAoYnVuZGxlT3B0aW9ucykge1xuICAgICAgICAgIGJ1bmRsZXJDb250ZXh0cy5wdXNoKG5ldyBCdW5kbGVyQ29udGV4dCh3b3Jrc3BhY2VSb290LCAhIW9wdGlvbnMud2F0Y2gsIGJ1bmRsZU9wdGlvbnMpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGJ1bmRsaW5nUmVzdWx0ID0gYXdhaXQgQnVuZGxlckNvbnRleHQuYnVuZGxlQWxsKGJ1bmRsZXJDb250ZXh0cyk7XG5cbiAgLy8gTG9nIGFsbCB3YXJuaW5ncyBhbmQgZXJyb3JzIGdlbmVyYXRlZCBkdXJpbmcgYnVuZGxpbmdcbiAgYXdhaXQgbG9nTWVzc2FnZXMoY29udGV4dCwgYnVuZGxpbmdSZXN1bHQpO1xuXG4gIGNvbnN0IGV4ZWN1dGlvblJlc3VsdCA9IG5ldyBFeGVjdXRpb25SZXN1bHQoYnVuZGxlckNvbnRleHRzLCBjb2RlQnVuZGxlQ2FjaGUpO1xuXG4gIC8vIFJldHVybiBpZiB0aGUgYnVuZGxpbmcgaGFzIGVycm9yc1xuICBpZiAoYnVuZGxpbmdSZXN1bHQuZXJyb3JzKSB7XG4gICAgcmV0dXJuIGV4ZWN1dGlvblJlc3VsdDtcbiAgfVxuXG4gIC8vIEZpbHRlciBnbG9iYWwgc3R5bGVzaGVldCBpbml0aWFsIGZpbGVzLiBDdXJyZW50bHkgYWxsIGluaXRpYWwgQ1NTIGZpbGVzIGFyZSBmcm9tIHRoZSBnbG9iYWwgc3R5bGVzIG9wdGlvbi5cbiAgaWYgKG9wdGlvbnMuZ2xvYmFsU3R5bGVzLmxlbmd0aCA+IDApIHtcbiAgICBidW5kbGluZ1Jlc3VsdC5pbml0aWFsRmlsZXMgPSBidW5kbGluZ1Jlc3VsdC5pbml0aWFsRmlsZXMuZmlsdGVyKFxuICAgICAgKHsgZmlsZSwgbmFtZSB9KSA9PlxuICAgICAgICAhZmlsZS5lbmRzV2l0aCgnLmNzcycpIHx8XG4gICAgICAgIG9wdGlvbnMuZ2xvYmFsU3R5bGVzLmZpbmQoKHN0eWxlKSA9PiBzdHlsZS5uYW1lID09PSBuYW1lKT8uaW5pdGlhbCxcbiAgICApO1xuICB9XG5cbiAgY29uc3QgeyBtZXRhZmlsZSwgaW5pdGlhbEZpbGVzLCBvdXRwdXRGaWxlcyB9ID0gYnVuZGxpbmdSZXN1bHQ7XG5cbiAgZXhlY3V0aW9uUmVzdWx0Lm91dHB1dEZpbGVzLnB1c2goLi4ub3V0cHV0RmlsZXMpO1xuXG4gIC8vIENoZWNrIG1ldGFmaWxlIGZvciBDb21tb25KUyBtb2R1bGUgdXNhZ2UgaWYgb3B0aW1pemluZyBzY3JpcHRzXG4gIGlmIChvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMpIHtcbiAgICBjb25zdCBtZXNzYWdlcyA9IGNoZWNrQ29tbW9uSlNNb2R1bGVzKG1ldGFmaWxlLCBvcHRpb25zLmFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyk7XG4gICAgYXdhaXQgbG9nTWVzc2FnZXMoY29udGV4dCwgeyB3YXJuaW5nczogbWVzc2FnZXMgfSk7XG4gIH1cblxuICAvLyBHZW5lcmF0ZSBpbmRleCBIVE1MIGZpbGVcbiAgaWYgKGluZGV4SHRtbE9wdGlvbnMpIHtcbiAgICAvLyBDcmVhdGUgYW4gaW5kZXggSFRNTCBnZW5lcmF0b3IgdGhhdCByZWFkcyBmcm9tIHRoZSBpbi1tZW1vcnkgb3V0cHV0IGZpbGVzXG4gICAgY29uc3QgaW5kZXhIdG1sR2VuZXJhdG9yID0gbmV3IEluZGV4SHRtbEdlbmVyYXRvcih7XG4gICAgICBpbmRleFBhdGg6IGluZGV4SHRtbE9wdGlvbnMuaW5wdXQsXG4gICAgICBlbnRyeXBvaW50czogaW5kZXhIdG1sT3B0aW9ucy5pbnNlcnRpb25PcmRlcixcbiAgICAgIHNyaTogb3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSxcbiAgICAgIG9wdGltaXphdGlvbjogb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICAgIGNyb3NzT3JpZ2luOiBvcHRpb25zLmNyb3NzT3JpZ2luLFxuICAgIH0pO1xuXG4gICAgLyoqIFZpcnR1YWwgb3V0cHV0IHBhdGggdG8gc3VwcG9ydCByZWFkaW5nIGluLW1lbW9yeSBmaWxlcy4gKi9cbiAgICBjb25zdCB2aXJ0dWFsT3V0cHV0UGF0aCA9ICcvJztcbiAgICBpbmRleEh0bWxHZW5lcmF0b3IucmVhZEFzc2V0ID0gYXN5bmMgZnVuY3Rpb24gKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgLy8gUmVtb3ZlIGxlYWRpbmcgZGlyZWN0b3J5IHNlcGFyYXRvclxuICAgICAgY29uc3QgcmVsYXRpdmVmaWxlUGF0aCA9IHBhdGgucmVsYXRpdmUodmlydHVhbE91dHB1dFBhdGgsIGZpbGVQYXRoKTtcbiAgICAgIGNvbnN0IGZpbGUgPSBleGVjdXRpb25SZXN1bHQub3V0cHV0RmlsZXMuZmluZCgoZmlsZSkgPT4gZmlsZS5wYXRoID09PSByZWxhdGl2ZWZpbGVQYXRoKTtcbiAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgIHJldHVybiBmaWxlLnRleHQ7XG4gICAgICB9XG5cbiAgICAgIHRocm93IG5ldyBFcnJvcihgT3V0cHV0IGZpbGUgZG9lcyBub3QgZXhpc3Q6ICR7cGF0aH1gKTtcbiAgICB9O1xuXG4gICAgY29uc3QgeyBjb250ZW50LCB3YXJuaW5ncywgZXJyb3JzIH0gPSBhd2FpdCBpbmRleEh0bWxHZW5lcmF0b3IucHJvY2Vzcyh7XG4gICAgICBiYXNlSHJlZjogb3B0aW9ucy5iYXNlSHJlZixcbiAgICAgIGxhbmc6IHVuZGVmaW5lZCxcbiAgICAgIG91dHB1dFBhdGg6IHZpcnR1YWxPdXRwdXRQYXRoLFxuICAgICAgZmlsZXM6IGluaXRpYWxGaWxlcyxcbiAgICB9KTtcblxuICAgIGZvciAoY29uc3QgZXJyb3Igb2YgZXJyb3JzKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihlcnJvcik7XG4gICAgfVxuICAgIGZvciAoY29uc3Qgd2FybmluZyBvZiB3YXJuaW5ncykge1xuICAgICAgY29udGV4dC5sb2dnZXIud2Fybih3YXJuaW5nKTtcbiAgICB9XG5cbiAgICBleGVjdXRpb25SZXN1bHQuYWRkT3V0cHV0RmlsZShpbmRleEh0bWxPcHRpb25zLm91dHB1dCwgY29udGVudCk7XG4gIH1cblxuICAvLyBDb3B5IGFzc2V0c1xuICBpZiAoYXNzZXRzKSB7XG4gICAgLy8gVGhlIHdlYnBhY2sgY29weSBhc3NldHMgaGVscGVyIGlzIHVzZWQgd2l0aCBubyBiYXNlIHBhdGhzIGRlZmluZWQuIFRoaXMgcHJldmVudHMgdGhlIGhlbHBlclxuICAgIC8vIGZyb20gZGlyZWN0bHkgd3JpdGluZyB0byBkaXNrLiBUaGlzIHNob3VsZCBldmVudHVhbGx5IGJlIHJlcGxhY2VkIHdpdGggYSBtb3JlIG9wdGltaXplZCBoZWxwZXIuXG4gICAgZXhlY3V0aW9uUmVzdWx0LmFzc2V0RmlsZXMucHVzaCguLi4oYXdhaXQgY29weUFzc2V0cyhhc3NldHMsIFtdLCB3b3Jrc3BhY2VSb290KSkpO1xuICB9XG5cbiAgLy8gV3JpdGUgbWV0YWZpbGUgaWYgc3RhdHMgb3B0aW9uIGlzIGVuYWJsZWRcbiAgaWYgKG9wdGlvbnMuc3RhdHMpIHtcbiAgICBleGVjdXRpb25SZXN1bHQuYWRkT3V0cHV0RmlsZSgnc3RhdHMuanNvbicsIEpTT04uc3RyaW5naWZ5KG1ldGFmaWxlLCBudWxsLCAyKSk7XG4gIH1cblxuICAvLyBFeHRyYWN0IGFuZCB3cml0ZSBsaWNlbnNlcyBmb3IgdXNlZCBwYWNrYWdlc1xuICBpZiAob3B0aW9ucy5leHRyYWN0TGljZW5zZXMpIHtcbiAgICBleGVjdXRpb25SZXN1bHQuYWRkT3V0cHV0RmlsZShcbiAgICAgICczcmRwYXJ0eWxpY2Vuc2VzLnR4dCcsXG4gICAgICBhd2FpdCBleHRyYWN0TGljZW5zZXMobWV0YWZpbGUsIHdvcmtzcGFjZVJvb3QpLFxuICAgICk7XG4gIH1cblxuICAvLyBBdWdtZW50IHRoZSBhcHBsaWNhdGlvbiB3aXRoIHNlcnZpY2Ugd29ya2VyIHN1cHBvcnRcbiAgaWYgKHNlcnZpY2VXb3JrZXJPcHRpb25zKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNlcnZpY2VXb3JrZXJSZXN1bHQgPSBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXJFc2J1aWxkKFxuICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICBzZXJ2aWNlV29ya2VyT3B0aW9ucyxcbiAgICAgICAgb3B0aW9ucy5iYXNlSHJlZiB8fCAnLycsXG4gICAgICAgIGV4ZWN1dGlvblJlc3VsdC5vdXRwdXRGaWxlcyxcbiAgICAgICAgZXhlY3V0aW9uUmVzdWx0LmFzc2V0RmlsZXMsXG4gICAgICApO1xuICAgICAgZXhlY3V0aW9uUmVzdWx0LmFkZE91dHB1dEZpbGUoJ25nc3cuanNvbicsIHNlcnZpY2VXb3JrZXJSZXN1bHQubWFuaWZlc3QpO1xuICAgICAgZXhlY3V0aW9uUmVzdWx0LmFzc2V0RmlsZXMucHVzaCguLi5zZXJ2aWNlV29ya2VyUmVzdWx0LmFzc2V0RmlsZXMpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGAke2Vycm9yfWApO1xuXG4gICAgICByZXR1cm4gZXhlY3V0aW9uUmVzdWx0O1xuICAgIH1cbiAgfVxuXG4gIC8vIENhbGN1bGF0ZSBlc3RpbWF0ZWQgdHJhbnNmZXIgc2l6ZSBpZiBzY3JpcHRzIGFyZSBvcHRpbWl6ZWRcbiAgbGV0IGVzdGltYXRlZFRyYW5zZmVyU2l6ZXM7XG4gIGlmIChvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgfHwgb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMubWluaWZ5KSB7XG4gICAgZXN0aW1hdGVkVHJhbnNmZXJTaXplcyA9IGF3YWl0IGNhbGN1bGF0ZUVzdGltYXRlZFRyYW5zZmVyU2l6ZXMoZXhlY3V0aW9uUmVzdWx0Lm91dHB1dEZpbGVzKTtcbiAgfVxuICBsb2dCdWlsZFN0YXRzKGNvbnRleHQsIG1ldGFmaWxlLCBpbml0aWFsRmlsZXMsIGVzdGltYXRlZFRyYW5zZmVyU2l6ZXMpO1xuXG4gIGNvbnN0IGJ1aWxkVGltZSA9IE51bWJlcihwcm9jZXNzLmhydGltZS5iaWdpbnQoKSAtIHN0YXJ0VGltZSkgLyAxMCAqKiA5O1xuICBjb250ZXh0LmxvZ2dlci5pbmZvKGBBcHBsaWNhdGlvbiBidW5kbGUgZ2VuZXJhdGlvbiBjb21wbGV0ZS4gWyR7YnVpbGRUaW1lLnRvRml4ZWQoMyl9IHNlY29uZHNdYCk7XG5cbiAgcmV0dXJuIGV4ZWN1dGlvblJlc3VsdDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gd3JpdGVSZXN1bHRGaWxlcyhcbiAgb3V0cHV0RmlsZXM6IE91dHB1dEZpbGVbXSxcbiAgYXNzZXRGaWxlczogeyBzb3VyY2U6IHN0cmluZzsgZGVzdGluYXRpb246IHN0cmluZyB9W10gfCB1bmRlZmluZWQsXG4gIG91dHB1dFBhdGg6IHN0cmluZyxcbikge1xuICBjb25zdCBkaXJlY3RvcnlFeGlzdHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgb3V0cHV0RmlsZXMubWFwKGFzeW5jIChmaWxlKSA9PiB7XG4gICAgICAvLyBFbnN1cmUgb3V0cHV0IHN1YmRpcmVjdG9yaWVzIGV4aXN0XG4gICAgICBjb25zdCBiYXNlUGF0aCA9IHBhdGguZGlybmFtZShmaWxlLnBhdGgpO1xuICAgICAgaWYgKGJhc2VQYXRoICYmICFkaXJlY3RvcnlFeGlzdHMuaGFzKGJhc2VQYXRoKSkge1xuICAgICAgICBhd2FpdCBmcy5ta2RpcihwYXRoLmpvaW4ob3V0cHV0UGF0aCwgYmFzZVBhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgZGlyZWN0b3J5RXhpc3RzLmFkZChiYXNlUGF0aCk7XG4gICAgICB9XG4gICAgICAvLyBXcml0ZSBmaWxlIGNvbnRlbnRzXG4gICAgICBhd2FpdCBmcy53cml0ZUZpbGUocGF0aC5qb2luKG91dHB1dFBhdGgsIGZpbGUucGF0aCksIGZpbGUuY29udGVudHMpO1xuICAgIH0pLFxuICApO1xuXG4gIGlmIChhc3NldEZpbGVzPy5sZW5ndGgpIHtcbiAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgIGFzc2V0RmlsZXMubWFwKGFzeW5jICh7IHNvdXJjZSwgZGVzdGluYXRpb24gfSkgPT4ge1xuICAgICAgICAvLyBFbnN1cmUgb3V0cHV0IHN1YmRpcmVjdG9yaWVzIGV4aXN0XG4gICAgICAgIGNvbnN0IGJhc2VQYXRoID0gcGF0aC5kaXJuYW1lKGRlc3RpbmF0aW9uKTtcbiAgICAgICAgaWYgKGJhc2VQYXRoICYmICFkaXJlY3RvcnlFeGlzdHMuaGFzKGJhc2VQYXRoKSkge1xuICAgICAgICAgIGF3YWl0IGZzLm1rZGlyKHBhdGguam9pbihvdXRwdXRQYXRoLCBiYXNlUGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgIGRpcmVjdG9yeUV4aXN0cy5hZGQoYmFzZVBhdGgpO1xuICAgICAgICB9XG4gICAgICAgIC8vIENvcHkgZmlsZSBjb250ZW50c1xuICAgICAgICBhd2FpdCBmcy5jb3B5RmlsZShzb3VyY2UsIHBhdGguam9pbihvdXRwdXRQYXRoLCBkZXN0aW5hdGlvbiksIGZzQ29uc3RhbnRzLkNPUFlGSUxFX0ZJQ0xPTkUpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQocGF0aDogc3RyaW5nLCB0ZXh0OiBzdHJpbmcpOiBPdXRwdXRGaWxlIHtcbiAgcmV0dXJuIHtcbiAgICBwYXRoLFxuICAgIHRleHQsXG4gICAgZ2V0IGNvbnRlbnRzKCkge1xuICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKHRoaXMudGV4dCwgJ3V0Zi04Jyk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ29kZUJ1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyxcbiAgdGFyZ2V0OiBzdHJpbmdbXSxcbiAgYnJvd3NlcnM6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7XG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgb3V0RXh0ZW5zaW9uLFxuICAgIGZpbGVSZXBsYWNlbWVudHMsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zLFxuICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgaml0LFxuICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbixcbiAgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zOiBCdWlsZE9wdGlvbnMgPSB7XG4gICAgYWJzV29ya2luZ0Rpcjogd29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IHRydWUsXG4gICAgZm9ybWF0OiAnZXNtJyxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBlbnRyeU5hbWVzOiBvdXRwdXROYW1lcy5idW5kbGVzLFxuICAgIGFzc2V0TmFtZXM6IG91dHB1dE5hbWVzLm1lZGlhLFxuICAgIHRhcmdldCxcbiAgICBzdXBwb3J0ZWQ6IGdldEZlYXR1cmVTdXBwb3J0KHRhcmdldCksXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgIGNvbmRpdGlvbnM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdtb2R1bGUnXSxcbiAgICByZXNvbHZlRXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgIGxlZ2FsQ29tbWVudHM6IG9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzID8gJ25vbmUnIDogJ2VvZicsXG4gICAgbG9nTGV2ZWw6IG9wdGlvbnMudmVyYm9zZSA/ICdkZWJ1ZycgOiAnc2lsZW50JyxcbiAgICBtaW5pZnk6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBwdXJlOiBbJ2ZvcndhcmRSZWYnXSxcbiAgICBvdXRkaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgb3V0RXh0ZW5zaW9uOiBvdXRFeHRlbnNpb24gPyB7ICcuanMnOiBgLiR7b3V0RXh0ZW5zaW9ufWAgfSA6IHVuZGVmaW5lZCxcbiAgICBzb3VyY2VtYXA6IHNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyAmJiAoc291cmNlbWFwT3B0aW9ucy5oaWRkZW4gPyAnZXh0ZXJuYWwnIDogdHJ1ZSksXG4gICAgc3BsaXR0aW5nOiB0cnVlLFxuICAgIHRzY29uZmlnLFxuICAgIGV4dGVybmFsOiBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICB3cml0ZTogZmFsc2UsXG4gICAgcGxhdGZvcm06ICdicm93c2VyJyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNvdXJjZW1hcEluZ29yZWxpc3RQbHVnaW4oKSxcbiAgICAgIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICAgICAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgICAgIHtcbiAgICAgICAgICBzb3VyY2VtYXA6ICEhc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzLFxuICAgICAgICAgIHRoaXJkUGFydHlTb3VyY2VtYXBzOiBzb3VyY2VtYXBPcHRpb25zLnZlbmRvcixcbiAgICAgICAgICB0c2NvbmZpZyxcbiAgICAgICAgICBqaXQsXG4gICAgICAgICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zLFxuICAgICAgICAgIGZpbGVSZXBsYWNlbWVudHMsXG4gICAgICAgICAgc291cmNlRmlsZUNhY2hlLFxuICAgICAgICAgIGxvYWRSZXN1bHRDYWNoZTogc291cmNlRmlsZUNhY2hlPy5sb2FkUmVzdWx0Q2FjaGUsXG4gICAgICAgIH0sXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAge1xuICAgICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgb3B0aW1pemF0aW9uOiAhIW9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLm1pbmlmeSxcbiAgICAgICAgICBzb3VyY2VtYXA6XG4gICAgICAgICAgICAvLyBIaWRkZW4gY29tcG9uZW50IHN0eWxlc2hlZXQgc291cmNlbWFwcyBhcmUgaW5hY2Nlc3NpYmxlIHdoaWNoIGlzIGVmZmVjdGl2ZWx5XG4gICAgICAgICAgICAvLyB0aGUgc2FtZSBhcyBiZWluZyBkaXNhYmxlZC4gRGlzYWJsaW5nIGhhcyB0aGUgYWR2YW50YWdlIG9mIGF2b2lkaW5nIHRoZSBvdmVyaGVhZFxuICAgICAgICAgICAgLy8gb2Ygc291cmNlbWFwIHByb2Nlc3NpbmcuXG4gICAgICAgICAgICAhIXNvdXJjZW1hcE9wdGlvbnMuc3R5bGVzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/IGZhbHNlIDogJ2lubGluZScpLFxuICAgICAgICAgIG91dHB1dE5hbWVzLFxuICAgICAgICAgIGluY2x1ZGVQYXRoczogc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zPy5pbmNsdWRlUGF0aHMsXG4gICAgICAgICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgICAgICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICAgICAgICBicm93c2VycyxcbiAgICAgICAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gICAgICAgIH0sXG4gICAgICApLFxuICAgIF0sXG4gICAgZGVmaW5lOiB7XG4gICAgICAvLyBPbmx5IHNldCB0byBmYWxzZSB3aGVuIHNjcmlwdCBvcHRpbWl6YXRpb25zIGFyZSBlbmFibGVkLiBJdCBzaG91bGQgbm90IGJlIHNldCB0byB0cnVlIGJlY2F1c2VcbiAgICAgIC8vIEFuZ3VsYXIgdHVybnMgYG5nRGV2TW9kZWAgaW50byBhbiBvYmplY3QgZm9yIGRldmVsb3BtZW50IGRlYnVnZ2luZyBwdXJwb3NlcyB3aGVuIG5vdCBkZWZpbmVkXG4gICAgICAvLyB3aGljaCBhIGNvbnN0YW50IHRydWUgdmFsdWUgd291bGQgYnJlYWsuXG4gICAgICAuLi4ob3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzID8geyAnbmdEZXZNb2RlJzogJ2ZhbHNlJyB9IDogdW5kZWZpbmVkKSxcbiAgICAgICduZ0ppdE1vZGUnOiBqaXQgPyAndHJ1ZScgOiAnZmFsc2UnLFxuICAgIH0sXG4gIH07XG5cbiAgY29uc3QgcG9seWZpbGxzID0gb3B0aW9ucy5wb2x5ZmlsbHMgPyBbLi4ub3B0aW9ucy5wb2x5ZmlsbHNdIDogW107XG4gIGlmIChqaXQpIHtcbiAgICBwb2x5ZmlsbHMucHVzaCgnQGFuZ3VsYXIvY29tcGlsZXInKTtcbiAgfVxuXG4gIGlmIChwb2x5ZmlsbHM/Lmxlbmd0aCkge1xuICAgIGNvbnN0IG5hbWVzcGFjZSA9ICdhbmd1bGFyOnBvbHlmaWxscyc7XG4gICAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0ge1xuICAgICAgLi4uYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzLFxuICAgICAgWydwb2x5ZmlsbHMnXTogbmFtZXNwYWNlLFxuICAgIH07XG5cbiAgICBidWlsZE9wdGlvbnMucGx1Z2lucz8udW5zaGlmdCh7XG4gICAgICBuYW1lOiAnYW5ndWxhci1wb2x5ZmlsbHMnLFxuICAgICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgICAgYnVpbGQub25SZXNvbHZlKHsgZmlsdGVyOiAvXmFuZ3VsYXI6cG9seWZpbGxzJC8gfSwgKGFyZ3MpID0+IHtcbiAgICAgICAgICBpZiAoYXJncy5raW5kICE9PSAnZW50cnktcG9pbnQnKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGF0aDogJ2VudHJ5JyxcbiAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZSB9LCAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNvbnRlbnRzOiBwb2x5ZmlsbHMubWFwKChmaWxlKSA9PiBgaW1wb3J0ICcke2ZpbGUucmVwbGFjZSgvXFxcXC9nLCAnLycpfSc7YCkuam9pbignXFxuJyksXG4gICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBidWlsZE9wdGlvbnM7XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgc3ludGF4IGZlYXR1cmUgb2JqZWN0IG1hcCBmb3IgQW5ndWxhciBhcHBsaWNhdGlvbnMgYmFzZWQgb24gYSBsaXN0IG9mIHRhcmdldHMuXG4gKiBBIGZ1bGwgc2V0IG9mIGZlYXR1cmUgbmFtZXMgY2FuIGJlIGZvdW5kIGhlcmU6IGh0dHBzOi8vZXNidWlsZC5naXRodWIuaW8vYXBpLyNzdXBwb3J0ZWRcbiAqIEBwYXJhbSB0YXJnZXQgQW4gYXJyYXkgb2YgYnJvd3Nlci9lbmdpbmUgdGFyZ2V0cyBpbiB0aGUgZm9ybWF0IGFjY2VwdGVkIGJ5IHRoZSBlc2J1aWxkIGB0YXJnZXRgIG9wdGlvbi5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkIHdpdGggdGhlIGVzYnVpbGQgYnVpbGQgYHN1cHBvcnRlZGAgb3B0aW9uLlxuICovXG5mdW5jdGlvbiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQ6IHN0cmluZ1tdKTogQnVpbGRPcHRpb25zWydzdXBwb3J0ZWQnXSB7XG4gIGNvbnN0IHN1cHBvcnRlZDogUmVjb3JkPHN0cmluZywgYm9vbGVhbj4gPSB7XG4gICAgLy8gTmF0aXZlIGFzeW5jL2F3YWl0IGlzIG5vdCBzdXBwb3J0ZWQgd2l0aCBab25lLmpzLiBEaXNhYmxpbmcgc3VwcG9ydCBoZXJlIHdpbGwgY2F1c2VcbiAgICAvLyBlc2J1aWxkIHRvIGRvd25sZXZlbCBhc3luYy9hd2FpdCBhbmQgZm9yIGF3YWl0Li4ub2YgdG8gYSBab25lLmpzIHN1cHBvcnRlZCBmb3JtLiBIb3dldmVyLCBlc2J1aWxkXG4gICAgLy8gZG9lcyBub3QgY3VycmVudGx5IHN1cHBvcnQgZG93bmxldmVsaW5nIGFzeW5jIGdlbmVyYXRvcnMuIEluc3RlYWQgYmFiZWwgaXMgdXNlZCB3aXRoaW4gdGhlIEpTL1RTXG4gICAgLy8gbG9hZGVyIHRvIHBlcmZvcm0gdGhlIGRvd25sZXZlbCB0cmFuc2Zvcm1hdGlvbi5cbiAgICAvLyBOT1RFOiBJZiBlc2J1aWxkIGFkZHMgc3VwcG9ydCBpbiB0aGUgZnV0dXJlLCB0aGUgYmFiZWwgc3VwcG9ydCBmb3IgYXN5bmMgZ2VuZXJhdG9ycyBjYW4gYmUgZGlzYWJsZWQuXG4gICAgJ2FzeW5jLWF3YWl0JzogZmFsc2UsXG4gICAgLy8gVjggY3VycmVudGx5IGhhcyBhIHBlcmZvcm1hbmNlIGRlZmVjdCBpbnZvbHZpbmcgb2JqZWN0IHNwcmVhZCBvcGVyYXRpb25zIHRoYXQgY2FuIGNhdXNlIHNpZ25maWNhbnRcbiAgICAvLyBkZWdyYWRhdGlvbiBpbiBydW50aW1lIHBlcmZvcm1hbmNlLiBCeSBub3Qgc3VwcG9ydGluZyB0aGUgbGFuZ3VhZ2UgZmVhdHVyZSBoZXJlLCBhIGRvd25sZXZlbCBmb3JtXG4gICAgLy8gd2lsbCBiZSB1c2VkIGluc3RlYWQgd2hpY2ggcHJvdmlkZXMgYSB3b3JrYXJvdW5kIGZvciB0aGUgcGVyZm9ybWFuY2UgaXNzdWUuXG4gICAgLy8gRm9yIG1vcmUgZGV0YWlsczogaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MTE1MzZcbiAgICAnb2JqZWN0LXJlc3Qtc3ByZWFkJzogZmFsc2UsXG4gICAgLy8gZXNidWlsZCBjdXJyZW50bHkgaGFzIGEgZGVmZWN0IGludm9sdmluZyBzZWxmLXJlZmVyZW5jaW5nIGEgY2xhc3Mgd2l0aGluIGEgc3RhdGljIGNvZGUgYmxvY2sgb3JcbiAgICAvLyBzdGF0aWMgZmllbGQgaW5pdGlhbGl6ZXIuIFRoaXMgaXMgbm90IGFuIGlzc3VlIGZvciBwcm9qZWN0cyB0aGF0IHVzZSB0aGUgZGVmYXVsdCBicm93c2Vyc2xpc3QgYXMgdGhlc2VcbiAgICAvLyBlbGVtZW50cyBhcmUgYW4gRVMyMDIyIGZlYXR1cmUgd2hpY2ggaXMgbm90IHN1cHBvcnQgYnkgYWxsIGJyb3dzZXJzIGluIHRoZSBkZWZhdWx0IGxpc3QuIEhvd2V2ZXIsIGlmIGFcbiAgICAvLyBjdXN0b20gYnJvd3NlcnNsaXN0IGlzIHVzZWQgdGhhdCBvbmx5IGhhcyBuZXdlciBicm93c2VycyB0aGFuIHRoZSBzdGF0aWMgY29kZSBlbGVtZW50cyBtYXkgYmUgcHJlc2VudC5cbiAgICAvLyBUaGlzIGlzc3VlIGlzIGNvbXBvdW5kZWQgYnkgdGhlIGRlZmF1bHQgdXNhZ2Ugb2YgdGhlIHRzY29uZmlnIGBcInVzZURlZmluZUZvckNsYXNzRmllbGRzXCI6IGZhbHNlYCBvcHRpb25cbiAgICAvLyBwcmVzZW50IGluIGdlbmVyYXRlZCBDTEkgcHJvamVjdHMgd2hpY2ggY2F1c2VzIHN0YXRpYyBjb2RlIGJsb2NrcyB0byBiZSB1c2VkIGluc3RlYWQgb2Ygc3RhdGljIGZpZWxkcy5cbiAgICAvLyBlc2J1aWxkIGN1cnJlbnRseSB1bmNvbmRpdGlvbmFsbHkgZG93bmxldmVscyBhbGwgc3RhdGljIGZpZWxkcyBpbiB0b3AtbGV2ZWwgY2xhc3NlcyBzbyB0byB3b3JrYXJvdW5kIHRoZVxuICAgIC8vIEFuZ3VsYXIgaXNzdWUgb25seSBzdGF0aWMgY29kZSBibG9ja3MgYXJlIGRpc2FibGVkIGhlcmUuXG4gICAgLy8gRm9yIG1vcmUgZGV0YWlsczogaHR0cHM6Ly9naXRodWIuY29tL2V2YW53L2VzYnVpbGQvaXNzdWVzLzI5NTBcbiAgICAnY2xhc3Mtc3RhdGljLWJsb2Nrcyc6IGZhbHNlLFxuICB9O1xuXG4gIC8vIERldGVjdCBTYWZhcmkgYnJvd3NlciB2ZXJzaW9ucyB0aGF0IGhhdmUgYSBjbGFzcyBmaWVsZCBiZWhhdmlvciBidWdcbiAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMjQzNTUjaXNzdWVjb21tZW50LTEzMzM0NzcwMzNcbiAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vV2ViS2l0L1dlYktpdC9jb21taXQvZTg3ODhhMzRiM2Q1ZjViNGVkZDdmZjY0NTBiODA5MzZiZmYzOTZmMlxuICBsZXQgc2FmYXJpQ2xhc3NGaWVsZFNjb3BlQnVnID0gZmFsc2U7XG4gIGZvciAoY29uc3QgYnJvd3NlciBvZiB0YXJnZXQpIHtcbiAgICBsZXQgbWFqb3JWZXJzaW9uO1xuICAgIGlmIChicm93c2VyLnN0YXJ0c1dpdGgoJ2lvcycpKSB7XG4gICAgICBtYWpvclZlcnNpb24gPSBOdW1iZXIoYnJvd3Nlci5zbGljZSgzLCA1KSk7XG4gICAgfSBlbHNlIGlmIChicm93c2VyLnN0YXJ0c1dpdGgoJ3NhZmFyaScpKSB7XG4gICAgICBtYWpvclZlcnNpb24gPSBOdW1iZXIoYnJvd3Nlci5zbGljZSg2LCA4KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICAvLyBUZWNobmljYWxseSwgMTQuMCBpcyBub3QgYnJva2VuIGJ1dCByYXRoZXIgZG9lcyBub3QgaGF2ZSBzdXBwb3J0LiBIb3dldmVyLCB0aGUgYmVoYXZpb3JcbiAgICAvLyBpcyBpZGVudGljYWwgc2luY2UgaXQgd291bGQgYmUgc2V0IHRvIGZhbHNlIGJ5IGVzYnVpbGQgaWYgcHJlc2VudCBhcyBhIHRhcmdldC5cbiAgICBpZiAobWFqb3JWZXJzaW9uID09PSAxNCB8fCBtYWpvclZlcnNpb24gPT09IDE1KSB7XG4gICAgICBzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcgPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIC8vIElmIGNsYXNzIGZpZWxkIHN1cHBvcnQgY2Fubm90IGJlIHVzZWQgc2V0IHRvIGZhbHNlOyBvdGhlcndpc2UgbGVhdmUgdW5kZWZpbmVkIHRvIGFsbG93XG4gIC8vIGVzYnVpbGQgdG8gdXNlIGB0YXJnZXRgIHRvIGRldGVybWluZSBzdXBwb3J0LlxuICBpZiAoc2FmYXJpQ2xhc3NGaWVsZFNjb3BlQnVnKSB7XG4gICAgc3VwcG9ydGVkWydjbGFzcy1maWVsZCddID0gZmFsc2U7XG4gICAgc3VwcG9ydGVkWydjbGFzcy1zdGF0aWMtZmllbGQnXSA9IGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHN1cHBvcnRlZDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gd2l0aFNwaW5uZXI8VD4odGV4dDogc3RyaW5nLCBhY3Rpb246ICgpID0+IFQgfCBQcm9taXNlPFQ+KTogUHJvbWlzZTxUPiB7XG4gIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcih0ZXh0KTtcbiAgc3Bpbm5lci5zdGFydCgpO1xuXG4gIHRyeSB7XG4gICAgcmV0dXJuIGF3YWl0IGFjdGlvbigpO1xuICB9IGZpbmFsbHkge1xuICAgIHNwaW5uZXIuc3RvcCgpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHdpdGhOb1Byb2dyZXNzPFQ+KHRlc3Q6IHN0cmluZywgYWN0aW9uOiAoKSA9PiBUIHwgUHJvbWlzZTxUPik6IFByb21pc2U8VD4ge1xuICByZXR1cm4gYWN0aW9uKCk7XG59XG5cbi8qKlxuICogTWFpbiBleGVjdXRpb24gZnVuY3Rpb24gZm9yIHRoZSBlc2J1aWxkLWJhc2VkIGFwcGxpY2F0aW9uIGJ1aWxkZXIuXG4gKiBUaGUgb3B0aW9ucyBhcmUgY29tcGF0aWJsZSB3aXRoIHRoZSBXZWJwYWNrLWJhc2VkIGJ1aWxkZXIuXG4gKiBAcGFyYW0gdXNlck9wdGlvbnMgVGhlIGJyb3dzZXIgYnVpbGRlciBvcHRpb25zIHRvIHVzZSB3aGVuIHNldHRpbmcgdXAgdGhlIGFwcGxpY2F0aW9uIGJ1aWxkXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgQXJjaGl0ZWN0IGJ1aWxkZXIgY29udGV4dCBvYmplY3RcbiAqIEByZXR1cm5zIEFuIGFzeW5jIGl0ZXJhYmxlIHdpdGggdGhlIGJ1aWxkZXIgcmVzdWx0IG91dHB1dFxuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRFc2J1aWxkQnJvd3NlcihcbiAgdXNlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIGluZnJhc3RydWN0dXJlU2V0dGluZ3M/OiB7XG4gICAgd3JpdGU/OiBib29sZWFuO1xuICB9LFxuKTogQXN5bmNJdGVyYWJsZTxcbiAgQnVpbGRlck91dHB1dCAmIHtcbiAgICBvdXRwdXRGaWxlcz86IE91dHB1dEZpbGVbXTtcbiAgICBhc3NldEZpbGVzPzogeyBzb3VyY2U6IHN0cmluZzsgZGVzdGluYXRpb246IHN0cmluZyB9W107XG4gIH1cbj4ge1xuICByZXR1cm4gYnVpbGRFc2J1aWxkQnJvd3NlckludGVybmFsKHVzZXJPcHRpb25zLCBjb250ZXh0LCBpbmZyYXN0cnVjdHVyZVNldHRpbmdzKTtcbn1cblxuLyoqXG4gKiBJbnRlcm5hbCB2ZXJzaW9uIG9mIHRoZSBtYWluIGV4ZWN1dGlvbiBmdW5jdGlvbiBmb3IgdGhlIGVzYnVpbGQtYmFzZWQgYXBwbGljYXRpb24gYnVpbGRlci5cbiAqIEV4cG9zZXMgc29tZSBhZGRpdGlvbmFsIFwicHJpdmF0ZVwiIG9wdGlvbnMgaW4gYWRkaXRpb24gdG8gdGhvc2UgZXhwb3NlZCBieSB0aGUgc2NoZW1hLlxuICogQHBhcmFtIHVzZXJPcHRpb25zIFRoZSBicm93c2VyLWVzYnVpbGQgYnVpbGRlciBvcHRpb25zIHRvIHVzZSB3aGVuIHNldHRpbmcgdXAgdGhlIGFwcGxpY2F0aW9uIGJ1aWxkXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgQXJjaGl0ZWN0IGJ1aWxkZXIgY29udGV4dCBvYmplY3RcbiAqIEByZXR1cm5zIEFuIGFzeW5jIGl0ZXJhYmxlIHdpdGggdGhlIGJ1aWxkZXIgcmVzdWx0IG91dHB1dFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24qIGJ1aWxkRXNidWlsZEJyb3dzZXJJbnRlcm5hbChcbiAgdXNlck9wdGlvbnM6IEJyb3dzZXJFc2J1aWxkT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIGluZnJhc3RydWN0dXJlU2V0dGluZ3M/OiB7XG4gICAgd3JpdGU/OiBib29sZWFuO1xuICB9LFxuKTogQXN5bmNJdGVyYWJsZTxcbiAgQnVpbGRlck91dHB1dCAmIHtcbiAgICBvdXRwdXRGaWxlcz86IE91dHB1dEZpbGVbXTtcbiAgICBhc3NldEZpbGVzPzogeyBzb3VyY2U6IHN0cmluZzsgZGVzdGluYXRpb246IHN0cmluZyB9W107XG4gIH1cbj4ge1xuICAvLyBJbmZvcm0gdXNlciBvZiBzdGF0dXMgb2YgYnVpbGRlciBhbmQgb3B0aW9uc1xuICBsb2dCdWlsZGVyU3RhdHVzV2FybmluZ3ModXNlck9wdGlvbnMsIGNvbnRleHQpO1xuXG4gIC8vIERldGVybWluZSBwcm9qZWN0IG5hbWUgZnJvbSBidWlsZGVyIGNvbnRleHQgdGFyZ2V0XG4gIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQ/LnByb2plY3Q7XG4gIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihgVGhlICdicm93c2VyLWVzYnVpbGQnIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQgdG8gYmUgc3BlY2lmaWVkLmApO1xuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3Qgbm9ybWFsaXplZE9wdGlvbnMgPSBhd2FpdCBub3JtYWxpemVPcHRpb25zKGNvbnRleHQsIHByb2plY3ROYW1lLCB1c2VyT3B0aW9ucyk7XG4gIC8vIFdyaXRpbmcgdGhlIHJlc3VsdCB0byB0aGUgZmlsZXN5c3RlbSBpcyB0aGUgZGVmYXVsdCBiZWhhdmlvclxuICBjb25zdCBzaG91bGRXcml0ZVJlc3VsdCA9IGluZnJhc3RydWN0dXJlU2V0dGluZ3M/LndyaXRlICE9PSBmYWxzZTtcblxuICBpZiAoc2hvdWxkV3JpdGVSZXN1bHQpIHtcbiAgICAvLyBDbGVhbiBvdXRwdXQgcGF0aCBpZiBlbmFibGVkXG4gICAgaWYgKHVzZXJPcHRpb25zLmRlbGV0ZU91dHB1dFBhdGgpIHtcbiAgICAgIGlmIChub3JtYWxpemVkT3B0aW9ucy5vdXRwdXRQYXRoID09PSBub3JtYWxpemVkT3B0aW9ucy53b3Jrc3BhY2VSb290KSB7XG4gICAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKCdPdXRwdXQgcGF0aCBNVVNUIG5vdCBiZSB3b3Jrc3BhY2Ugcm9vdCBkaXJlY3RvcnkhJyk7XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCBmcy5ybShub3JtYWxpemVkT3B0aW9ucy5vdXRwdXRQYXRoLCB7IGZvcmNlOiB0cnVlLCByZWN1cnNpdmU6IHRydWUsIG1heFJldHJpZXM6IDMgfSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIG91dHB1dCBkaXJlY3RvcnkgaWYgbmVlZGVkXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGZzLm1rZGlyKG5vcm1hbGl6ZWRPcHRpb25zLm91dHB1dFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGFzc2VydElzRXJyb3IoZSk7XG4gICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcignVW5hYmxlIHRvIGNyZWF0ZSBvdXRwdXQgZGlyZWN0b3J5OiAnICsgZS5tZXNzYWdlKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHdpdGhQcm9ncmVzczogdHlwZW9mIHdpdGhTcGlubmVyID0gbm9ybWFsaXplZE9wdGlvbnMucHJvZ3Jlc3NcbiAgICA/IHdpdGhTcGlubmVyXG4gICAgOiB3aXRoTm9Qcm9ncmVzcztcblxuICAvLyBJbml0aWFsIGJ1aWxkXG4gIGxldCByZXN1bHQ6IEV4ZWN1dGlvblJlc3VsdDtcbiAgdHJ5IHtcbiAgICByZXN1bHQgPSBhd2FpdCB3aXRoUHJvZ3Jlc3MoJ0J1aWxkaW5nLi4uJywgKCkgPT4gZXhlY3V0ZShub3JtYWxpemVkT3B0aW9ucywgY29udGV4dCkpO1xuXG4gICAgaWYgKHNob3VsZFdyaXRlUmVzdWx0KSB7XG4gICAgICAvLyBXcml0ZSBvdXRwdXQgZmlsZXNcbiAgICAgIGF3YWl0IHdyaXRlUmVzdWx0RmlsZXMocmVzdWx0Lm91dHB1dEZpbGVzLCByZXN1bHQuYXNzZXRGaWxlcywgbm9ybWFsaXplZE9wdGlvbnMub3V0cHV0UGF0aCk7XG5cbiAgICAgIHlpZWxkIHJlc3VsdC5vdXRwdXQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFJlcXVpcmVzIGNhc3RpbmcgZHVlIHRvIHVubmVlZGVkIGBKc29uT2JqZWN0YCByZXF1aXJlbWVudC4gUmVtb3ZlIG9uY2UgZml4ZWQuXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgeWllbGQgcmVzdWx0Lm91dHB1dFdpdGhGaWxlcyBhcyBhbnk7XG4gICAgfVxuXG4gICAgLy8gRmluaXNoIGlmIHdhdGNoIG1vZGUgaXMgbm90IGVuYWJsZWRcbiAgICBpZiAoIXVzZXJPcHRpb25zLndhdGNoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIC8vIEVuc3VyZSBTYXNzIHdvcmtlcnMgYXJlIHNodXRkb3duIGlmIG5vdCB3YXRjaGluZ1xuICAgIGlmICghdXNlck9wdGlvbnMud2F0Y2gpIHtcbiAgICAgIHNodXRkb3duU2Fzc1dvcmtlclBvb2woKTtcbiAgICB9XG4gIH1cblxuICBpZiAobm9ybWFsaXplZE9wdGlvbnMucHJvZ3Jlc3MpIHtcbiAgICBjb250ZXh0LmxvZ2dlci5pbmZvKCdXYXRjaCBtb2RlIGVuYWJsZWQuIFdhdGNoaW5nIGZvciBmaWxlIGNoYW5nZXMuLi4nKTtcbiAgfVxuXG4gIC8vIFNldHVwIGEgd2F0Y2hlclxuICBjb25zdCB7IGNyZWF0ZVdhdGNoZXIgfSA9IGF3YWl0IGltcG9ydCgnLi93YXRjaGVyJyk7XG4gIGNvbnN0IHdhdGNoZXIgPSBjcmVhdGVXYXRjaGVyKHtcbiAgICBwb2xsaW5nOiB0eXBlb2YgdXNlck9wdGlvbnMucG9sbCA9PT0gJ251bWJlcicsXG4gICAgaW50ZXJ2YWw6IHVzZXJPcHRpb25zLnBvbGwsXG4gICAgaWdub3JlZDogW1xuICAgICAgLy8gSWdub3JlIHRoZSBvdXRwdXQgYW5kIGNhY2hlIHBhdGhzIHRvIGF2b2lkIGluZmluaXRlIHJlYnVpbGQgY3ljbGVzXG4gICAgICBub3JtYWxpemVkT3B0aW9ucy5vdXRwdXRQYXRoLFxuICAgICAgbm9ybWFsaXplZE9wdGlvbnMuY2FjaGVPcHRpb25zLmJhc2VQYXRoLFxuICAgICAgLy8gSWdub3JlIGFsbCBub2RlIG1vZHVsZXMgZGlyZWN0b3JpZXMgdG8gYXZvaWQgZXhjZXNzaXZlIGZpbGUgd2F0Y2hlcnMuXG4gICAgICAvLyBQYWNrYWdlIGNoYW5nZXMgYXJlIGhhbmRsZWQgYmVsb3cgYnkgd2F0Y2hpbmcgbWFuaWZlc3QgYW5kIGxvY2sgZmlsZXMuXG4gICAgICAnKiovbm9kZV9tb2R1bGVzLyoqJyxcbiAgICBdLFxuICB9KTtcblxuICAvLyBUZW1wb3JhcmlseSB3YXRjaCB0aGUgZW50aXJlIHByb2plY3RcbiAgd2F0Y2hlci5hZGQobm9ybWFsaXplZE9wdGlvbnMucHJvamVjdFJvb3QpO1xuXG4gIC8vIFdhdGNoIHdvcmtzcGFjZSBmb3IgcGFja2FnZSBtYW5hZ2VyIGNoYW5nZXNcbiAgY29uc3QgcGFja2FnZVdhdGNoRmlsZXMgPSBbXG4gICAgLy8gbWFuaWZlc3QgY2FuIGFmZmVjdCBtb2R1bGUgcmVzb2x1dGlvblxuICAgICdwYWNrYWdlLmpzb24nLFxuICAgIC8vIG5wbSBsb2NrIGZpbGVcbiAgICAncGFja2FnZS1sb2NrLmpzb24nLFxuICAgIC8vIHBucG0gbG9jayBmaWxlXG4gICAgJ3BucG0tbG9jay55YW1sJyxcbiAgICAvLyB5YXJuIGxvY2sgZmlsZSBpbmNsdWRpbmcgWWFybiBQblAgbWFuaWZlc3QgZmlsZXMgKGh0dHBzOi8veWFybnBrZy5jb20vYWR2YW5jZWQvcG5wLXNwZWMvKVxuICAgICd5YXJuLmxvY2snLFxuICAgICcucG5wLmNqcycsXG4gICAgJy5wbnAuZGF0YS5qc29uJyxcbiAgXTtcbiAgd2F0Y2hlci5hZGQocGFja2FnZVdhdGNoRmlsZXMubWFwKChmaWxlKSA9PiBwYXRoLmpvaW4obm9ybWFsaXplZE9wdGlvbnMud29ya3NwYWNlUm9vdCwgZmlsZSkpKTtcblxuICAvLyBXYXRjaCBsb2NhdGlvbnMgcHJvdmlkZWQgYnkgdGhlIGluaXRpYWwgYnVpbGQgcmVzdWx0XG4gIGxldCBwcmV2aW91c1dhdGNoRmlsZXMgPSBuZXcgU2V0KHJlc3VsdC53YXRjaEZpbGVzKTtcbiAgd2F0Y2hlci5hZGQocmVzdWx0LndhdGNoRmlsZXMpO1xuXG4gIC8vIFdhaXQgZm9yIGNoYW5nZXMgYW5kIHJlYnVpbGQgYXMgbmVlZGVkXG4gIHRyeSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaGFuZ2VzIG9mIHdhdGNoZXIpIHtcbiAgICAgIGlmICh1c2VyT3B0aW9ucy52ZXJib3NlKSB7XG4gICAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oY2hhbmdlcy50b0RlYnVnU3RyaW5nKCkpO1xuICAgICAgfVxuXG4gICAgICByZXN1bHQgPSBhd2FpdCB3aXRoUHJvZ3Jlc3MoJ0NoYW5nZXMgZGV0ZWN0ZWQuIFJlYnVpbGRpbmcuLi4nLCAoKSA9PlxuICAgICAgICBleGVjdXRlKG5vcm1hbGl6ZWRPcHRpb25zLCBjb250ZXh0LCByZXN1bHQuY3JlYXRlUmVidWlsZFN0YXRlKGNoYW5nZXMpKSxcbiAgICAgICk7XG5cbiAgICAgIC8vIFVwZGF0ZSB3YXRjaGVkIGxvY2F0aW9ucyBwcm92aWRlZCBieSB0aGUgbmV3IGJ1aWxkIHJlc3VsdC5cbiAgICAgIC8vIEFkZCBhbnkgbmV3IGxvY2F0aW9uc1xuICAgICAgd2F0Y2hlci5hZGQocmVzdWx0LndhdGNoRmlsZXMuZmlsdGVyKCh3YXRjaEZpbGUpID0+ICFwcmV2aW91c1dhdGNoRmlsZXMuaGFzKHdhdGNoRmlsZSkpKTtcbiAgICAgIGNvbnN0IG5ld1dhdGNoRmlsZXMgPSBuZXcgU2V0KHJlc3VsdC53YXRjaEZpbGVzKTtcbiAgICAgIC8vIFJlbW92ZSBhbnkgb2xkIGxvY2F0aW9uc1xuICAgICAgd2F0Y2hlci5yZW1vdmUoWy4uLnByZXZpb3VzV2F0Y2hGaWxlc10uZmlsdGVyKCh3YXRjaEZpbGUpID0+ICFuZXdXYXRjaEZpbGVzLmhhcyh3YXRjaEZpbGUpKSk7XG4gICAgICBwcmV2aW91c1dhdGNoRmlsZXMgPSBuZXdXYXRjaEZpbGVzO1xuXG4gICAgICBpZiAoc2hvdWxkV3JpdGVSZXN1bHQpIHtcbiAgICAgICAgLy8gV3JpdGUgb3V0cHV0IGZpbGVzXG4gICAgICAgIGF3YWl0IHdyaXRlUmVzdWx0RmlsZXMocmVzdWx0Lm91dHB1dEZpbGVzLCByZXN1bHQuYXNzZXRGaWxlcywgbm9ybWFsaXplZE9wdGlvbnMub3V0cHV0UGF0aCk7XG5cbiAgICAgICAgeWllbGQgcmVzdWx0Lm91dHB1dDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFJlcXVpcmVzIGNhc3RpbmcgZHVlIHRvIHVubmVlZGVkIGBKc29uT2JqZWN0YCByZXF1aXJlbWVudC4gUmVtb3ZlIG9uY2UgZml4ZWQuXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAgIHlpZWxkIHJlc3VsdC5vdXRwdXRXaXRoRmlsZXMgYXMgYW55O1xuICAgICAgfVxuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICAvLyBTdG9wIHRoZSB3YXRjaGVyXG4gICAgYXdhaXQgd2F0Y2hlci5jbG9zZSgpO1xuICAgIC8vIENsZWFudXAgaW5jcmVtZW50YWwgcmVidWlsZCBzdGF0ZVxuICAgIGF3YWl0IHJlc3VsdC5kaXNwb3NlKCk7XG4gICAgc2h1dGRvd25TYXNzV29ya2VyUG9vbCgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXIoYnVpbGRFc2J1aWxkQnJvd3Nlcik7XG5cbmZ1bmN0aW9uIGxvZ0J1aWxkU3RhdHMoXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBtZXRhZmlsZTogTWV0YWZpbGUsXG4gIGluaXRpYWxGaWxlczogRmlsZUluZm9bXSxcbiAgZXN0aW1hdGVkVHJhbnNmZXJTaXplcz86IE1hcDxzdHJpbmcsIG51bWJlcj4sXG4pIHtcbiAgY29uc3QgaW5pdGlhbCA9IG5ldyBNYXAoaW5pdGlhbEZpbGVzLm1hcCgoaW5mbykgPT4gW2luZm8uZmlsZSwgaW5mby5uYW1lXSkpO1xuICBjb25zdCBzdGF0czogQnVuZGxlU3RhdHNbXSA9IFtdO1xuICBmb3IgKGNvbnN0IFtmaWxlLCBvdXRwdXRdIG9mIE9iamVjdC5lbnRyaWVzKG1ldGFmaWxlLm91dHB1dHMpKSB7XG4gICAgLy8gT25seSBkaXNwbGF5IEphdmFTY3JpcHQgYW5kIENTUyBmaWxlc1xuICAgIGlmICghZmlsZS5lbmRzV2l0aCgnLmpzJykgJiYgIWZpbGUuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIC8vIFNraXAgaW50ZXJuYWwgY29tcG9uZW50IHJlc291cmNlc1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgaWYgKChvdXRwdXQgYXMgYW55KVsnbmctY29tcG9uZW50J10pIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHN0YXRzLnB1c2goe1xuICAgICAgaW5pdGlhbDogaW5pdGlhbC5oYXMoZmlsZSksXG4gICAgICBzdGF0czogW1xuICAgICAgICBmaWxlLFxuICAgICAgICBpbml0aWFsLmdldChmaWxlKSA/PyAnLScsXG4gICAgICAgIG91dHB1dC5ieXRlcyxcbiAgICAgICAgZXN0aW1hdGVkVHJhbnNmZXJTaXplcz8uZ2V0KGZpbGUpID8/ICctJyxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCB0YWJsZVRleHQgPSBnZW5lcmF0ZUJ1aWxkU3RhdHNUYWJsZShzdGF0cywgdHJ1ZSwgdHJ1ZSwgISFlc3RpbWF0ZWRUcmFuc2ZlclNpemVzLCB1bmRlZmluZWQpO1xuXG4gIGNvbnRleHQubG9nZ2VyLmluZm8oJ1xcbicgKyB0YWJsZVRleHQgKyAnXFxuJyk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNhbGN1bGF0ZUVzdGltYXRlZFRyYW5zZmVyU2l6ZXMob3V0cHV0RmlsZXM6IE91dHB1dEZpbGVbXSkge1xuICBjb25zdCBzaXplcyA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cbiAgY29uc3QgcGVuZGluZ0NvbXByZXNzaW9uID0gW107XG4gIGZvciAoY29uc3Qgb3V0cHV0RmlsZSBvZiBvdXRwdXRGaWxlcykge1xuICAgIC8vIE9ubHkgY2FsY3VsYXRlIEphdmFTY3JpcHQgYW5kIENTUyBmaWxlc1xuICAgIGlmICghb3V0cHV0RmlsZS5wYXRoLmVuZHNXaXRoKCcuanMnKSAmJiAhb3V0cHV0RmlsZS5wYXRoLmVuZHNXaXRoKCcuY3NzJykpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFNraXAgY29tcHJlc3Npbmcgc21hbGwgZmlsZXMgd2hpY2ggbWF5IGVuZCBiZWluZyBsYXJnZXIgb25jZSBjb21wcmVzc2VkIGFuZCB3aWxsIG1vc3QgbGlrZWx5IG5vdCBiZVxuICAgIC8vIGNvbXByZXNzZWQgaW4gYWN0dWFsIHRyYW5zaXQuXG4gICAgaWYgKG91dHB1dEZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCA8IDEwMjQpIHtcbiAgICAgIHNpemVzLnNldChvdXRwdXRGaWxlLnBhdGgsIG91dHB1dEZpbGUuY29udGVudHMuYnl0ZUxlbmd0aCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBwZW5kaW5nQ29tcHJlc3Npb24ucHVzaChcbiAgICAgIGNvbXByZXNzQXN5bmMob3V0cHV0RmlsZS5jb250ZW50cykudGhlbigocmVzdWx0KSA9PlxuICAgICAgICBzaXplcy5zZXQob3V0cHV0RmlsZS5wYXRoLCByZXN1bHQuYnl0ZUxlbmd0aCksXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICBhd2FpdCBQcm9taXNlLmFsbChwZW5kaW5nQ29tcHJlc3Npb24pO1xuXG4gIHJldHVybiBzaXplcztcbn1cbiJdfQ==