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
    const { ɵSERVER_CONTEXT, AppServerModule, renderModule, renderApplication, default: bootstrapAppFn, } = (await Promise.resolve(`${serverBundlePath}`).then(s => __importStar(require(s))));
    (0, node_assert_1.default)(ɵSERVER_CONTEXT, `ɵSERVER_CONTEXT was not exported from: ${serverBundlePath}.`);
    const platformProviders = [
        {
            provide: ɵSERVER_CONTEXT,
            useValue: 'app-shell',
        },
    ];
    // Render platform server module
    if (isBootstrapFn(bootstrapAppFn)) {
        (0, node_assert_1.default)(renderApplication, `renderApplication was not exported from: ${serverBundlePath}.`);
        return renderApplication(bootstrapAppFn, {
            document,
            url,
            platformProviders,
        });
    }
    (0, node_assert_1.default)(renderModule, `renderModule was not exported from: ${serverBundlePath}.`);
    const moduleClass = bootstrapAppFn || AppServerModule;
    (0, node_assert_1.default)(moduleClass, `Neither an AppServerModule nor a bootstrapping function was exported from: ${serverBundlePath}.`);
    return renderModule(moduleClass, {
        document,
        url,
        extraProviders: platformProviders,
    });
}
function isBootstrapFn(value) {
    // We can differentiate between a module and a bootstrap function by reading compiler-generated `ɵmod` static property:
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
    // Return the render function for use
    return render;
}
/**
 * The default export will be the promise returned by the initialize function.
 * This is awaited by piscina prior to using the Worker.
 */
