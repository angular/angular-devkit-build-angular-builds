/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export * from './transforms';
export * from './app-shell';
export * from './browser';
export { AssetPattern, AssetPatternClass as AssetPatternObject, Budget, ExtraEntryPoint, ExtraEntryPointClass as ExtraEntryPointObject, FileReplacement, OptimizationClass as OptimizationObject, OptimizationUnion, OutputHashing, Schema as BrowserBuilderSchema, SourceMapClass as SourceMapObject, SourceMapUnion, StylePreprocessorOptions, Type, } from './browser/schema';
export * from './dev-server';
export * from './extract-i18n';
export * from './karma';
export * from './karma/schema';
export * from './protractor';
export { execute as executeServerBuilder } from './server';
export * from './tslint';
