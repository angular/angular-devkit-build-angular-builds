"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateIndexHtml = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const node_path_1 = __importDefault(require("node:path"));
const index_html_generator_1 = require("../../utils/index-file/index-html-generator");
const inline_critical_css_1 = require("../../utils/index-file/inline-critical-css");
async function generateIndexHtml(initialFiles, outputFiles, buildOptions, lang) {
    // Analyze metafile for initial link-based hints.
    // Skip if the internal externalPackages option is enabled since this option requires
    // dev server cooperation to properly resolve and fetch imports.
    const hints = [];
    const { indexHtmlOptions, externalPackages, optimizationOptions, crossOrigin, subresourceIntegrity, baseHref, } = buildOptions;
    (0, node_assert_1.default)(indexHtmlOptions, 'indexHtmlOptions cannot be undefined.');
    if (!externalPackages) {
        for (const [key, value] of initialFiles) {
            if (value.entrypoint) {
                // Entry points are already referenced in the HTML
                continue;
            }
            if (value.type === 'script') {
                hints.push({ url: key, mode: 'modulepreload' });
            }
            else if (value.type === 'style') {
                // Provide an "as" value of "style" to ensure external URLs which may not have a
                // file extension are treated as stylesheets.
                hints.push({ url: key, mode: 'preload', as: 'style' });
            }
        }
    }
    /** Virtual output path to support reading in-memory files. */
    const virtualOutputPath = '/';
    const readAsset = async function (filePath) {
        // Remove leading directory separator
        const relativefilePath = node_path_1.default.relative(virtualOutputPath, filePath);
        const file = outputFiles.find((file) => file.path === relativefilePath);
        if (file) {
            return file.text;
        }
        throw new Error(`Output file does not exist: ${relativefilePath}`);
    };
    // Create an index HTML generator that reads from the in-memory output files
    const indexHtmlGenerator = new index_html_generator_1.IndexHtmlGenerator({
        indexPath: indexHtmlOptions.input,
        entrypoints: indexHtmlOptions.insertionOrder,
        sri: subresourceIntegrity,
        optimization: {
            ...optimizationOptions,
            styles: {
                ...optimizationOptions.styles,
                inlineCritical: false, // Disable critical css inline as for SSR and SSG this will be done during rendering.
            },
        },
        crossOrigin: crossOrigin,
    });
    indexHtmlGenerator.readAsset = readAsset;
    const transformResult = await indexHtmlGenerator.process({
        baseHref,
        lang,
        outputPath: virtualOutputPath,
        files: [...initialFiles].map(([file, record]) => ({
            name: record.name ?? '',
            file,
            extension: node_path_1.default.extname(file),
        })),
        hints,
    });
    const contentWithoutCriticalCssInlined = transformResult.content;
    if (!optimizationOptions.styles.inlineCritical) {
        return {
            ...transformResult,
            contentWithoutCriticalCssInlined,
        };
    }
    const inlineCriticalCssProcessor = new inline_critical_css_1.InlineCriticalCssProcessor({
        minify: false,
        readAsset,
    });
    const { content, errors, warnings } = await inlineCriticalCssProcessor.process(contentWithoutCriticalCssInlined, {
        outputPath: virtualOutputPath,
    });
    return {
        errors: [...transformResult.errors, ...errors],
        warnings: [...transformResult.warnings, ...warnings],
        content,
        contentWithoutCriticalCssInlined,
    };
}
exports.generateIndexHtml = generateIndexHtml;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgtaHRtbC1nZW5lcmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2luZGV4LWh0bWwtZ2VuZXJhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUdILDhEQUFpQztBQUNqQywwREFBNkI7QUFFN0Isc0ZBQWlGO0FBQ2pGLG9GQUF3RjtBQUdqRixLQUFLLFVBQVUsaUJBQWlCLENBQ3JDLFlBQTRDLEVBQzVDLFdBQXlCLEVBQ3pCLFlBQStDLEVBQy9DLElBQWE7SUFPYixpREFBaUQ7SUFDakQscUZBQXFGO0lBQ3JGLGdFQUFnRTtJQUNoRSxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUM7SUFDakIsTUFBTSxFQUNKLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsbUJBQW1CLEVBQ25CLFdBQVcsRUFDWCxvQkFBb0IsRUFDcEIsUUFBUSxHQUNULEdBQUcsWUFBWSxDQUFDO0lBRWpCLElBQUEscUJBQU0sRUFBQyxnQkFBZ0IsRUFBRSx1Q0FBdUMsQ0FBQyxDQUFDO0lBRWxFLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtRQUNyQixLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLElBQUksWUFBWSxFQUFFO1lBQ3ZDLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRTtnQkFDcEIsa0RBQWtEO2dCQUNsRCxTQUFTO2FBQ1Y7WUFDRCxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO2dCQUMzQixLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsZUFBd0IsRUFBRSxDQUFDLENBQUM7YUFDMUQ7aUJBQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBRTtnQkFDakMsZ0ZBQWdG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ZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHsgT3V0cHV0RmlsZSB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zIH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYXBwbGljYXRpb24vb3B0aW9ucyc7XG5pbXBvcnQgeyBJbmRleEh0bWxHZW5lcmF0b3IgfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2luZGV4LWh0bWwtZ2VuZXJhdG9yJztcbmltcG9ydCB7IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmxpbmUtY3JpdGljYWwtY3NzJztcbmltcG9ydCB7IEluaXRpYWxGaWxlUmVjb3JkIH0gZnJvbSAnLi9idW5kbGVyLWNvbnRleHQnO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVJbmRleEh0bWwoXG4gIGluaXRpYWxGaWxlczogTWFwPHN0cmluZywgSW5pdGlhbEZpbGVSZWNvcmQ+LFxuICBvdXRwdXRGaWxlczogT3V0cHV0RmlsZVtdLFxuICBidWlsZE9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyxcbiAgbGFuZz86IHN0cmluZyxcbik6IFByb21pc2U8e1xuICBjb250ZW50OiBzdHJpbmc7XG4gIGNvbnRlbnRXaXRob3V0Q3JpdGljYWxDc3NJbmxpbmVkOiBzdHJpbmc7XG4gIHdhcm5pbmdzOiBzdHJpbmdbXTtcbiAgZXJyb3JzOiBzdHJpbmdbXTtcbn0+IHtcbiAgLy8gQW5hbHl6ZSBtZXRhZmlsZSBmb3IgaW5pdGlhbCBsaW5rLWJhc2VkIGhpbnRzLlxuICAvLyBTa2lwIGlmIHRoZSBpbnRlcm5hbCBleHRlcm5hbFBhY2thZ2VzIG9wdGlvbiBpcyBlbmFibGVkIHNpbmNlIHRoaXMgb3B0aW9uIHJlcXVpcmVzXG4gIC8vIGRldiBzZXJ2ZXIgY29vcGVyYXRpb24gdG8gcHJvcGVybHkgcmVzb2x2ZSBhbmQgZmV0Y2ggaW1wb3J0cy5cbiAgY29uc3QgaGludHMgPSBbXTtcbiAgY29uc3Qge1xuICAgIGluZGV4SHRtbE9wdGlvbnMsXG4gICAgZXh0ZXJuYWxQYWNrYWdlcyxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIGNyb3NzT3JpZ2luLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIGJhc2VIcmVmLFxuICB9ID0gYnVpbGRPcHRpb25zO1xuXG4gIGFzc2VydChpbmRleEh0bWxPcHRpb25zLCAnaW5kZXhIdG1sT3B0aW9ucyBjYW5ub3QgYmUgdW5kZWZpbmVkLicpO1xuXG4gIGlmICghZXh0ZXJuYWxQYWNrYWdlcykge1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIGluaXRpYWxGaWxlcykge1xuICAgICAgaWYgKHZhbHVlLmVudHJ5cG9pbnQpIHtcbiAgICAgICAgLy8gRW50cnkgcG9pbnRzIGFyZSBhbHJlYWR5IHJlZmVyZW5jZWQgaW4gdGhlIEhUTUxcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAodmFsdWUudHlwZSA9PT0gJ3NjcmlwdCcpIHtcbiAgICAgICAgaGludHMucHVzaCh7IHVybDoga2V5LCBtb2RlOiAnbW9kdWxlcHJlbG9hZCcgYXMgY29uc3QgfSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlLnR5cGUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgLy8gUHJvdmlkZSBhbiBcImFzXCIgdmFsdWUgb2YgXCJzdHlsZVwiIHRvIGVuc3VyZSBleHRlcm5hbCBVUkxzIHdoaWNoIG1heSBub3QgaGF2ZSBhXG4gICAgICAgIC8vIGZpbGUgZXh0ZW5zaW9uIGFyZSB0cmVhdGVkIGFzIHN0eWxlc2hlZXRzLlxuICAgICAgICBoaW50cy5wdXNoKHsgdXJsOiBrZXksIG1vZGU6ICdwcmVsb2FkJyBhcyBjb25zdCwgYXM6ICdzdHlsZScgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqIFZpcnR1YWwgb3V0cHV0IHBhdGggdG8gc3VwcG9ydCByZWFkaW5nIGluLW1lbW9yeSBmaWxlcy4gKi9cbiAgY29uc3QgdmlydHVhbE91dHB1dFBhdGggPSAnLyc7XG4gIGNvbnN0IHJlYWRBc3NldCA9IGFzeW5jIGZ1bmN0aW9uIChmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAvLyBSZW1vdmUgbGVhZGluZyBkaXJlY3Rvcnkgc2VwYXJhdG9yXG4gICAgY29uc3QgcmVsYXRpdmVmaWxlUGF0aCA9IHBhdGgucmVsYXRpdmUodmlydHVhbE91dHB1dFBhdGgsIGZpbGVQYXRoKTtcbiAgICBjb25zdCBmaWxlID0gb3V0cHV0RmlsZXMuZmluZCgoZmlsZSkgPT4gZmlsZS5wYXRoID09PSByZWxhdGl2ZWZpbGVQYXRoKTtcbiAgICBpZiAoZmlsZSkge1xuICAgICAgcmV0dXJuIGZpbGUudGV4dDtcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoYE91dHB1dCBmaWxlIGRvZXMgbm90IGV4aXN0OiAke3JlbGF0aXZlZmlsZVBhdGh9YCk7XG4gIH07XG5cbiAgLy8gQ3JlYXRlIGFuIGluZGV4IEhUTUwgZ2VuZXJhdG9yIHRoYXQgcmVhZHMgZnJvbSB0aGUgaW4tbWVtb3J5IG91dHB1dCBmaWxlc1xuICBjb25zdCBpbmRleEh0bWxHZW5lcmF0b3IgPSBuZXcgSW5kZXhIdG1sR2VuZXJhdG9yKHtcbiAgICBpbmRleFBhdGg6IGluZGV4SHRtbE9wdGlvbnMuaW5wdXQsXG4gICAgZW50cnlwb2ludHM6IGluZGV4SHRtbE9wdGlvbnMuaW5zZXJ0aW9uT3JkZXIsXG4gICAgc3JpOiBzdWJyZXNvdXJjZUludGVncml0eSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIC4uLm9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgICBzdHlsZXM6IHtcbiAgICAgICAgLi4ub3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMsXG4gICAgICAgIGlubGluZUNyaXRpY2FsOiBmYWxzZSwgLy8gRGlzYWJsZSBjcml0aWNhbCBjc3MgaW5saW5lIGFzIGZvciBTU1IgYW5kIFNTRyB0aGlzIHdpbGwgYmUgZG9uZSBkdXJpbmcgcmVuZGVyaW5nLlxuICAgICAgfSxcbiAgICB9LFxuICAgIGNyb3NzT3JpZ2luOiBjcm9zc09yaWdpbixcbiAgfSk7XG5cbiAgaW5kZXhIdG1sR2VuZXJhdG9yLnJlYWRBc3NldCA9IHJlYWRBc3NldDtcblxuICBjb25zdCB0cmFuc2Zvcm1SZXN1bHQgPSBhd2FpdCBpbmRleEh0bWxHZW5lcmF0b3IucHJvY2Vzcyh7XG4gICAgYmFzZUhyZWYsXG4gICAgbGFuZyxcbiAgICBvdXRwdXRQYXRoOiB2aXJ0dWFsT3V0cHV0UGF0aCxcbiAgICBmaWxlczogWy4uLmluaXRpYWxGaWxlc10ubWFwKChbZmlsZSwgcmVjb3JkXSkgPT4gKHtcbiAgICAgIG5hbWU6IHJlY29yZC5uYW1lID8/ICcnLFxuICAgICAgZmlsZSxcbiAgICAgIGV4dGVuc2lvbjogcGF0aC5leHRuYW1lKGZpbGUpLFxuICAgIH0pKSxcbiAgICBoaW50cyxcbiAgfSk7XG5cbiAgY29uc3QgY29udGVudFdpdGhvdXRDcml0aWNhbENzc0lubGluZWQgPSB0cmFuc2Zvcm1SZXN1bHQuY29udGVudDtcbiAgaWYgKCFvcHRpbWl6YXRpb25PcHRpb25zLnN0eWxlcy5pbmxpbmVDcml0aWNhbCkge1xuICAgIHJldHVybiB7XG4gICAgICAuLi50cmFuc2Zvcm1SZXN1bHQsXG4gICAgICBjb250ZW50V2l0aG91dENyaXRpY2FsQ3NzSW5saW5lZCxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgaW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgPSBuZXcgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3Ioe1xuICAgIG1pbmlmeTogZmFsc2UsIC8vIENTUyBoYXMgYWxyZWFkeSBiZWVuIG1pbmlmaWVkIGR1cmluZyB0aGUgYnVpbGQuXG4gICAgcmVhZEFzc2V0LFxuICB9KTtcblxuICBjb25zdCB7IGNvbnRlbnQsIGVycm9ycywgd2FybmluZ3MgfSA9IGF3YWl0IGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yLnByb2Nlc3MoXG4gICAgY29udGVudFdpdGhvdXRDcml0aWNhbENzc0lubGluZWQsXG4gICAge1xuICAgICAgb3V0cHV0UGF0aDogdmlydHVhbE91dHB1dFBhdGgsXG4gICAgfSxcbiAgKTtcblxuICByZXR1cm4ge1xuICAgIGVycm9yczogWy4uLnRyYW5zZm9ybVJlc3VsdC5lcnJvcnMsIC4uLmVycm9yc10sXG4gICAgd2FybmluZ3M6IFsuLi50cmFuc2Zvcm1SZXN1bHQud2FybmluZ3MsIC4uLndhcm5pbmdzXSxcbiAgICBjb250ZW50LFxuICAgIGNvbnRlbnRXaXRob3V0Q3JpdGljYWxDc3NJbmxpbmVkLFxuICB9O1xufVxuIl19