/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { OnLoadResult, Plugin, PluginBuild } from 'esbuild';
import { LoadResultCache } from '../load-result-cache';
/**
 * An object containing the plugin options to use when processing stylesheets.
 */
export interface StylesheetPluginOptions {
    /**
     * Controls the use and creation of sourcemaps when processing the stylesheets.
     * If true, sourcemap processing is enabled; if false, disabled.
     */
    sourcemap: boolean;
    includePaths?: string[];
    /**
     * Optional component data for any inline styles from Component decorator `styles` fields.
     * The key is an internal angular resource URI and the value is the stylesheet content.
     */
    inlineComponentData?: Record<string, string>;
    /**
     * The browsers to support in browserslist format when processing stylesheets.
     * Some postcss plugins such as autoprefixer require the raw browserslist information instead
     * of the esbuild formatted target.
     */
    browsers: string[];
    tailwindConfiguration?: {
        file: string;
        package: string;
    };
}
export interface StylesheetLanguage {
    name: string;
    componentFilter: RegExp;
    fileFilter: RegExp;
    process?(data: string, file: string, format: string, options: StylesheetPluginOptions, build: PluginBuild): OnLoadResult | Promise<OnLoadResult>;
}
export declare class StylesheetPluginFactory {
    private readonly options;
    private readonly cache?;
    private autoprefixer;
    constructor(options: StylesheetPluginOptions, cache?: LoadResultCache | undefined);
    create(language: Readonly<StylesheetLanguage>): Plugin;
}
