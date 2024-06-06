/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import { DevServerBuilderOutput } from '@angular/build';
import { execute } from './builder';
import { Schema as DevServerBuilderOptions } from './schema';
export { DevServerBuilderOptions, DevServerBuilderOutput, execute as executeDevServerBuilder };
declare const _default: import("../../../../architect/src/internal").Builder<DevServerBuilderOptions & import("../../../../core/src").JsonObject>;
export default _default;
export { execute as executeDevServer };
