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
function generateIndexHtml(initialFiles, executionResult, buildOptions) {
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
    // Create an index HTML generator that reads from the in-memory output files
    const indexHtmlGenerator = new index_html_generator_1.IndexHtmlGenerator({
        indexPath: indexHtmlOptions.input,
        entrypoints: indexHtmlOptions.insertionOrder,
        sri: subresourceIntegrity,
        optimization: optimizationOptions,
        crossOrigin: crossOrigin,
    });
    /** Virtual output path to support reading in-memory files. */
    const virtualOutputPath = '/';
    indexHtmlGenerator.readAsset = async function (filePath) {
        // Remove leading directory separator
        const relativefilePath = node_path_1.default.relative(virtualOutputPath, filePath);
        const file = executionResult.outputFiles.find((file) => file.path === relativefilePath);
        if (file) {
            return file.text;
        }
        throw new Error(`Output file does not exist: ${node_path_1.default}`);
    };
    return indexHtmlGenerator.process({
        baseHref,
        lang: undefined,
        outputPath: virtualOutputPath,
        files: [...initialFiles].map(([file, record]) => ({
            name: record.name ?? '',
            file,
            extension: node_path_1.default.extname(file),
        })),
        hints,
    });
}
exports.generateIndexHtml = generateIndexHtml;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgtaHRtbC1nZW5lcmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2luZGV4LWh0bWwtZ2VuZXJhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUVILDhEQUFpQztBQUNqQywwREFBNkI7QUFFN0Isc0ZBR3FEO0FBSXJELFNBQWdCLGlCQUFpQixDQUMvQixZQUE0QyxFQUM1QyxlQUFnQyxFQUNoQyxZQUErQztJQUUvQyxpREFBaUQ7SUFDakQscUZBQXFGO0lBQ3JGLGdFQUFnRTtJQUNoRSxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUM7SUFDakIsTUFBTSxFQUNKLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsbUJBQW1CLEVBQ25CLFdBQVcsRUFDWCxvQkFBb0IsRUFDcEIsUUFBUSxHQUNULEdBQUcsWUFBWSxDQUFDO0lBRWpCLElBQUEscUJBQU0sRUFBQyxnQkFBZ0IsRUFBRSx1Q0FBdUMsQ0FBQyxDQUFDO0lBRWxFLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtRQUNyQixLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLElBQUksWUFBWSxFQUFFO1lBQ3ZDLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRTtnQkFDcEIsa0RBQWtEO2dCQUNsRCxTQUFTO2FBQ1Y7WUFDRCxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO2dCQUMzQixLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsZUFBd0IsRUFBRSxDQUFDLENBQUM7YUFDMUQ7aUJBQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBRTtnQkFDakMsZ0ZBQWdGO2dCQUNoRiw2Q0FBNkM7Z0JBQzdDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxTQUFrQixFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO2FBQ2pFO1NBQ0Y7S0FDRjtJQUVELDRFQUE0RTtJQUM1RSxNQUFNLGtCQUFrQixHQUFHLElBQUkseUNBQWtCLENBQUM7UUFDaEQsU0FBUyxFQUFFLGdCQUFnQixDQUFDLEtBQUs7UUFDakMsV0FBVyxFQUFFLGdCQUFnQixDQUFDLGNBQWM7UUFDNUMsR0FBRyxFQUFFLG9CQUFvQjtRQUN6QixZQUFZLEVBQUUsbUJBQW1CO1FBQ2pDLFdBQVcsRUFBRSxXQUFXO0tBQ3pCLENBQUMsQ0FBQztJQUVILDhEQUE4RDtJQUM5RCxNQUFNLGlCQUFpQixHQUFHLEdBQUcsQ0FBQztJQUM5QixrQkFBa0IsQ0FBQyxTQUFTLEdBQUcsS0FBSyxXQUFXLFFBQWdCO1FBQzdELHFDQUFxQztRQUNyQyxNQUFNLGdCQUFnQixHQUFHLG1CQUFJLENBQUMsUUFBUSxDQUFDLGlCQUFpQixFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3BFLE1BQU0sSUFBSSxHQUFHLGVBQWUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLGdCQUFnQixDQUFDLENBQUM7UUFDeEYsSUFBSSxJQUFJLEVBQUU7WUFDUixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUM7U0FDbEI7UUFFRCxNQUFNLElBQUksS0FBSyxDQUFDLCtCQUErQixtQkFBSSxFQUFFLENBQUMsQ0FBQztJQUN6RCxDQUFDLENBQUM7SUFFRixPQUFPLGtCQUFrQixDQUFDLE9BQU8sQ0FBQztRQUNoQyxRQUFRO1FBQ1IsSUFBSSxFQUFFLFNBQVM7UUFDZixVQUFVLEVBQUUsaUJBQWlCO1FBQzdCLEtBQUssRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDaEQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLElBQUksRUFBRTtZQUN2QixJQUFJO1lBQ0osU0FBUyxFQUFFLG1CQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztTQUM5QixDQUFDLENBQUM7UUFDSCxLQUFLO0tBQ04sQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQXJFRCw4Q0FxRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zIH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYXBwbGljYXRpb24vb3B0aW9ucyc7XG5pbXBvcnQge1xuICBJbmRleEh0bWxHZW5lcmF0b3IsXG4gIEluZGV4SHRtbFRyYW5zZm9ybVJlc3VsdCxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBJbml0aWFsRmlsZVJlY29yZCB9IGZyb20gJy4vYnVuZGxlci1jb250ZXh0JztcbmltcG9ydCB0eXBlIHsgRXhlY3V0aW9uUmVzdWx0IH0gZnJvbSAnLi9idW5kbGVyLWV4ZWN1dGlvbi1yZXN1bHQnO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVJbmRleEh0bWwoXG4gIGluaXRpYWxGaWxlczogTWFwPHN0cmluZywgSW5pdGlhbEZpbGVSZWNvcmQ+LFxuICBleGVjdXRpb25SZXN1bHQ6IEV4ZWN1dGlvblJlc3VsdCxcbiAgYnVpbGRPcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4pOiBQcm9taXNlPEluZGV4SHRtbFRyYW5zZm9ybVJlc3VsdD4ge1xuICAvLyBBbmFseXplIG1ldGFmaWxlIGZvciBpbml0aWFsIGxpbmstYmFzZWQgaGludHMuXG4gIC8vIFNraXAgaWYgdGhlIGludGVybmFsIGV4dGVybmFsUGFja2FnZXMgb3B0aW9uIGlzIGVuYWJsZWQgc2luY2UgdGhpcyBvcHRpb24gcmVxdWlyZXNcbiAgLy8gZGV2IHNlcnZlciBjb29wZXJhdGlvbiB0byBwcm9wZXJseSByZXNvbHZlIGFuZCBmZXRjaCBpbXBvcnRzLlxuICBjb25zdCBoaW50cyA9IFtdO1xuICBjb25zdCB7XG4gICAgaW5kZXhIdG1sT3B0aW9ucyxcbiAgICBleHRlcm5hbFBhY2thZ2VzLFxuICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgY3Jvc3NPcmlnaW4sXG4gICAgc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgYmFzZUhyZWYsXG4gIH0gPSBidWlsZE9wdGlvbnM7XG5cbiAgYXNzZXJ0KGluZGV4SHRtbE9wdGlvbnMsICdpbmRleEh0bWxPcHRpb25zIGNhbm5vdCBiZSB1bmRlZmluZWQuJyk7XG5cbiAgaWYgKCFleHRlcm5hbFBhY2thZ2VzKSB7XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgaW5pdGlhbEZpbGVzKSB7XG4gICAgICBpZiAodmFsdWUuZW50cnlwb2ludCkge1xuICAgICAgICAvLyBFbnRyeSBwb2ludHMgYXJlIGFscmVhZHkgcmVmZXJlbmNlZCBpbiB0aGUgSFRNTFxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmICh2YWx1ZS50eXBlID09PSAnc2NyaXB0Jykge1xuICAgICAgICBoaW50cy5wdXNoKHsgdXJsOiBrZXksIG1vZGU6ICdtb2R1bGVwcmVsb2FkJyBhcyBjb25zdCB9KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUudHlwZSA9PT0gJ3N0eWxlJykge1xuICAgICAgICAvLyBQcm92aWRlIGFuIFwiYXNcIiB2YWx1ZSBvZiBcInN0eWxlXCIgdG8gZW5zdXJlIGV4dGVybmFsIFVSTHMgd2hpY2ggbWF5IG5vdCBoYXZlIGFcbiAgICAgICAgLy8gZmlsZSBleHRlbnNpb24gYXJlIHRyZWF0ZWQgYXMgc3R5bGVzaGVldHMuXG4gICAgICAgIGhpbnRzLnB1c2goeyB1cmw6IGtleSwgbW9kZTogJ3ByZWxvYWQnIGFzIGNvbnN0LCBhczogJ3N0eWxlJyB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBDcmVhdGUgYW4gaW5kZXggSFRNTCBnZW5lcmF0b3IgdGhhdCByZWFkcyBmcm9tIHRoZSBpbi1tZW1vcnkgb3V0cHV0IGZpbGVzXG4gIGNvbnN0IGluZGV4SHRtbEdlbmVyYXRvciA9IG5ldyBJbmRleEh0bWxHZW5lcmF0b3Ioe1xuICAgIGluZGV4UGF0aDogaW5kZXhIdG1sT3B0aW9ucy5pbnB1dCxcbiAgICBlbnRyeXBvaW50czogaW5kZXhIdG1sT3B0aW9ucy5pbnNlcnRpb25PcmRlcixcbiAgICBzcmk6IHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIG9wdGltaXphdGlvbjogb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBjcm9zc09yaWdpbjogY3Jvc3NPcmlnaW4sXG4gIH0pO1xuXG4gIC8qKiBWaXJ0dWFsIG91dHB1dCBwYXRoIHRvIHN1cHBvcnQgcmVhZGluZyBpbi1tZW1vcnkgZmlsZXMuICovXG4gIGNvbnN0IHZpcnR1YWxPdXRwdXRQYXRoID0gJy8nO1xuICBpbmRleEh0bWxHZW5lcmF0b3IucmVhZEFzc2V0ID0gYXN5bmMgZnVuY3Rpb24gKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIC8vIFJlbW92ZSBsZWFkaW5nIGRpcmVjdG9yeSBzZXBhcmF0b3JcbiAgICBjb25zdCByZWxhdGl2ZWZpbGVQYXRoID0gcGF0aC5yZWxhdGl2ZSh2aXJ0dWFsT3V0cHV0UGF0aCwgZmlsZVBhdGgpO1xuICAgIGNvbnN0IGZpbGUgPSBleGVjdXRpb25SZXN1bHQub3V0cHV0RmlsZXMuZmluZCgoZmlsZSkgPT4gZmlsZS5wYXRoID09PSByZWxhdGl2ZWZpbGVQYXRoKTtcbiAgICBpZiAoZmlsZSkge1xuICAgICAgcmV0dXJuIGZpbGUudGV4dDtcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoYE91dHB1dCBmaWxlIGRvZXMgbm90IGV4aXN0OiAke3BhdGh9YCk7XG4gIH07XG5cbiAgcmV0dXJuIGluZGV4SHRtbEdlbmVyYXRvci5wcm9jZXNzKHtcbiAgICBiYXNlSHJlZixcbiAgICBsYW5nOiB1bmRlZmluZWQsXG4gICAgb3V0cHV0UGF0aDogdmlydHVhbE91dHB1dFBhdGgsXG4gICAgZmlsZXM6IFsuLi5pbml0aWFsRmlsZXNdLm1hcCgoW2ZpbGUsIHJlY29yZF0pID0+ICh7XG4gICAgICBuYW1lOiByZWNvcmQubmFtZSA/PyAnJyxcbiAgICAgIGZpbGUsXG4gICAgICBleHRlbnNpb246IHBhdGguZXh0bmFtZShmaWxlKSxcbiAgICB9KSksXG4gICAgaGludHMsXG4gIH0pO1xufVxuIl19