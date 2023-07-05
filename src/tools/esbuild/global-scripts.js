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
                            const fullPath = node_path_1.default.join(workspaceRoot, filename);
                            fileContent = await (0, promises_1.readFile)(fullPath, 'utf-8');
                            watchFiles.push(fullPath);
                        }
                        catch (e) {
                            (0, error_1.assertIsError)(e);
                            if (e.code !== 'ENOENT') {
                                throw e;
                            }
                            // If not found, attempt to resolve as a module specifier
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
                            watchFiles.push(resolveResult.path);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xvYmFsLXNjcmlwdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2dsb2JhbC1zY3JpcHRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gsNkRBQW1EO0FBQ25ELDhEQUFpQztBQUNqQywrQ0FBNEM7QUFDNUMsMERBQTZCO0FBRTdCLDZDQUFrRDtBQUNsRCwyREFBd0U7QUFDeEUsK0VBQWdGO0FBQ2hGLG1FQUFvRTtBQUVwRTs7Ozs7R0FLRztBQUNILFNBQWdCLGdDQUFnQyxDQUM5QyxPQUFpQyxFQUNqQyxPQUFnQixFQUNoQixTQUEyQjtJQUUzQixNQUFNLEVBQ0osYUFBYSxFQUNiLG1CQUFtQixFQUNuQixXQUFXLEVBQ1gsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixhQUFhLEdBQ2QsR0FBRyxPQUFPLENBQUM7SUFFWixNQUFNLFNBQVMsR0FBRyx1QkFBdUIsQ0FBQztJQUMxQyxNQUFNLFdBQVcsR0FBMkIsRUFBRSxDQUFDO0lBQy9DLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQztJQUNsQixLQUFLLE1BQU0sTUFBTSxJQUFJLGFBQWEsRUFBRTtRQUNsQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLEtBQUssT0FBTyxFQUFFO1lBQzlCLEtBQUssR0FBRyxJQUFJLENBQUM7WUFDYixXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsU0FBUyxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztTQUMxRDtLQUNGO0lBRUQsK0RBQStEO0lBQy9ELElBQUksS0FBSyxLQUFLLEtBQUssRUFBRTtRQUNuQixPQUFPO0tBQ1I7SUFFRCxPQUFPO1FBQ0wsYUFBYSxFQUFFLGFBQWE7UUFDNUIsTUFBTSxF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Q3JCLGFBQWEsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztnQ0FFNUQsT0FBTztvQ0FDTCxNQUFNLEVBQUUsYUFBYSxDQUFDLE1BQU07b0NBQzVCLFFBQVEsRUFBRSxhQUFhLENBQUMsUUFBUTtpQ0FDakMsQ0FBQzs2QkFDSDs0QkFFRCxVQUFVLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQzs0QkFDcEMsV0FBVyxHQUFHLE1BQU0sSUFBQSxtQkFBUSxFQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7eUJBQzNEO3dCQUVELGFBQWEsQ0FBQyxTQUFTLENBQUMsSUFBSSxzQkFBVyxDQUFDLFdBQVcsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQztxQkFDckU7b0JBRUQsT0FBTzt3QkFDTCxRQUFRLEVBQUUsYUFBYSxDQUFDLFFBQVEsRUFBRTt3QkFDbEMsTUFBTSxFQUFFLElBQUk7d0JBQ1osVUFBVTtxQkFDWCxDQUFDO2dCQUNKLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDO2FBQ3ZCLENBQUM7U0FDSDtLQUNGLENBQUM7QUFDSixDQUFDO0FBNUdELDRFQTRHQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEJ1aWxkT3B0aW9ucyB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IE1hZ2ljU3RyaW5nLCB7IEJ1bmRsZSB9IGZyb20gJ21hZ2ljLXN0cmluZyc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnbm9kZTpmcy9wcm9taXNlcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHR5cGUgeyBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMgfSBmcm9tICcuLi8uLi9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvb3B0aW9ucyc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgTG9hZFJlc3VsdENhY2hlLCBjcmVhdGVDYWNoZWRMb2FkIH0gZnJvbSAnLi9sb2FkLXJlc3VsdC1jYWNoZSc7XG5pbXBvcnQgeyBjcmVhdGVTb3VyY2VtYXBJbmdvcmVsaXN0UGx1Z2luIH0gZnJvbSAnLi9zb3VyY2VtYXAtaWdub3JlbGlzdC1wbHVnaW4nO1xuaW1wb3J0IHsgY3JlYXRlVmlydHVhbE1vZHVsZVBsdWdpbiB9IGZyb20gJy4vdmlydHVhbC1tb2R1bGUtcGx1Z2luJztcblxuLyoqXG4gKiBDcmVhdGUgYW4gZXNidWlsZCAnYnVpbGQnIG9wdGlvbnMgb2JqZWN0IGZvciBhbGwgZ2xvYmFsIHNjcmlwdHMgZGVmaW5lZCBpbiB0aGUgdXNlciBwcm92aWVkXG4gKiBidWlsZCBvcHRpb25zLlxuICogQHBhcmFtIG9wdGlvbnMgVGhlIGJ1aWxkZXIncyB1c2VyLXByb3ZpZGVyIG5vcm1hbGl6ZWQgb3B0aW9ucy5cbiAqIEByZXR1cm5zIEFuIGVzYnVpbGQgQnVpbGRPcHRpb25zIG9iamVjdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUdsb2JhbFNjcmlwdHNCdW5kbGVPcHRpb25zKFxuICBvcHRpb25zOiBOb3JtYWxpemVkQnJvd3Nlck9wdGlvbnMsXG4gIGluaXRpYWw6IGJvb2xlYW4sXG4gIGxvYWRDYWNoZT86IExvYWRSZXN1bHRDYWNoZSxcbik6IEJ1aWxkT3B0aW9ucyB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IHtcbiAgICBnbG9iYWxTY3JpcHRzLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgb3V0cHV0TmFtZXMsXG4gICAgcHJlc2VydmVTeW1saW5rcyxcbiAgICBzb3VyY2VtYXBPcHRpb25zLFxuICAgIHdvcmtzcGFjZVJvb3QsXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IG5hbWVzcGFjZSA9ICdhbmd1bGFyOnNjcmlwdC9nbG9iYWwnO1xuICBjb25zdCBlbnRyeVBvaW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICBsZXQgZm91bmQgPSBmYWxzZTtcbiAgZm9yIChjb25zdCBzY3JpcHQgb2YgZ2xvYmFsU2NyaXB0cykge1xuICAgIGlmIChzY3JpcHQuaW5pdGlhbCA9PT0gaW5pdGlhbCkge1xuICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgZW50cnlQb2ludHNbc2NyaXB0Lm5hbWVdID0gYCR7bmFtZXNwYWNlfToke3NjcmlwdC5uYW1lfWA7XG4gICAgfVxuICB9XG5cbiAgLy8gU2tpcCBpZiB0aGVyZSBhcmUgbm8gZW50cnkgcG9pbnRzIGZvciB0aGUgc3R5bGUgbG9hZGluZyB0eXBlXG4gIGlmIChmb3VuZCA9PT0gZmFsc2UpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGFic1dvcmtpbmdEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgYnVuZGxlOiBmYWxzZSxcbiAgICBzcGxpdHRpbmc6IGZhbHNlLFxuICAgIGVudHJ5UG9pbnRzLFxuICAgIGVudHJ5TmFtZXM6IGluaXRpYWwgPyBvdXRwdXROYW1lcy5idW5kbGVzIDogJ1tuYW1lXScsXG4gICAgYXNzZXROYW1lczogb3V0cHV0TmFtZXMubWVkaWEsXG4gICAgbWFpbkZpZWxkczogWydzY3JpcHQnLCAnYnJvd3NlcicsICdtYWluJ10sXG4gICAgY29uZGl0aW9uczogWydzY3JpcHQnXSxcbiAgICByZXNvbHZlRXh0ZW5zaW9uczogWycubWpzJywgJy5qcyddLFxuICAgIGxvZ0xldmVsOiBvcHRpb25zLnZlcmJvc2UgPyAnZGVidWcnIDogJ3NpbGVudCcsXG4gICAgbWV0YWZpbGU6IHRydWUsXG4gICAgbWluaWZ5OiBvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMsXG4gICAgb3V0ZGlyOiB3b3Jrc3BhY2VSb290LFxuICAgIHNvdXJjZW1hcDogc291cmNlbWFwT3B0aW9ucy5zY3JpcHRzICYmIChzb3VyY2VtYXBPcHRpb25zLmhpZGRlbiA/ICdleHRlcm5hbCcgOiB0cnVlKSxcbiAgICB3cml0ZTogZmFsc2UsXG4gICAgcGxhdGZvcm06ICduZXV0cmFsJyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNvdXJjZW1hcEluZ29yZWxpc3RQbHVnaW4oKSxcbiAgICAgIGNyZWF0ZVZpcnR1YWxNb2R1bGVQbHVnaW4oe1xuICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgIGV4dGVybmFsOiB0cnVlLFxuICAgICAgICAvLyBBZGQgdGhlIGBqc2AgZXh0ZW5zaW9uIGhlcmUgc28gdGhhdCBlc2J1aWxkIGdlbmVyYXRlcyBhbiBvdXRwdXQgZmlsZSB3aXRoIHRoZSBleHRlbnNpb25cbiAgICAgICAgdHJhbnNmb3JtUGF0aDogKHBhdGgpID0+IHBhdGguc2xpY2UobmFtZXNwYWNlLmxlbmd0aCArIDEpICsgJy5qcycsXG4gICAgICAgIGxvYWRDb250ZW50OiAoYXJncywgYnVpbGQpID0+XG4gICAgICAgICAgY3JlYXRlQ2FjaGVkTG9hZChsb2FkQ2FjaGUsIGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBmaWxlcyA9IGdsb2JhbFNjcmlwdHMuZmluZCgoeyBuYW1lIH0pID0+IG5hbWUgPT09IGFyZ3MucGF0aC5zbGljZSgwLCAtMykpPy5maWxlcztcbiAgICAgICAgICAgIGFzc2VydChmaWxlcywgYEludmFsaWQgb3BlcmF0aW9uOiBnbG9iYWwgc2NyaXB0cyBuYW1lIG5vdCBmb3VuZCBbJHthcmdzLnBhdGh9XWApO1xuXG4gICAgICAgICAgICAvLyBHbG9iYWwgc2NyaXB0cyBhcmUgY29uY2F0ZW5hdGVkIHVzaW5nIG1hZ2ljLXN0cmluZyBpbnN0ZWFkIG9mIGJ1bmRsZWQgdmlhIGVzYnVpbGQuXG4gICAgICAgICAgICBjb25zdCBidW5kbGVDb250ZW50ID0gbmV3IEJ1bmRsZSgpO1xuICAgICAgICAgICAgY29uc3Qgd2F0Y2hGaWxlcyA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBmaWxlbmFtZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgICBsZXQgZmlsZUNvbnRlbnQ7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gQXR0ZW1wdCB0byByZWFkIGFzIGEgcmVsYXRpdmUgcGF0aCBmcm9tIHRoZSB3b3Jrc3BhY2Ugcm9vdFxuICAgICAgICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBmaWxlQ29udGVudCA9IGF3YWl0IHJlYWRGaWxlKGZ1bGxQYXRoLCAndXRmLTgnKTtcbiAgICAgICAgICAgICAgICB3YXRjaEZpbGVzLnB1c2goZnVsbFBhdGgpO1xuICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgYXNzZXJ0SXNFcnJvcihlKTtcbiAgICAgICAgICAgICAgICBpZiAoZS5jb2RlICE9PSAnRU5PRU5UJykge1xuICAgICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBJZiBub3QgZm91bmQsIGF0dGVtcHQgdG8gcmVzb2x2ZSBhcyBhIG1vZHVsZSBzcGVjaWZpZXJcbiAgICAgICAgICAgICAgICBjb25zdCByZXNvbHZlUmVzdWx0ID0gYXdhaXQgYnVpbGQucmVzb2x2ZShmaWxlbmFtZSwge1xuICAgICAgICAgICAgICAgICAga2luZDogJ2VudHJ5LXBvaW50JyxcbiAgICAgICAgICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBpZiAocmVzb2x2ZVJlc3VsdC5lcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAvLyBSZW1vdmUgcmVzb2x1dGlvbiBmYWlsdXJlIG5vdGVzIGFib3V0IG1hcmtpbmcgYXMgZXh0ZXJuYWwgc2luY2UgaXQgZG9lc24ndCBhcHBseVxuICAgICAgICAgICAgICAgICAgLy8gdG8gZ2xvYmFsIHNjcmlwdHMuXG4gICAgICAgICAgICAgICAgICByZXNvbHZlUmVzdWx0LmVycm9ycy5mb3JFYWNoKChlcnJvcikgPT4gKGVycm9yLm5vdGVzID0gW10pKTtcblxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JzOiByZXNvbHZlUmVzdWx0LmVycm9ycyxcbiAgICAgICAgICAgICAgICAgICAgd2FybmluZ3M6IHJlc29sdmVSZXN1bHQud2FybmluZ3MsXG4gICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHdhdGNoRmlsZXMucHVzaChyZXNvbHZlUmVzdWx0LnBhdGgpO1xuICAgICAgICAgICAgICAgIGZpbGVDb250ZW50ID0gYXdhaXQgcmVhZEZpbGUocmVzb2x2ZVJlc3VsdC5wYXRoLCAndXRmLTgnKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGJ1bmRsZUNvbnRlbnQuYWRkU291cmNlKG5ldyBNYWdpY1N0cmluZyhmaWxlQ29udGVudCwgeyBmaWxlbmFtZSB9KSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGNvbnRlbnRzOiBidW5kbGVDb250ZW50LnRvU3RyaW5nKCksXG4gICAgICAgICAgICAgIGxvYWRlcjogJ2pzJyxcbiAgICAgICAgICAgICAgd2F0Y2hGaWxlcyxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSkuY2FsbChidWlsZCwgYXJncyksXG4gICAgICB9KSxcbiAgICBdLFxuICB9O1xufVxuIl19