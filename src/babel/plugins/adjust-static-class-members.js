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
                if (hasPotentialSideEffects) {
                    return;
                }
                // If no statements to wrap, check for static class properties.
                // Static class properties may be downleveled at later stages in the build pipeline
                // which results in additional function calls outside the class body. These calls
                // then cause the class to be referenced and not eligible for removal. Since it is
                // not known at this stage whether the class needs to be downleveled, the transform
                // wraps classes preemptively to allow for potential removal within the optimization
                // stages.
                if (wrapStatementPaths.length === 0) {
                    let shouldWrap = false;
                    for (const element of path.get('body').get('body')) {
                        if (element.isClassProperty()) {
                            // Only need to analyze static properties
                            if (!element.node.static) {
                                continue;
                            }
                            // Check for potential side effects.
                            // These checks are conservative and could potentially be expanded in the future.
                            const elementKey = element.get('key');
                            const elementValue = element.get('value');
                            if (elementKey.isIdentifier() &&
                                (!elementValue.isExpression() ||
                                    canWrapProperty(elementKey.get('name'), elementValue))) {
                                shouldWrap = true;
                            }
                            else {
                                // Not safe to wrap
                                shouldWrap = false;
                                break;
                            }
                        }
                    }
                    if (!shouldWrap) {
                        return;
                    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRqdXN0LXN0YXRpYy1jbGFzcy1tZW1iZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYmFiZWwvcGx1Z2lucy9hZGp1c3Qtc3RhdGljLWNsYXNzLW1lbWJlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgsc0NBQXFFO0FBQ3JFLDZGQUE0RDtBQUU1RDs7R0FFRztBQUNILE1BQU0sMEJBQTBCLEdBQUcsWUFBWSxDQUFDO0FBRWhEOzs7O0dBSUc7QUFDSCxNQUFNLG9CQUFvQixHQUFHLElBQUksR0FBRyxDQUFDO0lBQ25DLE1BQU07SUFDTixNQUFNO0lBQ04sTUFBTTtJQUNOLE1BQU07SUFDTixNQUFNO0lBQ04sT0FBTztJQUNQLE9BQU87SUFDUCxjQUFjO0NBQ2YsQ0FBQyxDQUFDO0FBRUg7OztHQUdHO0FBQ0gsTUFBTSxxQkFBcUIsR0FBa0U7SUFDM0YsZ0JBQWdCLENBQUMsSUFBSTtRQUNuQixPQUFPLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO0lBQ3pFLENBQUM7SUFDRCxZQUFZLENBQUMsSUFBSTtRQUNmLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7SUFDbEMsQ0FBQztJQUNELGdCQUFnQixDQUFDLElBQUk7UUFDbkIsT0FBTyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztJQUNuQyxDQUFDO0NBQ0YsQ0FBQztBQUVGOzs7OztHQUtHO0FBQ0gsU0FBZ0IsV0FBVztJQUN6QixPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDbkIsQ0FBQztBQUZELGtDQUVDO0FBRUQ7Ozs7Ozs7O0dBUUc7QUFDSCxTQUFTLGVBQWUsQ0FBQyxZQUFvQixFQUFFLGVBQXlCO0lBQ3RFLElBQUksb0JBQW9CLENBQUMs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LENBQUMsZUFBZSxDQUFDLFlBQUssQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2lCQUNyRCxDQUFDLENBQ0gsQ0FBQztnQkFDRixNQUFNLHNCQUFzQixHQUFHLFlBQUssQ0FBQyxjQUFjLENBQ2pELFlBQUssQ0FBQyx1QkFBdUIsQ0FBQyxTQUFTLENBQUMsRUFDeEMsRUFBRSxDQUNILENBQUM7Z0JBQ0YsSUFBQSxpQ0FBYyxFQUFDLHNCQUFzQixDQUFDLENBQUM7Z0JBRXZDLDZEQUE2RDtnQkFDN0QsVUFBVSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLENBQUMsc0JBQXNCLENBQUMsQ0FBQztZQUM3RCxDQUFDO1NBQ0Y7S0FDRixDQUFDO0FBQ0osQ0FBQztBQXZLRCw0QkF1S0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgTm9kZVBhdGgsIFBsdWdpbk9iaiwgUGx1Z2luUGFzcywgdHlwZXMgfSBmcm9tICdAYmFiZWwvY29yZSc7XG5pbXBvcnQgYW5ub3RhdGVBc1B1cmUgZnJvbSAnQGJhYmVsL2hlbHBlci1hbm5vdGF0ZS1hcy1wdXJlJztcblxuLyoqXG4gKiBUaGUgbmFtZSBvZiB0aGUgVHlwZXNjcmlwdCBkZWNvcmF0b3IgaGVscGVyIGZ1bmN0aW9uIGNyZWF0ZWQgYnkgdGhlIFR5cGVTY3JpcHQgY29tcGlsZXIuXG4gKi9cbmNvbnN0IFRTTElCX0RFQ09SQVRFX0hFTFBFUl9OQU1FID0gJ19fZGVjb3JhdGUnO1xuXG4vKipcbiAqIFRoZSBzZXQgb2YgQW5ndWxhciBzdGF0aWMgZmllbGRzIHRoYXQgc2hvdWxkIGFsd2F5cyBiZSB3cmFwcGVkLlxuICogVGhlc2UgZmllbGRzIG1heSBhcHBlYXIgdG8gaGF2ZSBzaWRlIGVmZmVjdHMgYnV0IGFyZSBzYWZlIHRvIHJlbW92ZSBpZiB0aGUgYXNzb2NpYXRlZCBjbGFzc1xuICogaXMgb3RoZXJ3aXNlIHVudXNlZCB3aXRoaW4gdGhlIG91dHB1dC5cbiAqL1xuY29uc3QgYW5ndWxhclN0YXRpY3NUb1dyYXAgPSBuZXcgU2V0KFtcbiAgJ8m1Y21wJyxcbiAgJ8m1ZGlyJyxcbiAgJ8m1ZmFjJyxcbiAgJ8m1aW5qJyxcbiAgJ8m1bW9kJyxcbiAgJ8m1cGlwZScsXG4gICfJtXByb3YnLFxuICAnSU5KRUNUT1JfS0VZJyxcbl0pO1xuXG4vKipcbiAqIEFuIG9iamVjdCBtYXAgb2Ygc3RhdGljIGZpZWxkcyBhbmQgcmVsYXRlZCB2YWx1ZSBjaGVja3MgZm9yIGRpc2NvdmVyeSBvZiBBbmd1bGFyIGdlbmVyYXRlZFxuICogSklUIHJlbGF0ZWQgc3RhdGljIGZpZWxkcy5cbiAqL1xuY29uc3QgYW5ndWxhclN0YXRpY3NUb0VsaWRlOiBSZWNvcmQ8c3RyaW5nLCAocGF0aDogTm9kZVBhdGg8dHlwZXMuRXhwcmVzc2lvbj4pID0+IGJvb2xlYW4+ID0ge1xuICAnY3RvclBhcmFtZXRlcnMnKHBhdGgpIHtcbiAgICByZXR1cm4gcGF0aC5pc0Z1bmN0aW9uRXhwcmVzc2lvbigpIHx8IHBhdGguaXNBcnJvd0Z1bmN0aW9uRXhwcmVzc2lvbigpO1xuICB9LFxuICAnZGVjb3JhdG9ycycocGF0aCkge1xuICAgIHJldHVybiBwYXRoLmlzQXJyYXlFeHByZXNzaW9uKCk7XG4gIH0sXG4gICdwcm9wRGVjb3JhdG9ycycocGF0aCkge1xuICAgIHJldHVybiBwYXRoLmlzT2JqZWN0RXhwcmVzc2lvbigpO1xuICB9LFxufTtcblxuLyoqXG4gKiBQcm92aWRlcyBvbmUgb3IgbW9yZSBrZXl3b3JkcyB0aGF0IGlmIGZvdW5kIHdpdGhpbiB0aGUgY29udGVudCBvZiBhIHNvdXJjZSBmaWxlIGluZGljYXRlXG4gKiB0aGF0IHRoaXMgcGx1Z2luIHNob3VsZCBiZSB1c2VkIHdpdGggYSBzb3VyY2UgZmlsZS5cbiAqXG4gKiBAcmV0dXJucyBBbiBhIHN0cmluZyBpdGVyYWJsZSBjb250YWluaW5nIG9uZSBvciBtb3JlIGtleXdvcmRzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0S2V5d29yZHMoKTogSXRlcmFibGU8c3RyaW5nPiB7XG4gIHJldHVybiBbJ2NsYXNzJ107XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lcyB3aGV0aGVyIGEgcHJvcGVydHkgYW5kIGl0cyBpbml0aWFsaXplciB2YWx1ZSBjYW4gYmUgc2FmZWx5IHdyYXBwZWQgaW4gYSBwdXJlXG4gKiBhbm5vdGF0ZWQgSUlGRS4gVmFsdWVzIHRoYXQgbWF5IGNhdXNlIHNpZGUgZWZmZWN0cyBhcmUgbm90IGNvbnNpZGVyZWQgc2FmZSB0byB3cmFwLlxuICogV3JhcHBpbmcgc3VjaCB2YWx1ZXMgbWF5IGNhdXNlIHJ1bnRpbWUgZXJyb3JzIGFuZC9vciBpbmNvcnJlY3QgcnVudGltZSBiZWhhdmlvci5cbiAqXG4gKiBAcGFyYW0gcHJvcGVydHlOYW1lIFRoZSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSB0byBhbmFseXplLlxuICogQHBhcmFtIGFzc2lnbm1lbnRWYWx1ZSBUaGUgaW5pdGlhbGl6ZXIgdmFsdWUgdGhhdCB3aWxsIGJlIGFzc2lnbmVkIHRvIHRoZSBwcm9wZXJ0eS5cbiAqIEByZXR1cm5zIElmIHRoZSBwcm9wZXJ0eSBjYW4gYmUgc2FmZWx5IHdyYXBwZWQsIHRoZW4gdHJ1ZTsgb3RoZXJ3aXNlLCBmYWxzZS5cbiAqL1xuZnVuY3Rpb24gY2FuV3JhcFByb3BlcnR5KHByb3BlcnR5TmFtZTogc3RyaW5nLCBhc3NpZ25tZW50VmFsdWU6IE5vZGVQYXRoKTogYm9vbGVhbiB7XG4gIGlmIChhbmd1bGFyU3RhdGljc1RvV3JhcC5oYXMocHJvcGVydHlOYW1lKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgY29uc3QgeyBsZWFkaW5nQ29tbWVudHMgfSA9IGFzc2lnbm1lbnRWYWx1ZS5ub2RlIGFzIHsgbGVhZGluZ0NvbW1lbnRzPzogeyB2YWx1ZTogc3RyaW5nIH1bXSB9O1xuICBpZiAoXG4gICAgbGVhZGluZ0NvbW1lbnRzPy5zb21lKFxuICAgICAgLy8gYEBwdXJlT3JCcmVha015Q29kZWAgaXMgdXNlZCBieSBjbG9zdXJlIGFuZCBpcyBwcmVzZW50IGluIEFuZ3VsYXIgY29kZVxuICAgICAgKHsgdmFsdWUgfSkgPT5cbiAgICAgICAgdmFsdWUuaW5jbHVkZXMoJ0BfX1BVUkVfXycpIHx8XG4gICAgICAgIHZhbHVlLmluY2x1ZGVzKCcjX19QVVJFX18nKSB8fFxuICAgICAgICB2YWx1ZS5pbmNsdWRlcygnQHB1cmVPckJyZWFrTXlDb2RlJyksXG4gICAgKVxuICApIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHJldHVybiBhc3NpZ25tZW50VmFsdWUuaXNQdXJlKCk7XG59XG5cbi8qKlxuICogQW5hbHl6ZSB0aGUgc2libGluZyBub2RlcyBvZiBhIGNsYXNzIHRvIGRldGVybWluZSBpZiBhbnkgZG93bmxldmVsIGVsZW1lbnRzIHNob3VsZCBiZVxuICogd3JhcHBlZCBpbiBhIHB1cmUgYW5ub3RhdGVkIElJRkUuIEFsc28gZGV0ZXJtaW5lcyBpZiBhbnkgZWxlbWVudHMgaGF2ZSBwb3RlbnRpYWwgc2lkZVxuICogZWZmZWN0cy5cbiAqXG4gKiBAcGFyYW0gb3JpZ2luIFRoZSBzdGFydGluZyBOb2RlUGF0aCBsb2NhdGlvbiBmb3IgYW5hbHl6aW5nIHNpYmxpbmdzLlxuICogQHBhcmFtIGNsYXNzSWRlbnRpZmllciBUaGUgaWRlbnRpZmllciBub2RlIHRoYXQgcmVwcmVzZW50cyB0aGUgbmFtZSBvZiB0aGUgY2xhc3MuXG4gKiBAcGFyYW0gYWxsb3dXcmFwcGluZ0RlY29yYXRvcnMgV2hldGhlciB0byBhbGxvdyBkZWNvcmF0b3JzIHRvIGJlIHdyYXBwZWQuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgcmVzdWx0cyBvZiB0aGUgYW5hbHlzaXMuXG4gKi9cbmZ1bmN0aW9uIGFuYWx5emVDbGFzc1NpYmxpbmdzKFxuICBvcmlnaW46IE5vZGVQYXRoLFxuICBjbGFzc0lkZW50aWZpZXI6IHR5cGVzLklkZW50aWZpZXIsXG4gIGFsbG93V3JhcHBpbmdEZWNvcmF0b3JzOiBib29sZWFuLFxuKTogeyBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0czogYm9vbGVhbjsgd3JhcFN0YXRlbWVudFBhdGhzOiBOb2RlUGF0aDx0eXBlcy5TdGF0ZW1lbnQ+W10gfSB7XG4gIGNvbnN0IHdyYXBTdGF0ZW1lbnRQYXRoczogTm9kZVBhdGg8dHlwZXMuU3RhdGVtZW50PltdID0gW107XG4gIGxldCBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyA9IGZhbHNlO1xuICBmb3IgKGxldCBpID0gMTsgOyArK2kpIHtcbiAgICBjb25zdCBuZXh0U3RhdGVtZW50ID0gb3JpZ2luLmdldFNpYmxpbmcoK29yaWdpbi5rZXkgKyBpKTtcbiAgICBpZiAoIW5leHRTdGF0ZW1lbnQuaXNFeHByZXNzaW9uU3RhdGVtZW50KCkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIFZhbGlkIHNpYmxpbmcgc3RhdGVtZW50cyBmb3IgY2xhc3MgZGVjbGFyYXRpb25zIGFyZSBvbmx5IGFzc2lnbm1lbnQgZXhwcmVzc2lvbnNcbiAgICAvLyBhbmQgVHlwZVNjcmlwdCBkZWNvcmF0b3IgaGVscGVyIGNhbGwgZXhwcmVzc2lvbnNcbiAgICBjb25zdCBuZXh0RXhwcmVzc2lvbiA9IG5leHRTdGF0ZW1lbnQuZ2V0KCdleHByZXNzaW9uJyk7XG4gICAgaWYgKG5leHRFeHByZXNzaW9uLmlzQ2FsbEV4cHJlc3Npb24oKSkge1xuICAgICAgaWYgKFxuICAgICAgICAhdHlwZXMuaXNJZGVudGlmaWVyKG5leHRFeHByZXNzaW9uLm5vZGUuY2FsbGVlKSB8fFxuICAgICAgICBuZXh0RXhwcmVzc2lvbi5ub2RlLmNhbGxlZS5uYW1lICE9PSBUU0xJQl9ERUNPUkFURV9IRUxQRVJfTkFNRVxuICAgICAgKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBpZiAoYWxsb3dXcmFwcGluZ0RlY29yYXRvcnMpIHtcbiAgICAgICAgd3JhcFN0YXRlbWVudFBhdGhzLnB1c2gobmV4dFN0YXRlbWVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTdGF0ZW1lbnQgY2Fubm90IGJlIHNhZmVseSB3cmFwcGVkIHdoaWNoIG1ha2VzIHdyYXBwaW5nIHRoZSBjbGFzcyB1bm5lZWRlZC5cbiAgICAgICAgLy8gVGhlIHN0YXRlbWVudCB3aWxsIHByZXZlbnQgZXZlbiBhIHdyYXBwZWQgY2xhc3MgZnJvbSBiZWluZyBvcHRpbWl6ZWQgYXdheS5cbiAgICAgICAgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBjb250aW51ZTtcbiAgICB9IGVsc2UgaWYgKCFuZXh0RXhwcmVzc2lvbi5pc0Fzc2lnbm1lbnRFeHByZXNzaW9uKCkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIFZhbGlkIGFzc2lnbm1lbnQgZXhwcmVzc2lvbnMgc2hvdWxkIGJlIG1lbWJlciBhY2Nlc3MgZXhwcmVzc2lvbnMgdXNpbmcgdGhlIGNsYXNzXG4gICAgLy8gbmFtZSBhcyB0aGUgb2JqZWN0IGFuZCBhbiBpZGVudGlmaWVyIGFzIHRoZSBwcm9wZXJ0eSBmb3Igc3RhdGljIGZpZWxkcyBvciBvbmx5XG4gICAgLy8gdGhlIGNsYXNzIG5hbWUgZm9yIGRlY29yYXRvcnMuXG4gICAgY29uc3QgbGVmdCA9IG5leHRFeHByZXNzaW9uLmdldCgnbGVmdCcpO1xuICAgIGlmIChsZWZ0LmlzSWRlbnRpZmllcigpKSB7XG4gICAgICBpZiAoXG4gICAgICAgICFsZWZ0LnNjb3BlLmJpbmRpbmdJZGVudGlmaWVyRXF1YWxzKGxlZnQubm9kZS5uYW1lLCBjbGFzc0lkZW50aWZpZXIpIHx8XG4gICAgICAgICF0eXBlcy5pc0NhbGxFeHByZXNzaW9uKG5leHRFeHByZXNzaW9uLm5vZGUucmlnaHQpIHx8XG4gICAgICAgICF0eXBlcy5pc0lkZW50aWZpZXIobmV4dEV4cHJlc3Npb24ubm9kZS5yaWdodC5jYWxsZWUpIHx8XG4gICAgICAgIG5leHRFeHByZXNzaW9uLm5vZGUucmlnaHQuY2FsbGVlLm5hbWUgIT09IFRTTElCX0RFQ09SQVRFX0hFTFBFUl9OQU1FXG4gICAgICApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGlmIChhbGxvd1dyYXBwaW5nRGVjb3JhdG9ycykge1xuICAgICAgICB3cmFwU3RhdGVtZW50UGF0aHMucHVzaChuZXh0U3RhdGVtZW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFN0YXRlbWVudCBjYW5ub3QgYmUgc2FmZWx5IHdyYXBwZWQgd2hpY2ggbWFrZXMgd3JhcHBpbmcgdGhlIGNsYXNzIHVubmVlZGVkLlxuICAgICAgICAvLyBUaGUgc3RhdGVtZW50IHdpbGwgcHJldmVudCBldmVuIGEgd3JhcHBlZCBjbGFzcyBmcm9tIGJlaW5nIG9wdGltaXplZCBhd2F5LlxuICAgICAgICBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnRpbnVlO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAhbGVmdC5pc01lbWJlckV4cHJlc3Npb24oKSB8fFxuICAgICAgIXR5cGVzLmlzSWRlbnRpZmllcihsZWZ0Lm5vZGUub2JqZWN0KSB8fFxuICAgICAgIWxlZnQuc2NvcGUuYmluZGluZ0lkZW50aWZpZXJFcXVhbHMobGVmdC5ub2RlLm9iamVjdC5uYW1lLCBjbGFzc0lkZW50aWZpZXIpIHx8XG4gICAgICAhdHlwZXMuaXNJZGVudGlmaWVyKGxlZnQubm9kZS5wcm9wZXJ0eSlcbiAgICApIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGNvbnN0IHByb3BlcnR5TmFtZSA9IGxlZnQubm9kZS5wcm9wZXJ0eS5uYW1lO1xuICAgIGNvbnN0IGFzc2lnbm1lbnRWYWx1ZSA9IG5leHRFeHByZXNzaW9uLmdldCgncmlnaHQnKTtcbiAgICBpZiAoYW5ndWxhclN0YXRpY3NUb0VsaWRlW3Byb3BlcnR5TmFtZV0/Lihhc3NpZ25tZW50VmFsdWUpKSB7XG4gICAgICBuZXh0U3RhdGVtZW50LnJlbW92ZSgpO1xuICAgICAgLS1pO1xuICAgIH0gZWxzZSBpZiAoY2FuV3JhcFByb3BlcnR5KHByb3BlcnR5TmFtZSwgYXNzaWdubWVudFZhbHVlKSkge1xuICAgICAgd3JhcFN0YXRlbWVudFBhdGhzLnB1c2gobmV4dFN0YXRlbWVudCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFN0YXRlbWVudCBjYW5ub3QgYmUgc2FmZWx5IHdyYXBwZWQgd2hpY2ggbWFrZXMgd3JhcHBpbmcgdGhlIGNsYXNzIHVubmVlZGVkLlxuICAgICAgLy8gVGhlIHN0YXRlbWVudCB3aWxsIHByZXZlbnQgZXZlbiBhIHdyYXBwZWQgY2xhc3MgZnJvbSBiZWluZyBvcHRpbWl6ZWQgYXdheS5cbiAgICAgIGhhc1BvdGVudGlhbFNpZGVFZmZlY3RzID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cywgd3JhcFN0YXRlbWVudFBhdGhzIH07XG59XG5cbi8qKlxuICogVGhlIHNldCBvZiBjbGFzc2VkIGFscmVhZHkgdmlzaXRlZCBhbmQgYW5hbHl6ZWQgZHVyaW5nIHRoZSBwbHVnaW4ncyBleGVjdXRpb24uXG4gKiBUaGlzIGlzIHVzZWQgdG8gcHJldmVudCBhZGp1c3RlZCBjbGFzc2VzIGZyb20gYmVpbmcgcmVwZWF0ZWRseSBhbmFseXplZCB3aGljaCBjYW4gbGVhZFxuICogdG8gYW4gaW5maW5pdGUgbG9vcC5cbiAqL1xuY29uc3QgdmlzaXRlZENsYXNzZXMgPSBuZXcgV2Vha1NldDx0eXBlcy5DbGFzcz4oKTtcblxuLyoqXG4gKiBBIGJhYmVsIHBsdWdpbiBmYWN0b3J5IGZ1bmN0aW9uIGZvciBhZGp1c3RpbmcgY2xhc3NlczsgcHJpbWFyaWx5IHdpdGggQW5ndWxhciBtZXRhZGF0YS5cbiAqIFRoZSBhZGp1c3RtZW50cyBpbmNsdWRlIHdyYXBwaW5nIGNsYXNzZXMgd2l0aCBrbm93biBzYWZlIG9yIG5vIHNpZGUgZWZmZWN0cyB3aXRoIHB1cmVcbiAqIGFubm90YXRpb25zIHRvIHN1cHBvcnQgZGVhZCBjb2RlIHJlbW92YWwgb2YgdW51c2VkIGNsYXNzZXMuIEFuZ3VsYXIgY29tcGlsZXIgZ2VuZXJhdGVkXG4gKiBtZXRhZGF0YSBzdGF0aWMgZmllbGRzIG5vdCByZXF1aXJlZCBpbiBBT1QgbW9kZSBhcmUgYWxzbyBlbGlkZWQgdG8gYmV0dGVyIHN1cHBvcnQgYnVuZGxlci1cbiAqIGxldmVsIHRyZWVzaGFraW5nLlxuICpcbiAqIEByZXR1cm5zIEEgYmFiZWwgcGx1Z2luIG9iamVjdCBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKCk6IFBsdWdpbk9iaiB7XG4gIHJldHVybiB7XG4gICAgdmlzaXRvcjoge1xuICAgICAgQ2xhc3NEZWNsYXJhdGlvbihwYXRoOiBOb2RlUGF0aDx0eXBlcy5DbGFzc0RlY2xhcmF0aW9uPiwgc3RhdGU6IFBsdWdpblBhc3MpIHtcbiAgICAgICAgY29uc3QgeyBub2RlOiBjbGFzc05vZGUsIHBhcmVudFBhdGggfSA9IHBhdGg7XG4gICAgICAgIGNvbnN0IHsgd3JhcERlY29yYXRvcnMgfSA9IHN0YXRlLm9wdHMgYXMgeyB3cmFwRGVjb3JhdG9yczogYm9vbGVhbiB9O1xuXG4gICAgICAgIGlmICh2aXNpdGVkQ2xhc3Nlcy5oYXMoY2xhc3NOb2RlKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFuYWx5emUgc2libGluZyBzdGF0ZW1lbnRzIGZvciBlbGVtZW50cyBvZiB0aGUgY2xhc3MgdGhhdCB3ZXJlIGRvd25sZXZlbGVkXG4gICAgICAgIGNvbnN0IGhhc0V4cG9ydCA9XG4gICAgICAgICAgcGFyZW50UGF0aC5pc0V4cG9ydE5hbWVkRGVjbGFyYXRpb24oKSB8fCBwYXJlbnRQYXRoLmlzRXhwb3J0RGVmYXVsdERlY2xhcmF0aW9uKCk7XG4gICAgICAgIGNvbnN0IG9yaWdpbiA9IGhhc0V4cG9ydCA/IHBhcmVudFBhdGggOiBwYXRoO1xuICAgICAgICBjb25zdCB7IHdyYXBTdGF0ZW1lbnRQYXRocywgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMgfSA9IGFuYWx5emVDbGFzc1NpYmxpbmdzKFxuICAgICAgICAgIG9yaWdpbixcbiAgICAgICAgICBjbGFzc05vZGUuaWQsXG4gICAgICAgICAgd3JhcERlY29yYXRvcnMsXG4gICAgICAgICk7XG5cbiAgICAgICAgdmlzaXRlZENsYXNzZXMuYWRkKGNsYXNzTm9kZSk7XG5cbiAgICAgICAgaWYgKGhhc1BvdGVudGlhbFNpZGVFZmZlY3RzKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgbm8gc3RhdGVtZW50cyB0byB3cmFwLCBjaGVjayBmb3Igc3RhdGljIGNsYXNzIHByb3BlcnRpZXMuXG4gICAgICAgIC8vIFN0YXRpYyBjbGFzcyBwcm9wZXJ0aWVzIG1heSBiZSBkb3dubGV2ZWxlZCBhdCBsYXRlciBzdGFnZXMgaW4gdGhlIGJ1aWxkIHBpcGVsaW5lXG4gICAgICAgIC8vIHdoaWNoIHJlc3VsdHMgaW4gYWRkaXRpb25hbCBmdW5jdGlvbiBjYWxscyBvdXRzaWRlIHRoZSBjbGFzcyBib2R5LiBUaGVzZSBjYWxsc1xuICAgICAgICAvLyB0aGVuIGNhdXNlIHRoZSBjbGFzcyB0byBiZSByZWZlcmVuY2VkIGFuZCBub3QgZWxpZ2libGUgZm9yIHJlbW92YWwuIFNpbmNlIGl0IGlzXG4gICAgICAgIC8vIG5vdCBrbm93biBhdCB0aGlzIHN0YWdlIHdoZXRoZXIgdGhlIGNsYXNzIG5lZWRzIHRvIGJlIGRvd25sZXZlbGVkLCB0aGUgdHJhbnNmb3JtXG4gICAgICAgIC8vIHdyYXBzIGNsYXNzZXMgcHJlZW1wdGl2ZWx5IHRvIGFsbG93IGZvciBwb3RlbnRpYWwgcmVtb3ZhbCB3aXRoaW4gdGhlIG9wdGltaXphdGlvblxuICAgICAgICAvLyBzdGFnZXMuXG4gICAgICAgIGlmICh3cmFwU3RhdGVtZW50UGF0aHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgbGV0IHNob3VsZFdyYXAgPSBmYWxzZTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgcGF0aC5nZXQoJ2JvZHknKS5nZXQoJ2JvZHknKSkge1xuICAgICAgICAgICAgaWYgKGVsZW1lbnQuaXNDbGFzc1Byb3BlcnR5KCkpIHtcbiAgICAgICAgICAgICAgLy8gT25seSBuZWVkIHRvIGFuYWx5emUgc3RhdGljIHByb3BlcnRpZXNcbiAgICAgICAgICAgICAgaWYgKCFlbGVtZW50Lm5vZGUuc3RhdGljKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBDaGVjayBmb3IgcG90ZW50aWFsIHNpZGUgZWZmZWN0cy5cbiAgICAgICAgICAgICAgLy8gVGhlc2UgY2hlY2tzIGFyZSBjb25zZXJ2YXRpdmUgYW5kIGNvdWxkIHBvdGVudGlhbGx5IGJlIGV4cGFuZGVkIGluIHRoZSBmdXR1cmUuXG4gICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRLZXkgPSBlbGVtZW50LmdldCgna2V5Jyk7XG4gICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRWYWx1ZSA9IGVsZW1lbnQuZ2V0KCd2YWx1ZScpO1xuICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgZWxlbWVudEtleS5pc0lkZW50aWZpZXIoKSAmJlxuICAgICAgICAgICAgICAgICghZWxlbWVudFZhbHVlLmlzRXhwcmVzc2lvbigpIHx8XG4gICAgICAgICAgICAgICAgICBjYW5XcmFwUHJvcGVydHkoZWxlbWVudEtleS5nZXQoJ25hbWUnKSwgZWxlbWVudFZhbHVlKSlcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgc2hvdWxkV3JhcCA9IHRydWU7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gTm90IHNhZmUgdG8gd3JhcFxuICAgICAgICAgICAgICAgIHNob3VsZFdyYXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXNob3VsZFdyYXApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB3cmFwU3RhdGVtZW50Tm9kZXM6IHR5cGVzLlN0YXRlbWVudFtdID0gW107XG4gICAgICAgIGZvciAoY29uc3Qgc3RhdGVtZW50UGF0aCBvZiB3cmFwU3RhdGVtZW50UGF0aHMpIHtcbiAgICAgICAgICB3cmFwU3RhdGVtZW50Tm9kZXMucHVzaChzdGF0ZW1lbnRQYXRoLm5vZGUpO1xuICAgICAgICAgIHN0YXRlbWVudFBhdGgucmVtb3ZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBXcmFwIGNsYXNzIGFuZCBzYWZlIHN0YXRpYyBhc3NpZ25tZW50cyBpbiBhIHB1cmUgYW5ub3RhdGVkIElJRkVcbiAgICAgICAgY29uc3QgY29udGFpbmVyID0gdHlwZXMuYXJyb3dGdW5jdGlvbkV4cHJlc3Npb24oXG4gICAgICAgICAgW10sXG4gICAgICAgICAgdHlwZXMuYmxvY2tTdGF0ZW1lbnQoW1xuICAgICAgICAgICAgY2xhc3NOb2RlLFxuICAgICAgICAgICAgLi4ud3JhcFN0YXRlbWVudE5vZGVzLFxuICAgICAgICAgICAgdHlwZXMucmV0dXJuU3RhdGVtZW50KHR5cGVzLmNsb25lTm9kZShjbGFzc05vZGUuaWQpKSxcbiAgICAgICAgICBdKSxcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgcmVwbGFjZW1lbnRJbml0aWFsaXplciA9IHR5cGVzLmNhbGxFeHByZXNzaW9uKFxuICAgICAgICAgIHR5cGVzLnBhcmVudGhlc2l6ZWRFeHByZXNzaW9uKGNvbnRhaW5lciksXG4gICAgICAgICAgW10sXG4gICAgICAgICk7XG4gICAgICAgIGFubm90YXRlQXNQdXJlKHJlcGxhY2VtZW50SW5pdGlhbGl6ZXIpO1xuXG4gICAgICAgIC8vIFJlcGxhY2UgY2xhc3Mgd2l0aCBJSUZFIHdyYXBwZWQgY2xhc3NcbiAgICAgICAgY29uc3QgZGVjbGFyYXRpb24gPSB0eXBlcy52YXJpYWJsZURlY2xhcmF0aW9uKCdsZXQnLCBbXG4gICAgICAgICAgdHlwZXMudmFyaWFibGVEZWNsYXJhdG9yKHR5cGVzLmNsb25lTm9kZShjbGFzc05vZGUuaWQpLCByZXBsYWNlbWVudEluaXRpYWxpemVyKSxcbiAgICAgICAgXSk7XG4gICAgICAgIGlmIChwYXJlbnRQYXRoLmlzRXhwb3J0RGVmYXVsdERlY2xhcmF0aW9uKCkpIHtcbiAgICAgICAgICAvLyBXaGVuIGNvbnZlcnRlZCB0byBhIHZhcmlhYmxlIGRlY2xhcmF0aW9uLCB0aGUgZGVmYXVsdCBleHBvcnQgbXVzdCBiZSBtb3ZlZFxuICAgICAgICAgIC8vIHRvIGEgc3Vic2VxdWVudCBzdGF0ZW1lbnQgdG8gcHJldmVudCBhIEphdmFTY3JpcHQgc3ludGF4IGVycm9yLlxuICAgICAgICAgIHBhcmVudFBhdGgucmVwbGFjZVdpdGhNdWx0aXBsZShbXG4gICAgICAgICAgICBkZWNsYXJhdGlvbixcbiAgICAgICAgICAgIHR5cGVzLmV4cG9ydE5hbWVkRGVjbGFyYXRpb24odW5kZWZpbmVkLCBbXG4gICAgICAgICAgICAgIHR5cGVzLmV4cG9ydFNwZWNpZmllcih0eXBlcy5jbG9uZU5vZGUoY2xhc3NOb2RlLmlkKSwgdHlwZXMuaWRlbnRpZmllcignZGVmYXVsdCcpKSxcbiAgICAgICAgICAgIF0pLFxuICAgICAgICAgIF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBhdGgucmVwbGFjZVdpdGgoZGVjbGFyYXRpb24pO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgQ2xhc3NFeHByZXNzaW9uKHBhdGg6IE5vZGVQYXRoPHR5cGVzLkNsYXNzRXhwcmVzc2lvbj4sIHN0YXRlOiBQbHVnaW5QYXNzKSB7XG4gICAgICAgIGNvbnN0IHsgbm9kZTogY2xhc3NOb2RlLCBwYXJlbnRQYXRoIH0gPSBwYXRoO1xuICAgICAgICBjb25zdCB7IHdyYXBEZWNvcmF0b3JzIH0gPSBzdGF0ZS5vcHRzIGFzIHsgd3JhcERlY29yYXRvcnM6IGJvb2xlYW4gfTtcblxuICAgICAgICAvLyBDbGFzcyBleHByZXNzaW9ucyBhcmUgdXNlZCBieSBUeXBlU2NyaXB0IHRvIHJlcHJlc2VudCBkb3dubGV2ZWwgY2xhc3MvY29uc3RydWN0b3IgZGVjb3JhdG9ycy5cbiAgICAgICAgLy8gSWYgbm90IHdyYXBwaW5nIGRlY29yYXRvcnMsIHRoZXkgZG8gbm90IG5lZWQgdG8gYmUgcHJvY2Vzc2VkLlxuICAgICAgICBpZiAoIXdyYXBEZWNvcmF0b3JzIHx8IHZpc2l0ZWRDbGFzc2VzLmhhcyhjbGFzc05vZGUpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICFjbGFzc05vZGUuaWQgfHxcbiAgICAgICAgICAhcGFyZW50UGF0aC5pc1ZhcmlhYmxlRGVjbGFyYXRvcigpIHx8XG4gICAgICAgICAgIXR5cGVzLmlzSWRlbnRpZmllcihwYXJlbnRQYXRoLm5vZGUuaWQpIHx8XG4gICAgICAgICAgcGFyZW50UGF0aC5ub2RlLmlkLm5hbWUgIT09IGNsYXNzTm9kZS5pZC5uYW1lXG4gICAgICAgICkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG9yaWdpbiA9IHBhcmVudFBhdGgucGFyZW50UGF0aDtcbiAgICAgICAgaWYgKCFvcmlnaW4uaXNWYXJpYWJsZURlY2xhcmF0aW9uKCkgfHwgb3JpZ2luLm5vZGUuZGVjbGFyYXRpb25zLmxlbmd0aCAhPT0gMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHsgd3JhcFN0YXRlbWVudFBhdGhzLCBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyB9ID0gYW5hbHl6ZUNsYXNzU2libGluZ3MoXG4gICAgICAgICAgb3JpZ2luLFxuICAgICAgICAgIHBhcmVudFBhdGgubm9kZS5pZCxcbiAgICAgICAgICB3cmFwRGVjb3JhdG9ycyxcbiAgICAgICAgKTtcblxuICAgICAgICB2aXNpdGVkQ2xhc3Nlcy5hZGQoY2xhc3NOb2RlKTtcblxuICAgICAgICBpZiAoaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMgfHwgd3JhcFN0YXRlbWVudFBhdGhzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHdyYXBTdGF0ZW1lbnROb2RlczogdHlwZXMuU3RhdGVtZW50W10gPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBzdGF0ZW1lbnRQYXRoIG9mIHdyYXBTdGF0ZW1lbnRQYXRocykge1xuICAgICAgICAgIHdyYXBTdGF0ZW1lbnROb2Rlcy5wdXNoKHN0YXRlbWVudFBhdGgubm9kZSk7XG4gICAgICAgICAgc3RhdGVtZW50UGF0aC5yZW1vdmUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdyYXAgY2xhc3MgYW5kIHNhZmUgc3RhdGljIGFzc2lnbm1lbnRzIGluIGEgcHVyZSBhbm5vdGF0ZWQgSUlGRVxuICAgICAgICBjb25zdCBjb250YWluZXIgPSB0eXBlcy5hcnJvd0Z1bmN0aW9uRXhwcmVzc2lvbihcbiAgICAgICAgICBbXSxcbiAgICAgICAgICB0eXBlcy5ibG9ja1N0YXRlbWVudChbXG4gICAgICAgICAgICB0eXBlcy52YXJpYWJsZURlY2xhcmF0aW9uKCdsZXQnLCBbXG4gICAgICAgICAgICAgIHR5cGVzLnZhcmlhYmxlRGVjbGFyYXRvcih0eXBlcy5jbG9uZU5vZGUoY2xhc3NOb2RlLmlkKSwgY2xhc3NOb2RlKSxcbiAgICAgICAgICAgIF0pLFxuICAgICAgICAgICAgLi4ud3JhcFN0YXRlbWVudE5vZGVzLFxuICAgICAgICAgICAgdHlwZXMucmV0dXJuU3RhdGVtZW50KHR5cGVzLmNsb25lTm9kZShjbGFzc05vZGUuaWQpKSxcbiAgICAgICAgICBdKSxcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgcmVwbGFjZW1lbnRJbml0aWFsaXplciA9IHR5cGVzLmNhbGxFeHByZXNzaW9uKFxuICAgICAgICAgIHR5cGVzLnBhcmVudGhlc2l6ZWRFeHByZXNzaW9uKGNvbnRhaW5lciksXG4gICAgICAgICAgW10sXG4gICAgICAgICk7XG4gICAgICAgIGFubm90YXRlQXNQdXJlKHJlcGxhY2VtZW50SW5pdGlhbGl6ZXIpO1xuXG4gICAgICAgIC8vIEFkZCB0aGUgd3JhcHBlZCBjbGFzcyBkaXJlY3RseSB0byB0aGUgdmFyaWFibGUgZGVjbGFyYXRpb25cbiAgICAgICAgcGFyZW50UGF0aC5nZXQoJ2luaXQnKS5yZXBsYWNlV2l0aChyZXBsYWNlbWVudEluaXRpYWxpemVyKTtcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn1cbiJdfQ==