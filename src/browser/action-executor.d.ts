import { InlineOptions, ProcessBundleOptions, ProcessBundleResult } from '../utils/process-bundle';
export declare class BundleActionExecutor {
    private workerOptions;
    private readonly sizeThreshold;
    private largeWorker?;
    private smallWorker?;
    private cache;
    constructor(workerOptions: unknown, integrityAlgorithm?: string, sizeThreshold?: number);
    private static executeMethod;
    private ensureLarge;
    private ensureSmall;
    private executeAction;
    process(action: ProcessBundleOptions): Promise<ProcessBundleResult>;
    processAll(actions: Iterable<ProcessBundleOptions>): AsyncIterable<ProcessBundleResult>;
    inline(action: InlineOptions): Promise<{
        file: string;
        diagnostics: {
            type: string;
            message: string;
        }[];
        count: number;
    }>;
    inlineAll(actions: Iterable<InlineOptions>): AsyncIterable<{
        file: string;
        diagnostics: {
            type: string;
            message: string;
        }[];
        count: number;
    }>;
    private static executeAll;
    stop(): void;
}
