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
    const { root, projectRoot, buildOptions } = wco;
    let extraPlugins = [];
    // Figure out which are the lazy loaded bundle names.
    const lazyChunkBundleNames = [...buildOptions.styles, ...buildOptions.scripts]
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
    const globalStylesBundleNames = buildOptions.styles
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncy9icm93c2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBaUI7QUFDakIsK0RBQStEOztBQUUvRCw2QkFBNkI7QUFDN0IsTUFBTSxpQkFBaUIsR0FBRyxPQUFPLENBQUMscUJBQXFCLENBQUMsQ0FBQztBQUN6RCxNQUFNLDBCQUEwQixHQUFHLE9BQU8sQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0FBQzVFLG1FQUE4RDtBQUM5RCwyRUFBMkY7QUFDM0YsbUVBQW9FO0FBQ3BFLHVGQUFpRjtBQUlqRjs7Ozs7SUFLSTtBQUVKLDBCQUFpQyxHQUF5QjtJQUN4RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFHaEQsSUFBSSxZQUFZLEdBQVUsRUFBRSxDQUFDO0lBRTdCLHFEQUFxRDtJQUNyRCxNQUFNLG9CQUFvQixHQUFJLENBQUMsR0FBRyxZQUFZLENBQUMsTUFBTSxFQUFFLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBdUI7U0FDbEcsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztTQUMzQixHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7SUFFbEMsTUFBTSxpQkFBaUIsR0FBRyxLQUFLLENBQUM7SUFDaEMsRUFBRSxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxpQkFBaUIsQ0FBQztZQUN0QyxRQUFRLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLEtBQUssQ0FBQztZQUNoRCxR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QUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDOzRCQUM1RSxNQUFNLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQzttQ0FDM0MsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSSxLQUFLLFdBQVc7dUNBQzdDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO3dCQUNqRCxDQUFDO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRjtRQUNELE9BQU8sRUFBRSxZQUFZLENBQUMsTUFBTSxDQUFDO1lBQzNCLElBQUksa0RBQXNCLENBQUM7Z0JBQ3pCLEtBQUssRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsS0FBSyxDQUFDO2dCQUM3QyxNQUFNLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDO2dCQUN6QyxRQUFRLEVBQUUsWUFBWSxDQUFDLFFBQVE7Z0JBQy9CLFdBQVcsRUFBRSx3Q0FBbUIsQ0FBQyxZQUFZLENBQUM7Z0JBQzlDLFNBQVMsRUFBRSxZQUFZLENBQUMsU0FBUzthQUNsQyxDQUFDO1NBQ0gsQ0FBQztRQUNGLElBQUksRUFBRSxLQUFLO0tBQ1osQ0FBQztBQUNKLENBQUM7QUFyR0QsNENBcUdDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuY29uc3QgSHRtbFdlYnBhY2tQbHVnaW4gPSByZXF1aXJlKCdodG1sLXdlYnBhY2stcGx1Z2luJyk7XG5jb25zdCBTdWJyZXNvdXJjZUludGVncml0eVBsdWdpbiA9IHJlcXVpcmUoJ3dlYnBhY2stc3VicmVzb3VyY2UtaW50ZWdyaXR5Jyk7XG5pbXBvcnQgeyBMaWNlbnNlV2VicGFja1BsdWdpbiB9IGZyb20gJ2xpY2Vuc2Utd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cywgcGFja2FnZUNodW5rU29ydCB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgQmFzZUhyZWZXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vbGliL2Jhc2UtaHJlZi13ZWJwYWNrJztcbmltcG9ydCB7IEluZGV4SHRtbFdlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL2luZGV4LWh0bWwtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgRXh0cmFFbnRyeVBvaW50IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlcic7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2J1aWxkLW9wdGlvbnMnO1xuXG4vKipcbisgKiBsaWNlbnNlLXdlYnBhY2stcGx1Z2luIGhhcyBhIHBlZXIgZGVwZW5kZW5jeSBvbiB3ZWJwYWNrLXNvdXJjZXMsIGxpc3QgaXQgaW4gYSBjb21tZW50IHRvXG4rICogbGV0IHRoZSBkZXBlbmRlbmN5IHZhbGlkYXRvciBrbm93IGl0IGlzIHVzZWQuXG4rICpcbisgKiByZXF1aXJlKCd3ZWJwYWNrLXNvdXJjZXMnKVxuKyAqL1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QnJvd3NlckNvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKSB7XG4gIGNvbnN0IHsgcm9vdCwgcHJvamVjdFJvb3QsIGJ1aWxkT3B0aW9ucyB9ID0gd2NvO1xuXG5cbiAgbGV0IGV4dHJhUGx1Z2luczogYW55W10gPSBbXTtcblxuICAvLyBGaWd1cmUgb3V0IHdoaWNoIGFyZSB0aGUgbGF6eSBsb2FkZWQgYnVuZGxlIG5hbWVzLlxuICBjb25zdCBsYXp5Q2h1bmtCdW5kbGVOYW1lcyA9IChbLi4uYnVpbGRPcHRpb25zLnN0eWxlcywgLi4uYnVpbGRPcHRpb25zLnNjcmlwdHNdIGFzIEV4dHJhRW50cnlQb2ludFtdKVxuICAgIC5maWx0ZXIoZW50cnkgPT4gZW50cnkubGF6eSlcbiAgICAubWFwKGVudHJ5ID0+IGVudHJ5LmJ1bmRsZU5hbWUpO1xuXG4gIGNvbnN0IGdlbmVyYXRlSW5kZXhIdG1sID0gZmFsc2U7XG4gIGlmIChnZW5lcmF0ZUluZGV4SHRtbCkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBIdG1sV2VicGFja1BsdWdpbih7XG4gICAgICB0ZW1wbGF0ZTogcGF0aC5yZXNvbHZlKHJvb3QsIGJ1aWxkT3B0aW9ucy5pbmRleCksXG4gICAgICBmaWxlbmFtZTogcGF0aC5yZXNvbHZlKGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoLCBidWlsZE9wdGlvbnMuaW5kZXgpLFxuICAgICAgY2h1bmtzU29ydE1vZGU6IHBhY2thZ2VDaHVua1NvcnQoYnVpbGRPcHRpb25zKSxcbiAgICAgIGV4Y2x1ZGVDaHVua3M6IGxhenlDaHVua0J1bmRsZU5hbWVzLFxuICAgICAgeGh0bWw6IHRydWUsXG4gICAgICBtaW5pZnk6IGJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24gPyB7XG4gICAgICAgIGNhc2VTZW5zaXRpdmU6IHRydWUsXG4gICAgICAgIGNvbGxhcHNlV2hpdGVzcGFjZTogdHJ1ZSxcbiAgICAgICAga2VlcENsb3NpbmdTbGFzaDogdHJ1ZVxuICAgICAgfSA6IGZhbHNlXG4gICAgfSkpO1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBCYXNlSHJlZldlYnBhY2tQbHVnaW4oe1xuICAgICAgYmFzZUhyZWY6IGJ1aWxkT3B0aW9ucy5iYXNlSHJlZiBhcyBzdHJpbmdcbiAgICB9KSk7XG4gIH1cblxuICBsZXQgc291cmNlbWFwczogc3RyaW5nIHwgZmFsc2UgPSBmYWxzZTtcbiAgaWYgKGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXApIHtcbiAgICAvLyBTZWUgaHR0cHM6Ly93ZWJwYWNrLmpzLm9yZy9jb25maWd1cmF0aW9uL2RldnRvb2wvIGZvciBzb3VyY2VtYXAgdHlwZXMuXG4gICAgaWYgKGJ1aWxkT3B0aW9ucy5ldmFsU291cmNlTWFwICYmICFidWlsZE9wdGlvbnMub3B0aW1pemF0aW9uKSB7XG4gICAgICAvLyBQcm9kdWNlIGV2YWwgc291cmNlbWFwcyBmb3IgZGV2ZWxvcG1lbnQgd2l0aCBzZXJ2ZSwgd2hpY2ggYXJlIGZhc3Rlci5cbiAgICAgIHNvdXJjZW1hcHMgPSAnZXZhbCc7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFByb2R1Y2UgZnVsbCBzZXBhcmF0ZSBzb3VyY2VtYXBzIGZvciBwcm9kdWN0aW9uLlxuICAgICAgc291cmNlbWFwcyA9ICdzb3VyY2UtbWFwJztcbiAgICB9XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5KSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN1YnJlc291cmNlSW50ZWdyaXR5UGx1Z2luKHtcbiAgICAgIGhhc2hGdW5jTmFtZXM6IFsnc2hhMzg0J11cbiAgICB9KSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmV4dHJhY3RMaWNlbnNlcykge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBMaWNlbnNlV2VicGFja1BsdWdpbih7XG4gICAgICBwYXR0ZXJuOiAvLiovLFxuICAgICAgc3VwcHJlc3NFcnJvcnM6IHRydWUsXG4gICAgICBwZXJDaHVua091dHB1dDogZmFsc2UsXG4gICAgICBvdXRwdXRGaWxlbmFtZTogYDNyZHBhcnR5bGljZW5zZXMudHh0YFxuICAgIH0pKTtcbiAgfVxuXG4gIGNvbnN0IGdsb2JhbFN0eWxlc0J1bmRsZU5hbWVzID0gKGJ1aWxkT3B0aW9ucy5zdHlsZXMgYXMgRXh0cmFFbnRyeVBvaW50W10pXG4gICAgLm1hcChzdHlsZSA9PiBzdHlsZS5idW5kbGVOYW1lKTtcblxuICByZXR1cm4ge1xuICAgIGRldnRvb2w6IHNvdXJjZW1hcHMsXG4gICAgcmVzb2x2ZToge1xuICAgICAgbWFpbkZpZWxkczogW1xuICAgICAgICAuLi4od2NvLnN1cHBvcnRFUzIwMTUgPyBbJ2VzMjAxNSddIDogW10pLFxuICAgICAgICAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbidcbiAgICAgIF1cbiAgICB9LFxuICAgIG91dHB1dDoge1xuICAgICAgY3Jvc3NPcmlnaW5Mb2FkaW5nOiBidWlsZE9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHkgPyAnYW5vbnltb3VzJyA6IGZhbHNlXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIHJ1bnRpbWVDaHVuazogJ3NpbmdsZScsXG4gICAgICBzcGxpdENodW5rczoge1xuICAgICAgICBjaHVua3M6IGJ1aWxkT3B0aW9ucy5jb21tb25DaHVuayA/ICdhbGwnIDogJ2luaXRpYWwnLFxuICAgICAgICBjYWNoZUdyb3Vwczoge1xuICAgICAgICAgIHZlbmRvcnM6IGZhbHNlLFxuICAgICAgICAgIHZlbmRvcjogYnVpbGRPcHRpb25zLnZlbmRvckNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICd2ZW5kb3InLFxuICAgICAgICAgICAgY2h1bmtzOiAnaW5pdGlhbCcsXG4gICAgICAgICAgICB0ZXN0OiAobW9kdWxlOiBhbnksIGNodW5rczogQXJyYXk8eyBuYW1lOiBzdHJpbmcgfT4pID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgbW9kdWxlTmFtZSA9IG1vZHVsZS5uYW1lRm9yQ29uZGl0aW9uID8gbW9kdWxlLm5hbWVGb3JDb25kaXRpb24oKSA6ICcnO1xuICAgICAgICAgICAgICByZXR1cm4gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLy50ZXN0KG1vZHVsZU5hbWUpXG4gICAgICAgICAgICAgICAgJiYgIWNodW5rcy5zb21lKCh7IG5hbWUgfSkgPT4gbmFtZSA9PT0gJ3BvbHlmaWxscydcbiAgICAgICAgICAgICAgICAgIHx8IGdsb2JhbFN0eWxlc0J1bmRsZU5hbWVzLmluY2x1ZGVzKG5hbWUpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLmNvbmNhdChbXG4gICAgICBuZXcgSW5kZXhIdG1sV2VicGFja1BsdWdpbih7XG4gICAgICAgIGlucHV0OiBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLmluZGV4KSxcbiAgICAgICAgb3V0cHV0OiBwYXRoLmJhc2VuYW1lKGJ1aWxkT3B0aW9ucy5pbmRleCksXG4gICAgICAgIGJhc2VIcmVmOiBidWlsZE9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgIGVudHJ5cG9pbnRzOiBnZW5lcmF0ZUVudHJ5UG9pbnRzKGJ1aWxkT3B0aW9ucyksXG4gICAgICAgIGRlcGxveVVybDogYnVpbGRPcHRpb25zLmRlcGxveVVybCxcbiAgICAgIH0pLFxuICAgIF0pLFxuICAgIG5vZGU6IGZhbHNlLFxuICB9O1xufVxuIl19