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
const node_fs_1 = __importDefault(require("node:fs"));
const node_module_1 = require("node:module");
const node_path_1 = __importDefault(require("node:path"));
const utils_1 = require("../../utils");
const normalize_cache_1 = require("../../utils/normalize-cache");
const package_chunk_sort_1 = require("../../utils/package-chunk-sort");
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
    const projectRoot = node_path_1.default.join(workspaceRoot, projectMetadata.root ?? '');
    const projectSourceRoot = node_path_1.default.join(workspaceRoot, projectMetadata.sourceRoot ?? 'src');
    const cacheOptions = (0, normalize_cache_1.normalizeCacheOptions)(projectMetadata, workspaceRoot);
    const mainEntryPoint = node_path_1.default.join(workspaceRoot, options.main);
    const tsconfig = node_path_1.default.join(workspaceRoot, options.tsConfig);
    const outputPath = node_path_1.default.join(workspaceRoot, options.outputPath);
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
    const tailwindConfigurationPath = findTailwindConfigurationFile(workspaceRoot, projectRoot);
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
    // Setup bundler entry points
    const entryPoints = {
        main: mainEntryPoint,
    };
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
    const { allowedCommonJsDependencies, aot, baseHref, buildOptimizer, crossOrigin, externalDependencies, extractLicenses, inlineStyleLanguage = 'css', poll, polyfills, preserveSymlinks, statsJson, stylePreprocessorOptions, subresourceIntegrity, verbose, watch, } = options;
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
function findTailwindConfigurationFile(workspaceRoot, projectRoot) {
    // A configuration file can exist in the project or workspace root
    // The list of valid config files can be found:
    // https://github.com/tailwindlabs/tailwindcss/blob/8845d112fb62d79815b50b3bae80c317450b8b92/src/util/resolveConfigPath.js#L46-L52
    const tailwindConfigFiles = ['tailwind.config.js', 'tailwind.config.cjs'];
    for (const basePath of [projectRoot, workspaceRoot]) {
        for (const configFile of tailwindConfigFiles) {
            // Project level configuration should always take precedence.
            const fullPath = node_path_1.default.join(basePath, configFile);
            if (node_fs_1.default.existsSync(fullPath)) {
                return fullPath;
            }
        }
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9vcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILHNEQUF5QjtBQUN6Qiw2Q0FBNEM7QUFDNUMsMERBQTZCO0FBQzdCLHVDQUFpRztBQUNqRyxpRUFBb0U7QUFDcEUsdUVBQXFFO0FBQ3JFLCtFQUEyRjtBQUMzRix5REFBK0Y7QUFDL0YscUNBQTBFO0FBSTFFOzs7Ozs7Ozs7R0FTRztBQUNJLEtBQUssVUFBVSxnQkFBZ0IsQ0FDcEMsT0FBdUIsRUFDdkIsV0FBbUIsRUFDbkIsT0FBOEI7SUFFOUIsTUFBTSxhQUFhLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUM1QyxNQUFNLGVBQWUsR0FBRyxNQUFNLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN0RSxNQUFNLFdBQVcsR0FBRyxtQkFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUcsZUFBZSxDQUFDLElBQTJCLElBQUksRUFBRSxDQUFDLENBQUM7SUFDakcsTUFBTSxpQkFBaUIsR0FBRyxtQkFBSSxDQUFDLElBQUksQ0FDakMsYUFBYSxFQUNaLGVBQWUsQ0FBQyxVQUFpQyxJQUFJLEtBQUssQ0FDNUQsQ0FBQztJQUVGLE1BQU0sWUFBWSxHQUFHLElBQUEsdUNBQXFCLEVBQUMsZUFBZSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBRTNFLE1BQU0sY0FBYyxHQUFHLG1CQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUQsTUFBTSxRQUFRLEdBQUcsbUJBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMs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QUNMLGFBQWE7UUFDYixXQUFXO1FBQ1gsbUJBQW1CO1FBQ25CLFVBQVU7UUFDVixnQkFBZ0I7UUFDaEIsUUFBUTtRQUNSLFdBQVc7UUFDWCxNQUFNO1FBQ04sV0FBVztRQUNYLGdCQUFnQjtRQUNoQixZQUFZO1FBQ1osYUFBYTtRQUNiLG9CQUFvQjtRQUNwQixnQkFBZ0I7UUFDaEIscUJBQXFCO0tBQ3RCLENBQUM7QUFDSixDQUFDO0FBektELDRDQXlLQztBQUVELFNBQVMsNkJBQTZCLENBQ3BDLGFBQXFCLEVBQ3JCLFdBQW1CO0lBRW5CLGtFQUFrRTtJQUNsRSwrQ0FBK0M7SUFDL0Msa0lBQWtJO0lBQ2xJLE1BQU0sbUJBQW1CLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO0lBQzFFLEtBQUssTUFBTSxRQUFRLElBQUksQ0FBQyxXQUFXLEVBQUUsYUFBYSxDQUFDLEVBQUU7UUFDbkQsS0FBSyxNQUFNLFVBQVUsSUFBSSxtQkFBbUIsRUFBRTtZQUM1Qyw2REFBNkQ7WUFDN0QsTUFBTSxRQUFRLEdBQUcsbUJBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQ2pELElBQUksaUJBQUUsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQzNCLE9BQU8sUUFBUSxDQUFDO2FBQ2pCO1NBQ0Y7S0FDRjtJQUVELE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzJztcbmltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdub2RlOm1vZHVsZSc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgbm9ybWFsaXplQXNzZXRQYXR0ZXJucywgbm9ybWFsaXplT3B0aW1pemF0aW9uLCBub3JtYWxpemVTb3VyY2VNYXBzIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgbm9ybWFsaXplQ2FjaGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvbm9ybWFsaXplLWNhY2hlJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMgfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgZ2V0SW5kZXhJbnB1dEZpbGUsIGdldEluZGV4T3V0cHV0RmlsZSB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgZ2xvYmFsU2NyaXB0c0J5QnVuZGxlTmFtZSwgbm9ybWFsaXplR2xvYmFsU3R5bGVzIH0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9oZWxwZXJzJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMsIE91dHB1dEhhc2hpbmcgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmV4cG9ydCB0eXBlIE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyA9IEF3YWl0ZWQ8UmV0dXJuVHlwZTx0eXBlb2Ygbm9ybWFsaXplT3B0aW9ucz4+O1xuXG4vKipcbiAqIE5vcm1hbGl6ZSB0aGUgdXNlciBwcm92aWRlZCBvcHRpb25zIGJ5IGNyZWF0aW5nIGZ1bGwgcGF0aHMgZm9yIGFsbCBwYXRoIGJhc2VkIG9wdGlvbnNcbiAqIGFuZCBjb252ZXJ0aW5nIG11bHRpLWZvcm0gb3B0aW9ucyBpbnRvIGEgc2luZ2xlIGZvcm0gdGhhdCBjYW4gYmUgZGlyZWN0bHkgdXNlZFxuICogYnkgdGhlIGJ1aWxkIHByb2Nlc3MuXG4gKlxuICogQHBhcmFtIGNvbnRleHQgVGhlIGNvbnRleHQgZm9yIGN1cnJlbnQgYnVpbGRlciBleGVjdXRpb24uXG4gKiBAcGFyYW0gcHJvamVjdE5hbWUgVGhlIG5hbWUgb2YgdGhlIHByb2plY3QgZm9yIHRoZSBjdXJyZW50IGV4ZWN1dGlvbi5cbiAqIEBwYXJhbSBvcHRpb25zIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBvcHRpb25zIHRvIHVzZSBmb3IgdGhlIGJ1aWxkLlxuICogQHJldHVybnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgbm9ybWFsaXplZCBvcHRpb25zIHJlcXVpcmVkIHRvIHBlcmZvcm0gdGhlIGJ1aWxkLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbm9ybWFsaXplT3B0aW9ucyhcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gIG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbikge1xuICBjb25zdCB3b3Jrc3BhY2VSb290ID0gY29udGV4dC53b3Jrc3BhY2VSb290O1xuICBjb25zdCBwcm9qZWN0TWV0YWRhdGEgPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gIGNvbnN0IHByb2plY3RSb290ID0gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIChwcm9qZWN0TWV0YWRhdGEucm9vdCBhcyBzdHJpbmcgfCB1bmRlZmluZWQpID8/ICcnKTtcbiAgY29uc3QgcHJvamVjdFNvdXJjZVJvb3QgPSBwYXRoLmpvaW4oXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICAocHJvamVjdE1ldGFkYXRhLnNvdXJjZVJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnc3JjJyxcbiAgKTtcblxuICBjb25zdCBjYWNoZU9wdGlvbnMgPSBub3JtYWxpemVDYWNoZU9wdGlvbnMocHJvamVjdE1ldGFkYXRhLCB3b3Jrc3BhY2VSb290KTtcblxuICBjb25zdCBtYWluRW50cnlQb2ludCA9IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLm1haW4pO1xuICBjb25zdCB0c2NvbmZpZyA9IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLnRzQ29uZmlnKTtcbiAgY29uc3Qgb3V0cHV0UGF0aCA9IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLm91dHB1dFBhdGgpO1xuICBjb25zdCBvcHRpbWl6YXRpb25PcHRpb25zID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKG9wdGlvbnMub3B0aW1pemF0aW9uKTtcbiAgY29uc3Qgc291cmNlbWFwT3B0aW9ucyA9IG5vcm1hbGl6ZVNvdXJjZU1hcHMob3B0aW9ucy5zb3VyY2VNYXAgPz8gZmFsc2UpO1xuICBjb25zdCBhc3NldHMgPSBvcHRpb25zLmFzc2V0cz8ubGVuZ3RoXG4gICAgPyBub3JtYWxpemVBc3NldFBhdHRlcm5zKG9wdGlvbnMuYXNzZXRzLCB3b3Jrc3BhY2VSb290LCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QpXG4gICAgOiB1bmRlZmluZWQ7XG5cbiAgY29uc3Qgb3V0cHV0TmFtZXMgPSB7XG4gICAgYnVuZGxlczpcbiAgICAgIG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5BbGwgfHwgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLkJ1bmRsZXNcbiAgICAgICAgPyAnW25hbWVdLltoYXNoXSdcbiAgICAgICAgOiAnW25hbWVdJyxcbiAgICBtZWRpYTpcbiAgICAgIG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5BbGwgfHwgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLk1lZGlhXG4gICAgICAgID8gJ1tuYW1lXS5baGFzaF0nXG4gICAgICAgIDogJ1tuYW1lXScsXG4gIH07XG4gIGlmIChvcHRpb25zLnJlc291cmNlc091dHB1dFBhdGgpIHtcbiAgICBvdXRwdXROYW1lcy5tZWRpYSA9IHBhdGguam9pbihvcHRpb25zLnJlc291cmNlc091dHB1dFBhdGgsIG91dHB1dE5hbWVzLm1lZGlhKTtcbiAgfVxuXG4gIGxldCBmaWxlUmVwbGFjZW1lbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHwgdW5kZWZpbmVkO1xuICBpZiAob3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgZm9yIChjb25zdCByZXBsYWNlbWVudCBvZiBvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpIHtcbiAgICAgIGZpbGVSZXBsYWNlbWVudHMgPz89IHt9O1xuICAgICAgZmlsZVJlcGxhY2VtZW50c1twYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgcmVwbGFjZW1lbnQucmVwbGFjZSldID0gcGF0aC5qb2luKFxuICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICByZXBsYWNlbWVudC53aXRoLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBnbG9iYWxTdHlsZXM6IHsgbmFtZTogc3RyaW5nOyBmaWxlczogc3RyaW5nW107IGluaXRpYWw6IGJvb2xlYW4gfVtdID0gW107XG4gIGlmIChvcHRpb25zLnN0eWxlcz8ubGVuZ3RoKSB7XG4gICAgY29uc3QgeyBlbnRyeVBvaW50czogc3R5bGVzaGVldEVudHJ5cG9pbnRzLCBub0luamVjdE5hbWVzIH0gPSBub3JtYWxpemVHbG9iYWxTdHlsZXMoXG4gICAgICBvcHRpb25zLnN0eWxlcyB8fCBbXSxcbiAgICApO1xuICAgIGZvciAoY29uc3QgW25hbWUsIGZpbGVzXSBvZiBPYmplY3QuZW50cmllcyhzdHlsZXNoZWV0RW50cnlwb2ludHMpKSB7XG4gICAgICBnbG9iYWxTdHlsZXMucHVzaCh7IG5hbWUsIGZpbGVzLCBpbml0aWFsOiAhbm9JbmplY3ROYW1lcy5pbmNsdWRlcyhuYW1lKSB9KTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBnbG9iYWxTY3JpcHRzOiB7IG5hbWU6IHN0cmluZzsgZmlsZXM6IHN0cmluZ1tdOyBpbml0aWFsOiBib29sZWFuIH1bXSA9IFtdO1xuICBpZiAob3B0aW9ucy5zY3JpcHRzPy5sZW5ndGgpIHtcbiAgICBmb3IgKGNvbnN0IHsgYnVuZGxlTmFtZSwgcGF0aHMsIGluamVjdCB9IG9mIGdsb2JhbFNjcmlwdHNCeUJ1bmRsZU5hbWUob3B0aW9ucy5zY3JpcHRzKSkge1xuICAgICAgZ2xvYmFsU2NyaXB0cy5wdXNoKHsgbmFtZTogYnVuZGxlTmFtZSwgZmlsZXM6IHBhdGhzLCBpbml0aWFsOiBpbmplY3QgfSk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHRhaWx3aW5kQ29uZmlndXJhdGlvbjogeyBmaWxlOiBzdHJpbmc7IHBhY2thZ2U6IHN0cmluZyB9IHwgdW5kZWZpbmVkO1xuICBjb25zdCB0YWlsd2luZENvbmZpZ3VyYXRpb25QYXRoID0gZmluZFRhaWx3aW5kQ29uZmlndXJhdGlvbkZpbGUod29ya3NwYWNlUm9vdCwgcHJvamVjdFJvb3QpO1xuICBpZiAodGFpbHdpbmRDb25maWd1cmF0aW9uUGF0aCkge1xuICAgIC8vIENyZWF0ZSBhIG5vZGUgcmVzb2x2ZXIgYXQgdGhlIHByb2plY3Qgcm9vdCBhcyBhIGRpcmVjdG9yeVxuICAgIGNvbnN0IHJlc29sdmVyID0gY3JlYXRlUmVxdWlyZShwcm9qZWN0Um9vdCArICcvJyk7XG4gICAgdHJ5IHtcbiAgICAgIHRhaWx3aW5kQ29uZmlndXJhdGlvbiA9IHtcbiAgICAgICAgZmlsZTogdGFpbHdpbmRDb25maWd1cmF0aW9uUGF0aCxcbiAgICAgICAgcGFja2FnZTogcmVzb2x2ZXIucmVzb2x2ZSgndGFpbHdpbmRjc3MnKSxcbiAgICAgIH07XG4gICAgfSBjYXRjaCB7XG4gICAgICBjb25zdCByZWxhdGl2ZVRhaWx3aW5kQ29uZmlnUGF0aCA9IHBhdGgucmVsYXRpdmUod29ya3NwYWNlUm9vdCwgdGFpbHdpbmRDb25maWd1cmF0aW9uUGF0aCk7XG4gICAgICBjb250ZXh0LmxvZ2dlci53YXJuKFxuICAgICAgICBgVGFpbHdpbmQgQ1NTIGNvbmZpZ3VyYXRpb24gZmlsZSBmb3VuZCAoJHtyZWxhdGl2ZVRhaWx3aW5kQ29uZmlnUGF0aH0pYCArXG4gICAgICAgICAgYCBidXQgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZSBpcyBub3QgaW5zdGFsbGVkLmAgK1xuICAgICAgICAgIGAgVG8gZW5hYmxlIFRhaWx3aW5kIENTUywgcGxlYXNlIGluc3RhbGwgdGhlICd0YWlsd2luZGNzcycgcGFja2FnZS5gLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBsZXQgc2VydmljZVdvcmtlck9wdGlvbnM7XG4gIGlmIChvcHRpb25zLnNlcnZpY2VXb3JrZXIpIHtcbiAgICAvLyBJZiBuZ3N3Q29uZmlnUGF0aCBpcyBub3Qgc3BlY2lmaWVkLCB0aGUgZGVmYXVsdCBpcyAnbmdzdy1jb25maWcuanNvbicgd2l0aGluIHRoZSBwcm9qZWN0IHJvb3RcbiAgICBzZXJ2aWNlV29ya2VyT3B0aW9ucyA9IG9wdGlvbnMubmdzd0NvbmZpZ1BhdGhcbiAgICAgID8gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMubmdzd0NvbmZpZ1BhdGgpXG4gICAgICA6IHBhdGguam9pbihwcm9qZWN0Um9vdCwgJ25nc3ctY29uZmlnLmpzb24nKTtcbiAgfVxuXG4gIC8vIFNldHVwIGJ1bmRsZXIgZW50cnkgcG9pbnRzXG4gIGNvbnN0IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgIG1haW46IG1haW5FbnRyeVBvaW50LFxuICB9O1xuXG4gIGxldCBpbmRleEh0bWxPcHRpb25zO1xuICBpZiAob3B0aW9ucy5pbmRleCkge1xuICAgIGluZGV4SHRtbE9wdGlvbnMgPSB7XG4gICAgICBpbnB1dDogcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGdldEluZGV4SW5wdXRGaWxlKG9wdGlvbnMuaW5kZXgpKSxcbiAgICAgIC8vIFRoZSBvdXRwdXQgZmlsZSB3aWxsIGJlIGNyZWF0ZWQgd2l0aGluIHRoZSBjb25maWd1cmVkIG91dHB1dCBwYXRoXG4gICAgICBvdXRwdXQ6IGdldEluZGV4T3V0cHV0RmlsZShvcHRpb25zLmluZGV4KSxcbiAgICAgIC8vIFRPRE86IFVzZSBleGlzdGluZyBpbmZvcm1hdGlvbiBmcm9tIGFib3ZlIHRvIGNyZWF0ZSB0aGUgaW5zZXJ0aW9uIG9yZGVyXG4gICAgICBpbnNlcnRpb25PcmRlcjogZ2VuZXJhdGVFbnRyeVBvaW50cyh7XG4gICAgICAgIHNjcmlwdHM6IG9wdGlvbnMuc2NyaXB0cyA/PyBbXSxcbiAgICAgICAgc3R5bGVzOiBvcHRpb25zLnN0eWxlcyA/PyBbXSxcbiAgICAgIH0pLFxuICAgIH07XG4gIH1cblxuICAvLyBJbml0aWFsIG9wdGlvbnMgdG8ga2VlcFxuICBjb25zdCB7XG4gICAgYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzLFxuICAgIGFvdCxcbiAgICBiYXNlSHJlZixcbiAgICBidWlsZE9wdGltaXplcixcbiAgICBjcm9zc09yaWdpbixcbiAgICBleHRlcm5hbERlcGVuZGVuY2llcyxcbiAgICBleHRyYWN0TGljZW5zZXMsXG4gICAgaW5saW5lU3R5bGVMYW5ndWFnZSA9ICdjc3MnLFxuICAgIHBvbGwsXG4gICAgcG9seWZpbGxzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgc3RhdHNKc29uLFxuICAgIHN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucyxcbiAgICBzdWJyZXNvdXJjZUludGVncml0eSxcbiAgICB2ZXJib3NlLFxuICAgIHdhdGNoLFxuICB9ID0gb3B0aW9ucztcblxuICAvLyBSZXR1cm4gYWxsIHRoZSBub3JtYWxpemVkIG9wdGlvbnNcbiAgcmV0dXJuIHtcbiAgICBhZHZhbmNlZE9wdGltaXphdGlvbnM6IGJ1aWxkT3B0aW1pemVyLFxuICAgIGFsbG93ZWRDb21tb25Kc0RlcGVuZGVuY2llcyxcbiAgICBiYXNlSHJlZixcbiAgICBjYWNoZU9wdGlvbnMsXG4gICAgY3Jvc3NPcmlnaW4sXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgZXh0cmFjdExpY2Vuc2VzLFxuICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgaml0OiAhYW90LFxuICAgIHN0YXRzOiAhIXN0YXRzSnNvbixcbiAgICBwb2x5ZmlsbHM6IHBvbHlmaWxscyA9PT0gdW5kZWZpbmVkIHx8IEFycmF5LmlzQXJyYXkocG9seWZpbGxzKSA/IHBvbHlmaWxscyA6IFtwb2x5ZmlsbHNdLFxuICAgIHBvbGwsXG4gICAgLy8gSWYgbm90IGV4cGxpY2l0bHkgc2V0LCBkZWZhdWx0IHRvIHRoZSBOb2RlLmpzIHByb2Nlc3MgYXJndW1lbnRcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzOiBwcmVzZXJ2ZVN5bWxpbmtzID8/IHByb2Nlc3MuZXhlY0FyZ3YuaW5jbHVkZXMoJy0tcHJlc2VydmUtc3ltbGlua3MnKSxcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgdmVyYm9zZSxcbiAgICB3YXRjaCxcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgb3V0cHV0UGF0aCxcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICAgIHByb2plY3RSb290LFxuICAgIGFzc2V0cyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgIGdsb2JhbFN0eWxlcyxcbiAgICBnbG9iYWxTY3JpcHRzLFxuICAgIHNlcnZpY2VXb3JrZXJPcHRpb25zLFxuICAgIGluZGV4SHRtbE9wdGlvbnMsXG4gICAgdGFpbHdpbmRDb25maWd1cmF0aW9uLFxuICB9O1xufVxuXG5mdW5jdGlvbiBmaW5kVGFpbHdpbmRDb25maWd1cmF0aW9uRmlsZShcbiAgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICBwcm9qZWN0Um9vdDogc3RyaW5nLFxuKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgLy8gQSBjb25maWd1cmF0aW9uIGZpbGUgY2FuIGV4aXN0IGluIHRoZSBwcm9qZWN0IG9yIHdvcmtzcGFjZSByb290XG4gIC8vIFRoZSBsaXN0IG9mIHZhbGlkIGNvbmZpZyBmaWxlcyBjYW4gYmUgZm91bmQ6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS90YWlsd2luZGxhYnMvdGFpbHdpbmRjc3MvYmxvYi84ODQ1ZDExMmZiNjJkNzk4MTViNTBiM2JhZTgwYzMxNzQ1MGI4YjkyL3NyYy91dGlsL3Jlc29sdmVDb25maWdQYXRoLmpzI0w0Ni1MNTJcbiAgY29uc3QgdGFpbHdpbmRDb25maWdGaWxlcyA9IFsndGFpbHdpbmQuY29uZmlnLmpzJywgJ3RhaWx3aW5kLmNvbmZpZy5janMnXTtcbiAgZm9yIChjb25zdCBiYXNlUGF0aCBvZiBbcHJvamVjdFJvb3QsIHdvcmtzcGFjZVJvb3RdKSB7XG4gICAgZm9yIChjb25zdCBjb25maWdGaWxlIG9mIHRhaWx3aW5kQ29uZmlnRmlsZXMpIHtcbiAgICAgIC8vIFByb2plY3QgbGV2ZWwgY29uZmlndXJhdGlvbiBzaG91bGQgYWx3YXlzIHRha2UgcHJlY2VkZW5jZS5cbiAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGJhc2VQYXRoLCBjb25maWdGaWxlKTtcbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKGZ1bGxQYXRoKSkge1xuICAgICAgICByZXR1cm4gZnVsbFBhdGg7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cbiJdfQ==