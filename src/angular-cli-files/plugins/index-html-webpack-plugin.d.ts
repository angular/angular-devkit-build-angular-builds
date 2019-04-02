/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Compiler } from 'webpack';
export interface IndexHtmlWebpackPluginOptions {
    input: string;
    output: string;
    baseHref?: string;
    entrypoints: string[];
    deployUrl?: string;
    sri: boolean;
    noModuleEntrypoints: string[];
}
export declare class IndexHtmlWebpackPlugin {
    private _options;
    constructor(options?: Partial<IndexHtmlWebpackPluginOptions>);
    apply(compiler: Compiler): void;
}
