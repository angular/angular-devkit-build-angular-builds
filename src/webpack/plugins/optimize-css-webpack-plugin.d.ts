/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Compiler } from 'webpack';
export interface OptimizeCssWebpackPluginOptions {
    sourceMap: boolean;
    test: (file: string) => boolean;
}
export declare class OptimizeCssWebpackPlugin {
    private readonly _options;
    constructor(options: Partial<OptimizeCssWebpackPluginOptions>);
    apply(compiler: Compiler): void;
}
