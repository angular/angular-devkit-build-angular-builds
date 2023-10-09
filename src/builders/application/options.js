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
    const { allowedCommonJsDependencies, aot, baseHref, crossOrigin, externalDependencies, extractLicenses, inlineStyleLanguage = 'css', outExtension, serviceWorker, poll, polyfills, preserveSymlinks, statsJson, stylePreprocessorOptions, subresourceIntegrity, verbose, watch, progress = true, externalPackages, deleteOutputPath, namedChunks, budgets, } = options;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL29wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsNkNBQTRDO0FBQzVDLDBEQUE2QjtBQUM3QiwrREFHMkM7QUFDM0MsdUNBQWlHO0FBQ2pHLDJEQUEwRTtBQUMxRSxpRUFBb0U7QUFDcEUsdUVBQXFFO0FBQ3JFLG1EQUFxRTtBQUNyRSwrRUFBMkY7QUFDM0YscUNBQStGO0FBdUMvRjs7Ozs7Ozs7O0dBU0c7QUFDSCxrREFBa0Q7QUFDM0MsS0FBSyxVQUFVLGdCQUFnQixDQUNwQyxPQUF1QixFQUN2QixXQUFtQixFQUNuQixPQUEwQztJQUUxQyxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDO0lBQzVDLE1BQU0sZUFBZSxHQUFHLE1BQU0sT0FBTyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3RFLE1BQU0sV0FBVyxHQUFHLHNCQUFzQixDQUN4QyxtQkFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUcsZUFBZSxDQUFDLElBQTJCLElBQUksRUFBRSxDQUFDLENBQzdFLENBQUM7SUFDRixNQUFNLGlCQUFpQixHQUFHLHNCQUFzQixDQUM5QyxtQkFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUcsZUFBZSxDQUFDLFVBQWlDLElBQUksS0FBSyxDQUFDLENBQ3RGLENBQUM7SUFFRixpRkFBaUY7SUFDakYsTUFBTSxZQUFZLEdBQUcsSUFBQSx1Q0FBcUIsRUFBQyxlQUFlLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDM0UsWUFBWSxDQUFDLElBQUksR0FBRyxtQkFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBRTlELE1BQU0sV0FBVyxHQUdiLElBQUEsZ0NBQWlCLEVBQUMsZUFBZSxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN6RCxXQUFXLENBQUMsNEJBQTRCLEdBQUcsT0FBTyxDQUFDLHdCQUF3QixDQUFDO0lBQzVFLFdBQVcsQ0FBQywwQkFBMEIsR0FBRyxPQUFPLENBQUMsc0JBQXNCLENBQUM7SUFDeEUsSUFBSSxPQUFPLENBQUMsbUJBQW1CLEVBQUU7UUFDL0IsV0FBVyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7S0FDL0I7SUFFRCxNQUFNLFdBQVcsR0FBRyxvQkFBb0IsQ0FBQyxhQUFhLEVBQUUsT0FBTyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDOUYsTUFBTSxRQUFRLEdBQUcsbUJBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUM1RCxNQUFNLFVBQVUsR0FBRyxzQkFBc0IsQ0FBQyxtQkFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFDeEYsTUFBTSxtQkFBbUIsR0FBRyxJQUFBLDZCQUFxQixFQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUN4RSxNQUFNLGdCQUFnQixHQUFHLElBQUEsMkJBQW1CLEVBQUMsT0FBTyxDQUFDLFNBQVMsSUFBSSxLQUFLLENBQUMsQ0FBQztJQUN6RSxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLE1BQU07UUFDbkMsQ0FBQyxDQUFDLElBQUEsOEJBQXNCLEVBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxhQUFhLEVBQUUsV0FBVyxFQUFFLGlCQUFpQixDQUFDO1FBQ3ZGLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFFZCxNQUFNLFdBQVcsR0FBRztRQUNsQixPQUFPLEVBQ0wsT0FBTyxDQUFDLGFBQWEsS0FBSyxzQkFBYSxDQUFDLEdBQUcsSUFBSSxPQUFPLENBQUMsYUFBYSxLQUFLLHNCQUFhLENBQUMsT0FBTztZQUM1RixDQUFDLENBQUMsZUFBZTtZQUNqQixDQUFDLENBQUMsUUFBUTtRQUNkLEtBQUssRUFDSCxRQUFRO1lBQ1IsQ0FBQyxPQUFPLENBQUMsYUFBYSxLQUFLLHNCQUFhLENBQUMsR0FBRyxJQUFJLE9BQU8sQ0FBQyxhQUFhLEtBQUssc0JBQWEsQ0FBQyxLQUFLO2dCQUMzRixDQUFDLENBQUMsZUFBZTtnQkFDakIsQ0FBQyxDQUFDLFFBQVEsQ0FBQztLQUNoQixDQUFDO0lBRUYsSUFBSSxnQkFBb0QsQ0FBQztJQUN6RCxJQUFJLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRTtRQUM1QixLQUFLLE1BQU0sV0FBVyxJQUFJLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRTtZQUNsRCxnQkFBZ0IsS0FBSyxFQUFFLENBQUM7WUFDeEIsZ0JBQWdCLENBQUMsbUJBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLG1CQUFJLENBQUMsSUFBSSxDQUN6RSxhQUFhLEVBQ2IsV0FBVyxDQUFDLElBQUksQ0FDakIsQ0FBQztTQUNIO0tBQ0Y7SUFFRCxNQUFNLFlBQVksR0FBMEQsRUFBRSxDQUFDO0lBQy9FLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUU7UUFDMUIsTUFBTSxFQUFFLFdBQVcsRUFBRSxxQkFBcUIsRUFBRSxhQUFhLEVBQUUsR0FBRyxJQUFBLCtCQUFxQixFQUNqRixPQUFPLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FDckIsQ0FBQztRQUNGLEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLHFCQUFxQixDQUFDLEVBQUU7WUFDakUsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDNUU7S0FDRjtJQUVELE1BQU0sYUFBYSxHQUEwRCxFQUFFLENBQUM7SUFDaEYsSUFBSSxPQUFPLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRTtRQUMzQixLQUFLLE1BQU0sRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxJQUFJLElBQUEsbUNBQXlCLEVBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ3RGLGFBQWEsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7U0FDekU7S0FDRjtJQUVELElBQUkscUJBQW9FLENBQUM7SUFDekUsTUFBTSx5QkFBeUIsR0FBRyxNQUFNLElBQUEsd0NBQTZCLEVBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQ2xHLElBQUkseUJBQXlCLEVBQUU7UUFDN0IsNERBQTREO1FBQzVELE1BQU0sUUFBUSxHQUFHLElBQUEsMkJBQWEsRUFBQyxXQUFXLEdBQUcsR0FBRyxDQUFDLENBQUM7UUFDbEQsSUFBSTtZQUNGLHFCQUFxQixHQUFHO2dCQUN0QixJQUFJLEVBQUUseUJBQXlCO2dCQUMvQixPQUFPLEVBQUUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUM7YUFDekMsQ0FBQztTQUNIO1FBQUMsTUFBTTtZQUNOLE1BQU0sMEJBQTBCLEdBQUcsbUJBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLHlCQUF5QixDQUFDLENBQUM7WUFDM0YsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQ2pCLDBDQUEwQywwQkFBMEIsR0FBRztnQkFDckUsa0RBQWtEO2dCQUNsRCxvRUFBb0UsQ0FDdkUsQ0FBQztTQUNIO0tBQ0Y7SUFFRCxJQUFJLGdCQUFnQixDQUFDO0lBQ3JCLG1GQUFtRjtJQUNuRixJQUFJLE9BQU8sT0FBTyxDQUFDLEtBQUssS0FBSyxTQUFTLEVBQUU7UUFDdEMsZ0JBQWdCLEdBQUc7WUFDakIsS0FBSyxFQUFFLG1CQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFBLDBDQUFpQixFQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNqRSxvRUFBb0U7WUFDcEUsTUFBTSxFQUFFLElBQUEsMkNBQWtCLEVBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztZQUN6QywwRUFBMEU7WUFDMUUsY0FBYyxFQUFFLElBQUEsd0NBQW1CLEVBQUM7Z0JBQ2xDLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTyxJQUFJLEVBQUU7Z0JBQzlCLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTSxJQUFJLEVBQUU7YUFDN0IsQ0FBQztTQUNILENBQUM7S0FDSDtJQUVELElBQUksZ0JBQW9DLENBQUM7SUFDekMsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFO1FBQ2xCLGdCQUFnQixHQUFHLG1CQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDN0Q7U0FBTSxJQUFJLE9BQU8sQ0FBQyxNQUFNLEtBQUssRUFBRSxFQUFFO1FBQ2hDLE1BQU0sSUFBSSxLQUFLLENBQUMsNENBQTRDLENBQUMsQ0FBQztLQUMvRDtJQUVELElBQUksZ0JBQWdCLENBQUM7SUFDckIsSUFBSSxPQUFPLENBQUMsU0FBUyxFQUFFO1FBQ3JCLE1BQU0sRUFBRSxjQUFjLEdBQUcsSUFBSSxFQUFFLFVBQVUsR0FBRyxTQUFTLEVBQUUsR0FDckQsT0FBTyxDQUFDLFNBQVMsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQztRQUV0RCxnQkFBZ0IsR0FBRztZQUNqQixjQUFjO1lBQ2QsVUFBVSxFQUFFLFVBQVUsSUFBSSxtQkFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsVUFBVSxDQUFDO1NBQy9ELENBQUM7S0FDSDtJQUVELElBQUksVUFBVSxDQUFDO0lBQ2YsSUFBSSxPQUFPLENBQUMsR0FBRyxLQUFLLElBQUksRUFBRTtRQUN4QixVQUFVLEdBQUcsRUFBRSxDQUFDO0tBQ2pCO1NBQU0sSUFBSSxPQUFPLE9BQU8sQ0FBQyxHQUFHLEtBQUssUUFBUSxFQUFFO1FBQzFDLFVBQVUsR0FBRztZQUNYLEtBQUssRUFBRSxtQkFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQztTQUM3QyxDQUFDO0tBQ0g7SUFFRCxJQUFJLGVBQWUsQ0FBQztJQUNwQixJQUFJLE9BQU8sQ0FBQyxRQUFRLEVBQUU7UUFDcEIsZUFBZSxHQUFHO1lBQ2hCLEtBQUssRUFBRSxPQUFPO1NBQ2YsQ0FBQztLQUNIO0lBRUQsMEJBQTBCO0lBQzFCLE1BQU0sRUFDSiwyQkFBMkIsRUFDM0IsR0FBRyxFQUNILFFBQVEsRUFDUixXQUFXLEVBQ1gsb0JBQW9CLEVBQ3BCLGVBQWUsRUFDZixtQkFBbUIsR0FBRyxLQUFLLEVBQzNCLFlBQVksRUFDWixhQUFhLEVBQ2IsSUFBSSxFQUNKLFNBQVMsRUFDVCxnQkFBZ0IsRUFDaEIsU0FBUyxFQUNULHdCQUF3QixFQUN4QixvQkFBb0IsRUFDcEIsT0FBTyxFQUNQLEtBQUssRUFDTCxRQUFRLEdBQUcsSUFBSSxFQUNmLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsV0FBVyxFQUNYLE9BQU8sR0FDUixHQUFHLE9BQU8sQ0FBQztJQUVaLG9DQUFvQztJQUNwQyxPQUFPO1FBQ0wscUJBQXFCLEVBQUUsQ0FBQyxDQUFDLEdBQUc7UUFDNUIsMkJBQTJCO1FBQzNCLFFBQVE7UUFDUixZQUFZO1FBQ1osV0FBVztRQUNYLGdCQUFnQjtRQUNoQixvQkFBb0I7UUFDcEIsZUFBZTtRQUNmLG1CQUFtQjtRQUNuQixHQUFHLEVBQUUsQ0FBQyxHQUFHO1FBQ1QsS0FBSyxFQUFFLENBQUMsQ0FBQyxTQUFTO1FBQ2xCLFNBQVMsRUFBRSxTQUFTLEtBQUssU0FBUyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDeEYsSUFBSTtRQUNKLFFBQVE7UUFDUixnQkFBZ0I7UUFDaEIsaUVBQWlFO1FBQ2pFLGdCQUFnQixFQUFFLGdCQUFnQixJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLHFCQUFxQixDQUFDO1FBQ3RGLHdCQUF3QjtRQUN4QixvQkFBb0I7UUFDcEIsZ0JBQWdCO1FBQ2hCLGdCQUFnQjtRQUNoQixlQUFlO1FBQ2YsVUFBVTtRQUNWLE9BQU87UUFDUCxLQUFLO1FBQ0wsYUFBYTtRQUNiLFdBQVc7UUFDWCxtQkFBbUI7UUFDbkIsVUFBVTtRQUNWLFlBQVk7UUFDWixnQkFBZ0I7UUFDaEIsUUFBUTtRQUNSLFdBQVc7UUFDWCxNQUFNO1FBQ04sV0FBVztRQUNYLGdCQUFnQjtRQUNoQixZQUFZO1FBQ1osYUFBYTtRQUNiLGFBQWEsRUFDWCxPQUFPLGFBQWEsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLG1CQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztRQUN6RixnQkFBZ0I7UUFDaEIscUJBQXFCO1FBQ3JCLFdBQVc7UUFDWCxXQUFXO1FBQ1gsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsU0FBUztLQUMvQyxDQUFDO0FBQ0osQ0FBQztBQTVORCw0Q0E0TkM7QUFFRDs7Ozs7Ozs7Ozs7R0FXRztBQUNILFNBQVMsb0JBQW9CLENBQzNCLGFBQXFCLEVBQ3JCLE9BQTJCLEVBQzNCLGNBQTJCLElBQUksR0FBRyxFQUFFO0lBRXBDLElBQUksT0FBTyxLQUFLLEVBQUUsRUFBRTtRQUNsQixNQUFNLElBQUksS0FBSyxDQUFDLDZDQUE2QyxDQUFDLENBQUM7S0FDaEU7SUFFRCxzREFBc0Q7SUFDdEQsSUFBSSxPQUFPLElBQUksV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUU7UUFDbkMsTUFBTSxJQUFJLEtBQUssQ0FBQyx5REFBeUQsQ0FBQyxDQUFDO0tBQzVFO0lBQ0QsSUFBSSxDQUFDLE9BQU8sSUFBSSxXQUFXLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRTtRQUN0QywyR0FBMkc7UUFDM0csTUFBTSxJQUFJLEtBQUssQ0FBQyx3RUFBd0UsQ0FBQyxDQUFDO0tBQzNGO0lBRUQsMEhBQTBIO0lBQzFILElBQUksT0FBTyxFQUFFO1FBQ1gsdUJBQXVCO1FBQ3ZCLE9BQU8sRUFBRSxNQUFNLEVBQUUsbUJBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxFQUFFLENBQUM7S0FDdEQ7U0FBTTtRQUNMLDJCQUEyQjtRQUMzQixNQUFNLGVBQWUsR0FBMkIsRUFBRSxDQUFDO1FBQ25ELEtBQUssTUFBTSxVQUFVLElBQUksV0FBVyxFQUFFO1lBQ3BDLE1BQU0sZ0JBQWdCLEdBQUcsbUJBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7WUFFaEQsK0dBQStHO1lBQy9HLHlGQUF5RjtZQUN6RixpSUFBaUk7WUFDakksOERBQThEO1lBQzlELE1BQU0sY0FBYyxHQUFHLG1CQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQztnQkFDaEQsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLElBQUk7Z0JBQ3ZCLENBQUMsQ0FBQyxtQkFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFM0QsbURBQW1EO1lBQ25ELE1BQU0sY0FBYyxHQUFHLG1CQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQztnQkFDaEQsQ0FBQyxDQUFDLFVBQVU7Z0JBQ1osQ0FBQyxDQUFDLG1CQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQztZQUV6QyxrREFBa0Q7WUFDbEQsTUFBTSxzQkFBc0IsR0FBRyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDL0QsSUFBSSxzQkFBc0IsRUFBRTtnQkFDMUIsTUFBTSxJQUFJLEtBQUssQ0FDYixLQUFLLHNCQUFzQixZQUFZLGNBQWMseUNBQXlDLGNBQWMsS0FBSztvQkFDL0csdURBQXVELENBQzFELENBQUM7YUFDSDtZQUVELGVBQWUsQ0FBQyxjQUFjLENBQUMsR0FBRyxjQUFjLENBQUM7U0FDbEQ7UUFFRCxPQUFPLGVBQWUsQ0FBQztLQUN4QjtBQUNILENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILFNBQVMsc0JBQXNCLENBQUMsSUFBWTtJQUMxQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNuQyxJQUFJLElBQUksS0FBSyxHQUFHLElBQUksSUFBSSxLQUFLLElBQUksRUFBRTtRQUNqQyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDMUI7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdub2RlOm1vZHVsZSc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHtcbiAgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZSxcbiAgbm9ybWFsaXplR2xvYmFsU3R5bGVzLFxufSBmcm9tICcuLi8uLi90b29scy93ZWJwYWNrL3V0aWxzL2hlbHBlcnMnO1xuaW1wb3J0IHsgbm9ybWFsaXplQXNzZXRQYXR0ZXJucywgbm9ybWFsaXplT3B0aW1pemF0aW9uLCBub3JtYWxpemVTb3VyY2VNYXBzIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgSTE4bk9wdGlvbnMsIGNyZWF0ZUkxOG5PcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL25vcm1hbGl6ZS1jYWNoZSc7XG5pbXBvcnQgeyBnZW5lcmF0ZUVudHJ5UG9pbnRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGFja2FnZS1jaHVuay1zb3J0JztcbmltcG9ydCB7IGZpbmRUYWlsd2luZENvbmZpZ3VyYXRpb25GaWxlIH0gZnJvbSAnLi4vLi4vdXRpbHMvdGFpbHdpbmQnO1xuaW1wb3J0IHsgZ2V0SW5kZXhJbnB1dEZpbGUsIGdldEluZGV4T3V0cHV0RmlsZSB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgU2NoZW1hIGFzIEFwcGxpY2F0aW9uQnVpbGRlck9wdGlvbnMsIEkxOE5UcmFuc2xhdGlvbiwgT3V0cHV0SGFzaGluZyB9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IHR5cGUgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zID0gQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBub3JtYWxpemVPcHRpb25zPj47XG5cbi8qKiBJbnRlcm5hbCBvcHRpb25zIGhpZGRlbiBmcm9tIGJ1aWxkZXIgc2NoZW1hIGJ1dCBhdmFpbGFibGUgd2hlbiBpbnZva2VkIHByb2dyYW1tYXRpY2FsbHkuICovXG5pbnRlcmZhY2UgSW50ZXJuYWxPcHRpb25zIHtcbiAgLyoqXG4gICAqIEVudHJ5IHBvaW50cyB0byB1c2UgZm9yIHRoZSBjb21waWxhdGlvbi4gSW5jb21wYXRpYmxlIHdpdGggYGJyb3dzZXJgLCB3aGljaCBtdXN0IG5vdCBiZSBwcm92aWRlZC4gTWF5IGJlIHJlbGF0aXZlIG9yIGFic29sdXRlIHBhdGhzLlxuICAgKiBJZiBnaXZlbiBhIHJlbGF0aXZlIHBhdGgsIGl0IGlzIHJlc29sdmVkIHJlbGF0aXZlIHRvIHRoZSBjdXJyZW50IHdvcmtzcGFjZSBhbmQgd2lsbCBnZW5lcmF0ZSBhbiBvdXRwdXQgYXQgdGhlIHNhbWUgcmVsYXRpdmUgbG9jYXRpb25cbiAgICogaW4gdGhlIG91dHB1dCBkaXJlY3RvcnkuIElmIGdpdmVuIGFuIGFic29sdXRlIHBhdGgsIHRoZSBvdXRwdXQgd2lsbCBiZSBnZW5lcmF0ZWQgaW4gdGhlIHJvb3Qgb2YgdGhlIG91dHB1dCBkaXJlY3Rvcnkgd2l0aCB0aGUgc2FtZSBiYXNlXG4gICAqIG5hbWUuXG4gICAqL1xuICBlbnRyeVBvaW50cz86IFNldDxzdHJpbmc+O1xuXG4gIC8qKiBGaWxlIGV4dGVuc2lvbiB0byB1c2UgZm9yIHRoZSBnZW5lcmF0ZWQgb3V0cHV0IGZpbGVzLiAqL1xuICBvdXRFeHRlbnNpb24/OiAnanMnIHwgJ21qcyc7XG5cbiAgLyoqXG4gICAqIEluZGljYXRlcyB3aGV0aGVyIGFsbCBub2RlIHBhY2thZ2VzIHNob3VsZCBiZSBtYXJrZWQgYXMgZXh0ZXJuYWwuXG4gICAqIEN1cnJlbnRseSB1c2VkIGJ5IHRoZSBkZXYtc2VydmVyIHRvIHN1cHBvcnQgcHJlYnVuZGxpbmcuXG4gICAqL1xuICBleHRlcm5hbFBhY2thZ2VzPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogRm9yY2VzIHRoZSBvdXRwdXQgZnJvbSB0aGUgbG9jYWxpemUgcG9zdC1wcm9jZXNzaW5nIHRvIG5vdCBjcmVhdGUgbmVzdGVkIGRpcmVjdG9yaWVzIHBlciBsb2NhbGUgb3V0cHV0LlxuICAgKiBUaGlzIGlzIG9ubHkgdXNlZCBieSB0aGUgZGV2ZWxvcG1lbnQgc2VydmVyIHdoaWNoIGN1cnJlbnRseSBvbmx5IHN1cHBvcnRzIGEgc2luZ2xlIGxvY2FsZSBwZXIgYnVpbGQuXG4gICAqL1xuICBmb3JjZUkxOG5GbGF0T3V0cHV0PzogYm9vbGVhbjtcbn1cblxuLyoqIEZ1bGwgc2V0IG9mIG9wdGlvbnMgZm9yIGBhcHBsaWNhdGlvbmAgYnVpbGRlci4gKi9cbmV4cG9ydCB0eXBlIEFwcGxpY2F0aW9uQnVpbGRlckludGVybmFsT3B0aW9ucyA9IE9taXQ8XG4gIEFwcGxpY2F0aW9uQnVpbGRlck9wdGlvbnMgJiBJbnRlcm5hbE9wdGlvbnMsXG4gICdicm93c2VyJ1xuPiAmIHtcbiAgLy8gYGJyb3dzZXJgIGNhbiBiZSBgdW5kZWZpbmVkYCBpZiBgZW50cnlQb2ludHNgIGlzIHVzZWQuXG4gIGJyb3dzZXI/OiBzdHJpbmc7XG59O1xuXG4vKipcbiAqIE5vcm1hbGl6ZSB0aGUgdXNlciBwcm92aWRlZCBvcHRpb25zIGJ5IGNyZWF0aW5nIGZ1bGwgcGF0aHMgZm9yIGFsbCBwYXRoIGJhc2VkIG9wdGlvbnNcbiAqIGFuZCBjb252ZXJ0aW5nIG11bHRpLWZvcm0gb3B0aW9ucyBpbnRvIGEgc2luZ2xlIGZvcm0gdGhhdCBjYW4gYmUgZGlyZWN0bHkgdXNlZFxuICogYnkgdGhlIGJ1aWxkIHByb2Nlc3MuXG4gKlxuICogQHBhcmFtIGNvbnRleHQgVGhlIGNvbnRleHQgZm9yIGN1cnJlbnQgYnVpbGRlciBleGVjdXRpb24uXG4gKiBAcGFyYW0gcHJvamVjdE5hbWUgVGhlIG5hbWUgb2YgdGhlIHByb2plY3QgZm9yIHRoZSBjdXJyZW50IGV4ZWN1dGlvbi5cbiAqIEBwYXJhbSBvcHRpb25zIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBvcHRpb25zIHRvIHVzZSBmb3IgdGhlIGJ1aWxkLlxuICogQHJldHVybnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgbm9ybWFsaXplZCBvcHRpb25zIHJlcXVpcmVkIHRvIHBlcmZvcm0gdGhlIGJ1aWxkLlxuICovXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG5vcm1hbGl6ZU9wdGlvbnMoXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICBvcHRpb25zOiBBcHBsaWNhdGlvbkJ1aWxkZXJJbnRlcm5hbE9wdGlvbnMsXG4pIHtcbiAgY29uc3Qgd29ya3NwYWNlUm9vdCA9IGNvbnRleHQud29ya3NwYWNlUm9vdDtcbiAgY29uc3QgcHJvamVjdE1ldGFkYXRhID0gYXdhaXQgY29udGV4dC5nZXRQcm9qZWN0TWV0YWRhdGEocHJvamVjdE5hbWUpO1xuICBjb25zdCBwcm9qZWN0Um9vdCA9IG5vcm1hbGl6ZURpcmVjdG9yeVBhdGgoXG4gICAgcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIChwcm9qZWN0TWV0YWRhdGEucm9vdCBhcyBzdHJpbmcgfCB1bmRlZmluZWQpID8/ICcnKSxcbiAgKTtcbiAgY29uc3QgcHJvamVjdFNvdXJjZVJvb3QgPSBub3JtYWxpemVEaXJlY3RvcnlQYXRoKFxuICAgIHBhdGguam9pbih3b3Jrc3BhY2VSb290LCAocHJvamVjdE1ldGFkYXRhLnNvdXJjZVJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnc3JjJyksXG4gICk7XG5cbiAgLy8gR2F0aGVyIHBlcnNpc3RlbnQgY2FjaGluZyBvcHRpb24gYW5kIHByb3ZpZGUgYSBwcm9qZWN0IHNwZWNpZmljIGNhY2hlIGxvY2F0aW9uXG4gIGNvbnN0IGNhY2hlT3B0aW9ucyA9IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyhwcm9qZWN0TWV0YWRhdGEsIHdvcmtzcGFjZVJvb3QpO1xuICBjYWNoZU9wdGlvbnMucGF0aCA9IHBhdGguam9pbihjYWNoZU9wdGlvbnMucGF0aCwgcHJvamVjdE5hbWUpO1xuXG4gIGNvbnN0IGkxOG5PcHRpb25zOiBJMThuT3B0aW9ucyAmIHtcbiAgICBkdXBsaWNhdGVUcmFuc2xhdGlvbkJlaGF2aW9yPzogSTE4TlRyYW5zbGF0aW9uO1xuICAgIG1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yPzogSTE4TlRyYW5zbGF0aW9uO1xuICB9ID0gY3JlYXRlSTE4bk9wdGlvbnMocHJvamVjdE1ldGFkYXRhLCBvcHRpb25zLmxvY2FsaXplKTtcbiAgaTE4bk9wdGlvbnMuZHVwbGljYXRlVHJhbnNsYXRpb25CZWhhdmlvciA9IG9wdGlvbnMuaTE4bkR1cGxpY2F0ZVRyYW5zbGF0aW9uO1xuICBpMThuT3B0aW9ucy5taXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvciA9IG9wdGlvbnMuaTE4bk1pc3NpbmdUcmFuc2xhdGlvbjtcbiAgaWYgKG9wdGlvbnMuZm9yY2VJMThuRmxhdE91dHB1dCkge1xuICAgIGkxOG5PcHRpb25zLmZsYXRPdXRwdXQgPSB0cnVlO1xuICB9XG5cbiAgY29uc3QgZW50cnlQb2ludHMgPSBub3JtYWxpemVFbnRyeVBvaW50cyh3b3Jrc3BhY2VSb290LCBvcHRpb25zLmJyb3dzZXIsIG9wdGlvbnMuZW50cnlQb2ludHMpO1xuICBjb25zdCB0c2NvbmZpZyA9IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLnRzQ29uZmlnKTtcbiAgY29uc3Qgb3V0cHV0UGF0aCA9IG5vcm1hbGl6ZURpcmVjdG9yeVBhdGgocGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMub3V0cHV0UGF0aCkpO1xuICBjb25zdCBvcHRpbWl6YXRpb25PcHRpb25zID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKG9wdGlvbnMub3B0aW1pemF0aW9uKTtcbiAgY29uc3Qgc291cmNlbWFwT3B0aW9ucyA9IG5vcm1hbGl6ZVNvdXJjZU1hcHMob3B0aW9ucy5zb3VyY2VNYXAgPz8gZmFsc2UpO1xuICBjb25zdCBhc3NldHMgPSBvcHRpb25zLmFzc2V0cz8ubGVuZ3RoXG4gICAgPyBub3JtYWxpemVBc3NldFBhdHRlcm5zKG9wdGlvbnMuYXNzZXRzLCB3b3Jrc3BhY2VSb290LCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QpXG4gICAgOiB1bmRlZmluZWQ7XG5cbiAgY29uc3Qgb3V0cHV0TmFtZXMgPSB7XG4gICAgYnVuZGxlczpcbiAgICAgIG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5BbGwgfHwgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLkJ1bmRsZXNcbiAgICAgICAgPyAnW25hbWVdLVtoYXNoXSdcbiAgICAgICAgOiAnW25hbWVdJyxcbiAgICBtZWRpYTpcbiAgICAgICdtZWRpYS8nICtcbiAgICAgIChvcHRpb25zLm91dHB1dEhhc2hpbmcgPT09IE91dHB1dEhhc2hpbmcuQWxsIHx8IG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5NZWRpYVxuICAgICAgICA/ICdbbmFtZV0tW2hhc2hdJ1xuICAgICAgICA6ICdbbmFtZV0nKSxcbiAgfTtcblxuICBsZXQgZmlsZVJlcGxhY2VtZW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB8IHVuZGVmaW5lZDtcbiAgaWYgKG9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykge1xuICAgIGZvciAoY29uc3QgcmVwbGFjZW1lbnQgb2Ygb3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgICBmaWxlUmVwbGFjZW1lbnRzID8/PSB7fTtcbiAgICAgIGZpbGVSZXBsYWNlbWVudHNbcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIHJlcGxhY2VtZW50LnJlcGxhY2UpXSA9IHBhdGguam9pbihcbiAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgcmVwbGFjZW1lbnQud2l0aCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZ2xvYmFsU3R5bGVzOiB7IG5hbWU6IHN0cmluZzsgZmlsZXM6IHN0cmluZ1tdOyBpbml0aWFsOiBib29sZWFuIH1bXSA9IFtdO1xuICBpZiAob3B0aW9ucy5zdHlsZXM/Lmxlbmd0aCkge1xuICAgIGNvbnN0IHsgZW50cnlQb2ludHM6IHN0eWxlc2hlZXRFbnRyeXBvaW50cywgbm9JbmplY3ROYW1lcyB9ID0gbm9ybWFsaXplR2xvYmFsU3R5bGVzKFxuICAgICAgb3B0aW9ucy5zdHlsZXMgfHwgW10sXG4gICAgKTtcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBmaWxlc10gb2YgT2JqZWN0LmVudHJpZXMoc3R5bGVzaGVldEVudHJ5cG9pbnRzKSkge1xuICAgICAgZ2xvYmFsU3R5bGVzLnB1c2goeyBuYW1lLCBmaWxlcywgaW5pdGlhbDogIW5vSW5qZWN0TmFtZXMuaW5jbHVkZXMobmFtZSkgfSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZ2xvYmFsU2NyaXB0czogeyBuYW1lOiBzdHJpbmc7IGZpbGVzOiBzdHJpbmdbXTsgaW5pdGlhbDogYm9vbGVhbiB9W10gPSBbXTtcbiAgaWYgKG9wdGlvbnMuc2NyaXB0cz8ubGVuZ3RoKSB7XG4gICAgZm9yIChjb25zdCB7IGJ1bmRsZU5hbWUsIHBhdGhzLCBpbmplY3QgfSBvZiBnbG9iYWxTY3JpcHRzQnlCdW5kbGVOYW1lKG9wdGlvbnMuc2NyaXB0cykpIHtcbiAgICAgIGdsb2JhbFNjcmlwdHMucHVzaCh7IG5hbWU6IGJ1bmRsZU5hbWUsIGZpbGVzOiBwYXRocywgaW5pdGlhbDogaW5qZWN0IH0pO1xuICAgIH1cbiAgfVxuXG4gIGxldCB0YWlsd2luZENvbmZpZ3VyYXRpb246IHsgZmlsZTogc3RyaW5nOyBwYWNrYWdlOiBzdHJpbmcgfSB8IHVuZGVmaW5lZDtcbiAgY29uc3QgdGFpbHdpbmRDb25maWd1cmF0aW9uUGF0aCA9IGF3YWl0IGZpbmRUYWlsd2luZENvbmZpZ3VyYXRpb25GaWxlKHdvcmtzcGFjZVJvb3QsIHByb2plY3RSb290KTtcbiAgaWYgKHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgpIHtcbiAgICAvLyBDcmVhdGUgYSBub2RlIHJlc29sdmVyIGF0IHRoZSBwcm9qZWN0IHJvb3QgYXMgYSBkaXJlY3RvcnlcbiAgICBjb25zdCByZXNvbHZlciA9IGNyZWF0ZVJlcXVpcmUocHJvamVjdFJvb3QgKyAnLycpO1xuICAgIHRyeSB7XG4gICAgICB0YWlsd2luZENvbmZpZ3VyYXRpb24gPSB7XG4gICAgICAgIGZpbGU6IHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgsXG4gICAgICAgIHBhY2thZ2U6IHJlc29sdmVyLnJlc29sdmUoJ3RhaWx3aW5kY3NzJyksXG4gICAgICB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29uc3QgcmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGggPSBwYXRoLnJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIHRhaWx3aW5kQ29uZmlndXJhdGlvblBhdGgpO1xuICAgICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgICAgYFRhaWx3aW5kIENTUyBjb25maWd1cmF0aW9uIGZpbGUgZm91bmQgKCR7cmVsYXRpdmVUYWlsd2luZENvbmZpZ1BhdGh9KWAgK1xuICAgICAgICAgIGAgYnV0IHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UgaXMgbm90IGluc3RhbGxlZC5gICtcbiAgICAgICAgICBgIFRvIGVuYWJsZSBUYWlsd2luZCBDU1MsIHBsZWFzZSBpbnN0YWxsIHRoZSAndGFpbHdpbmRjc3MnIHBhY2thZ2UuYCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbGV0IGluZGV4SHRtbE9wdGlvbnM7XG4gIC8vIGluZGV4IGNhbiBuZXZlciBoYXZlIGEgdmFsdWUgb2YgYHRydWVgIGJ1dCBpbiB0aGUgc2NoZW1hIGl0J3Mgb2YgdHlwZSBgYm9vbGVhbmAuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucy5pbmRleCAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgaW5kZXhIdG1sT3B0aW9ucyA9IHtcbiAgICAgIGlucHV0OiBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgZ2V0SW5kZXhJbnB1dEZpbGUob3B0aW9ucy5pbmRleCkpLFxuICAgICAgLy8gVGhlIG91dHB1dCBmaWxlIHdpbGwgYmUgY3JlYXRlZCB3aXRoaW4gdGhlIGNvbmZpZ3VyZWQgb3V0cHV0IHBhdGhcbiAgICAgIG91dHB1dDogZ2V0SW5kZXhPdXRwdXRGaWxlKG9wdGlvbnMuaW5kZXgpLFxuICAgICAgLy8gVE9ETzogVXNlIGV4aXN0aW5nIGluZm9ybWF0aW9uIGZyb20gYWJvdmUgdG8gY3JlYXRlIHRoZSBpbnNlcnRpb24gb3JkZXJcbiAgICAgIGluc2VydGlvbk9yZGVyOiBnZW5lcmF0ZUVudHJ5UG9pbnRzKHtcbiAgICAgICAgc2NyaXB0czogb3B0aW9ucy5zY3JpcHRzID8/IFtdLFxuICAgICAgICBzdHlsZXM6IG9wdGlvbnMuc3R5bGVzID8/IFtdLFxuICAgICAgfSksXG4gICAgfTtcbiAgfVxuXG4gIGxldCBzZXJ2ZXJFbnRyeVBvaW50OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIGlmIChvcHRpb25zLnNlcnZlcikge1xuICAgIHNlcnZlckVudHJ5UG9pbnQgPSBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgb3B0aW9ucy5zZXJ2ZXIpO1xuICB9IGVsc2UgaWYgKG9wdGlvbnMuc2VydmVyID09PSAnJykge1xuICAgIHRocm93IG5ldyBFcnJvcignYHNlcnZlcmAgb3B0aW9uIGNhbm5vdCBiZSBhbiBlbXB0eSBzdHJpbmcuJyk7XG4gIH1cblxuICBsZXQgcHJlcmVuZGVyT3B0aW9ucztcbiAgaWYgKG9wdGlvbnMucHJlcmVuZGVyKSB7XG4gICAgY29uc3QgeyBkaXNjb3ZlclJvdXRlcyA9IHRydWUsIHJvdXRlc0ZpbGUgPSB1bmRlZmluZWQgfSA9XG4gICAgICBvcHRpb25zLnByZXJlbmRlciA9PT0gdHJ1ZSA/IHt9IDogb3B0aW9ucy5wcmVyZW5kZXI7XG5cbiAgICBwcmVyZW5kZXJPcHRpb25zID0ge1xuICAgICAgZGlzY292ZXJSb3V0ZXMsXG4gICAgICByb3V0ZXNGaWxlOiByb3V0ZXNGaWxlICYmIHBhdGguam9pbih3b3Jrc3BhY2VSb290LCByb3V0ZXNGaWxlKSxcbiAgICB9O1xuICB9XG5cbiAgbGV0IHNzck9wdGlvbnM7XG4gIGlmIChvcHRpb25zLnNzciA9PT0gdHJ1ZSkge1xuICAgIHNzck9wdGlvbnMgPSB7fTtcbiAgfSBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucy5zc3IgPT09ICdzdHJpbmcnKSB7XG4gICAgc3NyT3B0aW9ucyA9IHtcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgb3B0aW9ucy5zc3IpLFxuICAgIH07XG4gIH1cblxuICBsZXQgYXBwU2hlbGxPcHRpb25zO1xuICBpZiAob3B0aW9ucy5hcHBTaGVsbCkge1xuICAgIGFwcFNoZWxsT3B0aW9ucyA9IHtcbiAgICAgIHJvdXRlOiAnc2hlbGwnLFxuICAgIH07XG4gIH1cblxuICAvLyBJbml0aWFsIG9wdGlvbnMgdG8ga2VlcFxuICBjb25zdCB7XG4gICAgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgIGFvdCxcbiAgICBiYXNlSHJlZixcbiAgICBjcm9zc09yaWdpbixcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBleHRyYWN0TGljZW5zZXMsXG4gICAgaW5saW5lU3R5bGVMYW5ndWFnZSA9ICdjc3MnLFxuICAgIG91dEV4dGVuc2lvbixcbiAgICBzZXJ2aWNlV29ya2VyLFxuICAgIHBvbGwsXG4gICAgcG9seWZpbGxzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgc3RhdHNKc29uLFxuICAgIHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucyxcbiAgICBzdWJyZXNvdXJjZUludGVncml0eSxcbiAgICB2ZXJib3NlLFxuICAgIHdhdGNoLFxuICAgIHByb2dyZXNzID0gdHJ1ZSxcbiAgICBleHRlcm5hbFBhY2thZ2VzLFxuICAgIGRlbGV0ZU91dHB1dFBhdGgsXG4gICAgbmFtZWRDaHVua3MsXG4gICAgYnVkZ2V0cyxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgLy8gUmV0dXJuIGFsbCB0aGUgbm9ybWFsaXplZCBvcHRpb25zXG4gIHJldHVybiB7XG4gICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zOiAhIWFvdCxcbiAgICBhbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMsXG4gICAgYmFzZUhyZWYsXG4gICAgY2FjaGVPcHRpb25zLFxuICAgIGNyb3NzT3JpZ2luLFxuICAgIGRlbGV0ZU91dHB1dFBhdGgsXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgZXh0cmFjdExpY2Vuc2VzLFxuICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgaml0OiAhYW90LFxuICAgIHN0YXRzOiAhIXN0YXRzSnNvbixcbiAgICBwb2x5ZmlsbHM6IHBvbHlmaWxscyA9PT0gdW5kZWZpbmVkIHx8IEFycmF5LmlzQXJyYXkocG9seWZpbGxzKSA/IHBvbHlmaWxscyA6IFtwb2x5ZmlsbHNdLFxuICAgIHBvbGwsXG4gICAgcHJvZ3Jlc3MsXG4gICAgZXh0ZXJuYWxQYWNrYWdlcyxcbiAgICAvLyBJZiBub3QgZXhwbGljaXRseSBzZXQsIGRlZmF1bHQgdG8gdGhlIE5vZGUuanMgcHJvY2VzcyBhcmd1bWVudFxuICAgIHByZXNlcnZlU3ltbGlua3M6IHByZXNlcnZlU3ltbGlua3MgPz8gcHJvY2Vzcy5leGVjQXJndi5pbmNsdWRlcygnLS1wcmVzZXJ2ZS1zeW1saW5rcycpLFxuICAgIHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucyxcbiAgICBzdWJyZXNvdXJjZUludGVncml0eSxcbiAgICBzZXJ2ZXJFbnRyeVBvaW50LFxuICAgIHByZXJlbmRlck9wdGlvbnMsXG4gICAgYXBwU2hlbGxPcHRpb25zLFxuICAgIHNzck9wdGlvbnMsXG4gICAgdmVyYm9zZSxcbiAgICB3YXRjaCxcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgb3V0cHV0UGF0aCxcbiAgICBvdXRFeHRlbnNpb24sXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB0c2NvbmZpZyxcbiAgICBwcm9qZWN0Um9vdCxcbiAgICBhc3NldHMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgZmlsZVJlcGxhY2VtZW50cyxcbiAgICBnbG9iYWxTdHlsZXMsXG4gICAgZ2xvYmFsU2NyaXB0cyxcbiAgICBzZXJ2aWNlV29ya2VyOlxuICAgICAgdHlwZW9mIHNlcnZpY2VXb3JrZXIgPT09ICdzdHJpbmcnID8gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIHNlcnZpY2VXb3JrZXIpIDogdW5kZWZpbmVkLFxuICAgIGluZGV4SHRtbE9wdGlvbnMsXG4gICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICAgIGkxOG5PcHRpb25zLFxuICAgIG5hbWVkQ2h1bmtzLFxuICAgIGJ1ZGdldHM6IGJ1ZGdldHM/Lmxlbmd0aCA/IGJ1ZGdldHMgOiB1bmRlZmluZWQsXG4gIH07XG59XG5cbi8qKlxuICogTm9ybWFsaXplIGVudHJ5IHBvaW50IG9wdGlvbnMuIFRvIG1haW50YWluIGNvbXBhdGliaWxpdHkgd2l0aCB0aGUgbGVnYWN5IGJyb3dzZXIgYnVpbGRlciwgd2UgbmVlZCBhIHNpbmdsZSBgYnJvd3NlcmBcbiAqIG9wdGlvbiB3aGljaCBkZWZpbmVzIGEgc2luZ2xlIGVudHJ5IHBvaW50LiBIb3dldmVyLCB3ZSBhbHNvIHdhbnQgdG8gc3VwcG9ydCBtdWx0aXBsZSBlbnRyeSBwb2ludHMgYXMgYW4gaW50ZXJuYWwgb3B0aW9uLlxuICogVGhlIHR3byBvcHRpb25zIGFyZSBtdXR1YWxseSBleGNsdXNpdmUgYW5kIGlmIGBicm93c2VyYCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWQgYXMgdGhlIHNvbGUgZW50cnkgcG9pbnQuXG4gKiBJZiBgZW50cnlQb2ludHNgIGFyZSBwcm92aWRlZCwgdGhleSB3aWxsIGJlIHVzZWQgYXMgdGhlIHNldCBvZiBlbnRyeSBwb2ludHMuXG4gKlxuICogQHBhcmFtIHdvcmtzcGFjZVJvb3QgUGF0aCB0byB0aGUgcm9vdCBvZiB0aGUgQW5ndWxhciB3b3Jrc3BhY2UuXG4gKiBAcGFyYW0gYnJvd3NlciBUaGUgYGJyb3dzZXJgIG9wdGlvbiBwb2ludGluZyBhdCB0aGUgYXBwbGljYXRpb24gZW50cnkgcG9pbnQuIFdoaWxlIHJlcXVpcmVkIHBlciB0aGUgc2NoZW1hIGZpbGUsIGl0IG1heSBiZSBvbWl0dGVkIGJ5XG4gKiAgICAgcHJvZ3JhbW1hdGljIHVzYWdlcyBvZiBgYnJvd3Nlci1lc2J1aWxkYC5cbiAqIEBwYXJhbSBlbnRyeVBvaW50cyBTZXQgb2YgZW50cnkgcG9pbnRzIHRvIHVzZSBpZiBwcm92aWRlZC5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBtYXBwaW5nIGVudHJ5IHBvaW50IG5hbWVzIHRvIHRoZWlyIGZpbGUgcGF0aHMuXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZUVudHJ5UG9pbnRzKFxuICB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gIGJyb3dzZXI6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgZW50cnlQb2ludHM6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpLFxuKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gIGlmIChicm93c2VyID09PSAnJykge1xuICAgIHRocm93IG5ldyBFcnJvcignYGJyb3dzZXJgIG9wdGlvbiBjYW5ub3QgYmUgYW4gZW1wdHkgc3RyaW5nLicpO1xuICB9XG5cbiAgLy8gYGJyb3dzZXJgIGFuZCBgZW50cnlQb2ludHNgIGFyZSBtdXR1YWxseSBleGNsdXNpdmUuXG4gIGlmIChicm93c2VyICYmIGVudHJ5UG9pbnRzLnNpemUgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdPbmx5IG9uZSBvZiBgYnJvd3NlcmAgb3IgYGVudHJ5UG9pbnRzYCBtYXkgYmUgcHJvdmlkZWQuJyk7XG4gIH1cbiAgaWYgKCFicm93c2VyICYmIGVudHJ5UG9pbnRzLnNpemUgPT09IDApIHtcbiAgICAvLyBTY2hlbWEgc2hvdWxkIG5vcm1hbGx5IHJlamVjdCB0aGlzIGNhc2UsIGJ1dCBwcm9ncmFtbWF0aWMgdXNhZ2VzIG9mIHRoZSBidWlsZGVyIG1pZ2h0IG1ha2UgdGhpcyBtaXN0YWtlLlxuICAgIHRocm93IG5ldyBFcnJvcignRWl0aGVyIGBicm93c2VyYCBvciBhdCBsZWFzdCBvbmUgYGVudHJ5UG9pbnRzYCB2YWx1ZSBtdXN0IGJlIHByb3ZpZGVkLicpO1xuICB9XG5cbiAgLy8gU2NoZW1hIHR5cGVzIGZvcmNlIGBicm93c2VyYCB0byBhbHdheXMgYmUgcHJvdmlkZWQsIGJ1dCBpdCBtYXkgYmUgb21pdHRlZCB3aGVuIHRoZSBidWlsZGVyIGlzIGludm9rZWQgcHJvZ3JhbW1hdGljYWxseS5cbiAgaWYgKGJyb3dzZXIpIHtcbiAgICAvLyBVc2UgYGJyb3dzZXJgIGFsb25lLlxuICAgIHJldHVybiB7ICdtYWluJzogcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGJyb3dzZXIpIH07XG4gIH0gZWxzZSB7XG4gICAgLy8gVXNlIGBlbnRyeVBvaW50c2AgYWxvbmUuXG4gICAgY29uc3QgZW50cnlQb2ludFBhdGhzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgZm9yIChjb25zdCBlbnRyeVBvaW50IG9mIGVudHJ5UG9pbnRzKSB7XG4gICAgICBjb25zdCBwYXJzZWRFbnRyeVBvaW50ID0gcGF0aC5wYXJzZShlbnRyeVBvaW50KTtcblxuICAgICAgLy8gVXNlIHRoZSBpbnB1dCBmaWxlIHBhdGggd2l0aG91dCBhbiBleHRlbnNpb24gYXMgdGhlIFwibmFtZVwiIG9mIHRoZSBlbnRyeSBwb2ludCBkaWN0YXRpbmcgaXRzIG91dHB1dCBsb2NhdGlvbi5cbiAgICAgIC8vIFJlbGF0aXZlIGVudHJ5IHBvaW50cyBhcmUgZ2VuZXJhdGVkIGF0IHRoZSBzYW1lIHJlbGF0aXZlIHBhdGggaW4gdGhlIG91dHB1dCBkaXJlY3RvcnkuXG4gICAgICAvLyBBYnNvbHV0ZSBlbnRyeSBwb2ludHMgYXJlIGFsd2F5cyBnZW5lcmF0ZWQgd2l0aCB0aGUgc2FtZSBmaWxlIG5hbWUgaW4gdGhlIHJvb3Qgb2YgdGhlIG91dHB1dCBkaXJlY3RvcnkuIFRoaXMgaW5jbHVkZXMgYWJzb2x1dGVcbiAgICAgIC8vIHBhdGhzIHBvaW50aW5nIGF0IGZpbGVzIGFjdHVhbGx5IHdpdGhpbiB0aGUgd29ya3NwYWNlIHJvb3QuXG4gICAgICBjb25zdCBlbnRyeVBvaW50TmFtZSA9IHBhdGguaXNBYnNvbHV0ZShlbnRyeVBvaW50KVxuICAgICAgICA/IHBhcnNlZEVudHJ5UG9pbnQubmFtZVxuICAgICAgICA6IHBhdGguam9pbihwYXJzZWRFbnRyeVBvaW50LmRpciwgcGFyc2VkRW50cnlQb2ludC5uYW1lKTtcblxuICAgICAgLy8gR2V0IHRoZSBmdWxsIGZpbGUgcGF0aCB0byB0aGUgZW50cnkgcG9pbnQgaW5wdXQuXG4gICAgICBjb25zdCBlbnRyeVBvaW50UGF0aCA9IHBhdGguaXNBYnNvbHV0ZShlbnRyeVBvaW50KVxuICAgICAgICA/IGVudHJ5UG9pbnRcbiAgICAgICAgOiBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgZW50cnlQb2ludCk7XG5cbiAgICAgIC8vIENoZWNrIGZvciBjb25mbGljdHMgd2l0aCBwcmV2aW91cyBlbnRyeSBwb2ludHMuXG4gICAgICBjb25zdCBleGlzdGluZ0VudHJ5UG9pbnRQYXRoID0gZW50cnlQb2ludFBhdGhzW2VudHJ5UG9pbnROYW1lXTtcbiAgICAgIGlmIChleGlzdGluZ0VudHJ5UG9pbnRQYXRoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgXFxgJHtleGlzdGluZ0VudHJ5UG9pbnRQYXRofVxcYCBhbmQgXFxgJHtlbnRyeVBvaW50UGF0aH1cXGAgYm90aCBvdXRwdXQgdG8gdGhlIHNhbWUgbG9jYXRpb24gXFxgJHtlbnRyeVBvaW50TmFtZX1cXGAuYCArXG4gICAgICAgICAgICAnIFJlbmFtZSBvciBtb3ZlIG9uZSBvZiB0aGUgZmlsZXMgdG8gZml4IHRoZSBjb25mbGljdC4nLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBlbnRyeVBvaW50UGF0aHNbZW50cnlQb2ludE5hbWVdID0gZW50cnlQb2ludFBhdGg7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVudHJ5UG9pbnRQYXRocztcbiAgfVxufVxuXG4vKipcbiAqIE5vcm1hbGl6ZSBhIGRpcmVjdG9yeSBwYXRoIHN0cmluZy5cbiAqIEN1cnJlbnRseSBvbmx5IHJlbW92ZXMgYSB0cmFpbGluZyBzbGFzaCBpZiBwcmVzZW50LlxuICogQHBhcmFtIHBhdGggQSBwYXRoIHN0cmluZy5cbiAqIEByZXR1cm5zIEEgbm9ybWFsaXplZCBwYXRoIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplRGlyZWN0b3J5UGF0aChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBsYXN0ID0gcGF0aFtwYXRoLmxlbmd0aCAtIDFdO1xuICBpZiAobGFzdCA9PT0gJy8nIHx8IGxhc3QgPT09ICdcXFxcJykge1xuICAgIHJldHVybiBwYXRoLnNsaWNlKDAsIC0xKTtcbiAgfVxuXG4gIHJldHVybiBwYXRoO1xufVxuIl19