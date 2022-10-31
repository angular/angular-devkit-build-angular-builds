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
            const request = this.createRequest(workerIndex, callback, logger, importers);
            this.requests.set(request.id, request);
            this.workers[workerIndex].postMessage({
                id: request.id,
                source,
                hasImporter: !!(importers === null || importers === void 0 ? void 0 : importers.length),
                hasLogger: !!logger,
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
            var _a;
            const request = this.requests.get(response.id);
            if (!request) {
                return;
            }
            this.requests.delete(response.id);
            this.availableWorkers.push(request.workerIndex);
            if (response.warnings && ((_a = request.logger) === null || _a === void 0 ? void 0 : _a.warn)) {
                for (const { message, span, ...options } of response.warnings) {
                    request.logger.warn(message, {
                        ...options,
                        span: span && {
                            ...span,
                            url: span.url ? (0, node_url_1.pathToFileURL)(span.url) : undefined,
                        },
                    });
                }
            }
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
    createRequest(workerIndex, callback, logger, importers) {
        return {
            id: this.idCounter++,
            workerIndex,
            callback,
            logger,
            importers,
        };
    }
    isImporter(value) {
        return 'canonicalize' in value && 'load' in value;
    }
}
exports.SassWorkerImplementation = SassWorkerImplementation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Fzcy1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvc2Fzcy9zYXNzLXNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgseUNBQTBDO0FBQzFDLHVDQUF3RDtBQUN4RCw2REFBNkQ7QUFXN0Qsc0VBQTBEO0FBRTFEOztHQUVHO0FBQ0gsTUFBTSxrQkFBa0IsR0FBRyxnQ0FBVSxDQUFDO0FBdUR0Qzs7Ozs7R0FLRztBQUNILE1BQWEsd0JBQXdCO0lBQXJDO1FBQ21CLFlBQU8sR0FBYSxFQUFFLENBQUM7UUFDdkIscUJBQWdCLEdBQWEsRUFBRSxDQUFDO1FBQ2hDLGFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBeUIsQ0FBQztRQUM1QyxlQUFVLEdBQUcsSUFBQSxnQkFBSSxFQUFDLFNBQVMsRUFBRSxhQUFhLENBQUMsQ0FBQztRQUNyRCxjQUFTLEdBQUcsQ0FBQyxDQUFDO1FBQ2Qsb0JBQWUsR0FBRyxDQUFDLENBQUM7SUE0TjlCLENBQUM7SUExTkM7OztPQUdHO0lBQ0gsSUFBSSxJQUFJO1FBQ04sT0FBTyxtQkFBbUIsQ0FBQztJQUM3QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxhQUFhO1FBQ1gsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILGtCQUFrQixDQUNoQixNQUFjLEVBQ2QsT0FBbUY7UUFFbkYsd0dBQXdHO1FBQ3hHLDZGQUE2RjtRQUM3RixNQUFNLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLEdBQUcsbUJBQW1CLEVBQUUsR0FBRyxPQUFPLENBQUM7UUFFOUUsOEZBQThGO1FBQzlGLElBQUksU0FBUyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxD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VixPQUFPLElBQUEsd0JBQWEsRUFBQyxNQUFNLENBQUMsQ0FBQzthQUM5QjtTQUNGO1FBRUQsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRU8sYUFBYSxDQUNuQixXQUFtQixFQUNuQixRQUF3QixFQUN4QixNQUEwQixFQUMxQixTQUFrQztRQUVsQyxPQUFPO1lBQ0wsRUFBRSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUU7WUFDcEIsV0FBVztZQUNYLFFBQVE7WUFDUixNQUFNO1lBQ04sU0FBUztTQUNWLENBQUM7SUFDSixDQUFDO0lBRU8sVUFBVSxDQUFDLEtBQWdCO1FBQ2pDLE9BQU8sY0FBYyxJQUFJLEtBQUssSUFBSSxNQUFNLElBQUksS0FBSyxDQUFDO0lBQ3BELENBQUM7Q0FDRjtBQWxPRCw0REFrT0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgZGlybmFtZSwgam9pbiB9IGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBwYXRoVG9GaWxlVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IHsgTWVzc2FnZUNoYW5uZWwsIFdvcmtlciB9IGZyb20gJ25vZGU6d29ya2VyX3RocmVhZHMnO1xuaW1wb3J0IHtcbiAgQ29tcGlsZVJlc3VsdCxcbiAgRXhjZXB0aW9uLFxuICBGaWxlSW1wb3J0ZXIsXG4gIEltcG9ydGVyLFxuICBMb2dnZXIsXG4gIFNvdXJjZVNwYW4sXG4gIFN0cmluZ09wdGlvbnNXaXRoSW1wb3J0ZXIsXG4gIFN0cmluZ09wdGlvbnNXaXRob3V0SW1wb3J0ZXIsXG59IGZyb20gJ3Nhc3MnO1xuaW1wb3J0IHsgbWF4V29ya2VycyB9IGZyb20gJy4uL3V0aWxzL2Vudmlyb25tZW50LW9wdGlvbnMnO1xuXG4vKipcbiAqIFRoZSBtYXhpbXVtIG51bWJlciBvZiBXb3JrZXJzIHRoYXQgd2lsbCBiZSBjcmVhdGVkIHRvIGV4ZWN1dGUgcmVuZGVyIHJlcXVlc3RzLlxuICovXG5jb25zdCBNQVhfUkVOREVSX1dPUktFUlMgPSBtYXhXb3JrZXJzO1xuXG4vKipcbiAqIFRoZSBjYWxsYmFjayB0eXBlIGZvciB0aGUgYGRhcnQtc2Fzc2AgYXN5bmNocm9ub3VzIHJlbmRlciBmdW5jdGlvbi5cbiAqL1xudHlwZSBSZW5kZXJDYWxsYmFjayA9IChlcnJvcj86IEV4Y2VwdGlvbiwgcmVzdWx0PzogQ29tcGlsZVJlc3VsdCkgPT4gdm9pZDtcblxudHlwZSBGaWxlSW1wb3J0ZXJPcHRpb25zID0gUGFyYW1ldGVyczxGaWxlSW1wb3J0ZXJbJ2ZpbmRGaWxlVXJsJ10+WzFdO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZpbGVJbXBvcnRlcldpdGhSZXF1ZXN0Q29udGV4dE9wdGlvbnMgZXh0ZW5kcyBGaWxlSW1wb3J0ZXJPcHRpb25zIHtcbiAgLyoqXG4gICAqIFRoaXMgaXMgYSBjdXN0b20gb3B0aW9uIGFuZCBpcyByZXF1aXJlZCBhcyBTQVNTIGRvZXMgbm90IHByb3ZpZGUgY29udGV4dCBmcm9tIHdoaWNoIHRoZSBmaWxlIGlzIGJlaW5nIHJlc29sdmVkLlxuICAgKiBUaGlzIGJyZWFrcyBZYXJuIFBOUCBhcyB0cmFuc2l0aXZlIGRlcHMgY2Fubm90IGJlIHJlc29sdmVkIGZyb20gdGhlIHdvcmtzcGFjZSByb290LlxuICAgKlxuICAgKiBXb3JrYXJvdW5kIHVudGlsIGh0dHBzOi8vZ2l0aHViLmNvbS9zYXNzL3Nhc3MvaXNzdWVzLzMyNDcgaXMgYWRkcmVzc2VkLlxuICAgKi9cbiAgcHJldmlvdXNSZXNvbHZlZE1vZHVsZXM/OiBTZXQ8c3RyaW5nPjtcbn1cblxuLyoqXG4gKiBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgY29udGV4dHVhbCBpbmZvcm1hdGlvbiBmb3IgYSBzcGVjaWZpYyByZW5kZXIgcmVxdWVzdC5cbiAqL1xuaW50ZXJmYWNlIFJlbmRlclJlcXVlc3Qge1xuICBpZDogbnVtYmVyO1xuICB3b3JrZXJJbmRleDogbnVtYmVyO1xuICBjYWxsYmFjazogUmVuZGVyQ2FsbGJhY2s7XG4gIGxvZ2dlcj86IExvZ2dlcjtcbiAgaW1wb3J0ZXJzPzogSW1wb3J0ZXJzW107XG4gIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzPzogU2V0PHN0cmluZz47XG59XG5cbi8qKlxuICogQWxsIGF2YWlsYWJsZSBpbXBvcnRlciB0eXBlcy5cbiAqL1xudHlwZSBJbXBvcnRlcnMgPVxuICB8IEltcG9ydGVyPCdzeW5jJz5cbiAgfCBJbXBvcnRlcjwnYXN5bmMnPlxuICB8IEZpbGVJbXBvcnRlcjwnc3luYyc+XG4gIHwgRmlsZUltcG9ydGVyPCdhc3luYyc+O1xuXG4vKipcbiAqIEEgcmVzcG9uc2UgZnJvbSB0aGUgU2FzcyByZW5kZXIgV29ya2VyIGNvbnRhaW5pbmcgdGhlIHJlc3VsdCBvZiB0aGUgb3BlcmF0aW9uLlxuICovXG5pbnRlcmZhY2UgUmVuZGVyUmVzcG9uc2VNZXNzYWdlIHtcbiAgaWQ6IG51bWJlcjtcbiAgZXJyb3I/OiBFeGNlcHRpb247XG4gIHJlc3VsdD86IE9taXQ8Q29tcGlsZVJlc3VsdCwgJ2xvYWRlZFVybHMnPiAmIHsgbG9hZGVkVXJsczogc3RyaW5nW10gfTtcbiAgd2FybmluZ3M/OiB7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xuICAgIGRlcHJlY2F0aW9uOiBib29sZWFuO1xuICAgIHN0YWNrPzogc3RyaW5nO1xuICAgIHNwYW4/OiBPbWl0PFNvdXJjZVNwYW4sICd1cmwnPiAmIHsgdXJsPzogc3RyaW5nIH07XG4gIH1bXTtcbn1cblxuLyoqXG4gKiBBIFNhc3MgcmVuZGVyZXIgaW1wbGVtZW50YXRpb24gdGhhdCBwcm92aWRlcyBhbiBpbnRlcmZhY2UgdGhhdCBjYW4gYmUgdXNlZCBieSBXZWJwYWNrJ3NcbiAqIGBzYXNzLWxvYWRlcmAuIFRoZSBpbXBsZW1lbnRhdGlvbiB1c2VzIGEgV29ya2VyIHRocmVhZCB0byBwZXJmb3JtIHRoZSBTYXNzIHJlbmRlcmluZ1xuICogd2l0aCB0aGUgYGRhcnQtc2Fzc2AgcGFja2FnZS4gIFRoZSBgZGFydC1zYXNzYCBzeW5jaHJvbm91cyByZW5kZXIgZnVuY3Rpb24gaXMgdXNlZCB3aXRoaW5cbiAqIHRoZSB3b3JrZXIgd2hpY2ggY2FuIGJlIHVwIHRvIHR3byB0aW1lcyBmYXN0ZXIgdGhhbiB0aGUgYXN5bmNocm9ub3VzIHZhcmlhbnQuXG4gKi9cbmV4cG9ydCBjbGFzcyBTYXNzV29ya2VySW1wbGVtZW50YXRpb24ge1xuICBwcml2YXRlIHJlYWRvbmx5IHdvcmtlcnM6IFdvcmtlcltdID0gW107XG4gIHByaXZhdGUgcmVhZG9ubHkgYXZhaWxhYmxlV29ya2VyczogbnVtYmVyW10gPSBbXTtcbiAgcHJpdmF0ZSByZWFkb25seSByZXF1ZXN0cyA9IG5ldyBNYXA8bnVtYmVyLCBSZW5kZXJSZXF1ZXN0PigpO1xuICBwcml2YXRlIHJlYWRvbmx5IHdvcmtlclBhdGggPSBqb2luKF9fZGlybmFtZSwgJy4vd29ya2VyLmpzJyk7XG4gIHByaXZhdGUgaWRDb3VudGVyID0gMTtcbiAgcHJpdmF0ZSBuZXh0V29ya2VySW5kZXggPSAwO1xuXG4gIC8qKlxuICAgKiBQcm92aWRlcyBpbmZvcm1hdGlvbiBhYm91dCB0aGUgU2FzcyBpbXBsZW1lbnRhdGlvbi5cbiAgICogVGhpcyBtaW1pY3MgZW5vdWdoIG9mIHRoZSBgZGFydC1zYXNzYCB2YWx1ZSB0byBiZSB1c2VkIHdpdGggdGhlIGBzYXNzLWxvYWRlcmAuXG4gICAqL1xuICBnZXQgaW5mbygpOiBzdHJpbmcge1xuICAgIHJldHVybiAnZGFydC1zYXNzXFx0d29ya2VyJztcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgc3luY2hyb25vdXMgcmVuZGVyIGZ1bmN0aW9uIGlzIG5vdCB1c2VkIGJ5IHRoZSBgc2Fzcy1sb2FkZXJgLlxuICAgKi9cbiAgY29tcGlsZVN0cmluZygpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdTYXNzIGNvbXBpbGVTdHJpbmcgaXMgbm90IHN1cHBvcnRlZC4nKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3luY2hyb25vdXNseSByZXF1ZXN0IGEgU2FzcyBzdHlsZXNoZWV0IHRvIGJlIHJlbmRlcmVyZWQuXG4gICAqXG4gICAqIEBwYXJhbSBzb3VyY2UgVGhlIGNvbnRlbnRzIHRvIGNvbXBpbGUuXG4gICAqIEBwYXJhbSBvcHRpb25zIFRoZSBgZGFydC1zYXNzYCBvcHRpb25zIHRvIHVzZSB3aGVuIHJlbmRlcmluZyB0aGUgc3R5bGVzaGVldC5cbiAgICovXG4gIGNvbXBpbGVTdHJpbmdBc3luYyhcbiAgICBzb3VyY2U6IHN0cmluZyxcbiAgICBvcHRpb25zOiBTdHJpbmdPcHRpb25zV2l0aEltcG9ydGVyPCdhc3luYyc+IHwgU3RyaW5nT3B0aW9uc1dpdGhvdXRJbXBvcnRlcjwnYXN5bmMnPixcbiAgKTogUHJvbWlzZTxDb21waWxlUmVzdWx0PiB7XG4gICAgLy8gVGhlIGBmdW5jdGlvbnNgLCBgbG9nZ2VyYCBhbmQgYGltcG9ydGVyYCBvcHRpb25zIGFyZSBKYXZhU2NyaXB0IGZ1bmN0aW9ucyB0aGF0IGNhbm5vdCBiZSB0cmFuc2ZlcnJlZC5cbiAgICAvLyBJZiBhbnkgYWRkaXRpb25hbCBmdW5jdGlvbiBvcHRpb25zIGFyZSBhZGRlZCBpbiB0aGUgZnV0dXJlLCB0aGV5IG11c3QgYmUgZXhjbHVkZWQgYXMgd2VsbC5cbiAgICBjb25zdCB7IGZ1bmN0aW9ucywgaW1wb3J0ZXJzLCB1cmwsIGxvZ2dlciwgLi4uc2VyaWFsaXphYmxlT3B0aW9ucyB9ID0gb3B0aW9ucztcblxuICAgIC8vIFRoZSBDTEkncyBjb25maWd1cmF0aW9uIGRvZXMgbm90IHVzZSBvciBleHBvc2UgdGhlIGFiaWxpdHkgdG8gZGVmaW5lZCBjdXN0b20gU2FzcyBmdW5jdGlvbnNcbiAgICBpZiAoZnVuY3Rpb25zICYmIE9iamVjdC5rZXlzKGZ1bmN0aW9ucykubGVuZ3RoID4gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdTYXNzIGN1c3RvbSBmdW5jdGlvbnMgYXJlIG5vdCBzdXBwb3J0ZWQuJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPENvbXBpbGVSZXN1bHQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCB3b3JrZXJJbmRleCA9IHRoaXMuYXZhaWxhYmxlV29ya2Vycy5wb3AoKTtcbiAgICAgIGlmICh3b3JrZXJJbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0aGlzLndvcmtlcnMubGVuZ3RoIDwgTUFYX1JFTkRFUl9XT1JLRVJTKSB7XG4gICAgICAgICAgd29ya2VySW5kZXggPSB0aGlzLndvcmtlcnMubGVuZ3RoO1xuICAgICAgICAgIHRoaXMud29ya2Vycy5wdXNoKHRoaXMuY3JlYXRlV29ya2VyKCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHdvcmtlckluZGV4ID0gdGhpcy5uZXh0V29ya2VySW5kZXgrKztcbiAgICAgICAgICBpZiAodGhpcy5uZXh0V29ya2VySW5kZXggPj0gdGhpcy53b3JrZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5uZXh0V29ya2VySW5kZXggPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBjYWxsYmFjazogUmVuZGVyQ2FsbGJhY2sgPSAoZXJyb3IsIHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zdCB1cmwgPSBlcnJvcj8uc3Bhbi51cmwgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICAgIGlmICh1cmwpIHtcbiAgICAgICAgICAgIGVycm9yLnNwYW4udXJsID0gcGF0aFRvRmlsZVVSTCh1cmwpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJlamVjdChlcnJvcik7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ05vIHJlc3VsdC4nKSk7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICB9O1xuXG4gICAgICBjb25zdCByZXF1ZXN0ID0gdGhpcy5jcmVhdGVSZXF1ZXN0KHdvcmtlckluZGV4LCBjYWxsYmFjaywgbG9nZ2VyLCBpbXBvcnRlcnMpO1xuICAgICAgdGhpcy5yZXF1ZXN0cy5zZXQocmVxdWVzdC5pZCwgcmVxdWVzdCk7XG5cbiAgICAgIHRoaXMud29ya2Vyc1t3b3JrZXJJbmRleF0ucG9zdE1lc3NhZ2Uoe1xuICAgICAgICBpZDogcmVxdWVzdC5pZCxcbiAgICAgICAgc291cmNlLFxuICAgICAgICBoYXNJbXBvcnRlcjogISFpbXBvcnRlcnM/Lmxlbmd0aCxcbiAgICAgICAgaGFzTG9nZ2VyOiAhIWxvZ2dlcixcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIC4uLnNlcmlhbGl6YWJsZU9wdGlvbnMsXG4gICAgICAgICAgLy8gVVJMIGlzIG5vdCBzZXJpYWxpemFibGUgc28gdG8gY29udmVydCB0byBzdHJpbmcgaGVyZSBhbmQgYmFjayB0byBVUkwgaW4gdGhlIHdvcmtlci5cbiAgICAgICAgICB1cmw6IHVybCA/IGZpbGVVUkxUb1BhdGgodXJsKSA6IHVuZGVmaW5lZCxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNodXRkb3duIHRoZSBTYXNzIHJlbmRlciB3b3JrZXIuXG4gICAqIEV4ZWN1dGluZyB0aGlzIG1ldGhvZCB3aWxsIHN0b3AgYW55IHBlbmRpbmcgcmVuZGVyIHJlcXVlc3RzLlxuICAgKi9cbiAgY2xvc2UoKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCB3b3JrZXIgb2YgdGhpcy53b3JrZXJzKSB7XG4gICAgICB0cnkge1xuICAgICAgICB2b2lkIHdvcmtlci50ZXJtaW5hdGUoKTtcbiAgICAgIH0gY2F0Y2gge31cbiAgICB9XG4gICAgdGhpcy5yZXF1ZXN0cy5jbGVhcigpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVXb3JrZXIoKTogV29ya2VyIHtcbiAgICBjb25zdCB7IHBvcnQxOiBtYWluSW1wb3J0ZXJQb3J0LCBwb3J0Mjogd29ya2VySW1wb3J0ZXJQb3J0IH0gPSBuZXcgTWVzc2FnZUNoYW5uZWwoKTtcbiAgICBjb25zdCBpbXBvcnRlclNpZ25hbCA9IG5ldyBJbnQzMkFycmF5KG5ldyBTaGFyZWRBcnJheUJ1ZmZlcig0KSk7XG5cbiAgICBjb25zdCB3b3JrZXIgPSBuZXcgV29ya2VyKHRoaXMud29ya2VyUGF0aCwge1xuICAgICAgd29ya2VyRGF0YTogeyB3b3JrZXJJbXBvcnRlclBvcnQsIGltcG9ydGVyU2lnbmFsIH0sXG4gICAgICB0cmFuc2Zlckxpc3Q6IFt3b3JrZXJJbXBvcnRlclBvcnRdLFxuICAgIH0pO1xuXG4gICAgd29ya2VyLm9uKCdtZXNzYWdlJywgKHJlc3BvbnNlOiBSZW5kZXJSZXNwb25zZU1lc3NhZ2UpID0+IHtcbiAgICAgIGNvbnN0IHJlcXVlc3QgPSB0aGlzLnJlcXVlc3RzLmdldChyZXNwb25zZS5pZCk7XG4gICAgICBpZiAoIXJlcXVlc3QpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnJlcXVlc3RzLmRlbGV0ZShyZXNwb25zZS5pZCk7XG4gICAgICB0aGlzLmF2YWlsYWJsZVdvcmtlcnMucHVzaChyZXF1ZXN0LndvcmtlckluZGV4KTtcblxuICAgICAgaWYgKHJlc3BvbnNlLndhcm5pbmdzICYmIHJlcXVlc3QubG9nZ2VyPy53YXJuKSB7XG4gICAgICAgIGZvciAoY29uc3QgeyBtZXNzYWdlLCBzcGFuLCAuLi5vcHRpb25zIH0gb2YgcmVzcG9uc2Uud2FybmluZ3MpIHtcbiAgICAgICAgICByZXF1ZXN0LmxvZ2dlci53YXJuKG1lc3NhZ2UsIHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICBzcGFuOiBzcGFuICYmIHtcbiAgICAgICAgICAgICAgLi4uc3BhbixcbiAgICAgICAgICAgICAgdXJsOiBzcGFuLnVybCA/IHBhdGhUb0ZpbGVVUkwoc3Bhbi51cmwpIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAocmVzcG9uc2UucmVzdWx0KSB7XG4gICAgICAgIHJlcXVlc3QuY2FsbGJhY2sodW5kZWZpbmVkLCB7XG4gICAgICAgICAgLi4ucmVzcG9uc2UucmVzdWx0LFxuICAgICAgICAgIC8vIFVSTCBpcyBub3Qgc2VyaWFsaXphYmxlIHNvIGluIHRoZSB3b3JrZXIgd2UgY29udmVydCB0byBzdHJpbmcgYW5kIGhlcmUgYmFjayB0byBVUkwuXG4gICAgICAgICAgbG9hZGVkVXJsczogcmVzcG9uc2UucmVzdWx0LmxvYWRlZFVybHMubWFwKChwKSA9PiBwYXRoVG9GaWxlVVJMKHApKSxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXF1ZXN0LmNhbGxiYWNrKHJlc3BvbnNlLmVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIG1haW5JbXBvcnRlclBvcnQub24oXG4gICAgICAnbWVzc2FnZScsXG4gICAgICAoeyBpZCwgdXJsLCBvcHRpb25zIH06IHsgaWQ6IG51bWJlcjsgdXJsOiBzdHJpbmc7IG9wdGlvbnM6IEZpbGVJbXBvcnRlck9wdGlvbnMgfSkgPT4ge1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gdGhpcy5yZXF1ZXN0cy5nZXQoaWQpO1xuICAgICAgICBpZiAoIXJlcXVlc3Q/LmltcG9ydGVycykge1xuICAgICAgICAgIG1haW5JbXBvcnRlclBvcnQucG9zdE1lc3NhZ2UobnVsbCk7XG4gICAgICAgICAgQXRvbWljcy5zdG9yZShpbXBvcnRlclNpZ25hbCwgMCwgMSk7XG4gICAgICAgICAgQXRvbWljcy5ub3RpZnkoaW1wb3J0ZXJTaWduYWwsIDApO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wcm9jZXNzSW1wb3J0ZXJzKHJlcXVlc3QuaW1wb3J0ZXJzLCB1cmwsIHtcbiAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgIHByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzOiByZXF1ZXN0LnByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzLFxuICAgICAgICB9KVxuICAgICAgICAgIC50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgcmVxdWVzdC5wcmV2aW91c1Jlc29sdmVkTW9kdWxlcyA/Pz0gbmV3IFNldCgpO1xuICAgICAgICAgICAgICByZXF1ZXN0LnByZXZpb3VzUmVzb2x2ZWRNb2R1bGVzLmFkZChkaXJuYW1lKHJlc3VsdCkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBtYWluSW1wb3J0ZXJQb3J0LnBvc3RNZXNzYWdlKHJlc3VsdCk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICBtYWluSW1wb3J0ZXJQb3J0LnBvc3RNZXNzYWdlKGVycm9yKTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgICAgIEF0b21pY3Muc3RvcmUoaW1wb3J0ZXJTaWduYWwsIDAsIDEpO1xuICAgICAgICAgICAgQXRvbWljcy5ub3RpZnkoaW1wb3J0ZXJTaWduYWwsIDApO1xuICAgICAgICAgIH0pO1xuICAgICAgfSxcbiAgICApO1xuXG4gICAgbWFpbkltcG9ydGVyUG9ydC51bnJlZigpO1xuXG4gICAgcmV0dXJuIHdvcmtlcjtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcHJvY2Vzc0ltcG9ydGVycyhcbiAgICBpbXBvcnRlcnM6IEl0ZXJhYmxlPEltcG9ydGVycz4sXG4gICAgdXJsOiBzdHJpbmcsXG4gICAgb3B0aW9uczogRmlsZUltcG9ydGVyV2l0aFJlcXVlc3RDb250ZXh0T3B0aW9ucyxcbiAgKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgZm9yIChjb25zdCBpbXBvcnRlciBvZiBpbXBvcnRlcnMpIHtcbiAgICAgIGlmICh0aGlzLmlzSW1wb3J0ZXIoaW1wb3J0ZXIpKSB7XG4gICAgICAgIC8vIEltcG9ydGVyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignT25seSBGaWxlIEltcG9ydGVycyBhcmUgc3VwcG9ydGVkLicpO1xuICAgICAgfVxuXG4gICAgICAvLyBGaWxlIGltcG9ydGVyIChDYW4gYmUgc3luYyBvciBheW5jKS5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGltcG9ydGVyLmZpbmRGaWxlVXJsKHVybCwgb3B0aW9ucyk7XG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIHJldHVybiBmaWxlVVJMVG9QYXRoKHJlc3VsdCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVJlcXVlc3QoXG4gICAgd29ya2VySW5kZXg6IG51bWJlcixcbiAgICBjYWxsYmFjazogUmVuZGVyQ2FsbGJhY2ssXG4gICAgbG9nZ2VyOiBMb2dnZXIgfCB1bmRlZmluZWQsXG4gICAgaW1wb3J0ZXJzOiBJbXBvcnRlcnNbXSB8IHVuZGVmaW5lZCxcbiAgKTogUmVuZGVyUmVxdWVzdCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiB0aGlzLmlkQ291bnRlcisrLFxuICAgICAgd29ya2VySW5kZXgsXG4gICAgICBjYWxsYmFjayxcbiAgICAgIGxvZ2dlcixcbiAgICAgIGltcG9ydGVycyxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBpc0ltcG9ydGVyKHZhbHVlOiBJbXBvcnRlcnMpOiB2YWx1ZSBpcyBJbXBvcnRlciB7XG4gICAgcmV0dXJuICdjYW5vbmljYWxpemUnIGluIHZhbHVlICYmICdsb2FkJyBpbiB2YWx1ZTtcbiAgfVxufVxuIl19