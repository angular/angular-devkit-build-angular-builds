/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { NormalizedEntryPoint } from './helpers';
import { JsonChunkStats, JsonCompilationStats } from './stats';
/**
 * Webpack stats may incorrectly mark extra entry points `initial` chunks, when
 * they are actually loaded asynchronously and thus not in the main bundle. This
 * function finds extra entry points in Webpack stats and corrects this value
 * whereever necessary. Does not modify {@param webpackStats}.
 */
export declare function markAsyncChunksNonInitial(webpackStats: JsonCompilationStats, extraEntryPoints: NormalizedEntryPoint[]): JsonChunkStats[];
