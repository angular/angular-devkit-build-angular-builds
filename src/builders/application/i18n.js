"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadActiveTranslations = exports.inlineI18n = void 0;
const node_path_1 = require("node:path");
const bundler_context_1 = require("../../tools/esbuild/bundler-context");
const i18n_inliner_1 = require("../../tools/esbuild/i18n-inliner");
const index_html_generator_1 = require("../../tools/esbuild/index-html-generator");
const utils_1 = require("../../tools/esbuild/utils");
const environment_options_1 = require("../../utils/environment-options");
const i18n_options_1 = require("../../utils/i18n-options");
const load_translations_1 = require("../../utils/load-translations");
const prerender_1 = require("../../utils/server-rendering/prerender");
const service_worker_1 = require("../../utils/service-worker");
const url_1 = require("../../utils/url");
/**
 * Inlines all active locales as specified by the application build options into all
 * application JavaScript files created during the build.
 * @param options The normalized application builder options used to create the build.
 * @param executionResult The result of an executed build.
 * @param initialFiles A map containing initial file information for the executed build.
 */
async function inlineI18n(options, executionResult, initialFiles) {
    // Create the multi-threaded inliner with common options and the files generated from the build.
    const inliner = new i18n_inliner_1.I18nInliner({
        missingTranslation: options.i18nOptions.missingTranslationBehavior ?? 'warning',
        outputFiles: executionResult.outputFiles,
        shouldOptimize: options.optimizationOptions.scripts,
    }, environment_options_1.maxWorkers);
    const inlineResult = {
        errors: [],
        warnings: [],
    };
    // For each active locale, use the inliner to process the output files of the build.
    const updatedOutputFiles = [];
    const updatedAssetFiles = [];
    try {
        for (const locale of options.i18nOptions.inlineLocales) {
            // A locale specific set of files is returned from the inliner.
            const localeOutputFiles = await inliner.inlineForLocale(locale, options.i18nOptions.locales[locale].translation);
            const baseHref = getLocaleBaseHref(options.baseHref, options.i18nOptions, locale) ?? options.baseHref;
            // Generate locale specific index HTML files
            if (options.indexHtmlOptions) {
                const { content, contentWithoutCriticalCssInlined, errors, warnings } = await (0, index_html_generator_1.generateIndexHtml)(initialFiles, localeOutputFiles, {
                    ...options,
                    baseHref,
                }, locale);
                localeOutputFiles.push((0, utils_1.createOutputFileFromText)(options.indexHtmlOptions.output, content, bundler_context_1.BuildOutputFileType.Browser));
                inlineResult.errors.push(...errors);
                inlineResult.warnings.push(...warnings);
                // Pre-render (SSG) and App-shell
                if (options.prerenderOptions || options.appShellOptions) {
                    const { output, warnings, errors } = await (0, prerender_1.prerenderPages)(options.workspaceRoot, options.appShellOptions, options.prerenderOptions, localeOutputFiles, contentWithoutCriticalCssInlined, options.optimizationOptions.styles.inlineCritical, environment_options_1.maxWorkers, options.verbose);
                    inlineResult.errors.push(...errors);
                    inlineResult.warnings.push(...warnings);
                    for (const [path, content] of Object.entries(output)) {
                        localeOutputFiles.push((0, utils_1.createOutputFileFromText)(path, content, bundler_context_1.BuildOutputFileType.Browser));
                    }
                }
            }
            if (options.serviceWorker) {
                try {
                    const serviceWorkerResult = await (0, service_worker_1.augmentAppWithServiceWorkerEsbuild)(options.workspaceRoot, options.serviceWorker, baseHref || '/', localeOutputFiles, executionResult.assetFiles);
                    localeOutputFiles.push((0, utils_1.createOutputFileFromText)('ngsw.json', serviceWorkerResult.manifest, bundler_context_1.BuildOutputFileType.Browser));
                    executionResult.assetFiles.push(...serviceWorkerResult.assetFiles);
                }
                catch (error) {
                    inlineResult.errors.push(error instanceof Error ? error.message : `${error}`);
                }
            }
            // Update directory with locale base
            if (options.i18nOptions.flatOutput !== true) {
                localeOutputFiles.forEach((file) => {
                    file.path = (0, node_path_1.join)(locale, file.path);
                });
                for (const assetFile of executionResult.assetFiles) {
                    updatedAssetFiles.push({
                        source: assetFile.source,
                        destination: (0, node_path_1.join)(locale, assetFile.destination),
                    });
                }
            }
            updatedOutputFiles.push(...localeOutputFiles);
        }
    }
    finally {
        await inliner.close();
    }
    // Update the result with all localized files
    executionResult.outputFiles = updatedOutputFiles;
    // Assets are only changed if not using the flat output option
    if (options.i18nOptions.flatOutput !== true) {
        executionResult.assetFiles = updatedAssetFiles;
    }
    return inlineResult;
}
exports.inlineI18n = inlineI18n;
function getLocaleBaseHref(baseHref, i18n, locale) {
    if (i18n.flatOutput) {
        return undefined;
    }
    if (i18n.locales[locale] && i18n.locales[locale].baseHref !== '') {
        return (0, url_1.urlJoin)(baseHref || '', i18n.locales[locale].baseHref ?? `/${locale}/`);
    }
    return undefined;
}
/**
 * Loads all active translations using the translation loaders from the `@angular/localize` package.
 * @param context The architect builder context for the current build.
 * @param i18n The normalized i18n options to use.
 */
