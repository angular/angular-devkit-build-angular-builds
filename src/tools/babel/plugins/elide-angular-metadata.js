"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKeywords = void 0;
const core_1 = require("@babel/core");
/**
 * The name of the Angular class metadata function created by the Angular compiler.
 */
const SET_CLASS_METADATA_NAME = 'ɵsetClassMetadata';
/**
 * Name of the asynchronous Angular class metadata function created by the Angular compiler.
 */
const SET_CLASS_METADATA_ASYNC_NAME = 'ɵsetClassMetadataAsync';
/**
 * Provides one or more keywords that if found within the content of a source file indicate
 * that this plugin should be used with a source file.
 *
 * @returns An a string iterable containing one or more keywords.
 */
function getKeywords() {
    return [SET_CLASS_METADATA_NAME, SET_CLASS_METADATA_ASYNC_NAME];
}
exports.getKeywords = getKeywords;
/**
 * A babel plugin factory function for eliding the Angular class metadata function (`ɵsetClassMetadata`).
 *
 * @returns A babel plugin object instance.
 */
function default_1() {
    return {
        visitor: {
            CallExpression(path) {
                const callee = path.node.callee;
                const callArguments = path.node.arguments;
                // The function being called must be the metadata function name
                let calleeName;
                if (core_1.types.isMemberExpression(callee) && core_1.types.isIdentifier(callee.property)) {
                    calleeName = callee.property.name;
                }
                else if (core_1.types.isIdentifier(callee)) {
                    calleeName = callee.name;
                }
                if (calleeName !== undefined &&
                    (isRemoveClassMetadataCall(calleeName, callArguments) ||
                        isRemoveClassmetadataAsyncCall(calleeName, callArguments))) {
                    // The metadata function is always emitted inside a function expression
                    const parent = path.getFunctionParent();
                    if (parent && (parent.isFunctionExpression() || parent.isArrowFunctionExpression())) {
                        // Replace the metadata function with `void 0` which is the equivalent return value
                        // of the metadata function.
                        path.replaceWith(path.scope.buildUndefinedNode());
                    }
                }
            },
        },
    };
}
exports.default = default_1;
/** Determines if a function call is a call to `setClassMetadata`. */
function isRemoveClassMetadataCall(name, args) {
    // `setClassMetadata` calls have to meet the following criteria:
    // * First must be an identifier
    // * Second must be an array literal
    return (name === SET_CLASS_METADATA_NAME &&
        args.length === 4 &&
        core_1.types.isIdentifier(args[0]) &&
        core_1.types.isArrayExpression(args[1]));
}
/** Determines if a function call is a call to `setClassMetadataAsync`. */
function isRemoveClassmetadataAsyncCall(name, args) {
    // `setClassMetadataAsync` calls have to meet the following criteria:
    // * First argument must be an identifier.
    // * Second argument must be an inline function.
    // * Third argument must be an inline function.
    return (name === SET_CLASS_METADATA_ASYNC_NAME &&
        args.length === 3 &&
        core_1.types.isIdentifier(args[0]) &&
        isInlineFunction(args[1]) &&
        isInlineFunction(args[2]));
}
/** Determines if a node is an inline function expression. */
function isInlineFunction(node) {
    return core_1.types.isFunctionExpression(node) || core_1.types.isArrowFunctionExpression(node);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWxpZGUtYW5ndWxhci1tZXRhZGF0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3Rvb2xzL2JhYmVsL3BsdWdpbnMvZWxpZGUtYW5ndWxhci1tZXRhZGF0YS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCxzQ0FBeUQ7QUFFekQ7O0dBRUc7QUFDSCxNQUFNLHVCQUF1QixHQUFHLG1CQUFtQixDQUFDO0FBRXBEOztHQUVHO0FBQ0gsTUFBTSw2QkFBNkIsR0FBRyx3QkFBd0IsQ0FBQztBQUUvRDs7Ozs7R0FLRztBQUNILFNBQWdCLFdBQVc7SUFDekIsT0FBTyxDQUFDLHVCQUF1QixFQUFFLDZCQUE2QixDQUFDLENBQUM7QUFDbEUsQ0FBQztBQUZELGtDQUVDO0FBRUQ7Ozs7R0FJRztBQUNIO0lBQ0UsT0FBTztRQUNMLE9BQU8sRUFBRTtZQUNQLGNBQWMsQ0FBQyxJQUFvQztnQkFDakQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7Z0JBQ2hDLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUUxQywrREFBK0Q7Z0JBQy9ELElBQUksVUFBVSxDQUFDO2dCQUNmLElBQUksWUFBSyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxJQUFJLFlBQUssQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFO29CQUMzRSxVQUFVLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUM7aUJBQ25DO3FCQUFNLElBQUksWUFBSyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRTtvQkFDckMsVUFBVSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7aUJBQzFCO2dCQUVELElBQ0UsVUFBVSxLQUFLLFNBQVM7b0JBQ3hCLENBQUMseUJBQXlCLENBQUMsVUFBVSxFQUFFLGFBQWEsQ0FBQzt3QkFDbkQsOEJBQThCLENBQUMsVUFBVSxFQUFFLGFBQWEsQ0FBQyxDQUFDLEVBQzVEO29CQUNBLHVFQUF1RTtvQkFDdkUsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7b0JBRXhDLElBQUksTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLG9CQUFvQixFQUFFLElBQUksTUFBTSxDQUFDLHlCQUF5QixFQUFFLENBQUMsRUFBRTt3QkFDbkYsbUZBQW1GO3dCQUNuRiw0QkFBNEI7d0JBQzVCLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUM7cUJBQ25EO2lCQUNGO1lBQ0gsQ0FBQztTQUNGO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFoQ0QsNEJBZ0NDO0FBRUQscUVBQXFFO0FBQ3JFLFNBQVMseUJBQXlCLENBQUMsSUFBWSxFQUFFLElBQXVDO0lBQ3RGLGdFQUFnRTtJQUNoRSxnQ0FBZ0M7SUFDaEMsb0NBQW9DO0lBQ3BDLE9BQU8sQ0FDTCxJQUFJLEtBQUssdUJBQXVCO1FBQ2hDLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQztRQUNqQixZQUFLLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMzQixZQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQ2pDLENBQUM7QUFDSixDQUFDO0FBRUQsMEVBQTBFO0FBQzFFLFNBQVMsOEJBQThCLENBQ3JDLElBQVksRUFDWixJQUF1QztJQUV2QyxxRUFBcUU7SUFDckUsMENBQTBDO0lBQzFDLGdEQUFnRDtJQUNoRCwrQ0FBK0M7SUFDL0MsT0FBTyxDQUNMLElBQUksS0FBSyw2QkFBNkI7UUFDdEMsSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDO1FBQ2pCLFlBQUssQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzNCLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN6QixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FDMUIsQ0FBQztBQUNKLENBQUM7QUFFRCw2REFBNkQ7QUFDN0QsU0FBUyxnQkFBZ0IsQ0FBQyxJQUFnQjtJQUN4QyxPQUFPLFlBQUssQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxZQUFLLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbkYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBOb2RlUGF0aCwgUGx1Z2luT2JqLCB0eXBlcyB9IGZyb20gJ0BiYWJlbC9jb3JlJztcblxuLyoqXG4gKiBUaGUgbmFtZSBvZiB0aGUgQW5ndWxhciBjbGFzcyBtZXRhZGF0YSBmdW5jdGlvbiBjcmVhdGVkIGJ5IHRoZSBBbmd1bGFyIGNvbXBpbGVyLlxuICovXG5jb25zdCBTRVRfQ0xBU1NfTUVUQURBVEFfTkFNRSA9ICfJtXNldENsYXNzTWV0YWRhdGEnO1xuXG4vKipcbiAqIE5hbWUgb2YgdGhlIGFzeW5jaHJvbm91cyBBbmd1bGFyIGNsYXNzIG1ldGFkYXRhIGZ1bmN0aW9uIGNyZWF0ZWQgYnkgdGhlIEFuZ3VsYXIgY29tcGlsZXIuXG4gKi9cbmNvbnN0IFNFVF9DTEFTU19NRVRBREFUQV9BU1lOQ19OQU1FID0gJ8m1c2V0Q2xhc3NNZXRhZGF0YUFzeW5jJztcblxuLyoqXG4gKiBQcm92aWRlcyBvbmUgb3IgbW9yZSBrZXl3b3JkcyB0aGF0IGlmIGZvdW5kIHdpdGhpbiB0aGUgY29udGVudCBvZiBhIHNvdXJjZSBmaWxlIGluZGljYXRlXG4gKiB0aGF0IHRoaXMgcGx1Z2luIHNob3VsZCBiZSB1c2VkIHdpdGggYSBzb3VyY2UgZmlsZS5cbiAqXG4gKiBAcmV0dXJucyBBbiBhIHN0cmluZyBpdGVyYWJsZSBjb250YWluaW5nIG9uZSBvciBtb3JlIGtleXdvcmRzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0S2V5d29yZHMoKTogSXRlcmFibGU8c3RyaW5nPiB7XG4gIHJldHVybiBbU0VUX0NMQVNTX01FVEFEQVRBX05BTUUsIFNFVF9DTEFTU19NRVRBREFUQV9BU1lOQ19OQU1FXTtcbn1cblxuLyoqXG4gKiBBIGJhYmVsIHBsdWdpbiBmYWN0b3J5IGZ1bmN0aW9uIGZvciBlbGlkaW5nIHRoZSBBbmd1bGFyIGNsYXNzIG1ldGFkYXRhIGZ1bmN0aW9uIChgybVzZXRDbGFzc01ldGFkYXRhYCkuXG4gKlxuICogQHJldHVybnMgQSBiYWJlbCBwbHVnaW4gb2JqZWN0IGluc3RhbmNlLlxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoKTogUGx1Z2luT2JqIHtcbiAgcmV0dXJuIHtcbiAgICB2aXNpdG9yOiB7XG4gICAgICBDYWxsRXhwcmVzc2lvbihwYXRoOiBOb2RlUGF0aDx0eXBlcy5DYWxsRXhwcmVzc2lvbj4pIHtcbiAgICAgICAgY29uc3QgY2FsbGVlID0gcGF0aC5ub2RlLmNhbGxlZTtcbiAgICAgICAgY29uc3QgY2FsbEFyZ3VtZW50cyA9IHBhdGgubm9kZS5hcmd1bWVudHM7XG5cbiAgICAgICAgLy8gVGhlIGZ1bmN0aW9uIGJlaW5nIGNhbGxlZCBtdXN0IGJlIHRoZSBtZXRhZGF0YSBmdW5jdGlvbiBuYW1lXG4gICAgICAgIGxldCBjYWxsZWVOYW1lO1xuICAgICAgICBpZiAodHlwZXMuaXNNZW1iZXJFeHByZXNzaW9uKGNhbGxlZSkgJiYgdHlwZXMuaXNJZGVudGlmaWVyKGNhbGxlZS5wcm9wZXJ0eSkpIHtcbiAgICAgICAgICBjYWxsZWVOYW1lID0gY2FsbGVlLnByb3BlcnR5Lm5hbWU7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZXMuaXNJZGVudGlmaWVyKGNhbGxlZSkpIHtcbiAgICAgICAgICBjYWxsZWVOYW1lID0gY2FsbGVlLm5hbWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXG4gICAgICAgICAgY2FsbGVlTmFtZSAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgKGlzUmVtb3ZlQ2xhc3NNZXRhZGF0YUNhbGwoY2FsbGVlTmFtZSwgY2FsbEFyZ3VtZW50cykgfHxcbiAgICAgICAgICAgIGlzUmVtb3ZlQ2xhc3NtZXRhZGF0YUFzeW5jQ2FsbChjYWxsZWVOYW1lLCBjYWxsQXJndW1lbnRzKSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgLy8gVGhlIG1ldGFkYXRhIGZ1bmN0aW9uIGlzIGFsd2F5cyBlbWl0dGVkIGluc2lkZSBhIGZ1bmN0aW9uIGV4cHJlc3Npb25cbiAgICAgICAgICBjb25zdCBwYXJlbnQgPSBwYXRoLmdldEZ1bmN0aW9uUGFyZW50KCk7XG5cbiAgICAgICAgICBpZiAocGFyZW50ICYmIChwYXJlbnQuaXNGdW5jdGlvbkV4cHJlc3Npb24oKSB8fCBwYXJlbnQuaXNBcnJvd0Z1bmN0aW9uRXhwcmVzc2lvbigpKSkge1xuICAgICAgICAgICAgLy8gUmVwbGFjZSB0aGUgbWV0YWRhdGEgZnVuY3Rpb24gd2l0aCBgdm9pZCAwYCB3aGljaCBpcyB0aGUgZXF1aXZhbGVudCByZXR1cm4gdmFsdWVcbiAgICAgICAgICAgIC8vIG9mIHRoZSBtZXRhZGF0YSBmdW5jdGlvbi5cbiAgICAgICAgICAgIHBhdGgucmVwbGFjZVdpdGgocGF0aC5zY29wZS5idWlsZFVuZGVmaW5lZE5vZGUoKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0sXG4gIH07XG59XG5cbi8qKiBEZXRlcm1pbmVzIGlmIGEgZnVuY3Rpb24gY2FsbCBpcyBhIGNhbGwgdG8gYHNldENsYXNzTWV0YWRhdGFgLiAqL1xuZnVuY3Rpb24gaXNSZW1vdmVDbGFzc01ldGFkYXRhQ2FsbChuYW1lOiBzdHJpbmcsIGFyZ3M6IHR5cGVzLkNhbGxFeHByZXNzaW9uWydhcmd1bWVudHMnXSk6IGJvb2xlYW4ge1xuICAvLyBgc2V0Q2xhc3NNZXRhZGF0YWAgY2FsbHMgaGF2ZSB0byBtZWV0IHRoZSBmb2xsb3dpbmcgY3JpdGVyaWE6XG4gIC8vICogRmlyc3QgbXVzdCBiZSBhbiBpZGVudGlmaWVyXG4gIC8vICogU2Vjb25kIG11c3QgYmUgYW4gYXJyYXkgbGl0ZXJhbFxuICByZXR1cm4gKFxuICAgIG5hbWUgPT09IFNFVF9DTEFTU19NRVRBREFUQV9OQU1FICYmXG4gICAgYXJncy5sZW5ndGggPT09IDQgJiZcbiAgICB0eXBlcy5pc0lkZW50aWZpZXIoYXJnc1swXSkgJiZcbiAgICB0eXBlcy5pc0FycmF5RXhwcmVzc2lvbihhcmdzWzFdKVxuICApO1xufVxuXG4vKiogRGV0ZXJtaW5lcyBpZiBhIGZ1bmN0aW9uIGNhbGwgaXMgYSBjYWxsIHRvIGBzZXRDbGFzc01ldGFkYXRhQXN5bmNgLiAqL1xuZnVuY3Rpb24gaXNSZW1vdmVDbGFzc21ldGFkYXRhQXN5bmNDYWxsKFxuICBuYW1lOiBzdHJpbmcsXG4gIGFyZ3M6IHR5cGVzLkNhbGxFeHByZXNzaW9uWydhcmd1bWVudHMnXSxcbik6IGJvb2xlYW4ge1xuICAvLyBgc2V0Q2xhc3NNZXRhZGF0YUFzeW5jYCBjYWxscyBoYXZlIHRvIG1lZXQgdGhlIGZvbGxvd2luZyBjcml0ZXJpYTpcbiAgLy8gKiBGaXJzdCBhcmd1bWVudCBtdXN0IGJlIGFuIGlkZW50aWZpZXIuXG4gIC8vICogU2Vjb25kIGFyZ3VtZW50IG11c3QgYmUgYW4gaW5saW5lIGZ1bmN0aW9uLlxuICAvLyAqIFRoaXJkIGFyZ3VtZW50IG11c3QgYmUgYW4gaW5saW5lIGZ1bmN0aW9uLlxuICByZXR1cm4gKFxuICAgIG5hbWUgPT09IFNFVF9DTEFTU19NRVRBREFUQV9BU1lOQ19OQU1FICYmXG4gICAgYXJncy5sZW5ndGggPT09IDMgJiZcbiAgICB0eXBlcy5pc0lkZW50aWZpZXIoYXJnc1swXSkgJiZcbiAgICBpc0lubGluZUZ1bmN0aW9uKGFyZ3NbMV0pICYmXG4gICAgaXNJbmxpbmVGdW5jdGlvbihhcmdzWzJdKVxuICApO1xufVxuXG4vKiogRGV0ZXJtaW5lcyBpZiBhIG5vZGUgaXMgYW4gaW5saW5lIGZ1bmN0aW9uIGV4cHJlc3Npb24uICovXG5mdW5jdGlvbiBpc0lubGluZUZ1bmN0aW9uKG5vZGU6IHR5cGVzLk5vZGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIHR5cGVzLmlzRnVuY3Rpb25FeHByZXNzaW9uKG5vZGUpIHx8IHR5cGVzLmlzQXJyb3dGdW5jdGlvbkV4cHJlc3Npb24obm9kZSk7XG59XG4iXX0=