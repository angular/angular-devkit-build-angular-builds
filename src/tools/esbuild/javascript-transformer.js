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
    #workerPool;
    #commonOptions;
    constructor(options, maxThreads) {
        this.#workerPool = new piscina_1.default({
            filename: require.resolve('./javascript-transformer-worker'),
            minThreads: 1,
            maxThreads,
            // Shutdown idle threads after 1 second of inactivity
            idleTimeout: 1000,
        });
        // Extract options to ensure only the named options are serialized and sent to the worker
        const { sourcemap, thirdPartySourcemaps = false, advancedOptimizations = false, jit = false, } = options;
        this.#commonOptions = {
            sourcemap,
            thirdPartySourcemaps,
            advancedOptimizations,
            jit,
        };
    }
    /**
     * Performs JavaScript transformations on a file from the filesystem.
     * If no transformations are required, the data for the original file will be returned.
     * @param filename The full path to the file.
     * @param skipLinker If true, bypass all Angular linker processing; if false, attempt linking.
     * @returns A promise that resolves to a UTF-8 encoded Uint8Array containing the result.
     */
    transformFile(filename, skipLinker) {
        // Always send the request to a worker. Files are almost always from node modules which means
        // they may need linking. The data is also not yet available to perform most transformation checks.
        return this.#workerPool.run({
            filename,
            skipLinker,
            ...this.#commonOptions,
        });
    }
    /**
     * Performs JavaScript transformations on the provided data of a file. The file does not need
     * to exist on the filesystem.
     * @param filename The full path of the file represented by the data.
     * @param data The data of the file that should be transformed.
     * @param skipLinker If true, bypass all Angular linker processing; if false, attempt linking.
     * @returns A promise that resolves to a UTF-8 encoded Uint8Array containing the result.
     */
    async transformData(filename, data, skipLinker) {
        // Perform a quick test to determine if the data needs any transformations.
        // This allows directly returning the data without the worker communication overhead.
        if (skipLinker && !this.#commonOptions.advancedOptimizations) {
            const keepSourcemap = this.#commonOptions.sourcemap &&
                (!!this.#commonOptions.thirdPartySourcemaps || !/[\\/]node_modules[\\/]/.test(filename));
            return Buffer.from(keepSourcemap ? data : data.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, ''), 'utf-8');
        }
        return this.#workerPool.run({
            filename,
            data,
            skipLinker,
            ...this.#commonOptions,
        });
    }
    /**
     * Stops all active transformation tasks and shuts down all workers.
     * @returns A void promise that resolves when closing is complete.
     */
    close() {
        // Workaround piscina bug where a worker thread will be recreated after destroy to meet the minimum.
        this.#workerPool.options.minThreads = 0;
        return this.#workerPool.destroy();
    }
}
exports.JavaScriptTransformer = JavaScriptTransformer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC10cmFuc2Zvcm1lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvamF2YXNjcmlwdC10cmFuc2Zvcm1lci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFFSCxzREFBOEI7QUFZOUI7Ozs7OztHQU1HO0FBQ0gsTUFBYSxxQkFBcUI7SUFDaEMsV0FBVyxDQUFVO0lBQ3JCLGNBQWMsQ0FBeUM7SUFFdkQsWUFBWSxPQUFxQyxFQUFFLFVBQWtCO1FBQ25FLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxpQkFBTyxDQUFDO1lBQzdCLFFBQVEsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLGlDQUFpQyxDQUFDO1lBQzVELFVBQVUsRUFBRSxDQUFDO1lBQ2IsVUFBVTtZQUNWLHFEQUFxRDtZQUNyRCxXQUFXLEVBQUUsSUFBSTtTQUNsQixDQUFDLENBQUM7UUFFSCx5RkFBeUY7UUFDekYsTUFBTSxFQUNKLFNBQVMsRUFDVCxvQkFBb0IsR0FBRyxLQUFLLEVBQzVCLHFCQUFxQixHQUFHLEtBQUssRUFDN0IsR0FBRyxHQUFHLEtBQUssR0FDWixHQUFHLE9BQU8sQ0FBQztRQUNaLElBQUksQ0FBQyxjQUFjLEdBQUc7WUFDcEIsU0FBUztZQUNULG9CQUFvQjtZQUNwQixxQkFBcUI7WUFDckIsR0FBRztTQUNKLENBQUM7SUFDSixDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ0gsYUFBYSxDQUFDLFFBQWdCLEVBQUUsVUFBb0I7UUFDbEQsNkZBQTZGO1FBQzdGLG1HQUFtRztRQUNuRyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDO1lBQzFCLFFBQVE7WUFDUixVQUFVO1lBQ1YsR0FBRyxJQUFJLENBQUMsY0FBYztTQUN2QixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNILEtBQUssQ0FBQyxhQUFhLENBQUMsUUFBZ0IsRUFBRSxJQUFZLEVBQUUsVUFBbUI7UUFDckUsMkVBQTJFO1FBQzNFLHFGQUFxRjtRQUNyRixJQUFJLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMscUJBQXFCLEVBQUU7WUFDNUQsTUFBTSxhQUFhLEdBQ2pCLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUztnQkFDN0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxvQkFBb0IsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBRTNGLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FDaEIsYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsb0NBQW9DLEVBQUUsRUFBRSxDQUFDLEVBQzdFLE9BQU8sQ0FDUixDQUFDO1NBQ0g7UUFFRCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDO1lBQzFCLFFBQVE7WUFDUixJQUFJO1lBQ0osVUFBVTtZQUNWLEdBQUcsSUFBSSxDQUFDLGNBQWM7U0FDdkIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUs7UUFDSCxvR0FBb0c7UUFDcEcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQztRQUV4QyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDcEMsQ0FBQztDQUNGO0FBckZELHNEQXFGQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgUGlzY2luYSBmcm9tICdwaXNjaW5hJztcblxuLyoqXG4gKiBUcmFuc2Zvcm1hdGlvbiBvcHRpb25zIHRoYXQgc2hvdWxkIGFwcGx5IHRvIGFsbCB0cmFuc2Zvcm1lZCBmaWxlcyBhbmQgZGF0YS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBKYXZhU2NyaXB0VHJhbnNmb3JtZXJPcHRpb25zIHtcbiAgc291cmNlbWFwOiBib29sZWFuO1xuICB0aGlyZFBhcnR5U291cmNlbWFwcz86IGJvb2xlYW47XG4gIGFkdmFuY2VkT3B0aW1pemF0aW9ucz86IGJvb2xlYW47XG4gIGppdD86IGJvb2xlYW47XG59XG5cbi8qKlxuICogQSBjbGFzcyB0aGF0IHBlcmZvcm1zIHRyYW5zZm9ybWF0aW9uIG9mIEphdmFTY3JpcHQgZmlsZXMgYW5kIHJhdyBkYXRhLlxuICogQSB3b3JrZXIgcG9vbCBpcyB1c2VkIHRvIGRpc3RyaWJ1dGUgdGhlIHRyYW5zZm9ybWF0aW9uIGFjdGlvbnMgYW5kIGFsbG93XG4gKiBwYXJhbGxlbCBwcm9jZXNzaW5nLiBUcmFuc2Zvcm1hdGlvbiBiZWhhdmlvciBpcyBiYXNlZCBvbiB0aGUgZmlsZW5hbWUgYW5kXG4gKiBkYXRhLiBUcmFuc2Zvcm1hdGlvbnMgbWF5IGluY2x1ZGU6IGFzeW5jIGRvd25sZXZlbGluZywgQW5ndWxhciBsaW5raW5nLFxuICogYW5kIGFkdmFuY2VkIG9wdGltaXphdGlvbnMuXG4gKi9cbmV4cG9ydCBjbGFzcyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIge1xuICAjd29ya2VyUG9vbDogUGlzY2luYTtcbiAgI2NvbW1vbk9wdGlvbnM6IFJlcXVpcmVkPEphdmFTY3JpcHRUcmFuc2Zvcm1lck9wdGlvbnM+O1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IEphdmFTY3JpcHRUcmFuc2Zvcm1lck9wdGlvbnMsIG1heFRocmVhZHM6IG51bWJlcikge1xuICAgIHRoaXMuI3dvcmtlclBvb2wgPSBuZXcgUGlzY2luYSh7XG4gICAgICBmaWxlbmFtZTogcmVxdWlyZS5yZXNvbHZlKCcuL2phdmFzY3JpcHQtdHJhbnNmb3JtZXItd29ya2VyJyksXG4gICAgICBtaW5UaHJlYWRzOiAxLFxuICAgICAgbWF4VGhyZWFkcyxcbiAgICAgIC8vIFNodXRkb3duIGlkbGUgdGhyZWFkcyBhZnRlciAxIHNlY29uZCBvZiBpbmFjdGl2aXR5XG4gICAgICBpZGxlVGltZW91dDogMTAwMCxcbiAgICB9KTtcblxuICAgIC8vIEV4dHJhY3Qgb3B0aW9ucyB0byBlbnN1cmUgb25seSB0aGUgbmFtZWQgb3B0aW9ucyBhcmUgc2VyaWFsaXplZCBhbmQgc2VudCB0byB0aGUgd29ya2VyXG4gICAgY29uc3Qge1xuICAgICAgc291cmNlbWFwLFxuICAgICAgdGhpcmRQYXJ0eVNvdXJjZW1hcHMgPSBmYWxzZSxcbiAgICAgIGFkdmFuY2VkT3B0aW1pemF0aW9ucyA9IGZhbHNlLFxuICAgICAgaml0ID0gZmFsc2UsXG4gICAgfSA9IG9wdGlvbnM7XG4gICAgdGhpcy4jY29tbW9uT3B0aW9ucyA9IHtcbiAgICAgIHNvdXJjZW1hcCxcbiAgICAgIHRoaXJkUGFydHlTb3VyY2VtYXBzLFxuICAgICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zLFxuICAgICAgaml0LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogUGVyZm9ybXMgSmF2YVNjcmlwdCB0cmFuc2Zvcm1hdGlvbnMgb24gYSBmaWxlIGZyb20gdGhlIGZpbGVzeXN0ZW0uXG4gICAqIElmIG5vIHRyYW5zZm9ybWF0aW9ucyBhcmUgcmVxdWlyZWQsIHRoZSBkYXRhIGZvciB0aGUgb3JpZ2luYWwgZmlsZSB3aWxsIGJlIHJldHVybmVkLlxuICAgKiBAcGFyYW0gZmlsZW5hbWUgVGhlIGZ1bGwgcGF0aCB0byB0aGUgZmlsZS5cbiAgICogQHBhcmFtIHNraXBMaW5rZXIgSWYgdHJ1ZSwgYnlwYXNzIGFsbCBBbmd1bGFyIGxpbmtlciBwcm9jZXNzaW5nOyBpZiBmYWxzZSwgYXR0ZW1wdCBsaW5raW5nLlxuICAgKiBAcmV0dXJucyBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhIFVURi04IGVuY29kZWQgVWludDhBcnJheSBjb250YWluaW5nIHRoZSByZXN1bHQuXG4gICAqL1xuICB0cmFuc2Zvcm1GaWxlKGZpbGVuYW1lOiBzdHJpbmcsIHNraXBMaW5rZXI/OiBib29sZWFuKTogUHJvbWlzZTxVaW50OEFycmF5PiB7XG4gICAgLy8gQWx3YXlzIHNlbmQgdGhlIHJlcXVlc3QgdG8gYSB3b3JrZXIuIEZpbGVzIGFyZSBhbG1vc3QgYWx3YXlzIGZyb20gbm9kZSBtb2R1bGVzIHdoaWNoIG1lYW5zXG4gICAgLy8gdGhleSBtYXkgbmVlZCBsaW5raW5nLiBUaGUgZGF0YSBpcyBhbHNvIG5vdCB5ZXQgYXZhaWxhYmxlIHRvIHBlcmZvcm0gbW9zdCB0cmFuc2Zvcm1hdGlvbiBjaGVja3MuXG4gICAgcmV0dXJuIHRoaXMuI3dvcmtlclBvb2wucnVuKHtcbiAgICAgIGZpbGVuYW1lLFxuICAgICAgc2tpcExpbmtlcixcbiAgICAgIC4uLnRoaXMuI2NvbW1vbk9wdGlvbnMsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUGVyZm9ybXMgSmF2YVNjcmlwdCB0cmFuc2Zvcm1hdGlvbnMgb24gdGhlIHByb3ZpZGVkIGRhdGEgb2YgYSBmaWxlLiBUaGUgZmlsZSBkb2VzIG5vdCBuZWVkXG4gICAqIHRvIGV4aXN0IG9uIHRoZSBmaWxlc3lzdGVtLlxuICAgKiBAcGFyYW0gZmlsZW5hbWUgVGhlIGZ1bGwgcGF0aCBvZiB0aGUgZmlsZSByZXByZXNlbnRlZCBieSB0aGUgZGF0YS5cbiAgICogQHBhcmFtIGRhdGEgVGhlIGRhdGEgb2YgdGhlIGZpbGUgdGhhdCBzaG91bGQgYmUgdHJhbnNmb3JtZWQuXG4gICAqIEBwYXJhbSBza2lwTGlua2VyIElmIHRydWUsIGJ5cGFzcyBhbGwgQW5ndWxhciBsaW5rZXIgcHJvY2Vzc2luZzsgaWYgZmFsc2UsIGF0dGVtcHQgbGlua2luZy5cbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYSBVVEYtOCBlbmNvZGVkIFVpbnQ4QXJyYXkgY29udGFpbmluZyB0aGUgcmVzdWx0LlxuICAgKi9cbiAgYXN5bmMgdHJhbnNmb3JtRGF0YShmaWxlbmFtZTogc3RyaW5nLCBkYXRhOiBzdHJpbmcsIHNraXBMaW5rZXI6IGJvb2xlYW4pOiBQcm9taXNlPFVpbnQ4QXJyYXk+IHtcbiAgICAvLyBQZXJmb3JtIGEgcXVpY2sgdGVzdCB0byBkZXRlcm1pbmUgaWYgdGhlIGRhdGEgbmVlZHMgYW55IHRyYW5zZm9ybWF0aW9ucy5cbiAgICAvLyBUaGlzIGFsbG93cyBkaXJlY3RseSByZXR1cm5pbmcgdGhlIGRhdGEgd2l0aG91dCB0aGUgd29ya2VyIGNvbW11bmljYXRpb24gb3ZlcmhlYWQuXG4gICAgaWYgKHNraXBMaW5rZXIgJiYgIXRoaXMuI2NvbW1vbk9wdGlvbnMuYWR2YW5jZWRPcHRpbWl6YXRpb25zKSB7XG4gICAgICBjb25zdCBrZWVwU291cmNlbWFwID1cbiAgICAgICAgdGhpcy4jY29tbW9uT3B0aW9ucy5zb3VyY2VtYXAgJiZcbiAgICAgICAgKCEhdGhpcy4jY29tbW9uT3B0aW9ucy50aGlyZFBhcnR5U291cmNlbWFwcyB8fCAhL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLy50ZXN0KGZpbGVuYW1lKSk7XG5cbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbShcbiAgICAgICAga2VlcFNvdXJjZW1hcCA/IGRhdGEgOiBkYXRhLnJlcGxhY2UoL15cXC9cXC8jIHNvdXJjZU1hcHBpbmdVUkw9W15cXHJcXG5dKi9nbSwgJycpLFxuICAgICAgICAndXRmLTgnLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy4jd29ya2VyUG9vbC5ydW4oe1xuICAgICAgZmlsZW5hbWUsXG4gICAgICBkYXRhLFxuICAgICAgc2tpcExpbmtlcixcbiAgICAgIC4uLnRoaXMuI2NvbW1vbk9wdGlvbnMsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU3RvcHMgYWxsIGFjdGl2ZSB0cmFuc2Zvcm1hdGlvbiB0YXNrcyBhbmQgc2h1dHMgZG93biBhbGwgd29ya2Vycy5cbiAgICogQHJldHVybnMgQSB2b2lkIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGNsb3NpbmcgaXMgY29tcGxldGUuXG4gICAqL1xuICBjbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBXb3JrYXJvdW5kIHBpc2NpbmEgYnVnIHdoZXJlIGEgd29ya2VyIHRocmVhZCB3aWxsIGJlIHJlY3JlYXRlZCBhZnRlciBkZXN0cm95IHRvIG1lZXQgdGhlIG1pbmltdW0uXG4gICAgdGhpcy4jd29ya2VyUG9vbC5vcHRpb25zLm1pblRocmVhZHMgPSAwO1xuXG4gICAgcmV0dXJuIHRoaXMuI3dvcmtlclBvb2wuZGVzdHJveSgpO1xuICB9XG59XG4iXX0=