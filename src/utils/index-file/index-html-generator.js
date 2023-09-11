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
    options;
    plugins;
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
    const { deployUrl, crossOrigin, sri = false, entrypoints, imageDomains } = generator.options;
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
            imageDomains,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgtaHRtbC1nZW5lcmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9pbmRleC1maWxlL2luZGV4LWh0bWwtZ2VuZXJhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsdUNBQXlCO0FBQ3pCLCtCQUE0QjtBQUc1Qiw0Q0FBd0M7QUFDeEMsNkRBQWdHO0FBQ2hHLCtEQUFtRTtBQUNuRSxpREFBc0Q7QUFDdEQsK0NBQThDO0FBcUM5QyxNQUFhLGtCQUFrQjtJQUdSO0lBRkosT0FBTyxDQUE2QjtJQUVyRCxZQUFxQixPQUFrQztRQUFsQyxZQUFPLEdBQVAsT0FBTyxDQUEyQjtRQUNyRCxNQUFNLFlBQVksR0FBK0IsRUFBRSxDQUFDO1FBQ3BELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsS0FBSyxDQUFDLE1BQU0sRUFBRTtZQUMzQyxZQUFZLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDNUM7UUFFRCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxjQUFjLEVBQUU7WUFDcEQsWUFBWSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQ2xEO1FBRUQsSUFBSSxDQUFDLE9BQU8sR0FBRztZQUNiLHNCQUFzQixDQUFDLElBQUksQ0FBQztZQUM1QixHQUFHLFlBQVk7WUFDZix3REFBd0Q7WUFDeEQsaURBQWlEO1lBQ2pELG1CQUFtQixFQUFFO1lBQ3JCLG1CQUFtQixDQUFDLElBQUksQ0FBQztTQUMxQixDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBeUM7UUFD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LEVBQUUsU0FBUyxDQUFDLE9BQU8sQ0FBQyxTQUFTO1FBQ3RDLFNBQVMsRUFBRSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUM7S0FDdkQsQ0FBQyxDQUFDO0lBRUgsT0FBTyxLQUFLLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxFQUFFLENBQzdCLDBCQUEwQixDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7QUFDakYsQ0FBQztBQUVELFNBQVMsbUJBQW1CO0lBQzFCLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUEsMkJBQWEsRUFBQyxJQUFJLENBQUMsQ0FBQztBQUN2QyxDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxFQUFFLE9BQU8sRUFBc0I7SUFDMUQsT0FBTyxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3RGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgTm9ybWFsaXplZENhY2hlZE9wdGlvbnMgfSBmcm9tICcuLi9ub3JtYWxpemUtY2FjaGUnO1xuaW1wb3J0IHsgTm9ybWFsaXplZE9wdGltaXphdGlvbk9wdGlvbnMgfSBmcm9tICcuLi9ub3JtYWxpemUtb3B0aW1pemF0aW9uJztcbmltcG9ydCB7IHN0cmlwQm9tIH0gZnJvbSAnLi4vc3RyaXAtYm9tJztcbmltcG9ydCB7IENyb3NzT3JpZ2luVmFsdWUsIEVudHJ5cG9pbnQsIEZpbGVJbmZvLCBhdWdtZW50SW5kZXhIdG1sIH0gZnJvbSAnLi9hdWdtZW50LWluZGV4LWh0bWwnO1xuaW1wb3J0IHsgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgfSBmcm9tICcuL2lubGluZS1jcml0aWNhbC1jc3MnO1xuaW1wb3J0IHsgSW5saW5lRm9udHNQcm9jZXNzb3IgfSBmcm9tICcuL2lubGluZS1mb250cyc7XG5pbXBvcnQgeyBhZGRTdHlsZU5vbmNlIH0gZnJvbSAnLi9zdHlsZS1ub25jZSc7XG5cbnR5cGUgSW5kZXhIdG1sR2VuZXJhdG9yUGx1Z2luID0gKFxuICBodG1sOiBzdHJpbmcsXG4gIG9wdGlvbnM6IEluZGV4SHRtbEdlbmVyYXRvclByb2Nlc3NPcHRpb25zLFxuKSA9PiBQcm9taXNlPHN0cmluZyB8IEluZGV4SHRtbFRyYW5zZm9ybVJlc3VsdD47XG5cbmV4cG9ydCB0eXBlIEhpbnRNb2RlID0gJ3ByZWZldGNoJyB8ICdwcmVsb2FkJyB8ICdtb2R1bGVwcmVsb2FkJyB8ICdwcmVjb25uZWN0JyB8ICdkbnMtcHJlZmV0Y2gnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEluZGV4SHRtbEdlbmVyYXRvclByb2Nlc3NPcHRpb25zIHtcbiAgbGFuZzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBiYXNlSHJlZjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBvdXRwdXRQYXRoOiBzdHJpbmc7XG4gIGZpbGVzOiBGaWxlSW5mb1tdO1xuICBoaW50cz86IHsgdXJsOiBzdHJpbmc7IG1vZGU6IEhpbnRNb2RlOyBhcz86IHN0cmluZyB9W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5kZXhIdG1sR2VuZXJhdG9yT3B0aW9ucyB7XG4gIGluZGV4UGF0aDogc3RyaW5nO1xuICBkZXBsb3lVcmw/OiBzdHJpbmc7XG4gIHNyaT86IGJvb2xlYW47XG4gIGVudHJ5cG9pbnRzOiBFbnRyeXBvaW50W107XG4gIHBvc3RUcmFuc2Zvcm0/OiBJbmRleEh0bWxUcmFuc2Zvcm07XG4gIGNyb3NzT3JpZ2luPzogQ3Jvc3NPcmlnaW5WYWx1ZTtcbiAgb3B0aW1pemF0aW9uPzogTm9ybWFsaXplZE9wdGltaXphdGlvbk9wdGlvbnM7XG4gIGNhY2hlPzogTm9ybWFsaXplZENhY2hlZE9wdGlvbnM7XG4gIGltYWdlRG9tYWlucz86IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgdHlwZSBJbmRleEh0bWxUcmFuc2Zvcm0gPSAoY29udGVudDogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZz47XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5kZXhIdG1sVHJhbnNmb3JtUmVzdWx0IHtcbiAgY29udGVudDogc3RyaW5nO1xuICB3YXJuaW5nczogc3RyaW5nW107XG4gIGVycm9yczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBjbGFzcyBJbmRleEh0bWxHZW5lcmF0b3Ige1xuICBwcml2YXRlIHJlYWRvbmx5IHBsdWdpbnM6IEluZGV4SHRtbEdlbmVyYXRvclBsdWdpbltdO1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IG9wdGlvbnM6IEluZGV4SHRtbEdlbmVyYXRvck9wdGlvbnMpIHtcbiAgICBjb25zdCBleHRyYVBsdWdpbnM6IEluZGV4SHRtbEdlbmVyYXRvclBsdWdpbltdID0gW107XG4gICAgaWYgKHRoaXMub3B0aW9ucy5vcHRpbWl6YXRpb24/LmZvbnRzLmlubGluZSkge1xuICAgICAgZXh0cmFQbHVnaW5zLnB1c2goaW5saW5lRm9udHNQbHVnaW4odGhpcykpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMub3B0aW1pemF0aW9uPy5zdHlsZXMuaW5saW5lQ3JpdGljYWwpIHtcbiAgICAgIGV4dHJhUGx1Z2lucy5wdXNoKGlubGluZUNyaXRpY2FsQ3NzUGx1Z2luKHRoaXMpKTtcbiAgICB9XG5cbiAgICB0aGlzLnBsdWdpbnMgPSBbXG4gICAgICBhdWdtZW50SW5kZXhIdG1sUGx1Z2luKHRoaXMpLFxuICAgICAgLi4uZXh0cmFQbHVnaW5zLFxuICAgICAgLy8gUnVucyBhZnRlciB0aGUgYGV4dHJhUGx1Z2luc2AgdG8gY2FwdHVyZSBhbnkgbm9uY2Ugb3JcbiAgICAgIC8vIGBzdHlsZWAgdGFncyB0aGF0IG1pZ2h0J3ZlIGJlZW4gYWRkZWQgYnkgdGhlbS5cbiAgICAgIGFkZFN0eWxlTm9uY2VQbHVnaW4oKSxcbiAgICAgIHBvc3RUcmFuc2Zvcm1QbHVnaW4odGhpcyksXG4gICAgXTtcbiAgfVxuXG4gIGFzeW5jIHByb2Nlc3Mob3B0aW9uczogSW5kZXhIdG1sR2VuZXJhdG9yUHJvY2Vzc09wdGlvbnMpOiBQcm9taXNlPEluZGV4SHRtbFRyYW5zZm9ybVJlc3VsdD4ge1xuICAgIGxldCBjb250ZW50ID0gc3RyaXBCb20oYXdhaXQgdGhpcy5yZWFkSW5kZXgodGhpcy5vcHRpb25zLmluZGV4UGF0aCkpO1xuICAgIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgcGx1Z2luIG9mIHRoaXMucGx1Z2lucykge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGx1Z2luKGNvbnRlbnQsIG9wdGlvbnMpO1xuICAgICAgaWYgKHR5cGVvZiByZXN1bHQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGNvbnRlbnQgPSByZXN1bHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb250ZW50ID0gcmVzdWx0LmNvbnRlbnQ7XG5cbiAgICAgICAgaWYgKHJlc3VsdC53YXJuaW5ncy5sZW5ndGgpIHtcbiAgICAgICAgICB3YXJuaW5ncy5wdXNoKC4uLnJlc3VsdC53YXJuaW5ncyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmVzdWx0LmVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaCguLi5yZXN1bHQuZXJyb3JzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBjb250ZW50LFxuICAgICAgd2FybmluZ3MsXG4gICAgICBlcnJvcnMsXG4gICAgfTtcbiAgfVxuXG4gIGFzeW5jIHJlYWRBc3NldChwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiBmcy5wcm9taXNlcy5yZWFkRmlsZShwYXRoLCAndXRmLTgnKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyByZWFkSW5kZXgocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gZnMucHJvbWlzZXMucmVhZEZpbGUocGF0aCwgJ3V0Zi04Jyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gYXVnbWVudEluZGV4SHRtbFBsdWdpbihnZW5lcmF0b3I6IEluZGV4SHRtbEdlbmVyYXRvcik6IEluZGV4SHRtbEdlbmVyYXRvclBsdWdpbiB7XG4gIGNvbnN0IHsgZGVwbG95VXJsLCBjcm9zc09yaWdpbiwgc3JpID0gZmFsc2UsIGVudHJ5cG9pbnRzLCBpbWFnZURvbWFpbnMgfSA9IGdlbmVyYXRvci5vcHRpb25zO1xuXG4gIHJldHVybiBhc3luYyAoaHRtbCwgb3B0aW9ucykgPT4ge1xuICAgIGNvbnN0IHsgbGFuZywgYmFzZUhyZWYsIG91dHB1dFBhdGggPSAnJywgZmlsZXMsIGhpbnRzIH0gPSBvcHRpb25zO1xuXG4gICAgcmV0dXJuIGF1Z21lbnRJbmRleEh0bWwoe1xuICAgICAgaHRtbCxcbiAgICAgIGJhc2VIcmVmLFxuICAgICAgZGVwbG95VXJsLFxuICAgICAgY3Jvc3NPcmlnaW4sXG4gICAgICBzcmksXG4gICAgICBsYW5nLFxuICAgICAgZW50cnlwb2ludHMsXG4gICAgICBsb2FkT3V0cHV0RmlsZTogKGZpbGVQYXRoKSA9PiBnZW5lcmF0b3IucmVhZEFzc2V0KGpvaW4ob3V0cHV0UGF0aCwgZmlsZVBhdGgpKSxcbiAgICAgIGltYWdlRG9tYWlucyxcbiAgICAgIGZpbGVzLFxuICAgICAgaGludHMsXG4gICAgfSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIGlubGluZUZvbnRzUGx1Z2luKHsgb3B0aW9ucyB9OiBJbmRleEh0bWxHZW5lcmF0b3IpOiBJbmRleEh0bWxHZW5lcmF0b3JQbHVnaW4ge1xuICBjb25zdCBpbmxpbmVGb250c1Byb2Nlc3NvciA9IG5ldyBJbmxpbmVGb250c1Byb2Nlc3Nvcih7XG4gICAgbWluaWZ5OiBvcHRpb25zLm9wdGltaXphdGlvbj8uc3R5bGVzLm1pbmlmeSxcbiAgfSk7XG5cbiAgcmV0dXJuIGFzeW5jIChodG1sKSA9PiBpbmxpbmVGb250c1Byb2Nlc3Nvci5wcm9jZXNzKGh0bWwpO1xufVxuXG5mdW5jdGlvbiBpbmxpbmVDcml0aWNhbENzc1BsdWdpbihnZW5lcmF0b3I6IEluZGV4SHRtbEdlbmVyYXRvcik6IEluZGV4SHRtbEdlbmVyYXRvclBsdWdpbiB7XG4gIGNvbnN0IGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yID0gbmV3IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yKHtcbiAgICBtaW5pZnk6IGdlbmVyYXRvci5vcHRpb25zLm9wdGltaXphdGlvbj8uc3R5bGVzLm1pbmlmeSxcbiAgICBkZXBsb3lVcmw6IGdlbmVyYXRvci5vcHRpb25zLmRlcGxveVVybCxcbiAgICByZWFkQXNzZXQ6IChmaWxlUGF0aCkgPT4gZ2VuZXJhdG9yLnJlYWRBc3NldChmaWxlUGF0aCksXG4gIH0pO1xuXG4gIHJldHVybiBhc3luYyAoaHRtbCwgb3B0aW9ucykgPT5cbiAgICBpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvci5wcm9jZXNzKGh0bWwsIHsgb3V0cHV0UGF0aDogb3B0aW9ucy5vdXRwdXRQYXRoIH0pO1xufVxuXG5mdW5jdGlvbiBhZGRTdHlsZU5vbmNlUGx1Z2luKCk6IEluZGV4SHRtbEdlbmVyYXRvclBsdWdpbiB7XG4gIHJldHVybiAoaHRtbCkgPT4gYWRkU3R5bGVOb25jZShodG1sKTtcbn1cblxuZnVuY3Rpb24gcG9zdFRyYW5zZm9ybVBsdWdpbih7IG9wdGlvbnMgfTogSW5kZXhIdG1sR2VuZXJhdG9yKTogSW5kZXhIdG1sR2VuZXJhdG9yUGx1Z2luIHtcbiAgcmV0dXJuIGFzeW5jIChodG1sKSA9PiAob3B0aW9ucy5wb3N0VHJhbnNmb3JtID8gb3B0aW9ucy5wb3N0VHJhbnNmb3JtKGh0bWwpIDogaHRtbCk7XG59XG4iXX0=