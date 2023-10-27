/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { Message } from 'esbuild';
import type { ChangedFiles } from '../../tools/esbuild/watcher';
import type { SourceFileCache } from './angular/source-file-cache';
import type { BuildOutputFile, BuildOutputFileType, BundlerContext } from './bundler-context';
export interface BuildOutputAsset {
    source: string;
    destination: string;
}
export interface RebuildState {
    rebuildContexts: BundlerContext[];
    codeBundleCache?: SourceFileCache;
    fileChanges: ChangedFiles;
}
/**
 * Represents the result of a single builder execute call.
 */
export declare class ExecutionResult {
    private rebuildContexts;
    private codeBundleCache?;
    outputFiles: BuildOutputFile[];
    assetFiles: BuildOutputAsset[];
    errors: Message[];
    externalMetadata?: {
        implicit: string[];
        explicit?: string[];
    };
    constructor(rebuildContexts: BundlerContext[], codeBundleCache?: SourceFileCache | undefined);
    addOutputFile(path: string, content: string, type: BuildOutputFileType): void;
    addAssets(assets: BuildOutputAsset[]): void;
    addErrors(errors: Message[]): void;
    /**
     * Add external JavaScript import metadata to the result. This is currently used
     * by the development server to optimize the prebundling process.
     * @param implicit External dependencies due to the external packages option.
     * @param explicit External dependencies due to explicit project configuration.
     */
    setExternalMetadata(implicit: string[], explicit: string[] | undefined): void;
    get output(): {
        success: boolean;
    };
    get outputWithFiles(): {
        success: boolean;
        outputFiles: BuildOutputFile[];
        assetFiles: BuildOutputAsset[];
        errors: Message[];
        externalMetadata: {
            implicit: string[];
            explicit?: string[] | undefined;
        } | undefined;
    };
    get watchFiles(): string[];
    createRebuildState(fileChanges: ChangedFiles): RebuildState;
    dispose(): Promise<void>;
}
