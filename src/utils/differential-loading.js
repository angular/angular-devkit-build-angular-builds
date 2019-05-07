"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const browserslist = require("browserslist");
const caniuse = require("caniuse-api");
const typescript_1 = require("typescript");
function isDifferentialLoadingNeeded(projectRoot, target = typescript_1.ScriptTarget.ES5) {
    const supportES2015 = target !== typescript_1.ScriptTarget.ES3 && target !== typescript_1.ScriptTarget.ES5;
    return supportES2015 && isEs5SupportNeeded(projectRoot);
}
exports.isDifferentialLoadingNeeded = isDifferentialLoadingNeeded;
function isEs5SupportNeeded(projectRoot) {
    const browsersList = browserslist(undefined, {
        path: projectRoot,
    });
    return !caniuse.isSupported('es6-module', browsersList.join(', '));
}
exports.isEs5SupportNeeded = isEs5SupportNeeded;
