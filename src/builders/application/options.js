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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL29wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsNkNBQTRDO0FBQzVDLDBEQUE2QjtBQUM3QiwrREFHMkM7QUFDM0MsdUNBQWlHO0FBQ2pHLDJEQUEwRTtBQUMxRSxpRUFBb0U7QUFDcEUsdUVBQXFFO0FBQ3JFLG1EQUFxRTtBQUNyRSwrRUFBMkY7QUFDM0YscUNBQStGO0FBaUMvRjs7Ozs7Ozs7O0dBU0c7QUFDSCxrREFBa0Q7QUFDM0MsS0FBSyxVQUFVLGdCQUFnQixDQUNwQyxPQUF1QixFQUN2QixXQUFtQixFQUNuQixPQUEwQztJQUUxQyxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDO0lBQzVDLE1BQU0sZUFBZSxHQUFHLE1BQU0sT0FBTyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3RFLE1BQU0sV0FBVyxHQUFHLHNCQUFzQixDQUN4QyxtQkFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUcsZUFBZSxDQUFDLElBQTJCLElBQUksRUFBRSxDQUFDLENBQzdFLENBQUM7SUFDRixNQUFNLGlCQUFpQixHQUFHLHNCQUFzQixDQUM5QyxtQkFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUcsZUFBZSxDQUFDLFVBQWlDLElBQUksS0FBSyxDQUFDLENBQ3RGLENBQUM7SUFFRixpRkFBaUY7SUFDakYsTUFBTSxZQUFZLEdBQUcsSUFBQSx1Q0FBcUIsRUFBQyxlQUFlLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDM0UsWUFBWSxDQUFDLElBQUksR0FBRyxtQkFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxD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O0FBRUQ7Ozs7O0dBS0c7QUFDSCxTQUFTLHNCQUFzQixDQUFDLElBQVk7SUFDMUMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDbkMsSUFBSSxJQUFJLEtBQUssR0FBRyxJQUFJLElBQUksS0FBSyxJQUFJLEVBQUU7UUFDakMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQzFCO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBjcmVhdGVSZXF1aXJlIH0gZnJvbSAnbm9kZTptb2R1bGUnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7XG4gIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUsXG4gIG5vcm1hbGl6ZUdsb2JhbFN0eWxlcyxcbn0gZnJvbSAnLi4vLi4vdG9vbHMvd2VicGFjay91dGlscy9oZWxwZXJzJztcbmltcG9ydCB7IG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMsIG5vcm1hbGl6ZU9wdGltaXphdGlvbiwgbm9ybWFsaXplU291cmNlTWFwcyB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IEkxOG5PcHRpb25zLCBjcmVhdGVJMThuT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2kxOG4tb3B0aW9ucyc7XG5pbXBvcnQgeyBub3JtYWxpemVDYWNoZU9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9ub3JtYWxpemUtY2FjaGUnO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cyB9IGZyb20gJy4uLy4uL3V0aWxzL3BhY2thZ2UtY2h1bmstc29ydCc7XG5pbXBvcnQgeyBmaW5kVGFpbHdpbmRDb25maWd1cmF0aW9uRmlsZSB9IGZyb20gJy4uLy4uL3V0aWxzL3RhaWx3aW5kJztcbmltcG9ydCB7IGdldEluZGV4SW5wdXRGaWxlLCBnZXRJbmRleE91dHB1dEZpbGUgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IFNjaGVtYSBhcyBBcHBsaWNhdGlvbkJ1aWxkZXJPcHRpb25zLCBJMThOVHJhbnNsYXRpb24sIE91dHB1dEhhc2hpbmcgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmV4cG9ydCB0eXBlIE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyA9IEF3YWl0ZWQ8UmV0dXJuVHlwZTx0eXBlb2Ygbm9ybWFsaXplT3B0aW9ucz4+O1xuXG4vKiogSW50ZXJuYWwgb3B0aW9ucyBoaWRkZW4gZnJvbSBidWlsZGVyIHNjaGVtYSBidXQgYXZhaWxhYmxlIHdoZW4gaW52b2tlZCBwcm9ncmFtbWF0aWNhbGx5LiAqL1xuaW50ZXJmYWNlIEludGVybmFsT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBFbnRyeSBwb2ludHMgdG8gdXNlIGZvciB0aGUgY29tcGlsYXRpb24uIEluY29tcGF0aWJsZSB3aXRoIGBicm93c2VyYCwgd2hpY2ggbXVzdCBub3QgYmUgcHJvdmlkZWQuIE1heSBiZSByZWxhdGl2ZSBvciBhYnNvbHV0ZSBwYXRocy5cbiAgICogSWYgZ2l2ZW4gYSByZWxhdGl2ZSBwYXRoLCBpdCBpcyByZXNvbHZlZCByZWxhdGl2ZSB0byB0aGUgY3VycmVudCB3b3Jrc3BhY2UgYW5kIHdpbGwgZ2VuZXJhdGUgYW4gb3V0cHV0IGF0IHRoZSBzYW1lIHJlbGF0aXZlIGxvY2F0aW9uXG4gICAqIGluIHRoZSBvdXRwdXQgZGlyZWN0b3J5LiBJZiBnaXZlbiBhbiBhYnNvbHV0ZSBwYXRoLCB0aGUgb3V0cHV0IHdpbGwgYmUgZ2VuZXJhdGVkIGluIHRoZSByb290IG9mIHRoZSBvdXRwdXQgZGlyZWN0b3J5IHdpdGggdGhlIHNhbWUgYmFzZVxuICAgKiBuYW1lLlxuICAgKi9cbiAgZW50cnlQb2ludHM/OiBTZXQ8c3RyaW5nPjtcblxuICAvKiogRmlsZSBleHRlbnNpb24gdG8gdXNlIGZvciB0aGUgZ2VuZXJhdGVkIG91dHB1dCBmaWxlcy4gKi9cbiAgb3V0RXh0ZW5zaW9uPzogJ2pzJyB8ICdtanMnO1xuXG4gIC8qKlxuICAgKiBJbmRpY2F0ZXMgd2hldGhlciBhbGwgbm9kZSBwYWNrYWdlcyBzaG91bGQgYmUgbWFya2VkIGFzIGV4dGVybmFsLlxuICAgKiBDdXJyZW50bHkgdXNlZCBieSB0aGUgZGV2LXNlcnZlciB0byBzdXBwb3J0IHByZWJ1bmRsaW5nLlxuICAgKi9cbiAgZXh0ZXJuYWxQYWNrYWdlcz86IGJvb2xlYW47XG59XG5cbi8qKiBGdWxsIHNldCBvZiBvcHRpb25zIGZvciBgYXBwbGljYXRpb25gIGJ1aWxkZXIuICovXG5leHBvcnQgdHlwZSBBcHBsaWNhdGlvbkJ1aWxkZXJJbnRlcm5hbE9wdGlvbnMgPSBPbWl0PFxuICBBcHBsaWNhdGlvbkJ1aWxkZXJPcHRpb25zICYgSW50ZXJuYWxPcHRpb25zLFxuICAnYnJvd3Nlcidcbj4gJiB7XG4gIC8vIGBicm93c2VyYCBjYW4gYmUgYHVuZGVmaW5lZGAgaWYgYGVudHJ5UG9pbnRzYCBpcyB1c2VkLlxuICBicm93c2VyPzogc3RyaW5nO1xufTtcblxuLyoqXG4gKiBOb3JtYWxpemUgdGhlIHVzZXIgcHJvdmlkZWQgb3B0aW9ucyBieSBjcmVhdGluZyBmdWxsIHBhdGhzIGZvciBhbGwgcGF0aCBiYXNlZCBvcHRpb25zXG4gKiBhbmQgY29udmVydGluZyBtdWx0aS1mb3JtIG9wdGlvbnMgaW50byBhIHNpbmdsZSBmb3JtIHRoYXQgY2FuIGJlIGRpcmVjdGx5IHVzZWRcbiAqIGJ5IHRoZSBidWlsZCBwcm9jZXNzLlxuICpcbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBjb250ZXh0IGZvciBjdXJyZW50IGJ1aWxkZXIgZXhlY3V0aW9uLlxuICogQHBhcmFtIHByb2plY3ROYW1lIFRoZSBuYW1lIG9mIHRoZSBwcm9qZWN0IGZvciB0aGUgY3VycmVudCBleGVjdXRpb24uXG4gKiBAcGFyYW0gb3B0aW9ucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgb3B0aW9ucyB0byB1c2UgZm9yIHRoZSBidWlsZC5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBjb250YWluaW5nIG5vcm1hbGl6ZWQgb3B0aW9ucyByZXF1aXJlZCB0byBwZXJmb3JtIHRoZSBidWlsZC5cbiAqL1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBub3JtYWxpemVPcHRpb25zKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogQXBwbGljYXRpb25CdWlsZGVySW50ZXJuYWxPcHRpb25zLFxuKSB7XG4gIGNvbnN0IHdvcmtzcGFjZVJvb3QgPSBjb250ZXh0LndvcmtzcGFjZVJvb3Q7XG4gIGNvbnN0IHByb2plY3RNZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgY29uc3QgcHJvamVjdFJvb3QgPSBub3JtYWxpemVEaXJlY3RvcnlQYXRoKFxuICAgIHBhdGguam9pbih3b3Jrc3BhY2VSb290LCAocHJvamVjdE1ldGFkYXRhLnJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnJyksXG4gICk7XG4gIGNvbnN0IHByb2plY3RTb3VyY2VSb290ID0gbm9ybWFsaXplRGlyZWN0b3J5UGF0aChcbiAgICBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgKHByb2plY3RNZXRhZGF0YS5zb3VyY2VSb290IGFzIHN0cmluZyB8IHVuZGVmaW5lZCkgPz8gJ3NyYycpLFxuICApO1xuXG4gIC8vIEdhdGhlciBwZXJzaXN0ZW50IGNhY2hpbmcgb3B0aW9uIGFuZCBwcm92aWRlIGEgcHJvamVjdCBzcGVjaWZpYyBjYWNoZSBsb2NhdGlvblxuICBjb25zdCBjYWNoZU9wdGlvbnMgPSBub3JtYWxpemVDYWNoZU9wdGlvbnMocHJvamVjdE1ldGFkYXRhLCB3b3Jrc3BhY2VSb290KTtcbiAgY2FjaGVPcHRpb25zLnBhdGggPSBwYXRoLmpvaW4oY2FjaGVPcHRpb25zLnBhdGgsIHByb2plY3ROYW1lKTtcblxuICBjb25zdCBpMThuT3B0aW9uczogSTE4bk9wdGlvbnMgJiB7XG4gICAgZHVwbGljYXRlVHJhbnNsYXRpb25CZWhhdmlvcj86IEkxOE5UcmFuc2xhdGlvbjtcbiAgICBtaXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvcj86IEkxOE5UcmFuc2xhdGlvbjtcbiAgfSA9IGNyZWF0ZUkxOG5PcHRpb25zKHByb2plY3RNZXRhZGF0YSwgb3B0aW9ucy5sb2NhbGl6ZSk7XG4gIGkxOG5PcHRpb25zLmR1cGxpY2F0ZVRyYW5zbGF0aW9uQmVoYXZpb3IgPSBvcHRpb25zLmkxOG5EdXBsaWNhdGVUcmFuc2xhdGlvbjtcbiAgaTE4bk9wdGlvbnMubWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IgPSBvcHRpb25zLmkxOG5NaXNzaW5nVHJhbnNsYXRpb247XG5cbiAgY29uc3QgZW50cnlQb2ludHMgPSBub3JtYWxpemVFbnRyeVBvaW50cyh3b3Jrc3BhY2VSb290LCBvcHRpb25zLmJyb3dzZXIsIG9wdGlvbnMuZW50cnlQb2ludHMpO1xuICBjb25zdCB0c2NvbmZpZyA9IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLnRzQ29uZmlnKTtcbiAgY29uc3Qgb3V0cHV0UGF0aCA9IG5vcm1hbGl6ZURpcmVjdG9yeVBhdGgocGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMub3V0cHV0UGF0aCkpO1xuICBjb25zdCBvcHRpbWl6YXRpb25PcHRpb25zID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKG9wdGlvbnMub3B0aW1pemF0aW9uKTtcbiAgY29uc3Qgc291cmNlbWFwT3B0aW9ucyA9IG5vcm1hbGl6ZVNvdXJjZU1hcHMob3B0aW9ucy5zb3VyY2VNYXAgPz8gZmFsc2UpO1xuICBjb25zdCBhc3NldHMgPSBvcHRpb25zLmFzc2V0cz8ubGVuZ3RoXG4gICAgPyBub3JtYWxpemVBc3NldFBhdHRlcm5zKG9wdGlvbnMuYXNzZXRzLCB3b3Jrc3BhY2VSb290LCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QpXG4gICAgOiB1bmRlZmluZWQ7XG5cbiAgY29uc3Qgb3V0cHV0TmFtZXMgPSB7XG4gICAgYnVuZGxlczpcbiAgICAgIG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5BbGwgfHwgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLkJ1bmRsZXNcbiAgICAgICAgPyAnW25hbWVdLltoYXNoXSdcbiAgICAgICAgOiAnW25hbWVdJyxcbiAgICBtZWRpYTpcbiAgICAgICdtZWRpYS8nICtcbiAgICAgIChvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuQWxsIHx8IG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5NZWRpYVxuICAgICAgICA/ICdbbmFtZV0uW2hhc2hdJ1xuICAgICAgICA6ICdbbmFtZV0nKSxcbiAgfTtcblxuICBsZXQgZmlsZVJlcGxhY2VtZW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB8IHVuZGVmaW5lZDtcbiAgaWYgKG9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykge1xuICAgIGZvciAoY29uc3QgcmVwbGFjZW1lbnQgb2Ygb3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgICBmaWxlUmVwbGFjZW1lbnRzID8/PSB7fTtcbiAgICAgIGZpbGVSZXBsYWNlbWVudHNbcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIHJlcGxhY2VtZW50LnJlcGxhY2UpXSA9IHBhdGguam9pbihcbiAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgcmVwbGFjZW1lbnQud2l0aCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZ2xvYmFsU3R5bGVzOiB7IG5hbWU6IHN0cmluZzsgZmlsZXM6IHN0cmluZ1tdOyBpbml0aWFsOiBib29sZWFuIH1bXSA9IFtdO1xuICBpZiAob3B0aW9ucy5zdHlsZXM/Lmxlbmd0aCkge1xuICAgIGNvbnN0IHsgZW50cnlQb2ludHM6IHN0eWxlc2hlZXRFbnRyeXBvaW50cywgbm9JbmplY3ROYW1lcyB9ID0gbm9ybWFsaXplR2xvYmFsU3R5bGVzKFxuICAgICAgb3B0aW9ucy5zdHlsZXMgfHwgW10sXG4gICAgKTtcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBmaWxlc10gb2YgT2JqZWN0LmVudHJpZXMoc3R5bGVzaGVldEVudHJ5cG9pbnRzKSkge1xuICAgICAgZ2xvYmFsU3R5bGVzLnB1c2goeyBuYW1lLCBmaWxlcywgaW5pdGlhbDogIW5vSW5qZWN0TmFtZXMuaW5jbHVkZXMobmFtZSkgfSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZ2xvYmFsU2NyaXB0czogeyBuYW1lOiBzdHJpbmc7IGZpbGVzOiBzdHJpbmdbXTsgaW5pdGlhbDogYm9vbGVhbiB9W10gPSBbXTtcbiAgaWYgKG9wdGlvbnMuc2NyaXB0cz8ubGVuZ3RoKSB7XG4gICAgZm9yIChjb25zdCB7IGJ1bmRsZU5hbWUsIHBhdGhzLCBpbmplY3QgfSBvZiBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lKG9wdGlvbnMuc2NyaXB0cykpIHtcbiAgICAgIGdsb2JhbFNjcmlwdHMucHVzaCh7IG5hbWU6IGJ1bmRsZU5hbWUsIGZpbGVzOiBwYXRocywgaW5pdGlhbDogaW5qZWN0IH0pO1xuICAgIH1cbiAgfVxuXG4gIGxldCB0YWlsd2luZENvbmZpZ3VyYXRpb246IHsgZmlsZTogc3RyaW5nOyBwYWNrYWdlOiBzdHJpbmcgfSB8IHVuZGVmaW5lZDtcbiAgY29uc3QgdGFpbHdpbmRDb25maWd1cmF0aW9uUGF0aCA9IGF3YWl0IGZpbmRUYWlsd2luZENvbmZpZ3VyYXRpb25GaWxlKHdvcmtzcGFjZVJvb3QsIHByb2plY3RSb290KTtcbiAgaWYgKHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgpIHtcbiAgICAvLyBDcmVhdGUgYSBub2RlIHJlc29sdmVyIGF0IHRoZSBwcm9qZWN0IHJvb3QgYXMgYSBkaXJlY3RvcnlcbiAgICBjb25zdCByZXNvbHZlciA9IGNyZWF0ZVJlcXVpcmUocHJvamVjdFJvb3QgKyAnLycpO1xuICAgIHRyeSB7XG4gICAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24gPSB7XG4gICAgICAgIGZpbGU6IHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgsXG4gICAgICAgIHBhY2thZ2U6IHJlc29sdmVyLnJlc29sdmUoJ3RhaWx3aW5kY3NzJyksXG4gICAgICB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29uc3QgcmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGggPSBwYXRoLnJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgpO1xuICAgICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgYFRhaWx3aW5kIENTUyBjb25maWd1cmF0aW9uIGZpbGUgZm91bmQgKCR7cmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGh9KWAgK1xuICAgICAgICAgIGAgYnV0IHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UgaXMgbm90IGluc3RhbGxlZC5gICtcbiAgICAgICAgICBgIFRvIGVuYWJsZSBUYWlsd2luZCBDU1MsIHBsZWFzZSBpbnN0YWxsIHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UuYCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbGV0IGluZGV4SHRtbE9wdGlvbnM7XG4gIC8vIGluZGV4IGNhbiBuZXZlciBoYXZlIGEgdmFsdWUgb2YgYHRydWVgIGJ1dCBpbiB0aGUgc2NoZW1hIGl0J3Mgb2YgdHlwZSBgYm9vbGVhbmAuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucy5pbmRleCAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgaW5kZXhIdG1sT3B0aW9ucyA9IHtcbiAgICAgIGlucHV0OiBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgZ2V0SW5kZXhJbnB1dEZpbGUob3B0aW9ucy5pbmRleCkpLFxuICAgICAgLy8gVGhlIG91dHB1dCBmaWxlIHdpbGwgYmUgY3JlYXRlZCB3aXRoaW4gdGhlIGNvbmZpZ3VyZWQgb3V0cHV0IHBhdGhcbiAgICAgIG91dHB1dDogZ2V0SW5kZXhPdXRwdXRGaWxlKG9wdGlvbnMuaW5kZXgpLFxuICAgICAgLy8gVE9ETzogVXNlIGV4aXN0aW5nIGluZm9ybWF0aW9uIGZyb20gYWJvdmUgdG8gY3JlYXRlIHRoZSBpbnNlcnRpb24gb3JkZXJcbiAgICAgIGluc2VydGlvbk9yZGVyOiBnZW5lcmF0ZUVudHJ5UG9pbnRzKHtcbiAgICAgICAgc2NyaXB0czogb3B0aW9ucy5zY3JpcHRzID8/IFtdLFxuICAgICAgICBzdHlsZXM6IG9wdGlvbnMuc3R5bGVzID8/IFtdLFxuICAgICAgfSksXG4gICAgfTtcbiAgfVxuXG4gIGxldCBzZXJ2ZXJFbnRyeVBvaW50OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIGlmIChvcHRpb25zLnNlcnZlcikge1xuICAgIHNlcnZlckVudHJ5UG9pbnQgPSBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgb3B0aW9ucy5zZXJ2ZXIpO1xuICB9IGVsc2UgaWYgKG9wdGlvbnMuc2VydmVyID09PSAnJykge1xuICAgIHRocm93IG5ldyBFcnJvcignYHNlcnZlcmAgb3B0aW9uIGNhbm5vdCBiZSBhbiBlbXB0eSBzdHJpbmcuJyk7XG4gIH1cblxuICBsZXQgcHJlcmVuZGVyT3B0aW9ucztcbiAgaWYgKG9wdGlvbnMucHJlcmVuZGVyKSB7XG4gICAgY29uc3Qge1xuICAgICAgZGlzY292ZXJSb3V0ZXMgPSB0cnVlLFxuICAgICAgcm91dGVzID0gW10sXG4gICAgICByb3V0ZXNGaWxlID0gdW5kZWZpbmVkLFxuICAgIH0gPSBvcHRpb25zLnByZXJlbmRlciA9PT0gdHJ1ZSA/IHt9IDogb3B0aW9ucy5wcmVyZW5kZXI7XG5cbiAgICBwcmVyZW5kZXJPcHRpb25zID0ge1xuICAgICAgZGlzY292ZXJSb3V0ZXMsXG4gICAgICByb3V0ZXMsXG4gICAgICByb3V0ZXNGaWxlOiByb3V0ZXNGaWxlICYmIHBhdGguam9pbih3b3Jrc3BhY2VSb290LCByb3V0ZXNGaWxlKSxcbiAgICB9O1xuICB9XG5cbiAgbGV0IHNzck9wdGlvbnM7XG4gIGlmIChvcHRpb25zLnNzciA9PT0gdHJ1ZSkge1xuICAgIHNzck9wdGlvbnMgPSB7fTtcbiAgfSBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucy5zc3IgPT09ICdvYmplY3QnKSB7XG4gICAgY29uc3QgeyBlbnRyeSB9ID0gb3B0aW9ucy5zc3I7XG5cbiAgICBzc3JPcHRpb25zID0ge1xuICAgICAgZW50cnk6IGVudHJ5ICYmIHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBlbnRyeSksXG4gICAgfTtcbiAgfVxuXG4gIGxldCBhcHBTaGVsbE9wdGlvbnM7XG4gIGlmIChvcHRpb25zLmFwcFNoZWxsKSB7XG4gICAgYXBwU2hlbGxPcHRpb25zID0ge1xuICAgICAgcm91dGU6ICdzaGVsbCcsXG4gICAgfTtcbiAgfVxuXG4gIC8vIEluaXRpYWwgb3B0aW9ucyB0byBrZWVwXG4gIGNvbnN0IHtcbiAgICBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMsXG4gICAgYW90LFxuICAgIGJhc2VIcmVmLFxuICAgIGNyb3NzT3JpZ2luLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIGV4dHJhY3RMaWNlbnNlcyxcbiAgICBpbmxpbmVTdHlsZUxhbmd1YWdlID0gJ2NzcycsXG4gICAgb3V0RXh0ZW5zaW9uLFxuICAgIHNlcnZpY2VXb3JrZXIsXG4gICAgcG9sbCxcbiAgICBwb2x5ZmlsbHMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBzdGF0c0pzb24sXG4gICAgc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIHZlcmJvc2UsXG4gICAgd2F0Y2gsXG4gICAgcHJvZ3Jlc3MgPSB0cnVlLFxuICAgIGV4dGVybmFsUGFja2FnZXMsXG4gICAgZGVsZXRlT3V0cHV0UGF0aCxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgLy8gUmV0dXJuIGFsbCB0aGUgbm9ybWFsaXplZCBvcHRpb25zXG4gIHJldHVybiB7XG4gICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zOiAhIWFvdCxcbiAgICBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMsXG4gICAgYmFzZUhyZWYsXG4gICAgY2FjaGVPcHRpb25zLFxuICAgIGNyb3NzT3JpZ2luLFxuICAgIGRlbGV0ZU91dHB1dFBhdGgsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgZXh0cmFjdExpY2Vuc2VzLFxuICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgaml0OiAhYW90LFxuICAgIHN0YXRzOiAhIXN0YXRzSnNvbixcbiAgICBwb2x5ZmlsbHM6IHBvbHlmaWxscyA9PT0gdW5kZWZpbmVkIHx8IEFycmF5LmlzQXJyYXkocG9seWZpbGxzKSA/IHBvbHlmaWxscyA6IFtwb2x5ZmlsbHNdLFxuICAgIHBvbGwsXG4gICAgcHJvZ3Jlc3MsXG4gICAgZXh0ZXJuYWxQYWNrYWdlcyxcbiAgICAvLyBJZiBub3QgZXhwbGljaXRseSBzZXQsIGRlZmF1bHQgdG8gdGhlIE5vZGUuanMgcHJvY2VzcyBhcmd1bWVudFxuICAgIHByZXNlcnZlU3ltbGlua3M6IHByZXNlcnZlU3ltbGlua3MgPz8gcHJvY2Vzcy5leGVjQXJndi5pbmNsdWRlcygnLS1wcmVzZXJ2ZS1zeW1saW5rcycpLFxuICAgIHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucyxcbiAgICBzdWJyZXNvdXJjZUludGVncml0eSxcbiAgICBzZXJ2ZXJFbnRyeVBvaW50LFxuICAgIHByZXJlbmRlck9wdGlvbnMsXG4gICAgYXBwU2hlbGxPcHRpb25zLFxuICAgIHNzck9wdGlvbnMsXG4gICAgdmVyYm9zZSxcbiAgICB3YXRjaCxcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgb3V0cHV0UGF0aCxcbiAgICBvdXRFeHRlbnNpb24sXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB0c2NvbmZpZyxcbiAgICBwcm9qZWN0Um9vdCxcbiAgICBhc3NldHMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICBnbG9iYWxTdHlsZXMsXG4gICAgZ2xvYmFsU2NyaXB0cyxcbiAgICBzZXJ2aWNlV29ya2VyOlxuICAgICAgdHlwZW9mIHNlcnZpY2VXb3JrZXIgPT09ICdzdHJpbmcnID8gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIHNlcnZpY2VXb3JrZXIpIDogdW5kZWZpbmVkLFxuICAgIGluZGV4SHRtbE9wdGlvbnMsXG4gICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICAgIGkxOG5PcHRpb25zLFxuICB9O1xufVxuXG4vKipcbiAqIE5vcm1hbGl6ZSBlbnRyeSBwb2ludCBvcHRpb25zLiBUbyBtYWludGFpbiBjb21wYXRpYmlsaXR5IHdpdGggdGhlIGxlZ2FjeSBicm93c2VyIGJ1aWxkZXIsIHdlIG5lZWQgYSBzaW5nbGUgYGJyb3dzZXJgXG4gKiBvcHRpb24gd2hpY2ggZGVmaW5lcyBhIHNpbmdsZSBlbnRyeSBwb2ludC4gSG93ZXZlciwgd2UgYWxzbyB3YW50IHRvIHN1cHBvcnQgbXVsdGlwbGUgZW50cnkgcG9pbnRzIGFzIGFuIGludGVybmFsIG9wdGlvbi5cbiAqIFRoZSB0d28gb3B0aW9ucyBhcmUgbXV0dWFsbHkgZXhjbHVzaXZlIGFuZCBpZiBgYnJvd3NlcmAgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkIGFzIHRoZSBzb2xlIGVudHJ5IHBvaW50LlxuICogSWYgYGVudHJ5UG9pbnRzYCBhcmUgcHJvdmlkZWQsIHRoZXkgd2lsbCBiZSB1c2VkIGFzIHRoZSBzZXQgb2YgZW50cnkgcG9pbnRzLlxuICpcbiAqIEBwYXJhbSB3b3Jrc3BhY2VSb290IFBhdGggdG8gdGhlIHJvb3Qgb2YgdGhlIEFuZ3VsYXIgd29ya3NwYWNlLlxuICogQHBhcmFtIGJyb3dzZXIgVGhlIGBicm93c2VyYCBvcHRpb24gcG9pbnRpbmcgYXQgdGhlIGFwcGxpY2F0aW9uIGVudHJ5IHBvaW50LiBXaGlsZSByZXF1aXJlZCBwZXIgdGhlIHNjaGVtYSBmaWxlLCBpdCBtYXkgYmUgb21pdHRlZCBieVxuICogICAgIHByb2dyYW1tYXRpYyB1c2FnZXMgb2YgYGJyb3dzZXItZXNidWlsZGAuXG4gKiBAcGFyYW0gZW50cnlQb2ludHMgU2V0IG9mIGVudHJ5IHBvaW50cyB0byB1c2UgaWYgcHJvdmlkZWQuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgbWFwcGluZyBlbnRyeSBwb2ludCBuYW1lcyB0byB0aGVpciBmaWxlIHBhdGhzLlxuICovXG5mdW5jdGlvbiBub3JtYWxpemVFbnRyeVBvaW50cyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBicm93c2VyOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gIGVudHJ5UG9pbnRzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKSxcbik6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4ge1xuICBpZiAoYnJvd3NlciA9PT0gJycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Bicm93c2VyYCBvcHRpb24gY2Fubm90IGJlIGFuIGVtcHR5IHN0cmluZy4nKTtcbiAgfVxuXG4gIC8vIGBicm93c2VyYCBhbmQgYGVudHJ5UG9pbnRzYCBhcmUgbXV0dWFsbHkgZXhjbHVzaXZlLlxuICBpZiAoYnJvd3NlciAmJiBlbnRyeVBvaW50cy5zaXplID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignT25seSBvbmUgb2YgYGJyb3dzZXJgIG9yIGBlbnRyeVBvaW50c2AgbWF5IGJlIHByb3ZpZGVkLicpO1xuICB9XG4gIGlmICghYnJvd3NlciAmJiBlbnRyeVBvaW50cy5zaXplID09PSAwKSB7XG4gICAgLy8gU2NoZW1hIHNob3VsZCBub3JtYWxseSByZWplY3QgdGhpcyBjYXNlLCBidXQgcHJvZ3JhbW1hdGljIHVzYWdlcyBvZiB0aGUgYnVpbGRlciBtaWdodCBtYWtlIHRoaXMgbWlzdGFrZS5cbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0VpdGhlciBgYnJvd3NlcmAgb3IgYXQgbGVhc3Qgb25lIGBlbnRyeVBvaW50c2AgdmFsdWUgbXVzdCBiZSBwcm92aWRlZC4nKTtcbiAgfVxuXG4gIC8vIFNjaGVtYSB0eXBlcyBmb3JjZSBgYnJvd3NlcmAgdG8gYWx3YXlzIGJlIHByb3ZpZGVkLCBidXQgaXQgbWF5IGJlIG9taXR0ZWQgd2hlbiB0aGUgYnVpbGRlciBpcyBpbnZva2VkIHByb2dyYW1tYXRpY2FsbHkuXG4gIGlmIChicm93c2VyKSB7XG4gICAgLy8gVXNlIGBicm93c2VyYCBhbG9uZS5cbiAgICByZXR1cm4geyAnbWFpbic6IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBicm93c2VyKSB9O1xuICB9IGVsc2Uge1xuICAgIC8vIFVzZSBgZW50cnlQb2ludHNgIGFsb25lLlxuICAgIGNvbnN0IGVudHJ5UG9pbnRQYXRoczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICAgIGZvciAoY29uc3QgZW50cnlQb2ludCBvZiBlbnRyeVBvaW50cykge1xuICAgICAgY29uc3QgcGFyc2VkRW50cnlQb2ludCA9IHBhdGgucGFyc2UoZW50cnlQb2ludCk7XG5cbiAgICAgIC8vIFVzZSB0aGUgaW5wdXQgZmlsZSBwYXRoIHdpdGhvdXQgYW4gZXh0ZW5zaW9uIGFzIHRoZSBcIm5hbWVcIiBvZiB0aGUgZW50cnkgcG9pbnQgZGljdGF0aW5nIGl0cyBvdXRwdXQgbG9jYXRpb24uXG4gICAgICAvLyBSZWxhdGl2ZSBlbnRyeSBwb2ludHMgYXJlIGdlbmVyYXRlZCBhdCB0aGUgc2FtZSByZWxhdGl2ZSBwYXRoIGluIHRoZSBvdXRwdXQgZGlyZWN0b3J5LlxuICAgICAgLy8gQWJzb2x1dGUgZW50cnkgcG9pbnRzIGFyZSBhbHdheXMgZ2VuZXJhdGVkIHdpdGggdGhlIHNhbWUgZmlsZSBuYW1lIGluIHRoZSByb290IG9mIHRoZSBvdXRwdXQgZGlyZWN0b3J5LiBUaGlzIGluY2x1ZGVzIGFic29sdXRlXG4gICAgICAvLyBwYXRocyBwb2ludGluZyBhdCBmaWxlcyBhY3R1YWxseSB3aXRoaW4gdGhlIHdvcmtzcGFjZSByb290LlxuICAgICAgY29uc3QgZW50cnlQb2ludE5hbWUgPSBwYXRoLmlzQWJzb2x1dGUoZW50cnlQb2ludClcbiAgICAgICAgPyBwYXJzZWRFbnRyeVBvaW50Lm5hbWVcbiAgICAgICAgOiBwYXRoLmpvaW4ocGFyc2VkRW50cnlQb2ludC5kaXIsIHBhcnNlZEVudHJ5UG9pbnQubmFtZSk7XG5cbiAgICAgIC8vIEdldCB0aGUgZnVsbCBmaWxlIHBhdGggdG8gdGhlIGVudHJ5IHBvaW50IGlucHV0LlxuICAgICAgY29uc3QgZW50cnlQb2ludFBhdGggPSBwYXRoLmlzQWJzb2x1dGUoZW50cnlQb2ludClcbiAgICAgICAgPyBlbnRyeVBvaW50XG4gICAgICAgIDogcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGVudHJ5UG9pbnQpO1xuXG4gICAgICAvLyBDaGVjayBmb3IgY29uZmxpY3RzIHdpdGggcHJldmlvdXMgZW50cnkgcG9pbnRzLlxuICAgICAgY29uc3QgZXhpc3RpbmdFbnRyeVBvaW50UGF0aCA9IGVudHJ5UG9pbnRQYXRoc1tlbnRyeVBvaW50TmFtZV07XG4gICAgICBpZiAoZXhpc3RpbmdFbnRyeVBvaW50UGF0aCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYFxcYCR7ZXhpc3RpbmdFbnRyeVBvaW50UGF0aH1cXGAgYW5kIFxcYCR7ZW50cnlQb2ludFBhdGh9XFxgIGJvdGggb3V0cHV0IHRvIHRoZSBzYW1lIGxvY2F0aW9uIFxcYCR7ZW50cnlQb2ludE5hbWV9XFxgLmAgK1xuICAgICAgICAgICAgJyBSZW5hbWUgb3IgbW92ZSBvbmUgb2YgdGhlIGZpbGVzIHRvIGZpeCB0aGUgY29uZmxpY3QuJyxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgZW50cnlQb2ludFBhdGhzW2VudHJ5UG9pbnROYW1lXSA9IGVudHJ5UG9pbnRQYXRoO1xuICAgIH1cblxuICAgIHJldHVybiBlbnRyeVBvaW50UGF0aHM7XG4gIH1cbn1cblxuLyoqXG4gKiBOb3JtYWxpemUgYSBkaXJlY3RvcnkgcGF0aCBzdHJpbmcuXG4gKiBDdXJyZW50bHkgb25seSByZW1vdmVzIGEgdHJhaWxpbmcgc2xhc2ggaWYgcHJlc2VudC5cbiAqIEBwYXJhbSBwYXRoIEEgcGF0aCBzdHJpbmcuXG4gKiBAcmV0dXJucyBBIG5vcm1hbGl6ZWQgcGF0aCBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZURpcmVjdG9yeVBhdGgocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgbGFzdCA9IHBhdGhbcGF0aC5sZW5ndGggLSAxXTtcbiAgaWYgKGxhc3QgPT09ICcvJyB8fCBsYXN0ID09PSAnXFxcXCcpIHtcbiAgICByZXR1cm4gcGF0aC5zbGljZSgwLCAtMSk7XG4gIH1cblxuICByZXR1cm4gcGF0aDtcbn1cbiJdfQ==