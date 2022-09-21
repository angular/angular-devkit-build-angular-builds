"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnyComponentStyleBudgetChecker = void 0;
const path = __importStar(require("path"));
const webpack_1 = require("webpack");
const schema_1 = require("../../builders/browser/schema");
const bundle_calculator_1 = require("../../utils/bundle-calculator");
const webpack_diagnostics_1 = require("../../utils/webpack-diagnostics");
const PLUGIN_NAME = 'AnyComponentStyleBudgetChecker';
/**
 * Check budget sizes for component styles by emitting a warning or error if a
 * budget is exceeded by a particular component's styles.
 */
class AnyComponentStyleBudgetChecker {
    constructor(budgets) {
        this.budgets = budgets.filter((budget) => budget.type === schema_1.Type.AnyComponentStyle);
    }
    apply(compiler) {
        compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
            compilation.hooks.processAssets.tap({
                name: PLUGIN_NAME,
                stage: webpack_1.Compilation.PROCESS_ASSETS_STAGE_ANALYSE,
            }, () => {
                // No budgets.
                if (this.budgets.length === 0) {
                    return;
                }
                // In AOT compilations component styles get processed in child compilations.
                if (!compilation.compiler.parentCompilation) {
                    return;
                }
                const cssExtensions = ['.css', '.scss', '.less', '.styl', '.sass'];
                const componentStyles = Object.keys(compilation.assets)
                    .filter((name) => cssExtensions.includes(path.extname(name)))
                    .map((name) => ({
                    size: compilation.assets[name].size(),
                    label: name,
                }));
                const thresholds = this.budgets.flatMap((budget) => [...(0, bundle_calculator_1.calculateThresholds)(budget)]);
                for (const { size, label } of componentStyles) {
                    for (const { severity, message } of (0, bundle_calculator_1.checkThresholds)(thresholds[Symbol.iterator](), size, label)) {
                        switch (severity) {
                            case bundle_calculator_1.ThresholdSeverity.Warning:
                                (0, webpack_diagnostics_1.addWarning)(compilation, message);
                                break;
                            case bundle_calculator_1.ThresholdSeverity.Error:
                                (0, webpack_diagnostics_1.addError)(compilation, message);
                                break;
                            default:
                                assertNever(severity);
                        }
                    }
                }
            });
        });
    }
}
exports.AnyComponentStyleBudgetChecker = AnyComponentStyleBudgetChecker;
function assertNever(input) {
    throw new Error(`Unexpected call to assertNever() with input: ${JSON.stringify(input, null /* replacer */, 4 /* tabSize */)}`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW55LWNvbXBvbmVudC1zdHlsZS1idWRnZXQtY2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3dlYnBhY2svcGx1Z2lucy9hbnktY29tcG9uZW50LXN0eWxlLWJ1ZGdldC1jaGVja2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsMkNBQTZCO0FBQzdCLHFDQUFnRDtBQUNoRCwwREFBNkQ7QUFDN0QscUVBSXVDO0FBQ3ZDLHlFQUF1RTtBQUV2RSxNQUFNLFdBQVcsR0FBRyxnQ0FBZ0MsQ0FBQztBQUVyRDs7O0dBR0c7QUFDSCxNQUFhLDhCQUE4QjtJQUd6QyxZQUFZLE9BQWlCO1FBQzNCLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxhQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwRixDQUFDO0lBRUQsS0FBSyxDQUFDLFFBQWtCO1FBQ3RCLFFBQVEsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRTtZQUMxRCxXQUFXLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQ2pDO2dCQUNFLElBQUksRUFBRSxXQUFXO2dCQUNqQixLQUFLLEVBQUUscUJBQVcsQ0FBQyw0QkFBNEI7YUFDaEQsRUFDRCxHQUFHLEVBQUU7Z0JBQ0gsY0FBYztnQkFDZCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtvQkFDN0IsT0FBTztpQkFDUjtnQkFFRCw0RUFBNEU7Z0JBQzVFLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLGlCQUFpQixFQUFFO29CQUMzQyxPQUFPO2lCQUNSO2dCQUVELE1BQU0sYUFBYSxHQUFHLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUVuRSxNQUFNLGVBQWUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUM7cUJBQ3BELE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7cUJBQzVELEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDZCxJQUFJLEVBQUUsV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUU7b0JBQ3JDLEtBQUssRUFBRSxJQUFJO2lCQUNaLENBQUMsQ0FBQyxDQUFDO2dCQUVOLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBQSx1Q0FBbUIsRUFBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RGLEtBQUssTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxlQUFlLEVBQUU7b0JBQzdDLEtBQUssTUFBTSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxJQUFBLG1DQUFlLEVBQ2pELFVBQVUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFDN0IsSUFBSSxFQUNKLEtBQUssQ0FDTixFQUFFO3dCQUNELFFBQVEsUUFBUSxFQUFFOzRCQUNoQixLQUFLLHFDQUFpQixDQUFDLE9BQU87Z0NBQzVCLElBQUEsZ0NBQVUsRUFBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0NBQ2pDLE1BQU07NEJBQ1IsS0FBSyxxQ0FBaUIsQ0FBQyxLQUFLO2dDQUMxQixJQUFBLDhCQUFRLEVBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dDQUMvQixNQUFNOzRCQUNSO2dDQUNFLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQzt5QkFDekI7cUJBQ0Y7aUJBQ0Y7WUFDSCxDQUFDLENBQ0YsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBekRELHdFQXlEQztBQUVELFNBQVMsV0FBVyxDQUFDLEtBQVk7SUFDL0IsTUFBTSxJQUFJLEtBQUssQ0FDYixnREFBZ0QsSUFBSSxDQUFDLFNBQVMsQ0FDNUQsS0FBSyxFQUNMLElBQUksQ0FBQyxjQUFjLEVBQ25CLENBQUMsQ0FBQyxhQUFhLENBQ2hCLEVBQUUsQ0FDSixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQ29tcGlsYXRpb24sIENvbXBpbGVyIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBCdWRnZXQsIFR5cGUgfSBmcm9tICcuLi8uLi9idWlsZGVycy9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQge1xuICBUaHJlc2hvbGRTZXZlcml0eSxcbiAgY2FsY3VsYXRlVGhyZXNob2xkcyxcbiAgY2hlY2tUaHJlc2hvbGRzLFxufSBmcm9tICcuLi8uLi91dGlscy9idW5kbGUtY2FsY3VsYXRvcic7XG5pbXBvcnQgeyBhZGRFcnJvciwgYWRkV2FybmluZyB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stZGlhZ25vc3RpY3MnO1xuXG5jb25zdCBQTFVHSU5fTkFNRSA9ICdBbnlDb21wb25lbnRTdHlsZUJ1ZGdldENoZWNrZXInO1xuXG4vKipcbiAqIENoZWNrIGJ1ZGdldCBzaXplcyBmb3IgY29tcG9uZW50IHN0eWxlcyBieSBlbWl0dGluZyBhIHdhcm5pbmcgb3IgZXJyb3IgaWYgYVxuICogYnVkZ2V0IGlzIGV4Y2VlZGVkIGJ5IGEgcGFydGljdWxhciBjb21wb25lbnQncyBzdHlsZXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBBbnlDb21wb25lbnRTdHlsZUJ1ZGdldENoZWNrZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IGJ1ZGdldHM6IEJ1ZGdldFtdO1xuXG4gIGNvbnN0cnVjdG9yKGJ1ZGdldHM6IEJ1ZGdldFtdKSB7XG4gICAgdGhpcy5idWRnZXRzID0gYnVkZ2V0cy5maWx0ZXIoKGJ1ZGdldCkgPT4gYnVkZ2V0LnR5cGUgPT09IFR5cGUuQW55Q29tcG9uZW50U3R5bGUpO1xuICB9XG5cbiAgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKSB7XG4gICAgY29tcGlsZXIuaG9va3MuY29tcGlsYXRpb24udGFwKFBMVUdJTl9OQU1FLCAoY29tcGlsYXRpb24pID0+IHtcbiAgICAgIGNvbXBpbGF0aW9uLmhvb2tzLnByb2Nlc3NBc3NldHMudGFwKFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogUExVR0lOX05BTUUsXG4gICAgICAgICAgc3RhZ2U6IENvbXBpbGF0aW9uLlBST0NFU1NfQVNTRVRTX1NUQUdFX0FOQUxZU0UsXG4gICAgICAgIH0sXG4gICAgICAgICgpID0+IHtcbiAgICAgICAgICAvLyBObyBidWRnZXRzLlxuICAgICAgICAgIGlmICh0aGlzLmJ1ZGdldHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gSW4gQU9UIGNvbXBpbGF0aW9ucyBjb21wb25lbnQgc3R5bGVzIGdldCBwcm9jZXNzZWQgaW4gY2hpbGQgY29tcGlsYXRpb25zLlxuICAgICAgICAgIGlmICghY29tcGlsYXRpb24uY29tcGlsZXIucGFyZW50Q29tcGlsYXRpb24pIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBjc3NFeHRlbnNpb25zID0gWycuY3NzJywgJy5zY3NzJywgJy5sZXNzJywgJy5zdHlsJywgJy5zYXNzJ107XG5cbiAgICAgICAgICBjb25zdCBjb21wb25lbnRTdHlsZXMgPSBPYmplY3Qua2V5cyhjb21waWxhdGlvbi5hc3NldHMpXG4gICAgICAgICAgICAuZmlsdGVyKChuYW1lKSA9PiBjc3NFeHRlbnNpb25zLmluY2x1ZGVzKHBhdGguZXh0bmFtZShuYW1lKSkpXG4gICAgICAgICAgICAubWFwKChuYW1lKSA9PiAoe1xuICAgICAgICAgICAgICBzaXplOiBjb21waWxhdGlvbi5hc3NldHNbbmFtZV0uc2l6ZSgpLFxuICAgICAgICAgICAgICBsYWJlbDogbmFtZSxcbiAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgIGNvbnN0IHRocmVzaG9sZHMgPSB0aGlzLmJ1ZGdldHMuZmxhdE1hcCgoYnVkZ2V0KSA9PiBbLi4uY2FsY3VsYXRlVGhyZXNob2xkcyhidWRnZXQpXSk7XG4gICAgICAgICAgZm9yIChjb25zdCB7IHNpemUsIGxhYmVsIH0gb2YgY29tcG9uZW50U3R5bGVzKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHsgc2V2ZXJpdHksIG1lc3NhZ2UgfSBvZiBjaGVja1RocmVzaG9sZHMoXG4gICAgICAgICAgICAgIHRocmVzaG9sZHNbU3ltYm9sLml0ZXJhdG9yXSgpLFxuICAgICAgICAgICAgICBzaXplLFxuICAgICAgICAgICAgICBsYWJlbCxcbiAgICAgICAgICAgICkpIHtcbiAgICAgICAgICAgICAgc3dpdGNoIChzZXZlcml0eSkge1xuICAgICAgICAgICAgICAgIGNhc2UgVGhyZXNob2xkU2V2ZXJpdHkuV2FybmluZzpcbiAgICAgICAgICAgICAgICAgIGFkZFdhcm5pbmcoY29tcGlsYXRpb24sIG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBUaHJlc2hvbGRTZXZlcml0eS5FcnJvcjpcbiAgICAgICAgICAgICAgICAgIGFkZEVycm9yKGNvbXBpbGF0aW9uLCBtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICBhc3NlcnROZXZlcihzZXZlcml0eSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICApO1xuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFzc2VydE5ldmVyKGlucHV0OiBuZXZlcik6IG5ldmVyIHtcbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgIGBVbmV4cGVjdGVkIGNhbGwgdG8gYXNzZXJ0TmV2ZXIoKSB3aXRoIGlucHV0OiAke0pTT04uc3RyaW5naWZ5KFxuICAgICAgaW5wdXQsXG4gICAgICBudWxsIC8qIHJlcGxhY2VyICovLFxuICAgICAgNCAvKiB0YWJTaXplICovLFxuICAgICl9YCxcbiAgKTtcbn1cbiJdfQ==