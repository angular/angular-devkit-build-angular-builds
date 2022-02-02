"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const sass_1 = require("sass");
const worker_threads_1 = require("worker_threads");
if (!worker_threads_1.parentPort || !worker_threads_1.workerData) {
    throw new Error('Sass worker must be executed as a Worker.');
}
// The importer variables are used to proxy import requests to the main thread
const { workerImporterPort, importerSignal } = worker_threads_1.workerData;
worker_threads_1.parentPort.on('message', ({ id, hasImporter, options }) => {
    try {
        if (hasImporter) {
            // When a custom importer function is present, the importer request must be proxied
            // back to the main thread where it can be executed.
            // This process must be synchronous from the perspective of dart-sass. The `Atomics`
            // functions combined with the shared memory `importSignal` and the Node.js
            // `receiveMessageOnPort` function are used to ensure synchronous behavior.
            options.importer = function (url, prev) {
                var _a;
                Atomics.store(importerSignal, 0, 0);
                const { fromImport } = this;
                workerImporterPort.postMessage({ id, url, prev, fromImport });
                Atomics.wait(importerSignal, 0, 0);
                return (_a = (0, worker_threads_1.receiveMessageOnPort)(workerImporterPort)) === null || _a === void 0 ? void 0 : _a.message;
            };
        }
        // The synchronous Sass render function can be up to two times faster than the async variant
        const result = (0, sass_1.renderSync)(options);
        worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({ id, result });
    }
    catch (error) {
        // Needed because V8 will only serialize the message and stack properties of an Error instance.
        const { formatted, file, line, column, message, stack } = error;
        worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({ id, error: { formatted, file, line, column, message, stack } });
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvc2Fzcy93b3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFFSCwrQkFBNEU7QUFDNUUsbURBQTJGO0FBcUIzRixJQUFJLENBQUMsMkJBQVUsSUFBSSxDQUFDLDJCQUFVLEVBQUU7SUFDOUIsTUFBTSxJQUFJLEtBQUssQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO0NBQzlEO0FBRUQsOEVBQThFO0FBQzlFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxjQUFjLEVBQUUsR0FBRywyQkFHOUMsQ0FBQztBQUVGLDJCQUFVLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQXdCLEVBQUUsRUFBRTtJQUM5RSxJQUFJO1FBQ0YsSUFBSSxXQUFXLEVBQUU7WUFDZixtRkFBbUY7WUFDbkYsb0RBQW9EO1lBQ3BELG9GQUFvRjtZQUNwRiwyRUFBMkU7WUFDM0UsMkVBQTJFO1lBQzNFLE9BQU8sQ0FBQyxRQUFRLEdBQUcsVUFBVSxHQUFHLEVBQUUsSUFBSTs7Z0JBQ3BDLE9BQU8sQ0FBQyxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDcEMsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQztnQkFDNUIsa0JBQWtCLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQztnQkFDOUQsT0FBTyxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUVuQyxPQUFPLE1BQUEsSUFBQSxxQ0FBb0IsRUFBQyxrQkFBa0IsQ0FBQywwQ0FBRSxPQUF5QixDQUFDO1lBQzdFLENBQUMsQ0FBQztTQUNIO1FBRUQsNEZBQTRGO1FBQzVGLE1BQU0sTUFBTSxHQUFHLElBQUEsaUJBQVUsRUFBQyxPQUFPLENBQUMsQ0FBQztRQUVuQywyQkFBVSxhQUFWLDJCQUFVLHVCQUFWLDJCQUFVLENBQUUsV0FBVyxDQUFDLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7S0FDekM7SUFBQyxPQUFPLEtBQUssRUFBRTtRQUNkLCtGQUErRjtRQUMvRixNQUFNLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFDaEUsMkJBQVUsYUFBViwyQkFBVSx1QkFBViwyQkFBVSxDQUFFLFdBQVcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztLQUMzRjtBQUNILENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEltcG9ydGVyUmVzdWx0LCBMZWdhY3lPcHRpb25zIGFzIE9wdGlvbnMsIHJlbmRlclN5bmMgfSBmcm9tICdzYXNzJztcbmltcG9ydCB7IE1lc3NhZ2VQb3J0LCBwYXJlbnRQb3J0LCByZWNlaXZlTWVzc2FnZU9uUG9ydCwgd29ya2VyRGF0YSB9IGZyb20gJ3dvcmtlcl90aHJlYWRzJztcblxuLyoqXG4gKiBBIHJlcXVlc3QgdG8gcmVuZGVyIGEgU2FzcyBzdHlsZXNoZWV0IHVzaW5nIHRoZSBzdXBwbGllZCBvcHRpb25zLlxuICovXG5pbnRlcmZhY2UgUmVuZGVyUmVxdWVzdE1lc3NhZ2Uge1xuICAvKipcbiAgICogVGhlIHVuaXF1ZSByZXF1ZXN0IGlkZW50aWZpZXIgdGhhdCBsaW5rcyB0aGUgcmVuZGVyIGFjdGlvbiB3aXRoIGEgY2FsbGJhY2sgYW5kIG9wdGlvbmFsXG4gICAqIGltcG9ydGVyIG9uIHRoZSBtYWluIHRocmVhZC5cbiAgICovXG4gIGlkOiBudW1iZXI7XG4gIC8qKlxuICAgKiBUaGUgU2FzcyBvcHRpb25zIHRvIHByb3ZpZGUgdG8gdGhlIGBkYXJ0LXNhc3NgIHJlbmRlciBmdW5jdGlvbi5cbiAgICovXG4gIG9wdGlvbnM6IE9wdGlvbnM8J3N5bmMnPjtcbiAgLyoqXG4gICAqIEluZGljYXRlcyB0aGUgcmVxdWVzdCBoYXMgYSBjdXN0b20gaW1wb3J0ZXIgZnVuY3Rpb24gb24gdGhlIG1haW4gdGhyZWFkLlxuICAgKi9cbiAgaGFzSW1wb3J0ZXI6IGJvb2xlYW47XG59XG5cbmlmICghcGFyZW50UG9ydCB8fCAhd29ya2VyRGF0YSkge1xuICB0aHJvdyBuZXcgRXJyb3IoJ1Nhc3Mgd29ya2VyIG11c3QgYmUgZXhlY3V0ZWQgYXMgYSBXb3JrZXIuJyk7XG59XG5cbi8vIFRoZSBpbXBvcnRlciB2YXJpYWJsZXMgYXJlIHVzZWQgdG8gcHJveHkgaW1wb3J0IHJlcXVlc3RzIHRvIHRoZSBtYWluIHRocmVhZFxuY29uc3QgeyB3b3JrZXJJbXBvcnRlclBvcnQsIGltcG9ydGVyU2lnbmFsIH0gPSB3b3JrZXJEYXRhIGFzIHtcbiAgd29ya2VySW1wb3J0ZXJQb3J0OiBNZXNzYWdlUG9ydDtcbiAgaW1wb3J0ZXJTaWduYWw6IEludDMyQXJyYXk7XG59O1xuXG5wYXJlbnRQb3J0Lm9uKCdtZXNzYWdlJywgKHsgaWQsIGhhc0ltcG9ydGVyLCBvcHRpb25zIH06IFJlbmRlclJlcXVlc3RNZXNzYWdlKSA9PiB7XG4gIHRyeSB7XG4gICAgaWYgKGhhc0ltcG9ydGVyKSB7XG4gICAgICAvLyBXaGVuIGEgY3VzdG9tIGltcG9ydGVyIGZ1bmN0aW9uIGlzIHByZXNlbnQsIHRoZSBpbXBvcnRlciByZXF1ZXN0IG11c3QgYmUgcHJveGllZFxuICAgICAgLy8gYmFjayB0byB0aGUgbWFpbiB0aHJlYWQgd2hlcmUgaXQgY2FuIGJlIGV4ZWN1dGVkLlxuICAgICAgLy8gVGhpcyBwcm9jZXNzIG11c3QgYmUgc3luY2hyb25vdXMgZnJvbSB0aGUgcGVyc3BlY3RpdmUgb2YgZGFydC1zYXNzLiBUaGUgYEF0b21pY3NgXG4gICAgICAvLyBmdW5jdGlvbnMgY29tYmluZWQgd2l0aCB0aGUgc2hhcmVkIG1lbW9yeSBgaW1wb3J0U2lnbmFsYCBhbmQgdGhlIE5vZGUuanNcbiAgICAgIC8vIGByZWNlaXZlTWVzc2FnZU9uUG9ydGAgZnVuY3Rpb24gYXJlIHVzZWQgdG8gZW5zdXJlIHN5bmNocm9ub3VzIGJlaGF2aW9yLlxuICAgICAgb3B0aW9ucy5pbXBvcnRlciA9IGZ1bmN0aW9uICh1cmwsIHByZXYpIHtcbiAgICAgICAgQXRvbWljcy5zdG9yZShpbXBvcnRlclNpZ25hbCwgMCwgMCk7XG4gICAgICAgIGNvbnN0IHsgZnJvbUltcG9ydCB9ID0gdGhpcztcbiAgICAgICAgd29ya2VySW1wb3J0ZXJQb3J0LnBvc3RNZXNzYWdlKHsgaWQsIHVybCwgcHJldiwgZnJvbUltcG9ydCB9KTtcbiAgICAgICAgQXRvbWljcy53YWl0KGltcG9ydGVyU2lnbmFsLCAwLCAwKTtcblxuICAgICAgICByZXR1cm4gcmVjZWl2ZU1lc3NhZ2VPblBvcnQod29ya2VySW1wb3J0ZXJQb3J0KT8ubWVzc2FnZSBhcyBJbXBvcnRlclJlc3VsdDtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gVGhlIHN5bmNocm9ub3VzIFNhc3MgcmVuZGVyIGZ1bmN0aW9uIGNhbiBiZSB1cCB0byB0d28gdGltZXMgZmFzdGVyIHRoYW4gdGhlIGFzeW5jIHZhcmlhbnRcbiAgICBjb25zdCByZXN1bHQgPSByZW5kZXJTeW5jKG9wdGlvbnMpO1xuXG4gICAgcGFyZW50UG9ydD8ucG9zdE1lc3NhZ2UoeyBpZCwgcmVzdWx0IH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIE5lZWRlZCBiZWNhdXNlIFY4IHdpbGwgb25seSBzZXJpYWxpemUgdGhlIG1lc3NhZ2UgYW5kIHN0YWNrIHByb3BlcnRpZXMgb2YgYW4gRXJyb3IgaW5zdGFuY2UuXG4gICAgY29uc3QgeyBmb3JtYXR0ZWQsIGZpbGUsIGxpbmUsIGNvbHVtbiwgbWVzc2FnZSwgc3RhY2sgfSA9IGVycm9yO1xuICAgIHBhcmVudFBvcnQ/LnBvc3RNZXNzYWdlKHsgaWQsIGVycm9yOiB7IGZvcm1hdHRlZCwgZmlsZSwgbGluZSwgY29sdW1uLCBtZXNzYWdlLCBzdGFjayB9IH0pO1xuICB9XG59KTtcbiJdfQ==