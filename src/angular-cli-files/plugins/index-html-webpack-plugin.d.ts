export interface IndexHtmlWebpackPluginOptions {
    input: string;
    output: string;
    baseHref?: string;
    entrypoints: string[];
    deployUrl?: string;
}
export declare class IndexHtmlWebpackPlugin {
    private _options;
    constructor(options?: Partial<IndexHtmlWebpackPluginOptions>);
    apply(compiler: any): void;
}
