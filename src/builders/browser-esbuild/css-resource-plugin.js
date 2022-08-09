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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3NzLXJlc291cmNlLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9jc3MtcmVzb3VyY2UtcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUdILDBDQUF1QztBQUV2Qzs7O0dBR0c7QUFDSCxNQUFNLHVCQUF1QixHQUFHLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBRWxFOzs7Ozs7O0dBT0c7QUFDSCxTQUFnQix1QkFBdUI7SUFDckMsT0FBTztRQUNMLElBQUksRUFBRSxzQkFBc0I7UUFDNUIsS0FBSyxDQUFDLEtBQWtCO1lBQ3RCLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFOztnQkFDL0Msa0VBQWtFO2dCQUNsRSx5RUFBeUU7Z0JBQ3pFLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxXQUFXLEtBQUksTUFBQSxJQUFJLENBQUMsVUFBVSwwQ0FBRyx1QkFBdUIsQ0FBQyxDQUFBLEVBQUU7b0JBQzNFLE9BQU8sSUFBSSxDQUFDO2lCQUNiO2dCQUVELE1BQU0sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsVUFBVSxHQUFHLEVBQUUsRUFBRSxHQUFHLElBQUksQ0FBQztnQkFDeEUsVUFBVSxDQUFDLHVCQUF1QixDQUFDLEdBQUcsSUFBSSxDQUFDO2dCQUUzQyxNQUFNLE1BQU0sR0FBRyxNQUFNLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRTtvQkFDNUMsUUFBUTtvQkFDUixJQUFJO29CQUNKLFNBQVM7b0JBQ1QsVUFBVTtvQkFDVixVQUFVO2lCQUNYLENBQUMsQ0FBQztnQkFFSCxPQUFPO29CQUNMLEdBQUcsTUFBTTtvQkFDVCxTQUFTLEVBQUUsY0FBYztpQkFDMUIsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDO1lBRUgsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtnQkFDdkUsT0FBTztvQkFDTCxRQUFRLEVBQUUsTUFBTSxJQUFBLG1CQUFRLEVBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztvQkFDbkMsTUFBTSxFQUFFLE1BQU07aUJBQ2YsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBcENELDBEQW9DQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IFBsdWdpbiwgUGx1Z2luQnVpbGQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnZnMvcHJvbWlzZXMnO1xuXG4vKipcbiAqIFN5bWJvbCBtYXJrZXIgdXNlZCB0byBpbmRpY2F0ZSBDU1MgcmVzb3VyY2UgcmVzb2x1dGlvbiBpcyBiZWluZyBhdHRlbXB0ZWQuXG4gKiBUaGlzIGlzIHVzZWQgdG8gcHJldmVudCBhbiBpbmZpbml0ZSBsb29wIHdpdGhpbiB0aGUgcGx1Z2luJ3MgcmVzb2x2ZSBob29rLlxuICovXG5jb25zdCBDU1NfUkVTT1VSQ0VfUkVTT0xVVElPTiA9IFN5bWJvbCgnQ1NTX1JFU09VUkNFX1JFU09MVVRJT04nKTtcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGVzYnVpbGQge0BsaW5rIFBsdWdpbn0gdGhhdCBsb2FkcyBhbGwgQ1NTIHVybCB0b2tlbiByZWZlcmVuY2VzIHVzaW5nIHRoZVxuICogYnVpbHQtaW4gZXNidWlsZCBgZmlsZWAgbG9hZGVyLiBBIHBsdWdpbiBpcyB1c2VkIHRvIGFsbG93IGZvciBhbGwgZmlsZSBleHRlbnNpb25zXG4gKiBhbmQgdHlwZXMgdG8gYmUgc3VwcG9ydGVkIHdpdGhvdXQgbmVlZGluZyB0byBtYW51YWxseSBzcGVjaWZ5IGFsbCBleHRlbnNpb25zXG4gKiB3aXRoaW4gdGhlIGJ1aWxkIGNvbmZpZ3VyYXRpb24uXG4gKlxuICogQHJldHVybnMgQW4gZXNidWlsZCB7QGxpbmsgUGx1Z2lufSBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNzc1Jlc291cmNlUGx1Z2luKCk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2FuZ3VsYXItY3NzLXJlc291cmNlJyxcbiAgICBzZXR1cChidWlsZDogUGx1Z2luQnVpbGQpOiB2b2lkIHtcbiAgICAgIGJ1aWxkLm9uUmVzb2x2ZSh7IGZpbHRlcjogLy4qLyB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAvLyBPbmx5IGF0dGVtcHQgdG8gcmVzb2x2ZSB1cmwgdG9rZW5zIHdoaWNoIG9ubHkgZXhpc3QgaW5zaWRlIENTUy5cbiAgICAgICAgLy8gQWxzbywgc2tpcCB0aGlzIHBsdWdpbiBpZiBhbHJlYWR5IGF0dGVtcHRpbmcgdG8gcmVzb2x2ZSB0aGUgdXJsLXRva2VuLlxuICAgICAgICBpZiAoYXJncy5raW5kICE9PSAndXJsLXRva2VuJyB8fCBhcmdzLnBsdWdpbkRhdGE/LltDU1NfUkVTT1VSQ0VfUkVTT0xVVElPTl0pIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHsgaW1wb3J0ZXIsIGtpbmQsIHJlc29sdmVEaXIsIG5hbWVzcGFjZSwgcGx1Z2luRGF0YSA9IHt9IH0gPSBhcmdzO1xuICAgICAgICBwbHVnaW5EYXRhW0NTU19SRVNPVVJDRV9SRVNPTFVUSU9OXSA9IHRydWU7XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZShhcmdzLnBhdGgsIHtcbiAgICAgICAgICBpbXBvcnRlcixcbiAgICAgICAgICBraW5kLFxuICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICBwbHVnaW5EYXRhLFxuICAgICAgICAgIHJlc29sdmVEaXIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgLi4ucmVzdWx0LFxuICAgICAgICAgIG5hbWVzcGFjZTogJ2Nzcy1yZXNvdXJjZScsXG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvLiovLCBuYW1lc3BhY2U6ICdjc3MtcmVzb3VyY2UnIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgY29udGVudHM6IGF3YWl0IHJlYWRGaWxlKGFyZ3MucGF0aCksXG4gICAgICAgICAgbG9hZGVyOiAnZmlsZScsXG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuIl19