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
    const { namespace, external, transformPath: pathTransformer, loadContent, entryPointOnly = true, } = options;
    return {
        name: namespace.replace(/[/:]/g, '-'),
        setup(build) {
            build.onResolve({ filter: new RegExp('^' + namespace) }, ({ kind, path }) => {
                if (entryPointOnly && kind !== 'entry-point') {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlydHVhbC1tb2R1bGUtcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC92aXJ0dWFsLW1vZHVsZS1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBd0JIOzs7O0dBSUc7QUFDSCxTQUFnQix5QkFBeUIsQ0FBQyxPQUFtQztJQUMzRSxNQUFNLEVBQ0osU0FBUyxFQUNULFFBQVEsRUFDUixhQUFhLEVBQUUsZUFBZSxFQUM5QixXQUFXLEVBQ1gsY0FBYyxHQUFHLElBQUksR0FDdEIsR0FBRyxPQUFPLENBQUM7SUFFWixPQUFPO1FBQ0wsSUFBSSxFQUFFLFNBQVMsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQztRQUNyQyxLQUFLLENBQUMsS0FBSztZQUNULEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxNQUFNLENBQUMsR0FBRyxHQUFHLFNBQVMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFO2dCQUMxRSxJQUFJLGNBQWMsSUFBSSxJQUFJLEtBQUssYUFBYSxFQUFFO29CQUM1QyxPQUFPLElBQUksQ0FBQztpQkFDYjtnQkFFRCxPQUFPO29CQUNMLElBQUksRUFBRSxlQUFlLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJO29CQUNyQyxTQUFTO2lCQUNWLENBQUM7WUFDSixDQUFDLENBQUMsQ0FBQztZQUVILElBQUksUUFBUSxFQUFFO2dCQUNaLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFO29CQUN2RCxPQUFPO3dCQUNMLElBQUk7d0JBQ0osUUFBUSxFQUFFLElBQUk7cUJBQ2YsQ0FBQztnQkFDSixDQUFDLENBQUMsQ0FBQzthQUNKO1lBRUQsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUMvRSxDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFuQ0QsOERBbUNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgT25Mb2FkQXJncywgUGx1Z2luLCBQbHVnaW5CdWlsZCB9IGZyb20gJ2VzYnVpbGQnO1xuXG4vKipcbiAqIE9wdGlvbnMgZm9yIHRoZSBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luXG4gKiBAc2VlIGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBWaXJ0dWFsTW9kdWxlUGx1Z2luT3B0aW9ucyB7XG4gIC8qKiBOYW1lc3BhY2UuIEV4YW1wbGU6IGBhbmd1bGFyOnBvbHlmaWxsc2AuICovXG4gIG5hbWVzcGFjZTogc3RyaW5nO1xuICAvKiogSWYgdGhlIGdlbmVyYXRlZCBtb2R1bGUgc2hvdWxkIGJlIG1hcmtlZCBhcyBleHRlcm5hbC4gKi9cbiAgZXh0ZXJuYWw/OiBib29sZWFuO1xuICAvKiogTWV0aG9kIHRvIHRyYW5zZm9ybSB0aGUgb25SZXNvbHZlIHBhdGguICovXG4gIHRyYW5zZm9ybVBhdGg/OiAocGF0aDogc3RyaW5nKSA9PiBzdHJpbmc7XG4gIC8qKiBNZXRob2QgdG8gcHJvdmlkZSB0aGUgbW9kdWxlIGNvbnRlbnQuICovXG4gIGxvYWRDb250ZW50OiAoXG4gICAgYXJnczogT25Mb2FkQXJncyxcbiAgICBidWlsZDogUGx1Z2luQnVpbGQsXG4gICkgPT4gUmV0dXJuVHlwZTxQYXJhbWV0ZXJzPFBsdWdpbkJ1aWxkWydvbkxvYWQnXT5bMV0+O1xuICAvKiogUmVzdHJpY3QgdG8gb25seSBlbnRyeSBwb2ludHMuIERlZmF1bHRzIHRvIGB0cnVlYC4gKi9cbiAgZW50cnlQb2ludE9ubHk/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gZXNidWlsZCBwbHVnaW4gdGhhdCBnZW5lcmF0ZWQgdmlydHVhbCBtb2R1bGVzLlxuICpcbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgcGx1Z2luLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbihvcHRpb25zOiBWaXJ0dWFsTW9kdWxlUGx1Z2luT3B0aW9ucyk6IFBsdWdpbiB7XG4gIGNvbnN0IHtcbiAgICBuYW1lc3BhY2UsXG4gICAgZXh0ZXJuYWwsXG4gICAgdHJhbnNmb3JtUGF0aDogcGF0aFRyYW5zZm9ybWVyLFxuICAgIGxvYWRDb250ZW50LFxuICAgIGVudHJ5UG9pbnRPbmx5ID0gdHJ1ZSxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBuYW1lc3BhY2UucmVwbGFjZSgvWy86XS9nLCAnLScpLFxuICAgIHNldHVwKGJ1aWxkKTogdm9pZCB7XG4gICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlKSB9LCAoeyBraW5kLCBwYXRoIH0pID0+IHtcbiAgICAgICAgaWYgKGVudHJ5UG9pbnRPbmx5ICYmIGtpbmQgIT09ICdlbnRyeS1wb2ludCcpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcGF0aDogcGF0aFRyYW5zZm9ybWVyPy4ocGF0aCkgPz8gcGF0aCxcbiAgICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgICAgaWYgKGV4dGVybmFsKSB7XG4gICAgICAgIGJ1aWxkLm9uUmVzb2x2ZSh7IGZpbHRlcjogLy4vLCBuYW1lc3BhY2UgfSwgKHsgcGF0aCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICBleHRlcm5hbDogdHJ1ZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZSB9LCAoYXJncykgPT4gbG9hZENvbnRlbnQoYXJncywgYnVpbGQpKTtcbiAgICB9LFxuICB9O1xufVxuIl19