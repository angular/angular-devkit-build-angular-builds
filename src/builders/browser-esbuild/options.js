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
    const { allowedCommonJsDependencies, aot, baseHref, buildOptimizer, crossOrigin, externalDependencies, extractLicenses, inlineStyleLanguage = 'css', outExtension, poll, polyfills, preserveSymlinks, statsJson, stylePreprocessorOptions, subresourceIntegrity, verbose, watch, progress, externalPackages, } = options;
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
        externalPackages,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9vcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDZDQUE0QztBQUM1QywwREFBNkI7QUFDN0IsK0RBRzJDO0FBQzNDLHVDQUFpRztBQUNqRyxpRUFBb0U7QUFDcEUsdUVBQXFFO0FBQ3JFLG1EQUFxRTtBQUNyRSwrRUFBMkY7QUFDM0YscUNBQTBFO0FBOEIxRTs7Ozs7Ozs7O0dBU0c7QUFDSSxLQUFLLFVBQVUsZ0JBQWdCLENBQ3BDLE9BQXVCLEVBQ3ZCLFdBQW1CLEVBQ25CLE9BQThCO0lBRTlCLE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7SUFDNUMsTUFBTSxlQUFlLEdBQUcsTUFBTSxPQUFPLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDdEUsTUFBTSxXQUFXLEdBQUcsc0JBQXNCLENBQ3hDLG1CQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRyxlQUFlLENBQUMsSUFBMkIsSUFBSSxFQUFFLENBQUMsQ0FDN0UsQ0FBQztJQUNGLE1BQU0saUJBQWlCLEdBQUcsc0JBQXNCLENBQzlDLG1CQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRyxlQUFlLENBQUMsVUFBaUMsSUFBSSxLQUFLLENBQUMsQ0FDdEYsQ0FBQztJQUVGLGlGQUFpRjtJQUNqRixNQUFNLFlBQVksR0FBRyxJQUFBLHVDQUFxQixFQUFDLGVBQWUsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUMzRSxZQUFZLENBQUMsSUFBSSxHQUFHLG1CQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFFOUQsTUFBTSxXQUFXLEdB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O0lBQ25DLElBQUksSUFBSSxLQUFLLEdBQUcsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFO1FBQ2pDLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUMxQjtJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQge1xuICBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lLFxuICBub3JtYWxpemVHbG9iYWxTdHlsZXMsXG59IGZyb20gJy4uLy4uL3Rvb2xzL3dlYnBhY2svdXRpbHMvaGVscGVycyc7XG5pbXBvcnQgeyBub3JtYWxpemVBc3NldFBhdHRlcm5zLCBub3JtYWxpemVPcHRpbWl6YXRpb24sIG5vcm1hbGl6ZVNvdXJjZU1hcHMgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBub3JtYWxpemVDYWNoZU9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9ub3JtYWxpemUtY2FjaGUnO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cyB9IGZyb20gJy4uLy4uL3V0aWxzL3BhY2thZ2UtY2h1bmstc29ydCc7XG5pbXBvcnQgeyBmaW5kVGFpbHdpbmRDb25maWd1cmF0aW9uRmlsZSB9IGZyb20gJy4uLy4uL3V0aWxzL3RhaWx3aW5kJztcbmltcG9ydCB7IGdldEluZGV4SW5wdXRGaWxlLCBnZXRJbmRleE91dHB1dEZpbGUgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMsIE91dHB1dEhhc2hpbmcgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmV4cG9ydCB0eXBlIE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyA9IEF3YWl0ZWQ8UmV0dXJuVHlwZTx0eXBlb2Ygbm9ybWFsaXplT3B0aW9ucz4+O1xuXG4vKiogSW50ZXJuYWwgb3B0aW9ucyBoaWRkZW4gZnJvbSBidWlsZGVyIHNjaGVtYSBidXQgYXZhaWxhYmxlIHdoZW4gaW52b2tlZCBwcm9ncmFtbWF0aWNhbGx5LiAqL1xuaW50ZXJmYWNlIEludGVybmFsT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBFbnRyeSBwb2ludHMgdG8gdXNlIGZvciB0aGUgY29tcGlsYXRpb24uIEluY29tcGF0aWJsZSB3aXRoIGBtYWluYCwgd2hpY2ggbXVzdCBub3QgYmUgcHJvdmlkZWQuIE1heSBiZSByZWxhdGl2ZSBvciBhYnNvbHV0ZSBwYXRocy5cbiAgICogSWYgZ2l2ZW4gYSByZWxhdGl2ZSBwYXRoLCBpdCBpcyByZXNvbHZlZCByZWxhdGl2ZSB0byB0aGUgY3VycmVudCB3b3Jrc3BhY2UgYW5kIHdpbGwgZ2VuZXJhdGUgYW4gb3V0cHV0IGF0IHRoZSBzYW1lIHJlbGF0aXZlIGxvY2F0aW9uXG4gICAqIGluIHRoZSBvdXRwdXQgZGlyZWN0b3J5LiBJZiBnaXZlbiBhbiBhYnNvbHV0ZSBwYXRoLCB0aGUgb3V0cHV0IHdpbGwgYmUgZ2VuZXJhdGVkIGluIHRoZSByb290IG9mIHRoZSBvdXRwdXQgZGlyZWN0b3J5IHdpdGggdGhlIHNhbWUgYmFzZVxuICAgKiBuYW1lLlxuICAgKi9cbiAgZW50cnlQb2ludHM/OiBTZXQ8c3RyaW5nPjtcblxuICAvKiogRmlsZSBleHRlbnNpb24gdG8gdXNlIGZvciB0aGUgZ2VuZXJhdGVkIG91dHB1dCBmaWxlcy4gKi9cbiAgb3V0RXh0ZW5zaW9uPzogJ2pzJyB8ICdtanMnO1xuXG4gIC8qKlxuICAgKiBJbmRpY2F0ZXMgd2hldGhlciBhbGwgbm9kZSBwYWNrYWdlcyBzaG91bGQgYmUgbWFya2VkIGFzIGV4dGVybmFsLlxuICAgKiBDdXJyZW50bHkgdXNlZCBieSB0aGUgZGV2LXNlcnZlciB0byBzdXBwb3J0IHByZWJ1bmRsaW5nLlxuICAgKi9cbiAgZXh0ZXJuYWxQYWNrYWdlcz86IGJvb2xlYW47XG59XG5cbi8qKiBGdWxsIHNldCBvZiBvcHRpb25zIGZvciBgYnJvd3Nlci1lc2J1aWxkYCBidWlsZGVyLiAqL1xuZXhwb3J0IHR5cGUgQnJvd3NlckVzYnVpbGRPcHRpb25zID0gT21pdDxCcm93c2VyQnVpbGRlck9wdGlvbnMgJiBJbnRlcm5hbE9wdGlvbnMsICdtYWluJz4gJiB7XG4gIC8vIGBtYWluYCBjYW4gYmUgYHVuZGVmaW5lZGAgaWYgYGVudHJ5UG9pbnRzYCBpcyB1c2VkLlxuICBtYWluPzogc3RyaW5nO1xufTtcblxuLyoqXG4gKiBOb3JtYWxpemUgdGhlIHVzZXIgcHJvdmlkZWQgb3B0aW9ucyBieSBjcmVhdGluZyBmdWxsIHBhdGhzIGZvciBhbGwgcGF0aCBiYXNlZCBvcHRpb25zXG4gKiBhbmQgY29udmVydGluZyBtdWx0aS1mb3JtIG9wdGlvbnMgaW50byBhIHNpbmdsZSBmb3JtIHRoYXQgY2FuIGJlIGRpcmVjdGx5IHVzZWRcbiAqIGJ5IHRoZSBidWlsZCBwcm9jZXNzLlxuICpcbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBjb250ZXh0IGZvciBjdXJyZW50IGJ1aWxkZXIgZXhlY3V0aW9uLlxuICogQHBhcmFtIHByb2plY3ROYW1lIFRoZSBuYW1lIG9mIHRoZSBwcm9qZWN0IGZvciB0aGUgY3VycmVudCBleGVjdXRpb24uXG4gKiBAcGFyYW0gb3B0aW9ucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgb3B0aW9ucyB0byB1c2UgZm9yIHRoZSBidWlsZC5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBjb250YWluaW5nIG5vcm1hbGl6ZWQgb3B0aW9ucyByZXF1aXJlZCB0byBwZXJmb3JtIHRoZSBidWlsZC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG5vcm1hbGl6ZU9wdGlvbnMoXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICBvcHRpb25zOiBCcm93c2VyRXNidWlsZE9wdGlvbnMsXG4pIHtcbiAgY29uc3Qgd29ya3NwYWNlUm9vdCA9IGNvbnRleHQud29ya3NwYWNlUm9vdDtcbiAgY29uc3QgcHJvamVjdE1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICBjb25zdCBwcm9qZWN0Um9vdCA9IG5vcm1hbGl6ZURpcmVjdG9yeVBhdGgoXG4gICAgcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIChwcm9qZWN0TWV0YWRhdGEucm9vdCBhcyBzdHJpbmcgfCB1bmRlZmluZWQpID8/ICcnKSxcbiAgKTtcbiAgY29uc3QgcHJvamVjdFNvdXJjZVJvb3QgPSBub3JtYWxpemVEaXJlY3RvcnlQYXRoKFxuICAgIHBhdGguam9pbih3b3Jrc3BhY2VSb290LCAocHJvamVjdE1ldGFkYXRhLnNvdXJjZVJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnc3JjJyksXG4gICk7XG5cbiAgLy8gR2F0aGVyIHBlcnNpc3RlbnQgY2FjaGluZyBvcHRpb24gYW5kIHByb3ZpZGUgYSBwcm9qZWN0IHNwZWNpZmljIGNhY2hlIGxvY2F0aW9uXG4gIGNvbnN0IGNhY2hlT3B0aW9ucyA9IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyhwcm9qZWN0TWV0YWRhdGEsIHdvcmtzcGFjZVJvb3QpO1xuICBjYWNoZU9wdGlvbnMucGF0aCA9IHBhdGguam9pbihjYWNoZU9wdGlvbnMucGF0aCwgcHJvamVjdE5hbWUpO1xuXG4gIGNvbnN0IGVudHJ5UG9pbnRzID0gbm9ybWFsaXplRW50cnlQb2ludHMod29ya3NwYWNlUm9vdCwgb3B0aW9ucy5tYWluLCBvcHRpb25zLmVudHJ5UG9pbnRzKTtcbiAgY29uc3QgdHNjb25maWcgPSBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgb3B0aW9ucy50c0NvbmZpZyk7XG4gIGNvbnN0IG91dHB1dFBhdGggPSBub3JtYWxpemVEaXJlY3RvcnlQYXRoKHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLm91dHB1dFBhdGgpKTtcbiAgY29uc3Qgb3B0aW1pemF0aW9uT3B0aW9ucyA9IG5vcm1hbGl6ZU9wdGltaXphdGlvbihvcHRpb25zLm9wdGltaXphdGlvbik7XG4gIGNvbnN0IHNvdXJjZW1hcE9wdGlvbnMgPSBub3JtYWxpemVTb3VyY2VNYXBzKG9wdGlvbnMuc291cmNlTWFwID8/IGZhbHNlKTtcbiAgY29uc3QgYXNzZXRzID0gb3B0aW9ucy5hc3NldHM/Lmxlbmd0aFxuICAgID8gbm9ybWFsaXplQXNzZXRQYXR0ZXJucyhvcHRpb25zLmFzc2V0cywgd29ya3NwYWNlUm9vdCwgcHJvamVjdFJvb3QsIHByb2plY3RTb3VyY2VSb290KVxuICAgIDogdW5kZWZpbmVkO1xuXG4gIGNvbnN0IG91dHB1dE5hbWVzID0ge1xuICAgIGJ1bmRsZXM6XG4gICAgICBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuQWxsIHx8IG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5CdW5kbGVzXG4gICAgICAgID8gJ1tuYW1lXS5baGFzaF0nXG4gICAgICAgIDogJ1tuYW1lXScsXG4gICAgbWVkaWE6XG4gICAgICBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuQWxsIHx8IG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5NZWRpYVxuICAgICAgICA/ICdbbmFtZV0uW2hhc2hdJ1xuICAgICAgICA6ICdbbmFtZV0nLFxuICB9O1xuICBpZiAob3B0aW9ucy5yZXNvdXJjZXNPdXRwdXRQYXRoKSB7XG4gICAgb3V0cHV0TmFtZXMubWVkaWEgPSBwYXRoLmpvaW4ob3B0aW9ucy5yZXNvdXJjZXNPdXRwdXRQYXRoLCBvdXRwdXROYW1lcy5tZWRpYSk7XG4gIH1cblxuICBsZXQgZmlsZVJlcGxhY2VtZW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB8IHVuZGVmaW5lZDtcbiAgaWYgKG9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykge1xuICAgIGZvciAoY29uc3QgcmVwbGFjZW1lbnQgb2Ygb3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgICBmaWxlUmVwbGFjZW1lbnRzID8/PSB7fTtcbiAgICAgIGZpbGVSZXBsYWNlbWVudHNbcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIHJlcGxhY2VtZW50LnJlcGxhY2UpXSA9IHBhdGguam9pbihcbiAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgcmVwbGFjZW1lbnQud2l0aCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZ2xvYmFsU3R5bGVzOiB7IG5hbWU6IHN0cmluZzsgZmlsZXM6IHN0cmluZ1tdOyBpbml0aWFsOiBib29sZWFuIH1bXSA9IFtdO1xuICBpZiAob3B0aW9ucy5zdHlsZXM/Lmxlbmd0aCkge1xuICAgIGNvbnN0IHsgZW50cnlQb2ludHM6IHN0eWxlc2hlZXRFbnRyeXBvaW50cywgbm9JbmplY3ROYW1lcyB9ID0gbm9ybWFsaXplR2xvYmFsU3R5bGVzKFxuICAgICAgb3B0aW9ucy5zdHlsZXMgfHwgW10sXG4gICAgKTtcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBmaWxlc10gb2YgT2JqZWN0LmVudHJpZXMoc3R5bGVzaGVldEVudHJ5cG9pbnRzKSkge1xuICAgICAgZ2xvYmFsU3R5bGVzLnB1c2goeyBuYW1lLCBmaWxlcywgaW5pdGlhbDogIW5vSW5qZWN0TmFtZXMuaW5jbHVkZXMobmFtZSkgfSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZ2xvYmFsU2NyaXB0czogeyBuYW1lOiBzdHJpbmc7IGZpbGVzOiBzdHJpbmdbXTsgaW5pdGlhbDogYm9vbGVhbiB9W10gPSBbXTtcbiAgaWYgKG9wdGlvbnMuc2NyaXB0cz8ubGVuZ3RoKSB7XG4gICAgZm9yIChjb25zdCB7IGJ1bmRsZU5hbWUsIHBhdGhzLCBpbmplY3QgfSBvZiBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lKG9wdGlvbnMuc2NyaXB0cykpIHtcbiAgICAgIGdsb2JhbFNjcmlwdHMucHVzaCh7IG5hbWU6IGJ1bmRsZU5hbWUsIGZpbGVzOiBwYXRocywgaW5pdGlhbDogaW5qZWN0IH0pO1xuICAgIH1cbiAgfVxuXG4gIGxldCB0YWlsd2luZENvbmZpZ3VyYXRpb246IHsgZmlsZTogc3RyaW5nOyBwYWNrYWdlOiBzdHJpbmcgfSB8IHVuZGVmaW5lZDtcbiAgY29uc3QgdGFpbHdpbmRDb25maWd1cmF0aW9uUGF0aCA9IGF3YWl0IGZpbmRUYWlsd2luZENvbmZpZ3VyYXRpb25GaWxlKHdvcmtzcGFjZVJvb3QsIHByb2plY3RSb290KTtcbiAgaWYgKHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgpIHtcbiAgICAvLyBDcmVhdGUgYSBub2RlIHJlc29sdmVyIGF0IHRoZSBwcm9qZWN0IHJvb3QgYXMgYSBkaXJlY3RvcnlcbiAgICBjb25zdCByZXNvbHZlciA9IGNyZWF0ZVJlcXVpcmUocHJvamVjdFJvb3QgKyAnLycpO1xuICAgIHRyeSB7XG4gICAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24gPSB7XG4gICAgICAgIGZpbGU6IHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgsXG4gICAgICAgIHBhY2thZ2U6IHJlc29sdmVyLnJlc29sdmUoJ3RhaWx3aW5kY3NzJyksXG4gICAgICB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29uc3QgcmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGggPSBwYXRoLnJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgpO1xuICAgICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgYFRhaWx3aW5kIENTUyBjb25maWd1cmF0aW9uIGZpbGUgZm91bmQgKCR7cmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGh9KWAgK1xuICAgICAgICAgIGAgYnV0IHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UgaXMgbm90IGluc3RhbGxlZC5gICtcbiAgICAgICAgICBgIFRvIGVuYWJsZSBUYWlsd2luZCBDU1MsIHBsZWFzZSBpbnN0YWxsIHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UuYCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHNlcnZpY2VXb3JrZXJPcHRpb25zO1xuICBpZiAob3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgLy8gSWYgbmdzd0NvbmZpZ1BhdGggaXMgbm90IHNwZWNpZmllZCwgdGhlIGRlZmF1bHQgaXMgJ25nc3ctY29uZmlnLmpzb24nIHdpdGhpbiB0aGUgcHJvamVjdCByb290XG4gICAgc2VydmljZVdvcmtlck9wdGlvbnMgPSBvcHRpb25zLm5nc3dDb25maWdQYXRoXG4gICAgICA/IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLm5nc3dDb25maWdQYXRoKVxuICAgICAgOiBwYXRoLmpvaW4ocHJvamVjdFJvb3QsICduZ3N3LWNvbmZpZy5qc29uJyk7XG4gIH1cblxuICBsZXQgaW5kZXhIdG1sT3B0aW9ucztcbiAgaWYgKG9wdGlvbnMuaW5kZXgpIHtcbiAgICBpbmRleEh0bWxPcHRpb25zID0ge1xuICAgICAgaW5wdXQ6IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBnZXRJbmRleElucHV0RmlsZShvcHRpb25zLmluZGV4KSksXG4gICAgICAvLyBUaGUgb3V0cHV0IGZpbGUgd2lsbCBiZSBjcmVhdGVkIHdpdGhpbiB0aGUgY29uZmlndXJlZCBvdXRwdXQgcGF0aFxuICAgICAgb3V0cHV0OiBnZXRJbmRleE91dHB1dEZpbGUob3B0aW9ucy5pbmRleCksXG4gICAgICAvLyBUT0RPOiBVc2UgZXhpc3RpbmcgaW5mb3JtYXRpb24gZnJvbSBhYm92ZSB0byBjcmVhdGUgdGhlIGluc2VydGlvbiBvcmRlclxuICAgICAgaW5zZXJ0aW9uT3JkZXI6IGdlbmVyYXRlRW50cnlQb2ludHMoe1xuICAgICAgICBzY3JpcHRzOiBvcHRpb25zLnNjcmlwdHMgPz8gW10sXG4gICAgICAgIHN0eWxlczogb3B0aW9ucy5zdHlsZXMgPz8gW10sXG4gICAgICB9KSxcbiAgICB9O1xuICB9XG5cbiAgLy8gSW5pdGlhbCBvcHRpb25zIHRvIGtlZXBcbiAgY29uc3Qge1xuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICBhb3QsXG4gICAgYmFzZUhyZWYsXG4gICAgYnVpbGRPcHRpbWl6ZXIsXG4gICAgY3Jvc3NPcmlnaW4sXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgZXh0cmFjdExpY2Vuc2VzLFxuICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UgPSAnY3NzJyxcbiAgICBvdXRFeHRlbnNpb24sXG4gICAgcG9sbCxcbiAgICBwb2x5ZmlsbHMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBzdGF0c0pzb24sXG4gICAgc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIHZlcmJvc2UsXG4gICAgd2F0Y2gsXG4gICAgcHJvZ3Jlc3MsXG4gICAgZXh0ZXJuYWxQYWNrYWdlcyxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgLy8gUmV0dXJuIGFsbCB0aGUgbm9ybWFsaXplZCBvcHRpb25zXG4gIHJldHVybiB7XG4gICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zOiBidWlsZE9wdGltaXplcixcbiAgICBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMsXG4gICAgYmFzZUhyZWYsXG4gICAgY2FjaGVPcHRpb25zLFxuICAgIGNyb3NzT3JpZ2luLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIGV4dHJhY3RMaWNlbnNlcyxcbiAgICBpbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgIGppdDogIWFvdCxcbiAgICBzdGF0czogISFzdGF0c0pzb24sXG4gICAgcG9seWZpbGxzOiBwb2x5ZmlsbHMgPT09IHVuZGVmaW5lZCB8fCBBcnJheS5pc0FycmF5KHBvbHlmaWxscykgPyBwb2x5ZmlsbHMgOiBbcG9seWZpbGxzXSxcbiAgICBwb2xsLFxuICAgIHByb2dyZXNzOiBwcm9ncmVzcyA/PyB0cnVlLFxuICAgIGV4dGVybmFsUGFja2FnZXMsXG4gICAgLy8gSWYgbm90IGV4cGxpY2l0bHkgc2V0LCBkZWZhdWx0IHRvIHRoZSBOb2RlLmpzIHByb2Nlc3MgYXJndW1lbnRcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzOiBwcmVzZXJ2ZVN5bWxpbmtzID8/IHByb2Nlc3MuZXhlY0FyZ3YuaW5jbHVkZXMoJy0tcHJlc2VydmUtc3ltbGlua3MnKSxcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgdmVyYm9zZSxcbiAgICB3YXRjaCxcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgb3V0cHV0UGF0aCxcbiAgICBvdXRFeHRlbnNpb24sXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB0c2NvbmZpZyxcbiAgICBwcm9qZWN0Um9vdCxcbiAgICBhc3NldHMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICBnbG9iYWxTdHlsZXMsXG4gICAgZ2xvYmFsU2NyaXB0cyxcbiAgICBzZXJ2aWNlV29ya2VyT3B0aW9ucyxcbiAgICBpbmRleEh0bWxPcHRpb25zLFxuICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbixcbiAgfTtcbn1cblxuLyoqXG4gKiBOb3JtYWxpemUgZW50cnkgcG9pbnQgb3B0aW9ucy4gVG8gbWFpbnRhaW4gY29tcGF0aWJpbGl0eSB3aXRoIHRoZSBsZWdhY3kgYnJvd3NlciBidWlsZGVyLCB3ZSBuZWVkIGEgc2luZ2xlIGBtYWluYCBvcHRpb24gd2hpY2ggZGVmaW5lcyBhXG4gKiBzaW5nbGUgZW50cnkgcG9pbnQuIEhvd2V2ZXIsIHdlIGFsc28gd2FudCB0byBzdXBwb3J0IG11bHRpcGxlIGVudHJ5IHBvaW50cyBhcyBhbiBpbnRlcm5hbCBvcHRpb24uIFRoZSB0d28gb3B0aW9ucyBhcmUgbXV0dWFsbHkgZXhjbHVzaXZlXG4gKiBhbmQgaWYgYG1haW5gIGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgdXNlZCBhcyB0aGUgc29sZSBlbnRyeSBwb2ludC4gSWYgYGVudHJ5UG9pbnRzYCBhcmUgcHJvdmlkZWQsIHRoZXkgd2lsbCBiZSB1c2VkIGFzIHRoZSBzZXQgb2YgZW50cnlcbiAqIHBvaW50cy5cbiAqXG4gKiBAcGFyYW0gd29ya3NwYWNlUm9vdCBQYXRoIHRvIHRoZSByb290IG9mIHRoZSBBbmd1bGFyIHdvcmtzcGFjZS5cbiAqIEBwYXJhbSBtYWluIFRoZSBgbWFpbmAgb3B0aW9uIHBvaW50aW5nIGF0IHRoZSBhcHBsaWNhdGlvbiBlbnRyeSBwb2ludC4gV2hpbGUgcmVxdWlyZWQgcGVyIHRoZSBzY2hlbWEgZmlsZSwgaXQgbWF5IGJlIG9taXR0ZWQgYnlcbiAqICAgICBwcm9ncmFtbWF0aWMgdXNhZ2VzIG9mIGBicm93c2VyLWVzYnVpbGRgLlxuICogQHBhcmFtIGVudHJ5UG9pbnRzIFNldCBvZiBlbnRyeSBwb2ludHMgdG8gdXNlIGlmIHByb3ZpZGVkLlxuICogQHJldHVybnMgQW4gb2JqZWN0IG1hcHBpbmcgZW50cnkgcG9pbnQgbmFtZXMgdG8gdGhlaXIgZmlsZSBwYXRocy5cbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplRW50cnlQb2ludHMoXG4gIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgbWFpbjogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICBlbnRyeVBvaW50czogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCksXG4pOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHtcbiAgaWYgKG1haW4gPT09ICcnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdgbWFpbmAgb3B0aW9uIGNhbm5vdCBiZSBhbiBlbXB0eSBzdHJpbmcuJyk7XG4gIH1cblxuICAvLyBgbWFpbmAgYW5kIGBlbnRyeVBvaW50c2AgYXJlIG11dHVhbGx5IGV4Y2x1c2l2ZS5cbiAgaWYgKG1haW4gJiYgZW50cnlQb2ludHMuc2l6ZSA+IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ09ubHkgb25lIG9mIGBtYWluYCBvciBgZW50cnlQb2ludHNgIG1heSBiZSBwcm92aWRlZC4nKTtcbiAgfVxuICBpZiAoIW1haW4gJiYgZW50cnlQb2ludHMuc2l6ZSA9PT0gMCkge1xuICAgIC8vIFNjaGVtYSBzaG91bGQgbm9ybWFsbHkgcmVqZWN0IHRoaXMgY2FzZSwgYnV0IHByb2dyYW1tYXRpYyB1c2FnZXMgb2YgdGhlIGJ1aWxkZXIgbWlnaHQgbWFrZSB0aGlzIG1pc3Rha2UuXG4gICAgdGhyb3cgbmV3IEVycm9yKCdFaXRoZXIgYG1haW5gIG9yIGF0IGxlYXN0IG9uZSBgZW50cnlQb2ludHNgIHZhbHVlIG11c3QgYmUgcHJvdmlkZWQuJyk7XG4gIH1cblxuICAvLyBTY2hlbWEgdHlwZXMgZm9yY2UgYG1haW5gIHRvIGFsd2F5cyBiZSBwcm92aWRlZCwgYnV0IGl0IG1heSBiZSBvbWl0dGVkIHdoZW4gdGhlIGJ1aWxkZXIgaXMgaW52b2tlZCBwcm9ncmFtbWF0aWNhbGx5LlxuICBpZiAobWFpbikge1xuICAgIC8vIFVzZSBgbWFpbmAgYWxvbmUuXG4gICAgcmV0dXJuIHsgJ21haW4nOiBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgbWFpbikgfTtcbiAgfSBlbHNlIHtcbiAgICAvLyBVc2UgYGVudHJ5UG9pbnRzYCBhbG9uZS5cbiAgICBjb25zdCBlbnRyeVBvaW50UGF0aHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgICBmb3IgKGNvbnN0IGVudHJ5UG9pbnQgb2YgZW50cnlQb2ludHMpIHtcbiAgICAgIGNvbnN0IHBhcnNlZEVudHJ5UG9pbnQgPSBwYXRoLnBhcnNlKGVudHJ5UG9pbnQpO1xuXG4gICAgICAvLyBVc2UgdGhlIGlucHV0IGZpbGUgcGF0aCB3aXRob3V0IGFuIGV4dGVuc2lvbiBhcyB0aGUgXCJuYW1lXCIgb2YgdGhlIGVudHJ5IHBvaW50IGRpY3RhdGluZyBpdHMgb3V0cHV0IGxvY2F0aW9uLlxuICAgICAgLy8gUmVsYXRpdmUgZW50cnkgcG9pbnRzIGFyZSBnZW5lcmF0ZWQgYXQgdGhlIHNhbWUgcmVsYXRpdmUgcGF0aCBpbiB0aGUgb3V0cHV0IGRpcmVjdG9yeS5cbiAgICAgIC8vIEFic29sdXRlIGVudHJ5IHBvaW50cyBhcmUgYWx3YXlzIGdlbmVyYXRlZCB3aXRoIHRoZSBzYW1lIGZpbGUgbmFtZSBpbiB0aGUgcm9vdCBvZiB0aGUgb3V0cHV0IGRpcmVjdG9yeS4gVGhpcyBpbmNsdWRlcyBhYnNvbHV0ZVxuICAgICAgLy8gcGF0aHMgcG9pbnRpbmcgYXQgZmlsZXMgYWN0dWFsbHkgd2l0aGluIHRoZSB3b3Jrc3BhY2Ugcm9vdC5cbiAgICAgIGNvbnN0IGVudHJ5UG9pbnROYW1lID0gcGF0aC5pc0Fic29sdXRlKGVudHJ5UG9pbnQpXG4gICAgICAgID8gcGFyc2VkRW50cnlQb2ludC5uYW1lXG4gICAgICAgIDogcGF0aC5qb2luKHBhcnNlZEVudHJ5UG9pbnQuZGlyLCBwYXJzZWRFbnRyeVBvaW50Lm5hbWUpO1xuXG4gICAgICAvLyBHZXQgdGhlIGZ1bGwgZmlsZSBwYXRoIHRvIHRoZSBlbnRyeSBwb2ludCBpbnB1dC5cbiAgICAgIGNvbnN0IGVudHJ5UG9pbnRQYXRoID0gcGF0aC5pc0Fic29sdXRlKGVudHJ5UG9pbnQpXG4gICAgICAgID8gZW50cnlQb2ludFxuICAgICAgICA6IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBlbnRyeVBvaW50KTtcblxuICAgICAgLy8gQ2hlY2sgZm9yIGNvbmZsaWN0cyB3aXRoIHByZXZpb3VzIGVudHJ5IHBvaW50cy5cbiAgICAgIGNvbnN0IGV4aXN0aW5nRW50cnlQb2ludFBhdGggPSBlbnRyeVBvaW50UGF0aHNbZW50cnlQb2ludE5hbWVdO1xuICAgICAgaWYgKGV4aXN0aW5nRW50cnlQb2ludFBhdGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBcXGAke2V4aXN0aW5nRW50cnlQb2ludFBhdGh9XFxgIGFuZCBcXGAke2VudHJ5UG9pbnRQYXRofVxcYCBib3RoIG91dHB1dCB0byB0aGUgc2FtZSBsb2NhdGlvbiBcXGAke2VudHJ5UG9pbnROYW1lfVxcYC5gICtcbiAgICAgICAgICAgICcgUmVuYW1lIG9yIG1vdmUgb25lIG9mIHRoZSBmaWxlcyB0byBmaXggdGhlIGNvbmZsaWN0LicsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGVudHJ5UG9pbnRQYXRoc1tlbnRyeVBvaW50TmFtZV0gPSBlbnRyeVBvaW50UGF0aDtcbiAgICB9XG5cbiAgICByZXR1cm4gZW50cnlQb2ludFBhdGhzO1xuICB9XG59XG5cbi8qKlxuICogTm9ybWFsaXplIGEgZGlyZWN0b3J5IHBhdGggc3RyaW5nLlxuICogQ3VycmVudGx5IG9ubHkgcmVtb3ZlcyBhIHRyYWlsaW5nIHNsYXNoIGlmIHByZXNlbnQuXG4gKiBAcGFyYW0gcGF0aCBBIHBhdGggc3RyaW5nLlxuICogQHJldHVybnMgQSBub3JtYWxpemVkIHBhdGggc3RyaW5nLlxuICovXG5mdW5jdGlvbiBub3JtYWxpemVEaXJlY3RvcnlQYXRoKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGxhc3QgPSBwYXRoW3BhdGgubGVuZ3RoIC0gMV07XG4gIGlmIChsYXN0ID09PSAnLycgfHwgbGFzdCA9PT0gJ1xcXFwnKSB7XG4gICAgcmV0dXJuIHBhdGguc2xpY2UoMCwgLTEpO1xuICB9XG5cbiAgcmV0dXJuIHBhdGg7XG59XG4iXX0=