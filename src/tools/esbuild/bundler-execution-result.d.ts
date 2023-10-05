/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { ChangedFiles } from '../../tools/esbuild/watcher';
import type { SourceFileCache } from './angular/compiler-plugin';
import type { BuildOutputFile, BuildOutputFileType, BundlerContext } from './bundler-context';
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
    assetFiles: {
        source: string;
        destination: string;
    }[];
    constructor(rebuildContexts: BundlerContext[], codeBundleCache?: SourceFileCache | undefined);
    addOutputFile(path: string, content: string, type: BuildOutputFileType): void;
    addAssets(assets: {
        source: string;
        destination: string;
    }[]): void;
    get output(): {
        success: boolean;
    };
    get outputWithFiles(): {
        success: boolean;
        outputFiles: BuildOutputFile[];
        assetFiles: {
            source: string;
            destination: string;
        }[];
    };
    get watchFiles(): string[];
    createRebuildState(fileChanges: ChangedFiles): RebuildState;
    dispose(): Promise<void>;
}
