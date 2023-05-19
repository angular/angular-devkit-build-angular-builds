"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCssResourcePlugin = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const load_result_cache_1 = require("../load-result-cache");
/**
 * Symbol marker used to indicate CSS resource resolution is being attempted.
 * This is used to prevent an infinite loop within the plugin's resolve hook.
 */
const CSS_RESOURCE_RESOLUTION = Symbol('CSS_RESOURCE_RESOLUTION');
/**
 * Creates an esbuild {@link Plugin} that loads all CSS url token references using the
 * built-in esbuild `file` loader. A plugin is used to allow for all file extensions
 * and types to be supported without needing to manually specify all extensions
 * within the build configuration.
 *
 * @returns An esbuild {@link Plugin} instance.
 */
function createCssResourcePlugin(cache) {
    return {
        name: 'angular-css-resource',
        setup(build) {
            build.onResolve({ filter: /.*/ }, async (args) => {
                // Only attempt to resolve url tokens which only exist inside CSS.
                // Also, skip this plugin if already attempting to resolve the url-token.
                if (args.kind !== 'url-token' || args.pluginData?.[CSS_RESOURCE_RESOLUTION]) {
                    return null;
                }
                // If root-relative, absolute or protocol relative url, mark as external to leave the
                // path/URL in place.
                if (/^((?:\w+:)?\/\/|data:|chrome:|#|\/)/.test(args.path)) {
                    return {
                        path: args.path,
                        external: true,
                    };
                }
                const { importer, kind, resolveDir, namespace, pluginData = {} } = args;
                pluginData[CSS_RESOURCE_RESOLUTION] = true;
                const result = await build.resolve(args.path, {
                    importer,
                    kind,
                    namespace,
                    pluginData,
                    resolveDir,
                });
                if (result.errors.length && args.path[0] === '~') {
                    result.errors[0].notes = [
                        {
                            location: null,
                            text: 'You can remove the tilde and use a relative path to reference it, which should remove this error.',
                        },
                    ];
                }
                // Return results that are not files since these are most likely specific to another plugin
                // and cannot be loaded by this plugin.
                if (result.namespace !== 'file') {
                    return result;
                }
                // All file results are considered CSS resources and will be loaded via the file loader
                return {
                    ...result,
                    // Use a relative path to prevent fully resolved paths in the metafile (JSON stats file).
                    // This is only necessary for custom namespaces. esbuild will handle the file namespace.
                    path: (0, node_path_1.relative)(build.initialOptions.absWorkingDir ?? '', result.path),
                    namespace: 'css-resource',
                };
            });
            build.onLoad({ filter: /./, namespace: 'css-resource' }, (0, load_result_cache_1.createCachedLoad)(cache, async (args) => {
                const resourcePath = (0, node_path_1.join)(build.initialOptions.absWorkingDir ?? '', args.path);
                return {
                    contents: await (0, promises_1.readFile)(resourcePath),
                    loader: 'file',
                    watchFiles: [resourcePath],
                };
            }));
        },
    };
}
exports.createCssResourcePlugin = createCssResourcePlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3NzLXJlc291cmNlLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9zdHlsZXNoZWV0cy9jc3MtcmVzb3VyY2UtcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILCtDQUE0QztBQUM1Qyx5Q0FBMkM7QUFDM0MsNERBQXlFO0FBRXpFOzs7R0FHRztBQUNILE1BQU0sdUJBQXVCLEdBQUcsTUFBTSxDQUFDLHlCQUF5QixDQUFDLENBQUM7QUFFbEU7Ozs7Ozs7R0FPRztBQUNILFNBQWdCLHVCQUF1QixDQUFDLEtBQXVCO0lBQzdELE9BQU87UUFDTCxJQUFJLEVBQUUsc0JBQXNCO1FBQzVCLEtBQUssQ0FBQyxLQUFrQjtZQUN0QixLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtnQkFDL0Msa0VBQWtFO2dCQUNsRSx5RUFBeUU7Z0JBQ3pFLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxXQUFXLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLHVCQUF1QixDQUFDLEVBQUU7b0JBQzNFLE9BQU8sSUFBSSxDQUFDO2lCQUNiO2dCQUVELHFGQUFxRjtnQkFDckYscUJBQXFCO2dCQUNyQixJQUFJLHFDQUFxQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ3pELE9BQU87d0JBQ0wsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO3dCQUNmLFFBQVEsRUFBRSxJQUFJO3FCQUNmLENBQUM7aUJBQ0g7Z0JBRUQsTUFBTSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxVQUFVLEdBQUcsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDO2dCQUN4RSxVQUFVLENBQUMsdUJBQXVCLENBQUMsR0FBRyxJQUFJLENBQUM7Z0JBRTNDLE1BQU0sTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFO29CQUM1QyxRQUFRO29CQUNSLElBQUk7b0JBQ0osU0FBUztvQkFDVCxVQUFVO29CQUNWLFVBQVU7aUJBQ1gsQ0FBQyxDQUFDO2dCQUVILElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7b0JBQ2hELE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHO3dCQUN2Qjs0QkFDRSxRQUFRLEVBQUUsSUFBSTs0QkFDZCxJQUFJLEVBQUUsbUdBQW1HO3lCQUMxRztxQkFDRixDQUFDO2lCQUNIO2dCQUVELDJGQUEyRjtnQkFDM0YsdUNBQXVDO2dCQUN2QyxJQUFJLE1BQU0sQ0FBQyxTQUFTLEtBQUssTUFBTSxFQUFFO29CQUMvQixPQUFPLE1BQU0sQ0FBQztpQkFDZjtnQkFFRCx1RkFBdUY7Z0JBQ3ZGLE9BQU87b0JBQ0wsR0FBRyxNQUFNO29CQUNULHlGQUF5RjtvQkFDekYsd0ZBQXdGO29CQUN4RixJQUFJLEVBQUUsSUFBQSxvQkFBUSxFQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsYUFBYSxJQUFJLEVBQUUsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDO29CQUNyRSxTQUFTLEVBQUUsY0FBYztpQkFDMUIsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDO1lBRUgsS0FBSyxDQUFDLE1BQU0sQ0FDVixFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxFQUMxQyxJQUFBLG9DQUFnQixFQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7Z0JBQ3JDLE1BQU0sWUFBWSxHQUFHLElBQUEsZ0JBQUksRUFBQyxLQUFLLENBQUMsY0FBYyxDQUFDLGFBQWEsSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUUvRSxPQUFPO29CQUNMLFFBQVEsRUFBRSxNQUFNLElBQUEsbUJBQVEsRUFBQyxZQUFZLENBQUM7b0JBQ3RDLE1BQU0sRUFBRSxNQUFNO29CQUNkLFVBQVUsRUFBRSxDQUFDLFlBQVksQ0FBQztpQkFDM0IsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUNILENBQUM7UUFDSixDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUF0RUQsMERBc0VDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgUGx1Z2luLCBQbHVnaW5CdWlsZCB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IGpvaW4sIHJlbGF0aXZlIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IExvYWRSZXN1bHRDYWNoZSwgY3JlYXRlQ2FjaGVkTG9hZCB9IGZyb20gJy4uL2xvYWQtcmVzdWx0LWNhY2hlJztcblxuLyoqXG4gKiBTeW1ib2wgbWFya2VyIHVzZWQgdG8gaW5kaWNhdGUgQ1NTIHJlc291cmNlIHJlc29sdXRpb24gaXMgYmVpbmcgYXR0ZW1wdGVkLlxuICogVGhpcyBpcyB1c2VkIHRvIHByZXZlbnQgYW4gaW5maW5pdGUgbG9vcCB3aXRoaW4gdGhlIHBsdWdpbidzIHJlc29sdmUgaG9vay5cbiAqL1xuY29uc3QgQ1NTX1JFU09VUkNFX1JFU09MVVRJT04gPSBTeW1ib2woJ0NTU19SRVNPVVJDRV9SRVNPTFVUSU9OJyk7XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBlc2J1aWxkIHtAbGluayBQbHVnaW59IHRoYXQgbG9hZHMgYWxsIENTUyB1cmwgdG9rZW4gcmVmZXJlbmNlcyB1c2luZyB0aGVcbiAqIGJ1aWx0LWluIGVzYnVpbGQgYGZpbGVgIGxvYWRlci4gQSBwbHVnaW4gaXMgdXNlZCB0byBhbGxvdyBmb3IgYWxsIGZpbGUgZXh0ZW5zaW9uc1xuICogYW5kIHR5cGVzIHRvIGJlIHN1cHBvcnRlZCB3aXRob3V0IG5lZWRpbmcgdG8gbWFudWFsbHkgc3BlY2lmeSBhbGwgZXh0ZW5zaW9uc1xuICogd2l0aGluIHRoZSBidWlsZCBjb25maWd1cmF0aW9uLlxuICpcbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQge0BsaW5rIFBsdWdpbn0gaW5zdGFuY2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDc3NSZXNvdXJjZVBsdWdpbihjYWNoZT86IExvYWRSZXN1bHRDYWNoZSk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItY3NzLXJlc291cmNlJyxcbiAgICBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiB2b2lkIHtcbiAgICAgIGJ1aWxkLm9uUmVzb2x2ZSh7IGZpbHRlcjogLy4qLyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAvLyBPbmx5IGF0dGVtcHQgdG8gcmVzb2x2ZSB1cmwgdG9rZW5zIHdoaWNoIG9ubHkgZXhpc3QgaW5zaWRlIENTUy5cbiAgICAgICAgLy8gQWxzbywgc2tpcCB0aGlzIHBsdWdpbiBpZiBhbHJlYWR5IGF0dGVtcHRpbmcgdG8gcmVzb2x2ZSB0aGUgdXJsLXRva2VuLlxuICAgICAgICBpZiAoYXJncy5raW5kICE9PSAndXJsLXRva2VuJyB8fCBhcmdzLnBsdWdpbkRhdGE/LltDU1NfUkVTT1VSQ0VfUkVTT0xVVElPTl0pIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHJvb3QtcmVsYXRpdmUsIGFic29sdXRlIG9yIHByb3RvY29sIHJlbGF0aXZlIHVybCwgbWFyayBhcyBleHRlcm5hbCB0byBsZWF2ZSB0aGVcbiAgICAgICAgLy8gcGF0aC9VUkwgaW4gcGxhY2UuXG4gICAgICAgIGlmICgvXigoPzpcXHcrOik/XFwvXFwvfGRhdGE6fGNocm9tZTp8I3xcXC8pLy50ZXN0KGFyZ3MucGF0aCkpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGF0aDogYXJncy5wYXRoLFxuICAgICAgICAgICAgZXh0ZXJuYWw6IHRydWUsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHsgaW1wb3J0ZXIsIGtpbmQsIHJlc29sdmVEaXIsIG5hbWVzcGFjZSwgcGx1Z2luRGF0YSA9IHt9IH0gPSBhcmdzO1xuICAgICAgICBwbHVnaW5EYXRhW0NTU19SRVNPVVJDRV9SRVNPTFVUSU9OXSA9IHRydWU7XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZShhcmdzLnBhdGgsIHtcbiAgICAgICAgICBpbXBvcnRlcixcbiAgICAgICAgICBraW5kLFxuICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICBwbHVnaW5EYXRhLFxuICAgICAgICAgIHJlc29sdmVEaXIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChyZXN1bHQuZXJyb3JzLmxlbmd0aCAmJiBhcmdzLnBhdGhbMF0gPT09ICd+Jykge1xuICAgICAgICAgIHJlc3VsdC5lcnJvcnNbMF0ubm90ZXMgPSBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGxvY2F0aW9uOiBudWxsLFxuICAgICAgICAgICAgICB0ZXh0OiAnWW91IGNhbiByZW1vdmUgdGhlIHRpbGRlIGFuZCB1c2UgYSByZWxhdGl2ZSBwYXRoIHRvIHJlZmVyZW5jZSBpdCwgd2hpY2ggc2hvdWxkIHJlbW92ZSB0aGlzIGVycm9yLicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXR1cm4gcmVzdWx0cyB0aGF0IGFyZSBub3QgZmlsZXMgc2luY2UgdGhlc2UgYXJlIG1vc3QgbGlrZWx5IHNwZWNpZmljIHRvIGFub3RoZXIgcGx1Z2luXG4gICAgICAgIC8vIGFuZCBjYW5ub3QgYmUgbG9hZGVkIGJ5IHRoaXMgcGx1Z2luLlxuICAgICAgICBpZiAocmVzdWx0Lm5hbWVzcGFjZSAhPT0gJ2ZpbGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFsbCBmaWxlIHJlc3VsdHMgYXJlIGNvbnNpZGVyZWQgQ1NTIHJlc291cmNlcyBhbmQgd2lsbCBiZSBsb2FkZWQgdmlhIHRoZSBmaWxlIGxvYWRlclxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIC4uLnJlc3VsdCxcbiAgICAgICAgICAvLyBVc2UgYSByZWxhdGl2ZSBwYXRoIHRvIHByZXZlbnQgZnVsbHkgcmVzb2x2ZWQgcGF0aHMgaW4gdGhlIG1ldGFmaWxlIChKU09OIHN0YXRzIGZpbGUpLlxuICAgICAgICAgIC8vIFRoaXMgaXMgb25seSBuZWNlc3NhcnkgZm9yIGN1c3RvbSBuYW1lc3BhY2VzLiBlc2J1aWxkIHdpbGwgaGFuZGxlIHRoZSBmaWxlIG5hbWVzcGFjZS5cbiAgICAgICAgICBwYXRoOiByZWxhdGl2ZShidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyID8/ICcnLCByZXN1bHQucGF0aCksXG4gICAgICAgICAgbmFtZXNwYWNlOiAnY3NzLXJlc291cmNlJyxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkxvYWQoXG4gICAgICAgIHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZTogJ2Nzcy1yZXNvdXJjZScgfSxcbiAgICAgICAgY3JlYXRlQ2FjaGVkTG9hZChjYWNoZSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgICBjb25zdCByZXNvdXJjZVBhdGggPSBqb2luKGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIgPz8gJycsIGFyZ3MucGF0aCk7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29udGVudHM6IGF3YWl0IHJlYWRGaWxlKHJlc291cmNlUGF0aCksXG4gICAgICAgICAgICBsb2FkZXI6ICdmaWxlJyxcbiAgICAgICAgICAgIHdhdGNoRmlsZXM6IFtyZXNvdXJjZVBhdGhdLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9LFxuICB9O1xufVxuIl19