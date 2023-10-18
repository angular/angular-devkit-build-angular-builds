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
        prerenderedRoutes: [],
    };
    // For each active locale, use the inliner to process the output files of the build.
    const updatedOutputFiles = [];
    const updatedAssetFiles = [];
    try {
        for (const locale of options.i18nOptions.inlineLocales) {
            // A locale specific set of files is returned from the inliner.
            const localeOutputFiles = await inliner.inlineForLocale(locale, options.i18nOptions.locales[locale].translation);
            const baseHref = getLocaleBaseHref(options.baseHref, options.i18nOptions, locale) ?? options.baseHref;
            const { errors, warnings, additionalAssets, additionalOutputFiles, prerenderedRoutes: generatedRoutes, } = await (0, execute_post_bundle_1.executePostBundleSteps)({
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
                inlineResult.prerenderedRoutes.push(...generatedRoutes.map((route) => node_path_1.posix.join('/', locale, route)));
            }
            else {
                inlineResult.prerenderedRoutes.push(...generatedRoutes);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL2kxOG4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBR0gseUNBQXdDO0FBR3hDLG1FQUErRDtBQUMvRCx5RUFBNkQ7QUFDN0QsMkRBQTREO0FBQzVELHFFQUF3RTtBQUN4RSx5Q0FBMEM7QUFDMUMsK0RBQStEO0FBRy9EOzs7Ozs7R0FNRztBQUNJLEtBQUssVUFBVSxVQUFVLENBQzlCLE9BQTBDLEVBQzFDLGVBQWdDLEVBQ2hDLFlBQTRDO0lBRTVDLGdHQUFnRztJQUNoRyxNQUFNLE9BQU8sR0FBRyxJQUFJLDBCQUFXLENBQzdCO1FBQ0Usa0JBQWtCLEVBQUUsT0FBTyxDQUFDLFdBQVcsQ0FBQywwQkFBMEIsSUFBSSxTQUFTO1FBQy9FLFdBQVcsRUFBRSxlQUFlLENBQUMsV0FBVztRQUN4QyxjQUFjLEVBQUUsT0FBTyxDQUFDLG1CQUFtQixDQUFDLE9BQU87S0FDcEQsRUFDRCxnQ0FBVSxDQUNYLENBQUM7SUFFRixNQUFNLFlBQVksR0FBMEU7UUFDMUYsTUFBTSxFQUFFLEVBQUU7UUFDVixRQUFRLEVBQUUsRUFBRTtRQUNaLGlCQUFpQixFQUFFLEVBQUU7S0FDdEIsQ0FBQztJQUVGLG9GQUFvRjtJQUNwRixNQUFNLGtCQUFrQixHQUFHLEVBQUUsQ0FBQztJQUM5QixNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztJQUM3QixJQUFJO1FBQ0YsS0FBSyxNQUFNLE1BQU0sSUFBSSxPQUFPLENBQUMsV0FBVyxDQUFDLGFBQWEsRUFBRTtZQUN0RCwrREFBK0Q7WUFDL0QsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQ3JELE1BQU0sRUFDTixPQUFPLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLENBQ2hELENBQUM7WUFFRixNQUFNLFFBQVEsR0FDWixpQkFBaUIsQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQztZQUV2RixNQUFNLEVBQ0osTUFBTSxFQUNOLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIscUJBQXFCLEVBQ3JCLGlCQUFpQixFQUFFLGVBQWUsR0FDbkMsR0FBRyxNQUFNLElBQUEsNENBQXNCLEVBQzlCO2dCQUNFLEdBQUcsT0FBTztnQkFDVixRQUFRO2FBQ1QsRUFDRCxpQkFBaUIsRUFDakIsZUFBZSxDQUFDLFVBQVUsRUFDMUIsWUFBWSxFQUNaLE1BQU0sQ0FDUCxDQUFDO1lBRUYsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEdBQUcscUJBQXFCLENBQUMsQ0FBQztZQUNqRCxZQUFZLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDO1lBQ3BDLFlBQVksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUM7WUFFeEMsb0NBQW9DO1lBQ3BDLElBQUksT0FBTyxDQUFDLFdBQVcsQ0FBQyxVQUFVLEtBQUssSUFBSSxFQUFFO2dCQUMzQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtvQkFDakMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFBLGdCQUFJLEVBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDdEMsQ0FBQyxDQUFDLENBQUM7Z0JBRUgsS0FBSyxNQUFNLFNBQVMsSUFBSSxDQUFDLEdBQUcsZUFBZSxDQUFDLFVBQVUsRUFBRSxHQUFHLGdCQUFnQixDQUFDLEVBQUU7b0JBQzVFLGlCQUFpQixDQUFDLElBQUksQ0FBQzt3QkFDckIsTUFBTSxFQUFFLFNBQVMsQ0FBQyxNQUFNO3dCQUN4QixXQUFXLEVBQUUsSUFBQSxnQkFBSSxFQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsV0FBVyxDQUFDO3FCQUNqRCxDQUFDLENBQUM7aUJBQ0o7Z0JBRUQsWUFBWSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FDakMsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxpQkFBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQ2xFLENBQUM7YUFDSDtpQkFBTTtnQkFDTCxZQUFZLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEdBQUcsZUFBZSxDQUFDLENBQUM7Z0JBQ3hELGVBQWUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsZ0JBQWdCLENBQUMsQ0FBQzthQUN0RDtZQUVELGtCQUFrQixDQUFDLElBQUksQ0FBQyxHQUFHLGlCQUFpQixDQUFDLENBQUM7U0FDL0M7S0FDRjtZQUFTO1FBQ1IsTUFBTSxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7S0FDdkI7SUFFRCw2Q0FBNkM7SUFDN0MsZUFBZSxDQUFDLFdBQVcsR0FBRyxrQkFBa0IsQ0FBQztJQUVqRCw4REFBOEQ7SUFDOUQsSUFBSSxPQUFPLENBQUMsV0FBVyxDQUFDLFVBQVUsS0FBSyxJQUFJLEVBQUU7UUFDM0MsZUFBZSxDQUFDLFVBQVUsR0FBRyxpQkFBaUIsQ0FBQztLQUNoRDtJQUVELE9BQU8sWUFBWSxDQUFDO0FBQ3RCLENBQUM7QUE1RkQsZ0NBNEZDO0FBRUQsU0FBUyxpQkFBaUIsQ0FDeEIsUUFBNEIsRUFDNUIsSUFBc0QsRUFDdEQsTUFBYztJQUVkLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtRQUNuQixPQUFPLFNBQVMsQ0FBQztLQUNsQjtJQUVELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsS0FBSyxFQUFFLEVBQUU7UUFDaEUsT0FBTyxJQUFBLGFBQU8sRUFBQyxRQUFRLElBQUksRUFBRSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxJQUFJLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztLQUNoRjtJQUVELE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUM7QUFFRDs7OztHQUlHO0FBQ0ksS0FBSyxVQUFVLHNCQUFzQixDQUMxQyxPQUF1QixFQUN2QixJQUFzRDtJQUV0RCxpREFBaUQ7SUFDakQsSUFBSSxNQUFNLENBQUM7SUFDWCxLQUFLLE1BQU0sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDekQsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLE1BQU0sS0FBSyxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ25FLFNBQVM7U0FDVjtRQUVELElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRTtZQUN0QixTQUFTO1NBQ1Y7UUFFRCxNQUFNLEtBQUssTUFBTSxJQUFBLDJDQUF1QixHQUFFLENBQUM7UUFFM0MsSUFBQSwrQkFBZ0IsRUFDZCxNQUFNLEVBQ04sSUFBSSxFQUNKLE9BQU8sQ0FBQyxhQUFhLEVBQ3JCLE1BQU0sRUFDTjtZQUNFLElBQUksQ0FBQyxPQUFPO2dCQUNWLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQy9CLENBQUM7WUFDRCxLQUFLLENBQUMsT0FBTztnQkFDWCxNQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzNCLENBQUM7U0FDRixFQUNELFNBQVMsRUFDVCxJQUFJLENBQUMsNEJBQTRCLENBQ2xDLENBQUM7S0FDSDtBQUNILENBQUM7QUFsQ0Qsd0RBa0NDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBqb2luLCBwb3NpeCB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBJbml0aWFsRmlsZVJlY29yZCB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvYnVuZGxlci1jb250ZXh0JztcbmltcG9ydCB7IEV4ZWN1dGlvblJlc3VsdCB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvYnVuZGxlci1leGVjdXRpb24tcmVzdWx0JztcbmltcG9ydCB7IEkxOG5JbmxpbmVyIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9pMThuLWlubGluZXInO1xuaW1wb3J0IHsgbWF4V29ya2VycyB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuaW1wb3J0IHsgbG9hZFRyYW5zbGF0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL2kxOG4tb3B0aW9ucyc7XG5pbXBvcnQgeyBjcmVhdGVUcmFuc2xhdGlvbkxvYWRlciB9IGZyb20gJy4uLy4uL3V0aWxzL2xvYWQtdHJhbnNsYXRpb25zJztcbmltcG9ydCB7IHVybEpvaW4gfSBmcm9tICcuLi8uLi91dGlscy91cmwnO1xuaW1wb3J0IHsgZXhlY3V0ZVBvc3RCdW5kbGVTdGVwcyB9IGZyb20gJy4vZXhlY3V0ZS1wb3N0LWJ1bmRsZSc7XG5pbXBvcnQgeyBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnO1xuXG4vKipcbiAqIElubGluZXMgYWxsIGFjdGl2ZSBsb2NhbGVzIGFzIHNwZWNpZmllZCBieSB0aGUgYXBwbGljYXRpb24gYnVpbGQgb3B0aW9ucyBpbnRvIGFsbFxuICogYXBwbGljYXRpb24gSmF2YVNjcmlwdCBmaWxlcyBjcmVhdGVkIGR1cmluZyB0aGUgYnVpbGQuXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgbm9ybWFsaXplZCBhcHBsaWNhdGlvbiBidWlsZGVyIG9wdGlvbnMgdXNlZCB0byBjcmVhdGUgdGhlIGJ1aWxkLlxuICogQHBhcmFtIGV4ZWN1dGlvblJlc3VsdCBUaGUgcmVzdWx0IG9mIGFuIGV4ZWN1dGVkIGJ1aWxkLlxuICogQHBhcmFtIGluaXRpYWxGaWxlcyBBIG1hcCBjb250YWluaW5nIGluaXRpYWwgZmlsZSBpbmZvcm1hdGlvbiBmb3IgdGhlIGV4ZWN1dGVkIGJ1aWxkLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaW5saW5lSTE4bihcbiAgb3B0aW9uczogTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zLFxuICBleGVjdXRpb25SZXN1bHQ6IEV4ZWN1dGlvblJlc3VsdCxcbiAgaW5pdGlhbEZpbGVzOiBNYXA8c3RyaW5nLCBJbml0aWFsRmlsZVJlY29yZD4sXG4pOiBQcm9taXNlPHsgZXJyb3JzOiBzdHJpbmdbXTsgd2FybmluZ3M6IHN0cmluZ1tdOyBwcmVyZW5kZXJlZFJvdXRlczogc3RyaW5nW10gfT4ge1xuICAvLyBDcmVhdGUgdGhlIG11bHRpLXRocmVhZGVkIGlubGluZXIgd2l0aCBjb21tb24gb3B0aW9ucyBhbmQgdGhlIGZpbGVzIGdlbmVyYXRlZCBmcm9tIHRoZSBidWlsZC5cbiAgY29uc3QgaW5saW5lciA9IG5ldyBJMThuSW5saW5lcihcbiAgICB7XG4gICAgICBtaXNzaW5nVHJhbnNsYXRpb246IG9wdGlvbnMuaTE4bk9wdGlvbnMubWlzc2luZ1RyYW5zbGF0aW9uQmVoYXZpb3IgPz8gJ3dhcm5pbmcnLFxuICAgICAgb3V0cHV0RmlsZXM6IGV4ZWN1dGlvblJlc3VsdC5vdXRwdXRGaWxlcyxcbiAgICAgIHNob3VsZE9wdGltaXplOiBvcHRpb25zLm9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICB9LFxuICAgIG1heFdvcmtlcnMsXG4gICk7XG5cbiAgY29uc3QgaW5saW5lUmVzdWx0OiB7IGVycm9yczogc3RyaW5nW107IHdhcm5pbmdzOiBzdHJpbmdbXTsgcHJlcmVuZGVyZWRSb3V0ZXM6IHN0cmluZ1tdIH0gPSB7XG4gICAgZXJyb3JzOiBbXSxcbiAgICB3YXJuaW5nczogW10sXG4gICAgcHJlcmVuZGVyZWRSb3V0ZXM6IFtdLFxuICB9O1xuXG4gIC8vIEZvciBlYWNoIGFjdGl2ZSBsb2NhbGUsIHVzZSB0aGUgaW5saW5lciB0byBwcm9jZXNzIHRoZSBvdXRwdXQgZmlsZXMgb2YgdGhlIGJ1aWxkLlxuICBjb25zdCB1cGRhdGVkT3V0cHV0RmlsZXMgPSBbXTtcbiAgY29uc3QgdXBkYXRlZEFzc2V0RmlsZXMgPSBbXTtcbiAgdHJ5IHtcbiAgICBmb3IgKGNvbnN0IGxvY2FsZSBvZiBvcHRpb25zLmkxOG5PcHRpb25zLmlubGluZUxvY2FsZXMpIHtcbiAgICAgIC8vIEEgbG9jYWxlIHNwZWNpZmljIHNldCBvZiBmaWxlcyBpcyByZXR1cm5lZCBmcm9tIHRoZSBpbmxpbmVyLlxuICAgICAgY29uc3QgbG9jYWxlT3V0cHV0RmlsZXMgPSBhd2FpdCBpbmxpbmVyLmlubGluZUZvckxvY2FsZShcbiAgICAgICAgbG9jYWxlLFxuICAgICAgICBvcHRpb25zLmkxOG5PcHRpb25zLmxvY2FsZXNbbG9jYWxlXS50cmFuc2xhdGlvbixcbiAgICAgICk7XG5cbiAgICAgIGNvbnN0IGJhc2VIcmVmID1cbiAgICAgICAgZ2V0TG9jYWxlQmFzZUhyZWYob3B0aW9ucy5iYXNlSHJlZiwgb3B0aW9ucy5pMThuT3B0aW9ucywgbG9jYWxlKSA/PyBvcHRpb25zLmJhc2VIcmVmO1xuXG4gICAgICBjb25zdCB7XG4gICAgICAgIGVycm9ycyxcbiAgICAgICAgd2FybmluZ3MsXG4gICAgICAgIGFkZGl0aW9uYWxBc3NldHMsXG4gICAgICAgIGFkZGl0aW9uYWxPdXRwdXRGaWxlcyxcbiAgICAgICAgcHJlcmVuZGVyZWRSb3V0ZXM6IGdlbmVyYXRlZFJvdXRlcyxcbiAgICAgIH0gPSBhd2FpdCBleGVjdXRlUG9zdEJ1bmRsZVN0ZXBzKFxuICAgICAgICB7XG4gICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICBiYXNlSHJlZixcbiAgICAgICAgfSxcbiAgICAgICAgbG9jYWxlT3V0cHV0RmlsZXMsXG4gICAgICAgIGV4ZWN1dGlvblJlc3VsdC5hc3NldEZpbGVzLFxuICAgICAgICBpbml0aWFsRmlsZXMsXG4gICAgICAgIGxvY2FsZSxcbiAgICAgICk7XG5cbiAgICAgIGxvY2FsZU91dHB1dEZpbGVzLnB1c2goLi4uYWRkaXRpb25hbE91dHB1dEZpbGVzKTtcbiAgICAgIGlubGluZVJlc3VsdC5lcnJvcnMucHVzaCguLi5lcnJvcnMpO1xuICAgICAgaW5saW5lUmVzdWx0Lndhcm5pbmdzLnB1c2goLi4ud2FybmluZ3MpO1xuXG4gICAgICAvLyBVcGRhdGUgZGlyZWN0b3J5IHdpdGggbG9jYWxlIGJhc2VcbiAgICAgIGlmIChvcHRpb25zLmkxOG5PcHRpb25zLmZsYXRPdXRwdXQgIT09IHRydWUpIHtcbiAgICAgICAgbG9jYWxlT3V0cHV0RmlsZXMuZm9yRWFjaCgoZmlsZSkgPT4ge1xuICAgICAgICAgIGZpbGUucGF0aCA9IGpvaW4obG9jYWxlLCBmaWxlLnBhdGgpO1xuICAgICAgICB9KTtcblxuICAgICAgICBmb3IgKGNvbnN0IGFzc2V0RmlsZSBvZiBbLi4uZXhlY3V0aW9uUmVzdWx0LmFzc2V0RmlsZXMsIC4uLmFkZGl0aW9uYWxBc3NldHNdKSB7XG4gICAgICAgICAgdXBkYXRlZEFzc2V0RmlsZXMucHVzaCh7XG4gICAgICAgICAgICBzb3VyY2U6IGFzc2V0RmlsZS5zb3VyY2UsXG4gICAgICAgICAgICBkZXN0aW5hdGlvbjogam9pbihsb2NhbGUsIGFzc2V0RmlsZS5kZXN0aW5hdGlvbiksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpbmxpbmVSZXN1bHQucHJlcmVuZGVyZWRSb3V0ZXMucHVzaChcbiAgICAgICAgICAuLi5nZW5lcmF0ZWRSb3V0ZXMubWFwKChyb3V0ZSkgPT4gcG9zaXguam9pbignLycsIGxvY2FsZSwgcm91dGUpKSxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlubGluZVJlc3VsdC5wcmVyZW5kZXJlZFJvdXRlcy5wdXNoKC4uLmdlbmVyYXRlZFJvdXRlcyk7XG4gICAgICAgIGV4ZWN1dGlvblJlc3VsdC5hc3NldEZpbGVzLnB1c2goLi4uYWRkaXRpb25hbEFzc2V0cyk7XG4gICAgICB9XG5cbiAgICAgIHVwZGF0ZWRPdXRwdXRGaWxlcy5wdXNoKC4uLmxvY2FsZU91dHB1dEZpbGVzKTtcbiAgICB9XG4gIH0gZmluYWxseSB7XG4gICAgYXdhaXQgaW5saW5lci5jbG9zZSgpO1xuICB9XG5cbiAgLy8gVXBkYXRlIHRoZSByZXN1bHQgd2l0aCBhbGwgbG9jYWxpemVkIGZpbGVzXG4gIGV4ZWN1dGlvblJlc3VsdC5vdXRwdXRGaWxlcyA9IHVwZGF0ZWRPdXRwdXRGaWxlcztcblxuICAvLyBBc3NldHMgYXJlIG9ubHkgY2hhbmdlZCBpZiBub3QgdXNpbmcgdGhlIGZsYXQgb3V0cHV0IG9wdGlvblxuICBpZiAob3B0aW9ucy5pMThuT3B0aW9ucy5mbGF0T3V0cHV0ICE9PSB0cnVlKSB7XG4gICAgZXhlY3V0aW9uUmVzdWx0LmFzc2V0RmlsZXMgPSB1cGRhdGVkQXNzZXRGaWxlcztcbiAgfVxuXG4gIHJldHVybiBpbmxpbmVSZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGdldExvY2FsZUJhc2VIcmVmKFxuICBiYXNlSHJlZjogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICBpMThuOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnNbJ2kxOG5PcHRpb25zJ10sXG4gIGxvY2FsZTogc3RyaW5nLFxuKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKGkxOG4uZmxhdE91dHB1dCkge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICBpZiAoaTE4bi5sb2NhbGVzW2xvY2FsZV0gJiYgaTE4bi5sb2NhbGVzW2xvY2FsZV0uYmFzZUhyZWYgIT09ICcnKSB7XG4gICAgcmV0dXJuIHVybEpvaW4oYmFzZUhyZWYgfHwgJycsIGkxOG4ubG9jYWxlc1tsb2NhbGVdLmJhc2VIcmVmID8/IGAvJHtsb2NhbGV9L2ApO1xuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBMb2FkcyBhbGwgYWN0aXZlIHRyYW5zbGF0aW9ucyB1c2luZyB0aGUgdHJhbnNsYXRpb24gbG9hZGVycyBmcm9tIHRoZSBgQGFuZ3VsYXIvbG9jYWxpemVgIHBhY2thZ2UuXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgYXJjaGl0ZWN0IGJ1aWxkZXIgY29udGV4dCBmb3IgdGhlIGN1cnJlbnQgYnVpbGQuXG4gKiBAcGFyYW0gaTE4biBUaGUgbm9ybWFsaXplZCBpMThuIG9wdGlvbnMgdG8gdXNlLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9hZEFjdGl2ZVRyYW5zbGF0aW9ucyhcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIGkxOG46IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9uc1snaTE4bk9wdGlvbnMnXSxcbikge1xuICAvLyBMb2FkIGxvY2FsZSBkYXRhIGFuZCB0cmFuc2xhdGlvbnMgKGlmIHByZXNlbnQpXG4gIGxldCBsb2FkZXI7XG4gIGZvciAoY29uc3QgW2xvY2FsZSwgZGVzY10gb2YgT2JqZWN0LmVudHJpZXMoaTE4bi5sb2NhbGVzKSkge1xuICAgIGlmICghaTE4bi5pbmxpbmVMb2NhbGVzLmhhcyhsb2NhbGUpICYmIGxvY2FsZSAhPT0gaTE4bi5zb3VyY2VMb2NhbGUpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmICghZGVzYy5maWxlcy5sZW5ndGgpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGxvYWRlciA/Pz0gYXdhaXQgY3JlYXRlVHJhbnNsYXRpb25Mb2FkZXIoKTtcblxuICAgIGxvYWRUcmFuc2xhdGlvbnMoXG4gICAgICBsb2NhbGUsXG4gICAgICBkZXNjLFxuICAgICAgY29udGV4dC53b3Jrc3BhY2VSb290LFxuICAgICAgbG9hZGVyLFxuICAgICAge1xuICAgICAgICB3YXJuKG1lc3NhZ2UpIHtcbiAgICAgICAgICBjb250ZXh0LmxvZ2dlci53YXJuKG1lc3NhZ2UpO1xuICAgICAgICB9LFxuICAgICAgICBlcnJvcihtZXNzYWdlKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHVuZGVmaW5lZCxcbiAgICAgIGkxOG4uZHVwbGljYXRlVHJhbnNsYXRpb25CZWhhdmlvcixcbiAgICApO1xuICB9XG59XG4iXX0=