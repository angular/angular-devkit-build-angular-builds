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
 * The name of the Typescript decorator helper function created by the TypeScript compiler.
 */
const TSLIB_DECORATE_HELPER_NAME = '__decorate';
/**
 * The set of Angular static fields that should always be wrapped.
 * These fields may appear to have side effects but are safe to remove if the associated class
 * is otherwise unused within the output.
 */
const angularStaticsToWrap = new Set([
    'ɵcmp',
    'ɵdir',
    'ɵfac',
    'ɵinj',
    'ɵmod',
    'ɵpipe',
    'ɵprov',
    'INJECTOR_KEY',
]);
/**
 * An object map of static fields and related value checks for discovery of Angular generated
 * JIT related static fields.
 */
const angularStaticsToElide = {
    'ctorParameters'(path) {
        return path.isFunctionExpression() || path.isArrowFunctionExpression();
    },
    'decorators'(path) {
        return path.isArrayExpression();
    },
    'propDecorators'(path) {
        return path.isObjectExpression();
    },
};
/**
 * Provides one or more keywords that if found within the content of a source file indicate
 * that this plugin should be used with a source file.
 *
 * @returns An a string iterable containing one or more keywords.
 */
function getKeywords() {
    return ['class'];
}
exports.getKeywords = getKeywords;
/**
 * Determines whether a property and its initializer value can be safely wrapped in a pure
 * annotated IIFE. Values that may cause side effects are not considered safe to wrap.
 * Wrapping such values may cause runtime errors and/or incorrect runtime behavior.
 *
 * @param propertyName The name of the property to analyze.
 * @param assignmentValue The initializer value that will be assigned to the property.
 * @returns If the property can be safely wrapped, then true; otherwise, false.
 */
function canWrapProperty(propertyName, assignmentValue) {
    if (angularStaticsToWrap.has(propertyName)) {
        return true;
    }
    const { leadingComments } = assignmentValue.node;
    if (leadingComments === null || leadingComments === void 0 ? void 0 : leadingComments.some(
    // `@pureOrBreakMyCode` is used by closure and is present in Angular code
    ({ value }) => value.includes('@__PURE__') ||
        value.includes('#__PURE__') ||
        value.includes('@pureOrBreakMyCode'))) {
        return true;
    }
    return assignmentValue.isPure();
}
/**
 * Analyze the sibling nodes of a class to determine if any downlevel elements should be
 * wrapped in a pure annotated IIFE. Also determines if any elements have potential side
 * effects.
 *
 * @param origin The starting NodePath location for analyzing siblings.
 * @param classIdentifier The identifier node that represents the name of the class.
 * @param allowWrappingDecorators Whether to allow decorators to be wrapped.
 * @returns An object containing the results of the analysis.
 */
function analyzeClassSiblings(origin, classIdentifier, allowWrappingDecorators) {
    var _a;
    const wrapStatementPaths = [];
    let hasPotentialSideEffects = false;
    for (let i = 1;; ++i) {
        const nextStatement = origin.getSibling(+origin.key + i);
        if (!nextStatement.isExpressionStatement()) {
            break;
        }
        // Valid sibling statements for class declarations are only assignment expressions
        // and TypeScript decorator helper call expressions
        const nextExpression = nextStatement.get('expression');
        if (nextExpression.isCallExpression()) {
            if (!core_1.types.isIdentifier(nextExpression.node.callee) ||
                nextExpression.node.callee.name !== TSLIB_DECORATE_HELPER_NAME) {
                break;
            }
            if (allowWrappingDecorators) {
                wrapStatementPaths.push(nextStatement);
            }
            else {
                // Statement cannot be safely wrapped which makes wrapping the class unneeded.
                // The statement will prevent even a wrapped class from being optimized away.
                hasPotentialSideEffects = true;
            }
            continue;
        }
        else if (!nextExpression.isAssignmentExpression()) {
            break;
        }
        // Valid assignment expressions should be member access expressions using the class
        // name as the object and an identifier as the property for static fields or only
        // the class name for decorators.
        const left = nextExpression.get('left');
        if (left.isIdentifier()) {
            if (!left.scope.bindingIdentifierEquals(left.node.name, classIdentifier) ||
                !core_1.types.isCallExpression(nextExpression.node.right) ||
                !core_1.types.isIdentifier(nextExpression.node.right.callee) ||
                nextExpression.node.right.callee.name !== TSLIB_DECORATE_HELPER_NAME) {
                break;
            }
            if (allowWrappingDecorators) {
                wrapStatementPaths.push(nextStatement);
            }
            else {
                // Statement cannot be safely wrapped which makes wrapping the class unneeded.
                // The statement will prevent even a wrapped class from being optimized away.
                hasPotentialSideEffects = true;
            }
            continue;
        }
        else if (!left.isMemberExpression() ||
            !core_1.types.isIdentifier(left.node.object) ||
            !left.scope.bindingIdentifierEquals(left.node.object.name, classIdentifier) ||
            !core_1.types.isIdentifier(left.node.property)) {
            break;
        }
        const propertyName = left.node.property.name;
        const assignmentValue = nextExpression.get('right');
        if ((_a = angularStaticsToElide[propertyName]) === null || _a === void 0 ? void 0 : _a.call(angularStaticsToElide, assignmentValue)) {
            nextStatement.remove();
            --i;
        }
        else if (canWrapProperty(propertyName, assignmentValue)) {
            wrapStatementPaths.push(nextStatement);
        }
        else {
            // Statement cannot be safely wrapped which makes wrapping the class unneeded.
            // The statement will prevent even a wrapped class from being optimized away.
            hasPotentialSideEffects = true;
        }
    }
    return { hasPotentialSideEffects, wrapStatementPaths };
}
/**
 * The set of classed already visited and analyzed during the plugin's execution.
 * This is used to prevent adjusted classes from being repeatedly analyzed which can lead
 * to an infinite loop.
 */
const visitedClasses = new WeakSet();
/**
 * A babel plugin factory function for adjusting classes; primarily with Angular metadata.
 * The adjustments include wrapping classes with known safe or no side effects with pure
 * annotations to support dead code removal of unused classes. Angular compiler generated
 * metadata static fields not required in AOT mode are also elided to better support bundler-
 * level treeshaking.
 *
 * @returns A babel plugin object instance.
 */
