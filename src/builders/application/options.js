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
async function normalizeOptions(context, projectName, options) {
    const workspaceRoot = context.workspaceRoot;
    const projectMetadata = await context.getProjectMetadata(projectName);
    const projectRoot = normalizeDirectoryPath(node_path_1.default.join(workspaceRoot, projectMetadata.root ?? ''));
    const projectSourceRoot = normalizeDirectoryPath(node_path_1.default.join(workspaceRoot, projectMetadata.sourceRoot ?? 'src'));
    // Gather persistent caching option and provide a project specific cache location
    const cacheOptions = (0, normalize_cache_1.normalizeCacheOptions)(projectMetadata, workspaceRoot);
    cacheOptions.path = node_path_1.default.join(cacheOptions.path, projectName);
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
    const { allowedCommonJsDependencies, aot, baseHref, crossOrigin, externalDependencies, extractLicenses, inlineStyleLanguage = 'css', outExtension, serviceWorker, poll, polyfills, preserveSymlinks, statsJson, stylePreprocessorOptions, subresourceIntegrity, verbose, server, watch, progress = true, externalPackages, deleteOutputPath, } = options;
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
        server: !!server && node_path_1.default.join(workspaceRoot, server),
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
        serviceWorker,
        indexHtmlOptions,
        tailwindConfiguration,
    };
}
exports.normalizeOptions = normalizeOptions;
/**
 * Normalize entry point options. To maintain compatibility with the legacy browser builder, we need a single `main` option which defines a
 * single entry point. However, we also want to support multiple entry points as an internal option. The two options are mutually exclusive
 * and if `main` is provided it will be used as the sole entry point. If `entryPoints` are provided, they will be used as the set of entry
 * points.
 *
 * @param workspaceRoot Path to the root of the Angular workspace.
 * @param main The `main` option pointing at the application entry point. While required per the schema file, it may be omitted by
 *     programmatic usages of `browser-esbuild`.
 * @param entryPoints Set of entry points to use if provided.
 * @returns An object mapping entry point names to their file paths.
 */
