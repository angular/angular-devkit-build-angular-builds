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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
exports.JsonStatsPlugin = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const webpack_diagnostics_1 = require("../../utils/webpack-diagnostics");
class JsonStatsPlugin {
    constructor(statsOutputPath) {
        this.statsOutputPath = statsOutputPath;
    }
    apply(compiler) {
        compiler.hooks.done.tapPromise('angular-json-stats', async (stats) => {
            const { stringifyStream } = await Promise.resolve().then(() => __importStar(require('@discoveryjs/json-ext')));
            const data = stats.toJson('verbose');
            try {
                await fs_1.promises.mkdir((0, path_1.dirname)(this.statsOutputPath), { recursive: true });
                await new Promise((resolve, reject) => stringifyStream(data)
                    .pipe((0, fs_1.createWriteStream)(this.statsOutputPath))
                    .on('close', resolve)
                    .on('error', reject));
            }
            catch (error) {
                (0, webpack_diagnostics_1.addError)(stats.compilation, `Unable to write stats file: ${error.message || 'unknown error'}`);
            }
        });
    }
}
exports.JsonStatsPlugin = JsonStatsPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvbi1zdGF0cy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3BsdWdpbnMvanNvbi1zdGF0cy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDJCQUErRDtBQUMvRCwrQkFBK0I7QUFHL0IseUVBQTJEO0FBRTNELE1BQWEsZUFBZTtJQUMxQixZQUE2QixlQUF1QjtRQUF2QixvQkFBZSxHQUFmLGVBQWUsQ0FBUTtJQUFHLENBQUM7SUFFeEQsS0FBSyxDQUFDLFFBQWtCO1FBQ3RCLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxvQkFBb0IsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEVBQUU7WUFDbkUsTUFBTSxFQUFFLGVBQWUsRUFBRSxHQUFHLHdEQUFhLHVCQUF1QixHQUFDLENBQUM7WUFDbEUsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUVyQyxJQUFJO2dCQUNGLE1BQU0sYUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFBLGNBQU8sRUFBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztnQkFDM0UsTUFBTSxJQUFJLE9BQU8sQ0FBTyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUMxQyxlQUFlLENBQUMsSUFBSSxDQUFDO3FCQUNsQixJQUFJLENBQUMsSUFBQSxzQkFBaUIsRUFBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7cUJBQzdDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDO3FCQUNwQixFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUN2QixDQUFDO2FBQ0g7WUFBQyxPQUFPLEtBQUssRUFBRTtnQkFDZCxJQUFBLDhCQUFRLEVBQ04sS0FBSyxDQUFDLFdBQVcsRUFDakIsK0JBQStCLEtBQUssQ0FBQyxPQUFPLElBQUksZUFBZSxFQUFFLENBQ2xFLENBQUM7YUFDSDtRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBeEJELDBDQXdCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBjcmVhdGVXcml0ZVN0cmVhbSwgcHJvbWlzZXMgYXMgZnNQcm9taXNlcyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IGRpcm5hbWUgfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IENvbXBpbGVyIH0gZnJvbSAnd2VicGFjayc7XG5cbmltcG9ydCB7IGFkZEVycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1kaWFnbm9zdGljcyc7XG5cbmV4cG9ydCBjbGFzcyBKc29uU3RhdHNQbHVnaW4ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHN0YXRzT3V0cHV0UGF0aDogc3RyaW5nKSB7fVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcikge1xuICAgIGNvbXBpbGVyLmhvb2tzLmRvbmUudGFwUHJvbWlzZSgnYW5ndWxhci1qc29uLXN0YXRzJywgYXN5bmMgKHN0YXRzKSA9PiB7XG4gICAgICBjb25zdCB7IHN0cmluZ2lmeVN0cmVhbSB9ID0gYXdhaXQgaW1wb3J0KCdAZGlzY292ZXJ5anMvanNvbi1leHQnKTtcbiAgICAgIGNvbnN0IGRhdGEgPSBzdGF0cy50b0pzb24oJ3ZlcmJvc2UnKTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgZnNQcm9taXNlcy5ta2RpcihkaXJuYW1lKHRoaXMuc3RhdHNPdXRwdXRQYXRoKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+XG4gICAgICAgICAgc3RyaW5naWZ5U3RyZWFtKGRhdGEpXG4gICAgICAgICAgICAucGlwZShjcmVhdGVXcml0ZVN0cmVhbSh0aGlzLnN0YXRzT3V0cHV0UGF0aCkpXG4gICAgICAgICAgICAub24oJ2Nsb3NlJywgcmVzb2x2ZSlcbiAgICAgICAgICAgIC5vbignZXJyb3InLCByZWplY3QpLFxuICAgICAgICApO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgYWRkRXJyb3IoXG4gICAgICAgICAgc3RhdHMuY29tcGlsYXRpb24sXG4gICAgICAgICAgYFVuYWJsZSB0byB3cml0ZSBzdGF0cyBmaWxlOiAke2Vycm9yLm1lc3NhZ2UgfHwgJ3Vua25vd24gZXJyb3InfWAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==