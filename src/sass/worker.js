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
worker_threads_1.parentPort.on('message', (message) => {
    if (!worker_threads_1.parentPort) {
        throw new Error('"parentPort" is not defined. Sass worker must be executed as a Worker.');
    }
    const { id, hasImporter, hasLogger, source, options } = message;
    let warnings;
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
            logger: hasLogger
                ? {
                    warn(message, { deprecation, span, stack }) {
                        warnings !== null && warnings !== void 0 ? warnings : (warnings = []);
                        warnings.push({
                            message,
                            deprecation,
                            stack,
                            span: span && convertSourceSpan(span),
                        });
                    },
                }
                : undefined,
        });
        worker_threads_1.parentPort.postMessage({
            id,
            warnings,
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
                warnings,
                error: {
                    span: convertSourceSpan(span),
                    message,
                    stack,
                    sassMessage,
                    sassStack,
                },
            });
        }
        else if (error instanceof Error) {
            const { message, stack } = error;
            worker_threads_1.parentPort.postMessage({ id, warnings, error: { message, stack } });
        }
        else {
            worker_threads_1.parentPort.postMessage({
                id,
                warnings,
                error: { message: 'An unknown error has occurred.' },
            });
        }
    }
});
/**
 * Converts a Sass SourceSpan object into a serializable form.
 * The SourceSpan object contains a URL property which must be converted into a string.
 * Also, most of the interface's properties are get accessors and are not automatically
 * serialized when sent back from the worker.
 *
 * @param span The Sass SourceSpan object to convert.
 * @returns A serializable form of the SourceSpan object.
 */
