/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <reference types="node" />
/// <reference types="@types/node/worker_threads" />
/// <reference types="@types/node/ts4.8/worker_threads" />
interface JavaScriptTransformRequest {
    filename: string;
    data: string | Uint8Array;
    sourcemap: boolean;
    thirdPartySourcemaps: boolean;
    advancedOptimizations: boolean;
    skipLinker?: boolean;
    sideEffects?: boolean;
    jit: boolean;
}
export default function transformJavaScript(request: JavaScriptTransformRequest): Promise<ArrayBuffer | import("worker_threads").MessagePort | import("piscina/dist/src/common").Transferable | ArrayBufferView>;
export {};
