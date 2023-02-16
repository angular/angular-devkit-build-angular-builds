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
const helper_split_export_declaration_1 = __importDefault(require("@babel/helper-split-export-declaration"));
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
    if (leadingComments?.some(
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
        if (angularStaticsToElide[propertyName]?.(assignmentValue)) {
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
 * The set of classes already visited and analyzed during the plugin's execution.
 * This is used to prevent adjusted classes from being repeatedly analyzed which can lead
 * to an infinite loop.
 */
const visitedClasses = new WeakSet();
/**
 * A map of classes that have already been analyzed during the default export splitting step.
 * This is used to avoid analyzing a class declaration twice if it is a direct default export.
 */
const exportDefaultAnalysis = new WeakMap();
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
            // When a class is converted to a variable declaration, the default export must be moved
            // to a subsequent statement to prevent a JavaScript syntax error.
            ExportDefaultDeclaration(path, state) {
                const declaration = path.get('declaration');
                if (!declaration.isClassDeclaration()) {
                    return;
                }
                const { wrapDecorators } = state.opts;
                const analysis = analyzeClassSiblings(path, declaration.node.id, wrapDecorators);
                exportDefaultAnalysis.set(declaration.node, analysis);
                // Splitting the export declaration is not needed if the class will not be wrapped
                if (analysis.hasPotentialSideEffects) {
                    return;
                }
                (0, helper_split_export_declaration_1.default)(path);
            },
            ClassDeclaration(path, state) {
                const { node: classNode, parentPath } = path;
                const { wrapDecorators } = state.opts;
                if (visitedClasses.has(classNode)) {
                    return;
                }
                // Analyze sibling statements for elements of the class that were downleveled
                const origin = parentPath.isExportNamedDeclaration() ? parentPath : path;
                const { wrapStatementPaths, hasPotentialSideEffects } = exportDefaultAnalysis.get(classNode) ??
                    analyzeClassSiblings(origin, classNode.id, wrapDecorators);
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
                path.replaceWith(declaration);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRqdXN0LXN0YXRpYy1jbGFzcy1tZW1iZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYmFiZWwvcGx1Z2lucy9hZGp1c3Qtc3RhdGljLWNsYXNzLW1lbWJlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgsc0NBQXFFO0FBQ3JFLDZGQUE0RDtBQUM1RCw2R0FBNEU7QUFFNUU7O0dBRUc7QUFDSCxNQUFNLDBCQUEwQixHQUFHLFlBQVksQ0FBQztBQUVoRDs7OztHQUlHO0FBQ0gsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLEdBQUcsQ0FBQztJQUNuQyxNQUFNO0lBQ04sTUFBTTtJQUNOLE1BQU07SUFDTixNQUFNO0lBQ04sTUFBTTtJQUNOLE9BQU87SUFDUCxPQUFPO0lBQ1AsY0FBYztDQUNmLENBQUMsQ0FBQztBQUVIOzs7R0FHRztBQUNILE1BQU0scUJBQXFCLEdBQWtFO0lBQzNGLGdCQUFnQixDQUFDLElBQUk7UUFDbkIsT0FBTyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztJQUN6RSxDQUFDO0lBQ0QsWUFBWSxDQUFDLElBQUk7UUFDZixPQUFPLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO0lBQ2xDLENBQUM7SUFDRCxnQkFBZ0IsQ0FBQyxJQUFJO1FBQ25CLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7SUFDbkMsQ0FBQztDQUNGLENBQUM7QUFFRjs7Ozs7R0FLRztBQUNILFNBQWdCLFdBQVc7SUFDekIsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ25CLENBQUM7QUFGRCxrQ0FFQztBQUVEOzs7Ozs7OztHQVFHO0FBQ0gsU0FBUyxlQUFlLENBQUMsWUFBb0IsRUFBRSxlQUF5QjtJQUN0RSxJQUFJ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LFNBQVMsR0FBRyxZQUFLLENBQUMsdUJBQXVCLENBQzdDLEVBQUUsRUFDRixZQUFLLENBQUMsY0FBYyxDQUFDO29CQUNuQixZQUFLLENBQUMsbUJBQW1CLENBQUMsS0FBSyxFQUFFO3dCQUMvQixZQUFLLENBQUMsa0JBQWtCLENBQUMsWUFBSyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLEVBQUUsU0FBUyxDQUFDO3FCQUNuRSxDQUFDO29CQUNGLEdBQUcsa0JBQWtCO29CQUNyQixZQUFLLENBQUMsZUFBZSxDQUFDLFlBQUssQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2lCQUNyRCxDQUFDLENBQ0gsQ0FBQztnQkFDRixNQUFNLHNCQUFzQixHQUFHLFlBQUssQ0FBQyxjQUFjLENBQ2pELFlBQUssQ0FBQyx1QkFBdUIsQ0FBQyxTQUFTLENBQUMsRUFDeEMsRUFBRSxDQUNILENBQUM7Z0JBQ0YsSUFBQSxpQ0FBYyxFQUFDLHNCQUFzQixDQUFDLENBQUM7Z0JBRXZDLDZEQUE2RDtnQkFDN0QsVUFBVSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLENBQUMsc0JBQXNCLENBQUMsQ0FBQztZQUM3RCxDQUFDO1NBQ0Y7S0FDRixDQUFDO0FBQ0osQ0FBQztBQTNLRCw0QkEyS0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgTm9kZVBhdGgsIFBsdWdpbk9iaiwgUGx1Z2luUGFzcywgdHlwZXMgfSBmcm9tICdAYmFiZWwvY29yZSc7XG5pbXBvcnQgYW5ub3RhdGVBc1B1cmUgZnJvbSAnQGJhYmVsL2hlbHBlci1hbm5vdGF0ZS1hcy1wdXJlJztcbmltcG9ydCBzcGxpdEV4cG9ydERlY2xhcmF0aW9uIGZyb20gJ0BiYWJlbC9oZWxwZXItc3BsaXQtZXhwb3J0LWRlY2xhcmF0aW9uJztcblxuLyoqXG4gKiBUaGUgbmFtZSBvZiB0aGUgVHlwZXNjcmlwdCBkZWNvcmF0b3IgaGVscGVyIGZ1bmN0aW9uIGNyZWF0ZWQgYnkgdGhlIFR5cGVTY3JpcHQgY29tcGlsZXIuXG4gKi9cbmNvbnN0IFRTTElCX0RFQ09SQVRFX0hFTFBFUl9OQU1FID0gJ19fZGVjb3JhdGUnO1xuXG4vKipcbiAqIFRoZSBzZXQgb2YgQW5ndWxhciBzdGF0aWMgZmllbGRzIHRoYXQgc2hvdWxkIGFsd2F5cyBiZSB3cmFwcGVkLlxuICogVGhlc2UgZmllbGRzIG1heSBhcHBlYXIgdG8gaGF2ZSBzaWRlIGVmZmVjdHMgYnV0IGFyZSBzYWZlIHRvIHJlbW92ZSBpZiB0aGUgYXNzb2NpYXRlZCBjbGFzc1xuICogaXMgb3RoZXJ3aXNlIHVudXNlZCB3aXRoaW4gdGhlIG91dHB1dC5cbiAqL1xuY29uc3QgYW5ndWxhclN0YXRpY3NUb1dyYXAgPSBuZXcgU2V0KFtcbiAgJ8m1Y21wJyxcbiAgJ8m1ZGlyJyxcbiAgJ8m1ZmFjJyxcbiAgJ8m1aW5qJyxcbiAgJ8m1bW9kJyxcbiAgJ8m1cGlwZScsXG4gICfJtXByb3YnLFxuICAnSU5KRUNUT1JfS0VZJyxcbl0pO1xuXG4vKipcbiAqIEFuIG9iamVjdCBtYXAgb2Ygc3RhdGljIGZpZWxkcyBhbmQgcmVsYXRlZCB2YWx1ZSBjaGVja3MgZm9yIGRpc2NvdmVyeSBvZiBBbmd1bGFyIGdlbmVyYXRlZFxuICogSklUIHJlbGF0ZWQgc3RhdGljIGZpZWxkcy5cbiAqL1xuY29uc3QgYW5ndWxhclN0YXRpY3NUb0VsaWRlOiBSZWNvcmQ8c3RyaW5nLCAocGF0aDogTm9kZVBhdGg8dHlwZXMuRXhwcmVzc2lvbj4pID0+IGJvb2xlYW4+ID0ge1xuICAnY3RvclBhcmFtZXRlcnMnKHBhdGgpIHtcbiAgICByZXR1cm4gcGF0aC5pc0Z1bmN0aW9uRXhwcmVzc2lvbigpIHx8IHBhdGguaXNBcnJvd0Z1bmN0aW9uRXhwcmVzc2lvbigpO1xuICB9LFxuICAnZGVjb3JhdG9ycycocGF0aCkge1xuICAgIHJldHVybiBwYXRoLmlzQXJyYXlFeHByZXNzaW9uKCk7XG4gIH0sXG4gICdwcm9wRGVjb3JhdG9ycycocGF0aCkge1xuICAgIHJldHVybiBwYXRoLmlzT2JqZWN0RXhwcmVzc2lvbigpO1xuICB9LFxufTtcblxuLyoqXG4gKiBQcm92aWRlcyBvbmUgb3IgbW9yZSBrZXl3b3JkcyB0aGF0IGlmIGZvdW5kIHdpdGhpbiB0aGUgY29udGVudCBvZiBhIHNvdXJjZSBmaWxlIGluZGljYXRlXG4gKiB0aGF0IHRoaXMgcGx1Z2luIHNob3VsZCBiZSB1c2VkIHdpdGggYSBzb3VyY2UgZmlsZS5cbiAqXG4gKiBAcmV0dXJucyBBbiBhIHN0cmluZyBpdGVyYWJsZSBjb250YWluaW5nIG9uZSBvciBtb3JlIGtleXdvcmRzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0S2V5d29yZHMoKTogSXRlcmFibGU8c3RyaW5nPiB7XG4gIHJldHVybiBbJ2NsYXNzJ107XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lcyB3aGV0aGVyIGEgcHJvcGVydHkgYW5kIGl0cyBpbml0aWFsaXplciB2YWx1ZSBjYW4gYmUgc2FmZWx5IHdyYXBwZWQgaW4gYSBwdXJlXG4gKiBhbm5vdGF0ZWQgSUlGRS4gVmFsdWVzIHRoYXQgbWF5IGNhdXNlIHNpZGUgZWZmZWN0cyBhcmUgbm90IGNvbnNpZGVyZWQgc2FmZSB0byB3cmFwLlxuICogV3JhcHBpbmcgc3VjaCB2YWx1ZXMgbWF5IGNhdXNlIHJ1bnRpbWUgZXJyb3JzIGFuZC9vciBpbmNvcnJlY3QgcnVudGltZSBiZWhhdmlvci5cbiAqXG4gKiBAcGFyYW0gcHJvcGVydHlOYW1lIFRoZSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSB0byBhbmFseXplLlxuICogQHBhcmFtIGFzc2lnbm1lbnRWYWx1ZSBUaGUgaW5pdGlhbGl6ZXIgdmFsdWUgdGhhdCB3aWxsIGJlIGFzc2lnbmVkIHRvIHRoZSBwcm9wZXJ0eS5cbiAqIEByZXR1cm5zIElmIHRoZSBwcm9wZXJ0eSBjYW4gYmUgc2FmZWx5IHdyYXBwZWQsIHRoZW4gdHJ1ZTsgb3RoZXJ3aXNlLCBmYWxzZS5cbiAqL1xuZnVuY3Rpb24gY2FuV3JhcFByb3BlcnR5KHByb3BlcnR5TmFtZTogc3RyaW5nLCBhc3NpZ25tZW50VmFsdWU6IE5vZGVQYXRoKTogYm9vbGVhbiB7XG4gIGlmIChhbmd1bGFyU3RhdGljc1RvV3JhcC5oYXMocHJvcGVydHlOYW1lKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgY29uc3QgeyBsZWFkaW5nQ29tbWVudHMgfSA9IGFzc2lnbm1lbnRWYWx1ZS5ub2RlIGFzIHsgbGVhZGluZ0NvbW1lbnRzPzogeyB2YWx1ZTogc3RyaW5nIH1bXSB9O1xuICBpZiAoXG4gICAgbGVhZGluZ0NvbW1lbnRzPy5zb21lKFxuICAgICAgLy8gYEBwdXJlT3JCcmVha015Q29kZWAgaXMgdXNlZCBieSBjbG9zdXJlIGFuZCBpcyBwcmVzZW50IGluIEFuZ3VsYXIgY29kZVxuICAgICAgKHsgdmFsdWUgfSkgPT5cbiAgICAgICAgdmFsdWUuaW5jbHVkZXMoJ0BfX1BVUkVfXycpIHx8XG4gICAgICAgIHZhbHVlLmluY2x1ZGVzKCcjX19QVVJFX18nKSB8fFxuICAgICAgICB2YWx1ZS5pbmNsdWRlcygnQHB1cmVPckJyZWFrTXlDb2RlJyksXG4gICAgKVxuICApIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHJldHVybiBhc3NpZ25tZW50VmFsdWUuaXNQdXJlKCk7XG59XG5cbi8qKlxuICogQW5hbHl6ZSB0aGUgc2libGluZyBub2RlcyBvZiBhIGNsYXNzIHRvIGRldGVybWluZSBpZiBhbnkgZG93bmxldmVsIGVsZW1lbnRzIHNob3VsZCBiZVxuICogd3JhcHBlZCBpbiBhIHB1cmUgYW5ub3RhdGVkIElJRkUuIEFsc28gZGV0ZXJtaW5lcyBpZiBhbnkgZWxlbWVudHMgaGF2ZSBwb3RlbnRpYWwgc2lkZVxuICogZWZmZWN0cy5cbiAqXG4gKiBAcGFyYW0gb3JpZ2luIFRoZSBzdGFydGluZyBOb2RlUGF0aCBsb2NhdGlvbiBmb3IgYW5hbHl6aW5nIHNpYmxpbmdzLlxuICogQHBhcmFtIGNsYXNzSWRlbnRpZmllciBUaGUgaWRlbnRpZmllciBub2RlIHRoYXQgcmVwcmVzZW50cyB0aGUgbmFtZSBvZiB0aGUgY2xhc3MuXG4gKiBAcGFyYW0gYWxsb3dXcmFwcGluZ0RlY29yYXRvcnMgV2hldGhlciB0byBhbGxvdyBkZWNvcmF0b3JzIHRvIGJlIHdyYXBwZWQuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgcmVzdWx0cyBvZiB0aGUgYW5hbHlzaXMuXG4gKi9cbmZ1bmN0aW9uIGFuYWx5emVDbGFzc1NpYmxpbmdzKFxuICBvcmlnaW46IE5vZGVQYXRoLFxuICBjbGFzc0lkZW50aWZpZXI6IHR5cGVzLklkZW50aWZpZXIsXG4gIGFsbG93V3JhcHBpbmdEZWNvcmF0b3JzOiBib29sZWFuLFxuKTogeyBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0czogYm9vbGVhbjsgd3JhcFN0YXRlbWVudFBhdGhzOiBOb2RlUGF0aDx0eXBlcy5TdGF0ZW1lbnQ+W10gfSB7XG4gIGNvbnN0IHdyYXBTdGF0ZW1lbnRQYXRoczogTm9kZVBhdGg8dHlwZXMuU3RhdGVtZW50PltdID0gW107XG4gIGxldCBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyA9IGZhbHNlO1xuICBmb3IgKGxldCBpID0gMTsgOyArK2kpIHtcbiAgICBjb25zdCBuZXh0U3RhdGVtZW50ID0gb3JpZ2luLmdldFNpYmxpbmcoK29yaWdpbi5rZXkgKyBpKTtcbiAgICBpZiAoIW5leHRTdGF0ZW1lbnQuaXNFeHByZXNzaW9uU3RhdGVtZW50KCkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIFZhbGlkIHNpYmxpbmcgc3RhdGVtZW50cyBmb3IgY2xhc3MgZGVjbGFyYXRpb25zIGFyZSBvbmx5IGFzc2lnbm1lbnQgZXhwcmVzc2lvbnNcbiAgICAvLyBhbmQgVHlwZVNjcmlwdCBkZWNvcmF0b3IgaGVscGVyIGNhbGwgZXhwcmVzc2lvbnNcbiAgICBjb25zdCBuZXh0RXhwcmVzc2lvbiA9IG5leHRTdGF0ZW1lbnQuZ2V0KCdleHByZXNzaW9uJyk7XG4gICAgaWYgKG5leHRFeHByZXNzaW9uLmlzQ2FsbEV4cHJlc3Npb24oKSkge1xuICAgICAgaWYgKFxuICAgICAgICAhdHlwZXMuaXNJZGVudGlmaWVyKG5leHRFeHByZXNzaW9uLm5vZGUuY2FsbGVlKSB8fFxuICAgICAgICBuZXh0RXhwcmVzc2lvbi5ub2RlLmNhbGxlZS5uYW1lICE9PSBUU0xJQl9ERUNPUkFURV9IRUxQRVJfTkFNRVxuICAgICAgKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBpZiAoYWxsb3dXcmFwcGluZ0RlY29yYXRvcnMpIHtcbiAgICAgICAgd3JhcFN0YXRlbWVudFBhdGhzLnB1c2gobmV4dFN0YXRlbWVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTdGF0ZW1lbnQgY2Fubm90IGJlIHNhZmVseSB3cmFwcGVkIHdoaWNoIG1ha2VzIHdyYXBwaW5nIHRoZSBjbGFzcyB1bm5lZWRlZC5cbiAgICAgICAgLy8gVGhlIHN0YXRlbWVudCB3aWxsIHByZXZlbnQgZXZlbiBhIHdyYXBwZWQgY2xhc3MgZnJvbSBiZWluZyBvcHRpbWl6ZWQgYXdheS5cbiAgICAgICAgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBjb250aW51ZTtcbiAgICB9IGVsc2UgaWYgKCFuZXh0RXhwcmVzc2lvbi5pc0Fzc2lnbm1lbnRFeHByZXNzaW9uKCkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIFZhbGlkIGFzc2lnbm1lbnQgZXhwcmVzc2lvbnMgc2hvdWxkIGJlIG1lbWJlciBhY2Nlc3MgZXhwcmVzc2lvbnMgdXNpbmcgdGhlIGNsYXNzXG4gICAgLy8gbmFtZSBhcyB0aGUgb2JqZWN0IGFuZCBhbiBpZGVudGlmaWVyIGFzIHRoZSBwcm9wZXJ0eSBmb3Igc3RhdGljIGZpZWxkcyBvciBvbmx5XG4gICAgLy8gdGhlIGNsYXNzIG5hbWUgZm9yIGRlY29yYXRvcnMuXG4gICAgY29uc3QgbGVmdCA9IG5leHRFeHByZXNzaW9uLmdldCgnbGVmdCcpO1xuICAgIGlmIChsZWZ0LmlzSWRlbnRpZmllcigpKSB7XG4gICAgICBpZiAoXG4gICAgICAgICFsZWZ0LnNjb3BlLmJpbmRpbmdJZGVudGlmaWVyRXF1YWxzKGxlZnQubm9kZS5uYW1lLCBjbGFzc0lkZW50aWZpZXIpIHx8XG4gICAgICAgICF0eXBlcy5pc0NhbGxFeHByZXNzaW9uKG5leHRFeHByZXNzaW9uLm5vZGUucmlnaHQpIHx8XG4gICAgICAgICF0eXBlcy5pc0lkZW50aWZpZXIobmV4dEV4cHJlc3Npb24ubm9kZS5yaWdodC5jYWxsZWUpIHx8XG4gICAgICAgIG5leHRFeHByZXNzaW9uLm5vZGUucmlnaHQuY2FsbGVlLm5hbWUgIT09IFRTTElCX0RFQ09SQVRFX0hFTFBFUl9OQU1FXG4gICAgICApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGlmIChhbGxvd1dyYXBwaW5nRGVjb3JhdG9ycykge1xuICAgICAgICB3cmFwU3RhdGVtZW50UGF0aHMucHVzaChuZXh0U3RhdGVtZW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFN0YXRlbWVudCBjYW5ub3QgYmUgc2FmZWx5IHdyYXBwZWQgd2hpY2ggbWFrZXMgd3JhcHBpbmcgdGhlIGNsYXNzIHVubmVlZGVkLlxuICAgICAgICAvLyBUaGUgc3RhdGVtZW50IHdpbGwgcHJldmVudCBldmVuIGEgd3JhcHBlZCBjbGFzcyBmcm9tIGJlaW5nIG9wdGltaXplZCBhd2F5LlxuICAgICAgICBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnRpbnVlO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAhbGVmdC5pc01lbWJlckV4cHJlc3Npb24oKSB8fFxuICAgICAgIXR5cGVzLmlzSWRlbnRpZmllcihsZWZ0Lm5vZGUub2JqZWN0KSB8fFxuICAgICAgIWxlZnQuc2NvcGUuYmluZGluZ0lkZW50aWZpZXJFcXVhbHMobGVmdC5ub2RlLm9iamVjdC5uYW1lLCBjbGFzc0lkZW50aWZpZXIpIHx8XG4gICAgICAhdHlwZXMuaXNJZGVudGlmaWVyKGxlZnQubm9kZS5wcm9wZXJ0eSlcbiAgICApIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGNvbnN0IHByb3BlcnR5TmFtZSA9IGxlZnQubm9kZS5wcm9wZXJ0eS5uYW1lO1xuICAgIGNvbnN0IGFzc2lnbm1lbnRWYWx1ZSA9IG5leHRFeHByZXNzaW9uLmdldCgncmlnaHQnKTtcbiAgICBpZiAoYW5ndWxhclN0YXRpY3NUb0VsaWRlW3Byb3BlcnR5TmFtZV0/Lihhc3NpZ25tZW50VmFsdWUpKSB7XG4gICAgICBuZXh0U3RhdGVtZW50LnJlbW92ZSgpO1xuICAgICAgLS1pO1xuICAgIH0gZWxzZSBpZiAoY2FuV3JhcFByb3BlcnR5KHByb3BlcnR5TmFtZSwgYXNzaWdubWVudFZhbHVlKSkge1xuICAgICAgd3JhcFN0YXRlbWVudFBhdGhzLnB1c2gobmV4dFN0YXRlbWVudCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFN0YXRlbWVudCBjYW5ub3QgYmUgc2FmZWx5IHdyYXBwZWQgd2hpY2ggbWFrZXMgd3JhcHBpbmcgdGhlIGNsYXNzIHVubmVlZGVkLlxuICAgICAgLy8gVGhlIHN0YXRlbWVudCB3aWxsIHByZXZlbnQgZXZlbiBhIHdyYXBwZWQgY2xhc3MgZnJvbSBiZWluZyBvcHRpbWl6ZWQgYXdheS5cbiAgICAgIGhhc1BvdGVudGlhbFNpZGVFZmZlY3RzID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cywgd3JhcFN0YXRlbWVudFBhdGhzIH07XG59XG5cbi8qKlxuICogVGhlIHNldCBvZiBjbGFzc2VzIGFscmVhZHkgdmlzaXRlZCBhbmQgYW5hbHl6ZWQgZHVyaW5nIHRoZSBwbHVnaW4ncyBleGVjdXRpb24uXG4gKiBUaGlzIGlzIHVzZWQgdG8gcHJldmVudCBhZGp1c3RlZCBjbGFzc2VzIGZyb20gYmVpbmcgcmVwZWF0ZWRseSBhbmFseXplZCB3aGljaCBjYW4gbGVhZFxuICogdG8gYW4gaW5maW5pdGUgbG9vcC5cbiAqL1xuY29uc3QgdmlzaXRlZENsYXNzZXMgPSBuZXcgV2Vha1NldDx0eXBlcy5DbGFzcz4oKTtcblxuLyoqXG4gKiBBIG1hcCBvZiBjbGFzc2VzIHRoYXQgaGF2ZSBhbHJlYWR5IGJlZW4gYW5hbHl6ZWQgZHVyaW5nIHRoZSBkZWZhdWx0IGV4cG9ydCBzcGxpdHRpbmcgc3RlcC5cbiAqIFRoaXMgaXMgdXNlZCB0byBhdm9pZCBhbmFseXppbmcgYSBjbGFzcyBkZWNsYXJhdGlvbiB0d2ljZSBpZiBpdCBpcyBhIGRpcmVjdCBkZWZhdWx0IGV4cG9ydC5cbiAqL1xuY29uc3QgZXhwb3J0RGVmYXVsdEFuYWx5c2lzID0gbmV3IFdlYWtNYXA8dHlwZXMuQ2xhc3MsIFJldHVyblR5cGU8dHlwZW9mIGFuYWx5emVDbGFzc1NpYmxpbmdzPj4oKTtcblxuLyoqXG4gKiBBIGJhYmVsIHBsdWdpbiBmYWN0b3J5IGZ1bmN0aW9uIGZvciBhZGp1c3RpbmcgY2xhc3NlczsgcHJpbWFyaWx5IHdpdGggQW5ndWxhciBtZXRhZGF0YS5cbiAqIFRoZSBhZGp1c3RtZW50cyBpbmNsdWRlIHdyYXBwaW5nIGNsYXNzZXMgd2l0aCBrbm93biBzYWZlIG9yIG5vIHNpZGUgZWZmZWN0cyB3aXRoIHB1cmVcbiAqIGFubm90YXRpb25zIHRvIHN1cHBvcnQgZGVhZCBjb2RlIHJlbW92YWwgb2YgdW51c2VkIGNsYXNzZXMuIEFuZ3VsYXIgY29tcGlsZXIgZ2VuZXJhdGVkXG4gKiBtZXRhZGF0YSBzdGF0aWMgZmllbGRzIG5vdCByZXF1aXJlZCBpbiBBT1QgbW9kZSBhcmUgYWxzbyBlbGlkZWQgdG8gYmV0dGVyIHN1cHBvcnQgYnVuZGxlci1cbiAqIGxldmVsIHRyZWVzaGFraW5nLlxuICpcbiAqIEByZXR1cm5zIEEgYmFiZWwgcGx1Z2luIG9iamVjdCBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKCk6IFBsdWdpbk9iaiB7XG4gIHJldHVybiB7XG4gICAgdmlzaXRvcjoge1xuICAgICAgLy8gV2hlbiBhIGNsYXNzIGlzIGNvbnZlcnRlZCB0byBhIHZhcmlhYmxlIGRlY2xhcmF0aW9uLCB0aGUgZGVmYXVsdCBleHBvcnQgbXVzdCBiZSBtb3ZlZFxuICAgICAgLy8gdG8gYSBzdWJzZXF1ZW50IHN0YXRlbWVudCB0byBwcmV2ZW50IGEgSmF2YVNjcmlwdCBzeW50YXggZXJyb3IuXG4gICAgICBFeHBvcnREZWZhdWx0RGVjbGFyYXRpb24ocGF0aDogTm9kZVBhdGg8dHlwZXMuRXhwb3J0RGVmYXVsdERlY2xhcmF0aW9uPiwgc3RhdGU6IFBsdWdpblBhc3MpIHtcbiAgICAgICAgY29uc3QgZGVjbGFyYXRpb24gPSBwYXRoLmdldCgnZGVjbGFyYXRpb24nKTtcbiAgICAgICAgaWYgKCFkZWNsYXJhdGlvbi5pc0NsYXNzRGVjbGFyYXRpb24oKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHsgd3JhcERlY29yYXRvcnMgfSA9IHN0YXRlLm9wdHMgYXMgeyB3cmFwRGVjb3JhdG9yczogYm9vbGVhbiB9O1xuICAgICAgICBjb25zdCBhbmFseXNpcyA9IGFuYWx5emVDbGFzc1NpYmxpbmdzKHBhdGgsIGRlY2xhcmF0aW9uLm5vZGUuaWQsIHdyYXBEZWNvcmF0b3JzKTtcbiAgICAgICAgZXhwb3J0RGVmYXVsdEFuYWx5c2lzLnNldChkZWNsYXJhdGlvbi5ub2RlLCBhbmFseXNpcyk7XG5cbiAgICAgICAgLy8gU3BsaXR0aW5nIHRoZSBleHBvcnQgZGVjbGFyYXRpb24gaXMgbm90IG5lZWRlZCBpZiB0aGUgY2xhc3Mgd2lsbCBub3QgYmUgd3JhcHBlZFxuICAgICAgICBpZiAoYW5hbHlzaXMuaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBzcGxpdEV4cG9ydERlY2xhcmF0aW9uKHBhdGgpO1xuICAgICAgfSxcbiAgICAgIENsYXNzRGVjbGFyYXRpb24ocGF0aDogTm9kZVBhdGg8dHlwZXMuQ2xhc3NEZWNsYXJhdGlvbj4sIHN0YXRlOiBQbHVnaW5QYXNzKSB7XG4gICAgICAgIGNvbnN0IHsgbm9kZTogY2xhc3NOb2RlLCBwYXJlbnRQYXRoIH0gPSBwYXRoO1xuICAgICAgICBjb25zdCB7IHdyYXBEZWNvcmF0b3JzIH0gPSBzdGF0ZS5vcHRzIGFzIHsgd3JhcERlY29yYXRvcnM6IGJvb2xlYW4gfTtcblxuICAgICAgICBpZiAodmlzaXRlZENsYXNzZXMuaGFzKGNsYXNzTm9kZSkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBbmFseXplIHNpYmxpbmcgc3RhdGVtZW50cyBmb3IgZWxlbWVudHMgb2YgdGhlIGNsYXNzIHRoYXQgd2VyZSBkb3dubGV2ZWxlZFxuICAgICAgICBjb25zdCBvcmlnaW4gPSBwYXJlbnRQYXRoLmlzRXhwb3J0TmFtZWREZWNsYXJhdGlvbigpID8gcGFyZW50UGF0aCA6IHBhdGg7XG4gICAgICAgIGNvbnN0IHsgd3JhcFN0YXRlbWVudFBhdGhzLCBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyB9ID1cbiAgICAgICAgICBleHBvcnREZWZhdWx0QW5hbHlzaXMuZ2V0KGNsYXNzTm9kZSkgPz9cbiAgICAgICAgICBhbmFseXplQ2xhc3NTaWJsaW5ncyhvcmlnaW4sIGNsYXNzTm9kZS5pZCwgd3JhcERlY29yYXRvcnMpO1xuXG4gICAgICAgIHZpc2l0ZWRDbGFzc2VzLmFkZChjbGFzc05vZGUpO1xuXG4gICAgICAgIGlmIChoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIG5vIHN0YXRlbWVudHMgdG8gd3JhcCwgY2hlY2sgZm9yIHN0YXRpYyBjbGFzcyBwcm9wZXJ0aWVzLlxuICAgICAgICAvLyBTdGF0aWMgY2xhc3MgcHJvcGVydGllcyBtYXkgYmUgZG93bmxldmVsZWQgYXQgbGF0ZXIgc3RhZ2VzIGluIHRoZSBidWlsZCBwaXBlbGluZVxuICAgICAgICAvLyB3aGljaCByZXN1bHRzIGluIGFkZGl0aW9uYWwgZnVuY3Rpb24gY2FsbHMgb3V0c2lkZSB0aGUgY2xhc3MgYm9keS4gVGhlc2UgY2FsbHNcbiAgICAgICAgLy8gdGhlbiBjYXVzZSB0aGUgY2xhc3MgdG8gYmUgcmVmZXJlbmNlZCBhbmQgbm90IGVsaWdpYmxlIGZvciByZW1vdmFsLiBTaW5jZSBpdCBpc1xuICAgICAgICAvLyBub3Qga25vd24gYXQgdGhpcyBzdGFnZSB3aGV0aGVyIHRoZSBjbGFzcyBuZWVkcyB0byBiZSBkb3dubGV2ZWxlZCwgdGhlIHRyYW5zZm9ybVxuICAgICAgICAvLyB3cmFwcyBjbGFzc2VzIHByZWVtcHRpdmVseSB0byBhbGxvdyBmb3IgcG90ZW50aWFsIHJlbW92YWwgd2l0aGluIHRoZSBvcHRpbWl6YXRpb25cbiAgICAgICAgLy8gc3RhZ2VzLlxuICAgICAgICBpZiAod3JhcFN0YXRlbWVudFBhdGhzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGxldCBzaG91bGRXcmFwID0gZmFsc2U7XG4gICAgICAgICAgZm9yIChjb25zdCBlbGVtZW50IG9mIHBhdGguZ2V0KCdib2R5JykuZ2V0KCdib2R5JykpIHtcbiAgICAgICAgICAgIGlmIChlbGVtZW50LmlzQ2xhc3NQcm9wZXJ0eSgpKSB7XG4gICAgICAgICAgICAgIC8vIE9ubHkgbmVlZCB0byBhbmFseXplIHN0YXRpYyBwcm9wZXJ0aWVzXG4gICAgICAgICAgICAgIGlmICghZWxlbWVudC5ub2RlLnN0YXRpYykge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIHBvdGVudGlhbCBzaWRlIGVmZmVjdHMuXG4gICAgICAgICAgICAgIC8vIFRoZXNlIGNoZWNrcyBhcmUgY29uc2VydmF0aXZlIGFuZCBjb3VsZCBwb3RlbnRpYWxseSBiZSBleHBhbmRlZCBpbiB0aGUgZnV0dXJlLlxuICAgICAgICAgICAgICBjb25zdCBlbGVtZW50S2V5ID0gZWxlbWVudC5nZXQoJ2tleScpO1xuICAgICAgICAgICAgICBjb25zdCBlbGVtZW50VmFsdWUgPSBlbGVtZW50LmdldCgndmFsdWUnKTtcbiAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIGVsZW1lbnRLZXkuaXNJZGVudGlmaWVyKCkgJiZcbiAgICAgICAgICAgICAgICAoIWVsZW1lbnRWYWx1ZS5pc0V4cHJlc3Npb24oKSB8fFxuICAgICAgICAgICAgICAgICAgY2FuV3JhcFByb3BlcnR5KGVsZW1lbnRLZXkuZ2V0KCduYW1lJyksIGVsZW1lbnRWYWx1ZSkpXG4gICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIHNob3VsZFdyYXAgPSB0cnVlO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIE5vdCBzYWZlIHRvIHdyYXBcbiAgICAgICAgICAgICAgICBzaG91bGRXcmFwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFzaG91bGRXcmFwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd3JhcFN0YXRlbWVudE5vZGVzOiB0eXBlcy5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IHN0YXRlbWVudFBhdGggb2Ygd3JhcFN0YXRlbWVudFBhdGhzKSB7XG4gICAgICAgICAgd3JhcFN0YXRlbWVudE5vZGVzLnB1c2goc3RhdGVtZW50UGF0aC5ub2RlKTtcbiAgICAgICAgICBzdGF0ZW1lbnRQYXRoLnJlbW92ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gV3JhcCBjbGFzcyBhbmQgc2FmZSBzdGF0aWMgYXNzaWdubWVudHMgaW4gYSBwdXJlIGFubm90YXRlZCBJSUZFXG4gICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IHR5cGVzLmFycm93RnVuY3Rpb25FeHByZXNzaW9uKFxuICAgICAgICAgIFtdLFxuICAgICAgICAgIHR5cGVzLmJsb2NrU3RhdGVtZW50KFtcbiAgICAgICAgICAgIGNsYXNzTm9kZSxcbiAgICAgICAgICAgIC4uLndyYXBTdGF0ZW1lbnROb2RlcyxcbiAgICAgICAgICAgIHR5cGVzLnJldHVyblN0YXRlbWVudCh0eXBlcy5jbG9uZU5vZGUoY2xhc3NOb2RlLmlkKSksXG4gICAgICAgICAgXSksXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IHJlcGxhY2VtZW50SW5pdGlhbGl6ZXIgPSB0eXBlcy5jYWxsRXhwcmVzc2lvbihcbiAgICAgICAgICB0eXBlcy5wYXJlbnRoZXNpemVkRXhwcmVzc2lvbihjb250YWluZXIpLFxuICAgICAgICAgIFtdLFxuICAgICAgICApO1xuICAgICAgICBhbm5vdGF0ZUFzUHVyZShyZXBsYWNlbWVudEluaXRpYWxpemVyKTtcblxuICAgICAgICAvLyBSZXBsYWNlIGNsYXNzIHdpdGggSUlGRSB3cmFwcGVkIGNsYXNzXG4gICAgICAgIGNvbnN0IGRlY2xhcmF0aW9uID0gdHlwZXMudmFyaWFibGVEZWNsYXJhdGlvbignbGV0JywgW1xuICAgICAgICAgIHR5cGVzLnZhcmlhYmxlRGVjbGFyYXRvcih0eXBlcy5jbG9uZU5vZGUoY2xhc3NOb2RlLmlkKSwgcmVwbGFjZW1lbnRJbml0aWFsaXplciksXG4gICAgICAgIF0pO1xuICAgICAgICBwYXRoLnJlcGxhY2VXaXRoKGRlY2xhcmF0aW9uKTtcbiAgICAgIH0sXG4gICAgICBDbGFzc0V4cHJlc3Npb24ocGF0aDogTm9kZVBhdGg8dHlwZXMuQ2xhc3NFeHByZXNzaW9uPiwgc3RhdGU6IFBsdWdpblBhc3MpIHtcbiAgICAgICAgY29uc3QgeyBub2RlOiBjbGFzc05vZGUsIHBhcmVudFBhdGggfSA9IHBhdGg7XG4gICAgICAgIGNvbnN0IHsgd3JhcERlY29yYXRvcnMgfSA9IHN0YXRlLm9wdHMgYXMgeyB3cmFwRGVjb3JhdG9yczogYm9vbGVhbiB9O1xuXG4gICAgICAgIC8vIENsYXNzIGV4cHJlc3Npb25zIGFyZSB1c2VkIGJ5IFR5cGVTY3JpcHQgdG8gcmVwcmVzZW50IGRvd25sZXZlbCBjbGFzcy9jb25zdHJ1Y3RvciBkZWNvcmF0b3JzLlxuICAgICAgICAvLyBJZiBub3Qgd3JhcHBpbmcgZGVjb3JhdG9ycywgdGhleSBkbyBub3QgbmVlZCB0byBiZSBwcm9jZXNzZWQuXG4gICAgICAgIGlmICghd3JhcERlY29yYXRvcnMgfHwgdmlzaXRlZENsYXNzZXMuaGFzKGNsYXNzTm9kZSkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXG4gICAgICAgICAgIWNsYXNzTm9kZS5pZCB8fFxuICAgICAgICAgICFwYXJlbnRQYXRoLmlzVmFyaWFibGVEZWNsYXJhdG9yKCkgfHxcbiAgICAgICAgICAhdHlwZXMuaXNJZGVudGlmaWVyKHBhcmVudFBhdGgubm9kZS5pZCkgfHxcbiAgICAgICAgICBwYXJlbnRQYXRoLm5vZGUuaWQubmFtZSAhPT0gY2xhc3NOb2RlLmlkLm5hbWVcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb3JpZ2luID0gcGFyZW50UGF0aC5wYXJlbnRQYXRoO1xuICAgICAgICBpZiAoIW9yaWdpbi5pc1ZhcmlhYmxlRGVjbGFyYXRpb24oKSB8fCBvcmlnaW4ubm9kZS5kZWNsYXJhdGlvbnMubGVuZ3RoICE9PSAxKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyB3cmFwU3RhdGVtZW50UGF0aHMsIGhhc1BvdGVudGlhbFNpZGVFZmZlY3RzIH0gPSBhbmFseXplQ2xhc3NTaWJsaW5ncyhcbiAgICAgICAgICBvcmlnaW4sXG4gICAgICAgICAgcGFyZW50UGF0aC5ub2RlLmlkLFxuICAgICAgICAgIHdyYXBEZWNvcmF0b3JzLFxuICAgICAgICApO1xuXG4gICAgICAgIHZpc2l0ZWRDbGFzc2VzLmFkZChjbGFzc05vZGUpO1xuXG4gICAgICAgIGlmIChoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyB8fCB3cmFwU3RhdGVtZW50UGF0aHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd3JhcFN0YXRlbWVudE5vZGVzOiB0eXBlcy5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IHN0YXRlbWVudFBhdGggb2Ygd3JhcFN0YXRlbWVudFBhdGhzKSB7XG4gICAgICAgICAgd3JhcFN0YXRlbWVudE5vZGVzLnB1c2goc3RhdGVtZW50UGF0aC5ub2RlKTtcbiAgICAgICAgICBzdGF0ZW1lbnRQYXRoLnJlbW92ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gV3JhcCBjbGFzcyBhbmQgc2FmZSBzdGF0aWMgYXNzaWdubWVudHMgaW4gYSBwdXJlIGFubm90YXRlZCBJSUZFXG4gICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IHR5cGVzLmFycm93RnVuY3Rpb25FeHByZXNzaW9uKFxuICAgICAgICAgIFtdLFxuICAgICAgICAgIHR5cGVzLmJsb2NrU3RhdGVtZW50KFtcbiAgICAgICAgICAgIHR5cGVzLnZhcmlhYmxlRGVjbGFyYXRpb24oJ2xldCcsIFtcbiAgICAgICAgICAgICAgdHlwZXMudmFyaWFibGVEZWNsYXJhdG9yKHR5cGVzLmNsb25lTm9kZShjbGFzc05vZGUuaWQpLCBjbGFzc05vZGUpLFxuICAgICAgICAgICAgXSksXG4gICAgICAgICAgICAuLi53cmFwU3RhdGVtZW50Tm9kZXMsXG4gICAgICAgICAgICB0eXBlcy5yZXR1cm5TdGF0ZW1lbnQodHlwZXMuY2xvbmVOb2RlKGNsYXNzTm9kZS5pZCkpLFxuICAgICAgICAgIF0pLFxuICAgICAgICApO1xuICAgICAgICBjb25zdCByZXBsYWNlbWVudEluaXRpYWxpemVyID0gdHlwZXMuY2FsbEV4cHJlc3Npb24oXG4gICAgICAgICAgdHlwZXMucGFyZW50aGVzaXplZEV4cHJlc3Npb24oY29udGFpbmVyKSxcbiAgICAgICAgICBbXSxcbiAgICAgICAgKTtcbiAgICAgICAgYW5ub3RhdGVBc1B1cmUocmVwbGFjZW1lbnRJbml0aWFsaXplcik7XG5cbiAgICAgICAgLy8gQWRkIHRoZSB3cmFwcGVkIGNsYXNzIGRpcmVjdGx5IHRvIHRoZSB2YXJpYWJsZSBkZWNsYXJhdGlvblxuICAgICAgICBwYXJlbnRQYXRoLmdldCgnaW5pdCcpLnJlcGxhY2VXaXRoKHJlcGxhY2VtZW50SW5pdGlhbGl6ZXIpO1xuICAgICAgfSxcbiAgICB9LFxuICB9O1xufVxuIl19