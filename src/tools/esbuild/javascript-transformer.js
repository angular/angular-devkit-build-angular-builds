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
            maxThreads,
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
        return this.#workerPool.destroy();
    }
}
exports.JavaScriptTransformer = JavaScriptTransformer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC10cmFuc2Zvcm1lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvamF2YXNjcmlwdC10cmFuc2Zvcm1lci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFFSCxzREFBOEI7QUFZOUI7Ozs7OztHQU1HO0FBQ0gsTUFBYSxxQkFBcUI7SUFDaEMsV0FBVyxDQUFVO0lBQ3JCLGNBQWMsQ0FBeUM7SUFFdkQsWUFBWSxPQUFxQyxFQUFFLFVBQWtCO1FBQ25FLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxpQkFBTyxDQUFDO1lBQzdCLFFBQVEsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLGlDQUFpQyxDQUFDO1lBQzVELFVBQVU7U0FDWCxDQUFDLENBQUM7UUFFSCx5RkFBeUY7UUFDekYsTUFBTSxFQUNKLFNBQVMsRUFDVCxvQkFBb0IsR0FBRyxLQUFLLEVBQzVCLHFCQUFxQixHQUFHLEtBQUssRUFDN0IsR0FBRyxHQUFHLEtBQUssR0FDWixHQUFHLE9BQU8sQ0FBQztRQUNaLElBQUksQ0FBQyxjQUFjLEdBQUc7WUFDcEIsU0FBUztZQUNULG9CQUFvQjtZQUNwQixxQkFBcUI7WUFDckIsR0FBRztTQUNKLENBQUM7SUFDSixDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ0gsYUFBYSxDQUFDLFFBQWdCLEVBQUUsVUFBb0I7UUFDbEQsNkZBQTZGO1FBQzdGLG1HQUFtRztRQUNuRyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDO1lBQzFCLFFBQVE7WUFDUixVQUFVO1lBQ1YsR0FBRyxJQUFJLENBQUMsY0FBYztTQUN2QixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNILEtBQUssQ0FBQyxhQUFhLENBQUMsUUFBZ0IsRUFBRSxJQUFZLEVBQUUsVUFBbUI7UUFDckUsMkVBQTJFO1FBQzNFLHFGQUFxRjtRQUNyRixJQUFJLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMscUJBQXFCLEVBQUU7WUFDNUQsTUFBTSxhQUFhLEdBQ2pCLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUztnQkFDN0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxvQkFBb0IsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBRTNGLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FDaEIsYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsb0NBQW9DLEVBQUUsRUFBRSxDQUFDLEVBQzdFLE9BQU8sQ0FDUixDQUFDO1NBQ0g7UUFFRCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDO1lBQzFCLFFBQVE7WUFDUixJQUFJO1lBQ0osVUFBVTtZQUNWLEdBQUcsSUFBSSxDQUFDLGNBQWM7U0FDdkIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUs7UUFDSCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDcEMsQ0FBQztDQUNGO0FBL0VELHNEQStFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgUGlzY2luYSBmcm9tICdwaXNjaW5hJztcblxuLyoqXG4gKiBUcmFuc2Zvcm1hdGlvbiBvcHRpb25zIHRoYXQgc2hvdWxkIGFwcGx5IHRvIGFsbCB0cmFuc2Zvcm1lZCBmaWxlcyBhbmQgZGF0YS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBKYXZhU2NyaXB0VHJhbnNmb3JtZXJPcHRpb25zIHtcbiAgc291cmNlbWFwOiBib29sZWFuO1xuICB0aGlyZFBhcnR5U291cmNlbWFwcz86IGJvb2xlYW47XG4gIGFkdmFuY2VkT3B0aW1pemF0aW9ucz86IGJvb2xlYW47XG4gIGppdD86IGJvb2xlYW47XG59XG5cbi8qKlxuICogQSBjbGFzcyB0aGF0IHBlcmZvcm1zIHRyYW5zZm9ybWF0aW9uIG9mIEphdmFTY3JpcHQgZmlsZXMgYW5kIHJhdyBkYXRhLlxuICogQSB3b3JrZXIgcG9vbCBpcyB1c2VkIHRvIGRpc3RyaWJ1dGUgdGhlIHRyYW5zZm9ybWF0aW9uIGFjdGlvbnMgYW5kIGFsbG93XG4gKiBwYXJhbGxlbCBwcm9jZXNzaW5nLiBUcmFuc2Zvcm1hdGlvbiBiZWhhdmlvciBpcyBiYXNlZCBvbiB0aGUgZmlsZW5hbWUgYW5kXG4gKiBkYXRhLiBUcmFuc2Zvcm1hdGlvbnMgbWF5IGluY2x1ZGU6IGFzeW5jIGRvd25sZXZlbGluZywgQW5ndWxhciBsaW5raW5nLFxuICogYW5kIGFkdmFuY2VkIG9wdGltaXphdGlvbnMuXG4gKi9cbmV4cG9ydCBjbGFzcyBKYXZhU2NyaXB0VHJhbnNmb3JtZXIge1xuICAjd29ya2VyUG9vbDogUGlzY2luYTtcbiAgI2NvbW1vbk9wdGlvbnM6IFJlcXVpcmVkPEphdmFTY3JpcHRUcmFuc2Zvcm1lck9wdGlvbnM+O1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IEphdmFTY3JpcHRUcmFuc2Zvcm1lck9wdGlvbnMsIG1heFRocmVhZHM6IG51bWJlcikge1xuICAgIHRoaXMuI3dvcmtlclBvb2wgPSBuZXcgUGlzY2luYSh7XG4gICAgICBmaWxlbmFtZTogcmVxdWlyZS5yZXNvbHZlKCcuL2phdmFzY3JpcHQtdHJhbnNmb3JtZXItd29ya2VyJyksXG4gICAgICBtYXhUaHJlYWRzLFxuICAgIH0pO1xuXG4gICAgLy8gRXh0cmFjdCBvcHRpb25zIHRvIGVuc3VyZSBvbmx5IHRoZSBuYW1lZCBvcHRpb25zIGFyZSBzZXJpYWxpemVkIGFuZCBzZW50IHRvIHRoZSB3b3JrZXJcbiAgICBjb25zdCB7XG4gICAgICBzb3VyY2VtYXAsXG4gICAgICB0aGlyZFBhcnR5U291cmNlbWFwcyA9IGZhbHNlLFxuICAgICAgYWR2YW5jZWRPcHRpbWl6YXRpb25zID0gZmFsc2UsXG4gICAgICBqaXQgPSBmYWxzZSxcbiAgICB9ID0gb3B0aW9ucztcbiAgICB0aGlzLiNjb21tb25PcHRpb25zID0ge1xuICAgICAgc291cmNlbWFwLFxuICAgICAgdGhpcmRQYXJ0eVNvdXJjZW1hcHMsXG4gICAgICBhZHZhbmNlZE9wdGltaXphdGlvbnMsXG4gICAgICBqaXQsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBKYXZhU2NyaXB0IHRyYW5zZm9ybWF0aW9ucyBvbiBhIGZpbGUgZnJvbSB0aGUgZmlsZXN5c3RlbS5cbiAgICogSWYgbm8gdHJhbnNmb3JtYXRpb25zIGFyZSByZXF1aXJlZCwgdGhlIGRhdGEgZm9yIHRoZSBvcmlnaW5hbCBmaWxlIHdpbGwgYmUgcmV0dXJuZWQuXG4gICAqIEBwYXJhbSBmaWxlbmFtZSBUaGUgZnVsbCBwYXRoIHRvIHRoZSBmaWxlLlxuICAgKiBAcGFyYW0gc2tpcExpbmtlciBJZiB0cnVlLCBieXBhc3MgYWxsIEFuZ3VsYXIgbGlua2VyIHByb2Nlc3Npbmc7IGlmIGZhbHNlLCBhdHRlbXB0IGxpbmtpbmcuXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGEgVVRGLTggZW5jb2RlZCBVaW50OEFycmF5IGNvbnRhaW5pbmcgdGhlIHJlc3VsdC5cbiAgICovXG4gIHRyYW5zZm9ybUZpbGUoZmlsZW5hbWU6IHN0cmluZywgc2tpcExpbmtlcj86IGJvb2xlYW4pOiBQcm9taXNlPFVpbnQ4QXJyYXk+IHtcbiAgICAvLyBBbHdheXMgc2VuZCB0aGUgcmVxdWVzdCB0byBhIHdvcmtlci4gRmlsZXMgYXJlIGFsbW9zdCBhbHdheXMgZnJvbSBub2RlIG1vZHVsZXMgd2hpY2ggbWVhbnNcbiAgICAvLyB0aGV5IG1heSBuZWVkIGxpbmtpbmcuIFRoZSBkYXRhIGlzIGFsc28gbm90IHlldCBhdmFpbGFibGUgdG8gcGVyZm9ybSBtb3N0IHRyYW5zZm9ybWF0aW9uIGNoZWNrcy5cbiAgICByZXR1cm4gdGhpcy4jd29ya2VyUG9vbC5ydW4oe1xuICAgICAgZmlsZW5hbWUsXG4gICAgICBza2lwTGlua2VyLFxuICAgICAgLi4udGhpcy4jY29tbW9uT3B0aW9ucyxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBKYXZhU2NyaXB0IHRyYW5zZm9ybWF0aW9ucyBvbiB0aGUgcHJvdmlkZWQgZGF0YSBvZiBhIGZpbGUuIFRoZSBmaWxlIGRvZXMgbm90IG5lZWRcbiAgICogdG8gZXhpc3Qgb24gdGhlIGZpbGVzeXN0ZW0uXG4gICAqIEBwYXJhbSBmaWxlbmFtZSBUaGUgZnVsbCBwYXRoIG9mIHRoZSBmaWxlIHJlcHJlc2VudGVkIGJ5IHRoZSBkYXRhLlxuICAgKiBAcGFyYW0gZGF0YSBUaGUgZGF0YSBvZiB0aGUgZmlsZSB0aGF0IHNob3VsZCBiZSB0cmFuc2Zvcm1lZC5cbiAgICogQHBhcmFtIHNraXBMaW5rZXIgSWYgdHJ1ZSwgYnlwYXNzIGFsbCBBbmd1bGFyIGxpbmtlciBwcm9jZXNzaW5nOyBpZiBmYWxzZSwgYXR0ZW1wdCBsaW5raW5nLlxuICAgKiBAcmV0dXJucyBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhIFVURi04IGVuY29kZWQgVWludDhBcnJheSBjb250YWluaW5nIHRoZSByZXN1bHQuXG4gICAqL1xuICBhc3luYyB0cmFuc2Zvcm1EYXRhKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IHN0cmluZywgc2tpcExpbmtlcjogYm9vbGVhbik6IFByb21pc2U8VWludDhBcnJheT4ge1xuICAgIC8vIFBlcmZvcm0gYSBxdWljayB0ZXN0IHRvIGRldGVybWluZSBpZiB0aGUgZGF0YSBuZWVkcyBhbnkgdHJhbnNmb3JtYXRpb25zLlxuICAgIC8vIFRoaXMgYWxsb3dzIGRpcmVjdGx5IHJldHVybmluZyB0aGUgZGF0YSB3aXRob3V0IHRoZSB3b3JrZXIgY29tbXVuaWNhdGlvbiBvdmVyaGVhZC5cbiAgICBpZiAoc2tpcExpbmtlciAmJiAhdGhpcy4jY29tbW9uT3B0aW9ucy5hZHZhbmNlZE9wdGltaXphdGlvbnMpIHtcbiAgICAgIGNvbnN0IGtlZXBTb3VyY2VtYXAgPVxuICAgICAgICB0aGlzLiNjb21tb25PcHRpb25zLnNvdXJjZW1hcCAmJlxuICAgICAgICAoISF0aGlzLiNjb21tb25PcHRpb25zLnRoaXJkUGFydHlTb3VyY2VtYXBzIHx8ICEvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vLnRlc3QoZmlsZW5hbWUpKTtcblxuICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKFxuICAgICAgICBrZWVwU291cmNlbWFwID8gZGF0YSA6IGRhdGEucmVwbGFjZSgvXlxcL1xcLyMgc291cmNlTWFwcGluZ1VSTD1bXlxcclxcbl0qL2dtLCAnJyksXG4gICAgICAgICd1dGYtOCcsXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLiN3b3JrZXJQb29sLnJ1bih7XG4gICAgICBmaWxlbmFtZSxcbiAgICAgIGRhdGEsXG4gICAgICBza2lwTGlua2VyLFxuICAgICAgLi4udGhpcy4jY29tbW9uT3B0aW9ucyxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdG9wcyBhbGwgYWN0aXZlIHRyYW5zZm9ybWF0aW9uIHRhc2tzIGFuZCBzaHV0cyBkb3duIGFsbCB3b3JrZXJzLlxuICAgKiBAcmV0dXJucyBBIHZvaWQgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gY2xvc2luZyBpcyBjb21wbGV0ZS5cbiAgICovXG4gIGNsb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiB0aGlzLiN3b3JrZXJQb29sLmRlc3Ryb3koKTtcbiAgfVxufVxuIl19