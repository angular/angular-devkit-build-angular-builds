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
     * @returns A promise which resolves to `true`, if the native variant of esbuild is support or `false`, if the WASM variant is required.
     */
    static async hasNativeSupport() {
        // Try to use native variant to ensure it is functional for the platform.
        try {
            const { formatMessages } = await Promise.resolve().then(() => __importStar(require('esbuild')));
            await formatMessages([], { kind: 'error' });
            return true;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNidWlsZC1leGVjdXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy9lc2J1aWxkLWV4ZWN1dG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBU0g7Ozs7OztHQU1HO0FBQ0gsTUFBYSxlQUFlO0lBTzFCOzs7OztPQUtHO0lBQ0gsWUFBb0IsZ0JBQWdCLEtBQUs7UUFBckIsa0JBQWEsR0FBYixhQUFhLENBQVE7UUFSakMsZ0JBQVcsR0FBRyxLQUFLLENBQUM7UUFTMUIsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxHQUFHLEVBQUU7WUFDeEQsTUFBTSxJQUFJLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO1FBQ3BELENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsTUFBTSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0I7UUFDM0IseUVBQXlFO1FBQ3pFLElBQUk7WUFDRixNQUFNLEVBQUUsY0FBYyxFQUFFLEdBQUcsd0RBQWEsU0FBUyxHQUFDLENBQUM7WUFDbkQsTUFBTSxjQUFjLENBQUMsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFFNUMsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUFDLFdBQU07WUFDTixPQUFPLEtBQUssQ0FBQztTQUNkO0lBQ0gsQ0FBQztJQUVEOzs7O09BSUc7SUFDSyxLQUFLLENBQUMsYUFBYTtRQUN6QixJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDcEIsT0FBTztTQUNSO1FBRUQsK0ZBQStGO1FBQy9GLElBQUksSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLENBQUMsTUFBTSxlQUFlLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxFQUFFO1lBQ3JFLE1BQU0sSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3JCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1lBRXhCLE9BQU87U0FDUjtRQUVELElBQUk7WUFDRiw4Q0FBOEM7WUFDOUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsR0FBRyx3REFBYSxTQUFTLEdBQUMsQ0FBQztZQUU5RCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsU0FBUyxDQUFDO1lBQ2xDLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxjQUFjLENBQUM7U0FDN0M7UUFBQyxXQUFNO1lBQ04seUVBQXlFO1lBQ3pFLE1BQU0sSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1NBQ3RCO1FBRUQsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7SUFDMUIsQ0FBQztJQUVEOztPQUVHO0lBQ0ssS0FBSyxDQUFDLE9BQU87UUFDbkIsTUFBTSxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsR0FBRyx3REFBYSxjQUFjLEdBQUMsQ0FBQztRQUNuRSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsU0FBUyxDQUFDO1FBQ2xDLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxjQUFjLENBQUM7UUFFNUMsdUZBQXVGO1FBQ3ZGLDRGQUE0RjtRQUM1Rix1QkFBdUI7UUFDdkIsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDO1FBRXZDLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDO0lBQzVCLENBQUM7SUFFRCxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQWEsRUFBRSxPQUEwQjtRQUN2RCxNQUFNLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUUzQixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUVELEtBQUssQ0FBQyxjQUFjLENBQ2xCLFFBQTBCLEVBQzFCLE9BQThCO1FBRTlCLE1BQU0sSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBRTNCLE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN2RCxDQUFDO0NBQ0Y7QUFsR0QsMENBa0dDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0eXBlIHtcbiAgRm9ybWF0TWVzc2FnZXNPcHRpb25zLFxuICBQYXJ0aWFsTWVzc2FnZSxcbiAgVHJhbnNmb3JtT3B0aW9ucyxcbiAgVHJhbnNmb3JtUmVzdWx0LFxufSBmcm9tICdlc2J1aWxkJztcblxuLyoqXG4gKiBQcm92aWRlcyB0aGUgYWJpbGl0eSB0byBleGVjdXRlIGVzYnVpbGQgcmVnYXJkbGVzcyBvZiB0aGUgY3VycmVudCBwbGF0Zm9ybSdzIHN1cHBvcnRcbiAqIGZvciB1c2luZyB0aGUgbmF0aXZlIHZhcmlhbnQgb2YgZXNidWlsZC4gVGhlIG5hdGl2ZSB2YXJpYW50IHdpbGwgYmUgcHJlZmVycmVkIChhc3N1bWluZ1xuICogdGhlIGBhbHdheXNVc2VXYXNtYCBjb25zdHJ1Y3RvciBvcHRpb24gaXMgYGZhbHNlKSBkdWUgdG8gaXRzIGluaGVyZW50IHBlcmZvcm1hbmNlIGFkdmFudGFnZXMuXG4gKiBBdCBmaXJzdCB1c2Ugb2YgZXNidWlsZCwgYSBzdXBwb3J0YWJpbGl0eSB0ZXN0IHdpbGwgYmUgYXV0b21hdGljYWxseSBwZXJmb3JtZWQgYW5kIHRoZVxuICogV0FTTS12YXJpYW50IHdpbGwgYmUgdXNlZCBpZiBuZWVkZWQgYnkgdGhlIHBsYXRmb3JtLlxuICovXG5leHBvcnQgY2xhc3MgRXNidWlsZEV4ZWN1dG9yXG4gIGltcGxlbWVudHMgUGljazx0eXBlb2YgaW1wb3J0KCdlc2J1aWxkJyksICd0cmFuc2Zvcm0nIHwgJ2Zvcm1hdE1lc3NhZ2VzJz5cbntcbiAgcHJpdmF0ZSBlc2J1aWxkVHJhbnNmb3JtOiB0aGlzWyd0cmFuc2Zvcm0nXTtcbiAgcHJpdmF0ZSBlc2J1aWxkRm9ybWF0TWVzc2FnZXM6IHRoaXNbJ2Zvcm1hdE1lc3NhZ2VzJ107XG4gIHByaXZhdGUgaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblxuICAvKipcbiAgICogQ29uc3RydWN0cyBhbiBpbnN0YW5jZSBvZiB0aGUgYEVzYnVpbGRFeGVjdXRvcmAgY2xhc3MuXG4gICAqXG4gICAqIEBwYXJhbSBhbHdheXNVc2VXYXNtIElmIHRydWUsIHRoZSBXQVNNLXZhcmlhbnQgd2lsbCBiZSBwcmVmZXJyZWQgYW5kIG5vIHN1cHBvcnQgdGVzdCB3aWxsIGJlXG4gICAqIHBlcmZvcm1lZDsgaWYgZmFsc2UgKGRlZmF1bHQpLCB0aGUgbmF0aXZlIHZhcmlhbnQgd2lsbCBiZSBwcmVmZXJyZWQuXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGFsd2F5c1VzZVdhc20gPSBmYWxzZSkge1xuICAgIHRoaXMuZXNidWlsZFRyYW5zZm9ybSA9IHRoaXMuZXNidWlsZEZvcm1hdE1lc3NhZ2VzID0gKCkgPT4ge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdlc2J1aWxkIGltcGxlbWVudGF0aW9uIG1pc3NpbmcnKTtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIERldGVybWluZXMgd2hldGhlciB0aGUgbmF0aXZlIHZhcmlhbnQgb2YgZXNidWlsZCBjYW4gYmUgdXNlZCBvbiB0aGUgY3VycmVudCBwbGF0Zm9ybS5cbiAgICpcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHdoaWNoIHJlc29sdmVzIHRvIGB0cnVlYCwgaWYgdGhlIG5hdGl2ZSB2YXJpYW50IG9mIGVzYnVpbGQgaXMgc3VwcG9ydCBvciBgZmFsc2VgLCBpZiB0aGUgV0FTTSB2YXJpYW50IGlzIHJlcXVpcmVkLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGhhc05hdGl2ZVN1cHBvcnQoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgLy8gVHJ5IHRvIHVzZSBuYXRpdmUgdmFyaWFudCB0byBlbnN1cmUgaXQgaXMgZnVuY3Rpb25hbCBmb3IgdGhlIHBsYXRmb3JtLlxuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IGZvcm1hdE1lc3NhZ2VzIH0gPSBhd2FpdCBpbXBvcnQoJ2VzYnVpbGQnKTtcbiAgICAgIGF3YWl0IGZvcm1hdE1lc3NhZ2VzKFtdLCB7IGtpbmQ6ICdlcnJvcicgfSk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplcyB0aGUgZXNidWlsZCB0cmFuc2Zvcm0gYW5kIGZvcm1hdCBtZXNzYWdlcyBmdW5jdGlvbnMuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IGZ1bGZpbGxzIHdoZW4gZXNidWlsZCBoYXMgYmVlbiBsb2FkZWQgYW5kIGF2YWlsYWJsZSBmb3IgdXNlLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBlbnN1cmVFc2J1aWxkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLmluaXRpYWxpemVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIFdBU00gdmFyaWFudCB3YXMgcHJlZmVycmVkIGF0IGNsYXNzIGNvbnN0cnVjdGlvbiBvciBuYXRpdmUgaXMgbm90IHN1cHBvcnRlZCwgdXNlIFdBU01cbiAgICBpZiAodGhpcy5hbHdheXNVc2VXYXNtIHx8ICEoYXdhaXQgRXNidWlsZEV4ZWN1dG9yLmhhc05hdGl2ZVN1cHBvcnQoKSkpIHtcbiAgICAgIGF3YWl0IHRoaXMudXNlV2FzbSgpO1xuICAgICAgdGhpcy5pbml0aWFsaXplZCA9IHRydWU7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgLy8gVXNlIHRoZSBmYXN0ZXIgbmF0aXZlIHZhcmlhbnQgaWYgYXZhaWxhYmxlLlxuICAgICAgY29uc3QgeyB0cmFuc2Zvcm0sIGZvcm1hdE1lc3NhZ2VzIH0gPSBhd2FpdCBpbXBvcnQoJ2VzYnVpbGQnKTtcblxuICAgICAgdGhpcy5lc2J1aWxkVHJhbnNmb3JtID0gdHJhbnNmb3JtO1xuICAgICAgdGhpcy5lc2J1aWxkRm9ybWF0TWVzc2FnZXMgPSBmb3JtYXRNZXNzYWdlcztcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIElmIHRoZSBuYXRpdmUgdmFyaWFudCBpcyBub3QgaW5zdGFsbGVkIHRoZW4gdXNlIHRoZSBXQVNNLWJhc2VkIHZhcmlhbnRcbiAgICAgIGF3YWl0IHRoaXMudXNlV2FzbSgpO1xuICAgIH1cblxuICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIFRyYW5zaXRpb25zIGFuIGV4ZWN1dG9yIGluc3RhbmNlIHRvIHVzZSB0aGUgV0FTTS12YXJpYW50IG9mIGVzYnVpbGQuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHVzZVdhc20oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeyB0cmFuc2Zvcm0sIGZvcm1hdE1lc3NhZ2VzIH0gPSBhd2FpdCBpbXBvcnQoJ2VzYnVpbGQtd2FzbScpO1xuICAgIHRoaXMuZXNidWlsZFRyYW5zZm9ybSA9IHRyYW5zZm9ybTtcbiAgICB0aGlzLmVzYnVpbGRGb3JtYXRNZXNzYWdlcyA9IGZvcm1hdE1lc3NhZ2VzO1xuXG4gICAgLy8gVGhlIEVTQlVJTERfQklOQVJZX1BBVEggZW52aXJvbm1lbnQgdmFyaWFibGUgY2Fubm90IGV4aXN0IHdoZW4gYXR0ZW1wdGluZyB0byB1c2UgdGhlXG4gICAgLy8gV0FTTSB2YXJpYW50LiBJZiBpdCBpcyB0aGVuIHRoZSBiaW5hcnkgbG9jYXRlZCBhdCB0aGUgc3BlY2lmaWVkIHBhdGggd2lsbCBiZSB1c2VkIGluc3RlYWRcbiAgICAvLyBvZiB0aGUgV0FTTSB2YXJpYW50LlxuICAgIGRlbGV0ZSBwcm9jZXNzLmVudi5FU0JVSUxEX0JJTkFSWV9QQVRIO1xuXG4gICAgdGhpcy5hbHdheXNVc2VXYXNtID0gdHJ1ZTtcbiAgfVxuXG4gIGFzeW5jIHRyYW5zZm9ybShpbnB1dDogc3RyaW5nLCBvcHRpb25zPzogVHJhbnNmb3JtT3B0aW9ucyk6IFByb21pc2U8VHJhbnNmb3JtUmVzdWx0PiB7XG4gICAgYXdhaXQgdGhpcy5lbnN1cmVFc2J1aWxkKCk7XG5cbiAgICByZXR1cm4gdGhpcy5lc2J1aWxkVHJhbnNmb3JtKGlucHV0LCBvcHRpb25zKTtcbiAgfVxuXG4gIGFzeW5jIGZvcm1hdE1lc3NhZ2VzKFxuICAgIG1lc3NhZ2VzOiBQYXJ0aWFsTWVzc2FnZVtdLFxuICAgIG9wdGlvbnM6IEZvcm1hdE1lc3NhZ2VzT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGF3YWl0IHRoaXMuZW5zdXJlRXNidWlsZCgpO1xuXG4gICAgcmV0dXJuIHRoaXMuZXNidWlsZEZvcm1hdE1lc3NhZ2VzKG1lc3NhZ2VzLCBvcHRpb25zKTtcbiAgfVxufVxuIl19