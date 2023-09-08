"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const remapping_1 = __importDefault(require("@ampproject/remapping"));
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
    if (!node_worker_threads_1.parentPort) {
        throw new Error('"parentPort" is not defined. Sass worker must be executed as a Worker.');
    }
    const { id, hasImporter, hasLogger, source, options, rebase } = message;
    const entryDirectory = (0, node_path_1.dirname)(options.url);
    let warnings;
    try {
        const directoryCache = new Map();
        const rebaseSourceMaps = options.sourceMap ? new Map() : undefined;
        if (hasImporter) {
            // When a custom importer function is present, the importer request must be proxied
            // back to the main thread where it can be executed.
            // This process must be synchronous from the perspective of dart-sass. The `Atomics`
            // functions combined with the shared memory `importSignal` and the Node.js
            // `receiveMessageOnPort` function are used to ensure synchronous behavior.
            const proxyImporter = {
                findFileUrl: (url, options) => {
                    Atomics.store(importerSignal, 0, 0);
                    workerImporterPort.postMessage({ id, url, options });
                    Atomics.wait(importerSignal, 0, 0);
                    const result = (0, node_worker_threads_1.receiveMessageOnPort)(workerImporterPort)?.message;
                    return result ? (0, node_url_1.pathToFileURL)(result) : null;
                },
            };
            options.importers = [
                rebase
                    ? (0, rebasing_importer_1.sassBindWorkaround)(new rebasing_importer_1.ModuleUrlRebasingImporter(entryDirectory, directoryCache, rebaseSourceMaps, proxyImporter.findFileUrl))
                    : proxyImporter,
            ];
        }
        if (rebase && options.loadPaths?.length) {
            options.importers ??= [];
            options.importers.push((0, rebasing_importer_1.sassBindWorkaround)(new rebasing_importer_1.LoadPathsUrlRebasingImporter(entryDirectory, directoryCache, rebaseSourceMaps, options.loadPaths)));
            options.loadPaths = undefined;
        }
        let relativeImporter;
        if (rebase) {
            relativeImporter = (0, rebasing_importer_1.sassBindWorkaround)(new rebasing_importer_1.RelativeUrlRebasingImporter(entryDirectory, directoryCache, rebaseSourceMaps));
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
                        warnings ??= [];
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
        if (result.sourceMap && rebaseSourceMaps?.size) {
            // Merge the intermediate rebasing source maps into the final Sass generated source map.
            // Casting is required due to small but compatible differences in typings between the packages.
            result.sourceMap = (0, remapping_1.default)(result.sourceMap, 
            // To prevent an infinite lookup loop, skip getting the source when the rebasing source map
            // is referencing its original self.
            (file, context) => (file !== context.importer ? rebaseSourceMaps.get(file) : null));
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvc2Fzcy93b3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7QUFFSCxzRUFBc0U7QUFDdEUseUNBQW9DO0FBQ3BDLHVDQUF3RDtBQUN4RCw2REFBZ0c7QUFDaEcsK0JBTWM7QUFDZCwyREFNNkI7QUFpQzdCLElBQUksQ0FBQyxnQ0FBVSxJQUFJLENBQUMsZ0NBQVUsRUFBRTtJQUM5QixNQUFNLElBQUksS0FBSyxDQUFDLDJDQUEyQyxDQUFDLENBQUM7Q0FDOUQ7QUFFRCw4RUFBOEU7QUFDOUUsTUFBTSxFQUFFLGtCQUFrQixFQUFFLGNBQWMsRUFBRSxHQUFHLGdDQUc5QyxDQUFDO0FBRUYsZ0NBQVUsQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLENBQUMsT0FBNkIsRUFBRSxFQUFFO0lBQ3pELElBQUksQ0FBQyxnQ0FBVSxFQUFFO1FBQ2YsTUFBTSxJQUFJLEtBQUssQ0FBQyx3RUFBd0UsQ0FBQyxDQUFDO0tBQzNGO0lBRUQsTUFBTSxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLEdBQUcsT0FBTyxDQUFDO0lBQ3hFLE1BQU0sY0FBYyxHQUFHLElBQUEsbUJBQU8sRUFBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDNUMsSUFBSSxRQU9TLENBQUM7SUFDZCxJQUFJO1FBQ0YsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLEVBQTBCLENBQUM7UUFDekQsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsRUFBd0IsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ3pGLElBQUksV0FBVyxFQUFF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LEVBQUUsT0FBTyxFQUFFLGdDQUFnQyxFQUFFO2FBQ3JELENBQUMsQ0FBQztTQUNKO0tBQ0Y7QUFDSCxDQUFDLENBQUMsQ0FBQztBQUVIOzs7Ozs7OztHQVFHO0FBQ0gsU0FBUyxpQkFBaUIsQ0FBQyxJQUFnQjtJQUN6QyxPQUFPO1FBQ0wsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1FBQ2YsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPO1FBQ3JCLEdBQUcsRUFBRTtZQUNILE1BQU0sRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU07WUFDdkIsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTTtZQUN2QixJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJO1NBQ3BCO1FBQ0QsS0FBSyxFQUFFO1lBQ0wsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTTtZQUN6QixNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNO1lBQ3pCLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUk7U0FDdEI7UUFDRCxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBQSx3QkFBYSxFQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztLQUNwRCxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgbWVyZ2VTb3VyY2VNYXBzLCB7IFJhd1NvdXJjZU1hcCB9IGZyb20gJ0BhbXBwcm9qZWN0L3JlbWFwcGluZyc7XG5pbXBvcnQgeyBkaXJuYW1lIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgeyBNZXNzYWdlUG9ydCwgcGFyZW50UG9ydCwgcmVjZWl2ZU1lc3NhZ2VPblBvcnQsIHdvcmtlckRhdGEgfSBmcm9tICdub2RlOndvcmtlcl90aHJlYWRzJztcbmltcG9ydCB7XG4gIEV4Y2VwdGlvbixcbiAgRmlsZUltcG9ydGVyLFxuICBTb3VyY2VTcGFuLFxuICBTdHJpbmdPcHRpb25zV2l0aEltcG9ydGVyLFxuICBjb21waWxlU3RyaW5nLFxufSBmcm9tICdzYXNzJztcbmltcG9ydCB7XG4gIERpcmVjdG9yeUVudHJ5LFxuICBMb2FkUGF0aHNVcmxSZWJhc2luZ0ltcG9ydGVyLFxuICBNb2R1bGVVcmxSZWJhc2luZ0ltcG9ydGVyLFxuICBSZWxhdGl2ZVVybFJlYmFzaW5nSW1wb3J0ZXIsXG4gIHNhc3NCaW5kV29ya2Fyb3VuZCxcbn0gZnJvbSAnLi9yZWJhc2luZy1pbXBvcnRlcic7XG5cbi8qKlxuICogQSByZXF1ZXN0IHRvIHJlbmRlciBhIFNhc3Mgc3R5bGVzaGVldCB1c2luZyB0aGUgc3VwcGxpZWQgb3B0aW9ucy5cbiAqL1xuaW50ZXJmYWNlIFJlbmRlclJlcXVlc3RNZXNzYWdlIHtcbiAgLyoqXG4gICAqIFRoZSB1bmlxdWUgcmVxdWVzdCBpZGVudGlmaWVyIHRoYXQgbGlua3MgdGhlIHJlbmRlciBhY3Rpb24gd2l0aCBhIGNhbGxiYWNrIGFuZCBvcHRpb25hbFxuICAgKiBpbXBvcnRlciBvbiB0aGUgbWFpbiB0aHJlYWQuXG4gICAqL1xuICBpZDogbnVtYmVyO1xuICAvKipcbiAgICogVGhlIGNvbnRlbnRzIHRvIGNvbXBpbGUuXG4gICAqL1xuICBzb3VyY2U6IHN0cmluZztcbiAgLyoqXG4gICAqIFRoZSBTYXNzIG9wdGlvbnMgdG8gcHJvdmlkZSB0byB0aGUgYGRhcnQtc2Fzc2AgY29tcGlsZSBmdW5jdGlvbi5cbiAgICovXG4gIG9wdGlvbnM6IE9taXQ8U3RyaW5nT3B0aW9uc1dpdGhJbXBvcnRlcjwnc3luYyc+LCAndXJsJz4gJiB7IHVybDogc3RyaW5nIH07XG4gIC8qKlxuICAgKiBJbmRpY2F0ZXMgdGhlIHJlcXVlc3QgaGFzIGEgY3VzdG9tIGltcG9ydGVyIGZ1bmN0aW9uIG9uIHRoZSBtYWluIHRocmVhZC5cbiAgICovXG4gIGhhc0ltcG9ydGVyOiBib29sZWFuO1xuICAvKipcbiAgICogSW5kaWNhdGVzIHRoZSByZXF1ZXN0IGhhcyBhIGN1c3RvbSBsb2dnZXIgZm9yIHdhcm5pbmcgbWVzc2FnZXMuXG4gICAqL1xuICBoYXNMb2dnZXI6IGJvb2xlYW47XG4gIC8qKlxuICAgKiBJbmRpY2F0ZXMgcGF0aHMgd2l0aGluIHVybCgpIENTUyBmdW5jdGlvbnMgc2hvdWxkIGJlIHJlYmFzZWQuXG4gICAqL1xuICByZWJhc2U6IGJvb2xlYW47XG59XG5cbmlmICghcGFyZW50UG9ydCB8fCAhd29ya2VyRGF0YSkge1xuICB0aHJvdyBuZXcgRXJyb3IoJ1Nhc3Mgd29ya2VyIG11c3QgYmUgZXhlY3V0ZWQgYXMgYSBXb3JrZXIuJyk7XG59XG5cbi8vIFRoZSBpbXBvcnRlciB2YXJpYWJsZXMgYXJlIHVzZWQgdG8gcHJveHkgaW1wb3J0IHJlcXVlc3RzIHRvIHRoZSBtYWluIHRocmVhZFxuY29uc3QgeyB3b3JrZXJJbXBvcnRlclBvcnQsIGltcG9ydGVyU2lnbmFsIH0gPSB3b3JrZXJEYXRhIGFzIHtcbiAgd29ya2VySW1wb3J0ZXJQb3J0OiBNZXNzYWdlUG9ydDtcbiAgaW1wb3J0ZXJTaWduYWw6IEludDMyQXJyYXk7XG59O1xuXG5wYXJlbnRQb3J0Lm9uKCdtZXNzYWdlJywgKG1lc3NhZ2U6IFJlbmRlclJlcXVlc3RNZXNzYWdlKSA9PiB7XG4gIGlmICghcGFyZW50UG9ydCkge1xuICAgIHRocm93IG5ldyBFcnJvcignXCJwYXJlbnRQb3J0XCIgaXMgbm90IGRlZmluZWQuIFNhc3Mgd29ya2VyIG11c3QgYmUgZXhlY3V0ZWQgYXMgYSBXb3JrZXIuJyk7XG4gIH1cblxuICBjb25zdCB7IGlkLCBoYXNJbXBvcnRlciwgaGFzTG9nZ2VyLCBzb3VyY2UsIG9wdGlvbnMsIHJlYmFzZSB9ID0gbWVzc2FnZTtcbiAgY29uc3QgZW50cnlEaXJlY3RvcnkgPSBkaXJuYW1lKG9wdGlvbnMudXJsKTtcbiAgbGV0IHdhcm5pbmdzOlxuICAgIHwge1xuICAgICAgICBtZXNzYWdlOiBzdHJpbmc7XG4gICAgICAgIGRlcHJlY2F0aW9uOiBib29sZWFuO1xuICAgICAgICBzdGFjaz86IHN0cmluZztcbiAgICAgICAgc3Bhbj86IE9taXQ8U291cmNlU3BhbiwgJ3VybCc+ICYgeyB1cmw/OiBzdHJpbmcgfTtcbiAgICAgIH1bXVxuICAgIHwgdW5kZWZpbmVkO1xuICB0cnkge1xuICAgIGNvbnN0IGRpcmVjdG9yeUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIERpcmVjdG9yeUVudHJ5PigpO1xuICAgIGNvbnN0IHJlYmFzZVNvdXJjZU1hcHMgPSBvcHRpb25zLnNvdXJjZU1hcCA/IG5ldyBNYXA8c3RyaW5nLCBSYXdTb3VyY2VNYXA+KCkgOiB1bmRlZmluZWQ7XG4gICAgaWYgKGhhc0ltcG9ydGVyKSB7XG4gICAgICAvLyBXaGVuIGEgY3VzdG9tIGltcG9ydGVyIGZ1bmN0aW9uIGlzIHByZXNlbnQsIHRoZSBpbXBvcnRlciByZXF1ZXN0IG11c3QgYmUgcHJveGllZFxuICAgICAgLy8gYmFjayB0byB0aGUgbWFpbiB0aHJlYWQgd2hlcmUgaXQgY2FuIGJlIGV4ZWN1dGVkLlxuICAgICAgLy8gVGhpcyBwcm9jZXNzIG11c3QgYmUgc3luY2hyb25vdXMgZnJvbSB0aGUgcGVyc3BlY3RpdmUgb2YgZGFydC1zYXNzLiBUaGUgYEF0b21pY3NgXG4gICAgICAvLyBmdW5jdGlvbnMgY29tYmluZWQgd2l0aCB0aGUgc2hhcmVkIG1lbW9yeSBgaW1wb3J0U2lnbmFsYCBhbmQgdGhlIE5vZGUuanNcbiAgICAgIC8vIGByZWNlaXZlTWVzc2FnZU9uUG9ydGAgZnVuY3Rpb24gYXJlIHVzZWQgdG8gZW5zdXJlIHN5bmNocm9ub3VzIGJlaGF2aW9yLlxuICAgICAgY29uc3QgcHJveHlJbXBvcnRlcjogRmlsZUltcG9ydGVyPCdzeW5jJz4gPSB7XG4gICAgICAgIGZpbmRGaWxlVXJsOiAodXJsLCBvcHRpb25zKSA9PiB7XG4gICAgICAgICAgQXRvbWljcy5zdG9yZShpbXBvcnRlclNpZ25hbCwgMCwgMCk7XG4gICAgICAgICAgd29ya2VySW1wb3J0ZXJQb3J0LnBvc3RNZXNzYWdlKHsgaWQsIHVybCwgb3B0aW9ucyB9KTtcbiAgICAgICAgICBBdG9taWNzLndhaXQoaW1wb3J0ZXJTaWduYWwsIDAsIDApO1xuXG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gcmVjZWl2ZU1lc3NhZ2VPblBvcnQod29ya2VySW1wb3J0ZXJQb3J0KT8ubWVzc2FnZSBhcyBzdHJpbmcgfCBudWxsO1xuXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdCA/IHBhdGhUb0ZpbGVVUkwocmVzdWx0KSA6IG51bGw7XG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgICAgb3B0aW9ucy5pbXBvcnRlcnMgPSBbXG4gICAgICAgIHJlYmFzZVxuICAgICAgICAgID8gc2Fzc0JpbmRXb3JrYXJvdW5kKFxuICAgICAgICAgICAgICBuZXcgTW9kdWxlVXJsUmViYXNpbmdJbXBvcnRlcihcbiAgICAgICAgICAgICAgICBlbnRyeURpcmVjdG9yeSxcbiAgICAgICAgICAgICAgICBkaXJlY3RvcnlDYWNoZSxcbiAgICAgICAgICAgICAgICByZWJhc2VTb3VyY2VNYXBzLFxuICAgICAgICAgICAgICAgIHByb3h5SW1wb3J0ZXIuZmluZEZpbGVVcmwsXG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgICApXG4gICAgICAgICAgOiBwcm94eUltcG9ydGVyLFxuICAgICAgXTtcbiAgICB9XG5cbiAgICBpZiAocmViYXNlICYmIG9wdGlvbnMubG9hZFBhdGhzPy5sZW5ndGgpIHtcbiAgICAgIG9wdGlvbnMuaW1wb3J0ZXJzID8/PSBbXTtcbiAgICAgIG9wdGlvbnMuaW1wb3J0ZXJzLnB1c2goXG4gICAgICAgIHNhc3NCaW5kV29ya2Fyb3VuZChcbiAgICAgICAgICBuZXcgTG9hZFBhdGhzVXJsUmViYXNpbmdJbXBvcnRlcihcbiAgICAgICAgICAgIGVudHJ5RGlyZWN0b3J5LFxuICAgICAgICAgICAgZGlyZWN0b3J5Q2FjaGUsXG4gICAgICAgICAgICByZWJhc2VTb3VyY2VNYXBzLFxuICAgICAgICAgICAgb3B0aW9ucy5sb2FkUGF0aHMsXG4gICAgICAgICAgKSxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBvcHRpb25zLmxvYWRQYXRocyA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBsZXQgcmVsYXRpdmVJbXBvcnRlcjtcbiAgICBpZiAocmViYXNlKSB7XG4gICAgICByZWxhdGl2ZUltcG9ydGVyID0gc2Fzc0JpbmRXb3JrYXJvdW5kKFxuICAgICAgICBuZXcgUmVsYXRpdmVVcmxSZWJhc2luZ0ltcG9ydGVyKGVudHJ5RGlyZWN0b3J5LCBkaXJlY3RvcnlDYWNoZSwgcmViYXNlU291cmNlTWFwcyksXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIFRoZSBzeW5jaHJvbm91cyBTYXNzIHJlbmRlciBmdW5jdGlvbiBjYW4gYmUgdXAgdG8gdHdvIHRpbWVzIGZhc3RlciB0aGFuIHRoZSBhc3luYyB2YXJpYW50XG4gICAgY29uc3QgcmVzdWx0ID0gY29tcGlsZVN0cmluZyhzb3VyY2UsIHtcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAvLyBVUkwgaXMgbm90IHNlcmlhbGl6YWJsZSBzbyB0byBjb252ZXJ0IHRvIHN0cmluZyBpbiB0aGUgcGFyZW50IGFuZCBiYWNrIHRvIFVSTCBoZXJlLlxuICAgICAgdXJsOiBwYXRoVG9GaWxlVVJMKG9wdGlvbnMudXJsKSxcbiAgICAgIC8vIFRoZSBgaW1wb3J0ZXJgIG9wdGlvbiAoc2luZ3VsYXIpIGhhbmRsZXMgcmVsYXRpdmUgaW1wb3J0c1xuICAgICAgaW1wb3J0ZXI6IHJlbGF0aXZlSW1wb3J0ZXIsXG4gICAgICBsb2dnZXI6IGhhc0xvZ2dlclxuICAgICAgICA/IHtcbiAgICAgICAgICAgIHdhcm4obWVzc2FnZSwgeyBkZXByZWNhdGlvbiwgc3Bhbiwgc3RhY2sgfSkge1xuICAgICAgICAgICAgICB3YXJuaW5ncyA/Pz0gW107XG4gICAgICAgICAgICAgIHdhcm5pbmdzLnB1c2goe1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgZGVwcmVjYXRpb24sXG4gICAgICAgICAgICAgICAgc3RhY2ssXG4gICAgICAgICAgICAgICAgc3Bhbjogc3BhbiAmJiBjb252ZXJ0U291cmNlU3BhbihzcGFuKSxcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgfSk7XG5cbiAgICBpZiAocmVzdWx0LnNvdXJjZU1hcCAmJiByZWJhc2VTb3VyY2VNYXBzPy5zaXplKSB7XG4gICAgICAvLyBNZXJnZSB0aGUgaW50ZXJtZWRpYXRlIHJlYmFzaW5nIHNvdXJjZSBtYXBzIGludG8gdGhlIGZpbmFsIFNhc3MgZ2VuZXJhdGVkIHNvdXJjZSBtYXAuXG4gICAgICAvLyBDYXN0aW5nIGlzIHJlcXVpcmVkIGR1ZSB0byBzbWFsbCBidXQgY29tcGF0aWJsZSBkaWZmZXJlbmNlcyBpbiB0eXBpbmdzIGJldHdlZW4gdGhlIHBhY2thZ2VzLlxuICAgICAgcmVzdWx0LnNvdXJjZU1hcCA9IG1lcmdlU291cmNlTWFwcyhcbiAgICAgICAgcmVzdWx0LnNvdXJjZU1hcCBhcyB1bmtub3duIGFzIFJhd1NvdXJjZU1hcCxcbiAgICAgICAgLy8gVG8gcHJldmVudCBhbiBpbmZpbml0ZSBsb29rdXAgbG9vcCwgc2tpcCBnZXR0aW5nIHRoZSBzb3VyY2Ugd2hlbiB0aGUgcmViYXNpbmcgc291cmNlIG1hcFxuICAgICAgICAvLyBpcyByZWZlcmVuY2luZyBpdHMgb3JpZ2luYWwgc2VsZi5cbiAgICAgICAgKGZpbGUsIGNvbnRleHQpID0+IChmaWxlICE9PSBjb250ZXh0LmltcG9ydGVyID8gcmViYXNlU291cmNlTWFwcy5nZXQoZmlsZSkgOiBudWxsKSxcbiAgICAgICkgYXMgdW5rbm93biBhcyB0eXBlb2YgcmVzdWx0LnNvdXJjZU1hcDtcbiAgICB9XG5cbiAgICBwYXJlbnRQb3J0LnBvc3RNZXNzYWdlKHtcbiAgICAgIGlkLFxuICAgICAgd2FybmluZ3MsXG4gICAgICByZXN1bHQ6IHtcbiAgICAgICAgLi4ucmVzdWx0LFxuICAgICAgICAvLyBVUkwgaXMgbm90IHNlcmlhbGl6YWJsZSBzbyB0byBjb252ZXJ0IHRvIHN0cmluZyBoZXJlIGFuZCBiYWNrIHRvIFVSTCBpbiB0aGUgcGFyZW50LlxuICAgICAgICBsb2FkZWRVcmxzOiByZXN1bHQubG9hZGVkVXJscy5tYXAoKHApID0+IGZpbGVVUkxUb1BhdGgocCkpLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAvLyBOZWVkZWQgYmVjYXVzZSBWOCB3aWxsIG9ubHkgc2VyaWFsaXplIHRoZSBtZXNzYWdlIGFuZCBzdGFjayBwcm9wZXJ0aWVzIG9mIGFuIEVycm9yIGluc3RhbmNlLlxuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEV4Y2VwdGlvbikge1xuICAgICAgY29uc3QgeyBzcGFuLCBtZXNzYWdlLCBzdGFjaywgc2Fzc01lc3NhZ2UsIHNhc3NTdGFjayB9ID0gZXJyb3I7XG4gICAgICBwYXJlbnRQb3J0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgaWQsXG4gICAgICAgIHdhcm5pbmdzLFxuICAgICAgICBlcnJvcjoge1xuICAgICAgICAgIHNwYW46IGNvbnZlcnRTb3VyY2VTcGFuKHNwYW4pLFxuICAgICAgICAgIG1lc3NhZ2UsXG4gICAgICAgICAgc3RhY2ssXG4gICAgICAgICAgc2Fzc01lc3NhZ2UsXG4gICAgICAgICAgc2Fzc1N0YWNrLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICBjb25zdCB7IG1lc3NhZ2UsIHN0YWNrIH0gPSBlcnJvcjtcbiAgICAgIHBhcmVudFBvcnQucG9zdE1lc3NhZ2UoeyBpZCwgd2FybmluZ3MsIGVycm9yOiB7IG1lc3NhZ2UsIHN0YWNrIH0gfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcmVudFBvcnQucG9zdE1lc3NhZ2Uoe1xuICAgICAgICBpZCxcbiAgICAgICAgd2FybmluZ3MsXG4gICAgICAgIGVycm9yOiB7IG1lc3NhZ2U6ICdBbiB1bmtub3duIGVycm9yIGhhcyBvY2N1cnJlZC4nIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn0pO1xuXG4vKipcbiAqIENvbnZlcnRzIGEgU2FzcyBTb3VyY2VTcGFuIG9iamVjdCBpbnRvIGEgc2VyaWFsaXphYmxlIGZvcm0uXG4gKiBUaGUgU291cmNlU3BhbiBvYmplY3QgY29udGFpbnMgYSBVUkwgcHJvcGVydHkgd2hpY2ggbXVzdCBiZSBjb252ZXJ0ZWQgaW50byBhIHN0cmluZy5cbiAqIEFsc28sIG1vc3Qgb2YgdGhlIGludGVyZmFjZSdzIHByb3BlcnRpZXMgYXJlIGdldCBhY2Nlc3NvcnMgYW5kIGFyZSBub3QgYXV0b21hdGljYWxseVxuICogc2VyaWFsaXplZCB3aGVuIHNlbnQgYmFjayBmcm9tIHRoZSB3b3JrZXIuXG4gKlxuICogQHBhcmFtIHNwYW4gVGhlIFNhc3MgU291cmNlU3BhbiBvYmplY3QgdG8gY29udmVydC5cbiAqIEByZXR1cm5zIEEgc2VyaWFsaXphYmxlIGZvcm0gb2YgdGhlIFNvdXJjZVNwYW4gb2JqZWN0LlxuICovXG5mdW5jdGlvbiBjb252ZXJ0U291cmNlU3BhbihzcGFuOiBTb3VyY2VTcGFuKTogT21pdDxTb3VyY2VTcGFuLCAndXJsJz4gJiB7IHVybD86IHN0cmluZyB9IHtcbiAgcmV0dXJuIHtcbiAgICB0ZXh0OiBzcGFuLnRleHQsXG4gICAgY29udGV4dDogc3Bhbi5jb250ZXh0LFxuICAgIGVuZDoge1xuICAgICAgY29sdW1uOiBzcGFuLmVuZC5jb2x1bW4sXG4gICAgICBvZmZzZXQ6IHNwYW4uZW5kLm9mZnNldCxcbiAgICAgIGxpbmU6IHNwYW4uZW5kLmxpbmUsXG4gICAgfSxcbiAgICBzdGFydDoge1xuICAgICAgY29sdW1uOiBzcGFuLnN0YXJ0LmNvbHVtbixcbiAgICAgIG9mZnNldDogc3Bhbi5zdGFydC5vZmZzZXQsXG4gICAgICBsaW5lOiBzcGFuLnN0YXJ0LmxpbmUsXG4gICAgfSxcbiAgICB1cmw6IHNwYW4udXJsID8gZmlsZVVSTFRvUGF0aChzcGFuLnVybCkgOiB1bmRlZmluZWQsXG4gIH07XG59XG4iXX0=