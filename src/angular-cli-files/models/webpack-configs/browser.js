"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const license_webpack_plugin_1 = require("license-webpack-plugin");
const path = require("path");
const index_html_webpack_plugin_1 = require("../../plugins/index-html-webpack-plugin");
const package_chunk_sort_1 = require("../../utilities/package-chunk-sort");
const utils_1 = require("./utils");
const SubresourceIntegrityPlugin = require('webpack-subresource-integrity');
function getBrowserConfig(wco) {
    const { root, buildOptions } = wco;
    const extraPlugins = [];
    let isEval = false;
    // See https://webpack.js.org/configuration/devtool/ for sourcemap types.
    if (buildOptions.sourceMap && buildOptions.evalSourceMap && !buildOptions.optimization) {
        // Produce eval sourcemaps for development with serve, which are faster.
        isEval = true;
    }
    if (buildOptions.index) {
        extraPlugins.push(new index_html_webpack_plugin_1.IndexHtmlWebpackPlugin({
            input: path.resolve(root, buildOptions.index),
            output: path.basename(buildOptions.index),
            baseHref: buildOptions.baseHref,
            entrypoints: package_chunk_sort_1.generateEntryPoints(buildOptions),
            deployUrl: buildOptions.deployUrl,
            sri: buildOptions.subresourceIntegrity,
        }));
    }
    if (buildOptions.subresourceIntegrity) {
        extraPlugins.push(new SubresourceIntegrityPlugin({
            hashFuncNames: ['sha384'],
        }));
    }
    if (buildOptions.extractLicenses) {
        extraPlugins.push(new license_webpack_plugin_1.LicenseWebpackPlugin({
            stats: {
                warnings: false,
                errors: false,
            },
            perChunkOutput: false,
            outputFilename: `3rdpartylicenses.txt`,
        }));
    }
    if (!isEval && buildOptions.sourceMap) {
        const { scriptsSourceMap = false, stylesSourceMap = false, hiddenSourceMap = false, } = buildOptions;
        extraPlugins.push(utils_1.getSourceMapDevTool(scriptsSourceMap, stylesSourceMap, hiddenSourceMap));
    }
    const globalStylesBundleNames = utils_1.normalizeExtraEntryPoints(buildOptions.styles, 'styles')
        .map(style => style.bundleName);
    return {
        devtool: isEval ? 'eval' : false,
        resolve: {
            mainFields: [
                ...(wco.supportES2015 ? ['es2015'] : []),
                'browser', 'module', 'main',
            ],
        },
        output: {
            crossOriginLoading: buildOptions.subresourceIntegrity ? 'anonymous' : false,
        },
        optimization: {
            runtimeChunk: 'single',
            splitChunks: {
                maxAsyncRequests: Infinity,
                cacheGroups: {
                    default: buildOptions.commonChunk && {
                        chunks: 'async',
                        minChunks: 2,
                        priority: 10,
                    },
                    common: buildOptions.commonChunk && {
                        name: 'common',
                        chunks: 'async',
                        minChunks: 2,
                        enforce: true,
                        priority: 5,
                    },
                    vendors: false,
                    vendor: buildOptions.vendorChunk && {
                        name: 'vendor',
                        chunks: 'initial',
                        enforce: true,
                        test: (module, chunks) => {
                            const moduleName = module.nameForCondition ? module.nameForCondition() : '';
                            return /[\\/]node_modules[\\/]/.test(moduleName)
                                && !chunks.some(({ name }) => name === 'polyfills'
                                    || globalStylesBundleNames.includes(name));
                        },
                    },
                },
            },
        },
        plugins: extraPlugins,
        node: false,
    };
}
exports.getBrowserConfig = getBrowserConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncy9icm93c2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsbUVBQThEO0FBQzlELDZCQUE2QjtBQUM3Qix1RkFBaUY7QUFDakYsMkVBQXlFO0FBRXpFLG1DQUF5RTtBQUV6RSxNQUFNLDBCQUEwQixHQUFHLE9BQU8sQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0FBRzVFLFNBQWdCLGdCQUFnQixDQUFDLEdBQXlCO0lBQ3hELE1BQU0sRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ25DLE1BQU0sWUFBWSxHQUFHLEVBQUUsQ0FBQztJQUV4QixJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUM7SUFDbkIseUVBQXlFO0lBQ3pFLElBQUksWUFBWSxDQUFDLFNBQVMsSUFBSSxZQUFZLENBQUMsYUFBYSxJQUFJLENBQUMsWUFBWSxDQUFDLFlBQVksRUFBRTtRQUN0Rix3RUFBd0U7UUFDeEUsTUFBTSxHQUFHLElBQUksQ0FBQztLQUNmO0lBRUQsSUFBSSxZQUFZLENBQUMsS0FBSyxFQUFFO1FBQ3RCLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxrREFBc0IsQ0FBQztZQUMzQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLEtBQUssQ0FBQztZQUM3QyxNQUFNLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDO1lBQ3pDLFFBQVEsRUFBRSxZQUFZLENBQUMsUUFBUTtZQUMvQixXQUFXLEVBQUUsd0NBQW1CLENBQUMsWUFBWSxDQUFDO1lBQzlDLFNBQVMsRUFBRSxZQUFZLENBQUMsU0FBUztZQUNqQyxHQUFHLEVBQUUs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Vzt1Q0FDN0MsdUJBQXVCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7d0JBQ2pELENBQUM7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGO1FBQ0QsT0FBTyxFQUFFLFlBQVk7UUFDckIsSUFBSSxFQUFFLEtBQUs7S0FDWixDQUFDO0FBQ0osQ0FBQztBQXZHRCw0Q0F1R0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgeyBMaWNlbnNlV2VicGFja1BsdWdpbiB9IGZyb20gJ2xpY2Vuc2Utd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEluZGV4SHRtbFdlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL2luZGV4LWh0bWwtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cyB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IGdldFNvdXJjZU1hcERldlRvb2wsIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMgfSBmcm9tICcuL3V0aWxzJztcblxuY29uc3QgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4gPSByZXF1aXJlKCd3ZWJwYWNrLXN1YnJlc291cmNlLWludGVncml0eScpO1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRCcm93c2VyQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpIHtcbiAgY29uc3QgeyByb290LCBidWlsZE9wdGlvbnMgfSA9IHdjbztcbiAgY29uc3QgZXh0cmFQbHVnaW5zID0gW107XG5cbiAgbGV0IGlzRXZhbCA9IGZhbHNlO1xuICAvLyBTZWUgaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9jb25maWd1cmF0aW9uL2RldnRvb2wvIGZvciBzb3VyY2VtYXAgdHlwZXMuXG4gIGlmIChidWlsZE9wdGlvbnMuc291cmNlTWFwICYmIGJ1aWxkT3B0aW9ucy5ldmFsU291cmNlTWFwICYmICFidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uKSB7XG4gICAgLy8gUHJvZHVjZSBldmFsIHNvdXJjZW1hcHMgZm9yIGRldmVsb3BtZW50IHdpdGggc2VydmUsIHdoaWNoIGFyZSBmYXN0ZXIuXG4gICAgaXNFdmFsID0gdHJ1ZTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuaW5kZXgpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgSW5kZXhIdG1sV2VicGFja1BsdWdpbih7XG4gICAgICBpbnB1dDogcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5pbmRleCksXG4gICAgICBvdXRwdXQ6IHBhdGguYmFzZW5hbWUoYnVpbGRPcHRpb25zLmluZGV4KSxcbiAgICAgIGJhc2VIcmVmOiBidWlsZE9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICBlbnRyeXBvaW50czogZ2VuZXJhdGVFbnRyeVBvaW50cyhidWlsZE9wdGlvbnMpLFxuICAgICAgZGVwbG95VXJsOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgc3JpOiBidWlsZE9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgfSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBTdWJyZXNvdXJjZUludGVncml0eVBsdWdpbih7XG4gICAgICBoYXNoRnVuY05hbWVzOiBbJ3NoYTM4NCddLFxuICAgIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IExpY2Vuc2VXZWJwYWNrUGx1Z2luKHtcbiAgICAgIHN0YXRzOiB7XG4gICAgICAgIHdhcm5pbmdzOiBmYWxzZSxcbiAgICAgICAgZXJyb3JzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBwZXJDaHVua091dHB1dDogZmFsc2UsXG4gICAgICBvdXRwdXRGaWxlbmFtZTogYDNyZHBhcnR5bGljZW5zZXMudHh0YCxcbiAgICB9KSk7XG4gIH1cblxuICBpZiAoIWlzRXZhbCAmJiBidWlsZE9wdGlvbnMuc291cmNlTWFwKSB7XG4gICAgY29uc3Qge1xuICAgICAgc2NyaXB0c1NvdXJjZU1hcCA9IGZhbHNlLFxuICAgICAgc3R5bGVzU291cmNlTWFwID0gZmFsc2UsXG4gICAgICBoaWRkZW5Tb3VyY2VNYXAgPSBmYWxzZSxcbiAgICB9ID0gYnVpbGRPcHRpb25zO1xuXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goZ2V0U291cmNlTWFwRGV2VG9vbChcbiAgICAgIHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICBzdHlsZXNTb3VyY2VNYXAsXG4gICAgICBoaWRkZW5Tb3VyY2VNYXAsXG4gICAgKSk7XG4gIH1cblxuICBjb25zdCBnbG9iYWxTdHlsZXNCdW5kbGVOYW1lcyA9IG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoYnVpbGRPcHRpb25zLnN0eWxlcywgJ3N0eWxlcycpXG4gICAgLm1hcChzdHlsZSA9PiBzdHlsZS5idW5kbGVOYW1lKTtcblxuICByZXR1cm4ge1xuICAgIGRldnRvb2w6IGlzRXZhbCA/ICdldmFsJyA6IGZhbHNlLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIG1haW5GaWVsZHM6IFtcbiAgICAgICAgLi4uKHdjby5zdXBwb3J0RVMyMDE1ID8gWydlczIwMTUnXSA6IFtdKSxcbiAgICAgICAgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nLFxuICAgICAgXSxcbiAgICB9LFxuICAgIG91dHB1dDoge1xuICAgICAgY3Jvc3NPcmlnaW5Mb2FkaW5nOiBidWlsZE9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHkgPyAnYW5vbnltb3VzJyA6IGZhbHNlLFxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICBydW50aW1lQ2h1bms6ICdzaW5nbGUnLFxuICAgICAgc3BsaXRDaHVua3M6IHtcbiAgICAgICAgbWF4QXN5bmNSZXF1ZXN0czogSW5maW5pdHksXG4gICAgICAgIGNhY2hlR3JvdXBzOiB7XG4gICAgICAgICAgZGVmYXVsdDogYnVpbGRPcHRpb25zLmNvbW1vbkNodW5rICYmIHtcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIHByaW9yaXR5OiAxMCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbW1vbjogYnVpbGRPcHRpb25zLmNvbW1vbkNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21tb24nLFxuICAgICAgICAgICAgY2h1bmtzOiAnYXN5bmMnLFxuICAgICAgICAgICAgbWluQ2h1bmtzOiAyLFxuICAgICAgICAgICAgZW5mb3JjZTogdHJ1ZSxcbiAgICAgICAgICAgIHByaW9yaXR5OiA1LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdmVuZG9yczogZmFsc2UsXG4gICAgICAgICAgdmVuZG9yOiBidWlsZE9wdGlvbnMudmVuZG9yQ2h1bmsgJiYge1xuICAgICAgICAgICAgbmFtZTogJ3ZlbmRvcicsXG4gICAgICAgICAgICBjaHVua3M6ICdpbml0aWFsJyxcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICB0ZXN0OiAobW9kdWxlOiB7IG5hbWVGb3JDb25kaXRpb24/OiBGdW5jdGlvbiB9LCBjaHVua3M6IEFycmF5PHsgbmFtZTogc3RyaW5nIH0+KSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IG1vZHVsZU5hbWUgPSBtb2R1bGUubmFtZUZvckNvbmRpdGlvbiA/IG1vZHVsZS5uYW1lRm9yQ29uZGl0aW9uKCkgOiAnJztcblxuICAgICAgICAgICAgICByZXR1cm4gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLy50ZXN0KG1vZHVsZU5hbWUpXG4gICAgICAgICAgICAgICAgJiYgIWNodW5rcy5zb21lKCh7IG5hbWUgfSkgPT4gbmFtZSA9PT0gJ3BvbHlmaWxscydcbiAgICAgICAgICAgICAgICAgIHx8IGdsb2JhbFN0eWxlc0J1bmRsZU5hbWVzLmluY2x1ZGVzKG5hbWUpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gICAgbm9kZTogZmFsc2UsXG4gIH07XG59XG4iXX0=