/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { OptimizationOptions } from '../browser/schema';
export interface NormalizedOptimization {
    scripts: boolean;
    styles: boolean;
}
export declare function normalizeOptimization(optimization: OptimizationOptions): NormalizedOptimization;
