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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
class IndexHtmlGenerator {
    constructor(options) {
        var _a, _b;
        this.options = options;
        const extraPlugins = [];
        if ((_a = this.options.optimization) === null || _a === void 0 ? void 0 : _a.fonts.inline) {
            extraPlugins.push(inlineFontsPlugin(this));
        }
        if ((_b = this.options.optimization) === null || _b === void 0 ? void 0 : _b.styles.inlineCritical) {
            extraPlugins.push(inlineCriticalCssPlugin(this));
        }
        this.plugins = [augmentIndexHtmlPlugin(this), ...extraPlugins, postTransformPlugin(this)];
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
        const { lang, baseHref, outputPath = '', files } = options;
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
        });
    };
}
function inlineFontsPlugin({ options }) {
    var _a;
    const inlineFontsProcessor = new inline_fonts_1.InlineFontsProcessor({
        minify: (_a = options.optimization) === null || _a === void 0 ? void 0 : _a.styles.minify,
    });
    return async (html) => inlineFontsProcessor.process(html);
}
function inlineCriticalCssPlugin(generator) {
    var _a;
    const inlineCriticalCssProcessor = new inline_critical_css_1.InlineCriticalCssProcessor({
        minify: (_a = generator.options.optimization) === null || _a === void 0 ? void 0 : _a.styles.minify,
        deployUrl: generator.options.deployUrl,
        readAsset: (filePath) => generator.readAsset(filePath),
    });
    return async (html, options) => inlineCriticalCssProcessor.process(html, { outputPath: options.outputPath });
}
function postTransformPlugin({ options }) {
    return async (html) => (options.postTransform ? options.postTransform(html) : html);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgtaHRtbC1nZW5lcmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9pbmRleC1maWxlL2luZGV4LWh0bWwtZ2VuZXJhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx1Q0FBeUI7QUFDekIsK0JBQTRCO0FBRzVCLDRDQUF3QztBQUN4Qyw2REFBZ0c7QUFDaEcsK0RBQW1FO0FBQ25FLGlEQUFzRDtBQWlDdEQsTUFBYSxrQkFBa0I7SUFHN0IsWUFBcUIsT0FBa0M7O1FBQWxDLFlBQU8sR0FBUCxPQUFPLENBQTJCO1FBQ3JELE1BQU0sWUFBWSxHQUErQixFQUFFLENBQUM7UUFDcEQsSUFBSSxNQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSwwQ0FBRSxLQUFLLENBQUMsTUFBTSxFQUFFO1lBQzNDLFlBQVksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUM1QztRQUVELElBQUksTUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksMENBQUUsTUFBTSxDQUFDLGNBQWMsRUFBRTtZQUNwRCxZQUFZLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDbEQ7UUFFRCxJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxZQUFZLEVBQUUsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM1RixDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUF5QztRQUNyRCxJQUFJLE9BQU8sR0FBRyxJQUFBLG9CQUFRLEVBQUMsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxP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LENBQUM7S0FDdkQsQ0FBQyxDQUFDO0lBRUgsT0FBTyxLQUFLLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxFQUFFLENBQzdCLDBCQUEwQixDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7QUFDakYsQ0FBQztBQUVELFNBQVMsbUJBQW1CLENBQUMsRUFBRSxPQUFPLEVBQXNCO0lBQzFELE9BQU8sS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN0RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRDYWNoZWRPcHRpb25zIH0gZnJvbSAnLi4vbm9ybWFsaXplLWNhY2hlJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRPcHRpbWl6YXRpb25PcHRpb25zIH0gZnJvbSAnLi4vbm9ybWFsaXplLW9wdGltaXphdGlvbic7XG5pbXBvcnQgeyBzdHJpcEJvbSB9IGZyb20gJy4uL3N0cmlwLWJvbSc7XG5pbXBvcnQgeyBDcm9zc09yaWdpblZhbHVlLCBFbnRyeXBvaW50LCBGaWxlSW5mbywgYXVnbWVudEluZGV4SHRtbCB9IGZyb20gJy4vYXVnbWVudC1pbmRleC1odG1sJztcbmltcG9ydCB7IElubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yIH0gZnJvbSAnLi9pbmxpbmUtY3JpdGljYWwtY3NzJztcbmltcG9ydCB7IElubGluZUZvbnRzUHJvY2Vzc29yIH0gZnJvbSAnLi9pbmxpbmUtZm9udHMnO1xuXG50eXBlIEluZGV4SHRtbEdlbmVyYXRvclBsdWdpbiA9IChcbiAgaHRtbDogc3RyaW5nLFxuICBvcHRpb25zOiBJbmRleEh0bWxHZW5lcmF0b3JQcm9jZXNzT3B0aW9ucyxcbikgPT4gUHJvbWlzZTxzdHJpbmcgfCBJbmRleEh0bWxUcmFuc2Zvcm1SZXN1bHQ+O1xuXG5leHBvcnQgaW50ZXJmYWNlIEluZGV4SHRtbEdlbmVyYXRvclByb2Nlc3NPcHRpb25zIHtcbiAgbGFuZzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBiYXNlSHJlZjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBvdXRwdXRQYXRoOiBzdHJpbmc7XG4gIGZpbGVzOiBGaWxlSW5mb1tdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEluZGV4SHRtbEdlbmVyYXRvck9wdGlvbnMge1xuICBpbmRleFBhdGg6IHN0cmluZztcbiAgZGVwbG95VXJsPzogc3RyaW5nO1xuICBzcmk/OiBib29sZWFuO1xuICBlbnRyeXBvaW50czogRW50cnlwb2ludFtdO1xuICBwb3N0VHJhbnNmb3JtPzogSW5kZXhIdG1sVHJhbnNmb3JtO1xuICBjcm9zc09yaWdpbj86IENyb3NzT3JpZ2luVmFsdWU7XG4gIG9wdGltaXphdGlvbj86IE5vcm1hbGl6ZWRPcHRpbWl6YXRpb25PcHRpb25zO1xuICBjYWNoZT86IE5vcm1hbGl6ZWRDYWNoZWRPcHRpb25zO1xufVxuXG5leHBvcnQgdHlwZSBJbmRleEh0bWxUcmFuc2Zvcm0gPSAoY29udGVudDogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZz47XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5kZXhIdG1sVHJhbnNmb3JtUmVzdWx0IHtcbiAgY29udGVudDogc3RyaW5nO1xuICB3YXJuaW5nczogc3RyaW5nW107XG4gIGVycm9yczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBjbGFzcyBJbmRleEh0bWxHZW5lcmF0b3Ige1xuICBwcml2YXRlIHJlYWRvbmx5IHBsdWdpbnM6IEluZGV4SHRtbEdlbmVyYXRvclBsdWdpbltdO1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IG9wdGlvbnM6IEluZGV4SHRtbEdlbmVyYXRvck9wdGlvbnMpIHtcbiAgICBjb25zdCBleHRyYVBsdWdpbnM6IEluZGV4SHRtbEdlbmVyYXRvclBsdWdpbltdID0gW107XG4gICAgaWYgKHRoaXMub3B0aW9ucy5vcHRpbWl6YXRpb24/LmZvbnRzLmlubGluZSkge1xuICAgICAgZXh0cmFQbHVnaW5zLnB1c2goaW5saW5lRm9udHNQbHVnaW4odGhpcykpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMub3B0aW1pemF0aW9uPy5zdHlsZXMuaW5saW5lQ3JpdGljYWwpIHtcbiAgICAgIGV4dHJhUGx1Z2lucy5wdXNoKGlubGluZUNyaXRpY2FsQ3NzUGx1Z2luKHRoaXMpKTtcbiAgICB9XG5cbiAgICB0aGlzLnBsdWdpbnMgPSBbYXVnbWVudEluZGV4SHRtbFBsdWdpbih0aGlzKSwgLi4uZXh0cmFQbHVnaW5zLCBwb3N0VHJhbnNmb3JtUGx1Z2luKHRoaXMpXTtcbiAgfVxuXG4gIGFzeW5jIHByb2Nlc3Mob3B0aW9uczogSW5kZXhIdG1sR2VuZXJhdG9yUHJvY2Vzc09wdGlvbnMpOiBQcm9taXNlPEluZGV4SHRtbFRyYW5zZm9ybVJlc3VsdD4ge1xuICAgIGxldCBjb250ZW50ID0gc3RyaXBCb20oYXdhaXQgdGhpcy5yZWFkSW5kZXgodGhpcy5vcHRpb25zLmluZGV4UGF0aCkpO1xuICAgIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgcGx1Z2luIG9mIHRoaXMucGx1Z2lucykge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcGx1Z2luKGNvbnRlbnQsIG9wdGlvbnMpO1xuICAgICAgaWYgKHR5cGVvZiByZXN1bHQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGNvbnRlbnQgPSByZXN1bHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb250ZW50ID0gcmVzdWx0LmNvbnRlbnQ7XG5cbiAgICAgICAgaWYgKHJlc3VsdC53YXJuaW5ncy5sZW5ndGgpIHtcbiAgICAgICAgICB3YXJuaW5ncy5wdXNoKC4uLnJlc3VsdC53YXJuaW5ncyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmVzdWx0LmVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaCguLi5yZXN1bHQuZXJyb3JzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBjb250ZW50LFxuICAgICAgd2FybmluZ3MsXG4gICAgICBlcnJvcnMsXG4gICAgfTtcbiAgfVxuXG4gIGFzeW5jIHJlYWRBc3NldChwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiBmcy5wcm9taXNlcy5yZWFkRmlsZShwYXRoLCAndXRmLTgnKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyByZWFkSW5kZXgocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gZnMucHJvbWlzZXMucmVhZEZpbGUocGF0aCwgJ3V0Zi04Jyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gYXVnbWVudEluZGV4SHRtbFBsdWdpbihnZW5lcmF0b3I6IEluZGV4SHRtbEdlbmVyYXRvcik6IEluZGV4SHRtbEdlbmVyYXRvclBsdWdpbiB7XG4gIGNvbnN0IHsgZGVwbG95VXJsLCBjcm9zc09yaWdpbiwgc3JpID0gZmFsc2UsIGVudHJ5cG9pbnRzIH0gPSBnZW5lcmF0b3Iub3B0aW9ucztcblxuICByZXR1cm4gYXN5bmMgKGh0bWwsIG9wdGlvbnMpID0+IHtcbiAgICBjb25zdCB7IGxhbmcsIGJhc2VIcmVmLCBvdXRwdXRQYXRoID0gJycsIGZpbGVzIH0gPSBvcHRpb25zO1xuXG4gICAgcmV0dXJuIGF1Z21lbnRJbmRleEh0bWwoe1xuICAgICAgaHRtbCxcbiAgICAgIGJhc2VIcmVmLFxuICAgICAgZGVwbG95VXJsLFxuICAgICAgY3Jvc3NPcmlnaW4sXG4gICAgICBzcmksXG4gICAgICBsYW5nLFxuICAgICAgZW50cnlwb2ludHMsXG4gICAgICBsb2FkT3V0cHV0RmlsZTogKGZpbGVQYXRoKSA9PiBnZW5lcmF0b3IucmVhZEFzc2V0KGpvaW4ob3V0cHV0UGF0aCwgZmlsZVBhdGgpKSxcbiAgICAgIGZpbGVzLFxuICAgIH0pO1xuICB9O1xufVxuXG5mdW5jdGlvbiBpbmxpbmVGb250c1BsdWdpbih7IG9wdGlvbnMgfTogSW5kZXhIdG1sR2VuZXJhdG9yKTogSW5kZXhIdG1sR2VuZXJhdG9yUGx1Z2luIHtcbiAgY29uc3QgaW5saW5lRm9udHNQcm9jZXNzb3IgPSBuZXcgSW5saW5lRm9udHNQcm9jZXNzb3Ioe1xuICAgIG1pbmlmeTogb3B0aW9ucy5vcHRpbWl6YXRpb24/LnN0eWxlcy5taW5pZnksXG4gIH0pO1xuXG4gIHJldHVybiBhc3luYyAoaHRtbCkgPT4gaW5saW5lRm9udHNQcm9jZXNzb3IucHJvY2VzcyhodG1sKTtcbn1cblxuZnVuY3Rpb24gaW5saW5lQ3JpdGljYWxDc3NQbHVnaW4oZ2VuZXJhdG9yOiBJbmRleEh0bWxHZW5lcmF0b3IpOiBJbmRleEh0bWxHZW5lcmF0b3JQbHVnaW4ge1xuICBjb25zdCBpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NvciA9IG5ldyBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvcih7XG4gICAgbWluaWZ5OiBnZW5lcmF0b3Iub3B0aW9ucy5vcHRpbWl6YXRpb24/LnN0eWxlcy5taW5pZnksXG4gICAgZGVwbG95VXJsOiBnZW5lcmF0b3Iub3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgcmVhZEFzc2V0OiAoZmlsZVBhdGgpID0+IGdlbmVyYXRvci5yZWFkQXNzZXQoZmlsZVBhdGgpLFxuICB9KTtcblxuICByZXR1cm4gYXN5bmMgKGh0bWwsIG9wdGlvbnMpID0+XG4gICAgaW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IucHJvY2VzcyhodG1sLCB7IG91dHB1dFBhdGg6IG9wdGlvbnMub3V0cHV0UGF0aCB9KTtcbn1cblxuZnVuY3Rpb24gcG9zdFRyYW5zZm9ybVBsdWdpbih7IG9wdGlvbnMgfTogSW5kZXhIdG1sR2VuZXJhdG9yKTogSW5kZXhIdG1sR2VuZXJhdG9yUGx1Z2luIHtcbiAgcmV0dXJuIGFzeW5jIChodG1sKSA9PiAob3B0aW9ucy5wb3N0VHJhbnNmb3JtID8gb3B0aW9ucy5wb3N0VHJhbnNmb3JtKGh0bWwpIDogaHRtbCk7XG59XG4iXX0=