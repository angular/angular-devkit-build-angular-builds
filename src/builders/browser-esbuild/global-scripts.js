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
const sourcemap_ignorelist_plugin_1 = require("./sourcemap-ignorelist-plugin");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xvYmFsLXNjcmlwdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvZ2xvYmFsLXNjcmlwdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCw2REFBbUQ7QUFDbkQsOERBQWlDO0FBQ2pDLCtDQUE0QztBQUU1QywrRUFBZ0Y7QUFFaEY7Ozs7O0dBS0c7QUFDSCxTQUFnQixnQ0FBZ0MsQ0FBQyxPQUFpQztJQUNoRixNQUFNLEVBQ0osYUFBYSxFQUNiLG1CQUFtQixFQUNuQixXQUFXLEVBQ1gsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixhQUFhLEdBQ2QsR0FBRyxPQUFPLENBQUM7SUFFWixNQUFNLFNBQVMsR0FBRyx1QkFBdUIsQ0FBQztJQUMxQyxNQUFNLFdBQVcsR0FBMkIsRUFBRSxDQUFDO0lBQy9DLEtBQUssTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLGFBQWEsRUFBRTtRQUNwQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxTQUFTLElBQUksSUFBSSxFQUFFLENBQUM7S0FDNUM7SUFFRCxPQUFPO1FBQ0wsYUFBYSxFQUFFLGFBQWE7UUFDNUIsTUFBTSxFQUFFLEtBQUs7UUFDYixTQUFTLEVBQUUsS0FBSztRQUNoQixXQUFXO1FBQ1gsVUFBVSxFQUFFLFdBQVcsQ0FBQyxPQUFPO1FBQy9CLFVBQVUsRUFBRSxXQUFXLENBQUMsS0FBSztRQUM3QixVQUFVLEVBQUUsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sQ0FBQztRQUN6QyxVQUFVLEVBQUUsQ0FBQyxRQUFRLENBQUM7UUFDdEIsaUJBQWlCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDO1FBQ2xDLFFBQVEs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QUFXLENBQUMsV0FBVyxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDO3lCQUNyRTt3QkFFRCxPQUFPOzRCQUNMLFFBQVEsRUFBRSxhQUFhLENBQUMsUUFBUSxFQUFFOzRCQUNsQyxNQUFNLEVBQUUsSUFBSTt5QkFDYixDQUFDO29CQUNKLENBQUMsQ0FBQyxDQUFDO2dCQUNMLENBQUM7YUFDRjtTQUNGO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUE5RkQsNEVBOEZDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zIH0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgTWFnaWNTdHJpbmcsIHsgQnVuZGxlIH0gZnJvbSAnbWFnaWMtc3RyaW5nJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRCcm93c2VyT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgeyBjcmVhdGVTb3VyY2VtYXBJbmdvcmVsaXN0UGx1Z2luIH0gZnJvbSAnLi9zb3VyY2VtYXAtaWdub3JlbGlzdC1wbHVnaW4nO1xuXG4vKipcbiAqIENyZWF0ZSBhbiBlc2J1aWxkICdidWlsZCcgb3B0aW9ucyBvYmplY3QgZm9yIGFsbCBnbG9iYWwgc2NyaXB0cyBkZWZpbmVkIGluIHRoZSB1c2VyIHByb3ZpZWRcbiAqIGJ1aWxkIG9wdGlvbnMuXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgYnVpbGRlcidzIHVzZXItcHJvdmlkZXIgbm9ybWFsaXplZCBvcHRpb25zLlxuICogQHJldHVybnMgQW4gZXNidWlsZCBCdWlsZE9wdGlvbnMgb2JqZWN0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlR2xvYmFsU2NyaXB0c0J1bmRsZU9wdGlvbnMob3B0aW9uczogTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zKTogQnVpbGRPcHRpb25zIHtcbiAgY29uc3Qge1xuICAgIGdsb2JhbFNjcmlwdHMsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBvdXRwdXROYW1lcyxcbiAgICBwcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIHNvdXJjZW1hcE9wdGlvbnMsXG4gICAgd29ya3NwYWNlUm9vdCxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgY29uc3QgbmFtZXNwYWNlID0gJ2FuZ3VsYXI6c2NyaXB0L2dsb2JhbCc7XG4gIGNvbnN0IGVudHJ5UG9pbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gIGZvciAoY29uc3QgeyBuYW1lIH0gb2YgZ2xvYmFsU2NyaXB0cykge1xuICAgIGVudHJ5UG9pbnRzW25hbWVdID0gYCR7bmFtZXNwYWNlfToke25hbWV9YDtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgYWJzV29ya2luZ0Rpcjogd29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IGZhbHNlLFxuICAgIHNwbGl0dGluZzogZmFsc2UsXG4gICAgZW50cnlQb2ludHMsXG4gICAgZW50cnlOYW1lczogb3V0cHV0TmFtZXMuYnVuZGxlcyxcbiAgICBhc3NldE5hbWVzOiBvdXRwdXROYW1lcy5tZWRpYSxcbiAgICBtYWluRmllbGRzOiBbJ3NjcmlwdCcsICdicm93c2VyJywgJ21haW4nXSxcbiAgICBjb25kaXRpb25zOiBbJ3NjcmlwdCddLFxuICAgIHJlc29sdmVFeHRlbnNpb25zOiBbJy5tanMnLCAnLmpzJ10sXG4gICAgbG9nTGV2ZWw6IG9wdGlvbnMudmVyYm9zZSA/ICdkZWJ1ZycgOiAnc2lsZW50JyxcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBtaW5pZnk6IG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyxcbiAgICBvdXRkaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgc291cmNlbWFwOiBzb3VyY2VtYXBPcHRpb25zLnNjcmlwdHMgJiYgKHNvdXJjZW1hcE9wdGlvbnMuaGlkZGVuID8gJ2V4dGVybmFsJyA6IHRydWUpLFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwbGF0Zm9ybTogJ25ldXRyYWwnLFxuICAgIHByZXNlcnZlU3ltbGlua3MsXG4gICAgcGx1Z2luczogW1xuICAgICAgY3JlYXRlU291cmNlbWFwSW5nb3JlbGlzdFBsdWdpbigpLFxuICAgICAge1xuICAgICAgICBuYW1lOiAnYW5ndWxhci1nbG9iYWwtc2NyaXB0cycsXG4gICAgICAgIHNldHVwKGJ1aWxkKSB7XG4gICAgICAgICAgYnVpbGQub25SZXNvbHZlKHsgZmlsdGVyOiAvXmFuZ3VsYXI6c2NyaXB0XFwvZ2xvYmFsOi8gfSwgKGFyZ3MpID0+IHtcbiAgICAgICAgICAgIGlmIChhcmdzLmtpbmQgIT09ICdlbnRyeS1wb2ludCcpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIC8vIEFkZCB0aGUgYGpzYCBleHRlbnNpb24gaGVyZSBzbyB0aGF0IGVzYnVpbGQgZ2VuZXJhdGVzIGFuIG91dHB1dCBmaWxlIHdpdGggdGhlIGV4dGVuc2lvblxuICAgICAgICAgICAgICBwYXRoOiBhcmdzLnBhdGguc2xpY2UobmFtZXNwYWNlLmxlbmd0aCArIDEpICsgJy5qcycsXG4gICAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgLy8gQWxsIHJlZmVyZW5jZXMgd2l0aGluIGEgZ2xvYmFsIHNjcmlwdCBzaG91bGQgYmUgY29uc2lkZXJlZCBleHRlcm5hbC4gVGhpcyBtYWludGFpbnMgdGhlIHJ1bnRpbWVcbiAgICAgICAgICAvLyBiZWhhdmlvciBvZiB0aGUgc2NyaXB0IGFzIGlmIGl0IHdlcmUgYWRkZWQgZGlyZWN0bHkgdG8gYSBzY3JpcHQgZWxlbWVudCBmb3IgcmVmZXJlbmNlZCBpbXBvcnRzLlxuICAgICAgICAgIGJ1aWxkLm9uUmVzb2x2ZSh7IGZpbHRlcjogLy4vLCBuYW1lc3BhY2UgfSwgKHsgcGF0aCB9KSA9PiB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgICBleHRlcm5hbDogdHJ1ZSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvLi8sIG5hbWVzcGFjZSB9LCBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAgICAgY29uc3QgZmlsZXMgPSBnbG9iYWxTY3JpcHRzLmZpbmQoKHsgbmFtZSB9KSA9PiBuYW1lID09PSBhcmdzLnBhdGguc2xpY2UoMCwgLTMpKT8uZmlsZXM7XG4gICAgICAgICAgICBhc3NlcnQoZmlsZXMsIGBJbnZhbGlkIG9wZXJhdGlvbjogZ2xvYmFsIHNjcmlwdHMgbmFtZSBub3QgZm91bmQgWyR7YXJncy5wYXRofV1gKTtcblxuICAgICAgICAgICAgLy8gR2xvYmFsIHNjcmlwdHMgYXJlIGNvbmNhdGVuYXRlZCB1c2luZyBtYWdpYy1zdHJpbmcgaW5zdGVhZCBvZiBidW5kbGVkIHZpYSBlc2J1aWxkLlxuICAgICAgICAgICAgY29uc3QgYnVuZGxlQ29udGVudCA9IG5ldyBCdW5kbGUoKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZW5hbWUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgICAgY29uc3QgcmVzb2x2ZVJlc3VsdCA9IGF3YWl0IGJ1aWxkLnJlc29sdmUoZmlsZW5hbWUsIHtcbiAgICAgICAgICAgICAgICBraW5kOiAnZW50cnktcG9pbnQnLFxuICAgICAgICAgICAgICAgIHJlc29sdmVEaXI6IHdvcmtzcGFjZVJvb3QsXG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIGlmIChyZXNvbHZlUmVzdWx0LmVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgcmVzb2x1dGlvbiBmYWlsdXJlIG5vdGVzIGFib3V0IG1hcmtpbmcgYXMgZXh0ZXJuYWwgc2luY2UgaXQgZG9lc24ndCBhcHBseVxuICAgICAgICAgICAgICAgIC8vIHRvIGdsb2JhbCBzY3JpcHRzLlxuICAgICAgICAgICAgICAgIHJlc29sdmVSZXN1bHQuZXJyb3JzLmZvckVhY2goKGVycm9yKSA9PiAoZXJyb3Iubm90ZXMgPSBbXSkpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgIGVycm9yczogcmVzb2x2ZVJlc3VsdC5lcnJvcnMsXG4gICAgICAgICAgICAgICAgICB3YXJuaW5nczogcmVzb2x2ZVJlc3VsdC53YXJuaW5ncyxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgZmlsZUNvbnRlbnQgPSBhd2FpdCByZWFkRmlsZShyZXNvbHZlUmVzdWx0LnBhdGgsICd1dGYtOCcpO1xuICAgICAgICAgICAgICBidW5kbGVDb250ZW50LmFkZFNvdXJjZShuZXcgTWFnaWNTdHJpbmcoZmlsZUNvbnRlbnQsIHsgZmlsZW5hbWUgfSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBjb250ZW50czogYnVuZGxlQ29udGVudC50b1N0cmluZygpLFxuICAgICAgICAgICAgICBsb2FkZXI6ICdqcycsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xufVxuIl19