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
const colors = ansiColors.create();
exports.colors = colors;
colors.enabled = supportColor();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29sb3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy91dGlscy9jb2xvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHdEQUEwQztBQUMxQyw2QkFBa0M7QUFJbEMsU0FBUyxZQUFZO0lBQ25CLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEtBQUssU0FBUyxFQUFFO1FBQ3pDLHVEQUF1RDtRQUN2RCxzQ0FBc0M7UUFDdEMsdUNBQXVDO1FBQ3ZDLCtDQUErQztRQUMvQyxnR0FBZ0c7UUFDaEcsNkdBQTZHO1FBQzdHLFFBQVEsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUU7WUFDL0IsS0FBSyxFQUFFLENBQUM7WUFDUixLQUFLLE1BQU0sQ0FBQztZQUNaLEtBQUssR0FBRyxDQUFDO1lBQ1QsS0FBSyxHQUFHLENBQUM7WUFDVCxLQUFLLEdBQUc7Z0JBQ04sT0FBTyxJQUFJLENBQUM7WUFDZDtnQkFDRSxPQUFPLEtBQUssQ0FBQztTQUNoQjtLQUNGO0lBRUQsSUFBSSxPQUFPLENBQUMsTUFBTSxZQUFZLGlCQUFXLEVBQUU7UUFDekMsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLGFBQWEsRUFBRSxHQUFHLENBQUMsQ0FBQztLQUMzQztJQUVELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVELFNBQWdCLFdBQVcsQ0FBQyxJQUFZO0lBQ3RDLGtGQUFrRjtJQUNsRix1R0FBdUc7SUFDdkcsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDaEQsQ0FBQztBQUpELGtDQUlDO0FBRUQsNkZBQTZGO0FBQzdGLE1BQU0sTUFBTSxHQUFHLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUcxQix3QkFBTTtBQUZmLE1BQU0sQ0FBQyxPQUFPLEdBQUcsWUFBWSxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgYW5zaUNvbG9ycyBmcm9tICdhbnNpLWNvbG9ycyc7XG5pbXBvcnQgeyBXcml0ZVN0cmVhbSB9IGZyb20gJ3R0eSc7XG5cbnR5cGUgQW5zaUNvbG9ycyA9IHR5cGVvZiBhbnNpQ29sb3JzO1xuXG5mdW5jdGlvbiBzdXBwb3J0Q29sb3IoKTogYm9vbGVhbiB7XG4gIGlmIChwcm9jZXNzLmVudi5GT1JDRV9DT0xPUiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgLy8gMiBjb2xvcnM6IEZPUkNFX0NPTE9SID0gMCAoRGlzYWJsZXMgY29sb3JzKSwgZGVwdGggMVxuICAgIC8vIDE2IGNvbG9yczogRk9SQ0VfQ09MT1IgPSAxLCBkZXB0aCA0XG4gICAgLy8gMjU2IGNvbG9yczogRk9SQ0VfQ09MT1IgPSAyLCBkZXB0aCA4XG4gICAgLy8gMTYsNzc3LDIxNiBjb2xvcnM6IEZPUkNFX0NPTE9SID0gMywgZGVwdGggMTZcbiAgICAvLyBTZWU6IGh0dHBzOi8vbm9kZWpzLm9yZy9kaXN0L2xhdGVzdC12MTIueC9kb2NzL2FwaS90dHkuaHRtbCN0dHlfd3JpdGVzdHJlYW1fZ2V0Y29sb3JkZXB0aF9lbnZcbiAgICAvLyBhbmQgaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2Jsb2IvYjlmMzYwNjJkN2I1YzUwMzk0OThlOThkMmYyYzE4MGRjYTJhNzA2NS9saWIvaW50ZXJuYWwvdHR5LmpzI0wxMDY7XG4gICAgc3dpdGNoIChwcm9jZXNzLmVudi5GT1JDRV9DT0xPUikge1xuICAgICAgY2FzZSAnJzpcbiAgICAgIGNhc2UgJ3RydWUnOlxuICAgICAgY2FzZSAnMSc6XG4gICAgICBjYXNlICcyJzpcbiAgICAgIGNhc2UgJzMnOlxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBpZiAocHJvY2Vzcy5zdGRvdXQgaW5zdGFuY2VvZiBXcml0ZVN0cmVhbSkge1xuICAgIHJldHVybiBwcm9jZXNzLnN0ZG91dC5nZXRDb2xvckRlcHRoKCkgPiAxO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlQ29sb3IodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gVGhpcyBoYXMgYmVlbiBjcmVhdGVkIGJlY2F1c2Ugd2hlbiBjb2xvcnMuZW5hYmxlZCBpcyBmYWxzZSB1bnN0eWxlIGRvZXNuJ3Qgd29ya1xuICAvLyBzZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9kb293Yi9hbnNpLWNvbG9ycy9ibG9iL2E0Nzk0MzYzMzY5ZDdiNGQxODcyZDI0OGZjNDNhMTI3NjE2NDBkOGUvaW5kZXguanMjTDM4XG4gIHJldHVybiB0ZXh0LnJlcGxhY2UoYW5zaUNvbG9ycy5hbnNpUmVnZXgsICcnKTtcbn1cblxuLy8gQ3JlYXRlIGEgc2VwYXJhdGUgaW5zdGFuY2UgdG8gcHJldmVudCB1bmludGVuZGVkIGdsb2JhbCBjaGFuZ2VzIHRvIHRoZSBjb2xvciBjb25maWd1cmF0aW9uXG5jb25zdCBjb2xvcnMgPSBhbnNpQ29sb3JzLmNyZWF0ZSgpO1xuY29sb3JzLmVuYWJsZWQgPSBzdXBwb3J0Q29sb3IoKTtcblxuZXhwb3J0IHsgY29sb3JzIH07XG4iXX0=