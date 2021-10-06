/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { json } from '@angular-devkit/core';
export interface NormalizedCachedOptions {
    enabled: boolean;
    path: string;
}
export declare function normalizeCacheOptions(metadata: json.JsonObject, worspaceRoot: string): NormalizedCachedOptions;
