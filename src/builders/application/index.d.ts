/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuilderContext, BuilderOutput } from '@angular-devkit/architect';
import { BuildOutputFile } from '../../tools/esbuild/bundler-context';
import { ApplicationBuilderInternalOptions } from './options';
import { Schema as ApplicationBuilderOptions } from './schema';
export declare function buildApplicationInternal(options: ApplicationBuilderInternalOptions, context: BuilderContext & {
    signal?: AbortSignal;
}, infrastructureSettings?: {
    write?: boolean;
}): AsyncIterable<BuilderOutput & {
    outputFiles?: BuildOutputFile[];
    assetFiles?: {
        source: string;
        destination: string;
    }[];
}>;
export declare function buildApplication(options: ApplicationBuilderOptions, context: BuilderContext): AsyncIterable<BuilderOutput & {
    outputFiles?: BuildOutputFile[];
    assetFiles?: {
        source: string;
        destination: string;
    }[];
}>;
declare const _default: import("../../../../architect/src/internal").Builder<ApplicationBuilderOptions & import("../../../../core/src").JsonObject>;
export default _default;
