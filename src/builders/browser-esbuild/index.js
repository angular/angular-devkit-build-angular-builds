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
        if (entryPoint) {
            // An entryPoint value indicates an initial file
            initialFiles.push({
                // Remove leading directory separator
                file: outputFile.path.slice(1),
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
            const virtualEntryData = files.map((file) => `@import '${file}';`).join('\n');
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
            const sheetPath = sheetResult.path.replace('stdin', name).slice(1);
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
        indexHtmlGenerator.readAsset = async function (path) {
            // Remove leading directory separator
            path = path.slice(1);
            const file = outputFiles.find((file) => file.path === path);
            if (file) {
                return file.text;
            }
            throw new Error(`Output file does not exist: ${path}`);
        };
        const { content, warnings, errors } = await indexHtmlGenerator.process({
            baseHref: options.baseHref,
            lang: undefined,
            outputPath: '/',
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
        conditions: ['es2020', 'module'],
        resolveExtensions: ['.ts', '.tsx', '.mjs', '.js'],
        logLevel: options.verbose ? 'debug' : 'silent',
        metafile: true,
        minify: optimizationOptions.scripts,
        pure: ['forwardRef'],
        outdir: '/',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx5REFBeUY7QUFDekYsK0NBQWlDO0FBRWpDLDJCQUFvQztBQUNwQywyQ0FBNkI7QUFDN0IsdUNBQTZFO0FBQzdFLHlEQUFxRDtBQUVyRCxzRkFBaUY7QUFDakYsdUVBQXFFO0FBQ3JFLCtFQUEyRjtBQUMzRixtREFBNEQ7QUFFNUQsdURBQXlEO0FBQ3pELHVDQUFnRDtBQUNoRCxtRUFBa0U7QUFDbEUsdUNBQTZDO0FBQzdDLCtDQUFxRDtBQUVyRDs7Ozs7O0dBTUc7QUFDSCxrREFBa0Q7QUFDM0MsS0FBSyxVQUFVLE9BQU8sQ0FDM0IsT0FBOEIsRUFDOUIsT0FBdUI7O0lBRXZCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUU3QixrQ0FBa0M7SUFDbEMsSUFBSSxPQUFPLENBQUMsR0FBRyxLQUFLLElBQUksRUFBRTtRQUN4QixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FDbEIsMEZBQTBGLENBQzNGLENBQUM7UUFFRixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO0tBQzNCO0lBRUQsNERBQTREO0lBQzVELElBQUEsK0NBQXVCLEVBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBRTFDLHFEQUFxRDtJQUNyRCxNQUFNLFdBQVcsR0FBRyxNQUFBLE9BQU8sQ0FBQyxNQUFNLDBDQUFFLE9BQU8sQ0FBQztJQUM1QyxJQUFJLENBQUMsV0FBVyxFQUFFO1FBQ2hCLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGtFQUFrRSxDQUFD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O1lBQ2hCO2dCQUNFLFNBQVMsRUFBRSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsT0FBTztnQkFDckMsUUFBUTtnQkFDUixxQkFBcUIsRUFBRSxPQUFPLENBQUMsY0FBYzthQUM5QztZQUNELCtCQUErQjtZQUMvQjtnQkFDRSxhQUFhO2dCQUNiLFlBQVksRUFBRSxDQUFDLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLE1BQU07Z0JBQ2pELFNBQVMsRUFBRSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsTUFBTTtnQkFDcEMsV0FBVzthQUNaLENBQ0Y7U0FDRjtRQUNELE1BQU0sRUFBRTtZQUNOLFdBQVcsRUFBRSxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTTtZQUMzRCxXQUFXLEVBQUUsT0FBTztTQUNyQjtLQUNGLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxrQkFBZSxJQUFBLHlCQUFhLEVBQUMsT0FBTyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHR5cGUgeyBPdXRwdXRGaWxlIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBwcm9taXNlcyBhcyBmcyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBOb3JtYWxpemVkT3B0aW1pemF0aW9uT3B0aW9ucywgZGVsZXRlT3V0cHV0RGlyIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgY29weUFzc2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvcHktYXNzZXRzJztcbmltcG9ydCB7IEZpbGVJbmZvIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9hdWdtZW50LWluZGV4LWh0bWwnO1xuaW1wb3J0IHsgSW5kZXhIdG1sR2VuZXJhdG9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBnZW5lcmF0ZUVudHJ5UG9pbnRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGFja2FnZS1jaHVuay1zb3J0JztcbmltcG9ydCB7IGdldEluZGV4SW5wdXRGaWxlLCBnZXRJbmRleE91dHB1dEZpbGUgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IHJlc29sdmVHbG9iYWxTdHlsZXMgfSBmcm9tICcuLi8uLi93ZWJwYWNrL2NvbmZpZ3MnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucywgU291cmNlTWFwQ2xhc3MgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBjcmVhdGVDb21waWxlclBsdWdpbiB9IGZyb20gJy4vY29tcGlsZXItcGx1Z2luJztcbmltcG9ydCB7IGJ1bmRsZSwgbG9nTWVzc2FnZXMgfSBmcm9tICcuL2VzYnVpbGQnO1xuaW1wb3J0IHsgbG9nRXhwZXJpbWVudGFsV2FybmluZ3MgfSBmcm9tICcuL2V4cGVyaW1lbnRhbC13YXJuaW5ncyc7XG5pbXBvcnQgeyBub3JtYWxpemVPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcbmltcG9ydCB7IGJ1bmRsZVN0eWxlc2hlZXRUZXh0IH0gZnJvbSAnLi9zdHlsZXNoZWV0cyc7XG5cbi8qKlxuICogTWFpbiBleGVjdXRpb24gZnVuY3Rpb24gZm9yIHRoZSBlc2J1aWxkLWJhc2VkIGFwcGxpY2F0aW9uIGJ1aWxkZXIuXG4gKiBUaGUgb3B0aW9ucyBhcmUgY29tcGF0aWJsZSB3aXRoIHRoZSBXZWJwYWNrLWJhc2VkIGJ1aWxkZXIuXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgYnJvd3NlciBidWlsZGVyIG9wdGlvbnMgdG8gdXNlIHdoZW4gc2V0dGluZyB1cCB0aGUgYXBwbGljYXRpb24gYnVpbGRcbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBBcmNoaXRlY3QgYnVpbGRlciBjb250ZXh0IG9iamVjdFxuICogQHJldHVybnMgQSBwcm9taXNlIHdpdGggdGhlIGJ1aWxkZXIgcmVzdWx0IG91dHB1dFxuICovXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGUoXG4gIG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4pOiBQcm9taXNlPEJ1aWxkZXJPdXRwdXQ+IHtcbiAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcblxuICAvLyBPbmx5IEFPVCBpcyBjdXJyZW50bHkgc3VwcG9ydGVkXG4gIGlmIChvcHRpb25zLmFvdCAhPT0gdHJ1ZSkge1xuICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKFxuICAgICAgJ0pJVCBtb2RlIGlzIGN1cnJlbnRseSBub3Qgc3VwcG9ydGVkIGJ5IHRoaXMgZXhwZXJpbWVudGFsIGJ1aWxkZXIuIEFPVCBtb2RlIG11c3QgYmUgdXNlZC4nLFxuICAgICk7XG5cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuICB9XG5cbiAgLy8gSW5mb3JtIHVzZXIgb2YgZXhwZXJpbWVudGFsIHN0YXR1cyBvZiBidWlsZGVyIGFuZCBvcHRpb25zXG4gIGxvZ0V4cGVyaW1lbnRhbFdhcm5pbmdzKG9wdGlvbnMsIGNvbnRleHQpO1xuXG4gIC8vIERldGVybWluZSBwcm9qZWN0IG5hbWUgZnJvbSBidWlsZGVyIGNvbnRleHQgdGFyZ2V0XG4gIGNvbnN0IHByb2plY3ROYW1lID0gY29udGV4dC50YXJnZXQ/LnByb2plY3Q7XG4gIGlmICghcHJvamVjdE5hbWUpIHtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihgVGhlICdicm93c2VyLWVzYnVpbGQnIGJ1aWxkZXIgcmVxdWlyZXMgYSB0YXJnZXQgdG8gYmUgc3BlY2lmaWVkLmApO1xuXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgfVxuXG4gIGNvbnN0IHtcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIG1haW5FbnRyeVBvaW50LFxuICAgIHBvbHlmaWxsc0VudHJ5UG9pbnQsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBvdXRwdXRQYXRoLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgYXNzZXRzLFxuICAgIG91dHB1dE5hbWVzLFxuICB9ID0gYXdhaXQgbm9ybWFsaXplT3B0aW9ucyhjb250ZXh0LCBwcm9qZWN0TmFtZSwgb3B0aW9ucyk7XG5cbiAgLy8gQ2xlYW4gb3V0cHV0IHBhdGggaWYgZW5hYmxlZFxuICBpZiAob3B0aW9ucy5kZWxldGVPdXRwdXRQYXRoKSB7XG4gICAgZGVsZXRlT3V0cHV0RGlyKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMub3V0cHV0UGF0aCk7XG4gIH1cblxuICAvLyBTZXR1cCBidW5kbGVyIGVudHJ5IHBvaW50c1xuICBjb25zdCBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICBtYWluOiBtYWluRW50cnlQb2ludCxcbiAgfTtcbiAgaWYgKHBvbHlmaWxsc0VudHJ5UG9pbnQpIHtcbiAgICBlbnRyeVBvaW50c1sncG9seWZpbGxzJ10gPSBwb2x5ZmlsbHNFbnRyeVBvaW50O1xuICB9XG4gIC8vIENyZWF0ZSByZXZlcnNlIGxvb2t1cCB1c2VkIGR1cmluZyBpbmRleCBIVE1MIGdlbmVyYXRpb25cbiAgY29uc3QgZW50cnlQb2ludE5hbWVMb29rdXA6IFJlYWRvbmx5TWFwPHN0cmluZywgc3RyaW5nPiA9IG5ldyBNYXAoXG4gICAgT2JqZWN0LmVudHJpZXMoZW50cnlQb2ludHMpLm1hcChcbiAgICAgIChbbmFtZSwgZmlsZVBhdGhdKSA9PiBbcGF0aC5yZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCBmaWxlUGF0aCksIG5hbWVdIGFzIGNvbnN0LFxuICAgICksXG4gICk7XG5cbiAgLy8gRXhlY3V0ZSBlc2J1aWxkXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGJ1bmRsZUNvZGUoXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBvcHRpb25zLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB0c2NvbmZpZyxcbiAgKTtcblxuICAvLyBMb2cgYWxsIHdhcm5pbmdzIGFuZCBlcnJvcnMgZ2VuZXJhdGVkIGR1cmluZyBidW5kbGluZ1xuICBhd2FpdCBsb2dNZXNzYWdlcyhjb250ZXh0LCByZXN1bHQpO1xuXG4gIC8vIFJldHVybiBpZiB0aGUgYnVuZGxpbmcgZmFpbGVkIHRvIGdlbmVyYXRlIG91dHB1dCBmaWxlcyBvciB0aGVyZSBhcmUgZXJyb3JzXG4gIGlmICghcmVzdWx0Lm91dHB1dEZpbGVzIHx8IHJlc3VsdC5lcnJvcnMubGVuZ3RoKSB7XG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgfVxuXG4gIC8vIFN0cnVjdHVyZSB0aGUgYnVuZGxpbmcgb3V0cHV0IGZpbGVzXG4gIGNvbnN0IGluaXRpYWxGaWxlczogRmlsZUluZm9bXSA9IFtdO1xuICBjb25zdCBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gIGZvciAoY29uc3Qgb3V0cHV0RmlsZSBvZiByZXN1bHQub3V0cHV0RmlsZXMpIHtcbiAgICAvLyBFbnRyaWVzIGluIHRoZSBtZXRhZmlsZSBhcmUgcmVsYXRpdmUgdG8gdGhlIGBhYnNXb3JraW5nRGlyYCBvcHRpb24gd2hpY2ggaXMgc2V0IHRvIHRoZSB3b3Jrc3BhY2VSb290XG4gICAgY29uc3QgcmVsYXRpdmVGaWxlUGF0aCA9IHBhdGgucmVsYXRpdmUod29ya3NwYWNlUm9vdCwgb3V0cHV0RmlsZS5wYXRoKTtcbiAgICBjb25zdCBlbnRyeVBvaW50ID0gcmVzdWx0Lm1ldGFmaWxlPy5vdXRwdXRzW3JlbGF0aXZlRmlsZVBhdGhdPy5lbnRyeVBvaW50O1xuICAgIGlmIChlbnRyeVBvaW50KSB7XG4gICAgICAvLyBBbiBlbnRyeVBvaW50IHZhbHVlIGluZGljYXRlcyBhbiBpbml0aWFsIGZpbGVcbiAgICAgIGluaXRpYWxGaWxlcy5wdXNoKHtcbiAgICAgICAgLy8gUmVtb3ZlIGxlYWRpbmcgZGlyZWN0b3J5IHNlcGFyYXRvclxuICAgICAgICBmaWxlOiBvdXRwdXRGaWxlLnBhdGguc2xpY2UoMSksXG4gICAgICAgIG5hbWU6IGVudHJ5UG9pbnROYW1lTG9va3VwLmdldChlbnRyeVBvaW50KSA/PyAnJyxcbiAgICAgICAgZXh0ZW5zaW9uOiBwYXRoLmV4dG5hbWUob3V0cHV0RmlsZS5wYXRoKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBvdXRwdXRGaWxlcy5wdXNoKG91dHB1dEZpbGUpO1xuICB9XG5cbiAgLy8gQ3JlYXRlIG91dHB1dCBkaXJlY3RvcnkgaWYgbmVlZGVkXG4gIHRyeSB7XG4gICAgYXdhaXQgZnMubWtkaXIob3V0cHV0UGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zdCByZWFzb24gPSAnbWVzc2FnZScgaW4gZSA/IGUubWVzc2FnZSA6ICdVbmtub3duIGVycm9yJztcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcignVW5hYmxlIHRvIGNyZWF0ZSBvdXRwdXQgZGlyZWN0b3J5OiAnICsgcmVhc29uKTtcblxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG4gIH1cblxuICAvLyBQcm9jZXNzIGdsb2JhbCBzdHlsZXNoZWV0c1xuICBpZiAob3B0aW9ucy5zdHlsZXMpIHtcbiAgICAvLyByZXNvbHZlR2xvYmFsU3R5bGVzIGlzIHRlbXBvcmFyaWx5IHJldXNlZCBmcm9tIHRoZSBXZWJwYWNrIGJ1aWxkZXIgY29kZVxuICAgIGNvbnN0IHsgZW50cnlQb2ludHM6IHN0eWxlc2hlZXRFbnRyeXBvaW50cywgbm9JbmplY3ROYW1lcyB9ID0gcmVzb2x2ZUdsb2JhbFN0eWxlcyhcbiAgICAgIG9wdGlvbnMuc3R5bGVzLFxuICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICEhb3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgICk7XG4gICAgZm9yIChjb25zdCBbbmFtZSwgZmlsZXNdIG9mIE9iamVjdC5lbnRyaWVzKHN0eWxlc2hlZXRFbnRyeXBvaW50cykpIHtcbiAgICAgIGNvbnN0IHZpcnR1YWxFbnRyeURhdGEgPSBmaWxlcy5tYXAoKGZpbGUpID0+IGBAaW1wb3J0ICcke2ZpbGV9JztgKS5qb2luKCdcXG4nKTtcbiAgICAgIGNvbnN0IHNoZWV0UmVzdWx0ID0gYXdhaXQgYnVuZGxlU3R5bGVzaGVldFRleHQoXG4gICAgICAgIHZpcnR1YWxFbnRyeURhdGEsXG4gICAgICAgIHsgdmlydHVhbE5hbWU6IGBhbmd1bGFyOnN0eWxlL2dsb2JhbDske25hbWV9YCwgcmVzb2x2ZVBhdGg6IHdvcmtzcGFjZVJvb3QgfSxcbiAgICAgICAge1xuICAgICAgICAgIG9wdGltaXphdGlvbjogISFvcHRpbWl6YXRpb25PcHRpb25zLnN0eWxlcy5taW5pZnksXG4gICAgICAgICAgc291cmNlbWFwOiAhIXNvdXJjZW1hcE9wdGlvbnMuc3R5bGVzLFxuICAgICAgICAgIG91dHB1dE5hbWVzOiBub0luamVjdE5hbWVzLmluY2x1ZGVzKG5hbWUpID8geyBtZWRpYTogb3V0cHV0TmFtZXMubWVkaWEgfSA6IG91dHB1dE5hbWVzLFxuICAgICAgICB9LFxuICAgICAgKTtcblxuICAgICAgYXdhaXQgbG9nTWVzc2FnZXMoY29udGV4dCwgc2hlZXRSZXN1bHQpO1xuICAgICAgaWYgKCFzaGVldFJlc3VsdC5wYXRoKSB7XG4gICAgICAgIC8vIEZhaWxlZCB0byBwcm9jZXNzIHRoZSBzdHlsZXNoZWV0XG4gICAgICAgIGFzc2VydC5vayhcbiAgICAgICAgICBzaGVldFJlc3VsdC5lcnJvcnMubGVuZ3RoLFxuICAgICAgICAgIGBHbG9iYWwgc3R5bGVzaGVldCBwcm9jZXNzaW5nIGZvciAnJHtuYW1lfScgZmFpbGVkIHdpdGggbm8gZXJyb3JzLmAsXG4gICAgICAgICk7XG5cbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIHZpcnR1YWwgc3R5bGVzaGVldHMgd2lsbCBiZSBuYW1lZCBgc3RkaW5gIGJ5IGVzYnVpbGQuIFRoaXMgbXVzdCBiZSByZXBsYWNlZFxuICAgICAgLy8gd2l0aCB0aGUgYWN0dWFsIG5hbWUgb2YgdGhlIGdsb2JhbCBzdHlsZSBhbmQgdGhlIGxlYWRpbmcgZGlyZWN0b3J5IHNlcGFyYXRvciBtdXN0XG4gICAgICAvLyBhbHNvIGJlIHJlbW92ZWQgdG8gbWFrZSB0aGUgcGF0aCByZWxhdGl2ZS5cbiAgICAgIGNvbnN0IHNoZWV0UGF0aCA9IHNoZWV0UmVzdWx0LnBhdGgucmVwbGFjZSgnc3RkaW4nLCBuYW1lKS5zbGljZSgxKTtcbiAgICAgIG91dHB1dEZpbGVzLnB1c2goY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0KHNoZWV0UGF0aCwgc2hlZXRSZXN1bHQuY29udGVudHMpKTtcbiAgICAgIGlmIChzaGVldFJlc3VsdC5tYXApIHtcbiAgICAgICAgb3V0cHV0RmlsZXMucHVzaChjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQoc2hlZXRQYXRoICsgJy5tYXAnLCBzaGVldFJlc3VsdC5tYXApKTtcbiAgICAgIH1cbiAgICAgIGlmICghbm9JbmplY3ROYW1lcy5pbmNsdWRlcyhuYW1lKSkge1xuICAgICAgICBpbml0aWFsRmlsZXMucHVzaCh7XG4gICAgICAgICAgZmlsZTogc2hlZXRQYXRoLFxuICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgZXh0ZW5zaW9uOiAnLmNzcycsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgb3V0cHV0RmlsZXMucHVzaCguLi5zaGVldFJlc3VsdC5yZXNvdXJjZUZpbGVzKTtcbiAgICB9XG4gIH1cblxuICAvLyBHZW5lcmF0ZSBpbmRleCBIVE1MIGZpbGVcbiAgaWYgKG9wdGlvbnMuaW5kZXgpIHtcbiAgICBjb25zdCBlbnRyeXBvaW50cyA9IGdlbmVyYXRlRW50cnlQb2ludHMoe1xuICAgICAgc2NyaXB0czogb3B0aW9ucy5zY3JpcHRzID8/IFtdLFxuICAgICAgc3R5bGVzOiBvcHRpb25zLnN0eWxlcyA/PyBbXSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBhbiBpbmRleCBIVE1MIGdlbmVyYXRvciB0aGF0IHJlYWRzIGZyb20gdGhlIGluLW1lbW9yeSBvdXRwdXQgZmlsZXNcbiAgICBjb25zdCBpbmRleEh0bWxHZW5lcmF0b3IgPSBuZXcgSW5kZXhIdG1sR2VuZXJhdG9yKHtcbiAgICAgIGluZGV4UGF0aDogcGF0aC5qb2luKGNvbnRleHQud29ya3NwYWNlUm9vdCwgZ2V0SW5kZXhJbnB1dEZpbGUob3B0aW9ucy5pbmRleCkpLFxuICAgICAgZW50cnlwb2ludHMsXG4gICAgICBzcmk6IG9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgICBvcHRpbWl6YXRpb246IG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgICBjcm9zc09yaWdpbjogb3B0aW9ucy5jcm9zc09yaWdpbixcbiAgICB9KTtcbiAgICBpbmRleEh0bWxHZW5lcmF0b3IucmVhZEFzc2V0ID0gYXN5bmMgZnVuY3Rpb24gKHBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgICAvLyBSZW1vdmUgbGVhZGluZyBkaXJlY3Rvcnkgc2VwYXJhdG9yXG4gICAgICBwYXRoID0gcGF0aC5zbGljZSgxKTtcbiAgICAgIGNvbnN0IGZpbGUgPSBvdXRwdXRGaWxlcy5maW5kKChmaWxlKSA9PiBmaWxlLnBhdGggPT09IHBhdGgpO1xuICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgcmV0dXJuIGZpbGUudGV4dDtcbiAgICAgIH1cblxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBPdXRwdXQgZmlsZSBkb2VzIG5vdCBleGlzdDogJHtwYXRofWApO1xuICAgIH07XG5cbiAgICBjb25zdCB7IGNvbnRlbnQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IGluZGV4SHRtbEdlbmVyYXRvci5wcm9jZXNzKHtcbiAgICAgIGJhc2VIcmVmOiBvcHRpb25zLmJhc2VIcmVmLFxuICAgICAgbGFuZzogdW5kZWZpbmVkLFxuICAgICAgb3V0cHV0UGF0aDogJy8nLCAvLyBWaXJ0dWFsIG91dHB1dCBwYXRoIHRvIHN1cHBvcnQgcmVhZGluZyBpbi1tZW1vcnkgZmlsZXNcbiAgICAgIGZpbGVzOiBpbml0aWFsRmlsZXMsXG4gICAgfSk7XG5cbiAgICBmb3IgKGNvbnN0IGVycm9yIG9mIGVycm9ycykge1xuICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZXJyb3IpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHdhcm5pbmcgb2Ygd2FybmluZ3MpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4od2FybmluZyk7XG4gICAgfVxuXG4gICAgb3V0cHV0RmlsZXMucHVzaChjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQoZ2V0SW5kZXhPdXRwdXRGaWxlKG9wdGlvbnMuaW5kZXgpLCBjb250ZW50KSk7XG4gIH1cblxuICAvLyBDb3B5IGFzc2V0c1xuICBpZiAoYXNzZXRzKSB7XG4gICAgYXdhaXQgY29weUFzc2V0cyhhc3NldHMsIFtvdXRwdXRQYXRoXSwgd29ya3NwYWNlUm9vdCk7XG4gIH1cblxuICAvLyBXcml0ZSBvdXRwdXQgZmlsZXNcbiAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgb3V0cHV0RmlsZXMubWFwKChmaWxlKSA9PiBmcy53cml0ZUZpbGUocGF0aC5qb2luKG91dHB1dFBhdGgsIGZpbGUucGF0aCksIGZpbGUuY29udGVudHMpKSxcbiAgKTtcblxuICBjb250ZXh0LmxvZ2dlci5pbmZvKGBDb21wbGV0ZS4gWyR7KERhdGUubm93KCkgLSBzdGFydFRpbWUpIC8gMTAwMH0gc2Vjb25kc11gKTtcblxuICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChwYXRoOiBzdHJpbmcsIHRleHQ6IHN0cmluZyk6IE91dHB1dEZpbGUge1xuICByZXR1cm4ge1xuICAgIHBhdGgsXG4gICAgdGV4dCxcbiAgICBnZXQgY29udGVudHMoKSB7XG4gICAgICByZXR1cm4gQnVmZmVyLmZyb20odGhpcy50ZXh0LCAndXRmLTgnKTtcbiAgICB9LFxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBidW5kbGVDb2RlKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+LFxuICBvdXRwdXROYW1lczogeyBidW5kbGVzOiBzdHJpbmc7IG1lZGlhOiBzdHJpbmcgfSxcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICBvcHRpbWl6YXRpb25PcHRpb25zOiBOb3JtYWxpemVkT3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgc291cmNlbWFwT3B0aW9uczogU291cmNlTWFwQ2xhc3MsXG4gIHRzY29uZmlnOiBzdHJpbmcsXG4pIHtcbiAgcmV0dXJuIGJ1bmRsZSh7XG4gICAgYWJzV29ya2luZ0Rpcjogd29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IHRydWUsXG4gICAgZm9ybWF0OiAnZXNtJyxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBlbnRyeU5hbWVzOiBvdXRwdXROYW1lcy5idW5kbGVzLFxuICAgIGFzc2V0TmFtZXM6IG91dHB1dE5hbWVzLm1lZGlhLFxuICAgIHRhcmdldDogJ2VzMjAyMCcsXG4gICAgbWFpbkZpZWxkczogWydlczIwMjAnLCAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbiddLFxuICAgIGNvbmRpdGlvbnM6IFsnZXMyMDIwJywgJ21vZHVsZSddLFxuICAgIHJlc29sdmVFeHRlbnNpb25zOiBbJy50cycsICcudHN4JywgJy5tanMnLCAnLmpzJ10sXG4gICAgbG9nTGV2ZWw6IG9wdGlvbnMudmVyYm9zZSA/ICdkZWJ1ZycgOiAnc2lsZW50JyxcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBtaW5pZnk6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBwdXJlOiBbJ2ZvcndhcmRSZWYnXSxcbiAgICBvdXRkaXI6ICcvJyxcbiAgICBzb3VyY2VtYXA6IHNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyAmJiAoc291cmNlbWFwT3B0aW9ucy5oaWRkZW4gPyAnZXh0ZXJuYWwnIDogdHJ1ZSksXG4gICAgc3BsaXR0aW5nOiB0cnVlLFxuICAgIHRzY29uZmlnLFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIHByZXNlcnZlU3ltbGlua3M6IG9wdGlvbnMucHJlc2VydmVTeW1saW5rcyxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVDb21waWxlclBsdWdpbihcbiAgICAgICAgLy8gSlMvVFMgb3B0aW9uc1xuICAgICAgICB7XG4gICAgICAgICAgc291cmNlbWFwOiAhIXNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyxcbiAgICAgICAgICB0c2NvbmZpZyxcbiAgICAgICAgICBhZHZhbmNlZE9wdGltaXphdGlvbnM6IG9wdGlvbnMuYnVpbGRPcHRpbWl6ZXIsXG4gICAgICAgIH0sXG4gICAgICAgIC8vIENvbXBvbmVudCBzdHlsZXNoZWV0IG9wdGlvbnNcbiAgICAgICAge1xuICAgICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgb3B0aW1pemF0aW9uOiAhIW9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLm1pbmlmeSxcbiAgICAgICAgICBzb3VyY2VtYXA6ICEhc291cmNlbWFwT3B0aW9ucy5zdHlsZXMsXG4gICAgICAgICAgb3V0cHV0TmFtZXMsXG4gICAgICAgIH0sXG4gICAgICApLFxuICAgIF0sXG4gICAgZGVmaW5lOiB7XG4gICAgICAnbmdEZXZNb2RlJzogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzID8gJ2ZhbHNlJyA6ICd0cnVlJyxcbiAgICAgICduZ0ppdE1vZGUnOiAnZmFsc2UnLFxuICAgIH0sXG4gIH0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVCdWlsZGVyKGV4ZWN1dGUpO1xuIl19