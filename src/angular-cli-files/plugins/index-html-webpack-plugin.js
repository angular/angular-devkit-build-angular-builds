"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const crypto_1 = require("crypto");
const webpack_sources_1 = require("webpack-sources");
const parse5 = require('parse5');
function readFile(filename, compilation) {
    return new Promise((resolve, reject) => {
        compilation.inputFileSystem.readFile(filename, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            let content;
            if (data.length >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
                // Strip UTF-8 BOM
                content = data.toString('utf8', 3);
            }
            else if (data.length >= 2 && data[0] === 0xFF && data[1] === 0xFE) {
                // Strip UTF-16 LE BOM
                content = data.toString('utf16le', 2);
            }
            else {
                content = data.toString();
            }
            resolve(content);
        });
    });
}
class IndexHtmlWebpackPlugin {
    constructor(options) {
        this._options = Object.assign({ input: 'index.html', output: 'index.html', entrypoints: ['polyfills', 'main'], noModuleEntrypoints: [], sri: false }, options);
    }
    apply(compiler) {
        compiler.hooks.emit.tapPromise('index-html-webpack-plugin', async (compilation) => {
            // Get input html file
            const inputContent = await readFile(this._options.input, compilation);
            compilation
                .fileDependencies.add(this._options.input);
            // Get all files for selected entrypoints
            const unfilteredSortedFiles = [];
            const noModuleFiles = new Set();
            const otherFiles = new Set();
            for (const entryName of this._options.entrypoints) {
                const entrypoint = compilation.entrypoints.get(entryName);
                if (entrypoint && entrypoint.getFiles) {
                    const files = entrypoint.getFiles() || [];
                    unfilteredSortedFiles.push(...files);
                    if (this._options.noModuleEntrypoints.includes(entryName)) {
                        files.forEach(file => noModuleFiles.add(file));
                    }
                    else {
                        files.forEach(file => otherFiles.add(file));
                    }
                }
            }
            // Clean out files that are used in all types of entrypoints
            otherFiles.forEach(file => noModuleFiles.delete(file));
            // Filter files
            const existingFiles = new Set();
            const stylesheets = [];
            const scripts = [];
            for (const file of unfilteredSortedFiles) {
                if (existingFiles.has(file)) {
                    continue;
                }
                existingFiles.add(file);
                if (file.endsWith('.js')) {
                    scripts.push(file);
                }
                else if (file.endsWith('.css')) {
                    stylesheets.push(file);
                }
            }
            // Find the head and body elements
            const treeAdapter = parse5.treeAdapters.default;
            const document = parse5.parse(inputContent, { treeAdapter, locationInfo: true });
            let headElement;
            let bodyElement;
            for (const docChild of document.childNodes) {
                if (docChild.tagName === 'html') {
                    for (const htmlChild of docChild.childNodes) {
                        if (htmlChild.tagName === 'head') {
                            headElement = htmlChild;
                        }
                        if (htmlChild.tagName === 'body') {
                            bodyElement = htmlChild;
                        }
                    }
                }
            }
            if (!headElement || !bodyElement) {
                throw new Error('Missing head and/or body elements');
            }
            // Determine script insertion point
            let scriptInsertionPoint;
            if (bodyElement.__location && bodyElement.__location.endTag) {
                scriptInsertionPoint = bodyElement.__location.endTag.startOffset;
            }
            else {
                // Less accurate fallback
                // parse5 4.x does not provide locations if malformed html is present
                scriptInsertionPoint = inputContent.indexOf('</body>');
            }
            let styleInsertionPoint;
            if (headElement.__location && headElement.__location.endTag) {
                styleInsertionPoint = headElement.__location.endTag.startOffset;
            }
            else {
                // Less accurate fallback
                // parse5 4.x does not provide locations if malformed html is present
                styleInsertionPoint = inputContent.indexOf('</head>');
            }
            // Inject into the html
            const indexSource = new webpack_sources_1.ReplaceSource(new webpack_sources_1.RawSource(inputContent), this._options.input);
            let scriptElements = '';
            for (const script of scripts) {
                const attrs = [
                    { name: 'src', value: (this._options.deployUrl || '') + script },
                ];
                if (noModuleFiles.has(script)) {
                    attrs.push({ name: 'nomodule', value: null });
                }
                if (this._options.sri) {
                    const content = compilation.assets[script].source();
                    attrs.push(...this._generateSriAttributes(content));
                }
                const attributes = attrs
                    .map(attr => attr.value === null ? attr.name : `${attr.name}="${attr.value}"`)
                    .join(' ');
                scriptElements += `<script ${attributes}></script>`;
            }
            indexSource.insert(scriptInsertionPoint, scriptElements);
            // Adjust base href if specified
            if (typeof this._options.baseHref == 'string') {
                let baseElement;
                for (const headChild of headElement.childNodes) {
                    if (headChild.tagName === 'base') {
                        baseElement = headChild;
                    }
                }
                const baseFragment = treeAdapter.createDocumentFragment();
                if (!baseElement) {
                    baseElement = treeAdapter.createElement('base', undefined, [
                        { name: 'href', value: this._options.baseHref },
                    ]);
                    treeAdapter.appendChild(baseFragment, baseElement);
                    indexSource.insert(headElement.__location.startTag.endOffset + 1, parse5.serialize(baseFragment, { treeAdapter }));
                }
                else {
                    let hrefAttribute;
                    for (const attribute of baseElement.attrs) {
                        if (attribute.name === 'href') {
                            hrefAttribute = attribute;
                        }
                    }
                    if (hrefAttribute) {
                        hrefAttribute.value = this._options.baseHref;
                    }
                    else {
                        baseElement.attrs.push({ name: 'href', value: this._options.baseHref });
                    }
                    treeAdapter.appendChild(baseFragment, baseElement);
                    indexSource.replace(baseElement.__location.startOffset, baseElement.__location.endOffset, parse5.serialize(baseFragment, { treeAdapter }));
                }
            }
            const styleElements = treeAdapter.createDocumentFragment();
            for (const stylesheet of stylesheets) {
                const attrs = [
                    { name: 'rel', value: 'stylesheet' },
                    { name: 'href', value: (this._options.deployUrl || '') + stylesheet },
                ];
                if (this._options.sri) {
                    const content = compilation.assets[stylesheet].source();
                    attrs.push(...this._generateSriAttributes(content));
                }
                const element = treeAdapter.createElement('link', undefined, attrs);
                treeAdapter.appendChild(styleElements, element);
            }
            indexSource.insert(styleInsertionPoint, parse5.serialize(styleElements, { treeAdapter }));
            // Add to compilation assets
            compilation.assets[this._options.output] = indexSource;
        });
    }
    _generateSriAttributes(content) {
        const algo = 'sha384';
        const hash = crypto_1.createHash(algo)
            .update(content, 'utf8')
            .digest('base64');
        return [
            { name: 'integrity', value: `${algo}-${hash}` },
            { name: 'crossorigin', value: 'anonymous' },
        ];
    }
}
exports.IndexHtmlWebpackPlugin = IndexHtmlWebpackPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgtaHRtbC13ZWJwYWNrLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvcGx1Z2lucy9pbmRleC1odG1sLXdlYnBhY2stcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsbUNBQW9DO0FBRXBDLHFEQUEyRDtBQUUzRCxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFZakMsU0FBUyxRQUFRLENBQUMsUUFBZ0IsRUFBRSxXQUFvQztJQUN0RSxPQUFPLElBQUksT0FBTyxDQUFTLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQzdDLFdBQVcsQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDLEdBQVUsRUFBRSxJQUFZLEVBQUUsRUFBRTtZQUMxRSxJQUFJLEdBQUcsRUFBRTtnQkFDUCxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBRVosT0FBTzthQUNSO1lBRUQsSUFBSSxPQUFPLENBQUM7WUFDWixJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxFQUFFO2dCQUNoRixrQkFBa0I7Z0JBQ2xCLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQzthQUNwQztpQkFBTSxJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksRUFBRTtnQkFDbkUsc0JBQXNC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QztDQUNGO0FBdk5ELHdEQXVOQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IHsgQ29tcGlsZXIsIGNvbXBpbGF0aW9uIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBSYXdTb3VyY2UsIFJlcGxhY2VTb3VyY2UgfSBmcm9tICd3ZWJwYWNrLXNvdXJjZXMnO1xuXG5jb25zdCBwYXJzZTUgPSByZXF1aXJlKCdwYXJzZTUnKTtcblxuZXhwb3J0IGludGVyZmFjZSBJbmRleEh0bWxXZWJwYWNrUGx1Z2luT3B0aW9ucyB7XG4gIGlucHV0OiBzdHJpbmc7XG4gIG91dHB1dDogc3RyaW5nO1xuICBiYXNlSHJlZj86IHN0cmluZztcbiAgZW50cnlwb2ludHM6IHN0cmluZ1tdO1xuICBkZXBsb3lVcmw/OiBzdHJpbmc7XG4gIHNyaTogYm9vbGVhbjtcbiAgbm9Nb2R1bGVFbnRyeXBvaW50czogc3RyaW5nW107XG59XG5cbmZ1bmN0aW9uIHJlYWRGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGNvbXBpbGF0aW9uOiBjb21waWxhdGlvbi5Db21waWxhdGlvbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb21waWxhdGlvbi5pbnB1dEZpbGVTeXN0ZW0ucmVhZEZpbGUoZmlsZW5hbWUsIChlcnI6IEVycm9yLCBkYXRhOiBCdWZmZXIpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsZXQgY29udGVudDtcbiAgICAgIGlmIChkYXRhLmxlbmd0aCA+PSAzICYmIGRhdGFbMF0gPT09IDB4RUYgJiYgZGF0YVsxXSA9PT0gMHhCQiAmJiBkYXRhWzJdID09PSAweEJGKSB7XG4gICAgICAgIC8vIFN0cmlwIFVURi04IEJPTVxuICAgICAgICBjb250ZW50ID0gZGF0YS50b1N0cmluZygndXRmOCcsIDMpO1xuICAgICAgfSBlbHNlIGlmIChkYXRhLmxlbmd0aCA+PSAyICYmIGRhdGFbMF0gPT09IDB4RkYgJiYgZGF0YVsxXSA9PT0gMHhGRSkge1xuICAgICAgICAvLyBTdHJpcCBVVEYtMTYgTEUgQk9NXG4gICAgICAgIGNvbnRlbnQgPSBkYXRhLnRvU3RyaW5nKCd1dGYxNmxlJywgMik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb250ZW50ID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgfVxuXG4gICAgICByZXNvbHZlKGNvbnRlbnQpO1xuICAgIH0pO1xuICB9KTtcbn1cblxuZXhwb3J0IGNsYXNzIEluZGV4SHRtbFdlYnBhY2tQbHVnaW4ge1xuICBwcml2YXRlIF9vcHRpb25zOiBJbmRleEh0bWxXZWJwYWNrUGx1Z2luT3B0aW9ucztcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zPzogUGFydGlhbDxJbmRleEh0bWxXZWJwYWNrUGx1Z2luT3B0aW9ucz4pIHtcbiAgICB0aGlzLl9vcHRpb25zID0ge1xuICAgICAgaW5wdXQ6ICdpbmRleC5odG1sJyxcbiAgICAgIG91dHB1dDogJ2luZGV4Lmh0bWwnLFxuICAgICAgZW50cnlwb2ludHM6IFsncG9seWZpbGxzJywgJ21haW4nXSxcbiAgICAgIG5vTW9kdWxlRW50cnlwb2ludHM6IFtdLFxuICAgICAgc3JpOiBmYWxzZSxcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgfTtcbiAgfVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcikge1xuICAgIGNvbXBpbGVyLmhvb2tzLmVtaXQudGFwUHJvbWlzZSgnaW5kZXgtaHRtbC13ZWJwYWNrLXBsdWdpbicsIGFzeW5jIGNvbXBpbGF0aW9uID0+IHtcbiAgICAgIC8vIEdldCBpbnB1dCBodG1sIGZpbGVcbiAgICAgIGNvbnN0IGlucHV0Q29udGVudCA9IGF3YWl0IHJlYWRGaWxlKHRoaXMuX29wdGlvbnMuaW5wdXQsIGNvbXBpbGF0aW9uKTtcbiAgICAgIChjb21waWxhdGlvbiBhcyBjb21waWxhdGlvbi5Db21waWxhdGlvbiAmIHsgZmlsZURlcGVuZGVuY2llczogU2V0PHN0cmluZz4gfSlcbiAgICAgICAgLmZpbGVEZXBlbmRlbmNpZXMuYWRkKHRoaXMuX29wdGlvbnMuaW5wdXQpO1xuXG5cbiAgICAgIC8vIEdldCBhbGwgZmlsZXMgZm9yIHNlbGVjdGVkIGVudHJ5cG9pbnRzXG4gICAgICBjb25zdCB1bmZpbHRlcmVkU29ydGVkRmlsZXM6IHN0cmluZ1tdID0gW107XG4gICAgICBjb25zdCBub01vZHVsZUZpbGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICBjb25zdCBvdGhlckZpbGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5TmFtZSBvZiB0aGlzLl9vcHRpb25zLmVudHJ5cG9pbnRzKSB7XG4gICAgICAgIGNvbnN0IGVudHJ5cG9pbnQgPSBjb21waWxhdGlvbi5lbnRyeXBvaW50cy5nZXQoZW50cnlOYW1lKTtcbiAgICAgICAgaWYgKGVudHJ5cG9pbnQgJiYgZW50cnlwb2ludC5nZXRGaWxlcykge1xuICAgICAgICAgIGNvbnN0IGZpbGVzOiBzdHJpbmdbXSA9IGVudHJ5cG9pbnQuZ2V0RmlsZXMoKSB8fCBbXTtcbiAgICAgICAgICB1bmZpbHRlcmVkU29ydGVkRmlsZXMucHVzaCguLi5maWxlcyk7XG5cbiAgICAgICAgICBpZiAodGhpcy5fb3B0aW9ucy5ub01vZHVsZUVudHJ5cG9pbnRzLmluY2x1ZGVzKGVudHJ5TmFtZSkpIHtcbiAgICAgICAgICAgIGZpbGVzLmZvckVhY2goZmlsZSA9PiBub01vZHVsZUZpbGVzLmFkZChmaWxlKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZpbGVzLmZvckVhY2goZmlsZSA9PiBvdGhlckZpbGVzLmFkZChmaWxlKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIENsZWFuIG91dCBmaWxlcyB0aGF0IGFyZSB1c2VkIGluIGFsbCB0eXBlcyBvZiBlbnRyeXBvaW50c1xuICAgICAgb3RoZXJGaWxlcy5mb3JFYWNoKGZpbGUgPT4gbm9Nb2R1bGVGaWxlcy5kZWxldGUoZmlsZSkpO1xuXG4gICAgICAvLyBGaWx0ZXIgZmlsZXNcbiAgICAgIGNvbnN0IGV4aXN0aW5nRmlsZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgIGNvbnN0IHN0eWxlc2hlZXRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgY29uc3Qgc2NyaXB0czogc3RyaW5nW10gPSBbXTtcbiAgICAgIGZvciAoY29uc3QgZmlsZSBvZiB1bmZpbHRlcmVkU29ydGVkRmlsZXMpIHtcbiAgICAgICAgaWYgKGV4aXN0aW5nRmlsZXMuaGFzKGZpbGUpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgZXhpc3RpbmdGaWxlcy5hZGQoZmlsZSk7XG5cbiAgICAgICAgaWYgKGZpbGUuZW5kc1dpdGgoJy5qcycpKSB7XG4gICAgICAgICAgc2NyaXB0cy5wdXNoKGZpbGUpO1xuICAgICAgICB9IGVsc2UgaWYgKGZpbGUuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgICAgIHN0eWxlc2hlZXRzLnB1c2goZmlsZSk7XG4gICAgICAgIH1cblxuICAgICAgfVxuXG4gICAgICAvLyBGaW5kIHRoZSBoZWFkIGFuZCBib2R5IGVsZW1lbnRzXG4gICAgICBjb25zdCB0cmVlQWRhcHRlciA9IHBhcnNlNS50cmVlQWRhcHRlcnMuZGVmYXVsdDtcbiAgICAgIGNvbnN0IGRvY3VtZW50ID0gcGFyc2U1LnBhcnNlKGlucHV0Q29udGVudCwgeyB0cmVlQWRhcHRlciwgbG9jYXRpb25JbmZvOiB0cnVlIH0pO1xuICAgICAgbGV0IGhlYWRFbGVtZW50O1xuICAgICAgbGV0IGJvZHlFbGVtZW50O1xuICAgICAgZm9yIChjb25zdCBkb2NDaGlsZCBvZiBkb2N1bWVudC5jaGlsZE5vZGVzKSB7XG4gICAgICAgIGlmIChkb2NDaGlsZC50YWdOYW1lID09PSAnaHRtbCcpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGh0bWxDaGlsZCBvZiBkb2NDaGlsZC5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICBpZiAoaHRtbENoaWxkLnRhZ05hbWUgPT09ICdoZWFkJykge1xuICAgICAgICAgICAgICBoZWFkRWxlbWVudCA9IGh0bWxDaGlsZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChodG1sQ2hpbGQudGFnTmFtZSA9PT0gJ2JvZHknKSB7XG4gICAgICAgICAgICAgIGJvZHlFbGVtZW50ID0gaHRtbENoaWxkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIWhlYWRFbGVtZW50IHx8ICFib2R5RWxlbWVudCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NpbmcgaGVhZCBhbmQvb3IgYm9keSBlbGVtZW50cycpO1xuICAgICAgfVxuXG4gICAgICAvLyBEZXRlcm1pbmUgc2NyaXB0IGluc2VydGlvbiBwb2ludFxuICAgICAgbGV0IHNjcmlwdEluc2VydGlvblBvaW50O1xuICAgICAgaWYgKGJvZHlFbGVtZW50Ll9fbG9jYXRpb24gJiYgYm9keUVsZW1lbnQuX19sb2NhdGlvbi5lbmRUYWcpIHtcbiAgICAgICAgc2NyaXB0SW5zZXJ0aW9uUG9pbnQgPSBib2R5RWxlbWVudC5fX2xvY2F0aW9uLmVuZFRhZy5zdGFydE9mZnNldDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIExlc3MgYWNjdXJhdGUgZmFsbGJhY2tcbiAgICAgICAgLy8gcGFyc2U1IDQueCBkb2VzIG5vdCBwcm92aWRlIGxvY2F0aW9ucyBpZiBtYWxmb3JtZWQgaHRtbCBpcyBwcmVzZW50XG4gICAgICAgIHNjcmlwdEluc2VydGlvblBvaW50ID0gaW5wdXRDb250ZW50LmluZGV4T2YoJzwvYm9keT4nKTtcbiAgICAgIH1cblxuICAgICAgbGV0IHN0eWxlSW5zZXJ0aW9uUG9pbnQ7XG4gICAgICBpZiAoaGVhZEVsZW1lbnQuX19sb2NhdGlvbiAmJiBoZWFkRWxlbWVudC5fX2xvY2F0aW9uLmVuZFRhZykge1xuICAgICAgICBzdHlsZUluc2VydGlvblBvaW50ID0gaGVhZEVsZW1lbnQuX19sb2NhdGlvbi5lbmRUYWcuc3RhcnRPZmZzZXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBMZXNzIGFjY3VyYXRlIGZhbGxiYWNrXG4gICAgICAgIC8vIHBhcnNlNSA0LnggZG9lcyBub3QgcHJvdmlkZSBsb2NhdGlvbnMgaWYgbWFsZm9ybWVkIGh0bWwgaXMgcHJlc2VudFxuICAgICAgICBzdHlsZUluc2VydGlvblBvaW50ID0gaW5wdXRDb250ZW50LmluZGV4T2YoJzwvaGVhZD4nKTtcbiAgICAgIH1cblxuICAgICAgLy8gSW5qZWN0IGludG8gdGhlIGh0bWxcbiAgICAgIGNvbnN0IGluZGV4U291cmNlID0gbmV3IFJlcGxhY2VTb3VyY2UobmV3IFJhd1NvdXJjZShpbnB1dENvbnRlbnQpLCB0aGlzLl9vcHRpb25zLmlucHV0KTtcblxuICAgICAgbGV0IHNjcmlwdEVsZW1lbnRzID0gJyc7XG4gICAgICBmb3IgKGNvbnN0IHNjcmlwdCBvZiBzY3JpcHRzKSB7XG4gICAgICAgIGNvbnN0IGF0dHJzOiB7IG5hbWU6IHN0cmluZywgdmFsdWU6IHN0cmluZyB8IG51bGwgfVtdID0gW1xuICAgICAgICAgIHsgbmFtZTogJ3NyYycsIHZhbHVlOiAodGhpcy5fb3B0aW9ucy5kZXBsb3lVcmwgfHwgJycpICsgc2NyaXB0IH0sXG4gICAgICAgIF07XG5cbiAgICAgICAgaWYgKG5vTW9kdWxlRmlsZXMuaGFzKHNjcmlwdCkpIHtcbiAgICAgICAgICBhdHRycy5wdXNoKHsgbmFtZTogJ25vbW9kdWxlJywgdmFsdWU6IG51bGwgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fb3B0aW9ucy5zcmkpIHtcbiAgICAgICAgICBjb25zdCBjb250ZW50ID0gY29tcGlsYXRpb24uYXNzZXRzW3NjcmlwdF0uc291cmNlKCk7XG4gICAgICAgICAgYXR0cnMucHVzaCguLi50aGlzLl9nZW5lcmF0ZVNyaUF0dHJpYnV0ZXMoY29udGVudCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYXR0cmlidXRlcyA9IGF0dHJzXG4gICAgICAgICAgLm1hcChhdHRyID0+IGF0dHIudmFsdWUgPT09IG51bGwgPyBhdHRyLm5hbWUgOiBgJHthdHRyLm5hbWV9PVwiJHthdHRyLnZhbHVlfVwiYClcbiAgICAgICAgICAuam9pbignICcpO1xuICAgICAgICBzY3JpcHRFbGVtZW50cyArPSBgPHNjcmlwdCAke2F0dHJpYnV0ZXN9Pjwvc2NyaXB0PmA7XG4gICAgICB9XG5cbiAgICAgIGluZGV4U291cmNlLmluc2VydChcbiAgICAgICAgc2NyaXB0SW5zZXJ0aW9uUG9pbnQsXG4gICAgICAgIHNjcmlwdEVsZW1lbnRzLFxuICAgICAgKTtcblxuICAgICAgLy8gQWRqdXN0IGJhc2UgaHJlZiBpZiBzcGVjaWZpZWRcbiAgICAgIGlmICh0eXBlb2YgdGhpcy5fb3B0aW9ucy5iYXNlSHJlZiA9PSAnc3RyaW5nJykge1xuICAgICAgICBsZXQgYmFzZUVsZW1lbnQ7XG4gICAgICAgIGZvciAoY29uc3QgaGVhZENoaWxkIG9mIGhlYWRFbGVtZW50LmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICBpZiAoaGVhZENoaWxkLnRhZ05hbWUgPT09ICdiYXNlJykge1xuICAgICAgICAgICAgYmFzZUVsZW1lbnQgPSBoZWFkQ2hpbGQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYmFzZUZyYWdtZW50ID0gdHJlZUFkYXB0ZXIuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuXG4gICAgICAgIGlmICghYmFzZUVsZW1lbnQpIHtcbiAgICAgICAgICBiYXNlRWxlbWVudCA9IHRyZWVBZGFwdGVyLmNyZWF0ZUVsZW1lbnQoXG4gICAgICAgICAgICAnYmFzZScsXG4gICAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgIHsgbmFtZTogJ2hyZWYnLCB2YWx1ZTogdGhpcy5fb3B0aW9ucy5iYXNlSHJlZiB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgdHJlZUFkYXB0ZXIuYXBwZW5kQ2hpbGQoYmFzZUZyYWdtZW50LCBiYXNlRWxlbWVudCk7XG4gICAgICAgICAgaW5kZXhTb3VyY2UuaW5zZXJ0KFxuICAgICAgICAgICAgaGVhZEVsZW1lbnQuX19sb2NhdGlvbi5zdGFydFRhZy5lbmRPZmZzZXQgKyAxLFxuICAgICAgICAgICAgcGFyc2U1LnNlcmlhbGl6ZShiYXNlRnJhZ21lbnQsIHsgdHJlZUFkYXB0ZXIgfSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaHJlZkF0dHJpYnV0ZTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGF0dHJpYnV0ZSBvZiBiYXNlRWxlbWVudC5hdHRycykge1xuICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZS5uYW1lID09PSAnaHJlZicpIHtcbiAgICAgICAgICAgICAgaHJlZkF0dHJpYnV0ZSA9IGF0dHJpYnV0ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGhyZWZBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIGhyZWZBdHRyaWJ1dGUudmFsdWUgPSB0aGlzLl9vcHRpb25zLmJhc2VIcmVmO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBiYXNlRWxlbWVudC5hdHRycy5wdXNoKHsgbmFtZTogJ2hyZWYnLCB2YWx1ZTogdGhpcy5fb3B0aW9ucy5iYXNlSHJlZiB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0cmVlQWRhcHRlci5hcHBlbmRDaGlsZChiYXNlRnJhZ21lbnQsIGJhc2VFbGVtZW50KTtcbiAgICAgICAgICBpbmRleFNvdXJjZS5yZXBsYWNlKFxuICAgICAgICAgICAgYmFzZUVsZW1lbnQuX19sb2NhdGlvbi5zdGFydE9mZnNldCxcbiAgICAgICAgICAgIGJhc2VFbGVtZW50Ll9fbG9jYXRpb24uZW5kT2Zmc2V0LFxuICAgICAgICAgICAgcGFyc2U1LnNlcmlhbGl6ZShiYXNlRnJhZ21lbnQsIHsgdHJlZUFkYXB0ZXIgfSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBzdHlsZUVsZW1lbnRzID0gdHJlZUFkYXB0ZXIuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgZm9yIChjb25zdCBzdHlsZXNoZWV0IG9mIHN0eWxlc2hlZXRzKSB7XG4gICAgICAgIGNvbnN0IGF0dHJzID0gW1xuICAgICAgICAgIHsgbmFtZTogJ3JlbCcsIHZhbHVlOiAnc3R5bGVzaGVldCcgfSxcbiAgICAgICAgICB7IG5hbWU6ICdocmVmJywgdmFsdWU6ICh0aGlzLl9vcHRpb25zLmRlcGxveVVybCB8fCAnJykgKyBzdHlsZXNoZWV0IH0sXG4gICAgICAgIF07XG5cbiAgICAgICAgaWYgKHRoaXMuX29wdGlvbnMuc3JpKSB7XG4gICAgICAgICAgY29uc3QgY29udGVudCA9IGNvbXBpbGF0aW9uLmFzc2V0c1tzdHlsZXNoZWV0XS5zb3VyY2UoKTtcbiAgICAgICAgICBhdHRycy5wdXNoKC4uLnRoaXMuX2dlbmVyYXRlU3JpQXR0cmlidXRlcyhjb250ZW50KSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBlbGVtZW50ID0gdHJlZUFkYXB0ZXIuY3JlYXRlRWxlbWVudCgnbGluaycsIHVuZGVmaW5lZCwgYXR0cnMpO1xuICAgICAgICB0cmVlQWRhcHRlci5hcHBlbmRDaGlsZChzdHlsZUVsZW1lbnRzLCBlbGVtZW50KTtcbiAgICAgIH1cblxuICAgICAgaW5kZXhTb3VyY2UuaW5zZXJ0KFxuICAgICAgICBzdHlsZUluc2VydGlvblBvaW50LFxuICAgICAgICBwYXJzZTUuc2VyaWFsaXplKHN0eWxlRWxlbWVudHMsIHsgdHJlZUFkYXB0ZXIgfSksXG4gICAgICApO1xuXG4gICAgICAvLyBBZGQgdG8gY29tcGlsYXRpb24gYXNzZXRzXG4gICAgICBjb21waWxhdGlvbi5hc3NldHNbdGhpcy5fb3B0aW9ucy5vdXRwdXRdID0gaW5kZXhTb3VyY2U7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9nZW5lcmF0ZVNyaUF0dHJpYnV0ZXMoY29udGVudDogc3RyaW5nKSB7XG4gICAgY29uc3QgYWxnbyA9ICdzaGEzODQnO1xuICAgIGNvbnN0IGhhc2ggPSBjcmVhdGVIYXNoKGFsZ28pXG4gICAgICAudXBkYXRlKGNvbnRlbnQsICd1dGY4JylcbiAgICAgIC5kaWdlc3QoJ2Jhc2U2NCcpO1xuXG4gICAgcmV0dXJuIFtcbiAgICAgIHsgbmFtZTogJ2ludGVncml0eScsIHZhbHVlOiBgJHthbGdvfS0ke2hhc2h9YCB9LFxuICAgICAgeyBuYW1lOiAnY3Jvc3NvcmlnaW4nLCB2YWx1ZTogJ2Fub255bW91cycgfSxcbiAgICBdO1xuICB9XG59XG4iXX0=