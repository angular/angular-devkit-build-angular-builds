/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { BuilderContext } from '@angular-devkit/architect';
import type { NormalizedDevServerOptions } from './options';
import type { DevServerBuilderOutput } from './webpack-server';
export declare function serveWithVite(serverOptions: NormalizedDevServerOptions, builderName: string, context: BuilderContext): AsyncIterableIterator<DevServerBuilderOutput>;
