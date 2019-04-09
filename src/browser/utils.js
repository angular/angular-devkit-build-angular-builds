"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular-devkit/core");
const browserslist = require("browserslist");
const caniuse = require("caniuse-api");
const ts = require("typescript");
function isDifferentialLoadingNeeded(projectRoot, target = ts.ScriptTarget.ES5) {
    const supportES2015 = target !== ts.ScriptTarget.ES3 && target !== ts.ScriptTarget.ES5;
    return supportES2015 && isEs5SupportNeeded(projectRoot);
}
exports.isDifferentialLoadingNeeded = isDifferentialLoadingNeeded;
function isEs5SupportNeeded(projectRoot) {
    const browsersList = browserslist(undefined, {
        path: core_1.getSystemPath(projectRoot),
    });
    return !caniuse.isSupported('es6-module', browsersList.join(', '));
}
exports.isEs5SupportNeeded = isEs5SupportNeeded;
