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
    let serverEntryPoint;
    if (options.server) {
        serverEntryPoint = node_path_1.default.join(workspaceRoot, options.server);
    }
    else if (options.server === '') {
        throw new Error('`server` option cannot be an empty string.');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL29wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsNkNBQTRDO0FBQzVDLDBEQUE2QjtBQUM3QiwrREFHMkM7QUFDM0MsdUNBQWlHO0FBQ2pHLGlFQUFvRTtBQUNwRSx1RUFBcUU7QUFDckUsbURBQXFFO0FBQ3JFLCtFQUEyRjtBQUMzRixxQ0FBOEU7QUFpQzlFOzs7Ozs7Ozs7R0FTRztBQUNJLEtBQUssVUFBVSxnQkFBZ0IsQ0FDcEMsT0FBdUIsRUFDdkIsV0FBbUIsRUFDbkIsT0FBMEM7SUFFMUMsTUFBTSxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUM1QyxNQUFNLGVBQWUsR0FBRyxNQUFNLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN0RSxNQUFNLFdBQVcsR0FBRyxzQkFBc0IsQ0FDeEMsbUJBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFHLGVBQWUsQ0FBQyxJQUEyQixJQUFJLEVBQUUsQ0FBQyxDQUM3RSxDQUFDO0lBQ0YsTUFBTSxpQkFBaUIsR0FBRyxzQkFBc0IsQ0FDOUMsbUJBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFHLGVBQWUsQ0FBQyxVQUFpQyxJQUFJLEtBQUssQ0FBQyxDQUN0RixDQUFDO0lBRUYsaUZBQWlGO0lBQ2pGLE1BQU0sWUFBWSxHQUFHLElBQUEsdUNBQXFCLEVBQUMsZUFBZSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQzNFLFlBQVksQ0FBQyxJQUFJLEdBQUcsbUJBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztJQUU5RCxNQUFNLFdBQVcsR0FBRyxv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QUFHLENBQUMsQ0FBQyxDQUFDO0lBQ25DLElBQUksSUFBSSxLQUFLLEdBQUcsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFO1FBQ2pDLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUMxQjtJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQge1xuICBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lLFxuICBub3JtYWxpemVHbG9iYWxTdHlsZXMsXG59IGZyb20gJy4uLy4uL3Rvb2xzL3dlYnBhY2svdXRpbHMvaGVscGVycyc7XG5pbXBvcnQgeyBub3JtYWxpemVBc3NldFBhdHRlcm5zLCBub3JtYWxpemVPcHRpbWl6YXRpb24sIG5vcm1hbGl6ZVNvdXJjZU1hcHMgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBub3JtYWxpemVDYWNoZU9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9ub3JtYWxpemUtY2FjaGUnO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cyB9IGZyb20gJy4uLy4uL3V0aWxzL3BhY2thZ2UtY2h1bmstc29ydCc7XG5pbXBvcnQgeyBmaW5kVGFpbHdpbmRDb25maWd1cmF0aW9uRmlsZSB9IGZyb20gJy4uLy4uL3V0aWxzL3RhaWx3aW5kJztcbmltcG9ydCB7IGdldEluZGV4SW5wdXRGaWxlLCBnZXRJbmRleE91dHB1dEZpbGUgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWJyb3dzZXItY29uZmlnJztcbmltcG9ydCB7IFNjaGVtYSBhcyBBcHBsaWNhdGlvbkJ1aWxkZXJPcHRpb25zLCBPdXRwdXRIYXNoaW5nIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5leHBvcnQgdHlwZSBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMgPSBBd2FpdGVkPFJldHVyblR5cGU8dHlwZW9mIG5vcm1hbGl6ZU9wdGlvbnM+PjtcblxuLyoqIEludGVybmFsIG9wdGlvbnMgaGlkZGVuIGZyb20gYnVpbGRlciBzY2hlbWEgYnV0IGF2YWlsYWJsZSB3aGVuIGludm9rZWQgcHJvZ3JhbW1hdGljYWxseS4gKi9cbmludGVyZmFjZSBJbnRlcm5hbE9wdGlvbnMge1xuICAvKipcbiAgICogRW50cnkgcG9pbnRzIHRvIHVzZSBmb3IgdGhlIGNvbXBpbGF0aW9uLiBJbmNvbXBhdGlibGUgd2l0aCBgYnJvd3NlcmAsIHdoaWNoIG11c3Qgbm90IGJlIHByb3ZpZGVkLiBNYXkgYmUgcmVsYXRpdmUgb3IgYWJzb2x1dGUgcGF0aHMuXG4gICAqIElmIGdpdmVuIGEgcmVsYXRpdmUgcGF0aCwgaXQgaXMgcmVzb2x2ZWQgcmVsYXRpdmUgdG8gdGhlIGN1cnJlbnQgd29ya3NwYWNlIGFuZCB3aWxsIGdlbmVyYXRlIGFuIG91dHB1dCBhdCB0aGUgc2FtZSByZWxhdGl2ZSBsb2NhdGlvblxuICAgKiBpbiB0aGUgb3V0cHV0IGRpcmVjdG9yeS4gSWYgZ2l2ZW4gYW4gYWJzb2x1dGUgcGF0aCwgdGhlIG91dHB1dCB3aWxsIGJlIGdlbmVyYXRlZCBpbiB0aGUgcm9vdCBvZiB0aGUgb3V0cHV0IGRpcmVjdG9yeSB3aXRoIHRoZSBzYW1lIGJhc2VcbiAgICogbmFtZS5cbiAgICovXG4gIGVudHJ5UG9pbnRzPzogU2V0PHN0cmluZz47XG5cbiAgLyoqIEZpbGUgZXh0ZW5zaW9uIHRvIHVzZSBmb3IgdGhlIGdlbmVyYXRlZCBvdXRwdXQgZmlsZXMuICovXG4gIG91dEV4dGVuc2lvbj86ICdqcycgfCAnbWpzJztcblxuICAvKipcbiAgICogSW5kaWNhdGVzIHdoZXRoZXIgYWxsIG5vZGUgcGFja2FnZXMgc2hvdWxkIGJlIG1hcmtlZCBhcyBleHRlcm5hbC5cbiAgICogQ3VycmVudGx5IHVzZWQgYnkgdGhlIGRldi1zZXJ2ZXIgdG8gc3VwcG9ydCBwcmVidW5kbGluZy5cbiAgICovXG4gIGV4dGVybmFsUGFja2FnZXM/OiBib29sZWFuO1xufVxuXG4vKiogRnVsbCBzZXQgb2Ygb3B0aW9ucyBmb3IgYGFwcGxpY2F0aW9uYCBidWlsZGVyLiAqL1xuZXhwb3J0IHR5cGUgQXBwbGljYXRpb25CdWlsZGVySW50ZXJuYWxPcHRpb25zID0gT21pdDxcbiAgQXBwbGljYXRpb25CdWlsZGVyT3B0aW9ucyAmIEludGVybmFsT3B0aW9ucyxcbiAgJ2Jyb3dzZXInXG4+ICYge1xuICAvLyBgYnJvd3NlcmAgY2FuIGJlIGB1bmRlZmluZWRgIGlmIGBlbnRyeVBvaW50c2AgaXMgdXNlZC5cbiAgYnJvd3Nlcj86IHN0cmluZztcbn07XG5cbi8qKlxuICogTm9ybWFsaXplIHRoZSB1c2VyIHByb3ZpZGVkIG9wdGlvbnMgYnkgY3JlYXRpbmcgZnVsbCBwYXRocyBmb3IgYWxsIHBhdGggYmFzZWQgb3B0aW9uc1xuICogYW5kIGNvbnZlcnRpbmcgbXVsdGktZm9ybSBvcHRpb25zIGludG8gYSBzaW5nbGUgZm9ybSB0aGF0IGNhbiBiZSBkaXJlY3RseSB1c2VkXG4gKiBieSB0aGUgYnVpbGQgcHJvY2Vzcy5cbiAqXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgY29udGV4dCBmb3IgY3VycmVudCBidWlsZGVyIGV4ZWN1dGlvbi5cbiAqIEBwYXJhbSBwcm9qZWN0TmFtZSBUaGUgbmFtZSBvZiB0aGUgcHJvamVjdCBmb3IgdGhlIGN1cnJlbnQgZXhlY3V0aW9uLlxuICogQHBhcmFtIG9wdGlvbnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIG9wdGlvbnMgdG8gdXNlIGZvciB0aGUgYnVpbGQuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyBub3JtYWxpemVkIG9wdGlvbnMgcmVxdWlyZWQgdG8gcGVyZm9ybSB0aGUgYnVpbGQuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBub3JtYWxpemVPcHRpb25zKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogQXBwbGljYXRpb25CdWlsZGVySW50ZXJuYWxPcHRpb25zLFxuKSB7XG4gIGNvbnN0IHdvcmtzcGFjZVJvb3QgPSBjb250ZXh0LndvcmtzcGFjZVJvb3Q7XG4gIGNvbnN0IHByb2plY3RNZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgY29uc3QgcHJvamVjdFJvb3QgPSBub3JtYWxpemVEaXJlY3RvcnlQYXRoKFxuICAgIHBhdGguam9pbih3b3Jrc3BhY2VSb290LCAocHJvamVjdE1ldGFkYXRhLnJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnJyksXG4gICk7XG4gIGNvbnN0IHByb2plY3RTb3VyY2VSb290ID0gbm9ybWFsaXplRGlyZWN0b3J5UGF0aChcbiAgICBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgKHByb2plY3RNZXRhZGF0YS5zb3VyY2VSb290IGFzIHN0cmluZyB8IHVuZGVmaW5lZCkgPz8gJ3NyYycpLFxuICApO1xuXG4gIC8vIEdhdGhlciBwZXJzaXN0ZW50IGNhY2hpbmcgb3B0aW9uIGFuZCBwcm92aWRlIGEgcHJvamVjdCBzcGVjaWZpYyBjYWNoZSBsb2NhdGlvblxuICBjb25zdCBjYWNoZU9wdGlvbnMgPSBub3JtYWxpemVDYWNoZU9wdGlvbnMocHJvamVjdE1ldGFkYXRhLCB3b3Jrc3BhY2VSb290KTtcbiAgY2FjaGVPcHRpb25zLnBhdGggPSBwYXRoLmpvaW4oY2FjaGVPcHRpb25zLnBhdGgsIHByb2plY3ROYW1lKTtcblxuICBjb25zdCBlbnRyeVBvaW50cyA9IG5vcm1hbGl6ZUVudHJ5UG9pbnRzKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMuYnJvd3Nlciwgb3B0aW9ucy5lbnRyeVBvaW50cyk7XG4gIGNvbnN0IHRzY29uZmlnID0gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMudHNDb25maWcpO1xuICBjb25zdCBvdXRwdXRQYXRoID0gbm9ybWFsaXplRGlyZWN0b3J5UGF0aChwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgb3B0aW9ucy5vdXRwdXRQYXRoKSk7XG4gIGNvbnN0IG9wdGltaXphdGlvbk9wdGlvbnMgPSBub3JtYWxpemVPcHRpbWl6YXRpb24ob3B0aW9ucy5vcHRpbWl6YXRpb24pO1xuICBjb25zdCBzb3VyY2VtYXBPcHRpb25zID0gbm9ybWFsaXplU291cmNlTWFwcyhvcHRpb25zLnNvdXJjZU1hcCA/PyBmYWxzZSk7XG4gIGNvbnN0IGFzc2V0cyA9IG9wdGlvbnMuYXNzZXRzPy5sZW5ndGhcbiAgICA/IG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMob3B0aW9ucy5hc3NldHMsIHdvcmtzcGFjZVJvb3QsIHByb2plY3RSb290LCBwcm9qZWN0U291cmNlUm9vdClcbiAgICA6IHVuZGVmaW5lZDtcblxuICBjb25zdCBvdXRwdXROYW1lcyA9IHtcbiAgICBidW5kbGVzOlxuICAgICAgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLkFsbCB8fCBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuQnVuZGxlc1xuICAgICAgICA/ICdbbmFtZV0uW2hhc2hdJ1xuICAgICAgICA6ICdbbmFtZV0nLFxuICAgIG1lZGlhOlxuICAgICAgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLkFsbCB8fCBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuTWVkaWFcbiAgICAgICAgPyAnW25hbWVdLltoYXNoXSdcbiAgICAgICAgOiAnW25hbWVdJyxcbiAgfTtcbiAgaWYgKG9wdGlvbnMucmVzb3VyY2VzT3V0cHV0UGF0aCkge1xuICAgIG91dHB1dE5hbWVzLm1lZGlhID0gcGF0aC5qb2luKG9wdGlvbnMucmVzb3VyY2VzT3V0cHV0UGF0aCwgb3V0cHV0TmFtZXMubWVkaWEpO1xuICB9XG5cbiAgbGV0IGZpbGVSZXBsYWNlbWVudHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfCB1bmRlZmluZWQ7XG4gIGlmIChvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpIHtcbiAgICBmb3IgKGNvbnN0IHJlcGxhY2VtZW50IG9mIG9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykge1xuICAgICAgZmlsZVJlcGxhY2VtZW50cyA/Pz0ge307XG4gICAgICBmaWxlUmVwbGFjZW1lbnRzW3BhdGguam9pbih3b3Jrc3BhY2VSb290LCByZXBsYWNlbWVudC5yZXBsYWNlKV0gPSBwYXRoLmpvaW4oXG4gICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIHJlcGxhY2VtZW50LndpdGgsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGdsb2JhbFN0eWxlczogeyBuYW1lOiBzdHJpbmc7IGZpbGVzOiBzdHJpbmdbXTsgaW5pdGlhbDogYm9vbGVhbiB9W10gPSBbXTtcbiAgaWYgKG9wdGlvbnMuc3R5bGVzPy5sZW5ndGgpIHtcbiAgICBjb25zdCB7IGVudHJ5UG9pbnRzOiBzdHlsZXNoZWV0RW50cnlwb2ludHMsIG5vSW5qZWN0TmFtZXMgfSA9IG5vcm1hbGl6ZUdsb2JhbFN0eWxlcyhcbiAgICAgIG9wdGlvbnMuc3R5bGVzIHx8IFtdLFxuICAgICk7XG4gICAgZm9yIChjb25zdCBbbmFtZSwgZmlsZXNdIG9mIE9iamVjdC5lbnRyaWVzKHN0eWxlc2hlZXRFbnRyeXBvaW50cykpIHtcbiAgICAgIGdsb2JhbFN0eWxlcy5wdXNoKHsgbmFtZSwgZmlsZXMsIGluaXRpYWw6ICFub0luamVjdE5hbWVzLmluY2x1ZGVzKG5hbWUpIH0pO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGdsb2JhbFNjcmlwdHM6IHsgbmFtZTogc3RyaW5nOyBmaWxlczogc3RyaW5nW107IGluaXRpYWw6IGJvb2xlYW4gfVtdID0gW107XG4gIGlmIChvcHRpb25zLnNjcmlwdHM/Lmxlbmd0aCkge1xuICAgIGZvciAoY29uc3QgeyBidW5kbGVOYW1lLCBwYXRocywgaW5qZWN0IH0gb2YgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZShvcHRpb25zLnNjcmlwdHMpKSB7XG4gICAgICBnbG9iYWxTY3JpcHRzLnB1c2goeyBuYW1lOiBidW5kbGVOYW1lLCBmaWxlczogcGF0aHMsIGluaXRpYWw6IGluamVjdCB9KTtcbiAgICB9XG4gIH1cblxuICBsZXQgdGFpbHdpbmRDb25maWd1cmF0aW9uOiB7IGZpbGU6IHN0cmluZzsgcGFja2FnZTogc3RyaW5nIH0gfCB1bmRlZmluZWQ7XG4gIGNvbnN0IHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGggPSBhd2FpdCBmaW5kVGFpbHdpbmRDb25maWd1cmF0aW9uRmlsZSh3b3Jrc3BhY2VSb290LCBwcm9qZWN0Um9vdCk7XG4gIGlmICh0YWlsd2luZENvbmZpZ3VyYXRpb25QYXRoKSB7XG4gICAgLy8gQ3JlYXRlIGEgbm9kZSByZXNvbHZlciBhdCB0aGUgcHJvamVjdCByb290IGFzIGEgZGlyZWN0b3J5XG4gICAgY29uc3QgcmVzb2x2ZXIgPSBjcmVhdGVSZXF1aXJlKHByb2plY3RSb290ICsgJy8nKTtcbiAgICB0cnkge1xuICAgICAgdGFpbHdpbmRDb25maWd1cmF0aW9uID0ge1xuICAgICAgICBmaWxlOiB0YWlsd2luZENvbmZpZ3VyYXRpb25QYXRoLFxuICAgICAgICBwYWNrYWdlOiByZXNvbHZlci5yZXNvbHZlKCd0YWlsd2luZGNzcycpLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGNvbnN0IHJlbGF0aXZlVGFpbHdpbmRDb25maWdQYXRoID0gcGF0aC5yZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCB0YWlsd2luZENvbmZpZ3VyYXRpb25QYXRoKTtcbiAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICAgIGBUYWlsd2luZCBDU1MgY29uZmlndXJhdGlvbiBmaWxlIGZvdW5kICgke3JlbGF0aXZlVGFpbHdpbmRDb25maWdQYXRofSlgICtcbiAgICAgICAgICBgIGJ1dCB0aGUgJ3RhaWx3aW5kY3NzJyBwYWNrYWdlIGlzIG5vdCBpbnN0YWxsZWQuYCArXG4gICAgICAgICAgYCBUbyBlbmFibGUgVGFpbHdpbmQgQ1NTLCBwbGVhc2UgaW5zdGFsbCB0aGUgJ3RhaWx3aW5kY3NzJyBwYWNrYWdlLmAsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGxldCBpbmRleEh0bWxPcHRpb25zO1xuICBpZiAob3B0aW9ucy5pbmRleCkge1xuICAgIGluZGV4SHRtbE9wdGlvbnMgPSB7XG4gICAgICBpbnB1dDogcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGdldEluZGV4SW5wdXRGaWxlKG9wdGlvbnMuaW5kZXgpKSxcbiAgICAgIC8vIFRoZSBvdXRwdXQgZmlsZSB3aWxsIGJlIGNyZWF0ZWQgd2l0aGluIHRoZSBjb25maWd1cmVkIG91dHB1dCBwYXRoXG4gICAgICBvdXRwdXQ6IGdldEluZGV4T3V0cHV0RmlsZShvcHRpb25zLmluZGV4KSxcbiAgICAgIC8vIFRPRE86IFVzZSBleGlzdGluZyBpbmZvcm1hdGlvbiBmcm9tIGFib3ZlIHRvIGNyZWF0ZSB0aGUgaW5zZXJ0aW9uIG9yZGVyXG4gICAgICBpbnNlcnRpb25PcmRlcjogZ2VuZXJhdGVFbnRyeVBvaW50cyh7XG4gICAgICAgIHNjcmlwdHM6IG9wdGlvbnMuc2NyaXB0cyA/PyBbXSxcbiAgICAgICAgc3R5bGVzOiBvcHRpb25zLnN0eWxlcyA/PyBbXSxcbiAgICAgIH0pLFxuICAgIH07XG4gIH1cblxuICBsZXQgc2VydmVyRW50cnlQb2ludDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBpZiAob3B0aW9ucy5zZXJ2ZXIpIHtcbiAgICBzZXJ2ZXJFbnRyeVBvaW50ID0gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMuc2VydmVyKTtcbiAgfSBlbHNlIGlmIChvcHRpb25zLnNlcnZlciA9PT0gJycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2BzZXJ2ZXJgIG9wdGlvbiBjYW5ub3QgYmUgYW4gZW1wdHkgc3RyaW5nLicpO1xuICB9XG5cbiAgLy8gSW5pdGlhbCBvcHRpb25zIHRvIGtlZXBcbiAgY29uc3Qge1xuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICBhb3QsXG4gICAgYmFzZUhyZWYsXG4gICAgY3Jvc3NPcmlnaW4sXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgZXh0cmFjdExpY2Vuc2VzLFxuICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UgPSAnY3NzJyxcbiAgICBvdXRFeHRlbnNpb24sXG4gICAgc2VydmljZVdvcmtlcixcbiAgICBwb2xsLFxuICAgIHBvbHlmaWxscyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHN0YXRzSnNvbixcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgdmVyYm9zZSxcbiAgICB3YXRjaCxcbiAgICBwcm9ncmVzcyA9IHRydWUsXG4gICAgZXh0ZXJuYWxQYWNrYWdlcyxcbiAgICBkZWxldGVPdXRwdXRQYXRoLFxuICB9ID0gb3B0aW9ucztcblxuICAvLyBSZXR1cm4gYWxsIHRoZSBub3JtYWxpemVkIG9wdGlvbnNcbiAgcmV0dXJuIHtcbiAgICBhZHZhbmNlZE9wdGltaXphdGlvbnM6ICEhYW90LFxuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICBiYXNlSHJlZixcbiAgICBjYWNoZU9wdGlvbnMsXG4gICAgY3Jvc3NPcmlnaW4sXG4gICAgZGVsZXRlT3V0cHV0UGF0aCxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBleHRyYWN0TGljZW5zZXMsXG4gICAgaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICBqaXQ6ICFhb3QsXG4gICAgc3RhdHM6ICEhc3RhdHNKc29uLFxuICAgIHBvbHlmaWxsczogcG9seWZpbGxzID09PSB1bmRlZmluZWQgfHwgQXJyYXkuaXNBcnJheShwb2x5ZmlsbHMpID8gcG9seWZpbGxzIDogW3BvbHlmaWxsc10sXG4gICAgcG9sbCxcbiAgICBwcm9ncmVzcyxcbiAgICBleHRlcm5hbFBhY2thZ2VzLFxuICAgIC8vIElmIG5vdCBleHBsaWNpdGx5IHNldCwgZGVmYXVsdCB0byB0aGUgTm9kZS5qcyBwcm9jZXNzIGFyZ3VtZW50XG4gICAgcHJlc2VydmVTeW1saW5rczogcHJlc2VydmVTeW1saW5rcyA/PyBwcm9jZXNzLmV4ZWNBcmd2LmluY2x1ZGVzKCctLXByZXNlcnZlLXN5bWxpbmtzJyksXG4gICAgc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIHNlcnZlckVudHJ5UG9pbnQsXG4gICAgdmVyYm9zZSxcbiAgICB3YXRjaCxcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgb3V0cHV0UGF0aCxcbiAgICBvdXRFeHRlbnNpb24sXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB0c2NvbmZpZyxcbiAgICBwcm9qZWN0Um9vdCxcbiAgICBhc3NldHMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICBnbG9iYWxTdHlsZXMsXG4gICAgZ2xvYmFsU2NyaXB0cyxcbiAgICBzZXJ2aWNlV29ya2VyLFxuICAgIGluZGV4SHRtbE9wdGlvbnMsXG4gICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICB9O1xufVxuXG4vKipcbiAqIE5vcm1hbGl6ZSBlbnRyeSBwb2ludCBvcHRpb25zLiBUbyBtYWludGFpbiBjb21wYXRpYmlsaXR5IHdpdGggdGhlIGxlZ2FjeSBicm93c2VyIGJ1aWxkZXIsIHdlIG5lZWQgYSBzaW5nbGUgYGJyb3dzZXJgXG4gKiBvcHRpb24gd2hpY2ggZGVmaW5lcyBhIHNpbmdsZSBlbnRyeSBwb2ludC4gSG93ZXZlciwgd2UgYWxzbyB3YW50IHRvIHN1cHBvcnQgbXVsdGlwbGUgZW50cnkgcG9pbnRzIGFzIGFuIGludGVybmFsIG9wdGlvbi5cbiAqIFRoZSB0d28gb3B0aW9ucyBhcmUgbXV0dWFsbHkgZXhjbHVzaXZlIGFuZCBpZiBgYnJvd3NlcmAgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkIGFzIHRoZSBzb2xlIGVudHJ5IHBvaW50LlxuICogSWYgYGVudHJ5UG9pbnRzYCBhcmUgcHJvdmlkZWQsIHRoZXkgd2lsbCBiZSB1c2VkIGFzIHRoZSBzZXQgb2YgZW50cnkgcG9pbnRzLlxuICpcbiAqIEBwYXJhbSB3b3Jrc3BhY2VSb290IFBhdGggdG8gdGhlIHJvb3Qgb2YgdGhlIEFuZ3VsYXIgd29ya3NwYWNlLlxuICogQHBhcmFtIGJyb3dzZXIgVGhlIGBicm93c2VyYCBvcHRpb24gcG9pbnRpbmcgYXQgdGhlIGFwcGxpY2F0aW9uIGVudHJ5IHBvaW50LiBXaGlsZSByZXF1aXJlZCBwZXIgdGhlIHNjaGVtYSBmaWxlLCBpdCBtYXkgYmUgb21pdHRlZCBieVxuICogICAgIHByb2dyYW1tYXRpYyB1c2FnZXMgb2YgYGJyb3dzZXItZXNidWlsZGAuXG4gKiBAcGFyYW0gZW50cnlQb2ludHMgU2V0IG9mIGVudHJ5IHBvaW50cyB0byB1c2UgaWYgcHJvdmlkZWQuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgbWFwcGluZyBlbnRyeSBwb2ludCBuYW1lcyB0byB0aGVpciBmaWxlIHBhdGhzLlxuICovXG5mdW5jdGlvbiBub3JtYWxpemVFbnRyeVBvaW50cyhcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBicm93c2VyOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gIGVudHJ5UG9pbnRzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKSxcbik6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4ge1xuICBpZiAoYnJvd3NlciA9PT0gJycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Bicm93c2VyYCBvcHRpb24gY2Fubm90IGJlIGFuIGVtcHR5IHN0cmluZy4nKTtcbiAgfVxuXG4gIC8vIGBicm93c2VyYCBhbmQgYGVudHJ5UG9pbnRzYCBhcmUgbXV0dWFsbHkgZXhjbHVzaXZlLlxuICBpZiAoYnJvd3NlciAmJiBlbnRyeVBvaW50cy5zaXplID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignT25seSBvbmUgb2YgYGJyb3dzZXJgIG9yIGBlbnRyeVBvaW50c2AgbWF5IGJlIHByb3ZpZGVkLicpO1xuICB9XG4gIGlmICghYnJvd3NlciAmJiBlbnRyeVBvaW50cy5zaXplID09PSAwKSB7XG4gICAgLy8gU2NoZW1hIHNob3VsZCBub3JtYWxseSByZWplY3QgdGhpcyBjYXNlLCBidXQgcHJvZ3JhbW1hdGljIHVzYWdlcyBvZiB0aGUgYnVpbGRlciBtaWdodCBtYWtlIHRoaXMgbWlzdGFrZS5cbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0VpdGhlciBgYnJvd3NlcmAgb3IgYXQgbGVhc3Qgb25lIGBlbnRyeVBvaW50c2AgdmFsdWUgbXVzdCBiZSBwcm92aWRlZC4nKTtcbiAgfVxuXG4gIC8vIFNjaGVtYSB0eXBlcyBmb3JjZSBgYnJvd3NlcmAgdG8gYWx3YXlzIGJlIHByb3ZpZGVkLCBidXQgaXQgbWF5IGJlIG9taXR0ZWQgd2hlbiB0aGUgYnVpbGRlciBpcyBpbnZva2VkIHByb2dyYW1tYXRpY2FsbHkuXG4gIGlmIChicm93c2VyKSB7XG4gICAgLy8gVXNlIGBicm93c2VyYCBhbG9uZS5cbiAgICByZXR1cm4geyAnbWFpbic6IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBicm93c2VyKSB9O1xuICB9IGVsc2Uge1xuICAgIC8vIFVzZSBgZW50cnlQb2ludHNgIGFsb25lLlxuICAgIGNvbnN0IGVudHJ5UG9pbnRQYXRoczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICAgIGZvciAoY29uc3QgZW50cnlQb2ludCBvZiBlbnRyeVBvaW50cykge1xuICAgICAgY29uc3QgcGFyc2VkRW50cnlQb2ludCA9IHBhdGgucGFyc2UoZW50cnlQb2ludCk7XG5cbiAgICAgIC8vIFVzZSB0aGUgaW5wdXQgZmlsZSBwYXRoIHdpdGhvdXQgYW4gZXh0ZW5zaW9uIGFzIHRoZSBcIm5hbWVcIiBvZiB0aGUgZW50cnkgcG9pbnQgZGljdGF0aW5nIGl0cyBvdXRwdXQgbG9jYXRpb24uXG4gICAgICAvLyBSZWxhdGl2ZSBlbnRyeSBwb2ludHMgYXJlIGdlbmVyYXRlZCBhdCB0aGUgc2FtZSByZWxhdGl2ZSBwYXRoIGluIHRoZSBvdXRwdXQgZGlyZWN0b3J5LlxuICAgICAgLy8gQWJzb2x1dGUgZW50cnkgcG9pbnRzIGFyZSBhbHdheXMgZ2VuZXJhdGVkIHdpdGggdGhlIHNhbWUgZmlsZSBuYW1lIGluIHRoZSByb290IG9mIHRoZSBvdXRwdXQgZGlyZWN0b3J5LiBUaGlzIGluY2x1ZGVzIGFic29sdXRlXG4gICAgICAvLyBwYXRocyBwb2ludGluZyBhdCBmaWxlcyBhY3R1YWxseSB3aXRoaW4gdGhlIHdvcmtzcGFjZSByb290LlxuICAgICAgY29uc3QgZW50cnlQb2ludE5hbWUgPSBwYXRoLmlzQWJzb2x1dGUoZW50cnlQb2ludClcbiAgICAgICAgPyBwYXJzZWRFbnRyeVBvaW50Lm5hbWVcbiAgICAgICAgOiBwYXRoLmpvaW4ocGFyc2VkRW50cnlQb2ludC5kaXIsIHBhcnNlZEVudHJ5UG9pbnQubmFtZSk7XG5cbiAgICAgIC8vIEdldCB0aGUgZnVsbCBmaWxlIHBhdGggdG8gdGhlIGVudHJ5IHBvaW50IGlucHV0LlxuICAgICAgY29uc3QgZW50cnlQb2ludFBhdGggPSBwYXRoLmlzQWJzb2x1dGUoZW50cnlQb2ludClcbiAgICAgICAgPyBlbnRyeVBvaW50XG4gICAgICAgIDogcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGVudHJ5UG9pbnQpO1xuXG4gICAgICAvLyBDaGVjayBmb3IgY29uZmxpY3RzIHdpdGggcHJldmlvdXMgZW50cnkgcG9pbnRzLlxuICAgICAgY29uc3QgZXhpc3RpbmdFbnRyeVBvaW50UGF0aCA9IGVudHJ5UG9pbnRQYXRoc1tlbnRyeVBvaW50TmFtZV07XG4gICAgICBpZiAoZXhpc3RpbmdFbnRyeVBvaW50UGF0aCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYFxcYCR7ZXhpc3RpbmdFbnRyeVBvaW50UGF0aH1cXGAgYW5kIFxcYCR7ZW50cnlQb2ludFBhdGh9XFxgIGJvdGggb3V0cHV0IHRvIHRoZSBzYW1lIGxvY2F0aW9uIFxcYCR7ZW50cnlQb2ludE5hbWV9XFxgLmAgK1xuICAgICAgICAgICAgJyBSZW5hbWUgb3IgbW92ZSBvbmUgb2YgdGhlIGZpbGVzIHRvIGZpeCB0aGUgY29uZmxpY3QuJyxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgZW50cnlQb2ludFBhdGhzW2VudHJ5UG9pbnROYW1lXSA9IGVudHJ5UG9pbnRQYXRoO1xuICAgIH1cblxuICAgIHJldHVybiBlbnRyeVBvaW50UGF0aHM7XG4gIH1cbn1cblxuLyoqXG4gKiBOb3JtYWxpemUgYSBkaXJlY3RvcnkgcGF0aCBzdHJpbmcuXG4gKiBDdXJyZW50bHkgb25seSByZW1vdmVzIGEgdHJhaWxpbmcgc2xhc2ggaWYgcHJlc2VudC5cbiAqIEBwYXJhbSBwYXRoIEEgcGF0aCBzdHJpbmcuXG4gKiBAcmV0dXJucyBBIG5vcm1hbGl6ZWQgcGF0aCBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZURpcmVjdG9yeVBhdGgocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgbGFzdCA9IHBhdGhbcGF0aC5sZW5ndGggLSAxXTtcbiAgaWYgKGxhc3QgPT09ICcvJyB8fCBsYXN0ID09PSAnXFxcXCcpIHtcbiAgICByZXR1cm4gcGF0aC5zbGljZSgwLCAtMSk7XG4gIH1cblxuICByZXR1cm4gcGF0aDtcbn1cbiJdfQ==