/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Path, virtualFs } from '@angular-devkit/core';
import { OptimizationClass, SourceMapClass } from '../browser/schema';
import { BuildWebpackServerSchema } from '../server/schema';
import { NormalizedFileReplacement } from './normalize-file-replacements';
/**
 * A normalized webpack server builder schema.
 */
export interface NormalizedWebpackServerBuilderSchema extends BuildWebpackServerSchema {
    sourceMap: SourceMapClass;
    fileReplacements: NormalizedFileReplacement[];
    optimization: OptimizationClass;
}
export declare function normalizeWebpackServerSchema(host: virtualFs.Host<{}>, root: Path, projectRoot: Path, sourceRoot: Path | undefined, options: BuildWebpackServerSchema): NormalizedWebpackServerBuilderSchema;
