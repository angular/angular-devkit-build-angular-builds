"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
                    sizes: bundle_calculator_1.calculateSizes(budget, compilation),
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
        const thresholds = {};
        if (budget.maximumWarning) {
            thresholds.maximumWarning = bundle_calculator_1.calculateBytes(budget.maximumWarning, budget.baseline, 1);
        }
        if (budget.maximumError) {
            thresholds.maximumError = bundle_calculator_1.calculateBytes(budget.maximumError, budget.baseline, 1);
        }
        if (budget.minimumWarning) {
            thresholds.minimumWarning = bundle_calculator_1.calculateBytes(budget.minimumWarning, budget.baseline, -1);
        }
        if (budget.minimumError) {
            thresholds.minimumError = bundle_calculator_1.calculateBytes(budget.minimumError, budget.baseline, -1);
        }
        if (budget.warning) {
            thresholds.warningLow = bundle_calculator_1.calculateBytes(budget.warning, budget.baseline, -1);
        }
        if (budget.warning) {
            thresholds.warningHigh = bundle_calculator_1.calculateBytes(budget.warning, budget.baseline, 1);
        }
        if (budget.error) {
            thresholds.errorLow = bundle_calculator_1.calculateBytes(budget.error, budget.baseline, -1);
        }
        if (budget.error) {
            thresholds.errorHigh = bundle_calculator_1.calculateBytes(budget.error, budget.baseline, 1);
        }
        return thresholds;
    }
}
exports.BundleBudgetPlugin = BundleBudgetPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLWJ1ZGdldC5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvcGx1Z2lucy9idW5kbGUtYnVkZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBU0Esc0VBQXNGO0FBQ3RGLDhDQUFnRDtBQWlCaEQ7SUFDRSxZQUFvQixPQUFrQztRQUFsQyxZQUFPLEdBQVAsT0FBTyxDQUEyQjtJQUFJLENBQUM7SUFFM0QsS0FBSyxDQUFDLFFBQWtCO1FBQ3RCLE1BQU0sRUFBRSxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO1FBQ2pDLFFBQVEsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDLFdBQW9DLEVBQUUsRUFBRTtZQUMxRixJQUFJLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO2dCQUNwQyxPQUFPO2FBQ1I7WUFFRCxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUNuQixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUUxQyxPQUFPO29CQUNMLE1BQU07b0JBQ04sVUFBVTtvQkFDVixLQUFLLEVBQUUsa0NBQWMsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDO2lCQUMzQyxDQUFDO1lBQ0osQ0FBQyxDQUFDO2lCQUNDLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDckIsV0FBVyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQy9CLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxjQUFjLEVBQUUsSUFBSSxFQUFFLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFDckYsSUFBSSxDQUFDLFlBQVksQ0FBQyxX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QWMsQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNwRjtRQUVELElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRTtZQUNsQixVQUFVLENBQUMsVUFBVSxHQUFHLGtDQUFjLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDN0U7UUFFRCxJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUU7WUFDbEIsVUFBVSxDQUFDLFdBQVcsR0FBRyxrQ0FBYyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQztTQUM3RTtRQUVELElBQUksTUFBTSxDQUFDLEtBQUssRUFBRTtZQUNoQixVQUFVLENBQUMsUUFBUSxHQUFHLGtDQUFjLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDekU7UUFFRCxJQUFJLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDaEIsVUFBVSxDQUFDLFNBQVMsR0FBRyxrQ0FBYyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQztTQUN6RTtRQUVELE9BQU8sVUFBVSxDQUFDO0lBQ3BCLENBQUM7Q0FDRjtBQTNGRCxnREEyRkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgeyBDb21waWxlciwgY29tcGlsYXRpb24gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IEJ1ZGdldCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IFNpemUsIGNhbGN1bGF0ZUJ5dGVzLCBjYWxjdWxhdGVTaXplcyB9IGZyb20gJy4uL3V0aWxpdGllcy9idW5kbGUtY2FsY3VsYXRvcic7XG5pbXBvcnQgeyBmb3JtYXRTaXplIH0gZnJvbSAnLi4vdXRpbGl0aWVzL3N0YXRzJztcblxuaW50ZXJmYWNlIFRocmVzaG9sZHMge1xuICBtYXhpbXVtV2FybmluZz86IG51bWJlcjtcbiAgbWF4aW11bUVycm9yPzogbnVtYmVyO1xuICBtaW5pbXVtV2FybmluZz86IG51bWJlcjtcbiAgbWluaW11bUVycm9yPzogbnVtYmVyO1xuICB3YXJuaW5nTG93PzogbnVtYmVyO1xuICB3YXJuaW5nSGlnaD86IG51bWJlcjtcbiAgZXJyb3JMb3c/OiBudW1iZXI7XG4gIGVycm9ySGlnaD86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCdW5kbGVCdWRnZXRQbHVnaW5PcHRpb25zIHtcbiAgYnVkZ2V0czogQnVkZ2V0W107XG59XG5cbmV4cG9ydCBjbGFzcyBCdW5kbGVCdWRnZXRQbHVnaW4ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIG9wdGlvbnM6IEJ1bmRsZUJ1ZGdldFBsdWdpbk9wdGlvbnMpIHsgfVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcik6IHZvaWQge1xuICAgIGNvbnN0IHsgYnVkZ2V0cyB9ID0gdGhpcy5vcHRpb25zO1xuICAgIGNvbXBpbGVyLmhvb2tzLmFmdGVyRW1pdC50YXAoJ0J1bmRsZUJ1ZGdldFBsdWdpbicsIChjb21waWxhdGlvbjogY29tcGlsYXRpb24uQ29tcGlsYXRpb24pID0+IHtcbiAgICAgIGlmICghYnVkZ2V0cyB8fCBidWRnZXRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGJ1ZGdldHMubWFwKGJ1ZGdldCA9PiB7XG4gICAgICAgIGNvbnN0IHRocmVzaG9sZHMgPSB0aGlzLmNhbGN1bGF0ZShidWRnZXQpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgYnVkZ2V0LFxuICAgICAgICAgIHRocmVzaG9sZHMsXG4gICAgICAgICAgc2l6ZXM6IGNhbGN1bGF0ZVNpemVzKGJ1ZGdldCwgY29tcGlsYXRpb24pLFxuICAgICAgICB9O1xuICAgICAgfSlcbiAgICAgICAgLmZvckVhY2goYnVkZ2V0Q2hlY2sgPT4ge1xuICAgICAgICAgIGJ1ZGdldENoZWNrLnNpemVzLmZvckVhY2goc2l6ZSA9PiB7XG4gICAgICAgICAgICB0aGlzLmNoZWNrTWF4aW11bShidWRnZXRDaGVjay50aHJlc2hvbGRzLm1heGltdW1XYXJuaW5nLCBzaXplLCBjb21waWxhdGlvbi53YXJuaW5ncyk7XG4gICAgICAgICAgICB0aGlzLmNoZWNrTWF4aW11bShidWRnZXRDaGVjay50aHJlc2hvbGRzLm1heGltdW1FcnJvciwgc2l6ZSwgY29tcGlsYXRpb24uZXJyb3JzKTtcbiAgICAgICAgICAgIHRoaXMuY2hlY2tNaW5pbXVtKGJ1ZGdldENoZWNrLnRocmVzaG9sZHMubWluaW11bVdhcm5pbmcsIHNpemUsIGNvbXBpbGF0aW9uLndhcm5pbmdzKTtcbiAgICAgICAgICAgIHRoaXMuY2hlY2tNaW5pbXVtKGJ1ZGdldENoZWNrLnRocmVzaG9sZHMubWluaW11bUVycm9yLCBzaXplLCBjb21waWxhdGlvbi5lcnJvcnMpO1xuICAgICAgICAgICAgdGhpcy5jaGVja01pbmltdW0oYnVkZ2V0Q2hlY2sudGhyZXNob2xkcy53YXJuaW5nTG93LCBzaXplLCBjb21waWxhdGlvbi53YXJuaW5ncyk7XG4gICAgICAgICAgICB0aGlzLmNoZWNrTWF4aW11bShidWRnZXRDaGVjay50aHJlc2hvbGRzLndhcm5pbmdIaWdoLCBzaXplLCBjb21waWxhdGlvbi53YXJuaW5ncyk7XG4gICAgICAgICAgICB0aGlzLmNoZWNrTWluaW11bShidWRnZXRDaGVjay50aHJlc2hvbGRzLmVycm9yTG93LCBzaXplLCBjb21waWxhdGlvbi5lcnJvcnMpO1xuICAgICAgICAgICAgdGhpcy5jaGVja01heGltdW0oYnVkZ2V0Q2hlY2sudGhyZXNob2xkcy5lcnJvckhpZ2gsIHNpemUsIGNvbXBpbGF0aW9uLmVycm9ycyk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNoZWNrTWluaW11bSh0aHJlc2hvbGQ6IG51bWJlciB8IHVuZGVmaW5lZCwgc2l6ZTogU2l6ZSwgbWVzc2FnZXM6IHN0cmluZ1tdKSB7XG4gICAgaWYgKHRocmVzaG9sZCkge1xuICAgICAgaWYgKHRocmVzaG9sZCA+IHNpemUuc2l6ZSkge1xuICAgICAgICBjb25zdCBzaXplRGlmZmVyZW5jZSA9IGZvcm1hdFNpemUodGhyZXNob2xkIC0gc2l6ZS5zaXplKTtcbiAgICAgICAgbWVzc2FnZXMucHVzaChgYnVkZ2V0cywgbWluaW11bSBleGNlZWRlZCBmb3IgJHtzaXplLmxhYmVsfS4gYFxuICAgICAgICAgICsgYEJ1ZGdldCAke2Zvcm1hdFNpemUodGhyZXNob2xkKX0gd2FzIG5vdCByZWFjaGVkIGJ5ICR7c2l6ZURpZmZlcmVuY2V9LmApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tNYXhpbXVtKHRocmVzaG9sZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBzaXplOiBTaXplLCBtZXNzYWdlczogc3RyaW5nW10pIHtcbiAgICBpZiAodGhyZXNob2xkKSB7XG4gICAgICBpZiAodGhyZXNob2xkIDwgc2l6ZS5zaXplKSB7XG4gICAgICAgIGNvbnN0IHNpemVEaWZmZXJlbmNlID0gZm9ybWF0U2l6ZShzaXplLnNpemUgLSB0aHJlc2hvbGQpO1xuICAgICAgICBtZXNzYWdlcy5wdXNoKGBidWRnZXRzLCBtYXhpbXVtIGV4Y2VlZGVkIGZvciAke3NpemUubGFiZWx9LiBgXG4gICAgICAgICAgKyBgQnVkZ2V0ICR7Zm9ybWF0U2l6ZSh0aHJlc2hvbGQpfSB3YXMgZXhjZWVkZWQgYnkgJHtzaXplRGlmZmVyZW5jZX0uYCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjYWxjdWxhdGUoYnVkZ2V0OiBCdWRnZXQpOiBUaHJlc2hvbGRzIHtcbiAgICBjb25zdCB0aHJlc2hvbGRzOiBUaHJlc2hvbGRzID0ge307XG4gICAgaWYgKGJ1ZGdldC5tYXhpbXVtV2FybmluZykge1xuICAgICAgdGhyZXNob2xkcy5tYXhpbXVtV2FybmluZyA9IGNhbGN1bGF0ZUJ5dGVzKGJ1ZGdldC5tYXhpbXVtV2FybmluZywgYnVkZ2V0LmJhc2VsaW5lLCAxKTtcbiAgICB9XG5cbiAgICBpZiAoYnVkZ2V0Lm1heGltdW1FcnJvcikge1xuICAgICAgdGhyZXNob2xkcy5tYXhpbXVtRXJyb3IgPSBjYWxjdWxhdGVCeXRlcyhidWRnZXQubWF4aW11bUVycm9yLCBidWRnZXQuYmFzZWxpbmUsIDEpO1xuICAgIH1cblxuICAgIGlmIChidWRnZXQubWluaW11bVdhcm5pbmcpIHtcbiAgICAgIHRocmVzaG9sZHMubWluaW11bVdhcm5pbmcgPSBjYWxjdWxhdGVCeXRlcyhidWRnZXQubWluaW11bVdhcm5pbmcsIGJ1ZGdldC5iYXNlbGluZSwgLTEpO1xuICAgIH1cblxuICAgIGlmIChidWRnZXQubWluaW11bUVycm9yKSB7XG4gICAgICB0aHJlc2hvbGRzLm1pbmltdW1FcnJvciA9IGNhbGN1bGF0ZUJ5dGVzKGJ1ZGdldC5taW5pbXVtRXJyb3IsIGJ1ZGdldC5iYXNlbGluZSwgLTEpO1xuICAgIH1cblxuICAgIGlmIChidWRnZXQud2FybmluZykge1xuICAgICAgdGhyZXNob2xkcy53YXJuaW5nTG93ID0gY2FsY3VsYXRlQnl0ZXMoYnVkZ2V0Lndhcm5pbmcsIGJ1ZGdldC5iYXNlbGluZSwgLTEpO1xuICAgIH1cblxuICAgIGlmIChidWRnZXQud2FybmluZykge1xuICAgICAgdGhyZXNob2xkcy53YXJuaW5nSGlnaCA9IGNhbGN1bGF0ZUJ5dGVzKGJ1ZGdldC53YXJuaW5nLCBidWRnZXQuYmFzZWxpbmUsIDEpO1xuICAgIH1cblxuICAgIGlmIChidWRnZXQuZXJyb3IpIHtcbiAgICAgIHRocmVzaG9sZHMuZXJyb3JMb3cgPSBjYWxjdWxhdGVCeXRlcyhidWRnZXQuZXJyb3IsIGJ1ZGdldC5iYXNlbGluZSwgLTEpO1xuICAgIH1cblxuICAgIGlmIChidWRnZXQuZXJyb3IpIHtcbiAgICAgIHRocmVzaG9sZHMuZXJyb3JIaWdoID0gY2FsY3VsYXRlQnl0ZXMoYnVkZ2V0LmVycm9yLCBidWRnZXQuYmFzZWxpbmUsIDEpO1xuICAgIH1cblxuICAgIHJldHVybiB0aHJlc2hvbGRzO1xuICB9XG59XG4iXX0=