"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
// TODO: remove the below once @types/node are version 20.x.x
// @ts-expect-error "node:module"' has no exported member 'register'.ts(2305)
const node_module_1 = require("node:module");
const node_url_1 = require("node:url");
const node_worker_threads_1 = require("node:worker_threads");
(0, node_module_1.register)('./loader-hooks.js', (0, node_url_1.pathToFileURL)(__filename), { data: node_worker_threads_1.workerData });
