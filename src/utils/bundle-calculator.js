"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkThresholds = exports.checkBudgets = exports.calculateThresholds = exports.ThresholdSeverity = void 0;
const schema_1 = require("../builders/browser/schema");
const stats_1 = require("../tools/webpack/utils/stats");
var ThresholdType;
(function (ThresholdType) {
    ThresholdType["Max"] = "maximum";
    ThresholdType["Min"] = "minimum";
})(ThresholdType || (ThresholdType = {}));
var ThresholdSeverity;
(function (ThresholdSeverity) {
    ThresholdSeverity["Warning"] = "warning";
    ThresholdSeverity["Error"] = "error";
})(ThresholdSeverity || (exports.ThresholdSeverity = ThresholdSeverity = {}));
function* calculateThresholds(budget) {
    if (budget.maximumWarning) {
        yield {
            limit: calculateBytes(budget.maximumWarning, budget.baseline, 1),
            type: ThresholdType.Max,
            severity: ThresholdSeverity.Warning,
        };
    }
    if (budget.maximumError) {
        yield {
            limit: calculateBytes(budget.maximumError, budget.baseline, 1),
            type: ThresholdType.Max,
            severity: ThresholdSeverity.Error,
        };
    }
    if (budget.minimumWarning) {
        yield {
            limit: calculateBytes(budget.minimumWarning, budget.baseline, -1),
            type: ThresholdType.Min,
            severity: ThresholdSeverity.Warning,
        };
    }
    if (budget.minimumError) {
        yield {
            limit: calculateBytes(budget.minimumError, budget.baseline, -1),
            type: ThresholdType.Min,
            severity: ThresholdSeverity.Error,
        };
    }
    if (budget.warning) {
        yield {
            limit: calculateBytes(budget.warning, budget.baseline, -1),
            type: ThresholdType.Min,
            severity: ThresholdSeverity.Warning,
        };
        yield {
            limit: calculateBytes(budget.warning, budget.baseline, 1),
            type: ThresholdType.Max,
            severity: ThresholdSeverity.Warning,
        };
    }
    if (budget.error) {
        yield {
            limit: calculateBytes(budget.error, budget.baseline, -1),
            type: ThresholdType.Min,
            severity: ThresholdSeverity.Error,
        };
        yield {
            limit: calculateBytes(budget.error, budget.baseline, 1),
            type: ThresholdType.Max,
            severity: ThresholdSeverity.Error,
        };
    }
}
exports.calculateThresholds = calculateThresholds;
/**
 * Calculates the sizes for bundles in the budget type provided.
 */
function calculateSizes(budget, stats) {
    if (budget.type === schema_1.Type.AnyComponentStyle) {
        // Component style size information is not available post-build, this must
        // be checked mid-build via the `AnyComponentStyleBudgetChecker` plugin.
        throw new Error('Can not calculate size of AnyComponentStyle. Use `AnyComponentStyleBudgetChecker` instead.');
    }
    const calculatorMap = {
        all: AllCalculator,
        allScript: AllScriptCalculator,
        any: AnyCalculator,
        anyScript: AnyScriptCalculator,
        bundle: BundleCalculator,
        initial: InitialCalculator,
    };
    const ctor = calculatorMap[budget.type];
    const { chunks, assets } = stats;
    if (!chunks) {
        throw new Error('Webpack stats output did not include chunk information.');
    }
    if (!assets) {
        throw new Error('Webpack stats output did not include asset information.');
    }
    const calculator = new ctor(budget, chunks, assets);
    return calculator.calculate();
}
class Calculator {
    budget;
    chunks;
    assets;
    constructor(budget, chunks, assets) {
        this.budget = budget;
        this.chunks = chunks;
        this.assets = assets;
    }
    /** Calculates the size of the given chunk for the provided build type. */
    calculateChunkSize(chunk) {
        // No differential builds, get the chunk size by summing its assets.
        if (!chunk.files) {
            return 0;
        }
        return chunk.files
            .filter((file) => !file.endsWith('.map'))
            .map((file) => {
            const asset = this.assets.find((asset) => asset.name === file);
            if (!asset) {
                throw new Error(`Could not find asset for file: ${file}`);
            }
            return asset.size;
        })
            .reduce((l, r) => l + r, 0);
    }
    getAssetSize(asset) {
        return asset.size;
    }
}
/**
 * A named bundle.
 */
class BundleCalculator extends Calculator {
    calculate() {
        const budgetName = this.budget.name;
        if (!budgetName) {
            return [];
        }
        const size = this.chunks
            .filter((chunk) => chunk?.names?.includes(budgetName))
            .map((chunk) => this.calculateChunkSize(chunk))
            .reduce((l, r) => l + r, 0);
        return [{ size, label: this.budget.name }];
    }
}
/**
 * The sum of all initial chunks (marked as initial).
 */
