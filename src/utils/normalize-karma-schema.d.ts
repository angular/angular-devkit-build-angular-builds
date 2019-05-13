/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Path, virtualFs } from '@angular-devkit/core';
import { AssetPatternClass, OptimizationClass, SourceMapClass } from '../browser/schema';
import { Schema as KarmaBuilderSchema } from '../karma/schema';
import { NormalizedFileReplacement } from './normalize-file-replacements';
/**
 * A normalized webpack server builder schema.
 */
export interface NormalizedKarmaBuilderSchema extends KarmaBuilderSchema {
    sourceMap: SourceMapClass;
    fileReplacements: NormalizedFileReplacement[];
    assets: AssetPatternClass[];
    optimization: OptimizationClass;
}
export declare function normalizeKarmaSchema(host: virtualFs.Host<{}>, root: Path, projectRoot: Path, sourceRoot: Path | undefined, options: KarmaBuilderSchema): NormalizedKarmaBuilderSchema;
