/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { OutputFile, PluginBuild } from 'esbuild';
import { ComponentStylesheetBundler } from './component-stylesheets';
/**
 * Sets up esbuild resolve and load callbacks to support Angular JIT mode processing
 * for both Component stylesheets and templates. These callbacks work alongside the JIT
 * resource TypeScript transformer to convert and then bundle Component resources as
 * static imports.
 * @param build An esbuild {@link PluginBuild} instance used to add callbacks.
 * @param styleOptions The options to use when bundling stylesheets.
 * @param stylesheetResourceFiles An array where stylesheet resources will be added.
 */
export declare function setupJitPluginCallbacks(build: PluginBuild, stylesheetBundler: ComponentStylesheetBundler, stylesheetResourceFiles: OutputFile[], inlineStyleLanguage: string): void;
