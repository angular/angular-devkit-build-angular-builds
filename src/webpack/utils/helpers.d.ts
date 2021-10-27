/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Configuration, SourceMapDevToolPlugin } from 'webpack';
import { ExtraEntryPoint, ExtraEntryPointClass } from '../../builders/browser/schema';
export interface HashFormat {
    chunk: string;
    extract: string;
    file: string;
    script: string;
}
export declare function getOutputHashFormat(option: string, length?: number): HashFormat;
export declare type NormalizedEntryPoint = Required<ExtraEntryPointClass>;
export declare function normalizeExtraEntryPoints(extraEntryPoints: ExtraEntryPoint[], defaultBundleName: string): NormalizedEntryPoint[];
export declare function getSourceMapDevTool(scriptsSourceMap: boolean | undefined, stylesSourceMap: boolean | undefined, hiddenSourceMap?: boolean, inlineSourceMap?: boolean): SourceMapDevToolPlugin;
export declare function isPolyfillsEntry(name: string): boolean;
export declare function getWatchOptions(poll: number | undefined): NonNullable<Configuration['watchOptions']>;
export declare function assetNameTemplateFactory(hashFormat: HashFormat): (resourcePath: string) => string;
export declare function getInstrumentationExcludedPaths(sourceRoot: string, excludedPaths: string[]): Set<string>;
