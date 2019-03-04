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
    const { styles: stylesOptimization, scripts: scriptsOptimization } = buildOptions.optimization;
    const { styles: stylesSourceMap, scripts: scriptsSourceMap, hidden: hiddenSourceMap, } = buildOptions.sourceMap;
    // See https://webpack.js.org/configuration/devtool/ for sourcemap types.
    if ((stylesSourceMap || scriptsSourceMap) &&
        buildOptions.evalSourceMap &&
        !stylesOptimization &&
        !scriptsOptimization) {
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
            noModuleEntrypoints: ['polyfills.es5'],
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
    if (!isEval && (scriptsSourceMap || stylesSourceMap)) {
        extraPlugins.push(utils_1.getSourceMapDevTool(!!scriptsSourceMap, !!stylesSourceMap, hiddenSourceMap));
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
                                && !chunks.some(({ name }) => name === 'polyfills' || name === 'polyfills.es5'
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncy9icm93c2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsbUVBQThEO0FBQzlELDZCQUE2QjtBQUM3Qix1RkFBaUY7QUFDakYsMkVBQXlFO0FBRXpFLG1DQUF5RTtBQUV6RSxNQUFNLDBCQUEwQixHQUFHLE9BQU8sQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0FBRzVFLFNBQWdCLGdCQUFnQixDQUFDLEdBQXlCO0lBQ3hELE1BQU0sRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ25DLE1BQU0sWUFBWSxHQUFHLEVBQUUsQ0FBQztJQUV4QixJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUM7SUFDbkIsTUFBTSxFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDO0lBQy9GLE1BQU0sRUFDSixNQUFNLEVBQUUsZUFBZSxFQUN2QixPQUFPLEVBQUUsZ0JBQWdCLEVBQ3pCLE1BQU0sRUFBRSxlQUFlLEdBQ3hCLEdBQUcsWUFBWSxDQUFDLFNBQVMsQ0FBQztJQUUzQix5RUFBeUU7SUFDekUsSUFBSSxDQUFDLGVBQWUsSUFBSSxnQkFBZ0IsQ0FBQztRQUN2QyxZQUFZLENBQUMsYUFBYTtRQUMxQixDQUFDLGtCQUFrQjtRQUNuQixDQUFDLG1CQUFtQixFQUFFO1FBQ3RCLHdFQUF3RTtRQUN4RSxNQUFNLEdBQUcsSUFBSSxDQUFDO0tBQ2Y7SUFFRCxJQUFJLFlBQVksQ0FBQyxLQUFLLEVBQUU7UUFDdEIsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLGtEQUFzQixDQUFDO1lBQzNDLEtBQUssRUFBRSxJQUFJLENB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QUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDOzRCQUU1RSxPQUFPLHdCQUF3QixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7bUNBQzNDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUksS0FBSyxXQUFXLElBQUksSUFBSSxLQUFLLGVBQWU7dUNBQ3pFLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO3dCQUNqRCxDQUFDO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRjtRQUNELE9BQU8sRUFBRSxZQUFZO1FBQ3JCLElBQUksRUFBRSxLQUFLO0tBQ1osQ0FBQztBQUNKLENBQUM7QUE1R0QsNENBNEdDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHsgTGljZW5zZVdlYnBhY2tQbHVnaW4gfSBmcm9tICdsaWNlbnNlLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBJbmRleEh0bWxXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9pbmRleC1odG1sLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvcGFja2FnZS1jaHVuay1zb3J0JztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBnZXRTb3VyY2VNYXBEZXZUb29sLCBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzIH0gZnJvbSAnLi91dGlscyc7XG5cbmNvbnN0IFN1YnJlc291cmNlSW50ZWdyaXR5UGx1Z2luID0gcmVxdWlyZSgnd2VicGFjay1zdWJyZXNvdXJjZS1pbnRlZ3JpdHknKTtcblxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QnJvd3NlckNvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKSB7XG4gIGNvbnN0IHsgcm9vdCwgYnVpbGRPcHRpb25zIH0gPSB3Y287XG4gIGNvbnN0IGV4dHJhUGx1Z2lucyA9IFtdO1xuXG4gIGxldCBpc0V2YWwgPSBmYWxzZTtcbiAgY29uc3QgeyBzdHlsZXM6IHN0eWxlc09wdGltaXphdGlvbiwgc2NyaXB0czogc2NyaXB0c09wdGltaXphdGlvbiB9ID0gYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbjtcbiAgY29uc3Qge1xuICAgIHN0eWxlczogc3R5bGVzU291cmNlTWFwLFxuICAgIHNjcmlwdHM6IHNjcmlwdHNTb3VyY2VNYXAsXG4gICAgaGlkZGVuOiBoaWRkZW5Tb3VyY2VNYXAsXG4gIH0gPSBidWlsZE9wdGlvbnMuc291cmNlTWFwO1xuXG4gIC8vIFNlZSBodHRwczovL3dlYnBhY2suanMub3JnL2NvbmZpZ3VyYXRpb24vZGV2dG9vbC8gZm9yIHNvdXJjZW1hcCB0eXBlcy5cbiAgaWYgKChzdHlsZXNTb3VyY2VNYXAgfHwgc2NyaXB0c1NvdXJjZU1hcCkgJiZcbiAgICBidWlsZE9wdGlvbnMuZXZhbFNvdXJjZU1hcCAmJlxuICAgICFzdHlsZXNPcHRpbWl6YXRpb24gJiZcbiAgICAhc2NyaXB0c09wdGltaXphdGlvbikge1xuICAgIC8vIFByb2R1Y2UgZXZhbCBzb3VyY2VtYXBzIGZvciBkZXZlbG9wbWVudCB3aXRoIHNlcnZlLCB3aGljaCBhcmUgZmFzdGVyLlxuICAgIGlzRXZhbCA9IHRydWU7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmluZGV4KSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IEluZGV4SHRtbFdlYnBhY2tQbHVnaW4oe1xuICAgICAgaW5wdXQ6IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMuaW5kZXgpLFxuICAgICAgb3V0cHV0OiBwYXRoLmJhc2VuYW1lKGJ1aWxkT3B0aW9ucy5pbmRleCksXG4gICAgICBiYXNlSHJlZjogYnVpbGRPcHRpb25zLmJhc2VIcmVmLFxuICAgICAgZW50cnlwb2ludHM6IGdlbmVyYXRlRW50cnlQb2ludHMoYnVpbGRPcHRpb25zKSxcbiAgICAgIGRlcGxveVVybDogYnVpbGRPcHRpb25zLmRlcGxveVVybCxcbiAgICAgIHNyaTogYnVpbGRPcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5LFxuICAgICAgbm9Nb2R1bGVFbnRyeXBvaW50czogWydwb2x5ZmlsbHMuZXM1J10sXG4gICAgfSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBTdWJyZXNvdXJjZUludGVncml0eVBsdWdpbih7XG4gICAgICBoYXNoRnVuY05hbWVzOiBbJ3NoYTM4NCddLFxuICAgIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IExpY2Vuc2VXZWJwYWNrUGx1Z2luKHtcbiAgICAgIHN0YXRzOiB7XG4gICAgICAgIHdhcm5pbmdzOiBmYWxzZSxcbiAgICAgICAgZXJyb3JzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBwZXJDaHVua091dHB1dDogZmFsc2UsXG4gICAgICBvdXRwdXRGaWxlbmFtZTogYDNyZHBhcnR5bGljZW5zZXMudHh0YCxcbiAgICB9KSk7XG4gIH1cblxuICBpZiAoIWlzRXZhbCAmJiAoc2NyaXB0c1NvdXJjZU1hcCB8fCBzdHlsZXNTb3VyY2VNYXApKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goZ2V0U291cmNlTWFwRGV2VG9vbChcbiAgICAgICEhc2NyaXB0c1NvdXJjZU1hcCxcbiAgICAgICEhc3R5bGVzU291cmNlTWFwLFxuICAgICAgaGlkZGVuU291cmNlTWFwLFxuICAgICkpO1xuICB9XG5cbiAgY29uc3QgZ2xvYmFsU3R5bGVzQnVuZGxlTmFtZXMgPSBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKGJ1aWxkT3B0aW9ucy5zdHlsZXMsICdzdHlsZXMnKVxuICAgIC5tYXAoc3R5bGUgPT4gc3R5bGUuYnVuZGxlTmFtZSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkZXZ0b29sOiBpc0V2YWwgPyAnZXZhbCcgOiBmYWxzZSxcbiAgICByZXNvbHZlOiB7XG4gICAgICBtYWluRmllbGRzOiBbXG4gICAgICAgIC4uLih3Y28uc3VwcG9ydEVTMjAxNSA/IFsnZXMyMDE1J10gOiBbXSksXG4gICAgICAgICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJyxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBvdXRwdXQ6IHtcbiAgICAgIGNyb3NzT3JpZ2luTG9hZGluZzogYnVpbGRPcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5ID8gJ2Fub255bW91cycgOiBmYWxzZSxcbiAgICB9LFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgcnVudGltZUNodW5rOiAnc2luZ2xlJyxcbiAgICAgIHNwbGl0Q2h1bmtzOiB7XG4gICAgICAgIG1heEFzeW5jUmVxdWVzdHM6IEluZmluaXR5LFxuICAgICAgICBjYWNoZUdyb3Vwczoge1xuICAgICAgICAgIGRlZmF1bHQ6IGJ1aWxkT3B0aW9ucy5jb21tb25DaHVuayAmJiB7XG4gICAgICAgICAgICBjaHVua3M6ICdhc3luYycsXG4gICAgICAgICAgICBtaW5DaHVua3M6IDIsXG4gICAgICAgICAgICBwcmlvcml0eTogMTAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb21tb246IGJ1aWxkT3B0aW9ucy5jb21tb25DaHVuayAmJiB7XG4gICAgICAgICAgICBuYW1lOiAnY29tbW9uJyxcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICBwcmlvcml0eTogNSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZlbmRvcnM6IGZhbHNlLFxuICAgICAgICAgIHZlbmRvcjogYnVpbGRPcHRpb25zLnZlbmRvckNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICd2ZW5kb3InLFxuICAgICAgICAgICAgY2h1bmtzOiAnaW5pdGlhbCcsXG4gICAgICAgICAgICBlbmZvcmNlOiB0cnVlLFxuICAgICAgICAgICAgdGVzdDogKG1vZHVsZTogeyBuYW1lRm9yQ29uZGl0aW9uPzogRnVuY3Rpb24gfSwgY2h1bmtzOiBBcnJheTx7IG5hbWU6IHN0cmluZyB9PikgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBtb2R1bGVOYW1lID0gbW9kdWxlLm5hbWVGb3JDb25kaXRpb24gPyBtb2R1bGUubmFtZUZvckNvbmRpdGlvbigpIDogJyc7XG5cbiAgICAgICAgICAgICAgcmV0dXJuIC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS8udGVzdChtb2R1bGVOYW1lKVxuICAgICAgICAgICAgICAgICYmICFjaHVua3Muc29tZSgoeyBuYW1lIH0pID0+IG5hbWUgPT09ICdwb2x5ZmlsbHMnIHx8IG5hbWUgPT09ICdwb2x5ZmlsbHMuZXM1J1xuICAgICAgICAgICAgICAgICAgfHwgZ2xvYmFsU3R5bGVzQnVuZGxlTmFtZXMuaW5jbHVkZXMobmFtZSkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2lucyxcbiAgICBub2RlOiBmYWxzZSxcbiAgfTtcbn1cbiJdfQ==