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
exports.htmlRewritingStream = void 0;
const stream_1 = require("stream");
async function htmlRewritingStream(content) {
    const chunks = [];
    const rewriter = new (await Promise.resolve().then(() => __importStar(require('parse5-html-rewriting-stream')))).default();
    return {
        rewriter,
        transformedContent: new Promise((resolve) => {
            new stream_1.Readable({
                encoding: 'utf8',
                read() {
                    this.push(Buffer.from(content));
                    this.push(null);
                },
            })
                .pipe(rewriter)
                .pipe(new stream_1.Writable({
                write(chunk, encoding, callback) {
                    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, encoding) : chunk);
                    callback();
                },
                final(callback) {
                    callback();
                    resolve(Buffer.concat(chunks).toString());
                },
            }));
        }),
    };
}
exports.htmlRewritingStream = htmlRewritingStream;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHRtbC1yZXdyaXRpbmctc3RyZWFtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvaW5kZXgtZmlsZS9odG1sLXJld3JpdGluZy1zdHJlYW0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxtQ0FBNEM7QUFFckMsS0FBSyxVQUFVLG1CQUFtQixDQUFDLE9BQWU7SUFJdkQsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO0lBQzVCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyx3REFBYSw4QkFBOEIsR0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7SUFFOUUsT0FBTztRQUNMLFFBQVE7UUFDUixrQkFBa0IsRUFBRSxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO1lBQzFDLElBQUksaUJBQVEsQ0FBQztnQkFDWCxRQUFRLEVBQUUsTUFBTTtnQkFDaEIsSUFBSTtvQkFDRixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztvQkFDaEMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbEIsQ0FBQzthQUNGLENBQUM7aUJBQ0MsSUFBSSxDQUFDLFFBQVEsQ0FBQztpQkFDZCxJQUFJLENBQ0gsSUFBSSxpQkFBUSxDQUFDO2dCQUNYLEtBQUssQ0FBQyxLQUFzQixFQUFFLFFBQTRCLEVBQUUsUUFBa0I7b0JBQzVFLE1BQU0sQ0FBQyxJQUFJLENBQ1QsT0FBTyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxRQUEwQixDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FDbkYsQ0FBQztvQkFDRixRQUFRLEVBQUUsQ0FBQztnQkFDYixDQUFDO2dCQUNELEtBQUssQ0FBQyxRQUFpQztvQkFDckMsUUFBUSxFQUFFLENBQUM7b0JBQ1gsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztnQkFDNUMsQ0FBQzthQUNGLENBQUMsQ0FDSCxDQUFDO1FBQ04sQ0FBQyxDQUFDO0tBQ0gsQ0FBQztBQUNKLENBQUM7QUFsQ0Qsa0RBa0NDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IFJlYWRhYmxlLCBXcml0YWJsZSB9IGZyb20gJ3N0cmVhbSc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBodG1sUmV3cml0aW5nU3RyZWFtKGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8e1xuICByZXdyaXRlcjogaW1wb3J0KCdwYXJzZTUtaHRtbC1yZXdyaXRpbmctc3RyZWFtJyk7XG4gIHRyYW5zZm9ybWVkQ29udGVudDogUHJvbWlzZTxzdHJpbmc+O1xufT4ge1xuICBjb25zdCBjaHVua3M6IEJ1ZmZlcltdID0gW107XG4gIGNvbnN0IHJld3JpdGVyID0gbmV3IChhd2FpdCBpbXBvcnQoJ3BhcnNlNS1odG1sLXJld3JpdGluZy1zdHJlYW0nKSkuZGVmYXVsdCgpO1xuXG4gIHJldHVybiB7XG4gICAgcmV3cml0ZXIsXG4gICAgdHJhbnNmb3JtZWRDb250ZW50OiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgbmV3IFJlYWRhYmxlKHtcbiAgICAgICAgZW5jb2Rpbmc6ICd1dGY4JyxcbiAgICAgICAgcmVhZCgpOiB2b2lkIHtcbiAgICAgICAgICB0aGlzLnB1c2goQnVmZmVyLmZyb20oY29udGVudCkpO1xuICAgICAgICAgIHRoaXMucHVzaChudWxsKTtcbiAgICAgICAgfSxcbiAgICAgIH0pXG4gICAgICAgIC5waXBlKHJld3JpdGVyKVxuICAgICAgICAucGlwZShcbiAgICAgICAgICBuZXcgV3JpdGFibGUoe1xuICAgICAgICAgICAgd3JpdGUoY2h1bms6IHN0cmluZyB8IEJ1ZmZlciwgZW5jb2Rpbmc6IHN0cmluZyB8IHVuZGVmaW5lZCwgY2FsbGJhY2s6IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgICAgICAgICAgIGNodW5rcy5wdXNoKFxuICAgICAgICAgICAgICAgIHR5cGVvZiBjaHVuayA9PT0gJ3N0cmluZycgPyBCdWZmZXIuZnJvbShjaHVuaywgZW5jb2RpbmcgYXMgQnVmZmVyRW5jb2RpbmcpIDogY2h1bmssXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZmluYWwoY2FsbGJhY2s6IChlcnJvcj86IEVycm9yKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgIHJlc29sdmUoQnVmZmVyLmNvbmNhdChjaHVua3MpLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgKTtcbiAgICB9KSxcbiAgfTtcbn1cbiJdfQ==