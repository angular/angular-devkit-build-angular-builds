"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// TODO: cleanup this file, it's copied as is from Angular CLI.
const path = require("path");
function readTsconfig(tsconfigPath) {
    // build-angular has a peer dependency on typescript
    const projectTs = require('typescript');
    const configResult = projectTs.readConfigFile(tsconfigPath, projectTs.sys.readFile);
    const tsConfig = projectTs.parseJsonConfigFileContent(configResult.config, projectTs.sys, path.dirname(tsconfigPath), undefined, tsconfigPath);
    if (tsConfig.errors.length > 0) {
        throw new Error(`Errors found while reading ${tsconfigPath}:\n  ${tsConfig.errors.map(e => e.messageText).join('\n  ')}`);
    }
    return tsConfig;
}
exports.readTsconfig = readTsconfig;
