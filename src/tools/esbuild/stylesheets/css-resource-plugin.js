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
                if (result.errors.length) {
                    const error = result.errors[0];
                    if (args.path[0] === '~') {
                        error.notes = [
                            {
                                location: null,
                                text: 'You can remove the tilde and use a relative path to reference it, which should remove this error.',
                            },
                        ];
                    }
                    else if (args.path[0] === '^') {
                        error.notes = [
                            {
                                location: null,
                                text: 'You can remove the caret and add the path to the `externalDependencies` build option,' +
                                    ' which should remove this error.',
                            },
                        ];
                    }
                    const extension = importer && (0, node_path_1.extname)(importer);
                    if (extension !== '.css') {
                        error.notes.push({
                            location: null,
                            text: 'Preprocessor stylesheets may not show the exact file location of the error.',
                        });
                    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3NzLXJlc291cmNlLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvc3R5bGVzaGVldHMvY3NzLXJlc291cmNlLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFHSCwrQ0FBNEM7QUFDNUMseUNBQW9EO0FBQ3BELDREQUF5RTtBQUV6RTs7O0dBR0c7QUFDSCxNQUFNLHVCQUF1QixHQUFHLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBRWxFOzs7Ozs7O0dBT0c7QUFDSCxTQUFnQix1QkFBdUIsQ0FBQyxLQUF1QjtJQUM3RCxPQUFPO1FBQ0wsSUFBSSxFQUFFLHNCQUFzQjtRQUM1QixLQUFLLENBQUMsS0FBa0I7WUFDdEIsS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7Z0JBQy9DLGtFQUFrRTtnQkFDbEUseUVBQXlFO2dCQUN6RSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssV0FBVyxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFO29CQUMzRSxPQUFPLElBQUksQ0FBQztpQkFDYjtnQkFFRCxxRkFBcUY7Z0JBQ3JGLHFCQUFxQjtnQkFDckIsSUFBSSxxQ0FBcUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUN6RCxPQUFPO3dCQUNMLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTt3QkFDZixRQUFRLEVBQUUsSUFBSTtxQkFDZixDQUFDO2lCQUNIO2dCQUVELE1BQU0sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsVUFBVSxHQUFHLEVBQUUsRUFBRSxHQUFHLElBQUksQ0FBQztnQkFDeEUsVUFBVSxDQUFDLHVCQUF1QixDQUFDLEdBQUcsSUFBSSxDQUFDO2dCQUUzQyxNQUFNLE1BQU0sR0FBRyxNQUFNLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRTtvQkFDNUMsUUFBUTtvQkFDUixJQUFJO29CQUNKLFNBQVM7b0JBQ1QsVUFBVTtvQkFDVixVQUFVO2lCQUNYLENBQUMsQ0FBQztnQkFFSCxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO29CQUN4QixNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUMvQixJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO3dCQUN4QixLQUFLLENBQUMsS0FBSyxHQUFHOzRCQUNaO2dDQUNFLFFBQVEsRUFBRSxJQUFJO2dDQUNkLElBQUksRUFBRSxtR0FBbUc7NkJBQzFHO3lCQUNGLENBQUM7cUJBQ0g7eUJBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTt3QkFDL0IsS0FBSyxDQUFDLEtBQUssR0FBRzs0QkFDWjtnQ0FDRSxRQUFRLEVBQUUsSUFBSTtnQ0FDZCxJQUFJLEVBQ0YsdUZBQXVGO29DQUN2RixrQ0FBa0M7NkJBQ3JDO3lCQUNGLENBQUM7cUJBQ0g7b0JBRUQsTUFBTSxTQUFTLEdBQUcsUUFBUSxJQUFJLElBQUEsbUJBQU8sRUFBQyxRQUFRLENBQUMsQ0FBQztvQkFDaEQsSUFBSSxTQUFTLEtBQUssTUFBTSxFQUFFO3dCQUN4QixLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQzs0QkFDZixRQUFRLEVBQUUsSUFBSTs0QkFDZCxJQUFJLEVBQUUsNkVBQTZFO3lCQUNwRixDQUFDLENBQUM7cUJBQ0o7aUJBQ0Y7Z0JBRUQsMkZBQTJGO2dCQUMzRix1Q0FBdUM7Z0JBQ3ZDLElBQUksTUFBTSxDQUFDLFNBQVMsS0FBSyxNQUFNLEVBQUU7b0JBQy9CLE9BQU8sTUFBTSxDQUFDO2lCQUNmO2dCQUVELHVGQUF1RjtnQkFDdkYsT0FBTztvQkFDTCxHQUFHLE1BQU07b0JBQ1QseUZBQXlGO29CQUN6Rix3RkFBd0Y7b0JBQ3hGLElBQUksRUFBRSxJQUFBLG9CQUFRLEVBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxhQUFhLElBQUksRUFBRSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUM7b0JBQ3JFLFNBQVMsRUFBRSxjQUFjO2lCQUMxQixDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7WUFFSCxLQUFLLENBQUMsTUFBTSxDQUNWLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFFLEVBQzFDLElBQUEsb0NBQWdCLEVBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtnQkFDckMsTUFBTSxZQUFZLEdBQUcsSUFBQSxnQkFBSSxFQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsYUFBYSxJQUFJLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBRS9FLE9BQU87b0JBQ0wsUUFBUSxFQUFFLE1BQU0sSUFBQSxtQkFBUSxFQUFDLFlBQVksQ0FBQztvQkFDdEMsTUFBTSxFQUFFLE1BQU07b0JBQ2QsVUFBVSxFQUFFLENBQUMsWUFBWSxDQUFDO2lCQUMzQixDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQ0gsQ0FBQztRQUNKLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQTFGRCwwREEwRkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBQbHVnaW4sIFBsdWdpbkJ1aWxkIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgTG9hZFJlc3VsdENhY2hlLCBjcmVhdGVDYWNoZWRMb2FkIH0gZnJvbSAnLi4vbG9hZC1yZXN1bHQtY2FjaGUnO1xuXG4vKipcbiAqIFN5bWJvbCBtYXJrZXIgdXNlZCB0byBpbmRpY2F0ZSBDU1MgcmVzb3VyY2UgcmVzb2x1dGlvbiBpcyBiZWluZyBhdHRlbXB0ZWQuXG4gKiBUaGlzIGlzIHVzZWQgdG8gcHJldmVudCBhbiBpbmZpbml0ZSBsb29wIHdpdGhpbiB0aGUgcGx1Z2luJ3MgcmVzb2x2ZSBob29rLlxuICovXG5jb25zdCBDU1NfUkVTT1VSQ0VfUkVTT0xVVElPTiA9IFN5bWJvbCgnQ1NTX1JFU09VUkNFX1JFU09MVVRJT04nKTtcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGVzYnVpbGQge0BsaW5rIFBsdWdpbn0gdGhhdCBsb2FkcyBhbGwgQ1NTIHVybCB0b2tlbiByZWZlcmVuY2VzIHVzaW5nIHRoZVxuICogYnVpbHQtaW4gZXNidWlsZCBgZmlsZWAgbG9hZGVyLiBBIHBsdWdpbiBpcyB1c2VkIHRvIGFsbG93IGZvciBhbGwgZmlsZSBleHRlbnNpb25zXG4gKiBhbmQgdHlwZXMgdG8gYmUgc3VwcG9ydGVkIHdpdGhvdXQgbmVlZGluZyB0byBtYW51YWxseSBzcGVjaWZ5IGFsbCBleHRlbnNpb25zXG4gKiB3aXRoaW4gdGhlIGJ1aWxkIGNvbmZpZ3VyYXRpb24uXG4gKlxuICogQHJldHVybnMgQW4gZXNidWlsZCB7QGxpbmsgUGx1Z2lufSBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNzc1Jlc291cmNlUGx1Z2luKGNhY2hlPzogTG9hZFJlc3VsdENhY2hlKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1jc3MtcmVzb3VyY2UnLFxuICAgIHNldHVwKGJ1aWxkOiBQbHVnaW5CdWlsZCk6IHZvaWQge1xuICAgICAgYnVpbGQub25SZXNvbHZlKHsgZmlsdGVyOiAvLiovIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgIC8vIE9ubHkgYXR0ZW1wdCB0byByZXNvbHZlIHVybCB0b2tlbnMgd2hpY2ggb25seSBleGlzdCBpbnNpZGUgQ1NTLlxuICAgICAgICAvLyBBbHNvLCBza2lwIHRoaXMgcGx1Z2luIGlmIGFscmVhZHkgYXR0ZW1wdGluZyB0byByZXNvbHZlIHRoZSB1cmwtdG9rZW4uXG4gICAgICAgIGlmIChhcmdzLmtpbmQgIT09ICd1cmwtdG9rZW4nIHx8IGFyZ3MucGx1Z2luRGF0YT8uW0NTU19SRVNPVVJDRV9SRVNPTFVUSU9OXSkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgcm9vdC1yZWxhdGl2ZSwgYWJzb2x1dGUgb3IgcHJvdG9jb2wgcmVsYXRpdmUgdXJsLCBtYXJrIGFzIGV4dGVybmFsIHRvIGxlYXZlIHRoZVxuICAgICAgICAvLyBwYXRoL1VSTCBpbiBwbGFjZS5cbiAgICAgICAgaWYgKC9eKCg/Olxcdys6KT9cXC9cXC98ZGF0YTp8Y2hyb21lOnwjfFxcLykvLnRlc3QoYXJncy5wYXRoKSkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwYXRoOiBhcmdzLnBhdGgsXG4gICAgICAgICAgICBleHRlcm5hbDogdHJ1ZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyBpbXBvcnRlciwga2luZCwgcmVzb2x2ZURpciwgbmFtZXNwYWNlLCBwbHVnaW5EYXRhID0ge30gfSA9IGFyZ3M7XG4gICAgICAgIHBsdWdpbkRhdGFbQ1NTX1JFU09VUkNFX1JFU09MVVRJT05dID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBidWlsZC5yZXNvbHZlKGFyZ3MucGF0aCwge1xuICAgICAgICAgIGltcG9ydGVyLFxuICAgICAgICAgIGtpbmQsXG4gICAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICAgIHBsdWdpbkRhdGEsXG4gICAgICAgICAgcmVzb2x2ZURpcixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHJlc3VsdC5lcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSByZXN1bHQuZXJyb3JzWzBdO1xuICAgICAgICAgIGlmIChhcmdzLnBhdGhbMF0gPT09ICd+Jykge1xuICAgICAgICAgICAgZXJyb3Iubm90ZXMgPSBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBsb2NhdGlvbjogbnVsbCxcbiAgICAgICAgICAgICAgICB0ZXh0OiAnWW91IGNhbiByZW1vdmUgdGhlIHRpbGRlIGFuZCB1c2UgYSByZWxhdGl2ZSBwYXRoIHRvIHJlZmVyZW5jZSBpdCwgd2hpY2ggc2hvdWxkIHJlbW92ZSB0aGlzIGVycm9yLicsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdO1xuICAgICAgICAgIH0gZWxzZSBpZiAoYXJncy5wYXRoWzBdID09PSAnXicpIHtcbiAgICAgICAgICAgIGVycm9yLm5vdGVzID0gW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbG9jYXRpb246IG51bGwsXG4gICAgICAgICAgICAgICAgdGV4dDpcbiAgICAgICAgICAgICAgICAgICdZb3UgY2FuIHJlbW92ZSB0aGUgY2FyZXQgYW5kIGFkZCB0aGUgcGF0aCB0byB0aGUgYGV4dGVybmFsRGVwZW5kZW5jaWVzYCBidWlsZCBvcHRpb24sJyArXG4gICAgICAgICAgICAgICAgICAnIHdoaWNoIHNob3VsZCByZW1vdmUgdGhpcyBlcnJvci4nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBleHRlbnNpb24gPSBpbXBvcnRlciAmJiBleHRuYW1lKGltcG9ydGVyKTtcbiAgICAgICAgICBpZiAoZXh0ZW5zaW9uICE9PSAnLmNzcycpIHtcbiAgICAgICAgICAgIGVycm9yLm5vdGVzLnB1c2goe1xuICAgICAgICAgICAgICBsb2NhdGlvbjogbnVsbCxcbiAgICAgICAgICAgICAgdGV4dDogJ1ByZXByb2Nlc3NvciBzdHlsZXNoZWV0cyBtYXkgbm90IHNob3cgdGhlIGV4YWN0IGZpbGUgbG9jYXRpb24gb2YgdGhlIGVycm9yLicsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXR1cm4gcmVzdWx0cyB0aGF0IGFyZSBub3QgZmlsZXMgc2luY2UgdGhlc2UgYXJlIG1vc3QgbGlrZWx5IHNwZWNpZmljIHRvIGFub3RoZXIgcGx1Z2luXG4gICAgICAgIC8vIGFuZCBjYW5ub3QgYmUgbG9hZGVkIGJ5IHRoaXMgcGx1Z2luLlxuICAgICAgICBpZiAocmVzdWx0Lm5hbWVzcGFjZSAhPT0gJ2ZpbGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFsbCBmaWxlIHJlc3VsdHMgYXJlIGNvbnNpZGVyZWQgQ1NTIHJlc291cmNlcyBhbmQgd2lsbCBiZSBsb2FkZWQgdmlhIHRoZSBmaWxlIGxvYWRlclxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIC4uLnJlc3VsdCxcbiAgICAgICAgICAvLyBVc2UgYSByZWxhdGl2ZSBwYXRoIHRvIHByZXZlbnQgZnVsbHkgcmVzb2x2ZWQgcGF0aHMgaW4gdGhlIG1ldGFmaWxlIChKU09OIHN0YXRzIGZpbGUpLlxuICAgICAgICAgIC8vIFRoaXMgaXMgb25seSBuZWNlc3NhcnkgZm9yIGN1c3RvbSBuYW1lc3BhY2VzLiBlc2J1aWxkIHdpbGwgaGFuZGxlIHRoZSBmaWxlIG5hbWVzcGFjZS5cbiAgICAgICAgICBwYXRoOiByZWxhdGl2ZShidWlsZC5pbml0aWFsT3B0aW9ucy5hYnNXb3JraW5nRGlyID8/ICcnLCByZXN1bHQucGF0aCksXG4gICAgICAgICAgbmFtZXNwYWNlOiAnY3NzLXJlc291cmNlJyxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkxvYWQoXG4gICAgICAgIHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZTogJ2Nzcy1yZXNvdXJjZScgfSxcbiAgICAgICAgY3JlYXRlQ2FjaGVkTG9hZChjYWNoZSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgICBjb25zdCByZXNvdXJjZVBhdGggPSBqb2luKGJ1aWxkLmluaXRpYWxPcHRpb25zLmFic1dvcmtpbmdEaXIgPz8gJycsIGFyZ3MucGF0aCk7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29udGVudHM6IGF3YWl0IHJlYWRGaWxlKHJlc291cmNlUGF0aCksXG4gICAgICAgICAgICBsb2FkZXI6ICdmaWxlJyxcbiAgICAgICAgICAgIHdhdGNoRmlsZXM6IFtyZXNvdXJjZVBhdGhdLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9LFxuICB9O1xufVxuIl19