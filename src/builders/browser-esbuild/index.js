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
const sass_plugin_1 = require("./stylesheets/sass-plugin");
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
            (0, sass_plugin_1.shutdownSassWorkerPool)();
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
        (0, sass_plugin_1.shutdownSassWorkerPool)();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFFekYscUNBQW1EO0FBQ25ELGdFQUFrQztBQUNsQywwREFBNkI7QUFDN0IseUNBQXNDO0FBQ3RDLHlDQUEyQztBQUMzQyx5REFBcUQ7QUFDckQsNkNBQWtEO0FBQ2xELGlFQUFrRjtBQUVsRixzRkFBaUY7QUFDakYsK0RBQWdGO0FBQ2hGLGlEQUE4QztBQUM5Qyx1RUFBc0U7QUFDdEUscURBQWlGO0FBQ2pGLCtEQUFrRjtBQUNsRix1RUFBcUU7QUFDckUseURBQTBEO0FBQzFELHVDQUF3RDtBQUN4RCxxREFBb0U7QUFDcEUsbURBQWtFO0FBQ2xFLDJEQUFzRDtBQUN0RCx1Q0FBOEY7QUFFOUYsK0VBQWdGO0FBQ2hGLDJEQUFtRTtBQUduRSxNQUFNLGFBQWEsR0FBRyxJQUFBLHFCQUFTLEVBQUMsMEJBQWMsQ0FBQyxDQUFDO0FBUWhEOztHQUVHO0FBQ0gsTUFBTSxlQUFlO0lBSW5CLFlBQ1UsZUFBaUMsRUFDakMsZUFBaUM7UUFEakMsb0JBQWUsR0FBZixlQUFlLENBQWtCO1FBQ2pDLG9CQUFlLEdBQWYsZUFBZSxDQUFrQjtRQUxsQyxnQkFBVyxHQUFpQixFQUFFLENBQUM7UUFDL0IsZUFBVSxHQUE4QyxFQUFFLENBQUM7SUFLakUsQ0FBQztJQUVKLGFBQWEsQ0FBQyxJQUFZLEVBQUUsT0FBZTtRQUN6QyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRUQsSUFB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SUFBSSxDQUFDLENBQUM7QUFDL0MsQ0FBQztBQUVELEtBQUssVUFBVSwrQkFBK0IsQ0FBQyxXQUF5QjtJQUN0RSxNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztJQUV4QyxNQUFNLGtCQUFrQixHQUFHLEVBQUUsQ0FBQztJQUM5QixLQUFLLE1BQU0sVUFBVSxJQUFJLFdBQVcsRUFBRTtRQUNwQywwQ0FBMEM7UUFDMUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDekUsU0FBUztTQUNWO1FBRUQsc0dBQXNHO1FBQ3RHLGdDQUFnQztRQUNoQyxJQUFJLFVBQVUsQ0FBQyxRQUFRLENBQUMsVUFBVSxHQUFHLElBQUksRUFBRTtZQUN6QyxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUMzRCxTQUFTO1NBQ1Y7UUFFRCxrQkFBa0IsQ0FBQyxJQUFJLENBQ3JCLGFBQWEsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FDakQsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FDOUMsQ0FDRixDQUFDO0tBQ0g7SUFFRCxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUV0QyxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zLCBNZXRhZmlsZSwgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgY29uc3RhbnRzIGFzIGZzQ29uc3RhbnRzIH0gZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAnbm9kZTp1dGlsJztcbmltcG9ydCB7IGJyb3RsaUNvbXByZXNzIH0gZnJvbSAnbm9kZTp6bGliJztcbmltcG9ydCB7IGNvcHlBc3NldHMgfSBmcm9tICcuLi8uLi91dGlscy9jb3B5LWFzc2V0cyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMgfSBmcm9tICcuLi8uLi91dGlscy9lc2J1aWxkLXRhcmdldHMnO1xuaW1wb3J0IHsgRmlsZUluZm8gfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2F1Z21lbnQtaW5kZXgtaHRtbCc7XG5pbXBvcnQgeyBJbmRleEh0bWxHZW5lcmF0b3IgfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2luZGV4LWh0bWwtZ2VuZXJhdG9yJztcbmltcG9ydCB7IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlckVzYnVpbGQgfSBmcm9tICcuLi8uLi91dGlscy9zZXJ2aWNlLXdvcmtlcic7XG5pbXBvcnQgeyBTcGlubmVyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lcic7XG5pbXBvcnQgeyBnZXRTdXBwb3J0ZWRCcm93c2VycyB9IGZyb20gJy4uLy4uL3V0aWxzL3N1cHBvcnRlZC1icm93c2Vycyc7XG5pbXBvcnQgeyBCdW5kbGVTdGF0cywgZ2VuZXJhdGVCdWlsZFN0YXRzVGFibGUgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL3N0YXRzJztcbmltcG9ydCB7IFNvdXJjZUZpbGVDYWNoZSwgY3JlYXRlQ29tcGlsZXJQbHVnaW4gfSBmcm9tICcuL2FuZ3VsYXIvY29tcGlsZXItcGx1Z2luJztcbmltcG9ydCB7IGxvZ0J1aWxkZXJTdGF0dXNXYXJuaW5ncyB9IGZyb20gJy4vYnVpbGRlci1zdGF0dXMtd2FybmluZ3MnO1xuaW1wb3J0IHsgY2hlY2tDb21tb25KU01vZHVsZXMgfSBmcm9tICcuL2NvbW1vbmpzLWNoZWNrZXInO1xuaW1wb3J0IHsgQnVuZGxlckNvbnRleHQsIGxvZ01lc3NhZ2VzIH0gZnJvbSAnLi9lc2J1aWxkJztcbmltcG9ydCB7IGNyZWF0ZUdsb2JhbFNjcmlwdHNCdW5kbGVPcHRpb25zIH0gZnJvbSAnLi9nbG9iYWwtc2NyaXB0cyc7XG5pbXBvcnQgeyBjcmVhdGVHbG9iYWxTdHlsZXNCdW5kbGVPcHRpb25zIH0gZnJvbSAnLi9nbG9iYWwtc3R5bGVzJztcbmltcG9ydCB7IGV4dHJhY3RMaWNlbnNlcyB9IGZyb20gJy4vbGljZW5zZS1leHRyYWN0b3InO1xuaW1wb3J0IHsgQnJvd3NlckVzYnVpbGRPcHRpb25zLCBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMsIG5vcm1hbGl6ZU9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB7IGNyZWF0ZVNvdXJjZW1hcEluZ29yZWxpc3RQbHVnaW4gfSBmcm9tICcuL3NvdXJjZW1hcC1pZ25vcmVsaXN0LXBsdWdpbic7XG5pbXBvcnQgeyBzaHV0ZG93blNhc3NXb3JrZXJQb29sIH0gZnJvbSAnLi9zdHlsZXNoZWV0cy9zYXNzLXBsdWdpbic7XG5pbXBvcnQgdHlwZSB7IENoYW5nZWRGaWxlcyB9IGZyb20gJy4vd2F0Y2hlcic7XG5cbmNvbnN0IGNvbXByZXNzQXN5bmMgPSBwcm9taXNpZnkoYnJvdGxpQ29tcHJlc3MpO1xuXG5pbnRlcmZhY2UgUmVidWlsZFN0YXRlIHtcbiAgcmVidWlsZENvbnRleHRzOiBCdW5kbGVyQ29udGV4dFtdO1xuICBjb2RlQnVuZGxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGU7XG4gIGZpbGVDaGFuZ2VzOiBDaGFuZ2VkRmlsZXM7XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyB0aGUgcmVzdWx0IG9mIGEgc2luZ2xlIGJ1aWxkZXIgZXhlY3V0ZSBjYWxsLlxuICovXG5jbGFzcyBFeGVjdXRpb25SZXN1bHQge1xuICByZWFkb25seSBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gIHJlYWRvbmx5IGFzc2V0RmlsZXM6IHsgc291cmNlOiBzdHJpbmc7IGRlc3RpbmF0aW9uOiBzdHJpbmcgfVtdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWJ1aWxkQ29udGV4dHM6IEJ1bmRsZXJDb250ZXh0W10sXG4gICAgcHJpdmF0ZSBjb2RlQnVuZGxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4gICkge31cblxuICBhZGRPdXRwdXRGaWxlKHBhdGg6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5vdXRwdXRGaWxlcy5wdXNoKGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChwYXRoLCBjb250ZW50KSk7XG4gIH1cblxuICBnZXQgb3V0cHV0KCkge1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0aGlzLm91dHB1dEZpbGVzLmxlbmd0aCA+IDAsXG4gICAgfTtcbiAgfVxuXG4gIGdldCBvdXRwdXRXaXRoRmlsZXMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRoaXMub3V0cHV0RmlsZXMubGVuZ3RoID4gMCxcbiAgICAgIG91dHB1dEZpbGVzOiB0aGlzLm91dHB1dEZpbGVzLFxuICAgICAgYXNzZXRGaWxlczogdGhpcy5hc3NldEZpbGVzLFxuICAgIH07XG4gIH1cblxuICBnZXQgd2F0Y2hGaWxlcygpIHtcbiAgICByZXR1cm4gdGhpcy5jb2RlQnVuZGxlQ2FjaGU/LnJlZmVyZW5jZWRGaWxlcyA/PyBbXTtcbiAgfVxuXG4gIGNyZWF0ZVJlYnVpbGRTdGF0ZShmaWxlQ2hhbmdlczogQ2hhbmdlZEZpbGVzKTogUmVidWlsZFN0YXRlIHtcbiAgICB0aGlzLmNvZGVCdW5kbGVDYWNoZT8uaW52YWxpZGF0ZShbLi4uZmlsZUNoYW5nZXMubW9kaWZpZWQsIC4uLmZpbGVDaGFuZ2VzLnJlbW92ZWRdKTtcblxuICAgIHJldHVybiB7XG4gICAgICByZWJ1aWxkQ29udGV4dHM6IHRoaXMucmVidWlsZENvbnRleHRzLFxuICAgICAgY29kZUJ1bmRsZUNhY2hlOiB0aGlzLmNvZGVCdW5kbGVDYWNoZSxcbiAgICAgIGZpbGVDaGFuZ2VzLFxuICAgIH07XG4gIH1cblxuICBhc3luYyBkaXNwb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZCh0aGlzLnJlYnVpbGRDb250ZXh0cy5tYXAoKGNvbnRleHQpID0+IGNvbnRleHQuZGlzcG9zZSgpKSk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZXhlY3V0ZShcbiAgb3B0aW9uczogTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgcmVidWlsZFN0YXRlPzogUmVidWlsZFN0YXRlLFxuKTogUHJvbWlzZTxFeGVjdXRpb25SZXN1bHQ+IHtcbiAgY29uc3Qgc3RhcnRUaW1lID0gcHJvY2Vzcy5ocnRpbWUuYmlnaW50KCk7XG5cbiAgY29uc3Qge1xuICAgIHByb2plY3RSb290LFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBhc3NldHMsXG4gICAgc2VydmljZVdvcmtlck9wdGlvbnMsXG4gICAgaW5kZXhIdG1sT3B0aW9ucyxcbiAgICBjYWNoZU9wdGlvbnMsXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IGJyb3dzZXJzID0gZ2V0U3VwcG9ydGVkQnJvd3NlcnMocHJvamVjdFJvb3QsIGNvbnRleHQubG9nZ2VyKTtcbiAgY29uc3QgdGFyZ2V0ID0gdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMoYnJvd3NlcnMpO1xuXG4gIC8vIFJldXNlIHJlYnVpbGQgc3RhdGUgb3IgY3JlYXRlIG5ldyBidW5kbGUgY29udGV4dHMgZm9yIGNvZGUgYW5kIGdsb2JhbCBzdHlsZXNoZWV0c1xuICBsZXQgYnVuZGxlckNvbnRleHRzID0gcmVidWlsZFN0YXRlPy5yZWJ1aWxkQ29udGV4dHM7XG4gIGNvbnN0IGNvZGVCdW5kbGVDYWNoZSA9XG4gICAgcmVidWlsZFN0YXRlPy5jb2RlQnVuZGxlQ2FjaGUgPz9cbiAgICBuZXcgU291cmNlRmlsZUNhY2hlKGNhY2hlT3B0aW9ucy5lbmFibGVkID8gY2FjaGVPcHRpb25zLnBhdGggOiB1bmRlZmluZWQpO1xuICBpZiAoYnVuZGxlckNvbnRleHRzID09PSB1bmRlZmluZWQpIHtcbiAgICBidW5kbGVyQ29udGV4dHMgPSBbXTtcblxuICAgIC8vIEFwcGxpY2F0aW9uIGNvZGVcbiAgICBidW5kbGVyQ29udGV4dHMucHVzaChcbiAgICAgIG5ldyBCdW5kbGVyQ29udGV4dChcbiAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgISFvcHRpb25zLndhdGNoLFxuICAgICAgICBjcmVhdGVDb2RlQnVuZGxlT3B0aW9ucyhvcHRpb25zLCB0YXJnZXQsIGJyb3dzZXJzLCBjb2RlQnVuZGxlQ2FjaGUpLFxuICAgICAgKSxcbiAgICApO1xuXG4gICAgLy8gR2xvYmFsIFN0eWxlc2hlZXRzXG4gICAgaWYgKG9wdGlvbnMuZ2xvYmFsU3R5bGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGZvciAoY29uc3QgaW5pdGlhbCBvZiBbdHJ1ZSwgZmFsc2VdKSB7XG4gICAgICAgIGNvbnN0IGJ1bmRsZU9wdGlvbnMgPSBjcmVhdGVHbG9iYWxTdHlsZXNCdW5kbGVPcHRpb25zKFxuICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgIGJyb3dzZXJzLFxuICAgICAgICAgIGluaXRpYWwsXG4gICAgICAgICAgY29kZUJ1bmRsZUNhY2hlPy5sb2FkUmVzdWx0Q2FjaGUsXG4gICAgICAgICk7XG4gICAgICAgIGlmIChidW5kbGVPcHRpb25zKSB7XG4gICAgICAgICAgYnVuZGxlckNvbnRleHRzLnB1c2gobmV3IEJ1bmRsZXJDb250ZXh0KHdvcmtzcGFjZVJvb3QsICEhb3B0aW9ucy53YXRjaCwgYnVuZGxlT3B0aW9ucykpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gR2xvYmFsIFNjcmlwdHNcbiAgICBpZiAob3B0aW9ucy5nbG9iYWxTY3JpcHRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGZvciAoY29uc3QgaW5pdGlhbCBvZiBbdHJ1ZSwgZmFsc2VdKSB7XG4gICAgICAgIGNvbnN0IGJ1bmRsZU9wdGlvbnMgPSBjcmVhdGVHbG9iYWxTY3JpcHRzQnVuZGxlT3B0aW9ucyhvcHRpb25zLCBpbml0aWFsKTtcbiAgICAgICAgaWYgKGJ1bmRsZU9wdGlvbnMpIHtcbiAgICAgICAgICBidW5kbGVyQ29udGV4dHMucHVzaChuZXcgQnVuZGxlckNvbnRleHQod29ya3NwYWNlUm9vdCwgISFvcHRpb25zLndhdGNoLCBidW5kbGVPcHRpb25zKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjb25zdCBidW5kbGluZ1Jlc3VsdCA9IGF3YWl0IEJ1bmRsZXJDb250ZXh0LmJ1bmRsZUFsbChidW5kbGVyQ29udGV4dHMpO1xuXG4gIC8vIExvZyBhbGwgd2FybmluZ3MgYW5kIGVycm9ycyBnZW5lcmF0ZWQgZHVyaW5nIGJ1bmRsaW5nXG4gIGF3YWl0IGxvZ01lc3NhZ2VzKGNvbnRleHQsIGJ1bmRsaW5nUmVzdWx0KTtcblxuICBjb25zdCBleGVjdXRpb25SZXN1bHQgPSBuZXcgRXhlY3V0aW9uUmVzdWx0KGJ1bmRsZXJDb250ZXh0cywgY29kZUJ1bmRsZUNhY2hlKTtcblxuICAvLyBSZXR1cm4gaWYgdGhlIGJ1bmRsaW5nIGhhcyBlcnJvcnNcbiAgaWYgKGJ1bmRsaW5nUmVzdWx0LmVycm9ycykge1xuICAgIHJldHVybiBleGVjdXRpb25SZXN1bHQ7XG4gIH1cblxuICAvLyBGaWx0ZXIgZ2xvYmFsIHN0eWxlc2hlZXQgaW5pdGlhbCBmaWxlcy4gQ3VycmVudGx5IGFsbCBpbml0aWFsIENTUyBmaWxlcyBhcmUgZnJvbSB0aGUgZ2xvYmFsIHN0eWxlcyBvcHRpb24uXG4gIGlmIChvcHRpb25zLmdsb2JhbFN0eWxlcy5sZW5ndGggPiAwKSB7XG4gICAgYnVuZGxpbmdSZXN1bHQuaW5pdGlhbEZpbGVzID0gYnVuZGxpbmdSZXN1bHQuaW5pdGlhbEZpbGVzLmZpbHRlcihcbiAgICAgICh7IGZpbGUsIG5hbWUgfSkgPT5cbiAgICAgICAgIWZpbGUuZW5kc1dpdGgoJy5jc3MnKSB8fFxuICAgICAgICBvcHRpb25zLmdsb2JhbFN0eWxlcy5maW5kKChzdHlsZSkgPT4gc3R5bGUubmFtZSA9PT0gbmFtZSk/LmluaXRpYWwsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHsgbWV0YWZpbGUsIGluaXRpYWxGaWxlcywgb3V0cHV0RmlsZXMgfSA9IGJ1bmRsaW5nUmVzdWx0O1xuXG4gIGV4ZWN1dGlvblJlc3VsdC5vdXRwdXRGaWxlcy5wdXNoKC4uLm91dHB1dEZpbGVzKTtcblxuICAvLyBDaGVjayBtZXRhZmlsZSBmb3IgQ29tbW9uSlMgbW9kdWxlIHVzYWdlIGlmIG9wdGltaXppbmcgc2NyaXB0c1xuICBpZiAob3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzKSB7XG4gICAgY29uc3QgbWVzc2FnZXMgPSBjaGVja0NvbW1vbkpTTW9kdWxlcyhtZXRhZmlsZSwgb3B0aW9ucy5hbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMpO1xuICAgIGF3YWl0IGxvZ01lc3NhZ2VzKGNvbnRleHQsIHsgd2FybmluZ3M6IG1lc3NhZ2VzIH0pO1xuICB9XG5cbiAgLy8gR2VuZXJhdGUgaW5kZXggSFRNTCBmaWxlXG4gIGlmIChpbmRleEh0bWxPcHRpb25zKSB7XG4gICAgLy8gQ3JlYXRlIGFuIGluZGV4IEhUTUwgZ2VuZXJhdG9yIHRoYXQgcmVhZHMgZnJvbSB0aGUgaW4tbWVtb3J5IG91dHB1dCBmaWxlc1xuICAgIGNvbnN0IGluZGV4SHRtbEdlbmVyYXRvciA9IG5ldyBJbmRleEh0bWxHZW5lcmF0b3Ioe1xuICAgICAgaW5kZXhQYXRoOiBpbmRleEh0bWxPcHRpb25zLmlucHV0LFxuICAgICAgZW50cnlwb2ludHM6IGluZGV4SHRtbE9wdGlvbnMuaW5zZXJ0aW9uT3JkZXIsXG4gICAgICBzcmk6IG9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgICBvcHRpbWl6YXRpb246IG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgICBjcm9zc09yaWdpbjogb3B0aW9ucy5jcm9zc09yaWdpbixcbiAgICB9KTtcblxuICAgIC8qKiBWaXJ0dWFsIG91dHB1dCBwYXRoIHRvIHN1cHBvcnQgcmVhZGluZyBpbi1tZW1vcnkgZmlsZXMuICovXG4gICAgY29uc3QgdmlydHVhbE91dHB1dFBhdGggPSAnLyc7XG4gICAgaW5kZXhIdG1sR2VuZXJhdG9yLnJlYWRBc3NldCA9IGFzeW5jIGZ1bmN0aW9uIChmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAgIC8vIFJlbW92ZSBsZWFkaW5nIGRpcmVjdG9yeSBzZXBhcmF0b3JcbiAgICAgIGNvbnN0IHJlbGF0aXZlZmlsZVBhdGggPSBwYXRoLnJlbGF0aXZlKHZpcnR1YWxPdXRwdXRQYXRoLCBmaWxlUGF0aCk7XG4gICAgICBjb25zdCBmaWxlID0gZXhlY3V0aW9uUmVzdWx0Lm91dHB1dEZpbGVzLmZpbmQoKGZpbGUpID0+IGZpbGUucGF0aCA9PT0gcmVsYXRpdmVmaWxlUGF0aCk7XG4gICAgICBpZiAoZmlsZSkge1xuICAgICAgICByZXR1cm4gZmlsZS50ZXh0O1xuICAgICAgfVxuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE91dHB1dCBmaWxlIGRvZXMgbm90IGV4aXN0OiAke3BhdGh9YCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHsgY29udGVudCwgd2FybmluZ3MsIGVycm9ycyB9ID0gYXdhaXQgaW5kZXhIdG1sR2VuZXJhdG9yLnByb2Nlc3Moe1xuICAgICAgYmFzZUhyZWY6IG9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICBsYW5nOiB1bmRlZmluZWQsXG4gICAgICBvdXRwdXRQYXRoOiB2aXJ0dWFsT3V0cHV0UGF0aCxcbiAgICAgIGZpbGVzOiBpbml0aWFsRmlsZXMsXG4gICAgfSk7XG5cbiAgICBmb3IgKGNvbnN0IGVycm9yIG9mIGVycm9ycykge1xuICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZXJyb3IpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHdhcm5pbmcgb2Ygd2FybmluZ3MpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4od2FybmluZyk7XG4gICAgfVxuXG4gICAgZXhlY3V0aW9uUmVzdWx0LmFkZE91dHB1dEZpbGUoaW5kZXhIdG1sT3B0aW9ucy5vdXRwdXQsIGNvbnRlbnQpO1xuICB9XG5cbiAgLy8gQ29weSBhc3NldHNcbiAgaWYgKGFzc2V0cykge1xuICAgIC8vIFRoZSB3ZWJwYWNrIGNvcHkgYXNzZXRzIGhlbHBlciBpcyB1c2VkIHdpdGggbm8gYmFzZSBwYXRocyBkZWZpbmVkLiBUaGlzIHByZXZlbnRzIHRoZSBoZWxwZXJcbiAgICAvLyBmcm9tIGRpcmVjdGx5IHdyaXRpbmcgdG8gZGlzay4gVGhpcyBzaG91bGQgZXZlbnR1YWxseSBiZSByZXBsYWNlZCB3aXRoIGEgbW9yZSBvcHRpbWl6ZWQgaGVscGVyLlxuICAgIGV4ZWN1dGlvblJlc3VsdC5hc3NldEZpbGVzLnB1c2goLi4uKGF3YWl0IGNvcHlBc3NldHMoYXNzZXRzLCBbXSwgd29ya3NwYWNlUm9vdCkpKTtcbiAgfVxuXG4gIC8vIFdyaXRlIG1ldGFmaWxlIGlmIHN0YXRzIG9wdGlvbiBpcyBlbmFibGVkXG4gIGlmIChvcHRpb25zLnN0YXRzKSB7XG4gICAgZXhlY3V0aW9uUmVzdWx0LmFkZE91dHB1dEZpbGUoJ3N0YXRzLmpzb24nLCBKU09OLnN0cmluZ2lmeShtZXRhZmlsZSwgbnVsbCwgMikpO1xuICB9XG5cbiAgLy8gRXh0cmFjdCBhbmQgd3JpdGUgbGljZW5zZXMgZm9yIHVzZWQgcGFja2FnZXNcbiAgaWYgKG9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzKSB7XG4gICAgZXhlY3V0aW9uUmVzdWx0LmFkZE91dHB1dEZpbGUoXG4gICAgICAnM3JkcGFydHlsaWNlbnNlcy50eHQnLFxuICAgICAgYXdhaXQgZXh0cmFjdExpY2Vuc2VzKG1ldGFmaWxlLCB3b3Jrc3BhY2VSb290KSxcbiAgICApO1xuICB9XG5cbiAgLy8gQXVnbWVudCB0aGUgYXBwbGljYXRpb24gd2l0aCBzZXJ2aWNlIHdvcmtlciBzdXBwb3J0XG4gIGlmIChzZXJ2aWNlV29ya2VyT3B0aW9ucykge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzZXJ2aWNlV29ya2VyUmVzdWx0ID0gYXdhaXQgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyRXNidWlsZChcbiAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgc2VydmljZVdvcmtlck9wdGlvbnMsXG4gICAgICAgIG9wdGlvbnMuYmFzZUhyZWYgfHwgJy8nLFxuICAgICAgICBleGVjdXRpb25SZXN1bHQub3V0cHV0RmlsZXMsXG4gICAgICAgIGV4ZWN1dGlvblJlc3VsdC5hc3NldEZpbGVzLFxuICAgICAgKTtcbiAgICAgIGV4ZWN1dGlvblJlc3VsdC5hZGRPdXRwdXRGaWxlKCduZ3N3Lmpzb24nLCBzZXJ2aWNlV29ya2VyUmVzdWx0Lm1hbmlmZXN0KTtcbiAgICAgIGV4ZWN1dGlvblJlc3VsdC5hc3NldEZpbGVzLnB1c2goLi4uc2VydmljZVdvcmtlclJlc3VsdC5hc3NldEZpbGVzKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBgJHtlcnJvcn1gKTtcblxuICAgICAgcmV0dXJuIGV4ZWN1dGlvblJlc3VsdDtcbiAgICB9XG4gIH1cblxuICAvLyBDYWxjdWxhdGUgZXN0aW1hdGVkIHRyYW5zZmVyIHNpemUgaWYgc2NyaXB0cyBhcmUgb3B0aW1pemVkXG4gIGxldCBlc3RpbWF0ZWRUcmFuc2ZlclNpemVzO1xuICBpZiAob3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzIHx8IG9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLm1pbmlmeSkge1xuICAgIGVzdGltYXRlZFRyYW5zZmVyU2l6ZXMgPSBhd2FpdCBjYWxjdWxhdGVFc3RpbWF0ZWRUcmFuc2ZlclNpemVzKGV4ZWN1dGlvblJlc3VsdC5vdXRwdXRGaWxlcyk7XG4gIH1cbiAgbG9nQnVpbGRTdGF0cyhjb250ZXh0LCBtZXRhZmlsZSwgaW5pdGlhbEZpbGVzLCBlc3RpbWF0ZWRUcmFuc2ZlclNpemVzKTtcblxuICBjb25zdCBidWlsZFRpbWUgPSBOdW1iZXIocHJvY2Vzcy5ocnRpbWUuYmlnaW50KCkgLSBzdGFydFRpbWUpIC8gMTAgKiogOTtcbiAgY29udGV4dC5sb2dnZXIuaW5mbyhgQXBwbGljYXRpb24gYnVuZGxlIGdlbmVyYXRpb24gY29tcGxldGUuIFske2J1aWxkVGltZS50b0ZpeGVkKDMpfSBzZWNvbmRzXWApO1xuXG4gIHJldHVybiBleGVjdXRpb25SZXN1bHQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHdyaXRlUmVzdWx0RmlsZXMoXG4gIG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW10sXG4gIGFzc2V0RmlsZXM6IHsgc291cmNlOiBzdHJpbmc7IGRlc3RpbmF0aW9uOiBzdHJpbmcgfVtdIHwgdW5kZWZpbmVkLFxuICBvdXRwdXRQYXRoOiBzdHJpbmcsXG4pIHtcbiAgY29uc3QgZGlyZWN0b3J5RXhpc3RzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGF3YWl0IFByb21pc2UuYWxsKFxuICAgIG91dHB1dEZpbGVzLm1hcChhc3luYyAoZmlsZSkgPT4ge1xuICAgICAgLy8gRW5zdXJlIG91dHB1dCBzdWJkaXJlY3RvcmllcyBleGlzdFxuICAgICAgY29uc3QgYmFzZVBhdGggPSBwYXRoLmRpcm5hbWUoZmlsZS5wYXRoKTtcbiAgICAgIGlmIChiYXNlUGF0aCAmJiAhZGlyZWN0b3J5RXhpc3RzLmhhcyhiYXNlUGF0aCkpIHtcbiAgICAgICAgYXdhaXQgZnMubWtkaXIocGF0aC5qb2luKG91dHB1dFBhdGgsIGJhc2VQYXRoKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgIGRpcmVjdG9yeUV4aXN0cy5hZGQoYmFzZVBhdGgpO1xuICAgICAgfVxuICAgICAgLy8gV3JpdGUgZmlsZSBjb250ZW50c1xuICAgICAgYXdhaXQgZnMud3JpdGVGaWxlKHBhdGguam9pbihvdXRwdXRQYXRoLCBmaWxlLnBhdGgpLCBmaWxlLmNvbnRlbnRzKTtcbiAgICB9KSxcbiAgKTtcblxuICBpZiAoYXNzZXRGaWxlcz8ubGVuZ3RoKSB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBhc3NldEZpbGVzLm1hcChhc3luYyAoeyBzb3VyY2UsIGRlc3RpbmF0aW9uIH0pID0+IHtcbiAgICAgICAgLy8gRW5zdXJlIG91dHB1dCBzdWJkaXJlY3RvcmllcyBleGlzdFxuICAgICAgICBjb25zdCBiYXNlUGF0aCA9IHBhdGguZGlybmFtZShkZXN0aW5hdGlvbik7XG4gICAgICAgIGlmIChiYXNlUGF0aCAmJiAhZGlyZWN0b3J5RXhpc3RzLmhhcyhiYXNlUGF0aCkpIHtcbiAgICAgICAgICBhd2FpdCBmcy5ta2RpcihwYXRoLmpvaW4ob3V0cHV0UGF0aCwgYmFzZVBhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICBkaXJlY3RvcnlFeGlzdHMuYWRkKGJhc2VQYXRoKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBDb3B5IGZpbGUgY29udGVudHNcbiAgICAgICAgYXdhaXQgZnMuY29weUZpbGUoc291cmNlLCBwYXRoLmpvaW4ob3V0cHV0UGF0aCwgZGVzdGluYXRpb24pLCBmc0NvbnN0YW50cy5DT1BZRklMRV9GSUNMT05FKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHBhdGg6IHN0cmluZywgdGV4dDogc3RyaW5nKTogT3V0cHV0RmlsZSB7XG4gIHJldHVybiB7XG4gICAgcGF0aCxcbiAgICB0ZXh0LFxuICAgIGdldCBjb250ZW50cygpIHtcbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbSh0aGlzLnRleHQsICd1dGYtOCcpO1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvZGVCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4gIGJyb3dzZXJzOiBzdHJpbmdbXSxcbiAgc291cmNlRmlsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlLFxuKTogQnVpbGRPcHRpb25zIHtcbiAgY29uc3Qge1xuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgZW50cnlQb2ludHMsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIG91dEV4dGVuc2lvbixcbiAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLFxuICAgIGFkdmFuY2VkT3B0aW1pemF0aW9ucyxcbiAgICBpbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgIGppdCxcbiAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IGJ1aWxkT3B0aW9uczogQnVpbGRPcHRpb25zID0ge1xuICAgIGFic1dvcmtpbmdEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgYnVuZGxlOiB0cnVlLFxuICAgIGZvcm1hdDogJ2VzbScsXG4gICAgZW50cnlQb2ludHMsXG4gICAgZW50cnlOYW1lczogb3V0cHV0TmFtZXMuYnVuZGxlcyxcbiAgICBhc3NldE5hbWVzOiBvdXRwdXROYW1lcy5tZWRpYSxcbiAgICB0YXJnZXQsXG4gICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICBjb25kaXRpb25zOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnbW9kdWxlJ10sXG4gICAgcmVzb2x2ZUV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBsZWdhbENvbW1lbnRzOiBvcHRpb25zLmV4dHJhY3RMaWNlbnNlcyA/ICdub25lJyA6ICdlb2YnLFxuICAgIGxvZ0xldmVsOiBvcHRpb25zLnZlcmJvc2UgPyAnZGVidWcnIDogJ3NpbGVudCcsXG4gICAgbWluaWZ5OiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgcHVyZTogWydmb3J3YXJkUmVmJ10sXG4gICAgb3V0ZGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIG91dEV4dGVuc2lvbjogb3V0RXh0ZW5zaW9uID8geyAnLmpzJzogYC4ke291dEV4dGVuc2lvbn1gIH0gOiB1bmRlZmluZWQsXG4gICAgc291cmNlbWFwOiBzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gJ2V4dGVybmFsJyA6IHRydWUpLFxuICAgIHNwbGl0dGluZzogdHJ1ZSxcbiAgICB0c2NvbmZpZyxcbiAgICBleHRlcm5hbDogZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVTb3VyY2VtYXBJbmdvcmVsaXN0UGx1Z2luKCksXG4gICAgICBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgICAgICAgLy8gSlMvVFMgb3B0aW9uc1xuICAgICAgICB7XG4gICAgICAgICAgc291cmNlbWFwOiAhIXNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyxcbiAgICAgICAgICB0aGlyZFBhcnR5U291cmNlbWFwczogc291cmNlbWFwT3B0aW9ucy52ZW5kb3IsXG4gICAgICAgICAgdHNjb25maWcsXG4gICAgICAgICAgaml0LFxuICAgICAgICAgIGFkdmFuY2VkT3B0aW1pemF0aW9ucyxcbiAgICAgICAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgICAgICAgIHNvdXJjZUZpbGVDYWNoZSxcbiAgICAgICAgICBsb2FkUmVzdWx0Q2FjaGU6IHNvdXJjZUZpbGVDYWNoZT8ubG9hZFJlc3VsdENhY2hlLFxuICAgICAgICB9LFxuICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzaGVldCBvcHRpb25zXG4gICAgICAgIHtcbiAgICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgIG9wdGltaXphdGlvbjogISFvcHRpbWl6YXRpb25PcHRpb25zLnN0eWxlcy5taW5pZnksXG4gICAgICAgICAgc291cmNlbWFwOlxuICAgICAgICAgICAgLy8gSGlkZGVuIGNvbXBvbmVudCBzdHlsZXNoZWV0IHNvdXJjZW1hcHMgYXJlIGluYWNjZXNzaWJsZSB3aGljaCBpcyBlZmZlY3RpdmVseVxuICAgICAgICAgICAgLy8gdGhlIHNhbWUgYXMgYmVpbmcgZGlzYWJsZWQuIERpc2FibGluZyBoYXMgdGhlIGFkdmFudGFnZSBvZiBhdm9pZGluZyB0aGUgb3ZlcmhlYWRcbiAgICAgICAgICAgIC8vIG9mIHNvdXJjZW1hcCBwcm9jZXNzaW5nLlxuICAgICAgICAgICAgISFzb3VyY2VtYXBPcHRpb25zLnN0eWxlcyAmJiAoc291cmNlbWFwT3B0aW9ucy5oaWRkZW4gPyBmYWxzZSA6ICdpbmxpbmUnKSxcbiAgICAgICAgICBvdXRwdXROYW1lcyxcbiAgICAgICAgICBpbmNsdWRlUGF0aHM6IHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucz8uaW5jbHVkZVBhdGhzLFxuICAgICAgICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICBpbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgICAgICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgICAgICAgYnJvd3NlcnMsXG4gICAgICAgICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICAgICAgICB9LFxuICAgICAgKSxcbiAgICBdLFxuICAgIGRlZmluZToge1xuICAgICAgLy8gT25seSBzZXQgdG8gZmFsc2Ugd2hlbiBzY3JpcHQgb3B0aW1pemF0aW9ucyBhcmUgZW5hYmxlZC4gSXQgc2hvdWxkIG5vdCBiZSBzZXQgdG8gdHJ1ZSBiZWNhdXNlXG4gICAgICAvLyBBbmd1bGFyIHR1cm5zIGBuZ0Rldk1vZGVgIGludG8gYW4gb2JqZWN0IGZvciBkZXZlbG9wbWVudCBkZWJ1Z2dpbmcgcHVycG9zZXMgd2hlbiBub3QgZGVmaW5lZFxuICAgICAgLy8gd2hpY2ggYSBjb25zdGFudCB0cnVlIHZhbHVlIHdvdWxkIGJyZWFrLlxuICAgICAgLi4uKG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyA/IHsgJ25nRGV2TW9kZSc6ICdmYWxzZScgfSA6IHVuZGVmaW5lZCksXG4gICAgICAnbmdKaXRNb2RlJzogaml0ID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICB9LFxuICB9O1xuXG4gIGNvbnN0IHBvbHlmaWxscyA9IG9wdGlvbnMucG9seWZpbGxzID8gWy4uLm9wdGlvbnMucG9seWZpbGxzXSA6IFtdO1xuICBpZiAoaml0KSB7XG4gICAgcG9seWZpbGxzLnB1c2goJ0Bhbmd1bGFyL2NvbXBpbGVyJyk7XG4gIH1cblxuICBpZiAocG9seWZpbGxzPy5sZW5ndGgpIHtcbiAgICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpwb2x5ZmlsbHMnO1xuICAgIGJ1aWxkT3B0aW9ucy5lbnRyeVBvaW50cyA9IHtcbiAgICAgIC4uLmJ1aWxkT3B0aW9ucy5lbnRyeVBvaW50cyxcbiAgICAgIFsncG9seWZpbGxzJ106IG5hbWVzcGFjZSxcbiAgICB9O1xuXG4gICAgYnVpbGRPcHRpb25zLnBsdWdpbnM/LnVuc2hpZnQoe1xuICAgICAgbmFtZTogJ2FuZ3VsYXItcG9seWZpbGxzJyxcbiAgICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICAgIGJ1aWxkLm9uUmVzb2x2ZSh7IGZpbHRlcjogL15hbmd1bGFyOnBvbHlmaWxscyQvIH0sIChhcmdzKSA9PiB7XG4gICAgICAgICAgaWYgKGFyZ3Mua2luZCAhPT0gJ2VudHJ5LXBvaW50Jykge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBhdGg6ICdlbnRyeScsXG4gICAgICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogLy4vLCBuYW1lc3BhY2UgfSwgKCkgPT4ge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb250ZW50czogcG9seWZpbGxzLm1hcCgoZmlsZSkgPT4gYGltcG9ydCAnJHtmaWxlLnJlcGxhY2UoL1xcXFwvZywgJy8nKX0nO2ApLmpvaW4oJ1xcbicpLFxuICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gYnVpbGRPcHRpb25zO1xufVxuXG4vKipcbiAqIEdlbmVyYXRlcyBhIHN5bnRheCBmZWF0dXJlIG9iamVjdCBtYXAgZm9yIEFuZ3VsYXIgYXBwbGljYXRpb25zIGJhc2VkIG9uIGEgbGlzdCBvZiB0YXJnZXRzLlxuICogQSBmdWxsIHNldCBvZiBmZWF0dXJlIG5hbWVzIGNhbiBiZSBmb3VuZCBoZXJlOiBodHRwczovL2VzYnVpbGQuZ2l0aHViLmlvL2FwaS8jc3VwcG9ydGVkXG4gKiBAcGFyYW0gdGFyZ2V0IEFuIGFycmF5IG9mIGJyb3dzZXIvZW5naW5lIHRhcmdldHMgaW4gdGhlIGZvcm1hdCBhY2NlcHRlZCBieSB0aGUgZXNidWlsZCBgdGFyZ2V0YCBvcHRpb24uXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgdGhhdCBjYW4gYmUgdXNlZCB3aXRoIHRoZSBlc2J1aWxkIGJ1aWxkIGBzdXBwb3J0ZWRgIG9wdGlvbi5cbiAqL1xuZnVuY3Rpb24gZ2V0RmVhdHVyZVN1cHBvcnQodGFyZ2V0OiBzdHJpbmdbXSk6IEJ1aWxkT3B0aW9uc1snc3VwcG9ydGVkJ10ge1xuICBjb25zdCBzdXBwb3J0ZWQ6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+ID0ge1xuICAgIC8vIE5hdGl2ZSBhc3luYy9hd2FpdCBpcyBub3Qgc3VwcG9ydGVkIHdpdGggWm9uZS5qcy4gRGlzYWJsaW5nIHN1cHBvcnQgaGVyZSB3aWxsIGNhdXNlXG4gICAgLy8gZXNidWlsZCB0byBkb3dubGV2ZWwgYXN5bmMvYXdhaXQgYW5kIGZvciBhd2FpdC4uLm9mIHRvIGEgWm9uZS5qcyBzdXBwb3J0ZWQgZm9ybS4gSG93ZXZlciwgZXNidWlsZFxuICAgIC8vIGRvZXMgbm90IGN1cnJlbnRseSBzdXBwb3J0IGRvd25sZXZlbGluZyBhc3luYyBnZW5lcmF0b3JzLiBJbnN0ZWFkIGJhYmVsIGlzIHVzZWQgd2l0aGluIHRoZSBKUy9UU1xuICAgIC8vIGxvYWRlciB0byBwZXJmb3JtIHRoZSBkb3dubGV2ZWwgdHJhbnNmb3JtYXRpb24uXG4gICAgLy8gTk9URTogSWYgZXNidWlsZCBhZGRzIHN1cHBvcnQgaW4gdGhlIGZ1dHVyZSwgdGhlIGJhYmVsIHN1cHBvcnQgZm9yIGFzeW5jIGdlbmVyYXRvcnMgY2FuIGJlIGRpc2FibGVkLlxuICAgICdhc3luYy1hd2FpdCc6IGZhbHNlLFxuICAgIC8vIFY4IGN1cnJlbnRseSBoYXMgYSBwZXJmb3JtYW5jZSBkZWZlY3QgaW52b2x2aW5nIG9iamVjdCBzcHJlYWQgb3BlcmF0aW9ucyB0aGF0IGNhbiBjYXVzZSBzaWduZmljYW50XG4gICAgLy8gZGVncmFkYXRpb24gaW4gcnVudGltZSBwZXJmb3JtYW5jZS4gQnkgbm90IHN1cHBvcnRpbmcgdGhlIGxhbmd1YWdlIGZlYXR1cmUgaGVyZSwgYSBkb3dubGV2ZWwgZm9ybVxuICAgIC8vIHdpbGwgYmUgdXNlZCBpbnN0ZWFkIHdoaWNoIHByb3ZpZGVzIGEgd29ya2Fyb3VuZCBmb3IgdGhlIHBlcmZvcm1hbmNlIGlzc3VlLlxuICAgIC8vIEZvciBtb3JlIGRldGFpbHM6IGh0dHBzOi8vYnVncy5jaHJvbWl1bS5vcmcvcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTExNTM2XG4gICAgJ29iamVjdC1yZXN0LXNwcmVhZCc6IGZhbHNlLFxuICAgIC8vIGVzYnVpbGQgY3VycmVudGx5IGhhcyBhIGRlZmVjdCBpbnZvbHZpbmcgc2VsZi1yZWZlcmVuY2luZyBhIGNsYXNzIHdpdGhpbiBhIHN0YXRpYyBjb2RlIGJsb2NrIG9yXG4gICAgLy8gc3RhdGljIGZpZWxkIGluaXRpYWxpemVyLiBUaGlzIGlzIG5vdCBhbiBpc3N1ZSBmb3IgcHJvamVjdHMgdGhhdCB1c2UgdGhlIGRlZmF1bHQgYnJvd3NlcnNsaXN0IGFzIHRoZXNlXG4gICAgLy8gZWxlbWVudHMgYXJlIGFuIEVTMjAyMiBmZWF0dXJlIHdoaWNoIGlzIG5vdCBzdXBwb3J0IGJ5IGFsbCBicm93c2VycyBpbiB0aGUgZGVmYXVsdCBsaXN0LiBIb3dldmVyLCBpZiBhXG4gICAgLy8gY3VzdG9tIGJyb3dzZXJzbGlzdCBpcyB1c2VkIHRoYXQgb25seSBoYXMgbmV3ZXIgYnJvd3NlcnMgdGhhbiB0aGUgc3RhdGljIGNvZGUgZWxlbWVudHMgbWF5IGJlIHByZXNlbnQuXG4gICAgLy8gVGhpcyBpc3N1ZSBpcyBjb21wb3VuZGVkIGJ5IHRoZSBkZWZhdWx0IHVzYWdlIG9mIHRoZSB0c2NvbmZpZyBgXCJ1c2VEZWZpbmVGb3JDbGFzc0ZpZWxkc1wiOiBmYWxzZWAgb3B0aW9uXG4gICAgLy8gcHJlc2VudCBpbiBnZW5lcmF0ZWQgQ0xJIHByb2plY3RzIHdoaWNoIGNhdXNlcyBzdGF0aWMgY29kZSBibG9ja3MgdG8gYmUgdXNlZCBpbnN0ZWFkIG9mIHN0YXRpYyBmaWVsZHMuXG4gICAgLy8gZXNidWlsZCBjdXJyZW50bHkgdW5jb25kaXRpb25hbGx5IGRvd25sZXZlbHMgYWxsIHN0YXRpYyBmaWVsZHMgaW4gdG9wLWxldmVsIGNsYXNzZXMgc28gdG8gd29ya2Fyb3VuZCB0aGVcbiAgICAvLyBBbmd1bGFyIGlzc3VlIG9ubHkgc3RhdGljIGNvZGUgYmxvY2tzIGFyZSBkaXNhYmxlZCBoZXJlLlxuICAgIC8vIEZvciBtb3JlIGRldGFpbHM6IGh0dHBzOi8vZ2l0aHViLmNvbS9ldmFudy9lc2J1aWxkL2lzc3Vlcy8yOTUwXG4gICAgJ2NsYXNzLXN0YXRpYy1ibG9ja3MnOiBmYWxzZSxcbiAgfTtcblxuICAvLyBEZXRlY3QgU2FmYXJpIGJyb3dzZXIgdmVyc2lvbnMgdGhhdCBoYXZlIGEgY2xhc3MgZmllbGQgYmVoYXZpb3IgYnVnXG4gIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzI0MzU1I2lzc3VlY29tbWVudC0xMzMzNDc3MDMzXG4gIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL1dlYktpdC9XZWJLaXQvY29tbWl0L2U4Nzg4YTM0YjNkNWY1YjRlZGQ3ZmY2NDUwYjgwOTM2YmZmMzk2ZjJcbiAgbGV0IHNhZmFyaUNsYXNzRmllbGRTY29wZUJ1ZyA9IGZhbHNlO1xuICBmb3IgKGNvbnN0IGJyb3dzZXIgb2YgdGFyZ2V0KSB7XG4gICAgbGV0IG1ham9yVmVyc2lvbjtcbiAgICBpZiAoYnJvd3Nlci5zdGFydHNXaXRoKCdpb3MnKSkge1xuICAgICAgbWFqb3JWZXJzaW9uID0gTnVtYmVyKGJyb3dzZXIuc2xpY2UoMywgNSkpO1xuICAgIH0gZWxzZSBpZiAoYnJvd3Nlci5zdGFydHNXaXRoKCdzYWZhcmknKSkge1xuICAgICAgbWFqb3JWZXJzaW9uID0gTnVtYmVyKGJyb3dzZXIuc2xpY2UoNiwgOCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgLy8gVGVjaG5pY2FsbHksIDE0LjAgaXMgbm90IGJyb2tlbiBidXQgcmF0aGVyIGRvZXMgbm90IGhhdmUgc3VwcG9ydC4gSG93ZXZlciwgdGhlIGJlaGF2aW9yXG4gICAgLy8gaXMgaWRlbnRpY2FsIHNpbmNlIGl0IHdvdWxkIGJlIHNldCB0byBmYWxzZSBieSBlc2J1aWxkIGlmIHByZXNlbnQgYXMgYSB0YXJnZXQuXG4gICAgaWYgKG1ham9yVmVyc2lvbiA9PT0gMTQgfHwgbWFqb3JWZXJzaW9uID09PSAxNSkge1xuICAgICAgc2FmYXJpQ2xhc3NGaWVsZFNjb3BlQnVnID0gdHJ1ZTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICAvLyBJZiBjbGFzcyBmaWVsZCBzdXBwb3J0IGNhbm5vdCBiZSB1c2VkIHNldCB0byBmYWxzZTsgb3RoZXJ3aXNlIGxlYXZlIHVuZGVmaW5lZCB0byBhbGxvd1xuICAvLyBlc2J1aWxkIHRvIHVzZSBgdGFyZ2V0YCB0byBkZXRlcm1pbmUgc3VwcG9ydC5cbiAgaWYgKHNhZmFyaUNsYXNzRmllbGRTY29wZUJ1Zykge1xuICAgIHN1cHBvcnRlZFsnY2xhc3MtZmllbGQnXSA9IGZhbHNlO1xuICAgIHN1cHBvcnRlZFsnY2xhc3Mtc3RhdGljLWZpZWxkJ10gPSBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiBzdXBwb3J0ZWQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHdpdGhTcGlubmVyPFQ+KHRleHQ6IHN0cmluZywgYWN0aW9uOiAoKSA9PiBUIHwgUHJvbWlzZTxUPik6IFByb21pc2U8VD4ge1xuICBjb25zdCBzcGlubmVyID0gbmV3IFNwaW5uZXIodGV4dCk7XG4gIHNwaW5uZXIuc3RhcnQoKTtcblxuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCBhY3Rpb24oKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBzcGlubmVyLnN0b3AoKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB3aXRoTm9Qcm9ncmVzczxUPih0ZXN0OiBzdHJpbmcsIGFjdGlvbjogKCkgPT4gVCB8IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+IHtcbiAgcmV0dXJuIGFjdGlvbigpO1xufVxuXG4vKipcbiAqIE1haW4gZXhlY3V0aW9uIGZ1bmN0aW9uIGZvciB0aGUgZXNidWlsZC1iYXNlZCBhcHBsaWNhdGlvbiBidWlsZGVyLlxuICogVGhlIG9wdGlvbnMgYXJlIGNvbXBhdGlibGUgd2l0aCB0aGUgV2VicGFjay1iYXNlZCBidWlsZGVyLlxuICogQHBhcmFtIHVzZXJPcHRpb25zIFRoZSBicm93c2VyIGJ1aWxkZXIgb3B0aW9ucyB0byB1c2Ugd2hlbiBzZXR0aW5nIHVwIHRoZSBhcHBsaWNhdGlvbiBidWlsZFxuICogQHBhcmFtIGNvbnRleHQgVGhlIEFyY2hpdGVjdCBidWlsZGVyIGNvbnRleHQgb2JqZWN0XG4gKiBAcmV0dXJucyBBbiBhc3luYyBpdGVyYWJsZSB3aXRoIHRoZSBidWlsZGVyIHJlc3VsdCBvdXRwdXRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkRXNidWlsZEJyb3dzZXIoXG4gIHVzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBpbmZyYXN0cnVjdHVyZVNldHRpbmdzPzoge1xuICAgIHdyaXRlPzogYm9vbGVhbjtcbiAgfSxcbik6IEFzeW5jSXRlcmFibGU8XG4gIEJ1aWxkZXJPdXRwdXQgJiB7XG4gICAgb3V0cHV0RmlsZXM/OiBPdXRwdXRGaWxlW107XG4gICAgYXNzZXRGaWxlcz86IHsgc291cmNlOiBzdHJpbmc7IGRlc3RpbmF0aW9uOiBzdHJpbmcgfVtdO1xuICB9XG4+IHtcbiAgcmV0dXJuIGJ1aWxkRXNidWlsZEJyb3dzZXJJbnRlcm5hbCh1c2VyT3B0aW9ucywgY29udGV4dCwgaW5mcmFzdHJ1Y3R1cmVTZXR0aW5ncyk7XG59XG5cbi8qKlxuICogSW50ZXJuYWwgdmVyc2lvbiBvZiB0aGUgbWFpbiBleGVjdXRpb24gZnVuY3Rpb24gZm9yIHRoZSBlc2J1aWxkLWJhc2VkIGFwcGxpY2F0aW9uIGJ1aWxkZXIuXG4gKiBFeHBvc2VzIHNvbWUgYWRkaXRpb25hbCBcInByaXZhdGVcIiBvcHRpb25zIGluIGFkZGl0aW9uIHRvIHRob3NlIGV4cG9zZWQgYnkgdGhlIHNjaGVtYS5cbiAqIEBwYXJhbSB1c2VyT3B0aW9ucyBUaGUgYnJvd3Nlci1lc2J1aWxkIGJ1aWxkZXIgb3B0aW9ucyB0byB1c2Ugd2hlbiBzZXR0aW5nIHVwIHRoZSBhcHBsaWNhdGlvbiBidWlsZFxuICogQHBhcmFtIGNvbnRleHQgVGhlIEFyY2hpdGVjdCBidWlsZGVyIGNvbnRleHQgb2JqZWN0XG4gKiBAcmV0dXJucyBBbiBhc3luYyBpdGVyYWJsZSB3aXRoIHRoZSBidWlsZGVyIHJlc3VsdCBvdXRwdXRcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uKiBidWlsZEVzYnVpbGRCcm93c2VySW50ZXJuYWwoXG4gIHVzZXJPcHRpb25zOiBCcm93c2VyRXNidWlsZE9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBpbmZyYXN0cnVjdHVyZVNldHRpbmdzPzoge1xuICAgIHdyaXRlPzogYm9vbGVhbjtcbiAgfSxcbik6IEFzeW5jSXRlcmFibGU8XG4gIEJ1aWxkZXJPdXRwdXQgJiB7XG4gICAgb3V0cHV0RmlsZXM/OiBPdXRwdXRGaWxlW107XG4gICAgYXNzZXRGaWxlcz86IHsgc291cmNlOiBzdHJpbmc7IGRlc3RpbmF0aW9uOiBzdHJpbmcgfVtdO1xuICB9XG4+IHtcbiAgLy8gSW5mb3JtIHVzZXIgb2Ygc3RhdHVzIG9mIGJ1aWxkZXIgYW5kIG9wdGlvbnNcbiAgbG9nQnVpbGRlclN0YXR1c1dhcm5pbmdzKHVzZXJPcHRpb25zLCBjb250ZXh0KTtcblxuICAvLyBEZXRlcm1pbmUgcHJvamVjdCBuYW1lIGZyb20gYnVpbGRlciBjb250ZXh0IHRhcmdldFxuICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0Py5wcm9qZWN0O1xuICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoYFRoZSAnYnJvd3Nlci1lc2J1aWxkJyBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0IHRvIGJlIHNwZWNpZmllZC5gKTtcblxuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IG5vcm1hbGl6ZWRPcHRpb25zID0gYXdhaXQgbm9ybWFsaXplT3B0aW9ucyhjb250ZXh0LCBwcm9qZWN0TmFtZSwgdXNlck9wdGlvbnMpO1xuICAvLyBXcml0aW5nIHRoZSByZXN1bHQgdG8gdGhlIGZpbGVzeXN0ZW0gaXMgdGhlIGRlZmF1bHQgYmVoYXZpb3JcbiAgY29uc3Qgc2hvdWxkV3JpdGVSZXN1bHQgPSBpbmZyYXN0cnVjdHVyZVNldHRpbmdzPy53cml0ZSAhPT0gZmFsc2U7XG5cbiAgaWYgKHNob3VsZFdyaXRlUmVzdWx0KSB7XG4gICAgLy8gQ2xlYW4gb3V0cHV0IHBhdGggaWYgZW5hYmxlZFxuICAgIGlmICh1c2VyT3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoKSB7XG4gICAgICBpZiAobm9ybWFsaXplZE9wdGlvbnMub3V0cHV0UGF0aCA9PT0gbm9ybWFsaXplZE9wdGlvbnMud29ya3NwYWNlUm9vdCkge1xuICAgICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcignT3V0cHV0IHBhdGggTVVTVCBub3QgYmUgd29ya3NwYWNlIHJvb3QgZGlyZWN0b3J5IScpO1xuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgZnMucm0obm9ybWFsaXplZE9wdGlvbnMub3V0cHV0UGF0aCwgeyBmb3JjZTogdHJ1ZSwgcmVjdXJzaXZlOiB0cnVlLCBtYXhSZXRyaWVzOiAzIH0pO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBvdXRwdXQgZGlyZWN0b3J5IGlmIG5lZWRlZFxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmcy5ta2Rpcihub3JtYWxpemVkT3B0aW9ucy5vdXRwdXRQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBhc3NlcnRJc0Vycm9yKGUpO1xuICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoJ1VuYWJsZSB0byBjcmVhdGUgb3V0cHV0IGRpcmVjdG9yeTogJyArIGUubWVzc2FnZSk7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cblxuICBjb25zdCB3aXRoUHJvZ3Jlc3M6IHR5cGVvZiB3aXRoU3Bpbm5lciA9IG5vcm1hbGl6ZWRPcHRpb25zLnByb2dyZXNzXG4gICAgPyB3aXRoU3Bpbm5lclxuICAgIDogd2l0aE5vUHJvZ3Jlc3M7XG5cbiAgLy8gSW5pdGlhbCBidWlsZFxuICBsZXQgcmVzdWx0OiBFeGVjdXRpb25SZXN1bHQ7XG4gIHRyeSB7XG4gICAgcmVzdWx0ID0gYXdhaXQgd2l0aFByb2dyZXNzKCdCdWlsZGluZy4uLicsICgpID0+IGV4ZWN1dGUobm9ybWFsaXplZE9wdGlvbnMsIGNvbnRleHQpKTtcblxuICAgIGlmIChzaG91bGRXcml0ZVJlc3VsdCkge1xuICAgICAgLy8gV3JpdGUgb3V0cHV0IGZpbGVzXG4gICAgICBhd2FpdCB3cml0ZVJlc3VsdEZpbGVzKHJlc3VsdC5vdXRwdXRGaWxlcywgcmVzdWx0LmFzc2V0RmlsZXMsIG5vcm1hbGl6ZWRPcHRpb25zLm91dHB1dFBhdGgpO1xuXG4gICAgICB5aWVsZCByZXN1bHQub3V0cHV0O1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBSZXF1aXJlcyBjYXN0aW5nIGR1ZSB0byB1bm5lZWRlZCBgSnNvbk9iamVjdGAgcmVxdWlyZW1lbnQuIFJlbW92ZSBvbmNlIGZpeGVkLlxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgIHlpZWxkIHJlc3VsdC5vdXRwdXRXaXRoRmlsZXMgYXMgYW55O1xuICAgIH1cblxuICAgIC8vIEZpbmlzaCBpZiB3YXRjaCBtb2RlIGlzIG5vdCBlbmFibGVkXG4gICAgaWYgKCF1c2VyT3B0aW9ucy53YXRjaCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICAvLyBFbnN1cmUgU2FzcyB3b3JrZXJzIGFyZSBzaHV0ZG93biBpZiBub3Qgd2F0Y2hpbmdcbiAgICBpZiAoIXVzZXJPcHRpb25zLndhdGNoKSB7XG4gICAgICBzaHV0ZG93blNhc3NXb3JrZXJQb29sKCk7XG4gICAgfVxuICB9XG5cbiAgaWYgKG5vcm1hbGl6ZWRPcHRpb25zLnByb2dyZXNzKSB7XG4gICAgY29udGV4dC5sb2dnZXIuaW5mbygnV2F0Y2ggbW9kZSBlbmFibGVkLiBXYXRjaGluZyBmb3IgZmlsZSBjaGFuZ2VzLi4uJyk7XG4gIH1cblxuICAvLyBTZXR1cCBhIHdhdGNoZXJcbiAgY29uc3QgeyBjcmVhdGVXYXRjaGVyIH0gPSBhd2FpdCBpbXBvcnQoJy4vd2F0Y2hlcicpO1xuICBjb25zdCB3YXRjaGVyID0gY3JlYXRlV2F0Y2hlcih7XG4gICAgcG9sbGluZzogdHlwZW9mIHVzZXJPcHRpb25zLnBvbGwgPT09ICdudW1iZXInLFxuICAgIGludGVydmFsOiB1c2VyT3B0aW9ucy5wb2xsLFxuICAgIGlnbm9yZWQ6IFtcbiAgICAgIC8vIElnbm9yZSB0aGUgb3V0cHV0IGFuZCBjYWNoZSBwYXRocyB0byBhdm9pZCBpbmZpbml0ZSByZWJ1aWxkIGN5Y2xlc1xuICAgICAgbm9ybWFsaXplZE9wdGlvbnMub3V0cHV0UGF0aCxcbiAgICAgIG5vcm1hbGl6ZWRPcHRpb25zLmNhY2hlT3B0aW9ucy5iYXNlUGF0aCxcbiAgICAgIC8vIElnbm9yZSBhbGwgbm9kZSBtb2R1bGVzIGRpcmVjdG9yaWVzIHRvIGF2b2lkIGV4Y2Vzc2l2ZSBmaWxlIHdhdGNoZXJzLlxuICAgICAgLy8gUGFja2FnZSBjaGFuZ2VzIGFyZSBoYW5kbGVkIGJlbG93IGJ5IHdhdGNoaW5nIG1hbmlmZXN0IGFuZCBsb2NrIGZpbGVzLlxuICAgICAgJyoqL25vZGVfbW9kdWxlcy8qKicsXG4gICAgXSxcbiAgfSk7XG5cbiAgLy8gVGVtcG9yYXJpbHkgd2F0Y2ggdGhlIGVudGlyZSBwcm9qZWN0XG4gIHdhdGNoZXIuYWRkKG5vcm1hbGl6ZWRPcHRpb25zLnByb2plY3RSb290KTtcblxuICAvLyBXYXRjaCB3b3Jrc3BhY2UgZm9yIHBhY2thZ2UgbWFuYWdlciBjaGFuZ2VzXG4gIGNvbnN0IHBhY2thZ2VXYXRjaEZpbGVzID0gW1xuICAgIC8vIG1hbmlmZXN0IGNhbiBhZmZlY3QgbW9kdWxlIHJlc29sdXRpb25cbiAgICAncGFja2FnZS5qc29uJyxcbiAgICAvLyBucG0gbG9jayBmaWxlXG4gICAgJ3BhY2thZ2UtbG9jay5qc29uJyxcbiAgICAvLyBwbnBtIGxvY2sgZmlsZVxuICAgICdwbnBtLWxvY2sueWFtbCcsXG4gICAgLy8geWFybiBsb2NrIGZpbGUgaW5jbHVkaW5nIFlhcm4gUG5QIG1hbmlmZXN0IGZpbGVzIChodHRwczovL3lhcm5wa2cuY29tL2FkdmFuY2VkL3BucC1zcGVjLylcbiAgICAneWFybi5sb2NrJyxcbiAgICAnLnBucC5janMnLFxuICAgICcucG5wLmRhdGEuanNvbicsXG4gIF07XG4gIHdhdGNoZXIuYWRkKHBhY2thZ2VXYXRjaEZpbGVzLm1hcCgoZmlsZSkgPT4gcGF0aC5qb2luKG5vcm1hbGl6ZWRPcHRpb25zLndvcmtzcGFjZVJvb3QsIGZpbGUpKSk7XG5cbiAgLy8gV2F0Y2ggbG9jYXRpb25zIHByb3ZpZGVkIGJ5IHRoZSBpbml0aWFsIGJ1aWxkIHJlc3VsdFxuICBsZXQgcHJldmlvdXNXYXRjaEZpbGVzID0gbmV3IFNldChyZXN1bHQud2F0Y2hGaWxlcyk7XG4gIHdhdGNoZXIuYWRkKHJlc3VsdC53YXRjaEZpbGVzKTtcblxuICAvLyBXYWl0IGZvciBjaGFuZ2VzIGFuZCByZWJ1aWxkIGFzIG5lZWRlZFxuICB0cnkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2hhbmdlcyBvZiB3YXRjaGVyKSB7XG4gICAgICBpZiAodXNlck9wdGlvbnMudmVyYm9zZSkge1xuICAgICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKGNoYW5nZXMudG9EZWJ1Z1N0cmluZygpKTtcbiAgICAgIH1cblxuICAgICAgcmVzdWx0ID0gYXdhaXQgd2l0aFByb2dyZXNzKCdDaGFuZ2VzIGRldGVjdGVkLiBSZWJ1aWxkaW5nLi4uJywgKCkgPT5cbiAgICAgICAgZXhlY3V0ZShub3JtYWxpemVkT3B0aW9ucywgY29udGV4dCwgcmVzdWx0LmNyZWF0ZVJlYnVpbGRTdGF0ZShjaGFuZ2VzKSksXG4gICAgICApO1xuXG4gICAgICAvLyBVcGRhdGUgd2F0Y2hlZCBsb2NhdGlvbnMgcHJvdmlkZWQgYnkgdGhlIG5ldyBidWlsZCByZXN1bHQuXG4gICAgICAvLyBBZGQgYW55IG5ldyBsb2NhdGlvbnNcbiAgICAgIHdhdGNoZXIuYWRkKHJlc3VsdC53YXRjaEZpbGVzLmZpbHRlcigod2F0Y2hGaWxlKSA9PiAhcHJldmlvdXNXYXRjaEZpbGVzLmhhcyh3YXRjaEZpbGUpKSk7XG4gICAgICBjb25zdCBuZXdXYXRjaEZpbGVzID0gbmV3IFNldChyZXN1bHQud2F0Y2hGaWxlcyk7XG4gICAgICAvLyBSZW1vdmUgYW55IG9sZCBsb2NhdGlvbnNcbiAgICAgIHdhdGNoZXIucmVtb3ZlKFsuLi5wcmV2aW91c1dhdGNoRmlsZXNdLmZpbHRlcigod2F0Y2hGaWxlKSA9PiAhbmV3V2F0Y2hGaWxlcy5oYXMod2F0Y2hGaWxlKSkpO1xuICAgICAgcHJldmlvdXNXYXRjaEZpbGVzID0gbmV3V2F0Y2hGaWxlcztcblxuICAgICAgaWYgKHNob3VsZFdyaXRlUmVzdWx0KSB7XG4gICAgICAgIC8vIFdyaXRlIG91dHB1dCBmaWxlc1xuICAgICAgICBhd2FpdCB3cml0ZVJlc3VsdEZpbGVzKHJlc3VsdC5vdXRwdXRGaWxlcywgcmVzdWx0LmFzc2V0RmlsZXMsIG5vcm1hbGl6ZWRPcHRpb25zLm91dHB1dFBhdGgpO1xuXG4gICAgICAgIHlpZWxkIHJlc3VsdC5vdXRwdXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBSZXF1aXJlcyBjYXN0aW5nIGR1ZSB0byB1bm5lZWRlZCBgSnNvbk9iamVjdGAgcmVxdWlyZW1lbnQuIFJlbW92ZSBvbmNlIGZpeGVkLlxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgICB5aWVsZCByZXN1bHQub3V0cHV0V2l0aEZpbGVzIGFzIGFueTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZmluYWxseSB7XG4gICAgLy8gU3RvcCB0aGUgd2F0Y2hlclxuICAgIGF3YWl0IHdhdGNoZXIuY2xvc2UoKTtcbiAgICAvLyBDbGVhbnVwIGluY3JlbWVudGFsIHJlYnVpbGQgc3RhdGVcbiAgICBhd2FpdCByZXN1bHQuZGlzcG9zZSgpO1xuICAgIHNodXRkb3duU2Fzc1dvcmtlclBvb2woKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyKGJ1aWxkRXNidWlsZEJyb3dzZXIpO1xuXG5mdW5jdGlvbiBsb2dCdWlsZFN0YXRzKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgbWV0YWZpbGU6IE1ldGFmaWxlLFxuICBpbml0aWFsRmlsZXM6IEZpbGVJbmZvW10sXG4gIGVzdGltYXRlZFRyYW5zZmVyU2l6ZXM/OiBNYXA8c3RyaW5nLCBudW1iZXI+LFxuKSB7XG4gIGNvbnN0IGluaXRpYWwgPSBuZXcgTWFwKGluaXRpYWxGaWxlcy5tYXAoKGluZm8pID0+IFtpbmZvLmZpbGUsIGluZm8ubmFtZV0pKTtcbiAgY29uc3Qgc3RhdHM6IEJ1bmRsZVN0YXRzW10gPSBbXTtcbiAgZm9yIChjb25zdCBbZmlsZSwgb3V0cHV0XSBvZiBPYmplY3QuZW50cmllcyhtZXRhZmlsZS5vdXRwdXRzKSkge1xuICAgIC8vIE9ubHkgZGlzcGxheSBKYXZhU2NyaXB0IGFuZCBDU1MgZmlsZXNcbiAgICBpZiAoIWZpbGUuZW5kc1dpdGgoJy5qcycpICYmICFmaWxlLmVuZHNXaXRoKCcuY3NzJykpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICAvLyBTa2lwIGludGVybmFsIGNvbXBvbmVudCByZXNvdXJjZXNcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGlmICgob3V0cHV0IGFzIGFueSlbJ25nLWNvbXBvbmVudCddKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBzdGF0cy5wdXNoKHtcbiAgICAgIGluaXRpYWw6IGluaXRpYWwuaGFzKGZpbGUpLFxuICAgICAgc3RhdHM6IFtcbiAgICAgICAgZmlsZSxcbiAgICAgICAgaW5pdGlhbC5nZXQoZmlsZSkgPz8gJy0nLFxuICAgICAgICBvdXRwdXQuYnl0ZXMsXG4gICAgICAgIGVzdGltYXRlZFRyYW5zZmVyU2l6ZXM/LmdldChmaWxlKSA/PyAnLScsXG4gICAgICBdLFxuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgdGFibGVUZXh0ID0gZ2VuZXJhdGVCdWlsZFN0YXRzVGFibGUoc3RhdHMsIHRydWUsIHRydWUsICEhZXN0aW1hdGVkVHJhbnNmZXJTaXplcywgdW5kZWZpbmVkKTtcblxuICBjb250ZXh0LmxvZ2dlci5pbmZvKCdcXG4nICsgdGFibGVUZXh0ICsgJ1xcbicpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBjYWxjdWxhdGVFc3RpbWF0ZWRUcmFuc2ZlclNpemVzKG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW10pIHtcbiAgY29uc3Qgc2l6ZXMgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuXG4gIGNvbnN0IHBlbmRpbmdDb21wcmVzc2lvbiA9IFtdO1xuICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2Ygb3V0cHV0RmlsZXMpIHtcbiAgICAvLyBPbmx5IGNhbGN1bGF0ZSBKYXZhU2NyaXB0IGFuZCBDU1MgZmlsZXNcbiAgICBpZiAoIW91dHB1dEZpbGUucGF0aC5lbmRzV2l0aCgnLmpzJykgJiYgIW91dHB1dEZpbGUucGF0aC5lbmRzV2l0aCgnLmNzcycpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBTa2lwIGNvbXByZXNzaW5nIHNtYWxsIGZpbGVzIHdoaWNoIG1heSBlbmQgYmVpbmcgbGFyZ2VyIG9uY2UgY29tcHJlc3NlZCBhbmQgd2lsbCBtb3N0IGxpa2VseSBub3QgYmVcbiAgICAvLyBjb21wcmVzc2VkIGluIGFjdHVhbCB0cmFuc2l0LlxuICAgIGlmIChvdXRwdXRGaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGggPCAxMDI0KSB7XG4gICAgICBzaXplcy5zZXQob3V0cHV0RmlsZS5wYXRoLCBvdXRwdXRGaWxlLmNvbnRlbnRzLmJ5dGVMZW5ndGgpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgcGVuZGluZ0NvbXByZXNzaW9uLnB1c2goXG4gICAgICBjb21wcmVzc0FzeW5jKG91dHB1dEZpbGUuY29udGVudHMpLnRoZW4oKHJlc3VsdCkgPT5cbiAgICAgICAgc2l6ZXMuc2V0KG91dHB1dEZpbGUucGF0aCwgcmVzdWx0LmJ5dGVMZW5ndGgpLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgYXdhaXQgUHJvbWlzZS5hbGwocGVuZGluZ0NvbXByZXNzaW9uKTtcblxuICByZXR1cm4gc2l6ZXM7XG59XG4iXX0=