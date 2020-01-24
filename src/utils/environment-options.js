"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const path = require("path");
function isDisabled(variable) {
    return variable === '0' || variable.toLowerCase() === 'false';
}
function isEnabled(variable) {
    return variable === '1' || variable.toLowerCase() === 'true';
}
function isPresent(variable) {
    return typeof variable === 'string' && variable !== '';
}
const mangleVariable = process.env['NG_BUILD_MANGLE'];
exports.manglingDisabled = isPresent(mangleVariable) && isDisabled(mangleVariable);
const beautifyVariable = process.env['NG_BUILD_BEAUTIFY'];
exports.beautifyEnabled = isPresent(beautifyVariable) && !isDisabled(beautifyVariable);
const minifyVariable = process.env['NG_BUILD_MINIFY'];
exports.minifyDisabled = isPresent(minifyVariable) && isDisabled(minifyVariable);
const cacheVariable = process.env['NG_BUILD_CACHE'];
exports.cachingDisabled = isPresent(cacheVariable) && isDisabled(cacheVariable);
exports.cachingBasePath = (() => {
    if (exports.cachingDisabled || !isPresent(cacheVariable) || isEnabled(cacheVariable)) {
        return null;
    }
    if (!path.isAbsolute(cacheVariable)) {
        throw new Error('NG_BUILD_CACHE path value must be absolute.');
    }
    return cacheVariable;
})();
