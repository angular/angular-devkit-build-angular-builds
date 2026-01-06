/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import type { BuilderContext, BuilderOutput } from '@angular-devkit/architect';
import type { ConfigOptions } from 'karma';
import { Configuration } from 'webpack';
import type { ExecutionTransformer } from '../../transforms';
import type { Schema as KarmaBuilderOptions } from './schema';
export type KarmaConfigOptions = ConfigOptions & {
    buildWebpack?: unknown;
    configFile?: string;
};
export declare function execute(options: KarmaBuilderOptions, context: BuilderContext, karmaOptions: KarmaConfigOptions, transforms?: {
    webpackConfiguration?: ExecutionTransformer<Configuration>;
    karmaOptions?: (options: KarmaConfigOptions) => KarmaConfigOptions;
}): AsyncIterable<BuilderOutput>;
