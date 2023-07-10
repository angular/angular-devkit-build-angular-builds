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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = __importDefault(require("node:assert"));
const node_path_1 = require("node:path");
const node_worker_threads_1 = require("node:worker_threads");
const inline_critical_css_1 = require("../index-file/inline-critical-css");
const load_esm_1 = require("../load-esm");
/**
 * The fully resolved path to the zone.js package that will be loaded during worker initialization.
 * This is passed as workerData when setting up the worker via the `piscina` package.
 */
const { zonePackage, outputFiles, document, inlineCriticalCss } = node_worker_threads_1.workerData;
/**
 * Renders each route in routes and writes them to <outputPath>/<route>/index.html.
 */
async function render({ route, serverContext }) {
    const { default: bootstrapAppFnOrModule, ɵSERVER_CONTEXT, renderModule, renderApplication, } = await (0, load_esm_1.loadEsmModule)('./main.server.mjs');
    (0, node_assert_1.default)(ɵSERVER_CONTEXT, `ɵSERVER_CONTEXT was not exported.`);
    const platformProviders = [
        {
            provide: ɵSERVER_CONTEXT,
            useValue: serverContext,
        },
    ];
    let html;
    if (isBootstrapFn(bootstrapAppFnOrModule)) {
        (0, node_assert_1.default)(renderApplication, `renderApplication was not exported.`);
        html = await renderApplication(bootstrapAppFnOrModule, {
            document,
            url: route,
            platformProviders,
        });
    }
    else {
        (0, node_assert_1.default)(renderModule, `renderModule was not exported.`);
        (0, node_assert_1.default)(bootstrapAppFnOrModule, `Neither an AppServerModule nor a bootstrapping function was exported.`);
        html = await renderModule(bootstrapAppFnOrModule, {
            document,
            url: route,
            extraProviders: platformProviders,
        });
    }
    if (inlineCriticalCss) {
        const inlineCriticalCssProcessor = new inline_critical_css_1.InlineCriticalCssProcessor({
            minify: false,
            readAsset: async (filePath) => {
                filePath = (0, node_path_1.basename)(filePath);
                const content = outputFiles[filePath];
                if (content === undefined) {
                    throw new Error(`Output file does not exist: ${filePath}`);
                }
                return content;
            },
        });
        return inlineCriticalCssProcessor.process(html, { outputPath: '' });
    }
    return {
        content: html,
    };
}
function isBootstrapFn(value) {
    // We can differentiate between a module and a bootstrap function by reading `cmp`:
    return typeof value === 'function' && !('ɵmod' in value);
}
/**
 * Initializes the worker when it is first created by loading the Zone.js package
 * into the worker instance.
 *
 * @returns A promise resolving to the render function of the worker.
 */
async function initialize() {
    // Setup Zone.js
    await Promise.resolve(`${zonePackage}`).then(s => __importStar(require(s)));
    return render;
}
/**
 * The default export will be the promise returned by the initialize function.
 * This is awaited by piscina prior to using the Worker.
 */
