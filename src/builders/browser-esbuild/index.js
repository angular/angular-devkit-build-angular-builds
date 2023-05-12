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
    logBuildStats(context, metafile, initialFiles);
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
exports.buildEsbuildBrowserInternal = buildEsbuildBrowserInternal;
exports.default = (0, architect_1.createBuilder)(buildEsbuildBrowser);
function logBuildStats(context, metafile, initialFiles) {
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
            stats: [file, initial.get(file) ?? '-', output.bytes, ''],
        });
    }
    const tableText = (0, stats_1.generateBuildStatsTable)(stats, true, true, false, undefined);
    context.logger.info('\n' + tableText + '\n');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFFekYscUNBQW1EO0FBQ25ELGdFQUFrQztBQUNsQywwREFBNkI7QUFDN0IseURBQXFEO0FBQ3JELDZDQUFrRDtBQUNsRCxpRUFBa0Y7QUFFbEYsc0ZBQWlGO0FBQ2pGLCtEQUFnRjtBQUNoRixpREFBOEM7QUFDOUMsdUVBQXNFO0FBQ3RFLHFEQUFpRjtBQUNqRiwrREFBa0Y7QUFDbEYsdUVBQXFFO0FBQ3JFLHlEQUEwRDtBQUMxRCx1Q0FBd0Q7QUFDeEQscURBQW9FO0FBQ3BFLG1EQUFrRTtBQUNsRSwyREFBc0Q7QUFDdEQsdUNBQThGO0FBRTlGLCtFQUFnRjtBQUNoRiwyREFBbUU7QUFTbkU7O0dBRUc7QUFDSCxNQUFNLGVBQWU7SUFJbkIsWUFDVSxlQUFpQyxFQUNqQyxlQUFpQztRQURqQyxvQkFBZSxHQUFmLGVBQWUsQ0FBa0I7UUFDakMsb0JBQWUsR0FBZixlQUFlLENBQWtCO1FBTGxDLGdCQUFXLEdBQWlCLEVBQUUsQ0FBQztRQUMvQixlQUFVLEdBQThDLEVBQUUsQ0FBQztJQUtqRSxDQUFDO0lBRUosYUFBYSxDQUFDLElBQVksRUFBRSxPQUFlO1FBQ3pDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFFRCxJQUFJLE1BQU07UUFDUixPQUFPO1lBQ0wsT0FBTyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUM7U0FDckMsQ0FBQztJ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b3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zLCBNZXRhZmlsZSwgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgY29uc3RhbnRzIGFzIGZzQ29uc3RhbnRzIH0gZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgY29weUFzc2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvcHktYXNzZXRzJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2VzYnVpbGQtdGFyZ2V0cyc7XG5pbXBvcnQgeyBGaWxlSW5mbyB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvYXVnbWVudC1pbmRleC1odG1sJztcbmltcG9ydCB7IEluZGV4SHRtbEdlbmVyYXRvciB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyRXNidWlsZCB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IFNwaW5uZXIgfSBmcm9tICcuLi8uLi91dGlscy9zcGlubmVyJztcbmltcG9ydCB7IGdldFN1cHBvcnRlZEJyb3dzZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3VwcG9ydGVkLWJyb3dzZXJzJztcbmltcG9ydCB7IEJ1bmRsZVN0YXRzLCBnZW5lcmF0ZUJ1aWxkU3RhdHNUYWJsZSB9IGZyb20gJy4uLy4uL3dlYnBhY2svdXRpbHMvc3RhdHMnO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlLCBjcmVhdGVDb21waWxlclBsdWdpbiB9IGZyb20gJy4vYW5ndWxhci9jb21waWxlci1wbHVnaW4nO1xuaW1wb3J0IHsgbG9nQnVpbGRlclN0YXR1c1dhcm5pbmdzIH0gZnJvbSAnLi9idWlsZGVyLXN0YXR1cy13YXJuaW5ncyc7XG5pbXBvcnQgeyBjaGVja0NvbW1vbkpTTW9kdWxlcyB9IGZyb20gJy4vY29tbW9uanMtY2hlY2tlcic7XG5pbXBvcnQgeyBCdW5kbGVyQ29udGV4dCwgbG9nTWVzc2FnZXMgfSBmcm9tICcuL2VzYnVpbGQnO1xuaW1wb3J0IHsgY3JlYXRlR2xvYmFsU2NyaXB0c0J1bmRsZU9wdGlvbnMgfSBmcm9tICcuL2dsb2JhbC1zY3JpcHRzJztcbmltcG9ydCB7IGNyZWF0ZUdsb2JhbFN0eWxlc0J1bmRsZU9wdGlvbnMgfSBmcm9tICcuL2dsb2JhbC1zdHlsZXMnO1xuaW1wb3J0IHsgZXh0cmFjdExpY2Vuc2VzIH0gZnJvbSAnLi9saWNlbnNlLWV4dHJhY3Rvcic7XG5pbXBvcnQgeyBCcm93c2VyRXNidWlsZE9wdGlvbnMsIE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucywgbm9ybWFsaXplT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuaW1wb3J0IHsgY3JlYXRlU291cmNlbWFwSW5nb3JlbGlzdFBsdWdpbiB9IGZyb20gJy4vc291cmNlbWFwLWlnbm9yZWxpc3QtcGx1Z2luJztcbmltcG9ydCB7IHNodXRkb3duU2Fzc1dvcmtlclBvb2wgfSBmcm9tICcuL3N0eWxlc2hlZXRzL3Nhc3MtcGx1Z2luJztcbmltcG9ydCB0eXBlIHsgQ2hhbmdlZEZpbGVzIH0gZnJvbSAnLi93YXRjaGVyJztcblxuaW50ZXJmYWNlIFJlYnVpbGRTdGF0ZSB7XG4gIHJlYnVpbGRDb250ZXh0czogQnVuZGxlckNvbnRleHRbXTtcbiAgY29kZUJ1bmRsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlO1xuICBmaWxlQ2hhbmdlczogQ2hhbmdlZEZpbGVzO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgdGhlIHJlc3VsdCBvZiBhIHNpbmdsZSBidWlsZGVyIGV4ZWN1dGUgY2FsbC5cbiAqL1xuY2xhc3MgRXhlY3V0aW9uUmVzdWx0IHtcbiAgcmVhZG9ubHkgb3V0cHV0RmlsZXM6IE91dHB1dEZpbGVbXSA9IFtdO1xuICByZWFkb25seSBhc3NldEZpbGVzOiB7IHNvdXJjZTogc3RyaW5nOyBkZXN0aW5hdGlvbjogc3RyaW5nIH1bXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVidWlsZENvbnRleHRzOiBCdW5kbGVyQ29udGV4dFtdLFxuICAgIHByaXZhdGUgY29kZUJ1bmRsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlLFxuICApIHt9XG5cbiAgYWRkT3V0cHV0RmlsZShwYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMub3V0cHV0RmlsZXMucHVzaChjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQocGF0aCwgY29udGVudCkpO1xuICB9XG5cbiAgZ2V0IG91dHB1dCgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdGhpcy5vdXRwdXRGaWxlcy5sZW5ndGggPiAwLFxuICAgIH07XG4gIH1cblxuICBnZXQgb3V0cHV0V2l0aEZpbGVzKCkge1xuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0aGlzLm91dHB1dEZpbGVzLmxlbmd0aCA+IDAsXG4gICAgICBvdXRwdXRGaWxlczogdGhpcy5vdXRwdXRGaWxlcyxcbiAgICAgIGFzc2V0RmlsZXM6IHRoaXMuYXNzZXRGaWxlcyxcbiAgICB9O1xuICB9XG5cbiAgY3JlYXRlUmVidWlsZFN0YXRlKGZpbGVDaGFuZ2VzOiBDaGFuZ2VkRmlsZXMpOiBSZWJ1aWxkU3RhdGUge1xuICAgIHRoaXMuY29kZUJ1bmRsZUNhY2hlPy5pbnZhbGlkYXRlKFsuLi5maWxlQ2hhbmdlcy5tb2RpZmllZCwgLi4uZmlsZUNoYW5nZXMucmVtb3ZlZF0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHJlYnVpbGRDb250ZXh0czogdGhpcy5yZWJ1aWxkQ29udGV4dHMsXG4gICAgICBjb2RlQnVuZGxlQ2FjaGU6IHRoaXMuY29kZUJ1bmRsZUNhY2hlLFxuICAgICAgZmlsZUNoYW5nZXMsXG4gICAgfTtcbiAgfVxuXG4gIGFzeW5jIGRpc3Bvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHRoaXMucmVidWlsZENvbnRleHRzLm1hcCgoY29udGV4dCkgPT4gY29udGV4dC5kaXNwb3NlKCkpKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBleGVjdXRlKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICByZWJ1aWxkU3RhdGU/OiBSZWJ1aWxkU3RhdGUsXG4pOiBQcm9taXNlPEV4ZWN1dGlvblJlc3VsdD4ge1xuICBjb25zdCBzdGFydFRpbWUgPSBwcm9jZXNzLmhydGltZS5iaWdpbnQoKTtcblxuICBjb25zdCB7XG4gICAgcHJvamVjdFJvb3QsXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIGFzc2V0cyxcbiAgICBzZXJ2aWNlV29ya2VyT3B0aW9ucyxcbiAgICBpbmRleEh0bWxPcHRpb25zLFxuICAgIGNhY2hlT3B0aW9ucyxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgYnJvd3NlcnMgPSBnZXRTdXBwb3J0ZWRCcm93c2Vycyhwcm9qZWN0Um9vdCwgY29udGV4dC5sb2dnZXIpO1xuICBjb25zdCB0YXJnZXQgPSB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyhicm93c2Vycyk7XG5cbiAgLy8gUmV1c2UgcmVidWlsZCBzdGF0ZSBvciBjcmVhdGUgbmV3IGJ1bmRsZSBjb250ZXh0cyBmb3IgY29kZSBhbmQgZ2xvYmFsIHN0eWxlc2hlZXRzXG4gIGxldCBidW5kbGVyQ29udGV4dHMgPSByZWJ1aWxkU3RhdGU/LnJlYnVpbGRDb250ZXh0cztcbiAgY29uc3QgY29kZUJ1bmRsZUNhY2hlID1cbiAgICByZWJ1aWxkU3RhdGU/LmNvZGVCdW5kbGVDYWNoZSA/P1xuICAgIG5ldyBTb3VyY2VGaWxlQ2FjaGUoY2FjaGVPcHRpb25zLmVuYWJsZWQgPyBjYWNoZU9wdGlvbnMucGF0aCA6IHVuZGVmaW5lZCk7XG4gIGlmIChidW5kbGVyQ29udGV4dHMgPT09IHVuZGVmaW5lZCkge1xuICAgIGJ1bmRsZXJDb250ZXh0cyA9IFtdO1xuXG4gICAgLy8gQXBwbGljYXRpb24gY29kZVxuICAgIGJ1bmRsZXJDb250ZXh0cy5wdXNoKFxuICAgICAgbmV3IEJ1bmRsZXJDb250ZXh0KFxuICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICAhIW9wdGlvbnMud2F0Y2gsXG4gICAgICAgIGNyZWF0ZUNvZGVCdW5kbGVPcHRpb25zKG9wdGlvbnMsIHRhcmdldCwgYnJvd3NlcnMsIGNvZGVCdW5kbGVDYWNoZSksXG4gICAgICApLFxuICAgICk7XG5cbiAgICAvLyBHbG9iYWwgU3R5bGVzaGVldHNcbiAgICBpZiAob3B0aW9ucy5nbG9iYWxTdHlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgZm9yIChjb25zdCBpbml0aWFsIG9mIFt0cnVlLCBmYWxzZV0pIHtcbiAgICAgICAgY29uc3QgYnVuZGxlT3B0aW9ucyA9IGNyZWF0ZUdsb2JhbFN0eWxlc0J1bmRsZU9wdGlvbnMoXG4gICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgYnJvd3NlcnMsXG4gICAgICAgICAgaW5pdGlhbCxcbiAgICAgICAgICBjb2RlQnVuZGxlQ2FjaGU/LmxvYWRSZXN1bHRDYWNoZSxcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKGJ1bmRsZU9wdGlvbnMpIHtcbiAgICAgICAgICBidW5kbGVyQ29udGV4dHMucHVzaChuZXcgQnVuZGxlckNvbnRleHQod29ya3NwYWNlUm9vdCwgISFvcHRpb25zLndhdGNoLCBidW5kbGVPcHRpb25zKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBHbG9iYWwgU2NyaXB0c1xuICAgIGlmIChvcHRpb25zLmdsb2JhbFNjcmlwdHMubGVuZ3RoID4gMCkge1xuICAgICAgZm9yIChjb25zdCBpbml0aWFsIG9mIFt0cnVlLCBmYWxzZV0pIHtcbiAgICAgICAgY29uc3QgYnVuZGxlT3B0aW9ucyA9IGNyZWF0ZUdsb2JhbFNjcmlwdHNCdW5kbGVPcHRpb25zKG9wdGlvbnMsIGluaXRpYWwpO1xuICAgICAgICBpZiAoYnVuZGxlT3B0aW9ucykge1xuICAgICAgICAgIGJ1bmRsZXJDb250ZXh0cy5wdXNoKG5ldyBCdW5kbGVyQ29udGV4dCh3b3Jrc3BhY2VSb290LCAhIW9wdGlvbnMud2F0Y2gsIGJ1bmRsZU9wdGlvbnMpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGJ1bmRsaW5nUmVzdWx0ID0gYXdhaXQgQnVuZGxlckNvbnRleHQuYnVuZGxlQWxsKGJ1bmRsZXJDb250ZXh0cyk7XG5cbiAgLy8gTG9nIGFsbCB3YXJuaW5ncyBhbmQgZXJyb3JzIGdlbmVyYXRlZCBkdXJpbmcgYnVuZGxpbmdcbiAgYXdhaXQgbG9nTWVzc2FnZXMoY29udGV4dCwgYnVuZGxpbmdSZXN1bHQpO1xuXG4gIGNvbnN0IGV4ZWN1dGlvblJlc3VsdCA9IG5ldyBFeGVjdXRpb25SZXN1bHQoYnVuZGxlckNvbnRleHRzLCBjb2RlQnVuZGxlQ2FjaGUpO1xuXG4gIC8vIFJldHVybiBpZiB0aGUgYnVuZGxpbmcgaGFzIGVycm9yc1xuICBpZiAoYnVuZGxpbmdSZXN1bHQuZXJyb3JzKSB7XG4gICAgcmV0dXJuIGV4ZWN1dGlvblJlc3VsdDtcbiAgfVxuXG4gIC8vIEZpbHRlciBnbG9iYWwgc3R5bGVzaGVldCBpbml0aWFsIGZpbGVzLiBDdXJyZW50bHkgYWxsIGluaXRpYWwgQ1NTIGZpbGVzIGFyZSBmcm9tIHRoZSBnbG9iYWwgc3R5bGVzIG9wdGlvbi5cbiAgaWYgKG9wdGlvbnMuZ2xvYmFsU3R5bGVzLmxlbmd0aCA+IDApIHtcbiAgICBidW5kbGluZ1Jlc3VsdC5pbml0aWFsRmlsZXMgPSBidW5kbGluZ1Jlc3VsdC5pbml0aWFsRmlsZXMuZmlsdGVyKFxuICAgICAgKHsgZmlsZSwgbmFtZSB9KSA9PlxuICAgICAgICAhZmlsZS5lbmRzV2l0aCgnLmNzcycpIHx8XG4gICAgICAgIG9wdGlvbnMuZ2xvYmFsU3R5bGVzLmZpbmQoKHN0eWxlKSA9PiBzdHlsZS5uYW1lID09PSBuYW1lKT8uaW5pdGlhbCxcbiAgICApO1xuICB9XG5cbiAgY29uc3QgeyBtZXRhZmlsZSwgaW5pdGlhbEZpbGVzLCBvdXRwdXRGaWxlcyB9ID0gYnVuZGxpbmdSZXN1bHQ7XG5cbiAgZXhlY3V0aW9uUmVzdWx0Lm91dHB1dEZpbGVzLnB1c2goLi4ub3V0cHV0RmlsZXMpO1xuXG4gIC8vIENoZWNrIG1ldGFmaWxlIGZvciBDb21tb25KUyBtb2R1bGUgdXNhZ2UgaWYgb3B0aW1pemluZyBzY3JpcHRzXG4gIGlmIChvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMpIHtcbiAgICBjb25zdCBtZXNzYWdlcyA9IGNoZWNrQ29tbW9uSlNNb2R1bGVzKG1ldGFmaWxlLCBvcHRpb25zLmFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyk7XG4gICAgYXdhaXQgbG9nTWVzc2FnZXMoY29udGV4dCwgeyB3YXJuaW5nczogbWVzc2FnZXMgfSk7XG4gIH1cblxuICAvLyBHZW5lcmF0ZSBpbmRleCBIVE1MIGZpbGVcbiAgaWYgKGluZGV4SHRtbE9wdGlvbnMpIHtcbiAgICAvLyBDcmVhdGUgYW4gaW5kZXggSFRNTCBnZW5lcmF0b3IgdGhhdCByZWFkcyBmcm9tIHRoZSBpbi1tZW1vcnkgb3V0cHV0IGZpbGVzXG4gICAgY29uc3QgaW5kZXhIdG1sR2VuZXJhdG9yID0gbmV3IEluZGV4SHRtbEdlbmVyYXRvcih7XG4gICAgICBpbmRleFBhdGg6IGluZGV4SHRtbE9wdGlvbnMuaW5wdXQsXG4gICAgICBlbnRyeXBvaW50czogaW5kZXhIdG1sT3B0aW9ucy5pbnNlcnRpb25PcmRlcixcbiAgICAgIHNyaTogb3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSxcbiAgICAgIG9wdGltaXphdGlvbjogb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICAgIGNyb3NzT3JpZ2luOiBvcHRpb25zLmNyb3NzT3JpZ2luLFxuICAgIH0pO1xuXG4gICAgLyoqIFZpcnR1YWwgb3V0cHV0IHBhdGggdG8gc3VwcG9ydCByZWFkaW5nIGluLW1lbW9yeSBmaWxlcy4gKi9cbiAgICBjb25zdCB2aXJ0dWFsT3V0cHV0UGF0aCA9ICcvJztcbiAgICBpbmRleEh0bWxHZW5lcmF0b3IucmVhZEFzc2V0ID0gYXN5bmMgZnVuY3Rpb24gKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgLy8gUmVtb3ZlIGxlYWRpbmcgZGlyZWN0b3J5IHNlcGFyYXRvclxuICAgICAgY29uc3QgcmVsYXRpdmVmaWxlUGF0aCA9IHBhdGgucmVsYXRpdmUodmlydHVhbE91dHB1dFBhdGgsIGZpbGVQYXRoKTtcbiAgICAgIGNvbnN0IGZpbGUgPSBleGVjdXRpb25SZXN1bHQub3V0cHV0RmlsZXMuZmluZCgoZmlsZSkgPT4gZmlsZS5wYXRoID09PSByZWxhdGl2ZWZpbGVQYXRoKTtcbiAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgIHJldHVybiBmaWxlLnRleHQ7XG4gICAgICB9XG5cbiAgICAgIHRocm93IG5ldyBFcnJvcihgT3V0cHV0IGZpbGUgZG9lcyBub3QgZXhpc3Q6ICR7cGF0aH1gKTtcbiAgICB9O1xuXG4gICAgY29uc3QgeyBjb250ZW50LCB3YXJuaW5ncywgZXJyb3JzIH0gPSBhd2FpdCBpbmRleEh0bWxHZW5lcmF0b3IucHJvY2Vzcyh7XG4gICAgICBiYXNlSHJlZjogb3B0aW9ucy5iYXNlSHJlZixcbiAgICAgIGxhbmc6IHVuZGVmaW5lZCxcbiAgICAgIG91dHB1dFBhdGg6IHZpcnR1YWxPdXRwdXRQYXRoLFxuICAgICAgZmlsZXM6IGluaXRpYWxGaWxlcyxcbiAgICB9KTtcblxuICAgIGZvciAoY29uc3QgZXJyb3Igb2YgZXJyb3JzKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihlcnJvcik7XG4gICAgfVxuICAgIGZvciAoY29uc3Qgd2FybmluZyBvZiB3YXJuaW5ncykge1xuICAgICAgY29udGV4dC5sb2dnZXIud2Fybih3YXJuaW5nKTtcbiAgICB9XG5cbiAgICBleGVjdXRpb25SZXN1bHQuYWRkT3V0cHV0RmlsZShpbmRleEh0bWxPcHRpb25zLm91dHB1dCwgY29udGVudCk7XG4gIH1cblxuICAvLyBDb3B5IGFzc2V0c1xuICBpZiAoYXNzZXRzKSB7XG4gICAgLy8gVGhlIHdlYnBhY2sgY29weSBhc3NldHMgaGVscGVyIGlzIHVzZWQgd2l0aCBubyBiYXNlIHBhdGhzIGRlZmluZWQuIFRoaXMgcHJldmVudHMgdGhlIGhlbHBlclxuICAgIC8vIGZyb20gZGlyZWN0bHkgd3JpdGluZyB0byBkaXNrLiBUaGlzIHNob3VsZCBldmVudHVhbGx5IGJlIHJlcGxhY2VkIHdpdGggYSBtb3JlIG9wdGltaXplZCBoZWxwZXIuXG4gICAgZXhlY3V0aW9uUmVzdWx0LmFzc2V0RmlsZXMucHVzaCguLi4oYXdhaXQgY29weUFzc2V0cyhhc3NldHMsIFtdLCB3b3Jrc3BhY2VSb290KSkpO1xuICB9XG5cbiAgLy8gV3JpdGUgbWV0YWZpbGUgaWYgc3RhdHMgb3B0aW9uIGlzIGVuYWJsZWRcbiAgaWYgKG9wdGlvbnMuc3RhdHMpIHtcbiAgICBleGVjdXRpb25SZXN1bHQuYWRkT3V0cHV0RmlsZSgnc3RhdHMuanNvbicsIEpTT04uc3RyaW5naWZ5KG1ldGFmaWxlLCBudWxsLCAyKSk7XG4gIH1cblxuICAvLyBFeHRyYWN0IGFuZCB3cml0ZSBsaWNlbnNlcyBmb3IgdXNlZCBwYWNrYWdlc1xuICBpZiAob3B0aW9ucy5leHRyYWN0TGljZW5zZXMpIHtcbiAgICBleGVjdXRpb25SZXN1bHQuYWRkT3V0cHV0RmlsZShcbiAgICAgICczcmRwYXJ0eWxpY2Vuc2VzLnR4dCcsXG4gICAgICBhd2FpdCBleHRyYWN0TGljZW5zZXMobWV0YWZpbGUsIHdvcmtzcGFjZVJvb3QpLFxuICAgICk7XG4gIH1cblxuICAvLyBBdWdtZW50IHRoZSBhcHBsaWNhdGlvbiB3aXRoIHNlcnZpY2Ugd29ya2VyIHN1cHBvcnRcbiAgaWYgKHNlcnZpY2VXb3JrZXJPcHRpb25zKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNlcnZpY2VXb3JrZXJSZXN1bHQgPSBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXJFc2J1aWxkKFxuICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICBzZXJ2aWNlV29ya2VyT3B0aW9ucyxcbiAgICAgICAgb3B0aW9ucy5iYXNlSHJlZiB8fCAnLycsXG4gICAgICAgIGV4ZWN1dGlvblJlc3VsdC5vdXRwdXRGaWxlcyxcbiAgICAgICAgZXhlY3V0aW9uUmVzdWx0LmFzc2V0RmlsZXMsXG4gICAgICApO1xuICAgICAgZXhlY3V0aW9uUmVzdWx0LmFkZE91dHB1dEZpbGUoJ25nc3cuanNvbicsIHNlcnZpY2VXb3JrZXJSZXN1bHQubWFuaWZlc3QpO1xuICAgICAgZXhlY3V0aW9uUmVzdWx0LmFzc2V0RmlsZXMucHVzaCguLi5zZXJ2aWNlV29ya2VyUmVzdWx0LmFzc2V0RmlsZXMpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGAke2Vycm9yfWApO1xuXG4gICAgICByZXR1cm4gZXhlY3V0aW9uUmVzdWx0O1xuICAgIH1cbiAgfVxuXG4gIGxvZ0J1aWxkU3RhdHMoY29udGV4dCwgbWV0YWZpbGUsIGluaXRpYWxGaWxlcyk7XG5cbiAgY29uc3QgYnVpbGRUaW1lID0gTnVtYmVyKHByb2Nlc3MuaHJ0aW1lLmJpZ2ludCgpIC0gc3RhcnRUaW1lKSAvIDEwICoqIDk7XG4gIGNvbnRleHQubG9nZ2VyLmluZm8oYEFwcGxpY2F0aW9uIGJ1bmRsZSBnZW5lcmF0aW9uIGNvbXBsZXRlLiBbJHtidWlsZFRpbWUudG9GaXhlZCgzKX0gc2Vjb25kc11gKTtcblxuICByZXR1cm4gZXhlY3V0aW9uUmVzdWx0O1xufVxuXG5hc3luYyBmdW5jdGlvbiB3cml0ZVJlc3VsdEZpbGVzKFxuICBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdLFxuICBhc3NldEZpbGVzOiB7IHNvdXJjZTogc3RyaW5nOyBkZXN0aW5hdGlvbjogc3RyaW5nIH1bXSB8IHVuZGVmaW5lZCxcbiAgb3V0cHV0UGF0aDogc3RyaW5nLFxuKSB7XG4gIGNvbnN0IGRpcmVjdG9yeUV4aXN0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICBvdXRwdXRGaWxlcy5tYXAoYXN5bmMgKGZpbGUpID0+IHtcbiAgICAgIC8vIEVuc3VyZSBvdXRwdXQgc3ViZGlyZWN0b3JpZXMgZXhpc3RcbiAgICAgIGNvbnN0IGJhc2VQYXRoID0gcGF0aC5kaXJuYW1lKGZpbGUucGF0aCk7XG4gICAgICBpZiAoYmFzZVBhdGggJiYgIWRpcmVjdG9yeUV4aXN0cy5oYXMoYmFzZVBhdGgpKSB7XG4gICAgICAgIGF3YWl0IGZzLm1rZGlyKHBhdGguam9pbihvdXRwdXRQYXRoLCBiYXNlUGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICBkaXJlY3RvcnlFeGlzdHMuYWRkKGJhc2VQYXRoKTtcbiAgICAgIH1cbiAgICAgIC8vIFdyaXRlIGZpbGUgY29udGVudHNcbiAgICAgIGF3YWl0IGZzLndyaXRlRmlsZShwYXRoLmpvaW4ob3V0cHV0UGF0aCwgZmlsZS5wYXRoKSwgZmlsZS5jb250ZW50cyk7XG4gICAgfSksXG4gICk7XG5cbiAgaWYgKGFzc2V0RmlsZXM/Lmxlbmd0aCkge1xuICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgYXNzZXRGaWxlcy5tYXAoYXN5bmMgKHsgc291cmNlLCBkZXN0aW5hdGlvbiB9KSA9PiB7XG4gICAgICAgIC8vIEVuc3VyZSBvdXRwdXQgc3ViZGlyZWN0b3JpZXMgZXhpc3RcbiAgICAgICAgY29uc3QgYmFzZVBhdGggPSBwYXRoLmRpcm5hbWUoZGVzdGluYXRpb24pO1xuICAgICAgICBpZiAoYmFzZVBhdGggJiYgIWRpcmVjdG9yeUV4aXN0cy5oYXMoYmFzZVBhdGgpKSB7XG4gICAgICAgICAgYXdhaXQgZnMubWtkaXIocGF0aC5qb2luKG91dHB1dFBhdGgsIGJhc2VQYXRoKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgZGlyZWN0b3J5RXhpc3RzLmFkZChiYXNlUGF0aCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ29weSBmaWxlIGNvbnRlbnRzXG4gICAgICAgIGF3YWl0IGZzLmNvcHlGaWxlKHNvdXJjZSwgcGF0aC5qb2luKG91dHB1dFBhdGgsIGRlc3RpbmF0aW9uKSwgZnNDb25zdGFudHMuQ09QWUZJTEVfRklDTE9ORSk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChwYXRoOiBzdHJpbmcsIHRleHQ6IHN0cmluZyk6IE91dHB1dEZpbGUge1xuICByZXR1cm4ge1xuICAgIHBhdGgsXG4gICAgdGV4dCxcbiAgICBnZXQgY29udGVudHMoKSB7XG4gICAgICByZXR1cm4gQnVmZmVyLmZyb20odGhpcy50ZXh0LCAndXRmLTgnKTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDb2RlQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBicm93c2Vyczogc3RyaW5nW10sXG4gIHNvdXJjZUZpbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZSxcbik6IEJ1aWxkT3B0aW9ucyB7XG4gIGNvbnN0IHtcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB0c2NvbmZpZyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBvdXRFeHRlbnNpb24sXG4gICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucyxcbiAgICBhZHZhbmNlZE9wdGltaXphdGlvbnMsXG4gICAgaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICBqaXQsXG4gICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICB9ID0gb3B0aW9ucztcblxuICBjb25zdCBidWlsZE9wdGlvbnM6IEJ1aWxkT3B0aW9ucyA9IHtcbiAgICBhYnNXb3JraW5nRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICBmb3JtYXQ6ICdlc20nLFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIGVudHJ5TmFtZXM6IG91dHB1dE5hbWVzLmJ1bmRsZXMsXG4gICAgYXNzZXROYW1lczogb3V0cHV0TmFtZXMubWVkaWEsXG4gICAgdGFyZ2V0LFxuICAgIHN1cHBvcnRlZDogZ2V0RmVhdHVyZVN1cHBvcnQodGFyZ2V0KSxcbiAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgY29uZGl0aW9uczogWydlczIwMjAnLCAnZXMyMDE1JywgJ21vZHVsZSddLFxuICAgIHJlc29sdmVFeHRlbnNpb25zOiBbJy50cycsICcudHN4JywgJy5tanMnLCAnLmpzJ10sXG4gICAgbWV0YWZpbGU6IHRydWUsXG4gICAgbGVnYWxDb21tZW50czogb3B0aW9ucy5leHRyYWN0TGljZW5zZXMgPyAnbm9uZScgOiAnZW9mJyxcbiAgICBsb2dMZXZlbDogb3B0aW9ucy52ZXJib3NlID8gJ2RlYnVnJyA6ICdzaWxlbnQnLFxuICAgIG1pbmlmeTogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzLFxuICAgIHB1cmU6IFsnZm9yd2FyZFJlZiddLFxuICAgIG91dGRpcjogd29ya3NwYWNlUm9vdCxcbiAgICBvdXRFeHRlbnNpb246IG91dEV4dGVuc2lvbiA/IHsgJy5qcyc6IGAuJHtvdXRFeHRlbnNpb259YCB9IDogdW5kZWZpbmVkLFxuICAgIHNvdXJjZW1hcDogc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICBzcGxpdHRpbmc6IHRydWUsXG4gICAgdHNjb25maWcsXG4gICAgZXh0ZXJuYWw6IGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlU291cmNlbWFwSW5nb3JlbGlzdFBsdWdpbigpLFxuICAgICAgY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gICAgICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICAgICAge1xuICAgICAgICAgIHNvdXJjZW1hcDogISFzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMsXG4gICAgICAgICAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM6IHNvdXJjZW1hcE9wdGlvbnMudmVuZG9yLFxuICAgICAgICAgIHRzY29uZmlnLFxuICAgICAgICAgIGppdCxcbiAgICAgICAgICBhZHZhbmNlZE9wdGltaXphdGlvbnMsXG4gICAgICAgICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICAgICAgICBzb3VyY2VGaWxlQ2FjaGUsXG4gICAgICAgICAgbG9hZFJlc3VsdENhY2hlOiBzb3VyY2VGaWxlQ2FjaGU/LmxvYWRSZXN1bHRDYWNoZSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gQ29tcG9uZW50IHN0eWxlc2hlZXQgb3B0aW9uc1xuICAgICAgICB7XG4gICAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICBvcHRpbWl6YXRpb246ICEhb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMubWluaWZ5LFxuICAgICAgICAgIHNvdXJjZW1hcDpcbiAgICAgICAgICAgIC8vIEhpZGRlbiBjb21wb25lbnQgc3R5bGVzaGVldCBzb3VyY2VtYXBzIGFyZSBpbmFjY2Vzc2libGUgd2hpY2ggaXMgZWZmZWN0aXZlbHlcbiAgICAgICAgICAgIC8vIHRoZSBzYW1lIGFzIGJlaW5nIGRpc2FibGVkLiBEaXNhYmxpbmcgaGFzIHRoZSBhZHZhbnRhZ2Ugb2YgYXZvaWRpbmcgdGhlIG92ZXJoZWFkXG4gICAgICAgICAgICAvLyBvZiBzb3VyY2VtYXAgcHJvY2Vzc2luZy5cbiAgICAgICAgICAgICEhc291cmNlbWFwT3B0aW9ucy5zdHlsZXMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gZmFsc2UgOiAnaW5saW5lJyksXG4gICAgICAgICAgb3V0cHV0TmFtZXMsXG4gICAgICAgICAgaW5jbHVkZVBhdGhzOiBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocyxcbiAgICAgICAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICAgICAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgICAgIGJyb3dzZXJzLFxuICAgICAgICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbixcbiAgICAgICAgfSxcbiAgICAgICksXG4gICAgXSxcbiAgICBkZWZpbmU6IHtcbiAgICAgIC8vIE9ubHkgc2V0IHRvIGZhbHNlIHdoZW4gc2NyaXB0IG9wdGltaXphdGlvbnMgYXJlIGVuYWJsZWQuIEl0IHNob3VsZCBub3QgYmUgc2V0IHRvIHRydWUgYmVjYXVzZVxuICAgICAgLy8gQW5ndWxhciB0dXJucyBgbmdEZXZNb2RlYCBpbnRvIGFuIG9iamVjdCBmb3IgZGV2ZWxvcG1lbnQgZGVidWdnaW5nIHB1cnBvc2VzIHdoZW4gbm90IGRlZmluZWRcbiAgICAgIC8vIHdoaWNoIGEgY29uc3RhbnQgdHJ1ZSB2YWx1ZSB3b3VsZCBicmVhay5cbiAgICAgIC4uLihvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgPyB7ICduZ0Rldk1vZGUnOiAnZmFsc2UnIH0gOiB1bmRlZmluZWQpLFxuICAgICAgJ25nSml0TW9kZSc6IGppdCA/ICd0cnVlJyA6ICdmYWxzZScsXG4gICAgfSxcbiAgfTtcblxuICBjb25zdCBwb2x5ZmlsbHMgPSBvcHRpb25zLnBvbHlmaWxscyA/IFsuLi5vcHRpb25zLnBvbHlmaWxsc10gOiBbXTtcbiAgaWYgKGppdCkge1xuICAgIHBvbHlmaWxscy5wdXNoKCdAYW5ndWxhci9jb21waWxlcicpO1xuICB9XG5cbiAgaWYgKHBvbHlmaWxscz8ubGVuZ3RoKSB7XG4gICAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6cG9seWZpbGxzJztcbiAgICBidWlsZE9wdGlvbnMuZW50cnlQb2ludHMgPSB7XG4gICAgICAuLi5idWlsZE9wdGlvbnMuZW50cnlQb2ludHMsXG4gICAgICBbJ3BvbHlmaWxscyddOiBuYW1lc3BhY2UsXG4gICAgfTtcblxuICAgIGJ1aWxkT3B0aW9ucy5wbHVnaW5zPy51bnNoaWZ0KHtcbiAgICAgIG5hbWU6ICdhbmd1bGFyLXBvbHlmaWxscycsXG4gICAgICBzZXR1cChidWlsZCkge1xuICAgICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IC9eYW5ndWxhcjpwb2x5ZmlsbHMkLyB9LCAoYXJncykgPT4ge1xuICAgICAgICAgIGlmIChhcmdzLmtpbmQgIT09ICdlbnRyeS1wb2ludCcpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwYXRoOiAnZW50cnknLFxuICAgICAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC8uLywgbmFtZXNwYWNlIH0sICgpID0+IHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29udGVudHM6IHBvbHlmaWxscy5tYXAoKGZpbGUpID0+IGBpbXBvcnQgJyR7ZmlsZS5yZXBsYWNlKC9cXFxcL2csICcvJyl9JztgKS5qb2luKCdcXG4nKSxcbiAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgYSBzeW50YXggZmVhdHVyZSBvYmplY3QgbWFwIGZvciBBbmd1bGFyIGFwcGxpY2F0aW9ucyBiYXNlZCBvbiBhIGxpc3Qgb2YgdGFyZ2V0cy5cbiAqIEEgZnVsbCBzZXQgb2YgZmVhdHVyZSBuYW1lcyBjYW4gYmUgZm91bmQgaGVyZTogaHR0cHM6Ly9lc2J1aWxkLmdpdGh1Yi5pby9hcGkvI3N1cHBvcnRlZFxuICogQHBhcmFtIHRhcmdldCBBbiBhcnJheSBvZiBicm93c2VyL2VuZ2luZSB0YXJnZXRzIGluIHRoZSBmb3JtYXQgYWNjZXB0ZWQgYnkgdGhlIGVzYnVpbGQgYHRhcmdldGAgb3B0aW9uLlxuICogQHJldHVybnMgQW4gb2JqZWN0IHRoYXQgY2FuIGJlIHVzZWQgd2l0aCB0aGUgZXNidWlsZCBidWlsZCBgc3VwcG9ydGVkYCBvcHRpb24uXG4gKi9cbmZ1bmN0aW9uIGdldEZlYXR1cmVTdXBwb3J0KHRhcmdldDogc3RyaW5nW10pOiBCdWlsZE9wdGlvbnNbJ3N1cHBvcnRlZCddIHtcbiAgY29uc3Qgc3VwcG9ydGVkOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPiA9IHtcbiAgICAvLyBOYXRpdmUgYXN5bmMvYXdhaXQgaXMgbm90IHN1cHBvcnRlZCB3aXRoIFpvbmUuanMuIERpc2FibGluZyBzdXBwb3J0IGhlcmUgd2lsbCBjYXVzZVxuICAgIC8vIGVzYnVpbGQgdG8gZG93bmxldmVsIGFzeW5jL2F3YWl0IGFuZCBmb3IgYXdhaXQuLi5vZiB0byBhIFpvbmUuanMgc3VwcG9ydGVkIGZvcm0uIEhvd2V2ZXIsIGVzYnVpbGRcbiAgICAvLyBkb2VzIG5vdCBjdXJyZW50bHkgc3VwcG9ydCBkb3dubGV2ZWxpbmcgYXN5bmMgZ2VuZXJhdG9ycy4gSW5zdGVhZCBiYWJlbCBpcyB1c2VkIHdpdGhpbiB0aGUgSlMvVFNcbiAgICAvLyBsb2FkZXIgdG8gcGVyZm9ybSB0aGUgZG93bmxldmVsIHRyYW5zZm9ybWF0aW9uLlxuICAgIC8vIE5PVEU6IElmIGVzYnVpbGQgYWRkcyBzdXBwb3J0IGluIHRoZSBmdXR1cmUsIHRoZSBiYWJlbCBzdXBwb3J0IGZvciBhc3luYyBnZW5lcmF0b3JzIGNhbiBiZSBkaXNhYmxlZC5cbiAgICAnYXN5bmMtYXdhaXQnOiBmYWxzZSxcbiAgICAvLyBWOCBjdXJyZW50bHkgaGFzIGEgcGVyZm9ybWFuY2UgZGVmZWN0IGludm9sdmluZyBvYmplY3Qgc3ByZWFkIG9wZXJhdGlvbnMgdGhhdCBjYW4gY2F1c2Ugc2lnbmZpY2FudFxuICAgIC8vIGRlZ3JhZGF0aW9uIGluIHJ1bnRpbWUgcGVyZm9ybWFuY2UuIEJ5IG5vdCBzdXBwb3J0aW5nIHRoZSBsYW5ndWFnZSBmZWF0dXJlIGhlcmUsIGEgZG93bmxldmVsIGZvcm1cbiAgICAvLyB3aWxsIGJlIHVzZWQgaW5zdGVhZCB3aGljaCBwcm92aWRlcyBhIHdvcmthcm91bmQgZm9yIHRoZSBwZXJmb3JtYW5jZSBpc3N1ZS5cbiAgICAvLyBGb3IgbW9yZSBkZXRhaWxzOiBodHRwczovL2J1Z3MuY2hyb21pdW0ub3JnL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0xMTUzNlxuICAgICdvYmplY3QtcmVzdC1zcHJlYWQnOiBmYWxzZSxcbiAgICAvLyBlc2J1aWxkIGN1cnJlbnRseSBoYXMgYSBkZWZlY3QgaW52b2x2aW5nIHNlbGYtcmVmZXJlbmNpbmcgYSBjbGFzcyB3aXRoaW4gYSBzdGF0aWMgY29kZSBibG9jayBvclxuICAgIC8vIHN0YXRpYyBmaWVsZCBpbml0aWFsaXplci4gVGhpcyBpcyBub3QgYW4gaXNzdWUgZm9yIHByb2plY3RzIHRoYXQgdXNlIHRoZSBkZWZhdWx0IGJyb3dzZXJzbGlzdCBhcyB0aGVzZVxuICAgIC8vIGVsZW1lbnRzIGFyZSBhbiBFUzIwMjIgZmVhdHVyZSB3aGljaCBpcyBub3Qgc3VwcG9ydCBieSBhbGwgYnJvd3NlcnMgaW4gdGhlIGRlZmF1bHQgbGlzdC4gSG93ZXZlciwgaWYgYVxuICAgIC8vIGN1c3RvbSBicm93c2Vyc2xpc3QgaXMgdXNlZCB0aGF0IG9ubHkgaGFzIG5ld2VyIGJyb3dzZXJzIHRoYW4gdGhlIHN0YXRpYyBjb2RlIGVsZW1lbnRzIG1heSBiZSBwcmVzZW50LlxuICAgIC8vIFRoaXMgaXNzdWUgaXMgY29tcG91bmRlZCBieSB0aGUgZGVmYXVsdCB1c2FnZSBvZiB0aGUgdHNjb25maWcgYFwidXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHNcIjogZmFsc2VgIG9wdGlvblxuICAgIC8vIHByZXNlbnQgaW4gZ2VuZXJhdGVkIENMSSBwcm9qZWN0cyB3aGljaCBjYXVzZXMgc3RhdGljIGNvZGUgYmxvY2tzIHRvIGJlIHVzZWQgaW5zdGVhZCBvZiBzdGF0aWMgZmllbGRzLlxuICAgIC8vIGVzYnVpbGQgY3VycmVudGx5IHVuY29uZGl0aW9uYWxseSBkb3dubGV2ZWxzIGFsbCBzdGF0aWMgZmllbGRzIGluIHRvcC1sZXZlbCBjbGFzc2VzIHNvIHRvIHdvcmthcm91bmQgdGhlXG4gICAgLy8gQW5ndWxhciBpc3N1ZSBvbmx5IHN0YXRpYyBjb2RlIGJsb2NrcyBhcmUgZGlzYWJsZWQgaGVyZS5cbiAgICAvLyBGb3IgbW9yZSBkZXRhaWxzOiBodHRwczovL2dpdGh1Yi5jb20vZXZhbncvZXNidWlsZC9pc3N1ZXMvMjk1MFxuICAgICdjbGFzcy1zdGF0aWMtYmxvY2tzJzogZmFsc2UsXG4gIH07XG5cbiAgLy8gRGV0ZWN0IFNhZmFyaSBicm93c2VyIHZlcnNpb25zIHRoYXQgaGF2ZSBhIGNsYXNzIGZpZWxkIGJlaGF2aW9yIGJ1Z1xuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNDM1NSNpc3N1ZWNvbW1lbnQtMTMzMzQ3NzAzM1xuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9XZWJLaXQvV2ViS2l0L2NvbW1pdC9lODc4OGEzNGIzZDVmNWI0ZWRkN2ZmNjQ1MGI4MDkzNmJmZjM5NmYyXG4gIGxldCBzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcgPSBmYWxzZTtcbiAgZm9yIChjb25zdCBicm93c2VyIG9mIHRhcmdldCkge1xuICAgIGxldCBtYWpvclZlcnNpb247XG4gICAgaWYgKGJyb3dzZXIuc3RhcnRzV2l0aCgnaW9zJykpIHtcbiAgICAgIG1ham9yVmVyc2lvbiA9IE51bWJlcihicm93c2VyLnNsaWNlKDMsIDUpKTtcbiAgICB9IGVsc2UgaWYgKGJyb3dzZXIuc3RhcnRzV2l0aCgnc2FmYXJpJykpIHtcbiAgICAgIG1ham9yVmVyc2lvbiA9IE51bWJlcihicm93c2VyLnNsaWNlKDYsIDgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIC8vIFRlY2huaWNhbGx5LCAxNC4wIGlzIG5vdCBicm9rZW4gYnV0IHJhdGhlciBkb2VzIG5vdCBoYXZlIHN1cHBvcnQuIEhvd2V2ZXIsIHRoZSBiZWhhdmlvclxuICAgIC8vIGlzIGlkZW50aWNhbCBzaW5jZSBpdCB3b3VsZCBiZSBzZXQgdG8gZmFsc2UgYnkgZXNidWlsZCBpZiBwcmVzZW50IGFzIGEgdGFyZ2V0LlxuICAgIGlmIChtYWpvclZlcnNpb24gPT09IDE0IHx8IG1ham9yVmVyc2lvbiA9PT0gMTUpIHtcbiAgICAgIHNhZmFyaUNsYXNzRmllbGRTY29wZUJ1ZyA9IHRydWU7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgLy8gSWYgY2xhc3MgZmllbGQgc3VwcG9ydCBjYW5ub3QgYmUgdXNlZCBzZXQgdG8gZmFsc2U7IG90aGVyd2lzZSBsZWF2ZSB1bmRlZmluZWQgdG8gYWxsb3dcbiAgLy8gZXNidWlsZCB0byB1c2UgYHRhcmdldGAgdG8gZGV0ZXJtaW5lIHN1cHBvcnQuXG4gIGlmIChzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcpIHtcbiAgICBzdXBwb3J0ZWRbJ2NsYXNzLWZpZWxkJ10gPSBmYWxzZTtcbiAgICBzdXBwb3J0ZWRbJ2NsYXNzLXN0YXRpYy1maWVsZCddID0gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gc3VwcG9ydGVkO1xufVxuXG5hc3luYyBmdW5jdGlvbiB3aXRoU3Bpbm5lcjxUPih0ZXh0OiBzdHJpbmcsIGFjdGlvbjogKCkgPT4gVCB8IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+IHtcbiAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKHRleHQpO1xuICBzcGlubmVyLnN0YXJ0KCk7XG5cbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgYWN0aW9uKCk7XG4gIH0gZmluYWxseSB7XG4gICAgc3Bpbm5lci5zdG9wKCk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gd2l0aE5vUHJvZ3Jlc3M8VD4odGVzdDogc3RyaW5nLCBhY3Rpb246ICgpID0+IFQgfCBQcm9taXNlPFQ+KTogUHJvbWlzZTxUPiB7XG4gIHJldHVybiBhY3Rpb24oKTtcbn1cblxuLyoqXG4gKiBNYWluIGV4ZWN1dGlvbiBmdW5jdGlvbiBmb3IgdGhlIGVzYnVpbGQtYmFzZWQgYXBwbGljYXRpb24gYnVpbGRlci5cbiAqIFRoZSBvcHRpb25zIGFyZSBjb21wYXRpYmxlIHdpdGggdGhlIFdlYnBhY2stYmFzZWQgYnVpbGRlci5cbiAqIEBwYXJhbSB1c2VyT3B0aW9ucyBUaGUgYnJvd3NlciBidWlsZGVyIG9wdGlvbnMgdG8gdXNlIHdoZW4gc2V0dGluZyB1cCB0aGUgYXBwbGljYXRpb24gYnVpbGRcbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBBcmNoaXRlY3QgYnVpbGRlciBjb250ZXh0IG9iamVjdFxuICogQHJldHVybnMgQW4gYXN5bmMgaXRlcmFibGUgd2l0aCB0aGUgYnVpbGRlciByZXN1bHQgb3V0cHV0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZEVzYnVpbGRCcm93c2VyKFxuICB1c2VyT3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgaW5mcmFzdHJ1Y3R1cmVTZXR0aW5ncz86IHtcbiAgICB3cml0ZT86IGJvb2xlYW47XG4gIH0sXG4pOiBBc3luY0l0ZXJhYmxlPFxuICBCdWlsZGVyT3V0cHV0ICYge1xuICAgIG91dHB1dEZpbGVzPzogT3V0cHV0RmlsZVtdO1xuICAgIGFzc2V0RmlsZXM/OiB7IHNvdXJjZTogc3RyaW5nOyBkZXN0aW5hdGlvbjogc3RyaW5nIH1bXTtcbiAgfVxuPiB7XG4gIHJldHVybiBidWlsZEVzYnVpbGRCcm93c2VySW50ZXJuYWwodXNlck9wdGlvbnMsIGNvbnRleHQsIGluZnJhc3RydWN0dXJlU2V0dGluZ3MpO1xufVxuXG4vKipcbiAqIEludGVybmFsIHZlcnNpb24gb2YgdGhlIG1haW4gZXhlY3V0aW9uIGZ1bmN0aW9uIGZvciB0aGUgZXNidWlsZC1iYXNlZCBhcHBsaWNhdGlvbiBidWlsZGVyLlxuICogRXhwb3NlcyBzb21lIGFkZGl0aW9uYWwgXCJwcml2YXRlXCIgb3B0aW9ucyBpbiBhZGRpdGlvbiB0byB0aG9zZSBleHBvc2VkIGJ5IHRoZSBzY2hlbWEuXG4gKiBAcGFyYW0gdXNlck9wdGlvbnMgVGhlIGJyb3dzZXItZXNidWlsZCBidWlsZGVyIG9wdGlvbnMgdG8gdXNlIHdoZW4gc2V0dGluZyB1cCB0aGUgYXBwbGljYXRpb24gYnVpbGRcbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBBcmNoaXRlY3QgYnVpbGRlciBjb250ZXh0IG9iamVjdFxuICogQHJldHVybnMgQW4gYXN5bmMgaXRlcmFibGUgd2l0aCB0aGUgYnVpbGRlciByZXN1bHQgb3V0cHV0XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogYnVpbGRFc2J1aWxkQnJvd3NlckludGVybmFsKFxuICB1c2VyT3B0aW9uczogQnJvd3NlckVzYnVpbGRPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgaW5mcmFzdHJ1Y3R1cmVTZXR0aW5ncz86IHtcbiAgICB3cml0ZT86IGJvb2xlYW47XG4gIH0sXG4pOiBBc3luY0l0ZXJhYmxlPFxuICBCdWlsZGVyT3V0cHV0ICYge1xuICAgIG91dHB1dEZpbGVzPzogT3V0cHV0RmlsZVtdO1xuICAgIGFzc2V0RmlsZXM/OiB7IHNvdXJjZTogc3RyaW5nOyBkZXN0aW5hdGlvbjogc3RyaW5nIH1bXTtcbiAgfVxuPiB7XG4gIC8vIEluZm9ybSB1c2VyIG9mIHN0YXR1cyBvZiBidWlsZGVyIGFuZCBvcHRpb25zXG4gIGxvZ0J1aWxkZXJTdGF0dXNXYXJuaW5ncyh1c2VyT3B0aW9ucywgY29udGV4dCk7XG5cbiAgLy8gRGV0ZXJtaW5lIHByb2plY3QgbmFtZSBmcm9tIGJ1aWxkZXIgY29udGV4dCB0YXJnZXRcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGBUaGUgJ2Jyb3dzZXItZXNidWlsZCcgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldCB0byBiZSBzcGVjaWZpZWQuYCk7XG5cbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBub3JtYWxpemVkT3B0aW9ucyA9IGF3YWl0IG5vcm1hbGl6ZU9wdGlvbnMoY29udGV4dCwgcHJvamVjdE5hbWUsIHVzZXJPcHRpb25zKTtcbiAgLy8gV3JpdGluZyB0aGUgcmVzdWx0IHRvIHRoZSBmaWxlc3lzdGVtIGlzIHRoZSBkZWZhdWx0IGJlaGF2aW9yXG4gIGNvbnN0IHNob3VsZFdyaXRlUmVzdWx0ID0gaW5mcmFzdHJ1Y3R1cmVTZXR0aW5ncz8ud3JpdGUgIT09IGZhbHNlO1xuXG4gIGlmIChzaG91bGRXcml0ZVJlc3VsdCkge1xuICAgIC8vIENsZWFuIG91dHB1dCBwYXRoIGlmIGVuYWJsZWRcbiAgICBpZiAodXNlck9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aCkge1xuICAgICAgaWYgKG5vcm1hbGl6ZWRPcHRpb25zLm91dHB1dFBhdGggPT09IG5vcm1hbGl6ZWRPcHRpb25zLndvcmtzcGFjZVJvb3QpIHtcbiAgICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoJ091dHB1dCBwYXRoIE1VU1Qgbm90IGJlIHdvcmtzcGFjZSByb290IGRpcmVjdG9yeSEnKTtcblxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IGZzLnJtKG5vcm1hbGl6ZWRPcHRpb25zLm91dHB1dFBhdGgsIHsgZm9yY2U6IHRydWUsIHJlY3Vyc2l2ZTogdHJ1ZSwgbWF4UmV0cmllczogMyB9KTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgb3V0cHV0IGRpcmVjdG9yeSBpZiBuZWVkZWRcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZnMubWtkaXIobm9ybWFsaXplZE9wdGlvbnMub3V0cHV0UGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgYXNzZXJ0SXNFcnJvcihlKTtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKCdVbmFibGUgdG8gY3JlYXRlIG91dHB1dCBkaXJlY3Rvcnk6ICcgKyBlLm1lc3NhZ2UpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG5cbiAgY29uc3Qgd2l0aFByb2dyZXNzOiB0eXBlb2Ygd2l0aFNwaW5uZXIgPSBub3JtYWxpemVkT3B0aW9ucy5wcm9ncmVzc1xuICAgID8gd2l0aFNwaW5uZXJcbiAgICA6IHdpdGhOb1Byb2dyZXNzO1xuXG4gIC8vIEluaXRpYWwgYnVpbGRcbiAgbGV0IHJlc3VsdDogRXhlY3V0aW9uUmVzdWx0O1xuICB0cnkge1xuICAgIHJlc3VsdCA9IGF3YWl0IHdpdGhQcm9ncmVzcygnQnVpbGRpbmcuLi4nLCAoKSA9PiBleGVjdXRlKG5vcm1hbGl6ZWRPcHRpb25zLCBjb250ZXh0KSk7XG5cbiAgICBpZiAoc2hvdWxkV3JpdGVSZXN1bHQpIHtcbiAgICAgIC8vIFdyaXRlIG91dHB1dCBmaWxlc1xuICAgICAgYXdhaXQgd3JpdGVSZXN1bHRGaWxlcyhyZXN1bHQub3V0cHV0RmlsZXMsIHJlc3VsdC5hc3NldEZpbGVzLCBub3JtYWxpemVkT3B0aW9ucy5vdXRwdXRQYXRoKTtcblxuICAgICAgeWllbGQgcmVzdWx0Lm91dHB1dDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gUmVxdWlyZXMgY2FzdGluZyBkdWUgdG8gdW5uZWVkZWQgYEpzb25PYmplY3RgIHJlcXVpcmVtZW50LiBSZW1vdmUgb25jZSBmaXhlZC5cbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICB5aWVsZCByZXN1bHQub3V0cHV0V2l0aEZpbGVzIGFzIGFueTtcbiAgICB9XG5cbiAgICAvLyBGaW5pc2ggaWYgd2F0Y2ggbW9kZSBpcyBub3QgZW5hYmxlZFxuICAgIGlmICghdXNlck9wdGlvbnMud2F0Y2gpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH0gZmluYWxseSB7XG4gICAgLy8gRW5zdXJlIFNhc3Mgd29ya2VycyBhcmUgc2h1dGRvd24gaWYgbm90IHdhdGNoaW5nXG4gICAgaWYgKCF1c2VyT3B0aW9ucy53YXRjaCkge1xuICAgICAgc2h1dGRvd25TYXNzV29ya2VyUG9vbCgpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChub3JtYWxpemVkT3B0aW9ucy5wcm9ncmVzcykge1xuICAgIGNvbnRleHQubG9nZ2VyLmluZm8oJ1dhdGNoIG1vZGUgZW5hYmxlZC4gV2F0Y2hpbmcgZm9yIGZpbGUgY2hhbmdlcy4uLicpO1xuICB9XG5cbiAgLy8gU2V0dXAgYSB3YXRjaGVyXG4gIGNvbnN0IHsgY3JlYXRlV2F0Y2hlciB9ID0gYXdhaXQgaW1wb3J0KCcuL3dhdGNoZXInKTtcbiAgY29uc3Qgd2F0Y2hlciA9IGNyZWF0ZVdhdGNoZXIoe1xuICAgIHBvbGxpbmc6IHR5cGVvZiB1c2VyT3B0aW9ucy5wb2xsID09PSAnbnVtYmVyJyxcbiAgICBpbnRlcnZhbDogdXNlck9wdGlvbnMucG9sbCxcbiAgICBpZ25vcmVkOiBbXG4gICAgICAvLyBJZ25vcmUgdGhlIG91dHB1dCBhbmQgY2FjaGUgcGF0aHMgdG8gYXZvaWQgaW5maW5pdGUgcmVidWlsZCBjeWNsZXNcbiAgICAgIG5vcm1hbGl6ZWRPcHRpb25zLm91dHB1dFBhdGgsXG4gICAgICBub3JtYWxpemVkT3B0aW9ucy5jYWNoZU9wdGlvbnMuYmFzZVBhdGgsXG4gICAgICAvLyBJZ25vcmUgYWxsIG5vZGUgbW9kdWxlcyBkaXJlY3RvcmllcyB0byBhdm9pZCBleGNlc3NpdmUgZmlsZSB3YXRjaGVycy5cbiAgICAgIC8vIFBhY2thZ2UgY2hhbmdlcyBhcmUgaGFuZGxlZCBiZWxvdyBieSB3YXRjaGluZyBtYW5pZmVzdCBhbmQgbG9jayBmaWxlcy5cbiAgICAgICcqKi9ub2RlX21vZHVsZXMvKionLFxuICAgIF0sXG4gIH0pO1xuXG4gIC8vIFRlbXBvcmFyaWx5IHdhdGNoIHRoZSBlbnRpcmUgcHJvamVjdFxuICB3YXRjaGVyLmFkZChub3JtYWxpemVkT3B0aW9ucy5wcm9qZWN0Um9vdCk7XG5cbiAgLy8gV2F0Y2ggd29ya3NwYWNlIGZvciBwYWNrYWdlIG1hbmFnZXIgY2hhbmdlc1xuICBjb25zdCBwYWNrYWdlV2F0Y2hGaWxlcyA9IFtcbiAgICAvLyBtYW5pZmVzdCBjYW4gYWZmZWN0IG1vZHVsZSByZXNvbHV0aW9uXG4gICAgJ3BhY2thZ2UuanNvbicsXG4gICAgLy8gbnBtIGxvY2sgZmlsZVxuICAgICdwYWNrYWdlLWxvY2suanNvbicsXG4gICAgLy8gcG5wbSBsb2NrIGZpbGVcbiAgICAncG5wbS1sb2NrLnlhbWwnLFxuICAgIC8vIHlhcm4gbG9jayBmaWxlIGluY2x1ZGluZyBZYXJuIFBuUCBtYW5pZmVzdCBmaWxlcyAoaHR0cHM6Ly95YXJucGtnLmNvbS9hZHZhbmNlZC9wbnAtc3BlYy8pXG4gICAgJ3lhcm4ubG9jaycsXG4gICAgJy5wbnAuY2pzJyxcbiAgICAnLnBucC5kYXRhLmpzb24nLFxuICBdO1xuICB3YXRjaGVyLmFkZChwYWNrYWdlV2F0Y2hGaWxlcy5tYXAoKGZpbGUpID0+IHBhdGguam9pbihub3JtYWxpemVkT3B0aW9ucy53b3Jrc3BhY2VSb290LCBmaWxlKSkpO1xuXG4gIC8vIFdhaXQgZm9yIGNoYW5nZXMgYW5kIHJlYnVpbGQgYXMgbmVlZGVkXG4gIHRyeSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaGFuZ2VzIG9mIHdhdGNoZXIpIHtcbiAgICAgIGlmICh1c2VyT3B0aW9ucy52ZXJib3NlKSB7XG4gICAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oY2hhbmdlcy50b0RlYnVnU3RyaW5nKCkpO1xuICAgICAgfVxuXG4gICAgICByZXN1bHQgPSBhd2FpdCB3aXRoUHJvZ3Jlc3MoJ0NoYW5nZXMgZGV0ZWN0ZWQuIFJlYnVpbGRpbmcuLi4nLCAoKSA9PlxuICAgICAgICBleGVjdXRlKG5vcm1hbGl6ZWRPcHRpb25zLCBjb250ZXh0LCByZXN1bHQuY3JlYXRlUmVidWlsZFN0YXRlKGNoYW5nZXMpKSxcbiAgICAgICk7XG5cbiAgICAgIGlmIChzaG91bGRXcml0ZVJlc3VsdCkge1xuICAgICAgICAvLyBXcml0ZSBvdXRwdXQgZmlsZXNcbiAgICAgICAgYXdhaXQgd3JpdGVSZXN1bHRGaWxlcyhyZXN1bHQub3V0cHV0RmlsZXMsIHJlc3VsdC5hc3NldEZpbGVzLCBub3JtYWxpemVkT3B0aW9ucy5vdXRwdXRQYXRoKTtcblxuICAgICAgICB5aWVsZCByZXN1bHQub3V0cHV0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gUmVxdWlyZXMgY2FzdGluZyBkdWUgdG8gdW5uZWVkZWQgYEpzb25PYmplY3RgIHJlcXVpcmVtZW50LiBSZW1vdmUgb25jZSBmaXhlZC5cbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICAgICAgeWllbGQgcmVzdWx0Lm91dHB1dFdpdGhGaWxlcyBhcyBhbnk7XG4gICAgICB9XG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIC8vIFN0b3AgdGhlIHdhdGNoZXJcbiAgICBhd2FpdCB3YXRjaGVyLmNsb3NlKCk7XG4gICAgLy8gQ2xlYW51cCBpbmNyZW1lbnRhbCByZWJ1aWxkIHN0YXRlXG4gICAgYXdhaXQgcmVzdWx0LmRpc3Bvc2UoKTtcbiAgICBzaHV0ZG93blNhc3NXb3JrZXJQb29sKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcihidWlsZEVzYnVpbGRCcm93c2VyKTtcblxuZnVuY3Rpb24gbG9nQnVpbGRTdGF0cyhjb250ZXh0OiBCdWlsZGVyQ29udGV4dCwgbWV0YWZpbGU6IE1ldGFmaWxlLCBpbml0aWFsRmlsZXM6IEZpbGVJbmZvW10pIHtcbiAgY29uc3QgaW5pdGlhbCA9IG5ldyBNYXAoaW5pdGlhbEZpbGVzLm1hcCgoaW5mbykgPT4gW2luZm8uZmlsZSwgaW5mby5uYW1lXSkpO1xuICBjb25zdCBzdGF0czogQnVuZGxlU3RhdHNbXSA9IFtdO1xuICBmb3IgKGNvbnN0IFtmaWxlLCBvdXRwdXRdIG9mIE9iamVjdC5lbnRyaWVzKG1ldGFmaWxlLm91dHB1dHMpKSB7XG4gICAgLy8gT25seSBkaXNwbGF5IEphdmFTY3JpcHQgYW5kIENTUyBmaWxlc1xuICAgIGlmICghZmlsZS5lbmRzV2l0aCgnLmpzJykgJiYgIWZpbGUuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIC8vIFNraXAgaW50ZXJuYWwgY29tcG9uZW50IHJlc291cmNlc1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgaWYgKChvdXRwdXQgYXMgYW55KVsnbmctY29tcG9uZW50J10pIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHN0YXRzLnB1c2goe1xuICAgICAgaW5pdGlhbDogaW5pdGlhbC5oYXMoZmlsZSksXG4gICAgICBzdGF0czogW2ZpbGUsIGluaXRpYWwuZ2V0KGZpbGUpID8/ICctJywgb3V0cHV0LmJ5dGVzLCAnJ10sXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCB0YWJsZVRleHQgPSBnZW5lcmF0ZUJ1aWxkU3RhdHNUYWJsZShzdGF0cywgdHJ1ZSwgdHJ1ZSwgZmFsc2UsIHVuZGVmaW5lZCk7XG5cbiAgY29udGV4dC5sb2dnZXIuaW5mbygnXFxuJyArIHRhYmxlVGV4dCArICdcXG4nKTtcbn1cbiJdfQ==