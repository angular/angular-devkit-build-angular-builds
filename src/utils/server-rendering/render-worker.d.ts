/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { ESMInMemoryFileLoaderWorkerData } from './esm-in-memory-loader/loader-hooks';
import { RenderResult, ServerContext } from './render-page';
export interface RenderWorkerData extends ESMInMemoryFileLoaderWorkerData {
    document: string;
    inlineCriticalCss?: boolean;
}
export interface RenderOptions {
    route: string;
    serverContext: ServerContext;
}
export default function (options: RenderOptions): Promise<RenderResult>;
