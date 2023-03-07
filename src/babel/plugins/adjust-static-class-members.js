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
                var _a;
                const { node: classNode, parentPath } = path;
                const { wrapDecorators } = state.opts;
                if (visitedClasses.has(classNode)) {
                    return;
                }
                // Analyze sibling statements for elements of the class that were downleveled
                const origin = parentPath.isExportNamedDeclaration() ? parentPath : path;
                const { wrapStatementPaths, hasPotentialSideEffects } = (_a = exportDefaultAnalysis.get(classNode)) !== null && _a !== void 0 ? _a : analyzeClassSiblings(origin, classNode.id, wrapDecorators);
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
                            const assignmentExpression = expression === null || expression === void 0 ? void 0 : expression.get('expression');
                            if (assignmentExpression === null || assignmentExpression === void 0 ? void 0 : assignmentExpression.isAssignmentExpression()) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRqdXN0LXN0YXRpYy1jbGFzcy1tZW1iZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYmFiZWwvcGx1Z2lucy9hZGp1c3Qtc3RhdGljLWNsYXNzLW1lbWJlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgsc0NBQXFFO0FBQ3JFLDZGQUE0RDtBQUM1RCw2R0FBNEU7QUFFNUU7O0dBRUc7QUFDSCxNQUFNLDBCQUEwQixHQUFHLFlBQVksQ0FBQztBQUVoRDs7OztHQUlHO0FBQ0gsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLEdBQUcsQ0FBQztJQUNuQyxNQUFNO0lBQ04sTUFBTTtJQUNOLE1BQU07SUFDTixNQUFNO0lBQ04sTUFBTTtJQUNOLE9BQU87SUFDUCxPQUFPO0lBQ1AsY0FBYztDQUNmLENBQUMsQ0FBQztBQUVIOzs7R0FHRztBQUNILE1BQU0scUJBQXFCLEdBQWtFO0lBQzNGLGdCQUFnQixDQUFDLElBQUk7UUFDbkIsT0FBTyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztJQUN6RSxDQUFDO0lBQ0QsWUFBWSxDQUFDLElBQUk7UUFDZixPQUFPLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO0lBQ2xDLENBQUM7SUFDRCxnQkFBZ0IsQ0FBQyxJQUFJO1FBQ25CLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7SUFDbkMsQ0FBQztDQUNGLENBQUM7QUFFRjs7Ozs7R0FLRztBQUNILFNBQWdCLFdBQVc7SUFDekIsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ25CLENBQUM7QUFGRCxrQ0FFQztBQUVEOzs7Ozs7OztHQVFHO0FBQ0gsU0FBUyxlQUFlLENBQUMsWUFBb0IsRUFBRSxlQUF5QjtJQUN0RSxJQUFJ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UmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgTm9kZVBhdGgsIFBsdWdpbk9iaiwgUGx1Z2luUGFzcywgdHlwZXMgfSBmcm9tICdAYmFiZWwvY29yZSc7XG5pbXBvcnQgYW5ub3RhdGVBc1B1cmUgZnJvbSAnQGJhYmVsL2hlbHBlci1hbm5vdGF0ZS1hcy1wdXJlJztcbmltcG9ydCBzcGxpdEV4cG9ydERlY2xhcmF0aW9uIGZyb20gJ0BiYWJlbC9oZWxwZXItc3BsaXQtZXhwb3J0LWRlY2xhcmF0aW9uJztcblxuLyoqXG4gKiBUaGUgbmFtZSBvZiB0aGUgVHlwZXNjcmlwdCBkZWNvcmF0b3IgaGVscGVyIGZ1bmN0aW9uIGNyZWF0ZWQgYnkgdGhlIFR5cGVTY3JpcHQgY29tcGlsZXIuXG4gKi9cbmNvbnN0IFRTTElCX0RFQ09SQVRFX0hFTFBFUl9OQU1FID0gJ19fZGVjb3JhdGUnO1xuXG4vKipcbiAqIFRoZSBzZXQgb2YgQW5ndWxhciBzdGF0aWMgZmllbGRzIHRoYXQgc2hvdWxkIGFsd2F5cyBiZSB3cmFwcGVkLlxuICogVGhlc2UgZmllbGRzIG1heSBhcHBlYXIgdG8gaGF2ZSBzaWRlIGVmZmVjdHMgYnV0IGFyZSBzYWZlIHRvIHJlbW92ZSBpZiB0aGUgYXNzb2NpYXRlZCBjbGFzc1xuICogaXMgb3RoZXJ3aXNlIHVudXNlZCB3aXRoaW4gdGhlIG91dHB1dC5cbiAqL1xuY29uc3QgYW5ndWxhclN0YXRpY3NUb1dyYXAgPSBuZXcgU2V0KFtcbiAgJ8m1Y21wJyxcbiAgJ8m1ZGlyJyxcbiAgJ8m1ZmFjJyxcbiAgJ8m1aW5qJyxcbiAgJ8m1bW9kJyxcbiAgJ8m1cGlwZScsXG4gICfJtXByb3YnLFxuICAnSU5KRUNUT1JfS0VZJyxcbl0pO1xuXG4vKipcbiAqIEFuIG9iamVjdCBtYXAgb2Ygc3RhdGljIGZpZWxkcyBhbmQgcmVsYXRlZCB2YWx1ZSBjaGVja3MgZm9yIGRpc2NvdmVyeSBvZiBBbmd1bGFyIGdlbmVyYXRlZFxuICogSklUIHJlbGF0ZWQgc3RhdGljIGZpZWxkcy5cbiAqL1xuY29uc3QgYW5ndWxhclN0YXRpY3NUb0VsaWRlOiBSZWNvcmQ8c3RyaW5nLCAocGF0aDogTm9kZVBhdGg8dHlwZXMuRXhwcmVzc2lvbj4pID0+IGJvb2xlYW4+ID0ge1xuICAnY3RvclBhcmFtZXRlcnMnKHBhdGgpIHtcbiAgICByZXR1cm4gcGF0aC5pc0Z1bmN0aW9uRXhwcmVzc2lvbigpIHx8IHBhdGguaXNBcnJvd0Z1bmN0aW9uRXhwcmVzc2lvbigpO1xuICB9LFxuICAnZGVjb3JhdG9ycycocGF0aCkge1xuICAgIHJldHVybiBwYXRoLmlzQXJyYXlFeHByZXNzaW9uKCk7XG4gIH0sXG4gICdwcm9wRGVjb3JhdG9ycycocGF0aCkge1xuICAgIHJldHVybiBwYXRoLmlzT2JqZWN0RXhwcmVzc2lvbigpO1xuICB9LFxufTtcblxuLyoqXG4gKiBQcm92aWRlcyBvbmUgb3IgbW9yZSBrZXl3b3JkcyB0aGF0IGlmIGZvdW5kIHdpdGhpbiB0aGUgY29udGVudCBvZiBhIHNvdXJjZSBmaWxlIGluZGljYXRlXG4gKiB0aGF0IHRoaXMgcGx1Z2luIHNob3VsZCBiZSB1c2VkIHdpdGggYSBzb3VyY2UgZmlsZS5cbiAqXG4gKiBAcmV0dXJucyBBbiBhIHN0cmluZyBpdGVyYWJsZSBjb250YWluaW5nIG9uZSBvciBtb3JlIGtleXdvcmRzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0S2V5d29yZHMoKTogSXRlcmFibGU8c3RyaW5nPiB7XG4gIHJldHVybiBbJ2NsYXNzJ107XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lcyB3aGV0aGVyIGEgcHJvcGVydHkgYW5kIGl0cyBpbml0aWFsaXplciB2YWx1ZSBjYW4gYmUgc2FmZWx5IHdyYXBwZWQgaW4gYSBwdXJlXG4gKiBhbm5vdGF0ZWQgSUlGRS4gVmFsdWVzIHRoYXQgbWF5IGNhdXNlIHNpZGUgZWZmZWN0cyBhcmUgbm90IGNvbnNpZGVyZWQgc2FmZSB0byB3cmFwLlxuICogV3JhcHBpbmcgc3VjaCB2YWx1ZXMgbWF5IGNhdXNlIHJ1bnRpbWUgZXJyb3JzIGFuZC9vciBpbmNvcnJlY3QgcnVudGltZSBiZWhhdmlvci5cbiAqXG4gKiBAcGFyYW0gcHJvcGVydHlOYW1lIFRoZSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSB0byBhbmFseXplLlxuICogQHBhcmFtIGFzc2lnbm1lbnRWYWx1ZSBUaGUgaW5pdGlhbGl6ZXIgdmFsdWUgdGhhdCB3aWxsIGJlIGFzc2lnbmVkIHRvIHRoZSBwcm9wZXJ0eS5cbiAqIEByZXR1cm5zIElmIHRoZSBwcm9wZXJ0eSBjYW4gYmUgc2FmZWx5IHdyYXBwZWQsIHRoZW4gdHJ1ZTsgb3RoZXJ3aXNlLCBmYWxzZS5cbiAqL1xuZnVuY3Rpb24gY2FuV3JhcFByb3BlcnR5KHByb3BlcnR5TmFtZTogc3RyaW5nLCBhc3NpZ25tZW50VmFsdWU6IE5vZGVQYXRoKTogYm9vbGVhbiB7XG4gIGlmIChhbmd1bGFyU3RhdGljc1RvV3JhcC5oYXMocHJvcGVydHlOYW1lKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgY29uc3QgeyBsZWFkaW5nQ29tbWVudHMgfSA9IGFzc2lnbm1lbnRWYWx1ZS5ub2RlIGFzIHsgbGVhZGluZ0NvbW1lbnRzPzogeyB2YWx1ZTogc3RyaW5nIH1bXSB9O1xuICBpZiAoXG4gICAgbGVhZGluZ0NvbW1lbnRzPy5zb21lKFxuICAgICAgLy8gYEBwdXJlT3JCcmVha015Q29kZWAgaXMgdXNlZCBieSBjbG9zdXJlIGFuZCBpcyBwcmVzZW50IGluIEFuZ3VsYXIgY29kZVxuICAgICAgKHsgdmFsdWUgfSkgPT5cbiAgICAgICAgdmFsdWUuaW5jbHVkZXMoJ0BfX1BVUkVfXycpIHx8XG4gICAgICAgIHZhbHVlLmluY2x1ZGVzKCcjX19QVVJFX18nKSB8fFxuICAgICAgICB2YWx1ZS5pbmNsdWRlcygnQHB1cmVPckJyZWFrTXlDb2RlJyksXG4gICAgKVxuICApIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHJldHVybiBhc3NpZ25tZW50VmFsdWUuaXNQdXJlKCk7XG59XG5cbi8qKlxuICogQW5hbHl6ZSB0aGUgc2libGluZyBub2RlcyBvZiBhIGNsYXNzIHRvIGRldGVybWluZSBpZiBhbnkgZG93bmxldmVsIGVsZW1lbnRzIHNob3VsZCBiZVxuICogd3JhcHBlZCBpbiBhIHB1cmUgYW5ub3RhdGVkIElJRkUuIEFsc28gZGV0ZXJtaW5lcyBpZiBhbnkgZWxlbWVudHMgaGF2ZSBwb3RlbnRpYWwgc2lkZVxuICogZWZmZWN0cy5cbiAqXG4gKiBAcGFyYW0gb3JpZ2luIFRoZSBzdGFydGluZyBOb2RlUGF0aCBsb2NhdGlvbiBmb3IgYW5hbHl6aW5nIHNpYmxpbmdzLlxuICogQHBhcmFtIGNsYXNzSWRlbnRpZmllciBUaGUgaWRlbnRpZmllciBub2RlIHRoYXQgcmVwcmVzZW50cyB0aGUgbmFtZSBvZiB0aGUgY2xhc3MuXG4gKiBAcGFyYW0gYWxsb3dXcmFwcGluZ0RlY29yYXRvcnMgV2hldGhlciB0byBhbGxvdyBkZWNvcmF0b3JzIHRvIGJlIHdyYXBwZWQuXG4gKiBAcmV0dXJucyBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgcmVzdWx0cyBvZiB0aGUgYW5hbHlzaXMuXG4gKi9cbmZ1bmN0aW9uIGFuYWx5emVDbGFzc1NpYmxpbmdzKFxuICBvcmlnaW46IE5vZGVQYXRoLFxuICBjbGFzc0lkZW50aWZpZXI6IHR5cGVzLklkZW50aWZpZXIsXG4gIGFsbG93V3JhcHBpbmdEZWNvcmF0b3JzOiBib29sZWFuLFxuKTogeyBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0czogYm9vbGVhbjsgd3JhcFN0YXRlbWVudFBhdGhzOiBOb2RlUGF0aDx0eXBlcy5TdGF0ZW1lbnQ+W10gfSB7XG4gIGNvbnN0IHdyYXBTdGF0ZW1lbnRQYXRoczogTm9kZVBhdGg8dHlwZXMuU3RhdGVtZW50PltdID0gW107XG4gIGxldCBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyA9IGZhbHNlO1xuICBmb3IgKGxldCBpID0gMTsgOyArK2kpIHtcbiAgICBjb25zdCBuZXh0U3RhdGVtZW50ID0gb3JpZ2luLmdldFNpYmxpbmcoK29yaWdpbi5rZXkgKyBpKTtcbiAgICBpZiAoIW5leHRTdGF0ZW1lbnQuaXNFeHByZXNzaW9uU3RhdGVtZW50KCkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIFZhbGlkIHNpYmxpbmcgc3RhdGVtZW50cyBmb3IgY2xhc3MgZGVjbGFyYXRpb25zIGFyZSBvbmx5IGFzc2lnbm1lbnQgZXhwcmVzc2lvbnNcbiAgICAvLyBhbmQgVHlwZVNjcmlwdCBkZWNvcmF0b3IgaGVscGVyIGNhbGwgZXhwcmVzc2lvbnNcbiAgICBjb25zdCBuZXh0RXhwcmVzc2lvbiA9IG5leHRTdGF0ZW1lbnQuZ2V0KCdleHByZXNzaW9uJyk7XG4gICAgaWYgKG5leHRFeHByZXNzaW9uLmlzQ2FsbEV4cHJlc3Npb24oKSkge1xuICAgICAgaWYgKFxuICAgICAgICAhdHlwZXMuaXNJZGVudGlmaWVyKG5leHRFeHByZXNzaW9uLm5vZGUuY2FsbGVlKSB8fFxuICAgICAgICBuZXh0RXhwcmVzc2lvbi5ub2RlLmNhbGxlZS5uYW1lICE9PSBUU0xJQl9ERUNPUkFURV9IRUxQRVJfTkFNRVxuICAgICAgKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBpZiAoYWxsb3dXcmFwcGluZ0RlY29yYXRvcnMpIHtcbiAgICAgICAgd3JhcFN0YXRlbWVudFBhdGhzLnB1c2gobmV4dFN0YXRlbWVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTdGF0ZW1lbnQgY2Fubm90IGJlIHNhZmVseSB3cmFwcGVkIHdoaWNoIG1ha2VzIHdyYXBwaW5nIHRoZSBjbGFzcyB1bm5lZWRlZC5cbiAgICAgICAgLy8gVGhlIHN0YXRlbWVudCB3aWxsIHByZXZlbnQgZXZlbiBhIHdyYXBwZWQgY2xhc3MgZnJvbSBiZWluZyBvcHRpbWl6ZWQgYXdheS5cbiAgICAgICAgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBjb250aW51ZTtcbiAgICB9IGVsc2UgaWYgKCFuZXh0RXhwcmVzc2lvbi5pc0Fzc2lnbm1lbnRFeHByZXNzaW9uKCkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIFZhbGlkIGFzc2lnbm1lbnQgZXhwcmVzc2lvbnMgc2hvdWxkIGJlIG1lbWJlciBhY2Nlc3MgZXhwcmVzc2lvbnMgdXNpbmcgdGhlIGNsYXNzXG4gICAgLy8gbmFtZSBhcyB0aGUgb2JqZWN0IGFuZCBhbiBpZGVudGlmaWVyIGFzIHRoZSBwcm9wZXJ0eSBmb3Igc3RhdGljIGZpZWxkcyBvciBvbmx5XG4gICAgLy8gdGhlIGNsYXNzIG5hbWUgZm9yIGRlY29yYXRvcnMuXG4gICAgY29uc3QgbGVmdCA9IG5leHRFeHByZXNzaW9uLmdldCgnbGVmdCcpO1xuICAgIGlmIChsZWZ0LmlzSWRlbnRpZmllcigpKSB7XG4gICAgICBpZiAoXG4gICAgICAgICFsZWZ0LnNjb3BlLmJpbmRpbmdJZGVudGlmaWVyRXF1YWxzKGxlZnQubm9kZS5uYW1lLCBjbGFzc0lkZW50aWZpZXIpIHx8XG4gICAgICAgICF0eXBlcy5pc0NhbGxFeHByZXNzaW9uKG5leHRFeHByZXNzaW9uLm5vZGUucmlnaHQpIHx8XG4gICAgICAgICF0eXBlcy5pc0lkZW50aWZpZXIobmV4dEV4cHJlc3Npb24ubm9kZS5yaWdodC5jYWxsZWUpIHx8XG4gICAgICAgIG5leHRFeHByZXNzaW9uLm5vZGUucmlnaHQuY2FsbGVlLm5hbWUgIT09IFRTTElCX0RFQ09SQVRFX0hFTFBFUl9OQU1FXG4gICAgICApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGlmIChhbGxvd1dyYXBwaW5nRGVjb3JhdG9ycykge1xuICAgICAgICB3cmFwU3RhdGVtZW50UGF0aHMucHVzaChuZXh0U3RhdGVtZW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFN0YXRlbWVudCBjYW5ub3QgYmUgc2FmZWx5IHdyYXBwZWQgd2hpY2ggbWFrZXMgd3JhcHBpbmcgdGhlIGNsYXNzIHVubmVlZGVkLlxuICAgICAgICAvLyBUaGUgc3RhdGVtZW50IHdpbGwgcHJldmVudCBldmVuIGEgd3JhcHBlZCBjbGFzcyBmcm9tIGJlaW5nIG9wdGltaXplZCBhd2F5LlxuICAgICAgICBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnRpbnVlO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAhbGVmdC5pc01lbWJlckV4cHJlc3Npb24oKSB8fFxuICAgICAgIXR5cGVzLmlzSWRlbnRpZmllcihsZWZ0Lm5vZGUub2JqZWN0KSB8fFxuICAgICAgIWxlZnQuc2NvcGUuYmluZGluZ0lkZW50aWZpZXJFcXVhbHMobGVmdC5ub2RlLm9iamVjdC5uYW1lLCBjbGFzc0lkZW50aWZpZXIpIHx8XG4gICAgICAhdHlwZXMuaXNJZGVudGlmaWVyKGxlZnQubm9kZS5wcm9wZXJ0eSlcbiAgICApIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGNvbnN0IHByb3BlcnR5TmFtZSA9IGxlZnQubm9kZS5wcm9wZXJ0eS5uYW1lO1xuICAgIGNvbnN0IGFzc2lnbm1lbnRWYWx1ZSA9IG5leHRFeHByZXNzaW9uLmdldCgncmlnaHQnKTtcbiAgICBpZiAoYW5ndWxhclN0YXRpY3NUb0VsaWRlW3Byb3BlcnR5TmFtZV0/Lihhc3NpZ25tZW50VmFsdWUpKSB7XG4gICAgICBuZXh0U3RhdGVtZW50LnJlbW92ZSgpO1xuICAgICAgLS1pO1xuICAgIH0gZWxzZSBpZiAoY2FuV3JhcFByb3BlcnR5KHByb3BlcnR5TmFtZSwgYXNzaWdubWVudFZhbHVlKSkge1xuICAgICAgd3JhcFN0YXRlbWVudFBhdGhzLnB1c2gobmV4dFN0YXRlbWVudCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFN0YXRlbWVudCBjYW5ub3QgYmUgc2FmZWx5IHdyYXBwZWQgd2hpY2ggbWFrZXMgd3JhcHBpbmcgdGhlIGNsYXNzIHVubmVlZGVkLlxuICAgICAgLy8gVGhlIHN0YXRlbWVudCB3aWxsIHByZXZlbnQgZXZlbiBhIHdyYXBwZWQgY2xhc3MgZnJvbSBiZWluZyBvcHRpbWl6ZWQgYXdheS5cbiAgICAgIGhhc1BvdGVudGlhbFNpZGVFZmZlY3RzID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cywgd3JhcFN0YXRlbWVudFBhdGhzIH07XG59XG5cbi8qKlxuICogVGhlIHNldCBvZiBjbGFzc2VzIGFscmVhZHkgdmlzaXRlZCBhbmQgYW5hbHl6ZWQgZHVyaW5nIHRoZSBwbHVnaW4ncyBleGVjdXRpb24uXG4gKiBUaGlzIGlzIHVzZWQgdG8gcHJldmVudCBhZGp1c3RlZCBjbGFzc2VzIGZyb20gYmVpbmcgcmVwZWF0ZWRseSBhbmFseXplZCB3aGljaCBjYW4gbGVhZFxuICogdG8gYW4gaW5maW5pdGUgbG9vcC5cbiAqL1xuY29uc3QgdmlzaXRlZENsYXNzZXMgPSBuZXcgV2Vha1NldDx0eXBlcy5DbGFzcz4oKTtcblxuLyoqXG4gKiBBIG1hcCBvZiBjbGFzc2VzIHRoYXQgaGF2ZSBhbHJlYWR5IGJlZW4gYW5hbHl6ZWQgZHVyaW5nIHRoZSBkZWZhdWx0IGV4cG9ydCBzcGxpdHRpbmcgc3RlcC5cbiAqIFRoaXMgaXMgdXNlZCB0byBhdm9pZCBhbmFseXppbmcgYSBjbGFzcyBkZWNsYXJhdGlvbiB0d2ljZSBpZiBpdCBpcyBhIGRpcmVjdCBkZWZhdWx0IGV4cG9ydC5cbiAqL1xuY29uc3QgZXhwb3J0RGVmYXVsdEFuYWx5c2lzID0gbmV3IFdlYWtNYXA8dHlwZXMuQ2xhc3MsIFJldHVyblR5cGU8dHlwZW9mIGFuYWx5emVDbGFzc1NpYmxpbmdzPj4oKTtcblxuLyoqXG4gKiBBIGJhYmVsIHBsdWdpbiBmYWN0b3J5IGZ1bmN0aW9uIGZvciBhZGp1c3RpbmcgY2xhc3NlczsgcHJpbWFyaWx5IHdpdGggQW5ndWxhciBtZXRhZGF0YS5cbiAqIFRoZSBhZGp1c3RtZW50cyBpbmNsdWRlIHdyYXBwaW5nIGNsYXNzZXMgd2l0aCBrbm93biBzYWZlIG9yIG5vIHNpZGUgZWZmZWN0cyB3aXRoIHB1cmVcbiAqIGFubm90YXRpb25zIHRvIHN1cHBvcnQgZGVhZCBjb2RlIHJlbW92YWwgb2YgdW51c2VkIGNsYXNzZXMuIEFuZ3VsYXIgY29tcGlsZXIgZ2VuZXJhdGVkXG4gKiBtZXRhZGF0YSBzdGF0aWMgZmllbGRzIG5vdCByZXF1aXJlZCBpbiBBT1QgbW9kZSBhcmUgYWxzbyBlbGlkZWQgdG8gYmV0dGVyIHN1cHBvcnQgYnVuZGxlci1cbiAqIGxldmVsIHRyZWVzaGFraW5nLlxuICpcbiAqIEByZXR1cm5zIEEgYmFiZWwgcGx1Z2luIG9iamVjdCBpbnN0YW5jZS5cbiAqL1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICgpOiBQbHVnaW5PYmoge1xuICByZXR1cm4ge1xuICAgIHZpc2l0b3I6IHtcbiAgICAgIC8vIFdoZW4gYSBjbGFzcyBpcyBjb252ZXJ0ZWQgdG8gYSB2YXJpYWJsZSBkZWNsYXJhdGlvbiwgdGhlIGRlZmF1bHQgZXhwb3J0IG11c3QgYmUgbW92ZWRcbiAgICAgIC8vIHRvIGEgc3Vic2VxdWVudCBzdGF0ZW1lbnQgdG8gcHJldmVudCBhIEphdmFTY3JpcHQgc3ludGF4IGVycm9yLlxuICAgICAgRXhwb3J0RGVmYXVsdERlY2xhcmF0aW9uKHBhdGg6IE5vZGVQYXRoPHR5cGVzLkV4cG9ydERlZmF1bHREZWNsYXJhdGlvbj4sIHN0YXRlOiBQbHVnaW5QYXNzKSB7XG4gICAgICAgIGNvbnN0IGRlY2xhcmF0aW9uID0gcGF0aC5nZXQoJ2RlY2xhcmF0aW9uJyk7XG4gICAgICAgIGlmICghZGVjbGFyYXRpb24uaXNDbGFzc0RlY2xhcmF0aW9uKCkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IHdyYXBEZWNvcmF0b3JzIH0gPSBzdGF0ZS5vcHRzIGFzIHsgd3JhcERlY29yYXRvcnM6IGJvb2xlYW4gfTtcbiAgICAgICAgY29uc3QgYW5hbHlzaXMgPSBhbmFseXplQ2xhc3NTaWJsaW5ncyhwYXRoLCBkZWNsYXJhdGlvbi5ub2RlLmlkLCB3cmFwRGVjb3JhdG9ycyk7XG4gICAgICAgIGV4cG9ydERlZmF1bHRBbmFseXNpcy5zZXQoZGVjbGFyYXRpb24ubm9kZSwgYW5hbHlzaXMpO1xuXG4gICAgICAgIC8vIFNwbGl0dGluZyB0aGUgZXhwb3J0IGRlY2xhcmF0aW9uIGlzIG5vdCBuZWVkZWQgaWYgdGhlIGNsYXNzIHdpbGwgbm90IGJlIHdyYXBwZWRcbiAgICAgICAgaWYgKGFuYWx5c2lzLmhhc1BvdGVudGlhbFNpZGVFZmZlY3RzKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc3BsaXRFeHBvcnREZWNsYXJhdGlvbihwYXRoKTtcbiAgICAgIH0sXG4gICAgICBDbGFzc0RlY2xhcmF0aW9uKHBhdGg6IE5vZGVQYXRoPHR5cGVzLkNsYXNzRGVjbGFyYXRpb24+LCBzdGF0ZTogUGx1Z2luUGFzcykge1xuICAgICAgICBjb25zdCB7IG5vZGU6IGNsYXNzTm9kZSwgcGFyZW50UGF0aCB9ID0gcGF0aDtcbiAgICAgICAgY29uc3QgeyB3cmFwRGVjb3JhdG9ycyB9ID0gc3RhdGUub3B0cyBhcyB7IHdyYXBEZWNvcmF0b3JzOiBib29sZWFuIH07XG5cbiAgICAgICAgaWYgKHZpc2l0ZWRDbGFzc2VzLmhhcyhjbGFzc05vZGUpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQW5hbHl6ZSBzaWJsaW5nIHN0YXRlbWVudHMgZm9yIGVsZW1lbnRzIG9mIHRoZSBjbGFzcyB0aGF0IHdlcmUgZG93bmxldmVsZWRcbiAgICAgICAgY29uc3Qgb3JpZ2luID0gcGFyZW50UGF0aC5pc0V4cG9ydE5hbWVkRGVjbGFyYXRpb24oKSA/IHBhcmVudFBhdGggOiBwYXRoO1xuICAgICAgICBjb25zdCB7IHdyYXBTdGF0ZW1lbnRQYXRocywgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMgfSA9XG4gICAgICAgICAgZXhwb3J0RGVmYXVsdEFuYWx5c2lzLmdldChjbGFzc05vZGUpID8/XG4gICAgICAgICAgYW5hbHl6ZUNsYXNzU2libGluZ3Mob3JpZ2luLCBjbGFzc05vZGUuaWQsIHdyYXBEZWNvcmF0b3JzKTtcblxuICAgICAgICB2aXNpdGVkQ2xhc3Nlcy5hZGQoY2xhc3NOb2RlKTtcblxuICAgICAgICBpZiAoaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiBubyBzdGF0ZW1lbnRzIHRvIHdyYXAsIGNoZWNrIGZvciBzdGF0aWMgY2xhc3MgcHJvcGVydGllcy5cbiAgICAgICAgLy8gU3RhdGljIGNsYXNzIHByb3BlcnRpZXMgbWF5IGJlIGRvd25sZXZlbGVkIGF0IGxhdGVyIHN0YWdlcyBpbiB0aGUgYnVpbGQgcGlwZWxpbmVcbiAgICAgICAgLy8gd2hpY2ggcmVzdWx0cyBpbiBhZGRpdGlvbmFsIGZ1bmN0aW9uIGNhbGxzIG91dHNpZGUgdGhlIGNsYXNzIGJvZHkuIFRoZXNlIGNhbGxzXG4gICAgICAgIC8vIHRoZW4gY2F1c2UgdGhlIGNsYXNzIHRvIGJlIHJlZmVyZW5jZWQgYW5kIG5vdCBlbGlnaWJsZSBmb3IgcmVtb3ZhbC4gU2luY2UgaXQgaXNcbiAgICAgICAgLy8gbm90IGtub3duIGF0IHRoaXMgc3RhZ2Ugd2hldGhlciB0aGUgY2xhc3MgbmVlZHMgdG8gYmUgZG93bmxldmVsZWQsIHRoZSB0cmFuc2Zvcm1cbiAgICAgICAgLy8gd3JhcHMgY2xhc3NlcyBwcmVlbXB0aXZlbHkgdG8gYWxsb3cgZm9yIHBvdGVudGlhbCByZW1vdmFsIHdpdGhpbiB0aGUgb3B0aW1pemF0aW9uXG4gICAgICAgIC8vIHN0YWdlcy5cbiAgICAgICAgaWYgKHdyYXBTdGF0ZW1lbnRQYXRocy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBsZXQgc2hvdWxkV3JhcCA9IGZhbHNlO1xuICAgICAgICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBwYXRoLmdldCgnYm9keScpLmdldCgnYm9keScpKSB7XG4gICAgICAgICAgICBpZiAoZWxlbWVudC5pc0NsYXNzUHJvcGVydHkoKSkge1xuICAgICAgICAgICAgICAvLyBPbmx5IG5lZWQgdG8gYW5hbHl6ZSBzdGF0aWMgcHJvcGVydGllc1xuICAgICAgICAgICAgICBpZiAoIWVsZW1lbnQubm9kZS5zdGF0aWMpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIENoZWNrIGZvciBwb3RlbnRpYWwgc2lkZSBlZmZlY3RzLlxuICAgICAgICAgICAgICAvLyBUaGVzZSBjaGVja3MgYXJlIGNvbnNlcnZhdGl2ZSBhbmQgY291bGQgcG90ZW50aWFsbHkgYmUgZXhwYW5kZWQgaW4gdGhlIGZ1dHVyZS5cbiAgICAgICAgICAgICAgY29uc3QgZWxlbWVudEtleSA9IGVsZW1lbnQuZ2V0KCdrZXknKTtcbiAgICAgICAgICAgICAgY29uc3QgZWxlbWVudFZhbHVlID0gZWxlbWVudC5nZXQoJ3ZhbHVlJyk7XG4gICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBlbGVtZW50S2V5LmlzSWRlbnRpZmllcigpICYmXG4gICAgICAgICAgICAgICAgKCFlbGVtZW50VmFsdWUuaXNFeHByZXNzaW9uKCkgfHxcbiAgICAgICAgICAgICAgICAgIGNhbldyYXBQcm9wZXJ0eShlbGVtZW50S2V5LmdldCgnbmFtZScpLCBlbGVtZW50VmFsdWUpKVxuICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBzaG91bGRXcmFwID0gdHJ1ZTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBOb3Qgc2FmZSB0byB3cmFwXG4gICAgICAgICAgICAgICAgc2hvdWxkV3JhcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgICAgICAgICB9IGVsc2UgaWYgKChlbGVtZW50IGFzIGFueSkuaXNTdGF0aWNCbG9jaygpKSB7XG4gICAgICAgICAgICAgIC8vIE9ubHkgbmVlZCB0byBhbmFseXplIHN0YXRpYyBibG9ja3NcbiAgICAgICAgICAgICAgY29uc3QgYm9keSA9IGVsZW1lbnQuZ2V0KCdib2R5Jyk7XG5cbiAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYm9keSkgJiYgYm9keS5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgLy8gTm90IHNhZmUgdG8gd3JhcFxuICAgICAgICAgICAgICAgIHNob3VsZFdyYXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSBib2R5LmZpbmQoKG46IE5vZGVQYXRoPHR5cGVzLk5vZGU+KSA9PlxuICAgICAgICAgICAgICAgIG4uaXNFeHByZXNzaW9uU3RhdGVtZW50KCksXG4gICAgICAgICAgICAgICkgYXMgTm9kZVBhdGg8dHlwZXMuRXhwcmVzc2lvblN0YXRlbWVudD4gfCB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAgICAgY29uc3QgYXNzaWdubWVudEV4cHJlc3Npb24gPSBleHByZXNzaW9uPy5nZXQoJ2V4cHJlc3Npb24nKTtcbiAgICAgICAgICAgICAgaWYgKGFzc2lnbm1lbnRFeHByZXNzaW9uPy5pc0Fzc2lnbm1lbnRFeHByZXNzaW9uKCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsZWZ0ID0gYXNzaWdubWVudEV4cHJlc3Npb24uZ2V0KCdsZWZ0Jyk7XG4gICAgICAgICAgICAgICAgaWYgKCFsZWZ0LmlzTWVtYmVyRXhwcmVzc2lvbigpKSB7XG4gICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIWxlZnQuZ2V0KCdvYmplY3QnKS5pc1RoaXNFeHByZXNzaW9uKCkpIHtcbiAgICAgICAgICAgICAgICAgIC8vIE5vdCBzYWZlIHRvIHdyYXBcbiAgICAgICAgICAgICAgICAgIHNob3VsZFdyYXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnQgPSBsZWZ0LmdldCgncHJvcGVydHknKTtcbiAgICAgICAgICAgICAgICBjb25zdCByaWdodCA9IGFzc2lnbm1lbnRFeHByZXNzaW9uLmdldCgncmlnaHQnKTtcbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICBlbGVtZW50LmlzSWRlbnRpZmllcigpICYmXG4gICAgICAgICAgICAgICAgICAoIXJpZ2h0LmlzRXhwcmVzc2lvbigpIHx8IGNhbldyYXBQcm9wZXJ0eShlbGVtZW50Lm5vZGUubmFtZSwgcmlnaHQpKVxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgc2hvdWxkV3JhcCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8vIE5vdCBzYWZlIHRvIHdyYXBcbiAgICAgICAgICAgICAgICAgIHNob3VsZFdyYXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXNob3VsZFdyYXApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB3cmFwU3RhdGVtZW50Tm9kZXM6IHR5cGVzLlN0YXRlbWVudFtdID0gW107XG4gICAgICAgIGZvciAoY29uc3Qgc3RhdGVtZW50UGF0aCBvZiB3cmFwU3RhdGVtZW50UGF0aHMpIHtcbiAgICAgICAgICB3cmFwU3RhdGVtZW50Tm9kZXMucHVzaChzdGF0ZW1lbnRQYXRoLm5vZGUpO1xuICAgICAgICAgIHN0YXRlbWVudFBhdGgucmVtb3ZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBXcmFwIGNsYXNzIGFuZCBzYWZlIHN0YXRpYyBhc3NpZ25tZW50cyBpbiBhIHB1cmUgYW5ub3RhdGVkIElJRkVcbiAgICAgICAgY29uc3QgY29udGFpbmVyID0gdHlwZXMuYXJyb3dGdW5jdGlvbkV4cHJlc3Npb24oXG4gICAgICAgICAgW10sXG4gICAgICAgICAgdHlwZXMuYmxvY2tTdGF0ZW1lbnQoW1xuICAgICAgICAgICAgY2xhc3NOb2RlLFxuICAgICAgICAgICAgLi4ud3JhcFN0YXRlbWVudE5vZGVzLFxuICAgICAgICAgICAgdHlwZXMucmV0dXJuU3RhdGVtZW50KHR5cGVzLmNsb25lTm9kZShjbGFzc05vZGUuaWQpKSxcbiAgICAgICAgICBdKSxcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgcmVwbGFjZW1lbnRJbml0aWFsaXplciA9IHR5cGVzLmNhbGxFeHByZXNzaW9uKFxuICAgICAgICAgIHR5cGVzLnBhcmVudGhlc2l6ZWRFeHByZXNzaW9uKGNvbnRhaW5lciksXG4gICAgICAgICAgW10sXG4gICAgICAgICk7XG4gICAgICAgIGFubm90YXRlQXNQdXJlKHJlcGxhY2VtZW50SW5pdGlhbGl6ZXIpO1xuXG4gICAgICAgIC8vIFJlcGxhY2UgY2xhc3Mgd2l0aCBJSUZFIHdyYXBwZWQgY2xhc3NcbiAgICAgICAgY29uc3QgZGVjbGFyYXRpb24gPSB0eXBlcy52YXJpYWJsZURlY2xhcmF0aW9uKCdsZXQnLCBbXG4gICAgICAgICAgdHlwZXMudmFyaWFibGVEZWNsYXJhdG9yKHR5cGVzLmNsb25lTm9kZShjbGFzc05vZGUuaWQpLCByZXBsYWNlbWVudEluaXRpYWxpemVyKSxcbiAgICAgICAgXSk7XG4gICAgICAgIHBhdGgucmVwbGFjZVdpdGgoZGVjbGFyYXRpb24pO1xuICAgICAgfSxcbiAgICAgIENsYXNzRXhwcmVzc2lvbihwYXRoOiBOb2RlUGF0aDx0eXBlcy5DbGFzc0V4cHJlc3Npb24+LCBzdGF0ZTogUGx1Z2luUGFzcykge1xuICAgICAgICBjb25zdCB7IG5vZGU6IGNsYXNzTm9kZSwgcGFyZW50UGF0aCB9ID0gcGF0aDtcbiAgICAgICAgY29uc3QgeyB3cmFwRGVjb3JhdG9ycyB9ID0gc3RhdGUub3B0cyBhcyB7IHdyYXBEZWNvcmF0b3JzOiBib29sZWFuIH07XG5cbiAgICAgICAgLy8gQ2xhc3MgZXhwcmVzc2lvbnMgYXJlIHVzZWQgYnkgVHlwZVNjcmlwdCB0byByZXByZXNlbnQgZG93bmxldmVsIGNsYXNzL2NvbnN0cnVjdG9yIGRlY29yYXRvcnMuXG4gICAgICAgIC8vIElmIG5vdCB3cmFwcGluZyBkZWNvcmF0b3JzLCB0aGV5IGRvIG5vdCBuZWVkIHRvIGJlIHByb2Nlc3NlZC5cbiAgICAgICAgaWYgKCF3cmFwRGVjb3JhdG9ycyB8fCB2aXNpdGVkQ2xhc3Nlcy5oYXMoY2xhc3NOb2RlKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAhY2xhc3NOb2RlLmlkIHx8XG4gICAgICAgICAgIXBhcmVudFBhdGguaXNWYXJpYWJsZURlY2xhcmF0b3IoKSB8fFxuICAgICAgICAgICF0eXBlcy5pc0lkZW50aWZpZXIocGFyZW50UGF0aC5ub2RlLmlkKSB8fFxuICAgICAgICAgIHBhcmVudFBhdGgubm9kZS5pZC5uYW1lICE9PSBjbGFzc05vZGUuaWQubmFtZVxuICAgICAgICApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvcmlnaW4gPSBwYXJlbnRQYXRoLnBhcmVudFBhdGg7XG4gICAgICAgIGlmICghb3JpZ2luLmlzVmFyaWFibGVEZWNsYXJhdGlvbigpIHx8IG9yaWdpbi5ub2RlLmRlY2xhcmF0aW9ucy5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IHdyYXBTdGF0ZW1lbnRQYXRocywgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMgfSA9IGFuYWx5emVDbGFzc1NpYmxpbmdzKFxuICAgICAgICAgIG9yaWdpbixcbiAgICAgICAgICBwYXJlbnRQYXRoLm5vZGUuaWQsXG4gICAgICAgICAgd3JhcERlY29yYXRvcnMsXG4gICAgICAgICk7XG5cbiAgICAgICAgdmlzaXRlZENsYXNzZXMuYWRkKGNsYXNzTm9kZSk7XG5cbiAgICAgICAgaWYgKGhhc1BvdGVudGlhbFNpZGVFZmZlY3RzIHx8IHdyYXBTdGF0ZW1lbnRQYXRocy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB3cmFwU3RhdGVtZW50Tm9kZXM6IHR5cGVzLlN0YXRlbWVudFtdID0gW107XG4gICAgICAgIGZvciAoY29uc3Qgc3RhdGVtZW50UGF0aCBvZiB3cmFwU3RhdGVtZW50UGF0aHMpIHtcbiAgICAgICAgICB3cmFwU3RhdGVtZW50Tm9kZXMucHVzaChzdGF0ZW1lbnRQYXRoLm5vZGUpO1xuICAgICAgICAgIHN0YXRlbWVudFBhdGgucmVtb3ZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBXcmFwIGNsYXNzIGFuZCBzYWZlIHN0YXRpYyBhc3NpZ25tZW50cyBpbiBhIHB1cmUgYW5ub3RhdGVkIElJRkVcbiAgICAgICAgY29uc3QgY29udGFpbmVyID0gdHlwZXMuYXJyb3dGdW5jdGlvbkV4cHJlc3Npb24oXG4gICAgICAgICAgW10sXG4gICAgICAgICAgdHlwZXMuYmxvY2tTdGF0ZW1lbnQoW1xuICAgICAgICAgICAgdHlwZXMudmFyaWFibGVEZWNsYXJhdGlvbignbGV0JywgW1xuICAgICAgICAgICAgICB0eXBlcy52YXJpYWJsZURlY2xhcmF0b3IodHlwZXMuY2xvbmVOb2RlKGNsYXNzTm9kZS5pZCksIGNsYXNzTm9kZSksXG4gICAgICAgICAgICBdKSxcbiAgICAgICAgICAgIC4uLndyYXBTdGF0ZW1lbnROb2RlcyxcbiAgICAgICAgICAgIHR5cGVzLnJldHVyblN0YXRlbWVudCh0eXBlcy5jbG9uZU5vZGUoY2xhc3NOb2RlLmlkKSksXG4gICAgICAgICAgXSksXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IHJlcGxhY2VtZW50SW5pdGlhbGl6ZXIgPSB0eXBlcy5jYWxsRXhwcmVzc2lvbihcbiAgICAgICAgICB0eXBlcy5wYXJlbnRoZXNpemVkRXhwcmVzc2lvbihjb250YWluZXIpLFxuICAgICAgICAgIFtdLFxuICAgICAgICApO1xuICAgICAgICBhbm5vdGF0ZUFzUHVyZShyZXBsYWNlbWVudEluaXRpYWxpemVyKTtcblxuICAgICAgICAvLyBBZGQgdGhlIHdyYXBwZWQgY2xhc3MgZGlyZWN0bHkgdG8gdGhlIHZhcmlhYmxlIGRlY2xhcmF0aW9uXG4gICAgICAgIHBhcmVudFBhdGguZ2V0KCdpbml0JykucmVwbGFjZVdpdGgocmVwbGFjZW1lbnRJbml0aWFsaXplcik7XG4gICAgICB9LFxuICAgIH0sXG4gIH07XG59XG4iXX0=