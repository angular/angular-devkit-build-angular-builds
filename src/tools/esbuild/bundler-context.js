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
exports.BundlerContext = void 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlci1jb250ZXh0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9idW5kbGVyLWNvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7O0FBRUgscUNBU2lCO0FBQ2pCLHlDQUF3RDtBQW1CeEQ7Ozs7R0FJRztBQUNILFNBQVMsZ0JBQWdCLENBQUMsS0FBYztJQUN0QyxPQUFPLENBQUMsQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLFFBQVEsSUFBSSxLQUFLLElBQUksVUFBVSxJQUFJLEtBQUssQ0FBQztBQUMxRixDQUFDO0FBRUQsTUFBYSxjQUFjO0lBSXpCLFlBQ1UsYUFBcUIsRUFDckIsV0FBb0IsRUFDNUIsT0FBcUIsRUFDYixhQUFpRTtRQUhqRSxrQkFBYSxHQUFiLGFBQWEsQ0FBUTtRQUNyQixnQkFBVyxHQUFYLFdBQVcsQ0FBUztRQUVwQixrQkFBYSxHQUFiLGFBQWEsQ0FBb0Q7UUFQM0UsaURBQWlFO1FBQ2pFLGlEQUFpRTtRQVEvRCx1QkFBQSxJQUFJLGtDQUFtQjtZQUNyQixHQUFHLE9BQU87WUFDVixRQUFRLEVBQUUsSUFBSTtZQUNkLEtBQUssRUFBRSxLQUFLO1NBQ2IsTUFBQSxDQUFDO0lBQ0osQ0FBQztJQUVELE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLFFBQWtDO1FBQ3ZELE1BQU0saUJBQWlCLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFOUYscUNBQXFDO1FBQ3JDLElBQUksaUJBQWlCLENBQUMs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SUc7SUFDSCxLQUFLLENBQUMsT0FBTztRQUNYLElBQUk7WUFDRixPQUFPLHVCQUFBLElBQUksc0NBQWdCLEVBQUUsT0FBTyxFQUFFLENBQUM7U0FDeEM7Z0JBQVM7WUFDUix1QkFBQSxJQUFJLGtDQUFtQixTQUFTLE1BQUEsQ0FBQztTQUNsQztJQUNILENBQUM7Q0FDRjtBQWhMRCx3Q0FnTEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgQnVpbGRDb250ZXh0LFxuICBCdWlsZEZhaWx1cmUsXG4gIEJ1aWxkT3B0aW9ucyxcbiAgTWVzc2FnZSxcbiAgTWV0YWZpbGUsXG4gIE91dHB1dEZpbGUsXG4gIGJ1aWxkLFxuICBjb250ZXh0LFxufSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB7IGJhc2VuYW1lLCBleHRuYW1lLCByZWxhdGl2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XG5cbmV4cG9ydCB0eXBlIEJ1bmRsZUNvbnRleHRSZXN1bHQgPVxuICB8IHsgZXJyb3JzOiBNZXNzYWdlW107IHdhcm5pbmdzOiBNZXNzYWdlW10gfVxuICB8IHtcbiAgICAgIGVycm9yczogdW5kZWZpbmVkO1xuICAgICAgd2FybmluZ3M6IE1lc3NhZ2VbXTtcbiAgICAgIG1ldGFmaWxlOiBNZXRhZmlsZTtcbiAgICAgIG91dHB1dEZpbGVzOiBPdXRwdXRGaWxlW107XG4gICAgICBpbml0aWFsRmlsZXM6IE1hcDxzdHJpbmcsIEluaXRpYWxGaWxlUmVjb3JkPjtcbiAgICB9O1xuXG5leHBvcnQgaW50ZXJmYWNlIEluaXRpYWxGaWxlUmVjb3JkIHtcbiAgZW50cnlwb2ludDogYm9vbGVhbjtcbiAgbmFtZT86IHN0cmluZztcbiAgdHlwZTogJ3NjcmlwdCcgfCAnc3R5bGUnO1xuICBleHRlcm5hbD86IGJvb2xlYW47XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lcyBpZiBhbiB1bmtub3duIHZhbHVlIGlzIGFuIGVzYnVpbGQgQnVpbGRGYWlsdXJlIGVycm9yIG9iamVjdCB0aHJvd24gYnkgZXNidWlsZC5cbiAqIEBwYXJhbSB2YWx1ZSBBIHBvdGVudGlhbCBlc2J1aWxkIEJ1aWxkRmFpbHVyZSBlcnJvciBvYmplY3QuXG4gKiBAcmV0dXJucyBgdHJ1ZWAgaWYgdGhlIG9iamVjdCBpcyBkZXRlcm1pbmVkIHRvIGJlIGEgQnVpbGRGYWlsdXJlIG9iamVjdDsgb3RoZXJ3aXNlLCBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0VzQnVpbGRGYWlsdXJlKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgQnVpbGRGYWlsdXJlIHtcbiAgcmV0dXJuICEhdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiAnZXJyb3JzJyBpbiB2YWx1ZSAmJiAnd2FybmluZ3MnIGluIHZhbHVlO1xufVxuXG5leHBvcnQgY2xhc3MgQnVuZGxlckNvbnRleHQge1xuICAjZXNidWlsZENvbnRleHQ/OiBCdWlsZENvbnRleHQ8eyBtZXRhZmlsZTogdHJ1ZTsgd3JpdGU6IGZhbHNlIH0+O1xuICAjZXNidWlsZE9wdGlvbnM6IEJ1aWxkT3B0aW9ucyAmIHsgbWV0YWZpbGU6IHRydWU7IHdyaXRlOiBmYWxzZSB9O1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICAgIHByaXZhdGUgaW5jcmVtZW50YWw6IGJvb2xlYW4sXG4gICAgb3B0aW9uczogQnVpbGRPcHRpb25zLFxuICAgIHByaXZhdGUgaW5pdGlhbEZpbHRlcj86IChpbml0aWFsOiBSZWFkb25seTxJbml0aWFsRmlsZVJlY29yZD4pID0+IGJvb2xlYW4sXG4gICkge1xuICAgIHRoaXMuI2VzYnVpbGRPcHRpb25zID0ge1xuICAgICAgLi4ub3B0aW9ucyxcbiAgICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgICAgd3JpdGU6IGZhbHNlLFxuICAgIH07XG4gIH1cblxuICBzdGF0aWMgYXN5bmMgYnVuZGxlQWxsKGNvbnRleHRzOiBJdGVyYWJsZTxCdW5kbGVyQ29udGV4dD4pOiBQcm9taXNlPEJ1bmRsZUNvbnRleHRSZXN1bHQ+IHtcbiAgICBjb25zdCBpbmRpdmlkdWFsUmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKFsuLi5jb250ZXh0c10ubWFwKChjb250ZXh0KSA9PiBjb250ZXh0LmJ1bmRsZSgpKSk7XG5cbiAgICAvLyBSZXR1cm4gZGlyZWN0bHkgaWYgb25seSBvbmUgcmVzdWx0XG4gICAgaWYgKGluZGl2aWR1YWxSZXN1bHRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgcmV0dXJuIGluZGl2aWR1YWxSZXN1bHRzWzBdO1xuICAgIH1cblxuICAgIGxldCBlcnJvcnM6IE1lc3NhZ2VbXSB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCB3YXJuaW5nczogTWVzc2FnZVtdID0gW107XG4gICAgY29uc3QgbWV0YWZpbGU6IE1ldGFmaWxlID0geyBpbnB1dHM6IHt9LCBvdXRwdXRzOiB7fSB9O1xuICAgIGNvbnN0IGluaXRpYWxGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBJbml0aWFsRmlsZVJlY29yZD4oKTtcbiAgICBjb25zdCBvdXRwdXRGaWxlcyA9IFtdO1xuICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIGluZGl2aWR1YWxSZXN1bHRzKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKC4uLnJlc3VsdC53YXJuaW5ncyk7XG4gICAgICBpZiAocmVzdWx0LmVycm9ycykge1xuICAgICAgICBlcnJvcnMgPz89IFtdO1xuICAgICAgICBlcnJvcnMucHVzaCguLi5yZXN1bHQuZXJyb3JzKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIENvbWJpbmUgbWV0YWZpbGVzIHVzZWQgZm9yIHRoZSBzdGF0cyBvcHRpb24gYXMgd2VsbCBhcyBidW5kbGUgYnVkZ2V0cyBhbmQgY29uc29sZSBvdXRwdXRcbiAgICAgIGlmIChyZXN1bHQubWV0YWZpbGUpIHtcbiAgICAgICAgbWV0YWZpbGUuaW5wdXRzID0geyAuLi5tZXRhZmlsZS5pbnB1dHMsIC4uLnJlc3VsdC5tZXRhZmlsZS5pbnB1dHMgfTtcbiAgICAgICAgbWV0YWZpbGUub3V0cHV0cyA9IHsgLi4ubWV0YWZpbGUub3V0cHV0cywgLi4ucmVzdWx0Lm1ldGFmaWxlLm91dHB1dHMgfTtcbiAgICAgIH1cblxuICAgICAgcmVzdWx0LmluaXRpYWxGaWxlcy5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiBpbml0aWFsRmlsZXMuc2V0KGtleSwgdmFsdWUpKTtcbiAgICAgIG91dHB1dEZpbGVzLnB1c2goLi4ucmVzdWx0Lm91dHB1dEZpbGVzKTtcbiAgICB9XG5cbiAgICBpZiAoZXJyb3JzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB7IGVycm9ycywgd2FybmluZ3MgfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgZXJyb3JzLFxuICAgICAgd2FybmluZ3MsXG4gICAgICBtZXRhZmlsZSxcbiAgICAgIGluaXRpYWxGaWxlcyxcbiAgICAgIG91dHB1dEZpbGVzLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZXMgdGhlIGVzYnVpbGQgYnVpbGQgZnVuY3Rpb24gYW5kIG5vcm1hbGl6ZXMgdGhlIGJ1aWxkIHJlc3VsdCBpbiB0aGUgZXZlbnQgb2YgYVxuICAgKiBidWlsZCBmYWlsdXJlIHRoYXQgcmVzdWx0cyBpbiBubyBvdXRwdXQgYmVpbmcgZ2VuZXJhdGVkLlxuICAgKiBBbGwgYnVpbGRzIHVzZSB0aGUgYHdyaXRlYCBvcHRpb24gd2l0aCBhIHZhbHVlIG9mIGBmYWxzZWAgdG8gYWxsb3cgZm9yIHRoZSBvdXRwdXQgZmlsZXNcbiAgICogYnVpbGQgcmVzdWx0IGFycmF5IHRvIGJlIHBvcHVsYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgSWYgb3V0cHV0IGZpbGVzIGFyZSBnZW5lcmF0ZWQsIHRoZSBmdWxsIGVzYnVpbGQgQnVpbGRSZXN1bHQ7IGlmIG5vdCwgdGhlXG4gICAqIHdhcm5pbmdzIGFuZCBlcnJvcnMgZm9yIHRoZSBhdHRlbXB0ZWQgYnVpbGQuXG4gICAqL1xuICBhc3luYyBidW5kbGUoKTogUHJvbWlzZTxCdW5kbGVDb250ZXh0UmVzdWx0PiB7XG4gICAgbGV0IHJlc3VsdDtcbiAgICB0cnkge1xuICAgICAgaWYgKHRoaXMuI2VzYnVpbGRDb250ZXh0KSB7XG4gICAgICAgIC8vIFJlYnVpbGQgdXNpbmcgdGhlIGV4aXN0aW5nIGluY3JlbWVudGFsIGJ1aWxkIGNvbnRleHRcbiAgICAgICAgcmVzdWx0ID0gYXdhaXQgdGhpcy4jZXNidWlsZENvbnRleHQucmVidWlsZCgpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmluY3JlbWVudGFsKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhbiBpbmNyZW1lbnRhbCBidWlsZCBjb250ZXh0IGFuZCBwZXJmb3JtIHRoZSBmaXJzdCBidWlsZC5cbiAgICAgICAgLy8gQ29udGV4dCBjcmVhdGlvbiBkb2VzIG5vdCBwZXJmb3JtIGEgYnVpbGQuXG4gICAgICAgIHRoaXMuI2VzYnVpbGRDb250ZXh0ID0gYXdhaXQgY29udGV4dCh0aGlzLiNlc2J1aWxkT3B0aW9ucyk7XG4gICAgICAgIHJlc3VsdCA9IGF3YWl0IHRoaXMuI2VzYnVpbGRDb250ZXh0LnJlYnVpbGQoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEZvciBub24taW5jcmVtZW50YWwgYnVpbGRzLCBwZXJmb3JtIGEgc2luZ2xlIGJ1aWxkXG4gICAgICAgIHJlc3VsdCA9IGF3YWl0IGJ1aWxkKHRoaXMuI2VzYnVpbGRPcHRpb25zKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChmYWlsdXJlKSB7XG4gICAgICAvLyBCdWlsZCBmYWlsdXJlcyB3aWxsIHRocm93IGFuIGV4Y2VwdGlvbiB3aGljaCBjb250YWlucyBlcnJvcnMvd2FybmluZ3NcbiAgICAgIGlmIChpc0VzQnVpbGRGYWlsdXJlKGZhaWx1cmUpKSB7XG4gICAgICAgIHJldHVybiBmYWlsdXJlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZmFpbHVyZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gaWYgdGhlIGJ1aWxkIGVuY291bnRlcmVkIGFueSBlcnJvcnNcbiAgICBpZiAocmVzdWx0LmVycm9ycy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVycm9yczogcmVzdWx0LmVycm9ycyxcbiAgICAgICAgd2FybmluZ3M6IHJlc3VsdC53YXJuaW5ncyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gRmluZCBhbGwgaW5pdGlhbCBmaWxlc1xuICAgIGNvbnN0IGluaXRpYWxGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBJbml0aWFsRmlsZVJlY29yZD4oKTtcbiAgICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2YgcmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgICAvLyBFbnRyaWVzIGluIHRoZSBtZXRhZmlsZSBhcmUgcmVsYXRpdmUgdG8gdGhlIGBhYnNXb3JraW5nRGlyYCBvcHRpb24gd2hpY2ggaXMgc2V0IHRvIHRoZSB3b3Jrc3BhY2VSb290XG4gICAgICBjb25zdCByZWxhdGl2ZUZpbGVQYXRoID0gcmVsYXRpdmUodGhpcy53b3Jrc3BhY2VSb290LCBvdXRwdXRGaWxlLnBhdGgpO1xuICAgICAgY29uc3QgZW50cnlQb2ludCA9IHJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzW3JlbGF0aXZlRmlsZVBhdGhdPy5lbnRyeVBvaW50O1xuXG4gICAgICBvdXRwdXRGaWxlLnBhdGggPSByZWxhdGl2ZUZpbGVQYXRoO1xuXG4gICAgICBpZiAoZW50cnlQb2ludCkge1xuICAgICAgICAvLyBUaGUgZmlyc3QgcGFydCBvZiB0aGUgZmlsZW5hbWUgaXMgdGhlIG5hbWUgb2YgZmlsZSAoZS5nLiwgXCJwb2x5ZmlsbHNcIiBmb3IgXCJwb2x5ZmlsbHMuN1M1RzNNRFkuanNcIilcbiAgICAgICAgY29uc3QgbmFtZSA9IGJhc2VuYW1lKHJlbGF0aXZlRmlsZVBhdGgpLnNwbGl0KCcuJywgMSlbMF07XG4gICAgICAgIC8vIEVudHJ5IHBvaW50cyBhcmUgb25seSBzdHlsZXMgb3Igc2NyaXB0c1xuICAgICAgICBjb25zdCB0eXBlID0gZXh0bmFtZShyZWxhdGl2ZUZpbGVQYXRoKSA9PT0gJy5jc3MnID8gJ3N0eWxlJyA6ICdzY3JpcHQnO1xuXG4gICAgICAgIC8vIE9ubHkgZW50cnlwb2ludHMgd2l0aCBhbiBlbnRyeSBpbiB0aGUgb3B0aW9ucyBhcmUgaW5pdGlhbCBmaWxlcy5cbiAgICAgICAgLy8gRHluYW1pYyBpbXBvcnRzIGFsc28gaGF2ZSBhbiBlbnRyeVBvaW50IHZhbHVlIGluIHRoZSBtZXRhIGZpbGUuXG4gICAgICAgIGlmICgodGhpcy4jZXNidWlsZE9wdGlvbnMuZW50cnlQb2ludHMgYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPik/LltuYW1lXSkge1xuICAgICAgICAgIC8vIEFuIGVudHJ5UG9pbnQgdmFsdWUgaW5kaWNhdGVzIGFuIGluaXRpYWwgZmlsZVxuICAgICAgICAgIGNvbnN0IHJlY29yZDogSW5pdGlhbEZpbGVSZWNvcmQgPSB7XG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIGVudHJ5cG9pbnQ6IHRydWUsXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGlmICghdGhpcy5pbml0aWFsRmlsdGVyIHx8IHRoaXMuaW5pdGlhbEZpbHRlcihyZWNvcmQpKSB7XG4gICAgICAgICAgICBpbml0aWFsRmlsZXMuc2V0KHJlbGF0aXZlRmlsZVBhdGgsIHJlY29yZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQW5hbHl6ZSBmb3IgdHJhbnNpdGl2ZSBpbml0aWFsIGZpbGVzXG4gICAgY29uc3QgZmlsZXMgPSBbLi4uaW5pdGlhbEZpbGVzLmtleXMoKV07XG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IGluaXRpYWxJbXBvcnQgb2YgcmVzdWx0Lm1ldGFmaWxlLm91dHB1dHNbZmlsZV0uaW1wb3J0cykge1xuICAgICAgICBpZiAoaW5pdGlhbEZpbGVzLmhhcyhpbml0aWFsSW1wb3J0LnBhdGgpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5pdGlhbEltcG9ydC5raW5kID09PSAnaW1wb3J0LXN0YXRlbWVudCcgfHwgaW5pdGlhbEltcG9ydC5raW5kID09PSAnaW1wb3J0LXJ1bGUnKSB7XG4gICAgICAgICAgY29uc3QgcmVjb3JkOiBJbml0aWFsRmlsZVJlY29yZCA9IHtcbiAgICAgICAgICAgIHR5cGU6IGluaXRpYWxJbXBvcnQua2luZCA9PT0gJ2ltcG9ydC1ydWxlJyA/ICdzdHlsZScgOiAnc2NyaXB0JyxcbiAgICAgICAgICAgIGVudHJ5cG9pbnQ6IGZhbHNlLFxuICAgICAgICAgICAgZXh0ZXJuYWw6IGluaXRpYWxJbXBvcnQuZXh0ZXJuYWwsXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGlmICghdGhpcy5pbml0aWFsRmlsdGVyIHx8IHRoaXMuaW5pdGlhbEZpbHRlcihyZWNvcmQpKSB7XG4gICAgICAgICAgICBpbml0aWFsRmlsZXMuc2V0KGluaXRpYWxJbXBvcnQucGF0aCwgcmVjb3JkKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoIWluaXRpYWxJbXBvcnQuZXh0ZXJuYWwpIHtcbiAgICAgICAgICAgIGZpbGVzLnB1c2goaW5pdGlhbEltcG9ydC5wYXRoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gdGhlIHN1Y2Nlc3NmdWwgYnVpbGQgcmVzdWx0c1xuICAgIHJldHVybiB7IC4uLnJlc3VsdCwgaW5pdGlhbEZpbGVzLCBlcnJvcnM6IHVuZGVmaW5lZCB9O1xuICB9XG5cbiAgLyoqXG4gICAqIERpc3Bvc2VzIGluY3JlbWVudGFsIGJ1aWxkIHJlc291cmNlcyBwcmVzZW50IGluIHRoZSBjb250ZXh0LlxuICAgKlxuICAgKiBAcmV0dXJucyBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGRpc3Bvc2FsIGlzIGNvbXBsZXRlLlxuICAgKi9cbiAgYXN5bmMgZGlzcG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHRoaXMuI2VzYnVpbGRDb250ZXh0Py5kaXNwb3NlKCk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuI2VzYnVpbGRDb250ZXh0ID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxufVxuIl19