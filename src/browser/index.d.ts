/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuildEvent, Builder, BuilderConfiguration, BuilderContext } from '@angular-devkit/architect';
import { Path } from '@angular-devkit/core';
import { Observable } from 'rxjs';
import * as ts from 'typescript';
import { Budget } from '../angular-cli-files/utilities/bundle-calculator';
export interface BrowserBuilderOptions {
    outputPath: string;
    index: string;
    main: string;
    tsConfig: string;
    aot: boolean;
    vendorChunk: boolean;
    commonChunk: boolean;
    verbose: boolean;
    progress: boolean;
    extractCss: boolean;
    watch: boolean;
    outputHashing: 'none' | 'all' | 'media' | 'bundles';
    deleteOutputPath: boolean;
    preserveSymlinks: boolean;
    extractLicenses: boolean;
    showCircularDependencies: boolean;
    buildOptimizer: boolean;
    namedChunks: boolean;
    subresourceIntegrity: boolean;
    serviceWorker: boolean;
    skipAppShell: boolean;
    forkTypeChecker: boolean;
    statsJson: boolean;
    lazyModules: string[];
    budgets: Budget[];
    polyfills?: string;
    baseHref?: string;
    deployUrl?: string;
    i18nFile?: string;
    i18nFormat?: string;
    i18nOutFile?: string;
    i18nOutFormat?: string;
    poll?: number;
    sourceMap: boolean;
    evalSourceMap: boolean;
    optimization: boolean;
    i18nLocale?: string;
    i18nMissingTranslation?: string;
    assets: AssetPattern[];
    scripts: ExtraEntryPoint[];
    styles: ExtraEntryPoint[];
    stylePreprocessorOptions: {
        includePaths: string[];
    };
    fileReplacements: {
        src: string;
        replaceWith: string;
    }[];
}
export interface AssetPattern {
    glob: string;
    input: string;
    output: string;
}
export interface ExtraEntryPoint {
    input: string;
    bundleName: string;
    lazy: boolean;
}
export interface WebpackConfigOptions {
    root: string;
    projectRoot: string;
    buildOptions: BrowserBuilderOptions;
    tsConfig: ts.ParsedCommandLine;
    tsConfigPath: string;
    supportES2015: boolean;
}
export declare class BrowserBuilder implements Builder<BrowserBuilderOptions> {
    context: BuilderContext;
    constructor(context: BuilderContext);
    run(builderConfig: BuilderConfiguration<BrowserBuilderOptions>): Observable<BuildEvent>;
    buildWebpackConfig(root: Path, projectRoot: Path, options: BrowserBuilderOptions): any;
    private _deleteOutputDir(root, outputPath, host);
}
export default BrowserBuilder;
