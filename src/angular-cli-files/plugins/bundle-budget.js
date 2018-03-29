"use strict";
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const bundle_calculator_1 = require("../utilities/bundle-calculator");
const stats_1 = require("../utilities/stats");
class BundleBudgetPlugin {
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        const { budgets } = this.options;
        compiler.hooks.afterEmit.tap('BundleBudgetPlugin', (compilation) => {
            if (!budgets || budgets.length === 0) {
                return;
            }
            budgets.map(budget => {
                const thresholds = this.calculate(budget);
                return {
                    budget,
                    thresholds,
                    sizes: bundle_calculator_1.calculateSizes(budget, compilation)
                };
            })
                .forEach(budgetCheck => {
                budgetCheck.sizes.forEach(size => {
                    this.checkMaximum(budgetCheck.thresholds.maximumWarning, size, compilation.warnings);
                    this.checkMaximum(budgetCheck.thresholds.maximumError, size, compilation.errors);
                    this.checkMinimum(budgetCheck.thresholds.minimumWarning, size, compilation.warnings);
                    this.checkMinimum(budgetCheck.thresholds.minimumError, size, compilation.errors);
                    this.checkMinimum(budgetCheck.thresholds.warningLow, size, compilation.warnings);
                    this.checkMaximum(budgetCheck.thresholds.warningHigh, size, compilation.warnings);
                    this.checkMinimum(budgetCheck.thresholds.errorLow, size, compilation.errors);
                    this.checkMaximum(budgetCheck.thresholds.errorHigh, size, compilation.errors);
                });
            });
        });
    }
    checkMinimum(threshold, size, messages) {
        if (threshold) {
            if (threshold > size.size) {
                const sizeDifference = stats_1.formatSize(threshold - size.size);
                messages.push(`budgets, minimum exceeded for ${size.label}. `
                    + `Budget ${stats_1.formatSize(threshold)} was not reached by ${sizeDifference}.`);
            }
        }
    }
    checkMaximum(threshold, size, messages) {
        if (threshold) {
            if (threshold < size.size) {
                const sizeDifference = stats_1.formatSize(size.size - threshold);
                messages.push(`budgets, maximum exceeded for ${size.label}. `
                    + `Budget ${stats_1.formatSize(threshold)} was exceeded by ${sizeDifference}.`);
            }
        }
    }
    calculate(budget) {
        let thresholds = {};
        if (budget.maximumWarning) {
            thresholds.maximumWarning = bundle_calculator_1.calculateBytes(budget.maximumWarning, budget.baseline, 'pos');
        }
        if (budget.maximumError) {
            thresholds.maximumError = bundle_calculator_1.calculateBytes(budget.maximumError, budget.baseline, 'pos');
        }
        if (budget.minimumWarning) {
            thresholds.minimumWarning = bundle_calculator_1.calculateBytes(budget.minimumWarning, budget.baseline, 'neg');
        }
        if (budget.minimumError) {
            thresholds.minimumError = bundle_calculator_1.calculateBytes(budget.minimumError, budget.baseline, 'neg');
        }
        if (budget.warning) {
            thresholds.warningLow = bundle_calculator_1.calculateBytes(budget.warning, budget.baseline, 'neg');
        }
        if (budget.warning) {
            thresholds.warningHigh = bundle_calculator_1.calculateBytes(budget.warning, budget.baseline, 'pos');
        }
        if (budget.error) {
            thresholds.errorLow = bundle_calculator_1.calculateBytes(budget.error, budget.baseline, 'neg');
        }
        if (budget.error) {
            thresholds.errorHigh = bundle_calculator_1.calculateBytes(budget.error, budget.baseline, 'pos');
        }
        return thresholds;
    }
}
exports.BundleBudgetPlugin = BundleBudgetPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLWJ1ZGdldC5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvcGx1Z2lucy9idW5kbGUtYnVkZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBaUI7QUFDakIsK0RBQStEOztBQUUvRDs7Ozs7O0dBTUc7QUFFSCxzRUFBOEY7QUFDOUYsOENBQWdEO0FBaUJoRDtJQUNFLFlBQW9CLE9BQWtDO1FBQWxDLFlBQU8sR0FBUCxPQUFPLENBQTJCO0lBQUksQ0FBQztJQUUzRCxLQUFLLENBQUMsUUFBYTtRQUNqQixNQUFNLEVBQUUsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUNqQyxRQUFRLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsb0JBQW9CLEVBQUUsQ0FBQyxXQUFnQixFQUFFLEVBQUU7WUFDdEUsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNyQyxNQUFNLENBQUM7WUFDVCxDQUFDO1lBRUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDbkIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDMUMsTUFBTSxDQUFDO29CQUNMLE1BQU07b0JBQ04sVUFBVTtvQkFDVixLQUFLLEVBQUUsa0NBQWMsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDO2lCQUMzQyxDQUFDO1lBQ0osQ0FBQyxDQUFDO2lCQUNDLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDckIsV0FBVyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQy9CLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FB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QUUsTUFBTSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUM5RSxDQUFDO1FBRUQsTUFBTSxDQUFDLFVBQVUsQ0FBQztJQUNwQixDQUFDO0NBQ0Y7QUExRkQsZ0RBMEZDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG4vKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEJ1ZGdldCwgU2l6ZSwgY2FsY3VsYXRlQnl0ZXMsIGNhbGN1bGF0ZVNpemVzIH0gZnJvbSAnLi4vdXRpbGl0aWVzL2J1bmRsZS1jYWxjdWxhdG9yJztcbmltcG9ydCB7IGZvcm1hdFNpemUgfSBmcm9tICcuLi91dGlsaXRpZXMvc3RhdHMnO1xuXG5pbnRlcmZhY2UgVGhyZXNob2xkcyB7XG4gIG1heGltdW1XYXJuaW5nPzogbnVtYmVyO1xuICBtYXhpbXVtRXJyb3I/OiBudW1iZXI7XG4gIG1pbmltdW1XYXJuaW5nPzogbnVtYmVyO1xuICBtaW5pbXVtRXJyb3I/OiBudW1iZXI7XG4gIHdhcm5pbmdMb3c/OiBudW1iZXI7XG4gIHdhcm5pbmdIaWdoPzogbnVtYmVyO1xuICBlcnJvckxvdz86IG51bWJlcjtcbiAgZXJyb3JIaWdoPzogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1bmRsZUJ1ZGdldFBsdWdpbk9wdGlvbnMge1xuICBidWRnZXRzOiBCdWRnZXRbXTtcbn1cblxuZXhwb3J0IGNsYXNzIEJ1bmRsZUJ1ZGdldFBsdWdpbiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgb3B0aW9uczogQnVuZGxlQnVkZ2V0UGx1Z2luT3B0aW9ucykgeyB9XG5cbiAgYXBwbHkoY29tcGlsZXI6IGFueSk6IHZvaWQge1xuICAgIGNvbnN0IHsgYnVkZ2V0cyB9ID0gdGhpcy5vcHRpb25zO1xuICAgIGNvbXBpbGVyLmhvb2tzLmFmdGVyRW1pdC50YXAoJ0J1bmRsZUJ1ZGdldFBsdWdpbicsIChjb21waWxhdGlvbjogYW55KSA9PiB7XG4gICAgICBpZiAoIWJ1ZGdldHMgfHwgYnVkZ2V0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBidWRnZXRzLm1hcChidWRnZXQgPT4ge1xuICAgICAgICBjb25zdCB0aHJlc2hvbGRzID0gdGhpcy5jYWxjdWxhdGUoYnVkZ2V0KTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBidWRnZXQsXG4gICAgICAgICAgdGhyZXNob2xkcyxcbiAgICAgICAgICBzaXplczogY2FsY3VsYXRlU2l6ZXMoYnVkZ2V0LCBjb21waWxhdGlvbilcbiAgICAgICAgfTtcbiAgICAgIH0pXG4gICAgICAgIC5mb3JFYWNoKGJ1ZGdldENoZWNrID0+IHtcbiAgICAgICAgICBidWRnZXRDaGVjay5zaXplcy5mb3JFYWNoKHNpemUgPT4ge1xuICAgICAgICAgICAgdGhpcy5jaGVja01heGltdW0oYnVkZ2V0Q2hlY2sudGhyZXNob2xkcy5tYXhpbXVtV2FybmluZywgc2l6ZSwgY29tcGlsYXRpb24ud2FybmluZ3MpO1xuICAgICAgICAgICAgdGhpcy5jaGVja01heGltdW0oYnVkZ2V0Q2hlY2sudGhyZXNob2xkcy5tYXhpbXVtRXJyb3IsIHNpemUsIGNvbXBpbGF0aW9uLmVycm9ycyk7XG4gICAgICAgICAgICB0aGlzLmNoZWNrTWluaW11bShidWRnZXRDaGVjay50aHJlc2hvbGRzLm1pbmltdW1XYXJuaW5nLCBzaXplLCBjb21waWxhdGlvbi53YXJuaW5ncyk7XG4gICAgICAgICAgICB0aGlzLmNoZWNrTWluaW11bShidWRnZXRDaGVjay50aHJlc2hvbGRzLm1pbmltdW1FcnJvciwgc2l6ZSwgY29tcGlsYXRpb24uZXJyb3JzKTtcbiAgICAgICAgICAgIHRoaXMuY2hlY2tNaW5pbXVtKGJ1ZGdldENoZWNrLnRocmVzaG9sZHMud2FybmluZ0xvdywgc2l6ZSwgY29tcGlsYXRpb24ud2FybmluZ3MpO1xuICAgICAgICAgICAgdGhpcy5jaGVja01heGltdW0oYnVkZ2V0Q2hlY2sudGhyZXNob2xkcy53YXJuaW5nSGlnaCwgc2l6ZSwgY29tcGlsYXRpb24ud2FybmluZ3MpO1xuICAgICAgICAgICAgdGhpcy5jaGVja01pbmltdW0oYnVkZ2V0Q2hlY2sudGhyZXNob2xkcy5lcnJvckxvdywgc2l6ZSwgY29tcGlsYXRpb24uZXJyb3JzKTtcbiAgICAgICAgICAgIHRoaXMuY2hlY2tNYXhpbXVtKGJ1ZGdldENoZWNrLnRocmVzaG9sZHMuZXJyb3JIaWdoLCBzaXplLCBjb21waWxhdGlvbi5lcnJvcnMpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjaGVja01pbmltdW0odGhyZXNob2xkOiBudW1iZXIgfCB1bmRlZmluZWQsIHNpemU6IFNpemUsIG1lc3NhZ2VzOiBhbnkpIHtcbiAgICBpZiAodGhyZXNob2xkKSB7XG4gICAgICBpZiAodGhyZXNob2xkID4gc2l6ZS5zaXplKSB7XG4gICAgICAgIGNvbnN0IHNpemVEaWZmZXJlbmNlID0gZm9ybWF0U2l6ZSh0aHJlc2hvbGQgLSBzaXplLnNpemUpO1xuICAgICAgICBtZXNzYWdlcy5wdXNoKGBidWRnZXRzLCBtaW5pbXVtIGV4Y2VlZGVkIGZvciAke3NpemUubGFiZWx9LiBgXG4gICAgICAgICAgKyBgQnVkZ2V0ICR7Zm9ybWF0U2l6ZSh0aHJlc2hvbGQpfSB3YXMgbm90IHJlYWNoZWQgYnkgJHtzaXplRGlmZmVyZW5jZX0uYCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjaGVja01heGltdW0odGhyZXNob2xkOiBudW1iZXIgfCB1bmRlZmluZWQsIHNpemU6IFNpemUsIG1lc3NhZ2VzOiBhbnkpIHtcbiAgICBpZiAodGhyZXNob2xkKSB7XG4gICAgICBpZiAodGhyZXNob2xkIDwgc2l6ZS5zaXplKSB7XG4gICAgICAgIGNvbnN0IHNpemVEaWZmZXJlbmNlID0gZm9ybWF0U2l6ZShzaXplLnNpemUgLSB0aHJlc2hvbGQpO1xuICAgICAgICBtZXNzYWdlcy5wdXNoKGBidWRnZXRzLCBtYXhpbXVtIGV4Y2VlZGVkIGZvciAke3NpemUubGFiZWx9LiBgXG4gICAgICAgICAgKyBgQnVkZ2V0ICR7Zm9ybWF0U2l6ZSh0aHJlc2hvbGQpfSB3YXMgZXhjZWVkZWQgYnkgJHtzaXplRGlmZmVyZW5jZX0uYCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjYWxjdWxhdGUoYnVkZ2V0OiBCdWRnZXQpOiBUaHJlc2hvbGRzIHtcbiAgICBsZXQgdGhyZXNob2xkczogVGhyZXNob2xkcyA9IHt9O1xuICAgIGlmIChidWRnZXQubWF4aW11bVdhcm5pbmcpIHtcbiAgICAgIHRocmVzaG9sZHMubWF4aW11bVdhcm5pbmcgPSBjYWxjdWxhdGVCeXRlcyhidWRnZXQubWF4aW11bVdhcm5pbmcsIGJ1ZGdldC5iYXNlbGluZSwgJ3BvcycpO1xuICAgIH1cblxuICAgIGlmIChidWRnZXQubWF4aW11bUVycm9yKSB7XG4gICAgICB0aHJlc2hvbGRzLm1heGltdW1FcnJvciA9IGNhbGN1bGF0ZUJ5dGVzKGJ1ZGdldC5tYXhpbXVtRXJyb3IsIGJ1ZGdldC5iYXNlbGluZSwgJ3BvcycpO1xuICAgIH1cblxuICAgIGlmIChidWRnZXQubWluaW11bVdhcm5pbmcpIHtcbiAgICAgIHRocmVzaG9sZHMubWluaW11bVdhcm5pbmcgPSBjYWxjdWxhdGVCeXRlcyhidWRnZXQubWluaW11bVdhcm5pbmcsIGJ1ZGdldC5iYXNlbGluZSwgJ25lZycpO1xuICAgIH1cblxuICAgIGlmIChidWRnZXQubWluaW11bUVycm9yKSB7XG4gICAgICB0aHJlc2hvbGRzLm1pbmltdW1FcnJvciA9IGNhbGN1bGF0ZUJ5dGVzKGJ1ZGdldC5taW5pbXVtRXJyb3IsIGJ1ZGdldC5iYXNlbGluZSwgJ25lZycpO1xuICAgIH1cblxuICAgIGlmIChidWRnZXQud2FybmluZykge1xuICAgICAgdGhyZXNob2xkcy53YXJuaW5nTG93ID0gY2FsY3VsYXRlQnl0ZXMoYnVkZ2V0Lndhcm5pbmcsIGJ1ZGdldC5iYXNlbGluZSwgJ25lZycpO1xuICAgIH1cblxuICAgIGlmIChidWRnZXQud2FybmluZykge1xuICAgICAgdGhyZXNob2xkcy53YXJuaW5nSGlnaCA9IGNhbGN1bGF0ZUJ5dGVzKGJ1ZGdldC53YXJuaW5nLCBidWRnZXQuYmFzZWxpbmUsICdwb3MnKTtcbiAgICB9XG5cbiAgICBpZiAoYnVkZ2V0LmVycm9yKSB7XG4gICAgICB0aHJlc2hvbGRzLmVycm9yTG93ID0gY2FsY3VsYXRlQnl0ZXMoYnVkZ2V0LmVycm9yLCBidWRnZXQuYmFzZWxpbmUsICduZWcnKTtcbiAgICB9XG5cbiAgICBpZiAoYnVkZ2V0LmVycm9yKSB7XG4gICAgICB0aHJlc2hvbGRzLmVycm9ySGlnaCA9IGNhbGN1bGF0ZUJ5dGVzKGJ1ZGdldC5lcnJvciwgYnVkZ2V0LmJhc2VsaW5lLCAncG9zJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRocmVzaG9sZHM7XG4gIH1cbn1cbiJdfQ==