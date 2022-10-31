/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { Plugin } from 'esbuild';
export declare function createSassPlugin(options: {
    sourcemap: boolean;
    loadPaths?: string[];
}): Plugin;
