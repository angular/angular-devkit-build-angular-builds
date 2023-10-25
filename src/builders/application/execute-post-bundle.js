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
exports.executePostBundleSteps = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const bundler_context_1 = require("../../tools/esbuild/bundler-context");
const index_html_generator_1 = require("../../tools/esbuild/index-html-generator");
const utils_1 = require("../../tools/esbuild/utils");
const environment_options_1 = require("../../utils/environment-options");
const prerender_1 = require("../../utils/server-rendering/prerender");
const service_worker_1 = require("../../utils/service-worker");
/**
 * Run additional builds steps including SSG, AppShell, Index HTML file and Service worker generation.
 * @param options The normalized application builder options used to create the build.
 * @param outputFiles The output files of an executed build.
 * @param assetFiles The assets of an executed build.
 * @param initialFiles A map containing initial file information for the executed build.
 * @param locale A language locale to insert in the index.html.
 */
async function executePostBundleSteps(options, outputFiles, assetFiles, initialFiles, locale) {
    const additionalAssets = [];
    const additionalOutputFiles = [];
    const allErrors = [];
    const allWarnings = [];
    const prerenderedRoutes = [];
    const { serviceWorker, indexHtmlOptions, optimizationOptions, sourcemapOptions, ssrOptions, prerenderOptions, appShellOptions, workspaceRoot, verbose, } = options;
    /**
     * Index HTML content without CSS inlining to be used for server rendering (AppShell, SSG and SSR).
     *
     * NOTE: we don't perform critical CSS inlining as this will be done during server rendering.
     */
    let indexContentOutputNoCssInlining;
    // Generate index HTML file
    // If localization is enabled, index generation is handled in the inlining process.
    // NOTE: Localization with SSR is not currently supported.
    if (indexHtmlOptions) {
        const { content, contentWithoutCriticalCssInlined, errors, warnings } = await (0, index_html_generator_1.generateIndexHtml)(initialFiles, outputFiles, {
            ...options,
            optimizationOptions,
        }, locale);
        indexContentOutputNoCssInlining = contentWithoutCriticalCssInlined;
        allErrors.push(...errors);
        allWarnings.push(...warnings);
        additionalOutputFiles.push((0, utils_1.createOutputFileFromText)(indexHtmlOptions.output, content, bundler_context_1.BuildOutputFileType.Browser));
        if (ssrOptions) {
            additionalOutputFiles.push((0, utils_1.createOutputFileFromText)('index.server.html', contentWithoutCriticalCssInlined, bundler_context_1.BuildOutputFileType.Server));
        }
    }
    // Pre-render (SSG) and App-shell
    // If localization is enabled, prerendering is handled in the inlining process.
    if (prerenderOptions || appShellOptions) {
        (0, node_assert_1.default)(indexContentOutputNoCssInlining, 'The "index" option is required when using the "ssg" or "appShell" options.');
        const { output, warnings, errors, prerenderedRoutes: generatedRoutes, } = await (0, prerender_1.prerenderPages)(workspaceRoot, appShellOptions, prerenderOptions, outputFiles, assetFiles, indexContentOutputNoCssInlining, sourcemapOptions.scripts, optimizationOptions.styles.inlineCritical, environment_options_1.maxWorkers, verbose);
        allErrors.push(...errors);
        allWarnings.push(...warnings);
        prerenderedRoutes.push(...Array.from(generatedRoutes));
        for (const [path, content] of Object.entries(output)) {
            additionalOutputFiles.push((0, utils_1.createOutputFileFromText)(path, content, bundler_context_1.BuildOutputFileType.Browser));
        }
    }
    // Augment the application with service worker support
    // If localization is enabled, service worker is handled in the inlining process.
    if (serviceWorker) {
        try {
            const serviceWorkerResult = await (0, service_worker_1.augmentAppWithServiceWorkerEsbuild)(workspaceRoot, serviceWorker, options.baseHref || '/', outputFiles, assetFiles);
            additionalOutputFiles.push((0, utils_1.createOutputFileFromText)('ngsw.json', serviceWorkerResult.manifest, bundler_context_1.BuildOutputFileType.Browser));
            additionalAssets.push(...serviceWorkerResult.assetFiles);
        }
        catch (error) {
            allErrors.push(error instanceof Error ? error.message : `${error}`);
        }
    }
    return {
        errors: allErrors,
        warnings: allWarnings,
        additionalAssets,
        prerenderedRoutes,
        additionalOutputFiles,
    };
}
exports.executePostBundleSteps = executePostBundleSteps;
