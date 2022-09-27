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
const url_1 = require("url");
const worker_threads_1 = require("worker_threads");
if (!worker_threads_1.parentPort || !worker_threads_1.workerData) {
    throw new Error('Sass worker must be executed as a Worker.');
}
// The importer variables are used to proxy import requests to the main thread
const { workerImporterPort, importerSignal } = worker_threads_1.workerData;
worker_threads_1.parentPort.on('message', ({ id, hasImporter, source, options }) => {
    if (!worker_threads_1.parentPort) {
        throw new Error('"parentPort" is not defined. Sass worker must be executed as a Worker.');
    }
    try {
        if (hasImporter) {
            // When a custom importer function is present, the importer request must be proxied
            // back to the main thread where it can be executed.
            // This process must be synchronous from the perspective of dart-sass. The `Atomics`
            // functions combined with the shared memory `importSignal` and the Node.js
            // `receiveMessageOnPort` function are used to ensure synchronous behavior.
            options.importers = [
                {
                    findFileUrl: (url, options) => {
                        var _a;
                        Atomics.store(importerSignal, 0, 0);
                        workerImporterPort.postMessage({ id, url, options });
                        Atomics.wait(importerSignal, 0, 0);
                        const result = (_a = (0, worker_threads_1.receiveMessageOnPort)(workerImporterPort)) === null || _a === void 0 ? void 0 : _a.message;
                        return result ? (0, url_1.pathToFileURL)(result) : null;
                    },
                },
            ];
        }
        // The synchronous Sass render function can be up to two times faster than the async variant
        const result = (0, sass_1.compileString)(source, {
            ...options,
            // URL is not serializable so to convert to string in the parent and back to URL here.
            url: options.url ? (0, url_1.pathToFileURL)(options.url) : undefined,
        });
        worker_threads_1.parentPort.postMessage({
            id,
            result: {
                ...result,
                // URL is not serializable so to convert to string here and back to URL in the parent.
                loadedUrls: result.loadedUrls.map((p) => (0, url_1.fileURLToPath)(p)),
            },
        });
    }
    catch (error) {
        // Needed because V8 will only serialize the message and stack properties of an Error instance.
        if (error instanceof sass_1.Exception) {
            const { span, message, stack, sassMessage, sassStack } = error;
            worker_threads_1.parentPort.postMessage({
                id,
                error: {
                    span: {
                        ...span,
                        url: span.url ? (0, url_1.fileURLToPath)(span.url) : undefined,
                    },
                    message,
                    stack,
                    sassMessage,
                    sassStack,
                },
            });
        }
        else if (error instanceof Error) {
            const { message, stack } = error;
            worker_threads_1.parentPort.postMessage({ id, error: { message, stack } });
        }
        else {
            worker_threads_1.parentPort.postMessage({ id, error: { message: 'An unknown error has occurred.' } });
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvc2Fzcy93b3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFFSCwrQkFBMkU7QUFDM0UsNkJBQW1EO0FBQ25ELG1EQUEyRjtBQXlCM0YsSUFBSSxDQUFDLDJCQUFVLElBQUksQ0FBQywyQkFBVSxFQUFFO0lBQzlCLE1BQU0sSUFBSSxLQUFLLENBQUMsMkNBQTJDLENBQUMsQ0FBQztDQUM5RDtBQUVELDhFQUE4RTtBQUM5RSxNQUFNLEVBQUUsa0JBQWtCLEVBQUUsY0FBYyxFQUFFLEdBQUcsMkJBRzlDLENBQUM7QUFFRiwyQkFBVSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBd0IsRUFBRSxFQUFFO0lBQ3RGLElBQUksQ0FBQywyQkFBVSxFQUFFO1FBQ2YsTUFBTSxJQUFJLEtBQUssQ0FBQyx3RUFBd0UsQ0FBQyxDQUFDO0tBQzNGO0lBRUQsSUFBSTtRQUNGLElBQUksV0FBVyxFQUFFO1lBQ2YsbUZBQW1GO1lBQ25GLG9EQUFvRDtZQUNwRCxvRkFBb0Y7WUFDcEYsMkVBQTJFO1lBQzNFLDJFQUEyRTtZQUMzRSxPQUFPLENBQUMsU0FBUyxHQUFHO2dCQUNsQjtvQkFDRSxXQUFXLEVBQUUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLEVBQUU7O3dCQUM1QixPQUFPLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7d0JBQ3BDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQzt3QkFDckQsT0FBTyxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUVuQyxNQUFNLE1BQU0sR0FBRyxNQUFBLElBQUEscUNBQW9CLEVBQUMsa0JBQWtCLENBQUMsMENBQUUsT0FBd0IsQ0FBQzt3QkFFbEYsT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUEsbUJBQWEsRUFBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO29CQUMvQyxDQUFDO2lCQUNGO2FBQ0YsQ0FBQztTQUNIO1FBRUQsNEZBQTRGO1FBQzVGLE1BQU0sTUFBTSxHQUFHLElBQUEsb0JBQWEsRUFBQyxNQUFNLEVBQUU7WUFDbkMsR0FBRyxPQUFPO1lBQ1Ysc0ZBQXNGO1lBQ3RGLEdBQUcsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFBLG1CQUFhLEVBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO1NBQzFELENBQUMsQ0FBQztRQUVILDJCQUFVLENBQUMsV0FBVyxDQUFDO1lBQ3JCLEVBQUU7WUFDRixNQUFNLEVBQUU7Z0JBQ04sR0FBRyxNQUFNO2dCQUNULHNGQUFzRjtnQkFDdEYsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFBLG1CQUFhLEVBQUMsQ0FBQyxDQUFDLENBQUM7YUFDM0Q7U0FDRixDQUFDLENBQUM7S0FDSjtJQUFDLE9BQU8sS0FBSyxFQUFFO1FBQ2QsK0ZBQStGO1FBQy9GLElBQUksS0FBSyxZQUFZLGdCQUFTLEVBQUU7WUFDOUIsTUFBTSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsR0FBRyxLQUFLLENBQUM7WUFDL0QsMkJBQVUsQ0FBQyxXQUFXLENBQUM7Z0JBQ3JCLEVBQUU7Z0JBQ0YsS0FBSyxFQUFFO29CQUNMLElBQUksRUFBRTt3QkFDSixHQUFHLElBQUk7d0JBQ1AsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUEsbUJBQWEsRUFBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7cUJBQ3BEO29CQUNELE9BQU87b0JBQ1AsS0FBSztvQkFDTCxXQUFXO29CQUNYLFNBQVM7aUJBQ1Y7YUFDRixDQUFDLENBQUM7U0FDSjthQUFNLElBQUksS0FBSyxZQUFZLEtBQUssRUFBRTtZQUNqQyxNQUFNLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxHQUFHLEtBQUssQ0FBQztZQUNqQywyQkFBVSxDQUFDLFdBQVcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1NBQzNEO2FBQU07WUFDTCwyQkFBVSxDQUFDLFdBQVcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsRUFBRSxDQUFDLENBQUM7U0FDdEY7S0FDRjtBQUNILENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEV4Y2VwdGlvbiwgU3RyaW5nT3B0aW9uc1dpdGhJbXBvcnRlciwgY29tcGlsZVN0cmluZyB9IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgeyBNZXNzYWdlUG9ydCwgcGFyZW50UG9ydCwgcmVjZWl2ZU1lc3NhZ2VPblBvcnQsIHdvcmtlckRhdGEgfSBmcm9tICd3b3JrZXJfdGhyZWFkcyc7XG5cbi8qKlxuICogQSByZXF1ZXN0IHRvIHJlbmRlciBhIFNhc3Mgc3R5bGVzaGVldCB1c2luZyB0aGUgc3VwcGxpZWQgb3B0aW9ucy5cbiAqL1xuaW50ZXJmYWNlIFJlbmRlclJlcXVlc3RNZXNzYWdlIHtcbiAgLyoqXG4gICAqIFRoZSB1bmlxdWUgcmVxdWVzdCBpZGVudGlmaWVyIHRoYXQgbGlua3MgdGhlIHJlbmRlciBhY3Rpb24gd2l0aCBhIGNhbGxiYWNrIGFuZCBvcHRpb25hbFxuICAgKiBpbXBvcnRlciBvbiB0aGUgbWFpbiB0aHJlYWQuXG4gICAqL1xuICBpZDogbnVtYmVyO1xuICAvKipcbiAgICogVGhlIGNvbnRlbnRzIHRvIGNvbXBpbGUuXG4gICAqL1xuICBzb3VyY2U6IHN0cmluZztcbiAgLyoqXG4gICAqIFRoZSBTYXNzIG9wdGlvbnMgdG8gcHJvdmlkZSB0byB0aGUgYGRhcnQtc2Fzc2AgY29tcGlsZSBmdW5jdGlvbi5cbiAgICovXG4gIG9wdGlvbnM6IE9taXQ8U3RyaW5nT3B0aW9uc1dpdGhJbXBvcnRlcjwnc3luYyc+LCAndXJsJz4gJiB7IHVybD86IHN0cmluZyB9O1xuICAvKipcbiAgICogSW5kaWNhdGVzIHRoZSByZXF1ZXN0IGhhcyBhIGN1c3RvbSBpbXBvcnRlciBmdW5jdGlvbiBvbiB0aGUgbWFpbiB0aHJlYWQuXG4gICAqL1xuICBoYXNJbXBvcnRlcjogYm9vbGVhbjtcbn1cblxuaWYgKCFwYXJlbnRQb3J0IHx8ICF3b3JrZXJEYXRhKSB7XG4gIHRocm93IG5ldyBFcnJvcignU2FzcyB3b3JrZXIgbXVzdCBiZSBleGVjdXRlZCBhcyBhIFdvcmtlci4nKTtcbn1cblxuLy8gVGhlIGltcG9ydGVyIHZhcmlhYmxlcyBhcmUgdXNlZCB0byBwcm94eSBpbXBvcnQgcmVxdWVzdHMgdG8gdGhlIG1haW4gdGhyZWFkXG5jb25zdCB7IHdvcmtlckltcG9ydGVyUG9ydCwgaW1wb3J0ZXJTaWduYWwgfSA9IHdvcmtlckRhdGEgYXMge1xuICB3b3JrZXJJbXBvcnRlclBvcnQ6IE1lc3NhZ2VQb3J0O1xuICBpbXBvcnRlclNpZ25hbDogSW50MzJBcnJheTtcbn07XG5cbnBhcmVudFBvcnQub24oJ21lc3NhZ2UnLCAoeyBpZCwgaGFzSW1wb3J0ZXIsIHNvdXJjZSwgb3B0aW9ucyB9OiBSZW5kZXJSZXF1ZXN0TWVzc2FnZSkgPT4ge1xuICBpZiAoIXBhcmVudFBvcnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1wicGFyZW50UG9ydFwiIGlzIG5vdCBkZWZpbmVkLiBTYXNzIHdvcmtlciBtdXN0IGJlIGV4ZWN1dGVkIGFzIGEgV29ya2VyLicpO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBpZiAoaGFzSW1wb3J0ZXIpIHtcbiAgICAgIC8vIFdoZW4gYSBjdXN0b20gaW1wb3J0ZXIgZnVuY3Rpb24gaXMgcHJlc2VudCwgdGhlIGltcG9ydGVyIHJlcXVlc3QgbXVzdCBiZSBwcm94aWVkXG4gICAgICAvLyBiYWNrIHRvIHRoZSBtYWluIHRocmVhZCB3aGVyZSBpdCBjYW4gYmUgZXhlY3V0ZWQuXG4gICAgICAvLyBUaGlzIHByb2Nlc3MgbXVzdCBiZSBzeW5jaHJvbm91cyBmcm9tIHRoZSBwZXJzcGVjdGl2ZSBvZiBkYXJ0LXNhc3MuIFRoZSBgQXRvbWljc2BcbiAgICAgIC8vIGZ1bmN0aW9ucyBjb21iaW5lZCB3aXRoIHRoZSBzaGFyZWQgbWVtb3J5IGBpbXBvcnRTaWduYWxgIGFuZCB0aGUgTm9kZS5qc1xuICAgICAgLy8gYHJlY2VpdmVNZXNzYWdlT25Qb3J0YCBmdW5jdGlvbiBhcmUgdXNlZCB0byBlbnN1cmUgc3luY2hyb25vdXMgYmVoYXZpb3IuXG4gICAgICBvcHRpb25zLmltcG9ydGVycyA9IFtcbiAgICAgICAge1xuICAgICAgICAgIGZpbmRGaWxlVXJsOiAodXJsLCBvcHRpb25zKSA9PiB7XG4gICAgICAgICAgICBBdG9taWNzLnN0b3JlKGltcG9ydGVyU2lnbmFsLCAwLCAwKTtcbiAgICAgICAgICAgIHdvcmtlckltcG9ydGVyUG9ydC5wb3N0TWVzc2FnZSh7IGlkLCB1cmwsIG9wdGlvbnMgfSk7XG4gICAgICAgICAgICBBdG9taWNzLndhaXQoaW1wb3J0ZXJTaWduYWwsIDAsIDApO1xuXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSByZWNlaXZlTWVzc2FnZU9uUG9ydCh3b3JrZXJJbXBvcnRlclBvcnQpPy5tZXNzYWdlIGFzIHN0cmluZyB8IG51bGw7XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQgPyBwYXRoVG9GaWxlVVJMKHJlc3VsdCkgOiBudWxsO1xuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdO1xuICAgIH1cblxuICAgIC8vIFRoZSBzeW5jaHJvbm91cyBTYXNzIHJlbmRlciBmdW5jdGlvbiBjYW4gYmUgdXAgdG8gdHdvIHRpbWVzIGZhc3RlciB0aGFuIHRoZSBhc3luYyB2YXJpYW50XG4gICAgY29uc3QgcmVzdWx0ID0gY29tcGlsZVN0cmluZyhzb3VyY2UsIHtcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAvLyBVUkwgaXMgbm90IHNlcmlhbGl6YWJsZSBzbyB0byBjb252ZXJ0IHRvIHN0cmluZyBpbiB0aGUgcGFyZW50IGFuZCBiYWNrIHRvIFVSTCBoZXJlLlxuICAgICAgdXJsOiBvcHRpb25zLnVybCA/IHBhdGhUb0ZpbGVVUkwob3B0aW9ucy51cmwpIDogdW5kZWZpbmVkLFxuICAgIH0pO1xuXG4gICAgcGFyZW50UG9ydC5wb3N0TWVzc2FnZSh7XG4gICAgICBpZCxcbiAgICAgIHJlc3VsdDoge1xuICAgICAgICAuLi5yZXN1bHQsXG4gICAgICAgIC8vIFVSTCBpcyBub3Qgc2VyaWFsaXphYmxlIHNvIHRvIGNvbnZlcnQgdG8gc3RyaW5nIGhlcmUgYW5kIGJhY2sgdG8gVVJMIGluIHRoZSBwYXJlbnQuXG4gICAgICAgIGxvYWRlZFVybHM6IHJlc3VsdC5sb2FkZWRVcmxzLm1hcCgocCkgPT4gZmlsZVVSTFRvUGF0aChwKSksXG4gICAgICB9LFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIE5lZWRlZCBiZWNhdXNlIFY4IHdpbGwgb25seSBzZXJpYWxpemUgdGhlIG1lc3NhZ2UgYW5kIHN0YWNrIHByb3BlcnRpZXMgb2YgYW4gRXJyb3IgaW5zdGFuY2UuXG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXhjZXB0aW9uKSB7XG4gICAgICBjb25zdCB7IHNwYW4sIG1lc3NhZ2UsIHN0YWNrLCBzYXNzTWVzc2FnZSwgc2Fzc1N0YWNrIH0gPSBlcnJvcjtcbiAgICAgIHBhcmVudFBvcnQucG9zdE1lc3NhZ2Uoe1xuICAgICAgICBpZCxcbiAgICAgICAgZXJyb3I6IHtcbiAgICAgICAgICBzcGFuOiB7XG4gICAgICAgICAgICAuLi5zcGFuLFxuICAgICAgICAgICAgdXJsOiBzcGFuLnVybCA/IGZpbGVVUkxUb1BhdGgoc3Bhbi51cmwpIDogdW5kZWZpbmVkLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgICBzdGFjayxcbiAgICAgICAgICBzYXNzTWVzc2FnZSxcbiAgICAgICAgICBzYXNzU3RhY2ssXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgIGNvbnN0IHsgbWVzc2FnZSwgc3RhY2sgfSA9IGVycm9yO1xuICAgICAgcGFyZW50UG9ydC5wb3N0TWVzc2FnZSh7IGlkLCBlcnJvcjogeyBtZXNzYWdlLCBzdGFjayB9IH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJlbnRQb3J0LnBvc3RNZXNzYWdlKHsgaWQsIGVycm9yOiB7IG1lc3NhZ2U6ICdBbiB1bmtub3duIGVycm9yIGhhcyBvY2N1cnJlZC4nIH0gfSk7XG4gICAgfVxuICB9XG59KTtcbiJdfQ==