"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAngularLocaleDataPlugin = exports.LOCALE_DATA_BASE_MODULE = void 0;
/**
 * The base module location used to search for locale specific data.
 */
exports.LOCALE_DATA_BASE_MODULE = '@angular/common/locales/global';
/**
 * Creates an esbuild plugin that resolves Angular locale data files from `@angular/common`.
 *
 * @returns An esbuild plugin.
 */
function createAngularLocaleDataPlugin() {
    return {
        name: 'angular-locale-data',
        setup(build) {
            // If packages are configured to be external then leave the original angular locale import path.
            // This happens when using the development server with caching enabled to allow Vite prebundling to work.
            // There currently is no option on the esbuild resolve function to resolve while disabling the option. To
            // workaround the inability to resolve the full locale location here, the Vite dev server prebundling also
            // contains a plugin to allow the locales to be correctly resolved when prebundling.
            // NOTE: If esbuild eventually allows controlling the external package options in a build.resolve call, this
            //       workaround can be removed.
            if (build.initialOptions.packages === 'external') {
                return;
            }
            build.onResolve({ filter: /^angular:locale\/data:/ }, async ({ path }) => {
                // Extract the locale from the path
                const originalLocale = path.split(':', 3)[2];
                // Remove any private subtags since these will never match
                let partialLocale = originalLocale.replace(/-x(-[a-zA-Z0-9]{1,8})+$/, '');
                let exact = true;
                while (partialLocale) {
                    const potentialPath = `${exports.LOCALE_DATA_BASE_MODULE}/${partialLocale}`;
                    const result = await build.resolve(potentialPath, {
                        kind: 'import-statement',
                        resolveDir: build.initialOptions.absWorkingDir,
                    });
                    if (result.path) {
                        if (exact) {
                            return result;
                        }
                        else {
                            return {
                                ...result,
                                warnings: [
                                    ...result.warnings,
                                    {
                                        location: null,
                                        text: `Locale data for '${originalLocale}' cannot be found. Using locale data for '${partialLocale}'.`,
                                    },
                                ],
                            };
                        }
                    }
                    // Remove the last subtag and try again with a less specific locale
                    const parts = partialLocale.split('-');
                    partialLocale = parts.slice(0, -1).join('-');
                    exact = false;
                    // The locales "en" and "en-US" are considered exact to retain existing behavior
                    if (originalLocale === 'en-US' && partialLocale === 'en') {
                        exact = true;
                    }
                }
                // Not found so issue a warning and use an empty loader. Framework built-in `en-US` data will be used.
                // This retains existing behavior as in the Webpack-based builder.
                return {
                    path: originalLocale,
                    namespace: 'angular:locale/data',
                    warnings: [
                        {
                            location: null,
                            text: `Locale data for '${originalLocale}' cannot be found. No locale data will be included for this locale.`,
                        },
                    ],
                };
            });
            // Locales that cannot be found will be loaded as empty content with a warning from the resolve step
            build.onLoad({ filter: /./, namespace: 'angular:locale/data' }, () => ({ loader: 'empty' }));
        },
    };
}
exports.createAngularLocaleDataPlugin = createAngularLocaleDataPlugin;
