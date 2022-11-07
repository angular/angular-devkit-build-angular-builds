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
const assert_1 = __importDefault(require("assert"));
const worker_threads_1 = require("worker_threads");
/**
 * The fully resolved path to the zone.js package that will be loaded during worker initialization.
 * This is passed as workerData when setting up the worker via the `piscina` package.
 */
const { zonePackage } = worker_threads_1.workerData;
/**
 * Renders an application based on a provided server bundle path, initial document, and optional URL route.
 * @param param0 A request to render a server bundle.
 * @returns A promise that resolves to the render HTML document for the application.
 */
async function render({ serverBundlePath, document, url }) {
    const { AppServerModule, renderModule } = (await Promise.resolve().then(() => __importStar(require(serverBundlePath))));
    (0, assert_1.default)(renderModule, `renderModule was not exported from: ${serverBundlePath}.`);
    (0, assert_1.default)(AppServerModule, `AppServerModule was not exported from: ${serverBundlePath}.`);
    // Render platform server module
    const html = await renderModule(AppServerModule, {
        document,
        url,
    });
    return html;
}
/**
 * Initializes the worker when it is first created by loading the Zone.js package
 * into the worker instance.
 *
 * @returns A promise resolving to the render function of the worker.
 */
async function initialize() {
    // Setup Zone.js
    await Promise.resolve().then(() => __importStar(require(zonePackage)));
    // Return the render function for use
    return render;
}
/**
 * The default export will be the promise returned by the initialize function.
 * This is awaited by piscina prior to using the Worker.
 */
