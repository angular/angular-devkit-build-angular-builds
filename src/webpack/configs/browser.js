"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBrowserConfig = void 0;
const webpack_subresource_integrity_1 = require("webpack-subresource-integrity");
const plugins_1 = require("../plugins");
const helpers_1 = require("../utils/helpers");
function getBrowserConfig(wco) {
    const { buildOptions } = wco;
    const { crossOrigin = 'none', subresourceIntegrity, vendorChunk, commonChunk, allowedCommonJsDependencies, } = buildOptions;
    const extraPlugins = [];
    const { styles: stylesSourceMap, scripts: scriptsSourceMap, hidden: hiddenSourceMap, } = buildOptions.sourceMap;
    if (subresourceIntegrity) {
        extraPlugins.push(new webpack_subresource_integrity_1.SubresourceIntegrityPlugin({
            hashFuncNames: ['sha384'],
        }));
    }
    if (scriptsSourceMap || stylesSourceMap) {
        extraPlugins.push((0, helpers_1.getSourceMapDevTool)(scriptsSourceMap, stylesSourceMap, hiddenSourceMap, false));
    }
    let crossOriginLoading = false;
    if (subresourceIntegrity && crossOrigin === 'none') {
        crossOriginLoading = 'anonymous';
    }
    else if (crossOrigin !== 'none') {
        crossOriginLoading = crossOrigin;
    }
    return {
        devtool: false,
        resolve: {
            mainFields: ['es2020', 'es2015', 'browser', 'module', 'main'],
            conditionNames: ['es2020', 'es2015', '...'],
        },
        output: {
            crossOriginLoading,
            trustedTypes: 'angular#bundler',
            scriptType: 'module',
        },
        optimization: {
            runtimeChunk: 'single',
            splitChunks: {
                maxAsyncRequests: Infinity,
                cacheGroups: {
                    default: !!commonChunk && {
                        chunks: 'async',
                        minChunks: 2,
                        priority: 10,
                    },
                    common: !!commonChunk && {
                        name: 'common',
                        chunks: 'async',
                        minChunks: 2,
                        enforce: true,
                        priority: 5,
                    },
                    vendors: false,
                    defaultVendors: !!vendorChunk && {
                        name: 'vendor',
                        chunks: (chunk) => chunk.name === 'main',
                        enforce: true,
                        test: /[\\/]node_modules[\\/]/,
                    },
                },
            },
        },
        plugins: [
            new plugins_1.CommonJsUsageWarnPlugin({
                allowedDependencies: allowedCommonJsDependencies,
            }),
            ...extraPlugins,
        ],
        node: false,
    };
}
exports.getBrowserConfig = getBrowserConfig;
