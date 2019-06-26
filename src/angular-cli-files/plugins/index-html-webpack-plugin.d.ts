import { Compiler } from 'webpack';
import { IndexHtmlTransform } from '../utilities/index-file/write-index-html';
export interface IndexHtmlWebpackPluginOptions {
    input: string;
    output: string;
    baseHref?: string;
    entrypoints: string[];
    deployUrl?: string;
    sri: boolean;
    noModuleEntrypoints: string[];
    moduleEntrypoints: string[];
    postTransform?: IndexHtmlTransform;
}
export declare class IndexHtmlWebpackPlugin {
    private _options;
    constructor(options?: Partial<IndexHtmlWebpackPluginOptions>);
    apply(compiler: Compiler): void;
}
