"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionResult = void 0;
const utils_1 = require("./utils");
/**
 * Represents the result of a single builder execute call.
 */
class ExecutionResult {
    rebuildContexts;
    codeBundleCache;
    outputFiles = [];
    assetFiles = [];
    errors = [];
    externalMetadata;
    constructor(rebuildContexts, codeBundleCache) {
        this.rebuildContexts = rebuildContexts;
        this.codeBundleCache = codeBundleCache;
    }
    addOutputFile(path, content, type) {
        this.outputFiles.push((0, utils_1.createOutputFileFromText)(path, content, type));
    }
    addAssets(assets) {
        this.assetFiles.push(...assets);
    }
    addErrors(errors) {
        this.errors.push(...errors);
    }
    /**
     * Add external JavaScript import metadata to the result. This is currently used
     * by the development server to optimize the prebundling process.
     * @param implicitBrowser External dependencies for the browser bundles due to the external packages option.
     * @param implicitServer External dependencies for the server bundles due to the external packages option.
     * @param explicit External dependencies due to explicit project configuration.
     */
    setExternalMetadata(implicitBrowser, implicitServer, explicit) {
        this.externalMetadata = { implicitBrowser, implicitServer, explicit: explicit ?? [] };
    }
    get output() {
        return {
            success: this.errors.length === 0,
        };
    }
    get outputWithFiles() {
        return {
            success: this.errors.length === 0,
            outputFiles: this.outputFiles,
            assetFiles: this.assetFiles,
            errors: this.errors,
            externalMetadata: this.externalMetadata,
        };
    }
    get watchFiles() {
        const files = this.rebuildContexts.flatMap((context) => [...context.watchFiles]);
        if (this.codeBundleCache?.referencedFiles) {
            files.push(...this.codeBundleCache.referencedFiles);
        }
        if (this.codeBundleCache?.loadResultCache) {
            files.push(...this.codeBundleCache.loadResultCache.watchFiles);
        }
        return files;
    }
    createRebuildState(fileChanges) {
        this.codeBundleCache?.invalidate([...fileChanges.modified, ...fileChanges.removed]);
        return {
            rebuildContexts: this.rebuildContexts,
            codeBundleCache: this.codeBundleCache,
            fileChanges,
            previousOutputHashes: new Map(this.outputFiles.map((file) => [file.path, file.hash])),
        };
    }
    findChangedFiles(previousOutputHashes) {
        const changed = new Set();
        for (const file of this.outputFiles) {
            const previousHash = previousOutputHashes.get(file.path);
            if (previousHash === undefined || previousHash !== file.hash) {
                changed.add(file.path);
            }
        }
        return changed;
    }
    async dispose() {
        await Promise.allSettled(this.rebuildContexts.map((context) => context.dispose()));
    }
}
exports.ExecutionResult = ExecutionResult;
