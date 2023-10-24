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
const load_result_cache_1 = require("./load-result-cache");
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
    #esbuildResult;
    #optionsFactory;
    #shouldCacheResult;
    #loadCache;
    watchFiles = new Set();
    constructor(workspaceRoot, incremental, options, initialFilter) {
        this.workspaceRoot = workspaceRoot;
        this.incremental = incremental;
        this.initialFilter = initialFilter;
        // To cache the results an option factory is needed to capture the full set of dependencies
        this.#shouldCacheResult = incremental && typeof options === 'function';
        this.#optionsFactory = (...args) => {
            const baseOptions = typeof options === 'function' ? options(...args) : options;
            return {
                ...baseOptions,
                metafile: true,
                write: false,
            };
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
        // Return existing result if present
        if (this.#esbuildResult) {
            return this.#esbuildResult;
        }
        const result = await this.#performBundle();
        if (this.#shouldCacheResult) {
            this.#esbuildResult = result;
        }
        return result;
    }
    async #performBundle() {
        // Create esbuild options if not present
        if (this.#esbuildOptions === undefined) {
            if (this.incremental) {
                this.#loadCache = new load_result_cache_1.MemoryLoadResultCache();
            }
            this.#esbuildOptions = this.#optionsFactory(this.#loadCache);
        }
        if (this.incremental) {
            this.watchFiles.clear();
        }
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
                this.#addErrorsToWatch(failure);
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
            // Add input files except virtual angular files which do not exist on disk
            Object.keys(result.metafile.inputs)
                .filter((input) => !input.startsWith('angular:'))
                // input file paths are always relative to the workspace root
                .forEach((input) => this.watchFiles.add((0, node_path_1.join)(this.workspaceRoot, input)));
            // Also add any files from the load result cache
            if (this.#loadCache) {
                this.#loadCache.watchFiles
                    .filter((file) => !file.startsWith('angular:'))
                    // watch files are fully resolved paths
                    .forEach((file) => this.watchFiles.add(file));
            }
        }
        // Return if the build encountered any errors
        if (result.errors.length) {
            this.#addErrorsToWatch(result);
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
    #addErrorsToWatch(result) {
        for (const error of result.errors) {
            let file = error.location?.file;
            if (file) {
                this.watchFiles.add((0, node_path_1.join)(this.workspaceRoot, file));
            }
            for (const note of error.notes) {
                file = note.location?.file;
                if (file) {
                    this.watchFiles.add((0, node_path_1.join)(this.workspaceRoot, file));
                }
            }
        }
    }
    /**
     * Invalidate a stored bundler result based on the previous watch files
     * and a list of changed files.
     * The context must be created with incremental mode enabled for results
     * to be stored.
     * @returns True, if the result was invalidated; False, otherwise.
     */
    invalidate(files) {
        if (!this.incremental) {
            return false;
        }
        let invalid = false;
        for (const file of files) {
            if (this.#loadCache?.invalidate(file)) {
                invalid = true;
                continue;
            }
            invalid ||= this.watchFiles.has(file);
        }
        if (invalid) {
            this.#esbuildResult = undefined;
        }
        return invalid;
    }
    /**
     * Disposes incremental build resources present in the context.
     *
     * @returns A promise that resolves when disposal is complete.
     */
    async dispose() {
        try {
            this.#esbuildOptions = undefined;
            this.#esbuildResult = undefined;
            this.#loadCache = undefined;
            await this.#esbuildContext?.dispose();
        }
        finally {
            this.#esbuildContext = undefined;
        }
    }
}
exports.BundlerContext = BundlerContext;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlci1jb250ZXh0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9idW5kbGVyLWNvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgscUNBVWlCO0FBQ2pCLHlDQUF1RTtBQUN2RSwyREFBNkU7QUFDN0UsbUNBQTRDO0FBbUI1QyxJQUFZLG1CQUtYO0FBTEQsV0FBWSxtQkFBbUI7SUFDN0IsbUVBQVcsQ0FBQTtJQUNYLCtEQUFTLENBQUE7SUFDVCxpRUFBVSxDQUFBO0lBQ1YsNkRBQVEsQ0FBQTtBQUNWLENBQUMsRUFMVyxtQkFBbUIsbUNBQW5CLG1CQUFtQixRQUs5QjtBQVlEOzs7O0dBSUc7QUFDSCxTQUFTLGdCQUFnQixDQUFDLEtBQWM7SUFDdEMsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxRQUFRLElBQUksS0FBSyxJQUFJLFVBQVUsSUFBSSxLQUFLLENBQUM7QUFDMUYsQ0FBQztBQUVELE1BQWEsY0FBYztJQVdmO0lBQ0E7SUFFQTtJQWJWLGVBQWUsQ0FBa0Q7SUFDakUsZUFBZSxDQUFtRDtJQUNsRSxjQUFjLENBQXVCO0lBQ3JDLGVBQWUsQ0FBeUU7SUFDeEYsa0JBQWtCLENBQVU7SUFFNUIsVUFBVSxDQUF5QjtJQUMxQixVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztJQUV4QyxZQUNVLGFBQXFCLEVBQ3JCLFdBQW9CLEVBQzVCLE9BQTZDLEVBQ3JDLGFBQWlFO1FBSGpFLGtCQUFhLEdBQWIsYUFBYSxDQUFRO1FBQ3JCLGdCQUFXLEdBQVgsV0FBVyxDQUFTO1FBRXBCLGtCQUFhLEdBQWIsYUFBYSxDQUFvRDtRQUV6RSwyRkFBMkY7UUFDM0YsSUFBSSxDQUFDLGtCQUFrQixHQUFHLFdB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O1lBQ3JCLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFFRCxJQUFJLE9BQU8sR0FBRyxLQUFLLENBQUM7UUFDcEIsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7WUFDeEIsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDckMsT0FBTyxHQUFHLElBQUksQ0FBQztnQkFDZixTQUFTO2FBQ1Y7WUFFRCxPQUFPLEtBQUssSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDdkM7UUFFRCxJQUFJLE9BQU8sRUFBRTtZQUNYLElBQUksQ0FBQyxjQUFjLEdBQUcsU0FBUyxDQUFDO1NBQ2pDO1FBRUQsT0FBTyxPQUFPLENBQUM7SUFDakIsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxLQUFLLENBQUMsT0FBTztRQUNYLElBQUk7WUFDRixJQUFJLENBQUMsZUFBZSxHQUFHLFNBQVMsQ0FBQztZQUNqQyxJQUFJLENBQUMsY0FBYyxHQUFHLFNBQVMsQ0FBQztZQUNoQyxJQUFJLENBQUMsVUFBVSxHQUFHLFNBQVMsQ0FBQztZQUM1QixNQUFNLElBQUksQ0FBQyxlQUFlLEVBQUUsT0FBTyxFQUFFLENBQUM7U0FDdkM7Z0JBQVM7WUFDUixJQUFJLENBQUMsZUFBZSxHQUFHLFNBQVMsQ0FBQztTQUNsQztJQUNILENBQUM7Q0FDRjtBQTlTRCx3Q0E4U0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgQnVpbGRDb250ZXh0LFxuICBCdWlsZEZhaWx1cmUsXG4gIEJ1aWxkT3B0aW9ucyxcbiAgQnVpbGRSZXN1bHQsXG4gIE1lc3NhZ2UsXG4gIE1ldGFmaWxlLFxuICBPdXRwdXRGaWxlLFxuICBidWlsZCxcbiAgY29udGV4dCxcbn0gZnJvbSAnZXNidWlsZCc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSwgZXh0bmFtZSwgam9pbiwgcmVsYXRpdmUgfSBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgTG9hZFJlc3VsdENhY2hlLCBNZW1vcnlMb2FkUmVzdWx0Q2FjaGUgfSBmcm9tICcuL2xvYWQtcmVzdWx0LWNhY2hlJztcbmltcG9ydCB7IGNvbnZlcnRPdXRwdXRGaWxlIH0gZnJvbSAnLi91dGlscyc7XG5cbmV4cG9ydCB0eXBlIEJ1bmRsZUNvbnRleHRSZXN1bHQgPVxuICB8IHsgZXJyb3JzOiBNZXNzYWdlW107IHdhcm5pbmdzOiBNZXNzYWdlW10gfVxuICB8IHtcbiAgICAgIGVycm9yczogdW5kZWZpbmVkO1xuICAgICAgd2FybmluZ3M6IE1lc3NhZ2VbXTtcbiAgICAgIG1ldGFmaWxlOiBNZXRhZmlsZTtcbiAgICAgIG91dHB1dEZpbGVzOiBCdWlsZE91dHB1dEZpbGVbXTtcbiAgICAgIGluaXRpYWxGaWxlczogTWFwPHN0cmluZywgSW5pdGlhbEZpbGVSZWNvcmQ+O1xuICAgIH07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5pdGlhbEZpbGVSZWNvcmQge1xuICBlbnRyeXBvaW50OiBib29sZWFuO1xuICBuYW1lPzogc3RyaW5nO1xuICB0eXBlOiAnc2NyaXB0JyB8ICdzdHlsZSc7XG4gIGV4dGVybmFsPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGVudW0gQnVpbGRPdXRwdXRGaWxlVHlwZSB7XG4gIEJyb3dzZXIgPSAxLFxuICBNZWRpYSA9IDIsXG4gIFNlcnZlciA9IDMsXG4gIFJvb3QgPSA0LFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWxkT3V0cHV0RmlsZSBleHRlbmRzIE91dHB1dEZpbGUge1xuICB0eXBlOiBCdWlsZE91dHB1dEZpbGVUeXBlO1xuICBmdWxsT3V0cHV0UGF0aDogc3RyaW5nO1xuICBjbG9uZTogKCkgPT4gQnVpbGRPdXRwdXRGaWxlO1xufVxuXG5leHBvcnQgdHlwZSBCdW5kbGVyT3B0aW9uc0ZhY3Rvcnk8VCBleHRlbmRzIEJ1aWxkT3B0aW9ucyA9IEJ1aWxkT3B0aW9ucz4gPSAoXG4gIGxvYWRDYWNoZTogTG9hZFJlc3VsdENhY2hlIHwgdW5kZWZpbmVkLFxuKSA9PiBUO1xuXG4vKipcbiAqIERldGVybWluZXMgaWYgYW4gdW5rbm93biB2YWx1ZSBpcyBhbiBlc2J1aWxkIEJ1aWxkRmFpbHVyZSBlcnJvciBvYmplY3QgdGhyb3duIGJ5IGVzYnVpbGQuXG4gKiBAcGFyYW0gdmFsdWUgQSBwb3RlbnRpYWwgZXNidWlsZCBCdWlsZEZhaWx1cmUgZXJyb3Igb2JqZWN0LlxuICogQHJldHVybnMgYHRydWVgIGlmIHRoZSBvYmplY3QgaXMgZGV0ZXJtaW5lZCB0byBiZSBhIEJ1aWxkRmFpbHVyZSBvYmplY3Q7IG90aGVyd2lzZSwgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNFc0J1aWxkRmFpbHVyZSh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIEJ1aWxkRmFpbHVyZSB7XG4gIHJldHVybiAhIXZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgJ2Vycm9ycycgaW4gdmFsdWUgJiYgJ3dhcm5pbmdzJyBpbiB2YWx1ZTtcbn1cblxuZXhwb3J0IGNsYXNzIEJ1bmRsZXJDb250ZXh0IHtcbiAgI2VzYnVpbGRDb250ZXh0PzogQnVpbGRDb250ZXh0PHsgbWV0YWZpbGU6IHRydWU7IHdyaXRlOiBmYWxzZSB9PjtcbiAgI2VzYnVpbGRPcHRpb25zPzogQnVpbGRPcHRpb25zICYgeyBtZXRhZmlsZTogdHJ1ZTsgd3JpdGU6IGZhbHNlIH07XG4gICNlc2J1aWxkUmVzdWx0PzogQnVuZGxlQ29udGV4dFJlc3VsdDtcbiAgI29wdGlvbnNGYWN0b3J5OiBCdW5kbGVyT3B0aW9uc0ZhY3Rvcnk8QnVpbGRPcHRpb25zICYgeyBtZXRhZmlsZTogdHJ1ZTsgd3JpdGU6IGZhbHNlIH0+O1xuICAjc2hvdWxkQ2FjaGVSZXN1bHQ6IGJvb2xlYW47XG5cbiAgI2xvYWRDYWNoZT86IE1lbW9yeUxvYWRSZXN1bHRDYWNoZTtcbiAgcmVhZG9ubHkgd2F0Y2hGaWxlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICAgIHByaXZhdGUgaW5jcmVtZW50YWw6IGJvb2xlYW4sXG4gICAgb3B0aW9uczogQnVpbGRPcHRpb25zIHwgQnVuZGxlck9wdGlvbnNGYWN0b3J5LFxuICAgIHByaXZhdGUgaW5pdGlhbEZpbHRlcj86IChpbml0aWFsOiBSZWFkb25seTxJbml0aWFsRmlsZVJlY29yZD4pID0+IGJvb2xlYW4sXG4gICkge1xuICAgIC8vIFRvIGNhY2hlIHRoZSByZXN1bHRzIGFuIG9wdGlvbiBmYWN0b3J5IGlzIG5lZWRlZCB0byBjYXB0dXJlIHRoZSBmdWxsIHNldCBvZiBkZXBlbmRlbmNpZXNcbiAgICB0aGlzLiNzaG91bGRDYWNoZVJlc3VsdCA9IGluY3JlbWVudGFsICYmIHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nO1xuICAgIHRoaXMuI29wdGlvbnNGYWN0b3J5ID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IGJhc2VPcHRpb25zID0gdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicgPyBvcHRpb25zKC4uLmFyZ3MpIDogb3B0aW9ucztcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4uYmFzZU9wdGlvbnMsXG4gICAgICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgICAgICB3cml0ZTogZmFsc2UsXG4gICAgICB9O1xuICAgIH07XG4gIH1cblxuICBzdGF0aWMgYXN5bmMgYnVuZGxlQWxsKGNvbnRleHRzOiBJdGVyYWJsZTxCdW5kbGVyQ29udGV4dD4pOiBQcm9taXNlPEJ1bmRsZUNvbnRleHRSZXN1bHQ+IHtcbiAgICBjb25zdCBpbmRpdmlkdWFsUmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKFsuLi5jb250ZXh0c10ubWFwKChjb250ZXh0KSA9PiBjb250ZXh0LmJ1bmRsZSgpKSk7XG5cbiAgICAvLyBSZXR1cm4gZGlyZWN0bHkgaWYgb25seSBvbmUgcmVzdWx0XG4gICAgaWYgKGluZGl2aWR1YWxSZXN1bHRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgcmV0dXJuIGluZGl2aWR1YWxSZXN1bHRzWzBdO1xuICAgIH1cblxuICAgIGxldCBlcnJvcnM6IE1lc3NhZ2VbXSB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCB3YXJuaW5nczogTWVzc2FnZVtdID0gW107XG4gICAgY29uc3QgbWV0YWZpbGU6IE1ldGFmaWxlID0geyBpbnB1dHM6IHt9LCBvdXRwdXRzOiB7fSB9O1xuICAgIGNvbnN0IGluaXRpYWxGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBJbml0aWFsRmlsZVJlY29yZD4oKTtcbiAgICBjb25zdCBvdXRwdXRGaWxlcyA9IFtdO1xuICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIGluZGl2aWR1YWxSZXN1bHRzKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKC4uLnJlc3VsdC53YXJuaW5ncyk7XG4gICAgICBpZiAocmVzdWx0LmVycm9ycykge1xuICAgICAgICBlcnJvcnMgPz89IFtdO1xuICAgICAgICBlcnJvcnMucHVzaCguLi5yZXN1bHQuZXJyb3JzKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIENvbWJpbmUgbWV0YWZpbGVzIHVzZWQgZm9yIHRoZSBzdGF0cyBvcHRpb24gYXMgd2VsbCBhcyBidW5kbGUgYnVkZ2V0cyBhbmQgY29uc29sZSBvdXRwdXRcbiAgICAgIGlmIChyZXN1bHQubWV0YWZpbGUpIHtcbiAgICAgICAgbWV0YWZpbGUuaW5wdXRzID0geyAuLi5tZXRhZmlsZS5pbnB1dHMsIC4uLnJlc3VsdC5tZXRhZmlsZS5pbnB1dHMgfTtcbiAgICAgICAgbWV0YWZpbGUub3V0cHV0cyA9IHsgLi4ubWV0YWZpbGUub3V0cHV0cywgLi4ucmVzdWx0Lm1ldGFmaWxlLm91dHB1dHMgfTtcbiAgICAgIH1cblxuICAgICAgcmVzdWx0LmluaXRpYWxGaWxlcy5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiBpbml0aWFsRmlsZXMuc2V0KGtleSwgdmFsdWUpKTtcbiAgICAgIG91dHB1dEZpbGVzLnB1c2goLi4ucmVzdWx0Lm91dHB1dEZpbGVzKTtcbiAgICB9XG5cbiAgICBpZiAoZXJyb3JzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB7IGVycm9ycywgd2FybmluZ3MgfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgZXJyb3JzLFxuICAgICAgd2FybmluZ3MsXG4gICAgICBtZXRhZmlsZSxcbiAgICAgIGluaXRpYWxGaWxlcyxcbiAgICAgIG91dHB1dEZpbGVzLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZXMgdGhlIGVzYnVpbGQgYnVpbGQgZnVuY3Rpb24gYW5kIG5vcm1hbGl6ZXMgdGhlIGJ1aWxkIHJlc3VsdCBpbiB0aGUgZXZlbnQgb2YgYVxuICAgKiBidWlsZCBmYWlsdXJlIHRoYXQgcmVzdWx0cyBpbiBubyBvdXRwdXQgYmVpbmcgZ2VuZXJhdGVkLlxuICAgKiBBbGwgYnVpbGRzIHVzZSB0aGUgYHdyaXRlYCBvcHRpb24gd2l0aCBhIHZhbHVlIG9mIGBmYWxzZWAgdG8gYWxsb3cgZm9yIHRoZSBvdXRwdXQgZmlsZXNcbiAgICogYnVpbGQgcmVzdWx0IGFycmF5IHRvIGJlIHBvcHVsYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgSWYgb3V0cHV0IGZpbGVzIGFyZSBnZW5lcmF0ZWQsIHRoZSBmdWxsIGVzYnVpbGQgQnVpbGRSZXN1bHQ7IGlmIG5vdCwgdGhlXG4gICAqIHdhcm5pbmdzIGFuZCBlcnJvcnMgZm9yIHRoZSBhdHRlbXB0ZWQgYnVpbGQuXG4gICAqL1xuICBhc3luYyBidW5kbGUoKTogUHJvbWlzZTxCdW5kbGVDb250ZXh0UmVzdWx0PiB7XG4gICAgLy8gUmV0dXJuIGV4aXN0aW5nIHJlc3VsdCBpZiBwcmVzZW50XG4gICAgaWYgKHRoaXMuI2VzYnVpbGRSZXN1bHQpIHtcbiAgICAgIHJldHVybiB0aGlzLiNlc2J1aWxkUmVzdWx0O1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuI3BlcmZvcm1CdW5kbGUoKTtcbiAgICBpZiAodGhpcy4jc2hvdWxkQ2FjaGVSZXN1bHQpIHtcbiAgICAgIHRoaXMuI2VzYnVpbGRSZXN1bHQgPSByZXN1bHQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGFzeW5jICNwZXJmb3JtQnVuZGxlKCkge1xuICAgIC8vIENyZWF0ZSBlc2J1aWxkIG9wdGlvbnMgaWYgbm90IHByZXNlbnRcbiAgICBpZiAodGhpcy4jZXNidWlsZE9wdGlvbnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKHRoaXMuaW5jcmVtZW50YWwpIHtcbiAgICAgICAgdGhpcy4jbG9hZENhY2hlID0gbmV3IE1lbW9yeUxvYWRSZXN1bHRDYWNoZSgpO1xuICAgICAgfVxuICAgICAgdGhpcy4jZXNidWlsZE9wdGlvbnMgPSB0aGlzLiNvcHRpb25zRmFjdG9yeSh0aGlzLiNsb2FkQ2FjaGUpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmluY3JlbWVudGFsKSB7XG4gICAgICB0aGlzLndhdGNoRmlsZXMuY2xlYXIoKTtcbiAgICB9XG5cbiAgICBsZXQgcmVzdWx0O1xuICAgIHRyeSB7XG4gICAgICBpZiAodGhpcy4jZXNidWlsZENvbnRleHQpIHtcbiAgICAgICAgLy8gUmVidWlsZCB1c2luZyB0aGUgZXhpc3RpbmcgaW5jcmVtZW50YWwgYnVpbGQgY29udGV4dFxuICAgICAgICByZXN1bHQgPSBhd2FpdCB0aGlzLiNlc2J1aWxkQ29udGV4dC5yZWJ1aWxkKCk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaW5jcmVtZW50YWwpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGFuIGluY3JlbWVudGFsIGJ1aWxkIGNvbnRleHQgYW5kIHBlcmZvcm0gdGhlIGZpcnN0IGJ1aWxkLlxuICAgICAgICAvLyBDb250ZXh0IGNyZWF0aW9uIGRvZXMgbm90IHBlcmZvcm0gYSBidWlsZC5cbiAgICAgICAgdGhpcy4jZXNidWlsZENvbnRleHQgPSBhd2FpdCBjb250ZXh0KHRoaXMuI2VzYnVpbGRPcHRpb25zKTtcbiAgICAgICAgcmVzdWx0ID0gYXdhaXQgdGhpcy4jZXNidWlsZENvbnRleHQucmVidWlsZCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRm9yIG5vbi1pbmNyZW1lbnRhbCBidWlsZHMsIHBlcmZvcm0gYSBzaW5nbGUgYnVpbGRcbiAgICAgICAgcmVzdWx0ID0gYXdhaXQgYnVpbGQodGhpcy4jZXNidWlsZE9wdGlvbnMpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGZhaWx1cmUpIHtcbiAgICAgIC8vIEJ1aWxkIGZhaWx1cmVzIHdpbGwgdGhyb3cgYW4gZXhjZXB0aW9uIHdoaWNoIGNvbnRhaW5zIGVycm9ycy93YXJuaW5nc1xuICAgICAgaWYgKGlzRXNCdWlsZEZhaWx1cmUoZmFpbHVyZSkpIHtcbiAgICAgICAgdGhpcy4jYWRkRXJyb3JzVG9XYXRjaChmYWlsdXJlKTtcblxuICAgICAgICByZXR1cm4gZmFpbHVyZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGZhaWx1cmU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIGZpbGVzIHRoYXQgc2hvdWxkIGJlIHdhdGNoZWQuXG4gICAgLy8gV2hpbGUgdGhpcyBzaG91bGQgdGVjaG5pY2FsbHkgbm90IGJlIGxpbmtlZCB0byBpbmNyZW1lbnRhbCBtb2RlLCBpbmNyZW1lbnRhbCBpcyBvbmx5XG4gICAgLy8gY3VycmVudGx5IGVuYWJsZWQgd2l0aCB3YXRjaCBtb2RlIHdoZXJlIHdhdGNoIGZpbGVzIGFyZSBuZWVkZWQuXG4gICAgaWYgKHRoaXMuaW5jcmVtZW50YWwpIHtcbiAgICAgIC8vIEFkZCBpbnB1dCBmaWxlcyBleGNlcHQgdmlydHVhbCBhbmd1bGFyIGZpbGVzIHdoaWNoIGRvIG5vdCBleGlzdCBvbiBkaXNrXG4gICAgICBPYmplY3Qua2V5cyhyZXN1bHQubWV0YWZpbGUuaW5wdXRzKVxuICAgICAgICAuZmlsdGVyKChpbnB1dCkgPT4gIWlucHV0LnN0YXJ0c1dpdGgoJ2FuZ3VsYXI6JykpXG4gICAgICAgIC8vIGlucHV0IGZpbGUgcGF0aHMgYXJlIGFsd2F5cyByZWxhdGl2ZSB0byB0aGUgd29ya3NwYWNlIHJvb3RcbiAgICAgICAgLmZvckVhY2goKGlucHV0KSA9PiB0aGlzLndhdGNoRmlsZXMuYWRkKGpvaW4odGhpcy53b3Jrc3BhY2VSb290LCBpbnB1dCkpKTtcbiAgICAgIC8vIEFsc28gYWRkIGFueSBmaWxlcyBmcm9tIHRoZSBsb2FkIHJlc3VsdCBjYWNoZVxuICAgICAgaWYgKHRoaXMuI2xvYWRDYWNoZSkge1xuICAgICAgICB0aGlzLiNsb2FkQ2FjaGUud2F0Y2hGaWxlc1xuICAgICAgICAgIC5maWx0ZXIoKGZpbGUpID0+ICFmaWxlLnN0YXJ0c1dpdGgoJ2FuZ3VsYXI6JykpXG4gICAgICAgICAgLy8gd2F0Y2ggZmlsZXMgYXJlIGZ1bGx5IHJlc29sdmVkIHBhdGhzXG4gICAgICAgICAgLmZvckVhY2goKGZpbGUpID0+IHRoaXMud2F0Y2hGaWxlcy5hZGQoZmlsZSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJldHVybiBpZiB0aGUgYnVpbGQgZW5jb3VudGVyZWQgYW55IGVycm9yc1xuICAgIGlmIChyZXN1bHQuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgdGhpcy4jYWRkRXJyb3JzVG9XYXRjaChyZXN1bHQpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBlcnJvcnM6IHJlc3VsdC5lcnJvcnMsXG4gICAgICAgIHdhcm5pbmdzOiByZXN1bHQud2FybmluZ3MsXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIEZpbmQgYWxsIGluaXRpYWwgZmlsZXNcbiAgICBjb25zdCBpbml0aWFsRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgSW5pdGlhbEZpbGVSZWNvcmQ+KCk7XG4gICAgZm9yIChjb25zdCBvdXRwdXRGaWxlIG9mIHJlc3VsdC5vdXRwdXRGaWxlcykge1xuICAgICAgLy8gRW50cmllcyBpbiB0aGUgbWV0YWZpbGUgYXJlIHJlbGF0aXZlIHRvIHRoZSBgYWJzV29ya2luZ0RpcmAgb3B0aW9uIHdoaWNoIGlzIHNldCB0byB0aGUgd29ya3NwYWNlUm9vdFxuICAgICAgY29uc3QgcmVsYXRpdmVGaWxlUGF0aCA9IHJlbGF0aXZlKHRoaXMud29ya3NwYWNlUm9vdCwgb3V0cHV0RmlsZS5wYXRoKTtcbiAgICAgIGNvbnN0IGVudHJ5UG9pbnQgPSByZXN1bHQubWV0YWZpbGUub3V0cHV0c1tyZWxhdGl2ZUZpbGVQYXRoXT8uZW50cnlQb2ludDtcblxuICAgICAgb3V0cHV0RmlsZS5wYXRoID0gcmVsYXRpdmVGaWxlUGF0aDtcblxuICAgICAgaWYgKGVudHJ5UG9pbnQpIHtcbiAgICAgICAgLy8gVGhlIGZpcnN0IHBhcnQgb2YgdGhlIGZpbGVuYW1lIGlzIHRoZSBuYW1lIG9mIGZpbGUgKGUuZy4sIFwicG9seWZpbGxzXCIgZm9yIFwicG9seWZpbGxzLTdTNUczTURZLmpzXCIpXG4gICAgICAgIGNvbnN0IG5hbWUgPSBiYXNlbmFtZShyZWxhdGl2ZUZpbGVQYXRoKS5yZXBsYWNlKC8oPzotW1xcZEEtWl17OH0pP1xcLlthLXpdezIsM30kLywgJycpO1xuICAgICAgICAvLyBFbnRyeSBwb2ludHMgYXJlIG9ubHkgc3R5bGVzIG9yIHNjcmlwdHNcbiAgICAgICAgY29uc3QgdHlwZSA9IGV4dG5hbWUocmVsYXRpdmVGaWxlUGF0aCkgPT09ICcuY3NzJyA/ICdzdHlsZScgOiAnc2NyaXB0JztcblxuICAgICAgICAvLyBPbmx5IGVudHJ5cG9pbnRzIHdpdGggYW4gZW50cnkgaW4gdGhlIG9wdGlvbnMgYXJlIGluaXRpYWwgZmlsZXMuXG4gICAgICAgIC8vIER5bmFtaWMgaW1wb3J0cyBhbHNvIGhhdmUgYW4gZW50cnlQb2ludCB2YWx1ZSBpbiB0aGUgbWV0YSBmaWxlLlxuICAgICAgICBpZiAoKHRoaXMuI2VzYnVpbGRPcHRpb25zLmVudHJ5UG9pbnRzIGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4pPy5bbmFtZV0pIHtcbiAgICAgICAgICAvLyBBbiBlbnRyeVBvaW50IHZhbHVlIGluZGljYXRlcyBhbiBpbml0aWFsIGZpbGVcbiAgICAgICAgICBjb25zdCByZWNvcmQ6IEluaXRpYWxGaWxlUmVjb3JkID0ge1xuICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICBlbnRyeXBvaW50OiB0cnVlLFxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBpZiAoIXRoaXMuaW5pdGlhbEZpbHRlciB8fCB0aGlzLmluaXRpYWxGaWx0ZXIocmVjb3JkKSkge1xuICAgICAgICAgICAgaW5pdGlhbEZpbGVzLnNldChyZWxhdGl2ZUZpbGVQYXRoLCByZWNvcmQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFuYWx5emUgZm9yIHRyYW5zaXRpdmUgaW5pdGlhbCBmaWxlc1xuICAgIGNvbnN0IGZpbGVzID0gWy4uLmluaXRpYWxGaWxlcy5rZXlzKCldO1xuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgZm9yIChjb25zdCBpbml0aWFsSW1wb3J0IG9mIHJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzW2ZpbGVdLmltcG9ydHMpIHtcbiAgICAgICAgaWYgKGluaXRpYWxGaWxlcy5oYXMoaW5pdGlhbEltcG9ydC5wYXRoKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluaXRpYWxJbXBvcnQua2luZCA9PT0gJ2ltcG9ydC1zdGF0ZW1lbnQnIHx8IGluaXRpYWxJbXBvcnQua2luZCA9PT0gJ2ltcG9ydC1ydWxlJykge1xuICAgICAgICAgIGNvbnN0IHJlY29yZDogSW5pdGlhbEZpbGVSZWNvcmQgPSB7XG4gICAgICAgICAgICB0eXBlOiBpbml0aWFsSW1wb3J0LmtpbmQgPT09ICdpbXBvcnQtcnVsZScgPyAnc3R5bGUnIDogJ3NjcmlwdCcsXG4gICAgICAgICAgICBlbnRyeXBvaW50OiBmYWxzZSxcbiAgICAgICAgICAgIGV4dGVybmFsOiBpbml0aWFsSW1wb3J0LmV4dGVybmFsLFxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBpZiAoIXRoaXMuaW5pdGlhbEZpbHRlciB8fCB0aGlzLmluaXRpYWxGaWx0ZXIocmVjb3JkKSkge1xuICAgICAgICAgICAgaW5pdGlhbEZpbGVzLnNldChpbml0aWFsSW1wb3J0LnBhdGgsIHJlY29yZCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCFpbml0aWFsSW1wb3J0LmV4dGVybmFsKSB7XG4gICAgICAgICAgICBmaWxlcy5wdXNoKGluaXRpYWxJbXBvcnQucGF0aCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgb3V0cHV0RmlsZXMgPSByZXN1bHQub3V0cHV0RmlsZXMubWFwKChmaWxlKSA9PiB7XG4gICAgICBsZXQgZmlsZVR5cGU6IEJ1aWxkT3V0cHV0RmlsZVR5cGU7XG4gICAgICBpZiAoZGlybmFtZShmaWxlLnBhdGgpID09PSAnbWVkaWEnKSB7XG4gICAgICAgIGZpbGVUeXBlID0gQnVpbGRPdXRwdXRGaWxlVHlwZS5NZWRpYTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZpbGVUeXBlID1cbiAgICAgICAgICB0aGlzLiNlc2J1aWxkT3B0aW9ucz8ucGxhdGZvcm0gPT09ICdub2RlJ1xuICAgICAgICAgICAgPyBCdWlsZE91dHB1dEZpbGVUeXBlLlNlcnZlclxuICAgICAgICAgICAgOiBCdWlsZE91dHB1dEZpbGVUeXBlLkJyb3dzZXI7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBjb252ZXJ0T3V0cHV0RmlsZShmaWxlLCBmaWxlVHlwZSk7XG4gICAgfSk7XG5cbiAgICAvLyBSZXR1cm4gdGhlIHN1Y2Nlc3NmdWwgYnVpbGQgcmVzdWx0c1xuICAgIHJldHVybiB7XG4gICAgICAuLi5yZXN1bHQsXG4gICAgICBvdXRwdXRGaWxlcyxcbiAgICAgIGluaXRpYWxGaWxlcyxcbiAgICAgIGVycm9yczogdW5kZWZpbmVkLFxuICAgIH07XG4gIH1cblxuICAjYWRkRXJyb3JzVG9XYXRjaChyZXN1bHQ6IEJ1aWxkRmFpbHVyZSB8IEJ1aWxkUmVzdWx0KTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBlcnJvciBvZiByZXN1bHQuZXJyb3JzKSB7XG4gICAgICBsZXQgZmlsZSA9IGVycm9yLmxvY2F0aW9uPy5maWxlO1xuICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgdGhpcy53YXRjaEZpbGVzLmFkZChqb2luKHRoaXMud29ya3NwYWNlUm9vdCwgZmlsZSkpO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBub3RlIG9mIGVycm9yLm5vdGVzKSB7XG4gICAgICAgIGZpbGUgPSBub3RlLmxvY2F0aW9uPy5maWxlO1xuICAgICAgICBpZiAoZmlsZSkge1xuICAgICAgICAgIHRoaXMud2F0Y2hGaWxlcy5hZGQoam9pbih0aGlzLndvcmtzcGFjZVJvb3QsIGZpbGUpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZhbGlkYXRlIGEgc3RvcmVkIGJ1bmRsZXIgcmVzdWx0IGJhc2VkIG9uIHRoZSBwcmV2aW91cyB3YXRjaCBmaWxlc1xuICAgKiBhbmQgYSBsaXN0IG9mIGNoYW5nZWQgZmlsZXMuXG4gICAqIFRoZSBjb250ZXh0IG11c3QgYmUgY3JlYXRlZCB3aXRoIGluY3JlbWVudGFsIG1vZGUgZW5hYmxlZCBmb3IgcmVzdWx0c1xuICAgKiB0byBiZSBzdG9yZWQuXG4gICAqIEByZXR1cm5zIFRydWUsIGlmIHRoZSByZXN1bHQgd2FzIGludmFsaWRhdGVkOyBGYWxzZSwgb3RoZXJ3aXNlLlxuICAgKi9cbiAgaW52YWxpZGF0ZShmaWxlczogSXRlcmFibGU8c3RyaW5nPik6IGJvb2xlYW4ge1xuICAgIGlmICghdGhpcy5pbmNyZW1lbnRhbCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGxldCBpbnZhbGlkID0gZmFsc2U7XG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBpZiAodGhpcy4jbG9hZENhY2hlPy5pbnZhbGlkYXRlKGZpbGUpKSB7XG4gICAgICAgIGludmFsaWQgPSB0cnVlO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaW52YWxpZCB8fD0gdGhpcy53YXRjaEZpbGVzLmhhcyhmaWxlKTtcbiAgICB9XG5cbiAgICBpZiAoaW52YWxpZCkge1xuICAgICAgdGhpcy4jZXNidWlsZFJlc3VsdCA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICByZXR1cm4gaW52YWxpZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBEaXNwb3NlcyBpbmNyZW1lbnRhbCBidWlsZCByZXNvdXJjZXMgcHJlc2VudCBpbiB0aGUgY29udGV4dC5cbiAgICpcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBkaXNwb3NhbCBpcyBjb21wbGV0ZS5cbiAgICovXG4gIGFzeW5jIGRpc3Bvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuI2VzYnVpbGRPcHRpb25zID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy4jZXNidWlsZFJlc3VsdCA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuI2xvYWRDYWNoZSA9IHVuZGVmaW5lZDtcbiAgICAgIGF3YWl0IHRoaXMuI2VzYnVpbGRDb250ZXh0Py5kaXNwb3NlKCk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuI2VzYnVpbGRDb250ZXh0ID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxufVxuIl19