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
const node_crypto_1 = require("node:crypto");
const node_path_1 = require("node:path");
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
                case '.mjs':
                    if (!isModule) {
                        // It would be very confusing to link an `*.mjs` file in a non-module script context,
                        // so we disallow it entirely.
                        throw new Error('`.mjs` files *must* set `isModule` to `true`.');
                    }
                    scripts.set(file, true /* isModule */);
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
    if (params.hints?.length) {
        for (const hint of params.hints) {
            const attrs = [`rel="${hint.mode}"`, `href="${deployUrl}${hint.url}"`];
            if (hint.mode !== 'modulepreload' && crossOrigin !== 'none') {
                // Value is considered anonymous by the browser when not present or empty
                attrs.push(crossOrigin === 'anonymous' ? 'crossorigin' : `crossorigin="${crossOrigin}"`);
            }
            if (hint.mode === 'preload' || hint.mode === 'prefetch') {
                switch ((0, node_path_1.extname)(hint.url)) {
                    case '.js':
                        attrs.push('as="script"');
                        break;
                    case '.css':
                        attrs.push('as="style"');
                        break;
                }
            }
            if (sri &&
                (hint.mode === 'preload' || hint.mode === 'prefetch' || hint.mode === 'modulepreload')) {
                const content = await loadOutputFile(hint.url);
                attrs.push(generateSriAttributes(content));
            }
            linkTags.push(`<link ${attrs.join(' ')}>`);
        }
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
    const content = await transformedContent();
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
    const hash = (0, node_crypto_1.createHash)(algo).update(content, 'utf8').digest('base64');
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
    catch {
        // In some cases certain locales might map to files which are named only with language id.
        // Example: `en-US` -> `en`.
        const [languageId] = locale.split('-', 1);
        if (languageId !== locale) {
            return getLanguageDirectionFromLocales(languageId);
        }
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVnbWVudC1pbmRleC1odG1sLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvaW5kZXgtZmlsZS9hdWdtZW50LWluZGV4LWh0bWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsNkNBQXlDO0FBQ3pDLHlDQUFvQztBQUNwQywwQ0FBNEM7QUFDNUMsbUVBQThEO0FBc0M5RDs7Ozs7R0FLRztBQUNJLEtBQUssVUFBVSxnQkFBZ0IsQ0FDcEMsTUFBK0I7SUFFL0IsTUFBTSxFQUFFLGNBQWMsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLEdBQUcsRUFBRSxTQUFTLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLEdBQUcsTUFBTSxDQUFDO0lBRWpHLE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztJQUM5QixNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFFNUIsSUFBSSxFQUFFLFdBQVcsR0FBRyxNQUFNLEVBQUUsR0FBRyxNQUFNLENBQUM7SUFDdEMsSUFBSSxHQUFHLElBQUksV0FBVyxLQUFLLE1BQU0sRUFBRTtRQUNqQyxXQUFXLEdBQUcsV0FBVyxDQUFDO0tBQzNCO0lBRUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztJQUN0QyxNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBb0QsQ0FBQztJQUU1RSwrREFBK0Q7SUFDL0QsS0FBSyxNQUFNLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxJQUFJLFdBQVcsRUFBRTtRQUNoRCxLQUFLLE1BQU0sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEtBQUssRUFBRTtZQUM3QyxJQUFJLElBQUksS0FBSyxVQUFVLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxJ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QVUsS0FBSyxNQUFNLEVBQUU7WUFDekIsT0FBTywrQkFBK0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUNwRDtLQUNGO0lBRUQsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnbm9kZTpjcnlwdG8nO1xuaW1wb3J0IHsgZXh0bmFtZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vbG9hZC1lc20nO1xuaW1wb3J0IHsgaHRtbFJld3JpdGluZ1N0cmVhbSB9IGZyb20gJy4vaHRtbC1yZXdyaXRpbmctc3RyZWFtJztcblxuZXhwb3J0IHR5cGUgTG9hZE91dHB1dEZpbGVGdW5jdGlvblR5cGUgPSAoZmlsZTogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZz47XG5cbmV4cG9ydCB0eXBlIENyb3NzT3JpZ2luVmFsdWUgPSAnbm9uZScgfCAnYW5vbnltb3VzJyB8ICd1c2UtY3JlZGVudGlhbHMnO1xuXG5leHBvcnQgdHlwZSBFbnRyeXBvaW50ID0gW25hbWU6IHN0cmluZywgaXNNb2R1bGU6IGJvb2xlYW5dO1xuXG5leHBvcnQgaW50ZXJmYWNlIEF1Z21lbnRJbmRleEh0bWxPcHRpb25zIHtcbiAgLyogSW5wdXQgY29udGVudHMgKi9cbiAgaHRtbDogc3RyaW5nO1xuICBiYXNlSHJlZj86IHN0cmluZztcbiAgZGVwbG95VXJsPzogc3RyaW5nO1xuICBzcmk6IGJvb2xlYW47XG4gIC8qKiBjcm9zc29yaWdpbiBhdHRyaWJ1dGUgc2V0dGluZyBvZiBlbGVtZW50cyB0aGF0IHByb3ZpZGUgQ09SUyBzdXBwb3J0ICovXG4gIGNyb3NzT3JpZ2luPzogQ3Jvc3NPcmlnaW5WYWx1ZTtcbiAgLypcbiAgICogRmlsZXMgZW1pdHRlZCBieSB0aGUgYnVpbGQuXG4gICAqL1xuICBmaWxlczogRmlsZUluZm9bXTtcbiAgLypcbiAgICogRnVuY3Rpb24gdGhhdCBsb2FkcyBhIGZpbGUgdXNlZC5cbiAgICogVGhpcyBhbGxvd3MgdXMgdG8gdXNlIGRpZmZlcmVudCByb3V0aW5lcyB3aXRoaW4gdGhlIEluZGV4SHRtbFdlYnBhY2tQbHVnaW4gYW5kXG4gICAqIHdoZW4gdXNlZCB3aXRob3V0IHRoaXMgcGx1Z2luLlxuICAgKi9cbiAgbG9hZE91dHB1dEZpbGU6IExvYWRPdXRwdXRGaWxlRnVuY3Rpb25UeXBlO1xuICAvKiogVXNlZCB0byBzb3J0IHRoZSBpbnNlcmF0aW9uIG9mIGZpbGVzIGluIHRoZSBIVE1MIGZpbGUgKi9cbiAgZW50cnlwb2ludHM6IEVudHJ5cG9pbnRbXTtcbiAgLyoqIFVzZWQgdG8gc2V0IHRoZSBkb2N1bWVudCBkZWZhdWx0IGxvY2FsZSAqL1xuICBsYW5nPzogc3RyaW5nO1xuICBoaW50cz86IHsgdXJsOiBzdHJpbmc7IG1vZGU6IHN0cmluZyB9W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmlsZUluZm8ge1xuICBmaWxlOiBzdHJpbmc7XG4gIG5hbWU/OiBzdHJpbmc7XG4gIGV4dGVuc2lvbjogc3RyaW5nO1xufVxuLypcbiAqIEhlbHBlciBmdW5jdGlvbiB1c2VkIGJ5IHRoZSBJbmRleEh0bWxXZWJwYWNrUGx1Z2luLlxuICogQ2FuIGFsc28gYmUgZGlyZWN0bHkgdXNlZCBieSBidWlsZGVyLCBlLiBnLiBpbiBvcmRlciB0byBnZW5lcmF0ZSBhbiBpbmRleC5odG1sXG4gKiBhZnRlciBwcm9jZXNzaW5nIHNldmVyYWwgY29uZmlndXJhdGlvbnMgaW4gb3JkZXIgdG8gYnVpbGQgZGlmZmVyZW50IHNldHMgb2ZcbiAqIGJ1bmRsZXMgZm9yIGRpZmZlcmVudGlhbCBzZXJ2aW5nLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXVnbWVudEluZGV4SHRtbChcbiAgcGFyYW1zOiBBdWdtZW50SW5kZXhIdG1sT3B0aW9ucyxcbik6IFByb21pc2U8eyBjb250ZW50OiBzdHJpbmc7IHdhcm5pbmdzOiBzdHJpbmdbXTsgZXJyb3JzOiBzdHJpbmdbXSB9PiB7XG4gIGNvbnN0IHsgbG9hZE91dHB1dEZpbGUsIGZpbGVzLCBlbnRyeXBvaW50cywgc3JpLCBkZXBsb3lVcmwgPSAnJywgbGFuZywgYmFzZUhyZWYsIGh0bWwgfSA9IHBhcmFtcztcblxuICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGxldCB7IGNyb3NzT3JpZ2luID0gJ25vbmUnIH0gPSBwYXJhbXM7XG4gIGlmIChzcmkgJiYgY3Jvc3NPcmlnaW4gPT09ICdub25lJykge1xuICAgIGNyb3NzT3JpZ2luID0gJ2Fub255bW91cyc7XG4gIH1cblxuICBjb25zdCBzdHlsZXNoZWV0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBzY3JpcHRzID0gbmV3IE1hcDwvKiogZmlsZSBuYW1lICovIHN0cmluZywgLyoqIGlzTW9kdWxlICovIGJvb2xlYW4+KCk7XG5cbiAgLy8gU29ydCBmaWxlcyBpbiB0aGUgb3JkZXIgd2Ugd2FudCB0byBpbnNlcnQgdGhlbSBieSBlbnRyeXBvaW50XG4gIGZvciAoY29uc3QgW2VudHJ5cG9pbnQsIGlzTW9kdWxlXSBvZiBlbnRyeXBvaW50cykge1xuICAgIGZvciAoY29uc3QgeyBleHRlbnNpb24sIGZpbGUsIG5hbWUgfSBvZiBmaWxlcykge1xuICAgICAgaWYgKG5hbWUgIT09IGVudHJ5cG9pbnQgfHwgc2NyaXB0cy5oYXMoZmlsZSkgfHwgc3R5bGVzaGVldHMuaGFzKGZpbGUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBzd2l0Y2ggKGV4dGVuc2lvbikge1xuICAgICAgICBjYXNlICcuanMnOlxuICAgICAgICAgIC8vIEFsc28sIG5vbiBlbnRyeXBvaW50cyBuZWVkIHRvIGJlIGxvYWRlZCBhcyBubyBtb2R1bGUgYXMgdGhleSBjYW4gY29udGFpbiBwcm9ibGVtYXRpYyBjb2RlLlxuICAgICAgICAgIHNjcmlwdHMuc2V0KGZpbGUsIGlzTW9kdWxlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnLm1qcyc6XG4gICAgICAgICAgaWYgKCFpc01vZHVsZSkge1xuICAgICAgICAgICAgLy8gSXQgd291bGQgYmUgdmVyeSBjb25mdXNpbmcgdG8gbGluayBhbiBgKi5tanNgIGZpbGUgaW4gYSBub24tbW9kdWxlIHNjcmlwdCBjb250ZXh0LFxuICAgICAgICAgICAgLy8gc28gd2UgZGlzYWxsb3cgaXQgZW50aXJlbHkuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2AubWpzYCBmaWxlcyAqbXVzdCogc2V0IGBpc01vZHVsZWAgdG8gYHRydWVgLicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzY3JpcHRzLnNldChmaWxlLCB0cnVlIC8qIGlzTW9kdWxlICovKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnLmNzcyc6XG4gICAgICAgICAgc3R5bGVzaGVldHMuYWRkKGZpbGUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGxldCBzY3JpcHRUYWdzOiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IFtzcmMsIGlzTW9kdWxlXSBvZiBzY3JpcHRzKSB7XG4gICAgY29uc3QgYXR0cnMgPSBbYHNyYz1cIiR7ZGVwbG95VXJsfSR7c3JjfVwiYF07XG5cbiAgICAvLyBUaGlzIGlzIGFsc28gbmVlZCBmb3Igbm9uIGVudHJ5LXBvaW50cyBhcyB0aGV5IG1heSBjb250YWluIHByb2JsZW1hdGljIGNvZGUuXG4gICAgaWYgKGlzTW9kdWxlKSB7XG4gICAgICBhdHRycy5wdXNoKCd0eXBlPVwibW9kdWxlXCInKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXR0cnMucHVzaCgnZGVmZXInKTtcbiAgICB9XG5cbiAgICBpZiAoY3Jvc3NPcmlnaW4gIT09ICdub25lJykge1xuICAgICAgYXR0cnMucHVzaChgY3Jvc3NvcmlnaW49XCIke2Nyb3NzT3JpZ2lufVwiYCk7XG4gICAgfVxuXG4gICAgaWYgKHNyaSkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGxvYWRPdXRwdXRGaWxlKHNyYyk7XG4gICAgICBhdHRycy5wdXNoKGdlbmVyYXRlU3JpQXR0cmlidXRlcyhjb250ZW50KSk7XG4gICAgfVxuXG4gICAgc2NyaXB0VGFncy5wdXNoKGA8c2NyaXB0ICR7YXR0cnMuam9pbignICcpfT48L3NjcmlwdD5gKTtcbiAgfVxuXG4gIGxldCBsaW5rVGFnczogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBzcmMgb2Ygc3R5bGVzaGVldHMpIHtcbiAgICBjb25zdCBhdHRycyA9IFtgcmVsPVwic3R5bGVzaGVldFwiYCwgYGhyZWY9XCIke2RlcGxveVVybH0ke3NyY31cImBdO1xuXG4gICAgaWYgKGNyb3NzT3JpZ2luICE9PSAnbm9uZScpIHtcbiAgICAgIGF0dHJzLnB1c2goYGNyb3Nzb3JpZ2luPVwiJHtjcm9zc09yaWdpbn1cImApO1xuICAgIH1cblxuICAgIGlmIChzcmkpIHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBsb2FkT3V0cHV0RmlsZShzcmMpO1xuICAgICAgYXR0cnMucHVzaChnZW5lcmF0ZVNyaUF0dHJpYnV0ZXMoY29udGVudCkpO1xuICAgIH1cblxuICAgIGxpbmtUYWdzLnB1c2goYDxsaW5rICR7YXR0cnMuam9pbignICcpfT5gKTtcbiAgfVxuXG4gIGlmIChwYXJhbXMuaGludHM/Lmxlbmd0aCkge1xuICAgIGZvciAoY29uc3QgaGludCBvZiBwYXJhbXMuaGludHMpIHtcbiAgICAgIGNvbnN0IGF0dHJzID0gW2ByZWw9XCIke2hpbnQubW9kZX1cImAsIGBocmVmPVwiJHtkZXBsb3lVcmx9JHtoaW50LnVybH1cImBdO1xuXG4gICAgICBpZiAoaGludC5tb2RlICE9PSAnbW9kdWxlcHJlbG9hZCcgJiYgY3Jvc3NPcmlnaW4gIT09ICdub25lJykge1xuICAgICAgICAvLyBWYWx1ZSBpcyBjb25zaWRlcmVkIGFub255bW91cyBieSB0aGUgYnJvd3NlciB3aGVuIG5vdCBwcmVzZW50IG9yIGVtcHR5XG4gICAgICAgIGF0dHJzLnB1c2goY3Jvc3NPcmlnaW4gPT09ICdhbm9ueW1vdXMnID8gJ2Nyb3Nzb3JpZ2luJyA6IGBjcm9zc29yaWdpbj1cIiR7Y3Jvc3NPcmlnaW59XCJgKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGhpbnQubW9kZSA9PT0gJ3ByZWxvYWQnIHx8IGhpbnQubW9kZSA9PT0gJ3ByZWZldGNoJykge1xuICAgICAgICBzd2l0Y2ggKGV4dG5hbWUoaGludC51cmwpKSB7XG4gICAgICAgICAgY2FzZSAnLmpzJzpcbiAgICAgICAgICAgIGF0dHJzLnB1c2goJ2FzPVwic2NyaXB0XCInKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJy5jc3MnOlxuICAgICAgICAgICAgYXR0cnMucHVzaCgnYXM9XCJzdHlsZVwiJyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoXG4gICAgICAgIHNyaSAmJlxuICAgICAgICAoaGludC5tb2RlID09PSAncHJlbG9hZCcgfHwgaGludC5tb2RlID09PSAncHJlZmV0Y2gnIHx8IGhpbnQubW9kZSA9PT0gJ21vZHVsZXByZWxvYWQnKVxuICAgICAgKSB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBsb2FkT3V0cHV0RmlsZShoaW50LnVybCk7XG4gICAgICAgIGF0dHJzLnB1c2goZ2VuZXJhdGVTcmlBdHRyaWJ1dGVzKGNvbnRlbnQpKTtcbiAgICAgIH1cblxuICAgICAgbGlua1RhZ3MucHVzaChgPGxpbmsgJHthdHRycy5qb2luKCcgJyl9PmApO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGRpciA9IGxhbmcgPyBhd2FpdCBnZXRMYW5ndWFnZURpcmVjdGlvbihsYW5nLCB3YXJuaW5ncykgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IHsgcmV3cml0ZXIsIHRyYW5zZm9ybWVkQ29udGVudCB9ID0gYXdhaXQgaHRtbFJld3JpdGluZ1N0cmVhbShodG1sKTtcbiAgY29uc3QgYmFzZVRhZ0V4aXN0cyA9IGh0bWwuaW5jbHVkZXMoJzxiYXNlJyk7XG5cbiAgcmV3cml0ZXJcbiAgICAub24oJ3N0YXJ0VGFnJywgKHRhZykgPT4ge1xuICAgICAgc3dpdGNoICh0YWcudGFnTmFtZSkge1xuICAgICAgICBjYXNlICdodG1sJzpcbiAgICAgICAgICAvLyBBZGp1c3QgZG9jdW1lbnQgbG9jYWxlIGlmIHNwZWNpZmllZFxuICAgICAgICAgIGlmIChpc1N0cmluZyhsYW5nKSkge1xuICAgICAgICAgICAgdXBkYXRlQXR0cmlidXRlKHRhZywgJ2xhbmcnLCBsYW5nKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoZGlyKSB7XG4gICAgICAgICAgICB1cGRhdGVBdHRyaWJ1dGUodGFnLCAnZGlyJywgZGlyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2hlYWQnOlxuICAgICAgICAgIC8vIEJhc2UgaHJlZiBzaG91bGQgYmUgYWRkZWQgYmVmb3JlIGFueSBsaW5rLCBtZXRhIHRhZ3NcbiAgICAgICAgICBpZiAoIWJhc2VUYWdFeGlzdHMgJiYgaXNTdHJpbmcoYmFzZUhyZWYpKSB7XG4gICAgICAgICAgICByZXdyaXRlci5lbWl0U3RhcnRUYWcodGFnKTtcbiAgICAgICAgICAgIHJld3JpdGVyLmVtaXRSYXcoYDxiYXNlIGhyZWY9XCIke2Jhc2VIcmVmfVwiPmApO1xuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdiYXNlJzpcbiAgICAgICAgICAvLyBBZGp1c3QgYmFzZSBocmVmIGlmIHNwZWNpZmllZFxuICAgICAgICAgIGlmIChpc1N0cmluZyhiYXNlSHJlZikpIHtcbiAgICAgICAgICAgIHVwZGF0ZUF0dHJpYnV0ZSh0YWcsICdocmVmJywgYmFzZUhyZWYpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgcmV3cml0ZXIuZW1pdFN0YXJ0VGFnKHRhZyk7XG4gICAgfSlcbiAgICAub24oJ2VuZFRhZycsICh0YWcpID0+IHtcbiAgICAgIHN3aXRjaCAodGFnLnRhZ05hbWUpIHtcbiAgICAgICAgY2FzZSAnaGVhZCc6XG4gICAgICAgICAgZm9yIChjb25zdCBsaW5rVGFnIG9mIGxpbmtUYWdzKSB7XG4gICAgICAgICAgICByZXdyaXRlci5lbWl0UmF3KGxpbmtUYWcpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxpbmtUYWdzID0gW107XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2JvZHknOlxuICAgICAgICAgIC8vIEFkZCBzY3JpcHQgdGFnc1xuICAgICAgICAgIGZvciAoY29uc3Qgc2NyaXB0VGFnIG9mIHNjcmlwdFRhZ3MpIHtcbiAgICAgICAgICAgIHJld3JpdGVyLmVtaXRSYXcoc2NyaXB0VGFnKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzY3JpcHRUYWdzID0gW107XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIHJld3JpdGVyLmVtaXRFbmRUYWcodGFnKTtcbiAgICB9KTtcblxuICBjb25zdCBjb250ZW50ID0gYXdhaXQgdHJhbnNmb3JtZWRDb250ZW50KCk7XG5cbiAgcmV0dXJuIHtcbiAgICBjb250ZW50OlxuICAgICAgbGlua1RhZ3MubGVuZ3RoIHx8IHNjcmlwdFRhZ3MubGVuZ3RoXG4gICAgICAgID8gLy8gSW4gY2FzZSBubyBib2R5L2hlYWQgdGFncyBhcmUgbm90IHByZXNlbnQgKGRvdG5ldCBwYXJ0aWFsIHRlbXBsYXRlcylcbiAgICAgICAgICBsaW5rVGFncy5qb2luKCcnKSArIHNjcmlwdFRhZ3Muam9pbignJykgKyBjb250ZW50XG4gICAgICAgIDogY29udGVudCxcbiAgICB3YXJuaW5ncyxcbiAgICBlcnJvcnMsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlU3JpQXR0cmlidXRlcyhjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBhbGdvID0gJ3NoYTM4NCc7XG4gIGNvbnN0IGhhc2ggPSBjcmVhdGVIYXNoKGFsZ28pLnVwZGF0ZShjb250ZW50LCAndXRmOCcpLmRpZ2VzdCgnYmFzZTY0Jyk7XG5cbiAgcmV0dXJuIGBpbnRlZ3JpdHk9XCIke2FsZ299LSR7aGFzaH1cImA7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUF0dHJpYnV0ZShcbiAgdGFnOiB7IGF0dHJzOiB7IG5hbWU6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB9W10gfSxcbiAgbmFtZTogc3RyaW5nLFxuICB2YWx1ZTogc3RyaW5nLFxuKTogdm9pZCB7XG4gIGNvbnN0IGluZGV4ID0gdGFnLmF0dHJzLmZpbmRJbmRleCgoYSkgPT4gYS5uYW1lID09PSBuYW1lKTtcbiAgY29uc3QgbmV3VmFsdWUgPSB7IG5hbWUsIHZhbHVlIH07XG5cbiAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgIHRhZy5hdHRycy5wdXNoKG5ld1ZhbHVlKTtcbiAgfSBlbHNlIHtcbiAgICB0YWcuYXR0cnNbaW5kZXhdID0gbmV3VmFsdWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNTdHJpbmcodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBzdHJpbmcge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJztcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0TGFuZ3VhZ2VEaXJlY3Rpb24oXG4gIGxvY2FsZTogc3RyaW5nLFxuICB3YXJuaW5nczogc3RyaW5nW10sXG4pOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuICBjb25zdCBkaXIgPSBhd2FpdCBnZXRMYW5ndWFnZURpcmVjdGlvbkZyb21Mb2NhbGVzKGxvY2FsZSk7XG5cbiAgaWYgKCFkaXIpIHtcbiAgICB3YXJuaW5ncy5wdXNoKFxuICAgICAgYExvY2FsZSBkYXRhIGZvciAnJHtsb2NhbGV9JyBjYW5ub3QgYmUgZm91bmQuICdkaXInIGF0dHJpYnV0ZSB3aWxsIG5vdCBiZSBzZXQgZm9yIHRoaXMgbG9jYWxlLmAsXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBkaXI7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldExhbmd1YWdlRGlyZWN0aW9uRnJvbUxvY2FsZXMobG9jYWxlOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuICB0cnkge1xuICAgIGNvbnN0IGxvY2FsZURhdGEgPSAoXG4gICAgICBhd2FpdCBsb2FkRXNtTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ0Bhbmd1bGFyL2NvbW1vbi9sb2NhbGVzL2VuJyk+KFxuICAgICAgICBgQGFuZ3VsYXIvY29tbW9uL2xvY2FsZXMvJHtsb2NhbGV9YCxcbiAgICAgIClcbiAgICApLmRlZmF1bHQ7XG5cbiAgICBjb25zdCBkaXIgPSBsb2NhbGVEYXRhW2xvY2FsZURhdGEubGVuZ3RoIC0gMl07XG5cbiAgICByZXR1cm4gaXNTdHJpbmcoZGlyKSA/IGRpciA6IHVuZGVmaW5lZDtcbiAgfSBjYXRjaCB7XG4gICAgLy8gSW4gc29tZSBjYXNlcyBjZXJ0YWluIGxvY2FsZXMgbWlnaHQgbWFwIHRvIGZpbGVzIHdoaWNoIGFyZSBuYW1lZCBvbmx5IHdpdGggbGFuZ3VhZ2UgaWQuXG4gICAgLy8gRXhhbXBsZTogYGVuLVVTYCAtPiBgZW5gLlxuICAgIGNvbnN0IFtsYW5ndWFnZUlkXSA9IGxvY2FsZS5zcGxpdCgnLScsIDEpO1xuICAgIGlmIChsYW5ndWFnZUlkICE9PSBsb2NhbGUpIHtcbiAgICAgIHJldHVybiBnZXRMYW5ndWFnZURpcmVjdGlvbkZyb21Mb2NhbGVzKGxhbmd1YWdlSWQpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG4iXX0=