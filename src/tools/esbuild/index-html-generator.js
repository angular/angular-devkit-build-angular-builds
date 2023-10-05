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
const bundler_context_1 = require("./bundler-context");
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
    const browserOutputFiles = outputFiles.filter(({ type }) => type === bundler_context_1.BuildOutputFileType.Browser);
    const virtualOutputPath = '/';
    const readAsset = async function (filePath) {
        // Remove leading directory separator
        const relativefilePath = node_path_1.default.relative(virtualOutputPath, filePath);
        const file = browserOutputFiles.find((file) => file.path === relativefilePath);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgtaHRtbC1nZW5lcmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2luZGV4LWh0bWwtZ2VuZXJhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUVILDhEQUFpQztBQUNqQywwREFBNkI7QUFFN0Isc0ZBQWlGO0FBQ2pGLG9GQUF3RjtBQUN4Rix1REFBNEY7QUFFckYsS0FBSyxVQUFVLGlCQUFpQixDQUNyQyxZQUE0QyxFQUM1QyxXQUE4QixFQUM5QixZQUErQyxFQUMvQyxJQUFhO0lBT2IsaURBQWlEO0lBQ2pELHFGQUFxRjtJQUNyRixnRUFBZ0U7SUFDaEUsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDO0lBQ2pCLE1BQU0sRUFDSixnQkFBZ0IsRUFDaEIsZ0JBQWdCLEVBQ2hCLG1CQUFtQixFQUNuQixXQUFXLEVBQ1gsb0JBQW9CLEVBQ3BCLFFBQVEsR0FDVCxHQUFHLFlBQVksQ0FBQztJQUVqQixJQUFBLHFCQUFNLEVBQUMsZ0JBQWdCLEVBQUUsdUNBQXVDLENBQUMsQ0FBQztJQUVsRSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7UUFDckIsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxJQUFJLFlBQVksRUFBRTtZQUN2QyxJQUFJLEtBQUssQ0FBQyxVQUFVLEVBQUU7Z0JBQ3BCLGtEQUFrRDtnQkFDbEQsU0FBUzthQUNWO1lBQ0QsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRTtnQkFDM0IsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLGVBQXdCLEVBQUUsQ0FBQyxDQUFDO2FBQzFEO2lCQUFNLElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxPQUFPLEVBQUU7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RSxHQUFHLFFBQVEsQ0FBQztRQUNwRCxPQUFPO1FBQ1AsZ0NBQWdDO0tBQ2pDLENBQUM7QUFDSixDQUFDO0FBL0dELDhDQStHQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMgfSBmcm9tICcuLi8uLi9idWlsZGVycy9hcHBsaWNhdGlvbi9vcHRpb25zJztcbmltcG9ydCB7IEluZGV4SHRtbEdlbmVyYXRvciB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4LWZpbGUvaW5kZXgtaHRtbC1nZW5lcmF0b3InO1xuaW1wb3J0IHsgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2lubGluZS1jcml0aWNhbC1jc3MnO1xuaW1wb3J0IHsgQnVpbGRPdXRwdXRGaWxlLCBCdWlsZE91dHB1dEZpbGVUeXBlLCBJbml0aWFsRmlsZVJlY29yZCB9IGZyb20gJy4vYnVuZGxlci1jb250ZXh0JztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlSW5kZXhIdG1sKFxuICBpbml0aWFsRmlsZXM6IE1hcDxzdHJpbmcsIEluaXRpYWxGaWxlUmVjb3JkPixcbiAgb3V0cHV0RmlsZXM6IEJ1aWxkT3V0cHV0RmlsZVtdLFxuICBidWlsZE9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyxcbiAgbGFuZz86IHN0cmluZyxcbik6IFByb21pc2U8e1xuICBjb250ZW50OiBzdHJpbmc7XG4gIGNvbnRlbnRXaXRob3V0Q3JpdGljYWxDc3NJbmxpbmVkOiBzdHJpbmc7XG4gIHdhcm5pbmdzOiBzdHJpbmdbXTtcbiAgZXJyb3JzOiBzdHJpbmdbXTtcbn0+IHtcbiAgLy8gQW5hbHl6ZSBtZXRhZmlsZSBmb3IgaW5pdGlhbCBsaW5rLWJhc2VkIGhpbnRzLlxuICAvLyBTa2lwIGlmIHRoZSBpbnRlcm5hbCBleHRlcm5hbFBhY2thZ2VzIG9wdGlvbiBpcyBlbmFibGVkIHNpbmNlIHRoaXMgb3B0aW9uIHJlcXVpcmVzXG4gIC8vIGRldiBzZXJ2ZXIgY29vcGVyYXRpb24gdG8gcHJvcGVybHkgcmVzb2x2ZSBhbmQgZmV0Y2ggaW1wb3J0cy5cbiAgY29uc3QgaGludHMgPSBbXTtcbiAgY29uc3Qge1xuICAgIGluZGV4SHRtbE9wdGlvbnMsXG4gICAgZXh0ZXJuYWxQYWNrYWdlcyxcbiAgICBvcHRpbWl6YXRpb25PcHRpb25zLFxuICAgIGNyb3NzT3JpZ2luLFxuICAgIHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIGJhc2VIcmVmLFxuICB9ID0gYnVpbGRPcHRpb25zO1xuXG4gIGFzc2VydChpbmRleEh0bWxPcHRpb25zLCAnaW5kZXhIdG1sT3B0aW9ucyBjYW5ub3QgYmUgdW5kZWZpbmVkLicpO1xuXG4gIGlmICghZXh0ZXJuYWxQYWNrYWdlcykge1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIGluaXRpYWxGaWxlcykge1xuICAgICAgaWYgKHZhbHVlLmVudHJ5cG9pbnQpIHtcbiAgICAgICAgLy8gRW50cnkgcG9pbnRzIGFyZSBhbHJlYWR5IHJlZmVyZW5jZWQgaW4gdGhlIEhUTUxcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAodmFsdWUudHlwZSA9PT0gJ3NjcmlwdCcpIHtcbiAgICAgICAgaGludHMucHVzaCh7IHVybDoga2V5LCBtb2RlOiAnbW9kdWxlcHJlbG9hZCcgYXMgY29uc3QgfSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlLnR5cGUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgLy8gUHJvdmlkZSBhbiBcImFzXCIgdmFsdWUgb2YgXCJzdHlsZVwiIHRvIGVuc3VyZSBleHRlcm5hbCBVUkxzIHdoaWNoIG1heSBub3QgaGF2ZSBhXG4gICAgICAgIC8vIGZpbGUgZXh0ZW5zaW9uIGFyZSB0cmVhdGVkIGFzIHN0eWxlc2hlZXRzLlxuICAgICAgICBoaW50cy5wdXNoKHsgdXJsOiBrZXksIG1vZGU6ICdwcmVsb2FkJyBhcyBjb25zdCwgYXM6ICdzdHlsZScgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqIFZpcnR1YWwgb3V0cHV0IHBhdGggdG8gc3VwcG9ydCByZWFkaW5nIGluLW1lbW9yeSBmaWxlcy4gKi9cbiAgY29uc3QgYnJvd3Nlck91dHB1dEZpbGVzID0gb3V0cHV0RmlsZXMuZmlsdGVyKCh7IHR5cGUgfSkgPT4gdHlwZSA9PT0gQnVpbGRPdXRwdXRGaWxlVHlwZS5Ccm93c2VyKTtcbiAgY29uc3QgdmlydHVhbE91dHB1dFBhdGggPSAnLyc7XG4gIGNvbnN0IHJlYWRBc3NldCA9IGFzeW5jIGZ1bmN0aW9uIChmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAvLyBSZW1vdmUgbGVhZGluZyBkaXJlY3Rvcnkgc2VwYXJhdG9yXG4gICAgY29uc3QgcmVsYXRpdmVmaWxlUGF0aCA9IHBhdGgucmVsYXRpdmUodmlydHVhbE91dHB1dFBhdGgsIGZpbGVQYXRoKTtcbiAgICBjb25zdCBmaWxlID0gYnJvd3Nlck91dHB1dEZpbGVzLmZpbmQoKGZpbGUpID0+IGZpbGUucGF0aCA9PT0gcmVsYXRpdmVmaWxlUGF0aCk7XG4gICAgaWYgKGZpbGUpIHtcbiAgICAgIHJldHVybiBmaWxlLnRleHQ7XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKGBPdXRwdXQgZmlsZSBkb2VzIG5vdCBleGlzdDogJHtyZWxhdGl2ZWZpbGVQYXRofWApO1xuICB9O1xuXG4gIC8vIENyZWF0ZSBhbiBpbmRleCBIVE1MIGdlbmVyYXRvciB0aGF0IHJlYWRzIGZyb20gdGhlIGluLW1lbW9yeSBvdXRwdXQgZmlsZXNcbiAgY29uc3QgaW5kZXhIdG1sR2VuZXJhdG9yID0gbmV3IEluZGV4SHRtbEdlbmVyYXRvcih7XG4gICAgaW5kZXhQYXRoOiBpbmRleEh0bWxPcHRpb25zLmlucHV0LFxuICAgIGVudHJ5cG9pbnRzOiBpbmRleEh0bWxPcHRpb25zLmluc2VydGlvbk9yZGVyLFxuICAgIHNyaTogc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICAuLi5vcHRpbWl6YXRpb25PcHRpb25zLFxuICAgICAgc3R5bGVzOiB7XG4gICAgICAgIC4uLm9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLFxuICAgICAgICBpbmxpbmVDcml0aWNhbDogZmFsc2UsIC8vIERpc2FibGUgY3JpdGljYWwgY3NzIGlubGluZSBhcyBmb3IgU1NSIGFuZCBTU0cgdGhpcyB3aWxsIGJlIGRvbmUgZHVyaW5nIHJlbmRlcmluZy5cbiAgICAgIH0sXG4gICAgfSxcbiAgICBjcm9zc09yaWdpbjogY3Jvc3NPcmlnaW4sXG4gIH0pO1xuXG4gIGluZGV4SHRtbEdlbmVyYXRvci5yZWFkQXNzZXQgPSByZWFkQXNzZXQ7XG5cbiAgY29uc3QgdHJhbnNmb3JtUmVzdWx0ID0gYXdhaXQgaW5kZXhIdG1sR2VuZXJhdG9yLnByb2Nlc3Moe1xuICAgIGJhc2VIcmVmLFxuICAgIGxhbmcsXG4gICAgb3V0cHV0UGF0aDogdmlydHVhbE91dHB1dFBhdGgsXG4gICAgZmlsZXM6IFsuLi5pbml0aWFsRmlsZXNdLm1hcCgoW2ZpbGUsIHJlY29yZF0pID0+ICh7XG4gICAgICBuYW1lOiByZWNvcmQubmFtZSA/PyAnJyxcbiAgICAgIGZpbGUsXG4gICAgICBleHRlbnNpb246IHBhdGguZXh0bmFtZShmaWxlKSxcbiAgICB9KSksXG4gICAgaGludHMsXG4gIH0pO1xuXG4gIGNvbnN0IGNvbnRlbnRXaXRob3V0Q3JpdGljYWxDc3NJbmxpbmVkID0gdHJhbnNmb3JtUmVzdWx0LmNvbnRlbnQ7XG4gIGlmICghb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMuaW5saW5lQ3JpdGljYWwpIHtcbiAgICByZXR1cm4ge1xuICAgICAgLi4udHJhbnNmb3JtUmVzdWx0LFxuICAgICAgY29udGVudFdpdGhvdXRDcml0aWNhbENzc0lubGluZWQsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yID0gbmV3IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yKHtcbiAgICBtaW5pZnk6IGZhbHNlLCAvLyBDU1MgaGFzIGFscmVhZHkgYmVlbiBtaW5pZmllZCBkdXJpbmcgdGhlIGJ1aWxkLlxuICAgIHJlYWRBc3NldCxcbiAgfSk7XG5cbiAgY29uc3QgeyBjb250ZW50LCBlcnJvcnMsIHdhcm5pbmdzIH0gPSBhd2FpdCBpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvci5wcm9jZXNzKFxuICAgIGNvbnRlbnRXaXRob3V0Q3JpdGljYWxDc3NJbmxpbmVkLFxuICAgIHtcbiAgICAgIG91dHB1dFBhdGg6IHZpcnR1YWxPdXRwdXRQYXRoLFxuICAgIH0sXG4gICk7XG5cbiAgcmV0dXJuIHtcbiAgICBlcnJvcnM6IFsuLi50cmFuc2Zvcm1SZXN1bHQuZXJyb3JzLCAuLi5lcnJvcnNdLFxuICAgIHdhcm5pbmdzOiBbLi4udHJhbnNmb3JtUmVzdWx0Lndhcm5pbmdzLCAuLi53YXJuaW5nc10sXG4gICAgY29udGVudCxcbiAgICBjb250ZW50V2l0aG91dENyaXRpY2FsQ3NzSW5saW5lZCxcbiAgfTtcbn1cbiJdfQ==