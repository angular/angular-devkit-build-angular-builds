"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _JavaScriptTransformer_workerPool;
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
    constructor(options, maxThreads) {
        this.options = options;
        _JavaScriptTransformer_workerPool.set(this, void 0);
        __classPrivateFieldSet(this, _JavaScriptTransformer_workerPool, new piscina_1.default({
            filename: require.resolve('./javascript-transformer-worker'),
            maxThreads,
        }), "f");
    }
    /**
     * Performs JavaScript transformations on a file from the filesystem.
     * If no transformations are required, the data for the original file will be returned.
     * @param filename The full path to the file.
     * @returns A promise that resolves to a UTF-8 encoded Uint8Array containing the result.
     */
    transformFile(filename) {
        // Always send the request to a worker. Files are almost always from node modules which measn
        // they may need linking. The data is also not yet available to perform most transformation checks.
        return __classPrivateFieldGet(this, _JavaScriptTransformer_workerPool, "f").run({
            filename,
            ...this.options,
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
        let forceAsyncTransformation;
        if (skipLinker && !this.options.advancedOptimizations) {
            // If the linker is being skipped and no optimizations are needed, only async transformation is left.
            // This checks for async generator functions. All other async transformation is handled by esbuild.
            forceAsyncTransformation = data.includes('async') && /async\s+function\s*\*/.test(data);
            if (!forceAsyncTransformation) {
                return Buffer.from(data, 'utf-8');
            }
        }
        return __classPrivateFieldGet(this, _JavaScriptTransformer_workerPool, "f").run({
            filename,
            data,
            // Send the async check result if present to avoid rechecking in the worker
            forceAsyncTransformation,
            skipLinker,
            ...this.options,
        });
    }
    /**
     * Stops all active transformation tasks and shuts down all workers.
     * @returns A void promise that resolves when closing is complete.
     */
    close() {
        return __classPrivateFieldGet(this, _JavaScriptTransformer_workerPool, "f").destroy();
    }
}
exports.JavaScriptTransformer = JavaScriptTransformer;
_JavaScriptTransformer_workerPool = new WeakMap();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC10cmFuc2Zvcm1lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9qYXZhc2NyaXB0LXRyYW5zZm9ybWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHNEQUE4QjtBQVc5Qjs7Ozs7O0dBTUc7QUFDSCxNQUFhLHFCQUFxQjtJQUdoQyxZQUFvQixPQUFxQyxFQUFFLFVBQW1CO1FBQTFELFlBQU8sR0FBUCxPQUFPLENBQThCO1FBRnpELG9EQUFxQjtRQUduQix1QkFBQSxJQUFJLHFDQUFlLElBQUksaUJBQU8sQ0FBQztZQUM3QixRQUFRLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxpQ0FBaUMsQ0FBQztZQUM1RCxVQUFVO1NBQ1gsQ0FBQyxNQUFBLENBQUM7SUFDTCxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxhQUFhLENBQUMsUUFBZ0I7UUFDNUIsNkZBQTZGO1FBQzdGLG1HQUFtRztRQUNuRyxPQUFPLHVCQUFBLElBQUkseUNBQVksQ0FBQyxHQUFHLENBQUM7WUFDMUIsUUFBUTtZQUNSLEdBQUcsSUFBSSxDQUFDLE9BQU87U0FDaEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7Ozs7O09BT0c7SUFDSCxLQUFLLENBQUMsYUFBYSxDQUFDLFFBQWdCLEVBQUUsSUFBWSxFQUFFLFVBQW1CO1FBQ3JFLDJFQUEyRTtRQUMzRSxxRkFBcUY7UUFDckYsSUFBSSx3QkFBd0IsQ0FBQztRQUM3QixJQUFJLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMscUJBQXFCLEVBQUU7WUFDckQscUdBQXFHO1lBQ3JHLG1HQUFtRztZQUNuRyx3QkFBd0IsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLHVCQUF1QixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUV4RixJQUFJLENBQUMsd0JBQXdCLEVBQUU7Z0JBQzdCLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7YUFDbkM7U0FDRjtRQUVELE9BQU8sdUJBQUEsSUFBSSx5Q0FBWSxDQUFDLEdBQUcsQ0FBQztZQUMxQixRQUFRO1lBQ1IsSUFBSTtZQUNKLDJFQUEyRTtZQUMzRSx3QkFBd0I7WUFDeEIsVUFBVTtZQUNWLEdBQUcsSUFBSSxDQUFDLE9BQU87U0FDaEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUs7UUFDSCxPQUFPLHVCQUFBLElBQUkseUNBQVksQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNwQyxDQUFDO0NBQ0Y7QUFoRUQsc0RBZ0VDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBQaXNjaW5hIGZyb20gJ3Bpc2NpbmEnO1xuXG4vKipcbiAqIFRyYW5zZm9ybWF0aW9uIG9wdGlvbnMgdGhhdCBzaG91bGQgYXBwbHkgdG8gYWxsIHRyYW5zZm9ybWVkIGZpbGVzIGFuZCBkYXRhLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEphdmFTY3JpcHRUcmFuc2Zvcm1lck9wdGlvbnMge1xuICBzb3VyY2VtYXA6IGJvb2xlYW47XG4gIHRoaXJkUGFydHlTb3VyY2VtYXBzPzogYm9vbGVhbjtcbiAgYWR2YW5jZWRPcHRpbWl6YXRpb25zPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBBIGNsYXNzIHRoYXQgcGVyZm9ybXMgdHJhbnNmb3JtYXRpb24gb2YgSmF2YVNjcmlwdCBmaWxlcyBhbmQgcmF3IGRhdGEuXG4gKiBBIHdvcmtlciBwb29sIGlzIHVzZWQgdG8gZGlzdHJpYnV0ZSB0aGUgdHJhbnNmb3JtYXRpb24gYWN0aW9ucyBhbmQgYWxsb3dcbiAqIHBhcmFsbGVsIHByb2Nlc3NpbmcuIFRyYW5zZm9ybWF0aW9uIGJlaGF2aW9yIGlzIGJhc2VkIG9uIHRoZSBmaWxlbmFtZSBhbmRcbiAqIGRhdGEuIFRyYW5zZm9ybWF0aW9ucyBtYXkgaW5jbHVkZTogYXN5bmMgZG93bmxldmVsaW5nLCBBbmd1bGFyIGxpbmtpbmcsXG4gKiBhbmQgYWR2YW5jZWQgb3B0aW1pemF0aW9ucy5cbiAqL1xuZXhwb3J0IGNsYXNzIEphdmFTY3JpcHRUcmFuc2Zvcm1lciB7XG4gICN3b3JrZXJQb29sOiBQaXNjaW5hO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgb3B0aW9uczogSmF2YVNjcmlwdFRyYW5zZm9ybWVyT3B0aW9ucywgbWF4VGhyZWFkcz86IG51bWJlcikge1xuICAgIHRoaXMuI3dvcmtlclBvb2wgPSBuZXcgUGlzY2luYSh7XG4gICAgICBmaWxlbmFtZTogcmVxdWlyZS5yZXNvbHZlKCcuL2phdmFzY3JpcHQtdHJhbnNmb3JtZXItd29ya2VyJyksXG4gICAgICBtYXhUaHJlYWRzLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBlcmZvcm1zIEphdmFTY3JpcHQgdHJhbnNmb3JtYXRpb25zIG9uIGEgZmlsZSBmcm9tIHRoZSBmaWxlc3lzdGVtLlxuICAgKiBJZiBubyB0cmFuc2Zvcm1hdGlvbnMgYXJlIHJlcXVpcmVkLCB0aGUgZGF0YSBmb3IgdGhlIG9yaWdpbmFsIGZpbGUgd2lsbCBiZSByZXR1cm5lZC5cbiAgICogQHBhcmFtIGZpbGVuYW1lIFRoZSBmdWxsIHBhdGggdG8gdGhlIGZpbGUuXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGEgVVRGLTggZW5jb2RlZCBVaW50OEFycmF5IGNvbnRhaW5pbmcgdGhlIHJlc3VsdC5cbiAgICovXG4gIHRyYW5zZm9ybUZpbGUoZmlsZW5hbWU6IHN0cmluZyk6IFByb21pc2U8VWludDhBcnJheT4ge1xuICAgIC8vIEFsd2F5cyBzZW5kIHRoZSByZXF1ZXN0IHRvIGEgd29ya2VyLiBGaWxlcyBhcmUgYWxtb3N0IGFsd2F5cyBmcm9tIG5vZGUgbW9kdWxlcyB3aGljaCBtZWFzblxuICAgIC8vIHRoZXkgbWF5IG5lZWQgbGlua2luZy4gVGhlIGRhdGEgaXMgYWxzbyBub3QgeWV0IGF2YWlsYWJsZSB0byBwZXJmb3JtIG1vc3QgdHJhbnNmb3JtYXRpb24gY2hlY2tzLlxuICAgIHJldHVybiB0aGlzLiN3b3JrZXJQb29sLnJ1bih7XG4gICAgICBmaWxlbmFtZSxcbiAgICAgIC4uLnRoaXMub3B0aW9ucyxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBKYXZhU2NyaXB0IHRyYW5zZm9ybWF0aW9ucyBvbiB0aGUgcHJvdmlkZWQgZGF0YSBvZiBhIGZpbGUuIFRoZSBmaWxlIGRvZXMgbm90IG5lZWRcbiAgICogdG8gZXhpc3Qgb24gdGhlIGZpbGVzeXN0ZW0uXG4gICAqIEBwYXJhbSBmaWxlbmFtZSBUaGUgZnVsbCBwYXRoIG9mIHRoZSBmaWxlIHJlcHJlc2VudGVkIGJ5IHRoZSBkYXRhLlxuICAgKiBAcGFyYW0gZGF0YSBUaGUgZGF0YSBvZiB0aGUgZmlsZSB0aGF0IHNob3VsZCBiZSB0cmFuc2Zvcm1lZC5cbiAgICogQHBhcmFtIHNraXBMaW5rZXIgSWYgdHJ1ZSwgYnlwYXNzIGFsbCBBbmd1bGFyIGxpbmtlciBwcm9jZXNzaW5nOyBpZiBmYWxzZSwgYXR0ZW1wdCBsaW5raW5nLlxuICAgKiBAcmV0dXJucyBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhIFVURi04IGVuY29kZWQgVWludDhBcnJheSBjb250YWluaW5nIHRoZSByZXN1bHQuXG4gICAqL1xuICBhc3luYyB0cmFuc2Zvcm1EYXRhKGZpbGVuYW1lOiBzdHJpbmcsIGRhdGE6IHN0cmluZywgc2tpcExpbmtlcjogYm9vbGVhbik6IFByb21pc2U8VWludDhBcnJheT4ge1xuICAgIC8vIFBlcmZvcm0gYSBxdWljayB0ZXN0IHRvIGRldGVybWluZSBpZiB0aGUgZGF0YSBuZWVkcyBhbnkgdHJhbnNmb3JtYXRpb25zLlxuICAgIC8vIFRoaXMgYWxsb3dzIGRpcmVjdGx5IHJldHVybmluZyB0aGUgZGF0YSB3aXRob3V0IHRoZSB3b3JrZXIgY29tbXVuaWNhdGlvbiBvdmVyaGVhZC5cbiAgICBsZXQgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uO1xuICAgIGlmIChza2lwTGlua2VyICYmICF0aGlzLm9wdGlvbnMuYWR2YW5jZWRPcHRpbWl6YXRpb25zKSB7XG4gICAgICAvLyBJZiB0aGUgbGlua2VyIGlzIGJlaW5nIHNraXBwZWQgYW5kIG5vIG9wdGltaXphdGlvbnMgYXJlIG5lZWRlZCwgb25seSBhc3luYyB0cmFuc2Zvcm1hdGlvbiBpcyBsZWZ0LlxuICAgICAgLy8gVGhpcyBjaGVja3MgZm9yIGFzeW5jIGdlbmVyYXRvciBmdW5jdGlvbnMuIEFsbCBvdGhlciBhc3luYyB0cmFuc2Zvcm1hdGlvbiBpcyBoYW5kbGVkIGJ5IGVzYnVpbGQuXG4gICAgICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24gPSBkYXRhLmluY2x1ZGVzKCdhc3luYycpICYmIC9hc3luY1xccytmdW5jdGlvblxccypcXCovLnRlc3QoZGF0YSk7XG5cbiAgICAgIGlmICghZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uKSB7XG4gICAgICAgIHJldHVybiBCdWZmZXIuZnJvbShkYXRhLCAndXRmLTgnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy4jd29ya2VyUG9vbC5ydW4oe1xuICAgICAgZmlsZW5hbWUsXG4gICAgICBkYXRhLFxuICAgICAgLy8gU2VuZCB0aGUgYXN5bmMgY2hlY2sgcmVzdWx0IGlmIHByZXNlbnQgdG8gYXZvaWQgcmVjaGVja2luZyBpbiB0aGUgd29ya2VyXG4gICAgICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24sXG4gICAgICBza2lwTGlua2VyLFxuICAgICAgLi4udGhpcy5vcHRpb25zLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0b3BzIGFsbCBhY3RpdmUgdHJhbnNmb3JtYXRpb24gdGFza3MgYW5kIHNodXRzIGRvd24gYWxsIHdvcmtlcnMuXG4gICAqIEByZXR1cm5zIEEgdm9pZCBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBjbG9zaW5nIGlzIGNvbXBsZXRlLlxuICAgKi9cbiAgY2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIHRoaXMuI3dvcmtlclBvb2wuZGVzdHJveSgpO1xuICB9XG59XG4iXX0=