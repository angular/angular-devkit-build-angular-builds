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
                localeOutputFiles.push((0, utils_1.createOutputFileFromText)(options.indexHtmlOptions.output, content));
                inlineResult.errors.push(...errors);
                inlineResult.warnings.push(...warnings);
                // Pre-render (SSG) and App-shell
                if (options.prerenderOptions || options.appShellOptions) {
                    const { output, warnings, errors } = await (0, prerender_1.prerenderPages)(options.workspaceRoot, options.appShellOptions, options.prerenderOptions, localeOutputFiles, contentWithoutCriticalCssInlined, options.optimizationOptions.styles.inlineCritical, environment_options_1.maxWorkers, options.verbose);
                    inlineResult.errors.push(...errors);
                    inlineResult.warnings.push(...warnings);
                    for (const [path, content] of Object.entries(output)) {
                        localeOutputFiles.push((0, utils_1.createOutputFileFromText)(path, content));
                    }
                }
            }
            if (options.serviceWorker) {
                try {
                    const serviceWorkerResult = await (0, service_worker_1.augmentAppWithServiceWorkerEsbuild)(options.workspaceRoot, options.serviceWorker, baseHref || '/', localeOutputFiles, executionResult.assetFiles);
                    localeOutputFiles.push((0, utils_1.createOutputFileFromText)('ngsw.json', serviceWorkerResult.manifest));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL2kxOG4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBR0gseUNBQWlDO0FBR2pDLG1FQUErRDtBQUMvRCxtRkFBNkU7QUFDN0UscURBQXFFO0FBQ3JFLHlFQUE2RDtBQUM3RCwyREFBNEQ7QUFDNUQscUVBQXdFO0FBQ3hFLHNFQUF3RTtBQUN4RSwrREFBZ0Y7QUFDaEYseUNBQTBDO0FBRzFDOzs7Ozs7R0FNRztBQUNJLEtBQUssVUFBVSxVQUFVLENBQzlCLE9BQTBDLEVBQzFDLGVBQWdDLEVBQ2hDLFlBQTRDO0lBRTVDLGdHQUFnRztJQUNoRyxNQUFNLE9BQU8sR0FBRyxJQUFJLDBCQUFXLENBQzdCO1FBQ0Usa0JBQWtCLEVBQUUsT0FBTyxDQUFDLFdBQVcsQ0FBQywwQkFBMEIsSUFBSSxTQUFTO1FBQy9FLFdBQVcsRUFBRSxlQUFlLENBQUMsV0FBVztRQUN4QyxjQUFjLEVBQUUsT0FBTyxDQUFDLG1CQUFtQixDQUFDLE9BQU87S0FDcEQsRUFDRCxnQ0FBVSxDQUNYLENBQUM7SUFFRixNQUFNLFlBQVksR0FBNkM7UUFDN0QsTUFBTSxFQUFFLEVBQUU7UUFDVixRQUFRLEVBQUUsRUFBRTtLQUNiLENBQUM7SUFFRixvRkFBb0Y7SUFDcEYsTUFBTSxrQkFBa0IsR0FBRyxFQUFFLENBQUM7SUFDOUIsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUM7SUFDN0IsSUFBSTtRQUNGLEtBQUssTUFBTSxNQUFNLElBQUksT0FBTyxDQUFDLFdBQVcsQ0FBQyxhQUFhLEVBQUU7WUFDdEQsK0RBQStEO1lBQy9ELE1BQU0saUJBQWlCLEdBQUcsTUFBTSxPQUFPLENBQUMsZUFBZSxDQUNyRCxNQUFNLEVBQ04sT0FBTyxD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UUFBUSxJQUFJLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztLQUNoRjtJQUVELE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUM7QUFFRDs7OztHQUlHO0FBQ0ksS0FBSyxVQUFVLHNCQUFzQixDQUMxQyxPQUF1QixFQUN2QixJQUFzRDtJQUV0RCxpREFBaUQ7SUFDakQsSUFBSSxNQUFNLENBQUM7SUFDWCxLQUFLLE1BQU0sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDekQsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLE1BQU0sS0FBSyxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ25FLFNBQVM7U0FDVjtRQUVELElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRTtZQUN0QixTQUFTO1NBQ1Y7UUFFRCxNQUFNLEtBQUssTUFBTSxJQUFBLDJDQUF1QixHQUFFLENBQUM7UUFFM0MsSUFBQSwrQkFBZ0IsRUFDZCxNQUFNLEVBQ04sSUFBSSxFQUNKLE9BQU8sQ0FBQyxhQUFhLEVBQ3JCLE1BQU0sRUFDTjtZQUNFLElBQUksQ0FBQyxPQUFPO2dCQUNWLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQy9CLENBQUM7WUFDRCxLQUFLLENBQUMsT0FBTztnQkFDWCxNQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzNCLENBQUM7U0FDRixFQUNELFNBQVMsRUFDVCxJQUFJLENBQUMsNEJBQTRCLENBQ2xDLENBQUM7S0FDSDtBQUNILENBQUM7QUFsQ0Qsd0RBa0NDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IEluaXRpYWxGaWxlUmVjb3JkIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9idW5kbGVyLWNvbnRleHQnO1xuaW1wb3J0IHsgRXhlY3V0aW9uUmVzdWx0IH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9idW5kbGVyLWV4ZWN1dGlvbi1yZXN1bHQnO1xuaW1wb3J0IHsgSTE4bklubGluZXIgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2kxOG4taW5saW5lcic7XG5pbXBvcnQgeyBnZW5lcmF0ZUluZGV4SHRtbCB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgY3JlYXRlT3V0cHV0RmlsZUZyb21UZXh0IH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC91dGlscyc7XG5pbXBvcnQgeyBtYXhXb3JrZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5pbXBvcnQgeyBsb2FkVHJhbnNsYXRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaTE4bi1vcHRpb25zJztcbmltcG9ydCB7IGNyZWF0ZVRyYW5zbGF0aW9uTG9hZGVyIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9hZC10cmFuc2xhdGlvbnMnO1xuaW1wb3J0IHsgcHJlcmVuZGVyUGFnZXMgfSBmcm9tICcuLi8uLi91dGlscy9zZXJ2ZXItcmVuZGVyaW5nL3ByZXJlbmRlcic7XG5pbXBvcnQgeyBhdWdtZW50QXBwV2l0aFNlcnZpY2VXb3JrZXJFc2J1aWxkIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2VydmljZS13b3JrZXInO1xuaW1wb3J0IHsgdXJsSm9pbiB9IGZyb20gJy4uLy4uL3V0aWxzL3VybCc7XG5pbXBvcnQgeyBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnO1xuXG4vKipcbiAqIElubGluZXMgYWxsIGFjdGl2ZSBsb2NhbGVzIGFzIHNwZWNpZmllZCBieSB0aGUgYXBwbGljYXRpb24gYnVpbGQgb3B0aW9ucyBpbnRvIGFsbFxuICogYXBwbGljYXRpb24gSmF2YVNjcmlwdCBmaWxlcyBjcmVhdGVkIGR1cmluZyB0aGUgYnVpbGQuXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgbm9ybWFsaXplZCBhcHBsaWNhdGlvbiBidWlsZGVyIG9wdGlvbnMgdXNlZCB0byBjcmVhdGUgdGhlIGJ1aWxkLlxuICogQHBhcmFtIGV4ZWN1dGlvblJlc3VsdCBUaGUgcmVzdWx0IG9mIGFuIGV4ZWN1dGVkIGJ1aWxkLlxuICogQHBhcmFtIGluaXRpYWxGaWxlcyBBIG1hcCBjb250YWluaW5nIGluaXRpYWwgZmlsZSBpbmZvcm1hdGlvbiBmb3IgdGhlIGV4ZWN1dGVkIGJ1aWxkLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaW5saW5lSTE4bihcbiAgb3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zLFxuICBleGVjdXRpb25SZXN1bHQ6IEV4ZWN1dGlvblJlc3VsdCxcbiAgaW5pdGlhbEZpbGVzOiBNYXA8c3RyaW5nLCBJbml0aWFsRmlsZVJlY29yZD4sXG4pOiBQcm9taXNlPHsgZXJyb3JzOiBzdHJpbmdbXTsgd2FybmluZ3M6IHN0cmluZ1tdIH0+IHtcbiAgLy8gQ3JlYXRlIHRoZSBtdWx0aS10aHJlYWRlZCBpbmxpbmVyIHdpdGggY29tbW9uIG9wdGlvbnMgYW5kIHRoZSBmaWxlcyBnZW5lcmF0ZWQgZnJvbSB0aGUgYnVpbGQuXG4gIGNvbnN0IGlubGluZXIgPSBuZXcgSTE4bklubGluZXIoXG4gICAge1xuICAgICAgbWlzc2luZ1RyYW5zbGF0aW9uOiBvcHRpb25zLmkxOG5PcHRpb25zLm1pc3NpbmdUcmFuc2xhdGlvbkJlaGF2aW9yID8/ICd3YXJuaW5nJyxcbiAgICAgIG91dHB1dEZpbGVzOiBleGVjdXRpb25SZXN1bHQub3V0cHV0RmlsZXMsXG4gICAgICBzaG91bGRPcHRpbWl6ZTogb3B0aW9ucy5vcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgfSxcbiAgICBtYXhXb3JrZXJzLFxuICApO1xuXG4gIGNvbnN0IGlubGluZVJlc3VsdDogeyBlcnJvcnM6IHN0cmluZ1tdOyB3YXJuaW5nczogc3RyaW5nW10gfSA9IHtcbiAgICBlcnJvcnM6IFtdLFxuICAgIHdhcm5pbmdzOiBbXSxcbiAgfTtcblxuICAvLyBGb3IgZWFjaCBhY3RpdmUgbG9jYWxlLCB1c2UgdGhlIGlubGluZXIgdG8gcHJvY2VzcyB0aGUgb3V0cHV0IGZpbGVzIG9mIHRoZSBidWlsZC5cbiAgY29uc3QgdXBkYXRlZE91dHB1dEZpbGVzID0gW107XG4gIGNvbnN0IHVwZGF0ZWRBc3NldEZpbGVzID0gW107XG4gIHRyeSB7XG4gICAgZm9yIChjb25zdCBsb2NhbGUgb2Ygb3B0aW9ucy5pMThuT3B0aW9ucy5pbmxpbmVMb2NhbGVzKSB7XG4gICAgICAvLyBBIGxvY2FsZSBzcGVjaWZpYyBzZXQgb2YgZmlsZXMgaXMgcmV0dXJuZWQgZnJvbSB0aGUgaW5saW5lci5cbiAgICAgIGNvbnN0IGxvY2FsZU91dHB1dEZpbGVzID0gYXdhaXQgaW5saW5lci5pbmxpbmVGb3JMb2NhbGUoXG4gICAgICAgIGxvY2FsZSxcbiAgICAgICAgb3B0aW9ucy5pMThuT3B0aW9ucy5sb2NhbGVzW2xvY2FsZV0udHJhbnNsYXRpb24sXG4gICAgICApO1xuXG4gICAgICBjb25zdCBiYXNlSHJlZiA9XG4gICAgICAgIGdldExvY2FsZUJhc2VIcmVmKG9wdGlvbnMuYmFzZUhyZWYsIG9wdGlvbnMuaTE4bk9wdGlvbnMsIGxvY2FsZSkgPz8gb3B0aW9ucy5iYXNlSHJlZjtcblxuICAgICAgLy8gR2VuZXJhdGUgbG9jYWxlIHNwZWNpZmljIGluZGV4IEhUTUwgZmlsZXNcbiAgICAgIGlmIChvcHRpb25zLmluZGV4SHRtbE9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgeyBjb250ZW50LCBjb250ZW50V2l0aG91dENyaXRpY2FsQ3NzSW5saW5lZCwgZXJyb3JzLCB3YXJuaW5ncyB9ID1cbiAgICAgICAgICBhd2FpdCBnZW5lcmF0ZUluZGV4SHRtbChcbiAgICAgICAgICAgIGluaXRpYWxGaWxlcyxcbiAgICAgICAgICAgIGxvY2FsZU91dHB1dEZpbGVzLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgICBiYXNlSHJlZixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBsb2NhbGUsXG4gICAgICAgICAgKTtcblxuICAgICAgICBsb2NhbGVPdXRwdXRGaWxlcy5wdXNoKGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dChvcHRpb25zLmluZGV4SHRtbE9wdGlvbnMub3V0cHV0LCBjb250ZW50KSk7XG4gICAgICAgIGlubGluZVJlc3VsdC5lcnJvcnMucHVzaCguLi5lcnJvcnMpO1xuICAgICAgICBpbmxpbmVSZXN1bHQud2FybmluZ3MucHVzaCguLi53YXJuaW5ncyk7XG5cbiAgICAgICAgLy8gUHJlLXJlbmRlciAoU1NHKSBhbmQgQXBwLXNoZWxsXG4gICAgICAgIGlmIChvcHRpb25zLnByZXJlbmRlck9wdGlvbnMgfHwgb3B0aW9ucy5hcHBTaGVsbE9wdGlvbnMpIHtcbiAgICAgICAgICBjb25zdCB7IG91dHB1dCwgd2FybmluZ3MsIGVycm9ycyB9ID0gYXdhaXQgcHJlcmVuZGVyUGFnZXMoXG4gICAgICAgICAgICBvcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICBvcHRpb25zLmFwcFNoZWxsT3B0aW9ucyxcbiAgICAgICAgICAgIG9wdGlvbnMucHJlcmVuZGVyT3B0aW9ucyxcbiAgICAgICAgICAgIGxvY2FsZU91dHB1dEZpbGVzLFxuICAgICAgICAgICAgY29udGVudFdpdGhvdXRDcml0aWNhbENzc0lubGluZWQsXG4gICAgICAgICAgICBvcHRpb25zLm9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLmlubGluZUNyaXRpY2FsLFxuICAgICAgICAgICAgbWF4V29ya2VycyxcbiAgICAgICAgICAgIG9wdGlvbnMudmVyYm9zZSxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgaW5saW5lUmVzdWx0LmVycm9ycy5wdXNoKC4uLmVycm9ycyk7XG4gICAgICAgICAgaW5saW5lUmVzdWx0Lndhcm5pbmdzLnB1c2goLi4ud2FybmluZ3MpO1xuXG4gICAgICAgICAgZm9yIChjb25zdCBbcGF0aCwgY29udGVudF0gb2YgT2JqZWN0LmVudHJpZXMob3V0cHV0KSkge1xuICAgICAgICAgICAgbG9jYWxlT3V0cHV0RmlsZXMucHVzaChjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQocGF0aCwgY29udGVudCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAob3B0aW9ucy5zZXJ2aWNlV29ya2VyKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3Qgc2VydmljZVdvcmtlclJlc3VsdCA9IGF3YWl0IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlckVzYnVpbGQoXG4gICAgICAgICAgICBvcHRpb25zLndvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICBvcHRpb25zLnNlcnZpY2VXb3JrZXIsXG4gICAgICAgICAgICBiYXNlSHJlZiB8fCAnLycsXG4gICAgICAgICAgICBsb2NhbGVPdXRwdXRGaWxlcyxcbiAgICAgICAgICAgIGV4ZWN1dGlvblJlc3VsdC5hc3NldEZpbGVzLFxuICAgICAgICAgICk7XG4gICAgICAgICAgbG9jYWxlT3V0cHV0RmlsZXMucHVzaChcbiAgICAgICAgICAgIGNyZWF0ZU91dHB1dEZpbGVGcm9tVGV4dCgnbmdzdy5qc29uJywgc2VydmljZVdvcmtlclJlc3VsdC5tYW5pZmVzdCksXG4gICAgICAgICAgKTtcbiAgICAgICAgICBleGVjdXRpb25SZXN1bHQuYXNzZXRGaWxlcy5wdXNoKC4uLnNlcnZpY2VXb3JrZXJSZXN1bHQuYXNzZXRGaWxlcyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgaW5saW5lUmVzdWx0LmVycm9ycy5wdXNoKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogYCR7ZXJyb3J9YCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIGRpcmVjdG9yeSB3aXRoIGxvY2FsZSBiYXNlXG4gICAgICBpZiAob3B0aW9ucy5pMThuT3B0aW9ucy5mbGF0T3V0cHV0ICE9PSB0cnVlKSB7XG4gICAgICAgIGxvY2FsZU91dHB1dEZpbGVzLmZvckVhY2goKGZpbGUpID0+IHtcbiAgICAgICAgICBmaWxlLnBhdGggPSBqb2luKGxvY2FsZSwgZmlsZS5wYXRoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZm9yIChjb25zdCBhc3NldEZpbGUgb2YgZXhlY3V0aW9uUmVzdWx0LmFzc2V0RmlsZXMpIHtcbiAgICAgICAgICB1cGRhdGVkQXNzZXRGaWxlcy5wdXNoKHtcbiAgICAgICAgICAgIHNvdXJjZTogYXNzZXRGaWxlLnNvdXJjZSxcbiAgICAgICAgICAgIGRlc3RpbmF0aW9uOiBqb2luKGxvY2FsZSwgYXNzZXRGaWxlLmRlc3RpbmF0aW9uKSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB1cGRhdGVkT3V0cHV0RmlsZXMucHVzaCguLi5sb2NhbGVPdXRwdXRGaWxlcyk7XG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIGF3YWl0IGlubGluZXIuY2xvc2UoKTtcbiAgfVxuXG4gIC8vIFVwZGF0ZSB0aGUgcmVzdWx0IHdpdGggYWxsIGxvY2FsaXplZCBmaWxlc1xuICBleGVjdXRpb25SZXN1bHQub3V0cHV0RmlsZXMgPSB1cGRhdGVkT3V0cHV0RmlsZXM7XG5cbiAgLy8gQXNzZXRzIGFyZSBvbmx5IGNoYW5nZWQgaWYgbm90IHVzaW5nIHRoZSBmbGF0IG91dHB1dCBvcHRpb25cbiAgaWYgKG9wdGlvbnMuaTE4bk9wdGlvbnMuZmxhdE91dHB1dCAhPT0gdHJ1ZSkge1xuICAgIGV4ZWN1dGlvblJlc3VsdC5hc3NldEZpbGVzID0gdXBkYXRlZEFzc2V0RmlsZXM7XG4gIH1cblxuICByZXR1cm4gaW5saW5lUmVzdWx0O1xufVxuXG5mdW5jdGlvbiBnZXRMb2NhbGVCYXNlSHJlZihcbiAgYmFzZUhyZWY6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgaTE4bjogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zWydpMThuT3B0aW9ucyddLFxuICBsb2NhbGU6IHN0cmluZyxcbik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGlmIChpMThuLmZsYXRPdXRwdXQpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYgKGkxOG4ubG9jYWxlc1tsb2NhbGVdICYmIGkxOG4ubG9jYWxlc1tsb2NhbGVdLmJhc2VIcmVmICE9PSAnJykge1xuICAgIHJldHVybiB1cmxKb2luKGJhc2VIcmVmIHx8ICcnLCBpMThuLmxvY2FsZXNbbG9jYWxlXS5iYXNlSHJlZiA/PyBgLyR7bG9jYWxlfS9gKTtcbiAgfVxuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogTG9hZHMgYWxsIGFjdGl2ZSB0cmFuc2xhdGlvbnMgdXNpbmcgdGhlIHRyYW5zbGF0aW9uIGxvYWRlcnMgZnJvbSB0aGUgYEBhbmd1bGFyL2xvY2FsaXplYCBwYWNrYWdlLlxuICogQHBhcmFtIGNvbnRleHQgVGhlIGFyY2hpdGVjdCBidWlsZGVyIGNvbnRleHQgZm9yIHRoZSBjdXJyZW50IGJ1aWxkLlxuICogQHBhcmFtIGkxOG4gVGhlIG5vcm1hbGl6ZWQgaTE4biBvcHRpb25zIHRvIHVzZS5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWRBY3RpdmVUcmFuc2xhdGlvbnMoXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBpMThuOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnNbJ2kxOG5PcHRpb25zJ10sXG4pIHtcbiAgLy8gTG9hZCBsb2NhbGUgZGF0YSBhbmQgdHJhbnNsYXRpb25zIChpZiBwcmVzZW50KVxuICBsZXQgbG9hZGVyO1xuICBmb3IgKGNvbnN0IFtsb2NhbGUsIGRlc2NdIG9mIE9iamVjdC5lbnRyaWVzKGkxOG4ubG9jYWxlcykpIHtcbiAgICBpZiAoIWkxOG4uaW5saW5lTG9jYWxlcy5oYXMobG9jYWxlKSAmJiBsb2NhbGUgIT09IGkxOG4uc291cmNlTG9jYWxlKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoIWRlc2MuZmlsZXMubGVuZ3RoKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBsb2FkZXIgPz89IGF3YWl0IGNyZWF0ZVRyYW5zbGF0aW9uTG9hZGVyKCk7XG5cbiAgICBsb2FkVHJhbnNsYXRpb25zKFxuICAgICAgbG9jYWxlLFxuICAgICAgZGVzYyxcbiAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgIGxvYWRlcixcbiAgICAgIHtcbiAgICAgICAgd2FybihtZXNzYWdlKSB7XG4gICAgICAgICAgY29udGV4dC5sb2dnZXIud2FybihtZXNzYWdlKTtcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3IobWVzc2FnZSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB1bmRlZmluZWQsXG4gICAgICBpMThuLmR1cGxpY2F0ZVRyYW5zbGF0aW9uQmVoYXZpb3IsXG4gICAgKTtcbiAgfVxufVxuIl19