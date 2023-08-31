/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuilderContext } from '@angular-devkit/architect';
import { BrowserBuilderOptions } from '@angular-devkit/build-angular';
import { json } from '@angular-devkit/core';
import { Schema } from './schema';
type PrerenderBuilderOptions = Schema & json.JsonObject;
/**
 * Returns the union of routes, the contents of routesFile if given,
 * and the static routes extracted if guessRoutes is set to true.
 */
export declare function getRoutes(options: PrerenderBuilderOptions, tsConfigPath: string | undefined, context: BuilderContext): Promise<string[]>;
/**
 * Returns the name of the index file outputted by the browser builder.
 */
export declare function getIndexOutputFile(options: BrowserBuilderOptions): string;
export {};
