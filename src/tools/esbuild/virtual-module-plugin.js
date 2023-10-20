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
const load_result_cache_1 = require("./load-result-cache");
/**
 * Creates an esbuild plugin that generated virtual modules.
 *
 * @returns An esbuild plugin.
 */
function createVirtualModulePlugin(options) {
    const { namespace, external, transformPath: pathTransformer, loadContent, cache, entryPointOnly = true, } = options;
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
            build.onLoad({ filter: /./, namespace }, (0, load_result_cache_1.createCachedLoad)(cache, (args) => loadContent(args, build)));
        },
    };
}
exports.createVirtualModulePlugin = createVirtualModulePlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlydHVhbC1tb2R1bGUtcGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC92aXJ0dWFsLW1vZHVsZS1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBR0gsMkRBQXdFO0FBd0J4RTs7OztHQUlHO0FBQ0gsU0FBZ0IseUJBQXlCLENBQUMsT0FBbUM7SUFDM0UsTUFBTSxFQUNKLFNBQVMsRUFDVCxRQUFRLEVBQ1IsYUFBYSxFQUFFLGVBQWUsRUFDOUIsV0FBVyxFQUNYLEtBQUssRUFDTCxjQUFjLEdBQUcsSUFBSSxHQUN0QixHQUFHLE9BQU8sQ0FBQztJQUVaLE9BQU87UUFDTCxJQUFJLEVBQUUsU0FBUyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDO1FBQ3JDLEtBQUssQ0FBQyxLQUFLO1lBQ1QsS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLE1BQU0sQ0FBQyxHQUFHLEdBQUcsU0FBUyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUU7Z0JBQzFFLElBQUksY0FBYyxJQUFJLElBQUksS0FBSyxhQUFhLEVBQUU7b0JBQzVDLE9BQU8sSUFBSSxDQUFDO2lCQUNiO2dCQUVELE9BQU87b0JBQ0wsSUFBSSxFQUFFLGVBQWUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUk7b0JBQ3JDLFNBQVM7aUJBQ1YsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxRQUFRLEVBQUU7Z0JBQ1osS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUU7b0JBQ3ZELE9BQU87d0JBQ0wsSUFBSTt3QkFDSixRQUFRLEVBQUUsSUFBSTtxQkFDZixDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDO2FBQ0o7WUFFRCxLQUFLLENBQUMsTUFBTSxDQUNWLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsRUFDMUIsSUFBQSxvQ0FBZ0IsRUFBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FDNUQsQ0FBQztRQUNKLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQXZDRCw4REF1Q0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBPbkxvYWRBcmdzLCBQbHVnaW4sIFBsdWdpbkJ1aWxkIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBMb2FkUmVzdWx0Q2FjaGUsIGNyZWF0ZUNhY2hlZExvYWQgfSBmcm9tICcuL2xvYWQtcmVzdWx0LWNhY2hlJztcblxuLyoqXG4gKiBPcHRpb25zIGZvciB0aGUgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpblxuICogQHNlZSBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVmlydHVhbE1vZHVsZVBsdWdpbk9wdGlvbnMge1xuICAvKiogTmFtZXNwYWNlLiBFeGFtcGxlOiBgYW5ndWxhcjpwb2x5ZmlsbHNgLiAqL1xuICBuYW1lc3BhY2U6IHN0cmluZztcbiAgLyoqIElmIHRoZSBnZW5lcmF0ZWQgbW9kdWxlIHNob3VsZCBiZSBtYXJrZWQgYXMgZXh0ZXJuYWwuICovXG4gIGV4dGVybmFsPzogYm9vbGVhbjtcbiAgLyoqIE1ldGhvZCB0byB0cmFuc2Zvcm0gdGhlIG9uUmVzb2x2ZSBwYXRoLiAqL1xuICB0cmFuc2Zvcm1QYXRoPzogKHBhdGg6IHN0cmluZykgPT4gc3RyaW5nO1xuICAvKiogTWV0aG9kIHRvIHByb3ZpZGUgdGhlIG1vZHVsZSBjb250ZW50LiAqL1xuICBsb2FkQ29udGVudDogKFxuICAgIGFyZ3M6IE9uTG9hZEFyZ3MsXG4gICAgYnVpbGQ6IFBsdWdpbkJ1aWxkLFxuICApID0+IFJldHVyblR5cGU8UGFyYW1ldGVyczxQbHVnaW5CdWlsZFsnb25Mb2FkJ10+WzFdPjtcbiAgLyoqIFJlc3RyaWN0IHRvIG9ubHkgZW50cnkgcG9pbnRzLiBEZWZhdWx0cyB0byBgdHJ1ZWAuICovXG4gIGVudHJ5UG9pbnRPbmx5PzogYm9vbGVhbjtcbiAgLyoqIExvYWQgcmVzdWx0cyBjYWNoZS4gKi9cbiAgY2FjaGU/OiBMb2FkUmVzdWx0Q2FjaGU7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBlc2J1aWxkIHBsdWdpbiB0aGF0IGdlbmVyYXRlZCB2aXJ0dWFsIG1vZHVsZXMuXG4gKlxuICogQHJldHVybnMgQW4gZXNidWlsZCBwbHVnaW4uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luKG9wdGlvbnM6IFZpcnR1YWxNb2R1bGVQbHVnaW5PcHRpb25zKTogUGx1Z2luIHtcbiAgY29uc3Qge1xuICAgIG5hbWVzcGFjZSxcbiAgICBleHRlcm5hbCxcbiAgICB0cmFuc2Zvcm1QYXRoOiBwYXRoVHJhbnNmb3JtZXIsXG4gICAgbG9hZENvbnRlbnQsXG4gICAgY2FjaGUsXG4gICAgZW50cnlQb2ludE9ubHkgPSB0cnVlLFxuICB9ID0gb3B0aW9ucztcblxuICByZXR1cm4ge1xuICAgIG5hbWU6IG5hbWVzcGFjZS5yZXBsYWNlKC9bLzpdL2csICctJyksXG4gICAgc2V0dXAoYnVpbGQpOiB2b2lkIHtcbiAgICAgIGJ1aWxkLm9uUmVzb2x2ZSh7IGZpbHRlcjogbmV3IFJlZ0V4cCgnXicgKyBuYW1lc3BhY2UpIH0sICh7IGtpbmQsIHBhdGggfSkgPT4ge1xuICAgICAgICBpZiAoZW50cnlQb2ludE9ubHkgJiYga2luZCAhPT0gJ2VudHJ5LXBvaW50Jykge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBwYXRoOiBwYXRoVHJhbnNmb3JtZXI/LihwYXRoKSA/PyBwYXRoLFxuICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoZXh0ZXJuYWwpIHtcbiAgICAgICAgYnVpbGQub25SZXNvbHZlKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZSB9LCAoeyBwYXRoIH0pID0+IHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICAgIGV4dGVybmFsOiB0cnVlLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBidWlsZC5vbkxvYWQoXG4gICAgICAgIHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZSB9LFxuICAgICAgICBjcmVhdGVDYWNoZWRMb2FkKGNhY2hlLCAoYXJncykgPT4gbG9hZENvbnRlbnQoYXJncywgYnVpbGQpKSxcbiAgICAgICk7XG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==