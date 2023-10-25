"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJavaScriptTransformerPlugin = void 0;
const javascript_transformer_1 = require("./javascript-transformer");
/**
 * Creates a plugin that Transformers JavaScript using Babel.
 *
 * @returns An esbuild plugin.
 */
function createJavaScriptTransformerPlugin(options) {
    return {
        name: 'angular-javascript-transformer',
        setup(build) {
            let javascriptTransformer;
            const { sourcemap, thirdPartySourcemaps, advancedOptimizations, jit, babelFileCache, maxWorkers, } = options;
            build.onLoad({ filter: /\.[cm]?js$/ }, async (args) => {
                // The filename is currently used as a cache key. Since the cache is memory only,
                // the options cannot change and do not need to be represented in the key. If the
                // cache is later stored to disk, then the options that affect transform output
                // would need to be added to the key as well as a check for any change of content.
                let contents = babelFileCache?.get(args.path);
                if (contents === undefined) {
                    // Initialize a worker pool for JavaScript transformations
                    javascriptTransformer ??= new javascript_transformer_1.JavaScriptTransformer({
                        sourcemap,
                        thirdPartySourcemaps,
                        advancedOptimizations,
                        jit,
                    }, maxWorkers);
                    contents = await javascriptTransformer.transformFile(args.path, jit);
                    babelFileCache?.set(args.path, contents);
                }
                return {
                    contents,
                    loader: 'js',
                };
            });
            build.onDispose(() => {
                void javascriptTransformer?.close();
            });
        },
    };
}
exports.createJavaScriptTransformerPlugin = createJavaScriptTransformerPlugin;
