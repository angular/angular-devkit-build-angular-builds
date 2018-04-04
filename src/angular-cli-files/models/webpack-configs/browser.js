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
    const lazyChunkBundleNames = [...buildOptions.styles, ...buildOptions.scripts]
        .filter(entry => entry.lazy)
        .map(style => utils_1.computeBundleName(style, 'not-lazy'));
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
        .map(style => utils_1.computeBundleName(style, 'styles'));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncy9icm93c2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBaUI7QUFDakIsK0RBQStEOztBQUUvRCw2QkFBNkI7QUFDN0IsTUFBTSxpQkFBaUIsR0FBRyxPQUFPLENBQUMscUJBQXFCLENBQUMsQ0FBQztBQUN6RCxNQUFNLDBCQUEwQixHQUFHLE9BQU8sQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0FBQzVFLG1FQUE4RDtBQUM5RCwyRUFBMkY7QUFDM0YsbUVBQW9FO0FBQ3BFLHVGQUFpRjtBQUdqRixtQ0FBNEM7QUFFNUM7Ozs7O0lBS0k7QUFFSiwwQkFBaUMsR0FBeUI7SUFDeEQsTUFBTSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBR2hELElBQUksWUFBWSxHQUFVLEVBQUUsQ0FBQztJQUU3QixxREFBcUQ7SUFDckQsTUFBTSxvQkFBb0IsR0FBSSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sRUFBRSxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQXVCO1NBQ2xHLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7U0FFM0IsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMseUJBQWlCLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFFdEQsTUFBTSxpQkFBaUIsR0FBRyxLQUFLLENBQUM7SUFDaEMsRUFBRSxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxpQkFBaUIsQ0FBQztZQUN0QyxRQUFRLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVB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RSxFQUFFOzRCQUNyRCxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7NEJBQzVFLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO21DQUMzQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEtBQUssV0FBVzt1Q0FDN0MsdUJBQXVCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7d0JBQ2pELENBQUM7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGO1FBQ0QsT0FBTyxFQUFFLFlBQVksQ0FBQyxNQUFNLENBQUM7WUFDM0IsSUFBSSxrREFBc0IsQ0FBQztnQkFDekIsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxLQUFLLENBQUM7Z0JBQzdDLE1BQU0sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUM7Z0JBQ3pDLFFBQVEsRUFBRSxZQUFZLENBQUMsUUFBUTtnQkFDL0IsV0FBVyxFQUFFLHdDQUFtQixDQUFDLFlBQVksQ0FBQztnQkFDOUMsU0FBUyxFQUFFLFlBQVksQ0FBQyxTQUFTO2FBQ2xDLENBQUM7U0FDSCxDQUFDO1FBQ0YsSUFBSSxFQUFFLEtBQUs7S0FDWixDQUFDO0FBQ0osQ0FBQztBQXRHRCw0Q0FzR0MiLCJzb3VyY2VzQ29udGVudCI6WyIvLyB0c2xpbnQ6ZGlzYWJsZVxuLy8gVE9ETzogY2xlYW51cCB0aGlzIGZpbGUsIGl0J3MgY29waWVkIGFzIGlzIGZyb20gQW5ndWxhciBDTEkuXG5cbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5jb25zdCBIdG1sV2VicGFja1BsdWdpbiA9IHJlcXVpcmUoJ2h0bWwtd2VicGFjay1wbHVnaW4nKTtcbmNvbnN0IFN1YnJlc291cmNlSW50ZWdyaXR5UGx1Z2luID0gcmVxdWlyZSgnd2VicGFjay1zdWJyZXNvdXJjZS1pbnRlZ3JpdHknKTtcbmltcG9ydCB7IExpY2Vuc2VXZWJwYWNrUGx1Z2luIH0gZnJvbSAnbGljZW5zZS13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgeyBnZW5lcmF0ZUVudHJ5UG9pbnRzLCBwYWNrYWdlQ2h1bmtTb3J0IH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL3BhY2thZ2UtY2h1bmstc29ydCc7XG5pbXBvcnQgeyBCYXNlSHJlZldlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9saWIvYmFzZS1ocmVmLXdlYnBhY2snO1xuaW1wb3J0IHsgSW5kZXhIdG1sV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvaW5kZXgtaHRtbC13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgeyBFeHRyYUVudHJ5UG9pbnQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBjb21wdXRlQnVuZGxlTmFtZSB9IGZyb20gJy4vdXRpbHMnO1xuXG4vKipcbisgKiBsaWNlbnNlLXdlYnBhY2stcGx1Z2luIGhhcyBhIHBlZXIgZGVwZW5kZW5jeSBvbiB3ZWJwYWNrLXNvdXJjZXMsIGxpc3QgaXQgaW4gYSBjb21tZW50IHRvXG4rICogbGV0IHRoZSBkZXBlbmRlbmN5IHZhbGlkYXRvciBrbm93IGl0IGlzIHVzZWQuXG4rICpcbisgKiByZXF1aXJlKCd3ZWJwYWNrLXNvdXJjZXMnKVxuKyAqL1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QnJvd3NlckNvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKSB7XG4gIGNvbnN0IHsgcm9vdCwgcHJvamVjdFJvb3QsIGJ1aWxkT3B0aW9ucyB9ID0gd2NvO1xuXG5cbiAgbGV0IGV4dHJhUGx1Z2luczogYW55W10gPSBbXTtcblxuICAvLyBGaWd1cmUgb3V0IHdoaWNoIGFyZSB0aGUgbGF6eSBsb2FkZWQgYnVuZGxlIG5hbWVzLlxuICBjb25zdCBsYXp5Q2h1bmtCdW5kbGVOYW1lcyA9IChbLi4uYnVpbGRPcHRpb25zLnN0eWxlcywgLi4uYnVpbGRPcHRpb25zLnNjcmlwdHNdIGFzIEV4dHJhRW50cnlQb2ludFtdKVxuICAgIC5maWx0ZXIoZW50cnkgPT4gZW50cnkubGF6eSlcbiAgICAvLyBXZSBkb24ndCByZWFsbHkgbmVlZCBhIGRlZmF1bHQgbmFtZSBiZWNhdXNlIHdlIHByZS1maWx0ZXJlZCBieSBsYXp5IG9ubHkgZW50cmllcy5cbiAgICAubWFwKHN0eWxlID0+IGNvbXB1dGVCdW5kbGVOYW1lKHN0eWxlLCAnbm90LWxhenknKSk7XG5cbiAgY29uc3QgZ2VuZXJhdGVJbmRleEh0bWwgPSBmYWxzZTtcbiAgaWYgKGdlbmVyYXRlSW5kZXhIdG1sKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IEh0bWxXZWJwYWNrUGx1Z2luKHtcbiAgICAgIHRlbXBsYXRlOiBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLmluZGV4KSxcbiAgICAgIGZpbGVuYW1lOiBwYXRoLnJlc29sdmUoYnVpbGRPcHRpb25zLm91dHB1dFBhdGgsIGJ1aWxkT3B0aW9ucy5pbmRleCksXG4gICAgICBjaHVua3NTb3J0TW9kZTogcGFja2FnZUNodW5rU29ydChidWlsZE9wdGlvbnMpLFxuICAgICAgZXhjbHVkZUNodW5rczogbGF6eUNodW5rQnVuZGxlTmFtZXMsXG4gICAgICB4aHRtbDogdHJ1ZSxcbiAgICAgIG1pbmlmeTogYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbiA/IHtcbiAgICAgICAgY2FzZVNlbnNpdGl2ZTogdHJ1ZSxcbiAgICAgICAgY29sbGFwc2VXaGl0ZXNwYWNlOiB0cnVlLFxuICAgICAgICBrZWVwQ2xvc2luZ1NsYXNoOiB0cnVlXG4gICAgICB9IDogZmFsc2VcbiAgICB9KSk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IEJhc2VIcmVmV2VicGFja1BsdWdpbih7XG4gICAgICBiYXNlSHJlZjogYnVpbGRPcHRpb25zLmJhc2VIcmVmIGFzIHN0cmluZ1xuICAgIH0pKTtcbiAgfVxuXG4gIGxldCBzb3VyY2VtYXBzOiBzdHJpbmcgfCBmYWxzZSA9IGZhbHNlO1xuICBpZiAoYnVpbGRPcHRpb25zLnNvdXJjZU1hcCkge1xuICAgIC8vIFNlZSBodHRwczovL3dlYnBhY2suanMub3JnL2NvbmZpZ3VyYXRpb24vZGV2dG9vbC8gZm9yIHNvdXJjZW1hcCB0eXBlcy5cbiAgICBpZiAoYnVpbGRPcHRpb25zLmV2YWxTb3VyY2VNYXAgJiYgIWJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24pIHtcbiAgICAgIC8vIFByb2R1Y2UgZXZhbCBzb3VyY2VtYXBzIGZvciBkZXZlbG9wbWVudCB3aXRoIHNlcnZlLCB3aGljaCBhcmUgZmFzdGVyLlxuICAgICAgc291cmNlbWFwcyA9ICdldmFsJztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gUHJvZHVjZSBmdWxsIHNlcGFyYXRlIHNvdXJjZW1hcHMgZm9yIHByb2R1Y3Rpb24uXG4gICAgICBzb3VyY2VtYXBzID0gJ3NvdXJjZS1tYXAnO1xuICAgIH1cbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHkpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4oe1xuICAgICAgaGFzaEZ1bmNOYW1lczogWydzaGEzODQnXVxuICAgIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IExpY2Vuc2VXZWJwYWNrUGx1Z2luKHtcbiAgICAgIHBhdHRlcm46IC8uKi8sXG4gICAgICBzdXBwcmVzc0Vycm9yczogdHJ1ZSxcbiAgICAgIHBlckNodW5rT3V0cHV0OiBmYWxzZSxcbiAgICAgIG91dHB1dEZpbGVuYW1lOiBgM3JkcGFydHlsaWNlbnNlcy50eHRgXG4gICAgfSkpO1xuICB9XG5cbiAgY29uc3QgZ2xvYmFsU3R5bGVzQnVuZGxlTmFtZXMgPSAoYnVpbGRPcHRpb25zLnN0eWxlcyBhcyBFeHRyYUVudHJ5UG9pbnRbXSlcbiAgICAubWFwKHN0eWxlID0+IGNvbXB1dGVCdW5kbGVOYW1lKHN0eWxlLCAnc3R5bGVzJykpO1xuXG4gIHJldHVybiB7XG4gICAgZGV2dG9vbDogc291cmNlbWFwcyxcbiAgICByZXNvbHZlOiB7XG4gICAgICBtYWluRmllbGRzOiBbXG4gICAgICAgIC4uLih3Y28uc3VwcG9ydEVTMjAxNSA/IFsnZXMyMDE1J10gOiBbXSksXG4gICAgICAgICdicm93c2VyJywgJ21vZHVsZScsICdtYWluJ1xuICAgICAgXVxuICAgIH0sXG4gICAgb3V0cHV0OiB7XG4gICAgICBjcm9zc09yaWdpbkxvYWRpbmc6IGJ1aWxkT3B0aW9ucy5zdWJyZXNvdXJjZUludGVncml0eSA/ICdhbm9ueW1vdXMnIDogZmFsc2VcbiAgICB9LFxuICAgIG9wdGltaXphdGlvbjoge1xuICAgICAgcnVudGltZUNodW5rOiAnc2luZ2xlJyxcbiAgICAgIHNwbGl0Q2h1bmtzOiB7XG4gICAgICAgIGNodW5rczogYnVpbGRPcHRpb25zLmNvbW1vbkNodW5rID8gJ2FsbCcgOiAnaW5pdGlhbCcsXG4gICAgICAgIGNhY2hlR3JvdXBzOiB7XG4gICAgICAgICAgdmVuZG9yczogZmFsc2UsXG4gICAgICAgICAgdmVuZG9yOiBidWlsZE9wdGlvbnMudmVuZG9yQ2h1bmsgJiYge1xuICAgICAgICAgICAgbmFtZTogJ3ZlbmRvcicsXG4gICAgICAgICAgICBjaHVua3M6ICdpbml0aWFsJyxcbiAgICAgICAgICAgIHRlc3Q6IChtb2R1bGU6IGFueSwgY2h1bmtzOiBBcnJheTx7IG5hbWU6IHN0cmluZyB9PikgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBtb2R1bGVOYW1lID0gbW9kdWxlLm5hbWVGb3JDb25kaXRpb24gPyBtb2R1bGUubmFtZUZvckNvbmRpdGlvbigpIDogJyc7XG4gICAgICAgICAgICAgIHJldHVybiAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL10vLnRlc3QobW9kdWxlTmFtZSlcbiAgICAgICAgICAgICAgICAmJiAhY2h1bmtzLnNvbWUoKHsgbmFtZSB9KSA9PiBuYW1lID09PSAncG9seWZpbGxzJ1xuICAgICAgICAgICAgICAgICAgfHwgZ2xvYmFsU3R5bGVzQnVuZGxlTmFtZXMuaW5jbHVkZXMobmFtZSkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBwbHVnaW5zOiBleHRyYVBsdWdpbnMuY29uY2F0KFtcbiAgICAgIG5ldyBJbmRleEh0bWxXZWJwYWNrUGx1Z2luKHtcbiAgICAgICAgaW5wdXQ6IHBhdGgucmVzb2x2ZShyb290LCBidWlsZE9wdGlvbnMuaW5kZXgpLFxuICAgICAgICBvdXRwdXQ6IHBhdGguYmFzZW5hbWUoYnVpbGRPcHRpb25zLmluZGV4KSxcbiAgICAgICAgYmFzZUhyZWY6IGJ1aWxkT3B0aW9ucy5iYXNlSHJlZixcbiAgICAgICAgZW50cnlwb2ludHM6IGdlbmVyYXRlRW50cnlQb2ludHMoYnVpbGRPcHRpb25zKSxcbiAgICAgICAgZGVwbG95VXJsOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgfSksXG4gICAgXSksXG4gICAgbm9kZTogZmFsc2UsXG4gIH07XG59XG4iXX0=