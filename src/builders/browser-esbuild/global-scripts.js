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
                    build.onLoad({ filter: /./, namespace }, (0, load_result_cache_1.createCachedLoad)(loadCache, async (args) => {
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
                    }));
                },
            },
        ],
    };
}
exports.createGlobalScriptsBundleOptions = createGlobalScriptsBundleOptions;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xvYmFsLXNjcmlwdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvZ2xvYmFsLXNjcmlwdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCw2REFBbUQ7QUFDbkQsOERBQWlDO0FBQ2pDLCtDQUE0QztBQUM1QywwREFBNkI7QUFDN0IsNkNBQWtEO0FBQ2xELDJEQUF3RTtBQUV4RSwrRUFBZ0Y7QUFFaEY7Ozs7O0dBS0c7QUFDSCxTQUFnQixnQ0FBZ0MsQ0FDOUMsT0FBaUMsRUFDakMsT0FBZ0IsRUFDaEIsU0FBMkI7SUFFM0IsTUFBTSxFQUNKLGFBQWEsRUFDYixtQkFBbUIsRUFDbkIsV0FBVyxFQUNYLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsYUFBYSxHQUNkLEdBQUcsT0FBTyxDQUFDO0lBRVosTUFBTSxTQUFTLEdBQUcsdUJBQXVCLENBQUM7SUFDMUMsTUFBTSxXQUFXLEdBQTJCLEVBQUUsQ0FBQztJQUMvQyxJQUFJLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDbEIsS0FBSyxNQUFNLE1BQU0sSUFBSSxhQUFhLEVBQUU7UUFDbEMsSUFBSSxNQUFNLENBQUMsT0FBTyxLQUFLLE9BQU8sRUFBRTtZQUM5QixLQUFLLEdBQUcsSUFBSSxDQUFDO1lBQ2IsV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLFNBQVMsSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7U0FDMUQ7S0FDRjtJQUVELCtEQUErRDtJQUMvRCxJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUU7UUFDbkIsT0FBTztLQUNSO0lBRUQsT0FBTztRQUNMLGFBQWEsRUFBRSxhQUFhO1FBQzVCLE1BQU0sRUFB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Q1gsQ0FBQztvQkFDSixDQUFDLENBQUMsQ0FDSCxDQUFDO2dCQUNKLENBQUM7YUFDRjtTQUNGO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFqSUQsNEVBaUlDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgTWFnaWNTdHJpbmcsIHsgQnVuZGxlIH0gZnJvbSAnbWFnaWMtc3RyaW5nJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBhc3NlcnRJc0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3InO1xuaW1wb3J0IHsgTG9hZFJlc3VsdENhY2hlLCBjcmVhdGVDYWNoZWRMb2FkIH0gZnJvbSAnLi9sb2FkLXJlc3VsdC1jYWNoZSc7XG5pbXBvcnQgdHlwZSB7IE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgeyBjcmVhdGVTb3VyY2VtYXBJbmdvcmVsaXN0UGx1Z2luIH0gZnJvbSAnLi9zb3VyY2VtYXAtaWdub3JlbGlzdC1wbHVnaW4nO1xuXG4vKipcbiAqIENyZWF0ZSBhbiBlc2J1aWxkICdidWlsZCcgb3B0aW9ucyBvYmplY3QgZm9yIGFsbCBnbG9iYWwgc2NyaXB0cyBkZWZpbmVkIGluIHRoZSB1c2VyIHByb3ZpZWRcbiAqIGJ1aWxkIG9wdGlvbnMuXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgYnVpbGRlcidzIHVzZXItcHJvdmlkZXIgbm9ybWFsaXplZCBvcHRpb25zLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBCdWlsZE9wdGlvbnMgb2JqZWN0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlR2xvYmFsU2NyaXB0c0J1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyxcbiAgaW5pdGlhbDogYm9vbGVhbixcbiAgbG9hZENhY2hlPzogTG9hZFJlc3VsdENhY2hlLFxuKTogQnVpbGRPcHRpb25zIHwgdW5kZWZpbmVkIHtcbiAgY29uc3Qge1xuICAgIGdsb2JhbFNjcmlwdHMsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6c2NyaXB0L2dsb2JhbCc7XG4gIGNvbnN0IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gIGxldCBmb3VuZCA9IGZhbHNlO1xuICBmb3IgKGNvbnN0IHNjcmlwdCBvZiBnbG9iYWxTY3JpcHRzKSB7XG4gICAgaWYgKHNjcmlwdC5pbml0aWFsID09PSBpbml0aWFsKSB7XG4gICAgICBmb3VuZCA9IHRydWU7XG4gICAgICBlbnRyeVBvaW50c1tzY3JpcHQubmFtZV0gPSBgJHtuYW1lc3BhY2V9OiR7c2NyaXB0Lm5hbWV9YDtcbiAgICB9XG4gIH1cblxuICAvLyBTa2lwIGlmIHRoZXJlIGFyZSBubyBlbnRyeSBwb2ludHMgZm9yIHRoZSBzdHlsZSBsb2FkaW5nIHR5cGVcbiAgaWYgKGZvdW5kID09PSBmYWxzZSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgYWJzV29ya2luZ0Rpcjogd29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IGZhbHNlLFxuICAgIHNwbGl0dGluZzogZmFsc2UsXG4gICAgZW50cnlQb2ludHMsXG4gICAgZW50cnlOYW1lczogaW5pdGlhbCA/IG91dHB1dE5hbWVzLmJ1bmRsZXMgOiAnW25hbWVdJyxcbiAgICBhc3NldE5hbWVzOiBvdXRwdXROYW1lcy5tZWRpYSxcbiAgICBtYWluRmllbGRzOiBbJ3NjcmlwdCcsICdicm93c2VyJywgJ21haW4nXSxcbiAgICBjb25kaXRpb25zOiBbJ3NjcmlwdCddLFxuICAgIHJlc29sdmVFeHRlbnNpb25zOiBbJy5tanMnLCAnLmpzJ10sXG4gICAgbG9nTGV2ZWw6IG9wdGlvbnMudmVyYm9zZSA/ICdkZWJ1ZycgOiAnc2lsZW50JyxcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBtaW5pZnk6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBvdXRkaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgc291cmNlbWFwOiBzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gJ2V4dGVybmFsJyA6IHRydWUpLFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwbGF0Zm9ybTogJ25ldXRyYWwnLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlU291cmNlbWFwSW5nb3JlbGlzdFBsdWdpbigpLFxuICAgICAge1xuICAgICAgICBuYW1lOiAnYW5ndWxhci1nbG9iYWwtc2NyaXB0cycsXG4gICAgICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICAgICAgYnVpbGQub25SZXNvbHZlKHsgZmlsdGVyOiAvXmFuZ3VsYXI6c2NyaXB0XFwvZ2xvYmFsOi8gfSwgKGFyZ3MpID0+IHtcbiAgICAgICAgICAgIGlmIChhcmdzLmtpbmQgIT09ICdlbnRyeS1wb2ludCcpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIC8vIEFkZCB0aGUgYGpzYCBleHRlbnNpb24gaGVyZSBzbyB0aGF0IGVzYnVpbGQgZ2VuZXJhdGVzIGFuIG91dHB1dCBmaWxlIHdpdGggdGhlIGV4dGVuc2lvblxuICAgICAgICAgICAgICBwYXRoOiBhcmdzLnBhdGguc2xpY2UobmFtZXNwYWNlLmxlbmd0aCArIDEpICsgJy5qcycsXG4gICAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgLy8gQWxsIHJlZmVyZW5jZXMgd2l0aGluIGEgZ2xvYmFsIHNjcmlwdCBzaG91bGQgYmUgY29uc2lkZXJlZCBleHRlcm5hbC4gVGhpcyBtYWludGFpbnMgdGhlIHJ1bnRpbWVcbiAgICAgICAgICAvLyBiZWhhdmlvciBvZiB0aGUgc2NyaXB0IGFzIGlmIGl0IHdlcmUgYWRkZWQgZGlyZWN0bHkgdG8gYSBzY3JpcHQgZWxlbWVudCBmb3IgcmVmZXJlbmNlZCBpbXBvcnRzLlxuICAgICAgICAgIGJ1aWxkLm9uUmVzb2x2ZSh7IGZpbHRlcjogLy4vLCBuYW1lc3BhY2UgfSwgKHsgcGF0aCB9KSA9PiB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgICBleHRlcm5hbDogdHJ1ZSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgYnVpbGQub25Mb2FkKFxuICAgICAgICAgICAgeyBmaWx0ZXI6IC8uLywgbmFtZXNwYWNlIH0sXG4gICAgICAgICAgICBjcmVhdGVDYWNoZWRMb2FkKGxvYWRDYWNoZSwgYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBnbG9iYWxTY3JpcHRzLmZpbmQoXG4gICAgICAgICAgICAgICAgKHsgbmFtZSB9KSA9PiBuYW1lID09PSBhcmdzLnBhdGguc2xpY2UoMCwgLTMpLFxuICAgICAgICAgICAgICApPy5maWxlcztcbiAgICAgICAgICAgICAgYXNzZXJ0KGZpbGVzLCBgSW52YWxpZCBvcGVyYXRpb246IGdsb2JhbCBzY3JpcHRzIG5hbWUgbm90IGZvdW5kIFske2FyZ3MucGF0aH1dYCk7XG5cbiAgICAgICAgICAgICAgLy8gR2xvYmFsIHNjcmlwdHMgYXJlIGNvbmNhdGVuYXRlZCB1c2luZyBtYWdpYy1zdHJpbmcgaW5zdGVhZCBvZiBidW5kbGVkIHZpYSBlc2J1aWxkLlxuICAgICAgICAgICAgICBjb25zdCBidW5kbGVDb250ZW50ID0gbmV3IEJ1bmRsZSgpO1xuICAgICAgICAgICAgICBjb25zdCB3YXRjaEZpbGVzID0gW107XG4gICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZW5hbWUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgICAgICBsZXQgZmlsZUNvbnRlbnQ7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIC8vIEF0dGVtcHQgdG8gcmVhZCBhcyBhIHJlbGF0aXZlIHBhdGggZnJvbSB0aGUgd29ya3NwYWNlIHJvb3RcbiAgICAgICAgICAgICAgICAgIGZpbGVDb250ZW50ID0gYXdhaXQgcmVhZEZpbGUocGF0aC5qb2luKHdvcmtzcGFjZVJvb3QsIGZpbGVuYW1lKSwgJ3V0Zi04Jyk7XG4gICAgICAgICAgICAgICAgICB3YXRjaEZpbGVzLnB1c2goZmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgIGFzc2VydElzRXJyb3IoZSk7XG4gICAgICAgICAgICAgICAgICBpZiAoZS5jb2RlICE9PSAnRU5PRU5UJykge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAvLyBJZiBub3QgZm91bmQgYXR0ZW1wdCB0byByZXNvbHZlIGFzIGEgbW9kdWxlIHNwZWNpZmllclxuICAgICAgICAgICAgICAgICAgY29uc3QgcmVzb2x2ZVJlc3VsdCA9IGF3YWl0IGJ1aWxkLnJlc29sdmUoZmlsZW5hbWUsIHtcbiAgICAgICAgICAgICAgICAgICAga2luZDogJ2VudHJ5LXBvaW50JyxcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZURpcjogd29ya3NwYWNlUm9vdCxcbiAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICBpZiAocmVzb2x2ZVJlc3VsdC5lcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJlbW92ZSByZXNvbHV0aW9uIGZhaWx1cmUgbm90ZXMgYWJvdXQgbWFya2luZyBhcyBleHRlcm5hbCBzaW5jZSBpdCBkb2Vzbid0IGFwcGx5XG4gICAgICAgICAgICAgICAgICAgIC8vIHRvIGdsb2JhbCBzY3JpcHRzLlxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlUmVzdWx0LmVycm9ycy5mb3JFYWNoKChlcnJvcikgPT4gKGVycm9yLm5vdGVzID0gW10pKTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgIGVycm9yczogcmVzb2x2ZVJlc3VsdC5lcnJvcnMsXG4gICAgICAgICAgICAgICAgICAgICAgd2FybmluZ3M6IHJlc29sdmVSZXN1bHQud2FybmluZ3MsXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIHdhdGNoRmlsZXMucHVzaChwYXRoLnJlbGF0aXZlKHJlc29sdmVSZXN1bHQucGF0aCwgd29ya3NwYWNlUm9vdCkpO1xuICAgICAgICAgICAgICAgICAgZmlsZUNvbnRlbnQgPSBhd2FpdCByZWFkRmlsZShyZXNvbHZlUmVzdWx0LnBhdGgsICd1dGYtOCcpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGJ1bmRsZUNvbnRlbnQuYWRkU291cmNlKG5ldyBNYWdpY1N0cmluZyhmaWxlQ29udGVudCwgeyBmaWxlbmFtZSB9KSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGNvbnRlbnRzOiBidW5kbGVDb250ZW50LnRvU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgbG9hZGVyOiAnanMnLFxuICAgICAgICAgICAgICAgIHdhdGNoRmlsZXMsXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICApO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xufVxuIl19