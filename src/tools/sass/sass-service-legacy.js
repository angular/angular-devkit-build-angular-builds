"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SassLegacyWorkerImplementation = void 0;
const path_1 = require("path");
const worker_threads_1 = require("worker_threads");
const environment_options_1 = require("../../utils/environment-options");
/**
 * The maximum number of Workers that will be created to execute render requests.
 */
const MAX_RENDER_WORKERS = environment_options_1.maxWorkers;
/**
 * A Sass renderer implementation that provides an interface that can be used by Webpack's
 * `sass-loader`. The implementation uses a Worker thread to perform the Sass rendering
 * with the `dart-sass` package.  The `dart-sass` synchronous render function is used within
 * the worker which can be up to two times faster than the asynchronous variant.
 */
class SassLegacyWorkerImplementation {
    workers = [];
    availableWorkers = [];
    requests = new Map();
    workerPath = (0, path_1.join)(__dirname, './worker-legacy.js');
    idCounter = 1;
    nextWorkerIndex = 0;
    /**
     * Provides information about the Sass implementation.
     * This mimics enough of the `dart-sass` value to be used with the `sass-loader`.
     */
    get info() {
        return 'dart-sass\tworker';
    }
    /**
     * The synchronous render function is not used by the `sass-loader`.
     */
    renderSync() {
        throw new Error('Sass renderSync is not supported.');
    }
    /**
     * Asynchronously request a Sass stylesheet to be renderered.
     *
     * @param options The `dart-sass` options to use when rendering the stylesheet.
     * @param callback The function to execute when the rendering is complete.
     */
    render(options, callback) {
        // The `functions`, `logger` and `importer` options are JavaScript functions that cannot be transferred.
        // If any additional function options are added in the future, they must be excluded as well.
        const { functions, importer, logger, ...serializableOptions } = options;
        // The CLI's configuration does not use or expose the ability to defined custom Sass functions
        if (functions && Object.keys(functions).length > 0) {
            throw new Error('Sass custom functions are not supported.');
        }
        let workerIndex = this.availableWorkers.pop();
        if (workerIndex === undefined) {
            if (this.workers.length < MAX_RENDER_WORKERS) {
                workerIndex = this.workers.length;
                this.workers.push(this.createWorker());
            }
            else {
                workerIndex = this.nextWorkerIndex++;
                if (this.nextWorkerIndex >= this.workers.length) {
                    this.nextWorkerIndex = 0;
                }
            }
        }
        const request = this.createRequest(workerIndex, callback, importer);
        this.requests.set(request.id, request);
        this.workers[workerIndex].postMessage({
            id: request.id,
            hasImporter: !!importer,
            options: serializableOptions,
        });
    }
    /**
     * Shutdown the Sass render worker.
     * Executing this method will stop any pending render requests.
     */
    close() {
        for (const worker of this.workers) {
            try {
                void worker.terminate();
            }
            catch { }
        }
        this.requests.clear();
    }
    createWorker() {
        const { port1: mainImporterPort, port2: workerImporterPort } = new worker_threads_1.MessageChannel();
        const importerSignal = new Int32Array(new SharedArrayBuffer(4));
        const worker = new worker_threads_1.Worker(this.workerPath, {
            workerData: { workerImporterPort, importerSignal },
            transferList: [workerImporterPort],
        });
        worker.on('message', (response) => {
            const request = this.requests.get(response.id);
            if (!request) {
                return;
            }
            this.requests.delete(response.id);
            this.availableWorkers.push(request.workerIndex);
            if (response.result) {
                // The results are expected to be Node.js `Buffer` objects but will each be transferred as
                // a Uint8Array that does not have the expected `toString` behavior of a `Buffer`.
                const { css, map, stats } = response.result;
                const result = {
                    // This `Buffer.from` override will use the memory directly and avoid making a copy
                    css: Buffer.from(css.buffer, css.byteOffset, css.byteLength),
                    stats,
                };
                if (map) {
                    // This `Buffer.from` override will use the memory directly and avoid making a copy
                    result.map = Buffer.from(map.buffer, map.byteOffset, map.byteLength);
                }
                request.callback(undefined, result);
            }
            else {
                request.callback(response.error);
            }
        });
        mainImporterPort.on('message', ({ id, url, prev, fromImport, }) => {
            const request = this.requests.get(id);
            if (!request?.importers) {
                mainImporterPort.postMessage(null);
                Atomics.store(importerSignal, 0, 1);
                Atomics.notify(importerSignal, 0);
                return;
            }
            this.processImporters(request.importers, url, prev, fromImport)
                .then((result) => {
                mainImporterPort.postMessage(result);
            })
                .catch((error) => {
                mainImporterPort.postMessage(error);
            })
                .finally(() => {
                Atomics.store(importerSignal, 0, 1);
                Atomics.notify(importerSignal, 0);
            });
        });
        mainImporterPort.unref();
        return worker;
    }
    async processImporters(importers, url, prev, fromImport) {
        let result = null;
        for (const importer of importers) {
            result = await new Promise((resolve) => {
                // Importers can be both sync and async
                const innerResult = importer.call({ fromImport }, url, prev, resolve);
                if (innerResult !== undefined) {
                    resolve(innerResult);
                }
            });
            if (result) {
                break;
            }
        }
        return result;
    }
    createRequest(workerIndex, callback, importer) {
        return {
            id: this.idCounter++,
            workerIndex,
            callback,
            importers: !importer || Array.isArray(importer) ? importer : [importer],
        };
    }
}
exports.SassLegacyWorkerImplementation = SassLegacyWorkerImplementation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1zZXJ2aWNlLWxlZ2FjeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL3Nhc3Mvc2Fzcy1zZXJ2aWNlLWxlZ2FjeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQkFBNEI7QUFVNUIsbURBQXdEO0FBQ3hELHlFQUE2RDtBQUU3RDs7R0FFRztBQUNILE1BQU0sa0JBQWtCLEdBQUcsZ0NBQVUsQ0FBQztBQTBCdEM7Ozs7O0dBS0c7QUFDSCxNQUFhLDhCQUE4QjtJQUN4QixPQUFPLEdBQWEsRUFBRSxDQUFDO0lBQ3ZCLGdCQUFnQixHQUFhLEVBQUUsQ0FBQztJQUNoQyxRQUFRLEdBQUcsSUFBSSxHQUFHLEVBQXlCLENBQUM7SUFDNUMsVUFBVSxHQUFHLElBQUEsV0FBSSxFQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO0lBQzVELFNBQVMsR0FBRyxDQUFDLENBQUM7SUFDZCxlQUFlLEdBQUcsQ0FBQyxDQUFDO0lBRTVCOzs7T0FHRztJQUNILElBQUksSUFBSTtRQUNOLE9BQU8sbUJBQW1CLENBQUM7SUFDN0IsQ0FBQztJQUVEOztPQUVHO0lBQ0gsVUFBVTtRQUNSLE1BQU0sSUFBSSxLQUFLLENBQUMsbUNBQW1DLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxNQUFNLENBQUMsT0FBeUIsRUFBRSxRQUF3QjtRQUN4RCx3R0FBd0c7UUFDeEcsNkZBQTZGO1FBQzdGLE1BQU0sRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxHQUFHLG1CQUFtQixFQUFFLEdBQUcsT0FBTyxDQUFDO1FBRXhFLDhGQUE4RjtRQUM5RixJQUFJLFNBQVMsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLE1BQU0sR0FBRyxD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LElBQUksQ0FBQyxTQUFTLEVBQUU7WUFDcEIsV0FBVztZQUNYLFFBQVE7WUFDUixTQUFTLEVBQUUsQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztTQUN4RSxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBbE1ELHdFQWtNQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQge1xuICBMZWdhY3lBc3luY0ltcG9ydGVyIGFzIEFzeW5jSW1wb3J0ZXIsXG4gIExlZ2FjeVJlc3VsdCBhcyBDb21waWxlUmVzdWx0LFxuICBMZWdhY3lFeGNlcHRpb24gYXMgRXhjZXB0aW9uLFxuICBMZWdhY3lJbXBvcnRlclJlc3VsdCBhcyBJbXBvcnRlclJlc3VsdCxcbiAgTGVnYWN5SW1wb3J0ZXJUaGlzIGFzIEltcG9ydGVyVGhpcyxcbiAgTGVnYWN5T3B0aW9ucyBhcyBPcHRpb25zLFxuICBMZWdhY3lTeW5jSW1wb3J0ZXIgYXMgU3luY0ltcG9ydGVyLFxufSBmcm9tICdzYXNzJztcbmltcG9ydCB7IE1lc3NhZ2VDaGFubmVsLCBXb3JrZXIgfSBmcm9tICd3b3JrZXJfdGhyZWFkcyc7XG5pbXBvcnQgeyBtYXhXb3JrZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW52aXJvbm1lbnQtb3B0aW9ucyc7XG5cbi8qKlxuICogVGhlIG1heGltdW0gbnVtYmVyIG9mIFdvcmtlcnMgdGhhdCB3aWxsIGJlIGNyZWF0ZWQgdG8gZXhlY3V0ZSByZW5kZXIgcmVxdWVzdHMuXG4gKi9cbmNvbnN0IE1BWF9SRU5ERVJfV09SS0VSUyA9IG1heFdvcmtlcnM7XG5cbi8qKlxuICogVGhlIGNhbGxiYWNrIHR5cGUgZm9yIHRoZSBgZGFydC1zYXNzYCBhc3luY2hyb25vdXMgcmVuZGVyIGZ1bmN0aW9uLlxuICovXG50eXBlIFJlbmRlckNhbGxiYWNrID0gKGVycm9yPzogRXhjZXB0aW9uLCByZXN1bHQ/OiBDb21waWxlUmVzdWx0KSA9PiB2b2lkO1xuXG4vKipcbiAqIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBjb250ZXh0dWFsIGluZm9ybWF0aW9uIGZvciBhIHNwZWNpZmljIHJlbmRlciByZXF1ZXN0LlxuICovXG5pbnRlcmZhY2UgUmVuZGVyUmVxdWVzdCB7XG4gIGlkOiBudW1iZXI7XG4gIHdvcmtlckluZGV4OiBudW1iZXI7XG4gIGNhbGxiYWNrOiBSZW5kZXJDYWxsYmFjaztcbiAgaW1wb3J0ZXJzPzogKFN5bmNJbXBvcnRlciB8IEFzeW5jSW1wb3J0ZXIpW107XG59XG5cbi8qKlxuICogQSByZXNwb25zZSBmcm9tIHRoZSBTYXNzIHJlbmRlciBXb3JrZXIgY29udGFpbmluZyB0aGUgcmVzdWx0IG9mIHRoZSBvcGVyYXRpb24uXG4gKi9cbmludGVyZmFjZSBSZW5kZXJSZXNwb25zZU1lc3NhZ2Uge1xuICBpZDogbnVtYmVyO1xuICBlcnJvcj86IEV4Y2VwdGlvbjtcbiAgcmVzdWx0PzogQ29tcGlsZVJlc3VsdDtcbn1cblxuLyoqXG4gKiBBIFNhc3MgcmVuZGVyZXIgaW1wbGVtZW50YXRpb24gdGhhdCBwcm92aWRlcyBhbiBpbnRlcmZhY2UgdGhhdCBjYW4gYmUgdXNlZCBieSBXZWJwYWNrJ3NcbiAqIGBzYXNzLWxvYWRlcmAuIFRoZSBpbXBsZW1lbnRhdGlvbiB1c2VzIGEgV29ya2VyIHRocmVhZCB0byBwZXJmb3JtIHRoZSBTYXNzIHJlbmRlcmluZ1xuICogd2l0aCB0aGUgYGRhcnQtc2Fzc2AgcGFja2FnZS4gIFRoZSBgZGFydC1zYXNzYCBzeW5jaHJvbm91cyByZW5kZXIgZnVuY3Rpb24gaXMgdXNlZCB3aXRoaW5cbiAqIHRoZSB3b3JrZXIgd2hpY2ggY2FuIGJlIHVwIHRvIHR3byB0aW1lcyBmYXN0ZXIgdGhhbiB0aGUgYXN5bmNocm9ub3VzIHZhcmlhbnQuXG4gKi9cbmV4cG9ydCBjbGFzcyBTYXNzTGVnYWN5V29ya2VySW1wbGVtZW50YXRpb24ge1xuICBwcml2YXRlIHJlYWRvbmx5IHdvcmtlcnM6IFdvcmtlcltdID0gW107XG4gIHByaXZhdGUgcmVhZG9ubHkgYXZhaWxhYmxlV29ya2VyczogbnVtYmVyW10gPSBbXTtcbiAgcHJpdmF0ZSByZWFkb25seSByZXF1ZXN0cyA9IG5ldyBNYXA8bnVtYmVyLCBSZW5kZXJSZXF1ZXN0PigpO1xuICBwcml2YXRlIHJlYWRvbmx5IHdvcmtlclBhdGggPSBqb2luKF9fZGlybmFtZSwgJy4vd29ya2VyLWxlZ2FjeS5qcycpO1xuICBwcml2YXRlIGlkQ291bnRlciA9IDE7XG4gIHByaXZhdGUgbmV4dFdvcmtlckluZGV4ID0gMDtcblxuICAvKipcbiAgICogUHJvdmlkZXMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIFNhc3MgaW1wbGVtZW50YXRpb24uXG4gICAqIFRoaXMgbWltaWNzIGVub3VnaCBvZiB0aGUgYGRhcnQtc2Fzc2AgdmFsdWUgdG8gYmUgdXNlZCB3aXRoIHRoZSBgc2Fzcy1sb2FkZXJgLlxuICAgKi9cbiAgZ2V0IGluZm8oKTogc3RyaW5nIHtcbiAgICByZXR1cm4gJ2RhcnQtc2Fzc1xcdHdvcmtlcic7XG4gIH1cblxuICAvKipcbiAgICogVGhlIHN5bmNocm9ub3VzIHJlbmRlciBmdW5jdGlvbiBpcyBub3QgdXNlZCBieSB0aGUgYHNhc3MtbG9hZGVyYC5cbiAgICovXG4gIHJlbmRlclN5bmMoKTogbmV2ZXIge1xuICAgIHRocm93IG5ldyBFcnJvcignU2FzcyByZW5kZXJTeW5jIGlzIG5vdCBzdXBwb3J0ZWQuJyk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzbHkgcmVxdWVzdCBhIFNhc3Mgc3R5bGVzaGVldCB0byBiZSByZW5kZXJlcmVkLlxuICAgKlxuICAgKiBAcGFyYW0gb3B0aW9ucyBUaGUgYGRhcnQtc2Fzc2Agb3B0aW9ucyB0byB1c2Ugd2hlbiByZW5kZXJpbmcgdGhlIHN0eWxlc2hlZXQuXG4gICAqIEBwYXJhbSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdG8gZXhlY3V0ZSB3aGVuIHRoZSByZW5kZXJpbmcgaXMgY29tcGxldGUuXG4gICAqL1xuICByZW5kZXIob3B0aW9uczogT3B0aW9uczwnYXN5bmMnPiwgY2FsbGJhY2s6IFJlbmRlckNhbGxiYWNrKTogdm9pZCB7XG4gICAgLy8gVGhlIGBmdW5jdGlvbnNgLCBgbG9nZ2VyYCBhbmQgYGltcG9ydGVyYCBvcHRpb25zIGFyZSBKYXZhU2NyaXB0IGZ1bmN0aW9ucyB0aGF0IGNhbm5vdCBiZSB0cmFuc2ZlcnJlZC5cbiAgICAvLyBJZiBhbnkgYWRkaXRpb25hbCBmdW5jdGlvbiBvcHRpb25zIGFyZSBhZGRlZCBpbiB0aGUgZnV0dXJlLCB0aGV5IG11c3QgYmUgZXhjbHVkZWQgYXMgd2VsbC5cbiAgICBjb25zdCB7IGZ1bmN0aW9ucywgaW1wb3J0ZXIsIGxvZ2dlciwgLi4uc2VyaWFsaXphYmxlT3B0aW9ucyB9ID0gb3B0aW9ucztcblxuICAgIC8vIFRoZSBDTEkncyBjb25maWd1cmF0aW9uIGRvZXMgbm90IHVzZSBvciBleHBvc2UgdGhlIGFiaWxpdHkgdG8gZGVmaW5lZCBjdXN0b20gU2FzcyBmdW5jdGlvbnNcbiAgICBpZiAoZnVuY3Rpb25zICYmIE9iamVjdC5rZXlzKGZ1bmN0aW9ucykubGVuZ3RoID4gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdTYXNzIGN1c3RvbSBmdW5jdGlvbnMgYXJlIG5vdCBzdXBwb3J0ZWQuJyk7XG4gICAgfVxuXG4gICAgbGV0IHdvcmtlckluZGV4ID0gdGhpcy5hdmFpbGFibGVXb3JrZXJzLnBvcCgpO1xuICAgIGlmICh3b3JrZXJJbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAodGhpcy53b3JrZXJzLmxlbmd0aCA8IE1BWF9SRU5ERVJfV09SS0VSUykge1xuICAgICAgICB3b3JrZXJJbmRleCA9IHRoaXMud29ya2Vycy5sZW5ndGg7XG4gICAgICAgIHRoaXMud29ya2Vycy5wdXNoKHRoaXMuY3JlYXRlV29ya2VyKCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgd29ya2VySW5kZXggPSB0aGlzLm5leHRXb3JrZXJJbmRleCsrO1xuICAgICAgICBpZiAodGhpcy5uZXh0V29ya2VySW5kZXggPj0gdGhpcy53b3JrZXJzLmxlbmd0aCkge1xuICAgICAgICAgIHRoaXMubmV4dFdvcmtlckluZGV4ID0gMDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHJlcXVlc3QgPSB0aGlzLmNyZWF0ZVJlcXVlc3Qod29ya2VySW5kZXgsIGNhbGxiYWNrLCBpbXBvcnRlcik7XG4gICAgdGhpcy5yZXF1ZXN0cy5zZXQocmVxdWVzdC5pZCwgcmVxdWVzdCk7XG5cbiAgICB0aGlzLndvcmtlcnNbd29ya2VySW5kZXhdLnBvc3RNZXNzYWdlKHtcbiAgICAgIGlkOiByZXF1ZXN0LmlkLFxuICAgICAgaGFzSW1wb3J0ZXI6ICEhaW1wb3J0ZXIsXG4gICAgICBvcHRpb25zOiBzZXJpYWxpemFibGVPcHRpb25zLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNodXRkb3duIHRoZSBTYXNzIHJlbmRlciB3b3JrZXIuXG4gICAqIEV4ZWN1dGluZyB0aGlzIG1ldGhvZCB3aWxsIHN0b3AgYW55IHBlbmRpbmcgcmVuZGVyIHJlcXVlc3RzLlxuICAgKi9cbiAgY2xvc2UoKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCB3b3JrZXIgb2YgdGhpcy53b3JrZXJzKSB7XG4gICAgICB0cnkge1xuICAgICAgICB2b2lkIHdvcmtlci50ZXJtaW5hdGUoKTtcbiAgICAgIH0gY2F0Y2gge31cbiAgICB9XG4gICAgdGhpcy5yZXF1ZXN0cy5jbGVhcigpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVXb3JrZXIoKTogV29ya2VyIHtcbiAgICBjb25zdCB7IHBvcnQxOiBtYWluSW1wb3J0ZXJQb3J0LCBwb3J0Mjogd29ya2VySW1wb3J0ZXJQb3J0IH0gPSBuZXcgTWVzc2FnZUNoYW5uZWwoKTtcbiAgICBjb25zdCBpbXBvcnRlclNpZ25hbCA9IG5ldyBJbnQzMkFycmF5KG5ldyBTaGFyZWRBcnJheUJ1ZmZlcig0KSk7XG5cbiAgICBjb25zdCB3b3JrZXIgPSBuZXcgV29ya2VyKHRoaXMud29ya2VyUGF0aCwge1xuICAgICAgd29ya2VyRGF0YTogeyB3b3JrZXJJbXBvcnRlclBvcnQsIGltcG9ydGVyU2lnbmFsIH0sXG4gICAgICB0cmFuc2Zlckxpc3Q6IFt3b3JrZXJJbXBvcnRlclBvcnRdLFxuICAgIH0pO1xuXG4gICAgd29ya2VyLm9uKCdtZXNzYWdlJywgKHJlc3BvbnNlOiBSZW5kZXJSZXNwb25zZU1lc3NhZ2UpID0+IHtcbiAgICAgIGNvbnN0IHJlcXVlc3QgPSB0aGlzLnJlcXVlc3RzLmdldChyZXNwb25zZS5pZCk7XG4gICAgICBpZiAoIXJlcXVlc3QpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnJlcXVlc3RzLmRlbGV0ZShyZXNwb25zZS5pZCk7XG4gICAgICB0aGlzLmF2YWlsYWJsZVdvcmtlcnMucHVzaChyZXF1ZXN0LndvcmtlckluZGV4KTtcblxuICAgICAgaWYgKHJlc3BvbnNlLnJlc3VsdCkge1xuICAgICAgICAvLyBUaGUgcmVzdWx0cyBhcmUgZXhwZWN0ZWQgdG8gYmUgTm9kZS5qcyBgQnVmZmVyYCBvYmplY3RzIGJ1dCB3aWxsIGVhY2ggYmUgdHJhbnNmZXJyZWQgYXNcbiAgICAgICAgLy8gYSBVaW50OEFycmF5IHRoYXQgZG9lcyBub3QgaGF2ZSB0aGUgZXhwZWN0ZWQgYHRvU3RyaW5nYCBiZWhhdmlvciBvZiBhIGBCdWZmZXJgLlxuICAgICAgICBjb25zdCB7IGNzcywgbWFwLCBzdGF0cyB9ID0gcmVzcG9uc2UucmVzdWx0O1xuICAgICAgICBjb25zdCByZXN1bHQ6IENvbXBpbGVSZXN1bHQgPSB7XG4gICAgICAgICAgLy8gVGhpcyBgQnVmZmVyLmZyb21gIG92ZXJyaWRlIHdpbGwgdXNlIHRoZSBtZW1vcnkgZGlyZWN0bHkgYW5kIGF2b2lkIG1ha2luZyBhIGNvcHlcbiAgICAgICAgICBjc3M6IEJ1ZmZlci5mcm9tKGNzcy5idWZmZXIsIGNzcy5ieXRlT2Zmc2V0LCBjc3MuYnl0ZUxlbmd0aCksXG4gICAgICAgICAgc3RhdHMsXG4gICAgICAgIH07XG4gICAgICAgIGlmIChtYXApIHtcbiAgICAgICAgICAvLyBUaGlzIGBCdWZmZXIuZnJvbWAgb3ZlcnJpZGUgd2lsbCB1c2UgdGhlIG1lbW9yeSBkaXJlY3RseSBhbmQgYXZvaWQgbWFraW5nIGEgY29weVxuICAgICAgICAgIHJlc3VsdC5tYXAgPSBCdWZmZXIuZnJvbShtYXAuYnVmZmVyLCBtYXAuYnl0ZU9mZnNldCwgbWFwLmJ5dGVMZW5ndGgpO1xuICAgICAgICB9XG4gICAgICAgIHJlcXVlc3QuY2FsbGJhY2sodW5kZWZpbmVkLCByZXN1bHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVxdWVzdC5jYWxsYmFjayhyZXNwb25zZS5lcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBtYWluSW1wb3J0ZXJQb3J0Lm9uKFxuICAgICAgJ21lc3NhZ2UnLFxuICAgICAgKHtcbiAgICAgICAgaWQsXG4gICAgICAgIHVybCxcbiAgICAgICAgcHJldixcbiAgICAgICAgZnJvbUltcG9ydCxcbiAgICAgIH06IHtcbiAgICAgICAgaWQ6IG51bWJlcjtcbiAgICAgICAgdXJsOiBzdHJpbmc7XG4gICAgICAgIHByZXY6IHN0cmluZztcbiAgICAgICAgZnJvbUltcG9ydDogYm9vbGVhbjtcbiAgICAgIH0pID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHRoaXMucmVxdWVzdHMuZ2V0KGlkKTtcbiAgICAgICAgaWYgKCFyZXF1ZXN0Py5pbXBvcnRlcnMpIHtcbiAgICAgICAgICBtYWluSW1wb3J0ZXJQb3J0LnBvc3RNZXNzYWdlKG51bGwpO1xuICAgICAgICAgIEF0b21pY3Muc3RvcmUoaW1wb3J0ZXJTaWduYWwsIDAsIDEpO1xuICAgICAgICAgIEF0b21pY3Mubm90aWZ5KGltcG9ydGVyU2lnbmFsLCAwKTtcblxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucHJvY2Vzc0ltcG9ydGVycyhyZXF1ZXN0LmltcG9ydGVycywgdXJsLCBwcmV2LCBmcm9tSW1wb3J0KVxuICAgICAgICAgIC50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgIG1haW5JbXBvcnRlclBvcnQucG9zdE1lc3NhZ2UocmVzdWx0KTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgIG1haW5JbXBvcnRlclBvcnQucG9zdE1lc3NhZ2UoZXJyb3IpO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgICAgQXRvbWljcy5zdG9yZShpbXBvcnRlclNpZ25hbCwgMCwgMSk7XG4gICAgICAgICAgICBBdG9taWNzLm5vdGlmeShpbXBvcnRlclNpZ25hbCwgMCk7XG4gICAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICk7XG5cbiAgICBtYWluSW1wb3J0ZXJQb3J0LnVucmVmKCk7XG5cbiAgICByZXR1cm4gd29ya2VyO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBwcm9jZXNzSW1wb3J0ZXJzKFxuICAgIGltcG9ydGVyczogSXRlcmFibGU8U3luY0ltcG9ydGVyIHwgQXN5bmNJbXBvcnRlcj4sXG4gICAgdXJsOiBzdHJpbmcsXG4gICAgcHJldjogc3RyaW5nLFxuICAgIGZyb21JbXBvcnQ6IGJvb2xlYW4sXG4gICk6IFByb21pc2U8SW1wb3J0ZXJSZXN1bHQ+IHtcbiAgICBsZXQgcmVzdWx0ID0gbnVsbDtcbiAgICBmb3IgKGNvbnN0IGltcG9ydGVyIG9mIGltcG9ydGVycykge1xuICAgICAgcmVzdWx0ID0gYXdhaXQgbmV3IFByb21pc2U8SW1wb3J0ZXJSZXN1bHQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgIC8vIEltcG9ydGVycyBjYW4gYmUgYm90aCBzeW5jIGFuZCBhc3luY1xuICAgICAgICBjb25zdCBpbm5lclJlc3VsdCA9IChpbXBvcnRlciBhcyBBc3luY0ltcG9ydGVyKS5jYWxsKFxuICAgICAgICAgIHsgZnJvbUltcG9ydCB9IGFzIEltcG9ydGVyVGhpcyxcbiAgICAgICAgICB1cmwsXG4gICAgICAgICAgcHJldixcbiAgICAgICAgICByZXNvbHZlLFxuICAgICAgICApO1xuICAgICAgICBpZiAoaW5uZXJSZXN1bHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJlc29sdmUoaW5uZXJSZXN1bHQpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVSZXF1ZXN0KFxuICAgIHdvcmtlckluZGV4OiBudW1iZXIsXG4gICAgY2FsbGJhY2s6IFJlbmRlckNhbGxiYWNrLFxuICAgIGltcG9ydGVyOiBTeW5jSW1wb3J0ZXIgfCBBc3luY0ltcG9ydGVyIHwgKFN5bmNJbXBvcnRlciB8IEFzeW5jSW1wb3J0ZXIpW10gfCB1bmRlZmluZWQsXG4gICk6IFJlbmRlclJlcXVlc3Qge1xuICAgIHJldHVybiB7XG4gICAgICBpZDogdGhpcy5pZENvdW50ZXIrKyxcbiAgICAgIHdvcmtlckluZGV4LFxuICAgICAgY2FsbGJhY2ssXG4gICAgICBpbXBvcnRlcnM6ICFpbXBvcnRlciB8fCBBcnJheS5pc0FycmF5KGltcG9ydGVyKSA/IGltcG9ydGVyIDogW2ltcG9ydGVyXSxcbiAgICB9O1xuICB9XG59XG4iXX0=