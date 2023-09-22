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
    // For each active locale, use the inliner to process the output files of the build.
    const updatedOutputFiles = [];
    const updatedAssetFiles = [];
    try {
        for (const locale of options.i18nOptions.inlineLocales) {
            // A locale specific set of files is returned from the inliner.
            const localeOutputFiles = await inliner.inlineForLocale(locale, options.i18nOptions.locales[locale].translation);
            // Generate locale specific index HTML files
            if (options.indexHtmlOptions) {
                const { content, errors, warnings } = await (0, index_html_generator_1.generateIndexHtml)(initialFiles, localeOutputFiles, {
                    ...options,
                    baseHref: getLocaleBaseHref(options.baseHref, options.i18nOptions, locale) ?? options.baseHref,
                }, locale);
                localeOutputFiles.push((0, utils_1.createOutputFileFromText)(options.indexHtmlOptions.output, content));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL2kxOG4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBR0gseUNBQWlDO0FBR2pDLG1FQUErRDtBQUMvRCxtRkFBNkU7QUFDN0UscURBQXFFO0FBQ3JFLHlFQUE2RDtBQUM3RCwyREFBNEQ7QUFDNUQscUVBQXdFO0FBQ3hFLHlDQUEwQztBQUcxQzs7Ozs7O0dBTUc7QUFDSSxLQUFLLFVBQVUsVUFBVSxDQUM5QixPQUEwQyxFQUMxQyxlQUFnQyxFQUNoQyxZQUE0QztJQUU1QyxnR0FBZ0c7SUFDaEcsTUFBTSxPQUFPLEdBQUcsSUFBSSwwQkFBVyxDQUM3QjtRQUNFLGtCQUFrQixFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQUMsMEJBQTBCLElBQUksU0FBUztRQUMvRSxXQUFXLEVBQUUsZUFBZSxDQUFDLFdBQVc7UUFDeEMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPO0tBQ3BELEVBQ0QsZ0NBQVUsQ0FDWCxDQUFDO0lBRUYsb0ZBQW9GO0lBQ3BGLE1BQU0sa0JBQWtCLEdBQUcsRUFBRSxDQUFDO0lBQzlCLE1BQU0saUJBQWlCLEdBQUcsRUFBRSxDQUFDO0lBQzdCLElBQUk7UUFDRixLQUFLLE1BQU0sTUFBTSxJQUFJLE9BQU8sQ0FBQyxXQUFXLENBQUMsYUFBYSxFQUFFO1lBQ3RELCtEQUErRDtZQUMvRCxNQUFNLGlCQUFpQixHQUFHLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FDckQsTUFBTSxFQUNOLE9BQU8sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFdBQVcsQ0FDaEQsQ0FBQztZQUVGLDRDQUE0QztZQUM1QyxJQUFJLE9BQU8sQ0FBQyxnQkFBZ0IsRUFB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QyxJQUFBLCtCQUFnQixFQUNkLE1BQU0sRUFDTixJQUFJLEVBQ0osT0FBTyxDQUFDLGFBQWEsRUFDckIsTUFBTSxFQUNOO1lBQ0UsSUFBSSxDQUFDLE9BQU87Z0JBQ1YsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDL0IsQ0FBQztZQUNELEtBQUssQ0FBQyxPQUFPO2dCQUNYLE1BQU0sSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDM0IsQ0FBQztTQUNGLEVBQ0QsU0FBUyxFQUNULElBQUksQ0FBQyw0QkFBNEIsQ0FDbEMsQ0FBQztLQUNIO0FBQ0gsQ0FBQztBQWxDRCx3REFrQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgSW5pdGlhbEZpbGVSZWNvcmQgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgeyBFeGVjdXRpb25SZXN1bHQgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2J1bmRsZXItZXhlY3V0aW9uLXJlc3VsdCc7XG5pbXBvcnQgeyBJMThuSW5saW5lciB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvaTE4bi1pbmxpbmVyJztcbmltcG9ydCB7IGdlbmVyYXRlSW5kZXhIdG1sIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL3V0aWxzJztcbmltcG9ydCB7IG1heFdvcmtlcnMgfSBmcm9tICcuLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IGxvYWRUcmFuc2xhdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgY3JlYXRlVHJhbnNsYXRpb25Mb2FkZXIgfSBmcm9tICcuLi8uLi91dGlscy9sb2FkLXRyYW5zbGF0aW9ucyc7XG5pbXBvcnQgeyB1cmxKb2luIH0gZnJvbSAnLi4vLi4vdXRpbHMvdXJsJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5cbi8qKlxuICogSW5saW5lcyBhbGwgYWN0aXZlIGxvY2FsZXMgYXMgc3BlY2lmaWVkIGJ5IHRoZSBhcHBsaWNhdGlvbiBidWlsZCBvcHRpb25zIGludG8gYWxsXG4gKiBhcHBsaWNhdGlvbiBKYXZhU2NyaXB0IGZpbGVzIGNyZWF0ZWQgZHVyaW5nIHRoZSBidWlsZC5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBub3JtYWxpemVkIGFwcGxpY2F0aW9uIGJ1aWxkZXIgb3B0aW9ucyB1c2VkIHRvIGNyZWF0ZSB0aGUgYnVpbGQuXG4gKiBAcGFyYW0gZXhlY3V0aW9uUmVzdWx0IFRoZSByZXN1bHQgb2YgYW4gZXhlY3V0ZWQgYnVpbGQuXG4gKiBAcGFyYW0gaW5pdGlhbEZpbGVzIEEgbWFwIGNvbnRhaW5pbmcgaW5pdGlhbCBmaWxlIGluZm9ybWF0aW9uIGZvciB0aGUgZXhlY3V0ZWQgYnVpbGQuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpbmxpbmVJMThuKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4gIGV4ZWN1dGlvblJlc3VsdDogRXhlY3V0aW9uUmVzdWx0LFxuICBpbml0aWFsRmlsZXM6IE1hcDxzdHJpbmcsIEluaXRpYWxGaWxlUmVjb3JkPixcbik6IFByb21pc2U8dm9pZD4ge1xuICAvLyBDcmVhdGUgdGhlIG11bHRpLXRocmVhZGVkIGlubGluZXIgd2l0aCBjb21tb24gb3B0aW9ucyBhbmQgdGhlIGZpbGVzIGdlbmVyYXRlZCBmcm9tIHRoZSBidWlsZC5cbiAgY29uc3QgaW5saW5lciA9IG5ldyBJMThuSW5saW5lcihcbiAgICB7XG4gICAgICBtaXNzaW5nVHJhbnNsYXRpb246IG9wdGlvbnMuaTE4bk9wdGlvbnMubWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IgPz8gJ3dhcm5pbmcnLFxuICAgICAgb3V0cHV0RmlsZXM6IGV4ZWN1dGlvblJlc3VsdC5vdXRwdXRGaWxlcyxcbiAgICAgIHNob3VsZE9wdGltaXplOiBvcHRpb25zLm9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICB9LFxuICAgIG1heFdvcmtlcnMsXG4gICk7XG5cbiAgLy8gRm9yIGVhY2ggYWN0aXZlIGxvY2FsZSwgdXNlIHRoZSBpbmxpbmVyIHRvIHByb2Nlc3MgdGhlIG91dHB1dCBmaWxlcyBvZiB0aGUgYnVpbGQuXG4gIGNvbnN0IHVwZGF0ZWRPdXRwdXRGaWxlcyA9IFtdO1xuICBjb25zdCB1cGRhdGVkQXNzZXRGaWxlcyA9IFtdO1xuICB0cnkge1xuICAgIGZvciAoY29uc3QgbG9jYWxlIG9mIG9wdGlvbnMuaTE4bk9wdGlvbnMuaW5saW5lTG9jYWxlcykge1xuICAgICAgLy8gQSBsb2NhbGUgc3BlY2lmaWMgc2V0IG9mIGZpbGVzIGlzIHJldHVybmVkIGZyb20gdGhlIGlubGluZXIuXG4gICAgICBjb25zdCBsb2NhbGVPdXRwdXRGaWxlcyA9IGF3YWl0IGlubGluZXIuaW5saW5lRm9yTG9jYWxlKFxuICAgICAgICBsb2NhbGUsXG4gICAgICAgIG9wdGlvbnMuaTE4bk9wdGlvbnMubG9jYWxlc1tsb2NhbGVdLnRyYW5zbGF0aW9uLFxuICAgICAgKTtcblxuICAgICAgLy8gR2VuZXJhdGUgbG9jYWxlIHNwZWNpZmljIGluZGV4IEhUTUwgZmlsZXNcbiAgICAgIGlmIChvcHRpb25zLmluZGV4SHRtbE9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgeyBjb250ZW50LCBlcnJvcnMsIHdhcm5pbmdzIH0gPSBhd2FpdCBnZW5lcmF0ZUluZGV4SHRtbChcbiAgICAgICAgICBpbml0aWFsRmlsZXMsXG4gICAgICAgICAgbG9jYWxlT3V0cHV0RmlsZXMsXG4gICAgICAgICAge1xuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgIGJhc2VIcmVmOlxuICAgICAgICAgICAgICBnZXRMb2NhbGVCYXNlSHJlZihvcHRpb25zLmJhc2VIcmVmLCBvcHRpb25zLmkxOG5PcHRpb25zLCBsb2NhbGUpID8/IG9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBsb2NhbGUsXG4gICAgICAgICk7XG5cbiAgICAgICAgbG9jYWxlT3V0cHV0RmlsZXMucHVzaChjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQob3B0aW9ucy5pbmRleEh0bWxPcHRpb25zLm91dHB1dCwgY29udGVudCkpO1xuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgZGlyZWN0b3J5IHdpdGggbG9jYWxlIGJhc2VcbiAgICAgIGlmIChvcHRpb25zLmkxOG5PcHRpb25zLmZsYXRPdXRwdXQgIT09IHRydWUpIHtcbiAgICAgICAgbG9jYWxlT3V0cHV0RmlsZXMuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgICAgIGZpbGUucGF0aCA9IGpvaW4obG9jYWxlLCBmaWxlLnBhdGgpO1xuICAgICAgICB9KTtcblxuICAgICAgICBmb3IgKGNvbnN0IGFzc2V0RmlsZSBvZiBleGVjdXRpb25SZXN1bHQuYXNzZXRGaWxlcykge1xuICAgICAgICAgIHVwZGF0ZWRBc3NldEZpbGVzLnB1c2goe1xuICAgICAgICAgICAgc291cmNlOiBhc3NldEZpbGUuc291cmNlLFxuICAgICAgICAgICAgZGVzdGluYXRpb246IGpvaW4obG9jYWxlLCBhc3NldEZpbGUuZGVzdGluYXRpb24pLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHVwZGF0ZWRPdXRwdXRGaWxlcy5wdXNoKC4uLmxvY2FsZU91dHB1dEZpbGVzKTtcbiAgICB9XG4gIH0gZmluYWxseSB7XG4gICAgYXdhaXQgaW5saW5lci5jbG9zZSgpO1xuICB9XG5cbiAgLy8gVXBkYXRlIHRoZSByZXN1bHQgd2l0aCBhbGwgbG9jYWxpemVkIGZpbGVzXG4gIGV4ZWN1dGlvblJlc3VsdC5vdXRwdXRGaWxlcyA9IHVwZGF0ZWRPdXRwdXRGaWxlcztcblxuICAvLyBBc3NldHMgYXJlIG9ubHkgY2hhbmdlZCBpZiBub3QgdXNpbmcgdGhlIGZsYXQgb3V0cHV0IG9wdGlvblxuICBpZiAob3B0aW9ucy5pMThuT3B0aW9ucy5mbGF0T3V0cHV0ICE9PSB0cnVlKSB7XG4gICAgZXhlY3V0aW9uUmVzdWx0LmFzc2V0RmlsZXMgPSB1cGRhdGVkQXNzZXRGaWxlcztcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRMb2NhbGVCYXNlSHJlZihcbiAgYmFzZUhyZWY6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgaTE4bjogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zWydpMThuT3B0aW9ucyddLFxuICBsb2NhbGU6IHN0cmluZyxcbik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGlmIChpMThuLmZsYXRPdXRwdXQpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYgKGkxOG4ubG9jYWxlc1tsb2NhbGVdICYmIGkxOG4ubG9jYWxlc1tsb2NhbGVdLmJhc2VIcmVmICE9PSAnJykge1xuICAgIHJldHVybiB1cmxKb2luKGJhc2VIcmVmIHx8ICcnLCBpMThuLmxvY2FsZXNbbG9jYWxlXS5iYXNlSHJlZiA/PyBgLyR7bG9jYWxlfS9gKTtcbiAgfVxuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogTG9hZHMgYWxsIGFjdGl2ZSB0cmFuc2xhdGlvbnMgdXNpbmcgdGhlIHRyYW5zbGF0aW9uIGxvYWRlcnMgZnJvbSB0aGUgYEBhbmd1bGFyL2xvY2FsaXplYCBwYWNrYWdlLlxuICogQHBhcmFtIGNvbnRleHQgVGhlIGFyY2hpdGVjdCBidWlsZGVyIGNvbnRleHQgZm9yIHRoZSBjdXJyZW50IGJ1aWxkLlxuICogQHBhcmFtIGkxOG4gVGhlIG5vcm1hbGl6ZWQgaTE4biBvcHRpb25zIHRvIHVzZS5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWRBY3RpdmVUcmFuc2xhdGlvbnMoXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICBpMThuOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnNbJ2kxOG5PcHRpb25zJ10sXG4pIHtcbiAgLy8gTG9hZCBsb2NhbGUgZGF0YSBhbmQgdHJhbnNsYXRpb25zIChpZiBwcmVzZW50KVxuICBsZXQgbG9hZGVyO1xuICBmb3IgKGNvbnN0IFtsb2NhbGUsIGRlc2NdIG9mIE9iamVjdC5lbnRyaWVzKGkxOG4ubG9jYWxlcykpIHtcbiAgICBpZiAoIWkxOG4uaW5saW5lTG9jYWxlcy5oYXMobG9jYWxlKSAmJiBsb2NhbGUgIT09IGkxOG4uc291cmNlTG9jYWxlKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoIWRlc2MuZmlsZXMubGVuZ3RoKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBsb2FkZXIgPz89IGF3YWl0IGNyZWF0ZVRyYW5zbGF0aW9uTG9hZGVyKCk7XG5cbiAgICBsb2FkVHJhbnNsYXRpb25zKFxuICAgICAgbG9jYWxlLFxuICAgICAgZGVzYyxcbiAgICAgIGNvbnRleHQud29ya3NwYWNlUm9vdCxcbiAgICAgIGxvYWRlcixcbiAgICAgIHtcbiAgICAgICAgd2FybihtZXNzYWdlKSB7XG4gICAgICAgICAgY29udGV4dC5sb2dnZXIud2FybihtZXNzYWdlKTtcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3IobWVzc2FnZSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB1bmRlZmluZWQsXG4gICAgICBpMThuLmR1cGxpY2F0ZVRyYW5zbGF0aW9uQmVoYXZpb3IsXG4gICAgKTtcbiAgfVxufVxuIl19