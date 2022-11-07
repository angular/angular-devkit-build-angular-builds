"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const node_worker_threads_1 = require("node:worker_threads");
const sass_1 = require("sass");
const rebasing_importer_1 = require("./rebasing-importer");
if (!node_worker_threads_1.parentPort || !node_worker_threads_1.workerData) {
    throw new Error('Sass worker must be executed as a Worker.');
}
// The importer variables are used to proxy import requests to the main thread
const { workerImporterPort, importerSignal } = node_worker_threads_1.workerData;
node_worker_threads_1.parentPort.on('message', (message) => {
    var _a, _b;
    if (!node_worker_threads_1.parentPort) {
        throw new Error('"parentPort" is not defined. Sass worker must be executed as a Worker.');
    }
    const { id, hasImporter, hasLogger, source, options, rebase } = message;
    const entryDirectory = (0, node_path_1.dirname)(options.url);
    let warnings;
    try {
        const directoryCache = new Map();
        if (hasImporter) {
            // When a custom importer function is present, the importer request must be proxied
            // back to the main thread where it can be executed.
            // This process must be synchronous from the perspective of dart-sass. The `Atomics`
            // functions combined with the shared memory `importSignal` and the Node.js
            // `receiveMessageOnPort` function are used to ensure synchronous behavior.
            const proxyImporter = {
                findFileUrl: (url, options) => {
                    var _a;
                    Atomics.store(importerSignal, 0, 0);
                    workerImporterPort.postMessage({ id, url, options });
                    Atomics.wait(importerSignal, 0, 0);
                    const result = (_a = (0, node_worker_threads_1.receiveMessageOnPort)(workerImporterPort)) === null || _a === void 0 ? void 0 : _a.message;
                    return result ? (0, node_url_1.pathToFileURL)(result) : null;
                },
            };
            options.importers = [
                rebase
                    ? (0, rebasing_importer_1.sassBindWorkaround)(new rebasing_importer_1.ModuleUrlRebasingImporter(entryDirectory, directoryCache, proxyImporter.findFileUrl))
                    : proxyImporter,
            ];
        }
        if (rebase && ((_a = options.loadPaths) === null || _a === void 0 ? void 0 : _a.length)) {
            (_b = options.importers) !== null && _b !== void 0 ? _b : (options.importers = []);
            options.importers.push((0, rebasing_importer_1.sassBindWorkaround)(new rebasing_importer_1.LoadPathsUrlRebasingImporter(entryDirectory, directoryCache, options.loadPaths)));
            options.loadPaths = undefined;
        }
        let relativeImporter;
        if (rebase) {
            relativeImporter = (0, rebasing_importer_1.sassBindWorkaround)(new rebasing_importer_1.RelativeUrlRebasingImporter(entryDirectory, directoryCache));
        }
        // The synchronous Sass render function can be up to two times faster than the async variant
        const result = (0, sass_1.compileString)(source, {
            ...options,
            // URL is not serializable so to convert to string in the parent and back to URL here.
            url: (0, node_url_1.pathToFileURL)(options.url),
            // The `importer` option (singular) handles relative imports
            importer: relativeImporter,
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
        node_worker_threads_1.parentPort.postMessage({
            id,
            warnings,
            result: {
                ...result,
                // URL is not serializable so to convert to string here and back to URL in the parent.
                loadedUrls: result.loadedUrls.map((p) => (0, node_url_1.fileURLToPath)(p)),
            },
        });
    }
    catch (error) {
        // Needed because V8 will only serialize the message and stack properties of an Error instance.
        if (error instanceof sass_1.Exception) {
            const { span, message, stack, sassMessage, sassStack } = error;
            node_worker_threads_1.parentPort.postMessage({
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
            node_worker_threads_1.parentPort.postMessage({ id, warnings, error: { message, stack } });
        }
        else {
            node_worker_threads_1.parentPort.postMessage({
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
        url: span.url ? (0, node_url_1.fileURLToPath)(span.url) : undefined,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvc2Fzcy93b3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFHSCx5Q0FBb0M7QUFDcEMsdUNBQXdEO0FBQ3hELDZEQUFnRztBQUNoRywrQkFNYztBQUNkLDJEQUs2QjtBQWlDN0IsSUFBSSxDQUFDLGdDQUFVLElBQUksQ0FBQyxnQ0FBVSxFQUFFO0lBQzlCLE1BQU0sSUFBSSxLQUFLLENBQUMsMkNBQTJDLENBQUMsQ0FBQztDQUM5RDtBQUVELDhFQUE4RTtBQUM5RSxNQUFNLEVBQUUsa0JBQWtCLEVBQUUsY0FBYyxFQUFFLEdBQUcsZ0NBRzlDLENBQUM7QUFFRixnQ0FBVSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxPQUE2QixFQUFFLEVBQUU7O0lBQ3pELElBQUksQ0FBQyxnQ0FBVSxFQUFFO1FBQ2YsTUFBTSxJQUFJLEtBQUssQ0FBQyx3RUFBd0UsQ0FBQyxDQUFDO0tBQzNGO0lBRUQsTUFBTSxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLEdBQUcsT0FBTyxDQUFDO0lBQ3hFLE1BQU0sY0FBYyxHQUFHLElBQUEsbUJBQU8sRUFBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDNUMsSUFBSSxRQU9TLENBQUM7SUFDZCxJQUFJO1FBQ0YsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLEVBQW9CLENBQUM7UUFDbkQsSUFBSSxXQUFXLEVBQUU7WUFDZixtRkFBbUY7WUFDbkYsb0RBQW9EO1lBQ3BELG9GQUFvRjtZQUNwRiwyRUFBMkU7WUFDM0UsMkVBQTJFO1lBQzNFLE1BQU0sYUFBYSxHQUF5QjtnQkFDMUMsV0FBVyxFQUFFLENBQUMsR0FBRyxFQUFF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SUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNO1lBQ3pCLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUk7U0FDdEI7UUFDRCxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBQSx3QkFBYSxFQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztLQUNwRCxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBEaXJlbnQgfSBmcm9tICdub2RlOmZzJztcbmltcG9ydCB7IGRpcm5hbWUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB7IE1lc3NhZ2VQb3J0LCBwYXJlbnRQb3J0LCByZWNlaXZlTWVzc2FnZU9uUG9ydCwgd29ya2VyRGF0YSB9IGZyb20gJ25vZGU6d29ya2VyX3RocmVhZHMnO1xuaW1wb3J0IHtcbiAgRXhjZXB0aW9uLFxuICBGaWxlSW1wb3J0ZXIsXG4gIFNvdXJjZVNwYW4sXG4gIFN0cmluZ09wdGlvbnNXaXRoSW1wb3J0ZXIsXG4gIGNvbXBpbGVTdHJpbmcsXG59IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHtcbiAgTG9hZFBhdGhzVXJsUmViYXNpbmdJbXBvcnRlcixcbiAgTW9kdWxlVXJsUmViYXNpbmdJbXBvcnRlcixcbiAgUmVsYXRpdmVVcmxSZWJhc2luZ0ltcG9ydGVyLFxuICBzYXNzQmluZFdvcmthcm91bmQsXG59IGZyb20gJy4vcmViYXNpbmctaW1wb3J0ZXInO1xuXG4vKipcbiAqIEEgcmVxdWVzdCB0byByZW5kZXIgYSBTYXNzIHN0eWxlc2hlZXQgdXNpbmcgdGhlIHN1cHBsaWVkIG9wdGlvbnMuXG4gKi9cbmludGVyZmFjZSBSZW5kZXJSZXF1ZXN0TWVzc2FnZSB7XG4gIC8qKlxuICAgKiBUaGUgdW5pcXVlIHJlcXVlc3QgaWRlbnRpZmllciB0aGF0IGxpbmtzIHRoZSByZW5kZXIgYWN0aW9uIHdpdGggYSBjYWxsYmFjayBhbmQgb3B0aW9uYWxcbiAgICogaW1wb3J0ZXIgb24gdGhlIG1haW4gdGhyZWFkLlxuICAgKi9cbiAgaWQ6IG51bWJlcjtcbiAgLyoqXG4gICAqIFRoZSBjb250ZW50cyB0byBjb21waWxlLlxuICAgKi9cbiAgc291cmNlOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBUaGUgU2FzcyBvcHRpb25zIHRvIHByb3ZpZGUgdG8gdGhlIGBkYXJ0LXNhc3NgIGNvbXBpbGUgZnVuY3Rpb24uXG4gICAqL1xuICBvcHRpb25zOiBPbWl0PFN0cmluZ09wdGlvbnNXaXRoSW1wb3J0ZXI8J3N5bmMnPiwgJ3VybCc+ICYgeyB1cmw6IHN0cmluZyB9O1xuICAvKipcbiAgICogSW5kaWNhdGVzIHRoZSByZXF1ZXN0IGhhcyBhIGN1c3RvbSBpbXBvcnRlciBmdW5jdGlvbiBvbiB0aGUgbWFpbiB0aHJlYWQuXG4gICAqL1xuICBoYXNJbXBvcnRlcjogYm9vbGVhbjtcbiAgLyoqXG4gICAqIEluZGljYXRlcyB0aGUgcmVxdWVzdCBoYXMgYSBjdXN0b20gbG9nZ2VyIGZvciB3YXJuaW5nIG1lc3NhZ2VzLlxuICAgKi9cbiAgaGFzTG9nZ2VyOiBib29sZWFuO1xuICAvKipcbiAgICogSW5kaWNhdGVzIHBhdGhzIHdpdGhpbiB1cmwoKSBDU1MgZnVuY3Rpb25zIHNob3VsZCBiZSByZWJhc2VkLlxuICAgKi9cbiAgcmViYXNlOiBib29sZWFuO1xufVxuXG5pZiAoIXBhcmVudFBvcnQgfHwgIXdvcmtlckRhdGEpIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdTYXNzIHdvcmtlciBtdXN0IGJlIGV4ZWN1dGVkIGFzIGEgV29ya2VyLicpO1xufVxuXG4vLyBUaGUgaW1wb3J0ZXIgdmFyaWFibGVzIGFyZSB1c2VkIHRvIHByb3h5IGltcG9ydCByZXF1ZXN0cyB0byB0aGUgbWFpbiB0aHJlYWRcbmNvbnN0IHsgd29ya2VySW1wb3J0ZXJQb3J0LCBpbXBvcnRlclNpZ25hbCB9ID0gd29ya2VyRGF0YSBhcyB7XG4gIHdvcmtlckltcG9ydGVyUG9ydDogTWVzc2FnZVBvcnQ7XG4gIGltcG9ydGVyU2lnbmFsOiBJbnQzMkFycmF5O1xufTtcblxucGFyZW50UG9ydC5vbignbWVzc2FnZScsIChtZXNzYWdlOiBSZW5kZXJSZXF1ZXN0TWVzc2FnZSkgPT4ge1xuICBpZiAoIXBhcmVudFBvcnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1wicGFyZW50UG9ydFwiIGlzIG5vdCBkZWZpbmVkLiBTYXNzIHdvcmtlciBtdXN0IGJlIGV4ZWN1dGVkIGFzIGEgV29ya2VyLicpO1xuICB9XG5cbiAgY29uc3QgeyBpZCwgaGFzSW1wb3J0ZXIsIGhhc0xvZ2dlciwgc291cmNlLCBvcHRpb25zLCByZWJhc2UgfSA9IG1lc3NhZ2U7XG4gIGNvbnN0IGVudHJ5RGlyZWN0b3J5ID0gZGlybmFtZShvcHRpb25zLnVybCk7XG4gIGxldCB3YXJuaW5nczpcbiAgICB8IHtcbiAgICAgICAgbWVzc2FnZTogc3RyaW5nO1xuICAgICAgICBkZXByZWNhdGlvbjogYm9vbGVhbjtcbiAgICAgICAgc3RhY2s/OiBzdHJpbmc7XG4gICAgICAgIHNwYW4/OiBPbWl0PFNvdXJjZVNwYW4sICd1cmwnPiAmIHsgdXJsPzogc3RyaW5nIH07XG4gICAgICB9W11cbiAgICB8IHVuZGVmaW5lZDtcbiAgdHJ5IHtcbiAgICBjb25zdCBkaXJlY3RvcnlDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBEaXJlbnRbXT4oKTtcbiAgICBpZiAoaGFzSW1wb3J0ZXIpIHtcbiAgICAgIC8vIFdoZW4gYSBjdXN0b20gaW1wb3J0ZXIgZnVuY3Rpb24gaXMgcHJlc2VudCwgdGhlIGltcG9ydGVyIHJlcXVlc3QgbXVzdCBiZSBwcm94aWVkXG4gICAgICAvLyBiYWNrIHRvIHRoZSBtYWluIHRocmVhZCB3aGVyZSBpdCBjYW4gYmUgZXhlY3V0ZWQuXG4gICAgICAvLyBUaGlzIHByb2Nlc3MgbXVzdCBiZSBzeW5jaHJvbm91cyBmcm9tIHRoZSBwZXJzcGVjdGl2ZSBvZiBkYXJ0LXNhc3MuIFRoZSBgQXRvbWljc2BcbiAgICAgIC8vIGZ1bmN0aW9ucyBjb21iaW5lZCB3aXRoIHRoZSBzaGFyZWQgbWVtb3J5IGBpbXBvcnRTaWduYWxgIGFuZCB0aGUgTm9kZS5qc1xuICAgICAgLy8gYHJlY2VpdmVNZXNzYWdlT25Qb3J0YCBmdW5jdGlvbiBhcmUgdXNlZCB0byBlbnN1cmUgc3luY2hyb25vdXMgYmVoYXZpb3IuXG4gICAgICBjb25zdCBwcm94eUltcG9ydGVyOiBGaWxlSW1wb3J0ZXI8J3N5bmMnPiA9IHtcbiAgICAgICAgZmluZEZpbGVVcmw6ICh1cmwsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgICBBdG9taWNzLnN0b3JlKGltcG9ydGVyU2lnbmFsLCAwLCAwKTtcbiAgICAgICAgICB3b3JrZXJJbXBvcnRlclBvcnQucG9zdE1lc3NhZ2UoeyBpZCwgdXJsLCBvcHRpb25zIH0pO1xuICAgICAgICAgIEF0b21pY3Mud2FpdChpbXBvcnRlclNpZ25hbCwgMCwgMCk7XG5cbiAgICAgICAgICBjb25zdCByZXN1bHQgPSByZWNlaXZlTWVzc2FnZU9uUG9ydCh3b3JrZXJJbXBvcnRlclBvcnQpPy5tZXNzYWdlIGFzIHN0cmluZyB8IG51bGw7XG5cbiAgICAgICAgICByZXR1cm4gcmVzdWx0ID8gcGF0aFRvRmlsZVVSTChyZXN1bHQpIDogbnVsbDtcbiAgICAgICAgfSxcbiAgICAgIH07XG4gICAgICBvcHRpb25zLmltcG9ydGVycyA9IFtcbiAgICAgICAgcmViYXNlXG4gICAgICAgICAgPyBzYXNzQmluZFdvcmthcm91bmQoXG4gICAgICAgICAgICAgIG5ldyBNb2R1bGVVcmxSZWJhc2luZ0ltcG9ydGVyKFxuICAgICAgICAgICAgICAgIGVudHJ5RGlyZWN0b3J5LFxuICAgICAgICAgICAgICAgIGRpcmVjdG9yeUNhY2hlLFxuICAgICAgICAgICAgICAgIHByb3h5SW1wb3J0ZXIuZmluZEZpbGVVcmwsXG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgICApXG4gICAgICAgICAgOiBwcm94eUltcG9ydGVyLFxuICAgICAgXTtcbiAgICB9XG5cbiAgICBpZiAocmViYXNlICYmIG9wdGlvbnMubG9hZFBhdGhzPy5sZW5ndGgpIHtcbiAgICAgIG9wdGlvbnMuaW1wb3J0ZXJzID8/PSBbXTtcbiAgICAgIG9wdGlvbnMuaW1wb3J0ZXJzLnB1c2goXG4gICAgICAgIHNhc3NCaW5kV29ya2Fyb3VuZChcbiAgICAgICAgICBuZXcgTG9hZFBhdGhzVXJsUmViYXNpbmdJbXBvcnRlcihlbnRyeURpcmVjdG9yeSwgZGlyZWN0b3J5Q2FjaGUsIG9wdGlvbnMubG9hZFBhdGhzKSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBvcHRpb25zLmxvYWRQYXRocyA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBsZXQgcmVsYXRpdmVJbXBvcnRlcjtcbiAgICBpZiAocmViYXNlKSB7XG4gICAgICByZWxhdGl2ZUltcG9ydGVyID0gc2Fzc0JpbmRXb3JrYXJvdW5kKFxuICAgICAgICBuZXcgUmVsYXRpdmVVcmxSZWJhc2luZ0ltcG9ydGVyKGVudHJ5RGlyZWN0b3J5LCBkaXJlY3RvcnlDYWNoZSksXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIFRoZSBzeW5jaHJvbm91cyBTYXNzIHJlbmRlciBmdW5jdGlvbiBjYW4gYmUgdXAgdG8gdHdvIHRpbWVzIGZhc3RlciB0aGFuIHRoZSBhc3luYyB2YXJpYW50XG4gICAgY29uc3QgcmVzdWx0ID0gY29tcGlsZVN0cmluZyhzb3VyY2UsIHtcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAvLyBVUkwgaXMgbm90IHNlcmlhbGl6YWJsZSBzbyB0byBjb252ZXJ0IHRvIHN0cmluZyBpbiB0aGUgcGFyZW50IGFuZCBiYWNrIHRvIFVSTCBoZXJlLlxuICAgICAgdXJsOiBwYXRoVG9GaWxlVVJMKG9wdGlvbnMudXJsKSxcbiAgICAgIC8vIFRoZSBgaW1wb3J0ZXJgIG9wdGlvbiAoc2luZ3VsYXIpIGhhbmRsZXMgcmVsYXRpdmUgaW1wb3J0c1xuICAgICAgaW1wb3J0ZXI6IHJlbGF0aXZlSW1wb3J0ZXIsXG4gICAgICBsb2dnZXI6IGhhc0xvZ2dlclxuICAgICAgICA/IHtcbiAgICAgICAgICAgIHdhcm4obWVzc2FnZSwgeyBkZXByZWNhdGlvbiwgc3Bhbiwgc3RhY2sgfSkge1xuICAgICAgICAgICAgICB3YXJuaW5ncyA/Pz0gW107XG4gICAgICAgICAgICAgIHdhcm5pbmdzLnB1c2goe1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgZGVwcmVjYXRpb24sXG4gICAgICAgICAgICAgICAgc3RhY2ssXG4gICAgICAgICAgICAgICAgc3Bhbjogc3BhbiAmJiBjb252ZXJ0U291cmNlU3BhbihzcGFuKSxcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgfSk7XG5cbiAgICBwYXJlbnRQb3J0LnBvc3RNZXNzYWdlKHtcbiAgICAgIGlkLFxuICAgICAgd2FybmluZ3MsXG4gICAgICByZXN1bHQ6IHtcbiAgICAgICAgLi4ucmVzdWx0LFxuICAgICAgICAvLyBVUkwgaXMgbm90IHNlcmlhbGl6YWJsZSBzbyB0byBjb252ZXJ0IHRvIHN0cmluZyBoZXJlIGFuZCBiYWNrIHRvIFVSTCBpbiB0aGUgcGFyZW50LlxuICAgICAgICBsb2FkZWRVcmxzOiByZXN1bHQubG9hZGVkVXJscy5tYXAoKHApID0+IGZpbGVVUkxUb1BhdGgocCkpLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAvLyBOZWVkZWQgYmVjYXVzZSBWOCB3aWxsIG9ubHkgc2VyaWFsaXplIHRoZSBtZXNzYWdlIGFuZCBzdGFjayBwcm9wZXJ0aWVzIG9mIGFuIEVycm9yIGluc3RhbmNlLlxuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEV4Y2VwdGlvbikge1xuICAgICAgY29uc3QgeyBzcGFuLCBtZXNzYWdlLCBzdGFjaywgc2Fzc01lc3NhZ2UsIHNhc3NTdGFjayB9ID0gZXJyb3I7XG4gICAgICBwYXJlbnRQb3J0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgaWQsXG4gICAgICAgIHdhcm5pbmdzLFxuICAgICAgICBlcnJvcjoge1xuICAgICAgICAgIHNwYW46IGNvbnZlcnRTb3VyY2VTcGFuKHNwYW4pLFxuICAgICAgICAgIG1lc3NhZ2UsXG4gICAgICAgICAgc3RhY2ssXG4gICAgICAgICAgc2Fzc01lc3NhZ2UsXG4gICAgICAgICAgc2Fzc1N0YWNrLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICBjb25zdCB7IG1lc3NhZ2UsIHN0YWNrIH0gPSBlcnJvcjtcbiAgICAgIHBhcmVudFBvcnQucG9zdE1lc3NhZ2UoeyBpZCwgd2FybmluZ3MsIGVycm9yOiB7IG1lc3NhZ2UsIHN0YWNrIH0gfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcmVudFBvcnQucG9zdE1lc3NhZ2Uoe1xuICAgICAgICBpZCxcbiAgICAgICAgd2FybmluZ3MsXG4gICAgICAgIGVycm9yOiB7IG1lc3NhZ2U6ICdBbiB1bmtub3duIGVycm9yIGhhcyBvY2N1cnJlZC4nIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn0pO1xuXG4vKipcbiAqIENvbnZlcnRzIGEgU2FzcyBTb3VyY2VTcGFuIG9iamVjdCBpbnRvIGEgc2VyaWFsaXphYmxlIGZvcm0uXG4gKiBUaGUgU291cmNlU3BhbiBvYmplY3QgY29udGFpbnMgYSBVUkwgcHJvcGVydHkgd2hpY2ggbXVzdCBiZSBjb252ZXJ0ZWQgaW50byBhIHN0cmluZy5cbiAqIEFsc28sIG1vc3Qgb2YgdGhlIGludGVyZmFjZSdzIHByb3BlcnRpZXMgYXJlIGdldCBhY2Nlc3NvcnMgYW5kIGFyZSBub3QgYXV0b21hdGljYWxseVxuICogc2VyaWFsaXplZCB3aGVuIHNlbnQgYmFjayBmcm9tIHRoZSB3b3JrZXIuXG4gKlxuICogQHBhcmFtIHNwYW4gVGhlIFNhc3MgU291cmNlU3BhbiBvYmplY3QgdG8gY29udmVydC5cbiAqIEByZXR1cm5zIEEgc2VyaWFsaXphYmxlIGZvcm0gb2YgdGhlIFNvdXJjZVNwYW4gb2JqZWN0LlxuICovXG5mdW5jdGlvbiBjb252ZXJ0U291cmNlU3BhbihzcGFuOiBTb3VyY2VTcGFuKTogT21pdDxTb3VyY2VTcGFuLCAndXJsJz4gJiB7IHVybD86IHN0cmluZyB9IHtcbiAgcmV0dXJuIHtcbiAgICB0ZXh0OiBzcGFuLnRleHQsXG4gICAgY29udGV4dDogc3Bhbi5jb250ZXh0LFxuICAgIGVuZDoge1xuICAgICAgY29sdW1uOiBzcGFuLmVuZC5jb2x1bW4sXG4gICAgICBvZmZzZXQ6IHNwYW4uZW5kLm9mZnNldCxcbiAgICAgIGxpbmU6IHNwYW4uZW5kLmxpbmUsXG4gICAgfSxcbiAgICBzdGFydDoge1xuICAgICAgY29sdW1uOiBzcGFuLnN0YXJ0LmNvbHVtbixcbiAgICAgIG9mZnNldDogc3Bhbi5zdGFydC5vZmZzZXQsXG4gICAgICBsaW5lOiBzcGFuLnN0YXJ0LmxpbmUsXG4gICAgfSxcbiAgICB1cmw6IHNwYW4udXJsID8gZmlsZVVSTFRvUGF0aChzcGFuLnVybCkgOiB1bmRlZmluZWQsXG4gIH07XG59XG4iXX0=