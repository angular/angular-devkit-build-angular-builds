/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuilderContext, BuilderOutput } from '@angular-devkit/architect';
import type { Plugin } from 'esbuild';
import { BuildOutputFile } from '../../tools/esbuild/bundler-context';
import { ApplicationBuilderInternalOptions } from './options';
import { Schema as ApplicationBuilderOptions } from './schema';
export { ApplicationBuilderOptions };
export declare function buildApplicationInternal(options: ApplicationBuilderInternalOptions, context: BuilderContext & {
    signal?: AbortSignal;
}, infrastructureSettings?: {
    write?: boolean;
}, plugins?: Plugin[]): AsyncIterable<BuilderOutput & {
    outputFiles?: BuildOutputFile[];
    assetFiles?: {
        source: string;
        destination: string;
    }[];
}>;
/**
 * Builds an application using the `application` builder with the provided
 * options.
 *
 * Usage of the `plugins` parameter is NOT supported and may cause unexpected
 * build output or build failures.
 *
 * @experimental Direct usage of this function is considered experimental.
 *
 * @param options The options defined by the builder's schema to use.
 * @param context An Architect builder context instance.
 * @param plugins An array of plugins to apply to the main code bundling.
 * @returns The build output results of the build.
 */
export declare function buildApplication(options: ApplicationBuilderOptions, context: BuilderContext, plugins?: Plugin[]): AsyncIterable<BuilderOutput & {
    outputFiles?: BuildOutputFile[];
    assetFiles?: {
        source: string;
        destination: string;
    }[];
}>;
declare const _default: import("../../../../architect/src/internal").Builder<ApplicationBuilderOptions & import("../../../../core/src").JsonObject>;
export default _default;
