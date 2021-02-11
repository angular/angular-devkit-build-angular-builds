import { Budget } from '../browser/schema';
import { ProcessBundleResult } from '../utils/process-bundle';
import { JsonCompilationStats } from '../webpack/utils/stats';
interface Threshold {
    limit: number;
    type: ThresholdType;
    severity: ThresholdSeverity;
}
declare enum ThresholdType {
    Max = "maximum",
    Min = "minimum"
}
export declare enum ThresholdSeverity {
    Warning = "warning",
    Error = "error"
}
export declare function calculateThresholds(budget: Budget): IterableIterator<Threshold>;
export declare function checkBudgets(budgets: Budget[], webpackStats: JsonCompilationStats, processResults: ProcessBundleResult[]): IterableIterator<{
    severity: ThresholdSeverity;
    message: string;
}>;
export declare function checkThresholds(thresholds: IterableIterator<Threshold>, size: number, label?: string): IterableIterator<{
    severity: ThresholdSeverity;
    message: string;
}>;
export {};
