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
exports.IndexHtmlGenerator = void 0;
const fs = __importStar(require("fs"));
const path_1 = require("path");
const strip_bom_1 = require("../strip-bom");
const augment_index_html_1 = require("./augment-index-html");
const inline_critical_css_1 = require("./inline-critical-css");
const inline_fonts_1 = require("./inline-fonts");
const style_nonce_1 = require("./style-nonce");
class IndexHtmlGenerator {
    constructor(options) {
        this.options = options;
        const extraPlugins = [];
        if (this.options.optimization?.fonts.inline) {
            extraPlugins.push(inlineFontsPlugin(this));
        }
        if (this.options.optimization?.styles.inlineCritical) {
            extraPlugins.push(inlineCriticalCssPlugin(this));
        }
        this.plugins = [
            augmentIndexHtmlPlugin(this),
            ...extraPlugins,
            // Runs after the `extraPlugins` to capture any nonce or
            // `style` tags that might've been added by them.
            addStyleNoncePlugin(),
            postTransformPlugin(this),
        ];
    }
    async process(options) {
        let content = (0, strip_bom_1.stripBom)(await this.readIndex(this.options.indexPath));
        const warnings = [];
        const errors = [];
        for (const plugin of this.plugins) {
            const result = await plugin(content, options);
            if (typeof result === 'string') {
                content = result;
            }
            else {
                content = result.content;
                if (result.warnings.length) {
                    warnings.push(...result.warnings);
                }
                if (result.errors.length) {
                    errors.push(...result.errors);
                }
            }
        }
        return {
            content,
            warnings,
            errors,
        };
    }
    async readAsset(path) {
        return fs.promises.readFile(path, 'utf-8');
    }
    async readIndex(path) {
        return fs.promises.readFile(path, 'utf-8');
    }
}
exports.IndexHtmlGenerator = IndexHtmlGenerator;
function augmentIndexHtmlPlugin(generator) {
    const { deployUrl, crossOrigin, sri = false, entrypoints } = generator.options;
    return async (html, options) => {
        const { lang, baseHref, outputPath = '', files, hints } = options;
        return (0, augment_index_html_1.augmentIndexHtml)({
            html,
            baseHref,
            deployUrl,
            crossOrigin,
            sri,
            lang,
            entrypoints,
            loadOutputFile: (filePath) => generator.readAsset((0, path_1.join)(outputPath, filePath)),
            files,
            hints,
        });
    };
}
function inlineFontsPlugin({ options }) {
    const inlineFontsProcessor = new inline_fonts_1.InlineFontsProcessor({
        minify: options.optimization?.styles.minify,
    });
    return async (html) => inlineFontsProcessor.process(html);
}
function inlineCriticalCssPlugin(generator) {
    const inlineCriticalCssProcessor = new inline_critical_css_1.InlineCriticalCssProcessor({
        minify: generator.options.optimization?.styles.minify,
        deployUrl: generator.options.deployUrl,
        readAsset: (filePath) => generator.readAsset(filePath),
    });
    return async (html, options) => inlineCriticalCssProcessor.process(html, { outputPath: options.outputPath });
}
function addStyleNoncePlugin() {
    return (html) => (0, style_nonce_1.addStyleNonce)(html);
}
function postTransformPlugin({ options }) {
    return async (html) => (options.postTransform ? options.postTransform(html) : html);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgtaHRtbC1nZW5lcmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9pbmRleC1maWxlL2luZGV4LWh0bWwtZ2VuZXJhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsdUNBQXlCO0FBQ3pCLCtCQUE0QjtBQUc1Qiw0Q0FBd0M7QUFDeEMsNkRBQWdHO0FBQ2hHLCtEQUFtRTtBQUNuRSxpREFBc0Q7QUFDdEQsK0NBQThDO0FBb0M5QyxNQUFhLGtCQUFrQjtJQUc3QixZQUFxQixPQUFrQztRQUFsQyxZQUFPLEdBQVAsT0FBTyxDQUEyQjtRQUNyRCxNQUFNLFlBQVksR0FBK0IsRUFBRSxDQUFDO1FBQ3BELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsS0FBSyxDQUFDLE1BQU0sRUFBRTtZQUMzQyxZQUFZLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDNUM7UUFFRCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxjQUFjLEVBQUU7WUFDcEQsWUFBWSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQ2xEO1FBRUQsSUFBSSxDQUFDLE9BQU8sR0FBRztZQUNiLHNCQUFzQixDQUFDLElBQUksQ0FBQztZQUM1QixHQUFHLFlBQVk7WUFDZix3REFBd0Q7WUFDeEQsaURBQWlEO1lBQ2pELG1CQUFtQixFQUFFO1lBQ3JCLG1CQUFtQixDQUFDLElBQUksQ0FBQztTQUMxQixDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBeUM7UUFDckQsSUFBSSxPQUFPLEdBQUcsSUFB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LEVBQUUsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO0tBQ3ZELENBQUMsQ0FBQztJQUVILE9BQU8sS0FBSyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsRUFBRSxDQUM3QiwwQkFBMEIsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0FBQ2pGLENBQUM7QUFFRCxTQUFTLG1CQUFtQjtJQUMxQixPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFBLDJCQUFhLEVBQUMsSUFBSSxDQUFDLENBQUM7QUFDdkMsQ0FBQztBQUVELFNBQVMsbUJBQW1CLENBQUMsRUFBRSxPQUFPLEVBQXNCO0lBQzFELE9BQU8sS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN0RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRDYWNoZWRPcHRpb25zIH0gZnJvbSAnLi4vbm9ybWFsaXplLWNhY2hlJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRPcHRpbWl6YXRpb25PcHRpb25zIH0gZnJvbSAnLi4vbm9ybWFsaXplLW9wdGltaXphdGlvbic7XG5pbXBvcnQgeyBzdHJpcEJvbSB9IGZyb20gJy4uL3N0cmlwLWJvbSc7XG5pbXBvcnQgeyBDcm9zc09yaWdpblZhbHVlLCBFbnRyeXBvaW50LCBGaWxlSW5mbywgYXVnbWVudEluZGV4SHRtbCB9IGZyb20gJy4vYXVnbWVudC1pbmRleC1odG1sJztcbmltcG9ydCB7IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yIH0gZnJvbSAnLi9pbmxpbmUtY3JpdGljYWwtY3NzJztcbmltcG9ydCB7IElubGluZUZvbnRzUHJvY2Vzc29yIH0gZnJvbSAnLi9pbmxpbmUtZm9udHMnO1xuaW1wb3J0IHsgYWRkU3R5bGVOb25jZSB9IGZyb20gJy4vc3R5bGUtbm9uY2UnO1xuXG50eXBlIEluZGV4SHRtbEdlbmVyYXRvclBsdWdpbiA9IChcbiAgaHRtbDogc3RyaW5nLFxuICBvcHRpb25zOiBJbmRleEh0bWxHZW5lcmF0b3JQcm9jZXNzT3B0aW9ucyxcbikgPT4gUHJvbWlzZTxzdHJpbmcgfCBJbmRleEh0bWxUcmFuc2Zvcm1SZXN1bHQ+O1xuXG5leHBvcnQgdHlwZSBIaW50TW9kZSA9ICdwcmVmZXRjaCcgfCAncHJlbG9hZCcgfCAnbW9kdWxlcHJlbG9hZCcgfCAncHJlY29ubmVjdCcgfCAnZG5zLXByZWZldGNoJztcblxuZXhwb3J0IGludGVyZmFjZSBJbmRleEh0bWxHZW5lcmF0b3JQcm9jZXNzT3B0aW9ucyB7XG4gIGxhbmc6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgYmFzZUhyZWY6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgb3V0cHV0UGF0aDogc3RyaW5nO1xuICBmaWxlczogRmlsZUluZm9bXTtcbiAgaGludHM/OiB7IHVybDogc3RyaW5nOyBtb2RlOiBIaW50TW9kZSB9W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5kZXhIdG1sR2VuZXJhdG9yT3B0aW9ucyB7XG4gIGluZGV4UGF0aDogc3RyaW5nO1xuICBkZXBsb3lVcmw/OiBzdHJpbmc7XG4gIHNyaT86IGJvb2xlYW47XG4gIGVudHJ5cG9pbnRzOiBFbnRyeXBvaW50W107XG4gIHBvc3RUcmFuc2Zvcm0/OiBJbmRleEh0bWxUcmFuc2Zvcm07XG4gIGNyb3NzT3JpZ2luPzogQ3Jvc3NPcmlnaW5WYWx1ZTtcbiAgb3B0aW1pemF0aW9uPzogTm9ybWFsaXplZE9wdGltaXphdGlvbk9wdGlvbnM7XG4gIGNhY2hlPzogTm9ybWFsaXplZENhY2hlZE9wdGlvbnM7XG59XG5cbmV4cG9ydCB0eXBlIEluZGV4SHRtbFRyYW5zZm9ybSA9IChjb250ZW50OiBzdHJpbmcpID0+IFByb21pc2U8c3RyaW5nPjtcblxuZXhwb3J0IGludGVyZmFjZSBJbmRleEh0bWxUcmFuc2Zvcm1SZXN1bHQge1xuICBjb250ZW50OiBzdHJpbmc7XG4gIHdhcm5pbmdzOiBzdHJpbmdbXTtcbiAgZXJyb3JzOiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGNsYXNzIEluZGV4SHRtbEdlbmVyYXRvciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgcGx1Z2luczogSW5kZXhIdG1sR2VuZXJhdG9yUGx1Z2luW107XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgb3B0aW9uczogSW5kZXhIdG1sR2VuZXJhdG9yT3B0aW9ucykge1xuICAgIGNvbnN0IGV4dHJhUGx1Z2luczogSW5kZXhIdG1sR2VuZXJhdG9yUGx1Z2luW10gPSBbXTtcbiAgICBpZiAodGhpcy5vcHRpb25zLm9wdGltaXphdGlvbj8uZm9udHMuaW5saW5lKSB7XG4gICAgICBleHRyYVBsdWdpbnMucHVzaChpbmxpbmVGb250c1BsdWdpbih0aGlzKSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5vcHRpbWl6YXRpb24/LnN0eWxlcy5pbmxpbmVDcml0aWNhbCkge1xuICAgICAgZXh0cmFQbHVnaW5zLnB1c2goaW5saW5lQ3JpdGljYWxDc3NQbHVnaW4odGhpcykpO1xuICAgIH1cblxuICAgIHRoaXMucGx1Z2lucyA9IFtcbiAgICAgIGF1Z21lbnRJbmRleEh0bWxQbHVnaW4odGhpcyksXG4gICAgICAuLi5leHRyYVBsdWdpbnMsXG4gICAgICAvLyBSdW5zIGFmdGVyIHRoZSBgZXh0cmFQbHVnaW5zYCB0byBjYXB0dXJlIGFueSBub25jZSBvclxuICAgICAgLy8gYHN0eWxlYCB0YWdzIHRoYXQgbWlnaHQndmUgYmVlbiBhZGRlZCBieSB0aGVtLlxuICAgICAgYWRkU3R5bGVOb25jZVBsdWdpbigpLFxuICAgICAgcG9zdFRyYW5zZm9ybVBsdWdpbih0aGlzKSxcbiAgICBdO1xuICB9XG5cbiAgYXN5bmMgcHJvY2VzcyhvcHRpb25zOiBJbmRleEh0bWxHZW5lcmF0b3JQcm9jZXNzT3B0aW9ucyk6IFByb21pc2U8SW5kZXhIdG1sVHJhbnNmb3JtUmVzdWx0PiB7XG4gICAgbGV0IGNvbnRlbnQgPSBzdHJpcEJvbShhd2FpdCB0aGlzLnJlYWRJbmRleCh0aGlzLm9wdGlvbnMuaW5kZXhQYXRoKSk7XG4gICAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBwbHVnaW4gb2YgdGhpcy5wbHVnaW5zKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwbHVnaW4oY29udGVudCwgb3B0aW9ucyk7XG4gICAgICBpZiAodHlwZW9mIHJlc3VsdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgY29udGVudCA9IHJlc3VsdDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnRlbnQgPSByZXN1bHQuY29udGVudDtcblxuICAgICAgICBpZiAocmVzdWx0Lndhcm5pbmdzLmxlbmd0aCkge1xuICAgICAgICAgIHdhcm5pbmdzLnB1c2goLi4ucmVzdWx0Lndhcm5pbmdzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgIGVycm9ycy5wdXNoKC4uLnJlc3VsdC5lcnJvcnMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRlbnQsXG4gICAgICB3YXJuaW5ncyxcbiAgICAgIGVycm9ycyxcbiAgICB9O1xuICB9XG5cbiAgYXN5bmMgcmVhZEFzc2V0KHBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIGZzLnByb21pc2VzLnJlYWRGaWxlKHBhdGgsICd1dGYtOCcpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIHJlYWRJbmRleChwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiBmcy5wcm9taXNlcy5yZWFkRmlsZShwYXRoLCAndXRmLTgnKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhdWdtZW50SW5kZXhIdG1sUGx1Z2luKGdlbmVyYXRvcjogSW5kZXhIdG1sR2VuZXJhdG9yKTogSW5kZXhIdG1sR2VuZXJhdG9yUGx1Z2luIHtcbiAgY29uc3QgeyBkZXBsb3lVcmwsIGNyb3NzT3JpZ2luLCBzcmkgPSBmYWxzZSwgZW50cnlwb2ludHMgfSA9IGdlbmVyYXRvci5vcHRpb25zO1xuXG4gIHJldHVybiBhc3luYyAoaHRtbCwgb3B0aW9ucykgPT4ge1xuICAgIGNvbnN0IHsgbGFuZywgYmFzZUhyZWYsIG91dHB1dFBhdGggPSAnJywgZmlsZXMsIGhpbnRzIH0gPSBvcHRpb25zO1xuXG4gICAgcmV0dXJuIGF1Z21lbnRJbmRleEh0bWwoe1xuICAgICAgaHRtbCxcbiAgICAgIGJhc2VIcmVmLFxuICAgICAgZGVwbG95VXJsLFxuICAgICAgY3Jvc3NPcmlnaW4sXG4gICAgICBzcmksXG4gICAgICBsYW5nLFxuICAgICAgZW50cnlwb2ludHMsXG4gICAgICBsb2FkT3V0cHV0RmlsZTogKGZpbGVQYXRoKSA9PiBnZW5lcmF0b3IucmVhZEFzc2V0KGpvaW4ob3V0cHV0UGF0aCwgZmlsZVBhdGgpKSxcbiAgICAgIGZpbGVzLFxuICAgICAgaGludHMsXG4gICAgfSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIGlubGluZUZvbnRzUGx1Z2luKHsgb3B0aW9ucyB9OiBJbmRleEh0bWxHZW5lcmF0b3IpOiBJbmRleEh0bWxHZW5lcmF0b3JQbHVnaW4ge1xuICBjb25zdCBpbmxpbmVGb250c1Byb2Nlc3NvciA9IG5ldyBJbmxpbmVGb250c1Byb2Nlc3Nvcih7XG4gICAgbWluaWZ5OiBvcHRpb25zLm9wdGltaXphdGlvbj8uc3R5bGVzLm1pbmlmeSxcbiAgfSk7XG5cbiAgcmV0dXJuIGFzeW5jIChodG1sKSA9PiBpbmxpbmVGb250c1Byb2Nlc3Nvci5wcm9jZXNzKGh0bWwpO1xufVxuXG5mdW5jdGlvbiBpbmxpbmVDcml0aWNhbENzc1BsdWdpbihnZW5lcmF0b3I6IEluZGV4SHRtbEdlbmVyYXRvcik6IEluZGV4SHRtbEdlbmVyYXRvclBsdWdpbiB7XG4gIGNvbnN0IGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yID0gbmV3IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yKHtcbiAgICBtaW5pZnk6IGdlbmVyYXRvci5vcHRpb25zLm9wdGltaXphdGlvbj8uc3R5bGVzLm1pbmlmeSxcbiAgICBkZXBsb3lVcmw6IGdlbmVyYXRvci5vcHRpb25zLmRlcGxveVVybCxcbiAgICByZWFkQXNzZXQ6IChmaWxlUGF0aCkgPT4gZ2VuZXJhdG9yLnJlYWRBc3NldChmaWxlUGF0aCksXG4gIH0pO1xuXG4gIHJldHVybiBhc3luYyAoaHRtbCwgb3B0aW9ucykgPT5cbiAgICBpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvci5wcm9jZXNzKGh0bWwsIHsgb3V0cHV0UGF0aDogb3B0aW9ucy5vdXRwdXRQYXRoIH0pO1xufVxuXG5mdW5jdGlvbiBhZGRTdHlsZU5vbmNlUGx1Z2luKCk6IEluZGV4SHRtbEdlbmVyYXRvclBsdWdpbiB7XG4gIHJldHVybiAoaHRtbCkgPT4gYWRkU3R5bGVOb25jZShodG1sKTtcbn1cblxuZnVuY3Rpb24gcG9zdFRyYW5zZm9ybVBsdWdpbih7IG9wdGlvbnMgfTogSW5kZXhIdG1sR2VuZXJhdG9yKTogSW5kZXhIdG1sR2VuZXJhdG9yUGx1Z2luIHtcbiAgcmV0dXJuIGFzeW5jIChodG1sKSA9PiAob3B0aW9ucy5wb3N0VHJhbnNmb3JtID8gb3B0aW9ucy5wb3N0VHJhbnNmb3JtKGh0bWwpIDogaHRtbCk7XG59XG4iXX0=