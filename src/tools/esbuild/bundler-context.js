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
    #optionsFactory;
    #loadCache;
    watchFiles = new Set();
    constructor(workspaceRoot, incremental, options, initialFilter) {
        this.workspaceRoot = workspaceRoot;
        this.incremental = incremental;
        this.initialFilter = initialFilter;
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
        // Create esbuild options if not present
        if (this.#esbuildOptions === undefined) {
            if (this.incremental) {
                this.#loadCache = new load_result_cache_1.MemoryLoadResultCache();
            }
            this.#esbuildOptions = this.#optionsFactory(this.#loadCache);
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
            this.#loadCache = undefined;
            await this.#esbuildContext?.dispose();
        }
        finally {
            this.#esbuildContext = undefined;
        }
    }
}
exports.BundlerContext = BundlerContext;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlci1jb250ZXh0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvZXNidWlsZC9idW5kbGVyLWNvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgscUNBU2lCO0FBQ2pCLHlDQUF1RTtBQUN2RSwyREFBNkU7QUFDN0UsbUNBQTRDO0FBbUI1QyxJQUFZLG1CQUtYO0FBTEQsV0FBWSxtQkFBbUI7SUFDN0IsbUVBQVcsQ0FBQTtJQUNYLCtEQUFTLENBQUE7SUFDVCxpRUFBVSxDQUFBO0lBQ1YsNkRBQVEsQ0FBQTtBQUNWLENBQUMsRUFMVyxtQkFBbUIsbUNBQW5CLG1CQUFtQixRQUs5QjtBQVlEOzs7O0dBSUc7QUFDSCxTQUFTLGdCQUFnQixDQUFDLEtBQWM7SUFDdEMsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxRQUFRLElBQUksS0FBSyxJQUFJLFVBQVUsSUFBSSxLQUFLLENBQUM7QUFDMUYsQ0FBQztBQUVELE1BQWEsY0FBYztJQVNmO0lBQ0E7SUFFQTtJQVhWLGVBQWUsQ0FBa0Q7SUFDakUsZUFBZSxDQUFtRDtJQUNsRSxlQUFlLENBQXlFO0lBRXhGLFVBQVUsQ0FBeUI7SUFDMUIsVUFBVSxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7SUFFeEMsWUFDVSxhQUFxQixFQUNyQixXQUFvQixFQUM1QixPQUE2QyxFQUNyQyxhQUFpRTtRQUhqRSxrQkFBYSxHQUFiLGFBQWEsQ0FBUTtRQUNyQixnQkFBVyxHQUFYLFdBQVcsQ0FBUztRQUVwQixrQkFBYSxHQUFiLGFBQWEsQ0FBb0Q7UUFFekUsSUFBSSxDQUFDLGVBQWUsR0FBRyxDQUFDLEdBQUcsSUFBSSxFQUFFLEVBQUU7WUFDakMsTUFBTSxXQUFXLEdBQUcsT0FBTyxP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SUFBSSxLQUFLLEVBQUU7WUFDeEIsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDckMsT0FBTyxHQUFHLElBQUksQ0FBQztnQkFDZixTQUFTO2FBQ1Y7WUFFRCxPQUFPLEtBQUssSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDdkM7UUFFRCxPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILEtBQUssQ0FBQyxPQUFPO1FBQ1gsSUFBSTtZQUNGLElBQUksQ0FBQyxlQUFlLEdBQUcsU0FBUyxDQUFDO1lBQ2pDLElBQUksQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO1lBQzVCLE1BQU0sSUFBSSxDQUFDLGVBQWUsRUFBRSxPQUFPLEVBQUUsQ0FBQztTQUN2QztnQkFBUztZQUNSLElBQUksQ0FBQyxlQUFlLEdBQUcsU0FBUyxDQUFDO1NBQ2xDO0lBQ0gsQ0FBQztDQUNGO0FBMVBELHdDQTBQQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZENvbnRleHQsXG4gIEJ1aWxkRmFpbHVyZSxcbiAgQnVpbGRPcHRpb25zLFxuICBNZXNzYWdlLFxuICBNZXRhZmlsZSxcbiAgT3V0cHV0RmlsZSxcbiAgYnVpbGQsXG4gIGNvbnRleHQsXG59IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGRpcm5hbWUsIGV4dG5hbWUsIGpvaW4sIHJlbGF0aXZlIH0gZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IExvYWRSZXN1bHRDYWNoZSwgTWVtb3J5TG9hZFJlc3VsdENhY2hlIH0gZnJvbSAnLi9sb2FkLXJlc3VsdC1jYWNoZSc7XG5pbXBvcnQgeyBjb252ZXJ0T3V0cHV0RmlsZSB9IGZyb20gJy4vdXRpbHMnO1xuXG5leHBvcnQgdHlwZSBCdW5kbGVDb250ZXh0UmVzdWx0ID1cbiAgfCB7IGVycm9yczogTWVzc2FnZVtdOyB3YXJuaW5nczogTWVzc2FnZVtdIH1cbiAgfCB7XG4gICAgICBlcnJvcnM6IHVuZGVmaW5lZDtcbiAgICAgIHdhcm5pbmdzOiBNZXNzYWdlW107XG4gICAgICBtZXRhZmlsZTogTWV0YWZpbGU7XG4gICAgICBvdXRwdXRGaWxlczogQnVpbGRPdXRwdXRGaWxlW107XG4gICAgICBpbml0aWFsRmlsZXM6IE1hcDxzdHJpbmcsIEluaXRpYWxGaWxlUmVjb3JkPjtcbiAgICB9O1xuXG5leHBvcnQgaW50ZXJmYWNlIEluaXRpYWxGaWxlUmVjb3JkIHtcbiAgZW50cnlwb2ludDogYm9vbGVhbjtcbiAgbmFtZT86IHN0cmluZztcbiAgdHlwZTogJ3NjcmlwdCcgfCAnc3R5bGUnO1xuICBleHRlcm5hbD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBlbnVtIEJ1aWxkT3V0cHV0RmlsZVR5cGUge1xuICBCcm93c2VyID0gMSxcbiAgTWVkaWEgPSAyLFxuICBTZXJ2ZXIgPSAzLFxuICBSb290ID0gNCxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCdWlsZE91dHB1dEZpbGUgZXh0ZW5kcyBPdXRwdXRGaWxlIHtcbiAgdHlwZTogQnVpbGRPdXRwdXRGaWxlVHlwZTtcbiAgZnVsbE91dHB1dFBhdGg6IHN0cmluZztcbiAgY2xvbmU6ICgpID0+IEJ1aWxkT3V0cHV0RmlsZTtcbn1cblxuZXhwb3J0IHR5cGUgQnVuZGxlck9wdGlvbnNGYWN0b3J5PFQgZXh0ZW5kcyBCdWlsZE9wdGlvbnMgPSBCdWlsZE9wdGlvbnM+ID0gKFxuICBsb2FkQ2FjaGU6IExvYWRSZXN1bHRDYWNoZSB8IHVuZGVmaW5lZCxcbikgPT4gVDtcblxuLyoqXG4gKiBEZXRlcm1pbmVzIGlmIGFuIHVua25vd24gdmFsdWUgaXMgYW4gZXNidWlsZCBCdWlsZEZhaWx1cmUgZXJyb3Igb2JqZWN0IHRocm93biBieSBlc2J1aWxkLlxuICogQHBhcmFtIHZhbHVlIEEgcG90ZW50aWFsIGVzYnVpbGQgQnVpbGRGYWlsdXJlIGVycm9yIG9iamVjdC5cbiAqIEByZXR1cm5zIGB0cnVlYCBpZiB0aGUgb2JqZWN0IGlzIGRldGVybWluZWQgdG8gYmUgYSBCdWlsZEZhaWx1cmUgb2JqZWN0OyBvdGhlcndpc2UsIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzRXNCdWlsZEZhaWx1cmUodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBCdWlsZEZhaWx1cmUge1xuICByZXR1cm4gISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmICdlcnJvcnMnIGluIHZhbHVlICYmICd3YXJuaW5ncycgaW4gdmFsdWU7XG59XG5cbmV4cG9ydCBjbGFzcyBCdW5kbGVyQ29udGV4dCB7XG4gICNlc2J1aWxkQ29udGV4dD86IEJ1aWxkQ29udGV4dDx7IG1ldGFmaWxlOiB0cnVlOyB3cml0ZTogZmFsc2UgfT47XG4gICNlc2J1aWxkT3B0aW9ucz86IEJ1aWxkT3B0aW9ucyAmIHsgbWV0YWZpbGU6IHRydWU7IHdyaXRlOiBmYWxzZSB9O1xuICAjb3B0aW9uc0ZhY3Rvcnk6IEJ1bmRsZXJPcHRpb25zRmFjdG9yeTxCdWlsZE9wdGlvbnMgJiB7IG1ldGFmaWxlOiB0cnVlOyB3cml0ZTogZmFsc2UgfT47XG5cbiAgI2xvYWRDYWNoZT86IE1lbW9yeUxvYWRSZXN1bHRDYWNoZTtcbiAgcmVhZG9ubHkgd2F0Y2hGaWxlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgd29ya3NwYWNlUm9vdDogc3RyaW5nLFxuICAgIHByaXZhdGUgaW5jcmVtZW50YWw6IGJvb2xlYW4sXG4gICAgb3B0aW9uczogQnVpbGRPcHRpb25zIHwgQnVuZGxlck9wdGlvbnNGYWN0b3J5LFxuICAgIHByaXZhdGUgaW5pdGlhbEZpbHRlcj86IChpbml0aWFsOiBSZWFkb25seTxJbml0aWFsRmlsZVJlY29yZD4pID0+IGJvb2xlYW4sXG4gICkge1xuICAgIHRoaXMuI29wdGlvbnNGYWN0b3J5ID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IGJhc2VPcHRpb25zID0gdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicgPyBvcHRpb25zKC4uLmFyZ3MpIDogb3B0aW9ucztcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4uYmFzZU9wdGlvbnMsXG4gICAgICAgIG1ldGFmaWxlOiB0cnVlLFxuICAgICAgICB3cml0ZTogZmFsc2UsXG4gICAgICB9O1xuICAgIH07XG4gIH1cblxuICBzdGF0aWMgYXN5bmMgYnVuZGxlQWxsKGNvbnRleHRzOiBJdGVyYWJsZTxCdW5kbGVyQ29udGV4dD4pOiBQcm9taXNlPEJ1bmRsZUNvbnRleHRSZXN1bHQ+IHtcbiAgICBjb25zdCBpbmRpdmlkdWFsUmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKFsuLi5jb250ZXh0c10ubWFwKChjb250ZXh0KSA9PiBjb250ZXh0LmJ1bmRsZSgpKSk7XG5cbiAgICAvLyBSZXR1cm4gZGlyZWN0bHkgaWYgb25seSBvbmUgcmVzdWx0XG4gICAgaWYgKGluZGl2aWR1YWxSZXN1bHRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgcmV0dXJuIGluZGl2aWR1YWxSZXN1bHRzWzBdO1xuICAgIH1cblxuICAgIGxldCBlcnJvcnM6IE1lc3NhZ2VbXSB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCB3YXJuaW5nczogTWVzc2FnZVtdID0gW107XG4gICAgY29uc3QgbWV0YWZpbGU6IE1ldGFmaWxlID0geyBpbnB1dHM6IHt9LCBvdXRwdXRzOiB7fSB9O1xuICAgIGNvbnN0IGluaXRpYWxGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBJbml0aWFsRmlsZVJlY29yZD4oKTtcbiAgICBjb25zdCBvdXRwdXRGaWxlcyA9IFtdO1xuICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIGluZGl2aWR1YWxSZXN1bHRzKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKC4uLnJlc3VsdC53YXJuaW5ncyk7XG4gICAgICBpZiAocmVzdWx0LmVycm9ycykge1xuICAgICAgICBlcnJvcnMgPz89IFtdO1xuICAgICAgICBlcnJvcnMucHVzaCguLi5yZXN1bHQuZXJyb3JzKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIENvbWJpbmUgbWV0YWZpbGVzIHVzZWQgZm9yIHRoZSBzdGF0cyBvcHRpb24gYXMgd2VsbCBhcyBidW5kbGUgYnVkZ2V0cyBhbmQgY29uc29sZSBvdXRwdXRcbiAgICAgIGlmIChyZXN1bHQubWV0YWZpbGUpIHtcbiAgICAgICAgbWV0YWZpbGUuaW5wdXRzID0geyAuLi5tZXRhZmlsZS5pbnB1dHMsIC4uLnJlc3VsdC5tZXRhZmlsZS5pbnB1dHMgfTtcbiAgICAgICAgbWV0YWZpbGUub3V0cHV0cyA9IHsgLi4ubWV0YWZpbGUub3V0cHV0cywgLi4ucmVzdWx0Lm1ldGFmaWxlLm91dHB1dHMgfTtcbiAgICAgIH1cblxuICAgICAgcmVzdWx0LmluaXRpYWxGaWxlcy5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiBpbml0aWFsRmlsZXMuc2V0KGtleSwgdmFsdWUpKTtcbiAgICAgIG91dHB1dEZpbGVzLnB1c2goLi4ucmVzdWx0Lm91dHB1dEZpbGVzKTtcbiAgICB9XG5cbiAgICBpZiAoZXJyb3JzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB7IGVycm9ycywgd2FybmluZ3MgfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgZXJyb3JzLFxuICAgICAgd2FybmluZ3MsXG4gICAgICBtZXRhZmlsZSxcbiAgICAgIGluaXRpYWxGaWxlcyxcbiAgICAgIG91dHB1dEZpbGVzLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZXMgdGhlIGVzYnVpbGQgYnVpbGQgZnVuY3Rpb24gYW5kIG5vcm1hbGl6ZXMgdGhlIGJ1aWxkIHJlc3VsdCBpbiB0aGUgZXZlbnQgb2YgYVxuICAgKiBidWlsZCBmYWlsdXJlIHRoYXQgcmVzdWx0cyBpbiBubyBvdXRwdXQgYmVpbmcgZ2VuZXJhdGVkLlxuICAgKiBBbGwgYnVpbGRzIHVzZSB0aGUgYHdyaXRlYCBvcHRpb24gd2l0aCBhIHZhbHVlIG9mIGBmYWxzZWAgdG8gYWxsb3cgZm9yIHRoZSBvdXRwdXQgZmlsZXNcbiAgICogYnVpbGQgcmVzdWx0IGFycmF5IHRvIGJlIHBvcHVsYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgSWYgb3V0cHV0IGZpbGVzIGFyZSBnZW5lcmF0ZWQsIHRoZSBmdWxsIGVzYnVpbGQgQnVpbGRSZXN1bHQ7IGlmIG5vdCwgdGhlXG4gICAqIHdhcm5pbmdzIGFuZCBlcnJvcnMgZm9yIHRoZSBhdHRlbXB0ZWQgYnVpbGQuXG4gICAqL1xuICBhc3luYyBidW5kbGUoKTogUHJvbWlzZTxCdW5kbGVDb250ZXh0UmVzdWx0PiB7XG4gICAgLy8gQ3JlYXRlIGVzYnVpbGQgb3B0aW9ucyBpZiBub3QgcHJlc2VudFxuICAgIGlmICh0aGlzLiNlc2J1aWxkT3B0aW9ucyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAodGhpcy5pbmNyZW1lbnRhbCkge1xuICAgICAgICB0aGlzLiNsb2FkQ2FjaGUgPSBuZXcgTWVtb3J5TG9hZFJlc3VsdENhY2hlKCk7XG4gICAgICB9XG4gICAgICB0aGlzLiNlc2J1aWxkT3B0aW9ucyA9IHRoaXMuI29wdGlvbnNGYWN0b3J5KHRoaXMuI2xvYWRDYWNoZSk7XG4gICAgfVxuXG4gICAgbGV0IHJlc3VsdDtcbiAgICB0cnkge1xuICAgICAgaWYgKHRoaXMuI2VzYnVpbGRDb250ZXh0KSB7XG4gICAgICAgIC8vIFJlYnVpbGQgdXNpbmcgdGhlIGV4aXN0aW5nIGluY3JlbWVudGFsIGJ1aWxkIGNvbnRleHRcbiAgICAgICAgcmVzdWx0ID0gYXdhaXQgdGhpcy4jZXNidWlsZENvbnRleHQucmVidWlsZCgpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmluY3JlbWVudGFsKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhbiBpbmNyZW1lbnRhbCBidWlsZCBjb250ZXh0IGFuZCBwZXJmb3JtIHRoZSBmaXJzdCBidWlsZC5cbiAgICAgICAgLy8gQ29udGV4dCBjcmVhdGlvbiBkb2VzIG5vdCBwZXJmb3JtIGEgYnVpbGQuXG4gICAgICAgIHRoaXMuI2VzYnVpbGRDb250ZXh0ID0gYXdhaXQgY29udGV4dCh0aGlzLiNlc2J1aWxkT3B0aW9ucyk7XG4gICAgICAgIHJlc3VsdCA9IGF3YWl0IHRoaXMuI2VzYnVpbGRDb250ZXh0LnJlYnVpbGQoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEZvciBub24taW5jcmVtZW50YWwgYnVpbGRzLCBwZXJmb3JtIGEgc2luZ2xlIGJ1aWxkXG4gICAgICAgIHJlc3VsdCA9IGF3YWl0IGJ1aWxkKHRoaXMuI2VzYnVpbGRPcHRpb25zKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChmYWlsdXJlKSB7XG4gICAgICAvLyBCdWlsZCBmYWlsdXJlcyB3aWxsIHRocm93IGFuIGV4Y2VwdGlvbiB3aGljaCBjb250YWlucyBlcnJvcnMvd2FybmluZ3NcbiAgICAgIGlmIChpc0VzQnVpbGRGYWlsdXJlKGZhaWx1cmUpKSB7XG4gICAgICAgIHJldHVybiBmYWlsdXJlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZmFpbHVyZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBVcGRhdGUgZmlsZXMgdGhhdCBzaG91bGQgYmUgd2F0Y2hlZC5cbiAgICAvLyBXaGlsZSB0aGlzIHNob3VsZCB0ZWNobmljYWxseSBub3QgYmUgbGlua2VkIHRvIGluY3JlbWVudGFsIG1vZGUsIGluY3JlbWVudGFsIGlzIG9ubHlcbiAgICAvLyBjdXJyZW50bHkgZW5hYmxlZCB3aXRoIHdhdGNoIG1vZGUgd2hlcmUgd2F0Y2ggZmlsZXMgYXJlIG5lZWRlZC5cbiAgICBpZiAodGhpcy5pbmNyZW1lbnRhbCkge1xuICAgICAgdGhpcy53YXRjaEZpbGVzLmNsZWFyKCk7XG4gICAgICAvLyBBZGQgaW5wdXQgZmlsZXMgZXhjZXB0IHZpcnR1YWwgYW5ndWxhciBmaWxlcyB3aGljaCBkbyBub3QgZXhpc3Qgb24gZGlza1xuICAgICAgT2JqZWN0LmtleXMocmVzdWx0Lm1ldGFmaWxlLmlucHV0cylcbiAgICAgICAgLmZpbHRlcigoaW5wdXQpID0+ICFpbnB1dC5zdGFydHNXaXRoKCdhbmd1bGFyOicpKVxuICAgICAgICAvLyBpbnB1dCBmaWxlIHBhdGhzIGFyZSBhbHdheXMgcmVsYXRpdmUgdG8gdGhlIHdvcmtzcGFjZSByb290XG4gICAgICAgIC5mb3JFYWNoKChpbnB1dCkgPT4gdGhpcy53YXRjaEZpbGVzLmFkZChqb2luKHRoaXMud29ya3NwYWNlUm9vdCwgaW5wdXQpKSk7XG4gICAgICAvLyBBbHNvIGFkZCBhbnkgZmlsZXMgZnJvbSB0aGUgbG9hZCByZXN1bHQgY2FjaGVcbiAgICAgIGlmICh0aGlzLiNsb2FkQ2FjaGUpIHtcbiAgICAgICAgdGhpcy4jbG9hZENhY2hlLndhdGNoRmlsZXNcbiAgICAgICAgICAuZmlsdGVyKChmaWxlKSA9PiAhZmlsZS5zdGFydHNXaXRoKCdhbmd1bGFyOicpKVxuICAgICAgICAgIC8vIHdhdGNoIGZpbGVzIGFyZSBmdWxseSByZXNvbHZlZCBwYXRoc1xuICAgICAgICAgIC5mb3JFYWNoKChmaWxlKSA9PiB0aGlzLndhdGNoRmlsZXMuYWRkKGZpbGUpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gaWYgdGhlIGJ1aWxkIGVuY291bnRlcmVkIGFueSBlcnJvcnNcbiAgICBpZiAocmVzdWx0LmVycm9ycy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVycm9yczogcmVzdWx0LmVycm9ycyxcbiAgICAgICAgd2FybmluZ3M6IHJlc3VsdC53YXJuaW5ncyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gRmluZCBhbGwgaW5pdGlhbCBmaWxlc1xuICAgIGNvbnN0IGluaXRpYWxGaWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBJbml0aWFsRmlsZVJlY29yZD4oKTtcbiAgICBmb3IgKGNvbnN0IG91dHB1dEZpbGUgb2YgcmVzdWx0Lm91dHB1dEZpbGVzKSB7XG4gICAgICAvLyBFbnRyaWVzIGluIHRoZSBtZXRhZmlsZSBhcmUgcmVsYXRpdmUgdG8gdGhlIGBhYnNXb3JraW5nRGlyYCBvcHRpb24gd2hpY2ggaXMgc2V0IHRvIHRoZSB3b3Jrc3BhY2VSb290XG4gICAgICBjb25zdCByZWxhdGl2ZUZpbGVQYXRoID0gcmVsYXRpdmUodGhpcy53b3Jrc3BhY2VSb290LCBvdXRwdXRGaWxlLnBhdGgpO1xuICAgICAgY29uc3QgZW50cnlQb2ludCA9IHJlc3VsdC5tZXRhZmlsZS5vdXRwdXRzW3JlbGF0aXZlRmlsZVBhdGhdPy5lbnRyeVBvaW50O1xuXG4gICAgICBvdXRwdXRGaWxlLnBhdGggPSByZWxhdGl2ZUZpbGVQYXRoO1xuXG4gICAgICBpZiAoZW50cnlQb2ludCkge1xuICAgICAgICAvLyBUaGUgZmlyc3QgcGFydCBvZiB0aGUgZmlsZW5hbWUgaXMgdGhlIG5hbWUgb2YgZmlsZSAoZS5nLiwgXCJwb2x5ZmlsbHNcIiBmb3IgXCJwb2x5ZmlsbHMtN1M1RzNNRFkuanNcIilcbiAgICAgICAgY29uc3QgbmFtZSA9IGJhc2VuYW1lKHJlbGF0aXZlRmlsZVBhdGgpLnJlcGxhY2UoLyg/Oi1bXFxkQS1aXXs4fSk/XFwuW2Etel17MiwzfSQvLCAnJyk7XG4gICAgICAgIC8vIEVudHJ5IHBvaW50cyBhcmUgb25seSBzdHlsZXMgb3Igc2NyaXB0c1xuICAgICAgICBjb25zdCB0eXBlID0gZXh0bmFtZShyZWxhdGl2ZUZpbGVQYXRoKSA9PT0gJy5jc3MnID8gJ3N0eWxlJyA6ICdzY3JpcHQnO1xuXG4gICAgICAgIC8vIE9ubHkgZW50cnlwb2ludHMgd2l0aCBhbiBlbnRyeSBpbiB0aGUgb3B0aW9ucyBhcmUgaW5pdGlhbCBmaWxlcy5cbiAgICAgICAgLy8gRHluYW1pYyBpbXBvcnRzIGFsc28gaGF2ZSBhbiBlbnRyeVBvaW50IHZhbHVlIGluIHRoZSBtZXRhIGZpbGUuXG4gICAgICAgIGlmICgodGhpcy4jZXNidWlsZE9wdGlvbnMuZW50cnlQb2ludHMgYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPik/LltuYW1lXSkge1xuICAgICAgICAgIC8vIEFuIGVudHJ5UG9pbnQgdmFsdWUgaW5kaWNhdGVzIGFuIGluaXRpYWwgZmlsZVxuICAgICAgICAgIGNvbnN0IHJlY29yZDogSW5pdGlhbEZpbGVSZWNvcmQgPSB7XG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIGVudHJ5cG9pbnQ6IHRydWUsXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGlmICghdGhpcy5pbml0aWFsRmlsdGVyIHx8IHRoaXMuaW5pdGlhbEZpbHRlcihyZWNvcmQpKSB7XG4gICAgICAgICAgICBpbml0aWFsRmlsZXMuc2V0KHJlbGF0aXZlRmlsZVBhdGgsIHJlY29yZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQW5hbHl6ZSBmb3IgdHJhbnNpdGl2ZSBpbml0aWFsIGZpbGVzXG4gICAgY29uc3QgZmlsZXMgPSBbLi4uaW5pdGlhbEZpbGVzLmtleXMoKV07XG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IGluaXRpYWxJbXBvcnQgb2YgcmVzdWx0Lm1ldGFmaWxlLm91dHB1dHNbZmlsZV0uaW1wb3J0cykge1xuICAgICAgICBpZiAoaW5pdGlhbEZpbGVzLmhhcyhpbml0aWFsSW1wb3J0LnBhdGgpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5pdGlhbEltcG9ydC5raW5kID09PSAnaW1wb3J0LXN0YXRlbWVudCcgfHwgaW5pdGlhbEltcG9ydC5raW5kID09PSAnaW1wb3J0LXJ1bGUnKSB7XG4gICAgICAgICAgY29uc3QgcmVjb3JkOiBJbml0aWFsRmlsZVJlY29yZCA9IHtcbiAgICAgICAgICAgIHR5cGU6IGluaXRpYWxJbXBvcnQua2luZCA9PT0gJ2ltcG9ydC1ydWxlJyA/ICdzdHlsZScgOiAnc2NyaXB0JyxcbiAgICAgICAgICAgIGVudHJ5cG9pbnQ6IGZhbHNlLFxuICAgICAgICAgICAgZXh0ZXJuYWw6IGluaXRpYWxJbXBvcnQuZXh0ZXJuYWwsXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGlmICghdGhpcy5pbml0aWFsRmlsdGVyIHx8IHRoaXMuaW5pdGlhbEZpbHRlcihyZWNvcmQpKSB7XG4gICAgICAgICAgICBpbml0aWFsRmlsZXMuc2V0KGluaXRpYWxJbXBvcnQucGF0aCwgcmVjb3JkKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoIWluaXRpYWxJbXBvcnQuZXh0ZXJuYWwpIHtcbiAgICAgICAgICAgIGZpbGVzLnB1c2goaW5pdGlhbEltcG9ydC5wYXRoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBvdXRwdXRGaWxlcyA9IHJlc3VsdC5vdXRwdXRGaWxlcy5tYXAoKGZpbGUpID0+IHtcbiAgICAgIGxldCBmaWxlVHlwZTogQnVpbGRPdXRwdXRGaWxlVHlwZTtcbiAgICAgIGlmIChkaXJuYW1lKGZpbGUucGF0aCkgPT09ICdtZWRpYScpIHtcbiAgICAgICAgZmlsZVR5cGUgPSBCdWlsZE91dHB1dEZpbGVUeXBlLk1lZGlhO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmlsZVR5cGUgPVxuICAgICAgICAgIHRoaXMuI2VzYnVpbGRPcHRpb25zPy5wbGF0Zm9ybSA9PT0gJ25vZGUnXG4gICAgICAgICAgICA/IEJ1aWxkT3V0cHV0RmlsZVR5cGUuU2VydmVyXG4gICAgICAgICAgICA6IEJ1aWxkT3V0cHV0RmlsZVR5cGUuQnJvd3NlcjtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGNvbnZlcnRPdXRwdXRGaWxlKGZpbGUsIGZpbGVUeXBlKTtcbiAgICB9KTtcblxuICAgIC8vIFJldHVybiB0aGUgc3VjY2Vzc2Z1bCBidWlsZCByZXN1bHRzXG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLnJlc3VsdCxcbiAgICAgIG91dHB1dEZpbGVzLFxuICAgICAgaW5pdGlhbEZpbGVzLFxuICAgICAgZXJyb3JzOiB1bmRlZmluZWQsXG4gICAgfTtcbiAgfVxuXG4gIGludmFsaWRhdGUoZmlsZXM6IEl0ZXJhYmxlPHN0cmluZz4pOiBib29sZWFuIHtcbiAgICBpZiAoIXRoaXMuaW5jcmVtZW50YWwpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBsZXQgaW52YWxpZCA9IGZhbHNlO1xuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgaWYgKHRoaXMuI2xvYWRDYWNoZT8uaW52YWxpZGF0ZShmaWxlKSkge1xuICAgICAgICBpbnZhbGlkID0gdHJ1ZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGludmFsaWQgfHw9IHRoaXMud2F0Y2hGaWxlcy5oYXMoZmlsZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGludmFsaWQ7XG4gIH1cblxuICAvKipcbiAgICogRGlzcG9zZXMgaW5jcmVtZW50YWwgYnVpbGQgcmVzb3VyY2VzIHByZXNlbnQgaW4gdGhlIGNvbnRleHQuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gZGlzcG9zYWwgaXMgY29tcGxldGUuXG4gICAqL1xuICBhc3luYyBkaXNwb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICB0aGlzLiNlc2J1aWxkT3B0aW9ucyA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuI2xvYWRDYWNoZSA9IHVuZGVmaW5lZDtcbiAgICAgIGF3YWl0IHRoaXMuI2VzYnVpbGRDb250ZXh0Py5kaXNwb3NlKCk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuI2VzYnVpbGRDb250ZXh0ID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxufVxuIl19