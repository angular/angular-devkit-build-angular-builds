"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addError = exports.addWarning = void 0;
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const webpack = require("webpack");
const WebpackError = require('webpack/lib/WebpackError');
const isWebpackFiveOrHigher = (() => {
    if (typeof webpack.version === 'string') {
        const versionParts = webpack.version.split('.');
        if (versionParts[0] && Number(versionParts[0]) >= 5) {
            return true;
        }
    }
    return false;
})();
function addWarning(compilation, message) {
    if (isWebpackFiveOrHigher) {
        compilation.warnings.push(new WebpackError(message));
    }
    else {
        // Allows building with either Webpack 4 or 5+ types
        // tslint:disable-next-line: no-any
        compilation.warnings.push(message);
    }
}
exports.addWarning = addWarning;
function addError(compilation, message) {
    if (isWebpackFiveOrHigher) {
        compilation.errors.push(new WebpackError(message));
    }
    else {
        // Allows building with either Webpack 4 or 5+ types
        // tslint:disable-next-line: no-any
        compilation.errors.push(new Error(message));
    }
}
exports.addError = addError;
