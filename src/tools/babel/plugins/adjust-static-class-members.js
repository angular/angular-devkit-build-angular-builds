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
        const nextStatement = origin.getSibling(+(origin.key ?? 0) + i);
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
// eslint-disable-next-line max-lines-per-function
function default_1() {
    return {
        visitor: {
            // When a class is converted to a variable declaration, the default export must be moved
            // to a subsequent statement to prevent a JavaScript syntax error.
            ExportDefaultDeclaration(path, state) {
                const declaration = path.get('declaration');
                if (!declaration.isClassDeclaration() || !declaration.node.id) {
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
                // Skip if already visited or has no name
                if (visitedClasses.has(classNode) || !classNode.id) {
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
                                    canWrapProperty(elementKey.node.name, elementValue))) {
                                shouldWrap = true;
                            }
                            else {
                                // Not safe to wrap
                                shouldWrap = false;
                                break;
                            }
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        }
                        else if (element.isStaticBlock()) {
                            // Only need to analyze static blocks
                            const body = element.get('body');
                            if (Array.isArray(body) && body.length > 1) {
                                // Not safe to wrap
                                shouldWrap = false;
                                break;
                            }
                            const expression = body.find((n) => n.isExpressionStatement());
                            const assignmentExpression = expression?.get('expression');
                            if (assignmentExpression?.isAssignmentExpression()) {
                                const left = assignmentExpression.get('left');
                                if (!left.isMemberExpression()) {
                                    continue;
                                }
                                if (!left.get('object').isThisExpression()) {
                                    // Not safe to wrap
                                    shouldWrap = false;
                                    break;
                                }
                                const element = left.get('property');
                                const right = assignmentExpression.get('right');
                                if (element.isIdentifier() &&
                                    (!right.isExpression() || canWrapProperty(element.node.name, right))) {
                                    shouldWrap = true;
                                }
                                else {
                                    // Not safe to wrap
                                    shouldWrap = false;
                                    break;
                                }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRqdXN0LXN0YXRpYy1jbGFzcy1tZW1iZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvdG9vbHMvYmFiZWwvcGx1Z2lucy9hZGp1c3Qtc3RhdGljLWNsYXNzLW1lbWJlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgsc0NBQXFFO0FBQ3JFLDZGQUE0RDtBQUM1RCw2R0FBNEU7QUFFNUU7O0dBRUc7QUFDSCxNQUFNLDBCQUEwQixHQUFHLFlBQVksQ0FBQztBQUVoRDs7OztHQUlHO0FBQ0gsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLEdBQUcsQ0FBQztJQUNuQyxNQUFNO0lBQ04sTUFBTTtJQUNOLE1BQU07SUFDTixNQUFNO0lBQ04sTUFBTTtJQUNOLE9BQU87SUFDUCxPQUFPO0lBQ1AsY0FBYztDQUNmLENBQUMsQ0FBQztBQUVIOzs7R0FHRztBQUNILE1BQU0scUJBQXFCLEdBQWtFO0lBQzNGLGdCQUFnQixDQUFDLElBQUk7UUFDbkIsT0FBTyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztJQUN6RSxDQUFDO0lBQ0QsWUFBWSxDQUFDLElBQUk7UUFDZixPQUFPLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO0lBQ2xDLENBQUM7SUFDRCxnQkFBZ0IsQ0FBQyxJQUFJO1FBQ25CLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7SUFDbkMsQ0FBQztDQUNGLENBQUM7QUFFRjs7Ozs7R0FLRztBQUNILFNBQWdCLFdBQVc7SUFDekIsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ25CLENBQUM7QUFGRCxrQ0FFQztBQUVEOzs7Ozs7OztHQVFHO0FBQ0gsU0FBUyxlQUFlLENBQUMsWUFBb0IsRUFBRSxlQUF5QjtJ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cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgTm9kZVBhdGgsIFBsdWdpbk9iaiwgUGx1Z2luUGFzcywgdHlwZXMgfSBmcm9tICdAYmFiZWwvY29yZSc7XG5pbXBvcnQgYW5ub3RhdGVBc1B1cmUgZnJvbSAnQGJhYmVsL2hlbHBlci1hbm5vdGF0ZS1hcy1wdXJlJztcbmltcG9ydCBzcGxpdEV4cG9ydERlY2xhcmF0aW9uIGZyb20gJ0BiYWJlbC9oZWxwZXItc3BsaXQtZXhwb3J0LWRlY2xhcmF0aW9uJztcblxuLyoqXG4gKiBUaGUgbmFtZSBvZiB0aGUgVHlwZXNjcmlwdCBkZWNvcmF0b3IgaGVscGVyIGZ1bmN0aW9uIGNyZWF0ZWQgYnkgdGhlIFR5cGVTY3JpcHQgY29tcGlsZXIuXG4gKi9cbmNvbnN0IFRTTElCX0RFQ09SQVRFX0hFTFBFUl9OQU1FID0gJ19fZGVjb3JhdGUnO1xuXG4vKipcbiAqIFRoZSBzZXQgb2YgQW5ndWxhciBzdGF0aWMgZmllbGRzIHRoYXQgc2hvdWxkIGFsd2F5cyBiZSB3cmFwcGVkLlxuICogVGhlc2UgZmllbGRzIG1heSBhcHBlYXIgdG8gaGF2ZSBzaWRlIGVmZmVjdHMgYnV0IGFyZSBzYWZlIHRvIHJlbW92ZSBpZiB0aGUgYXNzb2NpYXRlZCBjbGFzc1xuICogaXMgb3RoZXJ3aXNlIHVudXNlZCB3aXRoaW4gdGhlIG91dHB1dC5cbiAqL1xuY29uc3QgYW5ndWxhclN0YXRpY3NUb1dyYXAgPSBuZXcgU2V0KFtcbiAgJ8m1Y21wJyxcbiAgJ8m1ZGlyJyxcbiAgJ8m1ZmFjJyxcbiAgJ8m1aW5qJyxcbiAgJ8m1bW9kJyxcbiAgJ8m1cGlwZScsXG4gICfJtXByb3YnLFxuICAnSU5KRUNUT1JfS0VZJyxcbl0pO1xuXG4vKipcbiAqIEFuIG9iamVjdCBtYXAgb2Ygc3RhdGljIGZpZWxkcyBhbmQgcmVsYXRlZCB2YWx1ZSBjaGVja3MgZm9yIGRpc2NvdmVyeSBvZiBBbmd1bGFyIGdlbmVyYXRlZFxuICogSklUIHJlbGF0ZWQgc3RhdGljIGZpZWxkcy5cbiAqL1xuY29uc3QgYW5ndWxhclN0YXRpY3NUb0VsaWRlOiBSZWNvcmQ8c3RyaW5nLCAocGF0aDogTm9kZVBhdGg8dHlwZXMuRXhwcmVzc2lvbj4pID0+IGJvb2xlYW4+ID0ge1xuICAnY3RvclBhcmFtZXRlcnMnKHBhdGgpIHtcbiAgICByZXR1cm4gcGF0aC5pc0Z1bmN0aW9uRXhwcmVzc2lvbigpIHx8IHBhdGguaXNBcnJvd0Z1bmN0aW9uRXhwcmVzc2lvbigpO1xuICB9LFxuICAnZGVjb3JhdG9ycycocGF0aCkge1xuICAgIHJldHVybiBwYXRoLmlzQXJyYXlFeHByZXNzaW9uKCk7XG4gIH0sXG4gICdwcm9wRGVjb3JhdG9ycycocGF0aCkge1xuICAgIHJldHVybiBwYXRoLmlzT2JqZWN0RXhwcmVzc2lvbigpO1xuICB9LFxufTtcblxuLyoqXG4gKiBQcm92aWRlcyBvbmUgb3IgbW9yZSBrZXl3b3JkcyB0aGF0IGlmIGZvdW5kIHdpdGhpbiB0aGUgY29udGVudCBvZiBhIHNvdXJjZSBmaWxlIGluZGljYXRlXG4gKiB0aGF0IHRoaXMgcGx1Z2luIHNob3VsZCBiZSB1c2VkIHdpdGggYSBzb3VyY2UgZmlsZS5cbiAqXG4gKiBAcmV0dXJucyBBbiBhIHN0cmluZyBpdGVyYWJsZSBjb250YWluaW5nIG9uZSBvciBtb3JlIGtleXdvcmRzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0S2V5d29yZHMoKTogSXRlcmFibGU8c3RyaW5nPiB7XG4gIHJldHVybiBbJ2NsYXNzJ107XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lcyB3aGV0aGVyIGEgcHJvcGVydHkgYW5kIGl0cyBpbml0aWFsaXplciB2YWx1ZSBjYW4gYmUgc2FmZWx5IHdyYXBwZWQgaW4gYSBwdXJlXG4gKiBhbm5vdGF0ZWQgSUlGRS4gVmFsdWVzIHRoYXQgbWF5IGNhdXNlIHNpZGUgZWZmZWN0cyBhcmUgbm90IGNvbnNpZGVyZWQgc2FmZSB0byB3cmFwLlxuICogV3JhcHBpbmcgc3VjaCB2YWx1ZXMgbWF5IGNhdXNlIHJ1bnRpbWUgZXJyb3JzIGFuZC9vciBpbmNvcnJlY3QgcnVudGltZSBiZWhhdmlvci5cbiAqXG4gKiBAcGFyYW0gcHJvcGVydHlOYW1lIFRoZSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSB0byBhbmFseXplLlxuICogQHBhcmFtIGFzc2lnbm1lbnRWYWx1ZSBUaGUgaW5pdGlhbGl6ZXIgdmFsdWUgdGhhdCB3aWxsIGJlIGFzc2lnbmVkIHRvIHRoZSBwcm9wZXJ0eS5cbiAqIEByZXR1cm5zIElmIHRoZSBwcm9wZXJ0eSBjYW4gYmUgc2FmZWx5IHdyYXBwZWQsIHRoZW4gdHJ1ZTsgb3RoZXJ3aXNlLCBmYWxzZS5cbiAqL1xuZnVuY3Rpb24gY2FuV3JhcFByb3BlcnR5KHByb3BlcnR5TmFtZTogc3RyaW5nLCBhc3NpZ25tZW50VmFsdWU6IE5vZGVQYXRoKTogYm9vbGVhbiB7XG4gIGlmIChhbmd1bGFyU3RhdGljc1RvV3JhcC5oYXMocHJvcGVydHlOYW1lKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgY29uc3QgeyBsZWFkaW5nQ29tbWVudHMgfSA9IGFzc2lnbm1lbnRWYWx1ZS5ub2RlIGFzIHsgbGVhZGluZ0NvbW1lbnRzPzogeyB2YWx1ZTogc3RyaW5nIH1bXSB9O1xuICBpZiAoXG4gICAgbGVhZGluZ0NvbW1lbnRzPy5zb21lKFxuICAgICAgLy8gYEBwdXJlT3JCcmVha015Q29kZWAgaXMgdXNlZCBieSBjbG9zdXJlIGFuZCBpcyBwcmVzZW50IGluIEFuZ3VsYXIgY29kZVxuICAgICAgKHsgdmFsdWUgfSkgPT5cbiAgICAgICAgdmFsdWUuaW5jbHVkZXMoJ0BfX1BVUkVfXycpIHx8XG4gICAgICAgIHZhbHVlLmluY2x1ZGVzKCcjX19QVVJFX18nKSB8fFxuICAgICAgICB2YWx1ZS5pbmNsdWRlcygnQHB1cmVPckJyZWFrTXlDb2RlJyksXG4gICAgKVxuICApIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHJldHVybiBhc3NpZ25tZW50VmFsdWUuaXNQdXJlKCk7XG59XG5cbi8qKlxuICogQW5hbHl6ZSB0aGUgc2libGluZyBub2RlcyBvZiBhIGNsYXNzIHRvIGRldGVybWluZSBpZiBhbnkgZG93bmxldmVsIGVsZW1lbnRzIHNob3VsZCBiZVxuICogd3JhcHBlZCBpbiBhIHB1cmUgYW5ub3RhdGVkIElJRkUuIEFsc28gZGV0ZXJtaW5lcyBpZiBhbnkgZWxlbWVudHMgaGF2ZSBwb3RlbnRpYWwgc2lkZVxuICogZWZmZWN0cy5cbiAqXG4gKiBAcGFyYW0gb3JpZ2luIFRoZSBzdGFydGluZyBOb2RlUGF0aCBsb2NhdGlvbiBmb3IgYW5hbHl6aW5nIHNpYmxpbmdzLlxuICogQHBhcmFtIGNsYXNzSWRlbnRpZmllciBUaGUgaWRlbnRpZmllciBub2RlIHRoYXQgcmVwcmVzZW50cyB0aGUgbmFtZSBvZiB0aGUgY2xhc3MuXG4gKiBAcGFyYW0gYWxsb3dXcmFwcGluZ0RlY29yYXRvcnMgV2hldGhlciB0byBhbGxvdyBkZWNvcmF0b3JzIHRvIGJlIHdyYXBwZWQuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgcmVzdWx0cyBvZiB0aGUgYW5hbHlzaXMuXG4gKi9cbmZ1bmN0aW9uIGFuYWx5emVDbGFzc1NpYmxpbmdzKFxuICBvcmlnaW46IE5vZGVQYXRoLFxuICBjbGFzc0lkZW50aWZpZXI6IHR5cGVzLklkZW50aWZpZXIsXG4gIGFsbG93V3JhcHBpbmdEZWNvcmF0b3JzOiBib29sZWFuLFxuKTogeyBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0czogYm9vbGVhbjsgd3JhcFN0YXRlbWVudFBhdGhzOiBOb2RlUGF0aDx0eXBlcy5TdGF0ZW1lbnQ+W10gfSB7XG4gIGNvbnN0IHdyYXBTdGF0ZW1lbnRQYXRoczogTm9kZVBhdGg8dHlwZXMuU3RhdGVtZW50PltdID0gW107XG4gIGxldCBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyA9IGZhbHNlO1xuICBmb3IgKGxldCBpID0gMTsgOyArK2kpIHtcbiAgICBjb25zdCBuZXh0U3RhdGVtZW50ID0gb3JpZ2luLmdldFNpYmxpbmcoKyhvcmlnaW4ua2V5ID8/IDApICsgaSk7XG4gICAgaWYgKCFuZXh0U3RhdGVtZW50LmlzRXhwcmVzc2lvblN0YXRlbWVudCgpKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyBWYWxpZCBzaWJsaW5nIHN0YXRlbWVudHMgZm9yIGNsYXNzIGRlY2xhcmF0aW9ucyBhcmUgb25seSBhc3NpZ25tZW50IGV4cHJlc3Npb25zXG4gICAgLy8gYW5kIFR5cGVTY3JpcHQgZGVjb3JhdG9yIGhlbHBlciBjYWxsIGV4cHJlc3Npb25zXG4gICAgY29uc3QgbmV4dEV4cHJlc3Npb24gPSBuZXh0U3RhdGVtZW50LmdldCgnZXhwcmVzc2lvbicpO1xuICAgIGlmIChuZXh0RXhwcmVzc2lvbi5pc0NhbGxFeHByZXNzaW9uKCkpIHtcbiAgICAgIGlmIChcbiAgICAgICAgIXR5cGVzLmlzSWRlbnRpZmllcihuZXh0RXhwcmVzc2lvbi5ub2RlLmNhbGxlZSkgfHxcbiAgICAgICAgbmV4dEV4cHJlc3Npb24ubm9kZS5jYWxsZWUubmFtZSAhPT0gVFNMSUJfREVDT1JBVEVfSEVMUEVSX05BTUVcbiAgICAgICkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgaWYgKGFsbG93V3JhcHBpbmdEZWNvcmF0b3JzKSB7XG4gICAgICAgIHdyYXBTdGF0ZW1lbnRQYXRocy5wdXNoKG5leHRTdGF0ZW1lbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gU3RhdGVtZW50IGNhbm5vdCBiZSBzYWZlbHkgd3JhcHBlZCB3aGljaCBtYWtlcyB3cmFwcGluZyB0aGUgY2xhc3MgdW5uZWVkZWQuXG4gICAgICAgIC8vIFRoZSBzdGF0ZW1lbnQgd2lsbCBwcmV2ZW50IGV2ZW4gYSB3cmFwcGVkIGNsYXNzIGZyb20gYmVpbmcgb3B0aW1pemVkIGF3YXkuXG4gICAgICAgIGhhc1BvdGVudGlhbFNpZGVFZmZlY3RzID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgY29udGludWU7XG4gICAgfSBlbHNlIGlmICghbmV4dEV4cHJlc3Npb24uaXNBc3NpZ25tZW50RXhwcmVzc2lvbigpKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyBWYWxpZCBhc3NpZ25tZW50IGV4cHJlc3Npb25zIHNob3VsZCBiZSBtZW1iZXIgYWNjZXNzIGV4cHJlc3Npb25zIHVzaW5nIHRoZSBjbGFzc1xuICAgIC8vIG5hbWUgYXMgdGhlIG9iamVjdCBhbmQgYW4gaWRlbnRpZmllciBhcyB0aGUgcHJvcGVydHkgZm9yIHN0YXRpYyBmaWVsZHMgb3Igb25seVxuICAgIC8vIHRoZSBjbGFzcyBuYW1lIGZvciBkZWNvcmF0b3JzLlxuICAgIGNvbnN0IGxlZnQgPSBuZXh0RXhwcmVzc2lvbi5nZXQoJ2xlZnQnKTtcbiAgICBpZiAobGVmdC5pc0lkZW50aWZpZXIoKSkge1xuICAgICAgaWYgKFxuICAgICAgICAhbGVmdC5zY29wZS5iaW5kaW5nSWRlbnRpZmllckVxdWFscyhsZWZ0Lm5vZGUubmFtZSwgY2xhc3NJZGVudGlmaWVyKSB8fFxuICAgICAgICAhdHlwZXMuaXNDYWxsRXhwcmVzc2lvbihuZXh0RXhwcmVzc2lvbi5ub2RlLnJpZ2h0KSB8fFxuICAgICAgICAhdHlwZXMuaXNJZGVudGlmaWVyKG5leHRFeHByZXNzaW9uLm5vZGUucmlnaHQuY2FsbGVlKSB8fFxuICAgICAgICBuZXh0RXhwcmVzc2lvbi5ub2RlLnJpZ2h0LmNhbGxlZS5uYW1lICE9PSBUU0xJQl9ERUNPUkFURV9IRUxQRVJfTkFNRVxuICAgICAgKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBpZiAoYWxsb3dXcmFwcGluZ0RlY29yYXRvcnMpIHtcbiAgICAgICAgd3JhcFN0YXRlbWVudFBhdGhzLnB1c2gobmV4dFN0YXRlbWVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTdGF0ZW1lbnQgY2Fubm90IGJlIHNhZmVseSB3cmFwcGVkIHdoaWNoIG1ha2VzIHdyYXBwaW5nIHRoZSBjbGFzcyB1bm5lZWRlZC5cbiAgICAgICAgLy8gVGhlIHN0YXRlbWVudCB3aWxsIHByZXZlbnQgZXZlbiBhIHdyYXBwZWQgY2xhc3MgZnJvbSBiZWluZyBvcHRpbWl6ZWQgYXdheS5cbiAgICAgICAgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBjb250aW51ZTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgIWxlZnQuaXNNZW1iZXJFeHByZXNzaW9uKCkgfHxcbiAgICAgICF0eXBlcy5pc0lkZW50aWZpZXIobGVmdC5ub2RlLm9iamVjdCkgfHxcbiAgICAgICFsZWZ0LnNjb3BlLmJpbmRpbmdJZGVudGlmaWVyRXF1YWxzKGxlZnQubm9kZS5vYmplY3QubmFtZSwgY2xhc3NJZGVudGlmaWVyKSB8fFxuICAgICAgIXR5cGVzLmlzSWRlbnRpZmllcihsZWZ0Lm5vZGUucHJvcGVydHkpXG4gICAgKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjb25zdCBwcm9wZXJ0eU5hbWUgPSBsZWZ0Lm5vZGUucHJvcGVydHkubmFtZTtcbiAgICBjb25zdCBhc3NpZ25tZW50VmFsdWUgPSBuZXh0RXhwcmVzc2lvbi5nZXQoJ3JpZ2h0Jyk7XG4gICAgaWYgKGFuZ3VsYXJTdGF0aWNzVG9FbGlkZVtwcm9wZXJ0eU5hbWVdPy4oYXNzaWdubWVudFZhbHVlKSkge1xuICAgICAgbmV4dFN0YXRlbWVudC5yZW1vdmUoKTtcbiAgICAgIC0taTtcbiAgICB9IGVsc2UgaWYgKGNhbldyYXBQcm9wZXJ0eShwcm9wZXJ0eU5hbWUsIGFzc2lnbm1lbnRWYWx1ZSkpIHtcbiAgICAgIHdyYXBTdGF0ZW1lbnRQYXRocy5wdXNoKG5leHRTdGF0ZW1lbnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTdGF0ZW1lbnQgY2Fubm90IGJlIHNhZmVseSB3cmFwcGVkIHdoaWNoIG1ha2VzIHdyYXBwaW5nIHRoZSBjbGFzcyB1bm5lZWRlZC5cbiAgICAgIC8vIFRoZSBzdGF0ZW1lbnQgd2lsbCBwcmV2ZW50IGV2ZW4gYSB3cmFwcGVkIGNsYXNzIGZyb20gYmVpbmcgb3B0aW1pemVkIGF3YXkuXG4gICAgICBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMsIHdyYXBTdGF0ZW1lbnRQYXRocyB9O1xufVxuXG4vKipcbiAqIFRoZSBzZXQgb2YgY2xhc3NlcyBhbHJlYWR5IHZpc2l0ZWQgYW5kIGFuYWx5emVkIGR1cmluZyB0aGUgcGx1Z2luJ3MgZXhlY3V0aW9uLlxuICogVGhpcyBpcyB1c2VkIHRvIHByZXZlbnQgYWRqdXN0ZWQgY2xhc3NlcyBmcm9tIGJlaW5nIHJlcGVhdGVkbHkgYW5hbHl6ZWQgd2hpY2ggY2FuIGxlYWRcbiAqIHRvIGFuIGluZmluaXRlIGxvb3AuXG4gKi9cbmNvbnN0IHZpc2l0ZWRDbGFzc2VzID0gbmV3IFdlYWtTZXQ8dHlwZXMuQ2xhc3M+KCk7XG5cbi8qKlxuICogQSBtYXAgb2YgY2xhc3NlcyB0aGF0IGhhdmUgYWxyZWFkeSBiZWVuIGFuYWx5emVkIGR1cmluZyB0aGUgZGVmYXVsdCBleHBvcnQgc3BsaXR0aW5nIHN0ZXAuXG4gKiBUaGlzIGlzIHVzZWQgdG8gYXZvaWQgYW5hbHl6aW5nIGEgY2xhc3MgZGVjbGFyYXRpb24gdHdpY2UgaWYgaXQgaXMgYSBkaXJlY3QgZGVmYXVsdCBleHBvcnQuXG4gKi9cbmNvbnN0IGV4cG9ydERlZmF1bHRBbmFseXNpcyA9IG5ldyBXZWFrTWFwPHR5cGVzLkNsYXNzLCBSZXR1cm5UeXBlPHR5cGVvZiBhbmFseXplQ2xhc3NTaWJsaW5ncz4+KCk7XG5cbi8qKlxuICogQSBiYWJlbCBwbHVnaW4gZmFjdG9yeSBmdW5jdGlvbiBmb3IgYWRqdXN0aW5nIGNsYXNzZXM7IHByaW1hcmlseSB3aXRoIEFuZ3VsYXIgbWV0YWRhdGEuXG4gKiBUaGUgYWRqdXN0bWVudHMgaW5jbHVkZSB3cmFwcGluZyBjbGFzc2VzIHdpdGgga25vd24gc2FmZSBvciBubyBzaWRlIGVmZmVjdHMgd2l0aCBwdXJlXG4gKiBhbm5vdGF0aW9ucyB0byBzdXBwb3J0IGRlYWQgY29kZSByZW1vdmFsIG9mIHVudXNlZCBjbGFzc2VzLiBBbmd1bGFyIGNvbXBpbGVyIGdlbmVyYXRlZFxuICogbWV0YWRhdGEgc3RhdGljIGZpZWxkcyBub3QgcmVxdWlyZWQgaW4gQU9UIG1vZGUgYXJlIGFsc28gZWxpZGVkIHRvIGJldHRlciBzdXBwb3J0IGJ1bmRsZXItXG4gKiBsZXZlbCB0cmVlc2hha2luZy5cbiAqXG4gKiBAcmV0dXJucyBBIGJhYmVsIHBsdWdpbiBvYmplY3QgaW5zdGFuY2UuXG4gKi9cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoKTogUGx1Z2luT2JqIHtcbiAgcmV0dXJuIHtcbiAgICB2aXNpdG9yOiB7XG4gICAgICAvLyBXaGVuIGEgY2xhc3MgaXMgY29udmVydGVkIHRvIGEgdmFyaWFibGUgZGVjbGFyYXRpb24sIHRoZSBkZWZhdWx0IGV4cG9ydCBtdXN0IGJlIG1vdmVkXG4gICAgICAvLyB0byBhIHN1YnNlcXVlbnQgc3RhdGVtZW50IHRvIHByZXZlbnQgYSBKYXZhU2NyaXB0IHN5bnRheCBlcnJvci5cbiAgICAgIEV4cG9ydERlZmF1bHREZWNsYXJhdGlvbihwYXRoOiBOb2RlUGF0aDx0eXBlcy5FeHBvcnREZWZhdWx0RGVjbGFyYXRpb24+LCBzdGF0ZTogUGx1Z2luUGFzcykge1xuICAgICAgICBjb25zdCBkZWNsYXJhdGlvbiA9IHBhdGguZ2V0KCdkZWNsYXJhdGlvbicpO1xuICAgICAgICBpZiAoIWRlY2xhcmF0aW9uLmlzQ2xhc3NEZWNsYXJhdGlvbigpIHx8ICFkZWNsYXJhdGlvbi5ub2RlLmlkKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyB3cmFwRGVjb3JhdG9ycyB9ID0gc3RhdGUub3B0cyBhcyB7IHdyYXBEZWNvcmF0b3JzOiBib29sZWFuIH07XG4gICAgICAgIGNvbnN0IGFuYWx5c2lzID0gYW5hbHl6ZUNsYXNzU2libGluZ3MocGF0aCwgZGVjbGFyYXRpb24ubm9kZS5pZCwgd3JhcERlY29yYXRvcnMpO1xuICAgICAgICBleHBvcnREZWZhdWx0QW5hbHlzaXMuc2V0KGRlY2xhcmF0aW9uLm5vZGUsIGFuYWx5c2lzKTtcblxuICAgICAgICAvLyBTcGxpdHRpbmcgdGhlIGV4cG9ydCBkZWNsYXJhdGlvbiBpcyBub3QgbmVlZGVkIGlmIHRoZSBjbGFzcyB3aWxsIG5vdCBiZSB3cmFwcGVkXG4gICAgICAgIGlmIChhbmFseXNpcy5oYXNQb3RlbnRpYWxTaWRlRWZmZWN0cykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHNwbGl0RXhwb3J0RGVjbGFyYXRpb24ocGF0aCk7XG4gICAgICB9LFxuICAgICAgQ2xhc3NEZWNsYXJhdGlvbihwYXRoOiBOb2RlUGF0aDx0eXBlcy5DbGFzc0RlY2xhcmF0aW9uPiwgc3RhdGU6IFBsdWdpblBhc3MpIHtcbiAgICAgICAgY29uc3QgeyBub2RlOiBjbGFzc05vZGUsIHBhcmVudFBhdGggfSA9IHBhdGg7XG4gICAgICAgIGNvbnN0IHsgd3JhcERlY29yYXRvcnMgfSA9IHN0YXRlLm9wdHMgYXMgeyB3cmFwRGVjb3JhdG9yczogYm9vbGVhbiB9O1xuXG4gICAgICAgIC8vIFNraXAgaWYgYWxyZWFkeSB2aXNpdGVkIG9yIGhhcyBubyBuYW1lXG4gICAgICAgIGlmICh2aXNpdGVkQ2xhc3Nlcy5oYXMoY2xhc3NOb2RlKSB8fCAhY2xhc3NOb2RlLmlkKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQW5hbHl6ZSBzaWJsaW5nIHN0YXRlbWVudHMgZm9yIGVsZW1lbnRzIG9mIHRoZSBjbGFzcyB0aGF0IHdlcmUgZG93bmxldmVsZWRcbiAgICAgICAgY29uc3Qgb3JpZ2luID0gcGFyZW50UGF0aC5pc0V4cG9ydE5hbWVkRGVjbGFyYXRpb24oKSA/IHBhcmVudFBhdGggOiBwYXRoO1xuICAgICAgICBjb25zdCB7IHdyYXBTdGF0ZW1lbnRQYXRocywgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMgfSA9XG4gICAgICAgICAgZXhwb3J0RGVmYXVsdEFuYWx5c2lzLmdldChjbGFzc05vZGUpID8/XG4gICAgICAgICAgYW5hbHl6ZUNsYXNzU2libGluZ3Mob3JpZ2luLCBjbGFzc05vZGUuaWQsIHdyYXBEZWNvcmF0b3JzKTtcblxuICAgICAgICB2aXNpdGVkQ2xhc3Nlcy5hZGQoY2xhc3NOb2RlKTtcblxuICAgICAgICBpZiAoaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiBubyBzdGF0ZW1lbnRzIHRvIHdyYXAsIGNoZWNrIGZvciBzdGF0aWMgY2xhc3MgcHJvcGVydGllcy5cbiAgICAgICAgLy8gU3RhdGljIGNsYXNzIHByb3BlcnRpZXMgbWF5IGJlIGRvd25sZXZlbGVkIGF0IGxhdGVyIHN0YWdlcyBpbiB0aGUgYnVpbGQgcGlwZWxpbmVcbiAgICAgICAgLy8gd2hpY2ggcmVzdWx0cyBpbiBhZGRpdGlvbmFsIGZ1bmN0aW9uIGNhbGxzIG91dHNpZGUgdGhlIGNsYXNzIGJvZHkuIFRoZXNlIGNhbGxzXG4gICAgICAgIC8vIHRoZW4gY2F1c2UgdGhlIGNsYXNzIHRvIGJlIHJlZmVyZW5jZWQgYW5kIG5vdCBlbGlnaWJsZSBmb3IgcmVtb3ZhbC4gU2luY2UgaXQgaXNcbiAgICAgICAgLy8gbm90IGtub3duIGF0IHRoaXMgc3RhZ2Ugd2hldGhlciB0aGUgY2xhc3MgbmVlZHMgdG8gYmUgZG93bmxldmVsZWQsIHRoZSB0cmFuc2Zvcm1cbiAgICAgICAgLy8gd3JhcHMgY2xhc3NlcyBwcmVlbXB0aXZlbHkgdG8gYWxsb3cgZm9yIHBvdGVudGlhbCByZW1vdmFsIHdpdGhpbiB0aGUgb3B0aW1pemF0aW9uXG4gICAgICAgIC8vIHN0YWdlcy5cbiAgICAgICAgaWYgKHdyYXBTdGF0ZW1lbnRQYXRocy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBsZXQgc2hvdWxkV3JhcCA9IGZhbHNlO1xuICAgICAgICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBwYXRoLmdldCgnYm9keScpLmdldCgnYm9keScpKSB7XG4gICAgICAgICAgICBpZiAoZWxlbWVudC5pc0NsYXNzUHJvcGVydHkoKSkge1xuICAgICAgICAgICAgICAvLyBPbmx5IG5lZWQgdG8gYW5hbHl6ZSBzdGF0aWMgcHJvcGVydGllc1xuICAgICAgICAgICAgICBpZiAoIWVsZW1lbnQubm9kZS5zdGF0aWMpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIENoZWNrIGZvciBwb3RlbnRpYWwgc2lkZSBlZmZlY3RzLlxuICAgICAgICAgICAgICAvLyBUaGVzZSBjaGVja3MgYXJlIGNvbnNlcnZhdGl2ZSBhbmQgY291bGQgcG90ZW50aWFsbHkgYmUgZXhwYW5kZWQgaW4gdGhlIGZ1dHVyZS5cbiAgICAgICAgICAgICAgY29uc3QgZWxlbWVudEtleSA9IGVsZW1lbnQuZ2V0KCdrZXknKTtcbiAgICAgICAgICAgICAgY29uc3QgZWxlbWVudFZhbHVlID0gZWxlbWVudC5nZXQoJ3ZhbHVlJyk7XG4gICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBlbGVtZW50S2V5LmlzSWRlbnRpZmllcigpICYmXG4gICAgICAgICAgICAgICAgKCFlbGVtZW50VmFsdWUuaXNFeHByZXNzaW9uKCkgfHxcbiAgICAgICAgICAgICAgICAgIGNhbldyYXBQcm9wZXJ0eShlbGVtZW50S2V5Lm5vZGUubmFtZSwgZWxlbWVudFZhbHVlKSlcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgc2hvdWxkV3JhcCA9IHRydWU7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gTm90IHNhZmUgdG8gd3JhcFxuICAgICAgICAgICAgICAgIHNob3VsZFdyYXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgICAgICAgfSBlbHNlIGlmICgoZWxlbWVudCBhcyBhbnkpLmlzU3RhdGljQmxvY2soKSkge1xuICAgICAgICAgICAgICAvLyBPbmx5IG5lZWQgdG8gYW5hbHl6ZSBzdGF0aWMgYmxvY2tzXG4gICAgICAgICAgICAgIGNvbnN0IGJvZHkgPSBlbGVtZW50LmdldCgnYm9keScpO1xuXG4gICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGJvZHkpICYmIGJvZHkubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIC8vIE5vdCBzYWZlIHRvIHdyYXBcbiAgICAgICAgICAgICAgICBzaG91bGRXcmFwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBleHByZXNzaW9uID0gYm9keS5maW5kKChuOiBOb2RlUGF0aDx0eXBlcy5Ob2RlPikgPT5cbiAgICAgICAgICAgICAgICBuLmlzRXhwcmVzc2lvblN0YXRlbWVudCgpLFxuICAgICAgICAgICAgICApIGFzIE5vZGVQYXRoPHR5cGVzLkV4cHJlc3Npb25TdGF0ZW1lbnQ+IHwgdW5kZWZpbmVkO1xuXG4gICAgICAgICAgICAgIGNvbnN0IGFzc2lnbm1lbnRFeHByZXNzaW9uID0gZXhwcmVzc2lvbj8uZ2V0KCdleHByZXNzaW9uJyk7XG4gICAgICAgICAgICAgIGlmIChhc3NpZ25tZW50RXhwcmVzc2lvbj8uaXNBc3NpZ25tZW50RXhwcmVzc2lvbigpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGVmdCA9IGFzc2lnbm1lbnRFeHByZXNzaW9uLmdldCgnbGVmdCcpO1xuICAgICAgICAgICAgICAgIGlmICghbGVmdC5pc01lbWJlckV4cHJlc3Npb24oKSkge1xuICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFsZWZ0LmdldCgnb2JqZWN0JykuaXNUaGlzRXhwcmVzc2lvbigpKSB7XG4gICAgICAgICAgICAgICAgICAvLyBOb3Qgc2FmZSB0byB3cmFwXG4gICAgICAgICAgICAgICAgICBzaG91bGRXcmFwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBlbGVtZW50ID0gbGVmdC5nZXQoJ3Byb3BlcnR5Jyk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmlnaHQgPSBhc3NpZ25tZW50RXhwcmVzc2lvbi5nZXQoJ3JpZ2h0Jyk7XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgZWxlbWVudC5pc0lkZW50aWZpZXIoKSAmJlxuICAgICAgICAgICAgICAgICAgKCFyaWdodC5pc0V4cHJlc3Npb24oKSB8fCBjYW5XcmFwUHJvcGVydHkoZWxlbWVudC5ub2RlLm5hbWUsIHJpZ2h0KSlcbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgIHNob3VsZFdyYXAgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAvLyBOb3Qgc2FmZSB0byB3cmFwXG4gICAgICAgICAgICAgICAgICBzaG91bGRXcmFwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFzaG91bGRXcmFwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd3JhcFN0YXRlbWVudE5vZGVzOiB0eXBlcy5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IHN0YXRlbWVudFBhdGggb2Ygd3JhcFN0YXRlbWVudFBhdGhzKSB7XG4gICAgICAgICAgd3JhcFN0YXRlbWVudE5vZGVzLnB1c2goc3RhdGVtZW50UGF0aC5ub2RlKTtcbiAgICAgICAgICBzdGF0ZW1lbnRQYXRoLnJlbW92ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gV3JhcCBjbGFzcyBhbmQgc2FmZSBzdGF0aWMgYXNzaWdubWVudHMgaW4gYSBwdXJlIGFubm90YXRlZCBJSUZFXG4gICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IHR5cGVzLmFycm93RnVuY3Rpb25FeHByZXNzaW9uKFxuICAgICAgICAgIFtdLFxuICAgICAgICAgIHR5cGVzLmJsb2NrU3RhdGVtZW50KFtcbiAgICAgICAgICAgIGNsYXNzTm9kZSxcbiAgICAgICAgICAgIC4uLndyYXBTdGF0ZW1lbnROb2RlcyxcbiAgICAgICAgICAgIHR5cGVzLnJldHVyblN0YXRlbWVudCh0eXBlcy5jbG9uZU5vZGUoY2xhc3NOb2RlLmlkKSksXG4gICAgICAgICAgXSksXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IHJlcGxhY2VtZW50SW5pdGlhbGl6ZXIgPSB0eXBlcy5jYWxsRXhwcmVzc2lvbihcbiAgICAgICAgICB0eXBlcy5wYXJlbnRoZXNpemVkRXhwcmVzc2lvbihjb250YWluZXIpLFxuICAgICAgICAgIFtdLFxuICAgICAgICApO1xuICAgICAgICBhbm5vdGF0ZUFzUHVyZShyZXBsYWNlbWVudEluaXRpYWxpemVyKTtcblxuICAgICAgICAvLyBSZXBsYWNlIGNsYXNzIHdpdGggSUlGRSB3cmFwcGVkIGNsYXNzXG4gICAgICAgIGNvbnN0IGRlY2xhcmF0aW9uID0gdHlwZXMudmFyaWFibGVEZWNsYXJhdGlvbignbGV0JywgW1xuICAgICAgICAgIHR5cGVzLnZhcmlhYmxlRGVjbGFyYXRvcih0eXBlcy5jbG9uZU5vZGUoY2xhc3NOb2RlLmlkKSwgcmVwbGFjZW1lbnRJbml0aWFsaXplciksXG4gICAgICAgIF0pO1xuICAgICAgICBwYXRoLnJlcGxhY2VXaXRoKGRlY2xhcmF0aW9uKTtcbiAgICAgIH0sXG4gICAgICBDbGFzc0V4cHJlc3Npb24ocGF0aDogTm9kZVBhdGg8dHlwZXMuQ2xhc3NFeHByZXNzaW9uPiwgc3RhdGU6IFBsdWdpblBhc3MpIHtcbiAgICAgICAgY29uc3QgeyBub2RlOiBjbGFzc05vZGUsIHBhcmVudFBhdGggfSA9IHBhdGg7XG4gICAgICAgIGNvbnN0IHsgd3JhcERlY29yYXRvcnMgfSA9IHN0YXRlLm9wdHMgYXMgeyB3cmFwRGVjb3JhdG9yczogYm9vbGVhbiB9O1xuXG4gICAgICAgIC8vIENsYXNzIGV4cHJlc3Npb25zIGFyZSB1c2VkIGJ5IFR5cGVTY3JpcHQgdG8gcmVwcmVzZW50IGRvd25sZXZlbCBjbGFzcy9jb25zdHJ1Y3RvciBkZWNvcmF0b3JzLlxuICAgICAgICAvLyBJZiBub3Qgd3JhcHBpbmcgZGVjb3JhdG9ycywgdGhleSBkbyBub3QgbmVlZCB0byBiZSBwcm9jZXNzZWQuXG4gICAgICAgIGlmICghd3JhcERlY29yYXRvcnMgfHwgdmlzaXRlZENsYXNzZXMuaGFzKGNsYXNzTm9kZSkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXG4gICAgICAgICAgIWNsYXNzTm9kZS5pZCB8fFxuICAgICAgICAgICFwYXJlbnRQYXRoLmlzVmFyaWFibGVEZWNsYXJhdG9yKCkgfHxcbiAgICAgICAgICAhdHlwZXMuaXNJZGVudGlmaWVyKHBhcmVudFBhdGgubm9kZS5pZCkgfHxcbiAgICAgICAgICBwYXJlbnRQYXRoLm5vZGUuaWQubmFtZSAhPT0gY2xhc3NOb2RlLmlkLm5hbWVcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb3JpZ2luID0gcGFyZW50UGF0aC5wYXJlbnRQYXRoO1xuICAgICAgICBpZiAoIW9yaWdpbi5pc1ZhcmlhYmxlRGVjbGFyYXRpb24oKSB8fCBvcmlnaW4ubm9kZS5kZWNsYXJhdGlvbnMubGVuZ3RoICE9PSAxKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyB3cmFwU3RhdGVtZW50UGF0aHMsIGhhc1BvdGVudGlhbFNpZGVFZmZlY3RzIH0gPSBhbmFseXplQ2xhc3NTaWJsaW5ncyhcbiAgICAgICAgICBvcmlnaW4sXG4gICAgICAgICAgcGFyZW50UGF0aC5ub2RlLmlkLFxuICAgICAgICAgIHdyYXBEZWNvcmF0b3JzLFxuICAgICAgICApO1xuXG4gICAgICAgIHZpc2l0ZWRDbGFzc2VzLmFkZChjbGFzc05vZGUpO1xuXG4gICAgICAgIGlmIChoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyB8fCB3cmFwU3RhdGVtZW50UGF0aHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd3JhcFN0YXRlbWVudE5vZGVzOiB0eXBlcy5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IHN0YXRlbWVudFBhdGggb2Ygd3JhcFN0YXRlbWVudFBhdGhzKSB7XG4gICAgICAgICAgd3JhcFN0YXRlbWVudE5vZGVzLnB1c2goc3RhdGVtZW50UGF0aC5ub2RlKTtcbiAgICAgICAgICBzdGF0ZW1lbnRQYXRoLnJlbW92ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gV3JhcCBjbGFzcyBhbmQgc2FmZSBzdGF0aWMgYXNzaWdubWVudHMgaW4gYSBwdXJlIGFubm90YXRlZCBJSUZFXG4gICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IHR5cGVzLmFycm93RnVuY3Rpb25FeHByZXNzaW9uKFxuICAgICAgICAgIFtdLFxuICAgICAgICAgIHR5cGVzLmJsb2NrU3RhdGVtZW50KFtcbiAgICAgICAgICAgIHR5cGVzLnZhcmlhYmxlRGVjbGFyYXRpb24oJ2xldCcsIFtcbiAgICAgICAgICAgICAgdHlwZXMudmFyaWFibGVEZWNsYXJhdG9yKHR5cGVzLmNsb25lTm9kZShjbGFzc05vZGUuaWQpLCBjbGFzc05vZGUpLFxuICAgICAgICAgICAgXSksXG4gICAgICAgICAgICAuLi53cmFwU3RhdGVtZW50Tm9kZXMsXG4gICAgICAgICAgICB0eXBlcy5yZXR1cm5TdGF0ZW1lbnQodHlwZXMuY2xvbmVOb2RlKGNsYXNzTm9kZS5pZCkpLFxuICAgICAgICAgIF0pLFxuICAgICAgICApO1xuICAgICAgICBjb25zdCByZXBsYWNlbWVudEluaXRpYWxpemVyID0gdHlwZXMuY2FsbEV4cHJlc3Npb24oXG4gICAgICAgICAgdHlwZXMucGFyZW50aGVzaXplZEV4cHJlc3Npb24oY29udGFpbmVyKSxcbiAgICAgICAgICBbXSxcbiAgICAgICAgKTtcbiAgICAgICAgYW5ub3RhdGVBc1B1cmUocmVwbGFjZW1lbnRJbml0aWFsaXplcik7XG5cbiAgICAgICAgLy8gQWRkIHRoZSB3cmFwcGVkIGNsYXNzIGRpcmVjdGx5IHRvIHRoZSB2YXJpYWJsZSBkZWNsYXJhdGlvblxuICAgICAgICBwYXJlbnRQYXRoLmdldCgnaW5pdCcpLnJlcGxhY2VXaXRoKHJlcGxhY2VtZW50SW5pdGlhbGl6ZXIpO1xuICAgICAgfSxcbiAgICB9LFxuICB9O1xufVxuIl19