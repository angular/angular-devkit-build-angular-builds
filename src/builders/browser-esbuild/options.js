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
exports.normalizeOptions = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_module_1 = require("node:module");
const node_path_1 = __importDefault(require("node:path"));
const utils_1 = require("../../utils");
const normalize_cache_1 = require("../../utils/normalize-cache");
const package_chunk_sort_1 = require("../../utils/package-chunk-sort");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const helpers_1 = require("../../webpack/utils/helpers");
const schema_1 = require("./schema");
/**
 * Normalize the user provided options by creating full paths for all path based options
 * and converting multi-form options into a single form that can be directly used
 * by the build process.
 *
 * @param context The context for current builder execution.
 * @param projectName The name of the project for the current execution.
 * @param options An object containing the options to use for the build.
 * @returns An object containing normalized options required to perform the build.
 */
async function normalizeOptions(context, projectName, options) {
    const workspaceRoot = context.workspaceRoot;
    const projectMetadata = await context.getProjectMetadata(projectName);
    const projectRoot = node_path_1.default.join(workspaceRoot, projectMetadata.root ?? '');
    const projectSourceRoot = node_path_1.default.join(workspaceRoot, projectMetadata.sourceRoot ?? 'src');
    const cacheOptions = (0, normalize_cache_1.normalizeCacheOptions)(projectMetadata, workspaceRoot);
    const mainEntryPoint = node_path_1.default.join(workspaceRoot, options.main);
    const tsconfig = node_path_1.default.join(workspaceRoot, options.tsConfig);
    const outputPath = node_path_1.default.join(workspaceRoot, options.outputPath);
    const optimizationOptions = (0, utils_1.normalizeOptimization)(options.optimization);
    const sourcemapOptions = (0, utils_1.normalizeSourceMaps)(options.sourceMap ?? false);
    const assets = options.assets?.length
        ? (0, utils_1.normalizeAssetPatterns)(options.assets, workspaceRoot, projectRoot, projectSourceRoot)
        : undefined;
    const outputNames = {
        bundles: options.outputHashing === schema_1.OutputHashing.All || options.outputHashing === schema_1.OutputHashing.Bundles
            ? '[name].[hash]'
            : '[name]',
        media: options.outputHashing === schema_1.OutputHashing.All || options.outputHashing === schema_1.OutputHashing.Media
            ? '[name].[hash]'
            : '[name]',
    };
    if (options.resourcesOutputPath) {
        outputNames.media = node_path_1.default.join(options.resourcesOutputPath, outputNames.media);
    }
    let fileReplacements;
    if (options.fileReplacements) {
        for (const replacement of options.fileReplacements) {
            fileReplacements ?? (fileReplacements = {});
            fileReplacements[node_path_1.default.join(workspaceRoot, replacement.replace)] = node_path_1.default.join(workspaceRoot, replacement.with);
        }
    }
    const globalStyles = [];
    if (options.styles?.length) {
        const { entryPoints: stylesheetEntrypoints, noInjectNames } = (0, helpers_1.normalizeGlobalStyles)(options.styles || []);
        for (const [name, files] of Object.entries(stylesheetEntrypoints)) {
            globalStyles.push({ name, files, initial: !noInjectNames.includes(name) });
        }
    }
    let tailwindConfiguration;
    const tailwindConfigurationPath = findTailwindConfigurationFile(workspaceRoot, projectRoot);
    if (tailwindConfigurationPath) {
        // Create a node resolver at the project root as a directory
        const resolver = (0, node_module_1.createRequire)(projectRoot + '/');
        try {
            tailwindConfiguration = {
                file: tailwindConfigurationPath,
                package: resolver.resolve('tailwindcss'),
            };
        }
        catch {
            const relativeTailwindConfigPath = node_path_1.default.relative(workspaceRoot, tailwindConfigurationPath);
            context.logger.warn(`Tailwind CSS configuration file found (${relativeTailwindConfigPath})` +
                ` but the 'tailwindcss' package is not installed.` +
                ` To enable Tailwind CSS, please install the 'tailwindcss' package.`);
        }
    }
    let serviceWorkerOptions;
    if (options.serviceWorker) {
        // If ngswConfigPath is not specified, the default is 'ngsw-config.json' within the project root
        serviceWorkerOptions = options.ngswConfigPath
            ? node_path_1.default.join(workspaceRoot, options.ngswConfigPath)
            : node_path_1.default.join(projectRoot, 'ngsw-config.json');
    }
    // Setup bundler entry points
    const entryPoints = {
        main: mainEntryPoint,
    };
    let indexHtmlOptions;
    if (options.index) {
        indexHtmlOptions = {
            input: node_path_1.default.join(workspaceRoot, (0, webpack_browser_config_1.getIndexInputFile)(options.index)),
            // The output file will be created within the configured output path
            output: (0, webpack_browser_config_1.getIndexOutputFile)(options.index),
            // TODO: Use existing information from above to create the insertion order
            insertionOrder: (0, package_chunk_sort_1.generateEntryPoints)({
                scripts: options.scripts ?? [],
                styles: options.styles ?? [],
            }),
        };
    }
    // Initial options to keep
    const { allowedCommonJsDependencies, aot, baseHref, buildOptimizer, crossOrigin, externalDependencies, extractLicenses, inlineStyleLanguage = 'css', poll, polyfills, preserveSymlinks, statsJson, stylePreprocessorOptions, subresourceIntegrity, verbose, watch, } = options;
    // Return all the normalized options
    return {
        advancedOptimizations: buildOptimizer,
        allowedCommonJsDependencies,
        baseHref,
        cacheOptions,
        crossOrigin,
        externalDependencies,
        extractLicenses,
        inlineStyleLanguage,
        jit: !aot,
        stats: !!statsJson,
        polyfills: polyfills === undefined || Array.isArray(polyfills) ? polyfills : [polyfills],
        poll,
        // If not explicitly set, default to the Node.js process argument
        preserveSymlinks: preserveSymlinks ?? process.execArgv.includes('--preserve-symlinks'),
        stylePreprocessorOptions,
        subresourceIntegrity,
        verbose,
        watch,
        workspaceRoot,
        entryPoints,
        optimizationOptions,
        outputPath,
        sourcemapOptions,
        tsconfig,
        projectRoot,
        assets,
        outputNames,
        fileReplacements,
        globalStyles,
        serviceWorkerOptions,
        indexHtmlOptions,
        tailwindConfiguration,
    };
}
exports.normalizeOptions = normalizeOptions;
function findTailwindConfigurationFile(workspaceRoot, projectRoot) {
    // A configuration file can exist in the project or workspace root
    // The list of valid config files can be found:
    // https://github.com/tailwindlabs/tailwindcss/blob/8845d112fb62d79815b50b3bae80c317450b8b92/src/util/resolveConfigPath.js#L46-L52
    const tailwindConfigFiles = ['tailwind.config.js', 'tailwind.config.cjs'];
    for (const basePath of [projectRoot, workspaceRoot]) {
        for (const configFile of tailwindConfigFiles) {
            // Project level configuration should always take precedence.
            const fullPath = node_path_1.default.join(basePath, configFile);
            if (node_fs_1.default.existsSync(fullPath)) {
                return fullPath;
            }
        }
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9vcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILHNEQUF5QjtBQUN6Qiw2Q0FBNEM7QUFDNUMsMERBQTZCO0FBQzdCLHVDQUFpRztBQUNqRyxpRUFBb0U7QUFDcEUsdUVBQXFFO0FBQ3JFLCtFQUEyRjtBQUMzRix5REFBb0U7QUFDcEUscUNBQTBFO0FBSTFFOzs7Ozs7Ozs7R0FTRztBQUNJLEtBQUssVUFBVSxnQkFBZ0IsQ0FDcEMsT0FBdUIsRUFDdkIsV0FBbUIsRUFDbkIsT0FBOEI7SUFFOUIsTUFBTSxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUM1QyxNQUFNLGVBQWUsR0FBRyxNQUFNLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN0RSxNQUFNLFdBQVcsR0FBRyxtQkFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUcsZUFBZSxDQUFDLElBQTJCLElBQUksRUFBRSxDQUFDLENBQUM7SUFDakcsTUFBTSxpQkFBaUIsR0FBRyxtQkFBSSxDQUFDLElBQUksQ0FDakMsYUFBYSxFQUNaLGVBQWUsQ0FBQyxVQUFpQyxJQUFJLEtBQUssQ0FDNUQsQ0FBQztJQUVGLE1BQU0sWUFBWSxHQUFHLElBQUEsdUNBQXFCLEVBQUMsZUFBZSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBRTNFLE1BQU0sY0FBYyxHQUFHLG1CQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUQsTUFBTSxRQUFRLEdBQUcsbUJBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMs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QkFBbUIsR0FBRyxDQUFDLG9CQUFvQixFQUFFLHFCQUFxQixDQUFDLENBQUM7SUFDMUUsS0FBSyxNQUFNLFFBQVEsSUFBSSxDQUFDLFdBQVcsRUFBRSxhQUFhLENBQUMsRUFBRTtRQUNuRCxLQUFLLE1BQU0sVUFBVSxJQUFJLG1CQUFtQixFQUFFO1lBQzVDLDZEQUE2RDtZQUM3RCxNQUFNLFFBQVEsR0FBRyxtQkFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDakQsSUFBSSxpQkFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDM0IsT0FBTyxRQUFRLENBQUM7YUFDakI7U0FDRjtLQUNGO0lBRUQsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBub3JtYWxpemVBc3NldFBhdHRlcm5zLCBub3JtYWxpemVPcHRpbWl6YXRpb24sIG5vcm1hbGl6ZVNvdXJjZU1hcHMgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBub3JtYWxpemVDYWNoZU9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9ub3JtYWxpemUtY2FjaGUnO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cyB9IGZyb20gJy4uLy4uL3V0aWxzL3BhY2thZ2UtY2h1bmstc29ydCc7XG5pbXBvcnQgeyBnZXRJbmRleElucHV0RmlsZSwgZ2V0SW5kZXhPdXRwdXRGaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBub3JtYWxpemVHbG9iYWxTdHlsZXMgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL2hlbHBlcnMnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucywgT3V0cHV0SGFzaGluZyB9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IHR5cGUgTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zID0gQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBub3JtYWxpemVPcHRpb25zPj47XG5cbi8qKlxuICogTm9ybWFsaXplIHRoZSB1c2VyIHByb3ZpZGVkIG9wdGlvbnMgYnkgY3JlYXRpbmcgZnVsbCBwYXRocyBmb3IgYWxsIHBhdGggYmFzZWQgb3B0aW9uc1xuICogYW5kIGNvbnZlcnRpbmcgbXVsdGktZm9ybSBvcHRpb25zIGludG8gYSBzaW5nbGUgZm9ybSB0aGF0IGNhbiBiZSBkaXJlY3RseSB1c2VkXG4gKiBieSB0aGUgYnVpbGQgcHJvY2Vzcy5cbiAqXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgY29udGV4dCBmb3IgY3VycmVudCBidWlsZGVyIGV4ZWN1dGlvbi5cbiAqIEBwYXJhbSBwcm9qZWN0TmFtZSBUaGUgbmFtZSBvZiB0aGUgcHJvamVjdCBmb3IgdGhlIGN1cnJlbnQgZXhlY3V0aW9uLlxuICogQHBhcmFtIG9wdGlvbnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIG9wdGlvbnMgdG8gdXNlIGZvciB0aGUgYnVpbGQuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyBub3JtYWxpemVkIG9wdGlvbnMgcmVxdWlyZWQgdG8gcGVyZm9ybSB0aGUgYnVpbGQuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBub3JtYWxpemVPcHRpb25zKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuKSB7XG4gIGNvbnN0IHdvcmtzcGFjZVJvb3QgPSBjb250ZXh0LndvcmtzcGFjZVJvb3Q7XG4gIGNvbnN0IHByb2plY3RNZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgY29uc3QgcHJvamVjdFJvb3QgPSBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgKHByb2plY3RNZXRhZGF0YS5yb290IGFzIHN0cmluZyB8IHVuZGVmaW5lZCkgPz8gJycpO1xuICBjb25zdCBwcm9qZWN0U291cmNlUm9vdCA9IHBhdGguam9pbihcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIChwcm9qZWN0TWV0YWRhdGEuc291cmNlUm9vdCBhcyBzdHJpbmcgfCB1bmRlZmluZWQpID8/ICdzcmMnLFxuICApO1xuXG4gIGNvbnN0IGNhY2hlT3B0aW9ucyA9IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyhwcm9qZWN0TWV0YWRhdGEsIHdvcmtzcGFjZVJvb3QpO1xuXG4gIGNvbnN0IG1haW5FbnRyeVBvaW50ID0gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMubWFpbik7XG4gIGNvbnN0IHRzY29uZmlnID0gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMudHNDb25maWcpO1xuICBjb25zdCBvdXRwdXRQYXRoID0gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMub3V0cHV0UGF0aCk7XG4gIGNvbnN0IG9wdGltaXphdGlvbk9wdGlvbnMgPSBub3JtYWxpemVPcHRpbWl6YXRpb24ob3B0aW9ucy5vcHRpbWl6YXRpb24pO1xuICBjb25zdCBzb3VyY2VtYXBPcHRpb25zID0gbm9ybWFsaXplU291cmNlTWFwcyhvcHRpb25zLnNvdXJjZU1hcCA/PyBmYWxzZSk7XG4gIGNvbnN0IGFzc2V0cyA9IG9wdGlvbnMuYXNzZXRzPy5sZW5ndGhcbiAgICA/IG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMob3B0aW9ucy5hc3NldHMsIHdvcmtzcGFjZVJvb3QsIHByb2plY3RSb290LCBwcm9qZWN0U291cmNlUm9vdClcbiAgICA6IHVuZGVmaW5lZDtcblxuICBjb25zdCBvdXRwdXROYW1lcyA9IHtcbiAgICBidW5kbGVzOlxuICAgICAgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLkFsbCB8fCBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuQnVuZGxlc1xuICAgICAgICA/ICdbbmFtZV0uW2hhc2hdJ1xuICAgICAgICA6ICdbbmFtZV0nLFxuICAgIG1lZGlhOlxuICAgICAgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLkFsbCB8fCBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuTWVkaWFcbiAgICAgICAgPyAnW25hbWVdLltoYXNoXSdcbiAgICAgICAgOiAnW25hbWVdJyxcbiAgfTtcbiAgaWYgKG9wdGlvbnMucmVzb3VyY2VzT3V0cHV0UGF0aCkge1xuICAgIG91dHB1dE5hbWVzLm1lZGlhID0gcGF0aC5qb2luKG9wdGlvbnMucmVzb3VyY2VzT3V0cHV0UGF0aCwgb3V0cHV0TmFtZXMubWVkaWEpO1xuICB9XG5cbiAgbGV0IGZpbGVSZXBsYWNlbWVudHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfCB1bmRlZmluZWQ7XG4gIGlmIChvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpIHtcbiAgICBmb3IgKGNvbnN0IHJlcGxhY2VtZW50IG9mIG9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykge1xuICAgICAgZmlsZVJlcGxhY2VtZW50cyA/Pz0ge307XG4gICAgICBmaWxlUmVwbGFjZW1lbnRzW3BhdGguam9pbih3b3Jrc3BhY2VSb290LCByZXBsYWNlbWVudC5yZXBsYWNlKV0gPSBwYXRoLmpvaW4oXG4gICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIHJlcGxhY2VtZW50LndpdGgsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGdsb2JhbFN0eWxlczogeyBuYW1lOiBzdHJpbmc7IGZpbGVzOiBzdHJpbmdbXTsgaW5pdGlhbDogYm9vbGVhbiB9W10gPSBbXTtcbiAgaWYgKG9wdGlvbnMuc3R5bGVzPy5sZW5ndGgpIHtcbiAgICBjb25zdCB7IGVudHJ5UG9pbnRzOiBzdHlsZXNoZWV0RW50cnlwb2ludHMsIG5vSW5qZWN0TmFtZXMgfSA9IG5vcm1hbGl6ZUdsb2JhbFN0eWxlcyhcbiAgICAgIG9wdGlvbnMuc3R5bGVzIHx8IFtdLFxuICAgICk7XG4gICAgZm9yIChjb25zdCBbbmFtZSwgZmlsZXNdIG9mIE9iamVjdC5lbnRyaWVzKHN0eWxlc2hlZXRFbnRyeXBvaW50cykpIHtcbiAgICAgIGdsb2JhbFN0eWxlcy5wdXNoKHsgbmFtZSwgZmlsZXMsIGluaXRpYWw6ICFub0luamVjdE5hbWVzLmluY2x1ZGVzKG5hbWUpIH0pO1xuICAgIH1cbiAgfVxuXG4gIGxldCB0YWlsd2luZENvbmZpZ3VyYXRpb246IHsgZmlsZTogc3RyaW5nOyBwYWNrYWdlOiBzdHJpbmcgfSB8IHVuZGVmaW5lZDtcbiAgY29uc3QgdGFpbHdpbmRDb25maWd1cmF0aW9uUGF0aCA9IGZpbmRUYWlsd2luZENvbmZpZ3VyYXRpb25GaWxlKHdvcmtzcGFjZVJvb3QsIHByb2plY3RSb290KTtcbiAgaWYgKHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgpIHtcbiAgICAvLyBDcmVhdGUgYSBub2RlIHJlc29sdmVyIGF0IHRoZSBwcm9qZWN0IHJvb3QgYXMgYSBkaXJlY3RvcnlcbiAgICBjb25zdCByZXNvbHZlciA9IGNyZWF0ZVJlcXVpcmUocHJvamVjdFJvb3QgKyAnLycpO1xuICAgIHRyeSB7XG4gICAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24gPSB7XG4gICAgICAgIGZpbGU6IHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgsXG4gICAgICAgIHBhY2thZ2U6IHJlc29sdmVyLnJlc29sdmUoJ3RhaWx3aW5kY3NzJyksXG4gICAgICB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29uc3QgcmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGggPSBwYXRoLnJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgpO1xuICAgICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgYFRhaWx3aW5kIENTUyBjb25maWd1cmF0aW9uIGZpbGUgZm91bmQgKCR7cmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGh9KWAgK1xuICAgICAgICAgIGAgYnV0IHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UgaXMgbm90IGluc3RhbGxlZC5gICtcbiAgICAgICAgICBgIFRvIGVuYWJsZSBUYWlsd2luZCBDU1MsIHBsZWFzZSBpbnN0YWxsIHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UuYCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHNlcnZpY2VXb3JrZXJPcHRpb25zO1xuICBpZiAob3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgLy8gSWYgbmdzd0NvbmZpZ1BhdGggaXMgbm90IHNwZWNpZmllZCwgdGhlIGRlZmF1bHQgaXMgJ25nc3ctY29uZmlnLmpzb24nIHdpdGhpbiB0aGUgcHJvamVjdCByb290XG4gICAgc2VydmljZVdvcmtlck9wdGlvbnMgPSBvcHRpb25zLm5nc3dDb25maWdQYXRoXG4gICAgICA/IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLm5nc3dDb25maWdQYXRoKVxuICAgICAgOiBwYXRoLmpvaW4ocHJvamVjdFJvb3QsICduZ3N3LWNvbmZpZy5qc29uJyk7XG4gIH1cblxuICAvLyBTZXR1cCBidW5kbGVyIGVudHJ5IHBvaW50c1xuICBjb25zdCBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICBtYWluOiBtYWluRW50cnlQb2ludCxcbiAgfTtcblxuICBsZXQgaW5kZXhIdG1sT3B0aW9ucztcbiAgaWYgKG9wdGlvbnMuaW5kZXgpIHtcbiAgICBpbmRleEh0bWxPcHRpb25zID0ge1xuICAgICAgaW5wdXQ6IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBnZXRJbmRleElucHV0RmlsZShvcHRpb25zLmluZGV4KSksXG4gICAgICAvLyBUaGUgb3V0cHV0IGZpbGUgd2lsbCBiZSBjcmVhdGVkIHdpdGhpbiB0aGUgY29uZmlndXJlZCBvdXRwdXQgcGF0aFxuICAgICAgb3V0cHV0OiBnZXRJbmRleE91dHB1dEZpbGUob3B0aW9ucy5pbmRleCksXG4gICAgICAvLyBUT0RPOiBVc2UgZXhpc3RpbmcgaW5mb3JtYXRpb24gZnJvbSBhYm92ZSB0byBjcmVhdGUgdGhlIGluc2VydGlvbiBvcmRlclxuICAgICAgaW5zZXJ0aW9uT3JkZXI6IGdlbmVyYXRlRW50cnlQb2ludHMoe1xuICAgICAgICBzY3JpcHRzOiBvcHRpb25zLnNjcmlwdHMgPz8gW10sXG4gICAgICAgIHN0eWxlczogb3B0aW9ucy5zdHlsZXMgPz8gW10sXG4gICAgICB9KSxcbiAgICB9O1xuICB9XG5cbiAgLy8gSW5pdGlhbCBvcHRpb25zIHRvIGtlZXBcbiAgY29uc3Qge1xuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICBhb3QsXG4gICAgYmFzZUhyZWYsXG4gICAgYnVpbGRPcHRpbWl6ZXIsXG4gICAgY3Jvc3NPcmlnaW4sXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgZXh0cmFjdExpY2Vuc2VzLFxuICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UgPSAnY3NzJyxcbiAgICBwb2xsLFxuICAgIHBvbHlmaWxscyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHN0YXRzSnNvbixcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgdmVyYm9zZSxcbiAgICB3YXRjaCxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgLy8gUmV0dXJuIGFsbCB0aGUgbm9ybWFsaXplZCBvcHRpb25zXG4gIHJldHVybiB7XG4gICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zOiBidWlsZE9wdGltaXplcixcbiAgICBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMsXG4gICAgYmFzZUhyZWYsXG4gICAgY2FjaGVPcHRpb25zLFxuICAgIGNyb3NzT3JpZ2luLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIGV4dHJhY3RMaWNlbnNlcyxcbiAgICBpbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgIGppdDogIWFvdCxcbiAgICBzdGF0czogISFzdGF0c0pzb24sXG4gICAgcG9seWZpbGxzOiBwb2x5ZmlsbHMgPT09IHVuZGVmaW5lZCB8fCBBcnJheS5pc0FycmF5KHBvbHlmaWxscykgPyBwb2x5ZmlsbHMgOiBbcG9seWZpbGxzXSxcbiAgICBwb2xsLFxuICAgIC8vIElmIG5vdCBleHBsaWNpdGx5IHNldCwgZGVmYXVsdCB0byB0aGUgTm9kZS5qcyBwcm9jZXNzIGFyZ3VtZW50XG4gICAgcHJlc2VydmVTeW1saW5rczogcHJlc2VydmVTeW1saW5rcyA/PyBwcm9jZXNzLmV4ZWNBcmd2LmluY2x1ZGVzKCctLXByZXNlcnZlLXN5bWxpbmtzJyksXG4gICAgc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIHZlcmJvc2UsXG4gICAgd2F0Y2gsXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIG91dHB1dFBhdGgsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB0c2NvbmZpZyxcbiAgICBwcm9qZWN0Um9vdCxcbiAgICBhc3NldHMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICBnbG9iYWxTdHlsZXMsXG4gICAgc2VydmljZVdvcmtlck9wdGlvbnMsXG4gICAgaW5kZXhIdG1sT3B0aW9ucyxcbiAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGZpbmRUYWlsd2luZENvbmZpZ3VyYXRpb25GaWxlKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIHByb2plY3RSb290OiBzdHJpbmcsXG4pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAvLyBBIGNvbmZpZ3VyYXRpb24gZmlsZSBjYW4gZXhpc3QgaW4gdGhlIHByb2plY3Qgb3Igd29ya3NwYWNlIHJvb3RcbiAgLy8gVGhlIGxpc3Qgb2YgdmFsaWQgY29uZmlnIGZpbGVzIGNhbiBiZSBmb3VuZDpcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3RhaWx3aW5kbGFicy90YWlsd2luZGNzcy9ibG9iLzg4NDVkMTEyZmI2MmQ3OTgxNWI1MGIzYmFlODBjMzE3NDUwYjhiOTIvc3JjL3V0aWwvcmVzb2x2ZUNvbmZpZ1BhdGguanMjTDQ2LUw1MlxuICBjb25zdCB0YWlsd2luZENvbmZpZ0ZpbGVzID0gWyd0YWlsd2luZC5jb25maWcuanMnLCAndGFpbHdpbmQuY29uZmlnLmNqcyddO1xuICBmb3IgKGNvbnN0IGJhc2VQYXRoIG9mIFtwcm9qZWN0Um9vdCwgd29ya3NwYWNlUm9vdF0pIHtcbiAgICBmb3IgKGNvbnN0IGNvbmZpZ0ZpbGUgb2YgdGFpbHdpbmRDb25maWdGaWxlcykge1xuICAgICAgLy8gUHJvamVjdCBsZXZlbCBjb25maWd1cmF0aW9uIHNob3VsZCBhbHdheXMgdGFrZSBwcmVjZWRlbmNlLlxuICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4oYmFzZVBhdGgsIGNvbmZpZ0ZpbGUpO1xuICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoZnVsbFBhdGgpKSB7XG4gICAgICAgIHJldHVybiBmdWxsUGF0aDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuIl19