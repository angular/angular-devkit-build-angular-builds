"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EsbuildExecutor = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
/**
 * Provides the ability to execute esbuild regardless of the current platform's support
 * for using the native variant of esbuild. The native variant will be preferred (assuming
 * the `alwaysUseWasm` constructor option is `false) due to its inherent performance advantages.
 * At first use of esbuild, a supportability test will be automatically performed and the
 * WASM-variant will be used if needed by the platform.
 */
class EsbuildExecutor {
    /**
     * Constructs an instance of the `EsbuildExecutor` class.
     *
     * @param alwaysUseWasm If true, the WASM-variant will be preferred and no support test will be
     * performed; if false (default), the native variant will be preferred.
     */
    constructor(alwaysUseWasm = false) {
        this.alwaysUseWasm = alwaysUseWasm;
        this.initialized = false;
        this.esbuildTransform = this.esbuildFormatMessages = () => {
            throw new Error('esbuild implementation missing');
        };
    }
    /**
     * Determines whether the native variant of esbuild can be used on the current platform.
     *
     * @returns True, if the native variant of esbuild is support; False, if the WASM variant is required.
     */
    static hasNativeSupport() {
        // Try to use native variant to ensure it is functional for the platform.
        // Spawning a separate esbuild check process is used to determine if the native
        // variant is viable. If check fails, the WASM variant is initialized instead.
        // Attempting to call one of the native esbuild functions is not a viable test
        // currently since esbuild spawn errors are currently not propagated through the
        // call stack for the esbuild function. If this limitation is removed in the future
        // then the separate process spawn check can be removed in favor of a direct function
        // call check.
        try {
            const { status, error } = (0, child_process_1.spawnSync)(process.execPath, [
                path.join(__dirname, '../../../esbuild-check.js'),
            ]);
            return status === 0 && error === undefined;
        }
        catch (_a) {
            return false;
        }
    }
    /**
     * Initializes the esbuild transform and format messages functions.
     *
     * @returns A promise that fulfills when esbuild has been loaded and available for use.
     */
    async ensureEsbuild() {
        if (this.initialized) {
            return;
        }
        // If the WASM variant was preferred at class construction or native is not supported, use WASM
        if (this.alwaysUseWasm || !EsbuildExecutor.hasNativeSupport()) {
            await this.useWasm();
            this.initialized = true;
            return;
        }
        try {
            // Use the faster native variant if available.
            const { transform, formatMessages } = await Promise.resolve().then(() => __importStar(require('esbuild')));
            this.esbuildTransform = transform;
            this.esbuildFormatMessages = formatMessages;
        }
        catch (_a) {
            // If the native variant is not installed then use the WASM-based variant
            await this.useWasm();
        }
        this.initialized = true;
    }
    /**
     * Transitions an executor instance to use the WASM-variant of esbuild.
     */
    async useWasm() {
        const { transform, formatMessages } = await Promise.resolve().then(() => __importStar(require('esbuild-wasm')));
        this.esbuildTransform = transform;
        this.esbuildFormatMessages = formatMessages;
        // The ESBUILD_BINARY_PATH environment variable cannot exist when attempting to use the
        // WASM variant. If it is then the binary located at the specified path will be used instead
        // of the WASM variant.
        delete process.env.ESBUILD_BINARY_PATH;
        this.alwaysUseWasm = true;
    }
    async transform(input, options) {
        await this.ensureEsbuild();
        return this.esbuildTransform(input, options);
    }
    async formatMessages(messages, options) {
        await this.ensureEsbuild();
        return this.esbuildFormatMessages(messages, options);
    }
}
exports.EsbuildExecutor = EsbuildExecutor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNidWlsZC1leGVjdXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy9lc2J1aWxkLWV4ZWN1dG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQTBDO0FBTzFDLDJDQUE2QjtBQUU3Qjs7Ozs7O0dBTUc7QUFDSCxNQUFhLGVBQWU7SUFPMUI7Ozs7O09BS0c7SUFDSCxZQUFvQixnQkFBZ0IsS0FBSztRQUFyQixrQkFBYSxHQUFiLGFBQWEsQ0FBUTtRQVJqQyxnQkFBVyxHQUFHLEtBQUssQ0FBQztRQVMxQixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixHQUFHLEdBQUcsRUFBRTtZQUN4RCxNQUFNLElBQUksS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7UUFDcEQsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxNQUFNLENBQUMsZ0JBQWdCO1FBQ3JCLHlFQUF5RTtRQUN6RSwrRUFBK0U7UUFDL0UsOEVBQThFO1FBQzlFLDhFQUE4RTtRQUM5RSxnRkFBZ0Y7UUFDaEYsbUZBQW1GO1FBQ25GLHFGQUFxRjtRQUNyRixjQUFjO1FBQ2QsSUFBSTtZQUNGLE1BQU0sRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsSUFBQSx5QkFBUyxFQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUU7Z0JBQ3BELElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLDJCQUEyQixDQUFDO2FBQ2xELENBQUMsQ0FBQztZQUVILE9BQU8sTUFBTSxLQUFLLENBQUMsSUFBSSxLQUFLLEtBQUssU0FBUyxDQUFDO1NBQzVDO1FBQUMsV0FBTTtZQUNOLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7SUFDSCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNLLEtBQUssQ0FBQyxhQUFhO1FBQ3pCLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUNwQixPQUFPO1NBQ1I7UUFFRCwrRkFBK0Y7UUFDL0YsSUFBSSxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsZUFBZSxDQUFDLGdCQUFnQixFQUFFLEVBQUU7WUFDN0QsTUFBTSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDckIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7WUFFeEIsT0FBTztTQUNSO1FBRUQsSUFBSTtZQUNGLDhDQUE4QztZQUM5QyxNQUFNLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxHQUFHLHdEQUFhLFNBQVMsR0FBQyxDQUFDO1lBRTlELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxTQUFTLENBQUM7WUFDbEMsSUFBSSxDQUFDLHFCQUFxQixHQUFHLGNBQWMsQ0FBQztTQUM3QztRQUFDLFdBQU07WUFDTix5RUFBeUU7WUFDekUsTUFBTSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7U0FDdEI7UUFFRCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztJQUMxQixDQUFDO0lBRUQ7O09BRUc7SUFDSyxLQUFLLENBQUMsT0FBTztRQUNuQixNQUFNLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxHQUFHLHdEQUFhLGNBQWMsR0FBQyxDQUFDO1FBQ25FLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxTQUFTLENBQUM7UUFDbEMsSUFBSSxDQUFDLHFCQUFxQixHQUFHLGNBQWMsQ0FBQztRQUU1Qyx1RkFBdUY7UUFDdkYsNEZBQTRGO1FBQzVGLHVCQUF1QjtRQUN2QixPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUM7UUFFdkMsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUM7SUFDNUIsQ0FBQztJQUVELEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBYSxFQUFFLE9BQTBCO1FBQ3ZELE1BQU0sSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBRTNCLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRUQsS0FBSyxDQUFDLGNBQWMsQ0FDbEIsUUFBMEIsRUFDMUIsT0FBOEI7UUFFOUIsTUFBTSxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7UUFFM0IsT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3ZELENBQUM7Q0FDRjtBQTFHRCwwQ0EwR0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgc3Bhd25TeW5jIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgdHlwZSB7XG4gIEZvcm1hdE1lc3NhZ2VzT3B0aW9ucyxcbiAgUGFydGlhbE1lc3NhZ2UsXG4gIFRyYW5zZm9ybU9wdGlvbnMsXG4gIFRyYW5zZm9ybVJlc3VsdCxcbn0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG4vKipcbiAqIFByb3ZpZGVzIHRoZSBhYmlsaXR5IHRvIGV4ZWN1dGUgZXNidWlsZCByZWdhcmRsZXNzIG9mIHRoZSBjdXJyZW50IHBsYXRmb3JtJ3Mgc3VwcG9ydFxuICogZm9yIHVzaW5nIHRoZSBuYXRpdmUgdmFyaWFudCBvZiBlc2J1aWxkLiBUaGUgbmF0aXZlIHZhcmlhbnQgd2lsbCBiZSBwcmVmZXJyZWQgKGFzc3VtaW5nXG4gKiB0aGUgYGFsd2F5c1VzZVdhc21gIGNvbnN0cnVjdG9yIG9wdGlvbiBpcyBgZmFsc2UpIGR1ZSB0byBpdHMgaW5oZXJlbnQgcGVyZm9ybWFuY2UgYWR2YW50YWdlcy5cbiAqIEF0IGZpcnN0IHVzZSBvZiBlc2J1aWxkLCBhIHN1cHBvcnRhYmlsaXR5IHRlc3Qgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IHBlcmZvcm1lZCBhbmQgdGhlXG4gKiBXQVNNLXZhcmlhbnQgd2lsbCBiZSB1c2VkIGlmIG5lZWRlZCBieSB0aGUgcGxhdGZvcm0uXG4gKi9cbmV4cG9ydCBjbGFzcyBFc2J1aWxkRXhlY3V0b3JcbiAgaW1wbGVtZW50cyBQaWNrPHR5cGVvZiBpbXBvcnQoJ2VzYnVpbGQnKSwgJ3RyYW5zZm9ybScgfCAnZm9ybWF0TWVzc2FnZXMnPlxue1xuICBwcml2YXRlIGVzYnVpbGRUcmFuc2Zvcm06IHRoaXNbJ3RyYW5zZm9ybSddO1xuICBwcml2YXRlIGVzYnVpbGRGb3JtYXRNZXNzYWdlczogdGhpc1snZm9ybWF0TWVzc2FnZXMnXTtcbiAgcHJpdmF0ZSBpbml0aWFsaXplZCA9IGZhbHNlO1xuXG4gIC8qKlxuICAgKiBDb25zdHJ1Y3RzIGFuIGluc3RhbmNlIG9mIHRoZSBgRXNidWlsZEV4ZWN1dG9yYCBjbGFzcy5cbiAgICpcbiAgICogQHBhcmFtIGFsd2F5c1VzZVdhc20gSWYgdHJ1ZSwgdGhlIFdBU00tdmFyaWFudCB3aWxsIGJlIHByZWZlcnJlZCBhbmQgbm8gc3VwcG9ydCB0ZXN0IHdpbGwgYmVcbiAgICogcGVyZm9ybWVkOyBpZiBmYWxzZSAoZGVmYXVsdCksIHRoZSBuYXRpdmUgdmFyaWFudCB3aWxsIGJlIHByZWZlcnJlZC5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYWx3YXlzVXNlV2FzbSA9IGZhbHNlKSB7XG4gICAgdGhpcy5lc2J1aWxkVHJhbnNmb3JtID0gdGhpcy5lc2J1aWxkRm9ybWF0TWVzc2FnZXMgPSAoKSA9PiB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2VzYnVpbGQgaW1wbGVtZW50YXRpb24gbWlzc2luZycpO1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRGV0ZXJtaW5lcyB3aGV0aGVyIHRoZSBuYXRpdmUgdmFyaWFudCBvZiBlc2J1aWxkIGNhbiBiZSB1c2VkIG9uIHRoZSBjdXJyZW50IHBsYXRmb3JtLlxuICAgKlxuICAgKiBAcmV0dXJucyBUcnVlLCBpZiB0aGUgbmF0aXZlIHZhcmlhbnQgb2YgZXNidWlsZCBpcyBzdXBwb3J0OyBGYWxzZSwgaWYgdGhlIFdBU00gdmFyaWFudCBpcyByZXF1aXJlZC5cbiAgICovXG4gIHN0YXRpYyBoYXNOYXRpdmVTdXBwb3J0KCk6IGJvb2xlYW4ge1xuICAgIC8vIFRyeSB0byB1c2UgbmF0aXZlIHZhcmlhbnQgdG8gZW5zdXJlIGl0IGlzIGZ1bmN0aW9uYWwgZm9yIHRoZSBwbGF0Zm9ybS5cbiAgICAvLyBTcGF3bmluZyBhIHNlcGFyYXRlIGVzYnVpbGQgY2hlY2sgcHJvY2VzcyBpcyB1c2VkIHRvIGRldGVybWluZSBpZiB0aGUgbmF0aXZlXG4gICAgLy8gdmFyaWFudCBpcyB2aWFibGUuIElmIGNoZWNrIGZhaWxzLCB0aGUgV0FTTSB2YXJpYW50IGlzIGluaXRpYWxpemVkIGluc3RlYWQuXG4gICAgLy8gQXR0ZW1wdGluZyB0byBjYWxsIG9uZSBvZiB0aGUgbmF0aXZlIGVzYnVpbGQgZnVuY3Rpb25zIGlzIG5vdCBhIHZpYWJsZSB0ZXN0XG4gICAgLy8gY3VycmVudGx5IHNpbmNlIGVzYnVpbGQgc3Bhd24gZXJyb3JzIGFyZSBjdXJyZW50bHkgbm90IHByb3BhZ2F0ZWQgdGhyb3VnaCB0aGVcbiAgICAvLyBjYWxsIHN0YWNrIGZvciB0aGUgZXNidWlsZCBmdW5jdGlvbi4gSWYgdGhpcyBsaW1pdGF0aW9uIGlzIHJlbW92ZWQgaW4gdGhlIGZ1dHVyZVxuICAgIC8vIHRoZW4gdGhlIHNlcGFyYXRlIHByb2Nlc3Mgc3Bhd24gY2hlY2sgY2FuIGJlIHJlbW92ZWQgaW4gZmF2b3Igb2YgYSBkaXJlY3QgZnVuY3Rpb25cbiAgICAvLyBjYWxsIGNoZWNrLlxuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IHN0YXR1cywgZXJyb3IgfSA9IHNwYXduU3luYyhwcm9jZXNzLmV4ZWNQYXRoLCBbXG4gICAgICAgIHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi9lc2J1aWxkLWNoZWNrLmpzJyksXG4gICAgICBdKTtcblxuICAgICAgcmV0dXJuIHN0YXR1cyA9PT0gMCAmJiBlcnJvciA9PT0gdW5kZWZpbmVkO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplcyB0aGUgZXNidWlsZCB0cmFuc2Zvcm0gYW5kIGZvcm1hdCBtZXNzYWdlcyBmdW5jdGlvbnMuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IGZ1bGZpbGxzIHdoZW4gZXNidWlsZCBoYXMgYmVlbiBsb2FkZWQgYW5kIGF2YWlsYWJsZSBmb3IgdXNlLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBlbnN1cmVFc2J1aWxkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLmluaXRpYWxpemVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIFdBU00gdmFyaWFudCB3YXMgcHJlZmVycmVkIGF0IGNsYXNzIGNvbnN0cnVjdGlvbiBvciBuYXRpdmUgaXMgbm90IHN1cHBvcnRlZCwgdXNlIFdBU01cbiAgICBpZiAodGhpcy5hbHdheXNVc2VXYXNtIHx8ICFFc2J1aWxkRXhlY3V0b3IuaGFzTmF0aXZlU3VwcG9ydCgpKSB7XG4gICAgICBhd2FpdCB0aGlzLnVzZVdhc20oKTtcbiAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFVzZSB0aGUgZmFzdGVyIG5hdGl2ZSB2YXJpYW50IGlmIGF2YWlsYWJsZS5cbiAgICAgIGNvbnN0IHsgdHJhbnNmb3JtLCBmb3JtYXRNZXNzYWdlcyB9ID0gYXdhaXQgaW1wb3J0KCdlc2J1aWxkJyk7XG5cbiAgICAgIHRoaXMuZXNidWlsZFRyYW5zZm9ybSA9IHRyYW5zZm9ybTtcbiAgICAgIHRoaXMuZXNidWlsZEZvcm1hdE1lc3NhZ2VzID0gZm9ybWF0TWVzc2FnZXM7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBJZiB0aGUgbmF0aXZlIHZhcmlhbnQgaXMgbm90IGluc3RhbGxlZCB0aGVuIHVzZSB0aGUgV0FTTS1iYXNlZCB2YXJpYW50XG4gICAgICBhd2FpdCB0aGlzLnVzZVdhc20oKTtcbiAgICB9XG5cbiAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcmFuc2l0aW9ucyBhbiBleGVjdXRvciBpbnN0YW5jZSB0byB1c2UgdGhlIFdBU00tdmFyaWFudCBvZiBlc2J1aWxkLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyB1c2VXYXNtKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgdHJhbnNmb3JtLCBmb3JtYXRNZXNzYWdlcyB9ID0gYXdhaXQgaW1wb3J0KCdlc2J1aWxkLXdhc20nKTtcbiAgICB0aGlzLmVzYnVpbGRUcmFuc2Zvcm0gPSB0cmFuc2Zvcm07XG4gICAgdGhpcy5lc2J1aWxkRm9ybWF0TWVzc2FnZXMgPSBmb3JtYXRNZXNzYWdlcztcblxuICAgIC8vIFRoZSBFU0JVSUxEX0JJTkFSWV9QQVRIIGVudmlyb25tZW50IHZhcmlhYmxlIGNhbm5vdCBleGlzdCB3aGVuIGF0dGVtcHRpbmcgdG8gdXNlIHRoZVxuICAgIC8vIFdBU00gdmFyaWFudC4gSWYgaXQgaXMgdGhlbiB0aGUgYmluYXJ5IGxvY2F0ZWQgYXQgdGhlIHNwZWNpZmllZCBwYXRoIHdpbGwgYmUgdXNlZCBpbnN0ZWFkXG4gICAgLy8gb2YgdGhlIFdBU00gdmFyaWFudC5cbiAgICBkZWxldGUgcHJvY2Vzcy5lbnYuRVNCVUlMRF9CSU5BUllfUEFUSDtcblxuICAgIHRoaXMuYWx3YXlzVXNlV2FzbSA9IHRydWU7XG4gIH1cblxuICBhc3luYyB0cmFuc2Zvcm0oaW5wdXQ6IHN0cmluZywgb3B0aW9ucz86IFRyYW5zZm9ybU9wdGlvbnMpOiBQcm9taXNlPFRyYW5zZm9ybVJlc3VsdD4ge1xuICAgIGF3YWl0IHRoaXMuZW5zdXJlRXNidWlsZCgpO1xuXG4gICAgcmV0dXJuIHRoaXMuZXNidWlsZFRyYW5zZm9ybShpbnB1dCwgb3B0aW9ucyk7XG4gIH1cblxuICBhc3luYyBmb3JtYXRNZXNzYWdlcyhcbiAgICBtZXNzYWdlczogUGFydGlhbE1lc3NhZ2VbXSxcbiAgICBvcHRpb25zOiBGb3JtYXRNZXNzYWdlc09wdGlvbnMsXG4gICk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBhd2FpdCB0aGlzLmVuc3VyZUVzYnVpbGQoKTtcblxuICAgIHJldHVybiB0aGlzLmVzYnVpbGRGb3JtYXRNZXNzYWdlcyhtZXNzYWdlcywgb3B0aW9ucyk7XG4gIH1cbn1cbiJdfQ==