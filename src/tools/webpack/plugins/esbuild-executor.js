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
/**
 * Provides the ability to execute esbuild regardless of the current platform's support
 * for using the native variant of esbuild. The native variant will be preferred (assuming
 * the `alwaysUseWasm` constructor option is `false) due to its inherent performance advantages.
 * At first use of esbuild, a supportability test will be automatically performed and the
 * WASM-variant will be used if needed by the platform.
 */
class EsbuildExecutor {
    alwaysUseWasm;
    esbuildTransform;
    esbuildFormatMessages;
    initialized = false;
    /**
     * Constructs an instance of the `EsbuildExecutor` class.
     *
     * @param alwaysUseWasm If true, the WASM-variant will be preferred and no support test will be
     * performed; if false (default), the native variant will be preferred.
     */
    constructor(alwaysUseWasm = false) {
        this.alwaysUseWasm = alwaysUseWasm;
        this.esbuildTransform = this.esbuildFormatMessages = () => {
            throw new Error('esbuild implementation missing');
        };
    }
    /**
     * Determines whether the native variant of esbuild can be used on the current platform.
     *
     * @returns A promise which resolves to `true`, if the native variant of esbuild is support or `false`, if the WASM variant is required.
     */
    static async hasNativeSupport() {
        // Try to use native variant to ensure it is functional for the platform.
        try {
            const { formatMessages } = await Promise.resolve().then(() => __importStar(require('esbuild')));
            await formatMessages([], { kind: 'error' });
            return true;
        }
        catch {
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
        if (this.alwaysUseWasm || !(await EsbuildExecutor.hasNativeSupport())) {
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
        catch {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNidWlsZC1leGVjdXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL3dlYnBhY2svcGx1Z2lucy9lc2J1aWxkLWV4ZWN1dG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBU0g7Ozs7OztHQU1HO0FBQ0gsTUFBYSxlQUFlO0lBYU47SUFWWixnQkFBZ0IsQ0FBb0I7SUFDcEMscUJBQXFCLENBQXlCO0lBQzlDLFdBQVcsR0FBRyxLQUFLLENBQUM7SUFFNUI7Ozs7O09BS0c7SUFDSCxZQUFvQixnQkFBZ0IsS0FBSztRQUFyQixrQkFBYSxHQUFiLGFBQWEsQ0FBUTtRQUN2QyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixHQUFHLEdBQUcsRUFBRTtZQUN4RCxNQUFNLElBQUksS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7UUFDcEQsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxNQUFNLENBQUMsS0FBSyxDQUFDLGdCQUFnQjtRQUMzQix5RUFBeUU7UUFDekUsSUFBSTtZQUNGLE1BQU0sRUFBRSxjQUFjLEVBQUUsR0FBRyx3REFBYSxTQUFTLEdBQUMsQ0FBQztZQUNuRCxNQUFNLGNBQWMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUU1QyxPQUFPLElBQUksQ0FBQztTQUNiO1FBQUMsTUFBTTtZQUNOLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7SUFDSCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNLLEtBQUssQ0FBQyxhQUFhO1FBQ3pCLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUNwQixPQUFPO1NBQ1I7UUFFRCwrRkFBK0Y7UUFDL0YsSUFBSSxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsQ0FBQyxNQUFNLGVBQWUsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLEVBQUU7WUFDckUsTUFBTSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDckIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7WUFFeEIsT0FBTztTQUNSO1FBRUQsSUFBSTtZQUNGLDhDQUE4QztZQUM5QyxNQUFNLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxHQUFHLHdEQUFhLFNBQVMsR0FBQyxDQUFDO1lBRTlELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxTQUFTLENBQUM7WUFDbEMsSUFBSSxDQUFDLHFCQUFxQixHQUFHLGNBQWMsQ0FBQztTQUM3QztRQUFDLE1BQU07WUFDTix5RUFBeUU7WUFDekUsTUFBTSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7U0FDdEI7UUFFRCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztJQUMxQixDQUFDO0lBRUQ7O09BRUc7SUFDSyxLQUFLLENBQUMsT0FBTztRQUNuQixNQUFNLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxHQUFHLHdEQUFhLGNBQWMsR0FBQyxDQUFDO1FBQ25FLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxTQUFTLENBQUM7UUFDbEMsSUFBSSxDQUFDLHFCQUFxQixHQUFHLGNBQWMsQ0FBQztRQUU1Qyx1RkFBdUY7UUFDdkYsNEZBQTRGO1FBQzVGLHVCQUF1QjtRQUN2QixPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUM7UUFFdkMsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUM7SUFDNUIsQ0FBQztJQUVELEtBQUssQ0FBQyxTQUFTLENBQ2IsS0FBMEIsRUFDMUIsT0FBMEI7UUFFMUIsTUFBTSxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7UUFFM0IsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFFRCxLQUFLLENBQUMsY0FBYyxDQUNsQixRQUEwQixFQUMxQixPQUE4QjtRQUU5QixNQUFNLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUUzQixPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdkQsQ0FBQztDQUNGO0FBckdELDBDQXFHQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIEZvcm1hdE1lc3NhZ2VzT3B0aW9ucyxcbiAgUGFydGlhbE1lc3NhZ2UsXG4gIFRyYW5zZm9ybU9wdGlvbnMsXG4gIFRyYW5zZm9ybVJlc3VsdCxcbn0gZnJvbSAnZXNidWlsZCc7XG5cbi8qKlxuICogUHJvdmlkZXMgdGhlIGFiaWxpdHkgdG8gZXhlY3V0ZSBlc2J1aWxkIHJlZ2FyZGxlc3Mgb2YgdGhlIGN1cnJlbnQgcGxhdGZvcm0ncyBzdXBwb3J0XG4gKiBmb3IgdXNpbmcgdGhlIG5hdGl2ZSB2YXJpYW50IG9mIGVzYnVpbGQuIFRoZSBuYXRpdmUgdmFyaWFudCB3aWxsIGJlIHByZWZlcnJlZCAoYXNzdW1pbmdcbiAqIHRoZSBgYWx3YXlzVXNlV2FzbWAgY29uc3RydWN0b3Igb3B0aW9uIGlzIGBmYWxzZSkgZHVlIHRvIGl0cyBpbmhlcmVudCBwZXJmb3JtYW5jZSBhZHZhbnRhZ2VzLlxuICogQXQgZmlyc3QgdXNlIG9mIGVzYnVpbGQsIGEgc3VwcG9ydGFiaWxpdHkgdGVzdCB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgcGVyZm9ybWVkIGFuZCB0aGVcbiAqIFdBU00tdmFyaWFudCB3aWxsIGJlIHVzZWQgaWYgbmVlZGVkIGJ5IHRoZSBwbGF0Zm9ybS5cbiAqL1xuZXhwb3J0IGNsYXNzIEVzYnVpbGRFeGVjdXRvclxuICBpbXBsZW1lbnRzIFBpY2s8dHlwZW9mIGltcG9ydCgnZXNidWlsZCcpLCAndHJhbnNmb3JtJyB8ICdmb3JtYXRNZXNzYWdlcyc+XG57XG4gIHByaXZhdGUgZXNidWlsZFRyYW5zZm9ybTogdGhpc1sndHJhbnNmb3JtJ107XG4gIHByaXZhdGUgZXNidWlsZEZvcm1hdE1lc3NhZ2VzOiB0aGlzWydmb3JtYXRNZXNzYWdlcyddO1xuICBwcml2YXRlIGluaXRpYWxpemVkID0gZmFsc2U7XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdHMgYW4gaW5zdGFuY2Ugb2YgdGhlIGBFc2J1aWxkRXhlY3V0b3JgIGNsYXNzLlxuICAgKlxuICAgKiBAcGFyYW0gYWx3YXlzVXNlV2FzbSBJZiB0cnVlLCB0aGUgV0FTTS12YXJpYW50IHdpbGwgYmUgcHJlZmVycmVkIGFuZCBubyBzdXBwb3J0IHRlc3Qgd2lsbCBiZVxuICAgKiBwZXJmb3JtZWQ7IGlmIGZhbHNlIChkZWZhdWx0KSwgdGhlIG5hdGl2ZSB2YXJpYW50IHdpbGwgYmUgcHJlZmVycmVkLlxuICAgKi9cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBhbHdheXNVc2VXYXNtID0gZmFsc2UpIHtcbiAgICB0aGlzLmVzYnVpbGRUcmFuc2Zvcm0gPSB0aGlzLmVzYnVpbGRGb3JtYXRNZXNzYWdlcyA9ICgpID0+IHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignZXNidWlsZCBpbXBsZW1lbnRhdGlvbiBtaXNzaW5nJyk7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXRlcm1pbmVzIHdoZXRoZXIgdGhlIG5hdGl2ZSB2YXJpYW50IG9mIGVzYnVpbGQgY2FuIGJlIHVzZWQgb24gdGhlIGN1cnJlbnQgcGxhdGZvcm0uXG4gICAqXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB3aGljaCByZXNvbHZlcyB0byBgdHJ1ZWAsIGlmIHRoZSBuYXRpdmUgdmFyaWFudCBvZiBlc2J1aWxkIGlzIHN1cHBvcnQgb3IgYGZhbHNlYCwgaWYgdGhlIFdBU00gdmFyaWFudCBpcyByZXF1aXJlZC5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBoYXNOYXRpdmVTdXBwb3J0KCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIC8vIFRyeSB0byB1c2UgbmF0aXZlIHZhcmlhbnQgdG8gZW5zdXJlIGl0IGlzIGZ1bmN0aW9uYWwgZm9yIHRoZSBwbGF0Zm9ybS5cbiAgICB0cnkge1xuICAgICAgY29uc3QgeyBmb3JtYXRNZXNzYWdlcyB9ID0gYXdhaXQgaW1wb3J0KCdlc2J1aWxkJyk7XG4gICAgICBhd2FpdCBmb3JtYXRNZXNzYWdlcyhbXSwgeyBraW5kOiAnZXJyb3InIH0pO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW5pdGlhbGl6ZXMgdGhlIGVzYnVpbGQgdHJhbnNmb3JtIGFuZCBmb3JtYXQgbWVzc2FnZXMgZnVuY3Rpb25zLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIHByb21pc2UgdGhhdCBmdWxmaWxscyB3aGVuIGVzYnVpbGQgaGFzIGJlZW4gbG9hZGVkIGFuZCBhdmFpbGFibGUgZm9yIHVzZS5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZW5zdXJlRXNidWlsZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy5pbml0aWFsaXplZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIElmIHRoZSBXQVNNIHZhcmlhbnQgd2FzIHByZWZlcnJlZCBhdCBjbGFzcyBjb25zdHJ1Y3Rpb24gb3IgbmF0aXZlIGlzIG5vdCBzdXBwb3J0ZWQsIHVzZSBXQVNNXG4gICAgaWYgKHRoaXMuYWx3YXlzVXNlV2FzbSB8fCAhKGF3YWl0IEVzYnVpbGRFeGVjdXRvci5oYXNOYXRpdmVTdXBwb3J0KCkpKSB7XG4gICAgICBhd2FpdCB0aGlzLnVzZVdhc20oKTtcbiAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFVzZSB0aGUgZmFzdGVyIG5hdGl2ZSB2YXJpYW50IGlmIGF2YWlsYWJsZS5cbiAgICAgIGNvbnN0IHsgdHJhbnNmb3JtLCBmb3JtYXRNZXNzYWdlcyB9ID0gYXdhaXQgaW1wb3J0KCdlc2J1aWxkJyk7XG5cbiAgICAgIHRoaXMuZXNidWlsZFRyYW5zZm9ybSA9IHRyYW5zZm9ybTtcbiAgICAgIHRoaXMuZXNidWlsZEZvcm1hdE1lc3NhZ2VzID0gZm9ybWF0TWVzc2FnZXM7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBJZiB0aGUgbmF0aXZlIHZhcmlhbnQgaXMgbm90IGluc3RhbGxlZCB0aGVuIHVzZSB0aGUgV0FTTS1iYXNlZCB2YXJpYW50XG4gICAgICBhd2FpdCB0aGlzLnVzZVdhc20oKTtcbiAgICB9XG5cbiAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcmFuc2l0aW9ucyBhbiBleGVjdXRvciBpbnN0YW5jZSB0byB1c2UgdGhlIFdBU00tdmFyaWFudCBvZiBlc2J1aWxkLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyB1c2VXYXNtKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgdHJhbnNmb3JtLCBmb3JtYXRNZXNzYWdlcyB9ID0gYXdhaXQgaW1wb3J0KCdlc2J1aWxkLXdhc20nKTtcbiAgICB0aGlzLmVzYnVpbGRUcmFuc2Zvcm0gPSB0cmFuc2Zvcm07XG4gICAgdGhpcy5lc2J1aWxkRm9ybWF0TWVzc2FnZXMgPSBmb3JtYXRNZXNzYWdlcztcblxuICAgIC8vIFRoZSBFU0JVSUxEX0JJTkFSWV9QQVRIIGVudmlyb25tZW50IHZhcmlhYmxlIGNhbm5vdCBleGlzdCB3aGVuIGF0dGVtcHRpbmcgdG8gdXNlIHRoZVxuICAgIC8vIFdBU00gdmFyaWFudC4gSWYgaXQgaXMgdGhlbiB0aGUgYmluYXJ5IGxvY2F0ZWQgYXQgdGhlIHNwZWNpZmllZCBwYXRoIHdpbGwgYmUgdXNlZCBpbnN0ZWFkXG4gICAgLy8gb2YgdGhlIFdBU00gdmFyaWFudC5cbiAgICBkZWxldGUgcHJvY2Vzcy5lbnYuRVNCVUlMRF9CSU5BUllfUEFUSDtcblxuICAgIHRoaXMuYWx3YXlzVXNlV2FzbSA9IHRydWU7XG4gIH1cblxuICBhc3luYyB0cmFuc2Zvcm0oXG4gICAgaW5wdXQ6IHN0cmluZyB8IFVpbnQ4QXJyYXksXG4gICAgb3B0aW9ucz86IFRyYW5zZm9ybU9wdGlvbnMsXG4gICk6IFByb21pc2U8VHJhbnNmb3JtUmVzdWx0PiB7XG4gICAgYXdhaXQgdGhpcy5lbnN1cmVFc2J1aWxkKCk7XG5cbiAgICByZXR1cm4gdGhpcy5lc2J1aWxkVHJhbnNmb3JtKGlucHV0LCBvcHRpb25zKTtcbiAgfVxuXG4gIGFzeW5jIGZvcm1hdE1lc3NhZ2VzKFxuICAgIG1lc3NhZ2VzOiBQYXJ0aWFsTWVzc2FnZVtdLFxuICAgIG9wdGlvbnM6IEZvcm1hdE1lc3NhZ2VzT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGF3YWl0IHRoaXMuZW5zdXJlRXNidWlsZCgpO1xuXG4gICAgcmV0dXJuIHRoaXMuZXNidWlsZEZvcm1hdE1lc3NhZ2VzKG1lc3NhZ2VzLCBvcHRpb25zKTtcbiAgfVxufVxuIl19