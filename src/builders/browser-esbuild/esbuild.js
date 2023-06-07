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
    constructor(workspaceRoot, incremental, options, initialFilter) {
        this.workspaceRoot = workspaceRoot;
        this.incremental = incremental;
        this.initialFilter = initialFilter;
        _BundlerContext_esbuildContext.set(this, void 0);
        _BundlerContext_esbuildOptions.set(this, void 0);
        __classPrivateFieldSet(this, _BundlerContext_esbuildOptions, {
            ...options,
            metafile: true,
            write: false,
        }, "f");
    }
    static async bundleAll(contexts) {
        const individualResults = await Promise.all([...contexts].map((context) => context.bundle()));
        // Return directly if only one result
        if (individualResults.length === 1) {
            return individualResults[0];
        }
        let errors;
        const warnings = [];
        const metafile = { inputs: {}, outputs: {} };
        const initialFiles = new Map();
        const outputFiles = [];
        for (const result of individualResults) {
            warnings.push(...result.warnings);
            if (result.errors) {
                errors ?? (errors = []);
                errors.push(...result.errors);
                continue;
            }
            // Combine metafiles used for the stats option as well as bundle budgets and console output
            if (result.metafile) {
                metafile.inputs = { ...metafile.inputs, ...result.metafile.inputs };
                metafile.outputs = { ...metafile.outputs, ...result.metafile.outputs };
            }
            result.initialFiles.forEach((value, key) => initialFiles.set(key, value));
            outputFiles.push(...result.outputFiles);
        }
        if (errors !== undefined) {
            return { errors, warnings };
        }
        return {
            errors,
            warnings,
            metafile,
            initialFiles,
            outputFiles,
        };
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
        const initialFiles = new Map();
        for (const outputFile of result.outputFiles) {
            // Entries in the metafile are relative to the `absWorkingDir` option which is set to the workspaceRoot
            const relativeFilePath = (0, node_path_1.relative)(this.workspaceRoot, outputFile.path);
            const entryPoint = result.metafile.outputs[relativeFilePath]?.entryPoint;
            outputFile.path = relativeFilePath;
            if (entryPoint) {
                // The first part of the filename is the name of file (e.g., "polyfills" for "polyfills.7S5G3MDY.js")
                const name = (0, node_path_1.basename)(relativeFilePath).split('.', 1)[0];
                // Entry points are only styles or scripts
                const type = (0, node_path_1.extname)(relativeFilePath) === '.css' ? 'style' : 'script';
                // Only entrypoints with an entry in the options are initial files.
                // Dynamic imports also have an entryPoint value in the meta file.
                if (__classPrivateFieldGet(this, _BundlerContext_esbuildOptions, "f").entryPoints?.[name]) {
                    // An entryPoint value indicates an initial file
                    const record = {
                        name,
                        type,
                        entrypoint: true,
                    };
                    if (!this.initialFilter || this.initialFilter(record)) {
                        initialFiles.set(relativeFilePath, record);
                    }
                }
            }
        }
        // Analyze for transitive initial files
        const files = [...initialFiles.keys()];
        for (const file of files) {
            for (const initialImport of result.metafile.outputs[file].imports) {
                if (initialFiles.has(initialImport.path)) {
                    continue;
                }
                if (initialImport.kind === 'import-statement' || initialImport.kind === 'import-rule') {
                    const record = {
                        type: initialImport.kind === 'import-rule' ? 'style' : 'script',
                        entrypoint: false,
                        external: initialImport.external,
                    };
                    if (!this.initialFilter || this.initialFilter(record)) {
                        initialFiles.set(initialImport.path, record);
                    }
                    if (!initialImport.external) {
                        files.push(initialImport.path);
                    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXNidWlsZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2Jyb3dzZXItZXNidWlsZC9lc2J1aWxkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7OztBQUdILHFDQVdpQjtBQUNqQix5Q0FBd0Q7QUFZeEQ7Ozs7R0FJRztBQUNILFNBQWdCLGdCQUFnQixDQUFDLEtBQWM7SUFDN0MsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxRQUFRLElBQUksS0FBSyxJQUFJLFVBQVUsSUFBSSxLQUFLLENBQUM7QUFDMUYsQ0FBQztBQUZELDRDQUVDO0FBU0QsTUFBYSxjQUFjO0lBSXpCLFlBQ1UsYUFBcUIsRUFDckIsV0FBb0IsRUFDNUIsT0FBcUIsRUFDYixhQUFpRTtRQUhqRSxrQkFBYSxHQUFiLGFBQWEsQ0FBUTtRQUNyQixnQkFBVyxHQUFYLFdBQVcsQ0FBUztRQUVwQixrQkFBYSxHQUFiLGFBQWEsQ0FBb0Q7UUFQM0UsaURBQWlFO1FBQ2pFLGlEQUFpRTtRQVEvRCx1QkFBQSxJQUFJLGtDQUFtQjtZQUNyQixHQUFHLE9BQU87WUFDVixRQUFRLEVBQUUsSUFBSTtZQUNkLEtBQUssRUFBRSxLQUFLO1NBQ2IsTUFBQSxDQUFDO0lBQ0osQ0FBQztJQUVELE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLFFBQWtDO1FBQ3ZELE1BQU0saUJBQWlCLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFOUYscUNBQXFDO1FBQ3JDLElBQUksaUJBQWlC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Ozs7O09BSUc7SUFDSCxLQUFLLENBQUMsT0FBTztRQUNYLElBQUk7WUFDRixPQUFPLHVCQUFBLElBQUksc0NBQWdCLEVBQUUsT0FBTyxFQUFFLENBQUM7U0FDeEM7Z0JBQVM7WUFDUix1QkFBQSxJQUFJLGtDQUFtQixTQUFTLE1BQUEsQ0FBQztTQUNsQztJQUNILENBQUM7Q0FDRjtBQWhMRCx3Q0FnTEM7O0FBRU0sS0FBSyxVQUFVLFdBQVcsQ0FDL0IsT0FBdUIsRUFDdkIsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUE4RDtJQUVoRixJQUFJLFFBQVEsRUFBRSxNQUFNLEVBQUU7UUFDcEIsTUFBTSxlQUFlLEdBQUcsTUFBTSxJQUFBLHdCQUFjLEVBQUMsUUFBUSxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUN6RixPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDakQ7SUFFRCxJQUFJLE1BQU0sRUFBRSxNQUFNLEVBQUU7UUFDbEIsTUFBTSxhQUFhLEdBQUcsTUFBTSxJQUFBLHdCQUFjLEVBQUMsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNuRixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDaEQ7QUFDSCxDQUFDO0FBYkQsa0NBYUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQnVpbGRlckNvbnRleHQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7XG4gIEJ1aWxkQ29udGV4dCxcbiAgQnVpbGRGYWlsdXJlLFxuICBCdWlsZE9wdGlvbnMsXG4gIE1lc3NhZ2UsXG4gIE1ldGFmaWxlLFxuICBPdXRwdXRGaWxlLFxuICBQYXJ0aWFsTWVzc2FnZSxcbiAgYnVpbGQsXG4gIGNvbnRleHQsXG4gIGZvcm1hdE1lc3NhZ2VzLFxufSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IGJhc2VuYW1lLCBleHRuYW1lLCByZWxhdGl2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5cbmV4cG9ydCB0eXBlIEJ1bmRsZUNvbnRleHRSZXN1bHQgPVxuICB8IHsgZXJyb3JzOiBNZXNzYWdlW107IHdhcm5pbmdzOiBNZXNzYWdlW10gfVxuICB8IHtcbiAgICAgIGVycm9yczogdW5kZWZpbmVkO1xuICAgICAgd2FybmluZ3M6IE1lc3NhZ2VbXTtcbiAgICAgIG1ldGFmaWxlOiBNZXRhZmlsZTtcbiAgICAgIG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW107XG4gICAgICBpbml0aWFsRmlsZXM6IE1hcDxzdHJpbmcsIEluaXRpYWxGaWxlUmVjb3JkPjtcbiAgICB9O1xuXG4vKipcbiAqIERldGVybWluZXMgaWYgYW4gdW5rbm93biB2YWx1ZSBpcyBhbiBlc2J1aWxkIEJ1aWxkRmFpbHVyZSBlcnJvciBvYmplY3QgdGhyb3duIGJ5IGVzYnVpbGQuXG4gKiBAcGFyYW0gdmFsdWUgQSBwb3RlbnRpYWwgZXNidWlsZCBCdWlsZEZhaWx1cmUgZXJyb3Igb2JqZWN0LlxuICogQHJldHVybnMgYHRydWVgIGlmIHRoZSBvYmplY3QgaXMgZGV0ZXJtaW5lZCB0byBiZSBhIEJ1aWxkRmFpbHVyZSBvYmplY3Q7IG90aGVyd2lzZSwgYGZhbHNlYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRXNCdWlsZEZhaWx1cmUodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBCdWlsZEZhaWx1cmUge1xuICByZXR1cm4gISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmICdlcnJvcnMnIGluIHZhbHVlICYmICd3YXJuaW5ncycgaW4gdmFsdWU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5pdGlhbEZpbGVSZWNvcmQge1xuICBlbnRyeXBvaW50OiBib29sZWFuO1xuICBuYW1lPzogc3RyaW5nO1xuICB0eXBlOiAnc2NyaXB0JyB8ICdzdHlsZSc7XG4gIGV4dGVybmFsPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIEJ1bmRsZXJDb250ZXh0IHtcbiAgI2VzYnVpbGRDb250ZXh0PzogQnVpbGRDb250ZXh0PHsgbWV0YWZpbGU6IHRydWU7IHdyaXRlOiBmYWxzZSB9PjtcbiAgI2VzYnVpbGRPcHRpb25zOiBCdWlsZE9wdGlvbnMgJiB7IG1ldGFmaWxlOiB0cnVlOyB3cml0ZTogZmFsc2UgfTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgICBwcml2YXRlIGluY3JlbWVudGFsOiBib29sZWFuLFxuICAgIG9wdGlvbnM6IEJ1aWxkT3B0aW9ucyxcbiAgICBwcml2YXRlIGluaXRpYWxGaWx0ZXI/OiAoaW5pdGlhbDogUmVhZG9ubHk8SW5pdGlhbEZpbGVSZWNvcmQ+KSA9PiBib29sZWFuLFxuICApIHtcbiAgICB0aGlzLiNlc2J1aWxkT3B0aW9ucyA9IHtcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICAgIHdyaXRlOiBmYWxzZSxcbiAgICB9O1xuICB9XG5cbiAgc3RhdGljIGFzeW5jIGJ1bmRsZUFsbChjb250ZXh0czogSXRlcmFibGU8QnVuZGxlckNvbnRleHQ+KTogUHJvbWlzZTxCdW5kbGVDb250ZXh0UmVzdWx0PiB7XG4gICAgY29uc3QgaW5kaXZpZHVhbFJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChbLi4uY29udGV4dHNdLm1hcCgoY29udGV4dCkgPT4gY29udGV4dC5idW5kbGUoKSkpO1xuXG4gICAgLy8gUmV0dXJuIGRpcmVjdGx5IGlmIG9ubHkgb25lIHJlc3VsdFxuICAgIGlmIChpbmRpdmlkdWFsUmVzdWx0cy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHJldHVybiBpbmRpdmlkdWFsUmVzdWx0c1swXTtcbiAgICB9XG5cbiAgICBsZXQgZXJyb3JzOiBNZXNzYWdlW10gfCB1bmRlZmluZWQ7XG4gICAgY29uc3Qgd2FybmluZ3M6IE1lc3NhZ2VbXSA9IFtdO1xuICAgIGNvbnN0IG1ldGFmaWxlOiBNZXRhZmlsZSA9IHsgaW5wdXRzOiB7fSwgb3V0cHV0czoge30gfTtcbiAgICBjb25zdCBpbml0aWFsRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgSW5pdGlhbEZpbGVSZWNvcmQ+KCk7XG4gICAgY29uc3Qgb3V0cHV0RmlsZXMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiBpbmRpdmlkdWFsUmVzdWx0cykge1xuICAgICAgd2FybmluZ3MucHVzaCguLi5yZXN1bHQud2FybmluZ3MpO1xuICAgICAgaWYgKHJlc3VsdC5lcnJvcnMpIHtcbiAgICAgICAgZXJyb3JzID8/PSBbXTtcbiAgICAgICAgZXJyb3JzLnB1c2goLi4ucmVzdWx0LmVycm9ycyk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBDb21iaW5lIG1ldGFmaWxlcyB1c2VkIGZvciB0aGUgc3RhdHMgb3B0aW9uIGFzIHdlbGwgYXMgYnVuZGxlIGJ1ZGdldHMgYW5kIGNvbnNvbGUgb3V0cHV0XG4gICAgICBpZiAocmVzdWx0Lm1ldGFmaWxlKSB7XG4gICAgICAgIG1ldGFmaWxlLmlucHV0cyA9IHsgLi4ubWV0YWZpbGUuaW5wdXRzLCAuLi5yZXN1bHQubWV0YWZpbGUuaW5wdXRzIH07XG4gICAgICAgIG1ldGFmaWxlLm91dHB1dHMgPSB7IC4uLm1ldGFmaWxlLm91dHB1dHMsIC4uLnJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzIH07XG4gICAgICB9XG5cbiAgICAgIHJlc3VsdC5pbml0aWFsRmlsZXMuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4gaW5pdGlhbEZpbGVzLnNldChrZXksIHZhbHVlKSk7XG4gICAgICBvdXRwdXRGaWxlcy5wdXNoKC4uLnJlc3VsdC5vdXRwdXRGaWxlcyk7XG4gICAgfVxuXG4gICAgaWYgKGVycm9ycyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4geyBlcnJvcnMsIHdhcm5pbmdzIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGVycm9ycyxcbiAgICAgIHdhcm5pbmdzLFxuICAgICAgbWV0YWZpbGUsXG4gICAgICBpbml0aWFsRmlsZXMsXG4gICAgICBvdXRwdXRGaWxlcyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGVzIHRoZSBlc2J1aWxkIGJ1aWxkIGZ1bmN0aW9uIGFuZCBub3JtYWxpemVzIHRoZSBidWlsZCByZXN1bHQgaW4gdGhlIGV2ZW50IG9mIGFcbiAgICogYnVpbGQgZmFpbHVyZSB0aGF0IHJlc3VsdHMgaW4gbm8gb3V0cHV0IGJlaW5nIGdlbmVyYXRlZC5cbiAgICogQWxsIGJ1aWxkcyB1c2UgdGhlIGB3cml0ZWAgb3B0aW9uIHdpdGggYSB2YWx1ZSBvZiBgZmFsc2VgIHRvIGFsbG93IGZvciB0aGUgb3V0cHV0IGZpbGVzXG4gICAqIGJ1aWxkIHJlc3VsdCBhcnJheSB0byBiZSBwb3B1bGF0ZWQuXG4gICAqXG4gICAqIEByZXR1cm5zIElmIG91dHB1dCBmaWxlcyBhcmUgZ2VuZXJhdGVkLCB0aGUgZnVsbCBlc2J1aWxkIEJ1aWxkUmVzdWx0OyBpZiBub3QsIHRoZVxuICAgKiB3YXJuaW5ncyBhbmQgZXJyb3JzIGZvciB0aGUgYXR0ZW1wdGVkIGJ1aWxkLlxuICAgKi9cbiAgYXN5bmMgYnVuZGxlKCk6IFByb21pc2U8QnVuZGxlQ29udGV4dFJlc3VsdD4ge1xuICAgIGxldCByZXN1bHQ7XG4gICAgdHJ5IHtcbiAgICAgIGlmICh0aGlzLiNlc2J1aWxkQ29udGV4dCkge1xuICAgICAgICAvLyBSZWJ1aWxkIHVzaW5nIHRoZSBleGlzdGluZyBpbmNyZW1lbnRhbCBidWlsZCBjb250ZXh0XG4gICAgICAgIHJlc3VsdCA9IGF3YWl0IHRoaXMuI2VzYnVpbGRDb250ZXh0LnJlYnVpbGQoKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pbmNyZW1lbnRhbCkge1xuICAgICAgICAvLyBDcmVhdGUgYW4gaW5jcmVtZW50YWwgYnVpbGQgY29udGV4dCBhbmQgcGVyZm9ybSB0aGUgZmlyc3QgYnVpbGQuXG4gICAgICAgIC8vIENvbnRleHQgY3JlYXRpb24gZG9lcyBub3QgcGVyZm9ybSBhIGJ1aWxkLlxuICAgICAgICB0aGlzLiNlc2J1aWxkQ29udGV4dCA9IGF3YWl0IGNvbnRleHQodGhpcy4jZXNidWlsZE9wdGlvbnMpO1xuICAgICAgICByZXN1bHQgPSBhd2FpdCB0aGlzLiNlc2J1aWxkQ29udGV4dC5yZWJ1aWxkKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBGb3Igbm9uLWluY3JlbWVudGFsIGJ1aWxkcywgcGVyZm9ybSBhIHNpbmdsZSBidWlsZFxuICAgICAgICByZXN1bHQgPSBhd2FpdCBidWlsZCh0aGlzLiNlc2J1aWxkT3B0aW9ucyk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZmFpbHVyZSkge1xuICAgICAgLy8gQnVpbGQgZmFpbHVyZXMgd2lsbCB0aHJvdyBhbiBleGNlcHRpb24gd2hpY2ggY29udGFpbnMgZXJyb3JzL3dhcm5pbmdzXG4gICAgICBpZiAoaXNFc0J1aWxkRmFpbHVyZShmYWlsdXJlKSkge1xuICAgICAgICByZXR1cm4gZmFpbHVyZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGZhaWx1cmU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIGlmIHRoZSBidWlsZCBlbmNvdW50ZXJlZCBhbnkgZXJyb3JzXG4gICAgaWYgKHJlc3VsdC5lcnJvcnMubGVuZ3RoKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBlcnJvcnM6IHJlc3VsdC5lcnJvcnMsXG4gICAgICAgIHdhcm5pbmdzOiByZXN1bHQud2FybmluZ3MsXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIEZpbmQgYWxsIGluaXRpYWwgZmlsZXNcbiAgICBjb25zdCBpbml0aWFsRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgSW5pdGlhbEZpbGVSZWNvcmQ+KCk7XG4gICAgZm9yIChjb25zdCBvdXRwdXRGaWxlIG9mIHJlc3VsdC5vdXRwdXRGaWxlcykge1xuICAgICAgLy8gRW50cmllcyBpbiB0aGUgbWV0YWZpbGUgYXJlIHJlbGF0aXZlIHRvIHRoZSBgYWJzV29ya2luZ0RpcmAgb3B0aW9uIHdoaWNoIGlzIHNldCB0byB0aGUgd29ya3NwYWNlUm9vdFxuICAgICAgY29uc3QgcmVsYXRpdmVGaWxlUGF0aCA9IHJlbGF0aXZlKHRoaXMud29ya3NwYWNlUm9vdCwgb3V0cHV0RmlsZS5wYXRoKTtcbiAgICAgIGNvbnN0IGVudHJ5UG9pbnQgPSByZXN1bHQubWV0YWZpbGUub3V0cHV0c1tyZWxhdGl2ZUZpbGVQYXRoXT8uZW50cnlQb2ludDtcblxuICAgICAgb3V0cHV0RmlsZS5wYXRoID0gcmVsYXRpdmVGaWxlUGF0aDtcblxuICAgICAgaWYgKGVudHJ5UG9pbnQpIHtcbiAgICAgICAgLy8gVGhlIGZpcnN0IHBhcnQgb2YgdGhlIGZpbGVuYW1lIGlzIHRoZSBuYW1lIG9mIGZpbGUgKGUuZy4sIFwicG9seWZpbGxzXCIgZm9yIFwicG9seWZpbGxzLjdTNUczTURZLmpzXCIpXG4gICAgICAgIGNvbnN0IG5hbWUgPSBiYXNlbmFtZShyZWxhdGl2ZUZpbGVQYXRoKS5zcGxpdCgnLicsIDEpWzBdO1xuICAgICAgICAvLyBFbnRyeSBwb2ludHMgYXJlIG9ubHkgc3R5bGVzIG9yIHNjcmlwdHNcbiAgICAgICAgY29uc3QgdHlwZSA9IGV4dG5hbWUocmVsYXRpdmVGaWxlUGF0aCkgPT09ICcuY3NzJyA/ICdzdHlsZScgOiAnc2NyaXB0JztcblxuICAgICAgICAvLyBPbmx5IGVudHJ5cG9pbnRzIHdpdGggYW4gZW50cnkgaW4gdGhlIG9wdGlvbnMgYXJlIGluaXRpYWwgZmlsZXMuXG4gICAgICAgIC8vIER5bmFtaWMgaW1wb3J0cyBhbHNvIGhhdmUgYW4gZW50cnlQb2ludCB2YWx1ZSBpbiB0aGUgbWV0YSBmaWxlLlxuICAgICAgICBpZiAoKHRoaXMuI2VzYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzIGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4pPy5bbmFtZV0pIHtcbiAgICAgICAgICAvLyBBbiBlbnRyeVBvaW50IHZhbHVlIGluZGljYXRlcyBhbiBpbml0aWFsIGZpbGVcbiAgICAgICAgICBjb25zdCByZWNvcmQ6IEluaXRpYWxGaWxlUmVjb3JkID0ge1xuICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICBlbnRyeXBvaW50OiB0cnVlLFxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBpZiAoIXRoaXMuaW5pdGlhbEZpbHRlciB8fCB0aGlzLmluaXRpYWxGaWx0ZXIocmVjb3JkKSkge1xuICAgICAgICAgICAgaW5pdGlhbEZpbGVzLnNldChyZWxhdGl2ZUZpbGVQYXRoLCByZWNvcmQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFuYWx5emUgZm9yIHRyYW5zaXRpdmUgaW5pdGlhbCBmaWxlc1xuICAgIGNvbnN0IGZpbGVzID0gWy4uLmluaXRpYWxGaWxlcy5rZXlzKCldO1xuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgZm9yIChjb25zdCBpbml0aWFsSW1wb3J0IG9mIHJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzW2ZpbGVdLmltcG9ydHMpIHtcbiAgICAgICAgaWYgKGluaXRpYWxGaWxlcy5oYXMoaW5pdGlhbEltcG9ydC5wYXRoKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluaXRpYWxJbXBvcnQua2luZCA9PT0gJ2ltcG9ydC1zdGF0ZW1lbnQnIHx8IGluaXRpYWxJbXBvcnQua2luZCA9PT0gJ2ltcG9ydC1ydWxlJykge1xuICAgICAgICAgIGNvbnN0IHJlY29yZDogSW5pdGlhbEZpbGVSZWNvcmQgPSB7XG4gICAgICAgICAgICB0eXBlOiBpbml0aWFsSW1wb3J0LmtpbmQgPT09ICdpbXBvcnQtcnVsZScgPyAnc3R5bGUnIDogJ3NjcmlwdCcsXG4gICAgICAgICAgICBlbnRyeXBvaW50OiBmYWxzZSxcbiAgICAgICAgICAgIGV4dGVybmFsOiBpbml0aWFsSW1wb3J0LmV4dGVybmFsLFxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBpZiAoIXRoaXMuaW5pdGlhbEZpbHRlciB8fCB0aGlzLmluaXRpYWxGaWx0ZXIocmVjb3JkKSkge1xuICAgICAgICAgICAgaW5pdGlhbEZpbGVzLnNldChpbml0aWFsSW1wb3J0LnBhdGgsIHJlY29yZCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCFpbml0aWFsSW1wb3J0LmV4dGVybmFsKSB7XG4gICAgICAgICAgICBmaWxlcy5wdXNoKGluaXRpYWxJbXBvcnQucGF0aCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIHRoZSBzdWNjZXNzZnVsIGJ1aWxkIHJlc3VsdHNcbiAgICByZXR1cm4geyAuLi5yZXN1bHQsIGluaXRpYWxGaWxlcywgZXJyb3JzOiB1bmRlZmluZWQgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEaXNwb3NlcyBpbmNyZW1lbnRhbCBidWlsZCByZXNvdXJjZXMgcHJlc2VudCBpbiB0aGUgY29udGV4dC5cbiAgICpcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBkaXNwb3NhbCBpcyBjb21wbGV0ZS5cbiAgICovXG4gIGFzeW5jIGRpc3Bvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLiNlc2J1aWxkQ29udGV4dD8uZGlzcG9zZSgpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLiNlc2J1aWxkQ29udGV4dCA9IHVuZGVmaW5lZDtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvZ01lc3NhZ2VzKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgeyBlcnJvcnMsIHdhcm5pbmdzIH06IHsgZXJyb3JzPzogUGFydGlhbE1lc3NhZ2VbXTsgd2FybmluZ3M/OiBQYXJ0aWFsTWVzc2FnZVtdIH0sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKHdhcm5pbmdzPy5sZW5ndGgpIHtcbiAgICBjb25zdCB3YXJuaW5nTWVzc2FnZXMgPSBhd2FpdCBmb3JtYXRNZXNzYWdlcyh3YXJuaW5ncywgeyBraW5kOiAnd2FybmluZycsIGNvbG9yOiB0cnVlIH0pO1xuICAgIGNvbnRleHQubG9nZ2VyLndhcm4od2FybmluZ01lc3NhZ2VzLmpvaW4oJ1xcbicpKTtcbiAgfVxuXG4gIGlmIChlcnJvcnM/Lmxlbmd0aCkge1xuICAgIGNvbnN0IGVycm9yTWVzc2FnZXMgPSBhd2FpdCBmb3JtYXRNZXNzYWdlcyhlcnJvcnMsIHsga2luZDogJ2Vycm9yJywgY29sb3I6IHRydWUgfSk7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZXJyb3JNZXNzYWdlcy5qb2luKCdcXG4nKSk7XG4gIH1cbn1cbiJdfQ==