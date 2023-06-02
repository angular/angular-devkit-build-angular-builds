"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVirtualModulePlugin = void 0;
/**
 * Creates an esbuild plugin that generated virtual modules.
 *
 * @returns An esbuild plugin.
 */
function createVirtualModulePlugin(options) {
    const { namespace, external, transformPath: pathTransformer, loadContent } = options;
    return {
        name: namespace.replace(/[/:]/g, '-'),
        setup(build) {
            build.onResolve({ filter: new RegExp('^' + namespace) }, ({ kind, path }) => {
                if (kind !== 'entry-point') {
                    return null;
                }
                return {
                    path: pathTransformer?.(path) ?? path,
                    namespace,
                };
            });
            if (external) {
                build.onResolve({ filter: /./, namespace }, ({ path }) => {
                    return {
                        path,
                        external: true,
                    };
                });
            }
            build.onLoad({ filter: /./, namespace }, (args) => loadContent(args, build));
        },
    };
}
exports.createVirtualModulePlugin = createVirtualModulePlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlydHVhbC1tb2R1bGUtcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL3ZpcnR1YWwtbW9kdWxlLXBsdWdpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFzQkg7Ozs7R0FJRztBQUNILFNBQWdCLHlCQUF5QixDQUFDLE9BQW1DO0lBQzNFLE1BQU0sRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsV0FBVyxFQUFFLEdBQUcsT0FBTyxDQUFDO0lBRXJGLE9BQU87UUFDTCxJQUFJLEVBQUUsU0FBUyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDO1FBQ3JDLEtBQUssQ0FBQyxLQUFLO1lBQ1QsS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLE1BQU0sQ0FBQyxHQUFHLEdBQUcsU0FBUyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUU7Z0JBQzFFLElBQUksSUFBSSxLQUFLLGFBQWEsRUFBRTtvQkFDMUIsT0FBTyxJQUFJLENBQUM7aUJBQ2I7Z0JBRUQsT0FBTztvQkFDTCxJQUFJLEVBQUUsZUFBZSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSTtvQkFDckMsU0FBUztpQkFDVixDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLFFBQVEsRUFBRTtnQkFDWixLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRTtvQkFDdkQsT0FBTzt3QkFDTCxJQUFJO3dCQUNKLFFBQVEsRUFBRSxJQUFJO3FCQUNmLENBQUM7Z0JBQ0osQ0FBQyxDQUFDLENBQUM7YUFDSjtZQUVELEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDL0UsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBN0JELDhEQTZCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE9uTG9hZEFyZ3MsIFBsdWdpbiwgUGx1Z2luQnVpbGQgfSBmcm9tICdlc2J1aWxkJztcblxuLyoqXG4gKiBPcHRpb25zIGZvciB0aGUgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpblxuICogQHNlZSBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVmlydHVhbE1vZHVsZVBsdWdpbk9wdGlvbnMge1xuICAvKiogTmFtZXNwYWNlLiBFeGFtcGxlOiBgYW5ndWxhcjpwb2x5ZmlsbHNgLiAqL1xuICBuYW1lc3BhY2U6IHN0cmluZztcbiAgLyoqIElmIHRoZSBnZW5lcmF0ZWQgbW9kdWxlIHNob3VsZCBiZSBtYXJrZWQgYXMgZXh0ZXJuYWwuICovXG4gIGV4dGVybmFsPzogYm9vbGVhbjtcbiAgLyoqIE1ldGhvZCB0byB0cmFuc2Zvcm0gdGhlIG9uUmVzb2x2ZSBwYXRoLiAqL1xuICB0cmFuc2Zvcm1QYXRoPzogKHBhdGg6IHN0cmluZykgPT4gc3RyaW5nO1xuICAvKiogTWV0aG9kIHRvIHByb3ZpZGUgdGhlIG1vZHVsZSBjb250ZW50LiAqL1xuICBsb2FkQ29udGVudDogKFxuICAgIGFyZ3M6IE9uTG9hZEFyZ3MsXG4gICAgYnVpbGQ6IFBsdWdpbkJ1aWxkLFxuICApID0+IFJldHVyblR5cGU8UGFyYW1ldGVyczxQbHVnaW5CdWlsZFsnb25Mb2FkJ10+WzFdPjtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGVzYnVpbGQgcGx1Z2luIHRoYXQgZ2VuZXJhdGVkIHZpcnR1YWwgbW9kdWxlcy5cbiAqXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIHBsdWdpbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW4ob3B0aW9uczogVmlydHVhbE1vZHVsZVBsdWdpbk9wdGlvbnMpOiBQbHVnaW4ge1xuICBjb25zdCB7IG5hbWVzcGFjZSwgZXh0ZXJuYWwsIHRyYW5zZm9ybVBhdGg6IHBhdGhUcmFuc2Zvcm1lciwgbG9hZENvbnRlbnQgfSA9IG9wdGlvbnM7XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBuYW1lc3BhY2UucmVwbGFjZSgvWy86XS9nLCAnLScpLFxuICAgIHNldHVwKGJ1aWxkKTogdm9pZCB7XG4gICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlKSB9LCAoeyBraW5kLCBwYXRoIH0pID0+IHtcbiAgICAgICAgaWYgKGtpbmQgIT09ICdlbnRyeS1wb2ludCcpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcGF0aDogcGF0aFRyYW5zZm9ybWVyPy4ocGF0aCkgPz8gcGF0aCxcbiAgICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgICAgaWYgKGV4dGVybmFsKSB7XG4gICAgICAgIGJ1aWxkLm9uUmVzb2x2ZSh7IGZpbHRlcjogLy4vLCBuYW1lc3BhY2UgfSwgKHsgcGF0aCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICBleHRlcm5hbDogdHJ1ZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZSB9LCAoYXJncykgPT4gbG9hZENvbnRlbnQoYXJncywgYnVpbGQpKTtcbiAgICB9LFxuICB9O1xufVxuIl19