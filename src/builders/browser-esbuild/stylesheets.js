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
Object.defineProperty(exports, "__esModule", { value: true });
exports.bundleComponentStylesheet = exports.createStylesheetBundleOptions = void 0;
const path = __importStar(require("node:path"));
const css_resource_plugin_1 = require("./css-resource-plugin");
const esbuild_1 = require("./esbuild");
const sass_plugin_1 = require("./sass-plugin");
function createStylesheetBundleOptions(options, inlineComponentData) {
    var _a, _b;
    return {
        absWorkingDir: options.workspaceRoot,
        bundle: true,
        entryNames: (_a = options.outputNames) === null || _a === void 0 ? void 0 : _a.bundles,
        assetNames: (_b = options.outputNames) === null || _b === void 0 ? void 0 : _b.media,
        logLevel: 'silent',
        minify: options.optimization,
        metafile: true,
        sourcemap: options.sourcemap,
        outdir: options.workspaceRoot,
        write: false,
        platform: 'browser',
        target: options.target,
        preserveSymlinks: options.preserveSymlinks,
        external: options.externalDependencies,
        conditions: ['style', 'sass'],
        mainFields: ['style', 'sass'],
        plugins: [
            (0, sass_plugin_1.createSassPlugin)({
                sourcemap: !!options.sourcemap,
                loadPaths: options.includePaths,
                inlineComponentData,
            }),
            (0, css_resource_plugin_1.createCssResourcePlugin)(),
        ],
    };
}
exports.createStylesheetBundleOptions = createStylesheetBundleOptions;
/**
 * Bundles a component stylesheet. The stylesheet can be either an inline stylesheet that
 * is contained within the Component's metadata definition or an external file referenced
 * from the Component's metadata definition.
 *
 * @param identifier A unique string identifier for the component stylesheet.
 * @param language The language of the stylesheet such as `css` or `scss`.
 * @param data The string content of the stylesheet.
 * @param filename The filename representing the source of the stylesheet content.
 * @param inline If true, the stylesheet source is within the component metadata;
 * if false, the source is a stylesheet file.
 * @param options An object containing the stylesheet bundling options.
 * @returns An object containing the output of the bundling operation.
 */
