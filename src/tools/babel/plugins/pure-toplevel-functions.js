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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@babel/core");
const helper_annotate_as_pure_1 = __importDefault(require("@babel/helper-annotate-as-pure"));
const tslib = __importStar(require("tslib"));
/**
 * A cached set of TypeScript helper function names used by the helper name matcher utility function.
 */
const tslibHelpers = new Set(Object.keys(tslib).filter((h) => h.startsWith('__')));
/**
 * Determinates whether an identifier name matches one of the TypeScript helper function names.
 *
 * @param name The identifier name to check.
 * @returns True, if the name matches a TypeScript helper name; otherwise, false.
 */
function isTslibHelperName(name) {
    const nameParts = name.split('$');
    const originalName = nameParts[0];
    if (nameParts.length > 2 || (nameParts.length === 2 && isNaN(+nameParts[1]))) {
        return false;
    }
    return tslibHelpers.has(originalName);
}
/**
 * A babel plugin factory function for adding the PURE annotation to top-level new and call expressions.
 *
 * @returns A babel plugin object instance.
 */
function default_1() {
    return {
        visitor: {
            CallExpression(path) {
                // If the expression has a function parent, it is not top-level
                if (path.getFunctionParent()) {
                    return;
                }
                const callee = path.node.callee;
                if ((core_1.types.isFunctionExpression(callee) || core_1.types.isArrowFunctionExpression(callee)) &&
                    path.node.arguments.length !== 0) {
                    return;
                }
                // Do not annotate TypeScript helpers emitted by the TypeScript compiler.
                // TypeScript helpers are intended to cause side effects.
                if (core_1.types.isIdentifier(callee) && isTslibHelperName(callee.name)) {
                    return;
                }
                (0, helper_annotate_as_pure_1.default)(path);
            },
            NewExpression(path) {
                // If the expression has a function parent, it is not top-level
                if (!path.getFunctionParent()) {
                    (0, helper_annotate_as_pure_1.default)(path);
                }
            },
        },
    };
}
exports.default = default_1;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVyZS10b3BsZXZlbC1mdW5jdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9iYWJlbC9wbHVnaW5zL3B1cmUtdG9wbGV2ZWwtZnVuY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxzQ0FBeUQ7QUFDekQsNkZBQTREO0FBQzVELDZDQUErQjtBQUUvQjs7R0FFRztBQUNILE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxDQUFTLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUUzRjs7Ozs7R0FLRztBQUNILFNBQVMsaUJBQWlCLENBQUMsSUFBWTtJQUNyQyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sWUFBWSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUVsQyxJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtRQUM1RSxPQUFPLEtBQUssQ0FBQztLQUNkO0lBRUQsT0FBTyxZQUFZLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3hDLENBQUM7QUFFRDs7OztHQUlHO0FBQ0g7SUFDRSxPQUFPO1FBQ0wsT0FBTyxFQUFFO1lBQ1AsY0FBYyxDQUFDLElBQW9DO2dCQUNqRCwrREFBK0Q7Z0JBQy9ELElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFLEVBQUU7b0JBQzVCLE9BQU87aUJBQ1I7Z0JBRUQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7Z0JBQ2hDLElBQ0UsQ0FBQyxZQUFLLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLElBQUksWUFBSyxDQUFDLHlCQUF5QixDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUMvRSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUNoQztvQkFDQSxPQUFPO2lCQUNSO2dCQUNELHlFQUF5RTtnQkFDekUseURBQXlEO2dCQUN6RCxJQUFJLFlBQUssQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLElBQUksaUJBQWlCLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUNoRSxPQUFPO2lCQUNSO2dCQUVELElBQUEsaUNBQWMsRUFBQyxJQUFJLENBQUMsQ0FBQztZQUN2QixDQUFDO1lBQ0QsYUFBYSxDQUFDLElBQW1DO2dCQUMvQywrREFBK0Q7Z0JBQy9ELElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsRUFBRTtvQkFDN0IsSUFBQSxpQ0FBYyxFQUFDLElBQUksQ0FBQyxDQUFDO2lCQUN0QjtZQUNILENBQUM7U0FDRjtLQUNGLENBQUM7QUFDSixDQUFDO0FBaENELDRCQWdDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBOb2RlUGF0aCwgUGx1Z2luT2JqLCB0eXBlcyB9IGZyb20gJ0BiYWJlbC9jb3JlJztcbmltcG9ydCBhbm5vdGF0ZUFzUHVyZSBmcm9tICdAYmFiZWwvaGVscGVyLWFubm90YXRlLWFzLXB1cmUnO1xuaW1wb3J0ICogYXMgdHNsaWIgZnJvbSAndHNsaWInO1xuXG4vKipcbiAqIEEgY2FjaGVkIHNldCBvZiBUeXBlU2NyaXB0IGhlbHBlciBmdW5jdGlvbiBuYW1lcyB1c2VkIGJ5IHRoZSBoZWxwZXIgbmFtZSBtYXRjaGVyIHV0aWxpdHkgZnVuY3Rpb24uXG4gKi9cbmNvbnN0IHRzbGliSGVscGVycyA9IG5ldyBTZXQ8c3RyaW5nPihPYmplY3Qua2V5cyh0c2xpYikuZmlsdGVyKChoKSA9PiBoLnN0YXJ0c1dpdGgoJ19fJykpKTtcblxuLyoqXG4gKiBEZXRlcm1pbmF0ZXMgd2hldGhlciBhbiBpZGVudGlmaWVyIG5hbWUgbWF0Y2hlcyBvbmUgb2YgdGhlIFR5cGVTY3JpcHQgaGVscGVyIGZ1bmN0aW9uIG5hbWVzLlxuICpcbiAqIEBwYXJhbSBuYW1lIFRoZSBpZGVudGlmaWVyIG5hbWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyBUcnVlLCBpZiB0aGUgbmFtZSBtYXRjaGVzIGEgVHlwZVNjcmlwdCBoZWxwZXIgbmFtZTsgb3RoZXJ3aXNlLCBmYWxzZS5cbiAqL1xuZnVuY3Rpb24gaXNUc2xpYkhlbHBlck5hbWUobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IG5hbWVQYXJ0cyA9IG5hbWUuc3BsaXQoJyQnKTtcbiAgY29uc3Qgb3JpZ2luYWxOYW1lID0gbmFtZVBhcnRzWzBdO1xuXG4gIGlmIChuYW1lUGFydHMubGVuZ3RoID4gMiB8fCAobmFtZVBhcnRzLmxlbmd0aCA9PT0gMiAmJiBpc05hTigrbmFtZVBhcnRzWzFdKSkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHNsaWJIZWxwZXJzLmhhcyhvcmlnaW5hbE5hbWUpO1xufVxuXG4vKipcbiAqIEEgYmFiZWwgcGx1Z2luIGZhY3RvcnkgZnVuY3Rpb24gZm9yIGFkZGluZyB0aGUgUFVSRSBhbm5vdGF0aW9uIHRvIHRvcC1sZXZlbCBuZXcgYW5kIGNhbGwgZXhwcmVzc2lvbnMuXG4gKlxuICogQHJldHVybnMgQSBiYWJlbCBwbHVnaW4gb2JqZWN0IGluc3RhbmNlLlxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoKTogUGx1Z2luT2JqIHtcbiAgcmV0dXJuIHtcbiAgICB2aXNpdG9yOiB7XG4gICAgICBDYWxsRXhwcmVzc2lvbihwYXRoOiBOb2RlUGF0aDx0eXBlcy5DYWxsRXhwcmVzc2lvbj4pIHtcbiAgICAgICAgLy8gSWYgdGhlIGV4cHJlc3Npb24gaGFzIGEgZnVuY3Rpb24gcGFyZW50LCBpdCBpcyBub3QgdG9wLWxldmVsXG4gICAgICAgIGlmIChwYXRoLmdldEZ1bmN0aW9uUGFyZW50KCkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjYWxsZWUgPSBwYXRoLm5vZGUuY2FsbGVlO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgKHR5cGVzLmlzRnVuY3Rpb25FeHByZXNzaW9uKGNhbGxlZSkgfHwgdHlwZXMuaXNBcnJvd0Z1bmN0aW9uRXhwcmVzc2lvbihjYWxsZWUpKSAmJlxuICAgICAgICAgIHBhdGgubm9kZS5hcmd1bWVudHMubGVuZ3RoICE9PSAwXG4gICAgICAgICkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBEbyBub3QgYW5ub3RhdGUgVHlwZVNjcmlwdCBoZWxwZXJzIGVtaXR0ZWQgYnkgdGhlIFR5cGVTY3JpcHQgY29tcGlsZXIuXG4gICAgICAgIC8vIFR5cGVTY3JpcHQgaGVscGVycyBhcmUgaW50ZW5kZWQgdG8gY2F1c2Ugc2lkZSBlZmZlY3RzLlxuICAgICAgICBpZiAodHlwZXMuaXNJZGVudGlmaWVyKGNhbGxlZSkgJiYgaXNUc2xpYkhlbHBlck5hbWUoY2FsbGVlLm5hbWUpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYW5ub3RhdGVBc1B1cmUocGF0aCk7XG4gICAgICB9LFxuICAgICAgTmV3RXhwcmVzc2lvbihwYXRoOiBOb2RlUGF0aDx0eXBlcy5OZXdFeHByZXNzaW9uPikge1xuICAgICAgICAvLyBJZiB0aGUgZXhwcmVzc2lvbiBoYXMgYSBmdW5jdGlvbiBwYXJlbnQsIGl0IGlzIG5vdCB0b3AtbGV2ZWxcbiAgICAgICAgaWYgKCFwYXRoLmdldEZ1bmN0aW9uUGFyZW50KCkpIHtcbiAgICAgICAgICBhbm5vdGF0ZUFzUHVyZShwYXRoKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9LFxuICB9O1xufVxuIl19