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
/**
+ * license-webpack-plugin has a peer dependency on webpack-sources, list it in a comment to
+ * let the dependency validator know it is used.
+ *
+ * require('webpack-sources')
+ */
function getBrowserConfig(wco) {
    const { root, projectRoot, buildOptions, appConfig } = wco;
    let extraPlugins = [];
    // Figure out which are the lazy loaded bundle names.
    const lazyChunkBundleNames = [...appConfig.styles, ...appConfig.scripts]
        .filter(entry => entry.lazy)
        .map(entry => entry.bundleName);
    const generateIndexHtml = false;
    if (generateIndexHtml) {
        extraPlugins.push(new HtmlWebpackPlugin({
            template: path.resolve(root, appConfig.index),
            filename: path.resolve(buildOptions.outputPath, appConfig.index),
            chunksSortMode: package_chunk_sort_1.packageChunkSort(appConfig),
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
    const globalStylesBundleNames = appConfig.styles
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
                chunks: buildOptions.commonChunk ? 'all' : 'initial',
                cacheGroups: {
                    vendors: false,
                    vendor: buildOptions.vendorChunk && {
                        name: 'vendor',
                        chunks: 'initial',
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
                input: path.resolve(root, appConfig.index),
                output: path.basename(appConfig.index),
                baseHref: buildOptions.baseHref,
                entrypoints: package_chunk_sort_1.generateEntryPoints(appConfig),
                deployUrl: buildOptions.deployUrl,
            }),
        ]),
        node: false,
    };
}
exports.getBrowserConfig = getBrowserConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncy9icm93c2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBaUI7QUFDakIsK0RBQStEOztBQUUvRCw2QkFBNkI7QUFDN0IsTUFBTSxpQkFBaUIsR0FBRyxPQUFPLENBQUMscUJBQXFCLENBQUMsQ0FBQztBQUN6RCxNQUFNLDBCQUEwQixHQUFHLE9BQU8sQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0FBQzVFLG1FQUE4RDtBQUM5RCwyRUFBMkY7QUFDM0YsbUVBQW9FO0FBQ3BFLHVGQUFpRjtBQUlqRjs7Ozs7SUFLSTtBQUVKLDBCQUFpQyxHQUF5QjtJQUN4RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBRzNELElBQUksWUFBWSxHQUFVLEVBQUUsQ0FBQztJQUU3QixxREFBcUQ7SUFDckQsTUFBTSxvQkFBb0IsR0FBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQXVCO1NBQzVGLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7U0FDM0IsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBRWxDLE1BQU0saUJBQWlCLEdBQUcsS0FBSyxDQUFDO0lBQ2hDLEVBQUUsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQztRQUN0QixZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksaUJBQWlCLENBQUM7WUFDdEMsUUFBUSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxLQUFLLENB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QyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQzs0QkFDNUUsTUFBTSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7bUNBQzNDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUksS0FBSyxXQUFXO3VDQUM3Qyx1QkFBdUIsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzt3QkFDakQsQ0FBQztxQkFDRjtpQkFDRjthQUNGO1NBQ0Y7UUFDRCxPQUFPLEVBQUUsWUFBWSxDQUFDLE1BQU0sQ0FBQztZQUMzQixJQUFJLGtEQUFzQixDQUFDO2dCQUN6QixLQUFLLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQztnQkFDMUMsTUFBTSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQztnQkFDdEMsUUFBUSxFQUFFLFlBQVksQ0FBQyxRQUFRO2dCQUMvQixXQUFXLEVBQUUsd0NBQW1CLENBQUMsU0FBUyxDQUFDO2dCQUMzQyxTQUFTLEVBQUUsWUFBWSxDQUFDLFNBQVM7YUFDbEMsQ0FBQztTQUNILENBQUM7UUFDRixJQUFJLEVBQUUsS0FBSztLQUNaLENBQUM7QUFDSixDQUFDO0FBckdELDRDQXFHQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIHRzbGludDpkaXNhYmxlXG4vLyBUT0RPOiBjbGVhbnVwIHRoaXMgZmlsZSwgaXQncyBjb3BpZWQgYXMgaXMgZnJvbSBBbmd1bGFyIENMSS5cblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmNvbnN0IEh0bWxXZWJwYWNrUGx1Z2luID0gcmVxdWlyZSgnaHRtbC13ZWJwYWNrLXBsdWdpbicpO1xuY29uc3QgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4gPSByZXF1aXJlKCd3ZWJwYWNrLXN1YnJlc291cmNlLWludGVncml0eScpO1xuaW1wb3J0IHsgTGljZW5zZVdlYnBhY2tQbHVnaW4gfSBmcm9tICdsaWNlbnNlLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMsIHBhY2thZ2VDaHVua1NvcnQgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvcGFja2FnZS1jaHVuay1zb3J0JztcbmltcG9ydCB7IEJhc2VIcmVmV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL2xpYi9iYXNlLWhyZWYtd2VicGFjayc7XG5pbXBvcnQgeyBJbmRleEh0bWxXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9pbmRleC1odG1sLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IEV4dHJhRW50cnlQb2ludCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXInO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9idWlsZC1vcHRpb25zJztcblxuLyoqXG4rICogbGljZW5zZS13ZWJwYWNrLXBsdWdpbiBoYXMgYSBwZWVyIGRlcGVuZGVuY3kgb24gd2VicGFjay1zb3VyY2VzLCBsaXN0IGl0IGluIGEgY29tbWVudCB0b1xuKyAqIGxldCB0aGUgZGVwZW5kZW5jeSB2YWxpZGF0b3Iga25vdyBpdCBpcyB1c2VkLlxuKyAqXG4rICogcmVxdWlyZSgnd2VicGFjay1zb3VyY2VzJylcbisgKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEJyb3dzZXJDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucykge1xuICBjb25zdCB7IHJvb3QsIHByb2plY3RSb290LCBidWlsZE9wdGlvbnMsIGFwcENvbmZpZyB9ID0gd2NvO1xuXG5cbiAgbGV0IGV4dHJhUGx1Z2luczogYW55W10gPSBbXTtcblxuICAvLyBGaWd1cmUgb3V0IHdoaWNoIGFyZSB0aGUgbGF6eSBsb2FkZWQgYnVuZGxlIG5hbWVzLlxuICBjb25zdCBsYXp5Q2h1bmtCdW5kbGVOYW1lcyA9IChbLi4uYXBwQ29uZmlnLnN0eWxlcywgLi4uYXBwQ29uZmlnLnNjcmlwdHNdIGFzIEV4dHJhRW50cnlQb2ludFtdKVxuICAgIC5maWx0ZXIoZW50cnkgPT4gZW50cnkubGF6eSlcbiAgICAubWFwKGVudHJ5ID0+IGVudHJ5LmJ1bmRsZU5hbWUpO1xuXG4gIGNvbnN0IGdlbmVyYXRlSW5kZXhIdG1sID0gZmFsc2U7XG4gIGlmIChnZW5lcmF0ZUluZGV4SHRtbCkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBIdG1sV2VicGFja1BsdWdpbih7XG4gICAgICB0ZW1wbGF0ZTogcGF0aC5yZXNvbHZlKHJvb3QsIGFwcENvbmZpZy5pbmRleCksXG4gICAgICBmaWxlbmFtZTogcGF0aC5yZXNvbHZlKGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoLCBhcHBDb25maWcuaW5kZXgpLFxuICAgICAgY2h1bmtzU29ydE1vZGU6IHBhY2thZ2VDaHVua1NvcnQoYXBwQ29uZmlnKSxcbiAgICAgIGV4Y2x1ZGVDaHVua3M6IGxhenlDaHVua0J1bmRsZU5hbWVzLFxuICAgICAgeGh0bWw6IHRydWUsXG4gICAgICBtaW5pZnk6IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24gPyB7XG4gICAgICAgIGNhc2VTZW5zaXRpdmU6IHRydWUsXG4gICAgICAgIGNvbGxhcHNlV2hpdGVzcGFjZTogdHJ1ZSxcbiAgICAgICAga2VlcENsb3NpbmdTbGFzaDogdHJ1ZVxuICAgICAgfSA6IGZhbHNlXG4gICAgfSkpO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBCYXNlSHJlZldlYnBhY2tQbHVnaW4oe1xuICAgICAgYmFzZUhyZWY6IGJ1aWxkT3B0aW9ucy5iYXNlSHJlZiBhcyBzdHJpbmdcbiAgICB9KSk7XG4gIH1cblxuICBsZXQgc291cmNlbWFwczogc3RyaW5nIHwgZmFsc2UgPSBmYWxzZTtcbiAgaWYgKGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXApIHtcbiAgICAvLyBTZWUgaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9jb25maWd1cmF0aW9uL2RldnRvb2wvIGZvciBzb3VyY2VtYXAgdHlwZXMuXG4gICAgaWYgKGJ1aWxkT3B0aW9ucy5ldmFsU291cmNlTWFwICYmICFidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uKSB7XG4gICAgICAvLyBQcm9kdWNlIGV2YWwgc291cmNlbWFwcyBmb3IgZGV2ZWxvcG1lbnQgd2l0aCBzZXJ2ZSwgd2hpY2ggYXJlIGZhc3Rlci5cbiAgICAgIHNvdXJjZW1hcHMgPSAnZXZhbCc7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFByb2R1Y2UgZnVsbCBzZXBhcmF0ZSBzb3VyY2VtYXBzIGZvciBwcm9kdWN0aW9uLlxuICAgICAgc291cmNlbWFwcyA9ICdzb3VyY2UtbWFwJztcbiAgICB9XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5KSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN1YnJlc291cmNlSW50ZWdyaXR5UGx1Z2luKHtcbiAgICAgIGhhc2hGdW5jTmFtZXM6IFsnc2hhMzg0J11cbiAgICB9KSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBMaWNlbnNlV2VicGFja1BsdWdpbih7XG4gICAgICBwYXR0ZXJuOiAvLiovLFxuICAgICAgc3VwcHJlc3NFcnJvcnM6IHRydWUsXG4gICAgICBwZXJDaHVua091dHB1dDogZmFsc2UsXG4gICAgICBvdXRwdXRGaWxlbmFtZTogYDNyZHBhcnR5bGljZW5zZXMudHh0YFxuICAgIH0pKTtcbiAgfVxuXG4gIGNvbnN0IGdsb2JhbFN0eWxlc0J1bmRsZU5hbWVzID0gKGFwcENvbmZpZy5zdHlsZXMgYXMgRXh0cmFFbnRyeVBvaW50W10pXG4gICAgLm1hcChzdHlsZSA9PiBzdHlsZS5idW5kbGVOYW1lKTtcblxuICByZXR1cm4ge1xuICAgIGRldnRvb2w6IHNvdXJjZW1hcHMsXG4gICAgcmVzb2x2ZToge1xuICAgICAgbWFpbkZpZWxkczogW1xuICAgICAgICAuLi4od2NvLnN1cHBvcnRFUzIwMTUgPyBbJ2VzMjAxNSddIDogW10pLFxuICAgICAgICAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbidcbiAgICAgIF1cbiAgICB9LFxuICAgIG91dHB1dDoge1xuICAgICAgY3Jvc3NPcmlnaW5Mb2FkaW5nOiBidWlsZE9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHkgPyAnYW5vbnltb3VzJyA6IGZhbHNlXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIHJ1bnRpbWVDaHVuazogJ3NpbmdsZScsXG4gICAgICBzcGxpdENodW5rczoge1xuICAgICAgICBjaHVua3M6IGJ1aWxkT3B0aW9ucy5jb21tb25DaHVuayA/ICdhbGwnIDogJ2luaXRpYWwnLFxuICAgICAgICBjYWNoZUdyb3Vwczoge1xuICAgICAgICAgIHZlbmRvcnM6IGZhbHNlLFxuICAgICAgICAgIHZlbmRvcjogYnVpbGRPcHRpb25zLnZlbmRvckNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICd2ZW5kb3InLFxuICAgICAgICAgICAgY2h1bmtzOiAnaW5pdGlhbCcsXG4gICAgICAgICAgICB0ZXN0OiAobW9kdWxlOiBhbnksIGNodW5rczogQXJyYXk8eyBuYW1lOiBzdHJpbmcgfT4pID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgbW9kdWxlTmFtZSA9IG1vZHVsZS5uYW1lRm9yQ29uZGl0aW9uID8gbW9kdWxlLm5hbWVGb3JDb25kaXRpb24oKSA6ICcnO1xuICAgICAgICAgICAgICByZXR1cm4gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLy50ZXN0KG1vZHVsZU5hbWUpXG4gICAgICAgICAgICAgICAgJiYgIWNodW5rcy5zb21lKCh7IG5hbWUgfSkgPT4gbmFtZSA9PT0gJ3BvbHlmaWxscydcbiAgICAgICAgICAgICAgICAgIHx8IGdsb2JhbFN0eWxlc0J1bmRsZU5hbWVzLmluY2x1ZGVzKG5hbWUpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLmNvbmNhdChbXG4gICAgICBuZXcgSW5kZXhIdG1sV2VicGFja1BsdWdpbih7XG4gICAgICAgIGlucHV0OiBwYXRoLnJlc29sdmUocm9vdCwgYXBwQ29uZmlnLmluZGV4KSxcbiAgICAgICAgb3V0cHV0OiBwYXRoLmJhc2VuYW1lKGFwcENvbmZpZy5pbmRleCksXG4gICAgICAgIGJhc2VIcmVmOiBidWlsZE9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgIGVudHJ5cG9pbnRzOiBnZW5lcmF0ZUVudHJ5UG9pbnRzKGFwcENvbmZpZyksXG4gICAgICAgIGRlcGxveVVybDogYnVpbGRPcHRpb25zLmRlcGxveVVybCxcbiAgICAgIH0pLFxuICAgIF0pLFxuICAgIG5vZGU6IGZhbHNlLFxuICB9O1xufVxuIl19