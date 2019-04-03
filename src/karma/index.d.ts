/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuilderContext, BuilderOutput } from '@angular-devkit/architect/src/index2';
import { Observable } from 'rxjs';
import { Schema as KarmaBuilderOptions } from './schema';
export declare function runKarma(options: KarmaBuilderOptions, context: BuilderContext): Observable<BuilderOutput>;
declare const _default: import("@angular-devkit/architect/src/internal").Builder<Record<string, string> & KarmaBuilderOptions>;
export default _default;
