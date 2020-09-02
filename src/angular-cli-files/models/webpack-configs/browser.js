"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBrowserConfig = void 0;
const webpack_1 = require("../../plugins/webpack");
const utils_1 = require("./utils");
function getBrowserConfig(wco) {
    const { buildOptions } = wco;
    const { crossOrigin = 'none', subresourceIntegrity, extractLicenses, vendorChunk, commonChunk, allowedCommonJsDependencies, } = buildOptions;
    const extraPlugins = [];
    const { styles: stylesSourceMap, scripts: scriptsSourceMap, hidden: hiddenSourceMap, } = buildOptions.sourceMap;
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
        extraPlugins.push(utils_1.getSourceMapDevTool(scriptsSourceMap, stylesSourceMap, wco.differentialLoadingMode ? true : hiddenSourceMap));
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
            mainFields: ['es2015', 'browser', 'module', 'main'],
        },
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
            new webpack_1.CommonJsUsageWarnPlugin({
                allowedDepedencies: allowedCommonJsDependencies,
            }),
            ...extraPlugins,
        ],
        node: false,
    };
}
exports.getBrowserConfig = getBrowserConfig;
