export interface ProcessBundleOptions {
    filename: string;
    code: string;
    map?: string;
    sourceMaps?: boolean;
    hiddenSourceMaps?: boolean;
    vendorSourceMaps?: boolean;
    runtime?: boolean;
    optimize: boolean;
    optimizeOnly?: boolean;
    ignoreOriginal?: boolean;
    cacheKeys?: (string | null)[];
    cachePath?: string;
}
export declare const enum CacheKey {
    OriginalCode = 0,
    OriginalMap = 1,
    DownlevelCode = 2,
    DownlevelMap = 3
}
export declare function process(options: ProcessBundleOptions, callback: (error: Error | null, result?: {}) => void): void;