function default_1() {
    return {
        visitor: {
            ClassDeclaration(path, state) {
                const { node: classNode, parentPath } = path;
                const { wrapDecorators } = state.opts;
                if (visitedClasses.has(classNode)) {
                    return;
                }
                // Analyze sibling statements for elements of the class that were downleveled
                const hasExport = parentPath.isExportNamedDeclaration() || parentPath.isExportDefaultDeclaration();
                const origin = hasExport ? parentPath : path;
                const { wrapStatementPaths, hasPotentialSideEffects } = analyzeClassSiblings(origin, classNode.id, wrapDecorators);
                visitedClasses.add(classNode);
                if (hasPotentialSideEffects || wrapStatementPaths.length === 0) {
                    return;
                }
                const wrapStatementNodes = [];
                for (const statementPath of wrapStatementPaths) {
                    wrapStatementNodes.push(statementPath.node);
                    statementPath.remove();
                }
                // Wrap class and safe static assignments in a pure annotated IIFE
                const container = core_1.types.arrowFunctionExpression([], core_1.types.blockStatement([
                    classNode,
                    ...wrapStatementNodes,
                    core_1.types.returnStatement(core_1.types.cloneNode(classNode.id)),
                ]));
                const replacementInitializer = core_1.types.callExpression(core_1.types.parenthesizedExpression(container), []);
                (0, helper_annotate_as_pure_1.default)(replacementInitializer);
                // Replace class with IIFE wrapped class
                const declaration = core_1.types.variableDeclaration('let', [
                    core_1.types.variableDeclarator(core_1.types.cloneNode(classNode.id), replacementInitializer),
                ]);
                if (parentPath.isExportDefaultDeclaration()) {
                    // When converted to a variable declaration, the default export must be moved
                    // to a subsequent statement to prevent a JavaScript syntax error.
                    parentPath.replaceWithMultiple([
                        declaration,
                        core_1.types.exportNamedDeclaration(undefined, [
                            core_1.types.exportSpecifier(core_1.types.cloneNode(classNode.id), core_1.types.identifier('default')),
                        ]),
                    ]);
                }
                else {
                    path.replaceWith(declaration);
                }
            },
            ClassExpression(path, state) {
                const { node: classNode, parentPath } = path;
                const { wrapDecorators } = state.opts;
                // Class expressions are used by TypeScript to represent downlevel class/constructor decorators.
                // If not wrapping decorators, they do not need to be processed.
                if (!wrapDecorators || visitedClasses.has(classNode)) {
                    return;
                }
                if (!classNode.id ||
                    !parentPath.isVariableDeclarator() ||
                    !core_1.types.isIdentifier(parentPath.node.id) ||
                    parentPath.node.id.name !== classNode.id.name) {
                    return;
                }
                const origin = parentPath.parentPath;
                if (!origin.isVariableDeclaration() || origin.node.declarations.length !== 1) {
                    return;
                }
                const { wrapStatementPaths, hasPotentialSideEffects } = analyzeClassSiblings(origin, parentPath.node.id, wrapDecorators);
                visitedClasses.add(classNode);
                if (hasPotentialSideEffects || wrapStatementPaths.length === 0) {
                    return;
                }
                const wrapStatementNodes = [];
                for (const statementPath of wrapStatementPaths) {
                    wrapStatementNodes.push(statementPath.node);
                    statementPath.remove();
                }
                // Wrap class and safe static assignments in a pure annotated IIFE
                const container = core_1.types.arrowFunctionExpression([], core_1.types.blockStatement([
                    core_1.types.variableDeclaration('let', [
                        core_1.types.variableDeclarator(core_1.types.cloneNode(classNode.id), classNode),
                    ]),
                    ...wrapStatementNodes,
                    core_1.types.returnStatement(core_1.types.cloneNode(classNode.id)),
                ]));
                const replacementInitializer = core_1.types.callExpression(core_1.types.parenthesizedExpression(container), []);
                (0, helper_annotate_as_pure_1.default)(replacementInitializer);
                // Add the wrapped class directly to the variable declaration
                parentPath.get('init').replaceWith(replacementInitializer);
            },
        },
    };
}
exports.default = default_1;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRqdXN0LXN0YXRpYy1jbGFzcy1tZW1iZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYmFiZWwvcGx1Z2lucy9hZGp1c3Qtc3RhdGljLWNsYXNzLW1lbWJlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgsc0NBQXFFO0FBQ3JFLDZGQUE0RDtBQUU1RDs7R0FFRztBQUNILE1BQU0sMEJBQTBCLEdBQUcsWUFBWSxDQUFDO0FBRWhEOzs7O0dBSUc7QUFDSCxNQUFNLG9CQUFvQixHQUFHLElBQUksR0FBRyxDQUFDO0lBQ25DLE1BQU07SUFDTixNQUFNO0lBQ04sTUFBTTtJQUNOLE1BQU07SUFDTixNQUFNO0lBQ04sT0FBTztJQUNQLE9BQU87SUFDUCxjQUFjO0NBQ2YsQ0FBQyxDQUFDO0FBRUg7OztHQUdHO0FBQ0gsTUFBTSxxQkFBcUIsR0FBa0U7SUFDM0YsZ0JBQWdCLENBQUMsSUFBSTtRQUNuQixPQUFPLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO0lBQ3pFLENBQUM7SUFDRCxZQUFZLENBQUMsSUFBSTtRQUNmLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7SUFDbEMsQ0FBQztJQUNELGdCQUFnQixDQUFDLElBQUk7UUFDbkIsT0FBTyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztJQUNuQyxDQUFDO0NBQ0YsQ0FBQztBQUVGOzs7OztHQUtHO0FBQ0gsU0FBZ0IsV0FBVztJQUN6QixPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDbkIsQ0FBQztBQUZELGtDQUVDO0FBRUQ7Ozs7Ozs7O0dBUUc7QUFDSCxTQUFTLGVBQWUsQ0FBQyxZQUFvQixFQUFFLGVBQXlCO0lBQ3RFLElBQUksb0JBQW9CLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFO1FBQzFDLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFFRCxNQUFNLEVBQUUsZUFBZSxFQUFFLEdBQUcsZUFBZSxDQUFDLElBQWlELENBQUM7SUFDOUYsSUFDRSxlQUFlLGFBQWYsZUFBZSx1QkFBZixlQUFlLENBQUUsSUFBSTtJQUNuQix5RUFBeUU7SUFDekUsQ0FBQyxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsQ0FDWixLQUFLLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQztRQUMzQixLQUFLLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQztRQUMzQixLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQ3ZDLEVBQ0Q7UUFDQSxPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsT0FBTyxlQUFlLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDbEMsQ0FBQztBQUVEOzs7Ozs7Ozs7R0FTRztBQUNILFNBQVMsb0JBQW9CLENBQzNCLE1BQWdCLEVBQ2hCLGVBQWlDLEVBQ2pDLHVCQUFnQzs7SUFFaEMsTUFBTSxrQkFBa0IsR0FBZ0MsRUFBRSxDQUFDO0lBQzNELElBQUksdUJBQXVCLEdBQUcsS0FBSyxDQUFDO0lBQ3BDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFJLEVBQUUsQ0FBQyxFQUFFO1FBQ3JCLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3pELElBQUksQ0FBQyxhQUFhLENBQUMscUJBQXFCLEVBQUUsRUFBRTtZQUMxQyxNQUFNO1NBQ1A7UUFFRCxrRkFBa0Y7UUFDbEYsbURBQW1EO1FBQ25ELE1BQU0sY0FBYyxHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDdkQsSUFBSSxjQUFjLENBQUMsZ0JBQWdCLEVBQUUsRUFBRTtZQUNyQyxJQUNFLENBQUMsWUFBSyxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztnQkFDL0MsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLDBCQUEwQixFQUM5RDtnQkFDQSxNQUFNO2FBQ1A7WUFFRCxJQUFJLHVCQUF1QixFQUFFO2dCQUMzQixrQkFBa0IsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7YUFDeEM7aUJBQU07Z0JBQ0wsOEVBQThFO2dCQUM5RSw2RUFBNkU7Z0JBQzdFLHVCQUF1QixHQUFHLElBQUksQ0FBQzthQUNoQztZQUVELFNBQVM7U0FDVjthQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsc0JBQXNCLEVBQUUsRUFBRTtZQUNuRCxNQUFNO1NBQ1A7UUFFRCxtRkFBbUY7UUFDbkYsaUZBQWlGO1FBQ2pGLGlDQUFpQztRQUNqQyxNQUFNLElBQUksR0FBRyxjQUFjLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3hDLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRSxFQUFFO1lBQ3ZCLElBQ0UsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQztnQkFDcEUsQ0FBQyxZQUFLLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7Z0JBQ2xELENBQUMsWUFBSyxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7Z0JBQ3JELGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssMEJBQTBCLEVBQ3BFO2dCQUNBLE1BQU07YUFDUDtZQUVELElBQUksdUJBQXVCLEVBQUU7Z0JBQzNCLGtCQUFrQixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQzthQUN4QztpQkFBTTtnQkFDTCw4RUFBOEU7Z0JBQzlFLDZFQUE2RTtnQkFDN0UsdUJBQXVCLEdBQUcsSUFBSSxDQUFDO2FBQ2hDO1lBRUQsU0FBUztTQUNWO2FBQU0sSUFDTCxDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtZQUMxQixDQUFDLFlBQUssQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7WUFDckMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxlQUFlLENBQUM7WUFDM0UsQ0FBQyxZQUFLLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQ3ZDO1lBQ0EsTUFBTTtTQUNQO1FBRUQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDO1FBQzdDLE1BQU0sZUFBZSxHQUFHLGNBQWMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEQsSUFBSSxNQUFBLHFCQUFxQixDQUFDLFlBQVksQ0FBQyxzRUFBRyxlQUFlLENBQUMsRUFBRTtZQUMxRCxhQUFhLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDdkIsRUFBRSxDQUFDLENBQUM7U0FDTDthQUFNLElBQUksZUFBZSxDQUFDLFlBQVksRUFBRSxlQUFlLENBQUMsRUFBRTtZQUN6RCxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7U0FDeEM7YUFBTTtZQUNMLDhFQUE4RTtZQUM5RSw2RUFBNkU7WUFDN0UsdUJBQXVCLEdBQUcsSUFBSSxDQUFDO1NBQ2hDO0tBQ0Y7SUFFRCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsa0JBQWtCLEVBQUUsQ0FBQztBQUN6RCxDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILE1BQU0sY0FBYyxHQUFHLElBQUksT0FBTyxFQUFlLENBQUM7QUFFbEQ7Ozs7Ozs7O0dBUUc7QUFDSDtJQUNFLE9BQU87UUFDTCxPQUFPLEVBQUU7WUFDUCxnQkFBZ0IsQ0FBQyxJQUFzQyxFQUFFLEtBQWlCO2dCQUN4RSxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUM7Z0JBQzdDLE1BQU0sRUFBRSxjQUFjLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBbUMsQ0FBQztnQkFFckUsSUFBSSxjQUFjLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFO29CQUNqQyxPQUFPO2lCQUNSO2dCQUVELDZFQUE2RTtnQkFDN0UsTUFBTSxTQUFTLEdBQ2IsVUFBVSxDQUFDLHdCQUF3QixFQUFFLElBQUksVUFBVSxDQUFDLDBCQUEwQixFQUFFLENBQUM7Z0JBQ25GLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7Z0JBQzdDLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSx1QkFBdUIsRUFBRSxHQUFHLG9CQUFvQixDQUMxRSxNQUFNLEVBQ04sU0FBUyxDQUFDLEVBQUUsRUFDWixjQUFjLENBQ2YsQ0FBQztnQkFFRixjQUFjLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUU5QixJQUFJLHVCQUF1QixJQUFJLGtCQUFrQixDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7b0JBQzlELE9BQU87aUJBQ1I7Z0JBRUQsTUFBTSxrQkFBa0IsR0FBc0IsRUFBRSxDQUFDO2dCQUNqRCxLQUFLLE1BQU0sYUFBYSxJQUFJLGtCQUFrQixFQUFFO29CQUM5QyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUM1QyxhQUFhLENBQUMsTUFBTSxFQUFFLENBQUM7aUJBQ3hCO2dCQUVELGtFQUFrRTtnQkFDbEUsTUFBTSxTQUFTLEdBQUcsWUFBSyxDQUFDLHVCQUF1QixDQUM3QyxFQUFFLEVBQ0YsWUFBSyxDQUFDLGNBQWMsQ0FBQztvQkFDbkIsU0FBUztvQkFDVCxHQUFHLGtCQUFrQjtvQkFDckIsWUFBSyxDQUFDLGVBQWUsQ0FBQyxZQUFLLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQztpQkFDckQsQ0FBQyxDQUNILENBQUM7Z0JBQ0YsTUFBTSxzQkFBc0IsR0FBRyxZQUFLLENBQUMsY0FBYyxDQUNqRCxZQUFLLENBQUMsdUJBQXVCLENBQUMsU0FBUyxDQUFDLEVBQ3hDLEVBQUUsQ0FDSCxDQUFDO2dCQUNGLElBQUEsaUNBQWMsRUFBQyxzQkFBc0IsQ0FBQyxDQUFDO2dCQUV2Qyx3Q0FBd0M7Z0JBQ3hDLE1BQU0sV0FBVyxHQUFHLFlBQUssQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLEVBQUU7b0JBQ25ELFlBQUssQ0FBQyxrQkFBa0IsQ0FBQyxZQUFLLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsRUFBRSxzQkFBc0IsQ0FBQztpQkFDaEYsQ0FBQyxDQUFDO2dCQUNILElBQUksVUFBVSxDQUFDLDBCQUEwQixFQUFFLEVBQUU7b0JBQzNDLDZFQUE2RTtvQkFDN0Usa0VBQWtFO29CQUNsRSxVQUFVLENBQUMsbUJBQW1CLENBQUM7d0JBQzdCLFdBQVc7d0JBQ1gsWUFBSyxDQUFDLHNCQUFzQixDQUFDLFNBQVMsRUFBRTs0QkFDdEMsWUFBSyxDQUFDLGVBQWUsQ0FBQyxZQUFLLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsRUFBRSxZQUFLLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO3lCQUNsRixDQUFDO3FCQUNILENBQUMsQ0FBQztpQkFDSjtxQkFBTTtvQkFDTCxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO2lCQUMvQjtZQUNILENBQUM7WUFDRCxlQUFlLENBQUMsSUFBcUMsRUFBRSxLQUFpQjtnQkFDdEUsTUFBTSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDO2dCQUM3QyxNQUFNLEVBQUUsY0FBYyxFQUFFLEdBQUcsS0FBSyxDQUFDLElBQW1DLENBQUM7Z0JBRXJFLGdHQUFnRztnQkFDaEcsZ0VBQWdFO2dCQUNoRSxJQUFJLENBQUMsY0FBYyxJQUFJLGNBQWMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUU7b0JBQ3BELE9BQU87aUJBQ1I7Z0JBRUQsSUFDRSxDQUFDLFNBQVMsQ0FBQyxFQUFFO29CQUNiLENBQUMsVUFBVSxDQUFDLG9CQUFvQixFQUFFO29CQUNsQyxDQUFDLFlBQUssQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQ3ZDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksS0FBSyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksRUFDN0M7b0JBQ0EsT0FBTztpQkFDUjtnQkFFRCxNQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDO2dCQUNyQyxJQUFJLENBQUMsTUFBTSxDQUFDLHFCQUFxQixFQUFFLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtvQkFDNUUsT0FBTztpQkFDUjtnQkFFRCxNQUFNLEVBQUUsa0JBQWtCLEVBQUUsdUJBQXVCLEVBQUUsR0FBRyxvQkFBb0IsQ0FDMUUsTUFBTSxFQUNOLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUNsQixjQUFjLENBQ2YsQ0FBQztnQkFFRixjQUFjLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUU5QixJQUFJLHVCQUF1QixJQUFJLGtCQUFrQixDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7b0JBQzlELE9BQU87aUJBQ1I7Z0JBRUQsTUFBTSxrQkFBa0IsR0FBc0IsRUFBRSxDQUFDO2dCQUNqRCxLQUFLLE1BQU0sYUFBYSxJQUFJLGtCQUFrQixFQUFFO29CQUM5QyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUM1QyxhQUFhLENBQUMsTUFBTSxFQUFFLENBQUM7aUJBQ3hCO2dCQUVELGtFQUFrRTtnQkFDbEUsTUFBTSxTQUFTLEdBQUcsWUFBSyxDQUFDLHVCQUF1QixDQUM3QyxFQUFFLEVBQ0YsWUFBSyxDQUFDLGNBQWMsQ0FBQztvQkFDbkIsWUFBSyxDQUFDLG1CQUFtQixDQUFDLEtBQUssRUFBRTt3QkFDL0IsWUFBSyxDQUFDLGtCQUFrQixDQUFDLFlBQUssQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFNBQVMsQ0FBQztxQkFDbkUsQ0FBQztvQkFDRixHQUFHLGtCQUFrQjtvQkFDckIsWUFBSyxDQUFDLGVBQWUsQ0FBQyxZQUFLLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQztpQkFDckQsQ0FBQyxDQUNILENBQUM7Z0JBQ0YsTUFBTSxzQkFBc0IsR0FBRyxZQUFLLENBQUMsY0FBYyxDQUNqRCxZQUFLLENBQUMsdUJBQXVCLENBQUMsU0FBUyxDQUFDLEVBQ3hDLEVBQUUsQ0FDSCxDQUFDO2dCQUNGLElBQUEsaUNBQWMsRUFBQyxzQkFBc0IsQ0FBQyxDQUFDO2dCQUV2Qyw2REFBNkQ7Z0JBQzdELFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsV0FBVyxDQUFDLHNCQUFzQixDQUFDLENBQUM7WUFDN0QsQ0FBQztTQUNGO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFqSUQsNEJBaUlDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IE5vZGVQYXRoLCBQbHVnaW5PYmosIFBsdWdpblBhc3MsIHR5cGVzIH0gZnJvbSAnQGJhYmVsL2NvcmUnO1xuaW1wb3J0IGFubm90YXRlQXNQdXJlIGZyb20gJ0BiYWJlbC9oZWxwZXItYW5ub3RhdGUtYXMtcHVyZSc7XG5cbi8qKlxuICogVGhlIG5hbWUgb2YgdGhlIFR5cGVzY3JpcHQgZGVjb3JhdG9yIGhlbHBlciBmdW5jdGlvbiBjcmVhdGVkIGJ5IHRoZSBUeXBlU2NyaXB0IGNvbXBpbGVyLlxuICovXG5jb25zdCBUU0xJQl9ERUNPUkFURV9IRUxQRVJfTkFNRSA9ICdfX2RlY29yYXRlJztcblxuLyoqXG4gKiBUaGUgc2V0IG9mIEFuZ3VsYXIgc3RhdGljIGZpZWxkcyB0aGF0IHNob3VsZCBhbHdheXMgYmUgd3JhcHBlZC5cbiAqIFRoZXNlIGZpZWxkcyBtYXkgYXBwZWFyIHRvIGhhdmUgc2lkZSBlZmZlY3RzIGJ1dCBhcmUgc2FmZSB0byByZW1vdmUgaWYgdGhlIGFzc29jaWF0ZWQgY2xhc3NcbiAqIGlzIG90aGVyd2lzZSB1bnVzZWQgd2l0aGluIHRoZSBvdXRwdXQuXG4gKi9cbmNvbnN0IGFuZ3VsYXJTdGF0aWNzVG9XcmFwID0gbmV3IFNldChbXG4gICfJtWNtcCcsXG4gICfJtWRpcicsXG4gICfJtWZhYycsXG4gICfJtWluaicsXG4gICfJtW1vZCcsXG4gICfJtXBpcGUnLFxuICAnybVwcm92JyxcbiAgJ0lOSkVDVE9SX0tFWScsXG5dKTtcblxuLyoqXG4gKiBBbiBvYmplY3QgbWFwIG9mIHN0YXRpYyBmaWVsZHMgYW5kIHJlbGF0ZWQgdmFsdWUgY2hlY2tzIGZvciBkaXNjb3Zlcnkgb2YgQW5ndWxhciBnZW5lcmF0ZWRcbiAqIEpJVCByZWxhdGVkIHN0YXRpYyBmaWVsZHMuXG4gKi9cbmNvbnN0IGFuZ3VsYXJTdGF0aWNzVG9FbGlkZTogUmVjb3JkPHN0cmluZywgKHBhdGg6IE5vZGVQYXRoPHR5cGVzLkV4cHJlc3Npb24+KSA9PiBib29sZWFuPiA9IHtcbiAgJ2N0b3JQYXJhbWV0ZXJzJyhwYXRoKSB7XG4gICAgcmV0dXJuIHBhdGguaXNGdW5jdGlvbkV4cHJlc3Npb24oKSB8fCBwYXRoLmlzQXJyb3dGdW5jdGlvbkV4cHJlc3Npb24oKTtcbiAgfSxcbiAgJ2RlY29yYXRvcnMnKHBhdGgpIHtcbiAgICByZXR1cm4gcGF0aC5pc0FycmF5RXhwcmVzc2lvbigpO1xuICB9LFxuICAncHJvcERlY29yYXRvcnMnKHBhdGgpIHtcbiAgICByZXR1cm4gcGF0aC5pc09iamVjdEV4cHJlc3Npb24oKTtcbiAgfSxcbn07XG5cbi8qKlxuICogUHJvdmlkZXMgb25lIG9yIG1vcmUga2V5d29yZHMgdGhhdCBpZiBmb3VuZCB3aXRoaW4gdGhlIGNvbnRlbnQgb2YgYSBzb3VyY2UgZmlsZSBpbmRpY2F0ZVxuICogdGhhdCB0aGlzIHBsdWdpbiBzaG91bGQgYmUgdXNlZCB3aXRoIGEgc291cmNlIGZpbGUuXG4gKlxuICogQHJldHVybnMgQW4gYSBzdHJpbmcgaXRlcmFibGUgY29udGFpbmluZyBvbmUgb3IgbW9yZSBrZXl3b3Jkcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEtleXdvcmRzKCk6IEl0ZXJhYmxlPHN0cmluZz4ge1xuICByZXR1cm4gWydjbGFzcyddO1xufVxuXG4vKipcbiAqIERldGVybWluZXMgd2hldGhlciBhIHByb3BlcnR5IGFuZCBpdHMgaW5pdGlhbGl6ZXIgdmFsdWUgY2FuIGJlIHNhZmVseSB3cmFwcGVkIGluIGEgcHVyZVxuICogYW5ub3RhdGVkIElJRkUuIFZhbHVlcyB0aGF0IG1heSBjYXVzZSBzaWRlIGVmZmVjdHMgYXJlIG5vdCBjb25zaWRlcmVkIHNhZmUgdG8gd3JhcC5cbiAqIFdyYXBwaW5nIHN1Y2ggdmFsdWVzIG1heSBjYXVzZSBydW50aW1lIGVycm9ycyBhbmQvb3IgaW5jb3JyZWN0IHJ1bnRpbWUgYmVoYXZpb3IuXG4gKlxuICogQHBhcmFtIHByb3BlcnR5TmFtZSBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgdG8gYW5hbHl6ZS5cbiAqIEBwYXJhbSBhc3NpZ25tZW50VmFsdWUgVGhlIGluaXRpYWxpemVyIHZhbHVlIHRoYXQgd2lsbCBiZSBhc3NpZ25lZCB0byB0aGUgcHJvcGVydHkuXG4gKiBAcmV0dXJucyBJZiB0aGUgcHJvcGVydHkgY2FuIGJlIHNhZmVseSB3cmFwcGVkLCB0aGVuIHRydWU7IG90aGVyd2lzZSwgZmFsc2UuXG4gKi9cbmZ1bmN0aW9uIGNhbldyYXBQcm9wZXJ0eShwcm9wZXJ0eU5hbWU6IHN0cmluZywgYXNzaWdubWVudFZhbHVlOiBOb2RlUGF0aCk6IGJvb2xlYW4ge1xuICBpZiAoYW5ndWxhclN0YXRpY3NUb1dyYXAuaGFzKHByb3BlcnR5TmFtZSkpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGNvbnN0IHsgbGVhZGluZ0NvbW1lbnRzIH0gPSBhc3NpZ25tZW50VmFsdWUubm9kZSBhcyB7IGxlYWRpbmdDb21tZW50cz86IHsgdmFsdWU6IHN0cmluZyB9W10gfTtcbiAgaWYgKFxuICAgIGxlYWRpbmdDb21tZW50cz8uc29tZShcbiAgICAgIC8vIGBAcHVyZU9yQnJlYWtNeUNvZGVgIGlzIHVzZWQgYnkgY2xvc3VyZSBhbmQgaXMgcHJlc2VudCBpbiBBbmd1bGFyIGNvZGVcbiAgICAgICh7IHZhbHVlIH0pID0+XG4gICAgICAgIHZhbHVlLmluY2x1ZGVzKCdAX19QVVJFX18nKSB8fFxuICAgICAgICB2YWx1ZS5pbmNsdWRlcygnI19fUFVSRV9fJykgfHxcbiAgICAgICAgdmFsdWUuaW5jbHVkZXMoJ0BwdXJlT3JCcmVha015Q29kZScpLFxuICAgIClcbiAgKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gYXNzaWdubWVudFZhbHVlLmlzUHVyZSgpO1xufVxuXG4vKipcbiAqIEFuYWx5emUgdGhlIHNpYmxpbmcgbm9kZXMgb2YgYSBjbGFzcyB0byBkZXRlcm1pbmUgaWYgYW55IGRvd25sZXZlbCBlbGVtZW50cyBzaG91bGQgYmVcbiAqIHdyYXBwZWQgaW4gYSBwdXJlIGFubm90YXRlZCBJSUZFLiBBbHNvIGRldGVybWluZXMgaWYgYW55IGVsZW1lbnRzIGhhdmUgcG90ZW50aWFsIHNpZGVcbiAqIGVmZmVjdHMuXG4gKlxuICogQHBhcmFtIG9yaWdpbiBUaGUgc3RhcnRpbmcgTm9kZVBhdGggbG9jYXRpb24gZm9yIGFuYWx5emluZyBzaWJsaW5ncy5cbiAqIEBwYXJhbSBjbGFzc0lkZW50aWZpZXIgVGhlIGlkZW50aWZpZXIgbm9kZSB0aGF0IHJlcHJlc2VudHMgdGhlIG5hbWUgb2YgdGhlIGNsYXNzLlxuICogQHBhcmFtIGFsbG93V3JhcHBpbmdEZWNvcmF0b3JzIFdoZXRoZXIgdG8gYWxsb3cgZGVjb3JhdG9ycyB0byBiZSB3cmFwcGVkLlxuICogQHJldHVybnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHJlc3VsdHMgb2YgdGhlIGFuYWx5c2lzLlxuICovXG5mdW5jdGlvbiBhbmFseXplQ2xhc3NTaWJsaW5ncyhcbiAgb3JpZ2luOiBOb2RlUGF0aCxcbiAgY2xhc3NJZGVudGlmaWVyOiB0eXBlcy5JZGVudGlmaWVyLFxuICBhbGxvd1dyYXBwaW5nRGVjb3JhdG9yczogYm9vbGVhbixcbik6IHsgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHM6IGJvb2xlYW47IHdyYXBTdGF0ZW1lbnRQYXRoczogTm9kZVBhdGg8dHlwZXMuU3RhdGVtZW50PltdIH0ge1xuICBjb25zdCB3cmFwU3RhdGVtZW50UGF0aHM6IE5vZGVQYXRoPHR5cGVzLlN0YXRlbWVudD5bXSA9IFtdO1xuICBsZXQgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMgPSBmYWxzZTtcbiAgZm9yIChsZXQgaSA9IDE7IDsgKytpKSB7XG4gICAgY29uc3QgbmV4dFN0YXRlbWVudCA9IG9yaWdpbi5nZXRTaWJsaW5nKCtvcmlnaW4ua2V5ICsgaSk7XG4gICAgaWYgKCFuZXh0U3RhdGVtZW50LmlzRXhwcmVzc2lvblN0YXRlbWVudCgpKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyBWYWxpZCBzaWJsaW5nIHN0YXRlbWVudHMgZm9yIGNsYXNzIGRlY2xhcmF0aW9ucyBhcmUgb25seSBhc3NpZ25tZW50IGV4cHJlc3Npb25zXG4gICAgLy8gYW5kIFR5cGVTY3JpcHQgZGVjb3JhdG9yIGhlbHBlciBjYWxsIGV4cHJlc3Npb25zXG4gICAgY29uc3QgbmV4dEV4cHJlc3Npb24gPSBuZXh0U3RhdGVtZW50LmdldCgnZXhwcmVzc2lvbicpO1xuICAgIGlmIChuZXh0RXhwcmVzc2lvbi5pc0NhbGxFeHByZXNzaW9uKCkpIHtcbiAgICAgIGlmIChcbiAgICAgICAgIXR5cGVzLmlzSWRlbnRpZmllcihuZXh0RXhwcmVzc2lvbi5ub2RlLmNhbGxlZSkgfHxcbiAgICAgICAgbmV4dEV4cHJlc3Npb24ubm9kZS5jYWxsZWUubmFtZSAhPT0gVFNMSUJfREVDT1JBVEVfSEVMUEVSX05BTUVcbiAgICAgICkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgaWYgKGFsbG93V3JhcHBpbmdEZWNvcmF0b3JzKSB7XG4gICAgICAgIHdyYXBTdGF0ZW1lbnRQYXRocy5wdXNoKG5leHRTdGF0ZW1lbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gU3RhdGVtZW50IGNhbm5vdCBiZSBzYWZlbHkgd3JhcHBlZCB3aGljaCBtYWtlcyB3cmFwcGluZyB0aGUgY2xhc3MgdW5uZWVkZWQuXG4gICAgICAgIC8vIFRoZSBzdGF0ZW1lbnQgd2lsbCBwcmV2ZW50IGV2ZW4gYSB3cmFwcGVkIGNsYXNzIGZyb20gYmVpbmcgb3B0aW1pemVkIGF3YXkuXG4gICAgICAgIGhhc1BvdGVudGlhbFNpZGVFZmZlY3RzID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgY29udGludWU7XG4gICAgfSBlbHNlIGlmICghbmV4dEV4cHJlc3Npb24uaXNBc3NpZ25tZW50RXhwcmVzc2lvbigpKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyBWYWxpZCBhc3NpZ25tZW50IGV4cHJlc3Npb25zIHNob3VsZCBiZSBtZW1iZXIgYWNjZXNzIGV4cHJlc3Npb25zIHVzaW5nIHRoZSBjbGFzc1xuICAgIC8vIG5hbWUgYXMgdGhlIG9iamVjdCBhbmQgYW4gaWRlbnRpZmllciBhcyB0aGUgcHJvcGVydHkgZm9yIHN0YXRpYyBmaWVsZHMgb3Igb25seVxuICAgIC8vIHRoZSBjbGFzcyBuYW1lIGZvciBkZWNvcmF0b3JzLlxuICAgIGNvbnN0IGxlZnQgPSBuZXh0RXhwcmVzc2lvbi5nZXQoJ2xlZnQnKTtcbiAgICBpZiAobGVmdC5pc0lkZW50aWZpZXIoKSkge1xuICAgICAgaWYgKFxuICAgICAgICAhbGVmdC5zY29wZS5iaW5kaW5nSWRlbnRpZmllckVxdWFscyhsZWZ0Lm5vZGUubmFtZSwgY2xhc3NJZGVudGlmaWVyKSB8fFxuICAgICAgICAhdHlwZXMuaXNDYWxsRXhwcmVzc2lvbihuZXh0RXhwcmVzc2lvbi5ub2RlLnJpZ2h0KSB8fFxuICAgICAgICAhdHlwZXMuaXNJZGVudGlmaWVyKG5leHRFeHByZXNzaW9uLm5vZGUucmlnaHQuY2FsbGVlKSB8fFxuICAgICAgICBuZXh0RXhwcmVzc2lvbi5ub2RlLnJpZ2h0LmNhbGxlZS5uYW1lICE9PSBUU0xJQl9ERUNPUkFURV9IRUxQRVJfTkFNRVxuICAgICAgKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBpZiAoYWxsb3dXcmFwcGluZ0RlY29yYXRvcnMpIHtcbiAgICAgICAgd3JhcFN0YXRlbWVudFBhdGhzLnB1c2gobmV4dFN0YXRlbWVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTdGF0ZW1lbnQgY2Fubm90IGJlIHNhZmVseSB3cmFwcGVkIHdoaWNoIG1ha2VzIHdyYXBwaW5nIHRoZSBjbGFzcyB1bm5lZWRlZC5cbiAgICAgICAgLy8gVGhlIHN0YXRlbWVudCB3aWxsIHByZXZlbnQgZXZlbiBhIHdyYXBwZWQgY2xhc3MgZnJvbSBiZWluZyBvcHRpbWl6ZWQgYXdheS5cbiAgICAgICAgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBjb250aW51ZTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgIWxlZnQuaXNNZW1iZXJFeHByZXNzaW9uKCkgfHxcbiAgICAgICF0eXBlcy5pc0lkZW50aWZpZXIobGVmdC5ub2RlLm9iamVjdCkgfHxcbiAgICAgICFsZWZ0LnNjb3BlLmJpbmRpbmdJZGVudGlmaWVyRXF1YWxzKGxlZnQubm9kZS5vYmplY3QubmFtZSwgY2xhc3NJZGVudGlmaWVyKSB8fFxuICAgICAgIXR5cGVzLmlzSWRlbnRpZmllcihsZWZ0Lm5vZGUucHJvcGVydHkpXG4gICAgKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjb25zdCBwcm9wZXJ0eU5hbWUgPSBsZWZ0Lm5vZGUucHJvcGVydHkubmFtZTtcbiAgICBjb25zdCBhc3NpZ25tZW50VmFsdWUgPSBuZXh0RXhwcmVzc2lvbi5nZXQoJ3JpZ2h0Jyk7XG4gICAgaWYgKGFuZ3VsYXJTdGF0aWNzVG9FbGlkZVtwcm9wZXJ0eU5hbWVdPy4oYXNzaWdubWVudFZhbHVlKSkge1xuICAgICAgbmV4dFN0YXRlbWVudC5yZW1vdmUoKTtcbiAgICAgIC0taTtcbiAgICB9IGVsc2UgaWYgKGNhbldyYXBQcm9wZXJ0eShwcm9wZXJ0eU5hbWUsIGFzc2lnbm1lbnRWYWx1ZSkpIHtcbiAgICAgIHdyYXBTdGF0ZW1lbnRQYXRocy5wdXNoKG5leHRTdGF0ZW1lbnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTdGF0ZW1lbnQgY2Fubm90IGJlIHNhZmVseSB3cmFwcGVkIHdoaWNoIG1ha2VzIHdyYXBwaW5nIHRoZSBjbGFzcyB1bm5lZWRlZC5cbiAgICAgIC8vIFRoZSBzdGF0ZW1lbnQgd2lsbCBwcmV2ZW50IGV2ZW4gYSB3cmFwcGVkIGNsYXNzIGZyb20gYmVpbmcgb3B0aW1pemVkIGF3YXkuXG4gICAgICBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMsIHdyYXBTdGF0ZW1lbnRQYXRocyB9O1xufVxuXG4vKipcbiAqIFRoZSBzZXQgb2YgY2xhc3NlZCBhbHJlYWR5IHZpc2l0ZWQgYW5kIGFuYWx5emVkIGR1cmluZyB0aGUgcGx1Z2luJ3MgZXhlY3V0aW9uLlxuICogVGhpcyBpcyB1c2VkIHRvIHByZXZlbnQgYWRqdXN0ZWQgY2xhc3NlcyBmcm9tIGJlaW5nIHJlcGVhdGVkbHkgYW5hbHl6ZWQgd2hpY2ggY2FuIGxlYWRcbiAqIHRvIGFuIGluZmluaXRlIGxvb3AuXG4gKi9cbmNvbnN0IHZpc2l0ZWRDbGFzc2VzID0gbmV3IFdlYWtTZXQ8dHlwZXMuQ2xhc3M+KCk7XG5cbi8qKlxuICogQSBiYWJlbCBwbHVnaW4gZmFjdG9yeSBmdW5jdGlvbiBmb3IgYWRqdXN0aW5nIGNsYXNzZXM7IHByaW1hcmlseSB3aXRoIEFuZ3VsYXIgbWV0YWRhdGEuXG4gKiBUaGUgYWRqdXN0bWVudHMgaW5jbHVkZSB3cmFwcGluZyBjbGFzc2VzIHdpdGgga25vd24gc2FmZSBvciBubyBzaWRlIGVmZmVjdHMgd2l0aCBwdXJlXG4gKiBhbm5vdGF0aW9ucyB0byBzdXBwb3J0IGRlYWQgY29kZSByZW1vdmFsIG9mIHVudXNlZCBjbGFzc2VzLiBBbmd1bGFyIGNvbXBpbGVyIGdlbmVyYXRlZFxuICogbWV0YWRhdGEgc3RhdGljIGZpZWxkcyBub3QgcmVxdWlyZWQgaW4gQU9UIG1vZGUgYXJlIGFsc28gZWxpZGVkIHRvIGJldHRlciBzdXBwb3J0IGJ1bmRsZXItXG4gKiBsZXZlbCB0cmVlc2hha2luZy5cbiAqXG4gKiBAcmV0dXJucyBBIGJhYmVsIHBsdWdpbiBvYmplY3QgaW5zdGFuY2UuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICgpOiBQbHVnaW5PYmoge1xuICByZXR1cm4ge1xuICAgIHZpc2l0b3I6IHtcbiAgICAgIENsYXNzRGVjbGFyYXRpb24ocGF0aDogTm9kZVBhdGg8dHlwZXMuQ2xhc3NEZWNsYXJhdGlvbj4sIHN0YXRlOiBQbHVnaW5QYXNzKSB7XG4gICAgICAgIGNvbnN0IHsgbm9kZTogY2xhc3NOb2RlLCBwYXJlbnRQYXRoIH0gPSBwYXRoO1xuICAgICAgICBjb25zdCB7IHdyYXBEZWNvcmF0b3JzIH0gPSBzdGF0ZS5vcHRzIGFzIHsgd3JhcERlY29yYXRvcnM6IGJvb2xlYW4gfTtcblxuICAgICAgICBpZiAodmlzaXRlZENsYXNzZXMuaGFzKGNsYXNzTm9kZSkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBbmFseXplIHNpYmxpbmcgc3RhdGVtZW50cyBmb3IgZWxlbWVudHMgb2YgdGhlIGNsYXNzIHRoYXQgd2VyZSBkb3dubGV2ZWxlZFxuICAgICAgICBjb25zdCBoYXNFeHBvcnQgPVxuICAgICAgICAgIHBhcmVudFBhdGguaXNFeHBvcnROYW1lZERlY2xhcmF0aW9uKCkgfHwgcGFyZW50UGF0aC5pc0V4cG9ydERlZmF1bHREZWNsYXJhdGlvbigpO1xuICAgICAgICBjb25zdCBvcmlnaW4gPSBoYXNFeHBvcnQgPyBwYXJlbnRQYXRoIDogcGF0aDtcbiAgICAgICAgY29uc3QgeyB3cmFwU3RhdGVtZW50UGF0aHMsIGhhc1BvdGVudGlhbFNpZGVFZmZlY3RzIH0gPSBhbmFseXplQ2xhc3NTaWJsaW5ncyhcbiAgICAgICAgICBvcmlnaW4sXG4gICAgICAgICAgY2xhc3NOb2RlLmlkLFxuICAgICAgICAgIHdyYXBEZWNvcmF0b3JzLFxuICAgICAgICApO1xuXG4gICAgICAgIHZpc2l0ZWRDbGFzc2VzLmFkZChjbGFzc05vZGUpO1xuXG4gICAgICAgIGlmIChoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyB8fCB3cmFwU3RhdGVtZW50UGF0aHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd3JhcFN0YXRlbWVudE5vZGVzOiB0eXBlcy5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IHN0YXRlbWVudFBhdGggb2Ygd3JhcFN0YXRlbWVudFBhdGhzKSB7XG4gICAgICAgICAgd3JhcFN0YXRlbWVudE5vZGVzLnB1c2goc3RhdGVtZW50UGF0aC5ub2RlKTtcbiAgICAgICAgICBzdGF0ZW1lbnRQYXRoLnJlbW92ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gV3JhcCBjbGFzcyBhbmQgc2FmZSBzdGF0aWMgYXNzaWdubWVudHMgaW4gYSBwdXJlIGFubm90YXRlZCBJSUZFXG4gICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IHR5cGVzLmFycm93RnVuY3Rpb25FeHByZXNzaW9uKFxuICAgICAgICAgIFtdLFxuICAgICAgICAgIHR5cGVzLmJsb2NrU3RhdGVtZW50KFtcbiAgICAgICAgICAgIGNsYXNzTm9kZSxcbiAgICAgICAgICAgIC4uLndyYXBTdGF0ZW1lbnROb2RlcyxcbiAgICAgICAgICAgIHR5cGVzLnJldHVyblN0YXRlbWVudCh0eXBlcy5jbG9uZU5vZGUoY2xhc3NOb2RlLmlkKSksXG4gICAgICAgICAgXSksXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IHJlcGxhY2VtZW50SW5pdGlhbGl6ZXIgPSB0eXBlcy5jYWxsRXhwcmVzc2lvbihcbiAgICAgICAgICB0eXBlcy5wYXJlbnRoZXNpemVkRXhwcmVzc2lvbihjb250YWluZXIpLFxuICAgICAgICAgIFtdLFxuICAgICAgICApO1xuICAgICAgICBhbm5vdGF0ZUFzUHVyZShyZXBsYWNlbWVudEluaXRpYWxpemVyKTtcblxuICAgICAgICAvLyBSZXBsYWNlIGNsYXNzIHdpdGggSUlGRSB3cmFwcGVkIGNsYXNzXG4gICAgICAgIGNvbnN0IGRlY2xhcmF0aW9uID0gdHlwZXMudmFyaWFibGVEZWNsYXJhdGlvbignbGV0JywgW1xuICAgICAgICAgIHR5cGVzLnZhcmlhYmxlRGVjbGFyYXRvcih0eXBlcy5jbG9uZU5vZGUoY2xhc3NOb2RlLmlkKSwgcmVwbGFjZW1lbnRJbml0aWFsaXplciksXG4gICAgICAgIF0pO1xuICAgICAgICBpZiAocGFyZW50UGF0aC5pc0V4cG9ydERlZmF1bHREZWNsYXJhdGlvbigpKSB7XG4gICAgICAgICAgLy8gV2hlbiBjb252ZXJ0ZWQgdG8gYSB2YXJpYWJsZSBkZWNsYXJhdGlvbiwgdGhlIGRlZmF1bHQgZXhwb3J0IG11c3QgYmUgbW92ZWRcbiAgICAgICAgICAvLyB0byBhIHN1YnNlcXVlbnQgc3RhdGVtZW50IHRvIHByZXZlbnQgYSBKYXZhU2NyaXB0IHN5bnRheCBlcnJvci5cbiAgICAgICAgICBwYXJlbnRQYXRoLnJlcGxhY2VXaXRoTXVsdGlwbGUoW1xuICAgICAgICAgICAgZGVjbGFyYXRpb24sXG4gICAgICAgICAgICB0eXBlcy5leHBvcnROYW1lZERlY2xhcmF0aW9uKHVuZGVmaW5lZCwgW1xuICAgICAgICAgICAgICB0eXBlcy5leHBvcnRTcGVjaWZpZXIodHlwZXMuY2xvbmVOb2RlKGNsYXNzTm9kZS5pZCksIHR5cGVzLmlkZW50aWZpZXIoJ2RlZmF1bHQnKSksXG4gICAgICAgICAgICBdKSxcbiAgICAgICAgICBdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwYXRoLnJlcGxhY2VXaXRoKGRlY2xhcmF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIENsYXNzRXhwcmVzc2lvbihwYXRoOiBOb2RlUGF0aDx0eXBlcy5DbGFzc0V4cHJlc3Npb24+LCBzdGF0ZTogUGx1Z2luUGFzcykge1xuICAgICAgICBjb25zdCB7IG5vZGU6IGNsYXNzTm9kZSwgcGFyZW50UGF0aCB9ID0gcGF0aDtcbiAgICAgICAgY29uc3QgeyB3cmFwRGVjb3JhdG9ycyB9ID0gc3RhdGUub3B0cyBhcyB7IHdyYXBEZWNvcmF0b3JzOiBib29sZWFuIH07XG5cbiAgICAgICAgLy8gQ2xhc3MgZXhwcmVzc2lvbnMgYXJlIHVzZWQgYnkgVHlwZVNjcmlwdCB0byByZXByZXNlbnQgZG93bmxldmVsIGNsYXNzL2NvbnN0cnVjdG9yIGRlY29yYXRvcnMuXG4gICAgICAgIC8vIElmIG5vdCB3cmFwcGluZyBkZWNvcmF0b3JzLCB0aGV5IGRvIG5vdCBuZWVkIHRvIGJlIHByb2Nlc3NlZC5cbiAgICAgICAgaWYgKCF3cmFwRGVjb3JhdG9ycyB8fCB2aXNpdGVkQ2xhc3Nlcy5oYXMoY2xhc3NOb2RlKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAhY2xhc3NOb2RlLmlkIHx8XG4gICAgICAgICAgIXBhcmVudFBhdGguaXNWYXJpYWJsZURlY2xhcmF0b3IoKSB8fFxuICAgICAgICAgICF0eXBlcy5pc0lkZW50aWZpZXIocGFyZW50UGF0aC5ub2RlLmlkKSB8fFxuICAgICAgICAgIHBhcmVudFBhdGgubm9kZS5pZC5uYW1lICE9PSBjbGFzc05vZGUuaWQubmFtZVxuICAgICAgICApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvcmlnaW4gPSBwYXJlbnRQYXRoLnBhcmVudFBhdGg7XG4gICAgICAgIGlmICghb3JpZ2luLmlzVmFyaWFibGVEZWNsYXJhdGlvbigpIHx8IG9yaWdpbi5ub2RlLmRlY2xhcmF0aW9ucy5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IHdyYXBTdGF0ZW1lbnRQYXRocywgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMgfSA9IGFuYWx5emVDbGFzc1NpYmxpbmdzKFxuICAgICAgICAgIG9yaWdpbixcbiAgICAgICAgICBwYXJlbnRQYXRoLm5vZGUuaWQsXG4gICAgICAgICAgd3JhcERlY29yYXRvcnMsXG4gICAgICAgICk7XG5cbiAgICAgICAgdmlzaXRlZENsYXNzZXMuYWRkKGNsYXNzTm9kZSk7XG5cbiAgICAgICAgaWYgKGhhc1BvdGVudGlhbFNpZGVFZmZlY3RzIHx8IHdyYXBTdGF0ZW1lbnRQYXRocy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB3cmFwU3RhdGVtZW50Tm9kZXM6IHR5cGVzLlN0YXRlbWVudFtdID0gW107XG4gICAgICAgIGZvciAoY29uc3Qgc3RhdGVtZW50UGF0aCBvZiB3cmFwU3RhdGVtZW50UGF0aHMpIHtcbiAgICAgICAgICB3cmFwU3RhdGVtZW50Tm9kZXMucHVzaChzdGF0ZW1lbnRQYXRoLm5vZGUpO1xuICAgICAgICAgIHN0YXRlbWVudFBhdGgucmVtb3ZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBXcmFwIGNsYXNzIGFuZCBzYWZlIHN0YXRpYyBhc3NpZ25tZW50cyBpbiBhIHB1cmUgYW5ub3RhdGVkIElJRkVcbiAgICAgICAgY29uc3QgY29udGFpbmVyID0gdHlwZXMuYXJyb3dGdW5jdGlvbkV4cHJlc3Npb24oXG4gICAgICAgICAgW10sXG4gICAgICAgICAgdHlwZXMuYmxvY2tTdGF0ZW1lbnQoW1xuICAgICAgICAgICAgdHlwZXMudmFyaWFibGVEZWNsYXJhdGlvbignbGV0JywgW1xuICAgICAgICAgICAgICB0eXBlcy52YXJpYWJsZURlY2xhcmF0b3IodHlwZXMuY2xvbmVOb2RlKGNsYXNzTm9kZS5pZCksIGNsYXNzTm9kZSksXG4gICAgICAgICAgICBdKSxcbiAgICAgICAgICAgIC4uLndyYXBTdGF0ZW1lbnROb2RlcyxcbiAgICAgICAgICAgIHR5cGVzLnJldHVyblN0YXRlbWVudCh0eXBlcy5jbG9uZU5vZGUoY2xhc3NOb2RlLmlkKSksXG4gICAgICAgICAgXSksXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IHJlcGxhY2VtZW50SW5pdGlhbGl6ZXIgPSB0eXBlcy5jYWxsRXhwcmVzc2lvbihcbiAgICAgICAgICB0eXBlcy5wYXJlbnRoZXNpemVkRXhwcmVzc2lvbihjb250YWluZXIpLFxuICAgICAgICAgIFtdLFxuICAgICAgICApO1xuICAgICAgICBhbm5vdGF0ZUFzUHVyZShyZXBsYWNlbWVudEluaXRpYWxpemVyKTtcblxuICAgICAgICAvLyBBZGQgdGhlIHdyYXBwZWQgY2xhc3MgZGlyZWN0bHkgdG8gdGhlIHZhcmlhYmxlIGRlY2xhcmF0aW9uXG4gICAgICAgIHBhcmVudFBhdGguZ2V0KCdpbml0JykucmVwbGFjZVdpdGgocmVwbGFjZW1lbnRJbml0aWFsaXplcik7XG4gICAgICB9LFxuICAgIH0sXG4gIH07XG59XG4iXX0=