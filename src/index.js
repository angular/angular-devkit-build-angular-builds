"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
// TODO: remove this commented AJV require.
// We don't actually require AJV, but there is a bug with NPM and peer dependencies that is
// whose workaround is to depend on AJV.
// See https://github.com/angular/angular-cli/issues/9691#issuecomment-367322703 for details.
// We need to add a require here to satisfy the dependency checker.
// require('ajv');
__export(require("./app-shell"));
__export(require("./browser"));
var schema_1 = require("./browser/schema");
exports.OutputHashing = schema_1.OutputHashing;
exports.Type = schema_1.Type;
__export(require("./dev-server"));
__export(require("./extract-i18n"));
__export(require("./karma"));
__export(require("./protractor"));
__export(require("./server"));
__export(require("./tslint"));
