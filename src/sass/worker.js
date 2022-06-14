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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }
    catch (error) {
        // Needed because V8 will only serialize the message and stack properties of an Error instance.
        const { formatted, file, line, column, message, stack } = error;
        worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({ id, error: { formatted, file, line, column, message, stack } });
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvc2Fzcy93b3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFFSCwrQkFBNEU7QUFDNUUsbURBQTJGO0FBcUIzRixJQUFJLENBQUMsMkJBQVUsSUFBSSxDQUFDLDJCQUFVLEVBQUU7SUFDOUIsTUFBTSxJQUFJLEtBQUssQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO0NBQzlEO0FBRUQsOEVBQThFO0FBQzlFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxjQUFjLEVBQUUsR0FBRywyQkFHOUMsQ0FBQztBQUVGLDJCQUFVLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQXdCLEVBQUUsRUFBRTtJQUM5RSxJQUFJO1FBQ0YsSUFBSSxXQUFXLEVBQUU7WUFDZixtRkFBbUY7WUFDbkYsb0RBQW9EO1lBQ3BELG9GQUFvRjtZQUNwRiwyRUFBMkU7WUFDM0UsMkVBQTJFO1lBQzNFLE9BQU8sQ0FBQyxRQUFRLEdBQUcsVUFBVSxHQUFHLEVBQUUsSUFBSTs7Z0JBQ3BDLE9BQU8sQ0FBQyxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDcEMsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQztnQkFDNUIsa0JBQWtCLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQztnQkFDOUQsT0FBTyxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUVuQyxPQUFPLE1BQUEsSUFBQSxxQ0FBb0IsRUFBQyxrQkFBa0IsQ0FBQywwQ0FBRSxPQUF5QixDQUFDO1lBQzdFLENBQUMsQ0FBQztTQUNIO1FBRUQsNEZBQTRGO1FBQzVGLE1BQU0sTUFBTSxHQUFHLElBQUEsaUJBQVUsRUFBQyxPQUFPLENBQUMsQ0FBQztRQUVuQywyQkFBVSxhQUFWLDJCQUFVLHVCQUFWLDJCQUFVLENBQUUsV0FBVyxDQUFDLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDeEMsOERBQThEO0tBQy9EO0lBQUMsT0FBTyxLQUFVLEVBQUU7UUFDbkIsK0ZBQStGO1FBQy9GLE1BQU0sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxHQUFHLEtBQUssQ0FBQztRQUNoRSwyQkFBVSxhQUFWLDJCQUFVLHVCQUFWLDJCQUFVLENBQUUsV0FBVyxDQUFDLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0tBQzNGO0FBQ0gsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgSW1wb3J0ZXJSZXN1bHQsIExlZ2FjeU9wdGlvbnMgYXMgT3B0aW9ucywgcmVuZGVyU3luYyB9IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHsgTWVzc2FnZVBvcnQsIHBhcmVudFBvcnQsIHJlY2VpdmVNZXNzYWdlT25Qb3J0LCB3b3JrZXJEYXRhIH0gZnJvbSAnd29ya2VyX3RocmVhZHMnO1xuXG4vKipcbiAqIEEgcmVxdWVzdCB0byByZW5kZXIgYSBTYXNzIHN0eWxlc2hlZXQgdXNpbmcgdGhlIHN1cHBsaWVkIG9wdGlvbnMuXG4gKi9cbmludGVyZmFjZSBSZW5kZXJSZXF1ZXN0TWVzc2FnZSB7XG4gIC8qKlxuICAgKiBUaGUgdW5pcXVlIHJlcXVlc3QgaWRlbnRpZmllciB0aGF0IGxpbmtzIHRoZSByZW5kZXIgYWN0aW9uIHdpdGggYSBjYWxsYmFjayBhbmQgb3B0aW9uYWxcbiAgICogaW1wb3J0ZXIgb24gdGhlIG1haW4gdGhyZWFkLlxuICAgKi9cbiAgaWQ6IG51bWJlcjtcbiAgLyoqXG4gICAqIFRoZSBTYXNzIG9wdGlvbnMgdG8gcHJvdmlkZSB0byB0aGUgYGRhcnQtc2Fzc2AgcmVuZGVyIGZ1bmN0aW9uLlxuICAgKi9cbiAgb3B0aW9uczogT3B0aW9uczwnc3luYyc+O1xuICAvKipcbiAgICogSW5kaWNhdGVzIHRoZSByZXF1ZXN0IGhhcyBhIGN1c3RvbSBpbXBvcnRlciBmdW5jdGlvbiBvbiB0aGUgbWFpbiB0aHJlYWQuXG4gICAqL1xuICBoYXNJbXBvcnRlcjogYm9vbGVhbjtcbn1cblxuaWYgKCFwYXJlbnRQb3J0IHx8ICF3b3JrZXJEYXRhKSB7XG4gIHRocm93IG5ldyBFcnJvcignU2FzcyB3b3JrZXIgbXVzdCBiZSBleGVjdXRlZCBhcyBhIFdvcmtlci4nKTtcbn1cblxuLy8gVGhlIGltcG9ydGVyIHZhcmlhYmxlcyBhcmUgdXNlZCB0byBwcm94eSBpbXBvcnQgcmVxdWVzdHMgdG8gdGhlIG1haW4gdGhyZWFkXG5jb25zdCB7IHdvcmtlckltcG9ydGVyUG9ydCwgaW1wb3J0ZXJTaWduYWwgfSA9IHdvcmtlckRhdGEgYXMge1xuICB3b3JrZXJJbXBvcnRlclBvcnQ6IE1lc3NhZ2VQb3J0O1xuICBpbXBvcnRlclNpZ25hbDogSW50MzJBcnJheTtcbn07XG5cbnBhcmVudFBvcnQub24oJ21lc3NhZ2UnLCAoeyBpZCwgaGFzSW1wb3J0ZXIsIG9wdGlvbnMgfTogUmVuZGVyUmVxdWVzdE1lc3NhZ2UpID0+IHtcbiAgdHJ5IHtcbiAgICBpZiAoaGFzSW1wb3J0ZXIpIHtcbiAgICAgIC8vIFdoZW4gYSBjdXN0b20gaW1wb3J0ZXIgZnVuY3Rpb24gaXMgcHJlc2VudCwgdGhlIGltcG9ydGVyIHJlcXVlc3QgbXVzdCBiZSBwcm94aWVkXG4gICAgICAvLyBiYWNrIHRvIHRoZSBtYWluIHRocmVhZCB3aGVyZSBpdCBjYW4gYmUgZXhlY3V0ZWQuXG4gICAgICAvLyBUaGlzIHByb2Nlc3MgbXVzdCBiZSBzeW5jaHJvbm91cyBmcm9tIHRoZSBwZXJzcGVjdGl2ZSBvZiBkYXJ0LXNhc3MuIFRoZSBgQXRvbWljc2BcbiAgICAgIC8vIGZ1bmN0aW9ucyBjb21iaW5lZCB3aXRoIHRoZSBzaGFyZWQgbWVtb3J5IGBpbXBvcnRTaWduYWxgIGFuZCB0aGUgTm9kZS5qc1xuICAgICAgLy8gYHJlY2VpdmVNZXNzYWdlT25Qb3J0YCBmdW5jdGlvbiBhcmUgdXNlZCB0byBlbnN1cmUgc3luY2hyb25vdXMgYmVoYXZpb3IuXG4gICAgICBvcHRpb25zLmltcG9ydGVyID0gZnVuY3Rpb24gKHVybCwgcHJldikge1xuICAgICAgICBBdG9taWNzLnN0b3JlKGltcG9ydGVyU2lnbmFsLCAwLCAwKTtcbiAgICAgICAgY29uc3QgeyBmcm9tSW1wb3J0IH0gPSB0aGlzO1xuICAgICAgICB3b3JrZXJJbXBvcnRlclBvcnQucG9zdE1lc3NhZ2UoeyBpZCwgdXJsLCBwcmV2LCBmcm9tSW1wb3J0IH0pO1xuICAgICAgICBBdG9taWNzLndhaXQoaW1wb3J0ZXJTaWduYWwsIDAsIDApO1xuXG4gICAgICAgIHJldHVybiByZWNlaXZlTWVzc2FnZU9uUG9ydCh3b3JrZXJJbXBvcnRlclBvcnQpPy5tZXNzYWdlIGFzIEltcG9ydGVyUmVzdWx0O1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBUaGUgc3luY2hyb25vdXMgU2FzcyByZW5kZXIgZnVuY3Rpb24gY2FuIGJlIHVwIHRvIHR3byB0aW1lcyBmYXN0ZXIgdGhhbiB0aGUgYXN5bmMgdmFyaWFudFxuICAgIGNvbnN0IHJlc3VsdCA9IHJlbmRlclN5bmMob3B0aW9ucyk7XG5cbiAgICBwYXJlbnRQb3J0Py5wb3N0TWVzc2FnZSh7IGlkLCByZXN1bHQgfSk7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgIC8vIE5lZWRlZCBiZWNhdXNlIFY4IHdpbGwgb25seSBzZXJpYWxpemUgdGhlIG1lc3NhZ2UgYW5kIHN0YWNrIHByb3BlcnRpZXMgb2YgYW4gRXJyb3IgaW5zdGFuY2UuXG4gICAgY29uc3QgeyBmb3JtYXR0ZWQsIGZpbGUsIGxpbmUsIGNvbHVtbiwgbWVzc2FnZSwgc3RhY2sgfSA9IGVycm9yO1xuICAgIHBhcmVudFBvcnQ/LnBvc3RNZXNzYWdlKHsgaWQsIGVycm9yOiB7IGZvcm1hdHRlZCwgZmlsZSwgbGluZSwgY29sdW1uLCBtZXNzYWdlLCBzdGFjayB9IH0pO1xuICB9XG59KTtcbiJdfQ==