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
    else if (typeof options.ssr === 'string') {
        ssrOptions = {
            entry: node_path_1.default.join(workspaceRoot, options.ssr),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL29wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsNkNBQTRDO0FBQzVDLDBEQUE2QjtBQUM3QiwrREFHMkM7QUFDM0MsdUNBQWlHO0FBQ2pHLDJEQUEwRTtBQUMxRSxpRUFBb0U7QUFDcEUsdUVBQXFFO0FBQ3JFLG1EQUFxRTtBQUNyRSwrRUFBMkY7QUFDM0YscUNBQStGO0FBaUMvRjs7Ozs7Ozs7O0dBU0c7QUFDSCxrREFBa0Q7QUFDM0MsS0FBSyxVQUFVLGdCQUFnQixDQUNwQyxPQUF1QixFQUN2QixXQUFtQixFQUNuQixPQUEwQztJQUUxQyxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDO0lBQzVDLE1BQU0sZUFBZSxHQUFHLE1BQU0sT0FBTyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3RFLE1BQU0sV0FBVyxHQUFHLHNCQUFzQixDQUN4QyxtQkFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUcsZUFBZSxDQUFDLElBQTJCLElBQUksRUFBRSxDQUFDLENBQzdFLENBQUM7SUFDRixNQUFNLGlCQUFpQixHQUFHLHNCQUFzQixDQUM5QyxtQkFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUcsZUFBZSxDQUFDLFVBQWlDLElBQUksS0FBSyxDQUFDLENBQ3RGLENBQUM7SUFFRixpRkFBaUY7SUFDakYsTUFBTSxZQUFZLEdBQUcsSUFBQSx1Q0FBcUIsRUFBQyxlQUFlLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDM0UsWUFBWSxDQUFDLElBQUksR0FBRyxtQkFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxD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QUMsQ0FBQyxDQUFDO0lBQ25DLElBQUksSUFBSSxLQUFLLEdBQUcsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFO1FBQ2pDLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUMxQjtJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQge1xuICBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lLFxuICBub3JtYWxpemVHbG9iYWxTdHlsZXMsXG59IGZyb20gJy4uLy4uL3Rvb2xzL3dlYnBhY2svdXRpbHMvaGVscGVycyc7XG5pbXBvcnQgeyBub3JtYWxpemVBc3NldFBhdHRlcm5zLCBub3JtYWxpemVPcHRpbWl6YXRpb24sIG5vcm1hbGl6ZVNvdXJjZU1hcHMgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBJMThuT3B0aW9ucywgY3JlYXRlSTE4bk9wdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgbm9ybWFsaXplQ2FjaGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvbm9ybWFsaXplLWNhY2hlJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMgfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgZmluZFRhaWx3aW5kQ29uZmlndXJhdGlvbkZpbGUgfSBmcm9tICcuLi8uLi91dGlscy90YWlsd2luZCc7XG5pbXBvcnQgeyBnZXRJbmRleElucHV0RmlsZSwgZ2V0SW5kZXhPdXRwdXRGaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1icm93c2VyLWNvbmZpZyc7XG5pbXBvcnQgeyBTY2hlbWEgYXMgQXBwbGljYXRpb25CdWlsZGVyT3B0aW9ucywgSTE4TlRyYW5zbGF0aW9uLCBPdXRwdXRIYXNoaW5nIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG5leHBvcnQgdHlwZSBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMgPSBBd2FpdGVkPFJldHVyblR5cGU8dHlwZW9mIG5vcm1hbGl6ZU9wdGlvbnM+PjtcblxuLyoqIEludGVybmFsIG9wdGlvbnMgaGlkZGVuIGZyb20gYnVpbGRlciBzY2hlbWEgYnV0IGF2YWlsYWJsZSB3aGVuIGludm9rZWQgcHJvZ3JhbW1hdGljYWxseS4gKi9cbmludGVyZmFjZSBJbnRlcm5hbE9wdGlvbnMge1xuICAvKipcbiAgICogRW50cnkgcG9pbnRzIHRvIHVzZSBmb3IgdGhlIGNvbXBpbGF0aW9uLiBJbmNvbXBhdGlibGUgd2l0aCBgYnJvd3NlcmAsIHdoaWNoIG11c3Qgbm90IGJlIHByb3ZpZGVkLiBNYXkgYmUgcmVsYXRpdmUgb3IgYWJzb2x1dGUgcGF0aHMuXG4gICAqIElmIGdpdmVuIGEgcmVsYXRpdmUgcGF0aCwgaXQgaXMgcmVzb2x2ZWQgcmVsYXRpdmUgdG8gdGhlIGN1cnJlbnQgd29ya3NwYWNlIGFuZCB3aWxsIGdlbmVyYXRlIGFuIG91dHB1dCBhdCB0aGUgc2FtZSByZWxhdGl2ZSBsb2NhdGlvblxuICAgKiBpbiB0aGUgb3V0cHV0IGRpcmVjdG9yeS4gSWYgZ2l2ZW4gYW4gYWJzb2x1dGUgcGF0aCwgdGhlIG91dHB1dCB3aWxsIGJlIGdlbmVyYXRlZCBpbiB0aGUgcm9vdCBvZiB0aGUgb3V0cHV0IGRpcmVjdG9yeSB3aXRoIHRoZSBzYW1lIGJhc2VcbiAgICogbmFtZS5cbiAgICovXG4gIGVudHJ5UG9pbnRzPzogU2V0PHN0cmluZz47XG5cbiAgLyoqIEZpbGUgZXh0ZW5zaW9uIHRvIHVzZSBmb3IgdGhlIGdlbmVyYXRlZCBvdXRwdXQgZmlsZXMuICovXG4gIG91dEV4dGVuc2lvbj86ICdqcycgfCAnbWpzJztcblxuICAvKipcbiAgICogSW5kaWNhdGVzIHdoZXRoZXIgYWxsIG5vZGUgcGFja2FnZXMgc2hvdWxkIGJlIG1hcmtlZCBhcyBleHRlcm5hbC5cbiAgICogQ3VycmVudGx5IHVzZWQgYnkgdGhlIGRldi1zZXJ2ZXIgdG8gc3VwcG9ydCBwcmVidW5kbGluZy5cbiAgICovXG4gIGV4dGVybmFsUGFja2FnZXM/OiBib29sZWFuO1xufVxuXG4vKiogRnVsbCBzZXQgb2Ygb3B0aW9ucyBmb3IgYGFwcGxpY2F0aW9uYCBidWlsZGVyLiAqL1xuZXhwb3J0IHR5cGUgQXBwbGljYXRpb25CdWlsZGVySW50ZXJuYWxPcHRpb25zID0gT21pdDxcbiAgQXBwbGljYXRpb25CdWlsZGVyT3B0aW9ucyAmIEludGVybmFsT3B0aW9ucyxcbiAgJ2Jyb3dzZXInXG4+ICYge1xuICAvLyBgYnJvd3NlcmAgY2FuIGJlIGB1bmRlZmluZWRgIGlmIGBlbnRyeVBvaW50c2AgaXMgdXNlZC5cbiAgYnJvd3Nlcj86IHN0cmluZztcbn07XG5cbi8qKlxuICogTm9ybWFsaXplIHRoZSB1c2VyIHByb3ZpZGVkIG9wdGlvbnMgYnkgY3JlYXRpbmcgZnVsbCBwYXRocyBmb3IgYWxsIHBhdGggYmFzZWQgb3B0aW9uc1xuICogYW5kIGNvbnZlcnRpbmcgbXVsdGktZm9ybSBvcHRpb25zIGludG8gYSBzaW5nbGUgZm9ybSB0aGF0IGNhbiBiZSBkaXJlY3RseSB1c2VkXG4gKiBieSB0aGUgYnVpbGQgcHJvY2Vzcy5cbiAqXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgY29udGV4dCBmb3IgY3VycmVudCBidWlsZGVyIGV4ZWN1dGlvbi5cbiAqIEBwYXJhbSBwcm9qZWN0TmFtZSBUaGUgbmFtZSBvZiB0aGUgcHJvamVjdCBmb3IgdGhlIGN1cnJlbnQgZXhlY3V0aW9uLlxuICogQHBhcmFtIG9wdGlvbnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIG9wdGlvbnMgdG8gdXNlIGZvciB0aGUgYnVpbGQuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyBub3JtYWxpemVkIG9wdGlvbnMgcmVxdWlyZWQgdG8gcGVyZm9ybSB0aGUgYnVpbGQuXG4gKi9cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbm9ybWFsaXplT3B0aW9ucyhcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gIG9wdGlvbnM6IEFwcGxpY2F0aW9uQnVpbGRlckludGVybmFsT3B0aW9ucyxcbikge1xuICBjb25zdCB3b3Jrc3BhY2VSb290ID0gY29udGV4dC53b3Jrc3BhY2VSb290O1xuICBjb25zdCBwcm9qZWN0TWV0YWRhdGEgPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gIGNvbnN0IHByb2plY3RSb290ID0gbm9ybWFsaXplRGlyZWN0b3J5UGF0aChcbiAgICBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgKHByb2plY3RNZXRhZGF0YS5yb290IGFzIHN0cmluZyB8IHVuZGVmaW5lZCkgPz8gJycpLFxuICApO1xuICBjb25zdCBwcm9qZWN0U291cmNlUm9vdCA9IG5vcm1hbGl6ZURpcmVjdG9yeVBhdGgoXG4gICAgcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIChwcm9qZWN0TWV0YWRhdGEuc291cmNlUm9vdCBhcyBzdHJpbmcgfCB1bmRlZmluZWQpID8/ICdzcmMnKSxcbiAgKTtcblxuICAvLyBHYXRoZXIgcGVyc2lzdGVudCBjYWNoaW5nIG9wdGlvbiBhbmQgcHJvdmlkZSBhIHByb2plY3Qgc3BlY2lmaWMgY2FjaGUgbG9jYXRpb25cbiAgY29uc3QgY2FjaGVPcHRpb25zID0gbm9ybWFsaXplQ2FjaGVPcHRpb25zKHByb2plY3RNZXRhZGF0YSwgd29ya3NwYWNlUm9vdCk7XG4gIGNhY2hlT3B0aW9ucy5wYXRoID0gcGF0aC5qb2luKGNhY2hlT3B0aW9ucy5wYXRoLCBwcm9qZWN0TmFtZSk7XG5cbiAgY29uc3QgaTE4bk9wdGlvbnM6IEkxOG5PcHRpb25zICYge1xuICAgIGR1cGxpY2F0ZVRyYW5zbGF0aW9uQmVoYXZpb3I/OiBJMThOVHJhbnNsYXRpb247XG4gICAgbWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3I/OiBJMThOVHJhbnNsYXRpb247XG4gIH0gPSBjcmVhdGVJMThuT3B0aW9ucyhwcm9qZWN0TWV0YWRhdGEsIG9wdGlvbnMubG9jYWxpemUpO1xuICBpMThuT3B0aW9ucy5kdXBsaWNhdGVUcmFuc2xhdGlvbkJlaGF2aW9yID0gb3B0aW9ucy5pMThuRHVwbGljYXRlVHJhbnNsYXRpb247XG4gIGkxOG5PcHRpb25zLm1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yID0gb3B0aW9ucy5pMThuTWlzc2luZ1RyYW5zbGF0aW9uO1xuXG4gIGNvbnN0IGVudHJ5UG9pbnRzID0gbm9ybWFsaXplRW50cnlQb2ludHMod29ya3NwYWNlUm9vdCwgb3B0aW9ucy5icm93c2VyLCBvcHRpb25zLmVudHJ5UG9pbnRzKTtcbiAgY29uc3QgdHNjb25maWcgPSBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgb3B0aW9ucy50c0NvbmZpZyk7XG4gIGNvbnN0IG91dHB1dFBhdGggPSBub3JtYWxpemVEaXJlY3RvcnlQYXRoKHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLm91dHB1dFBhdGgpKTtcbiAgY29uc3Qgb3B0aW1pemF0aW9uT3B0aW9ucyA9IG5vcm1hbGl6ZU9wdGltaXphdGlvbihvcHRpb25zLm9wdGltaXphdGlvbik7XG4gIGNvbnN0IHNvdXJjZW1hcE9wdGlvbnMgPSBub3JtYWxpemVTb3VyY2VNYXBzKG9wdGlvbnMuc291cmNlTWFwID8/IGZhbHNlKTtcbiAgY29uc3QgYXNzZXRzID0gb3B0aW9ucy5hc3NldHM/Lmxlbmd0aFxuICAgID8gbm9ybWFsaXplQXNzZXRQYXR0ZXJucyhvcHRpb25zLmFzc2V0cywgd29ya3NwYWNlUm9vdCwgcHJvamVjdFJvb3QsIHByb2plY3RTb3VyY2VSb290KVxuICAgIDogdW5kZWZpbmVkO1xuXG4gIGNvbnN0IG91dHB1dE5hbWVzID0ge1xuICAgIGJ1bmRsZXM6XG4gICAgICBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuQWxsIHx8IG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5CdW5kbGVzXG4gICAgICAgID8gJ1tuYW1lXS5baGFzaF0nXG4gICAgICAgIDogJ1tuYW1lXScsXG4gICAgbWVkaWE6XG4gICAgICAnbWVkaWEvJyArXG4gICAgICAob3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLkFsbCB8fCBvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuTWVkaWFcbiAgICAgICAgPyAnW25hbWVdLltoYXNoXSdcbiAgICAgICAgOiAnW25hbWVdJyksXG4gIH07XG5cbiAgbGV0IGZpbGVSZXBsYWNlbWVudHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfCB1bmRlZmluZWQ7XG4gIGlmIChvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpIHtcbiAgICBmb3IgKGNvbnN0IHJlcGxhY2VtZW50IG9mIG9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykge1xuICAgICAgZmlsZVJlcGxhY2VtZW50cyA/Pz0ge307XG4gICAgICBmaWxlUmVwbGFjZW1lbnRzW3BhdGguam9pbih3b3Jrc3BhY2VSb290LCByZXBsYWNlbWVudC5yZXBsYWNlKV0gPSBwYXRoLmpvaW4oXG4gICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIHJlcGxhY2VtZW50LndpdGgsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGdsb2JhbFN0eWxlczogeyBuYW1lOiBzdHJpbmc7IGZpbGVzOiBzdHJpbmdbXTsgaW5pdGlhbDogYm9vbGVhbiB9W10gPSBbXTtcbiAgaWYgKG9wdGlvbnMuc3R5bGVzPy5sZW5ndGgpIHtcbiAgICBjb25zdCB7IGVudHJ5UG9pbnRzOiBzdHlsZXNoZWV0RW50cnlwb2ludHMsIG5vSW5qZWN0TmFtZXMgfSA9IG5vcm1hbGl6ZUdsb2JhbFN0eWxlcyhcbiAgICAgIG9wdGlvbnMuc3R5bGVzIHx8IFtdLFxuICAgICk7XG4gICAgZm9yIChjb25zdCBbbmFtZSwgZmlsZXNdIG9mIE9iamVjdC5lbnRyaWVzKHN0eWxlc2hlZXRFbnRyeXBvaW50cykpIHtcbiAgICAgIGdsb2JhbFN0eWxlcy5wdXNoKHsgbmFtZSwgZmlsZXMsIGluaXRpYWw6ICFub0luamVjdE5hbWVzLmluY2x1ZGVzKG5hbWUpIH0pO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGdsb2JhbFNjcmlwdHM6IHsgbmFtZTogc3RyaW5nOyBmaWxlczogc3RyaW5nW107IGluaXRpYWw6IGJvb2xlYW4gfVtdID0gW107XG4gIGlmIChvcHRpb25zLnNjcmlwdHM/Lmxlbmd0aCkge1xuICAgIGZvciAoY29uc3QgeyBidW5kbGVOYW1lLCBwYXRocywgaW5qZWN0IH0gb2YgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZShvcHRpb25zLnNjcmlwdHMpKSB7XG4gICAgICBnbG9iYWxTY3JpcHRzLnB1c2goeyBuYW1lOiBidW5kbGVOYW1lLCBmaWxlczogcGF0aHMsIGluaXRpYWw6IGluamVjdCB9KTtcbiAgICB9XG4gIH1cblxuICBsZXQgdGFpbHdpbmRDb25maWd1cmF0aW9uOiB7IGZpbGU6IHN0cmluZzsgcGFja2FnZTogc3RyaW5nIH0gfCB1bmRlZmluZWQ7XG4gIGNvbnN0IHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGggPSBhd2FpdCBmaW5kVGFpbHdpbmRDb25maWd1cmF0aW9uRmlsZSh3b3Jrc3BhY2VSb290LCBwcm9qZWN0Um9vdCk7XG4gIGlmICh0YWlsd2luZENvbmZpZ3VyYXRpb25QYXRoKSB7XG4gICAgLy8gQ3JlYXRlIGEgbm9kZSByZXNvbHZlciBhdCB0aGUgcHJvamVjdCByb290IGFzIGEgZGlyZWN0b3J5XG4gICAgY29uc3QgcmVzb2x2ZXIgPSBjcmVhdGVSZXF1aXJlKHByb2plY3RSb290ICsgJy8nKTtcbiAgICB0cnkge1xuICAgICAgdGFpbHdpbmRDb25maWd1cmF0aW9uID0ge1xuICAgICAgICBmaWxlOiB0YWlsd2luZENvbmZpZ3VyYXRpb25QYXRoLFxuICAgICAgICBwYWNrYWdlOiByZXNvbHZlci5yZXNvbHZlKCd0YWlsd2luZGNzcycpLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGNvbnN0IHJlbGF0aXZlVGFpbHdpbmRDb25maWdQYXRoID0gcGF0aC5yZWxhdGl2ZSh3b3Jrc3BhY2VSb290LCB0YWlsd2luZENvbmZpZ3VyYXRpb25QYXRoKTtcbiAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICAgIGBUYWlsd2luZCBDU1MgY29uZmlndXJhdGlvbiBmaWxlIGZvdW5kICgke3JlbGF0aXZlVGFpbHdpbmRDb25maWdQYXRofSlgICtcbiAgICAgICAgICBgIGJ1dCB0aGUgJ3RhaWx3aW5kY3NzJyBwYWNrYWdlIGlzIG5vdCBpbnN0YWxsZWQuYCArXG4gICAgICAgICAgYCBUbyBlbmFibGUgVGFpbHdpbmQgQ1NTLCBwbGVhc2UgaW5zdGFsbCB0aGUgJ3RhaWx3aW5kY3NzJyBwYWNrYWdlLmAsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGxldCBpbmRleEh0bWxPcHRpb25zO1xuICAvLyBpbmRleCBjYW4gbmV2ZXIgaGF2ZSBhIHZhbHVlIG9mIGB0cnVlYCBidXQgaW4gdGhlIHNjaGVtYSBpdCdzIG9mIHR5cGUgYGJvb2xlYW5gLlxuICBpZiAodHlwZW9mIG9wdGlvbnMuaW5kZXggIT09ICdib29sZWFuJykge1xuICAgIGluZGV4SHRtbE9wdGlvbnMgPSB7XG4gICAgICBpbnB1dDogcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGdldEluZGV4SW5wdXRGaWxlKG9wdGlvbnMuaW5kZXgpKSxcbiAgICAgIC8vIFRoZSBvdXRwdXQgZmlsZSB3aWxsIGJlIGNyZWF0ZWQgd2l0aGluIHRoZSBjb25maWd1cmVkIG91dHB1dCBwYXRoXG4gICAgICBvdXRwdXQ6IGdldEluZGV4T3V0cHV0RmlsZShvcHRpb25zLmluZGV4KSxcbiAgICAgIC8vIFRPRE86IFVzZSBleGlzdGluZyBpbmZvcm1hdGlvbiBmcm9tIGFib3ZlIHRvIGNyZWF0ZSB0aGUgaW5zZXJ0aW9uIG9yZGVyXG4gICAgICBpbnNlcnRpb25PcmRlcjogZ2VuZXJhdGVFbnRyeVBvaW50cyh7XG4gICAgICAgIHNjcmlwdHM6IG9wdGlvbnMuc2NyaXB0cyA/PyBbXSxcbiAgICAgICAgc3R5bGVzOiBvcHRpb25zLnN0eWxlcyA/PyBbXSxcbiAgICAgIH0pLFxuICAgIH07XG4gIH1cblxuICBsZXQgc2VydmVyRW50cnlQb2ludDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBpZiAob3B0aW9ucy5zZXJ2ZXIpIHtcbiAgICBzZXJ2ZXJFbnRyeVBvaW50ID0gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMuc2VydmVyKTtcbiAgfSBlbHNlIGlmIChvcHRpb25zLnNlcnZlciA9PT0gJycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2BzZXJ2ZXJgIG9wdGlvbiBjYW5ub3QgYmUgYW4gZW1wdHkgc3RyaW5nLicpO1xuICB9XG5cbiAgbGV0IHByZXJlbmRlck9wdGlvbnM7XG4gIGlmIChvcHRpb25zLnByZXJlbmRlcikge1xuICAgIGNvbnN0IHsgZGlzY292ZXJSb3V0ZXMgPSB0cnVlLCByb3V0ZXNGaWxlID0gdW5kZWZpbmVkIH0gPVxuICAgICAgb3B0aW9ucy5wcmVyZW5kZXIgPT09IHRydWUgPyB7fSA6IG9wdGlvbnMucHJlcmVuZGVyO1xuXG4gICAgcHJlcmVuZGVyT3B0aW9ucyA9IHtcbiAgICAgIGRpc2NvdmVyUm91dGVzLFxuICAgICAgcm91dGVzRmlsZTogcm91dGVzRmlsZSAmJiBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgcm91dGVzRmlsZSksXG4gICAgfTtcbiAgfVxuXG4gIGxldCBzc3JPcHRpb25zO1xuICBpZiAob3B0aW9ucy5zc3IgPT09IHRydWUpIHtcbiAgICBzc3JPcHRpb25zID0ge307XG4gIH0gZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMuc3NyID09PSAnc3RyaW5nJykge1xuICAgIHNzck9wdGlvbnMgPSB7XG4gICAgICBlbnRyeTogcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMuc3NyKSxcbiAgICB9O1xuICB9XG5cbiAgbGV0IGFwcFNoZWxsT3B0aW9ucztcbiAgaWYgKG9wdGlvbnMuYXBwU2hlbGwpIHtcbiAgICBhcHBTaGVsbE9wdGlvbnMgPSB7XG4gICAgICByb3V0ZTogJ3NoZWxsJyxcbiAgICB9O1xuICB9XG5cbiAgLy8gSW5pdGlhbCBvcHRpb25zIHRvIGtlZXBcbiAgY29uc3Qge1xuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICBhb3QsXG4gICAgYmFzZUhyZWYsXG4gICAgY3Jvc3NPcmlnaW4sXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgZXh0cmFjdExpY2Vuc2VzLFxuICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UgPSAnY3NzJyxcbiAgICBvdXRFeHRlbnNpb24sXG4gICAgc2VydmljZVdvcmtlcixcbiAgICBwb2xsLFxuICAgIHBvbHlmaWxscyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHN0YXRzSnNvbixcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgdmVyYm9zZSxcbiAgICB3YXRjaCxcbiAgICBwcm9ncmVzcyA9IHRydWUsXG4gICAgZXh0ZXJuYWxQYWNrYWdlcyxcbiAgICBkZWxldGVPdXRwdXRQYXRoLFxuICB9ID0gb3B0aW9ucztcblxuICAvLyBSZXR1cm4gYWxsIHRoZSBub3JtYWxpemVkIG9wdGlvbnNcbiAgcmV0dXJuIHtcbiAgICBhZHZhbmNlZE9wdGltaXphdGlvbnM6ICEhYW90LFxuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICBiYXNlSHJlZixcbiAgICBjYWNoZU9wdGlvbnMsXG4gICAgY3Jvc3NPcmlnaW4sXG4gICAgZGVsZXRlT3V0cHV0UGF0aCxcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBleHRyYWN0TGljZW5zZXMsXG4gICAgaW5saW5lU3R5bGVMYW5ndWFnZSxcbiAgICBqaXQ6ICFhb3QsXG4gICAgc3RhdHM6ICEhc3RhdHNKc29uLFxuICAgIHBvbHlmaWxsczogcG9seWZpbGxzID09PSB1bmRlZmluZWQgfHwgQXJyYXkuaXNBcnJheShwb2x5ZmlsbHMpID8gcG9seWZpbGxzIDogW3BvbHlmaWxsc10sXG4gICAgcG9sbCxcbiAgICBwcm9ncmVzcyxcbiAgICBleHRlcm5hbFBhY2thZ2VzLFxuICAgIC8vIElmIG5vdCBleHBsaWNpdGx5IHNldCwgZGVmYXVsdCB0byB0aGUgTm9kZS5qcyBwcm9jZXNzIGFyZ3VtZW50XG4gICAgcHJlc2VydmVTeW1saW5rczogcHJlc2VydmVTeW1saW5rcyA/PyBwcm9jZXNzLmV4ZWNBcmd2LmluY2x1ZGVzKCctLXByZXNlcnZlLXN5bWxpbmtzJyksXG4gICAgc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIHNlcnZlckVudHJ5UG9pbnQsXG4gICAgcHJlcmVuZGVyT3B0aW9ucyxcbiAgICBhcHBTaGVsbE9wdGlvbnMsXG4gICAgc3NyT3B0aW9ucyxcbiAgICB2ZXJib3NlLFxuICAgIHdhdGNoLFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgZW50cnlQb2ludHMsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBvdXRwdXRQYXRoLFxuICAgIG91dEV4dGVuc2lvbixcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICAgIHByb2plY3RSb290LFxuICAgIGFzc2V0cyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgIGdsb2JhbFN0eWxlcyxcbiAgICBnbG9iYWxTY3JpcHRzLFxuICAgIHNlcnZpY2VXb3JrZXI6XG4gICAgICB0eXBlb2Ygc2VydmljZVdvcmtlciA9PT0gJ3N0cmluZycgPyBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgc2VydmljZVdvcmtlcikgOiB1bmRlZmluZWQsXG4gICAgaW5kZXhIdG1sT3B0aW9ucyxcbiAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24sXG4gICAgaTE4bk9wdGlvbnMsXG4gIH07XG59XG5cbi8qKlxuICogTm9ybWFsaXplIGVudHJ5IHBvaW50IG9wdGlvbnMuIFRvIG1haW50YWluIGNvbXBhdGliaWxpdHkgd2l0aCB0aGUgbGVnYWN5IGJyb3dzZXIgYnVpbGRlciwgd2UgbmVlZCBhIHNpbmdsZSBgYnJvd3NlcmBcbiAqIG9wdGlvbiB3aGljaCBkZWZpbmVzIGEgc2luZ2xlIGVudHJ5IHBvaW50LiBIb3dldmVyLCB3ZSBhbHNvIHdhbnQgdG8gc3VwcG9ydCBtdWx0aXBsZSBlbnRyeSBwb2ludHMgYXMgYW4gaW50ZXJuYWwgb3B0aW9uLlxuICogVGhlIHR3byBvcHRpb25zIGFyZSBtdXR1YWxseSBleGNsdXNpdmUgYW5kIGlmIGBicm93c2VyYCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWQgYXMgdGhlIHNvbGUgZW50cnkgcG9pbnQuXG4gKiBJZiBgZW50cnlQb2ludHNgIGFyZSBwcm92aWRlZCwgdGhleSB3aWxsIGJlIHVzZWQgYXMgdGhlIHNldCBvZiBlbnRyeSBwb2ludHMuXG4gKlxuICogQHBhcmFtIHdvcmtzcGFjZVJvb3QgUGF0aCB0byB0aGUgcm9vdCBvZiB0aGUgQW5ndWxhciB3b3Jrc3BhY2UuXG4gKiBAcGFyYW0gYnJvd3NlciBUaGUgYGJyb3dzZXJgIG9wdGlvbiBwb2ludGluZyBhdCB0aGUgYXBwbGljYXRpb24gZW50cnkgcG9pbnQuIFdoaWxlIHJlcXVpcmVkIHBlciB0aGUgc2NoZW1hIGZpbGUsIGl0IG1heSBiZSBvbWl0dGVkIGJ5XG4gKiAgICAgcHJvZ3JhbW1hdGljIHVzYWdlcyBvZiBgYnJvd3Nlci1lc2J1aWxkYC5cbiAqIEBwYXJhbSBlbnRyeVBvaW50cyBTZXQgb2YgZW50cnkgcG9pbnRzIHRvIHVzZSBpZiBwcm92aWRlZC5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBtYXBwaW5nIGVudHJ5IHBvaW50IG5hbWVzIHRvIHRoZWlyIGZpbGUgcGF0aHMuXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZUVudHJ5UG9pbnRzKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIGJyb3dzZXI6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgZW50cnlQb2ludHM6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpLFxuKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gIGlmIChicm93c2VyID09PSAnJykge1xuICAgIHRocm93IG5ldyBFcnJvcignYGJyb3dzZXJgIG9wdGlvbiBjYW5ub3QgYmUgYW4gZW1wdHkgc3RyaW5nLicpO1xuICB9XG5cbiAgLy8gYGJyb3dzZXJgIGFuZCBgZW50cnlQb2ludHNgIGFyZSBtdXR1YWxseSBleGNsdXNpdmUuXG4gIGlmIChicm93c2VyICYmIGVudHJ5UG9pbnRzLnNpemUgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdPbmx5IG9uZSBvZiBgYnJvd3NlcmAgb3IgYGVudHJ5UG9pbnRzYCBtYXkgYmUgcHJvdmlkZWQuJyk7XG4gIH1cbiAgaWYgKCFicm93c2VyICYmIGVudHJ5UG9pbnRzLnNpemUgPT09IDApIHtcbiAgICAvLyBTY2hlbWEgc2hvdWxkIG5vcm1hbGx5IHJlamVjdCB0aGlzIGNhc2UsIGJ1dCBwcm9ncmFtbWF0aWMgdXNhZ2VzIG9mIHRoZSBidWlsZGVyIG1pZ2h0IG1ha2UgdGhpcyBtaXN0YWtlLlxuICAgIHRocm93IG5ldyBFcnJvcignRWl0aGVyIGBicm93c2VyYCBvciBhdCBsZWFzdCBvbmUgYGVudHJ5UG9pbnRzYCB2YWx1ZSBtdXN0IGJlIHByb3ZpZGVkLicpO1xuICB9XG5cbiAgLy8gU2NoZW1hIHR5cGVzIGZvcmNlIGBicm93c2VyYCB0byBhbHdheXMgYmUgcHJvdmlkZWQsIGJ1dCBpdCBtYXkgYmUgb21pdHRlZCB3aGVuIHRoZSBidWlsZGVyIGlzIGludm9rZWQgcHJvZ3JhbW1hdGljYWxseS5cbiAgaWYgKGJyb3dzZXIpIHtcbiAgICAvLyBVc2UgYGJyb3dzZXJgIGFsb25lLlxuICAgIHJldHVybiB7ICdtYWluJzogcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGJyb3dzZXIpIH07XG4gIH0gZWxzZSB7XG4gICAgLy8gVXNlIGBlbnRyeVBvaW50c2AgYWxvbmUuXG4gICAgY29uc3QgZW50cnlQb2ludFBhdGhzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgZm9yIChjb25zdCBlbnRyeVBvaW50IG9mIGVudHJ5UG9pbnRzKSB7XG4gICAgICBjb25zdCBwYXJzZWRFbnRyeVBvaW50ID0gcGF0aC5wYXJzZShlbnRyeVBvaW50KTtcblxuICAgICAgLy8gVXNlIHRoZSBpbnB1dCBmaWxlIHBhdGggd2l0aG91dCBhbiBleHRlbnNpb24gYXMgdGhlIFwibmFtZVwiIG9mIHRoZSBlbnRyeSBwb2ludCBkaWN0YXRpbmcgaXRzIG91dHB1dCBsb2NhdGlvbi5cbiAgICAgIC8vIFJlbGF0aXZlIGVudHJ5IHBvaW50cyBhcmUgZ2VuZXJhdGVkIGF0IHRoZSBzYW1lIHJlbGF0aXZlIHBhdGggaW4gdGhlIG91dHB1dCBkaXJlY3RvcnkuXG4gICAgICAvLyBBYnNvbHV0ZSBlbnRyeSBwb2ludHMgYXJlIGFsd2F5cyBnZW5lcmF0ZWQgd2l0aCB0aGUgc2FtZSBmaWxlIG5hbWUgaW4gdGhlIHJvb3Qgb2YgdGhlIG91dHB1dCBkaXJlY3RvcnkuIFRoaXMgaW5jbHVkZXMgYWJzb2x1dGVcbiAgICAgIC8vIHBhdGhzIHBvaW50aW5nIGF0IGZpbGVzIGFjdHVhbGx5IHdpdGhpbiB0aGUgd29ya3NwYWNlIHJvb3QuXG4gICAgICBjb25zdCBlbnRyeVBvaW50TmFtZSA9IHBhdGguaXNBYnNvbHV0ZShlbnRyeVBvaW50KVxuICAgICAgICA/IHBhcnNlZEVudHJ5UG9pbnQubmFtZVxuICAgICAgICA6IHBhdGguam9pbihwYXJzZWRFbnRyeVBvaW50LmRpciwgcGFyc2VkRW50cnlQb2ludC5uYW1lKTtcblxuICAgICAgLy8gR2V0IHRoZSBmdWxsIGZpbGUgcGF0aCB0byB0aGUgZW50cnkgcG9pbnQgaW5wdXQuXG4gICAgICBjb25zdCBlbnRyeVBvaW50UGF0aCA9IHBhdGguaXNBYnNvbHV0ZShlbnRyeVBvaW50KVxuICAgICAgICA/IGVudHJ5UG9pbnRcbiAgICAgICAgOiBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgZW50cnlQb2ludCk7XG5cbiAgICAgIC8vIENoZWNrIGZvciBjb25mbGljdHMgd2l0aCBwcmV2aW91cyBlbnRyeSBwb2ludHMuXG4gICAgICBjb25zdCBleGlzdGluZ0VudHJ5UG9pbnRQYXRoID0gZW50cnlQb2ludFBhdGhzW2VudHJ5UG9pbnROYW1lXTtcbiAgICAgIGlmIChleGlzdGluZ0VudHJ5UG9pbnRQYXRoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgXFxgJHtleGlzdGluZ0VudHJ5UG9pbnRQYXRofVxcYCBhbmQgXFxgJHtlbnRyeVBvaW50UGF0aH1cXGAgYm90aCBvdXRwdXQgdG8gdGhlIHNhbWUgbG9jYXRpb24gXFxgJHtlbnRyeVBvaW50TmFtZX1cXGAuYCArXG4gICAgICAgICAgICAnIFJlbmFtZSBvciBtb3ZlIG9uZSBvZiB0aGUgZmlsZXMgdG8gZml4IHRoZSBjb25mbGljdC4nLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBlbnRyeVBvaW50UGF0aHNbZW50cnlQb2ludE5hbWVdID0gZW50cnlQb2ludFBhdGg7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVudHJ5UG9pbnRQYXRocztcbiAgfVxufVxuXG4vKipcbiAqIE5vcm1hbGl6ZSBhIGRpcmVjdG9yeSBwYXRoIHN0cmluZy5cbiAqIEN1cnJlbnRseSBvbmx5IHJlbW92ZXMgYSB0cmFpbGluZyBzbGFzaCBpZiBwcmVzZW50LlxuICogQHBhcmFtIHBhdGggQSBwYXRoIHN0cmluZy5cbiAqIEByZXR1cm5zIEEgbm9ybWFsaXplZCBwYXRoIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplRGlyZWN0b3J5UGF0aChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBsYXN0ID0gcGF0aFtwYXRoLmxlbmd0aCAtIDFdO1xuICBpZiAobGFzdCA9PT0gJy8nIHx8IGxhc3QgPT09ICdcXFxcJykge1xuICAgIHJldHVybiBwYXRoLnNsaWNlKDAsIC0xKTtcbiAgfVxuXG4gIHJldHVybiBwYXRoO1xufVxuIl19