/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuilderContext, BuilderOutput } from '@angular-devkit/architect';
import { json } from '@angular-devkit/core';
import { Observable } from 'rxjs';
import * as webpack from 'webpack';
import { ExecutionTransformer } from '../transforms';
import { Schema as BuildWebpackServerOptions } from './schema';
export declare type ServerBuilderOutput = json.JsonObject & BuilderOutput & {
    outputPath?: string;
};
export declare function execute(options: BuildWebpackServerOptions, context: BuilderContext, transforms?: {
    webpackConfiguration?: ExecutionTransformer<webpack.Configuration>;
}): Observable<ServerBuilderOutput>;
declare const _default: import("@angular-devkit/architect/src/internal").Builder<json.JsonObject & BuildWebpackServerOptions>;
export default _default;
