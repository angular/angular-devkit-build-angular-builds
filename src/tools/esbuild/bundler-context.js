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
    static async bundleAll(contexts, changedFiles) {
        const individualResults = await Promise.all([...contexts].map((context) => {
            if (changedFiles) {
                context.invalidate(changedFiles);
            }
            return context.bundle();
        }));
        // Return directly if only one result
        if (individualResults.length === 1) {
            return individualResults[0];
        }
        let errors;
        const warnings = [];
        const metafile = { inputs: {}, outputs: {} };
        const initialFiles = new Map();
        const externalImportsBrowser = new Set();
        const externalImportsServer = new Set();
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
            result.externalImports.browser?.forEach((value) => externalImportsBrowser.add(value));
            result.externalImports.server?.forEach((value) => externalImportsServer.add(value));
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
            externalImports: {
                browser: externalImportsBrowser,
                server: externalImportsServer,
            },
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
        // Collect all external package names
        const externalImports = new Set();
        for (const { imports } of Object.values(result.metafile.outputs)) {
            for (const importData of imports) {
                if (!importData.external ||
                    (importData.kind !== 'import-statement' && importData.kind !== 'dynamic-import')) {
                    continue;
                }
                externalImports.add(importData.path);
            }
        }
        const platformIsServer = this.#esbuildOptions?.platform === 'node';
        const outputFiles = result.outputFiles.map((file) => {
            let fileType;
            if ((0, node_path_1.dirname)(file.path) === 'media') {
                fileType = BuildOutputFileType.Media;
            }
            else {
                fileType = platformIsServer ? BuildOutputFileType.Server : BuildOutputFileType.Browser;
            }
            return (0, utils_1.convertOutputFile)(file, fileType);
        });
        // Return the successful build results
        return {
            ...result,
            outputFiles,
            initialFiles,
            externalImports: {
                [platformIsServer ? 'server' : 'browser']: externalImports,
            },
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
