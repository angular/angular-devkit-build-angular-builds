/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
export interface InlineCriticalCssProcessorOptions {
    minify?: boolean;
    deployUrl?: string;
    readAsset?: (path: string) => Promise<string>;
    autoCsp?: boolean;
    outputPath?: string;
}
export declare class InlineCriticalCssProcessor {
    protected readonly options: InlineCriticalCssProcessorOptions;
    constructor(options: InlineCriticalCssProcessorOptions);
    process(html: string): Promise<{
        content: string;
        warnings: string[];
        errors: string[];
    }>;
}
