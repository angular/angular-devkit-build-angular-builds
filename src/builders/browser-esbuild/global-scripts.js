"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGlobalScriptsBundleOptions = void 0;
const magic_string_1 = __importStar(require("magic-string"));
const node_assert_1 = __importDefault(require("node:assert"));
const promises_1 = require("node:fs/promises");
/**
 * Create an esbuild 'build' options object for all global scripts defined in the user provied
 * build options.
 * @param options The builder's user-provider normalized options.
 * @returns An esbuild BuildOptions object.
 */
function createGlobalScriptsBundleOptions(options) {
    const { globalScripts, optimizationOptions, outputNames, preserveSymlinks, sourcemapOptions, workspaceRoot, } = options;
    const namespace = 'angular:script/global';
    const entryPoints = {};
    for (const { name } of globalScripts) {
        entryPoints[name] = `${namespace}:${name}`;
    }
    return {
        absWorkingDir: workspaceRoot,
        bundle: false,
        splitting: false,
        entryPoints,
        entryNames: outputNames.bundles,
        assetNames: outputNames.media,
        mainFields: ['script', 'browser', 'main'],
        conditions: ['script'],
        resolveExtensions: ['.mjs', '.js'],
        logLevel: options.verbose ? 'debug' : 'silent',
        metafile: true,
        minify: optimizationOptions.scripts,
        outdir: workspaceRoot,
        sourcemap: sourcemapOptions.scripts && (sourcemapOptions.hidden ? 'external' : true),
        write: false,
        platform: 'neutral',
        preserveSymlinks,
        plugins: [
            {
                name: 'angular-global-scripts',
                setup(build) {
                    build.onResolve({ filter: /^angular:script\/global:/ }, (args) => {
                        if (args.kind !== 'entry-point') {
                            return null;
                        }
                        return {
                            // Add the `js` extension here so that esbuild generates an output file with the extension
                            path: args.path.slice(namespace.length + 1) + '.js',
                            namespace,
                        };
                    });
                    // All references within a global script should be considered external. This maintains the runtime
                    // behavior of the script as if it were added directly to a script element for referenced imports.
                    build.onResolve({ filter: /./, namespace }, ({ path }) => {
                        return {
                            path,
                            external: true,
                        };
                    });
                    build.onLoad({ filter: /./, namespace }, async (args) => {
                        const files = globalScripts.find(({ name }) => name === args.path.slice(0, -3))?.files;
                        (0, node_assert_1.default)(files, `Invalid operation: global scripts name not found [${args.path}]`);
                        // Global scripts are concatenated using magic-string instead of bundled via esbuild.
                        const bundleContent = new magic_string_1.Bundle();
                        for (const filename of files) {
                            const resolveResult = await build.resolve(filename, {
                                kind: 'entry-point',
                                resolveDir: workspaceRoot,
                            });
                            if (resolveResult.errors.length) {
                                // Remove resolution failure notes about marking as external since it doesn't apply
                                // to global scripts.
                                resolveResult.errors.forEach((error) => (error.notes = []));
                                return {
                                    errors: resolveResult.errors,
                                    warnings: resolveResult.warnings,
                                };
                            }
                            const fileContent = await (0, promises_1.readFile)(resolveResult.path, 'utf-8');
                            bundleContent.addSource(new magic_string_1.default(fileContent, { filename }));
                        }
                        return {
                            contents: bundleContent.toString(),
                            loader: 'js',
                        };
                    });
                },
            },
        ],
    };
}
exports.createGlobalScriptsBundleOptions = createGlobalScriptsBundleOptions;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xvYmFsLXNjcmlwdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvZ2xvYmFsLXNjcmlwdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCw2REFBbUQ7QUFDbkQsOERBQWlDO0FBQ2pDLCtDQUE0QztBQUc1Qzs7Ozs7R0FLRztBQUNILFNBQWdCLGdDQUFnQyxDQUFDLE9BQWlDO0lBQ2hGLE1BQU0sRUFDSixhQUFhLEVBQ2IsbUJBQW1CLEVBQ25CLFdBQVcsRUFDWCxnQkFBZ0IsRUFDaEIsZ0JBQWdCLEVBQ2hCLGFBQWEsR0FDZCxHQUFHLE9BQU8sQ0FBQztJQUVaLE1BQU0sU0FBUyxHQUFHLHVCQUF1QixDQUFDO0lBQzFDLE1BQU0sV0FBVyxHQUEyQixFQUFFLENBQUM7SUFDL0MsS0FBSyxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksYUFBYSxFQUFFO1FBQ3BDLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLFNBQVMsSUFBSSxJQUFJLEVBQUUsQ0FBQztLQUM1QztJQUVELE9BQU87UUFDTCxhQUFhLEVBQUUsYUFBYTtRQUM1QixNQUFNLEVBQUUsS0FBSztRQUNiLFNBQVMsRUFBRSxLQUFLO1FBQ2hCLFdBQVc7UUFDWCxVQUFVLEVBQUUsV0FBVyxDQUFDLE9BQU87UUFDL0IsVUFBVSxFQUFFLFdBQVcsQ0FBQyxLQUFLO1FBQzdCLFVBQVUsRUFBRSxDQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxDQUFDO1FBQ3pDLFVBQVUsRUFBRSxDQUFDLFFBQVEsQ0FBQztRQUN0QixpQkFBaUIsRUFBRSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUM7UUFDbEMsUUFBUSxFQUFFLE9BQU8sQ0FB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QUMsQ0FBQyxDQUFDO3lCQUNyRTt3QkFFRCxPQUFPOzRCQUNMLFFBQVEsRUFBRSxhQUFhLENBQUMsUUFBUSxFQUFFOzRCQUNsQyxNQUFNLEVBQUUsSUFBSTt5QkFDYixDQUFDO29CQUNKLENBQUMsQ0FBQyxDQUFDO2dCQUNMLENBQUM7YUFDRjtTQUNGO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUE3RkQsNEVBNkZDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgTWFnaWNTdHJpbmcsIHsgQnVuZGxlIH0gZnJvbSAnbWFnaWMtc3RyaW5nJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5cbi8qKlxuICogQ3JlYXRlIGFuIGVzYnVpbGQgJ2J1aWxkJyBvcHRpb25zIG9iamVjdCBmb3IgYWxsIGdsb2JhbCBzY3JpcHRzIGRlZmluZWQgaW4gdGhlIHVzZXIgcHJvdmllZFxuICogYnVpbGQgb3B0aW9ucy5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBidWlsZGVyJ3MgdXNlci1wcm92aWRlciBub3JtYWxpemVkIG9wdGlvbnMuXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIEJ1aWxkT3B0aW9ucyBvYmplY3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVHbG9iYWxTY3JpcHRzQnVuZGxlT3B0aW9ucyhvcHRpb25zOiBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMpOiBCdWlsZE9wdGlvbnMge1xuICBjb25zdCB7XG4gICAgZ2xvYmFsU2NyaXB0cyxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB3b3Jrc3BhY2VSb290LFxuICB9ID0gb3B0aW9ucztcblxuICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpzY3JpcHQvZ2xvYmFsJztcbiAgY29uc3QgZW50cnlQb2ludHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgZm9yIChjb25zdCB7IG5hbWUgfSBvZiBnbG9iYWxTY3JpcHRzKSB7XG4gICAgZW50cnlQb2ludHNbbmFtZV0gPSBgJHtuYW1lc3BhY2V9OiR7bmFtZX1gO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBhYnNXb3JraW5nRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogZmFsc2UsXG4gICAgc3BsaXR0aW5nOiBmYWxzZSxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBlbnRyeU5hbWVzOiBvdXRwdXROYW1lcy5idW5kbGVzLFxuICAgIGFzc2V0TmFtZXM6IG91dHB1dE5hbWVzLm1lZGlhLFxuICAgIG1haW5GaWVsZHM6IFsnc2NyaXB0JywgJ2Jyb3dzZXInLCAnbWFpbiddLFxuICAgIGNvbmRpdGlvbnM6IFsnc2NyaXB0J10sXG4gICAgcmVzb2x2ZUV4dGVuc2lvbnM6IFsnLm1qcycsICcuanMnXSxcbiAgICBsb2dMZXZlbDogb3B0aW9ucy52ZXJib3NlID8gJ2RlYnVnJyA6ICdzaWxlbnQnLFxuICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgIG1pbmlmeTogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzLFxuICAgIG91dGRpcjogd29ya3NwYWNlUm9vdCxcbiAgICBzb3VyY2VtYXA6IHNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyAmJiAoc291cmNlbWFwT3B0aW9ucy5oaWRkZW4gPyAnZXh0ZXJuYWwnIDogdHJ1ZSksXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnbmV1dHJhbCcsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBwbHVnaW5zOiBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdhbmd1bGFyLWdsb2JhbC1zY3JpcHRzJyxcbiAgICAgICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IC9eYW5ndWxhcjpzY3JpcHRcXC9nbG9iYWw6LyB9LCAoYXJncykgPT4ge1xuICAgICAgICAgICAgaWYgKGFyZ3Mua2luZCAhPT0gJ2VudHJ5LXBvaW50Jykge1xuICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgLy8gQWRkIHRoZSBganNgIGV4dGVuc2lvbiBoZXJlIHNvIHRoYXQgZXNidWlsZCBnZW5lcmF0ZXMgYW4gb3V0cHV0IGZpbGUgd2l0aCB0aGUgZXh0ZW5zaW9uXG4gICAgICAgICAgICAgIHBhdGg6IGFyZ3MucGF0aC5zbGljZShuYW1lc3BhY2UubGVuZ3RoICsgMSkgKyAnLmpzJyxcbiAgICAgICAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICAvLyBBbGwgcmVmZXJlbmNlcyB3aXRoaW4gYSBnbG9iYWwgc2NyaXB0IHNob3VsZCBiZSBjb25zaWRlcmVkIGV4dGVybmFsLiBUaGlzIG1haW50YWlucyB0aGUgcnVudGltZVxuICAgICAgICAgIC8vIGJlaGF2aW9yIG9mIHRoZSBzY3JpcHQgYXMgaWYgaXQgd2VyZSBhZGRlZCBkaXJlY3RseSB0byBhIHNjcmlwdCBlbGVtZW50IGZvciByZWZlcmVuY2VkIGltcG9ydHMuXG4gICAgICAgICAgYnVpbGQub25SZXNvbHZlKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZSB9LCAoeyBwYXRoIH0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICAgIGV4dGVybmFsOiB0cnVlLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC8uLywgbmFtZXNwYWNlIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBmaWxlcyA9IGdsb2JhbFNjcmlwdHMuZmluZCgoeyBuYW1lIH0pID0+IG5hbWUgPT09IGFyZ3MucGF0aC5zbGljZSgwLCAtMykpPy5maWxlcztcbiAgICAgICAgICAgIGFzc2VydChmaWxlcywgYEludmFsaWQgb3BlcmF0aW9uOiBnbG9iYWwgc2NyaXB0cyBuYW1lIG5vdCBmb3VuZCBbJHthcmdzLnBhdGh9XWApO1xuXG4gICAgICAgICAgICAvLyBHbG9iYWwgc2NyaXB0cyBhcmUgY29uY2F0ZW5hdGVkIHVzaW5nIG1hZ2ljLXN0cmluZyBpbnN0ZWFkIG9mIGJ1bmRsZWQgdmlhIGVzYnVpbGQuXG4gICAgICAgICAgICBjb25zdCBidW5kbGVDb250ZW50ID0gbmV3IEJ1bmRsZSgpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBmaWxlbmFtZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgICBjb25zdCByZXNvbHZlUmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZShmaWxlbmFtZSwge1xuICAgICAgICAgICAgICAgIGtpbmQ6ICdlbnRyeS1wb2ludCcsXG4gICAgICAgICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgaWYgKHJlc29sdmVSZXN1bHQuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSByZXNvbHV0aW9uIGZhaWx1cmUgbm90ZXMgYWJvdXQgbWFya2luZyBhcyBleHRlcm5hbCBzaW5jZSBpdCBkb2Vzbid0IGFwcGx5XG4gICAgICAgICAgICAgICAgLy8gdG8gZ2xvYmFsIHNjcmlwdHMuXG4gICAgICAgICAgICAgICAgcmVzb2x2ZVJlc3VsdC5lcnJvcnMuZm9yRWFjaCgoZXJyb3IpID0+IChlcnJvci5ub3RlcyA9IFtdKSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgZXJyb3JzOiByZXNvbHZlUmVzdWx0LmVycm9ycyxcbiAgICAgICAgICAgICAgICAgIHdhcm5pbmdzOiByZXNvbHZlUmVzdWx0Lndhcm5pbmdzLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBmaWxlQ29udGVudCA9IGF3YWl0IHJlYWRGaWxlKHJlc29sdmVSZXN1bHQucGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgICAgICAgIGJ1bmRsZUNvbnRlbnQuYWRkU291cmNlKG5ldyBNYWdpY1N0cmluZyhmaWxlQ29udGVudCwgeyBmaWxlbmFtZSB9KSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGNvbnRlbnRzOiBidW5kbGVDb250ZW50LnRvU3RyaW5nKCksXG4gICAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIF0sXG4gIH07XG59XG4iXX0=