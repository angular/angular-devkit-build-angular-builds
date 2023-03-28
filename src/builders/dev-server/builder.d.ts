/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuilderContext } from '@angular-devkit/architect';
import { Observable } from 'rxjs';
import { ExecutionTransformer } from '../../transforms';
import { IndexHtmlTransform } from '../../utils/index-file/index-html-generator';
import { Schema as DevServerBuilderOptions } from './schema';
import { DevServerBuilderOutput } from './webpack-server';
/**
 * A Builder that executes a development server based on the provided browser target option.
 * @param options Dev Server options.
 * @param context The build context.
 * @param transforms A map of transforms that can be used to hook into some logic (such as
 * transforming webpack configuration before passing it to webpack).
 *
 * @experimental Direct usage of this function is considered experimental.
 */
export declare function execute(options: DevServerBuilderOptions, context: BuilderContext, transforms?: {
    webpackConfiguration?: ExecutionTransformer<import('webpack').Configuration>;
    logging?: import('@angular-devkit/build-webpack').WebpackLoggingCallback;
    indexHtml?: IndexHtmlTransform;
}): Observable<DevServerBuilderOutput>;
