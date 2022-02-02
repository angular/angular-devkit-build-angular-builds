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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHRtbC1yZXdyaXRpbmctc3RyZWFtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvaW5kZXgtZmlsZS9odG1sLXJld3JpdGluZy1zdHJlYW0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILG1DQUE0QztBQUVyQyxLQUFLLFVBQVUsbUJBQW1CLENBQUMsT0FBZTtJQUl2RCxNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFDNUIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLHdEQUFhLDhCQUE4QixHQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUU5RSxPQUFPO1FBQ0wsUUFBUTtRQUNSLGtCQUFrQixFQUFFLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDMUMsSUFBSSxpQkFBUSxDQUFDO2dCQUNYLFFBQVEsRUFBRSxNQUFNO2dCQUNoQixJQUFJO29CQUNGLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUNoQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNsQixDQUFDO2FBQ0YsQ0FBQztpQkFDQyxJQUFJLENBQUMsUUFBUSxDQUFDO2lCQUNkLElBQUksQ0FDSCxJQUFJLGlCQUFRLENBQUM7Z0JBQ1gsS0FBSyxDQUFDLEtBQXNCLEVBQUUsUUFBNEIsRUFBRSxRQUFrQjtvQkFDNUUsTUFBTSxDQUFDLElBQUksQ0FDVCxPQUFPLEtBQUssS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFFBQTBCLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUNuRixDQUFDO29CQUNGLFFBQVEsRUFBRSxDQUFDO2dCQUNiLENBQUM7Z0JBQ0QsS0FBSyxDQUFDLFFBQWlDO29CQUNyQyxRQUFRLEVBQUUsQ0FBQztvQkFDWCxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO2dCQUM1QyxDQUFDO2FBQ0YsQ0FBQyxDQUNILENBQUM7UUFDTixDQUFDLENBQUM7S0FDSCxDQUFDO0FBQ0osQ0FBQztBQWxDRCxrREFrQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgUmVhZGFibGUsIFdyaXRhYmxlIH0gZnJvbSAnc3RyZWFtJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGh0bWxSZXdyaXRpbmdTdHJlYW0oY29udGVudDogc3RyaW5nKTogUHJvbWlzZTx7XG4gIHJld3JpdGVyOiBpbXBvcnQoJ3BhcnNlNS1odG1sLXJld3JpdGluZy1zdHJlYW0nKTtcbiAgdHJhbnNmb3JtZWRDb250ZW50OiBQcm9taXNlPHN0cmluZz47XG59PiB7XG4gIGNvbnN0IGNodW5rczogQnVmZmVyW10gPSBbXTtcbiAgY29uc3QgcmV3cml0ZXIgPSBuZXcgKGF3YWl0IGltcG9ydCgncGFyc2U1LWh0bWwtcmV3cml0aW5nLXN0cmVhbScpKS5kZWZhdWx0KCk7XG5cbiAgcmV0dXJuIHtcbiAgICByZXdyaXRlcixcbiAgICB0cmFuc2Zvcm1lZENvbnRlbnQ6IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICBuZXcgUmVhZGFibGUoe1xuICAgICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgICAgICByZWFkKCk6IHZvaWQge1xuICAgICAgICAgIHRoaXMucHVzaChCdWZmZXIuZnJvbShjb250ZW50KSk7XG4gICAgICAgICAgdGhpcy5wdXNoKG51bGwpO1xuICAgICAgICB9LFxuICAgICAgfSlcbiAgICAgICAgLnBpcGUocmV3cml0ZXIpXG4gICAgICAgIC5waXBlKFxuICAgICAgICAgIG5ldyBXcml0YWJsZSh7XG4gICAgICAgICAgICB3cml0ZShjaHVuazogc3RyaW5nIHwgQnVmZmVyLCBlbmNvZGluZzogc3RyaW5nIHwgdW5kZWZpbmVkLCBjYWxsYmFjazogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICAgICAgICAgICAgY2h1bmtzLnB1c2goXG4gICAgICAgICAgICAgICAgdHlwZW9mIGNodW5rID09PSAnc3RyaW5nJyA/IEJ1ZmZlci5mcm9tKGNodW5rLCBlbmNvZGluZyBhcyBCdWZmZXJFbmNvZGluZykgOiBjaHVuayxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmaW5hbChjYWxsYmFjazogKGVycm9yPzogRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcbiAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShCdWZmZXIuY29uY2F0KGNodW5rcykudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgIH0pLFxuICB9O1xufVxuIl19