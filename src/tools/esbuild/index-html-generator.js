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
exports.generateIndexHtml = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const node_path_1 = __importDefault(require("node:path"));
const index_html_generator_1 = require("../../utils/index-file/index-html-generator");
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
        deployUrl: buildOptions.publicPath,
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
    const { InlineCriticalCssProcessor } = await Promise.resolve().then(() => __importStar(require('../../utils/index-file/inline-critical-css')));
    const inlineCriticalCssProcessor = new InlineCriticalCssProcessor({
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgtaHRtbC1nZW5lcmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9lc2J1aWxkL2luZGV4LWh0bWwtZ2VuZXJhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsOERBQWlDO0FBQ2pDLDBEQUE2QjtBQUU3QixzRkFBaUY7QUFDakYsdURBQTRGO0FBRXJGLEtBQUssVUFBVSxpQkFBaUIsQ0FDckMsWUFBNEMsRUFDNUMsV0FBOEIsRUFDOUIsWUFBK0MsRUFDL0MsSUFBYTtJQU9iLGlEQUFpRDtJQUNqRCxxRkFBcUY7SUFDckYsZ0VBQWdFO0lBQ2hFLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQztJQUNqQixNQUFNLEVBQ0osZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixtQkFBbUIsRUFDbkIsV0FBVyxFQUNYLG9CQUFvQixFQUNwQixRQUFRLEdBQ1QsR0FBRyxZQUFZLENBQUM7SUFFakIsSUFBQSxxQkFBTSxFQUFDLGdCQUFnQixFQUFFLHVDQUF1QyxDQUFDLENBQUM7SUFFbEUsSUFBSSxDQUFDLGdCQUFnQixFQUFFO1FBQ3JCLEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxZQUFZLEVBQUU7WUFDdkMsSUFBSSxLQUFLLENBQUMsVUFBVSxFQUFFO2dCQUNwQixrREFBa0Q7Z0JBQ2xELFNBQVM7YUFDVjtZQUNELElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7Z0JBQzNCLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxlQUF3QixFQUFFLENBQUMsQ0FBQzthQUMxRDtpQkFBTSxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUss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QU0sRUFBRSxDQUFDLEdBQUcsZUFBZSxDQUFDLE1BQU0sRUFBRSxHQUFHLE1BQU0sQ0FBQztRQUM5QyxRQUFRLEVBQUUsQ0FBQyxHQUFHLGVBQWUsQ0FBQyxRQUFRLEVBQUUsR0FBRyxRQUFRLENBQUM7UUFDcEQsT0FBTztRQUNQLGdDQUFnQztLQUNqQyxDQUFDO0FBQ0osQ0FBQztBQWxIRCw4Q0FrSEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zIH0gZnJvbSAnLi4vLi4vYnVpbGRlcnMvYXBwbGljYXRpb24vb3B0aW9ucyc7XG5pbXBvcnQgeyBJbmRleEh0bWxHZW5lcmF0b3IgfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2luZGV4LWh0bWwtZ2VuZXJhdG9yJztcbmltcG9ydCB7IEJ1aWxkT3V0cHV0RmlsZSwgQnVpbGRPdXRwdXRGaWxlVHlwZSwgSW5pdGlhbEZpbGVSZWNvcmQgfSBmcm9tICcuL2J1bmRsZXItY29udGV4dCc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZW5lcmF0ZUluZGV4SHRtbChcbiAgaW5pdGlhbEZpbGVzOiBNYXA8c3RyaW5nLCBJbml0aWFsRmlsZVJlY29yZD4sXG4gIG91dHB1dEZpbGVzOiBCdWlsZE91dHB1dEZpbGVbXSxcbiAgYnVpbGRPcHRpb25zOiBOb3JtYWxpemVkQXBwbGljYXRpb25CdWlsZE9wdGlvbnMsXG4gIGxhbmc/OiBzdHJpbmcsXG4pOiBQcm9taXNlPHtcbiAgY29udGVudDogc3RyaW5nO1xuICBjb250ZW50V2l0aG91dENyaXRpY2FsQ3NzSW5saW5lZDogc3RyaW5nO1xuICB3YXJuaW5nczogc3RyaW5nW107XG4gIGVycm9yczogc3RyaW5nW107XG59PiB7XG4gIC8vIEFuYWx5emUgbWV0YWZpbGUgZm9yIGluaXRpYWwgbGluay1iYXNlZCBoaW50cy5cbiAgLy8gU2tpcCBpZiB0aGUgaW50ZXJuYWwgZXh0ZXJuYWxQYWNrYWdlcyBvcHRpb24gaXMgZW5hYmxlZCBzaW5jZSB0aGlzIG9wdGlvbiByZXF1aXJlc1xuICAvLyBkZXYgc2VydmVyIGNvb3BlcmF0aW9uIHRvIHByb3Blcmx5IHJlc29sdmUgYW5kIGZldGNoIGltcG9ydHMuXG4gIGNvbnN0IGhpbnRzID0gW107XG4gIGNvbnN0IHtcbiAgICBpbmRleEh0bWxPcHRpb25zLFxuICAgIGV4dGVybmFsUGFja2FnZXMsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBjcm9zc09yaWdpbixcbiAgICBzdWJyZXNvdXJjZUludGVncml0eSxcbiAgICBiYXNlSHJlZixcbiAgfSA9IGJ1aWxkT3B0aW9ucztcblxuICBhc3NlcnQoaW5kZXhIdG1sT3B0aW9ucywgJ2luZGV4SHRtbE9wdGlvbnMgY2Fubm90IGJlIHVuZGVmaW5lZC4nKTtcblxuICBpZiAoIWV4dGVybmFsUGFja2FnZXMpIHtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBpbml0aWFsRmlsZXMpIHtcbiAgICAgIGlmICh2YWx1ZS5lbnRyeXBvaW50KSB7XG4gICAgICAgIC8vIEVudHJ5IHBvaW50cyBhcmUgYWxyZWFkeSByZWZlcmVuY2VkIGluIHRoZSBIVE1MXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaWYgKHZhbHVlLnR5cGUgPT09ICdzY3JpcHQnKSB7XG4gICAgICAgIGhpbnRzLnB1c2goeyB1cmw6IGtleSwgbW9kZTogJ21vZHVsZXByZWxvYWQnIGFzIGNvbnN0IH0pO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZS50eXBlID09PSAnc3R5bGUnKSB7XG4gICAgICAgIC8vIFByb3ZpZGUgYW4gXCJhc1wiIHZhbHVlIG9mIFwic3R5bGVcIiB0byBlbnN1cmUgZXh0ZXJuYWwgVVJMcyB3aGljaCBtYXkgbm90IGhhdmUgYVxuICAgICAgICAvLyBmaWxlIGV4dGVuc2lvbiBhcmUgdHJlYXRlZCBhcyBzdHlsZXNoZWV0cy5cbiAgICAgICAgaGludHMucHVzaCh7IHVybDoga2V5LCBtb2RlOiAncHJlbG9hZCcgYXMgY29uc3QsIGFzOiAnc3R5bGUnIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKiBWaXJ0dWFsIG91dHB1dCBwYXRoIHRvIHN1cHBvcnQgcmVhZGluZyBpbi1tZW1vcnkgZmlsZXMuICovXG4gIGNvbnN0IGJyb3dzZXJPdXRwdXRGaWxlcyA9IG91dHB1dEZpbGVzLmZpbHRlcigoeyB0eXBlIH0pID0+IHR5cGUgPT09IEJ1aWxkT3V0cHV0RmlsZVR5cGUuQnJvd3Nlcik7XG4gIGNvbnN0IHZpcnR1YWxPdXRwdXRQYXRoID0gJy8nO1xuICBjb25zdCByZWFkQXNzZXQgPSBhc3luYyBmdW5jdGlvbiAoZmlsZVBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgLy8gUmVtb3ZlIGxlYWRpbmcgZGlyZWN0b3J5IHNlcGFyYXRvclxuICAgIGNvbnN0IHJlbGF0aXZlZmlsZVBhdGggPSBwYXRoLnJlbGF0aXZlKHZpcnR1YWxPdXRwdXRQYXRoLCBmaWxlUGF0aCk7XG4gICAgY29uc3QgZmlsZSA9IGJyb3dzZXJPdXRwdXRGaWxlcy5maW5kKChmaWxlKSA9PiBmaWxlLnBhdGggPT09IHJlbGF0aXZlZmlsZVBhdGgpO1xuICAgIGlmIChmaWxlKSB7XG4gICAgICByZXR1cm4gZmlsZS50ZXh0O1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihgT3V0cHV0IGZpbGUgZG9lcyBub3QgZXhpc3Q6ICR7cmVsYXRpdmVmaWxlUGF0aH1gKTtcbiAgfTtcblxuICAvLyBDcmVhdGUgYW4gaW5kZXggSFRNTCBnZW5lcmF0b3IgdGhhdCByZWFkcyBmcm9tIHRoZSBpbi1tZW1vcnkgb3V0cHV0IGZpbGVzXG4gIGNvbnN0IGluZGV4SHRtbEdlbmVyYXRvciA9IG5ldyBJbmRleEh0bWxHZW5lcmF0b3Ioe1xuICAgIGluZGV4UGF0aDogaW5kZXhIdG1sT3B0aW9ucy5pbnB1dCxcbiAgICBlbnRyeXBvaW50czogaW5kZXhIdG1sT3B0aW9ucy5pbnNlcnRpb25PcmRlcixcbiAgICBzcmk6IHN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgLi4ub3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICAgIHN0eWxlczoge1xuICAgICAgICAuLi5vcHRpbWl6YXRpb25PcHRpb25zLnN0eWxlcyxcbiAgICAgICAgaW5saW5lQ3JpdGljYWw6IGZhbHNlLCAvLyBEaXNhYmxlIGNyaXRpY2FsIGNzcyBpbmxpbmUgYXMgZm9yIFNTUiBhbmQgU1NHIHRoaXMgd2lsbCBiZSBkb25lIGR1cmluZyByZW5kZXJpbmcuXG4gICAgICB9LFxuICAgIH0sXG4gICAgY3Jvc3NPcmlnaW46IGNyb3NzT3JpZ2luLFxuICAgIGRlcGxveVVybDogYnVpbGRPcHRpb25zLnB1YmxpY1BhdGgsXG4gIH0pO1xuXG4gIGluZGV4SHRtbEdlbmVyYXRvci5yZWFkQXNzZXQgPSByZWFkQXNzZXQ7XG5cbiAgY29uc3QgdHJhbnNmb3JtUmVzdWx0ID0gYXdhaXQgaW5kZXhIdG1sR2VuZXJhdG9yLnByb2Nlc3Moe1xuICAgIGJhc2VIcmVmLFxuICAgIGxhbmcsXG4gICAgb3V0cHV0UGF0aDogdmlydHVhbE91dHB1dFBhdGgsXG4gICAgZmlsZXM6IFsuLi5pbml0aWFsRmlsZXNdLm1hcCgoW2ZpbGUsIHJlY29yZF0pID0+ICh7XG4gICAgICBuYW1lOiByZWNvcmQubmFtZSA/PyAnJyxcbiAgICAgIGZpbGUsXG4gICAgICBleHRlbnNpb246IHBhdGguZXh0bmFtZShmaWxlKSxcbiAgICB9KSksXG4gICAgaGludHMsXG4gIH0pO1xuXG4gIGNvbnN0IGNvbnRlbnRXaXRob3V0Q3JpdGljYWxDc3NJbmxpbmVkID0gdHJhbnNmb3JtUmVzdWx0LmNvbnRlbnQ7XG4gIGlmICghb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMuaW5saW5lQ3JpdGljYWwpIHtcbiAgICByZXR1cm4ge1xuICAgICAgLi4udHJhbnNmb3JtUmVzdWx0LFxuICAgICAgY29udGVudFdpdGhvdXRDcml0aWNhbENzc0lubGluZWQsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHsgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgfSA9IGF3YWl0IGltcG9ydCgnLi4vLi4vdXRpbHMvaW5kZXgtZmlsZS9pbmxpbmUtY3JpdGljYWwtY3NzJyk7XG5cbiAgY29uc3QgaW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgPSBuZXcgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3Ioe1xuICAgIG1pbmlmeTogZmFsc2UsIC8vIENTUyBoYXMgYWxyZWFkeSBiZWVuIG1pbmlmaWVkIGR1cmluZyB0aGUgYnVpbGQuXG4gICAgcmVhZEFzc2V0LFxuICB9KTtcblxuICBjb25zdCB7IGNvbnRlbnQsIGVycm9ycywgd2FybmluZ3MgfSA9IGF3YWl0IGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yLnByb2Nlc3MoXG4gICAgY29udGVudFdpdGhvdXRDcml0aWNhbENzc0lubGluZWQsXG4gICAge1xuICAgICAgb3V0cHV0UGF0aDogdmlydHVhbE91dHB1dFBhdGgsXG4gICAgfSxcbiAgKTtcblxuICByZXR1cm4ge1xuICAgIGVycm9yczogWy4uLnRyYW5zZm9ybVJlc3VsdC5lcnJvcnMsIC4uLmVycm9yc10sXG4gICAgd2FybmluZ3M6IFsuLi50cmFuc2Zvcm1SZXN1bHQud2FybmluZ3MsIC4uLndhcm5pbmdzXSxcbiAgICBjb250ZW50LFxuICAgIGNvbnRlbnRXaXRob3V0Q3JpdGljYWxDc3NJbmxpbmVkLFxuICB9O1xufVxuIl19