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
const fs_1 = require("fs");
const path = __importStar(require("path"));
const utils_1 = require("../../utils");
const copy_assets_1 = require("../../utils/copy-assets");
const error_1 = require("../../utils/error");
const index_html_generator_1 = require("../../utils/index-file/index-html-generator");
const package_chunk_sort_1 = require("../../utils/package-chunk-sort");
const service_worker_1 = require("../../utils/service-worker");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const configs_1 = require("../../webpack/configs");
const compiler_plugin_1 = require("./compiler-plugin");
const esbuild_1 = require("./esbuild");
const experimental_warnings_1 = require("./experimental-warnings");
const options_1 = require("./options");
const stylesheets_1 = require("./stylesheets");
/**
 * Main execution function for the esbuild-based application builder.
 * The options are compatible with the Webpack-based builder.
 * @param options The browser builder options to use when setting up the application build
 * @param context The Architect builder context object
 * @returns A promise with the builder result output
 */
// eslint-disable-next-line max-lines-per-function
async function buildEsbuildBrowser(options, context) {
    var _a, _b, _c, _d, _e, _f;
    const startTime = Date.now();
    // Only AOT is currently supported
    if (options.aot !== true) {
        context.logger.error('JIT mode is currently not supported by this experimental builder. AOT mode must be used.');
        return { success: false };
    }
    // Inform user of experimental status of builder and options
    (0, experimental_warnings_1.logExperimentalWarnings)(options, context);
    // Determine project name from builder context target
    const projectName = (_a = context.target) === null || _a === void 0 ? void 0 : _a.project;
    if (!projectName) {
        context.logger.error(`The 'browser-esbuild' builder requires a target to be specified.`);
        return { success: false };
    }
    const { projectRoot, workspaceRoot, entryPoints, entryPointNameLookup, optimizationOptions, outputPath, sourcemapOptions, tsconfig, assets, outputNames, } = await (0, options_1.normalizeOptions)(context, projectName, options);
    // Clean output path if enabled
    if (options.deleteOutputPath) {
        (0, utils_1.deleteOutputDir)(workspaceRoot, options.outputPath);
    }
    // Create output directory if needed
    try {
        await fs_1.promises.mkdir(outputPath, { recursive: true });
    }
    catch (e) {
        (0, error_1.assertIsError)(e);
        context.logger.error('Unable to create output directory: ' + e.message);
        return { success: false };
    }
    const [codeResults, styleResults] = await Promise.all([
        // Execute esbuild to bundle the application code
        bundleCode(workspaceRoot, entryPoints, outputNames, options, optimizationOptions, sourcemapOptions, tsconfig),
        // Execute esbuild to bundle the global stylesheets
        bundleGlobalStylesheets(workspaceRoot, outputNames, options, optimizationOptions, sourcemapOptions),
    ]);
    // Log all warnings and errors generated during bundling
    await (0, esbuild_1.logMessages)(context, {
        errors: [...codeResults.errors, ...styleResults.errors],
        warnings: [...codeResults.warnings, ...styleResults.warnings],
    });
    // Return if the bundling failed to generate output files or there are errors
    if (!codeResults.outputFiles || codeResults.errors.length) {
        return { success: false };
    }
    // Structure the code bundling output files
    const initialFiles = [];
    const outputFiles = [];
    for (const outputFile of codeResults.outputFiles) {
        // Entries in the metafile are relative to the `absWorkingDir` option which is set to the workspaceRoot
        const relativeFilePath = path.relative(workspaceRoot, outputFile.path);
        const entryPoint = (_c = (_b = codeResults.metafile) === null || _b === void 0 ? void 0 : _b.outputs[relativeFilePath]) === null || _c === void 0 ? void 0 : _c.entryPoint;
        outputFile.path = relativeFilePath;
        if (entryPoint) {
            // An entryPoint value indicates an initial file
            initialFiles.push({
                file: outputFile.path,
                name: (_d = entryPointNameLookup.get(entryPoint)) !== null && _d !== void 0 ? _d : '',
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
        return { success: false };
    }
    // Generate index HTML file
    if (options.index) {
        const entrypoints = (0, package_chunk_sort_1.generateEntryPoints)({
            scripts: (_e = options.scripts) !== null && _e !== void 0 ? _e : [],
            styles: (_f = options.styles) !== null && _f !== void 0 ? _f : [],
        });
        // Create an index HTML generator that reads from the in-memory output files
        const indexHtmlGenerator = new index_html_generator_1.IndexHtmlGenerator({
            indexPath: path.join(context.workspaceRoot, (0, webpack_browser_config_1.getIndexInputFile)(options.index)),
            entrypoints,
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
        outputFiles.push(createOutputFileFromText((0, webpack_browser_config_1.getIndexOutputFile)(options.index), content));
    }
    // Copy assets
    if (assets) {
        await (0, copy_assets_1.copyAssets)(assets, [outputPath], workspaceRoot);
    }
    // Write output files
    await Promise.all(outputFiles.map((file) => fs_1.promises.writeFile(path.join(outputPath, file.path), file.contents)));
    // Augment the application with service worker support
    // TODO: This should eventually operate on the in-memory files prior to writing the output files
    if (options.serviceWorker) {
        try {
            await (0, service_worker_1.augmentAppWithServiceWorker)(projectRoot, workspaceRoot, outputPath, options.baseHref || '/', options.ngswConfigPath);
        }
        catch (error) {
            context.logger.error(error instanceof Error ? error.message : `${error}`);
            return { success: false };
        }
    }
    context.logger.info(`Complete. [${(Date.now() - startTime) / 1000} seconds]`);
    return { success: true };
}
exports.buildEsbuildBrowser = buildEsbuildBrowser;
function createOutputFileFromText(path, text) {
    return {
        path,
        text,
        get contents() {
            return Buffer.from(this.text, 'utf-8');
        },
    };
}
async function bundleCode(workspaceRoot, entryPoints, outputNames, options, optimizationOptions, sourcemapOptions, tsconfig) {
    var _a;
    return (0, esbuild_1.bundle)({
        absWorkingDir: workspaceRoot,
        bundle: true,
        format: 'esm',
        entryPoints,
        entryNames: outputNames.bundles,
        assetNames: outputNames.media,
        target: 'es2020',
        supported: {
            // Native async/await is not supported with Zone.js. Disabling support here will cause
            // esbuild to downlevel async/await to a Zone.js supported form.
            'async-await': false,
            // Zone.js also does not support async generators or async iterators. However, esbuild does
            // not currently support downleveling either of them. Instead babel is used within the JS/TS
            // loader to perform the downlevel transformation. They are both disabled here to allow
            // esbuild to handle them in the future if support is ever added.
            // NOTE: If esbuild adds support in the future, the babel support for these can be disabled.
            'async-generator': false,
            'for-await': false,
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
        external: options.externalDependencies,
        write: false,
        platform: 'browser',
        preserveSymlinks: options.preserveSymlinks,
        plugins: [
            (0, compiler_plugin_1.createCompilerPlugin)(
            // JS/TS options
            {
                sourcemap: !!sourcemapOptions.scripts,
                thirdPartySourcemaps: sourcemapOptions.vendor,
                tsconfig,
                advancedOptimizations: options.buildOptimizer,
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
                includePaths: (_a = options.stylePreprocessorOptions) === null || _a === void 0 ? void 0 : _a.includePaths,
                externalDependencies: options.externalDependencies,
            }),
        ],
        define: {
            ...(optimizationOptions.scripts ? { 'ngDevMode': 'false' } : undefined),
            'ngJitMode': 'false',
        },
    });
}
async function bundleGlobalStylesheets(workspaceRoot, outputNames, options, optimizationOptions, sourcemapOptions) {
    var _a;
    const outputFiles = [];
    const initialFiles = [];
    const errors = [];
    const warnings = [];
    // resolveGlobalStyles is temporarily reused from the Webpack builder code
    const { entryPoints: stylesheetEntrypoints, noInjectNames } = (0, configs_1.resolveGlobalStyles)(options.styles || [], workspaceRoot, 
    // preserveSymlinks is always true here to allow the bundler to handle the option
    true, 
    // skipResolution to leverage the bundler's more comprehensive resolution
    true);
    for (const [name, files] of Object.entries(stylesheetEntrypoints)) {
        const virtualEntryData = files
            .map((file) => `@import '${file.replace(/\\/g, '/')}';`)
            .join('\n');
        const sheetResult = await (0, stylesheets_1.bundleStylesheetText)(virtualEntryData, { virtualName: `angular:style/global;${name}`, resolvePath: workspaceRoot }, {
            workspaceRoot,
            optimization: !!optimizationOptions.styles.minify,
            sourcemap: !!sourcemapOptions.styles && (sourcemapOptions.hidden ? 'external' : true),
            outputNames: noInjectNames.includes(name) ? { media: outputNames.media } : outputNames,
            includePaths: (_a = options.stylePreprocessorOptions) === null || _a === void 0 ? void 0 : _a.includePaths,
            preserveSymlinks: options.preserveSymlinks,
            externalDependencies: options.externalDependencies,
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
        if (!noInjectNames.includes(name)) {
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
exports.default = (0, architect_1.createBuilder)(buildEsbuildBrowser);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsK0NBQWlDO0FBRWpDLDJCQUFvQztBQUNwQywyQ0FBNkI7QUFDN0IsdUNBQTZFO0FBQzdFLHlEQUFxRDtBQUNyRCw2Q0FBa0Q7QUFFbEQsc0ZBQWlGO0FBQ2pGLHVFQUFxRTtBQUNyRSwrREFBeUU7QUFDekUsK0VBQTJGO0FBQzNGLG1EQUE0RDtBQUM1RCx1REFBeUQ7QUFDekQsdUNBQWdEO0FBQ2hELG1FQUFrRTtBQUNsRSx1Q0FBNkM7QUFFN0MsK0NBQXFEO0FBRXJEOzs7Ozs7R0FNRztBQUNILGtEQUFrRDtBQUMzQyxLQUFLLFVBQVUsbUJBQW1CLENBQ3ZDLE9BQThCLEVBQzlCLE9BQXVCOztJQUV2QixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFN0Isa0NBQWtDO0lBQ2xDLElBQUksT0FBTyxDQUFDLEdBQUcsS0FBSyxJQUFJLEVBQUU7UUFDeEIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQ2xCLDBGQUEwRixDQUMzRixDQUFDO1FBRUYsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztLQUMzQjtJQUVELDREQUE0RDtJQUM1RCxJQUFBLCtDQUF1QixFQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztJQUUxQyxxREFBcUQ7SUFDckQsTUFBTSxXQUFXLEdBQUcsTUFBQSxPQUFPLENBQUMsTUFBTSwwQ0FBRSxPQUFPLENBQUM7SUFDNUMsSUFBSSxDQUFDLFdBQVcsRUFBRTtRQUNoQixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxrRUFBa0UsQ0FBQyxDQUFDO1FBRXpGLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUM7S0FDM0I7SUFFRCxNQUFNLEVBQ0osV0FBVyxFQUNYLGFBQWEsRUFDYixXQUFXLEVBQ1gsb0JBQW9CLEVBQ3BCLG1CQUFtQixFQUNuQixVQUFVLEVBQ1YsZ0JBQWdCLEVBQ2hCLFFBQVEsRUFDUixNQUFNLEVBQ04sV0FBVyxHQUNaLEdBQUcsTUFBTSxJQUFBLDBCQUFnQixFQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFFMUQsK0JBQStCO0lBQy9CLElBQUksT0FBTyxDQUFDLGdCQUFnQixFQUFFO1FBQzVCLElBQUEsdUJBQWUsRUFBQyxhQUFhLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQ3BEO0lBRUQsb0NBQW9DO0lBQ3BDLElBQUk7UUFDRixNQUFNLGFBQUUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7S0FDakQ7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNWLElBQUEscUJBQWEsRUFBQyxDQUFDLENBQUMsQ0FBQztRQUNqQixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxxQ0FBcUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFeEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztLQUMzQjtJQUVELE1BQU0sQ0FBQyxXQUFXLEVBQUUsWUFBWSxDQUFDLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDO1FBQ3BELGlEQUFpRDtRQUNqRCxVQUFVLENBQ1IsYUFBYSxFQUNiLFdBQVcsRUFDWCxXQUFXLEVBQ1gsT0FBTyxFQUNQLG1CQUFtQixFQUNuQixnQkFBZ0IsRUFDaEIsUUFBUSxDQUNUO1FBQ0QsbURBQW1EO1FBQ25ELHVCQUF1QixDQUNyQixhQUFhLEVBQ2IsV0FBVyxFQUNYLE9BQU8sRUFDUCxtQkFBbUIsRUFDbkIsZ0JBQWdCLENBQ2pCO0tBQ0YsQ0FBQyxDQUFDO0lBRUgsd0RBQXdEO0lBQ3hELE1BQU0sSUFBQSxxQkFBVyxFQUFDLE9BQU8sRUFBRTtRQUN6QixNQUFNLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDO1FBQ3ZELFFBQVEsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLFFBQVEsRUFBRSxHQUFHLFlBQVksQ0FBQyxRQUFRLENBQUM7S0FDOUQsQ0FBQyxDQUFDO0lBRUgsNkVBQTZFO0lBQzdFLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO1FBQ3pELE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUM7S0FDM0I7SUFFRCwyQ0FBMkM7SUFDM0MsTUFBTSxZQUFZLEdBQWUsRUFBRSxDQUFDO0lBQ3BDLE1BQU0sV0FBVyxHQUFpQixFQUFFLENBQUM7SUFDckMsS0FBSyxNQUFNLFVBQVUsSUFBSSxXQUFXLENBQUMsV0FBVyxFQUFFO1FBQ2hELHVHQUF1RztRQUN2RyxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2RSxNQUFNLFVBQVUsR0FBRyxNQUFBLE1BQUEsV0FBVyxDQUFDLFFBQVEsMENBQUUsT0FBTyxDQUFDLGdCQUFnQixDQUFDLDBDQUFFLFVBQVUsQ0FBQztRQUUvRSxVQUFVLENBQUMsSUFBSSxHQUFHLGdCQUFnQixDQUFDO1FBRW5DLElBQUksVUFBVSxFQUFFO1lBQ2QsZ0RBQWdEO1lBQ2hELFlBQVksQ0FBQyxJQUFJLENBQUM7Z0JBQ2hCLElBQUksRUFBRSxVQUFVLENBQUMsSUFBSTtnQkFDckIsSUFBSSxFQUFFLE1BQUEsb0JBQW9CLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxtQ0FBSSxFQUFFO2dCQUNoRCxTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO2FBQ3pDLENBQUMsQ0FBQztTQUNKO1FBQ0QsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztLQUM5QjtJQUVELHNDQUFzQztJQUN0QyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQzlDLFlBQVksQ0FBQyxJQUFJLENBQUMsR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDLENBQUM7SUFFaEQsc0RBQXNEO0lBQ3RELElBQUksWUFBWSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7UUFDOUIsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztLQUMzQjtJQUVELDJCQUEyQjtJQUMzQixJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUU7UUFDakIsTUFBTSxXQUFXLEdBQUcsSUFBQSx3Q0FBbUIsRUFBQztZQUN0QyxPQUFPLEVBQUUsTUFBQSxPQUFPLENBQUMsT0FBTyxtQ0FBSSxFQUFFO1lBQzlCLE1BQU0sRUFBRSxNQUFBLE9BQU8sQ0FBQyxNQUFNLG1DQUFJLEVBQUU7U0FDN0IsQ0FBQyxDQUFDO1FBRUgsNEVBQTRFO1FBQzVFLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSx5Q0FBa0IsQ0FBQztZQUNoRCxTQUFTLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLElBQUEsMENBQWlCLEVBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzdFLFdBQVc7WUFDWCxHQUFHLEVBQUUsT0FBTyxDQUFDLG9CQUFvQjtZQUNqQyxZQUFZLEVBQUUsbUJBQW1CO1lBQ2pDLFdBQVcsRUFBRSxPQUFPLENBQUMsV0FBVztTQUNqQyxDQUFDLENBQUM7UUFFSCw4REFBOEQ7UUFDOUQsTUFBTSxpQkFBaUIsR0FBRyxHQUFHLENBQUM7UUFDOUIsa0JBQWtCLENBQUMsU0FBUyxHQUFHLEtBQUssV0FBVyxRQUFnQjtZQUM3RCxxQ0FBcUM7WUFDckMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLGlCQUFpQixFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ3BFLE1BQU0sSUFBSSxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssZ0JBQWdCLENBQUMsQ0FBQztZQUN4RSxJQUFJLElBQUksRUFBRTtnQkFDUixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUM7YUFDbEI7WUFFRCxNQUFNLElBQUksS0FBSyxDQUFDLCtCQUErQixJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3pELENBQUMsQ0FBQztRQUVGLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sa0JBQWtCLENBQUMsT0FBTyxDQUFDO1lBQ3JFLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUTtZQUMxQixJQUFJLEVBQUUsU0FBUztZQUNmLFVBQVUsRUFBRSxpQkFBaUI7WUFDN0IsS0FBSyxFQUFFLFlBQVk7U0FDcEIsQ0FBQyxDQUFDO1FBRUgsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLEVBQUU7WUFDMUIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDN0I7UUFDRCxLQUFLLE1BQU0sT0FBTyxJQUFJLFFBQVEsRUFBRTtZQUM5QixPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztTQUM5QjtRQUVELFdBQVcsQ0FBQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBQSwyQ0FBa0IsRUFBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztLQUN4RjtJQUVELGNBQWM7SUFDZCxJQUFJLE1BQU0sRUFBRTtRQUNWLE1BQU0sSUFBQSx3QkFBVSxFQUFDLE1BQU0sRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDO0tBQ3ZEO0lBRUQscUJBQXFCO0lBQ3JCLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FDZixXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxhQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FDekYsQ0FBQztJQUVGLHNEQUFzRDtJQUN0RCxnR0FBZ0c7SUFDaEcsSUFBSSxPQUFPLENBQUMsYUFBYSxFQUFFO1FBQ3pCLElBQUk7WUFDRixNQUFNLElBQUEsNENBQTJCLEVBQy9CLFdBQVcsRUFDWCxhQUFhLEVBQ2IsVUFBVSxFQUNWLE9BQU8sQ0FBQyxRQUFRLElBQUksR0FBRyxFQUN2QixPQUFPLENBQUMsY0FBYyxDQUN2QixDQUFDO1NBQ0g7UUFBQyxPQUFPLEtBQUssRUFBRTtZQUNkLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsQ0FBQztZQUUxRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO1NBQzNCO0tBQ0Y7SUFFRCxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLFNBQVMsQ0FBQyxHQUFHLElBQUksV0FBVyxDQUFDLENBQUM7SUFFOUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQztBQUMzQixDQUFDO0FBak1ELGtEQWlNQztBQUVELFNBQVMsd0JBQXdCLENBQUMsSUFBWSxFQUFFLElBQVk7SUFDMUQsT0FBTztRQUNMLElBQUk7UUFDSixJQUFJO1FBQ0osSUFBSSxRQUFRO1lBQ1YsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDekMsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBRUQsS0FBSyxVQUFVLFVBQVUsQ0FDdkIsYUFBcUIsRUFDckIsV0FBbUMsRUFDbkMsV0FBK0MsRUFDL0MsT0FBOEIsRUFDOUIsbUJBQWtELEVBQ2xELGdCQUFnQyxFQUNoQyxRQUFnQjs7SUFFaEIsT0FBTyxJQUFBLGdCQUFNLEVBQUM7UUFDWixhQUFhLEVBQUUsYUFBYTtRQUM1QixNQUFNLEVBQUUsSUFBSTtRQUNaLE1BQU0sRUFBRSxLQUFLO1FBQ2IsV0FBVztRQUNYLFVBQVUsRUFBRSxXQUFXLENBQUMsT0FBTztRQUMvQixVQUFVLEVBQUUsV0FBVyxDQUFDLEtBQUs7UUFDN0IsTUFBTSxFQUFFLFFBQVE7UUFDaEIsU0FBUyxFQUFFO1lBQ1Qsc0ZBQXNGO1lBQ3RGLGdFQUFnRTtZQUNoRSxhQUFhLEVBQUUsS0FBSztZQUNwQiwyRkFBMkY7WUFDM0YsNEZBQTRGO1lBQzVGLHVGQUF1RjtZQUN2RixpRUFBaUU7WUFDakUsNEZBQTRGO1lBQzVGLGlCQUFpQixFQUFFLEtBQUs7WUFDeEIsV0FBVyxFQUFFLEtBQUs7U0FDbkI7UUFDRCxVQUFVLEVBQUUsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUM7UUFDbkQsVUFBVSxFQUFFLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7UUFDMUMsaUJBQWlCLEVBQUUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUM7UUFDakQsUUFBUSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsUUFBUTtRQUM5QyxRQUFRLEVBQUUsSUFBSTtRQUNkLE1BQU0sRUFBRSxtQkFBbUIsQ0FBQyxPQUFPO1FBQ25DLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQztRQUNwQixNQUFNLEVBQUUsYUFBYTtRQUNyQixTQUFTLEVBQUUsZ0JBQWdCLENBQUMsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUNwRixTQUFTLEVBQUUsSUFBSTtRQUNmLFFBQVE7UUFDUixRQUFRLEVBQUUsT0FBTyxDQUFDLG9CQUFvQjtRQUN0QyxLQUFLLEVBQUUsS0FBSztRQUNaLFFBQVEsRUFBRSxTQUFTO1FBQ25CLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxnQkFBZ0I7UUFDMUMsT0FBTyxFQUFFO1lBQ1AsSUFBQSxzQ0FBb0I7WUFDbEIsZ0JBQWdCO1lBQ2hCO2dCQUNFLFNBQVMsRUFBRSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsT0FBTztnQkFDckMsb0JBQW9CLEVBQUUsZ0JBQWdCLENBQUMsTUFBTTtnQkFDN0MsUUFBUTtnQkFDUixxQkFBcUIsRUFBRSxPQUFPLENBQUMsY0FBYzthQUM5QztZQUNELCtCQUErQjtZQUMvQjtnQkFDRSxhQUFhO2dCQUNiLFlBQVksRUFBRSxDQUFDLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLE1BQU07Z0JBQ2pELFNBQVM7Z0JBQ1AsK0VBQStFO2dCQUMvRSxtRkFBbUY7Z0JBQ25GLDJCQUEyQjtnQkFDM0IsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7Z0JBQzNFLFdBQVc7Z0JBQ1gsWUFBWSxFQUFFLE1BQUEsT0FBTyxDQUFDLHdCQUF3QiwwQ0FBRSxZQUFZO2dCQUM1RCxvQkFBb0IsRUFBRSxPQUFPLENBQUMsb0JBQW9CO2FBQ25ELENBQ0Y7U0FDRjtRQUNELE1BQU0sRUFBRTtZQUNOLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDdkUsV0FBVyxFQUFFLE9BQU87U0FDckI7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsS0FBSyxVQUFVLHVCQUF1QixDQUNwQyxhQUFxQixFQUNyQixXQUErQyxFQUMvQyxPQUE4QixFQUM5QixtQkFBa0QsRUFDbEQsZ0JBQWdDOztJQUVoQyxNQUFNLFdBQVcsR0FBaUIsRUFBRSxDQUFDO0lBQ3JDLE1BQU0sWUFBWSxHQUFlLEVBQUUsQ0FBQztJQUNwQyxNQUFNLE1BQU0sR0FBYyxFQUFFLENBQUM7SUFDN0IsTUFBTSxRQUFRLEdBQWMsRUFBRSxDQUFDO0lBRS9CLDBFQUEwRTtJQUMxRSxNQUFNLEVBQUUsV0FBVyxFQUFFLHFCQUFxQixFQUFFLGFBQWEsRUFBRSxHQUFHLElBQUEsNkJBQW1CLEVBQy9FLE9BQU8sQ0FBQyxNQUFNLElBQUksRUFBRSxFQUNwQixhQUFhO0lBQ2IsaUZBQWlGO0lBQ2pGLElBQUk7SUFDSix5RUFBeUU7SUFDekUsSUFBSSxDQUNMLENBQUM7SUFFRixLQUFLLE1BQU0sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFO1FBQ2pFLE1BQU0sZ0JBQWdCLEdBQUcsS0FBSzthQUMzQixHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFlBQVksSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQzthQUN2RCxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDZCxNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUEsa0NBQW9CLEVBQzVDLGdCQUFnQixFQUNoQixFQUFFLFdBQVcsRUFBRSx3QkFBd0IsSUFBSSxFQUFFLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRSxFQUMzRTtZQUNFLGFBQWE7WUFDYixZQUFZLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxNQUFNO1lBQ2pELFNBQVMsRUFBRSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUNyRixXQUFXLEVBQUUsYUFBYSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXO1lBQ3RGLFlBQVksRUFBRSxNQUFBLE9BQU8sQ0FBQyx3QkFBd0IsMENBQUUsWUFBWTtZQUM1RCxnQkFBZ0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCO1lBQzFDLG9CQUFvQixFQUFFLE9BQU8sQ0FBQyxvQkFBb0I7U0FDbkQsQ0FDRixDQUFDO1FBRUYsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNuQyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRXZDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFO1lBQ3JCLG1DQUFtQztZQUNuQyxNQUFNLENBQUMsRUFBRSxDQUNQLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUN6QixxQ0FBcUMsSUFBSSwwQkFBMEIsQ0FDcEUsQ0FBQztZQUVGLFNBQVM7U0FDVjtRQUVELGtGQUFrRjtRQUNsRixvRkFBb0Y7UUFDcEYsNkNBQTZDO1FBQzdDLE1BQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMxRCxJQUFJLGFBQWEsR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDO1FBQ3pDLElBQUksV0FBVyxDQUFDLEdBQUcsRUFBRTtZQUNuQixXQUFXLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLFNBQVMsR0FBRyxNQUFNLEVBQUUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDaEYsYUFBYSxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQ25DLGdDQUFnQyxFQUNoQyxvQkFBb0IsSUFBSSxVQUFVLENBQ25DLENBQUM7U0FDSDtRQUNELFdBQVcsQ0FBQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsU0FBUyxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUM7UUFFckUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDakMsWUFBWSxDQUFDLElBQUksQ0FBQztnQkFDaEIsSUFBSSxFQUFFLFNBQVM7Z0JBQ2YsSUFBSTtnQkFDSixTQUFTLEVBQUUsTUFBTTthQUNsQixDQUFDLENBQUM7U0FDSjtRQUNELFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUM7S0FDaEQ7SUFFRCxPQUFPLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLENBQUM7QUFDekQsQ0FBQztBQUVELGtCQUFlLElBQUEseUJBQWEsRUFBQyxtQkFBbUIsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB0eXBlIHsgTWVzc2FnZSwgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgcHJvbWlzZXMgYXMgZnMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgTm9ybWFsaXplZE9wdGltaXphdGlvbk9wdGlvbnMsIGRlbGV0ZU91dHB1dERpciB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IGNvcHlBc3NldHMgfSBmcm9tICcuLi8uLi91dGlscy9jb3B5LWFzc2V0cyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgRmlsZUluZm8gfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2F1Z21lbnQtaW5kZXgtaHRtbCc7XG5pbXBvcnQgeyBJbmRleEh0bWxHZW5lcmF0b3IgfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2luZGV4LWh0bWwtZ2VuZXJhdG9yJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMgfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2VydmljZS13b3JrZXInO1xuaW1wb3J0IHsgZ2V0SW5kZXhJbnB1dEZpbGUsIGdldEluZGV4T3V0cHV0RmlsZSB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgcmVzb2x2ZUdsb2JhbFN0eWxlcyB9IGZyb20gJy4uLy4uL3dlYnBhY2svY29uZmlncyc7XG5pbXBvcnQgeyBjcmVhdGVDb21waWxlclBsdWdpbiB9IGZyb20gJy4vY29tcGlsZXItcGx1Z2luJztcbmltcG9ydCB7IGJ1bmRsZSwgbG9nTWVzc2FnZXMgfSBmcm9tICcuL2VzYnVpbGQnO1xuaW1wb3J0IHsgbG9nRXhwZXJpbWVudGFsV2FybmluZ3MgfSBmcm9tICcuL2V4cGVyaW1lbnRhbC13YXJuaW5ncyc7XG5pbXBvcnQgeyBub3JtYWxpemVPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMsIFNvdXJjZU1hcENsYXNzIH0gZnJvbSAnLi9zY2hlbWEnO1xuaW1wb3J0IHsgYnVuZGxlU3R5bGVzaGVldFRleHQgfSBmcm9tICcuL3N0eWxlc2hlZXRzJztcblxuLyoqXG4gKiBNYWluIGV4ZWN1dGlvbiBmdW5jdGlvbiBmb3IgdGhlIGVzYnVpbGQtYmFzZWQgYXBwbGljYXRpb24gYnVpbGRlci5cbiAqIFRoZSBvcHRpb25zIGFyZSBjb21wYXRpYmxlIHdpdGggdGhlIFdlYnBhY2stYmFzZWQgYnVpbGRlci5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBicm93c2VyIGJ1aWxkZXIgb3B0aW9ucyB0byB1c2Ugd2hlbiBzZXR0aW5nIHVwIHRoZSBhcHBsaWNhdGlvbiBidWlsZFxuICogQHBhcmFtIGNvbnRleHQgVGhlIEFyY2hpdGVjdCBidWlsZGVyIGNvbnRleHQgb2JqZWN0XG4gKiBAcmV0dXJucyBBIHByb21pc2Ugd2l0aCB0aGUgYnVpbGRlciByZXN1bHQgb3V0cHV0XG4gKi9cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYnVpbGRFc2J1aWxkQnJvd3NlcihcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IFByb21pc2U8QnVpbGRlck91dHB1dD4ge1xuICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuXG4gIC8vIE9ubHkgQU9UIGlzIGN1cnJlbnRseSBzdXBwb3J0ZWRcbiAgaWYgKG9wdGlvbnMuYW90ICE9PSB0cnVlKSB7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoXG4gICAgICAnSklUIG1vZGUgaXMgY3VycmVudGx5IG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBleHBlcmltZW50YWwgYnVpbGRlci4gQU9UIG1vZGUgbXVzdCBiZSB1c2VkLicsXG4gICAgKTtcblxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gIH1cblxuICAvLyBJbmZvcm0gdXNlciBvZiBleHBlcmltZW50YWwgc3RhdHVzIG9mIGJ1aWxkZXIgYW5kIG9wdGlvbnNcbiAgbG9nRXhwZXJpbWVudGFsV2FybmluZ3Mob3B0aW9ucywgY29udGV4dCk7XG5cbiAgLy8gRGV0ZXJtaW5lIHByb2plY3QgbmFtZSBmcm9tIGJ1aWxkZXIgY29udGV4dCB0YXJnZXRcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGBUaGUgJ2Jyb3dzZXItZXNidWlsZCcgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldCB0byBiZSBzcGVjaWZpZWQuYCk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICB9XG5cbiAgY29uc3Qge1xuICAgIHByb2plY3RSb290LFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgZW50cnlQb2ludHMsXG4gICAgZW50cnlQb2ludE5hbWVMb29rdXAsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBvdXRwdXRQYXRoLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgYXNzZXRzLFxuICAgIG91dHB1dE5hbWVzLFxuICB9ID0gYXdhaXQgbm9ybWFsaXplT3B0aW9ucyhjb250ZXh0LCBwcm9qZWN0TmFtZSwgb3B0aW9ucyk7XG5cbiAgLy8gQ2xlYW4gb3V0cHV0IHBhdGggaWYgZW5hYmxlZFxuICBpZiAob3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoKSB7XG4gICAgZGVsZXRlT3V0cHV0RGlyKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMub3V0cHV0UGF0aCk7XG4gIH1cblxuICAvLyBDcmVhdGUgb3V0cHV0IGRpcmVjdG9yeSBpZiBuZWVkZWRcbiAgdHJ5IHtcbiAgICBhd2FpdCBmcy5ta2RpcihvdXRwdXRQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGFzc2VydElzRXJyb3IoZSk7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoJ1VuYWJsZSB0byBjcmVhdGUgb3V0cHV0IGRpcmVjdG9yeTogJyArIGUubWVzc2FnZSk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICB9XG5cbiAgY29uc3QgW2NvZGVSZXN1bHRzLCBzdHlsZVJlc3VsdHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIC8vIEV4ZWN1dGUgZXNidWlsZCB0byBidW5kbGUgdGhlIGFwcGxpY2F0aW9uIGNvZGVcbiAgICBidW5kbGVDb2RlKFxuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgIGVudHJ5UG9pbnRzLFxuICAgICAgb3V0cHV0TmFtZXMsXG4gICAgICBvcHRpb25zLFxuICAgICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgICB0c2NvbmZpZyxcbiAgICApLFxuICAgIC8vIEV4ZWN1dGUgZXNidWlsZCB0byBidW5kbGUgdGhlIGdsb2JhbCBzdHlsZXNoZWV0c1xuICAgIGJ1bmRsZUdsb2JhbFN0eWxlc2hlZXRzKFxuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgIG91dHB1dE5hbWVzLFxuICAgICAgb3B0aW9ucyxcbiAgICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgICksXG4gIF0pO1xuXG4gIC8vIExvZyBhbGwgd2FybmluZ3MgYW5kIGVycm9ycyBnZW5lcmF0ZWQgZHVyaW5nIGJ1bmRsaW5nXG4gIGF3YWl0IGxvZ01lc3NhZ2VzKGNvbnRleHQsIHtcbiAgICBlcnJvcnM6IFsuLi5jb2RlUmVzdWx0cy5lcnJvcnMsIC4uLnN0eWxlUmVzdWx0cy5lcnJvcnNdLFxuICAgIHdhcm5pbmdzOiBbLi4uY29kZVJlc3VsdHMud2FybmluZ3MsIC4uLnN0eWxlUmVzdWx0cy53YXJuaW5nc10sXG4gIH0pO1xuXG4gIC8vIFJldHVybiBpZiB0aGUgYnVuZGxpbmcgZmFpbGVkIHRvIGdlbmVyYXRlIG91dHB1dCBmaWxlcyBvciB0aGVyZSBhcmUgZXJyb3JzXG4gIGlmICghY29kZVJlc3VsdHMub3V0cHV0RmlsZXMgfHwgY29kZVJlc3VsdHMuZXJyb3JzLmxlbmd0aCkge1xuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gIH1cblxuICAvLyBTdHJ1Y3R1cmUgdGhlIGNvZGUgYnVuZGxpbmcgb3V0cHV0IGZpbGVzXG4gIGNvbnN0IGluaXRpYWxGaWxlczogRmlsZUluZm9bXSA9IFtdO1xuICBjb25zdCBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gIGZvciAoY29uc3Qgb3V0cHV0RmlsZSBvZiBjb2RlUmVzdWx0cy5vdXRwdXRGaWxlcykge1xuICAgIC8vIEVudHJpZXMgaW4gdGhlIG1ldGFmaWxlIGFyZSByZWxhdGl2ZSB0byB0aGUgYGFic1dvcmtpbmdEaXJgIG9wdGlvbiB3aGljaCBpcyBzZXQgdG8gdGhlIHdvcmtzcGFjZVJvb3RcbiAgICBjb25zdCByZWxhdGl2ZUZpbGVQYXRoID0gcGF0aC5yZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCBvdXRwdXRGaWxlLnBhdGgpO1xuICAgIGNvbnN0IGVudHJ5UG9pbnQgPSBjb2RlUmVzdWx0cy5tZXRhZmlsZT8ub3V0cHV0c1tyZWxhdGl2ZUZpbGVQYXRoXT8uZW50cnlQb2ludDtcblxuICAgIG91dHB1dEZpbGUucGF0aCA9IHJlbGF0aXZlRmlsZVBhdGg7XG5cbiAgICBpZiAoZW50cnlQb2ludCkge1xuICAgICAgLy8gQW4gZW50cnlQb2ludCB2YWx1ZSBpbmRpY2F0ZXMgYW4gaW5pdGlhbCBmaWxlXG4gICAgICBpbml0aWFsRmlsZXMucHVzaCh7XG4gICAgICAgIGZpbGU6IG91dHB1dEZpbGUucGF0aCxcbiAgICAgICAgbmFtZTogZW50cnlQb2ludE5hbWVMb29rdXAuZ2V0KGVudHJ5UG9pbnQpID8/ICcnLFxuICAgICAgICBleHRlbnNpb246IHBhdGguZXh0bmFtZShvdXRwdXRGaWxlLnBhdGgpLFxuICAgICAgfSk7XG4gICAgfVxuICAgIG91dHB1dEZpbGVzLnB1c2gob3V0cHV0RmlsZSk7XG4gIH1cblxuICAvLyBBZGQgZ2xvYmFsIHN0eWxlc2hlZXRzIG91dHB1dCBmaWxlc1xuICBvdXRwdXRGaWxlcy5wdXNoKC4uLnN0eWxlUmVzdWx0cy5vdXRwdXRGaWxlcyk7XG4gIGluaXRpYWxGaWxlcy5wdXNoKC4uLnN0eWxlUmVzdWx0cy5pbml0aWFsRmlsZXMpO1xuXG4gIC8vIFJldHVybiBpZiB0aGUgZ2xvYmFsIHN0eWxlc2hlZXQgYnVuZGxpbmcgaGFzIGVycm9yc1xuICBpZiAoc3R5bGVSZXN1bHRzLmVycm9ycy5sZW5ndGgpIHtcbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICB9XG5cbiAgLy8gR2VuZXJhdGUgaW5kZXggSFRNTCBmaWxlXG4gIGlmIChvcHRpb25zLmluZGV4KSB7XG4gICAgY29uc3QgZW50cnlwb2ludHMgPSBnZW5lcmF0ZUVudHJ5UG9pbnRzKHtcbiAgICAgIHNjcmlwdHM6IG9wdGlvbnMuc2NyaXB0cyA/PyBbXSxcbiAgICAgIHN0eWxlczogb3B0aW9ucy5zdHlsZXMgPz8gW10sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgYW4gaW5kZXggSFRNTCBnZW5lcmF0b3IgdGhhdCByZWFkcyBmcm9tIHRoZSBpbi1tZW1vcnkgb3V0cHV0IGZpbGVzXG4gICAgY29uc3QgaW5kZXhIdG1sR2VuZXJhdG9yID0gbmV3IEluZGV4SHRtbEdlbmVyYXRvcih7XG4gICAgICBpbmRleFBhdGg6IHBhdGguam9pbihjb250ZXh0LndvcmtzcGFjZVJvb3QsIGdldEluZGV4SW5wdXRGaWxlKG9wdGlvbnMuaW5kZXgpKSxcbiAgICAgIGVudHJ5cG9pbnRzLFxuICAgICAgc3JpOiBvcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgICAgb3B0aW1pemF0aW9uOiBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgICAgY3Jvc3NPcmlnaW46IG9wdGlvbnMuY3Jvc3NPcmlnaW4sXG4gICAgfSk7XG5cbiAgICAvKiogVmlydHVhbCBvdXRwdXQgcGF0aCB0byBzdXBwb3J0IHJlYWRpbmcgaW4tbWVtb3J5IGZpbGVzLiAqL1xuICAgIGNvbnN0IHZpcnR1YWxPdXRwdXRQYXRoID0gJy8nO1xuICAgIGluZGV4SHRtbEdlbmVyYXRvci5yZWFkQXNzZXQgPSBhc3luYyBmdW5jdGlvbiAoZmlsZVBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgICAvLyBSZW1vdmUgbGVhZGluZyBkaXJlY3Rvcnkgc2VwYXJhdG9yXG4gICAgICBjb25zdCByZWxhdGl2ZWZpbGVQYXRoID0gcGF0aC5yZWxhdGl2ZSh2aXJ0dWFsT3V0cHV0UGF0aCwgZmlsZVBhdGgpO1xuICAgICAgY29uc3QgZmlsZSA9IG91dHB1dEZpbGVzLmZpbmQoKGZpbGUpID0+IGZpbGUucGF0aCA9PT0gcmVsYXRpdmVmaWxlUGF0aCk7XG4gICAgICBpZiAoZmlsZSkge1xuICAgICAgICByZXR1cm4gZmlsZS50ZXh0O1xuICAgICAgfVxuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE91dHB1dCBmaWxlIGRvZXMgbm90IGV4aXN0OiAke3BhdGh9YCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHsgY29udGVudCwgd2FybmluZ3MsIGVycm9ycyB9ID0gYXdhaXQgaW5kZXhIdG1sR2VuZXJhdG9yLnByb2Nlc3Moe1xuICAgICAgYmFzZUhyZWY6IG9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICBsYW5nOiB1bmRlZmluZWQsXG4gICAgICBvdXRwdXRQYXRoOiB2aXJ0dWFsT3V0cHV0UGF0aCxcbiAgICAgIGZpbGVzOiBpbml0aWFsRmlsZXMsXG4gICAgfSk7XG5cbiAgICBmb3IgKGNvbnN0IGVycm9yIG9mIGVycm9ycykge1xuICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZXJyb3IpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHdhcm5pbmcgb2Ygd2FybmluZ3MpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4od2FybmluZyk7XG4gICAgfVxuXG4gICAgb3V0cHV0RmlsZXMucHVzaChjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQoZ2V0SW5kZXhPdXRwdXRGaWxlKG9wdGlvbnMuaW5kZXgpLCBjb250ZW50KSk7XG4gIH1cblxuICAvLyBDb3B5IGFzc2V0c1xuICBpZiAoYXNzZXRzKSB7XG4gICAgYXdhaXQgY29weUFzc2V0cyhhc3NldHMsIFtvdXRwdXRQYXRoXSwgd29ya3NwYWNlUm9vdCk7XG4gIH1cblxuICAvLyBXcml0ZSBvdXRwdXQgZmlsZXNcbiAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgb3V0cHV0RmlsZXMubWFwKChmaWxlKSA9PiBmcy53cml0ZUZpbGUocGF0aC5qb2luKG91dHB1dFBhdGgsIGZpbGUucGF0aCksIGZpbGUuY29udGVudHMpKSxcbiAgKTtcblxuICAvLyBBdWdtZW50IHRoZSBhcHBsaWNhdGlvbiB3aXRoIHNlcnZpY2Ugd29ya2VyIHN1cHBvcnRcbiAgLy8gVE9ETzogVGhpcyBzaG91bGQgZXZlbnR1YWxseSBvcGVyYXRlIG9uIHRoZSBpbi1tZW1vcnkgZmlsZXMgcHJpb3IgdG8gd3JpdGluZyB0aGUgb3V0cHV0IGZpbGVzXG4gIGlmIChvcHRpb25zLnNlcnZpY2VXb3JrZXIpIHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyKFxuICAgICAgICBwcm9qZWN0Um9vdCxcbiAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgb3V0cHV0UGF0aCxcbiAgICAgICAgb3B0aW9ucy5iYXNlSHJlZiB8fCAnLycsXG4gICAgICAgIG9wdGlvbnMubmdzd0NvbmZpZ1BhdGgsXG4gICAgICApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGAke2Vycm9yfWApO1xuXG4gICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICAgIH1cbiAgfVxuXG4gIGNvbnRleHQubG9nZ2VyLmluZm8oYENvbXBsZXRlLiBbJHsoRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSkgLyAxMDAwfSBzZWNvbmRzXWApO1xuXG4gIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHBhdGg6IHN0cmluZywgdGV4dDogc3RyaW5nKTogT3V0cHV0RmlsZSB7XG4gIHJldHVybiB7XG4gICAgcGF0aCxcbiAgICB0ZXh0LFxuICAgIGdldCBjb250ZW50cygpIHtcbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbSh0aGlzLnRleHQsICd1dGYtOCcpO1xuICAgIH0sXG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGJ1bmRsZUNvZGUoXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgZW50cnlQb2ludHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4gIG91dHB1dE5hbWVzOiB7IGJ1bmRsZXM6IHN0cmluZzsgbWVkaWE6IHN0cmluZyB9LFxuICBvcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gIG9wdGltaXphdGlvbk9wdGlvbnM6IE5vcm1hbGl6ZWRPcHRpbWl6YXRpb25PcHRpb25zLFxuICBzb3VyY2VtYXBPcHRpb25zOiBTb3VyY2VNYXBDbGFzcyxcbiAgdHNjb25maWc6IHN0cmluZyxcbikge1xuICByZXR1cm4gYnVuZGxlKHtcbiAgICBhYnNXb3JraW5nRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICBmb3JtYXQ6ICdlc20nLFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIGVudHJ5TmFtZXM6IG91dHB1dE5hbWVzLmJ1bmRsZXMsXG4gICAgYXNzZXROYW1lczogb3V0cHV0TmFtZXMubWVkaWEsXG4gICAgdGFyZ2V0OiAnZXMyMDIwJyxcbiAgICBzdXBwb3J0ZWQ6IHtcbiAgICAgIC8vIE5hdGl2ZSBhc3luYy9hd2FpdCBpcyBub3Qgc3VwcG9ydGVkIHdpdGggWm9uZS5qcy4gRGlzYWJsaW5nIHN1cHBvcnQgaGVyZSB3aWxsIGNhdXNlXG4gICAgICAvLyBlc2J1aWxkIHRvIGRvd25sZXZlbCBhc3luYy9hd2FpdCB0byBhIFpvbmUuanMgc3VwcG9ydGVkIGZvcm0uXG4gICAgICAnYXN5bmMtYXdhaXQnOiBmYWxzZSxcbiAgICAgIC8vIFpvbmUuanMgYWxzbyBkb2VzIG5vdCBzdXBwb3J0IGFzeW5jIGdlbmVyYXRvcnMgb3IgYXN5bmMgaXRlcmF0b3JzLiBIb3dldmVyLCBlc2J1aWxkIGRvZXNcbiAgICAgIC8vIG5vdCBjdXJyZW50bHkgc3VwcG9ydCBkb3dubGV2ZWxpbmcgZWl0aGVyIG9mIHRoZW0uIEluc3RlYWQgYmFiZWwgaXMgdXNlZCB3aXRoaW4gdGhlIEpTL1RTXG4gICAgICAvLyBsb2FkZXIgdG8gcGVyZm9ybSB0aGUgZG93bmxldmVsIHRyYW5zZm9ybWF0aW9uLiBUaGV5IGFyZSBib3RoIGRpc2FibGVkIGhlcmUgdG8gYWxsb3dcbiAgICAgIC8vIGVzYnVpbGQgdG8gaGFuZGxlIHRoZW0gaW4gdGhlIGZ1dHVyZSBpZiBzdXBwb3J0IGlzIGV2ZXIgYWRkZWQuXG4gICAgICAvLyBOT1RFOiBJZiBlc2J1aWxkIGFkZHMgc3VwcG9ydCBpbiB0aGUgZnV0dXJlLCB0aGUgYmFiZWwgc3VwcG9ydCBmb3IgdGhlc2UgY2FuIGJlIGRpc2FibGVkLlxuICAgICAgJ2FzeW5jLWdlbmVyYXRvcic6IGZhbHNlLFxuICAgICAgJ2Zvci1hd2FpdCc6IGZhbHNlLFxuICAgIH0sXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgIGNvbmRpdGlvbnM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdtb2R1bGUnXSxcbiAgICByZXNvbHZlRXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgIGxvZ0xldmVsOiBvcHRpb25zLnZlcmJvc2UgPyAnZGVidWcnIDogJ3NpbGVudCcsXG4gICAgbWV0YWZpbGU6IHRydWUsXG4gICAgbWluaWZ5OiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgcHVyZTogWydmb3J3YXJkUmVmJ10sXG4gICAgb3V0ZGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIHNvdXJjZW1hcDogc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICBzcGxpdHRpbmc6IHRydWUsXG4gICAgdHNjb25maWcsXG4gICAgZXh0ZXJuYWw6IG9wdGlvbnMuZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgcHJlc2VydmVTeW1saW5rczogb3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICAgICAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgICAgIHtcbiAgICAgICAgICBzb3VyY2VtYXA6ICEhc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzLFxuICAgICAgICAgIHRoaXJkUGFydHlTb3VyY2VtYXBzOiBzb3VyY2VtYXBPcHRpb25zLnZlbmRvcixcbiAgICAgICAgICB0c2NvbmZpZyxcbiAgICAgICAgICBhZHZhbmNlZE9wdGltaXphdGlvbnM6IG9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICAgIH0sXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAge1xuICAgICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgb3B0aW1pemF0aW9uOiAhIW9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLm1pbmlmeSxcbiAgICAgICAgICBzb3VyY2VtYXA6XG4gICAgICAgICAgICAvLyBIaWRkZW4gY29tcG9uZW50IHN0eWxlc2hlZXQgc291cmNlbWFwcyBhcmUgaW5hY2Nlc3NpYmxlIHdoaWNoIGlzIGVmZmVjdGl2ZWx5XG4gICAgICAgICAgICAvLyB0aGUgc2FtZSBhcyBiZWluZyBkaXNhYmxlZC4gRGlzYWJsaW5nIGhhcyB0aGUgYWR2YW50YWdlIG9mIGF2b2lkaW5nIHRoZSBvdmVyaGVhZFxuICAgICAgICAgICAgLy8gb2Ygc291cmNlbWFwIHByb2Nlc3NpbmcuXG4gICAgICAgICAgICAhIXNvdXJjZW1hcE9wdGlvbnMuc3R5bGVzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/IGZhbHNlIDogJ2lubGluZScpLFxuICAgICAgICAgIG91dHB1dE5hbWVzLFxuICAgICAgICAgIGluY2x1ZGVQYXRoczogb3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocyxcbiAgICAgICAgICBleHRlcm5hbERlcGVuZGVuY2llczogb3B0aW9ucy5leHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICAgICAgfSxcbiAgICAgICksXG4gICAgXSxcbiAgICBkZWZpbmU6IHtcbiAgICAgIC4uLihvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgPyB7ICduZ0Rldk1vZGUnOiAnZmFsc2UnIH0gOiB1bmRlZmluZWQpLFxuICAgICAgJ25nSml0TW9kZSc6ICdmYWxzZScsXG4gICAgfSxcbiAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGJ1bmRsZUdsb2JhbFN0eWxlc2hlZXRzKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIG91dHB1dE5hbWVzOiB7IGJ1bmRsZXM6IHN0cmluZzsgbWVkaWE6IHN0cmluZyB9LFxuICBvcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gIG9wdGltaXphdGlvbk9wdGlvbnM6IE5vcm1hbGl6ZWRPcHRpbWl6YXRpb25PcHRpb25zLFxuICBzb3VyY2VtYXBPcHRpb25zOiBTb3VyY2VNYXBDbGFzcyxcbikge1xuICBjb25zdCBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gIGNvbnN0IGluaXRpYWxGaWxlczogRmlsZUluZm9bXSA9IFtdO1xuICBjb25zdCBlcnJvcnM6IE1lc3NhZ2VbXSA9IFtdO1xuICBjb25zdCB3YXJuaW5nczogTWVzc2FnZVtdID0gW107XG5cbiAgLy8gcmVzb2x2ZUdsb2JhbFN0eWxlcyBpcyB0ZW1wb3JhcmlseSByZXVzZWQgZnJvbSB0aGUgV2VicGFjayBidWlsZGVyIGNvZGVcbiAgY29uc3QgeyBlbnRyeVBvaW50czogc3R5bGVzaGVldEVudHJ5cG9pbnRzLCBub0luamVjdE5hbWVzIH0gPSByZXNvbHZlR2xvYmFsU3R5bGVzKFxuICAgIG9wdGlvbnMuc3R5bGVzIHx8IFtdLFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgLy8gcHJlc2VydmVTeW1saW5rcyBpcyBhbHdheXMgdHJ1ZSBoZXJlIHRvIGFsbG93IHRoZSBidW5kbGVyIHRvIGhhbmRsZSB0aGUgb3B0aW9uXG4gICAgdHJ1ZSxcbiAgICAvLyBza2lwUmVzb2x1dGlvbiB0byBsZXZlcmFnZSB0aGUgYnVuZGxlcidzIG1vcmUgY29tcHJlaGVuc2l2ZSByZXNvbHV0aW9uXG4gICAgdHJ1ZSxcbiAgKTtcblxuICBmb3IgKGNvbnN0IFtuYW1lLCBmaWxlc10gb2YgT2JqZWN0LmVudHJpZXMoc3R5bGVzaGVldEVudHJ5cG9pbnRzKSkge1xuICAgIGNvbnN0IHZpcnR1YWxFbnRyeURhdGEgPSBmaWxlc1xuICAgICAgLm1hcCgoZmlsZSkgPT4gYEBpbXBvcnQgJyR7ZmlsZS5yZXBsYWNlKC9cXFxcL2csICcvJyl9JztgKVxuICAgICAgLmpvaW4oJ1xcbicpO1xuICAgIGNvbnN0IHNoZWV0UmVzdWx0ID0gYXdhaXQgYnVuZGxlU3R5bGVzaGVldFRleHQoXG4gICAgICB2aXJ0dWFsRW50cnlEYXRhLFxuICAgICAgeyB2aXJ0dWFsTmFtZTogYGFuZ3VsYXI6c3R5bGUvZ2xvYmFsOyR7bmFtZX1gLCByZXNvbHZlUGF0aDogd29ya3NwYWNlUm9vdCB9LFxuICAgICAge1xuICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICBvcHRpbWl6YXRpb246ICEhb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMubWluaWZ5LFxuICAgICAgICBzb3VyY2VtYXA6ICEhc291cmNlbWFwT3B0aW9ucy5zdHlsZXMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gJ2V4dGVybmFsJyA6IHRydWUpLFxuICAgICAgICBvdXRwdXROYW1lczogbm9JbmplY3ROYW1lcy5pbmNsdWRlcyhuYW1lKSA/IHsgbWVkaWE6IG91dHB1dE5hbWVzLm1lZGlhIH0gOiBvdXRwdXROYW1lcyxcbiAgICAgICAgaW5jbHVkZVBhdGhzOiBvcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucz8uaW5jbHVkZVBhdGhzLFxuICAgICAgICBwcmVzZXJ2ZVN5bWxpbmtzOiBvcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzOiBvcHRpb25zLmV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgICAgfSxcbiAgICApO1xuXG4gICAgZXJyb3JzLnB1c2goLi4uc2hlZXRSZXN1bHQuZXJyb3JzKTtcbiAgICB3YXJuaW5ncy5wdXNoKC4uLnNoZWV0UmVzdWx0Lndhcm5pbmdzKTtcblxuICAgIGlmICghc2hlZXRSZXN1bHQucGF0aCkge1xuICAgICAgLy8gRmFpbGVkIHRvIHByb2Nlc3MgdGhlIHN0eWxlc2hlZXRcbiAgICAgIGFzc2VydC5vayhcbiAgICAgICAgc2hlZXRSZXN1bHQuZXJyb3JzLmxlbmd0aCxcbiAgICAgICAgYEdsb2JhbCBzdHlsZXNoZWV0IHByb2Nlc3NpbmcgZm9yICcke25hbWV9JyBmYWlsZWQgd2l0aCBubyBlcnJvcnMuYCxcbiAgICAgICk7XG5cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFRoZSB2aXJ0dWFsIHN0eWxlc2hlZXRzIHdpbGwgYmUgbmFtZWQgYHN0ZGluYCBieSBlc2J1aWxkLiBUaGlzIG11c3QgYmUgcmVwbGFjZWRcbiAgICAvLyB3aXRoIHRoZSBhY3R1YWwgbmFtZSBvZiB0aGUgZ2xvYmFsIHN0eWxlIGFuZCB0aGUgbGVhZGluZyBkaXJlY3Rvcnkgc2VwYXJhdG9yIG11c3RcbiAgICAvLyBhbHNvIGJlIHJlbW92ZWQgdG8gbWFrZSB0aGUgcGF0aCByZWxhdGl2ZS5cbiAgICBjb25zdCBzaGVldFBhdGggPSBzaGVldFJlc3VsdC5wYXRoLnJlcGxhY2UoJ3N0ZGluJywgbmFtZSk7XG4gICAgbGV0IHNoZWV0Q29udGVudHMgPSBzaGVldFJlc3VsdC5jb250ZW50cztcbiAgICBpZiAoc2hlZXRSZXN1bHQubWFwKSB7XG4gICAgICBvdXRwdXRGaWxlcy5wdXNoKGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChzaGVldFBhdGggKyAnLm1hcCcsIHNoZWV0UmVzdWx0Lm1hcCkpO1xuICAgICAgc2hlZXRDb250ZW50cyA9IHNoZWV0Q29udGVudHMucmVwbGFjZShcbiAgICAgICAgJ3NvdXJjZU1hcHBpbmdVUkw9c3RkaW4uY3NzLm1hcCcsXG4gICAgICAgIGBzb3VyY2VNYXBwaW5nVVJMPSR7bmFtZX0uY3NzLm1hcGAsXG4gICAgICApO1xuICAgIH1cbiAgICBvdXRwdXRGaWxlcy5wdXNoKGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChzaGVldFBhdGgsIHNoZWV0Q29udGVudHMpKTtcblxuICAgIGlmICghbm9JbmplY3ROYW1lcy5pbmNsdWRlcyhuYW1lKSkge1xuICAgICAgaW5pdGlhbEZpbGVzLnB1c2goe1xuICAgICAgICBmaWxlOiBzaGVldFBhdGgsXG4gICAgICAgIG5hbWUsXG4gICAgICAgIGV4dGVuc2lvbjogJy5jc3MnLFxuICAgICAgfSk7XG4gICAgfVxuICAgIG91dHB1dEZpbGVzLnB1c2goLi4uc2hlZXRSZXN1bHQucmVzb3VyY2VGaWxlcyk7XG4gIH1cblxuICByZXR1cm4geyBvdXRwdXRGaWxlcywgaW5pdGlhbEZpbGVzLCBlcnJvcnMsIHdhcm5pbmdzIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXIoYnVpbGRFc2J1aWxkQnJvd3Nlcik7XG4iXX0=