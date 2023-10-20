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
        const outputFiles = result.outputFiles.map((file) => {
            let fileType;
            if ((0, node_path_1.dirname)(file.path) === 'media') {
                fileType = BuildOutputFileType.Media;
            }
            else {
                fileType =
                    this.#esbuildOptions?.platform === 'node'
                        ? BuildOutputFileType.Server
                        : BuildOutputFileType.Browser;
            }
            return (0, utils_1.convertOutputFile)(file, fileType);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlci1jb250ZXh0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9idW5kbGVyLWNvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgscUNBU2lCO0FBQ2pCLHlDQUF1RTtBQUN2RSxtQ0FBNEM7QUFtQjVDLElBQVksbUJBS1g7QUFMRCxXQUFZLG1CQUFtQjtJQUM3QixtRUFBVyxDQUFBO0lBQ1gsK0RBQVMsQ0FBQTtJQUNULGlFQUFVLENBQUE7SUFDViw2REFBUSxDQUFBO0FBQ1YsQ0FBQyxFQUxXLG1CQUFtQixtQ0FBbkIsbUJBQW1CLFFBSzlCO0FBUUQ7Ozs7R0FJRztBQUNILFNBQVMsZ0JBQWdCLENBQUMsS0FBYztJQUN0QyxPQUFPLENBQUMsQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLFFBQVEsSUFBSSxLQUFLLElBQUksVUFBVSxJQUFJLEtBQUssQ0FBQztBQUMxRixDQUFDO0FBRUQsTUFBYSxjQUFjO0lBT2Y7SUFDQTtJQUVBO0lBVFYsZUFBZSxDQUFrRDtJQUNqRSxlQUFlLENBQWtEO0lBRXhELFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO0lBRXhDLFlBQ1UsYUFBcUIsRUFDckIsV0FBb0IsRUFDNUIsT0FBcUIsRUFDYixhQUFpRTtRQUhqRSxrQkFBYSxHQUFiLGFBQWEsQ0FBUTtRQUNyQixnQkFBVyxHQUFYLFdBQVcsQ0FBUztRQUVwQixrQkFBYSxHQUFiLGFBQWEsQ0FBb0Q7UUFFekUsSUFBSSxDQUFDLGVBQWUsR0FBRztZQUNyQixHQUFHLE9BQU87WUFDVixRQUFRLEVBQUUsSUFBSTtZQUNkLEtBQUssRUFBRSxLQUFLO1NBQ2IsQ0FBQztJQUNKLENBQUM7SUFFRCxNQUFNLENBQUMsS0FBSyxDQUFD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WUFDVCxXQUFXO1lBQ1gsWUFBWTtZQUNaLE1BQU0sRUFBRSxTQUFTO1NBQ2xCLENBQUM7SUFDSixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILEtBQUssQ0FBQyxPQUFPO1FBQ1gsSUFBSTtZQUNGLE9BQU8sSUFBSSxDQUFDLGVBQWUsRUFBRSxPQUFPLEVBQUUsQ0FBQztTQUN4QztnQkFBUztZQUNSLElBQUksQ0FBQyxlQUFlLEdBQUcsU0FBUyxDQUFDO1NBQ2xDO0lBQ0gsQ0FBQztDQUNGO0FBaE5ELHdDQWdOQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZENvbnRleHQsXG4gIEJ1aWxkRmFpbHVyZSxcbiAgQnVpbGRPcHRpb25zLFxuICBNZXNzYWdlLFxuICBNZXRhZmlsZSxcbiAgT3V0cHV0RmlsZSxcbiAgYnVpbGQsXG4gIGNvbnRleHQsXG59IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGRpcm5hbWUsIGV4dG5hbWUsIGpvaW4sIHJlbGF0aXZlIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGNvbnZlcnRPdXRwdXRGaWxlIH0gZnJvbSAnLi91dGlscyc7XG5cbmV4cG9ydCB0eXBlIEJ1bmRsZUNvbnRleHRSZXN1bHQgPVxuICB8IHsgZXJyb3JzOiBNZXNzYWdlW107IHdhcm5pbmdzOiBNZXNzYWdlW10gfVxuICB8IHtcbiAgICAgIGVycm9yczogdW5kZWZpbmVkO1xuICAgICAgd2FybmluZ3M6IE1lc3NhZ2VbXTtcbiAgICAgIG1ldGFmaWxlOiBNZXRhZmlsZTtcbiAgICAgIG91dHB1dEZpbGVzOiBCdWlsZE91dHB1dEZpbGVbXTtcbiAgICAgIGluaXRpYWxGaWxlczogTWFwPHN0cmluZywgSW5pdGlhbEZpbGVSZWNvcmQ+O1xuICAgIH07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5pdGlhbEZpbGVSZWNvcmQge1xuICBlbnRyeXBvaW50OiBib29sZWFuO1xuICBuYW1lPzogc3RyaW5nO1xuICB0eXBlOiAnc2NyaXB0JyB8ICdzdHlsZSc7XG4gIGV4dGVybmFsPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGVudW0gQnVpbGRPdXRwdXRGaWxlVHlwZSB7XG4gIEJyb3dzZXIgPSAxLFxuICBNZWRpYSA9IDIsXG4gIFNlcnZlciA9IDMsXG4gIFJvb3QgPSA0LFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWxkT3V0cHV0RmlsZSBleHRlbmRzIE91dHB1dEZpbGUge1xuICB0eXBlOiBCdWlsZE91dHB1dEZpbGVUeXBlO1xuICBmdWxsT3V0cHV0UGF0aDogc3RyaW5nO1xuICBjbG9uZTogKCkgPT4gQnVpbGRPdXRwdXRGaWxlO1xufVxuXG4vKipcbiAqIERldGVybWluZXMgaWYgYW4gdW5rbm93biB2YWx1ZSBpcyBhbiBlc2J1aWxkIEJ1aWxkRmFpbHVyZSBlcnJvciBvYmplY3QgdGhyb3duIGJ5IGVzYnVpbGQuXG4gKiBAcGFyYW0gdmFsdWUgQSBwb3RlbnRpYWwgZXNidWlsZCBCdWlsZEZhaWx1cmUgZXJyb3Igb2JqZWN0LlxuICogQHJldHVybnMgYHRydWVgIGlmIHRoZSBvYmplY3QgaXMgZGV0ZXJtaW5lZCB0byBiZSBhIEJ1aWxkRmFpbHVyZSBvYmplY3Q7IG90aGVyd2lzZSwgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNFc0J1aWxkRmFpbHVyZSh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIEJ1aWxkRmFpbHVyZSB7XG4gIHJldHVybiAhIXZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgJ2Vycm9ycycgaW4gdmFsdWUgJiYgJ3dhcm5pbmdzJyBpbiB2YWx1ZTtcbn1cblxuZXhwb3J0IGNsYXNzIEJ1bmRsZXJDb250ZXh0IHtcbiAgI2VzYnVpbGRDb250ZXh0PzogQnVpbGRDb250ZXh0PHsgbWV0YWZpbGU6IHRydWU7IHdyaXRlOiBmYWxzZSB9PjtcbiAgI2VzYnVpbGRPcHRpb25zOiBCdWlsZE9wdGlvbnMgJiB7IG1ldGFmaWxlOiB0cnVlOyB3cml0ZTogZmFsc2UgfTtcblxuICByZWFkb25seSB3YXRjaEZpbGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSB3b3Jrc3BhY2VSb290OiBzdHJpbmcsXG4gICAgcHJpdmF0ZSBpbmNyZW1lbnRhbDogYm9vbGVhbixcbiAgICBvcHRpb25zOiBCdWlsZE9wdGlvbnMsXG4gICAgcHJpdmF0ZSBpbml0aWFsRmlsdGVyPzogKGluaXRpYWw6IFJlYWRvbmx5PEluaXRpYWxGaWxlUmVjb3JkPikgPT4gYm9vbGVhbixcbiAgKSB7XG4gICAgdGhpcy4jZXNidWlsZE9wdGlvbnMgPSB7XG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgbWV0YWZpbGU6IHRydWUsXG4gICAgICB3cml0ZTogZmFsc2UsXG4gICAgfTtcbiAgfVxuXG4gIHN0YXRpYyBhc3luYyBidW5kbGVBbGwoY29udGV4dHM6IEl0ZXJhYmxlPEJ1bmRsZXJDb250ZXh0Pik6IFByb21pc2U8QnVuZGxlQ29udGV4dFJlc3VsdD4ge1xuICAgIGNvbnN0IGluZGl2aWR1YWxSZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoWy4uLmNvbnRleHRzXS5tYXAoKGNvbnRleHQpID0+IGNvbnRleHQuYnVuZGxlKCkpKTtcblxuICAgIC8vIFJldHVybiBkaXJlY3RseSBpZiBvbmx5IG9uZSByZXN1bHRcbiAgICBpZiAoaW5kaXZpZHVhbFJlc3VsdHMubGVuZ3RoID09PSAxKSB7XG4gICAgICByZXR1cm4gaW5kaXZpZHVhbFJlc3VsdHNbMF07XG4gICAgfVxuXG4gICAgbGV0IGVycm9yczogTWVzc2FnZVtdIHwgdW5kZWZpbmVkO1xuICAgIGNvbnN0IHdhcm5pbmdzOiBNZXNzYWdlW10gPSBbXTtcbiAgICBjb25zdCBtZXRhZmlsZTogTWV0YWZpbGUgPSB7IGlucHV0czoge30sIG91dHB1dHM6IHt9IH07XG4gICAgY29uc3QgaW5pdGlhbEZpbGVzID0gbmV3IE1hcDxzdHJpbmcsIEluaXRpYWxGaWxlUmVjb3JkPigpO1xuICAgIGNvbnN0IG91dHB1dEZpbGVzID0gW107XG4gICAgZm9yIChjb25zdCByZXN1bHQgb2YgaW5kaXZpZHVhbFJlc3VsdHMpIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goLi4ucmVzdWx0Lndhcm5pbmdzKTtcbiAgICAgIGlmIChyZXN1bHQuZXJyb3JzKSB7XG4gICAgICAgIGVycm9ycyA/Pz0gW107XG4gICAgICAgIGVycm9ycy5wdXNoKC4uLnJlc3VsdC5lcnJvcnMpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQ29tYmluZSBtZXRhZmlsZXMgdXNlZCBmb3IgdGhlIHN0YXRzIG9wdGlvbiBhcyB3ZWxsIGFzIGJ1bmRsZSBidWRnZXRzIGFuZCBjb25zb2xlIG91dHB1dFxuICAgICAgaWYgKHJlc3VsdC5tZXRhZmlsZSkge1xuICAgICAgICBtZXRhZmlsZS5pbnB1dHMgPSB7IC4uLm1ldGFmaWxlLmlucHV0cywgLi4ucmVzdWx0Lm1ldGFmaWxlLmlucHV0cyB9O1xuICAgICAgICBtZXRhZmlsZS5vdXRwdXRzID0geyAuLi5tZXRhZmlsZS5vdXRwdXRzLCAuLi5yZXN1bHQubWV0YWZpbGUub3V0cHV0cyB9O1xuICAgICAgfVxuXG4gICAgICByZXN1bHQuaW5pdGlhbEZpbGVzLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IGluaXRpYWxGaWxlcy5zZXQoa2V5LCB2YWx1ZSkpO1xuICAgICAgb3V0cHV0RmlsZXMucHVzaCguLi5yZXN1bHQub3V0cHV0RmlsZXMpO1xuICAgIH1cblxuICAgIGlmIChlcnJvcnMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHsgZXJyb3JzLCB3YXJuaW5ncyB9O1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBlcnJvcnMsXG4gICAgICB3YXJuaW5ncyxcbiAgICAgIG1ldGFmaWxlLFxuICAgICAgaW5pdGlhbEZpbGVzLFxuICAgICAgb3V0cHV0RmlsZXMsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlcyB0aGUgZXNidWlsZCBidWlsZCBmdW5jdGlvbiBhbmQgbm9ybWFsaXplcyB0aGUgYnVpbGQgcmVzdWx0IGluIHRoZSBldmVudCBvZiBhXG4gICAqIGJ1aWxkIGZhaWx1cmUgdGhhdCByZXN1bHRzIGluIG5vIG91dHB1dCBiZWluZyBnZW5lcmF0ZWQuXG4gICAqIEFsbCBidWlsZHMgdXNlIHRoZSBgd3JpdGVgIG9wdGlvbiB3aXRoIGEgdmFsdWUgb2YgYGZhbHNlYCB0byBhbGxvdyBmb3IgdGhlIG91dHB1dCBmaWxlc1xuICAgKiBidWlsZCByZXN1bHQgYXJyYXkgdG8gYmUgcG9wdWxhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBJZiBvdXRwdXQgZmlsZXMgYXJlIGdlbmVyYXRlZCwgdGhlIGZ1bGwgZXNidWlsZCBCdWlsZFJlc3VsdDsgaWYgbm90LCB0aGVcbiAgICogd2FybmluZ3MgYW5kIGVycm9ycyBmb3IgdGhlIGF0dGVtcHRlZCBidWlsZC5cbiAgICovXG4gIGFzeW5jIGJ1bmRsZSgpOiBQcm9taXNlPEJ1bmRsZUNvbnRleHRSZXN1bHQ+IHtcbiAgICBsZXQgcmVzdWx0O1xuICAgIHRyeSB7XG4gICAgICBpZiAodGhpcy4jZXNidWlsZENvbnRleHQpIHtcbiAgICAgICAgLy8gUmVidWlsZCB1c2luZyB0aGUgZXhpc3RpbmcgaW5jcmVtZW50YWwgYnVpbGQgY29udGV4dFxuICAgICAgICByZXN1bHQgPSBhd2FpdCB0aGlzLiNlc2J1aWxkQ29udGV4dC5yZWJ1aWxkKCk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaW5jcmVtZW50YWwpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGFuIGluY3JlbWVudGFsIGJ1aWxkIGNvbnRleHQgYW5kIHBlcmZvcm0gdGhlIGZpcnN0IGJ1aWxkLlxuICAgICAgICAvLyBDb250ZXh0IGNyZWF0aW9uIGRvZXMgbm90IHBlcmZvcm0gYSBidWlsZC5cbiAgICAgICAgdGhpcy4jZXNidWlsZENvbnRleHQgPSBhd2FpdCBjb250ZXh0KHRoaXMuI2VzYnVpbGRPcHRpb25zKTtcbiAgICAgICAgcmVzdWx0ID0gYXdhaXQgdGhpcy4jZXNidWlsZENvbnRleHQucmVidWlsZCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRm9yIG5vbi1pbmNyZW1lbnRhbCBidWlsZHMsIHBlcmZvcm0gYSBzaW5nbGUgYnVpbGRcbiAgICAgICAgcmVzdWx0ID0gYXdhaXQgYnVpbGQodGhpcy4jZXNidWlsZE9wdGlvbnMpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGZhaWx1cmUpIHtcbiAgICAgIC8vIEJ1aWxkIGZhaWx1cmVzIHdpbGwgdGhyb3cgYW4gZXhjZXB0aW9uIHdoaWNoIGNvbnRhaW5zIGVycm9ycy93YXJuaW5nc1xuICAgICAgaWYgKGlzRXNCdWlsZEZhaWx1cmUoZmFpbHVyZSkpIHtcbiAgICAgICAgcmV0dXJuIGZhaWx1cmU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBmYWlsdXJlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFVwZGF0ZSBmaWxlcyB0aGF0IHNob3VsZCBiZSB3YXRjaGVkLlxuICAgIC8vIFdoaWxlIHRoaXMgc2hvdWxkIHRlY2huaWNhbGx5IG5vdCBiZSBsaW5rZWQgdG8gaW5jcmVtZW50YWwgbW9kZSwgaW5jcmVtZW50YWwgaXMgb25seVxuICAgIC8vIGN1cnJlbnRseSBlbmFibGVkIHdpdGggd2F0Y2ggbW9kZSB3aGVyZSB3YXRjaCBmaWxlcyBhcmUgbmVlZGVkLlxuICAgIGlmICh0aGlzLmluY3JlbWVudGFsKSB7XG4gICAgICB0aGlzLndhdGNoRmlsZXMuY2xlYXIoKTtcbiAgICAgIC8vIEFkZCBpbnB1dCBmaWxlcyBleGNlcHQgdmlydHVhbCBhbmd1bGFyIGZpbGVzIHdoaWNoIGRvIG5vdCBleGlzdCBvbiBkaXNrXG4gICAgICBPYmplY3Qua2V5cyhyZXN1bHQubWV0YWZpbGUuaW5wdXRzKVxuICAgICAgICAuZmlsdGVyKChpbnB1dCkgPT4gIWlucHV0LnN0YXJ0c1dpdGgoJ2FuZ3VsYXI6JykpXG4gICAgICAgIC5mb3JFYWNoKChpbnB1dCkgPT4gdGhpcy53YXRjaEZpbGVzLmFkZChqb2luKHRoaXMud29ya3NwYWNlUm9vdCwgaW5wdXQpKSk7XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIGlmIHRoZSBidWlsZCBlbmNvdW50ZXJlZCBhbnkgZXJyb3JzXG4gICAgaWYgKHJlc3VsdC5lcnJvcnMubGVuZ3RoKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBlcnJvcnM6IHJlc3VsdC5lcnJvcnMsXG4gICAgICAgIHdhcm5pbmdzOiByZXN1bHQud2FybmluZ3MsXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIEZpbmQgYWxsIGluaXRpYWwgZmlsZXNcbiAgICBjb25zdCBpbml0aWFsRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgSW5pdGlhbEZpbGVSZWNvcmQ+KCk7XG4gICAgZm9yIChjb25zdCBvdXRwdXRGaWxlIG9mIHJlc3VsdC5vdXRwdXRGaWxlcykge1xuICAgICAgLy8gRW50cmllcyBpbiB0aGUgbWV0YWZpbGUgYXJlIHJlbGF0aXZlIHRvIHRoZSBgYWJzV29ya2luZ0RpcmAgb3B0aW9uIHdoaWNoIGlzIHNldCB0byB0aGUgd29ya3NwYWNlUm9vdFxuICAgICAgY29uc3QgcmVsYXRpdmVGaWxlUGF0aCA9IHJlbGF0aXZlKHRoaXMud29ya3NwYWNlUm9vdCwgb3V0cHV0RmlsZS5wYXRoKTtcbiAgICAgIGNvbnN0IGVudHJ5UG9pbnQgPSByZXN1bHQubWV0YWZpbGUub3V0cHV0c1tyZWxhdGl2ZUZpbGVQYXRoXT8uZW50cnlQb2ludDtcblxuICAgICAgb3V0cHV0RmlsZS5wYXRoID0gcmVsYXRpdmVGaWxlUGF0aDtcblxuICAgICAgaWYgKGVudHJ5UG9pbnQpIHtcbiAgICAgICAgLy8gVGhlIGZpcnN0IHBhcnQgb2YgdGhlIGZpbGVuYW1lIGlzIHRoZSBuYW1lIG9mIGZpbGUgKGUuZy4sIFwicG9seWZpbGxzXCIgZm9yIFwicG9seWZpbGxzLTdTNUczTURZLmpzXCIpXG4gICAgICAgIGNvbnN0IG5hbWUgPSBiYXNlbmFtZShyZWxhdGl2ZUZpbGVQYXRoKS5yZXBsYWNlKC8oPzotW1xcZEEtWl17OH0pP1xcLlthLXpdezIsM30kLywgJycpO1xuICAgICAgICAvLyBFbnRyeSBwb2ludHMgYXJlIG9ubHkgc3R5bGVzIG9yIHNjcmlwdHNcbiAgICAgICAgY29uc3QgdHlwZSA9IGV4dG5hbWUocmVsYXRpdmVGaWxlUGF0aCkgPT09ICcuY3NzJyA/ICdzdHlsZScgOiAnc2NyaXB0JztcblxuICAgICAgICAvLyBPbmx5IGVudHJ5cG9pbnRzIHdpdGggYW4gZW50cnkgaW4gdGhlIG9wdGlvbnMgYXJlIGluaXRpYWwgZmlsZXMuXG4gICAgICAgIC8vIER5bmFtaWMgaW1wb3J0cyBhbHNvIGhhdmUgYW4gZW50cnlQb2ludCB2YWx1ZSBpbiB0aGUgbWV0YSBmaWxlLlxuICAgICAgICBpZiAoKHRoaXMuI2VzYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzIGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4pPy5bbmFtZV0pIHtcbiAgICAgICAgICAvLyBBbiBlbnRyeVBvaW50IHZhbHVlIGluZGljYXRlcyBhbiBpbml0aWFsIGZpbGVcbiAgICAgICAgICBjb25zdCByZWNvcmQ6IEluaXRpYWxGaWxlUmVjb3JkID0ge1xuICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICBlbnRyeXBvaW50OiB0cnVlLFxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBpZiAoIXRoaXMuaW5pdGlhbEZpbHRlciB8fCB0aGlzLmluaXRpYWxGaWx0ZXIocmVjb3JkKSkge1xuICAgICAgICAgICAgaW5pdGlhbEZpbGVzLnNldChyZWxhdGl2ZUZpbGVQYXRoLCByZWNvcmQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFuYWx5emUgZm9yIHRyYW5zaXRpdmUgaW5pdGlhbCBmaWxlc1xuICAgIGNvbnN0IGZpbGVzID0gWy4uLmluaXRpYWxGaWxlcy5rZXlzKCldO1xuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgZm9yIChjb25zdCBpbml0aWFsSW1wb3J0IG9mIHJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzW2ZpbGVdLmltcG9ydHMpIHtcbiAgICAgICAgaWYgKGluaXRpYWxGaWxlcy5oYXMoaW5pdGlhbEltcG9ydC5wYXRoKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluaXRpYWxJbXBvcnQua2luZCA9PT0gJ2ltcG9ydC1zdGF0ZW1lbnQnIHx8IGluaXRpYWxJbXBvcnQua2luZCA9PT0gJ2ltcG9ydC1ydWxlJykge1xuICAgICAgICAgIGNvbnN0IHJlY29yZDogSW5pdGlhbEZpbGVSZWNvcmQgPSB7XG4gICAgICAgICAgICB0eXBlOiBpbml0aWFsSW1wb3J0LmtpbmQgPT09ICdpbXBvcnQtcnVsZScgPyAnc3R5bGUnIDogJ3NjcmlwdCcsXG4gICAgICAgICAgICBlbnRyeXBvaW50OiBmYWxzZSxcbiAgICAgICAgICAgIGV4dGVybmFsOiBpbml0aWFsSW1wb3J0LmV4dGVybmFsLFxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBpZiAoIXRoaXMuaW5pdGlhbEZpbHRlciB8fCB0aGlzLmluaXRpYWxGaWx0ZXIocmVjb3JkKSkge1xuICAgICAgICAgICAgaW5pdGlhbEZpbGVzLnNldChpbml0aWFsSW1wb3J0LnBhdGgsIHJlY29yZCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCFpbml0aWFsSW1wb3J0LmV4dGVybmFsKSB7XG4gICAgICAgICAgICBmaWxlcy5wdXNoKGluaXRpYWxJbXBvcnQucGF0aCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgb3V0cHV0RmlsZXMgPSByZXN1bHQub3V0cHV0RmlsZXMubWFwKChmaWxlKSA9PiB7XG4gICAgICBsZXQgZmlsZVR5cGU6IEJ1aWxkT3V0cHV0RmlsZVR5cGU7XG4gICAgICBpZiAoZGlybmFtZShmaWxlLnBhdGgpID09PSAnbWVkaWEnKSB7XG4gICAgICAgIGZpbGVUeXBlID0gQnVpbGRPdXRwdXRGaWxlVHlwZS5NZWRpYTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZpbGVUeXBlID1cbiAgICAgICAgICB0aGlzLiNlc2J1aWxkT3B0aW9ucz8ucGxhdGZvcm0gPT09ICdub2RlJ1xuICAgICAgICAgICAgPyBCdWlsZE91dHB1dEZpbGVUeXBlLlNlcnZlclxuICAgICAgICAgICAgOiBCdWlsZE91dHB1dEZpbGVUeXBlLkJyb3dzZXI7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBjb252ZXJ0T3V0cHV0RmlsZShmaWxlLCBmaWxlVHlwZSk7XG4gICAgfSk7XG5cbiAgICAvLyBSZXR1cm4gdGhlIHN1Y2Nlc3NmdWwgYnVpbGQgcmVzdWx0c1xuICAgIHJldHVybiB7XG4gICAgICAuLi5yZXN1bHQsXG4gICAgICBvdXRwdXRGaWxlcyxcbiAgICAgIGluaXRpYWxGaWxlcyxcbiAgICAgIGVycm9yczogdW5kZWZpbmVkLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRGlzcG9zZXMgaW5jcmVtZW50YWwgYnVpbGQgcmVzb3VyY2VzIHByZXNlbnQgaW4gdGhlIGNvbnRleHQuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gZGlzcG9zYWwgaXMgY29tcGxldGUuXG4gICAqL1xuICBhc3luYyBkaXNwb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdGhpcy4jZXNidWlsZENvbnRleHQ/LmRpc3Bvc2UoKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgdGhpcy4jZXNidWlsZENvbnRleHQgPSB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG59XG4iXX0=