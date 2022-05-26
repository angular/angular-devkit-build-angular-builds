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
exports.execute = void 0;
const architect_1 = require("@angular-devkit/architect");
const assert = __importStar(require("assert"));
const fs_1 = require("fs");
const path = __importStar(require("path"));
const utils_1 = require("../../utils");
const copy_assets_1 = require("../../utils/copy-assets");
const index_html_generator_1 = require("../../utils/index-file/index-html-generator");
const package_chunk_sort_1 = require("../../utils/package-chunk-sort");
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
async function execute(options, context) {
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
    const { workspaceRoot, mainEntryPoint, polyfillsEntryPoint, optimizationOptions, outputPath, sourcemapOptions, tsconfig, assets, outputNames, } = await (0, options_1.normalizeOptions)(context, projectName, options);
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
        outputFile.path = path.relative(esbuild_1.DEFAULT_OUTDIR, outputFile.path);
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
        const reason = 'message' in e ? e.message : 'Unknown error';
        context.logger.error('Unable to create output directory: ' + reason);
        return { success: false };
    }
    // Process global stylesheets
    if (options.styles) {
        // resolveGlobalStyles is temporarily reused from the Webpack builder code
        const { entryPoints: stylesheetEntrypoints, noInjectNames } = (0, configs_1.resolveGlobalStyles)(options.styles, workspaceRoot, !!options.preserveSymlinks);
        for (const [name, files] of Object.entries(stylesheetEntrypoints)) {
            const virtualEntryData = files
                .map((file) => `@import '${file.replace(/\\/g, '/')}';`)
                .join('\n');
            const sheetResult = await (0, stylesheets_1.bundleStylesheetText)(virtualEntryData, { virtualName: `angular:style/global;${name}`, resolvePath: workspaceRoot }, {
                optimization: !!optimizationOptions.styles.minify,
                sourcemap: !!sourcemapOptions.styles,
                outputNames: noInjectNames.includes(name) ? { media: outputNames.media } : outputNames,
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
    context.logger.info(`Complete. [${(Date.now() - startTime) / 1000} seconds]`);
    return { success: true };
}
exports.execute = execute;
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
        outdir: esbuild_1.DEFAULT_OUTDIR,
        sourcemap: sourcemapOptions.scripts && (sourcemapOptions.hidden ? 'external' : true),
        splitting: true,
        tsconfig,
        write: false,
        platform: 'browser',
        preserveSymlinks: options.preserveSymlinks,
        plugins: [
            (0, compiler_plugin_1.createCompilerPlugin)(
            // JS/TS options
            {
                sourcemap: !!sourcemapOptions.scripts,
                tsconfig,
                advancedOptimizations: options.buildOptimizer,
            }, 
            // Component stylesheet options
            {
                workspaceRoot,
                optimization: !!optimizationOptions.styles.minify,
                sourcemap: !!sourcemapOptions.styles,
                outputNames,
            }),
        ],
        define: {
            'ngDevMode': optimizationOptions.scripts ? 'false' : 'true',
            'ngJitMode': 'false',
        },
    });
}
exports.default = (0, architect_1.createBuilder)(execute);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsK0NBQWlDO0FBRWpDLDJCQUFvQztBQUNwQywyQ0FBNkI7QUFDN0IsdUNBQTZFO0FBQzdFLHlEQUFxRDtBQUVyRCxzRkFBaUY7QUFDakYsdUVBQXFFO0FBQ3JFLCtFQUEyRjtBQUMzRixtREFBNEQ7QUFFNUQsdURBQXlEO0FBQ3pELHVDQUFnRTtBQUNoRSxtRUFBa0U7QUFDbEUsdUNBQTZDO0FBQzdDLCtDQUFxRDtBQUVyRDs7Ozs7O0dBTUc7QUFDSCxrREFBa0Q7QUFDM0MsS0FBSyxVQUFVLE9BQU8sQ0FDM0IsT0FBOEIsRUFDOUIsT0FBdUI7O0lBRXZCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUU3QixrQ0FBa0M7SUFDbEMsSUFBSSxPQUFPLENBQUMsR0FBRyxLQUFLLElBQUksRUFBRTtRQUN4QixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FDbEIsMEZBQTBGLENBQzNGLENBQUM7UUFFRixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO0tBQzNCO0lBRUQsNERBQTREO0lBQzVELElBQUEsK0NBQXVCLEVBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBRTFDLHFEQUFxRDtJQUNyRCxNQUFNLFdBQVcsR0FBRyxNQUFBLE9BQU8sQ0FBQyxNQUFNLDBDQUFFLE9BQU8sQ0FBQztJQUM1QyxJQUFJLENBQUMsV0FBVyxFQUFFO1FBQ2hCLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGtFQUFrRSxDQUFD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QUFFLElBQUk7UUFDZixRQUFRO1FBQ1IsS0FBSyxFQUFFLEtBQUs7UUFDWixRQUFRLEVBQUUsU0FBUztRQUNuQixnQkFBZ0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCO1FBQzFDLE9BQU8sRUFBRTtZQUNQLElBQUEsc0NBQW9CO1lBQ2xCLGdCQUFnQjtZQUNoQjtnQkFDRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLE9BQU87Z0JBQ3JDLFFBQVE7Z0JBQ1IscUJBQXFCLEVBQUUsT0FBTyxDQUFDLGNBQWM7YUFDOUM7WUFDRCwrQkFBK0I7WUFDL0I7Z0JBQ0UsYUFBYTtnQkFDYixZQUFZLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxNQUFNO2dCQUNqRCxTQUFTLEVBQUUsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLE1BQU07Z0JBQ3BDLFdBQVc7YUFDWixDQUNGO1NBQ0Y7UUFDRCxNQUFNLEVBQUU7WUFDTixXQUFXLEVBQUUsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU07WUFDM0QsV0FBVyxFQUFFLE9BQU87U0FDckI7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsa0JBQWUsSUFBQSx5QkFBYSxFQUFDLE9BQU8sQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0LCBCdWlsZGVyT3V0cHV0LCBjcmVhdGVCdWlsZGVyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB0eXBlIHsgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgcHJvbWlzZXMgYXMgZnMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgTm9ybWFsaXplZE9wdGltaXphdGlvbk9wdGlvbnMsIGRlbGV0ZU91dHB1dERpciB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IGNvcHlBc3NldHMgfSBmcm9tICcuLi8uLi91dGlscy9jb3B5LWFzc2V0cyc7XG5pbXBvcnQgeyBGaWxlSW5mbyB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvYXVnbWVudC1pbmRleC1odG1sJztcbmltcG9ydCB7IEluZGV4SHRtbEdlbmVyYXRvciB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cyB9IGZyb20gJy4uLy4uL3V0aWxzL3BhY2thZ2UtY2h1bmstc29ydCc7XG5pbXBvcnQgeyBnZXRJbmRleElucHV0RmlsZSwgZ2V0SW5kZXhPdXRwdXRGaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyByZXNvbHZlR2xvYmFsU3R5bGVzIH0gZnJvbSAnLi4vLi4vd2VicGFjay9jb25maWdzJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMsIFNvdXJjZU1hcENsYXNzIH0gZnJvbSAnLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgY3JlYXRlQ29tcGlsZXJQbHVnaW4gfSBmcm9tICcuL2NvbXBpbGVyLXBsdWdpbic7XG5pbXBvcnQgeyBERUZBVUxUX09VVERJUiwgYnVuZGxlLCBsb2dNZXNzYWdlcyB9IGZyb20gJy4vZXNidWlsZCc7XG5pbXBvcnQgeyBsb2dFeHBlcmltZW50YWxXYXJuaW5ncyB9IGZyb20gJy4vZXhwZXJpbWVudGFsLXdhcm5pbmdzJztcbmltcG9ydCB7IG5vcm1hbGl6ZU9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnO1xuaW1wb3J0IHsgYnVuZGxlU3R5bGVzaGVldFRleHQgfSBmcm9tICcuL3N0eWxlc2hlZXRzJztcblxuLyoqXG4gKiBNYWluIGV4ZWN1dGlvbiBmdW5jdGlvbiBmb3IgdGhlIGVzYnVpbGQtYmFzZWQgYXBwbGljYXRpb24gYnVpbGRlci5cbiAqIFRoZSBvcHRpb25zIGFyZSBjb21wYXRpYmxlIHdpdGggdGhlIFdlYnBhY2stYmFzZWQgYnVpbGRlci5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBicm93c2VyIGJ1aWxkZXIgb3B0aW9ucyB0byB1c2Ugd2hlbiBzZXR0aW5nIHVwIHRoZSBhcHBsaWNhdGlvbiBidWlsZFxuICogQHBhcmFtIGNvbnRleHQgVGhlIEFyY2hpdGVjdCBidWlsZGVyIGNvbnRleHQgb2JqZWN0XG4gKiBAcmV0dXJucyBBIHByb21pc2Ugd2l0aCB0aGUgYnVpbGRlciByZXN1bHQgb3V0cHV0XG4gKi9cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZXhlY3V0ZShcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbik6IFByb21pc2U8QnVpbGRlck91dHB1dD4ge1xuICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuXG4gIC8vIE9ubHkgQU9UIGlzIGN1cnJlbnRseSBzdXBwb3J0ZWRcbiAgaWYgKG9wdGlvbnMuYW90ICE9PSB0cnVlKSB7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoXG4gICAgICAnSklUIG1vZGUgaXMgY3VycmVudGx5IG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBleHBlcmltZW50YWwgYnVpbGRlci4gQU9UIG1vZGUgbXVzdCBiZSB1c2VkLicsXG4gICAgKTtcblxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gIH1cblxuICAvLyBJbmZvcm0gdXNlciBvZiBleHBlcmltZW50YWwgc3RhdHVzIG9mIGJ1aWxkZXIgYW5kIG9wdGlvbnNcbiAgbG9nRXhwZXJpbWVudGFsV2FybmluZ3Mob3B0aW9ucywgY29udGV4dCk7XG5cbiAgLy8gRGV0ZXJtaW5lIHByb2plY3QgbmFtZSBmcm9tIGJ1aWxkZXIgY29udGV4dCB0YXJnZXRcbiAgY29uc3QgcHJvamVjdE5hbWUgPSBjb250ZXh0LnRhcmdldD8ucHJvamVjdDtcbiAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGBUaGUgJ2Jyb3dzZXItZXNidWlsZCcgYnVpbGRlciByZXF1aXJlcyBhIHRhcmdldCB0byBiZSBzcGVjaWZpZWQuYCk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICB9XG5cbiAgY29uc3Qge1xuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgbWFpbkVudHJ5UG9pbnQsXG4gICAgcG9seWZpbGxzRW50cnlQb2ludCxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIG91dHB1dFBhdGgsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB0c2NvbmZpZyxcbiAgICBhc3NldHMsXG4gICAgb3V0cHV0TmFtZXMsXG4gIH0gPSBhd2FpdCBub3JtYWxpemVPcHRpb25zKGNvbnRleHQsIHByb2plY3ROYW1lLCBvcHRpb25zKTtcblxuICAvLyBDbGVhbiBvdXRwdXQgcGF0aCBpZiBlbmFibGVkXG4gIGlmIChvcHRpb25zLmRlbGV0ZU91dHB1dFBhdGgpIHtcbiAgICBkZWxldGVPdXRwdXREaXIod29ya3NwYWNlUm9vdCwgb3B0aW9ucy5vdXRwdXRQYXRoKTtcbiAgfVxuXG4gIC8vIFNldHVwIGJ1bmRsZXIgZW50cnkgcG9pbnRzXG4gIGNvbnN0IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgIG1haW46IG1haW5FbnRyeVBvaW50LFxuICB9O1xuICBpZiAocG9seWZpbGxzRW50cnlQb2ludCkge1xuICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSA9IHBvbHlmaWxsc0VudHJ5UG9pbnQ7XG4gIH1cbiAgLy8gQ3JlYXRlIHJldmVyc2UgbG9va3VwIHVzZWQgZHVyaW5nIGluZGV4IEhUTUwgZ2VuZXJhdGlvblxuICBjb25zdCBlbnRyeVBvaW50TmFtZUxvb2t1cDogUmVhZG9ubHlNYXA8c3RyaW5nLCBzdHJpbmc+ID0gbmV3IE1hcChcbiAgICBPYmplY3QuZW50cmllcyhlbnRyeVBvaW50cykubWFwKFxuICAgICAgKFtuYW1lLCBmaWxlUGF0aF0pID0+IFtwYXRoLnJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIGZpbGVQYXRoKSwgbmFtZV0gYXMgY29uc3QsXG4gICAgKSxcbiAgKTtcblxuICAvLyBFeGVjdXRlIGVzYnVpbGRcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnVuZGxlQ29kZShcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIG9wdGlvbnMsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICApO1xuXG4gIC8vIExvZyBhbGwgd2FybmluZ3MgYW5kIGVycm9ycyBnZW5lcmF0ZWQgZHVyaW5nIGJ1bmRsaW5nXG4gIGF3YWl0IGxvZ01lc3NhZ2VzKGNvbnRleHQsIHJlc3VsdCk7XG5cbiAgLy8gUmV0dXJuIGlmIHRoZSBidW5kbGluZyBmYWlsZWQgdG8gZ2VuZXJhdGUgb3V0cHV0IGZpbGVzIG9yIHRoZXJlIGFyZSBlcnJvcnNcbiAgaWYgKCFyZXN1bHQub3V0cHV0RmlsZXMgfHwgcmVzdWx0LmVycm9ycy5sZW5ndGgpIHtcbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICB9XG5cbiAgLy8gU3RydWN0dXJlIHRoZSBidW5kbGluZyBvdXRwdXQgZmlsZXNcbiAgY29uc3QgaW5pdGlhbEZpbGVzOiBGaWxlSW5mb1tdID0gW107XG4gIGNvbnN0IG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW10gPSBbXTtcbiAgZm9yIChjb25zdCBvdXRwdXRGaWxlIG9mIHJlc3VsdC5vdXRwdXRGaWxlcykge1xuICAgIC8vIEVudHJpZXMgaW4gdGhlIG1ldGFmaWxlIGFyZSByZWxhdGl2ZSB0byB0aGUgYGFic1dvcmtpbmdEaXJgIG9wdGlvbiB3aGljaCBpcyBzZXQgdG8gdGhlIHdvcmtzcGFjZVJvb3RcbiAgICBjb25zdCByZWxhdGl2ZUZpbGVQYXRoID0gcGF0aC5yZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCBvdXRwdXRGaWxlLnBhdGgpO1xuICAgIGNvbnN0IGVudHJ5UG9pbnQgPSByZXN1bHQubWV0YWZpbGU/Lm91dHB1dHNbcmVsYXRpdmVGaWxlUGF0aF0/LmVudHJ5UG9pbnQ7XG5cbiAgICBvdXRwdXRGaWxlLnBhdGggPSBwYXRoLnJlbGF0aXZlKERFRkFVTFRfT1VURElSLCBvdXRwdXRGaWxlLnBhdGgpO1xuXG4gICAgaWYgKGVudHJ5UG9pbnQpIHtcbiAgICAgIC8vIEFuIGVudHJ5UG9pbnQgdmFsdWUgaW5kaWNhdGVzIGFuIGluaXRpYWwgZmlsZVxuICAgICAgaW5pdGlhbEZpbGVzLnB1c2goe1xuICAgICAgICBmaWxlOiBvdXRwdXRGaWxlLnBhdGgsXG4gICAgICAgIG5hbWU6IGVudHJ5UG9pbnROYW1lTG9va3VwLmdldChlbnRyeVBvaW50KSA/PyAnJyxcbiAgICAgICAgZXh0ZW5zaW9uOiBwYXRoLmV4dG5hbWUob3V0cHV0RmlsZS5wYXRoKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBvdXRwdXRGaWxlcy5wdXNoKG91dHB1dEZpbGUpO1xuICB9XG5cbiAgLy8gQ3JlYXRlIG91dHB1dCBkaXJlY3RvcnkgaWYgbmVlZGVkXG4gIHRyeSB7XG4gICAgYXdhaXQgZnMubWtkaXIob3V0cHV0UGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zdCByZWFzb24gPSAnbWVzc2FnZScgaW4gZSA/IGUubWVzc2FnZSA6ICdVbmtub3duIGVycm9yJztcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcignVW5hYmxlIHRvIGNyZWF0ZSBvdXRwdXQgZGlyZWN0b3J5OiAnICsgcmVhc29uKTtcblxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gIH1cblxuICAvLyBQcm9jZXNzIGdsb2JhbCBzdHlsZXNoZWV0c1xuICBpZiAob3B0aW9ucy5zdHlsZXMpIHtcbiAgICAvLyByZXNvbHZlR2xvYmFsU3R5bGVzIGlzIHRlbXBvcmFyaWx5IHJldXNlZCBmcm9tIHRoZSBXZWJwYWNrIGJ1aWxkZXIgY29kZVxuICAgIGNvbnN0IHsgZW50cnlQb2ludHM6IHN0eWxlc2hlZXRFbnRyeXBvaW50cywgbm9JbmplY3ROYW1lcyB9ID0gcmVzb2x2ZUdsb2JhbFN0eWxlcyhcbiAgICAgIG9wdGlvbnMuc3R5bGVzLFxuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICEhb3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICk7XG4gICAgZm9yIChjb25zdCBbbmFtZSwgZmlsZXNdIG9mIE9iamVjdC5lbnRyaWVzKHN0eWxlc2hlZXRFbnRyeXBvaW50cykpIHtcbiAgICAgIGNvbnN0IHZpcnR1YWxFbnRyeURhdGEgPSBmaWxlc1xuICAgICAgICAubWFwKChmaWxlKSA9PiBgQGltcG9ydCAnJHtmaWxlLnJlcGxhY2UoL1xcXFwvZywgJy8nKX0nO2ApXG4gICAgICAgIC5qb2luKCdcXG4nKTtcbiAgICAgIGNvbnN0IHNoZWV0UmVzdWx0ID0gYXdhaXQgYnVuZGxlU3R5bGVzaGVldFRleHQoXG4gICAgICAgIHZpcnR1YWxFbnRyeURhdGEsXG4gICAgICAgIHsgdmlydHVhbE5hbWU6IGBhbmd1bGFyOnN0eWxlL2dsb2JhbDske25hbWV9YCwgcmVzb2x2ZVBhdGg6IHdvcmtzcGFjZVJvb3QgfSxcbiAgICAgICAge1xuICAgICAgICAgIG9wdGltaXphdGlvbjogISFvcHRpbWl6YXRpb25PcHRpb25zLnN0eWxlcy5taW5pZnksXG4gICAgICAgICAgc291cmNlbWFwOiAhIXNvdXJjZW1hcE9wdGlvbnMuc3R5bGVzLFxuICAgICAgICAgIG91dHB1dE5hbWVzOiBub0luamVjdE5hbWVzLmluY2x1ZGVzKG5hbWUpID8geyBtZWRpYTogb3V0cHV0TmFtZXMubWVkaWEgfSA6IG91dHB1dE5hbWVzLFxuICAgICAgICB9LFxuICAgICAgKTtcblxuICAgICAgYXdhaXQgbG9nTWVzc2FnZXMoY29udGV4dCwgc2hlZXRSZXN1bHQpO1xuICAgICAgaWYgKCFzaGVldFJlc3VsdC5wYXRoKSB7XG4gICAgICAgIC8vIEZhaWxlZCB0byBwcm9jZXNzIHRoZSBzdHlsZXNoZWV0XG4gICAgICAgIGFzc2VydC5vayhcbiAgICAgICAgICBzaGVldFJlc3VsdC5lcnJvcnMubGVuZ3RoLFxuICAgICAgICAgIGBHbG9iYWwgc3R5bGVzaGVldCBwcm9jZXNzaW5nIGZvciAnJHtuYW1lfScgZmFpbGVkIHdpdGggbm8gZXJyb3JzLmAsXG4gICAgICAgICk7XG5cbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIHZpcnR1YWwgc3R5bGVzaGVldHMgd2lsbCBiZSBuYW1lZCBgc3RkaW5gIGJ5IGVzYnVpbGQuIFRoaXMgbXVzdCBiZSByZXBsYWNlZFxuICAgICAgLy8gd2l0aCB0aGUgYWN0dWFsIG5hbWUgb2YgdGhlIGdsb2JhbCBzdHlsZSBhbmQgdGhlIGxlYWRpbmcgZGlyZWN0b3J5IHNlcGFyYXRvciBtdXN0XG4gICAgICAvLyBhbHNvIGJlIHJlbW92ZWQgdG8gbWFrZSB0aGUgcGF0aCByZWxhdGl2ZS5cbiAgICAgIGNvbnN0IHNoZWV0UGF0aCA9IHNoZWV0UmVzdWx0LnBhdGgucmVwbGFjZSgnc3RkaW4nLCBuYW1lKTtcbiAgICAgIG91dHB1dEZpbGVzLnB1c2goY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHNoZWV0UGF0aCwgc2hlZXRSZXN1bHQuY29udGVudHMpKTtcbiAgICAgIGlmIChzaGVldFJlc3VsdC5tYXApIHtcbiAgICAgICAgb3V0cHV0RmlsZXMucHVzaChjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQoc2hlZXRQYXRoICsgJy5tYXAnLCBzaGVldFJlc3VsdC5tYXApKTtcbiAgICAgIH1cbiAgICAgIGlmICghbm9JbmplY3ROYW1lcy5pbmNsdWRlcyhuYW1lKSkge1xuICAgICAgICBpbml0aWFsRmlsZXMucHVzaCh7XG4gICAgICAgICAgZmlsZTogc2hlZXRQYXRoLFxuICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgZXh0ZW5zaW9uOiAnLmNzcycsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgb3V0cHV0RmlsZXMucHVzaCguLi5zaGVldFJlc3VsdC5yZXNvdXJjZUZpbGVzKTtcbiAgICB9XG4gIH1cblxuICAvLyBHZW5lcmF0ZSBpbmRleCBIVE1MIGZpbGVcbiAgaWYgKG9wdGlvbnMuaW5kZXgpIHtcbiAgICBjb25zdCBlbnRyeXBvaW50cyA9IGdlbmVyYXRlRW50cnlQb2ludHMoe1xuICAgICAgc2NyaXB0czogb3B0aW9ucy5zY3JpcHRzID8/IFtdLFxuICAgICAgc3R5bGVzOiBvcHRpb25zLnN0eWxlcyA/PyBbXSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBhbiBpbmRleCBIVE1MIGdlbmVyYXRvciB0aGF0IHJlYWRzIGZyb20gdGhlIGluLW1lbW9yeSBvdXRwdXQgZmlsZXNcbiAgICBjb25zdCBpbmRleEh0bWxHZW5lcmF0b3IgPSBuZXcgSW5kZXhIdG1sR2VuZXJhdG9yKHtcbiAgICAgIGluZGV4UGF0aDogcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgZ2V0SW5kZXhJbnB1dEZpbGUob3B0aW9ucy5pbmRleCkpLFxuICAgICAgZW50cnlwb2ludHMsXG4gICAgICBzcmk6IG9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgICBvcHRpbWl6YXRpb246IG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgICBjcm9zc09yaWdpbjogb3B0aW9ucy5jcm9zc09yaWdpbixcbiAgICB9KTtcblxuICAgIC8qKiBWaXJ0dWFsIG91dHB1dCBwYXRoIHRvIHN1cHBvcnQgcmVhZGluZyBpbi1tZW1vcnkgZmlsZXMuICovXG4gICAgY29uc3QgdmlydHVhbE91dHB1dFBhdGggPSAnLyc7XG4gICAgaW5kZXhIdG1sR2VuZXJhdG9yLnJlYWRBc3NldCA9IGFzeW5jIGZ1bmN0aW9uIChmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAgIC8vIFJlbW92ZSBsZWFkaW5nIGRpcmVjdG9yeSBzZXBhcmF0b3JcbiAgICAgIGNvbnN0IHJlbGF0aXZlZmlsZVBhdGggPSBwYXRoLnJlbGF0aXZlKHZpcnR1YWxPdXRwdXRQYXRoLCBmaWxlUGF0aCk7XG4gICAgICBjb25zdCBmaWxlID0gb3V0cHV0RmlsZXMuZmluZCgoZmlsZSkgPT4gZmlsZS5wYXRoID09PSByZWxhdGl2ZWZpbGVQYXRoKTtcbiAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgIHJldHVybiBmaWxlLnRleHQ7XG4gICAgICB9XG5cbiAgICAgIHRocm93IG5ldyBFcnJvcihgT3V0cHV0IGZpbGUgZG9lcyBub3QgZXhpc3Q6ICR7cGF0aH1gKTtcbiAgICB9O1xuXG4gICAgY29uc3QgeyBjb250ZW50LCB3YXJuaW5ncywgZXJyb3JzIH0gPSBhd2FpdCBpbmRleEh0bWxHZW5lcmF0b3IucHJvY2Vzcyh7XG4gICAgICBiYXNlSHJlZjogb3B0aW9ucy5iYXNlSHJlZixcbiAgICAgIGxhbmc6IHVuZGVmaW5lZCxcbiAgICAgIG91dHB1dFBhdGg6IHZpcnR1YWxPdXRwdXRQYXRoLFxuICAgICAgZmlsZXM6IGluaXRpYWxGaWxlcyxcbiAgICB9KTtcblxuICAgIGZvciAoY29uc3QgZXJyb3Igb2YgZXJyb3JzKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihlcnJvcik7XG4gICAgfVxuICAgIGZvciAoY29uc3Qgd2FybmluZyBvZiB3YXJuaW5ncykge1xuICAgICAgY29udGV4dC5sb2dnZXIud2Fybih3YXJuaW5nKTtcbiAgICB9XG5cbiAgICBvdXRwdXRGaWxlcy5wdXNoKGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChnZXRJbmRleE91dHB1dEZpbGUob3B0aW9ucy5pbmRleCksIGNvbnRlbnQpKTtcbiAgfVxuXG4gIC8vIENvcHkgYXNzZXRzXG4gIGlmIChhc3NldHMpIHtcbiAgICBhd2FpdCBjb3B5QXNzZXRzKGFzc2V0cywgW291dHB1dFBhdGhdLCB3b3Jrc3BhY2VSb290KTtcbiAgfVxuXG4gIC8vIFdyaXRlIG91dHB1dCBmaWxlc1xuICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICBvdXRwdXRGaWxlcy5tYXAoKGZpbGUpID0+IGZzLndyaXRlRmlsZShwYXRoLmpvaW4ob3V0cHV0UGF0aCwgZmlsZS5wYXRoKSwgZmlsZS5jb250ZW50cykpLFxuICApO1xuXG4gIGNvbnRleHQubG9nZ2VyLmluZm8oYENvbXBsZXRlLiBbJHsoRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSkgLyAxMDAwfSBzZWNvbmRzXWApO1xuXG4gIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHBhdGg6IHN0cmluZywgdGV4dDogc3RyaW5nKTogT3V0cHV0RmlsZSB7XG4gIHJldHVybiB7XG4gICAgcGF0aCxcbiAgICB0ZXh0LFxuICAgIGdldCBjb250ZW50cygpIHtcbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbSh0aGlzLnRleHQsICd1dGYtOCcpO1xuICAgIH0sXG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGJ1bmRsZUNvZGUoXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgZW50cnlQb2ludHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4gIG91dHB1dE5hbWVzOiB7IGJ1bmRsZXM6IHN0cmluZzsgbWVkaWE6IHN0cmluZyB9LFxuICBvcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gIG9wdGltaXphdGlvbk9wdGlvbnM6IE5vcm1hbGl6ZWRPcHRpbWl6YXRpb25PcHRpb25zLFxuICBzb3VyY2VtYXBPcHRpb25zOiBTb3VyY2VNYXBDbGFzcyxcbiAgdHNjb25maWc6IHN0cmluZyxcbikge1xuICByZXR1cm4gYnVuZGxlKHtcbiAgICBhYnNXb3JraW5nRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogdHJ1ZSxcbiAgICBmb3JtYXQ6ICdlc20nLFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIGVudHJ5TmFtZXM6IG91dHB1dE5hbWVzLmJ1bmRsZXMsXG4gICAgYXNzZXROYW1lczogb3V0cHV0TmFtZXMubWVkaWEsXG4gICAgdGFyZ2V0OiAnZXMyMDIwJyxcbiAgICBtYWluRmllbGRzOiBbJ2VzMjAyMCcsICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ10sXG4gICAgY29uZGl0aW9uczogWydlczIwMjAnLCAnZXMyMDE1JywgJ21vZHVsZSddLFxuICAgIHJlc29sdmVFeHRlbnNpb25zOiBbJy50cycsICcudHN4JywgJy5tanMnLCAnLmpzJ10sXG4gICAgbG9nTGV2ZWw6IG9wdGlvbnMudmVyYm9zZSA/ICdkZWJ1ZycgOiAnc2lsZW50JyxcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBtaW5pZnk6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBwdXJlOiBbJ2ZvcndhcmRSZWYnXSxcbiAgICBvdXRkaXI6IERFRkFVTFRfT1VURElSLFxuICAgIHNvdXJjZW1hcDogc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICBzcGxpdHRpbmc6IHRydWUsXG4gICAgdHNjb25maWcsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgcHJlc2VydmVTeW1saW5rczogb3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICAgICAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgICAgIHtcbiAgICAgICAgICBzb3VyY2VtYXA6ICEhc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzLFxuICAgICAgICAgIHRzY29uZmlnLFxuICAgICAgICAgIGFkdmFuY2VkT3B0aW1pemF0aW9uczogb3B0aW9ucy5idWlsZE9wdGltaXplcixcbiAgICAgICAgfSxcbiAgICAgICAgLy8gQ29tcG9uZW50IHN0eWxlc2hlZXQgb3B0aW9uc1xuICAgICAgICB7XG4gICAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICBvcHRpbWl6YXRpb246ICEhb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMubWluaWZ5LFxuICAgICAgICAgIHNvdXJjZW1hcDogISFzb3VyY2VtYXBPcHRpb25zLnN0eWxlcyxcbiAgICAgICAgICBvdXRwdXROYW1lcyxcbiAgICAgICAgfSxcbiAgICAgICksXG4gICAgXSxcbiAgICBkZWZpbmU6IHtcbiAgICAgICduZ0Rldk1vZGUnOiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgPyAnZmFsc2UnIDogJ3RydWUnLFxuICAgICAgJ25nSml0TW9kZSc6ICdmYWxzZScsXG4gICAgfSxcbiAgfSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXIoZXhlY3V0ZSk7XG4iXX0=