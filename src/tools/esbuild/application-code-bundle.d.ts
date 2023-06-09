/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { BuildOptions } from 'esbuild';
import { NormalizedBrowserOptions } from '../../builders/browser-esbuild/options';
import { SourceFileCache } from '../../tools/esbuild/angular/compiler-plugin';
export declare function createCodeBundleOptions(options: NormalizedBrowserOptions, target: string[], browsers: string[], sourceFileCache?: SourceFileCache): BuildOptions;
