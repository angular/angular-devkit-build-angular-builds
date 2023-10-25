/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuildOutputAsset } from '../../tools/esbuild/bundler-execution-result';
/**
 * Start a server that can handle HTTP requests to assets.
 *
 * @example
 * ```ts
 * httpClient.get('/assets/content.json');
 * ```
 * @returns the server address.
 */
export declare function startServer(assets: Readonly<BuildOutputAsset[]>): Promise<{
    address: string;
    close?: () => void;
}>;
