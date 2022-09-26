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
const normalize_polyfills_1 = require("../../utils/normalize-polyfills");
const schema_1 = require("../browser/schema");
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
    var _a, _b, _c, _d;
    const workspaceRoot = context.workspaceRoot;
    const projectMetadata = await context.getProjectMetadata(projectName);
    const projectRoot = path.join(workspaceRoot, (_a = projectMetadata.root) !== null && _a !== void 0 ? _a : '');
    const projectSourceRoot = path.join(workspaceRoot, (_b = projectMetadata.sourceRoot) !== null && _b !== void 0 ? _b : 'src');
    // Normalize options
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
    // Setup bundler entry points
    const entryPoints = {
        main: mainEntryPoint,
    };
    if (polyfillsEntryPoint) {
        entryPoints['polyfills'] = polyfillsEntryPoint;
    }
    // Create reverse lookup used during index HTML generation
    const entryPointNameLookup = new Map(Object.entries(entryPoints).map(([name, filePath]) => [path.relative(workspaceRoot, filePath), name]));
    return {
        workspaceRoot,
        entryPoints,
        entryPointNameLookup,
        optimizationOptions,
        outputPath,
        sourcemapOptions,
        tsconfig,
        projectRoot,
        assets,
        outputNames,
    };
}
exports.normalizeOptions = normalizeOptions;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9vcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gsMkNBQTZCO0FBQzdCLHVDQUFpRztBQUNqRyx5RUFBcUU7QUFDckUsOENBQW1GO0FBRW5GOzs7Ozs7Ozs7R0FTRztBQUNJLEtBQUssVUFBVSxnQkFBZ0IsQ0FDcEMsT0FBdUIsRUFDdkIsV0FBbUIsRUFDbkIsT0FBOEI7O0lBRTlCLE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUM7SUFDNUMsTUFBTSxlQUFlLEdBQUcsTUFBTSxPQUFPLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDdEUsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsTUFBQyxlQUFlLENBQUMsSUFBMkIsbUNBQUksRUFBRSxDQUFDLENBQUM7SUFDakcsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUNqQyxhQUFhLEVBQ2IsTUFBQyxlQUFlLENBQUMsVUFBaUMsbUNBQUksS0FBSyxDQUM1RCxDQUFDO0lBQ0Ysb0JBQW9CO0lBQ3BCLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUU5RCxrRUFBa0U7SUFDbEUsTUFBTSxDQUFDLG1CQUFtQixFQUFFLEdBQUcsa0JBQWtCLENBQUMsR0FBRyxJQUFBLHdDQUFrQixFQUNyRSxPQUFPLENBQUMsU0FBUyxFQUNqQixhQUFhLENBQ2QsQ0FBQztJQUVGLElBQUksa0JBQWtCLENBQUMsTUFBTSxFQUFFO1FBQzdCLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNqQixnSUFBZ0ksQ0FDakksQ0FBQztLQUNIO0lBRUQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzVELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNoRSxNQUFNLG1CQUFtQixHQUFHLElBQUEsNkJBQXFCLEVBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQ3hFLE1BQU0sZ0JBQWdCLEdBQUcsSUFBQSwyQkFBbUIsRUFBQyxNQUFBLE9BQU8sQ0FBQyxTQUFTLG1DQUFJLEtBQUssQ0FBQyxDQUFDO0lBQ3pFLE1BQU0sTUFBTSxHQUFHLENBQUEsTUFBQSxPQUFPLENBQUMsTUFBTSwwQ0FBRSxNQUFNO1FBQ25DLENBQUMsQ0FBQyxJQUFBLDhCQUFzQixFQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxpQkFBaUIsQ0FBQztRQUN2RixDQUFDLENBQUMsU0FBUyxDQUFDO0lBRWQsTUFBTSxXQUFXLEdBQUc7UUFDbEIsT0FBTyxFQUNMLE9BQU8sQ0FBQyxhQUFhLEtBQUssc0JBQWEsQ0FBQyxHQUFHLElBQUksT0FBTyxDQUFDLGFBQWEsS0FBSyxzQkFBYSxDQUFDLE9BQU87WUFDNUYsQ0FBQyxDQUFDLGVBQWU7WUFDakIsQ0FBQyxDQUFDLFFBQVE7UUFDZCxLQUFLLEVBQ0gsT0FBTyxDQUFDLGFBQWEsS0FBSyxzQkFBYSxDQUFDLEdBQUcsSUFBSSxPQUFPLENBQUMsYUFBYSxLQUFLLHNCQUFhLENBQUMsS0FBSztZQUMxRixDQUFDLENBQUMsZUFBZTtZQUNqQixDQUFDLENBQUMsUUFBUTtLQUNmLENBQUM7SUFDRixJQUFJLE9BQU8sQ0FBQyxtQkFBbUIsRUFBRTtRQUMvQixXQUFXLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixFQUFFLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUMvRTtJQUVELDZCQUE2QjtJQUM3QixNQUFNLFdBQVcsR0FBMkI7UUFDMUMsSUFBSSxFQUFFLGNBQWM7S0FDckIsQ0FBQztJQUNGLElBQUksbUJBQW1CLEVBQUU7UUFDdkIsV0FBVyxDQUFDLFdBQVcsQ0FBQyxHQUFHLG1CQUFtQixDQUFDO0tBQ2hEO0lBQ0QsMERBQTBEO0lBQzFELE1BQU0sb0JBQW9CLEdBQWdDLElBQUksR0FBRyxDQUMvRCxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FDN0IsQ0FBQyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxRQUFRLENBQUMsRUFBRSxJQUFJLENBQVUsQ0FDOUUsQ0FDRixDQUFDO0lBRUYsT0FBTztRQUNMLGFBQWE7UUFDYixXQUFXO1FBQ1gsb0JBQW9CO1FBQ3BCLG1CQUFtQjtRQUNuQixVQUFVO1FBQ1YsZ0JBQWdCO1FBQ2hCLFFBQVE7UUFDUixXQUFXO1FBQ1gsTUFBTTtRQUNOLFdBQVc7S0FDWixDQUFDO0FBQ0osQ0FBQztBQTNFRCw0Q0EyRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBub3JtYWxpemVBc3NldFBhdHRlcm5zLCBub3JtYWxpemVPcHRpbWl6YXRpb24sIG5vcm1hbGl6ZVNvdXJjZU1hcHMgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBub3JtYWxpemVQb2x5ZmlsbHMgfSBmcm9tICcuLi8uLi91dGlscy9ub3JtYWxpemUtcG9seWZpbGxzJztcbmltcG9ydCB7IFNjaGVtYSBhcyBCcm93c2VyQnVpbGRlck9wdGlvbnMsIE91dHB1dEhhc2hpbmcgfSBmcm9tICcuLi9icm93c2VyL3NjaGVtYSc7XG5cbi8qKlxuICogTm9ybWFsaXplIHRoZSB1c2VyIHByb3ZpZGVkIG9wdGlvbnMgYnkgY3JlYXRpbmcgZnVsbCBwYXRocyBmb3IgYWxsIHBhdGggYmFzZWQgb3B0aW9uc1xuICogYW5kIGNvbnZlcnRpbmcgbXVsdGktZm9ybSBvcHRpb25zIGludG8gYSBzaW5nbGUgZm9ybSB0aGF0IGNhbiBiZSBkaXJlY3RseSB1c2VkXG4gKiBieSB0aGUgYnVpbGQgcHJvY2Vzcy5cbiAqXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgY29udGV4dCBmb3IgY3VycmVudCBidWlsZGVyIGV4ZWN1dGlvbi5cbiAqIEBwYXJhbSBwcm9qZWN0TmFtZSBUaGUgbmFtZSBvZiB0aGUgcHJvamVjdCBmb3IgdGhlIGN1cnJlbnQgZXhlY3V0aW9uLlxuICogQHBhcmFtIG9wdGlvbnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIG9wdGlvbnMgdG8gdXNlIGZvciB0aGUgYnVpbGQuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyBub3JtYWxpemVkIG9wdGlvbnMgcmVxdWlyZWQgdG8gcGVyZm9ybSB0aGUgYnVpbGQuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBub3JtYWxpemVPcHRpb25zKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgb3B0aW9uczogQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuKSB7XG4gIGNvbnN0IHdvcmtzcGFjZVJvb3QgPSBjb250ZXh0LndvcmtzcGFjZVJvb3Q7XG4gIGNvbnN0IHByb2plY3RNZXRhZGF0YSA9IGF3YWl0IGNvbnRleHQuZ2V0UHJvamVjdE1ldGFkYXRhKHByb2plY3ROYW1lKTtcbiAgY29uc3QgcHJvamVjdFJvb3QgPSBwYXRoLmpvaW4od29ya3NwYWNlUm9vdCwgKHByb2plY3RNZXRhZGF0YS5yb290IGFzIHN0cmluZyB8IHVuZGVmaW5lZCkgPz8gJycpO1xuICBjb25zdCBwcm9qZWN0U291cmNlUm9vdCA9IHBhdGguam9pbihcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIChwcm9qZWN0TWV0YWRhdGEuc291cmNlUm9vdCBhcyBzdHJpbmcgfCB1bmRlZmluZWQpID8/ICdzcmMnLFxuICApO1xuICAvLyBOb3JtYWxpemUgb3B0aW9uc1xuICBjb25zdCBtYWluRW50cnlQb2ludCA9IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLm1haW4pO1xuXG4gIC8vIEN1cnJlbnRseSBlc2J1aWxkIGRvIG5vdCBzdXBwb3J0IG11bHRpcGxlIGZpbGVzIHBlciBlbnRyeS1wb2ludFxuICBjb25zdCBbcG9seWZpbGxzRW50cnlQb2ludCwgLi4ucmVtYWluaW5nUG9seWZpbGxzXSA9IG5vcm1hbGl6ZVBvbHlmaWxscyhcbiAgICBvcHRpb25zLnBvbHlmaWxscyxcbiAgICB3b3Jrc3BhY2VSb290LFxuICApO1xuXG4gIGlmIChyZW1haW5pbmdQb2x5ZmlsbHMubGVuZ3RoKSB7XG4gICAgY29udGV4dC5sb2dnZXIud2FybihcbiAgICAgIGBUaGUgJ3BvbHlmaWxscycgb3B0aW9uIGN1cnJlbnRseSBkb2VzIG5vdCBzdXBwb3J0IG11bHRpcGxlIGVudHJpZXMgYnkgdGhpcyBleHBlcmltZW50YWwgYnVpbGRlci4gVGhlIGZpcnN0IGVudHJ5IHdpbGwgYmUgdXNlZC5gLFxuICAgICk7XG4gIH1cblxuICBjb25zdCB0c2NvbmZpZyA9IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLnRzQ29uZmlnKTtcbiAgY29uc3Qgb3V0cHV0UGF0aCA9IHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBvcHRpb25zLm91dHB1dFBhdGgpO1xuICBjb25zdCBvcHRpbWl6YXRpb25PcHRpb25zID0gbm9ybWFsaXplT3B0aW1pemF0aW9uKG9wdGlvbnMub3B0aW1pemF0aW9uKTtcbiAgY29uc3Qgc291cmNlbWFwT3B0aW9ucyA9IG5vcm1hbGl6ZVNvdXJjZU1hcHMob3B0aW9ucy5zb3VyY2VNYXAgPz8gZmFsc2UpO1xuICBjb25zdCBhc3NldHMgPSBvcHRpb25zLmFzc2V0cz8ubGVuZ3RoXG4gICAgPyBub3JtYWxpemVBc3NldFBhdHRlcm5zKG9wdGlvbnMuYXNzZXRzLCB3b3Jrc3BhY2VSb290LCBwcm9qZWN0Um9vdCwgcHJvamVjdFNvdXJjZVJvb3QpXG4gICAgOiB1bmRlZmluZWQ7XG5cbiAgY29uc3Qgb3V0cHV0TmFtZXMgPSB7XG4gICAgYnVuZGxlczpcbiAgICAgIG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5BbGwgfHwgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLkJ1bmRsZXNcbiAgICAgICAgPyAnW25hbWVdLltoYXNoXSdcbiAgICAgICAgOiAnW25hbWVdJyxcbiAgICBtZWRpYTpcbiAgICAgIG9wdGlvbnMub3V0cHV0SGFzaGluZyA9PT0gT3V0cHV0SGFzaGluZy5BbGwgfHwgb3B0aW9ucy5vdXRwdXRIYXNoaW5nID09PSBPdXRwdXRIYXNoaW5nLk1lZGlhXG4gICAgICAgID8gJ1tuYW1lXS5baGFzaF0nXG4gICAgICAgIDogJ1tuYW1lXScsXG4gIH07XG4gIGlmIChvcHRpb25zLnJlc291cmNlc091dHB1dFBhdGgpIHtcbiAgICBvdXRwdXROYW1lcy5tZWRpYSA9IHBhdGguam9pbihvcHRpb25zLnJlc291cmNlc091dHB1dFBhdGgsIG91dHB1dE5hbWVzLm1lZGlhKTtcbiAgfVxuXG4gIC8vIFNldHVwIGJ1bmRsZXIgZW50cnkgcG9pbnRzXG4gIGNvbnN0IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgIG1haW46IG1haW5FbnRyeVBvaW50LFxuICB9O1xuICBpZiAocG9seWZpbGxzRW50cnlQb2ludCkge1xuICAgIGVudHJ5UG9pbnRzWydwb2x5ZmlsbHMnXSA9IHBvbHlmaWxsc0VudHJ5UG9pbnQ7XG4gIH1cbiAgLy8gQ3JlYXRlIHJldmVyc2UgbG9va3VwIHVzZWQgZHVyaW5nIGluZGV4IEhUTUwgZ2VuZXJhdGlvblxuICBjb25zdCBlbnRyeVBvaW50TmFtZUxvb2t1cDogUmVhZG9ubHlNYXA8c3RyaW5nLCBzdHJpbmc+ID0gbmV3IE1hcChcbiAgICBPYmplY3QuZW50cmllcyhlbnRyeVBvaW50cykubWFwKFxuICAgICAgKFtuYW1lLCBmaWxlUGF0aF0pID0+IFtwYXRoLnJlbGF0aXZlKHdvcmtzcGFjZVJvb3QsIGZpbGVQYXRoKSwgbmFtZV0gYXMgY29uc3QsXG4gICAgKSxcbiAgKTtcblxuICByZXR1cm4ge1xuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgZW50cnlQb2ludHMsXG4gICAgZW50cnlQb2ludE5hbWVMb29rdXAsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBvdXRwdXRQYXRoLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgdHNjb25maWcsXG4gICAgcHJvamVjdFJvb3QsXG4gICAgYXNzZXRzLFxuICAgIG91dHB1dE5hbWVzLFxuICB9O1xufVxuIl19