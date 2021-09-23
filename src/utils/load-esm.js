"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEsmModule = void 0;
/**
 * This uses a dynamic import to load a module which may be ESM.
 * CommonJS code can load ESM code via a dynamic import. Unfortunately, TypeScript
 * will currently, unconditionally downlevel dynamic import into a require call.
 * require calls cannot load ESM code and will result in a runtime error. To workaround
 * this, a Function constructor is used to prevent TypeScript from changing the dynamic import.
 * Once TypeScript provides support for keeping the dynamic import this workaround can
 * be dropped.
 *
 * @param modulePath The path of the module to load.
 * @returns A Promise that resolves to the dynamically imported module.
 */
async function loadEsmModule(modulePath) {
    try {
        return (await new Function('modulePath', `return import(modulePath);`)(modulePath));
    }
    catch (e) {
        // Temporary workaround to handle directory imports for current packages. ESM does not support
        // directory imports.
        // TODO_ESM: Remove once FW packages are fully ESM with defined `exports` package.json fields
        if (e.code !== 'ERR_UNSUPPORTED_DIR_IMPORT') {
            throw e;
        }
        return (await new Function('modulePath', `return import(modulePath);`)(modulePath + '/index.js'));
    }
}
exports.loadEsmModule = loadEsmModule;
