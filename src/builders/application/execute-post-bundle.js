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
exports.executePostBundleSteps = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const bundler_context_1 = require("../../tools/esbuild/bundler-context");
const index_html_generator_1 = require("../../tools/esbuild/index-html-generator");
const utils_1 = require("../../tools/esbuild/utils");
const environment_options_1 = require("../../utils/environment-options");
const prerender_1 = require("../../utils/server-rendering/prerender");
const service_worker_1 = require("../../utils/service-worker");
/**
 * Run additional builds steps including SSG, AppShell, Index HTML file and Service worker generation.
 * @param options The normalized application builder options used to create the build.
 * @param outputFiles The output files of an executed build.
 * @param assetFiles The assets of an executed build.
 * @param initialFiles A map containing initial file information for the executed build.
 * @param locale A language locale to insert in the index.html.
 */
async function executePostBundleSteps(options, outputFiles, assetFiles, initialFiles, locale) {
    const additionalAssets = [];
    const additionalOutputFiles = [];
    const allErrors = [];
    const allWarnings = [];
    const prerenderedRoutes = [];
    const { serviceWorker, indexHtmlOptions, optimizationOptions, sourcemapOptions, ssrOptions, prerenderOptions, appShellOptions, workspaceRoot, verbose, } = options;
    /**
     * Index HTML content without CSS inlining to be used for server rendering (AppShell, SSG and SSR).
     *
     * NOTE: we don't perform critical CSS inlining as this will be done during server rendering.
     */
    let indexContentOutputNoCssInlining;
    // Generate index HTML file
    // If localization is enabled, index generation is handled in the inlining process.
    // NOTE: Localization with SSR is not currently supported.
    if (indexHtmlOptions) {
        const { content, contentWithoutCriticalCssInlined, errors, warnings } = await (0, index_html_generator_1.generateIndexHtml)(initialFiles, outputFiles, {
            ...options,
            optimizationOptions,
        }, locale);
        indexContentOutputNoCssInlining = contentWithoutCriticalCssInlined;
        allErrors.push(...errors);
        allWarnings.push(...warnings);
        additionalOutputFiles.push((0, utils_1.createOutputFileFromText)(indexHtmlOptions.output, content, bundler_context_1.BuildOutputFileType.Browser));
        if (ssrOptions) {
            additionalOutputFiles.push((0, utils_1.createOutputFileFromText)('index.server.html', contentWithoutCriticalCssInlined, bundler_context_1.BuildOutputFileType.Server));
        }
    }
    // Pre-render (SSG) and App-shell
    // If localization is enabled, prerendering is handled in the inlining process.
    if (prerenderOptions || appShellOptions) {
        (0, node_assert_1.default)(indexContentOutputNoCssInlining, 'The "index" option is required when using the "ssg" or "appShell" options.');
        const { output, warnings, errors, prerenderedRoutes: generatedRoutes, } = await (0, prerender_1.prerenderPages)(workspaceRoot, appShellOptions, prerenderOptions, outputFiles, indexContentOutputNoCssInlining, sourcemapOptions.scripts, optimizationOptions.styles.inlineCritical, environment_options_1.maxWorkers, verbose);
        allErrors.push(...errors);
        allWarnings.push(...warnings);
        prerenderedRoutes.push(...Array.from(generatedRoutes));
        for (const [path, content] of Object.entries(output)) {
            additionalOutputFiles.push((0, utils_1.createOutputFileFromText)(path, content, bundler_context_1.BuildOutputFileType.Browser));
        }
    }
    // Augment the application with service worker support
    // If localization is enabled, service worker is handled in the inlining process.
    if (serviceWorker) {
        try {
            const serviceWorkerResult = await (0, service_worker_1.augmentAppWithServiceWorkerEsbuild)(workspaceRoot, serviceWorker, options.baseHref || '/', outputFiles, assetFiles);
            additionalOutputFiles.push((0, utils_1.createOutputFileFromText)('ngsw.json', serviceWorkerResult.manifest, bundler_context_1.BuildOutputFileType.Browser));
            additionalAssets.push(...serviceWorkerResult.assetFiles);
        }
        catch (error) {
            allErrors.push(error instanceof Error ? error.message : `${error}`);
        }
    }
    return {
        errors: allErrors,
        warnings: allWarnings,
        additionalAssets,
        prerenderedRoutes,
        additionalOutputFiles,
    };
}
exports.executePostBundleSteps = executePostBundleSteps;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhlY3V0ZS1wb3N0LWJ1bmRsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL2V4ZWN1dGUtcG9zdC1idW5kbGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgsOERBQWlDO0FBQ2pDLHlFQUk2QztBQUU3QyxtRkFBNkU7QUFDN0UscURBQXFFO0FBQ3JFLHlFQUE2RDtBQUM3RCxzRUFBd0U7QUFDeEUsK0RBQWdGO0FBR2hGOzs7Ozs7O0dBT0c7QUFDSSxLQUFLLFVBQVUsc0JBQXNCLENBQzFDLE9BQTBDLEVBQzFDLFdBQThCLEVBQzlCLFVBQThCLEVBQzlCLFlBQTRDLEVBQzVDLE1BQTBCO0lBUTFCLE1BQU0sZ0JBQWdCLEdBQXVCLEVBQUUsQ0FBQztJQUNoRCxNQUFNLHFCQUFxQixHQUFzQixFQUFFLENBQUM7SUFDcEQsTUFBTSxTQUFTLEdBQWEsRUFBRSxDQUFDO0lBQy9CLE1BQU0sV0FBVyxHQUFhLEVBQUUsQ0FBQztJQUNqQyxNQUFNLGlCQUFpQixHQUFhLEVBQUUsQ0FBQztJQUV2QyxNQUFNLEVBQ0osYUFBYSxFQUNiLGdCQUFnQixFQUNoQixtQkFBbUIsRUFDbkIsZ0JBQWdCLEVBQ2hCLFVBQVUsRUFDVixnQkFBZ0IsRUFDaEIsZUFBZSxFQUNmLGFBQWEsRUFDYixPQUFPLEdBQ1IsR0FBRyxPQUFPLENBQUM7SUFFWjs7OztPQUlHO0lBQ0gsSUFBSSwrQkFBbUQsQ0FBQztJQUV4RCwyQkFBMkI7SUFDM0IsbUZBQW1GO0lBQ25GLDBEQUEwRDtJQUMxRCxJQUFJLGdCQUFnQixFQUFFO1FBQ3BCLE1BQU0sRUFBRSxPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxHQUFHLE1BQU0sSUFBQSx3Q0FBaUIsRUFDN0YsWUFBWSxFQUNaLFdBQVcsRUFDWDtZQUNFLEdBQUcsT0FBTztZQUNWLG1CQUFtQjtTQUNwQixFQUNELE1BQU0sQ0FDUCxDQUFDO1FBRUYsK0JBQStCLEdBQUcsZ0NBQWdDLENBQUM7UUFDbkUsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDO1FBQzFCLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQztRQUU5QixxQkFBcUIsQ0FBQyxJQUFJLENBQ3hCLElBQUEsZ0NBQXdCLEVBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxxQ0FBbUIsQ0FBQyxPQUFPLENBQUMsQ0FDeEYsQ0FBQztRQUVGLElBQUksVUFBVSxFQUFFO1lBQ2QscUJBQXFCLENBQUMsSUFBSSxDQUN4QixJQUFBLGdDQUF3QixFQUN0QixtQkFBbUIsRUFDbkIsZ0NBQWdDLEVBQ2hDLHFDQUFtQixDQUFDLE1BQU0sQ0FDM0IsQ0FDRixDQUFDO1NBQ0g7S0FDRjtJQUVELGlDQUFpQztJQUNqQywrRUFBK0U7SUFDL0UsSUFBSSxnQkFBZ0IsSUFBSSxlQUFlLEVBQUU7UUFDdkMsSUFBQSxxQkFBTSxFQUNKLCtCQUErQixFQUMvQiw0RUFBNEUsQ0FDN0UsQ0FBQztRQUVGLE1BQU0sRUFDSixNQUFNLEVBQ04sUUFBUSxFQUNSLE1BQU0sRUFDTixpQkFBaUIsRUFBRSxlQUFlLEdBQ25DLEdBQUcsTUFBTSxJQUFBLDBCQUFjLEVBQ3RCLGFBQWEsRUFDYixlQUFlLEVBQ2YsZ0JBQWdCLEVBQ2hCLFdBQVcsRUFDWCwrQkFBK0IsRUFDL0IsZ0JBQWdCLENBQUMsT0FBTyxFQUN4QixtQkFBbUIsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUN6QyxnQ0FBVSxFQUNWLE9BQU8sQ0FDUixDQUFDO1FBRUYsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDO1FBQzFCLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQztRQUM5QixpQkFBaUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7UUFFdkQsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDcEQscUJBQXFCLENBQUMsSUFBSSxDQUN4QixJQUFBLGdDQUF3QixFQUFDLElBQUksRUFBRSxPQUFPLEVBQUUscUNBQW1CLENBQUMsT0FBTyxDQUFDLENBQ3JFLENBQUM7U0FDSDtLQUNGO0lBRUQsc0RBQXNEO0lBQ3RELGlGQUFpRjtJQUNqRixJQUFJLGFBQWEsRUFBRTtRQUNqQixJQUFJO1lBQ0YsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLElBQUEsbURBQWtDLEVBQ2xFLGFBQWEsRUFDYixhQUFhLEVBQ2IsT0FBTyxDQUFDLFFBQVEsSUFBSSxHQUFHLEVBQ3ZCLFdBQVcsRUFDWCxVQUFVLENBQ1gsQ0FBQztZQUNGLHFCQUFxQixDQUFDLElBQUksQ0FDeEIsSUFBQSxnQ0FBd0IsRUFDdEIsV0FBVyxFQUNYLG1CQUFtQixDQUFDLFFBQVEsRUFDNUIscUNBQW1CLENBQUMsT0FBTyxDQUM1QixDQUNGLENBQUM7WUFDRixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUMxRDtRQUFDLE9BQU8sS0FBSyxFQUFFO1lBQ2QsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLENBQUM7U0FDckU7S0FDRjtJQUVELE9BQU87UUFDTCxNQUFNLEVBQUUsU0FBUztRQUNqQixRQUFRLEVBQUUsV0FBVztRQUNyQixnQkFBZ0I7UUFDaEIsaUJBQWlCO1FBQ2pCLHFCQUFxQjtLQUN0QixDQUFDO0FBQ0osQ0FBQztBQTFJRCx3REEwSUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQge1xuICBCdWlsZE91dHB1dEZpbGUsXG4gIEJ1aWxkT3V0cHV0RmlsZVR5cGUsXG4gIEluaXRpYWxGaWxlUmVjb3JkLFxufSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgeyBCdWlsZE91dHB1dEFzc2V0IH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9idW5kbGVyLWV4ZWN1dGlvbi1yZXN1bHQnO1xuaW1wb3J0IHsgZ2VuZXJhdGVJbmRleEh0bWwgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2luZGV4LWh0bWwtZ2VuZXJhdG9yJztcbmltcG9ydCB7IGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dCB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvdXRpbHMnO1xuaW1wb3J0IHsgbWF4V29ya2VycyB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgcHJlcmVuZGVyUGFnZXMgfSBmcm9tICcuLi8uLi91dGlscy9zZXJ2ZXItcmVuZGVyaW5nL3ByZXJlbmRlcic7XG5pbXBvcnQgeyBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXJFc2J1aWxkIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2VydmljZS13b3JrZXInO1xuaW1wb3J0IHsgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcblxuLyoqXG4gKiBSdW4gYWRkaXRpb25hbCBidWlsZHMgc3RlcHMgaW5jbHVkaW5nIFNTRywgQXBwU2hlbGwsIEluZGV4IEhUTUwgZmlsZSBhbmQgU2VydmljZSB3b3JrZXIgZ2VuZXJhdGlvbi5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBub3JtYWxpemVkIGFwcGxpY2F0aW9uIGJ1aWxkZXIgb3B0aW9ucyB1c2VkIHRvIGNyZWF0ZSB0aGUgYnVpbGQuXG4gKiBAcGFyYW0gb3V0cHV0RmlsZXMgVGhlIG91dHB1dCBmaWxlcyBvZiBhbiBleGVjdXRlZCBidWlsZC5cbiAqIEBwYXJhbSBhc3NldEZpbGVzIFRoZSBhc3NldHMgb2YgYW4gZXhlY3V0ZWQgYnVpbGQuXG4gKiBAcGFyYW0gaW5pdGlhbEZpbGVzIEEgbWFwIGNvbnRhaW5pbmcgaW5pdGlhbCBmaWxlIGluZm9ybWF0aW9uIGZvciB0aGUgZXhlY3V0ZWQgYnVpbGQuXG4gKiBAcGFyYW0gbG9jYWxlIEEgbGFuZ3VhZ2UgbG9jYWxlIHRvIGluc2VydCBpbiB0aGUgaW5kZXguaHRtbC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGVQb3N0QnVuZGxlU3RlcHMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyxcbiAgb3V0cHV0RmlsZXM6IEJ1aWxkT3V0cHV0RmlsZVtdLFxuICBhc3NldEZpbGVzOiBCdWlsZE91dHB1dEFzc2V0W10sXG4gIGluaXRpYWxGaWxlczogTWFwPHN0cmluZywgSW5pdGlhbEZpbGVSZWNvcmQ+LFxuICBsb2NhbGU6IHN0cmluZyB8IHVuZGVmaW5lZCxcbik6IFByb21pc2U8e1xuICBlcnJvcnM6IHN0cmluZ1tdO1xuICB3YXJuaW5nczogc3RyaW5nW107XG4gIGFkZGl0aW9uYWxPdXRwdXRGaWxlczogQnVpbGRPdXRwdXRGaWxlW107XG4gIGFkZGl0aW9uYWxBc3NldHM6IEJ1aWxkT3V0cHV0QXNzZXRbXTtcbiAgcHJlcmVuZGVyZWRSb3V0ZXM6IHN0cmluZ1tdO1xufT4ge1xuICBjb25zdCBhZGRpdGlvbmFsQXNzZXRzOiBCdWlsZE91dHB1dEFzc2V0W10gPSBbXTtcbiAgY29uc3QgYWRkaXRpb25hbE91dHB1dEZpbGVzOiBCdWlsZE91dHB1dEZpbGVbXSA9IFtdO1xuICBjb25zdCBhbGxFcnJvcnM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGFsbFdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBwcmVyZW5kZXJlZFJvdXRlczogc3RyaW5nW10gPSBbXTtcblxuICBjb25zdCB7XG4gICAgc2VydmljZVdvcmtlcixcbiAgICBpbmRleEh0bWxPcHRpb25zLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICBzc3JPcHRpb25zLFxuICAgIHByZXJlbmRlck9wdGlvbnMsXG4gICAgYXBwU2hlbGxPcHRpb25zLFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgdmVyYm9zZSxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgLyoqXG4gICAqIEluZGV4IEhUTUwgY29udGVudCB3aXRob3V0IENTUyBpbmxpbmluZyB0byBiZSB1c2VkIGZvciBzZXJ2ZXIgcmVuZGVyaW5nIChBcHBTaGVsbCwgU1NHIGFuZCBTU1IpLlxuICAgKlxuICAgKiBOT1RFOiB3ZSBkb24ndCBwZXJmb3JtIGNyaXRpY2FsIENTUyBpbmxpbmluZyBhcyB0aGlzIHdpbGwgYmUgZG9uZSBkdXJpbmcgc2VydmVyIHJlbmRlcmluZy5cbiAgICovXG4gIGxldCBpbmRleENvbnRlbnRPdXRwdXROb0Nzc0lubGluaW5nOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgLy8gR2VuZXJhdGUgaW5kZXggSFRNTCBmaWxlXG4gIC8vIElmIGxvY2FsaXphdGlvbiBpcyBlbmFibGVkLCBpbmRleCBnZW5lcmF0aW9uIGlzIGhhbmRsZWQgaW4gdGhlIGlubGluaW5nIHByb2Nlc3MuXG4gIC8vIE5PVEU6IExvY2FsaXphdGlvbiB3aXRoIFNTUiBpcyBub3QgY3VycmVudGx5IHN1cHBvcnRlZC5cbiAgaWYgKGluZGV4SHRtbE9wdGlvbnMpIHtcbiAgICBjb25zdCB7IGNvbnRlbnQsIGNvbnRlbnRXaXRob3V0Q3JpdGljYWxDc3NJbmxpbmVkLCBlcnJvcnMsIHdhcm5pbmdzIH0gPSBhd2FpdCBnZW5lcmF0ZUluZGV4SHRtbChcbiAgICAgIGluaXRpYWxGaWxlcyxcbiAgICAgIG91dHB1dEZpbGVzLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgICAgfSxcbiAgICAgIGxvY2FsZSxcbiAgICApO1xuXG4gICAgaW5kZXhDb250ZW50T3V0cHV0Tm9Dc3NJbmxpbmluZyA9IGNvbnRlbnRXaXRob3V0Q3JpdGljYWxDc3NJbmxpbmVkO1xuICAgIGFsbEVycm9ycy5wdXNoKC4uLmVycm9ycyk7XG4gICAgYWxsV2FybmluZ3MucHVzaCguLi53YXJuaW5ncyk7XG5cbiAgICBhZGRpdGlvbmFsT3V0cHV0RmlsZXMucHVzaChcbiAgICAgIGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChpbmRleEh0bWxPcHRpb25zLm91dHB1dCwgY29udGVudCwgQnVpbGRPdXRwdXRGaWxlVHlwZS5Ccm93c2VyKSxcbiAgICApO1xuXG4gICAgaWYgKHNzck9wdGlvbnMpIHtcbiAgICAgIGFkZGl0aW9uYWxPdXRwdXRGaWxlcy5wdXNoKFxuICAgICAgICBjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQoXG4gICAgICAgICAgJ2luZGV4LnNlcnZlci5odG1sJyxcbiAgICAgICAgICBjb250ZW50V2l0aG91dENyaXRpY2FsQ3NzSW5saW5lZCxcbiAgICAgICAgICBCdWlsZE91dHB1dEZpbGVUeXBlLlNlcnZlcixcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJlLXJlbmRlciAoU1NHKSBhbmQgQXBwLXNoZWxsXG4gIC8vIElmIGxvY2FsaXphdGlvbiBpcyBlbmFibGVkLCBwcmVyZW5kZXJpbmcgaXMgaGFuZGxlZCBpbiB0aGUgaW5saW5pbmcgcHJvY2Vzcy5cbiAgaWYgKHByZXJlbmRlck9wdGlvbnMgfHwgYXBwU2hlbGxPcHRpb25zKSB7XG4gICAgYXNzZXJ0KFxuICAgICAgaW5kZXhDb250ZW50T3V0cHV0Tm9Dc3NJbmxpbmluZyxcbiAgICAgICdUaGUgXCJpbmRleFwiIG9wdGlvbiBpcyByZXF1aXJlZCB3aGVuIHVzaW5nIHRoZSBcInNzZ1wiIG9yIFwiYXBwU2hlbGxcIiBvcHRpb25zLicsXG4gICAgKTtcblxuICAgIGNvbnN0IHtcbiAgICAgIG91dHB1dCxcbiAgICAgIHdhcm5pbmdzLFxuICAgICAgZXJyb3JzLFxuICAgICAgcHJlcmVuZGVyZWRSb3V0ZXM6IGdlbmVyYXRlZFJvdXRlcyxcbiAgICB9ID0gYXdhaXQgcHJlcmVuZGVyUGFnZXMoXG4gICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgYXBwU2hlbGxPcHRpb25zLFxuICAgICAgcHJlcmVuZGVyT3B0aW9ucyxcbiAgICAgIG91dHB1dEZpbGVzLFxuICAgICAgaW5kZXhDb250ZW50T3V0cHV0Tm9Dc3NJbmxpbmluZyxcbiAgICAgIHNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyxcbiAgICAgIG9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLmlubGluZUNyaXRpY2FsLFxuICAgICAgbWF4V29ya2VycyxcbiAgICAgIHZlcmJvc2UsXG4gICAgKTtcblxuICAgIGFsbEVycm9ycy5wdXNoKC4uLmVycm9ycyk7XG4gICAgYWxsV2FybmluZ3MucHVzaCguLi53YXJuaW5ncyk7XG4gICAgcHJlcmVuZGVyZWRSb3V0ZXMucHVzaCguLi5BcnJheS5mcm9tKGdlbmVyYXRlZFJvdXRlcykpO1xuXG4gICAgZm9yIChjb25zdCBbcGF0aCwgY29udGVudF0gb2YgT2JqZWN0LmVudHJpZXMob3V0cHV0KSkge1xuICAgICAgYWRkaXRpb25hbE91dHB1dEZpbGVzLnB1c2goXG4gICAgICAgIGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChwYXRoLCBjb250ZW50LCBCdWlsZE91dHB1dEZpbGVUeXBlLkJyb3dzZXIpLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvLyBBdWdtZW50IHRoZSBhcHBsaWNhdGlvbiB3aXRoIHNlcnZpY2Ugd29ya2VyIHN1cHBvcnRcbiAgLy8gSWYgbG9jYWxpemF0aW9uIGlzIGVuYWJsZWQsIHNlcnZpY2Ugd29ya2VyIGlzIGhhbmRsZWQgaW4gdGhlIGlubGluaW5nIHByb2Nlc3MuXG4gIGlmIChzZXJ2aWNlV29ya2VyKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNlcnZpY2VXb3JrZXJSZXN1bHQgPSBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXJFc2J1aWxkKFxuICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICBzZXJ2aWNlV29ya2VyLFxuICAgICAgICBvcHRpb25zLmJhc2VIcmVmIHx8ICcvJyxcbiAgICAgICAgb3V0cHV0RmlsZXMsXG4gICAgICAgIGFzc2V0RmlsZXMsXG4gICAgICApO1xuICAgICAgYWRkaXRpb25hbE91dHB1dEZpbGVzLnB1c2goXG4gICAgICAgIGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChcbiAgICAgICAgICAnbmdzdy5qc29uJyxcbiAgICAgICAgICBzZXJ2aWNlV29ya2VyUmVzdWx0Lm1hbmlmZXN0LFxuICAgICAgICAgIEJ1aWxkT3V0cHV0RmlsZVR5cGUuQnJvd3NlcixcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBhZGRpdGlvbmFsQXNzZXRzLnB1c2goLi4uc2VydmljZVdvcmtlclJlc3VsdC5hc3NldEZpbGVzKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgYWxsRXJyb3JzLnB1c2goZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBgJHtlcnJvcn1gKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGVycm9yczogYWxsRXJyb3JzLFxuICAgIHdhcm5pbmdzOiBhbGxXYXJuaW5ncyxcbiAgICBhZGRpdGlvbmFsQXNzZXRzLFxuICAgIHByZXJlbmRlcmVkUm91dGVzLFxuICAgIGFkZGl0aW9uYWxPdXRwdXRGaWxlcyxcbiAgfTtcbn1cbiJdfQ==