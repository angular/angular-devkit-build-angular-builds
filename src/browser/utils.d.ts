/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Path } from '@angular-devkit/core';
import * as ts from 'typescript';
export declare function isDifferentialLoadingNeeded(projectRoot: Path, target?: ts.ScriptTarget): boolean;
export declare function isEs5SupportNeeded(projectRoot: Path): boolean;
