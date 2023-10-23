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
                    workerImporterPort.postMessage({
                        id,
                        url,
                        options: {
                            ...options,
                            containingUrl: options.containingUrl ? (0, node_url_1.fileURLToPath)(options.containingUrl) : null,
                        },
                    });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvc2Fzcy93b3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7QUFFSCxzRUFBc0U7QUFDdEUseUNBQW9DO0FBQ3BDLHVDQUF3RDtBQUN4RCw2REFBZ0c7QUFDaEcsK0JBTWM7QUFDZCwyREFNNkI7QUFpQzdCLElBQUksQ0FBQyxnQ0FBVSxJQUFJLENBQUMsZ0NBQVUsRUFBRTtJQUM5QixNQUFNLElBQUksS0FBSyxDQUFDLDJDQUEyQyxDQUFDLENBQUM7Q0FDOUQ7QUFFRCw4RUFBOEU7QUFDOUUsTUFBTSxFQUFFLGtCQUFrQixFQUFFLGNBQWMsRUFBRSxHQUFHLGdDQUc5QyxDQUFDO0FBRUYsZ0NBQVUsQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLENBQUMsT0FBNkIsRUFBRSxFQUFFO0lBQ3pELElBQUksQ0FBQyxnQ0FBVSxFQUFFO1FBQ2YsTUFBTSxJQUFJLEtBQUssQ0FBQyx3RUFBd0UsQ0FBQyxDQUFDO0tBQzNGO0lBRUQsTUFBTSxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLEdBQUcsT0FBTyxDQUFDO0lBQ3hFLE1BQU0sY0FBYyxHQUFHLElBQUEsbUJBQU8sRUFBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDNUMsSUFBSSxRQU9TLENBQUM7SUFDZCxJQUFJO1FBQ0YsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLEVBQTBCLENBQUM7UUFDekQsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsRUFBd0IsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ3pGLElBQUksV0FBVyxFQUFF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QUFRLEVBQUUsS0FBSyxFQUFFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztTQUNyRTthQUFNO1lBQ0wsZ0NBQVUsQ0FBQyxXQUFXLENBQUM7Z0JBQ3JCLEVBQUU7Z0JBQ0YsUUFBUTtnQkFDUixLQUFLLEVBQUUsRUFBRSxPQUFPLEVBQUUsZ0NBQWdDLEVBQUU7YUFDckQsQ0FBQyxDQUFDO1NBQ0o7S0FDRjtBQUNILENBQUMsQ0FBQyxDQUFDO0FBRUg7Ozs7Ozs7O0dBUUc7QUFDSCxTQUFTLGlCQUFpQixDQUFDLElBQWdCO0lBQ3pDLE9BQU87UUFDTCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7UUFDZixPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU87UUFDckIsR0FBRyxFQUFFO1lBQ0gsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTTtZQUN2QixNQUFNLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNO1lBQ3ZCLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUk7U0FDcEI7UUFDRCxLQUFLLEVBQUU7WUFDTCxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNO1lBQ3pCLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU07WUFDekIsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSTtTQUN0QjtRQUNELEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFBLHdCQUFhLEVBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO0tBQ3BELENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBtZXJnZVNvdXJjZU1hcHMsIHsgUmF3U291cmNlTWFwIH0gZnJvbSAnQGFtcHByb2plY3QvcmVtYXBwaW5nJztcbmltcG9ydCB7IGRpcm5hbWUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ25vZGU6dXJsJztcbmltcG9ydCB7IE1lc3NhZ2VQb3J0LCBwYXJlbnRQb3J0LCByZWNlaXZlTWVzc2FnZU9uUG9ydCwgd29ya2VyRGF0YSB9IGZyb20gJ25vZGU6d29ya2VyX3RocmVhZHMnO1xuaW1wb3J0IHtcbiAgRXhjZXB0aW9uLFxuICBGaWxlSW1wb3J0ZXIsXG4gIFNvdXJjZVNwYW4sXG4gIFN0cmluZ09wdGlvbnNXaXRoSW1wb3J0ZXIsXG4gIGNvbXBpbGVTdHJpbmcsXG59IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHtcbiAgRGlyZWN0b3J5RW50cnksXG4gIExvYWRQYXRoc1VybFJlYmFzaW5nSW1wb3J0ZXIsXG4gIE1vZHVsZVVybFJlYmFzaW5nSW1wb3J0ZXIsXG4gIFJlbGF0aXZlVXJsUmViYXNpbmdJbXBvcnRlcixcbiAgc2Fzc0JpbmRXb3JrYXJvdW5kLFxufSBmcm9tICcuL3JlYmFzaW5nLWltcG9ydGVyJztcblxuLyoqXG4gKiBBIHJlcXVlc3QgdG8gcmVuZGVyIGEgU2FzcyBzdHlsZXNoZWV0IHVzaW5nIHRoZSBzdXBwbGllZCBvcHRpb25zLlxuICovXG5pbnRlcmZhY2UgUmVuZGVyUmVxdWVzdE1lc3NhZ2Uge1xuICAvKipcbiAgICogVGhlIHVuaXF1ZSByZXF1ZXN0IGlkZW50aWZpZXIgdGhhdCBsaW5rcyB0aGUgcmVuZGVyIGFjdGlvbiB3aXRoIGEgY2FsbGJhY2sgYW5kIG9wdGlvbmFsXG4gICAqIGltcG9ydGVyIG9uIHRoZSBtYWluIHRocmVhZC5cbiAgICovXG4gIGlkOiBudW1iZXI7XG4gIC8qKlxuICAgKiBUaGUgY29udGVudHMgdG8gY29tcGlsZS5cbiAgICovXG4gIHNvdXJjZTogc3RyaW5nO1xuICAvKipcbiAgICogVGhlIFNhc3Mgb3B0aW9ucyB0byBwcm92aWRlIHRvIHRoZSBgZGFydC1zYXNzYCBjb21waWxlIGZ1bmN0aW9uLlxuICAgKi9cbiAgb3B0aW9uczogT21pdDxTdHJpbmdPcHRpb25zV2l0aEltcG9ydGVyPCdzeW5jJz4sICd1cmwnPiAmIHsgdXJsOiBzdHJpbmcgfTtcbiAgLyoqXG4gICAqIEluZGljYXRlcyB0aGUgcmVxdWVzdCBoYXMgYSBjdXN0b20gaW1wb3J0ZXIgZnVuY3Rpb24gb24gdGhlIG1haW4gdGhyZWFkLlxuICAgKi9cbiAgaGFzSW1wb3J0ZXI6IGJvb2xlYW47XG4gIC8qKlxuICAgKiBJbmRpY2F0ZXMgdGhlIHJlcXVlc3QgaGFzIGEgY3VzdG9tIGxvZ2dlciBmb3Igd2FybmluZyBtZXNzYWdlcy5cbiAgICovXG4gIGhhc0xvZ2dlcjogYm9vbGVhbjtcbiAgLyoqXG4gICAqIEluZGljYXRlcyBwYXRocyB3aXRoaW4gdXJsKCkgQ1NTIGZ1bmN0aW9ucyBzaG91bGQgYmUgcmViYXNlZC5cbiAgICovXG4gIHJlYmFzZTogYm9vbGVhbjtcbn1cblxuaWYgKCFwYXJlbnRQb3J0IHx8ICF3b3JrZXJEYXRhKSB7XG4gIHRocm93IG5ldyBFcnJvcignU2FzcyB3b3JrZXIgbXVzdCBiZSBleGVjdXRlZCBhcyBhIFdvcmtlci4nKTtcbn1cblxuLy8gVGhlIGltcG9ydGVyIHZhcmlhYmxlcyBhcmUgdXNlZCB0byBwcm94eSBpbXBvcnQgcmVxdWVzdHMgdG8gdGhlIG1haW4gdGhyZWFkXG5jb25zdCB7IHdvcmtlckltcG9ydGVyUG9ydCwgaW1wb3J0ZXJTaWduYWwgfSA9IHdvcmtlckRhdGEgYXMge1xuICB3b3JrZXJJbXBvcnRlclBvcnQ6IE1lc3NhZ2VQb3J0O1xuICBpbXBvcnRlclNpZ25hbDogSW50MzJBcnJheTtcbn07XG5cbnBhcmVudFBvcnQub24oJ21lc3NhZ2UnLCAobWVzc2FnZTogUmVuZGVyUmVxdWVzdE1lc3NhZ2UpID0+IHtcbiAgaWYgKCFwYXJlbnRQb3J0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdcInBhcmVudFBvcnRcIiBpcyBub3QgZGVmaW5lZC4gU2FzcyB3b3JrZXIgbXVzdCBiZSBleGVjdXRlZCBhcyBhIFdvcmtlci4nKTtcbiAgfVxuXG4gIGNvbnN0IHsgaWQsIGhhc0ltcG9ydGVyLCBoYXNMb2dnZXIsIHNvdXJjZSwgb3B0aW9ucywgcmViYXNlIH0gPSBtZXNzYWdlO1xuICBjb25zdCBlbnRyeURpcmVjdG9yeSA9IGRpcm5hbWUob3B0aW9ucy51cmwpO1xuICBsZXQgd2FybmluZ3M6XG4gICAgfCB7XG4gICAgICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICAgICAgZGVwcmVjYXRpb246IGJvb2xlYW47XG4gICAgICAgIHN0YWNrPzogc3RyaW5nO1xuICAgICAgICBzcGFuPzogT21pdDxTb3VyY2VTcGFuLCAndXJsJz4gJiB7IHVybD86IHN0cmluZyB9O1xuICAgICAgfVtdXG4gICAgfCB1bmRlZmluZWQ7XG4gIHRyeSB7XG4gICAgY29uc3QgZGlyZWN0b3J5Q2FjaGUgPSBuZXcgTWFwPHN0cmluZywgRGlyZWN0b3J5RW50cnk+KCk7XG4gICAgY29uc3QgcmViYXNlU291cmNlTWFwcyA9IG9wdGlvbnMuc291cmNlTWFwID8gbmV3IE1hcDxzdHJpbmcsIFJhd1NvdXJjZU1hcD4oKSA6IHVuZGVmaW5lZDtcbiAgICBpZiAoaGFzSW1wb3J0ZXIpIHtcbiAgICAgIC8vIFdoZW4gYSBjdXN0b20gaW1wb3J0ZXIgZnVuY3Rpb24gaXMgcHJlc2VudCwgdGhlIGltcG9ydGVyIHJlcXVlc3QgbXVzdCBiZSBwcm94aWVkXG4gICAgICAvLyBiYWNrIHRvIHRoZSBtYWluIHRocmVhZCB3aGVyZSBpdCBjYW4gYmUgZXhlY3V0ZWQuXG4gICAgICAvLyBUaGlzIHByb2Nlc3MgbXVzdCBiZSBzeW5jaHJvbm91cyBmcm9tIHRoZSBwZXJzcGVjdGl2ZSBvZiBkYXJ0LXNhc3MuIFRoZSBgQXRvbWljc2BcbiAgICAgIC8vIGZ1bmN0aW9ucyBjb21iaW5lZCB3aXRoIHRoZSBzaGFyZWQgbWVtb3J5IGBpbXBvcnRTaWduYWxgIGFuZCB0aGUgTm9kZS5qc1xuICAgICAgLy8gYHJlY2VpdmVNZXNzYWdlT25Qb3J0YCBmdW5jdGlvbiBhcmUgdXNlZCB0byBlbnN1cmUgc3luY2hyb25vdXMgYmVoYXZpb3IuXG4gICAgICBjb25zdCBwcm94eUltcG9ydGVyOiBGaWxlSW1wb3J0ZXI8J3N5bmMnPiA9IHtcbiAgICAgICAgZmluZEZpbGVVcmw6ICh1cmwsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgICBBdG9taWNzLnN0b3JlKGltcG9ydGVyU2lnbmFsLCAwLCAwKTtcbiAgICAgICAgICB3b3JrZXJJbXBvcnRlclBvcnQucG9zdE1lc3NhZ2Uoe1xuICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICB1cmwsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICAgIGNvbnRhaW5pbmdVcmw6IG9wdGlvbnMuY29udGFpbmluZ1VybCA/IGZpbGVVUkxUb1BhdGgob3B0aW9ucy5jb250YWluaW5nVXJsKSA6IG51bGwsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIEF0b21pY3Mud2FpdChpbXBvcnRlclNpZ25hbCwgMCwgMCk7XG5cbiAgICAgICAgICBjb25zdCByZXN1bHQgPSByZWNlaXZlTWVzc2FnZU9uUG9ydCh3b3JrZXJJbXBvcnRlclBvcnQpPy5tZXNzYWdlIGFzIHN0cmluZyB8IG51bGw7XG5cbiAgICAgICAgICByZXR1cm4gcmVzdWx0ID8gcGF0aFRvRmlsZVVSTChyZXN1bHQpIDogbnVsbDtcbiAgICAgICAgfSxcbiAgICAgIH07XG4gICAgICBvcHRpb25zLmltcG9ydGVycyA9IFtcbiAgICAgICAgcmViYXNlXG4gICAgICAgICAgPyBzYXNzQmluZFdvcmthcm91bmQoXG4gICAgICAgICAgICAgIG5ldyBNb2R1bGVVcmxSZWJhc2luZ0ltcG9ydGVyKFxuICAgICAgICAgICAgICAgIGVudHJ5RGlyZWN0b3J5LFxuICAgICAgICAgICAgICAgIGRpcmVjdG9yeUNhY2hlLFxuICAgICAgICAgICAgICAgIHJlYmFzZVNvdXJjZU1hcHMsXG4gICAgICAgICAgICAgICAgcHJveHlJbXBvcnRlci5maW5kRmlsZVVybCxcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIClcbiAgICAgICAgICA6IHByb3h5SW1wb3J0ZXIsXG4gICAgICBdO1xuICAgIH1cblxuICAgIGlmIChyZWJhc2UgJiYgb3B0aW9ucy5sb2FkUGF0aHM/Lmxlbmd0aCkge1xuICAgICAgb3B0aW9ucy5pbXBvcnRlcnMgPz89IFtdO1xuICAgICAgb3B0aW9ucy5pbXBvcnRlcnMucHVzaChcbiAgICAgICAgc2Fzc0JpbmRXb3JrYXJvdW5kKFxuICAgICAgICAgIG5ldyBMb2FkUGF0aHNVcmxSZWJhc2luZ0ltcG9ydGVyKFxuICAgICAgICAgICAgZW50cnlEaXJlY3RvcnksXG4gICAgICAgICAgICBkaXJlY3RvcnlDYWNoZSxcbiAgICAgICAgICAgIHJlYmFzZVNvdXJjZU1hcHMsXG4gICAgICAgICAgICBvcHRpb25zLmxvYWRQYXRocyxcbiAgICAgICAgICApLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIG9wdGlvbnMubG9hZFBhdGhzID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGxldCByZWxhdGl2ZUltcG9ydGVyO1xuICAgIGlmIChyZWJhc2UpIHtcbiAgICAgIHJlbGF0aXZlSW1wb3J0ZXIgPSBzYXNzQmluZFdvcmthcm91bmQoXG4gICAgICAgIG5ldyBSZWxhdGl2ZVVybFJlYmFzaW5nSW1wb3J0ZXIoZW50cnlEaXJlY3RvcnksIGRpcmVjdG9yeUNhY2hlLCByZWJhc2VTb3VyY2VNYXBzKSxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gVGhlIHN5bmNocm9ub3VzIFNhc3MgcmVuZGVyIGZ1bmN0aW9uIGNhbiBiZSB1cCB0byB0d28gdGltZXMgZmFzdGVyIHRoYW4gdGhlIGFzeW5jIHZhcmlhbnRcbiAgICBjb25zdCByZXN1bHQgPSBjb21waWxlU3RyaW5nKHNvdXJjZSwge1xuICAgICAgLi4ub3B0aW9ucyxcbiAgICAgIC8vIFVSTCBpcyBub3Qgc2VyaWFsaXphYmxlIHNvIHRvIGNvbnZlcnQgdG8gc3RyaW5nIGluIHRoZSBwYXJlbnQgYW5kIGJhY2sgdG8gVVJMIGhlcmUuXG4gICAgICB1cmw6IHBhdGhUb0ZpbGVVUkwob3B0aW9ucy51cmwpLFxuICAgICAgLy8gVGhlIGBpbXBvcnRlcmAgb3B0aW9uIChzaW5ndWxhcikgaGFuZGxlcyByZWxhdGl2ZSBpbXBvcnRzXG4gICAgICBpbXBvcnRlcjogcmVsYXRpdmVJbXBvcnRlcixcbiAgICAgIGxvZ2dlcjogaGFzTG9nZ2VyXG4gICAgICAgID8ge1xuICAgICAgICAgICAgd2FybihtZXNzYWdlLCB7IGRlcHJlY2F0aW9uLCBzcGFuLCBzdGFjayB9KSB7XG4gICAgICAgICAgICAgIHdhcm5pbmdzID8/PSBbXTtcbiAgICAgICAgICAgICAgd2FybmluZ3MucHVzaCh7XG4gICAgICAgICAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgICAgICAgICBkZXByZWNhdGlvbixcbiAgICAgICAgICAgICAgICBzdGFjayxcbiAgICAgICAgICAgICAgICBzcGFuOiBzcGFuICYmIGNvbnZlcnRTb3VyY2VTcGFuKHNwYW4pLFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICB9KTtcblxuICAgIGlmIChyZXN1bHQuc291cmNlTWFwICYmIHJlYmFzZVNvdXJjZU1hcHM/LnNpemUpIHtcbiAgICAgIC8vIE1lcmdlIHRoZSBpbnRlcm1lZGlhdGUgcmViYXNpbmcgc291cmNlIG1hcHMgaW50byB0aGUgZmluYWwgU2FzcyBnZW5lcmF0ZWQgc291cmNlIG1hcC5cbiAgICAgIC8vIENhc3RpbmcgaXMgcmVxdWlyZWQgZHVlIHRvIHNtYWxsIGJ1dCBjb21wYXRpYmxlIGRpZmZlcmVuY2VzIGluIHR5cGluZ3MgYmV0d2VlbiB0aGUgcGFja2FnZXMuXG4gICAgICByZXN1bHQuc291cmNlTWFwID0gbWVyZ2VTb3VyY2VNYXBzKFxuICAgICAgICByZXN1bHQuc291cmNlTWFwIGFzIHVua25vd24gYXMgUmF3U291cmNlTWFwLFxuICAgICAgICAvLyBUbyBwcmV2ZW50IGFuIGluZmluaXRlIGxvb2t1cCBsb29wLCBza2lwIGdldHRpbmcgdGhlIHNvdXJjZSB3aGVuIHRoZSByZWJhc2luZyBzb3VyY2UgbWFwXG4gICAgICAgIC8vIGlzIHJlZmVyZW5jaW5nIGl0cyBvcmlnaW5hbCBzZWxmLlxuICAgICAgICAoZmlsZSwgY29udGV4dCkgPT4gKGZpbGUgIT09IGNvbnRleHQuaW1wb3J0ZXIgPyByZWJhc2VTb3VyY2VNYXBzLmdldChmaWxlKSA6IG51bGwpLFxuICAgICAgKSBhcyB1bmtub3duIGFzIHR5cGVvZiByZXN1bHQuc291cmNlTWFwO1xuICAgIH1cblxuICAgIHBhcmVudFBvcnQucG9zdE1lc3NhZ2Uoe1xuICAgICAgaWQsXG4gICAgICB3YXJuaW5ncyxcbiAgICAgIHJlc3VsdDoge1xuICAgICAgICAuLi5yZXN1bHQsXG4gICAgICAgIC8vIFVSTCBpcyBub3Qgc2VyaWFsaXphYmxlIHNvIHRvIGNvbnZlcnQgdG8gc3RyaW5nIGhlcmUgYW5kIGJhY2sgdG8gVVJMIGluIHRoZSBwYXJlbnQuXG4gICAgICAgIGxvYWRlZFVybHM6IHJlc3VsdC5sb2FkZWRVcmxzLm1hcCgocCkgPT4gZmlsZVVSTFRvUGF0aChwKSksXG4gICAgICB9LFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIE5lZWRlZCBiZWNhdXNlIFY4IHdpbGwgb25seSBzZXJpYWxpemUgdGhlIG1lc3NhZ2UgYW5kIHN0YWNrIHByb3BlcnRpZXMgb2YgYW4gRXJyb3IgaW5zdGFuY2UuXG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXhjZXB0aW9uKSB7XG4gICAgICBjb25zdCB7IHNwYW4sIG1lc3NhZ2UsIHN0YWNrLCBzYXNzTWVzc2FnZSwgc2Fzc1N0YWNrIH0gPSBlcnJvcjtcbiAgICAgIHBhcmVudFBvcnQucG9zdE1lc3NhZ2Uoe1xuICAgICAgICBpZCxcbiAgICAgICAgd2FybmluZ3MsXG4gICAgICAgIGVycm9yOiB7XG4gICAgICAgICAgc3BhbjogY29udmVydFNvdXJjZVNwYW4oc3BhbiksXG4gICAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgICBzdGFjayxcbiAgICAgICAgICBzYXNzTWVzc2FnZSxcbiAgICAgICAgICBzYXNzU3RhY2ssXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgIGNvbnN0IHsgbWVzc2FnZSwgc3RhY2sgfSA9IGVycm9yO1xuICAgICAgcGFyZW50UG9ydC5wb3N0TWVzc2FnZSh7IGlkLCB3YXJuaW5ncywgZXJyb3I6IHsgbWVzc2FnZSwgc3RhY2sgfSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyZW50UG9ydC5wb3N0TWVzc2FnZSh7XG4gICAgICAgIGlkLFxuICAgICAgICB3YXJuaW5ncyxcbiAgICAgICAgZXJyb3I6IHsgbWVzc2FnZTogJ0FuIHVua25vd24gZXJyb3IgaGFzIG9jY3VycmVkLicgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufSk7XG5cbi8qKlxuICogQ29udmVydHMgYSBTYXNzIFNvdXJjZVNwYW4gb2JqZWN0IGludG8gYSBzZXJpYWxpemFibGUgZm9ybS5cbiAqIFRoZSBTb3VyY2VTcGFuIG9iamVjdCBjb250YWlucyBhIFVSTCBwcm9wZXJ0eSB3aGljaCBtdXN0IGJlIGNvbnZlcnRlZCBpbnRvIGEgc3RyaW5nLlxuICogQWxzbywgbW9zdCBvZiB0aGUgaW50ZXJmYWNlJ3MgcHJvcGVydGllcyBhcmUgZ2V0IGFjY2Vzc29ycyBhbmQgYXJlIG5vdCBhdXRvbWF0aWNhbGx5XG4gKiBzZXJpYWxpemVkIHdoZW4gc2VudCBiYWNrIGZyb20gdGhlIHdvcmtlci5cbiAqXG4gKiBAcGFyYW0gc3BhbiBUaGUgU2FzcyBTb3VyY2VTcGFuIG9iamVjdCB0byBjb252ZXJ0LlxuICogQHJldHVybnMgQSBzZXJpYWxpemFibGUgZm9ybSBvZiB0aGUgU291cmNlU3BhbiBvYmplY3QuXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnRTb3VyY2VTcGFuKHNwYW46IFNvdXJjZVNwYW4pOiBPbWl0PFNvdXJjZVNwYW4sICd1cmwnPiAmIHsgdXJsPzogc3RyaW5nIH0ge1xuICByZXR1cm4ge1xuICAgIHRleHQ6IHNwYW4udGV4dCxcbiAgICBjb250ZXh0OiBzcGFuLmNvbnRleHQsXG4gICAgZW5kOiB7XG4gICAgICBjb2x1bW46IHNwYW4uZW5kLmNvbHVtbixcbiAgICAgIG9mZnNldDogc3Bhbi5lbmQub2Zmc2V0LFxuICAgICAgbGluZTogc3Bhbi5lbmQubGluZSxcbiAgICB9LFxuICAgIHN0YXJ0OiB7XG4gICAgICBjb2x1bW46IHNwYW4uc3RhcnQuY29sdW1uLFxuICAgICAgb2Zmc2V0OiBzcGFuLnN0YXJ0Lm9mZnNldCxcbiAgICAgIGxpbmU6IHNwYW4uc3RhcnQubGluZSxcbiAgICB9LFxuICAgIHVybDogc3Bhbi51cmwgPyBmaWxlVVJMVG9QYXRoKHNwYW4udXJsKSA6IHVuZGVmaW5lZCxcbiAgfTtcbn1cbiJdfQ==