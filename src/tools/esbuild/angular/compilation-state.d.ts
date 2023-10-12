/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export declare class SharedTSCompilationState {
    #private;
    get waitUntilReady(): Promise<void>;
    markAsReady(): void;
    markAsInProgress(): void;
    dispose(): void;
}
export declare function getSharedCompilationState(): SharedTSCompilationState;
