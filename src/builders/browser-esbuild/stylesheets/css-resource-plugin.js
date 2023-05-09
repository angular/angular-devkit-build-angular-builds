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
function createCssResourcePlugin() {
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
            build.onLoad({ filter: /.*/, namespace: 'css-resource' }, async (args) => {
                return {
                    contents: await (0, promises_1.readFile)((0, node_path_1.join)(build.initialOptions.absWorkingDir ?? '', args.path)),
                    loader: 'file',
                };
            });
        },
    };
}
exports.createCssResourcePlugin = createCssResourcePlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3NzLXJlc291cmNlLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9zdHlsZXNoZWV0cy9jc3MtcmVzb3VyY2UtcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILCtDQUE0QztBQUM1Qyx5Q0FBMkM7QUFFM0M7OztHQUdHO0FBQ0gsTUFBTSx1QkFBdUIsR0FBRyxNQUFNLENBQUMseUJBQXlCLENBQUMsQ0FBQztBQUVsRTs7Ozs7OztHQU9HO0FBQ0gsU0FBZ0IsdUJBQXVCO0lBQ3JDLE9BQU87UUFDTCxJQUFJLEVBQUUsc0JBQXNCO1FBQzVCLEtBQUssQ0FBQyxLQUFrQjtZQUN0QixLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtnQkFDL0Msa0VBQWtFO2dCQUNsRSx5RUFBeUU7Z0JBQ3pFLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxXQUFXLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLHVCQUF1QixDQUFDLEVBQUU7b0JBQzNFLE9BQU8sSUFBSSxDQUFDO2lCQUNiO2dCQUVELHFGQUFxRjtnQkFDckYscUJBQXFCO2dCQUNyQixJQUFJLHFDQUFxQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ3pELE9BQU87d0JBQ0wsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO3dCQUNmLFFBQVEsRUFBRSxJQUFJO3FCQUNmLENBQUM7aUJBQ0g7Z0JBRUQsTUFBTSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxVQUFVLEdBQUcsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDO2dCQUN4RSxVQUFVLENBQUMsdUJBQXVCLENBQUMsR0FBRyxJQUFJLENBQUM7Z0JBRTNDLE1BQU0sTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFO29CQUM1QyxRQUFRO29CQUNSLElBQUk7b0JBQ0osU0FBUztvQkFDVCxVQUFVO29CQUNWLFVBQVU7aUJBQ1gsQ0FBQyxDQUFDO2dCQUVILElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7b0JBQ2hELE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHO3dCQUN2Qjs0QkFDRSxRQUFRLEVBQUUsSUFBSTs0QkFDZCxJQUFJLEVBQUUsbUdBQW1HO3lCQUMxRztxQkFDRixDQUFDO2lCQUNIO2dCQUVELDJGQUEyRjtnQkFDM0YsdUNBQXVDO2dCQUN2QyxJQUFJLE1BQU0sQ0FBQyxTQUFTLEtBQUssTUFBTSxFQUFFO29CQUMvQixPQUFPLE1BQU0sQ0FBQztpQkFDZjtnQkFFRCx1RkFBdUY7Z0JBQ3ZGLE9BQU87b0JBQ0wsR0FBRyxNQUFNO29CQUNULHlGQUF5RjtvQkFDekYsd0ZBQXdGO29CQUN4RixJQUFJLEVBQUUsSUFBQSxvQkFBUSxFQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsYUFBYSxJQUFJLEVBQUUsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDO29CQUNyRSxTQUFTLEVBQUUsY0FBYztpQkFDMUIsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDO1lBRUgsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtnQkFDdkUsT0FBTztvQkFDTCxRQUFRLEVBQUUsTUFBTSxJQUFBLG1CQUFRLEVBQUMsSUFBQSxnQkFBSSxFQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsYUFBYSxJQUFJLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ25GLE1BQU0sRUFBRSxNQUFNO2lCQUNmLENBQUM7WUFDSixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQWhFRCwwREFnRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBQbHVnaW4sIFBsdWdpbkJ1aWxkIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuXG4vKipcbiAqIFN5bWJvbCBtYXJrZXIgdXNlZCB0byBpbmRpY2F0ZSBDU1MgcmVzb3VyY2UgcmVzb2x1dGlvbiBpcyBiZWluZyBhdHRlbXB0ZWQuXG4gKiBUaGlzIGlzIHVzZWQgdG8gcHJldmVudCBhbiBpbmZpbml0ZSBsb29wIHdpdGhpbiB0aGUgcGx1Z2luJ3MgcmVzb2x2ZSBob29rLlxuICovXG5jb25zdCBDU1NfUkVTT1VSQ0VfUkVTT0xVVElPTiA9IFN5bWJvbCgnQ1NTX1JFU09VUkNFX1JFU09MVVRJT04nKTtcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGVzYnVpbGQge0BsaW5rIFBsdWdpbn0gdGhhdCBsb2FkcyBhbGwgQ1NTIHVybCB0b2tlbiByZWZlcmVuY2VzIHVzaW5nIHRoZVxuICogYnVpbHQtaW4gZXNidWlsZCBgZmlsZWAgbG9hZGVyLiBBIHBsdWdpbiBpcyB1c2VkIHRvIGFsbG93IGZvciBhbGwgZmlsZSBleHRlbnNpb25zXG4gKiBhbmQgdHlwZXMgdG8gYmUgc3VwcG9ydGVkIHdpdGhvdXQgbmVlZGluZyB0byBtYW51YWxseSBzcGVjaWZ5IGFsbCBleHRlbnNpb25zXG4gKiB3aXRoaW4gdGhlIGJ1aWxkIGNvbmZpZ3VyYXRpb24uXG4gKlxuICogQHJldHVybnMgQW4gZXNidWlsZCB7QGxpbmsgUGx1Z2lufSBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNzc1Jlc291cmNlUGx1Z2luKCk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItY3NzLXJlc291cmNlJyxcbiAgICBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiB2b2lkIHtcbiAgICAgIGJ1aWxkLm9uUmVzb2x2ZSh7IGZpbHRlcjogLy4qLyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAvLyBPbmx5IGF0dGVtcHQgdG8gcmVzb2x2ZSB1cmwgdG9rZW5zIHdoaWNoIG9ubHkgZXhpc3QgaW5zaWRlIENTUy5cbiAgICAgICAgLy8gQWxzbywgc2tpcCB0aGlzIHBsdWdpbiBpZiBhbHJlYWR5IGF0dGVtcHRpbmcgdG8gcmVzb2x2ZSB0aGUgdXJsLXRva2VuLlxuICAgICAgICBpZiAoYXJncy5raW5kICE9PSAndXJsLXRva2VuJyB8fCBhcmdzLnBsdWdpbkRhdGE/LltDU1NfUkVTT1VSQ0VfUkVTT0xVVElPTl0pIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHJvb3QtcmVsYXRpdmUsIGFic29sdXRlIG9yIHByb3RvY29sIHJlbGF0aXZlIHVybCwgbWFyayBhcyBleHRlcm5hbCB0byBsZWF2ZSB0aGVcbiAgICAgICAgLy8gcGF0aC9VUkwgaW4gcGxhY2UuXG4gICAgICAgIGlmICgvXigoPzpcXHcrOik/XFwvXFwvfGRhdGE6fGNocm9tZTp8I3xcXC8pLy50ZXN0KGFyZ3MucGF0aCkpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGF0aDogYXJncy5wYXRoLFxuICAgICAgICAgICAgZXh0ZXJuYWw6IHRydWUsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHsgaW1wb3J0ZXIsIGtpbmQsIHJlc29sdmVEaXIsIG5hbWVzcGFjZSwgcGx1Z2luRGF0YSA9IHt9IH0gPSBhcmdzO1xuICAgICAgICBwbHVnaW5EYXRhW0NTU19SRVNPVVJDRV9SRVNPTFVUSU9OXSA9IHRydWU7XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZShhcmdzLnBhdGgsIHtcbiAgICAgICAgICBpbXBvcnRlcixcbiAgICAgICAgICBraW5kLFxuICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICBwbHVnaW5EYXRhLFxuICAgICAgICAgIHJlc29sdmVEaXIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChyZXN1bHQuZXJyb3JzLmxlbmd0aCAmJiBhcmdzLnBhdGhbMF0gPT09ICd+Jykge1xuICAgICAgICAgIHJlc3VsdC5lcnJvcnNbMF0ubm90ZXMgPSBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGxvY2F0aW9uOiBudWxsLFxuICAgICAgICAgICAgICB0ZXh0OiAnWW91IGNhbiByZW1vdmUgdGhlIHRpbGRlIGFuZCB1c2UgYSByZWxhdGl2ZSBwYXRoIHRvIHJlZmVyZW5jZSBpdCwgd2hpY2ggc2hvdWxkIHJlbW92ZSB0aGlzIGVycm9yLicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXR1cm4gcmVzdWx0cyB0aGF0IGFyZSBub3QgZmlsZXMgc2luY2UgdGhlc2UgYXJlIG1vc3QgbGlrZWx5IHNwZWNpZmljIHRvIGFub3RoZXIgcGx1Z2luXG4gICAgICAgIC8vIGFuZCBjYW5ub3QgYmUgbG9hZGVkIGJ5IHRoaXMgcGx1Z2luLlxuICAgICAgICBpZiAocmVzdWx0Lm5hbWVzcGFjZSAhPT0gJ2ZpbGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFsbCBmaWxlIHJlc3VsdHMgYXJlIGNvbnNpZGVyZWQgQ1NTIHJlc291cmNlcyBhbmQgd2lsbCBiZSBsb2FkZWQgdmlhIHRoZSBmaWxlIGxvYWRlclxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIC4uLnJlc3VsdCxcbiAgICAgICAgICAvLyBVc2UgYSByZWxhdGl2ZSBwYXRoIHRvIHByZXZlbnQgZnVsbHkgcmVzb2x2ZWQgcGF0aHMgaW4gdGhlIG1ldGFmaWxlIChKU09OIHN0YXRzIGZpbGUpLlxuICAgICAgICAgIC8vIFRoaXMgaXMgb25seSBuZWNlc3NhcnkgZm9yIGN1c3RvbSBuYW1lc3BhY2VzLiBlc2J1aWxkIHdpbGwgaGFuZGxlIHRoZSBmaWxlIG5hbWVzcGFjZS5cbiAgICAgICAgICBwYXRoOiByZWxhdGl2ZShidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyID8/ICcnLCByZXN1bHQucGF0aCksXG4gICAgICAgICAgbmFtZXNwYWNlOiAnY3NzLXJlc291cmNlJyxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC8uKi8sIG5hbWVzcGFjZTogJ2Nzcy1yZXNvdXJjZScgfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50czogYXdhaXQgcmVhZEZpbGUoam9pbihidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyID8/ICcnLCBhcmdzLnBhdGgpKSxcbiAgICAgICAgICBsb2FkZXI6ICdmaWxlJyxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG4iXX0=