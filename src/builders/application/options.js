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
 * @returns An object containing normalized options required to perform the build.
 */
// eslint-disable-next-line max-lines-per-function
async function normalizeOptions(context, projectName, options) {
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
            ? '[name].[hash]'
            : '[name]',
        media: 'media/' +
            (options.outputHashing === schema_1.OutputHashing.All || options.outputHashing === schema_1.OutputHashing.Media
                ? '[name].[hash]'
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
        const { discoverRoutes = true, routes = [], routesFile = undefined, } = options.prerender === true ? {} : options.prerender;
        prerenderOptions = {
            discoverRoutes,
            routes,
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
    const { allowedCommonJsDependencies, aot, baseHref, crossOrigin, externalDependencies, extractLicenses, inlineStyleLanguage = 'css', outExtension, serviceWorker, poll, polyfills, preserveSymlinks, statsJson, stylePreprocessorOptions, subresourceIntegrity, verbose, watch, progress = true, externalPackages, deleteOutputPath, } = options;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL29wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsNkNBQTRDO0FBQzVDLDBEQUE2QjtBQUM3QiwrREFHMkM7QUFDM0MsdUNBQWlHO0FBQ2pHLDJEQUEwRTtBQUMxRSxpRUFBb0U7QUFDcEUsdUVBQXFFO0FBQ3JFLG1EQUFxRTtBQUNyRSwrRUFBMkY7QUFDM0YscUNBQStGO0FBaUMvRjs7Ozs7Ozs7O0dBU0c7QUFDSCxrREFBa0Q7QUFDM0MsS0FBSyxVQUFVLGdCQUFnQixDQUNwQyxPQUF1QixFQUN2QixXQUFtQixFQUNuQixPQUEwQztJQUUxQyxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDO0lBQzVDLE1BQU0sZUFBZSxHQUFHLE1BQU0sT0FBTyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3RFLE1BQU0sV0FBVyxHQUFHLHNCQUFzQixDQUN4QyxtQkFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUcsZUFBZSxDQUFDLElBQTJCLElBQUksRUFBRSxDQUFDLENBQzdFLENBQUM7SUFDRixNQUFNLGlCQUFpQixHQUFHLHNCQUFzQixDQUM5QyxtQkFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUcsZUFBZSxDQUFDLFVBQWlDLElBQUksS0FBSyxDQUFDLENBQ3RGLENBQUM7SUFFRixpRkFBaUY7SUFDakYsTUFBTSxZQUFZLEdBQUcsSUFBQSx1Q0FBcUIsRUFBQyxlQUFlLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDM0UsWUFBWSxDQUFDLElBQUksR0FBRyxtQkFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxD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RztBQUNILFNBQVMsc0JBQXNCLENBQUMsSUFBWTtJQUMxQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNuQyxJQUFJLElBQUksS0FBSyxHQUFHLElBQUksSUFBSSxLQUFLLElBQUksRUFBRTtRQUNqQyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDMUI7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdub2RlOm1vZHVsZSc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHtcbiAgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZSxcbiAgbm9ybWFsaXplR2xvYmFsU3R5bGVzLFxufSBmcm9tICcuLi8uLi90b29scy93ZWJwYWNrL3V0aWxzL2hlbHBlcnMnO1xuaW1wb3J0IHsgbm9ybWFsaXplQXNzZXRQYXR0ZXJucywgbm9ybWFsaXplT3B0aW1pemF0aW9uLCBub3JtYWxpemVTb3VyY2VNYXBzIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMsIGNyZWF0ZUkxOG5PcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL25vcm1hbGl6ZS1jYWNoZSc7XG5pbXBvcnQgeyBnZW5lcmF0ZUVudHJ5UG9pbnRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGFja2FnZS1jaHVuay1zb3J0JztcbmltcG9ydCB7IGZpbmRUYWlsd2luZENvbmZpZ3VyYXRpb25GaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvdGFpbHdpbmQnO1xuaW1wb3J0IHsgZ2V0SW5kZXhJbnB1dEZpbGUsIGdldEluZGV4T3V0cHV0RmlsZSB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEFwcGxpY2F0aW9uQnVpbGRlck9wdGlvbnMsIEkxOE5UcmFuc2xhdGlvbiwgT3V0cHV0SGFzaGluZyB9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IHR5cGUgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zID0gQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBub3JtYWxpemVPcHRpb25zPj47XG5cbi8qKiBJbnRlcm5hbCBvcHRpb25zIGhpZGRlbiBmcm9tIGJ1aWxkZXIgc2NoZW1hIGJ1dCBhdmFpbGFibGUgd2hlbiBpbnZva2VkIHByb2dyYW1tYXRpY2FsbHkuICovXG5pbnRlcmZhY2UgSW50ZXJuYWxPcHRpb25zIHtcbiAgLyoqXG4gICAqIEVudHJ5IHBvaW50cyB0byB1c2UgZm9yIHRoZSBjb21waWxhdGlvbi4gSW5jb21wYXRpYmxlIHdpdGggYGJyb3dzZXJgLCB3aGljaCBtdXN0IG5vdCBiZSBwcm92aWRlZC4gTWF5IGJlIHJlbGF0aXZlIG9yIGFic29sdXRlIHBhdGhzLlxuICAgKiBJZiBnaXZlbiBhIHJlbGF0aXZlIHBhdGgsIGl0IGlzIHJlc29sdmVkIHJlbGF0aXZlIHRvIHRoZSBjdXJyZW50IHdvcmtzcGFjZSBhbmQgd2lsbCBnZW5lcmF0ZSBhbiBvdXRwdXQgYXQgdGhlIHNhbWUgcmVsYXRpdmUgbG9jYXRpb25cbiAgICogaW4gdGhlIG91dHB1dCBkaXJlY3RvcnkuIElmIGdpdmVuIGFuIGFic29sdXRlIHBhdGgsIHRoZSBvdXRwdXQgd2lsbCBiZSBnZW5lcmF0ZWQgaW4gdGhlIHJvb3Qgb2YgdGhlIG91dHB1dCBkaXJlY3Rvcnkgd2l0aCB0aGUgc2FtZSBiYXNlXG4gICAqIG5hbWUuXG4gICAqL1xuICBlbnRyeVBvaW50cz86IFNldDxzdHJpbmc+O1xuXG4gIC8qKiBGaWxlIGV4dGVuc2lvbiB0byB1c2UgZm9yIHRoZSBnZW5lcmF0ZWQgb3V0cHV0IGZpbGVzLiAqL1xuICBvdXRFeHRlbnNpb24/OiAnanMnIHwgJ21qcyc7XG5cbiAgLyoqXG4gICAqIEluZGljYXRlcyB3aGV0aGVyIGFsbCBub2RlIHBhY2thZ2VzIHNob3VsZCBiZSBtYXJrZWQgYXMgZXh0ZXJuYWwuXG4gICAqIEN1cnJlbnRseSB1c2VkIGJ5IHRoZSBkZXYtc2VydmVyIHRvIHN1cHBvcnQgcHJlYnVuZGxpbmcuXG4gICAqL1xuICBleHRlcm5hbFBhY2thZ2VzPzogYm9vbGVhbjtcbn1cblxuLyoqIEZ1bGwgc2V0IG9mIG9wdGlvbnMgZm9yIGBhcHBsaWNhdGlvbmAgYnVpbGRlci4gKi9cbmV4cG9ydCB0eXBlIEFwcGxpY2F0aW9uQnVpbGRlckludGVybmFsT3B0aW9ucyA9IE9taXQ8XG4gIEFwcGxpY2F0aW9uQnVpbGRlck9wdGlvbnMgJiBJbnRlcm5hbE9wdGlvbnMsXG4gICdicm93c2VyJ1xuPiAmIHtcbiAgLy8gYGJyb3dzZXJgIGNhbiBiZSBgdW5kZWZpbmVkYCBpZiBgZW50cnlQb2ludHNgIGlzIHVzZWQuXG4gIGJyb3dzZXI/OiBzdHJpbmc7XG59O1xuXG4vKipcbiAqIE5vcm1hbGl6ZSB0aGUgdXNlciBwcm92aWRlZCBvcHRpb25zIGJ5IGNyZWF0aW5nIGZ1bGwgcGF0aHMgZm9yIGFsbCBwYXRoIGJhc2VkIG9wdGlvbnNcbiAqIGFuZCBjb252ZXJ0aW5nIG11bHRpLWZvcm0gb3B0aW9ucyBpbnRvIGEgc2luZ2xlIGZvcm0gdGhhdCBjYW4gYmUgZGlyZWN0bHkgdXNlZFxuICogYnkgdGhlIGJ1aWxkIHByb2Nlc3MuXG4gKlxuICogQHBhcmFtIGNvbnRleHQgVGhlIGNvbnRleHQgZm9yIGN1cnJlbnQgYnVpbGRlciBleGVjdXRpb24uXG4gKiBAcGFyYW0gcHJvamVjdE5hbWUgVGhlIG5hbWUgb2YgdGhlIHByb2plY3QgZm9yIHRoZSBjdXJyZW50IGV4ZWN1dGlvbi5cbiAqIEBwYXJhbSBvcHRpb25zIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBvcHRpb25zIHRvIHVzZSBmb3IgdGhlIGJ1aWxkLlxuICogQHJldHVybnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgbm9ybWFsaXplZCBvcHRpb25zIHJlcXVpcmVkIHRvIHBlcmZvcm0gdGhlIGJ1aWxkLlxuICovXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG5vcm1hbGl6ZU9wdGlvbnMoXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICBvcHRpb25zOiBBcHBsaWNhdGlvbkJ1aWxkZXJJbnRlcm5hbE9wdGlvbnMsXG4pIHtcbiAgY29uc3Qgd29ya3NwYWNlUm9vdCA9IGNvbnRleHQud29ya3NwYWNlUm9vdDtcbiAgY29uc3QgcHJvamVjdE1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICBjb25zdCBwcm9qZWN0Um9vdCA9IG5vcm1hbGl6ZURpcmVjdG9yeVBhdGgoXG4gICAgcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIChwcm9qZWN0TWV0YWRhdGEucm9vdCBhcyBzdHJpbmcgfCB1bmRlZmluZWQpID8/ICcnKSxcbiAgKTtcbiAgY29uc3QgcHJvamVjdFNvdXJjZVJvb3QgPSBub3JtYWxpemVEaXJlY3RvcnlQYXRoKFxuICAgIHBhdGguam9pbih3b3Jrc3BhY2VSb290LCAocHJvamVjdE1ldGFkYXRhLnNvdXJjZVJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnc3JjJyksXG4gICk7XG5cbiAgLy8gR2F0aGVyIHBlcnNpc3RlbnQgY2FjaGluZyBvcHRpb24gYW5kIHByb3ZpZGUgYSBwcm9qZWN0IHNwZWNpZmljIGNhY2hlIGxvY2F0aW9uXG4gIGNvbnN0IGNhY2hlT3B0aW9ucyA9IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyhwcm9qZWN0TWV0YWRhdGEsIHdvcmtzcGFjZVJvb3QpO1xuICBjYWNoZU9wdGlvbnMucGF0aCA9IHBhdGguam9pbihjYWNoZU9wdGlvbnMucGF0aCwgcHJvamVjdE5hbWUpO1xuXG4gIGNvbnN0IGkxOG5PcHRpb25zOiBJMThuT3B0aW9ucyAmIHtcbiAgICBkdXBsaWNhdGVUcmFuc2xhdGlvbkJlaGF2aW9yPzogSTE4TlRyYW5zbGF0aW9uO1xuICAgIG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yPzogSTE4TlRyYW5zbGF0aW9uO1xuICB9ID0gY3JlYXRlSTE4bk9wdGlvbnMocHJvamVjdE1ldGFkYXRhLCBvcHRpb25zLmxvY2FsaXplKTtcbiAgaTE4bk9wdGlvbnMuZHVwbGljYXRlVHJhbnNsYXRpb25CZWhhdmlvciA9IG9wdGlvbnMuaTE4bkR1cGxpY2F0ZVRyYW5zbGF0aW9uO1xuICBpMThuT3B0aW9ucy5taXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvciA9IG9wdGlvbnMuaTE4bk1pc3NpbmdUcmFuc2xhdGlvbjtcblxuICBjb25zdCBlbnRyeVBvaW50cyA9IG5vcm1hbGl6ZUVudHJ5UG9pbnRzKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMuYnJvd3Nlciwgb3B0aW9ucy5lbnRyeVBvaW50cyk7XG4gIGNvbnN0IHRzY29uZmlnID0gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMudHNDb25maWcpO1xuICBjb25zdCBvdXRwdXRQYXRoID0gbm9ybWFsaXplRGlyZWN0b3J5UGF0aChwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgb3B0aW9ucy5vdXRwdXRQYXRoKSk7XG4gIGNvbnN0IG9wdGltaXphdGlvbk9wdGlvbnMgPSBub3JtYWxpemVPcHRpbWl6YXRpb24ob3B0aW9ucy5vcHRpbWl6YXRpb24pO1xuICBjb25zdCBzb3VyY2VtYXBPcHRpb25zID0gbm9ybWFsaXplU291cmNlTWFwcyhvcHRpb25zLnNvdXJjZU1hcCA/PyBmYWxzZSk7XG4gIGNvbnN0IGFzc2V0cyA9IG9wdGlvbnMuYXNzZXRzPy5sZW5ndGhcbiAgICA/IG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMob3B0aW9ucy5hc3NldHMsIHdvcmtzcGFjZVJvb3QsIHByb2plY3RSb290LCBwcm9qZWN0U291cmNlUm9vdClcbiAgICA6IHVuZGVmaW5lZDtcblxuICBjb25zdCBvdXRwdXROYW1lcyA9IHtcbiAgICBidW5kbGVzOlxuICAgICAgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLkFsbCB8fCBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuQnVuZGxlc1xuICAgICAgICA/ICdbbmFtZV0uW2hhc2hdJ1xuICAgICAgICA6ICdbbmFtZV0nLFxuICAgIG1lZGlhOlxuICAgICAgJ21lZGlhLycgK1xuICAgICAgKG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5BbGwgfHwgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLk1lZGlhXG4gICAgICAgID8gJ1tuYW1lXS5baGFzaF0nXG4gICAgICAgIDogJ1tuYW1lXScpLFxuICB9O1xuXG4gIGxldCBmaWxlUmVwbGFjZW1lbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHwgdW5kZWZpbmVkO1xuICBpZiAob3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgZm9yIChjb25zdCByZXBsYWNlbWVudCBvZiBvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpIHtcbiAgICAgIGZpbGVSZXBsYWNlbWVudHMgPz89IHt9O1xuICAgICAgZmlsZVJlcGxhY2VtZW50c1twYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgcmVwbGFjZW1lbnQucmVwbGFjZSldID0gcGF0aC5qb2luKFxuICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICByZXBsYWNlbWVudC53aXRoLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBnbG9iYWxTdHlsZXM6IHsgbmFtZTogc3RyaW5nOyBmaWxlczogc3RyaW5nW107IGluaXRpYWw6IGJvb2xlYW4gfVtdID0gW107XG4gIGlmIChvcHRpb25zLnN0eWxlcz8ubGVuZ3RoKSB7XG4gICAgY29uc3QgeyBlbnRyeVBvaW50czogc3R5bGVzaGVldEVudHJ5cG9pbnRzLCBub0luamVjdE5hbWVzIH0gPSBub3JtYWxpemVHbG9iYWxTdHlsZXMoXG4gICAgICBvcHRpb25zLnN0eWxlcyB8fCBbXSxcbiAgICApO1xuICAgIGZvciAoY29uc3QgW25hbWUsIGZpbGVzXSBvZiBPYmplY3QuZW50cmllcyhzdHlsZXNoZWV0RW50cnlwb2ludHMpKSB7XG4gICAgICBnbG9iYWxTdHlsZXMucHVzaCh7IG5hbWUsIGZpbGVzLCBpbml0aWFsOiAhbm9JbmplY3ROYW1lcy5pbmNsdWRlcyhuYW1lKSB9KTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBnbG9iYWxTY3JpcHRzOiB7IG5hbWU6IHN0cmluZzsgZmlsZXM6IHN0cmluZ1tdOyBpbml0aWFsOiBib29sZWFuIH1bXSA9IFtdO1xuICBpZiAob3B0aW9ucy5zY3JpcHRzPy5sZW5ndGgpIHtcbiAgICBmb3IgKGNvbnN0IHsgYnVuZGxlTmFtZSwgcGF0aHMsIGluamVjdCB9IG9mIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUob3B0aW9ucy5zY3JpcHRzKSkge1xuICAgICAgZ2xvYmFsU2NyaXB0cy5wdXNoKHsgbmFtZTogYnVuZGxlTmFtZSwgZmlsZXM6IHBhdGhzLCBpbml0aWFsOiBpbmplY3QgfSk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHRhaWx3aW5kQ29uZmlndXJhdGlvbjogeyBmaWxlOiBzdHJpbmc7IHBhY2thZ2U6IHN0cmluZyB9IHwgdW5kZWZpbmVkO1xuICBjb25zdCB0YWlsd2luZENvbmZpZ3VyYXRpb25QYXRoID0gYXdhaXQgZmluZFRhaWx3aW5kQ29uZmlndXJhdGlvbkZpbGUod29ya3NwYWNlUm9vdCwgcHJvamVjdFJvb3QpO1xuICBpZiAodGFpbHdpbmRDb25maWd1cmF0aW9uUGF0aCkge1xuICAgIC8vIENyZWF0ZSBhIG5vZGUgcmVzb2x2ZXIgYXQgdGhlIHByb2plY3Qgcm9vdCBhcyBhIGRpcmVjdG9yeVxuICAgIGNvbnN0IHJlc29sdmVyID0gY3JlYXRlUmVxdWlyZShwcm9qZWN0Um9vdCArICcvJyk7XG4gICAgdHJ5IHtcbiAgICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbiA9IHtcbiAgICAgICAgZmlsZTogdGFpbHdpbmRDb25maWd1cmF0aW9uUGF0aCxcbiAgICAgICAgcGFja2FnZTogcmVzb2x2ZXIucmVzb2x2ZSgndGFpbHdpbmRjc3MnKSxcbiAgICAgIH07XG4gICAgfSBjYXRjaCB7XG4gICAgICBjb25zdCByZWxhdGl2ZVRhaWx3aW5kQ29uZmlnUGF0aCA9IHBhdGgucmVsYXRpdmUod29ya3NwYWNlUm9vdCwgdGFpbHdpbmRDb25maWd1cmF0aW9uUGF0aCk7XG4gICAgICBjb250ZXh0LmxvZ2dlci53YXJuKFxuICAgICAgICBgVGFpbHdpbmQgQ1NTIGNvbmZpZ3VyYXRpb24gZmlsZSBmb3VuZCAoJHtyZWxhdGl2ZVRhaWx3aW5kQ29uZmlnUGF0aH0pYCArXG4gICAgICAgICAgYCBidXQgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZSBpcyBub3QgaW5zdGFsbGVkLmAgK1xuICAgICAgICAgIGAgVG8gZW5hYmxlIFRhaWx3aW5kIENTUywgcGxlYXNlIGluc3RhbGwgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZS5gLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBsZXQgaW5kZXhIdG1sT3B0aW9ucztcbiAgLy8gaW5kZXggY2FuIG5ldmVyIGhhdmUgYSB2YWx1ZSBvZiBgdHJ1ZWAgYnV0IGluIHRoZSBzY2hlbWEgaXQncyBvZiB0eXBlIGBib29sZWFuYC5cbiAgaWYgKHR5cGVvZiBvcHRpb25zLmluZGV4ICE9PSAnYm9vbGVhbicpIHtcbiAgICBpbmRleEh0bWxPcHRpb25zID0ge1xuICAgICAgaW5wdXQ6IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBnZXRJbmRleElucHV0RmlsZShvcHRpb25zLmluZGV4KSksXG4gICAgICAvLyBUaGUgb3V0cHV0IGZpbGUgd2lsbCBiZSBjcmVhdGVkIHdpdGhpbiB0aGUgY29uZmlndXJlZCBvdXRwdXQgcGF0aFxuICAgICAgb3V0cHV0OiBnZXRJbmRleE91dHB1dEZpbGUob3B0aW9ucy5pbmRleCksXG4gICAgICAvLyBUT0RPOiBVc2UgZXhpc3RpbmcgaW5mb3JtYXRpb24gZnJvbSBhYm92ZSB0byBjcmVhdGUgdGhlIGluc2VydGlvbiBvcmRlclxuICAgICAgaW5zZXJ0aW9uT3JkZXI6IGdlbmVyYXRlRW50cnlQb2ludHMoe1xuICAgICAgICBzY3JpcHRzOiBvcHRpb25zLnNjcmlwdHMgPz8gW10sXG4gICAgICAgIHN0eWxlczogb3B0aW9ucy5zdHlsZXMgPz8gW10sXG4gICAgICB9KSxcbiAgICB9O1xuICB9XG5cbiAgbGV0IHNlcnZlckVudHJ5UG9pbnQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgaWYgKG9wdGlvbnMuc2VydmVyKSB7XG4gICAgc2VydmVyRW50cnlQb2ludCA9IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLnNlcnZlcik7XG4gIH0gZWxzZSBpZiAob3B0aW9ucy5zZXJ2ZXIgPT09ICcnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdgc2VydmVyYCBvcHRpb24gY2Fubm90IGJlIGFuIGVtcHR5IHN0cmluZy4nKTtcbiAgfVxuXG4gIGxldCBwcmVyZW5kZXJPcHRpb25zO1xuICBpZiAob3B0aW9ucy5wcmVyZW5kZXIpIHtcbiAgICBjb25zdCB7XG4gICAgICBkaXNjb3ZlclJvdXRlcyA9IHRydWUsXG4gICAgICByb3V0ZXMgPSBbXSxcbiAgICAgIHJvdXRlc0ZpbGUgPSB1bmRlZmluZWQsXG4gICAgfSA9IG9wdGlvbnMucHJlcmVuZGVyID09PSB0cnVlID8ge30gOiBvcHRpb25zLnByZXJlbmRlcjtcblxuICAgIHByZXJlbmRlck9wdGlvbnMgPSB7XG4gICAgICBkaXNjb3ZlclJvdXRlcyxcbiAgICAgIHJvdXRlcyxcbiAgICAgIHJvdXRlc0ZpbGU6IHJvdXRlc0ZpbGUgJiYgcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIHJvdXRlc0ZpbGUpLFxuICAgIH07XG4gIH1cblxuICBsZXQgc3NyT3B0aW9ucztcbiAgaWYgKG9wdGlvbnMuc3NyID09PSB0cnVlKSB7XG4gICAgc3NyT3B0aW9ucyA9IHt9O1xuICB9IGVsc2UgaWYgKHR5cGVvZiBvcHRpb25zLnNzciA9PT0gJ29iamVjdCcpIHtcbiAgICBjb25zdCB7IGVudHJ5IH0gPSBvcHRpb25zLnNzcjtcblxuICAgIHNzck9wdGlvbnMgPSB7XG4gICAgICBlbnRyeTogZW50cnkgJiYgcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGVudHJ5KSxcbiAgICB9O1xuICB9XG5cbiAgbGV0IGFwcFNoZWxsT3B0aW9ucztcbiAgaWYgKG9wdGlvbnMuYXBwU2hlbGwpIHtcbiAgICBhcHBTaGVsbE9wdGlvbnMgPSB7XG4gICAgICByb3V0ZTogJ3NoZWxsJyxcbiAgICB9O1xuICB9XG5cbiAgLy8gSW5pdGlhbCBvcHRpb25zIHRvIGtlZXBcbiAgY29uc3Qge1xuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICBhb3QsXG4gICAgYmFzZUhyZWYsXG4gICAgY3Jvc3NPcmlnaW4sXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgZXh0cmFjdExpY2Vuc2VzLFxuICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UgPSAnY3NzJyxcbiAgICBvdXRFeHRlbnNpb24sXG4gICAgc2VydmljZVdvcmtlcixcbiAgICBwb2xsLFxuICAgIHBvbHlmaWxscyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHN0YXRzSnNvbixcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgdmVyYm9zZSxcbiAgICB3YXRjaCxcbiAgICBwcm9ncmVzcyA9IHRydWUsXG4gICAgZXh0ZXJuYWxQYWNrYWdlcyxcbiAgICBkZWxldGVPdXRwdXRQYXRoLFxuICB9ID0gb3B0aW9ucztcblxuICAvLyBSZXR1cm4gYWxsIHRoZSBub3JtYWxpemVkIG9wdGlvbnNcbiAgcmV0dXJuIHtcbiAgICBhZHZhbmNlZE9wdGltaXphdGlvbnM6ICEhYW90LFxuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICBiYXNlSHJlZixcbiAgICBjYWNoZU9wdGlvbnMsXG4gICAgY3Jvc3NPcmlnaW4sXG4gICAgZGVsZXRlT3V0cHV0UGF0aCxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBleHRyYWN0TGljZW5zZXMsXG4gICAgaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICBqaXQ6ICFhb3QsXG4gICAgc3RhdHM6ICEhc3RhdHNKc29uLFxuICAgIHBvbHlmaWxsczogcG9seWZpbGxzID09PSB1bmRlZmluZWQgfHwgQXJyYXkuaXNBcnJheShwb2x5ZmlsbHMpID8gcG9seWZpbGxzIDogW3BvbHlmaWxsc10sXG4gICAgcG9sbCxcbiAgICBwcm9ncmVzcyxcbiAgICBleHRlcm5hbFBhY2thZ2VzLFxuICAgIC8vIElmIG5vdCBleHBsaWNpdGx5IHNldCwgZGVmYXVsdCB0byB0aGUgTm9kZS5qcyBwcm9jZXNzIGFyZ3VtZW50XG4gICAgcHJlc2VydmVTeW1saW5rczogcHJlc2VydmVTeW1saW5rcyA/PyBwcm9jZXNzLmV4ZWNBcmd2LmluY2x1ZGVzKCctLXByZXNlcnZlLXN5bWxpbmtzJyksXG4gICAgc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIHNlcnZlckVudHJ5UG9pbnQsXG4gICAgcHJlcmVuZGVyT3B0aW9ucyxcbiAgICBhcHBTaGVsbE9wdGlvbnMsXG4gICAgc3NyT3B0aW9ucyxcbiAgICB2ZXJib3NlLFxuICAgIHdhdGNoLFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgZW50cnlQb2ludHMsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBvdXRwdXRQYXRoLFxuICAgIG91dEV4dGVuc2lvbixcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICAgIHByb2plY3RSb290LFxuICAgIGFzc2V0cyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgIGdsb2JhbFN0eWxlcyxcbiAgICBnbG9iYWxTY3JpcHRzLFxuICAgIHNlcnZpY2VXb3JrZXI6XG4gICAgICB0eXBlb2Ygc2VydmljZVdvcmtlciA9PT0gJ3N0cmluZycgPyBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgc2VydmljZVdvcmtlcikgOiB1bmRlZmluZWQsXG4gICAgaW5kZXhIdG1sT3B0aW9ucyxcbiAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gICAgaTE4bk9wdGlvbnMsXG4gIH07XG59XG5cbi8qKlxuICogTm9ybWFsaXplIGVudHJ5IHBvaW50IG9wdGlvbnMuIFRvIG1haW50YWluIGNvbXBhdGliaWxpdHkgd2l0aCB0aGUgbGVnYWN5IGJyb3dzZXIgYnVpbGRlciwgd2UgbmVlZCBhIHNpbmdsZSBgYnJvd3NlcmBcbiAqIG9wdGlvbiB3aGljaCBkZWZpbmVzIGEgc2luZ2xlIGVudHJ5IHBvaW50LiBIb3dldmVyLCB3ZSBhbHNvIHdhbnQgdG8gc3VwcG9ydCBtdWx0aXBsZSBlbnRyeSBwb2ludHMgYXMgYW4gaW50ZXJuYWwgb3B0aW9uLlxuICogVGhlIHR3byBvcHRpb25zIGFyZSBtdXR1YWxseSBleGNsdXNpdmUgYW5kIGlmIGBicm93c2VyYCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWQgYXMgdGhlIHNvbGUgZW50cnkgcG9pbnQuXG4gKiBJZiBgZW50cnlQb2ludHNgIGFyZSBwcm92aWRlZCwgdGhleSB3aWxsIGJlIHVzZWQgYXMgdGhlIHNldCBvZiBlbnRyeSBwb2ludHMuXG4gKlxuICogQHBhcmFtIHdvcmtzcGFjZVJvb3QgUGF0aCB0byB0aGUgcm9vdCBvZiB0aGUgQW5ndWxhciB3b3Jrc3BhY2UuXG4gKiBAcGFyYW0gYnJvd3NlciBUaGUgYGJyb3dzZXJgIG9wdGlvbiBwb2ludGluZyBhdCB0aGUgYXBwbGljYXRpb24gZW50cnkgcG9pbnQuIFdoaWxlIHJlcXVpcmVkIHBlciB0aGUgc2NoZW1hIGZpbGUsIGl0IG1heSBiZSBvbWl0dGVkIGJ5XG4gKiAgICAgcHJvZ3JhbW1hdGljIHVzYWdlcyBvZiBgYnJvd3Nlci1lc2J1aWxkYC5cbiAqIEBwYXJhbSBlbnRyeVBvaW50cyBTZXQgb2YgZW50cnkgcG9pbnRzIHRvIHVzZSBpZiBwcm92aWRlZC5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBtYXBwaW5nIGVudHJ5IHBvaW50IG5hbWVzIHRvIHRoZWlyIGZpbGUgcGF0aHMuXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZUVudHJ5UG9pbnRzKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIGJyb3dzZXI6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgZW50cnlQb2ludHM6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpLFxuKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gIGlmIChicm93c2VyID09PSAnJykge1xuICAgIHRocm93IG5ldyBFcnJvcignYGJyb3dzZXJgIG9wdGlvbiBjYW5ub3QgYmUgYW4gZW1wdHkgc3RyaW5nLicpO1xuICB9XG5cbiAgLy8gYGJyb3dzZXJgIGFuZCBgZW50cnlQb2ludHNgIGFyZSBtdXR1YWxseSBleGNsdXNpdmUuXG4gIGlmIChicm93c2VyICYmIGVudHJ5UG9pbnRzLnNpemUgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdPbmx5IG9uZSBvZiBgYnJvd3NlcmAgb3IgYGVudHJ5UG9pbnRzYCBtYXkgYmUgcHJvdmlkZWQuJyk7XG4gIH1cbiAgaWYgKCFicm93c2VyICYmIGVudHJ5UG9pbnRzLnNpemUgPT09IDApIHtcbiAgICAvLyBTY2hlbWEgc2hvdWxkIG5vcm1hbGx5IHJlamVjdCB0aGlzIGNhc2UsIGJ1dCBwcm9ncmFtbWF0aWMgdXNhZ2VzIG9mIHRoZSBidWlsZGVyIG1pZ2h0IG1ha2UgdGhpcyBtaXN0YWtlLlxuICAgIHRocm93IG5ldyBFcnJvcignRWl0aGVyIGBicm93c2VyYCBvciBhdCBsZWFzdCBvbmUgYGVudHJ5UG9pbnRzYCB2YWx1ZSBtdXN0IGJlIHByb3ZpZGVkLicpO1xuICB9XG5cbiAgLy8gU2NoZW1hIHR5cGVzIGZvcmNlIGBicm93c2VyYCB0byBhbHdheXMgYmUgcHJvdmlkZWQsIGJ1dCBpdCBtYXkgYmUgb21pdHRlZCB3aGVuIHRoZSBidWlsZGVyIGlzIGludm9rZWQgcHJvZ3JhbW1hdGljYWxseS5cbiAgaWYgKGJyb3dzZXIpIHtcbiAgICAvLyBVc2UgYGJyb3dzZXJgIGFsb25lLlxuICAgIHJldHVybiB7ICdtYWluJzogcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGJyb3dzZXIpIH07XG4gIH0gZWxzZSB7XG4gICAgLy8gVXNlIGBlbnRyeVBvaW50c2AgYWxvbmUuXG4gICAgY29uc3QgZW50cnlQb2ludFBhdGhzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgZm9yIChjb25zdCBlbnRyeVBvaW50IG9mIGVudHJ5UG9pbnRzKSB7XG4gICAgICBjb25zdCBwYXJzZWRFbnRyeVBvaW50ID0gcGF0aC5wYXJzZShlbnRyeVBvaW50KTtcblxuICAgICAgLy8gVXNlIHRoZSBpbnB1dCBmaWxlIHBhdGggd2l0aG91dCBhbiBleHRlbnNpb24gYXMgdGhlIFwibmFtZVwiIG9mIHRoZSBlbnRyeSBwb2ludCBkaWN0YXRpbmcgaXRzIG91dHB1dCBsb2NhdGlvbi5cbiAgICAgIC8vIFJlbGF0aXZlIGVudHJ5IHBvaW50cyBhcmUgZ2VuZXJhdGVkIGF0IHRoZSBzYW1lIHJlbGF0aXZlIHBhdGggaW4gdGhlIG91dHB1dCBkaXJlY3RvcnkuXG4gICAgICAvLyBBYnNvbHV0ZSBlbnRyeSBwb2ludHMgYXJlIGFsd2F5cyBnZW5lcmF0ZWQgd2l0aCB0aGUgc2FtZSBmaWxlIG5hbWUgaW4gdGhlIHJvb3Qgb2YgdGhlIG91dHB1dCBkaXJlY3RvcnkuIFRoaXMgaW5jbHVkZXMgYWJzb2x1dGVcbiAgICAgIC8vIHBhdGhzIHBvaW50aW5nIGF0IGZpbGVzIGFjdHVhbGx5IHdpdGhpbiB0aGUgd29ya3NwYWNlIHJvb3QuXG4gICAgICBjb25zdCBlbnRyeVBvaW50TmFtZSA9IHBhdGguaXNBYnNvbHV0ZShlbnRyeVBvaW50KVxuICAgICAgICA/IHBhcnNlZEVudHJ5UG9pbnQubmFtZVxuICAgICAgICA6IHBhdGguam9pbihwYXJzZWRFbnRyeVBvaW50LmRpciwgcGFyc2VkRW50cnlQb2ludC5uYW1lKTtcblxuICAgICAgLy8gR2V0IHRoZSBmdWxsIGZpbGUgcGF0aCB0byB0aGUgZW50cnkgcG9pbnQgaW5wdXQuXG4gICAgICBjb25zdCBlbnRyeVBvaW50UGF0aCA9IHBhdGguaXNBYnNvbHV0ZShlbnRyeVBvaW50KVxuICAgICAgICA/IGVudHJ5UG9pbnRcbiAgICAgICAgOiBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgZW50cnlQb2ludCk7XG5cbiAgICAgIC8vIENoZWNrIGZvciBjb25mbGljdHMgd2l0aCBwcmV2aW91cyBlbnRyeSBwb2ludHMuXG4gICAgICBjb25zdCBleGlzdGluZ0VudHJ5UG9pbnRQYXRoID0gZW50cnlQb2ludFBhdGhzW2VudHJ5UG9pbnROYW1lXTtcbiAgICAgIGlmIChleGlzdGluZ0VudHJ5UG9pbnRQYXRoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgXFxgJHtleGlzdGluZ0VudHJ5UG9pbnRQYXRofVxcYCBhbmQgXFxgJHtlbnRyeVBvaW50UGF0aH1cXGAgYm90aCBvdXRwdXQgdG8gdGhlIHNhbWUgbG9jYXRpb24gXFxgJHtlbnRyeVBvaW50TmFtZX1cXGAuYCArXG4gICAgICAgICAgICAnIFJlbmFtZSBvciBtb3ZlIG9uZSBvZiB0aGUgZmlsZXMgdG8gZml4IHRoZSBjb25mbGljdC4nLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBlbnRyeVBvaW50UGF0aHNbZW50cnlQb2ludE5hbWVdID0gZW50cnlQb2ludFBhdGg7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVudHJ5UG9pbnRQYXRocztcbiAgfVxufVxuXG4vKipcbiAqIE5vcm1hbGl6ZSBhIGRpcmVjdG9yeSBwYXRoIHN0cmluZy5cbiAqIEN1cnJlbnRseSBvbmx5IHJlbW92ZXMgYSB0cmFpbGluZyBzbGFzaCBpZiBwcmVzZW50LlxuICogQHBhcmFtIHBhdGggQSBwYXRoIHN0cmluZy5cbiAqIEByZXR1cm5zIEEgbm9ybWFsaXplZCBwYXRoIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplRGlyZWN0b3J5UGF0aChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBsYXN0ID0gcGF0aFtwYXRoLmxlbmd0aCAtIDFdO1xuICBpZiAobGFzdCA9PT0gJy8nIHx8IGxhc3QgPT09ICdcXFxcJykge1xuICAgIHJldHVybiBwYXRoLnNsaWNlKDAsIC0xKTtcbiAgfVxuXG4gIHJldHVybiBwYXRoO1xufVxuIl19