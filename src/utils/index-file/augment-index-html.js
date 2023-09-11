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
// eslint-disable-next-line max-lines-per-function
async function augmentIndexHtml(params) {
    const { loadOutputFile, files, entrypoints, sri, deployUrl = '', lang, baseHref, html, imageDomains, } = params;
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
                    default:
                        if (hint.as) {
                            attrs.push(`as="${hint.as}"`);
                        }
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
    const foundPreconnects = new Set();
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
            case 'link':
                if (readAttribute(tag, 'rel') === 'preconnect') {
                    const href = readAttribute(tag, 'href');
                    if (href) {
                        foundPreconnects.add(href);
                    }
                }
        }
        rewriter.emitStartTag(tag);
    })
        .on('endTag', (tag) => {
        switch (tag.tagName) {
            case 'head':
                for (const linkTag of linkTags) {
                    rewriter.emitRaw(linkTag);
                }
                if (imageDomains) {
                    for (const imageDomain of imageDomains) {
                        if (!foundPreconnects.has(imageDomain)) {
                            rewriter.emitRaw(`<link rel="preconnect" href="${imageDomain}" data-ngimg>`);
                        }
                    }
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
function readAttribute(tag, name) {
    const targetAttr = tag.attrs.find((attr) => attr.name === name);
    return targetAttr ? targetAttr.value : undefined;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVnbWVudC1pbmRleC1odG1sLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvaW5kZXgtZmlsZS9hdWdtZW50LWluZGV4LWh0bWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsNkNBQXlDO0FBQ3pDLHlDQUFvQztBQUNwQywwQ0FBNEM7QUFDNUMsbUVBQThEO0FBdUM5RDs7Ozs7R0FLRztBQUNILGtEQUFrRDtBQUMzQyxLQUFLLFVBQVUsZ0JBQWdCLENBQ3BDLE1BQStCO0lBRS9CLE1BQU0sRUFDSixjQUFjLEVBQ2QsS0FBSyxFQUNMLFdBQVcsRUFDWCxHQUFHLEVBQ0gsU0FBUyxHQUFHLEVBQUUsRUFDZCxJQUFJLEVBQ0osUUFBUSxFQUNSLElBQUksRUFDSixZQUFZLEdBQ2IsR0FBRyxNQUFNLENBQUM7SUFFWCxNQUFNLFFBQVEsR0FBYSxFQUFFLENBQUM7SUFDOUIsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO0lBRTVCLElBQUksRUFBRSxXQUFXLEdBQUcsTUFBTSxFQUFFLEdBQUcsTUFBTSxDQUFDO0lBQ3RDLElBQUksR0FBRyxJQUFJLFdBQVcsS0FBSyxNQUFNLEVBQUU7UUFDakMsV0FBVyxHQUFHLFdBQVcsQ0FBQztLQUMzQjtJQUVELE1BQU0sV0FBVyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7SUFDdEMsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQW9ELENBQUM7SUFFNUUsK0RBQStEO0lBQy9ELEtBQUssTUFBTSxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsSUFBSSxXQUFXLEVBQUU7UUFDaEQsS0FBSyxNQUFNLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxLQUFLLEVBQUU7WUFDN0MsSUFBSSxJQUFJLEtBQUssVUFBVSxJQUFJ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LCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ25vZGU6Y3J5cHRvJztcbmltcG9ydCB7IGV4dG5hbWUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uL2xvYWQtZXNtJztcbmltcG9ydCB7IGh0bWxSZXdyaXRpbmdTdHJlYW0gfSBmcm9tICcuL2h0bWwtcmV3cml0aW5nLXN0cmVhbSc7XG5cbmV4cG9ydCB0eXBlIExvYWRPdXRwdXRGaWxlRnVuY3Rpb25UeXBlID0gKGZpbGU6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmc+O1xuXG5leHBvcnQgdHlwZSBDcm9zc09yaWdpblZhbHVlID0gJ25vbmUnIHwgJ2Fub255bW91cycgfCAndXNlLWNyZWRlbnRpYWxzJztcblxuZXhwb3J0IHR5cGUgRW50cnlwb2ludCA9IFtuYW1lOiBzdHJpbmcsIGlzTW9kdWxlOiBib29sZWFuXTtcblxuZXhwb3J0IGludGVyZmFjZSBBdWdtZW50SW5kZXhIdG1sT3B0aW9ucyB7XG4gIC8qIElucHV0IGNvbnRlbnRzICovXG4gIGh0bWw6IHN0cmluZztcbiAgYmFzZUhyZWY/OiBzdHJpbmc7XG4gIGRlcGxveVVybD86IHN0cmluZztcbiAgc3JpOiBib29sZWFuO1xuICAvKiogY3Jvc3NvcmlnaW4gYXR0cmlidXRlIHNldHRpbmcgb2YgZWxlbWVudHMgdGhhdCBwcm92aWRlIENPUlMgc3VwcG9ydCAqL1xuICBjcm9zc09yaWdpbj86IENyb3NzT3JpZ2luVmFsdWU7XG4gIC8qXG4gICAqIEZpbGVzIGVtaXR0ZWQgYnkgdGhlIGJ1aWxkLlxuICAgKi9cbiAgZmlsZXM6IEZpbGVJbmZvW107XG4gIC8qXG4gICAqIEZ1bmN0aW9uIHRoYXQgbG9hZHMgYSBmaWxlIHVzZWQuXG4gICAqIFRoaXMgYWxsb3dzIHVzIHRvIHVzZSBkaWZmZXJlbnQgcm91dGluZXMgd2l0aGluIHRoZSBJbmRleEh0bWxXZWJwYWNrUGx1Z2luIGFuZFxuICAgKiB3aGVuIHVzZWQgd2l0aG91dCB0aGlzIHBsdWdpbi5cbiAgICovXG4gIGxvYWRPdXRwdXRGaWxlOiBMb2FkT3V0cHV0RmlsZUZ1bmN0aW9uVHlwZTtcbiAgLyoqIFVzZWQgdG8gc29ydCB0aGUgaW5zZXJhdGlvbiBvZiBmaWxlcyBpbiB0aGUgSFRNTCBmaWxlICovXG4gIGVudHJ5cG9pbnRzOiBFbnRyeXBvaW50W107XG4gIC8qKiBVc2VkIHRvIHNldCB0aGUgZG9jdW1lbnQgZGVmYXVsdCBsb2NhbGUgKi9cbiAgbGFuZz86IHN0cmluZztcbiAgaGludHM/OiB7IHVybDogc3RyaW5nOyBtb2RlOiBzdHJpbmc7IGFzPzogc3RyaW5nIH1bXTtcbiAgaW1hZ2VEb21haW5zPzogc3RyaW5nW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmlsZUluZm8ge1xuICBmaWxlOiBzdHJpbmc7XG4gIG5hbWU/OiBzdHJpbmc7XG4gIGV4dGVuc2lvbjogc3RyaW5nO1xufVxuLypcbiAqIEhlbHBlciBmdW5jdGlvbiB1c2VkIGJ5IHRoZSBJbmRleEh0bWxXZWJwYWNrUGx1Z2luLlxuICogQ2FuIGFsc28gYmUgZGlyZWN0bHkgdXNlZCBieSBidWlsZGVyLCBlLiBnLiBpbiBvcmRlciB0byBnZW5lcmF0ZSBhbiBpbmRleC5odG1sXG4gKiBhZnRlciBwcm9jZXNzaW5nIHNldmVyYWwgY29uZmlndXJhdGlvbnMgaW4gb3JkZXIgdG8gYnVpbGQgZGlmZmVyZW50IHNldHMgb2ZcbiAqIGJ1bmRsZXMgZm9yIGRpZmZlcmVudGlhbCBzZXJ2aW5nLlxuICovXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxpbmVzLXBlci1mdW5jdGlvblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGF1Z21lbnRJbmRleEh0bWwoXG4gIHBhcmFtczogQXVnbWVudEluZGV4SHRtbE9wdGlvbnMsXG4pOiBQcm9taXNlPHsgY29udGVudDogc3RyaW5nOyB3YXJuaW5nczogc3RyaW5nW107IGVycm9yczogc3RyaW5nW10gfT4ge1xuICBjb25zdCB7XG4gICAgbG9hZE91dHB1dEZpbGUsXG4gICAgZmlsZXMsXG4gICAgZW50cnlwb2ludHMsXG4gICAgc3JpLFxuICAgIGRlcGxveVVybCA9ICcnLFxuICAgIGxhbmcsXG4gICAgYmFzZUhyZWYsXG4gICAgaHRtbCxcbiAgICBpbWFnZURvbWFpbnMsXG4gIH0gPSBwYXJhbXM7XG5cbiAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcblxuICBsZXQgeyBjcm9zc09yaWdpbiA9ICdub25lJyB9ID0gcGFyYW1zO1xuICBpZiAoc3JpICYmIGNyb3NzT3JpZ2luID09PSAnbm9uZScpIHtcbiAgICBjcm9zc09yaWdpbiA9ICdhbm9ueW1vdXMnO1xuICB9XG5cbiAgY29uc3Qgc3R5bGVzaGVldHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3Qgc2NyaXB0cyA9IG5ldyBNYXA8LyoqIGZpbGUgbmFtZSAqLyBzdHJpbmcsIC8qKiBpc01vZHVsZSAqLyBib29sZWFuPigpO1xuXG4gIC8vIFNvcnQgZmlsZXMgaW4gdGhlIG9yZGVyIHdlIHdhbnQgdG8gaW5zZXJ0IHRoZW0gYnkgZW50cnlwb2ludFxuICBmb3IgKGNvbnN0IFtlbnRyeXBvaW50LCBpc01vZHVsZV0gb2YgZW50cnlwb2ludHMpIHtcbiAgICBmb3IgKGNvbnN0IHsgZXh0ZW5zaW9uLCBmaWxlLCBuYW1lIH0gb2YgZmlsZXMpIHtcbiAgICAgIGlmIChuYW1lICE9PSBlbnRyeXBvaW50IHx8IHNjcmlwdHMuaGFzKGZpbGUpIHx8IHN0eWxlc2hlZXRzLmhhcyhmaWxlKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgc3dpdGNoIChleHRlbnNpb24pIHtcbiAgICAgICAgY2FzZSAnLmpzJzpcbiAgICAgICAgICAvLyBBbHNvLCBub24gZW50cnlwb2ludHMgbmVlZCB0byBiZSBsb2FkZWQgYXMgbm8gbW9kdWxlIGFzIHRoZXkgY2FuIGNvbnRhaW4gcHJvYmxlbWF0aWMgY29kZS5cbiAgICAgICAgICBzY3JpcHRzLnNldChmaWxlLCBpc01vZHVsZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJy5tanMnOlxuICAgICAgICAgIGlmICghaXNNb2R1bGUpIHtcbiAgICAgICAgICAgIC8vIEl0IHdvdWxkIGJlIHZlcnkgY29uZnVzaW5nIHRvIGxpbmsgYW4gYCoubWpzYCBmaWxlIGluIGEgbm9uLW1vZHVsZSBzY3JpcHQgY29udGV4dCxcbiAgICAgICAgICAgIC8vIHNvIHdlIGRpc2FsbG93IGl0IGVudGlyZWx5LlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdgLm1qc2AgZmlsZXMgKm11c3QqIHNldCBgaXNNb2R1bGVgIHRvIGB0cnVlYC4nKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2NyaXB0cy5zZXQoZmlsZSwgdHJ1ZSAvKiBpc01vZHVsZSAqLyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJy5jc3MnOlxuICAgICAgICAgIHN0eWxlc2hlZXRzLmFkZChmaWxlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsZXQgc2NyaXB0VGFnczogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBbc3JjLCBpc01vZHVsZV0gb2Ygc2NyaXB0cykge1xuICAgIGNvbnN0IGF0dHJzID0gW2BzcmM9XCIke2RlcGxveVVybH0ke3NyY31cImBdO1xuXG4gICAgLy8gVGhpcyBpcyBhbHNvIG5lZWQgZm9yIG5vbiBlbnRyeS1wb2ludHMgYXMgdGhleSBtYXkgY29udGFpbiBwcm9ibGVtYXRpYyBjb2RlLlxuICAgIGlmIChpc01vZHVsZSkge1xuICAgICAgYXR0cnMucHVzaCgndHlwZT1cIm1vZHVsZVwiJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGF0dHJzLnB1c2goJ2RlZmVyJyk7XG4gICAgfVxuXG4gICAgaWYgKGNyb3NzT3JpZ2luICE9PSAnbm9uZScpIHtcbiAgICAgIGF0dHJzLnB1c2goYGNyb3Nzb3JpZ2luPVwiJHtjcm9zc09yaWdpbn1cImApO1xuICAgIH1cblxuICAgIGlmIChzcmkpIHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBsb2FkT3V0cHV0RmlsZShzcmMpO1xuICAgICAgYXR0cnMucHVzaChnZW5lcmF0ZVNyaUF0dHJpYnV0ZXMoY29udGVudCkpO1xuICAgIH1cblxuICAgIHNjcmlwdFRhZ3MucHVzaChgPHNjcmlwdCAke2F0dHJzLmpvaW4oJyAnKX0+PC9zY3JpcHQ+YCk7XG4gIH1cblxuICBsZXQgbGlua1RhZ3M6IHN0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3Qgc3JjIG9mIHN0eWxlc2hlZXRzKSB7XG4gICAgY29uc3QgYXR0cnMgPSBbYHJlbD1cInN0eWxlc2hlZXRcImAsIGBocmVmPVwiJHtkZXBsb3lVcmx9JHtzcmN9XCJgXTtcblxuICAgIGlmIChjcm9zc09yaWdpbiAhPT0gJ25vbmUnKSB7XG4gICAgICBhdHRycy5wdXNoKGBjcm9zc29yaWdpbj1cIiR7Y3Jvc3NPcmlnaW59XCJgKTtcbiAgICB9XG5cbiAgICBpZiAoc3JpKSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgbG9hZE91dHB1dEZpbGUoc3JjKTtcbiAgICAgIGF0dHJzLnB1c2goZ2VuZXJhdGVTcmlBdHRyaWJ1dGVzKGNvbnRlbnQpKTtcbiAgICB9XG5cbiAgICBsaW5rVGFncy5wdXNoKGA8bGluayAke2F0dHJzLmpvaW4oJyAnKX0+YCk7XG4gIH1cblxuICBpZiAocGFyYW1zLmhpbnRzPy5sZW5ndGgpIHtcbiAgICBmb3IgKGNvbnN0IGhpbnQgb2YgcGFyYW1zLmhpbnRzKSB7XG4gICAgICBjb25zdCBhdHRycyA9IFtgcmVsPVwiJHtoaW50Lm1vZGV9XCJgLCBgaHJlZj1cIiR7ZGVwbG95VXJsfSR7aGludC51cmx9XCJgXTtcblxuICAgICAgaWYgKGhpbnQubW9kZSAhPT0gJ21vZHVsZXByZWxvYWQnICYmIGNyb3NzT3JpZ2luICE9PSAnbm9uZScpIHtcbiAgICAgICAgLy8gVmFsdWUgaXMgY29uc2lkZXJlZCBhbm9ueW1vdXMgYnkgdGhlIGJyb3dzZXIgd2hlbiBub3QgcHJlc2VudCBvciBlbXB0eVxuICAgICAgICBhdHRycy5wdXNoKGNyb3NzT3JpZ2luID09PSAnYW5vbnltb3VzJyA/ICdjcm9zc29yaWdpbicgOiBgY3Jvc3NvcmlnaW49XCIke2Nyb3NzT3JpZ2lufVwiYCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChoaW50Lm1vZGUgPT09ICdwcmVsb2FkJyB8fCBoaW50Lm1vZGUgPT09ICdwcmVmZXRjaCcpIHtcbiAgICAgICAgc3dpdGNoIChleHRuYW1lKGhpbnQudXJsKSkge1xuICAgICAgICAgIGNhc2UgJy5qcyc6XG4gICAgICAgICAgICBhdHRycy5wdXNoKCdhcz1cInNjcmlwdFwiJyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICcuY3NzJzpcbiAgICAgICAgICAgIGF0dHJzLnB1c2goJ2FzPVwic3R5bGVcIicpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGlmIChoaW50LmFzKSB7XG4gICAgICAgICAgICAgIGF0dHJzLnB1c2goYGFzPVwiJHtoaW50LmFzfVwiYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoXG4gICAgICAgIHNyaSAmJlxuICAgICAgICAoaGludC5tb2RlID09PSAncHJlbG9hZCcgfHwgaGludC5tb2RlID09PSAncHJlZmV0Y2gnIHx8IGhpbnQubW9kZSA9PT0gJ21vZHVsZXByZWxvYWQnKVxuICAgICAgKSB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBsb2FkT3V0cHV0RmlsZShoaW50LnVybCk7XG4gICAgICAgIGF0dHJzLnB1c2goZ2VuZXJhdGVTcmlBdHRyaWJ1dGVzKGNvbnRlbnQpKTtcbiAgICAgIH1cblxuICAgICAgbGlua1RhZ3MucHVzaChgPGxpbmsgJHthdHRycy5qb2luKCcgJyl9PmApO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGRpciA9IGxhbmcgPyBhd2FpdCBnZXRMYW5ndWFnZURpcmVjdGlvbihsYW5nLCB3YXJuaW5ncykgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IHsgcmV3cml0ZXIsIHRyYW5zZm9ybWVkQ29udGVudCB9ID0gYXdhaXQgaHRtbFJld3JpdGluZ1N0cmVhbShodG1sKTtcbiAgY29uc3QgYmFzZVRhZ0V4aXN0cyA9IGh0bWwuaW5jbHVkZXMoJzxiYXNlJyk7XG4gIGNvbnN0IGZvdW5kUHJlY29ubmVjdHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICByZXdyaXRlclxuICAgIC5vbignc3RhcnRUYWcnLCAodGFnKSA9PiB7XG4gICAgICBzd2l0Y2ggKHRhZy50YWdOYW1lKSB7XG4gICAgICAgIGNhc2UgJ2h0bWwnOlxuICAgICAgICAgIC8vIEFkanVzdCBkb2N1bWVudCBsb2NhbGUgaWYgc3BlY2lmaWVkXG4gICAgICAgICAgaWYgKGlzU3RyaW5nKGxhbmcpKSB7XG4gICAgICAgICAgICB1cGRhdGVBdHRyaWJ1dGUodGFnLCAnbGFuZycsIGxhbmcpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChkaXIpIHtcbiAgICAgICAgICAgIHVwZGF0ZUF0dHJpYnV0ZSh0YWcsICdkaXInLCBkaXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnaGVhZCc6XG4gICAgICAgICAgLy8gQmFzZSBocmVmIHNob3VsZCBiZSBhZGRlZCBiZWZvcmUgYW55IGxpbmssIG1ldGEgdGFnc1xuICAgICAgICAgIGlmICghYmFzZVRhZ0V4aXN0cyAmJiBpc1N0cmluZyhiYXNlSHJlZikpIHtcbiAgICAgICAgICAgIHJld3JpdGVyLmVtaXRTdGFydFRhZyh0YWcpO1xuICAgICAgICAgICAgcmV3cml0ZXIuZW1pdFJhdyhgPGJhc2UgaHJlZj1cIiR7YmFzZUhyZWZ9XCI+YCk7XG5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2Jhc2UnOlxuICAgICAgICAgIC8vIEFkanVzdCBiYXNlIGhyZWYgaWYgc3BlY2lmaWVkXG4gICAgICAgICAgaWYgKGlzU3RyaW5nKGJhc2VIcmVmKSkge1xuICAgICAgICAgICAgdXBkYXRlQXR0cmlidXRlKHRhZywgJ2hyZWYnLCBiYXNlSHJlZik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdsaW5rJzpcbiAgICAgICAgICBpZiAocmVhZEF0dHJpYnV0ZSh0YWcsICdyZWwnKSA9PT0gJ3ByZWNvbm5lY3QnKSB7XG4gICAgICAgICAgICBjb25zdCBocmVmID0gcmVhZEF0dHJpYnV0ZSh0YWcsICdocmVmJyk7XG4gICAgICAgICAgICBpZiAoaHJlZikge1xuICAgICAgICAgICAgICBmb3VuZFByZWNvbm5lY3RzLmFkZChocmVmKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJld3JpdGVyLmVtaXRTdGFydFRhZyh0YWcpO1xuICAgIH0pXG4gICAgLm9uKCdlbmRUYWcnLCAodGFnKSA9PiB7XG4gICAgICBzd2l0Y2ggKHRhZy50YWdOYW1lKSB7XG4gICAgICAgIGNhc2UgJ2hlYWQnOlxuICAgICAgICAgIGZvciAoY29uc3QgbGlua1RhZyBvZiBsaW5rVGFncykge1xuICAgICAgICAgICAgcmV3cml0ZXIuZW1pdFJhdyhsaW5rVGFnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGltYWdlRG9tYWlucykge1xuICAgICAgICAgICAgZm9yIChjb25zdCBpbWFnZURvbWFpbiBvZiBpbWFnZURvbWFpbnMpIHtcbiAgICAgICAgICAgICAgaWYgKCFmb3VuZFByZWNvbm5lY3RzLmhhcyhpbWFnZURvbWFpbikpIHtcbiAgICAgICAgICAgICAgICByZXdyaXRlci5lbWl0UmF3KGA8bGluayByZWw9XCJwcmVjb25uZWN0XCIgaHJlZj1cIiR7aW1hZ2VEb21haW59XCIgZGF0YS1uZ2ltZz5gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBsaW5rVGFncyA9IFtdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdib2R5JzpcbiAgICAgICAgICAvLyBBZGQgc2NyaXB0IHRhZ3NcbiAgICAgICAgICBmb3IgKGNvbnN0IHNjcmlwdFRhZyBvZiBzY3JpcHRUYWdzKSB7XG4gICAgICAgICAgICByZXdyaXRlci5lbWl0UmF3KHNjcmlwdFRhZyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc2NyaXB0VGFncyA9IFtdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICByZXdyaXRlci5lbWl0RW5kVGFnKHRhZyk7XG4gICAgfSk7XG5cbiAgY29uc3QgY29udGVudCA9IGF3YWl0IHRyYW5zZm9ybWVkQ29udGVudCgpO1xuXG4gIHJldHVybiB7XG4gICAgY29udGVudDpcbiAgICAgIGxpbmtUYWdzLmxlbmd0aCB8fCBzY3JpcHRUYWdzLmxlbmd0aFxuICAgICAgICA/IC8vIEluIGNhc2Ugbm8gYm9keS9oZWFkIHRhZ3MgYXJlIG5vdCBwcmVzZW50IChkb3RuZXQgcGFydGlhbCB0ZW1wbGF0ZXMpXG4gICAgICAgICAgbGlua1RhZ3Muam9pbignJykgKyBzY3JpcHRUYWdzLmpvaW4oJycpICsgY29udGVudFxuICAgICAgICA6IGNvbnRlbnQsXG4gICAgd2FybmluZ3MsXG4gICAgZXJyb3JzLFxuICB9O1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZVNyaUF0dHJpYnV0ZXMoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgYWxnbyA9ICdzaGEzODQnO1xuICBjb25zdCBoYXNoID0gY3JlYXRlSGFzaChhbGdvKS51cGRhdGUoY29udGVudCwgJ3V0ZjgnKS5kaWdlc3QoJ2Jhc2U2NCcpO1xuXG4gIHJldHVybiBgaW50ZWdyaXR5PVwiJHthbGdvfS0ke2hhc2h9XCJgO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVBdHRyaWJ1dGUoXG4gIHRhZzogeyBhdHRyczogeyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfVtdIH0sXG4gIG5hbWU6IHN0cmluZyxcbiAgdmFsdWU6IHN0cmluZyxcbik6IHZvaWQge1xuICBjb25zdCBpbmRleCA9IHRhZy5hdHRycy5maW5kSW5kZXgoKGEpID0+IGEubmFtZSA9PT0gbmFtZSk7XG4gIGNvbnN0IG5ld1ZhbHVlID0geyBuYW1lLCB2YWx1ZSB9O1xuXG4gIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICB0YWcuYXR0cnMucHVzaChuZXdWYWx1ZSk7XG4gIH0gZWxzZSB7XG4gICAgdGFnLmF0dHJzW2luZGV4XSA9IG5ld1ZhbHVlO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlYWRBdHRyaWJ1dGUoXG4gIHRhZzogeyBhdHRyczogeyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfVtdIH0sXG4gIG5hbWU6IHN0cmluZyxcbik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IHRhcmdldEF0dHIgPSB0YWcuYXR0cnMuZmluZCgoYXR0cikgPT4gYXR0ci5uYW1lID09PSBuYW1lKTtcblxuICByZXR1cm4gdGFyZ2V0QXR0ciA/IHRhcmdldEF0dHIudmFsdWUgOiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGlzU3RyaW5nKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgc3RyaW5nIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZyc7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldExhbmd1YWdlRGlyZWN0aW9uKFxuICBsb2NhbGU6IHN0cmluZyxcbiAgd2FybmluZ3M6IHN0cmluZ1tdLFxuKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgY29uc3QgZGlyID0gYXdhaXQgZ2V0TGFuZ3VhZ2VEaXJlY3Rpb25Gcm9tTG9jYWxlcyhsb2NhbGUpO1xuXG4gIGlmICghZGlyKSB7XG4gICAgd2FybmluZ3MucHVzaChcbiAgICAgIGBMb2NhbGUgZGF0YSBmb3IgJyR7bG9jYWxlfScgY2Fubm90IGJlIGZvdW5kLiAnZGlyJyBhdHRyaWJ1dGUgd2lsbCBub3QgYmUgc2V0IGZvciB0aGlzIGxvY2FsZS5gLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gZGlyO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRMYW5ndWFnZURpcmVjdGlvbkZyb21Mb2NhbGVzKGxvY2FsZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBsb2NhbGVEYXRhID0gKFxuICAgICAgYXdhaXQgbG9hZEVzbU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAYW5ndWxhci9jb21tb24vbG9jYWxlcy9lbicpPihcbiAgICAgICAgYEBhbmd1bGFyL2NvbW1vbi9sb2NhbGVzLyR7bG9jYWxlfWAsXG4gICAgICApXG4gICAgKS5kZWZhdWx0O1xuXG4gICAgY29uc3QgZGlyID0gbG9jYWxlRGF0YVtsb2NhbGVEYXRhLmxlbmd0aCAtIDJdO1xuXG4gICAgcmV0dXJuIGlzU3RyaW5nKGRpcikgPyBkaXIgOiB1bmRlZmluZWQ7XG4gIH0gY2F0Y2gge1xuICAgIC8vIEluIHNvbWUgY2FzZXMgY2VydGFpbiBsb2NhbGVzIG1pZ2h0IG1hcCB0byBmaWxlcyB3aGljaCBhcmUgbmFtZWQgb25seSB3aXRoIGxhbmd1YWdlIGlkLlxuICAgIC8vIEV4YW1wbGU6IGBlbi1VU2AgLT4gYGVuYC5cbiAgICBjb25zdCBbbGFuZ3VhZ2VJZF0gPSBsb2NhbGUuc3BsaXQoJy0nLCAxKTtcbiAgICBpZiAobGFuZ3VhZ2VJZCAhPT0gbG9jYWxlKSB7XG4gICAgICByZXR1cm4gZ2V0TGFuZ3VhZ2VEaXJlY3Rpb25Gcm9tTG9jYWxlcyhsYW5ndWFnZUlkKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuIl19