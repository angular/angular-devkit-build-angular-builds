export interface InlineFontsOptions {
    minify?: boolean;
    WOFFSupportNeeded: boolean;
}
export declare class InlineFontsProcessor {
    private options;
    constructor(options: InlineFontsOptions);
    process(content: string): Promise<string>;
    private getResponse;
    private processHrefs;
}
