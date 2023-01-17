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
    var _a, _b, _c, _d, _e, _f, _g, _h;
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
    // Combine metafiles used for the stats option as well as bundle budgets and console output
    const metafile = {
        inputs: { ...(_e = codeResults.metafile) === null || _e === void 0 ? void 0 : _e.inputs, ...(_f = styleResults.metafile) === null || _f === void 0 ? void 0 : _f.inputs },
        outputs: { ...(_g = codeResults.metafile) === null || _g === void 0 ? void 0 : _g.outputs, ...(_h = styleResults.metafile) === null || _h === void 0 ? void 0 : _h.outputs },
    };
    // Check metafile for CommonJS module usage if optimizing scripts
    if (optimizationOptions.scripts) {
        const messages = (0, commonjs_checker_1.checkCommonJSModules)(metafile, options.allowedCommonJsDependencies);
        await (0, esbuild_1.logMessages)(context, { errors: [], warnings: messages });
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
    // Write metafile if stats option is enabled
    if (options.stats) {
        await fs.writeFile(path.join(outputPath, 'stats.json'), JSON.stringify(metafile, null, 2));
    }
    // Extract and write licenses for used packages
    if (options.extractLicenses) {
        await fs.writeFile(path.join(outputPath, '3rdpartylicenses.txt'), await (0, license_extractor_1.extractLicenses)(metafile, workspaceRoot));
    }
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
    const { workspaceRoot, entryPoints, optimizationOptions, sourcemapOptions, tsconfig, outputNames, fileReplacements, externalDependencies, preserveSymlinks, stylePreprocessorOptions, advancedOptimizations, inlineStyleLanguage, } = options;
    return {
        absWorkingDir: workspaceRoot,
        bundle: true,
        incremental: options.watch,
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
                inlineStyleLanguage,
            }),
        ],
        define: {
            // Only set to false when script optimizations are enabled. It should not be set to true because
            // Angular turns `ngDevMode` into an object for development debugging purposes when not defined
            // which a constant true value would break.
            ...(optimizationOptions.scripts ? { 'ngDevMode': 'false' } : undefined),
            // Only AOT mode is supported currently
            'ngJitMode': 'false',
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
        return;
    }
    // Inform user of experimental status of builder and options
    (0, experimental_warnings_1.logExperimentalWarnings)(initialOptions, context);
    // Determine project name from builder context target
    const projectName = (_a = context.target) === null || _a === void 0 ? void 0 : _a.project;
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
        await fs.mkdir(normalizedOptions.outputPath, { recursive: true });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFFekYsOERBQWlDO0FBQ2pDLHFEQUF1QztBQUN2QyxnREFBa0M7QUFDbEMsdUNBQThDO0FBQzlDLHlEQUFxRDtBQUNyRCw2Q0FBa0Q7QUFDbEQsaUVBQWtGO0FBRWxGLHNGQUFpRjtBQUNqRiwrREFBZ0Y7QUFDaEYsdUVBQXNFO0FBQ3RFLHlEQUEwRDtBQUMxRCx1REFBMEU7QUFDMUUsdUNBQWdEO0FBQ2hELG1FQUFrRTtBQUNsRSwyREFBc0Q7QUFDdEQsdUNBQXVFO0FBQ3ZFLCtDQUF1RDtBQUV2RCwrQ0FBOEQ7QUFDOUQsdUNBQXdEO0FBU3hEOztHQUVHO0FBQ0gsTUFBTSxlQUFlO0lBQ25CLFlBQ1UsT0FBZ0IsRUFDaEIsV0FBNkIsRUFDN0IsbUJBQXFDLEVBQ3JDLGVBQWlDO1FBSGpDLFlBQU8sR0FBUCxPQUFPLENBQVM7UUFDaEIsZ0JBQVcsR0FBWCxXQUFXLENBQWtCO1FBQzdCLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBa0I7UUFDckMsb0JBQWUsR0FBZixlQUFlLENBQWtCO0lBQ3hDLENBQUM7SUFFSixJQUFJLE1BQU07UUFDUixPQUFPO1lBQ0wsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPO1NBQ3RCLENBQUM7SUFDSixDQUFDO0lBRUQsa0JBQWtCLENBQUMsV0FBeUI7O1FBQzFDLE1BQUEsSUFBSSxDQUFDLGVBQWUsMENBQUUsVUFBVSxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsUUFBUSxFQUFFLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENB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QUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQzthQUM5QztZQUVELE1BQU0sR0FBRyxNQUFNLE9BQU8sQ0FBQyxpQkFBaUIsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDdkYsTUFBTSxNQUFNLENBQUMsTUFBTSxDQUFDO1NBQ3JCO0tBQ0Y7WUFBUztRQUNSLG1CQUFtQjtRQUNuQixNQUFNLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUN0QixvQ0FBb0M7UUFDcEMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2pCLElBQUEsb0NBQXNCLEdBQUUsQ0FBQztLQUMxQjtBQUNILENBQUM7QUFoR0Qsa0RBZ0dDO0FBRUQsa0JBQWUsSUFBQSx5QkFBYSxFQUFDLG1CQUFtQixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB0eXBlIHsgQnVpbGRJbnZhbGlkYXRlLCBCdWlsZE9wdGlvbnMsIE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBkZWxldGVPdXRwdXREaXIgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBjb3B5QXNzZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29weS1hc3NldHMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNFcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9yJztcbmltcG9ydCB7IHRyYW5zZm9ybVN1cHBvcnRlZEJyb3dzZXJzVG9UYXJnZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXNidWlsZC10YXJnZXRzJztcbmltcG9ydCB7IEZpbGVJbmZvIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9hdWdtZW50LWluZGV4LWh0bWwnO1xuaW1wb3J0IHsgSW5kZXhIdG1sR2VuZXJhdG9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXJFc2J1aWxkIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2VydmljZS13b3JrZXInO1xuaW1wb3J0IHsgZ2V0U3VwcG9ydGVkQnJvd3NlcnMgfSBmcm9tICcuLi8uLi91dGlscy9zdXBwb3J0ZWQtYnJvd3NlcnMnO1xuaW1wb3J0IHsgY2hlY2tDb21tb25KU01vZHVsZXMgfSBmcm9tICcuL2NvbW1vbmpzLWNoZWNrZXInO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlLCBjcmVhdGVDb21waWxlclBsdWdpbiB9IGZyb20gJy4vY29tcGlsZXItcGx1Z2luJztcbmltcG9ydCB7IGJ1bmRsZSwgbG9nTWVzc2FnZXMgfSBmcm9tICcuL2VzYnVpbGQnO1xuaW1wb3J0IHsgbG9nRXhwZXJpbWVudGFsV2FybmluZ3MgfSBmcm9tICcuL2V4cGVyaW1lbnRhbC13YXJuaW5ncyc7XG5pbXBvcnQgeyBleHRyYWN0TGljZW5zZXMgfSBmcm9tICcuL2xpY2Vuc2UtZXh0cmFjdG9yJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucywgbm9ybWFsaXplT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgeyBzaHV0ZG93blNhc3NXb3JrZXJQb29sIH0gZnJvbSAnLi9zYXNzLXBsdWdpbic7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zIH0gZnJvbSAnLi9zY2hlbWEnO1xuaW1wb3J0IHsgY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnMgfSBmcm9tICcuL3N0eWxlc2hlZXRzJztcbmltcG9ydCB7IENoYW5nZWRGaWxlcywgY3JlYXRlV2F0Y2hlciB9IGZyb20gJy4vd2F0Y2hlcic7XG5cbmludGVyZmFjZSBSZWJ1aWxkU3RhdGUge1xuICBjb2RlUmVidWlsZD86IEJ1aWxkSW52YWxpZGF0ZTtcbiAgZ2xvYmFsU3R5bGVzUmVidWlsZD86IEJ1aWxkSW52YWxpZGF0ZTtcbiAgY29kZUJ1bmRsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlO1xuICBmaWxlQ2hhbmdlczogQ2hhbmdlZEZpbGVzO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgdGhlIHJlc3VsdCBvZiBhIHNpbmdsZSBidWlsZGVyIGV4ZWN1dGUgY2FsbC5cbiAqL1xuY2xhc3MgRXhlY3V0aW9uUmVzdWx0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBzdWNjZXNzOiBib29sZWFuLFxuICAgIHByaXZhdGUgY29kZVJlYnVpbGQ/OiBCdWlsZEludmFsaWRhdGUsXG4gICAgcHJpdmF0ZSBnbG9iYWxTdHlsZXNSZWJ1aWxkPzogQnVpbGRJbnZhbGlkYXRlLFxuICAgIHByaXZhdGUgY29kZUJ1bmRsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlLFxuICApIHt9XG5cbiAgZ2V0IG91dHB1dCgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdGhpcy5zdWNjZXNzLFxuICAgIH07XG4gIH1cblxuICBjcmVhdGVSZWJ1aWxkU3RhdGUoZmlsZUNoYW5nZXM6IENoYW5nZWRGaWxlcyk6IFJlYnVpbGRTdGF0ZSB7XG4gICAgdGhpcy5jb2RlQnVuZGxlQ2FjaGU/LmludmFsaWRhdGUoWy4uLmZpbGVDaGFuZ2VzLm1vZGlmaWVkLCAuLi5maWxlQ2hhbmdlcy5yZW1vdmVkXSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29kZVJlYnVpbGQ6IHRoaXMuY29kZVJlYnVpbGQsXG4gICAgICBnbG9iYWxTdHlsZXNSZWJ1aWxkOiB0aGlzLmdsb2JhbFN0eWxlc1JlYnVpbGQsXG4gICAgICBjb2RlQnVuZGxlQ2FjaGU6IHRoaXMuY29kZUJ1bmRsZUNhY2hlLFxuICAgICAgZmlsZUNoYW5nZXMsXG4gICAgfTtcbiAgfVxuXG4gIGRpc3Bvc2UoKTogdm9pZCB7XG4gICAgdGhpcy5jb2RlUmVidWlsZD8uZGlzcG9zZSgpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHJlYnVpbGRTdGF0ZT86IFJlYnVpbGRTdGF0ZSxcbik6IFByb21pc2U8RXhlY3V0aW9uUmVzdWx0PiB7XG4gIGNvbnN0IHN0YXJ0VGltZSA9IHByb2Nlc3MuaHJ0aW1lLmJpZ2ludCgpO1xuXG4gIGNvbnN0IHtcbiAgICBwcm9qZWN0Um9vdCxcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgb3V0cHV0UGF0aCxcbiAgICBhc3NldHMsXG4gICAgc2VydmljZVdvcmtlck9wdGlvbnMsXG4gICAgaW5kZXhIdG1sT3B0aW9ucyxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgdGFyZ2V0ID0gdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMoXG4gICAgZ2V0U3VwcG9ydGVkQnJvd3NlcnMocHJvamVjdFJvb3QsIGNvbnRleHQubG9nZ2VyKSxcbiAgKTtcblxuICBjb25zdCBjb2RlQnVuZGxlQ2FjaGUgPSBvcHRpb25zLndhdGNoXG4gICAgPyByZWJ1aWxkU3RhdGU/LmNvZGVCdW5kbGVDYWNoZSA/PyBuZXcgU291cmNlRmlsZUNhY2hlKClcbiAgICA6IHVuZGVmaW5lZDtcblxuICBjb25zdCBbY29kZVJlc3VsdHMsIHN0eWxlUmVzdWx0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgLy8gRXhlY3V0ZSBlc2J1aWxkIHRvIGJ1bmRsZSB0aGUgYXBwbGljYXRpb24gY29kZVxuICAgIGJ1bmRsZShcbiAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICByZWJ1aWxkU3RhdGU/LmNvZGVSZWJ1aWxkID8/IGNyZWF0ZUNvZGVCdW5kbGVPcHRpb25zKG9wdGlvbnMsIHRhcmdldCwgY29kZUJ1bmRsZUNhY2hlKSxcbiAgICApLFxuICAgIC8vIEV4ZWN1dGUgZXNidWlsZCB0byBidW5kbGUgdGhlIGdsb2JhbCBzdHlsZXNoZWV0c1xuICAgIGJ1bmRsZShcbiAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICByZWJ1aWxkU3RhdGU/Lmdsb2JhbFN0eWxlc1JlYnVpbGQgPz8gY3JlYXRlR2xvYmFsU3R5bGVzQnVuZGxlT3B0aW9ucyhvcHRpb25zLCB0YXJnZXQpLFxuICAgICksXG4gIF0pO1xuXG4gIC8vIExvZyBhbGwgd2FybmluZ3MgYW5kIGVycm9ycyBnZW5lcmF0ZWQgZHVyaW5nIGJ1bmRsaW5nXG4gIGF3YWl0IGxvZ01lc3NhZ2VzKGNvbnRleHQsIHtcbiAgICBlcnJvcnM6IFsuLi5jb2RlUmVzdWx0cy5lcnJvcnMsIC4uLnN0eWxlUmVzdWx0cy5lcnJvcnNdLFxuICAgIHdhcm5pbmdzOiBbLi4uY29kZVJlc3VsdHMud2FybmluZ3MsIC4uLnN0eWxlUmVzdWx0cy53YXJuaW5nc10sXG4gIH0pO1xuXG4gIC8vIFJldHVybiBpZiB0aGUgYnVuZGxpbmcgZmFpbGVkIHRvIGdlbmVyYXRlIG91dHB1dCBmaWxlcyBvciB0aGVyZSBhcmUgZXJyb3JzXG4gIGlmICghY29kZVJlc3VsdHMub3V0cHV0RmlsZXMgfHwgY29kZVJlc3VsdHMuZXJyb3JzLmxlbmd0aCkge1xuICAgIHJldHVybiBuZXcgRXhlY3V0aW9uUmVzdWx0KFxuICAgICAgZmFsc2UsXG4gICAgICByZWJ1aWxkU3RhdGU/LmNvZGVSZWJ1aWxkLFxuICAgICAgKHN0eWxlUmVzdWx0cy5vdXRwdXRGaWxlcyAmJiBzdHlsZVJlc3VsdHMucmVidWlsZCkgPz8gcmVidWlsZFN0YXRlPy5nbG9iYWxTdHlsZXNSZWJ1aWxkLFxuICAgICAgY29kZUJ1bmRsZUNhY2hlLFxuICAgICk7XG4gIH1cblxuICAvLyBSZXR1cm4gaWYgdGhlIGdsb2JhbCBzdHlsZXNoZWV0IGJ1bmRsaW5nIGhhcyBlcnJvcnNcbiAgaWYgKCFzdHlsZVJlc3VsdHMub3V0cHV0RmlsZXMgfHwgc3R5bGVSZXN1bHRzLmVycm9ycy5sZW5ndGgpIHtcbiAgICByZXR1cm4gbmV3IEV4ZWN1dGlvblJlc3VsdChcbiAgICAgIGZhbHNlLFxuICAgICAgY29kZVJlc3VsdHMucmVidWlsZCxcbiAgICAgIHJlYnVpbGRTdGF0ZT8uZ2xvYmFsU3R5bGVzUmVidWlsZCxcbiAgICAgIGNvZGVCdW5kbGVDYWNoZSxcbiAgICApO1xuICB9XG5cbiAgLy8gRmlsdGVyIGdsb2JhbCBzdHlsZXNoZWV0IGluaXRpYWwgZmlsZXNcbiAgc3R5bGVSZXN1bHRzLmluaXRpYWxGaWxlcyA9IHN0eWxlUmVzdWx0cy5pbml0aWFsRmlsZXMuZmlsdGVyKFxuICAgICh7IG5hbWUgfSkgPT4gb3B0aW9ucy5nbG9iYWxTdHlsZXMuZmluZCgoc3R5bGUpID0+IHN0eWxlLm5hbWUgPT09IG5hbWUpPy5pbml0aWFsLFxuICApO1xuXG4gIC8vIENvbWJpbmUgdGhlIGJ1bmRsaW5nIG91dHB1dCBmaWxlc1xuICBjb25zdCBpbml0aWFsRmlsZXM6IEZpbGVJbmZvW10gPSBbLi4uY29kZVJlc3VsdHMuaW5pdGlhbEZpbGVzLCAuLi5zdHlsZVJlc3VsdHMuaW5pdGlhbEZpbGVzXTtcbiAgY29uc3Qgb3V0cHV0RmlsZXM6IE91dHB1dEZpbGVbXSA9IFsuLi5jb2RlUmVzdWx0cy5vdXRwdXRGaWxlcywgLi4uc3R5bGVSZXN1bHRzLm91dHB1dEZpbGVzXTtcblxuICAvLyBDb21iaW5lIG1ldGFmaWxlcyB1c2VkIGZvciB0aGUgc3RhdHMgb3B0aW9uIGFzIHdlbGwgYXMgYnVuZGxlIGJ1ZGdldHMgYW5kIGNvbnNvbGUgb3V0cHV0XG4gIGNvbnN0IG1ldGFmaWxlID0ge1xuICAgIGlucHV0czogeyAuLi5jb2RlUmVzdWx0cy5tZXRhZmlsZT8uaW5wdXRzLCAuLi5zdHlsZVJlc3VsdHMubWV0YWZpbGU/LmlucHV0cyB9LFxuICAgIG91dHB1dHM6IHsgLi4uY29kZVJlc3VsdHMubWV0YWZpbGU/Lm91dHB1dHMsIC4uLnN0eWxlUmVzdWx0cy5tZXRhZmlsZT8ub3V0cHV0cyB9LFxuICB9O1xuXG4gIC8vIENoZWNrIG1ldGFmaWxlIGZvciBDb21tb25KUyBtb2R1bGUgdXNhZ2UgaWYgb3B0aW1pemluZyBzY3JpcHRzXG4gIGlmIChvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMpIHtcbiAgICBjb25zdCBtZXNzYWdlcyA9IGNoZWNrQ29tbW9uSlNNb2R1bGVzKG1ldGFmaWxlLCBvcHRpb25zLmFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyk7XG4gICAgYXdhaXQgbG9nTWVzc2FnZXMoY29udGV4dCwgeyBlcnJvcnM6IFtdLCB3YXJuaW5nczogbWVzc2FnZXMgfSk7XG4gIH1cblxuICAvLyBHZW5lcmF0ZSBpbmRleCBIVE1MIGZpbGVcbiAgaWYgKGluZGV4SHRtbE9wdGlvbnMpIHtcbiAgICAvLyBDcmVhdGUgYW4gaW5kZXggSFRNTCBnZW5lcmF0b3IgdGhhdCByZWFkcyBmcm9tIHRoZSBpbi1tZW1vcnkgb3V0cHV0IGZpbGVzXG4gICAgY29uc3QgaW5kZXhIdG1sR2VuZXJhdG9yID0gbmV3IEluZGV4SHRtbEdlbmVyYXRvcih7XG4gICAgICBpbmRleFBhdGg6IGluZGV4SHRtbE9wdGlvbnMuaW5wdXQsXG4gICAgICBlbnRyeXBvaW50czogaW5kZXhIdG1sT3B0aW9ucy5pbnNlcnRpb25PcmRlcixcbiAgICAgIHNyaTogb3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSxcbiAgICAgIG9wdGltaXphdGlvbjogb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICAgIGNyb3NzT3JpZ2luOiBvcHRpb25zLmNyb3NzT3JpZ2luLFxuICAgIH0pO1xuXG4gICAgLyoqIFZpcnR1YWwgb3V0cHV0IHBhdGggdG8gc3VwcG9ydCByZWFkaW5nIGluLW1lbW9yeSBmaWxlcy4gKi9cbiAgICBjb25zdCB2aXJ0dWFsT3V0cHV0UGF0aCA9ICcvJztcbiAgICBpbmRleEh0bWxHZW5lcmF0b3IucmVhZEFzc2V0ID0gYXN5bmMgZnVuY3Rpb24gKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgLy8gUmVtb3ZlIGxlYWRpbmcgZGlyZWN0b3J5IHNlcGFyYXRvclxuICAgICAgY29uc3QgcmVsYXRpdmVmaWxlUGF0aCA9IHBhdGgucmVsYXRpdmUodmlydHVhbE91dHB1dFBhdGgsIGZpbGVQYXRoKTtcbiAgICAgIGNvbnN0IGZpbGUgPSBvdXRwdXRGaWxlcy5maW5kKChmaWxlKSA9PiBmaWxlLnBhdGggPT09IHJlbGF0aXZlZmlsZVBhdGgpO1xuICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgcmV0dXJuIGZpbGUudGV4dDtcbiAgICAgIH1cblxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBPdXRwdXQgZmlsZSBkb2VzIG5vdCBleGlzdDogJHtwYXRofWApO1xuICAgIH07XG5cbiAgICBjb25zdCB7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IGluZGV4SHRtbEdlbmVyYXRvci5wcm9jZXNzKHtcbiAgICAgIGJhc2VIcmVmOiBvcHRpb25zLmJhc2VIcmVmLFxuICAgICAgbGFuZzogdW5kZWZpbmVkLFxuICAgICAgb3V0cHV0UGF0aDogdmlydHVhbE91dHB1dFBhdGgsXG4gICAgICBmaWxlczogaW5pdGlhbEZpbGVzLFxuICAgIH0pO1xuXG4gICAgZm9yIChjb25zdCBlcnJvciBvZiBlcnJvcnMpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB3YXJuaW5nIG9mIHdhcm5pbmdzKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci53YXJuKHdhcm5pbmcpO1xuICAgIH1cblxuICAgIG91dHB1dEZpbGVzLnB1c2goY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KGluZGV4SHRtbE9wdGlvbnMub3V0cHV0LCBjb250ZW50KSk7XG4gIH1cblxuICAvLyBDb3B5IGFzc2V0c1xuICBpZiAoYXNzZXRzKSB7XG4gICAgYXdhaXQgY29weUFzc2V0cyhhc3NldHMsIFtvdXRwdXRQYXRoXSwgd29ya3NwYWNlUm9vdCk7XG4gIH1cblxuICAvLyBXcml0ZSBvdXRwdXQgZmlsZXNcbiAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgb3V0cHV0RmlsZXMubWFwKChmaWxlKSA9PiBmcy53cml0ZUZpbGUocGF0aC5qb2luKG91dHB1dFBhdGgsIGZpbGUucGF0aCksIGZpbGUuY29udGVudHMpKSxcbiAgKTtcblxuICAvLyBXcml0ZSBtZXRhZmlsZSBpZiBzdGF0cyBvcHRpb24gaXMgZW5hYmxlZFxuICBpZiAob3B0aW9ucy5zdGF0cykge1xuICAgIGF3YWl0IGZzLndyaXRlRmlsZShwYXRoLmpvaW4ob3V0cHV0UGF0aCwgJ3N0YXRzLmpzb24nKSwgSlNPTi5zdHJpbmdpZnkobWV0YWZpbGUsIG51bGwsIDIpKTtcbiAgfVxuXG4gIC8vIEV4dHJhY3QgYW5kIHdyaXRlIGxpY2Vuc2VzIGZvciB1c2VkIHBhY2thZ2VzXG4gIGlmIChvcHRpb25zLmV4dHJhY3RMaWNlbnNlcykge1xuICAgIGF3YWl0IGZzLndyaXRlRmlsZShcbiAgICAgIHBhdGguam9pbihvdXRwdXRQYXRoLCAnM3JkcGFydHlsaWNlbnNlcy50eHQnKSxcbiAgICAgIGF3YWl0IGV4dHJhY3RMaWNlbnNlcyhtZXRhZmlsZSwgd29ya3NwYWNlUm9vdCksXG4gICAgKTtcbiAgfVxuXG4gIC8vIEF1Z21lbnQgdGhlIGFwcGxpY2F0aW9uIHdpdGggc2VydmljZSB3b3JrZXIgc3VwcG9ydFxuICAvLyBUT0RPOiBUaGlzIHNob3VsZCBldmVudHVhbGx5IG9wZXJhdGUgb24gdGhlIGluLW1lbW9yeSBmaWxlcyBwcmlvciB0byB3cml0aW5nIHRoZSBvdXRwdXQgZmlsZXNcbiAgaWYgKHNlcnZpY2VXb3JrZXJPcHRpb25zKSB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlckVzYnVpbGQoXG4gICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIHNlcnZpY2VXb3JrZXJPcHRpb25zLFxuICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICBvcHRpb25zLmJhc2VIcmVmIHx8ICcvJyxcbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogYCR7ZXJyb3J9YCk7XG5cbiAgICAgIHJldHVybiBuZXcgRXhlY3V0aW9uUmVzdWx0KGZhbHNlLCBjb2RlUmVzdWx0cy5yZWJ1aWxkLCBzdHlsZVJlc3VsdHMucmVidWlsZCwgY29kZUJ1bmRsZUNhY2hlKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBidWlsZFRpbWUgPSBOdW1iZXIocHJvY2Vzcy5ocnRpbWUuYmlnaW50KCkgLSBzdGFydFRpbWUpIC8gMTAgKiogOTtcbiAgY29udGV4dC5sb2dnZXIuaW5mbyhgQ29tcGxldGUuIFske2J1aWxkVGltZS50b0ZpeGVkKDMpfSBzZWNvbmRzXWApO1xuXG4gIHJldHVybiBuZXcgRXhlY3V0aW9uUmVzdWx0KHRydWUsIGNvZGVSZXN1bHRzLnJlYnVpbGQsIHN0eWxlUmVzdWx0cy5yZWJ1aWxkLCBjb2RlQnVuZGxlQ2FjaGUpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQocGF0aDogc3RyaW5nLCB0ZXh0OiBzdHJpbmcpOiBPdXRwdXRGaWxlIHtcbiAgcmV0dXJuIHtcbiAgICBwYXRoLFxuICAgIHRleHQsXG4gICAgZ2V0IGNvbnRlbnRzKCkge1xuICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKHRoaXMudGV4dCwgJ3V0Zi04Jyk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ29kZUJ1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyxcbiAgdGFyZ2V0OiBzdHJpbmdbXSxcbiAgc291cmNlRmlsZUNhY2hlPzogU291cmNlRmlsZUNhY2hlLFxuKTogQnVpbGRPcHRpb25zIHtcbiAgY29uc3Qge1xuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgZW50cnlQb2ludHMsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIGZpbGVSZXBsYWNlbWVudHMsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zLFxuICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gIH0gPSBvcHRpb25zO1xuXG4gIHJldHVybiB7XG4gICAgYWJzV29ya2luZ0Rpcjogd29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IHRydWUsXG4gICAgaW5jcmVtZW50YWw6IG9wdGlvbnMud2F0Y2gsXG4gICAgZm9ybWF0OiAnZXNtJyxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBlbnRyeU5hbWVzOiBvdXRwdXROYW1lcy5idW5kbGVzLFxuICAgIGFzc2V0TmFtZXM6IG91dHB1dE5hbWVzLm1lZGlhLFxuICAgIHRhcmdldCxcbiAgICBzdXBwb3J0ZWQ6IGdldEZlYXR1cmVTdXBwb3J0KHRhcmdldCksXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgIGNvbmRpdGlvbnM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdtb2R1bGUnXSxcbiAgICByZXNvbHZlRXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgIGxlZ2FsQ29tbWVudHM6IG9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzID8gJ25vbmUnIDogJ2VvZicsXG4gICAgbG9nTGV2ZWw6IG9wdGlvbnMudmVyYm9zZSA/ICdkZWJ1ZycgOiAnc2lsZW50JyxcbiAgICBtaW5pZnk6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBwdXJlOiBbJ2ZvcndhcmRSZWYnXSxcbiAgICBvdXRkaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgc291cmNlbWFwOiBzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gJ2V4dGVybmFsJyA6IHRydWUpLFxuICAgIHNwbGl0dGluZzogdHJ1ZSxcbiAgICB0c2NvbmZpZyxcbiAgICBleHRlcm5hbDogZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgICAgICAgLy8gSlMvVFMgb3B0aW9uc1xuICAgICAgICB7XG4gICAgICAgICAgc291cmNlbWFwOiAhIXNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyxcbiAgICAgICAgICB0aGlyZFBhcnR5U291cmNlbWFwczogc291cmNlbWFwT3B0aW9ucy52ZW5kb3IsXG4gICAgICAgICAgdHNjb25maWcsXG4gICAgICAgICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zLFxuICAgICAgICAgIGZpbGVSZXBsYWNlbWVudHMsXG4gICAgICAgICAgc291cmNlRmlsZUNhY2hlLFxuICAgICAgICB9LFxuICAgICAgICAvLyBDb21wb25lbnQgc3R5bGVzaGVldCBvcHRpb25zXG4gICAgICAgIHtcbiAgICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgIG9wdGltaXphdGlvbjogISFvcHRpbWl6YXRpb25PcHRpb25zLnN0eWxlcy5taW5pZnksXG4gICAgICAgICAgc291cmNlbWFwOlxuICAgICAgICAgICAgLy8gSGlkZGVuIGNvbXBvbmVudCBzdHlsZXNoZWV0IHNvdXJjZW1hcHMgYXJlIGluYWNjZXNzaWJsZSB3aGljaCBpcyBlZmZlY3RpdmVseVxuICAgICAgICAgICAgLy8gdGhlIHNhbWUgYXMgYmVpbmcgZGlzYWJsZWQuIERpc2FibGluZyBoYXMgdGhlIGFkdmFudGFnZSBvZiBhdm9pZGluZyB0aGUgb3ZlcmhlYWRcbiAgICAgICAgICAgIC8vIG9mIHNvdXJjZW1hcCBwcm9jZXNzaW5nLlxuICAgICAgICAgICAgISFzb3VyY2VtYXBPcHRpb25zLnN0eWxlcyAmJiAoc291cmNlbWFwT3B0aW9ucy5oaWRkZW4gPyBmYWxzZSA6ICdpbmxpbmUnKSxcbiAgICAgICAgICBvdXRwdXROYW1lcyxcbiAgICAgICAgICBpbmNsdWRlUGF0aHM6IHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucz8uaW5jbHVkZVBhdGhzLFxuICAgICAgICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICBpbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgICAgICB9LFxuICAgICAgKSxcbiAgICBdLFxuICAgIGRlZmluZToge1xuICAgICAgLy8gT25seSBzZXQgdG8gZmFsc2Ugd2hlbiBzY3JpcHQgb3B0aW1pemF0aW9ucyBhcmUgZW5hYmxlZC4gSXQgc2hvdWxkIG5vdCBiZSBzZXQgdG8gdHJ1ZSBiZWNhdXNlXG4gICAgICAvLyBBbmd1bGFyIHR1cm5zIGBuZ0Rldk1vZGVgIGludG8gYW4gb2JqZWN0IGZvciBkZXZlbG9wbWVudCBkZWJ1Z2dpbmcgcHVycG9zZXMgd2hlbiBub3QgZGVmaW5lZFxuICAgICAgLy8gd2hpY2ggYSBjb25zdGFudCB0cnVlIHZhbHVlIHdvdWxkIGJyZWFrLlxuICAgICAgLi4uKG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyA/IHsgJ25nRGV2TW9kZSc6ICdmYWxzZScgfSA6IHVuZGVmaW5lZCksXG4gICAgICAvLyBPbmx5IEFPVCBtb2RlIGlzIHN1cHBvcnRlZCBjdXJyZW50bHlcbiAgICAgICduZ0ppdE1vZGUnOiAnZmFsc2UnLFxuICAgIH0sXG4gIH07XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgc3ludGF4IGZlYXR1cmUgb2JqZWN0IG1hcCBmb3IgQW5ndWxhciBhcHBsaWNhdGlvbnMgYmFzZWQgb24gYSBsaXN0IG9mIHRhcmdldHMuXG4gKiBBIGZ1bGwgc2V0IG9mIGZlYXR1cmUgbmFtZXMgY2FuIGJlIGZvdW5kIGhlcmU6IGh0dHBzOi8vZXNidWlsZC5naXRodWIuaW8vYXBpLyNzdXBwb3J0ZWRcbiAqIEBwYXJhbSB0YXJnZXQgQW4gYXJyYXkgb2YgYnJvd3Nlci9lbmdpbmUgdGFyZ2V0cyBpbiB0aGUgZm9ybWF0IGFjY2VwdGVkIGJ5IHRoZSBlc2J1aWxkIGB0YXJnZXRgIG9wdGlvbi5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkIHdpdGggdGhlIGVzYnVpbGQgYnVpbGQgYHN1cHBvcnRlZGAgb3B0aW9uLlxuICovXG5mdW5jdGlvbiBnZXRGZWF0dXJlU3VwcG9ydCh0YXJnZXQ6IHN0cmluZ1tdKTogQnVpbGRPcHRpb25zWydzdXBwb3J0ZWQnXSB7XG4gIGNvbnN0IHN1cHBvcnRlZDogUmVjb3JkPHN0cmluZywgYm9vbGVhbj4gPSB7XG4gICAgLy8gTmF0aXZlIGFzeW5jL2F3YWl0IGlzIG5vdCBzdXBwb3J0ZWQgd2l0aCBab25lLmpzLiBEaXNhYmxpbmcgc3VwcG9ydCBoZXJlIHdpbGwgY2F1c2VcbiAgICAvLyBlc2J1aWxkIHRvIGRvd25sZXZlbCBhc3luYy9hd2FpdCBhbmQgZm9yIGF3YWl0Li4ub2YgdG8gYSBab25lLmpzIHN1cHBvcnRlZCBmb3JtLiBIb3dldmVyLCBlc2J1aWxkXG4gICAgLy8gZG9lcyBub3QgY3VycmVudGx5IHN1cHBvcnQgZG93bmxldmVsaW5nIGFzeW5jIGdlbmVyYXRvcnMuIEluc3RlYWQgYmFiZWwgaXMgdXNlZCB3aXRoaW4gdGhlIEpTL1RTXG4gICAgLy8gbG9hZGVyIHRvIHBlcmZvcm0gdGhlIGRvd25sZXZlbCB0cmFuc2Zvcm1hdGlvbi5cbiAgICAvLyBOT1RFOiBJZiBlc2J1aWxkIGFkZHMgc3VwcG9ydCBpbiB0aGUgZnV0dXJlLCB0aGUgYmFiZWwgc3VwcG9ydCBmb3IgYXN5bmMgZ2VuZXJhdG9ycyBjYW4gYmUgZGlzYWJsZWQuXG4gICAgJ2FzeW5jLWF3YWl0JzogZmFsc2UsXG4gICAgLy8gVjggY3VycmVudGx5IGhhcyBhIHBlcmZvcm1hbmNlIGRlZmVjdCBpbnZvbHZpbmcgb2JqZWN0IHNwcmVhZCBvcGVyYXRpb25zIHRoYXQgY2FuIGNhdXNlIHNpZ25maWNhbnRcbiAgICAvLyBkZWdyYWRhdGlvbiBpbiBydW50aW1lIHBlcmZvcm1hbmNlLiBCeSBub3Qgc3VwcG9ydGluZyB0aGUgbGFuZ3VhZ2UgZmVhdHVyZSBoZXJlLCBhIGRvd25sZXZlbCBmb3JtXG4gICAgLy8gd2lsbCBiZSB1c2VkIGluc3RlYWQgd2hpY2ggcHJvdmlkZXMgYSB3b3JrYXJvdW5kIGZvciB0aGUgcGVyZm9ybWFuY2UgaXNzdWUuXG4gICAgLy8gRm9yIG1vcmUgZGV0YWlsczogaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MTE1MzZcbiAgICAnb2JqZWN0LXJlc3Qtc3ByZWFkJzogZmFsc2UsXG4gIH07XG5cbiAgLy8gRGV0ZWN0IFNhZmFyaSBicm93c2VyIHZlcnNpb25zIHRoYXQgaGF2ZSBhIGNsYXNzIGZpZWxkIGJlaGF2aW9yIGJ1Z1xuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8yNDM1NSNpc3N1ZWNvbW1lbnQtMTMzMzQ3NzAzM1xuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9XZWJLaXQvV2ViS2l0L2NvbW1pdC9lODc4OGEzNGIzZDVmNWI0ZWRkN2ZmNjQ1MGI4MDkzNmJmZjM5NmYyXG4gIGxldCBzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcgPSBmYWxzZTtcbiAgZm9yIChjb25zdCBicm93c2VyIG9mIHRhcmdldCkge1xuICAgIGxldCBtYWpvclZlcnNpb247XG4gICAgaWYgKGJyb3dzZXIuc3RhcnRzV2l0aCgnaW9zJykpIHtcbiAgICAgIG1ham9yVmVyc2lvbiA9IE51bWJlcihicm93c2VyLnNsaWNlKDMsIDUpKTtcbiAgICB9IGVsc2UgaWYgKGJyb3dzZXIuc3RhcnRzV2l0aCgnc2FmYXJpJykpIHtcbiAgICAgIG1ham9yVmVyc2lvbiA9IE51bWJlcihicm93c2VyLnNsaWNlKDYsIDgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIC8vIFRlY2huaWNhbGx5LCAxNC4wIGlzIG5vdCBicm9rZW4gYnV0IHJhdGhlciBkb2VzIG5vdCBoYXZlIHN1cHBvcnQuIEhvd2V2ZXIsIHRoZSBiZWhhdmlvclxuICAgIC8vIGlzIGlkZW50aWNhbCBzaW5jZSBpdCB3b3VsZCBiZSBzZXQgdG8gZmFsc2UgYnkgZXNidWlsZCBpZiBwcmVzZW50IGFzIGEgdGFyZ2V0LlxuICAgIGlmIChtYWpvclZlcnNpb24gPT09IDE0IHx8IG1ham9yVmVyc2lvbiA9PT0gMTUpIHtcbiAgICAgIHNhZmFyaUNsYXNzRmllbGRTY29wZUJ1ZyA9IHRydWU7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgLy8gSWYgY2xhc3MgZmllbGQgc3VwcG9ydCBjYW5ub3QgYmUgdXNlZCBzZXQgdG8gZmFsc2U7IG90aGVyd2lzZSBsZWF2ZSB1bmRlZmluZWQgdG8gYWxsb3dcbiAgLy8gZXNidWlsZCB0byB1c2UgYHRhcmdldGAgdG8gZGV0ZXJtaW5lIHN1cHBvcnQuXG4gIGlmIChzYWZhcmlDbGFzc0ZpZWxkU2NvcGVCdWcpIHtcbiAgICBzdXBwb3J0ZWRbJ2NsYXNzLWZpZWxkJ10gPSBmYWxzZTtcbiAgICBzdXBwb3J0ZWRbJ2NsYXNzLXN0YXRpYy1maWVsZCddID0gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gc3VwcG9ydGVkO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVHbG9iYWxTdHlsZXNCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMsXG4gIHRhcmdldDogc3RyaW5nW10sXG4pOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7XG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgZ2xvYmFsU3R5bGVzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLFxuICAgIHdhdGNoLFxuICB9ID0gb3B0aW9ucztcblxuICBjb25zdCBidWlsZE9wdGlvbnMgPSBjcmVhdGVTdHlsZXNoZWV0QnVuZGxlT3B0aW9ucyh7XG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBvcHRpbWl6YXRpb246ICEhb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMubWluaWZ5LFxuICAgIHNvdXJjZW1hcDogISFzb3VyY2VtYXBPcHRpb25zLnN0eWxlcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHRhcmdldCxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBpbmNsdWRlUGF0aHM6IHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucz8uaW5jbHVkZVBhdGhzLFxuICB9KTtcbiAgYnVpbGRPcHRpb25zLmluY3JlbWVudGFsID0gd2F0Y2g7XG4gIGJ1aWxkT3B0aW9ucy5sZWdhbENvbW1lbnRzID0gb3B0aW9ucy5leHRyYWN0TGljZW5zZXMgPyAnbm9uZScgOiAnZW9mJztcblxuICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpzdHlsZXMvZ2xvYmFsJztcbiAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0ge307XG4gIGZvciAoY29uc3QgeyBuYW1lIH0gb2YgZ2xvYmFsU3R5bGVzKSB7XG4gICAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzW25hbWVdID0gYCR7bmFtZXNwYWNlfTske25hbWV9YDtcbiAgfVxuXG4gIGJ1aWxkT3B0aW9ucy5wbHVnaW5zLnVuc2hpZnQoe1xuICAgIG5hbWU6ICdhbmd1bGFyLWdsb2JhbC1zdHlsZXMnLFxuICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IC9eYW5ndWxhcjpzdHlsZXNcXC9nbG9iYWw7LyB9LCAoYXJncykgPT4ge1xuICAgICAgICBpZiAoYXJncy5raW5kICE9PSAnZW50cnktcG9pbnQnKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHBhdGg6IGFyZ3MucGF0aC5zcGxpdCgnOycsIDIpWzFdLFxuICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZSB9LCAoYXJncykgPT4ge1xuICAgICAgICBjb25zdCBmaWxlcyA9IGdsb2JhbFN0eWxlcy5maW5kKCh7IG5hbWUgfSkgPT4gbmFtZSA9PT0gYXJncy5wYXRoKT8uZmlsZXM7XG4gICAgICAgIGFzc2VydChmaWxlcywgYGdsb2JhbCBzdHlsZSBuYW1lIHNob3VsZCBhbHdheXMgYmUgZm91bmQgWyR7YXJncy5wYXRofV1gKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbnRlbnRzOiBmaWxlcy5tYXAoKGZpbGUpID0+IGBAaW1wb3J0ICcke2ZpbGUucmVwbGFjZSgvXFxcXC9nLCAnLycpfSc7YCkuam9pbignXFxuJyksXG4gICAgICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIGJ1aWxkT3B0aW9ucztcbn1cblxuLyoqXG4gKiBNYWluIGV4ZWN1dGlvbiBmdW5jdGlvbiBmb3IgdGhlIGVzYnVpbGQtYmFzZWQgYXBwbGljYXRpb24gYnVpbGRlci5cbiAqIFRoZSBvcHRpb25zIGFyZSBjb21wYXRpYmxlIHdpdGggdGhlIFdlYnBhY2stYmFzZWQgYnVpbGRlci5cbiAqIEBwYXJhbSBpbml0aWFsT3B0aW9ucyBUaGUgYnJvd3NlciBidWlsZGVyIG9wdGlvbnMgdG8gdXNlIHdoZW4gc2V0dGluZyB1cCB0aGUgYXBwbGljYXRpb24gYnVpbGRcbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBBcmNoaXRlY3QgYnVpbGRlciBjb250ZXh0IG9iamVjdFxuICogQHJldHVybnMgQW4gYXN5bmMgaXRlcmFibGUgd2l0aCB0aGUgYnVpbGRlciByZXN1bHQgb3V0cHV0XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogYnVpbGRFc2J1aWxkQnJvd3NlcihcbiAgaW5pdGlhbE9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBBc3luY0l0ZXJhYmxlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgLy8gT25seSBBT1QgaXMgY3VycmVudGx5IHN1cHBvcnRlZFxuICBpZiAoaW5pdGlhbE9wdGlvbnMuYW90ICE9PSB0cnVlKSB7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoXG4gICAgICAnSklUIG1vZGUgaXMgY3VycmVudGx5IG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBleHBlcmltZW50YWwgYnVpbGRlci4gQU9UIG1vZGUgbXVzdCBiZSB1c2VkLicsXG4gICAgKTtcblxuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEluZm9ybSB1c2VyIG9mIGV4cGVyaW1lbnRhbCBzdGF0dXMgb2YgYnVpbGRlciBhbmQgb3B0aW9uc1xuICBsb2dFeHBlcmltZW50YWxXYXJuaW5ncyhpbml0aWFsT3B0aW9ucywgY29udGV4dCk7XG5cbiAgLy8gRGV0ZXJtaW5lIHByb2plY3QgbmFtZSBmcm9tIGJ1aWxkZXIgY29udGV4dCB0YXJnZXRcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGBUaGUgJ2Jyb3dzZXItZXNidWlsZCcgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldCB0byBiZSBzcGVjaWZpZWQuYCk7XG5cbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBub3JtYWxpemVkT3B0aW9ucyA9IGF3YWl0IG5vcm1hbGl6ZU9wdGlvbnMoY29udGV4dCwgcHJvamVjdE5hbWUsIGluaXRpYWxPcHRpb25zKTtcblxuICAvLyBDbGVhbiBvdXRwdXQgcGF0aCBpZiBlbmFibGVkXG4gIGlmIChpbml0aWFsT3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoKSB7XG4gICAgZGVsZXRlT3V0cHV0RGlyKG5vcm1hbGl6ZWRPcHRpb25zLndvcmtzcGFjZVJvb3QsIGluaXRpYWxPcHRpb25zLm91dHB1dFBhdGgpO1xuICB9XG5cbiAgLy8gQ3JlYXRlIG91dHB1dCBkaXJlY3RvcnkgaWYgbmVlZGVkXG4gIHRyeSB7XG4gICAgYXdhaXQgZnMubWtkaXIobm9ybWFsaXplZE9wdGlvbnMub3V0cHV0UGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBhc3NlcnRJc0Vycm9yKGUpO1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKCdVbmFibGUgdG8gY3JlYXRlIG91dHB1dCBkaXJlY3Rvcnk6ICcgKyBlLm1lc3NhZ2UpO1xuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gSW5pdGlhbCBidWlsZFxuICBsZXQgcmVzdWx0OiBFeGVjdXRpb25SZXN1bHQ7XG4gIHRyeSB7XG4gICAgcmVzdWx0ID0gYXdhaXQgZXhlY3V0ZShub3JtYWxpemVkT3B0aW9ucywgY29udGV4dCk7XG4gICAgeWllbGQgcmVzdWx0Lm91dHB1dDtcblxuICAgIC8vIEZpbmlzaCBpZiB3YXRjaCBtb2RlIGlzIG5vdCBlbmFibGVkXG4gICAgaWYgKCFpbml0aWFsT3B0aW9ucy53YXRjaCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICAvLyBFbnN1cmUgU2FzcyB3b3JrZXJzIGFyZSBzaHV0ZG93biBpZiBub3Qgd2F0Y2hpbmdcbiAgICBpZiAoIWluaXRpYWxPcHRpb25zLndhdGNoKSB7XG4gICAgICBzaHV0ZG93blNhc3NXb3JrZXJQb29sKCk7XG4gICAgfVxuICB9XG5cbiAgY29udGV4dC5sb2dnZXIuaW5mbygnV2F0Y2ggbW9kZSBlbmFibGVkLiBXYXRjaGluZyBmb3IgZmlsZSBjaGFuZ2VzLi4uJyk7XG5cbiAgLy8gU2V0dXAgYSB3YXRjaGVyXG4gIGNvbnN0IHdhdGNoZXIgPSBjcmVhdGVXYXRjaGVyKHtcbiAgICBwb2xsaW5nOiB0eXBlb2YgaW5pdGlhbE9wdGlvbnMucG9sbCA9PT0gJ251bWJlcicsXG4gICAgaW50ZXJ2YWw6IGluaXRpYWxPcHRpb25zLnBvbGwsXG4gICAgLy8gSWdub3JlIHRoZSBvdXRwdXQgYW5kIGNhY2hlIHBhdGhzIHRvIGF2b2lkIGluZmluaXRlIHJlYnVpbGQgY3ljbGVzXG4gICAgaWdub3JlZDogW25vcm1hbGl6ZWRPcHRpb25zLm91dHB1dFBhdGgsIG5vcm1hbGl6ZWRPcHRpb25zLmNhY2hlT3B0aW9ucy5iYXNlUGF0aF0sXG4gIH0pO1xuXG4gIC8vIFRlbXBvcmFyaWx5IHdhdGNoIHRoZSBlbnRpcmUgcHJvamVjdFxuICB3YXRjaGVyLmFkZChub3JtYWxpemVkT3B0aW9ucy5wcm9qZWN0Um9vdCk7XG5cbiAgLy8gV2F0Y2ggd29ya3NwYWNlIHJvb3Qgbm9kZSBtb2R1bGVzXG4gIC8vIEluY2x1ZGVzIFlhcm4gUG5QIG1hbmlmZXN0IGZpbGVzIChodHRwczovL3lhcm5wa2cuY29tL2FkdmFuY2VkL3BucC1zcGVjLylcbiAgd2F0Y2hlci5hZGQocGF0aC5qb2luKG5vcm1hbGl6ZWRPcHRpb25zLndvcmtzcGFjZVJvb3QsICdub2RlX21vZHVsZXMnKSk7XG4gIHdhdGNoZXIuYWRkKHBhdGguam9pbihub3JtYWxpemVkT3B0aW9ucy53b3Jrc3BhY2VSb290LCAnLnBucC5janMnKSk7XG4gIHdhdGNoZXIuYWRkKHBhdGguam9pbihub3JtYWxpemVkT3B0aW9ucy53b3Jrc3BhY2VSb290LCAnLnBucC5kYXRhLmpzb24nKSk7XG5cbiAgLy8gV2FpdCBmb3IgY2hhbmdlcyBhbmQgcmVidWlsZCBhcyBuZWVkZWRcbiAgdHJ5IHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNoYW5nZXMgb2Ygd2F0Y2hlcikge1xuICAgICAgY29udGV4dC5sb2dnZXIuaW5mbygnQ2hhbmdlcyBkZXRlY3RlZC4gUmVidWlsZGluZy4uLicpO1xuXG4gICAgICBpZiAoaW5pdGlhbE9wdGlvbnMudmVyYm9zZSkge1xuICAgICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKGNoYW5nZXMudG9EZWJ1Z1N0cmluZygpKTtcbiAgICAgIH1cblxuICAgICAgcmVzdWx0ID0gYXdhaXQgZXhlY3V0ZShub3JtYWxpemVkT3B0aW9ucywgY29udGV4dCwgcmVzdWx0LmNyZWF0ZVJlYnVpbGRTdGF0ZShjaGFuZ2VzKSk7XG4gICAgICB5aWVsZCByZXN1bHQub3V0cHV0O1xuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICAvLyBTdG9wIHRoZSB3YXRjaGVyXG4gICAgYXdhaXQgd2F0Y2hlci5jbG9zZSgpO1xuICAgIC8vIENsZWFudXAgaW5jcmVtZW50YWwgcmVidWlsZCBzdGF0ZVxuICAgIHJlc3VsdC5kaXNwb3NlKCk7XG4gICAgc2h1dGRvd25TYXNzV29ya2VyUG9vbCgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXIoYnVpbGRFc2J1aWxkQnJvd3Nlcik7XG4iXX0=