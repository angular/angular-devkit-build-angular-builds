"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SassWorkerImplementation = void 0;
const path_1 = require("path");
const url_1 = require("url");
const worker_threads_1 = require("worker_threads");
const environment_options_1 = require("../utils/environment-options");
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
class SassWorkerImplementation {
    constructor() {
        this.workers = [];
        this.availableWorkers = [];
        this.requests = new Map();
        this.workerPath = (0, path_1.join)(__dirname, './worker.js');
        this.idCounter = 1;
        this.nextWorkerIndex = 0;
    }
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
    compileString() {
        throw new Error('Sass compileString is not supported.');
    }
    /**
     * Asynchronously request a Sass stylesheet to be renderered.
     *
     * @param source The contents to compile.
     * @param options The `dart-sass` options to use when rendering the stylesheet.
     */
    compileStringAsync(source, options) {
        // The `functions`, `logger` and `importer` options are JavaScript functions that cannot be transferred.
        // If any additional function options are added in the future, they must be excluded as well.
        const { functions, importers, url, logger, ...serializableOptions } = options;
        // The CLI's configuration does not use or expose the ability to defined custom Sass functions
        if (functions && Object.keys(functions).length > 0) {
            throw new Error('Sass custom functions are not supported.');
        }
        return new Promise((resolve, reject) => {
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
            const callback = (error, result) => {
                if (error) {
                    const url = error === null || error === void 0 ? void 0 : error.span.url;
                    if (url) {
                        error.span.url = (0, url_1.pathToFileURL)(url);
                    }
                    reject(error);
                    return;
                }
                if (!result) {
                    reject(new Error('No result.'));
                    return;
                }
                resolve(result);
            };
            const request = this.createRequest(workerIndex, callback, importers);
            this.requests.set(request.id, request);
            this.workers[workerIndex].postMessage({
                id: request.id,
                source,
                hasImporter: !!(importers === null || importers === void 0 ? void 0 : importers.length),
                options: {
                    ...serializableOptions,
                    // URL is not serializable so to convert to string here and back to URL in the worker.
                    url: url ? (0, url_1.fileURLToPath)(url) : undefined,
                },
            });
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
            catch (_a) { }
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
                request.callback(undefined, {
                    ...response.result,
                    // URL is not serializable so in the worker we convert to string and here back to URL.
                    loadedUrls: response.result.loadedUrls.map((p) => (0, url_1.pathToFileURL)(p)),
                });
            }
            else {
                request.callback(response.error);
            }
        });
        mainImporterPort.on('message', ({ id, url, options }) => {
            const request = this.requests.get(id);
            if (!(request === null || request === void 0 ? void 0 : request.importers)) {
                mainImporterPort.postMessage(null);
                Atomics.store(importerSignal, 0, 1);
                Atomics.notify(importerSignal, 0);
                return;
            }
            this.processImporters(request.importers, url, options)
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
    async processImporters(importers, url, options) {
        for (const importer of importers) {
            if (this.isImporter(importer)) {
                // Importer
                throw new Error('Only File Importers are supported.');
            }
            // File importer (Can be sync or aync).
            const result = await importer.findFileUrl(url, options);
            if (result) {
                return (0, url_1.fileURLToPath)(result);
            }
        }
        return null;
    }
    createRequest(workerIndex, callback, importers) {
        return {
            id: this.idCounter++,
            workerIndex,
            callback,
            importers,
        };
    }
    isImporter(value) {
        return 'canonicalize' in value && 'load' in value;
    }
}
exports.SassWorkerImplementation = SassWorkerImplementation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvc2Fzcy9zYXNzLXNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsK0JBQTRCO0FBUzVCLDZCQUFtRDtBQUNuRCxtREFBd0Q7QUFDeEQsc0VBQTBEO0FBRTFEOztHQUVHO0FBQ0gsTUFBTSxrQkFBa0IsR0FBRyxnQ0FBVSxDQUFDO0FBcUN0Qzs7Ozs7R0FLRztBQUNILE1BQWEsd0JBQXdCO0lBQXJDO1FBQ21CLFlBQU8sR0FBYSxFQUFFLENBQUM7UUFDdkIscUJBQWdCLEdBQWEsRUFBRSxDQUFDO1FBQ2hDLGFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBeUIsQ0FBQztRQUM1QyxlQUFVLEdBQUcsSUFBQSxXQUFJLEVBQUMsU0FBUyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ3JELGNBQVMsR0FBRyxDQUFDLENBQUM7UUFDZCxvQkFBZSxHQUFHLENBQUMsQ0FBQztJQXFNOUIsQ0FBQztJQW5NQzs7O09BR0c7SUFDSCxJQUFJLElBQUk7UUFDTixPQUFPLG1CQUFtQixDQUFDO0lBQzdCLENBQUM7SUFFRDs7T0FFRztJQUNILGFBQWE7UUFDWCxNQUFNLElBQUksS0FBSyxDQUFDLHNDQUFzQyxDQUFDLENBQUM7SUFDMUQsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsa0JBQWtCLENBQ2hCLE1BQWMsRUFDZCxPQUFtRjtRQUVuRix3R0FBd0c7UUFDeEcsNkZBQTZGO1FBQzdGLE1BQU0sRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsR0FBRyxtQkFBbUIsRUFBRSxHQUFHLE9BQU8sQ0FBQztRQUU5RSw4RkFBOEY7UUFDOUYsSUFBSSxTQUFTLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENB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QUksU0FBUyxFQUFFO1lBQ2hDLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDN0IsV0FBVztnQkFDWCxNQUFNLElBQUksS0FBSyxDQUFDLG9DQUFvQyxDQUFDLENBQUM7YUFDdkQ7WUFFRCx1Q0FBdUM7WUFDdkMsTUFBTSxNQUFNLEdBQUcsTUFBTSxRQUFRLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUN4RCxJQUFJLE1BQU0sRUFBRTtnQkFDVixPQUFPLElBQUEsbUJBQWEsRUFBQyxNQUFNLENBQUMsQ0FBQzthQUM5QjtTQUNGO1FBRUQsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRU8sYUFBYSxDQUNuQixXQUFtQixFQUNuQixRQUF3QixFQUN4QixTQUFrQztRQUVsQyxPQUFPO1lBQ0wsRUFBRSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUU7WUFDcEIsV0FBVztZQUNYLFFBQVE7WUFDUixTQUFTO1NBQ1YsQ0FBQztJQUNKLENBQUM7SUFFTyxVQUFVLENBQUMsS0FBZ0I7UUFDakMsT0FBTyxjQUFjLElBQUksS0FBSyxJQUFJLE1BQU0sSUFBSSxLQUFLLENBQUM7SUFDcEQsQ0FBQztDQUNGO0FBM01ELDREQTJNQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQge1xuICBDb21waWxlUmVzdWx0LFxuICBFeGNlcHRpb24sXG4gIEZpbGVJbXBvcnRlcixcbiAgSW1wb3J0ZXIsXG4gIFN0cmluZ09wdGlvbnNXaXRoSW1wb3J0ZXIsXG4gIFN0cmluZ09wdGlvbnNXaXRob3V0SW1wb3J0ZXIsXG59IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgcGF0aFRvRmlsZVVSTCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgeyBNZXNzYWdlQ2hhbm5lbCwgV29ya2VyIH0gZnJvbSAnd29ya2VyX3RocmVhZHMnO1xuaW1wb3J0IHsgbWF4V29ya2VycyB9IGZyb20gJy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuXG4vKipcbiAqIFRoZSBtYXhpbXVtIG51bWJlciBvZiBXb3JrZXJzIHRoYXQgd2lsbCBiZSBjcmVhdGVkIHRvIGV4ZWN1dGUgcmVuZGVyIHJlcXVlc3RzLlxuICovXG5jb25zdCBNQVhfUkVOREVSX1dPUktFUlMgPSBtYXhXb3JrZXJzO1xuXG4vKipcbiAqIFRoZSBjYWxsYmFjayB0eXBlIGZvciB0aGUgYGRhcnQtc2Fzc2AgYXN5bmNocm9ub3VzIHJlbmRlciBmdW5jdGlvbi5cbiAqL1xudHlwZSBSZW5kZXJDYWxsYmFjayA9IChlcnJvcj86IEV4Y2VwdGlvbiwgcmVzdWx0PzogQ29tcGlsZVJlc3VsdCkgPT4gdm9pZDtcblxudHlwZSBGaWxlSW1wb3J0ZXJPcHRpb25zID0gUGFyYW1ldGVyczxGaWxlSW1wb3J0ZXJbJ2ZpbmRGaWxlVXJsJ10+WzFdO1xuXG4vKipcbiAqIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBjb250ZXh0dWFsIGluZm9ybWF0aW9uIGZvciBhIHNwZWNpZmljIHJlbmRlciByZXF1ZXN0LlxuICovXG5pbnRlcmZhY2UgUmVuZGVyUmVxdWVzdCB7XG4gIGlkOiBudW1iZXI7XG4gIHdvcmtlckluZGV4OiBudW1iZXI7XG4gIGNhbGxiYWNrOiBSZW5kZXJDYWxsYmFjaztcbiAgaW1wb3J0ZXJzPzogSW1wb3J0ZXJzW107XG59XG5cbi8qKlxuICogQWxsIGF2YWlsYWJsZSBpbXBvcnRlciB0eXBlcy5cbiAqL1xudHlwZSBJbXBvcnRlcnMgPVxuICB8IEltcG9ydGVyPCdzeW5jJz5cbiAgfCBJbXBvcnRlcjwnYXN5bmMnPlxuICB8IEZpbGVJbXBvcnRlcjwnc3luYyc+XG4gIHwgRmlsZUltcG9ydGVyPCdhc3luYyc+O1xuXG4vKipcbiAqIEEgcmVzcG9uc2UgZnJvbSB0aGUgU2FzcyByZW5kZXIgV29ya2VyIGNvbnRhaW5pbmcgdGhlIHJlc3VsdCBvZiB0aGUgb3BlcmF0aW9uLlxuICovXG5pbnRlcmZhY2UgUmVuZGVyUmVzcG9uc2VNZXNzYWdlIHtcbiAgaWQ6IG51bWJlcjtcbiAgZXJyb3I/OiBFeGNlcHRpb247XG4gIHJlc3VsdD86IE9taXQ8Q29tcGlsZVJlc3VsdCwgJ2xvYWRlZFVybHMnPiAmIHsgbG9hZGVkVXJsczogc3RyaW5nW10gfTtcbn1cblxuLyoqXG4gKiBBIFNhc3MgcmVuZGVyZXIgaW1wbGVtZW50YXRpb24gdGhhdCBwcm92aWRlcyBhbiBpbnRlcmZhY2UgdGhhdCBjYW4gYmUgdXNlZCBieSBXZWJwYWNrJ3NcbiAqIGBzYXNzLWxvYWRlcmAuIFRoZSBpbXBsZW1lbnRhdGlvbiB1c2VzIGEgV29ya2VyIHRocmVhZCB0byBwZXJmb3JtIHRoZSBTYXNzIHJlbmRlcmluZ1xuICogd2l0aCB0aGUgYGRhcnQtc2Fzc2AgcGFja2FnZS4gIFRoZSBgZGFydC1zYXNzYCBzeW5jaHJvbm91cyByZW5kZXIgZnVuY3Rpb24gaXMgdXNlZCB3aXRoaW5cbiAqIHRoZSB3b3JrZXIgd2hpY2ggY2FuIGJlIHVwIHRvIHR3byB0aW1lcyBmYXN0ZXIgdGhhbiB0aGUgYXN5bmNocm9ub3VzIHZhcmlhbnQuXG4gKi9cbmV4cG9ydCBjbGFzcyBTYXNzV29ya2VySW1wbGVtZW50YXRpb24ge1xuICBwcml2YXRlIHJlYWRvbmx5IHdvcmtlcnM6IFdvcmtlcltdID0gW107XG4gIHByaXZhdGUgcmVhZG9ubHkgYXZhaWxhYmxlV29ya2VyczogbnVtYmVyW10gPSBbXTtcbiAgcHJpdmF0ZSByZWFkb25seSByZXF1ZXN0cyA9IG5ldyBNYXA8bnVtYmVyLCBSZW5kZXJSZXF1ZXN0PigpO1xuICBwcml2YXRlIHJlYWRvbmx5IHdvcmtlclBhdGggPSBqb2luKF9fZGlybmFtZSwgJy4vd29ya2VyLmpzJyk7XG4gIHByaXZhdGUgaWRDb3VudGVyID0gMTtcbiAgcHJpdmF0ZSBuZXh0V29ya2VySW5kZXggPSAwO1xuXG4gIC8qKlxuICAgKiBQcm92aWRlcyBpbmZvcm1hdGlvbiBhYm91dCB0aGUgU2FzcyBpbXBsZW1lbnRhdGlvbi5cbiAgICogVGhpcyBtaW1pY3MgZW5vdWdoIG9mIHRoZSBgZGFydC1zYXNzYCB2YWx1ZSB0byBiZSB1c2VkIHdpdGggdGhlIGBzYXNzLWxvYWRlcmAuXG4gICAqL1xuICBnZXQgaW5mbygpOiBzdHJpbmcge1xuICAgIHJldHVybiAnZGFydC1zYXNzXFx0d29ya2VyJztcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgc3luY2hyb25vdXMgcmVuZGVyIGZ1bmN0aW9uIGlzIG5vdCB1c2VkIGJ5IHRoZSBgc2Fzcy1sb2FkZXJgLlxuICAgKi9cbiAgY29tcGlsZVN0cmluZygpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdTYXNzIGNvbXBpbGVTdHJpbmcgaXMgbm90IHN1cHBvcnRlZC4nKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXNseSByZXF1ZXN0IGEgU2FzcyBzdHlsZXNoZWV0IHRvIGJlIHJlbmRlcmVyZWQuXG4gICAqXG4gICAqIEBwYXJhbSBzb3VyY2UgVGhlIGNvbnRlbnRzIHRvIGNvbXBpbGUuXG4gICAqIEBwYXJhbSBvcHRpb25zIFRoZSBgZGFydC1zYXNzYCBvcHRpb25zIHRvIHVzZSB3aGVuIHJlbmRlcmluZyB0aGUgc3R5bGVzaGVldC5cbiAgICovXG4gIGNvbXBpbGVTdHJpbmdBc3luYyhcbiAgICBzb3VyY2U6IHN0cmluZyxcbiAgICBvcHRpb25zOiBTdHJpbmdPcHRpb25zV2l0aEltcG9ydGVyPCdhc3luYyc+IHwgU3RyaW5nT3B0aW9uc1dpdGhvdXRJbXBvcnRlcjwnYXN5bmMnPixcbiAgKTogUHJvbWlzZTxDb21waWxlUmVzdWx0PiB7XG4gICAgLy8gVGhlIGBmdW5jdGlvbnNgLCBgbG9nZ2VyYCBhbmQgYGltcG9ydGVyYCBvcHRpb25zIGFyZSBKYXZhU2NyaXB0IGZ1bmN0aW9ucyB0aGF0IGNhbm5vdCBiZSB0cmFuc2ZlcnJlZC5cbiAgICAvLyBJZiBhbnkgYWRkaXRpb25hbCBmdW5jdGlvbiBvcHRpb25zIGFyZSBhZGRlZCBpbiB0aGUgZnV0dXJlLCB0aGV5IG11c3QgYmUgZXhjbHVkZWQgYXMgd2VsbC5cbiAgICBjb25zdCB7IGZ1bmN0aW9ucywgaW1wb3J0ZXJzLCB1cmwsIGxvZ2dlciwgLi4uc2VyaWFsaXphYmxlT3B0aW9ucyB9ID0gb3B0aW9ucztcblxuICAgIC8vIFRoZSBDTEkncyBjb25maWd1cmF0aW9uIGRvZXMgbm90IHVzZSBvciBleHBvc2UgdGhlIGFiaWxpdHkgdG8gZGVmaW5lZCBjdXN0b20gU2FzcyBmdW5jdGlvbnNcbiAgICBpZiAoZnVuY3Rpb25zICYmIE9iamVjdC5rZXlzKGZ1bmN0aW9ucykubGVuZ3RoID4gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdTYXNzIGN1c3RvbSBmdW5jdGlvbnMgYXJlIG5vdCBzdXBwb3J0ZWQuJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPENvbXBpbGVSZXN1bHQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCB3b3JrZXJJbmRleCA9IHRoaXMuYXZhaWxhYmxlV29ya2Vycy5wb3AoKTtcbiAgICAgIGlmICh3b3JrZXJJbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0aGlzLndvcmtlcnMubGVuZ3RoIDwgTUFYX1JFTkRFUl9XT1JLRVJTKSB7XG4gICAgICAgICAgd29ya2VySW5kZXggPSB0aGlzLndvcmtlcnMubGVuZ3RoO1xuICAgICAgICAgIHRoaXMud29ya2Vycy5wdXNoKHRoaXMuY3JlYXRlV29ya2VyKCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHdvcmtlckluZGV4ID0gdGhpcy5uZXh0V29ya2VySW5kZXgrKztcbiAgICAgICAgICBpZiAodGhpcy5uZXh0V29ya2VySW5kZXggPj0gdGhpcy53b3JrZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5uZXh0V29ya2VySW5kZXggPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBjYWxsYmFjazogUmVuZGVyQ2FsbGJhY2sgPSAoZXJyb3IsIHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zdCB1cmwgPSBlcnJvcj8uc3Bhbi51cmwgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICAgIGlmICh1cmwpIHtcbiAgICAgICAgICAgIGVycm9yLnNwYW4udXJsID0gcGF0aFRvRmlsZVVSTCh1cmwpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJlamVjdChlcnJvcik7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ05vIHJlc3VsdC4nKSk7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCByZXF1ZXN0ID0gdGhpcy5jcmVhdGVSZXF1ZXN0KHdvcmtlckluZGV4LCBjYWxsYmFjaywgaW1wb3J0ZXJzKTtcbiAgICAgIHRoaXMucmVxdWVzdHMuc2V0KHJlcXVlc3QuaWQsIHJlcXVlc3QpO1xuXG4gICAgICB0aGlzLndvcmtlcnNbd29ya2VySW5kZXhdLnBvc3RNZXNzYWdlKHtcbiAgICAgICAgaWQ6IHJlcXVlc3QuaWQsXG4gICAgICAgIHNvdXJjZSxcbiAgICAgICAgaGFzSW1wb3J0ZXI6ICEhaW1wb3J0ZXJzPy5sZW5ndGgsXG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAuLi5zZXJpYWxpemFibGVPcHRpb25zLFxuICAgICAgICAgIC8vIFVSTCBpcyBub3Qgc2VyaWFsaXphYmxlIHNvIHRvIGNvbnZlcnQgdG8gc3RyaW5nIGhlcmUgYW5kIGJhY2sgdG8gVVJMIGluIHRoZSB3b3JrZXIuXG4gICAgICAgICAgdXJsOiB1cmwgPyBmaWxlVVJMVG9QYXRoKHVybCkgOiB1bmRlZmluZWQsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTaHV0ZG93biB0aGUgU2FzcyByZW5kZXIgd29ya2VyLlxuICAgKiBFeGVjdXRpbmcgdGhpcyBtZXRob2Qgd2lsbCBzdG9wIGFueSBwZW5kaW5nIHJlbmRlciByZXF1ZXN0cy5cbiAgICovXG4gIGNsb3NlKCk6IHZvaWQge1xuICAgIGZvciAoY29uc3Qgd29ya2VyIG9mIHRoaXMud29ya2Vycykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdm9pZCB3b3JrZXIudGVybWluYXRlKCk7XG4gICAgICB9IGNhdGNoIHt9XG4gICAgfVxuICAgIHRoaXMucmVxdWVzdHMuY2xlYXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlV29ya2VyKCk6IFdvcmtlciB7XG4gICAgY29uc3QgeyBwb3J0MTogbWFpbkltcG9ydGVyUG9ydCwgcG9ydDI6IHdvcmtlckltcG9ydGVyUG9ydCB9ID0gbmV3IE1lc3NhZ2VDaGFubmVsKCk7XG4gICAgY29uc3QgaW1wb3J0ZXJTaWduYWwgPSBuZXcgSW50MzJBcnJheShuZXcgU2hhcmVkQXJyYXlCdWZmZXIoNCkpO1xuXG4gICAgY29uc3Qgd29ya2VyID0gbmV3IFdvcmtlcih0aGlzLndvcmtlclBhdGgsIHtcbiAgICAgIHdvcmtlckRhdGE6IHsgd29ya2VySW1wb3J0ZXJQb3J0LCBpbXBvcnRlclNpZ25hbCB9LFxuICAgICAgdHJhbnNmZXJMaXN0OiBbd29ya2VySW1wb3J0ZXJQb3J0XSxcbiAgICB9KTtcblxuICAgIHdvcmtlci5vbignbWVzc2FnZScsIChyZXNwb25zZTogUmVuZGVyUmVzcG9uc2VNZXNzYWdlKSA9PiB7XG4gICAgICBjb25zdCByZXF1ZXN0ID0gdGhpcy5yZXF1ZXN0cy5nZXQocmVzcG9uc2UuaWQpO1xuICAgICAgaWYgKCFyZXF1ZXN0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdGhpcy5yZXF1ZXN0cy5kZWxldGUocmVzcG9uc2UuaWQpO1xuICAgICAgdGhpcy5hdmFpbGFibGVXb3JrZXJzLnB1c2gocmVxdWVzdC53b3JrZXJJbmRleCk7XG5cbiAgICAgIGlmIChyZXNwb25zZS5yZXN1bHQpIHtcbiAgICAgICAgcmVxdWVzdC5jYWxsYmFjayh1bmRlZmluZWQsIHtcbiAgICAgICAgICAuLi5yZXNwb25zZS5yZXN1bHQsXG4gICAgICAgICAgLy8gVVJMIGlzIG5vdCBzZXJpYWxpemFibGUgc28gaW4gdGhlIHdvcmtlciB3ZSBjb252ZXJ0IHRvIHN0cmluZyBhbmQgaGVyZSBiYWNrIHRvIFVSTC5cbiAgICAgICAgICBsb2FkZWRVcmxzOiByZXNwb25zZS5yZXN1bHQubG9hZGVkVXJscy5tYXAoKHApID0+IHBhdGhUb0ZpbGVVUkwocCkpLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlcXVlc3QuY2FsbGJhY2socmVzcG9uc2UuZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgbWFpbkltcG9ydGVyUG9ydC5vbihcbiAgICAgICdtZXNzYWdlJyxcbiAgICAgICh7IGlkLCB1cmwsIG9wdGlvbnMgfTogeyBpZDogbnVtYmVyOyB1cmw6IHN0cmluZzsgb3B0aW9uczogRmlsZUltcG9ydGVyT3B0aW9ucyB9KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlcXVlc3QgPSB0aGlzLnJlcXVlc3RzLmdldChpZCk7XG4gICAgICAgIGlmICghcmVxdWVzdD8uaW1wb3J0ZXJzKSB7XG4gICAgICAgICAgbWFpbkltcG9ydGVyUG9ydC5wb3N0TWVzc2FnZShudWxsKTtcbiAgICAgICAgICBBdG9taWNzLnN0b3JlKGltcG9ydGVyU2lnbmFsLCAwLCAxKTtcbiAgICAgICAgICBBdG9taWNzLm5vdGlmeShpbXBvcnRlclNpZ25hbCwgMCk7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnByb2Nlc3NJbXBvcnRlcnMocmVxdWVzdC5pbXBvcnRlcnMsIHVybCwgb3B0aW9ucylcbiAgICAgICAgICAudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICAgICAgICBtYWluSW1wb3J0ZXJQb3J0LnBvc3RNZXNzYWdlKHJlc3VsdCk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICBtYWluSW1wb3J0ZXJQb3J0LnBvc3RNZXNzYWdlKGVycm9yKTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgICAgIEF0b21pY3Muc3RvcmUoaW1wb3J0ZXJTaWduYWwsIDAsIDEpO1xuICAgICAgICAgICAgQXRvbWljcy5ub3RpZnkoaW1wb3J0ZXJTaWduYWwsIDApO1xuICAgICAgICAgIH0pO1xuICAgICAgfSxcbiAgICApO1xuXG4gICAgbWFpbkltcG9ydGVyUG9ydC51bnJlZigpO1xuXG4gICAgcmV0dXJuIHdvcmtlcjtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcHJvY2Vzc0ltcG9ydGVycyhcbiAgICBpbXBvcnRlcnM6IEl0ZXJhYmxlPEltcG9ydGVycz4sXG4gICAgdXJsOiBzdHJpbmcsXG4gICAgb3B0aW9uczogRmlsZUltcG9ydGVyT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgZm9yIChjb25zdCBpbXBvcnRlciBvZiBpbXBvcnRlcnMpIHtcbiAgICAgIGlmICh0aGlzLmlzSW1wb3J0ZXIoaW1wb3J0ZXIpKSB7XG4gICAgICAgIC8vIEltcG9ydGVyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignT25seSBGaWxlIEltcG9ydGVycyBhcmUgc3VwcG9ydGVkLicpO1xuICAgICAgfVxuXG4gICAgICAvLyBGaWxlIGltcG9ydGVyIChDYW4gYmUgc3luYyBvciBheW5jKS5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGltcG9ydGVyLmZpbmRGaWxlVXJsKHVybCwgb3B0aW9ucyk7XG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIHJldHVybiBmaWxlVVJMVG9QYXRoKHJlc3VsdCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVJlcXVlc3QoXG4gICAgd29ya2VySW5kZXg6IG51bWJlcixcbiAgICBjYWxsYmFjazogUmVuZGVyQ2FsbGJhY2ssXG4gICAgaW1wb3J0ZXJzOiBJbXBvcnRlcnNbXSB8IHVuZGVmaW5lZCxcbiAgKTogUmVuZGVyUmVxdWVzdCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiB0aGlzLmlkQ291bnRlcisrLFxuICAgICAgd29ya2VySW5kZXgsXG4gICAgICBjYWxsYmFjayxcbiAgICAgIGltcG9ydGVycyxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBpc0ltcG9ydGVyKHZhbHVlOiBJbXBvcnRlcnMpOiB2YWx1ZSBpcyBJbXBvcnRlciB7XG4gICAgcmV0dXJuICdjYW5vbmljYWxpemUnIGluIHZhbHVlICYmICdsb2FkJyBpbiB2YWx1ZTtcbiAgfVxufVxuIl19