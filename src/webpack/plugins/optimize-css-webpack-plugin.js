"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizeCssWebpackPlugin = void 0;
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const cssNano = require("cssnano");
const webpack_sources_1 = require("webpack-sources");
const webpack_diagnostics_1 = require("../../utils/webpack-diagnostics");
function hook(compiler, action) {
    compiler.hooks.compilation.tap('optimize-css-webpack-plugin', (compilation) => {
        compilation.hooks.optimizeChunkAssets.tapPromise('optimize-css-webpack-plugin', (chunks) => action(compilation, chunks));
    });
}
class OptimizeCssWebpackPlugin {
    constructor(options) {
        this._options = {
            sourceMap: false,
            test: file => file.endsWith('.css'),
            ...options,
        };
    }
    apply(compiler) {
        hook(compiler, (compilation, chunks) => {
            const files = [...compilation.additionalChunkAssets];
            for (const chunk of chunks) {
                if (!chunk.files) {
                    continue;
                }
                for (const file of chunk.files) {
                    files.push(file);
                }
            }
            const actions = files
                .filter(file => this._options.test(file))
                .map(async (file) => {
                const asset = compilation.assets[file];
                if (!asset) {
                    return;
                }
                let content;
                // tslint:disable-next-line: no-any
                let map;
                if (this._options.sourceMap && asset.sourceAndMap) {
                    const sourceAndMap = asset.sourceAndMap({});
                    content = sourceAndMap.source;
                    map = sourceAndMap.map;
                }
                else {
                    content = asset.source();
                }
                if (typeof content !== 'string') {
                    content = content.toString();
                }
                if (content.length === 0) {
                    return;
                }
                const cssNanoOptions = {
                    preset: ['default', {
                            // Disable SVG optimizations, as this can cause optimizations which are not compatible in all browsers.
                            svgo: false,
                            // Disable `calc` optimizations, due to several issues. #16910, #16875, #17890
                            calc: false,
                        }],
                };
                const postCssOptions = {
                    from: file,
                    map: map && { annotation: false, prev: map },
                };
                const output = await new Promise((resolve, reject) => {
                    // the last parameter is not in the typings
                    // tslint:disable-next-line: no-any
                    cssNano.process(content, postCssOptions, cssNanoOptions)
                        .then(resolve)
                        .catch(reject);
                });
                for (const { text } of output.warnings()) {
                    webpack_diagnostics_1.addWarning(compilation, text);
                }
                let newSource;
                if (output.map) {
                    newSource = new webpack_sources_1.SourceMapSource(output.css, file, 
                    // tslint:disable-next-line: no-any
                    output.map.toString(), content, map);
                }
                else {
                    newSource = new webpack_sources_1.RawSource(output.css);
                }
                compilation.assets[file] = newSource;
            });
            return Promise.all(actions).then(() => { });
        });
    }
}
exports.OptimizeCssWebpackPlugin = OptimizeCssWebpackPlugin;
