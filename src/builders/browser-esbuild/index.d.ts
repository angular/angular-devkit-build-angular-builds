/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import type { BuildOutputFile } from '@angular/build';
import { BuilderContext, BuilderOutput } from '@angular-devkit/architect';
import type { Plugin } from 'esbuild';
import type { Schema as BrowserBuilderOptions } from './schema';
/**
 * Main execution function for the esbuild-based application builder.
 * The options are compatible with the Webpack-based builder.
 * @param userOptions The browser builder options to use when setting up the application build
 * @param context The Architect builder context object
 * @returns An async iterable with the builder result output
 */
export declare function buildEsbuildBrowser(userOptions: BrowserBuilderOptions, context: BuilderContext, infrastructureSettings?: {
    write?: boolean;
}, plugins?: Plugin[]): AsyncIterable<BuilderOutput & {
    outputFiles?: BuildOutputFile[];
    assetFiles?: {
        source: string;
        destination: string;
    }[];
}>;
declare const _default: import("../../../../architect/src/internal").Builder<BrowserBuilderOptions & import("../../../../core/src").JsonObject>;
export default _default;
