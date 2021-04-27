export interface InlineCriticalCssProcessOptions {
    outputPath: string;
}
export interface InlineCriticalCssProcessorOptions {
    minify?: boolean;
    deployUrl?: string;
    readAsset?: (path: string) => Promise<string>;
}
export declare class InlineCriticalCssProcessor {
    protected readonly options: InlineCriticalCssProcessorOptions;
    constructor(options: InlineCriticalCssProcessorOptions);
    process(html: string, options: InlineCriticalCssProcessOptions): Promise<{
        content: string;
        warnings: string[];
        errors: string[];
    }>;
}