exports.default = initialize();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXdvcmtlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL3NzZy9yZW5kZXItd29ya2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJSCw4REFBaUM7QUFDakMseUNBQXFDO0FBQ3JDLDZEQUFpRDtBQUNqRCwyRUFBK0U7QUFDL0UsMENBQTRDO0FBb0M1Qzs7O0dBR0c7QUFDSCxNQUFNLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUUsR0FBRyxnQ0FBd0IsQ0FBQztBQUUzRjs7R0FFRztBQUNILEtBQUssVUFBVSxNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsYUFBYSxFQUFpQjtJQUMzRCxNQUFNLEVBQ0osT0FBTyxFQUFFLHNCQUFzQixFQUMvQixlQUFlLEVBQ2YsWUFBWSxFQUNaLGlCQUFpQixHQUNsQixHQUFHLE1BQU0sSUFBQSx3QkFBYSxFQUFnQixtQkFBbUIsQ0FBQyxDQUFDO0lBRTVELElBQUEscUJBQU0sRUFBQyxlQUFlLEVBQUUsbUNBQW1DLENBQUMsQ0FBQztJQUU3RCxNQUFNLGlCQUFpQixHQUFxQjtRQUMxQztZQUNFLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLFFBQVEsRUFBRSxhQUFhO1NBQ3hCO0tBQ0YsQ0FBQztJQUVGLElBQUksSUFBd0IsQ0FBQztJQUU3QixJQUFJLGFBQWEsQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFO1FBQ3pDLElBQUEscUJBQU0sRUFBQyxpQkFBaUIsRUFBRSxxQ0FBcUMsQ0FBQyxDQUFDO1FBQ2pFLElBQUksR0FBRyxNQUFNLGlCQUFpQixDQUFDLHNCQUFzQixFQUFFO1lBQ3JELFFBQVE7WUFDUixHQUFHLEVBQUUsS0FBSztZQUNWLGlCQUFpQjtTQUNsQixDQUFDLENBQUM7S0FDSjtTQUFNO1FBQ0wsSUFBQSxxQkFBTSxFQUFDLFlBQVksRUFBRSxnQ0FBZ0MsQ0FBQyxDQUFDO1FBQ3ZELElBQUEscUJBQU0sRUFDSixzQkFBc0IsRUFDdEIsdUVBQXVFLENBQ3hFLENBQUM7UUFFRixJQUFJLEdBQUcsTUFBTSxZQUFZLENBQUMsc0JBQXNCLEVBQUU7WUFDaEQsUUFBUTtZQUNSLEdBQUcsRUFBRSxLQUFLO1lBQ1YsY0FBYyxFQUFFLGlCQUFpQjtTQUNsQyxDQUFDLENBQUM7S0FDSjtJQUVELElBQUksaUJBQWlCLEVBQUU7UUFDckIsTUFBTSwwQkFBMEIsR0FBRyxJQUFJLGdEQUEwQixDQUFDO1lBQ2hFLE1BQU0sRUFBRSxLQUFLO1lBQ2IsU0FBUyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsRUFBRTtnQkFDNUIsUUFBUSxHQUFHLElBQUEsb0JBQVEsRUFBQyxRQUFRLENBQUMsQ0FBQztnQkFDOUIsTUFBTSxPQUFPLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUN0QyxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUU7b0JBQ3pCLE1BQU0sSUFBSSxLQUFLLENBQUMsK0JBQStCLFFBQVEsRUFBRSxDQUFDLENBQUM7aUJBQzVEO2dCQUVELE9BQU8sT0FBTyxDQUFDO1lBQ2pCLENBQUM7U0FDRixDQUFDLENBQUM7UUFFSCxPQUFPLDBCQUEwQixDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztLQUNyRTtJQUVELE9BQU87UUFDTCxPQUFPLEVBQUUsSUFBSTtLQUNkLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyxhQUFhLENBQUMsS0FBYztJQUNuQyxtRkFBbUY7SUFDbkYsT0FBTyxPQUFPLEtBQUssS0FBSyxVQUFVLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQztBQUMzRCxDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxLQUFLLFVBQVUsVUFBVTtJQUN2QixnQkFBZ0I7SUFDaEIseUJBQWEsV0FBVyx1Q0FBQyxDQUFDO0lBRTFCLE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxrQkFBZSxVQUFVLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEFwcGxpY2F0aW9uUmVmLCBTdGF0aWNQcm92aWRlciwgVHlwZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHR5cGUgeyByZW5kZXJBcHBsaWNhdGlvbiwgcmVuZGVyTW9kdWxlLCDJtVNFUlZFUl9DT05URVhUIH0gZnJvbSAnQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgd29ya2VyRGF0YSB9IGZyb20gJ25vZGU6d29ya2VyX3RocmVhZHMnO1xuaW1wb3J0IHsgSW5saW5lQ3JpdGljYWxDc3NQcm9jZXNzb3IgfSBmcm9tICcuLi9pbmRleC1maWxlL2lubGluZS1jcml0aWNhbC1jc3MnO1xuaW1wb3J0IHsgbG9hZEVzbU1vZHVsZSB9IGZyb20gJy4uL2xvYWQtZXNtJztcblxuZXhwb3J0IGludGVyZmFjZSBSZW5kZXJPcHRpb25zIHtcbiAgcm91dGU6IHN0cmluZztcbiAgc2VydmVyQ29udGV4dDogU2VydmVyQ29udGV4dDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZW5kZXJSZXN1bHQge1xuICBlcnJvcnM/OiBzdHJpbmdbXTtcbiAgd2FybmluZ3M/OiBzdHJpbmdbXTtcbiAgY29udGVudD86IHN0cmluZztcbn1cblxuZXhwb3J0IHR5cGUgU2VydmVyQ29udGV4dCA9ICdhcHAtc2hlbGwnIHwgJ3NzZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgV29ya2VyRGF0YSB7XG4gIHpvbmVQYWNrYWdlOiBzdHJpbmc7XG4gIG91dHB1dEZpbGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBkb2N1bWVudDogc3RyaW5nO1xuICBpbmxpbmVDcml0aWNhbENzcz86IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBCdW5kbGVFeHBvcnRzIHtcbiAgLyoqIEFuIGludGVybmFsIHRva2VuIHRoYXQgYWxsb3dzIHByb3ZpZGluZyBleHRyYSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgc2VydmVyIGNvbnRleHQuICovXG4gIMm1U0VSVkVSX0NPTlRFWFQ/OiB0eXBlb2YgybVTRVJWRVJfQ09OVEVYVDtcblxuICAvKiogUmVuZGVyIGFuIE5nTW9kdWxlIGFwcGxpY2F0aW9uLiAqL1xuICByZW5kZXJNb2R1bGU/OiB0eXBlb2YgcmVuZGVyTW9kdWxlO1xuXG4gIC8qKiBNZXRob2QgdG8gcmVuZGVyIGEgc3RhbmRhbG9uZSBhcHBsaWNhdGlvbi4gKi9cbiAgcmVuZGVyQXBwbGljYXRpb24/OiB0eXBlb2YgcmVuZGVyQXBwbGljYXRpb247XG5cbiAgLyoqIFN0YW5kYWxvbmUgYXBwbGljYXRpb24gYm9vdHN0cmFwcGluZyBmdW5jdGlvbi4gKi9cbiAgZGVmYXVsdD86ICgoKSA9PiBQcm9taXNlPEFwcGxpY2F0aW9uUmVmPikgfCBUeXBlPHVua25vd24+O1xufVxuXG4vKipcbiAqIFRoZSBmdWxseSByZXNvbHZlZCBwYXRoIHRvIHRoZSB6b25lLmpzIHBhY2thZ2UgdGhhdCB3aWxsIGJlIGxvYWRlZCBkdXJpbmcgd29ya2VyIGluaXRpYWxpemF0aW9uLlxuICogVGhpcyBpcyBwYXNzZWQgYXMgd29ya2VyRGF0YSB3aGVuIHNldHRpbmcgdXAgdGhlIHdvcmtlciB2aWEgdGhlIGBwaXNjaW5hYCBwYWNrYWdlLlxuICovXG5jb25zdCB7IHpvbmVQYWNrYWdlLCBvdXRwdXRGaWxlcywgZG9jdW1lbnQsIGlubGluZUNyaXRpY2FsQ3NzIH0gPSB3b3JrZXJEYXRhIGFzIFdvcmtlckRhdGE7XG5cbi8qKlxuICogUmVuZGVycyBlYWNoIHJvdXRlIGluIHJvdXRlcyBhbmQgd3JpdGVzIHRoZW0gdG8gPG91dHB1dFBhdGg+Lzxyb3V0ZT4vaW5kZXguaHRtbC5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcmVuZGVyKHsgcm91dGUsIHNlcnZlckNvbnRleHQgfTogUmVuZGVyT3B0aW9ucyk6IFByb21pc2U8UmVuZGVyUmVzdWx0PiB7XG4gIGNvbnN0IHtcbiAgICBkZWZhdWx0OiBib290c3RyYXBBcHBGbk9yTW9kdWxlLFxuICAgIMm1U0VSVkVSX0NPTlRFWFQsXG4gICAgcmVuZGVyTW9kdWxlLFxuICAgIHJlbmRlckFwcGxpY2F0aW9uLFxuICB9ID0gYXdhaXQgbG9hZEVzbU1vZHVsZTxCdW5kbGVFeHBvcnRzPignLi9tYWluLnNlcnZlci5tanMnKTtcblxuICBhc3NlcnQoybVTRVJWRVJfQ09OVEVYVCwgYMm1U0VSVkVSX0NPTlRFWFQgd2FzIG5vdCBleHBvcnRlZC5gKTtcblxuICBjb25zdCBwbGF0Zm9ybVByb3ZpZGVyczogU3RhdGljUHJvdmlkZXJbXSA9IFtcbiAgICB7XG4gICAgICBwcm92aWRlOiDJtVNFUlZFUl9DT05URVhULFxuICAgICAgdXNlVmFsdWU6IHNlcnZlckNvbnRleHQsXG4gICAgfSxcbiAgXTtcblxuICBsZXQgaHRtbDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG4gIGlmIChpc0Jvb3RzdHJhcEZuKGJvb3RzdHJhcEFwcEZuT3JNb2R1bGUpKSB7XG4gICAgYXNzZXJ0KHJlbmRlckFwcGxpY2F0aW9uLCBgcmVuZGVyQXBwbGljYXRpb24gd2FzIG5vdCBleHBvcnRlZC5gKTtcbiAgICBodG1sID0gYXdhaXQgcmVuZGVyQXBwbGljYXRpb24oYm9vdHN0cmFwQXBwRm5Pck1vZHVsZSwge1xuICAgICAgZG9jdW1lbnQsXG4gICAgICB1cmw6IHJvdXRlLFxuICAgICAgcGxhdGZvcm1Qcm92aWRlcnMsXG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgYXNzZXJ0KHJlbmRlck1vZHVsZSwgYHJlbmRlck1vZHVsZSB3YXMgbm90IGV4cG9ydGVkLmApO1xuICAgIGFzc2VydChcbiAgICAgIGJvb3RzdHJhcEFwcEZuT3JNb2R1bGUsXG4gICAgICBgTmVpdGhlciBhbiBBcHBTZXJ2ZXJNb2R1bGUgbm9yIGEgYm9vdHN0cmFwcGluZyBmdW5jdGlvbiB3YXMgZXhwb3J0ZWQuYCxcbiAgICApO1xuXG4gICAgaHRtbCA9IGF3YWl0IHJlbmRlck1vZHVsZShib290c3RyYXBBcHBGbk9yTW9kdWxlLCB7XG4gICAgICBkb2N1bWVudCxcbiAgICAgIHVybDogcm91dGUsXG4gICAgICBleHRyYVByb3ZpZGVyczogcGxhdGZvcm1Qcm92aWRlcnMsXG4gICAgfSk7XG4gIH1cblxuICBpZiAoaW5saW5lQ3JpdGljYWxDc3MpIHtcbiAgICBjb25zdCBpbmxpbmVDcml0aWNhbENzc1Byb2Nlc3NvciA9IG5ldyBJbmxpbmVDcml0aWNhbENzc1Byb2Nlc3Nvcih7XG4gICAgICBtaW5pZnk6IGZhbHNlLCAvLyBDU1MgaGFzIGFscmVhZHkgYmVlbiBtaW5pZmllZCBkdXJpbmcgdGhlIGJ1aWxkLlxuICAgICAgcmVhZEFzc2V0OiBhc3luYyAoZmlsZVBhdGgpID0+IHtcbiAgICAgICAgZmlsZVBhdGggPSBiYXNlbmFtZShmaWxlUGF0aCk7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBvdXRwdXRGaWxlc1tmaWxlUGF0aF07XG4gICAgICAgIGlmIChjb250ZW50ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE91dHB1dCBmaWxlIGRvZXMgbm90IGV4aXN0OiAke2ZpbGVQYXRofWApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGlubGluZUNyaXRpY2FsQ3NzUHJvY2Vzc29yLnByb2Nlc3MoaHRtbCwgeyBvdXRwdXRQYXRoOiAnJyB9KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgY29udGVudDogaHRtbCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gaXNCb290c3RyYXBGbih2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzICgpID0+IFByb21pc2U8QXBwbGljYXRpb25SZWY+IHtcbiAgLy8gV2UgY2FuIGRpZmZlcmVudGlhdGUgYmV0d2VlbiBhIG1vZHVsZSBhbmQgYSBib290c3RyYXAgZnVuY3Rpb24gYnkgcmVhZGluZyBgY21wYDpcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyAmJiAhKCfJtW1vZCcgaW4gdmFsdWUpO1xufVxuXG4vKipcbiAqIEluaXRpYWxpemVzIHRoZSB3b3JrZXIgd2hlbiBpdCBpcyBmaXJzdCBjcmVhdGVkIGJ5IGxvYWRpbmcgdGhlIFpvbmUuanMgcGFja2FnZVxuICogaW50byB0aGUgd29ya2VyIGluc3RhbmNlLlxuICpcbiAqIEByZXR1cm5zIEEgcHJvbWlzZSByZXNvbHZpbmcgdG8gdGhlIHJlbmRlciBmdW5jdGlvbiBvZiB0aGUgd29ya2VyLlxuICovXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplKCkge1xuICAvLyBTZXR1cCBab25lLmpzXG4gIGF3YWl0IGltcG9ydCh6b25lUGFja2FnZSk7XG5cbiAgcmV0dXJuIHJlbmRlcjtcbn1cblxuLyoqXG4gKiBUaGUgZGVmYXVsdCBleHBvcnQgd2lsbCBiZSB0aGUgcHJvbWlzZSByZXR1cm5lZCBieSB0aGUgaW5pdGlhbGl6ZSBmdW5jdGlvbi5cbiAqIFRoaXMgaXMgYXdhaXRlZCBieSBwaXNjaW5hIHByaW9yIHRvIHVzaW5nIHRoZSBXb3JrZXIuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGluaXRpYWxpemUoKTtcbiJdfQ==