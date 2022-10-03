/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { Plugin } from 'esbuild';
import { BundleStylesheetOptions } from './stylesheets';
export interface CompilerPluginOptions {
    sourcemap: boolean;
    tsconfig: string;
    advancedOptimizations?: boolean;
    thirdPartySourcemaps?: boolean;
    fileReplacements?: Record<string, string>;
}
export declare function createCompilerPlugin(pluginOptions: CompilerPluginOptions, styleOptions: BundleStylesheetOptions): Plugin;
