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
const esbuild_targets_1 = require("../../utils/esbuild-targets");
const index_html_generator_1 = require("../../utils/index-file/index-html-generator");
const package_chunk_sort_1 = require("../../utils/package-chunk-sort");
const service_worker_1 = require("../../utils/service-worker");
const supported_browsers_1 = require("../../utils/supported-browsers");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const helpers_1 = require("../../webpack/utils/helpers");
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
    const target = (0, esbuild_targets_1.transformSupportedBrowsersToTargets)((0, supported_browsers_1.getSupportedBrowsers)(projectRoot, context.logger));
    const [codeResults, styleResults] = await Promise.all([
        // Execute esbuild to bundle the application code
        bundleCode(workspaceRoot, entryPoints, outputNames, options, optimizationOptions, sourcemapOptions, tsconfig, target),
        // Execute esbuild to bundle the global stylesheets
        bundleGlobalStylesheets(workspaceRoot, outputNames, options, optimizationOptions, sourcemapOptions, target),
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
async function bundleCode(workspaceRoot, entryPoints, outputNames, options, optimizationOptions, sourcemapOptions, tsconfig, target) {
    var _a;
    let fileReplacements;
    if (options.fileReplacements) {
        for (const replacement of options.fileReplacements) {
            fileReplacements !== null && fileReplacements !== void 0 ? fileReplacements : (fileReplacements = {});
            fileReplacements[path.join(workspaceRoot, replacement.replace)] = path.join(workspaceRoot, replacement.with);
        }
    }
    return (0, esbuild_1.bundle)({
        absWorkingDir: workspaceRoot,
        bundle: true,
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
                fileReplacements,
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
                target,
            }),
        ],
        define: {
            ...(optimizationOptions.scripts ? { 'ngDevMode': 'false' } : undefined),
            'ngJitMode': 'false',
        },
    });
}
async function bundleGlobalStylesheets(workspaceRoot, outputNames, options, optimizationOptions, sourcemapOptions, target) {
    var _a;
    const outputFiles = [];
    const initialFiles = [];
    const errors = [];
    const warnings = [];
    // resolveGlobalStyles is temporarily reused from the Webpack builder code
    const { entryPoints: stylesheetEntrypoints, noInjectNames } = (0, helpers_1.normalizeGlobalStyles)(options.styles || []);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsK0NBQWlDO0FBRWpDLDJCQUFvQztBQUNwQywyQ0FBNkI7QUFDN0IsdUNBQTZFO0FBQzdFLHlEQUFxRDtBQUNyRCw2Q0FBa0Q7QUFDbEQsaUVBQWtGO0FBRWxGLHNGQUFpRjtBQUNqRix1RUFBcUU7QUFDckUsK0RBQXlFO0FBQ3pFLHVFQUFzRTtBQUN0RSwrRUFBMkY7QUFDM0YseURBQW9FO0FBQ3BFLHVEQUF5RDtBQUN6RCx1Q0FBZ0Q7QUFDaEQsbUVBQWtFO0FBQ2xFLHVDQUE2QztBQUU3QywrQ0FBcUQ7QUFFckQ7Ozs7OztHQU1HO0FBQ0gsa0RBQWtEO0FBQzNDLEtBQUssVUFBVSxtQkFBbUIsQ0FDdkMsT0FBOEIsRUFDOUIsT0FBdUI7O0lBRXZCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUU3QixrQ0FBa0M7SUFDbEMsSUFBSSxPQUFPLENBQUMsR0FBRyxLQUFLLElBQUksRUFBRTtRQUN4QixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FDbEIsMEZBQTBGLENBQzNGLENBQUM7UUFFRixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO0tBQzNCO0lBRUQsNERBQTREO0lBQzVELElBQUEsK0NBQXVCLEVBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBRTFDLHFEQUFxRDtJQUNyRCxNQUFNLFdBQVcsR0FBRyxNQUFBLE9BQU8sQ0FBQyxNQUFNLDBDQUFFLE9BQU8sQ0FBQztJQUM1QyxJQUFJLENBQUMsV0FB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QUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDMUQsSUFBSSxhQUFhLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQztRQUN6QyxJQUFJLFdBQVcsQ0FBQyxHQUFHLEVBQUU7WUFDbkIsV0FBVyxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxTQUFTLEdBQUcsTUFBTSxFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ2hGLGFBQWEsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUNuQyxnQ0FBZ0MsRUFDaEMsb0JBQW9CLElBQUksVUFBVSxDQUNuQyxDQUFDO1NBQ0g7UUFDRCxXQUFXLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLFNBQVMsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDO1FBRXJFLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ2pDLFlBQVksQ0FBQyxJQUFJLENBQUM7Z0JBQ2hCLElBQUksRUFBRSxTQUFTO2dCQUNmLElBQUk7Z0JBQ0osU0FBUyxFQUFFLE1BQU07YUFDbEIsQ0FBQyxDQUFDO1NBQ0o7UUFDRCxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsV0FBVyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0tBQ2hEO0lBRUQsT0FBTyxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxDQUFDO0FBQ3pELENBQUM7QUFFRCxrQkFBZSxJQUFBLHlCQUFhLEVBQUMsbUJBQW1CLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0ICogYXMgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgdHlwZSB7IE1lc3NhZ2UsIE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IHByb21pc2VzIGFzIGZzIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRPcHRpbWl6YXRpb25PcHRpb25zLCBkZWxldGVPdXRwdXREaXIgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBjb3B5QXNzZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29weS1hc3NldHMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNFcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9yJztcbmltcG9ydCB7IHRyYW5zZm9ybVN1cHBvcnRlZEJyb3dzZXJzVG9UYXJnZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXNidWlsZC10YXJnZXRzJztcbmltcG9ydCB7IEZpbGVJbmZvIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9hdWdtZW50LWluZGV4LWh0bWwnO1xuaW1wb3J0IHsgSW5kZXhIdG1sR2VuZXJhdG9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBnZW5lcmF0ZUVudHJ5UG9pbnRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGFja2FnZS1jaHVuay1zb3J0JztcbmltcG9ydCB7IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlciB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IGdldFN1cHBvcnRlZEJyb3dzZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3VwcG9ydGVkLWJyb3dzZXJzJztcbmltcG9ydCB7IGdldEluZGV4SW5wdXRGaWxlLCBnZXRJbmRleE91dHB1dEZpbGUgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IG5vcm1hbGl6ZUdsb2JhbFN0eWxlcyB9IGZyb20gJy4uLy4uL3dlYnBhY2svdXRpbHMvaGVscGVycyc7XG5pbXBvcnQgeyBjcmVhdGVDb21waWxlclBsdWdpbiB9IGZyb20gJy4vY29tcGlsZXItcGx1Z2luJztcbmltcG9ydCB7IGJ1bmRsZSwgbG9nTWVzc2FnZXMgfSBmcm9tICcuL2VzYnVpbGQnO1xuaW1wb3J0IHsgbG9nRXhwZXJpbWVudGFsV2FybmluZ3MgfSBmcm9tICcuL2V4cGVyaW1lbnRhbC13YXJuaW5ncyc7XG5pbXBvcnQgeyBub3JtYWxpemVPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMsIFNvdXJjZU1hcENsYXNzIH0gZnJvbSAnLi9zY2hlbWEnO1xuaW1wb3J0IHsgYnVuZGxlU3R5bGVzaGVldFRleHQgfSBmcm9tICcuL3N0eWxlc2hlZXRzJztcblxuLyoqXG4gKiBNYWluIGV4ZWN1dGlvbiBmdW5jdGlvbiBmb3IgdGhlIGVzYnVpbGQtYmFzZWQgYXBwbGljYXRpb24gYnVpbGRlci5cbiAqIFRoZSBvcHRpb25zIGFyZSBjb21wYXRpYmxlIHdpdGggdGhlIFdlYnBhY2stYmFzZWQgYnVpbGRlci5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBicm93c2VyIGJ1aWxkZXIgb3B0aW9ucyB0byB1c2Ugd2hlbiBzZXR0aW5nIHVwIHRoZSBhcHBsaWNhdGlvbiBidWlsZFxuICogQHBhcmFtIGNvbnRleHQgVGhlIEFyY2hpdGVjdCBidWlsZGVyIGNvbnRleHQgb2JqZWN0XG4gKiBAcmV0dXJucyBBIHByb21pc2Ugd2l0aCB0aGUgYnVpbGRlciByZXN1bHQgb3V0cHV0XG4gKi9cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYnVpbGRFc2J1aWxkQnJvd3NlcihcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IFByb21pc2U8QnVpbGRlck91dHB1dD4ge1xuICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuXG4gIC8vIE9ubHkgQU9UIGlzIGN1cnJlbnRseSBzdXBwb3J0ZWRcbiAgaWYgKG9wdGlvbnMuYW90ICE9PSB0cnVlKSB7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoXG4gICAgICAnSklUIG1vZGUgaXMgY3VycmVudGx5IG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBleHBlcmltZW50YWwgYnVpbGRlci4gQU9UIG1vZGUgbXVzdCBiZSB1c2VkLicsXG4gICAgKTtcblxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gIH1cblxuICAvLyBJbmZvcm0gdXNlciBvZiBleHBlcmltZW50YWwgc3RhdHVzIG9mIGJ1aWxkZXIgYW5kIG9wdGlvbnNcbiAgbG9nRXhwZXJpbWVudGFsV2FybmluZ3Mob3B0aW9ucywgY29udGV4dCk7XG5cbiAgLy8gRGV0ZXJtaW5lIHByb2plY3QgbmFtZSBmcm9tIGJ1aWxkZXIgY29udGV4dCB0YXJnZXRcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGBUaGUgJ2Jyb3dzZXItZXNidWlsZCcgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldCB0byBiZSBzcGVjaWZpZWQuYCk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICB9XG5cbiAgY29uc3Qge1xuICAgIHByb2plY3RSb290LFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgZW50cnlQb2ludHMsXG4gICAgZW50cnlQb2ludE5hbWVMb29rdXAsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBvdXRwdXRQYXRoLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgYXNzZXRzLFxuICAgIG91dHB1dE5hbWVzLFxuICB9ID0gYXdhaXQgbm9ybWFsaXplT3B0aW9ucyhjb250ZXh0LCBwcm9qZWN0TmFtZSwgb3B0aW9ucyk7XG5cbiAgLy8gQ2xlYW4gb3V0cHV0IHBhdGggaWYgZW5hYmxlZFxuICBpZiAob3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoKSB7XG4gICAgZGVsZXRlT3V0cHV0RGlyKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMub3V0cHV0UGF0aCk7XG4gIH1cblxuICAvLyBDcmVhdGUgb3V0cHV0IGRpcmVjdG9yeSBpZiBuZWVkZWRcbiAgdHJ5IHtcbiAgICBhd2FpdCBmcy5ta2RpcihvdXRwdXRQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGFzc2VydElzRXJyb3IoZSk7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoJ1VuYWJsZSB0byBjcmVhdGUgb3V0cHV0IGRpcmVjdG9yeTogJyArIGUubWVzc2FnZSk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICB9XG5cbiAgY29uc3QgdGFyZ2V0ID0gdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMoXG4gICAgZ2V0U3VwcG9ydGVkQnJvd3NlcnMocHJvamVjdFJvb3QsIGNvbnRleHQubG9nZ2VyKSxcbiAgKTtcblxuICBjb25zdCBbY29kZVJlc3VsdHMsIHN0eWxlUmVzdWx0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgLy8gRXhlY3V0ZSBlc2J1aWxkIHRvIGJ1bmRsZSB0aGUgYXBwbGljYXRpb24gY29kZVxuICAgIGJ1bmRsZUNvZGUoXG4gICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgZW50cnlQb2ludHMsXG4gICAgICBvdXRwdXROYW1lcyxcbiAgICAgIG9wdGlvbnMsXG4gICAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICAgIHRzY29uZmlnLFxuICAgICAgdGFyZ2V0LFxuICAgICksXG4gICAgLy8gRXhlY3V0ZSBlc2J1aWxkIHRvIGJ1bmRsZSB0aGUgZ2xvYmFsIHN0eWxlc2hlZXRzXG4gICAgYnVuZGxlR2xvYmFsU3R5bGVzaGVldHMoXG4gICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgb3V0cHV0TmFtZXMsXG4gICAgICBvcHRpb25zLFxuICAgICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgICB0YXJnZXQsXG4gICAgKSxcbiAgXSk7XG5cbiAgLy8gTG9nIGFsbCB3YXJuaW5ncyBhbmQgZXJyb3JzIGdlbmVyYXRlZCBkdXJpbmcgYnVuZGxpbmdcbiAgYXdhaXQgbG9nTWVzc2FnZXMoY29udGV4dCwge1xuICAgIGVycm9yczogWy4uLmNvZGVSZXN1bHRzLmVycm9ycywgLi4uc3R5bGVSZXN1bHRzLmVycm9yc10sXG4gICAgd2FybmluZ3M6IFsuLi5jb2RlUmVzdWx0cy53YXJuaW5ncywgLi4uc3R5bGVSZXN1bHRzLndhcm5pbmdzXSxcbiAgfSk7XG5cbiAgLy8gUmV0dXJuIGlmIHRoZSBidW5kbGluZyBmYWlsZWQgdG8gZ2VuZXJhdGUgb3V0cHV0IGZpbGVzIG9yIHRoZXJlIGFyZSBlcnJvcnNcbiAgaWYgKCFjb2RlUmVzdWx0cy5vdXRwdXRGaWxlcyB8fCBjb2RlUmVzdWx0cy5lcnJvcnMubGVuZ3RoKSB7XG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgfVxuXG4gIC8vIFN0cnVjdHVyZSB0aGUgY29kZSBidW5kbGluZyBvdXRwdXQgZmlsZXNcbiAgY29uc3QgaW5pdGlhbEZpbGVzOiBGaWxlSW5mb1tdID0gW107XG4gIGNvbnN0IG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW10gPSBbXTtcbiAgZm9yIChjb25zdCBvdXRwdXRGaWxlIG9mIGNvZGVSZXN1bHRzLm91dHB1dEZpbGVzKSB7XG4gICAgLy8gRW50cmllcyBpbiB0aGUgbWV0YWZpbGUgYXJlIHJlbGF0aXZlIHRvIHRoZSBgYWJzV29ya2luZ0RpcmAgb3B0aW9uIHdoaWNoIGlzIHNldCB0byB0aGUgd29ya3NwYWNlUm9vdFxuICAgIGNvbnN0IHJlbGF0aXZlRmlsZVBhdGggPSBwYXRoLnJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIG91dHB1dEZpbGUucGF0aCk7XG4gICAgY29uc3QgZW50cnlQb2ludCA9IGNvZGVSZXN1bHRzLm1ldGFmaWxlPy5vdXRwdXRzW3JlbGF0aXZlRmlsZVBhdGhdPy5lbnRyeVBvaW50O1xuXG4gICAgb3V0cHV0RmlsZS5wYXRoID0gcmVsYXRpdmVGaWxlUGF0aDtcblxuICAgIGlmIChlbnRyeVBvaW50KSB7XG4gICAgICAvLyBBbiBlbnRyeVBvaW50IHZhbHVlIGluZGljYXRlcyBhbiBpbml0aWFsIGZpbGVcbiAgICAgIGluaXRpYWxGaWxlcy5wdXNoKHtcbiAgICAgICAgZmlsZTogb3V0cHV0RmlsZS5wYXRoLFxuICAgICAgICBuYW1lOiBlbnRyeVBvaW50TmFtZUxvb2t1cC5nZXQoZW50cnlQb2ludCkgPz8gJycsXG4gICAgICAgIGV4dGVuc2lvbjogcGF0aC5leHRuYW1lKG91dHB1dEZpbGUucGF0aCksXG4gICAgICB9KTtcbiAgICB9XG4gICAgb3V0cHV0RmlsZXMucHVzaChvdXRwdXRGaWxlKTtcbiAgfVxuXG4gIC8vIEFkZCBnbG9iYWwgc3R5bGVzaGVldHMgb3V0cHV0IGZpbGVzXG4gIG91dHB1dEZpbGVzLnB1c2goLi4uc3R5bGVSZXN1bHRzLm91dHB1dEZpbGVzKTtcbiAgaW5pdGlhbEZpbGVzLnB1c2goLi4uc3R5bGVSZXN1bHRzLmluaXRpYWxGaWxlcyk7XG5cbiAgLy8gUmV0dXJuIGlmIHRoZSBnbG9iYWwgc3R5bGVzaGVldCBidW5kbGluZyBoYXMgZXJyb3JzXG4gIGlmIChzdHlsZVJlc3VsdHMuZXJyb3JzLmxlbmd0aCkge1xuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gIH1cblxuICAvLyBHZW5lcmF0ZSBpbmRleCBIVE1MIGZpbGVcbiAgaWYgKG9wdGlvbnMuaW5kZXgpIHtcbiAgICBjb25zdCBlbnRyeXBvaW50cyA9IGdlbmVyYXRlRW50cnlQb2ludHMoe1xuICAgICAgc2NyaXB0czogb3B0aW9ucy5zY3JpcHRzID8/IFtdLFxuICAgICAgc3R5bGVzOiBvcHRpb25zLnN0eWxlcyA/PyBbXSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBhbiBpbmRleCBIVE1MIGdlbmVyYXRvciB0aGF0IHJlYWRzIGZyb20gdGhlIGluLW1lbW9yeSBvdXRwdXQgZmlsZXNcbiAgICBjb25zdCBpbmRleEh0bWxHZW5lcmF0b3IgPSBuZXcgSW5kZXhIdG1sR2VuZXJhdG9yKHtcbiAgICAgIGluZGV4UGF0aDogcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgZ2V0SW5kZXhJbnB1dEZpbGUob3B0aW9ucy5pbmRleCkpLFxuICAgICAgZW50cnlwb2ludHMsXG4gICAgICBzcmk6IG9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgICBvcHRpbWl6YXRpb246IG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgICBjcm9zc09yaWdpbjogb3B0aW9ucy5jcm9zc09yaWdpbixcbiAgICB9KTtcblxuICAgIC8qKiBWaXJ0dWFsIG91dHB1dCBwYXRoIHRvIHN1cHBvcnQgcmVhZGluZyBpbi1tZW1vcnkgZmlsZXMuICovXG4gICAgY29uc3QgdmlydHVhbE91dHB1dFBhdGggPSAnLyc7XG4gICAgaW5kZXhIdG1sR2VuZXJhdG9yLnJlYWRBc3NldCA9IGFzeW5jIGZ1bmN0aW9uIChmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAgIC8vIFJlbW92ZSBsZWFkaW5nIGRpcmVjdG9yeSBzZXBhcmF0b3JcbiAgICAgIGNvbnN0IHJlbGF0aXZlZmlsZVBhdGggPSBwYXRoLnJlbGF0aXZlKHZpcnR1YWxPdXRwdXRQYXRoLCBmaWxlUGF0aCk7XG4gICAgICBjb25zdCBmaWxlID0gb3V0cHV0RmlsZXMuZmluZCgoZmlsZSkgPT4gZmlsZS5wYXRoID09PSByZWxhdGl2ZWZpbGVQYXRoKTtcbiAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgIHJldHVybiBmaWxlLnRleHQ7XG4gICAgICB9XG5cbiAgICAgIHRocm93IG5ldyBFcnJvcihgT3V0cHV0IGZpbGUgZG9lcyBub3QgZXhpc3Q6ICR7cGF0aH1gKTtcbiAgICB9O1xuXG4gICAgY29uc3QgeyBjb250ZW50LCB3YXJuaW5ncywgZXJyb3JzIH0gPSBhd2FpdCBpbmRleEh0bWxHZW5lcmF0b3IucHJvY2Vzcyh7XG4gICAgICBiYXNlSHJlZjogb3B0aW9ucy5iYXNlSHJlZixcbiAgICAgIGxhbmc6IHVuZGVmaW5lZCxcbiAgICAgIG91dHB1dFBhdGg6IHZpcnR1YWxPdXRwdXRQYXRoLFxuICAgICAgZmlsZXM6IGluaXRpYWxGaWxlcyxcbiAgICB9KTtcblxuICAgIGZvciAoY29uc3QgZXJyb3Igb2YgZXJyb3JzKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihlcnJvcik7XG4gICAgfVxuICAgIGZvciAoY29uc3Qgd2FybmluZyBvZiB3YXJuaW5ncykge1xuICAgICAgY29udGV4dC5sb2dnZXIud2Fybih3YXJuaW5nKTtcbiAgICB9XG5cbiAgICBvdXRwdXRGaWxlcy5wdXNoKGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChnZXRJbmRleE91dHB1dEZpbGUob3B0aW9ucy5pbmRleCksIGNvbnRlbnQpKTtcbiAgfVxuXG4gIC8vIENvcHkgYXNzZXRzXG4gIGlmIChhc3NldHMpIHtcbiAgICBhd2FpdCBjb3B5QXNzZXRzKGFzc2V0cywgW291dHB1dFBhdGhdLCB3b3Jrc3BhY2VSb290KTtcbiAgfVxuXG4gIC8vIFdyaXRlIG91dHB1dCBmaWxlc1xuICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICBvdXRwdXRGaWxlcy5tYXAoKGZpbGUpID0+IGZzLndyaXRlRmlsZShwYXRoLmpvaW4ob3V0cHV0UGF0aCwgZmlsZS5wYXRoKSwgZmlsZS5jb250ZW50cykpLFxuICApO1xuXG4gIC8vIEF1Z21lbnQgdGhlIGFwcGxpY2F0aW9uIHdpdGggc2VydmljZSB3b3JrZXIgc3VwcG9ydFxuICAvLyBUT0RPOiBUaGlzIHNob3VsZCBldmVudHVhbGx5IG9wZXJhdGUgb24gdGhlIGluLW1lbW9yeSBmaWxlcyBwcmlvciB0byB3cml0aW5nIHRoZSBvdXRwdXQgZmlsZXNcbiAgaWYgKG9wdGlvbnMuc2VydmljZVdvcmtlcikge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIoXG4gICAgICAgIHByb2plY3RSb290LFxuICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICBvdXRwdXRQYXRoLFxuICAgICAgICBvcHRpb25zLmJhc2VIcmVmIHx8ICcvJyxcbiAgICAgICAgb3B0aW9ucy5uZ3N3Q29uZmlnUGF0aCxcbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogYCR7ZXJyb3J9YCk7XG5cbiAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gICAgfVxuICB9XG5cbiAgY29udGV4dC5sb2dnZXIuaW5mbyhgQ29tcGxldGUuIFskeyhEYXRlLm5vdygpIC0gc3RhcnRUaW1lKSAvIDEwMDB9IHNlY29uZHNdYCk7XG5cbiAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQocGF0aDogc3RyaW5nLCB0ZXh0OiBzdHJpbmcpOiBPdXRwdXRGaWxlIHtcbiAgcmV0dXJuIHtcbiAgICBwYXRoLFxuICAgIHRleHQsXG4gICAgZ2V0IGNvbnRlbnRzKCkge1xuICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKHRoaXMudGV4dCwgJ3V0Zi04Jyk7XG4gICAgfSxcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYnVuZGxlQ29kZShcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbiAgb3V0cHV0TmFtZXM6IHsgYnVuZGxlczogc3RyaW5nOyBtZWRpYTogc3RyaW5nIH0sXG4gIG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgb3B0aW1pemF0aW9uT3B0aW9uczogTm9ybWFsaXplZE9wdGltaXphdGlvbk9wdGlvbnMsXG4gIHNvdXJjZW1hcE9wdGlvbnM6IFNvdXJjZU1hcENsYXNzLFxuICB0c2NvbmZpZzogc3RyaW5nLFxuICB0YXJnZXQ6IHN0cmluZ1tdLFxuKSB7XG4gIGxldCBmaWxlUmVwbGFjZW1lbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHwgdW5kZWZpbmVkO1xuICBpZiAob3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgZm9yIChjb25zdCByZXBsYWNlbWVudCBvZiBvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpIHtcbiAgICAgIGZpbGVSZXBsYWNlbWVudHMgPz89IHt9O1xuICAgICAgZmlsZVJlcGxhY2VtZW50c1twYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgcmVwbGFjZW1lbnQucmVwbGFjZSldID0gcGF0aC5qb2luKFxuICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICByZXBsYWNlbWVudC53aXRoLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnVuZGxlKHtcbiAgICBhYnNXb3JraW5nRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICBmb3JtYXQ6ICdlc20nLFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIGVudHJ5TmFtZXM6IG91dHB1dE5hbWVzLmJ1bmRsZXMsXG4gICAgYXNzZXROYW1lczogb3V0cHV0TmFtZXMubWVkaWEsXG4gICAgdGFyZ2V0LFxuICAgIHN1cHBvcnRlZDoge1xuICAgICAgLy8gTmF0aXZlIGFzeW5jL2F3YWl0IGlzIG5vdCBzdXBwb3J0ZWQgd2l0aCBab25lLmpzLiBEaXNhYmxpbmcgc3VwcG9ydCBoZXJlIHdpbGwgY2F1c2VcbiAgICAgIC8vIGVzYnVpbGQgdG8gZG93bmxldmVsIGFzeW5jL2F3YWl0IGFuZCBmb3IgYXdhaXQuLi5vZiB0byBhIFpvbmUuanMgc3VwcG9ydGVkIGZvcm0uIEhvd2V2ZXIsIGVzYnVpbGRcbiAgICAgIC8vIGRvZXMgbm90IGN1cnJlbnRseSBzdXBwb3J0IGRvd25sZXZlbGluZyBhc3luYyBnZW5lcmF0b3JzLiBJbnN0ZWFkIGJhYmVsIGlzIHVzZWQgd2l0aGluIHRoZSBKUy9UU1xuICAgICAgLy8gbG9hZGVyIHRvIHBlcmZvcm0gdGhlIGRvd25sZXZlbCB0cmFuc2Zvcm1hdGlvbi5cbiAgICAgIC8vIE5PVEU6IElmIGVzYnVpbGQgYWRkcyBzdXBwb3J0IGluIHRoZSBmdXR1cmUsIHRoZSBiYWJlbCBzdXBwb3J0IGZvciBhc3luYyBnZW5lcmF0b3JzIGNhbiBiZSBkaXNhYmxlZC5cbiAgICAgICdhc3luYy1hd2FpdCc6IGZhbHNlLFxuICAgIH0sXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgIGNvbmRpdGlvbnM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdtb2R1bGUnXSxcbiAgICByZXNvbHZlRXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgIGxvZ0xldmVsOiBvcHRpb25zLnZlcmJvc2UgPyAnZGVidWcnIDogJ3NpbGVudCcsXG4gICAgbWV0YWZpbGU6IHRydWUsXG4gICAgbWluaWZ5OiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgcHVyZTogWydmb3J3YXJkUmVmJ10sXG4gICAgb3V0ZGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIHNvdXJjZW1hcDogc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICBzcGxpdHRpbmc6IHRydWUsXG4gICAgdHNjb25maWcsXG4gICAgZXh0ZXJuYWw6IG9wdGlvbnMuZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgcHJlc2VydmVTeW1saW5rczogb3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICAgICAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgICAgIHtcbiAgICAgICAgICBzb3VyY2VtYXA6ICEhc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzLFxuICAgICAgICAgIHRoaXJkUGFydHlTb3VyY2VtYXBzOiBzb3VyY2VtYXBPcHRpb25zLnZlbmRvcixcbiAgICAgICAgICB0c2NvbmZpZyxcbiAgICAgICAgICBhZHZhbmNlZE9wdGltaXphdGlvbnM6IG9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICAgICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gQ29tcG9uZW50IHN0eWxlc2hlZXQgb3B0aW9uc1xuICAgICAgICB7XG4gICAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICBvcHRpbWl6YXRpb246ICEhb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMubWluaWZ5LFxuICAgICAgICAgIHNvdXJjZW1hcDpcbiAgICAgICAgICAgIC8vIEhpZGRlbiBjb21wb25lbnQgc3R5bGVzaGVldCBzb3VyY2VtYXBzIGFyZSBpbmFjY2Vzc2libGUgd2hpY2ggaXMgZWZmZWN0aXZlbHlcbiAgICAgICAgICAgIC8vIHRoZSBzYW1lIGFzIGJlaW5nIGRpc2FibGVkLiBEaXNhYmxpbmcgaGFzIHRoZSBhZHZhbnRhZ2Ugb2YgYXZvaWRpbmcgdGhlIG92ZXJoZWFkXG4gICAgICAgICAgICAvLyBvZiBzb3VyY2VtYXAgcHJvY2Vzc2luZy5cbiAgICAgICAgICAgICEhc291cmNlbWFwT3B0aW9ucy5zdHlsZXMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gZmFsc2UgOiAnaW5saW5lJyksXG4gICAgICAgICAgb3V0cHV0TmFtZXMsXG4gICAgICAgICAgaW5jbHVkZVBhdGhzOiBvcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucz8uaW5jbHVkZVBhdGhzLFxuICAgICAgICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzOiBvcHRpb25zLmV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgfSxcbiAgICAgICksXG4gICAgXSxcbiAgICBkZWZpbmU6IHtcbiAgICAgIC4uLihvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgPyB7ICduZ0Rldk1vZGUnOiAnZmFsc2UnIH0gOiB1bmRlZmluZWQpLFxuICAgICAgJ25nSml0TW9kZSc6ICdmYWxzZScsXG4gICAgfSxcbiAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGJ1bmRsZUdsb2JhbFN0eWxlc2hlZXRzKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIG91dHB1dE5hbWVzOiB7IGJ1bmRsZXM6IHN0cmluZzsgbWVkaWE6IHN0cmluZyB9LFxuICBvcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gIG9wdGltaXphdGlvbk9wdGlvbnM6IE5vcm1hbGl6ZWRPcHRpbWl6YXRpb25PcHRpb25zLFxuICBzb3VyY2VtYXBPcHRpb25zOiBTb3VyY2VNYXBDbGFzcyxcbiAgdGFyZ2V0OiBzdHJpbmdbXSxcbikge1xuICBjb25zdCBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gIGNvbnN0IGluaXRpYWxGaWxlczogRmlsZUluZm9bXSA9IFtdO1xuICBjb25zdCBlcnJvcnM6IE1lc3NhZ2VbXSA9IFtdO1xuICBjb25zdCB3YXJuaW5nczogTWVzc2FnZVtdID0gW107XG5cbiAgLy8gcmVzb2x2ZUdsb2JhbFN0eWxlcyBpcyB0ZW1wb3JhcmlseSByZXVzZWQgZnJvbSB0aGUgV2VicGFjayBidWlsZGVyIGNvZGVcbiAgY29uc3QgeyBlbnRyeVBvaW50czogc3R5bGVzaGVldEVudHJ5cG9pbnRzLCBub0luamVjdE5hbWVzIH0gPSBub3JtYWxpemVHbG9iYWxTdHlsZXMoXG4gICAgb3B0aW9ucy5zdHlsZXMgfHwgW10sXG4gICk7XG5cbiAgZm9yIChjb25zdCBbbmFtZSwgZmlsZXNdIG9mIE9iamVjdC5lbnRyaWVzKHN0eWxlc2hlZXRFbnRyeXBvaW50cykpIHtcbiAgICBjb25zdCB2aXJ0dWFsRW50cnlEYXRhID0gZmlsZXNcbiAgICAgIC5tYXAoKGZpbGUpID0+IGBAaW1wb3J0ICcke2ZpbGUucmVwbGFjZSgvXFxcXC9nLCAnLycpfSc7YClcbiAgICAgIC5qb2luKCdcXG4nKTtcbiAgICBjb25zdCBzaGVldFJlc3VsdCA9IGF3YWl0IGJ1bmRsZVN0eWxlc2hlZXRUZXh0KFxuICAgICAgdmlydHVhbEVudHJ5RGF0YSxcbiAgICAgIHsgdmlydHVhbE5hbWU6IGBhbmd1bGFyOnN0eWxlL2dsb2JhbDske25hbWV9YCwgcmVzb2x2ZVBhdGg6IHdvcmtzcGFjZVJvb3QgfSxcbiAgICAgIHtcbiAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgb3B0aW1pemF0aW9uOiAhIW9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLm1pbmlmeSxcbiAgICAgICAgc291cmNlbWFwOiAhIXNvdXJjZW1hcE9wdGlvbnMuc3R5bGVzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICAgICAgb3V0cHV0TmFtZXM6IG5vSW5qZWN0TmFtZXMuaW5jbHVkZXMobmFtZSkgPyB7IG1lZGlhOiBvdXRwdXROYW1lcy5tZWRpYSB9IDogb3V0cHV0TmFtZXMsXG4gICAgICAgIGluY2x1ZGVQYXRoczogb3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocyxcbiAgICAgICAgcHJlc2VydmVTeW1saW5rczogb3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICAgICBleHRlcm5hbERlcGVuZGVuY2llczogb3B0aW9ucy5leHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICAgICAgdGFyZ2V0LFxuICAgICAgfSxcbiAgICApO1xuXG4gICAgZXJyb3JzLnB1c2goLi4uc2hlZXRSZXN1bHQuZXJyb3JzKTtcbiAgICB3YXJuaW5ncy5wdXNoKC4uLnNoZWV0UmVzdWx0Lndhcm5pbmdzKTtcblxuICAgIGlmICghc2hlZXRSZXN1bHQucGF0aCkge1xuICAgICAgLy8gRmFpbGVkIHRvIHByb2Nlc3MgdGhlIHN0eWxlc2hlZXRcbiAgICAgIGFzc2VydC5vayhcbiAgICAgICAgc2hlZXRSZXN1bHQuZXJyb3JzLmxlbmd0aCxcbiAgICAgICAgYEdsb2JhbCBzdHlsZXNoZWV0IHByb2Nlc3NpbmcgZm9yICcke25hbWV9JyBmYWlsZWQgd2l0aCBubyBlcnJvcnMuYCxcbiAgICAgICk7XG5cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFRoZSB2aXJ0dWFsIHN0eWxlc2hlZXRzIHdpbGwgYmUgbmFtZWQgYHN0ZGluYCBieSBlc2J1aWxkLiBUaGlzIG11c3QgYmUgcmVwbGFjZWRcbiAgICAvLyB3aXRoIHRoZSBhY3R1YWwgbmFtZSBvZiB0aGUgZ2xvYmFsIHN0eWxlIGFuZCB0aGUgbGVhZGluZyBkaXJlY3Rvcnkgc2VwYXJhdG9yIG11c3RcbiAgICAvLyBhbHNvIGJlIHJlbW92ZWQgdG8gbWFrZSB0aGUgcGF0aCByZWxhdGl2ZS5cbiAgICBjb25zdCBzaGVldFBhdGggPSBzaGVldFJlc3VsdC5wYXRoLnJlcGxhY2UoJ3N0ZGluJywgbmFtZSk7XG4gICAgbGV0IHNoZWV0Q29udGVudHMgPSBzaGVldFJlc3VsdC5jb250ZW50cztcbiAgICBpZiAoc2hlZXRSZXN1bHQubWFwKSB7XG4gICAgICBvdXRwdXRGaWxlcy5wdXNoKGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChzaGVldFBhdGggKyAnLm1hcCcsIHNoZWV0UmVzdWx0Lm1hcCkpO1xuICAgICAgc2hlZXRDb250ZW50cyA9IHNoZWV0Q29udGVudHMucmVwbGFjZShcbiAgICAgICAgJ3NvdXJjZU1hcHBpbmdVUkw9c3RkaW4uY3NzLm1hcCcsXG4gICAgICAgIGBzb3VyY2VNYXBwaW5nVVJMPSR7bmFtZX0uY3NzLm1hcGAsXG4gICAgICApO1xuICAgIH1cbiAgICBvdXRwdXRGaWxlcy5wdXNoKGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChzaGVldFBhdGgsIHNoZWV0Q29udGVudHMpKTtcblxuICAgIGlmICghbm9JbmplY3ROYW1lcy5pbmNsdWRlcyhuYW1lKSkge1xuICAgICAgaW5pdGlhbEZpbGVzLnB1c2goe1xuICAgICAgICBmaWxlOiBzaGVldFBhdGgsXG4gICAgICAgIG5hbWUsXG4gICAgICAgIGV4dGVuc2lvbjogJy5jc3MnLFxuICAgICAgfSk7XG4gICAgfVxuICAgIG91dHB1dEZpbGVzLnB1c2goLi4uc2hlZXRSZXN1bHQucmVzb3VyY2VGaWxlcyk7XG4gIH1cblxuICByZXR1cm4geyBvdXRwdXRGaWxlcywgaW5pdGlhbEZpbGVzLCBlcnJvcnMsIHdhcm5pbmdzIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXIoYnVpbGRFc2J1aWxkQnJvd3Nlcik7XG4iXX0=