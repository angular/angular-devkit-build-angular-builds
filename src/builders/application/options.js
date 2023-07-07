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
// eslint-disable-next-line max-lines-per-function
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
        media: 'media/' +
            (options.outputHashing === schema_1.OutputHashing.All || options.outputHashing === schema_1.OutputHashing.Media
                ? '[name].[hash]'
                : '[name]'),
    };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL29wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsNkNBQTRDO0FBQzVDLDBEQUE2QjtBQUM3QiwrREFHMkM7QUFDM0MsdUNBQWlHO0FBQ2pHLGlFQUFvRTtBQUNwRSx1RUFBcUU7QUFDckUsbURBQXFFO0FBQ3JFLCtFQUEyRjtBQUMzRixxQ0FBOEU7QUFpQzlFOzs7Ozs7Ozs7R0FTRztBQUNILGtEQUFrRDtBQUMzQyxLQUFLLFVBQVUsZ0JBQWdCLENBQ3BDLE9BQXVCLEVBQ3ZCLFdBQW1CLEVBQ25CLE9BQTBDO0lBRTFDLE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7SUFDNUMsTUFBTSxlQUFlLEdBQUcsTUFBTSxPQUFPLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDdEUsTUFBTSxXQUFXLEdBQUcsc0JBQXNCLENBQ3hDLG1CQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRyxlQUFlLENBQUMsSUFBMkIsSUFBSSxFQUFFLENBQUMsQ0FDN0UsQ0FBQztJQUNGLE1BQU0saUJBQWlCLEdBQUcsc0JBQXNCLENBQzlDLG1CQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRyxlQUFlLENBQUMsVUFBaUMsSUFBSSxLQUFLLENBQUMsQ0FDdEYsQ0FBQztJQUVGLGlGQUFpRjtJQUNqRixNQUFNLFlBQVksR0FBRyxJQUFBLHVDQUFxQixFQUFDLGVBQWUsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUMzRSxZQUFZLENBQUMsSUFBSSxHQUFHLG1CQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFFOUQsTUFB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RTNELG1EQUFtRDtZQUNuRCxNQUFNLGNBQWMsR0FBRyxtQkFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUM7Z0JBQ2hELENBQUMsQ0FBQyxVQUFVO2dCQUNaLENBQUMsQ0FBQyxtQkFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFFekMsa0RBQWtEO1lBQ2xELE1BQU0sc0JBQXNCLEdBQUcsZUFBZSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQy9ELElBQUksc0JBQXNCLEVBQUU7Z0JBQzFCLE1BQU0sSUFBSSxLQUFLLENBQ2IsS0FBSyxzQkFBc0IsWUFBWSxjQUFjLHlDQUF5QyxjQUFjLEtBQUs7b0JBQy9HLHVEQUF1RCxDQUMxRCxDQUFDO2FBQ0g7WUFFRCxlQUFlLENBQUMsY0FBYyxDQUFDLEdBQUcsY0FBYyxDQUFDO1NBQ2xEO1FBRUQsT0FBTyxlQUFlLENBQUM7S0FDeEI7QUFDSCxDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxTQUFTLHNCQUFzQixDQUFDLElBQVk7SUFDMUMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDbkMsSUFBSSxJQUFJLEtBQUssR0FBRyxJQUFJLElBQUksS0FBSyxJQUFJLEVBQUU7UUFDakMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQzFCO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBjcmVhdGVSZXF1aXJlIH0gZnJvbSAnbm9kZTptb2R1bGUnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7XG4gIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUsXG4gIG5vcm1hbGl6ZUdsb2JhbFN0eWxlcyxcbn0gZnJvbSAnLi4vLi4vdG9vbHMvd2VicGFjay91dGlscy9oZWxwZXJzJztcbmltcG9ydCB7IG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMsIG5vcm1hbGl6ZU9wdGltaXphdGlvbiwgbm9ybWFsaXplU291cmNlTWFwcyB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL25vcm1hbGl6ZS1jYWNoZSc7XG5pbXBvcnQgeyBnZW5lcmF0ZUVudHJ5UG9pbnRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGFja2FnZS1jaHVuay1zb3J0JztcbmltcG9ydCB7IGZpbmRUYWlsd2luZENvbmZpZ3VyYXRpb25GaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvdGFpbHdpbmQnO1xuaW1wb3J0IHsgZ2V0SW5kZXhJbnB1dEZpbGUsIGdldEluZGV4T3V0cHV0RmlsZSB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEFwcGxpY2F0aW9uQnVpbGRlck9wdGlvbnMsIE91dHB1dEhhc2hpbmcgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmV4cG9ydCB0eXBlIE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyA9IEF3YWl0ZWQ8UmV0dXJuVHlwZTx0eXBlb2Ygbm9ybWFsaXplT3B0aW9ucz4+O1xuXG4vKiogSW50ZXJuYWwgb3B0aW9ucyBoaWRkZW4gZnJvbSBidWlsZGVyIHNjaGVtYSBidXQgYXZhaWxhYmxlIHdoZW4gaW52b2tlZCBwcm9ncmFtbWF0aWNhbGx5LiAqL1xuaW50ZXJmYWNlIEludGVybmFsT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBFbnRyeSBwb2ludHMgdG8gdXNlIGZvciB0aGUgY29tcGlsYXRpb24uIEluY29tcGF0aWJsZSB3aXRoIGBicm93c2VyYCwgd2hpY2ggbXVzdCBub3QgYmUgcHJvdmlkZWQuIE1heSBiZSByZWxhdGl2ZSBvciBhYnNvbHV0ZSBwYXRocy5cbiAgICogSWYgZ2l2ZW4gYSByZWxhdGl2ZSBwYXRoLCBpdCBpcyByZXNvbHZlZCByZWxhdGl2ZSB0byB0aGUgY3VycmVudCB3b3Jrc3BhY2UgYW5kIHdpbGwgZ2VuZXJhdGUgYW4gb3V0cHV0IGF0IHRoZSBzYW1lIHJlbGF0aXZlIGxvY2F0aW9uXG4gICAqIGluIHRoZSBvdXRwdXQgZGlyZWN0b3J5LiBJZiBnaXZlbiBhbiBhYnNvbHV0ZSBwYXRoLCB0aGUgb3V0cHV0IHdpbGwgYmUgZ2VuZXJhdGVkIGluIHRoZSByb290IG9mIHRoZSBvdXRwdXQgZGlyZWN0b3J5IHdpdGggdGhlIHNhbWUgYmFzZVxuICAgKiBuYW1lLlxuICAgKi9cbiAgZW50cnlQb2ludHM/OiBTZXQ8c3RyaW5nPjtcblxuICAvKiogRmlsZSBleHRlbnNpb24gdG8gdXNlIGZvciB0aGUgZ2VuZXJhdGVkIG91dHB1dCBmaWxlcy4gKi9cbiAgb3V0RXh0ZW5zaW9uPzogJ2pzJyB8ICdtanMnO1xuXG4gIC8qKlxuICAgKiBJbmRpY2F0ZXMgd2hldGhlciBhbGwgbm9kZSBwYWNrYWdlcyBzaG91bGQgYmUgbWFya2VkIGFzIGV4dGVybmFsLlxuICAgKiBDdXJyZW50bHkgdXNlZCBieSB0aGUgZGV2LXNlcnZlciB0byBzdXBwb3J0IHByZWJ1bmRsaW5nLlxuICAgKi9cbiAgZXh0ZXJuYWxQYWNrYWdlcz86IGJvb2xlYW47XG59XG5cbi8qKiBGdWxsIHNldCBvZiBvcHRpb25zIGZvciBgYXBwbGljYXRpb25gIGJ1aWxkZXIuICovXG5leHBvcnQgdHlwZSBBcHBsaWNhdGlvbkJ1aWxkZXJJbnRlcm5hbE9wdGlvbnMgPSBPbWl0PFxuICBBcHBsaWNhdGlvbkJ1aWxkZXJPcHRpb25zICYgSW50ZXJuYWxPcHRpb25zLFxuICAnYnJvd3Nlcidcbj4gJiB7XG4gIC8vIGBicm93c2VyYCBjYW4gYmUgYHVuZGVmaW5lZGAgaWYgYGVudHJ5UG9pbnRzYCBpcyB1c2VkLlxuICBicm93c2VyPzogc3RyaW5nO1xufTtcblxuLyoqXG4gKiBOb3JtYWxpemUgdGhlIHVzZXIgcHJvdmlkZWQgb3B0aW9ucyBieSBjcmVhdGluZyBmdWxsIHBhdGhzIGZvciBhbGwgcGF0aCBiYXNlZCBvcHRpb25zXG4gKiBhbmQgY29udmVydGluZyBtdWx0aS1mb3JtIG9wdGlvbnMgaW50byBhIHNpbmdsZSBmb3JtIHRoYXQgY2FuIGJlIGRpcmVjdGx5IHVzZWRcbiAqIGJ5IHRoZSBidWlsZCBwcm9jZXNzLlxuICpcbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBjb250ZXh0IGZvciBjdXJyZW50IGJ1aWxkZXIgZXhlY3V0aW9uLlxuICogQHBhcmFtIHByb2plY3ROYW1lIFRoZSBuYW1lIG9mIHRoZSBwcm9qZWN0IGZvciB0aGUgY3VycmVudCBleGVjdXRpb24uXG4gKiBAcGFyYW0gb3B0aW9ucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgb3B0aW9ucyB0byB1c2UgZm9yIHRoZSBidWlsZC5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBjb250YWluaW5nIG5vcm1hbGl6ZWQgb3B0aW9ucyByZXF1aXJlZCB0byBwZXJmb3JtIHRoZSBidWlsZC5cbiAqL1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBub3JtYWxpemVPcHRpb25zKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogQXBwbGljYXRpb25CdWlsZGVySW50ZXJuYWxPcHRpb25zLFxuKSB7XG4gIGNvbnN0IHdvcmtzcGFjZVJvb3QgPSBjb250ZXh0LndvcmtzcGFjZVJvb3Q7XG4gIGNvbnN0IHByb2plY3RNZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgY29uc3QgcHJvamVjdFJvb3QgPSBub3JtYWxpemVEaXJlY3RvcnlQYXRoKFxuICAgIHBhdGguam9pbih3b3Jrc3BhY2VSb290LCAocHJvamVjdE1ldGFkYXRhLnJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnJyksXG4gICk7XG4gIGNvbnN0IHByb2plY3RTb3VyY2VSb290ID0gbm9ybWFsaXplRGlyZWN0b3J5UGF0aChcbiAgICBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgKHByb2plY3RNZXRhZGF0YS5zb3VyY2VSb290IGFzIHN0cmluZyB8IHVuZGVmaW5lZCkgPz8gJ3NyYycpLFxuICApO1xuXG4gIC8vIEdhdGhlciBwZXJzaXN0ZW50IGNhY2hpbmcgb3B0aW9uIGFuZCBwcm92aWRlIGEgcHJvamVjdCBzcGVjaWZpYyBjYWNoZSBsb2NhdGlvblxuICBjb25zdCBjYWNoZU9wdGlvbnMgPSBub3JtYWxpemVDYWNoZU9wdGlvbnMocHJvamVjdE1ldGFkYXRhLCB3b3Jrc3BhY2VSb290KTtcbiAgY2FjaGVPcHRpb25zLnBhdGggPSBwYXRoLmpvaW4oY2FjaGVPcHRpb25zLnBhdGgsIHByb2plY3ROYW1lKTtcblxuICBjb25zdCBlbnRyeVBvaW50cyA9IG5vcm1hbGl6ZUVudHJ5UG9pbnRzKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMuYnJvd3Nlciwgb3B0aW9ucy5lbnRyeVBvaW50cyk7XG4gIGNvbnN0IHRzY29uZmlnID0gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMudHNDb25maWcpO1xuICBjb25zdCBvdXRwdXRQYXRoID0gbm9ybWFsaXplRGlyZWN0b3J5UGF0aChwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgb3B0aW9ucy5vdXRwdXRQYXRoKSk7XG4gIGNvbnN0IG9wdGltaXphdGlvbk9wdGlvbnMgPSBub3JtYWxpemVPcHRpbWl6YXRpb24ob3B0aW9ucy5vcHRpbWl6YXRpb24pO1xuICBjb25zdCBzb3VyY2VtYXBPcHRpb25zID0gbm9ybWFsaXplU291cmNlTWFwcyhvcHRpb25zLnNvdXJjZU1hcCA/PyBmYWxzZSk7XG4gIGNvbnN0IGFzc2V0cyA9IG9wdGlvbnMuYXNzZXRzPy5sZW5ndGhcbiAgICA/IG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMob3B0aW9ucy5hc3NldHMsIHdvcmtzcGFjZVJvb3QsIHByb2plY3RSb290LCBwcm9qZWN0U291cmNlUm9vdClcbiAgICA6IHVuZGVmaW5lZDtcblxuICBjb25zdCBvdXRwdXROYW1lcyA9IHtcbiAgICBidW5kbGVzOlxuICAgICAgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLkFsbCB8fCBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuQnVuZGxlc1xuICAgICAgICA/ICdbbmFtZV0uW2hhc2hdJ1xuICAgICAgICA6ICdbbmFtZV0nLFxuICAgIG1lZGlhOlxuICAgICAgJ21lZGlhLycgK1xuICAgICAgKG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5BbGwgfHwgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLk1lZGlhXG4gICAgICAgID8gJ1tuYW1lXS5baGFzaF0nXG4gICAgICAgIDogJ1tuYW1lXScpLFxuICB9O1xuXG4gIGxldCBmaWxlUmVwbGFjZW1lbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHwgdW5kZWZpbmVkO1xuICBpZiAob3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgZm9yIChjb25zdCByZXBsYWNlbWVudCBvZiBvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpIHtcbiAgICAgIGZpbGVSZXBsYWNlbWVudHMgPz89IHt9O1xuICAgICAgZmlsZVJlcGxhY2VtZW50c1twYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgcmVwbGFjZW1lbnQucmVwbGFjZSldID0gcGF0aC5qb2luKFxuICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICByZXBsYWNlbWVudC53aXRoLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBnbG9iYWxTdHlsZXM6IHsgbmFtZTogc3RyaW5nOyBmaWxlczogc3RyaW5nW107IGluaXRpYWw6IGJvb2xlYW4gfVtdID0gW107XG4gIGlmIChvcHRpb25zLnN0eWxlcz8ubGVuZ3RoKSB7XG4gICAgY29uc3QgeyBlbnRyeVBvaW50czogc3R5bGVzaGVldEVudHJ5cG9pbnRzLCBub0luamVjdE5hbWVzIH0gPSBub3JtYWxpemVHbG9iYWxTdHlsZXMoXG4gICAgICBvcHRpb25zLnN0eWxlcyB8fCBbXSxcbiAgICApO1xuICAgIGZvciAoY29uc3QgW25hbWUsIGZpbGVzXSBvZiBPYmplY3QuZW50cmllcyhzdHlsZXNoZWV0RW50cnlwb2ludHMpKSB7XG4gICAgICBnbG9iYWxTdHlsZXMucHVzaCh7IG5hbWUsIGZpbGVzLCBpbml0aWFsOiAhbm9JbmplY3ROYW1lcy5pbmNsdWRlcyhuYW1lKSB9KTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBnbG9iYWxTY3JpcHRzOiB7IG5hbWU6IHN0cmluZzsgZmlsZXM6IHN0cmluZ1tdOyBpbml0aWFsOiBib29sZWFuIH1bXSA9IFtdO1xuICBpZiAob3B0aW9ucy5zY3JpcHRzPy5sZW5ndGgpIHtcbiAgICBmb3IgKGNvbnN0IHsgYnVuZGxlTmFtZSwgcGF0aHMsIGluamVjdCB9IG9mIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUob3B0aW9ucy5zY3JpcHRzKSkge1xuICAgICAgZ2xvYmFsU2NyaXB0cy5wdXNoKHsgbmFtZTogYnVuZGxlTmFtZSwgZmlsZXM6IHBhdGhzLCBpbml0aWFsOiBpbmplY3QgfSk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHRhaWx3aW5kQ29uZmlndXJhdGlvbjogeyBmaWxlOiBzdHJpbmc7IHBhY2thZ2U6IHN0cmluZyB9IHwgdW5kZWZpbmVkO1xuICBjb25zdCB0YWlsd2luZENvbmZpZ3VyYXRpb25QYXRoID0gYXdhaXQgZmluZFRhaWx3aW5kQ29uZmlndXJhdGlvbkZpbGUod29ya3NwYWNlUm9vdCwgcHJvamVjdFJvb3QpO1xuICBpZiAodGFpbHdpbmRDb25maWd1cmF0aW9uUGF0aCkge1xuICAgIC8vIENyZWF0ZSBhIG5vZGUgcmVzb2x2ZXIgYXQgdGhlIHByb2plY3Qgcm9vdCBhcyBhIGRpcmVjdG9yeVxuICAgIGNvbnN0IHJlc29sdmVyID0gY3JlYXRlUmVxdWlyZShwcm9qZWN0Um9vdCArICcvJyk7XG4gICAgdHJ5IHtcbiAgICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbiA9IHtcbiAgICAgICAgZmlsZTogdGFpbHdpbmRDb25maWd1cmF0aW9uUGF0aCxcbiAgICAgICAgcGFja2FnZTogcmVzb2x2ZXIucmVzb2x2ZSgndGFpbHdpbmRjc3MnKSxcbiAgICAgIH07XG4gICAgfSBjYXRjaCB7XG4gICAgICBjb25zdCByZWxhdGl2ZVRhaWx3aW5kQ29uZmlnUGF0aCA9IHBhdGgucmVsYXRpdmUod29ya3NwYWNlUm9vdCwgdGFpbHdpbmRDb25maWd1cmF0aW9uUGF0aCk7XG4gICAgICBjb250ZXh0LmxvZ2dlci53YXJuKFxuICAgICAgICBgVGFpbHdpbmQgQ1NTIGNvbmZpZ3VyYXRpb24gZmlsZSBmb3VuZCAoJHtyZWxhdGl2ZVRhaWx3aW5kQ29uZmlnUGF0aH0pYCArXG4gICAgICAgICAgYCBidXQgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZSBpcyBub3QgaW5zdGFsbGVkLmAgK1xuICAgICAgICAgIGAgVG8gZW5hYmxlIFRhaWx3aW5kIENTUywgcGxlYXNlIGluc3RhbGwgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZS5gLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBsZXQgaW5kZXhIdG1sT3B0aW9ucztcbiAgLy8gaW5kZXggY2FuIG5ldmVyIGhhdmUgYSB2YWx1ZSBvZiBgdHJ1ZWAgYnV0IGluIHRoZSBzY2hlbWEgaXQncyBvZiB0eXBlIGBib29sZWFuYC5cbiAgaWYgKHR5cGVvZiBvcHRpb25zLmluZGV4ICE9PSAnYm9vbGVhbicpIHtcbiAgICBpbmRleEh0bWxPcHRpb25zID0ge1xuICAgICAgaW5wdXQ6IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBnZXRJbmRleElucHV0RmlsZShvcHRpb25zLmluZGV4KSksXG4gICAgICAvLyBUaGUgb3V0cHV0IGZpbGUgd2lsbCBiZSBjcmVhdGVkIHdpdGhpbiB0aGUgY29uZmlndXJlZCBvdXRwdXQgcGF0aFxuICAgICAgb3V0cHV0OiBnZXRJbmRleE91dHB1dEZpbGUob3B0aW9ucy5pbmRleCksXG4gICAgICAvLyBUT0RPOiBVc2UgZXhpc3RpbmcgaW5mb3JtYXRpb24gZnJvbSBhYm92ZSB0byBjcmVhdGUgdGhlIGluc2VydGlvbiBvcmRlclxuICAgICAgaW5zZXJ0aW9uT3JkZXI6IGdlbmVyYXRlRW50cnlQb2ludHMoe1xuICAgICAgICBzY3JpcHRzOiBvcHRpb25zLnNjcmlwdHMgPz8gW10sXG4gICAgICAgIHN0eWxlczogb3B0aW9ucy5zdHlsZXMgPz8gW10sXG4gICAgICB9KSxcbiAgICB9O1xuICB9XG5cbiAgbGV0IHNlcnZlckVudHJ5UG9pbnQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgaWYgKG9wdGlvbnMuc2VydmVyKSB7XG4gICAgc2VydmVyRW50cnlQb2ludCA9IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLnNlcnZlcik7XG4gIH0gZWxzZSBpZiAob3B0aW9ucy5zZXJ2ZXIgPT09ICcnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdgc2VydmVyYCBvcHRpb24gY2Fubm90IGJlIGFuIGVtcHR5IHN0cmluZy4nKTtcbiAgfVxuXG4gIGxldCBwcmVyZW5kZXJPcHRpb25zO1xuICBpZiAob3B0aW9ucy5wcmVyZW5kZXIpIHtcbiAgICBjb25zdCB7XG4gICAgICBkaXNjb3ZlclJvdXRlcyA9IHRydWUsXG4gICAgICByb3V0ZXMgPSBbXSxcbiAgICAgIHJvdXRlc0ZpbGUgPSB1bmRlZmluZWQsXG4gICAgfSA9IG9wdGlvbnMucHJlcmVuZGVyID09PSB0cnVlID8ge30gOiBvcHRpb25zLnByZXJlbmRlcjtcblxuICAgIHByZXJlbmRlck9wdGlvbnMgPSB7XG4gICAgICBkaXNjb3ZlclJvdXRlcyxcbiAgICAgIHJvdXRlcyxcbiAgICAgIHJvdXRlc0ZpbGU6IHJvdXRlc0ZpbGUgJiYgcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIHJvdXRlc0ZpbGUpLFxuICAgIH07XG4gIH1cblxuICBsZXQgYXBwU2hlbGxPcHRpb25zO1xuICBpZiAob3B0aW9ucy5hcHBTaGVsbCkge1xuICAgIGFwcFNoZWxsT3B0aW9ucyA9IHtcbiAgICAgIHJvdXRlOiAnc2hlbGwnLFxuICAgIH07XG4gIH1cblxuICAvLyBJbml0aWFsIG9wdGlvbnMgdG8ga2VlcFxuICBjb25zdCB7XG4gICAgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgIGFvdCxcbiAgICBiYXNlSHJlZixcbiAgICBjcm9zc09yaWdpbixcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBleHRyYWN0TGljZW5zZXMsXG4gICAgaW5saW5lU3R5bGVMYW5ndWFnZSA9ICdjc3MnLFxuICAgIG91dEV4dGVuc2lvbixcbiAgICBzZXJ2aWNlV29ya2VyLFxuICAgIHBvbGwsXG4gICAgcG9seWZpbGxzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgc3RhdHNKc29uLFxuICAgIHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucyxcbiAgICBzdWJyZXNvdXJjZUludGVncml0eSxcbiAgICB2ZXJib3NlLFxuICAgIHdhdGNoLFxuICAgIHByb2dyZXNzID0gdHJ1ZSxcbiAgICBleHRlcm5hbFBhY2thZ2VzLFxuICAgIGRlbGV0ZU91dHB1dFBhdGgsXG4gIH0gPSBvcHRpb25zO1xuXG4gIC8vIFJldHVybiBhbGwgdGhlIG5vcm1hbGl6ZWQgb3B0aW9uc1xuICByZXR1cm4ge1xuICAgIGFkdmFuY2VkT3B0aW1pemF0aW9uczogISFhb3QsXG4gICAgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgIGJhc2VIcmVmLFxuICAgIGNhY2hlT3B0aW9ucyxcbiAgICBjcm9zc09yaWdpbixcbiAgICBkZWxldGVPdXRwdXRQYXRoLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIGV4dHJhY3RMaWNlbnNlcyxcbiAgICBpbmxpbmVTdHlsZUxhbmd1YWdlLFxuICAgIGppdDogIWFvdCxcbiAgICBzdGF0czogISFzdGF0c0pzb24sXG4gICAgcG9seWZpbGxzOiBwb2x5ZmlsbHMgPT09IHVuZGVmaW5lZCB8fCBBcnJheS5pc0FycmF5KHBvbHlmaWxscykgPyBwb2x5ZmlsbHMgOiBbcG9seWZpbGxzXSxcbiAgICBwb2xsLFxuICAgIHByb2dyZXNzLFxuICAgIGV4dGVybmFsUGFja2FnZXMsXG4gICAgLy8gSWYgbm90IGV4cGxpY2l0bHkgc2V0LCBkZWZhdWx0IHRvIHRoZSBOb2RlLmpzIHByb2Nlc3MgYXJndW1lbnRcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzOiBwcmVzZXJ2ZVN5bWxpbmtzID8/IHByb2Nlc3MuZXhlY0FyZ3YuaW5jbHVkZXMoJy0tcHJlc2VydmUtc3ltbGlua3MnKSxcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgc2VydmVyRW50cnlQb2ludCxcbiAgICBwcmVyZW5kZXJPcHRpb25zLFxuICAgIGFwcFNoZWxsT3B0aW9ucyxcbiAgICB2ZXJib3NlLFxuICAgIHdhdGNoLFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgZW50cnlQb2ludHMsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBvdXRwdXRQYXRoLFxuICAgIG91dEV4dGVuc2lvbixcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICAgIHByb2plY3RSb290LFxuICAgIGFzc2V0cyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgIGdsb2JhbFN0eWxlcyxcbiAgICBnbG9iYWxTY3JpcHRzLFxuICAgIHNlcnZpY2VXb3JrZXI6XG4gICAgICB0eXBlb2Ygc2VydmljZVdvcmtlciA9PT0gJ3N0cmluZycgPyBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgc2VydmljZVdvcmtlcikgOiB1bmRlZmluZWQsXG4gICAgaW5kZXhIdG1sT3B0aW9ucyxcbiAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gIH07XG59XG5cbi8qKlxuICogTm9ybWFsaXplIGVudHJ5IHBvaW50IG9wdGlvbnMuIFRvIG1haW50YWluIGNvbXBhdGliaWxpdHkgd2l0aCB0aGUgbGVnYWN5IGJyb3dzZXIgYnVpbGRlciwgd2UgbmVlZCBhIHNpbmdsZSBgYnJvd3NlcmBcbiAqIG9wdGlvbiB3aGljaCBkZWZpbmVzIGEgc2luZ2xlIGVudHJ5IHBvaW50LiBIb3dldmVyLCB3ZSBhbHNvIHdhbnQgdG8gc3VwcG9ydCBtdWx0aXBsZSBlbnRyeSBwb2ludHMgYXMgYW4gaW50ZXJuYWwgb3B0aW9uLlxuICogVGhlIHR3byBvcHRpb25zIGFyZSBtdXR1YWxseSBleGNsdXNpdmUgYW5kIGlmIGBicm93c2VyYCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWQgYXMgdGhlIHNvbGUgZW50cnkgcG9pbnQuXG4gKiBJZiBgZW50cnlQb2ludHNgIGFyZSBwcm92aWRlZCwgdGhleSB3aWxsIGJlIHVzZWQgYXMgdGhlIHNldCBvZiBlbnRyeSBwb2ludHMuXG4gKlxuICogQHBhcmFtIHdvcmtzcGFjZVJvb3QgUGF0aCB0byB0aGUgcm9vdCBvZiB0aGUgQW5ndWxhciB3b3Jrc3BhY2UuXG4gKiBAcGFyYW0gYnJvd3NlciBUaGUgYGJyb3dzZXJgIG9wdGlvbiBwb2ludGluZyBhdCB0aGUgYXBwbGljYXRpb24gZW50cnkgcG9pbnQuIFdoaWxlIHJlcXVpcmVkIHBlciB0aGUgc2NoZW1hIGZpbGUsIGl0IG1heSBiZSBvbWl0dGVkIGJ5XG4gKiAgICAgcHJvZ3JhbW1hdGljIHVzYWdlcyBvZiBgYnJvd3Nlci1lc2J1aWxkYC5cbiAqIEBwYXJhbSBlbnRyeVBvaW50cyBTZXQgb2YgZW50cnkgcG9pbnRzIHRvIHVzZSBpZiBwcm92aWRlZC5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBtYXBwaW5nIGVudHJ5IHBvaW50IG5hbWVzIHRvIHRoZWlyIGZpbGUgcGF0aHMuXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZUVudHJ5UG9pbnRzKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIGJyb3dzZXI6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgZW50cnlQb2ludHM6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpLFxuKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gIGlmIChicm93c2VyID09PSAnJykge1xuICAgIHRocm93IG5ldyBFcnJvcignYGJyb3dzZXJgIG9wdGlvbiBjYW5ub3QgYmUgYW4gZW1wdHkgc3RyaW5nLicpO1xuICB9XG5cbiAgLy8gYGJyb3dzZXJgIGFuZCBgZW50cnlQb2ludHNgIGFyZSBtdXR1YWxseSBleGNsdXNpdmUuXG4gIGlmIChicm93c2VyICYmIGVudHJ5UG9pbnRzLnNpemUgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdPbmx5IG9uZSBvZiBgYnJvd3NlcmAgb3IgYGVudHJ5UG9pbnRzYCBtYXkgYmUgcHJvdmlkZWQuJyk7XG4gIH1cbiAgaWYgKCFicm93c2VyICYmIGVudHJ5UG9pbnRzLnNpemUgPT09IDApIHtcbiAgICAvLyBTY2hlbWEgc2hvdWxkIG5vcm1hbGx5IHJlamVjdCB0aGlzIGNhc2UsIGJ1dCBwcm9ncmFtbWF0aWMgdXNhZ2VzIG9mIHRoZSBidWlsZGVyIG1pZ2h0IG1ha2UgdGhpcyBtaXN0YWtlLlxuICAgIHRocm93IG5ldyBFcnJvcignRWl0aGVyIGBicm93c2VyYCBvciBhdCBsZWFzdCBvbmUgYGVudHJ5UG9pbnRzYCB2YWx1ZSBtdXN0IGJlIHByb3ZpZGVkLicpO1xuICB9XG5cbiAgLy8gU2NoZW1hIHR5cGVzIGZvcmNlIGBicm93c2VyYCB0byBhbHdheXMgYmUgcHJvdmlkZWQsIGJ1dCBpdCBtYXkgYmUgb21pdHRlZCB3aGVuIHRoZSBidWlsZGVyIGlzIGludm9rZWQgcHJvZ3JhbW1hdGljYWxseS5cbiAgaWYgKGJyb3dzZXIpIHtcbiAgICAvLyBVc2UgYGJyb3dzZXJgIGFsb25lLlxuICAgIHJldHVybiB7ICdtYWluJzogcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGJyb3dzZXIpIH07XG4gIH0gZWxzZSB7XG4gICAgLy8gVXNlIGBlbnRyeVBvaW50c2AgYWxvbmUuXG4gICAgY29uc3QgZW50cnlQb2ludFBhdGhzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgZm9yIChjb25zdCBlbnRyeVBvaW50IG9mIGVudHJ5UG9pbnRzKSB7XG4gICAgICBjb25zdCBwYXJzZWRFbnRyeVBvaW50ID0gcGF0aC5wYXJzZShlbnRyeVBvaW50KTtcblxuICAgICAgLy8gVXNlIHRoZSBpbnB1dCBmaWxlIHBhdGggd2l0aG91dCBhbiBleHRlbnNpb24gYXMgdGhlIFwibmFtZVwiIG9mIHRoZSBlbnRyeSBwb2ludCBkaWN0YXRpbmcgaXRzIG91dHB1dCBsb2NhdGlvbi5cbiAgICAgIC8vIFJlbGF0aXZlIGVudHJ5IHBvaW50cyBhcmUgZ2VuZXJhdGVkIGF0IHRoZSBzYW1lIHJlbGF0aXZlIHBhdGggaW4gdGhlIG91dHB1dCBkaXJlY3RvcnkuXG4gICAgICAvLyBBYnNvbHV0ZSBlbnRyeSBwb2ludHMgYXJlIGFsd2F5cyBnZW5lcmF0ZWQgd2l0aCB0aGUgc2FtZSBmaWxlIG5hbWUgaW4gdGhlIHJvb3Qgb2YgdGhlIG91dHB1dCBkaXJlY3RvcnkuIFRoaXMgaW5jbHVkZXMgYWJzb2x1dGVcbiAgICAgIC8vIHBhdGhzIHBvaW50aW5nIGF0IGZpbGVzIGFjdHVhbGx5IHdpdGhpbiB0aGUgd29ya3NwYWNlIHJvb3QuXG4gICAgICBjb25zdCBlbnRyeVBvaW50TmFtZSA9IHBhdGguaXNBYnNvbHV0ZShlbnRyeVBvaW50KVxuICAgICAgICA/IHBhcnNlZEVudHJ5UG9pbnQubmFtZVxuICAgICAgICA6IHBhdGguam9pbihwYXJzZWRFbnRyeVBvaW50LmRpciwgcGFyc2VkRW50cnlQb2ludC5uYW1lKTtcblxuICAgICAgLy8gR2V0IHRoZSBmdWxsIGZpbGUgcGF0aCB0byB0aGUgZW50cnkgcG9pbnQgaW5wdXQuXG4gICAgICBjb25zdCBlbnRyeVBvaW50UGF0aCA9IHBhdGguaXNBYnNvbHV0ZShlbnRyeVBvaW50KVxuICAgICAgICA/IGVudHJ5UG9pbnRcbiAgICAgICAgOiBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgZW50cnlQb2ludCk7XG5cbiAgICAgIC8vIENoZWNrIGZvciBjb25mbGljdHMgd2l0aCBwcmV2aW91cyBlbnRyeSBwb2ludHMuXG4gICAgICBjb25zdCBleGlzdGluZ0VudHJ5UG9pbnRQYXRoID0gZW50cnlQb2ludFBhdGhzW2VudHJ5UG9pbnROYW1lXTtcbiAgICAgIGlmIChleGlzdGluZ0VudHJ5UG9pbnRQYXRoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgXFxgJHtleGlzdGluZ0VudHJ5UG9pbnRQYXRofVxcYCBhbmQgXFxgJHtlbnRyeVBvaW50UGF0aH1cXGAgYm90aCBvdXRwdXQgdG8gdGhlIHNhbWUgbG9jYXRpb24gXFxgJHtlbnRyeVBvaW50TmFtZX1cXGAuYCArXG4gICAgICAgICAgICAnIFJlbmFtZSBvciBtb3ZlIG9uZSBvZiB0aGUgZmlsZXMgdG8gZml4IHRoZSBjb25mbGljdC4nLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBlbnRyeVBvaW50UGF0aHNbZW50cnlQb2ludE5hbWVdID0gZW50cnlQb2ludFBhdGg7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVudHJ5UG9pbnRQYXRocztcbiAgfVxufVxuXG4vKipcbiAqIE5vcm1hbGl6ZSBhIGRpcmVjdG9yeSBwYXRoIHN0cmluZy5cbiAqIEN1cnJlbnRseSBvbmx5IHJlbW92ZXMgYSB0cmFpbGluZyBzbGFzaCBpZiBwcmVzZW50LlxuICogQHBhcmFtIHBhdGggQSBwYXRoIHN0cmluZy5cbiAqIEByZXR1cm5zIEEgbm9ybWFsaXplZCBwYXRoIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplRGlyZWN0b3J5UGF0aChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBsYXN0ID0gcGF0aFtwYXRoLmxlbmd0aCAtIDFdO1xuICBpZiAobGFzdCA9PT0gJy8nIHx8IGxhc3QgPT09ICdcXFxcJykge1xuICAgIHJldHVybiBwYXRoLnNsaWNlKDAsIC0xKTtcbiAgfVxuXG4gIHJldHVybiBwYXRoO1xufVxuIl19