async function bundleComponentStylesheet(identifier, language, data, filename, inline, options) {
    const namespace = 'angular:styles/component';
    const entry = [namespace, language, identifier, filename].join(';');
    const buildOptions = createStylesheetBundleOptions(options, { [entry]: data });
    buildOptions.entryPoints = [entry];
    buildOptions.plugins.push({
        name: 'angular-component-styles',
        setup(build) {
            build.onResolve({ filter: /^angular:styles\/component;/ }, (args) => {
                if (args.kind !== 'entry-point') {
                    return null;
                }
                if (inline) {
                    return {
                        path: args.path,
                        namespace,
                    };
                }
                else {
                    return {
                        path: filename,
                    };
                }
            });
            build.onLoad({ filter: /^angular:styles\/component;css;/, namespace }, async () => {
                return {
                    contents: data,
                    loader: 'css',
                    resolveDir: path.dirname(filename),
                };
            });
        },
    });
    // Execute esbuild
    const result = await (0, esbuild_1.bundle)(options.workspaceRoot, buildOptions);
    // Extract the result of the bundling from the output files
    let contents = '';
    let map;
    let outputPath;
    const resourceFiles = [];
    if (result.outputFiles) {
        for (const outputFile of result.outputFiles) {
            const filename = path.basename(outputFile.path);
            if (filename.endsWith('.css')) {
                outputPath = outputFile.path;
                contents = outputFile.text;
            }
            else if (filename.endsWith('.css.map')) {
                map = outputFile.text;
            }
            else {
                // The output files could also contain resources (images/fonts/etc.) that were referenced
                resourceFiles.push(outputFile);
            }
        }
    }
    return {
        errors: result.errors,
        warnings: result.warnings,
        contents,
        map,
        path: outputPath,
        resourceFiles,
        metafile: result.outputFiles && result.metafile,
    };
}
exports.bundleComponentStylesheet = bundleComponentStylesheet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzaGVldHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9idWlsZGVycy9icm93c2VyLWVzYnVpbGQvc3R5bGVzaGVldHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCxnREFBa0M7QUFDbEMsK0RBQWdFO0FBQ2hFLHVDQUFtQztBQUNuQywrQ0FBaUQ7QUFhakQsU0FBZ0IsNkJBQTZCLENBQzNDLE9BQWdDLEVBQ2hDLG1CQUE0Qzs7SUFFNUMsT0FBTztRQUNMLGFBQWEsRUFBRSxPQUFPLENBQUMsYUFBYTtRQUNwQyxNQUFNLEVBQUUsSUFBSTtRQUNaLFVBQVUsRUFBRSxNQUFBLE9BQU8sQ0FBQyxXQUFXLDBDQUFFLE9BQU87UUFDeEMsVUFBVSxFQUFFLE1BQUEsT0FBTyxDQUFDLFdBQVcsMENBQUUsS0FBSztRQUN0QyxRQUFRLEVBQUUsUUFBUTtRQUNsQixNQUFNLEVBQUUsT0FBTyxDQUFDLFlBQVk7UUFDNUIsUUFBUSxFQUFFLElBQUk7UUFDZCxTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVM7UUFDNUIsTUFBTSxFQUFFLE9BQU8sQ0FBQyxhQUFhO1FBQzdCLEtBQUssRUFBRSxLQUFLO1FBQ1osUUFBUSxFQUFFLFNBQVM7UUFDbkIsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNO1FBQ3RCLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxnQkFBZ0I7UUFDMUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxvQkFBb0I7UUFDdEMsVUFBVSxFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQztRQUM3QixVQUFVLEVBQUUsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDO1FBQzdCLE9BQU8sRUFBRTtZQUNQLElBQUEsOEJBQWdCLEVBQUM7Z0JBQ2YsU0FBUyxFQUFF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O1FBQ0wsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO1FBQ3JCLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtRQUN6QixRQUFRO1FBQ1IsR0FBRztRQUNILElBQUksRUFBRSxVQUFVO1FBQ2hCLGFBQWE7UUFDYixRQUFRLEVBQUUsTUFBTSxDQUFDLFdBQVcsSUFBSSxNQUFNLENBQUMsUUFBUTtLQUNoRCxDQUFDO0FBQ0osQ0FBQztBQTFFRCw4REEwRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBCdWlsZE9wdGlvbnMsIE91dHB1dEZpbGUgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGNyZWF0ZUNzc1Jlc291cmNlUGx1Z2luIH0gZnJvbSAnLi9jc3MtcmVzb3VyY2UtcGx1Z2luJztcbmltcG9ydCB7IGJ1bmRsZSB9IGZyb20gJy4vZXNidWlsZCc7XG5pbXBvcnQgeyBjcmVhdGVTYXNzUGx1Z2luIH0gZnJvbSAnLi9zYXNzLXBsdWdpbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVuZGxlU3R5bGVzaGVldE9wdGlvbnMge1xuICB3b3Jrc3BhY2VSb290OiBzdHJpbmc7XG4gIG9wdGltaXphdGlvbjogYm9vbGVhbjtcbiAgcHJlc2VydmVTeW1saW5rcz86IGJvb2xlYW47XG4gIHNvdXJjZW1hcDogYm9vbGVhbiB8ICdleHRlcm5hbCcgfCAnaW5saW5lJztcbiAgb3V0cHV0TmFtZXM/OiB7IGJ1bmRsZXM/OiBzdHJpbmc7IG1lZGlhPzogc3RyaW5nIH07XG4gIGluY2x1ZGVQYXRocz86IHN0cmluZ1tdO1xuICBleHRlcm5hbERlcGVuZGVuY2llcz86IHN0cmluZ1tdO1xuICB0YXJnZXQ6IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU3R5bGVzaGVldEJ1bmRsZU9wdGlvbnMoXG4gIG9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLFxuICBpbmxpbmVDb21wb25lbnREYXRhPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbik6IEJ1aWxkT3B0aW9ucyAmIHsgcGx1Z2luczogTm9uTnVsbGFibGU8QnVpbGRPcHRpb25zWydwbHVnaW5zJ10+IH0ge1xuICByZXR1cm4ge1xuICAgIGFic1dvcmtpbmdEaXI6IG9wdGlvbnMud29ya3NwYWNlUm9vdCxcbiAgICBidW5kbGU6IHRydWUsXG4gICAgZW50cnlOYW1lczogb3B0aW9ucy5vdXRwdXROYW1lcz8uYnVuZGxlcyxcbiAgICBhc3NldE5hbWVzOiBvcHRpb25zLm91dHB1dE5hbWVzPy5tZWRpYSxcbiAgICBsb2dMZXZlbDogJ3NpbGVudCcsXG4gICAgbWluaWZ5OiBvcHRpb25zLm9wdGltaXphdGlvbixcbiAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICBzb3VyY2VtYXA6IG9wdGlvbnMuc291cmNlbWFwLFxuICAgIG91dGRpcjogb3B0aW9ucy53b3Jrc3BhY2VSb290LFxuICAgIHdyaXRlOiBmYWxzZSxcbiAgICBwbGF0Zm9ybTogJ2Jyb3dzZXInLFxuICAgIHRhcmdldDogb3B0aW9ucy50YXJnZXQsXG4gICAgcHJlc2VydmVTeW1saW5rczogb3B0aW9ucy5wcmVzZXJ2ZVN5bWxpbmtzLFxuICAgIGV4dGVybmFsOiBvcHRpb25zLmV4dGVybmFsRGVwZW5kZW5jaWVzLFxuICAgIGNvbmRpdGlvbnM6IFsnc3R5bGUnLCAnc2FzcyddLFxuICAgIG1haW5GaWVsZHM6IFsnc3R5bGUnLCAnc2FzcyddLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGNyZWF0ZVNhc3NQbHVnaW4oe1xuICAgICAgICBzb3VyY2VtYXA6ICEhb3B0aW9ucy5zb3VyY2VtYXAsXG4gICAgICAgIGxvYWRQYXRoczogb3B0aW9ucy5pbmNsdWRlUGF0aHMsXG4gICAgICAgIGlubGluZUNvbXBvbmVudERhdGEsXG4gICAgICB9KSxcbiAgICAgIGNyZWF0ZUNzc1Jlc291cmNlUGx1Z2luKCksXG4gICAgXSxcbiAgfTtcbn1cblxuLyoqXG4gKiBCdW5kbGVzIGEgY29tcG9uZW50IHN0eWxlc2hlZXQuIFRoZSBzdHlsZXNoZWV0IGNhbiBiZSBlaXRoZXIgYW4gaW5saW5lIHN0eWxlc2hlZXQgdGhhdFxuICogaXMgY29udGFpbmVkIHdpdGhpbiB0aGUgQ29tcG9uZW50J3MgbWV0YWRhdGEgZGVmaW5pdGlvbiBvciBhbiBleHRlcm5hbCBmaWxlIHJlZmVyZW5jZWRcbiAqIGZyb20gdGhlIENvbXBvbmVudCdzIG1ldGFkYXRhIGRlZmluaXRpb24uXG4gKlxuICogQHBhcmFtIGlkZW50aWZpZXIgQSB1bmlxdWUgc3RyaW5nIGlkZW50aWZpZXIgZm9yIHRoZSBjb21wb25lbnQgc3R5bGVzaGVldC5cbiAqIEBwYXJhbSBsYW5ndWFnZSBUaGUgbGFuZ3VhZ2Ugb2YgdGhlIHN0eWxlc2hlZXQgc3VjaCBhcyBgY3NzYCBvciBgc2Nzc2AuXG4gKiBAcGFyYW0gZGF0YSBUaGUgc3RyaW5nIGNvbnRlbnQgb2YgdGhlIHN0eWxlc2hlZXQuXG4gKiBAcGFyYW0gZmlsZW5hbWUgVGhlIGZpbGVuYW1lIHJlcHJlc2VudGluZyB0aGUgc291cmNlIG9mIHRoZSBzdHlsZXNoZWV0IGNvbnRlbnQuXG4gKiBAcGFyYW0gaW5saW5lIElmIHRydWUsIHRoZSBzdHlsZXNoZWV0IHNvdXJjZSBpcyB3aXRoaW4gdGhlIGNvbXBvbmVudCBtZXRhZGF0YTtcbiAqIGlmIGZhbHNlLCB0aGUgc291cmNlIGlzIGEgc3R5bGVzaGVldCBmaWxlLlxuICogQHBhcmFtIG9wdGlvbnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHN0eWxlc2hlZXQgYnVuZGxpbmcgb3B0aW9ucy5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBvdXRwdXQgb2YgdGhlIGJ1bmRsaW5nIG9wZXJhdGlvbi5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGJ1bmRsZUNvbXBvbmVudFN0eWxlc2hlZXQoXG4gIGlkZW50aWZpZXI6IHN0cmluZyxcbiAgbGFuZ3VhZ2U6IHN0cmluZyxcbiAgZGF0YTogc3RyaW5nLFxuICBmaWxlbmFtZTogc3RyaW5nLFxuICBpbmxpbmU6IGJvb2xlYW4sXG4gIG9wdGlvbnM6IEJ1bmRsZVN0eWxlc2hlZXRPcHRpb25zLFxuKSB7XG4gIGNvbnN0IG5hbWVzcGFjZSA9ICdhbmd1bGFyOnN0eWxlcy9jb21wb25lbnQnO1xuICBjb25zdCBlbnRyeSA9IFtuYW1lc3BhY2UsIGxhbmd1YWdlLCBpZGVudGlmaWVyLCBmaWxlbmFtZV0uam9pbignOycpO1xuXG4gIGNvbnN0IGJ1aWxkT3B0aW9ucyA9IGNyZWF0ZVN0eWxlc2hlZXRCdW5kbGVPcHRpb25zKG9wdGlvbnMsIHsgW2VudHJ5XTogZGF0YSB9KTtcbiAgYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzID0gW2VudHJ5XTtcbiAgYnVpbGRPcHRpb25zLnBsdWdpbnMucHVzaCh7XG4gICAgbmFtZTogJ2FuZ3VsYXItY29tcG9uZW50LXN0eWxlcycsXG4gICAgc2V0dXAoYnVpbGQpIHtcbiAgICAgIGJ1aWxkLm9uUmVzb2x2ZSh7IGZpbHRlcjogL15hbmd1bGFyOnN0eWxlc1xcL2NvbXBvbmVudDsvIH0sIChhcmdzKSA9PiB7XG4gICAgICAgIGlmIChhcmdzLmtpbmQgIT09ICdlbnRyeS1wb2ludCcpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbmxpbmUpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGF0aDogYXJncy5wYXRoLFxuICAgICAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBhdGg6IGZpbGVuYW1lLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgYnVpbGQub25Mb2FkKHsgZmlsdGVyOiAvXmFuZ3VsYXI6c3R5bGVzXFwvY29tcG9uZW50O2NzczsvLCBuYW1lc3BhY2UgfSwgYXN5bmMgKCkgPT4ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvbnRlbnRzOiBkYXRhLFxuICAgICAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICAgICAgcmVzb2x2ZURpcjogcGF0aC5kaXJuYW1lKGZpbGVuYW1lKSxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH0pO1xuXG4gIC8vIEV4ZWN1dGUgZXNidWlsZFxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBidW5kbGUob3B0aW9ucy53b3Jrc3BhY2VSb290LCBidWlsZE9wdGlvbnMpO1xuXG4gIC8vIEV4dHJhY3QgdGhlIHJlc3VsdCBvZiB0aGUgYnVuZGxpbmcgZnJvbSB0aGUgb3V0cHV0IGZpbGVzXG4gIGxldCBjb250ZW50cyA9ICcnO1xuICBsZXQgbWFwO1xuICBsZXQgb3V0cHV0UGF0aDtcbiAgY29uc3QgcmVzb3VyY2VGaWxlczogT3V0cHV0RmlsZVtdID0gW107XG4gIGlmIChyZXN1bHQub3V0cHV0RmlsZXMpIHtcbiAgICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2YgcmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgICBjb25zdCBmaWxlbmFtZSA9IHBhdGguYmFzZW5hbWUob3V0cHV0RmlsZS5wYXRoKTtcbiAgICAgIGlmIChmaWxlbmFtZS5lbmRzV2l0aCgnLmNzcycpKSB7XG4gICAgICAgIG91dHB1dFBhdGggPSBvdXRwdXRGaWxlLnBhdGg7XG4gICAgICAgIGNvbnRlbnRzID0gb3V0cHV0RmlsZS50ZXh0O1xuICAgICAgfSBlbHNlIGlmIChmaWxlbmFtZS5lbmRzV2l0aCgnLmNzcy5tYXAnKSkge1xuICAgICAgICBtYXAgPSBvdXRwdXRGaWxlLnRleHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGUgb3V0cHV0IGZpbGVzIGNvdWxkIGFsc28gY29udGFpbiByZXNvdXJjZXMgKGltYWdlcy9mb250cy9ldGMuKSB0aGF0IHdlcmUgcmVmZXJlbmNlZFxuICAgICAgICByZXNvdXJjZUZpbGVzLnB1c2gob3V0cHV0RmlsZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBlcnJvcnM6IHJlc3VsdC5lcnJvcnMsXG4gICAgd2FybmluZ3M6IHJlc3VsdC53YXJuaW5ncyxcbiAgICBjb250ZW50cyxcbiAgICBtYXAsXG4gICAgcGF0aDogb3V0cHV0UGF0aCxcbiAgICByZXNvdXJjZUZpbGVzLFxuICAgIG1ldGFmaWxlOiByZXN1bHQub3V0cHV0RmlsZXMgJiYgcmVzdWx0Lm1ldGFmaWxlLFxuICB9O1xufVxuIl19