class InitialCalculator extends Calculator {
    calculate() {
        return [
            {
                label: `bundle initial`,
                size: this.chunks
                    .filter((chunk) => chunk.initial)
                    .map((chunk) => this.calculateChunkSize(chunk))
                    .reduce((l, r) => l + r, 0),
            },
        ];
    }
}
/**
 * The sum of all the scripts portions.
 */
class AllScriptCalculator extends Calculator {
    calculate() {
        const size = this.assets
            .filter((asset) => asset.name.endsWith('.js'))
            .map((asset) => this.getAssetSize(asset))
            .reduce((total, size) => total + size, 0);
        return [{ size, label: 'total scripts' }];
    }
}
/**
 * All scripts and assets added together.
 */
class AllCalculator extends Calculator {
    calculate() {
        const size = this.assets
            .filter((asset) => !asset.name.endsWith('.map'))
            .map((asset) => this.getAssetSize(asset))
            .reduce((total, size) => total + size, 0);
        return [{ size, label: 'total' }];
    }
}
/**
 * Any script, individually.
 */
class AnyScriptCalculator extends Calculator {
    calculate() {
        return this.assets
            .filter((asset) => asset.name.endsWith('.js'))
            .map((asset) => ({
            size: this.getAssetSize(asset),
            label: asset.name,
        }));
    }
}
/**
 * Any script or asset (images, css, etc).
 */
class AnyCalculator extends Calculator {
    calculate() {
        return this.assets
            .filter((asset) => !asset.name.endsWith('.map'))
            .map((asset) => ({
            size: this.getAssetSize(asset),
            label: asset.name,
        }));
    }
}
/**
 * Calculate the bytes given a string value.
 */
