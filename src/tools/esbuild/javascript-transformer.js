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
exports.JavaScriptTransformer = void 0;
const piscina_1 = __importDefault(require("piscina"));
/**
 * A class that performs transformation of JavaScript files and raw data.
 * A worker pool is used to distribute the transformation actions and allow
 * parallel processing. Transformation behavior is based on the filename and
 * data. Transformations may include: async downleveling, Angular linking,
 * and advanced optimizations.
 */
class JavaScriptTransformer {
    maxThreads;
    #workerPool;
    #commonOptions;
    #pendingfileResults;
    constructor(options, maxThreads, reuseResults) {
        this.maxThreads = maxThreads;
        // Extract options to ensure only the named options are serialized and sent to the worker
        const { sourcemap, thirdPartySourcemaps = false, advancedOptimizations = false, jit = false, } = options;
        this.#commonOptions = {
            sourcemap,
            thirdPartySourcemaps,
            advancedOptimizations,
            jit,
        };
        // Currently only tracks pending file transform results
        if (reuseResults) {
            this.#pendingfileResults = new Map();
        }
    }
    #ensureWorkerPool() {
        this.#workerPool ??= new piscina_1.default({
            filename: require.resolve('./javascript-transformer-worker'),
            minThreads: 1,
            maxThreads: this.maxThreads,
            // Shutdown idle threads after 1 second of inactivity
            idleTimeout: 1000,
        });
        return this.#workerPool;
    }
    /**
     * Performs JavaScript transformations on a file from the filesystem.
     * If no transformations are required, the data for the original file will be returned.
     * @param filename The full path to the file.
     * @param skipLinker If true, bypass all Angular linker processing; if false, attempt linking.
     * @param sideEffects If false, and `advancedOptimizations` is enabled tslib decorators are wrapped.
     * @returns A promise that resolves to a UTF-8 encoded Uint8Array containing the result.
     */
    transformFile(filename, skipLinker, sideEffects) {
        const pendingKey = `${!!skipLinker}--${filename}`;
        let pending = this.#pendingfileResults?.get(pendingKey);
        if (pending === undefined) {
            // Always send the request to a worker. Files are almost always from node modules which means
            // they may need linking. The data is also not yet available to perform most transformation checks.
            pending = this.#ensureWorkerPool().run({
                filename,
                skipLinker,
                sideEffects,
                ...this.#commonOptions,
            });
            this.#pendingfileResults?.set(pendingKey, pending);
        }
        return pending;
    }
    /**
     * Performs JavaScript transformations on the provided data of a file. The file does not need
     * to exist on the filesystem.
     * @param filename The full path of the file represented by the data.
     * @param data The data of the file that should be transformed.
     * @param skipLinker If true, bypass all Angular linker processing; if false, attempt linking.
     * @param sideEffects If false, and `advancedOptimizations` is enabled tslib decorators are wrapped.
     * @returns A promise that resolves to a UTF-8 encoded Uint8Array containing the result.
     */
    async transformData(filename, data, skipLinker, sideEffects) {
        // Perform a quick test to determine if the data needs any transformations.
        // This allows directly returning the data without the worker communication overhead.
        if (skipLinker && !this.#commonOptions.advancedOptimizations) {
            const keepSourcemap = this.#commonOptions.sourcemap &&
                (!!this.#commonOptions.thirdPartySourcemaps || !/[\\/]node_modules[\\/]/.test(filename));
            return Buffer.from(keepSourcemap ? data : data.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, ''), 'utf-8');
        }
        return this.#ensureWorkerPool().run({
            filename,
            data,
            skipLinker,
            sideEffects,
            ...this.#commonOptions,
        });
    }
    /**
     * Stops all active transformation tasks and shuts down all workers.
     * @returns A void promise that resolves when closing is complete.
     */
    async close() {
        this.#pendingfileResults?.clear();
        if (this.#workerPool) {
            // Workaround piscina bug where a worker thread will be recreated after destroy to meet the minimum.
            this.#workerPool.options.minThreads = 0;
            try {
                await this.#workerPool.destroy();
            }
            finally {
                this.#workerPool = undefined;
            }
        }
    }
}
exports.JavaScriptTransformer = JavaScriptTransformer;
