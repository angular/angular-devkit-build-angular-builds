/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuildEvent, Builder, BuilderConfiguration, BuilderContext } from '@angular-devkit/architect';
import { Observable } from 'rxjs';
import { CurrentFileReplacement } from '../browser/schema';
import { KarmaBuilderSchema } from './schema';
export interface KarmaBuilderOptions extends KarmaBuilderSchema {
    fileReplacements: CurrentFileReplacement[];
}
export declare class KarmaBuilder implements Builder<KarmaBuilderOptions> {
    context: BuilderContext;
    constructor(context: BuilderContext);
    run(builderConfig: BuilderConfiguration<KarmaBuilderOptions>): Observable<BuildEvent>;
    private _buildWebpackConfig(root, projectRoot, host, options);
}
export default KarmaBuilder;
