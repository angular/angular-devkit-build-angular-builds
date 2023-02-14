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
        transformedContent: () => {
            return new Promise((resolve) => {
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
                        chunks.push(typeof chunk === 'string'
                            ? Buffer.from(chunk, encoding)
                            : chunk);
                        callback();
                    },
                    final(callback) {
                        callback();
                        resolve(Buffer.concat(chunks).toString());
                    },
                }));
            });
        },
    };
}
exports.htmlRewritingStream = htmlRewritingStream;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHRtbC1yZXdyaXRpbmctc3RyZWFtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdXRpbHMvaW5kZXgtZmlsZS9odG1sLXJld3JpdGluZy1zdHJlYW0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxtQ0FBNEM7QUFFckMsS0FBSyxVQUFVLG1CQUFtQixDQUFDLE9BQWU7SUFJdkQsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO0lBQzVCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyx3REFBYSw4QkFBOEIsR0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7SUFFOUUsT0FBTztRQUNMLFFBQVE7UUFDUixrQkFBa0IsRUFBRSxHQUFHLEVBQUU7WUFDdkIsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO2dCQUM3QixJQUFJLGlCQUFRLENBQUM7b0JBQ1gsUUFBUSxFQUFFLE1BQU07b0JBQ2hCLElBQUk7d0JBQ0YsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7d0JBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2xCLENBQUM7aUJBQ0YsQ0FBQztxQkFDQyxJQUFJLENBQUMsUUFBUSxDQUFDO3FCQUNkLElBQUksQ0FDSCxJQUFJLGlCQUFRLENBQUM7b0JBQ1gsS0FBSyxDQUNILEtBQXNCLEVBQ3RCLFFBQTRCLEVBQzVCLFFBQWtCO3dCQUVsQixNQUFNLENBQUMsSUFBSSxDQUNULE9BQU8sS0FBSyxLQUFLLFFBQVE7NEJBQ3ZCLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxRQUEwQixDQUFDOzRCQUNoRCxDQUFDLENBQUMsS0FBSyxDQUNWLENBQUM7d0JBQ0YsUUFBUSxFQUFFLENBQUM7b0JBQ2IsQ0FBQztvQkFDRCxLQUFLLENBQUMsUUFBaUM7d0JBQ3JDLFFBQVEsRUFBRSxDQUFDO3dCQUNYLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7b0JBQzVDLENBQUM7aUJBQ0YsQ0FBQyxDQUNILENBQUM7WUFDTixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQTFDRCxrREEwQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgUmVhZGFibGUsIFdyaXRhYmxlIH0gZnJvbSAnc3RyZWFtJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGh0bWxSZXdyaXRpbmdTdHJlYW0oY29udGVudDogc3RyaW5nKTogUHJvbWlzZTx7XG4gIHJld3JpdGVyOiBpbXBvcnQoJ3BhcnNlNS1odG1sLXJld3JpdGluZy1zdHJlYW0nKTtcbiAgdHJhbnNmb3JtZWRDb250ZW50OiAoKSA9PiBQcm9taXNlPHN0cmluZz47XG59PiB7XG4gIGNvbnN0IGNodW5rczogQnVmZmVyW10gPSBbXTtcbiAgY29uc3QgcmV3cml0ZXIgPSBuZXcgKGF3YWl0IGltcG9ydCgncGFyc2U1LWh0bWwtcmV3cml0aW5nLXN0cmVhbScpKS5kZWZhdWx0KCk7XG5cbiAgcmV0dXJuIHtcbiAgICByZXdyaXRlcixcbiAgICB0cmFuc2Zvcm1lZENvbnRlbnQ6ICgpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBuZXcgUmVhZGFibGUoe1xuICAgICAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgICAgICAgcmVhZCgpOiB2b2lkIHtcbiAgICAgICAgICAgIHRoaXMucHVzaChCdWZmZXIuZnJvbShjb250ZW50KSk7XG4gICAgICAgICAgICB0aGlzLnB1c2gobnVsbCk7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSlcbiAgICAgICAgICAucGlwZShyZXdyaXRlcilcbiAgICAgICAgICAucGlwZShcbiAgICAgICAgICAgIG5ldyBXcml0YWJsZSh7XG4gICAgICAgICAgICAgIHdyaXRlKFxuICAgICAgICAgICAgICAgIGNodW5rOiBzdHJpbmcgfCBCdWZmZXIsXG4gICAgICAgICAgICAgICAgZW5jb2Rpbmc6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICBjYWxsYmFjazogRnVuY3Rpb24sXG4gICAgICAgICAgICAgICk6IHZvaWQge1xuICAgICAgICAgICAgICAgIGNodW5rcy5wdXNoKFxuICAgICAgICAgICAgICAgICAgdHlwZW9mIGNodW5rID09PSAnc3RyaW5nJ1xuICAgICAgICAgICAgICAgICAgICA/IEJ1ZmZlci5mcm9tKGNodW5rLCBlbmNvZGluZyBhcyBCdWZmZXJFbmNvZGluZylcbiAgICAgICAgICAgICAgICAgICAgOiBjaHVuayxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGZpbmFsKGNhbGxiYWNrOiAoZXJyb3I/OiBFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShCdWZmZXIuY29uY2F0KGNodW5rcykudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICApO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==