function calculateBytes(input, baseline, factor = 1) {
    const matches = input.match(/^\s*(\d+(?:\.\d+)?)\s*(%|(?:[mM]|[kK]|[gG])?[bB])?\s*$/);
    if (!matches) {
        return NaN;
    }
    const baselineBytes = (baseline && calculateBytes(baseline)) || 0;
    let value = Number(matches[1]);
    switch (matches[2] && matches[2].toLowerCase()) {
        case '%':
            value = (baselineBytes * value) / 100;
            break;
        case 'kb':
            value *= 1024;
            break;
        case 'mb':
            value *= 1024 * 1024;
            break;
        case 'gb':
            value *= 1024 * 1024 * 1024;
            break;
    }
    if (baselineBytes === 0) {
        return value;
    }
    return baselineBytes + value * factor;
}
function* checkBudgets(budgets, webpackStats) {
    // Ignore AnyComponentStyle budgets as these are handled in `AnyComponentStyleBudgetChecker`.
    const computableBudgets = budgets.filter((budget) => budget.type !== schema_1.Type.AnyComponentStyle);
    for (const budget of computableBudgets) {
        const sizes = calculateSizes(budget, webpackStats);
        for (const { size, label } of sizes) {
            yield* checkThresholds(calculateThresholds(budget), size, label);
        }
    }
}
exports.checkBudgets = checkBudgets;
function* checkThresholds(thresholds, size, label) {
    for (const threshold of thresholds) {
        switch (threshold.type) {
            case ThresholdType.Max: {
                if (size <= threshold.limit) {
                    continue;
                }
                const sizeDifference = (0, stats_1.formatSize)(size - threshold.limit);
                yield {
                    severity: threshold.severity,
                    label,
                    message: `${label} exceeded maximum budget. Budget ${(0, stats_1.formatSize)(threshold.limit)} was not met by ${sizeDifference} with a total of ${(0, stats_1.formatSize)(size)}.`,
                };
                break;
            }
            case ThresholdType.Min: {
                if (size >= threshold.limit) {
                    continue;
                }
                const sizeDifference = (0, stats_1.formatSize)(threshold.limit - size);
                yield {
                    severity: threshold.severity,
                    label,
                    message: `${label} failed to meet minimum budget. Budget ${(0, stats_1.formatSize)(threshold.limit)} was not met by ${sizeDifference} with a total of ${(0, stats_1.formatSize)(size)}.`,
                };
                break;
            }
            default: {
                throw new Error(`Unexpected threshold type: ${ThresholdType[threshold.type]}`);
            }
        }
    }
}
exports.checkThresholds = checkThresholds;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLWNhbGN1bGF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9idW5kbGUtY2FsY3VsYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFHSCx1REFBMEQ7QUFDMUQsd0RBQTBEO0FBYTFELElBQUssYUFHSjtBQUhELFdBQUssYUFBYTtJQUNoQixnQ0FBZSxDQUFBO0lBQ2YsZ0NBQWUsQ0FBQTtBQUNqQixDQUFDLEVBSEksYUFBYSxLQUFiLGFBQWEsUUFHakI7QUFFRCxJQUFZLGlCQUdYO0FBSEQsV0FBWSxpQkFBaUI7SUFDM0Isd0NBQW1CLENBQUE7SUFDbkIsb0NBQWUsQ0FBQTtBQUNqQixDQUFDLEVBSFcsaUJBQWlCLGlDQUFqQixpQkFBaUIsUUFHNUI7QUFRRCxRQUFlLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFjO0lBQ2pELElBQUksTUFBTSxDQUFDLGNBQWMsRUFBRTtRQUN6QixNQUFNO1lBQ0osS0FBSyxFQUFFLGNBQWMsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ2hFLElBQUksRUFBRSxhQUFhLENBQUMsR0FBRztZQUN2QixRQUFRLEVBQUUsaUJBQWlCLENBQUMsT0FBTztTQUNwQyxDQUFDO0tBQ0g7SUFFRCxJQUFJLE1BQU0sQ0FBQyxZQUFZLEVBQUU7UUFDdkIsTUFBTTtZQUNKLEtBQUssRUFBRSxjQUFjLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUM5RCxJQUFJLEVBQUUsYUFBYSxDQUFDLEdBQUc7WUFDdkIsUUFBUSxFQUFFLGlCQUFpQixDQUFDLEtBQUs7U0FDbEMsQ0FBQztLQUNIO0lBRUQsSUFBSSxNQUFNLENBQUMsY0FBYyxF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QUExQ0QsMENBMENDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IFN0YXRzQXNzZXQsIFN0YXRzQ2h1bmssIFN0YXRzQ29tcGlsYXRpb24gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IEJ1ZGdldCwgVHlwZSB9IGZyb20gJy4uL2J1aWxkZXJzL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IGZvcm1hdFNpemUgfSBmcm9tICcuLi90b29scy93ZWJwYWNrL3V0aWxzL3N0YXRzJztcblxuaW50ZXJmYWNlIFNpemUge1xuICBzaXplOiBudW1iZXI7XG4gIGxhYmVsPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgVGhyZXNob2xkIHtcbiAgbGltaXQ6IG51bWJlcjtcbiAgdHlwZTogVGhyZXNob2xkVHlwZTtcbiAgc2V2ZXJpdHk6IFRocmVzaG9sZFNldmVyaXR5O1xufVxuXG5lbnVtIFRocmVzaG9sZFR5cGUge1xuICBNYXggPSAnbWF4aW11bScsXG4gIE1pbiA9ICdtaW5pbXVtJyxcbn1cblxuZXhwb3J0IGVudW0gVGhyZXNob2xkU2V2ZXJpdHkge1xuICBXYXJuaW5nID0gJ3dhcm5pbmcnLFxuICBFcnJvciA9ICdlcnJvcicsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVkZ2V0Q2FsY3VsYXRvclJlc3VsdCB7XG4gIHNldmVyaXR5OiBUaHJlc2hvbGRTZXZlcml0eTtcbiAgbWVzc2FnZTogc3RyaW5nO1xuICBsYWJlbD86IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uKiBjYWxjdWxhdGVUaHJlc2hvbGRzKGJ1ZGdldDogQnVkZ2V0KTogSXRlcmFibGVJdGVyYXRvcjxUaHJlc2hvbGQ+IHtcbiAgaWYgKGJ1ZGdldC5tYXhpbXVtV2FybmluZykge1xuICAgIHlpZWxkIHtcbiAgICAgIGxpbWl0OiBjYWxjdWxhdGVCeXRlcyhidWRnZXQubWF4aW11bVdhcm5pbmcsIGJ1ZGdldC5iYXNlbGluZSwgMSksXG4gICAgICB0eXBlOiBUaHJlc2hvbGRUeXBlLk1heCxcbiAgICAgIHNldmVyaXR5OiBUaHJlc2hvbGRTZXZlcml0eS5XYXJuaW5nLFxuICAgIH07XG4gIH1cblxuICBpZiAoYnVkZ2V0Lm1heGltdW1FcnJvcikge1xuICAgIHlpZWxkIHtcbiAgICAgIGxpbWl0OiBjYWxjdWxhdGVCeXRlcyhidWRnZXQubWF4aW11bUVycm9yLCBidWRnZXQuYmFzZWxpbmUsIDEpLFxuICAgICAgdHlwZTogVGhyZXNob2xkVHlwZS5NYXgsXG4gICAgICBzZXZlcml0eTogVGhyZXNob2xkU2V2ZXJpdHkuRXJyb3IsXG4gICAgfTtcbiAgfVxuXG4gIGlmIChidWRnZXQubWluaW11bVdhcm5pbmcpIHtcbiAgICB5aWVsZCB7XG4gICAgICBsaW1pdDogY2FsY3VsYXRlQnl0ZXMoYnVkZ2V0Lm1pbmltdW1XYXJuaW5nLCBidWRnZXQuYmFzZWxpbmUsIC0xKSxcbiAgICAgIHR5cGU6IFRocmVzaG9sZFR5cGUuTWluLFxuICAgICAgc2V2ZXJpdHk6IFRocmVzaG9sZFNldmVyaXR5Lldhcm5pbmcsXG4gICAgfTtcbiAgfVxuXG4gIGlmIChidWRnZXQubWluaW11bUVycm9yKSB7XG4gICAgeWllbGQge1xuICAgICAgbGltaXQ6IGNhbGN1bGF0ZUJ5dGVzKGJ1ZGdldC5taW5pbXVtRXJyb3IsIGJ1ZGdldC5iYXNlbGluZSwgLTEpLFxuICAgICAgdHlwZTogVGhyZXNob2xkVHlwZS5NaW4sXG4gICAgICBzZXZlcml0eTogVGhyZXNob2xkU2V2ZXJpdHkuRXJyb3IsXG4gICAgfTtcbiAgfVxuXG4gIGlmIChidWRnZXQud2FybmluZykge1xuICAgIHlpZWxkIHtcbiAgICAgIGxpbWl0OiBjYWxjdWxhdGVCeXRlcyhidWRnZXQud2FybmluZywgYnVkZ2V0LmJhc2VsaW5lLCAtMSksXG4gICAgICB0eXBlOiBUaHJlc2hvbGRUeXBlLk1pbixcbiAgICAgIHNldmVyaXR5OiBUaHJlc2hvbGRTZXZlcml0eS5XYXJuaW5nLFxuICAgIH07XG5cbiAgICB5aWVsZCB7XG4gICAgICBsaW1pdDogY2FsY3VsYXRlQnl0ZXMoYnVkZ2V0Lndhcm5pbmcsIGJ1ZGdldC5iYXNlbGluZSwgMSksXG4gICAgICB0eXBlOiBUaHJlc2hvbGRUeXBlLk1heCxcbiAgICAgIHNldmVyaXR5OiBUaHJlc2hvbGRTZXZlcml0eS5XYXJuaW5nLFxuICAgIH07XG4gIH1cblxuICBpZiAoYnVkZ2V0LmVycm9yKSB7XG4gICAgeWllbGQge1xuICAgICAgbGltaXQ6IGNhbGN1bGF0ZUJ5dGVzKGJ1ZGdldC5lcnJvciwgYnVkZ2V0LmJhc2VsaW5lLCAtMSksXG4gICAgICB0eXBlOiBUaHJlc2hvbGRUeXBlLk1pbixcbiAgICAgIHNldmVyaXR5OiBUaHJlc2hvbGRTZXZlcml0eS5FcnJvcixcbiAgICB9O1xuXG4gICAgeWllbGQge1xuICAgICAgbGltaXQ6IGNhbGN1bGF0ZUJ5dGVzKGJ1ZGdldC5lcnJvciwgYnVkZ2V0LmJhc2VsaW5lLCAxKSxcbiAgICAgIHR5cGU6IFRocmVzaG9sZFR5cGUuTWF4LFxuICAgICAgc2V2ZXJpdHk6IFRocmVzaG9sZFNldmVyaXR5LkVycm9yLFxuICAgIH07XG4gIH1cbn1cblxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSBzaXplcyBmb3IgYnVuZGxlcyBpbiB0aGUgYnVkZ2V0IHR5cGUgcHJvdmlkZWQuXG4gKi9cbmZ1bmN0aW9uIGNhbGN1bGF0ZVNpemVzKGJ1ZGdldDogQnVkZ2V0LCBzdGF0czogU3RhdHNDb21waWxhdGlvbik6IFNpemVbXSB7XG4gIGlmIChidWRnZXQudHlwZSA9PT0gVHlwZS5BbnlDb21wb25lbnRTdHlsZSkge1xuICAgIC8vIENvbXBvbmVudCBzdHlsZSBzaXplIGluZm9ybWF0aW9uIGlzIG5vdCBhdmFpbGFibGUgcG9zdC1idWlsZCwgdGhpcyBtdXN0XG4gICAgLy8gYmUgY2hlY2tlZCBtaWQtYnVpbGQgdmlhIHRoZSBgQW55Q29tcG9uZW50U3R5bGVCdWRnZXRDaGVja2VyYCBwbHVnaW4uXG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ0NhbiBub3QgY2FsY3VsYXRlIHNpemUgb2YgQW55Q29tcG9uZW50U3R5bGUuIFVzZSBgQW55Q29tcG9uZW50U3R5bGVCdWRnZXRDaGVja2VyYCBpbnN0ZWFkLicsXG4gICAgKTtcbiAgfVxuXG4gIHR5cGUgTm9uQ29tcG9uZW50U3R5bGVCdWRnZXRUeXBlcyA9IEV4Y2x1ZGU8QnVkZ2V0Wyd0eXBlJ10sIFR5cGUuQW55Q29tcG9uZW50U3R5bGU+O1xuICB0eXBlIENhbGN1bGF0b3JUeXBlcyA9IHtcbiAgICBuZXcgKGJ1ZGdldDogQnVkZ2V0LCBjaHVua3M6IFN0YXRzQ2h1bmtbXSwgYXNzZXRzOiBTdGF0c0Fzc2V0W10pOiBDYWxjdWxhdG9yO1xuICB9O1xuICBjb25zdCBjYWxjdWxhdG9yTWFwOiBSZWNvcmQ8Tm9uQ29tcG9uZW50U3R5bGVCdWRnZXRUeXBlcywgQ2FsY3VsYXRvclR5cGVzPiA9IHtcbiAgICBhbGw6IEFsbENhbGN1bGF0b3IsXG4gICAgYWxsU2NyaXB0OiBBbGxTY3JpcHRDYWxjdWxhdG9yLFxuICAgIGFueTogQW55Q2FsY3VsYXRvcixcbiAgICBhbnlTY3JpcHQ6IEFueVNjcmlwdENhbGN1bGF0b3IsXG4gICAgYnVuZGxlOiBCdW5kbGVDYWxjdWxhdG9yLFxuICAgIGluaXRpYWw6IEluaXRpYWxDYWxjdWxhdG9yLFxuICB9O1xuXG4gIGNvbnN0IGN0b3IgPSBjYWxjdWxhdG9yTWFwW2J1ZGdldC50eXBlXTtcbiAgY29uc3QgeyBjaHVua3MsIGFzc2V0cyB9ID0gc3RhdHM7XG4gIGlmICghY2h1bmtzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdXZWJwYWNrIHN0YXRzIG91dHB1dCBkaWQgbm90IGluY2x1ZGUgY2h1bmsgaW5mb3JtYXRpb24uJyk7XG4gIH1cbiAgaWYgKCFhc3NldHMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYnBhY2sgc3RhdHMgb3V0cHV0IGRpZCBub3QgaW5jbHVkZSBhc3NldCBpbmZvcm1hdGlvbi4nKTtcbiAgfVxuXG4gIGNvbnN0IGNhbGN1bGF0b3IgPSBuZXcgY3RvcihidWRnZXQsIGNodW5rcywgYXNzZXRzKTtcblxuICByZXR1cm4gY2FsY3VsYXRvci5jYWxjdWxhdGUoKTtcbn1cblxuYWJzdHJhY3QgY2xhc3MgQ2FsY3VsYXRvciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBidWRnZXQ6IEJ1ZGdldCxcbiAgICBwcm90ZWN0ZWQgY2h1bmtzOiBTdGF0c0NodW5rW10sXG4gICAgcHJvdGVjdGVkIGFzc2V0czogU3RhdHNBc3NldFtdLFxuICApIHt9XG5cbiAgYWJzdHJhY3QgY2FsY3VsYXRlKCk6IFNpemVbXTtcblxuICAvKiogQ2FsY3VsYXRlcyB0aGUgc2l6ZSBvZiB0aGUgZ2l2ZW4gY2h1bmsgZm9yIHRoZSBwcm92aWRlZCBidWlsZCB0eXBlLiAqL1xuICBwcm90ZWN0ZWQgY2FsY3VsYXRlQ2h1bmtTaXplKGNodW5rOiBTdGF0c0NodW5rKTogbnVtYmVyIHtcbiAgICAvLyBObyBkaWZmZXJlbnRpYWwgYnVpbGRzLCBnZXQgdGhlIGNodW5rIHNpemUgYnkgc3VtbWluZyBpdHMgYXNzZXRzLlxuICAgIGlmICghY2h1bmsuZmlsZXMpIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIHJldHVybiBjaHVuay5maWxlc1xuICAgICAgLmZpbHRlcigoZmlsZSkgPT4gIWZpbGUuZW5kc1dpdGgoJy5tYXAnKSlcbiAgICAgIC5tYXAoKGZpbGUpID0+IHtcbiAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLmFzc2V0cy5maW5kKChhc3NldCkgPT4gYXNzZXQubmFtZSA9PT0gZmlsZSk7XG4gICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kIGFzc2V0IGZvciBmaWxlOiAke2ZpbGV9YCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXNzZXQuc2l6ZTtcbiAgICAgIH0pXG4gICAgICAucmVkdWNlKChsLCByKSA9PiBsICsgciwgMCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgZ2V0QXNzZXRTaXplKGFzc2V0OiBTdGF0c0Fzc2V0KTogbnVtYmVyIHtcbiAgICByZXR1cm4gYXNzZXQuc2l6ZTtcbiAgfVxufVxuXG4vKipcbiAqIEEgbmFtZWQgYnVuZGxlLlxuICovXG5jbGFzcyBCdW5kbGVDYWxjdWxhdG9yIGV4dGVuZHMgQ2FsY3VsYXRvciB7XG4gIGNhbGN1bGF0ZSgpIHtcbiAgICBjb25zdCBidWRnZXROYW1lID0gdGhpcy5idWRnZXQubmFtZTtcbiAgICBpZiAoIWJ1ZGdldE5hbWUpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBzaXplID0gdGhpcy5jaHVua3NcbiAgICAgIC5maWx0ZXIoKGNodW5rKSA9PiBjaHVuaz8ubmFtZXM/LmluY2x1ZGVzKGJ1ZGdldE5hbWUpKVxuICAgICAgLm1hcCgoY2h1bmspID0+IHRoaXMuY2FsY3VsYXRlQ2h1bmtTaXplKGNodW5rKSlcbiAgICAgIC5yZWR1Y2UoKGwsIHIpID0+IGwgKyByLCAwKTtcblxuICAgIHJldHVybiBbeyBzaXplLCBsYWJlbDogdGhpcy5idWRnZXQubmFtZSB9XTtcbiAgfVxufVxuXG4vKipcbiAqIFRoZSBzdW0gb2YgYWxsIGluaXRpYWwgY2h1bmtzIChtYXJrZWQgYXMgaW5pdGlhbCkuXG4gKi9cbmNsYXNzIEluaXRpYWxDYWxjdWxhdG9yIGV4dGVuZHMgQ2FsY3VsYXRvciB7XG4gIGNhbGN1bGF0ZSgpIHtcbiAgICByZXR1cm4gW1xuICAgICAge1xuICAgICAgICBsYWJlbDogYGJ1bmRsZSBpbml0aWFsYCxcbiAgICAgICAgc2l6ZTogdGhpcy5jaHVua3NcbiAgICAgICAgICAuZmlsdGVyKChjaHVuaykgPT4gY2h1bmsuaW5pdGlhbClcbiAgICAgICAgICAubWFwKChjaHVuaykgPT4gdGhpcy5jYWxjdWxhdGVDaHVua1NpemUoY2h1bmspKVxuICAgICAgICAgIC5yZWR1Y2UoKGwsIHIpID0+IGwgKyByLCAwKSxcbiAgICAgIH0sXG4gICAgXTtcbiAgfVxufVxuXG4vKipcbiAqIFRoZSBzdW0gb2YgYWxsIHRoZSBzY3JpcHRzIHBvcnRpb25zLlxuICovXG5jbGFzcyBBbGxTY3JpcHRDYWxjdWxhdG9yIGV4dGVuZHMgQ2FsY3VsYXRvciB7XG4gIGNhbGN1bGF0ZSgpIHtcbiAgICBjb25zdCBzaXplID0gdGhpcy5hc3NldHNcbiAgICAgIC5maWx0ZXIoKGFzc2V0KSA9PiBhc3NldC5uYW1lLmVuZHNXaXRoKCcuanMnKSlcbiAgICAgIC5tYXAoKGFzc2V0KSA9PiB0aGlzLmdldEFzc2V0U2l6ZShhc3NldCkpXG4gICAgICAucmVkdWNlKCh0b3RhbDogbnVtYmVyLCBzaXplOiBudW1iZXIpID0+IHRvdGFsICsgc2l6ZSwgMCk7XG5cbiAgICByZXR1cm4gW3sgc2l6ZSwgbGFiZWw6ICd0b3RhbCBzY3JpcHRzJyB9XTtcbiAgfVxufVxuXG4vKipcbiAqIEFsbCBzY3JpcHRzIGFuZCBhc3NldHMgYWRkZWQgdG9nZXRoZXIuXG4gKi9cbmNsYXNzIEFsbENhbGN1bGF0b3IgZXh0ZW5kcyBDYWxjdWxhdG9yIHtcbiAgY2FsY3VsYXRlKCkge1xuICAgIGNvbnN0IHNpemUgPSB0aGlzLmFzc2V0c1xuICAgICAgLmZpbHRlcigoYXNzZXQpID0+ICFhc3NldC5uYW1lLmVuZHNXaXRoKCcubWFwJykpXG4gICAgICAubWFwKChhc3NldCkgPT4gdGhpcy5nZXRBc3NldFNpemUoYXNzZXQpKVxuICAgICAgLnJlZHVjZSgodG90YWw6IG51bWJlciwgc2l6ZTogbnVtYmVyKSA9PiB0b3RhbCArIHNpemUsIDApO1xuXG4gICAgcmV0dXJuIFt7IHNpemUsIGxhYmVsOiAndG90YWwnIH1dO1xuICB9XG59XG5cbi8qKlxuICogQW55IHNjcmlwdCwgaW5kaXZpZHVhbGx5LlxuICovXG5jbGFzcyBBbnlTY3JpcHRDYWxjdWxhdG9yIGV4dGVuZHMgQ2FsY3VsYXRvciB7XG4gIGNhbGN1bGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5hc3NldHNcbiAgICAgIC5maWx0ZXIoKGFzc2V0KSA9PiBhc3NldC5uYW1lLmVuZHNXaXRoKCcuanMnKSlcbiAgICAgIC5tYXAoKGFzc2V0KSA9PiAoe1xuICAgICAgICBzaXplOiB0aGlzLmdldEFzc2V0U2l6ZShhc3NldCksXG4gICAgICAgIGxhYmVsOiBhc3NldC5uYW1lLFxuICAgICAgfSkpO1xuICB9XG59XG5cbi8qKlxuICogQW55IHNjcmlwdCBvciBhc3NldCAoaW1hZ2VzLCBjc3MsIGV0YykuXG4gKi9cbmNsYXNzIEFueUNhbGN1bGF0b3IgZXh0ZW5kcyBDYWxjdWxhdG9yIHtcbiAgY2FsY3VsYXRlKCkge1xuICAgIHJldHVybiB0aGlzLmFzc2V0c1xuICAgICAgLmZpbHRlcigoYXNzZXQpID0+ICFhc3NldC5uYW1lLmVuZHNXaXRoKCcubWFwJykpXG4gICAgICAubWFwKChhc3NldCkgPT4gKHtcbiAgICAgICAgc2l6ZTogdGhpcy5nZXRBc3NldFNpemUoYXNzZXQpLFxuICAgICAgICBsYWJlbDogYXNzZXQubmFtZSxcbiAgICAgIH0pKTtcbiAgfVxufVxuXG4vKipcbiAqIENhbGN1bGF0ZSB0aGUgYnl0ZXMgZ2l2ZW4gYSBzdHJpbmcgdmFsdWUuXG4gKi9cbmZ1bmN0aW9uIGNhbGN1bGF0ZUJ5dGVzKGlucHV0OiBzdHJpbmcsIGJhc2VsaW5lPzogc3RyaW5nLCBmYWN0b3I6IDEgfCAtMSA9IDEpOiBudW1iZXIge1xuICBjb25zdCBtYXRjaGVzID0gaW5wdXQubWF0Y2goL15cXHMqKFxcZCsoPzpcXC5cXGQrKT8pXFxzKiglfCg/OlttTV18W2tLXXxbZ0ddKT9bYkJdKT9cXHMqJC8pO1xuICBpZiAoIW1hdGNoZXMpIHtcbiAgICByZXR1cm4gTmFOO1xuICB9XG5cbiAgY29uc3QgYmFzZWxpbmVCeXRlcyA9IChiYXNlbGluZSAmJiBjYWxjdWxhdGVCeXRlcyhiYXNlbGluZSkpIHx8IDA7XG5cbiAgbGV0IHZhbHVlID0gTnVtYmVyKG1hdGNoZXNbMV0pO1xuICBzd2l0Y2ggKG1hdGNoZXNbMl0gJiYgbWF0Y2hlc1syXS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnJSc6XG4gICAgICB2YWx1ZSA9IChiYXNlbGluZUJ5dGVzICogdmFsdWUpIC8gMTAwO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAna2InOlxuICAgICAgdmFsdWUgKj0gMTAyNDtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ21iJzpcbiAgICAgIHZhbHVlICo9IDEwMjQgKiAxMDI0O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnZ2InOlxuICAgICAgdmFsdWUgKj0gMTAyNCAqIDEwMjQgKiAxMDI0O1xuICAgICAgYnJlYWs7XG4gIH1cblxuICBpZiAoYmFzZWxpbmVCeXRlcyA9PT0gMCkge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuXG4gIHJldHVybiBiYXNlbGluZUJ5dGVzICsgdmFsdWUgKiBmYWN0b3I7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiogY2hlY2tCdWRnZXRzKFxuICBidWRnZXRzOiBCdWRnZXRbXSxcbiAgd2VicGFja1N0YXRzOiBTdGF0c0NvbXBpbGF0aW9uLFxuKTogSXRlcmFibGVJdGVyYXRvcjxCdWRnZXRDYWxjdWxhdG9yUmVzdWx0PiB7XG4gIC8vIElnbm9yZSBBbnlDb21wb25lbnRTdHlsZSBidWRnZXRzIGFzIHRoZXNlIGFyZSBoYW5kbGVkIGluIGBBbnlDb21wb25lbnRTdHlsZUJ1ZGdldENoZWNrZXJgLlxuICBjb25zdCBjb21wdXRhYmxlQnVkZ2V0cyA9IGJ1ZGdldHMuZmlsdGVyKChidWRnZXQpID0+IGJ1ZGdldC50eXBlICE9PSBUeXBlLkFueUNvbXBvbmVudFN0eWxlKTtcblxuICBmb3IgKGNvbnN0IGJ1ZGdldCBvZiBjb21wdXRhYmxlQnVkZ2V0cykge1xuICAgIGNvbnN0IHNpemVzID0gY2FsY3VsYXRlU2l6ZXMoYnVkZ2V0LCB3ZWJwYWNrU3RhdHMpO1xuICAgIGZvciAoY29uc3QgeyBzaXplLCBsYWJlbCB9IG9mIHNpemVzKSB7XG4gICAgICB5aWVsZCogY2hlY2tUaHJlc2hvbGRzKGNhbGN1bGF0ZVRocmVzaG9sZHMoYnVkZ2V0KSwgc2l6ZSwgbGFiZWwpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24qIGNoZWNrVGhyZXNob2xkcyhcbiAgdGhyZXNob2xkczogSXRlcmFibGVJdGVyYXRvcjxUaHJlc2hvbGQ+LFxuICBzaXplOiBudW1iZXIsXG4gIGxhYmVsPzogc3RyaW5nLFxuKTogSXRlcmFibGVJdGVyYXRvcjxCdWRnZXRDYWxjdWxhdG9yUmVzdWx0PiB7XG4gIGZvciAoY29uc3QgdGhyZXNob2xkIG9mIHRocmVzaG9sZHMpIHtcbiAgICBzd2l0Y2ggKHRocmVzaG9sZC50eXBlKSB7XG4gICAgICBjYXNlIFRocmVzaG9sZFR5cGUuTWF4OiB7XG4gICAgICAgIGlmIChzaXplIDw9IHRocmVzaG9sZC5saW1pdCkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2l6ZURpZmZlcmVuY2UgPSBmb3JtYXRTaXplKHNpemUgLSB0aHJlc2hvbGQubGltaXQpO1xuICAgICAgICB5aWVsZCB7XG4gICAgICAgICAgc2V2ZXJpdHk6IHRocmVzaG9sZC5zZXZlcml0eSxcbiAgICAgICAgICBsYWJlbCxcbiAgICAgICAgICBtZXNzYWdlOiBgJHtsYWJlbH0gZXhjZWVkZWQgbWF4aW11bSBidWRnZXQuIEJ1ZGdldCAke2Zvcm1hdFNpemUoXG4gICAgICAgICAgICB0aHJlc2hvbGQubGltaXQsXG4gICAgICAgICAgKX0gd2FzIG5vdCBtZXQgYnkgJHtzaXplRGlmZmVyZW5jZX0gd2l0aCBhIHRvdGFsIG9mICR7Zm9ybWF0U2l6ZShzaXplKX0uYCxcbiAgICAgICAgfTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFRocmVzaG9sZFR5cGUuTWluOiB7XG4gICAgICAgIGlmIChzaXplID49IHRocmVzaG9sZC5saW1pdCkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2l6ZURpZmZlcmVuY2UgPSBmb3JtYXRTaXplKHRocmVzaG9sZC5saW1pdCAtIHNpemUpO1xuICAgICAgICB5aWVsZCB7XG4gICAgICAgICAgc2V2ZXJpdHk6IHRocmVzaG9sZC5zZXZlcml0eSxcbiAgICAgICAgICBsYWJlbCxcbiAgICAgICAgICBtZXNzYWdlOiBgJHtsYWJlbH0gZmFpbGVkIHRvIG1lZXQgbWluaW11bSBidWRnZXQuIEJ1ZGdldCAke2Zvcm1hdFNpemUoXG4gICAgICAgICAgICB0aHJlc2hvbGQubGltaXQsXG4gICAgICAgICAgKX0gd2FzIG5vdCBtZXQgYnkgJHtzaXplRGlmZmVyZW5jZX0gd2l0aCBhIHRvdGFsIG9mICR7Zm9ybWF0U2l6ZShzaXplKX0uYCxcbiAgICAgICAgfTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBkZWZhdWx0OiB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCB0aHJlc2hvbGQgdHlwZTogJHtUaHJlc2hvbGRUeXBlW3RocmVzaG9sZC50eXBlXX1gKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==