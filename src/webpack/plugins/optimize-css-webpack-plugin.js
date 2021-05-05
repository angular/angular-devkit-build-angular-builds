"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizeCssWebpackPlugin = void 0;
const cssNano = require("cssnano");
const webpack_1 = require("webpack");
const webpack_diagnostics_1 = require("../../utils/webpack-diagnostics");
const PLUGIN_NAME = 'optimize-css-webpack-plugin';
function hook(compiler, action) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
        compilation.hooks.processAssets.tapPromise({
            name: PLUGIN_NAME,
            stage: webpack_1.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE,
        }, (assets) => action(compilation, Object.keys(assets)));
    });
}
class OptimizeCssWebpackPlugin {
    constructor(options) {
        this._options = {
            sourceMap: false,
            test: (file) => file.endsWith('.css'),
            ...options,
        };
    }
    apply(compiler) {
        hook(compiler, (compilation, assetsURI) => {
            const files = [...compilation.additionalChunkAssets, ...assetsURI];
            const actions = files
                .filter((file) => this._options.test(file))
                .map(async (file) => {
                const asset = compilation.assets[file];
                if (!asset) {
                    return;
                }
                let content;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                    preset: [
                        'default',
                        {
                            // Disable SVG optimizations, as this can cause optimizations which are not compatible in all browsers.
                            svgo: false,
                            // Disable `calc` optimizations, due to several issues. #16910, #16875, #17890
                            calc: false,
                            // Disable CSS rules sorted due to several issues #20693, https://github.com/ionic-team/ionic-framework/issues/23266 and https://github.com/cssnano/cssnano/issues/1054
                            cssDeclarationSorter: false,
                        },
                    ],
                };
                const postCssOptions = {
                    from: file,
                    map: map && { annotation: false, prev: map },
                };
                try {
                    const output = await new Promise((resolve, reject) => {
                        // @types/cssnano are not up to date with version 5.
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        cssNano(cssNanoOptions)
                            .process(content, postCssOptions)
                            .then(resolve)
                            .catch((err) => reject(err));
                    });
                    for (const { text } of output.warnings()) {
                        webpack_diagnostics_1.addWarning(compilation, text);
                    }
                    let newSource;
                    if (output.map) {
                        newSource = new webpack_1.sources.SourceMapSource(output.css, file, output.map.toString(), content, map);
                    }
                    else {
                        newSource = new webpack_1.sources.RawSource(output.css);
                    }
                    compilation.assets[file] = newSource;
                }
                catch (error) {
                    webpack_diagnostics_1.addError(compilation, error.message);
                    return;
                }
            });
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            return Promise.all(actions).then(() => { });
        });
    }
}
exports.OptimizeCssWebpackPlugin = OptimizeCssWebpackPlugin;
