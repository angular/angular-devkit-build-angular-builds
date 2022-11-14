/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuilderContext } from '@angular-devkit/architect';
import { BuildFailure, BuildInvalidate, BuildOptions, BuildResult, Message, OutputFile } from 'esbuild';
import { FileInfo } from '../../utils/index-file/augment-index-html';
/**
 * Determines if an unknown value is an esbuild BuildFailure error object thrown by esbuild.
 * @param value A potential esbuild BuildFailure error object.
 * @returns `true` if the object is determined to be a BuildFailure object; otherwise, `false`.
 */
export declare function isEsBuildFailure(value: unknown): value is BuildFailure;
/**
 * Executes the esbuild build function and normalizes the build result in the event of a
 * build failure that results in no output being generated.
 * All builds use the `write` option with a value of `false` to allow for the output files
 * build result array to be populated.
 *
 * @param optionsOrInvalidate The esbuild options object to use when building or the invalidate object
 * returned from an incremental build to perform an additional incremental build.
 * @returns If output files are generated, the full esbuild BuildResult; if not, the
 * warnings and errors for the attempted build.
 */
export declare function bundle(workspaceRoot: string, optionsOrInvalidate: BuildOptions | BuildInvalidate): Promise<(BuildResult & {
    outputFiles: OutputFile[];
    initialFiles: FileInfo[];
}) | (BuildFailure & {
    outputFiles?: never;
})>;
export declare function logMessages(context: BuilderContext, { errors, warnings }: {
    errors: Message[];
    warnings: Message[];
}): Promise<void>;
