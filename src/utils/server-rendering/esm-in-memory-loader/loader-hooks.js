"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.load = exports.resolve = exports.initialize = void 0;
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const url_1 = require("url");
const javascript_transformer_1 = require("../../../tools/esbuild/javascript-transformer");
const node_18_utils_1 = require("./node-18-utils");
const TRANSFORMED_FILES = {};
const CHUNKS_REGEXP = /file:\/\/\/(main\.server|chunk-\w+)\.mjs/;
let workspaceRootFile;
let outputFiles;
const javascriptTransformer = new javascript_transformer_1.JavaScriptTransformer(
// Always enable JIT linking to support applications built with and without AOT.
// In a development environment the additional scope information does not
// have a negative effect unlike production where final output size is relevant.
{ sourcemap: true, jit: true }, 1);
(0, node_18_utils_1.callInitializeIfNeeded)(initialize);
function initialize(data) {
    workspaceRootFile = (0, node_url_1.pathToFileURL)((0, node_path_1.join)(data.workspaceRoot, 'index.mjs')).href;
    outputFiles = data.outputFiles;
}
exports.initialize = initialize;
function resolve(specifier, context, nextResolve) {
    if (!isFileProtocol(specifier)) {
        const normalizedSpecifier = specifier.replace(/^\.\//, '');
        if (normalizedSpecifier in outputFiles) {
            return {
                format: 'module',
                shortCircuit: true,
                // File URLs need to absolute. In Windows these also need to include the drive.
                // The `/` will be resolved to the drive letter.
                url: (0, node_url_1.pathToFileURL)('/' + normalizedSpecifier).href,
            };
        }
    }
    // Defer to the next hook in the chain, which would be the
    // Node.js default resolve if this is the last user-specified loader.
    return nextResolve(specifier, isBundleEntryPointOrChunk(context) ? { ...context, parentURL: workspaceRootFile } : context);
}
exports.resolve = resolve;
async function load(url, context, nextLoad) {
    if (isFileProtocol(url)) {
        const filePath = (0, url_1.fileURLToPath)(url);
        // Remove '/' or drive letter for Windows that was added in the above 'resolve'.
        let source = outputFiles[(0, node_path_1.relative)('/', filePath)] ?? TRANSFORMED_FILES[filePath];
        if (source === undefined) {
            source = TRANSFORMED_FILES[filePath] = Buffer.from(await javascriptTransformer.transformFile(filePath)).toString('utf-8');
        }
        if (source !== undefined) {
            const { format } = context;
            return {
                format,
                shortCircuit: true,
                source,
            };
        }
    }
    // Let Node.js handle all other URLs.
    return nextLoad(url);
}
exports.load = load;
function isFileProtocol(url) {
    return url.startsWith('file://');
}
function handleProcessExit() {
    void javascriptTransformer.close();
}
function isBundleEntryPointOrChunk(context) {
    return !!context.parentURL && CHUNKS_REGEXP.test(context.parentURL);
}
process.once('exit', handleProcessExit);
process.once('SIGINT', handleProcessExit);
process.once('uncaughtException', handleProcessExit);
