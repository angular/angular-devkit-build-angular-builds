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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNidWlsZC1leGVjdXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy9lc2J1aWxkLWV4ZWN1dG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBMEM7QUFPMUMsMkNBQTZCO0FBRTdCOzs7Ozs7R0FNRztBQUNILE1BQWEsZUFBZTtJQU8xQjs7Ozs7T0FLRztJQUNILFlBQW9CLGdCQUFnQixLQUFLO1FBQXJCLGtCQUFhLEdBQWIsYUFBYSxDQUFRO1FBUmpDLGdCQUFXLEdBQUcsS0FBSyxDQUFDO1FBUzFCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMscUJBQXFCLEdBQUcsR0FBRyxFQUFFO1lBQ3hELE1BQU0sSUFBSSxLQUFLLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztRQUNwRCxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILE1BQU0sQ0FBQyxnQkFBZ0I7UUFDckIseUVBQXlFO1FBQ3pFLCtFQUErRTtRQUMvRSw4RUFBOEU7UUFDOUUsOEVBQThFO1FBQzlFLGdGQUFnRjtRQUNoRixtRkFBbUY7UUFDbkYscUZBQXFGO1FBQ3JGLGNBQWM7UUFDZCxJQUFJO1lBQ0YsTUFBTSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxJQUFBLHlCQUFTLEVBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRTtnQkFDcEQsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsMkJBQTJCLENBQUM7YUFDbEQsQ0FBQyxDQUFDO1lBRUgsT0FBTyxNQUFNLEtBQUssQ0FBQyxJQUFJLEtBQUssS0FBSyxTQUFTLENBQUM7U0FDNUM7UUFBQyxXQUFNO1lBQ04sT0FBTyxLQUFLLENBQUM7U0FDZDtJQUNILENBQUM7SUFFRDs7OztPQUlHO0lBQ0ssS0FBSyxDQUFDLGFBQWE7UUFDekIsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ3BCLE9BQU87U0FDUjtRQUVELCtGQUErRjtRQUMvRixJQUFJLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxlQUFlLENBQUMsZ0JBQWdCLEVBQUUsRUFBRTtZQUM3RCxNQUFNLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNyQixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztZQUV4QixPQUFPO1NBQ1I7UUFFRCxJQUFJO1lBQ0YsOENBQThDO1lBQzlDLE1BQU0sRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFFLEdBQUcsd0RBQWEsU0FBUyxHQUFDLENBQUM7WUFFOUQsSUFBSSxDQUFDLGdCQUFnQixHQUFHLFNBQVMsQ0FBQztZQUNsQyxJQUFJLENBQUMscUJBQXFCLEdBQUcsY0FBYyxDQUFDO1NBQzdDO1FBQUMsV0FBTTtZQUNOLHlFQUF5RTtZQUN6RSxNQUFNLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztTQUN0QjtRQUVELElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO0lBQzFCLENBQUM7SUFFRDs7T0FFRztJQUNLLEtBQUssQ0FBQyxPQUFPO1FBQ25CLE1BQU0sRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFFLEdBQUcsd0RBQWEsY0FBYyxHQUFDLENBQUM7UUFDbkUsSUFBSSxDQUFDLGdCQUFnQixHQUFHLFNBQVMsQ0FBQztRQUNsQyxJQUFJLENBQUMscUJBQXFCLEdBQUcsY0FBYyxDQUFDO1FBRTVDLHVGQUF1RjtRQUN2Riw0RkFBNEY7UUFDNUYsdUJBQXVCO1FBQ3ZCLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQztRQUV2QyxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztJQUM1QixDQUFDO0lBRUQsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFhLEVBQUUsT0FBMEI7UUFDdkQsTUFBTSxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7UUFFM0IsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFFRCxLQUFLLENBQUMsY0FBYyxDQUNsQixRQUEwQixFQUMxQixPQUE4QjtRQUU5QixNQUFNLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUUzQixPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdkQsQ0FBQztDQUNGO0FBMUdELDBDQTBHQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBzcGF3blN5bmMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB0eXBlIHtcbiAgRm9ybWF0TWVzc2FnZXNPcHRpb25zLFxuICBQYXJ0aWFsTWVzc2FnZSxcbiAgVHJhbnNmb3JtT3B0aW9ucyxcbiAgVHJhbnNmb3JtUmVzdWx0LFxufSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbi8qKlxuICogUHJvdmlkZXMgdGhlIGFiaWxpdHkgdG8gZXhlY3V0ZSBlc2J1aWxkIHJlZ2FyZGxlc3Mgb2YgdGhlIGN1cnJlbnQgcGxhdGZvcm0ncyBzdXBwb3J0XG4gKiBmb3IgdXNpbmcgdGhlIG5hdGl2ZSB2YXJpYW50IG9mIGVzYnVpbGQuIFRoZSBuYXRpdmUgdmFyaWFudCB3aWxsIGJlIHByZWZlcnJlZCAoYXNzdW1pbmdcbiAqIHRoZSBgYWx3YXlzVXNlV2FzbWAgY29uc3RydWN0b3Igb3B0aW9uIGlzIGBmYWxzZSkgZHVlIHRvIGl0cyBpbmhlcmVudCBwZXJmb3JtYW5jZSBhZHZhbnRhZ2VzLlxuICogQXQgZmlyc3QgdXNlIG9mIGVzYnVpbGQsIGEgc3VwcG9ydGFiaWxpdHkgdGVzdCB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgcGVyZm9ybWVkIGFuZCB0aGVcbiAqIFdBU00tdmFyaWFudCB3aWxsIGJlIHVzZWQgaWYgbmVlZGVkIGJ5IHRoZSBwbGF0Zm9ybS5cbiAqL1xuZXhwb3J0IGNsYXNzIEVzYnVpbGRFeGVjdXRvclxuICBpbXBsZW1lbnRzIFBpY2s8dHlwZW9mIGltcG9ydCgnZXNidWlsZCcpLCAndHJhbnNmb3JtJyB8ICdmb3JtYXRNZXNzYWdlcyc+XG57XG4gIHByaXZhdGUgZXNidWlsZFRyYW5zZm9ybTogdGhpc1sndHJhbnNmb3JtJ107XG4gIHByaXZhdGUgZXNidWlsZEZvcm1hdE1lc3NhZ2VzOiB0aGlzWydmb3JtYXRNZXNzYWdlcyddO1xuICBwcml2YXRlIGluaXRpYWxpemVkID0gZmFsc2U7XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdHMgYW4gaW5zdGFuY2Ugb2YgdGhlIGBFc2J1aWxkRXhlY3V0b3JgIGNsYXNzLlxuICAgKlxuICAgKiBAcGFyYW0gYWx3YXlzVXNlV2FzbSBJZiB0cnVlLCB0aGUgV0FTTS12YXJpYW50IHdpbGwgYmUgcHJlZmVycmVkIGFuZCBubyBzdXBwb3J0IHRlc3Qgd2lsbCBiZVxuICAgKiBwZXJmb3JtZWQ7IGlmIGZhbHNlIChkZWZhdWx0KSwgdGhlIG5hdGl2ZSB2YXJpYW50IHdpbGwgYmUgcHJlZmVycmVkLlxuICAgKi9cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBhbHdheXNVc2VXYXNtID0gZmFsc2UpIHtcbiAgICB0aGlzLmVzYnVpbGRUcmFuc2Zvcm0gPSB0aGlzLmVzYnVpbGRGb3JtYXRNZXNzYWdlcyA9ICgpID0+IHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignZXNidWlsZCBpbXBsZW1lbnRhdGlvbiBtaXNzaW5nJyk7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXRlcm1pbmVzIHdoZXRoZXIgdGhlIG5hdGl2ZSB2YXJpYW50IG9mIGVzYnVpbGQgY2FuIGJlIHVzZWQgb24gdGhlIGN1cnJlbnQgcGxhdGZvcm0uXG4gICAqXG4gICAqIEByZXR1cm5zIFRydWUsIGlmIHRoZSBuYXRpdmUgdmFyaWFudCBvZiBlc2J1aWxkIGlzIHN1cHBvcnQ7IEZhbHNlLCBpZiB0aGUgV0FTTSB2YXJpYW50IGlzIHJlcXVpcmVkLlxuICAgKi9cbiAgc3RhdGljIGhhc05hdGl2ZVN1cHBvcnQoKTogYm9vbGVhbiB7XG4gICAgLy8gVHJ5IHRvIHVzZSBuYXRpdmUgdmFyaWFudCB0byBlbnN1cmUgaXQgaXMgZnVuY3Rpb25hbCBmb3IgdGhlIHBsYXRmb3JtLlxuICAgIC8vIFNwYXduaW5nIGEgc2VwYXJhdGUgZXNidWlsZCBjaGVjayBwcm9jZXNzIGlzIHVzZWQgdG8gZGV0ZXJtaW5lIGlmIHRoZSBuYXRpdmVcbiAgICAvLyB2YXJpYW50IGlzIHZpYWJsZS4gSWYgY2hlY2sgZmFpbHMsIHRoZSBXQVNNIHZhcmlhbnQgaXMgaW5pdGlhbGl6ZWQgaW5zdGVhZC5cbiAgICAvLyBBdHRlbXB0aW5nIHRvIGNhbGwgb25lIG9mIHRoZSBuYXRpdmUgZXNidWlsZCBmdW5jdGlvbnMgaXMgbm90IGEgdmlhYmxlIHRlc3RcbiAgICAvLyBjdXJyZW50bHkgc2luY2UgZXNidWlsZCBzcGF3biBlcnJvcnMgYXJlIGN1cnJlbnRseSBub3QgcHJvcGFnYXRlZCB0aHJvdWdoIHRoZVxuICAgIC8vIGNhbGwgc3RhY2sgZm9yIHRoZSBlc2J1aWxkIGZ1bmN0aW9uLiBJZiB0aGlzIGxpbWl0YXRpb24gaXMgcmVtb3ZlZCBpbiB0aGUgZnV0dXJlXG4gICAgLy8gdGhlbiB0aGUgc2VwYXJhdGUgcHJvY2VzcyBzcGF3biBjaGVjayBjYW4gYmUgcmVtb3ZlZCBpbiBmYXZvciBvZiBhIGRpcmVjdCBmdW5jdGlvblxuICAgIC8vIGNhbGwgY2hlY2suXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgc3RhdHVzLCBlcnJvciB9ID0gc3Bhd25TeW5jKHByb2Nlc3MuZXhlY1BhdGgsIFtcbiAgICAgICAgcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uL2VzYnVpbGQtY2hlY2suanMnKSxcbiAgICAgIF0pO1xuXG4gICAgICByZXR1cm4gc3RhdHVzID09PSAwICYmIGVycm9yID09PSB1bmRlZmluZWQ7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemVzIHRoZSBlc2J1aWxkIHRyYW5zZm9ybSBhbmQgZm9ybWF0IG1lc3NhZ2VzIGZ1bmN0aW9ucy5cbiAgICpcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgZnVsZmlsbHMgd2hlbiBlc2J1aWxkIGhhcyBiZWVuIGxvYWRlZCBhbmQgYXZhaWxhYmxlIGZvciB1c2UuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGVuc3VyZUVzYnVpbGQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKHRoaXMuaW5pdGlhbGl6ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgV0FTTSB2YXJpYW50IHdhcyBwcmVmZXJyZWQgYXQgY2xhc3MgY29uc3RydWN0aW9uIG9yIG5hdGl2ZSBpcyBub3Qgc3VwcG9ydGVkLCB1c2UgV0FTTVxuICAgIGlmICh0aGlzLmFsd2F5c1VzZVdhc20gfHwgIUVzYnVpbGRFeGVjdXRvci5oYXNOYXRpdmVTdXBwb3J0KCkpIHtcbiAgICAgIGF3YWl0IHRoaXMudXNlV2FzbSgpO1xuICAgICAgdGhpcy5pbml0aWFsaXplZCA9IHRydWU7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgLy8gVXNlIHRoZSBmYXN0ZXIgbmF0aXZlIHZhcmlhbnQgaWYgYXZhaWxhYmxlLlxuICAgICAgY29uc3QgeyB0cmFuc2Zvcm0sIGZvcm1hdE1lc3NhZ2VzIH0gPSBhd2FpdCBpbXBvcnQoJ2VzYnVpbGQnKTtcblxuICAgICAgdGhpcy5lc2J1aWxkVHJhbnNmb3JtID0gdHJhbnNmb3JtO1xuICAgICAgdGhpcy5lc2J1aWxkRm9ybWF0TWVzc2FnZXMgPSBmb3JtYXRNZXNzYWdlcztcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIElmIHRoZSBuYXRpdmUgdmFyaWFudCBpcyBub3QgaW5zdGFsbGVkIHRoZW4gdXNlIHRoZSBXQVNNLWJhc2VkIHZhcmlhbnRcbiAgICAgIGF3YWl0IHRoaXMudXNlV2FzbSgpO1xuICAgIH1cblxuICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIFRyYW5zaXRpb25zIGFuIGV4ZWN1dG9yIGluc3RhbmNlIHRvIHVzZSB0aGUgV0FTTS12YXJpYW50IG9mIGVzYnVpbGQuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHVzZVdhc20oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0cmFuc2Zvcm0sIGZvcm1hdE1lc3NhZ2VzIH0gPSBhd2FpdCBpbXBvcnQoJ2VzYnVpbGQtd2FzbScpO1xuICAgIHRoaXMuZXNidWlsZFRyYW5zZm9ybSA9IHRyYW5zZm9ybTtcbiAgICB0aGlzLmVzYnVpbGRGb3JtYXRNZXNzYWdlcyA9IGZvcm1hdE1lc3NhZ2VzO1xuXG4gICAgLy8gVGhlIEVTQlVJTERfQklOQVJZX1BBVEggZW52aXJvbm1lbnQgdmFyaWFibGUgY2Fubm90IGV4aXN0IHdoZW4gYXR0ZW1wdGluZyB0byB1c2UgdGhlXG4gICAgLy8gV0FTTSB2YXJpYW50LiBJZiBpdCBpcyB0aGVuIHRoZSBiaW5hcnkgbG9jYXRlZCBhdCB0aGUgc3BlY2lmaWVkIHBhdGggd2lsbCBiZSB1c2VkIGluc3RlYWRcbiAgICAvLyBvZiB0aGUgV0FTTSB2YXJpYW50LlxuICAgIGRlbGV0ZSBwcm9jZXNzLmVudi5FU0JVSUxEX0JJTkFSWV9QQVRIO1xuXG4gICAgdGhpcy5hbHdheXNVc2VXYXNtID0gdHJ1ZTtcbiAgfVxuXG4gIGFzeW5jIHRyYW5zZm9ybShpbnB1dDogc3RyaW5nLCBvcHRpb25zPzogVHJhbnNmb3JtT3B0aW9ucyk6IFByb21pc2U8VHJhbnNmb3JtUmVzdWx0PiB7XG4gICAgYXdhaXQgdGhpcy5lbnN1cmVFc2J1aWxkKCk7XG5cbiAgICByZXR1cm4gdGhpcy5lc2J1aWxkVHJhbnNmb3JtKGlucHV0LCBvcHRpb25zKTtcbiAgfVxuXG4gIGFzeW5jIGZvcm1hdE1lc3NhZ2VzKFxuICAgIG1lc3NhZ2VzOiBQYXJ0aWFsTWVzc2FnZVtdLFxuICAgIG9wdGlvbnM6IEZvcm1hdE1lc3NhZ2VzT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGF3YWl0IHRoaXMuZW5zdXJlRXNidWlsZCgpO1xuXG4gICAgcmV0dXJuIHRoaXMuZXNidWlsZEZvcm1hdE1lc3NhZ2VzKG1lc3NhZ2VzLCBvcHRpb25zKTtcbiAgfVxufVxuIl19