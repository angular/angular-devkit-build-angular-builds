"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getESMLoaderArgs = exports.callInitializeIfNeeded = void 0;
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const node_worker_threads_1 = require("node:worker_threads");
let IS_NODE_18;
function isNode18() {
    return (IS_NODE_18 ??= process.versions.node.startsWith('18.'));
}
/** Call the initialize hook when running on Node.js 18 */
function callInitializeIfNeeded(initialize) {
    if (isNode18()) {
        initialize(node_worker_threads_1.workerData);
    }
}
exports.callInitializeIfNeeded = callInitializeIfNeeded;
function getESMLoaderArgs() {
    if (isNode18()) {
        return [
            '--no-warnings',
            '--loader',
            (0, node_url_1.pathToFileURL)((0, node_path_1.join)(__dirname, 'loader-hooks.js')).href, // Loader cannot be an absolute path on Windows.
        ];
    }
    return [
        '--import',
        (0, node_url_1.pathToFileURL)((0, node_path_1.join)(__dirname, 'register-hooks.js')).href, // Loader cannot be an absolute path on Windows.
    ];
}
exports.getESMLoaderArgs = getESMLoaderArgs;
