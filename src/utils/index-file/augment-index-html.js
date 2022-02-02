"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.augmentIndexHtml = void 0;
const crypto_1 = require("crypto");
const load_esm_1 = require("../load-esm");
const html_rewriting_stream_1 = require("./html-rewriting-stream");
/*
 * Helper function used by the IndexHtmlWebpackPlugin.
 * Can also be directly used by builder, e. g. in order to generate an index.html
 * after processing several configurations in order to build different sets of
 * bundles for differential serving.
 */
async function augmentIndexHtml(params) {
    const { loadOutputFile, files, entrypoints, sri, deployUrl = '', lang, baseHref, html } = params;
    const warnings = [];
    const errors = [];
    let { crossOrigin = 'none' } = params;
    if (sri && crossOrigin === 'none') {
        crossOrigin = 'anonymous';
    }
    const stylesheets = new Set();
    const scripts = new Map();
    // Sort files in the order we want to insert them by entrypoint
    for (const [entrypoint, isModule] of entrypoints) {
        for (const { extension, file, name } of files) {
            if (name !== entrypoint || scripts.has(file) || stylesheets.has(file)) {
                continue;
            }
            switch (extension) {
                case '.js':
                    // Also, non entrypoints need to be loaded as no module as they can contain problematic code.
                    scripts.set(file, isModule);
                    break;
                case '.css':
                    stylesheets.add(file);
                    break;
            }
        }
    }
    let scriptTags = [];
    for (const [src, isModule] of scripts) {
        const attrs = [`src="${deployUrl}${src}"`];
        // This is also need for non entry-points as they may contain problematic code.
        if (isModule) {
            attrs.push('type="module"');
        }
        else {
            attrs.push('defer');
        }
        if (crossOrigin !== 'none') {
            attrs.push(`crossorigin="${crossOrigin}"`);
        }
        if (sri) {
            const content = await loadOutputFile(src);
            attrs.push(generateSriAttributes(content));
        }
        scriptTags.push(`<script ${attrs.join(' ')}></script>`);
    }
    let linkTags = [];
    for (const src of stylesheets) {
        const attrs = [`rel="stylesheet"`, `href="${deployUrl}${src}"`];
        if (crossOrigin !== 'none') {
            attrs.push(`crossorigin="${crossOrigin}"`);
        }
        if (sri) {
            const content = await loadOutputFile(src);
            attrs.push(generateSriAttributes(content));
        }
        linkTags.push(`<link ${attrs.join(' ')}>`);
    }
    const dir = lang ? await getLanguageDirection(lang, warnings) : undefined;
    const { rewriter, transformedContent } = await (0, html_rewriting_stream_1.htmlRewritingStream)(html);
    const baseTagExists = html.includes('<base');
    rewriter
        .on('startTag', (tag) => {
        switch (tag.tagName) {
            case 'html':
                // Adjust document locale if specified
                if (isString(lang)) {
                    updateAttribute(tag, 'lang', lang);
                }
                if (dir) {
                    updateAttribute(tag, 'dir', dir);
                }
                break;
            case 'head':
                // Base href should be added before any link, meta tags
                if (!baseTagExists && isString(baseHref)) {
                    rewriter.emitStartTag(tag);
                    rewriter.emitRaw(`<base href="${baseHref}">`);
                    return;
                }
                break;
            case 'base':
                // Adjust base href if specified
                if (isString(baseHref)) {
                    updateAttribute(tag, 'href', baseHref);
                }
                break;
        }
        rewriter.emitStartTag(tag);
    })
        .on('endTag', (tag) => {
        switch (tag.tagName) {
            case 'head':
                for (const linkTag of linkTags) {
                    rewriter.emitRaw(linkTag);
                }
                linkTags = [];
                break;
            case 'body':
                // Add script tags
                for (const scriptTag of scriptTags) {
                    rewriter.emitRaw(scriptTag);
                }
                scriptTags = [];
                break;
        }
        rewriter.emitEndTag(tag);
    });
    const content = await transformedContent;
    return {
        content: linkTags.length || scriptTags.length
            ? // In case no body/head tags are not present (dotnet partial templates)
                linkTags.join('') + scriptTags.join('') + content
            : content,
        warnings,
        errors,
    };
}
exports.augmentIndexHtml = augmentIndexHtml;
function generateSriAttributes(content) {
    const algo = 'sha384';
    const hash = (0, crypto_1.createHash)(algo).update(content, 'utf8').digest('base64');
    return `integrity="${algo}-${hash}"`;
}
function updateAttribute(tag, name, value) {
    const index = tag.attrs.findIndex((a) => a.name === name);
    const newValue = { name, value };
    if (index === -1) {
        tag.attrs.push(newValue);
    }
    else {
        tag.attrs[index] = newValue;
    }
}
function isString(value) {
    return typeof value === 'string';
}
async function getLanguageDirection(locale, warnings) {
    const dir = await getLanguageDirectionFromLocales(locale);
    if (!dir) {
        warnings.push(`Locale data for '${locale}' cannot be found. 'dir' attribute will not be set for this locale.`);
    }
    return dir;
}
async function getLanguageDirectionFromLocales(locale) {
    try {
        const localeData = (await (0, load_esm_1.loadEsmModule)(`@angular/common/locales/${locale}`)).default;
        const dir = localeData[localeData.length - 2];
        return isString(dir) ? dir : undefined;
    }
    catch (_a) {
        // In some cases certain locales might map to files which are named only with language id.
        // Example: `en-US` -> `en`.
        const [languageId] = locale.split('-', 1);
        if (languageId !== locale) {
            return getLanguageDirectionFromLocales(languageId);
        }
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVnbWVudC1pbmRleC1odG1sLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvaW5kZXgtZmlsZS9hdWdtZW50LWluZGV4LWh0bWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsbUNBQW9DO0FBQ3BDLDBDQUE0QztBQUM1QyxtRUFBOEQ7QUFxQzlEOzs7OztHQUtHO0FBQ0ksS0FBSyxVQUFVLGdCQUFnQixDQUNwQyxNQUErQjtJQUUvQixNQUFNLEVBQUUsY0FBYyxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLFNBQVMsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsR0FBRyxNQUFNLENBQUM7SUFFakcsTUFBTSxRQUFRLEdBQWEsRUFBRSxDQUFDO0lBQzlCLE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztJQUU1QixJQUFJLEVBQUUsV0FBVyxHQUFHLE1BQU0sRUFBRSxHQUFHLE1BQU0sQ0FBQztJQUN0QyxJQUFJLEdBQUcsSUFBSSxXQUFXLEtBQUssTUFBTSxFQUFFO1FBQ2pDLFdBQVcsR0FBRyxXQUFXLENBQUM7S0FDM0I7SUFFRCxNQUFNLFdBQVcsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO0lBQ3RDLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxFQUFvRCxDQUFDO0lBRTVFLCtEQUErRDtJQUMvRCxLQUFLLE1BQU0sQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLElBQUksV0FBVyxFQUFFO1FBQ2hELEtBQUssTUFBTSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksS0FBSyxFQUFFO1lBQzdDLElBQUksSUFBSSxLQUFLLFVBQVUsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJ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SyxVQUFVLG9CQUFvQixDQUNqQyxNQUFjLEVBQ2QsUUFBa0I7SUFFbEIsTUFBTSxHQUFHLEdBQUcsTUFBTSwrQkFBK0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUUxRCxJQUFJLENBQUMsR0FBRyxFQUFFO1FBQ1IsUUFBUSxDQUFDLElBQUksQ0FDWCxvQkFBb0IsTUFBTSxxRUFBcUUsQ0FDaEcsQ0FBQztLQUNIO0lBRUQsT0FBTyxHQUFHLENBQUM7QUFDYixDQUFDO0FBRUQsS0FBSyxVQUFVLCtCQUErQixDQUFDLE1BQWM7SUFDM0QsSUFBSTtRQUNGLE1BQU0sVUFBVSxHQUFHLENBQ2pCLE1BQU0sSUFBQSx3QkFBYSxFQUNqQiwyQkFBMkIsTUFBTSxFQUFFLENBQ3BDLENBQ0YsQ0FBQyxPQUFPLENBQUM7UUFFVixNQUFNLEdBQUcsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztRQUU5QyxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7S0FDeEM7SUFBQyxXQUFNO1FBQ04sMEZBQTBGO1FBQzFGLDRCQUE0QjtRQUM1QixNQUFNLENBQUMsVUFBVSxDQUFDLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsSUFBSSxVQUFVLEtBQUssTUFBTSxFQUFFO1lBQ3pCLE9BQU8sK0JBQStCLENBQUMsVUFBVSxDQUFDLENBQUM7U0FDcEQ7S0FDRjtJQUVELE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vbG9hZC1lc20nO1xuaW1wb3J0IHsgaHRtbFJld3JpdGluZ1N0cmVhbSB9IGZyb20gJy4vaHRtbC1yZXdyaXRpbmctc3RyZWFtJztcblxuZXhwb3J0IHR5cGUgTG9hZE91dHB1dEZpbGVGdW5jdGlvblR5cGUgPSAoZmlsZTogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZz47XG5cbmV4cG9ydCB0eXBlIENyb3NzT3JpZ2luVmFsdWUgPSAnbm9uZScgfCAnYW5vbnltb3VzJyB8ICd1c2UtY3JlZGVudGlhbHMnO1xuXG5leHBvcnQgdHlwZSBFbnRyeXBvaW50ID0gW25hbWU6IHN0cmluZywgaXNNb2R1bGU6IGJvb2xlYW5dO1xuXG5leHBvcnQgaW50ZXJmYWNlIEF1Z21lbnRJbmRleEh0bWxPcHRpb25zIHtcbiAgLyogSW5wdXQgY29udGVudHMgKi9cbiAgaHRtbDogc3RyaW5nO1xuICBiYXNlSHJlZj86IHN0cmluZztcbiAgZGVwbG95VXJsPzogc3RyaW5nO1xuICBzcmk6IGJvb2xlYW47XG4gIC8qKiBjcm9zc29yaWdpbiBhdHRyaWJ1dGUgc2V0dGluZyBvZiBlbGVtZW50cyB0aGF0IHByb3ZpZGUgQ09SUyBzdXBwb3J0ICovXG4gIGNyb3NzT3JpZ2luPzogQ3Jvc3NPcmlnaW5WYWx1ZTtcbiAgLypcbiAgICogRmlsZXMgZW1pdHRlZCBieSB0aGUgYnVpbGQuXG4gICAqL1xuICBmaWxlczogRmlsZUluZm9bXTtcbiAgLypcbiAgICogRnVuY3Rpb24gdGhhdCBsb2FkcyBhIGZpbGUgdXNlZC5cbiAgICogVGhpcyBhbGxvd3MgdXMgdG8gdXNlIGRpZmZlcmVudCByb3V0aW5lcyB3aXRoaW4gdGhlIEluZGV4SHRtbFdlYnBhY2tQbHVnaW4gYW5kXG4gICAqIHdoZW4gdXNlZCB3aXRob3V0IHRoaXMgcGx1Z2luLlxuICAgKi9cbiAgbG9hZE91dHB1dEZpbGU6IExvYWRPdXRwdXRGaWxlRnVuY3Rpb25UeXBlO1xuICAvKiogVXNlZCB0byBzb3J0IHRoZSBpbnNlcmF0aW9uIG9mIGZpbGVzIGluIHRoZSBIVE1MIGZpbGUgKi9cbiAgZW50cnlwb2ludHM6IEVudHJ5cG9pbnRbXTtcbiAgLyoqIFVzZWQgdG8gc2V0IHRoZSBkb2N1bWVudCBkZWZhdWx0IGxvY2FsZSAqL1xuICBsYW5nPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEZpbGVJbmZvIHtcbiAgZmlsZTogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGV4dGVuc2lvbjogc3RyaW5nO1xufVxuLypcbiAqIEhlbHBlciBmdW5jdGlvbiB1c2VkIGJ5IHRoZSBJbmRleEh0bWxXZWJwYWNrUGx1Z2luLlxuICogQ2FuIGFsc28gYmUgZGlyZWN0bHkgdXNlZCBieSBidWlsZGVyLCBlLiBnLiBpbiBvcmRlciB0byBnZW5lcmF0ZSBhbiBpbmRleC5odG1sXG4gKiBhZnRlciBwcm9jZXNzaW5nIHNldmVyYWwgY29uZmlndXJhdGlvbnMgaW4gb3JkZXIgdG8gYnVpbGQgZGlmZmVyZW50IHNldHMgb2ZcbiAqIGJ1bmRsZXMgZm9yIGRpZmZlcmVudGlhbCBzZXJ2aW5nLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXVnbWVudEluZGV4SHRtbChcbiAgcGFyYW1zOiBBdWdtZW50SW5kZXhIdG1sT3B0aW9ucyxcbik6IFByb21pc2U8eyBjb250ZW50OiBzdHJpbmc7IHdhcm5pbmdzOiBzdHJpbmdbXTsgZXJyb3JzOiBzdHJpbmdbXSB9PiB7XG4gIGNvbnN0IHsgbG9hZE91dHB1dEZpbGUsIGZpbGVzLCBlbnRyeXBvaW50cywgc3JpLCBkZXBsb3lVcmwgPSAnJywgbGFuZywgYmFzZUhyZWYsIGh0bWwgfSA9IHBhcmFtcztcblxuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGxldCB7IGNyb3NzT3JpZ2luID0gJ25vbmUnIH0gPSBwYXJhbXM7XG4gIGlmIChzcmkgJiYgY3Jvc3NPcmlnaW4gPT09ICdub25lJykge1xuICAgIGNyb3NzT3JpZ2luID0gJ2Fub255bW91cyc7XG4gIH1cblxuICBjb25zdCBzdHlsZXNoZWV0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBzY3JpcHRzID0gbmV3IE1hcDwvKiogZmlsZSBuYW1lICovIHN0cmluZywgLyoqIGlzTW9kdWxlICovIGJvb2xlYW4+KCk7XG5cbiAgLy8gU29ydCBmaWxlcyBpbiB0aGUgb3JkZXIgd2Ugd2FudCB0byBpbnNlcnQgdGhlbSBieSBlbnRyeXBvaW50XG4gIGZvciAoY29uc3QgW2VudHJ5cG9pbnQsIGlzTW9kdWxlXSBvZiBlbnRyeXBvaW50cykge1xuICAgIGZvciAoY29uc3QgeyBleHRlbnNpb24sIGZpbGUsIG5hbWUgfSBvZiBmaWxlcykge1xuICAgICAgaWYgKG5hbWUgIT09IGVudHJ5cG9pbnQgfHwgc2NyaXB0cy5oYXMoZmlsZSkgfHwgc3R5bGVzaGVldHMuaGFzKGZpbGUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBzd2l0Y2ggKGV4dGVuc2lvbikge1xuICAgICAgICBjYXNlICcuanMnOlxuICAgICAgICAgIC8vIEFsc28sIG5vbiBlbnRyeXBvaW50cyBuZWVkIHRvIGJlIGxvYWRlZCBhcyBubyBtb2R1bGUgYXMgdGhleSBjYW4gY29udGFpbiBwcm9ibGVtYXRpYyBjb2RlLlxuICAgICAgICAgIHNjcmlwdHMuc2V0KGZpbGUsIGlzTW9kdWxlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnLmNzcyc6XG4gICAgICAgICAgc3R5bGVzaGVldHMuYWRkKGZpbGUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGxldCBzY3JpcHRUYWdzOiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IFtzcmMsIGlzTW9kdWxlXSBvZiBzY3JpcHRzKSB7XG4gICAgY29uc3QgYXR0cnMgPSBbYHNyYz1cIiR7ZGVwbG95VXJsfSR7c3JjfVwiYF07XG5cbiAgICAvLyBUaGlzIGlzIGFsc28gbmVlZCBmb3Igbm9uIGVudHJ5LXBvaW50cyBhcyB0aGV5IG1heSBjb250YWluIHByb2JsZW1hdGljIGNvZGUuXG4gICAgaWYgKGlzTW9kdWxlKSB7XG4gICAgICBhdHRycy5wdXNoKCd0eXBlPVwibW9kdWxlXCInKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXR0cnMucHVzaCgnZGVmZXInKTtcbiAgICB9XG5cbiAgICBpZiAoY3Jvc3NPcmlnaW4gIT09ICdub25lJykge1xuICAgICAgYXR0cnMucHVzaChgY3Jvc3NvcmlnaW49XCIke2Nyb3NzT3JpZ2lufVwiYCk7XG4gICAgfVxuXG4gICAgaWYgKHNyaSkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGxvYWRPdXRwdXRGaWxlKHNyYyk7XG4gICAgICBhdHRycy5wdXNoKGdlbmVyYXRlU3JpQXR0cmlidXRlcyhjb250ZW50KSk7XG4gICAgfVxuXG4gICAgc2NyaXB0VGFncy5wdXNoKGA8c2NyaXB0ICR7YXR0cnMuam9pbignICcpfT48L3NjcmlwdD5gKTtcbiAgfVxuXG4gIGxldCBsaW5rVGFnczogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBzcmMgb2Ygc3R5bGVzaGVldHMpIHtcbiAgICBjb25zdCBhdHRycyA9IFtgcmVsPVwic3R5bGVzaGVldFwiYCwgYGhyZWY9XCIke2RlcGxveVVybH0ke3NyY31cImBdO1xuXG4gICAgaWYgKGNyb3NzT3JpZ2luICE9PSAnbm9uZScpIHtcbiAgICAgIGF0dHJzLnB1c2goYGNyb3Nzb3JpZ2luPVwiJHtjcm9zc09yaWdpbn1cImApO1xuICAgIH1cblxuICAgIGlmIChzcmkpIHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBsb2FkT3V0cHV0RmlsZShzcmMpO1xuICAgICAgYXR0cnMucHVzaChnZW5lcmF0ZVNyaUF0dHJpYnV0ZXMoY29udGVudCkpO1xuICAgIH1cblxuICAgIGxpbmtUYWdzLnB1c2goYDxsaW5rICR7YXR0cnMuam9pbignICcpfT5gKTtcbiAgfVxuXG4gIGNvbnN0IGRpciA9IGxhbmcgPyBhd2FpdCBnZXRMYW5ndWFnZURpcmVjdGlvbihsYW5nLCB3YXJuaW5ncykgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IHsgcmV3cml0ZXIsIHRyYW5zZm9ybWVkQ29udGVudCB9ID0gYXdhaXQgaHRtbFJld3JpdGluZ1N0cmVhbShodG1sKTtcbiAgY29uc3QgYmFzZVRhZ0V4aXN0cyA9IGh0bWwuaW5jbHVkZXMoJzxiYXNlJyk7XG5cbiAgcmV3cml0ZXJcbiAgICAub24oJ3N0YXJ0VGFnJywgKHRhZykgPT4ge1xuICAgICAgc3dpdGNoICh0YWcudGFnTmFtZSkge1xuICAgICAgICBjYXNlICdodG1sJzpcbiAgICAgICAgICAvLyBBZGp1c3QgZG9jdW1lbnQgbG9jYWxlIGlmIHNwZWNpZmllZFxuICAgICAgICAgIGlmIChpc1N0cmluZyhsYW5nKSkge1xuICAgICAgICAgICAgdXBkYXRlQXR0cmlidXRlKHRhZywgJ2xhbmcnLCBsYW5nKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoZGlyKSB7XG4gICAgICAgICAgICB1cGRhdGVBdHRyaWJ1dGUodGFnLCAnZGlyJywgZGlyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2hlYWQnOlxuICAgICAgICAgIC8vIEJhc2UgaHJlZiBzaG91bGQgYmUgYWRkZWQgYmVmb3JlIGFueSBsaW5rLCBtZXRhIHRhZ3NcbiAgICAgICAgICBpZiAoIWJhc2VUYWdFeGlzdHMgJiYgaXNTdHJpbmcoYmFzZUhyZWYpKSB7XG4gICAgICAgICAgICByZXdyaXRlci5lbWl0U3RhcnRUYWcodGFnKTtcbiAgICAgICAgICAgIHJld3JpdGVyLmVtaXRSYXcoYDxiYXNlIGhyZWY9XCIke2Jhc2VIcmVmfVwiPmApO1xuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdiYXNlJzpcbiAgICAgICAgICAvLyBBZGp1c3QgYmFzZSBocmVmIGlmIHNwZWNpZmllZFxuICAgICAgICAgIGlmIChpc1N0cmluZyhiYXNlSHJlZikpIHtcbiAgICAgICAgICAgIHVwZGF0ZUF0dHJpYnV0ZSh0YWcsICdocmVmJywgYmFzZUhyZWYpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgcmV3cml0ZXIuZW1pdFN0YXJ0VGFnKHRhZyk7XG4gICAgfSlcbiAgICAub24oJ2VuZFRhZycsICh0YWcpID0+IHtcbiAgICAgIHN3aXRjaCAodGFnLnRhZ05hbWUpIHtcbiAgICAgICAgY2FzZSAnaGVhZCc6XG4gICAgICAgICAgZm9yIChjb25zdCBsaW5rVGFnIG9mIGxpbmtUYWdzKSB7XG4gICAgICAgICAgICByZXdyaXRlci5lbWl0UmF3KGxpbmtUYWcpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxpbmtUYWdzID0gW107XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2JvZHknOlxuICAgICAgICAgIC8vIEFkZCBzY3JpcHQgdGFnc1xuICAgICAgICAgIGZvciAoY29uc3Qgc2NyaXB0VGFnIG9mIHNjcmlwdFRhZ3MpIHtcbiAgICAgICAgICAgIHJld3JpdGVyLmVtaXRSYXcoc2NyaXB0VGFnKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzY3JpcHRUYWdzID0gW107XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIHJld3JpdGVyLmVtaXRFbmRUYWcodGFnKTtcbiAgICB9KTtcblxuICBjb25zdCBjb250ZW50ID0gYXdhaXQgdHJhbnNmb3JtZWRDb250ZW50O1xuXG4gIHJldHVybiB7XG4gICAgY29udGVudDpcbiAgICAgIGxpbmtUYWdzLmxlbmd0aCB8fCBzY3JpcHRUYWdzLmxlbmd0aFxuICAgICAgICA/IC8vIEluIGNhc2Ugbm8gYm9keS9oZWFkIHRhZ3MgYXJlIG5vdCBwcmVzZW50IChkb3RuZXQgcGFydGlhbCB0ZW1wbGF0ZXMpXG4gICAgICAgICAgbGlua1RhZ3Muam9pbignJykgKyBzY3JpcHRUYWdzLmpvaW4oJycpICsgY29udGVudFxuICAgICAgICA6IGNvbnRlbnQsXG4gICAgd2FybmluZ3MsXG4gICAgZXJyb3JzLFxuICB9O1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZVNyaUF0dHJpYnV0ZXMoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgYWxnbyA9ICdzaGEzODQnO1xuICBjb25zdCBoYXNoID0gY3JlYXRlSGFzaChhbGdvKS51cGRhdGUoY29udGVudCwgJ3V0ZjgnKS5kaWdlc3QoJ2Jhc2U2NCcpO1xuXG4gIHJldHVybiBgaW50ZWdyaXR5PVwiJHthbGdvfS0ke2hhc2h9XCJgO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVBdHRyaWJ1dGUoXG4gIHRhZzogeyBhdHRyczogeyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfVtdIH0sXG4gIG5hbWU6IHN0cmluZyxcbiAgdmFsdWU6IHN0cmluZyxcbik6IHZvaWQge1xuICBjb25zdCBpbmRleCA9IHRhZy5hdHRycy5maW5kSW5kZXgoKGEpID0+IGEubmFtZSA9PT0gbmFtZSk7XG4gIGNvbnN0IG5ld1ZhbHVlID0geyBuYW1lLCB2YWx1ZSB9O1xuXG4gIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICB0YWcuYXR0cnMucHVzaChuZXdWYWx1ZSk7XG4gIH0gZWxzZSB7XG4gICAgdGFnLmF0dHJzW2luZGV4XSA9IG5ld1ZhbHVlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzU3RyaW5nKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgc3RyaW5nIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZyc7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldExhbmd1YWdlRGlyZWN0aW9uKFxuICBsb2NhbGU6IHN0cmluZyxcbiAgd2FybmluZ3M6IHN0cmluZ1tdLFxuKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgY29uc3QgZGlyID0gYXdhaXQgZ2V0TGFuZ3VhZ2VEaXJlY3Rpb25Gcm9tTG9jYWxlcyhsb2NhbGUpO1xuXG4gIGlmICghZGlyKSB7XG4gICAgd2FybmluZ3MucHVzaChcbiAgICAgIGBMb2NhbGUgZGF0YSBmb3IgJyR7bG9jYWxlfScgY2Fubm90IGJlIGZvdW5kLiAnZGlyJyBhdHRyaWJ1dGUgd2lsbCBub3QgYmUgc2V0IGZvciB0aGlzIGxvY2FsZS5gLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gZGlyO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRMYW5ndWFnZURpcmVjdGlvbkZyb21Mb2NhbGVzKGxvY2FsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBsb2NhbGVEYXRhID0gKFxuICAgICAgYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21tb24vbG9jYWxlcy9lbicpPihcbiAgICAgICAgYEBhbmd1bGFyL2NvbW1vbi9sb2NhbGVzLyR7bG9jYWxlfWAsXG4gICAgICApXG4gICAgKS5kZWZhdWx0O1xuXG4gICAgY29uc3QgZGlyID0gbG9jYWxlRGF0YVtsb2NhbGVEYXRhLmxlbmd0aCAtIDJdO1xuXG4gICAgcmV0dXJuIGlzU3RyaW5nKGRpcikgPyBkaXIgOiB1bmRlZmluZWQ7XG4gIH0gY2F0Y2gge1xuICAgIC8vIEluIHNvbWUgY2FzZXMgY2VydGFpbiBsb2NhbGVzIG1pZ2h0IG1hcCB0byBmaWxlcyB3aGljaCBhcmUgbmFtZWQgb25seSB3aXRoIGxhbmd1YWdlIGlkLlxuICAgIC8vIEV4YW1wbGU6IGBlbi1VU2AgLT4gYGVuYC5cbiAgICBjb25zdCBbbGFuZ3VhZ2VJZF0gPSBsb2NhbGUuc3BsaXQoJy0nLCAxKTtcbiAgICBpZiAobGFuZ3VhZ2VJZCAhPT0gbG9jYWxlKSB7XG4gICAgICByZXR1cm4gZ2V0TGFuZ3VhZ2VEaXJlY3Rpb25Gcm9tTG9jYWxlcyhsYW5ndWFnZUlkKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuIl19