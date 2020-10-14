"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBrowserConfig = void 0;
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const path_1 = require("path");
const webpack = require("webpack");
const webpack_version_1 = require("../../utils/webpack-version");
const plugins_1 = require("../plugins");
const hmr_loader_1 = require("../plugins/hmr/hmr-loader");
const helpers_1 = require("../utils/helpers");
function getBrowserConfig(wco) {
    const { buildOptions } = wco;
    const { crossOrigin = 'none', subresourceIntegrity, extractLicenses, vendorChunk, commonChunk, allowedCommonJsDependencies, hmr, } = buildOptions;
    const extraPlugins = [];
    const { styles: stylesSourceMap, scripts: scriptsSourceMap, hidden: hiddenSourceMap, vendor: vendorSourceMap, } = buildOptions.sourceMap;
    if (subresourceIntegrity) {
        const SubresourceIntegrityPlugin = require('webpack-subresource-integrity');
        extraPlugins.push(new SubresourceIntegrityPlugin({
            hashFuncNames: ['sha384'],
        }));
    }
    if (extractLicenses) {
        const LicenseWebpackPlugin = require('license-webpack-plugin').LicenseWebpackPlugin;
        extraPlugins.push(new LicenseWebpackPlugin({
            stats: {
                warnings: false,
                errors: false,
            },
            perChunkOutput: false,
            outputFilename: '3rdpartylicenses.txt',
        }));
    }
    if (scriptsSourceMap || stylesSourceMap) {
        extraPlugins.push(helpers_1.getSourceMapDevTool(scriptsSourceMap, stylesSourceMap, buildOptions.differentialLoadingMode ? true : hiddenSourceMap, false, vendorSourceMap));
    }
    let crossOriginLoading = false;
    if (subresourceIntegrity && crossOrigin === 'none') {
        crossOriginLoading = 'anonymous';
    }
    else if (crossOrigin !== 'none') {
        crossOriginLoading = crossOrigin;
    }
    const extraRules = [];
    if (hmr) {
        extraRules.push({
            loader: hmr_loader_1.HmrLoader,
            include: [buildOptions.main].map(p => path_1.resolve(wco.root, p)),
        });
        extraPlugins.push(new webpack.HotModuleReplacementPlugin());
    }
    return {
        devtool: false,
        resolve: {
            mainFields: ['es2015', 'browser', 'module', 'main'],
        },
        module: {
            rules: extraRules,
        },
        ...webpack_version_1.withWebpackFourOrFive({}, { target: ['web', 'es5'] }),
        output: {
            crossOriginLoading,
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
