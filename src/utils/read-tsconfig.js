"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTsconfig = void 0;
const path = __importStar(require("path"));
/**
 * Reads and parses a given TsConfig file.
 *
 * @param tsconfigPath - An absolute or relative path from 'workspaceRoot' of the tsconfig file.
 * @param workspaceRoot - workspaceRoot root location when provided
 * it will resolve 'tsconfigPath' from this path.
 */
async function readTsconfig(tsconfigPath, workspaceRoot) {
    const tsConfigFullPath = workspaceRoot ? path.resolve(workspaceRoot, tsconfigPath) : tsconfigPath;
    // This uses a dynamic import to load `@angular/compiler-cli` which may be ESM.
    // CommonJS code can load ESM code via a dynamic import. Unfortunately, TypeScript
    // will currently, unconditionally downlevel dynamic import into a require call.
    // require calls cannot load ESM code and will result in a runtime error. To workaround
    // this, a Function constructor is used to prevent TypeScript from changing the dynamic import.
    // Once TypeScript provides support for keeping the dynamic import this workaround can
    // be dropped.
    const compilerCliModule = await new Function(`return import('@angular/compiler-cli');`)();
    // If it is not ESM then the functions needed will be stored in the `default` property.
    const { formatDiagnostics, readConfiguration } = (compilerCliModule.readConfiguration ? compilerCliModule : compilerCliModule.default);
    const configResult = readConfiguration(tsConfigFullPath);
    if (configResult.errors && configResult.errors.length) {
        throw new Error(formatDiagnostics(configResult.errors));
    }
    return configResult;
}
exports.readTsconfig = readTsconfig;
