/// <reference types="node" />
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuilderOutput } from '@angular-devkit/architect/src/index2';
import { Path, json, logging, virtualFs } from '@angular-devkit/core';
import { Stats } from 'fs';
import { NormalizedWebpackServerBuilderSchema } from '../utils';
import { Schema as BuildWebpackServerSchema } from './schema';
export declare type ServerBuilderOutput = json.JsonObject & BuilderOutput & {
    outputPath?: string;
};
declare const _default: import("@angular-devkit/architect/src/internal").Builder<json.JsonObject & BuildWebpackServerSchema>;
export default _default;
export declare function buildServerWebpackConfig(root: Path, projectRoot: Path, _host: virtualFs.Host<Stats>, options: NormalizedWebpackServerBuilderSchema, logger: logging.Logger): any;
