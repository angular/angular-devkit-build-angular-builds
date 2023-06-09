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
        const { sourcemap, thirdPartySourcemaps = false, advancedOptimizations = false, jit = false, } = options;
        __classPrivateFieldSet(this, _JavaScriptTransformer_commonOptions, {
            sourcemap,
            thirdPartySourcemaps,
            advancedOptimizations,
            jit,
        }, "f");
    }
    /**
     * Performs JavaScript transformations on a file from the filesystem.
     * If no transformations are required, the data for the original file will be returned.
     * @param filename The full path to the file.
     * @param skipLinker If true, bypass all Angular linker processing; if false, attempt linking.
     * @returns A promise that resolves to a UTF-8 encoded Uint8Array containing the result.
     */
    transformFile(filename, skipLinker) {
        // Always send the request to a worker. Files are almost always from node modules which measn
        // they may need linking. The data is also not yet available to perform most transformation checks.
        return __classPrivateFieldGet(this, _JavaScriptTransformer_workerPool, "f").run({
            filename,
            skipLinker,
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
                const keepSourcemap = __classPrivateFieldGet(this, _JavaScriptTransformer_commonOptions, "f").sourcemap &&
                    (!!__classPrivateFieldGet(this, _JavaScriptTransformer_commonOptions, "f").thirdPartySourcemaps || !/[\\/]node_modules[\\/]/.test(filename));
                return Buffer.from(keepSourcemap ? data : data.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, ''), 'utf-8');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC10cmFuc2Zvcm1lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2VzYnVpbGQvamF2YXNjcmlwdC10cmFuc2Zvcm1lci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxzREFBOEI7QUFZOUI7Ozs7OztHQU1HO0FBQ0gsTUFBYSxxQkFBcUI7SUFJaEMsWUFBWSxPQUFxQyxFQUFFLFVBQW1CO1FBSHRFLG9EQUFxQjtRQUNyQix1REFBdUQ7UUFHckQsdUJBQUEsSUFBSSxxQ0FBZSxJQUFJLGlCQUFPLENBQUM7WUFDN0IsUUFBUSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsaUNBQWlDLENBQUM7WUFDNUQsVUFBVTtTQUNYLENBQUMsTUFBQSxDQUFDO1FBRUgseUZBQXlGO1FBQ3pGLE1BQU0sRUFDSixTQUFTLEVBQ1Qsb0JBQW9CLEdBQUcsS0FBSyxFQUM1QixxQkFBcUIsR0FBRyxLQUFLLEVBQzdCLEdBQUcsR0FBRyxLQUFLLEdBQ1osR0FBRyxPQUFPLENBQUM7UUFDWix1QkFBQSxJQUFJLHdDQUFrQjtZQUNwQixTQUFTO1lBQ1Qsb0JBQW9CO1lBQ3BCLHFCQUFxQjtZQUNyQixHQUFHO1NBQ0osTUFBQSxDQUFDO0lBQ0osQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNILGFBQWEsQ0FBQyxRQUFnQixFQUFFLFVBQW9CO1FBQ2xELDZGQUE2RjtRQUM3RixtR0FBbUc7UUFDbkcsT0FBTyx1QkFBQSxJQUFJLHlDQUFZLENBQUMsR0FBRyxDQUFDO1lBQzFCLFFBQVE7WUFDUixVQUFVO1lBQ1YsR0FBRyx1QkFBQSxJQUFJLDRDQUFlO1NBQ3ZCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsS0FBSyxDQUFDLGFBQWEsQ0FBQyxRQUFnQixFQUFFLElBQVksRUFBRSxVQUFtQjtRQUNyRSwyRUFBMkU7UUFDM0UscUZBQXFGO1FBQ3JGLElBQUksd0JBQXdCLENBQUM7UUFDN0IsSUFBSSxVQUFVLElBQUksQ0FBQyx1QkFBQSxJQUFJLDRDQUFlLENBQUMscUJBQXFCLEVBQUU7WUFDNUQscUdBQXFHO1lBQ3JHLHFIQUFxSDtZQUNySCx3QkFBd0IsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLDRCQUE0QixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUU3RixJQUFJLENBQUMsd0JBQXdCLEVBQUU7Z0JBQzdCLE1BQU0sYUFBYSxHQUNqQix1QkFBQSxJQUFJLDRDQUFlLENBQUMsU0FBUztvQkFDN0IsQ0FBQyxDQUFDLENBQUMsdUJBQUEsSUFBSSw0Q0FBZSxDQUFDLG9CQUFvQixJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBRTNGLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FDaEIsYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsb0NBQW9DLEVBQUUsRUFBRSxDQUFDLEVBQzdFLE9BQU8sQ0FDUixDQUFDO2FBQ0g7U0FDRjtRQUVELE9BQU8sdUJBQUEsSUFBSSx5Q0FBWSxDQUFDLEdBQUcsQ0FBQztZQUMxQixRQUFRO1lBQ1IsSUFBSTtZQUNKLDJFQUEyRTtZQUMzRSx3QkFBd0I7WUFDeEIsVUFBVTtZQUNWLEdBQUcsdUJBQUEsSUFBSSw0Q0FBZTtTQUN2QixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsS0FBSztRQUNILE9BQU8sdUJBQUEsSUFBSSx5Q0FBWSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ3BDLENBQUM7Q0FDRjtBQXhGRCxzREF3RkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IFBpc2NpbmEgZnJvbSAncGlzY2luYSc7XG5cbi8qKlxuICogVHJhbnNmb3JtYXRpb24gb3B0aW9ucyB0aGF0IHNob3VsZCBhcHBseSB0byBhbGwgdHJhbnNmb3JtZWQgZmlsZXMgYW5kIGRhdGEuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSmF2YVNjcmlwdFRyYW5zZm9ybWVyT3B0aW9ucyB7XG4gIHNvdXJjZW1hcDogYm9vbGVhbjtcbiAgdGhpcmRQYXJ0eVNvdXJjZW1hcHM/OiBib29sZWFuO1xuICBhZHZhbmNlZE9wdGltaXphdGlvbnM/OiBib29sZWFuO1xuICBqaXQ/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIEEgY2xhc3MgdGhhdCBwZXJmb3JtcyB0cmFuc2Zvcm1hdGlvbiBvZiBKYXZhU2NyaXB0IGZpbGVzIGFuZCByYXcgZGF0YS5cbiAqIEEgd29ya2VyIHBvb2wgaXMgdXNlZCB0byBkaXN0cmlidXRlIHRoZSB0cmFuc2Zvcm1hdGlvbiBhY3Rpb25zIGFuZCBhbGxvd1xuICogcGFyYWxsZWwgcHJvY2Vzc2luZy4gVHJhbnNmb3JtYXRpb24gYmVoYXZpb3IgaXMgYmFzZWQgb24gdGhlIGZpbGVuYW1lIGFuZFxuICogZGF0YS4gVHJhbnNmb3JtYXRpb25zIG1heSBpbmNsdWRlOiBhc3luYyBkb3dubGV2ZWxpbmcsIEFuZ3VsYXIgbGlua2luZyxcbiAqIGFuZCBhZHZhbmNlZCBvcHRpbWl6YXRpb25zLlxuICovXG5leHBvcnQgY2xhc3MgSmF2YVNjcmlwdFRyYW5zZm9ybWVyIHtcbiAgI3dvcmtlclBvb2w6IFBpc2NpbmE7XG4gICNjb21tb25PcHRpb25zOiBSZXF1aXJlZDxKYXZhU2NyaXB0VHJhbnNmb3JtZXJPcHRpb25zPjtcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBKYXZhU2NyaXB0VHJhbnNmb3JtZXJPcHRpb25zLCBtYXhUaHJlYWRzPzogbnVtYmVyKSB7XG4gICAgdGhpcy4jd29ya2VyUG9vbCA9IG5ldyBQaXNjaW5hKHtcbiAgICAgIGZpbGVuYW1lOiByZXF1aXJlLnJlc29sdmUoJy4vamF2YXNjcmlwdC10cmFuc2Zvcm1lci13b3JrZXInKSxcbiAgICAgIG1heFRocmVhZHMsXG4gICAgfSk7XG5cbiAgICAvLyBFeHRyYWN0IG9wdGlvbnMgdG8gZW5zdXJlIG9ubHkgdGhlIG5hbWVkIG9wdGlvbnMgYXJlIHNlcmlhbGl6ZWQgYW5kIHNlbnQgdG8gdGhlIHdvcmtlclxuICAgIGNvbnN0IHtcbiAgICAgIHNvdXJjZW1hcCxcbiAgICAgIHRoaXJkUGFydHlTb3VyY2VtYXBzID0gZmFsc2UsXG4gICAgICBhZHZhbmNlZE9wdGltaXphdGlvbnMgPSBmYWxzZSxcbiAgICAgIGppdCA9IGZhbHNlLFxuICAgIH0gPSBvcHRpb25zO1xuICAgIHRoaXMuI2NvbW1vbk9wdGlvbnMgPSB7XG4gICAgICBzb3VyY2VtYXAsXG4gICAgICB0aGlyZFBhcnR5U291cmNlbWFwcyxcbiAgICAgIGFkdmFuY2VkT3B0aW1pemF0aW9ucyxcbiAgICAgIGppdCxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFBlcmZvcm1zIEphdmFTY3JpcHQgdHJhbnNmb3JtYXRpb25zIG9uIGEgZmlsZSBmcm9tIHRoZSBmaWxlc3lzdGVtLlxuICAgKiBJZiBubyB0cmFuc2Zvcm1hdGlvbnMgYXJlIHJlcXVpcmVkLCB0aGUgZGF0YSBmb3IgdGhlIG9yaWdpbmFsIGZpbGUgd2lsbCBiZSByZXR1cm5lZC5cbiAgICogQHBhcmFtIGZpbGVuYW1lIFRoZSBmdWxsIHBhdGggdG8gdGhlIGZpbGUuXG4gICAqIEBwYXJhbSBza2lwTGlua2VyIElmIHRydWUsIGJ5cGFzcyBhbGwgQW5ndWxhciBsaW5rZXIgcHJvY2Vzc2luZzsgaWYgZmFsc2UsIGF0dGVtcHQgbGlua2luZy5cbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYSBVVEYtOCBlbmNvZGVkIFVpbnQ4QXJyYXkgY29udGFpbmluZyB0aGUgcmVzdWx0LlxuICAgKi9cbiAgdHJhbnNmb3JtRmlsZShmaWxlbmFtZTogc3RyaW5nLCBza2lwTGlua2VyPzogYm9vbGVhbik6IFByb21pc2U8VWludDhBcnJheT4ge1xuICAgIC8vIEFsd2F5cyBzZW5kIHRoZSByZXF1ZXN0IHRvIGEgd29ya2VyLiBGaWxlcyBhcmUgYWxtb3N0IGFsd2F5cyBmcm9tIG5vZGUgbW9kdWxlcyB3aGljaCBtZWFzblxuICAgIC8vIHRoZXkgbWF5IG5lZWQgbGlua2luZy4gVGhlIGRhdGEgaXMgYWxzbyBub3QgeWV0IGF2YWlsYWJsZSB0byBwZXJmb3JtIG1vc3QgdHJhbnNmb3JtYXRpb24gY2hlY2tzLlxuICAgIHJldHVybiB0aGlzLiN3b3JrZXJQb29sLnJ1bih7XG4gICAgICBmaWxlbmFtZSxcbiAgICAgIHNraXBMaW5rZXIsXG4gICAgICAuLi50aGlzLiNjb21tb25PcHRpb25zLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBlcmZvcm1zIEphdmFTY3JpcHQgdHJhbnNmb3JtYXRpb25zIG9uIHRoZSBwcm92aWRlZCBkYXRhIG9mIGEgZmlsZS4gVGhlIGZpbGUgZG9lcyBub3QgbmVlZFxuICAgKiB0byBleGlzdCBvbiB0aGUgZmlsZXN5c3RlbS5cbiAgICogQHBhcmFtIGZpbGVuYW1lIFRoZSBmdWxsIHBhdGggb2YgdGhlIGZpbGUgcmVwcmVzZW50ZWQgYnkgdGhlIGRhdGEuXG4gICAqIEBwYXJhbSBkYXRhIFRoZSBkYXRhIG9mIHRoZSBmaWxlIHRoYXQgc2hvdWxkIGJlIHRyYW5zZm9ybWVkLlxuICAgKiBAcGFyYW0gc2tpcExpbmtlciBJZiB0cnVlLCBieXBhc3MgYWxsIEFuZ3VsYXIgbGlua2VyIHByb2Nlc3Npbmc7IGlmIGZhbHNlLCBhdHRlbXB0IGxpbmtpbmcuXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGEgVVRGLTggZW5jb2RlZCBVaW50OEFycmF5IGNvbnRhaW5pbmcgdGhlIHJlc3VsdC5cbiAgICovXG4gIGFzeW5jIHRyYW5zZm9ybURhdGEoZmlsZW5hbWU6IHN0cmluZywgZGF0YTogc3RyaW5nLCBza2lwTGlua2VyOiBib29sZWFuKTogUHJvbWlzZTxVaW50OEFycmF5PiB7XG4gICAgLy8gUGVyZm9ybSBhIHF1aWNrIHRlc3QgdG8gZGV0ZXJtaW5lIGlmIHRoZSBkYXRhIG5lZWRzIGFueSB0cmFuc2Zvcm1hdGlvbnMuXG4gICAgLy8gVGhpcyBhbGxvd3MgZGlyZWN0bHkgcmV0dXJuaW5nIHRoZSBkYXRhIHdpdGhvdXQgdGhlIHdvcmtlciBjb21tdW5pY2F0aW9uIG92ZXJoZWFkLlxuICAgIGxldCBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb247XG4gICAgaWYgKHNraXBMaW5rZXIgJiYgIXRoaXMuI2NvbW1vbk9wdGlvbnMuYWR2YW5jZWRPcHRpbWl6YXRpb25zKSB7XG4gICAgICAvLyBJZiB0aGUgbGlua2VyIGlzIGJlaW5nIHNraXBwZWQgYW5kIG5vIG9wdGltaXphdGlvbnMgYXJlIG5lZWRlZCwgb25seSBhc3luYyB0cmFuc2Zvcm1hdGlvbiBpcyBsZWZ0LlxuICAgICAgLy8gVGhpcyBjaGVja3MgZm9yIGFzeW5jIGdlbmVyYXRvciBmdW5jdGlvbnMgYW5kIGNsYXNzIG1ldGhvZHMuIEFsbCBvdGhlciBhc3luYyB0cmFuc2Zvcm1hdGlvbiBpcyBoYW5kbGVkIGJ5IGVzYnVpbGQuXG4gICAgICBmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24gPSBkYXRhLmluY2x1ZGVzKCdhc3luYycpICYmIC9hc3luYyg/OlxccytmdW5jdGlvbik/XFxzKlxcKi8udGVzdChkYXRhKTtcblxuICAgICAgaWYgKCFmb3JjZUFzeW5jVHJhbnNmb3JtYXRpb24pIHtcbiAgICAgICAgY29uc3Qga2VlcFNvdXJjZW1hcCA9XG4gICAgICAgICAgdGhpcy4jY29tbW9uT3B0aW9ucy5zb3VyY2VtYXAgJiZcbiAgICAgICAgICAoISF0aGlzLiNjb21tb25PcHRpb25zLnRoaXJkUGFydHlTb3VyY2VtYXBzIHx8ICEvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vLnRlc3QoZmlsZW5hbWUpKTtcblxuICAgICAgICByZXR1cm4gQnVmZmVyLmZyb20oXG4gICAgICAgICAga2VlcFNvdXJjZW1hcCA/IGRhdGEgOiBkYXRhLnJlcGxhY2UoL15cXC9cXC8jIHNvdXJjZU1hcHBpbmdVUkw9W15cXHJcXG5dKi9nbSwgJycpLFxuICAgICAgICAgICd1dGYtOCcsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuI3dvcmtlclBvb2wucnVuKHtcbiAgICAgIGZpbGVuYW1lLFxuICAgICAgZGF0YSxcbiAgICAgIC8vIFNlbmQgdGhlIGFzeW5jIGNoZWNrIHJlc3VsdCBpZiBwcmVzZW50IHRvIGF2b2lkIHJlY2hlY2tpbmcgaW4gdGhlIHdvcmtlclxuICAgICAgZm9yY2VBc3luY1RyYW5zZm9ybWF0aW9uLFxuICAgICAgc2tpcExpbmtlcixcbiAgICAgIC4uLnRoaXMuI2NvbW1vbk9wdGlvbnMsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU3RvcHMgYWxsIGFjdGl2ZSB0cmFuc2Zvcm1hdGlvbiB0YXNrcyBhbmQgc2h1dHMgZG93biBhbGwgd29ya2Vycy5cbiAgICogQHJldHVybnMgQSB2b2lkIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGNsb3NpbmcgaXMgY29tcGxldGUuXG4gICAqL1xuICBjbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy4jd29ya2VyUG9vbC5kZXN0cm95KCk7XG4gIH1cbn1cbiJdfQ==