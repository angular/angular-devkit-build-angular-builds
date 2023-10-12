/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { BuildOptions } from 'esbuild';
import { LoadResultCache } from '../load-result-cache';
export interface BundleStylesheetOptions {
    workspaceRoot: string;
    optimization: boolean;
    preserveSymlinks?: boolean;
    sourcemap: boolean | 'external' | 'inline';
    outputNames: {
        bundles: string;
        media: string;
    };
    includePaths?: string[];
    externalDependencies?: string[];
    target: string[];
    tailwindConfiguration?: {
        file: string;
        package: string;
    };
    publicPath?: string;
}
export declare function createStylesheetBundleOptions(options: BundleStylesheetOptions, cache?: LoadResultCache, inlineComponentData?: Record<string, string>): BuildOptions & {
    plugins: NonNullable<BuildOptions['plugins']>;
};
