"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BundlerContext = exports.BuildOutputFileType = void 0;
const esbuild_1 = require("esbuild");
const node_path_1 = require("node:path");
const utils_1 = require("./utils");
var BuildOutputFileType;
(function (BuildOutputFileType) {
    BuildOutputFileType[BuildOutputFileType["Browser"] = 1] = "Browser";
    BuildOutputFileType[BuildOutputFileType["Media"] = 2] = "Media";
    BuildOutputFileType[BuildOutputFileType["Server"] = 3] = "Server";
    BuildOutputFileType[BuildOutputFileType["Root"] = 4] = "Root";
})(BuildOutputFileType || (exports.BuildOutputFileType = BuildOutputFileType = {}));
/**
 * Determines if an unknown value is an esbuild BuildFailure error object thrown by esbuild.
 * @param value A potential esbuild BuildFailure error object.
 * @returns `true` if the object is determined to be a BuildFailure object; otherwise, `false`.
 */
function isEsBuildFailure(value) {
    return !!value && typeof value === 'object' && 'errors' in value && 'warnings' in value;
}
class BundlerContext {
    workspaceRoot;
    incremental;
    initialFilter;
    #esbuildContext;
    #esbuildOptions;
    watchFiles = new Set();
    constructor(workspaceRoot, incremental, options, initialFilter) {
        this.workspaceRoot = workspaceRoot;
        this.incremental = incremental;
        this.initialFilter = initialFilter;
        this.#esbuildOptions = {
            ...options,
            metafile: true,
            write: false,
        };
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
                errors ??= [];
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
            if (this.#esbuildContext) {
                // Rebuild using the existing incremental build context
                result = await this.#esbuildContext.rebuild();
            }
            else if (this.incremental) {
                // Create an incremental build context and perform the first build.
                // Context creation does not perform a build.
                this.#esbuildContext = await (0, esbuild_1.context)(this.#esbuildOptions);
                result = await this.#esbuildContext.rebuild();
            }
            else {
                // For non-incremental builds, perform a single build
                result = await (0, esbuild_1.build)(this.#esbuildOptions);
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
        // Update files that should be watched.
        // While this should technically not be linked to incremental mode, incremental is only
        // currently enabled with watch mode where watch files are needed.
        if (this.incremental) {
            this.watchFiles.clear();
            // Add input files except virtual angular files which do not exist on disk
            Object.keys(result.metafile.inputs)
                .filter((input) => !input.startsWith('angular:'))
                .forEach((input) => this.watchFiles.add((0, node_path_1.join)(this.workspaceRoot, input)));
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
                // The first part of the filename is the name of file (e.g., "polyfills" for "polyfills-7S5G3MDY.js")
                const name = (0, node_path_1.basename)(relativeFilePath).replace(/(?:-[\dA-Z]{8})?\.[a-z]{2,3}$/, '');
                // Entry points are only styles or scripts
                const type = (0, node_path_1.extname)(relativeFilePath) === '.css' ? 'style' : 'script';
                // Only entrypoints with an entry in the options are initial files.
                // Dynamic imports also have an entryPoint value in the meta file.
                if (this.#esbuildOptions.entryPoints?.[name]) {
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
        const outputFiles = result.outputFiles.map(({ contents, path }) => {
            let fileType;
            if ((0, node_path_1.dirname)(path) === 'media') {
                fileType = BuildOutputFileType.Media;
            }
            else {
                fileType =
                    this.#esbuildOptions?.platform === 'node'
                        ? BuildOutputFileType.Server
                        : BuildOutputFileType.Browser;
            }
            return (0, utils_1.createOutputFileFromData)(path, contents, fileType);
        });
        // Return the successful build results
        return {
            ...result,
            outputFiles,
            initialFiles,
            errors: undefined,
        };
    }
    /**
     * Disposes incremental build resources present in the context.
     *
     * @returns A promise that resolves when disposal is complete.
     */
    async dispose() {
        try {
            return this.#esbuildContext?.dispose();
        }
        finally {
            this.#esbuildContext = undefined;
        }
    }
}
exports.BundlerContext = BundlerContext;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlci1jb250ZXh0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9idW5kbGVyLWNvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgscUNBU2lCO0FBQ2pCLHlDQUF1RTtBQUN2RSxtQ0FBNkU7QUFtQjdFLElBQVksbUJBS1g7QUFMRCxXQUFZLG1CQUFtQjtJQUM3QixtRUFBVyxDQUFBO0lBQ1gsK0RBQVMsQ0FBQTtJQUNULGlFQUFVLENBQUE7SUFDViw2REFBUSxDQUFBO0FBQ1YsQ0FBQyxFQUxXLG1CQUFtQixtQ0FBbkIsbUJBQW1CLFFBSzlCO0FBUUQ7Ozs7R0FJRztBQUNILFNBQVMsZ0JBQWdCLENBQUMsS0FBYztJQUN0QyxPQUFPLENBQUMsQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLFFBQVEsSUFBSSxLQUFLLElBQUksVUFBVSxJQUFJLEtBQUssQ0FBQztBQUMxRixDQUFDO0FBRUQsTUFBYSxjQUFjO0lBT2Y7SUFDQTtJQUVBO0lBVFYsZUFBZSxDQUFrRDtJQUNqRSxlQUFlLENBQWtEO0lBRXhELFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO0lBRXhDLFlBQ1UsYUFBcUIsRUFDckIsV0FBb0IsRUFDNUIsT0FBcUIsRUFDYixhQUFpRTtRQUhqRSxrQkFBYSxHQUFiLGFBQWEsQ0FBUTtRQUNyQixnQkFBVyxHQUFYLFdBQVcsQ0FBUztRQUVwQixrQkFBYSxHQUFiLGFBQWEsQ0FBb0Q7UUFFekUsSUFBSSxDQUFDLGVBQWUsR0FBRztZQUNyQixHQUFHLE9BQU87WUFDVixRQUFRLEVBQUUsSUFBSTtZQUNkLEtBQUssRUFBRSxLQUFLO1NBQ2IsQ0FBQztJQUNKLENBQUM7SUFFRCxNQUFNLENBQUMsS0FBSyxDQUFD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T0FBTztZQUNMLEdBQUcsTUFBTTtZQUNULFdBQVc7WUFDWCxZQUFZO1lBQ1osTUFBTSxFQUFFLFNBQVM7U0FDbEIsQ0FBQztJQUNKLENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsS0FBSyxDQUFDLE9BQU87UUFDWCxJQUFJO1lBQ0YsT0FBTyxJQUFJLENBQUMsZUFBZSxFQUFFLE9BQU8sRUFBRSxDQUFDO1NBQ3hDO2dCQUFTO1lBQ1IsSUFBSSxDQUFDLGVBQWUsR0FBRyxTQUFTLENBQUM7U0FDbEM7SUFDSCxDQUFDO0NBQ0Y7QUFoTkQsd0NBZ05DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkQ29udGV4dCxcbiAgQnVpbGRGYWlsdXJlLFxuICBCdWlsZE9wdGlvbnMsXG4gIE1lc3NhZ2UsXG4gIE1ldGFmaWxlLFxuICBPdXRwdXRGaWxlLFxuICBidWlsZCxcbiAgY29udGV4dCxcbn0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSwgZXh0bmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgY3JlYXRlT3V0cHV0RmlsZUZyb21EYXRhLCBjcmVhdGVPdXRwdXRGaWxlRnJvbVRleHQgfSBmcm9tICcuL3V0aWxzJztcblxuZXhwb3J0IHR5cGUgQnVuZGxlQ29udGV4dFJlc3VsdCA9XG4gIHwgeyBlcnJvcnM6IE1lc3NhZ2VbXTsgd2FybmluZ3M6IE1lc3NhZ2VbXSB9XG4gIHwge1xuICAgICAgZXJyb3JzOiB1bmRlZmluZWQ7XG4gICAgICB3YXJuaW5nczogTWVzc2FnZVtdO1xuICAgICAgbWV0YWZpbGU6IE1ldGFmaWxlO1xuICAgICAgb3V0cHV0RmlsZXM6IEJ1aWxkT3V0cHV0RmlsZVtdO1xuICAgICAgaW5pdGlhbEZpbGVzOiBNYXA8c3RyaW5nLCBJbml0aWFsRmlsZVJlY29yZD47XG4gICAgfTtcblxuZXhwb3J0IGludGVyZmFjZSBJbml0aWFsRmlsZVJlY29yZCB7XG4gIGVudHJ5cG9pbnQ6IGJvb2xlYW47XG4gIG5hbWU/OiBzdHJpbmc7XG4gIHR5cGU6ICdzY3JpcHQnIHwgJ3N0eWxlJztcbiAgZXh0ZXJuYWw/OiBib29sZWFuO1xufVxuXG5leHBvcnQgZW51bSBCdWlsZE91dHB1dEZpbGVUeXBlIHtcbiAgQnJvd3NlciA9IDEsXG4gIE1lZGlhID0gMixcbiAgU2VydmVyID0gMyxcbiAgUm9vdCA9IDQsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbGRPdXRwdXRGaWxlIGV4dGVuZHMgT3V0cHV0RmlsZSB7XG4gIHR5cGU6IEJ1aWxkT3V0cHV0RmlsZVR5cGU7XG4gIGZ1bGxPdXRwdXRQYXRoOiBzdHJpbmc7XG4gIGNsb25lOiAoKSA9PiBCdWlsZE91dHB1dEZpbGU7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lcyBpZiBhbiB1bmtub3duIHZhbHVlIGlzIGFuIGVzYnVpbGQgQnVpbGRGYWlsdXJlIGVycm9yIG9iamVjdCB0aHJvd24gYnkgZXNidWlsZC5cbiAqIEBwYXJhbSB2YWx1ZSBBIHBvdGVudGlhbCBlc2J1aWxkIEJ1aWxkRmFpbHVyZSBlcnJvciBvYmplY3QuXG4gKiBAcmV0dXJucyBgdHJ1ZWAgaWYgdGhlIG9iamVjdCBpcyBkZXRlcm1pbmVkIHRvIGJlIGEgQnVpbGRGYWlsdXJlIG9iamVjdDsgb3RoZXJ3aXNlLCBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0VzQnVpbGRGYWlsdXJlKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgQnVpbGRGYWlsdXJlIHtcbiAgcmV0dXJuICEhdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiAnZXJyb3JzJyBpbiB2YWx1ZSAmJiAnd2FybmluZ3MnIGluIHZhbHVlO1xufVxuXG5leHBvcnQgY2xhc3MgQnVuZGxlckNvbnRleHQge1xuICAjZXNidWlsZENvbnRleHQ/OiBCdWlsZENvbnRleHQ8eyBtZXRhZmlsZTogdHJ1ZTsgd3JpdGU6IGZhbHNlIH0+O1xuICAjZXNidWlsZE9wdGlvbnM6IEJ1aWxkT3B0aW9ucyAmIHsgbWV0YWZpbGU6IHRydWU7IHdyaXRlOiBmYWxzZSB9O1xuXG4gIHJlYWRvbmx5IHdhdGNoRmlsZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgICBwcml2YXRlIGluY3JlbWVudGFsOiBib29sZWFuLFxuICAgIG9wdGlvbnM6IEJ1aWxkT3B0aW9ucyxcbiAgICBwcml2YXRlIGluaXRpYWxGaWx0ZXI/OiAoaW5pdGlhbDogUmVhZG9ubHk8SW5pdGlhbEZpbGVSZWNvcmQ+KSA9PiBib29sZWFuLFxuICApIHtcbiAgICB0aGlzLiNlc2J1aWxkT3B0aW9ucyA9IHtcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgICBtZXRhZmlsZTogdHJ1ZSxcbiAgICAgIHdyaXRlOiBmYWxzZSxcbiAgICB9O1xuICB9XG5cbiAgc3RhdGljIGFzeW5jIGJ1bmRsZUFsbChjb250ZXh0czogSXRlcmFibGU8QnVuZGxlckNvbnRleHQ+KTogUHJvbWlzZTxCdW5kbGVDb250ZXh0UmVzdWx0PiB7XG4gICAgY29uc3QgaW5kaXZpZHVhbFJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChbLi4uY29udGV4dHNdLm1hcCgoY29udGV4dCkgPT4gY29udGV4dC5idW5kbGUoKSkpO1xuXG4gICAgLy8gUmV0dXJuIGRpcmVjdGx5IGlmIG9ubHkgb25lIHJlc3VsdFxuICAgIGlmIChpbmRpdmlkdWFsUmVzdWx0cy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHJldHVybiBpbmRpdmlkdWFsUmVzdWx0c1swXTtcbiAgICB9XG5cbiAgICBsZXQgZXJyb3JzOiBNZXNzYWdlW10gfCB1bmRlZmluZWQ7XG4gICAgY29uc3Qgd2FybmluZ3M6IE1lc3NhZ2VbXSA9IFtdO1xuICAgIGNvbnN0IG1ldGFmaWxlOiBNZXRhZmlsZSA9IHsgaW5wdXRzOiB7fSwgb3V0cHV0czoge30gfTtcbiAgICBjb25zdCBpbml0aWFsRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgSW5pdGlhbEZpbGVSZWNvcmQ+KCk7XG4gICAgY29uc3Qgb3V0cHV0RmlsZXMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiBpbmRpdmlkdWFsUmVzdWx0cykge1xuICAgICAgd2FybmluZ3MucHVzaCguLi5yZXN1bHQud2FybmluZ3MpO1xuICAgICAgaWYgKHJlc3VsdC5lcnJvcnMpIHtcbiAgICAgICAgZXJyb3JzID8/PSBbXTtcbiAgICAgICAgZXJyb3JzLnB1c2goLi4ucmVzdWx0LmVycm9ycyk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBDb21iaW5lIG1ldGFmaWxlcyB1c2VkIGZvciB0aGUgc3RhdHMgb3B0aW9uIGFzIHdlbGwgYXMgYnVuZGxlIGJ1ZGdldHMgYW5kIGNvbnNvbGUgb3V0cHV0XG4gICAgICBpZiAocmVzdWx0Lm1ldGFmaWxlKSB7XG4gICAgICAgIG1ldGFmaWxlLmlucHV0cyA9IHsgLi4ubWV0YWZpbGUuaW5wdXRzLCAuLi5yZXN1bHQubWV0YWZpbGUuaW5wdXRzIH07XG4gICAgICAgIG1ldGFmaWxlLm91dHB1dHMgPSB7IC4uLm1ldGFmaWxlLm91dHB1dHMsIC4uLnJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzIH07XG4gICAgICB9XG5cbiAgICAgIHJlc3VsdC5pbml0aWFsRmlsZXMuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4gaW5pdGlhbEZpbGVzLnNldChrZXksIHZhbHVlKSk7XG4gICAgICBvdXRwdXRGaWxlcy5wdXNoKC4uLnJlc3VsdC5vdXRwdXRGaWxlcyk7XG4gICAgfVxuXG4gICAgaWYgKGVycm9ycyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4geyBlcnJvcnMsIHdhcm5pbmdzIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGVycm9ycyxcbiAgICAgIHdhcm5pbmdzLFxuICAgICAgbWV0YWZpbGUsXG4gICAgICBpbml0aWFsRmlsZXMsXG4gICAgICBvdXRwdXRGaWxlcyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGVzIHRoZSBlc2J1aWxkIGJ1aWxkIGZ1bmN0aW9uIGFuZCBub3JtYWxpemVzIHRoZSBidWlsZCByZXN1bHQgaW4gdGhlIGV2ZW50IG9mIGFcbiAgICogYnVpbGQgZmFpbHVyZSB0aGF0IHJlc3VsdHMgaW4gbm8gb3V0cHV0IGJlaW5nIGdlbmVyYXRlZC5cbiAgICogQWxsIGJ1aWxkcyB1c2UgdGhlIGB3cml0ZWAgb3B0aW9uIHdpdGggYSB2YWx1ZSBvZiBgZmFsc2VgIHRvIGFsbG93IGZvciB0aGUgb3V0cHV0IGZpbGVzXG4gICAqIGJ1aWxkIHJlc3VsdCBhcnJheSB0byBiZSBwb3B1bGF0ZWQuXG4gICAqXG4gICAqIEByZXR1cm5zIElmIG91dHB1dCBmaWxlcyBhcmUgZ2VuZXJhdGVkLCB0aGUgZnVsbCBlc2J1aWxkIEJ1aWxkUmVzdWx0OyBpZiBub3QsIHRoZVxuICAgKiB3YXJuaW5ncyBhbmQgZXJyb3JzIGZvciB0aGUgYXR0ZW1wdGVkIGJ1aWxkLlxuICAgKi9cbiAgYXN5bmMgYnVuZGxlKCk6IFByb21pc2U8QnVuZGxlQ29udGV4dFJlc3VsdD4ge1xuICAgIGxldCByZXN1bHQ7XG4gICAgdHJ5IHtcbiAgICAgIGlmICh0aGlzLiNlc2J1aWxkQ29udGV4dCkge1xuICAgICAgICAvLyBSZWJ1aWxkIHVzaW5nIHRoZSBleGlzdGluZyBpbmNyZW1lbnRhbCBidWlsZCBjb250ZXh0XG4gICAgICAgIHJlc3VsdCA9IGF3YWl0IHRoaXMuI2VzYnVpbGRDb250ZXh0LnJlYnVpbGQoKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pbmNyZW1lbnRhbCkge1xuICAgICAgICAvLyBDcmVhdGUgYW4gaW5jcmVtZW50YWwgYnVpbGQgY29udGV4dCBhbmQgcGVyZm9ybSB0aGUgZmlyc3QgYnVpbGQuXG4gICAgICAgIC8vIENvbnRleHQgY3JlYXRpb24gZG9lcyBub3QgcGVyZm9ybSBhIGJ1aWxkLlxuICAgICAgICB0aGlzLiNlc2J1aWxkQ29udGV4dCA9IGF3YWl0IGNvbnRleHQodGhpcy4jZXNidWlsZE9wdGlvbnMpO1xuICAgICAgICByZXN1bHQgPSBhd2FpdCB0aGlzLiNlc2J1aWxkQ29udGV4dC5yZWJ1aWxkKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBGb3Igbm9uLWluY3JlbWVudGFsIGJ1aWxkcywgcGVyZm9ybSBhIHNpbmdsZSBidWlsZFxuICAgICAgICByZXN1bHQgPSBhd2FpdCBidWlsZCh0aGlzLiNlc2J1aWxkT3B0aW9ucyk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZmFpbHVyZSkge1xuICAgICAgLy8gQnVpbGQgZmFpbHVyZXMgd2lsbCB0aHJvdyBhbiBleGNlcHRpb24gd2hpY2ggY29udGFpbnMgZXJyb3JzL3dhcm5pbmdzXG4gICAgICBpZiAoaXNFc0J1aWxkRmFpbHVyZShmYWlsdXJlKSkge1xuICAgICAgICByZXR1cm4gZmFpbHVyZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGZhaWx1cmU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIGZpbGVzIHRoYXQgc2hvdWxkIGJlIHdhdGNoZWQuXG4gICAgLy8gV2hpbGUgdGhpcyBzaG91bGQgdGVjaG5pY2FsbHkgbm90IGJlIGxpbmtlZCB0byBpbmNyZW1lbnRhbCBtb2RlLCBpbmNyZW1lbnRhbCBpcyBvbmx5XG4gICAgLy8gY3VycmVudGx5IGVuYWJsZWQgd2l0aCB3YXRjaCBtb2RlIHdoZXJlIHdhdGNoIGZpbGVzIGFyZSBuZWVkZWQuXG4gICAgaWYgKHRoaXMuaW5jcmVtZW50YWwpIHtcbiAgICAgIHRoaXMud2F0Y2hGaWxlcy5jbGVhcigpO1xuICAgICAgLy8gQWRkIGlucHV0IGZpbGVzIGV4Y2VwdCB2aXJ0dWFsIGFuZ3VsYXIgZmlsZXMgd2hpY2ggZG8gbm90IGV4aXN0IG9uIGRpc2tcbiAgICAgIE9iamVjdC5rZXlzKHJlc3VsdC5tZXRhZmlsZS5pbnB1dHMpXG4gICAgICAgIC5maWx0ZXIoKGlucHV0KSA9PiAhaW5wdXQuc3RhcnRzV2l0aCgnYW5ndWxhcjonKSlcbiAgICAgICAgLmZvckVhY2goKGlucHV0KSA9PiB0aGlzLndhdGNoRmlsZXMuYWRkKGpvaW4odGhpcy53b3Jrc3BhY2VSb290LCBpbnB1dCkpKTtcbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gaWYgdGhlIGJ1aWxkIGVuY291bnRlcmVkIGFueSBlcnJvcnNcbiAgICBpZiAocmVzdWx0LmVycm9ycy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVycm9yczogcmVzdWx0LmVycm9ycyxcbiAgICAgICAgd2FybmluZ3M6IHJlc3VsdC53YXJuaW5ncyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gRmluZCBhbGwgaW5pdGlhbCBmaWxlc1xuICAgIGNvbnN0IGluaXRpYWxGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBJbml0aWFsRmlsZVJlY29yZD4oKTtcbiAgICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2YgcmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgICAvLyBFbnRyaWVzIGluIHRoZSBtZXRhZmlsZSBhcmUgcmVsYXRpdmUgdG8gdGhlIGBhYnNXb3JraW5nRGlyYCBvcHRpb24gd2hpY2ggaXMgc2V0IHRvIHRoZSB3b3Jrc3BhY2VSb290XG4gICAgICBjb25zdCByZWxhdGl2ZUZpbGVQYXRoID0gcmVsYXRpdmUodGhpcy53b3Jrc3BhY2VSb290LCBvdXRwdXRGaWxlLnBhdGgpO1xuICAgICAgY29uc3QgZW50cnlQb2ludCA9IHJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzW3JlbGF0aXZlRmlsZVBhdGhdPy5lbnRyeVBvaW50O1xuXG4gICAgICBvdXRwdXRGaWxlLnBhdGggPSByZWxhdGl2ZUZpbGVQYXRoO1xuXG4gICAgICBpZiAoZW50cnlQb2ludCkge1xuICAgICAgICAvLyBUaGUgZmlyc3QgcGFydCBvZiB0aGUgZmlsZW5hbWUgaXMgdGhlIG5hbWUgb2YgZmlsZSAoZS5nLiwgXCJwb2x5ZmlsbHNcIiBmb3IgXCJwb2x5ZmlsbHMtN1M1RzNNRFkuanNcIilcbiAgICAgICAgY29uc3QgbmFtZSA9IGJhc2VuYW1lKHJlbGF0aXZlRmlsZVBhdGgpLnJlcGxhY2UoLyg/Oi1bXFxkQS1aXXs4fSk/XFwuW2Etel17MiwzfSQvLCAnJyk7XG4gICAgICAgIC8vIEVudHJ5IHBvaW50cyBhcmUgb25seSBzdHlsZXMgb3Igc2NyaXB0c1xuICAgICAgICBjb25zdCB0eXBlID0gZXh0bmFtZShyZWxhdGl2ZUZpbGVQYXRoKSA9PT0gJy5jc3MnID8gJ3N0eWxlJyA6ICdzY3JpcHQnO1xuXG4gICAgICAgIC8vIE9ubHkgZW50cnlwb2ludHMgd2l0aCBhbiBlbnRyeSBpbiB0aGUgb3B0aW9ucyBhcmUgaW5pdGlhbCBmaWxlcy5cbiAgICAgICAgLy8gRHluYW1pYyBpbXBvcnRzIGFsc28gaGF2ZSBhbiBlbnRyeVBvaW50IHZhbHVlIGluIHRoZSBtZXRhIGZpbGUuXG4gICAgICAgIGlmICgodGhpcy4jZXNidWlsZE9wdGlvbnMuZW50cnlQb2ludHMgYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPik/LltuYW1lXSkge1xuICAgICAgICAgIC8vIEFuIGVudHJ5UG9pbnQgdmFsdWUgaW5kaWNhdGVzIGFuIGluaXRpYWwgZmlsZVxuICAgICAgICAgIGNvbnN0IHJlY29yZDogSW5pdGlhbEZpbGVSZWNvcmQgPSB7XG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIGVudHJ5cG9pbnQ6IHRydWUsXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGlmICghdGhpcy5pbml0aWFsRmlsdGVyIHx8IHRoaXMuaW5pdGlhbEZpbHRlcihyZWNvcmQpKSB7XG4gICAgICAgICAgICBpbml0aWFsRmlsZXMuc2V0KHJlbGF0aXZlRmlsZVBhdGgsIHJlY29yZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQW5hbHl6ZSBmb3IgdHJhbnNpdGl2ZSBpbml0aWFsIGZpbGVzXG4gICAgY29uc3QgZmlsZXMgPSBbLi4uaW5pdGlhbEZpbGVzLmtleXMoKV07XG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IGluaXRpYWxJbXBvcnQgb2YgcmVzdWx0Lm1ldGFmaWxlLm91dHB1dHNbZmlsZV0uaW1wb3J0cykge1xuICAgICAgICBpZiAoaW5pdGlhbEZpbGVzLmhhcyhpbml0aWFsSW1wb3J0LnBhdGgpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5pdGlhbEltcG9ydC5raW5kID09PSAnaW1wb3J0LXN0YXRlbWVudCcgfHwgaW5pdGlhbEltcG9ydC5raW5kID09PSAnaW1wb3J0LXJ1bGUnKSB7XG4gICAgICAgICAgY29uc3QgcmVjb3JkOiBJbml0aWFsRmlsZVJlY29yZCA9IHtcbiAgICAgICAgICAgIHR5cGU6IGluaXRpYWxJbXBvcnQua2luZCA9PT0gJ2ltcG9ydC1ydWxlJyA/ICdzdHlsZScgOiAnc2NyaXB0JyxcbiAgICAgICAgICAgIGVudHJ5cG9pbnQ6IGZhbHNlLFxuICAgICAgICAgICAgZXh0ZXJuYWw6IGluaXRpYWxJbXBvcnQuZXh0ZXJuYWwsXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGlmICghdGhpcy5pbml0aWFsRmlsdGVyIHx8IHRoaXMuaW5pdGlhbEZpbHRlcihyZWNvcmQpKSB7XG4gICAgICAgICAgICBpbml0aWFsRmlsZXMuc2V0KGluaXRpYWxJbXBvcnQucGF0aCwgcmVjb3JkKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoIWluaXRpYWxJbXBvcnQuZXh0ZXJuYWwpIHtcbiAgICAgICAgICAgIGZpbGVzLnB1c2goaW5pdGlhbEltcG9ydC5wYXRoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBvdXRwdXRGaWxlcyA9IHJlc3VsdC5vdXRwdXRGaWxlcy5tYXAoKHsgY29udGVudHMsIHBhdGggfSkgPT4ge1xuICAgICAgbGV0IGZpbGVUeXBlOiBCdWlsZE91dHB1dEZpbGVUeXBlO1xuICAgICAgaWYgKGRpcm5hbWUocGF0aCkgPT09ICdtZWRpYScpIHtcbiAgICAgICAgZmlsZVR5cGUgPSBCdWlsZE91dHB1dEZpbGVUeXBlLk1lZGlhO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmlsZVR5cGUgPVxuICAgICAgICAgIHRoaXMuI2VzYnVpbGRPcHRpb25zPy5wbGF0Zm9ybSA9PT0gJ25vZGUnXG4gICAgICAgICAgICA/IEJ1aWxkT3V0cHV0RmlsZVR5cGUuU2VydmVyXG4gICAgICAgICAgICA6IEJ1aWxkT3V0cHV0RmlsZVR5cGUuQnJvd3NlcjtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGNyZWF0ZU91dHB1dEZpbGVGcm9tRGF0YShwYXRoLCBjb250ZW50cywgZmlsZVR5cGUpO1xuICAgIH0pO1xuXG4gICAgLy8gUmV0dXJuIHRoZSBzdWNjZXNzZnVsIGJ1aWxkIHJlc3VsdHNcbiAgICByZXR1cm4ge1xuICAgICAgLi4ucmVzdWx0LFxuICAgICAgb3V0cHV0RmlsZXMsXG4gICAgICBpbml0aWFsRmlsZXMsXG4gICAgICBlcnJvcnM6IHVuZGVmaW5lZCxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIERpc3Bvc2VzIGluY3JlbWVudGFsIGJ1aWxkIHJlc291cmNlcyBwcmVzZW50IGluIHRoZSBjb250ZXh0LlxuICAgKlxuICAgKiBAcmV0dXJucyBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGRpc3Bvc2FsIGlzIGNvbXBsZXRlLlxuICAgKi9cbiAgYXN5bmMgZGlzcG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHRoaXMuI2VzYnVpbGRDb250ZXh0Py5kaXNwb3NlKCk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuI2VzYnVpbGRDb250ZXh0ID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxufVxuIl19