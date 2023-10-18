/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <reference types="node" />
import type { PartialMessage } from 'esbuild';
import { type MessagePort } from 'node:worker_threads';
export interface InitRequest {
    jit: boolean;
    tsconfig: string;
    fileReplacements?: Record<string, string>;
    stylesheetPort: MessagePort;
    optionsPort: MessagePort;
    optionsSignal: Int32Array;
    webWorkerPort: MessagePort;
    webWorkerSignal: Int32Array;
}
export declare function initialize(request: InitRequest): Promise<{
    referencedFiles: readonly string[];
    compilerOptions: {
        allowJs: boolean | undefined;
    };
}>;
export declare function diagnose(): Promise<{
    errors?: PartialMessage[];
    warnings?: PartialMessage[];
}>;
export declare function emit(): Promise<import("./angular-compilation").EmitFileResult[]>;
export declare function update(files: Set<string>): void;
