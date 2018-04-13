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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgtaHRtbC13ZWJwYWNrLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvcGx1Z2lucy9pbmRleC1odG1sLXdlYnBhY2stcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBaUI7QUFDakIsK0RBQStEOzs7Ozs7Ozs7O0FBRS9EOzs7Ozs7R0FNRztBQUVILHFEQUE0QztBQUU1QyxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFVakMsa0JBQWtCLFFBQWdCLEVBQUUsV0FBZ0I7SUFDbEQsTUFBTSxDQUFDLElBQUksT0FBTyxDQUFTLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQzdDLFdBQVcsQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDLEdBQVUsRUFBRSxJQUFZLEVBQUUsRUFBRTtZQUMxRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNSLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDWixNQUFNLENBQUM7WUFDVCxDQUFDO1lBRUQsSUFBSSxPQUFPLENBQUM7WUFDWixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ2pGLGtCQUFrQjtnQkFDbEIsT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3JDLENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxD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QztvQkFDL0MsQ0FBQztvQkFBQyxJQUFJLENBQUMsQ0FBQzt3QkFDTixXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztvQkFDMUUsQ0FBQztnQkFDSCxDQUFDO1lBQ0gsQ0FBQztZQUVELEdBQUcsQ0FBQyxDQUFDLE1BQU0sVUFBVSxJQUFJLFdBQVcsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JDLE1BQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxhQUFhLENBQ3ZDLE1BQU0sRUFDTixTQUFTLEVBQ1Q7b0JBQ0UsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUU7b0JBQ3BDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsR0FBRyxVQUFVLEVBQUU7aUJBQ3RFLENBQ0YsQ0FBQztnQkFDRixXQUFXLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUNoRCxDQUFDO1lBRUQsNEJBQTRCO1lBQzVCLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztZQUNsRSxXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSwyQkFBUyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQzFFLENBQUMsQ0FBQSxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFySUQsd0RBcUlDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG4vKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IFJhd1NvdXJjZSB9IGZyb20gJ3dlYnBhY2stc291cmNlcyc7XG5cbmNvbnN0IHBhcnNlNSA9IHJlcXVpcmUoJ3BhcnNlNScpO1xuXG5leHBvcnQgaW50ZXJmYWNlIEluZGV4SHRtbFdlYnBhY2tQbHVnaW5PcHRpb25zIHtcbiAgaW5wdXQ6IHN0cmluZztcbiAgb3V0cHV0OiBzdHJpbmc7XG4gIGJhc2VIcmVmPzogc3RyaW5nO1xuICBlbnRyeXBvaW50czogc3RyaW5nW107XG4gIGRlcGxveVVybD86IHN0cmluZztcbn1cblxuZnVuY3Rpb24gcmVhZEZpbGUoZmlsZW5hbWU6IHN0cmluZywgY29tcGlsYXRpb246IGFueSk6IFByb21pc2U8c3RyaW5nPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb21waWxhdGlvbi5pbnB1dEZpbGVTeXN0ZW0ucmVhZEZpbGUoZmlsZW5hbWUsIChlcnI6IEVycm9yLCBkYXRhOiBCdWZmZXIpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgbGV0IGNvbnRlbnQ7XG4gICAgICBpZiAoZGF0YS5sZW5ndGggPj0gMyAmJiBkYXRhWzBdID09PSAweEVGICYmIGRhdGFbMV0gPT09IDB4QkIgJiYgZGF0YVsyXSA9PT0gMHhCRikge1xuICAgICAgICAvLyBTdHJpcCBVVEYtOCBCT01cbiAgICAgICAgY29udGVudCA9IGRhdGEudG9TdHJpbmcoJ3V0ZjgnLCAzKTtcbiAgICAgIH0gZWxzZSBpZiAoZGF0YS5sZW5ndGggPj0gMiAmJiBkYXRhWzBdID09PSAweEZGICYmIGRhdGFbMV0gPT09IDB4RkUpIHtcbiAgICAgICAgLy8gU3RyaXAgVVRGLTE2IExFIEJPTVxuICAgICAgICBjb250ZW50ID0gZGF0YS50b1N0cmluZygndXRmMTZsZScsIDIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29udGVudCA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgIH1cblxuICAgICAgcmVzb2x2ZShjb250ZW50KTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbmV4cG9ydCBjbGFzcyBJbmRleEh0bWxXZWJwYWNrUGx1Z2luIHtcbiAgcHJpdmF0ZSBfb3B0aW9uczogSW5kZXhIdG1sV2VicGFja1BsdWdpbk9wdGlvbnM7XG5cbiAgY29uc3RydWN0b3Iob3B0aW9ucz86IFBhcnRpYWw8SW5kZXhIdG1sV2VicGFja1BsdWdpbk9wdGlvbnM+KSB7XG4gICAgdGhpcy5fb3B0aW9ucyA9IHtcbiAgICAgIGlucHV0OiAnaW5kZXguaHRtbCcsXG4gICAgICBvdXRwdXQ6ICdpbmRleC5odG1sJyxcbiAgICAgIGVudHJ5cG9pbnRzOiBbJ3BvbHlmaWxscycsICdtYWluJ10sXG4gICAgICAuLi5vcHRpb25zXG4gICAgfTtcbiAgfVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBhbnkpIHtcbiAgICBjb21waWxlci5ob29rcy5lbWl0LnRhcFByb21pc2UoJ2luZGV4LWh0bWwtd2VicGFjay1wbHVnaW4nLCBhc3luYyAoY29tcGlsYXRpb246IGFueSkgPT4ge1xuICAgICAgLy8gR2V0IGlucHV0IGh0bWwgZmlsZVxuICAgICAgY29uc3QgaW5wdXRDb250ZW50ID0gYXdhaXQgcmVhZEZpbGUodGhpcy5fb3B0aW9ucy5pbnB1dCwgY29tcGlsYXRpb24pO1xuICAgICAgY29tcGlsYXRpb24uZmlsZURlcGVuZGVuY2llcy5hZGQodGhpcy5fb3B0aW9ucy5pbnB1dCk7XG5cblxuICAgICAgLy8gR2V0IGFsbCBmaWxlcyBmb3Igc2VsZWN0ZWQgZW50cnlwb2ludHNcbiAgICAgIGNvbnN0IHVuZmlsdGVyZWRTb3J0ZWRGaWxlczogc3RyaW5nW10gPSBbXTtcbiAgICAgIGZvciAoY29uc3QgZW50cnlOYW1lIG9mIHRoaXMuX29wdGlvbnMuZW50cnlwb2ludHMpIHtcbiAgICAgICAgY29uc3QgZW50cnlwb2ludCA9IGNvbXBpbGF0aW9uLmVudHJ5cG9pbnRzLmdldChlbnRyeU5hbWUpO1xuICAgICAgICBpZiAoZW50cnlwb2ludCkge1xuICAgICAgICAgIHVuZmlsdGVyZWRTb3J0ZWRGaWxlcy5wdXNoKC4uLmVudHJ5cG9pbnQuZ2V0RmlsZXMoKSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gRmlsdGVyIGZpbGVzXG4gICAgICBjb25zdCBleGlzdGluZ0ZpbGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICBjb25zdCBzdHlsZXNoZWV0czogc3RyaW5nW10gPSBbXTtcbiAgICAgIGNvbnN0IHNjcmlwdHM6IHN0cmluZ1tdID0gW107XG4gICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgdW5maWx0ZXJlZFNvcnRlZEZpbGVzKSB7XG4gICAgICAgIGlmIChleGlzdGluZ0ZpbGVzLmhhcyhmaWxlKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGV4aXN0aW5nRmlsZXMuYWRkKGZpbGUpO1xuXG4gICAgICAgIGlmIChmaWxlLmVuZHNXaXRoKCcuanMnKSkge1xuICAgICAgICAgIHNjcmlwdHMucHVzaChmaWxlKTtcbiAgICAgICAgfSBlbHNlIGlmIChmaWxlLmVuZHNXaXRoKCcuY3NzJykpIHtcbiAgICAgICAgICBzdHlsZXNoZWV0cy5wdXNoKGZpbGUpO1xuICAgICAgICB9XG5cbiAgICAgIH1cblxuICAgICAgLy8gRmluZCB0aGUgaGVhZCBhbmQgYm9keSBlbGVtZW50c1xuICAgICAgY29uc3QgdHJlZUFkYXB0ZXIgPSBwYXJzZTUudHJlZUFkYXB0ZXJzLmRlZmF1bHQ7XG4gICAgICBjb25zdCBkb2N1bWVudCA9IHBhcnNlNS5wYXJzZShpbnB1dENvbnRlbnQsIHsgdHJlZUFkYXB0ZXIgfSk7XG4gICAgICBsZXQgaGVhZEVsZW1lbnQ7XG4gICAgICBsZXQgYm9keUVsZW1lbnQ7XG4gICAgICBmb3IgKGNvbnN0IHRvcE5vZGUgb2YgZG9jdW1lbnQuY2hpbGROb2Rlcykge1xuICAgICAgICBpZiAodG9wTm9kZS50YWdOYW1lID09PSAnaHRtbCcpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGh0bWxOb2RlIG9mIHRvcE5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKGh0bWxOb2RlLnRhZ05hbWUgPT09ICdoZWFkJykge1xuICAgICAgICAgICAgICBoZWFkRWxlbWVudCA9IGh0bWxOb2RlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGh0bWxOb2RlLnRhZ05hbWUgPT09ICdib2R5Jykge1xuICAgICAgICAgICAgICBib2R5RWxlbWVudCA9IGh0bWxOb2RlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBJbmplY3QgaW50byB0aGUgaHRtbFxuXG4gICAgICBpZiAoIWhlYWRFbGVtZW50IHx8ICFib2R5RWxlbWVudCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NpbmcgaGVhZCBhbmQvb3IgYm9keSBlbGVtZW50cycpO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IHNjcmlwdCBvZiBzY3JpcHRzKSB7XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0cmVlQWRhcHRlci5jcmVhdGVFbGVtZW50KFxuICAgICAgICAgICdzY3JpcHQnLFxuICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICBbXG4gICAgICAgICAgICB7IG5hbWU6ICd0eXBlJywgdmFsdWU6ICd0ZXh0L2phdmFzY3JpcHQnIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdzcmMnLCB2YWx1ZTogKHRoaXMuX29wdGlvbnMuZGVwbG95VXJsIHx8ICcnKSArIHNjcmlwdCB9LFxuICAgICAgICAgIF1cbiAgICAgICAgKTtcbiAgICAgICAgdHJlZUFkYXB0ZXIuYXBwZW5kQ2hpbGQoYm9keUVsZW1lbnQsIGVsZW1lbnQpO1xuICAgICAgfVxuXG4gICAgICAvLyBBZGp1c3QgYmFzZSBocmVmIGlmIHNwZWNpZmllZFxuICAgICAgaWYgKHRoaXMuX29wdGlvbnMuYmFzZUhyZWYgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGxldCBiYXNlRWxlbWVudDtcbiAgICAgICAgZm9yIChjb25zdCBub2RlIG9mIGhlYWRFbGVtZW50LmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICBpZiAobm9kZS50YWdOYW1lID09PSAnYmFzZScpIHtcbiAgICAgICAgICAgIGJhc2VFbGVtZW50ID0gbm9kZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghYmFzZUVsZW1lbnQpIHtcbiAgICAgICAgICBjb25zdCBlbGVtZW50ID0gdHJlZUFkYXB0ZXIuY3JlYXRlRWxlbWVudChcbiAgICAgICAgICAgICdiYXNlJyxcbiAgICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgeyBuYW1lOiAnaHJlZicsIHZhbHVlOiB0aGlzLl9vcHRpb25zLmJhc2VIcmVmIH0sXG4gICAgICAgICAgICBdXG4gICAgICAgICAgKTtcbiAgICAgICAgICB0cmVlQWRhcHRlci5hcHBlbmRDaGlsZChoZWFkRWxlbWVudCwgZWxlbWVudCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGhyZWZBdHRyaWJ1dGU7XG4gICAgICAgICAgZm9yIChjb25zdCBhdHRyaWJ1dGUgb2YgYmFzZUVsZW1lbnQuYXR0cnMpIHtcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGUubmFtZSA9PT0gJ2hyZWYnKSB7XG4gICAgICAgICAgICAgIGhyZWZBdHRyaWJ1dGUgPSBhdHRyaWJ1dGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChocmVmQXR0cmlidXRlKSB7XG4gICAgICAgICAgICBocmVmQXR0cmlidXRlLnZhbHVlID0gdGhpcy5fb3B0aW9ucy5iYXNlSHJlZjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYmFzZUVsZW1lbnQuYXR0cnMucHVzaCh7IG5hbWU6ICdocmVmJywgdmFsdWU6IHRoaXMuX29wdGlvbnMuYmFzZUhyZWYgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAoY29uc3Qgc3R5bGVzaGVldCBvZiBzdHlsZXNoZWV0cykge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gdHJlZUFkYXB0ZXIuY3JlYXRlRWxlbWVudChcbiAgICAgICAgICAnbGluaycsXG4gICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgIFtcbiAgICAgICAgICAgIHsgbmFtZTogJ3JlbCcsIHZhbHVlOiAnc3R5bGVzaGVldCcgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ2hyZWYnLCB2YWx1ZTogKHRoaXMuX29wdGlvbnMuZGVwbG95VXJsIHx8ICcnKSArIHN0eWxlc2hlZXQgfSxcbiAgICAgICAgICBdXG4gICAgICAgICk7XG4gICAgICAgIHRyZWVBZGFwdGVyLmFwcGVuZENoaWxkKGhlYWRFbGVtZW50LCBlbGVtZW50KTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIHRvIGNvbXBpbGF0aW9uIGFzc2V0c1xuICAgICAgY29uc3Qgb3V0cHV0Q29udGVudCA9IHBhcnNlNS5zZXJpYWxpemUoZG9jdW1lbnQsIHsgdHJlZUFkYXB0ZXIgfSk7XG4gICAgICBjb21waWxhdGlvbi5hc3NldHNbdGhpcy5fb3B0aW9ucy5vdXRwdXRdID0gbmV3IFJhd1NvdXJjZShvdXRwdXRDb250ZW50KTtcbiAgICB9KTtcbiAgfVxufVxuIl19