"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeBuild = void 0;
const source_file_cache_1 = require("../../tools/esbuild/angular/source-file-cache");
const application_code_bundle_1 = require("../../tools/esbuild/application-code-bundle");
const budget_stats_1 = require("../../tools/esbuild/budget-stats");
const bundler_context_1 = require("../../tools/esbuild/bundler-context");
const bundler_execution_result_1 = require("../../tools/esbuild/bundler-execution-result");
const commonjs_checker_1 = require("../../tools/esbuild/commonjs-checker");
const global_scripts_1 = require("../../tools/esbuild/global-scripts");
const global_styles_1 = require("../../tools/esbuild/global-styles");
const license_extractor_1 = require("../../tools/esbuild/license-extractor");
const utils_1 = require("../../tools/esbuild/utils");
const bundle_calculator_1 = require("../../utils/bundle-calculator");
const color_1 = require("../../utils/color");
const copy_assets_1 = require("../../utils/copy-assets");
const supported_browsers_1 = require("../../utils/supported-browsers");
const execute_post_bundle_1 = require("./execute-post-bundle");
const i18n_1 = require("./i18n");
// eslint-disable-next-line max-lines-per-function
async function executeBuild(options, context, rebuildState) {
    const { projectRoot, workspaceRoot, i18nOptions, optimizationOptions, serverEntryPoint, assets, cacheOptions, prerenderOptions, appShellOptions, ssrOptions, } = options;
    const browsers = (0, supported_browsers_1.getSupportedBrowsers)(projectRoot, context.logger);
    const target = (0, utils_1.transformSupportedBrowsersToTargets)(browsers);
    // Load active translations if inlining
    // TODO: Integrate into watch mode and only load changed translations
    if (i18nOptions.shouldInline) {
        await (0, i18n_1.loadActiveTranslations)(context, i18nOptions);
    }
    // Reuse rebuild state or create new bundle contexts for code and global stylesheets
    let bundlerContexts = rebuildState?.rebuildContexts;
    const codeBundleCache = rebuildState?.codeBundleCache ??
        new source_file_cache_1.SourceFileCache(cacheOptions.enabled ? cacheOptions.path : undefined);
    if (bundlerContexts === undefined) {
        bundlerContexts = [];
        // Browser application code
        bundlerContexts.push(new bundler_context_1.BundlerContext(workspaceRoot, !!options.watch, (0, application_code_bundle_1.createBrowserCodeBundleOptions)(options, target, codeBundleCache)));
        // Browser polyfills code
        const browserPolyfillBundleOptions = (0, application_code_bundle_1.createBrowserPolyfillBundleOptions)(options, target, codeBundleCache);
        if (browserPolyfillBundleOptions) {
            bundlerContexts.push(new bundler_context_1.BundlerContext(workspaceRoot, !!options.watch, browserPolyfillBundleOptions));
        }
        // Global Stylesheets
        if (options.globalStyles.length > 0) {
            for (const initial of [true, false]) {
                const bundleOptions = (0, global_styles_1.createGlobalStylesBundleOptions)(options, target, initial);
                if (bundleOptions) {
                    bundlerContexts.push(new bundler_context_1.BundlerContext(workspaceRoot, !!options.watch, bundleOptions, () => initial));
                }
            }
        }
        // Global Scripts
        if (options.globalScripts.length > 0) {
            for (const initial of [true, false]) {
                const bundleOptions = (0, global_scripts_1.createGlobalScriptsBundleOptions)(options, target, initial);
                if (bundleOptions) {
                    bundlerContexts.push(new bundler_context_1.BundlerContext(workspaceRoot, !!options.watch, bundleOptions, () => initial));
                }
            }
        }
        // Skip server build when none of the features are enabled.
        if (serverEntryPoint && (prerenderOptions || appShellOptions || ssrOptions)) {
            const nodeTargets = [...target, ...(0, utils_1.getSupportedNodeTargets)()];
            // Server application code
            bundlerContexts.push(new bundler_context_1.BundlerContext(workspaceRoot, !!options.watch, (0, application_code_bundle_1.createServerCodeBundleOptions)({
                ...options,
                // Disable external deps for server bundles.
                // This is because it breaks Vite 'optimizeDeps' for SSR.
                externalPackages: false,
            }, nodeTargets, codeBundleCache), () => false));
            // Server polyfills code
            const serverPolyfillBundleOptions = (0, application_code_bundle_1.createServerPolyfillBundleOptions)(options, nodeTargets, codeBundleCache);
            if (serverPolyfillBundleOptions) {
                bundlerContexts.push(new bundler_context_1.BundlerContext(workspaceRoot, !!options.watch, serverPolyfillBundleOptions, () => false));
            }
        }
    }
    const bundlingResult = await bundler_context_1.BundlerContext.bundleAll(bundlerContexts, rebuildState?.fileChanges.all);
    // Log all warnings and errors generated during bundling
    await (0, utils_1.logMessages)(context, bundlingResult);
    const executionResult = new bundler_execution_result_1.ExecutionResult(bundlerContexts, codeBundleCache);
    // Return if the bundling has errors
    if (bundlingResult.errors) {
        executionResult.addErrors(bundlingResult.errors);
        return executionResult;
    }
    // Analyze external imports if external options are enabled
    if (options.externalPackages || options.externalDependencies?.length) {
        const { browser = new Set(), server = new Set() } = bundlingResult.externalImports;
        // TODO: Filter externalImports to generate second argument to support wildcard externalDependency values
        executionResult.setExternalMetadata([...browser], [...server], options.externalDependencies);
    }
    const { metafile, initialFiles, outputFiles } = bundlingResult;
    executionResult.outputFiles.push(...outputFiles);
    const changedFiles = rebuildState && executionResult.findChangedFiles(rebuildState.previousOutputHashes);
    // Analyze files for bundle budget failures if present
    let budgetFailures;
    if (options.budgets) {
        const compatStats = (0, budget_stats_1.generateBudgetStats)(metafile, initialFiles);
        budgetFailures = [...(0, bundle_calculator_1.checkBudgets)(options.budgets, compatStats, true)];
        if (budgetFailures.length > 0) {
            const errors = budgetFailures
                .filter((failure) => failure.severity === 'error')
                .map(({ message }) => message);
            const warnings = budgetFailures
                .filter((failure) => failure.severity !== 'error')
                .map(({ message }) => message);
            await printWarningsAndErrorsToConsoleAndAddToResult(context, executionResult, warnings, errors);
        }
    }
    // Calculate estimated transfer size if scripts are optimized
    let estimatedTransferSizes;
    if (optimizationOptions.scripts || optimizationOptions.styles.minify) {
        estimatedTransferSizes = await (0, utils_1.calculateEstimatedTransferSizes)(executionResult.outputFiles);
    }
    // Check metafile for CommonJS module usage if optimizing scripts
    if (optimizationOptions.scripts) {
        const messages = (0, commonjs_checker_1.checkCommonJSModules)(metafile, options.allowedCommonJsDependencies);
        await (0, utils_1.logMessages)(context, { warnings: messages });
    }
    // Copy assets
    if (assets) {
        // The webpack copy assets helper is used with no base paths defined. This prevents the helper
        // from directly writing to disk. This should eventually be replaced with a more optimized helper.
        executionResult.addAssets(await (0, copy_assets_1.copyAssets)(assets, [], workspaceRoot));
    }
    // Extract and write licenses for used packages
    if (options.extractLicenses) {
        executionResult.addOutputFile('3rdpartylicenses.txt', await (0, license_extractor_1.extractLicenses)(metafile, workspaceRoot), bundler_context_1.BuildOutputFileType.Root);
    }
    // Perform i18n translation inlining if enabled
    let prerenderedRoutes;
    let errors;
    let warnings;
    if (i18nOptions.shouldInline) {
        const result = await (0, i18n_1.inlineI18n)(options, executionResult, initialFiles);
        errors = result.errors;
        warnings = result.warnings;
        prerenderedRoutes = result.prerenderedRoutes;
    }
    else {
        const result = await (0, execute_post_bundle_1.executePostBundleSteps)(options, executionResult.outputFiles, executionResult.assetFiles, initialFiles, 
        // Set lang attribute to the defined source locale if present
        i18nOptions.hasDefinedSourceLocale ? i18nOptions.sourceLocale : undefined);
        errors = result.errors;
        warnings = result.warnings;
        prerenderedRoutes = result.prerenderedRoutes;
        executionResult.outputFiles.push(...result.additionalOutputFiles);
        executionResult.assetFiles.push(...result.additionalAssets);
    }
    await printWarningsAndErrorsToConsoleAndAddToResult(context, executionResult, warnings, errors);
    if (prerenderOptions) {
        executionResult.addOutputFile('prerendered-routes.json', JSON.stringify({ routes: prerenderedRoutes.sort((a, b) => a.localeCompare(b)) }, null, 2), bundler_context_1.BuildOutputFileType.Root);
        let prerenderMsg = `Prerendered ${prerenderedRoutes.length} static route`;
        if (prerenderedRoutes.length > 1) {
            prerenderMsg += 's.';
        }
        else {
            prerenderMsg += '.';
        }
        context.logger.info(color_1.colors.magenta(prerenderMsg) + '\n');
    }
    (0, utils_1.logBuildStats)(context, metafile, initialFiles, budgetFailures, changedFiles, estimatedTransferSizes);
    // Write metafile if stats option is enabled
    if (options.stats) {
        executionResult.addOutputFile('stats.json', JSON.stringify(metafile, null, 2), bundler_context_1.BuildOutputFileType.Root);
    }
    return executionResult;
}
exports.executeBuild = executeBuild;
async function printWarningsAndErrorsToConsoleAndAddToResult(context, executionResult, warnings, errors) {
    const errorMessages = errors.map((text) => ({ text, location: null }));
    if (errorMessages.length) {
        executionResult.addErrors(errorMessages);
    }
    await (0, utils_1.logMessages)(context, {
        errors: errorMessages,
        warnings: warnings.map((text) => ({ text, location: null })),
    });
}