function normalizeEntryPoints(workspaceRoot, main, entryPoints = new Set()) {
    if (main === '') {
        throw new Error('`main` option cannot be an empty string.');
    }
    // `main` and `entryPoints` are mutually exclusive.
    if (main && entryPoints.size > 0) {
        throw new Error('Only one of `main` or `entryPoints` may be provided.');
    }
    if (!main && entryPoints.size === 0) {
        // Schema should normally reject this case, but programmatic usages of the builder might make this mistake.
        throw new Error('Either `main` or at least one `entryPoints` value must be provided.');
    }
    // Schema types force `main` to always be provided, but it may be omitted when the builder is invoked programmatically.
    if (main) {
        // Use `main` alone.
        return { 'main': node_path_1.default.join(workspaceRoot, main) };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL29wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsNkNBQTRDO0FBQzVDLDBEQUE2QjtBQUM3QiwrREFHMkM7QUFDM0MsdUNBQWlHO0FBQ2pHLGlFQUFvRTtBQUNwRSx1RUFBcUU7QUFDckUsbURBQXFFO0FBQ3JFLCtFQUEyRjtBQUMzRixxQ0FBOEU7QUFpQzlFOzs7Ozs7Ozs7R0FTRztBQUNJLEtBQUssVUFBVSxnQkFBZ0IsQ0FDcEMsT0FBdUIsRUFDdkIsV0FBbUIsRUFDbkIsT0FBMEM7SUFFMUMsTUFBTSxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUM1QyxNQUFNLGVBQWUsR0FBRyxNQUFNLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN0RSxNQUFNLFdBQVcsR0FBRyxzQkFBc0IsQ0FDeEMsbUJBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFHLGVBQWUsQ0FBQyxJQUEyQixJQUFJLEVBQUUsQ0FBQyxDQUM3RSxDQUFDO0lBQ0YsTUFBTSxpQkFBaUIsR0FBRyxzQkFBc0IsQ0FDOUMsbUJBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFHLGVBQWUsQ0FBQyxVQUFpQyxJQUFJLEtBQUssQ0FBQyxDQUN0RixDQUFDO0lBRUYsaUZBQWlGO0lBQ2pGLE1BQU0sWUFBWSxHQUFHLElBQUEsdUNBQXFCLEVBQUMsZUFBZSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQzNFLFlBQVksQ0FBQyxJQUFJLEdBQUcsbUJBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztJQUU5RCxNQUFNLFdBQVcsR0FBRyxv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QUksQ0FBQztBQUNkLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdub2RlOm1vZHVsZSc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHtcbiAgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZSxcbiAgbm9ybWFsaXplR2xvYmFsU3R5bGVzLFxufSBmcm9tICcuLi8uLi90b29scy93ZWJwYWNrL3V0aWxzL2hlbHBlcnMnO1xuaW1wb3J0IHsgbm9ybWFsaXplQXNzZXRQYXR0ZXJucywgbm9ybWFsaXplT3B0aW1pemF0aW9uLCBub3JtYWxpemVTb3VyY2VNYXBzIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgbm9ybWFsaXplQ2FjaGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvbm9ybWFsaXplLWNhY2hlJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMgfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgZmluZFRhaWx3aW5kQ29uZmlndXJhdGlvbkZpbGUgfSBmcm9tICcuLi8uLi91dGlscy90YWlsd2luZCc7XG5pbXBvcnQgeyBnZXRJbmRleElucHV0RmlsZSwgZ2V0SW5kZXhPdXRwdXRGaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQXBwbGljYXRpb25CdWlsZGVyT3B0aW9ucywgT3V0cHV0SGFzaGluZyB9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IHR5cGUgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zID0gQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBub3JtYWxpemVPcHRpb25zPj47XG5cbi8qKiBJbnRlcm5hbCBvcHRpb25zIGhpZGRlbiBmcm9tIGJ1aWxkZXIgc2NoZW1hIGJ1dCBhdmFpbGFibGUgd2hlbiBpbnZva2VkIHByb2dyYW1tYXRpY2FsbHkuICovXG5pbnRlcmZhY2UgSW50ZXJuYWxPcHRpb25zIHtcbiAgLyoqXG4gICAqIEVudHJ5IHBvaW50cyB0byB1c2UgZm9yIHRoZSBjb21waWxhdGlvbi4gSW5jb21wYXRpYmxlIHdpdGggYG1haW5gLCB3aGljaCBtdXN0IG5vdCBiZSBwcm92aWRlZC4gTWF5IGJlIHJlbGF0aXZlIG9yIGFic29sdXRlIHBhdGhzLlxuICAgKiBJZiBnaXZlbiBhIHJlbGF0aXZlIHBhdGgsIGl0IGlzIHJlc29sdmVkIHJlbGF0aXZlIHRvIHRoZSBjdXJyZW50IHdvcmtzcGFjZSBhbmQgd2lsbCBnZW5lcmF0ZSBhbiBvdXRwdXQgYXQgdGhlIHNhbWUgcmVsYXRpdmUgbG9jYXRpb25cbiAgICogaW4gdGhlIG91dHB1dCBkaXJlY3RvcnkuIElmIGdpdmVuIGFuIGFic29sdXRlIHBhdGgsIHRoZSBvdXRwdXQgd2lsbCBiZSBnZW5lcmF0ZWQgaW4gdGhlIHJvb3Qgb2YgdGhlIG91dHB1dCBkaXJlY3Rvcnkgd2l0aCB0aGUgc2FtZSBiYXNlXG4gICAqIG5hbWUuXG4gICAqL1xuICBlbnRyeVBvaW50cz86IFNldDxzdHJpbmc+O1xuXG4gIC8qKiBGaWxlIGV4dGVuc2lvbiB0byB1c2UgZm9yIHRoZSBnZW5lcmF0ZWQgb3V0cHV0IGZpbGVzLiAqL1xuICBvdXRFeHRlbnNpb24/OiAnanMnIHwgJ21qcyc7XG5cbiAgLyoqXG4gICAqIEluZGljYXRlcyB3aGV0aGVyIGFsbCBub2RlIHBhY2thZ2VzIHNob3VsZCBiZSBtYXJrZWQgYXMgZXh0ZXJuYWwuXG4gICAqIEN1cnJlbnRseSB1c2VkIGJ5IHRoZSBkZXYtc2VydmVyIHRvIHN1cHBvcnQgcHJlYnVuZGxpbmcuXG4gICAqL1xuICBleHRlcm5hbFBhY2thZ2VzPzogYm9vbGVhbjtcbn1cblxuLyoqIEZ1bGwgc2V0IG9mIG9wdGlvbnMgZm9yIGBicm93c2VyLWVzYnVpbGRgIGJ1aWxkZXIuICovXG5leHBvcnQgdHlwZSBBcHBsaWNhdGlvbkJ1aWxkZXJJbnRlcm5hbE9wdGlvbnMgPSBPbWl0PFxuICBBcHBsaWNhdGlvbkJ1aWxkZXJPcHRpb25zICYgSW50ZXJuYWxPcHRpb25zLFxuICAnYnJvd3Nlcidcbj4gJiB7XG4gIC8vIGBicm93c2VyYCBjYW4gYmUgYHVuZGVmaW5lZGAgaWYgYGVudHJ5UG9pbnRzYCBpcyB1c2VkLlxuICBicm93c2VyPzogc3RyaW5nO1xufTtcblxuLyoqXG4gKiBOb3JtYWxpemUgdGhlIHVzZXIgcHJvdmlkZWQgb3B0aW9ucyBieSBjcmVhdGluZyBmdWxsIHBhdGhzIGZvciBhbGwgcGF0aCBiYXNlZCBvcHRpb25zXG4gKiBhbmQgY29udmVydGluZyBtdWx0aS1mb3JtIG9wdGlvbnMgaW50byBhIHNpbmdsZSBmb3JtIHRoYXQgY2FuIGJlIGRpcmVjdGx5IHVzZWRcbiAqIGJ5IHRoZSBidWlsZCBwcm9jZXNzLlxuICpcbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBjb250ZXh0IGZvciBjdXJyZW50IGJ1aWxkZXIgZXhlY3V0aW9uLlxuICogQHBhcmFtIHByb2plY3ROYW1lIFRoZSBuYW1lIG9mIHRoZSBwcm9qZWN0IGZvciB0aGUgY3VycmVudCBleGVjdXRpb24uXG4gKiBAcGFyYW0gb3B0aW9ucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgb3B0aW9ucyB0byB1c2UgZm9yIHRoZSBidWlsZC5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBjb250YWluaW5nIG5vcm1hbGl6ZWQgb3B0aW9ucyByZXF1aXJlZCB0byBwZXJmb3JtIHRoZSBidWlsZC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG5vcm1hbGl6ZU9wdGlvbnMoXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICBvcHRpb25zOiBBcHBsaWNhdGlvbkJ1aWxkZXJJbnRlcm5hbE9wdGlvbnMsXG4pIHtcbiAgY29uc3Qgd29ya3NwYWNlUm9vdCA9IGNvbnRleHQud29ya3NwYWNlUm9vdDtcbiAgY29uc3QgcHJvamVjdE1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICBjb25zdCBwcm9qZWN0Um9vdCA9IG5vcm1hbGl6ZURpcmVjdG9yeVBhdGgoXG4gICAgcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIChwcm9qZWN0TWV0YWRhdGEucm9vdCBhcyBzdHJpbmcgfCB1bmRlZmluZWQpID8/ICcnKSxcbiAgKTtcbiAgY29uc3QgcHJvamVjdFNvdXJjZVJvb3QgPSBub3JtYWxpemVEaXJlY3RvcnlQYXRoKFxuICAgIHBhdGguam9pbih3b3Jrc3BhY2VSb290LCAocHJvamVjdE1ldGFkYXRhLnNvdXJjZVJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnc3JjJyksXG4gICk7XG5cbiAgLy8gR2F0aGVyIHBlcnNpc3RlbnQgY2FjaGluZyBvcHRpb24gYW5kIHByb3ZpZGUgYSBwcm9qZWN0IHNwZWNpZmljIGNhY2hlIGxvY2F0aW9uXG4gIGNvbnN0IGNhY2hlT3B0aW9ucyA9IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyhwcm9qZWN0TWV0YWRhdGEsIHdvcmtzcGFjZVJvb3QpO1xuICBjYWNoZU9wdGlvbnMucGF0aCA9IHBhdGguam9pbihjYWNoZU9wdGlvbnMucGF0aCwgcHJvamVjdE5hbWUpO1xuXG4gIGNvbnN0IGVudHJ5UG9pbnRzID0gbm9ybWFsaXplRW50cnlQb2ludHMod29ya3NwYWNlUm9vdCwgb3B0aW9ucy5icm93c2VyLCBvcHRpb25zLmVudHJ5UG9pbnRzKTtcbiAgY29uc3QgdHNjb25maWcgPSBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgb3B0aW9ucy50c0NvbmZpZyk7XG4gIGNvbnN0IG91dHB1dFBhdGggPSBub3JtYWxpemVEaXJlY3RvcnlQYXRoKHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLm91dHB1dFBhdGgpKTtcbiAgY29uc3Qgb3B0aW1pemF0aW9uT3B0aW9ucyA9IG5vcm1hbGl6ZU9wdGltaXphdGlvbihvcHRpb25zLm9wdGltaXphdGlvbik7XG4gIGNvbnN0IHNvdXJjZW1hcE9wdGlvbnMgPSBub3JtYWxpemVTb3VyY2VNYXBzKG9wdGlvbnMuc291cmNlTWFwID8/IGZhbHNlKTtcbiAgY29uc3QgYXNzZXRzID0gb3B0aW9ucy5hc3NldHM/Lmxlbmd0aFxuICAgID8gbm9ybWFsaXplQXNzZXRQYXR0ZXJucyhvcHRpb25zLmFzc2V0cywgd29ya3NwYWNlUm9vdCwgcHJvamVjdFJvb3QsIHByb2plY3RTb3VyY2VSb290KVxuICAgIDogdW5kZWZpbmVkO1xuXG4gIGNvbnN0IG91dHB1dE5hbWVzID0ge1xuICAgIGJ1bmRsZXM6XG4gICAgICBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuQWxsIHx8IG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5CdW5kbGVzXG4gICAgICAgID8gJ1tuYW1lXS5baGFzaF0nXG4gICAgICAgIDogJ1tuYW1lXScsXG4gICAgbWVkaWE6XG4gICAgICBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuQWxsIHx8IG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5NZWRpYVxuICAgICAgICA/ICdbbmFtZV0uW2hhc2hdJ1xuICAgICAgICA6ICdbbmFtZV0nLFxuICB9O1xuICBpZiAob3B0aW9ucy5yZXNvdXJjZXNPdXRwdXRQYXRoKSB7XG4gICAgb3V0cHV0TmFtZXMubWVkaWEgPSBwYXRoLmpvaW4ob3B0aW9ucy5yZXNvdXJjZXNPdXRwdXRQYXRoLCBvdXRwdXROYW1lcy5tZWRpYSk7XG4gIH1cblxuICBsZXQgZmlsZVJlcGxhY2VtZW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB8IHVuZGVmaW5lZDtcbiAgaWYgKG9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykge1xuICAgIGZvciAoY29uc3QgcmVwbGFjZW1lbnQgb2Ygb3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgICBmaWxlUmVwbGFjZW1lbnRzID8/PSB7fTtcbiAgICAgIGZpbGVSZXBsYWNlbWVudHNbcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIHJlcGxhY2VtZW50LnJlcGxhY2UpXSA9IHBhdGguam9pbihcbiAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgcmVwbGFjZW1lbnQud2l0aCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZ2xvYmFsU3R5bGVzOiB7IG5hbWU6IHN0cmluZzsgZmlsZXM6IHN0cmluZ1tdOyBpbml0aWFsOiBib29sZWFuIH1bXSA9IFtdO1xuICBpZiAob3B0aW9ucy5zdHlsZXM/Lmxlbmd0aCkge1xuICAgIGNvbnN0IHsgZW50cnlQb2ludHM6IHN0eWxlc2hlZXRFbnRyeXBvaW50cywgbm9JbmplY3ROYW1lcyB9ID0gbm9ybWFsaXplR2xvYmFsU3R5bGVzKFxuICAgICAgb3B0aW9ucy5zdHlsZXMgfHwgW10sXG4gICAgKTtcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBmaWxlc10gb2YgT2JqZWN0LmVudHJpZXMoc3R5bGVzaGVldEVudHJ5cG9pbnRzKSkge1xuICAgICAgZ2xvYmFsU3R5bGVzLnB1c2goeyBuYW1lLCBmaWxlcywgaW5pdGlhbDogIW5vSW5qZWN0TmFtZXMuaW5jbHVkZXMobmFtZSkgfSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZ2xvYmFsU2NyaXB0czogeyBuYW1lOiBzdHJpbmc7IGZpbGVzOiBzdHJpbmdbXTsgaW5pdGlhbDogYm9vbGVhbiB9W10gPSBbXTtcbiAgaWYgKG9wdGlvbnMuc2NyaXB0cz8ubGVuZ3RoKSB7XG4gICAgZm9yIChjb25zdCB7IGJ1bmRsZU5hbWUsIHBhdGhzLCBpbmplY3QgfSBvZiBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lKG9wdGlvbnMuc2NyaXB0cykpIHtcbiAgICAgIGdsb2JhbFNjcmlwdHMucHVzaCh7IG5hbWU6IGJ1bmRsZU5hbWUsIGZpbGVzOiBwYXRocywgaW5pdGlhbDogaW5qZWN0IH0pO1xuICAgIH1cbiAgfVxuXG4gIGxldCB0YWlsd2luZENvbmZpZ3VyYXRpb246IHsgZmlsZTogc3RyaW5nOyBwYWNrYWdlOiBzdHJpbmcgfSB8IHVuZGVmaW5lZDtcbiAgY29uc3QgdGFpbHdpbmRDb25maWd1cmF0aW9uUGF0aCA9IGF3YWl0IGZpbmRUYWlsd2luZENvbmZpZ3VyYXRpb25GaWxlKHdvcmtzcGFjZVJvb3QsIHByb2plY3RSb290KTtcbiAgaWYgKHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgpIHtcbiAgICAvLyBDcmVhdGUgYSBub2RlIHJlc29sdmVyIGF0IHRoZSBwcm9qZWN0IHJvb3QgYXMgYSBkaXJlY3RvcnlcbiAgICBjb25zdCByZXNvbHZlciA9IGNyZWF0ZVJlcXVpcmUocHJvamVjdFJvb3QgKyAnLycpO1xuICAgIHRyeSB7XG4gICAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24gPSB7XG4gICAgICAgIGZpbGU6IHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgsXG4gICAgICAgIHBhY2thZ2U6IHJlc29sdmVyLnJlc29sdmUoJ3RhaWx3aW5kY3NzJyksXG4gICAgICB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29uc3QgcmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGggPSBwYXRoLnJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgpO1xuICAgICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgYFRhaWx3aW5kIENTUyBjb25maWd1cmF0aW9uIGZpbGUgZm91bmQgKCR7cmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGh9KWAgK1xuICAgICAgICAgIGAgYnV0IHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UgaXMgbm90IGluc3RhbGxlZC5gICtcbiAgICAgICAgICBgIFRvIGVuYWJsZSBUYWlsd2luZCBDU1MsIHBsZWFzZSBpbnN0YWxsIHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UuYCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbGV0IGluZGV4SHRtbE9wdGlvbnM7XG4gIGlmIChvcHRpb25zLmluZGV4KSB7XG4gICAgaW5kZXhIdG1sT3B0aW9ucyA9IHtcbiAgICAgIGlucHV0OiBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgZ2V0SW5kZXhJbnB1dEZpbGUob3B0aW9ucy5pbmRleCkpLFxuICAgICAgLy8gVGhlIG91dHB1dCBmaWxlIHdpbGwgYmUgY3JlYXRlZCB3aXRoaW4gdGhlIGNvbmZpZ3VyZWQgb3V0cHV0IHBhdGhcbiAgICAgIG91dHB1dDogZ2V0SW5kZXhPdXRwdXRGaWxlKG9wdGlvbnMuaW5kZXgpLFxuICAgICAgLy8gVE9ETzogVXNlIGV4aXN0aW5nIGluZm9ybWF0aW9uIGZyb20gYWJvdmUgdG8gY3JlYXRlIHRoZSBpbnNlcnRpb24gb3JkZXJcbiAgICAgIGluc2VydGlvbk9yZGVyOiBnZW5lcmF0ZUVudHJ5UG9pbnRzKHtcbiAgICAgICAgc2NyaXB0czogb3B0aW9ucy5zY3JpcHRzID8/IFtdLFxuICAgICAgICBzdHlsZXM6IG9wdGlvbnMuc3R5bGVzID8/IFtdLFxuICAgICAgfSksXG4gICAgfTtcbiAgfVxuXG4gIC8vIEluaXRpYWwgb3B0aW9ucyB0byBrZWVwXG4gIGNvbnN0IHtcbiAgICBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMsXG4gICAgYW90LFxuICAgIGJhc2VIcmVmLFxuICAgIGNyb3NzT3JpZ2luLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIGV4dHJhY3RMaWNlbnNlcyxcbiAgICBpbmxpbmVTdHlsZUxhbmd1YWdlID0gJ2NzcycsXG4gICAgb3V0RXh0ZW5zaW9uLFxuICAgIHNlcnZpY2VXb3JrZXIsXG4gICAgcG9sbCxcbiAgICBwb2x5ZmlsbHMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBzdGF0c0pzb24sXG4gICAgc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIHZlcmJvc2UsXG4gICAgc2VydmVyLFxuICAgIHdhdGNoLFxuICAgIHByb2dyZXNzID0gdHJ1ZSxcbiAgICBleHRlcm5hbFBhY2thZ2VzLFxuICAgIGRlbGV0ZU91dHB1dFBhdGgsXG4gIH0gPSBvcHRpb25zO1xuXG4gIC8vIFJldHVybiBhbGwgdGhlIG5vcm1hbGl6ZWQgb3B0aW9uc1xuICByZXR1cm4ge1xuICAgIGFkdmFuY2VkT3B0aW1pemF0aW9uczogISFhb3QsXG4gICAgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgIGJhc2VIcmVmLFxuICAgIGNhY2hlT3B0aW9ucyxcbiAgICBjcm9zc09yaWdpbixcbiAgICBkZWxldGVPdXRwdXRQYXRoLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIGV4dHJhY3RMaWNlbnNlcyxcbiAgICBpbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgIGppdDogIWFvdCxcbiAgICBzdGF0czogISFzdGF0c0pzb24sXG4gICAgcG9seWZpbGxzOiBwb2x5ZmlsbHMgPT09IHVuZGVmaW5lZCB8fCBBcnJheS5pc0FycmF5KHBvbHlmaWxscykgPyBwb2x5ZmlsbHMgOiBbcG9seWZpbGxzXSxcbiAgICBwb2xsLFxuICAgIHByb2dyZXNzLFxuICAgIGV4dGVybmFsUGFja2FnZXMsXG4gICAgLy8gSWYgbm90IGV4cGxpY2l0bHkgc2V0LCBkZWZhdWx0IHRvIHRoZSBOb2RlLmpzIHByb2Nlc3MgYXJndW1lbnRcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzOiBwcmVzZXJ2ZVN5bWxpbmtzID8/IHByb2Nlc3MuZXhlY0FyZ3YuaW5jbHVkZXMoJy0tcHJlc2VydmUtc3ltbGlua3MnKSxcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgc2VydmVyOiAhIXNlcnZlciAmJiBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgc2VydmVyKSxcbiAgICB2ZXJib3NlLFxuICAgIHdhdGNoLFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgZW50cnlQb2ludHMsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBvdXRwdXRQYXRoLFxuICAgIG91dEV4dGVuc2lvbixcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICAgIHByb2plY3RSb290LFxuICAgIGFzc2V0cyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgIGdsb2JhbFN0eWxlcyxcbiAgICBnbG9iYWxTY3JpcHRzLFxuICAgIHNlcnZpY2VXb3JrZXIsXG4gICAgaW5kZXhIdG1sT3B0aW9ucyxcbiAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gIH07XG59XG5cbi8qKlxuICogTm9ybWFsaXplIGVudHJ5IHBvaW50IG9wdGlvbnMuIFRvIG1haW50YWluIGNvbXBhdGliaWxpdHkgd2l0aCB0aGUgbGVnYWN5IGJyb3dzZXIgYnVpbGRlciwgd2UgbmVlZCBhIHNpbmdsZSBgbWFpbmAgb3B0aW9uIHdoaWNoIGRlZmluZXMgYVxuICogc2luZ2xlIGVudHJ5IHBvaW50LiBIb3dldmVyLCB3ZSBhbHNvIHdhbnQgdG8gc3VwcG9ydCBtdWx0aXBsZSBlbnRyeSBwb2ludHMgYXMgYW4gaW50ZXJuYWwgb3B0aW9uLiBUaGUgdHdvIG9wdGlvbnMgYXJlIG11dHVhbGx5IGV4Y2x1c2l2ZVxuICogYW5kIGlmIGBtYWluYCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWQgYXMgdGhlIHNvbGUgZW50cnkgcG9pbnQuIElmIGBlbnRyeVBvaW50c2AgYXJlIHByb3ZpZGVkLCB0aGV5IHdpbGwgYmUgdXNlZCBhcyB0aGUgc2V0IG9mIGVudHJ5XG4gKiBwb2ludHMuXG4gKlxuICogQHBhcmFtIHdvcmtzcGFjZVJvb3QgUGF0aCB0byB0aGUgcm9vdCBvZiB0aGUgQW5ndWxhciB3b3Jrc3BhY2UuXG4gKiBAcGFyYW0gbWFpbiBUaGUgYG1haW5gIG9wdGlvbiBwb2ludGluZyBhdCB0aGUgYXBwbGljYXRpb24gZW50cnkgcG9pbnQuIFdoaWxlIHJlcXVpcmVkIHBlciB0aGUgc2NoZW1hIGZpbGUsIGl0IG1heSBiZSBvbWl0dGVkIGJ5XG4gKiAgICAgcHJvZ3JhbW1hdGljIHVzYWdlcyBvZiBgYnJvd3Nlci1lc2J1aWxkYC5cbiAqIEBwYXJhbSBlbnRyeVBvaW50cyBTZXQgb2YgZW50cnkgcG9pbnRzIHRvIHVzZSBpZiBwcm92aWRlZC5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBtYXBwaW5nIGVudHJ5IHBvaW50IG5hbWVzIHRvIHRoZWlyIGZpbGUgcGF0aHMuXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZUVudHJ5UG9pbnRzKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIG1haW46IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgZW50cnlQb2ludHM6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpLFxuKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gIGlmIChtYWluID09PSAnJykge1xuICAgIHRocm93IG5ldyBFcnJvcignYG1haW5gIG9wdGlvbiBjYW5ub3QgYmUgYW4gZW1wdHkgc3RyaW5nLicpO1xuICB9XG5cbiAgLy8gYG1haW5gIGFuZCBgZW50cnlQb2ludHNgIGFyZSBtdXR1YWxseSBleGNsdXNpdmUuXG4gIGlmIChtYWluICYmIGVudHJ5UG9pbnRzLnNpemUgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdPbmx5IG9uZSBvZiBgbWFpbmAgb3IgYGVudHJ5UG9pbnRzYCBtYXkgYmUgcHJvdmlkZWQuJyk7XG4gIH1cbiAgaWYgKCFtYWluICYmIGVudHJ5UG9pbnRzLnNpemUgPT09IDApIHtcbiAgICAvLyBTY2hlbWEgc2hvdWxkIG5vcm1hbGx5IHJlamVjdCB0aGlzIGNhc2UsIGJ1dCBwcm9ncmFtbWF0aWMgdXNhZ2VzIG9mIHRoZSBidWlsZGVyIG1pZ2h0IG1ha2UgdGhpcyBtaXN0YWtlLlxuICAgIHRocm93IG5ldyBFcnJvcignRWl0aGVyIGBtYWluYCBvciBhdCBsZWFzdCBvbmUgYGVudHJ5UG9pbnRzYCB2YWx1ZSBtdXN0IGJlIHByb3ZpZGVkLicpO1xuICB9XG5cbiAgLy8gU2NoZW1hIHR5cGVzIGZvcmNlIGBtYWluYCB0byBhbHdheXMgYmUgcHJvdmlkZWQsIGJ1dCBpdCBtYXkgYmUgb21pdHRlZCB3aGVuIHRoZSBidWlsZGVyIGlzIGludm9rZWQgcHJvZ3JhbW1hdGljYWxseS5cbiAgaWYgKG1haW4pIHtcbiAgICAvLyBVc2UgYG1haW5gIGFsb25lLlxuICAgIHJldHVybiB7ICdtYWluJzogcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIG1haW4pIH07XG4gIH0gZWxzZSB7XG4gICAgLy8gVXNlIGBlbnRyeVBvaW50c2AgYWxvbmUuXG4gICAgY29uc3QgZW50cnlQb2ludFBhdGhzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgZm9yIChjb25zdCBlbnRyeVBvaW50IG9mIGVudHJ5UG9pbnRzKSB7XG4gICAgICBjb25zdCBwYXJzZWRFbnRyeVBvaW50ID0gcGF0aC5wYXJzZShlbnRyeVBvaW50KTtcblxuICAgICAgLy8gVXNlIHRoZSBpbnB1dCBmaWxlIHBhdGggd2l0aG91dCBhbiBleHRlbnNpb24gYXMgdGhlIFwibmFtZVwiIG9mIHRoZSBlbnRyeSBwb2ludCBkaWN0YXRpbmcgaXRzIG91dHB1dCBsb2NhdGlvbi5cbiAgICAgIC8vIFJlbGF0aXZlIGVudHJ5IHBvaW50cyBhcmUgZ2VuZXJhdGVkIGF0IHRoZSBzYW1lIHJlbGF0aXZlIHBhdGggaW4gdGhlIG91dHB1dCBkaXJlY3RvcnkuXG4gICAgICAvLyBBYnNvbHV0ZSBlbnRyeSBwb2ludHMgYXJlIGFsd2F5cyBnZW5lcmF0ZWQgd2l0aCB0aGUgc2FtZSBmaWxlIG5hbWUgaW4gdGhlIHJvb3Qgb2YgdGhlIG91dHB1dCBkaXJlY3RvcnkuIFRoaXMgaW5jbHVkZXMgYWJzb2x1dGVcbiAgICAgIC8vIHBhdGhzIHBvaW50aW5nIGF0IGZpbGVzIGFjdHVhbGx5IHdpdGhpbiB0aGUgd29ya3NwYWNlIHJvb3QuXG4gICAgICBjb25zdCBlbnRyeVBvaW50TmFtZSA9IHBhdGguaXNBYnNvbHV0ZShlbnRyeVBvaW50KVxuICAgICAgICA/IHBhcnNlZEVudHJ5UG9pbnQubmFtZVxuICAgICAgICA6IHBhdGguam9pbihwYXJzZWRFbnRyeVBvaW50LmRpciwgcGFyc2VkRW50cnlQb2ludC5uYW1lKTtcblxuICAgICAgLy8gR2V0IHRoZSBmdWxsIGZpbGUgcGF0aCB0byB0aGUgZW50cnkgcG9pbnQgaW5wdXQuXG4gICAgICBjb25zdCBlbnRyeVBvaW50UGF0aCA9IHBhdGguaXNBYnNvbHV0ZShlbnRyeVBvaW50KVxuICAgICAgICA/IGVudHJ5UG9pbnRcbiAgICAgICAgOiBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgZW50cnlQb2ludCk7XG5cbiAgICAgIC8vIENoZWNrIGZvciBjb25mbGljdHMgd2l0aCBwcmV2aW91cyBlbnRyeSBwb2ludHMuXG4gICAgICBjb25zdCBleGlzdGluZ0VudHJ5UG9pbnRQYXRoID0gZW50cnlQb2ludFBhdGhzW2VudHJ5UG9pbnROYW1lXTtcbiAgICAgIGlmIChleGlzdGluZ0VudHJ5UG9pbnRQYXRoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgXFxgJHtleGlzdGluZ0VudHJ5UG9pbnRQYXRofVxcYCBhbmQgXFxgJHtlbnRyeVBvaW50UGF0aH1cXGAgYm90aCBvdXRwdXQgdG8gdGhlIHNhbWUgbG9jYXRpb24gXFxgJHtlbnRyeVBvaW50TmFtZX1cXGAuYCArXG4gICAgICAgICAgICAnIFJlbmFtZSBvciBtb3ZlIG9uZSBvZiB0aGUgZmlsZXMgdG8gZml4IHRoZSBjb25mbGljdC4nLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBlbnRyeVBvaW50UGF0aHNbZW50cnlQb2ludE5hbWVdID0gZW50cnlQb2ludFBhdGg7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVudHJ5UG9pbnRQYXRocztcbiAgfVxufVxuXG4vKipcbiAqIE5vcm1hbGl6ZSBhIGRpcmVjdG9yeSBwYXRoIHN0cmluZy5cbiAqIEN1cnJlbnRseSBvbmx5IHJlbW92ZXMgYSB0cmFpbGluZyBzbGFzaCBpZiBwcmVzZW50LlxuICogQHBhcmFtIHBhdGggQSBwYXRoIHN0cmluZy5cbiAqIEByZXR1cm5zIEEgbm9ybWFsaXplZCBwYXRoIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplRGlyZWN0b3J5UGF0aChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBsYXN0ID0gcGF0aFtwYXRoLmxlbmd0aCAtIDFdO1xuICBpZiAobGFzdCA9PT0gJy8nIHx8IGxhc3QgPT09ICdcXFxcJykge1xuICAgIHJldHVybiBwYXRoLnNsaWNlKDAsIC0xKTtcbiAgfVxuXG4gIHJldHVybiBwYXRoO1xufVxuIl19