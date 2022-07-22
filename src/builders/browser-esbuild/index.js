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
    var _a, _b, _c, _d, _e, _f, _g;
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
    const { projectRoot, workspaceRoot, mainEntryPoint, polyfillsEntryPoint, optimizationOptions, outputPath, sourcemapOptions, tsconfig, assets, outputNames, } = await (0, options_1.normalizeOptions)(context, projectName, options);
    // Clean output path if enabled
    if (options.deleteOutputPath) {
        (0, utils_1.deleteOutputDir)(workspaceRoot, options.outputPath);
    }
    // Setup bundler entry points
    const entryPoints = {
        main: mainEntryPoint,
    };
    if (polyfillsEntryPoint) {
        entryPoints['polyfills'] = polyfillsEntryPoint;
    }
    // Create reverse lookup used during index HTML generation
    const entryPointNameLookup = new Map(Object.entries(entryPoints).map(([name, filePath]) => [path.relative(workspaceRoot, filePath), name]));
    // Execute esbuild
    const result = await bundleCode(workspaceRoot, entryPoints, outputNames, options, optimizationOptions, sourcemapOptions, tsconfig);
    // Log all warnings and errors generated during bundling
    await (0, esbuild_1.logMessages)(context, result);
    // Return if the bundling failed to generate output files or there are errors
    if (!result.outputFiles || result.errors.length) {
        return { success: false };
    }
    // Structure the bundling output files
    const initialFiles = [];
    const outputFiles = [];
    for (const outputFile of result.outputFiles) {
        // Entries in the metafile are relative to the `absWorkingDir` option which is set to the workspaceRoot
        const relativeFilePath = path.relative(workspaceRoot, outputFile.path);
        const entryPoint = (_c = (_b = result.metafile) === null || _b === void 0 ? void 0 : _b.outputs[relativeFilePath]) === null || _c === void 0 ? void 0 : _c.entryPoint;
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
    // Create output directory if needed
    try {
        await fs_1.promises.mkdir(outputPath, { recursive: true });
    }
    catch (e) {
        (0, error_1.assertIsError)(e);
        context.logger.error('Unable to create output directory: ' + e.message);
        return { success: false };
    }
    // Process global stylesheets
    if (options.styles) {
        // resolveGlobalStyles is temporarily reused from the Webpack builder code
        const { entryPoints: stylesheetEntrypoints, noInjectNames } = (0, configs_1.resolveGlobalStyles)(options.styles, workspaceRoot, 
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
                includePaths: (_e = options.stylePreprocessorOptions) === null || _e === void 0 ? void 0 : _e.includePaths,
                preserveSymlinks: options.preserveSymlinks,
            });
            await (0, esbuild_1.logMessages)(context, sheetResult);
            if (!sheetResult.path) {
                // Failed to process the stylesheet
                assert.ok(sheetResult.errors.length, `Global stylesheet processing for '${name}' failed with no errors.`);
                return { success: false };
            }
            // The virtual stylesheets will be named `stdin` by esbuild. This must be replaced
            // with the actual name of the global style and the leading directory separator must
            // also be removed to make the path relative.
            const sheetPath = sheetResult.path.replace('stdin', name);
            outputFiles.push(createOutputFileFromText(sheetPath, sheetResult.contents));
            if (sheetResult.map) {
                outputFiles.push(createOutputFileFromText(sheetPath + '.map', sheetResult.map));
            }
            if (!noInjectNames.includes(name)) {
                initialFiles.push({
                    file: sheetPath,
                    name,
                    extension: '.css',
                });
            }
            outputFiles.push(...sheetResult.resourceFiles);
        }
    }
    // Generate index HTML file
    if (options.index) {
        const entrypoints = (0, package_chunk_sort_1.generateEntryPoints)({
            scripts: (_f = options.scripts) !== null && _f !== void 0 ? _f : [],
            styles: (_g = options.styles) !== null && _g !== void 0 ? _g : [],
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
            }),
        ],
        define: {
            ...(optimizationOptions.scripts ? { 'ngDevMode': 'false' } : undefined),
            'ngJitMode': 'false',
        },
    });
}
exports.default = (0, architect_1.createBuilder)(buildEsbuildBrowser);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsK0NBQWlDO0FBRWpDLDJCQUFvQztBQUNwQywyQ0FBNkI7QUFDN0IsdUNBQTZFO0FBQzdFLHlEQUFxRDtBQUNyRCw2Q0FBa0Q7QUFFbEQsc0ZBQWlGO0FBQ2pGLHVFQUFxRTtBQUNyRSwrREFBeUU7QUFDekUsK0VBQTJGO0FBQzNGLG1EQUE0RDtBQUM1RCx1REFBeUQ7QUFDekQsdUNBQWdEO0FBQ2hELG1FQUFrRTtBQUNsRSx1Q0FBNkM7QUFFN0MsK0NBQXFEO0FBRXJEOzs7Ozs7R0FNRztBQUNILGtEQUFrRDtBQUMzQyxLQUFLLFVBQVUsbUJBQW1CLENBQ3ZDLE9BQThCLEVBQzlCLE9BQXVCOztJQUV2QixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFN0Isa0NBQWtDO0lBQ2xDLElBQUksT0FBTyxDQUFDLEdBQUcsS0FBSyxJQUFJLEVBQUU7UUFDeEIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQ2xCLDBGQUEwRixDQUMzRixDQUFDO1FBRUYsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztLQUMzQjtJQUVELDREQUE0RDtJQUM1RCxJQUFBLCtDQUF1QixFQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztJQUUxQyxxREFBcUQ7SUFDckQsTUFBTSxXQUFXLEdBQUcsTUFBQSxPQUFPLENBQUMsTUFBTSwwQ0FBRSxPQUFPLENBQUM7SUFDNUMsSUFBSSxDQUFDLFdBQVcsRUFBRTtRQUNoQixPQUFPLENBQUMsTUFB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TTtnQkFDakQsU0FBUztnQkFDUCwrRUFBK0U7Z0JBQy9FLG1GQUFtRjtnQkFDbkYsMkJBQTJCO2dCQUMzQixDQUFDLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztnQkFDM0UsV0FBVztnQkFDWCxZQUFZLEVBQUUsTUFBQSxPQUFPLENBQUMsd0JBQXdCLDBDQUFFLFlBQVk7YUFDN0QsQ0FDRjtTQUNGO1FBQ0QsTUFBTSxFQUFFO1lBQ04sR0FBRyxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUN2RSxXQUFXLEVBQUUsT0FBTztTQUNyQjtLQUNGLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxrQkFBZSxJQUFBLHlCQUFhLEVBQUMsbUJBQW1CLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlciB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0ICogYXMgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgdHlwZSB7IE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IHByb21pc2VzIGFzIGZzIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRPcHRpbWl6YXRpb25PcHRpb25zLCBkZWxldGVPdXRwdXREaXIgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBjb3B5QXNzZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29weS1hc3NldHMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNFcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9yJztcbmltcG9ydCB7IEZpbGVJbmZvIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9hdWdtZW50LWluZGV4LWh0bWwnO1xuaW1wb3J0IHsgSW5kZXhIdG1sR2VuZXJhdG9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBnZW5lcmF0ZUVudHJ5UG9pbnRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGFja2FnZS1jaHVuay1zb3J0JztcbmltcG9ydCB7IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlciB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IGdldEluZGV4SW5wdXRGaWxlLCBnZXRJbmRleE91dHB1dEZpbGUgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IHJlc29sdmVHbG9iYWxTdHlsZXMgfSBmcm9tICcuLi8uLi93ZWJwYWNrL2NvbmZpZ3MnO1xuaW1wb3J0IHsgY3JlYXRlQ29tcGlsZXJQbHVnaW4gfSBmcm9tICcuL2NvbXBpbGVyLXBsdWdpbic7XG5pbXBvcnQgeyBidW5kbGUsIGxvZ01lc3NhZ2VzIH0gZnJvbSAnLi9lc2J1aWxkJztcbmltcG9ydCB7IGxvZ0V4cGVyaW1lbnRhbFdhcm5pbmdzIH0gZnJvbSAnLi9leHBlcmltZW50YWwtd2FybmluZ3MnO1xuaW1wb3J0IHsgbm9ybWFsaXplT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zLCBTb3VyY2VNYXBDbGFzcyB9IGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB7IGJ1bmRsZVN0eWxlc2hlZXRUZXh0IH0gZnJvbSAnLi9zdHlsZXNoZWV0cyc7XG5cbi8qKlxuICogTWFpbiBleGVjdXRpb24gZnVuY3Rpb24gZm9yIHRoZSBlc2J1aWxkLWJhc2VkIGFwcGxpY2F0aW9uIGJ1aWxkZXIuXG4gKiBUaGUgb3B0aW9ucyBhcmUgY29tcGF0aWJsZSB3aXRoIHRoZSBXZWJwYWNrLWJhc2VkIGJ1aWxkZXIuXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgYnJvd3NlciBidWlsZGVyIG9wdGlvbnMgdG8gdXNlIHdoZW4gc2V0dGluZyB1cCB0aGUgYXBwbGljYXRpb24gYnVpbGRcbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBBcmNoaXRlY3QgYnVpbGRlciBjb250ZXh0IG9iamVjdFxuICogQHJldHVybnMgQSBwcm9taXNlIHdpdGggdGhlIGJ1aWxkZXIgcmVzdWx0IG91dHB1dFxuICovXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGJ1aWxkRXNidWlsZEJyb3dzZXIoXG4gIG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcblxuICAvLyBPbmx5IEFPVCBpcyBjdXJyZW50bHkgc3VwcG9ydGVkXG4gIGlmIChvcHRpb25zLmFvdCAhPT0gdHJ1ZSkge1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKFxuICAgICAgJ0pJVCBtb2RlIGlzIGN1cnJlbnRseSBub3Qgc3VwcG9ydGVkIGJ5IHRoaXMgZXhwZXJpbWVudGFsIGJ1aWxkZXIuIEFPVCBtb2RlIG11c3QgYmUgdXNlZC4nLFxuICAgICk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICB9XG5cbiAgLy8gSW5mb3JtIHVzZXIgb2YgZXhwZXJpbWVudGFsIHN0YXR1cyBvZiBidWlsZGVyIGFuZCBvcHRpb25zXG4gIGxvZ0V4cGVyaW1lbnRhbFdhcm5pbmdzKG9wdGlvbnMsIGNvbnRleHQpO1xuXG4gIC8vIERldGVybWluZSBwcm9qZWN0IG5hbWUgZnJvbSBidWlsZGVyIGNvbnRleHQgdGFyZ2V0XG4gIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQ/LnByb2plY3Q7XG4gIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihgVGhlICdicm93c2VyLWVzYnVpbGQnIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQgdG8gYmUgc3BlY2lmaWVkLmApO1xuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgfVxuXG4gIGNvbnN0IHtcbiAgICBwcm9qZWN0Um9vdCxcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG1haW5FbnRyeVBvaW50LFxuICAgIHBvbHlmaWxsc0VudHJ5UG9pbnQsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBvdXRwdXRQYXRoLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgYXNzZXRzLFxuICAgIG91dHB1dE5hbWVzLFxuICB9ID0gYXdhaXQgbm9ybWFsaXplT3B0aW9ucyhjb250ZXh0LCBwcm9qZWN0TmFtZSwgb3B0aW9ucyk7XG5cbiAgLy8gQ2xlYW4gb3V0cHV0IHBhdGggaWYgZW5hYmxlZFxuICBpZiAob3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoKSB7XG4gICAgZGVsZXRlT3V0cHV0RGlyKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMub3V0cHV0UGF0aCk7XG4gIH1cblxuICAvLyBTZXR1cCBidW5kbGVyIGVudHJ5IHBvaW50c1xuICBjb25zdCBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICBtYWluOiBtYWluRW50cnlQb2ludCxcbiAgfTtcbiAgaWYgKHBvbHlmaWxsc0VudHJ5UG9pbnQpIHtcbiAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10gPSBwb2x5ZmlsbHNFbnRyeVBvaW50O1xuICB9XG4gIC8vIENyZWF0ZSByZXZlcnNlIGxvb2t1cCB1c2VkIGR1cmluZyBpbmRleCBIVE1MIGdlbmVyYXRpb25cbiAgY29uc3QgZW50cnlQb2ludE5hbWVMb29rdXA6IFJlYWRvbmx5TWFwPHN0cmluZywgc3RyaW5nPiA9IG5ldyBNYXAoXG4gICAgT2JqZWN0LmVudHJpZXMoZW50cnlQb2ludHMpLm1hcChcbiAgICAgIChbbmFtZSwgZmlsZVBhdGhdKSA9PiBbcGF0aC5yZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCBmaWxlUGF0aCksIG5hbWVdIGFzIGNvbnN0LFxuICAgICksXG4gICk7XG5cbiAgLy8gRXhlY3V0ZSBlc2J1aWxkXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJ1bmRsZUNvZGUoXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBvcHRpb25zLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB0c2NvbmZpZyxcbiAgKTtcblxuICAvLyBMb2cgYWxsIHdhcm5pbmdzIGFuZCBlcnJvcnMgZ2VuZXJhdGVkIGR1cmluZyBidW5kbGluZ1xuICBhd2FpdCBsb2dNZXNzYWdlcyhjb250ZXh0LCByZXN1bHQpO1xuXG4gIC8vIFJldHVybiBpZiB0aGUgYnVuZGxpbmcgZmFpbGVkIHRvIGdlbmVyYXRlIG91dHB1dCBmaWxlcyBvciB0aGVyZSBhcmUgZXJyb3JzXG4gIGlmICghcmVzdWx0Lm91dHB1dEZpbGVzIHx8IHJlc3VsdC5lcnJvcnMubGVuZ3RoKSB7XG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgfVxuXG4gIC8vIFN0cnVjdHVyZSB0aGUgYnVuZGxpbmcgb3V0cHV0IGZpbGVzXG4gIGNvbnN0IGluaXRpYWxGaWxlczogRmlsZUluZm9bXSA9IFtdO1xuICBjb25zdCBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gIGZvciAoY29uc3Qgb3V0cHV0RmlsZSBvZiByZXN1bHQub3V0cHV0RmlsZXMpIHtcbiAgICAvLyBFbnRyaWVzIGluIHRoZSBtZXRhZmlsZSBhcmUgcmVsYXRpdmUgdG8gdGhlIGBhYnNXb3JraW5nRGlyYCBvcHRpb24gd2hpY2ggaXMgc2V0IHRvIHRoZSB3b3Jrc3BhY2VSb290XG4gICAgY29uc3QgcmVsYXRpdmVGaWxlUGF0aCA9IHBhdGgucmVsYXRpdmUod29ya3NwYWNlUm9vdCwgb3V0cHV0RmlsZS5wYXRoKTtcbiAgICBjb25zdCBlbnRyeVBvaW50ID0gcmVzdWx0Lm1ldGFmaWxlPy5vdXRwdXRzW3JlbGF0aXZlRmlsZVBhdGhdPy5lbnRyeVBvaW50O1xuXG4gICAgb3V0cHV0RmlsZS5wYXRoID0gcmVsYXRpdmVGaWxlUGF0aDtcblxuICAgIGlmIChlbnRyeVBvaW50KSB7XG4gICAgICAvLyBBbiBlbnRyeVBvaW50IHZhbHVlIGluZGljYXRlcyBhbiBpbml0aWFsIGZpbGVcbiAgICAgIGluaXRpYWxGaWxlcy5wdXNoKHtcbiAgICAgICAgZmlsZTogb3V0cHV0RmlsZS5wYXRoLFxuICAgICAgICBuYW1lOiBlbnRyeVBvaW50TmFtZUxvb2t1cC5nZXQoZW50cnlQb2ludCkgPz8gJycsXG4gICAgICAgIGV4dGVuc2lvbjogcGF0aC5leHRuYW1lKG91dHB1dEZpbGUucGF0aCksXG4gICAgICB9KTtcbiAgICB9XG4gICAgb3V0cHV0RmlsZXMucHVzaChvdXRwdXRGaWxlKTtcbiAgfVxuXG4gIC8vIENyZWF0ZSBvdXRwdXQgZGlyZWN0b3J5IGlmIG5lZWRlZFxuICB0cnkge1xuICAgIGF3YWl0IGZzLm1rZGlyKG91dHB1dFBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgYXNzZXJ0SXNFcnJvcihlKTtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcignVW5hYmxlIHRvIGNyZWF0ZSBvdXRwdXQgZGlyZWN0b3J5OiAnICsgZS5tZXNzYWdlKTtcblxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gIH1cblxuICAvLyBQcm9jZXNzIGdsb2JhbCBzdHlsZXNoZWV0c1xuICBpZiAob3B0aW9ucy5zdHlsZXMpIHtcbiAgICAvLyByZXNvbHZlR2xvYmFsU3R5bGVzIGlzIHRlbXBvcmFyaWx5IHJldXNlZCBmcm9tIHRoZSBXZWJwYWNrIGJ1aWxkZXIgY29kZVxuICAgIGNvbnN0IHsgZW50cnlQb2ludHM6IHN0eWxlc2hlZXRFbnRyeXBvaW50cywgbm9JbmplY3ROYW1lcyB9ID0gcmVzb2x2ZUdsb2JhbFN0eWxlcyhcbiAgICAgIG9wdGlvbnMuc3R5bGVzLFxuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgIC8vIHByZXNlcnZlU3ltbGlua3MgaXMgYWx3YXlzIHRydWUgaGVyZSB0byBhbGxvdyB0aGUgYnVuZGxlciB0byBoYW5kbGUgdGhlIG9wdGlvblxuICAgICAgdHJ1ZSxcbiAgICAgIC8vIHNraXBSZXNvbHV0aW9uIHRvIGxldmVyYWdlIHRoZSBidW5kbGVyJ3MgbW9yZSBjb21wcmVoZW5zaXZlIHJlc29sdXRpb25cbiAgICAgIHRydWUsXG4gICAgKTtcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBmaWxlc10gb2YgT2JqZWN0LmVudHJpZXMoc3R5bGVzaGVldEVudHJ5cG9pbnRzKSkge1xuICAgICAgY29uc3QgdmlydHVhbEVudHJ5RGF0YSA9IGZpbGVzXG4gICAgICAgIC5tYXAoKGZpbGUpID0+IGBAaW1wb3J0ICcke2ZpbGUucmVwbGFjZSgvXFxcXC9nLCAnLycpfSc7YClcbiAgICAgICAgLmpvaW4oJ1xcbicpO1xuICAgICAgY29uc3Qgc2hlZXRSZXN1bHQgPSBhd2FpdCBidW5kbGVTdHlsZXNoZWV0VGV4dChcbiAgICAgICAgdmlydHVhbEVudHJ5RGF0YSxcbiAgICAgICAgeyB2aXJ0dWFsTmFtZTogYGFuZ3VsYXI6c3R5bGUvZ2xvYmFsOyR7bmFtZX1gLCByZXNvbHZlUGF0aDogd29ya3NwYWNlUm9vdCB9LFxuICAgICAgICB7XG4gICAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICBvcHRpbWl6YXRpb246ICEhb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMubWluaWZ5LFxuICAgICAgICAgIHNvdXJjZW1hcDogISFzb3VyY2VtYXBPcHRpb25zLnN0eWxlcyAmJiAoc291cmNlbWFwT3B0aW9ucy5oaWRkZW4gPyAnZXh0ZXJuYWwnIDogdHJ1ZSksXG4gICAgICAgICAgb3V0cHV0TmFtZXM6IG5vSW5qZWN0TmFtZXMuaW5jbHVkZXMobmFtZSkgPyB7IG1lZGlhOiBvdXRwdXROYW1lcy5tZWRpYSB9IDogb3V0cHV0TmFtZXMsXG4gICAgICAgICAgaW5jbHVkZVBhdGhzOiBvcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucz8uaW5jbHVkZVBhdGhzLFxuICAgICAgICAgIHByZXNlcnZlU3ltbGlua3M6IG9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICAgICAgfSxcbiAgICAgICk7XG5cbiAgICAgIGF3YWl0IGxvZ01lc3NhZ2VzKGNvbnRleHQsIHNoZWV0UmVzdWx0KTtcbiAgICAgIGlmICghc2hlZXRSZXN1bHQucGF0aCkge1xuICAgICAgICAvLyBGYWlsZWQgdG8gcHJvY2VzcyB0aGUgc3R5bGVzaGVldFxuICAgICAgICBhc3NlcnQub2soXG4gICAgICAgICAgc2hlZXRSZXN1bHQuZXJyb3JzLmxlbmd0aCxcbiAgICAgICAgICBgR2xvYmFsIHN0eWxlc2hlZXQgcHJvY2Vzc2luZyBmb3IgJyR7bmFtZX0nIGZhaWxlZCB3aXRoIG5vIGVycm9ycy5gLFxuICAgICAgICApO1xuXG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSB2aXJ0dWFsIHN0eWxlc2hlZXRzIHdpbGwgYmUgbmFtZWQgYHN0ZGluYCBieSBlc2J1aWxkLiBUaGlzIG11c3QgYmUgcmVwbGFjZWRcbiAgICAgIC8vIHdpdGggdGhlIGFjdHVhbCBuYW1lIG9mIHRoZSBnbG9iYWwgc3R5bGUgYW5kIHRoZSBsZWFkaW5nIGRpcmVjdG9yeSBzZXBhcmF0b3IgbXVzdFxuICAgICAgLy8gYWxzbyBiZSByZW1vdmVkIHRvIG1ha2UgdGhlIHBhdGggcmVsYXRpdmUuXG4gICAgICBjb25zdCBzaGVldFBhdGggPSBzaGVldFJlc3VsdC5wYXRoLnJlcGxhY2UoJ3N0ZGluJywgbmFtZSk7XG4gICAgICBvdXRwdXRGaWxlcy5wdXNoKGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChzaGVldFBhdGgsIHNoZWV0UmVzdWx0LmNvbnRlbnRzKSk7XG4gICAgICBpZiAoc2hlZXRSZXN1bHQubWFwKSB7XG4gICAgICAgIG91dHB1dEZpbGVzLnB1c2goY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHNoZWV0UGF0aCArICcubWFwJywgc2hlZXRSZXN1bHQubWFwKSk7XG4gICAgICB9XG4gICAgICBpZiAoIW5vSW5qZWN0TmFtZXMuaW5jbHVkZXMobmFtZSkpIHtcbiAgICAgICAgaW5pdGlhbEZpbGVzLnB1c2goe1xuICAgICAgICAgIGZpbGU6IHNoZWV0UGF0aCxcbiAgICAgICAgICBuYW1lLFxuICAgICAgICAgIGV4dGVuc2lvbjogJy5jc3MnLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIG91dHB1dEZpbGVzLnB1c2goLi4uc2hlZXRSZXN1bHQucmVzb3VyY2VGaWxlcyk7XG4gICAgfVxuICB9XG5cbiAgLy8gR2VuZXJhdGUgaW5kZXggSFRNTCBmaWxlXG4gIGlmIChvcHRpb25zLmluZGV4KSB7XG4gICAgY29uc3QgZW50cnlwb2ludHMgPSBnZW5lcmF0ZUVudHJ5UG9pbnRzKHtcbiAgICAgIHNjcmlwdHM6IG9wdGlvbnMuc2NyaXB0cyA/PyBbXSxcbiAgICAgIHN0eWxlczogb3B0aW9ucy5zdHlsZXMgPz8gW10sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgYW4gaW5kZXggSFRNTCBnZW5lcmF0b3IgdGhhdCByZWFkcyBmcm9tIHRoZSBpbi1tZW1vcnkgb3V0cHV0IGZpbGVzXG4gICAgY29uc3QgaW5kZXhIdG1sR2VuZXJhdG9yID0gbmV3IEluZGV4SHRtbEdlbmVyYXRvcih7XG4gICAgICBpbmRleFBhdGg6IHBhdGguam9pbihjb250ZXh0LndvcmtzcGFjZVJvb3QsIGdldEluZGV4SW5wdXRGaWxlKG9wdGlvbnMuaW5kZXgpKSxcbiAgICAgIGVudHJ5cG9pbnRzLFxuICAgICAgc3JpOiBvcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgICAgb3B0aW1pemF0aW9uOiBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgICAgY3Jvc3NPcmlnaW46IG9wdGlvbnMuY3Jvc3NPcmlnaW4sXG4gICAgfSk7XG5cbiAgICAvKiogVmlydHVhbCBvdXRwdXQgcGF0aCB0byBzdXBwb3J0IHJlYWRpbmcgaW4tbWVtb3J5IGZpbGVzLiAqL1xuICAgIGNvbnN0IHZpcnR1YWxPdXRwdXRQYXRoID0gJy8nO1xuICAgIGluZGV4SHRtbEdlbmVyYXRvci5yZWFkQXNzZXQgPSBhc3luYyBmdW5jdGlvbiAoZmlsZVBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgICAvLyBSZW1vdmUgbGVhZGluZyBkaXJlY3Rvcnkgc2VwYXJhdG9yXG4gICAgICBjb25zdCByZWxhdGl2ZWZpbGVQYXRoID0gcGF0aC5yZWxhdGl2ZSh2aXJ0dWFsT3V0cHV0UGF0aCwgZmlsZVBhdGgpO1xuICAgICAgY29uc3QgZmlsZSA9IG91dHB1dEZpbGVzLmZpbmQoKGZpbGUpID0+IGZpbGUucGF0aCA9PT0gcmVsYXRpdmVmaWxlUGF0aCk7XG4gICAgICBpZiAoZmlsZSkge1xuICAgICAgICByZXR1cm4gZmlsZS50ZXh0O1xuICAgICAgfVxuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE91dHB1dCBmaWxlIGRvZXMgbm90IGV4aXN0OiAke3BhdGh9YCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHsgY29udGVudCwgd2FybmluZ3MsIGVycm9ycyB9ID0gYXdhaXQgaW5kZXhIdG1sR2VuZXJhdG9yLnByb2Nlc3Moe1xuICAgICAgYmFzZUhyZWY6IG9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICBsYW5nOiB1bmRlZmluZWQsXG4gICAgICBvdXRwdXRQYXRoOiB2aXJ0dWFsT3V0cHV0UGF0aCxcbiAgICAgIGZpbGVzOiBpbml0aWFsRmlsZXMsXG4gICAgfSk7XG5cbiAgICBmb3IgKGNvbnN0IGVycm9yIG9mIGVycm9ycykge1xuICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZXJyb3IpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHdhcm5pbmcgb2Ygd2FybmluZ3MpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4od2FybmluZyk7XG4gICAgfVxuXG4gICAgb3V0cHV0RmlsZXMucHVzaChjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQoZ2V0SW5kZXhPdXRwdXRGaWxlKG9wdGlvbnMuaW5kZXgpLCBjb250ZW50KSk7XG4gIH1cblxuICAvLyBDb3B5IGFzc2V0c1xuICBpZiAoYXNzZXRzKSB7XG4gICAgYXdhaXQgY29weUFzc2V0cyhhc3NldHMsIFtvdXRwdXRQYXRoXSwgd29ya3NwYWNlUm9vdCk7XG4gIH1cblxuICAvLyBXcml0ZSBvdXRwdXQgZmlsZXNcbiAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgb3V0cHV0RmlsZXMubWFwKChmaWxlKSA9PiBmcy53cml0ZUZpbGUocGF0aC5qb2luKG91dHB1dFBhdGgsIGZpbGUucGF0aCksIGZpbGUuY29udGVudHMpKSxcbiAgKTtcblxuICAvLyBBdWdtZW50IHRoZSBhcHBsaWNhdGlvbiB3aXRoIHNlcnZpY2Ugd29ya2VyIHN1cHBvcnRcbiAgLy8gVE9ETzogVGhpcyBzaG91bGQgZXZlbnR1YWxseSBvcGVyYXRlIG9uIHRoZSBpbi1tZW1vcnkgZmlsZXMgcHJpb3IgdG8gd3JpdGluZyB0aGUgb3V0cHV0IGZpbGVzXG4gIGlmIChvcHRpb25zLnNlcnZpY2VXb3JrZXIpIHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyKFxuICAgICAgICBwcm9qZWN0Um9vdCxcbiAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgb3V0cHV0UGF0aCxcbiAgICAgICAgb3B0aW9ucy5iYXNlSHJlZiB8fCAnLycsXG4gICAgICAgIG9wdGlvbnMubmdzd0NvbmZpZ1BhdGgsXG4gICAgICApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGAke2Vycm9yfWApO1xuXG4gICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICAgIH1cbiAgfVxuXG4gIGNvbnRleHQubG9nZ2VyLmluZm8oYENvbXBsZXRlLiBbJHsoRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSkgLyAxMDAwfSBzZWNvbmRzXWApO1xuXG4gIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHBhdGg6IHN0cmluZywgdGV4dDogc3RyaW5nKTogT3V0cHV0RmlsZSB7XG4gIHJldHVybiB7XG4gICAgcGF0aCxcbiAgICB0ZXh0LFxuICAgIGdldCBjb250ZW50cygpIHtcbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbSh0aGlzLnRleHQsICd1dGYtOCcpO1xuICAgIH0sXG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGJ1bmRsZUNvZGUoXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgZW50cnlQb2ludHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4gIG91dHB1dE5hbWVzOiB7IGJ1bmRsZXM6IHN0cmluZzsgbWVkaWE6IHN0cmluZyB9LFxuICBvcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gIG9wdGltaXphdGlvbk9wdGlvbnM6IE5vcm1hbGl6ZWRPcHRpbWl6YXRpb25PcHRpb25zLFxuICBzb3VyY2VtYXBPcHRpb25zOiBTb3VyY2VNYXBDbGFzcyxcbiAgdHNjb25maWc6IHN0cmluZyxcbikge1xuICByZXR1cm4gYnVuZGxlKHtcbiAgICBhYnNXb3JraW5nRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICBmb3JtYXQ6ICdlc20nLFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIGVudHJ5TmFtZXM6IG91dHB1dE5hbWVzLmJ1bmRsZXMsXG4gICAgYXNzZXROYW1lczogb3V0cHV0TmFtZXMubWVkaWEsXG4gICAgdGFyZ2V0OiAnZXMyMDIwJyxcbiAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgY29uZGl0aW9uczogWydlczIwMjAnLCAnZXMyMDE1JywgJ21vZHVsZSddLFxuICAgIHJlc29sdmVFeHRlbnNpb25zOiBbJy50cycsICcudHN4JywgJy5tanMnLCAnLmpzJ10sXG4gICAgbG9nTGV2ZWw6IG9wdGlvbnMudmVyYm9zZSA/ICdkZWJ1ZycgOiAnc2lsZW50JyxcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBtaW5pZnk6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBwdXJlOiBbJ2ZvcndhcmRSZWYnXSxcbiAgICBvdXRkaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgc291cmNlbWFwOiBzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gJ2V4dGVybmFsJyA6IHRydWUpLFxuICAgIHNwbGl0dGluZzogdHJ1ZSxcbiAgICB0c2NvbmZpZyxcbiAgICBleHRlcm5hbDogb3B0aW9ucy5leHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICB3cml0ZTogZmFsc2UsXG4gICAgcGxhdGZvcm06ICdicm93c2VyJyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzOiBvcHRpb25zLnByZXNlcnZlU3ltbGlua3MsXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlQ29tcGlsZXJQbHVnaW4oXG4gICAgICAgIC8vIEpTL1RTIG9wdGlvbnNcbiAgICAgICAge1xuICAgICAgICAgIHNvdXJjZW1hcDogISFzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMsXG4gICAgICAgICAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM6IHNvdXJjZW1hcE9wdGlvbnMudmVuZG9yLFxuICAgICAgICAgIHRzY29uZmlnLFxuICAgICAgICAgIGFkdmFuY2VkT3B0aW1pemF0aW9uczogb3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgICAgfSxcbiAgICAgICAgLy8gQ29tcG9uZW50IHN0eWxlc2hlZXQgb3B0aW9uc1xuICAgICAgICB7XG4gICAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICBvcHRpbWl6YXRpb246ICEhb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMubWluaWZ5LFxuICAgICAgICAgIHNvdXJjZW1hcDpcbiAgICAgICAgICAgIC8vIEhpZGRlbiBjb21wb25lbnQgc3R5bGVzaGVldCBzb3VyY2VtYXBzIGFyZSBpbmFjY2Vzc2libGUgd2hpY2ggaXMgZWZmZWN0aXZlbHlcbiAgICAgICAgICAgIC8vIHRoZSBzYW1lIGFzIGJlaW5nIGRpc2FibGVkLiBEaXNhYmxpbmcgaGFzIHRoZSBhZHZhbnRhZ2Ugb2YgYXZvaWRpbmcgdGhlIG92ZXJoZWFkXG4gICAgICAgICAgICAvLyBvZiBzb3VyY2VtYXAgcHJvY2Vzc2luZy5cbiAgICAgICAgICAgICEhc291cmNlbWFwT3B0aW9ucy5zdHlsZXMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gZmFsc2UgOiAnaW5saW5lJyksXG4gICAgICAgICAgb3V0cHV0TmFtZXMsXG4gICAgICAgICAgaW5jbHVkZVBhdGhzOiBvcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucz8uaW5jbHVkZVBhdGhzLFxuICAgICAgICB9LFxuICAgICAgKSxcbiAgICBdLFxuICAgIGRlZmluZToge1xuICAgICAgLi4uKG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyA/IHsgJ25nRGV2TW9kZSc6ICdmYWxzZScgfSA6IHVuZGVmaW5lZCksXG4gICAgICAnbmdKaXRNb2RlJzogJ2ZhbHNlJyxcbiAgICB9LFxuICB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlQnVpbGRlcihidWlsZEVzYnVpbGRCcm93c2VyKTtcbiJdfQ==