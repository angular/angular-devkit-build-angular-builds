"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJavaScriptTransformerPlugin = void 0;
const javascript_transformer_1 = require("./javascript-transformer");
/**
 * Creates a plugin that Transformers JavaScript using Babel.
 *
 * @returns An esbuild plugin.
 */
function createJavaScriptTransformerPlugin(options) {
    return {
        name: 'angular-javascript-transformer',
        setup(build) {
            let javascriptTransformer;
            const { sourcemap, thirdPartySourcemaps, advancedOptimizations, jit, babelFileCache, maxWorkers, } = options;
            build.onLoad({ filter: /\.[cm]?js$/ }, async (args) => {
                // The filename is currently used as a cache key. Since the cache is memory only,
                // the options cannot change and do not need to be represented in the key. If the
                // cache is later stored to disk, then the options that affect transform output
                // would need to be added to the key as well as a check for any change of content.
                let contents = babelFileCache?.get(args.path);
                if (contents === undefined) {
                    // Initialize a worker pool for JavaScript transformations
                    javascriptTransformer ??= new javascript_transformer_1.JavaScriptTransformer({
                        sourcemap,
                        thirdPartySourcemaps,
                        advancedOptimizations,
                        jit,
                    }, maxWorkers);
                    contents = await javascriptTransformer.transformFile(args.path, jit);
                    babelFileCache?.set(args.path, contents);
                }
                return {
                    contents,
                    loader: 'js',
                };
            });
            build.onDispose(() => {
                void javascriptTransformer?.close();
            });
        },
    };
}
exports.createJavaScriptTransformerPlugin = createJavaScriptTransformerPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC10cmFuc2ZvbWVyLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvamF2YXNjcmlwdC10cmFuc2ZvbWVyLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFHSCxxRUFBK0Y7QUFPL0Y7Ozs7R0FJRztBQUNILFNBQWdCLGlDQUFpQyxDQUMvQyxPQUEyQztJQUUzQyxPQUFPO1FBQ0wsSUFBSSxFQUFFLGdDQUFnQztRQUN0QyxLQUFLLENBQUMsS0FBSztZQUNULElBQUkscUJBQXdELENBQUM7WUFDN0QsTUFBTSxFQUNKLFNBQVMsRUFDVCxvQkFBb0IsRUFDcEIscUJBQXFCLEVBQ3JCLEdBQUcsRUFDSCxjQUFjLEVBQ2QsVUFBVSxHQUNYLEdBQUcsT0FBTyxDQUFDO1lBRVosS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7Z0JBQ3BELGlGQUFpRjtnQkFDakYsaUZBQWlGO2dCQUNqRiwrRUFBK0U7Z0JBQy9FLGtGQUFrRjtnQkFDbEYsSUFBSSxRQUFRLEdBQUcsY0FBYyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzlDLElBQUksUUFBUSxLQUFLLFNBQVMsRUFBRTtvQkFDMUIsMERBQTBEO29CQUMxRCxxQkFBcUIsS0FBSyxJQUFJLDhDQUFxQixDQUNqRDt3QkFDRSxTQUFTO3dCQUNULG9CQUFvQjt3QkFDcEIscUJBQXFCO3dCQUNyQixHQUFHO3FCQUNKLEVBQ0QsVUFBVSxDQUNYLENBQUM7b0JBRUYsUUFBUSxHQUFHLE1BQU0scUJBQXFCLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7b0JBQ3JFLGNBQWMsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztpQkFDMUM7Z0JBRUQsT0FBTztvQkFDTCxRQUFRO29CQUNSLE1BQU0sRUFBRSxJQUFJO2lCQUNiLENBQUM7WUFDSixDQUFDLENBQUMsQ0FBQztZQUVILEtBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFO2dCQUNuQixLQUFLLHFCQUFxQixFQUFFLEtBQUssRUFBRSxDQUFDO1lBQ3RDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBakRELDhFQWlEQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IFBsdWdpbiB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgSmF2YVNjcmlwdFRyYW5zZm9ybWVyLCBKYXZhU2NyaXB0VHJhbnNmb3JtZXJPcHRpb25zIH0gZnJvbSAnLi9qYXZhc2NyaXB0LXRyYW5zZm9ybWVyJztcblxuZXhwb3J0IGludGVyZmFjZSBKYXZhU2NyaXB0VHJhbnNmb3JtZXJQbHVnaW5PcHRpb25zIGV4dGVuZHMgSmF2YVNjcmlwdFRyYW5zZm9ybWVyT3B0aW9ucyB7XG4gIGJhYmVsRmlsZUNhY2hlPzogTWFwPHN0cmluZywgVWludDhBcnJheT47XG4gIG1heFdvcmtlcnM6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgcGx1Z2luIHRoYXQgVHJhbnNmb3JtZXJzIEphdmFTY3JpcHQgdXNpbmcgQmFiZWwuXG4gKlxuICogQHJldHVybnMgQW4gZXNidWlsZCBwbHVnaW4uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVKYXZhU2NyaXB0VHJhbnNmb3JtZXJQbHVnaW4oXG4gIG9wdGlvbnM6IEphdmFTY3JpcHRUcmFuc2Zvcm1lclBsdWdpbk9wdGlvbnMsXG4pOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdhbmd1bGFyLWphdmFzY3JpcHQtdHJhbnNmb3JtZXInLFxuICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICBsZXQgamF2YXNjcmlwdFRyYW5zZm9ybWVyOiBKYXZhU2NyaXB0VHJhbnNmb3JtZXIgfCB1bmRlZmluZWQ7XG4gICAgICBjb25zdCB7XG4gICAgICAgIHNvdXJjZW1hcCxcbiAgICAgICAgdGhpcmRQYXJ0eVNvdXJjZW1hcHMsXG4gICAgICAgIGFkdmFuY2VkT3B0aW1pemF0aW9ucyxcbiAgICAgICAgaml0LFxuICAgICAgICBiYWJlbEZpbGVDYWNoZSxcbiAgICAgICAgbWF4V29ya2VycyxcbiAgICAgIH0gPSBvcHRpb25zO1xuXG4gICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC9cXC5bY21dP2pzJC8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgLy8gVGhlIGZpbGVuYW1lIGlzIGN1cnJlbnRseSB1c2VkIGFzIGEgY2FjaGUga2V5LiBTaW5jZSB0aGUgY2FjaGUgaXMgbWVtb3J5IG9ubHksXG4gICAgICAgIC8vIHRoZSBvcHRpb25zIGNhbm5vdCBjaGFuZ2UgYW5kIGRvIG5vdCBuZWVkIHRvIGJlIHJlcHJlc2VudGVkIGluIHRoZSBrZXkuIElmIHRoZVxuICAgICAgICAvLyBjYWNoZSBpcyBsYXRlciBzdG9yZWQgdG8gZGlzaywgdGhlbiB0aGUgb3B0aW9ucyB0aGF0IGFmZmVjdCB0cmFuc2Zvcm0gb3V0cHV0XG4gICAgICAgIC8vIHdvdWxkIG5lZWQgdG8gYmUgYWRkZWQgdG8gdGhlIGtleSBhcyB3ZWxsIGFzIGEgY2hlY2sgZm9yIGFueSBjaGFuZ2Ugb2YgY29udGVudC5cbiAgICAgICAgbGV0IGNvbnRlbnRzID0gYmFiZWxGaWxlQ2FjaGU/LmdldChhcmdzLnBhdGgpO1xuICAgICAgICBpZiAoY29udGVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIEluaXRpYWxpemUgYSB3b3JrZXIgcG9vbCBmb3IgSmF2YVNjcmlwdCB0cmFuc2Zvcm1hdGlvbnNcbiAgICAgICAgICBqYXZhc2NyaXB0VHJhbnNmb3JtZXIgPz89IG5ldyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIoXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHNvdXJjZW1hcCxcbiAgICAgICAgICAgICAgdGhpcmRQYXJ0eVNvdXJjZW1hcHMsXG4gICAgICAgICAgICAgIGFkdmFuY2VkT3B0aW1pemF0aW9ucyxcbiAgICAgICAgICAgICAgaml0LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG1heFdvcmtlcnMsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGNvbnRlbnRzID0gYXdhaXQgamF2YXNjcmlwdFRyYW5zZm9ybWVyLnRyYW5zZm9ybUZpbGUoYXJncy5wYXRoLCBqaXQpO1xuICAgICAgICAgIGJhYmVsRmlsZUNhY2hlPy5zZXQoYXJncy5wYXRoLCBjb250ZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuXG4gICAgICBidWlsZC5vbkRpc3Bvc2UoKCkgPT4ge1xuICAgICAgICB2b2lkIGphdmFzY3JpcHRUcmFuc2Zvcm1lcj8uY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG4iXX0=