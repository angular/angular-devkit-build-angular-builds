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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeNgPackagrBuilder = exports.executeServerBuilder = exports.executeProtractorBuilder = exports.executeKarmaBuilder = exports.executeExtractI18nBuilder = exports.executeDevServerBuilder = exports.executeBrowserBuilder = exports.Type = exports.OutputHashing = exports.CrossOrigin = void 0;
__exportStar(require("./transforms"), exports);
var schema_1 = require("./builders/browser/schema");
Object.defineProperty(exports, "CrossOrigin", { enumerable: true, get: function () { return schema_1.CrossOrigin; } });
Object.defineProperty(exports, "OutputHashing", { enumerable: true, get: function () { return schema_1.OutputHashing; } });
Object.defineProperty(exports, "Type", { enumerable: true, get: function () { return schema_1.Type; } });
var browser_1 = require("./builders/browser");
Object.defineProperty(exports, "executeBrowserBuilder", { enumerable: true, get: function () { return browser_1.buildWebpackBrowser; } });
var dev_server_1 = require("./builders/dev-server");
Object.defineProperty(exports, "executeDevServerBuilder", { enumerable: true, get: function () { return dev_server_1.serveWebpackBrowser; } });
var extract_i18n_1 = require("./builders/extract-i18n");
Object.defineProperty(exports, "executeExtractI18nBuilder", { enumerable: true, get: function () { return extract_i18n_1.execute; } });
var karma_1 = require("./builders/karma");
Object.defineProperty(exports, "executeKarmaBuilder", { enumerable: true, get: function () { return karma_1.execute; } });
var protractor_1 = require("./builders/protractor");
Object.defineProperty(exports, "executeProtractorBuilder", { enumerable: true, get: function () { return protractor_1.execute; } });
var server_1 = require("./builders/server");
Object.defineProperty(exports, "executeServerBuilder", { enumerable: true, get: function () { return server_1.execute; } });
var ng_packagr_1 = require("./builders/ng-packagr");
Object.defineProperty(exports, "executeNgPackagrBuilder", { enumerable: true, get: function () { return ng_packagr_1.execute; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0FBRUgsK0NBQTZCO0FBRTdCLG9EQWdCbUM7QUFaakMscUdBQUEsV0FBVyxPQUFBO0FBTVgsdUdBQUEsYUFBYSxPQUFBO0FBS2IsOEZBQUEsSUFBSSxPQUFBO0FBR04sOENBRzRCO0FBRjFCLGdIQUFBLG1CQUFtQixPQUF5QjtBQUk5QyxvREFJK0I7QUFIN0IscUhBQUEsbUJBQW1CLE9BQTJCO0FBS2hELHdEQUdpQztBQUYvQix5SEFBQSxPQUFPLE9BQTZCO0FBSXRDLDBDQUkwQjtBQUh4Qiw0R0FBQSxPQUFPLE9BQXVCO0FBS2hDLG9EQUcrQjtBQUY3QixzSEFBQSxPQUFPLE9BQTRCO0FBSXJDLDRDQUkyQjtBQUh6Qiw4R0FBQSxPQUFPLE9BQXdCO0FBS2pDLG9EQUFvRztBQUEzRixxSEFBQSxPQUFPLE9BQTJCIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmV4cG9ydCAqIGZyb20gJy4vdHJhbnNmb3Jtcyc7XG5cbmV4cG9ydCB7XG4gIEFzc2V0UGF0dGVybixcbiAgQXNzZXRQYXR0ZXJuQ2xhc3MgYXMgQXNzZXRQYXR0ZXJuT2JqZWN0LFxuICBCdWRnZXQsXG4gIENyb3NzT3JpZ2luLFxuICBFeHRyYUVudHJ5UG9pbnQsXG4gIEV4dHJhRW50cnlQb2ludENsYXNzIGFzIEV4dHJhRW50cnlQb2ludE9iamVjdCxcbiAgRmlsZVJlcGxhY2VtZW50LFxuICBPcHRpbWl6YXRpb25DbGFzcyBhcyBPcHRpbWl6YXRpb25PYmplY3QsXG4gIE9wdGltaXphdGlvblVuaW9uLFxuICBPdXRwdXRIYXNoaW5nLFxuICBTY2hlbWEgYXMgQnJvd3NlckJ1aWxkZXJPcHRpb25zLFxuICBTb3VyY2VNYXBDbGFzcyBhcyBTb3VyY2VNYXBPYmplY3QsXG4gIFNvdXJjZU1hcFVuaW9uLFxuICBTdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMsXG4gIFR5cGUsXG59IGZyb20gJy4vYnVpbGRlcnMvYnJvd3Nlci9zY2hlbWEnO1xuXG5leHBvcnQge1xuICBidWlsZFdlYnBhY2tCcm93c2VyIGFzIGV4ZWN1dGVCcm93c2VyQnVpbGRlcixcbiAgQnJvd3NlckJ1aWxkZXJPdXRwdXQsXG59IGZyb20gJy4vYnVpbGRlcnMvYnJvd3Nlcic7XG5cbmV4cG9ydCB7XG4gIHNlcnZlV2VicGFja0Jyb3dzZXIgYXMgZXhlY3V0ZURldlNlcnZlckJ1aWxkZXIsXG4gIERldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICBEZXZTZXJ2ZXJCdWlsZGVyT3V0cHV0LFxufSBmcm9tICcuL2J1aWxkZXJzL2Rldi1zZXJ2ZXInO1xuXG5leHBvcnQge1xuICBleGVjdXRlIGFzIGV4ZWN1dGVFeHRyYWN0STE4bkJ1aWxkZXIsXG4gIEV4dHJhY3RJMThuQnVpbGRlck9wdGlvbnMsXG59IGZyb20gJy4vYnVpbGRlcnMvZXh0cmFjdC1pMThuJztcblxuZXhwb3J0IHtcbiAgZXhlY3V0ZSBhcyBleGVjdXRlS2FybWFCdWlsZGVyLFxuICBLYXJtYUJ1aWxkZXJPcHRpb25zLFxuICBLYXJtYUNvbmZpZ09wdGlvbnMsXG59IGZyb20gJy4vYnVpbGRlcnMva2FybWEnO1xuXG5leHBvcnQge1xuICBleGVjdXRlIGFzIGV4ZWN1dGVQcm90cmFjdG9yQnVpbGRlcixcbiAgUHJvdHJhY3RvckJ1aWxkZXJPcHRpb25zLFxufSBmcm9tICcuL2J1aWxkZXJzL3Byb3RyYWN0b3InO1xuXG5leHBvcnQge1xuICBleGVjdXRlIGFzIGV4ZWN1dGVTZXJ2ZXJCdWlsZGVyLFxuICBTZXJ2ZXJCdWlsZGVyT3B0aW9ucyxcbiAgU2VydmVyQnVpbGRlck91dHB1dCxcbn0gZnJvbSAnLi9idWlsZGVycy9zZXJ2ZXInO1xuXG5leHBvcnQgeyBleGVjdXRlIGFzIGV4ZWN1dGVOZ1BhY2thZ3JCdWlsZGVyLCBOZ1BhY2thZ3JCdWlsZGVyT3B0aW9ucyB9IGZyb20gJy4vYnVpbGRlcnMvbmctcGFja2Fncic7XG4iXX0=