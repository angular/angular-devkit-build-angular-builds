/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SourceMapOptions } from '../browser/schema';
export interface NormalizedSourceMaps {
    sourceMap: boolean;
    scriptsSourceMap: boolean;
    stylesSourceMap: boolean;
    hiddenSourceMap: boolean;
    vendorSourceMap: boolean;
}
export declare function normalizeSourceMaps(sourceMap: SourceMapOptions): NormalizedSourceMaps;