exports.default = initialize();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXdvcmtlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcC1zaGVsbC9yZW5kZXItd29ya2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJSCw4REFBaUM7QUFDakMsNkRBQWlEO0FBRWpEOzs7R0FHRztBQUNILE1BQU0sRUFBRSxXQUFXLEVBQUUsR0FBRyxnQ0FFdkIsQ0FBQztBQXFDRjs7OztHQUlHO0FBQ0gsS0FBSyxVQUFVLE1BQU0sQ0FBQyxFQUFFLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQWlCO0lBQ3RFLE1BQU0sRUFDSixlQUFlLEVBQ2YsZUFBZSxFQUNmLFlBQVksRUFDWixpQkFBaUIsRUFDakIsT0FBTyxFQUFFLGNBQWMsR0FDeEIsR0FBRyxDQUFDLHlCQUFhLGdCQUFnQix1Q0FBQyxDQUF3QixDQUFDO0lBRTVELElBQUEscUJBQU0sRUFBQyxlQUFlLEVBQUUsMENBQTBDLGdCQUFnQixHQUFHLENBQUMsQ0FBQztJQUV2RixNQUFNLGlCQUFpQixHQUFxQjtRQUMxQztZQUNFLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLFFBQVEsRUFBRSxXQUFXO1NBQ3RCO0tBQ0YsQ0FBQztJQUVGLGdDQUFnQztJQUNoQyxJQUFJLGFBQWEsQ0FBQyxjQUFjLENBQUMsRUFBRTtRQUNqQyxJQUFBLHFCQUFNLEVBQUMsaUJBQWlCLEVBQUUsNENBQTRDLGdCQUFnQixHQUFHLENBQUMsQ0FBQztRQUUzRixPQUFPLGlCQUFpQixDQUFDLGNBQWMsRUFBRTtZQUN2QyxRQUFRO1lBQ1IsR0FBRztZQUNILGlCQUFpQjtTQUNsQixDQUFDLENBQUM7S0FDSjtJQUNELElBQUEscUJBQU0sRUFBQyxZQUFZLEVBQUUsdUNBQXVDLGdCQUFnQixHQUFHLENBQUMsQ0FBQztJQUNqRixNQUFNLFdBQVcsR0FBRyxjQUFjLElBQUksZUFBZSxDQUFDO0lBQ3RELElBQUEscUJBQU0sRUFDSixXQUFXLEVBQ1gsOEVBQThFLGdCQUFnQixHQUFHLENBQ2xHLENBQUM7SUFFRixPQUFPLFlBQVksQ0FBQyxXQUFXLEVBQUU7UUFDL0IsUUFBUTtRQUNSLEdBQUc7UUFDSCxjQUFjLEVBQUUsaUJBQWlCO0tBQ2xDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxTQUFTLGFBQWEsQ0FBQyxLQUFjO0lBQ25DLHVIQUF1SDtJQUN2SCxPQUFPLE9BQU8sS0FBSyxLQUFLLFVBQVUsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDO0FBQzNELENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILEtBQUssVUFBVSxVQUFVO0lBQ3ZCLGdCQUFnQjtJQUNoQix5QkFBYSxXQUFXLHVDQUFDLENBQUM7SUFFMUIscUNBQXFDO0lBQ3JDLE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxrQkFBZSxVQUFVLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEFwcGxpY2F0aW9uUmVmLCBTdGF0aWNQcm92aWRlciwgVHlwZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHR5cGUgeyByZW5kZXJBcHBsaWNhdGlvbiwgcmVuZGVyTW9kdWxlLCDJtVNFUlZFUl9DT05URVhUIH0gZnJvbSAnQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnbm9kZTphc3NlcnQnO1xuaW1wb3J0IHsgd29ya2VyRGF0YSB9IGZyb20gJ25vZGU6d29ya2VyX3RocmVhZHMnO1xuXG4vKipcbiAqIFRoZSBmdWxseSByZXNvbHZlZCBwYXRoIHRvIHRoZSB6b25lLmpzIHBhY2thZ2UgdGhhdCB3aWxsIGJlIGxvYWRlZCBkdXJpbmcgd29ya2VyIGluaXRpYWxpemF0aW9uLlxuICogVGhpcyBpcyBwYXNzZWQgYXMgd29ya2VyRGF0YSB3aGVuIHNldHRpbmcgdXAgdGhlIHdvcmtlciB2aWEgdGhlIGBwaXNjaW5hYCBwYWNrYWdlLlxuICovXG5jb25zdCB7IHpvbmVQYWNrYWdlIH0gPSB3b3JrZXJEYXRhIGFzIHtcbiAgem9uZVBhY2thZ2U6IHN0cmluZztcbn07XG5cbmludGVyZmFjZSBTZXJ2ZXJCdW5kbGVFeHBvcnRzIHtcbiAgLyoqIEFuIGludGVybmFsIHRva2VuIHRoYXQgYWxsb3dzIHByb3ZpZGluZyBleHRyYSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgc2VydmVyIGNvbnRleHQuICovXG4gIMm1U0VSVkVSX0NPTlRFWFQ/OiB0eXBlb2YgybVTRVJWRVJfQ09OVEVYVDtcblxuICAvKiogUmVuZGVyIGFuIE5nTW9kdWxlIGFwcGxpY2F0aW9uLiAqL1xuICByZW5kZXJNb2R1bGU/OiB0eXBlb2YgcmVuZGVyTW9kdWxlO1xuXG4gIC8qKiBOZ01vZHVsZSB0byByZW5kZXIuICovXG4gIEFwcFNlcnZlck1vZHVsZT86IFR5cGU8dW5rbm93bj47XG5cbiAgLyoqIE1ldGhvZCB0byByZW5kZXIgYSBzdGFuZGFsb25lIGFwcGxpY2F0aW9uLiAqL1xuICByZW5kZXJBcHBsaWNhdGlvbj86IHR5cGVvZiByZW5kZXJBcHBsaWNhdGlvbjtcblxuICAvKiogU3RhbmRhbG9uZSBhcHBsaWNhdGlvbiBib290c3RyYXBwaW5nIGZ1bmN0aW9uLiAqL1xuICBkZWZhdWx0PzogKCkgPT4gUHJvbWlzZTxBcHBsaWNhdGlvblJlZj47XG59XG5cbi8qKlxuICogQSByZXF1ZXN0IHRvIHJlbmRlciBhIFNlcnZlciBidW5kbGUgZ2VuZXJhdGUgYnkgdGhlIHVuaXZlcnNhbCBzZXJ2ZXIgYnVpbGRlci5cbiAqL1xuaW50ZXJmYWNlIFJlbmRlclJlcXVlc3Qge1xuICAvKipcbiAgICogVGhlIHBhdGggdG8gdGhlIHNlcnZlciBidW5kbGUgdGhhdCBzaG91bGQgYmUgbG9hZGVkIGFuZCByZW5kZXJlZC5cbiAgICovXG4gIHNlcnZlckJ1bmRsZVBhdGg6IHN0cmluZztcbiAgLyoqXG4gICAqIFRoZSBleGlzdGluZyBIVE1MIGRvY3VtZW50IGFzIGEgc3RyaW5nIHRoYXQgd2lsbCBiZSBhdWdtZW50ZWQgd2l0aCB0aGUgcmVuZGVyZWQgYXBwbGljYXRpb24uXG4gICAqL1xuICBkb2N1bWVudDogc3RyaW5nO1xuICAvKipcbiAgICogQW4gb3B0aW9uYWwgVVJMIHBhdGggdGhhdCByZXByZXNlbnRzIHRoZSBBbmd1bGFyIHJvdXRlIHRoYXQgc2hvdWxkIGJlIHJlbmRlcmVkLlxuICAgKi9cbiAgdXJsOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogUmVuZGVycyBhbiBhcHBsaWNhdGlvbiBiYXNlZCBvbiBhIHByb3ZpZGVkIHNlcnZlciBidW5kbGUgcGF0aCwgaW5pdGlhbCBkb2N1bWVudCwgYW5kIG9wdGlvbmFsIFVSTCByb3V0ZS5cbiAqIEBwYXJhbSBwYXJhbTAgQSByZXF1ZXN0IHRvIHJlbmRlciBhIHNlcnZlciBidW5kbGUuXG4gKiBAcmV0dXJucyBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byB0aGUgcmVuZGVyIEhUTUwgZG9jdW1lbnQgZm9yIHRoZSBhcHBsaWNhdGlvbi5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcmVuZGVyKHsgc2VydmVyQnVuZGxlUGF0aCwgZG9jdW1lbnQsIHVybCB9OiBSZW5kZXJSZXF1ZXN0KTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgY29uc3Qge1xuICAgIMm1U0VSVkVSX0NPTlRFWFQsXG4gICAgQXBwU2VydmVyTW9kdWxlLFxuICAgIHJlbmRlck1vZHVsZSxcbiAgICByZW5kZXJBcHBsaWNhdGlvbixcbiAgICBkZWZhdWx0OiBib290c3RyYXBBcHBGbixcbiAgfSA9IChhd2FpdCBpbXBvcnQoc2VydmVyQnVuZGxlUGF0aCkpIGFzIFNlcnZlckJ1bmRsZUV4cG9ydHM7XG5cbiAgYXNzZXJ0KMm1U0VSVkVSX0NPTlRFWFQsIGDJtVNFUlZFUl9DT05URVhUIHdhcyBub3QgZXhwb3J0ZWQgZnJvbTogJHtzZXJ2ZXJCdW5kbGVQYXRofS5gKTtcblxuICBjb25zdCBwbGF0Zm9ybVByb3ZpZGVyczogU3RhdGljUHJvdmlkZXJbXSA9IFtcbiAgICB7XG4gICAgICBwcm92aWRlOiDJtVNFUlZFUl9DT05URVhULFxuICAgICAgdXNlVmFsdWU6ICdhcHAtc2hlbGwnLFxuICAgIH0sXG4gIF07XG5cbiAgLy8gUmVuZGVyIHBsYXRmb3JtIHNlcnZlciBtb2R1bGVcbiAgaWYgKGlzQm9vdHN0cmFwRm4oYm9vdHN0cmFwQXBwRm4pKSB7XG4gICAgYXNzZXJ0KHJlbmRlckFwcGxpY2F0aW9uLCBgcmVuZGVyQXBwbGljYXRpb24gd2FzIG5vdCBleHBvcnRlZCBmcm9tOiAke3NlcnZlckJ1bmRsZVBhdGh9LmApO1xuXG4gICAgcmV0dXJuIHJlbmRlckFwcGxpY2F0aW9uKGJvb3RzdHJhcEFwcEZuLCB7XG4gICAgICBkb2N1bWVudCxcbiAgICAgIHVybCxcbiAgICAgIHBsYXRmb3JtUHJvdmlkZXJzLFxuICAgIH0pO1xuICB9XG4gIGFzc2VydChyZW5kZXJNb2R1bGUsIGByZW5kZXJNb2R1bGUgd2FzIG5vdCBleHBvcnRlZCBmcm9tOiAke3NlcnZlckJ1bmRsZVBhdGh9LmApO1xuICBjb25zdCBtb2R1bGVDbGFzcyA9IGJvb3RzdHJhcEFwcEZuIHx8IEFwcFNlcnZlck1vZHVsZTtcbiAgYXNzZXJ0KFxuICAgIG1vZHVsZUNsYXNzLFxuICAgIGBOZWl0aGVyIGFuIEFwcFNlcnZlck1vZHVsZSBub3IgYSBib290c3RyYXBwaW5nIGZ1bmN0aW9uIHdhcyBleHBvcnRlZCBmcm9tOiAke3NlcnZlckJ1bmRsZVBhdGh9LmAsXG4gICk7XG5cbiAgcmV0dXJuIHJlbmRlck1vZHVsZShtb2R1bGVDbGFzcywge1xuICAgIGRvY3VtZW50LFxuICAgIHVybCxcbiAgICBleHRyYVByb3ZpZGVyczogcGxhdGZvcm1Qcm92aWRlcnMsXG4gIH0pO1xufVxuXG5mdW5jdGlvbiBpc0Jvb3RzdHJhcEZuKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgKCkgPT4gUHJvbWlzZTxBcHBsaWNhdGlvblJlZj4ge1xuICAvLyBXZSBjYW4gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIGEgbW9kdWxlIGFuZCBhIGJvb3RzdHJhcCBmdW5jdGlvbiBieSByZWFkaW5nIGNvbXBpbGVyLWdlbmVyYXRlZCBgybVtb2RgIHN0YXRpYyBwcm9wZXJ0eTpcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyAmJiAhKCfJtW1vZCcgaW4gdmFsdWUpO1xufVxuXG4vKipcbiAqIEluaXRpYWxpemVzIHRoZSB3b3JrZXIgd2hlbiBpdCBpcyBmaXJzdCBjcmVhdGVkIGJ5IGxvYWRpbmcgdGhlIFpvbmUuanMgcGFja2FnZVxuICogaW50byB0aGUgd29ya2VyIGluc3RhbmNlLlxuICpcbiAqIEByZXR1cm5zIEEgcHJvbWlzZSByZXNvbHZpbmcgdG8gdGhlIHJlbmRlciBmdW5jdGlvbiBvZiB0aGUgd29ya2VyLlxuICovXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplKCkge1xuICAvLyBTZXR1cCBab25lLmpzXG4gIGF3YWl0IGltcG9ydCh6b25lUGFja2FnZSk7XG5cbiAgLy8gUmV0dXJuIHRoZSByZW5kZXIgZnVuY3Rpb24gZm9yIHVzZVxuICByZXR1cm4gcmVuZGVyO1xufVxuXG4vKipcbiAqIFRoZSBkZWZhdWx0IGV4cG9ydCB3aWxsIGJlIHRoZSBwcm9taXNlIHJldHVybmVkIGJ5IHRoZSBpbml0aWFsaXplIGZ1bmN0aW9uLlxuICogVGhpcyBpcyBhd2FpdGVkIGJ5IHBpc2NpbmEgcHJpb3IgdG8gdXNpbmcgdGhlIFdvcmtlci5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgaW5pdGlhbGl6ZSgpO1xuIl19