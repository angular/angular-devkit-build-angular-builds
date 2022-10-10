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
const node_worker_threads_1 = require("node:worker_threads");
/**
 * The fully resolved path to the zone.js package that will be loaded during worker initialization.
 * This is passed as workerData when setting up the worker via the `piscina` package.
 */
const { zonePackage } = node_worker_threads_1.workerData;
/**
 * Renders an application based on a provided server bundle path, initial document, and optional URL route.
 * @param param0 A request to render a server bundle.
 * @returns A promise that resolves to the render HTML document for the application.
 */
async function render({ serverBundlePath, document, url }) {
    const { AppServerModule, renderModule, ɵSERVER_CONTEXT } = (await Promise.resolve().then(() => __importStar(require(serverBundlePath))));
    (0, node_assert_1.default)(renderModule, `renderModule was not exported from: ${serverBundlePath}.`);
    (0, node_assert_1.default)(AppServerModule, `AppServerModule was not exported from: ${serverBundlePath}.`);
    (0, node_assert_1.default)(ɵSERVER_CONTEXT, `ɵSERVER_CONTEXT was not exported from: ${serverBundlePath}.`);
    // Render platform server module
    const html = await renderModule(AppServerModule, {
        document,
        url,
        extraProviders: [
            {
                provide: ɵSERVER_CONTEXT,
                useValue: 'app-shell',
            },
        ],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXdvcmtlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcC1zaGVsbC9yZW5kZXItd29ya2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJSCw4REFBaUM7QUFDakMsNkRBQWlEO0FBRWpEOzs7R0FHRztBQUNILE1BQU0sRUFBRSxXQUFXLEVBQUUsR0FBRyxnQ0FFdkIsQ0FBQztBQW9CRjs7OztHQUlHO0FBQ0gsS0FBSyxVQUFVLE1BQU0sQ0FBQyxFQUFFLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQWlCO0lBQ3RFLE1BQU0sRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxHQUFHLENBQUMsd0RBQWEsZ0JBQWdCLEdBQUMsQ0FJekYsQ0FBQztJQUVGLElBQUEscUJBQU0sRUFBQyxZQUFZLEVBQUUsdUNBQXVDLGdCQUFnQixHQUFHLENBQUMsQ0FBQztJQUNqRixJQUFBLHFCQUFNLEVBQUMsZUFBZSxFQUFFLDBDQUEwQyxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7SUFDdkYsSUFBQSxxQkFBTSxFQUFDLGVBQWUsRUFBRSwwQ0FBMEMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO0lBRXZGLGdDQUFnQztJQUNoQyxNQUFNLElBQUksR0FBRyxNQUFNLFlBQVksQ0FBQyxlQUFlLEVBQUU7UUFDL0MsUUFBUTtRQUNSLEdBQUc7UUFDSCxjQUFjLEVBQUU7WUFDZDtnQkFDRSxPQUFPLEVBQUUsZUFBZTtnQkFDeEIsUUFBUSxFQUFFLFdBQVc7YUFDdEI7U0FDRjtLQUNGLENBQUMsQ0FBQztJQUVILE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsS0FBSyxVQUFVLFVBQVU7SUFDdkIsZ0JBQWdCO0lBQ2hCLHdEQUFhLFdBQVcsR0FBQyxDQUFDO0lBRTFCLHFDQUFxQztJQUNyQyxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsa0JBQWUsVUFBVSxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBUeXBlIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgdHlwZSAqIGFzIHBsYXRmb3JtU2VydmVyIGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLXNlcnZlcic7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0JztcbmltcG9ydCB7IHdvcmtlckRhdGEgfSBmcm9tICdub2RlOndvcmtlcl90aHJlYWRzJztcblxuLyoqXG4gKiBUaGUgZnVsbHkgcmVzb2x2ZWQgcGF0aCB0byB0aGUgem9uZS5qcyBwYWNrYWdlIHRoYXQgd2lsbCBiZSBsb2FkZWQgZHVyaW5nIHdvcmtlciBpbml0aWFsaXphdGlvbi5cbiAqIFRoaXMgaXMgcGFzc2VkIGFzIHdvcmtlckRhdGEgd2hlbiBzZXR0aW5nIHVwIHRoZSB3b3JrZXIgdmlhIHRoZSBgcGlzY2luYWAgcGFja2FnZS5cbiAqL1xuY29uc3QgeyB6b25lUGFja2FnZSB9ID0gd29ya2VyRGF0YSBhcyB7XG4gIHpvbmVQYWNrYWdlOiBzdHJpbmc7XG59O1xuXG4vKipcbiAqIEEgcmVxdWVzdCB0byByZW5kZXIgYSBTZXJ2ZXIgYnVuZGxlIGdlbmVyYXRlIGJ5IHRoZSB1bml2ZXJzYWwgc2VydmVyIGJ1aWxkZXIuXG4gKi9cbmludGVyZmFjZSBSZW5kZXJSZXF1ZXN0IHtcbiAgLyoqXG4gICAqIFRoZSBwYXRoIHRvIHRoZSBzZXJ2ZXIgYnVuZGxlIHRoYXQgc2hvdWxkIGJlIGxvYWRlZCBhbmQgcmVuZGVyZWQuXG4gICAqL1xuICBzZXJ2ZXJCdW5kbGVQYXRoOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBUaGUgZXhpc3RpbmcgSFRNTCBkb2N1bWVudCBhcyBhIHN0cmluZyB0aGF0IHdpbGwgYmUgYXVnbWVudGVkIHdpdGggdGhlIHJlbmRlcmVkIGFwcGxpY2F0aW9uLlxuICAgKi9cbiAgZG9jdW1lbnQ6IHN0cmluZztcbiAgLyoqXG4gICAqIEFuIG9wdGlvbmFsIFVSTCBwYXRoIHRoYXQgcmVwcmVzZW50cyB0aGUgQW5ndWxhciByb3V0ZSB0aGF0IHNob3VsZCBiZSByZW5kZXJlZC5cbiAgICovXG4gIHVybDogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIFJlbmRlcnMgYW4gYXBwbGljYXRpb24gYmFzZWQgb24gYSBwcm92aWRlZCBzZXJ2ZXIgYnVuZGxlIHBhdGgsIGluaXRpYWwgZG9jdW1lbnQsIGFuZCBvcHRpb25hbCBVUkwgcm91dGUuXG4gKiBAcGFyYW0gcGFyYW0wIEEgcmVxdWVzdCB0byByZW5kZXIgYSBzZXJ2ZXIgYnVuZGxlLlxuICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gdGhlIHJlbmRlciBIVE1MIGRvY3VtZW50IGZvciB0aGUgYXBwbGljYXRpb24uXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJlbmRlcih7IHNlcnZlckJ1bmRsZVBhdGgsIGRvY3VtZW50LCB1cmwgfTogUmVuZGVyUmVxdWVzdCk6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IHsgQXBwU2VydmVyTW9kdWxlLCByZW5kZXJNb2R1bGUsIMm1U0VSVkVSX0NPTlRFWFQgfSA9IChhd2FpdCBpbXBvcnQoc2VydmVyQnVuZGxlUGF0aCkpIGFzIHtcbiAgICByZW5kZXJNb2R1bGU6IHR5cGVvZiBwbGF0Zm9ybVNlcnZlci5yZW5kZXJNb2R1bGUgfCB1bmRlZmluZWQ7XG4gICAgybVTRVJWRVJfQ09OVEVYVDogdHlwZW9mIHBsYXRmb3JtU2VydmVyLsm1U0VSVkVSX0NPTlRFWFQgfCB1bmRlZmluZWQ7XG4gICAgQXBwU2VydmVyTW9kdWxlOiBUeXBlPHVua25vd24+IHwgdW5kZWZpbmVkO1xuICB9O1xuXG4gIGFzc2VydChyZW5kZXJNb2R1bGUsIGByZW5kZXJNb2R1bGUgd2FzIG5vdCBleHBvcnRlZCBmcm9tOiAke3NlcnZlckJ1bmRsZVBhdGh9LmApO1xuICBhc3NlcnQoQXBwU2VydmVyTW9kdWxlLCBgQXBwU2VydmVyTW9kdWxlIHdhcyBub3QgZXhwb3J0ZWQgZnJvbTogJHtzZXJ2ZXJCdW5kbGVQYXRofS5gKTtcbiAgYXNzZXJ0KMm1U0VSVkVSX0NPTlRFWFQsIGDJtVNFUlZFUl9DT05URVhUIHdhcyBub3QgZXhwb3J0ZWQgZnJvbTogJHtzZXJ2ZXJCdW5kbGVQYXRofS5gKTtcblxuICAvLyBSZW5kZXIgcGxhdGZvcm0gc2VydmVyIG1vZHVsZVxuICBjb25zdCBodG1sID0gYXdhaXQgcmVuZGVyTW9kdWxlKEFwcFNlcnZlck1vZHVsZSwge1xuICAgIGRvY3VtZW50LFxuICAgIHVybCxcbiAgICBleHRyYVByb3ZpZGVyczogW1xuICAgICAge1xuICAgICAgICBwcm92aWRlOiDJtVNFUlZFUl9DT05URVhULFxuICAgICAgICB1c2VWYWx1ZTogJ2FwcC1zaGVsbCcsXG4gICAgICB9LFxuICAgIF0sXG4gIH0pO1xuXG4gIHJldHVybiBodG1sO1xufVxuXG4vKipcbiAqIEluaXRpYWxpemVzIHRoZSB3b3JrZXIgd2hlbiBpdCBpcyBmaXJzdCBjcmVhdGVkIGJ5IGxvYWRpbmcgdGhlIFpvbmUuanMgcGFja2FnZVxuICogaW50byB0aGUgd29ya2VyIGluc3RhbmNlLlxuICpcbiAqIEByZXR1cm5zIEEgcHJvbWlzZSByZXNvbHZpbmcgdG8gdGhlIHJlbmRlciBmdW5jdGlvbiBvZiB0aGUgd29ya2VyLlxuICovXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplKCkge1xuICAvLyBTZXR1cCBab25lLmpzXG4gIGF3YWl0IGltcG9ydCh6b25lUGFja2FnZSk7XG5cbiAgLy8gUmV0dXJuIHRoZSByZW5kZXIgZnVuY3Rpb24gZm9yIHVzZVxuICByZXR1cm4gcmVuZGVyO1xufVxuXG4vKipcbiAqIFRoZSBkZWZhdWx0IGV4cG9ydCB3aWxsIGJlIHRoZSBwcm9taXNlIHJldHVybmVkIGJ5IHRoZSBpbml0aWFsaXplIGZ1bmN0aW9uLlxuICogVGhpcyBpcyBhd2FpdGVkIGJ5IHBpc2NpbmEgcHJpb3IgdG8gdXNpbmcgdGhlIFdvcmtlci5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgaW5pdGlhbGl6ZSgpO1xuIl19