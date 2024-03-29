/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <reference path="../../../../../../../../../../packages/angular_devkit/build_angular/src/babel-bazel.d.ts" />
/// <reference types="@angular/compiler-cli/private/babel" />
import { PluginObj } from '@babel/core';
/**
 * Provides one or more keywords that if found within the content of a source file indicate
 * that this plugin should be used with a source file.
 *
 * @returns An a string iterable containing one or more keywords.
 */
export declare function getKeywords(): Iterable<string>;
/**
 * A babel plugin factory function for adjusting TypeScript emitted enums.
 *
 * @returns A babel plugin object instance.
 */
export default function (): PluginObj;
