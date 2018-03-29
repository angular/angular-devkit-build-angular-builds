/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuildEvent, Builder, BuilderConfiguration, BuilderContext } from '@angular-devkit/architect';
import { Path } from '@angular-devkit/core';
import { Observable } from 'rxjs/Observable';
import { BuildWebpackServerSchema } from './schema';
export declare class ServerBuilder implements Builder<BuildWebpackServerSchema> {
    context: BuilderContext;
    constructor(context: BuilderContext);
    run(builderConfig: BuilderConfiguration<BuildWebpackServerSchema>): Observable<BuildEvent>;
    buildWebpackConfig(root: Path, projectRoot: Path, options: BuildWebpackServerSchema): any;
    private _deleteOutputDir(root, outputPath);
}
export default ServerBuilder;
