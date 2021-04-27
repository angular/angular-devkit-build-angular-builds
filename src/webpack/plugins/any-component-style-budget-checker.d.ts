import { Compiler } from 'webpack';
import { Budget } from '../../browser/schema';
/**
 * Check budget sizes for component styles by emitting a warning or error if a
 * budget is exceeded by a particular component's styles.
 */
export declare class AnyComponentStyleBudgetChecker {
    private readonly budgets;
    constructor(budgets: Budget[]);
    apply(compiler: Compiler): void;
}
