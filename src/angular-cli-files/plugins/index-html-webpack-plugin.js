"use strict";
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const webpack_sources_1 = require("webpack-sources");
const parse5 = require('parse5');
function readFile(filename, compilation) {
    return new Promise((resolve, reject) => {
        compilation.inputFileSystem.readFile(filename, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            const content = data.toString();
            resolve(content);
        });
    });
}
class IndexHtmlWebpackPlugin {
    constructor(options) {
        this._options = Object.assign({ input: 'index.html', output: 'index.html', entrypoints: ['polyfills', 'main'] }, options);
    }
    apply(compiler) {
        compiler.hooks.emit.tapPromise('index-html-webpack-plugin', (compilation) => __awaiter(this, void 0, void 0, function* () {
            // Get input html file
            const inputContent = yield readFile(this._options.input, compilation);
            compilation.fileDependencies.add(this._options.input);
            // Get all files for selected entrypoints
            const unfilteredSortedFiles = [];
            for (const entryName of this._options.entrypoints) {
                const entrypoint = compilation.entrypoints.get(entryName);
                if (entrypoint) {
                    unfilteredSortedFiles.push(...entrypoint.getFiles());
                }
            }
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
            const document = parse5.parse(inputContent, { treeAdapter });
            let headElement;
            let bodyElement;
            for (const topNode of document.childNodes) {
                if (topNode.tagName === 'html') {
                    for (const htmlNode of topNode.childNodes) {
                        if (htmlNode.tagName === 'head') {
                            headElement = htmlNode;
                        }
                        if (htmlNode.tagName === 'body') {
                            bodyElement = htmlNode;
                        }
                    }
                }
            }
            // Inject into the html
            if (!headElement || !bodyElement) {
                throw new Error('Missing head and/or body elements');
            }
            for (const script of scripts) {
                const element = treeAdapter.createElement('script', undefined, [
                    { name: 'type', value: 'text/javascript' },
                    { name: 'src', value: (this._options.deployUrl || '') + script },
                ]);
                treeAdapter.appendChild(bodyElement, element);
            }
            // Adjust base href if specified
            if (this._options.baseHref != undefined) {
                let baseElement;
                for (const node of headElement.childNodes) {
                    if (node.tagName === 'base') {
                        baseElement = node;
                        break;
                    }
                }
                if (!baseElement) {
                    const element = treeAdapter.createElement('base', undefined, [
                        { name: 'href', value: this._options.baseHref },
                    ]);
                    treeAdapter.appendChild(headElement, element);
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
                }
            }
            for (const stylesheet of stylesheets) {
                const element = treeAdapter.createElement('link', undefined, [
                    { name: 'rel', value: 'stylesheet' },
                    { name: 'href', value: (this._options.deployUrl || '') + stylesheet },
                ]);
                treeAdapter.appendChild(headElement, element);
            }
            // Add to compilation assets
            const outputContent = parse5.serialize(document, { treeAdapter });
            compilation.assets[this._options.output] = new webpack_sources_1.RawSource(outputContent);
        }));
    }
}
exports.IndexHtmlWebpackPlugin = IndexHtmlWebpackPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgtaHRtbC13ZWJwYWNrLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvcGx1Z2lucy9pbmRleC1odG1sLXdlYnBhY2stcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBaUI7QUFDakIsK0RBQStEOzs7Ozs7Ozs7O0FBRS9EOzs7Ozs7R0FNRztBQUVILHFEQUE0QztBQUU1QyxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFVakMsa0JBQWtCLFFBQWdCLEVBQUUsV0FBZ0I7SUFDbEQsTUFBTSxDQUFDLElBQUksT0FBTyxDQUFTLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQzdDLFdBQVcsQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDLEdBQVUsRUFBRSxJQUFZLEVBQUUsRUFBRTtZQUMxRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNSLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDWixNQUFNLENBQUM7WUFDVCxDQUFDO1lBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2hDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNuQixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVEO0lBR0UsWUFBWSxPQUFnRDtRQUMxRCxJQUFJLENBQUMsUUFBUSxtQkFDWCxLQUFLLEVBQUUsWUFBWSxFQUNuQixNQUFNLEVBQUUsWUFBWSxFQUNwQixXQUFXLEVBQUUsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLElBQy9CLE9BQU8sQ0FDWCxDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFhO1FBQ2pCLFFBQVEsQ0FBQyxLQUFL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QUFDO1lBRUQsNEJBQTRCO1lBQzVCLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztZQUNsRSxXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSwyQkFBUyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQzFFLENBQUMsQ0FBQSxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFySUQsd0RBcUlDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG4vKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IFJhd1NvdXJjZSB9IGZyb20gJ3dlYnBhY2stc291cmNlcyc7XG5cbmNvbnN0IHBhcnNlNSA9IHJlcXVpcmUoJ3BhcnNlNScpO1xuXG5leHBvcnQgaW50ZXJmYWNlIEluZGV4SHRtbFdlYnBhY2tQbHVnaW5PcHRpb25zIHtcbiAgaW5wdXQ6IHN0cmluZztcbiAgb3V0cHV0OiBzdHJpbmc7XG4gIGJhc2VIcmVmPzogc3RyaW5nO1xuICBlbnRyeXBvaW50czogc3RyaW5nW107XG4gIGRlcGxveVVybD86IHN0cmluZztcbn1cblxuZnVuY3Rpb24gcmVhZEZpbGUoZmlsZW5hbWU6IHN0cmluZywgY29tcGlsYXRpb246IGFueSk6IFByb21pc2U8c3RyaW5nPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb21waWxhdGlvbi5pbnB1dEZpbGVTeXN0ZW0ucmVhZEZpbGUoZmlsZW5hbWUsIChlcnI6IEVycm9yLCBkYXRhOiBCdWZmZXIpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29udGVudCA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgIHJlc29sdmUoY29udGVudCk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG5leHBvcnQgY2xhc3MgSW5kZXhIdG1sV2VicGFja1BsdWdpbiB7XG4gIHByaXZhdGUgX29wdGlvbnM6IEluZGV4SHRtbFdlYnBhY2tQbHVnaW5PcHRpb25zO1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM/OiBQYXJ0aWFsPEluZGV4SHRtbFdlYnBhY2tQbHVnaW5PcHRpb25zPikge1xuICAgIHRoaXMuX29wdGlvbnMgPSB7XG4gICAgICBpbnB1dDogJ2luZGV4Lmh0bWwnLFxuICAgICAgb3V0cHV0OiAnaW5kZXguaHRtbCcsXG4gICAgICBlbnRyeXBvaW50czogWydwb2x5ZmlsbHMnLCAnbWFpbiddLFxuICAgICAgLi4ub3B0aW9uc1xuICAgIH07XG4gIH1cblxuICBhcHBseShjb21waWxlcjogYW55KSB7XG4gICAgY29tcGlsZXIuaG9va3MuZW1pdC50YXBQcm9taXNlKCdpbmRleC1odG1sLXdlYnBhY2stcGx1Z2luJywgYXN5bmMgKGNvbXBpbGF0aW9uOiBhbnkpID0+IHtcbiAgICAgIC8vIEdldCBpbnB1dCBodG1sIGZpbGVcbiAgICAgIGNvbnN0IGlucHV0Q29udGVudCA9IGF3YWl0IHJlYWRGaWxlKHRoaXMuX29wdGlvbnMuaW5wdXQsIGNvbXBpbGF0aW9uKTtcbiAgICAgIGNvbXBpbGF0aW9uLmZpbGVEZXBlbmRlbmNpZXMuYWRkKHRoaXMuX29wdGlvbnMuaW5wdXQpO1xuXG5cbiAgICAgIC8vIEdldCBhbGwgZmlsZXMgZm9yIHNlbGVjdGVkIGVudHJ5cG9pbnRzXG4gICAgICBjb25zdCB1bmZpbHRlcmVkU29ydGVkRmlsZXM6IHN0cmluZ1tdID0gW107XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5TmFtZSBvZiB0aGlzLl9vcHRpb25zLmVudHJ5cG9pbnRzKSB7XG4gICAgICAgIGNvbnN0IGVudHJ5cG9pbnQgPSBjb21waWxhdGlvbi5lbnRyeXBvaW50cy5nZXQoZW50cnlOYW1lKTtcbiAgICAgICAgaWYgKGVudHJ5cG9pbnQpIHtcbiAgICAgICAgICB1bmZpbHRlcmVkU29ydGVkRmlsZXMucHVzaCguLi5lbnRyeXBvaW50LmdldEZpbGVzKCkpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEZpbHRlciBmaWxlc1xuICAgICAgY29uc3QgZXhpc3RpbmdGaWxlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgY29uc3Qgc3R5bGVzaGVldHM6IHN0cmluZ1tdID0gW107XG4gICAgICBjb25zdCBzY3JpcHRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgZm9yIChjb25zdCBmaWxlIG9mIHVuZmlsdGVyZWRTb3J0ZWRGaWxlcykge1xuICAgICAgICBpZiAoZXhpc3RpbmdGaWxlcy5oYXMoZmlsZSkpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBleGlzdGluZ0ZpbGVzLmFkZChmaWxlKTtcblxuICAgICAgICBpZiAoZmlsZS5lbmRzV2l0aCgnLmpzJykpIHtcbiAgICAgICAgICBzY3JpcHRzLnB1c2goZmlsZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZmlsZS5lbmRzV2l0aCgnLmNzcycpKSB7XG4gICAgICAgICAgc3R5bGVzaGVldHMucHVzaChmaWxlKTtcbiAgICAgICAgfVxuXG4gICAgICB9XG5cbiAgICAgIC8vIEZpbmQgdGhlIGhlYWQgYW5kIGJvZHkgZWxlbWVudHNcbiAgICAgIGNvbnN0IHRyZWVBZGFwdGVyID0gcGFyc2U1LnRyZWVBZGFwdGVycy5kZWZhdWx0O1xuICAgICAgY29uc3QgZG9jdW1lbnQgPSBwYXJzZTUucGFyc2UoaW5wdXRDb250ZW50LCB7IHRyZWVBZGFwdGVyIH0pO1xuICAgICAgbGV0IGhlYWRFbGVtZW50O1xuICAgICAgbGV0IGJvZHlFbGVtZW50O1xuICAgICAgZm9yIChjb25zdCB0b3BOb2RlIG9mIGRvY3VtZW50LmNoaWxkTm9kZXMpIHtcbiAgICAgICAgaWYgKHRvcE5vZGUudGFnTmFtZSA9PT0gJ2h0bWwnKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBodG1sTm9kZSBvZiB0b3BOb2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGlmIChodG1sTm9kZS50YWdOYW1lID09PSAnaGVhZCcpIHtcbiAgICAgICAgICAgICAgaGVhZEVsZW1lbnQgPSBodG1sTm9kZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChodG1sTm9kZS50YWdOYW1lID09PSAnYm9keScpIHtcbiAgICAgICAgICAgICAgYm9keUVsZW1lbnQgPSBodG1sTm9kZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gSW5qZWN0IGludG8gdGhlIGh0bWxcblxuICAgICAgaWYgKCFoZWFkRWxlbWVudCB8fCAhYm9keUVsZW1lbnQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaXNzaW5nIGhlYWQgYW5kL29yIGJvZHkgZWxlbWVudHMnKTtcbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBzY3JpcHQgb2Ygc2NyaXB0cykge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gdHJlZUFkYXB0ZXIuY3JlYXRlRWxlbWVudChcbiAgICAgICAgICAnc2NyaXB0JyxcbiAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgW1xuICAgICAgICAgICAgeyBuYW1lOiAndHlwZScsIHZhbHVlOiAndGV4dC9qYXZhc2NyaXB0JyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnc3JjJywgdmFsdWU6ICh0aGlzLl9vcHRpb25zLmRlcGxveVVybCB8fCAnJykgKyBzY3JpcHQgfSxcbiAgICAgICAgICBdXG4gICAgICAgICk7XG4gICAgICAgIHRyZWVBZGFwdGVyLmFwcGVuZENoaWxkKGJvZHlFbGVtZW50LCBlbGVtZW50KTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRqdXN0IGJhc2UgaHJlZiBpZiBzcGVjaWZpZWRcbiAgICAgIGlmICh0aGlzLl9vcHRpb25zLmJhc2VIcmVmICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBsZXQgYmFzZUVsZW1lbnQ7XG4gICAgICAgIGZvciAoY29uc3Qgbm9kZSBvZiBoZWFkRWxlbWVudC5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgaWYgKG5vZGUudGFnTmFtZSA9PT0gJ2Jhc2UnKSB7XG4gICAgICAgICAgICBiYXNlRWxlbWVudCA9IG5vZGU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWJhc2VFbGVtZW50KSB7XG4gICAgICAgICAgY29uc3QgZWxlbWVudCA9IHRyZWVBZGFwdGVyLmNyZWF0ZUVsZW1lbnQoXG4gICAgICAgICAgICAnYmFzZScsXG4gICAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgIHsgbmFtZTogJ2hyZWYnLCB2YWx1ZTogdGhpcy5fb3B0aW9ucy5iYXNlSHJlZiB9LFxuICAgICAgICAgICAgXVxuICAgICAgICAgICk7XG4gICAgICAgICAgdHJlZUFkYXB0ZXIuYXBwZW5kQ2hpbGQoaGVhZEVsZW1lbnQsIGVsZW1lbnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxldCBocmVmQXR0cmlidXRlO1xuICAgICAgICAgIGZvciAoY29uc3QgYXR0cmlidXRlIG9mIGJhc2VFbGVtZW50LmF0dHJzKSB7XG4gICAgICAgICAgICBpZiAoYXR0cmlidXRlLm5hbWUgPT09ICdocmVmJykge1xuICAgICAgICAgICAgICBocmVmQXR0cmlidXRlID0gYXR0cmlidXRlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaHJlZkF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgaHJlZkF0dHJpYnV0ZS52YWx1ZSA9IHRoaXMuX29wdGlvbnMuYmFzZUhyZWY7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJhc2VFbGVtZW50LmF0dHJzLnB1c2goeyBuYW1lOiAnaHJlZicsIHZhbHVlOiB0aGlzLl9vcHRpb25zLmJhc2VIcmVmIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IHN0eWxlc2hlZXQgb2Ygc3R5bGVzaGVldHMpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHRyZWVBZGFwdGVyLmNyZWF0ZUVsZW1lbnQoXG4gICAgICAgICAgJ2xpbmsnLFxuICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICBbXG4gICAgICAgICAgICB7IG5hbWU6ICdyZWwnLCB2YWx1ZTogJ3N0eWxlc2hlZXQnIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdocmVmJywgdmFsdWU6ICh0aGlzLl9vcHRpb25zLmRlcGxveVVybCB8fCAnJykgKyBzdHlsZXNoZWV0IH0sXG4gICAgICAgICAgXVxuICAgICAgICApO1xuICAgICAgICB0cmVlQWRhcHRlci5hcHBlbmRDaGlsZChoZWFkRWxlbWVudCwgZWxlbWVudCk7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCB0byBjb21waWxhdGlvbiBhc3NldHNcbiAgICAgIGNvbnN0IG91dHB1dENvbnRlbnQgPSBwYXJzZTUuc2VyaWFsaXplKGRvY3VtZW50LCB7IHRyZWVBZGFwdGVyIH0pO1xuICAgICAgY29tcGlsYXRpb24uYXNzZXRzW3RoaXMuX29wdGlvbnMub3V0cHV0XSA9IG5ldyBSYXdTb3VyY2Uob3V0cHV0Q29udGVudCk7XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==