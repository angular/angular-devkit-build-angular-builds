/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { BuilderContext } from '@angular-devkit/architect';
import type { Plugin } from 'esbuild';
import type { InlineConfig } from 'vite';
import { JavaScriptTransformer } from '../../tools/esbuild/javascript-transformer';
import type { NormalizedDevServerOptions } from './options';
import type { DevServerBuilderOutput } from './webpack-server';
interface OutputFileRecord {
    contents: Uint8Array;
    size: number;
    hash?: string;
    updated: boolean;
    servable: boolean;
}
export declare function serveWithVite(serverOptions: NormalizedDevServerOptions, builderName: string, context: BuilderContext, plugins?: Plugin[]): AsyncIterableIterator<DevServerBuilderOutput>;
export declare function setupServer(serverOptions: NormalizedDevServerOptions, outputFiles: Map<string, OutputFileRecord>, assets: Map<string, string>, preserveSymlinks: boolean | undefined, externalMetadata: {
    implicit: string[];
    explicit: string[];
}, ssr: boolean, prebundleTransformer: JavaScriptTransformer, target: string[]): Promise<InlineConfig>;
export {};
