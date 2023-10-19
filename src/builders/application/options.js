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
const node_module_1 = require("node:module");
const node_path_1 = __importDefault(require("node:path"));
const helpers_1 = require("../../tools/webpack/utils/helpers");
const utils_1 = require("../../utils");
const i18n_options_1 = require("../../utils/i18n-options");
const normalize_cache_1 = require("../../utils/normalize-cache");
const package_chunk_sort_1 = require("../../utils/package-chunk-sort");
const tailwind_1 = require("../../utils/tailwind");
const webpack_browser_config_1 = require("../../utils/webpack-browser-config");
const schema_1 = require("./schema");
/**
 * Normalize the user provided options by creating full paths for all path based options
 * and converting multi-form options into a single form that can be directly used
 * by the build process.
 *
 * @param context The context for current builder execution.
 * @param projectName The name of the project for the current execution.
 * @param options An object containing the options to use for the build.
 * @param plugins An optional array of programmatically supplied build plugins.
 * @returns An object containing normalized options required to perform the build.
 */
// eslint-disable-next-line max-lines-per-function
async function normalizeOptions(context, projectName, options, plugins) {
    const workspaceRoot = context.workspaceRoot;
    const projectMetadata = await context.getProjectMetadata(projectName);
    const projectRoot = normalizeDirectoryPath(node_path_1.default.join(workspaceRoot, projectMetadata.root ?? ''));
    const projectSourceRoot = normalizeDirectoryPath(node_path_1.default.join(workspaceRoot, projectMetadata.sourceRoot ?? 'src'));
    // Gather persistent caching option and provide a project specific cache location
    const cacheOptions = (0, normalize_cache_1.normalizeCacheOptions)(projectMetadata, workspaceRoot);
    cacheOptions.path = node_path_1.default.join(cacheOptions.path, projectName);
    const i18nOptions = (0, i18n_options_1.createI18nOptions)(projectMetadata, options.localize);
    i18nOptions.duplicateTranslationBehavior = options.i18nDuplicateTranslation;
    i18nOptions.missingTranslationBehavior = options.i18nMissingTranslation;
    if (options.forceI18nFlatOutput) {
        i18nOptions.flatOutput = true;
    }
    const entryPoints = normalizeEntryPoints(workspaceRoot, options.browser, options.entryPoints);
    const tsconfig = node_path_1.default.join(workspaceRoot, options.tsConfig);
    const outputPath = normalizeDirectoryPath(node_path_1.default.join(workspaceRoot, options.outputPath));
    const optimizationOptions = (0, utils_1.normalizeOptimization)(options.optimization);
    const sourcemapOptions = (0, utils_1.normalizeSourceMaps)(options.sourceMap ?? false);
    const assets = options.assets?.length
        ? (0, utils_1.normalizeAssetPatterns)(options.assets, workspaceRoot, projectRoot, projectSourceRoot)
        : undefined;
    const outputNames = {
        bundles: options.outputHashing === schema_1.OutputHashing.All || options.outputHashing === schema_1.OutputHashing.Bundles
            ? '[name]-[hash]'
            : '[name]',
        media: 'media/' +
            (options.outputHashing === schema_1.OutputHashing.All || options.outputHashing === schema_1.OutputHashing.Media
                ? '[name]-[hash]'
                : '[name]'),
    };
    let fileReplacements;
    if (options.fileReplacements) {
        for (const replacement of options.fileReplacements) {
            fileReplacements ??= {};
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
    const globalScripts = [];
    if (options.scripts?.length) {
        for (const { bundleName, paths, inject } of (0, helpers_1.globalScriptsByBundleName)(options.scripts)) {
            globalScripts.push({ name: bundleName, files: paths, initial: inject });
        }
    }
    let tailwindConfiguration;
    const tailwindConfigurationPath = await (0, tailwind_1.findTailwindConfigurationFile)(workspaceRoot, projectRoot);
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
    let indexHtmlOptions;
    // index can never have a value of `true` but in the schema it's of type `boolean`.
    if (typeof options.index !== 'boolean') {
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
    let serverEntryPoint;
    if (options.server) {
        serverEntryPoint = node_path_1.default.join(workspaceRoot, options.server);
    }
    else if (options.server === '') {
        throw new Error('`server` option cannot be an empty string.');
    }
    let prerenderOptions;
    if (options.prerender) {
        const { discoverRoutes = true, routesFile = undefined } = options.prerender === true ? {} : options.prerender;
        prerenderOptions = {
            discoverRoutes,
            routesFile: routesFile && node_path_1.default.join(workspaceRoot, routesFile),
        };
    }
    let ssrOptions;
    if (options.ssr === true) {
        ssrOptions = {};
    }
    else if (typeof options.ssr === 'object') {
        const { entry } = options.ssr;
        ssrOptions = {
            entry: entry && node_path_1.default.join(workspaceRoot, entry),
        };
    }
    let appShellOptions;
    if (options.appShell) {
        appShellOptions = {
            route: 'shell',
        };
    }
    // Initial options to keep
    const { allowedCommonJsDependencies, aot, baseHref, crossOrigin, externalDependencies, extractLicenses, inlineStyleLanguage = 'css', outExtension, serviceWorker, poll, polyfills, preserveSymlinks, statsJson, stylePreprocessorOptions, subresourceIntegrity, verbose, watch, progress = true, externalPackages, deleteOutputPath, namedChunks, budgets, deployUrl, } = options;
    // Return all the normalized options
    return {
        advancedOptimizations: !!aot,
        allowedCommonJsDependencies,
        baseHref,
        cacheOptions,
        crossOrigin,
        deleteOutputPath,
        externalDependencies,
        extractLicenses,
        inlineStyleLanguage,
        jit: !aot,
        stats: !!statsJson,
        polyfills: polyfills === undefined || Array.isArray(polyfills) ? polyfills : [polyfills],
        poll,
        progress,
        externalPackages,
        // If not explicitly set, default to the Node.js process argument
        preserveSymlinks: preserveSymlinks ?? process.execArgv.includes('--preserve-symlinks'),
        stylePreprocessorOptions,
        subresourceIntegrity,
        serverEntryPoint,
        prerenderOptions,
        appShellOptions,
        ssrOptions,
        verbose,
        watch,
        workspaceRoot,
        entryPoints,
        optimizationOptions,
        outputPath,
        outExtension,
        sourcemapOptions,
        tsconfig,
        projectRoot,
        assets,
        outputNames,
        fileReplacements,
        globalStyles,
        globalScripts,
        serviceWorker: typeof serviceWorker === 'string' ? node_path_1.default.join(workspaceRoot, serviceWorker) : undefined,
        indexHtmlOptions,
        tailwindConfiguration,
        i18nOptions,
        namedChunks,
        budgets: budgets?.length ? budgets : undefined,
        publicPath: deployUrl ? deployUrl : undefined,
        plugins: plugins?.length ? plugins : undefined,
    };
}
exports.normalizeOptions = normalizeOptions;
/**
 * Normalize entry point options. To maintain compatibility with the legacy browser builder, we need a single `browser`
 * option which defines a single entry point. However, we also want to support multiple entry points as an internal option.
 * The two options are mutually exclusive and if `browser` is provided it will be used as the sole entry point.
 * If `entryPoints` are provided, they will be used as the set of entry points.
 *
 * @param workspaceRoot Path to the root of the Angular workspace.
 * @param browser The `browser` option pointing at the application entry point. While required per the schema file, it may be omitted by
 *     programmatic usages of `browser-esbuild`.
 * @param entryPoints Set of entry points to use if provided.
 * @returns An object mapping entry point names to their file paths.
 */
function normalizeEntryPoints(workspaceRoot, browser, entryPoints = new Set()) {
    if (browser === '') {
        throw new Error('`browser` option cannot be an empty string.');
    }
    // `browser` and `entryPoints` are mutually exclusive.
    if (browser && entryPoints.size > 0) {
        throw new Error('Only one of `browser` or `entryPoints` may be provided.');
    }
    if (!browser && entryPoints.size === 0) {
        // Schema should normally reject this case, but programmatic usages of the builder might make this mistake.
        throw new Error('Either `browser` or at least one `entryPoints` value must be provided.');
    }
    // Schema types force `browser` to always be provided, but it may be omitted when the builder is invoked programmatically.
    if (browser) {
        // Use `browser` alone.
        return { 'main': node_path_1.default.join(workspaceRoot, browser) };
    }
    else {
        // Use `entryPoints` alone.
        const entryPointPaths = {};
        for (const entryPoint of entryPoints) {
            const parsedEntryPoint = node_path_1.default.parse(entryPoint);
            // Use the input file path without an extension as the "name" of the entry point dictating its output location.
            // Relative entry points are generated at the same relative path in the output directory.
            // Absolute entry points are always generated with the same file name in the root of the output directory. This includes absolute
            // paths pointing at files actually within the workspace root.
            const entryPointName = node_path_1.default.isAbsolute(entryPoint)
                ? parsedEntryPoint.name
                : node_path_1.default.join(parsedEntryPoint.dir, parsedEntryPoint.name);
            // Get the full file path to the entry point input.
            const entryPointPath = node_path_1.default.isAbsolute(entryPoint)
                ? entryPoint
                : node_path_1.default.join(workspaceRoot, entryPoint);
            // Check for conflicts with previous entry points.
            const existingEntryPointPath = entryPointPaths[entryPointName];
            if (existingEntryPointPath) {
                throw new Error(`\`${existingEntryPointPath}\` and \`${entryPointPath}\` both output to the same location \`${entryPointName}\`.` +
                    ' Rename or move one of the files to fix the conflict.');
            }
            entryPointPaths[entryPointName] = entryPointPath;
        }
        return entryPointPaths;
    }
}
/**
 * Normalize a directory path string.
 * Currently only removes a trailing slash if present.
 * @param path A path string.
 * @returns A normalized path string.
 */
function normalizeDirectoryPath(path) {
    const last = path[path.length - 1];
    if (last === '/' || last === '\\') {
        return path.slice(0, -1);
    }
    return path;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL29wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBSUgsNkNBQTRDO0FBQzVDLDBEQUE2QjtBQUM3QiwrREFHMkM7QUFDM0MsdUNBQWlHO0FBQ2pHLDJEQUEwRTtBQUMxRSxpRUFBb0U7QUFDcEUsdUVBQXFFO0FBQ3JFLG1EQUFxRTtBQUNyRSwrRUFBMkY7QUFDM0YscUNBQStGO0FBNEMvRjs7Ozs7Ozs7OztHQVVHO0FBQ0gsa0RBQWtEO0FBQzNDLEtBQUssVUFBVSxnQkFBZ0IsQ0FDcEMsT0FBdUIsRUFDdkIsV0FBbUIsRUFDbkIsT0FBMEMsRUFDMUMsT0FBa0I7SUFFbEIsTUFBTSxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUM1QyxNQUFNLGVBQWUsR0FBRyxNQUFNLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN0RSxNQUFNLFdBQVcsR0FBRyxzQkFBc0IsQ0FDeEMsbUJBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFHLGVBQWUsQ0FBQyxJQUEyQixJQUFJLEVBQUUsQ0FBQyxDQUM3RSxDQUFDO0lBQ0YsTUFBTSxpQkFBaUIsR0FBRyxzQkFBc0IsQ0FDOUMsbUJBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFHLGVBQWUsQ0FBQyxVQUFpQyxJQUFJLEtBQUssQ0FBQyxDQUN0RixDQUFDO0lBRUYsaUZBQWlGO0lBQ2pGLE1BQU0sWUFBWSxHQUFHLElBQUEsdUNBQXFCLEVBQUMsZUFBZSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQzNFLFlBQVksQ0FBQyxJQUFJLEdBQUcsbUJBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFB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YUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBRXpDLGtEQUFrRDtZQUNsRCxNQUFNLHNCQUFzQixHQUFHLGVBQWUsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUMvRCxJQUFJLHNCQUFzQixFQUFFO2dCQUMxQixNQUFNLElBQUksS0FBSyxDQUNiLEtBQUssc0JBQXNCLFlBQVksY0FBYyx5Q0FBeUMsY0FBYyxLQUFLO29CQUMvRyx1REFBdUQsQ0FDMUQsQ0FBQzthQUNIO1lBRUQsZUFBZSxDQUFDLGNBQWMsQ0FBQyxHQUFHLGNBQWMsQ0FBQztTQUNsRDtRQUVELE9BQU8sZUFBZSxDQUFDO0tBQ3hCO0FBQ0gsQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsU0FBUyxzQkFBc0IsQ0FBQyxJQUFZO0lBQzFDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ25DLElBQUksSUFBSSxLQUFLLEdBQUcsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFO1FBQ2pDLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUMxQjtJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHR5cGUgeyBQbHVnaW4gfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdub2RlOm1vZHVsZSc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHtcbiAgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZSxcbiAgbm9ybWFsaXplR2xvYmFsU3R5bGVzLFxufSBmcm9tICcuLi8uLi90b29scy93ZWJwYWNrL3V0aWxzL2hlbHBlcnMnO1xuaW1wb3J0IHsgbm9ybWFsaXplQXNzZXRQYXR0ZXJucywgbm9ybWFsaXplT3B0aW1pemF0aW9uLCBub3JtYWxpemVTb3VyY2VNYXBzIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMsIGNyZWF0ZUkxOG5PcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL25vcm1hbGl6ZS1jYWNoZSc7XG5pbXBvcnQgeyBnZW5lcmF0ZUVudHJ5UG9pbnRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGFja2FnZS1jaHVuay1zb3J0JztcbmltcG9ydCB7IGZpbmRUYWlsd2luZENvbmZpZ3VyYXRpb25GaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvdGFpbHdpbmQnO1xuaW1wb3J0IHsgZ2V0SW5kZXhJbnB1dEZpbGUsIGdldEluZGV4T3V0cHV0RmlsZSB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEFwcGxpY2F0aW9uQnVpbGRlck9wdGlvbnMsIEkxOE5UcmFuc2xhdGlvbiwgT3V0cHV0SGFzaGluZyB9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IHR5cGUgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zID0gQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBub3JtYWxpemVPcHRpb25zPj47XG5cbi8qKiBJbnRlcm5hbCBvcHRpb25zIGhpZGRlbiBmcm9tIGJ1aWxkZXIgc2NoZW1hIGJ1dCBhdmFpbGFibGUgd2hlbiBpbnZva2VkIHByb2dyYW1tYXRpY2FsbHkuICovXG5pbnRlcmZhY2UgSW50ZXJuYWxPcHRpb25zIHtcbiAgLyoqXG4gICAqIEVudHJ5IHBvaW50cyB0byB1c2UgZm9yIHRoZSBjb21waWxhdGlvbi4gSW5jb21wYXRpYmxlIHdpdGggYGJyb3dzZXJgLCB3aGljaCBtdXN0IG5vdCBiZSBwcm92aWRlZC4gTWF5IGJlIHJlbGF0aXZlIG9yIGFic29sdXRlIHBhdGhzLlxuICAgKiBJZiBnaXZlbiBhIHJlbGF0aXZlIHBhdGgsIGl0IGlzIHJlc29sdmVkIHJlbGF0aXZlIHRvIHRoZSBjdXJyZW50IHdvcmtzcGFjZSBhbmQgd2lsbCBnZW5lcmF0ZSBhbiBvdXRwdXQgYXQgdGhlIHNhbWUgcmVsYXRpdmUgbG9jYXRpb25cbiAgICogaW4gdGhlIG91dHB1dCBkaXJlY3RvcnkuIElmIGdpdmVuIGFuIGFic29sdXRlIHBhdGgsIHRoZSBvdXRwdXQgd2lsbCBiZSBnZW5lcmF0ZWQgaW4gdGhlIHJvb3Qgb2YgdGhlIG91dHB1dCBkaXJlY3Rvcnkgd2l0aCB0aGUgc2FtZSBiYXNlXG4gICAqIG5hbWUuXG4gICAqL1xuICBlbnRyeVBvaW50cz86IFNldDxzdHJpbmc+O1xuXG4gIC8qKiBGaWxlIGV4dGVuc2lvbiB0byB1c2UgZm9yIHRoZSBnZW5lcmF0ZWQgb3V0cHV0IGZpbGVzLiAqL1xuICBvdXRFeHRlbnNpb24/OiAnanMnIHwgJ21qcyc7XG5cbiAgLyoqXG4gICAqIEluZGljYXRlcyB3aGV0aGVyIGFsbCBub2RlIHBhY2thZ2VzIHNob3VsZCBiZSBtYXJrZWQgYXMgZXh0ZXJuYWwuXG4gICAqIEN1cnJlbnRseSB1c2VkIGJ5IHRoZSBkZXYtc2VydmVyIHRvIHN1cHBvcnQgcHJlYnVuZGxpbmcuXG4gICAqL1xuICBleHRlcm5hbFBhY2thZ2VzPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogRm9yY2VzIHRoZSBvdXRwdXQgZnJvbSB0aGUgbG9jYWxpemUgcG9zdC1wcm9jZXNzaW5nIHRvIG5vdCBjcmVhdGUgbmVzdGVkIGRpcmVjdG9yaWVzIHBlciBsb2NhbGUgb3V0cHV0LlxuICAgKiBUaGlzIGlzIG9ubHkgdXNlZCBieSB0aGUgZGV2ZWxvcG1lbnQgc2VydmVyIHdoaWNoIGN1cnJlbnRseSBvbmx5IHN1cHBvcnRzIGEgc2luZ2xlIGxvY2FsZSBwZXIgYnVpbGQuXG4gICAqL1xuICBmb3JjZUkxOG5GbGF0T3V0cHV0PzogYm9vbGVhbjtcblxuICAvKipcbiAgICogQWxsb3dzIGZvciB1c2FnZSBvZiB0aGUgZGVwcmVjYXRlZCBgZGVwbG95VXJsYCBvcHRpb24gd2l0aCB0aGUgY29tcGF0aWJpbGl0eSBidWlsZGVyIGBicm93c2VyLWVzYnVpbGRgLlxuICAgKi9cbiAgZGVwbG95VXJsPzogc3RyaW5nO1xufVxuXG4vKiogRnVsbCBzZXQgb2Ygb3B0aW9ucyBmb3IgYGFwcGxpY2F0aW9uYCBidWlsZGVyLiAqL1xuZXhwb3J0IHR5cGUgQXBwbGljYXRpb25CdWlsZGVySW50ZXJuYWxPcHRpb25zID0gT21pdDxcbiAgQXBwbGljYXRpb25CdWlsZGVyT3B0aW9ucyAmIEludGVybmFsT3B0aW9ucyxcbiAgJ2Jyb3dzZXInXG4+ICYge1xuICAvLyBgYnJvd3NlcmAgY2FuIGJlIGB1bmRlZmluZWRgIGlmIGBlbnRyeVBvaW50c2AgaXMgdXNlZC5cbiAgYnJvd3Nlcj86IHN0cmluZztcbn07XG5cbi8qKlxuICogTm9ybWFsaXplIHRoZSB1c2VyIHByb3ZpZGVkIG9wdGlvbnMgYnkgY3JlYXRpbmcgZnVsbCBwYXRocyBmb3IgYWxsIHBhdGggYmFzZWQgb3B0aW9uc1xuICogYW5kIGNvbnZlcnRpbmcgbXVsdGktZm9ybSBvcHRpb25zIGludG8gYSBzaW5nbGUgZm9ybSB0aGF0IGNhbiBiZSBkaXJlY3RseSB1c2VkXG4gKiBieSB0aGUgYnVpbGQgcHJvY2Vzcy5cbiAqXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgY29udGV4dCBmb3IgY3VycmVudCBidWlsZGVyIGV4ZWN1dGlvbi5cbiAqIEBwYXJhbSBwcm9qZWN0TmFtZSBUaGUgbmFtZSBvZiB0aGUgcHJvamVjdCBmb3IgdGhlIGN1cnJlbnQgZXhlY3V0aW9uLlxuICogQHBhcmFtIG9wdGlvbnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIG9wdGlvbnMgdG8gdXNlIGZvciB0aGUgYnVpbGQuXG4gKiBAcGFyYW0gcGx1Z2lucyBBbiBvcHRpb25hbCBhcnJheSBvZiBwcm9ncmFtbWF0aWNhbGx5IHN1cHBsaWVkIGJ1aWxkIHBsdWdpbnMuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyBub3JtYWxpemVkIG9wdGlvbnMgcmVxdWlyZWQgdG8gcGVyZm9ybSB0aGUgYnVpbGQuXG4gKi9cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbm9ybWFsaXplT3B0aW9ucyhcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gIG9wdGlvbnM6IEFwcGxpY2F0aW9uQnVpbGRlckludGVybmFsT3B0aW9ucyxcbiAgcGx1Z2lucz86IFBsdWdpbltdLFxuKSB7XG4gIGNvbnN0IHdvcmtzcGFjZVJvb3QgPSBjb250ZXh0LndvcmtzcGFjZVJvb3Q7XG4gIGNvbnN0IHByb2plY3RNZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgY29uc3QgcHJvamVjdFJvb3QgPSBub3JtYWxpemVEaXJlY3RvcnlQYXRoKFxuICAgIHBhdGguam9pbih3b3Jrc3BhY2VSb290LCAocHJvamVjdE1ldGFkYXRhLnJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnJyksXG4gICk7XG4gIGNvbnN0IHByb2plY3RTb3VyY2VSb290ID0gbm9ybWFsaXplRGlyZWN0b3J5UGF0aChcbiAgICBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgKHByb2plY3RNZXRhZGF0YS5zb3VyY2VSb290IGFzIHN0cmluZyB8IHVuZGVmaW5lZCkgPz8gJ3NyYycpLFxuICApO1xuXG4gIC8vIEdhdGhlciBwZXJzaXN0ZW50IGNhY2hpbmcgb3B0aW9uIGFuZCBwcm92aWRlIGEgcHJvamVjdCBzcGVjaWZpYyBjYWNoZSBsb2NhdGlvblxuICBjb25zdCBjYWNoZU9wdGlvbnMgPSBub3JtYWxpemVDYWNoZU9wdGlvbnMocHJvamVjdE1ldGFkYXRhLCB3b3Jrc3BhY2VSb290KTtcbiAgY2FjaGVPcHRpb25zLnBhdGggPSBwYXRoLmpvaW4oY2FjaGVPcHRpb25zLnBhdGgsIHByb2plY3ROYW1lKTtcblxuICBjb25zdCBpMThuT3B0aW9uczogSTE4bk9wdGlvbnMgJiB7XG4gICAgZHVwbGljYXRlVHJhbnNsYXRpb25CZWhhdmlvcj86IEkxOE5UcmFuc2xhdGlvbjtcbiAgICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvcj86IEkxOE5UcmFuc2xhdGlvbjtcbiAgfSA9IGNyZWF0ZUkxOG5PcHRpb25zKHByb2plY3RNZXRhZGF0YSwgb3B0aW9ucy5sb2NhbGl6ZSk7XG4gIGkxOG5PcHRpb25zLmR1cGxpY2F0ZVRyYW5zbGF0aW9uQmVoYXZpb3IgPSBvcHRpb25zLmkxOG5EdXBsaWNhdGVUcmFuc2xhdGlvbjtcbiAgaTE4bk9wdGlvbnMubWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IgPSBvcHRpb25zLmkxOG5NaXNzaW5nVHJhbnNsYXRpb247XG4gIGlmIChvcHRpb25zLmZvcmNlSTE4bkZsYXRPdXRwdXQpIHtcbiAgICBpMThuT3B0aW9ucy5mbGF0T3V0cHV0ID0gdHJ1ZTtcbiAgfVxuXG4gIGNvbnN0IGVudHJ5UG9pbnRzID0gbm9ybWFsaXplRW50cnlQb2ludHMod29ya3NwYWNlUm9vdCwgb3B0aW9ucy5icm93c2VyLCBvcHRpb25zLmVudHJ5UG9pbnRzKTtcbiAgY29uc3QgdHNjb25maWcgPSBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgb3B0aW9ucy50c0NvbmZpZyk7XG4gIGNvbnN0IG91dHB1dFBhdGggPSBub3JtYWxpemVEaXJlY3RvcnlQYXRoKHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLm91dHB1dFBhdGgpKTtcbiAgY29uc3Qgb3B0aW1pemF0aW9uT3B0aW9ucyA9IG5vcm1hbGl6ZU9wdGltaXphdGlvbihvcHRpb25zLm9wdGltaXphdGlvbik7XG4gIGNvbnN0IHNvdXJjZW1hcE9wdGlvbnMgPSBub3JtYWxpemVTb3VyY2VNYXBzKG9wdGlvbnMuc291cmNlTWFwID8/IGZhbHNlKTtcbiAgY29uc3QgYXNzZXRzID0gb3B0aW9ucy5hc3NldHM/Lmxlbmd0aFxuICAgID8gbm9ybWFsaXplQXNzZXRQYXR0ZXJucyhvcHRpb25zLmFzc2V0cywgd29ya3NwYWNlUm9vdCwgcHJvamVjdFJvb3QsIHByb2plY3RTb3VyY2VSb290KVxuICAgIDogdW5kZWZpbmVkO1xuXG4gIGNvbnN0IG91dHB1dE5hbWVzID0ge1xuICAgIGJ1bmRsZXM6XG4gICAgICBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuQWxsIHx8IG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5CdW5kbGVzXG4gICAgICAgID8gJ1tuYW1lXS1baGFzaF0nXG4gICAgICAgIDogJ1tuYW1lXScsXG4gICAgbWVkaWE6XG4gICAgICAnbWVkaWEvJyArXG4gICAgICAob3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLkFsbCB8fCBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuTWVkaWFcbiAgICAgICAgPyAnW25hbWVdLVtoYXNoXSdcbiAgICAgICAgOiAnW25hbWVdJyksXG4gIH07XG5cbiAgbGV0IGZpbGVSZXBsYWNlbWVudHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfCB1bmRlZmluZWQ7XG4gIGlmIChvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpIHtcbiAgICBmb3IgKGNvbnN0IHJlcGxhY2VtZW50IG9mIG9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykge1xuICAgICAgZmlsZVJlcGxhY2VtZW50cyA/Pz0ge307XG4gICAgICBmaWxlUmVwbGFjZW1lbnRzW3BhdGguam9pbih3b3Jrc3BhY2VSb290LCByZXBsYWNlbWVudC5yZXBsYWNlKV0gPSBwYXRoLmpvaW4oXG4gICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIHJlcGxhY2VtZW50LndpdGgsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGdsb2JhbFN0eWxlczogeyBuYW1lOiBzdHJpbmc7IGZpbGVzOiBzdHJpbmdbXTsgaW5pdGlhbDogYm9vbGVhbiB9W10gPSBbXTtcbiAgaWYgKG9wdGlvbnMuc3R5bGVzPy5sZW5ndGgpIHtcbiAgICBjb25zdCB7IGVudHJ5UG9pbnRzOiBzdHlsZXNoZWV0RW50cnlwb2ludHMsIG5vSW5qZWN0TmFtZXMgfSA9IG5vcm1hbGl6ZUdsb2JhbFN0eWxlcyhcbiAgICAgIG9wdGlvbnMuc3R5bGVzIHx8IFtdLFxuICAgICk7XG4gICAgZm9yIChjb25zdCBbbmFtZSwgZmlsZXNdIG9mIE9iamVjdC5lbnRyaWVzKHN0eWxlc2hlZXRFbnRyeXBvaW50cykpIHtcbiAgICAgIGdsb2JhbFN0eWxlcy5wdXNoKHsgbmFtZSwgZmlsZXMsIGluaXRpYWw6ICFub0luamVjdE5hbWVzLmluY2x1ZGVzKG5hbWUpIH0pO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGdsb2JhbFNjcmlwdHM6IHsgbmFtZTogc3RyaW5nOyBmaWxlczogc3RyaW5nW107IGluaXRpYWw6IGJvb2xlYW4gfVtdID0gW107XG4gIGlmIChvcHRpb25zLnNjcmlwdHM/Lmxlbmd0aCkge1xuICAgIGZvciAoY29uc3QgeyBidW5kbGVOYW1lLCBwYXRocywgaW5qZWN0IH0gb2YgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZShvcHRpb25zLnNjcmlwdHMpKSB7XG4gICAgICBnbG9iYWxTY3JpcHRzLnB1c2goeyBuYW1lOiBidW5kbGVOYW1lLCBmaWxlczogcGF0aHMsIGluaXRpYWw6IGluamVjdCB9KTtcbiAgICB9XG4gIH1cblxuICBsZXQgdGFpbHdpbmRDb25maWd1cmF0aW9uOiB7IGZpbGU6IHN0cmluZzsgcGFja2FnZTogc3RyaW5nIH0gfCB1bmRlZmluZWQ7XG4gIGNvbnN0IHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGggPSBhd2FpdCBmaW5kVGFpbHdpbmRDb25maWd1cmF0aW9uRmlsZSh3b3Jrc3BhY2VSb290LCBwcm9qZWN0Um9vdCk7XG4gIGlmICh0YWlsd2luZENvbmZpZ3VyYXRpb25QYXRoKSB7XG4gICAgLy8gQ3JlYXRlIGEgbm9kZSByZXNvbHZlciBhdCB0aGUgcHJvamVjdCByb290IGFzIGEgZGlyZWN0b3J5XG4gICAgY29uc3QgcmVzb2x2ZXIgPSBjcmVhdGVSZXF1aXJlKHByb2plY3RSb290ICsgJy8nKTtcbiAgICB0cnkge1xuICAgICAgdGFpbHdpbmRDb25maWd1cmF0aW9uID0ge1xuICAgICAgICBmaWxlOiB0YWlsd2luZENvbmZpZ3VyYXRpb25QYXRoLFxuICAgICAgICBwYWNrYWdlOiByZXNvbHZlci5yZXNvbHZlKCd0YWlsd2luZGNzcycpLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGNvbnN0IHJlbGF0aXZlVGFpbHdpbmRDb25maWdQYXRoID0gcGF0aC5yZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCB0YWlsd2luZENvbmZpZ3VyYXRpb25QYXRoKTtcbiAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICAgIGBUYWlsd2luZCBDU1MgY29uZmlndXJhdGlvbiBmaWxlIGZvdW5kICgke3JlbGF0aXZlVGFpbHdpbmRDb25maWdQYXRofSlgICtcbiAgICAgICAgICBgIGJ1dCB0aGUgJ3RhaWx3aW5kY3NzJyBwYWNrYWdlIGlzIG5vdCBpbnN0YWxsZWQuYCArXG4gICAgICAgICAgYCBUbyBlbmFibGUgVGFpbHdpbmQgQ1NTLCBwbGVhc2UgaW5zdGFsbCB0aGUgJ3RhaWx3aW5kY3NzJyBwYWNrYWdlLmAsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGxldCBpbmRleEh0bWxPcHRpb25zO1xuICAvLyBpbmRleCBjYW4gbmV2ZXIgaGF2ZSBhIHZhbHVlIG9mIGB0cnVlYCBidXQgaW4gdGhlIHNjaGVtYSBpdCdzIG9mIHR5cGUgYGJvb2xlYW5gLlxuICBpZiAodHlwZW9mIG9wdGlvbnMuaW5kZXggIT09ICdib29sZWFuJykge1xuICAgIGluZGV4SHRtbE9wdGlvbnMgPSB7XG4gICAgICBpbnB1dDogcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGdldEluZGV4SW5wdXRGaWxlKG9wdGlvbnMuaW5kZXgpKSxcbiAgICAgIC8vIFRoZSBvdXRwdXQgZmlsZSB3aWxsIGJlIGNyZWF0ZWQgd2l0aGluIHRoZSBjb25maWd1cmVkIG91dHB1dCBwYXRoXG4gICAgICBvdXRwdXQ6IGdldEluZGV4T3V0cHV0RmlsZShvcHRpb25zLmluZGV4KSxcbiAgICAgIC8vIFRPRE86IFVzZSBleGlzdGluZyBpbmZvcm1hdGlvbiBmcm9tIGFib3ZlIHRvIGNyZWF0ZSB0aGUgaW5zZXJ0aW9uIG9yZGVyXG4gICAgICBpbnNlcnRpb25PcmRlcjogZ2VuZXJhdGVFbnRyeVBvaW50cyh7XG4gICAgICAgIHNjcmlwdHM6IG9wdGlvbnMuc2NyaXB0cyA/PyBbXSxcbiAgICAgICAgc3R5bGVzOiBvcHRpb25zLnN0eWxlcyA/PyBbXSxcbiAgICAgIH0pLFxuICAgIH07XG4gIH1cblxuICBsZXQgc2VydmVyRW50cnlQb2ludDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBpZiAob3B0aW9ucy5zZXJ2ZXIpIHtcbiAgICBzZXJ2ZXJFbnRyeVBvaW50ID0gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMuc2VydmVyKTtcbiAgfSBlbHNlIGlmIChvcHRpb25zLnNlcnZlciA9PT0gJycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2BzZXJ2ZXJgIG9wdGlvbiBjYW5ub3QgYmUgYW4gZW1wdHkgc3RyaW5nLicpO1xuICB9XG5cbiAgbGV0IHByZXJlbmRlck9wdGlvbnM7XG4gIGlmIChvcHRpb25zLnByZXJlbmRlcikge1xuICAgIGNvbnN0IHsgZGlzY292ZXJSb3V0ZXMgPSB0cnVlLCByb3V0ZXNGaWxlID0gdW5kZWZpbmVkIH0gPVxuICAgICAgb3B0aW9ucy5wcmVyZW5kZXIgPT09IHRydWUgPyB7fSA6IG9wdGlvbnMucHJlcmVuZGVyO1xuXG4gICAgcHJlcmVuZGVyT3B0aW9ucyA9IHtcbiAgICAgIGRpc2NvdmVyUm91dGVzLFxuICAgICAgcm91dGVzRmlsZTogcm91dGVzRmlsZSAmJiBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgcm91dGVzRmlsZSksXG4gICAgfTtcbiAgfVxuXG4gIGxldCBzc3JPcHRpb25zO1xuICBpZiAob3B0aW9ucy5zc3IgPT09IHRydWUpIHtcbiAgICBzc3JPcHRpb25zID0ge307XG4gIH0gZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMuc3NyID09PSAnb2JqZWN0Jykge1xuICAgIGNvbnN0IHsgZW50cnkgfSA9IG9wdGlvbnMuc3NyO1xuXG4gICAgc3NyT3B0aW9ucyA9IHtcbiAgICAgIGVudHJ5OiBlbnRyeSAmJiBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgZW50cnkpLFxuICAgIH07XG4gIH1cblxuICBsZXQgYXBwU2hlbGxPcHRpb25zO1xuICBpZiAob3B0aW9ucy5hcHBTaGVsbCkge1xuICAgIGFwcFNoZWxsT3B0aW9ucyA9IHtcbiAgICAgIHJvdXRlOiAnc2hlbGwnLFxuICAgIH07XG4gIH1cblxuICAvLyBJbml0aWFsIG9wdGlvbnMgdG8ga2VlcFxuICBjb25zdCB7XG4gICAgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgIGFvdCxcbiAgICBiYXNlSHJlZixcbiAgICBjcm9zc09yaWdpbixcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBleHRyYWN0TGljZW5zZXMsXG4gICAgaW5saW5lU3R5bGVMYW5ndWFnZSA9ICdjc3MnLFxuICAgIG91dEV4dGVuc2lvbixcbiAgICBzZXJ2aWNlV29ya2VyLFxuICAgIHBvbGwsXG4gICAgcG9seWZpbGxzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgc3RhdHNKc29uLFxuICAgIHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucyxcbiAgICBzdWJyZXNvdXJjZUludGVncml0eSxcbiAgICB2ZXJib3NlLFxuICAgIHdhdGNoLFxuICAgIHByb2dyZXNzID0gdHJ1ZSxcbiAgICBleHRlcm5hbFBhY2thZ2VzLFxuICAgIGRlbGV0ZU91dHB1dFBhdGgsXG4gICAgbmFtZWRDaHVua3MsXG4gICAgYnVkZ2V0cyxcbiAgICBkZXBsb3lVcmwsXG4gIH0gPSBvcHRpb25zO1xuXG4gIC8vIFJldHVybiBhbGwgdGhlIG5vcm1hbGl6ZWQgb3B0aW9uc1xuICByZXR1cm4ge1xuICAgIGFkdmFuY2VkT3B0aW1pemF0aW9uczogISFhb3QsXG4gICAgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgIGJhc2VIcmVmLFxuICAgIGNhY2hlT3B0aW9ucyxcbiAgICBjcm9zc09yaWdpbixcbiAgICBkZWxldGVPdXRwdXRQYXRoLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIGV4dHJhY3RMaWNlbnNlcyxcbiAgICBpbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgIGppdDogIWFvdCxcbiAgICBzdGF0czogISFzdGF0c0pzb24sXG4gICAgcG9seWZpbGxzOiBwb2x5ZmlsbHMgPT09IHVuZGVmaW5lZCB8fCBBcnJheS5pc0FycmF5KHBvbHlmaWxscykgPyBwb2x5ZmlsbHMgOiBbcG9seWZpbGxzXSxcbiAgICBwb2xsLFxuICAgIHByb2dyZXNzLFxuICAgIGV4dGVybmFsUGFja2FnZXMsXG4gICAgLy8gSWYgbm90IGV4cGxpY2l0bHkgc2V0LCBkZWZhdWx0IHRvIHRoZSBOb2RlLmpzIHByb2Nlc3MgYXJndW1lbnRcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzOiBwcmVzZXJ2ZVN5bWxpbmtzID8/IHByb2Nlc3MuZXhlY0FyZ3YuaW5jbHVkZXMoJy0tcHJlc2VydmUtc3ltbGlua3MnKSxcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgc2VydmVyRW50cnlQb2ludCxcbiAgICBwcmVyZW5kZXJPcHRpb25zLFxuICAgIGFwcFNoZWxsT3B0aW9ucyxcbiAgICBzc3JPcHRpb25zLFxuICAgIHZlcmJvc2UsXG4gICAgd2F0Y2gsXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIG91dHB1dFBhdGgsXG4gICAgb3V0RXh0ZW5zaW9uLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgcHJvamVjdFJvb3QsXG4gICAgYXNzZXRzLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIGZpbGVSZXBsYWNlbWVudHMsXG4gICAgZ2xvYmFsU3R5bGVzLFxuICAgIGdsb2JhbFNjcmlwdHMsXG4gICAgc2VydmljZVdvcmtlcjpcbiAgICAgIHR5cGVvZiBzZXJ2aWNlV29ya2VyID09PSAnc3RyaW5nJyA/IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBzZXJ2aWNlV29ya2VyKSA6IHVuZGVmaW5lZCxcbiAgICBpbmRleEh0bWxPcHRpb25zLFxuICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbixcbiAgICBpMThuT3B0aW9ucyxcbiAgICBuYW1lZENodW5rcyxcbiAgICBidWRnZXRzOiBidWRnZXRzPy5sZW5ndGggPyBidWRnZXRzIDogdW5kZWZpbmVkLFxuICAgIHB1YmxpY1BhdGg6IGRlcGxveVVybCA/IGRlcGxveVVybCA6IHVuZGVmaW5lZCxcbiAgICBwbHVnaW5zOiBwbHVnaW5zPy5sZW5ndGggPyBwbHVnaW5zIDogdW5kZWZpbmVkLFxuICB9O1xufVxuXG4vKipcbiAqIE5vcm1hbGl6ZSBlbnRyeSBwb2ludCBvcHRpb25zLiBUbyBtYWludGFpbiBjb21wYXRpYmlsaXR5IHdpdGggdGhlIGxlZ2FjeSBicm93c2VyIGJ1aWxkZXIsIHdlIG5lZWQgYSBzaW5nbGUgYGJyb3dzZXJgXG4gKiBvcHRpb24gd2hpY2ggZGVmaW5lcyBhIHNpbmdsZSBlbnRyeSBwb2ludC4gSG93ZXZlciwgd2UgYWxzbyB3YW50IHRvIHN1cHBvcnQgbXVsdGlwbGUgZW50cnkgcG9pbnRzIGFzIGFuIGludGVybmFsIG9wdGlvbi5cbiAqIFRoZSB0d28gb3B0aW9ucyBhcmUgbXV0dWFsbHkgZXhjbHVzaXZlIGFuZCBpZiBgYnJvd3NlcmAgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkIGFzIHRoZSBzb2xlIGVudHJ5IHBvaW50LlxuICogSWYgYGVudHJ5UG9pbnRzYCBhcmUgcHJvdmlkZWQsIHRoZXkgd2lsbCBiZSB1c2VkIGFzIHRoZSBzZXQgb2YgZW50cnkgcG9pbnRzLlxuICpcbiAqIEBwYXJhbSB3b3Jrc3BhY2VSb290IFBhdGggdG8gdGhlIHJvb3Qgb2YgdGhlIEFuZ3VsYXIgd29ya3NwYWNlLlxuICogQHBhcmFtIGJyb3dzZXIgVGhlIGBicm93c2VyYCBvcHRpb24gcG9pbnRpbmcgYXQgdGhlIGFwcGxpY2F0aW9uIGVudHJ5IHBvaW50LiBXaGlsZSByZXF1aXJlZCBwZXIgdGhlIHNjaGVtYSBmaWxlLCBpdCBtYXkgYmUgb21pdHRlZCBieVxuICogICAgIHByb2dyYW1tYXRpYyB1c2FnZXMgb2YgYGJyb3dzZXItZXNidWlsZGAuXG4gKiBAcGFyYW0gZW50cnlQb2ludHMgU2V0IG9mIGVudHJ5IHBvaW50cyB0byB1c2UgaWYgcHJvdmlkZWQuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgbWFwcGluZyBlbnRyeSBwb2ludCBuYW1lcyB0byB0aGVpciBmaWxlIHBhdGhzLlxuICovXG5mdW5jdGlvbiBub3JtYWxpemVFbnRyeVBvaW50cyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBicm93c2VyOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gIGVudHJ5UG9pbnRzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKSxcbik6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4ge1xuICBpZiAoYnJvd3NlciA9PT0gJycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Bicm93c2VyYCBvcHRpb24gY2Fubm90IGJlIGFuIGVtcHR5IHN0cmluZy4nKTtcbiAgfVxuXG4gIC8vIGBicm93c2VyYCBhbmQgYGVudHJ5UG9pbnRzYCBhcmUgbXV0dWFsbHkgZXhjbHVzaXZlLlxuICBpZiAoYnJvd3NlciAmJiBlbnRyeVBvaW50cy5zaXplID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignT25seSBvbmUgb2YgYGJyb3dzZXJgIG9yIGBlbnRyeVBvaW50c2AgbWF5IGJlIHByb3ZpZGVkLicpO1xuICB9XG4gIGlmICghYnJvd3NlciAmJiBlbnRyeVBvaW50cy5zaXplID09PSAwKSB7XG4gICAgLy8gU2NoZW1hIHNob3VsZCBub3JtYWxseSByZWplY3QgdGhpcyBjYXNlLCBidXQgcHJvZ3JhbW1hdGljIHVzYWdlcyBvZiB0aGUgYnVpbGRlciBtaWdodCBtYWtlIHRoaXMgbWlzdGFrZS5cbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0VpdGhlciBgYnJvd3NlcmAgb3IgYXQgbGVhc3Qgb25lIGBlbnRyeVBvaW50c2AgdmFsdWUgbXVzdCBiZSBwcm92aWRlZC4nKTtcbiAgfVxuXG4gIC8vIFNjaGVtYSB0eXBlcyBmb3JjZSBgYnJvd3NlcmAgdG8gYWx3YXlzIGJlIHByb3ZpZGVkLCBidXQgaXQgbWF5IGJlIG9taXR0ZWQgd2hlbiB0aGUgYnVpbGRlciBpcyBpbnZva2VkIHByb2dyYW1tYXRpY2FsbHkuXG4gIGlmIChicm93c2VyKSB7XG4gICAgLy8gVXNlIGBicm93c2VyYCBhbG9uZS5cbiAgICByZXR1cm4geyAnbWFpbic6IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBicm93c2VyKSB9O1xuICB9IGVsc2Uge1xuICAgIC8vIFVzZSBgZW50cnlQb2ludHNgIGFsb25lLlxuICAgIGNvbnN0IGVudHJ5UG9pbnRQYXRoczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICAgIGZvciAoY29uc3QgZW50cnlQb2ludCBvZiBlbnRyeVBvaW50cykge1xuICAgICAgY29uc3QgcGFyc2VkRW50cnlQb2ludCA9IHBhdGgucGFyc2UoZW50cnlQb2ludCk7XG5cbiAgICAgIC8vIFVzZSB0aGUgaW5wdXQgZmlsZSBwYXRoIHdpdGhvdXQgYW4gZXh0ZW5zaW9uIGFzIHRoZSBcIm5hbWVcIiBvZiB0aGUgZW50cnkgcG9pbnQgZGljdGF0aW5nIGl0cyBvdXRwdXQgbG9jYXRpb24uXG4gICAgICAvLyBSZWxhdGl2ZSBlbnRyeSBwb2ludHMgYXJlIGdlbmVyYXRlZCBhdCB0aGUgc2FtZSByZWxhdGl2ZSBwYXRoIGluIHRoZSBvdXRwdXQgZGlyZWN0b3J5LlxuICAgICAgLy8gQWJzb2x1dGUgZW50cnkgcG9pbnRzIGFyZSBhbHdheXMgZ2VuZXJhdGVkIHdpdGggdGhlIHNhbWUgZmlsZSBuYW1lIGluIHRoZSByb290IG9mIHRoZSBvdXRwdXQgZGlyZWN0b3J5LiBUaGlzIGluY2x1ZGVzIGFic29sdXRlXG4gICAgICAvLyBwYXRocyBwb2ludGluZyBhdCBmaWxlcyBhY3R1YWxseSB3aXRoaW4gdGhlIHdvcmtzcGFjZSByb290LlxuICAgICAgY29uc3QgZW50cnlQb2ludE5hbWUgPSBwYXRoLmlzQWJzb2x1dGUoZW50cnlQb2ludClcbiAgICAgICAgPyBwYXJzZWRFbnRyeVBvaW50Lm5hbWVcbiAgICAgICAgOiBwYXRoLmpvaW4ocGFyc2VkRW50cnlQb2ludC5kaXIsIHBhcnNlZEVudHJ5UG9pbnQubmFtZSk7XG5cbiAgICAgIC8vIEdldCB0aGUgZnVsbCBmaWxlIHBhdGggdG8gdGhlIGVudHJ5IHBvaW50IGlucHV0LlxuICAgICAgY29uc3QgZW50cnlQb2ludFBhdGggPSBwYXRoLmlzQWJzb2x1dGUoZW50cnlQb2ludClcbiAgICAgICAgPyBlbnRyeVBvaW50XG4gICAgICAgIDogcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGVudHJ5UG9pbnQpO1xuXG4gICAgICAvLyBDaGVjayBmb3IgY29uZmxpY3RzIHdpdGggcHJldmlvdXMgZW50cnkgcG9pbnRzLlxuICAgICAgY29uc3QgZXhpc3RpbmdFbnRyeVBvaW50UGF0aCA9IGVudHJ5UG9pbnRQYXRoc1tlbnRyeVBvaW50TmFtZV07XG4gICAgICBpZiAoZXhpc3RpbmdFbnRyeVBvaW50UGF0aCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYFxcYCR7ZXhpc3RpbmdFbnRyeVBvaW50UGF0aH1cXGAgYW5kIFxcYCR7ZW50cnlQb2ludFBhdGh9XFxgIGJvdGggb3V0cHV0IHRvIHRoZSBzYW1lIGxvY2F0aW9uIFxcYCR7ZW50cnlQb2ludE5hbWV9XFxgLmAgK1xuICAgICAgICAgICAgJyBSZW5hbWUgb3IgbW92ZSBvbmUgb2YgdGhlIGZpbGVzIHRvIGZpeCB0aGUgY29uZmxpY3QuJyxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgZW50cnlQb2ludFBhdGhzW2VudHJ5UG9pbnROYW1lXSA9IGVudHJ5UG9pbnRQYXRoO1xuICAgIH1cblxuICAgIHJldHVybiBlbnRyeVBvaW50UGF0aHM7XG4gIH1cbn1cblxuLyoqXG4gKiBOb3JtYWxpemUgYSBkaXJlY3RvcnkgcGF0aCBzdHJpbmcuXG4gKiBDdXJyZW50bHkgb25seSByZW1vdmVzIGEgdHJhaWxpbmcgc2xhc2ggaWYgcHJlc2VudC5cbiAqIEBwYXJhbSBwYXRoIEEgcGF0aCBzdHJpbmcuXG4gKiBAcmV0dXJucyBBIG5vcm1hbGl6ZWQgcGF0aCBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZURpcmVjdG9yeVBhdGgocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgbGFzdCA9IHBhdGhbcGF0aC5sZW5ndGggLSAxXTtcbiAgaWYgKGxhc3QgPT09ICcvJyB8fCBsYXN0ID09PSAnXFxcXCcpIHtcbiAgICByZXR1cm4gcGF0aC5zbGljZSgwLCAtMSk7XG4gIH1cblxuICByZXR1cm4gcGF0aDtcbn1cbiJdfQ==