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
const load_result_cache_1 = require("./load-result-cache");
const sourcemap_ignorelist_plugin_1 = require("./sourcemap-ignorelist-plugin");
const virtual_module_plugin_1 = require("./virtual-module-plugin");
/**
 * Create an esbuild 'build' options object for all global scripts defined in the user provied
 * build options.
 * @param options The builder's user-provider normalized options.
 * @returns An esbuild BuildOptions object.
 */
function createGlobalScriptsBundleOptions(options, initial, loadCache) {
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
            (0, virtual_module_plugin_1.createVirtualModulePlugin)({
                namespace,
                external: true,
                // Add the `js` extension here so that esbuild generates an output file with the extension
                transformPath: (path) => path.slice(namespace.length + 1) + '.js',
                loadContent: (args, build) => (0, load_result_cache_1.createCachedLoad)(loadCache, async (args) => {
                    const files = globalScripts.find(({ name }) => name === args.path.slice(0, -3))?.files;
                    (0, node_assert_1.default)(files, `Invalid operation: global scripts name not found [${args.path}]`);
                    // Global scripts are concatenated using magic-string instead of bundled via esbuild.
                    const bundleContent = new magic_string_1.Bundle();
                    const watchFiles = [];
                    for (const filename of files) {
                        let fileContent;
                        try {
                            // Attempt to read as a relative path from the workspace root
                            fileContent = await (0, promises_1.readFile)(node_path_1.default.join(workspaceRoot, filename), 'utf-8');
                            watchFiles.push(filename);
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
                            watchFiles.push(node_path_1.default.relative(resolveResult.path, workspaceRoot));
                            fileContent = await (0, promises_1.readFile)(resolveResult.path, 'utf-8');
                        }
                        bundleContent.addSource(new magic_string_1.default(fileContent, { filename }));
                    }
                    return {
                        contents: bundleContent.toString(),
                        loader: 'js',
                        watchFiles,
                    };
                }).call(build, args),
            }),
        ],
    };
}
exports.createGlobalScriptsBundleOptions = createGlobalScriptsBundleOptions;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xvYmFsLXNjcmlwdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2dsb2JhbC1zY3JpcHRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gsNkRBQW1EO0FBQ25ELDhEQUFpQztBQUNqQywrQ0FBNEM7QUFDNUMsMERBQTZCO0FBRTdCLDZDQUFrRDtBQUNsRCwyREFBd0U7QUFDeEUsK0VBQWdGO0FBQ2hGLG1FQUFvRTtBQUVwRTs7Ozs7R0FLRztBQUNILFNBQWdCLGdDQUFnQyxDQUM5QyxPQUFpQyxFQUNqQyxPQUFnQixFQUNoQixTQUEyQjtJQUUzQixNQUFNLEVBQ0osYUFBYSxFQUNiLG1CQUFtQixFQUNuQixXQUFXLEVBQ1gsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixhQUFhLEdBQ2QsR0FBRyxPQUFPLENBQUM7SUFFWixNQUFNLFNBQVMsR0FBRyx1QkFBdUIsQ0FBQztJQUMxQyxNQUFNLFdBQVcsR0FBMkIsRUFBRSxDQUFDO0lBQy9DLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQztJQUNsQixLQUFLLE1BQU0sTUFBTSxJQUFJLGFBQWEsRUFBRTtRQUNsQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLEtBQUssT0FBTyxFQUFFO1lBQzlCLEtBQUssR0FBRyxJQUFJLENBQUM7WUFDYixXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsU0FBUyxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztTQUMxRDtLQUNGO0lBRUQsK0RBQStEO0lBQy9ELElBQUksS0FBSyxLQUFLLEtBQUssRUFBRTtRQUNuQixPQUFPO0tBQ1I7SUFFRCxPQUFPO1FBQ0wsYUFBYSxFQUFFLGFBQWE7UUFDNUIsTUFBTSxF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QyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0NBRTVELE9BQU87b0NBQ0wsTUFBTSxFQUFFLGFBQWEsQ0FBQyxNQUFNO29DQUM1QixRQUFRLEVBQUUsYUFBYSxDQUFDLFFBQVE7aUNBQ2pDLENBQUM7NkJBQ0g7NEJBRUQsVUFBVSxDQUFDLElBQUksQ0FBQyxtQkFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUM7NEJBQ2xFLFdBQVcsR0FBRyxNQUFNLElBQUEsbUJBQVEsRUFBQyxhQUFhLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO3lCQUMzRDt3QkFFRCxhQUFhLENBQUMsU0FBUyxDQUFDLElBQUksc0JBQVcsQ0FBQyxXQUFXLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7cUJBQ3JFO29CQUVELE9BQU87d0JBQ0wsUUFBUSxFQUFFLGFBQWEsQ0FBQyxRQUFRLEVBQUU7d0JBQ2xDLE1BQU0sRUFBRSxJQUFJO3dCQUNaLFVBQVU7cUJBQ1gsQ0FBQztnQkFDSixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQzthQUN2QixDQUFDO1NBQ0g7S0FDRixDQUFDO0FBQ0osQ0FBQztBQTNHRCw0RUEyR0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZE9wdGlvbnMgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCBNYWdpY1N0cmluZywgeyBCdW5kbGUgfSBmcm9tICdtYWdpYy1zdHJpbmcnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB0eXBlIHsgTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL29wdGlvbnMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNFcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9yJztcbmltcG9ydCB7IExvYWRSZXN1bHRDYWNoZSwgY3JlYXRlQ2FjaGVkTG9hZCB9IGZyb20gJy4vbG9hZC1yZXN1bHQtY2FjaGUnO1xuaW1wb3J0IHsgY3JlYXRlU291cmNlbWFwSW5nb3JlbGlzdFBsdWdpbiB9IGZyb20gJy4vc291cmNlbWFwLWlnbm9yZWxpc3QtcGx1Z2luJztcbmltcG9ydCB7IGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW4gfSBmcm9tICcuL3ZpcnR1YWwtbW9kdWxlLXBsdWdpbic7XG5cbi8qKlxuICogQ3JlYXRlIGFuIGVzYnVpbGQgJ2J1aWxkJyBvcHRpb25zIG9iamVjdCBmb3IgYWxsIGdsb2JhbCBzY3JpcHRzIGRlZmluZWQgaW4gdGhlIHVzZXIgcHJvdmllZFxuICogYnVpbGQgb3B0aW9ucy5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBidWlsZGVyJ3MgdXNlci1wcm92aWRlciBub3JtYWxpemVkIG9wdGlvbnMuXG4gKiBAcmV0dXJucyBBbiBlc2J1aWxkIEJ1aWxkT3B0aW9ucyBvYmplY3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVHbG9iYWxTY3JpcHRzQnVuZGxlT3B0aW9ucyhcbiAgb3B0aW9uczogTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zLFxuICBpbml0aWFsOiBib29sZWFuLFxuICBsb2FkQ2FjaGU/OiBMb2FkUmVzdWx0Q2FjaGUsXG4pOiBCdWlsZE9wdGlvbnMgfCB1bmRlZmluZWQge1xuICBjb25zdCB7XG4gICAgZ2xvYmFsU2NyaXB0cyxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIG91dHB1dE5hbWVzLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgc291cmNlbWFwT3B0aW9ucyxcbiAgICB3b3Jrc3BhY2VSb290LFxuICB9ID0gb3B0aW9ucztcblxuICBjb25zdCBuYW1lc3BhY2UgPSAnYW5ndWxhcjpzY3JpcHQvZ2xvYmFsJztcbiAgY29uc3QgZW50cnlQb2ludHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgbGV0IGZvdW5kID0gZmFsc2U7XG4gIGZvciAoY29uc3Qgc2NyaXB0IG9mIGdsb2JhbFNjcmlwdHMpIHtcbiAgICBpZiAoc2NyaXB0LmluaXRpYWwgPT09IGluaXRpYWwpIHtcbiAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgIGVudHJ5UG9pbnRzW3NjcmlwdC5uYW1lXSA9IGAke25hbWVzcGFjZX06JHtzY3JpcHQubmFtZX1gO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNraXAgaWYgdGhlcmUgYXJlIG5vIGVudHJ5IHBvaW50cyBmb3IgdGhlIHN0eWxlIGxvYWRpbmcgdHlwZVxuICBpZiAoZm91bmQgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBhYnNXb3JraW5nRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIGJ1bmRsZTogZmFsc2UsXG4gICAgc3BsaXR0aW5nOiBmYWxzZSxcbiAgICBlbnRyeVBvaW50cyxcbiAgICBlbnRyeU5hbWVzOiBpbml0aWFsID8gb3V0cHV0TmFtZXMuYnVuZGxlcyA6ICdbbmFtZV0nLFxuICAgIGFzc2V0TmFtZXM6IG91dHB1dE5hbWVzLm1lZGlhLFxuICAgIG1haW5GaWVsZHM6IFsnc2NyaXB0JywgJ2Jyb3dzZXInLCAnbWFpbiddLFxuICAgIGNvbmRpdGlvbnM6IFsnc2NyaXB0J10sXG4gICAgcmVzb2x2ZUV4dGVuc2lvbnM6IFsnLm1qcycsICcuanMnXSxcbiAgICBsb2dMZXZlbDogb3B0aW9ucy52ZXJib3NlID8gJ2RlYnVnJyA6ICdzaWxlbnQnLFxuICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgIG1pbmlmeTogb3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzLFxuICAgIG91dGRpcjogd29ya3NwYWNlUm9vdCxcbiAgICBzb3VyY2VtYXA6IHNvdXJjZW1hcE9wdGlvbnMuc2NyaXB0cyAmJiAoc291cmNlbWFwT3B0aW9ucy5oaWRkZW4gPyAnZXh0ZXJuYWwnIDogdHJ1ZSksXG4gICAgd3JpdGU6IGZhbHNlLFxuICAgIHBsYXRmb3JtOiAnbmV1dHJhbCcsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBjcmVhdGVTb3VyY2VtYXBJbmdvcmVsaXN0UGx1Z2luKCksXG4gICAgICBjcmVhdGVWaXJ0dWFsTW9kdWxlUGx1Z2luKHtcbiAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICBleHRlcm5hbDogdHJ1ZSxcbiAgICAgICAgLy8gQWRkIHRoZSBganNgIGV4dGVuc2lvbiBoZXJlIHNvIHRoYXQgZXNidWlsZCBnZW5lcmF0ZXMgYW4gb3V0cHV0IGZpbGUgd2l0aCB0aGUgZXh0ZW5zaW9uXG4gICAgICAgIHRyYW5zZm9ybVBhdGg6IChwYXRoKSA9PiBwYXRoLnNsaWNlKG5hbWVzcGFjZS5sZW5ndGggKyAxKSArICcuanMnLFxuICAgICAgICBsb2FkQ29udGVudDogKGFyZ3MsIGJ1aWxkKSA9PlxuICAgICAgICAgIGNyZWF0ZUNhY2hlZExvYWQobG9hZENhY2hlLCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBnbG9iYWxTY3JpcHRzLmZpbmQoKHsgbmFtZSB9KSA9PiBuYW1lID09PSBhcmdzLnBhdGguc2xpY2UoMCwgLTMpKT8uZmlsZXM7XG4gICAgICAgICAgICBhc3NlcnQoZmlsZXMsIGBJbnZhbGlkIG9wZXJhdGlvbjogZ2xvYmFsIHNjcmlwdHMgbmFtZSBub3QgZm91bmQgWyR7YXJncy5wYXRofV1gKTtcblxuICAgICAgICAgICAgLy8gR2xvYmFsIHNjcmlwdHMgYXJlIGNvbmNhdGVuYXRlZCB1c2luZyBtYWdpYy1zdHJpbmcgaW5zdGVhZCBvZiBidW5kbGVkIHZpYSBlc2J1aWxkLlxuICAgICAgICAgICAgY29uc3QgYnVuZGxlQ29udGVudCA9IG5ldyBCdW5kbGUoKTtcbiAgICAgICAgICAgIGNvbnN0IHdhdGNoRmlsZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZW5hbWUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgICAgbGV0IGZpbGVDb250ZW50O1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIEF0dGVtcHQgdG8gcmVhZCBhcyBhIHJlbGF0aXZlIHBhdGggZnJvbSB0aGUgd29ya3NwYWNlIHJvb3RcbiAgICAgICAgICAgICAgICBmaWxlQ29udGVudCA9IGF3YWl0IHJlYWRGaWxlKHBhdGguam9pbih3b3Jrc3BhY2VSb290LCBmaWxlbmFtZSksICd1dGYtOCcpO1xuICAgICAgICAgICAgICAgIHdhdGNoRmlsZXMucHVzaChmaWxlbmFtZSk7XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBhc3NlcnRJc0Vycm9yKGUpO1xuICAgICAgICAgICAgICAgIGlmIChlLmNvZGUgIT09ICdFTk9FTlQnKSB7XG4gICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIElmIG5vdCBmb3VuZCBhdHRlbXB0IHRvIHJlc29sdmUgYXMgYSBtb2R1bGUgc3BlY2lmaWVyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzb2x2ZVJlc3VsdCA9IGF3YWl0IGJ1aWxkLnJlc29sdmUoZmlsZW5hbWUsIHtcbiAgICAgICAgICAgICAgICAgIGtpbmQ6ICdlbnRyeS1wb2ludCcsXG4gICAgICAgICAgICAgICAgICByZXNvbHZlRGlyOiB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKHJlc29sdmVSZXN1bHQuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgLy8gUmVtb3ZlIHJlc29sdXRpb24gZmFpbHVyZSBub3RlcyBhYm91dCBtYXJraW5nIGFzIGV4dGVybmFsIHNpbmNlIGl0IGRvZXNuJ3QgYXBwbHlcbiAgICAgICAgICAgICAgICAgIC8vIHRvIGdsb2JhbCBzY3JpcHRzLlxuICAgICAgICAgICAgICAgICAgcmVzb2x2ZVJlc3VsdC5lcnJvcnMuZm9yRWFjaCgoZXJyb3IpID0+IChlcnJvci5ub3RlcyA9IFtdKSk7XG5cbiAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yczogcmVzb2x2ZVJlc3VsdC5lcnJvcnMsXG4gICAgICAgICAgICAgICAgICAgIHdhcm5pbmdzOiByZXNvbHZlUmVzdWx0Lndhcm5pbmdzLFxuICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB3YXRjaEZpbGVzLnB1c2gocGF0aC5yZWxhdGl2ZShyZXNvbHZlUmVzdWx0LnBhdGgsIHdvcmtzcGFjZVJvb3QpKTtcbiAgICAgICAgICAgICAgICBmaWxlQ29udGVudCA9IGF3YWl0IHJlYWRGaWxlKHJlc29sdmVSZXN1bHQucGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBidW5kbGVDb250ZW50LmFkZFNvdXJjZShuZXcgTWFnaWNTdHJpbmcoZmlsZUNvbnRlbnQsIHsgZmlsZW5hbWUgfSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBjb250ZW50czogYnVuZGxlQ29udGVudC50b1N0cmluZygpLFxuICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICAgIHdhdGNoRmlsZXMsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0pLmNhbGwoYnVpbGQsIGFyZ3MpLFxuICAgICAgfSksXG4gICAgXSxcbiAgfTtcbn1cbiJdfQ==