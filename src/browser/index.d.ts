/// <reference types="node" />
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuildEvent, Builder, BuilderConfiguration, BuilderContext } from '@angular-devkit/architect';
import { Path, virtualFs } from '@angular-devkit/core';
import * as fs from 'fs';
import { Observable } from 'rxjs';
import * as ts from 'typescript';
import { BrowserBuilderSchema } from './schema';
export interface WebpackConfigOptions {
    root: string;
    projectRoot: string;
    buildOptions: BrowserBuilderSchema;
    tsConfig: ts.ParsedCommandLine;
    tsConfigPath: string;
    supportES2015: boolean;
}
export declare class BrowserBuilder implements Builder<BrowserBuilderSchema> {
    context: BuilderContext;
    constructor(context: BuilderContext);
    run(builderConfig: BuilderConfiguration<BrowserBuilderSchema>): Observable<BuildEvent>;
    buildWebpackConfig(root: Path, projectRoot: Path, host: virtualFs.Host<fs.Stats>, options: BrowserBuilderSchema): any;
    private _deleteOutputDir(root, outputPath, host);
}
export default BrowserBuilder;
