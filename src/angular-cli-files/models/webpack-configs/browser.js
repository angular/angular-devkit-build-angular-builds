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
    const { root, projectRoot, buildOptions, appConfig } = wco;
    let extraPlugins = [];
    // figure out which are the lazy loaded entry points
    const lazyChunks = utils_1.lazyChunksFilter([
        ...utils_1.extraEntryParser(appConfig.scripts, root, 'scripts'),
        ...utils_1.extraEntryParser(appConfig.styles, root, 'styles')
    ]);
    // TODO: Enable this once HtmlWebpackPlugin supports Webpack 4
    const generateIndexHtml = false;
    if (generateIndexHtml) {
        extraPlugins.push(new HtmlWebpackPlugin({
            template: path.resolve(root, appConfig.index),
            filename: path.resolve(buildOptions.outputPath, appConfig.index),
            chunksSortMode: package_chunk_sort_1.packageChunkSort(appConfig),
            excludeChunks: lazyChunks,
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
    const globalStylesEntries = utils_1.extraEntryParser(appConfig.styles, root, 'styles')
        .map(style => style.entry);
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
                                    || globalStylesEntries.includes(name));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncy9icm93c2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBaUI7QUFDakIsK0RBQStEOztBQUUvRCw2QkFBNkI7QUFDN0IsTUFBTSxpQkFBaUIsR0FBRyxPQUFPLENBQUMscUJBQXFCLENBQUMsQ0FBQztBQUN6RCxNQUFNLDBCQUEwQixHQUFHLE9BQU8sQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0FBQzVFLG1FQUE4RDtBQUM5RCwyRUFBMkY7QUFDM0YsbUVBQW9FO0FBQ3BFLHVGQUFpRjtBQUNqRixtQ0FBNkQ7QUFHN0Q7Ozs7O0lBS0k7QUFFSiwwQkFBaUMsR0FBeUI7SUFDeEQsTUFBTSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxHQUFHLEdBQUcsQ0FBQztJQUczRCxJQUFJLFlBQVksR0FBVSxFQUFFLENBQUM7SUFFN0Isb0RBQW9EO0lBQ3BELE1BQU0sVUFBVSxHQUFHLHdCQUFnQixDQUFDO1FBQ2xDLEdBQUcsd0JBQWdCLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDO1FBQ3ZELEdBQUcsd0JBQWdCLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDO0tBQ3RELENBQUMsQ0FBQztJQUVILDhEQUE4RDtJQUM5RCxNQUFNLGlCQUFpQixHQUFHLEtBQUssQ0FBQztJQUNoQyxFQUFFLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7UUFDdEIsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLGlCQUFpQixDQUFDO1lBQ3RDLFFBQVEsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsS0FB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QUUsRUFBRTs0QkFDckQsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDOzRCQUM1RSxNQUFNLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQzttQ0FDM0MsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSSxLQUFLLFdBQVc7dUNBQzdDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO3dCQUM3QyxDQUFDO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRjtRQUNELE9BQU8sRUFBRSxZQUFZLENBQUMsTUFBTSxDQUFDO1lBQzNCLElBQUksa0RBQXNCLENBQUM7Z0JBQ3pCLEtBQUssRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDO2dCQUMxQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDO2dCQUN0QyxRQUFRLEVBQUUsWUFBWSxDQUFDLFFBQVE7Z0JBQy9CLFdBQVcsRUFBRSx3Q0FBbUIsQ0FBQyxTQUFTLENBQUM7Z0JBQzNDLFNBQVMsRUFBRSxZQUFZLENBQUMsU0FBUzthQUNsQyxDQUFDO1NBQ0gsQ0FBQztRQUNGLElBQUksRUFBRSxLQUFLO0tBQ1osQ0FBQztBQUNKLENBQUM7QUF2R0QsNENBdUdDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuY29uc3QgSHRtbFdlYnBhY2tQbHVnaW4gPSByZXF1aXJlKCdodG1sLXdlYnBhY2stcGx1Z2luJyk7XG5jb25zdCBTdWJyZXNvdXJjZUludGVncml0eVBsdWdpbiA9IHJlcXVpcmUoJ3dlYnBhY2stc3VicmVzb3VyY2UtaW50ZWdyaXR5Jyk7XG5pbXBvcnQgeyBMaWNlbnNlV2VicGFja1BsdWdpbiB9IGZyb20gJ2xpY2Vuc2Utd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgZ2VuZXJhdGVFbnRyeVBvaW50cywgcGFja2FnZUNodW5rU29ydCB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9wYWNrYWdlLWNodW5rLXNvcnQnO1xuaW1wb3J0IHsgQmFzZUhyZWZXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vbGliL2Jhc2UtaHJlZi13ZWJwYWNrJztcbmltcG9ydCB7IEluZGV4SHRtbFdlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL2luZGV4LWh0bWwtd2VicGFjay1wbHVnaW4nO1xuaW1wb3J0IHsgZXh0cmFFbnRyeVBhcnNlciwgbGF6eUNodW5rc0ZpbHRlciB9IGZyb20gJy4vdXRpbHMnO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9idWlsZC1vcHRpb25zJztcblxuLyoqXG4rICogbGljZW5zZS13ZWJwYWNrLXBsdWdpbiBoYXMgYSBwZWVyIGRlcGVuZGVuY3kgb24gd2VicGFjay1zb3VyY2VzLCBsaXN0IGl0IGluIGEgY29tbWVudCB0b1xuKyAqIGxldCB0aGUgZGVwZW5kZW5jeSB2YWxpZGF0b3Iga25vdyBpdCBpcyB1c2VkLlxuKyAqXG4rICogcmVxdWlyZSgnd2VicGFjay1zb3VyY2VzJylcbisgKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEJyb3dzZXJDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucykge1xuICBjb25zdCB7IHJvb3QsIHByb2plY3RSb290LCBidWlsZE9wdGlvbnMsIGFwcENvbmZpZyB9ID0gd2NvO1xuXG5cbiAgbGV0IGV4dHJhUGx1Z2luczogYW55W10gPSBbXTtcblxuICAvLyBmaWd1cmUgb3V0IHdoaWNoIGFyZSB0aGUgbGF6eSBsb2FkZWQgZW50cnkgcG9pbnRzXG4gIGNvbnN0IGxhenlDaHVua3MgPSBsYXp5Q2h1bmtzRmlsdGVyKFtcbiAgICAuLi5leHRyYUVudHJ5UGFyc2VyKGFwcENvbmZpZy5zY3JpcHRzLCByb290LCAnc2NyaXB0cycpLFxuICAgIC4uLmV4dHJhRW50cnlQYXJzZXIoYXBwQ29uZmlnLnN0eWxlcywgcm9vdCwgJ3N0eWxlcycpXG4gIF0pO1xuXG4gIC8vIFRPRE86IEVuYWJsZSB0aGlzIG9uY2UgSHRtbFdlYnBhY2tQbHVnaW4gc3VwcG9ydHMgV2VicGFjayA0XG4gIGNvbnN0IGdlbmVyYXRlSW5kZXhIdG1sID0gZmFsc2U7XG4gIGlmIChnZW5lcmF0ZUluZGV4SHRtbCkge1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBIdG1sV2VicGFja1BsdWdpbih7XG4gICAgICB0ZW1wbGF0ZTogcGF0aC5yZXNvbHZlKHJvb3QsIGFwcENvbmZpZy5pbmRleCksXG4gICAgICBmaWxlbmFtZTogcGF0aC5yZXNvbHZlKGJ1aWxkT3B0aW9ucy5vdXRwdXRQYXRoLCBhcHBDb25maWcuaW5kZXgpLFxuICAgICAgY2h1bmtzU29ydE1vZGU6IHBhY2thZ2VDaHVua1NvcnQoYXBwQ29uZmlnKSxcbiAgICAgIGV4Y2x1ZGVDaHVua3M6IGxhenlDaHVua3MsXG4gICAgICB4aHRtbDogdHJ1ZSxcbiAgICAgIG1pbmlmeTogYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbiA/IHtcbiAgICAgICAgY2FzZVNlbnNpdGl2ZTogdHJ1ZSxcbiAgICAgICAgY29sbGFwc2VXaGl0ZXNwYWNlOiB0cnVlLFxuICAgICAgICBrZWVwQ2xvc2luZ1NsYXNoOiB0cnVlXG4gICAgICB9IDogZmFsc2VcbiAgICB9KSk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IEJhc2VIcmVmV2VicGFja1BsdWdpbih7XG4gICAgICBiYXNlSHJlZjogYnVpbGRPcHRpb25zLmJhc2VIcmVmIGFzIHN0cmluZ1xuICAgIH0pKTtcbiAgfVxuXG4gIGxldCBzb3VyY2VtYXBzOiBzdHJpbmcgfCBmYWxzZSA9IGZhbHNlO1xuICBpZiAoYnVpbGRPcHRpb25zLnNvdXJjZU1hcCkge1xuICAgIC8vIFNlZSBodHRwczovL3dlYnBhY2suanMub3JnL2NvbmZpZ3VyYXRpb24vZGV2dG9vbC8gZm9yIHNvdXJjZW1hcCB0eXBlcy5cbiAgICBpZiAoYnVpbGRPcHRpb25zLmV2YWxTb3VyY2VNYXAgJiYgIWJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24pIHtcbiAgICAgIC8vIFByb2R1Y2UgZXZhbCBzb3VyY2VtYXBzIGZvciBkZXZlbG9wbWVudCB3aXRoIHNlcnZlLCB3aGljaCBhcmUgZmFzdGVyLlxuICAgICAgc291cmNlbWFwcyA9ICdldmFsJztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gUHJvZHVjZSBmdWxsIHNlcGFyYXRlIHNvdXJjZW1hcHMgZm9yIHByb2R1Y3Rpb24uXG4gICAgICBzb3VyY2VtYXBzID0gJ3NvdXJjZS1tYXAnO1xuICAgIH1cbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHkpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4oe1xuICAgICAgaGFzaEZ1bmNOYW1lczogWydzaGEzODQnXVxuICAgIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IExpY2Vuc2VXZWJwYWNrUGx1Z2luKHtcbiAgICAgIHBhdHRlcm46IC8uKi8sXG4gICAgICBzdXBwcmVzc0Vycm9yczogdHJ1ZSxcbiAgICAgIHBlckNodW5rT3V0cHV0OiBmYWxzZSxcbiAgICAgIG91dHB1dEZpbGVuYW1lOiBgM3JkcGFydHlsaWNlbnNlcy50eHRgXG4gICAgfSkpO1xuICB9XG5cbiAgY29uc3QgZ2xvYmFsU3R5bGVzRW50cmllcyA9IGV4dHJhRW50cnlQYXJzZXIoYXBwQ29uZmlnLnN0eWxlcywgcm9vdCwgJ3N0eWxlcycpXG4gICAgLm1hcChzdHlsZSA9PiBzdHlsZS5lbnRyeSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkZXZ0b29sOiBzb3VyY2VtYXBzLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIG1haW5GaWVsZHM6IFtcbiAgICAgICAgLi4uKHdjby5zdXBwb3J0RVMyMDE1ID8gWydlczIwMTUnXSA6IFtdKSxcbiAgICAgICAgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXG4gICAgICBdXG4gICAgfSxcbiAgICBvdXRwdXQ6IHtcbiAgICAgIGNyb3NzT3JpZ2luTG9hZGluZzogYnVpbGRPcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5ID8gJ2Fub255bW91cycgOiBmYWxzZVxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICBydW50aW1lQ2h1bms6ICdzaW5nbGUnLFxuICAgICAgc3BsaXRDaHVua3M6IHtcbiAgICAgICAgY2h1bmtzOiBidWlsZE9wdGlvbnMuY29tbW9uQ2h1bmsgPyAnYWxsJyA6ICdpbml0aWFsJyxcbiAgICAgICAgY2FjaGVHcm91cHM6IHtcbiAgICAgICAgICB2ZW5kb3JzOiBmYWxzZSxcbiAgICAgICAgICB2ZW5kb3I6IGJ1aWxkT3B0aW9ucy52ZW5kb3JDaHVuayAmJiB7XG4gICAgICAgICAgICBuYW1lOiAndmVuZG9yJyxcbiAgICAgICAgICAgIGNodW5rczogJ2luaXRpYWwnLFxuICAgICAgICAgICAgdGVzdDogKG1vZHVsZTogYW55LCBjaHVua3M6IEFycmF5PHsgbmFtZTogc3RyaW5nIH0+KSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IG1vZHVsZU5hbWUgPSBtb2R1bGUubmFtZUZvckNvbmRpdGlvbiA/IG1vZHVsZS5uYW1lRm9yQ29uZGl0aW9uKCkgOiAnJztcbiAgICAgICAgICAgICAgcmV0dXJuIC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXS8udGVzdChtb2R1bGVOYW1lKVxuICAgICAgICAgICAgICAgICYmICFjaHVua3Muc29tZSgoeyBuYW1lIH0pID0+IG5hbWUgPT09ICdwb2x5ZmlsbHMnXG4gICAgICAgICAgICAgICAgICB8fCBnbG9iYWxTdHlsZXNFbnRyaWVzLmluY2x1ZGVzKG5hbWUpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLmNvbmNhdChbXG4gICAgICBuZXcgSW5kZXhIdG1sV2VicGFja1BsdWdpbih7XG4gICAgICAgIGlucHV0OiBwYXRoLnJlc29sdmUocm9vdCwgYXBwQ29uZmlnLmluZGV4KSxcbiAgICAgICAgb3V0cHV0OiBwYXRoLmJhc2VuYW1lKGFwcENvbmZpZy5pbmRleCksXG4gICAgICAgIGJhc2VIcmVmOiBidWlsZE9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgIGVudHJ5cG9pbnRzOiBnZW5lcmF0ZUVudHJ5UG9pbnRzKGFwcENvbmZpZyksXG4gICAgICAgIGRlcGxveVVybDogYnVpbGRPcHRpb25zLmRlcGxveVVybCxcbiAgICAgIH0pLFxuICAgIF0pLFxuICAgIG5vZGU6IGZhbHNlLFxuICB9O1xufVxuIl19