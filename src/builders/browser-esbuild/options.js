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
const utils_1 = require("../../utils");
const normalize_cache_1 = require("../../utils/normalize-cache");
const package_chunk_sort_1 = require("../../utils/package-chunk-sort");
const tailwind_1 = require("../../utils/tailwind");
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
    const projectRoot = normalizeDirectoryPath(node_path_1.default.join(workspaceRoot, projectMetadata.root ?? ''));
    const projectSourceRoot = normalizeDirectoryPath(node_path_1.default.join(workspaceRoot, projectMetadata.sourceRoot ?? 'src'));
    // Gather persistent caching option and provide a project specific cache location
    const cacheOptions = (0, normalize_cache_1.normalizeCacheOptions)(projectMetadata, workspaceRoot);
    cacheOptions.path = node_path_1.default.join(cacheOptions.path, projectName);
    const entryPoints = normalizeEntryPoints(workspaceRoot, options.main, options.entryPoints);
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
    let serviceWorkerOptions;
    if (options.serviceWorker) {
        // If ngswConfigPath is not specified, the default is 'ngsw-config.json' within the project root
        serviceWorkerOptions = options.ngswConfigPath
            ? node_path_1.default.join(workspaceRoot, options.ngswConfigPath)
            : node_path_1.default.join(projectRoot, 'ngsw-config.json');
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
    const { allowedCommonJsDependencies, aot, baseHref, buildOptimizer, crossOrigin, externalDependencies, extractLicenses, inlineStyleLanguage = 'css', outExtension, poll, polyfills, preserveSymlinks, statsJson, stylePreprocessorOptions, subresourceIntegrity, verbose, watch, progress, } = options;
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
        progress: progress ?? true,
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
        outExtension,
        sourcemapOptions,
        tsconfig,
        projectRoot,
        assets,
        outputNames,
        fileReplacements,
        globalStyles,
        globalScripts,
        serviceWorkerOptions,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9vcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDZDQUE0QztBQUM1QywwREFBNkI7QUFDN0IsdUNBQWlHO0FBQ2pHLGlFQUFvRTtBQUNwRSx1RUFBcUU7QUFDckUsbURBQXFFO0FBQ3JFLCtFQUEyRjtBQUMzRix5REFBK0Y7QUFDL0YscUNBQTBFO0FBd0IxRTs7Ozs7Ozs7O0dBU0c7QUFDSSxLQUFLLFVBQVUsZ0JBQWdCLENBQ3BDLE9BQXVCLEVBQ3ZCLFdBQW1CLEVBQ25CLE9BQThCO0lBRTlCLE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7SUFDNUMsTUFBTSxlQUFlLEdBQUcsTUFBTSxPQUFPLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDdEUsTUFBTSxXQUFXLEdBQUcsc0JBQXNCLENBQ3hDLG1CQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRyxlQUFlLENBQUMsSUFBMkIsSUFBSSxFQUFFLENBQUMsQ0FDN0UsQ0FBQztJQUNGLE1BQU0saUJBQWlCLEdBQUcsc0JBQXNCLENBQzlDLG1CQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRyxlQUFlLENBQUMsVUFBaUMsSUFBSSxLQUFLLENBQUMsQ0FDdEYsQ0FBQztJQUVGLGlGQUFpRjtJQUNqRixNQUFNLFlBQVksR0FBRyxJQUFBLHVDQUFxQixFQUFDLGVBQWUsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUMzRSxZQUFZLENBQUMsSUFBSSxHQUFHLG1CQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFFOUQsTUFBTSxXQUFXLEdB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LElBQUksSUFBSSxLQUFLLElBQUksRUFBRTtRQUNqQyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDMUI7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdub2RlOm1vZHVsZSc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgbm9ybWFsaXplQXNzZXRQYXR0ZXJucywgbm9ybWFsaXplT3B0aW1pemF0aW9uLCBub3JtYWxpemVTb3VyY2VNYXBzIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgbm9ybWFsaXplQ2FjaGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvbm9ybWFsaXplLWNhY2hlJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMgfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgZmluZFRhaWx3aW5kQ29uZmlndXJhdGlvbkZpbGUgfSBmcm9tICcuLi8uLi91dGlscy90YWlsd2luZCc7XG5pbXBvcnQgeyBnZXRJbmRleElucHV0RmlsZSwgZ2V0SW5kZXhPdXRwdXRGaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lLCBub3JtYWxpemVHbG9iYWxTdHlsZXMgfSBmcm9tICcuLi8uLi93ZWJwYWNrL3V0aWxzL2hlbHBlcnMnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEJyb3dzZXJCdWlsZGVyT3B0aW9ucywgT3V0cHV0SGFzaGluZyB9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IHR5cGUgTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zID0gQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBub3JtYWxpemVPcHRpb25zPj47XG5cbi8qKiBJbnRlcm5hbCBvcHRpb25zIGhpZGRlbiBmcm9tIGJ1aWxkZXIgc2NoZW1hIGJ1dCBhdmFpbGFibGUgd2hlbiBpbnZva2VkIHByb2dyYW1tYXRpY2FsbHkuICovXG5pbnRlcmZhY2UgSW50ZXJuYWxPcHRpb25zIHtcbiAgLyoqXG4gICAqIEVudHJ5IHBvaW50cyB0byB1c2UgZm9yIHRoZSBjb21waWxhdGlvbi4gSW5jb21wYXRpYmxlIHdpdGggYG1haW5gLCB3aGljaCBtdXN0IG5vdCBiZSBwcm92aWRlZC4gTWF5IGJlIHJlbGF0aXZlIG9yIGFic29sdXRlIHBhdGhzLlxuICAgKiBJZiBnaXZlbiBhIHJlbGF0aXZlIHBhdGgsIGl0IGlzIHJlc29sdmVkIHJlbGF0aXZlIHRvIHRoZSBjdXJyZW50IHdvcmtzcGFjZSBhbmQgd2lsbCBnZW5lcmF0ZSBhbiBvdXRwdXQgYXQgdGhlIHNhbWUgcmVsYXRpdmUgbG9jYXRpb25cbiAgICogaW4gdGhlIG91dHB1dCBkaXJlY3RvcnkuIElmIGdpdmVuIGFuIGFic29sdXRlIHBhdGgsIHRoZSBvdXRwdXQgd2lsbCBiZSBnZW5lcmF0ZWQgaW4gdGhlIHJvb3Qgb2YgdGhlIG91dHB1dCBkaXJlY3Rvcnkgd2l0aCB0aGUgc2FtZSBiYXNlXG4gICAqIG5hbWUuXG4gICAqL1xuICBlbnRyeVBvaW50cz86IFNldDxzdHJpbmc+O1xuXG4gIC8qKiBGaWxlIGV4dGVuc2lvbiB0byB1c2UgZm9yIHRoZSBnZW5lcmF0ZWQgb3V0cHV0IGZpbGVzLiAqL1xuICBvdXRFeHRlbnNpb24/OiAnanMnIHwgJ21qcyc7XG59XG5cbi8qKiBGdWxsIHNldCBvZiBvcHRpb25zIGZvciBgYnJvd3Nlci1lc2J1aWxkYCBidWlsZGVyLiAqL1xuZXhwb3J0IHR5cGUgQnJvd3NlckVzYnVpbGRPcHRpb25zID0gT21pdDxCcm93c2VyQnVpbGRlck9wdGlvbnMgJiBJbnRlcm5hbE9wdGlvbnMsICdtYWluJz4gJiB7XG4gIC8vIGBtYWluYCBjYW4gYmUgYHVuZGVmaW5lZGAgaWYgYGVudHJ5UG9pbnRzYCBpcyB1c2VkLlxuICBtYWluPzogc3RyaW5nO1xufTtcblxuLyoqXG4gKiBOb3JtYWxpemUgdGhlIHVzZXIgcHJvdmlkZWQgb3B0aW9ucyBieSBjcmVhdGluZyBmdWxsIHBhdGhzIGZvciBhbGwgcGF0aCBiYXNlZCBvcHRpb25zXG4gKiBhbmQgY29udmVydGluZyBtdWx0aS1mb3JtIG9wdGlvbnMgaW50byBhIHNpbmdsZSBmb3JtIHRoYXQgY2FuIGJlIGRpcmVjdGx5IHVzZWRcbiAqIGJ5IHRoZSBidWlsZCBwcm9jZXNzLlxuICpcbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBjb250ZXh0IGZvciBjdXJyZW50IGJ1aWxkZXIgZXhlY3V0aW9uLlxuICogQHBhcmFtIHByb2plY3ROYW1lIFRoZSBuYW1lIG9mIHRoZSBwcm9qZWN0IGZvciB0aGUgY3VycmVudCBleGVjdXRpb24uXG4gKiBAcGFyYW0gb3B0aW9ucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgb3B0aW9ucyB0byB1c2UgZm9yIHRoZSBidWlsZC5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBjb250YWluaW5nIG5vcm1hbGl6ZWQgb3B0aW9ucyByZXF1aXJlZCB0byBwZXJmb3JtIHRoZSBidWlsZC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG5vcm1hbGl6ZU9wdGlvbnMoXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICBvcHRpb25zOiBCcm93c2VyRXNidWlsZE9wdGlvbnMsXG4pIHtcbiAgY29uc3Qgd29ya3NwYWNlUm9vdCA9IGNvbnRleHQud29ya3NwYWNlUm9vdDtcbiAgY29uc3QgcHJvamVjdE1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICBjb25zdCBwcm9qZWN0Um9vdCA9IG5vcm1hbGl6ZURpcmVjdG9yeVBhdGgoXG4gICAgcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIChwcm9qZWN0TWV0YWRhdGEucm9vdCBhcyBzdHJpbmcgfCB1bmRlZmluZWQpID8/ICcnKSxcbiAgKTtcbiAgY29uc3QgcHJvamVjdFNvdXJjZVJvb3QgPSBub3JtYWxpemVEaXJlY3RvcnlQYXRoKFxuICAgIHBhdGguam9pbih3b3Jrc3BhY2VSb290LCAocHJvamVjdE1ldGFkYXRhLnNvdXJjZVJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnc3JjJyksXG4gICk7XG5cbiAgLy8gR2F0aGVyIHBlcnNpc3RlbnQgY2FjaGluZyBvcHRpb24gYW5kIHByb3ZpZGUgYSBwcm9qZWN0IHNwZWNpZmljIGNhY2hlIGxvY2F0aW9uXG4gIGNvbnN0IGNhY2hlT3B0aW9ucyA9IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyhwcm9qZWN0TWV0YWRhdGEsIHdvcmtzcGFjZVJvb3QpO1xuICBjYWNoZU9wdGlvbnMucGF0aCA9IHBhdGguam9pbihjYWNoZU9wdGlvbnMucGF0aCwgcHJvamVjdE5hbWUpO1xuXG4gIGNvbnN0IGVudHJ5UG9pbnRzID0gbm9ybWFsaXplRW50cnlQb2ludHMod29ya3NwYWNlUm9vdCwgb3B0aW9ucy5tYWluLCBvcHRpb25zLmVudHJ5UG9pbnRzKTtcbiAgY29uc3QgdHNjb25maWcgPSBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgb3B0aW9ucy50c0NvbmZpZyk7XG4gIGNvbnN0IG91dHB1dFBhdGggPSBub3JtYWxpemVEaXJlY3RvcnlQYXRoKHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLm91dHB1dFBhdGgpKTtcbiAgY29uc3Qgb3B0aW1pemF0aW9uT3B0aW9ucyA9IG5vcm1hbGl6ZU9wdGltaXphdGlvbihvcHRpb25zLm9wdGltaXphdGlvbik7XG4gIGNvbnN0IHNvdXJjZW1hcE9wdGlvbnMgPSBub3JtYWxpemVTb3VyY2VNYXBzKG9wdGlvbnMuc291cmNlTWFwID8/IGZhbHNlKTtcbiAgY29uc3QgYXNzZXRzID0gb3B0aW9ucy5hc3NldHM/Lmxlbmd0aFxuICAgID8gbm9ybWFsaXplQXNzZXRQYXR0ZXJucyhvcHRpb25zLmFzc2V0cywgd29ya3NwYWNlUm9vdCwgcHJvamVjdFJvb3QsIHByb2plY3RTb3VyY2VSb290KVxuICAgIDogdW5kZWZpbmVkO1xuXG4gIGNvbnN0IG91dHB1dE5hbWVzID0ge1xuICAgIGJ1bmRsZXM6XG4gICAgICBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuQWxsIHx8IG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5CdW5kbGVzXG4gICAgICAgID8gJ1tuYW1lXS5baGFzaF0nXG4gICAgICAgIDogJ1tuYW1lXScsXG4gICAgbWVkaWE6XG4gICAgICBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuQWxsIHx8IG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5NZWRpYVxuICAgICAgICA/ICdbbmFtZV0uW2hhc2hdJ1xuICAgICAgICA6ICdbbmFtZV0nLFxuICB9O1xuICBpZiAob3B0aW9ucy5yZXNvdXJjZXNPdXRwdXRQYXRoKSB7XG4gICAgb3V0cHV0TmFtZXMubWVkaWEgPSBwYXRoLmpvaW4ob3B0aW9ucy5yZXNvdXJjZXNPdXRwdXRQYXRoLCBvdXRwdXROYW1lcy5tZWRpYSk7XG4gIH1cblxuICBsZXQgZmlsZVJlcGxhY2VtZW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB8IHVuZGVmaW5lZDtcbiAgaWYgKG9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykge1xuICAgIGZvciAoY29uc3QgcmVwbGFjZW1lbnQgb2Ygb3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgICBmaWxlUmVwbGFjZW1lbnRzID8/PSB7fTtcbiAgICAgIGZpbGVSZXBsYWNlbWVudHNbcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIHJlcGxhY2VtZW50LnJlcGxhY2UpXSA9IHBhdGguam9pbihcbiAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgcmVwbGFjZW1lbnQud2l0aCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZ2xvYmFsU3R5bGVzOiB7IG5hbWU6IHN0cmluZzsgZmlsZXM6IHN0cmluZ1tdOyBpbml0aWFsOiBib29sZWFuIH1bXSA9IFtdO1xuICBpZiAob3B0aW9ucy5zdHlsZXM/Lmxlbmd0aCkge1xuICAgIGNvbnN0IHsgZW50cnlQb2ludHM6IHN0eWxlc2hlZXRFbnRyeXBvaW50cywgbm9JbmplY3ROYW1lcyB9ID0gbm9ybWFsaXplR2xvYmFsU3R5bGVzKFxuICAgICAgb3B0aW9ucy5zdHlsZXMgfHwgW10sXG4gICAgKTtcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBmaWxlc10gb2YgT2JqZWN0LmVudHJpZXMoc3R5bGVzaGVldEVudHJ5cG9pbnRzKSkge1xuICAgICAgZ2xvYmFsU3R5bGVzLnB1c2goeyBuYW1lLCBmaWxlcywgaW5pdGlhbDogIW5vSW5qZWN0TmFtZXMuaW5jbHVkZXMobmFtZSkgfSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZ2xvYmFsU2NyaXB0czogeyBuYW1lOiBzdHJpbmc7IGZpbGVzOiBzdHJpbmdbXTsgaW5pdGlhbDogYm9vbGVhbiB9W10gPSBbXTtcbiAgaWYgKG9wdGlvbnMuc2NyaXB0cz8ubGVuZ3RoKSB7XG4gICAgZm9yIChjb25zdCB7IGJ1bmRsZU5hbWUsIHBhdGhzLCBpbmplY3QgfSBvZiBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lKG9wdGlvbnMuc2NyaXB0cykpIHtcbiAgICAgIGdsb2JhbFNjcmlwdHMucHVzaCh7IG5hbWU6IGJ1bmRsZU5hbWUsIGZpbGVzOiBwYXRocywgaW5pdGlhbDogaW5qZWN0IH0pO1xuICAgIH1cbiAgfVxuXG4gIGxldCB0YWlsd2luZENvbmZpZ3VyYXRpb246IHsgZmlsZTogc3RyaW5nOyBwYWNrYWdlOiBzdHJpbmcgfSB8IHVuZGVmaW5lZDtcbiAgY29uc3QgdGFpbHdpbmRDb25maWd1cmF0aW9uUGF0aCA9IGF3YWl0IGZpbmRUYWlsd2luZENvbmZpZ3VyYXRpb25GaWxlKHdvcmtzcGFjZVJvb3QsIHByb2plY3RSb290KTtcbiAgaWYgKHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgpIHtcbiAgICAvLyBDcmVhdGUgYSBub2RlIHJlc29sdmVyIGF0IHRoZSBwcm9qZWN0IHJvb3QgYXMgYSBkaXJlY3RvcnlcbiAgICBjb25zdCByZXNvbHZlciA9IGNyZWF0ZVJlcXVpcmUocHJvamVjdFJvb3QgKyAnLycpO1xuICAgIHRyeSB7XG4gICAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24gPSB7XG4gICAgICAgIGZpbGU6IHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgsXG4gICAgICAgIHBhY2thZ2U6IHJlc29sdmVyLnJlc29sdmUoJ3RhaWx3aW5kY3NzJyksXG4gICAgICB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29uc3QgcmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGggPSBwYXRoLnJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgpO1xuICAgICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgYFRhaWx3aW5kIENTUyBjb25maWd1cmF0aW9uIGZpbGUgZm91bmQgKCR7cmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGh9KWAgK1xuICAgICAgICAgIGAgYnV0IHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UgaXMgbm90IGluc3RhbGxlZC5gICtcbiAgICAgICAgICBgIFRvIGVuYWJsZSBUYWlsd2luZCBDU1MsIHBsZWFzZSBpbnN0YWxsIHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UuYCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHNlcnZpY2VXb3JrZXJPcHRpb25zO1xuICBpZiAob3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgLy8gSWYgbmdzd0NvbmZpZ1BhdGggaXMgbm90IHNwZWNpZmllZCwgdGhlIGRlZmF1bHQgaXMgJ25nc3ctY29uZmlnLmpzb24nIHdpdGhpbiB0aGUgcHJvamVjdCByb290XG4gICAgc2VydmljZVdvcmtlck9wdGlvbnMgPSBvcHRpb25zLm5nc3dDb25maWdQYXRoXG4gICAgICA/IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLm5nc3dDb25maWdQYXRoKVxuICAgICAgOiBwYXRoLmpvaW4ocHJvamVjdFJvb3QsICduZ3N3LWNvbmZpZy5qc29uJyk7XG4gIH1cblxuICBsZXQgaW5kZXhIdG1sT3B0aW9ucztcbiAgaWYgKG9wdGlvbnMuaW5kZXgpIHtcbiAgICBpbmRleEh0bWxPcHRpb25zID0ge1xuICAgICAgaW5wdXQ6IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBnZXRJbmRleElucHV0RmlsZShvcHRpb25zLmluZGV4KSksXG4gICAgICAvLyBUaGUgb3V0cHV0IGZpbGUgd2lsbCBiZSBjcmVhdGVkIHdpdGhpbiB0aGUgY29uZmlndXJlZCBvdXRwdXQgcGF0aFxuICAgICAgb3V0cHV0OiBnZXRJbmRleE91dHB1dEZpbGUob3B0aW9ucy5pbmRleCksXG4gICAgICAvLyBUT0RPOiBVc2UgZXhpc3RpbmcgaW5mb3JtYXRpb24gZnJvbSBhYm92ZSB0byBjcmVhdGUgdGhlIGluc2VydGlvbiBvcmRlclxuICAgICAgaW5zZXJ0aW9uT3JkZXI6IGdlbmVyYXRlRW50cnlQb2ludHMoe1xuICAgICAgICBzY3JpcHRzOiBvcHRpb25zLnNjcmlwdHMgPz8gW10sXG4gICAgICAgIHN0eWxlczogb3B0aW9ucy5zdHlsZXMgPz8gW10sXG4gICAgICB9KSxcbiAgICB9O1xuICB9XG5cbiAgLy8gSW5pdGlhbCBvcHRpb25zIHRvIGtlZXBcbiAgY29uc3Qge1xuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICBhb3QsXG4gICAgYmFzZUhyZWYsXG4gICAgYnVpbGRPcHRpbWl6ZXIsXG4gICAgY3Jvc3NPcmlnaW4sXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgZXh0cmFjdExpY2Vuc2VzLFxuICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UgPSAnY3NzJyxcbiAgICBvdXRFeHRlbnNpb24sXG4gICAgcG9sbCxcbiAgICBwb2x5ZmlsbHMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBzdGF0c0pzb24sXG4gICAgc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIHZlcmJvc2UsXG4gICAgd2F0Y2gsXG4gICAgcHJvZ3Jlc3MsXG4gIH0gPSBvcHRpb25zO1xuXG4gIC8vIFJldHVybiBhbGwgdGhlIG5vcm1hbGl6ZWQgb3B0aW9uc1xuICByZXR1cm4ge1xuICAgIGFkdmFuY2VkT3B0aW1pemF0aW9uczogYnVpbGRPcHRpbWl6ZXIsXG4gICAgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgIGJhc2VIcmVmLFxuICAgIGNhY2hlT3B0aW9ucyxcbiAgICBjcm9zc09yaWdpbixcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBleHRyYWN0TGljZW5zZXMsXG4gICAgaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICBqaXQ6ICFhb3QsXG4gICAgc3RhdHM6ICEhc3RhdHNKc29uLFxuICAgIHBvbHlmaWxsczogcG9seWZpbGxzID09PSB1bmRlZmluZWQgfHwgQXJyYXkuaXNBcnJheShwb2x5ZmlsbHMpID8gcG9seWZpbGxzIDogW3BvbHlmaWxsc10sXG4gICAgcG9sbCxcbiAgICBwcm9ncmVzczogcHJvZ3Jlc3MgPz8gdHJ1ZSxcbiAgICAvLyBJZiBub3QgZXhwbGljaXRseSBzZXQsIGRlZmF1bHQgdG8gdGhlIE5vZGUuanMgcHJvY2VzcyBhcmd1bWVudFxuICAgIHByZXNlcnZlU3ltbGlua3M6IHByZXNlcnZlU3ltbGlua3MgPz8gcHJvY2Vzcy5leGVjQXJndi5pbmNsdWRlcygnLS1wcmVzZXJ2ZS1zeW1saW5rcycpLFxuICAgIHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucyxcbiAgICBzdWJyZXNvdXJjZUludGVncml0eSxcbiAgICB2ZXJib3NlLFxuICAgIHdhdGNoLFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgZW50cnlQb2ludHMsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBvdXRwdXRQYXRoLFxuICAgIG91dEV4dGVuc2lvbixcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICAgIHByb2plY3RSb290LFxuICAgIGFzc2V0cyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgIGdsb2JhbFN0eWxlcyxcbiAgICBnbG9iYWxTY3JpcHRzLFxuICAgIHNlcnZpY2VXb3JrZXJPcHRpb25zLFxuICAgIGluZGV4SHRtbE9wdGlvbnMsXG4gICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICB9O1xufVxuXG4vKipcbiAqIE5vcm1hbGl6ZSBlbnRyeSBwb2ludCBvcHRpb25zLiBUbyBtYWludGFpbiBjb21wYXRpYmlsaXR5IHdpdGggdGhlIGxlZ2FjeSBicm93c2VyIGJ1aWxkZXIsIHdlIG5lZWQgYSBzaW5nbGUgYG1haW5gIG9wdGlvbiB3aGljaCBkZWZpbmVzIGFcbiAqIHNpbmdsZSBlbnRyeSBwb2ludC4gSG93ZXZlciwgd2UgYWxzbyB3YW50IHRvIHN1cHBvcnQgbXVsdGlwbGUgZW50cnkgcG9pbnRzIGFzIGFuIGludGVybmFsIG9wdGlvbi4gVGhlIHR3byBvcHRpb25zIGFyZSBtdXR1YWxseSBleGNsdXNpdmVcbiAqIGFuZCBpZiBgbWFpbmAgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkIGFzIHRoZSBzb2xlIGVudHJ5IHBvaW50LiBJZiBgZW50cnlQb2ludHNgIGFyZSBwcm92aWRlZCwgdGhleSB3aWxsIGJlIHVzZWQgYXMgdGhlIHNldCBvZiBlbnRyeVxuICogcG9pbnRzLlxuICpcbiAqIEBwYXJhbSB3b3Jrc3BhY2VSb290IFBhdGggdG8gdGhlIHJvb3Qgb2YgdGhlIEFuZ3VsYXIgd29ya3NwYWNlLlxuICogQHBhcmFtIG1haW4gVGhlIGBtYWluYCBvcHRpb24gcG9pbnRpbmcgYXQgdGhlIGFwcGxpY2F0aW9uIGVudHJ5IHBvaW50LiBXaGlsZSByZXF1aXJlZCBwZXIgdGhlIHNjaGVtYSBmaWxlLCBpdCBtYXkgYmUgb21pdHRlZCBieVxuICogICAgIHByb2dyYW1tYXRpYyB1c2FnZXMgb2YgYGJyb3dzZXItZXNidWlsZGAuXG4gKiBAcGFyYW0gZW50cnlQb2ludHMgU2V0IG9mIGVudHJ5IHBvaW50cyB0byB1c2UgaWYgcHJvdmlkZWQuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgbWFwcGluZyBlbnRyeSBwb2ludCBuYW1lcyB0byB0aGVpciBmaWxlIHBhdGhzLlxuICovXG5mdW5jdGlvbiBub3JtYWxpemVFbnRyeVBvaW50cyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBtYWluOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gIGVudHJ5UG9pbnRzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKSxcbik6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4ge1xuICBpZiAobWFpbiA9PT0gJycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2BtYWluYCBvcHRpb24gY2Fubm90IGJlIGFuIGVtcHR5IHN0cmluZy4nKTtcbiAgfVxuXG4gIC8vIGBtYWluYCBhbmQgYGVudHJ5UG9pbnRzYCBhcmUgbXV0dWFsbHkgZXhjbHVzaXZlLlxuICBpZiAobWFpbiAmJiBlbnRyeVBvaW50cy5zaXplID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignT25seSBvbmUgb2YgYG1haW5gIG9yIGBlbnRyeVBvaW50c2AgbWF5IGJlIHByb3ZpZGVkLicpO1xuICB9XG4gIGlmICghbWFpbiAmJiBlbnRyeVBvaW50cy5zaXplID09PSAwKSB7XG4gICAgLy8gU2NoZW1hIHNob3VsZCBub3JtYWxseSByZWplY3QgdGhpcyBjYXNlLCBidXQgcHJvZ3JhbW1hdGljIHVzYWdlcyBvZiB0aGUgYnVpbGRlciBtaWdodCBtYWtlIHRoaXMgbWlzdGFrZS5cbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0VpdGhlciBgbWFpbmAgb3IgYXQgbGVhc3Qgb25lIGBlbnRyeVBvaW50c2AgdmFsdWUgbXVzdCBiZSBwcm92aWRlZC4nKTtcbiAgfVxuXG4gIC8vIFNjaGVtYSB0eXBlcyBmb3JjZSBgbWFpbmAgdG8gYWx3YXlzIGJlIHByb3ZpZGVkLCBidXQgaXQgbWF5IGJlIG9taXR0ZWQgd2hlbiB0aGUgYnVpbGRlciBpcyBpbnZva2VkIHByb2dyYW1tYXRpY2FsbHkuXG4gIGlmIChtYWluKSB7XG4gICAgLy8gVXNlIGBtYWluYCBhbG9uZS5cbiAgICByZXR1cm4geyAnbWFpbic6IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBtYWluKSB9O1xuICB9IGVsc2Uge1xuICAgIC8vIFVzZSBgZW50cnlQb2ludHNgIGFsb25lLlxuICAgIGNvbnN0IGVudHJ5UG9pbnRQYXRoczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICAgIGZvciAoY29uc3QgZW50cnlQb2ludCBvZiBlbnRyeVBvaW50cykge1xuICAgICAgY29uc3QgcGFyc2VkRW50cnlQb2ludCA9IHBhdGgucGFyc2UoZW50cnlQb2ludCk7XG5cbiAgICAgIC8vIFVzZSB0aGUgaW5wdXQgZmlsZSBwYXRoIHdpdGhvdXQgYW4gZXh0ZW5zaW9uIGFzIHRoZSBcIm5hbWVcIiBvZiB0aGUgZW50cnkgcG9pbnQgZGljdGF0aW5nIGl0cyBvdXRwdXQgbG9jYXRpb24uXG4gICAgICAvLyBSZWxhdGl2ZSBlbnRyeSBwb2ludHMgYXJlIGdlbmVyYXRlZCBhdCB0aGUgc2FtZSByZWxhdGl2ZSBwYXRoIGluIHRoZSBvdXRwdXQgZGlyZWN0b3J5LlxuICAgICAgLy8gQWJzb2x1dGUgZW50cnkgcG9pbnRzIGFyZSBhbHdheXMgZ2VuZXJhdGVkIHdpdGggdGhlIHNhbWUgZmlsZSBuYW1lIGluIHRoZSByb290IG9mIHRoZSBvdXRwdXQgZGlyZWN0b3J5LiBUaGlzIGluY2x1ZGVzIGFic29sdXRlXG4gICAgICAvLyBwYXRocyBwb2ludGluZyBhdCBmaWxlcyBhY3R1YWxseSB3aXRoaW4gdGhlIHdvcmtzcGFjZSByb290LlxuICAgICAgY29uc3QgZW50cnlQb2ludE5hbWUgPSBwYXRoLmlzQWJzb2x1dGUoZW50cnlQb2ludClcbiAgICAgICAgPyBwYXJzZWRFbnRyeVBvaW50Lm5hbWVcbiAgICAgICAgOiBwYXRoLmpvaW4ocGFyc2VkRW50cnlQb2ludC5kaXIsIHBhcnNlZEVudHJ5UG9pbnQubmFtZSk7XG5cbiAgICAgIC8vIEdldCB0aGUgZnVsbCBmaWxlIHBhdGggdG8gdGhlIGVudHJ5IHBvaW50IGlucHV0LlxuICAgICAgY29uc3QgZW50cnlQb2ludFBhdGggPSBwYXRoLmlzQWJzb2x1dGUoZW50cnlQb2ludClcbiAgICAgICAgPyBlbnRyeVBvaW50XG4gICAgICAgIDogcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGVudHJ5UG9pbnQpO1xuXG4gICAgICAvLyBDaGVjayBmb3IgY29uZmxpY3RzIHdpdGggcHJldmlvdXMgZW50cnkgcG9pbnRzLlxuICAgICAgY29uc3QgZXhpc3RpbmdFbnRyeVBvaW50UGF0aCA9IGVudHJ5UG9pbnRQYXRoc1tlbnRyeVBvaW50TmFtZV07XG4gICAgICBpZiAoZXhpc3RpbmdFbnRyeVBvaW50UGF0aCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYFxcYCR7ZXhpc3RpbmdFbnRyeVBvaW50UGF0aH1cXGAgYW5kIFxcYCR7ZW50cnlQb2ludFBhdGh9XFxgIGJvdGggb3V0cHV0IHRvIHRoZSBzYW1lIGxvY2F0aW9uIFxcYCR7ZW50cnlQb2ludE5hbWV9XFxgLmAgK1xuICAgICAgICAgICAgJyBSZW5hbWUgb3IgbW92ZSBvbmUgb2YgdGhlIGZpbGVzIHRvIGZpeCB0aGUgY29uZmxpY3QuJyxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgZW50cnlQb2ludFBhdGhzW2VudHJ5UG9pbnROYW1lXSA9IGVudHJ5UG9pbnRQYXRoO1xuICAgIH1cblxuICAgIHJldHVybiBlbnRyeVBvaW50UGF0aHM7XG4gIH1cbn1cblxuLyoqXG4gKiBOb3JtYWxpemUgYSBkaXJlY3RvcnkgcGF0aCBzdHJpbmcuXG4gKiBDdXJyZW50bHkgb25seSByZW1vdmVzIGEgdHJhaWxpbmcgc2xhc2ggaWYgcHJlc2VudC5cbiAqIEBwYXJhbSBwYXRoIEEgcGF0aCBzdHJpbmcuXG4gKiBAcmV0dXJucyBBIG5vcm1hbGl6ZWQgcGF0aCBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZURpcmVjdG9yeVBhdGgocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgbGFzdCA9IHBhdGhbcGF0aC5sZW5ndGggLSAxXTtcbiAgaWYgKGxhc3QgPT09ICcvJyB8fCBsYXN0ID09PSAnXFxcXCcpIHtcbiAgICByZXR1cm4gcGF0aC5zbGljZSgwLCAtMSk7XG4gIH1cblxuICByZXR1cm4gcGF0aDtcbn1cbiJdfQ==