async function loadActiveTranslations(context, i18n) {
    // Load locale data and translations (if present)
    let loader;
    for (const [locale, desc] of Object.entries(i18n.locales)) {
        if (!i18n.inlineLocales.has(locale) && locale !== i18n.sourceLocale) {
            continue;
        }
        if (!desc.files.length) {
            continue;
        }
        loader ??= await (0, load_translations_1.createTranslationLoader)();
        (0, i18n_options_1.loadTranslations)(locale, desc, context.workspaceRoot, loader, {
            warn(message) {
                context.logger.warn(message);
            },
            error(message) {
                throw new Error(message);
            },
        }, undefined, i18n.duplicateTranslationBehavior);
    }
}
exports.loadActiveTranslations = loadActiveTranslations;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL2kxOG4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBR0gseUNBQWlDO0FBQ2pDLHlFQUE2RjtBQUU3RixtRUFBK0Q7QUFDL0QsbUZBQTZFO0FBQzdFLHFEQUFxRTtBQUNyRSx5RUFBNkQ7QUFDN0QsMkRBQTREO0FBQzVELHFFQUF3RTtBQUN4RSxzRUFBd0U7QUFDeEUsK0RBQWdGO0FBQ2hGLHlDQUEwQztBQUcxQzs7Ozs7O0dBTUc7QUFDSSxLQUFLLFVBQVUsVUFBVSxDQUM5QixPQUEwQyxFQUMxQyxlQUFnQyxFQUNoQyxZQUE0QztJQUU1QyxnR0FBZ0c7SUFDaEcsTUFBTSxPQUFPLEdBQUcsSUFBSSwwQkFBVyxDQUM3QjtRQUNFLGtCQUFrQixFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQUMsMEJBQTBCLElBQUksU0FBUztRQUMvRSxXQUFXLEVBQUUsZUFBZSxDQUFDLFdBQVc7UUFDeEMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPO0tBQ3BELEVBQ0QsZ0NBQVUsQ0FDWCxDQUFDO0lBRUYsTUFBTSxZQUFZLEdBQTZDO1FBQzdELE1BQU0sRUFBRSxFQUFFO1FBQ1YsUUFBUSxFQUFFLEVBQUU7S0FDYixDQUFDO0lBRUYsb0ZBQW9GO0lBQ3BGLE1BQU0sa0JBQWtCLEdBQUcsRUFBRSxDQUFDO0lBQzlCLE1BQU0saUJBQWlCLEdBQUcsRUFBRSxDQUFDO0lBQzdCLElBQUk7UUFDRixLQUFLLE1BQU0sTUFBTSxJQUFJLE9BQU8sQ0FBQyxXQUFXLENBQUMsYUFBYSxFQUFFO1lBQ3RELCtEQUErRDtZQUMvRCxNQUFNLGlCQUFpQixHQUFHLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FDckQsTUFB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aWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBCdWlsZE91dHB1dEZpbGVUeXBlLCBJbml0aWFsRmlsZVJlY29yZCB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvYnVuZGxlci1jb250ZXh0JztcbmltcG9ydCB7IEV4ZWN1dGlvblJlc3VsdCB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvYnVuZGxlci1leGVjdXRpb24tcmVzdWx0JztcbmltcG9ydCB7IEkxOG5JbmxpbmVyIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9pMThuLWlubGluZXInO1xuaW1wb3J0IHsgZ2VuZXJhdGVJbmRleEh0bWwgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2luZGV4LWh0bWwtZ2VuZXJhdG9yJztcbmltcG9ydCB7IGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dCB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvdXRpbHMnO1xuaW1wb3J0IHsgbWF4V29ya2VycyB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgbG9hZFRyYW5zbGF0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2kxOG4tb3B0aW9ucyc7XG5pbXBvcnQgeyBjcmVhdGVUcmFuc2xhdGlvbkxvYWRlciB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtdHJhbnNsYXRpb25zJztcbmltcG9ydCB7IHByZXJlbmRlclBhZ2VzIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2VydmVyLXJlbmRlcmluZy9wcmVyZW5kZXInO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyRXNidWlsZCB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IHVybEpvaW4gfSBmcm9tICcuLi8uLi91dGlscy91cmwnO1xuaW1wb3J0IHsgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcblxuLyoqXG4gKiBJbmxpbmVzIGFsbCBhY3RpdmUgbG9jYWxlcyBhcyBzcGVjaWZpZWQgYnkgdGhlIGFwcGxpY2F0aW9uIGJ1aWxkIG9wdGlvbnMgaW50byBhbGxcbiAqIGFwcGxpY2F0aW9uIEphdmFTY3JpcHQgZmlsZXMgY3JlYXRlZCBkdXJpbmcgdGhlIGJ1aWxkLlxuICogQHBhcmFtIG9wdGlvbnMgVGhlIG5vcm1hbGl6ZWQgYXBwbGljYXRpb24gYnVpbGRlciBvcHRpb25zIHVzZWQgdG8gY3JlYXRlIHRoZSBidWlsZC5cbiAqIEBwYXJhbSBleGVjdXRpb25SZXN1bHQgVGhlIHJlc3VsdCBvZiBhbiBleGVjdXRlZCBidWlsZC5cbiAqIEBwYXJhbSBpbml0aWFsRmlsZXMgQSBtYXAgY29udGFpbmluZyBpbml0aWFsIGZpbGUgaW5mb3JtYXRpb24gZm9yIHRoZSBleGVjdXRlZCBidWlsZC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGlubGluZUkxOG4oXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyxcbiAgZXhlY3V0aW9uUmVzdWx0OiBFeGVjdXRpb25SZXN1bHQsXG4gIGluaXRpYWxGaWxlczogTWFwPHN0cmluZywgSW5pdGlhbEZpbGVSZWNvcmQ+LFxuKTogUHJvbWlzZTx7IGVycm9yczogc3RyaW5nW107IHdhcm5pbmdzOiBzdHJpbmdbXSB9PiB7XG4gIC8vIENyZWF0ZSB0aGUgbXVsdGktdGhyZWFkZWQgaW5saW5lciB3aXRoIGNvbW1vbiBvcHRpb25zIGFuZCB0aGUgZmlsZXMgZ2VuZXJhdGVkIGZyb20gdGhlIGJ1aWxkLlxuICBjb25zdCBpbmxpbmVyID0gbmV3IEkxOG5JbmxpbmVyKFxuICAgIHtcbiAgICAgIG1pc3NpbmdUcmFuc2xhdGlvbjogb3B0aW9ucy5pMThuT3B0aW9ucy5taXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvciA/PyAnd2FybmluZycsXG4gICAgICBvdXRwdXRGaWxlczogZXhlY3V0aW9uUmVzdWx0Lm91dHB1dEZpbGVzLFxuICAgICAgc2hvdWxkT3B0aW1pemU6IG9wdGlvbnMub3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzLFxuICAgIH0sXG4gICAgbWF4V29ya2VycyxcbiAgKTtcblxuICBjb25zdCBpbmxpbmVSZXN1bHQ6IHsgZXJyb3JzOiBzdHJpbmdbXTsgd2FybmluZ3M6IHN0cmluZ1tdIH0gPSB7XG4gICAgZXJyb3JzOiBbXSxcbiAgICB3YXJuaW5nczogW10sXG4gIH07XG5cbiAgLy8gRm9yIGVhY2ggYWN0aXZlIGxvY2FsZSwgdXNlIHRoZSBpbmxpbmVyIHRvIHByb2Nlc3MgdGhlIG91dHB1dCBmaWxlcyBvZiB0aGUgYnVpbGQuXG4gIGNvbnN0IHVwZGF0ZWRPdXRwdXRGaWxlcyA9IFtdO1xuICBjb25zdCB1cGRhdGVkQXNzZXRGaWxlcyA9IFtdO1xuICB0cnkge1xuICAgIGZvciAoY29uc3QgbG9jYWxlIG9mIG9wdGlvbnMuaTE4bk9wdGlvbnMuaW5saW5lTG9jYWxlcykge1xuICAgICAgLy8gQSBsb2NhbGUgc3BlY2lmaWMgc2V0IG9mIGZpbGVzIGlzIHJldHVybmVkIGZyb20gdGhlIGlubGluZXIuXG4gICAgICBjb25zdCBsb2NhbGVPdXRwdXRGaWxlcyA9IGF3YWl0IGlubGluZXIuaW5saW5lRm9yTG9jYWxlKFxuICAgICAgICBsb2NhbGUsXG4gICAgICAgIG9wdGlvbnMuaTE4bk9wdGlvbnMubG9jYWxlc1tsb2NhbGVdLnRyYW5zbGF0aW9uLFxuICAgICAgKTtcblxuICAgICAgY29uc3QgYmFzZUhyZWYgPVxuICAgICAgICBnZXRMb2NhbGVCYXNlSHJlZihvcHRpb25zLmJhc2VIcmVmLCBvcHRpb25zLmkxOG5PcHRpb25zLCBsb2NhbGUpID8/IG9wdGlvbnMuYmFzZUhyZWY7XG5cbiAgICAgIC8vIEdlbmVyYXRlIGxvY2FsZSBzcGVjaWZpYyBpbmRleCBIVE1MIGZpbGVzXG4gICAgICBpZiAob3B0aW9ucy5pbmRleEh0bWxPcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHsgY29udGVudCwgY29udGVudFdpdGhvdXRDcml0aWNhbENzc0lubGluZWQsIGVycm9ycywgd2FybmluZ3MgfSA9XG4gICAgICAgICAgYXdhaXQgZ2VuZXJhdGVJbmRleEh0bWwoXG4gICAgICAgICAgICBpbml0aWFsRmlsZXMsXG4gICAgICAgICAgICBsb2NhbGVPdXRwdXRGaWxlcyxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgICAgYmFzZUhyZWYsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbG9jYWxlLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgbG9jYWxlT3V0cHV0RmlsZXMucHVzaChcbiAgICAgICAgICBjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQoXG4gICAgICAgICAgICBvcHRpb25zLmluZGV4SHRtbE9wdGlvbnMub3V0cHV0LFxuICAgICAgICAgICAgY29udGVudCxcbiAgICAgICAgICAgIEJ1aWxkT3V0cHV0RmlsZVR5cGUuQnJvd3NlcixcbiAgICAgICAgICApLFxuICAgICAgICApO1xuICAgICAgICBpbmxpbmVSZXN1bHQuZXJyb3JzLnB1c2goLi4uZXJyb3JzKTtcbiAgICAgICAgaW5saW5lUmVzdWx0Lndhcm5pbmdzLnB1c2goLi4ud2FybmluZ3MpO1xuXG4gICAgICAgIC8vIFByZS1yZW5kZXIgKFNTRykgYW5kIEFwcC1zaGVsbFxuICAgICAgICBpZiAob3B0aW9ucy5wcmVyZW5kZXJPcHRpb25zIHx8IG9wdGlvbnMuYXBwU2hlbGxPcHRpb25zKSB7XG4gICAgICAgICAgY29uc3QgeyBvdXRwdXQsIHdhcm5pbmdzLCBlcnJvcnMgfSA9IGF3YWl0IHByZXJlbmRlclBhZ2VzKFxuICAgICAgICAgICAgb3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgICAgICAgICAgb3B0aW9ucy5hcHBTaGVsbE9wdGlvbnMsXG4gICAgICAgICAgICBvcHRpb25zLnByZXJlbmRlck9wdGlvbnMsXG4gICAgICAgICAgICBsb2NhbGVPdXRwdXRGaWxlcyxcbiAgICAgICAgICAgIGNvbnRlbnRXaXRob3V0Q3JpdGljYWxDc3NJbmxpbmVkLFxuICAgICAgICAgICAgb3B0aW9ucy5vcHRpbWl6YXRpb25PcHRpb25zLnN0eWxlcy5pbmxpbmVDcml0aWNhbCxcbiAgICAgICAgICAgIG1heFdvcmtlcnMsXG4gICAgICAgICAgICBvcHRpb25zLnZlcmJvc2UsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGlubGluZVJlc3VsdC5lcnJvcnMucHVzaCguLi5lcnJvcnMpO1xuICAgICAgICAgIGlubGluZVJlc3VsdC53YXJuaW5ncy5wdXNoKC4uLndhcm5pbmdzKTtcblxuICAgICAgICAgIGZvciAoY29uc3QgW3BhdGgsIGNvbnRlbnRdIG9mIE9iamVjdC5lbnRyaWVzKG91dHB1dCkpIHtcbiAgICAgICAgICAgIGxvY2FsZU91dHB1dEZpbGVzLnB1c2goXG4gICAgICAgICAgICAgIGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChwYXRoLCBjb250ZW50LCBCdWlsZE91dHB1dEZpbGVUeXBlLkJyb3dzZXIpLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMuc2VydmljZVdvcmtlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHNlcnZpY2VXb3JrZXJSZXN1bHQgPSBhd2FpdCBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXJFc2J1aWxkKFxuICAgICAgICAgICAgb3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgICAgICAgICAgb3B0aW9ucy5zZXJ2aWNlV29ya2VyLFxuICAgICAgICAgICAgYmFzZUhyZWYgfHwgJy8nLFxuICAgICAgICAgICAgbG9jYWxlT3V0cHV0RmlsZXMsXG4gICAgICAgICAgICBleGVjdXRpb25SZXN1bHQuYXNzZXRGaWxlcyxcbiAgICAgICAgICApO1xuICAgICAgICAgIGxvY2FsZU91dHB1dEZpbGVzLnB1c2goXG4gICAgICAgICAgICBjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQoXG4gICAgICAgICAgICAgICduZ3N3Lmpzb24nLFxuICAgICAgICAgICAgICBzZXJ2aWNlV29ya2VyUmVzdWx0Lm1hbmlmZXN0LFxuICAgICAgICAgICAgICBCdWlsZE91dHB1dEZpbGVUeXBlLkJyb3dzZXIsXG4gICAgICAgICAgICApLFxuICAgICAgICAgICk7XG4gICAgICAgICAgZXhlY3V0aW9uUmVzdWx0LmFzc2V0RmlsZXMucHVzaCguLi5zZXJ2aWNlV29ya2VyUmVzdWx0LmFzc2V0RmlsZXMpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGlubGluZVJlc3VsdC5lcnJvcnMucHVzaChlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGAke2Vycm9yfWApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSBkaXJlY3Rvcnkgd2l0aCBsb2NhbGUgYmFzZVxuICAgICAgaWYgKG9wdGlvbnMuaTE4bk9wdGlvbnMuZmxhdE91dHB1dCAhPT0gdHJ1ZSkge1xuICAgICAgICBsb2NhbGVPdXRwdXRGaWxlcy5mb3JFYWNoKChmaWxlKSA9PiB7XG4gICAgICAgICAgZmlsZS5wYXRoID0gam9pbihsb2NhbGUsIGZpbGUucGF0aCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZvciAoY29uc3QgYXNzZXRGaWxlIG9mIGV4ZWN1dGlvblJlc3VsdC5hc3NldEZpbGVzKSB7XG4gICAgICAgICAgdXBkYXRlZEFzc2V0RmlsZXMucHVzaCh7XG4gICAgICAgICAgICBzb3VyY2U6IGFzc2V0RmlsZS5zb3VyY2UsXG4gICAgICAgICAgICBkZXN0aW5hdGlvbjogam9pbihsb2NhbGUsIGFzc2V0RmlsZS5kZXN0aW5hdGlvbiksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdXBkYXRlZE91dHB1dEZpbGVzLnB1c2goLi4ubG9jYWxlT3V0cHV0RmlsZXMpO1xuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICBhd2FpdCBpbmxpbmVyLmNsb3NlKCk7XG4gIH1cblxuICAvLyBVcGRhdGUgdGhlIHJlc3VsdCB3aXRoIGFsbCBsb2NhbGl6ZWQgZmlsZXNcbiAgZXhlY3V0aW9uUmVzdWx0Lm91dHB1dEZpbGVzID0gdXBkYXRlZE91dHB1dEZpbGVzO1xuXG4gIC8vIEFzc2V0cyBhcmUgb25seSBjaGFuZ2VkIGlmIG5vdCB1c2luZyB0aGUgZmxhdCBvdXRwdXQgb3B0aW9uXG4gIGlmIChvcHRpb25zLmkxOG5PcHRpb25zLmZsYXRPdXRwdXQgIT09IHRydWUpIHtcbiAgICBleGVjdXRpb25SZXN1bHQuYXNzZXRGaWxlcyA9IHVwZGF0ZWRBc3NldEZpbGVzO1xuICB9XG5cbiAgcmV0dXJuIGlubGluZVJlc3VsdDtcbn1cblxuZnVuY3Rpb24gZ2V0TG9jYWxlQmFzZUhyZWYoXG4gIGJhc2VIcmVmOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gIGkxOG46IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9uc1snaTE4bk9wdGlvbnMnXSxcbiAgbG9jYWxlOiBzdHJpbmcsXG4pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBpZiAoaTE4bi5mbGF0T3V0cHV0KSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGlmIChpMThuLmxvY2FsZXNbbG9jYWxlXSAmJiBpMThuLmxvY2FsZXNbbG9jYWxlXS5iYXNlSHJlZiAhPT0gJycpIHtcbiAgICByZXR1cm4gdXJsSm9pbihiYXNlSHJlZiB8fCAnJywgaTE4bi5sb2NhbGVzW2xvY2FsZV0uYmFzZUhyZWYgPz8gYC8ke2xvY2FsZX0vYCk7XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIExvYWRzIGFsbCBhY3RpdmUgdHJhbnNsYXRpb25zIHVzaW5nIHRoZSB0cmFuc2xhdGlvbiBsb2FkZXJzIGZyb20gdGhlIGBAYW5ndWxhci9sb2NhbGl6ZWAgcGFja2FnZS5cbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBhcmNoaXRlY3QgYnVpbGRlciBjb250ZXh0IGZvciB0aGUgY3VycmVudCBidWlsZC5cbiAqIEBwYXJhbSBpMThuIFRoZSBub3JtYWxpemVkIGkxOG4gb3B0aW9ucyB0byB1c2UuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkQWN0aXZlVHJhbnNsYXRpb25zKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgaTE4bjogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zWydpMThuT3B0aW9ucyddLFxuKSB7XG4gIC8vIExvYWQgbG9jYWxlIGRhdGEgYW5kIHRyYW5zbGF0aW9ucyAoaWYgcHJlc2VudClcbiAgbGV0IGxvYWRlcjtcbiAgZm9yIChjb25zdCBbbG9jYWxlLCBkZXNjXSBvZiBPYmplY3QuZW50cmllcyhpMThuLmxvY2FsZXMpKSB7XG4gICAgaWYgKCFpMThuLmlubGluZUxvY2FsZXMuaGFzKGxvY2FsZSkgJiYgbG9jYWxlICE9PSBpMThuLnNvdXJjZUxvY2FsZSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKCFkZXNjLmZpbGVzLmxlbmd0aCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgbG9hZGVyID8/PSBhd2FpdCBjcmVhdGVUcmFuc2xhdGlvbkxvYWRlcigpO1xuXG4gICAgbG9hZFRyYW5zbGF0aW9ucyhcbiAgICAgIGxvY2FsZSxcbiAgICAgIGRlc2MsXG4gICAgICBjb250ZXh0LndvcmtzcGFjZVJvb3QsXG4gICAgICBsb2FkZXIsXG4gICAgICB7XG4gICAgICAgIHdhcm4obWVzc2FnZSkge1xuICAgICAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4obWVzc2FnZSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yKG1lc3NhZ2UpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgdW5kZWZpbmVkLFxuICAgICAgaTE4bi5kdXBsaWNhdGVUcmFuc2xhdGlvbkJlaGF2aW9yLFxuICAgICk7XG4gIH1cbn1cbiJdfQ==