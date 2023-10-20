/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { Plugin } from 'esbuild';
import { JavaScriptTransformerOptions } from './javascript-transformer';
export interface JavaScriptTransformerPluginOptions extends JavaScriptTransformerOptions {
    babelFileCache?: Map<string, Uint8Array>;
    maxWorkers: number;
}
/**
 * Creates a plugin that Transformers JavaScript using Babel.
 *
 * @returns An esbuild plugin.
 */
export declare function createJavaScriptTransformerPlugin(options: JavaScriptTransformerPluginOptions): Plugin;
