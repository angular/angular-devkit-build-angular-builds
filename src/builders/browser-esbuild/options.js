"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeOptions = void 0;
const path = __importStar(require("path"));
const utils_1 = require("../../utils");
const normalize_cache_1 = require("../../utils/normalize-cache");
const normalize_polyfills_1 = require("../../utils/normalize-polyfills");
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
    var _a, _b, _c, _d, _e, _f, _g;
    const workspaceRoot = context.workspaceRoot;
    const projectMetadata = await context.getProjectMetadata(projectName);
    const projectRoot = path.join(workspaceRoot, (_a = projectMetadata.root) !== null && _a !== void 0 ? _a : '');
    const projectSourceRoot = path.join(workspaceRoot, (_b = projectMetadata.sourceRoot) !== null && _b !== void 0 ? _b : 'src');
    const cacheOptions = (0, normalize_cache_1.normalizeCacheOptions)(projectMetadata, workspaceRoot);
    const mainEntryPoint = path.join(workspaceRoot, options.main);
    // Currently esbuild do not support multiple files per entry-point
    const [polyfillsEntryPoint, ...remainingPolyfills] = (0, normalize_polyfills_1.normalizePolyfills)(options.polyfills, workspaceRoot);
    if (remainingPolyfills.length) {
        context.logger.warn(`The 'polyfills' option currently does not support multiple entries by this experimental builder. The first entry will be used.`);
    }
    const tsconfig = path.join(workspaceRoot, options.tsConfig);
    const outputPath = path.join(workspaceRoot, options.outputPath);
    const optimizationOptions = (0, utils_1.normalizeOptimization)(options.optimization);
    const sourcemapOptions = (0, utils_1.normalizeSourceMaps)((_c = options.sourceMap) !== null && _c !== void 0 ? _c : false);
    const assets = ((_d = options.assets) === null || _d === void 0 ? void 0 : _d.length)
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
        outputNames.media = path.join(options.resourcesOutputPath, outputNames.media);
    }
    let fileReplacements;
    if (options.fileReplacements) {
        for (const replacement of options.fileReplacements) {
            fileReplacements !== null && fileReplacements !== void 0 ? fileReplacements : (fileReplacements = {});
            fileReplacements[path.join(workspaceRoot, replacement.replace)] = path.join(workspaceRoot, replacement.with);
        }
    }
    const globalStyles = [];
    if ((_e = options.styles) === null || _e === void 0 ? void 0 : _e.length) {
        const { entryPoints: stylesheetEntrypoints, noInjectNames } = (0, helpers_1.normalizeGlobalStyles)(options.styles || []);
        for (const [name, files] of Object.entries(stylesheetEntrypoints)) {
            globalStyles.push({ name, files, initial: !noInjectNames.includes(name) });
        }
    }
    let serviceWorkerOptions;
    if (options.serviceWorker) {
        // If ngswConfigPath is not specified, the default is 'ngsw-config.json' within the project root
        serviceWorkerOptions = options.ngswConfigPath
            ? path.join(workspaceRoot, options.ngswConfigPath)
            : path.join(projectRoot, 'ngsw-config.json');
    }
    // Setup bundler entry points
    const entryPoints = {
        main: mainEntryPoint,
    };
    if (polyfillsEntryPoint) {
        entryPoints['polyfills'] = polyfillsEntryPoint;
    }
    let indexHtmlOptions;
    if (options.index) {
        indexHtmlOptions = {
            input: path.join(workspaceRoot, (0, webpack_browser_config_1.getIndexInputFile)(options.index)),
            // The output file will be created within the configured output path
            output: (0, webpack_browser_config_1.getIndexOutputFile)(options.index),
            // TODO: Use existing information from above to create the insertion order
            insertionOrder: (0, package_chunk_sort_1.generateEntryPoints)({
                scripts: (_f = options.scripts) !== null && _f !== void 0 ? _f : [],
                styles: (_g = options.styles) !== null && _g !== void 0 ? _g : [],
            }),
        };
    }
    // Initial options to keep
    const { baseHref, buildOptimizer, crossOrigin, externalDependencies, extractLicenses, inlineStyleLanguage = 'css', poll, preserveSymlinks, statsJson, stylePreprocessorOptions, subresourceIntegrity, verbose, watch, } = options;
    // Return all the normalized options
    return {
        advancedOptimizations: buildOptimizer,
        baseHref,
        cacheOptions,
        crossOrigin,
        externalDependencies,
        extractLicenses,
        inlineStyleLanguage,
        stats: !!statsJson,
        poll,
        // If not explicitly set, default to the Node.js process argument
        preserveSymlinks: preserveSymlinks !== null && preserveSymlinks !== void 0 ? preserveSymlinks : process.execArgv.includes('--preserve-symlinks'),
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
        serviceWorkerOptions,
        indexHtmlOptions,
    };
}
exports.normalizeOptions = normalizeOptions;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9vcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gsMkNBQTZCO0FBQzdCLHVDQUFpRztBQUNqRyxpRUFBb0U7QUFDcEUseUVBQXFFO0FBQ3JFLHVFQUFxRTtBQUNyRSwrRUFBMkY7QUFDM0YseURBQW9FO0FBQ3BFLHFDQUEwRTtBQUkxRTs7Ozs7Ozs7O0dBU0c7QUFDSSxLQUFLLFVBQVUsZ0JBQWdCLENBQ3BDLE9BQXVCLEVBQ3ZCLFdBQW1CLEVBQ25CLE9BQThCOztJQUU5QixNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDO0lBQzVDLE1BQU0sZUFBZSxHQUFHLE1BQU0sT0FBTyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3RFLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLE1BQUMsZUFBZSxDQUFDLElBQTJCLG1DQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ2pHLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FDakMsYUFBYSxFQUNiLE1BQUMsZUFBZSxDQUFDLFVBQWlDLG1DQUFJLEtBQUssQ0FDNUQsQ0FBQztJQUVGLE1BQU0sWUFBWSxHQUFHLElBQUEsdUNBQXFCLEVBQUMsZUFBZSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBRTNFLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUU5RCxrRUFBa0U7SUFDbEUsTUFBTSxDQUFDLG1CQUFtQixFQUFFLEdBQUcsa0JBQWtCLENB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R0FBRyxPQUFPLENBQUM7SUFFWixvQ0FBb0M7SUFDcEMsT0FBTztRQUNMLHFCQUFxQixFQUFFLGNBQWM7UUFDckMsUUFBUTtRQUNSLFlBQVk7UUFDWixXQUFXO1FBQ1gsb0JBQW9CO1FBQ3BCLGVBQWU7UUFDZixtQkFBbUI7UUFDbkIsS0FBSyxFQUFFLENBQUMsQ0FBQyxTQUFTO1FBQ2xCLElBQUk7UUFDSixpRUFBaUU7UUFDakUsZ0JBQWdCLEVBQUUsZ0JBQWdCLGFBQWhCLGdCQUFnQixjQUFoQixnQkFBZ0IsR0FBSSxPQUFPLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQztRQUN0Rix3QkFBd0I7UUFDeEIsb0JBQW9CO1FBQ3BCLE9BQU87UUFDUCxLQUFLO1FBQ0wsYUFBYTtRQUNiLFdBQVc7UUFDWCxtQkFBbUI7UUFDbkIsVUFBVTtRQUNWLGdCQUFnQjtRQUNoQixRQUFRO1FBQ1IsV0FBVztRQUNYLE1BQU07UUFDTixXQUFXO1FBQ1gsZ0JBQWdCO1FBQ2hCLFlBQVk7UUFDWixvQkFBb0I7UUFDcEIsZ0JBQWdCO0tBQ2pCLENBQUM7QUFDSixDQUFDO0FBdEpELDRDQXNKQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMsIG5vcm1hbGl6ZU9wdGltaXphdGlvbiwgbm9ybWFsaXplU291cmNlTWFwcyB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IG5vcm1hbGl6ZUNhY2hlT3B0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL25vcm1hbGl6ZS1jYWNoZSc7XG5pbXBvcnQgeyBub3JtYWxpemVQb2x5ZmlsbHMgfSBmcm9tICcuLi8uLi91dGlscy9ub3JtYWxpemUtcG9seWZpbGxzJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMgfSBmcm9tICcuLi8uLi91dGlscy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgZ2V0SW5kZXhJbnB1dEZpbGUsIGdldEluZGV4T3V0cHV0RmlsZSB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stYnJvd3Nlci1jb25maWcnO1xuaW1wb3J0IHsgbm9ybWFsaXplR2xvYmFsU3R5bGVzIH0gZnJvbSAnLi4vLi4vd2VicGFjay91dGlscy9oZWxwZXJzJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMsIE91dHB1dEhhc2hpbmcgfSBmcm9tICcuL3NjaGVtYSc7XG5cbmV4cG9ydCB0eXBlIE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyA9IEF3YWl0ZWQ8UmV0dXJuVHlwZTx0eXBlb2Ygbm9ybWFsaXplT3B0aW9ucz4+O1xuXG4vKipcbiAqIE5vcm1hbGl6ZSB0aGUgdXNlciBwcm92aWRlZCBvcHRpb25zIGJ5IGNyZWF0aW5nIGZ1bGwgcGF0aHMgZm9yIGFsbCBwYXRoIGJhc2VkIG9wdGlvbnNcbiAqIGFuZCBjb252ZXJ0aW5nIG11bHRpLWZvcm0gb3B0aW9ucyBpbnRvIGEgc2luZ2xlIGZvcm0gdGhhdCBjYW4gYmUgZGlyZWN0bHkgdXNlZFxuICogYnkgdGhlIGJ1aWxkIHByb2Nlc3MuXG4gKlxuICogQHBhcmFtIGNvbnRleHQgVGhlIGNvbnRleHQgZm9yIGN1cnJlbnQgYnVpbGRlciBleGVjdXRpb24uXG4gKiBAcGFyYW0gcHJvamVjdE5hbWUgVGhlIG5hbWUgb2YgdGhlIHByb2plY3QgZm9yIHRoZSBjdXJyZW50IGV4ZWN1dGlvbi5cbiAqIEBwYXJhbSBvcHRpb25zIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBvcHRpb25zIHRvIHVzZSBmb3IgdGhlIGJ1aWxkLlxuICogQHJldHVybnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgbm9ybWFsaXplZCBvcHRpb25zIHJlcXVpcmVkIHRvIHBlcmZvcm0gdGhlIGJ1aWxkLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbm9ybWFsaXplT3B0aW9ucyhcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gIG9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyT3B0aW9ucyxcbikge1xuICBjb25zdCB3b3Jrc3BhY2VSb290ID0gY29udGV4dC53b3Jrc3BhY2VSb290O1xuICBjb25zdCBwcm9qZWN0TWV0YWRhdGEgPSBhd2FpdCBjb250ZXh0LmdldFByb2plY3RNZXRhZGF0YShwcm9qZWN0TmFtZSk7XG4gIGNvbnN0IHByb2plY3RSb290ID0gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIChwcm9qZWN0TWV0YWRhdGEucm9vdCBhcyBzdHJpbmcgfCB1bmRlZmluZWQpID8/ICcnKTtcbiAgY29uc3QgcHJvamVjdFNvdXJjZVJvb3QgPSBwYXRoLmpvaW4oXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgICAocHJvamVjdE1ldGFkYXRhLnNvdXJjZVJvb3QgYXMgc3RyaW5nIHwgdW5kZWZpbmVkKSA/PyAnc3JjJyxcbiAgKTtcblxuICBjb25zdCBjYWNoZU9wdGlvbnMgPSBub3JtYWxpemVDYWNoZU9wdGlvbnMocHJvamVjdE1ldGFkYXRhLCB3b3Jrc3BhY2VSb290KTtcblxuICBjb25zdCBtYWluRW50cnlQb2ludCA9IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLm1haW4pO1xuXG4gIC8vIEN1cnJlbnRseSBlc2J1aWxkIGRvIG5vdCBzdXBwb3J0IG11bHRpcGxlIGZpbGVzIHBlciBlbnRyeS1wb2ludFxuICBjb25zdCBbcG9seWZpbGxzRW50cnlQb2ludCwgLi4ucmVtYWluaW5nUG9seWZpbGxzXSA9IG5vcm1hbGl6ZVBvbHlmaWxscyhcbiAgICBvcHRpb25zLnBvbHlmaWxscyxcbiAgICB3b3Jrc3BhY2VSb290LFxuICApO1xuXG4gIGlmIChyZW1haW5pbmdQb2x5ZmlsbHMubGVuZ3RoKSB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgIGBUaGUgJ3BvbHlmaWxscycgb3B0aW9uIGN1cnJlbnRseSBkb2VzIG5vdCBzdXBwb3J0IG11bHRpcGxlIGVudHJpZXMgYnkgdGhpcyBleHBlcmltZW50YWwgYnVpbGRlci4gVGhlIGZpcnN0IGVudHJ5IHdpbGwgYmUgdXNlZC5gLFxuICAgICk7XG4gIH1cblxuICBjb25zdCB0c2NvbmZpZyA9IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLnRzQ29uZmlnKTtcbiAgY29uc3Qgb3V0cHV0UGF0aCA9IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLm91dHB1dFBhdGgpO1xuICBjb25zdCBvcHRpbWl6YXRpb25PcHRpb25zID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKG9wdGlvbnMub3B0aW1pemF0aW9uKTtcbiAgY29uc3Qgc291cmNlbWFwT3B0aW9ucyA9IG5vcm1hbGl6ZVNvdXJjZU1hcHMob3B0aW9ucy5zb3VyY2VNYXAgPz8gZmFsc2UpO1xuICBjb25zdCBhc3NldHMgPSBvcHRpb25zLmFzc2V0cz8ubGVuZ3RoXG4gICAgPyBub3JtYWxpemVBc3NldFBhdHRlcm5zKG9wdGlvbnMuYXNzZXRzLCB3b3Jrc3BhY2VSb290LCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QpXG4gICAgOiB1bmRlZmluZWQ7XG5cbiAgY29uc3Qgb3V0cHV0TmFtZXMgPSB7XG4gICAgYnVuZGxlczpcbiAgICAgIG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5BbGwgfHwgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLkJ1bmRsZXNcbiAgICAgICAgPyAnW25hbWVdLltoYXNoXSdcbiAgICAgICAgOiAnW25hbWVdJyxcbiAgICBtZWRpYTpcbiAgICAgIG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5BbGwgfHwgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLk1lZGlhXG4gICAgICAgID8gJ1tuYW1lXS5baGFzaF0nXG4gICAgICAgIDogJ1tuYW1lXScsXG4gIH07XG4gIGlmIChvcHRpb25zLnJlc291cmNlc091dHB1dFBhdGgpIHtcbiAgICBvdXRwdXROYW1lcy5tZWRpYSA9IHBhdGguam9pbihvcHRpb25zLnJlc291cmNlc091dHB1dFBhdGgsIG91dHB1dE5hbWVzLm1lZGlhKTtcbiAgfVxuXG4gIGxldCBmaWxlUmVwbGFjZW1lbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHwgdW5kZWZpbmVkO1xuICBpZiAob3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSB7XG4gICAgZm9yIChjb25zdCByZXBsYWNlbWVudCBvZiBvcHRpb25zLmZpbGVSZXBsYWNlbWVudHMpIHtcbiAgICAgIGZpbGVSZXBsYWNlbWVudHMgPz89IHt9O1xuICAgICAgZmlsZVJlcGxhY2VtZW50c1twYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgcmVwbGFjZW1lbnQucmVwbGFjZSldID0gcGF0aC5qb2luKFxuICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICByZXBsYWNlbWVudC53aXRoLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBnbG9iYWxTdHlsZXM6IHsgbmFtZTogc3RyaW5nOyBmaWxlczogc3RyaW5nW107IGluaXRpYWw6IGJvb2xlYW4gfVtdID0gW107XG4gIGlmIChvcHRpb25zLnN0eWxlcz8ubGVuZ3RoKSB7XG4gICAgY29uc3QgeyBlbnRyeVBvaW50czogc3R5bGVzaGVldEVudHJ5cG9pbnRzLCBub0luamVjdE5hbWVzIH0gPSBub3JtYWxpemVHbG9iYWxTdHlsZXMoXG4gICAgICBvcHRpb25zLnN0eWxlcyB8fCBbXSxcbiAgICApO1xuICAgIGZvciAoY29uc3QgW25hbWUsIGZpbGVzXSBvZiBPYmplY3QuZW50cmllcyhzdHlsZXNoZWV0RW50cnlwb2ludHMpKSB7XG4gICAgICBnbG9iYWxTdHlsZXMucHVzaCh7IG5hbWUsIGZpbGVzLCBpbml0aWFsOiAhbm9JbmplY3ROYW1lcy5pbmNsdWRlcyhuYW1lKSB9KTtcbiAgICB9XG4gIH1cblxuICBsZXQgc2VydmljZVdvcmtlck9wdGlvbnM7XG4gIGlmIChvcHRpb25zLnNlcnZpY2VXb3JrZXIpIHtcbiAgICAvLyBJZiBuZ3N3Q29uZmlnUGF0aCBpcyBub3Qgc3BlY2lmaWVkLCB0aGUgZGVmYXVsdCBpcyAnbmdzdy1jb25maWcuanNvbicgd2l0aGluIHRoZSBwcm9qZWN0IHJvb3RcbiAgICBzZXJ2aWNlV29ya2VyT3B0aW9ucyA9IG9wdGlvbnMubmdzd0NvbmZpZ1BhdGhcbiAgICAgID8gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIG9wdGlvbnMubmdzd0NvbmZpZ1BhdGgpXG4gICAgICA6IHBhdGguam9pbihwcm9qZWN0Um9vdCwgJ25nc3ctY29uZmlnLmpzb24nKTtcbiAgfVxuXG4gIC8vIFNldHVwIGJ1bmRsZXIgZW50cnkgcG9pbnRzXG4gIGNvbnN0IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgIG1haW46IG1haW5FbnRyeVBvaW50LFxuICB9O1xuICBpZiAocG9seWZpbGxzRW50cnlQb2ludCkge1xuICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSA9IHBvbHlmaWxsc0VudHJ5UG9pbnQ7XG4gIH1cblxuICBsZXQgaW5kZXhIdG1sT3B0aW9ucztcbiAgaWYgKG9wdGlvbnMuaW5kZXgpIHtcbiAgICBpbmRleEh0bWxPcHRpb25zID0ge1xuICAgICAgaW5wdXQ6IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBnZXRJbmRleElucHV0RmlsZShvcHRpb25zLmluZGV4KSksXG4gICAgICAvLyBUaGUgb3V0cHV0IGZpbGUgd2lsbCBiZSBjcmVhdGVkIHdpdGhpbiB0aGUgY29uZmlndXJlZCBvdXRwdXQgcGF0aFxuICAgICAgb3V0cHV0OiBnZXRJbmRleE91dHB1dEZpbGUob3B0aW9ucy5pbmRleCksXG4gICAgICAvLyBUT0RPOiBVc2UgZXhpc3RpbmcgaW5mb3JtYXRpb24gZnJvbSBhYm92ZSB0byBjcmVhdGUgdGhlIGluc2VydGlvbiBvcmRlclxuICAgICAgaW5zZXJ0aW9uT3JkZXI6IGdlbmVyYXRlRW50cnlQb2ludHMoe1xuICAgICAgICBzY3JpcHRzOiBvcHRpb25zLnNjcmlwdHMgPz8gW10sXG4gICAgICAgIHN0eWxlczogb3B0aW9ucy5zdHlsZXMgPz8gW10sXG4gICAgICB9KSxcbiAgICB9O1xuICB9XG5cbiAgLy8gSW5pdGlhbCBvcHRpb25zIHRvIGtlZXBcbiAgY29uc3Qge1xuICAgIGJhc2VIcmVmLFxuICAgIGJ1aWxkT3B0aW1pemVyLFxuICAgIGNyb3NzT3JpZ2luLFxuICAgIGV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIGV4dHJhY3RMaWNlbnNlcyxcbiAgICBpbmxpbmVTdHlsZUxhbmd1YWdlID0gJ2NzcycsXG4gICAgcG9sbCxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHN0YXRzSnNvbixcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgdmVyYm9zZSxcbiAgICB3YXRjaCxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgLy8gUmV0dXJuIGFsbCB0aGUgbm9ybWFsaXplZCBvcHRpb25zXG4gIHJldHVybiB7XG4gICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zOiBidWlsZE9wdGltaXplcixcbiAgICBiYXNlSHJlZixcbiAgICBjYWNoZU9wdGlvbnMsXG4gICAgY3Jvc3NPcmlnaW4sXG4gICAgZXh0ZXJuYWxEZXBlbmRlbmNpZXMsXG4gICAgZXh0cmFjdExpY2Vuc2VzLFxuICAgIGlubGluZVN0eWxlTGFuZ3VhZ2UsXG4gICAgc3RhdHM6ICEhc3RhdHNKc29uLFxuICAgIHBvbGwsXG4gICAgLy8gSWYgbm90IGV4cGxpY2l0bHkgc2V0LCBkZWZhdWx0IHRvIHRoZSBOb2RlLmpzIHByb2Nlc3MgYXJndW1lbnRcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzOiBwcmVzZXJ2ZVN5bWxpbmtzID8/IHByb2Nlc3MuZXhlY0FyZ3YuaW5jbHVkZXMoJy0tcHJlc2VydmUtc3ltbGlua3MnKSxcbiAgICBzdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgdmVyYm9zZSxcbiAgICB3YXRjaCxcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgb3V0cHV0UGF0aCxcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHRzY29uZmlnLFxuICAgIHByb2plY3RSb290LFxuICAgIGFzc2V0cyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBmaWxlUmVwbGFjZW1lbnRzLFxuICAgIGdsb2JhbFN0eWxlcyxcbiAgICBzZXJ2aWNlV29ya2VyT3B0aW9ucyxcbiAgICBpbmRleEh0bWxPcHRpb25zLFxuICB9O1xufVxuIl19