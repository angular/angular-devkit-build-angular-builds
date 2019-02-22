/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/// <reference types="node" />
import { BuildEvent, Builder, BuilderConfiguration, BuilderContext } from '@angular-devkit/architect';
import { Path, virtualFs } from '@angular-devkit/core';
import { Stats } from 'fs';
import { Observable } from 'rxjs';
import { NormalizedBrowserBuilderSchema } from '../utils';
import { Schema as DevServerBuilderSchema } from './schema';
export declare class DevServerBuilder implements Builder<DevServerBuilderSchema> {
    context: BuilderContext;
    constructor(context: BuilderContext);
    run(builderConfig: BuilderConfiguration<DevServerBuilderSchema>): Observable<BuildEvent>;
    buildWebpackConfig(root: Path, projectRoot: Path, host: virtualFs.Host<Stats>, browserOptions: NormalizedBrowserBuilderSchema): any;
    private _buildServerConfig;
    private _addLiveReload;
    private _addSslConfig;
    private _addProxyConfig;
    private _buildServePath;
    private _findDefaultServePath;
    private _getBrowserOptions;
}
export default DevServerBuilder;
