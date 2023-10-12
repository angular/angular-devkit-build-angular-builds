"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getESMLoaderArgs = exports.callInitializeIfNeeded = void 0;
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const node_worker_threads_1 = require("node:worker_threads");
let IS_NODE_18;
function isNode18() {
    return (IS_NODE_18 ??= process.versions.node.startsWith('18.'));
}
/** Call the initialize hook when running on Node.js 18 */
function callInitializeIfNeeded(initialize) {
    if (isNode18()) {
        initialize(node_worker_threads_1.workerData);
    }
}
exports.callInitializeIfNeeded = callInitializeIfNeeded;
function getESMLoaderArgs() {
    if (isNode18()) {
        return [
            '--no-warnings',
            '--loader',
            (0, node_url_1.pathToFileURL)((0, node_path_1.join)(__dirname, 'loader-hooks.js')).href, // Loader cannot be an absolute path on Windows.
        ];
    }
    return [
        '--import',
        (0, node_url_1.pathToFileURL)((0, node_path_1.join)(__dirname, 'register-hooks.js')).href, // Loader cannot be an absolute path on Windows.
    ];
}
exports.getESMLoaderArgs = getESMLoaderArgs;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZS0xOC11dGlscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL3NlcnZlci1yZW5kZXJpbmcvZXNtLWluLW1lbW9yeS1sb2FkZXIvbm9kZS0xOC11dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCx5Q0FBaUM7QUFDakMsdUNBQXlDO0FBQ3pDLDZEQUFpRDtBQUVqRCxJQUFJLFVBQStCLENBQUM7QUFDcEMsU0FBUyxRQUFRO0lBQ2YsT0FBTyxDQUFDLFVBQVUsS0FBSyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUNsRSxDQUFDO0FBRUQsMERBQTBEO0FBQzFELFNBQWdCLHNCQUFzQixDQUNwQyxVQUEyRDtJQUUzRCxJQUFJLFFBQVEsRUFBRSxFQUFFO1FBQ2QsVUFBVSxDQUFDLGdDQUFVLENBQUMsQ0FBQztLQUN4QjtBQUNILENBQUM7QUFORCx3REFNQztBQUVELFNBQWdCLGdCQUFnQjtJQUM5QixJQUFJLFFBQVEsRUFBRSxFQUFFO1FBQ2QsT0FBTztZQUNMLGVBQWU7WUFDZixVQUFVO1lBQ1YsSUFBQSx3QkFBYSxFQUFDLElBQUEsZ0JBQUksRUFBQyxTQUFTLEVBQUUsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxnREFBZ0Q7U0FDekcsQ0FBQztLQUNIO0lBRUQsT0FBTztRQUNMLFVBQVU7UUFDVixJQUFBLHdCQUFhLEVBQUMsSUFBQSxnQkFBSSxFQUFDLFNBQVMsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLGdEQUFnRDtLQUMzRyxDQUFDO0FBQ0osQ0FBQztBQWJELDRDQWFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IGpvaW4gfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB7IHdvcmtlckRhdGEgfSBmcm9tICdub2RlOndvcmtlcl90aHJlYWRzJztcblxubGV0IElTX05PREVfMTg6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5mdW5jdGlvbiBpc05vZGUxOCgpOiBib29sZWFuIHtcbiAgcmV0dXJuIChJU19OT0RFXzE4ID8/PSBwcm9jZXNzLnZlcnNpb25zLm5vZGUuc3RhcnRzV2l0aCgnMTguJykpO1xufVxuXG4vKiogQ2FsbCB0aGUgaW5pdGlhbGl6ZSBob29rIHdoZW4gcnVubmluZyBvbiBOb2RlLmpzIDE4ICovXG5leHBvcnQgZnVuY3Rpb24gY2FsbEluaXRpYWxpemVJZk5lZWRlZChcbiAgaW5pdGlhbGl6ZTogKHR5cGVvZiBpbXBvcnQoJy4vbG9hZGVyLWhvb2tzJykpWydpbml0aWFsaXplJ10sXG4pOiB2b2lkIHtcbiAgaWYgKGlzTm9kZTE4KCkpIHtcbiAgICBpbml0aWFsaXplKHdvcmtlckRhdGEpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRFU01Mb2FkZXJBcmdzKCk6IHN0cmluZ1tdIHtcbiAgaWYgKGlzTm9kZTE4KCkpIHtcbiAgICByZXR1cm4gW1xuICAgICAgJy0tbm8td2FybmluZ3MnLCAvLyBTdXBwcmVzcyBgRXhwZXJpbWVudGFsV2FybmluZzogQ3VzdG9tIEVTTSBMb2FkZXJzIGlzIGFuIGV4cGVyaW1lbnRhbCBmZWF0dXJlLi4uYC5cbiAgICAgICctLWxvYWRlcicsXG4gICAgICBwYXRoVG9GaWxlVVJMKGpvaW4oX19kaXJuYW1lLCAnbG9hZGVyLWhvb2tzLmpzJykpLmhyZWYsIC8vIExvYWRlciBjYW5ub3QgYmUgYW4gYWJzb2x1dGUgcGF0aCBvbiBXaW5kb3dzLlxuICAgIF07XG4gIH1cblxuICByZXR1cm4gW1xuICAgICctLWltcG9ydCcsXG4gICAgcGF0aFRvRmlsZVVSTChqb2luKF9fZGlybmFtZSwgJ3JlZ2lzdGVyLWhvb2tzLmpzJykpLmhyZWYsIC8vIExvYWRlciBjYW5ub3QgYmUgYW4gYWJzb2x1dGUgcGF0aCBvbiBXaW5kb3dzLlxuICBdO1xufVxuIl19