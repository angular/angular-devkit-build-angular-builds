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
exports.getKeywords = void 0;
const core_1 = require("@babel/core");
const helper_annotate_as_pure_1 = __importDefault(require("@babel/helper-annotate-as-pure"));
/**
 * Provides one or more keywords that if found within the content of a source file indicate
 * that this plugin should be used with a source file.
 *
 * @returns An a string iterable containing one or more keywords.
 */
function getKeywords() {
    return ['var'];
}
exports.getKeywords = getKeywords;
/**
 * A babel plugin factory function for adjusting TypeScript emitted enums.
 *
 * @returns A babel plugin object instance.
 */
function default_1() {
    return {
        visitor: {
            VariableDeclaration(path) {
                const { parentPath, node } = path;
                if (node.kind !== 'var' || node.declarations.length !== 1) {
                    return;
                }
                const declaration = path.get('declarations')[0];
                if (declaration.node.init) {
                    return;
                }
                const declarationId = declaration.node.id;
                if (!core_1.types.isIdentifier(declarationId)) {
                    return;
                }
                const hasExport = parentPath.isExportNamedDeclaration() || parentPath.isExportDefaultDeclaration();
                const origin = hasExport ? parentPath : path;
                const nextStatement = origin.getSibling(+(origin.key ?? 0) + 1);
                if (!nextStatement.isExpressionStatement()) {
                    return;
                }
                const nextExpression = nextStatement.get('expression');
                if (!nextExpression.isCallExpression() || nextExpression.node.arguments.length !== 1) {
                    return;
                }
                const enumCallArgument = nextExpression.get('arguments')[0];
                if (!enumCallArgument.isLogicalExpression({ operator: '||' })) {
                    return;
                }
                const leftCallArgument = enumCallArgument.get('left');
                const rightCallArgument = enumCallArgument.get('right');
                // Check if identifiers match var declaration
                if (!leftCallArgument.isIdentifier() ||
                    !nextExpression.scope.bindingIdentifierEquals(leftCallArgument.node.name, declarationId) ||
                    !rightCallArgument.isAssignmentExpression()) {
                    return;
                }
                const enumCallee = nextExpression.get('callee');
                if (!enumCallee.isFunctionExpression() || enumCallee.node.params.length !== 1) {
                    return;
                }
                const parameterId = enumCallee.get('params')[0];
                if (!parameterId.isIdentifier()) {
                    return;
                }
                // Check if all enum member values are pure.
                // If not, leave as-is due to potential side efects
                let hasElements = false;
                for (const enumStatement of enumCallee.get('body').get('body')) {
                    if (!enumStatement.isExpressionStatement()) {
                        return;
                    }
                    const enumValueAssignment = enumStatement.get('expression');
                    if (!enumValueAssignment.isAssignmentExpression() ||
                        !enumValueAssignment.get('right').isPure()) {
                        return;
                    }
                    hasElements = true;
                }
                // If there are no enum elements then there is nothing to wrap
                if (!hasElements) {
                    return;
                }
                // Update right-side of initializer call argument to remove redundant assignment
                if (rightCallArgument.get('left').isIdentifier()) {
                    rightCallArgument.replaceWith(rightCallArgument.get('right'));
                }
                // Add a return statement to the enum initializer block
                enumCallee
                    .get('body')
                    .node.body.push(core_1.types.returnStatement(core_1.types.cloneNode(parameterId.node)));
                // Remove existing enum initializer
                const enumInitializer = nextExpression.node;
                nextExpression.remove();
                (0, helper_annotate_as_pure_1.default)(enumInitializer);
                // Add the wrapped enum initializer directly to the variable declaration
                declaration.get('init').replaceWith(enumInitializer);
            },
        },
    };
}
exports.default = default_1;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRqdXN0LXR5cGVzY3JpcHQtZW51bXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy9iYWJlbC9wbHVnaW5zL2FkanVzdC10eXBlc2NyaXB0LWVudW1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7OztBQUVILHNDQUF5RDtBQUN6RCw2RkFBNEQ7QUFFNUQ7Ozs7O0dBS0c7QUFDSCxTQUFnQixXQUFXO0lBQ3pCLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNqQixDQUFDO0FBRkQsa0NBRUM7QUFFRDs7OztHQUlHO0FBQ0g7SUFDRSxPQUFPO1FBQ0wsT0FBTyxFQUFFO1lBQ1AsbUJBQW1CLENBQUMsSUFBeUM7Z0JBQzNELE1BQU0sRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDO2dCQUNsQyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssS0FBSyxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtvQkFDekQsT0FBTztpQkFDUjtnQkFFRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNoRCxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFO29CQUN6QixPQUFPO2lCQUNSO2dCQUVELE1BQU0sYUFBYSxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUMxQyxJQUFJLENBQUMsWUFBSyxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsRUFBRTtvQkFDdEMsT0FBTztpQkFDUjtnQkFFRCxNQUFNLFNBQVMsR0FDYixVQUFVLENBQUMsd0JBQXdCLEVBQUUsSUFBSSxVQUFVLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztnQkFD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QUFDLENBQUMsQ0FBQztpQkFDL0Q7Z0JBRUQsdURBQXVEO2dCQUN2RCxVQUFVO3FCQUNQLEdBQUcsQ0FBQyxNQUFNLENBQUM7cUJBQ1gsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBSyxDQUFDLGVBQWUsQ0FBQyxZQUFLLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRTVFLG1DQUFtQztnQkFDbkMsTUFBTSxlQUFlLEdBQUcsY0FBYyxDQUFDLElBQUksQ0FBQztnQkFDNUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUV4QixJQUFBLGlDQUFjLEVBQUMsZUFBZSxDQUFDLENBQUM7Z0JBRWhDLHdFQUF3RTtnQkFDeEUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDdkQsQ0FBQztTQUNGO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUEzR0QsNEJBMkdDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IE5vZGVQYXRoLCBQbHVnaW5PYmosIHR5cGVzIH0gZnJvbSAnQGJhYmVsL2NvcmUnO1xuaW1wb3J0IGFubm90YXRlQXNQdXJlIGZyb20gJ0BiYWJlbC9oZWxwZXItYW5ub3RhdGUtYXMtcHVyZSc7XG5cbi8qKlxuICogUHJvdmlkZXMgb25lIG9yIG1vcmUga2V5d29yZHMgdGhhdCBpZiBmb3VuZCB3aXRoaW4gdGhlIGNvbnRlbnQgb2YgYSBzb3VyY2UgZmlsZSBpbmRpY2F0ZVxuICogdGhhdCB0aGlzIHBsdWdpbiBzaG91bGQgYmUgdXNlZCB3aXRoIGEgc291cmNlIGZpbGUuXG4gKlxuICogQHJldHVybnMgQW4gYSBzdHJpbmcgaXRlcmFibGUgY29udGFpbmluZyBvbmUgb3IgbW9yZSBrZXl3b3Jkcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEtleXdvcmRzKCk6IEl0ZXJhYmxlPHN0cmluZz4ge1xuICByZXR1cm4gWyd2YXInXTtcbn1cblxuLyoqXG4gKiBBIGJhYmVsIHBsdWdpbiBmYWN0b3J5IGZ1bmN0aW9uIGZvciBhZGp1c3RpbmcgVHlwZVNjcmlwdCBlbWl0dGVkIGVudW1zLlxuICpcbiAqIEByZXR1cm5zIEEgYmFiZWwgcGx1Z2luIG9iamVjdCBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKCk6IFBsdWdpbk9iaiB7XG4gIHJldHVybiB7XG4gICAgdmlzaXRvcjoge1xuICAgICAgVmFyaWFibGVEZWNsYXJhdGlvbihwYXRoOiBOb2RlUGF0aDx0eXBlcy5WYXJpYWJsZURlY2xhcmF0aW9uPikge1xuICAgICAgICBjb25zdCB7IHBhcmVudFBhdGgsIG5vZGUgfSA9IHBhdGg7XG4gICAgICAgIGlmIChub2RlLmtpbmQgIT09ICd2YXInIHx8IG5vZGUuZGVjbGFyYXRpb25zLmxlbmd0aCAhPT0gMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRlY2xhcmF0aW9uID0gcGF0aC5nZXQoJ2RlY2xhcmF0aW9ucycpWzBdO1xuICAgICAgICBpZiAoZGVjbGFyYXRpb24ubm9kZS5pbml0KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGVjbGFyYXRpb25JZCA9IGRlY2xhcmF0aW9uLm5vZGUuaWQ7XG4gICAgICAgIGlmICghdHlwZXMuaXNJZGVudGlmaWVyKGRlY2xhcmF0aW9uSWQpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaGFzRXhwb3J0ID1cbiAgICAgICAgICBwYXJlbnRQYXRoLmlzRXhwb3J0TmFtZWREZWNsYXJhdGlvbigpIHx8IHBhcmVudFBhdGguaXNFeHBvcnREZWZhdWx0RGVjbGFyYXRpb24oKTtcbiAgICAgICAgY29uc3Qgb3JpZ2luID0gaGFzRXhwb3J0ID8gcGFyZW50UGF0aCA6IHBhdGg7XG4gICAgICAgIGNvbnN0IG5leHRTdGF0ZW1lbnQgPSBvcmlnaW4uZ2V0U2libGluZygrKG9yaWdpbi5rZXkgPz8gMCkgKyAxKTtcbiAgICAgICAgaWYgKCFuZXh0U3RhdGVtZW50LmlzRXhwcmVzc2lvblN0YXRlbWVudCgpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbmV4dEV4cHJlc3Npb24gPSBuZXh0U3RhdGVtZW50LmdldCgnZXhwcmVzc2lvbicpO1xuICAgICAgICBpZiAoIW5leHRFeHByZXNzaW9uLmlzQ2FsbEV4cHJlc3Npb24oKSB8fCBuZXh0RXhwcmVzc2lvbi5ub2RlLmFyZ3VtZW50cy5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBlbnVtQ2FsbEFyZ3VtZW50ID0gbmV4dEV4cHJlc3Npb24uZ2V0KCdhcmd1bWVudHMnKVswXTtcbiAgICAgICAgaWYgKCFlbnVtQ2FsbEFyZ3VtZW50LmlzTG9naWNhbEV4cHJlc3Npb24oeyBvcGVyYXRvcjogJ3x8JyB9KSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGxlZnRDYWxsQXJndW1lbnQgPSBlbnVtQ2FsbEFyZ3VtZW50LmdldCgnbGVmdCcpO1xuICAgICAgICBjb25zdCByaWdodENhbGxBcmd1bWVudCA9IGVudW1DYWxsQXJndW1lbnQuZ2V0KCdyaWdodCcpO1xuXG4gICAgICAgIC8vIENoZWNrIGlmIGlkZW50aWZpZXJzIG1hdGNoIHZhciBkZWNsYXJhdGlvblxuICAgICAgICBpZiAoXG4gICAgICAgICAgIWxlZnRDYWxsQXJndW1lbnQuaXNJZGVudGlmaWVyKCkgfHxcbiAgICAgICAgICAhbmV4dEV4cHJlc3Npb24uc2NvcGUuYmluZGluZ0lkZW50aWZpZXJFcXVhbHMoXG4gICAgICAgICAgICBsZWZ0Q2FsbEFyZ3VtZW50Lm5vZGUubmFtZSxcbiAgICAgICAgICAgIGRlY2xhcmF0aW9uSWQsXG4gICAgICAgICAgKSB8fFxuICAgICAgICAgICFyaWdodENhbGxBcmd1bWVudC5pc0Fzc2lnbm1lbnRFeHByZXNzaW9uKClcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZW51bUNhbGxlZSA9IG5leHRFeHByZXNzaW9uLmdldCgnY2FsbGVlJyk7XG4gICAgICAgIGlmICghZW51bUNhbGxlZS5pc0Z1bmN0aW9uRXhwcmVzc2lvbigpIHx8IGVudW1DYWxsZWUubm9kZS5wYXJhbXMubGVuZ3RoICE9PSAxKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGFyYW1ldGVySWQgPSBlbnVtQ2FsbGVlLmdldCgncGFyYW1zJylbMF07XG4gICAgICAgIGlmICghcGFyYW1ldGVySWQuaXNJZGVudGlmaWVyKCkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDaGVjayBpZiBhbGwgZW51bSBtZW1iZXIgdmFsdWVzIGFyZSBwdXJlLlxuICAgICAgICAvLyBJZiBub3QsIGxlYXZlIGFzLWlzIGR1ZSB0byBwb3RlbnRpYWwgc2lkZSBlZmVjdHNcbiAgICAgICAgbGV0IGhhc0VsZW1lbnRzID0gZmFsc2U7XG4gICAgICAgIGZvciAoY29uc3QgZW51bVN0YXRlbWVudCBvZiBlbnVtQ2FsbGVlLmdldCgnYm9keScpLmdldCgnYm9keScpKSB7XG4gICAgICAgICAgaWYgKCFlbnVtU3RhdGVtZW50LmlzRXhwcmVzc2lvblN0YXRlbWVudCgpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZW51bVZhbHVlQXNzaWdubWVudCA9IGVudW1TdGF0ZW1lbnQuZ2V0KCdleHByZXNzaW9uJyk7XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgIWVudW1WYWx1ZUFzc2lnbm1lbnQuaXNBc3NpZ25tZW50RXhwcmVzc2lvbigpIHx8XG4gICAgICAgICAgICAhZW51bVZhbHVlQXNzaWdubWVudC5nZXQoJ3JpZ2h0JykuaXNQdXJlKClcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBoYXNFbGVtZW50cyA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiB0aGVyZSBhcmUgbm8gZW51bSBlbGVtZW50cyB0aGVuIHRoZXJlIGlzIG5vdGhpbmcgdG8gd3JhcFxuICAgICAgICBpZiAoIWhhc0VsZW1lbnRzKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIHJpZ2h0LXNpZGUgb2YgaW5pdGlhbGl6ZXIgY2FsbCBhcmd1bWVudCB0byByZW1vdmUgcmVkdW5kYW50IGFzc2lnbm1lbnRcbiAgICAgICAgaWYgKHJpZ2h0Q2FsbEFyZ3VtZW50LmdldCgnbGVmdCcpLmlzSWRlbnRpZmllcigpKSB7XG4gICAgICAgICAgcmlnaHRDYWxsQXJndW1lbnQucmVwbGFjZVdpdGgocmlnaHRDYWxsQXJndW1lbnQuZ2V0KCdyaWdodCcpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFkZCBhIHJldHVybiBzdGF0ZW1lbnQgdG8gdGhlIGVudW0gaW5pdGlhbGl6ZXIgYmxvY2tcbiAgICAgICAgZW51bUNhbGxlZVxuICAgICAgICAgIC5nZXQoJ2JvZHknKVxuICAgICAgICAgIC5ub2RlLmJvZHkucHVzaCh0eXBlcy5yZXR1cm5TdGF0ZW1lbnQodHlwZXMuY2xvbmVOb2RlKHBhcmFtZXRlcklkLm5vZGUpKSk7XG5cbiAgICAgICAgLy8gUmVtb3ZlIGV4aXN0aW5nIGVudW0gaW5pdGlhbGl6ZXJcbiAgICAgICAgY29uc3QgZW51bUluaXRpYWxpemVyID0gbmV4dEV4cHJlc3Npb24ubm9kZTtcbiAgICAgICAgbmV4dEV4cHJlc3Npb24ucmVtb3ZlKCk7XG5cbiAgICAgICAgYW5ub3RhdGVBc1B1cmUoZW51bUluaXRpYWxpemVyKTtcblxuICAgICAgICAvLyBBZGQgdGhlIHdyYXBwZWQgZW51bSBpbml0aWFsaXplciBkaXJlY3RseSB0byB0aGUgdmFyaWFibGUgZGVjbGFyYXRpb25cbiAgICAgICAgZGVjbGFyYXRpb24uZ2V0KCdpbml0JykucmVwbGFjZVdpdGgoZW51bUluaXRpYWxpemVyKTtcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==