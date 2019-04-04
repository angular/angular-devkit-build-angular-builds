/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Source } from 'webpack-sources';
export declare type LoadOutputFileFunctionType = (file: string) => string;
export interface GenerateIndexHtmlParams {
    input: string;
    inputContent: string;
    baseHref?: string;
    deployUrl?: string;
    sri: boolean;
    unfilteredSortedFiles: CompiledFileInfo[];
    noModuleFiles: Set<string>;
    loadOutputFile: LoadOutputFileFunctionType;
}
export declare type CompiledFileType = 'nomodule' | 'module' | 'none';
export interface CompiledFileInfo {
    file: string;
    type: CompiledFileType;
}
export declare function generateIndexHtml(params: GenerateIndexHtmlParams): Source;
