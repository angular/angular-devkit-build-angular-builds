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
exports.colors = exports.removeColor = void 0;
const ansiColors = __importStar(require("ansi-colors"));
const tty_1 = require("tty");
function supportColor() {
    if (process.env.FORCE_COLOR !== undefined) {
        // 2 colors: FORCE_COLOR = 0 (Disables colors), depth 1
        // 16 colors: FORCE_COLOR = 1, depth 4
        // 256 colors: FORCE_COLOR = 2, depth 8
        // 16,777,216 colors: FORCE_COLOR = 3, depth 16
        // See: https://nodejs.org/dist/latest-v12.x/docs/api/tty.html#tty_writestream_getcolordepth_env
        // and https://github.com/nodejs/node/blob/b9f36062d7b5c5039498e98d2f2c180dca2a7065/lib/internal/tty.js#L106;
        switch (process.env.FORCE_COLOR) {
            case '':
            case 'true':
            case '1':
            case '2':
            case '3':
                return true;
            default:
                return false;
        }
    }
    if (process.stdout instanceof tty_1.WriteStream) {
        return process.stdout.getColorDepth() > 1;
    }
    return false;
}
function removeColor(text) {
    // This has been created because when colors.enabled is false unstyle doesn't work
    // see: https://github.com/doowb/ansi-colors/blob/a4794363369d7b4d1872d248fc43a12761640d8e/index.js#L38
    return text.replace(ansiColors.ansiRegex, '');
}
exports.removeColor = removeColor;
// Create a separate instance to prevent unintended global changes to the color configuration
// Create function is not defined in the typings. See: https://github.com/doowb/ansi-colors/pull/44
const colors = ansiColors.create();
exports.colors = colors;
colors.enabled = supportColor();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29sb3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9jb2xvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsd0RBQTBDO0FBQzFDLDZCQUFrQztBQUlsQyxTQUFTLFlBQVk7SUFDbkIsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsS0FBSyxTQUFTLEVBQUU7UUFDekMsdURBQXVEO1FBQ3ZELHNDQUFzQztRQUN0Qyx1Q0FBdUM7UUFDdkMsK0NBQStDO1FBQy9DLGdHQUFnRztRQUNoRyw2R0FBNkc7UUFDN0csUUFBUSxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRTtZQUMvQixLQUFLLEVBQUUsQ0FBQztZQUNSLEtBQUssTUFBTSxDQUFDO1lBQ1osS0FBSyxHQUFHLENBQUM7WUFDVCxLQUFLLEdBQUcsQ0FBQztZQUNULEtBQUssR0FBRztnQkFDTixPQUFPLElBQUksQ0FBQztZQUNkO2dCQUNFLE9BQU8sS0FBSyxDQUFDO1NBQ2hCO0tBQ0Y7SUFFRCxJQUFJLE9BQU8sQ0FBQyxNQUFNLFlBQVksaUJBQVcsRUFBRTtRQUN6QyxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0tBQzNDO0lBRUQsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBRUQsU0FBZ0IsV0FBVyxDQUFDLElBQVk7SUFDdEMsa0ZBQWtGO0lBQ2xGLHVHQUF1RztJQUN2RyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNoRCxDQUFDO0FBSkQsa0NBSUM7QUFFRCw2RkFBNkY7QUFDN0YsbUdBQW1HO0FBQ25HLE1BQU0sTUFBTSxHQUFJLFVBQXdELENBQUMsTUFBTSxFQUFFLENBQUM7QUFHekUsd0JBQU07QUFGZixNQUFNLENBQUMsT0FBTyxHQUFHLFlBQVksRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGFuc2lDb2xvcnMgZnJvbSAnYW5zaS1jb2xvcnMnO1xuaW1wb3J0IHsgV3JpdGVTdHJlYW0gfSBmcm9tICd0dHknO1xuXG50eXBlIEFuc2lDb2xvcnMgPSB0eXBlb2YgYW5zaUNvbG9ycztcblxuZnVuY3Rpb24gc3VwcG9ydENvbG9yKCk6IGJvb2xlYW4ge1xuICBpZiAocHJvY2Vzcy5lbnYuRk9SQ0VfQ09MT1IgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIDIgY29sb3JzOiBGT1JDRV9DT0xPUiA9IDAgKERpc2FibGVzIGNvbG9ycyksIGRlcHRoIDFcbiAgICAvLyAxNiBjb2xvcnM6IEZPUkNFX0NPTE9SID0gMSwgZGVwdGggNFxuICAgIC8vIDI1NiBjb2xvcnM6IEZPUkNFX0NPTE9SID0gMiwgZGVwdGggOFxuICAgIC8vIDE2LDc3NywyMTYgY29sb3JzOiBGT1JDRV9DT0xPUiA9IDMsIGRlcHRoIDE2XG4gICAgLy8gU2VlOiBodHRwczovL25vZGVqcy5vcmcvZGlzdC9sYXRlc3QtdjEyLngvZG9jcy9hcGkvdHR5Lmh0bWwjdHR5X3dyaXRlc3RyZWFtX2dldGNvbG9yZGVwdGhfZW52XG4gICAgLy8gYW5kIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9ibG9iL2I5ZjM2MDYyZDdiNWM1MDM5NDk4ZTk4ZDJmMmMxODBkY2EyYTcwNjUvbGliL2ludGVybmFsL3R0eS5qcyNMMTA2O1xuICAgIHN3aXRjaCAocHJvY2Vzcy5lbnYuRk9SQ0VfQ09MT1IpIHtcbiAgICAgIGNhc2UgJyc6XG4gICAgICBjYXNlICd0cnVlJzpcbiAgICAgIGNhc2UgJzEnOlxuICAgICAgY2FzZSAnMic6XG4gICAgICBjYXNlICczJzpcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgaWYgKHByb2Nlc3Muc3Rkb3V0IGluc3RhbmNlb2YgV3JpdGVTdHJlYW0pIHtcbiAgICByZXR1cm4gcHJvY2Vzcy5zdGRvdXQuZ2V0Q29sb3JEZXB0aCgpID4gMTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZUNvbG9yKHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIFRoaXMgaGFzIGJlZW4gY3JlYXRlZCBiZWNhdXNlIHdoZW4gY29sb3JzLmVuYWJsZWQgaXMgZmFsc2UgdW5zdHlsZSBkb2Vzbid0IHdvcmtcbiAgLy8gc2VlOiBodHRwczovL2dpdGh1Yi5jb20vZG9vd2IvYW5zaS1jb2xvcnMvYmxvYi9hNDc5NDM2MzM2OWQ3YjRkMTg3MmQyNDhmYzQzYTEyNzYxNjQwZDhlL2luZGV4LmpzI0wzOFxuICByZXR1cm4gdGV4dC5yZXBsYWNlKGFuc2lDb2xvcnMuYW5zaVJlZ2V4LCAnJyk7XG59XG5cbi8vIENyZWF0ZSBhIHNlcGFyYXRlIGluc3RhbmNlIHRvIHByZXZlbnQgdW5pbnRlbmRlZCBnbG9iYWwgY2hhbmdlcyB0byB0aGUgY29sb3IgY29uZmlndXJhdGlvblxuLy8gQ3JlYXRlIGZ1bmN0aW9uIGlzIG5vdCBkZWZpbmVkIGluIHRoZSB0eXBpbmdzLiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9kb293Yi9hbnNpLWNvbG9ycy9wdWxsLzQ0XG5jb25zdCBjb2xvcnMgPSAoYW5zaUNvbG9ycyBhcyBBbnNpQ29sb3JzICYgeyBjcmVhdGU6ICgpID0+IEFuc2lDb2xvcnMgfSkuY3JlYXRlKCk7XG5jb2xvcnMuZW5hYmxlZCA9IHN1cHBvcnRDb2xvcigpO1xuXG5leHBvcnQgeyBjb2xvcnMgfTtcbiJdfQ==