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
const node_path_1 = __importDefault(require("node:path"));
const error_1 = require("../../utils/error");
const sourcemap_ignorelist_plugin_1 = require("./sourcemap-ignorelist-plugin");
/**
 * Create an esbuild 'build' options object for all global scripts defined in the user provied
 * build options.
 * @param options The builder's user-provider normalized options.
 * @returns An esbuild BuildOptions object.
 */
function createGlobalScriptsBundleOptions(options, initial) {
    const { globalScripts, optimizationOptions, outputNames, preserveSymlinks, sourcemapOptions, workspaceRoot, } = options;
    const namespace = 'angular:script/global';
    const entryPoints = {};
    let found = false;
    for (const script of globalScripts) {
        if (script.initial === initial) {
            found = true;
            entryPoints[script.name] = `${namespace}:${script.name}`;
        }
    }
    // Skip if there are no entry points for the style loading type
    if (found === false) {
        return;
    }
    return {
        absWorkingDir: workspaceRoot,
        bundle: false,
        splitting: false,
        entryPoints,
        entryNames: initial ? outputNames.bundles : '[name]',
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
            (0, sourcemap_ignorelist_plugin_1.createSourcemapIngorelistPlugin)(),
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
                            let fileContent;
                            try {
                                // Attempt to read as a relative path from the workspace root
                                fileContent = await (0, promises_1.readFile)(node_path_1.default.join(workspaceRoot, filename), 'utf-8');
                            }
                            catch (e) {
                                (0, error_1.assertIsError)(e);
                                if (e.code !== 'ENOENT') {
                                    throw e;
                                }
                                // If not found attempt to resolve as a module specifier
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
                                fileContent = await (0, promises_1.readFile)(resolveResult.path, 'utf-8');
                            }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xvYmFsLXNjcmlwdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvZ2xvYmFsLXNjcmlwdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCw2REFBbUQ7QUFDbkQsOERBQWlDO0FBQ2pDLCtDQUE0QztBQUM1QywwREFBNkI7QUFDN0IsNkNBQWtEO0FBRWxELCtFQUFnRjtBQUVoRjs7Ozs7R0FLRztBQUNILFNBQWdCLGdDQUFnQyxDQUM5QyxPQUFpQyxFQUNqQyxPQUFnQjtJQUVoQixNQUFNLEVBQ0osYUFBYSxFQUNiLG1CQUFtQixFQUNuQixXQUFXLEVBQ1gsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixhQUFhLEdBQ2QsR0FBRyxPQUFPLENBQUM7SUFFWixNQUFNLFNBQVMsR0FBRyx1QkFBdUIsQ0FBQztJQUMxQyxNQUFNLFdBQVcsR0FBMkIsRUFBRSxDQUFDO0lBQy9DLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQztJQUNsQixLQUFLLE1BQU0sTUFBTSxJQUFJLGFBQWEsRUFBRTtRQUNsQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLEtBQUssT0FBTyxFQUFFO1lBQzlCLEtBQUssR0FBRyxJQUFJLENBQUM7WUFDYixXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsU0FBUyxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztTQUMxRDtLQUNGO0lBRUQsK0RBQStEO0lBQy9ELElBQUksS0FBSyxLQUFLLEtBQUssRUFBRTtRQUNuQixPQUFPO0tBQ1I7SUFFRCxPQUFPO1FBQ0wsYUFBYSxFQUFFLGFBQWE7UUFDNUIsTUFBTSxFQUFFLEtBQUs7UUFDYixTQUFTLEVBQUUsS0FB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RUFBRTtvQ0FDdkIsTUFBTSxDQUFDLENBQUM7aUNBQ1Q7Z0NBRUQsd0RBQXdEO2dDQUN4RCxNQUFNLGFBQWEsR0FBRyxNQUFNLEtBQUssQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFO29DQUNsRCxJQUFJLEVBQUUsYUFBYTtvQ0FDbkIsVUFBVSxFQUFFLGFBQWE7aUNBQzFCLENBQUMsQ0FBQztnQ0FFSCxJQUFJLGFBQWEsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO29DQUMvQixtRkFBbUY7b0NBQ25GLHFCQUFxQjtvQ0FDckIsYUFBYSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO29DQUU1RCxPQUFPO3dDQUNMLE1BQU0sRUFBRSxhQUFhLENBQUMsTUFBTTt3Q0FDNUIsUUFBUSxFQUFFLGFBQWEsQ0FBQyxRQUFRO3FDQUNqQyxDQUFDO2lDQUNIO2dDQUVELFdBQVcsR0FBRyxNQUFNLElBQUEsbUJBQVEsRUFBQyxhQUFhLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDOzZCQUMzRDs0QkFFRCxhQUFhLENBQUMsU0FBUyxDQUFDLElBQUksc0JBQVcsQ0FBQyxXQUFXLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7eUJBQ3JFO3dCQUVELE9BQU87NEJBQ0wsUUFBUSxFQUFFLGFBQWEsQ0FBQyxRQUFRLEVBQUU7NEJBQ2xDLE1BQU0sRUFBRSxJQUFJO3lCQUNiLENBQUM7b0JBQ0osQ0FBQyxDQUFDLENBQUM7Z0JBQ0wsQ0FBQzthQUNGO1NBQ0Y7S0FDRixDQUFDO0FBQ0osQ0FBQztBQXZIRCw0RUF1SEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZE9wdGlvbnMgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBNYWdpY1N0cmluZywgeyBCdW5kbGUgfSBmcm9tICdtYWdpYy1zdHJpbmcnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGFzc2VydElzRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcic7XG5pbXBvcnQgeyBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnO1xuaW1wb3J0IHsgY3JlYXRlU291cmNlbWFwSW5nb3JlbGlzdFBsdWdpbiB9IGZyb20gJy4vc291cmNlbWFwLWlnbm9yZWxpc3QtcGx1Z2luJztcblxuLyoqXG4gKiBDcmVhdGUgYW4gZXNidWlsZCAnYnVpbGQnIG9wdGlvbnMgb2JqZWN0IGZvciBhbGwgZ2xvYmFsIHNjcmlwdHMgZGVmaW5lZCBpbiB0aGUgdXNlciBwcm92aWVkXG4gKiBidWlsZCBvcHRpb25zLlxuICogQHBhcmFtIG9wdGlvbnMgVGhlIGJ1aWxkZXIncyB1c2VyLXByb3ZpZGVyIG5vcm1hbGl6ZWQgb3B0aW9ucy5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgQnVpbGRPcHRpb25zIG9iamVjdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUdsb2JhbFNjcmlwdHNCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMsXG4gIGluaXRpYWw6IGJvb2xlYW4sXG4pOiBCdWlsZE9wdGlvbnMgfCB1bmRlZmluZWQge1xuICBjb25zdCB7XG4gICAgZ2xvYmFsU2NyaXB0cyxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB3b3Jrc3BhY2VSb290LFxuICB9ID0gb3B0aW9ucztcblxuICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpzY3JpcHQvZ2xvYmFsJztcbiAgY29uc3QgZW50cnlQb2ludHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgbGV0IGZvdW5kID0gZmFsc2U7XG4gIGZvciAoY29uc3Qgc2NyaXB0IG9mIGdsb2JhbFNjcmlwdHMpIHtcbiAgICBpZiAoc2NyaXB0LmluaXRpYWwgPT09IGluaXRpYWwpIHtcbiAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgIGVudHJ5UG9pbnRzW3NjcmlwdC5uYW1lXSA9IGAke25hbWVzcGFjZX06JHtzY3JpcHQubmFtZX1gO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNraXAgaWYgdGhlcmUgYXJlIG5vIGVudHJ5IHBvaW50cyBmb3IgdGhlIHN0eWxlIGxvYWRpbmcgdHlwZVxuICBpZiAoZm91bmQgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBhYnNXb3JraW5nRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogZmFsc2UsXG4gICAgc3BsaXR0aW5nOiBmYWxzZSxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBlbnRyeU5hbWVzOiBpbml0aWFsID8gb3V0cHV0TmFtZXMuYnVuZGxlcyA6ICdbbmFtZV0nLFxuICAgIGFzc2V0TmFtZXM6IG91dHB1dE5hbWVzLm1lZGlhLFxuICAgIG1haW5GaWVsZHM6IFsnc2NyaXB0JywgJ2Jyb3dzZXInLCAnbWFpbiddLFxuICAgIGNvbmRpdGlvbnM6IFsnc2NyaXB0J10sXG4gICAgcmVzb2x2ZUV4dGVuc2lvbnM6IFsnLm1qcycsICcuanMnXSxcbiAgICBsb2dMZXZlbDogb3B0aW9ucy52ZXJib3NlID8gJ2RlYnVnJyA6ICdzaWxlbnQnLFxuICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgIG1pbmlmeTogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzLFxuICAgIG91dGRpcjogd29ya3NwYWNlUm9vdCxcbiAgICBzb3VyY2VtYXA6IHNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyAmJiAoc291cmNlbWFwT3B0aW9ucy5oaWRkZW4gPyAnZXh0ZXJuYWwnIDogdHJ1ZSksXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnbmV1dHJhbCcsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVTb3VyY2VtYXBJbmdvcmVsaXN0UGx1Z2luKCksXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdhbmd1bGFyLWdsb2JhbC1zY3JpcHRzJyxcbiAgICAgICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgICAgICBidWlsZC5vblJlc29sdmUoeyBmaWx0ZXI6IC9eYW5ndWxhcjpzY3JpcHRcXC9nbG9iYWw6LyB9LCAoYXJncykgPT4ge1xuICAgICAgICAgICAgaWYgKGFyZ3Mua2luZCAhPT0gJ2VudHJ5LXBvaW50Jykge1xuICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgLy8gQWRkIHRoZSBganNgIGV4dGVuc2lvbiBoZXJlIHNvIHRoYXQgZXNidWlsZCBnZW5lcmF0ZXMgYW4gb3V0cHV0IGZpbGUgd2l0aCB0aGUgZXh0ZW5zaW9uXG4gICAgICAgICAgICAgIHBhdGg6IGFyZ3MucGF0aC5zbGljZShuYW1lc3BhY2UubGVuZ3RoICsgMSkgKyAnLmpzJyxcbiAgICAgICAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICAvLyBBbGwgcmVmZXJlbmNlcyB3aXRoaW4gYSBnbG9iYWwgc2NyaXB0IHNob3VsZCBiZSBjb25zaWRlcmVkIGV4dGVybmFsLiBUaGlzIG1haW50YWlucyB0aGUgcnVudGltZVxuICAgICAgICAgIC8vIGJlaGF2aW9yIG9mIHRoZSBzY3JpcHQgYXMgaWYgaXQgd2VyZSBhZGRlZCBkaXJlY3RseSB0byBhIHNjcmlwdCBlbGVtZW50IGZvciByZWZlcmVuY2VkIGltcG9ydHMuXG4gICAgICAgICAgYnVpbGQub25SZXNvbHZlKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZSB9LCAoeyBwYXRoIH0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICAgIGV4dGVybmFsOiB0cnVlLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBidWlsZC5vbkxvYWQoeyBmaWx0ZXI6IC8uLywgbmFtZXNwYWNlIH0sIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBmaWxlcyA9IGdsb2JhbFNjcmlwdHMuZmluZCgoeyBuYW1lIH0pID0+IG5hbWUgPT09IGFyZ3MucGF0aC5zbGljZSgwLCAtMykpPy5maWxlcztcbiAgICAgICAgICAgIGFzc2VydChmaWxlcywgYEludmFsaWQgb3BlcmF0aW9uOiBnbG9iYWwgc2NyaXB0cyBuYW1lIG5vdCBmb3VuZCBbJHthcmdzLnBhdGh9XWApO1xuXG4gICAgICAgICAgICAvLyBHbG9iYWwgc2NyaXB0cyBhcmUgY29uY2F0ZW5hdGVkIHVzaW5nIG1hZ2ljLXN0cmluZyBpbnN0ZWFkIG9mIGJ1bmRsZWQgdmlhIGVzYnVpbGQuXG4gICAgICAgICAgICBjb25zdCBidW5kbGVDb250ZW50ID0gbmV3IEJ1bmRsZSgpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBmaWxlbmFtZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgICBsZXQgZmlsZUNvbnRlbnQ7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gQXR0ZW1wdCB0byByZWFkIGFzIGEgcmVsYXRpdmUgcGF0aCBmcm9tIHRoZSB3b3Jrc3BhY2Ugcm9vdFxuICAgICAgICAgICAgICAgIGZpbGVDb250ZW50ID0gYXdhaXQgcmVhZEZpbGUocGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGZpbGVuYW1lKSwgJ3V0Zi04Jyk7XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBhc3NlcnRJc0Vycm9yKGUpO1xuICAgICAgICAgICAgICAgIGlmIChlLmNvZGUgIT09ICdFTk9FTlQnKSB7XG4gICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIElmIG5vdCBmb3VuZCBhdHRlbXB0IHRvIHJlc29sdmUgYXMgYSBtb2R1bGUgc3BlY2lmaWVyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzb2x2ZVJlc3VsdCA9IGF3YWl0IGJ1aWxkLnJlc29sdmUoZmlsZW5hbWUsIHtcbiAgICAgICAgICAgICAgICAgIGtpbmQ6ICdlbnRyeS1wb2ludCcsXG4gICAgICAgICAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKHJlc29sdmVSZXN1bHQuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgLy8gUmVtb3ZlIHJlc29sdXRpb24gZmFpbHVyZSBub3RlcyBhYm91dCBtYXJraW5nIGFzIGV4dGVybmFsIHNpbmNlIGl0IGRvZXNuJ3QgYXBwbHlcbiAgICAgICAgICAgICAgICAgIC8vIHRvIGdsb2JhbCBzY3JpcHRzLlxuICAgICAgICAgICAgICAgICAgcmVzb2x2ZVJlc3VsdC5lcnJvcnMuZm9yRWFjaCgoZXJyb3IpID0+IChlcnJvci5ub3RlcyA9IFtdKSk7XG5cbiAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yczogcmVzb2x2ZVJlc3VsdC5lcnJvcnMsXG4gICAgICAgICAgICAgICAgICAgIHdhcm5pbmdzOiByZXNvbHZlUmVzdWx0Lndhcm5pbmdzLFxuICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBmaWxlQ29udGVudCA9IGF3YWl0IHJlYWRGaWxlKHJlc29sdmVSZXN1bHQucGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBidW5kbGVDb250ZW50LmFkZFNvdXJjZShuZXcgTWFnaWNTdHJpbmcoZmlsZUNvbnRlbnQsIHsgZmlsZW5hbWUgfSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBjb250ZW50czogYnVuZGxlQ29udGVudC50b1N0cmluZygpLFxuICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xufVxuIl19