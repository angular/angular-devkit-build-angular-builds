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
                hints.push({ url: key, mode: 'preload' });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgtaHRtbC1nZW5lcmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2luZGV4LWh0bWwtZ2VuZXJhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUVILDhEQUFpQztBQUNqQywwREFBNkI7QUFFN0Isc0ZBR3FEO0FBSXJELFNBQWdCLGlCQUFpQixDQUMvQixZQUE0QyxFQUM1QyxlQUFnQyxFQUNoQyxZQUFzQztJQUV0QyxpREFBaUQ7SUFDakQscUZBQXFGO0lBQ3JGLGdFQUFnRTtJQUNoRSxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUM7SUFDakIsTUFBTSxFQUNKLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsbUJBQW1CLEVBQ25CLFdBQVcsRUFDWCxvQkFBb0IsRUFDcEIsUUFBUSxHQUNULEdBQUcsWUFBWSxDQUFDO0lBRWpCLElBQUEscUJBQU0sRUFBQyxnQkFBZ0IsRUFBRSx1Q0FBdUMsQ0FBQyxDQUFDO0lBRWxFLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtRQUNyQixLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLElBQUksWUFBWSxFQUFFO1lBQ3ZDLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRTtnQkFDcEIsa0RBQWtEO2dCQUNsRCxTQUFTO2FBQ1Y7WUFDRCxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO2dCQUMzQixLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsZUFBd0IsRUFBRSxDQUFDLENBQUM7YUFDMUQ7aUJBQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBRTtnQkFDakMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFNBQWtCLEVBQUUsQ0FBQyxDQUFDO2FBQ3BEO1NBQ0Y7S0FDRjtJQUVELDRFQUE0RTtJQUM1RSxNQUFNLGtCQUFrQixHQUFHLElBQUkseUNBQWtCLENBQUM7UUFDaEQsU0FBUyxFQUFFLGdCQUFnQixDQUFDLEtBQUs7UUFDakMsV0FBVyxFQUFFLGdCQUFnQixDQUFDLGNBQWM7UUFDNUMsR0FBRyxFQUFFLG9CQUFvQjtRQUN6QixZQUFZLEVBQUUsbUJBQW1CO1FBQ2pDLFdBQVcsRUFBRSxXQUFXO0tBQ3pCLENBQUMsQ0FBQztJQUVILDhEQUE4RDtJQUM5RCxNQUFNLGlCQUFpQixHQUFHLEdBQUcsQ0FBQztJQUM5QixrQkFBa0IsQ0FBQyxTQUFTLEdBQUcsS0FBSyxXQUFXLFFBQWdCO1FBQzdELHFDQUFxQztRQUNyQyxNQUFNLGdCQUFnQixHQUFHLG1CQUFJLENBQUMsUUFBUSxDQUFDLGlCQUFpQixFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3BFLE1BQU0sSUFBSSxHQUFHLGVBQWUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLGdCQUFnQixDQUFDLENBQUM7UUFDeEYsSUFBSSxJQUFJLEVBQUU7WUFDUixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUM7U0FDbEI7UUFFRCxNQUFNLElBQUksS0FBSyxDQUFDLCtCQUErQixtQkFBSSxFQUFFLENBQUMsQ0FBQztJQUN6RCxDQUFDLENBQUM7SUFFRixPQUFPLGtCQUFrQixDQUFDLE9BQU8sQ0FBQztRQUNoQyxRQUFRO1FBQ1IsSUFBSSxFQUFFLFNBQVM7UUFDZixVQUFVLEVBQUUsaUJBQWlCO1FBQzdCLEtBQUssRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDaEQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLElBQUksRUFBRTtZQUN2QixJQUFJO1lBQ0osU0FBUyxFQUFFLG1CQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztTQUM5QixDQUFDLENBQUM7UUFDSCxLQUFLO0tBQ04sQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQW5FRCw4Q0FtRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zIH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYnJvd3Nlci1lc2J1aWxkL29wdGlvbnMnO1xuaW1wb3J0IHtcbiAgSW5kZXhIdG1sR2VuZXJhdG9yLFxuICBJbmRleEh0bWxUcmFuc2Zvcm1SZXN1bHQsXG59IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgSW5pdGlhbEZpbGVSZWNvcmQgfSBmcm9tICcuL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgdHlwZSB7IEV4ZWN1dGlvblJlc3VsdCB9IGZyb20gJy4vYnVuZGxlci1leGVjdXRpb24tcmVzdWx0JztcblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlSW5kZXhIdG1sKFxuICBpbml0aWFsRmlsZXM6IE1hcDxzdHJpbmcsIEluaXRpYWxGaWxlUmVjb3JkPixcbiAgZXhlY3V0aW9uUmVzdWx0OiBFeGVjdXRpb25SZXN1bHQsXG4gIGJ1aWxkT3B0aW9uczogTm9ybWFsaXplZEJyb3dzZXJPcHRpb25zLFxuKTogUHJvbWlzZTxJbmRleEh0bWxUcmFuc2Zvcm1SZXN1bHQ+IHtcbiAgLy8gQW5hbHl6ZSBtZXRhZmlsZSBmb3IgaW5pdGlhbCBsaW5rLWJhc2VkIGhpbnRzLlxuICAvLyBTa2lwIGlmIHRoZSBpbnRlcm5hbCBleHRlcm5hbFBhY2thZ2VzIG9wdGlvbiBpcyBlbmFibGVkIHNpbmNlIHRoaXMgb3B0aW9uIHJlcXVpcmVzXG4gIC8vIGRldiBzZXJ2ZXIgY29vcGVyYXRpb24gdG8gcHJvcGVybHkgcmVzb2x2ZSBhbmQgZmV0Y2ggaW1wb3J0cy5cbiAgY29uc3QgaGludHMgPSBbXTtcbiAgY29uc3Qge1xuICAgIGluZGV4SHRtbE9wdGlvbnMsXG4gICAgZXh0ZXJuYWxQYWNrYWdlcyxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIGNyb3NzT3JpZ2luLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIGJhc2VIcmVmLFxuICB9ID0gYnVpbGRPcHRpb25zO1xuXG4gIGFzc2VydChpbmRleEh0bWxPcHRpb25zLCAnaW5kZXhIdG1sT3B0aW9ucyBjYW5ub3QgYmUgdW5kZWZpbmVkLicpO1xuXG4gIGlmICghZXh0ZXJuYWxQYWNrYWdlcykge1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIGluaXRpYWxGaWxlcykge1xuICAgICAgaWYgKHZhbHVlLmVudHJ5cG9pbnQpIHtcbiAgICAgICAgLy8gRW50cnkgcG9pbnRzIGFyZSBhbHJlYWR5IHJlZmVyZW5jZWQgaW4gdGhlIEhUTUxcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAodmFsdWUudHlwZSA9PT0gJ3NjcmlwdCcpIHtcbiAgICAgICAgaGludHMucHVzaCh7IHVybDoga2V5LCBtb2RlOiAnbW9kdWxlcHJlbG9hZCcgYXMgY29uc3QgfSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlLnR5cGUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgaGludHMucHVzaCh7IHVybDoga2V5LCBtb2RlOiAncHJlbG9hZCcgYXMgY29uc3QgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gQ3JlYXRlIGFuIGluZGV4IEhUTUwgZ2VuZXJhdG9yIHRoYXQgcmVhZHMgZnJvbSB0aGUgaW4tbWVtb3J5IG91dHB1dCBmaWxlc1xuICBjb25zdCBpbmRleEh0bWxHZW5lcmF0b3IgPSBuZXcgSW5kZXhIdG1sR2VuZXJhdG9yKHtcbiAgICBpbmRleFBhdGg6IGluZGV4SHRtbE9wdGlvbnMuaW5wdXQsXG4gICAgZW50cnlwb2ludHM6IGluZGV4SHRtbE9wdGlvbnMuaW5zZXJ0aW9uT3JkZXIsXG4gICAgc3JpOiBzdWJyZXNvdXJjZUludGVncml0eSxcbiAgICBvcHRpbWl6YXRpb246IG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgY3Jvc3NPcmlnaW46IGNyb3NzT3JpZ2luLFxuICB9KTtcblxuICAvKiogVmlydHVhbCBvdXRwdXQgcGF0aCB0byBzdXBwb3J0IHJlYWRpbmcgaW4tbWVtb3J5IGZpbGVzLiAqL1xuICBjb25zdCB2aXJ0dWFsT3V0cHV0UGF0aCA9ICcvJztcbiAgaW5kZXhIdG1sR2VuZXJhdG9yLnJlYWRBc3NldCA9IGFzeW5jIGZ1bmN0aW9uIChmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAvLyBSZW1vdmUgbGVhZGluZyBkaXJlY3Rvcnkgc2VwYXJhdG9yXG4gICAgY29uc3QgcmVsYXRpdmVmaWxlUGF0aCA9IHBhdGgucmVsYXRpdmUodmlydHVhbE91dHB1dFBhdGgsIGZpbGVQYXRoKTtcbiAgICBjb25zdCBmaWxlID0gZXhlY3V0aW9uUmVzdWx0Lm91dHB1dEZpbGVzLmZpbmQoKGZpbGUpID0+IGZpbGUucGF0aCA9PT0gcmVsYXRpdmVmaWxlUGF0aCk7XG4gICAgaWYgKGZpbGUpIHtcbiAgICAgIHJldHVybiBmaWxlLnRleHQ7XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKGBPdXRwdXQgZmlsZSBkb2VzIG5vdCBleGlzdDogJHtwYXRofWApO1xuICB9O1xuXG4gIHJldHVybiBpbmRleEh0bWxHZW5lcmF0b3IucHJvY2Vzcyh7XG4gICAgYmFzZUhyZWYsXG4gICAgbGFuZzogdW5kZWZpbmVkLFxuICAgIG91dHB1dFBhdGg6IHZpcnR1YWxPdXRwdXRQYXRoLFxuICAgIGZpbGVzOiBbLi4uaW5pdGlhbEZpbGVzXS5tYXAoKFtmaWxlLCByZWNvcmRdKSA9PiAoe1xuICAgICAgbmFtZTogcmVjb3JkLm5hbWUgPz8gJycsXG4gICAgICBmaWxlLFxuICAgICAgZXh0ZW5zaW9uOiBwYXRoLmV4dG5hbWUoZmlsZSksXG4gICAgfSkpLFxuICAgIGhpbnRzLFxuICB9KTtcbn1cbiJdfQ==