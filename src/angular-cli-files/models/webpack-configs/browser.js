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
            noModuleEntrypoints: ['es2015-polyfills'],
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
                                && !chunks.some(({ name }) => name === 'polyfills' || name === 'es2015-polyfills'
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncy9icm93c2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsbUVBQThEO0FBQzlELDZCQUE2QjtBQUM3Qix1RkFBaUY7QUFDakYsMkVBQXlFO0FBRXpFLG1DQUF5RTtBQUV6RSxNQUFNLDBCQUEwQixHQUFHLE9BQU8sQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0FBRzVFLFNBQWdCLGdCQUFnQixDQUFDLEdBQXlCO0lBQ3hELE1BQU0sRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ25DLE1BQU0sWUFBWSxHQUFHLEVBQUUsQ0FBQztJQUV4QixJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUM7SUFDbkIsTUFBTSxFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDO0lBQy9GLE1BQU0sRUFDSixNQUFNLEVBQUUsZUFBZSxFQUN2QixPQUFPLEVBQUUsZ0JBQWdCLEVBQ3pCLE1BQU0sRUFBRSxlQUFlLEdBQ3hCLEdBQUcsWUFBWSxDQUFDLFNBQVMsQ0FBQztJQUUzQix5RUFBeUU7SUFDekUsSUFBSSxDQUFDLGVBQWUsSUFBSSxnQkFBZ0IsQ0FBQztRQUN2QyxZQUFZLENBQUMsYUFBYTtRQUMxQixDQUFDLGtCQUFrQjtRQUNuQixDQUFDLG1CQUFtQixFQUFFO1FBQ3RCLHdFQUF3RTtRQUN4RSxNQUFNLEdBQUcsSUFBSSxDQUFDO0tBQ2Y7SUFFRCxJQUFJLFlBQVksQ0FBQyxLQUFLLEVBQUU7UUFDdEIsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLGtEQUFzQixDQUFDO1lBQzNDLEtBQUssRUFBRSxJQUFJLENB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LENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7NEJBRTVFLE9BQU8sd0JBQXdCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQzttQ0FDM0MsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSSxLQUFLLFdBQVcsSUFBSSxJQUFJLEtBQUssa0JBQWtCO3VDQUM1RSx1QkFBdUIsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzt3QkFDakQsQ0FBQztxQkFDRjtpQkFDRjthQUNGO1NBQ0Y7UUFDRCxPQUFPLEVBQUUsWUFBWTtRQUNyQixJQUFJLEVBQUUsS0FBSztLQUNaLENBQUM7QUFDSixDQUFDO0FBNUdELDRDQTRHQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IExpY2Vuc2VXZWJwYWNrUGx1Z2luIH0gZnJvbSAnbGljZW5zZS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgSW5kZXhIdG1sV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvaW5kZXgtaHRtbC13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgeyBnZW5lcmF0ZUVudHJ5UG9pbnRzIH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL3BhY2thZ2UtY2h1bmstc29ydCc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgZ2V0U291cmNlTWFwRGV2VG9vbCwgbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyB9IGZyb20gJy4vdXRpbHMnO1xuXG5jb25zdCBTdWJyZXNvdXJjZUludGVncml0eVBsdWdpbiA9IHJlcXVpcmUoJ3dlYnBhY2stc3VicmVzb3VyY2UtaW50ZWdyaXR5Jyk7XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEJyb3dzZXJDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucykge1xuICBjb25zdCB7IHJvb3QsIGJ1aWxkT3B0aW9ucyB9ID0gd2NvO1xuICBjb25zdCBleHRyYVBsdWdpbnMgPSBbXTtcblxuICBsZXQgaXNFdmFsID0gZmFsc2U7XG4gIGNvbnN0IHsgc3R5bGVzOiBzdHlsZXNPcHRpbWl6YXRpb24sIHNjcmlwdHM6IHNjcmlwdHNPcHRpbWl6YXRpb24gfSA9IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb247XG4gIGNvbnN0IHtcbiAgICBzdHlsZXM6IHN0eWxlc1NvdXJjZU1hcCxcbiAgICBzY3JpcHRzOiBzY3JpcHRzU291cmNlTWFwLFxuICAgIGhpZGRlbjogaGlkZGVuU291cmNlTWFwLFxuICB9ID0gYnVpbGRPcHRpb25zLnNvdXJjZU1hcDtcblxuICAvLyBTZWUgaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9jb25maWd1cmF0aW9uL2RldnRvb2wvIGZvciBzb3VyY2VtYXAgdHlwZXMuXG4gIGlmICgoc3R5bGVzU291cmNlTWFwIHx8IHNjcmlwdHNTb3VyY2VNYXApICYmXG4gICAgYnVpbGRPcHRpb25zLmV2YWxTb3VyY2VNYXAgJiZcbiAgICAhc3R5bGVzT3B0aW1pemF0aW9uICYmXG4gICAgIXNjcmlwdHNPcHRpbWl6YXRpb24pIHtcbiAgICAvLyBQcm9kdWNlIGV2YWwgc291cmNlbWFwcyBmb3IgZGV2ZWxvcG1lbnQgd2l0aCBzZXJ2ZSwgd2hpY2ggYXJlIGZhc3Rlci5cbiAgICBpc0V2YWwgPSB0cnVlO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5pbmRleCkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBJbmRleEh0bWxXZWJwYWNrUGx1Z2luKHtcbiAgICAgIGlucHV0OiBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLmluZGV4KSxcbiAgICAgIG91dHB1dDogcGF0aC5iYXNlbmFtZShidWlsZE9wdGlvbnMuaW5kZXgpLFxuICAgICAgYmFzZUhyZWY6IGJ1aWxkT3B0aW9ucy5iYXNlSHJlZixcbiAgICAgIGVudHJ5cG9pbnRzOiBnZW5lcmF0ZUVudHJ5UG9pbnRzKGJ1aWxkT3B0aW9ucyksXG4gICAgICBkZXBsb3lVcmw6IGJ1aWxkT3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgICBzcmk6IGJ1aWxkT3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSxcbiAgICAgIG5vTW9kdWxlRW50cnlwb2ludHM6IFsnZXMyMDE1LXBvbHlmaWxscyddLFxuICAgIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHkpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4oe1xuICAgICAgaGFzaEZ1bmNOYW1lczogWydzaGEzODQnXSxcbiAgICB9KSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBMaWNlbnNlV2VicGFja1BsdWdpbih7XG4gICAgICBzdGF0czoge1xuICAgICAgICB3YXJuaW5nczogZmFsc2UsXG4gICAgICAgIGVycm9yczogZmFsc2UsXG4gICAgICB9LFxuICAgICAgcGVyQ2h1bmtPdXRwdXQ6IGZhbHNlLFxuICAgICAgb3V0cHV0RmlsZW5hbWU6IGAzcmRwYXJ0eWxpY2Vuc2VzLnR4dGAsXG4gICAgfSkpO1xuICB9XG5cbiAgaWYgKCFpc0V2YWwgJiYgKHNjcmlwdHNTb3VyY2VNYXAgfHwgc3R5bGVzU291cmNlTWFwKSkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKGdldFNvdXJjZU1hcERldlRvb2woXG4gICAgICAhIXNjcmlwdHNTb3VyY2VNYXAsXG4gICAgICAhIXN0eWxlc1NvdXJjZU1hcCxcbiAgICAgIGhpZGRlblNvdXJjZU1hcCxcbiAgICApKTtcbiAgfVxuXG4gIGNvbnN0IGdsb2JhbFN0eWxlc0J1bmRsZU5hbWVzID0gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhidWlsZE9wdGlvbnMuc3R5bGVzLCAnc3R5bGVzJylcbiAgICAubWFwKHN0eWxlID0+IHN0eWxlLmJ1bmRsZU5hbWUpO1xuXG4gIHJldHVybiB7XG4gICAgZGV2dG9vbDogaXNFdmFsID8gJ2V2YWwnIDogZmFsc2UsXG4gICAgcmVzb2x2ZToge1xuICAgICAgbWFpbkZpZWxkczogW1xuICAgICAgICAuLi4od2NvLnN1cHBvcnRFUzIwMTUgPyBbJ2VzMjAxNSddIDogW10pLFxuICAgICAgICAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbicsXG4gICAgICBdLFxuICAgIH0sXG4gICAgb3V0cHV0OiB7XG4gICAgICBjcm9zc09yaWdpbkxvYWRpbmc6IGJ1aWxkT3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSA/ICdhbm9ueW1vdXMnIDogZmFsc2UsXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIHJ1bnRpbWVDaHVuazogJ3NpbmdsZScsXG4gICAgICBzcGxpdENodW5rczoge1xuICAgICAgICBtYXhBc3luY1JlcXVlc3RzOiBJbmZpbml0eSxcbiAgICAgICAgY2FjaGVHcm91cHM6IHtcbiAgICAgICAgICBkZWZhdWx0OiBidWlsZE9wdGlvbnMuY29tbW9uQ2h1bmsgJiYge1xuICAgICAgICAgICAgY2h1bmtzOiAnYXN5bmMnLFxuICAgICAgICAgICAgbWluQ2h1bmtzOiAyLFxuICAgICAgICAgICAgcHJpb3JpdHk6IDEwLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29tbW9uOiBidWlsZE9wdGlvbnMuY29tbW9uQ2h1bmsgJiYge1xuICAgICAgICAgICAgbmFtZTogJ2NvbW1vbicsXG4gICAgICAgICAgICBjaHVua3M6ICdhc3luYycsXG4gICAgICAgICAgICBtaW5DaHVua3M6IDIsXG4gICAgICAgICAgICBlbmZvcmNlOiB0cnVlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IDUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB2ZW5kb3JzOiBmYWxzZSxcbiAgICAgICAgICB2ZW5kb3I6IGJ1aWxkT3B0aW9ucy52ZW5kb3JDaHVuayAmJiB7XG4gICAgICAgICAgICBuYW1lOiAndmVuZG9yJyxcbiAgICAgICAgICAgIGNodW5rczogJ2luaXRpYWwnLFxuICAgICAgICAgICAgZW5mb3JjZTogdHJ1ZSxcbiAgICAgICAgICAgIHRlc3Q6IChtb2R1bGU6IHsgbmFtZUZvckNvbmRpdGlvbj86IEZ1bmN0aW9uIH0sIGNodW5rczogQXJyYXk8eyBuYW1lOiBzdHJpbmcgfT4pID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgbW9kdWxlTmFtZSA9IG1vZHVsZS5uYW1lRm9yQ29uZGl0aW9uID8gbW9kdWxlLm5hbWVGb3JDb25kaXRpb24oKSA6ICcnO1xuXG4gICAgICAgICAgICAgIHJldHVybiAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vLnRlc3QobW9kdWxlTmFtZSlcbiAgICAgICAgICAgICAgICAmJiAhY2h1bmtzLnNvbWUoKHsgbmFtZSB9KSA9PiBuYW1lID09PSAncG9seWZpbGxzJyB8fCBuYW1lID09PSAnZXMyMDE1LXBvbHlmaWxscydcbiAgICAgICAgICAgICAgICAgIHx8IGdsb2JhbFN0eWxlc0J1bmRsZU5hbWVzLmluY2x1ZGVzKG5hbWUpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMsXG4gICAgbm9kZTogZmFsc2UsXG4gIH07XG59XG4iXX0=