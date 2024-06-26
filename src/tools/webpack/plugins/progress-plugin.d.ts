/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import { ProgressPlugin as WebpackProgressPlugin } from 'webpack';
export declare class ProgressPlugin extends WebpackProgressPlugin {
    constructor(platform: 'server' | 'browser');
}
