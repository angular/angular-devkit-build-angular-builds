/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuilderContext, BuilderOutput } from '@angular-devkit/architect';
import { Observable } from 'rxjs';
import * as webpack from 'webpack';
import { Schema as KarmaBuilderOptions } from './schema';
declare type KarmaConfigOptions = import('karma').ConfigOptions & {
    buildWebpack?: unknown;
    configFile?: string;
};
declare type WebpackConfigurationTransformer = (configuration: webpack.Configuration) => webpack.Configuration;
export declare function execute(options: KarmaBuilderOptions, context: BuilderContext, transforms?: {
    webpackConfiguration?: WebpackConfigurationTransformer;
    karmaOptions?: (options: KarmaConfigOptions) => KarmaConfigOptions;
}): Observable<BuilderOutput>;
export { KarmaBuilderOptions };
declare const _default: import("@angular-devkit/architect/src/internal").Builder<Record<string, string> & KarmaBuilderOptions>;
export default _default;
