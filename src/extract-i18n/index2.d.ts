/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuilderContext } from '@angular-devkit/architect/src/index2';
import { JsonObject } from '@angular-devkit/core';
import { Schema as ExtractI18nBuilderOptions } from './schema';
export declare function execute(options: ExtractI18nBuilderOptions, context: BuilderContext): Promise<import("../../../build_webpack/src/webpack/index2").BuildResult>;
declare const _default: import("@angular-devkit/architect/src/internal").Builder<JsonObject & ExtractI18nBuilderOptions>;
export default _default;
