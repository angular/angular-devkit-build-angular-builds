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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi1sb2NhbGUtcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9pMThuLWxvY2FsZS1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBSUg7O0dBRUc7QUFDVSxRQUFBLHVCQUF1QixHQUFHLGdDQUFnQyxDQUFDO0FBRXhFOzs7O0dBSUc7QUFDSCxTQUFnQiw2QkFBNkI7SUFDM0MsT0FBTztRQUNMLElBQUksRUFBRSxxQkFBcUI7UUFDM0IsS0FBSyxDQUFDLEtBQUs7WUFDVCxnR0FBZ0c7WUFDaEcseUdBQXlHO1lBQ3pHLHlHQUF5RztZQUN6RywwR0FBMEc7WUFDMUcsb0ZBQW9GO1lBQ3BGLDRHQUE0RztZQUM1RyxtQ0FBbUM7WUFDbkMsSUFBSSxLQUFLLENBQUMsY0FBYyxDQUFDLFFBQVEsS0FBSyxVQUFVLEVBQUU7Z0JBQ2hELE9BQU87YUFDUjtZQUVELEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxNQUFNLEVBQUUsd0JBQXdCLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFO2dCQUN2RSxtQ0FBbUM7Z0JBQ25DLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUU3QywwREFBMEQ7Z0JBQzFELElBQUksYUFBYSxHQUFHLGNBQWMsQ0FBQyxPQUFPLENBQUMseUJBQXlCLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBRTFFLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQztnQkFDakIsT0FBTyxhQUFhLEVBQUU7b0JBQ3BCLE1BQU0sYUFBYSxHQUFHLEdBQUcsK0JBQXVCLElBQUksYUFBYSxFQUFFLENBQUM7b0JBRXBFLE1BQU0sTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUU7d0JBQ2hELElBQUksRUFBRSxrQkFBa0I7d0JBQ3hCLFVBQVUsRUFBRSxLQUFLLENBQUMsY0FBYyxDQUFDLGFBQWE7cUJBQy9DLENBQUMsQ0FBQztvQkFDSCxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUU7d0JBQ2YsSUFBSSxLQUFLLEVBQUU7NEJBQ1QsT0FBTyxNQUFNLENBQUM7eUJBQ2Y7NkJBQU07NEJBQ0wsT0FBTztnQ0FDTCxHQUFHLE1BQU07Z0NBQ1QsUUFBUSxFQUFFO29DQUNSLEdBQUcsTUFBTSxDQUFDLFFBQVE7b0NBQ2xCO3dDQUNFLFFBQVEsRUFBRSxJQUFJO3dDQUNkLElBQUksRUFBRSxvQkFBb0IsY0FBYyw2Q0FBNkMsYUFBYSxJQUFJO3FDQUN2RztpQ0FDRjs2QkFDRixDQUFDO3lCQUNIO3FCQUNGO29CQUVELG1FQUFtRTtvQkFDbkUsTUFBTSxLQUFLLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDdkMsYUFBYSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUM3QyxLQUFLLEdBQUcsS0FBSyxDQUFDO29CQUNkLGdGQUFnRjtvQkFDaEYsSUFBSSxjQUFjLEtBQUssT0FBTyxJQUFJLGFBQWEsS0FBSyxJQUFJLEVBQUU7d0JBQ3hELEtBQUssR0FBRyxJQUFJLENBQUM7cUJBQ2Q7aUJBQ0Y7Z0JBRUQsc0dBQXNHO2dCQUN0RyxrRUFBa0U7Z0JBQ2xFLE9BQU87b0JBQ0wsSUFBSSxFQUFFLGNBQWM7b0JBQ3BCLFNBQVMsRUFBRSxxQkFBcUI7b0JBQ2hDLFFBQVEsRUFBRTt3QkFDUjs0QkFDRSxRQUFRLEVBQUUsSUFBSTs0QkFDZCxJQUFJLEVBQUUsb0JBQW9CLGNBQWMscUVBQXFFO3lCQUM5RztxQkFDRjtpQkFDRixDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7WUFFSCxvR0FBb0c7WUFDcEcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLHFCQUFxQixFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDL0YsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBM0VELHNFQTJFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IFBsdWdpbiB9IGZyb20gJ2VzYnVpbGQnO1xuXG4vKipcbiAqIFRoZSBiYXNlIG1vZHVsZSBsb2NhdGlvbiB1c2VkIHRvIHNlYXJjaCBmb3IgbG9jYWxlIHNwZWNpZmljIGRhdGEuXG4gKi9cbmV4cG9ydCBjb25zdCBMT0NBTEVfREFUQV9CQVNFX01PRFVMRSA9ICdAYW5ndWxhci9jb21tb24vbG9jYWxlcy9nbG9iYWwnO1xuXG4vKipcbiAqIENyZWF0ZXMgYW4gZXNidWlsZCBwbHVnaW4gdGhhdCByZXNvbHZlcyBBbmd1bGFyIGxvY2FsZSBkYXRhIGZpbGVzIGZyb20gYEBhbmd1bGFyL2NvbW1vbmAuXG4gKlxuICogQHJldHVybnMgQW4gZXNidWlsZCBwbHVnaW4uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBbmd1bGFyTG9jYWxlRGF0YVBsdWdpbigpOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLWxvY2FsZS1kYXRhJyxcbiAgICBzZXR1cChidWlsZCk6IHZvaWQge1xuICAgICAgLy8gSWYgcGFja2FnZXMgYXJlIGNvbmZpZ3VyZWQgdG8gYmUgZXh0ZXJuYWwgdGhlbiBsZWF2ZSB0aGUgb3JpZ2luYWwgYW5ndWxhciBsb2NhbGUgaW1wb3J0IHBhdGguXG4gICAgICAvLyBUaGlzIGhhcHBlbnMgd2hlbiB1c2luZyB0aGUgZGV2ZWxvcG1lbnQgc2VydmVyIHdpdGggY2FjaGluZyBlbmFibGVkIHRvIGFsbG93IFZpdGUgcHJlYnVuZGxpbmcgdG8gd29yay5cbiAgICAgIC8vIFRoZXJlIGN1cnJlbnRseSBpcyBubyBvcHRpb24gb24gdGhlIGVzYnVpbGQgcmVzb2x2ZSBmdW5jdGlvbiB0byByZXNvbHZlIHdoaWxlIGRpc2FibGluZyB0aGUgb3B0aW9uLiBUb1xuICAgICAgLy8gd29ya2Fyb3VuZCB0aGUgaW5hYmlsaXR5IHRvIHJlc29sdmUgdGhlIGZ1bGwgbG9jYWxlIGxvY2F0aW9uIGhlcmUsIHRoZSBWaXRlIGRldiBzZXJ2ZXIgcHJlYnVuZGxpbmcgYWxzb1xuICAgICAgLy8gY29udGFpbnMgYSBwbHVnaW4gdG8gYWxsb3cgdGhlIGxvY2FsZXMgdG8gYmUgY29ycmVjdGx5IHJlc29sdmVkIHdoZW4gcHJlYnVuZGxpbmcuXG4gICAgICAvLyBOT1RFOiBJZiBlc2J1aWxkIGV2ZW50dWFsbHkgYWxsb3dzIGNvbnRyb2xsaW5nIHRoZSBleHRlcm5hbCBwYWNrYWdlIG9wdGlvbnMgaW4gYSBidWlsZC5yZXNvbHZlIGNhbGwsIHRoaXNcbiAgICAgIC8vICAgICAgIHdvcmthcm91bmQgY2FuIGJlIHJlbW92ZWQuXG4gICAgICBpZiAoYnVpbGQuaW5pdGlhbE9wdGlvbnMucGFja2FnZXMgPT09ICdleHRlcm5hbCcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IC9eYW5ndWxhcjpsb2NhbGVcXC9kYXRhOi8gfSwgYXN5bmMgKHsgcGF0aCB9KSA9PiB7XG4gICAgICAgIC8vIEV4dHJhY3QgdGhlIGxvY2FsZSBmcm9tIHRoZSBwYXRoXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsTG9jYWxlID0gcGF0aC5zcGxpdCgnOicsIDMpWzJdO1xuXG4gICAgICAgIC8vIFJlbW92ZSBhbnkgcHJpdmF0ZSBzdWJ0YWdzIHNpbmNlIHRoZXNlIHdpbGwgbmV2ZXIgbWF0Y2hcbiAgICAgICAgbGV0IHBhcnRpYWxMb2NhbGUgPSBvcmlnaW5hbExvY2FsZS5yZXBsYWNlKC8teCgtW2EtekEtWjAtOV17MSw4fSkrJC8sICcnKTtcblxuICAgICAgICBsZXQgZXhhY3QgPSB0cnVlO1xuICAgICAgICB3aGlsZSAocGFydGlhbExvY2FsZSkge1xuICAgICAgICAgIGNvbnN0IHBvdGVudGlhbFBhdGggPSBgJHtMT0NBTEVfREFUQV9CQVNFX01PRFVMRX0vJHtwYXJ0aWFsTG9jYWxlfWA7XG5cbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBidWlsZC5yZXNvbHZlKHBvdGVudGlhbFBhdGgsIHtcbiAgICAgICAgICAgIGtpbmQ6ICdpbXBvcnQtc3RhdGVtZW50JyxcbiAgICAgICAgICAgIHJlc29sdmVEaXI6IGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKHJlc3VsdC5wYXRoKSB7XG4gICAgICAgICAgICBpZiAoZXhhY3QpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgLi4ucmVzdWx0LFxuICAgICAgICAgICAgICAgIHdhcm5pbmdzOiBbXG4gICAgICAgICAgICAgICAgICAuLi5yZXN1bHQud2FybmluZ3MsXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICB0ZXh0OiBgTG9jYWxlIGRhdGEgZm9yICcke29yaWdpbmFsTG9jYWxlfScgY2Fubm90IGJlIGZvdW5kLiBVc2luZyBsb2NhbGUgZGF0YSBmb3IgJyR7cGFydGlhbExvY2FsZX0nLmAsXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gUmVtb3ZlIHRoZSBsYXN0IHN1YnRhZyBhbmQgdHJ5IGFnYWluIHdpdGggYSBsZXNzIHNwZWNpZmljIGxvY2FsZVxuICAgICAgICAgIGNvbnN0IHBhcnRzID0gcGFydGlhbExvY2FsZS5zcGxpdCgnLScpO1xuICAgICAgICAgIHBhcnRpYWxMb2NhbGUgPSBwYXJ0cy5zbGljZSgwLCAtMSkuam9pbignLScpO1xuICAgICAgICAgIGV4YWN0ID0gZmFsc2U7XG4gICAgICAgICAgLy8gVGhlIGxvY2FsZXMgXCJlblwiIGFuZCBcImVuLVVTXCIgYXJlIGNvbnNpZGVyZWQgZXhhY3QgdG8gcmV0YWluIGV4aXN0aW5nIGJlaGF2aW9yXG4gICAgICAgICAgaWYgKG9yaWdpbmFsTG9jYWxlID09PSAnZW4tVVMnICYmIHBhcnRpYWxMb2NhbGUgPT09ICdlbicpIHtcbiAgICAgICAgICAgIGV4YWN0ID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBOb3QgZm91bmQgc28gaXNzdWUgYSB3YXJuaW5nIGFuZCB1c2UgYW4gZW1wdHkgbG9hZGVyLiBGcmFtZXdvcmsgYnVpbHQtaW4gYGVuLVVTYCBkYXRhIHdpbGwgYmUgdXNlZC5cbiAgICAgICAgLy8gVGhpcyByZXRhaW5zIGV4aXN0aW5nIGJlaGF2aW9yIGFzIGluIHRoZSBXZWJwYWNrLWJhc2VkIGJ1aWxkZXIuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcGF0aDogb3JpZ2luYWxMb2NhbGUsXG4gICAgICAgICAgbmFtZXNwYWNlOiAnYW5ndWxhcjpsb2NhbGUvZGF0YScsXG4gICAgICAgICAgd2FybmluZ3M6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbG9jYXRpb246IG51bGwsXG4gICAgICAgICAgICAgIHRleHQ6IGBMb2NhbGUgZGF0YSBmb3IgJyR7b3JpZ2luYWxMb2NhbGV9JyBjYW5ub3QgYmUgZm91bmQuIE5vIGxvY2FsZSBkYXRhIHdpbGwgYmUgaW5jbHVkZWQgZm9yIHRoaXMgbG9jYWxlLmAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgICAgLy8gTG9jYWxlcyB0aGF0IGNhbm5vdCBiZSBmb3VuZCB3aWxsIGJlIGxvYWRlZCBhcyBlbXB0eSBjb250ZW50IHdpdGggYSB3YXJuaW5nIGZyb20gdGhlIHJlc29sdmUgc3RlcFxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZTogJ2FuZ3VsYXI6bG9jYWxlL2RhdGEnIH0sICgpID0+ICh7IGxvYWRlcjogJ2VtcHR5JyB9KSk7XG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==