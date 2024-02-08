/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { logging } from '@angular-devkit/core';
import { BuildOptions, Metafile, OutputFile } from 'esbuild';
import { NormalizedApplicationBuildOptions, NormalizedOutputOptions } from '../../builders/application/options';
import { BudgetCalculatorResult } from '../../utils/bundle-calculator';
import { BuildOutputFile, BuildOutputFileType, InitialFileRecord } from './bundler-context';
import { BuildOutputAsset, ExecutionResult } from './bundler-execution-result';
export declare function logBuildStats(metafile: Metafile, initial: Map<string, InitialFileRecord>, budgetFailures: BudgetCalculatorResult[] | undefined, colors: boolean, changedFiles?: Set<string>, estimatedTransferSizes?: Map<string, number>, ssrOutputEnabled?: boolean, verbose?: boolean): string;
export declare function calculateEstimatedTransferSizes(outputFiles: OutputFile[]): Promise<Map<string, number>>;
export declare function withSpinner<T>(text: string, action: () => T | Promise<T>): Promise<T>;
export declare function withNoProgress<T>(text: string, action: () => T | Promise<T>): Promise<T>;
/**
 * Generates a syntax feature object map for Angular applications based on a list of targets.
 * A full set of feature names can be found here: https://esbuild.github.io/api/#supported
 * @param target An array of browser/engine targets in the format accepted by the esbuild `target` option.
 * @returns An object that can be used with the esbuild build `supported` option.
 */
export declare function getFeatureSupport(target: string[]): BuildOptions['supported'];
export declare function writeResultFiles(outputFiles: BuildOutputFile[], assetFiles: BuildOutputAsset[] | undefined, { base, browser, media, server }: NormalizedOutputOptions): Promise<void>;
export declare function emitFilesToDisk<T = BuildOutputAsset | BuildOutputFile>(files: T[], writeFileCallback: (file: T) => Promise<void>): Promise<void>;
export declare function createOutputFileFromText(path: string, text: string, type: BuildOutputFileType): BuildOutputFile;
export declare function createOutputFileFromData(path: string, data: Uint8Array, type: BuildOutputFileType): BuildOutputFile;
export declare function convertOutputFile(file: OutputFile, type: BuildOutputFileType): BuildOutputFile;
/**
 * Transform browserlists result to esbuild target.
 * @see https://esbuild.github.io/api/#target
 */
export declare function transformSupportedBrowsersToTargets(supportedBrowsers: string[]): string[];
/**
 * Transform supported Node.js versions to esbuild target.
 * @see https://esbuild.github.io/api/#target
 */
export declare function getSupportedNodeTargets(): string[];
export declare function logMessages(logger: logging.LoggerApi, executionResult: ExecutionResult, options: NormalizedApplicationBuildOptions): Promise<void>;
