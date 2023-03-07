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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRqdXN0LXN0YXRpYy1jbGFzcy1tZW1iZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYmFiZWwvcGx1Z2lucy9hZGp1c3Qtc3RhdGljLWNsYXNzLW1lbWJlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBRUgsc0NBQXFFO0FBQ3JFLDZGQUE0RDtBQUM1RCw2R0FBNEU7QUFFNUU7O0dBRUc7QUFDSCxNQUFNLDBCQUEwQixHQUFHLFlBQVksQ0FBQztBQUVoRDs7OztHQUlHO0FBQ0gsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLEdBQUcsQ0FBQztJQUNuQyxNQUFNO0lBQ04sTUFBTTtJQUNOLE1BQU07SUFDTixNQUFNO0lBQ04sTUFBTTtJQUNOLE9BQU87SUFDUCxPQUFPO0lBQ1AsY0FBYztDQUNmLENBQUMsQ0FBQztBQUVIOzs7R0FHRztBQUNILE1BQU0scUJBQXFCLEdBQWtFO0lBQzNGLGdCQUFnQixDQUFDLElBQUk7UUFDbkIsT0FBTyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztJQUN6RSxDQUFDO0lBQ0QsWUFBWSxDQUFDLElBQUk7UUFDZixPQUFPLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO0lBQ2xDLENBQUM7SUFDRCxnQkFBZ0IsQ0FBQyxJQUFJO1FBQ25CLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7SUFDbkMsQ0FBQztDQUNGLENBQUM7QUFFRjs7Ozs7R0FLRztBQUNILFNBQWdCLFdBQVc7SUFDekIsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ25CLENBQUM7QUFGRCxrQ0FFQztBQUVEOzs7Ozs7OztHQVFHO0FBQ0gsU0FBUyxlQUFlLENBQUMsWUFBb0IsRUFBRSxlQUF5QjtJQUN0RSxJQUFJ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QkFBa0IsR0FBc0IsRUFBRSxDQUFDO2dCQUNqRCxLQUFLLE1BQU0sYUFBYSxJQUFJLGtCQUFrQixFQUFFO29CQUM5QyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUM1QyxhQUFhLENBQUMsTUFBTSxFQUFFLENBQUM7aUJBQ3hCO2dCQUVELGtFQUFrRTtnQkFDbEUsTUFBTSxTQUFTLEdBQUcsWUFBSyxDQUFDLHVCQUF1QixDQUM3QyxFQUFFLEVBQ0YsWUFBSyxDQUFDLGNBQWMsQ0FBQztvQkFDbkIsWUFBSyxDQUFDLG1CQUFtQixDQUFDLEtBQUssRUFBRTt3QkFDL0IsWUFBSyxDQUFDLGtCQUFrQixDQUFDLFlBQUssQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFNBQVMsQ0FBQztxQkFDbkUsQ0FBQztvQkFDRixHQUFHLGtCQUFrQjtvQkFDckIsWUFBSyxDQUFDLGVBQWUsQ0FBQyxZQUFLLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQztpQkFDckQsQ0FBQyxDQUNILENBQUM7Z0JBQ0YsTUFBTSxzQkFBc0IsR0FBRyxZQUFLLENBQUMsY0FBYyxDQUNqRCxZQUFLLENBQUMsdUJBQXVCLENBQUMsU0FBUyxDQUFDLEVBQ3hDLEVBQUUsQ0FDSCxDQUFDO2dCQUNGLElBQUEsaUNBQWMsRUFBQyxzQkFBc0IsQ0FBQyxDQUFDO2dCQUV2Qyw2REFBNkQ7Z0JBQzdELFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsV0FBVyxDQUFDLHNCQUFzQixDQUFDLENBQUM7WUFDN0QsQ0FBQztTQUNGO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFwTkQsNEJBb05DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IE5vZGVQYXRoLCBQbHVnaW5PYmosIFBsdWdpblBhc3MsIHR5cGVzIH0gZnJvbSAnQGJhYmVsL2NvcmUnO1xuaW1wb3J0IGFubm90YXRlQXNQdXJlIGZyb20gJ0BiYWJlbC9oZWxwZXItYW5ub3RhdGUtYXMtcHVyZSc7XG5pbXBvcnQgc3BsaXRFeHBvcnREZWNsYXJhdGlvbiBmcm9tICdAYmFiZWwvaGVscGVyLXNwbGl0LWV4cG9ydC1kZWNsYXJhdGlvbic7XG5cbi8qKlxuICogVGhlIG5hbWUgb2YgdGhlIFR5cGVzY3JpcHQgZGVjb3JhdG9yIGhlbHBlciBmdW5jdGlvbiBjcmVhdGVkIGJ5IHRoZSBUeXBlU2NyaXB0IGNvbXBpbGVyLlxuICovXG5jb25zdCBUU0xJQl9ERUNPUkFURV9IRUxQRVJfTkFNRSA9ICdfX2RlY29yYXRlJztcblxuLyoqXG4gKiBUaGUgc2V0IG9mIEFuZ3VsYXIgc3RhdGljIGZpZWxkcyB0aGF0IHNob3VsZCBhbHdheXMgYmUgd3JhcHBlZC5cbiAqIFRoZXNlIGZpZWxkcyBtYXkgYXBwZWFyIHRvIGhhdmUgc2lkZSBlZmZlY3RzIGJ1dCBhcmUgc2FmZSB0byByZW1vdmUgaWYgdGhlIGFzc29jaWF0ZWQgY2xhc3NcbiAqIGlzIG90aGVyd2lzZSB1bnVzZWQgd2l0aGluIHRoZSBvdXRwdXQuXG4gKi9cbmNvbnN0IGFuZ3VsYXJTdGF0aWNzVG9XcmFwID0gbmV3IFNldChbXG4gICfJtWNtcCcsXG4gICfJtWRpcicsXG4gICfJtWZhYycsXG4gICfJtWluaicsXG4gICfJtW1vZCcsXG4gICfJtXBpcGUnLFxuICAnybVwcm92JyxcbiAgJ0lOSkVDVE9SX0tFWScsXG5dKTtcblxuLyoqXG4gKiBBbiBvYmplY3QgbWFwIG9mIHN0YXRpYyBmaWVsZHMgYW5kIHJlbGF0ZWQgdmFsdWUgY2hlY2tzIGZvciBkaXNjb3Zlcnkgb2YgQW5ndWxhciBnZW5lcmF0ZWRcbiAqIEpJVCByZWxhdGVkIHN0YXRpYyBmaWVsZHMuXG4gKi9cbmNvbnN0IGFuZ3VsYXJTdGF0aWNzVG9FbGlkZTogUmVjb3JkPHN0cmluZywgKHBhdGg6IE5vZGVQYXRoPHR5cGVzLkV4cHJlc3Npb24+KSA9PiBib29sZWFuPiA9IHtcbiAgJ2N0b3JQYXJhbWV0ZXJzJyhwYXRoKSB7XG4gICAgcmV0dXJuIHBhdGguaXNGdW5jdGlvbkV4cHJlc3Npb24oKSB8fCBwYXRoLmlzQXJyb3dGdW5jdGlvbkV4cHJlc3Npb24oKTtcbiAgfSxcbiAgJ2RlY29yYXRvcnMnKHBhdGgpIHtcbiAgICByZXR1cm4gcGF0aC5pc0FycmF5RXhwcmVzc2lvbigpO1xuICB9LFxuICAncHJvcERlY29yYXRvcnMnKHBhdGgpIHtcbiAgICByZXR1cm4gcGF0aC5pc09iamVjdEV4cHJlc3Npb24oKTtcbiAgfSxcbn07XG5cbi8qKlxuICogUHJvdmlkZXMgb25lIG9yIG1vcmUga2V5d29yZHMgdGhhdCBpZiBmb3VuZCB3aXRoaW4gdGhlIGNvbnRlbnQgb2YgYSBzb3VyY2UgZmlsZSBpbmRpY2F0ZVxuICogdGhhdCB0aGlzIHBsdWdpbiBzaG91bGQgYmUgdXNlZCB3aXRoIGEgc291cmNlIGZpbGUuXG4gKlxuICogQHJldHVybnMgQW4gYSBzdHJpbmcgaXRlcmFibGUgY29udGFpbmluZyBvbmUgb3IgbW9yZSBrZXl3b3Jkcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEtleXdvcmRzKCk6IEl0ZXJhYmxlPHN0cmluZz4ge1xuICByZXR1cm4gWydjbGFzcyddO1xufVxuXG4vKipcbiAqIERldGVybWluZXMgd2hldGhlciBhIHByb3BlcnR5IGFuZCBpdHMgaW5pdGlhbGl6ZXIgdmFsdWUgY2FuIGJlIHNhZmVseSB3cmFwcGVkIGluIGEgcHVyZVxuICogYW5ub3RhdGVkIElJRkUuIFZhbHVlcyB0aGF0IG1heSBjYXVzZSBzaWRlIGVmZmVjdHMgYXJlIG5vdCBjb25zaWRlcmVkIHNhZmUgdG8gd3JhcC5cbiAqIFdyYXBwaW5nIHN1Y2ggdmFsdWVzIG1heSBjYXVzZSBydW50aW1lIGVycm9ycyBhbmQvb3IgaW5jb3JyZWN0IHJ1bnRpbWUgYmVoYXZpb3IuXG4gKlxuICogQHBhcmFtIHByb3BlcnR5TmFtZSBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgdG8gYW5hbHl6ZS5cbiAqIEBwYXJhbSBhc3NpZ25tZW50VmFsdWUgVGhlIGluaXRpYWxpemVyIHZhbHVlIHRoYXQgd2lsbCBiZSBhc3NpZ25lZCB0byB0aGUgcHJvcGVydHkuXG4gKiBAcmV0dXJucyBJZiB0aGUgcHJvcGVydHkgY2FuIGJlIHNhZmVseSB3cmFwcGVkLCB0aGVuIHRydWU7IG90aGVyd2lzZSwgZmFsc2UuXG4gKi9cbmZ1bmN0aW9uIGNhbldyYXBQcm9wZXJ0eShwcm9wZXJ0eU5hbWU6IHN0cmluZywgYXNzaWdubWVudFZhbHVlOiBOb2RlUGF0aCk6IGJvb2xlYW4ge1xuICBpZiAoYW5ndWxhclN0YXRpY3NUb1dyYXAuaGFzKHByb3BlcnR5TmFtZSkpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGNvbnN0IHsgbGVhZGluZ0NvbW1lbnRzIH0gPSBhc3NpZ25tZW50VmFsdWUubm9kZSBhcyB7IGxlYWRpbmdDb21tZW50cz86IHsgdmFsdWU6IHN0cmluZyB9W10gfTtcbiAgaWYgKFxuICAgIGxlYWRpbmdDb21tZW50cz8uc29tZShcbiAgICAgIC8vIGBAcHVyZU9yQnJlYWtNeUNvZGVgIGlzIHVzZWQgYnkgY2xvc3VyZSBhbmQgaXMgcHJlc2VudCBpbiBBbmd1bGFyIGNvZGVcbiAgICAgICh7IHZhbHVlIH0pID0+XG4gICAgICAgIHZhbHVlLmluY2x1ZGVzKCdAX19QVVJFX18nKSB8fFxuICAgICAgICB2YWx1ZS5pbmNsdWRlcygnI19fUFVSRV9fJykgfHxcbiAgICAgICAgdmFsdWUuaW5jbHVkZXMoJ0BwdXJlT3JCcmVha015Q29kZScpLFxuICAgIClcbiAgKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gYXNzaWdubWVudFZhbHVlLmlzUHVyZSgpO1xufVxuXG4vKipcbiAqIEFuYWx5emUgdGhlIHNpYmxpbmcgbm9kZXMgb2YgYSBjbGFzcyB0byBkZXRlcm1pbmUgaWYgYW55IGRvd25sZXZlbCBlbGVtZW50cyBzaG91bGQgYmVcbiAqIHdyYXBwZWQgaW4gYSBwdXJlIGFubm90YXRlZCBJSUZFLiBBbHNvIGRldGVybWluZXMgaWYgYW55IGVsZW1lbnRzIGhhdmUgcG90ZW50aWFsIHNpZGVcbiAqIGVmZmVjdHMuXG4gKlxuICogQHBhcmFtIG9yaWdpbiBUaGUgc3RhcnRpbmcgTm9kZVBhdGggbG9jYXRpb24gZm9yIGFuYWx5emluZyBzaWJsaW5ncy5cbiAqIEBwYXJhbSBjbGFzc0lkZW50aWZpZXIgVGhlIGlkZW50aWZpZXIgbm9kZSB0aGF0IHJlcHJlc2VudHMgdGhlIG5hbWUgb2YgdGhlIGNsYXNzLlxuICogQHBhcmFtIGFsbG93V3JhcHBpbmdEZWNvcmF0b3JzIFdoZXRoZXIgdG8gYWxsb3cgZGVjb3JhdG9ycyB0byBiZSB3cmFwcGVkLlxuICogQHJldHVybnMgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHJlc3VsdHMgb2YgdGhlIGFuYWx5c2lzLlxuICovXG5mdW5jdGlvbiBhbmFseXplQ2xhc3NTaWJsaW5ncyhcbiAgb3JpZ2luOiBOb2RlUGF0aCxcbiAgY2xhc3NJZGVudGlmaWVyOiB0eXBlcy5JZGVudGlmaWVyLFxuICBhbGxvd1dyYXBwaW5nRGVjb3JhdG9yczogYm9vbGVhbixcbik6IHsgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHM6IGJvb2xlYW47IHdyYXBTdGF0ZW1lbnRQYXRoczogTm9kZVBhdGg8dHlwZXMuU3RhdGVtZW50PltdIH0ge1xuICBjb25zdCB3cmFwU3RhdGVtZW50UGF0aHM6IE5vZGVQYXRoPHR5cGVzLlN0YXRlbWVudD5bXSA9IFtdO1xuICBsZXQgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMgPSBmYWxzZTtcbiAgZm9yIChsZXQgaSA9IDE7IDsgKytpKSB7XG4gICAgY29uc3QgbmV4dFN0YXRlbWVudCA9IG9yaWdpbi5nZXRTaWJsaW5nKCtvcmlnaW4ua2V5ICsgaSk7XG4gICAgaWYgKCFuZXh0U3RhdGVtZW50LmlzRXhwcmVzc2lvblN0YXRlbWVudCgpKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyBWYWxpZCBzaWJsaW5nIHN0YXRlbWVudHMgZm9yIGNsYXNzIGRlY2xhcmF0aW9ucyBhcmUgb25seSBhc3NpZ25tZW50IGV4cHJlc3Npb25zXG4gICAgLy8gYW5kIFR5cGVTY3JpcHQgZGVjb3JhdG9yIGhlbHBlciBjYWxsIGV4cHJlc3Npb25zXG4gICAgY29uc3QgbmV4dEV4cHJlc3Npb24gPSBuZXh0U3RhdGVtZW50LmdldCgnZXhwcmVzc2lvbicpO1xuICAgIGlmIChuZXh0RXhwcmVzc2lvbi5pc0NhbGxFeHByZXNzaW9uKCkpIHtcbiAgICAgIGlmIChcbiAgICAgICAgIXR5cGVzLmlzSWRlbnRpZmllcihuZXh0RXhwcmVzc2lvbi5ub2RlLmNhbGxlZSkgfHxcbiAgICAgICAgbmV4dEV4cHJlc3Npb24ubm9kZS5jYWxsZWUubmFtZSAhPT0gVFNMSUJfREVDT1JBVEVfSEVMUEVSX05BTUVcbiAgICAgICkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgaWYgKGFsbG93V3JhcHBpbmdEZWNvcmF0b3JzKSB7XG4gICAgICAgIHdyYXBTdGF0ZW1lbnRQYXRocy5wdXNoKG5leHRTdGF0ZW1lbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gU3RhdGVtZW50IGNhbm5vdCBiZSBzYWZlbHkgd3JhcHBlZCB3aGljaCBtYWtlcyB3cmFwcGluZyB0aGUgY2xhc3MgdW5uZWVkZWQuXG4gICAgICAgIC8vIFRoZSBzdGF0ZW1lbnQgd2lsbCBwcmV2ZW50IGV2ZW4gYSB3cmFwcGVkIGNsYXNzIGZyb20gYmVpbmcgb3B0aW1pemVkIGF3YXkuXG4gICAgICAgIGhhc1BvdGVudGlhbFNpZGVFZmZlY3RzID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgY29udGludWU7XG4gICAgfSBlbHNlIGlmICghbmV4dEV4cHJlc3Npb24uaXNBc3NpZ25tZW50RXhwcmVzc2lvbigpKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyBWYWxpZCBhc3NpZ25tZW50IGV4cHJlc3Npb25zIHNob3VsZCBiZSBtZW1iZXIgYWNjZXNzIGV4cHJlc3Npb25zIHVzaW5nIHRoZSBjbGFzc1xuICAgIC8vIG5hbWUgYXMgdGhlIG9iamVjdCBhbmQgYW4gaWRlbnRpZmllciBhcyB0aGUgcHJvcGVydHkgZm9yIHN0YXRpYyBmaWVsZHMgb3Igb25seVxuICAgIC8vIHRoZSBjbGFzcyBuYW1lIGZvciBkZWNvcmF0b3JzLlxuICAgIGNvbnN0IGxlZnQgPSBuZXh0RXhwcmVzc2lvbi5nZXQoJ2xlZnQnKTtcbiAgICBpZiAobGVmdC5pc0lkZW50aWZpZXIoKSkge1xuICAgICAgaWYgKFxuICAgICAgICAhbGVmdC5zY29wZS5iaW5kaW5nSWRlbnRpZmllckVxdWFscyhsZWZ0Lm5vZGUubmFtZSwgY2xhc3NJZGVudGlmaWVyKSB8fFxuICAgICAgICAhdHlwZXMuaXNDYWxsRXhwcmVzc2lvbihuZXh0RXhwcmVzc2lvbi5ub2RlLnJpZ2h0KSB8fFxuICAgICAgICAhdHlwZXMuaXNJZGVudGlmaWVyKG5leHRFeHByZXNzaW9uLm5vZGUucmlnaHQuY2FsbGVlKSB8fFxuICAgICAgICBuZXh0RXhwcmVzc2lvbi5ub2RlLnJpZ2h0LmNhbGxlZS5uYW1lICE9PSBUU0xJQl9ERUNPUkFURV9IRUxQRVJfTkFNRVxuICAgICAgKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBpZiAoYWxsb3dXcmFwcGluZ0RlY29yYXRvcnMpIHtcbiAgICAgICAgd3JhcFN0YXRlbWVudFBhdGhzLnB1c2gobmV4dFN0YXRlbWVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTdGF0ZW1lbnQgY2Fubm90IGJlIHNhZmVseSB3cmFwcGVkIHdoaWNoIG1ha2VzIHdyYXBwaW5nIHRoZSBjbGFzcyB1bm5lZWRlZC5cbiAgICAgICAgLy8gVGhlIHN0YXRlbWVudCB3aWxsIHByZXZlbnQgZXZlbiBhIHdyYXBwZWQgY2xhc3MgZnJvbSBiZWluZyBvcHRpbWl6ZWQgYXdheS5cbiAgICAgICAgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBjb250aW51ZTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgIWxlZnQuaXNNZW1iZXJFeHByZXNzaW9uKCkgfHxcbiAgICAgICF0eXBlcy5pc0lkZW50aWZpZXIobGVmdC5ub2RlLm9iamVjdCkgfHxcbiAgICAgICFsZWZ0LnNjb3BlLmJpbmRpbmdJZGVudGlmaWVyRXF1YWxzKGxlZnQubm9kZS5vYmplY3QubmFtZSwgY2xhc3NJZGVudGlmaWVyKSB8fFxuICAgICAgIXR5cGVzLmlzSWRlbnRpZmllcihsZWZ0Lm5vZGUucHJvcGVydHkpXG4gICAgKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjb25zdCBwcm9wZXJ0eU5hbWUgPSBsZWZ0Lm5vZGUucHJvcGVydHkubmFtZTtcbiAgICBjb25zdCBhc3NpZ25tZW50VmFsdWUgPSBuZXh0RXhwcmVzc2lvbi5nZXQoJ3JpZ2h0Jyk7XG4gICAgaWYgKGFuZ3VsYXJTdGF0aWNzVG9FbGlkZVtwcm9wZXJ0eU5hbWVdPy4oYXNzaWdubWVudFZhbHVlKSkge1xuICAgICAgbmV4dFN0YXRlbWVudC5yZW1vdmUoKTtcbiAgICAgIC0taTtcbiAgICB9IGVsc2UgaWYgKGNhbldyYXBQcm9wZXJ0eShwcm9wZXJ0eU5hbWUsIGFzc2lnbm1lbnRWYWx1ZSkpIHtcbiAgICAgIHdyYXBTdGF0ZW1lbnRQYXRocy5wdXNoKG5leHRTdGF0ZW1lbnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTdGF0ZW1lbnQgY2Fubm90IGJlIHNhZmVseSB3cmFwcGVkIHdoaWNoIG1ha2VzIHdyYXBwaW5nIHRoZSBjbGFzcyB1bm5lZWRlZC5cbiAgICAgIC8vIFRoZSBzdGF0ZW1lbnQgd2lsbCBwcmV2ZW50IGV2ZW4gYSB3cmFwcGVkIGNsYXNzIGZyb20gYmVpbmcgb3B0aW1pemVkIGF3YXkuXG4gICAgICBoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHsgaGFzUG90ZW50aWFsU2lkZUVmZmVjdHMsIHdyYXBTdGF0ZW1lbnRQYXRocyB9O1xufVxuXG4vKipcbiAqIFRoZSBzZXQgb2YgY2xhc3NlcyBhbHJlYWR5IHZpc2l0ZWQgYW5kIGFuYWx5emVkIGR1cmluZyB0aGUgcGx1Z2luJ3MgZXhlY3V0aW9uLlxuICogVGhpcyBpcyB1c2VkIHRvIHByZXZlbnQgYWRqdXN0ZWQgY2xhc3NlcyBmcm9tIGJlaW5nIHJlcGVhdGVkbHkgYW5hbHl6ZWQgd2hpY2ggY2FuIGxlYWRcbiAqIHRvIGFuIGluZmluaXRlIGxvb3AuXG4gKi9cbmNvbnN0IHZpc2l0ZWRDbGFzc2VzID0gbmV3IFdlYWtTZXQ8dHlwZXMuQ2xhc3M+KCk7XG5cbi8qKlxuICogQSBtYXAgb2YgY2xhc3NlcyB0aGF0IGhhdmUgYWxyZWFkeSBiZWVuIGFuYWx5emVkIGR1cmluZyB0aGUgZGVmYXVsdCBleHBvcnQgc3BsaXR0aW5nIHN0ZXAuXG4gKiBUaGlzIGlzIHVzZWQgdG8gYXZvaWQgYW5hbHl6aW5nIGEgY2xhc3MgZGVjbGFyYXRpb24gdHdpY2UgaWYgaXQgaXMgYSBkaXJlY3QgZGVmYXVsdCBleHBvcnQuXG4gKi9cbmNvbnN0IGV4cG9ydERlZmF1bHRBbmFseXNpcyA9IG5ldyBXZWFrTWFwPHR5cGVzLkNsYXNzLCBSZXR1cm5UeXBlPHR5cGVvZiBhbmFseXplQ2xhc3NTaWJsaW5ncz4+KCk7XG5cbi8qKlxuICogQSBiYWJlbCBwbHVnaW4gZmFjdG9yeSBmdW5jdGlvbiBmb3IgYWRqdXN0aW5nIGNsYXNzZXM7IHByaW1hcmlseSB3aXRoIEFuZ3VsYXIgbWV0YWRhdGEuXG4gKiBUaGUgYWRqdXN0bWVudHMgaW5jbHVkZSB3cmFwcGluZyBjbGFzc2VzIHdpdGgga25vd24gc2FmZSBvciBubyBzaWRlIGVmZmVjdHMgd2l0aCBwdXJlXG4gKiBhbm5vdGF0aW9ucyB0byBzdXBwb3J0IGRlYWQgY29kZSByZW1vdmFsIG9mIHVudXNlZCBjbGFzc2VzLiBBbmd1bGFyIGNvbXBpbGVyIGdlbmVyYXRlZFxuICogbWV0YWRhdGEgc3RhdGljIGZpZWxkcyBub3QgcmVxdWlyZWQgaW4gQU9UIG1vZGUgYXJlIGFsc28gZWxpZGVkIHRvIGJldHRlciBzdXBwb3J0IGJ1bmRsZXItXG4gKiBsZXZlbCB0cmVlc2hha2luZy5cbiAqXG4gKiBAcmV0dXJucyBBIGJhYmVsIHBsdWdpbiBvYmplY3QgaW5zdGFuY2UuXG4gKi9cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGluZXMtcGVyLWZ1bmN0aW9uXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoKTogUGx1Z2luT2JqIHtcbiAgcmV0dXJuIHtcbiAgICB2aXNpdG9yOiB7XG4gICAgICAvLyBXaGVuIGEgY2xhc3MgaXMgY29udmVydGVkIHRvIGEgdmFyaWFibGUgZGVjbGFyYXRpb24sIHRoZSBkZWZhdWx0IGV4cG9ydCBtdXN0IGJlIG1vdmVkXG4gICAgICAvLyB0byBhIHN1YnNlcXVlbnQgc3RhdGVtZW50IHRvIHByZXZlbnQgYSBKYXZhU2NyaXB0IHN5bnRheCBlcnJvci5cbiAgICAgIEV4cG9ydERlZmF1bHREZWNsYXJhdGlvbihwYXRoOiBOb2RlUGF0aDx0eXBlcy5FeHBvcnREZWZhdWx0RGVjbGFyYXRpb24+LCBzdGF0ZTogUGx1Z2luUGFzcykge1xuICAgICAgICBjb25zdCBkZWNsYXJhdGlvbiA9IHBhdGguZ2V0KCdkZWNsYXJhdGlvbicpO1xuICAgICAgICBpZiAoIWRlY2xhcmF0aW9uLmlzQ2xhc3NEZWNsYXJhdGlvbigpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyB3cmFwRGVjb3JhdG9ycyB9ID0gc3RhdGUub3B0cyBhcyB7IHdyYXBEZWNvcmF0b3JzOiBib29sZWFuIH07XG4gICAgICAgIGNvbnN0IGFuYWx5c2lzID0gYW5hbHl6ZUNsYXNzU2libGluZ3MocGF0aCwgZGVjbGFyYXRpb24ubm9kZS5pZCwgd3JhcERlY29yYXRvcnMpO1xuICAgICAgICBleHBvcnREZWZhdWx0QW5hbHlzaXMuc2V0KGRlY2xhcmF0aW9uLm5vZGUsIGFuYWx5c2lzKTtcblxuICAgICAgICAvLyBTcGxpdHRpbmcgdGhlIGV4cG9ydCBkZWNsYXJhdGlvbiBpcyBub3QgbmVlZGVkIGlmIHRoZSBjbGFzcyB3aWxsIG5vdCBiZSB3cmFwcGVkXG4gICAgICAgIGlmIChhbmFseXNpcy5oYXNQb3RlbnRpYWxTaWRlRWZmZWN0cykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHNwbGl0RXhwb3J0RGVjbGFyYXRpb24ocGF0aCk7XG4gICAgICB9LFxuICAgICAgQ2xhc3NEZWNsYXJhdGlvbihwYXRoOiBOb2RlUGF0aDx0eXBlcy5DbGFzc0RlY2xhcmF0aW9uPiwgc3RhdGU6IFBsdWdpblBhc3MpIHtcbiAgICAgICAgY29uc3QgeyBub2RlOiBjbGFzc05vZGUsIHBhcmVudFBhdGggfSA9IHBhdGg7XG4gICAgICAgIGNvbnN0IHsgd3JhcERlY29yYXRvcnMgfSA9IHN0YXRlLm9wdHMgYXMgeyB3cmFwRGVjb3JhdG9yczogYm9vbGVhbiB9O1xuXG4gICAgICAgIGlmICh2aXNpdGVkQ2xhc3Nlcy5oYXMoY2xhc3NOb2RlKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFuYWx5emUgc2libGluZyBzdGF0ZW1lbnRzIGZvciBlbGVtZW50cyBvZiB0aGUgY2xhc3MgdGhhdCB3ZXJlIGRvd25sZXZlbGVkXG4gICAgICAgIGNvbnN0IG9yaWdpbiA9IHBhcmVudFBhdGguaXNFeHBvcnROYW1lZERlY2xhcmF0aW9uKCkgPyBwYXJlbnRQYXRoIDogcGF0aDtcbiAgICAgICAgY29uc3QgeyB3cmFwU3RhdGVtZW50UGF0aHMsIGhhc1BvdGVudGlhbFNpZGVFZmZlY3RzIH0gPVxuICAgICAgICAgIGV4cG9ydERlZmF1bHRBbmFseXNpcy5nZXQoY2xhc3NOb2RlKSA/P1xuICAgICAgICAgIGFuYWx5emVDbGFzc1NpYmxpbmdzKG9yaWdpbiwgY2xhc3NOb2RlLmlkLCB3cmFwRGVjb3JhdG9ycyk7XG5cbiAgICAgICAgdmlzaXRlZENsYXNzZXMuYWRkKGNsYXNzTm9kZSk7XG5cbiAgICAgICAgaWYgKGhhc1BvdGVudGlhbFNpZGVFZmZlY3RzKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgbm8gc3RhdGVtZW50cyB0byB3cmFwLCBjaGVjayBmb3Igc3RhdGljIGNsYXNzIHByb3BlcnRpZXMuXG4gICAgICAgIC8vIFN0YXRpYyBjbGFzcyBwcm9wZXJ0aWVzIG1heSBiZSBkb3dubGV2ZWxlZCBhdCBsYXRlciBzdGFnZXMgaW4gdGhlIGJ1aWxkIHBpcGVsaW5lXG4gICAgICAgIC8vIHdoaWNoIHJlc3VsdHMgaW4gYWRkaXRpb25hbCBmdW5jdGlvbiBjYWxscyBvdXRzaWRlIHRoZSBjbGFzcyBib2R5LiBUaGVzZSBjYWxsc1xuICAgICAgICAvLyB0aGVuIGNhdXNlIHRoZSBjbGFzcyB0byBiZSByZWZlcmVuY2VkIGFuZCBub3QgZWxpZ2libGUgZm9yIHJlbW92YWwuIFNpbmNlIGl0IGlzXG4gICAgICAgIC8vIG5vdCBrbm93biBhdCB0aGlzIHN0YWdlIHdoZXRoZXIgdGhlIGNsYXNzIG5lZWRzIHRvIGJlIGRvd25sZXZlbGVkLCB0aGUgdHJhbnNmb3JtXG4gICAgICAgIC8vIHdyYXBzIGNsYXNzZXMgcHJlZW1wdGl2ZWx5IHRvIGFsbG93IGZvciBwb3RlbnRpYWwgcmVtb3ZhbCB3aXRoaW4gdGhlIG9wdGltaXphdGlvblxuICAgICAgICAvLyBzdGFnZXMuXG4gICAgICAgIGlmICh3cmFwU3RhdGVtZW50UGF0aHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgbGV0IHNob3VsZFdyYXAgPSBmYWxzZTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgcGF0aC5nZXQoJ2JvZHknKS5nZXQoJ2JvZHknKSkge1xuICAgICAgICAgICAgaWYgKGVsZW1lbnQuaXNDbGFzc1Byb3BlcnR5KCkpIHtcbiAgICAgICAgICAgICAgLy8gT25seSBuZWVkIHRvIGFuYWx5emUgc3RhdGljIHByb3BlcnRpZXNcbiAgICAgICAgICAgICAgaWYgKCFlbGVtZW50Lm5vZGUuc3RhdGljKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBDaGVjayBmb3IgcG90ZW50aWFsIHNpZGUgZWZmZWN0cy5cbiAgICAgICAgICAgICAgLy8gVGhlc2UgY2hlY2tzIGFyZSBjb25zZXJ2YXRpdmUgYW5kIGNvdWxkIHBvdGVudGlhbGx5IGJlIGV4cGFuZGVkIGluIHRoZSBmdXR1cmUuXG4gICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRLZXkgPSBlbGVtZW50LmdldCgna2V5Jyk7XG4gICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRWYWx1ZSA9IGVsZW1lbnQuZ2V0KCd2YWx1ZScpO1xuICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgZWxlbWVudEtleS5pc0lkZW50aWZpZXIoKSAmJlxuICAgICAgICAgICAgICAgICghZWxlbWVudFZhbHVlLmlzRXhwcmVzc2lvbigpIHx8XG4gICAgICAgICAgICAgICAgICBjYW5XcmFwUHJvcGVydHkoZWxlbWVudEtleS5nZXQoJ25hbWUnKSwgZWxlbWVudFZhbHVlKSlcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgc2hvdWxkV3JhcCA9IHRydWU7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gTm90IHNhZmUgdG8gd3JhcFxuICAgICAgICAgICAgICAgIHNob3VsZFdyYXAgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgICAgICAgICAgfSBlbHNlIGlmICgoZWxlbWVudCBhcyBhbnkpLmlzU3RhdGljQmxvY2soKSkge1xuICAgICAgICAgICAgICAvLyBPbmx5IG5lZWQgdG8gYW5hbHl6ZSBzdGF0aWMgYmxvY2tzXG4gICAgICAgICAgICAgIGNvbnN0IGJvZHkgPSBlbGVtZW50LmdldCgnYm9keScpO1xuXG4gICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGJvZHkpICYmIGJvZHkubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIC8vIE5vdCBzYWZlIHRvIHdyYXBcbiAgICAgICAgICAgICAgICBzaG91bGRXcmFwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBleHByZXNzaW9uID0gYm9keS5maW5kKChuOiBOb2RlUGF0aDx0eXBlcy5Ob2RlPikgPT5cbiAgICAgICAgICAgICAgICBuLmlzRXhwcmVzc2lvblN0YXRlbWVudCgpLFxuICAgICAgICAgICAgICApIGFzIE5vZGVQYXRoPHR5cGVzLkV4cHJlc3Npb25TdGF0ZW1lbnQ+IHwgdW5kZWZpbmVkO1xuXG4gICAgICAgICAgICAgIGNvbnN0IGFzc2lnbm1lbnRFeHByZXNzaW9uID0gZXhwcmVzc2lvbj8uZ2V0KCdleHByZXNzaW9uJyk7XG4gICAgICAgICAgICAgIGlmIChhc3NpZ25tZW50RXhwcmVzc2lvbj8uaXNBc3NpZ25tZW50RXhwcmVzc2lvbigpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGVmdCA9IGFzc2lnbm1lbnRFeHByZXNzaW9uLmdldCgnbGVmdCcpO1xuICAgICAgICAgICAgICAgIGlmICghbGVmdC5pc01lbWJlckV4cHJlc3Npb24oKSkge1xuICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFsZWZ0LmdldCgnb2JqZWN0JykuaXNUaGlzRXhwcmVzc2lvbigpKSB7XG4gICAgICAgICAgICAgICAgICAvLyBOb3Qgc2FmZSB0byB3cmFwXG4gICAgICAgICAgICAgICAgICBzaG91bGRXcmFwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBlbGVtZW50ID0gbGVmdC5nZXQoJ3Byb3BlcnR5Jyk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmlnaHQgPSBhc3NpZ25tZW50RXhwcmVzc2lvbi5nZXQoJ3JpZ2h0Jyk7XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgZWxlbWVudC5pc0lkZW50aWZpZXIoKSAmJlxuICAgICAgICAgICAgICAgICAgKCFyaWdodC5pc0V4cHJlc3Npb24oKSB8fCBjYW5XcmFwUHJvcGVydHkoZWxlbWVudC5ub2RlLm5hbWUsIHJpZ2h0KSlcbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgIHNob3VsZFdyYXAgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAvLyBOb3Qgc2FmZSB0byB3cmFwXG4gICAgICAgICAgICAgICAgICBzaG91bGRXcmFwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFzaG91bGRXcmFwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd3JhcFN0YXRlbWVudE5vZGVzOiB0eXBlcy5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IHN0YXRlbWVudFBhdGggb2Ygd3JhcFN0YXRlbWVudFBhdGhzKSB7XG4gICAgICAgICAgd3JhcFN0YXRlbWVudE5vZGVzLnB1c2goc3RhdGVtZW50UGF0aC5ub2RlKTtcbiAgICAgICAgICBzdGF0ZW1lbnRQYXRoLnJlbW92ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gV3JhcCBjbGFzcyBhbmQgc2FmZSBzdGF0aWMgYXNzaWdubWVudHMgaW4gYSBwdXJlIGFubm90YXRlZCBJSUZFXG4gICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IHR5cGVzLmFycm93RnVuY3Rpb25FeHByZXNzaW9uKFxuICAgICAgICAgIFtdLFxuICAgICAgICAgIHR5cGVzLmJsb2NrU3RhdGVtZW50KFtcbiAgICAgICAgICAgIGNsYXNzTm9kZSxcbiAgICAgICAgICAgIC4uLndyYXBTdGF0ZW1lbnROb2RlcyxcbiAgICAgICAgICAgIHR5cGVzLnJldHVyblN0YXRlbWVudCh0eXBlcy5jbG9uZU5vZGUoY2xhc3NOb2RlLmlkKSksXG4gICAgICAgICAgXSksXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IHJlcGxhY2VtZW50SW5pdGlhbGl6ZXIgPSB0eXBlcy5jYWxsRXhwcmVzc2lvbihcbiAgICAgICAgICB0eXBlcy5wYXJlbnRoZXNpemVkRXhwcmVzc2lvbihjb250YWluZXIpLFxuICAgICAgICAgIFtdLFxuICAgICAgICApO1xuICAgICAgICBhbm5vdGF0ZUFzUHVyZShyZXBsYWNlbWVudEluaXRpYWxpemVyKTtcblxuICAgICAgICAvLyBSZXBsYWNlIGNsYXNzIHdpdGggSUlGRSB3cmFwcGVkIGNsYXNzXG4gICAgICAgIGNvbnN0IGRlY2xhcmF0aW9uID0gdHlwZXMudmFyaWFibGVEZWNsYXJhdGlvbignbGV0JywgW1xuICAgICAgICAgIHR5cGVzLnZhcmlhYmxlRGVjbGFyYXRvcih0eXBlcy5jbG9uZU5vZGUoY2xhc3NOb2RlLmlkKSwgcmVwbGFjZW1lbnRJbml0aWFsaXplciksXG4gICAgICAgIF0pO1xuICAgICAgICBwYXRoLnJlcGxhY2VXaXRoKGRlY2xhcmF0aW9uKTtcbiAgICAgIH0sXG4gICAgICBDbGFzc0V4cHJlc3Npb24ocGF0aDogTm9kZVBhdGg8dHlwZXMuQ2xhc3NFeHByZXNzaW9uPiwgc3RhdGU6IFBsdWdpblBhc3MpIHtcbiAgICAgICAgY29uc3QgeyBub2RlOiBjbGFzc05vZGUsIHBhcmVudFBhdGggfSA9IHBhdGg7XG4gICAgICAgIGNvbnN0IHsgd3JhcERlY29yYXRvcnMgfSA9IHN0YXRlLm9wdHMgYXMgeyB3cmFwRGVjb3JhdG9yczogYm9vbGVhbiB9O1xuXG4gICAgICAgIC8vIENsYXNzIGV4cHJlc3Npb25zIGFyZSB1c2VkIGJ5IFR5cGVTY3JpcHQgdG8gcmVwcmVzZW50IGRvd25sZXZlbCBjbGFzcy9jb25zdHJ1Y3RvciBkZWNvcmF0b3JzLlxuICAgICAgICAvLyBJZiBub3Qgd3JhcHBpbmcgZGVjb3JhdG9ycywgdGhleSBkbyBub3QgbmVlZCB0byBiZSBwcm9jZXNzZWQuXG4gICAgICAgIGlmICghd3JhcERlY29yYXRvcnMgfHwgdmlzaXRlZENsYXNzZXMuaGFzKGNsYXNzTm9kZSkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXG4gICAgICAgICAgIWNsYXNzTm9kZS5pZCB8fFxuICAgICAgICAgICFwYXJlbnRQYXRoLmlzVmFyaWFibGVEZWNsYXJhdG9yKCkgfHxcbiAgICAgICAgICAhdHlwZXMuaXNJZGVudGlmaWVyKHBhcmVudFBhdGgubm9kZS5pZCkgfHxcbiAgICAgICAgICBwYXJlbnRQYXRoLm5vZGUuaWQubmFtZSAhPT0gY2xhc3NOb2RlLmlkLm5hbWVcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb3JpZ2luID0gcGFyZW50UGF0aC5wYXJlbnRQYXRoO1xuICAgICAgICBpZiAoIW9yaWdpbi5pc1ZhcmlhYmxlRGVjbGFyYXRpb24oKSB8fCBvcmlnaW4ubm9kZS5kZWNsYXJhdGlvbnMubGVuZ3RoICE9PSAxKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyB3cmFwU3RhdGVtZW50UGF0aHMsIGhhc1BvdGVudGlhbFNpZGVFZmZlY3RzIH0gPSBhbmFseXplQ2xhc3NTaWJsaW5ncyhcbiAgICAgICAgICBvcmlnaW4sXG4gICAgICAgICAgcGFyZW50UGF0aC5ub2RlLmlkLFxuICAgICAgICAgIHdyYXBEZWNvcmF0b3JzLFxuICAgICAgICApO1xuXG4gICAgICAgIHZpc2l0ZWRDbGFzc2VzLmFkZChjbGFzc05vZGUpO1xuXG4gICAgICAgIGlmIChoYXNQb3RlbnRpYWxTaWRlRWZmZWN0cyB8fCB3cmFwU3RhdGVtZW50UGF0aHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd3JhcFN0YXRlbWVudE5vZGVzOiB0eXBlcy5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IHN0YXRlbWVudFBhdGggb2Ygd3JhcFN0YXRlbWVudFBhdGhzKSB7XG4gICAgICAgICAgd3JhcFN0YXRlbWVudE5vZGVzLnB1c2goc3RhdGVtZW50UGF0aC5ub2RlKTtcbiAgICAgICAgICBzdGF0ZW1lbnRQYXRoLnJlbW92ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gV3JhcCBjbGFzcyBhbmQgc2FmZSBzdGF0aWMgYXNzaWdubWVudHMgaW4gYSBwdXJlIGFubm90YXRlZCBJSUZFXG4gICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IHR5cGVzLmFycm93RnVuY3Rpb25FeHByZXNzaW9uKFxuICAgICAgICAgIFtdLFxuICAgICAgICAgIHR5cGVzLmJsb2NrU3RhdGVtZW50KFtcbiAgICAgICAgICAgIHR5cGVzLnZhcmlhYmxlRGVjbGFyYXRpb24oJ2xldCcsIFtcbiAgICAgICAgICAgICAgdHlwZXMudmFyaWFibGVEZWNsYXJhdG9yKHR5cGVzLmNsb25lTm9kZShjbGFzc05vZGUuaWQpLCBjbGFzc05vZGUpLFxuICAgICAgICAgICAgXSksXG4gICAgICAgICAgICAuLi53cmFwU3RhdGVtZW50Tm9kZXMsXG4gICAgICAgICAgICB0eXBlcy5yZXR1cm5TdGF0ZW1lbnQodHlwZXMuY2xvbmVOb2RlKGNsYXNzTm9kZS5pZCkpLFxuICAgICAgICAgIF0pLFxuICAgICAgICApO1xuICAgICAgICBjb25zdCByZXBsYWNlbWVudEluaXRpYWxpemVyID0gdHlwZXMuY2FsbEV4cHJlc3Npb24oXG4gICAgICAgICAgdHlwZXMucGFyZW50aGVzaXplZEV4cHJlc3Npb24oY29udGFpbmVyKSxcbiAgICAgICAgICBbXSxcbiAgICAgICAgKTtcbiAgICAgICAgYW5ub3RhdGVBc1B1cmUocmVwbGFjZW1lbnRJbml0aWFsaXplcik7XG5cbiAgICAgICAgLy8gQWRkIHRoZSB3cmFwcGVkIGNsYXNzIGRpcmVjdGx5IHRvIHRoZSB2YXJpYWJsZSBkZWNsYXJhdGlvblxuICAgICAgICBwYXJlbnRQYXRoLmdldCgnaW5pdCcpLnJlcGxhY2VXaXRoKHJlcGxhY2VtZW50SW5pdGlhbGl6ZXIpO1xuICAgICAgfSxcbiAgICB9LFxuICB9O1xufVxuIl19