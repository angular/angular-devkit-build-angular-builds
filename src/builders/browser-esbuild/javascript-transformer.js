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
var _JavaScriptTransformer_workerPool, _JavaScriptTransformer_commonOptions;
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
        _JavaScriptTransformer_workerPool.set(this, void 0);
        _JavaScriptTransformer_commonOptions.set(this, void 0);
        __classPrivateFieldSet(this, _JavaScriptTransformer_workerPool, new piscina_1.default({
            filename: require.resolve('./javascript-transformer-worker'),
            maxThreads,
        }), "f");
        // Extract options to ensure only the named options are serialized and sent to the worker
        const { sourcemap, thirdPartySourcemaps = false, advancedOptimizations = false } = options;
        __classPrivateFieldSet(this, _JavaScriptTransformer_commonOptions, {
            sourcemap,
            thirdPartySourcemaps,
            advancedOptimizations,
        }, "f");
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
            ...__classPrivateFieldGet(this, _JavaScriptTransformer_commonOptions, "f"),
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
        if (skipLinker && !__classPrivateFieldGet(this, _JavaScriptTransformer_commonOptions, "f").advancedOptimizations) {
            // If the linker is being skipped and no optimizations are needed, only async transformation is left.
            // This checks for async generator functions and class methods. All other async transformation is handled by esbuild.
            forceAsyncTransformation = data.includes('async') && /async(?:\s+function)?\s*\*/.test(data);
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
            ...__classPrivateFieldGet(this, _JavaScriptTransformer_commonOptions, "f"),
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
_JavaScriptTransformer_workerPool = new WeakMap(), _JavaScriptTransformer_commonOptions = new WeakMap();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC10cmFuc2Zvcm1lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9qYXZhc2NyaXB0LXRyYW5zZm9ybWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHNEQUE4QjtBQVc5Qjs7Ozs7O0dBTUc7QUFDSCxNQUFhLHFCQUFxQjtJQUloQyxZQUFZLE9BQXFDLEVBQUUsVUFBbUI7UUFIdEUsb0RBQXFCO1FBQ3JCLHVEQUF1RDtRQUdyRCx1QkFBQSxJQUFJLHFDQUFlLElBQUksaUJBQU8sQ0FBQztZQUM3QixRQUFRLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxpQ0FBaUMsQ0FBQztZQUM1RCxVQUFVO1NBQ1gsQ0FBQyxNQUFBLENBQUM7UUFFSCx5RkFBeUY7UUFDekYsTUFBTSxFQUFFLFNBQVMsRUFBRSxvQkFBb0IsR0FBRyxLQUFLLEVBQUUscUJBQXFCLEdBQUcsS0FBSyxFQUFFLEdBQUcsT0FBTyxDQUFDO1FBQzNGLHVCQUFBLElBQUksd0NBQWtCO1lBQ3BCLFNBQVM7WUFDVCxvQkFBb0I7WUFDcEIscUJBQXFCO1NBQ3RCLE1BQUEsQ0FBQztJQUNKLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILGFBQWEsQ0FBQyxRQUFnQjtRQUM1Qiw2RkFBNkY7UUFDN0YsbUdBQW1HO1FBQ25HLE9BQU8sdUJBQUEsSUFBSSx5Q0FBWSxDQUFDLEdBQUcsQ0FBQztZQUMxQixRQUFRO1lBQ1IsR0FBRyx1QkFBQSxJQUFJLDRDQUFlO1NBQ3ZCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsS0FBSyxDQUFDLGFBQWEsQ0FBQyxRQUFnQixFQUFFLElBQVksRUFBRSxVQUFtQjtRQUNyRSwyRUFBMkU7UUFDM0UscUZBQXFGO1FBQ3JGLElBQUksd0JBQXdCLENBQUM7UUFDN0IsSUFBSSxVQUFVLElBQUksQ0FBQyx1QkFBQSxJQUFJLDRDQUFlLENBQUMscUJBQXFCLEVBQUU7WUFDNUQscUdBQXFHO1lBQ3JHLHFIQUFxSDtZQUNySCx3QkFBd0IsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLDRCQUE0QixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUU3RixJQUFJLENBQUMsd0JBQXdCLEVBQUU7Z0JBQzdCLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7YUFDbkM7U0FDRjtRQUVELE9BQU8sdUJBQUEsSUFBSSx5Q0FBWSxDQUFDLEdBQUcsQ0FBQztZQUMxQixRQUFRO1lBQ1IsSUFBSTtZQUNKLDJFQUEyRTtZQUMzRSx3QkFBd0I7WUFDeEIsVUFBVTtZQUNWLEdBQUcsdUJBQUEsSUFBSSw0Q0FBZTtTQUN2QixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsS0FBSztRQUNILE9BQU8sdUJBQUEsSUFBSSx5Q0FBWSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ3BDLENBQUM7Q0FDRjtBQXpFRCxzREF5RUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IFBpc2NpbmEgZnJvbSAncGlzY2luYSc7XG5cbi8qKlxuICogVHJhbnNmb3JtYXRpb24gb3B0aW9ucyB0aGF0IHNob3VsZCBhcHBseSB0byBhbGwgdHJhbnNmb3JtZWQgZmlsZXMgYW5kIGRhdGEuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSmF2YVNjcmlwdFRyYW5zZm9ybWVyT3B0aW9ucyB7XG4gIHNvdXJjZW1hcDogYm9vbGVhbjtcbiAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM/OiBib29sZWFuO1xuICBhZHZhbmNlZE9wdGltaXphdGlvbnM/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIEEgY2xhc3MgdGhhdCBwZXJmb3JtcyB0cmFuc2Zvcm1hdGlvbiBvZiBKYXZhU2NyaXB0IGZpbGVzIGFuZCByYXcgZGF0YS5cbiAqIEEgd29ya2VyIHBvb2wgaXMgdXNlZCB0byBkaXN0cmlidXRlIHRoZSB0cmFuc2Zvcm1hdGlvbiBhY3Rpb25zIGFuZCBhbGxvd1xuICogcGFyYWxsZWwgcHJvY2Vzc2luZy4gVHJhbnNmb3JtYXRpb24gYmVoYXZpb3IgaXMgYmFzZWQgb24gdGhlIGZpbGVuYW1lIGFuZFxuICogZGF0YS4gVHJhbnNmb3JtYXRpb25zIG1heSBpbmNsdWRlOiBhc3luYyBkb3dubGV2ZWxpbmcsIEFuZ3VsYXIgbGlua2luZyxcbiAqIGFuZCBhZHZhbmNlZCBvcHRpbWl6YXRpb25zLlxuICovXG5leHBvcnQgY2xhc3MgSmF2YVNjcmlwdFRyYW5zZm9ybWVyIHtcbiAgI3dvcmtlclBvb2w6IFBpc2NpbmE7XG4gICNjb21tb25PcHRpb25zOiBSZXF1aXJlZDxKYXZhU2NyaXB0VHJhbnNmb3JtZXJPcHRpb25zPjtcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBKYXZhU2NyaXB0VHJhbnNmb3JtZXJPcHRpb25zLCBtYXhUaHJlYWRzPzogbnVtYmVyKSB7XG4gICAgdGhpcy4jd29ya2VyUG9vbCA9IG5ldyBQaXNjaW5hKHtcbiAgICAgIGZpbGVuYW1lOiByZXF1aXJlLnJlc29sdmUoJy4vamF2YXNjcmlwdC10cmFuc2Zvcm1lci13b3JrZXInKSxcbiAgICAgIG1heFRocmVhZHMsXG4gICAgfSk7XG5cbiAgICAvLyBFeHRyYWN0IG9wdGlvbnMgdG8gZW5zdXJlIG9ubHkgdGhlIG5hbWVkIG9wdGlvbnMgYXJlIHNlcmlhbGl6ZWQgYW5kIHNlbnQgdG8gdGhlIHdvcmtlclxuICAgIGNvbnN0IHsgc291cmNlbWFwLCB0aGlyZFBhcnR5U291cmNlbWFwcyA9IGZhbHNlLCBhZHZhbmNlZE9wdGltaXphdGlvbnMgPSBmYWxzZSB9ID0gb3B0aW9ucztcbiAgICB0aGlzLiNjb21tb25PcHRpb25zID0ge1xuICAgICAgc291cmNlbWFwLFxuICAgICAgdGhpcmRQYXJ0eVNvdXJjZW1hcHMsXG4gICAgICBhZHZhbmNlZE9wdGltaXphdGlvbnMsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBKYXZhU2NyaXB0IHRyYW5zZm9ybWF0aW9ucyBvbiBhIGZpbGUgZnJvbSB0aGUgZmlsZXN5c3RlbS5cbiAgICogSWYgbm8gdHJhbnNmb3JtYXRpb25zIGFyZSByZXF1aXJlZCwgdGhlIGRhdGEgZm9yIHRoZSBvcmlnaW5hbCBmaWxlIHdpbGwgYmUgcmV0dXJuZWQuXG4gICAqIEBwYXJhbSBmaWxlbmFtZSBUaGUgZnVsbCBwYXRoIHRvIHRoZSBmaWxlLlxuICAgKiBAcmV0dXJucyBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhIFVURi04IGVuY29kZWQgVWludDhBcnJheSBjb250YWluaW5nIHRoZSByZXN1bHQuXG4gICAqL1xuICB0cmFuc2Zvcm1GaWxlKGZpbGVuYW1lOiBzdHJpbmcpOiBQcm9taXNlPFVpbnQ4QXJyYXk+IHtcbiAgICAvLyBBbHdheXMgc2VuZCB0aGUgcmVxdWVzdCB0byBhIHdvcmtlci4gRmlsZXMgYXJlIGFsbW9zdCBhbHdheXMgZnJvbSBub2RlIG1vZHVsZXMgd2hpY2ggbWVhc25cbiAgICAvLyB0aGV5IG1heSBuZWVkIGxpbmtpbmcuIFRoZSBkYXRhIGlzIGFsc28gbm90IHlldCBhdmFpbGFibGUgdG8gcGVyZm9ybSBtb3N0IHRyYW5zZm9ybWF0aW9uIGNoZWNrcy5cbiAgICByZXR1cm4gdGhpcy4jd29ya2VyUG9vbC5ydW4oe1xuICAgICAgZmlsZW5hbWUsXG4gICAgICAuLi50aGlzLiNjb21tb25PcHRpb25zLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBlcmZvcm1zIEphdmFTY3JpcHQgdHJhbnNmb3JtYXRpb25zIG9uIHRoZSBwcm92aWRlZCBkYXRhIG9mIGEgZmlsZS4gVGhlIGZpbGUgZG9lcyBub3QgbmVlZFxuICAgKiB0byBleGlzdCBvbiB0aGUgZmlsZXN5c3RlbS5cbiAgICogQHBhcmFtIGZpbGVuYW1lIFRoZSBmdWxsIHBhdGggb2YgdGhlIGZpbGUgcmVwcmVzZW50ZWQgYnkgdGhlIGRhdGEuXG4gICAqIEBwYXJhbSBkYXRhIFRoZSBkYXRhIG9mIHRoZSBmaWxlIHRoYXQgc2hvdWxkIGJlIHRyYW5zZm9ybWVkLlxuICAgKiBAcGFyYW0gc2tpcExpbmtlciBJZiB0cnVlLCBieXBhc3MgYWxsIEFuZ3VsYXIgbGlua2VyIHByb2Nlc3Npbmc7IGlmIGZhbHNlLCBhdHRlbXB0IGxpbmtpbmcuXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGEgVVRGLTggZW5jb2RlZCBVaW50OEFycmF5IGNvbnRhaW5pbmcgdGhlIHJlc3VsdC5cbiAgICovXG4gIGFzeW5jIHRyYW5zZm9ybURhdGEoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogc3RyaW5nLCBza2lwTGlua2VyOiBib29sZWFuKTogUHJvbWlzZTxVaW50OEFycmF5PiB7XG4gICAgLy8gUGVyZm9ybSBhIHF1aWNrIHRlc3QgdG8gZGV0ZXJtaW5lIGlmIHRoZSBkYXRhIG5lZWRzIGFueSB0cmFuc2Zvcm1hdGlvbnMuXG4gICAgLy8gVGhpcyBhbGxvd3MgZGlyZWN0bHkgcmV0dXJuaW5nIHRoZSBkYXRhIHdpdGhvdXQgdGhlIHdvcmtlciBjb21tdW5pY2F0aW9uIG92ZXJoZWFkLlxuICAgIGxldCBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb247XG4gICAgaWYgKHNraXBMaW5rZXIgJiYgIXRoaXMuI2NvbW1vbk9wdGlvbnMuYWR2YW5jZWRPcHRpbWl6YXRpb25zKSB7XG4gICAgICAvLyBJZiB0aGUgbGlua2VyIGlzIGJlaW5nIHNraXBwZWQgYW5kIG5vIG9wdGltaXphdGlvbnMgYXJlIG5lZWRlZCwgb25seSBhc3luYyB0cmFuc2Zvcm1hdGlvbiBpcyBsZWZ0LlxuICAgICAgLy8gVGhpcyBjaGVja3MgZm9yIGFzeW5jIGdlbmVyYXRvciBmdW5jdGlvbnMgYW5kIGNsYXNzIG1ldGhvZHMuIEFsbCBvdGhlciBhc3luYyB0cmFuc2Zvcm1hdGlvbiBpcyBoYW5kbGVkIGJ5IGVzYnVpbGQuXG4gICAgICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24gPSBkYXRhLmluY2x1ZGVzKCdhc3luYycpICYmIC9hc3luYyg/OlxccytmdW5jdGlvbik/XFxzKlxcKi8udGVzdChkYXRhKTtcblxuICAgICAgaWYgKCFmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKGRhdGEsICd1dGYtOCcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLiN3b3JrZXJQb29sLnJ1bih7XG4gICAgICBmaWxlbmFtZSxcbiAgICAgIGRhdGEsXG4gICAgICAvLyBTZW5kIHRoZSBhc3luYyBjaGVjayByZXN1bHQgaWYgcHJlc2VudCB0byBhdm9pZCByZWNoZWNraW5nIGluIHRoZSB3b3JrZXJcbiAgICAgIGZvcmNlQXN5bmNUcmFuc2Zvcm1hdGlvbixcbiAgICAgIHNraXBMaW5rZXIsXG4gICAgICAuLi50aGlzLiNjb21tb25PcHRpb25zLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0b3BzIGFsbCBhY3RpdmUgdHJhbnNmb3JtYXRpb24gdGFza3MgYW5kIHNodXRzIGRvd24gYWxsIHdvcmtlcnMuXG4gICAqIEByZXR1cm5zIEEgdm9pZCBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBjbG9zaW5nIGlzIGNvbXBsZXRlLlxuICAgKi9cbiAgY2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIHRoaXMuI3dvcmtlclBvb2wuZGVzdHJveSgpO1xuICB9XG59XG4iXX0=