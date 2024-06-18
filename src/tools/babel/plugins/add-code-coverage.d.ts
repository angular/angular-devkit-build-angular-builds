/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
/// <reference path="../../../../../../../../../../packages/angular_devkit/build_angular/src/babel-bazel.d.ts" />
/// <reference types="@angular/compiler-cli/private/babel" />
import { PluginObj } from '@babel/core';
/**
 * A babel plugin factory function for adding istanbul instrumentation.
 *
 * @returns A babel plugin object instance.
 */
export default function (): PluginObj;
