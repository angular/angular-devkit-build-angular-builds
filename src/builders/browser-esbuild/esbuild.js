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
var _BundlerContext_esbuildContext, _BundlerContext_esbuildOptions;
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMessages = exports.BundlerContext = exports.isEsBuildFailure = void 0;
const esbuild_1 = require("esbuild");
const node_path_1 = require("node:path");
/**
 * Determines if an unknown value is an esbuild BuildFailure error object thrown by esbuild.
 * @param value A potential esbuild BuildFailure error object.
 * @returns `true` if the object is determined to be a BuildFailure object; otherwise, `false`.
 */
function isEsBuildFailure(value) {
    return !!value && typeof value === 'object' && 'errors' in value && 'warnings' in value;
}
exports.isEsBuildFailure = isEsBuildFailure;
class BundlerContext {
    constructor(workspaceRoot, incremental, options) {
        this.workspaceRoot = workspaceRoot;
        this.incremental = incremental;
        _BundlerContext_esbuildContext.set(this, void 0);
        _BundlerContext_esbuildOptions.set(this, void 0);
        __classPrivateFieldSet(this, _BundlerContext_esbuildOptions, {
            ...options,
            metafile: true,
            write: false,
        }, "f");
    }
    /**
     * Executes the esbuild build function and normalizes the build result in the event of a
     * build failure that results in no output being generated.
     * All builds use the `write` option with a value of `false` to allow for the output files
     * build result array to be populated.
     *
     * @returns If output files are generated, the full esbuild BuildResult; if not, the
     * warnings and errors for the attempted build.
     */
    async bundle() {
        let result;
        try {
            if (__classPrivateFieldGet(this, _BundlerContext_esbuildContext, "f")) {
                // Rebuild using the existing incremental build context
                result = await __classPrivateFieldGet(this, _BundlerContext_esbuildContext, "f").rebuild();
            }
            else if (this.incremental) {
                // Create an incremental build context and perform the first build.
                // Context creation does not perform a build.
                __classPrivateFieldSet(this, _BundlerContext_esbuildContext, await (0, esbuild_1.context)(__classPrivateFieldGet(this, _BundlerContext_esbuildOptions, "f")), "f");
                result = await __classPrivateFieldGet(this, _BundlerContext_esbuildContext, "f").rebuild();
            }
            else {
                // For non-incremental builds, perform a single build
                result = await (0, esbuild_1.build)(__classPrivateFieldGet(this, _BundlerContext_esbuildOptions, "f"));
            }
        }
        catch (failure) {
            // Build failures will throw an exception which contains errors/warnings
            if (isEsBuildFailure(failure)) {
                return failure;
            }
            else {
                throw failure;
            }
        }
        // Return if the build encountered any errors
        if (result.errors.length) {
            return {
                errors: result.errors,
                warnings: result.warnings,
            };
        }
        // Find all initial files
        const initialFiles = [];
        for (const outputFile of result.outputFiles) {
            // Entries in the metafile are relative to the `absWorkingDir` option which is set to the workspaceRoot
            const relativeFilePath = (0, node_path_1.relative)(this.workspaceRoot, outputFile.path);
            const entryPoint = result.metafile?.outputs[relativeFilePath]?.entryPoint;
            outputFile.path = relativeFilePath;
            if (entryPoint) {
                // The first part of the filename is the name of file (e.g., "polyfills" for "polyfills.7S5G3MDY.js")
                const name = (0, node_path_1.basename)(outputFile.path).split('.', 1)[0];
                // Only entrypoints with an entry in the options are initial files.
                // Dynamic imports also have an entryPoint value in the meta file.
                if (__classPrivateFieldGet(this, _BundlerContext_esbuildOptions, "f").entryPoints?.[name]) {
                    // An entryPoint value indicates an initial file
                    initialFiles.push({
                        file: outputFile.path,
                        name,
                        extension: (0, node_path_1.extname)(outputFile.path),
                    });
                }
            }
        }
        // Return the successful build results
        return { ...result, initialFiles, errors: undefined };
    }
    /**
     * Disposes incremental build resources present in the context.
     *
     * @returns A promise that resolves when disposal is complete.
     */
    async dispose() {
        try {
            return __classPrivateFieldGet(this, _BundlerContext_esbuildContext, "f")?.dispose();
        }
        finally {
            __classPrivateFieldSet(this, _BundlerContext_esbuildContext, undefined, "f");
        }
    }
}
exports.BundlerContext = BundlerContext;
_BundlerContext_esbuildContext = new WeakMap(), _BundlerContext_esbuildOptions = new WeakMap();
async function logMessages(context, { errors, warnings }) {
    if (warnings?.length) {
        const warningMessages = await (0, esbuild_1.formatMessages)(warnings, { kind: 'warning', color: true });
        context.logger.warn(warningMessages.join('\n'));
    }
    if (errors?.length) {
        const errorMessages = await (0, esbuild_1.formatMessages)(errors, { kind: 'error', color: true });
        context.logger.error(errorMessages.join('\n'));
    }
}
exports.logMessages = logMessages;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNidWlsZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9lc2J1aWxkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7OztBQUdILHFDQVdpQjtBQUNqQix5Q0FBd0Q7QUFHeEQ7Ozs7R0FJRztBQUNILFNBQWdCLGdCQUFnQixDQUFDLEtBQWM7SUFDN0MsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxRQUFRLElBQUksS0FBSyxJQUFJLFVBQVUsSUFBSSxLQUFLLENBQUM7QUFDMUYsQ0FBQztBQUZELDRDQUVDO0FBRUQsTUFBYSxjQUFjO0lBSXpCLFlBQW9CLGFBQXFCLEVBQVUsV0FBb0IsRUFBRSxPQUFxQjtRQUExRSxrQkFBYSxHQUFiLGFBQWEsQ0FBUTtRQUFVLGdCQUFXLEdBQVgsV0FBVyxDQUFTO1FBSHZFLGlEQUFpRTtRQUNqRSxpREFBaUU7UUFHL0QsdUJBQUEsSUFBSSxrQ0FBbUI7WUFDckIsR0FBRyxPQUFPO1lBQ1YsUUFBUSxFQUFFLElBQUk7WUFDZCxLQUFLLEVBQUUsS0FBSztTQUNiLE1BQUEsQ0FBQztJQUNKLENBQUM7SUFFRDs7Ozs7Ozs7T0FRRztJQUNILEtBQUssQ0FBQyxNQUFNO1FBVVYsSUFBSSxNQUFNLENBQUM7UUFDWCxJQUFJO1lBQ0YsSUFBSSx1QkFBQSxJQUFJLHNDQUFnQixFQUFFO2dCQUN4Qix1REFBdUQ7Z0JBQ3ZELE1BQU0sR0FBRyxNQUFNLHVCQUFBLElBQUksc0NBQWdCLENBQUMsT0FBTyxFQUFFLENBQUM7YUFDL0M7aUJBQU0sSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO2dCQUMzQixtRUFBbUU7Z0JBQ25FLDZDQUE2QztnQkFDN0MsdUJBQUEsSUFB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LE1BQU0sYUFBYSxHQUFHLE1BQU0sSUFBQSx3QkFBYyxFQUFDLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDbkYsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0tBQ2hEO0FBQ0gsQ0FBQztBQWJELGtDQWFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1aWxkZXJDb250ZXh0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQge1xuICBCdWlsZENvbnRleHQsXG4gIEJ1aWxkRmFpbHVyZSxcbiAgQnVpbGRPcHRpb25zLFxuICBNZXNzYWdlLFxuICBNZXRhZmlsZSxcbiAgT3V0cHV0RmlsZSxcbiAgUGFydGlhbE1lc3NhZ2UsXG4gIGJ1aWxkLFxuICBjb250ZXh0LFxuICBmb3JtYXRNZXNzYWdlcyxcbn0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZXh0bmFtZSwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgRmlsZUluZm8gfSBmcm9tICcuLi8uLi91dGlscy9pbmRleC1maWxlL2F1Z21lbnQtaW5kZXgtaHRtbCc7XG5cbi8qKlxuICogRGV0ZXJtaW5lcyBpZiBhbiB1bmtub3duIHZhbHVlIGlzIGFuIGVzYnVpbGQgQnVpbGRGYWlsdXJlIGVycm9yIG9iamVjdCB0aHJvd24gYnkgZXNidWlsZC5cbiAqIEBwYXJhbSB2YWx1ZSBBIHBvdGVudGlhbCBlc2J1aWxkIEJ1aWxkRmFpbHVyZSBlcnJvciBvYmplY3QuXG4gKiBAcmV0dXJucyBgdHJ1ZWAgaWYgdGhlIG9iamVjdCBpcyBkZXRlcm1pbmVkIHRvIGJlIGEgQnVpbGRGYWlsdXJlIG9iamVjdDsgb3RoZXJ3aXNlLCBgZmFsc2VgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNFc0J1aWxkRmFpbHVyZSh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIEJ1aWxkRmFpbHVyZSB7XG4gIHJldHVybiAhIXZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgJ2Vycm9ycycgaW4gdmFsdWUgJiYgJ3dhcm5pbmdzJyBpbiB2YWx1ZTtcbn1cblxuZXhwb3J0IGNsYXNzIEJ1bmRsZXJDb250ZXh0IHtcbiAgI2VzYnVpbGRDb250ZXh0PzogQnVpbGRDb250ZXh0PHsgbWV0YWZpbGU6IHRydWU7IHdyaXRlOiBmYWxzZSB9PjtcbiAgI2VzYnVpbGRPcHRpb25zOiBCdWlsZE9wdGlvbnMgJiB7IG1ldGFmaWxlOiB0cnVlOyB3cml0ZTogZmFsc2UgfTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHdvcmtzcGFjZVJvb3Q6IHN0cmluZywgcHJpdmF0ZSBpbmNyZW1lbnRhbDogYm9vbGVhbiwgb3B0aW9uczogQnVpbGRPcHRpb25zKSB7XG4gICAgdGhpcy4jZXNidWlsZE9wdGlvbnMgPSB7XG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgbWV0YWZpbGU6IHRydWUsXG4gICAgICB3cml0ZTogZmFsc2UsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlcyB0aGUgZXNidWlsZCBidWlsZCBmdW5jdGlvbiBhbmQgbm9ybWFsaXplcyB0aGUgYnVpbGQgcmVzdWx0IGluIHRoZSBldmVudCBvZiBhXG4gICAqIGJ1aWxkIGZhaWx1cmUgdGhhdCByZXN1bHRzIGluIG5vIG91dHB1dCBiZWluZyBnZW5lcmF0ZWQuXG4gICAqIEFsbCBidWlsZHMgdXNlIHRoZSBgd3JpdGVgIG9wdGlvbiB3aXRoIGEgdmFsdWUgb2YgYGZhbHNlYCB0byBhbGxvdyBmb3IgdGhlIG91dHB1dCBmaWxlc1xuICAgKiBidWlsZCByZXN1bHQgYXJyYXkgdG8gYmUgcG9wdWxhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBJZiBvdXRwdXQgZmlsZXMgYXJlIGdlbmVyYXRlZCwgdGhlIGZ1bGwgZXNidWlsZCBCdWlsZFJlc3VsdDsgaWYgbm90LCB0aGVcbiAgICogd2FybmluZ3MgYW5kIGVycm9ycyBmb3IgdGhlIGF0dGVtcHRlZCBidWlsZC5cbiAgICovXG4gIGFzeW5jIGJ1bmRsZSgpOiBQcm9taXNlPFxuICAgIHwgeyBlcnJvcnM6IE1lc3NhZ2VbXTsgd2FybmluZ3M6IE1lc3NhZ2VbXSB9XG4gICAgfCB7XG4gICAgICAgIGVycm9yczogdW5kZWZpbmVkO1xuICAgICAgICB3YXJuaW5nczogTWVzc2FnZVtdO1xuICAgICAgICBtZXRhZmlsZTogTWV0YWZpbGU7XG4gICAgICAgIG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW107XG4gICAgICAgIGluaXRpYWxGaWxlczogRmlsZUluZm9bXTtcbiAgICAgIH1cbiAgPiB7XG4gICAgbGV0IHJlc3VsdDtcbiAgICB0cnkge1xuICAgICAgaWYgKHRoaXMuI2VzYnVpbGRDb250ZXh0KSB7XG4gICAgICAgIC8vIFJlYnVpbGQgdXNpbmcgdGhlIGV4aXN0aW5nIGluY3JlbWVudGFsIGJ1aWxkIGNvbnRleHRcbiAgICAgICAgcmVzdWx0ID0gYXdhaXQgdGhpcy4jZXNidWlsZENvbnRleHQucmVidWlsZCgpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmluY3JlbWVudGFsKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhbiBpbmNyZW1lbnRhbCBidWlsZCBjb250ZXh0IGFuZCBwZXJmb3JtIHRoZSBmaXJzdCBidWlsZC5cbiAgICAgICAgLy8gQ29udGV4dCBjcmVhdGlvbiBkb2VzIG5vdCBwZXJmb3JtIGEgYnVpbGQuXG4gICAgICAgIHRoaXMuI2VzYnVpbGRDb250ZXh0ID0gYXdhaXQgY29udGV4dCh0aGlzLiNlc2J1aWxkT3B0aW9ucyk7XG4gICAgICAgIHJlc3VsdCA9IGF3YWl0IHRoaXMuI2VzYnVpbGRDb250ZXh0LnJlYnVpbGQoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEZvciBub24taW5jcmVtZW50YWwgYnVpbGRzLCBwZXJmb3JtIGEgc2luZ2xlIGJ1aWxkXG4gICAgICAgIHJlc3VsdCA9IGF3YWl0IGJ1aWxkKHRoaXMuI2VzYnVpbGRPcHRpb25zKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChmYWlsdXJlKSB7XG4gICAgICAvLyBCdWlsZCBmYWlsdXJlcyB3aWxsIHRocm93IGFuIGV4Y2VwdGlvbiB3aGljaCBjb250YWlucyBlcnJvcnMvd2FybmluZ3NcbiAgICAgIGlmIChpc0VzQnVpbGRGYWlsdXJlKGZhaWx1cmUpKSB7XG4gICAgICAgIHJldHVybiBmYWlsdXJlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZmFpbHVyZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gaWYgdGhlIGJ1aWxkIGVuY291bnRlcmVkIGFueSBlcnJvcnNcbiAgICBpZiAocmVzdWx0LmVycm9ycy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVycm9yczogcmVzdWx0LmVycm9ycyxcbiAgICAgICAgd2FybmluZ3M6IHJlc3VsdC53YXJuaW5ncyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gRmluZCBhbGwgaW5pdGlhbCBmaWxlc1xuICAgIGNvbnN0IGluaXRpYWxGaWxlczogRmlsZUluZm9bXSA9IFtdO1xuICAgIGZvciAoY29uc3Qgb3V0cHV0RmlsZSBvZiByZXN1bHQub3V0cHV0RmlsZXMpIHtcbiAgICAgIC8vIEVudHJpZXMgaW4gdGhlIG1ldGFmaWxlIGFyZSByZWxhdGl2ZSB0byB0aGUgYGFic1dvcmtpbmdEaXJgIG9wdGlvbiB3aGljaCBpcyBzZXQgdG8gdGhlIHdvcmtzcGFjZVJvb3RcbiAgICAgIGNvbnN0IHJlbGF0aXZlRmlsZVBhdGggPSByZWxhdGl2ZSh0aGlzLndvcmtzcGFjZVJvb3QsIG91dHB1dEZpbGUucGF0aCk7XG4gICAgICBjb25zdCBlbnRyeVBvaW50ID0gcmVzdWx0Lm1ldGFmaWxlPy5vdXRwdXRzW3JlbGF0aXZlRmlsZVBhdGhdPy5lbnRyeVBvaW50O1xuXG4gICAgICBvdXRwdXRGaWxlLnBhdGggPSByZWxhdGl2ZUZpbGVQYXRoO1xuXG4gICAgICBpZiAoZW50cnlQb2ludCkge1xuICAgICAgICAvLyBUaGUgZmlyc3QgcGFydCBvZiB0aGUgZmlsZW5hbWUgaXMgdGhlIG5hbWUgb2YgZmlsZSAoZS5nLiwgXCJwb2x5ZmlsbHNcIiBmb3IgXCJwb2x5ZmlsbHMuN1M1RzNNRFkuanNcIilcbiAgICAgICAgY29uc3QgbmFtZSA9IGJhc2VuYW1lKG91dHB1dEZpbGUucGF0aCkuc3BsaXQoJy4nLCAxKVswXTtcblxuICAgICAgICAvLyBPbmx5IGVudHJ5cG9pbnRzIHdpdGggYW4gZW50cnkgaW4gdGhlIG9wdGlvbnMgYXJlIGluaXRpYWwgZmlsZXMuXG4gICAgICAgIC8vIER5bmFtaWMgaW1wb3J0cyBhbHNvIGhhdmUgYW4gZW50cnlQb2ludCB2YWx1ZSBpbiB0aGUgbWV0YSBmaWxlLlxuICAgICAgICBpZiAoKHRoaXMuI2VzYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzIGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4pPy5bbmFtZV0pIHtcbiAgICAgICAgICAvLyBBbiBlbnRyeVBvaW50IHZhbHVlIGluZGljYXRlcyBhbiBpbml0aWFsIGZpbGVcbiAgICAgICAgICBpbml0aWFsRmlsZXMucHVzaCh7XG4gICAgICAgICAgICBmaWxlOiBvdXRwdXRGaWxlLnBhdGgsXG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgZXh0ZW5zaW9uOiBleHRuYW1lKG91dHB1dEZpbGUucGF0aCksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gdGhlIHN1Y2Nlc3NmdWwgYnVpbGQgcmVzdWx0c1xuICAgIHJldHVybiB7IC4uLnJlc3VsdCwgaW5pdGlhbEZpbGVzLCBlcnJvcnM6IHVuZGVmaW5lZCB9O1xuICB9XG5cbiAgLyoqXG4gICAqIERpc3Bvc2VzIGluY3JlbWVudGFsIGJ1aWxkIHJlc291cmNlcyBwcmVzZW50IGluIHRoZSBjb250ZXh0LlxuICAgKlxuICAgKiBAcmV0dXJucyBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGRpc3Bvc2FsIGlzIGNvbXBsZXRlLlxuICAgKi9cbiAgYXN5bmMgZGlzcG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHRoaXMuI2VzYnVpbGRDb250ZXh0Py5kaXNwb3NlKCk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuI2VzYnVpbGRDb250ZXh0ID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9nTWVzc2FnZXMoXG4gIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICB7IGVycm9ycywgd2FybmluZ3MgfTogeyBlcnJvcnM/OiBQYXJ0aWFsTWVzc2FnZVtdOyB3YXJuaW5ncz86IFBhcnRpYWxNZXNzYWdlW10gfSxcbik6IFByb21pc2U8dm9pZD4ge1xuICBpZiAod2FybmluZ3M/Lmxlbmd0aCkge1xuICAgIGNvbnN0IHdhcm5pbmdNZXNzYWdlcyA9IGF3YWl0IGZvcm1hdE1lc3NhZ2VzKHdhcm5pbmdzLCB7IGtpbmQ6ICd3YXJuaW5nJywgY29sb3I6IHRydWUgfSk7XG4gICAgY29udGV4dC5sb2dnZXIud2Fybih3YXJuaW5nTWVzc2FnZXMuam9pbignXFxuJykpO1xuICB9XG5cbiAgaWYgKGVycm9ycz8ubGVuZ3RoKSB7XG4gICAgY29uc3QgZXJyb3JNZXNzYWdlcyA9IGF3YWl0IGZvcm1hdE1lc3NhZ2VzKGVycm9ycywgeyBraW5kOiAnZXJyb3InLCBjb2xvcjogdHJ1ZSB9KTtcbiAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihlcnJvck1lc3NhZ2VzLmpvaW4oJ1xcbicpKTtcbiAgfVxufVxuIl19