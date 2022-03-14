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
                if (core_1.types.isFunctionExpression(callee) && path.node.arguments.length !== 0) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVyZS10b3BsZXZlbC1mdW5jdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9iYWJlbC9wbHVnaW5zL3B1cmUtdG9wbGV2ZWwtZnVuY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHNDQUF5RDtBQUN6RCw2RkFBNEQ7QUFDNUQsNkNBQStCO0FBRS9COztHQUVHO0FBQ0gsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLENBQVMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBRTNGOzs7OztHQUtHO0FBQ0gsU0FBUyxpQkFBaUIsQ0FBQyxJQUFZO0lBQ3JDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDbEMsTUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRWxDLElBQUksU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQzVFLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFFRCxPQUFPLFlBQVksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDeEMsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSDtJQUNFLE9BQU87UUFDTCxPQUFPLEVBQUU7WUFDUCxjQUFjLENBQUMsSUFBb0M7Z0JBQ2pELCtEQUErRDtnQkFDL0QsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsRUFBRTtvQkFDNUIsT0FBTztpQkFDUjtnQkFFRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztnQkFDaEMsSUFBSSxZQUFLLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtvQkFDMUUsT0FBTztpQkFDUjtnQkFDRCx5RUFBeUU7Z0JBQ3pFLHlEQUF5RDtnQkFDekQsSUFBSSxZQUFLLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxJQUFJLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDaEUsT0FBTztpQkFDUjtnQkFFRCxJQUFBLGlDQUFjLEVBQUMsSUFBSSxDQUFDLENBQUM7WUFDdkIsQ0FBQztZQUNELGFBQWEsQ0FBQyxJQUFtQztnQkFDL0MsK0RBQStEO2dCQUMvRCxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLEVBQUU7b0JBQzdCLElBQUEsaUNBQWMsRUFBQyxJQUFJLENBQUMsQ0FBQztpQkFDdEI7WUFDSCxDQUFDO1NBQ0Y7S0FDRixDQUFDO0FBQ0osQ0FBQztBQTdCRCw0QkE2QkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgTm9kZVBhdGgsIFBsdWdpbk9iaiwgdHlwZXMgfSBmcm9tICdAYmFiZWwvY29yZSc7XG5pbXBvcnQgYW5ub3RhdGVBc1B1cmUgZnJvbSAnQGJhYmVsL2hlbHBlci1hbm5vdGF0ZS1hcy1wdXJlJztcbmltcG9ydCAqIGFzIHRzbGliIGZyb20gJ3RzbGliJztcblxuLyoqXG4gKiBBIGNhY2hlZCBzZXQgb2YgVHlwZVNjcmlwdCBoZWxwZXIgZnVuY3Rpb24gbmFtZXMgdXNlZCBieSB0aGUgaGVscGVyIG5hbWUgbWF0Y2hlciB1dGlsaXR5IGZ1bmN0aW9uLlxuICovXG5jb25zdCB0c2xpYkhlbHBlcnMgPSBuZXcgU2V0PHN0cmluZz4oT2JqZWN0LmtleXModHNsaWIpLmZpbHRlcigoaCkgPT4gaC5zdGFydHNXaXRoKCdfXycpKSk7XG5cbi8qKlxuICogRGV0ZXJtaW5hdGVzIHdoZXRoZXIgYW4gaWRlbnRpZmllciBuYW1lIG1hdGNoZXMgb25lIG9mIHRoZSBUeXBlU2NyaXB0IGhlbHBlciBmdW5jdGlvbiBuYW1lcy5cbiAqXG4gKiBAcGFyYW0gbmFtZSBUaGUgaWRlbnRpZmllciBuYW1lIHRvIGNoZWNrLlxuICogQHJldHVybnMgVHJ1ZSwgaWYgdGhlIG5hbWUgbWF0Y2hlcyBhIFR5cGVTY3JpcHQgaGVscGVyIG5hbWU7IG90aGVyd2lzZSwgZmFsc2UuXG4gKi9cbmZ1bmN0aW9uIGlzVHNsaWJIZWxwZXJOYW1lKG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCBuYW1lUGFydHMgPSBuYW1lLnNwbGl0KCckJyk7XG4gIGNvbnN0IG9yaWdpbmFsTmFtZSA9IG5hbWVQYXJ0c1swXTtcblxuICBpZiAobmFtZVBhcnRzLmxlbmd0aCA+IDIgfHwgKG5hbWVQYXJ0cy5sZW5ndGggPT09IDIgJiYgaXNOYU4oK25hbWVQYXJ0c1sxXSkpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRzbGliSGVscGVycy5oYXMob3JpZ2luYWxOYW1lKTtcbn1cblxuLyoqXG4gKiBBIGJhYmVsIHBsdWdpbiBmYWN0b3J5IGZ1bmN0aW9uIGZvciBhZGRpbmcgdGhlIFBVUkUgYW5ub3RhdGlvbiB0byB0b3AtbGV2ZWwgbmV3IGFuZCBjYWxsIGV4cHJlc3Npb25zLlxuICpcbiAqIEByZXR1cm5zIEEgYmFiZWwgcGx1Z2luIG9iamVjdCBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKCk6IFBsdWdpbk9iaiB7XG4gIHJldHVybiB7XG4gICAgdmlzaXRvcjoge1xuICAgICAgQ2FsbEV4cHJlc3Npb24ocGF0aDogTm9kZVBhdGg8dHlwZXMuQ2FsbEV4cHJlc3Npb24+KSB7XG4gICAgICAgIC8vIElmIHRoZSBleHByZXNzaW9uIGhhcyBhIGZ1bmN0aW9uIHBhcmVudCwgaXQgaXMgbm90IHRvcC1sZXZlbFxuICAgICAgICBpZiAocGF0aC5nZXRGdW5jdGlvblBhcmVudCgpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2FsbGVlID0gcGF0aC5ub2RlLmNhbGxlZTtcbiAgICAgICAgaWYgKHR5cGVzLmlzRnVuY3Rpb25FeHByZXNzaW9uKGNhbGxlZSkgJiYgcGF0aC5ub2RlLmFyZ3VtZW50cy5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gRG8gbm90IGFubm90YXRlIFR5cGVTY3JpcHQgaGVscGVycyBlbWl0dGVkIGJ5IHRoZSBUeXBlU2NyaXB0IGNvbXBpbGVyLlxuICAgICAgICAvLyBUeXBlU2NyaXB0IGhlbHBlcnMgYXJlIGludGVuZGVkIHRvIGNhdXNlIHNpZGUgZWZmZWN0cy5cbiAgICAgICAgaWYgKHR5cGVzLmlzSWRlbnRpZmllcihjYWxsZWUpICYmIGlzVHNsaWJIZWxwZXJOYW1lKGNhbGxlZS5uYW1lKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGFubm90YXRlQXNQdXJlKHBhdGgpO1xuICAgICAgfSxcbiAgICAgIE5ld0V4cHJlc3Npb24ocGF0aDogTm9kZVBhdGg8dHlwZXMuTmV3RXhwcmVzc2lvbj4pIHtcbiAgICAgICAgLy8gSWYgdGhlIGV4cHJlc3Npb24gaGFzIGEgZnVuY3Rpb24gcGFyZW50LCBpdCBpcyBub3QgdG9wLWxldmVsXG4gICAgICAgIGlmICghcGF0aC5nZXRGdW5jdGlvblBhcmVudCgpKSB7XG4gICAgICAgICAgYW5ub3RhdGVBc1B1cmUocGF0aCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==