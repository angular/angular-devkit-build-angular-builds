"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRxjsEsmResolutionPlugin = void 0;
const RXJS_ESM_RESOLUTION = Symbol('RXJS_ESM_RESOLUTION');
/**
 * Creates a plugin that forces ESM resolution of rxjs.
 * This is needed as when targeting node, the CJS version is used to the current package conditional exports.
 * @see: https://github.com/ReactiveX/rxjs/blob/2947583bb33e97f3db9e6d9f6cea70c62a173060/package.json#L19.
 *
 * NOTE: This can be removed when and if rxjs adds an import condition that allows ESM usage on Node.js.
 *
 * @returns An esbuild plugin.
 */
function createRxjsEsmResolutionPlugin() {
    return {
        name: 'angular-rxjs-resolution',
        setup(build) {
            build.onResolve({ filter: /^rxjs/ }, async (args) => {
                if (args.pluginData?.[RXJS_ESM_RESOLUTION]) {
                    return null;
                }
                const { importer, kind, resolveDir, namespace, pluginData = {} } = args;
                pluginData[RXJS_ESM_RESOLUTION] = true;
                const result = await build.resolve(args.path, {
                    importer,
                    kind,
                    namespace,
                    pluginData,
                    resolveDir,
                });
                result.path = result.path.replace('/dist/cjs/', '/dist/esm/');
                return result;
            });
        },
    };
}
exports.createRxjsEsmResolutionPlugin = createRxjsEsmResolutionPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnhqcy1lc20tcmVzb2x1dGlvbi1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL3J4anMtZXNtLXJlc29sdXRpb24tcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUlILE1BQU0sbUJBQW1CLEdBQUcsTUFBTSxDQUFDLHFCQUFxQixDQUFDLENBQUM7QUFFMUQ7Ozs7Ozs7O0dBUUc7QUFDSCxTQUFnQiw2QkFBNkI7SUFDM0MsT0FBTztRQUNMLElBQUksRUFBRSx5QkFBeUI7UUFDL0IsS0FBSyxDQUFDLEtBQUs7WUFDVCxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtnQkFDbEQsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsbUJBQW1CLENBQUMsRUFBRTtvQkFDMUMsT0FBTyxJQUFJLENBQUM7aUJBQ2I7Z0JBRUQsTUFBTSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxVQUFVLEdBQUcsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDO2dCQUN4RSxVQUFVLENBQUMsbUJBQW1CLENBQUMsR0FBRyxJQUFJLENBQUM7Z0JBRXZDLE1BQU0sTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFO29CQUM1QyxRQUFRO29CQUNSLElBQUk7b0JBQ0osU0FBUztvQkFDVCxVQUFVO29CQUNWLFVBQVU7aUJBQ1gsQ0FBQyxDQUFDO2dCQUVILE1BQU0sQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLFlBQVksQ0FBQyxDQUFDO2dCQUU5RCxPQUFPLE1BQU0sQ0FBQztZQUNoQixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQTFCRCxzRUEwQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBQbHVnaW4gfSBmcm9tICdlc2J1aWxkJztcblxuY29uc3QgUlhKU19FU01fUkVTT0xVVElPTiA9IFN5bWJvbCgnUlhKU19FU01fUkVTT0xVVElPTicpO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBwbHVnaW4gdGhhdCBmb3JjZXMgRVNNIHJlc29sdXRpb24gb2Ygcnhqcy5cbiAqIFRoaXMgaXMgbmVlZGVkIGFzIHdoZW4gdGFyZ2V0aW5nIG5vZGUsIHRoZSBDSlMgdmVyc2lvbiBpcyB1c2VkIHRvIHRoZSBjdXJyZW50IHBhY2thZ2UgY29uZGl0aW9uYWwgZXhwb3J0cy5cbiAqIEBzZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9ibG9iLzI5NDc1ODNiYjMzZTk3ZjNkYjllNmQ5ZjZjZWE3MGM2MmExNzMwNjAvcGFja2FnZS5qc29uI0wxOS5cbiAqXG4gKiBOT1RFOiBUaGlzIGNhbiBiZSByZW1vdmVkIHdoZW4gYW5kIGlmIHJ4anMgYWRkcyBhbiBpbXBvcnQgY29uZGl0aW9uIHRoYXQgYWxsb3dzIEVTTSB1c2FnZSBvbiBOb2RlLmpzLlxuICpcbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgcGx1Z2luLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUnhqc0VzbVJlc29sdXRpb25QbHVnaW4oKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYW5ndWxhci1yeGpzLXJlc29sdXRpb24nLFxuICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IC9ecnhqcy8gfSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgaWYgKGFyZ3MucGx1Z2luRGF0YT8uW1JYSlNfRVNNX1JFU09MVVRJT05dKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IGltcG9ydGVyLCBraW5kLCByZXNvbHZlRGlyLCBuYW1lc3BhY2UsIHBsdWdpbkRhdGEgPSB7fSB9ID0gYXJncztcbiAgICAgICAgcGx1Z2luRGF0YVtSWEpTX0VTTV9SRVNPTFVUSU9OXSA9IHRydWU7XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZShhcmdzLnBhdGgsIHtcbiAgICAgICAgICBpbXBvcnRlcixcbiAgICAgICAgICBraW5kLFxuICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICBwbHVnaW5EYXRhLFxuICAgICAgICAgIHJlc29sdmVEaXIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJlc3VsdC5wYXRoID0gcmVzdWx0LnBhdGgucmVwbGFjZSgnL2Rpc3QvY2pzLycsICcvZGlzdC9lc20vJyk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG4iXX0=