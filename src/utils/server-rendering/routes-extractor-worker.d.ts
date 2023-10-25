/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { ESMInMemoryFileLoaderWorkerData } from './esm-in-memory-loader/loader-hooks';
export interface RoutesExtractorWorkerData extends ESMInMemoryFileLoaderWorkerData {
    document: string;
    verbose: boolean;
    url: string;
    assetsServerAddress: string;
}
export interface RoutersExtractorWorkerResult {
    routes: string[];
    warnings?: string[];
}
export default function (): Promise<RoutersExtractorWorkerResult>;
