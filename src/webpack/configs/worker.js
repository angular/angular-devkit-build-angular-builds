"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkerConfig = void 0;
const path_1 = require("path");
const typescript_1 = require("./typescript");
function getWorkerConfig(wco) {
    const { webWorkerTsConfig } = wco.buildOptions;
    if (!webWorkerTsConfig) {
        return {};
    }
    return {
        plugins: [(0, typescript_1.getTypescriptWorkerPlugin)(wco, (0, path_1.resolve)(wco.root, webWorkerTsConfig))],
    };
}
exports.getWorkerConfig = getWorkerConfig;
