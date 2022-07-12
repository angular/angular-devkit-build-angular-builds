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
        const { entryPoints: stylesheetEntrypoints, noInjectNames } = (0, configs_1.resolveGlobalStyles)(options.styles, workspaceRoot, !!options.preserveSymlinks);
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
            'ngDevMode': optimizationOptions.scripts ? 'false' : 'true',
            'ngJitMode': 'false',
        },
    });
}
exports.default = (0, architect_1.createBuilder)(buildEsbuildBrowser);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsK0NBQWlDO0FBRWpDLDJCQUFvQztBQUNwQywyQ0FBNkI7QUFDN0IsdUNBQTZFO0FBQzdFLHlEQUFxRDtBQUNyRCw2Q0FBa0Q7QUFFbEQsc0ZBQWlGO0FBQ2pGLHVFQUFxRTtBQUNyRSwrREFBeUU7QUFDekUsK0VBQTJGO0FBQzNGLG1EQUE0RDtBQUM1RCx1REFBeUQ7QUFDekQsdUNBQWdEO0FBQ2hELG1FQUFrRTtBQUNsRSx1Q0FBNkM7QUFFN0MsK0NBQXFEO0FBRXJEOzs7Ozs7R0FNRztBQUNILGtEQUFrRDtBQUMzQyxLQUFLLFVBQVUsbUJBQW1CLENBQ3ZDLE9BQThCLEVBQzlCLE9BQXVCOztJQUV2QixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFN0Isa0NBQWtDO0lBQ2xDLElBQUksT0FBTyxDQUFDLEdBQUcsS0FBSyxJQUFJLEVBQUU7UUFDeEIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQ2xCLDBGQUEwRixDQUMzRixDQUFDO1FBRUYsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztLQUMzQjtJQUVELDREQUE0RDtJQUM1RCxJQUFBLCtDQUF1QixFQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztJQUUxQyxxREFBcUQ7SUFDckQsTUFBTSxXQUFXLEdBQUcsTUFBQSxPQUFPLENBQUMsTUFBTSwwQ0FBRSxPQUFPLENBQUM7SUFDNUMsSUFBSSxDQUFDLFdBQVcsRUFBRTtRQUNoQixPQUFPLENBQUMsTUFB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QkFBMkI7Z0JBQzNCLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO2dCQUMzRSxXQUFXO2dCQUNYLFlBQVksRUFBRSxNQUFBLE9BQU8sQ0FBQyx3QkFBd0IsMENBQUUsWUFBWTthQUM3RCxDQUNGO1NBQ0Y7UUFDRCxNQUFNLEVBQUU7WUFDTixXQUFXLEVBQUUsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU07WUFDM0QsV0FBVyxFQUFFLE9BQU87U0FDckI7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsa0JBQWUsSUFBQSx5QkFBYSxFQUFDLG1CQUFtQixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHR5cGUgeyBPdXRwdXRGaWxlIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBwcm9taXNlcyBhcyBmcyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBOb3JtYWxpemVkT3B0aW1pemF0aW9uT3B0aW9ucywgZGVsZXRlT3V0cHV0RGlyIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgY29weUFzc2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvcHktYXNzZXRzJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyBGaWxlSW5mbyB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvYXVnbWVudC1pbmRleC1odG1sJztcbmltcG9ydCB7IEluZGV4SHRtbEdlbmVyYXRvciB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cyB9IGZyb20gJy4uLy4uL3V0aWxzL3BhY2thZ2UtY2h1bmstc29ydCc7XG5pbXBvcnQgeyBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXIgfSBmcm9tICcuLi8uLi91dGlscy9zZXJ2aWNlLXdvcmtlcic7XG5pbXBvcnQgeyBnZXRJbmRleElucHV0RmlsZSwgZ2V0SW5kZXhPdXRwdXRGaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyByZXNvbHZlR2xvYmFsU3R5bGVzIH0gZnJvbSAnLi4vLi4vd2VicGFjay9jb25maWdzJztcbmltcG9ydCB7IGNyZWF0ZUNvbXBpbGVyUGx1Z2luIH0gZnJvbSAnLi9jb21waWxlci1wbHVnaW4nO1xuaW1wb3J0IHsgYnVuZGxlLCBsb2dNZXNzYWdlcyB9IGZyb20gJy4vZXNidWlsZCc7XG5pbXBvcnQgeyBsb2dFeHBlcmltZW50YWxXYXJuaW5ncyB9IGZyb20gJy4vZXhwZXJpbWVudGFsLXdhcm5pbmdzJztcbmltcG9ydCB7IG5vcm1hbGl6ZU9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucywgU291cmNlTWFwQ2xhc3MgfSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQgeyBidW5kbGVTdHlsZXNoZWV0VGV4dCB9IGZyb20gJy4vc3R5bGVzaGVldHMnO1xuXG4vKipcbiAqIE1haW4gZXhlY3V0aW9uIGZ1bmN0aW9uIGZvciB0aGUgZXNidWlsZC1iYXNlZCBhcHBsaWNhdGlvbiBidWlsZGVyLlxuICogVGhlIG9wdGlvbnMgYXJlIGNvbXBhdGlibGUgd2l0aCB0aGUgV2VicGFjay1iYXNlZCBidWlsZGVyLlxuICogQHBhcmFtIG9wdGlvbnMgVGhlIGJyb3dzZXIgYnVpbGRlciBvcHRpb25zIHRvIHVzZSB3aGVuIHNldHRpbmcgdXAgdGhlIGFwcGxpY2F0aW9uIGJ1aWxkXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgQXJjaGl0ZWN0IGJ1aWxkZXIgY29udGV4dCBvYmplY3RcbiAqIEByZXR1cm5zIEEgcHJvbWlzZSB3aXRoIHRoZSBidWlsZGVyIHJlc3VsdCBvdXRwdXRcbiAqL1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidWlsZEVzYnVpbGRCcm93c2VyKFxuICBvcHRpb25zOiBCcm93c2VyQnVpbGRlck9wdGlvbnMsXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuKTogUHJvbWlzZTxCdWlsZGVyT3V0cHV0PiB7XG4gIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG5cbiAgLy8gT25seSBBT1QgaXMgY3VycmVudGx5IHN1cHBvcnRlZFxuICBpZiAob3B0aW9ucy5hb3QgIT09IHRydWUpIHtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihcbiAgICAgICdKSVQgbW9kZSBpcyBjdXJyZW50bHkgbm90IHN1cHBvcnRlZCBieSB0aGlzIGV4cGVyaW1lbnRhbCBidWlsZGVyLiBBT1QgbW9kZSBtdXN0IGJlIHVzZWQuJyxcbiAgICApO1xuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgfVxuXG4gIC8vIEluZm9ybSB1c2VyIG9mIGV4cGVyaW1lbnRhbCBzdGF0dXMgb2YgYnVpbGRlciBhbmQgb3B0aW9uc1xuICBsb2dFeHBlcmltZW50YWxXYXJuaW5ncyhvcHRpb25zLCBjb250ZXh0KTtcblxuICAvLyBEZXRlcm1pbmUgcHJvamVjdCBuYW1lIGZyb20gYnVpbGRlciBjb250ZXh0IHRhcmdldFxuICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbnRleHQudGFyZ2V0Py5wcm9qZWN0O1xuICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoYFRoZSAnYnJvd3Nlci1lc2J1aWxkJyBidWlsZGVyIHJlcXVpcmVzIGEgdGFyZ2V0IHRvIGJlIHNwZWNpZmllZC5gKTtcblxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gIH1cblxuICBjb25zdCB7XG4gICAgcHJvamVjdFJvb3QsXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBtYWluRW50cnlQb2ludCxcbiAgICBwb2x5ZmlsbHNFbnRyeVBvaW50LFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgb3V0cHV0UGF0aCxcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICAgIGFzc2V0cyxcbiAgICBvdXRwdXROYW1lcyxcbiAgfSA9IGF3YWl0IG5vcm1hbGl6ZU9wdGlvbnMoY29udGV4dCwgcHJvamVjdE5hbWUsIG9wdGlvbnMpO1xuXG4gIC8vIENsZWFuIG91dHB1dCBwYXRoIGlmIGVuYWJsZWRcbiAgaWYgKG9wdGlvbnMuZGVsZXRlT3V0cHV0UGF0aCkge1xuICAgIGRlbGV0ZU91dHB1dERpcih3b3Jrc3BhY2VSb290LCBvcHRpb25zLm91dHB1dFBhdGgpO1xuICB9XG5cbiAgLy8gU2V0dXAgYnVuZGxlciBlbnRyeSBwb2ludHNcbiAgY29uc3QgZW50cnlQb2ludHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgbWFpbjogbWFpbkVudHJ5UG9pbnQsXG4gIH07XG4gIGlmIChwb2x5ZmlsbHNFbnRyeVBvaW50KSB7XG4gICAgZW50cnlQb2ludHNbJ3BvbHlmaWxscyddID0gcG9seWZpbGxzRW50cnlQb2ludDtcbiAgfVxuICAvLyBDcmVhdGUgcmV2ZXJzZSBsb29rdXAgdXNlZCBkdXJpbmcgaW5kZXggSFRNTCBnZW5lcmF0aW9uXG4gIGNvbnN0IGVudHJ5UG9pbnROYW1lTG9va3VwOiBSZWFkb25seU1hcDxzdHJpbmcsIHN0cmluZz4gPSBuZXcgTWFwKFxuICAgIE9iamVjdC5lbnRyaWVzKGVudHJ5UG9pbnRzKS5tYXAoXG4gICAgICAoW25hbWUsIGZpbGVQYXRoXSkgPT4gW3BhdGgucmVsYXRpdmUod29ya3NwYWNlUm9vdCwgZmlsZVBhdGgpLCBuYW1lXSBhcyBjb25zdCxcbiAgICApLFxuICApO1xuXG4gIC8vIEV4ZWN1dGUgZXNidWlsZFxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBidW5kbGVDb2RlKFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgZW50cnlQb2ludHMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgb3B0aW9ucyxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICk7XG5cbiAgLy8gTG9nIGFsbCB3YXJuaW5ncyBhbmQgZXJyb3JzIGdlbmVyYXRlZCBkdXJpbmcgYnVuZGxpbmdcbiAgYXdhaXQgbG9nTWVzc2FnZXMoY29udGV4dCwgcmVzdWx0KTtcblxuICAvLyBSZXR1cm4gaWYgdGhlIGJ1bmRsaW5nIGZhaWxlZCB0byBnZW5lcmF0ZSBvdXRwdXQgZmlsZXMgb3IgdGhlcmUgYXJlIGVycm9yc1xuICBpZiAoIXJlc3VsdC5vdXRwdXRGaWxlcyB8fCByZXN1bHQuZXJyb3JzLmxlbmd0aCkge1xuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gIH1cblxuICAvLyBTdHJ1Y3R1cmUgdGhlIGJ1bmRsaW5nIG91dHB1dCBmaWxlc1xuICBjb25zdCBpbml0aWFsRmlsZXM6IEZpbGVJbmZvW10gPSBbXTtcbiAgY29uc3Qgb3V0cHV0RmlsZXM6IE91dHB1dEZpbGVbXSA9IFtdO1xuICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2YgcmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgLy8gRW50cmllcyBpbiB0aGUgbWV0YWZpbGUgYXJlIHJlbGF0aXZlIHRvIHRoZSBgYWJzV29ya2luZ0RpcmAgb3B0aW9uIHdoaWNoIGlzIHNldCB0byB0aGUgd29ya3NwYWNlUm9vdFxuICAgIGNvbnN0IHJlbGF0aXZlRmlsZVBhdGggPSBwYXRoLnJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIG91dHB1dEZpbGUucGF0aCk7XG4gICAgY29uc3QgZW50cnlQb2ludCA9IHJlc3VsdC5tZXRhZmlsZT8ub3V0cHV0c1tyZWxhdGl2ZUZpbGVQYXRoXT8uZW50cnlQb2ludDtcblxuICAgIG91dHB1dEZpbGUucGF0aCA9IHJlbGF0aXZlRmlsZVBhdGg7XG5cbiAgICBpZiAoZW50cnlQb2ludCkge1xuICAgICAgLy8gQW4gZW50cnlQb2ludCB2YWx1ZSBpbmRpY2F0ZXMgYW4gaW5pdGlhbCBmaWxlXG4gICAgICBpbml0aWFsRmlsZXMucHVzaCh7XG4gICAgICAgIGZpbGU6IG91dHB1dEZpbGUucGF0aCxcbiAgICAgICAgbmFtZTogZW50cnlQb2ludE5hbWVMb29rdXAuZ2V0KGVudHJ5UG9pbnQpID8/ICcnLFxuICAgICAgICBleHRlbnNpb246IHBhdGguZXh0bmFtZShvdXRwdXRGaWxlLnBhdGgpLFxuICAgICAgfSk7XG4gICAgfVxuICAgIG91dHB1dEZpbGVzLnB1c2gob3V0cHV0RmlsZSk7XG4gIH1cblxuICAvLyBDcmVhdGUgb3V0cHV0IGRpcmVjdG9yeSBpZiBuZWVkZWRcbiAgdHJ5IHtcbiAgICBhd2FpdCBmcy5ta2RpcihvdXRwdXRQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGFzc2VydElzRXJyb3IoZSk7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoJ1VuYWJsZSB0byBjcmVhdGUgb3V0cHV0IGRpcmVjdG9yeTogJyArIGUubWVzc2FnZSk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICB9XG5cbiAgLy8gUHJvY2VzcyBnbG9iYWwgc3R5bGVzaGVldHNcbiAgaWYgKG9wdGlvbnMuc3R5bGVzKSB7XG4gICAgLy8gcmVzb2x2ZUdsb2JhbFN0eWxlcyBpcyB0ZW1wb3JhcmlseSByZXVzZWQgZnJvbSB0aGUgV2VicGFjayBidWlsZGVyIGNvZGVcbiAgICBjb25zdCB7IGVudHJ5UG9pbnRzOiBzdHlsZXNoZWV0RW50cnlwb2ludHMsIG5vSW5qZWN0TmFtZXMgfSA9IHJlc29sdmVHbG9iYWxTdHlsZXMoXG4gICAgICBvcHRpb25zLnN0eWxlcyxcbiAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAhIW9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICApO1xuICAgIGZvciAoY29uc3QgW25hbWUsIGZpbGVzXSBvZiBPYmplY3QuZW50cmllcyhzdHlsZXNoZWV0RW50cnlwb2ludHMpKSB7XG4gICAgICBjb25zdCB2aXJ0dWFsRW50cnlEYXRhID0gZmlsZXNcbiAgICAgICAgLm1hcCgoZmlsZSkgPT4gYEBpbXBvcnQgJyR7ZmlsZS5yZXBsYWNlKC9cXFxcL2csICcvJyl9JztgKVxuICAgICAgICAuam9pbignXFxuJyk7XG4gICAgICBjb25zdCBzaGVldFJlc3VsdCA9IGF3YWl0IGJ1bmRsZVN0eWxlc2hlZXRUZXh0KFxuICAgICAgICB2aXJ0dWFsRW50cnlEYXRhLFxuICAgICAgICB7IHZpcnR1YWxOYW1lOiBgYW5ndWxhcjpzdHlsZS9nbG9iYWw7JHtuYW1lfWAsIHJlc29sdmVQYXRoOiB3b3Jrc3BhY2VSb290IH0sXG4gICAgICAgIHtcbiAgICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgIG9wdGltaXphdGlvbjogISFvcHRpbWl6YXRpb25PcHRpb25zLnN0eWxlcy5taW5pZnksXG4gICAgICAgICAgc291cmNlbWFwOiAhIXNvdXJjZW1hcE9wdGlvbnMuc3R5bGVzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICAgICAgICBvdXRwdXROYW1lczogbm9JbmplY3ROYW1lcy5pbmNsdWRlcyhuYW1lKSA/IHsgbWVkaWE6IG91dHB1dE5hbWVzLm1lZGlhIH0gOiBvdXRwdXROYW1lcyxcbiAgICAgICAgICBpbmNsdWRlUGF0aHM6IG9wdGlvbnMuc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zPy5pbmNsdWRlUGF0aHMsXG4gICAgICAgIH0sXG4gICAgICApO1xuXG4gICAgICBhd2FpdCBsb2dNZXNzYWdlcyhjb250ZXh0LCBzaGVldFJlc3VsdCk7XG4gICAgICBpZiAoIXNoZWV0UmVzdWx0LnBhdGgpIHtcbiAgICAgICAgLy8gRmFpbGVkIHRvIHByb2Nlc3MgdGhlIHN0eWxlc2hlZXRcbiAgICAgICAgYXNzZXJ0Lm9rKFxuICAgICAgICAgIHNoZWV0UmVzdWx0LmVycm9ycy5sZW5ndGgsXG4gICAgICAgICAgYEdsb2JhbCBzdHlsZXNoZWV0IHByb2Nlc3NpbmcgZm9yICcke25hbWV9JyBmYWlsZWQgd2l0aCBubyBlcnJvcnMuYCxcbiAgICAgICAgKTtcblxuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgdmlydHVhbCBzdHlsZXNoZWV0cyB3aWxsIGJlIG5hbWVkIGBzdGRpbmAgYnkgZXNidWlsZC4gVGhpcyBtdXN0IGJlIHJlcGxhY2VkXG4gICAgICAvLyB3aXRoIHRoZSBhY3R1YWwgbmFtZSBvZiB0aGUgZ2xvYmFsIHN0eWxlIGFuZCB0aGUgbGVhZGluZyBkaXJlY3Rvcnkgc2VwYXJhdG9yIG11c3RcbiAgICAgIC8vIGFsc28gYmUgcmVtb3ZlZCB0byBtYWtlIHRoZSBwYXRoIHJlbGF0aXZlLlxuICAgICAgY29uc3Qgc2hlZXRQYXRoID0gc2hlZXRSZXN1bHQucGF0aC5yZXBsYWNlKCdzdGRpbicsIG5hbWUpO1xuICAgICAgb3V0cHV0RmlsZXMucHVzaChjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQoc2hlZXRQYXRoLCBzaGVldFJlc3VsdC5jb250ZW50cykpO1xuICAgICAgaWYgKHNoZWV0UmVzdWx0Lm1hcCkge1xuICAgICAgICBvdXRwdXRGaWxlcy5wdXNoKGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChzaGVldFBhdGggKyAnLm1hcCcsIHNoZWV0UmVzdWx0Lm1hcCkpO1xuICAgICAgfVxuICAgICAgaWYgKCFub0luamVjdE5hbWVzLmluY2x1ZGVzKG5hbWUpKSB7XG4gICAgICAgIGluaXRpYWxGaWxlcy5wdXNoKHtcbiAgICAgICAgICBmaWxlOiBzaGVldFBhdGgsXG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgICBleHRlbnNpb246ICcuY3NzJyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBvdXRwdXRGaWxlcy5wdXNoKC4uLnNoZWV0UmVzdWx0LnJlc291cmNlRmlsZXMpO1xuICAgIH1cbiAgfVxuXG4gIC8vIEdlbmVyYXRlIGluZGV4IEhUTUwgZmlsZVxuICBpZiAob3B0aW9ucy5pbmRleCkge1xuICAgIGNvbnN0IGVudHJ5cG9pbnRzID0gZ2VuZXJhdGVFbnRyeVBvaW50cyh7XG4gICAgICBzY3JpcHRzOiBvcHRpb25zLnNjcmlwdHMgPz8gW10sXG4gICAgICBzdHlsZXM6IG9wdGlvbnMuc3R5bGVzID8/IFtdLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGFuIGluZGV4IEhUTUwgZ2VuZXJhdG9yIHRoYXQgcmVhZHMgZnJvbSB0aGUgaW4tbWVtb3J5IG91dHB1dCBmaWxlc1xuICAgIGNvbnN0IGluZGV4SHRtbEdlbmVyYXRvciA9IG5ldyBJbmRleEh0bWxHZW5lcmF0b3Ioe1xuICAgICAgaW5kZXhQYXRoOiBwYXRoLmpvaW4oY29udGV4dC53b3Jrc3BhY2VSb290LCBnZXRJbmRleElucHV0RmlsZShvcHRpb25zLmluZGV4KSksXG4gICAgICBlbnRyeXBvaW50cyxcbiAgICAgIHNyaTogb3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSxcbiAgICAgIG9wdGltaXphdGlvbjogb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICAgIGNyb3NzT3JpZ2luOiBvcHRpb25zLmNyb3NzT3JpZ2luLFxuICAgIH0pO1xuXG4gICAgLyoqIFZpcnR1YWwgb3V0cHV0IHBhdGggdG8gc3VwcG9ydCByZWFkaW5nIGluLW1lbW9yeSBmaWxlcy4gKi9cbiAgICBjb25zdCB2aXJ0dWFsT3V0cHV0UGF0aCA9ICcvJztcbiAgICBpbmRleEh0bWxHZW5lcmF0b3IucmVhZEFzc2V0ID0gYXN5bmMgZnVuY3Rpb24gKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgLy8gUmVtb3ZlIGxlYWRpbmcgZGlyZWN0b3J5IHNlcGFyYXRvclxuICAgICAgY29uc3QgcmVsYXRpdmVmaWxlUGF0aCA9IHBhdGgucmVsYXRpdmUodmlydHVhbE91dHB1dFBhdGgsIGZpbGVQYXRoKTtcbiAgICAgIGNvbnN0IGZpbGUgPSBvdXRwdXRGaWxlcy5maW5kKChmaWxlKSA9PiBmaWxlLnBhdGggPT09IHJlbGF0aXZlZmlsZVBhdGgpO1xuICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgcmV0dXJuIGZpbGUudGV4dDtcbiAgICAgIH1cblxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBPdXRwdXQgZmlsZSBkb2VzIG5vdCBleGlzdDogJHtwYXRofWApO1xuICAgIH07XG5cbiAgICBjb25zdCB7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IGluZGV4SHRtbEdlbmVyYXRvci5wcm9jZXNzKHtcbiAgICAgIGJhc2VIcmVmOiBvcHRpb25zLmJhc2VIcmVmLFxuICAgICAgbGFuZzogdW5kZWZpbmVkLFxuICAgICAgb3V0cHV0UGF0aDogdmlydHVhbE91dHB1dFBhdGgsXG4gICAgICBmaWxlczogaW5pdGlhbEZpbGVzLFxuICAgIH0pO1xuXG4gICAgZm9yIChjb25zdCBlcnJvciBvZiBlcnJvcnMpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB3YXJuaW5nIG9mIHdhcm5pbmdzKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci53YXJuKHdhcm5pbmcpO1xuICAgIH1cblxuICAgIG91dHB1dEZpbGVzLnB1c2goY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KGdldEluZGV4T3V0cHV0RmlsZShvcHRpb25zLmluZGV4KSwgY29udGVudCkpO1xuICB9XG5cbiAgLy8gQ29weSBhc3NldHNcbiAgaWYgKGFzc2V0cykge1xuICAgIGF3YWl0IGNvcHlBc3NldHMoYXNzZXRzLCBbb3V0cHV0UGF0aF0sIHdvcmtzcGFjZVJvb3QpO1xuICB9XG5cbiAgLy8gV3JpdGUgb3V0cHV0IGZpbGVzXG4gIGF3YWl0IFByb21pc2UuYWxsKFxuICAgIG91dHB1dEZpbGVzLm1hcCgoZmlsZSkgPT4gZnMud3JpdGVGaWxlKHBhdGguam9pbihvdXRwdXRQYXRoLCBmaWxlLnBhdGgpLCBmaWxlLmNvbnRlbnRzKSksXG4gICk7XG5cbiAgLy8gQXVnbWVudCB0aGUgYXBwbGljYXRpb24gd2l0aCBzZXJ2aWNlIHdvcmtlciBzdXBwb3J0XG4gIC8vIFRPRE86IFRoaXMgc2hvdWxkIGV2ZW50dWFsbHkgb3BlcmF0ZSBvbiB0aGUgaW4tbWVtb3J5IGZpbGVzIHByaW9yIHRvIHdyaXRpbmcgdGhlIG91dHB1dCBmaWxlc1xuICBpZiAob3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlcihcbiAgICAgICAgcHJvamVjdFJvb3QsXG4gICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIG91dHB1dFBhdGgsXG4gICAgICAgIG9wdGlvbnMuYmFzZUhyZWYgfHwgJy8nLFxuICAgICAgICBvcHRpb25zLm5nc3dDb25maWdQYXRoLFxuICAgICAgKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBgJHtlcnJvcn1gKTtcblxuICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgICB9XG4gIH1cblxuICBjb250ZXh0LmxvZ2dlci5pbmZvKGBDb21wbGV0ZS4gWyR7KERhdGUubm93KCkgLSBzdGFydFRpbWUpIC8gMTAwMH0gc2Vjb25kc11gKTtcblxuICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChwYXRoOiBzdHJpbmcsIHRleHQ6IHN0cmluZyk6IE91dHB1dEZpbGUge1xuICByZXR1cm4ge1xuICAgIHBhdGgsXG4gICAgdGV4dCxcbiAgICBnZXQgY29udGVudHMoKSB7XG4gICAgICByZXR1cm4gQnVmZmVyLmZyb20odGhpcy50ZXh0LCAndXRmLTgnKTtcbiAgICB9LFxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBidW5kbGVDb2RlKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+LFxuICBvdXRwdXROYW1lczogeyBidW5kbGVzOiBzdHJpbmc7IG1lZGlhOiBzdHJpbmcgfSxcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICBvcHRpbWl6YXRpb25PcHRpb25zOiBOb3JtYWxpemVkT3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgc291cmNlbWFwT3B0aW9uczogU291cmNlTWFwQ2xhc3MsXG4gIHRzY29uZmlnOiBzdHJpbmcsXG4pIHtcbiAgcmV0dXJuIGJ1bmRsZSh7XG4gICAgYWJzV29ya2luZ0Rpcjogd29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IHRydWUsXG4gICAgZm9ybWF0OiAnZXNtJyxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBlbnRyeU5hbWVzOiBvdXRwdXROYW1lcy5idW5kbGVzLFxuICAgIGFzc2V0TmFtZXM6IG91dHB1dE5hbWVzLm1lZGlhLFxuICAgIHRhcmdldDogJ2VzMjAyMCcsXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgIGNvbmRpdGlvbnM6IFsnZXMyMDIwJywgJ2VzMjAxNScsICdtb2R1bGUnXSxcbiAgICByZXNvbHZlRXh0ZW5zaW9uczogWycudHMnLCAnLnRzeCcsICcubWpzJywgJy5qcyddLFxuICAgIGxvZ0xldmVsOiBvcHRpb25zLnZlcmJvc2UgPyAnZGVidWcnIDogJ3NpbGVudCcsXG4gICAgbWV0YWZpbGU6IHRydWUsXG4gICAgbWluaWZ5OiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgcHVyZTogWydmb3J3YXJkUmVmJ10sXG4gICAgb3V0ZGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIHNvdXJjZW1hcDogc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICBzcGxpdHRpbmc6IHRydWUsXG4gICAgdHNjb25maWcsXG4gICAgZXh0ZXJuYWw6IG9wdGlvbnMuZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnYnJvd3NlcicsXG4gICAgcHJlc2VydmVTeW1saW5rczogb3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZUNvbXBpbGVyUGx1Z2luKFxuICAgICAgICAvLyBKUy9UUyBvcHRpb25zXG4gICAgICAgIHtcbiAgICAgICAgICBzb3VyY2VtYXA6ICEhc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzLFxuICAgICAgICAgIHRoaXJkUGFydHlTb3VyY2VtYXBzOiBzb3VyY2VtYXBPcHRpb25zLnZlbmRvcixcbiAgICAgICAgICB0c2NvbmZpZyxcbiAgICAgICAgICBhZHZhbmNlZE9wdGltaXphdGlvbnM6IG9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICAgIH0sXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAge1xuICAgICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgb3B0aW1pemF0aW9uOiAhIW9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLm1pbmlmeSxcbiAgICAgICAgICBzb3VyY2VtYXA6XG4gICAgICAgICAgICAvLyBIaWRkZW4gY29tcG9uZW50IHN0eWxlc2hlZXQgc291cmNlbWFwcyBhcmUgaW5hY2Nlc3NpYmxlIHdoaWNoIGlzIGVmZmVjdGl2ZWx5XG4gICAgICAgICAgICAvLyB0aGUgc2FtZSBhcyBiZWluZyBkaXNhYmxlZC4gRGlzYWJsaW5nIGhhcyB0aGUgYWR2YW50YWdlIG9mIGF2b2lkaW5nIHRoZSBvdmVyaGVhZFxuICAgICAgICAgICAgLy8gb2Ygc291cmNlbWFwIHByb2Nlc3NpbmcuXG4gICAgICAgICAgICAhIXNvdXJjZW1hcE9wdGlvbnMuc3R5bGVzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/IGZhbHNlIDogJ2lubGluZScpLFxuICAgICAgICAgIG91dHB1dE5hbWVzLFxuICAgICAgICAgIGluY2x1ZGVQYXRoczogb3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnM/LmluY2x1ZGVQYXRocyxcbiAgICAgICAgfSxcbiAgICAgICksXG4gICAgXSxcbiAgICBkZWZpbmU6IHtcbiAgICAgICduZ0Rldk1vZGUnOiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgPyAnZmFsc2UnIDogJ3RydWUnLFxuICAgICAgJ25nSml0TW9kZSc6ICdmYWxzZScsXG4gICAgfSxcbiAgfSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXIoYnVpbGRFc2J1aWxkQnJvd3Nlcik7XG4iXX0=