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
                        text: span.text,
                        context: span.context,
                        end: {
                            column: span.end.column,
                            offset: span.end.offset,
                            line: span.end.line,
                        },
                        start: {
                            column: span.start.column,
                            offset: span.start.offset,
                            line: span.start.line,
                        },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvc2Fzcy93b3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFFSCwrQkFBMkU7QUFDM0UsNkJBQW1EO0FBQ25ELG1EQUEyRjtBQXlCM0YsSUFBSSxDQUFDLDJCQUFVLElBQUksQ0FBQywyQkFBVSxFQUFFO0lBQzlCLE1BQU0sSUFBSSxLQUFLLENBQUMsMkNBQTJDLENBQUMsQ0FBQztDQUM5RDtBQUVELDhFQUE4RTtBQUM5RSxNQUFNLEVBQUUsa0JBQWtCLEVBQUUsY0FBYyxFQUFFLEdBQUcsMkJBRzlDLENBQUM7QUFFRiwyQkFBVSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBd0IsRUFBRSxFQUFFO0lBQ3RGLElBQUksQ0FBQywyQkFBVSxFQUFFO1FBQ2YsTUFBTSxJQUFJLEtBQUssQ0FBQyx3RUFBd0UsQ0FBQyxDQUFDO0tBQzNGO0lBRUQsSUFBSTtRQUNGLElBQUksV0FBVyxFQUFFO1lBQ2YsbUZBQW1GO1lBQ25GLG9EQUFvRDtZQUNwRCxvRkFBb0Y7WUFDcEYsMkVBQTJFO1lBQzNFLDJFQUEyRTtZQUMzRSxPQUFPLENBQUMsU0FBUyxHQUFHO2dCQUNsQjtvQkFDRSxXQUFXLEVBQUUsQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLEVBQUU7O3dCQUM1QixPQUFPLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7d0JBQ3BDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQzt3QkFDckQsT0FBTyxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUVuQyxNQUFNLE1BQU0sR0FBRyxNQUFBLElBQUEscUNBQW9CLEVBQUMsa0JBQWtCLENBQUMsMENBQUUsT0FBd0IsQ0FBQzt3QkFFbEYsT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUEsbUJBQWEsRUFBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO29CQUMvQyxDQUFDO2lCQUNGO2FBQ0YsQ0FBQztTQUNIO1FBRUQsNEZBQTRGO1FBQzVGLE1BQU0sTUFBTSxHQUFHLElBQUEsb0JBQWEsRUFBQyxNQUFNLEVBQUU7WUFDbkMsR0FBRyxPQUFPO1lBQ1Ysc0ZBQXNGO1lBQ3RGLEdBQUcsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFBLG1CQUFhLEVBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO1NBQzFELENBQUMsQ0FBQztRQUVILDJCQUFVLENBQUMsV0FBVyxDQUFDO1lBQ3JCLEVBQUU7WUFDRixNQUFNLEVBQUU7Z0JBQ04sR0FBRyxNQUFNO2dCQUNULHNGQUFzRjtnQkFDdEYsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFBLG1CQUFhLEVBQUMsQ0FBQyxDQUFDLENBQUM7YUFDM0Q7U0FDRixDQUFDLENBQUM7S0FDSjtJQUFDLE9BQU8sS0FBSyxFQUFFO1FBQ2QsK0ZBQStGO1FBQy9GLElBQUksS0FBSyxZQUFZLGdCQUFTLEVBQUU7WUFDOUIsTUFBTSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsR0FBRyxLQUFLLENBQUM7WUFDL0QsMkJBQVUsQ0FBQyxXQUFXLENBQUM7Z0JBQ3JCLEVBQUU7Z0JBQ0YsS0FBSyxFQUFFO29CQUNMLElBQUksRUFBRTt3QkFDSixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7d0JBQ2YsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPO3dCQUNyQixHQUFHLEVBQUU7NEJBQ0gsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTTs0QkFDdkIsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTTs0QkFDdkIsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSTt5QkFDcEI7d0JBQ0QsS0FBSyxFQUFFOzRCQUNMLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU07NEJBQ3pCLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU07NEJBQ3pCLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUk7eUJBQ3RCO3dCQUNELEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFBLG1CQUFhLEVBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO3FCQUNwRDtvQkFDRCxPQUFPO29CQUNQLEtBQUs7b0JBQ0wsV0FBVztvQkFDWCxTQUFTO2lCQUNWO2FBQ0YsQ0FBQyxDQUFDO1NBQ0o7YUFBTSxJQUFJLEtBQUssWUFBWSxLQUFLLEVBQUU7WUFDakMsTUFBTSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsR0FBRyxLQUFLLENBQUM7WUFDakMsMkJBQVUsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztTQUMzRDthQUFNO1lBQ0wsMkJBQVUsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1NBQ3RGO0tBQ0Y7QUFDSCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBFeGNlcHRpb24sIFN0cmluZ09wdGlvbnNXaXRoSW1wb3J0ZXIsIGNvbXBpbGVTdHJpbmcgfSBmcm9tICdzYXNzJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIHBhdGhUb0ZpbGVVUkwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IHsgTWVzc2FnZVBvcnQsIHBhcmVudFBvcnQsIHJlY2VpdmVNZXNzYWdlT25Qb3J0LCB3b3JrZXJEYXRhIH0gZnJvbSAnd29ya2VyX3RocmVhZHMnO1xuXG4vKipcbiAqIEEgcmVxdWVzdCB0byByZW5kZXIgYSBTYXNzIHN0eWxlc2hlZXQgdXNpbmcgdGhlIHN1cHBsaWVkIG9wdGlvbnMuXG4gKi9cbmludGVyZmFjZSBSZW5kZXJSZXF1ZXN0TWVzc2FnZSB7XG4gIC8qKlxuICAgKiBUaGUgdW5pcXVlIHJlcXVlc3QgaWRlbnRpZmllciB0aGF0IGxpbmtzIHRoZSByZW5kZXIgYWN0aW9uIHdpdGggYSBjYWxsYmFjayBhbmQgb3B0aW9uYWxcbiAgICogaW1wb3J0ZXIgb24gdGhlIG1haW4gdGhyZWFkLlxuICAgKi9cbiAgaWQ6IG51bWJlcjtcbiAgLyoqXG4gICAqIFRoZSBjb250ZW50cyB0byBjb21waWxlLlxuICAgKi9cbiAgc291cmNlOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBUaGUgU2FzcyBvcHRpb25zIHRvIHByb3ZpZGUgdG8gdGhlIGBkYXJ0LXNhc3NgIGNvbXBpbGUgZnVuY3Rpb24uXG4gICAqL1xuICBvcHRpb25zOiBPbWl0PFN0cmluZ09wdGlvbnNXaXRoSW1wb3J0ZXI8J3N5bmMnPiwgJ3VybCc+ICYgeyB1cmw/OiBzdHJpbmcgfTtcbiAgLyoqXG4gICAqIEluZGljYXRlcyB0aGUgcmVxdWVzdCBoYXMgYSBjdXN0b20gaW1wb3J0ZXIgZnVuY3Rpb24gb24gdGhlIG1haW4gdGhyZWFkLlxuICAgKi9cbiAgaGFzSW1wb3J0ZXI6IGJvb2xlYW47XG59XG5cbmlmICghcGFyZW50UG9ydCB8fCAhd29ya2VyRGF0YSkge1xuICB0aHJvdyBuZXcgRXJyb3IoJ1Nhc3Mgd29ya2VyIG11c3QgYmUgZXhlY3V0ZWQgYXMgYSBXb3JrZXIuJyk7XG59XG5cbi8vIFRoZSBpbXBvcnRlciB2YXJpYWJsZXMgYXJlIHVzZWQgdG8gcHJveHkgaW1wb3J0IHJlcXVlc3RzIHRvIHRoZSBtYWluIHRocmVhZFxuY29uc3QgeyB3b3JrZXJJbXBvcnRlclBvcnQsIGltcG9ydGVyU2lnbmFsIH0gPSB3b3JrZXJEYXRhIGFzIHtcbiAgd29ya2VySW1wb3J0ZXJQb3J0OiBNZXNzYWdlUG9ydDtcbiAgaW1wb3J0ZXJTaWduYWw6IEludDMyQXJyYXk7XG59O1xuXG5wYXJlbnRQb3J0Lm9uKCdtZXNzYWdlJywgKHsgaWQsIGhhc0ltcG9ydGVyLCBzb3VyY2UsIG9wdGlvbnMgfTogUmVuZGVyUmVxdWVzdE1lc3NhZ2UpID0+IHtcbiAgaWYgKCFwYXJlbnRQb3J0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdcInBhcmVudFBvcnRcIiBpcyBub3QgZGVmaW5lZC4gU2FzcyB3b3JrZXIgbXVzdCBiZSBleGVjdXRlZCBhcyBhIFdvcmtlci4nKTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgaWYgKGhhc0ltcG9ydGVyKSB7XG4gICAgICAvLyBXaGVuIGEgY3VzdG9tIGltcG9ydGVyIGZ1bmN0aW9uIGlzIHByZXNlbnQsIHRoZSBpbXBvcnRlciByZXF1ZXN0IG11c3QgYmUgcHJveGllZFxuICAgICAgLy8gYmFjayB0byB0aGUgbWFpbiB0aHJlYWQgd2hlcmUgaXQgY2FuIGJlIGV4ZWN1dGVkLlxuICAgICAgLy8gVGhpcyBwcm9jZXNzIG11c3QgYmUgc3luY2hyb25vdXMgZnJvbSB0aGUgcGVyc3BlY3RpdmUgb2YgZGFydC1zYXNzLiBUaGUgYEF0b21pY3NgXG4gICAgICAvLyBmdW5jdGlvbnMgY29tYmluZWQgd2l0aCB0aGUgc2hhcmVkIG1lbW9yeSBgaW1wb3J0U2lnbmFsYCBhbmQgdGhlIE5vZGUuanNcbiAgICAgIC8vIGByZWNlaXZlTWVzc2FnZU9uUG9ydGAgZnVuY3Rpb24gYXJlIHVzZWQgdG8gZW5zdXJlIHN5bmNocm9ub3VzIGJlaGF2aW9yLlxuICAgICAgb3B0aW9ucy5pbXBvcnRlcnMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICBmaW5kRmlsZVVybDogKHVybCwgb3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgQXRvbWljcy5zdG9yZShpbXBvcnRlclNpZ25hbCwgMCwgMCk7XG4gICAgICAgICAgICB3b3JrZXJJbXBvcnRlclBvcnQucG9zdE1lc3NhZ2UoeyBpZCwgdXJsLCBvcHRpb25zIH0pO1xuICAgICAgICAgICAgQXRvbWljcy53YWl0KGltcG9ydGVyU2lnbmFsLCAwLCAwKTtcblxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gcmVjZWl2ZU1lc3NhZ2VPblBvcnQod29ya2VySW1wb3J0ZXJQb3J0KT8ubWVzc2FnZSBhcyBzdHJpbmcgfCBudWxsO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0ID8gcGF0aFRvRmlsZVVSTChyZXN1bHQpIDogbnVsbDtcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXTtcbiAgICB9XG5cbiAgICAvLyBUaGUgc3luY2hyb25vdXMgU2FzcyByZW5kZXIgZnVuY3Rpb24gY2FuIGJlIHVwIHRvIHR3byB0aW1lcyBmYXN0ZXIgdGhhbiB0aGUgYXN5bmMgdmFyaWFudFxuICAgIGNvbnN0IHJlc3VsdCA9IGNvbXBpbGVTdHJpbmcoc291cmNlLCB7XG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgLy8gVVJMIGlzIG5vdCBzZXJpYWxpemFibGUgc28gdG8gY29udmVydCB0byBzdHJpbmcgaW4gdGhlIHBhcmVudCBhbmQgYmFjayB0byBVUkwgaGVyZS5cbiAgICAgIHVybDogb3B0aW9ucy51cmwgPyBwYXRoVG9GaWxlVVJMKG9wdGlvbnMudXJsKSA6IHVuZGVmaW5lZCxcbiAgICB9KTtcblxuICAgIHBhcmVudFBvcnQucG9zdE1lc3NhZ2Uoe1xuICAgICAgaWQsXG4gICAgICByZXN1bHQ6IHtcbiAgICAgICAgLi4ucmVzdWx0LFxuICAgICAgICAvLyBVUkwgaXMgbm90IHNlcmlhbGl6YWJsZSBzbyB0byBjb252ZXJ0IHRvIHN0cmluZyBoZXJlIGFuZCBiYWNrIHRvIFVSTCBpbiB0aGUgcGFyZW50LlxuICAgICAgICBsb2FkZWRVcmxzOiByZXN1bHQubG9hZGVkVXJscy5tYXAoKHApID0+IGZpbGVVUkxUb1BhdGgocCkpLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAvLyBOZWVkZWQgYmVjYXVzZSBWOCB3aWxsIG9ubHkgc2VyaWFsaXplIHRoZSBtZXNzYWdlIGFuZCBzdGFjayBwcm9wZXJ0aWVzIG9mIGFuIEVycm9yIGluc3RhbmNlLlxuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEV4Y2VwdGlvbikge1xuICAgICAgY29uc3QgeyBzcGFuLCBtZXNzYWdlLCBzdGFjaywgc2Fzc01lc3NhZ2UsIHNhc3NTdGFjayB9ID0gZXJyb3I7XG4gICAgICBwYXJlbnRQb3J0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgaWQsXG4gICAgICAgIGVycm9yOiB7XG4gICAgICAgICAgc3Bhbjoge1xuICAgICAgICAgICAgdGV4dDogc3Bhbi50ZXh0LFxuICAgICAgICAgICAgY29udGV4dDogc3Bhbi5jb250ZXh0LFxuICAgICAgICAgICAgZW5kOiB7XG4gICAgICAgICAgICAgIGNvbHVtbjogc3Bhbi5lbmQuY29sdW1uLFxuICAgICAgICAgICAgICBvZmZzZXQ6IHNwYW4uZW5kLm9mZnNldCxcbiAgICAgICAgICAgICAgbGluZTogc3Bhbi5lbmQubGluZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdGFydDoge1xuICAgICAgICAgICAgICBjb2x1bW46IHNwYW4uc3RhcnQuY29sdW1uLFxuICAgICAgICAgICAgICBvZmZzZXQ6IHNwYW4uc3RhcnQub2Zmc2V0LFxuICAgICAgICAgICAgICBsaW5lOiBzcGFuLnN0YXJ0LmxpbmUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdXJsOiBzcGFuLnVybCA/IGZpbGVVUkxUb1BhdGgoc3Bhbi51cmwpIDogdW5kZWZpbmVkLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgICBzdGFjayxcbiAgICAgICAgICBzYXNzTWVzc2FnZSxcbiAgICAgICAgICBzYXNzU3RhY2ssXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgIGNvbnN0IHsgbWVzc2FnZSwgc3RhY2sgfSA9IGVycm9yO1xuICAgICAgcGFyZW50UG9ydC5wb3N0TWVzc2FnZSh7IGlkLCBlcnJvcjogeyBtZXNzYWdlLCBzdGFjayB9IH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJlbnRQb3J0LnBvc3RNZXNzYWdlKHsgaWQsIGVycm9yOiB7IG1lc3NhZ2U6ICdBbiB1bmtub3duIGVycm9yIGhhcyBvY2N1cnJlZC4nIH0gfSk7XG4gICAgfVxuICB9XG59KTtcbiJdfQ==