function convertSourceSpan(span) {
    return {
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
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvc2Fzcy93b3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFFSCwrQkFBdUY7QUFDdkYsNkJBQW1EO0FBQ25ELG1EQUEyRjtBQTZCM0YsSUFBSSxDQUFDLDJCQUFVLElBQUksQ0FBQywyQkFBVSxFQUFFO0lBQzlCLE1BQU0sSUFBSSxLQUFLLENBQUMsMkNBQTJDLENBQUMsQ0FBQztDQUM5RDtBQUVELDhFQUE4RTtBQUM5RSxNQUFNLEVBQUUsa0JBQWtCLEVBQUUsY0FBYyxFQUFFLEdBQUcsMkJBRzlDLENBQUM7QUFFRiwyQkFBVSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxPQUE2QixFQUFFLEVBQUU7SUFDekQsSUFBSSxDQUFDLDJCQUFVLEVBQUU7UUFDZixNQUFNLElBQUksS0FBSyxDQUFDLHdFQUF3RSxDQUFDLENBQUM7S0FDM0Y7SUFFRCxNQUFNLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxHQUFHLE9BQU8sQ0FBQztJQUNoRSxJQUFJLFFBT1MsQ0FBQztJQUNkLElBQUk7UUFDRixJQUFJLFdBQVcsRUFBRTtZQUNmLG1GQUFtRjtZQUNuRixvREFBb0Q7WUFDcEQsb0ZBQW9GO1lBQ3BGLDJFQUEyRTtZQUMzRSwyRUFBMkU7WUFDM0UsT0FBTyxDQUFDLFNBQVMsR0FBRztnQkFDbEI7b0JBQ0UsV0FBVyxFQUFFLENBQUMsR0FBRyxFQUFFLE9BQU8sRUFBRSxFQUFFOzt3QkFDNUIsT0FBTyxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUNwQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLEVBQUUsR0FBRyxF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O1lBQ0gsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTTtZQUN2QixNQUFNLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNO1lBQ3ZCLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUk7U0FDcEI7UUFDRCxLQUFLLEVBQUU7WUFDTCxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNO1lBQ3pCLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU07WUFDekIsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSTtTQUN0QjtRQUNELEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFBLG1CQUFhLEVBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO0tBQ3BELENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEV4Y2VwdGlvbiwgU291cmNlU3BhbiwgU3RyaW5nT3B0aW9uc1dpdGhJbXBvcnRlciwgY29tcGlsZVN0cmluZyB9IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgeyBNZXNzYWdlUG9ydCwgcGFyZW50UG9ydCwgcmVjZWl2ZU1lc3NhZ2VPblBvcnQsIHdvcmtlckRhdGEgfSBmcm9tICd3b3JrZXJfdGhyZWFkcyc7XG5cbi8qKlxuICogQSByZXF1ZXN0IHRvIHJlbmRlciBhIFNhc3Mgc3R5bGVzaGVldCB1c2luZyB0aGUgc3VwcGxpZWQgb3B0aW9ucy5cbiAqL1xuaW50ZXJmYWNlIFJlbmRlclJlcXVlc3RNZXNzYWdlIHtcbiAgLyoqXG4gICAqIFRoZSB1bmlxdWUgcmVxdWVzdCBpZGVudGlmaWVyIHRoYXQgbGlua3MgdGhlIHJlbmRlciBhY3Rpb24gd2l0aCBhIGNhbGxiYWNrIGFuZCBvcHRpb25hbFxuICAgKiBpbXBvcnRlciBvbiB0aGUgbWFpbiB0aHJlYWQuXG4gICAqL1xuICBpZDogbnVtYmVyO1xuICAvKipcbiAgICogVGhlIGNvbnRlbnRzIHRvIGNvbXBpbGUuXG4gICAqL1xuICBzb3VyY2U6IHN0cmluZztcbiAgLyoqXG4gICAqIFRoZSBTYXNzIG9wdGlvbnMgdG8gcHJvdmlkZSB0byB0aGUgYGRhcnQtc2Fzc2AgY29tcGlsZSBmdW5jdGlvbi5cbiAgICovXG4gIG9wdGlvbnM6IE9taXQ8U3RyaW5nT3B0aW9uc1dpdGhJbXBvcnRlcjwnc3luYyc+LCAndXJsJz4gJiB7IHVybD86IHN0cmluZyB9O1xuICAvKipcbiAgICogSW5kaWNhdGVzIHRoZSByZXF1ZXN0IGhhcyBhIGN1c3RvbSBpbXBvcnRlciBmdW5jdGlvbiBvbiB0aGUgbWFpbiB0aHJlYWQuXG4gICAqL1xuICBoYXNJbXBvcnRlcjogYm9vbGVhbjtcbiAgLyoqXG4gICAqIEluZGljYXRlcyB0aGUgcmVxdWVzdCBoYXMgYSBjdXN0b20gbG9nZ2VyIGZvciB3YXJuaW5nIG1lc3NhZ2VzLlxuICAgKi9cbiAgaGFzTG9nZ2VyOiBib29sZWFuO1xufVxuXG5pZiAoIXBhcmVudFBvcnQgfHwgIXdvcmtlckRhdGEpIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdTYXNzIHdvcmtlciBtdXN0IGJlIGV4ZWN1dGVkIGFzIGEgV29ya2VyLicpO1xufVxuXG4vLyBUaGUgaW1wb3J0ZXIgdmFyaWFibGVzIGFyZSB1c2VkIHRvIHByb3h5IGltcG9ydCByZXF1ZXN0cyB0byB0aGUgbWFpbiB0aHJlYWRcbmNvbnN0IHsgd29ya2VySW1wb3J0ZXJQb3J0LCBpbXBvcnRlclNpZ25hbCB9ID0gd29ya2VyRGF0YSBhcyB7XG4gIHdvcmtlckltcG9ydGVyUG9ydDogTWVzc2FnZVBvcnQ7XG4gIGltcG9ydGVyU2lnbmFsOiBJbnQzMkFycmF5O1xufTtcblxucGFyZW50UG9ydC5vbignbWVzc2FnZScsIChtZXNzYWdlOiBSZW5kZXJSZXF1ZXN0TWVzc2FnZSkgPT4ge1xuICBpZiAoIXBhcmVudFBvcnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1wicGFyZW50UG9ydFwiIGlzIG5vdCBkZWZpbmVkLiBTYXNzIHdvcmtlciBtdXN0IGJlIGV4ZWN1dGVkIGFzIGEgV29ya2VyLicpO1xuICB9XG5cbiAgY29uc3QgeyBpZCwgaGFzSW1wb3J0ZXIsIGhhc0xvZ2dlciwgc291cmNlLCBvcHRpb25zIH0gPSBtZXNzYWdlO1xuICBsZXQgd2FybmluZ3M6XG4gICAgfCB7XG4gICAgICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICAgICAgZGVwcmVjYXRpb246IGJvb2xlYW47XG4gICAgICAgIHN0YWNrPzogc3RyaW5nO1xuICAgICAgICBzcGFuPzogT21pdDxTb3VyY2VTcGFuLCAndXJsJz4gJiB7IHVybD86IHN0cmluZyB9O1xuICAgICAgfVtdXG4gICAgfCB1bmRlZmluZWQ7XG4gIHRyeSB7XG4gICAgaWYgKGhhc0ltcG9ydGVyKSB7XG4gICAgICAvLyBXaGVuIGEgY3VzdG9tIGltcG9ydGVyIGZ1bmN0aW9uIGlzIHByZXNlbnQsIHRoZSBpbXBvcnRlciByZXF1ZXN0IG11c3QgYmUgcHJveGllZFxuICAgICAgLy8gYmFjayB0byB0aGUgbWFpbiB0aHJlYWQgd2hlcmUgaXQgY2FuIGJlIGV4ZWN1dGVkLlxuICAgICAgLy8gVGhpcyBwcm9jZXNzIG11c3QgYmUgc3luY2hyb25vdXMgZnJvbSB0aGUgcGVyc3BlY3RpdmUgb2YgZGFydC1zYXNzLiBUaGUgYEF0b21pY3NgXG4gICAgICAvLyBmdW5jdGlvbnMgY29tYmluZWQgd2l0aCB0aGUgc2hhcmVkIG1lbW9yeSBgaW1wb3J0U2lnbmFsYCBhbmQgdGhlIE5vZGUuanNcbiAgICAgIC8vIGByZWNlaXZlTWVzc2FnZU9uUG9ydGAgZnVuY3Rpb24gYXJlIHVzZWQgdG8gZW5zdXJlIHN5bmNocm9ub3VzIGJlaGF2aW9yLlxuICAgICAgb3B0aW9ucy5pbXBvcnRlcnMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICBmaW5kRmlsZVVybDogKHVybCwgb3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgQXRvbWljcy5zdG9yZShpbXBvcnRlclNpZ25hbCwgMCwgMCk7XG4gICAgICAgICAgICB3b3JrZXJJbXBvcnRlclBvcnQucG9zdE1lc3NhZ2UoeyBpZCwgdXJsLCBvcHRpb25zIH0pO1xuICAgICAgICAgICAgQXRvbWljcy53YWl0KGltcG9ydGVyU2lnbmFsLCAwLCAwKTtcblxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gcmVjZWl2ZU1lc3NhZ2VPblBvcnQod29ya2VySW1wb3J0ZXJQb3J0KT8ubWVzc2FnZSBhcyBzdHJpbmcgfCBudWxsO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0ID8gcGF0aFRvRmlsZVVSTChyZXN1bHQpIDogbnVsbDtcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXTtcbiAgICB9XG5cbiAgICAvLyBUaGUgc3luY2hyb25vdXMgU2FzcyByZW5kZXIgZnVuY3Rpb24gY2FuIGJlIHVwIHRvIHR3byB0aW1lcyBmYXN0ZXIgdGhhbiB0aGUgYXN5bmMgdmFyaWFudFxuICAgIGNvbnN0IHJlc3VsdCA9IGNvbXBpbGVTdHJpbmcoc291cmNlLCB7XG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgLy8gVVJMIGlzIG5vdCBzZXJpYWxpemFibGUgc28gdG8gY29udmVydCB0byBzdHJpbmcgaW4gdGhlIHBhcmVudCBhbmQgYmFjayB0byBVUkwgaGVyZS5cbiAgICAgIHVybDogb3B0aW9ucy51cmwgPyBwYXRoVG9GaWxlVVJMKG9wdGlvbnMudXJsKSA6IHVuZGVmaW5lZCxcbiAgICAgIGxvZ2dlcjogaGFzTG9nZ2VyXG4gICAgICAgID8ge1xuICAgICAgICAgICAgd2FybihtZXNzYWdlLCB7IGRlcHJlY2F0aW9uLCBzcGFuLCBzdGFjayB9KSB7XG4gICAgICAgICAgICAgIHdhcm5pbmdzID8/PSBbXTtcbiAgICAgICAgICAgICAgd2FybmluZ3MucHVzaCh7XG4gICAgICAgICAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgICAgICAgICBkZXByZWNhdGlvbixcbiAgICAgICAgICAgICAgICBzdGFjayxcbiAgICAgICAgICAgICAgICBzcGFuOiBzcGFuICYmIGNvbnZlcnRTb3VyY2VTcGFuKHNwYW4pLFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICB9KTtcblxuICAgIHBhcmVudFBvcnQucG9zdE1lc3NhZ2Uoe1xuICAgICAgaWQsXG4gICAgICB3YXJuaW5ncyxcbiAgICAgIHJlc3VsdDoge1xuICAgICAgICAuLi5yZXN1bHQsXG4gICAgICAgIC8vIFVSTCBpcyBub3Qgc2VyaWFsaXphYmxlIHNvIHRvIGNvbnZlcnQgdG8gc3RyaW5nIGhlcmUgYW5kIGJhY2sgdG8gVVJMIGluIHRoZSBwYXJlbnQuXG4gICAgICAgIGxvYWRlZFVybHM6IHJlc3VsdC5sb2FkZWRVcmxzLm1hcCgocCkgPT4gZmlsZVVSTFRvUGF0aChwKSksXG4gICAgICB9LFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIE5lZWRlZCBiZWNhdXNlIFY4IHdpbGwgb25seSBzZXJpYWxpemUgdGhlIG1lc3NhZ2UgYW5kIHN0YWNrIHByb3BlcnRpZXMgb2YgYW4gRXJyb3IgaW5zdGFuY2UuXG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXhjZXB0aW9uKSB7XG4gICAgICBjb25zdCB7IHNwYW4sIG1lc3NhZ2UsIHN0YWNrLCBzYXNzTWVzc2FnZSwgc2Fzc1N0YWNrIH0gPSBlcnJvcjtcbiAgICAgIHBhcmVudFBvcnQucG9zdE1lc3NhZ2Uoe1xuICAgICAgICBpZCxcbiAgICAgICAgd2FybmluZ3MsXG4gICAgICAgIGVycm9yOiB7XG4gICAgICAgICAgc3BhbjogY29udmVydFNvdXJjZVNwYW4oc3BhbiksXG4gICAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgICBzdGFjayxcbiAgICAgICAgICBzYXNzTWVzc2FnZSxcbiAgICAgICAgICBzYXNzU3RhY2ssXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgIGNvbnN0IHsgbWVzc2FnZSwgc3RhY2sgfSA9IGVycm9yO1xuICAgICAgcGFyZW50UG9ydC5wb3N0TWVzc2FnZSh7IGlkLCB3YXJuaW5ncywgZXJyb3I6IHsgbWVzc2FnZSwgc3RhY2sgfSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyZW50UG9ydC5wb3N0TWVzc2FnZSh7XG4gICAgICAgIGlkLFxuICAgICAgICB3YXJuaW5ncyxcbiAgICAgICAgZXJyb3I6IHsgbWVzc2FnZTogJ0FuIHVua25vd24gZXJyb3IgaGFzIG9jY3VycmVkLicgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufSk7XG5cbi8qKlxuICogQ29udmVydHMgYSBTYXNzIFNvdXJjZVNwYW4gb2JqZWN0IGludG8gYSBzZXJpYWxpemFibGUgZm9ybS5cbiAqIFRoZSBTb3VyY2VTcGFuIG9iamVjdCBjb250YWlucyBhIFVSTCBwcm9wZXJ0eSB3aGljaCBtdXN0IGJlIGNvbnZlcnRlZCBpbnRvIGEgc3RyaW5nLlxuICogQWxzbywgbW9zdCBvZiB0aGUgaW50ZXJmYWNlJ3MgcHJvcGVydGllcyBhcmUgZ2V0IGFjY2Vzc29ycyBhbmQgYXJlIG5vdCBhdXRvbWF0aWNhbGx5XG4gKiBzZXJpYWxpemVkIHdoZW4gc2VudCBiYWNrIGZyb20gdGhlIHdvcmtlci5cbiAqXG4gKiBAcGFyYW0gc3BhbiBUaGUgU2FzcyBTb3VyY2VTcGFuIG9iamVjdCB0byBjb252ZXJ0LlxuICogQHJldHVybnMgQSBzZXJpYWxpemFibGUgZm9ybSBvZiB0aGUgU291cmNlU3BhbiBvYmplY3QuXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRTb3VyY2VTcGFuKHNwYW46IFNvdXJjZVNwYW4pOiBPbWl0PFNvdXJjZVNwYW4sICd1cmwnPiAmIHsgdXJsPzogc3RyaW5nIH0ge1xuICByZXR1cm4ge1xuICAgIHRleHQ6IHNwYW4udGV4dCxcbiAgICBjb250ZXh0OiBzcGFuLmNvbnRleHQsXG4gICAgZW5kOiB7XG4gICAgICBjb2x1bW46IHNwYW4uZW5kLmNvbHVtbixcbiAgICAgIG9mZnNldDogc3Bhbi5lbmQub2Zmc2V0LFxuICAgICAgbGluZTogc3Bhbi5lbmQubGluZSxcbiAgICB9LFxuICAgIHN0YXJ0OiB7XG4gICAgICBjb2x1bW46IHNwYW4uc3RhcnQuY29sdW1uLFxuICAgICAgb2Zmc2V0OiBzcGFuLnN0YXJ0Lm9mZnNldCxcbiAgICAgIGxpbmU6IHNwYW4uc3RhcnQubGluZSxcbiAgICB9LFxuICAgIHVybDogc3Bhbi51cmwgPyBmaWxlVVJMVG9QYXRoKHNwYW4udXJsKSA6IHVuZGVmaW5lZCxcbiAgfTtcbn1cbiJdfQ==