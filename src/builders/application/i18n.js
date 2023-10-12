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
const environment_options_1 = require("../../utils/environment-options");
const i18n_options_1 = require("../../utils/i18n-options");
const load_translations_1 = require("../../utils/load-translations");
const url_1 = require("../../utils/url");
const execute_post_bundle_1 = require("./execute-post-bundle");
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
            const { errors, warnings, additionalAssets, additionalOutputFiles } = await (0, execute_post_bundle_1.executePostBundleSteps)({
                ...options,
                baseHref,
            }, localeOutputFiles, executionResult.assetFiles, initialFiles, locale);
            localeOutputFiles.push(...additionalOutputFiles);
            inlineResult.errors.push(...errors);
            inlineResult.warnings.push(...warnings);
            // Update directory with locale base
            if (options.i18nOptions.flatOutput !== true) {
                localeOutputFiles.forEach((file) => {
                    file.path = (0, node_path_1.join)(locale, file.path);
                });
                for (const assetFile of [...executionResult.assetFiles, ...additionalAssets]) {
                    updatedAssetFiles.push({
                        source: assetFile.source,
                        destination: (0, node_path_1.join)(locale, assetFile.destination),
                    });
                }
            }
            else {
                executionResult.assetFiles.push(...additionalAssets);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL2kxOG4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBR0gseUNBQWlDO0FBR2pDLG1FQUErRDtBQUMvRCx5RUFBNkQ7QUFDN0QsMkRBQTREO0FBQzVELHFFQUF3RTtBQUN4RSx5Q0FBMEM7QUFDMUMsK0RBQStEO0FBRy9EOzs7Ozs7R0FNRztBQUNJLEtBQUssVUFBVSxVQUFVLENBQzlCLE9BQTBDLEVBQzFDLGVBQWdDLEVBQ2hDLFlBQTRDO0lBRTVDLGdHQUFnRztJQUNoRyxNQUFNLE9BQU8sR0FBRyxJQUFJLDBCQUFXLENBQzdCO1FBQ0Usa0JBQWtCLEVBQUUsT0FBTyxDQUFDLFdBQVcsQ0FBQywwQkFBMEIsSUFBSSxTQUFTO1FBQy9FLFdBQVcsRUFBRSxlQUFlLENBQUMsV0FBVztRQUN4QyxjQUFjLEVBQUUsT0FBTyxDQUFDLG1CQUFtQixDQUFDLE9BQU87S0FDcEQsRUFDRCxnQ0FBVSxDQUNYLENBQUM7SUFFRixNQUFNLFlBQVksR0FBNkM7UUFDN0QsTUFBTSxFQUFFLEVBQUU7UUFDVixRQUFRLEVBQUUsRUFBRTtLQUNiLENBQUM7SUFFRixvRkFBb0Y7SUFDcEYsTUFBTSxrQkFBa0IsR0FBRyxFQUFFLENBQUM7SUFDOUIsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUM7SUFDN0IsSUFBSTtRQUNGLEtBQUssTUFBTSxNQUFNLElBQUksT0FBTyxDQUFDLFdBQVcsQ0FBQyxhQUFhLEVBQUU7WUFDdEQsK0RBQStEO1lBQy9ELE1BQU0saUJBQWlCLEdBQUcsTUFBTSxPQUFPLENBQUMsZUFBZSxDQUNyRCxNQUFNLEVBQ04sT0FBTyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMs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T0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUN6RCxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksTUFBTSxLQUFLLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDbkUsU0FBUztTQUNWO1FBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFO1lBQ3RCLFNBQVM7U0FDVjtRQUVELE1BQU0sS0FBSyxNQUFNLElBQUEsMkNBQXVCLEdBQUUsQ0FBQztRQUUzQyxJQUFBLCtCQUFnQixFQUNkLE1BQU0sRUFDTixJQUFJLEVBQ0osT0FBTyxDQUFDLGFBQWEsRUFDckIsTUFBTSxFQUNOO1lBQ0UsSUFBSSxDQUFDLE9BQU87Z0JBQ1YsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDL0IsQ0FBQztZQUNELEtBQUssQ0FBQyxPQUFPO2dCQUNYLE1BQU0sSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDM0IsQ0FBQztTQUNGLEVBQ0QsU0FBUyxFQUNULElBQUksQ0FBQyw0QkFBNEIsQ0FDbEMsQ0FBQztLQUNIO0FBQ0gsQ0FBQztBQWxDRCx3REFrQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgSW5pdGlhbEZpbGVSZWNvcmQgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgeyBFeGVjdXRpb25SZXN1bHQgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2J1bmRsZXItZXhlY3V0aW9uLXJlc3VsdCc7XG5pbXBvcnQgeyBJMThuSW5saW5lciB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvaTE4bi1pbmxpbmVyJztcbmltcG9ydCB7IG1heFdvcmtlcnMgfSBmcm9tICcuLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IGxvYWRUcmFuc2xhdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9pMThuLW9wdGlvbnMnO1xuaW1wb3J0IHsgY3JlYXRlVHJhbnNsYXRpb25Mb2FkZXIgfSBmcm9tICcuLi8uLi91dGlscy9sb2FkLXRyYW5zbGF0aW9ucyc7XG5pbXBvcnQgeyB1cmxKb2luIH0gZnJvbSAnLi4vLi4vdXRpbHMvdXJsJztcbmltcG9ydCB7IGV4ZWN1dGVQb3N0QnVuZGxlU3RlcHMgfSBmcm9tICcuL2V4ZWN1dGUtcG9zdC1idW5kbGUnO1xuaW1wb3J0IHsgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcblxuLyoqXG4gKiBJbmxpbmVzIGFsbCBhY3RpdmUgbG9jYWxlcyBhcyBzcGVjaWZpZWQgYnkgdGhlIGFwcGxpY2F0aW9uIGJ1aWxkIG9wdGlvbnMgaW50byBhbGxcbiAqIGFwcGxpY2F0aW9uIEphdmFTY3JpcHQgZmlsZXMgY3JlYXRlZCBkdXJpbmcgdGhlIGJ1aWxkLlxuICogQHBhcmFtIG9wdGlvbnMgVGhlIG5vcm1hbGl6ZWQgYXBwbGljYXRpb24gYnVpbGRlciBvcHRpb25zIHVzZWQgdG8gY3JlYXRlIHRoZSBidWlsZC5cbiAqIEBwYXJhbSBleGVjdXRpb25SZXN1bHQgVGhlIHJlc3VsdCBvZiBhbiBleGVjdXRlZCBidWlsZC5cbiAqIEBwYXJhbSBpbml0aWFsRmlsZXMgQSBtYXAgY29udGFpbmluZyBpbml0aWFsIGZpbGUgaW5mb3JtYXRpb24gZm9yIHRoZSBleGVjdXRlZCBidWlsZC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGlubGluZUkxOG4oXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyxcbiAgZXhlY3V0aW9uUmVzdWx0OiBFeGVjdXRpb25SZXN1bHQsXG4gIGluaXRpYWxGaWxlczogTWFwPHN0cmluZywgSW5pdGlhbEZpbGVSZWNvcmQ+LFxuKTogUHJvbWlzZTx7IGVycm9yczogc3RyaW5nW107IHdhcm5pbmdzOiBzdHJpbmdbXSB9PiB7XG4gIC8vIENyZWF0ZSB0aGUgbXVsdGktdGhyZWFkZWQgaW5saW5lciB3aXRoIGNvbW1vbiBvcHRpb25zIGFuZCB0aGUgZmlsZXMgZ2VuZXJhdGVkIGZyb20gdGhlIGJ1aWxkLlxuICBjb25zdCBpbmxpbmVyID0gbmV3IEkxOG5JbmxpbmVyKFxuICAgIHtcbiAgICAgIG1pc3NpbmdUcmFuc2xhdGlvbjogb3B0aW9ucy5pMThuT3B0aW9ucy5taXNzaW5nVHJhbnNsYXRpb25CZWhhdmlvciA/PyAnd2FybmluZycsXG4gICAgICBvdXRwdXRGaWxlczogZXhlY3V0aW9uUmVzdWx0Lm91dHB1dEZpbGVzLFxuICAgICAgc2hvdWxkT3B0aW1pemU6IG9wdGlvbnMub3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzLFxuICAgIH0sXG4gICAgbWF4V29ya2VycyxcbiAgKTtcblxuICBjb25zdCBpbmxpbmVSZXN1bHQ6IHsgZXJyb3JzOiBzdHJpbmdbXTsgd2FybmluZ3M6IHN0cmluZ1tdIH0gPSB7XG4gICAgZXJyb3JzOiBbXSxcbiAgICB3YXJuaW5nczogW10sXG4gIH07XG5cbiAgLy8gRm9yIGVhY2ggYWN0aXZlIGxvY2FsZSwgdXNlIHRoZSBpbmxpbmVyIHRvIHByb2Nlc3MgdGhlIG91dHB1dCBmaWxlcyBvZiB0aGUgYnVpbGQuXG4gIGNvbnN0IHVwZGF0ZWRPdXRwdXRGaWxlcyA9IFtdO1xuICBjb25zdCB1cGRhdGVkQXNzZXRGaWxlcyA9IFtdO1xuICB0cnkge1xuICAgIGZvciAoY29uc3QgbG9jYWxlIG9mIG9wdGlvbnMuaTE4bk9wdGlvbnMuaW5saW5lTG9jYWxlcykge1xuICAgICAgLy8gQSBsb2NhbGUgc3BlY2lmaWMgc2V0IG9mIGZpbGVzIGlzIHJldHVybmVkIGZyb20gdGhlIGlubGluZXIuXG4gICAgICBjb25zdCBsb2NhbGVPdXRwdXRGaWxlcyA9IGF3YWl0IGlubGluZXIuaW5saW5lRm9yTG9jYWxlKFxuICAgICAgICBsb2NhbGUsXG4gICAgICAgIG9wdGlvbnMuaTE4bk9wdGlvbnMubG9jYWxlc1tsb2NhbGVdLnRyYW5zbGF0aW9uLFxuICAgICAgKTtcblxuICAgICAgY29uc3QgYmFzZUhyZWYgPVxuICAgICAgICBnZXRMb2NhbGVCYXNlSHJlZihvcHRpb25zLmJhc2VIcmVmLCBvcHRpb25zLmkxOG5PcHRpb25zLCBsb2NhbGUpID8/IG9wdGlvbnMuYmFzZUhyZWY7XG5cbiAgICAgIGNvbnN0IHsgZXJyb3JzLCB3YXJuaW5ncywgYWRkaXRpb25hbEFzc2V0cywgYWRkaXRpb25hbE91dHB1dEZpbGVzIH0gPVxuICAgICAgICBhd2FpdCBleGVjdXRlUG9zdEJ1bmRsZVN0ZXBzKFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBiYXNlSHJlZixcbiAgICAgICAgICB9LFxuICAgICAgICAgIGxvY2FsZU91dHB1dEZpbGVzLFxuICAgICAgICAgIGV4ZWN1dGlvblJlc3VsdC5hc3NldEZpbGVzLFxuICAgICAgICAgIGluaXRpYWxGaWxlcyxcbiAgICAgICAgICBsb2NhbGUsXG4gICAgICAgICk7XG5cbiAgICAgIGxvY2FsZU91dHB1dEZpbGVzLnB1c2goLi4uYWRkaXRpb25hbE91dHB1dEZpbGVzKTtcbiAgICAgIGlubGluZVJlc3VsdC5lcnJvcnMucHVzaCguLi5lcnJvcnMpO1xuICAgICAgaW5saW5lUmVzdWx0Lndhcm5pbmdzLnB1c2goLi4ud2FybmluZ3MpO1xuXG4gICAgICAvLyBVcGRhdGUgZGlyZWN0b3J5IHdpdGggbG9jYWxlIGJhc2VcbiAgICAgIGlmIChvcHRpb25zLmkxOG5PcHRpb25zLmZsYXRPdXRwdXQgIT09IHRydWUpIHtcbiAgICAgICAgbG9jYWxlT3V0cHV0RmlsZXMuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgICAgIGZpbGUucGF0aCA9IGpvaW4obG9jYWxlLCBmaWxlLnBhdGgpO1xuICAgICAgICB9KTtcblxuICAgICAgICBmb3IgKGNvbnN0IGFzc2V0RmlsZSBvZiBbLi4uZXhlY3V0aW9uUmVzdWx0LmFzc2V0RmlsZXMsIC4uLmFkZGl0aW9uYWxBc3NldHNdKSB7XG4gICAgICAgICAgdXBkYXRlZEFzc2V0RmlsZXMucHVzaCh7XG4gICAgICAgICAgICBzb3VyY2U6IGFzc2V0RmlsZS5zb3VyY2UsXG4gICAgICAgICAgICBkZXN0aW5hdGlvbjogam9pbihsb2NhbGUsIGFzc2V0RmlsZS5kZXN0aW5hdGlvbiksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGV4ZWN1dGlvblJlc3VsdC5hc3NldEZpbGVzLnB1c2goLi4uYWRkaXRpb25hbEFzc2V0cyk7XG4gICAgICB9XG5cbiAgICAgIHVwZGF0ZWRPdXRwdXRGaWxlcy5wdXNoKC4uLmxvY2FsZU91dHB1dEZpbGVzKTtcbiAgICB9XG4gIH0gZmluYWxseSB7XG4gICAgYXdhaXQgaW5saW5lci5jbG9zZSgpO1xuICB9XG5cbiAgLy8gVXBkYXRlIHRoZSByZXN1bHQgd2l0aCBhbGwgbG9jYWxpemVkIGZpbGVzXG4gIGV4ZWN1dGlvblJlc3VsdC5vdXRwdXRGaWxlcyA9IHVwZGF0ZWRPdXRwdXRGaWxlcztcblxuICAvLyBBc3NldHMgYXJlIG9ubHkgY2hhbmdlZCBpZiBub3QgdXNpbmcgdGhlIGZsYXQgb3V0cHV0IG9wdGlvblxuICBpZiAob3B0aW9ucy5pMThuT3B0aW9ucy5mbGF0T3V0cHV0ICE9PSB0cnVlKSB7XG4gICAgZXhlY3V0aW9uUmVzdWx0LmFzc2V0RmlsZXMgPSB1cGRhdGVkQXNzZXRGaWxlcztcbiAgfVxuXG4gIHJldHVybiBpbmxpbmVSZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGdldExvY2FsZUJhc2VIcmVmKFxuICBiYXNlSHJlZjogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICBpMThuOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnNbJ2kxOG5PcHRpb25zJ10sXG4gIGxvY2FsZTogc3RyaW5nLFxuKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKGkxOG4uZmxhdE91dHB1dCkge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICBpZiAoaTE4bi5sb2NhbGVzW2xvY2FsZV0gJiYgaTE4bi5sb2NhbGVzW2xvY2FsZV0uYmFzZUhyZWYgIT09ICcnKSB7XG4gICAgcmV0dXJuIHVybEpvaW4oYmFzZUhyZWYgfHwgJycsIGkxOG4ubG9jYWxlc1tsb2NhbGVdLmJhc2VIcmVmID8/IGAvJHtsb2NhbGV9L2ApO1xuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBMb2FkcyBhbGwgYWN0aXZlIHRyYW5zbGF0aW9ucyB1c2luZyB0aGUgdHJhbnNsYXRpb24gbG9hZGVycyBmcm9tIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemVgIHBhY2thZ2UuXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgYXJjaGl0ZWN0IGJ1aWxkZXIgY29udGV4dCBmb3IgdGhlIGN1cnJlbnQgYnVpbGQuXG4gKiBAcGFyYW0gaTE4biBUaGUgbm9ybWFsaXplZCBpMThuIG9wdGlvbnMgdG8gdXNlLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9hZEFjdGl2ZVRyYW5zbGF0aW9ucyhcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIGkxOG46IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9uc1snaTE4bk9wdGlvbnMnXSxcbikge1xuICAvLyBMb2FkIGxvY2FsZSBkYXRhIGFuZCB0cmFuc2xhdGlvbnMgKGlmIHByZXNlbnQpXG4gIGxldCBsb2FkZXI7XG4gIGZvciAoY29uc3QgW2xvY2FsZSwgZGVzY10gb2YgT2JqZWN0LmVudHJpZXMoaTE4bi5sb2NhbGVzKSkge1xuICAgIGlmICghaTE4bi5pbmxpbmVMb2NhbGVzLmhhcyhsb2NhbGUpICYmIGxvY2FsZSAhPT0gaTE4bi5zb3VyY2VMb2NhbGUpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmICghZGVzYy5maWxlcy5sZW5ndGgpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGxvYWRlciA/Pz0gYXdhaXQgY3JlYXRlVHJhbnNsYXRpb25Mb2FkZXIoKTtcblxuICAgIGxvYWRUcmFuc2xhdGlvbnMoXG4gICAgICBsb2NhbGUsXG4gICAgICBkZXNjLFxuICAgICAgY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgbG9hZGVyLFxuICAgICAge1xuICAgICAgICB3YXJuKG1lc3NhZ2UpIHtcbiAgICAgICAgICBjb250ZXh0LmxvZ2dlci53YXJuKG1lc3NhZ2UpO1xuICAgICAgICB9LFxuICAgICAgICBlcnJvcihtZXNzYWdlKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHVuZGVmaW5lZCxcbiAgICAgIGkxOG4uZHVwbGljYXRlVHJhbnNsYXRpb25CZWhhdmlvcixcbiAgICApO1xuICB9XG59XG4iXX0=