"use strict";
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const SubresourceIntegrityPlugin = require('webpack-subresource-integrity');
const license_webpack_plugin_1 = require("license-webpack-plugin");
const package_chunk_sort_1 = require("../../utilities/package-chunk-sort");
const base_href_webpack_1 = require("../../lib/base-href-webpack");
const index_html_webpack_plugin_1 = require("../../plugins/index-html-webpack-plugin");
const utils_1 = require("./utils");
/**
+ * license-webpack-plugin has a peer dependency on webpack-sources, list it in a comment to
+ * let the dependency validator know it is used.
+ *
+ * require('webpack-sources')
+ */
function getBrowserConfig(wco) {
    const { root, projectRoot, buildOptions } = wco;
    let extraPlugins = [];
    // Figure out which are the lazy loaded bundle names.
    const lazyChunkBundleNames = utils_1.normalizeExtraEntryPoints(
    // We don't really need a default name because we pre-filtered by lazy only entries.
    [...buildOptions.styles, ...buildOptions.scripts], 'not-lazy')
        .filter(entry => entry.lazy)
        .map(entry => entry.bundleName);
    const generateIndexHtml = false;
    if (generateIndexHtml) {
        extraPlugins.push(new HtmlWebpackPlugin({
            template: path.resolve(root, buildOptions.index),
            filename: path.resolve(buildOptions.outputPath, buildOptions.index),
            chunksSortMode: package_chunk_sort_1.packageChunkSort(buildOptions),
            excludeChunks: lazyChunkBundleNames,
            xhtml: true,
            minify: buildOptions.optimization ? {
                caseSensitive: true,
                collapseWhitespace: true,
                keepClosingSlash: true
            } : false
        }));
        extraPlugins.push(new base_href_webpack_1.BaseHrefWebpackPlugin({
            baseHref: buildOptions.baseHref
        }));
    }
    let sourcemaps = false;
    if (buildOptions.sourceMap) {
        // See https://webpack.js.org/configuration/devtool/ for sourcemap types.
        if (buildOptions.evalSourceMap && !buildOptions.optimization) {
            // Produce eval sourcemaps for development with serve, which are faster.
            sourcemaps = 'eval';
        }
        else {
            // Produce full separate sourcemaps for production.
            sourcemaps = 'source-map';
        }
    }
    if (buildOptions.subresourceIntegrity) {
        extraPlugins.push(new SubresourceIntegrityPlugin({
            hashFuncNames: ['sha384']
        }));
    }
    if (buildOptions.extractLicenses) {
        extraPlugins.push(new license_webpack_plugin_1.LicenseWebpackPlugin({
            pattern: /.*/,
            suppressErrors: true,
            perChunkOutput: false,
            outputFilename: `3rdpartylicenses.txt`
        }));
    }
    const globalStylesBundleNames = utils_1.normalizeExtraEntryPoints(buildOptions.styles, 'styles')
        .map(style => style.bundleName);
    return {
        devtool: sourcemaps,
        resolve: {
            mainFields: [
                ...(wco.supportES2015 ? ['es2015'] : []),
                'browser', 'module', 'main'
            ]
        },
        output: {
            crossOriginLoading: buildOptions.subresourceIntegrity ? 'anonymous' : false
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
                }
            }
        },
        plugins: extraPlugins.concat([
            new index_html_webpack_plugin_1.IndexHtmlWebpackPlugin({
                input: path.resolve(root, buildOptions.index),
                output: path.basename(buildOptions.index),
                baseHref: buildOptions.baseHref,
                entrypoints: package_chunk_sort_1.generateEntryPoints(buildOptions),
                deployUrl: buildOptions.deployUrl,
            }),
        ]),
        node: false,
    };
}
exports.getBrowserConfig = getBrowserConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncy9icm93c2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBaUI7QUFDakIsK0RBQStEOztBQUUvRCw2QkFBNkI7QUFDN0IsTUFBTSxpQkFBaUIsR0FBRyxPQUFPLENBQUMscUJBQXFCLENBQUMsQ0FBQztBQUN6RCxNQUFNLDBCQUEwQixHQUFHLE9BQU8sQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0FBQzVFLG1FQUE4RDtBQUM5RCwyRUFBMkY7QUFDM0YsbUVBQW9FO0FBQ3BFLHVGQUFpRjtBQUlqRixtQ0FBb0Q7QUFFcEQ7Ozs7O0lBS0k7QUFFSiwwQkFBaUMsR0FBeUI7SUFDeEQsTUFBTSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBR2hELElBQUksWUFBWSxHQUFVLEVBQUUsQ0FBQztJQUU3QixxREFBcUQ7SUFDckQsTUFBTSxvQkFBb0IsR0FBRyxpQ0FBeUI7SUFDcEQsb0ZBQW9GO0lBQ3BGLENBQUMsR0FBRyxZQUFZLENBQUMsTUFBTSxFQUFFLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxFQUFFLFVBQVUsQ0FBQztTQUM3RCxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO1NBQzNCLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQTtJQUVqQyxNQUFNLGlCQUFpQixHQUFHLEtBQUssQ0FBQztJQUNoQyxFQUFFLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7UUFDdEIsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLGlCQUFpQixDQUFDO1lBQ3RDLFFBQVEsRUFBRSxJQUFJ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RSxLQUFLO0tBQ1osQ0FBQztBQUNKLENBQUM7QUFwSEQsNENBb0hDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuY29uc3QgSHRtbFdlYnBhY2tQbHVnaW4gPSByZXF1aXJlKCdodG1sLXdlYnBhY2stcGx1Z2luJyk7XG5jb25zdCBTdWJyZXNvdXJjZUludGVncml0eVBsdWdpbiA9IHJlcXVpcmUoJ3dlYnBhY2stc3VicmVzb3VyY2UtaW50ZWdyaXR5Jyk7XG5pbXBvcnQgeyBMaWNlbnNlV2VicGFja1BsdWdpbiB9IGZyb20gJ2xpY2Vuc2Utd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cywgcGFja2FnZUNodW5rU29ydCB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgQmFzZUhyZWZXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vbGliL2Jhc2UtaHJlZi13ZWJwYWNrJztcbmltcG9ydCB7IEluZGV4SHRtbFdlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL2luZGV4LWh0bWwtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgRXh0cmFFbnRyeVBvaW50IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9zY2hlbWEnO1xuaW1wb3J0IHsgQnJvd3NlckJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyB9IGZyb20gJy4vdXRpbHMnO1xuXG4vKipcbisgKiBsaWNlbnNlLXdlYnBhY2stcGx1Z2luIGhhcyBhIHBlZXIgZGVwZW5kZW5jeSBvbiB3ZWJwYWNrLXNvdXJjZXMsIGxpc3QgaXQgaW4gYSBjb21tZW50IHRvXG4rICogbGV0IHRoZSBkZXBlbmRlbmN5IHZhbGlkYXRvciBrbm93IGl0IGlzIHVzZWQuXG4rICpcbisgKiByZXF1aXJlKCd3ZWJwYWNrLXNvdXJjZXMnKVxuKyAqL1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QnJvd3NlckNvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKSB7XG4gIGNvbnN0IHsgcm9vdCwgcHJvamVjdFJvb3QsIGJ1aWxkT3B0aW9ucyB9ID0gd2NvO1xuXG5cbiAgbGV0IGV4dHJhUGx1Z2luczogYW55W10gPSBbXTtcblxuICAvLyBGaWd1cmUgb3V0IHdoaWNoIGFyZSB0aGUgbGF6eSBsb2FkZWQgYnVuZGxlIG5hbWVzLlxuICBjb25zdCBsYXp5Q2h1bmtCdW5kbGVOYW1lcyA9IG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoXG4gICAgLy8gV2UgZG9uJ3QgcmVhbGx5IG5lZWQgYSBkZWZhdWx0IG5hbWUgYmVjYXVzZSB3ZSBwcmUtZmlsdGVyZWQgYnkgbGF6eSBvbmx5IGVudHJpZXMuXG4gICAgWy4uLmJ1aWxkT3B0aW9ucy5zdHlsZXMsIC4uLmJ1aWxkT3B0aW9ucy5zY3JpcHRzXSwgJ25vdC1sYXp5JylcbiAgICAuZmlsdGVyKGVudHJ5ID0+IGVudHJ5LmxhenkpXG4gICAgLm1hcChlbnRyeSA9PiBlbnRyeS5idW5kbGVOYW1lKVxuXG4gIGNvbnN0IGdlbmVyYXRlSW5kZXhIdG1sID0gZmFsc2U7XG4gIGlmIChnZW5lcmF0ZUluZGV4SHRtbCkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBIdG1sV2VicGFja1BsdWdpbih7XG4gICAgICB0ZW1wbGF0ZTogcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5pbmRleCksXG4gICAgICBmaWxlbmFtZTogcGF0aC5yZXNvbHZlKGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoLCBidWlsZE9wdGlvbnMuaW5kZXgpLFxuICAgICAgY2h1bmtzU29ydE1vZGU6IHBhY2thZ2VDaHVua1NvcnQoYnVpbGRPcHRpb25zKSxcbiAgICAgIGV4Y2x1ZGVDaHVua3M6IGxhenlDaHVua0J1bmRsZU5hbWVzLFxuICAgICAgeGh0bWw6IHRydWUsXG4gICAgICBtaW5pZnk6IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24gPyB7XG4gICAgICAgIGNhc2VTZW5zaXRpdmU6IHRydWUsXG4gICAgICAgIGNvbGxhcHNlV2hpdGVzcGFjZTogdHJ1ZSxcbiAgICAgICAga2VlcENsb3NpbmdTbGFzaDogdHJ1ZVxuICAgICAgfSA6IGZhbHNlXG4gICAgfSkpO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBCYXNlSHJlZldlYnBhY2tQbHVnaW4oe1xuICAgICAgYmFzZUhyZWY6IGJ1aWxkT3B0aW9ucy5iYXNlSHJlZiBhcyBzdHJpbmdcbiAgICB9KSk7XG4gIH1cblxuICBsZXQgc291cmNlbWFwczogc3RyaW5nIHwgZmFsc2UgPSBmYWxzZTtcbiAgaWYgKGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXApIHtcbiAgICAvLyBTZWUgaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9jb25maWd1cmF0aW9uL2RldnRvb2wvIGZvciBzb3VyY2VtYXAgdHlwZXMuXG4gICAgaWYgKGJ1aWxkT3B0aW9ucy5ldmFsU291cmNlTWFwICYmICFidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uKSB7XG4gICAgICAvLyBQcm9kdWNlIGV2YWwgc291cmNlbWFwcyBmb3IgZGV2ZWxvcG1lbnQgd2l0aCBzZXJ2ZSwgd2hpY2ggYXJlIGZhc3Rlci5cbiAgICAgIHNvdXJjZW1hcHMgPSAnZXZhbCc7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFByb2R1Y2UgZnVsbCBzZXBhcmF0ZSBzb3VyY2VtYXBzIGZvciBwcm9kdWN0aW9uLlxuICAgICAgc291cmNlbWFwcyA9ICdzb3VyY2UtbWFwJztcbiAgICB9XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5KSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN1YnJlc291cmNlSW50ZWdyaXR5UGx1Z2luKHtcbiAgICAgIGhhc2hGdW5jTmFtZXM6IFsnc2hhMzg0J11cbiAgICB9KSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBMaWNlbnNlV2VicGFja1BsdWdpbih7XG4gICAgICBwYXR0ZXJuOiAvLiovLFxuICAgICAgc3VwcHJlc3NFcnJvcnM6IHRydWUsXG4gICAgICBwZXJDaHVua091dHB1dDogZmFsc2UsXG4gICAgICBvdXRwdXRGaWxlbmFtZTogYDNyZHBhcnR5bGljZW5zZXMudHh0YFxuICAgIH0pKTtcbiAgfVxuXG4gIGNvbnN0IGdsb2JhbFN0eWxlc0J1bmRsZU5hbWVzID0gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhidWlsZE9wdGlvbnMuc3R5bGVzLCAnc3R5bGVzJylcbiAgICAubWFwKHN0eWxlID0+IHN0eWxlLmJ1bmRsZU5hbWUpO1xuXG4gIHJldHVybiB7XG4gICAgZGV2dG9vbDogc291cmNlbWFwcyxcbiAgICByZXNvbHZlOiB7XG4gICAgICBtYWluRmllbGRzOiBbXG4gICAgICAgIC4uLih3Y28uc3VwcG9ydEVTMjAxNSA/IFsnZXMyMDE1J10gOiBbXSksXG4gICAgICAgICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ1xuICAgICAgXVxuICAgIH0sXG4gICAgb3V0cHV0OiB7XG4gICAgICBjcm9zc09yaWdpbkxvYWRpbmc6IGJ1aWxkT3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSA/ICdhbm9ueW1vdXMnIDogZmFsc2VcbiAgICB9LFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgcnVudGltZUNodW5rOiAnc2luZ2xlJyxcbiAgICAgIHNwbGl0Q2h1bmtzOiB7XG4gICAgICAgIG1heEFzeW5jUmVxdWVzdHM6IEluZmluaXR5LFxuICAgICAgICBjYWNoZUdyb3Vwczoge1xuICAgICAgICAgIGRlZmF1bHQ6IGJ1aWxkT3B0aW9ucy5jb21tb25DaHVuayAmJiB7XG4gICAgICAgICAgICBjaHVua3M6ICdhc3luYycsXG4gICAgICAgICAgICBtaW5DaHVua3M6IDIsXG4gICAgICAgICAgICBwcmlvcml0eTogMTAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb21tb246IGJ1aWxkT3B0aW9ucy5jb21tb25DaHVuayAmJiB7XG4gICAgICAgICAgICBuYW1lOiAnY29tbW9uJyxcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICBwcmlvcml0eTogNSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZlbmRvcnM6IGZhbHNlLFxuICAgICAgICAgIHZlbmRvcjogYnVpbGRPcHRpb25zLnZlbmRvckNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICd2ZW5kb3InLFxuICAgICAgICAgICAgY2h1bmtzOiAnaW5pdGlhbCcsXG4gICAgICAgICAgICBlbmZvcmNlOiB0cnVlLFxuICAgICAgICAgICAgdGVzdDogKG1vZHVsZTogYW55LCBjaHVua3M6IEFycmF5PHsgbmFtZTogc3RyaW5nIH0+KSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IG1vZHVsZU5hbWUgPSBtb2R1bGUubmFtZUZvckNvbmRpdGlvbiA/IG1vZHVsZS5uYW1lRm9yQ29uZGl0aW9uKCkgOiAnJztcbiAgICAgICAgICAgICAgcmV0dXJuIC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS8udGVzdChtb2R1bGVOYW1lKVxuICAgICAgICAgICAgICAgICYmICFjaHVua3Muc29tZSgoeyBuYW1lIH0pID0+IG5hbWUgPT09ICdwb2x5ZmlsbHMnXG4gICAgICAgICAgICAgICAgICB8fCBnbG9iYWxTdHlsZXNCdW5kbGVOYW1lcy5pbmNsdWRlcyhuYW1lKSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2lucy5jb25jYXQoW1xuICAgICAgbmV3IEluZGV4SHRtbFdlYnBhY2tQbHVnaW4oe1xuICAgICAgICBpbnB1dDogcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5pbmRleCksXG4gICAgICAgIG91dHB1dDogcGF0aC5iYXNlbmFtZShidWlsZE9wdGlvbnMuaW5kZXgpLFxuICAgICAgICBiYXNlSHJlZjogYnVpbGRPcHRpb25zLmJhc2VIcmVmLFxuICAgICAgICBlbnRyeXBvaW50czogZ2VuZXJhdGVFbnRyeVBvaW50cyhidWlsZE9wdGlvbnMpLFxuICAgICAgICBkZXBsb3lVcmw6IGJ1aWxkT3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgICB9KSxcbiAgICBdKSxcbiAgICBub2RlOiBmYWxzZSxcbiAgfTtcbn1cbiJdfQ==