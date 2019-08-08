interface ProcessBundleOptions {
    filename: string;
    code: string;
    map?: string;
    sourceMaps: boolean;
    hiddenSourceMaps: boolean;
    runtime: boolean;
    optimize: boolean;
    optimizeOnly?: boolean;
}
export declare function process(options: ProcessBundleOptions, callback: (error: Error | null, result?: {}) => void): void;
export {};
