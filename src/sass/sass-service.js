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
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const node_worker_threads_1 = require("node:worker_threads");
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
        this.workerPath = (0, node_path_1.join)(__dirname, './worker.js');
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
                        error.span.url = (0, node_url_1.pathToFileURL)(url);
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
                    url: url ? (0, node_url_1.fileURLToPath)(url) : undefined,
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
        const { port1: mainImporterPort, port2: workerImporterPort } = new node_worker_threads_1.MessageChannel();
        const importerSignal = new Int32Array(new SharedArrayBuffer(4));
        const worker = new node_worker_threads_1.Worker(this.workerPath, {
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
                    loadedUrls: response.result.loadedUrls.map((p) => (0, node_url_1.pathToFileURL)(p)),
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
            this.processImporters(request.importers, url, {
                ...options,
                previousResolvedModules: request.previousResolvedModules,
            })
                .then((result) => {
                var _a;
                if (result) {
                    (_a = request.previousResolvedModules) !== null && _a !== void 0 ? _a : (request.previousResolvedModules = new Set());
                    request.previousResolvedModules.add((0, node_path_1.dirname)(result));
                }
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
                return (0, node_url_1.fileURLToPath)(result);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvc2Fzcy9zYXNzLXNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgseUNBQTBDO0FBQzFDLHVDQUF3RDtBQUN4RCw2REFBNkQ7QUFTN0Qsc0VBQTBEO0FBRTFEOztHQUVHO0FBQ0gsTUFBTSxrQkFBa0IsR0FBRyxnQ0FBVSxDQUFDO0FBZ0R0Qzs7Ozs7R0FLRztBQUNILE1BQWEsd0JBQXdCO0lBQXJDO1FBQ21CLFlBQU8sR0FBYSxFQUFFLENBQUM7UUFDdkIscUJBQWdCLEdBQWEsRUFBRSxDQUFDO1FBQ2hDLGFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBeUIsQ0FBQztRQUM1QyxlQUFVLEdBQUcsSUFBQSxnQkFBSSxFQUFDLFNBQVMsRUFBRSxhQUFhLENBQUMsQ0FBQztRQUNyRCxjQUFTLEdBQUcsQ0FBQyxDQUFDO1FBQ2Qsb0JBQWUsR0FBRyxDQUFDLENBQUM7SUE2TTlCLENBQUM7SUEzTUM7OztPQUdHO0lBQ0gsSUFBSSxJQUFJO1FBQ04sT0FBTyxtQkFBbUIsQ0FBQztJQUM3QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxhQUFhO1FBQ1gsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILGtCQUFrQixDQUNoQixNQUFjLEVBQ2QsT0FBbUY7UUFFbkYsd0dBQXdHO1FBQ3hHLDZGQUE2RjtRQUM3RixNQUFNLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLEdBQUcsbUJBQW1CLEVBQUUsR0FBRyxPQUFPLENBQUM7UUFFOUUsOEZBQThGO1FBQzlGLElBQUksU0FBUyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxD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QUNwQyxPQUFPLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNwQyxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUMsQ0FDRixDQUFDO1FBRUYsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFekIsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVPLEtBQUssQ0FBQyxnQkFBZ0IsQ0FDNUIsU0FBOEIsRUFDOUIsR0FBVyxFQUNYLE9BQThDO1FBRTlDLEtBQUssTUFBTSxRQUFRLElBQUksU0FBUyxFQUFFO1lBQ2hDLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDN0IsV0FBVztnQkFDWCxNQUFNLElBQUksS0FBSyxDQUFDLG9DQUFvQyxDQUFDLENBQUM7YUFDdkQ7WUFFRCx1Q0FBdUM7WUFDdkMsTUFBTSxNQUFNLEdBQUcsTUFBTSxRQUFRLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUN4RCxJQUFJLE1BQU0sRUFBRTtnQkFDVixPQUFPLElBQUEsd0JBQWEsRUFBQyxNQUFNLENBQUMsQ0FBQzthQUM5QjtTQUNGO1FBRUQsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRU8sYUFBYSxDQUNuQixXQUFtQixFQUNuQixRQUF3QixFQUN4QixTQUFrQztRQUVsQyxPQUFPO1lBQ0wsRUFBRSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUU7WUFDcEIsV0FBVztZQUNYLFFBQVE7WUFDUixTQUFTO1NBQ1YsQ0FBQztJQUNKLENBQUM7SUFFTyxVQUFVLENBQUMsS0FBZ0I7UUFDakMsT0FBTyxjQUFjLElBQUksS0FBSyxJQUFJLE1BQU0sSUFBSSxLQUFLLENBQUM7SUFDcEQsQ0FBQztDQUNGO0FBbk5ELDREQW1OQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBkaXJuYW1lLCBqb2luIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIHBhdGhUb0ZpbGVVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgeyBNZXNzYWdlQ2hhbm5lbCwgV29ya2VyIH0gZnJvbSAnbm9kZTp3b3JrZXJfdGhyZWFkcyc7XG5pbXBvcnQge1xuICBDb21waWxlUmVzdWx0LFxuICBFeGNlcHRpb24sXG4gIEZpbGVJbXBvcnRlcixcbiAgSW1wb3J0ZXIsXG4gIFN0cmluZ09wdGlvbnNXaXRoSW1wb3J0ZXIsXG4gIFN0cmluZ09wdGlvbnNXaXRob3V0SW1wb3J0ZXIsXG59IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHsgbWF4V29ya2VycyB9IGZyb20gJy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuXG4vKipcbiAqIFRoZSBtYXhpbXVtIG51bWJlciBvZiBXb3JrZXJzIHRoYXQgd2lsbCBiZSBjcmVhdGVkIHRvIGV4ZWN1dGUgcmVuZGVyIHJlcXVlc3RzLlxuICovXG5jb25zdCBNQVhfUkVOREVSX1dPUktFUlMgPSBtYXhXb3JrZXJzO1xuXG4vKipcbiAqIFRoZSBjYWxsYmFjayB0eXBlIGZvciB0aGUgYGRhcnQtc2Fzc2AgYXN5bmNocm9ub3VzIHJlbmRlciBmdW5jdGlvbi5cbiAqL1xudHlwZSBSZW5kZXJDYWxsYmFjayA9IChlcnJvcj86IEV4Y2VwdGlvbiwgcmVzdWx0PzogQ29tcGlsZVJlc3VsdCkgPT4gdm9pZDtcblxudHlwZSBGaWxlSW1wb3J0ZXJPcHRpb25zID0gUGFyYW1ldGVyczxGaWxlSW1wb3J0ZXJbJ2ZpbmRGaWxlVXJsJ10+WzFdO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZpbGVJbXBvcnRlcldpdGhSZXF1ZXN0Q29udGV4dE9wdGlvbnMgZXh0ZW5kcyBGaWxlSW1wb3J0ZXJPcHRpb25zIHtcbiAgLyoqXG4gICAqIFRoaXMgaXMgYSBjdXN0b20gb3B0aW9uIGFuZCBpcyByZXF1aXJlZCBhcyBTQVNTIGRvZXMgbm90IHByb3ZpZGUgY29udGV4dCBmcm9tIHdoaWNoIHRoZSBmaWxlIGlzIGJlaW5nIHJlc29sdmVkLlxuICAgKiBUaGlzIGJyZWFrcyBZYXJuIFBOUCBhcyB0cmFuc2l0aXZlIGRlcHMgY2Fubm90IGJlIHJlc29sdmVkIGZyb20gdGhlIHdvcmtzcGFjZSByb290LlxuICAgKlxuICAgKiBXb3JrYXJvdW5kIHVudGlsIGh0dHBzOi8vZ2l0aHViLmNvbS9zYXNzL3Nhc3MvaXNzdWVzLzMyNDcgaXMgYWRkcmVzc2VkLlxuICAgKi9cbiAgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXM/OiBTZXQ8c3RyaW5nPjtcbn1cblxuLyoqXG4gKiBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgY29udGV4dHVhbCBpbmZvcm1hdGlvbiBmb3IgYSBzcGVjaWZpYyByZW5kZXIgcmVxdWVzdC5cbiAqL1xuaW50ZXJmYWNlIFJlbmRlclJlcXVlc3Qge1xuICBpZDogbnVtYmVyO1xuICB3b3JrZXJJbmRleDogbnVtYmVyO1xuICBjYWxsYmFjazogUmVuZGVyQ2FsbGJhY2s7XG4gIGltcG9ydGVycz86IEltcG9ydGVyc1tdO1xuICBwcmV2aW91c1Jlc29sdmVkTW9kdWxlcz86IFNldDxzdHJpbmc+O1xufVxuXG4vKipcbiAqIEFsbCBhdmFpbGFibGUgaW1wb3J0ZXIgdHlwZXMuXG4gKi9cbnR5cGUgSW1wb3J0ZXJzID1cbiAgfCBJbXBvcnRlcjwnc3luYyc+XG4gIHwgSW1wb3J0ZXI8J2FzeW5jJz5cbiAgfCBGaWxlSW1wb3J0ZXI8J3N5bmMnPlxuICB8IEZpbGVJbXBvcnRlcjwnYXN5bmMnPjtcblxuLyoqXG4gKiBBIHJlc3BvbnNlIGZyb20gdGhlIFNhc3MgcmVuZGVyIFdvcmtlciBjb250YWluaW5nIHRoZSByZXN1bHQgb2YgdGhlIG9wZXJhdGlvbi5cbiAqL1xuaW50ZXJmYWNlIFJlbmRlclJlc3BvbnNlTWVzc2FnZSB7XG4gIGlkOiBudW1iZXI7XG4gIGVycm9yPzogRXhjZXB0aW9uO1xuICByZXN1bHQ/OiBPbWl0PENvbXBpbGVSZXN1bHQsICdsb2FkZWRVcmxzJz4gJiB7IGxvYWRlZFVybHM6IHN0cmluZ1tdIH07XG59XG5cbi8qKlxuICogQSBTYXNzIHJlbmRlcmVyIGltcGxlbWVudGF0aW9uIHRoYXQgcHJvdmlkZXMgYW4gaW50ZXJmYWNlIHRoYXQgY2FuIGJlIHVzZWQgYnkgV2VicGFjaydzXG4gKiBgc2Fzcy1sb2FkZXJgLiBUaGUgaW1wbGVtZW50YXRpb24gdXNlcyBhIFdvcmtlciB0aHJlYWQgdG8gcGVyZm9ybSB0aGUgU2FzcyByZW5kZXJpbmdcbiAqIHdpdGggdGhlIGBkYXJ0LXNhc3NgIHBhY2thZ2UuICBUaGUgYGRhcnQtc2Fzc2Agc3luY2hyb25vdXMgcmVuZGVyIGZ1bmN0aW9uIGlzIHVzZWQgd2l0aGluXG4gKiB0aGUgd29ya2VyIHdoaWNoIGNhbiBiZSB1cCB0byB0d28gdGltZXMgZmFzdGVyIHRoYW4gdGhlIGFzeW5jaHJvbm91cyB2YXJpYW50LlxuICovXG5leHBvcnQgY2xhc3MgU2Fzc1dvcmtlckltcGxlbWVudGF0aW9uIHtcbiAgcHJpdmF0ZSByZWFkb25seSB3b3JrZXJzOiBXb3JrZXJbXSA9IFtdO1xuICBwcml2YXRlIHJlYWRvbmx5IGF2YWlsYWJsZVdvcmtlcnM6IG51bWJlcltdID0gW107XG4gIHByaXZhdGUgcmVhZG9ubHkgcmVxdWVzdHMgPSBuZXcgTWFwPG51bWJlciwgUmVuZGVyUmVxdWVzdD4oKTtcbiAgcHJpdmF0ZSByZWFkb25seSB3b3JrZXJQYXRoID0gam9pbihfX2Rpcm5hbWUsICcuL3dvcmtlci5qcycpO1xuICBwcml2YXRlIGlkQ291bnRlciA9IDE7XG4gIHByaXZhdGUgbmV4dFdvcmtlckluZGV4ID0gMDtcblxuICAvKipcbiAgICogUHJvdmlkZXMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIFNhc3MgaW1wbGVtZW50YXRpb24uXG4gICAqIFRoaXMgbWltaWNzIGVub3VnaCBvZiB0aGUgYGRhcnQtc2Fzc2AgdmFsdWUgdG8gYmUgdXNlZCB3aXRoIHRoZSBgc2Fzcy1sb2FkZXJgLlxuICAgKi9cbiAgZ2V0IGluZm8oKTogc3RyaW5nIHtcbiAgICByZXR1cm4gJ2RhcnQtc2Fzc1xcdHdvcmtlcic7XG4gIH1cblxuICAvKipcbiAgICogVGhlIHN5bmNocm9ub3VzIHJlbmRlciBmdW5jdGlvbiBpcyBub3QgdXNlZCBieSB0aGUgYHNhc3MtbG9hZGVyYC5cbiAgICovXG4gIGNvbXBpbGVTdHJpbmcoKTogbmV2ZXIge1xuICAgIHRocm93IG5ldyBFcnJvcignU2FzcyBjb21waWxlU3RyaW5nIGlzIG5vdCBzdXBwb3J0ZWQuJyk7XG4gIH1cblxuICAvKipcbiAgICogQXN5bmNocm9ub3VzbHkgcmVxdWVzdCBhIFNhc3Mgc3R5bGVzaGVldCB0byBiZSByZW5kZXJlcmVkLlxuICAgKlxuICAgKiBAcGFyYW0gc291cmNlIFRoZSBjb250ZW50cyB0byBjb21waWxlLlxuICAgKiBAcGFyYW0gb3B0aW9ucyBUaGUgYGRhcnQtc2Fzc2Agb3B0aW9ucyB0byB1c2Ugd2hlbiByZW5kZXJpbmcgdGhlIHN0eWxlc2hlZXQuXG4gICAqL1xuICBjb21waWxlU3RyaW5nQXN5bmMoXG4gICAgc291cmNlOiBzdHJpbmcsXG4gICAgb3B0aW9uczogU3RyaW5nT3B0aW9uc1dpdGhJbXBvcnRlcjwnYXN5bmMnPiB8IFN0cmluZ09wdGlvbnNXaXRob3V0SW1wb3J0ZXI8J2FzeW5jJz4sXG4gICk6IFByb21pc2U8Q29tcGlsZVJlc3VsdD4ge1xuICAgIC8vIFRoZSBgZnVuY3Rpb25zYCwgYGxvZ2dlcmAgYW5kIGBpbXBvcnRlcmAgb3B0aW9ucyBhcmUgSmF2YVNjcmlwdCBmdW5jdGlvbnMgdGhhdCBjYW5ub3QgYmUgdHJhbnNmZXJyZWQuXG4gICAgLy8gSWYgYW55IGFkZGl0aW9uYWwgZnVuY3Rpb24gb3B0aW9ucyBhcmUgYWRkZWQgaW4gdGhlIGZ1dHVyZSwgdGhleSBtdXN0IGJlIGV4Y2x1ZGVkIGFzIHdlbGwuXG4gICAgY29uc3QgeyBmdW5jdGlvbnMsIGltcG9ydGVycywgdXJsLCBsb2dnZXIsIC4uLnNlcmlhbGl6YWJsZU9wdGlvbnMgfSA9IG9wdGlvbnM7XG5cbiAgICAvLyBUaGUgQ0xJJ3MgY29uZmlndXJhdGlvbiBkb2VzIG5vdCB1c2Ugb3IgZXhwb3NlIHRoZSBhYmlsaXR5IHRvIGRlZmluZWQgY3VzdG9tIFNhc3MgZnVuY3Rpb25zXG4gICAgaWYgKGZ1bmN0aW9ucyAmJiBPYmplY3Qua2V5cyhmdW5jdGlvbnMpLmxlbmd0aCA+IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignU2FzcyBjdXN0b20gZnVuY3Rpb25zIGFyZSBub3Qgc3VwcG9ydGVkLicpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgUHJvbWlzZTxDb21waWxlUmVzdWx0PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgd29ya2VySW5kZXggPSB0aGlzLmF2YWlsYWJsZVdvcmtlcnMucG9wKCk7XG4gICAgICBpZiAod29ya2VySW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodGhpcy53b3JrZXJzLmxlbmd0aCA8IE1BWF9SRU5ERVJfV09SS0VSUykge1xuICAgICAgICAgIHdvcmtlckluZGV4ID0gdGhpcy53b3JrZXJzLmxlbmd0aDtcbiAgICAgICAgICB0aGlzLndvcmtlcnMucHVzaCh0aGlzLmNyZWF0ZVdvcmtlcigpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB3b3JrZXJJbmRleCA9IHRoaXMubmV4dFdvcmtlckluZGV4Kys7XG4gICAgICAgICAgaWYgKHRoaXMubmV4dFdvcmtlckluZGV4ID49IHRoaXMud29ya2Vycy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMubmV4dFdvcmtlckluZGV4ID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgY2FsbGJhY2s6IFJlbmRlckNhbGxiYWNrID0gKGVycm9yLCByZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgY29uc3QgdXJsID0gZXJyb3I/LnNwYW4udXJsIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgICBpZiAodXJsKSB7XG4gICAgICAgICAgICBlcnJvci5zcGFuLnVybCA9IHBhdGhUb0ZpbGVVUkwodXJsKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZWplY3QoZXJyb3IpO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdObyByZXN1bHQuJykpO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgfTtcblxuICAgICAgY29uc3QgcmVxdWVzdCA9IHRoaXMuY3JlYXRlUmVxdWVzdCh3b3JrZXJJbmRleCwgY2FsbGJhY2ssIGltcG9ydGVycyk7XG4gICAgICB0aGlzLnJlcXVlc3RzLnNldChyZXF1ZXN0LmlkLCByZXF1ZXN0KTtcblxuICAgICAgdGhpcy53b3JrZXJzW3dvcmtlckluZGV4XS5wb3N0TWVzc2FnZSh7XG4gICAgICAgIGlkOiByZXF1ZXN0LmlkLFxuICAgICAgICBzb3VyY2UsXG4gICAgICAgIGhhc0ltcG9ydGVyOiAhIWltcG9ydGVycz8ubGVuZ3RoLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgLi4uc2VyaWFsaXphYmxlT3B0aW9ucyxcbiAgICAgICAgICAvLyBVUkwgaXMgbm90IHNlcmlhbGl6YWJsZSBzbyB0byBjb252ZXJ0IHRvIHN0cmluZyBoZXJlIGFuZCBiYWNrIHRvIFVSTCBpbiB0aGUgd29ya2VyLlxuICAgICAgICAgIHVybDogdXJsID8gZmlsZVVSTFRvUGF0aCh1cmwpIDogdW5kZWZpbmVkLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU2h1dGRvd24gdGhlIFNhc3MgcmVuZGVyIHdvcmtlci5cbiAgICogRXhlY3V0aW5nIHRoaXMgbWV0aG9kIHdpbGwgc3RvcCBhbnkgcGVuZGluZyByZW5kZXIgcmVxdWVzdHMuXG4gICAqL1xuICBjbG9zZSgpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IHdvcmtlciBvZiB0aGlzLndvcmtlcnMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZvaWQgd29ya2VyLnRlcm1pbmF0ZSgpO1xuICAgICAgfSBjYXRjaCB7fVxuICAgIH1cbiAgICB0aGlzLnJlcXVlc3RzLmNsZWFyKCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVdvcmtlcigpOiBXb3JrZXIge1xuICAgIGNvbnN0IHsgcG9ydDE6IG1haW5JbXBvcnRlclBvcnQsIHBvcnQyOiB3b3JrZXJJbXBvcnRlclBvcnQgfSA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpO1xuICAgIGNvbnN0IGltcG9ydGVyU2lnbmFsID0gbmV3IEludDMyQXJyYXkobmV3IFNoYXJlZEFycmF5QnVmZmVyKDQpKTtcblxuICAgIGNvbnN0IHdvcmtlciA9IG5ldyBXb3JrZXIodGhpcy53b3JrZXJQYXRoLCB7XG4gICAgICB3b3JrZXJEYXRhOiB7IHdvcmtlckltcG9ydGVyUG9ydCwgaW1wb3J0ZXJTaWduYWwgfSxcbiAgICAgIHRyYW5zZmVyTGlzdDogW3dvcmtlckltcG9ydGVyUG9ydF0sXG4gICAgfSk7XG5cbiAgICB3b3JrZXIub24oJ21lc3NhZ2UnLCAocmVzcG9uc2U6IFJlbmRlclJlc3BvbnNlTWVzc2FnZSkgPT4ge1xuICAgICAgY29uc3QgcmVxdWVzdCA9IHRoaXMucmVxdWVzdHMuZ2V0KHJlc3BvbnNlLmlkKTtcbiAgICAgIGlmICghcmVxdWVzdCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHRoaXMucmVxdWVzdHMuZGVsZXRlKHJlc3BvbnNlLmlkKTtcbiAgICAgIHRoaXMuYXZhaWxhYmxlV29ya2Vycy5wdXNoKHJlcXVlc3Qud29ya2VySW5kZXgpO1xuXG4gICAgICBpZiAocmVzcG9uc2UucmVzdWx0KSB7XG4gICAgICAgIHJlcXVlc3QuY2FsbGJhY2sodW5kZWZpbmVkLCB7XG4gICAgICAgICAgLi4ucmVzcG9uc2UucmVzdWx0LFxuICAgICAgICAgIC8vIFVSTCBpcyBub3Qgc2VyaWFsaXphYmxlIHNvIGluIHRoZSB3b3JrZXIgd2UgY29udmVydCB0byBzdHJpbmcgYW5kIGhlcmUgYmFjayB0byBVUkwuXG4gICAgICAgICAgbG9hZGVkVXJsczogcmVzcG9uc2UucmVzdWx0LmxvYWRlZFVybHMubWFwKChwKSA9PiBwYXRoVG9GaWxlVVJMKHApKSxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXF1ZXN0LmNhbGxiYWNrKHJlc3BvbnNlLmVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIG1haW5JbXBvcnRlclBvcnQub24oXG4gICAgICAnbWVzc2FnZScsXG4gICAgICAoeyBpZCwgdXJsLCBvcHRpb25zIH06IHsgaWQ6IG51bWJlcjsgdXJsOiBzdHJpbmc7IG9wdGlvbnM6IEZpbGVJbXBvcnRlck9wdGlvbnMgfSkgPT4ge1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gdGhpcy5yZXF1ZXN0cy5nZXQoaWQpO1xuICAgICAgICBpZiAoIXJlcXVlc3Q/LmltcG9ydGVycykge1xuICAgICAgICAgIG1haW5JbXBvcnRlclBvcnQucG9zdE1lc3NhZ2UobnVsbCk7XG4gICAgICAgICAgQXRvbWljcy5zdG9yZShpbXBvcnRlclNpZ25hbCwgMCwgMSk7XG4gICAgICAgICAgQXRvbWljcy5ub3RpZnkoaW1wb3J0ZXJTaWduYWwsIDApO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wcm9jZXNzSW1wb3J0ZXJzKHJlcXVlc3QuaW1wb3J0ZXJzLCB1cmwsIHtcbiAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzOiByZXF1ZXN0LnByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzLFxuICAgICAgICB9KVxuICAgICAgICAgIC50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgcmVxdWVzdC5wcmV2aW91c1Jlc29sdmVkTW9kdWxlcyA/Pz0gbmV3IFNldCgpO1xuICAgICAgICAgICAgICByZXF1ZXN0LnByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzLmFkZChkaXJuYW1lKHJlc3VsdCkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBtYWluSW1wb3J0ZXJQb3J0LnBvc3RNZXNzYWdlKHJlc3VsdCk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICBtYWluSW1wb3J0ZXJQb3J0LnBvc3RNZXNzYWdlKGVycm9yKTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgICAgIEF0b21pY3Muc3RvcmUoaW1wb3J0ZXJTaWduYWwsIDAsIDEpO1xuICAgICAgICAgICAgQXRvbWljcy5ub3RpZnkoaW1wb3J0ZXJTaWduYWwsIDApO1xuICAgICAgICAgIH0pO1xuICAgICAgfSxcbiAgICApO1xuXG4gICAgbWFpbkltcG9ydGVyUG9ydC51bnJlZigpO1xuXG4gICAgcmV0dXJuIHdvcmtlcjtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcHJvY2Vzc0ltcG9ydGVycyhcbiAgICBpbXBvcnRlcnM6IEl0ZXJhYmxlPEltcG9ydGVycz4sXG4gICAgdXJsOiBzdHJpbmcsXG4gICAgb3B0aW9uczogRmlsZUltcG9ydGVyV2l0aFJlcXVlc3RDb250ZXh0T3B0aW9ucyxcbiAgKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgZm9yIChjb25zdCBpbXBvcnRlciBvZiBpbXBvcnRlcnMpIHtcbiAgICAgIGlmICh0aGlzLmlzSW1wb3J0ZXIoaW1wb3J0ZXIpKSB7XG4gICAgICAgIC8vIEltcG9ydGVyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignT25seSBGaWxlIEltcG9ydGVycyBhcmUgc3VwcG9ydGVkLicpO1xuICAgICAgfVxuXG4gICAgICAvLyBGaWxlIGltcG9ydGVyIChDYW4gYmUgc3luYyBvciBheW5jKS5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGltcG9ydGVyLmZpbmRGaWxlVXJsKHVybCwgb3B0aW9ucyk7XG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIHJldHVybiBmaWxlVVJMVG9QYXRoKHJlc3VsdCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVJlcXVlc3QoXG4gICAgd29ya2VySW5kZXg6IG51bWJlcixcbiAgICBjYWxsYmFjazogUmVuZGVyQ2FsbGJhY2ssXG4gICAgaW1wb3J0ZXJzOiBJbXBvcnRlcnNbXSB8IHVuZGVmaW5lZCxcbiAgKTogUmVuZGVyUmVxdWVzdCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiB0aGlzLmlkQ291bnRlcisrLFxuICAgICAgd29ya2VySW5kZXgsXG4gICAgICBjYWxsYmFjayxcbiAgICAgIGltcG9ydGVycyxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBpc0ltcG9ydGVyKHZhbHVlOiBJbXBvcnRlcnMpOiB2YWx1ZSBpcyBJbXBvcnRlciB7XG4gICAgcmV0dXJuICdjYW5vbmljYWxpemUnIGluIHZhbHVlICYmICdsb2FkJyBpbiB2YWx1ZTtcbiAgfVxufVxuIl19