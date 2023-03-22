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
        this.codeBundleCache?.invalidate([...fileChanges.modified, ...fileChanges.removed]);
        return {
            codeRebuild: this.codeRebuild,
            globalStylesRebuild: this.globalStylesRebuild,
            codeBundleCache: this.codeBundleCache,
            fileChanges,
        };
    }
    async dispose() {
        await Promise.all([this.codeRebuild?.dispose(), this.globalStylesRebuild?.dispose()]);
    }
}
async function execute(options, context, rebuildState) {
    const startTime = process.hrtime.bigint();
    const { projectRoot, workspaceRoot, optimizationOptions, outputPath, assets, serviceWorkerOptions, indexHtmlOptions, } = options;
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
    // Return if the bundling failed to generate output files or there are errors
    if (codeResults.errors) {
        return new ExecutionResult(false, codeBundleContext, globalStylesBundleContext, codeBundleCache);
    }
    // Return if the global stylesheet bundling has errors
    if (styleResults.errors) {
        return new ExecutionResult(false, codeBundleContext, globalStylesBundleContext, codeBundleCache);
    }
    // Filter global stylesheet initial files
    styleResults.initialFiles = styleResults.initialFiles.filter(({ name }) => options.globalStyles.find((style) => style.name === name)?.initial);
    // Combine the bundling output files
    const initialFiles = [...codeResults.initialFiles, ...styleResults.initialFiles];
    const outputFiles = [...codeResults.outputFiles, ...styleResults.outputFiles];
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
            const file = outputFiles.find((file) => file.path === relativefilePath);
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
        outputFiles.push(createOutputFileFromText(indexHtmlOptions.output, content));
    }
    // Copy assets
    let assetFiles;
    if (assets) {
        // The webpack copy assets helper is used with no base paths defined. This prevents the helper
        // from directly writing to disk. This should eventually be replaced with a more optimized helper.
        assetFiles = await (0, copy_assets_1.copyAssets)(assets, [], workspaceRoot);
    }
    // Write metafile if stats option is enabled
    if (options.stats) {
        outputFiles.push(createOutputFileFromText('stats.json', JSON.stringify(metafile, null, 2)));
    }
    // Extract and write licenses for used packages
    if (options.extractLicenses) {
        outputFiles.push(createOutputFileFromText('3rdpartylicenses.txt', await (0, license_extractor_1.extractLicenses)(metafile, workspaceRoot)));
    }
    // Augment the application with service worker support
    if (serviceWorkerOptions) {
        try {
            const serviceWorkerResult = await (0, service_worker_1.augmentAppWithServiceWorkerEsbuild)(workspaceRoot, serviceWorkerOptions, options.baseHref || '/', outputFiles, assetFiles || []);
            outputFiles.push(createOutputFileFromText('ngsw.json', serviceWorkerResult.manifest));
            assetFiles ?? (assetFiles = []);
            assetFiles.push(...serviceWorkerResult.assetFiles);
        }
        catch (error) {
            context.logger.error(error instanceof Error ? error.message : `${error}`);
            return new ExecutionResult(false, codeBundleContext, globalStylesBundleContext, codeBundleCache);
        }
    }
    // Write output files
    await writeResultFiles(outputFiles, assetFiles, outputPath);
    const buildTime = Number(process.hrtime.bigint() - startTime) / 10 ** 9;
    context.logger.info(`Complete. [${buildTime.toFixed(3)} seconds]`);
    return new ExecutionResult(true, codeBundleContext, globalStylesBundleContext, codeBundleCache);
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
    const { workspaceRoot, entryPoints, optimizationOptions, sourcemapOptions, tsconfig, outputNames, fileReplacements, externalDependencies, preserveSymlinks, stylePreprocessorOptions, advancedOptimizations, inlineStyleLanguage, jit, tailwindConfiguration, } = options;
    return {
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
 * @param initialOptions The browser builder options to use when setting up the application build
 * @param context The Architect builder context object
 * @returns An async iterable with the builder result output
 */
async function* buildEsbuildBrowser(initialOptions, context) {
    // Inform user of experimental status of builder and options
    (0, experimental_warnings_1.logExperimentalWarnings)(initialOptions, context);
    // Determine project name from builder context target
    const projectName = context.target?.project;
    if (!projectName) {
        context.logger.error(`The 'browser-esbuild' builder requires a target to be specified.`);
        return;
    }
    const normalizedOptions = await (0, options_1.normalizeOptions)(context, projectName, initialOptions);
    // Clean output path if enabled
    if (initialOptions.deleteOutputPath) {
        (0, utils_1.deleteOutputDir)(normalizedOptions.workspaceRoot, initialOptions.outputPath);
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
    // Initial build
    let result;
    try {
        result = await execute(normalizedOptions, context);
        yield result.output;
        // Finish if watch mode is not enabled
        if (!initialOptions.watch) {
            return;
        }
    }
    finally {
        // Ensure Sass workers are shutdown if not watching
        if (!initialOptions.watch) {
            (0, sass_plugin_1.shutdownSassWorkerPool)();
        }
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
    watcher.add(node_path_1.default.join(normalizedOptions.workspaceRoot, 'node_modules'));
    watcher.add(node_path_1.default.join(normalizedOptions.workspaceRoot, '.pnp.cjs'));
    watcher.add(node_path_1.default.join(normalizedOptions.workspaceRoot, '.pnp.data.json'));
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
        await result.dispose();
        (0, sass_plugin_1.shutdownSassWorkerPool)();
    }
}
exports.buildEsbuildBrowser = buildEsbuildBrowser;
exports.default = (0, architect_1.createBuilder)(buildEsbuildBrowser);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgseURBQXlGO0FBRXpGLDhEQUFpQztBQUNqQyxxQ0FBbUQ7QUFDbkQsZ0VBQWtDO0FBQ2xDLDBEQUE2QjtBQUM3Qix1Q0FBOEM7QUFDOUMseURBQXFEO0FBQ3JELDZDQUFrRDtBQUNsRCxpRUFBa0Y7QUFFbEYsc0ZBQWlGO0FBQ2pGLCtEQUFnRjtBQUNoRix1RUFBc0U7QUFDdEUseURBQTBEO0FBQzFELHVEQUEwRTtBQUMxRSx1Q0FBd0Q7QUFDeEQsbUVBQWtFO0FBQ2xFLDJEQUFzRDtBQUN0RCx1Q0FBdUU7QUFDdkUsK0NBQXVEO0FBRXZELCtDQUE4RDtBQUM5RCx1Q0FBd0Q7QUFTeEQ7O0dBRUc7QUFDSCxNQUFNLGVBQWU7SUFDbkIsWUFDVSxPQUFnQixFQUNoQixXQUE0QixFQUM1QixtQkFBb0MsRUFDcEMsZUFBaUM7UUFIakMsWUFBTyxHQUFQLE9BQU8sQ0FBUztRQUNoQixnQkFBVyxHQUFYLFdBQVcsQ0FBaUI7UUFDNUIsd0JBQW1CLEdBQW5CLG1CQUFtQixDQUFpQjtRQUNwQyxvQkFBZSxHQUFmLGVBQWUsQ0FBa0I7SUFDeEMsQ0FBQztJQUVKLElBQUksTUFBTTtRQUNSLE9BQU87WUFDTCxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU87U0FDdEIsQ0FBQztJQUNKLENBQUM7SUFFRCxrQkFBa0IsQ0FBQyxXQUF5QjtRQUMxQyxJQUFJLENBQUMsZUFBZSxFQUFFLFVBQVUsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDLFFBQVEsRUFBRSxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBRXBGLE9BQU87WUFD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QixDQUFDLGFBQWEsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7SUFFMUUseUNBQXlDO0lBQ3pDLElBQUk7UUFDRixJQUFJLEtBQUssRUFBRSxNQUFNLE9BQU8sSUFBSSxPQUFPLEVBQUU7WUFDbkMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUNBQWlDLENBQUMsQ0FBQztZQUV2RCxJQUFJLGNBQWMsQ0FBQyxPQUFPLEVBQUU7Z0JBQzFCLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDO2FBQzlDO1lBRUQsTUFBTSxHQUFHLE1BQU0sT0FBTyxDQUFDLGlCQUFpQixFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN2RixNQUFNLE1BQU0sQ0FBQyxNQUFNLENBQUM7U0FDckI7S0FDRjtZQUFTO1FBQ1IsbUJBQW1CO1FBQ25CLE1BQU0sT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ3RCLG9DQUFvQztRQUNwQyxNQUFNLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN2QixJQUFBLG9DQUFzQixHQUFFLENBQUM7S0FDMUI7QUFDSCxDQUFDO0FBdkZELGtEQXVGQztBQUVELGtCQUFlLElBQUEseUJBQWEsRUFBQyxtQkFBbUIsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgdHlwZSB7IEJ1aWxkT3B0aW9ucywgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyBjb25zdGFudHMgYXMgZnNDb25zdGFudHMgfSBmcm9tICdub2RlOmZzJztcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBkZWxldGVPdXRwdXREaXIgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBjb3B5QXNzZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29weS1hc3NldHMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNFcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9yJztcbmltcG9ydCB7IHRyYW5zZm9ybVN1cHBvcnRlZEJyb3dzZXJzVG9UYXJnZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXNidWlsZC10YXJnZXRzJztcbmltcG9ydCB7IEZpbGVJbmZvIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9hdWdtZW50LWluZGV4LWh0bWwnO1xuaW1wb3J0IHsgSW5kZXhIdG1sR2VuZXJhdG9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXJFc2J1aWxkIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2VydmljZS13b3JrZXInO1xuaW1wb3J0IHsgZ2V0U3VwcG9ydGVkQnJvd3NlcnMgfSBmcm9tICcuLi8uLi91dGlscy9zdXBwb3J0ZWQtYnJvd3NlcnMnO1xuaW1wb3J0IHsgY2hlY2tDb21tb25KU01vZHVsZXMgfSBmcm9tICcuL2NvbW1vbmpzLWNoZWNrZXInO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlLCBjcmVhdGVDb21waWxlclBsdWdpbiB9IGZyb20gJy4vY29tcGlsZXItcGx1Z2luJztcbmltcG9ydCB7IEJ1bmRsZXJDb250ZXh0LCBsb2dNZXNzYWdlcyB9IGZyb20gJy4vZXNidWlsZCc7XG5pbXBvcnQgeyBsb2dFeHBlcmltZW50YWxXYXJuaW5ncyB9IGZyb20gJy4vZXhwZXJpbWVudGFsLXdhcm5pbmdzJztcbmltcG9ydCB7IGV4dHJhY3RMaWNlbnNlcyB9IGZyb20gJy4vbGljZW5zZS1leHRyYWN0b3InO1xuaW1wb3J0IHsgTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zLCBub3JtYWxpemVPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB7IHNodXRkb3duU2Fzc1dvcmtlclBvb2wgfSBmcm9tICcuL3Nhc3MtcGx1Z2luJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMgfSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQgeyBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyB9IGZyb20gJy4vc3R5bGVzaGVldHMnO1xuaW1wb3J0IHsgQ2hhbmdlZEZpbGVzLCBjcmVhdGVXYXRjaGVyIH0gZnJvbSAnLi93YXRjaGVyJztcblxuaW50ZXJmYWNlIFJlYnVpbGRTdGF0ZSB7XG4gIGNvZGVSZWJ1aWxkPzogQnVuZGxlckNvbnRleHQ7XG4gIGdsb2JhbFN0eWxlc1JlYnVpbGQ/OiBCdW5kbGVyQ29udGV4dDtcbiAgY29kZUJ1bmRsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlO1xuICBmaWxlQ2hhbmdlczogQ2hhbmdlZEZpbGVzO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgdGhlIHJlc3VsdCBvZiBhIHNpbmdsZSBidWlsZGVyIGV4ZWN1dGUgY2FsbC5cbiAqL1xuY2xhc3MgRXhlY3V0aW9uUmVzdWx0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBzdWNjZXNzOiBib29sZWFuLFxuICAgIHByaXZhdGUgY29kZVJlYnVpbGQ/OiBCdW5kbGVyQ29udGV4dCxcbiAgICBwcml2YXRlIGdsb2JhbFN0eWxlc1JlYnVpbGQ/OiBCdW5kbGVyQ29udGV4dCxcbiAgICBwcml2YXRlIGNvZGVCdW5kbGVDYWNoZT86IFNvdXJjZUZpbGVDYWNoZSxcbiAgKSB7fVxuXG4gIGdldCBvdXRwdXQoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRoaXMuc3VjY2VzcyxcbiAgICB9O1xuICB9XG5cbiAgY3JlYXRlUmVidWlsZFN0YXRlKGZpbGVDaGFuZ2VzOiBDaGFuZ2VkRmlsZXMpOiBSZWJ1aWxkU3RhdGUge1xuICAgIHRoaXMuY29kZUJ1bmRsZUNhY2hlPy5pbnZhbGlkYXRlKFsuLi5maWxlQ2hhbmdlcy5tb2RpZmllZCwgLi4uZmlsZUNoYW5nZXMucmVtb3ZlZF0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvZGVSZWJ1aWxkOiB0aGlzLmNvZGVSZWJ1aWxkLFxuICAgICAgZ2xvYmFsU3R5bGVzUmVidWlsZDogdGhpcy5nbG9iYWxTdHlsZXNSZWJ1aWxkLFxuICAgICAgY29kZUJ1bmRsZUNhY2hlOiB0aGlzLmNvZGVCdW5kbGVDYWNoZSxcbiAgICAgIGZpbGVDaGFuZ2VzLFxuICAgIH07XG4gIH1cblxuICBhc3luYyBkaXNwb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IFByb21pc2UuYWxsKFt0aGlzLmNvZGVSZWJ1aWxkPy5kaXNwb3NlKCksIHRoaXMuZ2xvYmFsU3R5bGVzUmVidWlsZD8uZGlzcG9zZSgpXSk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZXhlY3V0ZShcbiAgb3B0aW9uczogTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgcmVidWlsZFN0YXRlPzogUmVidWlsZFN0YXRlLFxuKTogUHJvbWlzZTxFeGVjdXRpb25SZXN1bHQ+IHtcbiAgY29uc3Qgc3RhcnRUaW1lID0gcHJvY2Vzcy5ocnRpbWUuYmlnaW50KCk7XG5cbiAgY29uc3Qge1xuICAgIHByb2plY3RSb290LFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBvdXRwdXRQYXRoLFxuICAgIGFzc2V0cyxcbiAgICBzZXJ2aWNlV29ya2VyT3B0aW9ucyxcbiAgICBpbmRleEh0bWxPcHRpb25zLFxuICB9ID0gb3B0aW9ucztcblxuICBjb25zdCBicm93c2VycyA9IGdldFN1cHBvcnRlZEJyb3dzZXJzKHByb2plY3RSb290LCBjb250ZXh0LmxvZ2dlcik7XG4gIGNvbnN0IHRhcmdldCA9IHRyYW5zZm9ybVN1cHBvcnRlZEJyb3dzZXJzVG9UYXJnZXRzKGJyb3dzZXJzKTtcblxuICAvLyBSZXVzZSByZWJ1aWxkIHN0YXRlIG9yIGNyZWF0ZSBuZXcgYnVuZGxlIGNvbnRleHRzIGZvciBjb2RlIGFuZCBnbG9iYWwgc3R5bGVzaGVldHNcbiAgY29uc3QgY29kZUJ1bmRsZUNhY2hlID0gb3B0aW9ucy53YXRjaFxuICAgID8gcmVidWlsZFN0YXRlPy5jb2RlQnVuZGxlQ2FjaGUgPz8gbmV3IFNvdXJjZUZpbGVDYWNoZSgpXG4gICAgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IGNvZGVCdW5kbGVDb250ZXh0ID1cbiAgICByZWJ1aWxkU3RhdGU/LmNvZGVSZWJ1aWxkID8/XG4gICAgbmV3IEJ1bmRsZXJDb250ZXh0KFxuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICEhb3B0aW9ucy53YXRjaCxcbiAgICAgIGNyZWF0ZUNvZGVCdW5kbGVPcHRpb25zKG9wdGlvbnMsIHRhcmdldCwgYnJvd3NlcnMsIGNvZGVCdW5kbGVDYWNoZSksXG4gICAgKTtcbiAgY29uc3QgZ2xvYmFsU3R5bGVzQnVuZGxlQ29udGV4dCA9XG4gICAgcmVidWlsZFN0YXRlPy5nbG9iYWxTdHlsZXNSZWJ1aWxkID8/XG4gICAgbmV3IEJ1bmRsZXJDb250ZXh0KFxuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICEhb3B0aW9ucy53YXRjaCxcbiAgICAgIGNyZWF0ZUdsb2JhbFN0eWxlc0J1bmRsZU9wdGlvbnMob3B0aW9ucywgdGFyZ2V0LCBicm93c2VycyksXG4gICAgKTtcblxuICBjb25zdCBbY29kZVJlc3VsdHMsIHN0eWxlUmVzdWx0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgLy8gRXhlY3V0ZSBlc2J1aWxkIHRvIGJ1bmRsZSB0aGUgYXBwbGljYXRpb24gY29kZVxuICAgIGNvZGVCdW5kbGVDb250ZXh0LmJ1bmRsZSgpLFxuICAgIC8vIEV4ZWN1dGUgZXNidWlsZCB0byBidW5kbGUgdGhlIGdsb2JhbCBzdHlsZXNoZWV0c1xuICAgIGdsb2JhbFN0eWxlc0J1bmRsZUNvbnRleHQuYnVuZGxlKCksXG4gIF0pO1xuXG4gIC8vIExvZyBhbGwgd2FybmluZ3MgYW5kIGVycm9ycyBnZW5lcmF0ZWQgZHVyaW5nIGJ1bmRsaW5nXG4gIGF3YWl0IGxvZ01lc3NhZ2VzKGNvbnRleHQsIHtcbiAgICBlcnJvcnM6IFsuLi4oY29kZVJlc3VsdHMuZXJyb3JzIHx8IFtdKSwgLi4uKHN0eWxlUmVzdWx0cy5lcnJvcnMgfHwgW10pXSxcbiAgICB3YXJuaW5nczogWy4uLmNvZGVSZXN1bHRzLndhcm5pbmdzLCAuLi5zdHlsZVJlc3VsdHMud2FybmluZ3NdLFxuICB9KTtcblxuICAvLyBSZXR1cm4gaWYgdGhlIGJ1bmRsaW5nIGZhaWxlZCB0byBnZW5lcmF0ZSBvdXRwdXQgZmlsZXMgb3IgdGhlcmUgYXJlIGVycm9yc1xuICBpZiAoY29kZVJlc3VsdHMuZXJyb3JzKSB7XG4gICAgcmV0dXJuIG5ldyBFeGVjdXRpb25SZXN1bHQoXG4gICAgICBmYWxzZSxcbiAgICAgIGNvZGVCdW5kbGVDb250ZXh0LFxuICAgICAgZ2xvYmFsU3R5bGVzQnVuZGxlQ29udGV4dCxcbiAgICAgIGNvZGVCdW5kbGVDYWNoZSxcbiAgICApO1xuICB9XG5cbiAgLy8gUmV0dXJuIGlmIHRoZSBnbG9iYWwgc3R5bGVzaGVldCBidW5kbGluZyBoYXMgZXJyb3JzXG4gIGlmIChzdHlsZVJlc3VsdHMuZXJyb3JzKSB7XG4gICAgcmV0dXJuIG5ldyBFeGVjdXRpb25SZXN1bHQoXG4gICAgICBmYWxzZSxcbiAgICAgIGNvZGVCdW5kbGVDb250ZXh0LFxuICAgICAgZ2xvYmFsU3R5bGVzQnVuZGxlQ29udGV4dCxcbiAgICAgIGNvZGVCdW5kbGVDYWNoZSxcbiAgICApO1xuICB9XG5cbiAgLy8gRmlsdGVyIGdsb2JhbCBzdHlsZXNoZWV0IGluaXRpYWwgZmlsZXNcbiAgc3R5bGVSZXN1bHRzLmluaXRpYWxGaWxlcyA9IHN0eWxlUmVzdWx0cy5pbml0aWFsRmlsZXMuZmlsdGVyKFxuICAgICh7IG5hbWUgfSkgPT4gb3B0aW9ucy5nbG9iYWxTdHlsZXMuZmluZCgoc3R5bGUpID0+IHN0eWxlLm5hbWUgPT09IG5hbWUpPy5pbml0aWFsLFxuICApO1xuXG4gIC8vIENvbWJpbmUgdGhlIGJ1bmRsaW5nIG91dHB1dCBmaWxlc1xuICBjb25zdCBpbml0aWFsRmlsZXM6IEZpbGVJbmZvW10gPSBbLi4uY29kZVJlc3VsdHMuaW5pdGlhbEZpbGVzLCAuLi5zdHlsZVJlc3VsdHMuaW5pdGlhbEZpbGVzXTtcbiAgY29uc3Qgb3V0cHV0RmlsZXM6IE91dHB1dEZpbGVbXSA9IFsuLi5jb2RlUmVzdWx0cy5vdXRwdXRGaWxlcywgLi4uc3R5bGVSZXN1bHRzLm91dHB1dEZpbGVzXTtcblxuICAvLyBDb21iaW5lIG1ldGFmaWxlcyB1c2VkIGZvciB0aGUgc3RhdHMgb3B0aW9uIGFzIHdlbGwgYXMgYnVuZGxlIGJ1ZGdldHMgYW5kIGNvbnNvbGUgb3V0cHV0XG4gIGNvbnN0IG1ldGFmaWxlID0ge1xuICAgIGlucHV0czogeyAuLi5jb2RlUmVzdWx0cy5tZXRhZmlsZT8uaW5wdXRzLCAuLi5zdHlsZVJlc3VsdHMubWV0YWZpbGU/LmlucHV0cyB9LFxuICAgIG91dHB1dHM6IHsgLi4uY29kZVJlc3VsdHMubWV0YWZpbGU/Lm91dHB1dHMsIC4uLnN0eWxlUmVzdWx0cy5tZXRhZmlsZT8ub3V0cHV0cyB9LFxuICB9O1xuXG4gIC8vIENoZWNrIG1ldGFmaWxlIGZvciBDb21tb25KUyBtb2R1bGUgdXNhZ2UgaWYgb3B0aW1pemluZyBzY3JpcHRzXG4gIGlmIChvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMpIHtcbiAgICBjb25zdCBtZXNzYWdlcyA9IGNoZWNrQ29tbW9uSlNNb2R1bGVzKG1ldGFmaWxlLCBvcHRpb25zLmFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyk7XG4gICAgYXdhaXQgbG9nTWVzc2FnZXMoY29udGV4dCwgeyB3YXJuaW5nczogbWVzc2FnZXMgfSk7XG4gIH1cblxuICAvLyBHZW5lcmF0ZSBpbmRleCBIVE1MIGZpbGVcbiAgaWYgKGluZGV4SHRtbE9wdGlvbnMpIHtcbiAgICAvLyBDcmVhdGUgYW4gaW5kZXggSFRNTCBnZW5lcmF0b3IgdGhhdCByZWFkcyBmcm9tIHRoZSBpbi1tZW1vcnkgb3V0cHV0IGZpbGVzXG4gICAgY29uc3QgaW5kZXhIdG1sR2VuZXJhdG9yID0gbmV3IEluZGV4SHRtbEdlbmVyYXRvcih7XG4gICAgICBpbmRleFBhdGg6IGluZGV4SHRtbE9wdGlvbnMuaW5wdXQsXG4gICAgICBlbnRyeXBvaW50czogaW5kZXhIdG1sT3B0aW9ucy5pbnNlcnRpb25PcmRlcixcbiAgICAgIHNyaTogb3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSxcbiAgICAgIG9wdGltaXphdGlvbjogb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICAgIGNyb3NzT3JpZ2luOiBvcHRpb25zLmNyb3NzT3JpZ2luLFxuICAgIH0pO1xuXG4gICAgLyoqIFZpcnR1YWwgb3V0cHV0IHBhdGggdG8gc3VwcG9ydCByZWFkaW5nIGluLW1lbW9yeSBmaWxlcy4gKi9cbiAgICBjb25zdCB2aXJ0dWFsT3V0cHV0UGF0aCA9ICcvJztcbiAgICBpbmRleEh0bWxHZW5lcmF0b3IucmVhZEFzc2V0ID0gYXN5bmMgZnVuY3Rpb24gKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgLy8gUmVtb3ZlIGxlYWRpbmcgZGlyZWN0b3J5IHNlcGFyYXRvclxuICAgICAgY29uc3QgcmVsYXRpdmVmaWxlUGF0aCA9IHBhdGgucmVsYXRpdmUodmlydHVhbE91dHB1dFBhdGgsIGZpbGVQYXRoKTtcbiAgICAgIGNvbnN0IGZpbGUgPSBvdXRwdXRGaWxlcy5maW5kKChmaWxlKSA9PiBmaWxlLnBhdGggPT09IHJlbGF0aXZlZmlsZVBhdGgpO1xuICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgcmV0dXJuIGZpbGUudGV4dDtcbiAgICAgIH1cblxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBPdXRwdXQgZmlsZSBkb2VzIG5vdCBleGlzdDogJHtwYXRofWApO1xuICAgIH07XG5cbiAgICBjb25zdCB7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IGluZGV4SHRtbEdlbmVyYXRvci5wcm9jZXNzKHtcbiAgICAgIGJhc2VIcmVmOiBvcHRpb25zLmJhc2VIcmVmLFxuICAgICAgbGFuZzogdW5kZWZpbmVkLFxuICAgICAgb3V0cHV0UGF0aDogdmlydHVhbE91dHB1dFBhdGgsXG4gICAgICBmaWxlczogaW5pdGlhbEZpbGVzLFxuICAgIH0pO1xuXG4gICAgZm9yIChjb25zdCBlcnJvciBvZiBlcnJvcnMpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB3YXJuaW5nIG9mIHdhcm5pbmdzKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci53YXJuKHdhcm5pbmcpO1xuICAgIH1cblxuICAgIG91dHB1dEZpbGVzLnB1c2goY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KGluZGV4SHRtbE9wdGlvbnMub3V0cHV0LCBjb250ZW50KSk7XG4gIH1cblxuICAvLyBDb3B5IGFzc2V0c1xuICBsZXQgYXNzZXRGaWxlcztcbiAgaWYgKGFzc2V0cykge1xuICAgIC8vIFRoZSB3ZWJwYWNrIGNvcHkgYXNzZXRzIGhlbHBlciBpcyB1c2VkIHdpdGggbm8gYmFzZSBwYXRocyBkZWZpbmVkLiBUaGlzIHByZXZlbnRzIHRoZSBoZWxwZXJcbiAgICAvLyBmcm9tIGRpcmVjdGx5IHdyaXRpbmcgdG8gZGlzay4gVGhpcyBzaG91bGQgZXZlbnR1YWxseSBiZSByZXBsYWNlZCB3aXRoIGEgbW9yZSBvcHRpbWl6ZWQgaGVscGVyLlxuICAgIGFzc2V0RmlsZXMgPSBhd2FpdCBjb3B5QXNzZXRzKGFzc2V0cywgW10sIHdvcmtzcGFjZVJvb3QpO1xuICB9XG5cbiAgLy8gV3JpdGUgbWV0YWZpbGUgaWYgc3RhdHMgb3B0aW9uIGlzIGVuYWJsZWRcbiAgaWYgKG9wdGlvbnMuc3RhdHMpIHtcbiAgICBvdXRwdXRGaWxlcy5wdXNoKGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dCgnc3RhdHMuanNvbicsIEpTT04uc3RyaW5naWZ5KG1ldGFmaWxlLCBudWxsLCAyKSkpO1xuICB9XG5cbiAgLy8gRXh0cmFjdCBhbmQgd3JpdGUgbGljZW5zZXMgZm9yIHVzZWQgcGFja2FnZXNcbiAgaWYgKG9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzKSB7XG4gICAgb3V0cHV0RmlsZXMucHVzaChcbiAgICAgIGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChcbiAgICAgICAgJzNyZHBhcnR5bGljZW5zZXMudHh0JyxcbiAgICAgICAgYXdhaXQgZXh0cmFjdExpY2Vuc2VzKG1ldGFmaWxlLCB3b3Jrc3BhY2VSb290KSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIC8vIEF1Z21lbnQgdGhlIGFwcGxpY2F0aW9uIHdpdGggc2VydmljZSB3b3JrZXIgc3VwcG9ydFxuICBpZiAoc2VydmljZVdvcmtlck9wdGlvbnMpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2VydmljZVdvcmtlclJlc3VsdCA9IGF3YWl0IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlckVzYnVpbGQoXG4gICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIHNlcnZpY2VXb3JrZXJPcHRpb25zLFxuICAgICAgICBvcHRpb25zLmJhc2VIcmVmIHx8ICcvJyxcbiAgICAgICAgb3V0cHV0RmlsZXMsXG4gICAgICAgIGFzc2V0RmlsZXMgfHwgW10sXG4gICAgICApO1xuICAgICAgb3V0cHV0RmlsZXMucHVzaChjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQoJ25nc3cuanNvbicsIHNlcnZpY2VXb3JrZXJSZXN1bHQubWFuaWZlc3QpKTtcbiAgICAgIGFzc2V0RmlsZXMgPz89IFtdO1xuICAgICAgYXNzZXRGaWxlcy5wdXNoKC4uLnNlcnZpY2VXb3JrZXJSZXN1bHQuYXNzZXRGaWxlcyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogYCR7ZXJyb3J9YCk7XG5cbiAgICAgIHJldHVybiBuZXcgRXhlY3V0aW9uUmVzdWx0KFxuICAgICAgICBmYWxzZSxcbiAgICAgICAgY29kZUJ1bmRsZUNvbnRleHQsXG4gICAgICAgIGdsb2JhbFN0eWxlc0J1bmRsZUNvbnRleHQsXG4gICAgICAgIGNvZGVCdW5kbGVDYWNoZSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLy8gV3JpdGUgb3V0cHV0IGZpbGVzXG4gIGF3YWl0IHdyaXRlUmVzdWx0RmlsZXMob3V0cHV0RmlsZXMsIGFzc2V0RmlsZXMsIG91dHB1dFBhdGgpO1xuXG4gIGNvbnN0IGJ1aWxkVGltZSA9IE51bWJlcihwcm9jZXNzLmhydGltZS5iaWdpbnQoKSAtIHN0YXJ0VGltZSkgLyAxMCAqKiA5O1xuICBjb250ZXh0LmxvZ2dlci5pbmZvKGBDb21wbGV0ZS4gWyR7YnVpbGRUaW1lLnRvRml4ZWQoMyl9IHNlY29uZHNdYCk7XG5cbiAgcmV0dXJuIG5ldyBFeGVjdXRpb25SZXN1bHQodHJ1ZSwgY29kZUJ1bmRsZUNvbnRleHQsIGdsb2JhbFN0eWxlc0J1bmRsZUNvbnRleHQsIGNvZGVCdW5kbGVDYWNoZSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHdyaXRlUmVzdWx0RmlsZXMoXG4gIG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW10sXG4gIGFzc2V0RmlsZXM6IHsgc291cmNlOiBzdHJpbmc7IGRlc3RpbmF0aW9uOiBzdHJpbmcgfVtdIHwgdW5kZWZpbmVkLFxuICBvdXRwdXRQYXRoOiBzdHJpbmcsXG4pIHtcbiAgY29uc3QgZGlyZWN0b3J5RXhpc3RzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGF3YWl0IFByb21pc2UuYWxsKFxuICAgIG91dHB1dEZpbGVzLm1hcChhc3luYyAoZmlsZSkgPT4ge1xuICAgICAgLy8gRW5zdXJlIG91dHB1dCBzdWJkaXJlY3RvcmllcyBleGlzdFxuICAgICAgY29uc3QgYmFzZVBhdGggPSBwYXRoLmRpcm5hbWUoZmlsZS5wYXRoKTtcbiAgICAgIGlmIChiYXNlUGF0aCAmJiAhZGlyZWN0b3J5RXhpc3RzLmhhcyhiYXNlUGF0aCkpIHtcbiAgICAgICAgYXdhaXQgZnMubWtkaXIocGF0aC5qb2luKG91dHB1dFBhdGgsIGJhc2VQYXRoKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgIGRpcmVjdG9yeUV4aXN0cy5hZGQoYmFzZVBhdGgpO1xuICAgICAgfVxuICAgICAgLy8gV3JpdGUgZmlsZSBjb250ZW50c1xuICAgICAgYXdhaXQgZnMud3JpdGVGaWxlKHBhdGguam9pbihvdXRwdXRQYXRoLCBmaWxlLnBhdGgpLCBmaWxlLmNvbnRlbnRzKTtcbiAgICB9KSxcbiAgKTtcblxuICBpZiAoYXNzZXRGaWxlcz8ubGVuZ3RoKSB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBhc3NldEZpbGVzLm1hcChhc3luYyAoeyBzb3VyY2UsIGRlc3RpbmF0aW9uIH0pID0+IHtcbiAgICAgICAgLy8gRW5zdXJlIG91dHB1dCBzdWJkaXJlY3RvcmllcyBleGlzdFxuICAgICAgICBjb25zdCBiYXNlUGF0aCA9IHBhdGguZGlybmFtZShkZXN0aW5hdGlvbik7XG4gICAgICAgIGlmIChiYXNlUGF0aCAmJiAhZGlyZWN0b3J5RXhpc3RzLmhhcyhiYXNlUGF0aCkpIHtcbiAgICAgICAgICBhd2FpdCBmcy5ta2RpcihwYXRoLmpvaW4ob3V0cHV0UGF0aCwgYmFzZVBhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICBkaXJlY3RvcnlFeGlzdHMuYWRkKGJhc2VQYXRoKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBDb3B5IGZpbGUgY29udGVudHNcbiAgICAgICAgYXdhaXQgZnMuY29weUZpbGUoXG4gICAgICAgICAgc291cmNlLFxuICAgICAgICAgIHBhdGguam9pbihvdXRwdXRQYXRoLCBkZXN0aW5hdGlvbiksXG4gICAgICAgICAgLy8gVGhpcyBpcyBub3QgeWV0IGF2YWlsYWJsZSBmcm9tIGBmcy9wcm9taXNlc2AgaW4gTm9kZS5qcyB2MTYuMTNcbiAgICAgICAgICBmc0NvbnN0YW50cy5DT1BZRklMRV9GSUNMT05FLFxuICAgICAgICApO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQocGF0aDogc3RyaW5nLCB0ZXh0OiBzdHJpbmcpOiBPdXRwdXRGaWxlIHtcbiAgcmV0dXJuIHtcbiAgICBwYXRoLFxuICAgIHRleHQsXG4gICAgZ2V0IGNvbnRlbnRzKCkge1xuICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKHRoaXMudGV4dCwgJ3V0Zi04Jyk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ29kZUJ1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyxcbiAgdGFyZ2V0OiBzdHJpbmdbXSxcbiAgYnJvd3NlcnM6IHN0cmluZ1tdLFxuICBzb3VyY2VGaWxlQ2FjaGU/OiBTb3VyY2VGaWxlQ2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7XG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucyxcbiAgICBhZHZhbmNlZE9wdGltaXphdGlvbnMsXG4gICAgaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICBqaXQsXG4gICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICB9ID0gb3B0aW9ucztcblxuICByZXR1cm4ge1xuICAgIGFic1dvcmtpbmdEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgYnVuZGxlOiB0cnVlLFxuICAgIGZvcm1hdDogJ2VzbScsXG4gICAgZW50cnlQb2ludHMsXG4gICAgZW50cnlOYW1lczogb3V0cHV0TmFtZXMuYnVuZGxlcyxcbiAgICBhc3NldE5hbWVzOiBvdXRwdXROYW1lcy5tZWRpYSxcbiAgICB0YXJnZXQsXG4gICAgc3VwcG9ydGVkOiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQpLFxuICAgIG1haW5GaWVsZHM6IFsnZXMyMDIwJywgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXSxcbiAgICBjb25kaXRpb25zOiBbJ2VzMjAyMCcsICdlczIwMTUnLCAnbW9kdWxlJ10sXG4gICAgcmVzb2x2ZUV4dGVuc2lvbnM6IFsnLnRzJywgJy50c3gnLCAnLm1qcycsICcuanMnXSxcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBsZWdhbENvbW1lbnRzOiBvcHRpb25zLmV4dHJhY3RMaWNlbnNlcyA/ICdub25lJyA6ICdlb2YnLFxuICAgIGxvZ0xldmVsOiBvcHRpb25zLnZlcmJvc2UgPyAnZGVidWcnIDogJ3NpbGVudCcsXG4gICAgbWluaWZ5OiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgcHVyZTogWydmb3J3YXJkUmVmJ10sXG4gICAgb3V0ZGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIHNvdXJjZW1hcDogc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICBzcGxpdHRpbmc6IHRydWUsXG4gICAgdHNjb25maWcsXG4gICAgZXh0ZXJuYWw6IGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gICAgICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICAgICAge1xuICAgICAgICAgIHNvdXJjZW1hcDogISFzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMsXG4gICAgICAgICAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM6IHNvdXJjZW1hcE9wdGlvbnMudmVuZG9yLFxuICAgICAgICAgIHRzY29uZmlnLFxuICAgICAgICAgIGppdCxcbiAgICAgICAgICBhZHZhbmNlZE9wdGltaXphdGlvbnMsXG4gICAgICAgICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICAgICAgICBzb3VyY2VGaWxlQ2FjaGUsXG4gICAgICAgIH0sXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAge1xuICAgICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgb3B0aW1pemF0aW9uOiAhIW9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLm1pbmlmeSxcbiAgICAgICAgICBzb3VyY2VtYXA6XG4gICAgICAgICAgICAvLyBIaWRkZW4gY29tcG9uZW50IHN0eWxlc2hlZXQgc291cmNlbWFwcyBhcmUgaW5hY2Nlc3NpYmxlIHdoaWNoIGlzIGVmZmVjdGl2ZWx5XG4gICAgICAgICAgICAvLyB0aGUgc2FtZSBhcyBiZWluZyBkaXNhYmxlZC4gRGlzYWJsaW5nIGhhcyB0aGUgYWR2YW50YWdlIG9mIGF2b2lkaW5nIHRoZSBvdmVyaGVhZFxuICAgICAgICAgICAgLy8gb2Ygc291cmNlbWFwIHByb2Nlc3NpbmcuXG4gICAgICAgICAgICAhIXNvdXJjZW1hcE9wdGlvbnMuc3R5bGVzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/IGZhbHNlIDogJ2lubGluZScpLFxuICAgICAgICAgIG91dHB1dE5hbWVzLFxuICAgICAgICAgIGluY2x1ZGVQYXRoczogc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zPy5pbmNsdWRlUGF0aHMsXG4gICAgICAgICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgICAgICAgYnJvd3NlcnMsXG4gICAgICAgICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICAgICAgICB9LFxuICAgICAgKSxcbiAgICBdLFxuICAgIGRlZmluZToge1xuICAgICAgLy8gT25seSBzZXQgdG8gZmFsc2Ugd2hlbiBzY3JpcHQgb3B0aW1pemF0aW9ucyBhcmUgZW5hYmxlZC4gSXQgc2hvdWxkIG5vdCBiZSBzZXQgdG8gdHJ1ZSBiZWNhdXNlXG4gICAgICAvLyBBbmd1bGFyIHR1cm5zIGBuZ0Rldk1vZGVgIGludG8gYW4gb2JqZWN0IGZvciBkZXZlbG9wbWVudCBkZWJ1Z2dpbmcgcHVycG9zZXMgd2hlbiBub3QgZGVmaW5lZFxuICAgICAgLy8gd2hpY2ggYSBjb25zdGFudCB0cnVlIHZhbHVlIHdvdWxkIGJyZWFrLlxuICAgICAgLi4uKG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyA/IHsgJ25nRGV2TW9kZSc6ICdmYWxzZScgfSA6IHVuZGVmaW5lZCksXG4gICAgICAnbmdKaXRNb2RlJzogaml0ID8gJ3RydWUnIDogJ2ZhbHNlJyxcbiAgICB9LFxuICB9O1xufVxuXG4vKipcbiAqIEdlbmVyYXRlcyBhIHN5bnRheCBmZWF0dXJlIG9iamVjdCBtYXAgZm9yIEFuZ3VsYXIgYXBwbGljYXRpb25zIGJhc2VkIG9uIGEgbGlzdCBvZiB0YXJnZXRzLlxuICogQSBmdWxsIHNldCBvZiBmZWF0dXJlIG5hbWVzIGNhbiBiZSBmb3VuZCBoZXJlOiBodHRwczovL2VzYnVpbGQuZ2l0aHViLmlvL2FwaS8jc3VwcG9ydGVkXG4gKiBAcGFyYW0gdGFyZ2V0IEFuIGFycmF5IG9mIGJyb3dzZXIvZW5naW5lIHRhcmdldHMgaW4gdGhlIGZvcm1hdCBhY2NlcHRlZCBieSB0aGUgZXNidWlsZCBgdGFyZ2V0YCBvcHRpb24uXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgdGhhdCBjYW4gYmUgdXNlZCB3aXRoIHRoZSBlc2J1aWxkIGJ1aWxkIGBzdXBwb3J0ZWRgIG9wdGlvbi5cbiAqL1xuZnVuY3Rpb24gZ2V0RmVhdHVyZVN1cHBvcnQodGFyZ2V0OiBzdHJpbmdbXSk6IEJ1aWxkT3B0aW9uc1snc3VwcG9ydGVkJ10ge1xuICBjb25zdCBzdXBwb3J0ZWQ6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+ID0ge1xuICAgIC8vIE5hdGl2ZSBhc3luYy9hd2FpdCBpcyBub3Qgc3VwcG9ydGVkIHdpdGggWm9uZS5qcy4gRGlzYWJsaW5nIHN1cHBvcnQgaGVyZSB3aWxsIGNhdXNlXG4gICAgLy8gZXNidWlsZCB0byBkb3dubGV2ZWwgYXN5bmMvYXdhaXQgYW5kIGZvciBhd2FpdC4uLm9mIHRvIGEgWm9uZS5qcyBzdXBwb3J0ZWQgZm9ybS4gSG93ZXZlciwgZXNidWlsZFxuICAgIC8vIGRvZXMgbm90IGN1cnJlbnRseSBzdXBwb3J0IGRvd25sZXZlbGluZyBhc3luYyBnZW5lcmF0b3JzLiBJbnN0ZWFkIGJhYmVsIGlzIHVzZWQgd2l0aGluIHRoZSBKUy9UU1xuICAgIC8vIGxvYWRlciB0byBwZXJmb3JtIHRoZSBkb3dubGV2ZWwgdHJhbnNmb3JtYXRpb24uXG4gICAgLy8gTk9URTogSWYgZXNidWlsZCBhZGRzIHN1cHBvcnQgaW4gdGhlIGZ1dHVyZSwgdGhlIGJhYmVsIHN1cHBvcnQgZm9yIGFzeW5jIGdlbmVyYXRvcnMgY2FuIGJlIGRpc2FibGVkLlxuICAgICdhc3luYy1hd2FpdCc6IGZhbHNlLFxuICAgIC8vIFY4IGN1cnJlbnRseSBoYXMgYSBwZXJmb3JtYW5jZSBkZWZlY3QgaW52b2x2aW5nIG9iamVjdCBzcHJlYWQgb3BlcmF0aW9ucyB0aGF0IGNhbiBjYXVzZSBzaWduZmljYW50XG4gICAgLy8gZGVncmFkYXRpb24gaW4gcnVudGltZSBwZXJmb3JtYW5jZS4gQnkgbm90IHN1cHBvcnRpbmcgdGhlIGxhbmd1YWdlIGZlYXR1cmUgaGVyZSwgYSBkb3dubGV2ZWwgZm9ybVxuICAgIC8vIHdpbGwgYmUgdXNlZCBpbnN0ZWFkIHdoaWNoIHByb3ZpZGVzIGEgd29ya2Fyb3VuZCBmb3IgdGhlIHBlcmZvcm1hbmNlIGlzc3VlLlxuICAgIC8vIEZvciBtb3JlIGRldGFpbHM6IGh0dHBzOi8vYnVncy5jaHJvbWl1bS5vcmcvcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTExNTM2XG4gICAgJ29iamVjdC1yZXN0LXNwcmVhZCc6IGZhbHNlLFxuICB9O1xuXG4gIC8vIERldGVjdCBTYWZhcmkgYnJvd3NlciB2ZXJzaW9ucyB0aGF0IGhhdmUgYSBjbGFzcyBmaWVsZCBiZWhhdmlvciBidWdcbiAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvMjQzNTUjaXNzdWVjb21tZW50LTEzMzM0NzcwMzNcbiAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vV2ViS2l0L1dlYktpdC9jb21taXQvZTg3ODhhMzRiM2Q1ZjViNGVkZDdmZjY0NTBiODA5MzZiZmYzOTZmMlxuICBsZXQgc2FmYXJpQ2xhc3NGaWVsZFNjb3BlQnVnID0gZmFsc2U7XG4gIGZvciAoY29uc3QgYnJvd3NlciBvZiB0YXJnZXQpIHtcbiAgICBsZXQgbWFqb3JWZXJzaW9uO1xuICAgIGlmIChicm93c2VyLnN0YXJ0c1dpdGgoJ2lvcycpKSB7XG4gICAgICBtYWpvclZlcnNpb24gPSBOdW1iZXIoYnJvd3Nlci5zbGljZSgzLCA1KSk7XG4gICAgfSBlbHNlIGlmIChicm93c2VyLnN0YXJ0c1dpdGgoJ3NhZmFyaScpKSB7XG4gICAgICBtYWpvclZlcnNpb24gPSBOdW1iZXIoYnJvd3Nlci5zbGljZSg2LCA4KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICAvLyBUZWNobmljYWxseSwgMTQuMCBpcyBub3QgYnJva2VuIGJ1dCByYXRoZXIgZG9lcyBub3QgaGF2ZSBzdXBwb3J0LiBIb3dldmVyLCB0aGUgYmVoYXZpb3JcbiAgICAvLyBpcyBpZGVudGljYWwgc2luY2UgaXQgd291bGQgYmUgc2V0IHRvIGZhbHNlIGJ5IGVzYnVpbGQgaWYgcHJlc2VudCBhcyBhIHRhcmdldC5cbiAgICBpZiAobWFqb3JWZXJzaW9uID09PSAxNCB8fCBtYWpvclZlcnNpb24gPT09IDE1KSB7XG4gICAgICBzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcgPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIC8vIElmIGNsYXNzIGZpZWxkIHN1cHBvcnQgY2Fubm90IGJlIHVzZWQgc2V0IHRvIGZhbHNlOyBvdGhlcndpc2UgbGVhdmUgdW5kZWZpbmVkIHRvIGFsbG93XG4gIC8vIGVzYnVpbGQgdG8gdXNlIGB0YXJnZXRgIHRvIGRldGVybWluZSBzdXBwb3J0LlxuICBpZiAoc2FmYXJpQ2xhc3NGaWVsZFNjb3BlQnVnKSB7XG4gICAgc3VwcG9ydGVkWydjbGFzcy1maWVsZCddID0gZmFsc2U7XG4gICAgc3VwcG9ydGVkWydjbGFzcy1zdGF0aWMtZmllbGQnXSA9IGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHN1cHBvcnRlZDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlR2xvYmFsU3R5bGVzQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuICBicm93c2Vyczogc3RyaW5nW10sXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7XG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgZ2xvYmFsU3R5bGVzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLFxuICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbixcbiAgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgYnVpbGRPcHRpb25zID0gY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnMoe1xuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgb3B0aW1pemF0aW9uOiAhIW9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLm1pbmlmeSxcbiAgICBzb3VyY2VtYXA6ICEhc291cmNlbWFwT3B0aW9ucy5zdHlsZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICB0YXJnZXQsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgaW5jbHVkZVBhdGhzOiBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocyxcbiAgICBicm93c2VycyxcbiAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gIH0pO1xuICBidWlsZE9wdGlvbnMubGVnYWxDb21tZW50cyA9IG9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzID8gJ25vbmUnIDogJ2VvZic7XG5cbiAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6c3R5bGVzL2dsb2JhbCc7XG4gIGJ1aWxkT3B0aW9ucy5lbnRyeVBvaW50cyA9IHt9O1xuICBmb3IgKGNvbnN0IHsgbmFtZSB9IG9mIGdsb2JhbFN0eWxlcykge1xuICAgIGJ1aWxkT3B0aW9ucy5lbnRyeVBvaW50c1tuYW1lXSA9IGAke25hbWVzcGFjZX07JHtuYW1lfWA7XG4gIH1cblxuICBidWlsZE9wdGlvbnMucGx1Z2lucy51bnNoaWZ0KHtcbiAgICBuYW1lOiAnYW5ndWxhci1nbG9iYWwtc3R5bGVzJyxcbiAgICBzZXR1cChidWlsZCkge1xuICAgICAgYnVpbGQub25SZXNvbHZlKHsgZmlsdGVyOiAvXmFuZ3VsYXI6c3R5bGVzXFwvZ2xvYmFsOy8gfSwgKGFyZ3MpID0+IHtcbiAgICAgICAgaWYgKGFyZ3Mua2luZCAhPT0gJ2VudHJ5LXBvaW50Jykge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBwYXRoOiBhcmdzLnBhdGguc3BsaXQoJzsnLCAyKVsxXSxcbiAgICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICAgIGJ1aWxkLm9uTG9hZCh7IGZpbHRlcjogLy4vLCBuYW1lc3BhY2UgfSwgKGFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgZmlsZXMgPSBnbG9iYWxTdHlsZXMuZmluZCgoeyBuYW1lIH0pID0+IG5hbWUgPT09IGFyZ3MucGF0aCk/LmZpbGVzO1xuICAgICAgICBhc3NlcnQoZmlsZXMsIGBnbG9iYWwgc3R5bGUgbmFtZSBzaG91bGQgYWx3YXlzIGJlIGZvdW5kIFske2FyZ3MucGF0aH1dYCk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50czogZmlsZXMubWFwKChmaWxlKSA9PiBgQGltcG9ydCAnJHtmaWxlLnJlcGxhY2UoL1xcXFwvZywgJy8nKX0nO2ApLmpvaW4oJ1xcbicpLFxuICAgICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH0pO1xuXG4gIHJldHVybiBidWlsZE9wdGlvbnM7XG59XG5cbi8qKlxuICogTWFpbiBleGVjdXRpb24gZnVuY3Rpb24gZm9yIHRoZSBlc2J1aWxkLWJhc2VkIGFwcGxpY2F0aW9uIGJ1aWxkZXIuXG4gKiBUaGUgb3B0aW9ucyBhcmUgY29tcGF0aWJsZSB3aXRoIHRoZSBXZWJwYWNrLWJhc2VkIGJ1aWxkZXIuXG4gKiBAcGFyYW0gaW5pdGlhbE9wdGlvbnMgVGhlIGJyb3dzZXIgYnVpbGRlciBvcHRpb25zIHRvIHVzZSB3aGVuIHNldHRpbmcgdXAgdGhlIGFwcGxpY2F0aW9uIGJ1aWxkXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgQXJjaGl0ZWN0IGJ1aWxkZXIgY29udGV4dCBvYmplY3RcbiAqIEByZXR1cm5zIEFuIGFzeW5jIGl0ZXJhYmxlIHdpdGggdGhlIGJ1aWxkZXIgcmVzdWx0IG91dHB1dFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24qIGJ1aWxkRXNidWlsZEJyb3dzZXIoXG4gIGluaXRpYWxPcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKTogQXN5bmNJdGVyYWJsZTxCdWlsZGVyT3V0cHV0PiB7XG4gIC8vIEluZm9ybSB1c2VyIG9mIGV4cGVyaW1lbnRhbCBzdGF0dXMgb2YgYnVpbGRlciBhbmQgb3B0aW9uc1xuICBsb2dFeHBlcmltZW50YWxXYXJuaW5ncyhpbml0aWFsT3B0aW9ucywgY29udGV4dCk7XG5cbiAgLy8gRGV0ZXJtaW5lIHByb2plY3QgbmFtZSBmcm9tIGJ1aWxkZXIgY29udGV4dCB0YXJnZXRcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGBUaGUgJ2Jyb3dzZXItZXNidWlsZCcgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldCB0byBiZSBzcGVjaWZpZWQuYCk7XG5cbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBub3JtYWxpemVkT3B0aW9ucyA9IGF3YWl0IG5vcm1hbGl6ZU9wdGlvbnMoY29udGV4dCwgcHJvamVjdE5hbWUsIGluaXRpYWxPcHRpb25zKTtcblxuICAvLyBDbGVhbiBvdXRwdXQgcGF0aCBpZiBlbmFibGVkXG4gIGlmIChpbml0aWFsT3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoKSB7XG4gICAgZGVsZXRlT3V0cHV0RGlyKG5vcm1hbGl6ZWRPcHRpb25zLndvcmtzcGFjZVJvb3QsIGluaXRpYWxPcHRpb25zLm91dHB1dFBhdGgpO1xuICB9XG5cbiAgLy8gQ3JlYXRlIG91dHB1dCBkaXJlY3RvcnkgaWYgbmVlZGVkXG4gIHRyeSB7XG4gICAgYXdhaXQgZnMubWtkaXIobm9ybWFsaXplZE9wdGlvbnMub3V0cHV0UGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBhc3NlcnRJc0Vycm9yKGUpO1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKCdVbmFibGUgdG8gY3JlYXRlIG91dHB1dCBkaXJlY3Rvcnk6ICcgKyBlLm1lc3NhZ2UpO1xuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gSW5pdGlhbCBidWlsZFxuICBsZXQgcmVzdWx0OiBFeGVjdXRpb25SZXN1bHQ7XG4gIHRyeSB7XG4gICAgcmVzdWx0ID0gYXdhaXQgZXhlY3V0ZShub3JtYWxpemVkT3B0aW9ucywgY29udGV4dCk7XG4gICAgeWllbGQgcmVzdWx0Lm91dHB1dDtcblxuICAgIC8vIEZpbmlzaCBpZiB3YXRjaCBtb2RlIGlzIG5vdCBlbmFibGVkXG4gICAgaWYgKCFpbml0aWFsT3B0aW9ucy53YXRjaCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICAvLyBFbnN1cmUgU2FzcyB3b3JrZXJzIGFyZSBzaHV0ZG93biBpZiBub3Qgd2F0Y2hpbmdcbiAgICBpZiAoIWluaXRpYWxPcHRpb25zLndhdGNoKSB7XG4gICAgICBzaHV0ZG93blNhc3NXb3JrZXJQb29sKCk7XG4gICAgfVxuICB9XG5cbiAgY29udGV4dC5sb2dnZXIuaW5mbygnV2F0Y2ggbW9kZSBlbmFibGVkLiBXYXRjaGluZyBmb3IgZmlsZSBjaGFuZ2VzLi4uJyk7XG5cbiAgLy8gU2V0dXAgYSB3YXRjaGVyXG4gIGNvbnN0IHdhdGNoZXIgPSBjcmVhdGVXYXRjaGVyKHtcbiAgICBwb2xsaW5nOiB0eXBlb2YgaW5pdGlhbE9wdGlvbnMucG9sbCA9PT0gJ251bWJlcicsXG4gICAgaW50ZXJ2YWw6IGluaXRpYWxPcHRpb25zLnBvbGwsXG4gICAgLy8gSWdub3JlIHRoZSBvdXRwdXQgYW5kIGNhY2hlIHBhdGhzIHRvIGF2b2lkIGluZmluaXRlIHJlYnVpbGQgY3ljbGVzXG4gICAgaWdub3JlZDogW25vcm1hbGl6ZWRPcHRpb25zLm91dHB1dFBhdGgsIG5vcm1hbGl6ZWRPcHRpb25zLmNhY2hlT3B0aW9ucy5iYXNlUGF0aF0sXG4gIH0pO1xuXG4gIC8vIFRlbXBvcmFyaWx5IHdhdGNoIHRoZSBlbnRpcmUgcHJvamVjdFxuICB3YXRjaGVyLmFkZChub3JtYWxpemVkT3B0aW9ucy5wcm9qZWN0Um9vdCk7XG5cbiAgLy8gV2F0Y2ggd29ya3NwYWNlIHJvb3Qgbm9kZSBtb2R1bGVzXG4gIC8vIEluY2x1ZGVzIFlhcm4gUG5QIG1hbmlmZXN0IGZpbGVzIChodHRwczovL3lhcm5wa2cuY29tL2FkdmFuY2VkL3BucC1zcGVjLylcbiAgd2F0Y2hlci5hZGQocGF0aC5qb2luKG5vcm1hbGl6ZWRPcHRpb25zLndvcmtzcGFjZVJvb3QsICdub2RlX21vZHVsZXMnKSk7XG4gIHdhdGNoZXIuYWRkKHBhdGguam9pbihub3JtYWxpemVkT3B0aW9ucy53b3Jrc3BhY2VSb290LCAnLnBucC5janMnKSk7XG4gIHdhdGNoZXIuYWRkKHBhdGguam9pbihub3JtYWxpemVkT3B0aW9ucy53b3Jrc3BhY2VSb290LCAnLnBucC5kYXRhLmpzb24nKSk7XG5cbiAgLy8gV2FpdCBmb3IgY2hhbmdlcyBhbmQgcmVidWlsZCBhcyBuZWVkZWRcbiAgdHJ5IHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNoYW5nZXMgb2Ygd2F0Y2hlcikge1xuICAgICAgY29udGV4dC5sb2dnZXIuaW5mbygnQ2hhbmdlcyBkZXRlY3RlZC4gUmVidWlsZGluZy4uLicpO1xuXG4gICAgICBpZiAoaW5pdGlhbE9wdGlvbnMudmVyYm9zZSkge1xuICAgICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKGNoYW5nZXMudG9EZWJ1Z1N0cmluZygpKTtcbiAgICAgIH1cblxuICAgICAgcmVzdWx0ID0gYXdhaXQgZXhlY3V0ZShub3JtYWxpemVkT3B0aW9ucywgY29udGV4dCwgcmVzdWx0LmNyZWF0ZVJlYnVpbGRTdGF0ZShjaGFuZ2VzKSk7XG4gICAgICB5aWVsZCByZXN1bHQub3V0cHV0O1xuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICAvLyBTdG9wIHRoZSB3YXRjaGVyXG4gICAgYXdhaXQgd2F0Y2hlci5jbG9zZSgpO1xuICAgIC8vIENsZWFudXAgaW5jcmVtZW50YWwgcmVidWlsZCBzdGF0ZVxuICAgIGF3YWl0IHJlc3VsdC5kaXNwb3NlKCk7XG4gICAgc2h1dGRvd25TYXNzV29ya2VyUG9vbCgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXIoYnVpbGRFc2J1aWxkQnJvd3Nlcik7XG4iXX0=