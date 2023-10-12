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
 * Creates a Vite plugin that resolves Angular locale data files from `@angular/common`.
 *
 * @returns A Vite plugin.
 */
function createAngularLocaleDataPlugin() {
    return {
        name: 'angular-locale-data',
        enforce: 'pre',
        async resolveId(source) {
            if (!source.startsWith('angular:locale/data:')) {
                return;
            }
            // Extract the locale from the path
            const originalLocale = source.split(':', 3)[2];
            // Remove any private subtags since these will never match
            let partialLocale = originalLocale.replace(/-x(-[a-zA-Z0-9]{1,8})+$/, '');
            let exact = true;
            while (partialLocale) {
                const potentialPath = `${exports.LOCALE_DATA_BASE_MODULE}/${partialLocale}`;
                const result = await this.resolve(potentialPath);
                if (result) {
                    if (!exact) {
                        this.warn(`Locale data for '${originalLocale}' cannot be found. Using locale data for '${partialLocale}'.`);
                    }
                    return result;
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
            return null;
        },
    };
}
exports.createAngularLocaleDataPlugin = createAngularLocaleDataPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi1sb2NhbGUtcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvdml0ZS9pMThuLWxvY2FsZS1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBSUg7O0dBRUc7QUFDVSxRQUFBLHVCQUF1QixHQUFHLGdDQUFnQyxDQUFDO0FBRXhFOzs7O0dBSUc7QUFDSCxTQUFnQiw2QkFBNkI7SUFDM0MsT0FBTztRQUNMLElBQUksRUFBRSxxQkFBcUI7UUFDM0IsT0FBTyxFQUFFLEtBQUs7UUFDZCxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU07WUFDcEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsc0JBQXNCLENBQUMsRUFBRTtnQkFDOUMsT0FBTzthQUNSO1lBRUQsbUNBQW1DO1lBQ25DLE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRS9DLDBEQUEwRDtZQUMxRCxJQUFJLGFBQWEsR0FBRyxjQUFjLENBQUMsT0FBTyxDQUFDLHlCQUF5QixFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBRTFFLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQztZQUNqQixPQUFPLGFBQWEsRUFBRTtnQkFDcEIsTUFBTSxhQUFhLEdBQUcsR0FBRywrQkFBdUIsSUFBSSxhQUFhLEVBQUUsQ0FBQztnQkFFcEUsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUNqRCxJQUFJLE1BQU0sRUFBRTtvQkFDVixJQUFJLENBQUMsS0FBSyxFQUFFO3dCQUNWLElBQUksQ0FBQyxJQUFJLENBQ1Asb0JBQW9CLGNBQWMsNkNBQTZDLGFBQWEsSUFBSSxDQUNqRyxDQUFDO3FCQUNIO29CQUVELE9BQU8sTUFBTSxDQUFDO2lCQUNmO2dCQUVELG1FQUFtRTtnQkFDbkUsTUFBTSxLQUFLLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDdkMsYUFBYSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUM3QyxLQUFLLEdBQUcsS0FBSyxDQUFDO2dCQUNkLGdGQUFnRjtnQkFDaEYsSUFBSSxjQUFjLEtBQUssT0FBTyxJQUFJLGFBQWEsS0FBSyxJQUFJLEVBQUU7b0JBQ3hELEtBQUssR0FBRyxJQUFJLENBQUM7aUJBQ2Q7YUFDRjtZQUVELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBM0NELHNFQTJDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IFBsdWdpbiB9IGZyb20gJ3ZpdGUnO1xuXG4vKipcbiAqIFRoZSBiYXNlIG1vZHVsZSBsb2NhdGlvbiB1c2VkIHRvIHNlYXJjaCBmb3IgbG9jYWxlIHNwZWNpZmljIGRhdGEuXG4gKi9cbmV4cG9ydCBjb25zdCBMT0NBTEVfREFUQV9CQVNFX01PRFVMRSA9ICdAYW5ndWxhci9jb21tb24vbG9jYWxlcy9nbG9iYWwnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBWaXRlIHBsdWdpbiB0aGF0IHJlc29sdmVzIEFuZ3VsYXIgbG9jYWxlIGRhdGEgZmlsZXMgZnJvbSBgQGFuZ3VsYXIvY29tbW9uYC5cbiAqXG4gKiBAcmV0dXJucyBBIFZpdGUgcGx1Z2luLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQW5ndWxhckxvY2FsZURhdGFQbHVnaW4oKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1sb2NhbGUtZGF0YScsXG4gICAgZW5mb3JjZTogJ3ByZScsXG4gICAgYXN5bmMgcmVzb2x2ZUlkKHNvdXJjZSkge1xuICAgICAgaWYgKCFzb3VyY2Uuc3RhcnRzV2l0aCgnYW5ndWxhcjpsb2NhbGUvZGF0YTonKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIEV4dHJhY3QgdGhlIGxvY2FsZSBmcm9tIHRoZSBwYXRoXG4gICAgICBjb25zdCBvcmlnaW5hbExvY2FsZSA9IHNvdXJjZS5zcGxpdCgnOicsIDMpWzJdO1xuXG4gICAgICAvLyBSZW1vdmUgYW55IHByaXZhdGUgc3VidGFncyBzaW5jZSB0aGVzZSB3aWxsIG5ldmVyIG1hdGNoXG4gICAgICBsZXQgcGFydGlhbExvY2FsZSA9IG9yaWdpbmFsTG9jYWxlLnJlcGxhY2UoLy14KC1bYS16QS1aMC05XXsxLDh9KSskLywgJycpO1xuXG4gICAgICBsZXQgZXhhY3QgPSB0cnVlO1xuICAgICAgd2hpbGUgKHBhcnRpYWxMb2NhbGUpIHtcbiAgICAgICAgY29uc3QgcG90ZW50aWFsUGF0aCA9IGAke0xPQ0FMRV9EQVRBX0JBU0VfTU9EVUxFfS8ke3BhcnRpYWxMb2NhbGV9YDtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnJlc29sdmUocG90ZW50aWFsUGF0aCk7XG4gICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICBpZiAoIWV4YWN0KSB7XG4gICAgICAgICAgICB0aGlzLndhcm4oXG4gICAgICAgICAgICAgIGBMb2NhbGUgZGF0YSBmb3IgJyR7b3JpZ2luYWxMb2NhbGV9JyBjYW5ub3QgYmUgZm91bmQuIFVzaW5nIGxvY2FsZSBkYXRhIGZvciAnJHtwYXJ0aWFsTG9jYWxlfScuYCxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlbW92ZSB0aGUgbGFzdCBzdWJ0YWcgYW5kIHRyeSBhZ2FpbiB3aXRoIGEgbGVzcyBzcGVjaWZpYyBsb2NhbGVcbiAgICAgICAgY29uc3QgcGFydHMgPSBwYXJ0aWFsTG9jYWxlLnNwbGl0KCctJyk7XG4gICAgICAgIHBhcnRpYWxMb2NhbGUgPSBwYXJ0cy5zbGljZSgwLCAtMSkuam9pbignLScpO1xuICAgICAgICBleGFjdCA9IGZhbHNlO1xuICAgICAgICAvLyBUaGUgbG9jYWxlcyBcImVuXCIgYW5kIFwiZW4tVVNcIiBhcmUgY29uc2lkZXJlZCBleGFjdCB0byByZXRhaW4gZXhpc3RpbmcgYmVoYXZpb3JcbiAgICAgICAgaWYgKG9yaWdpbmFsTG9jYWxlID09PSAnZW4tVVMnICYmIHBhcnRpYWxMb2NhbGUgPT09ICdlbicpIHtcbiAgICAgICAgICBleGFjdCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==