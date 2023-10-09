/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * Node.js ESM loader to redirect imports to in memory files.
 * @see: https://nodejs.org/api/esm.html#loaders for more information about loaders.
 */
export interface ESMInMemoryFileLoaderWorkerData {
    outputFiles: Record<string, string>;
    workspaceRoot: string;
}
export declare function initialize(data: ESMInMemoryFileLoaderWorkerData): void;
export declare function resolve(specifier: string, context: {
    parentURL: undefined | string;
}, nextResolve: Function): any;
export declare function load(url: string, context: {
    format?: string | null;
}, nextLoad: Function): Promise<any>;