exports.default = initialize();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXdvcmtlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcC1zaGVsbC9yZW5kZXItd29ya2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJSCxvREFBNEI7QUFDNUIsbURBQTRDO0FBRTVDOzs7R0FHRztBQUNILE1BQU0sRUFBRSxXQUFXLEVBQUUsR0FBRywyQkFFdkIsQ0FBQztBQW9CRjs7OztHQUlHO0FBQ0gsS0FBSyxVQUFVLE1BQU0sQ0FBQyxFQUFFLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQWlCO0lBQ3RFLE1BQU0sRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLEdBQUcsQ0FBQyx3REFBYSxnQkFBZ0IsR0FBQyxDQUd4RSxDQUFDO0lBRUYsSUFBQSxnQkFBTSxFQUFDLFlBQVksRUFBRSx1Q0FBdUMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO0lBQ2pGLElBQUEsZ0JBQU0sRUFBQyxlQUFlLEVBQUUsMENBQTBDLGdCQUFnQixHQUFHLENBQUMsQ0FBQztJQUV2RixnQ0FBZ0M7SUFDaEMsTUFBTSxJQUFJLEdBQUcsTUFBTSxZQUFZLENBQUMsZUFBZSxFQUFFO1FBQy9DLFFBQVE7UUFDUixHQUFHO0tBQ0osQ0FBQyxDQUFDO0lBRUgsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxLQUFLLFVBQVUsVUFBVTtJQUN2QixnQkFBZ0I7SUFDaEIsd0RBQWEsV0FBVyxHQUFDLENBQUM7SUFFMUIscUNBQXFDO0lBQ3JDLE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxrQkFBZSxVQUFVLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IFR5cGUgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB0eXBlICogYXMgcGxhdGZvcm1TZXJ2ZXIgZnJvbSAnQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IHdvcmtlckRhdGEgfSBmcm9tICd3b3JrZXJfdGhyZWFkcyc7XG5cbi8qKlxuICogVGhlIGZ1bGx5IHJlc29sdmVkIHBhdGggdG8gdGhlIHpvbmUuanMgcGFja2FnZSB0aGF0IHdpbGwgYmUgbG9hZGVkIGR1cmluZyB3b3JrZXIgaW5pdGlhbGl6YXRpb24uXG4gKiBUaGlzIGlzIHBhc3NlZCBhcyB3b3JrZXJEYXRhIHdoZW4gc2V0dGluZyB1cCB0aGUgd29ya2VyIHZpYSB0aGUgYHBpc2NpbmFgIHBhY2thZ2UuXG4gKi9cbmNvbnN0IHsgem9uZVBhY2thZ2UgfSA9IHdvcmtlckRhdGEgYXMge1xuICB6b25lUGFja2FnZTogc3RyaW5nO1xufTtcblxuLyoqXG4gKiBBIHJlcXVlc3QgdG8gcmVuZGVyIGEgU2VydmVyIGJ1bmRsZSBnZW5lcmF0ZSBieSB0aGUgdW5pdmVyc2FsIHNlcnZlciBidWlsZGVyLlxuICovXG5pbnRlcmZhY2UgUmVuZGVyUmVxdWVzdCB7XG4gIC8qKlxuICAgKiBUaGUgcGF0aCB0byB0aGUgc2VydmVyIGJ1bmRsZSB0aGF0IHNob3VsZCBiZSBsb2FkZWQgYW5kIHJlbmRlcmVkLlxuICAgKi9cbiAgc2VydmVyQnVuZGxlUGF0aDogc3RyaW5nO1xuICAvKipcbiAgICogVGhlIGV4aXN0aW5nIEhUTUwgZG9jdW1lbnQgYXMgYSBzdHJpbmcgdGhhdCB3aWxsIGJlIGF1Z21lbnRlZCB3aXRoIHRoZSByZW5kZXJlZCBhcHBsaWNhdGlvbi5cbiAgICovXG4gIGRvY3VtZW50OiBzdHJpbmc7XG4gIC8qKlxuICAgKiBBbiBvcHRpb25hbCBVUkwgcGF0aCB0aGF0IHJlcHJlc2VudHMgdGhlIEFuZ3VsYXIgcm91dGUgdGhhdCBzaG91bGQgYmUgcmVuZGVyZWQuXG4gICAqL1xuICB1cmw6IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBSZW5kZXJzIGFuIGFwcGxpY2F0aW9uIGJhc2VkIG9uIGEgcHJvdmlkZWQgc2VydmVyIGJ1bmRsZSBwYXRoLCBpbml0aWFsIGRvY3VtZW50LCBhbmQgb3B0aW9uYWwgVVJMIHJvdXRlLlxuICogQHBhcmFtIHBhcmFtMCBBIHJlcXVlc3QgdG8gcmVuZGVyIGEgc2VydmVyIGJ1bmRsZS5cbiAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIHRoZSByZW5kZXIgSFRNTCBkb2N1bWVudCBmb3IgdGhlIGFwcGxpY2F0aW9uLlxuICovXG5hc3luYyBmdW5jdGlvbiByZW5kZXIoeyBzZXJ2ZXJCdW5kbGVQYXRoLCBkb2N1bWVudCwgdXJsIH06IFJlbmRlclJlcXVlc3QpOiBQcm9taXNlPHN0cmluZz4ge1xuICBjb25zdCB7IEFwcFNlcnZlck1vZHVsZSwgcmVuZGVyTW9kdWxlIH0gPSAoYXdhaXQgaW1wb3J0KHNlcnZlckJ1bmRsZVBhdGgpKSBhcyB7XG4gICAgcmVuZGVyTW9kdWxlOiB0eXBlb2YgcGxhdGZvcm1TZXJ2ZXIucmVuZGVyTW9kdWxlIHwgdW5kZWZpbmVkO1xuICAgIEFwcFNlcnZlck1vZHVsZTogVHlwZTx1bmtub3duPiB8IHVuZGVmaW5lZDtcbiAgfTtcblxuICBhc3NlcnQocmVuZGVyTW9kdWxlLCBgcmVuZGVyTW9kdWxlIHdhcyBub3QgZXhwb3J0ZWQgZnJvbTogJHtzZXJ2ZXJCdW5kbGVQYXRofS5gKTtcbiAgYXNzZXJ0KEFwcFNlcnZlck1vZHVsZSwgYEFwcFNlcnZlck1vZHVsZSB3YXMgbm90IGV4cG9ydGVkIGZyb206ICR7c2VydmVyQnVuZGxlUGF0aH0uYCk7XG5cbiAgLy8gUmVuZGVyIHBsYXRmb3JtIHNlcnZlciBtb2R1bGVcbiAgY29uc3QgaHRtbCA9IGF3YWl0IHJlbmRlck1vZHVsZShBcHBTZXJ2ZXJNb2R1bGUsIHtcbiAgICBkb2N1bWVudCxcbiAgICB1cmwsXG4gIH0pO1xuXG4gIHJldHVybiBodG1sO1xufVxuXG4vKipcbiAqIEluaXRpYWxpemVzIHRoZSB3b3JrZXIgd2hlbiBpdCBpcyBmaXJzdCBjcmVhdGVkIGJ5IGxvYWRpbmcgdGhlIFpvbmUuanMgcGFja2FnZVxuICogaW50byB0aGUgd29ya2VyIGluc3RhbmNlLlxuICpcbiAqIEByZXR1cm5zIEEgcHJvbWlzZSByZXNvbHZpbmcgdG8gdGhlIHJlbmRlciBmdW5jdGlvbiBvZiB0aGUgd29ya2VyLlxuICovXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplKCkge1xuICAvLyBTZXR1cCBab25lLmpzXG4gIGF3YWl0IGltcG9ydCh6b25lUGFja2FnZSk7XG5cbiAgLy8gUmV0dXJuIHRoZSByZW5kZXIgZnVuY3Rpb24gZm9yIHVzZVxuICByZXR1cm4gcmVuZGVyO1xufVxuXG4vKipcbiAqIFRoZSBkZWZhdWx0IGV4cG9ydCB3aWxsIGJlIHRoZSBwcm9taXNlIHJldHVybmVkIGJ5IHRoZSBpbml0aWFsaXplIGZ1bmN0aW9uLlxuICogVGhpcyBpcyBhd2FpdGVkIGJ5IHBpc2NpbmEgcHJpb3IgdG8gdXNpbmcgdGhlIFdvcmtlci5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgaW5pdGlhbGl6ZSgpO1xuIl19