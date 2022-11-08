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
const promises_1 = require("fs/promises");
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
                var _a;
                // Only attempt to resolve url tokens which only exist inside CSS.
                // Also, skip this plugin if already attempting to resolve the url-token.
                if (args.kind !== 'url-token' || ((_a = args.pluginData) === null || _a === void 0 ? void 0 : _a[CSS_RESOURCE_RESOLUTION])) {
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
                return {
                    ...result,
                    namespace: 'css-resource',
                };
            });
            build.onLoad({ filter: /.*/, namespace: 'css-resource' }, async (args) => {
                return {
                    contents: await (0, promises_1.readFile)(args.path),
                    loader: 'file',
                };
            });
        },
    };
}
exports.createCssResourcePlugin = createCssResourcePlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3NzLXJlc291cmNlLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9jc3MtcmVzb3VyY2UtcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILDBDQUF1QztBQUV2Qzs7O0dBR0c7QUFDSCxNQUFNLHVCQUF1QixHQUFHLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBRWxFOzs7Ozs7O0dBT0c7QUFDSCxTQUFnQix1QkFBdUI7SUFDckMsT0FBTztRQUNMLElBQUksRUFBRSxzQkFBc0I7UUFDNUIsS0FBSyxDQUFDLEtBQWtCO1lBQ3RCLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFOztnQkFDL0Msa0VBQWtFO2dCQUNsRSx5RUFBeUU7Z0JBQ3pFLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxXQUFXLEtBQUksTUFBQSxJQUFJLENBQUMsVUFBVSwwQ0FBRyx1QkFBdUIsQ0FBQyxDQUFBLEVBQUU7b0JBQzNFLE9BQU8sSUFBSSxDQUFDO2lCQUNiO2dCQUVELHFGQUFxRjtnQkFDckYscUJBQXFCO2dCQUNyQixJQUFJLHFDQUFxQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ3pELE9BQU87d0JBQ0wsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO3dCQUNmLFFBQVEsRUFBRSxJQUFJO3FCQUNmLENBQUM7aUJBQ0g7Z0JBRUQsTUFBTSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxVQUFVLEdBQUcsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDO2dCQUN4RSxVQUFVLENBQUMsdUJBQXVCLENBQUMsR0FBRyxJQUFJLENBQUM7Z0JBRTNDLE1BQU0sTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFO29CQUM1QyxRQUFRO29CQUNSLElBQUk7b0JBQ0osU0FBUztvQkFDVCxVQUFVO29CQUNWLFVBQVU7aUJBQ1gsQ0FBQyxDQUFDO2dCQUVILE9BQU87b0JBQ0wsR0FBRyxNQUFNO29CQUNULFNBQVMsRUFBRSxjQUFjO2lCQUMxQixDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7WUFFSCxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFO2dCQUN2RSxPQUFPO29CQUNMLFFBQVEsRUFBRSxNQUFNLElBQUEsbUJBQVEsRUFBQyxJQUFJLENBQUMsSUFBSSxDQUFDO29CQUNuQyxNQUFNLEVBQUUsTUFBTTtpQkFDZixDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUE3Q0QsMERBNkNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgUGx1Z2luLCBQbHVnaW5CdWlsZCB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdmcy9wcm9taXNlcyc7XG5cbi8qKlxuICogU3ltYm9sIG1hcmtlciB1c2VkIHRvIGluZGljYXRlIENTUyByZXNvdXJjZSByZXNvbHV0aW9uIGlzIGJlaW5nIGF0dGVtcHRlZC5cbiAqIFRoaXMgaXMgdXNlZCB0byBwcmV2ZW50IGFuIGluZmluaXRlIGxvb3Agd2l0aGluIHRoZSBwbHVnaW4ncyByZXNvbHZlIGhvb2suXG4gKi9cbmNvbnN0IENTU19SRVNPVVJDRV9SRVNPTFVUSU9OID0gU3ltYm9sKCdDU1NfUkVTT1VSQ0VfUkVTT0xVVElPTicpO1xuXG4vKipcbiAqIENyZWF0ZXMgYW4gZXNidWlsZCB7QGxpbmsgUGx1Z2lufSB0aGF0IGxvYWRzIGFsbCBDU1MgdXJsIHRva2VuIHJlZmVyZW5jZXMgdXNpbmcgdGhlXG4gKiBidWlsdC1pbiBlc2J1aWxkIGBmaWxlYCBsb2FkZXIuIEEgcGx1Z2luIGlzIHVzZWQgdG8gYWxsb3cgZm9yIGFsbCBmaWxlIGV4dGVuc2lvbnNcbiAqIGFuZCB0eXBlcyB0byBiZSBzdXBwb3J0ZWQgd2l0aG91dCBuZWVkaW5nIHRvIG1hbnVhbGx5IHNwZWNpZnkgYWxsIGV4dGVuc2lvbnNcbiAqIHdpdGhpbiB0aGUgYnVpbGQgY29uZmlndXJhdGlvbi5cbiAqXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIHtAbGluayBQbHVnaW59IGluc3RhbmNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ3NzUmVzb3VyY2VQbHVnaW4oKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1jc3MtcmVzb3VyY2UnLFxuICAgIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IHZvaWQge1xuICAgICAgYnVpbGQub25SZXNvbHZlKHsgZmlsdGVyOiAvLiovIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgIC8vIE9ubHkgYXR0ZW1wdCB0byByZXNvbHZlIHVybCB0b2tlbnMgd2hpY2ggb25seSBleGlzdCBpbnNpZGUgQ1NTLlxuICAgICAgICAvLyBBbHNvLCBza2lwIHRoaXMgcGx1Z2luIGlmIGFscmVhZHkgYXR0ZW1wdGluZyB0byByZXNvbHZlIHRoZSB1cmwtdG9rZW4uXG4gICAgICAgIGlmIChhcmdzLmtpbmQgIT09ICd1cmwtdG9rZW4nIHx8IGFyZ3MucGx1Z2luRGF0YT8uW0NTU19SRVNPVVJDRV9SRVNPTFVUSU9OXSkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgcm9vdC1yZWxhdGl2ZSwgYWJzb2x1dGUgb3IgcHJvdG9jb2wgcmVsYXRpdmUgdXJsLCBtYXJrIGFzIGV4dGVybmFsIHRvIGxlYXZlIHRoZVxuICAgICAgICAvLyBwYXRoL1VSTCBpbiBwbGFjZS5cbiAgICAgICAgaWYgKC9eKCg/Olxcdys6KT9cXC9cXC98ZGF0YTp8Y2hyb21lOnwjfFxcLykvLnRlc3QoYXJncy5wYXRoKSkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwYXRoOiBhcmdzLnBhdGgsXG4gICAgICAgICAgICBleHRlcm5hbDogdHJ1ZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyBpbXBvcnRlciwga2luZCwgcmVzb2x2ZURpciwgbmFtZXNwYWNlLCBwbHVnaW5EYXRhID0ge30gfSA9IGFyZ3M7XG4gICAgICAgIHBsdWdpbkRhdGFbQ1NTX1JFU09VUkNFX1JFU09MVVRJT05dID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBidWlsZC5yZXNvbHZlKGFyZ3MucGF0aCwge1xuICAgICAgICAgIGltcG9ydGVyLFxuICAgICAgICAgIGtpbmQsXG4gICAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICAgIHBsdWdpbkRhdGEsXG4gICAgICAgICAgcmVzb2x2ZURpcixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAuLi5yZXN1bHQsXG4gICAgICAgICAgbmFtZXNwYWNlOiAnY3NzLXJlc291cmNlJyxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC8uKi8sIG5hbWVzcGFjZTogJ2Nzcy1yZXNvdXJjZScgfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjb250ZW50czogYXdhaXQgcmVhZEZpbGUoYXJncy5wYXRoKSxcbiAgICAgICAgICBsb2FkZXI6ICdmaWxlJyxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG4iXX0=