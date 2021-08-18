/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { Compiler } from 'webpack';
export interface CssOptimizerPluginOptions {
    supportedBrowsers?: string[];
}
/**
 * A Webpack plugin that provides CSS optimization capabilities.
 *
 * The plugin uses both `esbuild` to provide both fast and highly-optimized
 * code output.
 */
export declare class CssOptimizerPlugin {
    private targets;
    constructor(options?: CssOptimizerPluginOptions);
    apply(compiler: Compiler): void;
    private addWarnings;
    private transformSupportedBrowsersToTargets;
}
