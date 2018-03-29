/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuildEvent, Builder, BuilderConfiguration, BuilderContext } from '@angular-devkit/architect';
import { Observable } from 'rxjs/Observable';
import { AssetPattern, ExtraEntryPoint } from '../browser';
export interface KarmaBuilderOptions {
    main: string;
    tsConfig: string;
    karmaConfig: string;
    watch: boolean;
    codeCoverage: boolean;
    codeCoverageExclude: string[];
    progress: boolean;
    preserveSymlinks?: boolean;
    polyfills?: string;
    poll?: number;
    port?: number;
    browsers?: string;
    sourceMap: boolean;
    assets: AssetPattern[];
    scripts: ExtraEntryPoint[];
    styles: ExtraEntryPoint[];
    stylePreprocessorOptions: {
        includePaths: string[];
    };
    fileReplacements: {
        from: string;
        to: string;
    }[];
}
export declare class KarmaBuilder implements Builder<KarmaBuilderOptions> {
    context: BuilderContext;
    constructor(context: BuilderContext);
    run(builderConfig: BuilderConfiguration<KarmaBuilderOptions>): Observable<BuildEvent>;
    private _buildWebpackConfig(root, projectRoot, options);
}
export default KarmaBuilder;
