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
 * Name of the function that sets debug information on classes.
 */
const SET_CLASS_DEBUG_INFO_NAME = 'ɵsetClassDebugInfo';
/**
 * Provides one or more keywords that if found within the content of a source file indicate
 * that this plugin should be used with a source file.
 *
 * @returns An a string iterable containing one or more keywords.
 */
function getKeywords() {
    return [SET_CLASS_METADATA_NAME, SET_CLASS_METADATA_ASYNC_NAME, SET_CLASS_DEBUG_INFO_NAME];
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
                        isRemoveClassmetadataAsyncCall(calleeName, callArguments) ||
                        isSetClassDebugInfoCall(calleeName, callArguments))) {
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
/** Determines if a function call is a call to `setClassDebugInfo`. */
function isSetClassDebugInfoCall(name, args) {
    return (name === SET_CLASS_DEBUG_INFO_NAME &&
        args.length === 2 &&
        core_1.types.isIdentifier(args[0]) &&
        core_1.types.isObjectExpression(args[1]));
}
/** Determines if a node is an inline function expression. */
function isInlineFunction(node) {
    return core_1.types.isFunctionExpression(node) || core_1.types.isArrowFunctionExpression(node);
}
