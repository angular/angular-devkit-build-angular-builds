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
const worker_threads_1 = require("worker_threads");
if (!worker_threads_1.parentPort || !worker_threads_1.workerData) {
    throw new Error('Sass worker must be executed as a Worker.');
}
// The importer variables are used to proxy import requests to the main thread
const { workerImporterPort, importerSignal } = worker_threads_1.workerData;
worker_threads_1.parentPort.on('message', ({ id, hasImporter, options }) => {
    try {
        if (hasImporter) {
            // When a custom importer function is present, the importer request must be proxied
            // back to the main thread where it can be executed.
            // This process must be synchronous from the perspective of dart-sass. The `Atomics`
            // functions combined with the shared memory `importSignal` and the Node.js
            // `receiveMessageOnPort` function are used to ensure synchronous behavior.
            options.importer = function (url, prev) {
                Atomics.store(importerSignal, 0, 0);
                const { fromImport } = this;
                workerImporterPort.postMessage({ id, url, prev, fromImport });
                Atomics.wait(importerSignal, 0, 0);
                return (0, worker_threads_1.receiveMessageOnPort)(workerImporterPort)?.message;
            };
        }
        // The synchronous Sass render function can be up to two times faster than the async variant
        const result = (0, sass_1.renderSync)(options);
        worker_threads_1.parentPort?.postMessage({ id, result });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }
    catch (error) {
        // Needed because V8 will only serialize the message and stack properties of an Error instance.
        const { formatted, file, line, column, message, stack } = error;
        worker_threads_1.parentPort?.postMessage({ id, error: { formatted, file, line, column, message, stack } });
    }
});
