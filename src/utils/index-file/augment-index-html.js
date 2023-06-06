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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVnbWVudC1pbmRleC1odG1sLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvaW5kZXgtZmlsZS9hdWdtZW50LWluZGV4LWh0bWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsNkNBQXlDO0FBQ3pDLHlDQUFvQztBQUNwQywwQ0FBNEM7QUFDNUMsbUVBQThEO0FBc0M5RDs7Ozs7R0FLRztBQUNJLEtBQUssVUFBVSxnQkFBZ0IsQ0FDcEMsTUFBK0I7SUFFL0IsTUFBTSxFQUFFLGNBQWMsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLEdBQUcsRUFBRSxTQUFTLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLEdBQUcsTUFBTSxDQUFDO0lBRWpHLE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztJQUM5QixNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFFNUIsSUFBSSxFQUFFLFdBQVcsR0FBRyxNQUFNLEVBQUUsR0FBRyxNQUFNLENBQUM7SUFDdEMsSUFBSSxHQUFHLElBQUksV0FBVyxLQUFLLE1BQU0sRUFBRTtRQUNqQyxXQUFXLEdBQUcsV0FBVyxDQUFDO0tBQzNCO0lBRUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztJQUN0QyxNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBb0QsQ0FBQztJQUU1RSwrREFBK0Q7SUFDL0QsS0FBSyxNQUFNLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxJQUFJLFdBQVcsRUFBRTtRQUNoRCxLQUFLLE1BQU0sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEtBQUssRUFBRTtZQUM3QyxJQUFJLElBQUksS0FBSyxVQUFVLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxJ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QVUsS0FBSyxNQUFNLEVBQUU7WUFDekIsT0FBTywrQkFBK0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUNwRDtLQUNGO0lBRUQsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnbm9kZTpjcnlwdG8nO1xuaW1wb3J0IHsgZXh0bmFtZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBsb2FkRXNtTW9kdWxlIH0gZnJvbSAnLi4vbG9hZC1lc20nO1xuaW1wb3J0IHsgaHRtbFJld3JpdGluZ1N0cmVhbSB9IGZyb20gJy4vaHRtbC1yZXdyaXRpbmctc3RyZWFtJztcblxuZXhwb3J0IHR5cGUgTG9hZE91dHB1dEZpbGVGdW5jdGlvblR5cGUgPSAoZmlsZTogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZz47XG5cbmV4cG9ydCB0eXBlIENyb3NzT3JpZ2luVmFsdWUgPSAnbm9uZScgfCAnYW5vbnltb3VzJyB8ICd1c2UtY3JlZGVudGlhbHMnO1xuXG5leHBvcnQgdHlwZSBFbnRyeXBvaW50ID0gW25hbWU6IHN0cmluZywgaXNNb2R1bGU6IGJvb2xlYW5dO1xuXG5leHBvcnQgaW50ZXJmYWNlIEF1Z21lbnRJbmRleEh0bWxPcHRpb25zIHtcbiAgLyogSW5wdXQgY29udGVudHMgKi9cbiAgaHRtbDogc3RyaW5nO1xuICBiYXNlSHJlZj86IHN0cmluZztcbiAgZGVwbG95VXJsPzogc3RyaW5nO1xuICBzcmk6IGJvb2xlYW47XG4gIC8qKiBjcm9zc29yaWdpbiBhdHRyaWJ1dGUgc2V0dGluZyBvZiBlbGVtZW50cyB0aGF0IHByb3ZpZGUgQ09SUyBzdXBwb3J0ICovXG4gIGNyb3NzT3JpZ2luPzogQ3Jvc3NPcmlnaW5WYWx1ZTtcbiAgLypcbiAgICogRmlsZXMgZW1pdHRlZCBieSB0aGUgYnVpbGQuXG4gICAqL1xuICBmaWxlczogRmlsZUluZm9bXTtcbiAgLypcbiAgICogRnVuY3Rpb24gdGhhdCBsb2FkcyBhIGZpbGUgdXNlZC5cbiAgICogVGhpcyBhbGxvd3MgdXMgdG8gdXNlIGRpZmZlcmVudCByb3V0aW5lcyB3aXRoaW4gdGhlIEluZGV4SHRtbFdlYnBhY2tQbHVnaW4gYW5kXG4gICAqIHdoZW4gdXNlZCB3aXRob3V0IHRoaXMgcGx1Z2luLlxuICAgKi9cbiAgbG9hZE91dHB1dEZpbGU6IExvYWRPdXRwdXRGaWxlRnVuY3Rpb25UeXBlO1xuICAvKiogVXNlZCB0byBzb3J0IHRoZSBpbnNlcmF0aW9uIG9mIGZpbGVzIGluIHRoZSBIVE1MIGZpbGUgKi9cbiAgZW50cnlwb2ludHM6IEVudHJ5cG9pbnRbXTtcbiAgLyoqIFVzZWQgdG8gc2V0IHRoZSBkb2N1bWVudCBkZWZhdWx0IGxvY2FsZSAqL1xuICBsYW5nPzogc3RyaW5nO1xuICBoaW50cz86IHsgdXJsOiBzdHJpbmc7IG1vZGU6IHN0cmluZyB9W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmlsZUluZm8ge1xuICBmaWxlOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgZXh0ZW5zaW9uOiBzdHJpbmc7XG59XG4vKlxuICogSGVscGVyIGZ1bmN0aW9uIHVzZWQgYnkgdGhlIEluZGV4SHRtbFdlYnBhY2tQbHVnaW4uXG4gKiBDYW4gYWxzbyBiZSBkaXJlY3RseSB1c2VkIGJ5IGJ1aWxkZXIsIGUuIGcuIGluIG9yZGVyIHRvIGdlbmVyYXRlIGFuIGluZGV4Lmh0bWxcbiAqIGFmdGVyIHByb2Nlc3Npbmcgc2V2ZXJhbCBjb25maWd1cmF0aW9ucyBpbiBvcmRlciB0byBidWlsZCBkaWZmZXJlbnQgc2V0cyBvZlxuICogYnVuZGxlcyBmb3IgZGlmZmVyZW50aWFsIHNlcnZpbmcuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhdWdtZW50SW5kZXhIdG1sKFxuICBwYXJhbXM6IEF1Z21lbnRJbmRleEh0bWxPcHRpb25zLFxuKTogUHJvbWlzZTx7IGNvbnRlbnQ6IHN0cmluZzsgd2FybmluZ3M6IHN0cmluZ1tdOyBlcnJvcnM6IHN0cmluZ1tdIH0+IHtcbiAgY29uc3QgeyBsb2FkT3V0cHV0RmlsZSwgZmlsZXMsIGVudHJ5cG9pbnRzLCBzcmksIGRlcGxveVVybCA9ICcnLCBsYW5nLCBiYXNlSHJlZiwgaHRtbCB9ID0gcGFyYW1zO1xuXG4gIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgbGV0IHsgY3Jvc3NPcmlnaW4gPSAnbm9uZScgfSA9IHBhcmFtcztcbiAgaWYgKHNyaSAmJiBjcm9zc09yaWdpbiA9PT0gJ25vbmUnKSB7XG4gICAgY3Jvc3NPcmlnaW4gPSAnYW5vbnltb3VzJztcbiAgfVxuXG4gIGNvbnN0IHN0eWxlc2hlZXRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGNvbnN0IHNjcmlwdHMgPSBuZXcgTWFwPC8qKiBmaWxlIG5hbWUgKi8gc3RyaW5nLCAvKiogaXNNb2R1bGUgKi8gYm9vbGVhbj4oKTtcblxuICAvLyBTb3J0IGZpbGVzIGluIHRoZSBvcmRlciB3ZSB3YW50IHRvIGluc2VydCB0aGVtIGJ5IGVudHJ5cG9pbnRcbiAgZm9yIChjb25zdCBbZW50cnlwb2ludCwgaXNNb2R1bGVdIG9mIGVudHJ5cG9pbnRzKSB7XG4gICAgZm9yIChjb25zdCB7IGV4dGVuc2lvbiwgZmlsZSwgbmFtZSB9IG9mIGZpbGVzKSB7XG4gICAgICBpZiAobmFtZSAhPT0gZW50cnlwb2ludCB8fCBzY3JpcHRzLmhhcyhmaWxlKSB8fCBzdHlsZXNoZWV0cy5oYXMoZmlsZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHN3aXRjaCAoZXh0ZW5zaW9uKSB7XG4gICAgICAgIGNhc2UgJy5qcyc6XG4gICAgICAgICAgLy8gQWxzbywgbm9uIGVudHJ5cG9pbnRzIG5lZWQgdG8gYmUgbG9hZGVkIGFzIG5vIG1vZHVsZSBhcyB0aGV5IGNhbiBjb250YWluIHByb2JsZW1hdGljIGNvZGUuXG4gICAgICAgICAgc2NyaXB0cy5zZXQoZmlsZSwgaXNNb2R1bGUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICcubWpzJzpcbiAgICAgICAgICBpZiAoIWlzTW9kdWxlKSB7XG4gICAgICAgICAgICAvLyBJdCB3b3VsZCBiZSB2ZXJ5IGNvbmZ1c2luZyB0byBsaW5rIGFuIGAqLm1qc2AgZmlsZSBpbiBhIG5vbi1tb2R1bGUgc2NyaXB0IGNvbnRleHQsXG4gICAgICAgICAgICAvLyBzbyB3ZSBkaXNhbGxvdyBpdCBlbnRpcmVseS5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignYC5tanNgIGZpbGVzICptdXN0KiBzZXQgYGlzTW9kdWxlYCB0byBgdHJ1ZWAuJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNjcmlwdHMuc2V0KGZpbGUsIHRydWUgLyogaXNNb2R1bGUgKi8pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICcuY3NzJzpcbiAgICAgICAgICBzdHlsZXNoZWV0cy5hZGQoZmlsZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgbGV0IHNjcmlwdFRhZ3M6IHN0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3QgW3NyYywgaXNNb2R1bGVdIG9mIHNjcmlwdHMpIHtcbiAgICBjb25zdCBhdHRycyA9IFtgc3JjPVwiJHtkZXBsb3lVcmx9JHtzcmN9XCJgXTtcblxuICAgIC8vIFRoaXMgaXMgYWxzbyBuZWVkIGZvciBub24gZW50cnktcG9pbnRzIGFzIHRoZXkgbWF5IGNvbnRhaW4gcHJvYmxlbWF0aWMgY29kZS5cbiAgICBpZiAoaXNNb2R1bGUpIHtcbiAgICAgIGF0dHJzLnB1c2goJ3R5cGU9XCJtb2R1bGVcIicpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhdHRycy5wdXNoKCdkZWZlcicpO1xuICAgIH1cblxuICAgIGlmIChjcm9zc09yaWdpbiAhPT0gJ25vbmUnKSB7XG4gICAgICBhdHRycy5wdXNoKGBjcm9zc29yaWdpbj1cIiR7Y3Jvc3NPcmlnaW59XCJgKTtcbiAgICB9XG5cbiAgICBpZiAoc3JpKSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgbG9hZE91dHB1dEZpbGUoc3JjKTtcbiAgICAgIGF0dHJzLnB1c2goZ2VuZXJhdGVTcmlBdHRyaWJ1dGVzKGNvbnRlbnQpKTtcbiAgICB9XG5cbiAgICBzY3JpcHRUYWdzLnB1c2goYDxzY3JpcHQgJHthdHRycy5qb2luKCcgJyl9Pjwvc2NyaXB0PmApO1xuICB9XG5cbiAgbGV0IGxpbmtUYWdzOiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IHNyYyBvZiBzdHlsZXNoZWV0cykge1xuICAgIGNvbnN0IGF0dHJzID0gW2ByZWw9XCJzdHlsZXNoZWV0XCJgLCBgaHJlZj1cIiR7ZGVwbG95VXJsfSR7c3JjfVwiYF07XG5cbiAgICBpZiAoY3Jvc3NPcmlnaW4gIT09ICdub25lJykge1xuICAgICAgYXR0cnMucHVzaChgY3Jvc3NvcmlnaW49XCIke2Nyb3NzT3JpZ2lufVwiYCk7XG4gICAgfVxuXG4gICAgaWYgKHNyaSkge1xuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGxvYWRPdXRwdXRGaWxlKHNyYyk7XG4gICAgICBhdHRycy5wdXNoKGdlbmVyYXRlU3JpQXR0cmlidXRlcyhjb250ZW50KSk7XG4gICAgfVxuXG4gICAgbGlua1RhZ3MucHVzaChgPGxpbmsgJHthdHRycy5qb2luKCcgJyl9PmApO1xuICB9XG5cbiAgaWYgKHBhcmFtcy5oaW50cz8ubGVuZ3RoKSB7XG4gICAgZm9yIChjb25zdCBoaW50IG9mIHBhcmFtcy5oaW50cykge1xuICAgICAgY29uc3QgYXR0cnMgPSBbYHJlbD1cIiR7aGludC5tb2RlfVwiYCwgYGhyZWY9XCIke2RlcGxveVVybH0ke2hpbnQudXJsfVwiYF07XG5cbiAgICAgIGlmIChoaW50Lm1vZGUgIT09ICdtb2R1bGVwcmVsb2FkJyAmJiBjcm9zc09yaWdpbiAhPT0gJ25vbmUnKSB7XG4gICAgICAgIC8vIFZhbHVlIGlzIGNvbnNpZGVyZWQgYW5vbnltb3VzIGJ5IHRoZSBicm93c2VyIHdoZW4gbm90IHByZXNlbnQgb3IgZW1wdHlcbiAgICAgICAgYXR0cnMucHVzaChjcm9zc09yaWdpbiA9PT0gJ2Fub255bW91cycgPyAnY3Jvc3NvcmlnaW4nIDogYGNyb3Nzb3JpZ2luPVwiJHtjcm9zc09yaWdpbn1cImApO1xuICAgICAgfVxuXG4gICAgICBpZiAoaGludC5tb2RlID09PSAncHJlbG9hZCcgfHwgaGludC5tb2RlID09PSAncHJlZmV0Y2gnKSB7XG4gICAgICAgIHN3aXRjaCAoZXh0bmFtZShoaW50LnVybCkpIHtcbiAgICAgICAgICBjYXNlICcuanMnOlxuICAgICAgICAgICAgYXR0cnMucHVzaCgnYXM9XCJzY3JpcHRcIicpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnLmNzcyc6XG4gICAgICAgICAgICBhdHRycy5wdXNoKCdhcz1cInN0eWxlXCInKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChcbiAgICAgICAgc3JpICYmXG4gICAgICAgIChoaW50Lm1vZGUgPT09ICdwcmVsb2FkJyB8fCBoaW50Lm1vZGUgPT09ICdwcmVmZXRjaCcgfHwgaGludC5tb2RlID09PSAnbW9kdWxlcHJlbG9hZCcpXG4gICAgICApIHtcbiAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGxvYWRPdXRwdXRGaWxlKGhpbnQudXJsKTtcbiAgICAgICAgYXR0cnMucHVzaChnZW5lcmF0ZVNyaUF0dHJpYnV0ZXMoY29udGVudCkpO1xuICAgICAgfVxuXG4gICAgICBsaW5rVGFncy5wdXNoKGA8bGluayAke2F0dHJzLmpvaW4oJyAnKX0+YCk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZGlyID0gbGFuZyA/IGF3YWl0IGdldExhbmd1YWdlRGlyZWN0aW9uKGxhbmcsIHdhcm5pbmdzKSA6IHVuZGVmaW5lZDtcbiAgY29uc3QgeyByZXdyaXRlciwgdHJhbnNmb3JtZWRDb250ZW50IH0gPSBhd2FpdCBodG1sUmV3cml0aW5nU3RyZWFtKGh0bWwpO1xuICBjb25zdCBiYXNlVGFnRXhpc3RzID0gaHRtbC5pbmNsdWRlcygnPGJhc2UnKTtcblxuICByZXdyaXRlclxuICAgIC5vbignc3RhcnRUYWcnLCAodGFnKSA9PiB7XG4gICAgICBzd2l0Y2ggKHRhZy50YWdOYW1lKSB7XG4gICAgICAgIGNhc2UgJ2h0bWwnOlxuICAgICAgICAgIC8vIEFkanVzdCBkb2N1bWVudCBsb2NhbGUgaWYgc3BlY2lmaWVkXG4gICAgICAgICAgaWYgKGlzU3RyaW5nKGxhbmcpKSB7XG4gICAgICAgICAgICB1cGRhdGVBdHRyaWJ1dGUodGFnLCAnbGFuZycsIGxhbmcpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChkaXIpIHtcbiAgICAgICAgICAgIHVwZGF0ZUF0dHJpYnV0ZSh0YWcsICdkaXInLCBkaXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnaGVhZCc6XG4gICAgICAgICAgLy8gQmFzZSBocmVmIHNob3VsZCBiZSBhZGRlZCBiZWZvcmUgYW55IGxpbmssIG1ldGEgdGFnc1xuICAgICAgICAgIGlmICghYmFzZVRhZ0V4aXN0cyAmJiBpc1N0cmluZyhiYXNlSHJlZikpIHtcbiAgICAgICAgICAgIHJld3JpdGVyLmVtaXRTdGFydFRhZyh0YWcpO1xuICAgICAgICAgICAgcmV3cml0ZXIuZW1pdFJhdyhgPGJhc2UgaHJlZj1cIiR7YmFzZUhyZWZ9XCI+YCk7XG5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2Jhc2UnOlxuICAgICAgICAgIC8vIEFkanVzdCBiYXNlIGhyZWYgaWYgc3BlY2lmaWVkXG4gICAgICAgICAgaWYgKGlzU3RyaW5nKGJhc2VIcmVmKSkge1xuICAgICAgICAgICAgdXBkYXRlQXR0cmlidXRlKHRhZywgJ2hyZWYnLCBiYXNlSHJlZik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICByZXdyaXRlci5lbWl0U3RhcnRUYWcodGFnKTtcbiAgICB9KVxuICAgIC5vbignZW5kVGFnJywgKHRhZykgPT4ge1xuICAgICAgc3dpdGNoICh0YWcudGFnTmFtZSkge1xuICAgICAgICBjYXNlICdoZWFkJzpcbiAgICAgICAgICBmb3IgKGNvbnN0IGxpbmtUYWcgb2YgbGlua1RhZ3MpIHtcbiAgICAgICAgICAgIHJld3JpdGVyLmVtaXRSYXcobGlua1RhZyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGlua1RhZ3MgPSBbXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnYm9keSc6XG4gICAgICAgICAgLy8gQWRkIHNjcmlwdCB0YWdzXG4gICAgICAgICAgZm9yIChjb25zdCBzY3JpcHRUYWcgb2Ygc2NyaXB0VGFncykge1xuICAgICAgICAgICAgcmV3cml0ZXIuZW1pdFJhdyhzY3JpcHRUYWcpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHNjcmlwdFRhZ3MgPSBbXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgcmV3cml0ZXIuZW1pdEVuZFRhZyh0YWcpO1xuICAgIH0pO1xuXG4gIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0cmFuc2Zvcm1lZENvbnRlbnQoKTtcblxuICByZXR1cm4ge1xuICAgIGNvbnRlbnQ6XG4gICAgICBsaW5rVGFncy5sZW5ndGggfHwgc2NyaXB0VGFncy5sZW5ndGhcbiAgICAgICAgPyAvLyBJbiBjYXNlIG5vIGJvZHkvaGVhZCB0YWdzIGFyZSBub3QgcHJlc2VudCAoZG90bmV0IHBhcnRpYWwgdGVtcGxhdGVzKVxuICAgICAgICAgIGxpbmtUYWdzLmpvaW4oJycpICsgc2NyaXB0VGFncy5qb2luKCcnKSArIGNvbnRlbnRcbiAgICAgICAgOiBjb250ZW50LFxuICAgIHdhcm5pbmdzLFxuICAgIGVycm9ycyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVTcmlBdHRyaWJ1dGVzKGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGFsZ28gPSAnc2hhMzg0JztcbiAgY29uc3QgaGFzaCA9IGNyZWF0ZUhhc2goYWxnbykudXBkYXRlKGNvbnRlbnQsICd1dGY4JykuZGlnZXN0KCdiYXNlNjQnKTtcblxuICByZXR1cm4gYGludGVncml0eT1cIiR7YWxnb30tJHtoYXNofVwiYDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlQXR0cmlidXRlKFxuICB0YWc6IHsgYXR0cnM6IHsgbmFtZTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIH1bXSB9LFxuICBuYW1lOiBzdHJpbmcsXG4gIHZhbHVlOiBzdHJpbmcsXG4pOiB2b2lkIHtcbiAgY29uc3QgaW5kZXggPSB0YWcuYXR0cnMuZmluZEluZGV4KChhKSA9PiBhLm5hbWUgPT09IG5hbWUpO1xuICBjb25zdCBuZXdWYWx1ZSA9IHsgbmFtZSwgdmFsdWUgfTtcblxuICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgdGFnLmF0dHJzLnB1c2gobmV3VmFsdWUpO1xuICB9IGVsc2Uge1xuICAgIHRhZy5hdHRyc1tpbmRleF0gPSBuZXdWYWx1ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1N0cmluZyh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIHN0cmluZyB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRMYW5ndWFnZURpcmVjdGlvbihcbiAgbG9jYWxlOiBzdHJpbmcsXG4gIHdhcm5pbmdzOiBzdHJpbmdbXSxcbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG4gIGNvbnN0IGRpciA9IGF3YWl0IGdldExhbmd1YWdlRGlyZWN0aW9uRnJvbUxvY2FsZXMobG9jYWxlKTtcblxuICBpZiAoIWRpcikge1xuICAgIHdhcm5pbmdzLnB1c2goXG4gICAgICBgTG9jYWxlIGRhdGEgZm9yICcke2xvY2FsZX0nIGNhbm5vdCBiZSBmb3VuZC4gJ2RpcicgYXR0cmlidXRlIHdpbGwgbm90IGJlIHNldCBmb3IgdGhpcyBsb2NhbGUuYCxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIGRpcjtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0TGFuZ3VhZ2VEaXJlY3Rpb25Gcm9tTG9jYWxlcyhsb2NhbGU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgbG9jYWxlRGF0YSA9IChcbiAgICAgIGF3YWl0IGxvYWRFc21Nb2R1bGU8dHlwZW9mIGltcG9ydCgnQGFuZ3VsYXIvY29tbW9uL2xvY2FsZXMvZW4nKT4oXG4gICAgICAgIGBAYW5ndWxhci9jb21tb24vbG9jYWxlcy8ke2xvY2FsZX1gLFxuICAgICAgKVxuICAgICkuZGVmYXVsdDtcblxuICAgIGNvbnN0IGRpciA9IGxvY2FsZURhdGFbbG9jYWxlRGF0YS5sZW5ndGggLSAyXTtcblxuICAgIHJldHVybiBpc1N0cmluZyhkaXIpID8gZGlyIDogdW5kZWZpbmVkO1xuICB9IGNhdGNoIHtcbiAgICAvLyBJbiBzb21lIGNhc2VzIGNlcnRhaW4gbG9jYWxlcyBtaWdodCBtYXAgdG8gZmlsZXMgd2hpY2ggYXJlIG5hbWVkIG9ubHkgd2l0aCBsYW5ndWFnZSBpZC5cbiAgICAvLyBFeGFtcGxlOiBgZW4tVVNgIC0+IGBlbmAuXG4gICAgY29uc3QgW2xhbmd1YWdlSWRdID0gbG9jYWxlLnNwbGl0KCctJywgMSk7XG4gICAgaWYgKGxhbmd1YWdlSWQgIT09IGxvY2FsZSkge1xuICAgICAgcmV0dXJuIGdldExhbmd1YWdlRGlyZWN0aW9uRnJvbUxvY2FsZXMobGFuZ3VhZ2VJZCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cbiJdfQ==