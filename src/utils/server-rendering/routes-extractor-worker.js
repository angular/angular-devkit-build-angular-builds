"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const node_worker_threads_1 = require("node:worker_threads");
const load_esm_1 = require("../load-esm");
/**
 * This is passed as workerData when setting up the worker via the `piscina` package.
 */
const { document, verbose, url } = node_worker_threads_1.workerData;
async function default_1() {
    const { extractRoutes } = await (0, load_esm_1.loadEsmModule)('./render-utils.server.mjs');
    const { default: bootstrapAppFnOrModule } = await (0, load_esm_1.loadEsmModule)('./main.server.mjs');
    const skippedRedirects = [];
    const skippedOthers = [];
    const routes = [];
    for await (const { route, success, redirect } of extractRoutes(bootstrapAppFnOrModule, document, url)) {
        if (success) {
            routes.push(route);
            continue;
        }
        if (redirect) {
            skippedRedirects.push(route);
        }
        else {
            skippedOthers.push(route);
        }
    }
    if (!verbose) {
        return { routes };
    }
    let warnings;
    if (skippedOthers.length) {
        (warnings ??= []).push('The following routes were skipped from prerendering because they contain routes with dynamic parameters:\n' +
            skippedOthers.join('\n'));
    }
    if (skippedRedirects.length) {
        (warnings ??= []).push('The following routes were skipped from prerendering because they contain redirects:\n', skippedRedirects.join('\n'));
    }
    return { routes, warnings };
}
exports.default = default_1;
