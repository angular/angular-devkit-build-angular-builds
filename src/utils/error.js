"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertIsError = void 0;
const assert_1 = __importDefault(require("assert"));
function assertIsError(value) {
    (0, assert_1.default)(value instanceof Error, 'catch clause variable is not an Error instance');
}
exports.assertIsError = assertIsError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXJyb3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9lcnJvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFFSCxvREFBNEI7QUFFNUIsU0FBZ0IsYUFBYSxDQUFDLEtBQWM7SUFDMUMsSUFBQSxnQkFBTSxFQUFDLEtBQUssWUFBWSxLQUFLLEVBQUUsZ0RBQWdELENBQUMsQ0FBQztBQUNuRixDQUFDO0FBRkQsc0NBRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0SXNFcnJvcih2YWx1ZTogdW5rbm93bik6IGFzc2VydHMgdmFsdWUgaXMgRXJyb3IgJiB7IGNvZGU/OiBzdHJpbmcgfSB7XG4gIGFzc2VydCh2YWx1ZSBpbnN0YW5jZW9mIEVycm9yLCAnY2F0Y2ggY2xhdXNlIHZhcmlhYmxlIGlzIG5vdCBhbiBFcnJvciBpbnN0YW5jZScpO1xufVxuIl19