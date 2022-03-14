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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvbi1zdGF0cy1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3BsdWdpbnMvanNvbi1zdGF0cy1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCwyQkFBK0Q7QUFDL0QsK0JBQStCO0FBRy9CLHlFQUEyRDtBQUUzRCxNQUFhLGVBQWU7SUFDMUIsWUFBNkIsZUFBdUI7UUFBdkIsb0JBQWUsR0FBZixlQUFlLENBQVE7SUFBRyxDQUFDO0lBRXhELEtBQUssQ0FBQyxRQUFrQjtRQUN0QixRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsb0JBQW9CLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQ25FLE1BQU0sRUFBRSxlQUFlLEVBQUUsR0FBRyx3REFBYSx1QkFBdUIsR0FBQyxDQUFDO1lBQ2xFLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFckMsSUFBSTtnQkFDRixNQUFNLGFBQVUsQ0FBQyxLQUFLLENBQUMsSUFBQSxjQUFPLEVBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7Z0JBQzNFLE1BQU0sSUFBSSxPQUFPLENBQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FDMUMsZUFBZSxDQUFDLElBQUksQ0FBQztxQkFDbEIsSUFBSSxDQUFDLElBQUEsc0JBQWlCLEVBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO3FCQUM3QyxFQUFFLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQztxQkFDcEIsRUFBRSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FDdkIsQ0FBQzthQUNIO1lBQUMsT0FBTyxLQUFLLEVBQUU7Z0JBQ2QsSUFBQSw4QkFBUSxFQUNOLEtBQUssQ0FBQyxXQUFXLEVBQ2pCLCtCQUErQixLQUFLLENBQUMsT0FBTyxJQUFJLGVBQWUsRUFBRSxDQUNsRSxDQUFDO2FBQ0g7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXhCRCwwQ0F3QkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgY3JlYXRlV3JpdGVTdHJlYW0sIHByb21pc2VzIGFzIGZzUHJvbWlzZXMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBkaXJuYW1lIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDb21waWxlciB9IGZyb20gJ3dlYnBhY2snO1xuXG5pbXBvcnQgeyBhZGRFcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL3dlYnBhY2stZGlhZ25vc3RpY3MnO1xuXG5leHBvcnQgY2xhc3MgSnNvblN0YXRzUGx1Z2luIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBzdGF0c091dHB1dFBhdGg6IHN0cmluZykge31cblxuICBhcHBseShjb21waWxlcjogQ29tcGlsZXIpIHtcbiAgICBjb21waWxlci5ob29rcy5kb25lLnRhcFByb21pc2UoJ2FuZ3VsYXItanNvbi1zdGF0cycsIGFzeW5jIChzdGF0cykgPT4ge1xuICAgICAgY29uc3QgeyBzdHJpbmdpZnlTdHJlYW0gfSA9IGF3YWl0IGltcG9ydCgnQGRpc2NvdmVyeWpzL2pzb24tZXh0Jyk7XG4gICAgICBjb25zdCBkYXRhID0gc3RhdHMudG9Kc29uKCd2ZXJib3NlJyk7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGZzUHJvbWlzZXMubWtkaXIoZGlybmFtZSh0aGlzLnN0YXRzT3V0cHV0UGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PlxuICAgICAgICAgIHN0cmluZ2lmeVN0cmVhbShkYXRhKVxuICAgICAgICAgICAgLnBpcGUoY3JlYXRlV3JpdGVTdHJlYW0odGhpcy5zdGF0c091dHB1dFBhdGgpKVxuICAgICAgICAgICAgLm9uKCdjbG9zZScsIHJlc29sdmUpXG4gICAgICAgICAgICAub24oJ2Vycm9yJywgcmVqZWN0KSxcbiAgICAgICAgKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGFkZEVycm9yKFxuICAgICAgICAgIHN0YXRzLmNvbXBpbGF0aW9uLFxuICAgICAgICAgIGBVbmFibGUgdG8gd3JpdGUgc3RhdHMgZmlsZTogJHtlcnJvci5tZXNzYWdlIHx8ICd1bmtub3duIGVycm9yJ31gLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG4iXX0=